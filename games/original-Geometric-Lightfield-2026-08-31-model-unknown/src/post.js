// The game's own render pipeline (TSL, both backends): the scene pass writes colour
// and emissive (MRT); a normals pass feeds GTAO, which is denoised and fed back into
// the scene lighting as ambient occlusion; bloom runs on the emissive buffer only, so
// only light sources glow. FXAA covers tiers without MSAA.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, normalFlat, vec4, rtt, screenUV, builtinAOContext, renderOutput } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';

export const EFFECT_QUALITY = {
  low: { aoResolution: 0.35, aoSamples: 8, aoRadius: 0.42, denoiseRadius: 3, bloomResolution: 0.3, bloomStrength: 0.11 },
  medium: { aoResolution: 0.5, aoSamples: 12, aoRadius: 0.5, denoiseRadius: 4, bloomResolution: 0.4, bloomStrength: 0.17 },
  high: { aoResolution: 0.62, aoSamples: 18, aoRadius: 0.56, denoiseRadius: 4, bloomResolution: 0.5, bloomStrength: 0.22 },
  ultra: { aoResolution: 0.75, aoSamples: 26, aoRadius: 0.62, denoiseRadius: 5, bloomResolution: 0.6, bloomStrength: 0.28 },
};

export class PostPipeline {
  constructor(renderer, scene, camera) {
    this.signature = '';
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.scenePass = pass(scene, camera);
    this.scenePass.setMRT(mrt({ output, emissive }));
    this.sceneColor = this.scenePass.getTextureNode('output');

    const normalMaterial = new THREE.NodeMaterial();
    normalMaterial.fragmentNode = vec4(normalFlat, 1);
    normalMaterial.fog = false;
    normalMaterial.side = THREE.DoubleSide;
    // Single-sampled: GTAO gathers from the depth texture, which WebGPU can't do on a
    // multisampled one (the renderer is MSAA on high and ultra).
    this.geometryPass = pass(scene, camera, { samples: 0 });
    this.geometryPass.overrideMaterial = normalMaterial;
    this.geometryPass.transparent = false;
    const depth = this.geometryPass.getTextureNode('depth');
    const normals = this.geometryPass.getTextureNode('output');
    const glow = this.scenePass.getTextureNode('emissive');

    this.gtao = ao(depth, normals, camera);
    this.gtao.thickness.value = 1.2;
    this.gtao.distanceExponent.value = 1.35;
    this.gtao.distanceFallOff.value = 0.72;
    this.gtao.scale.value = 1.08;
    this.denoise = denoise(this.gtao.getTextureNode(), depth, normals, camera);
    this.denoise.lumaPhi.value = 4;
    this.denoise.depthPhi.value = 4;
    this.denoise.normalPhi.value = 8;
    this.bloom = bloom(glow, 0.17, 0.34, 0.02);
    this.denoisedAO = rtt(this.denoise, null, null, { type: THREE.HalfFloatType, depthBuffer: false });
    this.denoisedAO.updateBeforeType = THREE.NodeUpdateType.FRAME;
    this.aoContext = builtinAOContext(this.denoisedAO.sample(screenUV).r.clamp(0, 1));
    this.composite = this.sceneColor.add(vec4(this.bloom.rgb, 0));
    this.pipeline.outputNode = this.composite;
  }

  /**
   * quality: the tier name. ambientOcclusion: GTAO on/off (off on low, where blob
   * contact shadows stand in). antialias: FXAA when the tier has no MSAA.
   */
  setQuality(quality, ambientOcclusion, useFxaa) {
    const key = `${quality}:${ambientOcclusion}:${useFxaa}`;
    if (key === this.signature) return;
    this.signature = key;
    const q = EFFECT_QUALITY[quality] || EFFECT_QUALITY.medium;
    this.gtao.resolutionScale = q.aoResolution;
    this.gtao.samples.value = q.aoSamples;
    this.gtao.radius.value = q.aoRadius;
    this.denoise.radius.value = q.denoiseRadius;
    this.bloom.setResolutionScale(q.bloomResolution);
    this.bloom.strength.value = q.bloomStrength;
    const context = ambientOcclusion ? this.aoContext : null;
    if (this.scenePass.contextNode !== context) {
      this.scenePass.contextNode = context;
      this.scenePass.needsUpdate = true;
    }
    // FXAA wants display-referred colour: tone map and convert first, then skip the pipeline's own transform.
    this.pipeline.outputColorTransform = !useFxaa;
    this.pipeline.outputNode = useFxaa ? fxaa(renderOutput(this.composite)) : this.composite;
    this.pipeline.needsUpdate = true;
  }

  render() {
    this.pipeline.render();
  }
}
