# Handoff: what is left for you

Written on 2026-11-05, after Vercel was removed and the hub was audited.
Everything else from that work is done and live, the Supabase changes
included. What is left deletes things for good, so it is yours alone: an
agent leaves this file as it is. Delete the file once you have decided.

## Vercel, when you are sure (optional)

The Vercel project `crosato-arcade` is paused, and on 2026-11-05 it was
disconnected from this repository, so no push builds there. Nothing depends on
it any more: the repository, Supabase's sign-in addresses and the `turn`
function name only the Cloudflare site and local dev. Deleting the project in
the Vercel dashboard retires `crosato-arcade.vercel.app` and
`ai-hub-five-mu.vercel.app` for good.

GitHub still shows Vercel's two deployment environments, Production and
Preview, with their old deployments, on the repository page. Delete them under
the repository's Settings → Environments if you want them gone; they are
history, so they were left for you.
