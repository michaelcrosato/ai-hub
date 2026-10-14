# Five requested GitHub game imports

Imported the current default-branch browser builds from all five requested
repositories. The hub catalogue grows from 612 to 617 entries.

| Repository | Playable game | Destination | Files |
| --- | --- | --- | --- |
| [rdr2-gpt6a](https://github.com/michaelcrosato/rdr2-gpt6a) | Dust & Mercy — Cinder Valley | `games/rdr2-gpt6a/index.html` | 13 |
| [policegame-2](https://github.com/michaelcrosato/policegame-2) | Last Light — Harbor Patrol | `games/policegame-2/index.html` | 56 |
| [policegame](https://github.com/michaelcrosato/policegame) | Last Watch — Pier 17 | `games/policegame/index.html` | 63 |
| [agent-engine](https://github.com/michaelcrosato/agent-engine) | Rift Runner | `games/agent-engine/index.html` | 7 |
| [90spcrpg](https://github.com/michaelcrosato/90spcrpg) | The Hollow Bell — Ashwick | `games/90spcrpg/index.html` | 8 |

Exact source commits, original commit dates, build commands, metadata evidence,
excluded files and validation results are recorded in
`2026-10-13-github-five-audit.json`. Remote heads were rechecked after preparation
and matched all five pinned commits. The import registry fingerprints every
runtime file, not only the entry HTML. An immediate rerun reports five unchanged,
zero imports. Previous added-date values and existing game files are preserved.

These are distinct campaigns from similarly named installed entries: Cinder
Valley follows Elias Reed and Flint; Pier 17 is a separate case from The Rain
Ledger; Ashwick is separate from The Drowned Oath and After Hours. Identity
records include source content evidence rather than title/engine-name matching.
Harbor Patrol includes both main cases and all six playable scenarios. Pier 17
includes its additional cases and the player-linked Designer documentation.
Rift Runner includes its original engine gallery at `index.html?launcher=1`.

Packaging uses the repositories' supported static builds. Rift Runner's Vite
build uses `--base=./` for nested hosting. Other retained runtime files match
source bytes. Only unused release documentation/build metadata is excluded;
licenses and linked player documentation remain. Native save keys, game content,
and engine versions are unchanged. No source archives, credentials, package
install trees, or database exports are included. No gameplay backend or external
CDN fetch is required. The optional Agent Engine editor source-writeback action
requires its Vite development server; static gameplay/gallery work independently.

Verification:

- Hub build succeeds with all five visible Game entries; all 197 hub tests pass.
- Source checks: 60 Western tests, 50 Harbor Patrol tests, 138 Pier 17 tests,
  65 Agent Engine tests, and 139 Ashwick release/unit checks pass. Supported
  production builds and content validation pass where supplied.
- Source browser checks cover Western movement/map/save/reload; both Harbor
  campaigns/scenarios' content validation; Pier 17's complete 100/100 case,
  autosave/reload and three layouts; Rift Runner's movement, gear, 24 skills,
  expedition and gallery; and 16 Ashwick desktop/portrait checks.
- Installed hub-player checks start all five games without page errors or failed
  HTTP responses. Movement is verified in Western, Harbor Patrol and Rift Runner;
  Rift Runner deploys an expedition. Ashwick begins its play scene. Pier 17's own
  initial focus-loss pause is resumed through its visible control, then the watch
  starts and its notebook opens. Its full case flow passed in source-browser QA.
- Every installed bundle matches its registry hash. Screenshots were inspected;
  local QA artifacts are ignored under `.cache/github-imports/`.

Browser coverage here uses installed Chrome/Chromium. WebKit from an available
Playwright distribution could not launch because that distribution lacks host
libraries; no WebKit pass is claimed for this import.
