# Handoff: accounts and sessions across devices

Status on 27 October 2026, late. **Delete this file and the "Work in progress"
note in CLAUDE.md once the two items under "Still to do" are done.**

Phases 3 (accounts) and 4 (sessions across devices) are merged into `main`
and live. The README covers how they work; this file only holds what is left.

## Done

- **Database.** Migrations 0001–0004 are applied to the Supabase project
  `ai-hub` (ref `ncbiljxbxfrotlszdghi`). `supabase/tests/rls.sql` reports
  "RLS TESTS: ALL 33 PASSED". Its first run found that every
  `join_session` call failed ("column reference session_id is ambiguous");
  0004 fixes that.
- **Advisors.** Performance: none. Security: twenty warnings, all expected:
  - ten "signed-in users can execute SECURITY DEFINER function" on the RPCs
    (every write goes through one, and each checks the caller);
  - ten "anonymous sign-ins allowed" on the tables. Guests are meant to exist;
    `rls.sql` shows they cannot vote, record plays, host or read other rows.
- **Supabase dashboard.** Google and anonymous sign-ins are on. The Site URL
  is `https://crosato-arcade.vercel.app`, and the redirect URLs are its
  `/auth/` plus `localhost:4173` and `127.0.0.1:4173`. Realtime allows
  private channels only.
- **Google Cloud.** The project "AI Hub" (`ai-hub-513002`) has its consent
  screen published to production and holds the web OAuth client
  "AI Hub (Supabase)". The client's secret is stored only in Supabase.
- **Live checks.**
  - A guest signs in and gets the right refusals (`join_session` with a bad
    code, `create_session`, a vote).
  - `/auth/v1/authorize?provider=google` redirects to Google with the client.
  - `pnpm test` passes 292, and `hub-check.mjs` and `session-browser.mjs`
    both pass.

## Still to do

1. **Cloudflare TURN.** Sign in at <https://dash.cloudflare.com> →
   Realtime → TURN Server, and create a key. Its two values become the
   Supabase Edge Function secrets `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN`
   (Supabase → Edge Functions → Secrets). Until then `turn` answers STUN
   only, so players behind strict NATs (often phones on mobile data) can't
   connect. Check: `POST /functions/v1/turn` with a signed-in token returns
   `"relay": true`.
2. **Michael, by hand.**
   - Sign in with Google on the live site, and give a game a 👍.
   - Host a session and join it from a second device, a phone on mobile
     data, then check that a round plays and appears in `session_rounds`.

## Known trade-offs

- **Same-origin games.** Every game runs on the hub's own origin, so a game
  could read the signed-in user's Supabase token. RLS limits the damage to
  that user's own votes, plays and sessions, and Google's tokens are not
  kept. The real fix is serving games from a separate custom domain (not a
  second `*.vercel.app`).
- **IP addresses.** Peer-to-peer play shows players' IP addresses to each
  other; `/privacy/` says so. Setting `localStorage['ai-hub:relay-only']` to
  `'1'` forces relay-only connections. There is no button for it yet.
- **Library.** No game in the library declares `hub:session` yet, so Random
  Mode only has the two examples (`?examples=1`) until trial games arrive.
- **Free plan.** The Supabase project pauses after about 7 days without use;
  resume it from the dashboard. While it is paused, sign-in hides and
  everything else works.
- **Database changes** go through the SQL editor. The Supabase MCP connector
  in these sessions has no permission on this project.
