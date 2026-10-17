# Grand Theft Five-Finger Drive-SD

## 1. Plan status and implementation handoff

**Project ID:** `grand-theft-five-finger-drive-sd`

**Display name:** `[Grand Theft Five-Finger Drive-SD]`

**Level:** Palm Quay — The Meter Job

**Plan version:** 1.0

**Status:** Implemented and published; production smoke checks pass. See [HANDOFF](HANDOFF.md) and [QA](QA.md) for stage-by-stage evidence and the exact unmet hardware/manual/performance gates. The original requirements below remain the acceptance baseline; the goal is not declared fully cleared while those gates remain open.

Build an original urban action game. Plan a heist, move between three crew members, take a vehicle, complete the job, and escape the police. Use pixel art and an isometric view as the main presentation. Use top-down and side-scroll areas to support specific parts of the same mission.

Implement this plan with the same model selected for the planning session. Set reasoning effort to **xhigh** before execution. The current session does not expose a confirmed model identifier or effort setting. This plan does not claim that a model change has occurred.

Use xhigh for the full implementation. The main risks are input ownership, vehicle collision, crew state, mission state, and save recovery. These risks justify sustained reasoning. There is no measured reason to use max or an unconfirmed “ultracode” mode for all work. Consider a higher available setting only if a reproducible failure remains after a focused investigation. Preserve the selected model unless the user directs a change.

Complete every required stage. Do not stop after a prototype, a screenshot, or an automated drive sequence. The final result must support a complete human playthrough, a complete autonomous demo loop, and content expansion through tested data contracts.

This document began as the planning handoff. Implementation is now in this game folder. The original 50-title list and source pin remain intact. Runtime decisions and verified results are recorded in the linked handoff and QA documents.

## 2. Source information

Keep this section separate from the engine evaluation. Copy its confirmed facts into the source README, the game's HTML source, and the final implementation chat. Update the implementation environment after checking it.

| Field | Confirmed information |
| --- | --- |
| Initial Date | 2026-10-16, America/Vancouver. The first prompt arrived at 19:26:03 PDT. The corresponding UTC date is 2026-10-17. |
| SOURCE | Grand Theft Auto V / Grand Theft Auto 5. This is a design reference for an original spiritual successor. |
| GAME ENGINE | my-3D2dge, version 0.46.1. Use the full engine from the supplied handoff. |
| Handoff URL | <https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff> |
| Engine revision inspected | `cfa866aa45474868350cad1a7fc015e612f9305f` |
| Target repository | <https://github.com/michaelcrosato/ai-hub> |
| ai-hub revision inspected | `988e6b7944cac4b14753d19b0f2abc074a95887e` |
| Environment | ChatGPT Work Mode / Codex. Linux x86_64, kernel 6.18.55. Bash CLI. GitHub connector available. Network access is restricted. |
| Tools observed | Git 2.51.1, Node.js 24.19.0, npm 11.9.0, Python 3.12.14. The `gh` command was not found. |
| Browser | No browser was used to run the engine during planning. Browser and controller compatibility are untested. Plan for Chromium first, then Firefox and WebKit where available. |
| AI lab | OpenAI. |
| Model and Effort Level | Codex, based on GPT. The exact model identifier and current effort level are not exposed. Do not infer them from repository files or model menus. Requested implementation effort: xhigh. |

The engine root package and the handoff README both report version 0.46.1. Pin the inspected commit. If an update is needed, record the reason, the new revision, and the results of the contract tests.

## 3. Title generation and selection

The following 50 candidate titles were created for this task.

| No. | Candidate | No. | Candidate |
| --- | --- | --- | --- |
| 1 | Grand Shift Auto | 26 | Grand Hitch Auto |
| 2 | Grand Theft Otto | 27 | Grand Mischief Auto |
| 3 | Grand Theft Jalopy | 28 | Grand Kerfuffle Auto |
| 4 | Grand Theft Taco | 29 | Grand Mayhem Motor |
| 5 | Grand Detour Auto | 30 | Grand Getaway Auto |
| 6 | Grand Theft Almost | 31 | Grand Theft Afterhours |
| 7 | Grand Theft Pedal | 32 | Grand Theft Overtime |
| 8 | Grand Theft Turbo | 33 | Grand Theft Rushhour |
| 9 | Grand Theft Cargo | 34 | Grand Theft Parking |
| 10 | Grand Theft Carpool | 35 | Grand Theft Gridlock |
| 11 | Grand Theft Bumper | 36 | Grand Theft Detour |
| 12 | Grand Theft Cab | 37 | Grand Theft Sideways |
| 13 | Grand Theft Scooter | 38 | Grand Theft Handbrake |
| 14 | Grand Theft Go-Kart | 39 | Grand Theft Backfire |
| 15 | Grand Theft Roundabout | 40 | Grand Theft Streetwise |
| 16 | Grand Theft Rustbucket | 41 | Grand Theft Highfive |
| 17 | Grand Theft Clunker | 42 | Grand Theft Five-ish |
| 18 | Grand Theft Honk | 43 | Grand Theft Fivefold |
| 19 | Grand Theft Valet | 44 | Grand Theft Five Minutes |
| 20 | Grand Theft Towtruck | 45 | Grand Theft Fifth Gear |
| 21 | Grand Borrow Auto | 46 | Grand Theft Five Blocks |
| 22 | Grand Drift Auto | 47 | Grand Theft Five-Star Fiasco |
| 23 | Grand Grift Auto | 48 | Grand Theft Five-Finger Drive |
| 24 | Grand Lift Auto | 49 | Grand Theft Five More Miles |
| 25 | Grand Gift Auto | 50 | Grand Theft Five O'Clock |

Selection used Python `secrets.randbelow(50)`. The result was candidate **48**. Two independent draws from `A–Z` and `0–9` produced **SD**. The title is **Grand Theft Five-Finger Drive-SD**.

The inspected `games/` directory contains 697 entries. No entry matched the selected title or proposed project path. GitHub code search returned no match for “Grand Theft Five-Finger Drive”. This is a planning check, not a reservation. The whole-repository recursive tree request failed. Before creation, check all tracked paths and catalogue titles in the current checkout, case-insensitively. If the exact title or slug already exists, keep candidate 48 and draw a new two-character suffix. Update all references together. A two-character suffix alone does not guarantee uniqueness.

Proposed path: `games/grand-theft-five-finger-drive-sd/index.html`.

## 4. Design goals and scope

### 4.1 What makes this game distinctive

| Source characteristic | Original implementation | Improvement to prove |
| --- | --- | --- |
| Freedom to move between walking and driving | Enter, drive, abandon, and replace vehicles across Palm Quay | One clear interaction prompt and reliable exit placement |
| Three protagonists | Three persistent crew members with different skills and duties | Fast switching, readable status, and useful companion AI |
| Heist preparation and payoff | Select a quiet or forceful depot entry, prepare a vehicle, take a ledger, and escape | Short preparation with visible effects on the mission |
| Police escalation | Witness reports, last known positions, searches, pursuit, and roadblocks | Explain why heat rose and how to lose it |
| A city with independent activity | Traffic, pedestrians, guards, shops, and small incidents | Small numbers of actors with clear, consistent reactions |
| Crime satire and a coastal atmosphere | A private parking company sells the city's roads back to its residents | Original characters, businesses, dialogue, signs, and music |
| Emergent action | Collision, noise, damage, crew decisions, and missions share events | Recover from an unexpected event without a mission dead end |

Use the source's broad design qualities. Create new maps, names, characters, dialogue, logos, vehicles, art, and audio. Keep all action fictional and stylized.

### 4.2 Required content

- One polished district with a complete 12–18 minute first playthrough. A practiced run should take about 8–12 minutes.
- One heist mission with two entry approaches and two escape routes.
- Three playable crew members who remain active when the player switches away.
- Six vehicle definitions built from at least four clear silhouettes.
- Three weapon definitions, melee, cover, damage, recovery, and defeat.
- Pedestrian, traffic, guard, and police behavior.
- One service shop, one short optional delivery, and one optional street incident.
- A complete title, settings, pause, checkpoint, failure, results, and replay flow.
- An autonomous attract loop with no fixed end.
- One small developer test yard and one alternate mission fixture, both loaded through the same content contracts.
- Source, tests, authoring instructions, engine evaluation, and release evidence.

### 4.3 Scope boundary

The foundation supports this game's urban action systems. Further districts, missions, vehicles, weapons, crew profiles, dialogue, and incident types must fit its registries. Aircraft, boats, online play, a property market, a large campaign, and a full city editor are outside this slice. Do not add unused interfaces for them. Add engine systems when the slice or the expansion test needs them.

## 5. The level: Palm Quay — The Meter Job

### 5.1 Premise and crew

The city of Sunspoke Bay gave MeterMint control of its public parking. The company now fines residents for stopping at traffic lights. A crew will take the company's payment ledger from a depot and deliver it to an independent broadcaster.

| Crew member | Role | Active ability | Companion duty |
| --- | --- | --- | --- |
| Mara Quinn | Driver | Grip Focus: a short reduction in time scale, with better steering control | Drive to a designated pickup point and keep an escape route open |
| Teo Banks | Operator | Circuit Cut: temporarily disable a nearby camera or powered gate through an interaction | Work on the depot terminal while the crew protects the area |
| Kit Vega | Protector | Steady Nerve: a short aim and stagger-resistance benefit | Follow, use cover, defend a point, and help a downed crew member |

These are complete abilities with input, duration, cooldown, feedback, tests, and AI use. They do not replace the shared movement or damage systems. Give each person a different silhouette, palette, voice text, and movement feel.

### 5.2 Space and routes

Use a compact exterior map of about 256 × 192 tiles. One tile equals 16 engine world units. Tune the final dimensions after the first drive test. Arrange nine blocks around a road loop. Give the player at least three connections across the district.

| Area | Purpose | View | Required features |
| --- | --- | --- | --- |
| Marigold Garage | Start, vehicle preparation, and recovery | Isometric | Crew briefing, service station, checkpoint |
| Boardwalk Avenue | Learn to drive and observe city reactions | Isometric | Traffic signals, crossings, pedestrians, a delivery pickup |
| Valet Court | Take the mission vehicle | Isometric | Parked and occupied cars, witnesses, alternate access |
| MeterMint Depot | Enter the compound and reach the records room | Isometric exterior; top-down interior | Cameras, guards, gates, cover, a service terminal |
| Service Gantry | Reach the security relay | Side-scroll | Ladder, short jump, lift, moving obstacle, return portal |
| Canal Road | Break pursuit | Isometric | Tight turns, breakable barriers, concealment, a roadblock |
| Market Loop | Alternate escape | Isometric | Traffic, a vehicle exchange, a guarded shortcut |
| Broadcast Pier | Deliver the ledger | Isometric | Final trigger, results, return to free roam |

Use isometric presentation for at least 75% of normal mission play. Make the depot records room a compact top-down area, about 32 × 24 tiles. Make the service gantry a short side-scroll area, about 80 × 18 tiles. The player must use all three views during a normal successful run. The gantry sequence should take about 45–75 seconds.

The exterior has persistent entity and mission state. Interior portals transfer the active actor through named spawn anchors. They do not discard inventory, health, crew duties, police evidence, or the mission state. Use an explicit side-area coordinate adapter. Do not turn a ground map into a side map with a camera change alone.

### 5.3 Mission sequence

| Stage | Player action | Systems proved | Checkpoint and recovery |
| --- | --- | --- | --- |
| M0: Briefing | Meet the crew and choose quiet or forceful entry | Dialogue choice, crew setup, mission graph | Save after the choice |
| M1: Wheels | Take a suitable car from Valet Court | Occupancy, interaction, witnesses, driving | Any valid replacement car can satisfy this stage |
| M2: Preparation | Reach the depot and position the crew | Navigation, companion orders, route markers | Save at the staging area |
| M3: Entry | Use a service access path or break the front barrier | Perception, gates, collision, heat | The other approach stays available if the first fails |
| M4: Relay | Switch to Teo and control him through the gantry to the relay | Side controller, hazards, moving lift, ability | Restore the relay-entry checkpoint on a fall or crew wipe |
| M5: Records | Enter the top-down records room and take the ledger | Combat or stealth, terminal, cover, objective pickup | Save the ledger state once, with a unique transaction ID |
| M6: Getaway | Return to the street and collect the crew | Crew switching, driver AI, seat reservations | Recover a stranded crew member or change the pickup point |
| M7: Lose the tail | Escape through Canal Road or Market Loop | Search, pursuit, traffic, vehicle damage, vehicle exchange | A destroyed escape car does not end the mission by itself |
| M8: Delivery | Reach Broadcast Pier after heat clears | Mission predicates, payout, results, save | Record completion and payout once |

Quiet entry reduces initial heat and guard response. Forceful entry is faster but adds a police response and a locked service route. Both approaches use the same mission graph and interaction verbs. They converge at the relay. Failed stealth converts to action. It does not show a failure screen.

At the relay stage, prompt the player to switch to Teo at his actual location. Do not move him to the relay on selection. The other crew members defend the staging point or prepare the pickup. The first full mission run must include active control in the gantry and records room. Companion duties must not bypass those view demonstrations.

Mission success requires the ledger, all living crew at extraction, and no active pursuit. A crew member can be downed and revived. If the crew cannot recover, show a clear failure reason and offer the last safe checkpoint. Arrest requires police proximity, line of sight, and a short hold condition; it is not a random timer.

### 5.4 Free roam and optional activity

After the mission, return to the district with the outcome stored. Allow replay from the garage. Include these small loops:

- **Late Lunch:** collect food and deliver it with a time bonus. Use the same mission verbs and vehicle systems.
- **Bad Tow Day:** stop a staged vehicle dispute. Resolve it through an interaction or a short fight. Civilian harm reduces the reward.
- **Garage service:** spend earned cash on a repair, ammunition, or a cosmetic paint choice. State the price and result before purchase.

Reward control, clean driving, limited damage, optional work, and crew survival. Use one results screen with no more than four main values. Do not add a long inventory grid or a separate management game.

## 6. Player-facing systems

### 6.1 Movement and interaction

Use `E.Mover` for ground movement and parkour. Use `E.Platformer` for the gantry. Keep one actor identity above these controllers. Convert screen movement to the ground plane with the active engine view.

Provide walk, sprint, crouch, jump or vault, dodge, cover entry, and cover exit. Display one highest-priority interaction prompt. Rank candidates by reach, line of sight, angle, and importance. An interaction token reserves a target until the action ends or cancels. This prevents two crew members from opening the same door or taking the same seat.

### 6.2 Vehicles

Required definitions: compact car, sports coupe, delivery van, taxi, police sedan, and armored depot van. Taxi and police variants can share a base body, but need distinct signals and handling.

Implement acceleration, braking, reverse, speed-dependent steering, lateral grip, handbrake, collision impulse, damage, tire marks, lamps, and speed-based sound. Use arcade handling with stable low-speed control. Initial tuning ranges are 180–320 world units/s for top speed. Treat these as tuning values, not acceptance facts.

Implement empty and occupied vehicle entry. Occupied entry needs a short visible action and can create a witness report. Reserve the requested seat. Cancel safely if the actor is hit or the vehicle leaves reach. Entering a vehicle transfers control; it does not create a duplicate player body.

For exit, test several door-side positions against static and dynamic collision. If no position is safe, keep the player seated and show “Exit blocked”. Use a speed limit or a deliberate hold for a moving exit. Never place an actor inside a wall or under a car.

Use a swept oriented footprint or a tested compound collider. `E.Body` is a useful integration base, but its circular collision does not by itself provide vehicle handling or a car-shaped collision test. Bound each collision substep by motion relative to collider size. Apply collision damage once per impact event, with a cooldown for resting contact.

### 6.3 Traffic and pedestrians

Author a lane graph with intersections, signals, stop lines, parking points, and emergency pull-over positions. Traffic follows lanes, brakes for obstacles, yields at intersections, and recovers from a blocked route. Traffic does not use pedestrian flow fields.

Pedestrians use sidewalk paths, crossings, idle destinations, and reactions to noise or danger. A witness must observe an event, start a report, and complete it before dispatch receives the report. Show the reporting state. Guards investigate sounds and last known positions. Crowd reactions should spread locally through events, with a bounded radius.

Use spawn and population budgets. Spawn outside the current view and outside a protected radius around mission actors. Keep named actors, occupied vehicles, mission vehicles, evidence, and recent pursuers persistent. Do not remove them because the camera moved.

### 6.4 Police and heat

Use five named heat tiers, 0–4, with a clear icon and text. Implement escalation through observed vehicle theft, assault, gunfire, major collision, and mission alarms. Define severity and cooldowns in data.

Police state: `patrol → investigate → pursue → search → disengage`. Search uses the last confirmed location and vehicle description. A hidden player can change vehicles to reduce recognition, but visible switching does not clear pursuit. Police share confirmed sightings within a limited dispatch system. They do not use the player's exact hidden position.

Higher heat changes unit count, search radius, tactics, and roadblocks. Cap active units. Lose heat only after line of sight is broken and the search period ends. Show “Seen”, “Searching”, and “Clear” states. Give roadblocks a visible approach distance and a bypass route.

### 6.5 Combat, health, and crew

Provide a pistol, a compact automatic weapon, and a short-range shotgun. Add ammunition, reload, cooldown, spread, range, damage, and a clear low-ammunition cue. Use engine bullets where they meet the collision contract. Add swept segment checks for fast bullets and moving vehicle targets.

Use one damage service for firearms, melee, collision, hazards, and explosions. It applies team rules, armor, stagger, invulnerability windows, health, downed state, death, evidence, and rewards in a fixed order. Add cover edges and a short enter/leave action. Aim assist respects line of sight, range, and the player's aim direction.

Crew switching transfers control between existing actors. It keeps their health, ammunition, cooldowns, seats, tasks, and location. Companion AI supports follow, hold, defend, drive-to-pickup, operate, and revive. A paused wheel can slow time briefly, but the same clock policy must apply to every actor. No companion receives hidden teleportation or unlimited ammunition in normal play.

### 6.6 Save and recovery

Keep profile settings, progression, and mission checkpoints separate. Use a project-specific key prefix. Store schema version, game version, engine revision, content version, seed, RNG states, mission nodes, stable entity IDs, crew states, vehicle occupancy, rewards, and persistent world changes.

Use validated data objects, not serialized engine instances. Rebuild runtime objects through factories, then resolve IDs. Keep one last-known-good checkpoint. Write after safe milestones and transactions, never from the render loop. Do not rely on page close. Handle blocked storage, quota errors, malformed data, and a newer save version without a crash.

Use two versioned save slots with generation numbers. Write and validate the new slot before changing the active-slot pointer. On load, recover the newest valid complete slot if the pointer or the latest write is invalid. Test interruption between these writes.

Checkpoint restore must remove transient projectiles, timers, listeners, dialogue, target locks, and input state. Use transaction IDs to prevent duplicate payouts and purchases. Ask before a player deliberately deletes or replaces saved progress. Demo mode must not write progression or checkpoints.

## 7. Controller-first interface

### 7.1 Input model

Use a PS5-compatible controller through the browser Gamepad API as the primary input. Standard gamepad mapping is the baseline. Do not require a touchpad gesture, adaptive trigger, or a platform-specific controller extension. Enable ordinary vibration only when supported. A missing vibration device must not affect play.

Use one action model for controller, keyboard, mouse, AI, and tests. Menus retain the engine's reserved confirm, cancel, and direction controls. Gameplay uses an explicit context so a weapon-selection button cannot also move an actor.

| Action | PS5 layout | Keyboard / mouse | Vehicle context |
| --- | --- | --- | --- |
| Move | Left stick | WASD | Steer |
| Aim | Right stick | Arrow keys or mouse position | Aim for an active passenger; look ahead for a driver |
| Jump / vault | Cross | Space | Handbrake |
| Dodge / leave cover | Circle | K | Cancel a pending interaction |
| Reload | Square | R | Horn for the driver |
| Interact | Triangle | E | Enter or exit; reserve a safe exit |
| Crew selector | Hold L1 | Hold Q | Same crew selector |
| Cover | R1 | F | No driver action |
| Aim modifier | L2 | Right mouse button | Brake, then reverse at low speed |
| Fire | R2 | J or left mouse button | Accelerate for the driver; fire for a passenger |
| Sprint toggle | L3 | Shift | No separate action |
| Character ability | R3 | V | Apply the active character's valid ability |
| Previous / next weapon | D-pad left / right | Z / C | Passenger weapon selection |
| Map | D-pad up | M | Map |
| Crouch toggle | D-pad down | Control | No separate action |
| Pause | Options | Escape | Pause |
| Menu navigation | D-pad or left stick | Arrows or WASD | Same |
| Confirm / back | Cross / Circle | Enter / Escape | Same |

The crew selector shows three portraits. Hold its action, move to a portrait, then release to select. Cancel leaves the current actor selected. Slow the world consistently while it is open. Clear held gameplay actions at entry and exit.

For keyboard driving, use A/D to steer, W to accelerate, and S to brake or reverse. Space remains the handbrake. These keys produce the same steer, throttle, and brake actions as the controller. A passenger uses the normal aim and fire controls.

The engine's default direction actions include arrows and D-pad input. The game adapter must separate those from gameplay movement. Keep arrow aiming and D-pad equipment actions from leaking into movement. Preserve all reserved menu controls and rebinding. Read prompts from action bindings with `input.label()` or the equivalent adapter label function.

Add radial dead zones, trigger thresholds, stick inversion, aim-assist strength, hold/toggle choices, and vibration settings. Begin with a stick dead zone of 0.18 and a trigger activity threshold of 0.08. Let the settings override these values. Device changes must not cause prompt flicker from small stick noise.

### 7.2 Ten-foot layout

Use a 480 × 270 logical pixel buffer as the initial target. At 1920 × 1080, it scales by four. Keep pixel scaling sharp. Use an adaptive canvas within tested bounds for other aspect ratios. Test the final character size and road visibility before fixing camera zoom.

- Title: large original logo, an animated district view, and at most four visible main choices: Play, Watch Demo, Settings, Credits.
- Play submenu: Continue, New Run, and Free Roam when unlocked.
- HUD: compact crew health, ammunition, heat state, one objective, and a small route map. Hide elements when they are not useful.
- Prompts: one action and one short verb. Avoid paragraphs during action.
- Subtitles: no more than two lines, with a speaker name and a high-contrast backing.
- Menus: clear focus, large spacing, no hover requirement, no scrolling data grid, and no more than six choices per page.
- Settings: use the engine's standard settings and controls. Group game-specific options into short pages. Adjust spacing and focus behavior locally if needed.
- Results: outcome, payout, damage cost, and optional-objective result. Offer Retry, Free Roam, and Title.

Keep important UI within a 5% safe margin. At 1080p output, target at least 32-pixel main labels and 28-pixel subtitles. Confirm the actual rendered size. Test a 55-inch TV at about three metres if hardware is available. Otherwise record that physical viewing-distance test as unperformed and review the 1080p layout at reduced display size.

Use shapes, labels, and patterns with color. Include reduced motion, reduced flashes, screen-shake control, high-contrast targets, subtitle size, aim assist, and a forgiving difficulty option. Map and pause screens must return control without a stray shot or menu action.

### 7.3 Mobile behavior

Mobile devices run the store demo by default. Render the game scene without a touch stick, gameplay buttons, or a dense HUD. The only persistent touch control may be a small settings/menu button. Do not build a mobile control system.

A touch during the demo returns to the title immediately. The title waits for the same 10-second idle period, then restarts the demo. A connected controller or keyboard can select manual play. Keep the gantry and other game scenes automatic when no such device is present. The first settings touch can unlock audio when the browser allows it.

Disable touch controls through the engine's input settings and scene configuration. Check again after settings load, after a scene change, and after restore. A saved setting must not recreate a touch stick. Keep any required corner menu while hiding extra full-screen buttons on the mobile game view.

## 8. Autonomous attract mode

This is required game behavior, not a video or a camera tour. The bot must use the same movement, driving, interaction, combat, crew, mission, and recovery systems as the player.

### 8.1 State contract

| State | Entry | Exit | Required behavior |
| --- | --- | --- | --- |
| Title idle | Boot, quit, or demo interruption | Manual selection or 10 seconds without physical input | Keep a visible, unscaled idle clock |
| Demo loading | Idle deadline or Watch Demo | New isolated world ready | Use an in-memory save provider and a known valid scenario |
| Demo running | Scenario ready | Physical input, win, defeat, or recovery timeout | Bot controls the shared action pipeline |
| Demo reset | Scenario ends or cannot recover | Next scenario ready | Dispose of the old world and load a clean seed |
| Return to title | Any physical input during a demo | Title shown | Cancel bot input, stop rumble, clear transients, and consume the exit input |

The 10-second clock applies to the title and its child menus, including Settings and Controls. Applied settings remain applied if an idle menu returns to the demo. Do not begin an attract loop from a paused live game or a disconnect pause. Track the title timer outside scene simulation updates, since a menu can stop those updates.

Measure visible, focused elapsed time with a monotonic real-time source. The timer must not depend on `game.timeScale`, simulation ticks, music, or animation. Suspend it while the page is hidden. At `10.0` seconds, enter the demo on the next available update. Do not insert a second delay.

### 8.2 Physical input and bot input

Add an explicit physical-input activity record before AI commands are applied. Keyboard events, pointer movement, pointer buttons, wheel events, touch events, controller buttons, both sticks, and analog triggers can count as activity. Monitor all connected pads for demo interruption, even if one pad owns gameplay.

Ignore neutral stick noise and trigger noise below the configured thresholds. A held input keeps the title active. A new valid physical event during demo exits on the next input poll and before the bot's next gameplay command. Target no more than one displayed frame from detection to the title on a foreground 60 Hz page.

`input.anyPressed()` is insufficient by itself. It reports mapped action presses, and the engine also accepts simulated presses. It does not provide the required source distinction or every analog activity signal.

After exit, clear input and require neutral controls before accepting a new confirm press. The same button that stops the demo must not start a game. Do not rely only on `Event.isTrusted`: controller polling and test injection need an explicit source contract. Tests inject activity into the hardware adapter boundary. Production AI never uses that boundary.

### 8.3 Demo content

Create a loop of three curated scenarios, each about 120–180 seconds:

1. **City and wheels:** leave the garage, take a car, drive through traffic, and escape a low-level response.
2. **Crew and heist:** switch crew, use the relay, enter the records room, demonstrate cover, and take the ledger.
3. **Getaway:** collect the crew, drive through a pursuit, exchange vehicles, hide, and deliver the ledger.

Scenario starts may load valid authored checkpoints. Once a scenario starts, the bot must complete actions through normal rules. Do not set objectives to complete, warp actors out of collision, use unlimited health, or play canned transforms to imitate gameplay. Reset between scenarios with a short transition. Also provide one full-mission bot run for acceptance testing.

Use a high-level goal planner, pedestrian pathfinding, a driving controller, cover selection, and ordinary combat intent. The planner reads the same observable world and mission data as companion AI. It must replan when a vehicle is blocked, a target moves, or an alarm changes the route.

At five seconds without useful progress, replan. At twelve seconds, use another legal route or action. If the objective remains blocked, restart the scenario from a clean authored checkpoint within twenty seconds. Log the reason for tests. Do not use the watchdog to hide a crash or a consistent broken mechanic.

Repeat indefinitely while there is no input. Vary routes and seeds within a known reliable set. Show a small “DEMO” mark and a short mechanic caption on desktop or TV. Hide these overlays on mobile if needed to preserve the scene-only presentation. Disable rumble in demo mode.

### 8.4 Isolation and browser behavior

The demo world owns its RNG streams, mission graph, entities, timers, subscriptions, and audio voices. Destroy them on reset or exit. Do not write checkpoints, money, unlocks, achievements, or settings from bot activity. Use a temporary audio gain for demo volume instead of changing stored settings.

A clean browser can block audio before a user gesture. The demo must start silently and run normally. Audio may resume after a permitted gesture. Do not wait for audio or force a full-screen request from the idle timer.

Suspend updates and audio when the page is hidden. Resume without a large simulation catch-up. A disconnected controller does not stop an unattended demo. During manual play, retain the engine's disconnect pause. These are explicit session policies.

## 9. Art, animation, and sound

### 9.1 Visual direction

Use a warm coastal district at late afternoon, with cool shadows and strong vehicle colors. Progress toward dusk through a short palette curve. Show palms, stucco walls, a canal, parking meters, a depot, a boardwalk, and original advertisements. Reserve bright warning colors for hazards and police signals.

Use the engine's procedural pixel rigs, material system, shapes, props, lights, and depth queue. Keep true world coordinates under every view. The use of 3D skeleton data inside the pixel engine is compatible with the required 2D presentation. Do not add a first-person or third-person 3D renderer.

Required art groups:

- Three crew designs, at least six pedestrian variants, two guard variants, and two police variants.
- Four base car silhouettes and the six required vehicle definitions. Show wheels, windows, lamps, doors, damage, and occupants where visible.
- Road, sidewalk, canal, depot, office, and gantry materials with consistent scale.
- At least twenty reusable prop definitions. Use the engine's asset store where suitable; keep provenance for each imported set.
- An original title treatment, icon, controller glyphs, target markers, and catalogue cover.
- Tire marks, water highlights, dust, sparks, smoke, debris, muzzle flashes, and hit effects with strict budgets.

Characters should remain readable at roughly 40–60 logical pixels tall in the standard view. Tune scene scale with the actual vehicles and buildings. Review silhouettes on light and dark floors. Use roof cutaways and the engine's x-ray actor option so the player remains visible near buildings.

Long vehicles can cross an actor's depth if drawn as one shape. Test this early. Split the vehicle drawing into depth-aware parts when required. All parts still belong to one vehicle and one collision definition.

### 9.2 Animation requirements

Show distinct idle, walk, sprint, crouch, aim, fire, reload, cover, vault, climb, hit, downed, revive, enter-seat, exit-seat, driving, and victory states. Blend from the current pose. Use engine attacks and actions where they fit. Add only the missing vehicle and weapon poses.

Every important action needs a start cue, a readable active phase, and a return to control. Match bullets to the gun's visible direction. Match feet to motion. Match wheel rotation, steering, body roll, smoke, and brake lamps to vehicle state. Check the transitions with filmstrips.

### 9.3 Sound

Use original engine-synth music and effects. Provide title, free-roam, tension, pursuit, and success arrangements. Crossfade or change layers through music states. Duck music under crew dialogue. Keep audio voices bounded and remove them at world disposal.

Include footsteps by surface, vehicle engine speed, tires, collisions, horns, sirens, gunfire, reload, gates, pickups, menu actions, and mission cues. A simple original car-radio loop is sufficient. Do not rely on licensed source-game tracks. Subtitle all story information. A muted game must remain playable.

## 10. Architecture and engine use

### 10.1 Runtime decisions

Use plain JavaScript with JSDoc types, HTML, and CSS. Use the full my-3D2dge engine and its Canvas pixel renderer. Use Node's test runner for simulation and contracts. Use Playwright from a separate tool environment for browser tests. Keep the ai-hub runtime free of npm dependencies and a build requirement.

Use a project folder with source scripts in a fixed order. Each script registers a small module or content definition. Load content as local JavaScript data, so it needs no runtime `fetch()` or service. The hub already supports a folder with `index.html`. Avoid a bundler for this slice.

Pin the upstream engine file and its MIT license inside the project. Keep local changes small and record each one in `docs/ENGINE-PATCHES.md`. Do not edit a shared hub library or the upstream engine repository as part of this game. An optional later upstream contribution is separate work.

The engine guide recommends a single-file game. Its large-game guide also describes modular authoring. The target hub supports project folders, and this task needs reusable architecture. Use a modular project as the source of truth. A single-file export is optional and must not create a second maintained source tree.

### 10.2 Ownership and modules

| Area | Owns | Engine use |
| --- | --- | --- |
| App and session | Title, manual play, demo, results, disposal, clocks | `E.Game`, scenes, standard menu, boot steps |
| Input adapter | Physical activity, analog values, contexts, action frames | `E.Input`, labels, rebinding, gamepad data |
| World | Stable entities, zones, registries, event queue, RNG | Fixed engine update, `E.rng`, spatial hash |
| World queries | Static and dynamic collision, visibility, reach, navigation filters | TileMap height and ray queries plus local dynamic colliders |
| Characters | Movement, actions, animation, health state | `E.Mover`, `E.Body`, `E.Platformer`, `E.Humanoid` |
| Vehicles | Handling, occupancy, swept collision, damage, visual state | Body integration where suitable; pixel shapes and queue |
| City AI | Traffic, pedestrians, witnesses, guards, police dispatch | `E.FlowField`, `E.sees`, `E.hears`, `E.Suspicion` |
| Combat | Weapon timing, projectiles, damage, cover, explosions | `E.Attack`, `E.Combo`, `E.Bullets`, effects |
| Crew | Control ownership, duties, switching, revive, pickup | Shared character and vehicle controllers |
| Missions | Conditions, actions, branches, checkpoints, rewards | Engine dialogue and menus; game-owned state graph |
| Presentation | Camera, HUD, dialogue, audio, effects | View projection, renderer, `E.Dialog`, `E.Menu`, `E.Shell`, audio |
| Persistence | Save schemas, migration, transaction log, recovery | `E.store` behind a save-provider interface |
| Test and diagnostics | Snapshot, replay, metrics, yard, seed control | `game.advance`, `game.debug`, `game.stateHash`, `E.session` |

Do not build a second render loop, a second simulation clock, or a replacement character renderer. Use a small world runtime around the existing engine. Use plain components and explicit systems; a new general ECS framework is unnecessary.

### 10.3 Simulation order

Use the engine's fixed step of 1/120 second. Rendering must not change game state. Run the following phases in a documented order:

1. Sample physical activity and handle title/demo interruption.
2. Build player, companion, traffic, police, and demo action frames.
3. Validate control ownership, interactions, and crew commands.
4. Advance character actions and vehicle movement; resolve collision.
5. Advance projectiles and resolve damage in stable entity-ID order.
6. Update perception, evidence, heat, and mission predicates.
7. Apply queued entity changes, rewards, and safe checkpoint requests.
8. Update poses, camera targets, sound events, and visual effects.

Navigation and high-level decisions can run at 5–10 Hz through fixed-step counters. All important actors still use the same movement and damage time base. Crew and mission actors continue to update while off camera. Rendering and ambient detail can use distance-based quality levels.

Use independent seeded random streams for traffic, encounters, combat, scenery, and demo choices. Do not use `Math.random()` or wall-clock values in gameplay decisions. Cosmetic randomness must not change mission or traffic outcomes.

### 10.4 Core data contracts

All definitions use stable string IDs and a schema version. Validate references before play. Reject duplicate IDs, missing paths, unknown verbs, invalid spawn points, unreachable goals, and invalid budgets with a useful error.

| Contract | Minimum fields |
| --- | --- |
| ActionFrame | tick, source, actorId, move, aim, steer, throttle, brake, pressed, held, released |
| PhysicalActivity | sequence, monotonicTime, device, control, active; separate from ActionFrame |
| Entity | id, archetypeId, zoneId, transform, controllerId, components |
| VehicleDef | dimensions, seats, handling, health, collision, shape, audio, tags |
| WeaponDef | mode, ammo, reload, cooldown, damage, range, spread, projectile, feedback |
| ActorDef | rig, movement, perception, health, team, behavior, inventory, ability |
| ZoneDef | map type, map data, spawn anchors, portals, lanes, navigation, props, encounters |
| MissionDef | nodes, predicates, actions, transitions, failure rules, checkpoints, rewards |
| SaveEnvelope | schemaVersion, gameVersion, contentVersion, engineCommit, state, checksum or validation fields |
| DemoScenario | initial checkpoint, seed, goals, camera cues, progress rules, reset policy |

Input sources are `physical`, `companion`, `traffic`, `police`, `demo`, and `test`. All use the same legal action checks. Physical activity determines ownership and interruption; AI actions never count as physical activity.

Define units at this boundary. Movement and aim are normalized vectors in the current zone's motion plane. Convert physical screen directions through the view exactly once. Ground zones use x/y; side zones use x/z. Steering is vehicle-relative in the range -1 to 1. Throttle and brake are in the range 0 to 1. Position and velocity stay in world units. A camera change must not rotate an existing vehicle's steering intent or alter stored positions.

Use a small event vocabulary: `interaction.started`, `interaction.completed`, `vehicle.entered`, `vehicle.exited`, `damage.applied`, `actor.downed`, `noise.emitted`, `witness.reported`, `heat.changed`, `zone.entered`, `objective.completed`, `checkpoint.requested`, and `reward.committed`. Each subscription belongs to a session or system and has a disposal method.

### 10.5 Shared collision and zone rules

Create `WorldQueries` as an adapter over engine maps and a dynamic spatial index. Static terrain stays in the engine. Dynamic vehicles, doors, cover, and props declare separate `solid`, `blocksSight`, `blocksShot`, and `blocksNav` flags.

Every relevant system uses the same geometry and height conventions. Bullets cannot pass through cover that blocks sight. A route cannot pass through a closed door. Cars cannot drive through a body because the body uses a different collision list. Update navigation overlays when gates, obstacles, or vehicles change.

Ground zones use x/y for the ground plane and z for height. Side zones use x/z for motion and a fixed depth plane. Keep an actor's canonical ID, health, inventory, and tasks above the controller adapter. Transfer through named portal anchors with validated placements. Add round-trip tests for entry and exit.

Keep the play session and mission graph alive across zone changes. Use `game.go()` for app-level scene transitions. It clears scene timers and particles, so do not use it as an accidental world reset when a crew member enters a room. Encapsulate zone-specific view, map, controller, and effect settings in a zone context.

### 10.6 Proposed project layout

| Path within the project | Purpose |
| --- | --- |
| `index.html` | Playable entry, metadata, script order, source information |
| `README.md` | Run, controls, content, source information, limits, links |
| `engine/my-3d2dge.js` | Pinned full engine with documented local patches |
| `engine/LICENSE` | Upstream MIT license |
| `src/app.js`, `src/session.js` | Startup, session state, demo ownership |
| `src/core/` | IDs, registry, events, RNG, validation, world queries |
| `src/input/` | Action contexts, physical activity, analog adapter |
| `src/systems/` | Characters, vehicles, combat, traffic, police, crew, missions, save |
| `src/presentation/` | Camera, pixel art, poses, HUD, dialogue, sound |
| `content/` | Maps, actors, vehicles, weapons, missions, routes, dialogue, demo scenarios |
| `tests/` | Headless contracts, mission runs, browser tests, fixtures |
| `tools/` | Validation, simulation runner, stress runner, asset review helpers |
| `docs/PLAN.md` | This plan |
| `docs/ARCHITECTURE.md` | Ownership, phase order, contracts, state diagrams |
| `docs/AUTHORING.md` | Add a zone, mission, vehicle, actor, and demo route |
| `docs/ENGINE-EVALUATION.md` | Actual engine use and one proposed improvement |
| `docs/ENGINE-PATCHES.md` | Local changes with reasons and regression checks |
| `docs/QA.md`, `docs/HANDOFF.md` | Evidence, unresolved issues, next-agent entry points |
| `docs/ASSET-LICENSES.md`, `docs/SOURCE-INFO.md` | Provenance and source facts |

## 11. Engine evaluation

The table below preserves the planning review. The completed implementation evaluation, with actual reused and bypassed APIs, findings and the recommended upstream change, is in [ENGINE-EVALUATION](ENGINE-EVALUATION.md). Local patch provenance is in [ENGINE-PATCHES](ENGINE-PATCHES.md); measured results are in [QA](QA.md).

### 11.1 What was used for this plan

Read the handoff README, the API card, the asset card, selected guide and API-index sections, and the input and Body implementations. Read ai-hub's README, package scripts, repository instructions, scanner, and game directory. These reads establish the engine version, available APIs, project-folder support, and the input gap described below.

### 11.2 Planned use and gaps

| Engine area | Plan | Evidence or gap |
| --- | --- | --- |
| Full engine | Use | Contains the standard menu, full assets, lighting, and camera tools |
| Fixed-step Game runtime | Use | 1/120-second steps and headless `advance()` support |
| Isometric and top-down views | Use | Both project the same ground coordinates |
| Side view | Use | Requires PlatformMap and Platformer, with a controller and zone adapter |
| TileMap and height queries | Use | Terrain, portals, sight, ledges, and collision base |
| Mover and actions | Use | Ground movement, vault, climb, crouch, and timed actions |
| Humanoid and attack animation | Use | Crew and NPC rigs; extend missing reload and vehicle poses |
| Shape and material registry | Use | Static props and vehicle art definitions; moving parts remain game code |
| FlowField and perception | Use and extend | Good pedestrian and guard primitives; road lanes and police dispatch remain game systems |
| Bullets and attacks | Use and verify | Add a common damage pipeline and tested dynamic-collider queries |
| Input and standard UI | Use and extend | Standard labels, rebinding, pause, settings, disconnect handling |
| Store | Use behind an interface | JSON persistence exists; migrations, checkpoints, and demo isolation remain game systems |
| Session replay and debug tools | Use | Add a complete state hash and game-specific command evidence |
| Audio and effects | Use | Add original music states, vehicle sounds, and voice limits |
| Agent edition | Do not ship | It omits full menu and asset rendering features needed here |
| 3D engine, FP/3P camera, mocap library | Do not use for this slice | The required presentation is pixel 2D; the procedural rigs cover the planned content |
| WebGPU lighting | Optional after the Canvas version passes | Do not make it a requirement or a replacement renderer |
| Touch gameplay controls | Disable | Mobile is primarily an autonomous store demo |
| Unrelated RPG, puzzle, and shooter starter content | Remove from the delivered game | Use relevant ideas and APIs without shipping unused sample scenes |

The main strength is a compact set of reusable systems with a deterministic clock, multiple projections, and test hooks. This can save substantial work on rendering, movement, menus, and diagnosis.

The main game-specific work is still significant: vehicle handling, oriented collision, road navigation, police dispatch, crew tasks, mission composition, and save recovery. Do not describe these as engine features already supplied. The asset card also documents one-point shape sorting and box-footprint collision. Both need attention for long moving vehicles and nearby actors.

### 11.3 One change to make to the engine

**Add a public input-frame API with explicit source ownership.** It should expose physical activity separately from injected actions, retain analog button values, and provide a supported control handoff and clear operation.

The reviewed input code converts gamepad buttons with `button.pressed`, exposes stick data, and combines hardware and simulated action presses. `anyPressed()` reads the combined action queue. A source-aware frame would directly improve attract mode, analog driving, replay, tests, and companion control. Implement the smallest local patch needed for this contract, preserve existing bindings, and document it for a possible upstream change.

Do not bundle an unrelated engine rewrite into this improvement. The final evaluation must report what was actually reused, what was replaced or bypassed, and which local patches proved necessary.

## 12. Developer test yard and expansion proof

Create a small `test-yard` zone behind a developer query or a developer-only menu option. Give it the same loading, input, camera, reset, and save contracts as Palm Quay. It is a validation tool, not a second polished campaign level.

| Station | Required exercise |
| --- | --- |
| A: Movement | Walk, sprint, crouch, jump, vault, cover, ledge, and hazard recovery |
| B: Vehicles | Six definitions, braking, reverse, handbrake, steering, collision, entry, and blocked exit |
| C: Combat | Three weapons, reload, melee, cover, team filtering, damage, downed state, and revive |
| D: City behavior | Signal cycle, crossing, queue, blocked lane, witness report, and interrupted report |
| E: Police | Each heat tier, lost sight, search, roadblock, vehicle exchange, and arrest |
| F: Crew | Switch while walking, in a seat, in cover, and during a task; recover a failed task |
| G: Views and zones | Isometric/top-down round trip; ground/side portal round trip; lift and bullets in side view |
| H: Lifecycle | Checkpoint save/restore, malformed save, repeat world disposal, demo interrupt, and muted boot |

Then add **The Spare Key**, a small alternate mission fixture with a new start point, an objective, a choice, a vehicle delivery, and a payout. It must use existing verbs and systems. Its addition may change only content definitions, the content manifest, and its test fixture. If core code changes are needed, improve the contract and repeat the test.

The expansion proof passes only when the new mission validates, can be played to completion, can be saved and restored, and can be run by the existing AI goal interface. A document that says expansion is possible is not sufficient.

## 13. Implementation stages and completion gates

Keep a checkbox ledger in `docs/HANDOFF.md`. Record each stage's files, command results, and remaining issues. Commit coherent, working changes according to the repository's current rules. Do not mark a stage complete from a code inspection alone when it has a runtime gate.

| Stage | Work | Gate to complete |
| --- | --- | --- |
| P0: Repository and tools | Inspect current instructions, status, permissions, game path, metadata conventions, and engine revision. Prepare tools. | Existing tests run; source pin recorded; name collision check complete; clean scope of changes |
| P1: Engine baseline | Load the full engine, standard menu, boot flow, one actor, and a small map. Add test harness. | Headless update and browser render pass; all three views run in appropriate fixtures |
| P2: Input and lifecycle | Add physical activity, action frames, analog values, mode ownership, title idle timer, and safe disposal. | Exact timer and demo-interrupt tests pass with a simple bot; save isolation works |
| P3: Movement and vehicle feel | Implement foot movement, cover, vehicle handling, seats, collision, enter/exit, and a drive course. | Drive course and collision tests pass; visual review shows clear control and feedback |
| P4: City and police | Add lane graph, signals, traffic, pedestrians, witnesses, perception, heat, and searches. | A theft creates a valid response; a legal escape clears it; blocked routes recover |
| P5: Combat and crew | Add weapons, damage, downed state, revive, crew switching, abilities, and duties. | No duplicate control or seats; weapon and crew scenarios pass; abilities have visible effects |
| P6: Mission and persistence | Add the mission graph, interactions, economy, checkpoint saves, and migration handling. | Branch, reward, purchase, failure, and restore tests pass |
| P7: Complete level | Build Palm Quay, both approaches, relay, records room, both escapes, and optional activity. | One manual and one autonomous full mission run succeed; no debug shortcuts used |
| P8: Presentation and UX | Finish pixel art, animation, audio, HUD, ten-foot menus, and accessibility settings. | Review screenshots and filmstrips; controller navigation reaches every normal action |
| P9: Final attract loop | Add the three demo scenarios, recovery planner, input interrupt, mobile behavior, and silent boot. | Long demo run passes; every input family interrupts; progression remains unchanged |
| P10: Expansion proof | Finish the yard and The Spare Key data fixture. | Added content passes without core changes |
| P11: Reliability and performance | Fix failures, run deterministic and browser regressions, tune budgets, and review the full level. | Acceptance matrix passes, with evidence and explicit hardware limits |
| P12: Hub delivery and handoff | Validate catalogue metadata, source files, documentation, and final integration. | Correct hub entry; repository checks pass; final commit and deployment state reported when authorized |

P2 includes a minimal attract implementation early. P9 replaces its temporary route with the finished showcase. This keeps the hardest input and lifecycle risks visible from the start.

After P3, P7, and P8, play the current game interactively. Review the first minute, the hardest transition, and the full mission. Fix control feel, navigation, and readability before adding more decoration. Do not defer all polish to the final stage.

## 14. Verification plan

### 14.1 Test methods

Use headless tests for state transitions, collision, input contracts, saves, missions, and deterministic simulation. Use browser tests for menus, pixel rendering, focus, audio activation, input events, and hub integration. Use screenshots and filmstrips for animation and layout. Use an interactive playthrough for pacing and control feel.

Do not treat simulated gamepad tests as physical controller tests. When a DualSense is available, test USB and Bluetooth on the actual host browser. Record the browser, OS, connection, gamepad ID, mapping, and any unsupported features. If hardware is unavailable, state that limit in QA and the final chat.

Use the handoff's `check.mjs`, `filmstrip.mjs`, and `replay.mjs` where applicable. Read their options before adapting commands. Do not force the whole ground world into a side projection merely to satisfy a checker; use the proper zone fixture.

### 14.2 Acceptance matrix

| ID | Check | Pass condition |
| --- | --- | --- |
| A01 | Engine foundation | The game creates and uses `E.Game`, engine maps, movement, rigs, rendering, UI, and test hooks. No replacement engine is hidden beside it. |
| A02 | Original content | All shipped story, layouts, names, logo, and music are original or have recorded permission/license. |
| A03 | Presentation | Isometric is the default and at least 75% of a normal run. Top-down and side-scroll sections are fully playable. |
| A04 | Complete mission | Both entry approaches and both escape routes reach a valid success result. |
| A05 | Failure and recovery | Arrest, downed crew, death, a fall, an interrupted interaction, and a lost vehicle have clear recovery paths. |
| A06 | Controls | Every required action and menu works with the controller mapping; keyboard and mouse follow the same action model. |
| A07 | Physical controller | Record real DualSense results if hardware is available. Never label emulation as hardware verification. |
| A08 | Input isolation | Menu, map, crew selector, pause, vehicle, and side-area contexts do not leak actions. |
| A09 | Ten-foot UI | Main text meets the output-size targets. Focus is always visible. No required hover or dense data screen remains. |
| A10 | Vehicle collision | Maximum-speed frontal, side, and corner contacts do not tunnel through walls, doors, cars, or protected actors. |
| A11 | Seats and exits | Repeated enter, switch, cancel, and exit cycles create no duplicate occupant or unsafe exit. |
| A12 | Traffic | Vehicles follow valid lanes, respect signals, and recover from a blocked intersection without permanent gridlock. |
| A13 | Police | Unobserved events do not give police perfect knowledge. Witnesses, pursuit, search, vehicle recognition, and heat decay work. |
| A14 | Combat | Hit geometry matches visible aim and cover. Ammo, reload, team rules, and damage sources share the same pipeline. |
| A15 | Crew | All three actors keep state across switches. Companion tasks, abilities, pickup, downed state, and revive work. |
| A16 | Zone round trip | Health, inventory, crew tasks, mission progress, and vehicle occupancy survive both zone transition types. |
| A17 | Saves | Checkpoints load after a page reload. Invalid and blocked storage produce a usable session. Rewards cannot duplicate. |
| A18 | Idle boundary | At 9.9 seconds the title remains. At 10.0 seconds it requests demo entry. Input at 9.9 seconds resets the full interval. |
| A19 | Menu idle | Title Settings and Controls enter the demo after the same idle period. A live-game pause does not. |
| A20 | Demo interrupt | Keyboard, pointer, wheel, touch, buttons, either stick, and analog triggers exit before the next bot command. |
| A21 | Exit debounce | The interrupting input cannot start a game or select a title item. A fresh confirm after neutral controls works. |
| A22 | Real autonomous play | Demo actions pass through shared movement, combat, interaction, and mission validation. A full mission bot run succeeds. |
| A23 | Endless loop | Repeated success, failure, and recovery resets continue without a terminal state, leaked timers, or growing entity counts. |
| A24 | Demo save isolation | Scoped persistent storage is byte-for-byte unchanged after demo runs, apart from an explicit human settings change. |
| A25 | Mobile | No touch stick or gameplay buttons appear. The scene runs automatically; touch exits it; one menu button is sufficient. |
| A26 | Browser lifecycle | Fresh silent boot, denied audio, blur, hidden tab, focus return, resize, and controller disconnect behave as specified. |
| A27 | Visual review | No missing art, bad depth order, unreadable player, clipped prompts, broken poses, or placeholder screens remain. |
| A28 | Audio | All core actions have appropriate feedback. Muted play works. Pause and reset leave no continuing siren or weapon voice. |
| A29 | Expansion | The Spare Key passes through content and manifest additions only; no core-system change is needed. |
| A30 | Diagnostics | Snapshot, seed, state hash, event log, mission trace, and a reproducible replay are available in developer mode. |
| A31 | Performance | The named reference environment meets the recorded frame, memory, load, and population budgets. |
| A32 | Hub integration | One correct catalogue entry loads in the hub iframe and at its direct URL. Relative assets and return controls work. |
| A33 | Provenance | Chat, README, and HTML contain the six requested source-information fields, separate from engine evaluation. |
| A34 | Handoff | Run commands, contracts, authoring examples, patch list, evidence, limitations, and remaining work are current. |

### 14.3 Specific automated scenarios

Cover the following failures because they cross system boundaries:

- Fire during a crew switch, change views during an interaction, and pause during a vehicle entry.
- Lose the vehicle while the operator is in the records room.
- Block both vehicle doors with traffic, then move one obstacle and exit.
- Let a witness report while the player leaves the zone. Break line of sight before the report finishes in a second test.
- Disable a camera, save, restore, and check the remaining disable duration.
- Open a gate, recompute paths, and restore the gate's earlier checkpoint state.
- Switch away from a driver during a chase and return after the companion has driven legally.
- Down a crew member in another visible part of the district and recover them without a duplicate actor.
- Hold a stick, tap an unmapped key, move the right stick, or pull a trigger during the demo.
- Run bot input with no physical input and verify that it never resets the idle clock or exits the demo.
- Close the tab after a checkpoint request, reload, and check the last complete save.
- Replay success and retry the result callback. The payout must occur once.

Run deterministic mission tests across at least 20 seeds, including both mission approaches. Use the same seed and action frames with 30, 60, 120, and 144 Hz render schedules. Compare simulation hashes at equal fixed ticks. Rendering rate must not change mission or collision outcomes. Use the engine's session support for reproducible browser bugs; do not promise bit-for-bit cross-browser behavior without testing it.

### 14.4 Soak and performance budgets

Run at least four simulated hours of the autonomous loop in headless mode. Run at least thirty continuous real minutes in a foreground browser, with one interruption and restart during the run. This demonstrates repeatability; the state machine design supplies the indefinite loop.

Use these initial budgets, then record measured results:

| Measure | Initial target |
| --- | --- |
| Output | 1920 × 1080 with a 480 × 270 logical buffer; 60 Hz target |
| Frame time | p95 at or below 16.7 ms on the recorded reference environment; investigate stalls above 50 ms |
| Simulation cost | p95 below 6 ms per displayed frame at normal population |
| Population | About 14 ambient cars, 24 pedestrians, 6 police units, 8 guards, and 3 crew; explicit hard caps |
| Effects | At most 128 active projectiles, 400 particles, 12 dynamic lights, and 24 audio voices |
| Load | Playable title within 5 seconds on the recorded local/reference setup; report deployment load separately |
| Reset stability | Entity, timer, subscription, and voice counts return to baseline after each reset |
| Memory | No upward trend after warm-up across repeated resets; compare equivalent GC points when the tool permits |

Protect mission actors before reducing ambient budgets. Reduce effects, rig redraw rate, and ambient counts before changing the simulation step. Use the spatial index for nearby queries. Cache terrain and materials where the engine supports it. Log device and browser versions with every performance result.

## 15. Repository and delivery procedure

### 15.1 Start safely and stay within scope

1. Resolve the current ai-hub checkout through GitHub access. Read applicable `AGENTS.md`, `CLAUDE.md`, and nearby project instructions.
2. Inspect the working tree and current remote state before editing. Preserve unrelated changes.
3. Inspect open work for conflicts with the target path. Do not close, merge, or replace unrelated pull requests merely to start this game.
4. Recheck the title and slug against tracked paths and catalogue metadata. Apply the suffix collision rule if needed.
5. Use the pinned full engine and required handoff tools. Record hashes and licenses.
6. Install only the tools that the work requires. The user authorized installation, but network and approval restrictions still apply. Reuse the supplied runtime when it already has the needed tools.

The inspected hub instructions call for work on `main`, tests before a commit, a push to `origin/main`, and a production READY check. Re-read them at implementation time. Apply the active session's authorization and higher-priority rules. This planning task does not authorize unrelated repository cleanup. Do not claim a deployment succeeded without checking its actual status.

### 15.2 Preserve hub conventions

Keep the game self-contained inside its project folder. Use relative script and asset URLs. Keep runtime dependencies local. Do not commit the generated `data/games.json`. Do not add a root dependency or a site-wide build step for this game.

Use the HTML head for catalogue details:

- `title`: `Grand Theft Five-Finger Drive-SD — The Meter Job`.
- `description`: one or two short sentences about the playable game.
- `theme-color`, an original icon, and an optional relative `og:image`.
- `hub:source`: `Grand Theft Auto V`; verify the existing canonical source value before finalizing.
- `hub:series`: `Grand Theft Auto`; keep it consistent with other entries for that source.
- `hub:type`: `Game`.
- `hub:genre`: use the hub's existing suitable action-game value.
- `hub:controls`: a short controller-first summary.
- Model, harness, engine version, initial date, and build version as explicit metadata. Use unknown for an unconfirmed model.

Place a readable source-information block in `index.html`, for example a nonexecuting JSON script or a clear source comment. Include the initial date, source, engine/version/URL, environment, AI lab/model, and effort facts. Keep a separate engine-evaluation block. The normal game screen only needs concise Credits and Controls pages.

### 15.3 Verification commands and evidence

Use the actual checked-out scripts. The following commands are the expected starting points from the hub root:

```sh
node --test "scripts/**/*.test.mjs"
node scripts/scan.mjs
node scripts/dev.mjs
node --test "games/grand-theft-five-finger-drive-sd/tests/*.test.mjs"
```

Add game-specific simulation, browser, replay, and soak commands in the project README. The browser tools can use a separate dependency environment. A tool installation is not a shipped runtime dependency.

Save test evidence in `docs/QA.md`: command, environment, commit, seed, result, and artifact path. Keep large temporary logs and screenshots outside committed source unless repository instructions call for them. Use a small set of selected review images where useful. State “not run” when a check could not run.

If deployment is part of the active implementation authorization, push through the supported GitHub workflow, check the production status, and smoke-test the game in the hub. Do not infer a live game URL only from a successful push. On failure, follow the repository's rollback rule without discarding unrelated work.

## 16. Risk register and decisions

| Risk | Required response |
| --- | --- |
| Engine input merges AI and human actions | Add the source-aware input contract in P2 and test interruption before content work |
| Car-shaped collision differs from character collision | Add shared queries and a swept vehicle collider; test corners and high speed early |
| Moving shapes sort poorly near actors | Review vehicle filmstrips; split render parts while preserving one entity |
| View changes reset mission or crew state | Keep a stable play session; use zone/controller adapters and round-trip tests |
| Multiple crew members expose ownership faults | Reserve seats and interactions; validate one controller per actor each tick |
| Police appear to know hidden state | Use witness and confirmed-sighting events; include a hidden-player test |
| The bot makes a broken game look complete | Require manual interactive runs and no objective shortcuts in demo code |
| Attract mode changes player progress | Use an in-memory save provider and compare persistent storage before and after |
| The hub has many unrelated games and changes | Limit changes to the new project and required metadata; test the current root suite |
| A dependency download is blocked | Use available runtime tools or report the exact blocker; do not claim a test ran |
| Controller hardware is unavailable | Complete simulated input coverage and state the remaining hardware verification clearly |
| Scope grows before the mission works | Complete P7 before expanding cosmetic variants or optional systems |

## 17. Definition of done

The game is complete when all required systems are implemented, the polished mission proves them, and the acceptance evidence supports the result.

- All required mechanics work in manual play and in the relevant autonomous scenarios.
- The main mission has working success, failure, checkpoint, replay, and free-roam outcomes.
- The three views share persistent game state through tested adapters.
- The 10-second attract entry, immediate physical-input exit, neutral-input guard, endless reset, silent boot, and save isolation work.
- The controller can operate the whole normal experience. Mobile shows no gameplay control overlay.
- The developer yard covers system edge cases. The second mission proves content expansion without core changes.
- The game has final art, animation, sound, readable UI, and no visible placeholder content.
- Root and game tests pass. Required review and soak runs have evidence. Report any unavailable hardware check separately.
- The source README and HTML contain the requested reference facts. Engine evaluation is separate and based on actual use.
- The final delivery includes the game path, commit or patch status, verified run instructions, QA results, known limits, and next-agent instructions.

Do not claim completion if a required mechanic is stubbed, a mission can only finish through debug code, the bot is a prerecorded animation, or the demo cannot recover from its normal outcomes. If a real external blocker remains, finish all work that does not depend on it and identify the exact unmet acceptance item.

## 18. Reference sources

These are the sources inspected for the plan. Engine and hub links are pinned where the content affects implementation.

1. [Engine handoff README, v0.46.1](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/README.md).
2. [Engine API card](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/API.md).
3. [Engine API index](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/API-INDEX.md).
4. [Engine guide](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/AI_GUIDE.md).
5. [Engine asset card](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/docs/ASSETS.md).
6. [Full engine source](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/dist/handoff/my-3d2dge.js).
7. [Engine package/version](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/package.json).
8. [ai-hub README](https://github.com/michaelcrosato/ai-hub/blob/988e6b7944cac4b14753d19b0f2abc074a95887e/README.md).
9. [ai-hub instructions](https://github.com/michaelcrosato/ai-hub/blob/988e6b7944cac4b14753d19b0f2abc074a95887e/CLAUDE.md).
10. [ai-hub scanner](https://github.com/michaelcrosato/ai-hub/blob/988e6b7944cac4b14753d19b0f2abc074a95887e/scripts/scan.mjs).
11. [Rockstar's GTA V page](https://www.rockstargames.com/gta-v). The page returned no readable body text in this research pass. The source design goals above are design interpretation, not a quoted feature catalogue.
12. [MDN: Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). Used for browser polling, connection, mapping, and analog-value behavior.
13. [MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Used for the silent first-boot requirement.

## 19. Prompt after /clear

Keep the same selected model. Set effort to **xhigh**. Make this plan available in the new session, then run:

```text
/goal Read Grand-Theft-Five-Finger-Drive-SD-PLAN.md and execute it in michaelcrosato/ai-hub. Use the pinned my-3D2dge v0.46.1 handoff. Complete every implementation stage, the polished Palm Quay level, controller-first UI, autonomous attract loop, expansion proof, tests, and handoff documents. Use the same model at xhigh effort. Continue through verification and the repository's authorized delivery workflow. Report only verified results and exact remaining blockers.
```
