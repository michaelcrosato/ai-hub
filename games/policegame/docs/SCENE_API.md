# Scene, actor, and presentation authoring

`dist/runtime/scenes.js` is the content-neutral adapter over my-3D2dge v0.34.0. `dist/content/pier17/scene.js` contains the original harbor artwork and metadata. The compatibility entry `dist/scene.js` supplies the Pier 17 definition to old callers; new hosts pass their case definition explicitly.

```js
import { createScene } from './runtime/scenes.js';
const scene = createScene({
  definition,
  onSelect: hotspotId => openInteraction(hotspotId),
  onReady: game => hideLoading(),
  onNotice: notice => showUsefulNotice(notice)
});
scene.setState(adventureState);
```

The host owns the DOM case interface, focus, persisted gameplay, and sequence progression. The adapter owns world rendering, engine input, motion, navigation, audiovisual cues, and temporary presentation state. It never advances the case by itself. `onSelect` fires only after a valid approach completes. The optional `headless:true, loop:false` arguments permit deterministic `scene.game.advance(seconds)` tests.

## Areas and coordinates

All positions are world units: `x/y` lie on the ground and `z` points up. They are never CSS pixels. Negative world coordinates work. An engine tile is normally 16 units; the adventure navigation mask defaults to a finer 4-unit cell.

```js
areas: [{
  id: 'office', name: 'Records office', title: 'AFTER THE CALL',
  subtitle: 'The ledger is still open.',
  bounds: [20, 60, 290, 250], // minX, minY, maxX, maxY
  spawn: [95, 205],
  entrances: [{id: 'hall', x: 95, y: 205, facing: -1.1}],
  obstacles: [[190, 90, 245, 130]], // same rectangle convention
  camera: {focus: [155, 155, 15], fit: [490, 320], yaw: 0},
  ambience: {rain: false, sky: ['#091923', '#28434b'], music: 'office-theme'},
  props: [{id: 'records-box', kind: 'crate', x: 213, y: 110, size: 1.4,
           color: '#807258', visibleWhen: {not: {flag: 'boxRemoved'}}}]
}]
```

An area with no `painter` uses the default room painter. Set `showTitle:false` to omit its wall lettering, or `wallLabel` to use different lettering from the HTML title. Props use engine prop names such as `crate`, `barrel`, `lamp`, `streetlamp`, `trashcan`, `door`, and `tree`. **Prop `size` is a scale multiplier, usually 1–2, not a width in world units.** The floor and art do not automatically create collision: declare matching `obstacles`. `navigation.tile` can increase the cell size for a large room; masks are bounded at 250,000 cells.

`camera.focus` is a world point. `camera.fit` is the projected reference width/height used to fit the room into the current buffer; it is not a world rectangle. The default three-quarter view projects world X at 1.5 pixels per unit before camera zoom. A room 300 units wide therefore needs about 510–550 reference pixels including margins. `zoom`, when provided, overrides fit. `yaw` is an absolute degree offset from the configured base view. Resolution defaults to `[480,330]`; `definition.scene` can set `view`, `resolution`, `background`, and deterministic `seed`.

## Hotspots and picking

```js
hotspots: [{
  id: 'ledger', area: 'office', name: 'Open dispatch ledger',
  markerName: 'LEDGER', // optional shorter on-scene name
  x: 210, y: 115, z: 24,
  walk: [210, 150],
  pickRadius: 25,
  visibleWhen: {not: {flag: 'ledgerRemoved'}}
}]
```

The marker and its entire text label are clickable. `walk` is an approach point, not the clue's visible position; put it on navigable ground. Actor hotspots can set `actor:'clerk'`; portraits resolve that actor. `portrait:'player'` displays the player without inventing an NPC record.

`selectHotspot(id)` returns `true` only when an approach begins. Invalid, blocked, out-of-bounds, and disconnected approaches return `false` and emit a notice. Motion has both a distance-derived timeout (at most 60 simulation seconds) and a 1.5-second stall guard. Area changes, manual movement, explicit cancellation, hidden targets, and replaced walks cannot deliver stale selection callbacks. Routine cancellations remain observable diagnostics; a host should avoid presenting them as errors.

## Controller targeting and overlay ownership

The host handles DualSense buttons and calls the scene adapter through these public methods:

| Method | Behavior |
| --- | --- |
| `getTarget()` | Current aimed hotspot, or nearest visible hotspot with a valid approach point. |
| `focusTarget(id)` | Aim at a visible hotspot without walking. |
| `cycleTarget(direction)` | Select the previous/next visible point in projected screen order; cancels an old approach. |
| `interactTarget()` | Approach the aimed point, then call `onSelect` on arrival. Returns whether accepted. |
| `getWalkState()` | Current player approach metadata, or `null`. |
| `cancelWalk(reason)` | Cancel outstanding approaches without firing arrival callbacks. |
| `setUIFocus(true)` | Block world input and freeze ordinary player approaches while an overlay owns focus. Scripted sequence movement remains available. |

Manual walking releases an explicit aim; changing areas resets it. All points have small markers; only the focused or hovered point has a label unless `setHighlight(true)` reveals all. The keyboard interact binding remains in engine input. Cross and Options are owned by the application shell so one press cannot confirm an overlay and also interact with the world. The shell uses public `game.pauseOverlay = false` for its own pause dialog, while retaining `game.menu('controls')` for keyboard binding settings.

## Actors, poses, appearance, and animation

```js
actors: [{
  id: 'clerk', area: 'office', x: 160, y: 140, z: 0, facing: .5,
  appearance: {build:'heroic', outfit:'coat', hair:'short', weapon:null,
               colors:{coat:'#596b68', skin:'#b98062'}},
  pose: 'hips',
  poses: [{when:{flag:'reassured'}, pose:'wave'}],
  appearances: [{when:{flag:'reassured'},
                 appearance:{colors:{coat:'#759074'}}}],
  visibleWhen: {not:{flag:'clerkLeft'}}, portrait: true,
  animation: 'clerk-idle'
}]
```

The first matching `poses` or `appearances` rule wins. `appearanceRules` is an alias for `appearances`; colors merge with the base palette. Rigs and animation bindings rebuild only when the matching appearance rule changes. Engine poses include `hips`, `wave`, `kneel`, `crouch`, `guard`, `cheer`, and `down`. A transient sequence pose overrides an animation callback, which otherwise overrides the declared default pose.

```js
extensions: {
  animations: {
    'clerk-idle': ({E, game, rig, actor}) => ({
      update({state, time, dt, actor, rig}) {
        return {expr: state.flags.reassured ? 'smile' : undefined};
      },
      dispose() {}
    })
  }
}
```

Factories initialize once per actor/appearance. `update` runs immediately before `rig.update`, may assign animation fields such as `rig.mocap`, and may return public rig-state values. Keep gameplay changes out of these callbacks. The imported Reed waiting clip is an implemented, tested example, not a hypothetical recipe: see [ANIMATION_IMPORT.md](ANIMATION_IMPORT.md), `content/pier17/assets/reed-animation.js`, and `tests/animation-import.test.mjs`.

## Original painters and assets

```js
extensions: {
  painters: {
    officeArt: ({E, game, area, getState, getTime, getArea, getActor, condition}) => ({
      draw(r) {
        r.queue(110, 120, 0, g =>
          r.box(g, 95, 105, 0, 125, 120, 25, '#9c8f73', '#625f52'));
      },
      update(dt) {},
      dispose() {}
    })
  },
  props: {
    customDesk: ({E, game, r, prop, getState, condition}) => { /* draw */ }
  }
}
```

An area selects `painter:'officeArt'`; a prop selects `painter:'customDesk'`. A factory may also return a plain `draw(r)` function. The context provides public engine APIs and read access to current state/time, plus `getActor(id)` for an actor's adapter record. A painter's optional `area` is its authored area; `getArea()` is the currently active area. Callbacks are registered functions; code strings are never evaluated.

Use `r.queue`, `r.actor`, or `r.sprite` for overlapping objects so depth sorting is preserved. Use engine `px` primitives for sharp drawing. Ordinary actor rendering remains automatic; custom room painters should not draw the same declared actor again. Keep collision metadata separate and visible in the inspector.

Original inspection media is independent of canvas art: declare an asset `{id,type:'image',src,license}` and reference its ID with an exhibit's `mediaAsset`. The proof case's local `content/dead-letter/assets/seal-guide.svg` is the working original-image example. Use local files and retain licenses; no remote mocap catalog is downloaded at runtime.

## Cue host contract

`scene.cue(cue)` and its alias `applyCue(cue)` accept:

- `{kind:'audio', audio:'named-sound'}`: plays a definition/engine sound.
- `{kind:'pose', actor:'clerk', pose:'wave', expr:'smile', duration:1200}`: temporary override.
- `{kind:'camera', camera:{focus:[160,140,20],zoom:1.1}, duration:1200}`: temporary framing.
- `{kind:'move', actor:'clerk', to:[170,155]}`: returns a Promise resolving `{status:'arrived'|'canceled'|'failed',reason?,actor,hotspot?}`. Actor omission means the player.
- `line`/`dialogue` and `wait`: presented and timed by the host; no canvas-side mutation.

Durations are milliseconds. Movement uses actual bounded navigation and finishes on arrival, not after an arbitrary duration. `resetCamera()` immediately restores the authored camera. `cancelWalk('sequence-canceled')` resolves pending movement as canceled and removes transient pose/camera overrides. The host persists cue checkpoints, controls advancement and skip, and applies gameplay effects through the adventure runtime exactly once. While `state.presentation[state.activeSequence].paused` is true, the adapter freezes its simulation clock, movement, poses, and camera expiry. Engine pause also stops fixed updates.

## Inspection and diagnostics

- `getArea()`, `setArea(id, entranceId?)`, `getDefinition()`.
- `setState(state)`, `setSelected(id)`, `setHighlight(bool)`, `setUIFocus(bool)`; DOM focus blocks world controls while animations continue.
- `drawPortrait(id, canvas)` paints a 64×64 bust and returns `true`; unrelated evidence IDs return `false` with a blank background.
- `projectHotspot(id)` returns world/approach positions, buffer marker/label bounds, and `client`/`labelClient` coordinates for browser picking tests.
- `probe({from:[x,y],to:[x,y],area?})` returns `{reachable,reason,pathDistance}` without moving an actor.
- `diagnostics()` returns area bounds, effective camera, hero, walk status, hotspots, actor pose/appearance/animation data, sampled public rig joints, last notice, and engine errors.
- `setDebug({navigation:true,hotspots:true,camera:true})` draws navigation cells, approach points, and the frame center.
- `place('hotspot'|'actor'|'prop',id,{x,y,z?,walk?})` changes session placement; `placementSnippet(kind,id)` exports the corrected JSON. Write the snippet to the content file to persist it.
- `cancelWalk(reason)`, `dispose()`.

The legacy `game.debug.snapshot()` keys remain `area`, `hero`, `selected`, `moving`, `hotspots`, and `errors`, with `lastNotice` added. The scene tests exercise original approaches, negative bounds, unreachable/stale/canceled interactions, independent content, appearance rules, imported animation, and presentation pause/resume.
