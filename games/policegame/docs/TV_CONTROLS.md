# Last Watch: controller-first play

Last Watch is designed around a standard-mapped PS5 DualSense controller and a television-sized display. The scene fills the entire browser viewport. The objective, controller prompts, interactions and menus appear over that scene; opening an interaction does not resize the world into a bordered panel.

## Controls

| DualSense control | At the scene | In an interaction or menu |
| --- | --- | --- |
| Left stick | Walk | Move between choices |
| D-pad | Walk | Move between choices |
| Cross × | Approach / investigate the selected point | Confirm the focused choice |
| Circle ○ | Cancel the current approach | Back / close |
| Square □ | Field kit | Open the field kit |
| Triangle △ | Case notebook | Open the case notebook |
| L1 / R1 | Select the previous / next point of interest | Switch notebook tabs; return to the scene first to choose another target |
| Hold R2 | Reveal all scene markers | — |
| Touchpad click | Location map | Open the location map |
| Options | Pause menu | Pause / resume |
| Right stick | — | Scroll longer notebook and menu content |

The map is also available from the pause menu for controllers or browsers that do not expose touchpad click as standard button 17. Hold movement to walk; confirmation uses a button press edge, so holding Cross cannot silently select several successive choices.

The current scene target and the focused menu choice have a visible highlight. Cross approaches the selected target and opens its available actions. Circle closes an interaction or cancels an approach. L1/R1 choose targets without changing location; choose a destination in the map to travel.

## Reading and presentation

- The world remains the full-screen background, including while menus are open.
- A compact objective and contextual prompts replace the permanently reserved desktop dashboard.
- Interaction text and menu choices use larger type and a high-contrast focus treatment suitable for television use.
- Menus scroll within the display. The right stick scrolls long reading surfaces without moving the officer.
- Landscape is the primary television layout. Portrait and short mobile landscape retain full-viewport scenes and accessible overlay controls.

## Mouse, keyboard and touch

Visible buttons remain clickable and tappable. Scene markers still support direct approach, and the on-screen map, field kit and notebook controls remain available. Keyboard navigation and conventional button activation continue to work. The controller scheme is the presentation default even before a gamepad is connected.

Browser support and physical controller mapping vary. The game uses the browser Gamepad API with standard mapping, not a native PlayStation SDK; it does not require haptics, adaptive triggers or PlayStation account services. Fullscreen and audio must follow browser gesture rules. In a fresh Chromium session, simulated controller-only startup leaves Web Audio suspended until a keyboard or pointer gesture unlocks it; physical controller behavior needs device verification.

## Verification

Run a static server for `dist`, then:

```sh
node tests/browser-tv.mjs
```

The acceptance test uses a simulated standard-mapped DualSense through `navigator.getGamepads`. Its complete Pier 17 route sends only gamepad input: it never clicks DOM buttons or mutates gameplay state to advance the case. DOM and runtime diagnostics are read to identify the desired target and focused control. Separate checks exercise mouse and mobile touch fallbacks.

The test covers the complete 100-point / 21-exhibit case, location-map travel, action selection, clock and timeline puzzles, field-kit and notebook access, pause, confirmation holds, save reload, scrolling, full-viewport rendering at 1080p and 4K, portrait and short landscape, and browser error reporting. It also completes the independent Dead Letter case entirely by controller, including its conversation graph, consumable item, puzzle retries and presentation controls. Generated screenshots and the machine-readable report are saved under `.qa/tv-*`.

Physical DualSense hardware, a real television viewing distance, Samsung S25 hardware and RTX 3060 Ti performance require device testing. Headless Chromium checks do not establish those physical-device results.
