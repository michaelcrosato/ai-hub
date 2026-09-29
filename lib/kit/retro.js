/**
 * retro.js — the PS1/N64/Super FX look, the same on WebGPU and WebGL2.
 *
 *   boot({ pixelHeight: 360, renderer: { antialias: false } })
 *       renders 360 lines tall and scales up with hard pixels (kit.setPixelHeight(h) to change, 0 for native)
 *   vertexSnap(material, { width: 320, height: 240 })
 *       wobbly PS1 vertices: clip-space positions snap to a coarse grid
 *   dither15(colorNode)
 *       ordered dither down to 5 bits per channel, for a post chain (createPost's `output`)
 *
 * Nearest-filtered textures stay a per-texture choice:
 *   tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
 */

import { Vector2 } from 'three/webgpu';
import { Fn, modelViewProjection, vec3, vec4, floor, uniform, screenCoordinate, mod } from 'three/tsl';

/**
 * Snap vertices to a virtual screen grid. Works with instancing and skinning.
 * Returns the grid uniform; change it with grid.value.set(width / 2, height / 2).
 */
export function vertexSnap(material, { width = 320, height = 240 } = {}) {
  const grid = uniform(new Vector2(width / 2, height / 2));
  material.vertexNode = Fn(() => {
    const clip = modelViewProjection.toVar();
    const ndc = clip.xy.div(clip.w);
    const snapped = floor(ndc.mul(grid).add(0.5)).div(grid);
    return vec4(snapped.mul(clip.w), clip.z, clip.w);
  })();
  return grid;
}

/** 4×4 Bayer ordered dither, quantised to 32 levels per channel (PlayStation-style 15-bit colour). */
export const dither15 = Fn(([color]) => {
  // Bayer 4×4 built from two 2×2 levels: b2(x, y) = 2·((x + y) mod 2) + y.
  const b2 = (x, y) => mod(x.add(y), 2).mul(2).add(y);
  const p = floor(mod(screenCoordinate.xy, 4));
  const lo = mod(p, 2);
  const hi = floor(p.div(2));
  const m = b2(lo.x, lo.y).mul(4).add(b2(hi.x, hi.y));
  const c = floor(vec3(color.rgb).mul(31).add(m.add(0.5).div(16))).div(31);
  return vec4(c, color.a);
});
