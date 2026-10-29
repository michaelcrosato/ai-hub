-- 0009's policies, written so each reads the token once per query.
--
-- The performance advisor flagged every policy 0009 changed ("Auth RLS
-- Initialization Plan", auth_rls_initplan): it looks for the text
-- `select auth.jwt()`, and Postgres stores 0009's `(select auth.jwt() ->> ...)`
-- as `SELECT (auth.jwt() ->> ...)`, so it reads as auth.jwt() called for every
-- row. Here the subquery holds auth.jwt() alone and the claim is read from
-- its result. The same rules as 0009, word for word; only where the
-- parentheses sit changes.
--
-- Additive: only `alter policy`. Checked on a local Postgres 16 with
-- stand-ins for Supabase's auth, realtime and cron: 0001-0010 apply in order,
-- supabase/tests/rls.sql passes, and splinter's auth_rls_initplan and the
-- is_anonymous test find nothing on our policies.

/* --- signed-in players only ---------------------------------------------- */

alter policy "profiles: read own" on public.profiles
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "profiles: add own" on public.profiles
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "profiles: change own" on public.profiles
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

alter policy "feedback: read own" on public.feedback
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "feedback: add own, not as a guest" on public.feedback
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "feedback: change own, not as a guest" on public.feedback
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "feedback: take back own" on public.feedback
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

alter policy "plays: read own" on public.plays
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

/* --- sessions: players keep the history, guests see it while seated ------- */

alter policy "sessions: members read" on public.game_sessions
  using ((select public.is_session_member(id, coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
alter policy "members: members read" on public.session_members
  using ((select public.is_session_member(session_id, coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
alter policy "rounds: members read" on public.session_rounds
  using ((select public.is_session_member(session_id, coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
alter policy "results: members read" on public.round_results
  using ((select public.is_session_member(session_id, coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));

/* --- the session channel: seated players with a Supabase Auth token ------- */

alter policy "session channel: members listen" on realtime.messages
  using (realtime.messages.extension in ('broadcast', 'presence')
         and ((select auth.jwt()) ->> 'is_anonymous') is not null
         and (select public.may_use_session_topic((select realtime.topic()))));
alter policy "session channel: members speak" on realtime.messages
  with check (realtime.messages.extension in ('broadcast', 'presence')
              and ((select auth.jwt()) ->> 'is_anonymous') is not null
              and (select public.may_use_session_topic((select realtime.topic()))));
