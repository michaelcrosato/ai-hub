# Handoff: accounts and sessions across devices

Status on 27 October 2026. **Delete this file and the "Work in progress"
note in CLAUDE.md once the checklist below is done and the branch is merged.**

## Where things stand

The AI Hub session feature has four phases. Phases 1 and 2 are on `main` and live:

- **Phase 1** — the game-facing protocol. `lib/hub/README.md` is the spec handed
  to game-making agents, served at
  <https://crosato-arcade.vercel.app/lib/hub/README.md>, with the client, the
  harness and two example games. `scripts/hub-check.mjs` checks a game against it.
- **Phase 2** — `/session` between tabs of one browser (`?transport=local`):
  Random Mode, scoring and the results card. `scripts/session-browser.mjs`
  plays a whole session.

Phases 3 and 4 are written and tested, but **only on the branch
`claude/epic-hamilton-rj3kpf`**, commit `4d2f7c5c`. Don't merge the branch
until the database and dashboards below are set up: before then, the "Sign in"
button it adds to every view would fail.

- **Phase 3, accounts.** Google sign-in (PKCE, returning through `/auth/`) and
  anonymous guest accounts. Also:
  - the `/privacy/` page;
  - an account button and a "Play with friends" link in all six views
    (`assets/js/account/`);
  - 👍/👎 in the three details views and after a solo game;
  - play-time tracking in `createPlayer`, with cloud totals merged into the
    store in memory only.

  The hub keeps working when Supabase is unreachable. supabase-js 2.117.3 is
  vendored in `assets/vendor/supabase-js/`, and a test checks its sha256
  against the npm release.
- **Phase 4, sessions across devices** (`assets/js/session/net.js`, `mesh.js`,
  `clock.js`, and online mode in `app.js`):
  - Supabase Realtime carries presence, round control and WebRTC signalling;
    game traffic goes peer to peer over a WebRTC mesh; every player follows
    the host's clock.
  - The host signs in with Google and shares `/session#<code>`. Friends join
    as anonymous guests with generated nicknames.
  - The host can remove a player, and rounds are saved to the database.
  - `supabase/functions/turn/` mints Cloudflare TURN credentials.

Tests on the branch:
- `pnpm test`: 292 pass.
- `node scripts/hub-check.mjs`: passes.
- `node scripts/session-browser.mjs`: passes, including a round between two
  browser contexts over real WebRTC (`?transport=relay`, a relay the test runs
  itself).

## Decisions already made (by Michael)

- **Backend:** Supabase on the **free** plan. A free project pauses after
  about 7 days without use; resume it from the dashboard.
- **Joining:** only the host signs in with Google. Friends join from the
  invite link as guests. Guests can't vote, and their stats stay with that
  session.
- **Names:** generated nicknames only (`assets/js/session/names.js`). No real
  names, photos or free text anywhere, and no chat of any kind.
- **Game traffic:** peer to peer (WebRTC). Sending it through Supabase
  Broadcast would exceed the free tier's 100 messages a second with a single
  4-player session. The fallback is a TURN relay. If even that fails, the
  player sits out.

## Supabase

- Project **`ai-hub`**, ref `ncbiljxbxfrotlszdghi`, region us-east-1, URL
  `https://ncbiljxbxfrotlszdghi.supabase.co`. The publishable key is in
  `assets/js/account/config.js`; it is public by design.
- The org also holds `m3a-intake` and `bmbptv-records`. Those belong to other
  apps: leave them alone.
- **Already done:** the project exists, and the `turn` Edge Function is
  deployed (verify_jwt on). It answers STUN only until the Cloudflare secrets
  are set; it was checked to return 401 without a token.
- **Done 27 Oct, evening.** Migrations 0001 and 0002 were run in the SQL
  editor through Claude in Chrome: all seven tables exist with RLS on, and
  every function answers. MCP `apply_migration` and `execute_sql` can't be
  used from a cloud session: their confirmation prompt never reaches Michael,
  so database changes go through the SQL editor.
- **Advisors.**
  - Security: only "signed-in users can execute SECURITY DEFINER function",
    on the ten RPCs. That is intended, since every write goes through them
    and each checks the caller.
  - Performance: two uncovered foreign keys, fixed by `0003_indexes.sql`,
    which still needs running in the SQL editor.
- **Still to confirm:** `supabase/tests/rls.sql` run in the SQL editor
  (expected result: "RLS TESTS: ALL … PASSED"); Google and anonymous sign-in
  on; the TURN secrets set.
- **How to check from anywhere:** `GET /auth/v1/settings` with the
  publishable key shows `external.google` and `external.anonymous_users`.
  `POST /functions/v1/turn` with the legacy anon JWT shows `"relay": true`
  once the Cloudflare secrets are in.

## Checklist to finish

Michael, in a browser:

1. **Migrations.** In the SQL editor
   (<https://supabase.com/dashboard/project/ncbiljxbxfrotlszdghi/sql/new>), run
   `supabase/migrations/0001_accounts.sql`, then `0002_sessions.sql`, both
   taken from the branch.
2. **Google Cloud** → APIs & Services:
   - OAuth consent screen: External, app name "AI Hub", authorized domain
     `crosato-arcade.vercel.app`, privacy URL
     `https://crosato-arcade.vercel.app/privacy/`. Then **publish** it.
   - Credentials → OAuth client ID → Web application, with redirect URI
     `https://ncbiljxbxfrotlszdghi.supabase.co/auth/v1/callback`.
3. **Supabase dashboard:**
   - Authentication → Sign In / Providers: turn on Google (with the client id
     and secret) and **anonymous sign-ins**.
   - Authentication → URL Configuration:
     - Site URL: `https://crosato-arcade.vercel.app`
     - Redirect URLs: `https://crosato-arcade.vercel.app/auth/`,
       `http://localhost:4173/auth/`, `http://127.0.0.1:4173/auth/`
   - Realtime → Settings: **turn off** "Allow public access".
4. **Cloudflare** → Realtime → TURN Server: create a key. Its two values become
   the Edge Function secrets `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN`. Set them
   with the MCP `create_edge_function_secret`, which prompts for the value, or
   in the dashboard.

The agent, after that:

5. Check that the tables, functions and the `pg_cron` guest-cleanup job exist.
   Run `get_advisors` for both `security` and `performance`, and fix anything
   it reports in a new migration file.
6. **RLS tests** through `execute_sql`, each inside `begin; … rollback;`:
   - Insert test users into `auth.users`.
   - Act as each one with `set local role authenticated` and
     `set local request.jwt.claims = '{"sub":"…","role":"authenticated","is_anonymous":…}'`.
   - Prove each of these:
     - a user reads and writes only their own profile, votes and plays;
     - a guest can't vote or call `track_play`;
     - `track_play` caps active time at the time that really passed;
     - only seated members read a session's rows and may use its Realtime
       topic;
     - a removed player can't rejoin;
     - only the host can remove a player;
     - `record_round` writes once per round;
     - `create_session` refuses guests.
7. Add sections to `README.md` on signing in, feedback, play time and
   cross-device sessions (`/session#<code>`, guests, removing a player,
   `/privacy`).
8. Merge the branch into `main` (it was cut from `662b3bdb`), run `pnpm test`,
   push, and confirm Vercel's commit status reads "Deployment has completed"
   (or say it was paused). Delete the branch locally and on GitHub, then
   delete this file and the CLAUDE.md note.

Michael, by hand, at the end:

9. Sign in with Google on the live site, and give a game a 👍.
10. Host a session and join it from a second device, one a phone on mobile data.
    Check that a round plays and appears in `session_rounds`.

## Known trade-offs

- **Same-origin games.** Every game runs on the hub's own origin, so a game
  could read the signed-in user's Supabase token. RLS limits the damage to
  that user's own votes, plays and sessions. Google's tokens are not kept.
  The real fix is serving games from a separate custom domain (not a second
  `*.vercel.app`).
- **IP addresses.** Peer-to-peer play shows players' IP addresses to each
  other; `/privacy/` says so. Setting `localStorage['ai-hub:relay-only']` to
  `'1'` forces relay-only connections. There is no button for it yet.
- **Library.** No game in the library declares `hub:session` yet, so Random
  Mode only has the two examples (`?examples=1`) until trial games arrive.
