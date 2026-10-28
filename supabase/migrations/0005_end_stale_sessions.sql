-- Sessions nobody ended: once a day has gone by with no activity (created,
-- a seat taken, a round recorded), an open session is ended. Runs hourly.

create or replace function public.end_stale_sessions() returns integer
language sql
set search_path = ''
as $$
  with stale as (
    update public.game_sessions s
    set status = 'ended', ended_at = now()
    where s.status = 'open'
      and greatest(
        s.created_at,
        coalesce((select max(m.joined_at) from public.session_members m where m.session_id = s.id), s.created_at),
        coalesce((select max(r.recorded_at) from public.session_rounds r where r.session_id = s.id), s.created_at)
      ) < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from stale;
$$;

revoke all on function public.end_stale_sessions() from public, anon, authenticated;

select cron.schedule('ai-hub-end-stale-sessions', '23 * * * *', $$select public.end_stale_sessions()$$);
