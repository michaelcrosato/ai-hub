# lib/ — the shared 3D stack

Loaded by every 3D game from the site root (`/lib/...`), so one upgrade here
moves the whole wall. Games reach it through the import map in their `<head>`
(see `kit/README.md`).

| Folder | What | Source |
|---|---|---|
| `three/` | three.js r186 (0.186.1): `three.core.js`, `three.webgpu.js`, `three.tsl.js`, minified; `addons/` = `examples/jsm/` unminified, minus WebGL-only and tooling folders | npm `three@0.186.1` |
| `rapier/` | Rapier 0.20.0: `rapier-simd.mjs` (from `@dimforge/rapier3d-simd-compat`) and `rapier.mjs` (from `@dimforge/rapier3d-compat`), wasm inlined | npm |
| `kit/` | our foundation: boot, renderer, settings and quality tiers, input and touch controls, physics loader, post-processing, sized points, the settings panel | this repo |

## Upgrading three.js

```bash
npm pack three@<version> && tar xzf three-<version>.tgz
for f in three.core.js three.webgpu.js three.tsl.js; do
  npx esbuild package/build/$f --minify --format=esm --target=es2022 --legal-comments=inline --outfile=lib/three/$f
done
rsync -a --delete --exclude-from=lib/three-addons.exclude package/examples/jsm/ lib/three/addons/
```

Then run `python3 scripts/check3d.py lib/kit/example.html` and a sample of
games on both backends, read the three.js migration notes for the revisions
you skipped, and update `kit/README.md` if an API moved.

### Local patches

`rsync --delete` above overwrites these; re-apply each one unless the new
release fixes the problem upstream (check with the pipeline count in
`window.__kit.pipelines`):

- `addons/csm/CSMShadowNode.js`: `_setupFade()` and `_setupStandard()` build
  their `cameraNear`, `cascades` and `shadowFar` nodes once (`??=` on the
  instance) instead of on every setup. Otherwise each material build gets a
  differently named uniform buffer, and every InstancedMesh under cascaded
  shadows compiles its own shader (Verdant Frontier: 119 pipelines → 27).
- `three.webgpu.js`, `ViewportTextureNode.getTextureForReference()`: each
  per-render-target clone of the framebuffer texture gets its own `Source`
  (`r.source=new t.source.constructor({width:0,height:0})`). Clones shared
  one image, so a new render target of the same size never re-created its
  copy texture in the target's format, and transmission or viewport
  textures failed with "copyFramebufferToTexture: Source and destination
  formats do not match" after a quality switch (Golden Hour).

## Upgrading Rapier

Copy `dist/rapier.mjs` from the `-simd-compat` and `-compat` packages of the
new version over `rapier/rapier-simd.mjs` and `rapier/rapier.mjs`, bump
`physicsInfo.version` in `kit/physics.js`, and re-tune any game whose feel
depends on changed defaults.
