# Extending gameplay without editing the engine

Keep new case narrative, scene definitions, assets and custom hooks under its own content directory. Shared mechanics belong in `dist/runtime/`; rendering foundations remain in the unchanged `dist/engine.js`. Most additions use the [content API](CONTENT_API.md) and [designer guide](DESIGNER_GUIDE.md).

## Registered escape hatches

Use a named callback when a small new rule does not fit a common primitive. This preserves validation of the extension name and keeps unusual case logic out of the shell:

```js
export const extensions = {
  conditions: {
    sealAvailable(state, descriptor) { return state.values.sealPressure >= descriptor.minimum; },
  },
  effects: {
    adjustSeal(state, descriptor) { state.values.sealPressure += descriptor.delta; },
  },
  results: {
    sealReading(state, helpers) { return helpers.result("Seal reading", `Pressure: ${state.values.sealPressure}`); },
  },
  puzzles: {
    sealChecksum(answer, state, puzzle) { return answer === puzzle.checksum && state.evidence.includes("seal-note"); },
  },
};
// Declare values:{sealPressure:0}, evidence:[{id:"seal-note",...}], and:
const puzzle = { id:"seal",type:"custom",handler:"sealChecksum",checksum:"S-17",
  title:"Check the seal",text:"Read the note and match its checksum.",
  choices:[{id:"valid",label:"S-17",value:"S-17"}],
  onSuccess:[{type:"flag",id:"sealChecked"}] };
```

Condition callbacks receive `(state,descriptor,{definition})`; effect callbacks receive `(state,descriptor,helpers)`; named result callbacks receive `(state,helpers,descriptor)`; puzzle callbacks receive `(answer,state,puzzle)`. Declare new persistent fields in `flags`, `values`, or `initialState`; otherwise restoration intentionally does not import arbitrary unknown top-level keys. Use stable IDs and add a save migration when changing required state.

Hooks must remain synchronous, deterministic and serializable. Atomic action execution rolls back state changes on errors, but cannot undo a network request or audio playback. Put sound, actor poses and camera changes in sequence cues, whose effects and current cue survive saves. Avoid DOM access, timers and network calls inside rule callbacks. Use asynchronous work only in a separate host adapter with a clear completion action if a future mechanic requires it.

## Extending a reusable mechanic

1. Start with the smallest content hook that expresses the rule and a route/test that exercises it.
2. Promote it to a runtime primitive only when another case needs the same behavior.
3. Define its serialized state, prerequisites, effects, visible feedback and restore policy first.
4. Update content validation for all referenced IDs and callback names.
5. Add a failure/invalid-input test, a normal route, and resume from its meaningful intermediate state.
6. Exercise the visible control with pointer, keyboard, touch and simulated standard gamepad. Keep hardware claims separate from browser simulation.

The current primitives cover contextual actions, items/consumption, evidence/custody stages, conversation branches and joins, choice/clock/timeline/custom puzzles, objectives, scoring, outcomes and small sequences. Driving, combat, NPC schedules and multiplayer are outside this adventure layer; implement them as new scoped systems if the game design requires them.

## Scene and presentation hooks

Scene content registers areas, actors, obstacles, approach points and named painters. Reuse the scene adapter's public drawing/prop helpers and actor declarations. A scene's `poses:[{when,pose}]` binds visuals to the same conditions used by gameplay. `extensions.painters` registers custom room painting without adding case IDs to the shared renderer. See the scene/asset documentation for the exact painter context and supported props.

Sequence cues are data, not gameplay callbacks: `kind:"pose"` identifies an actor and pose; `kind:"audio"` identifies sound; `kind:"camera"` provides camera data; `kind:"line"` provides readable dialogue. `duration` is milliseconds. The shell controls presentation timing, pause, skip and focus. A skipped sequence still applies pending gameplay effects once, so never put an optional choice in a sequence effect.

## Asset provenance and inspection

Bundle assets locally with a manifest record `{id,type,src,license}`. Evidence references the asset through `mediaAsset`; prose still describes all necessary clues. Maintain a source/license note for external art, audio and animations. Original SVG/pixel art can be authored with the case; existing engine poses require no external animation files. Do not claim compatibility with a motion-library format until an actual import, render and license check has passed.

## Validation limits

Declared content references and standard rule conditions can be checked before launching. Reachability checks are bounded and use a coarse navigation grid, so inspect actual engine collision/approach behavior too. Arbitrary callbacks cannot be statically proven complete; author a route for each intended branch/outcome and a resume fixture where their state matters. `tests/adventure.test.mjs` demonstrates two independent outcomes, item consumption, evidence lifecycle, conversation resume, puzzle retry, registered callbacks and idempotent sequence skip.
