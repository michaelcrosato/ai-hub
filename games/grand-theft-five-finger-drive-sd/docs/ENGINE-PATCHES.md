# Local engine changes

Base: my-3D2dge **0.46.1**, commit `cfa866aa45474868350cad1a7fc015e612f9305f`, `dist/handoff/my-3d2dge.js`.

- Original Git blob: `797c34159e0b1ff7c74bc0ac0127b19dd95e1004`
- Original SHA-256: `41b0ea21462c04d6642683c2c874a4b27094e5fcdbaff56b62a56574419f185d`
- Local SHA-256: `e90bb09b103394e65c7e141c6432b62aef9426540facf661adf1b351c020a588`
- Local file: `engine/my-3d2dge.js`; original MIT text: `engine/LICENSE`

| Change | Reason | Verification |
| --- | --- | --- |
| `Input.padValues` | Retain analog triggers; clear values when a pad goes away | Analog-only and secondary-pad interruption tests |
| `Input.sourceFrame(source)` | Return copied held/pressed/released state, axes and values | Real key action-frame interaction and replay tests |
| `Game.onFrameTime(seconds)` in real and headless advance | Title idle timing must continue through a paused menu | 9.9/10.0 boundary, menu idle, live pause tests |
| `Game.onInputFrame` after hardware sampling and before Shell/pause | A physical demo exit must win over bot/game input | All input families, held-input and neutral guard tests |
| `Audio._voice` optional `maxVoices` admission | Bound scheduled/active synth voices at the game's 24-voice budget | Reject a 25th concurrent voice and admit one after expiry |
| `Shell` screen spec `settingKeys` | Reuse engine controls on short setting pages instead of a long scrolling list | Browser row/action counts and controller navigation |
| `TileMap.queueWalls` conservative inverse-view tile bounds | Avoid scanning 19,200 cells every frame | Compare exact queued tiles with original scan in iso/top-down at multiple camera positions |

The input hook can return false to stop that simulation step. The frame-time hook is observational and receives unscaled real time. The source string labels the caller's frame; it is not a proof that arbitrary injected input came from hardware. The game therefore has a separate physical observer.

No engine movement, damage, world state, simulation rate or projection is replaced. Keep the original pin when upgrading. Reapply these changes deliberately and rerun contracts, all mission branches, replay, browser rendering and soak tests. Do not fetch a moving `main` engine at runtime.
