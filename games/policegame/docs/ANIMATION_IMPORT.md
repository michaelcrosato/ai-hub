# Selecting and playing an imported capture

The verified example selects `CMU/Waiting_Loop` from the engine's converted animation library and plays it on an actual `E.Humanoid`. It is a 0.933-second loop containing 18 readable key poses from CMU subject 141, take 20, seconds 3.64–4.58. The shipped clip is about 10 KB; the two upstream playback modules add about 49 KB uncompressed.

The engine is **my-3D2dge v0.34.0**, commit `5f858b302754ab666ca9ae5f7fbae0008d4dabcc`. There is no `E.AnimationClip` export in that version. Its documented import/playback APIs are the separate `Mocap.load()`, `library.clip()`, `library.sample()` and `Mocap.drive()` modules described in the upstream [MOCAP.md](https://github.com/michaelcrosato/my-3d2dge/blob/5f858b302754ab666ca9ae5f7fbae0008d4dabcc/docs/MOCAP.md).

## Files and provenance

| File | Purpose |
| --- | --- |
| `dist/content/pier17/assets/lastwatch-mocap.js` | Selected clip, measured source proportions, timing, fit and CMU provenance. |
| `dist/content/pier17/animation.js` | Small content extension: binds the official adapter once, samples the clip, and releases control when inactive. |
| `dist/content/pier17/assets/reed-animation.js` | Registered actor-animation factory; Reed uses the captured waiting gesture until the calm approach. |
| `dist/vendor/mocap/readable.js` | Upstream readable-pose codec, with an ES module export appended. |
| `dist/vendor/mocap/mocap.js` | Upstream playback/retargeting adapter, with ES module imports and export added. |
| `dist/vendor/mocap/SOURCE.json` | Pinned source commit, exact original-file hashes, license and source metadata. |
| `tests/animation-import.test.mjs` | Provenance, wrapper integrity, interpolation, looping and actual Humanoid playback checks. |

The adapter and codec are MIT-licensed engine code; the existing `dist/ENGINE-LICENSE.txt` applies. The CMU database's recorded terms are “free for all uses (may be copied, modified, or redistributed without permission).” Credit: **CMU Graphics Lab Motion Capture Database**, created with funding from **NSF EIA-0196217**. The take's [source page](http://mocap.cs.cmu.edu/search.php?subjectnumber=141) and terms remain embedded in the asset.

## Reproduce the selected-clip import

Use a checkout at the pinned engine commit. The engine's tool needs Node.js and no new package dependencies:

```sh
git clone https://github.com/michaelcrosato/my-3d2dge.git /tmp/lastwatch-engine
git -C /tmp/lastwatch-engine checkout 5f858b302754ab666ca9ae5f7fbae0008d4dabcc
node /tmp/lastwatch-engine/tools/anim-set.mjs \
  /tmp/lastwatch-engine/src/mocap/sets/cmu.js \
  --clips Waiting_Loop --name LASTWATCH \
  --out /tmp/lastwatch-selected.js \
  --credit "CMU Graphics Lab Motion Capture Database, subject 141 take 20. Free for all uses; may be copied, modified, or redistributed without permission. Converted by my-3D2dge v0.34.0; selected for Last Watch."
```

The tool prints `1 clips from CMU, 18 key poses, 10 KB`. It preserves the selected clip key-for-key, retains the source body proportions, and excludes unrelated clips. Convert only its assignment wrapper from:

```js
(window.MOCAP = window.MOCAP || {})["LASTWATCH"] = { /* generated data */ };
```

to:

```js
export const mocapSet = { /* the same generated data */ };
export default mocapSet;
```

Keep the generated comment, `sources`, `fit`, and clip metadata. Do not infer a license from another library: Quaternius and Mesh2Motion are recorded as CC0, while this selected clip retains the CMU terms.

This build verified **selection/import from the engine's already-converted library**. It did not download and reconvert raw ASF/AMC, BVH, FBX or GLB files. For a new raw take, use the upstream `tools/anim-import.mjs` pipeline and its source-rig conversion instructions, then inspect fit and motion before adopting it.

## Playback and cancellation

Use the public upstream adapter interface:

```js
import { Mocap } from "../../vendor/mocap/mocap.js";
import set from "./assets/lastwatch-mocap.js";

const library = Mocap.load(set);
const waiting = library.clip("Waiting_Loop");
Mocap.drive(rig, library); // Once per Humanoid, before sampling frames.

// Before each rig.update(dt, actorState):
rig.mocap = library.sample(waiting, elapsedSeconds);
rig.mocapMask = "upper"; // Preserve ordinary locomotion in the legs.
rig.mocapW = 0.45;       // Blend over the rig's existing pose.

// Release to the ordinary procedural pose:
rig.mocap = null;
```

`applyWaitingCapture(rig, time, active)` implements these steps for this case. Its `WeakSet` prevents rebinding the adapter every frame. Call it before the normal `Humanoid.update`; the rig's existing `draw` renders the retargeted result. Sample time should follow the scene's simulation clock so pause also pauses animation. A canceled cosmetic sequence sets `active` to false. No capture frame awards evidence or changes progression, so a skip/reload cannot duplicate gameplay effects.

The scene registry binds an actor's `animation: "reed-wait"` to `extensions.animations["reed-wait"]`. The factory receives `{rig, E, game}` and returns `{update({state,time,dt,actor}), dispose()}`; its update runs before the rig's ordinary update. The Pier 17 factory disables the capture once `suspectCalm` or `suspectDetained` is true, and clears it during disposal.

The official `Mocap.drive()` implementation internally wraps `Humanoid.prototype._pose` and `update`. This is an **upstream adapter dependency on a private engine member**, not an added patch to `engine.js`; the wrapper-integrity test pins that dependency to this engine version. Recheck this test and rendered motion before updating the engine or adapter independently.

## What is verified

Run:

```sh
node --test tests/animation-import.test.mjs tests/case.test.mjs
```

The animation tests verify the adapter/codec body hashes against their pinned originals, preserve the source take and license, sample finite changing poses, wrap the loop, drive changing finite joints on the actual engine `Humanoid`, and return to procedural posing when disabled. The case tests additionally preserve the original investigation and save behavior. These are executable Node tests, not a claim that every one of the engine's catalogued motions is compatible with this game's art or movement.

Browser rendering and the scene-specific binding require separate browser QA; the Node checks do not establish frame rate on physical RTX 3060 Ti or Galaxy S25 hardware.
