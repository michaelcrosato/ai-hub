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
the repository refers to Vercel any more. Deleting the project in the Vercel
dashboard retires `crosato-arcade.vercel.app` and `ai-hub-five-mu.vercel.app`
for good.

## Left as they are, for you to decide

- **Ashlar Wake** (a Grok roundup game) renders and plays on a real GPU, but
  while walking its engine sometimes stops on `PHYSICS_BAD_ARGUMENT:
  stepCharacter(body) got 16`. It is a 6.8 MB minified bundle; the fix belongs
  in its source. It carries `"status": "Needs a fix"` in `data/overrides.json`.
- **Sessions.** Checking the docs against the code turned up limits worth
  fixing, among them that the database's host never follows a host handover,
  so a new host can neither remove a player nor end the session. They are in
  `docs/session-hub.md`, *Known limits*. Fixing that one needs a migration,
  which is the Supabase dashboard again.
