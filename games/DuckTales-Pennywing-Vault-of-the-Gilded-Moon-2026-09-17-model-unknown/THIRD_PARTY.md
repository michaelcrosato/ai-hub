# Third-party software

The game runs on the hub's shared 3D stack, served from `/lib/`:

- Three.js r186 (npm 0.186.1) — MIT License — https://github.com/mrdoob/three.js — `WebGPURenderer` with its WebGL2 fallback, loaded through the page's import map.
- The hub's 3D kit (`/lib/kit/`): boot, quality tiers, settings, input and touch controls, post-processing, sized points, instancing.

Nothing is loaded from a CDN. No third-party art, sound, music, fonts, textures, or game assets are bundled.
