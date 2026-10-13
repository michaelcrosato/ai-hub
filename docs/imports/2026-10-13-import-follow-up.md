# Import follow-up: evidence and Windward packaging repair

The PR remains draft and unmerged. This follow-up does not change the 130 imported games or the 504-entry catalogue.

## Counts and identity decisions

All 237 supplied source candidates are accounted for: 130 new games, 41 earlier same-game builds skipped to preserve later hub integrations, 11 byte-identical existing HTML files, 14 equivalent archive packages represented by selected standalone games, 2 superseded builds within the backup, 38 non-game tools/reports/libraries, and 1 unresolved export (Windward).

Thus 43 earlier/superseded builds were skipped; the 11 exact duplicates and 14 equivalent packages are separate categories. The 149 old HTML revisions already omitted by the backup producer are not part of these counts.

The two superseded backup builds are ION CIRCUIT Magnetic 101 → g-zero 0.6.1, and AXIOM Living Frontier Site snapshot → AXIOM experimental preview. See the main audit for module, model and version evidence.

Potential name collisions were resolved conservatively: distinct Breakwater, Last Bell, Lumenwake and Nacre implementations remain separate; Iron Tide Free Command and the dual-role Iron Tide Site game both remain; Ashport's smaller runtime district and fuller Night Run world both remain; AXIOM Outward Expedition's contracts model remains separate from Living Frontier's regional town/restoration model. No distinct source was discarded solely because of its title. Windward is a packaging defect, not an identity merge. It remains distinct from Windpost and the other flight games. The available evidence does not leave an identity decision requiring the user's choice; the remaining choice concerns including the repaired Windward export.

## What the browser evidence actually establishes

The 130 records are real local Chromium navigation/input/screenshot runs, with zero uncaught `pageerror` events. They are **not 130 verified successful gameplay launches**. `loaded: true` means the automation completed its navigation, input attempts and screenshot steps. It does not assert engine readiness or check that an in-game caught error is absent.

39 records did not activate a matching start button (keyboard input was still attempted); some captures are title/menu/briefing screens. Hidden UI text can also appear in `body_excerpt`. The evidence supports representative gameplay starts and broad page-load coverage, not a proven count of 129 or 130 fully playable games.

**RIFTBOUND is a confirmed blocked launch:** it rendered a shell with two canvases and reported no uncaught exception or failed network request, but displayed:

> The rift could not open.
> Chrome could not obtain a WebGPU adapter. Enable a hardware or software WebGPU adapter.
> Chrome requires WebGPU and a secure page.

No start button was activated in its record, and gameplay did not launch successfully. Test it on hardware with a WebGPU adapter. Four Site games had optional Google Fonts certificate failures; AXIOM Contact and MIDWAY logged failed CDN attempts before embedded fallback. See the per-entry browser JSON.

## Evidence that the test failure predates import

[Original baseline test output](2026-10-13-baseline-tests.txt): at base commit `b96da1cd3bf7cd0d25b49336337fa96dfd53a32b`, 180 tests ran, 179 passed, and `scan attaches a three-frame JPEG strip to every published game` failed at `scripts/frames.test.mjs:35` with **373 !== 374**.

[Final test output](2026-10-13-final-tests.txt): the same test fails with **503 !== 504**; 179/180 still pass. All 130 additions have three frames. The generated catalogue identifies the sole entry without frames as `jungle-strike-capital-strike`, path `games/Jungle-Strike-Capital-Strike-2026-10-12-model-unknown.html`.

`git ls-tree` identifies that game's blob as `563fbfc5622237ced99d96476f90db0aaaa6f2f4` in both the base and import commit. The base tree contains no Capital Strike cover files. No existing cover file or game file was changed by the import.

## Windward: exact defect and faithful candidate

Original SHA-256: `7105bc49558b4c37b5a6f6959f6bb653800759eacf2b2f77063aa3b2f29363ed`. The original remains unchanged under deployment-excluded `sources/drive-import-2026-10-13/`.

At zero-based UTF-8 byte offset **3,219,773** (character offset 3,219,721; line 383), the bundled Three.js `PropertyBinding` track regex contains a duplicate of the HTML prefix up to the opening `<script>` tag: **35,795 bytes / 35,743 characters**. The corrupted expression is structurally:

```js
Xs=RegExp(`^`+Ks+qs+Js+Ys+`<duplicated HTML prefix>),Zs=[...]
```

Replacing exactly that duplicate prefix with dollar-sign + closing backtick restores:

```js
Xs=RegExp(`^`+Ks+qs+Js+Ys+`$`),Zs=[...]
```

This is consistent with JavaScript string-replacement expansion of `$` followed by backtick: it inserts the text preceding a match. The duplicate is byte-for-byte the document prefix before `<script>`. The local Three.js `src/animation/PropertyBinding.js` independently confirms the required terminal `$` regex anchor. The original export routine is absent, so its precise implementation is inferred, not observed.

Only that range is changed in the isolated candidate; all other bytes, embedded assets and gameplay remain intact. The full extracted script passes `node --check`. A local Chromium test reached the start menu, clicked Start checkride and entered the plane lesson. Holding Space raised the displayed speed from 0 to 15 m/s. The loading overlay had class `hide` and opacity `0`. No JavaScript exceptions or failed asset requests occurred; two console 404s were `/favicon.ico` in the temporary test server. [Candidate browser evidence](2026-10-13-windward-candidate-check.json).

Safe options:

1. Apply this exact packaging repair to a new game entry, retain the original excluded source, then add catalogue metadata, screenshots and focused browser checks. This would increase the import to 131 games. No gameplay rewrite is needed.
2. Keep the present 130-game PR unchanged and request a clean export from the original builder.

For this assessment, the repaired candidate remains local at `/workspace/drive-import/windward-candidate.html`; it has not been published as a game. The current audit count remains 130.
