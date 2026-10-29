# Party sessions: handoff (2026-10-28, evening)

What is left of the AI Hub party-session work, and the `/goal` that finishes
it. Everything left needs the owner's computer: Chrome signed in to Supabase,
because the Supabase connector is refused for this project. Delete this file,
and its note in `CLAUDE.md`, once the goal is met.

## Done and live

- Protocol client 1.2.0 (`lib/hub/README.md`): the hub's splash collects
  ready, games play fully with keyboard and mouse and with a DualSense, Esc or
  Options opens a game's settings over a world that keeps running, games
  ignore Options while Create is held, and `AIHub.probe()` lets the harness
  see a game's scene, menu, world clock and input. `scripts/hub-check.mjs`
  checks all of it with an emulated DualSense, in a session and on its own.
- The six session games (Blaze Cup, Arwingdings, Merry-Go-Kart 64, Brine
  Line 64, Urethane Switchyard, Grand Theft Motto III) pass hub-check on every
  line: 2, 3 and 4 players, host leaving, 1 player, and on their own.
- The splash between rounds (10-second countdown, Ready, I need more time,
  the majority hold, 20 more seconds for a game still loading) and one corner
  bar on the wall and in sessions (✕ held then confirmed, 🎲, ← to fold, and
  Create + Options for the controller). `scripts/session-browser.mjs` passes.
- The wall: session games seat 1–4 with a mode tag; no two entries show the
  same name (`docs/curation-2026-10-28.md`); the Unsure shelf is cleared;
  `pnpm test` leaves no lockfile.
- Dropped by the owner: the six extra session games. Something else is
  planned instead.

## What needs the computer

1. **Apply `supabase/migrations/0007_advisor_cleanup.sql`, then
   `0008_round_modes.sql`.** Both are committed but not applied. First check
   whether 0007 already is (the schema `private` exists). 0007 moves the
   SECURITY DEFINER bodies behind invoker wrappers with the same names and
   arguments, and takes `anon`'s grants off our seven tables. Checked on a
   local Postgres 16 with stand-ins for Supabase's auth, realtime and cron:
   0001–0007 apply in order and `rls.sql` passes. 0008 widens
   `session_rounds.mode` to any short lowercase word, so side-by-side rounds
   (`parallel`, client 1.3.0) are saved; checked on Postgres 16 against
   0002's table: a `parallel` round fails before it and saves after it.
2. **Run `supabase/tests/rls.sql`** in the SQL editor. Expect
   `RLS TESTS: ALL 39 PASSED`. Its last three checks fail until 0007 is in.
3. **Both advisors.** Before 0007 the security advisor shows ten "signed-in
   users can execute SECURITY DEFINER function" warnings, and seven "public
   can see object in GraphQL schema" ones if pg_graphql is on; 0007 settles
   both. Seven "signed-in users can see object in GraphQL schema" warnings
   remain by design: signed-in players read their own rows under RLS.
   Clearing them means turning off the pg_graphql extension, which the hub
   does not use; that is the owner's call, not an additive migration.
4. **A live round with highlights.** After 0007 and 0008, play one round on
   production (host in Chrome, a guest in an Incognito window) and check that
   `round_results` has a row from it with non-null `stats` or `awards`.

## The goal

```text
/goal Finish docs/party-sessions-handoff.md from my computer. Done when all of these are true and shown in the transcript: (1) supabase/migrations/0007_advisor_cleanup.sql and then 0008_round_modes.sql are applied to the live ai-hub database (check first whether the schema private exists); (2) supabase/tests/rls.sql passes in the live SQL editor (RLS TESTS: ALL 39 PASSED); (3) the Supabase security and performance advisors show no warnings for objects from supabase/migrations except pg_graphql_authenticated_table_exposed on our seven tables, which the handoff explains, and any other warning is fixed by a new additive migration that is committed and applied; (4) after 0007, a live round on production (host in Chrome, a guest in an Incognito window) stores a round_results row with non-null stats or awards; (5) docs/party-sessions-handoff.md and its note in CLAUDE.md are deleted, pnpm test passes, everything is pushed to main, production is Ready (a paused deployment counts, per CLAUDE.md), and no branches, stashes or open PRs remain. You have my permission to run SQL in the ai-hub project (ref ncbiljxbxfrotlszdghi) through the Supabase SQL editor in Chrome for these checks and migrations, additive only: no dropped tables, no deleted user data. Never touch m3a-intake or bmbptv-records.
```
