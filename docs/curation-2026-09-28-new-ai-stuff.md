# New AI Stuff import — 28 Sep 2026

`C:\Users\micha\OneDrive\Desktop\New AI Stuff` held 40 game pages, loose and
named however they were saved. The wall held 342 games after the GPT-games
import earlier the same day. Every file was compared with every game on the
wall, and only what the wall did not already have came in, under the library's
naming convention (`Source-Title-YYYY-MM-DD-model.html`, see the README).

**23** new games (22 on the wall, 1 hidden) · **2** wall games replaced by a newer or working build · **15** left out as duplicates or older builds

## How the two sides were matched

1. **Byte-identical** (SHA-256): 10 files, already on the wall.
2. **Same game code**: each remaining file's code lines and its prose (dialogue,
   briefings, menus) were compared with every file on the wall, with library
   code discounted. Bundled copies escape `’` as `\u2019`, quote strings
   differently and strip comments, so the prose was compared after undoing all
   three; otherwise the same build looks like a different one.
3. **Same title, one lineage**: the build that contains the other's content plus
   more is the newer one; version strings inside the files settled the rest.
4. **Everything else is a separate game**, including the two Eastern Palace
   takes, the two FFT tactics games and the two Mega Man 2 stages, whose code is
   unrelated.

The date in each new name is the one the file states, else the day it was
saved. The model is the one the file credits, else `model-unknown`.

## Left out

| File | Why |
|---|---|
| `Ashbound-1.1.html` | byte-identical to Ashbound — The Three Prophecies |
| `afterlight-the-fourfold-blade.html` | byte-identical to Afterlight — The Fourfold Blade |
| `campaign_master.html` | byte-identical to AdventureForge 7 — campaign master map |
| `diskbound.html` | byte-identical to Diskbound — Echoes of Argool |
| `echoes-of-the-first-dawn.html` | byte-identical to Echoes of the First Dawn |
| `lions-of-the-unwritten.html` | byte-identical to Lions of the Unwritten |
| `orbs-of-the-first-dawn.html` | byte-identical to Orbs of the First Dawn |
| `sevenfold-frontier.html` | byte-identical to Sevenfold Frontier |
| `sixfold-dawn.html` | byte-identical to Sixfold Dawn — The Erdrick Chronicle |
| `undertow-weapon-water.html` | byte-identical to Undertow — Seven Guardians Below |
| `Neon-Skies.html` | the same build as the wall's Neon Skies, which is its offline bundle; every line of its text is in the wall's copy |
| `Electric-Sheepish.html` | the same build as the wall's Before the Rain — Electric Sheepish (offline bundle) |
| `Rain-Check.html` | RAIN CHECK — The Living City, the 36-area build; the wall's The Street of Rain is the 48-area build that contains it |
| `first-earth.html` | First Earth — Shape a world, the build before the wall's The Living Worlds revision |
| `iron-signal.html` | IRON SIGNAL Portable Edition 1.0.1; the wall has 1.0.2 |

## Replaced on the wall

| Game | What changed |
|---|---|
| The Lion's Oath | `the-lions-oath.html` is the second pass over the wall's "Repair release 1.2": data 1.2.0 instead of 1.1.0, save validation, scene recovery, company limits and combat edge cases repaired, plus a battlefield unit list, keyboard focus control and reduced-motion settings. Same file name, same stills. |
| Starlight Drifter — Online launcher | Was imported hidden, because its bundle threw `ai is not a function` at engine start. `Starlight-Drifter-Online.html` is the same launcher loading three.js from the CDN instead of a broken bundle: it starts, renders the system in WebGPU or WebGL2, and a career runs from New Boston into flight. It is on the wall now, with three stills. |

## Imported but hidden

| File | What breaks |
|---|---|
| `Mega-Man-2-Mega-Man-II-Titanium-Circuit-2026-09-27-Gemini.html` | Mega Man falls through the floor on the first frame of play. The landing check only accepts feet in the bottom 6 px of the solid tile under them (`player.z % T <= 6`), so every landing sinks him a tile and he drops out of the stage. |

## Changed on import

`Blast-Corps-Brick-Blast-Brigade-Argent-Towers-Attempt-01-2026-09-27-Claude-Opus-5.5.html`
carried eleven music tracks ripped from the Blast Corps soundtrack (Zophar's
Domain USF rip), which its own credits call "for internal testing only" and
say "must be replaced before any distribution". The wall is public, so the
eleven entries in its audio manifest now hold half a second of silence and
say what used to be there; its sound effects, which are its own, are
untouched. The game plays without music, and the file dropped from 12.9 MB to
6.9 MB. The unchanged original is still in the New AI Stuff folder. None of
the other new games embed source audio.

## New on the wall

Each got a catalogue entry in `data/overrides.json` and three stills.

| Game | Was | File | Size |
|---|---|---|---|
| IRON TETHER — Operation Breakwater | `Iron-Tether-GPT-6-Astra-Pro.html` | `Bionic-Commando-IRON-TETHER-Operation-Breakwater-2026-09-27-GPT-6-Astra-Pro.html` | 1.7 MB |
| Brick Blast Brigade — Argent Towers (vertical slice) | `blastcorps-brickblastbrigade-20260927-claude-opus-5-5.html` | `Blast-Corps-Brick-Blast-Brigade-Argent-Towers-Attempt-01-2026-09-27-Claude-Opus-5.5.html` | 6.9 MB |
| Brickblast Brigade — Argent Towers | `blastcorps-brickblastbrigade-20260928-claude-opus-5-5.html` | `Blast-Corps-Brickblast-Brigade-Argent-Towers-Attempt-02-2026-09-28-Claude-Opus-5.5.html` | 7.1 MB |
| Ivalice Field Guide — Final Fantasy Tactics | `FFT_Dashboard_Guide.html` | `FFT-Ivalice-Field-Guide-2026-09-25-model-unknown.html` | 8.9 MB |
| Zodiac Brave — The Lion War | `gemini-code-1790398093492.html` | `FFT-Zodiac-Brave-The-Lion-War-2026-09-25-Gemini-2.5-Pro.html` | 53 KB |
| Zodiac Lion Tactics | `zodiac-lion-tactics.html` | `FFT-Zodiac-Lion-Tactics-2026-09-25-Muse-Spark.html` | 76 KB |
| Iron Circuit — A Mega Man 2 single-stage remix | `iron-circuit-gpt-6-astra-pro.html` | `Mega-Man-2-Iron-Circuit-2026-09-27-GPT-6-Astra-Pro.html` | 747 KB |
| Hermit Wake | `hermit-wake-grok.html` | `Metal-Slug-3-Hermit-Wake-2026-09-27-Grok-Build.html` | 202 KB |
| BRICKYARD BLITZ — All-out arcade football | `BRICKYARD-BLITZ.html` | `NFL-Blitz-BRICKYARD-BLITZ-All-out-arcade-football-2026-09-27-model-unknown.html` | 196 KB |
| Black Archive — Offline Edition | `Black-Archive.html` | `original-Black-Archive-Offline-Edition-2026-09-27-model-unknown.html` | 5.6 MB |
| Blaze Cup | `blaze-cup.html` | `original-Blaze-Cup-2026-09-28-model-unknown.html` | 399 KB |
| Brick Bowl Turbo | `brick-bowl-turbo-standalone.html` | `original-Brick-Bowl-Turbo-2026-09-28-model-unknown.html` | 5.2 MB |
| BRICK LEAGUE — Big hits. Brick energy. | `brick-league-play.html` | `original-BRICK-LEAGUE-Big-hits-Brick-energy-2026-09-27-model-unknown.html` | 133 KB |
| Emberwell (isometric) — CO55 engine | `Emberwell (isometric) · CO55 engine.html` | `original-Emberwell-isometric-CO55-engine-2026-09-27-model-unknown.html` | 136 KB |
| Midnight Riot — After Hours. All Out. | `Midnight-Riot.html` | `original-Midnight-Riot-After-Hours-All-Out-2026-09-27-model-unknown.html` | 211 KB |
| SLAPSHOT — Brick League | `SLAPSHOT.html` | `original-SLAPSHOT-Brick-League-2026-09-27-model-unknown.html` | 250 KB |
| Stress test — CO55 engine | `Stress test · CO55 engine.html` | `original-Stress-test-CO55-engine-2026-09-27-model-unknown.html` | 154 KB |
| Tideglass Caverns | `Tideglass-Caverns.html` | `original-Tideglass-Caverns-2026-09-27-model-unknown.html` | 412 KB |
| Rooftop Rivals — Turbo Duel | `rooftop-rivals-gpt-6-astra-pro.html` | `Street-Fighter-II-Turbo-Rooftop-Rivals-Turbo-Duel-2026-09-27-GPT-6-Astra-Pro.html` | 2.3 MB |
| Shellshift — Big Apple After Dark | `shellshift-gpt-6-astra-pro.html` | `Teenage-Mutant-Ninja-Turtles-Shellshift-Big-Apple-After-Dark-2026-09-27-GPT-6-Astra-Pro.html` | 1018 KB |
| Echoes of Courage — Eastern Palace | `echoes-of-courage-gpt-6-astra-pro.html` | `The-Legend-of-Zelda-A-Link-to-the-Past-Echoes-of-Courage-Eastern-Palace-2026-09-27-GPT-6-Astra-Pro.html` | 1.9 MB |
| Echoes of the Emerald Seal | `echoes-of-the-emerald-seal-gpt-6-astra-pro.html` | `The-Legend-of-Zelda-A-Link-to-the-Past-Echoes-of-the-Emerald-Seal-2026-09-27-GPT-6-Astra-Pro.html` | 1.4 MB |
