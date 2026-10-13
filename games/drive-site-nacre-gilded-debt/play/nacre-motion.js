/* Nacre motion adapter. Keeps game movement and action timing in the game.
 * Requires my-3d2dge, MocapReadable, Mocap and window.MOCAP.NacreCMU.
 * Capture is visual only. The game owns movement, collision, and action timing.
 */
(function (E, Capture) {
  'use strict';
  if (!E) return;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = t => t * t * (3 - 2 * t);
  const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const clonePose = p => { const q = new Float32Array(p); q.src = p.src; return q; };
  const median = values => { values.sort((a, b) => a - b); return values.length ? values[Math.floor(values.length / 2)] : 0; };
  const profiles = new WeakMap();
  let sharedLibrary = null;

  function library() {
    if (!sharedLibrary && Capture && window.MOCAP && window.MOCAP.NacreCMU) sharedLibrary = Capture.load(window.MOCAP.NacreCMU);
    return sharedLibrary;
  }

  // Estimate travel at the speed at which a low foot moves back through a stride.
  // This is measured in source mm. The controller applies the current leg scale.
  function profile(lib, clip) {
    let cache = profiles.get(lib); if (!cache) profiles.set(lib, cache = new Map());
    if (cache.has(clip.name)) return cache.get(clip.name);
    const count = 72, span = clip.dur, step = span / count, frames = [];
    for (let i = 0; i < count; i++) frames.push(lib.sample(clip, i * step));
    const velocities = [], heights = { L: [], R: [] };
    for (const p of frames) for (const side of ['L', 'R']) heights[side].push(lib.pt(p, 'ankle' + side)[2]);
    const low = {};
    for (const side of ['L', 'R']) { heights[side].sort((a, b) => a - b); low[side] = heights[side][Math.floor(count * .35)] + 15; }
    let plant = 0, farthest = -Infinity;
    for (let i = 0; i < count; i++) for (const side of ['L', 'R']) {
      const a = lib.pt(frames[i], 'ankle' + side), b = lib.pt(frames[(i + 1) % count], 'ankle' + side);
      const back = (a[0] - b[0]) / step;
      if (a[2] < low[side] && b[2] < low[side] && back > 20 && back < 15000) velocities.push(back);
      if (side === 'L' && a[2] < low.L && a[0] > farthest) { farthest = a[0]; plant = i / count; }
    }
    const result = { sourceSpeed: Math.max(100, median(velocities)), plant, duration: span };
    cache.set(clip.name, result); return result;
  }

  class Controller {
    constructor(rig, options = {}) {
      this.rig = rig; this.lib = options.lib || library();
      this.role = options.role || rig.o.nacreRole || 'civilian';
      this.seed = hash(options.id || this.role);
      this.variant = Number.isFinite(options.variant) ? options.variant : Number.isFinite(rig.o.nacreProfile) ? rig.o.nacreProfile : Math.floor(this.seed * 8);
      this.workProps = options.workProps !== false;
      this.originalUpdate = rig.update;
      this.time = this.seed * 19; this.idleTime = 0; this.gait = this.seed;
      this.speed = 0; this.weight = 0; this.name = null; this.from = null; this.output = null;
      this.transition = .2; this.lastPosition = null; this.initialized = false;
      this.contacts = { L: null, R: null }; this.clocks = new Map();
      this.state = {}; this.frameDt = 0; this.blocked = false;
      this.handAction = null; this.handWeight = 0; this.poseRevision = 0; this.afterPoseRevision = -1;
      rig.motionController = this; rig.motionName = 'Procedural'; rig.motionWeight = 0; rig.motionTime = 0;
      if (!this.lib || !Capture) { this.available = false; return; }
      this.available = true;
      // drive() wraps _pose before cloth and trails, but replaces update(). Restore
      // the game's subclass method so mantle and costume extensions still run.
      Capture.drive(rig, this.lib);
      const capturedPose = rig._pose, owner = this;
      rig._pose = function () { capturedPose.call(this); owner.afterPose(); };
      rig.update = function (dt, state = {}) { return owner.update(dt, state); };
    }

    priority(s) {
      if (s.dead || s.pose === 'die' || s.pose === 'down') return 'death';
      if (s.takedown) return 'takedown';
      if (s.climb || s.mantle || s.vault || s.air) return 'traversal';
      if (s.attack || s.parry > 0 || s.pose === 'block') return 'combat';
      if (s.dodge > 0 || s.dash) return 'dodge';
      if (s.hurt) return 'hurt';
      if (s.interaction && s.interaction !== 'ledger' && s.interaction !== 'talk') return 'interaction';
      return null;
    }

    choose(s, speed) {
      const crouch = s.crouch || s.pose === 'crouch';
      if (s.motion && this.lib.clip(s.motion)) return { name: s.motion, weight: s.motionWeight === undefined ? 1 : clamp(s.motionWeight, 0, 1), mask: s.motionMask || null, gait: ['Walk', 'SlowWalk', 'Run', 'Sneak'].includes(s.motion) };
      if (s.interaction === 'talk') return { name: 'Conversation', weight: .82, mask: 'upper' };
      if (crouch) return speed > 1.2 ? { name: 'Sneak', weight: .88, gait: true } : null;
      if (speed > 1.2) {
        const running = speed > (this.name === 'Run' ? 62 : 70);
        return { name: running ? 'Run' : this.role === 'civilian' || speed < 19 ? 'SlowWalk' : 'Walk', weight: s.alert ? .7 : 1, gait: true };
      }
      if (this.role === 'player') return Math.floor(this.idleTime / 8) % 3 === 2 ? { name: 'Look', weight: .48, mask: 'upper' } : { name: 'Still', weight: .65 };
      if (this.role === 'guard') return { name: s.alert ? 'Wait' : 'Look', weight: s.alert ? .35 : .6, mask: 'upper' };
      if (this.role === 'target') return { name: 'Idle', weight: .4, mask: 'upper' };
      if (this.role === 'courier') return { name: 'Wait', weight: .65 };
      let name = ['Sweep', 'Conversation', 'Idle', 'Wait', 'Conversation', 'Drink', 'Sweep', 'Still'][this.variant % 8];
      if (!this.workProps && (name === 'Drink' || name === 'Sweep')) name = 'Conversation';
      if ((name === 'Drink' || name === 'Sweep') && this.idleTime < .8) name = 'Still';
      return { name, weight: name === 'Drink' ? .95 : name === 'Sweep' ? .88 : name === 'Idle' ? .45 : .72, mask: ['Conversation', 'Drink', 'Idle'].includes(name) ? 'upper' : null };
    }

    update(dt, s = {}) {
      const rig = this.rig;
      if (!this.available) return this.originalUpdate.call(rig, dt, s);
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
      // A zero step freezes the exact pose, blink, cloth and every motion clock.
      if (this.initialized && (dt === 0 || s.mode === 'paused' || s.mode === 'guide')) return;
      this.initialized = true; this.frameDt = dt; this.state = s;
      const x = Number.isFinite(s.x) ? s.x : rig.x, y = Number.isFinite(s.y) ? s.y : rig.y, z = Number.isFinite(s.z) ? s.z : rig.z;
      const prev = this.lastPosition, moved = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      const teleport = !!prev && (Math.hypot(x - prev.x, y - prev.y, z - prev.z) > 24 * rig.o.size || moved > Math.hypot(s.vx || 0, s.vy || 0) * dt * 2 + 4);
      const actualSpeed = !prev || teleport || dt === 0 ? Math.hypot(s.vx || 0, s.vy || 0) : moved / dt;
      this.lastPosition = { x, y, z };
      if (teleport) { this.contacts.L = this.contacts.R = null; this.from = this.output = null; this.weight = 0; this.speed = actualSpeed; }
      this.speed += (actualSpeed - this.speed) * (1 - Math.exp(-dt * 16));
      this.time += dt; this.idleTime = actualSpeed > 1.2 ? 0 : this.idleTime + dt;
      this.blocked = this.priority(s);
      const gesture = ['listen', 'survey', 'seal', 'gate', 'smoke'].includes(s.interaction) ? s.interaction : s.interaction && s.interaction.startsWith('note') ? 'note' : null;
      if (this.blocked && this.blocked !== 'interaction') { this.handAction = null; this.handWeight = 0; }
      else { if (gesture) this.handAction = gesture; this.handWeight += ((gesture ? 1 : 0) - this.handWeight) * (1 - Math.exp(-dt * 18)); if (this.handWeight < .005) this.handAction = null; }
      const choice = this.blocked ? null : this.choose(s, this.speed), clip = choice && this.lib.clip(choice.name);
      this.choice = clip ? choice : null;
      if (!clip) {
        this.name = null; this.weight = 0; this.output = null; this.from = null;
        this.contacts.L = this.contacts.R = null;
        rig.mocap = null; rig.mocapW = 0; rig.mocapMask = null; rig.mocapBlade = false;
        rig.motionName = this.blocked || 'Procedural'; rig.motionWeight = 0;
      } else {
        const changed = this.name !== choice.name;
        if (changed) {
          this.from = this.output ? clonePose(this.output) : null;
          this.transition = 0; this.name = choice.name; this.contacts.L = this.contacts.R = null;
        }
        let t = this.clocks.has(this.name) ? this.clocks.get(this.name) : this.seed * clip.dur;
        if (choice.gait) {
          const p = profile(this.lib, clip), legScale = (rig.o.legUpper + rig.o.legLower) * rig.o.size / (this.lib.rest.thigh + this.lib.rest.shin);
          const nativeSpeed = p.sourceSpeed * legScale;
          this.gait += dt * actualSpeed / Math.max(.1, nativeSpeed * clip.dur);
          t = ((this.gait + p.plant) % 1) * clip.dur;
          this.nativeSpeed = nativeSpeed; this.playbackRate = actualSpeed / Math.max(.1, nativeSpeed);
        } else { t += dt; this.nativeSpeed = 0; this.playbackRate = 1; }
        if (Number.isFinite(s.motionTime)) t = s.motionTime;
        this.clocks.set(this.name, t);
        const loopTime = ((t % clip.dur) + clip.dur) % clip.dur;
        const next = this.lib.sample(clip, loopTime, this.sampleBuffer || (this.sampleBuffer = new Float32Array(this.lib.P * 3)));
        // Raw calm takes do not end at their starting pose. Blend only their final
        // fraction back to the start. Stride clips have authored closed endpoints.
        if (!clip.loop && !choice.gait) {
          const seam = Math.min(.4, clip.dur * .14), start = clip.dur - seam;
          if (loopTime > start) {
            const first = this.lib.sample(clip, 0, this.seamBuffer || (this.seamBuffer = new Float32Array(this.lib.P * 3)));
            this.lib.blend(next, first, smooth((loopTime - start) / seam), next);
          }
        }
        this.transition = Math.min(.2, this.transition + dt);
        const fade = smooth(this.transition / .2);
        this.output = this.output || new Float32Array(this.lib.P * 3);
        if (this.from && fade < 1) this.lib.blend(this.from, next, fade, this.output);
        else { this.output.set(next); this.output.src = next.src; this.from = null; }
        this.weight += (choice.weight - this.weight) * (1 - Math.exp(-dt * 18));
        rig.mocap = this.output; rig.mocapW = this.weight; rig.mocapMask = choice.mask || null; rig.mocapBlade = false;
        rig.motionName = this.name; rig.motionWeight = this.weight; rig.motionTime = loopTime;
      }
      rig._ownSpin = null;
      this.poseRevision++;
      // Preserve the game's subclass update. Capture's _pose runs inside it,
      // before the engine advances cape, hair and the weapon trail.
      return this.originalUpdate.call(rig, dt, s.dodge > 0 && !s.dash ? Object.assign({}, s, { dash: true }) : s);
    }

    afterPose() {
      const rig = this.rig, J = rig.J, o = rig.o;
      const freshPose = this.afterPoseRevision !== this.poseRevision; this.afterPoseRevision = this.poseRevision;
      if (this.choice && this.choice.gait && this.weight > .8 && this.transition >= .2 && this.frameDt > 0 && this.speed > 2) {
        const angle = rig.facing + rig.spin + rig._cheat, c = Math.cos(angle), sn = Math.sin(angle);
        const scaleXY = o.size * (1 - rig.sq * .4), scaleZ = o.size * (1 + rig.sq);
        for (const side of ['L', 'R']) {
          const foot = J['foot' + side], hip = J['hip' + side], knee = J['knee' + side];
          let contact = this.contacts[side];
          if (foot[2] > 1.25 || !Number.isFinite(foot[2])) { this.contacts[side] = null; continue; }
          if (!contact) {
            const w = rig._w(foot);
            contact = this.contacts[side] = { x: rig.x + w[0], y: rig.y + w[1], z: rig.z + w[2], age: 0 };
          }
          if (freshPose) contact.age += this.frameDt;
          const dx = contact.x - rig.x, dy = contact.y - rig.y;
          const target = [(dx * c + dy * sn) / scaleXY, (-dx * sn + dy * c) / scaleXY, Math.max(0, (contact.z - rig.z) / scaleZ)];
          const error = E.V3.len(E.V3.sub(target, foot)), reach = E.V3.len(E.V3.sub(target, hip));
          // Let go before a fixed foot can stretch a leg or make a turn drag it.
          if (error > 2.4 || reach > o.legUpper + o.legLower - .009 || contact.age > .4) { this.contacts[side] = null; continue; }
          const hint = E.V3.sub(knee, E.V3.lerp(hip, foot, .5));
          const [kn, ft] = E.ik3(hip, target, o.legUpper, o.legLower, hint);
          J['knee' + side] = kn; J['foot' + side] = ft;
        }
      } else this.contacts.L = this.contacts.R = null;
      // Small purpose-built gestures keep the hands readable at the game's timing.
      // They do not move the root or change any interaction or combat condition.
      if (this.handAction && this.handWeight > .005) {
        const w = this.handWeight, h = J.head, sh = J.shC, hip = J.hipC;
        const reach = (side, target, amount = w) => {
          const [el, hand] = E.ik3(J['sh' + side], target, o.armUpper, o.armLower, [0, side === 'L' ? -1 : 1, -1]);
          J['elbow' + side] = E.V3.lerp(J['elbow' + side], el, amount);
          J['hand' + side] = E.V3.lerp(J['hand' + side], hand, amount);
        };
        if (this.handAction === 'survey') { reach('L', [h[0] + 3.1, h[1] - 1.5, h[2] + o.headR * .28]); reach('R', [hip[0] + .6, hip[1] + 3, hip[2] + 2.4], w * .7); }
        else if (this.handAction === 'listen') { reach('L', [sh[0] + 2.6, sh[1] - 2.5, sh[2] - 2.2], w * .78); J.head = E.V3.add(h, [w * .32, -w * .24, -w * .2]); }
        else if (this.handAction === 'smoke') { reach('R', [sh[0] + 8.5, sh[1] + 2, sh[2] - 2.6]); reach('L', [hip[0] + 1, hip[1] - 3, hip[2] + 2], w * .5); }
        else if (this.handAction === 'note') { reach('L', [sh[0] + 5, sh[1] - 1.8, sh[2] - 5.2]); reach('R', [sh[0] + 5.4, sh[1] + 1.6, sh[2] - 5.4]); J.head = E.V3.add(h, [w * .4, 0, -w * .35]); }
        else { reach('R', [sh[0] + 8.5, sh[1] + 1.7, sh[2] - (this.handAction === 'seal' ? 6.6 : 3.6)]); reach('L', [hip[0] + .6, hip[1] - 3.2, hip[2] + 2.6], w * .5); }
      }
      // A ledger pose is visual only. The game opts into it during a quiet pause.
      if (!this.blocked && this.role === 'target' && this.state.interaction === 'ledger' && this.speed < 2) {
        for (const side of ['L', 'R']) {
          const sh = J['sh' + side], target = [4.6, side === 'L' ? -1.5 : 1.5, J.shC[2] - 6.4];
          const [el, hand] = E.ik3(sh, target, o.armUpper, o.armLower, [0, side === 'L' ? -1 : 1, -1]);
          J['elbow' + side] = E.V3.lerp(J['elbow' + side], el, .82); J['hand' + side] = E.V3.lerp(J['hand' + side], hand, .82);
        }
      }
    }

    // Keep the sampled stride continuous when a crowd actor changes draw detail.
    seek(name, time) {
      const clip=this.lib&&this.lib.clip(name);
      if(!clip||!Number.isFinite(time))return false;
      this.clocks.set(name,time);
      if(['Walk','SlowWalk','Run','Sneak'].includes(name))this.gait=time/clip.dur-profile(this.lib,clip).plant;
      this.lastPosition=null;this.contacts.L=this.contacts.R=null;
      return true;
    }
    reset() {
      this.contacts.L = this.contacts.R = null; this.lastPosition = null; this.from = this.output = null;
      this.name = null; this.weight = 0; this.speed = 0; this.idleTime = 0; this.clocks.clear();
      this.handAction = null; this.handWeight = 0;
      this.rig.mocap = null; this.rig.mocapW = 0; this.rig.mocapTilt = null; this.rig.motionWeight = 0;
    }
    getState() { return { available: this.available, name: this.rig.motionName, weight: this.rig.motionWeight, time: this.rig.motionTime, speed: this.speed, nativeSpeed: this.nativeSpeed || 0, playbackRate: this.playbackRate || 0, priority: this.blocked || null }; }
  }

  E.NacreMotion = {
    version: '1.0.0', library,
    attach(rig, options) { return rig.motionController || new Controller(rig, options); },
    Controller
  };
})(window.My3D2dge, typeof Mocap !== 'undefined' ? Mocap : window.Mocap);
