# Remaining Drive imports

PR #2 was explicitly approved and squash-merged as `6485e242c96551c602bc8d63d53775cf304030de`. Its head was `d439da1692e2b7ddb00990b1c03650e5a21aab73`; both Vercel checks passed before merge. The repository disallows merge commits, so squash was used. The fetched `origin/main` points to that merge.

This continuation adds **7 catalogue entries**, bringing the branch from **504 to 511**. Across both passes, **137 new entries** are represented; none of the original 374 is replaced. Collections retain their own built-in scene selectors rather than duplicating each mission as a separate catalogue entry.

## Added games

| Entry | Source/content basis | Packaging |
|---|---|---|
| Windward — Flight School | Plane/checkride game, previously malformed export | Replace precisely the duplicated 35,795-byte HTML prefix with the two-character regex terminator. Every other source byte is unchanged; original remains excluded from deployment. |
| DITHER — Sector 07 & Chapel of Ash | Two built-in missions, three objectives each, health and win/fail states | Original standalone cartridge player, unchanged; both missions available through its selector. |
| Stick Lab — Sparring & Parkour | Controllable fighter, sparring AI, damage, knockout and parkour modes | Original game logic unchanged; Git may normalize line endings. |
| TIDELINE — Lights & Rescue | Light collection and boat-towing rescue objectives, alongside surface lab | Original game logic unchanged; Git may normalize line endings. |
| my-3D2dge — Five Game Slices | Adventure, platformer, brawler, shooter and turn-based battle | Original collection unchanged, preserving menu and animation lab. |
| CO55 — Combat Arena | Authored arena, four enemies, movement, attacks and health | Original HTML unchanged. Engine ancestry overlaps Emberwell, but layout and hero/enemy setup differ; preserved as a separate combat sandbox. |
| Mosslight — Crystal Island | Five crystals, movement/jumping, physics and completion state | `npm ci` with original lockfile, `npm run build -- --base ./`; own asset paths rebased, source maps omitted. Three.js 0.186.0 / Rapier 0.20.0 preserved. |

The initial exclusion pass was too broad for engine/lab filenames. This review inspected their actual game logic, including missions and combat, rather than inferring identity from labels.

## Final source accounting

[Full revised 237-source audit](2026-10-13-remainder-audit.json), including source IDs and hashes:

- 137 imported sources / catalogue entries.
- 42 earlier same-game builds retained as exclusions to protect later hub versions.
- 11 exact existing duplicates.
- 15 equivalent source packages/editor variants represented by imported entries.
- 2 superseded source builds in the backup.
- 30 remaining non-game tools, reports, rendering/animation experiments or performance labs.
- 0 unresolved source candidates among those 237 after Windward's repair.

The AXIOM Audit Workbench is reclassified as an earlier source, not a separate game: all 68 named modules appear in Contact 0.6.0 and 28 match exactly, including contracts and combat. DITHER's editor is represented by the imported player and its two missions. Frameforge's authoring surface is not an extra game; its playable Rivet export already exists. Original title/version relationships and all earlier selected games remain intact.

Remaining exclusions include the CANON catalogue; Morph/Pixel Forge/Frameforge/Emberdeep authoring or visual tools; static design, scene, sound and completion reports; the FFT guide and Story Time reading library; crowd benchmarks; rendering/animation testbeds; and Pavilion's procedural physics/rewind lab. No private database/save backup is imported. Emberfall—The Endless Descent still has no usable source in the backup manifest; it is not one of the 237 downloadable candidates. The 149 revisions omitted before the backup was created remain outside this review.

## Verification

- [Seven browser records and captured strips](2026-10-13-remainder-browser-checks.json): no uncaught exceptions. CO55's optional Google Font request fails certificate validation in this environment; its game runs with fallback typography. All seven have three screenshot frames.
- [Focused interaction evidence](2026-10-13-remainder-interaction-checks.json): both DITHER missions report `ready: true`, `state: playing`, three objectives and changing player coordinates; all five my-3D2dge slices were opened by their original hash routes and accepted input without exceptions; CO55 player coordinates change with movement and its four enemies are present.
- Windward's earlier isolated repair test reached the plane lesson and increased speed to 15 m/s under throttle. The imported repaired bytes match that candidate exactly.
- Stick Lab's browser capture shows sparring damage and a confirmed hit. TIDELINE reaches game mode with the boat-rescue objective. Mosslight renders through WebGL 2 fallback at 45 FPS in the recorded sample, reports 60 Hz physics and zero GPU errors.
- [Repository tests](2026-10-13-remainder-tests.txt): **179/180 pass**; the same baseline Capital Strike screenshot failure remains, now **510 !== 511**. No existing game or cover was modified.
- Credential-pattern screening of added runtime files found no matches. No source ZIP, private save, Site server/auth code or source map was published. Drive remains unchanged.
- Full campaign completion and hardware WebGPU are not certified. RIFTBOUND from PR #2 still requires a hardware WebGPU test; its prior blocked result is not counted as a successful gameplay launch.

No prolonged gameplay repair was attempted. Only Windward's verified export correction, static asset packaging and new catalogue labels were changed.
