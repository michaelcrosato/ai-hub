# Morrowglass expansion art

## Hush Engine boss cutout

| File | Dimensions | Format | Use |
| --- | --- | --- | --- |
| `hush-engine.png` | 1024 × 1536 | RGBA PNG | Final archive automaton boss |

Original output: `/workspace/scratch/85293f696c50/generated_images/exec-8739bb15-9abf-4dac-9cfb-a56e0be2ed4e.png`.

The artist agent inspected the existing `bellkeeper.png` to keep the painted materials and volume consistent. No image was supplied as an input to generation. The complete figure, halo, and scroll-like wings are visible. The image was visually checked and copied without pixel edits.

A read-only Pillow check confirmed a true alpha channel. All four corner alpha values are 0. Fully transparent pixels cover 45.64% of the image. The visible silhouette, at alpha greater than 16, occupies the pixel box `(18, 4, 1004, 1519)`. Alpha values range from 0 to 254. The game supplies ground shadows and animation transforms. Use the native 2:3 aspect ratio to preserve the silhouette.

### Generation prompt

```text
Use case: stylized-concept.
Asset type: one full-body final boss character cutout for the original fantasy JRPG Morrowglass. Portrait canvas approximately1024x1536. TRUE transparent background with alpha.
Primary request: The Hush Engine, an ornate ancient brass celestial archive automaton, sympathetic and majestic, keeper of forgotten names. A single coherent full-body character.
Design: a tall slender yet imposing humanoid archive machine with a chest of deeply engraved weathered brass and small drawer-like panels, an arched opening around a softly glowing teal core, pale ivory root-like joints, two articulated arms, two separately visible legs planted apart, slender mechanical hands open in a calm weary gesture. A modest hoodlike polished metal head holds two pale weary light eyes and NO human face. An elegant floating armillary ring halo circles behind and above the head, made of two fine antique brass rings with small celestial ornaments. Long scroll-like wings made of curved ivory parchment-shaped metal plates and engraved brass spines extend gently from the shoulders, curving down and back rather than spreading horizontally too far. The wings are architectural and scroll-like, not feathered and not batlike. Decorated with fine organic filigree and tiny abstract marks that cannot be read as words. No weapon. Pose suggests immense old power and compassion, not rage.
Style/medium: finished painterly pre-rendered 3D fantasy JRPG character art with rich volume, tactile weathered brass, tarnished teal edges, pale ivory joints, storybook proportions, delicate carved detail. Matching a ruined fairy-tale world of bell sanctuaries, luminous teal archives, and ancient brass machines. Original character design, no existing game character. Strong readable silhouette even when displayed around240pixels tall.
Composition: FULL BODY centered with all halo, wings, arms, legs, fingers and feet completely inside the frame. Small clear padding around the outer silhouette. Three-quarter view facing slightly to viewer's left, camera at a slight elevation. Both arms held apart from torso, both feet fully visible. Wings remain mostly vertical, creating an elegant tall silhouette.
Lighting: soft warm golden key light from upper left, dim teal rim light, natural dark occlusion in joints, luminous but contained teal heart-core.
Background: TRUE TRANSPARENCY. No environment, no floor, no ground, no wall, no shadow outside the character, no backdrop, no separate scene. Transparent empty space between arms, wings and legs.
Constraints: one character only, no text, no readable names or letters, no caption, no UI, no logos, no watermark, no border. Do not crop any character part.
```


## Provenance and scope

These original game assets were created with the built-in image generation tool on 2026-10-12 UTC. The tool used one original text prompt per asset. No external source image was supplied. The artist agent inspected the existing `garden.png` for color, texture, and camera consistency before generation.

All selected PNG files were copied unchanged into this folder. No pixels were edited. Each image was visually inspected at the generated size. The `file` command confirmed each background is an RGB PNG at 1672 × 941 pixels. The engine adds characters, collision bounds, contextual props, and effects.

## Background assets

| File | Room theme | Dimensions | Inspection |
| --- | --- | --- | --- |
| `bracken.png` | Warm forest courier town, giant postal-tree | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `reedfen.png` | Moonlit willow marsh and stone terrace | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `foundry.png` | Orange forge light and volcanic cliffs | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `saltmere.png` | Turquoise seaport and pale limestone dock | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `whitewake.png` | Snow peaks, blue-purple dusk, warm abbey windows | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `observatory.png` | Violet sky and brass ring machines at the sides | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |
| `quietvault.png` | Luminous teal archive and open final stage | 1672 × 941 | Clear floor in requested x5–95%, y63–95% area; no characters or UI |

The background images have an approximately 16:9 aspect ratio. The walkable floor generally begins near the middle of the image. Scene objects remain above the walkable region or at the far sides. The game can reuse a background for related locations with contextual props and tint changes.

## Original output paths

- `bracken.png`: `/workspace/scratch/85293f696c50/generated_images/exec-26b67037-0365-46dd-a131-ee7bdf7b81f0.png`
- `reedfen.png`: `/workspace/scratch/85293f696c50/generated_images/exec-4042800a-f776-4e03-bc71-2e8c60df6f6f.png`
- `foundry.png`: `/workspace/scratch/85293f696c50/generated_images/exec-bde42d46-4e06-44a5-89d7-5f9ea022d90d.png`
- `saltmere.png`: `/workspace/scratch/85293f696c50/generated_images/exec-eeb27e01-577f-4ca2-b428-0c7f2a393af9.png`
- `whitewake.png`: `/workspace/scratch/85293f696c50/generated_images/exec-d044520d-ca9a-414b-96ae-71e92db5279d.png`
- `observatory.png`: `/workspace/scratch/85293f696c50/generated_images/exec-fcb37530-8a79-40e9-87cf-e0dff8869070.png`
- `quietvault.png`: `/workspace/scratch/85293f696c50/generated_images/exec-63aac2f0-efdb-4f81-8576-de533433fa80.png`

## Generation prompts

### Bracken Post

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: Bracken Post, a cozy forest courier town at warm blue-hour dusk. A majestic giant ancient postal-tree forms a living house at upper left, with little arched mail cubby niches, spiraling wooden stairs and tiny glowing round windows; all features are architectural with NO text. Rows of beautiful timber and plaster houses with steep mossy russet roofs nestle along the back edge, framed by huge old branches and hanging strings of tiny golden lamps. Ferns, curling roots, brass mail pipes and wildflowers line the perimeter. A calm forest path recedes through the upper-right background under an arch. Lower floor is broad empty warm grey cobblestone with only very subtle leaf scatter. No roots invade the floor.
Lighting/mood: welcoming woodland wonder, soft golden lanterns and late peach light, deep teal forest shadows, luminous warm windows, serene evening.
```

### Reedfen

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: Reedfen, a misty willow marsh, full of graceful drooping willows, still teal green water, pale moon reflections, reed beds and small warm ghost lanterns. A delicate mossy stone bridge in the far background leads to a tiny stilt-house hamlet above the wetland. A ruined stone arch frames the upper left; old willow branches frame the upper right. The playable lower45% is a broad safe empty terrace combining large worn grey flagstones with a level weathered wood deck strip at the back. Low rails are ONLY at the extreme side edges and upper back, never across the clear lower floor. The marsh water appears only beyond the back of the terrace. No reeds or water intrude into the walkable rectangle.
Lighting/mood: cool silver-teal moonlight, layered mist, tiny amber lamps, quiet melancholy and beauty, floor still clearly visible.
```

### Ember Brassworks

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: Ember Brassworks, an orange-lit ancient brass foundry built into towering dark volcanic cliffs. Giant pipes, ornate pressure gauges with NO readable text, big bronze gears, crucibles, and heavy workshop machines sit along the upper-left and upper-right edges. A monumental open furnace at upper left glows molten orange, seen across the back wall. A high bridge and chimney silhouettes cross the distant rocky chasm. Thin ember smoke drifts high above. No lava in the playable floor. The lower45% is a broad empty level terrace of dark slate paving with subtle brass seam inlays. All machine bases, tools and rubble remain outside the clear lower rectangle. Upper architecture shows skilled fantasy craftsmanship rather than a modern factory.
Lighting/mood: dramatic warm orange furnace light, dark indigo volcanic rock, tiny teal status lights embedded in antique brasswork, bold but readable floor lighting.
```

### Saltmere

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: Saltmere, a bright turquoise seaport at a beautiful coastal evening. Graceful moored wooden sailboats with cream furled sails cluster in the upper-right harbor, rigging glints in the light. Tall warm white stucco houses and russet terracotta roofs, narrow high balconies, an elegant lighthouse on a distant promontory, flowering bougainvillea at the upper-left frame and brass harbor lanterns. The azure sea, a distant coast, peach evening clouds and sunlit maritime architecture fill the top half. The playable lower45% is a broad empty light limestone dock terrace with subtle worn paving joints. Rope piles, crates, bollards, plants and harbor fixtures ONLY above y55% or at the extreme edges. No boats or water in the lower empty ground area. A clear open floor spans all the lower frame.
Lighting/mood: luminous coastal evening, turquoise water, soft peach sunset, pale gold stone, glowing warm windows, joyful sea air and a sense of travel. Remain in the same painterly fantasy world as the warm golden lamps and brass craft of the prior scenes.
```

### Whitewake Abbey

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: Whitewake Abbey, a remote snowy mountain monastery at blue-purple dusk. A grand graceful abbey of pale carved stone and steep blue slate roofs stands across the upper-left and upper-center, with glowing warm windows and hanging brass lanterns. An archway opens at upper right toward breathtaking layered snowy mountain peaks, a pale crescent moon, and drifting clouds below the mountain summit. Soft snow rests on roof ridges, window ledges, edge-side fir branches and low perimeter walls. The playable lower45% is a broad empty level terrace of swept dark grey stone paving with only a thin translucent frost sheen. Snowbanks remain above y55% or at extreme side edges. The ground rectangle x5%..95%, y63%..95% is entirely clear of snow piles, branches, statues, railings and obstacles.
Lighting/mood: deep blue and violet dusk, luminous snowy peaks, tender warm golden abbey windows, quiet refuge at great height. Strong readable floor perspective and gentle reflected cold light.
```

### Meridian Observatory

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: The Meridian Observatory, a ruined star observatory on a high mountain summit. Huge antique brass ring mechanisms and armillary spheres rise on stone supports at the UPPER LEFT and UPPER RIGHT ONLY. The rings have many tiny empty decorative ticks and celestial emblems but NO readable lettering. A broken vaulted arch and part of a domed roof frame a vast breathtaking violet celestial sky full of fine stars and softly luminous nebula-like clouds. Distant mountain silhouettes descend into cloud. Subtle ruined staircases and ivy-covered stone columns stand at the upper far sides. At the upper back center is a low ornate parapet with the sky beyond. The lower45% is a broad empty level terrace of dark blue-grey stone. Very subtle flat circular star-map inlays can be part of the paving, with no readable letters, but the floor is flat with NO machine or pedestal at center. All ring machinery stays wholly above y55% or at the extreme edges.
Lighting/mood: transcendent violet twilight, pale starlight, little warm golden lanterns, dim teal reflections on brass, a quiet place to read the heavens. Carefully readable floor and strong storybook charm.
```

### Quiet Vault

```text
Use case: stylized-concept.
Asset type: finished background image for a fixed-camera original storybook JRPG called Morrowglass. Landscape aspect ratio 16:9, ideally 1672 x 941.
Style/medium: rich hand-painted pre-rendered late-1990s console JRPG matte painting, intricate European fairy-tale craftsmanship, slightly exaggerated elegant architecture, tactile detail and soft painterly brush texture, cinematic light. A distinct original world, not a recreation of any existing game scene. This belongs to a world of teal mist, brass craft, russet gables, warm golden lanterns, and ancient bells.
Composition/framing: fixed camera slightly elevated three-quarter view, front oriented rather than top down. All major architecture, scenic forms, and props live in the UPPER 55 percent or at the extreme side edges. The LOWER 45 percent MUST be a broad EMPTY CONTIGUOUS WALKABLE GROUND TERRACE. The full rectangle from x5% to95% and y63% to95% MUST contain only flat clear ground paving, no obstacles. Character feet and game props will later be drawn over that area. NO central obstacle. No foreground objects inside this clear zone. Keep all large objects, rocks, trees, flowers, benches, machines, rails, and buildings outside the empty area. Floor perspective must remain clear and readable. Upper half offers visual richness and world depth. Floor reaches the entire bottom edge.
Constraints: no people, no characters, no creatures, no UI, no text, no letters, no signs with lettering, no logos, no border, no watermark. One image only.
Scene/backdrop: The Quiet Vault, a vast luminous ancient library and archive of names. Towering endless walls of tiny closed books, sealed folios, and brass pigeonhole drawers ascend into a high arched darkness at the sides. Great elegant brass arches create layers receding into the upper center, framing a soft teal luminous void and distant suspended shelves. Pale carved tree-root filigree embraces the arches. Tiny warm golden reading lamps along the back walls, clusters of narrow stairs and elevated balconies only high at the sides. Floating dust motes glimmer in high shafts of light. NO readable text on any book or drawer. This is the final empty confrontation stage: the lower45% is a broad entirely empty level floor of softly polished dark green-grey stone with delicate FLAT brass circular inlays. Leave complete empty space across the whole lower frame, no desk, lectern, pedestal, staircase, loose books or obstacle in the clear ground area.
Lighting/mood: sacred and wistful, deep teal luminous air, brass golden highlights, ancient wisdom, enormous scale, warm amber lamps, a compassionate sense of memory. Floor remains clearly visible and readable.
```


