-- A round's mode may be any short protocol word, not only the three of 0002.
--
-- Client 1.3.0 adds side by side (hub:session-mode "parallel", lib/hub/README.md).
-- 0002 allowed only 'versus', 'co-op' and 'race' in session_rounds.mode, so
-- record_round would reject every side-by-side round and its history would be
-- lost. The check now takes any lowercase word of up to sixteen letters and
-- hyphens, so a mode added later needs no migration. Additive: it only widens
-- what a row may hold; no row, function or policy changes.
--
-- NOT YET APPLIED (written 2026-10-29). Apply it after 0007, in the ai-hub SQL
-- editor (docs/party-sessions-handoff.md), then run supabase/tests/rls.sql.

alter table public.session_rounds drop constraint if exists session_rounds_mode_check;
alter table public.session_rounds add constraint session_rounds_mode_check check (mode ~ '^[a-z][a-z-]{0,15}$');
