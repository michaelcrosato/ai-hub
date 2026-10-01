/**
 * The city on three.js (WebGPU with WebGL2 fallback).
 *
 * Every surface is a box, exactly as in the original renderer: each block is
 * one instanced batch of unit cubes (kit.instanced, so all batches share one
 * shader), glowing fixtures are one more batch, and doors, props, fuses,
 * recorders, bottles, the gate and the listeners live in dynamic batches.
 *
 * Lighting follows the original shader: a cold hemisphere ambient, the moon
 * (shadowed, texel-snapped to the player so it never swims), the flashlight
 * (a shadowed spot from the hand, not the eye) and the nearest ceiling and
 * street lamps (shadowed downward spots, more of them on higher tiers).
 * Exponential fog, world-space grain, Reinhard tone mapping with the
 * brightness setting as exposure, and bloom on lamps and fuses.
 */

import * as THREE from 'three/webgpu';
import { asin, dot, exp, float, floor, fog, fract, length, mix, positionView, positionWorld, positionWorldDirection, pow, sin, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { GROUND_Y as G } from './config.js';
import { distance } from './math.js';
import { LIGHTING, PALETTE, flashlightState, playerShadowParts, selectLights } from './world.js';

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MOON = new THREE.Vector3(...LIGHTING.moon);
const MOON_RIGHT = new THREE.Vector3(0, 1, 0).cross(MOON).normalize();
const MOON_UP = MOON.clone().cross(MOON_RIGHT);
const MOON_HALF = 36;
const LAMP_SLOTS = { low: 1, medium: 2, high: 4, ultra: 4 };
const LAMP_ANGLE = (76 * Math.PI) / 180;
const LAMP_PENUMBRA = 1 - 48 / 76;
const WARM = [1.7, 1.12, 0.53];
const COOL = [0.65, 1.26, 1.37];
const FLASH_INTENSITY = 17 * Math.PI;
const BLOOM = 0.45;
const BOTTLE_SLOTS = 8;
const ENEMY_SLOTS = 3;
const GLASS_GREEN = [0.18, 0.36, 0.29];
const BODY = [0.045, 0.065, 0.068];
const BLIND_BODY = [0.06, 0.05, 0.055];
const EYE_CALM = [0.75 * 2.2, 0.75 * 2.2, 0.47 * 2.2];
const EYE_CHASE = [1 * 3.8, 0.16 * 3.8, 0.045 * 3.8];
const EYE_BLIND = [0.55 * 1.6, 0.25 * 1.6, 0.9 * 1.6];

// Scratch values, so per-frame updates allocate nothing.
const _p = [0, 0, 0];
const _s = [0, 0, 0];
const _a = [0, 0, 0];
const _c = [0, 0, 0];
const ZERO = [0, 0, 0];

/** Brightness of a ceiling or street lamp, matched to the original falloff at floor distance. */
function lampIntensity(range) {
  const d = range >= 14 ? 5 : 2.6;
  return Math.PI * d * d * (1 - d / range) ** 2 * (6.2 / (1 + 0.075 * d * d));
}

/** Box matrix (column-major) at slot i: rotate X, then Y, then Z (degrees), scale, translate. */
function writeBox(mesh, i, p, s, a) {
  const m = mesh.instanceMatrix.array;
  const o = i * 16;
  let r00 = 1, r01 = 0, r02 = 0, r10 = 0, r11 = 1, r12 = 0, r20 = 0, r21 = 0, r22 = 1;
  if (a && (a[0] || a[1] || a[2])) {
    const k = Math.PI / 180;
    const ca = Math.cos(a[0] * k), sa = Math.sin(a[0] * k);
    const cb = Math.cos(a[1] * k), sb = Math.sin(a[1] * k);
    const cg = Math.cos(a[2] * k), sg = Math.sin(a[2] * k);
    r00 = cg * cb; r01 = cg * sb * sa - sg * ca; r02 = cg * sb * ca + sg * sa;
    r10 = sg * cb; r11 = sg * sb * sa + cg * ca; r12 = sg * sb * ca - cg * sa;
    r20 = -sb; r21 = cb * sa; r22 = cb * ca;
  }
  m[o] = r00 * s[0]; m[o + 1] = r10 * s[0]; m[o + 2] = r20 * s[0]; m[o + 3] = 0;
  m[o + 4] = r01 * s[1]; m[o + 5] = r11 * s[1]; m[o + 6] = r21 * s[1]; m[o + 7] = 0;
  m[o + 8] = r02 * s[2]; m[o + 9] = r12 * s[2]; m[o + 10] = r22 * s[2]; m[o + 11] = 0;
  m[o + 12] = p[0]; m[o + 13] = p[1]; m[o + 14] = p[2]; m[o + 15] = 1;
}

/** A zero matrix draws nothing. */
function hideBox(mesh, i) {
  mesh.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
}

function writeColor(mesh, i, rgb, k = 1) {
  const c = mesh.instanceColor.array;
  c[i * 3] = rgb[0] * k;
  c[i * 3 + 1] = rgb[1] * k;
  c[i * 3 + 2] = rgb[2] * k;
}

/** Glow colour: the original added base × emissive on top of the lighting. */
function glowScale(c) {
  return c[3] >= 1 ? c[3] : 0.6;
}

export class WorldView {
  constructor(kit, settings) {
    this.kit = kit;
    this.settings = settings;
    const r = kit.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ReinhardToneMapping;
    this.scene = new THREE.Scene();
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(settings.fov, 1, 0.06, 240));
    this.exposure = uniform(1);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.statics = [];
    this.selected = [];
    this.parts = [];
    this.lightCount = 0;
    this.instances = 0;
    this.buildMaterials();
    this.buildSky();
    this.buildLights();
    this.post = createPost(kit, this.scene, this.camera, { bloom: { strength: BLOOM, radius: 0.3, threshold: 0.6 } });
    this.apply(settings);
  }

  buildMaterials() {
    // World-space grain from the original shader: lit *= 0.965 + grain * 0.07.
    const cell = floor(positionWorld.xz.mul(15)).add(positionWorld.y);
    const grain = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
    this.litMat = new THREE.MeshPhongNodeMaterial({ specular: new THREE.Color(0.06, 0.06, 0.06), shininess: 40 });
    this.litMat.name = 'city';
    this.litMat.colorNode = vec4(vec3(grain.mul(0.07).add(0.965)), 1);
    this.glowMat = new THREE.MeshBasicNodeMaterial();
    this.glowMat.name = 'glow';
    // The player's body exists only in shadow maps (layer 1); it is never drawn.
    this.shadowMat = new THREE.MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false });
    this.shadowMat.name = 'body-shadow';
    // Exponential distance fog, as the original: mix(lit, fog, 1 - exp(-d * 0.018)).
    this.scene.fogNode = fog(vec3(0.009, 0.019, 0.024), exp(positionView.length().mul(-0.018)).oneMinus());
  }

  buildSky() {
    // The original sky gradient, stars and moon, written in display colour and
    // converted back through the tone curve so the output matches it.
    const dir = positionWorldDirection;
    const h = asin(dir.y.clamp(-1, 1)).mul(0.7).add(0.5).clamp(0, 1);
    const base = mix(vec3(0.125, 0.178, 0.2), vec3(0.022, 0.049, 0.065), pow(h, float(1.2)));
    const cell = floor(dir.mul(380));
    const rnd = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
    const stars = step(0.9985, rnd).mul(pow(h, float(4))).mul(0.3);
    const md = length(dir.sub(vec3(MOON.x, MOON.y, MOON.z)));
    const disc = smoothstep(0.0226, 0.0244, md).oneMinus();
    const moon = vec3(0.38, 0.5, 0.48).mul(disc).add(vec3(0.045, 0.08, 0.075).mul(exp(md.mul(-14.4))));
    const display = base.add(stars).add(moon).clamp(vec3(0), vec3(0.94));
    const lin = pow(display, vec3(2.2));
    this.scene.backgroundNode = lin.div(lin.oneMinus()).div(this.exposure);
  }

  buildLights() {
    const s = this.scene;
    const k = this.kit;
    s.add(new THREE.HemisphereLight(new THREE.Color(0.47 * 0.145, 0.7 * 0.145, 0.73 * 0.145), new THREE.Color(0.47 * 0.085, 0.7 * 0.085, 0.73 * 0.085), Math.PI));

    const moon = (this.moon = new THREE.DirectionalLight(new THREE.Color(0.42 * 0.64, 0.57 * 0.64, 0.62 * 0.64), Math.PI));
    moon.castShadow = true;
    k.shadow(moon, 2048);
    const mc = moon.shadow.camera;
    mc.left = -MOON_HALF;
    mc.right = MOON_HALF;
    mc.top = MOON_HALF;
    mc.bottom = -MOON_HALF;
    mc.near = 1;
    mc.far = 260;
    mc.updateProjectionMatrix();
    mc.layers.enable(1); // the player's body blocks moonlight
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.035;
    moon.shadow.radius = 2;
    s.add(moon, moon.target);

    // The flashlight does not see the player's body: a light held in front must not light its own hidden body.
    const flash = (this.flash = new THREE.SpotLight(new THREE.Color(1, 0.96, 0.83), 0, LIGHTING.flashRange, Math.PI / 12, 0.5, 1));
    flash.castShadow = true;
    k.shadow(flash, 1024);
    flash.shadow.camera.near = 0.05;
    flash.shadow.bias = -0.0006;
    flash.shadow.normalBias = 0.02;
    flash.shadow.radius = 1.5;
    flash.shadow.autoUpdate = false;
    s.add(flash, flash.target);

    // A fixed pool of lamp lights (the count is part of every shader), moved to the nearest lamps each frame.
    this.lamps = [];
    const count = LAMP_SLOTS[k.tier.name] ?? 2;
    for (let i = 0; i < count; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 11, LAMP_ANGLE, LAMP_PENUMBRA, 2);
      l.castShadow = true;
      k.shadow(l, 1024);
      l.shadow.camera.near = 0.07;
      l.shadow.camera.up.set(0, 0, 1); // it looks straight down
      l.shadow.camera.layers.enable(1);
      l.shadow.bias = -0.0008;
      l.shadow.normalBias = 0.02;
      l.shadow.radius = 2;
      l.shadow.autoUpdate = false;
      s.add(l, l.target);
      this.lamps.push(l);
    }
  }

  batch(material, capacity, dynamic) {
    const mesh = this.kit.instanced(UNIT, material, Math.max(1, capacity));
    const n = mesh.instanceMatrix.count;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    if (dynamic) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.array.fill(0);
    }
    this.world.add(mesh);
    return mesh;
  }

  clearWorld() {
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      child.dispose?.();
    }
    this.statics.length = 0;
  }

  /** Build every batch for the game's current city. */
  setWorld(game) {
    this.clearWorld();
    const glow = [];
    let total = 0;
    for (const chunk of game.scene) {
      const lit = [];
      for (const b of chunk.items) (b.c[3] >= 1 ? glow : lit).push(b);
      if (!lit.length) continue;
      const mesh = this.batch(this.litMat, lit.length, false);
      for (let i = 0; i < lit.length; i++) {
        writeBox(mesh, i, lit[i].p, lit[i].s, lit[i].a);
        writeColor(mesh, i, lit[i].c);
      }
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.center = chunk.center;
      mesh.userData.radius = chunk.radius;
      this.statics.push(mesh);
      total += lit.length;
    }
    const g = this.batch(this.glowMat, glow.length, false);
    for (let i = 0; i < glow.length; i++) {
      writeBox(g, i, glow[i].p, glow[i].s, glow[i].a);
      writeColor(g, i, glow[i].c, glowScale(glow[i].c));
    }
    g.computeBoundingSphere();
    total += glow.length;

    // Doors and props change rarely: rewritten only when they move.
    this.props = game.objects.filter((o) => o.kind === 'prop');
    this.radios = game.objects.filter((o) => o.kind === 'radio');
    this.doorBatch = this.batch(this.litMat, game.doors.length * 2 + this.props.length, true);
    this.doorBatch.castShadow = this.doorBatch.receiveShadow = true;
    for (const d of game.doors) d.renderAngle = NaN;
    for (const o of this.props) o.rendered = null;
    // Everything else that moves is rewritten every frame.
    const fuses = game.city.fuses.length;
    this.moverBatch = this.batch(this.litMat, fuses * 2 + game.logs.length + BOTTLE_SLOTS + 12 + ENEMY_SLOTS * 4, true);
    this.moverBatch.castShadow = this.moverBatch.receiveShadow = true;
    this.glowBatch = this.batch(this.glowMat, fuses + this.radios.length + game.logs.length + 1 + ENEMY_SLOTS, true);
    this.body = this.batch(this.shadowMat, 12, true);
    this.body.castShadow = true;
    this.body.layers.set(1);
    this.instances = total;
  }

  apply(s) {
    this.settings = s;
    if (this.camera.fov !== s.fov) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
    const e = (s.brightness || 1.15) / 0.7;
    this.kit.renderer.toneMappingExposure = e;
    this.exposure.value = e;
    if (this.post.bloom) this.post.bloom.strength.value = s.bloom ? BLOOM : 0;
  }

  syncDoorsAndProps(game) {
    const db = this.doorBatch;
    let dirty = false;
    const doors = game.doors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.renderAngle === d.angle) continue;
      d.renderAngle = d.angle;
      const box = game.doorBox(d);
      writeBox(db, i * 2, box.p, box.s, box.a);
      writeColor(db, i * 2, box.c);
      const theta = (box.a[1] * Math.PI) / 180;
      _p[0] = box.p[0] + Math.cos(theta) * d.width * 0.3;
      _p[1] = box.p[1] - 0.05;
      _p[2] = box.p[2] - Math.sin(theta) * d.width * 0.3 - 0.07;
      _s[0] = 0.075; _s[1] = 0.09; _s[2] = 0.14;
      _a[0] = 0; _a[1] = box.a[1]; _a[2] = 0;
      writeBox(db, i * 2 + 1, _p, _s, _a);
      writeColor(db, i * 2 + 1, PALETTE.trim);
      dirty = true;
    }
    const base = doors.length * 2;
    for (let j = 0; j < this.props.length; j++) {
      const o = this.props[j];
      const r = o.rendered;
      if (r && r[0] === o.position[0] && r[1] === o.position[1] && r[2] === o.position[2] && r[3] === o.angle) continue;
      o.rendered = [o.position[0], o.position[1], o.position[2], o.angle];
      _a[0] = o.angle * 35; _a[1] = o.yaw; _a[2] = o.angle * 16;
      writeBox(db, base + j, o.position, o.size, _a);
      writeColor(db, base + j, PALETTE.metal);
      dirty = true;
    }
    if (dirty) {
      db.instanceMatrix.needsUpdate = true;
      db.instanceColor.needsUpdate = true;
    }
  }

  // Slot writers for the two per-frame batches (cursor-based, no allocation).
  lit(p, s, a, c) {
    writeBox(this.moverBatch, this.m, p, s, a);
    writeColor(this.moverBatch, this.m, c);
    this.m++;
  }
  glow(p, s, a, c, k) {
    writeBox(this.glowBatch, this.g, p, s, a);
    writeColor(this.glowBatch, this.g, c, k);
    this.g++;
  }
  skipLit(n) {
    for (let i = 0; i < n; i++) hideBox(this.moverBatch, this.m++);
  }
  skipGlow(n) {
    for (let i = 0; i < n; i++) hideBox(this.glowBatch, this.g++);
  }

  syncMovers(game, time) {
    const mb = this.moverBatch;
    const gb = this.glowBatch;
    this.m = 0;
    this.g = 0;
    const session = game.session;

    for (const f of game.city.fuses) {
      if (session.collected.has(f.id)) {
        this.skipLit(2);
        this.skipGlow(1);
        continue;
      }
      _p[0] = f.position[0]; _p[1] = f.position[1] + 0.03; _p[2] = f.position[2];
      _s[0] = 0.48; _s[1] = 0.14; _s[2] = 0.19;
      this.glow(_p, _s, ZERO, PALETTE.fuse, PALETTE.fuse[3]);
      for (let sign = -1; sign <= 1; sign += 2) {
        _p[0] = f.position[0] + sign * 0.2;
        _s[0] = 0.06; _s[1] = 0.16; _s[2] = 0.22;
        this.lit(_p, _s, ZERO, PALETTE.trim);
      }
    }
    // Signal-log recorders: a dark box with a slow blinking light.
    for (let i = 0; i < game.logs.length; i++) {
      const l = game.logs[i];
      if (session.logs.includes(l.id)) {
        this.skipLit(1);
        this.skipGlow(1);
        continue;
      }
      _s[0] = 0.34; _s[1] = 0.12; _s[2] = 0.2;
      this.lit(l.position, _s, ZERO, PALETTE.tape);
      _p[0] = l.position[0] + 0.1; _p[1] = l.position[1] + 0.062; _p[2] = l.position[2];
      _s[0] = 0.05; _s[1] = 0.012; _s[2] = 0.05;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(time * 2.4 + i * 1.7));
      this.glow(_p, _s, ZERO, PALETTE.signal, PALETTE.signal[3] * blink);
    }
    for (const o of this.radios) {
      if (!o.active) {
        this.skipGlow(1);
        continue;
      }
      _p[0] = o.position[0] + 0.12; _p[1] = o.position[1] + 0.01; _p[2] = o.position[2] - 0.108;
      _s[0] = 0.055; _s[1] = 0.035; _s[2] = 0.015;
      this.glow(_p, _s, ZERO, PALETTE.fuse, PALETTE.fuse[3]);
    }
    for (let i = 0; i < BOTTLE_SLOTS; i++) {
      const b = game.falling[i];
      if (!b) {
        this.skipLit(1);
        continue;
      }
      _s[0] = 0.16; _s[1] = 0.5; _s[2] = 0.16;
      _a[0] = b.angle; _a[1] = 0; _a[2] = b.angle * 0.7;
      this.lit(b.p, _s, _a, GLASS_GREEN);
    }
    // The gate, its bars and the panel light.
    const gate = game.gate;
    _p[0] = gate.p[0]; _p[1] = gate.p[1] + gate.lift; _p[2] = gate.p[2];
    this.lit(_p, gate.s, ZERO, PALETTE.metal);
    for (let i = -5; i <= 5; i++) {
      _p[0] = i * 0.48; _p[1] = G + 1.65 + gate.lift; _p[2] = gate.p[2] - 0.15;
      _s[0] = 0.05; _s[1] = 3.1; _s[2] = 0.045;
      this.lit(_p, _s, ZERO, PALETTE.black);
    }
    const panel = session.phase === 'scavenge' ? PALETTE.red : PALETTE.cool;
    _p[0] = 2.12; _p[1] = G + 1.18; _p[2] = game.city.exit[2] - 1.217;
    _s[0] = 0.3; _s[1] = 0.27; _s[2] = 0.034;
    this.glow(_p, _s, ZERO, panel, glowScale(panel));
    // Listeners.
    const eye = game.player.p;
    for (let i = 0; i < ENEMY_SLOTS; i++) {
      const e = game.enemies[i];
      if (!e || !e.active || distance(e.p, eye) > 120) {
        this.skipLit(4);
        this.skipGlow(1);
        continue;
      }
      const blind = e.kind === 'blind';
      const y = e.p[1] + 1.1 + Math.sin(time * 1.8 + i) * 0.09;
      const angle = (e.yaw * 180) / Math.PI;
      const sy = Math.sin(e.yaw);
      const cy = Math.cos(e.yaw);
      _p[0] = e.p[0]; _p[1] = y; _p[2] = e.p[2];
      _s[0] = blind ? 0.58 : 0.66; _s[1] = blind ? 1.95 : 1.75; _s[2] = blind ? 0.42 : 0.48;
      _a[0] = 0; _a[1] = angle; _a[2] = 0;
      this.lit(_p, _s, _a, blind ? BLIND_BODY : BODY);
      const top = blind ? 1.1 : 0.98;
      _p[1] = y + top;
      _s[0] = 0.47; _s[1] = blind ? 0.52 : 0.46; _s[2] = 0.43;
      _a[1] = angle + Math.sin(time * 0.9) * 7;
      this.lit(_p, _s, _a, PALETTE.black);
      _a[1] = angle;
      for (let sign = -1; sign <= 1; sign += 2) {
        _p[0] = e.p[0] + cy * sign * 0.49; _p[1] = y - 0.26; _p[2] = e.p[2] + sy * sign * 0.49;
        _s[0] = 0.11; _s[1] = blind ? 1.55 : 1.38; _s[2] = 0.1;
        _a[2] = sign * 6;
        this.lit(_p, _s, _a, PALETTE.black);
      }
      _a[2] = 0;
      _p[0] = e.p[0] + sy * 0.245; _p[1] = y + top + 0.02; _p[2] = e.p[2] - cy * 0.245;
      _s[0] = 0.37; _s[1] = 0.036; _s[2] = 0.045;
      const eyeColor = blind ? EYE_BLIND : e.brain.state === 'chase' ? EYE_CHASE : EYE_CALM;
      this.glow(_p, _s, _a, eyeColor, 1);
    }
    this.skipLit(mb.count - this.m);
    this.skipGlow(gb.count - this.g);
    mb.instanceMatrix.needsUpdate = true;
    mb.instanceColor.needsUpdate = true;
    gb.instanceMatrix.needsUpdate = true;
    gb.instanceColor.needsUpdate = true;
  }

  syncBody(camera) {
    const parts = playerShadowParts(camera.body, this.parts);
    const b = this.body;
    b.visible = parts.length > 0;
    for (let i = 0; i < b.count; i++) {
      if (i < parts.length) writeBox(b, i, parts[i].p, parts[i].s, parts[i].a);
      else hideBox(b, i);
    }
    b.instanceMatrix.needsUpdate = true;
  }

  syncLights(camera, game, time) {
    const eye = camera.eye;
    // Moon: centred on the player, snapped to whole shadow texels.
    const step = (2 * MOON_HALF) / this.moon.shadow.mapSize.x;
    const r = Math.round((eye[0] * MOON_RIGHT.x + eye[1] * MOON_RIGHT.y + eye[2] * MOON_RIGHT.z) / step) * step;
    const u = Math.round((eye[0] * MOON_UP.x + eye[1] * MOON_UP.y + eye[2] * MOON_UP.z) / step) * step;
    const f = Math.round((eye[0] * MOON.x + eye[1] * MOON.y + eye[2] * MOON.z) / 8) * 8;
    const t = this.moon.target.position;
    t.set(0, 0, 0).addScaledVector(MOON_RIGHT, r).addScaledVector(MOON_UP, u).addScaledVector(MOON, f);
    this.moon.position.copy(t).addScaledVector(MOON, 120);

    const flash = this.flash;
    if (camera.light) {
      const beam = flashlightState(camera, this.settings);
      flash.position.set(beam.origin[0], beam.origin[1], beam.origin[2]);
      flash.target.position.set(beam.origin[0] + beam.direction[0], beam.origin[1] + beam.direction[1], beam.origin[2] + beam.direction[2]);
      flash.angle = (beam.degrees * Math.PI) / 360;
      flash.intensity = FLASH_INTENSITY;
      flash.shadow.autoUpdate = true;
    } else {
      flash.intensity = 0;
      flash.shadow.autoUpdate = false;
    }

    const chosen = selectLights(game.lights, eye, this.lamps.length, this.selected);
    this.lightCount = chosen.length;
    for (let i = 0; i < this.lamps.length; i++) {
      const l = this.lamps[i];
      const src = chosen[i];
      if (!src) {
        l.intensity = 0;
        l.shadow.autoUpdate = false;
        continue;
      }
      l.position.set(src.position[0], src.position[1], src.position[2]);
      l.target.position.set(src.position[0], src.position[1] - 1, src.position[2]);
      l.distance = src.range;
      const flick = this.settings.flicker ? 0.94 + 0.06 * Math.sin(time * 0.8 + i * 3) : 1;
      const c = src.warm ? WARM : COOL;
      l.color.setRGB(c[0] * flick, c[1] * flick, c[2] * flick);
      l.intensity = lampIntensity(src.range);
      l.shadow.autoUpdate = true;
    }
  }

  /** Draw one frame. camera: { eye, forward, light, flashOrigin, body }. */
  render(camera, game, time) {
    const eye = camera.eye;
    const cam = this.camera;
    cam.position.set(eye[0], eye[1], eye[2]);
    cam.lookAt(eye[0] + camera.forward[0], eye[1] + camera.forward[1], eye[2] + camera.forward[2]);
    for (const mesh of this.statics) {
      const { center, radius } = mesh.userData;
      mesh.visible = radius === 0 || distance(eye, center) < 115 + radius;
    }
    this.syncDoorsAndProps(game);
    this.syncMovers(game, time);
    this.syncBody(camera);
    this.syncLights(camera, game, time);
    this.post.render();
  }

  diagnostics() {
    return {
      renderer: `three.js r${THREE.REVISION} / ${this.kit.backendLabel}`,
      instances: this.instances,
      localShadowLights: this.lightCount,
      lampSlots: this.lamps.length,
      moonShadowMap: this.moon.shadow.mapSize.x,
      flashlightBeamDegrees: this.settings.beamAngle,
      drawCalls: this.kit.renderer.info?.render?.calls ?? null,
    };
  }
}
