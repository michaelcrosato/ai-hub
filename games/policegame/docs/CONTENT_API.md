# Adventure content API

The browser loads ordinary static ES modules. A case exports one `definition` object; the shared shell creates `createAdventure(definition)` from `dist/runtime/adventure.js`. Validate content before playing with `validateContent(definition)` from `dist/runtime/content.js`. It returns `{valid, errors, warnings}`; each diagnostic has `path` and `message`. Callback warnings mean a route test is needed, not that the callback is forbidden.

## Case definition

```js
export default {
  id: "your-case", version: 1, title: "Your case",
  startArea: "office", startHotspot: "desk",
  flags: { inspected: false }, values: { trust: 0 },
  initialInventory: ["camera"],
  areas: [{ id: "office", name: "Office", spawn: [20, 70],
    bounds: [0, 0, 120, 100], obstacles: [[40, 20, 65, 40]] }],
  hotspots: [{ id: "desk", area: "office", name: "Desk", type: "evidence",
    x: 55, y: 30, z: 20, walk: [55, 55], description: "A working desk." }],
  actors: [], items: [{ id: "camera", name: "Camera" }],
  evidence: [{ id: "note", title: "A dated note", type: "document", text: "The note is dated yesterday." }],
  actions: [{ id: "inspect", hotspot: "desk", label: "Inspect the desk", once: "inspected",
    effects: [{ type: "flag", id: "inspected" }, { type: "evidence", id: "note" }],
    result: { title: "A useful note", text: "You record its date.", kind: "evidence" } },
    { id: "finish", hotspot: "desk", label: "File the report", when: { flag: "inspected" },
      effects: [{ type: "complete", outcome: "solved" }] }],
  objectives: [{ id: "inspect", phase: 1, when: { not: { flag: "inspected" } },
    chapter: "01 / INVESTIGATE", title: "Read the desk", detail: "Inspect the note." }],
  outcomes: [{ id: "solved", when: { flag: "inspected" }, ending: "The record is complete.", findings: ["The date is preserved."] }],
};
```

IDs are stable nonempty strings. Action IDs are unique within a hotspot; their full key is `hotspot/action`. Other top-level records use unique IDs within their collection. Keep display names separate from IDs. Locations and hotspots must be nonempty, and playable definitions need at least one outcome. `version` is the content version; save envelope schema version is separate. See the designer guide for registration and scaffold commands.

`initialState` may be an object or factory for explicit persistent extension fields. Declare every custom field there: restore retains supported runtime fields and fields declared by `initialState`. A factory must return a fresh serializable object. Content callbacks can override `refresh(state)`, `validate(state)`, `objective(state)`, `score(state)`, and `summary(state)`; Pier 17 uses these hooks to preserve its exact original progression and text. Prefer the declarative collections in new cases.

## Conditions

Use exactly one operator per condition. Omitted conditions mean true. Booleans and `(state, {definition}) => boolean` callbacks are supported. Combine operators explicitly:

| Condition | Meaning |
| --- | --- |
| `{flag: "inspected"}` | Flag equals true; `is:false` tests false |
| `{item: "key"}` | Inventory contains the item |
| `{evidence: "note", stage: "sealed"}` | Exhibit exists, optionally at a lifecycle stage |
| `{value: "trust", gte: 2}` | Compare a value; `eq`, `gte`, and `lte` are available |
| `{completed: "desk/inspect"}` | Action has completed at least once |
| `{conversation: "interview"}` | Conversation reached an end |
| `{puzzle: "clock"}` | Puzzle solved |
| `{all: [condition, condition]}` | Every child passes |
| `{any: [condition, condition]}` | At least one child passes |
| `{not: condition}` | Child does not pass |
| `{custom: "registeredName", ...data}` | Registered condition extension |

An action's `visibleWhen` controls visibility; `when` controls whether its displayed button is enabled. `reason` explains a failed enabled condition. `once:true` removes the action after its first accepted execution; `once:"flagId"` removes it after that flag is set. `readOnly:true` runs its response against a detached state and never records progression. `record:false` suppresses its field-note entry.

## Effects and results

Effects execute in order. Use an array, one effect, or a callback. Conditions can select two effect lists with `{when: condition, then: [...], else: [...]}`.

| Effect | Behavior |
| --- | --- |
| `{type:"flag", id, value:true}` | Set a flag |
| `{type:"value", id, value}` / `{type:"value", id, add:1}` | Set/increment a declared value |
| `{type:"item", id, operation:"add"}` | Add an inventory item; `remove` removes it |
| `{type:"evidence", id, stage?, note?}` | Record/update an exhibit |
| `{type:"mistake", id, text, penalty}` | Deduct once per mistake ID |
| `{type:"score", points:5, id:"optional-once-key"}` | Add a bonus; ID prevents repeat awards |
| `{type:"travel", area:"office"}` | Set persistent requested area; shell follows it |
| `{type:"complete", outcome:"solved"}` | Complete with an outcome; omitted outcome selects first matching `when` |
| `{type:"conversation", id}` | Open/resume a conversation |
| `{type:"puzzle", id}` | Open a puzzle |
| `{type:"solvePuzzle", id, answer}` | Submit an answer from a contextual action |
| `{type:"sequence", id}` | Start/resume a presentation sequence |
| `{type:"log", id, title, text, kind:"story"}` | Append a unique field note |
| `{type:"custom", name, ...data}` | Run a registered effect |

Unlocking an area or action uses a flag plus a condition; there is no separate lock object. Default scoring normalizes `scoring.milestones:[{flag,points}]` to 100, applies score bonuses and unique mistakes, and clamps to 0–100. `scoring.ratings:[{min,label}]` should be ordered highest threshold first. A custom `score(state)` owns its entire calculation, including bonuses if wanted.

`result` is `{title,text,kind,speaker?}`, a callback `(state, helpers) => result`, or `{custom:"name", ...data}`. Kinds include `story`, `success`, `evidence`, `warning`, `complete`. Named result callbacks receive `(state, helpers, descriptor)`. Every result is readable text; clues should not depend on sound alone.

Legacy/custom `run(state, helpers)` can own a single unusual action. Helpers are `set(...flagIds)`, `gain(...evidenceIds)`, `warn(id,penalty,title,text)`, `result(title,text,kind="story",speaker?)`, `apply(effects)`, `definition`, and `action`. Action exposure and execution belong in the same action record. Do not create separate switches for them.

Public mutation methods are atomic. If a callback throws or produces invalid state, the prior state is restored and the result is a warning with a developer `error` string. External side effects cannot be rolled back; keep gameplay callbacks deterministic and put audio/camera effects in presentation cues. Completed-case actions are observational.

## Items and evidence

An item can declare ordered `uses:[{id,target,label,when,effects,result,consume}]`. `consume:true` removes it after a successful use. Alternatively, `uses:[{target:"desk", action:"inspect"}]` delegates to the existing guarded contextual action. This keeps field-kit and contextual controls equivalent. `useItem(state,itemId,targetId)` chooses the first currently available target binding. No available binding returns a warning without consuming anything.

Evidence can declare `presentations` with the same target binding shape; `presentEvidence(state,evidenceId,targetId)` requires the exhibit to exist. Content may use either plain immutable exhibits or an explicit lifecycle:

```js
{ id: "note", title: "Note", type: "physical", text: "A marked envelope.",
  stages: ["observed", "sealed", "filed"], initialStage: "observed",
  transitions: { observed: ["sealed"], sealed: ["filed"] },
  related: ["receipt"],
  relationships: [{ evidence: "receipt", kind: "corroborates" }],
  mediaAsset: "note-image" }
```

Lifecycle effects append `{stage,note}` to `state.evidenceState[id].history`. Declared transitions are enforced. Add meaningful custody notes; timestamps/people are authored facts, not invented by the runtime. Plain exhibits do not acquire synthetic stages. `evidenceCards(state)` returns detached projections including authored media/relationships and saved lifecycle fields.

Register media as `assets:[{id:"note-image",type:"image",src:"content/my-case/assets/note.svg",license:"Original project artwork"}]`; `mediaAsset` refers to it. `image:"relative/path.svg"` is also available to the shell for simple exhibits. Use bundled original/licensed assets and record provenance. File existence is checked by authoring tools where available, not by the browser's pure content validator.

## Conversations

```js
{ id:"interview", actor:"clerk", speaker:"Clerk", start:"greeting", nodes:[
  {id:"greeting",text:"What do you need?",choices:[
    {id:"listen",label:"Let them explain",to:"account",effects:[{type:"value",id:"trust",add:1}]},
    {id:"challenge",label:"Ask about the discrepancy",to:"account"}]},
  {id:"account",text:"The account is recorded.",effects:[{type:"flag",id:"heard"}],
    choices:[{id:"finish",label:"Thank you",to:"end"}]},
  {id:"end",text:"Interview complete.",end:true} ] }
```

Node-entry effects execute once per node even after reload/re-entry. Choice effects execute when chosen; guard repeatable loops explicitly with `when`/`visibleWhen`. Choices support `to`, `end`, `when`, `visibleWhen`, `reason`, and `effects`. `conversationView(state)` returns current text/speaker/actorId/choices, or null. `chooseConversation(state,choiceId)` advances and returns a regular result. `closeConversation(state)` closes the UI while preserving the current node and visited-node record.

## Puzzles

Puzzles have `{id,type,title,text,hint,choices:[{id,label,value,when?,reason?}],onSuccess,onFailure,successResult?,failureResult?}`. The four primitives are:

- `choice`: exact comparison against `answer`.
- `clock`: `displayed:"22:06",offsetMinutes:8`; answer can be `"22:14"` or minute-of-day integer, including midnight wrapping.
- `timeline` (alias `order`): `answer:["access","impact","call"]`; the chosen value is an ordered array.
- `custom`: `handler:"checksum"`; `extensions.puzzles.checksum(answer,state,puzzle)` returns boolean.

`puzzleView(state)` returns choices and `solved`; `choosePuzzle(state,choiceId)` submits the choice value. Failed attempts are counted, can add a unique mistake, and remain retryable. Success effects execute once. `closePuzzle(state)` closes the UI but preserves progress. Existing contextual action IDs can delegate through `solvePuzzle` without creating a second puzzle implementation.

## Presentation sequences

`sequences:[{id,steps:[{id,kind,...cue,effects?}]}]` provides a deterministic cue sequence, not a video timeline editor. Step IDs are unique. Typical cues are:

```js
{id:"line",kind:"line",text:"The night clerk turns toward you.",speaker:"Clerk"}
{id:"pose",kind:"pose",actor:"clerk",pose:"inspect",duration:800}
{id:"sound",kind:"audio",audio:"select",duration:100}
{id:"frame",kind:"camera",camera:{focus:[100,100,20],zoom:1.1},duration:500}
```

**Durations are milliseconds.** The host presents cues through public scene APIs; the runtime does not schedule timers. `startSequence(state,id)` activates. `advanceSequence(state,id)` applies one step's effects once and returns its cue. `pauseSequence(state,id,true)` suspends advancement. `advanceSequence(state,id,{skip:true})` applies any remaining gameplay effects exactly once, suppresses their visuals and closes the active sequence. `closeSequence` acknowledges/clears the current cue; `cancelSequence` suspends and preserves the checkpoint.

`state.presentation[id].current` stores the visible cue after advancement, and `.area` records the location where the sequence started. On reload or explicit resume, restore that location and render the saved cue before advancing. Older progress without an `area` remains compatible. The last cue remains visible until acknowledgement despite `completed:true`; canceling it must still leave a way to resume and acknowledge it. A timed cue can restart its display duration after reload; its gameplay effects never repeat. `activeSequence` identifies the open sequence. The shell should stop timers while paused and offer skip; all mandatory clues also remain in text/evidence.

Canceling a sequence preserves its checkpoint and sets `paused:true`. An explicit Resume control calls `startSequence(state,id)` to reactivate the same progress, then `pauseSequence(state,id,false)` to unpause it. `startSequence` never silently clears the player's pause preference. Provide this control independently of the launching action: a `once:true` action may already have disappeared.

## State and public API

State fields are `version,caseId,flags,values,inventory,evidence,evidenceState,log,mistakes,phase,completed,completedActions,conversation,puzzles,presentation,activeConversation,activePuzzle,activeSequence,outcome,area,scoreBonus,scoreEvents`, plus explicitly declared `initialState` fields. They are JSON data. Inventory entries remain string IDs; restoring legacy unknown strings preserves them rather than deleting player data.

`freshCase()` creates state. `validateCase(value)` returns boolean. `restoreCase(value)` clones a valid save and fills optional legacy defaults; its low-level invalid fallback is a fresh state. **The application must use `createSaveManager` from `runtime/saves.js` for loading player progress**, so incompatible/corrupt originals are retained and recovery is explicit. The save manager separates case IDs and developer/player namespaces, migration, import/export and checkpoints.

Other APIs are `actionsFor(state,hotspot)`, `act(state,hotspot,action)`, `objective(state)`, `score(state)`, `caseSummary(state)`, `evidenceCards(state)`, `journalEntries(state)`, `condition(state,expression)`, `explainCondition(state,expression)`, and atomic `applyEffects(state,effects)`. `createState/restoreState/validateState` are aliases. `evaluateCondition(state,expression,definition)` is also a named export for scene bindings.

Validation checks references, extension names, duplicate IDs, condition/effect shapes and bounded navigation reachability. It cannot prove arbitrary JavaScript callbacks, all possible dynamic states, or exact collision clearances. Author routes and branch/outcome tests, retain browser interaction coverage, and treat unverified warnings as work to review.

## Save stores, recovery and migrations

`createSaveManager` needs a store with **`get(key, fallback)` and `set(key, value)`**, not the browser's raw `localStorage.getItem/setItem` methods. `get` returns a decoded JSON value or its fallback for a missing key. `set` stores a JSON value and returns `true` on success or `false` on failure. For browser code use the supplied adapter: it keeps the engine's existing `my3d2dge:` namespace while preserving malformed original JSON for recovery.

```js
import { createAdventure } from './runtime/adventure.js';
import { createSaveManager, createBrowserSaveStore } from './runtime/saves.js';

const adventure = createAdventure(definition);
const saves = createSaveManager({
  definition, adventure, store: createBrowserSaveStore(),
  development: new URLSearchParams(location.search).get('dev') === '1',
});
const session = saves.load(); // { state, area, begun, recovery?, migrated? }
if (session.recovery) showRecoveryChoice(session.recovery);
else saves.save(session); // boolean; inspect saves.lastError when false
```

In Node tests use an in-memory adapter:

```js
const entries = new Map();
const store = {
  get: (key, fallback = null) => entries.has(key)
    ? structuredClone(entries.get(key)) : fallback,
  set: (key, value) => { entries.set(key, structuredClone(value)); return true; },
};
const saves = createSaveManager({ definition, adventure, store, development: true });
```

`E.store` also has the required method surface, but its JSON parse fallback hides corrupt raw localStorage values; prefer `createBrowserSaveStore()` for the application. A failed storage write returns false instead of claiming progress was persisted.

| Method | Return and behavior |
| --- | --- |
| `load()` | Detached `{state,area,begun,recovery?,migrated?}`. Loading never overwrites the stored original. |
| `save(session)` | Boolean. Blocked while incompatible-save recovery is pending. |
| `exportSave(session?)` | JSON string containing the validated case/version envelope. |
| `importSave(textOrEnvelope,{persist:true})` | `{ok,session?,error?,code?}`. Invalid imports do not modify storage; `persist:false` validates without writing. |
| `checkpoint(name,session?)` | `{ok,error?}`. Named checkpoint in the current case and dev/player namespace. |
| `checkpoints()` | Sorted array of checkpoint names. |
| `restoreCheckpoint(name)` | `{ok,session?,error?}`; caller applies the returned session. It does not overwrite the active save. |
| `getRecovery()` | Null or `{code,message,sourceKey,original}`. Export `original` to preserve exact malformed text or the original decoded envelope. |
| `resolveRecovery('keep')` | Retains the original and leaves autosave paused. |
| `resolveRecovery('retry')` | Attempts a fresh load; inspect `ok` and `error` before changing UI. |
| `resolveRecovery('reset')` | On explicit user choice, writes a backup before replacing the current save. Returns `{ok,session?,backupKey?,error?}`; backup failure prevents replacement. |

The manager exposes `storageKey`, `development`, and `lastError`. Cases use independent keys; developer namespaces never import legacy player saves. Envelopes carry separate `formatVersion`, `schemaVersion`, and `contentVersion` fields. `definition.contentVersion` defaults to `definition.version`; `definition.schemaVersion` defaults to 1.

For compatible content upgrades, register `definition.saves.migrate(envelope,{definition,adventure})`. Return a complete envelope with updated versions and mapped IDs, or `null` when unsupported. The returned envelope is validated before use. For legacy formats register `saves.legacy:{stateKey,areaKey,begunKey,migrate(bundle,adventure,definition)}`; `bundle` contains `{state,area,begun}`. Validate before calling `restoreCase`, because its low-level invalid fallback creates fresh state. Throw on invalid legacy data so the manager retains the original and offers recovery. See Pier 17's real migration and `tests/save-integration.test.mjs`.
