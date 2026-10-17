# Adding content

Start with `content/spare-key.js`. Register a new object with `Drive.registerMission(definition)`, include that script after `district.js` and before `app.js`, and the jobs menu discovers it from the registry. Reuse existing goals first. Keep story, coordinates, reward, start point, choice text and vehicle requirements in content. Do not add a switch on a new mission ID in a core system.

A definition has `schema: 1`, `id`, `name`, `reward`, optional `start`, optional `choices`, and `stages`. Each stage has `id`, `kind`, an optional named `target`, `title`, `line`, and `save`. A vehicle choice can set `vehicle` to one of the registered six types. Goals reference the shared points table. An interaction sets its registered world flag; mission validation consumes the flag. New interaction verbs extend the shared `G.interactions` / `G.interact` contract, validation and director adapter together, not an arbitrary mission callback.

| Goal | Meaning |
| --- | --- |
| interact | A completed named interaction flag |
| vehicle | In a vehicle; honor the selected type when a choice requires one |
| reach | Enter the target radius; optionally require a vehicle |
| entry | Open either depot gate |
| flag | A world fact, such as relay or ledger |
| gather | Living crew together near pickup with a vehicle available |
| escape | Reach an escape road and lose heat |
| deliver | Living crew together at destination with no heat; main job also needs ledger |

The AI goal adapter lives in `director.js`. Content authors use supported goal kinds and targets. A new kind needs a validator, human interaction, AI adapter, save representation and a test before content uses it. Do not make the AI bypass a validator.

Add map geometry through TileMap/PlatformMap and register portals with stable anchors. Keep car routes clear for the full body, not only its center. Place interaction points outside solid geometry and avoid overlapping points whose nearest prompt would select the wrong action. Validate both ends of each portal, with inventory, tasks and vehicles retained.

Add a vehicle by supplying name, dimensions, speed, acceleration, grip, HP, color, seats and a shape family. Keep the compound collider aligned with the rendered body. Add a weapon by supplying magazine, reserve, cadence, reload, damage, range, spread and pellets. All weapon damage goes through the common pipeline.

For a level change, run contracts and both approaches/routes. For a mission addition, run it through normal AI completion, checkpoint restore and payout. Test at least one fail/retry. Inspect all views in the browser. Keep the developer yard useful by adding a relevant fixture when a new engine contract is introduced. Keep the default game screen free of debug controls.

`The Spare Key` proves the existing interact/vehicle/deliver verbs with a separate start, compact/van choice, tow-key recovery and garage payout. The test verifies a restore between recovery and delivery. Any change to core support made while establishing the generic schema must be finished before treating a later content fixture as proof.

## Validate before play

Run `node tools/validate.mjs`. Startup checks schemas, stable IDs, references, goal kinds, vehicle choices, numeric definitions and budgets. `registerMission` rejects duplicate IDs. The map validator rejects blocked starts and unreachable ordinary ground goals with a flood fill. Gate and flag stages are checked by their real portal/interaction integration tests because their accessibility changes during the mission.

```js
Drive.registerMission({
  schema: 1, id: 'garage-pickup', name: 'GARAGE PICKUP', reward: 250,
  start: { x: 420, y: 720 },
  stages: [
    { id: 'brief', kind: 'interact', target: 'brief', title: 'Take the job' },
    { id: 'wheels', kind: 'vehicle', target: 'valet', title: 'Find transport' },
    { id: 'return', kind: 'deliver', target: 'shop', title: 'Return to the garage' }
  ]
});
```

The three current zone IDs are controller roles: `city` for the isometric district, `records` for the top-down room and `gantry` for the side area. Their authored geometry is in `buildMaps()` in the content file. This slice proves new missions on those roles; it does not claim an arbitrary-world editor or streaming district loader. New controller types need an explicit adapter and transition test.

The long soak uses native Node execution of the same local scripts to avoid VM-context overhead. `node tests/runner.mjs` first compares a complete seed-552 mission against the isolated VM runner, including the final state hash. Keep the isolated runner for contract and seeded regression tests. Neither runner changes the simulation rate or skips gameplay.
