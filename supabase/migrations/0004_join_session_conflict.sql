-- join_session returns a column called session_id, so inside the function
-- "on conflict (session_id, user_id)" was ambiguous and every join failed
-- with "column reference session_id is ambiguous". Found by
-- supabase/tests/rls.sql. Naming the primary key instead settles it; nothing
-- else changes.

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
  on conflict on constraint session_members_pkey do update
    set slot = excluded.slot, nickname = excluded.nickname, left_at = null, joined_at = now();
  return query select s.id, seat, s.host_id, s.seed;
end;
$$;
