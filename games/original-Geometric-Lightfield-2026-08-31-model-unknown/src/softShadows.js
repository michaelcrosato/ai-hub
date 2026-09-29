// Contact-hardening soft shadows (a PCSS-style filter) in TSL, plugged into each
// light's shadow through shadow.filterNode. Low and medium skip the blocker search
// and use a fixed-radius bilinear PCF; high and ultra estimate the penumbra from the
// average blocker depth, so shadows are sharp at contact and soften with distance.
// The CSM subclass hands the same filter to every sun cascade.
import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, uniform, reference, vec2, vec4, float, int, ivec2, mix, textureLoad,
  perspectiveDepthToViewZ, orthographicDepthToViewZ, normalWorld, vogelDiskSample,
} from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';

export const FILTER_QUALITY = {
  low: { blockers: 0, samples: 4, maxRadius: 3 },
  medium: { blockers: 0, samples: 6, maxRadius: 4 },
  high: { blockers: 8, samples: 12, maxRadius: 12 },
  ultra: { blockers: 12, samples: 20, maxRadius: 20 },
};

const filters = new WeakMap();

function createSoftShadowFilter() {
  const blockers = uniform(0, 'int');
  const samples = uniform(6, 'int');
  const maxRadius = uniform(4);
  const sourceRadius = uniform(0.2);

  const filter = Fn(({ depthTexture, shadowCoord, shadow, depthLayer }, builder) => {
    // Raw depth reads (textureLoad), not hardware comparison.
    depthTexture.compareFunction = null;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    const cam = shadow.camera;
    const perspective = cam.isPerspectiveCamera === true;
    const reversed = builder.renderer.reversedDepthBuffer;
    const near = reference('near', 'float', cam);
    const far = reference('far', 'float', cam);
    const mapSize = reference('mapSize', 'vec2', shadow);
    const texel = vec2(1).div(mapSize);
    const toViewDepth = (d) => (perspective ? perspectiveDepthToViewZ(d, near, far) : orthographicDepthToViewZ(d, near, far)).negate();
    const bias = reference('bias', 'float', shadow);
    const receiverZ = reversed ? shadowCoord.z.add(bias) : shadowCoord.z.sub(bias);
    const receiverDepth = toViewDepth(receiverZ).max(0.001).toVar();
    const maxFilter = texel.mul(maxRadius);

    // Receiver-plane depth slope from the surface normal in light space, so wide
    // kernels do not self-shadow sloped surfaces.
    const lightNormal = reference('matrixWorldInverse', 'mat4', cam).mul(vec4(normalWorld, 0)).xyz;
    const width = reference('right', 'float', cam).sub(reference('left', 'float', cam));
    const height = reference('top', 'float', cam).sub(reference('bottom', 'float', cam));
    const focal = reference('fov', 'float', cam).mul(Math.PI / 360).tan().reciprocal();
    const projScale = vec2(focal.div(reference('aspect', 'float', cam)), focal);
    const safeDiv = (a, b) => a.div(b.abs().max(1e-5).mul(b.lessThan(0).select(-1, 1))).mul(b.abs().greaterThan(1e-5).select(1, 0));
    let slope;
    if (perspective) {
      const ndc = vec2(shadowCoord.x.mul(2).sub(1), shadowCoord.y.mul(-2).add(1)).div(projScale);
      const denom = receiverDepth.mul(lightNormal.z.sub(lightNormal.xy.dot(ndc)));
      slope = safeDiv(vec2(lightNormal.x, lightNormal.y.negate()).mul(2).div(projScale).mul(far.mul(near).div(far.sub(near))), denom);
    } else {
      slope = safeDiv(vec2(lightNormal.x.mul(width), lightNormal.y.mul(height).negate()), lightNormal.z.mul(far.sub(near)));
    }
    slope = slope.mul(reversed ? -1 : 1).clamp(-1, 1).toVar();

    const depthAt = (texelCoord) => {
      let d = textureLoad(depthTexture, ivec2(vec2(texelCoord).clamp(vec2(0), mapSize.sub(1))));
      if (depthTexture.isArrayTexture && depthLayer !== undefined) d = d.depth(depthLayer);
      return d.r;
    };
    const outside = (p) => p.x.lessThan(0).or(p.y.lessThan(0)).or(p.x.greaterThan(1)).or(p.y.greaterThan(1));
    const litAt = (texelCoord) => {
      const center = vec2(texelCoord).add(0.5).mul(texel);
      const planeZ = shadowCoord.z.add(center.sub(shadowCoord.xy).dot(slope));
      const occluder = depthAt(texelCoord);
      const lit = reversed ? planeZ.greaterThanEqual(occluder) : planeZ.lessThanEqual(occluder);
      return outside(center).select(1, lit.select(1, 0));
    };
    const bilinear = (uv) => {
      const p = uv.mul(mapSize).sub(0.5);
      const base = ivec2(p.floor());
      const f = p.fract();
      return mix(
        mix(litAt(base), litAt(base.add(ivec2(1, 0))), f.x),
        mix(litAt(base.add(ivec2(0, 1))), litAt(base.add(ivec2(1, 1))), f.x),
        f.y
      );
    };
    const penumbra = (blockerDepth) => {
      const gap = receiverDepth.sub(blockerDepth).max(0);
      return perspective
        ? projScale.mul(sourceRadius.mul(gap).div(blockerDepth.max(0.001)).div(receiverDepth.mul(2)))
        : vec2(0.00465).mul(gap).div(vec2(width, height).max(0.001));
    };

    const radius = reference('radius', 'float', shadow).mul(texel).min(maxFilter).toVar();
    const result = float(0).toVar();
    const hasBlocker = int(1).toVar();

    If(blockers.greaterThan(0), () => {
      const searchRadius = penumbra(near.max(0.001)).min(maxFilter).max(texel);
      const depthSum = float(0).toVar();
      const count = float(0).toVar();
      Loop({ start: 0, end: blockers, type: 'int', condition: '<' }, ({ i }) => {
        const offset = i.equal(0).select(vec2(0), vogelDiskSample(float(i.sub(1)).max(0), blockers.sub(1), float(0)));
        const uv = shadowCoord.xy.add(offset.mul(searchRadius));
        const tc = ivec2(uv.mul(mapSize).floor());
        const center = vec2(tc).add(0.5).mul(texel);
        const occluder = depthAt(tc);
        const planeZ = shadowCoord.z.add(center.sub(shadowCoord.xy).dot(slope));
        const blocks = reversed ? occluder.greaterThan(planeZ.add(2e-5)) : occluder.lessThan(planeZ.sub(2e-5));
        If(outside(center).not().and(blocks), () => {
          depthSum.addAssign(toViewDepth(occluder));
          count.addAssign(1);
        });
      });
      hasBlocker.assign(count.greaterThan(0).select(1, 0));
      radius.assign(penumbra(depthSum.div(count.max(1))).max(texel.mul(0.55)).min(maxFilter));
    });

    If(hasBlocker.equal(0), () => {
      result.assign(1);
    }).Else(() => {
      Loop({ start: 0, end: samples, type: 'int', condition: '<' }, ({ i }) => {
        result.addAssign(bilinear(shadowCoord.xy.add(vogelDiskSample(i, samples, float(0)).mul(radius))));
      });
      result.divAssign(float(samples));
    });
    return result;
  });

  return { filter, blockers, samples, maxRadius, sourceRadius };
}

/** Give a shadow the soft filter (once) and set its quality. Uniforms only: no rebuilds. */
export function applySoftShadow(shadow, quality, sourceRadius = 0.2) {
  let f = filters.get(shadow);
  if (!f) {
    f = createSoftShadowFilter();
    filters.set(shadow, f);
    shadow.filterNode = f.filter;
  }
  const q = FILTER_QUALITY[quality] || FILTER_QUALITY.medium;
  f.blockers.value = q.blockers;
  f.samples.value = q.samples;
  f.maxRadius.value = q.maxRadius;
  f.sourceRadius.value = Math.max(0, sourceRadius);
}

/** CSM whose cascades share the sun shadow's soft filter. */
export class SoftCSMShadowNode extends CSMShadowNode {
  setup(builder) {
    const node = super.setup(builder);
    const shared = this.light.shadow && filters.get(this.light.shadow);
    if (shared) {
      for (const light of this.lights) {
        if (!light.shadow) continue;
        filters.set(light.shadow, shared);
        light.shadow.filterNode = shared.filter;
      }
    }
    return node;
  }
}
