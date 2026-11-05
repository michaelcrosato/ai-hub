# Library history

The wall opened on 2026-09-17 with four games. On 2026-11-05 it holds 2,190
entries. This page lists the batches that built the library and the curation
rules behind them. The raw records of each batch were removed on 2026-11-05;
[the last section](#the-raw-records) says how to read them from git history.

Counts are catalogue entries, as each record gave them. Until 2026-11-05 a few
broken or superseded games sat in `games/` with a `hidden` flag, outside the
catalogue.

## Batches

| Date | Where the games came from | Added | Total | Notes |
|---|---|---:|---:|---|
| 2026-09-24 | A Google Drive folder of 396 files (371 HTML, 25 zips) | 245 | 245 | 387 files fetched and grouped into 246 lineages; 141 older iterations dropped. Nine files the connector could not transfer were left out (see [Left out on purpose](#left-out-on-purpose)). Two source packages went to `sources/`, deleted on 2026-11-05. |
| 2026-09-28 | A local `GPT-games` folder: 336 pages and 4 source zips, already named by source | 98 | 342 | Every game renamed by source, so favourites saved under an old slug were lost. One wall game gave way to its newer build; 7 files left out. Six pages that broke on load were kept hidden: Starlight Drifter was fixed the same day, the other five were deleted on 2026-11-05. The zips (two Unreal projects, a CLI, a copy of the Strata kit source) went to `sources/`. |
| 2026-09-28 | The desktop folder `New AI Stuff`: 40 pages | 22 | 365 | 15 copies or older builds left out. The Lion's Oath updated in place; Starlight Drifter shown. Mega Man II Titanium Circuit, which drops the player through the floor, was kept hidden and deleted on 2026-11-05. Ripped music removed from one game (see *The wall is public* below). |
| 2026-10-03 to 10-12 | Added by hand | 9 | 374 | BLASTLINE BC64, HOLLOWFLUX, 2D Lab, Little Ritual, four Ash games and Capital Strike. |
| 2026-10-13 | A Google Drive backup: 166 HTML files and 71 Site archives | 130 | 504 | The other 107 were older builds of games the hub had already improved, copies, archives of pages already taken, or tools and reports. Site games were built as static clients without their server or sign-in code. Loaders repaired in Petals of Steel, Rink Ruckus and Superkick Riot; The Ashen Compact rebuilt from its archive. |
| 2026-10-13 | The rest of that backup | 7 | 511 | Six pages first set aside as tools turned out to be games. Windward — Flight School repaired: its export had pasted a 35,795-byte copy of its own page into a regular expression. The unrepaired original went to `sources/`, deleted on 2026-11-05. |
| 2026-10-13 | ChatGPT Library files saved 9–13 Oct (11 files) | 9 | 520 | Cinderwing was already on the wall. Living Details was first excluded as a preview and came in with the next batch. 22 published Sites could not be fetched. |
| 2026-10-13 | 38 GitHub repositories, default branches | 23 | 542 | 21 games and labs, a newer TIDELINE build and Living Details. The older Drive TIDELINE surface build was hidden for its successor and deleted on 2026-11-05. Native and server-backed projects and two without a working static build left out; six with no proven newer lineage kept their installed builds. |
| 2026-10-13 | Grok exports in a Google Drive folder, 519 files (records named 2026-10-14) | 67 | 609 | 393 server-backed projects left out until they have static exports. Fonts and images embedded in the pages were moved into files, saving 16.8 MB with no lossy change. |
| 2026-10-13 | Three published ChatGPT Sites | 3 | 612 | Morrowglass: The Lantern Roads v5, Cinder Choir and Threads of the Last Dawn, each from its built `dist/` folder. |
| 2026-10-13 | Five GitHub repositories | 5 | 617 | `rdr2-gpt6a`, `policegame-2`, `policegame`, `agent-engine` and `90spcrpg`, from their static builds, with licences and player documentation. |
| 2026-10-14 | The desktop folder `New AI Stuff`, one game per change | 16 | 633 | Four Meltdown Mile and Meltdown Express attempts, Demolition Duty, Citrus Rush and KRIEG (built from source with sign-in removed), The False Dawn (an SVG fix), Wreck Route and others. |
| 2026-10-14 | Two GitHub repositories | 2 | 635 | Vesper Lane and Ochre Veil. Cinder Valley (`rdr2-gpt6a`) was updated in place the same day. |
| 2026-10-15 | A Google Drive folder of 39 pages by Grok 4.7 Build | 37 | 672 | Bean Napped and Cloverhollow updated in place. Astral Crest's boot repaired. Five games were marked `Needs WebGPU review` and Meridian — Semantic World Compiler `Needs visual review` until a real GPU showed them rendering on 2026-11-05; Ashlar Wake is marked for a physics error while walking instead. |
| 2026-10-15 | The desktop folder `New AI Stuff`, second pass | 18 | 690 | Three more files were already on the wall. |
| 2026-10-16 | Added by hand | 11 | 701 | Ten games in one change (Dented Destiny to FROSTLINE) and the Grand Theft Five-Finger Drive vertical slice. |
| 2026-10-19 | Root HTML pages of `cc-hub`, `gemini-hub`, `gpt-hub`, `grok-hub` and `muse-hub` | 172 | 873 | 170 games and 2 tools, the first entries with title-first filenames. Four same-title variants went to the Unsure shelf. IgniteBike 64, Myth of Zela and WreckWarrior 3050 threw errors during the screenshot pass; all three were repaired on 2026-11-05. |
| 2026-10-21 | gpt-matrix: one Star Fox 64 prompt, GPT-6.1 Sol and GPT-6 Astra at six effort levels | 639 | 1,512 | 669 runs; 30 left no page. 34 went to the Unsure shelf. StarHop 64 and MeteorFox 64 stopped at load (no `THREE` global) and came in unmodified; both were repaired on 2026-11-05, with eleven more from this batch. |
| 2026-10-22 | `cc-hub` and `gpt-hub` pages not yet on the wall | 80 | 1,592 | 126 candidates: 45 were already on the wall and one was a copy from a build folder. |
| 2026-10-27 | gpt-matrix runs of 24–27 Oct, about 40 classics | 239 | 1,831 | 259 runs; 20 left no page. 22 went to the Unsure shelf. |
| 2026-10-29 | cc-matrix: a GPT-6 matrix (3 models, 3 efforts, 10 sources) and earlier Star Fox 64 and Mario Kart 64 runs | 103 | 1,934 | 102 of 115 runs; 13 failed or delivered nothing. Wands of Lore was added by hand that morning. BumbleBlock Cabaret threw on Play until 2026-11-05. |
| 2026-10-30 | cc-matrix: 20 sources (Alien Soldier to Waku Waku 7) across Claude, Gemini, GPT and Muse models, and 11 Rocket League runs | 226 | 2,160 | 316 runs; 90 skipped: failed builds, 26 already on the wall, and Talons & Seeds Primeval, which never starts. Strange Soldier and Amber Wrath hit a WebGPU error in their attract demo; on a real GPU on 2026-11-05 both ran it cleanly. |
| 2026-11-01 | cc-matrix: Cyberpunk 2077 and Zelda: Breath of the Wild riffs on the my-3D2dge engine | 6 | 2,166 | 406 of 412 runs were already on the wall or decided. Moth of the Wild threw about 50 s into play at import; 80 s of play on 2026-11-05 showed no error. Cybershrunk 2077 loads Rapier from jsDelivr. |
| 2026-11-02 | cc-matrix: riffs on 14 books, films and TV shows (Moby-Dick to The Office) | 24 | 2,190 | 12 interrupted runs left out. The importer's three.js shelf scopes were fixed in the same change. |

## Other passes over the library

- **2026-09-28 to 10-02.** About 260 of the early games moved onto the shared
  3D stack in `lib/` (three.js r186, Rapier 0.20 and the kit), about 100 of
  them with a new level, mode or route.
- **2026-10-14.** *Newest first* came to mean arrival on the hub, recovered
  from git history for every entry; source dates moved to
  `data/source-dates.json`. 108 strips were added, 23 that showed loading or
  error screens were replaced, and every entry got a genre and a shelf.
- **2026-10-19.** A quick blind pass shot strips for 183 entries, the 16 Oct
  additions and the 19 Oct intake; nobody looked at them. On 21 and 22 Oct the
  gpt-matrix strips that showed loading or boot screens were reshot.
- **2026-10-28.** 571 entries shared 208 names. The scan now numbers them, and
  the 61 entries on the Unsure shelf were kept as separate runs.
- **2026-11-05.** The seven hidden games were deleted: BLACKWELL attempt 02,
  City After Dark, Golden Hour Courtyard, KEYFORGE typing tutor, Police Quest
  City Beat 96, Mega Man II Titanium Circuit and the old TIDELINE surface
  build. So was `sources/`, which held zipped projects that never ran here.
  A browser pass over every game, and a parse of every inline script, found
  eighteen that never started, all broken since they were imported; each got
  the smallest repair that restores what its author wrote:
  - Seven Star Fox 64 runs that inline the my-3D2dge engine (Nova Foxfire,
    Nova Paws, Nova Vixen, Solar Vixen, Star Ruff 64, StarScamper, Stellar
    Vixen): the engine's own header shows `<script src=…></script>`, which
    ended the inline script early. Escaped as `<\/script>`; in Nova Paws and
    StarScamper the game's code had also been pasted twice into the engine,
    which got its clean copy back.
  - Starlit Fox 64: a licence block had been inserted inside that same header;
    it moved to the end of the page.
  - MeteorFox 64 (the `!` in front of three.js r160's wrapper was lost),
    Comet Kitsune (two apostrophes in single-quoted dialogue), Moonfox 64 (a
    function missing its closing brace) and StarHop 64 (a damaged copy of
    three.js r180, replaced by the shelf's).
  - Ripshift and Starlance imported a WebGPU renderer path three.js r180 does
    not have (now `three/webgpu`); Ripshift's menus then read a field its input
    never returns, and Starlance hung its asteroid outlines on a missing
    parent.
  - IgniteBike 64 used `div` without importing it; Myth of Zela and
    WreckWarrior 3050 loaded `three.min.js` builds that were never published
    (now r160's, from the shelf); BumbleBlock Cabaret called a Rapier method
    on a body description that only a body has.
  The six whose screenshot strips showed only their menus got new strips, and
  Wands of Lore, which had none, got one from a real GPU.
  The same day every pristine copy of the session client went to 1.4.0 (344
  games; a sample, all five hand-built game-night games among them, passed
  `hub-check`). A `hub-check` sweep of all 345 session games kept 28 out of
  sessions for failures that hold on any machine, 18 of them for opening a
  WebRTC connection of their own. Eleven more had failed only in ways slow
  software rendering can cause; checked again on a machine with a GPU, seven
  still failed and are out too (35 in all). Three games stopped asking for
  files that were never there: Smash TV's player-records config, Crownfall
  Tactics' ripped placeholder music (its manifest keeps the intended
  sources), and AFTERGLOW OVERDRIVE's font stylesheet, now inline.

## How games were told apart

README covers names on the wall, builds and versions, dates, screenshots and
the Unsure shelf. The rules below come from the curation records.

**One file per game (2026-09-24).** Files were compared on game code alone:
inline images, audio and fonts stripped, shared libraries such as three.js
ignored. Two files were one lineage when they shared most of that code
(Jaccard similarity 0.4 or more, or one holding 80% or more of the other), or
0.6 or more when their titles differed, which caught renames such as BOUNDLESS to
Void Explorer. Only the newest file of a lineage stayed, going by Drive's
upload order and the version numbers in the files. Separate prompts for the
same idea share almost no code, so they all stayed.

**Version families (2026-09-28).**

- Byte-identical files (SHA-256) are one file.
- Same title and same game code are one build. An offline bundle that inlines
  its CDN libraries adds no game text, so the lean build stays (HOT TREADS:
  115 KB on the wall, 22.8 MB bundled).
- Before comparing text, undo what bundlers change (`’` escaped as `\u2019`,
  quote style, stripped comments), or one build looks like two.
- Of two builds in one lineage, the one holding the other's content plus more
  is newer. Version strings in the files settle the rest.

**Newer builds (since 2026-10-13).** Identity comes from what a package
contains: its declared source, campaign content, save keys, code and git
ancestry. A title, a filename, an upload date or a shared engine proves
nothing on its own. A proven newer build of a project replaces it in place. It
keeps the slug, URL, added date and save keys, and the import registry keeps
the old record: Cinder Valley on 2026-10-14, Bean Napped and Cloverhollow on
2026-10-15. A build the hub has improved (moved onto the shared 3D stack,
repaired) is not replaced by a fresh copy of its original export; about 40
such copies were skipped on 2026-10-13.

**Repairs stay small.** An import fixes packaging only: a broken export, a
path, a loader, a sign-in screen a static copy cannot use. It records the
original and installed hashes and leaves gameplay and save keys alone. In the
cc-matrix batches a page that never started was left out, and one that started
but failed later came in unmodified, with the fault in its record.

**Only what runs is published.** Licence and notice files of a vendored engine
stay next to it (Babylon.js 9.28.0 in `games/drive-afterlight-arena-lab/vendor/`,
for one). A project that needs a server stays out until it has a static export.

**The wall is public.** Music ripped from a commercial game stays off it. On
2026-09-28 the eleven Blast Corps tracks in Brick Blast Brigade — Argent Towers
(Attempt 01) were replaced with half a second of silence each. The file's own
credits called them "for internal testing only" and said they "must be replaced
before any distribution". The original,
`blastcorps-brickblastbrigade-20260927-claude-opus-5-5.html` in the
`New AI Stuff` folder, must not be imported as it is.

**Model credits.** In the `New AI Stuff` folder, `CC55` means Claude Opus 5.5
unless a game's own files name another model; Michael confirmed this on
2026-10-15. The Grok roundup of 2026-10-15 is credited as Michael gave it:
model `Grok 4.7 Build`, harness Grok.

## Left out on purpose

- Nine files from the first Drive folder that the connector could not transfer
  intact. On 2026-10-28 Michael decided to leave them out for good, so they are
  not to be fetched again: `adventureforge-webgpu.html`,
  `keyforge-typing-tutor-single.html`, `vanguard-wing-milestone-0.html`,
  `vanguard-wing-milestone-0-repository.zip`, `openworld-terrain-foundation.html`,
  `open_world_threejs_framework.html`, `direct-game-loop-repo.zip`,
  `direct-game-loop-repo(1).zip` and `lean-adventure-loop.zip`.
- cc-matrix runs skipped on 2026-10-29, 2026-10-30 and 2026-11-02: failed
  builds, runs that delivered nothing or were interrupted (some left a partial
  page), and Talons & Seeds Primeval, which imports a three.js file r180 does
  not ship. Those decisions are only in the batch records; read them from git
  history before importing cc-matrix runs again.

## The raw records

The four curation notes (`docs/curation-2026-*.md`) and the 100 files of
`docs/imports/` were removed on 2026-11-05: audits, plans, import reports,
browser checks, test logs and patches. Among them are the file kept for every
game of the first curation and the iterations it replaced
(`curation-2026-09-24.md`), the map from old slugs to current ones
(`curation-2026-09-28.md`), and the patches that built Citrus Rush and KRIEG
from source and repaired The False Dawn and Astral Crest (`imports/*.patch`,
`imports/2026-10-15-astral-crest-patch.json`). Rebuilding those games from
source needs the patches again.

```sh
# the commit that removed them
git log --oneline --diff-filter=D -- docs/imports 'docs/curation-*.md'
# list the files, with that commit's hash in place of <commit>
git ls-tree --name-only '<commit>^' docs/imports/
# read one
git show '<commit>^:docs/imports/2026-10-15-roundup.md'
git show '<commit>^:docs/curation-2026-09-28.md'
```

`git log --oneline -- docs/imports 'docs/curation-*.md'` lists every commit
that touched them. `data/import-registry.json` still holds provenance and
fingerprints for the imports since 2026-10-13 (see
[the import registry](import-registry.md)).
