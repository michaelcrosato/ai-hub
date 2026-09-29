/**
 * post.js — the standard post-processing chain, in TSL so it runs the same
 * on WebGPU and WebGL2. It replaces EffectComposer, which WebGPURenderer
 * cannot use.
 *
 *   const post = createPost(kit, scene, camera, { bloom: { strength: 0.8, radius: 0.4, threshold: 0.8 } });
 *   kit.start((dt) => { update(dt); post.render(); });
 *
 * Anti-aliasing follows the tier: MSAA on high and ultra (set on the
 * renderer, inherited by the scene pass), FXAA on medium, none on low.
 * Bloom stays on at every tier and only renders smaller on 'lite'.
 *
 * For anything else, pass `output(color, ctx)` and build on the scene
 * colour with TSL: vignette, colour grading, film grain, outlines…
 */

import * as THREE from 'three/webgpu';
import { pass, renderOutput } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa as fxaaNode } from 'three/addons/tsl/display/FXAANode.js';

/**
 * @param {object} kit       from boot()
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} [opts]
 * @param {{strength?:number, radius?:number, threshold?:number}|false} [opts.bloom]
 * @param {boolean|'auto'} [opts.fxaa='auto']  'auto' = FXAA when the tier has no MSAA (except on low)
 * @param {(color: any, ctx: object) => any} [opts.output]  extra TSL on the linear scene colour
 */
export function createPost(kit, scene, camera, { bloom = false, fxaa = 'auto', output } = {}) {
  const tier = kit.tier;
  const pipeline = new THREE.RenderPipeline(kit.renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  let node = color;

  let glow = null;
  if (bloom) {
    glow = bloomNode(color, bloom.strength ?? 1, bloom.radius ?? 0.4, bloom.threshold ?? 0.85);
    glow.setResolutionScale(tier.post === 'lite' ? 0.35 : 0.5);
    node = node.add(glow);
  }
  if (output) node = output(node, { scenePass, color, pipeline }) ?? node;

  const useFxaa = fxaa === true || (fxaa === 'auto' && !tier.msaa && tier.name !== 'low');
  if (useFxaa) {
    // FXAA works on display-referred colour, so tone mapping and sRGB go first.
    pipeline.outputColorTransform = false;
    node = fxaaNode(renderOutput(node));
  }
  pipeline.outputNode = node;

  return {
    pipeline,
    scenePass,
    bloom: glow,
    render() {
      pipeline.render();
    },
    dispose() {
      pipeline.dispose();
    },
  };
}
