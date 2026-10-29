-- Every policy says what a guest may do. Session guests sign in anonymously
-- and share the `authenticated` role with signed-in players, so with anonymous
-- sign-ins on, the security advisor flags every policy that does not look at
-- the `is_anonymous` claim ("Anonymous Sign-Ins Allowed",
-- auth_allow_anonymous_sign_ins). Each policy now decides it in the open:
--
-- - Profiles, votes and plays belong to signed-in players. Guests already
--   could not write them (create_session, track_play and the vote policies
--   refuse a guest), so they have nothing to read either; reading is now
--   refused too.
-- - A session, its seats, rounds and results: a signed-in player keeps the
--   history of every session they sat in; a guest sees one only while seated
--   (is_session_member's `active`), so leaving ends what a guest can read.
-- - The session's Realtime channel was already for seated players only, guest
--   or not. It now also asks for a Supabase Auth token, which always says
--   whether its holder is a guest.
--
-- Additive: only `alter policy`, on the policies of 0001 and 0002. No table,
-- row, function or grant changes. Checked on a local Postgres 16 with
-- stand-ins for Supabase's auth, realtime and cron: 0001-0009 apply in order
-- and supabase/tests/rls.sql passes, with its three new checks for this.

/* --- signed-in players only ---------------------------------------------- */

alter policy "profiles: read own" on public.profiles
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "profiles: add own" on public.profiles
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "profiles: change own" on public.profiles
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

alter policy "feedback: read own" on public.feedback
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "feedback: add own, not as a guest" on public.feedback
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "feedback: change own, not as a guest" on public.feedback
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "feedback: take back own" on public.feedback
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

alter policy "plays: read own" on public.plays
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

/* --- sessions: players keep the history, guests see it while seated ------- */

alter policy "sessions: members read" on public.game_sessions
  using ((select public.is_session_member(id, (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)))));
alter policy "members: members read" on public.session_members
  using ((select public.is_session_member(session_id, (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)))));
alter policy "rounds: members read" on public.session_rounds
  using ((select public.is_session_member(session_id, (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)))));
alter policy "results: members read" on public.round_results
  using ((select public.is_session_member(session_id, (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)))));

/* --- the session channel: seated players with a Supabase Auth token ------- */

alter policy "session channel: members listen" on realtime.messages
  using (realtime.messages.extension in ('broadcast', 'presence')
         and (select auth.jwt() ->> 'is_anonymous') is not null
         and (select public.may_use_session_topic((select realtime.topic()))));
alter policy "session channel: members speak" on realtime.messages
  with check (realtime.messages.extension in ('broadcast', 'presence')
              and (select auth.jwt() ->> 'is_anonymous') is not null
              and (select public.may_use_session_topic((select realtime.topic()))));
