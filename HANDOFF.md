# Handoff: what is left for you

Written on 2026-11-05, after Vercel was removed and the hub was audited.
Everything else from that work is done and live. The two Supabase steps below
were blocked for the agent by the session's permission check on saving and
deploying from the Supabase dashboard, so they need you. Delete this file
once they are done.

## 1. Supabase sign-in addresses

Supabase project `ai-hub` (ref `ncbiljxbxfrotlszdghi`) → Authentication →
URL Configuration:
<https://supabase.com/dashboard/project/ncbiljxbxfrotlszdghi/auth/url-configuration>

- **Site URL**: change `https://crosato-arcade.vercel.app` to
  `https://crosato-arcade.michael-crosato.workers.dev`. Supabase sends a
  sign-in there when its return address is not on the list below, and the
  Vercel address is paused.
- **Redirect URLs**:
  - remove `https://crosato-arcade.vercel.app/auth/`;
  - replace `http://localhost:4173/auth/` and `http://127.0.0.1:4173/auth/`
    with `http://localhost:7417/auth/` and `http://127.0.0.1:7417/auth/`
    (the dev server moved to port 7417, so Google sign-in on `pnpm dev`
    cannot come back today);
  - keep `https://crosato-arcade.michael-crosato.workers.dev/auth/`.

## 2. Deploy the `turn` function

Supabase → Edge Functions → `turn` → Code: replace the code with
`supabase/functions/turn/index.ts` from `main`, and deploy. It answers the
live site and local dev only. The deployed copy also answers the old Vercel
address; nothing is broken in the meantime.

## 3. Vercel, when you are sure (optional)

The Vercel project `crosato-arcade` is paused, and on 2026-11-05 it was
disconnected from this repository, so no push builds there, and nothing in
the repository refers to Vercel any more (the repository's website link now
points at the Cloudflare site). Deleting the project in the Vercel dashboard
retires `crosato-arcade.vercel.app` and `ai-hub-five-mu.vercel.app` for good.

GitHub still shows Vercel's two deployment environments, Production and
Preview, with their old deployments, on the repository page. Delete them under
the repository's Settings → Environments if you want them gone; they are
history, so they were left for you.

## Left as they are, for you to decide

- **Session games to check on a GPU.** A `hub-check` sweep of every session
  game ran on this machine, which has no GPU (software rendering, under
  load). Failures that hold anywhere are recorded (28 games kept out). These
  still failed when checked on their own, but only in ways slow rendering can
  cause, so they were left in the deal; run `node scripts/hub-check.mjs
  <game> --record` on a machine with a GPU to settle them: drive-stillwake,
  drive-lumenwake-1, Street Fighter Axiom, Street Thunder Alpha, Clockwork
  Fright, The Last High Mage, Waddle Trouble, Synthpunk 2084, MopeyDick,
  Waku Waku Lucky and Lands of Yore.
- **Sessions.** Checking the docs against the code turned up limits worth
  fixing, among them that the database's host never follows a host handover:
  the page hosts from the lowest seat, but `game_sessions.host_id` moves only
  when the host calls `leave_session`, which closing a tab never does, so a new
  host can neither remove a player nor end the session. The page cannot hand
  over for someone who is gone; it needs a database function (a seated player
  claiming the host when the recorded one has left), so a migration in the
  Supabase dashboard. The rest are in `docs/session-hub.md`, *Known limits*.
