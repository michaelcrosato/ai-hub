-- Sessions: up to four players, a host who signed in with Google, guests who
-- joined by invite code, the rounds they played and where everyone placed.
--
-- Every change goes through a function below that checks who is asking; the
-- tables themselves can only be read, and only by the session's members. The
-- session's Realtime channel ("session:<id>") is private to its members too.

create extension if not exists pgcrypto with schema extensions;

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z2-9]{10}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'random' check (mode in ('random')),
  seed bigint not null,
  status text not null default 'open' check (status in ('open', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.session_members (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 0 and 3),
  nickname text not null check (nickname ~ '^[A-Z][a-z]+ [A-Z][a-z]+$' and length(nickname) <= 16),
  is_guest boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  kicked boolean not null default false,
  primary key (session_id, user_id)
);
create unique index session_members_seat on public.session_members (session_id, slot) where left_at is null;
create index session_members_user on public.session_members (user_id);

create table public.session_rounds (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_no integer not null check (round_no > 0),
  slug text not null check (length(slug) between 1 and 200),
  mode text check (mode in ('versus', 'co-op', 'race')),
  status text not null check (status in ('played', 'void', 'skipped')),
  reason text check (length(reason) <= 40),
  scores jsonb,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (session_id, round_no)
);

create table public.round_results (
  session_id uuid not null,
  round_no integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  place smallint not null check (place between 1 and 4),
  points smallint not null check (points between 0 and 3),
  won boolean not null default false,
  primary key (session_id, round_no, user_id),
  foreign key (session_id, round_no) references public.session_rounds (session_id, round_no) on delete cascade
);
create index round_results_user on public.round_results (user_id);

-- Who belongs: seated now (`active`), or ever seated and never removed.
create or replace function public.is_session_member(p_session uuid, active boolean default false)
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

alter table public.game_sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.session_rounds enable row level security;
alter table public.round_results enable row level security;
create policy "sessions: members read" on public.game_sessions for select to authenticated
  using ((select public.is_session_member(id)));
create policy "members: members read" on public.session_members for select to authenticated
  using ((select public.is_session_member(session_id)));
create policy "rounds: members read" on public.session_rounds for select to authenticated
  using ((select public.is_session_member(session_id)));
create policy "results: members read" on public.round_results for select to authenticated
  using ((select public.is_session_member(session_id)));

-- A ten-character invite code from an alphabet with no look-alikes.
create or replace function public.new_session_code() returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(10);
  out text := '';
begin
  for i in 0..9 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return translate(out, 'lo01', 'xyz2');
end;
$$;

-- Host a session: signed in with Google, seated first.
create or replace function public.create_session(p_nickname text)
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

-- Take a seat with an invite code (guests included). Coming back to a seat
-- keeps it while it is free; a removed player cannot come back.
create or replace function public.join_session(p_code text, p_nickname text)
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
  on conflict (session_id, user_id) do update
    set slot = excluded.slot, nickname = excluded.nickname, left_at = null, joined_at = now();
  return query select s.id, seat, s.host_id, s.seed;
end;
$$;

-- Leave the seat. A host who leaves hands hosting to the lowest seat left.
create or replace function public.leave_session(p_session uuid) returns void
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

-- The host removes a player for the rest of the session.
create or replace function public.kick_from_session(p_session uuid, p_user uuid) returns void
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

-- Record a round once (the first member to report it wins; repeats are ignored).
-- p_results: [{ "user_id": uuid, "place": 1-4, "points": 0-3, "won": bool }]
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if not public.is_session_member(p_session, true) then
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
    insert into public.round_results (session_id, round_no, user_id, place, points, won)
    select p_session, p_round, (r ->> 'user_id')::uuid, (r ->> 'place')::smallint, (r ->> 'points')::smallint,
           coalesce((r ->> 'won')::boolean, false)
    from jsonb_array_elements(p_results) r
    where exists (select 1 from public.session_members m
                  where m.session_id = p_session and m.user_id = (r ->> 'user_id')::uuid);
  end if;
  return true;
end;
$$;

create or replace function public.end_session(p_session uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_sessions set status = 'ended', ended_at = now()
  where id = p_session and host_id = auth.uid() and status = 'open';
end;
$$;

-- The session's Realtime channel: members still seated may listen and speak.
create or replace function public.may_use_session_topic(topic text) returns boolean
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if topic !~ '^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_session_member(substr(topic, 9)::uuid, true);
end;
$$;

create policy "session channel: members listen" on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
         and (select public.may_use_session_topic((select realtime.topic()))));
create policy "session channel: members speak" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence')
              and (select public.may_use_session_topic((select realtime.topic()))));

revoke all on function public.is_session_member(uuid, boolean) from public, anon;
revoke all on function public.new_session_code() from public, anon, authenticated;
revoke all on function public.create_session(text) from public, anon;
revoke all on function public.join_session(text, text) from public, anon;
revoke all on function public.leave_session(uuid) from public, anon;
revoke all on function public.kick_from_session(uuid, uuid) from public, anon;
revoke all on function public.record_round(uuid, integer, text, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.end_session(uuid) from public, anon;
revoke all on function public.may_use_session_topic(text) from public, anon;
grant execute on function public.is_session_member(uuid, boolean) to authenticated;
grant execute on function public.create_session(text) to authenticated;
grant execute on function public.join_session(text, text) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.kick_from_session(uuid, uuid) to authenticated;
grant execute on function public.record_round(uuid, integer, text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.end_session(uuid) to authenticated;
grant execute on function public.may_use_session_topic(text) to authenticated;

-- Guests unused for 30 days go, with their seats (the privacy page says so).
create extension if not exists pg_cron;
select cron.schedule(
  'ai-hub-forget-old-guests',
  '17 4 * * *',
  $$delete from auth.users where is_anonymous and coalesce(last_sign_in_at, created_at) < now() - interval '30 days'$$
);
