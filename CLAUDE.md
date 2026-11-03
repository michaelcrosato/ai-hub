# Working in this repo

## Finish every change on main

- When a `/goal` is complete, or a prompt has changed the repo, commit and
  push to `origin/main` right away.
- Pushing does not deploy. Vercel usage costs too much to build every
  change, so Git deploys are off (`"git": { "deploymentEnabled": false }`
  in `vercel.json`) and the site runs locally: `pnpm dev`, then
  http://127.0.0.1:7417. Deploy to Vercel only when Michael explicitly asks,
  for a major update: push with `deploymentEnabled` set to `true` (that push
  deploys; check it reaches READY), then set it back to `false` in the next
  commit, which does not deploy.
- Work on `main`. If a branch is ever needed, merge it into main and delete
  it (locally and on GitHub) in the same session. Never leave a local
  branch, an unpushed commit, a stash, or an open PR behind.
- Before starting work, run `git fetch --prune` and look at
  `gh pr list`. Anything open gets resolved first.

## Pull requests from others

Decide each one; do not let it sit. Accept it (merge to main, delete the
branch), reject it (close it with a one-line reason), or replace it (close
it, and land a better version on main that says which PR it replaces).

## Keep it simple and clean

- No dependencies, no build step, no generated files committed
  (`data/games.json` is gitignored and rebuilt by `scripts/scan.mjs`).
- Run `pnpm test` (or `node --test "scripts/**/*.test.mjs"`) before
  committing code.
- Delete what is no longer used instead of leaving it around.

## When something goes wrong

Roll back rather than leave half-finished work. Revert the commit
(`git revert`) or restore the last good state and push that, so main is
always a working wall. Say what was rolled back and why.
