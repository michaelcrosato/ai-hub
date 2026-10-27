-- Accounts: a nickname, a thumbs up or down per game, and play time.
--
-- Every write is checked here, not in the page: the page is public, and every
-- game on the wall runs on the same origin as the hub. A signed-in user can
-- only ever read and change their own rows. Anonymous users (session guests)
-- may keep a nickname but cannot vote or record plays.

create or replace function public.is_guest() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) $$;

-- Names come from the hub's two word lists (assets/js/session/names.js).
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname ~ '^[A-Z][a-z]+ [A-Z][a-z]+$' and length(nickname) <= 16),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "profiles: add own" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "profiles: change own" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.feedback (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (length(slug) between 1 and 200),
  vote smallint not null check (vote in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);
alter table public.feedback enable row level security;
create policy "feedback: read own" on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy "feedback: add own, not as a guest" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_guest()));
create policy "feedback: change own, not as a guest" on public.feedback for update to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_guest()))
  with check (user_id = (select auth.uid()) and not (select public.is_guest()));
create policy "feedback: take back own" on public.feedback for delete to authenticated
  using (user_id = (select auth.uid()));

-- One row per time a game was opened. Written only through track_play.
create table public.plays (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null check (length(slug) between 1 and 200),
  build text check (length(build) <= 200),
  view text check (length(view) <= 40),
  session_id uuid,
  started_at timestamptz not null,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  ended_at timestamptz not null default now()
);
create index plays_user_slug on public.plays (user_id, slug);
alter table public.plays enable row level security;
create policy "plays: read own" on public.plays for select to authenticated
  using (user_id = (select auth.uid()));

-- Record or extend one play. Active time can never exceed the time since it
-- started, so a page cannot claim more than really passed.
create or replace function public.track_play(
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

-- Per game: how often and how long this user has played, for every device.
create or replace function public.my_play_totals()
returns table (slug text, plays bigint, seconds bigint, last_played timestamptz)
language sql stable
security invoker
set search_path = ''
as $$
  select slug, count(*), coalesce(sum(active_seconds), 0), max(started_at)
  from public.plays
  where user_id = (select auth.uid())
  group by slug
$$;

-- Delete the account and everything tied to it. Asks for a sign-in within the
-- last ten minutes, so a stolen session token alone cannot do it.
create or replace function public.delete_my_account() returns void
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

revoke all on function public.track_play(uuid, text, text, text, timestamptz, integer, uuid) from public, anon;
revoke all on function public.my_play_totals() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.is_guest() from public, anon;
grant execute on function public.track_play(uuid, text, text, text, timestamptz, integer, uuid) to authenticated;
grant execute on function public.my_play_totals() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_guest() to authenticated;
