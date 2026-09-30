/* Sham-mue — everything that moves. The WebGL edition rebuilt and re-uploaded every moving
   vertex each frame; here each model is built once and posed through a small joint hierarchy
   that mirrors the old matrix pushes exactly (same offsets, same rotation order). */

import * as THREE from 'three/webgpu';
import { PI, clamp } from './mesh.js';
import { partMesh, materialFor, linear } from './gfx.js';
import * as A from './art.js';

const joint = (parent, x = 0, y = 0, z = 0, order) => { const g = new THREE.Group(); g.position.set(x, y, z); if (order) g.rotation.order = order; parent.add(g); return g; };

/* ------------------------------------------------------------------ people */

export class CharacterRig {
  constructor(scene, ch) {
    this.st = A.charStyle(ch);
    this.anchor = new THREE.Group();
    scene.add(this.anchor);
    this.near = null; this.far = null; this.frame = -1;
  }
  buildNear() {
    const st = this.st, k = st.key, root = joint(this.anchor);
    const contact = partMesh('contact', A.contactModel, false);
    contact.receiveShadow = false; contact.position.y = .024; contact.rotation.x = -PI / 2; root.add(contact);
    const body = joint(root), scaler = joint(body); scaler.scale.set(.88, 1, .96);
    const pose = joint(scaler, 0, 0, 0, 'XYZ');
    pose.add(partMesh(k + 'pelvis', p => A.CHAR.pelvis(p, st)));
    const legs = [];
    for (const side of [-1, 1]) {
      const thigh = joint(pose, side * .121, .92, 0); thigh.add(partMesh(k + 'thigh', p => A.CHAR.thigh(p, st)));
      const shin = joint(thigh, 0, -.41, 0); shin.add(partMesh(k + 'shin', p => A.CHAR.shin(p, st)));
      legs.push({ side, thigh, shin });
    }
    const torso = joint(pose); torso.add(partMesh(k + 'torso', p => A.CHAR.torso(p, st)));
    const head = joint(torso);
    const face = partMesh(k + 'head' + st.face, p => A.CHAR.head(p, st, st.face));
    const blink = partMesh(k + 'head' + st.blinkFace, p => A.CHAR.head(p, st, st.blinkFace));
    blink.visible = false; head.add(face, blink);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = joint(torso, side * (st.woman ? .219 : .249), 1.458, 0, 'ZXY'); arm.rotation.z = side * -.065;
      arm.add(partMesh(k + 'upperArm', p => A.CHAR.upperArm(p, st)));
      const fore = joint(arm, 0, -.295, 0); fore.add(partMesh(k + 'forearm', p => A.CHAR.forearm(p, st)));
      arms.push({ side, arm, fore });
    }
    this.near = { root, contact, body, pose, legs, torso, head, face, blink, arms };
  }
  buildFar(ch) {
    const st = this.st, fk = st.farKey, root = joint(this.anchor), body = joint(root);
    body.add(partMesh(fk + 'body', p => A.CHAR.farBody(p, ch, st.woman)));
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const l = joint(body, s * .109, .94, 0); l.add(partMesh(fk + 'leg', p => A.CHAR.farLeg(p, ch))); legs.push(l);
      const a = joint(body, s * .218, 1.46, 0); a.add(partMesh(fk + 'arm', p => A.CHAR.farArm(p, ch))); arms.push(a);
    }
    this.far = { root, body, legs, arms };
  }
  update(ch, time, extra, far) {
    const a = this.anchor, sc = ch.scale || 1;
    a.visible = true;
    a.position.set(ch.x, 0, ch.z); a.rotation.y = ch.yaw || 0; a.scale.set(sc, sc, sc);
    if (far) {
      if (!this.far) this.buildFar(ch);
      this.far.root.visible = true; if (this.near) this.near.root.visible = false;
      const f = this.far, phase = ch.phase || time * 5, walk = ch.walk || 0, sw = Math.sin(phase) * .42 * walk;
      f.body.position.y = Math.abs(Math.sin(phase)) * walk * .012;
      f.legs[0].rotation.x = -sw; f.legs[1].rotation.x = sw;
      f.arms[0].rotation.x = sw * .65; f.arms[1].rotation.x = -sw * .65;
      return;
    }
    if (!this.near) this.buildNear();
    this.near.root.visible = true; if (this.far) this.far.root.visible = false;
    const n = this.near, seated = !!extra.seated;
    const blink = ((time + (ch.x || 0) * 1.39 + (ch.z || 0) * .1) % 5.8 + 5.8) % 5.8 < .12;
    n.face.visible = !blink; n.blink.visible = blink;
    const walk = ch.walk || 0, phase = ch.phase || time * 6, sw = Math.sin(phase) * .48 * walk;
    const attack = ch.attackTime || 0, atk = attack > 0 ? Math.sin(clamp((.42 - attack) / .42, 0, 1) * PI) : 0, kind = ch.attackKind || 'punch', block = ch.block;
    n.contact.visible = !seated && !ch.dead;
    n.body.position.y = (ch.y || 0) + (seated ? .32 : 0) + (ch.dead ? 0 : Math.abs(Math.sin(phase)) * walk * .015);
    n.pose.position.y = ch.dead ? .2 : 0;
    n.pose.rotation.x = ch.dead ? -PI / 2 + .08 : 0;
    n.pose.rotation.z = ch.hit > 0 ? Math.sin(ch.hit * 35) * .065 : 0;
    for (const L of n.legs) {
      let angle = L.side * sw, knee = -Math.max(0, -L.side * sw) * 1.1;
      if (seated) { angle = 1.25; knee = -1.30; }
      if (kind === 'kick' && L.side === 1 && atk > 0) { angle = 1.48 * atk; knee = -.15; }
      L.thigh.rotation.x = angle; L.shin.rotation.x = knee;
    }
    n.torso.rotation.y = Math.sin(phase) * walk * .025;
    n.head.rotation.y = walk ? 0 : Math.sin(time * .46 + (ch.x || 0)) * .025;
    for (const R of n.arms) {
      let angle = -R.side * sw * .74, elbow = .13 + Math.max(0, R.side * sw) * .14;
      if (seated) { angle = 1.10; elbow = .37; }
      if (block) { angle = 1.08; elbow = 1.18; }
      if (atk && kind !== 'kick') { if (R.side === 1) { angle = atk * 1.70; elbow = .12 + (1 - atk) * .5; } else { angle = .5; elbow = .65; } }
      R.arm.rotation.x = angle; R.fore.rotation.x = elbow;
    }
  }
}

/** Keeps one rig per person and hides the ones nobody drew this frame. */
export class Cast {
  constructor(scene) { this.scene = scene; this.rigs = new Map(); this.frame = 0; }
  begin() { this.frame++; }
  draw(key, ch, time, eye, extra = {}) {
    const st = ch._styleKey || (ch._styleKey = A.charStyle(ch).key);
    const id = key + '#' + st;
    let rig = this.rigs.get(id);
    if (!rig) { rig = new CharacterRig(this.scene, ch); this.rigs.set(id, rig); }
    // Beyond twelve metres the simpler figure stands in (as before), except for Jun and anyone fighting.
    let far = false;
    if (!extra.seated && !ch.hero && eye) {
      const d = Math.hypot(ch.x - eye[0], ch.z - eye[2]);
      far = d > 12 && !ch.dead && !(ch.attackTime > 0);
    }
    rig.frame = this.frame;
    rig.update(ch, time, extra, far);
  }
  end() { for (const rig of this.rigs.values()) if (rig.frame !== this.frame) rig.anchor.visible = false; }
}

/* ------------------------------------------------------------------ the rest of the harbour that moves */

const _y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

export function createProps(scene) {
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); scene.add(m); return m; };

  // The Blue Horizon rides the swell out in the bay.
  const ship = add(partMesh('ship', A.shipModel)); ship.rotation.y = PI * .07;

  // Forklift No. 05: chassis, lifting carriage and the crate on its forks.
  const fork = add(partMesh('forkChassis', A.forkChassis));
  const carriage = joint(fork); carriage.add(partMesh('forkCarriage', A.forkCarriage));
  const load = partMesh('crate', A.crateModel); load.position.set(0, .11, -1.92); carriage.add(load);

  const crates = [0, 1, 2].map(() => add(partMesh('crate', A.crateModel)));
  const markers = [0, 1, 2].map(() => { const m = add(partMesh('crateMarker', A.crateMarker, false)); m.receiveShadow = false; return m; });

  const cat = add(partMesh('cat', A.catModel), -28.4, 0, 27.1); cat.rotation.y = .7;
  const tail = partMesh('tailTip', A.tailTip); cat.add(tail);
  const bowl = add(partMesh('catBowl', A.catBowl));

  const rings = [0, 1].map(() => { const m = add(partMesh('warnRing', b => A.warnRing(b), false)); m.receiveShadow = false; return m; });
  const chargeRing = add(partMesh('warnRingRed', b => A.warnRing(b, '#b5523d'), false)); chargeRing.receiveShadow = false;

  const flags = [[-12.5, 8.4, 12], [-28, 17.2, -39]].map(([x, y, z]) => add(partMesh('flag', A.flagModel), x, y, z));

  const pallet = add(partMesh('qtePallet', A.qtePallet));
  const boom = add(partMesh('qteBoom', A.qteBoom));
  const pass = add(partMesh('passBox', A.passBox));

  const gates = [];
  const beacon = add(partMesh('raceBeacon', A.raceBeacon, false));

  const gulls = createGulls(scene, 9);

  const all = { ship, fork, carriage, load, crates, markers, cat, tail, bowl, rings, chargeRing, flags, pallet, boom, pass, gates, beacon, gulls };
  for (const m of [...markers, ...rings, chargeRing, pallet, boom, pass, beacon]) m.visible = false;
  return {
    ...all,
    /** Lay out the yard-run gates once; each faces the way the forklift arrives. */
    buildGates(points, start) {
      let px = start.x, pz = start.z;
      for (const [x, z] of points) {
        const g = add(partMesh('raceGate', A.raceGate), x, 0, z);
        g.rotation.y = Math.atan2(x - px, z - pz); g.visible = false;
        gates.push(g); px = x; pz = z;
      }
    },
    updateShip(t) { ship.position.set(-58, -.5 + Math.sin(t * .3) * .08, -30); },
    updateForklift(f) {
      fork.position.set(f.x, 0, f.z); fork.rotation.y = f.yaw;
      carriage.position.y = f.carry !== null ? .9 : .10; load.visible = f.carry !== null;
    },
    updateCat(t, fed) {
      const ax = .18, ay = .35, az = .49, bx = .20 + Math.sin(t) * .04, by = .56, bz = .52;
      _d.set(bx - ax, by - ay, bz - az); const len = _d.length(); _d.divideScalar(len);
      tail.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); tail.quaternion.setFromUnitVectors(_y, _d); tail.scale.set(1, len, 1);
      bowl.visible = fed;
    },
    updateFlags(t) { const wave = Math.sin(t * 2) * .16; for (const f of flags) f.rotation.y = -Math.asin(clamp(wave / 1.5, -1, 1)); }
  };
}

/* ------------------------------------------------------------------ gulls: one small dynamic buffer */

function createGulls(scene, count) {
  const n = count * 6, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const c = [linear(0xd9 / 255), linear(0xde / 255), linear(0xce / 255)];
  for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; uv[i * 2] = .5; uv[i * 2 + 1] = .5; }
  const g = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), na = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, materialFor(A.T.white, 0));
  mesh.frustumCulled = false;
  scene.add(mesh);
  // Two wing triangles per bird, as before: [0,0,.16],[-.85,flap,-.03],[-.1,0,-.18] and its mirror.
  const L = [0, 0, .16, -.85, 0, -.03, -.1, 0, -.18], R = [.1, 0, -.18, .85, 0, -.03, 0, 0, .16];
  let v = 0;
  const put = (x, y, z, cs, sn, lx, ly, lz) => { pos[v * 3] = x + lx * cs + lz * sn; pos[v * 3 + 1] = y + ly; pos[v * 3 + 2] = z - lx * sn + lz * cs; v++; };
  const tri = (x, y, z, cs, sn, t, flap) => {
    const s = v;
    put(x, y, z, cs, sn, t[0], t[1], t[2]); put(x, y, z, cs, sn, t[3], t[4] + flap, t[5]); put(x, y, z, cs, sn, t[6], t[7], t[8]);
    const i = s * 3, e1x = pos[i + 3] - pos[i], e1y = pos[i + 4] - pos[i + 1], e1z = pos[i + 5] - pos[i + 2], e2x = pos[i + 6] - pos[i], e2y = pos[i + 7] - pos[i + 1], e2z = pos[i + 8] - pos[i + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { nor[i + k * 3] = nx; nor[i + k * 3 + 1] = ny; nor[i + k * 3 + 2] = nz; }
  };
  return {
    update(time) {
      v = 0;
      for (let i = 0; i < count; i++) {
        const tt = time * .11 + i * .85, x = -38 + Math.sin(tt) * 18, z = -29 + Math.cos(tt * .8 + i) * 27, y = 11 + i * .6 + Math.sin(tt * 3) * 1.3, flap = Math.sin(time * 3 + i) * .25;
        const cs = Math.cos(-tt), sn = Math.sin(-tt);
        tri(x, y, z, cs, sn, L, flap); tri(x, y, z, cs, sn, R, flap);
      }
      pa.needsUpdate = true; na.needsUpdate = true;
    }
  };
}
