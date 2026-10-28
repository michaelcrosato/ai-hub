-- What the security advisor still reports for 0001–0006, settled. Nothing the
-- hub's pages call changes name, arguments or behaviour: same functions, same
-- results, same errors.
--
-- NOT YET APPLIED (written 2026-10-28 in a session that could not reach the
-- live database). Apply it in the ai-hub SQL editor, then run
-- supabase/tests/rls.sql and both advisors (docs/party-sessions-handoff.md).
-- Checked on a local Postgres 16 with stand-ins for Supabase's auth, realtime
-- and cron: 0001–0007 apply in order, rls.sql passes all 39 checks (its last
-- three fail without this migration), and Supabase's own advisor lints
-- (splinter) find nothing left but the GraphQL one noted below.
--
-- 1. "Signed-in users can execute SECURITY DEFINER function"
--    (authenticated_security_definer_function_executable), on every function
--    the pages call. 0003 kept them as intended; this moves them out of reach
--    instead. Each SECURITY DEFINER body now lives in the schema `private`,
--    which the Data API does not expose, and the public function of the same
--    name and arguments is a SECURITY INVOKER wrapper that calls it. The
--    checks inside (who is calling, seated, host, guest) are unchanged.
--
-- 2. "Public can see object in GraphQL schema" (pg_graphql_anon_table_exposed)
--    on every table: `anon` keeps Supabase's default grants on them. Nobody
--    uses the tables without signing in, so `anon` loses them.
--
-- Left as designed: "Signed-in users can see object in GraphQL schema"
-- (pg_graphql_authenticated_table_exposed). Signed-in players read their own
-- votes, plays and nickname, and the sessions they sit in, under the RLS
-- policies; RLS still hides every other row. Clearing it means turning off
-- the pg_graphql extension, which the hub does not use: the owner's call.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

/* --- 1. SECURITY DEFINER bodies, out of the Data API ---------------------- */

create or replace function private.track_play(
  p_id uuid,
  p_slug text,
  p_build text,
  p_view text,
  p_started_at timestamptz,
  p_active_seconds integer,
  p_session_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  started timestamptz := least(p_started_at, now());
  active integer;
begin
  if me is null or public.is_guest() then
    raise exception 'sign in to record plays' using errcode = '42501';
  end if;
  if started < now() - interval '2 days' then
    raise exception 'play started too long ago' using errcode = '22023';
  end if;
  active := greatest(0, least(coalesce(p_active_seconds, 0), ceil(extract(epoch from now() - started))::integer + 5));
  insert into public.plays as p (id, user_id, slug, build, view, session_id, started_at, active_seconds, ended_at)
  values (p_id, me, p_slug, p_build, p_view, p_session_id, started, active, now())
  on conflict (id) do update
    set active_seconds = greatest(p.active_seconds, excluded.active_seconds), ended_at = now()
    where p.user_id = me;
end;
$$;

create or replace function private.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  latest bigint;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select max((a ->> 'timestamp')::bigint) into latest
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a;
  if coalesce(latest, 0) < extract(epoch from now()) - 600 then
    raise exception 'sign in again to delete your account' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

create or replace function private.is_session_member(p_session uuid, active boolean default false)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_members m
    where m.session_id = p_session and m.user_id = (select auth.uid()) and not m.kicked
      and (not active or m.left_at is null)
  )
$$;

create or replace function private.create_session(p_nickname text)
returns table (session_id uuid, code text, slot smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s public.game_sessions;
begin
  if me is null or public.is_guest() then
    raise exception 'sign in with Google to host a session' using errcode = '42501';
  end if;
  insert into public.game_sessions (code, host_id, seed)
  values (public.new_session_code(), me, (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint))
  returning * into s;
  insert into public.session_members (session_id, user_id, slot, nickname, is_guest)
  values (s.id, me, 0, p_nickname, false);
  insert into public.profiles (user_id, nickname) values (me, p_nickname)
  on conflict (user_id) do update set nickname = excluded.nickname;
  return query select s.id, s.code, 0::smallint;
end;
$$;

-- As in 0004: the primary key is named, so session_id is never ambiguous.
create or replace function private.join_session(p_code text, p_nickname text)
returns table (session_id uuid, slot smallint, host_id uuid, seed bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s public.game_sessions;
  m public.session_members;
  seat smallint;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into s from public.game_sessions g where g.code = lower(p_code) for update;
  if s.id is null or s.status <> 'open' then
    raise exception 'no open session with that code' using errcode = 'P0002';
  end if;
  select * into m from public.session_members x where x.session_id = s.id and x.user_id = me;
  if m.kicked then
    raise exception 'you were removed from this session' using errcode = '42501';
  end if;
  if exists (select 1 from public.session_members x where x.session_id = s.id and x.left_at is null
             and x.user_id <> me and x.nickname = p_nickname) then
    raise exception 'that name is taken in this session' using errcode = '23505';
  end if;
  if m.user_id is not null and m.left_at is null then
    update public.session_members x set nickname = p_nickname where x.session_id = s.id and x.user_id = me;
    return query select s.id, m.slot, s.host_id, s.seed;
    return;
  end if;
  select min(n)::smallint into seat from generate_series(0, 3) n
  where not exists (select 1 from public.session_members x where x.session_id = s.id and x.left_at is null and x.slot = n);
  if seat is null then
    raise exception 'this session is full' using errcode = '53400';
  end if;
  insert into public.session_members (session_id, user_id, slot, nickname, is_guest)
  values (s.id, me, seat, p_nickname, public.is_guest())
  on conflict on constraint session_members_pkey do update
    set slot = excluded.slot, nickname = excluded.nickname, left_at = null, joined_at = now();
  return query select s.id, seat, s.host_id, s.seed;
end;
$$;

create or replace function private.leave_session(p_session uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  next_host uuid;
begin
  update public.session_members set left_at = now()
  where session_id = p_session and user_id = me and left_at is null;
  if exists (select 1 from public.game_sessions where id = p_session and host_id = me) then
    select user_id into next_host from public.session_members
    where session_id = p_session and left_at is null order by slot limit 1;
    if next_host is not null then
      update public.game_sessions set host_id = next_host where id = p_session;
    end if;
  end if;
end;
$$;

create or replace function private.kick_from_session(p_session uuid, p_user uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.game_sessions where id = p_session and host_id = auth.uid()) then
    raise exception 'only the host can remove a player' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'the host cannot remove themselves' using errcode = '22023';
  end if;
  update public.session_members set kicked = true, left_at = coalesce(left_at, now())
  where session_id = p_session and user_id = p_user;
end;
$$;

-- As in 0006, with each player's stats and awards.
create or replace function private.record_round(
  p_session uuid,
  p_round integer,
  p_slug text,
  p_mode text,
  p_status text,
  p_reason text,
  p_scores jsonb,
  p_results jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if not private.is_session_member(p_session, true) then
    raise exception 'not seated in this session' using errcode = '42501';
  end if;
  insert into public.session_rounds (session_id, round_no, slug, mode, status, reason, scores, recorded_by)
  values (p_session, p_round, p_slug, p_mode, p_status, left(p_reason, 40), p_scores, auth.uid())
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  if p_status = 'played' and jsonb_typeof(p_results) = 'array' then
    insert into public.round_results (session_id, round_no, user_id, place, points, won, stats, awards)
    select p_session, p_round, (r ->> 'user_id')::uuid, (r ->> 'place')::smallint, (r ->> 'points')::smallint,
           coalesce((r ->> 'won')::boolean, false),
           case when jsonb_typeof(r -> 'stats') = 'object' and length((r -> 'stats')::text) <= 1000 then r -> 'stats' end,
           case when jsonb_typeof(r -> 'awards') = 'array' and jsonb_array_length(r -> 'awards') <= 3
                     and length((r -> 'awards')::text) <= 1000 then r -> 'awards' end
    from jsonb_array_elements(p_results) r
    where exists (select 1 from public.session_members m
                  where m.session_id = p_session and m.user_id = (r ->> 'user_id')::uuid);
  end if;
  return true;
end;
$$;

create or replace function private.end_session(p_session uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_sessions set status = 'ended', ended_at = now()
  where id = p_session and host_id = auth.uid() and status = 'open';
end;
$$;

create or replace function private.may_use_session_topic(topic text) returns boolean
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if topic !~ '^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.is_session_member(substr(topic, 9)::uuid, true);
end;
$$;

revoke all on function private.track_play(uuid, text, text, text, timestamptz, integer, uuid) from public, anon;
revoke all on function private.delete_my_account() from public, anon;
revoke all on function private.is_session_member(uuid, boolean) from public, anon;
revoke all on function private.create_session(text) from public, anon;
revoke all on function private.join_session(text, text) from public, anon;
revoke all on function private.leave_session(uuid) from public, anon;
revoke all on function private.kick_from_session(uuid, uuid) from public, anon;
revoke all on function private.record_round(uuid, integer, text, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function private.end_session(uuid) from public, anon;
revoke all on function private.may_use_session_topic(text) from public, anon;
grant execute on function private.track_play(uuid, text, text, text, timestamptz, integer, uuid) to authenticated;
grant execute on function private.delete_my_account() to authenticated;
grant execute on function private.is_session_member(uuid, boolean) to authenticated;
grant execute on function private.create_session(text) to authenticated;
grant execute on function private.join_session(text, text) to authenticated;
grant execute on function private.leave_session(uuid) to authenticated;
grant execute on function private.kick_from_session(uuid, uuid) to authenticated;
grant execute on function private.record_round(uuid, integer, text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function private.end_session(uuid) to authenticated;
grant execute on function private.may_use_session_topic(text) to authenticated;

/* --- the public functions: same names and arguments, SECURITY INVOKER ----- */

create or replace function public.track_play(
  p_id uuid,
  p_slug text,
  p_build text,
  p_view text,
  p_started_at timestamptz,
  p_active_seconds integer,
  p_session_id uuid default null
) returns void
language sql
security invoker
set search_path = ''
as $$ select private.track_play(p_id, p_slug, p_build, p_view, p_started_at, p_active_seconds, p_session_id) $$;

create or replace function public.delete_my_account() returns void
language sql
security invoker
set search_path = ''
as $$ select private.delete_my_account() $$;

create or replace function public.is_session_member(p_session uuid, active boolean default false)
returns boolean
language sql stable
security invoker
set search_path = ''
as $$ select private.is_session_member(p_session, active) $$;

create or replace function public.create_session(p_nickname text)
returns table (session_id uuid, code text, slot smallint)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_session(p_nickname) $$;

create or replace function public.join_session(p_code text, p_nickname text)
returns table (session_id uuid, slot smallint, host_id uuid, seed bigint)
language sql
security invoker
set search_path = ''
as $$ select * from private.join_session(p_code, p_nickname) $$;

create or replace function public.leave_session(p_session uuid) returns void
language sql
security invoker
set search_path = ''
as $$ select private.leave_session(p_session) $$;

create or replace function public.kick_from_session(p_session uuid, p_user uuid) returns void
language sql
security invoker
set search_path = ''
as $$ select private.kick_from_session(p_session, p_user) $$;

create or replace function public.record_round(
  p_session uuid,
  p_round integer,
  p_slug text,
  p_mode text,
  p_status text,
  p_reason text,
  p_scores jsonb,
  p_results jsonb
) returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.record_round(p_session, p_round, p_slug, p_mode, p_status, p_reason, p_scores, p_results) $$;

create or replace function public.end_session(p_session uuid) returns void
language sql
security invoker
set search_path = ''
as $$ select private.end_session(p_session) $$;

create or replace function public.may_use_session_topic(topic text) returns boolean
language sql stable
security invoker
set search_path = ''
as $$ select private.may_use_session_topic(topic) $$;

/* --- 2. nothing for anon ------------------------------------------------- */

-- Every visitor who reads or writes these tables signs in first (a session
-- guest signs in anonymously, as `authenticated`), so `anon` needs none of
-- them, and with pg_graphql on, its grants put every table in the GraphQL
-- schema anyone can read (pg_graphql_anon_table_exposed).
revoke all on table
  public.profiles,
  public.feedback,
  public.plays,
  public.game_sessions,
  public.session_members,
  public.session_rounds,
  public.round_results
from anon;
