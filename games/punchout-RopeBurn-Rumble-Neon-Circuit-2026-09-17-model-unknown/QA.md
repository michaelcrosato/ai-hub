# QA notes

## Automated checks

Run:

```bash
node tests/smoke.cjs
```

The smoke test executes the real game state machine with deterministic input policies. It also checks guard cancellation, pinch zoom, and the equipment purchase/equip flow.

Current balance sample, 120 seeded bouts per policy:

- Blind mash policy: 0% wins.
- Rough novice policy: about 31% wins.
- Competent read/counter policy: 100% wins with the default level-1 loadout.

These policies are synthetic. They are not a prediction of human win rates. They are used to verify that progression is not required to beat the bout and that neutral button-mashing is not an effective strategy.

## Static checks

- `node --check game.js` passes.
- All JavaScript UI element IDs exist in `index.html`.
- `serve.py` compiles with Python 3.
- The source does not contain Nintendo boxer names, sprites, audio, or other copied game assets.

## Browser test limitation in this build environment

The installed headless Chromium process does not start correctly in this container, including for a one-line `data:` page. It fails before page execution because its system graphics/session dependencies do not initialize. For that reason, the graphical renderer could not be captured in this environment.

The Three.js path uses APIs documented for Three.js r186. The local WebGL 1 compatibility path uses small GLSL shaders and the same gameplay state machine.
