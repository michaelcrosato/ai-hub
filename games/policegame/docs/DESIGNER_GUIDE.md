# Author an investigation

This guide is the starting point for making another Last Watch case. Content is JavaScript data with stable IDs, readable conditions and effects. You do not need to edit the engine, application shell, HTML, or shared runtime to add ordinary adventure content. A small named extension is available when a mechanic needs code.

## Start with a working case

From the repository root:

```sh
npm ci
node tools/create-case.mjs night-register --title "The Night Register"
node tools/validate-content.mjs dist/content/night-register/definition.js
node tools/run-route.mjs dist/content/night-register/definition.js
python -m http.server 8000 --directory dist
```

Register the new definition by adding an import and array entry in `dist/content/index.js`:

```js
import nightRegister from './night-register/definition.js';
// Keep existing imports and registrations.
export const cases = [pier17, nightRegister];
```

Open `http://localhost:8000/?case=night-register&dev=1`. The generated case is immediately playable: inspect the records desk, then submit the record. The route file is the `routes` array at the bottom of the definition. It includes completion, save/reload, and a blocked-action recovery check.

The scaffold refuses existing directories and invalid IDs. `--dir /some/folder` is useful for experiments; it changes output location, not the registration workflow. Use `?case=night-register` without `dev=1` to verify the ordinary player experience. Development mode has separate saves.

## IDs, state and safe iteration

Use lowercase stable IDs such as `archive`, `caretaker`, and `receipt-photo`. Titles can change; IDs identify references and saved progress. A case's `version` is its content version, separate from the save-envelope schema. Increment it when changing persistent content contracts and provide a migration as described in [CONTENT_API.md](CONTENT_API.md). Do not silently reuse an old ID for a different object.

Declare state up front in `flags` and `values`. Keep state serializable: booleans, numbers, strings, arrays and plain objects. Runtime objects, images, DOM nodes and functions belong outside saves. Use `effects` to mutate gameplay, not a painter or a dialogue rendering callback.

## Add a room, prop and point of interest

Append an area and hotspot to their arrays. Coordinates are world coordinates, not browser pixels:

```js
// areas
{ id: 'archive', name: 'Archive', title: 'THE ARCHIVE', showTitle: false,
  bounds: [30, 80, 250, 245], spawn: [85, 210],
  obstacles: [[154, 92, 224, 128]],
  entrances: [{ id: 'south-door', x: 85, y: 210 }],
  camera: { focus: [140, 155, 12], fit: [395, 290] },
  ambience: { rain: false },
  props: [{ id: 'box', kind: 'crate', x: 188, y: 111, z: 0,
    size: 1.4, color: '#8d7860' }] }

// hotspots
{ id: 'records-box', area: 'archive', name: 'Records box',
  type: 'document', description: 'The overnight delivery records.',
  x: 188, y: 111, z: 24, walk: [188, 147] }
```

The default scene painter handles a simple room and registered props. Prop `size` is an engine scale multiplier (typically 1–2), not a width in world units. [SCENE_API.md](SCENE_API.md) defines camera-fit units, actor appearance/poses, painter and animation callbacks, and the inspector's public scene hooks. Art does not imply collision: specify obstacle rectangles separately. Keep approach points outside obstacles and reachable from spawn. `z` is height; screen depth follows the engine's world projection. Check composition in portrait and landscape instead of placing labels against one screenshot.

## Add an NPC and conversation

Add an actor and link a hotspot with `actor: 'caretaker'`. Actor appearance accepts engine Humanoid options; portraits come from the same registered actor:

```js
{ id: 'caretaker', area: 'archive', x: 110, y: 132, z: 0,
  facing: 0.3, portrait: true,
  appearance: { outfit: 'coat', hair: 'short', colors: { coat: '#536e70' } },
  poses: [{ when: { flag: 'helped' }, pose: 'wave' }] }
```

Define a conversation with a stable `start` node and stable choice IDs. Branches join by pointing to the same node. Conditions control choice visibility or availability; effects persist the decision:

```js
{ id: 'caretaker-talk', actor: 'caretaker', start: 'greeting', nodes: [
  { id: 'greeting', speaker: 'Caretaker', text: 'I kept the envelope dry.', choices: [
    { id: 'thank', label: 'Thank them for preserving it.', to: 'account',
      effects: [{ type: 'flag', id: 'helped' }] },
    { id: 'ask', label: 'Ask about its arrival.', to: 'account' }
  ] },
  { id: 'account', speaker: 'Caretaker', text: 'It arrived before the bell.', end: true,
    effects: [{ type: 'evidence', id: 'caretaker-account' }] }
] }
```

Start it through an action effect `{type:'conversation', id:'caretaker-talk'}`. Declare the referenced `helped` flag and `caretaker-account` exhibit first. Node effects apply once on first entry; state keeps the current node across reload. Do not put vital information behind only one optional conversation choice. Define a return/join for both branches and test both.

## Add tools, consumable items and evidence

An item definition needs an ID/name; add its ID to `initialInventory`, or grant it with `{type:'item',id:'blotter'}`. A use binds the item to a hotspot and can delegate to an existing action with `action:'inspect'`, keeping one set of guards and effects. For a distinct consumable interaction:

```js
{ id: 'blotter', name: 'Absorbent sheet', uses: [{
  target: 'records-box', when: { not: { flag: 'dried' } }, consume: true,
  effects: [{ type: 'flag', id: 'dried' }],
  result: { title: 'Paper preserved', text: 'The record can be handled safely.', kind: 'success' }
}] }
```

Provide a contextual action for the same operation when it benefits accessibility. A consumable's two access paths must have the same ownership check, effects and removal rule.

An exhibit has `id`, `title`, `type` and `text`. Optional `stages`, `initialStage`, `transitions` and relationships express its custody model. Record it with `{type:'evidence',id:'receipt-photo',stage:'documented',note:'Photographed in place.'}`. Keep provenance factual. Inspection attachments and presentations to NPCs are documented in [CONTENT_API.md](CONTENT_API.md); use the original included example as a working reference.

## Actions, puzzles, objectives and outcomes

Every ordinary interaction is one action object: `id`, `hotspot`, `label`, optional `visibleWhen`, `when`, `reason`, `once`, `effects`, and `result`. `when` is the availability guard; write `reason` as a useful next step. `once:true` hides an action after execution. Use `{all:[...]}`, `{any:[...]}`, `{not:...}`, flags, items, exhibit stages, completed actions, conversations and puzzles to compose dependencies.

For example, `{all:[{evidence:'receipt-photo',stage:'documented'},{conversation:'caretaker-talk'}]}` requires the documented photograph and the completed interview. The condition `{completed:'records-box/inspect'}` refers to the hotspot/action pair, not just the action ID.

Built-in puzzle types include `choice`, `clock`, and `timeline`. Start one with `{type:'puzzle',id:'delivery-clock'}`. A clock definition specifies its displayed time, correction in minutes, visible answer choices, and success/failure effects. All choices must be selectable through the normal interface. Put an incorrect choice in a recovery route; do not make a wrong answer permanently block the case. See the exact schemas in [CONTENT_API.md](CONTENT_API.md).

Objectives are ordered conditions with chapter/title/detail and a phase. Put the most specific conditions first. Tune `scoring.milestones` and descending `scoring.ratings`; mistakes can subtract a one-time penalty with a stable mistake ID. Keep logical access independent from arbitrary score thresholds unless that is deliberate design.

Give each ending an `outcomes` entry, then complete through a guarded action effect `{type:'complete',outcome:'documented'}`. Different ending actions can require different evidence conditions. The ending must not rely on a confession if the physical case already establishes what happened. Prove every authored outcome with a route.

## Validate and test the content

Run validation after each meaningful change. Diagnostics include the file, content path and missing reference or navigation issue. The JSON report includes candidate producer actions and dependency chains:

```sh
node tools/validate-content.mjs dist/content/night-register/definition.js --json --max-states 250
node tools/run-route.mjs dist/content/night-register/definition.js all
npm test
```

The validator checks references and navigation, dynamically runs the declared routes, and bounds declarative action exploration. It labels callbacks and other interactive input spaces **unverified statically**. Passing one route does not prove arbitrary JavaScript, every puzzle input, or every possible action ordering. A budget-limited search is not an unreachable-outcome verdict.

With no arguments, `npm run validate:content` and `npm run test:routes` check every registered case. A registered case without authored routes is explicitly reported as not route-tested. The preserved Pier 17 definitions include clean, alternate-order and mistake/recovery routes.

Route steps use only public gameplay APIs. Strings mean `hotspot/action`; the runner moves the logical route to the hotspot's area. They do not simulate walking or device input. Structured steps cover other behavior:

```js
{ id: 'supported-ending', steps: [
  { type: 'action', hotspot: 'records-box', action: 'submit', blocked: true },
  'caretaker/talk',
  { type: 'choice', conversation: 'caretaker-talk', choice: 'thank' },
  { type: 'item', item: 'blotter', target: 'records-box' },
  'records-box/clock',
  { type: 'puzzle', puzzle: 'delivery-clock', choice: 'wrong', rejected: true },
  { type: 'reload' },
  { type: 'puzzle', puzzle: 'delivery-clock', choice: 'correct' },
  'records-box/submit'
], expect: { completed: true, outcome: 'documented' } }
```

Also supported: `travel` with `area`; `evidence` with `evidence`/`target`; `sequence` with `sequence`/`skip`. A rejected step is explicit; ordinary unexpected failure stops the route at the exact command. Add alternate ordering, recovery, and intermediate reload routes. Browser-check clicking, touch, keyboard focus, standard gamepad, modal return, fullscreen, sound, area transitions and all ending screens.

## Development inspector and checkpoints

The inspector is enabled only by `?dev=1`; development saves never replace player saves. Use it to jump areas, set declared flags, add/remove inventory, advance exhibit stages, inspect blocked actions, and capture named checkpoints. Restoring a checkpoint updates the development session. Export a save before a migration test; a rejected import leaves the active save unchanged.

For scene work, use world-coordinate readout, navigation bounds/obstacles, hotspot approach visualization, path probes and camera controls. Copy a placement snippet into the content definition; inspector placement changes are a preview, not a source-code writer. Revalidate after editing the source. Testing with cheats establishes a layout or branch check, not a successful normal gameplay route.

## Extend, review and publish

Start with the named callback/puzzle/painter examples in [EXTENDING_GAMEPLAY.md](EXTENDING_GAMEPLAY.md). Register functions rather than code strings. Keep gameplay changes in effects, avoid persisting renderer objects, and test retry/skip/reload for duplicate effects. Asset and animation use must follow the documented verified workflow and its licensing notes.

Before publishing, run the original Pier 17 regressions and the new case routes. Test a fresh player save and resumed saves in portrait, wide landscape and short mobile landscape. Verify assets resolve from the static `dist/` directory. Add source metadata and credits for original or licensed assets. The existing Sites project is recorded in `.openai/hosting.json`; publish the static `dist/` artifact to that project through the Sites workflow. A deployment is not complete until the live URL has been checked.

## Controller-first presentation

The standard shell is now a television-oriented full-viewport scene with temporary overlays. See [TV_CONTROLS.md](TV_CONTROLS.md). Content still supplies ordinary actions, hotspots and conditions: no case scripts need controller branches. Give each hotspot a short `name`/`markerName` and a reachable `walk` position. Available actions lead the menu; disabled choices remain in an expandable prerequisite list. Use concise choice labels and let long explanation text wrap. Test authored content with controller navigation as well as pointer input.

Run `npm run test:tv` for complete controller-only cases and full-screen layout checks. Options and Locations expose paused presentation recovery; Options exposes the debrief for completed cases.
