# Party sessions: handoff (2026-10-28)

Where the AI Hub party-session work stands, and the `/goal` that finishes it.
Delete this file, and its note in `CLAUDE.md`, once the goal is met.

## Done and live

- Six games play in sessions for 1–4 players: Blaze Cup, Arwingdings,
  Merry-Go-Kart 64, Brine Line 64, Urethane Switchyard and Grand Theft Motto
  III (the whole campaign, co-op).
- The protocol spec (`lib/hub/README.md`), formats, awards, the results and
  next-up reveal, Relay only, and the stale-session job.
- Migrations 0001–0006 are applied to the live database (0005 and 0006 on
  2026-10-28: the hourly `ai-hub-end-stale-sessions` job, and `stats` and
  `awards` on `round_results`).
- During a round, the session's line and the host's buttons sit in the game's
  corner bar (`1c9d0119`).

## Before starting

- Leave the computer on, with Chrome open and signed in to Supabase. The
  Supabase connector refuses even reads at the moment, so the database steps
  run in the SQL editor in Chrome. Reconnecting the connector gives a second
  way in.
- Expect a long run: the six new games are most of the work.

## Calls already made

- **Unsure shelf:** keep all 61 entries, clear the flag, and number repeated
  names automatically. Game files are not edited.
- **Controls:** keyboard and mouse plus a PS5 DualSense. Touch is optional.
- **Corner bar:** only the host's ✕ ends Random Mode for everyone; a guest's ✕
  leaves the session. 🎲 and End round are host-only in a session.
- **Controller combo for the bar:** hold Create + Options for 1 second.
- **"Majority" on the splash:** more than half of the seated players. Pressing
  "I need more time" again, or Ready, takes the vote back.
- **Session deck:** six more games, picked for variety.

## The goal

Paste it as one line:

```text
/goal Finish the AI Hub party-session work in docs/party-sessions-handoff.md. Done when all of these are true and shown in the transcript: (1) Controls: every session game plays fully with keyboard and mouse and with a PS5 DualSense controller (the browser's standard gamepad mapping), in and out of a session: menus, settings and play. Touch is optional, not required. scripts/hub-check.mjs gains a gamepad check (an emulated standard gamepad) that every session game passes, and lib/hub/README.md states the rule. (2) Settings in a session: each game's settings or pause menu opens as normal (Esc, or Options on the controller) over the running game, and the game keeps running underneath for everyone; hub-check verifies the world keeps moving while the menu is open. (3) Pre-round splash: after the results, every player sees the next game's splash (name, how to win, controls) with a 10-second countdown that starts the round by itself; the games' own "press any key when ready" prompts go away in session mode. Two buttons, both also on the controller (Cross = Ready, Triangle = I need more time). "I need more time" adds 10 seconds, tells the others "A player needs more time" without saying who, and marks that player; while more than half the seated players are marked, the countdown holds indefinitely ("Paused: most players need more time") and resumes once fewer than half are; pressing the button again, or Ready, clears the mark. When every seated player has pressed Ready the round starts at once. A game still loading when the countdown ends gets up to 20 more seconds, then that player sits the round out. The protocol spec, client and hub-check are updated to match, and older games still work. (4) One corner bar, on the wall and in sessions: ✕ at the far left, ← at the far right, 🎲 between them; no game name in the bar. ✕ needs a press and hold (its ring fills), then a confirm pop-up: on the wall it closes the game; in a session the host's ✕ ends Random Mode for everyone and takes them back to the lobby (seats kept, rounds so far stay recorded), and a guest's ✕ leaves the session. ← folds the bar down to just the ← (tap again to unfold, hold to hide it until reload, as today). 🎲 rolls another game on the wall; in a session it skips to the next game (host only). The round count, waiting notes and the host's End round stay. On a controller, holding Create + Options together for 1 second opens the bar to the controller (D-pad moves, Cross presses, Circle leaves); the README tells games to ignore Options while Create is held. (5) More games: six more library games declare hub:session for 1-4 players, picked for variety (at least four genres, not mostly racers or shooters), with real shared-world multiplayer per the protocol; each passes hub-check at 2, 3 and 4 players plus host-leave and the gamepad and settings checks, ends a 1-player round validly, and still plays normally outside a session; a Party session deals 8 different games. (6) Wall: every hub:session game's data/overrides.json entry has players "1–4" and a versus, co-op or race tag, so Multiplayer > 4 players finds all twelve; a test in pnpm test enforces it. (7) Unsure shelf and names: the 61 Unsure entries are kept as separate runs, the unsure flag is cleared, and each sits on its normal shelf with its genre and type; no game file is edited. Wall-wide, no two entries show the same name: when names collide (208 names are shared by 571 entries today) the wall numbers them automatically, the oldest keeping the plain name and later ones getting "(2)", "(3)" in the order added, so future duplicates need no manual work; search still finds each by its plain name; a test in pnpm test enforces unique display names; README and the curation doc record the rule. (8) Database: supabase/tests/rls.sql passes in the live ai-hub SQL editor; a live round on production stores non-null stats or awards in round_results; the Supabase security and performance advisors show no warnings for objects from supabase/migrations, or each is fixed by a new additive migration that is committed and applied. You have my permission to run SQL in the ai-hub project (ref ncbiljxbxfrotlszdghi) through the Supabase SQL editor in Chrome for these checks and migrations, additive only: no dropped tables, no deleted user data. Never touch m3a-intake or bmbptv-records. (9) pnpm test no longer leaves a pnpm-lock.yaml behind. (10) Ship: docs/party-sessions-handoff.md and its note in CLAUDE.md are deleted, pnpm test passes, everything is committed and pushed to main, production is Ready (a paused deployment counts, per CLAUDE.md), no branches, stashes or open PRs remain, and the last message gives me a hands-on test for tonight: one link and 3-4 steps, on my desktop with the PS5 controller plus a second player in an Incognito window.
```
