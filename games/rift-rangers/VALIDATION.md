# Validation and refinement notes

## Rendering and compatibility

- Three.js is pinned to 0.186.0 for the WebGPU/WebGL2 path.
- `WebGPURenderer` is used first. It selects WebGPU when available and can use its WebGL2 backend as a fallback.
- A separate Three.js 0.162.0 `WebGLRenderer` path is used only when WebGL2 is absent, because current Three.js removed WebGL1 support after r162.
- The modern path uses `RenderPipeline` plus TSL bloom, ACES filmic tone mapping, soft shadows, fog, instanced vegetation, emissive effects, and dynamic resolution scaling.

## Mission refinement

- The first outpost was changed from a visually solid block to two cover wings with a matching center passage in collision.
- Upper-route stair boxes were corrected so every step starts at the ground rather than floating.
- Bridge railings were moved above deck height and given both upper and mid rails.
- Checkpoints activate after the first route section, creek line, and bunker approach. Defeated enemies stay defeated after reinsertion, so checkpoint runback is short and clean.
- The upper bridge gives a weapon-cache reward; the ground route gives armor and health access. Neither route is mandatory.
- The creek slows ground movement slightly but does not force a precision jump.
- Camera zoom is bounded so pinch/wheel input cannot make the player too small or clip the near view.

## Progression refinement

Automated checks model three play styles:

- Speed route: remains level 1 and still has a viable boss time-to-kill.
- Normal ground route: naturally reaches level 2 without grinding.
- Upper exploration route plus its cache: reaches level 3.

The boss is tuned so level 1 can win with sustained hits, while higher levels materially shorten the fight. Checkpoints heal one health point, equipment pickups provide armor/health/grenades, and a death retains XP and defeated enemies.

## Automated checks

Run:

```bash
npm run check
```

This verifies JavaScript syntax, boss time-to-kill limits, XP thresholds, route progression, checkpoint spacing, stair rise, and touch-friendly grenade radius.
