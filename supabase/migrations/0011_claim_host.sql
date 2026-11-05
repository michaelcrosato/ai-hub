-- The host follows the page.
--
-- The session page hosts from its lowest seated tab, so when the host's tab
-- closes, the next seat takes over. game_sessions.host_id moved only when the
-- host called leave_session, which closing a tab never does, so the new host
-- could not remove a player or end the session. The tab that becomes host now
-- claims the role here (session/app.js, takeOver).
--
-- Any seated player may claim it. Seats already trust each other
-- (docs/session-hub.md, Known limits); Michael chose this trade on 2026-11-05.
-- A player who has left or was removed may not, and an ended session keeps
-- its host. Same shape as 0007: the SECURITY DEFINER body lives in `private`,
-- behind a SECURITY INVOKER function of the same name in `public`.

create or replace function private.claim_session_host(p_session uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.session_members
    where session_id = p_session and user_id = me and left_at is null and not kicked
  ) then
    raise exception 'not seated in this session' using errcode = '42501';
  end if;
  update public.game_sessions set host_id = me
  where id = p_session and status = 'open' and host_id <> me;
end;
$$;

revoke all on function private.claim_session_host(uuid) from public, anon;
grant execute on function private.claim_session_host(uuid) to authenticated;

create or replace function public.claim_session_host(p_session uuid) returns void
language sql
security invoker
set search_path = ''
as $$ select private.claim_session_host(p_session) $$;
