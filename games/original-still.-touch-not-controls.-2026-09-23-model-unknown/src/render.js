/**
 * render.js — still.'s material renderer on the shared 3D kit
 * (three.js r186 WebGPURenderer, WebGPU with the WebGL2 fallback).
 *
 * The game describes every frame as instance batches: one geometry, one
 * material "kind" and a shadow flag, plus per-instance offset, scale,
 * rotation, colour and two extra parameters. This module draws them:
 *
 *   - one TSL node material per kind, ported line for line from the game's
 *     original WGSL/GLSL material shader (its own studio lighting, ACES
 *     tone curve and display gamma, so the renderer outputs those values
 *     untouched: linear output, no tone mapping, colour management off);
 *   - a directional shadow pass into a depth texture, sampled with
 *     hardware depth compares (3x3 taps, the original kernel);
 *   - the touch height field and the dye/paint field as two RGBA8 data
 *     textures the game rewrites as the player works the material.
 *
 * Every batch is a plain Mesh over an InstancedBufferGeometry whose
 * instance data lives in one interleaved buffer, so all batches of a kind
 * share one shader program (no per-InstancedMesh shader churn).
 */

import * as THREE from 'three/webgpu';
import {
  Fn, If, attribute, varying, texture, uniform, vec2, vec3, vec4, float,
  sin, cos, mix, smoothstep, step, fract, floor, clamp, dot, normalize, length,
  pow, abs, max, min, exp, cross, reflect, refract, faceForward, sign, select,
  screenCoordinate, frontFacing,
} from 'three/tsl';

/** Kinds whose surface follows the touch height field (vertex lift + normals). */
const HEIGHT_KINDS = new Set([1, 5, 6, 12, 13, 27, 29]);
/** Every material kind the exhibits draw (warmed up in the background). */
export const MATERIAL_KINDS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
/** Floats per instance in a batch: offset 3, scale 3, quaternion 4, colour 3, extra 2. */
export const STRIDE = 15;
const EXPOSURE = 1.12;
const SHADOW_TAP = 0.0014;

const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return vec3(x / l, y / l, z / l);
};
const L_MAIN = unit(-8, 13, 7);
const L_BIAS = unit(-7, 16, 8);
const L_TACTILE_RAW = [-5, 10, 4.5];
const L_TACTILE = unit(...L_TACTILE_RAW);
const L_TACTILE_Y = L_TACTILE_RAW[1] / Math.hypot(...L_TACTILE_RAW);
const ENV_A = unit(-0.7, 1, 0.6);
const ENV_B = unit(0.7, 0.45, -0.7);

/* ---------------------------------------------------------------- shared shader functions */

const hash = Fn(([q]) => {
  const p = fract(q.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
}).setLayout({ name: 'stillHash', type: 'float', inputs: [{ name: 'q', type: 'vec2' }] });

const noise = Fn(([q]) => {
  const i = floor(q).toVar();
  const f = fract(q).toVar();
  const u = f.mul(f).mul(f.mul(-2).add(3)).toVar();
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), u.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x), u.y);
}).setLayout({ name: 'stillNoise', type: 'float', inputs: [{ name: 'q', type: 'vec2' }] });

const aces = Fn(([x]) => clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1))
  .setLayout({ name: 'stillAces', type: 'vec3', inputs: [{ name: 'x', type: 'vec3' }] });

/** Original environment light for the everyday materials. */
const environment = Fn(([r, rough]) => {
  const e = mix(vec3(0.04, 0.055, 0.047), vec3(0.54, 0.65, 0.61), smoothstep(-0.35, 0.85, r.y));
  const a = pow(max(dot(r, ENV_A), 0), mix(float(100), float(7), rough));
  const b = pow(max(dot(r, ENV_B), 0), mix(float(160), float(9), rough));
  const strip = exp(
    pow(abs(r.x.add(0.42).div(rough.mul(0.22).add(0.08))), 2).add(pow(abs(r.z.sub(0.32).div(rough.mul(0.2).add(0.31))), 8)).negate()
  ).mul(smoothstep(0.1, 0.55, r.y));
  return e.add(vec3(3.8, 3.55, 2.9).mul(a)).add(vec3(0.65, 0.9, 1.1).mul(b)).add(vec3(3.1, 3.35, 2.95).mul(strip));
}).setLayout({ name: 'stillEnvironment', type: 'vec3', inputs: [{ name: 'r', type: 'vec3' }, { name: 'rough', type: 'float' }] });

/** Shared physically based finish for the close-up materials. */
const studio = Fn(([r, rough]) => {
  const env = mix(vec3(0.095, 0.12, 0.135), vec3(0.62, 0.68, 0.69), smoothstep(-0.4, 0.7, r.y));
  const soft = rough.mul(0.3).add(0.045).toVar();
  const lobe = (v, k, w, p) => pow(abs(v.add(k).div(soft.add(w))), p);
  const window1 = exp(lobe(r.x, 0.28, 0.2, 8).add(lobe(r.z, -0.05, 0.46, 8)).negate()).mul(smoothstep(0.12, 0.5, r.y));
  const window2 = exp(lobe(r.x, -0.65, 0.052, 4).add(lobe(r.z, 0.2, 0.65, 8)).negate()).mul(smoothstep(0, 0.2, r.y));
  const strip = exp(lobe(r.x, 0.18, 0.74, 8).add(lobe(r.z, 0.12, 0.038, 8)).negate()).mul(smoothstep(0.12, 0.5, r.y));
  return env.add(vec3(3.0, 2.7, 2.25).mul(window1)).add(vec3(1.5, 1.9, 2.3).mul(window2)).add(vec3(4.0, 3.6, 2.9).mul(strip));
}).setLayout({ name: 'stillStudio', type: 'vec3', inputs: [{ name: 'r', type: 'vec3' }, { name: 'rough', type: 'float' }] });

const glassBed = Fn(([q]) => {
  const ripple = noise(q.mul(0.72)).mul(0.045);
  const b = mix(vec3(0.16, 0.235, 0.25), vec3(0.25, 0.33, 0.35), smoothstep(-8, 7, q.x.add(q.y.mul(0.7))));
  return b.add(ripple);
}).setLayout({ name: 'stillGlassBed', type: 'vec3', inputs: [{ name: 'q', type: 'vec2' }] });

const objectBed = Fn(([q, spanX]) => {
  const brush = noise(vec2(q.x.mul(105), q.y.mul(0.75)));
  const seam = float(1).sub(smoothstep(0.008, 0.02, abs(q.x.sub(spanX.mul(0.4)))));
  const printed = float(1).sub(smoothstep(0.005, 0.012, abs(length(q.sub(vec2(spanX.mul(0.29), -2.5))).sub(0.24))));
  const line1 = float(1).sub(smoothstep(0.009, 0.015, abs(q.y.sub(0.15)))).mul(float(1).sub(smoothstep(0.47, 0.49, abs(q.x.add(0.7)))));
  const line2 = float(1).sub(smoothstep(0.009, 0.015, abs(q.y.add(0.02)))).mul(float(1).sub(smoothstep(0.29, 0.31, abs(q.x.add(0.88)))));
  return vec3(0.051, 0.079, 0.1).mul(brush.mul(0.025).add(0.98)).add(vec3(0.018, 0.026, 0.029).mul(printed.add(line1).add(line2))).sub(vec3(seam.mul(0.008)));
}).setLayout({ name: 'stillObjectBed', type: 'vec3', inputs: [{ name: 'q', type: 'vec2' }, { name: 'spanX', type: 'float' }] });

const waterBed = Fn(([q]) => {
  const lines = float(1).sub(smoothstep(0.005, 0.016, min(abs(fract(q.x.mul(0.27).add(0.5)).sub(0.5)), abs(fract(q.y.mul(0.27).add(0.5)).sub(0.5)))));
  const waves = abs(sin(q.x.mul(3.1).add(sin(q.y.mul(2.4)))).add(sin(q.y.mul(3.4).add(sin(q.x.mul(2.7))))));
  const c = pow(clamp(float(1).sub(waves.mul(0.68)), 0, 1), 15);
  return vec3(0.34, 0.46, 0.46).mul(noise(q.mul(72)).mul(0.025).add(0.96)).sub(vec3(lines.mul(0.006))).add(vec3(0.03, 0.055, 0.05).mul(c));
}).setLayout({ name: 'stillWaterBed', type: 'vec3', inputs: [{ name: 'q', type: 'vec2' }] });

const fresnelSchlick = Fn(([cosT, f0]) => f0.add(vec3(1).sub(f0).mul(pow(clamp(float(1).sub(cosT), 0, 1), 5))))
  .setLayout({ name: 'stillFresnel', type: 'vec3', inputs: [{ name: 'cosT', type: 'float' }, { name: 'f0', type: 'vec3' }] });

const rotateByQuat = Fn(([v, q]) => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2)))
  .setLayout({ name: 'stillRotate', type: 'vec3', inputs: [{ name: 'v', type: 'vec3' }, { name: 'q', type: 'vec4' }] });

/* ---------------------------------------------------------------- materials */

function createMaterials({ fieldTex, dyeTex, shadowTex, webgpu }) {
  const U = {
    time: uniform(0),
    eye: uniform(new THREE.Vector3(0, 14, 7)),
    heightScale: uniform(1.5),
    fieldSpan: uniform(new THREE.Vector2(12, 12)),
    texel: uniform(new THREE.Vector2(1 / fieldTex.image.width, 1 / fieldTex.image.height)),
    lightVP: uniform(new THREE.Matrix4()),
  };

  // The height field is 16 bits packed into R (high byte) and G (low byte); the decode is
  // linear in both, so bilinear filtering of the bytes filters the height correctly.
  const heightAt = (t) => dot(texture(fieldTex, t).level(0).rg, vec2(256, 1)).div(257).sub(0.5).mul(U.heightScale);
  const dyeAt = (t) => texture(dyeTex, t).level(0);

  /** Light-space visibility: 0.2 in full shadow, 1 when lit (the original 3x3 kernel). */
  const shadowAt = (lightPos, nrm) => {
    const q = lightPos.xyz.div(lightPos.w).toVar();
    // Texture space follows the WebGPU convention on both backends (three flips depth
    // textures on WebGL2). Clip depth is 0..1 on WebGPU and -1..1 on WebGL2.
    const s = vec3(q.x.mul(0.5).add(0.5), q.y.mul(-0.5).add(0.5), webgpu ? q.z : q.z.mul(0.5).add(0.5)).toVar();
    const bias = max(float(1).sub(dot(nrm, L_BIAS)).mul(0.0014), 0.0007);
    const ref = s.z.sub(bias).toVar();
    const sum = float(0).toVar();
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) sum.addAssign(texture(shadowTex, s.xy.add(vec2(x * SHADOW_TAP, y * SHADOW_TAP))).compare(ref));
    }
    const outside = s.x.lessThan(0).or(s.x.greaterThan(1)).or(s.y.lessThan(0)).or(s.y.greaterThan(1)).or(s.z.greaterThan(1));
    return select(outside, float(1), sum.div(9).mul(0.8).add(0.2));
  };

  /** Vertex stage: instance transform, height-field lift, the curling peel ribbon (kind 16). */
  const vertexStage = (kind) => {
    const aPos = attribute('position', 'vec3');
    const aNor = attribute('normal', 'vec3');
    const aUv = attribute('uv', 'vec2');
    const iOffset = attribute('iOffset', 'vec3');
    const iScale = attribute('iScale', 'vec3');
    const iQuat = attribute('iQuat', 'vec4');
    const iColor = attribute('iColor', 'vec3');
    const iExtra = attribute('iExtra', 'vec2');
    let p = aPos;
    let nn = aNor;
    if (HEIGHT_KINDS.has(kind)) {
      const lift = select(iExtra.y.greaterThan(0.5).and(aNor.y.greaterThan(0.02)), heightAt(aUv), float(0));
      p = vec3(aPos.x, aPos.y.add(lift), aPos.z);
    }
    if (kind === 16) {
      const t = aUv.y;
      const len = iExtra.x;
      const drop = iExtra.y;
      const rad = min(len, 6).mul(0.035).add(0.18);
      const turns = min(float(12.5), len.div(rad));
      const a = t.mul(turns);
      const lift = float(1).sub(min(drop, 0.82));
      p = vec3(
        aPos.x,
        float(1).sub(cos(a)).mul(rad).add(t.mul(len).mul(0.12)).mul(lift).add(0.015),
        sin(a).mul(rad).negate().sub(t.mul(len).mul(0.5))
      );
      const dy = sin(a).mul(turns).mul(rad).add(len.mul(0.12)).mul(lift);
      const dz = cos(a).mul(turns).mul(rad).negate().sub(len.mul(0.5));
      nn = normalize(vec3(0, dz.negate(), dy));
    }
    const world = rotateByQuat(p.mul(iScale), iQuat).add(iOffset);
    const scaledNormal = nn.div(max(abs(iScale), vec3(0.0001))).mul(sign(iScale));
    const normal = rotateByQuat(scaledNormal, iQuat);
    return { world, normal, uv: aUv, color: iColor, extra: iExtra };
  };

  /** The close-up materials (kinds 21-32): glass, film, tape, wax, ice, water. */
  const tactileShade = (kind, ctx) => {
    const { p, n, base, vUv, vExtra, vLight } = ctx;
    const v = normalize(U.eye.sub(p)).toVar();
    n.assign(faceForward(n, v.negate(), n));
    const ndv = max(dot(n, v), 0.001).toVar();
    const rough = float(0.48).toVar();
    const metal = float(0).toVar();
    const transmission = float(0).toVar();
    const ao = float(1).toVar();
    let emission = null;
    let transmittedBase = null;

    if (kind === 24) {
      base.assign(glassBed(p.xz));
      rough.assign(0.085);
    }
    if (kind === 25) {
      base.assign(objectBed(p.xz, U.fieldSpan.x));
      rough.assign(0.22);
      metal.assign(0.48);
    }
    if (kind === 26) {
      const spacing = vExtra.x;
      const px = p.x.add(spacing.mul(0.5));
      const x = abs(px.sub(spacing.mul(floor(px.div(spacing)))).sub(spacing.mul(0.5)));
      const bare = float(1).sub(smoothstep(spacing.mul(0.128), spacing.mul(0.132), x));
      base.assign(mix(base, vec3(0.75, 0.75, 0.685), bare));
      base.mulAssign(noise(p.xz.mul(105)).mul(0.055).add(0.96));
      rough.assign(0.7);
      n.assign(normalize(n.add(vec3(noise(p.xz.mul(168)).sub(0.5), 0, noise(p.zx.mul(163)).sub(0.5)).mul(0.035))));
    }
    if (kind === 21 || kind === 22) {
      const lift = max(p.y.sub(0.048), 0).toVar();
      const grazing = pow(max(float(1).sub(ndv), 0), 3);
      const through = refract(v.negate(), n, 0.69).toVar();
      const q = p.xz.add(through.xz.mul(max(p.y, 0.008).div(max(float(0.18), through.y.negate())))).toVar();
      const under = (kind === 21 ? glassBed(q) : objectBed(q, U.fieldSpan.x)).toVar();
      transmittedBase = under;
      const cloud = noise(vUv.mul(vec2(12, 26))).mul(0.28).add(noise(vUv.mul(vec2(43, 87))).mul(0.065));
      const cell = vUv.mul(vec2(85, 130)).toVar();
      const bubble = float(1).sub(smoothstep(0.11, 0.16, length(fract(cell).sub(0.5)))).mul(step(0.983, hash(floor(cell))));
      if (kind === 21) {
        base.assign(mix(under, base, cloud.mul(0.25).add(0.14)));
        base.addAssign(vec3(bubble.mul(0.072)));
        rough.assign(mix(float(0.27), float(0.16), smoothstep(0, 0.6, lift)));
        n.assign(normalize(n.add(vec3(noise(vUv.mul(150)).sub(0.5), 0, noise(vUv.yx.mul(120)).sub(0.5)).mul(0.011))));
        transmission.assign(0.48);
        ao.assign(smoothstep(0, 0.25, lift).mul(0.07).add(0.93));
      } else {
        base.assign(mix(under, base, grazing.mul(0.024).add(0.018)));
        rough.assign(0.064);
        const a = vUv.x.mul(180).add(vUv.y.mul(35)).add(noise(vUv.mul(vec2(8, 17))).mul(3)).toVar();
        n.assign(normalize(n.add(vec3(sin(a).mul(0.0025), 0, cos(a.mul(0.72)).mul(0.0012)))));
        const irid = pow(max(float(1).sub(ndv), 0), 2);
        base.addAssign(vec3(0.013, 0.007, 0.02).mul(irid).mul(sin(lift.mul(8)).mul(0.5).add(0.5)));
        transmission.assign(0.7);
      }
    }
    if (kind === 32) {
      rough.assign(0.37);
      base.mulAssign(noise(vUv.mul(220)).mul(0.02).add(0.99));
      If(frontFacing.not(), () => {
        base.assign(mix(base, vec3(0.48, 0.46, 0.4), 0.34));
        rough.assign(0.64);
      });
    }
    if (kind === 23) {
      const edge = smoothstep(0.43, 0.48, abs(vUv.x.sub(0.5)));
      base.assign(mix(vec3(0.5, 0.373, 0.16), base, edge.mul(0.68)));
      rough.assign(0.82);
      base.mulAssign(noise(vUv.mul(vec2(190, 3800))).mul(0.09).add(0.945));
      If(frontFacing.not(), () => {
        base.assign(mix(base, vec3(0.77, 0.69, 0.49), 0.6));
        rough.assign(0.62);
      });
      const fibre = noise(p.xz.mul(160));
      n.assign(normalize(n.add(vec3(fibre.sub(0.5), 0, noise(p.zx.mul(187)).sub(0.5)).mul(0.03))));
    }
    if (kind === 27) {
      const phase = dyeAt(vUv).r.toVar();
      rough.assign(mix(float(0.69), float(0.073), phase));
      base.mulAssign(mix(float(0.98), float(0.33), phase));
      base.addAssign(base.mul(0.1).mul(smoothstep(0.65, 1, phase)));
      n.assign(normalize(n.add(vec3(noise(p.xz.mul(140)).sub(0.5), 0, noise(p.zx.mul(153)).sub(0.5)).mul(float(1).sub(phase).mul(0.022)))));
      const flame = exp(length(p.xz.sub(vec2(U.fieldSpan.x.div(1.22).mul(-0.08), -0.75))).mul(-0.9));
      emission = vec3(0.26, 0.094, 0.017).mul(flame).mul(0.45).toVar();
      transmission.assign(phase.mul(0.15));
    }
    if (kind === 28) {
      const hot = smoothstep(0.04, 0.52, vUv.x).toVar();
      const bed = waterBed(p.xz.add(n.xz.mul(p.y.mul(0.3).add(0.42))));
      const frost = float(1).sub(hot).mul(noise(p.xz.mul(85).add(p.y.mul(15))).mul(0.025).add(0.024));
      const core = pow(clamp(float(1).sub(abs(n.y)), 0, 1), 2);
      base.assign(mix(bed.mul(0.94), vec3(0.08, 0.24, 0.29), core.mul(0.3)).add(vec3(frost)));
      rough.assign(mix(float(0.11), float(0.032), hot));
      base.addAssign(vec3(step(0.9955, hash(floor(p.xz.mul(70).add(p.y.mul(28))))).mul(0.07)));
      transmission.assign(0.78);
      ao.assign(0.89);
    }
    if (kind === 29) {
      base.assign(waterBed(p.xz.add(n.xz.mul(0.45))));
      rough.assign(0.055);
      transmission.assign(0.5);
    }
    if (kind === 31) {
      base.assign(waterBed(p.xz.add(n.xz.mul(0.45))).mul(0.95));
      rough.assign(0.032);
      transmission.assign(0.72);
    }
    if (kind === 30) {
      const glow = mix(vec3(2.1, 0.42, 0.025), vec3(4.8, 2.7, 0.58), clamp(n.y.mul(0.35).add(0.6), 0, 1));
      return vec4(pow(aces(glow), vec3(1 / 2.2)), 1);
    }

    const l = L_TACTILE;
    const hvec = normalize(l.add(v));
    const ndl = max(dot(n, l), 0).toVar();
    const ndh = max(dot(n, hvec), 0);
    const vdh = max(dot(v, hvec), 0);
    const a = rough.mul(rough);
    const a2 = a.mul(a).toVar();
    const den = ndh.mul(ndh).mul(a2.sub(1)).add(1).toVar();
    const D = a2.div(max(den.mul(den).mul(Math.PI), 0.00001));
    const k = rough.add(1).mul(rough.add(1)).mul(0.125).toVar();
    const G1 = ndv.div(ndv.mul(float(1).sub(k)).add(k));
    const G2 = ndl.div(ndl.mul(float(1).sub(k)).add(k));
    const f0 = mix(vec3(kind === 28 ? 0.022 : kind === 29 ? 0.02 : 0.04), base, metal).toVar();
    const F = fresnelSchlick(vdh, f0);
    const Fr = fresnelSchlick(ndv, f0).toVar();
    let shadowed = shadowAt(vLight, n);
    if (kind === 21 || kind === 22) shadowed = mix(float(0.7), float(1), shadowed);
    if (kind === 28) shadowed = mix(float(0.72), float(1), shadowed);
    if (kind === 29) shadowed = mix(float(0.76), float(1), shadowed);
    const sh = float(shadowed).toVar();
    const diffuse = base.mul(vec3(0.4, 0.44, 0.445).add(vec3(1.24, 1.16, 1.02).mul(ndl).mul(sh))).mul(float(1).sub(metal.mul(0.84)));
    const spec = D.mul(G1).mul(G2).mul(F).div(max(ndv.mul(4).mul(max(ndl, 0.001)), 0.001)).mul(ndl).mul(sh).mul(0.3).toVar();
    const env = studio(reflect(v.negate(), n), rough).toVar();
    const lit = diffuse.mul(ao).add(env.mul(Fr).mul(float(1).sub(rough.mul(0.6)))).add(min(spec, vec3(0.55))).toVar();
    if (emission) lit.addAssign(emission);
    if (kind === 22) {
      // Thin dielectric transmission keeps the substrate lighting; the fold changes
      // refraction and reflection, not the bed normal.
      const bedF = fresnelSchlick(max(v.y, 0.001), mix(vec3(0.04), transmittedBase, 0.48));
      const bedLit = transmittedBase
        .mul(vec3(0.4, 0.44, 0.445).add(vec3(1.24, 1.16, 1.02).mul(Math.max(L_TACTILE_Y, 0))))
        .mul(0.5968)
        .add(studio(reflect(v.negate(), vec3(0, 1, 0)), float(0.22)).mul(bedF).mul(0.868));
      const transmit = vec3(1).sub(Fr).mul(vec3(1).sub(Fr)).toVar();
      lit.assign(bedLit.mul(transmit).add(env.mul(vec3(1).sub(transmit))).add(min(spec, vec3(0.35))));
    }
    if (kind === 27) {
      const wr = reflect(v.negate(), n).toVar();
      const liquid = dyeAt(vUv).r;
      const reflection = exp(pow(abs(wr.z.add(0.265).div(0.021)), 4).add(pow(abs(wr.x.add(0.15).div(0.72)), 8)).negate());
      lit.addAssign(vec3(0.62, 0.54, 0.4).mul(reflection).mul(liquid).add(base.mul(pow(max(float(1).sub(ndv), 0), 2)).mul(0.13)));
    }
    if (kind === 21) lit.addAssign(env.mul(0.015).mul(clamp(p.y, 0, 1)));
    lit.addAssign(env.mul(pow(max(float(1).sub(ndv), 0), 4)).mul(0.06).mul(transmission));
    return vec4(pow(aces(lit.mul(1.05)), vec3(1 / 2.2)), 1);
  };

  /** Fragment stage for one kind (static branches: each kind compiles only its own code). */
  const fragmentStage = (kind, vs) => {
    const vWorld = varying(vs.world);
    const vNormal = varying(vs.normal);
    const vColor = varying(vs.color);
    const vUv = varying(vs.uv);
    const vExtra = varying(vs.extra);
    const vLight = varying(U.lightVP.mul(vec4(vs.world, 1)));
    return Fn(() => {
      const p = vWorld.toVar();
      const n = normalize(vNormal).toVar();
      const base = vec3(vColor).toVar();
      const rough = float(0.75).toVar();
      const metal = float(0).toVar();
      const ao = float(1).toVar();
      const grain = hash(floor(p.xz.mul(480).add(p.y.mul(139)))).toVar();

      if (HEIGHT_KINDS.has(kind)) {
        If(vExtra.y.greaterThan(0.5).and(n.y.greaterThan(0.02)), () => {
          const e = U.texel;
          const dx = heightAt(vUv.add(vec2(e.x, 0))).sub(heightAt(vUv.sub(vec2(e.x, 0)))).div(U.fieldSpan.x.mul(e.x).mul(2));
          const dz = heightAt(vUv.add(vec2(0, e.y))).sub(heightAt(vUv.sub(vec2(0, e.y)))).div(U.fieldSpan.y.mul(e.y).mul(2));
          n.assign(normalize(n.add(vec3(dx.negate(), 0, dz.negate()).mul(n.y))));
        });
      }
      if (kind >= 21) return tactileShade(kind, { p, n, base, vUv, vExtra, vLight });

      if (kind === 1 || kind === 11) {
        base.mulAssign(grain.mul(0.2).add(0.9));
        base.mulAssign(float(1).sub(pow(hash(floor(p.xy.mul(110).add(p.z.mul(18)))), 18).mul(0.25)));
        rough.assign(0.95);
        n.assign(normalize(n.add(vec3(grain.sub(0.5), 0, hash(p.xz.mul(379)).sub(0.5)).mul(0.07))));
        if (kind === 1) ao.mulAssign(smoothstep(-0.1, 0.035, heightAt(vUv)).mul(0.21).add(0.79));
      }
      if (kind === 2) {
        rough.assign(vExtra.x);
        metal.assign(1);
        base.mulAssign(sin(p.y.mul(630).add(p.z.mul(120))).mul(0.06).add(0.94));
      }
      if (kind === 3) {
        rough.assign(0.43);
        base.mulAssign(noise(p.xz.mul(24).add(p.y.mul(11))).mul(0.02).add(0.99));
      }
      if (kind === 4) {
        rough.assign(0.13);
        metal.assign(0.22);
        const view = normalize(U.eye.sub(p));
        const f = pow(max(float(1).sub(abs(dot(n, view))), 0), 2).toVar();
        const rainbow = vec3(0.5).add(cos(vec3(0, 2.1, 4.2).add(f.mul(8).add(p.x.mul(0.5)).add(p.z.mul(0.3)))).mul(0.5));
        base.assign(mix(base, rainbow.mul(0.48).add(0.11), f.mul(0.38).add(0.25)));
        ao.assign(max(n.y, 0).mul(0.14).add(0.86));
      }
      if (kind === 5) {
        rough.assign(0.055);
        metal.assign(0.02);
        const q = p.xz.add(n.xz.mul(0.5)).toVar();
        // Refract the bed through the surface normal: a Voronoi pebble floor.
        const bed = q.mul(0.95).toVar();
        const cell = floor(bed).toVar();
        const fb = fract(bed).toVar();
        const f1 = float(9).toVar();
        const f2 = float(9).toVar();
        const win = vec2(0).toVar();
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const c = cell.add(vec2(i, j)).toVar();
            const d = vec2(i, j).add(vec2(hash(c), hash(c.add(9.3)))).sub(fb);
            const dd = dot(d, d).toVar();
            const nearer = dd.lessThan(f1).toVar();
            f2.assign(select(nearer, f1, min(f2, dd)));
            win.assign(select(nearer, c, win));
            f1.assign(select(nearer, dd, f1));
          }
        }
        const edge = smoothstep(0.012, 0.075, f2.sub(f1));
        const stone = mix(vec3(0.24, 0.31, 0.17), vec3(0.53, 0.5, 0.31), hash(win.add(3.7))).mul(edge.mul(0.34).add(0.66));
        const ca = q.mul(1.9).toVar();
        const tt = U.time.mul(0.17).toVar();
        const w1 = sin(ca.x.mul(2.1).add(sin(ca.y.mul(2.7).add(tt))).add(tt));
        const w2 = sin(ca.y.mul(2.5).add(sin(ca.x.mul(2.3).sub(tt))).sub(tt));
        const c1 = pow(clamp(float(1).sub(abs(w1.add(w2)).mul(0.68)), 0, 1), 13);
        const c2 = pow(clamp(float(1).sub(abs(sin(ca.x.mul(3.7).sub(tt)).add(sin(ca.y.mul(3.4).add(tt)))).mul(0.65)), 0, 1), 22);
        const shade = smoothstep(0.29, 0.65, noise(p.xz.mul(0.68).add(vec2(U.time.mul(0.012), 0)))).mul(0.46).add(0.54).toVar();
        base.assign(mix(stone.mul(0.55), vColor, 0.72).mul(shade).mul(noise(q.mul(74)).mul(0.28).add(0.72)));
        base.addAssign(vec3(0.13, 0.25, 0.13).mul(c1.mul(0.55).add(c2.mul(0.25))).mul(shade));
        n.assign(normalize(n.add(vec3(
          noise(p.xz.mul(13).add(U.time.mul(0.06))).sub(0.5).mul(0.014),
          0,
          noise(p.zx.mul(13).sub(U.time.mul(0.05))).sub(0.5).mul(0.014)
        ))));
        ao.assign(0.93);
      }
      if (kind === 6) {
        rough.assign(0.88);
        base.mulAssign(grain.mul(0.02).add(0.99));
        ao.mulAssign(smoothstep(-0.4, 0.05, heightAt(vUv)).mul(0.22).add(0.78));
      }
      if (kind === 7) {
        rough.assign(0.18);
        metal.assign(0.12);
        const lum = vec3(0.3, 0.5, 0.2);
        const ink = (t) => pow(dyeAt(t).rgb, vec3(2.2));
        base.assign(ink(vUv));
        const lv = dot(base, lum).toVar();
        const dx = dot(ink(vUv.add(vec2(U.texel.x, 0))), lum).sub(lv);
        const dz = dot(ink(vUv.add(vec2(0, U.texel.y))), lum).sub(lv);
        n.assign(normalize(vec3(dx.mul(-0.8), 1, dz.mul(-0.8))));
      }
      if (kind === 8) {
        rough.assign(0.62);
        const g = noise(vec2(p.x.mul(0.7), p.z.mul(15))).toVar();
        base.mulAssign(g.mul(0.2).add(0.8).add(sin(p.z.mul(155).add(g.mul(9)).add(p.y.mul(82))).mul(0.07)));
      }
      if (kind === 12) {
        rough.assign(0.09);
        metal.assign(0.035);
        const tt = U.time.mul(2.1).toVar();
        const q = p.xz.add(n.xz.mul(0.7)).toVar();
        const flow = vec2(q.x.mul(3.4), q.y.mul(0.72).sub(tt)).toVar();
        const warp = noise(flow.mul(0.47)).mul(2).toVar();
        const nh = noise(flow.add(vec2(warp, 0))).mul(0.65).add(noise(flow.mul(vec2(3.7, 1.9))).mul(0.24)).add(noise(flow.mul(vec2(12, 3.1))).mul(0.08));
        const dx = noise(flow.add(vec2(warp.add(0.07), 0))).sub(noise(flow.add(vec2(warp.sub(0.07), 0)))).mul(1.7);
        const dz = noise(flow.add(vec2(warp, 0.13))).sub(noise(flow.add(vec2(warp, -0.13)))).mul(0.38);
        n.assign(normalize(n.add(vec3(dx, 0, dz))));
        const fine = pow(noise(vec2(q.x.mul(72).add(warp.mul(3)), q.y.mul(3.8).sub(tt.mul(3)))), 6);
        base.mulAssign(nh.mul(0.49).add(0.14));
        base.addAssign(vec3(0.028, 0.068, 0.062).mul(fine));
        const foam = smoothstep(0.045, 0.26, abs(heightAt(vUv)));
        base.assign(mix(base, vec3(0.47, 0.71, 0.65), foam.mul(0.55)));
        ao.assign(0.95);
      }
      if (kind === 13) {
        rough.assign(0.095);
        metal.assign(0.015);
        const q0 = vec2(p.x.mul(0.8), p.z.mul(0.31).sub(U.time.mul(0.15))).toVar();
        const warp = noise(q0.mul(0.7)).mul(1.5);
        const q = vec2(q0.x.add(warp), q0.y).toVar();
        const dx = noise(q.add(vec2(0.07, 0))).sub(noise(q.sub(vec2(0.07, 0)))).mul(2.6);
        const dz = noise(q.add(vec2(0, 0.07))).sub(noise(q.sub(vec2(0, 0.07)))).mul(0.65);
        const fine = noise(q.mul(3.2).add(vec2(0, U.time.mul(-0.08)))).sub(0.5).mul(0.06);
        n.assign(normalize(n.add(vec3(dx.add(fine), 0, dz))));
        base.mulAssign(noise(q.mul(1.4)).mul(0.07).add(0.32));
        ao.assign(0.97);
      }
      if (kind === 14) {
        const paint = dyeAt(vUv).toVar();
        base.assign(pow(paint.rgb, vec3(2.2)));
        rough.assign(mix(float(0.94), float(0.27), paint.a));
        base.mulAssign(noise(p.xz.mul(96)).mul(0.09).add(0.95));
        const e = U.texel;
        const dx = dyeAt(vUv.add(vec2(e.x, 0))).a.sub(dyeAt(vUv.sub(vec2(e.x, 0))).a);
        const dz = dyeAt(vUv.add(vec2(0, e.y))).a.sub(dyeAt(vUv.sub(vec2(0, e.y))).a);
        n.assign(normalize(vec3(dx.mul(-0.31).add(grain.sub(0.5).mul(0.09)), 1, dz.mul(-0.31))));
      }
      if (kind === 15 || kind === 16) {
        rough.assign(0.4);
        base.mulAssign(noise(p.xz.mul(135)).mul(0.025).add(0.975));
        if (kind === 16) {
          If(frontFacing.not(), () => {
            base.mulAssign(0.68);
            rough.assign(0.85);
          });
          n.assign(faceForward(n, normalize(U.eye.sub(p)).negate(), n));
        }
      }
      if (kind === 18) {
        const coat = smoothstep(vExtra.y.sub(0.48).add(vExtra.x.mul(1.02)), vExtra.y.sub(0.44).add(vExtra.x.mul(1.02)), p.y).toVar();
        coat.assign(select(vExtra.x.lessThan(0.005), float(1), coat));
        base.assign(mix(vec3(0.07, 0.025, 0.011), base, coat));
        rough.assign(mix(float(0.085), float(0.44), coat));
        base.mulAssign(grain.mul(0.04).add(0.98));
      }
      if (kind === 19) {
        rough.assign(0.84);
        base.mulAssign(noise(p.xy.mul(130).add(p.z.mul(31))).mul(0.24).add(0.83));
        n.assign(normalize(n.add(vec3(grain.sub(0.5), hash(p.yz.mul(500)).sub(0.5), 0).mul(0.12))));
      }
      if (kind === 20) {
        rough.assign(0.14);
        metal.assign(0.03);
        base.mulAssign(noise(p.xz.mul(20)).mul(0.025).add(0.97));
      }

      const l = L_MAIN;
      const view = normalize(U.eye.sub(p)).toVar();
      const r = reflect(view.negate(), n).toVar();
      const halfV = normalize(l.add(view));
      const ndl = max(dot(n, l), 0).toVar();
      const ndv = max(dot(n, view), 0).toVar();
      const shade = shadowAt(vLight, n).toVar();
      const spec = pow(max(dot(n, halfV), 0), mix(float(150), float(8), rough));
      const env = environment(r, rough).toVar();
      const f0 = mix(vec3(0.035), base, metal).toVar();
      const fresnel = f0.add(vec3(1).sub(f0).mul(pow(clamp(float(1).sub(ndv), 0, 1), 5)));
      const lit = base.mul(vec3(0.28, 0.33, 0.29).add(vec3(1.65, 1.58, 1.43).mul(ndl).mul(shade))).mul(float(1).sub(metal.mul(0.85))).mul(ao).toVar();
      lit.addAssign(env.mul(fresnel).mul(float(1).sub(rough.mul(0.5))).mul(ao));
      lit.addAssign(mix(vec3(0.13), base, metal).mul(spec).mul(shade).mul(float(1).sub(rough.mul(0.8))));
      if (kind === 13 || kind === 18) {
        const softbox = exp(pow(abs(r.x.add(0.12).div(0.13)), 2).add(pow(abs(r.z.add(0.16).div(0.23)), 2)).negate()).mul(smoothstep(0.5, 0.9, r.y));
        lit.addAssign(vec3(0.12, 0.105, 0.09).mul(softbox));
      }
      if (kind === 2) lit.addAssign(base.mul(ndl).mul(0.15));
      if (kind === 1 || kind === 11) lit.addAssign(base.mul(pow(max(float(1).sub(ndv), 0), 3)).mul(0.15));
      const c = pow(aces(lit.mul(EXPOSURE)), vec3(1 / 2.2)).add(hash(screenCoordinate.xy).sub(0.5).div(255));
      return vec4(c, 1);
    })();
  };

  const kindMaterials = new Map();
  const depthMaterials = new Map();
  return {
    U,
    /** The display material for a kind (built once, shared by every batch of that kind). */
    material(kind) {
      let m = kindMaterials.get(kind);
      if (!m) {
        const vs = vertexStage(kind);
        m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
        m.name = `still kind ${kind}`;
        m.positionNode = vs.world;
        m.fragmentNode = fragmentStage(kind, vs);
        kindMaterials.set(kind, m);
      }
      return m;
    },
    /** The shadow-pass material: only the vertex motion matters, so three variants cover every kind. */
    depthMaterial(kind) {
      const variant = HEIGHT_KINDS.has(kind) ? 1 : kind === 16 ? 16 : 2;
      let m = depthMaterials.get(variant);
      if (!m) {
        const vs = vertexStage(variant);
        m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false, colorWrite: false });
        m.name = `still depth ${variant}`;
        m.positionNode = vs.world;
        m.fragmentNode = vec4(1);
        depthMaterials.set(variant, m);
      }
      return m;
    },
  };
}

/* ---------------------------------------------------------------- the bridge */

/**
 * @param {object} kit                    from boot()
 * @param {{fieldBytes: Uint8Array, dye: Uint8Array, size: number}} data  the game's two RGBA8 fields
 */
export function createStillRenderer(kit, { fieldBytes, dye, size }) {
  const renderer = kit.renderer;
  const webgpu = kit.backend === 'webgpu';
  // The material code does its own tone curve and display gamma.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const dataTexture = (bytes) => {
    const t = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const fieldTex = dataTexture(fieldBytes);
  const dyeTex = dataTexture(dye);

  // Shadow map size follows the quality tier at load (2048 on high).
  const shadowSize = kit.shadowSize(2048);
  const shadowTex = new THREE.DepthTexture(shadowSize, shadowSize);
  shadowTex.compareFunction = THREE.LessEqualCompare;
  const linearCompare = renderer.hasCompatibility?.(THREE.Compatibility.TEXTURE_COMPARE) ?? true;
  shadowTex.minFilter = shadowTex.magFilter = linearCompare ? THREE.LinearFilter : THREE.NearestFilter;
  const shadowTarget = new THREE.RenderTarget(shadowSize, shadowSize, { depthBuffer: true, generateMipmaps: false });
  shadowTarget.depthTexture = shadowTex;

  const mats = createMaterials({ fieldTex, dyeTex, shadowTex, webgpu });
  const U = mats.U;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.08, 0.19, 0.16);
  const shadowScene = new THREE.Scene();

  const coordinateSystem = renderer.coordinateSystem;
  const perspective = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  const lightCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  for (const c of [perspective, ortho, lightCamera]) {
    c.coordinateSystem = coordinateSystem;
    c.updateProjectionMatrix();
  }
  const target = new THREE.Vector3();
  let mainCamera = perspective;

  const fitCamera = (camera, view, isPerspective) => {
    if (isPerspective) {
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(view.height / (2 * view.distance)));
      camera.aspect = view.width / view.height;
    } else {
      camera.left = -view.width / 2;
      camera.right = view.width / 2;
      camera.top = view.height / 2;
      camera.bottom = -view.height / 2;
    }
    camera.position.fromArray(view.eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(target.fromArray(view.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };

  // Vertex data per game geometry, shared by every batch that draws it.
  const geometries = new Map();
  const geometryFor = (g) => {
    let e = geometries.get(g.id);
    if (!e) {
      const usage = g.dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;
      e = {
        position: new THREE.BufferAttribute(g.p, 3).setUsage(usage),
        normal: new THREE.BufferAttribute(g.n, 3).setUsage(usage),
        uv: new THREE.BufferAttribute(g.u, 2).setUsage(usage),
        index: new THREE.BufferAttribute(g.i, 1),
        version: g.version,
      };
      geometries.set(g.id, e);
    } else if (g.dynamic && e.version !== g.version) {
      e.position.needsUpdate = e.normal.needsUpdate = e.uv.needsUpdate = true;
      e.version = g.version;
    }
    return e;
  };

  const bounds = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const instanceGeometry = (vertex, data) => {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', vertex.position);
    geo.setAttribute('normal', vertex.normal);
    geo.setAttribute('uv', vertex.uv);
    geo.setIndex(vertex.index);
    const buffer = new THREE.InstancedInterleavedBuffer(data, STRIDE, 1);
    buffer.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iOffset', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    geo.setAttribute('iScale', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
    geo.setAttribute('iQuat', new THREE.InterleavedBufferAttribute(buffer, 4, 6));
    geo.setAttribute('iColor', new THREE.InterleavedBufferAttribute(buffer, 3, 10));
    geo.setAttribute('iExtra', new THREE.InterleavedBufferAttribute(buffer, 2, 13));
    geo.boundingSphere = bounds;
    geo.instanceCount = 0;
    return { geo, buffer };
  };

  const batchMeshes = new Map();
  const shown = [];
  const meshFor = (b) => {
    let c = batchMeshes.get(b.id);
    if (!c) {
      const { geo, buffer } = instanceGeometry(geometryFor(b.g), b.data);
      const mesh = new THREE.Mesh(geo, mats.material(b.kind));
      const caster = new THREE.Mesh(geo, mats.depthMaterial(b.kind));
      for (const m of [mesh, caster]) {
        m.frustumCulled = false;
        m.matrixAutoUpdate = false;
        m.visible = false;
      }
      scene.add(mesh);
      shadowScene.add(caster);
      c = { mesh, caster, geo, buffer };
      batchMeshes.set(b.id, c);
    }
    return c;
  };

  return {
    canvas: kit.canvas,
    name: `three.js r${THREE.REVISION} · ${kit.backendLabel}`,
    shadowSize,
    upload(field, dyeData) {
      if (field) fieldTex.needsUpdate = true;
      if (dyeData) dyeTex.needsUpdate = true;
    },
    /** Draw this frame's batches (the game's Batches.used) as seen from world.camera. */
    render(batches, world) {
      const view = world.camera;
      mainCamera = view.perspective ? perspective : ortho;
      fitCamera(mainCamera, view, !!view.perspective);
      fitCamera(lightCamera, world.light, false);
      U.lightVP.value.multiplyMatrices(lightCamera.projectionMatrix, lightCamera.matrixWorldInverse);
      U.time.value = world.time;
      U.eye.value.fromArray(view.eye);
      U.heightScale.value = world.heightScale;
      U.fieldSpan.value.fromArray(world.fieldSpan);

      for (const c of shown) c.mesh.visible = c.caster.visible = false;
      shown.length = 0;
      for (let i = 0; i < batches.length; i++) {
        const b = batches[i];
        if (!b.count) continue;
        geometryFor(b.g);
        const c = meshFor(b);
        c.buffer.clearUpdateRanges();
        c.buffer.addUpdateRange(0, b.count * STRIDE);
        c.buffer.needsUpdate = true;
        c.geo.instanceCount = b.count;
        c.mesh.visible = true;
        c.mesh.renderOrder = i;
        c.caster.visible = b.cast;
        shown.push(c);
      }

      renderer.setRenderTarget(shadowTarget);
      renderer.render(shadowScene, lightCamera);
      renderer.setRenderTarget(null);
      renderer.render(scene, mainCamera);
    },
    /**
     * Compile the display shaders for these kinds in the background, so the first
     * visit to an exhibit does not stall on shader compiles. Safe to skip.
     */
    async warm(kinds) {
      const g = { id: -1, p: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), n: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), u: new Float32Array(6), i: new Uint32Array([0, 1, 2]) };
      const vertex = {
        position: new THREE.BufferAttribute(g.p, 3),
        normal: new THREE.BufferAttribute(g.n, 3),
        uv: new THREE.BufferAttribute(g.u, 2),
        index: new THREE.BufferAttribute(g.i, 1),
      };
      const { geo } = instanceGeometry(vertex, new Float32Array(STRIDE));
      geo.instanceCount = 1;
      const warmScene = new THREE.Scene();
      for (const kind of kinds) {
        const m = new THREE.Mesh(geo, mats.material(kind));
        m.frustumCulled = false;
        warmScene.add(m);
      }
      await renderer.compileAsync(warmScene, mainCamera);
      geo.dispose();
    },
  };
}
