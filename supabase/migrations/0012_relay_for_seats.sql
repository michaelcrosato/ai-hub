-- Relay credentials only for players in a game.
--
-- The turn Edge Function hands out Cloudflare TURN credentials, and relayed
-- traffic past the free allowance is billed. It answered any caller: on
-- 2026-11-05 a request carrying only the site's public key got credentials,
-- so anyone could have relayed their own traffic on the hub's bill. The page
-- asks only once its player holds a seat (session/app.js, joinOnline), so the
-- function now asks this first, with the caller's own token: is the caller
-- seated (not gone, not removed) in a session that is still open?
--
-- Same shape as 0007: the SECURITY DEFINER body lives in `private`, behind a
-- SECURITY INVOKER function of the same name in `public`.

create or replace function private.has_live_seat() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_members m
    join public.game_sessions s on s.id = m.session_id
    where m.user_id = (select auth.uid()) and m.left_at is null and not m.kicked and s.status = 'open'
  );
$$;

revoke all on function private.has_live_seat() from public, anon;
grant execute on function private.has_live_seat() to authenticated;

create or replace function public.has_live_seat() returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.has_live_seat() $$;
