-- Indexes for the two foreign keys the performance advisor found uncovered.
--
-- The security advisor's "signed-in users can execute SECURITY DEFINER
-- function" warnings on the session and account functions are intended: the
-- tables have no write policies, so every write goes through one of these
-- functions, and each one checks who is calling (see 0001 and 0002).

create index if not exists game_sessions_host on public.game_sessions (host_id);
create index if not exists session_rounds_recorded_by on public.session_rounds (recorded_by);
