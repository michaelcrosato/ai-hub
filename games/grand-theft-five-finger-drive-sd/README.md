# Grand Theft Five-Finger Drive-SD

An original pixel city caper set in Sunspoke Bay. Three crew members take on MeterMint, a parking company that charges a fee for reading the fee schedule.

Open `index.html` through an HTTP server. No install, build, external asset host, account, or network service is required. From the ai-hub root, run `node scripts/dev.mjs` and open `/games/grand-theft-five-finger-drive-sd/`.

## Play

Start **The Meter Job** from Play. Borrow a car, scout three city routes, choose a quiet service gate or a forceful barrier breach, switch to Teo for the service gantry, copy the ledger in Records, collect the crew, lose the patrols, and reach Broadcast Pier. The city uses an isometric view. Records uses top-down movement. The gantry uses a side-scrolling platform controller.

The crew keeps its health, ammunition, tasks, position and seat when control changes. Companions follow, defend, wait, drive, and rescue downed members. A destroyed car does not end the job: find another one or finish on foot. Repair, ammunition, armor and respray services are at Marigold Garage. Late Lunch and Bad Tow Day provide small optional rewards. A successful job opens free roam.

The title enters a real autonomous demo after **10 seconds without physical input**, including from title Settings and Controls. Any physical input returns to the title before another AI action. Release the interrupting control, then press a fresh confirm to play. Live-game pause never enters the demo. Demo saves and rewards stay in memory.

## Controls

The browser must expose the controller through the standard Gamepad API. A DualSense-style layout is the default. Buttons can be rebound in Controls. This is browser controller support, not a PlayStation console build.

| Action | Controller | Keyboard / mouse |
| --- | --- | --- |
| Move / steer | Left stick | WASD |
| Aim | Right stick | Arrow keys or mouse |
| Aim / brake / reverse | L2 | Right mouse / S |
| Fire / accelerate | R2 | J or left mouse / W |
| Jump / handbrake | Cross | Space |
| Dodge / back | Circle | K / Escape |
| Reload / horn | Square | R |
| Hold interact / enter / exit / revive | Triangle | E |
| Hold crew selector | L1 | Q |
| Choose Mara / Teo / Kit while held | Stick left / up / right | A / W / D |
| Cycle selected companion task while held | Triangle | E |
| Cover | R1 | F |
| Sprint toggle | L3 | Left Shift |
| Active crew skill | R3 | V |
| Weapons | D-pad left / right | Z / C |
| Map / crouch | D-pad up / down | M / Left Control |
| Pause / confirm | Options / Cross | Escape / Enter |

Mara's Grip Focus improves grip and slows the action. Teo's Circuit Cut opens the depot gates and disables cameras. Kit's Steady Nerve tightens weapon spread and resists stagger. Settings include aim and damage assist, assist strength, trigger threshold, sprint/crouch hold or toggle, paged standard or large captions, high-contrast targets, reduced flashes, separate screen-shake strength, sound, music, motion, rebinding and demo sound. Mobile has no touch sticks or gameplay buttons; use it as a store demo.

## More jobs and developer tools

**The Spare Key** is a separate content definition. Choose a compact or van, recover the key at Tow & Go, and deliver the vehicle to the garage. Its test includes a checkpoint restore.

The **developer test yard** has eight stations: movement, six vehicle types, combat and cover, witnesses, police tiers, crew rescue, view portals, and save/lifecycle operations. It uses the same engine and simulation. Fixture setup may reposition objects; the main game and attract director do not use those fixture shortcuts.

`tools/browser.html` exposes browser contracts, a draw benchmark, animation filmstrips, a 30-minute soak, live diagnostics, manual play, and a replay export. The normal game has no developer data screen.

```sh
node tools/validate.mjs
node --test tests/contracts.test.mjs
node tests/mission.mjs 20
node tests/expansion.mjs
node tests/replay.mjs
node tests/runner.mjs
node --expose-gc tests/soak.mjs 14400
```

From the repository root:

```sh
node --test "scripts/**/*.test.mjs"
node scripts/scan.mjs
```

See [QA](docs/QA.md) for actual results and limits, [HANDOFF](docs/HANDOFF.md) for completion status, [ARCHITECTURE](docs/ARCHITECTURE.md) for system contracts, and [AUTHORING](docs/AUTHORING.md) to add content. The full design and acceptance matrix are in [PLAN](docs/PLAN.md).

## Source information

This reference is separate from the engine evaluation.

| Field | Recorded value |
| --- | --- |
| Initial date | 2026-10-16 19:26:03 America/Vancouver; 2026-10-17 UTC |
| SOURCE | Grand Theft Auto V / Grand Theft Auto 5; spiritual inspiration only |
| GAME ENGINE | my-3D2dge 0.46.1, pinned commit `cfa866aa45474868350cad1a7fc015e612f9305f`; full handoff, with documented local extensions |
| Handoff URL | https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff |
| Environment | ChatGPT Work Mode / Codex; Linux x86_64, Bash, Node.js 24.19.0, Python 3.12, Git 2.51; HTML Canvas; cloud Chrome for browser checks |
| Model | OpenAI / Codex based on GPT. The exact model identifier is not exposed. |
| Effort | xhigh was requested. The actual active effort level is not exposed. |

Engine evaluation: [ENGINE-EVALUATION.md](docs/ENGINE-EVALUATION.md). License and asset sources: [ASSET-LICENSES.md](docs/ASSET-LICENSES.md). No Rockstar art, audio, dialogue, map, code, or characters are included.
