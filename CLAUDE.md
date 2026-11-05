# Working in this repo

## Finish every change on main

- When a `/goal` is complete, or a prompt has changed the repo, commit and
  push to `origin/main` right away.
- Pushing to main deploys the site to Cloudflare Workers
  (https://crosato-arcade.michael-crosato.workers.dev). Workers Builds runs
  `node scripts/release.mjs` on every push to main, about five minutes, and
  its result shows as the check `Workers Builds: crosato-arcade` on the
  commit (`gh api repos/michaelcrosato/ai-hub/commits/main/check-runs`). If
  that check fails, fix it or roll back the commit. To deploy from this
  machine instead: `pnpm release` (`npx wrangler login` first).
- Work locally with `pnpm dev`, then http://127.0.0.1:7417.
- Work on `main`. If a branch is ever needed, merge it into main and delete
  it (locally and on GitHub) in the same session. Never leave a local
  branch, an unpushed commit, a stash, or an open PR behind.
- Before starting work, run `git fetch --prune` and look at
  `gh pr list`. Anything open gets resolved first, and so does
  `HANDOFF.md` when there is one: it lists steps left for later.

## Pull requests from others

Decide each one; do not let it sit. Accept it (merge to main, delete the
branch), reject it (close it with a one-line reason), or replace it (close
it, and land a better version on main that says which PR it replaces).

## Keep it simple and clean

- No dependencies, no build step, no generated files committed
  (`data/games.json` is gitignored and rebuilt by `scripts/scan.mjs`).
- Run `pnpm test` (or `node --test "scripts/**/*.test.mjs"`) before
  committing code.
- Delete what is no longer used instead of leaving it around. A game that
  should not be on the wall is deleted, not hidden; git history keeps it.
- Improve the hub, not the games. Change a game file only when a hub change
  needs it (the pasted session client, a link back to the hub). Note a
  broken game in its `data/overrides.json` entry instead, and
  `node scripts/hub-check.mjs <game> --record` keeps one that breaks the
  session protocol out of sessions.
- The repository is public: never commit keys, tokens or personal data.

## Outside the repository

Supabase (project `ai-hub`, ref `ncbiljxbxfrotlszdghi`) is changed from its
dashboard: migrations in the SQL editor, the `turn` function in the Edge
Functions editor, sign-in addresses under Authentication → URL
Configuration. Keep `supabase/` the same as what is deployed: a change to
`supabase/functions/turn/index.ts` is deployed from the dashboard in the
same session.

## When something goes wrong

Roll back rather than leave half-finished work. Revert the commit
(`git revert`) or restore the last good state and push that, so main is
always a working wall. Say what was rolled back and why.
