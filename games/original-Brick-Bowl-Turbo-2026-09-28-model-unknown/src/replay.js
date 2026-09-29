import * as THREE from "three/webgpu";

export const REPLAY_FRAMES = 540;
export const MODES = [
  `idle`,
  `run`,
  `stance3`,
  `stance2`,
  `qbset`,
  `throw`,
  `catch`,
  `dive`,
  `down`,
  `ragdoll`,
  `celebrate`,
  `kick`,
  `spin`,
  `stiffarm`,
  `block`,
  `kneel`,
  `jump`,
  `handoff`,
  `hurdle`,
  `wave`,
  `getup`,
  `spike`,
  `hold`,
];
export const STRIDE = 10;
const MODE_INDEX = new Map(MODES.map((m, i) => [m, i]));
const BALL_STRIDE = 8;
/**
 * Instant replay: the last REPLAY_FRAMES simulation steps in a ring buffer that is
 * allocated once (the original built two new Float32Arrays every step).
 */
export const Replay = class {
  players = [];
  playing = false;
  cursor = 0;
  speed = 0.5;
  q = new THREE.Quaternion();
  data = new Float32Array(0);
  ball = new Float32Array(REPLAY_FRAMES * BALL_STRIDE);
  head = 0; // next slot to write
  count = 0; // frames stored
  begin(e) {
    this.players = e.slice();
    const need = REPLAY_FRAMES * this.players.length * STRIDE;
    if (this.data.length !== need) this.data = new Float32Array(need);
    this.head = 0;
    this.count = 0;
  }
  record(e) {
    if (this.playing || !this.players.length) return;
    const per = this.players.length * STRIDE,
      t = this.data,
      base = this.head * per;
    for (let n = 0; n < this.players.length; n++) {
      const p = this.players[n],
        r = p.model.root,
        i = base + n * STRIDE;
      t[i] = r.position.x;
      t[i + 1] = r.position.y;
      t[i + 2] = r.position.z;
      t[i + 3] = r.quaternion.x;
      t[i + 4] = r.quaternion.y;
      t[i + 5] = r.quaternion.z;
      t[i + 6] = r.quaternion.w;
      t[i + 7] = MODE_INDEX.get(p.model.mode) ?? 0;
      t[i + 8] = Math.hypot(p.vel.x, p.vel.z);
      t[i + 9] = p.model.modeT;
    }
    const n = e.mesh,
      b = this.ball,
      j = this.head * BALL_STRIDE;
    b[j] = n.position.x;
    b[j + 1] = n.position.y;
    b[j + 2] = n.position.z;
    b[j + 3] = n.quaternion.x;
    b[j + 4] = n.quaternion.y;
    b[j + 5] = n.quaternion.z;
    b[j + 6] = n.quaternion.w;
    b[j + 7] = n.visible ? 1 : 0;
    this.head = (this.head + 1) % REPLAY_FRAMES;
    this.count = Math.min(REPLAY_FRAMES, this.count + 1);
  }
  get length() {
    return this.count;
  }
  /** Ring slot of the k-th stored frame (0 = oldest). */
  slot(k) {
    return (this.head - this.count + k + REPLAY_FRAMES) % REPLAY_FRAMES;
  }
  start(e) {
    if (this.count < 30) return false;
    this.playing = true;
    this.cursor = Math.max(0, this.count - Math.round(e * 60));
    return true;
  }
  stop() {
    this.playing = false;
  }
  update(e, t, n) {
    if (!this.playing) return false;
    this.cursor += e * 60 * this.speed;
    let r = Math.floor(this.cursor);
    if (r >= this.count) {
      this.playing = false;
      return false;
    }
    const k = this.slot(r),
      d = this.data,
      base = k * this.players.length * STRIDE;
    for (let n = 0; n < this.players.length; n++) {
      const p = this.players[n],
        i = base + n * STRIDE,
        a = p.model.root;
      a.position.set(d[i], d[i + 1], d[i + 2]);
      this.q.set(d[i + 3], d[i + 4], d[i + 5], d[i + 6]);
      a.quaternion.copy(this.q);
      p.model.setMode(MODES[d[i + 7]] ?? `idle`);
      p.model.animate(e * this.speed, d[i + 8], false);
    }
    const b = this.ball,
      j = k * BALL_STRIDE;
    t.mesh.position.set(b[j], b[j + 1], b[j + 2]);
    t.mesh.quaternion.set(b[j + 3], b[j + 4], b[j + 5], b[j + 6]);
    n.set(b[j], 0, b[j + 2]);
    return true;
  }
};
