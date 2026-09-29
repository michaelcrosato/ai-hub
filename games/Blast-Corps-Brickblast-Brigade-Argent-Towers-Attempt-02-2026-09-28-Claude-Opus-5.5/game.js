/**
 * Brickblast Brigade — Argent Towers (a Blast Corps vertical slice).
 *
 * This file is the game's original code, unpacked from its single-file Vite
 * build (which had three.js r186 and Rapier baked in) and moved onto the
 * ai-hub shared 3D stack:
 *   - three.js comes from the page's import map (/lib/three), never a copy;
 *   - boot() from the kit starts WebGPU (WebGL2 as fallback), sizes the canvas,
 *     picks the quality tier, owns the settings panel and runs the loop;
 *   - every control goes through kit.input actions (keyboard + mouse, gamepad,
 *     on-screen touch controls built by the kit);
 *   - physics is the shared Rapier 0.20 (kit.RAPIER).
 * Top-level names were restored by hand when unpacking; names local to a
 * function are still the minifier's single letters.
 */
import {
  Quaternion,
  Vector3,
  Matrix4,
  Euler,
  Group,
  Color,
  Fog,
  Scene,
  Box3,
  BufferAttribute,
  Float32BufferAttribute,
  Sphere,
  BufferGeometry,
  Ray,
  Mesh,
  InstancedBufferAttribute,
  InstancedMesh,
  BoxGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  DirectionalLight,
  MeshBasicNodeMaterial,
  PMREMGenerator,
  MeshStandardNodeMaterial,
  RenderPipeline,
  UnsignedByteType,
  SRGBColorSpace,
  DynamicDrawUsage,
  ACESFilmicToneMapping,
  PCFShadowMap,
  BackSide,
} from 'three/webgpu';
import {
  abs,
  attribute,
  clamp,
  dot,
  float,
  floor,
  fract,
  fwidth,
  hash,
  instancedDynamicBufferAttribute,
  length,
  max,
  min,
  mix,
  mrt,
  normalView,
  normalWorld,
  output,
  packNormalToRGB,
  pass,
  positionWorld,
  renderOutput,
  sample,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  time,
  uniform,
  unpackRGBToNormal,
  uv,
  vec2,
  vec4,
  vertexColor,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { boot } from 'kit/boot.js';
import { createWorld } from 'kit/physics.js';

/**
 * Some Chromium builds reject the identity swizzle three.js puts on every
 * texture view. Dropping an identity swizzle changes nothing on screen.
 */
function patchIdentitySwizzle() {
  if (typeof GPUTexture > 'u' || GPUTexture.prototype.__bbbPatched) {
    return;
  }
  let e = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (t) {
    if (t && t.swizzle === 'rgba') {
      let n = Object.assign({}, t);
      delete n.swizzle;
      return e.call(this, n);
    }
    return e.call(this, t);
  };
  GPUTexture.prototype.__bbbPatched = true;
}

/**
 * The game's looks and effect budgets. The kit's quality tier picks one:
 * Low → low, Medium → balanced, High and Ultra → high. Resolution and the
 * shadow-map size come from the tier itself (kit.shadow), so they are not here.
 */
const QUALITY_PRESETS = {
  high: {
    name: 'High',
    shadowRadius: 3,
    shadowExtent: 70,
    ao: true,
    bloom: true,
    bloomStrength: 0.32,
    aa: 'smaa',
    maxDebrisBodies: 320,
    collapseBodies: 90,
    particleScale: 1,
    debrisLife: 9,
  },
  balanced: {
    name: 'Balanced',
    shadowRadius: 2,
    shadowExtent: 55,
    ao: false,
    bloom: true,
    bloomStrength: 0.26,
    aa: 'fxaa',
    maxDebrisBodies: 120,
    collapseBodies: 36,
    particleScale: 0.6,
    debrisLife: 6,
  },
  low: {
    name: 'Low',
    shadowRadius: 2,
    shadowExtent: 55,
    ao: false,
    bloom: true,
    bloomStrength: 0.26,
    aa: 'fxaa',
    maxDebrisBodies: 70,
    collapseBodies: 24,
    particleScale: 0.4,
    debrisLife: 5,
  },
};
const presetForTier = (tier) =>
  tier.name === 'high' || tier.name === 'ultra' ? 'high' : tier.name === 'low' ? 'low' : 'balanced';

/** Owns the post chain on kit.renderer and follows the kit's quality tier. */
class RenderHost {
  constructor(kit) {
    this.kit = kit;
    this.r = kit.renderer;
    this.backend = kit.backendLabel;
    this.presetKey = presetForTier(kit.tier);
    this.preset = QUALITY_PRESETS[this.presetKey];
    this.aoStrength = uniform(0.75);
    this.listeners = [];
    this.nodes = [];
    let e = this.r;
    e.toneMapping = ACESFilmicToneMapping;
    e.toneMappingExposure = 0.95;
    e.outputColorSpace = SRGBColorSpace;
    e.shadowMap.enabled = true;
    e.shadowMap.type = PCFShadowMap;
    this.pipeline = new RenderPipeline(e);
    kit.onQuality((t) => this.setPreset(presetForTier(t)));
  }
  /** fn(preset) whenever the preset changes (the game re-reads its effect budgets). */
  onPreset(e) {
    this.listeners.push(e);
  }
  setScene(e, t, n) {
    this.scene = e;
    this.camera = t;
    this.sun = n;
    this.kit.fitCamera(t);
    // 2048 at High, scaled for the tier; r186 resizes the map itself, never dispose it.
    this.kit.shadow(n, 2048);
    this.setPreset(this.presetKey);
  }
  setPreset(e) {
    this.presetKey = e;
    this.preset = QUALITY_PRESETS[e];
    if (this.sun) {
      let e = this.sun.shadow;
      e.radius = this.preset.shadowRadius;
      let t = this.preset.shadowExtent;
      e.camera.left = -t;
      e.camera.right = t;
      e.camera.top = t;
      e.camera.bottom = -t;
      e.camera.updateProjectionMatrix();
    }
    if (this.scene) {
      this.buildPipeline();
    }
    for (let t of this.listeners) {
      t(this.preset);
    }
  }
  buildPipeline() {
    let old = this.nodes;
    this.nodes = [];
    let e = this.preset;
    let t = pass(this.scene, this.camera);
    this.nodes.push(t);
    let n;
    if (e.ao) {
      t.setMRT(
        mrt({
          output: output,
          normal: packNormalToRGB(normalView),
        }),
      );
      let e = t.getTexture('normal');
      e.type = UnsignedByteType;
      n = t.getTextureNode('output');
      let r = t.getTextureNode('normal');
      let i = ao(
        t.getTextureNode('depth'),
        sample((e) => unpackRGBToNormal(r.sample(e))),
        this.camera,
      );
      i.resolutionScale = 0.5;
      i.radius.value = 1.6;
      i.distanceExponent.value = 1.2;
      i.thickness.value = 1.5;
      i.scale.value = 1.1;
      this.aoPass = i;
      this.nodes.push(i);
      let a = i.getTextureNode().r;
      n = vec4(n.rgb.mul(mix(float(1), a, this.aoStrength)), n.a);
    } else {
      n = t.getTextureNode('output');
      this.aoPass = null;
    }
    let r = n;
    if (e.bloom) {
      let t = bloom(n, e.bloomStrength, 0.4, 1);
      this.bloomPass = t;
      this.nodes.push(t);
      r = n.add(t);
    }
    this.pipeline.outputColorTransform = false;
    let i = renderOutput(r);
    i = e.aa === 'smaa' ? smaa(i) : fxaa(i);
    this.nodes.push(i);
    this.pipeline.outputNode = i;
    this.pipeline.needsUpdate = true;
    // The previous chain's render targets are no longer drawn: free them.
    for (let a of old) {
      try {
        a.dispose();
      } catch {}
    }
  }
  render() {
    this.pipeline.render();
  }
  get pixelRatio() {
    return this.r.getPixelRatio();
  }
  get info() {
    let e = this.r.info;
    return {
      calls: e.render.drawCalls,
      tris: e.render.triangles,
    };
  }
}
const clampNum = (e, t, n) => (e < t ? t : e > n ? n : e);
const lerpNum = (e, t, n) => e + (t - e) * n;
const damp = (e, t, n, r) => lerpNum(e, t, 1 - Math.exp(-n * r));
const wrapAngle = (e) => {
  for (; e > Math.PI; ) {
    e -= Math.PI * 2;
  }
  for (; e < -Math.PI; ) {
    e += Math.PI * 2;
  }
  return e;
};
const angleDelta = (e, t) => wrapAngle(t - e);
const dampAngle = (e, t, n, r) => e + angleDelta(e, t) * (1 - Math.exp(-n * r));
function seededRandom(e) {
  let t = e >>> 0;
  return function () {
    t += 1831565813;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    e ^= e + Math.imul(e ^ (e >>> 7), 61 | e);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
}
const forwardX = (e) => -Math.sin(e);
const forwardZ = (e) => -Math.cos(e);
const rightX = (e) => Math.cos(e);
const rightZ = (e) => -Math.sin(e);
function yawQuat(
  e,
  t = {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
  },
) {
  t.x = 0;
  t.y = Math.sin(e / 2);
  t.z = 0;
  t.w = Math.cos(e / 2);
  return t;
}
function quatYaw(e) {
  let t = 2 * (e.w * e.y + e.x * e.z);
  let n = 1 - 2 * (e.y * e.y + e.x * e.x);
  return Math.atan2(t, n);
}
function obbOverlap(e, t) {
  let n = [
    [Math.cos(e.yaw), -Math.sin(e.yaw)],
    [Math.sin(e.yaw), Math.cos(e.yaw)],
    [Math.cos(t.yaw), -Math.sin(t.yaw)],
    [Math.sin(t.yaw), Math.cos(t.yaw)],
  ];
  let r = t.x - e.x;
  let i = t.z - e.z;
  for (let a = 0; a < 4; a++) {
    let o = n[a][0];
    let s = n[a][1];
    let c = e.hw * Math.abs(n[0][0] * o + n[0][1] * s) + e.hl * Math.abs(n[1][0] * o + n[1][1] * s);
    let l = t.hw * Math.abs(n[2][0] * o + n[2][1] * s) + t.hl * Math.abs(n[3][0] * o + n[3][1] * s);
    if (Math.abs(r * o + i * s) > c + l) {
      return false;
    }
  }
  return true;
}
function obbDistance(e, t, n) {
  let r = Math.cos(n.yaw);
  let i = Math.sin(n.yaw);
  let a = e - n.x;
  let o = t - n.z;
  let s = a * r - o * i;
  let c = a * i + o * r;
  let l = Math.max(Math.abs(s) - n.hw, 0);
  let u = Math.max(Math.abs(c) - n.hl, 0);
  return Math.hypot(l, u);
}
function formatTime(e) {
  let t = Math.floor(e / 60);
  let n = Math.floor(e % 60);
  let r = Math.floor((e * 100) % 100);
  return `${t}:${String(n).padStart(2, '0')}.${String(r).padStart(2, '0')}`;
}
function formatMoney(e) {
  return '$' + Math.round(e).toLocaleString('en-US');
}
function base64ToBytes(e) {
  let t = atob(e);
  let n = new Uint8Array(t.length);
  for (let e = 0; e < t.length; e++) {
    n[e] = t.charCodeAt(e);
  }
  return n;
}
class AudioEngine {
  constructor() {
    this.buffers = new Map();
    this.meta = new Map();
    this.vol = {
      master: 0.8,
      music: 0.6,
      sfx: 0.9,
    };
    this.muted = false;
    this.active = new Map();
    this.listener = {
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    };
    this.musicSrc = null;
    this.musicId = null;
    this.ready = false;
  }
  readManifest() {
    let e = document.getElementById('audio-manifest');
    try {
      return JSON.parse(e.textContent);
    } catch (e) {
      console.warn('audio manifest missing', e);
      return {
        assets: [],
      };
    }
  }
  /**
   * Builds the audio graph and starts fetching and decoding every sound in the
   * background; the game does not wait for it. Music asked for before its file
   * is decoded starts as soon as it is.
   */
  init() {
    let t = window.AudioContext || window.webkitAudioContext;
    if (!t) {
      return;
    }
    this.ctx = new t({
      latencyHint: 'interactive',
    });
    let n = this.ctx;
    this.master = n.createGain();
    this.comp = n.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.2;
    this.master.connect(this.comp);
    this.comp.connect(n.destination);
    this.musicBus = n.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = n.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    this.ready = true;
    let r = this.readManifest().assets || [];
    for (let e of r) {
      this.meta.set(e.id, e);
    }
    // The title theme first, then the other music, then the effects.
    let rank = (e) => (e.id === 'music.title' ? 0 : e.kind === 'music' ? 1 : 2);
    let queue = r.slice().sort((e, t) => rank(e) - rank(t));
    let load = async () => {
      for (let t; (t = queue.shift()); ) {
        try {
          let e = t.src.startsWith('data:')
            ? base64ToBytes(t.src.slice(t.src.indexOf(',') + 1))
            : new Uint8Array(await (await fetch(t.src)).arrayBuffer());
          let r = await n.decodeAudioData(e.buffer);
          this.buffers.set(t.id, r);
          let p = this._pendingMusic;
          if (p && p.id === t.id) {
            this._pendingMusic = null;
            this.playMusic(p.id, p.opts);
          }
        } catch (e) {
          console.warn('audio decode failed', t.id, e);
        }
      }
    };
    this.loaded = Promise.all([load(), load(), load(), load()]);
  }
  /** Browsers start audio suspended until a gesture: call from any input. */
  unlock() {
    this.unlocked = true;
    if (this.ctx && !this.paused && this.ctx.state !== 'running') {
      this.ctx.resume();
    }
  }
  /** The kit's settings panel pauses the game loop: pause the sound with it. */
  setPaused(e) {
    this.paused = e;
    if (!this.ctx) {
      return;
    }
    if (e) {
      this.wasRunning = this.ctx.state === 'running';
      if (this.wasRunning) {
        this.ctx.suspend();
      }
    } else if (this.wasRunning || this.unlocked) {
      this.ctx.resume();
    }
  }
  applyVolumes() {
    if (!this.ctx) {
      return;
    }
    let e = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, e, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music, e, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, e, 0.03);
  }
  setVolumes(e) {
    Object.assign(this.vol, e);
    this.applyVolumes();
  }
  setMuted(e) {
    this.muted = e;
    this.applyVolumes();
  }
  setListener(e, t, n, r) {
    let i = this.listener;
    i.x = e;
    i.y = t;
    i.z = n;
    i.yaw = r;
  }
  _spatial(e, t = 30, n = 160) {
    if (!e) {
      return {
        gain: 1,
        pan: 0,
      };
    }
    let r = this.listener;
    let i = e.x - r.x;
    let a = e.z - r.z;
    let o = (e.y || 0) - r.y;
    let s = Math.hypot(i, o * 0.5, a);
    if (s > n) {
      return {
        gain: 0,
        pan: 0,
      };
    }
    let c = clampNum(1 / (1 + Math.max(0, s - t * 0.3) / t), 0, 1) * clampNum((n - s) / (n * 0.25), 0, 1);
    let l = Math.cos(r.yaw);
    let u = -Math.sin(r.yaw);
    return {
      gain: c,
      pan: clampNum((i * l + a * u) / 40, -0.8, 0.8),
    };
  }
  play(e, t = {}) {
    if (!this.ctx || !this.ready) {
      return null;
    }
    let n = this.buffers.get(e);
    if (!n) {
      return null;
    }
    let r = this.meta.get(e) || {};
    let i = r.maxVoices || 5;
    let a = this.active.get(e) || 0;
    if (a >= i) {
      return null;
    }
    let o = this._spatial(t.pos, t.ref, t.max);
    let s = (t.volume ?? 1) * (r.gain ?? 1) * o.gain;
    if (s < 0.01 && !t.loop) {
      return null;
    }
    let c = this.ctx;
    let l = c.createBufferSource();
    l.buffer = n;
    l.loop = !!t.loop;
    let u = t.offset || 0;
    if (l.loop && r.loopEnd) {
      l.loopStart = r.loopStart || 0;
      l.loopEnd = r.loopEnd;
      u = l.loopStart + (u % Math.max(0.01, l.loopEnd - l.loopStart));
    }
    l.playbackRate.value = (t.rate ?? 1) * (t.detune ? 1 + (Math.random() - 0.5) * t.detune : 1);
    let d = c.createGain();
    d.gain.value = s;
    let f = d;
    if (c.createStereoPanner) {
      let e = c.createStereoPanner();
      e.pan.value = o.pan;
      d.connect(e);
      f = e;
      l._pan = e;
    }
    l.connect(d);
    f.connect(t.bus === 'music' ? this.musicBus : this.sfxBus);
    l.start(0, u);
    this.active.set(e, a + 1);
    l.onended = () => {
      this.active.set(e, Math.max(0, (this.active.get(e) || 1) - 1));
    };
    return {
      src: l,
      gain: d,
      id: e,
      baseGain: r.gain ?? 1,
    };
  }
  loop(e, t = {}) {
    let n = this;
    return {
      id: e,
      handle: null,
      vol: 0,
      rate: 1,
      pos: null,
      set(e, t, n) {
        this.vol = e;
        this.rate = t;
        this.pos = n;
      },
      update() {
        if (!n.ctx || !n.ready) {
          return;
        }
        let r = this.vol > 0.005;
        if (r && !this.handle) {
          this.handle = n.play(e, {
            loop: true,
            volume: 0.0001,
            offset: Math.random() * 0.5,
          });
        }
        if (this.handle) {
          let e = n._spatial(this.pos, t.ref || 30, t.max || 160);
          let i = n.ctx.currentTime;
          this.handle.gain.gain.setTargetAtTime(this.vol * this.handle.baseGain * e.gain, i, 0.05);
          this.handle.src.playbackRate.setTargetAtTime(this.rate, i, 0.05);
          if (this.handle.src._pan) {
            this.handle.src._pan.pan.setTargetAtTime(e.pan, i, 0.05);
          }
          if (!r) {
            this.stop();
          }
        }
      },
      stop() {
        if (this.handle) {
          let e = this.handle;
          try {
            e.gain.gain.setTargetAtTime(0, n.ctx.currentTime, 0.04);
            e.src.stop(n.ctx.currentTime + 0.2);
          } catch {}
          this.handle = null;
        }
      },
    };
  }
  playMusic(e, { fade: t = 0.8, volume: n = 1 } = {}) {
    if (!this.ctx || !this.ready) {
      return;
    }
    if (this.musicId === e && this.musicSrc) {
      return;
    }
    this.stopMusic(t);
    if (!this.buffers.has(e)) {
      this._pendingMusic = {
        id: e,
        opts: {
          fade: t,
          volume: n,
        },
      };
      return;
    }
    let r = this.meta.get(e) || {};
    let i = this.play(e, {
      bus: 'music',
      loop: r.loop !== false,
      volume: 0.0001,
    });
    if (!i) {
      return;
    }
    let a = this.ctx.currentTime;
    i.gain.gain.setTargetAtTime(n * (r.gain ?? 1), a, t / 3);
    this.musicSrc = i;
    this.musicId = e;
  }
  stopMusic(e = 0.6) {
    this._pendingMusic = null;
    if (!this.musicSrc) {
      return;
    }
    let t = this.musicSrc;
    let n = this.ctx.currentTime;
    t.gain.gain.setTargetAtTime(0, n, e / 3);
    try {
      t.src.stop(n + e + 0.1);
    } catch {}
    this.musicSrc = null;
    this.musicId = null;
  }
  duckMusic(e, t = 0.3) {
    if (this.ctx) {
      this.musicBus.gain.setTargetAtTime(this.vol.music * e, this.ctx.currentTime, t / 3);
    }
  }
}
/**
 * Every control is a kit.input action (lib/kit/README.md §4): the standard
 * bindings plus the game's own keys. The kit builds the touch controls from
 * the `touch` entries (stick on the left half, buttons bottom-right, II pill).
 */
const INPUT_ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  // Keyboard and D-pad steering stays full lock on a diagonal (W+A), as it always was.
  steer: { type: 'axis', keys: { pos: ['KeyD', 'ArrowRight'], neg: ['KeyA', 'ArrowLeft'] }, gamepad: { pos: 'Right', neg: 'Left' } },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  action: { keys: ['Space', 'KeyJ'], gamepad: ['A'], touch: 'Act' },
  alt: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], gamepad: ['X'], touch: 'Alt' },
  gas: { type: 'axis', keys: { pos: ['KeyW', 'ArrowUp'] }, gamepad: { pos: 'RT' }, touch: { pos: 'Gas' } },
  brake: { type: 'axis', keys: { pos: ['KeyS', 'ArrowDown'] }, gamepad: { pos: 'LT' }, touch: { pos: 'Brake' } },
  enter: { keys: ['KeyF', 'Enter', 'NumpadEnter'], gamepad: ['Y', 'B'], touch: 'Exit' },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  back: { gamepad: ['B'] },
  stats: { keys: ['Tab'], gamepad: ['Back'] },
  camLeft: { keys: ['KeyQ'], gamepad: ['LB'] },
  camRight: { keys: ['KeyE'], gamepad: ['RB'] },
  zoom: { keys: ['KeyV'], gamepad: ['RS'] },
  horn: { keys: ['KeyH'], gamepad: ['LS'] },
  map: { keys: ['KeyM'] },
  diag: { keys: ['F3', 'Backquote'] },
};

/** Camera turn per radian of kit look input, per device (keeps the old feel). */
const LOOK_GAIN = { keyboard: 2.5, touch: 1.45, gamepad: 1 };

/**
 * Turns kit.input actions into the per-frame control state the vehicles and
 * menus read (steer, throttle, brake, move, presses, camera).
 */
class GameInput {
  constructor(kit) {
    this.kit = kit;
    this.input = kit.input;
    this.touch = kit.touch;
    this.touchScheme = 'direct';
    this.state = this.blank();
    this.zoomAcc = 0;
    this.padZoom = 0;
    this.labels = {};
    this.arrangeTouch();
  }
  get lastDevice() {
    return this.input.source;
  }
  get hasTouch() {
    return !!this.touch;
  }
  /**
   * The kit makes the first button (ACT) the big one; move it to the thumb's
   * resting spot at the bottom-right, with GAS and BRAKE above it.
   */
  arrangeTouch() {
    let e = this.touch && this.touch.element.querySelector('.kit-touch__cluster');
    if (!e) {
      return;
    }
    for (let t of ['enter', 'alt', 'gas', 'brake', 'action']) {
      let n = e.querySelector(`[data-action="${t}"]`);
      if (n) {
        e.append(n);
      }
    }
  }
  blank() {
    return {
      steer: 0,
      throttle: 0,
      brake: 0,
      moveX: 0,
      moveY: 0,
      moveMag: 0,
      direct: false,
      action: false,
      actionPressed: false,
      alt: false,
      altPressed: false,
      enterPressed: false,
      backPressed: false,
      pausePressed: false,
      hornPressed: false,
      zoomPressed: false,
      mapPressed: false,
      diagPressed: false,
      statsPressed: false,
      camYaw: 0,
      camZoom: 0,
      anyPressed: false,
    };
  }
  /** mode: 'car' | 'train' | 'walker' | 'menu'; dt in seconds. */
  poll(e, n = 1 / 60) {
    let i = this.input;
    let t = this.state;
    Object.assign(t, this.blank());
    let r = i.vector('move');
    let a = Math.min(1, Math.hypot(r.x, r.y));
    if (a > 0) {
      t.moveX = r.x;
      t.moveY = r.y;
      t.moveMag = a;
      t.steer = r.x;
    }
    let o = i.value('steer');
    if (o) {
      t.steer = o;
    }
    let s = i.value('gas');
    let c = i.value('brake');
    if (s > 0.05) {
      t.throttle = s;
    }
    if (c > 0.05) {
      t.brake = c;
    }
    // The on-screen stick: point-and-go in Direct mode, a steering wheel in Classic.
    let l = i.touch.vectors.move;
    if (l && (l.x || l.y)) {
      if (e === 'car' && this.touchScheme === 'direct') {
        t.direct = true;
      } else {
        t.steer = clampNum(l.x * 1.25, -1, 1);
        if (e === 'train') {
          t.throttle = Math.max(t.throttle, l.y);
          t.brake = Math.max(t.brake, -l.y);
        }
      }
    }
    t.action = i.down('action');
    t.alt = i.down('alt');
    t.actionPressed = i.pressed('action');
    t.altPressed = i.pressed('alt');
    t.enterPressed = i.pressed('enter');
    t.pausePressed = i.pressed('pause');
    t.hornPressed = i.pressed('horn');
    t.zoomPressed = i.pressed('zoom');
    t.mapPressed = i.pressed('map');
    t.diagPressed = i.pressed('diag');
    t.statsPressed = i.pressed('stats');
    // In menus the gamepad's B goes back instead of confirming.
    if (e === 'menu' && i.pressed('back')) {
      t.backPressed = true;
      t.enterPressed = false;
    }
    let u = 2.1 * n;
    if (i.down('camLeft')) {
      t.camYaw += u;
    }
    if (i.down('camRight')) {
      t.camYaw -= u;
    }
    let d = i.look('look');
    t.camYaw -= d.x * (LOOK_GAIN[i.source] || 1);
    // Zoom steps: wheel and pinch, and the right stick pushed up or down.
    let f = i.zoom();
    this.zoomAcc = f ? this.zoomAcc + f : this.zoomAcc * 0.9;
    if (Math.abs(this.zoomAcc) >= 0.5) {
      t.camZoom = -Math.sign(this.zoomAcc);
      this.zoomAcc = 0;
    }
    if (i.source === 'gamepad' && d.y) {
      this.padZoom += d.y;
      if (Math.abs(this.padZoom) >= 0.35) {
        t.camZoom = Math.sign(this.padZoom);
        this.padZoom = 0;
      }
    } else {
      this.padZoom = 0;
    }
    t.anyPressed =
      t.actionPressed || t.altPressed || t.enterPressed || t.pausePressed || t.statsPressed || i.pointer.justDown;
    return t;
  }
  /** Game menus and cutscenes hide the on-screen controls. */
  suspendTouch(e) {
    if (this.touch) {
      this.touch.suspend(e, 'game');
    }
  }
  /** Context labels for the touch buttons ('' hides one). Only changed values touch the DOM. */
  setTouchLabels({ action: e, alt: t, enter: n, gas: r, brake: i, showGas: a }) {
    let o = this.touch;
    if (!o) {
      return;
    }
    let s = (e, t, n) => {
      if (n === undefined || this.labels[e] === n) {
        return;
      }
      this.labels[e] = n;
      if (typeof n === 'boolean') {
        o.setShown(t, n);
      } else {
        o.setLabel(t, n || '');
        o.setShown(t, !!n);
      }
    };
    s('action', 'action', e);
    s('alt', 'alt', t);
    s('enter', 'enter', n);
    s('gas', 'gas+', r);
    s('brake', 'brake+', i);
    if (a !== undefined) {
      s('showGas', 'gas+', a);
      s('showBrake', 'brake+', a);
    }
  }
}
const FIXED_DT = 1 / 60;
const GROUP = {
  STATIC: 1,
  BUILDING: 2,
  VEHICLE: 4,
  PLAYER: 8,
  DEBRIS: 16,
  CARRIER: 32,
  DYN: 64,
  TRAIN: 128,
  FENCE: 256,
  PROP: 512,
};
const makeGroups = (e, t) => (((e & 65535) << 16) | (t & 65535)) >>> 0;
const COLLIDE = {
  static: makeGroups(GROUP.STATIC, 65535),
  fence: makeGroups(GROUP.FENCE, GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.DYN),
  building: makeGroups(GROUP.BUILDING, 65535),
  vehicle: makeGroups(
    GROUP.VEHICLE,
    GROUP.STATIC |
      GROUP.BUILDING |
      GROUP.VEHICLE |
      GROUP.DEBRIS |
      GROUP.CARRIER |
      GROUP.DYN |
      GROUP.TRAIN |
      GROUP.PLAYER |
      GROUP.FENCE,
  ),
  player: makeGroups(
    GROUP.PLAYER,
    GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.CARRIER | GROUP.DYN | GROUP.TRAIN | GROUP.FENCE | GROUP.PROP,
  ),
  prop: makeGroups(GROUP.PROP, GROUP.PLAYER),
  debris: makeGroups(
    GROUP.DEBRIS,
    GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.DEBRIS | GROUP.CARRIER | GROUP.DYN | GROUP.TRAIN,
  ),
  carrier: makeGroups(GROUP.CARRIER, GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.DYN),
  dyn: makeGroups(
    GROUP.DYN,
    GROUP.STATIC |
      GROUP.BUILDING |
      GROUP.VEHICLE |
      GROUP.DEBRIS |
      GROUP.CARRIER |
      GROUP.DYN |
      GROUP.TRAIN |
      GROUP.PLAYER |
      GROUP.FENCE,
  ),
  train: makeGroups(GROUP.TRAIN, GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.DYN),
};
const RAY_GROUND = makeGroups(65535, GROUP.STATIC | GROUP.BUILDING);
const RAY_ANY = makeGroups(
  65535,
  GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.CARRIER | GROUP.DYN | GROUP.TRAIN | GROUP.FENCE | GROUP.PROP,
);
const RAY_SOLID = makeGroups(
  65535,
  GROUP.STATIC | GROUP.BUILDING | GROUP.FENCE | GROUP.DYN | GROUP.TRAIN | GROUP.VEHICLE,
);
const RAY_BODIES = makeGroups(
  65535,
  GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.CARRIER | GROUP.DYN | GROUP.TRAIN | GROUP.FENCE,
);
/** Rapier 0.20 from the kit (kit.RAPIER), with the game's own scale: gravity -22, 60 Hz, 4 solver iterations. */
class Physics {
  init(e) {
    this.R = e;
    this._ray = new e.Ray(
      {
        x: 0,
        y: 0,
        z: 0,
      },
      {
        x: 0,
        y: -1,
        z: 0,
      },
    );
    this.colliderOwner = new Map();
    this.newWorld();
    return this;
  }
  newWorld() {
    if (this.world) {
      try {
        this.world.free();
      } catch {}
    }
    // The kit's world conventions, at the game's own gravity (it was tuned at -22, not -9.81).
    this.world = createWorld(this.R, { gravity: -22, hz: 1 / FIXED_DT });
    this.world.numSolverIterations = 4;
    this.colliderOwner.clear();
    this.staticBody = this.world.createRigidBody(this.R.RigidBodyDesc.fixed());
  }
  step() {
    this.world.step();
  }
  get bodyCount() {
    return this.world.bodies.len();
  }
  fixedBox(e, t, n, r, i, a, o = {}) {
    let s = this.R;
    let c = s.ColliderDesc.cuboid(r, i, a)
      .setFriction(o.friction ?? 0.6)
      .setRestitution(o.restitution ?? 0.05)
      .setCollisionGroups(o.groups ?? COLLIDE.static);
    let l;
    if (o.separate) {
      let r = s.RigidBodyDesc.fixed().setTranslation(e, t, n);
      if (o.yaw) {
        r.setRotation({
          x: 0,
          y: Math.sin(o.yaw / 2),
          z: 0,
          w: Math.cos(o.yaw / 2),
        });
      }
      l = this.world.createRigidBody(r);
    } else {
      l = this.staticBody;
      c.setTranslation(e, t, n);
      if (o.yaw) {
        c.setRotation({
          x: 0,
          y: Math.sin(o.yaw / 2),
          z: 0,
          w: Math.cos(o.yaw / 2),
        });
      }
    }
    let u = this.world.createCollider(c, l);
    if (o.owner) {
      this.colliderOwner.set(u.handle, o.owner);
    }
    return {
      body: l,
      col: u,
    };
  }
  removeCollider(e) {
    if (e) {
      this.colliderOwner.delete(e.handle);
      this.world.removeCollider(e, true);
    }
  }
  fixedHull(e, t = {}) {
    let n = this.R.ColliderDesc.convexHull(new Float32Array(e));
    if (!n) {
      return null;
    }
    n.setFriction(t.friction ?? 0.7).setCollisionGroups(t.groups ?? COLLIDE.static);
    let r = this.world.createCollider(n, this.staticBody);
    return {
      body: this.staticBody,
      col: r,
    };
  }
  removeBody(e) {
    if (!e) {
      return;
    }
    let t = e.numColliders();
    for (let n = 0; n < t; n++) {
      this.colliderOwner.delete(e.collider(n).handle);
    }
    this.world.removeRigidBody(e);
  }
  ray(e, t, n, r, i, a, o, s, c = null, l = true) {
    let u = this._ray;
    u.origin.x = e;
    u.origin.y = t;
    u.origin.z = n;
    u.dir.x = r;
    u.dir.y = i;
    u.dir.z = a;
    let d = this.world.castRayAndGetNormal(u, o, l, undefined, s, undefined, c || undefined);
    if (!d) {
      return null;
    }
    let f = d.timeOfImpact === undefined ? d.toi : d.timeOfImpact;
    return {
      toi: f,
      x: e + r * f,
      y: t + i * f,
      z: n + a * f,
      nx: d.normal.x,
      ny: d.normal.y,
      nz: d.normal.z,
      collider: d.collider,
    };
  }
  ownerOf(e) {
    return e ? this.colliderOwner.get(e.handle) : null;
  }
  spotFree(e, t, n, r, i, a, o) {
    let s = new this.R.Cuboid(r, i, a);
    let c = false;
    this.world.intersectionsWithShape(
      {
        x: e,
        y: t,
        z: n,
      },
      {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
      },
      s,
      () => ((c = true), false),
      undefined,
      o,
    );
    return !c;
  }
}
const _bbColor = new Color();
const _bbVec = new Vector3();
const STUD_RADIUS = 0.3;
const STUD_HEIGHT = 0.2;
class BrickBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.pbr = [];
    this.stack = [];
    this.mat = new Matrix4();
    this.ao = null;
  }
  push(e) {
    this.stack.push(this.mat.clone());
    this.mat.multiply(e);
    return this;
  }
  pushT(e, t, n, r = 0, i = 0, a = 0) {
    let o = new Matrix4().compose(
      new Vector3(e, t, n),
      new Quaternion().setFromEuler(new Euler(i, r, a, 'YXZ')),
      new Vector3(1, 1, 1),
    );
    return this.push(o);
  }
  pop() {
    this.mat = this.stack.pop();
    return this;
  }
  _col(e, t, n) {
    _bbColor.set(e);
    let r = 1;
    if (n) {
      let e = Math.min(1, Math.max(0, (t - n[0]) / Math.max(0.01, n[1] - n[0])));
      r = n[2] + (1 - n[2]) * (e * e * (3 - 2 * e));
    }
    return [_bbColor.r * r, _bbColor.g * r, _bbColor.b * r];
  }
  tri(e, t, n, r, i = [0.5, 0, 0], a = null) {
    let o = this.mat;
    let s = _bbVec.set(e[0], e[1], e[2]).applyMatrix4(o).toArray();
    let c = _bbVec.set(t[0], t[1], t[2]).applyMatrix4(o).toArray();
    let l = _bbVec.set(n[0], n[1], n[2]).applyMatrix4(o).toArray();
    let u = new Vector3(c[0] - s[0], c[1] - s[1], c[2] - s[2]);
    let d = new Vector3(l[0] - s[0], l[1] - s[1], l[2] - s[2]);
    let f = u.cross(d).normalize();
    let p = [e, t, n];
    let m = [s, c, l];
    for (let e = 0; e < 3; e++) {
      let t = m[e];
      this.pos.push(t[0], t[1], t[2]);
      this.nor.push(f.x, f.y, f.z);
      let n = this._col(r, p[e][1], a);
      this.col.push(n[0], n[1], n[2]);
      this.pbr.push(i[0], i[1], i[2] || 0);
    }
  }
  quad(e, t, n, r, i, a, o) {
    this.tri(e, t, n, i, a, o);
    this.tri(e, n, r, i, a, o);
  }
  _triOut(e, t, n, r, i, a, o) {
    let s = [t[0] - e[0], t[1] - e[1], t[2] - e[2]];
    let c = [n[0] - e[0], n[1] - e[1], n[2] - e[2]];
    let l = [s[1] * c[2] - s[2] * c[1], s[2] * c[0] - s[0] * c[2], s[0] * c[1] - s[1] * c[0]];
    let u = [(e[0] + t[0] + n[0]) / 3 - r[0], (e[1] + t[1] + n[1]) / 3 - r[1], (e[2] + t[2] + n[2]) / 3 - r[2]];
    if (l[0] * u[0] + l[1] * u[1] + l[2] * u[2] < 0) {
      this.tri(e, n, t, i, a, o);
    } else {
      this.tri(e, t, n, i, a, o);
    }
  }
  box(e, t, n, r, i, a, o, s = {}) {
    let c = [s.r ?? 0.45, s.m ?? 0, s.e ?? 0];
    let l = r / 2;
    let u = i / 2;
    let d = a / 2;
    let f = Math.min(s.bevel ?? 0.06, l * 0.45, u * 0.45, d * 0.45);
    let p = [e, t, n];
    let m = s.ao === false ? null : [t - u, t - u + Math.min(i, 1.4), typeof s.ao == 'number' ? s.ao : 0.78];
    let h = s.top ?? o;
    let g = (r, i, a, o) => {
      let s = o === 0 ? r * l : r * (l - f);
      let c = o === 1 ? i * u : i * (u - f);
      let p = o === 2 ? a * d : a * (d - f);
      return [e + s, t + c, n + p];
    };
    let _ = [-1, 1];
    for (let e of _) {
      this._quadOut(g(e, -1, -1, 0), g(e, 1, -1, 0), g(e, 1, 1, 0), g(e, -1, 1, 0), p, o, c, m);
      this._quadOut(g(-1, -1, e, 2), g(1, -1, e, 2), g(1, 1, e, 2), g(-1, 1, e, 2), p, o, c, m);
      if (!(e < 0 && s.noBottom)) {
        this._quadOut(
          g(-1, e, -1, 1),
          g(1, e, -1, 1),
          g(1, e, 1, 1),
          g(-1, e, 1, 1),
          p,
          e > 0 ? h : o,
          c,
          e > 0 ? null : m,
        );
      }
    }
    if (f > 0.001) {
      for (let e of _) {
        for (let t of _) {
          this._quadOut(g(-1, e, t, 1), g(1, e, t, 1), g(1, e, t, 2), g(-1, e, t, 2), p, e > 0 ? h : o, c, m);
          this._quadOut(g(e, -1, t, 0), g(e, 1, t, 0), g(e, 1, t, 2), g(e, -1, t, 2), p, o, c, m);
          this._quadOut(g(e, t, -1, 0), g(e, t, 1, 0), g(e, t, 1, 1), g(e, t, -1, 1), p, t > 0 ? h : o, c, m);
        }
      }
      for (let e of _) {
        for (let t of _) {
          for (let n of _) {
            this._triOut(g(e, t, n, 0), g(e, t, n, 1), g(e, t, n, 2), p, t > 0 ? h : o, c, m);
          }
        }
      }
    }
    if (s.studs) {
      let r = typeof s.studs == 'number' ? s.studs : 1;
      this.studGrid(e - l, n - d, e + l, n + d, t + u, s.studColor ?? h, c, r);
    }
    return this;
  }
  _quadOut(e, t, n, r, i, a, o, s) {
    this._triOut(e, t, n, i, a, o, s);
    this._triOut(e, n, r, i, a, o, s);
  }
  studGrid(e, t, n, r, i, a, o, s = 1) {
    let c = Math.max(1, Math.floor((n - e) / s + 0.001));
    let l = Math.max(1, Math.floor((r - t) / s + 0.001));
    let u = (e + n) / 2 - ((c - 1) * s) / 2;
    let d = (t + r) / 2 - ((l - 1) * s) / 2;
    for (let e = 0; e < c; e++) {
      for (let t = 0; t < l; t++) {
        this.stud(u + e * s, i, d + t * s, a, o, s);
      }
    }
  }
  stud(e, t, n, r, i = [0.45, 0, 0], a = 1) {
    let o = STUD_RADIUS * Math.min(1, a);
    let s = STUD_HEIGHT;
    this.cyl(e, t + s / 2, n, o, s, r, {
      pbr: i,
      seg: 8,
      noBottom: true,
      ao: false,
    });
  }
  cyl(e, t, n, r, i, a, o = {}) {
    let s = o.pbr ?? [o.r ?? 0.45, o.m ?? 0, o.e ?? 0];
    let c = o.seg ?? 10;
    let l = o.r2 ?? r;
    let u = i / 2;
    let d = o.axis ?? 'y';
    let f = (r, i, a) =>
      d === 'y' ? [e + r, t + i, n + a] : d === 'x' ? [e + i, t + r, n + a] : [e + r, t + a, n + i];
    let p = [e, t, n];
    let m = o.ao === false || d !== 'y' ? null : [t - u, t - u + Math.min(i, 1.2), 0.8];
    let h = o.top ?? a;
    let g = o.phase ?? Math.PI / c;
    for (let e = 0; e < c; e++) {
      let t = (e / c) * Math.PI * 2 + g;
      let n = ((e + 1) / c) * Math.PI * 2 + g;
      let i = Math.cos(t);
      let d = Math.sin(t);
      let _ = Math.cos(n);
      let v = Math.sin(n);
      let y = f(i * r, -u, d * r);
      let b = f(_ * r, -u, v * r);
      let x = f(i * l, u, d * l);
      let S = f(_ * l, u, v * l);
      this._quadOut(y, b, S, x, p, a, s, m);
      if (!o.noTop && l > 0.001) {
        this._triOut(f(0, u, 0), x, S, p, h, s, null);
      }
      if (!o.noBottom) {
        this._triOut(f(0, -u, 0), b, y, p, a, s, null);
      }
    }
    return this;
  }
  wedge(e, t, n, r, i, a, o, s, c, l = {}) {
    let u = [l.r ?? 0.8, l.m ?? 0, 0];
    let d;
    if (s === 'x+' || s === 'x-') {
      let i = s === 'x+' ? a : o;
      let c = s === 'x+' ? o : a;
      d = {
        tl0: [e, i, t],
        tl1: [e, i, r],
        tr0: [n, c, t],
        tr1: [n, c, r],
      };
    } else {
      let i = s === 'z+' ? a : o;
      let c = s === 'z+' ? o : a;
      d = {
        tl0: [e, i, t],
        tr0: [n, i, t],
        tl1: [e, c, r],
        tr1: [n, c, r],
      };
    }
    let f = [e, i, t];
    let p = [n, i, t];
    let m = [e, i, r];
    let h = [n, i, r];
    let g = [(e + n) / 2, i + 0.01, (t + r) / 2];
    let _ = l.top ?? c;
    this._quadOut(d.tl0, d.tr0, d.tr1, d.tl1, [g[0], i - 50, g[2]], _, u);
    this._quadOut(f, p, d.tr0, d.tl0, g, c, u);
    this._quadOut(m, h, d.tr1, d.tl1, g, c, u);
    this._quadOut(f, m, d.tl1, d.tl0, g, c, u);
    this._quadOut(p, h, d.tr1, d.tr0, g, c, u);
    return d;
  }
  merge(e) {
    this.pos.push(...e.pos);
    this.nor.push(...e.nor);
    this.col.push(...e.col);
    this.pbr.push(...e.pbr);
  }
  get vertexCount() {
    return this.pos.length / 3;
  }
  build() {
    let e = new BufferGeometry();
    e.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    e.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    e.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    e.setAttribute('pbr', new Float32BufferAttribute(this.pbr, 3));
    e.computeBoundingSphere();
    e.computeBoundingBox();
    return e;
  }
}
function brickGeometry(e = 2, t = 1.2, n = 1, r = true) {
  let i = new BrickBuilder();
  i.box(0, 0, 0, e, t, n, 16777215, {
    r: 0.4,
    bevel: 0.07,
    ao: 0.8,
  });
  if (r) {
    let n = Math.max(1, Math.round(e));
    for (let r = 0; r < n; r++) {
      i.stud(-e / 2 + 0.5 + r, t / 2, 0, 16777215, [0.4, 0, 0]);
    }
  }
  return i.build();
}
function plateGeometry(e = 2, t = 0.4, n = 2) {
  let r = new BrickBuilder();
  r.box(0, 0, 0, e, t, n, 16777215, {
    r: 0.4,
    bevel: 0.05,
    ao: 0.9,
  });
  r.studGrid(-e / 2, -n / 2, e / 2, n / 2, t / 2, 16777215, [0.4, 0, 0], 1);
  return r.build();
}
function cubeGeometry(e = 1, t = 0.08) {
  let n = new BrickBuilder();
  n.box(0, 0, 0, e, e, e, 16777215, {
    bevel: t,
    ao: false,
  });
  return n.build();
}
const ditherCell = (e) => {
  let t = floor(e);
  return fract(dot(t, vec2(0.5, t.y.mul(0.75))));
};
const ditherPattern = (e) => ditherCell(e.mul(0.5)).mul(0.25).add(ditherCell(e));
function applyDitherFade(e, t) {
  e.opacityNode = t;
  e.alphaTestNode = ditherPattern(screenCoordinate.xy).mul(0.98).add(0.01);
  return e;
}
const pbrAttribute = () => attribute('pbr', 'vec3');
function brickMaterial(e = {}) {
  let t = new MeshStandardNodeMaterial({
    vertexColors: true,
    flatShading: false,
  });
  t.roughnessNode = pbrAttribute().x;
  t.metalnessNode = pbrAttribute().y;
  t.emissiveNode = vertexColor().mul(pbrAttribute().z);
  if (e.fade) {
    t.fade = uniform(1);
    applyDitherFade(t, t.fade);
  }
  return t;
}
function glowMaterial(e = 1, t = 16777215) {
  let n = new MeshStandardNodeMaterial({
    vertexColors: true,
  });
  n.glow = uniform(e);
  n.tint = uniform(new Color(t));
  n.roughnessNode = pbrAttribute().x;
  n.metalnessNode = pbrAttribute().y;
  n.emissiveNode = vertexColor().mul(n.tint).mul(n.glow);
  return n;
}
function instancedBrickMaterial(e) {
  let t = new MeshStandardNodeMaterial({
    vertexColors: true,
  });
  let n = instancedDynamicBufferAttribute(e, 'vec3');
  t.roughnessNode = n.x;
  t.metalnessNode = n.y;
  applyDitherFade(t, n.z);
  return t;
}
function groundMaterial() {
  let e = new MeshStandardNodeMaterial({
    vertexColors: true,
  });
  let t = pbrAttribute();
  let n = positionWorld;
  let r = normalWorld;
  let i = t.z;
  let a = fwidth(n.x).add(fwidth(n.z)).mul(0.5);
  let o = clamp(float(1).sub(a.sub(0.05).div(0.35)), 0, 1);
  let s = fract(n.xz).sub(0.5);
  let c = length(s);
  let l = max(a, 0.01);
  let u = smoothstep(float(0.3).add(l), float(0.3).sub(l), c);
  let d = length(s.sub(vec2(0.075, 0.075)));
  let f = smoothstep(float(0.31).add(l), float(0.31).sub(l), d).mul(float(1).sub(u));
  let p = u.mul(float(0.05).add(max(dot(s.div(0.3), vec2(-0.7, -0.7)), 0).mul(0.14)));
  let m = float(1).add(p).sub(f.mul(0.22));
  let h = floor(n.xz);
  let g = hash(h.x.mul(157).add(h.y.mul(311)))
    .sub(0.5)
    .mul(0.05);
  let _ = fract(n.xz.div(2));
  let v = min(min(_.x, float(1).sub(_.x)), min(_.y, float(1).sub(_.y)));
  let y = smoothstep(float(0), l.mul(0.5).add(0.012), v);
  let b = mix(float(0.8), float(1), y).add(
    hash(
      floor(n.xz.div(2))
        .x.mul(71)
        .add(floor(n.xz.div(2)).y.mul(113)),
    )
      .sub(0.5)
      .mul(0.05),
  );
  let x = select(abs(r.x).greaterThan(0.5), n.z, n.x);
  let S = floor(n.y.div(1.2));
  let ee = fract(S.mul(0.5)).mul(2);
  let te = fract(x.add(ee).div(2));
  let ne = fract(n.y.div(1.2));
  let re = min(min(te, float(1).sub(te)).mul(2), min(ne, float(1).sub(ne)).mul(1.2));
  let ie = smoothstep(float(0), l.add(0.035), re);
  let ae = mix(float(0.72), float(1), ie).add(
    hash(S.mul(19).add(floor(x.add(ee).div(2)).mul(7)))
      .sub(0.5)
      .mul(0.07),
  );
  let oe = r.y.greaterThan(0.5);
  let se = hash(
    floor(n.xz.mul(2))
      .x.mul(37)
      .add(floor(n.xz.mul(2)).y.mul(91)),
  )
    .sub(0.5)
    .mul(0.09);
  let ce = hash(
    floor(n.xz.div(6))
      .x.mul(13)
      .add(floor(n.xz.div(6)).y.mul(29)),
  )
    .sub(0.5)
    .mul(0.06);
  let le = float(1).add(se).add(ce);
  let ue = select(
    i.greaterThan(3.5),
    le,
    select(
      i.greaterThan(2.5),
      b.mul(0.97),
      select(i.greaterThan(1.5), b, select(i.greaterThan(0.5), m.add(g), float(1))),
    ),
  );
  let de = select(i.lessThan(0.5), float(1), ae);
  let fe = mix(float(1), select(oe, ue, de), o);
  e.colorNode = vec4(vertexColor().rgb.mul(fe), 1);
  e.roughnessNode = t.x;
  e.metalnessNode = t.y;
  return e;
}
function unlitMaterial() {
  let e = new MeshBasicNodeMaterial();
  e.toneMapped = true;
  return e;
}
function matteMaterial() {
  return new MeshStandardNodeMaterial({
    roughness: 0.9,
    metalness: 0,
  });
}
function pulseMaterial(e) {
  let t = new MeshStandardNodeMaterial({
    vertexColors: true,
  });
  let n = instancedDynamicBufferAttribute(e, 'float');
  t.roughnessNode = pbrAttribute().x;
  t.metalnessNode = pbrAttribute().y;
  let r = sin(time.mul(6)).mul(0.25).add(0.75);
  t.emissiveNode = vertexColor().mul(pbrAttribute().z).mul(n).mul(r);
  return t;
}
const HEIGHT = {
  SUNK: -6,
  SURF: 0,
  DECK: 8,
};
const ROADS = [
  {
    id: 'main',
    rect: [-8, -66, 8, 252],
    dir: 'ns',
    lanes: 4,
    center: 'yellow',
  },
  {
    id: 'argent',
    rect: [-8, -66, 212, -50],
    dir: 'ew',
    lanes: 4,
    center: 'yellow',
  },
  {
    id: 'south',
    rect: [-80, 178, 152, 190],
    dir: 'ew',
    lanes: 2,
  },
  {
    id: 'middle',
    rect: [-80, 56, 152, 66],
    dir: 'ew',
    lanes: 2,
  },
  {
    id: 'west',
    rect: [-80, -178, -68, 190],
    dir: 'ns',
    lanes: 2,
  },
  {
    id: 'north',
    rect: [-84, -178, 152, -166],
    dir: 'ew',
    lanes: 2,
  },
  {
    id: 'east',
    rect: [140, -178, 152, 190],
    dir: 'ns',
    lanes: 2,
  },
];
const PAINTS = {
  pavement: [11843774, 0.62, 0, 1],
  sidewalk: [13947337, 0.7, 0, 2],
  asphalt: [6053993, 0.8, 0, 4],
  grass: [5941315, 0.7, 0, 1],
  plaza: [14206880, 0.6, 0, 2],
  concrete: [9341829, 0.8, 0, 2],
  railbed: [5919563, 0.95, 0, 3],
  deck: [11446687, 0.7, 0, 2],
  dirt: [10123347, 0.9, 0, 1],
  compound: [10002856, 0.65, 0, 1],
  safe: [14724383, 0.5, 0, 2],
  water: [2981828, 0.08, 0.1, 0],
};
const WALL_COLOR = 10721418;
const SUNKEN = [
  {
    id: 'courtyard',
    rect: [-108, 30, -86, 62],
  },
  {
    id: 'stairwell',
    rect: [-86, 52, -80, 58],
  },
  {
    id: 'trench',
    rect: [-126, -176, -110, 62],
  },
  {
    id: 'doorgap',
    rect: [-110, 42, -108, 48],
  },
  {
    id: 'northramp',
    rect: [-110, -176, -84, -166],
  },
  {
    id: 'maze',
    rect: [-178, -96, -128, -16],
  },
  {
    id: 'mazegap',
    rect: [-128, -66, -126, -56],
  },
  {
    id: 'pit',
    rect: [164, 78, 196, 122],
  },
  {
    id: 'pittunnel',
    rect: [180, 122, 188, 140],
  },
  {
    id: 'hangar',
    rect: [168, 140, 204, 178],
  },
];
const RAISED = [
  {
    id: 'deck',
    rect: [-60, -150, -20, -110],
    h: 8,
  },
];
const ROOFS = [
  {
    id: 'subway-a',
    rect: [-126, -44, -110, 24],
  },
  {
    id: 'subway-b',
    rect: [-126, -138, -110, -80],
  },
  {
    id: 'pit-tunnel',
    rect: [180, 124, 188, 140],
  },
];
const NO_FENCE = [
  [-81, 52, -79, 58],
  [163, 94, 165, 106],
  [-85, -176, -83, -166],
];
const PAINT_RECTS = [
  ['grass', [-60, 194, -14, 248]],
  ['grass', [14, 194, 136, 248]],
  ['grass', [60, -40, 134, 50]],
  ['grass', [-64, 70, -30, 88]],
  ['grass', [-150, 70, -130, 180]],
  ['grass', [156, 128, 166, 186]],
  ['grass', [156, -40, 208, 60]],
  ['plaza', [18, 96, 66, 144]],
  ['plaza', [-64, -60, -40, -44]],
  ['compound', [58, -162, 130, -108]],
  ['safe', [194, -74, 212, -42]],
  ['grass', [-100, 70, -84, 180]],
  ['grass', [-100, -150, -86, 20]],
];
const RAMPS = [
  {
    id: 'stairs',
    rect: [-92, 52, -80, 58],
    dir: 'x+',
    y0: -6,
    y1: 0,
    stairs: true,
    color: 10262156,
  },
  {
    id: 'northramp',
    rect: [-110, -176, -84, -166],
    dir: 'x+',
    y0: -6,
    y1: 0,
    color: 9407106,
  },
  {
    id: 'pitramp',
    rect: [164, 94, 182, 106],
    dir: 'x-',
    y0: -6,
    y1: 0,
    color: 9075298,
  },
];
const MAZE = {
  x0: -178,
  z0: -96,
  cols: 5,
  rows: 8,
  cell: 10,
  wall: 1.6,
  h: 4.2,
  entranceRow: 3,
  goal: [0, 7],
  seed: 1997,
};
function generateMaze() {
  let { cols: e, rows: t, seed: n } = MAZE;
  let r = seededRandom(n);
  let i = Array.from(
    {
      length: t + 1,
    },
    () => Array(e).fill(true),
  );
  let a = Array.from(
    {
      length: t,
    },
    () => Array(e + 1).fill(true),
  );
  let o = Array.from(
    {
      length: t,
    },
    () => Array(e).fill(false),
  );
  let s = [[MAZE.entranceRow, e - 1]];
  for (o[MAZE.entranceRow][e - 1] = true; s.length; ) {
    let [n, c] = s[s.length - 1];
    let l = [];
    if (n > 0 && !o[n - 1][c]) {
      l.push([n - 1, c, 'n']);
    }
    if (n < t - 1 && !o[n + 1][c]) {
      l.push([n + 1, c, 's']);
    }
    if (c > 0 && !o[n][c - 1]) {
      l.push([n, c - 1, 'w']);
    }
    if (c < e - 1 && !o[n][c + 1]) {
      l.push([n, c + 1, 'e']);
    }
    if (!l.length) {
      s.pop();
      continue;
    }
    let [u, d, f] = l[Math.floor(r() * l.length)];
    if (f === 'n') {
      i[n][c] = false;
    }
    if (f === 's') {
      i[n + 1][c] = false;
    }
    if (f === 'w') {
      a[n][c] = false;
    }
    if (f === 'e') {
      a[n][c + 1] = false;
    }
    o[u][d] = true;
    s.push([u, d]);
  }
  i[5][2] = false;
  a[2][2] = false;
  a[MAZE.entranceRow][e] = false;
  let c = (e, t) => e * 100 + t;
  let l = new Map();
  let u = [[MAZE.entranceRow, e - 1]];
  for (l.set(c(MAZE.entranceRow, e - 1), null); u.length; ) {
    let [n, r] = u.shift();
    if (n === MAZE.goal[1] && r === MAZE.goal[0]) {
      break;
    }
    let o = [];
    if (n > 0 && !i[n][r]) {
      o.push([n - 1, r]);
    }
    if (n < t - 1 && !i[n + 1][r]) {
      o.push([n + 1, r]);
    }
    if (r > 0 && !a[n][r]) {
      o.push([n, r - 1]);
    }
    if (r < e - 1 && !a[n][r + 1]) {
      o.push([n, r + 1]);
    }
    for (let [e, t] of o) {
      if (!l.has(c(e, t))) {
        l.set(c(e, t), [n, r]);
        u.push([e, t]);
      }
    }
  }
  let d = [];
  let f = [MAZE.goal[1], MAZE.goal[0]];
  for (; f; ) {
    d.unshift(f);
    f = l.get(c(f[0], f[1]));
  }
  return {
    hW: i,
    vW: a,
    path: d,
  };
}
const cellCenter = (e, t) => [MAZE.x0 + MAZE.cell * (t + 0.5), MAZE.z0 + MAZE.cell * (e + 0.5)];
const BUILDINGS = [
  {
    id: 'A1',
    name: "Rosie's Corner Diner",
    x: 0,
    z: 146,
    w: 12,
    d: 10,
    courses: 6,
    style: 'diner',
  },
  {
    id: 'A2',
    name: 'Rivera Apartments',
    x: -5,
    z: 104,
    w: 12,
    d: 12,
    courses: 10,
    style: 'apartment',
    survivor: true,
  },
  {
    id: 'A3',
    name: 'Suds Laundromat',
    x: 5,
    z: 62,
    w: 10,
    d: 10,
    courses: 7,
    style: 'shop',
  },
  {
    id: 'A4',
    name: 'Argent Mutual Offices',
    x: 0,
    z: 22,
    w: 14,
    d: 12,
    courses: 11,
    style: 'office',
    survivor: true,
  },
  {
    id: 'A5',
    name: 'Park & Ride Garage',
    x: -2,
    z: -22,
    w: 12,
    d: 12,
    courses: 8,
    style: 'garage',
  },
  {
    id: 'A6',
    name: 'Metro Freight Depot',
    x: 48,
    z: -58,
    w: 14,
    d: 12,
    courses: 8,
    style: 'warehouse',
    survivor: true,
  },
  {
    id: 'A7',
    name: 'Silver Savings Bank',
    x: 96,
    z: -57,
    w: 12,
    d: 12,
    courses: 10,
    style: 'bank',
  },
  {
    id: 'B1',
    name: 'Pitside Workshop',
    x: 158,
    z: 106,
    w: 10,
    d: 10,
    courses: 7,
    style: 'shed',
  },
  {
    id: 'B2',
    name: 'Pitside Storehouse',
    x: 158,
    z: 94,
    w: 10,
    d: 10,
    courses: 8,
    style: 'warehouse',
    survivor: true,
  },
  {
    id: 'C1',
    name: 'Research Annex A',
    x: 76,
    z: -144,
    w: 10,
    d: 10,
    courses: 8,
    style: 'lab',
    survivor: true,
  },
  {
    id: 'C2',
    name: 'Research Annex B',
    x: 102,
    z: -124,
    w: 12,
    d: 10,
    courses: 7,
    style: 'lab',
  },
  {
    id: 'C3',
    name: 'Secure Stores',
    x: 114,
    z: -148,
    w: 10,
    d: 12,
    courses: 9,
    style: 'bank',
    survivor: true,
  },
  {
    id: 'D1',
    name: 'Skydeck Suites',
    x: -48,
    z: -136,
    w: 10,
    d: 10,
    courses: 9,
    style: 'apartment',
    y: 8,
    survivor: true,
  },
  {
    id: 'D2',
    name: 'Skydeck Kiosk',
    x: -30,
    z: -122,
    w: 10,
    d: 8,
    courses: 6,
    style: 'diner',
    y: 8,
    survivor: true,
  },
];
const TOWERS = [
  {
    x: -40,
    z: 146,
    w: 22,
    d: 22,
    h: 58,
    v: 0,
  },
  {
    x: 104,
    z: 130,
    w: 26,
    d: 24,
    h: 72,
    v: 1,
  },
  {
    x: -38,
    z: 4,
    w: 22,
    d: 20,
    h: 62,
    v: 2,
  },
  {
    x: 36,
    z: 12,
    w: 20,
    d: 20,
    h: 48,
    v: 3,
  },
  {
    x: 30,
    z: -118,
    w: 22,
    d: 22,
    h: 66,
    v: 1,
  },
  {
    x: 184,
    z: -120,
    w: 26,
    d: 26,
    h: 80,
    v: 0,
  },
  {
    x: 184,
    z: 18,
    w: 24,
    d: 22,
    h: 56,
    v: 2,
  },
  {
    x: 72,
    z: 222,
    w: 24,
    d: 22,
    h: 50,
    v: 3,
  },
  {
    x: -150,
    z: 30,
    w: 26,
    d: 24,
    h: 70,
    v: 1,
  },
  {
    x: -152,
    z: -140,
    w: 24,
    d: 26,
    h: 64,
    v: 3,
  },
  {
    x: -150,
    z: 214,
    w: 24,
    d: 24,
    h: 52,
    v: 0,
  },
  {
    x: 120,
    z: -186,
    w: 30,
    d: 14,
    h: 44,
    v: 2,
  },
  {
    x: -40,
    z: -186,
    w: 30,
    d: 14,
    h: 40,
    v: 0,
  },
  {
    x: -110,
    z: 214,
    w: 20,
    d: 20,
    h: 36,
    v: 2,
  },
  {
    x: 110,
    z: 76,
    w: 16,
    d: 16,
    h: 34,
    v: 3,
  },
];
const COMMS = [
  {
    id: 'comm1',
    x: -34,
    y: 0,
    z: 214,
    name: 'Park Relay',
  },
  {
    id: 'comm2',
    x: -26,
    y: 8,
    z: -142,
    name: 'Skydeck Relay',
  },
];
const SCIENTIST = {
  x: -173,
  y: -6,
  z: -21,
};
const SECRET = {
  x: 42,
  y: 0,
  z: 120,
  name: 'Argent Fountain Crystal',
};
const VEHICLE_SPAWNS = [
  {
    type: 'backlash',
    x: 0,
    y: 0,
    z: 190,
    yaw: 0,
  },
  {
    type: 'ramdozer',
    x: -98,
    y: -6,
    z: 35.5,
    yaw: Math.PI,
  },
  {
    type: 'police',
    x: -123,
    y: -6,
    z: -47,
    yaw: 0,
  },
  {
    type: 'ballista',
    x: -113,
    y: -6,
    z: -152,
    yaw: 0,
  },
  {
    type: 'jbomb',
    x: 186,
    y: -6,
    z: 164,
    yaw: 0,
  },
];
const PLAYER_START = {
  vehicle: 'backlash',
};
const TRAIN = {
  x: -118,
  y: -6,
  z0: 58,
  z1: -174,
  start: 40,
  stations: [
    {
      name: 'Courtyard',
      z: 40,
    },
    {
      name: 'Beacon Stop',
      z: -61,
    },
    {
      name: 'North Terminus',
      z: -150,
    },
  ],
};
const BEACON = {
  x: -110.6,
  y: -3.2,
  z: -61,
};
const BLOCK = {
  x: -77.5,
  y: 0,
  z: 55,
  w: 5,
  h: 3,
  d: 6,
};
const BOLLARD_LINES = [
  {
    x0: -80.6,
    z0: 52.3,
    x1: -80.6,
    z1: 57.7,
    n: 4,
  },
];
const BOLLARD_RINGS = [
  {
    x: SECRET.x,
    z: SECRET.z,
    r: 7.5,
    n: 18,
  },
];
const TNT = [
  {
    x: -96,
    y: -6,
    z: 45,
  },
];
const DOORS = [
  {
    id: 'blastdoor',
    kind: 'steel',
    x: -109,
    y: -6,
    z: 45,
    w: 2,
    h: 5,
    d: 6,
    name: 'Subway Blast Door',
  },
  {
    id: 'wooddoor',
    kind: 'wood',
    x: 184,
    y: -6,
    z: 122.8,
    w: 8,
    h: 4.5,
    d: 1.4,
    name: 'Pit Tunnel Door',
  },
];
const GATES = [
  {
    id: 'northgate',
    x: -85,
    y: 0,
    z: -171,
    w: 1.2,
    h: 5,
    d: 10,
    trigger: [-112, -176, -95, -166],
  },
];
const AMMO = [
  {
    x: -115,
    y: -6,
    z: -162,
  },
  {
    x: 40,
    y: 0,
    z: -172,
  },
  {
    x: 146,
    y: 0,
    z: 40,
  },
  {
    x: 28,
    y: 0,
    z: 104,
  },
  {
    x: 146,
    y: 0,
    z: -120,
  },
];
const FINISH = {
  x: -22,
  y: 0,
  z: 198,
  yaw: Math.PI / 2,
};
const DECON = {
  x: 203,
  z: -58,
};
function carrierPath() {
  let e = [];
  for (let t = 262; t >= -28; --t) {
    e.push([0, t]);
  }
  for (let t = 1; t <= 48; t++) {
    let n = (t / 48) * (Math.PI / 2);
    e.push([30 - Math.cos(n) * 30, -28 - Math.sin(n) * 30]);
  }
  for (let t = 31; t <= 204; t += 1) {
    e.push([t, -58]);
  }
  return e;
}
const CARRIER = {
  speed: 3.2,
  relaxedSpeed: 2.4,
  halfWidth: 2.7,
  halfLength: 8.6,
};
function rduPositions() {
  let e = [];
  let t = (t, n, r) => e.push([t, n, r]);
  for (let e = 0; e < 24; e++) {
    t(e % 2 ? 6.2 : -6.2, 0, 236 - e * 12);
  }
  for (let e = 0; e < 10; e++) {
    t(22 + e * 18.5, 0, e % 2 ? -52.5 : -63.5);
  }
  for (let e = 0; e < 8; e++) {
    t(-74, 0, 170 - e * 43);
  }
  t(-104, -6, 38);
  t(-90, -6, 36);
  t(-104, -6, 58);
  t(-96, -6, 60);
  for (let e = 0; e < 16; e++) {
    t(-114.6, -6, 30 - e * 13.2);
  }
  for (let e = 0; e < 8; e++) {
    t(-58 + e * 27, 0, -172);
  }
  for (let e = 0; e < 8; e++) {
    t(146, 0, -150 + e * 44);
  }
  t(176, -6, 84);
  t(190, -6, 112);
  t(184, -6, 131);
  t(176, -6, 150);
  t(198, -6, 152);
  t(186, -6, 174);
  t(68, 0, -118);
  t(90, 0, -152);
  t(122, 0, -118);
  t(92, 0, -136);
  t(-54, 8, -116);
  t(-24, 8, -148);
  return e;
}
const TALL_FENCES = [
  {
    pts: [
      [58, -162],
      [130, -162],
      [130, -108],
      [58, -108],
      [58, -162],
    ],
    h: 6.5,
  },
];
function propLayout() {
  let e = seededRandom(4242);
  let t = {
    lamp: [],
    tree: [],
    bench: [],
    hydrant: [],
    cone: [],
    car: [],
    mailbox: [],
    bin: [],
    planter: [],
  };
  let n = (e, n, r, i, a, o) => {
    let s = Math.hypot(r - e, i - n);
    let c = Math.floor(s / a);
    for (let a = 0; a <= c; a++) {
      let s = c ? a / c : 0;
      t.lamp.push([e + (r - e) * s, 0, n + (i - n) * s, o]);
    }
  };
  n(-9.6, 240, -9.6, 172, 22, -Math.PI / 2);
  n(9.6, 240, 9.6, 172, 22, Math.PI / 2);
  n(-9.6, 130, -9.6, 76, 27, -Math.PI / 2);
  n(9.6, 128, 9.6, 80, 24, Math.PI / 2);
  n(-9.6, 44, -9.6, -40, 28, -Math.PI / 2);
  n(9.6, 44, 9.6, 40, 20, Math.PI / 2);
  n(20, -48.4, 190, -48.4, 34, 0);
  n(20, -67.6, 190, -67.6, 34, Math.PI);
  n(-66.4, 170, -66.4, -150, 32, Math.PI / 2);
  n(-81.6, 170, -81.6, 60, 36, -Math.PI / 2);
  n(-60, -164.4, 130, -164.4, 38, 0);
  n(138.4, 170, 138.4, -150, 40, -Math.PI / 2);
  n(153.6, 60, 153.6, -40, 34, Math.PI / 2);
  n(-60, 176.4, -20, 176.4, 20, 0);
  n(20, 176.4, 130, 176.4, 28, 0);
  n(-60, 67.6, -16, 67.6, 22, Math.PI);
  n(18, 67.6, 130, 67.6, 28, Math.PI);
  let r = (n, r, i, a, o) => {
    for (let s = 0; s < o; s++) {
      t.tree.push([n + e() * (i - n), 0, r + e() * (a - r), e() * 6.28, 0.8 + e() * 0.5]);
    }
  };
  r(-58, 222, -16, 246, 7);
  r(-58, 196, -44, 206, 2);
  r(16, 200, 50, 246, 7);
  r(96, 200, 134, 246, 5);
  r(64, -36, 94, 46, 10);
  r(124, -36, 132, 46, 3);
  r(-148, 74, -132, 176, 8);
  r(-98, 74, -86, 176, 7);
  r(-98, -146, -88, 16, 9);
  r(158, 132, 164, 184, 4);
  r(160, -36, 176, 0, 3);
  r(196, 40, 206, 58, 2);
  r(-62, 72, -32, 86, 4);
  for (let n = 0; n < 8; n++) {
    let r = (n / 8) * Math.PI * 2 + 0.2;
    t.tree.push([42 + Math.cos(r) * 17, 0, 120 + Math.sin(r) * 17, e() * 6, 0.9]);
  }
  for (let e = 0; e < 6; e++) {
    let n = (e / 6) * Math.PI * 2;
    t.bench.push([42 + Math.cos(n) * 11.5, 0, 120 + Math.sin(n) * 11.5, -n + Math.PI / 2]);
  }
  [
    [-30, 0, 236, 0],
    [-50, 0, 230, 1.2],
    [30, 0, 230, 0.4],
    [80, 0, 10, 1.57],
    [100, 0, -20, 0],
  ].forEach((e) => t.bench.push(e));
  [
    [-10.2, 0, 160],
    [10.2, 0, 90],
    [-10.2, 0, 50],
    [10.2, 0, -5],
    [30, 0, -47.8],
    [-66.2, 0, 100],
    [138.2, 0, 10],
    [70, 0, -164.2],
    [-20, 0, 176.2],
    [110, 0, 67.8],
  ].forEach((e) => t.hydrant.push(e));
  [
    [-10.4, 0, 186],
    [10.4, 0, 120],
    [22, 0, -47.6],
    [-66, 0, 20],
    [138, 0, -100],
    [60, 0, 176.6],
  ].forEach((e) => t.mailbox.push(e));
  [
    [24, 0, 98],
    [62, 0, 98],
    [24, 0, 142],
    [62, 0, 142],
    [-10.4, 0, 70],
    [10.4, 0, 30],
    [-60, 0, -46],
  ].forEach((e) => t.bin.push(e));
  for (let e = 0; e < 7; e++) {
    t.cone.push([-70.5, 0, 118 + e * 3.2]);
  }
  for (let e = 0; e < 6; e++) {
    t.cone.push([60 + e * 3.5, 0, -168.5]);
  }
  for (let e = 0; e < 5; e++) {
    t.cone.push([144, 0, 70 + e * 3]);
  }
  let i = (n, r, i, a, o, s, c) => {
    for (let l = 0; l < i; l++) {
      for (let i = 0; i < a; i++) {
        if (e() > 0.28) {
          t.car.push([n + l * o, 0, r + i * s, c + (e() > 0.5 ? Math.PI : 0), Math.floor(e() * 6)]);
        }
      }
    }
  };
  i(-58, 96, 6, 2, 6.5, 14, (Math.PI / 2) * 0);
  i(-60, -40, 4, 2, 6.5, 14, 0);
  i(162, 64, 1, 1, 0, 0, Math.PI / 2);
  i(20, -150, 1, 3, 0, 12, Math.PI / 2);
  for (let e = 0; e < 5; e++) {
    t.planter.push([-64 + e * 6, 0, -52]);
  }
  return t;
}
/** The level module, as one object (the objectives system reads it). */
const LEVEL = {
  AMMO,
  BEACON,
  BLOCK,
  BOLLARD_LINES,
  BOLLARD_RINGS,
  BUILDINGS,
  CARRIER,
  COMMS,
  DECON,
  DOORS,
  FINISH,
  GATES,
  H: HEIGHT,
  MAZE,
  NO_FENCE,
  PAINTS,
  PAINT_RECTS,
  PLAYER_START,
  RAISED,
  RAMPS,
  ROADS,
  ROOFS,
  SCIENTIST,
  SECRET,
  SUNKEN,
  TALL_FENCES,
  TNT,
  TOWERS,
  TRAIN,
  VEHICLE_SPAWNS,
  WALL_COLOR,
  carrierPath,
  cellCenter,
  generateMaze,
  propLayout,
  rduPositions,
};
const CELL = 2;
const WORLD_X0 = -184;
const WORLD_X1 = 212;
const WORLD_Z0 = -196;
const WORLD_Z1 = 252;
const LEVEL_YS = [-6, 0, 8];
class World {
  constructor() {
    this.nx = 396 / CELL;
    this.nz = 448 / CELL;
    this.h = new Int8Array(this.nx * this.nz);
    this.paint = new Uint8Array(this.nx * this.nz);
    this.roof = new Uint8Array(this.nx * this.nz);
    this.paintNames = Object.keys(PAINTS);
    this.bounds = {
      x0: WORLD_X0,
      x1: WORLD_X1,
      z0: WORLD_Z0,
      z1: WORLD_Z1,
    };
    this.colliderSpecs = [];
    this.occluders = [];
    this.meshes = [];
    this.maze = generateMaze();
    this.glowMats = [];
  }
  idx(e, t) {
    return t * this.nx + e;
  }
  cellOf(e, t) {
    return [Math.floor((e - WORLD_X0) / CELL), Math.floor((t - WORLD_Z0) / CELL)];
  }
  stamp(e, t) {
    let [n, r, i, a] = e;
    let o = Math.max(0, Math.round((n - WORLD_X0) / CELL));
    let s = Math.min(this.nx, Math.round((i - WORLD_X0) / CELL));
    let c = Math.max(0, Math.round((r - WORLD_Z0) / CELL));
    let l = Math.min(this.nz, Math.round((a - WORLD_Z0) / CELL));
    for (let e = c; e < l; e++) {
      for (let n = o; n < s; n++) {
        t(this.idx(n, e), n, e);
      }
    }
  }
  layout() {
    let e = (e) => this.paintNames.indexOf(e);
    this.paint.fill(e('pavement'));
    for (let t of ROADS) {
      let [n, r, i, a] = t.rect;
      this.stamp([n - 4, r - 4, i + 4, a + 4], (t) => {
        this.paint[t] = e('sidewalk');
      });
    }
    for (let [t, n] of PAINT_RECTS) {
      this.stamp(n, (n) => {
        this.paint[n] = e(t);
      });
    }
    for (let t of ROADS) {
      this.stamp(t.rect, (t) => {
        this.paint[t] = e('asphalt');
      });
    }
    for (let t of SUNKEN) {
      this.stamp(t.rect, (n) => {
        this.h[n] = -1;
        this.paint[n] = e(t.id === 'pit' ? 'dirt' : 'concrete');
      });
    }
    this.stamp([TRAIN.x - 2, TRAIN.z1 - 2, TRAIN.x + 2, TRAIN.z0 + 4], (t) => {
      this.paint[t] = e('railbed');
    });
    for (let t of RAISED) {
      this.stamp(t.rect, (t) => {
        this.h[t] = 1;
        this.paint[t] = e('deck');
      });
    }
    for (let e of ROOFS) {
      this.stamp(e.rect, (e) => {
        this.roof[e] = 1;
      });
    }
  }
  heightAtCell(e, t) {
    return e < 0 || t < 0 || e >= this.nx || t >= this.nz ? 0 : LEVEL_YS[this.h[this.idx(e, t)] + 1];
  }
  groundY(e, t, n = 100) {
    for (let n of RAMPS) {
      let [r, i, a, o] = n.rect;
      if (e >= r && e <= a && t >= i && t <= o) {
        let s;
        s =
          n.dir === 'x+'
            ? (e - r) / (a - r)
            : n.dir === 'x-'
              ? (a - e) / (a - r)
              : n.dir === 'z+'
                ? (t - i) / (o - i)
                : (o - t) / (o - i);
        return n.y0 + (n.y1 - n.y0) * s;
      }
    }
    let [r, i] = this.cellOf(e, t);
    if (r < 0 || i < 0 || r >= this.nx || i >= this.nz) {
      return 0;
    }
    let a = this.idx(r, i);
    let o = LEVEL_YS[this.h[a] + 1];
    return this.roof[a] && n > -1.5 ? 0 : o;
  }
  isRoofed(e, t) {
    let [n, r] = this.cellOf(e, t);
    return n < 0 || r < 0 || n >= this.nx || r >= this.nz ? false : !!this.roof[this.idx(n, r)];
  }
  build(e, t) {
    this.layout();
    this.gmat = groundMaterial();
    this.kmat = brickMaterial();
    this.buildGround(e);
    this.buildRoofs(e);
    this.buildRamps(e);
    this.buildMarkings(e);
    this.buildRails(e);
    this.buildMaze(e);
    this.buildFences(e);
    this.buildTowers(e);
    this.buildDressing(e);
    this.buildBoundary(e);
  }
  addMesh(e, t, n, r = {}) {
    let i = new Mesh(t, n);
    i.castShadow = r.cast ?? true;
    i.receiveShadow = r.receive ?? true;
    i.matrixAutoUpdate = false;
    i.updateMatrix();
    e.add(i);
    this.meshes.push(i);
    return i;
  }
  collider(e) {
    this.colliderSpecs.push(e);
  }
  buildGround(e) {
    let t = new BrickBuilder();
    let n = this.nx;
    let r = this.nz;
    let i = new Uint8Array(n * r);
    for (let e = 0; e < r; e++) {
      for (let a = 0; a < n; a++) {
        let o = this.idx(a, e);
        if (i[o]) {
          continue;
        }
        let s = this.h[o] * 256 + this.paint[o];
        let c = 1;
        for (
          ;
          a + c < n &&
          !i[this.idx(a + c, e)] &&
          this.h[this.idx(a + c, e)] * 256 + this.paint[this.idx(a + c, e)] === s;
        ) {
          c++;
        }
        let l = 1;
        outer: for (; e + l < r; ) {
          for (let t = 0; t < c; t++) {
            let n = this.idx(a + t, e + l);
            if (i[n] || this.h[n] * 256 + this.paint[n] !== s) {
              break outer;
            }
          }
          l++;
        }
        for (let t = 0; t < l; t++) {
          for (let n = 0; n < c; n++) {
            i[this.idx(a + n, e + t)] = 1;
          }
        }
        let u = WORLD_X0 + a * CELL;
        let d = WORLD_Z0 + e * CELL;
        let f = u + c * CELL;
        let p = d + l * CELL;
        let m = LEVEL_YS[this.h[o] + 1];
        let [h, g, _, v] = PAINTS[this.paintNames[this.paint[o]]];
        t.quad([u, m, d], [u, m, p], [f, m, p], [f, m, d], h, [g, _, v]);
      }
    }
    let a = WALL_COLOR;
    let o = [0.85, 0, 1];
    for (let e = 0; e < n - 1; e++) {
      let n = null;
      let i = () => {
        if (!n) {
          return;
        }
        let r = WORLD_X0 + (e + 1) * CELL;
        let i = WORLD_Z0 + n.j0 * CELL;
        let s = WORLD_Z0 + (n.j1 + 1) * CELL;
        if (n.lowLeft) {
          t.quad([r, n.lo, i], [r, n.hi, i], [r, n.hi, s], [r, n.lo, s], a, o, [n.lo, n.lo + 1.4, 0.7]);
        } else {
          t.quad([r, n.lo, s], [r, n.hi, s], [r, n.hi, i], [r, n.lo, i], a, o, [n.lo, n.lo + 1.4, 0.7]);
        }
        n = null;
      };
      for (let t = 0; t < r; t++) {
        let r = this.heightAtCell(e, t);
        let a = this.heightAtCell(e + 1, t);
        if (r === a) {
          i();
          continue;
        }
        let o = Math.min(r, a);
        let s = Math.max(r, a);
        let c = r < a;
        if (n && n.lo === o && n.hi === s && n.lowLeft === c && n.j1 === t - 1) {
          n.j1 = t;
        } else {
          i();
          n = {
            lo: o,
            hi: s,
            lowLeft: c,
            j0: t,
            j1: t,
          };
        }
      }
      i();
    }
    for (let e = 0; e < r - 1; e++) {
      let r = null;
      let i = () => {
        if (!r) {
          return;
        }
        let n = WORLD_Z0 + (e + 1) * CELL;
        let i = WORLD_X0 + r.i0 * CELL;
        let s = WORLD_X0 + (r.i1 + 1) * CELL;
        if (r.lowTop) {
          t.quad([s, r.lo, n], [s, r.hi, n], [i, r.hi, n], [i, r.lo, n], a, o, [r.lo, r.lo + 1.4, 0.7]);
        } else {
          t.quad([i, r.lo, n], [i, r.hi, n], [s, r.hi, n], [s, r.lo, n], a, o, [r.lo, r.lo + 1.4, 0.7]);
        }
        r = null;
      };
      for (let t = 0; t < n; t++) {
        let n = this.heightAtCell(t, e);
        let a = this.heightAtCell(t, e + 1);
        if (n === a) {
          i();
          continue;
        }
        let o = Math.min(n, a);
        let s = Math.max(n, a);
        let c = n < a;
        if (r && r.lo === o && r.hi === s && r.lowTop === c && r.i1 === t - 1) {
          r.i1 = t;
        } else {
          i();
          r = {
            lo: o,
            hi: s,
            lowTop: c,
            i0: t,
            i1: t,
          };
        }
      }
      i();
    }
    this.addMesh(e, t.build(), this.gmat, {
      cast: false,
    });
    let s = new BrickBuilder();
    let c = [0.8, 0, 1];
    s.quad([-884, -0.02, -896], [-884, -0.02, 952], [WORLD_X0, -0.02, 952], [WORLD_X0, -0.02, -896], 10396584, c);
    s.quad([WORLD_X1, -0.02, -896], [WORLD_X1, -0.02, 952], [912, -0.02, 952], [912, -0.02, -896], 10396584, c);
    s.quad(
      [WORLD_X0, -0.02, -896],
      [WORLD_X0, -0.02, WORLD_Z0],
      [WORLD_X1, -0.02, WORLD_Z0],
      [WORLD_X1, -0.02, -896],
      10396584,
      c,
    );
    s.quad(
      [WORLD_X0, -0.02, WORLD_Z1],
      [WORLD_X0, -0.02, 952],
      [WORLD_X1, -0.02, 952],
      [WORLD_X1, -0.02, WORLD_Z1],
      10396584,
      c,
    );
    this.addMesh(e, s.build(), this.gmat, {
      cast: false,
    });
    this.collider({
      type: 'box',
      x: 14,
      y: -8,
      z: 28,
      hx: 238,
      hy: 2,
      hz: 264,
    });
    let l = new Uint8Array(n * r);
    for (let e = 0; e < r; e++) {
      for (let t = 0; t < n; t++) {
        let i = this.idx(t, e);
        if (l[i] || this.h[i] < 0) {
          continue;
        }
        let a = this.h[i];
        let o = 1;
        for (; t + o < n && !l[this.idx(t + o, e)] && this.h[this.idx(t + o, e)] === a; ) {
          o++;
        }
        let s = 1;
        outer2: for (; e + s < r; ) {
          for (let n = 0; n < o; n++) {
            let r = this.idx(t + n, e + s);
            if (l[r] || this.h[r] !== a) {
              break outer2;
            }
          }
          s++;
        }
        for (let n = 0; n < s; n++) {
          for (let r = 0; r < o; r++) {
            l[this.idx(t + r, e + n)] = 1;
          }
        }
        let c = WORLD_X0 + t * CELL;
        let u = WORLD_Z0 + e * CELL;
        let d = c + o * CELL;
        let f = u + s * CELL;
        let p = LEVEL_YS[a + 1];
        this.collider({
          type: 'box',
          x: (c + d) / 2,
          y: (p - 6) / 2,
          z: (u + f) / 2,
          hx: (d - c) / 2,
          hy: (p + 6) / 2,
          hz: (f - u) / 2,
        });
      }
    }
  }
  buildRoofs(e) {
    for (let t of ROOFS) {
      let [n, r, i, a] = t.rect;
      let o = new BrickBuilder();
      o.box((n + i) / 2, -1, (r + a) / 2, i - n, 2, a - r, WALL_COLOR, {
        bevel: 0.05,
        ao: false,
        top: PAINTS.pavement[0],
        r: 0.8,
        e: 1,
      });
      let s = groundMaterial();
      s.fade = null;
      let c = uniform(1);
      applyDitherFade(s, c);
      let l = this.addMesh(e, o.build(), s, {
        cast: true,
      });
      this.occluders.push({
        mesh: l,
        kind: 'roof',
        fade: c,
        cur: 1,
        box: new Box3(new Vector3(n, -6, r), new Vector3(i, 0, a)),
      });
      this.collider({
        type: 'box',
        x: (n + i) / 2,
        y: -1,
        z: (r + a) / 2,
        hx: (i - n) / 2,
        hy: 1,
        hz: (a - r) / 2,
      });
      let u = new BrickBuilder();
      let d = a - r;
      let f = a - r > i - n;
      let p = Math.floor((f ? d : i - n) / 8);
      for (let e = 0; e < p; e++) {
        let t = (e + 0.5) / p;
        if (f) {
          let e = r + t * (a - r);
          u.box(n + 0.25, -2.6, e, 0.3, 0.3, 2.4, 16773836, {
            e: 3,
            ao: false,
          });
          u.box(i - 0.25, -2.6, e, 0.3, 0.3, 2.4, 16773836, {
            e: 3,
            ao: false,
          });
        } else {
          let e = n + t * (i - n);
          u.box(e, -2.6, r + 0.25, 2.4, 0.3, 0.3, 16773836, {
            e: 3,
            ao: false,
          });
          u.box(e, -2.6, a - 0.25, 2.4, 0.3, 0.3, 16773836, {
            e: 3,
            ao: false,
          });
        }
      }
      this.addMesh(e, u.build(), this.kmat, {
        cast: false,
      });
    }
  }
  buildRamps(e) {
    for (let t of RAMPS) {
      let [n, r, i, a] = t.rect;
      let o = new BrickBuilder();
      if (t.stairs) {
        for (let e = 0; e < 16; e++) {
          let s = e / 16;
          let c = (e + 1) / 16;
          let l = t.y0 + (t.y1 - t.y0) * c;
          if (t.dir === 'x+') {
            n + (i - n) * s;
          } else {
            i - (i - n) * s;
          }
          let u = (i - n) / 16;
          let d = t.dir === 'x+' ? n + ((i - n) * (s + c)) / 2 : i - ((i - n) * (s + c)) / 2;
          o.box(d, (t.y0 + l) / 2 - 0.05, (r + a) / 2, u + 0.02, l - t.y0 + 0.1, a - r, e % 2 ? 11051670 : 10393740, {
            bevel: 0.04,
            studs: false,
            r: 0.8,
            e: 2,
          });
        }
        o.box((n + i) / 2, (t.y0 + t.y1) / 2 + 1, r + 0.15, i - n, 0.15, 0.15, 16761370, {
          e: 0,
          r: 0.4,
          m: 0.3,
        });
        o.box((n + i) / 2, (t.y0 + t.y1) / 2 + 1, a - 0.15, i - n, 0.15, 0.15, 16761370, {
          e: 0,
          r: 0.4,
          m: 0.3,
        });
      } else {
        o.wedge(n, r, i, a, t.y0 - 0.01, t.y0, t.y1, t.dir, t.color, {
          r: 0.85,
          top: t.color,
        });
      }
      this.addMesh(e, o.build(), this.gmat, {
        cast: false,
      });
      let s;
      let c = t.y0 - 0.2;
      s =
        t.dir === 'x+'
          ? [n, c, r, n, c, a, i, c, r, i, c, a, i, t.y1, r, i, t.y1, a, n, t.y0, r, n, t.y0, a]
          : [n, c, r, n, c, a, i, c, r, i, c, a, n, t.y1, r, n, t.y1, a, i, t.y0, r, i, t.y0, a];
      this.collider({
        type: 'hull',
        pts: s,
      });
    }
  }
  buildMarkings(e) {
    let t = new BrickBuilder();
    let n = [0.55, 0, 0];
    let r = (e, t, n) =>
      ROADS.some((r) => r !== n && e > r.rect[0] - 1 && e < r.rect[2] + 1 && t > r.rect[1] - 1 && t < r.rect[3] + 1);
    let i = 0.03;
    for (let e of ROADS) {
      let [a, o, s, c] = e.rect;
      if (e.dir === 'ns') {
        let l = (a + s) / 2;
        for (let a = o + 2; a < c - 2; a += 6) {
          if (
            !(r(l, a, e) || r(l, a + 3, e)) &&
            (e.center === 'yellow'
              ? (t.quad(
                  [l - 0.35, i, a],
                  [l - 0.35, i, a + 3.5],
                  [l - 0.15, i, a + 3.5],
                  [l - 0.15, i, a],
                  15909403,
                  n,
                ),
                t.quad([l + 0.15, i, a], [l + 0.15, i, a + 3.5], [l + 0.35, i, a + 3.5], [l + 0.35, i, a], 15909403, n))
              : t.quad([l - 0.12, i, a], [l - 0.12, i, a + 3], [l + 0.12, i, a + 3], [l + 0.12, i, a], 16053488, n),
            e.lanes === 4)
          ) {
            for (let e of [-4, 4]) {
              t.quad(
                [l + e - 0.12, i, a],
                [l + e - 0.12, i, a + 3],
                [l + e + 0.12, i, a + 3],
                [l + e + 0.12, i, a],
                16053488,
                n,
              );
            }
          }
        }
      } else {
        let l = (o + c) / 2;
        for (let o = a + 2; o < s - 2; o += 6) {
          if (
            !(r(o, l, e) || r(o + 3, l, e)) &&
            (e.center === 'yellow'
              ? (t.quad(
                  [o, i, l - 0.35],
                  [o, i, l - 0.15],
                  [o + 3.5, i, l - 0.15],
                  [o + 3.5, i, l - 0.35],
                  15909403,
                  n,
                ),
                t.quad([o, i, l + 0.15], [o, i, l + 0.35], [o + 3.5, i, l + 0.35], [o + 3.5, i, l + 0.15], 15909403, n))
              : t.quad([o, i, l - 0.12], [o, i, l + 0.12], [o + 3, i, l + 0.12], [o + 3, i, l - 0.12], 16053488, n),
            e.lanes === 4)
          ) {
            for (let e of [-4, 4]) {
              t.quad(
                [o, i, l + e - 0.12],
                [o, i, l + e + 0.12],
                [o + 3, i, l + e + 0.12],
                [o + 3, i, l + e - 0.12],
                16053488,
                n,
              );
            }
          }
        }
      }
    }
    let a = (e, r, a, o) => {
      for (let s = -o / 2; s < o / 2; s += 1.6) {
        if (a) {
          t.quad(
            [e + s, i, r - 1.6],
            [e + s, i, r + 1.6],
            [e + s + 0.8, i, r + 1.6],
            [e + s + 0.8, i, r - 1.6],
            16053488,
            n,
          );
        } else {
          t.quad(
            [e - 1.6, i, r + s],
            [e - 1.6, i, r + s + 0.8],
            [e + 1.6, i, r + s + 0.8],
            [e + 1.6, i, r + s],
            16053488,
            n,
          );
        }
      }
    };
    a(0, 192.5, true, 15);
    a(0, 175.5, true, 15);
    a(0, 68.5, true, 15);
    a(0, 53.5, true, 15);
    a(-83, 184, false, 11);
    a(-65, 184, false, 11);
    a(155, -58, false, 15);
    a(137, -58, false, 15);
    for (let e = -73; e < -43; e += 3) {
      t.quad([196, i, e], [196, i, e + 1.5], [211, i, e + 1.5], [211, i, e], 1842210, n);
    }
    let o = brickMaterial();
    o.polygonOffset = true;
    o.polygonOffsetFactor = -2;
    o.polygonOffsetUnits = -2;
    this.addMesh(e, t.build(), o, {
      cast: false,
    });
  }
  buildRails(e) {
    let t = TRAIN;
    let n = new BrickBuilder();
    let r = t.y;
    for (let e = t.z1 - 1; e < t.z0 + 2; e += 1.6) {
      n.box(t.x, r + 0.08, e, 3.2, 0.16, 0.5, 7032629, {
        bevel: 0.03,
        r: 0.9,
        ao: false,
      });
    }
    for (let e of [-0.8, 0.8]) {
      n.box(t.x + e, r + 0.28, (t.z0 + t.z1) / 2 + 1, 0.18, 0.24, t.z0 - t.z1 + 4, 10133672, {
        bevel: 0.03,
        r: 0.3,
        m: 0.9,
        ao: false,
      });
    }
    for (let [e, i] of [
      [t.z0 + 3, 1],
      [t.z1 - 2.5, -1],
    ]) {
      n.box(t.x, r + 0.9, e, 3.4, 1.8, 1.2, 14168619, {
        bevel: 0.1,
      });
      n.box(t.x, r + 1.9, e, 3.6, 0.3, 1.4, 16761370, {
        bevel: 0.05,
      });
    }
    for (let e of t.stations) {
      for (let i of [t.x - 2.3, t.x + 2.3]) {
        n.box(i, r + 0.02, e.z, 0.3, 0.04, 24, 16761370, {
          bevel: 0.01,
          ao: false,
          e: 0.2,
        });
      }
      for (let t of [-125.6, -110.4]) {
        n.box(t, r + 3.2, e.z, 0.3, 1.4, 6, 2052008, {
          bevel: 0.06,
        });
        n.box(t + (t < -118 ? 0.18 : -0.18), r + 3.2, e.z, 0.1, 0.9, 5.2, 15921902, {
          bevel: 0.02,
          e: 0.6,
        });
      }
      for (let t of [e.z - 6, e.z + 6]) {
        n.box(-112.4, r + 0.5, t, 1.2, 0.3, 3.2, 3108822, {
          bevel: 0.05,
        });
        n.box(-112.4, r + 0.2, t, 0.8, 0.4, 2.6, 4473924, {
          bevel: 0.05,
        });
      }
    }
    this.addMesh(e, n.build(), this.kmat, {
      cast: true,
    });
  }
  buildMaze(e) {
    let t = MAZE;
    let { hW: n, vW: r } = this.maze;
    let i = new BrickBuilder();
    let a = t.h;
    let o = t.wall;
    let s = [9076595, 8221544, 9800316];
    let c = (e) => ({
      bevel: 0.12,
      r: 0.85,
      e: 1,
      studs: false,
      top: 7180106,
    });
    for (let e = 0; e <= t.rows; e++) {
      for (let r = 0; r < t.cols; r++) {
        if (!n[e][r] || e === 0 || e === t.rows) {
          continue;
        }
        let l = t.x0 + (r + 0.5) * t.cell;
        let u = t.z0 + e * t.cell;
        i.box(l, -6 + a / 2, u, t.cell + o, a, o, s[(e + r) % 3], c());
        this.collider({
          type: 'box',
          x: l,
          y: -6 + a / 2,
          z: u,
          hx: (t.cell + o) / 2,
          hy: a / 2,
          hz: o / 2,
        });
      }
    }
    for (let e = 0; e < t.rows; e++) {
      for (let n = 0; n <= t.cols; n++) {
        if (!r[e][n] || n === 0 || n === t.cols) {
          continue;
        }
        let l = t.x0 + n * t.cell;
        let u = t.z0 + (e + 0.5) * t.cell;
        i.box(l, -6 + a / 2, u, o, a, t.cell + o, s[(e * 2 + n) % 3], c());
        this.collider({
          type: 'box',
          x: l,
          y: -6 + a / 2,
          z: u,
          hx: o / 2,
          hy: a / 2,
          hz: (t.cell + o) / 2,
        });
      }
    }
    let l = seededRandom(77);
    for (let e = 0; e < 26; e++) {
      let n = t.x0 + 1 + l() * (t.cols * t.cell - 2);
      let r = t.z0 + 1 + l() * (t.rows * t.cell - 2);
      Math.floor((n - t.x0) / t.cell);
      Math.floor((r - t.z0) / t.cell);
      let a = (n - t.x0) % t.cell;
      let o = (r - t.z0) % t.cell;
      if (a > 2.2 && a < 7.8 && o > 2.2 && o < 7.8) {
        continue;
      }
      let c = 0.8 + l() * 0.8;
      i.box(n, -6 + c / 2, r, c * 1.4, c, c, s[e % 3], {
        bevel: 0.15,
        r: 0.9,
        e: 1,
      });
    }
    this.addMesh(e, i.build(), this.gmat, {
      cast: true,
    });
  }
  buildFences(e) {
    let t = [];
    let n = (e, t) => NO_FENCE.some(([n, r, i, a]) => e >= n && e <= i && t >= r && t <= a);
    let r = (e, t) =>
      this.heightAtCell(e, t) < 0 && !(e >= 0 && t >= 0 && e < this.nx && t < this.nz && this.roof[this.idx(e, t)]);
    let i = (e, t) =>
      this.heightAtCell(e, t) === 0 &&
      !(e >= 0 && t >= 0 && e < this.nx && t < this.nz && this.roof[this.idx(e, t)] && 0);
    for (let e = 0; e < this.nx - 1; e++) {
      let a = null;
      for (let o = 0; o <= this.nz; o++) {
        let s = WORLD_X0 + (e + 1) * CELL;
        let c = WORLD_Z0 + (o + 0.5) * CELL;
        if (o < this.nz && ((i(e, o) && r(e + 1, o)) || (r(e, o) && i(e + 1, o))) && !n(s, c)) {
          if (a) {
            a.z1 = WORLD_Z0 + (o + 1) * CELL;
          } else {
            a = {
              x: s,
              z0: WORLD_Z0 + o * CELL,
              z1: WORLD_Z0 + (o + 1) * CELL,
              side: i(e, o) ? -1 : 1,
            };
          }
        } else {
          a &&= (t.push([a.x + a.side * 0.35, a.z0, a.x + a.side * 0.35, a.z1]), null);
        }
      }
    }
    for (let e = 0; e < this.nz - 1; e++) {
      let a = null;
      for (let o = 0; o <= this.nx; o++) {
        let s = WORLD_Z0 + (e + 1) * CELL;
        let c = WORLD_X0 + (o + 0.5) * CELL;
        if (o < this.nx && ((i(o, e) && r(o, e + 1)) || (r(o, e) && i(o, e + 1))) && !n(c, s)) {
          if (a) {
            a.x1 = WORLD_X0 + (o + 1) * CELL;
          } else {
            a = {
              z: s,
              x0: WORLD_X0 + o * CELL,
              x1: WORLD_X0 + (o + 1) * CELL,
              side: i(o, e) ? -1 : 1,
            };
          }
        } else {
          a &&= (t.push([a.x0, a.z + a.side * 0.35, a.x1, a.z + a.side * 0.35]), null);
        }
      }
    }
    let a = new BrickBuilder();
    let o = (e, t, n, r, i, o = 0, s = false) => {
      let c = Math.hypot(n - e, r - t);
      let l = Math.max(1, Math.round(c / 2.5));
      let u = Math.atan2(-(r - t), n - e);
      for (let c = 0; c <= l; c++) {
        let u = c / l;
        let d = e + (n - e) * u;
        let f = t + (r - t) * u;
        a.box(d, o + i / 2, f, 0.3, i, 0.3, s ? 5595243 : 16761370, {
          bevel: 0.05,
          r: 0.5,
          m: s ? 0.7 : 0.1,
        });
      }
      a.pushT((e + n) / 2, o, (t + r) / 2, u);
      let d = s ? [1.2, 2.6, 4, 5.4, i - 0.1] : [0.8, i - 0.1];
      for (let e of d) {
        a.box(0, e, 0, c, 0.14, 0.14, s ? 7831948 : 14168619, {
          bevel: 0.03,
          r: 0.4,
          m: s ? 0.8 : 0.1,
          ao: false,
        });
      }
      if (s) {
        for (let e = -c / 2 + 0.6; e < c / 2; e += 0.6) {
          a.box(e, i / 2, 0, 0.07, i - 0.2, 0.07, 9279394, {
            bevel: 0,
            r: 0.4,
            m: 0.9,
            ao: false,
          });
        }
      }
      a.pop();
      this.collider({
        type: 'box',
        x: (e + n) / 2,
        y: o + i / 2 + 0.5,
        z: (t + r) / 2,
        hx: c / 2 + 0.15,
        hy: i / 2 + 0.5,
        hz: 0.5,
        yaw: u,
        groups: COLLIDE.fence,
      });
    };
    for (let e of t) {
      o(e[0], e[1], e[2], e[3], 2);
    }
    for (let e of TALL_FENCES) {
      for (let t = 0; t < e.pts.length - 1; t++) {
        o(e.pts[t][0], e.pts[t][1], e.pts[t + 1][0], e.pts[t + 1][1], e.h, 0, true);
      }
    }
    let s = (e, t) => {
      a.cyl(e, 0.7, t, 0.28, 1.4, 3816772, {
        seg: 8,
        r: 0.5,
        m: 0.3,
      });
      a.cyl(e, 1.1, t, 0.3, 0.2, 16761370, {
        seg: 8,
        r: 0.4,
        noBottom: true,
      });
      this.collider({
        type: 'box',
        x: e,
        y: 1,
        z: t,
        hx: 0.3,
        hy: 1,
        hz: 0.3,
      });
    };
    for (let e of BOLLARD_LINES) {
      for (let t = 0; t < e.n; t++) {
        let n = e.n > 1 ? t / (e.n - 1) : 0;
        s(e.x0 + (e.x1 - e.x0) * n, e.z0 + (e.z1 - e.z0) * n);
      }
    }
    for (let e of BOLLARD_RINGS) {
      for (let t = 0; t < e.n; t++) {
        let n = (t / e.n) * Math.PI * 2;
        s(e.x + Math.cos(n) * e.r, e.z + Math.sin(n) * e.r);
      }
    }
    this.fenceSegs = t;
    this.addMesh(e, a.build(), this.kmat, {
      cast: true,
    });
  }
  buildTowers(e) {
    let t = seededRandom(99);
    let n = [
      {
        a: 13225686,
        b: 10134446,
        glass: 2046814,
        trim: 16761370,
      },
      {
        a: 14672872,
        b: 11779271,
        glass: 2377326,
        trim: 14168619,
      },
      {
        a: 11449791,
        b: 8358036,
        glass: 1716045,
        trim: 3108822,
      },
      {
        a: 15262940,
        b: 12893616,
        glass: 2771562,
        trim: 15921902,
      },
    ];
    this.towerLights = new BrickBuilder();
    for (let r of TOWERS) {
      let i = n[r.v % n.length];
      let a = new BrickBuilder();
      a.box(r.x, 1, r.z, r.w + 4, 2, r.d + 4, 9341829, {
        bevel: 0.15,
        r: 0.8,
        studs: false,
      });
      let o = 2;
      let s = r.w;
      let c = r.d;
      let l = 2 + Math.floor(t() * 2);
      let u = (r.h - 4) / l;
      for (let e = 0; e < l; e++) {
        let e = Math.max(2, Math.floor(u / 3.6));
        let n = u / e;
        for (let t = 0; t < e; t++) {
          let e = o + t * n;
          a.box(r.x, e + n * 0.2, r.z, s, n * 0.4, c, i.a, {
            bevel: 0.08,
            r: 0.28,
            m: 0.85,
            ao: false,
          });
          a.box(r.x, e + n * 0.7, r.z, s - 0.5, n * 0.6, c - 0.5, i.glass, {
            bevel: 0.04,
            r: 0.06,
            m: 0.4,
            ao: false,
          });
        }
        let l = Math.max(2, Math.round(s / 4));
        for (let e = 0; e <= l; e++) {
          let t = r.x - s / 2 + (e / l) * s;
          a.box(t, o + u / 2, r.z - c / 2 - 0.1, 0.35, u, 0.4, i.b, {
            bevel: 0.05,
            r: 0.3,
            m: 0.9,
            ao: false,
          });
          a.box(t, o + u / 2, r.z + c / 2 + 0.1, 0.35, u, 0.4, i.b, {
            bevel: 0.05,
            r: 0.3,
            m: 0.9,
            ao: false,
          });
        }
        o += u;
        a.box(r.x, o + 0.4, r.z, s + 0.6, 0.8, c + 0.6, i.trim, {
          bevel: 0.1,
          r: 0.4,
          m: 0.2,
        });
        o += 0.8;
        s = Math.max(8, s - 4 - Math.floor(t() * 3) * 2);
        c = Math.max(8, c - 4 - Math.floor(t() * 3) * 2);
      }
      a.box(r.x, o + 1.5, r.z, s * 0.5, 3, c * 0.5, i.b, {
        bevel: 0.1,
        r: 0.5,
        m: 0.5,
        studs: true,
      });
      a.cyl(r.x, o + 3 + 4, r.z, 0.25, 8, 10133672, {
        seg: 6,
        r: 0.3,
        m: 0.9,
      });
      this.towerLights.box(r.x, o + 11.2, r.z, 0.8, 0.8, 0.8, 16722458, {
        e: 1,
        ao: false,
      });
      let d = brickMaterial({
        fade: true,
      });
      let f = this.addMesh(e, a.build(), d, {
        cast: true,
      });
      this.occluders.push({
        mesh: f,
        kind: 'tower',
        fade: d.fade,
        cur: 1,
        box: new Box3(
          new Vector3(r.x - r.w / 2 - 2, 0, r.z - r.d / 2 - 2),
          new Vector3(r.x + r.w / 2 + 2, r.h + 12, r.z + r.d / 2 + 2),
        ),
      });
      this.collider({
        type: 'box',
        x: r.x,
        y: r.h / 2,
        z: r.z,
        hx: r.w / 2 + 2,
        hy: r.h / 2,
        hz: r.d / 2 + 2,
      });
    }
    this.blinkMat = glowMaterial(6);
    this.glowMats.push(this.blinkMat);
    this.addMesh(e, this.towerLights.build(), this.blinkMat, {
      cast: false,
    });
  }
  buildDressing(e) {
    let t = new BrickBuilder();
    t.box(-11, 5, 250, 2, 10, 2, 5595243, {
      bevel: 0.1,
      m: 0.7,
      r: 0.4,
    });
    t.box(11, 5, 250, 2, 10, 2, 5595243, {
      bevel: 0.1,
      m: 0.7,
      r: 0.4,
    });
    t.box(0, 10.5, 250, 24, 1.6, 2.2, 16761370, {
      bevel: 0.1,
    });
    for (let e = -11; e < 12; e += 2) {
      t.box(e, 10.5, 251.15, 1, 1.6, 0.1, 1842210, {
        bevel: 0.02,
        ao: false,
      });
    }
    let n = DECON;
    for (let e of [-15, 15]) {
      for (let r of [-8, 8]) {
        t.box(n.x + r, 6, n.z + e, 1.4, 12, 1.4, 5595243, {
          bevel: 0.1,
          m: 0.7,
          r: 0.4,
        });
      }
    }
    t.box(n.x, 12.6, n.z, 18, 1.2, 32, 14724383, {
      bevel: 0.15,
      studs: 2,
    });
    t.box(n.x, 13.8, n.z, 12, 1.2, 24, 15921902, {
      bevel: 0.15,
      studs: 2,
    });
    let r = SECRET;
    for (let e = 0; e < 16; e++) {
      let n = (e / 16) * Math.PI * 2;
      t.pushT(r.x + Math.cos(n) * 5, 0, r.z + Math.sin(n) * 5, -n);
      t.box(0, 0.5, 0, 1, 1, 2.2, 15262940, {
        bevel: 0.08,
        studs: true,
      });
      t.pop();
    }
    t.cyl(r.x, 0.25, r.z, 4.6, 0.5, 2981828, {
      seg: 16,
      r: 0.05,
      m: 0.2,
      ao: false,
    });
    t.cyl(r.x, 0.8, r.z, 1.2, 1.6, 15262940, {
      seg: 10,
      r: 0.5,
    });
    t.box(-107.6, 0, 45, 0.5, 1.2, 7, 2052008, {
      bevel: 0.05,
    });
    t.box(-107.3, 0, 45, 0.1, 0.7, 6, 15921902, {
      bevel: 0.02,
      e: 0.5,
    });
    for (let [e, n, r, i] of [
      [-60, -150, -20, -149],
      [-60, -111, -20, -110],
      [-60, -150, -59, -110],
      [-21, -150, -20, -110],
    ]) {
      t.box((e + r) / 2, 8.5, (n + i) / 2, r - e, 1, i - n, 14078407, {
        bevel: 0.08,
        studs: true,
      });
    }
    for (let [e, n] of [
      [-56, -114],
      [-24, -114],
      [-56, -146],
      [-40, -146],
    ]) {
      t.box(e, 8.6, n, 3, 1.2, 3, 9268810, {
        bevel: 0.1,
      });
      t.box(e, 9.8, n, 2.4, 1.6, 2.4, 5151290, {
        bevel: 0.3,
      });
    }
    t.box(186, -5.95, 164, 12, 0.08, 12, 16761370, {
      bevel: 0,
      ao: false,
    });
    t.box(186, -5.9, 164, 10, 0.08, 10, 3816772, {
      bevel: 0,
      ao: false,
    });
    for (let [e, n] of [
      [172, 144],
      [200, 144],
      [172, 174],
      [200, 174],
    ]) {
      t.box(e, -5, n, 2.2, 2, 2.2, 7043642, {
        bevel: 0.1,
        studs: true,
      });
      t.box(e, -3.5, n, 2.2, 1, 2.2, 7043642, {
        bevel: 0.1,
        studs: true,
      });
    }
    for (let [e, n] of [
      [192, 82],
      [170, 118],
      [194, 118],
    ]) {
      t.cyl(e, -5, n, 1, 2, 3108822, {
        seg: 10,
        r: 0.4,
        m: 0.3,
      });
    }
    for (let [e, n] of [
      [-106, 32],
      [-104, 32],
      [-106, 34.2],
    ]) {
      t.box(e, -5, n, 2, 2, 2, 9268810, {
        bevel: 0.1,
        studs: true,
      });
    }
    t.box(-40, 1.5, 192.8, 30, 3, 1, 1842210, {
      bevel: 0.08,
      studs: true,
    });
    for (let e = -54; e < -26; e += 4) {
      t.box(e + 1, 1.5, 192.2, 2, 2.4, 0.2, 16761370, {
        bevel: 0.03,
        ao: false,
      });
    }
    this.addMesh(e, t.build(), this.kmat, {
      cast: true,
    });
    for (let e of [-15, 15]) {
      for (let t of [-8, 8]) {
        this.collider({
          type: 'box',
          x: n.x + t,
          y: 6,
          z: n.z + e,
          hx: 0.7,
          hy: 6,
          hz: 0.7,
        });
      }
    }
    this.collider({
      type: 'box',
      x: -11,
      y: 5,
      z: 250,
      hx: 1,
      hy: 5,
      hz: 1,
    });
    this.collider({
      type: 'box',
      x: 11,
      y: 5,
      z: 250,
      hx: 1,
      hy: 5,
      hz: 1,
    });
    this.collider({
      type: 'box',
      x: -40,
      y: 1.5,
      z: 192.8,
      hx: 15,
      hy: 1.5,
      hz: 0.5,
    });
    for (let [e, t, n, r] of [
      [-60, -150, -20, -149],
      [-60, -111, -20, -110],
      [-60, -150, -59, -110],
      [-21, -150, -20, -110],
    ]) {
      this.collider({
        type: 'box',
        x: (e + n) / 2,
        y: 8.5,
        z: (t + r) / 2,
        hx: (n - e) / 2,
        hy: 0.5,
        hz: (r - t) / 2,
      });
    }
    this.collider({
      type: 'box',
      x: SECRET.x,
      y: 0.5,
      z: SECRET.z,
      hx: 4.6,
      hy: 0.5,
      hz: 4.6,
    });
    for (let [e, t] of [
      [172, 144],
      [200, 144],
      [172, 174],
      [200, 174],
    ]) {
      this.collider({
        type: 'box',
        x: e,
        y: -4.5,
        z: t,
        hx: 1.1,
        hy: 1.5,
        hz: 1.1,
      });
    }
    for (let [e, t] of [
      [-106, 32],
      [-104, 32],
      [-106, 34.2],
    ]) {
      this.collider({
        type: 'box',
        x: e,
        y: -5,
        z: t,
        hx: 1,
        hy: 1,
        hz: 1,
      });
    }
  }
  buildBoundary(e) {
    let t = new BrickBuilder();
    let n = (e, n, r, i) => {
      let a = (e + r) / 2;
      let o = (n + i) / 2;
      let s = Math.max(1, r - e);
      let c = Math.max(1, i - n);
      t.box(a, 1.2, o, s, 2.4, c, 9341829, {
        bevel: 0.1,
        studs: true,
        top: 11117980,
      });
      this.collider({
        type: 'box',
        x: a,
        y: 20,
        z: o,
        hx: s / 2,
        hy: 20,
        hz: c / 2,
      });
    };
    n(WORLD_X0, 251, -12, WORLD_Z1);
    n(12, 251, WORLD_X1, WORLD_Z1);
    n(WORLD_X0, WORLD_Z0, WORLD_X1, -195);
    n(WORLD_X0, WORLD_Z0, -183, WORLD_Z1);
    n(211, WORLD_Z0, WORLD_X1, -74);
    n(211, -42, WORLD_X1, WORLD_Z1);
    this.collider({
      type: 'box',
      x: 0,
      y: 20,
      z: 282,
      hx: 30,
      hy: 20,
      hz: 1,
    });
    this.collider({
      type: 'box',
      x: 237,
      y: 20,
      z: -58,
      hx: 1,
      hy: 20,
      hz: 30,
    });
    this.addMesh(e, t.build(), this.gmat, {
      cast: false,
    });
    let r = new BrickBuilder();
    let i = seededRandom(5);
    for (let e = 0; e < 46; e++) {
      let t = (e / 46) * Math.PI * 2;
      let n = 380 + i() * 160;
      let a = 14 + Math.cos(t) * n;
      let o = 28 + Math.sin(t) * n;
      let s = 20 + i() * 30;
      let c = 20 + i() * 30;
      let l = 30 + i() * 90;
      r.box(a, l / 2, o, s, l, c, i() > 0.5 ? 12107978 : 10134704, {
        bevel: 0.3,
        r: 0.35,
        m: 0.6,
        ao: false,
      });
      r.box(a, l + 1, o, s * 0.6, 2, c * 0.6, 9081502, {
        bevel: 0.2,
        r: 0.5,
        m: 0.4,
        ao: false,
      });
    }
    this.addMesh(e, r.build(), this.kmat, {
      cast: false,
      receive: false,
    });
  }
  createColliders(e) {
    for (let t of this.colliderSpecs) {
      if (t.type === 'box') {
        e.fixedBox(t.x, t.y, t.z, t.hx, t.hy, t.hz, {
          yaw: t.yaw,
          groups: t.groups,
        });
      } else {
        if (t.type === 'hull') {
          e.fixedHull(t.pts);
        }
      }
    }
  }
}
const B_FREE = 0;
const B_ATTACHED = 1;
const B_BODY = 2;
const B_FLYING = 3;
const B_RESTING = 4;
const B_FADING = 5;
const B_DELAYED = 6;
const _bM4 = new Matrix4();
const _bV3 = new Vector3();
const _bQ1 = new Quaternion();
const _bQ2 = new Quaternion();
const _bV3b = new Vector3();
const _bColor = new Color();
class BrickPool {
  constructor(e, t, n, r, i, a) {
    this.name = e;
    this.cap = n;
    this.half = r;
    this.ipbr = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.mesh = new InstancedMesh(t, instancedBrickMaterial(this.ipbr), n);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.setColorAt(0, _bColor.set(16777215));
    this.mesh.count = n;
    i.add(this.mesh);
    let o = (e = 1) => new Float32Array(n * e);
    this.pos = o(3);
    this.quat = o(4);
    this.ppos = o(3);
    this.pquat = o(4);
    this.scale = o(1).fill(1);
    this.vel = o(3);
    this.ang = o(3);
    this.life = o(1);
    this.delay = o(1);
    this.state = new Uint8Array(n);
    this.owner = new Int16Array(n).fill(-1);
    this.bodies = Array(n).fill(null);
    this.used = 0;
    this.free = [];
    this.moving = new Set();
    this.dirty = true;
    this.pbrDirty = true;
    for (let e = 0; e < n; e++) {
      this.quat[e * 4 + 3] = 1;
      this.pquat[e * 4 + 3] = 1;
      this._writeHidden(e);
    }
  }
  _writeHidden(e) {
    _bM4.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(e, _bM4);
  }
  write(e, t = 1) {
    let n = this.pos;
    let r = this.quat;
    let i = this.scale[e];
    if (t < 1 && this.state[e] !== B_ATTACHED) {
      let i = this.ppos;
      let a = this.pquat;
      _bV3.set(
        i[e * 3] + (n[e * 3] - i[e * 3]) * t,
        i[e * 3 + 1] + (n[e * 3 + 1] - i[e * 3 + 1]) * t,
        i[e * 3 + 2] + (n[e * 3 + 2] - i[e * 3 + 2]) * t,
      );
      _bQ1.set(a[e * 4], a[e * 4 + 1], a[e * 4 + 2], a[e * 4 + 3]);
      _bQ2.set(r[e * 4], r[e * 4 + 1], r[e * 4 + 2], r[e * 4 + 3]);
      _bQ1.slerp(_bQ2, t);
    } else {
      _bV3.set(n[e * 3], n[e * 3 + 1], n[e * 3 + 2]);
      _bQ1.set(r[e * 4], r[e * 4 + 1], r[e * 4 + 2], r[e * 4 + 3]);
    }
    _bV3b.set(i, i, i);
    _bM4.compose(_bV3, _bQ1, _bV3b);
    this.mesh.setMatrixAt(e, _bM4);
  }
  alloc() {
    return this.free.length ? this.free.pop() : this.used < this.cap ? this.used++ : -1;
  }
}
class Bricks {
  constructor(e, t, n, r) {
    this.game = e;
    this.pools = {
      brick: new BrickPool('brick', brickGeometry(), n, [1, 0.6, 0.5], t),
      plate: new BrickPool('plate', plateGeometry(), r, [1, 0.2, 1], t),
    };
    this.physCount = 0;
    this.physQueue = [];
    this.pending = [];
  }
  get maxBodies() {
    return this.game.quality.maxDebrisBodies;
  }
  addStatic(e, t, n, r, i, a, o = 0.42, s = 0, c = -1) {
    let l = this.pools[e];
    let u = l.alloc();
    return u < 0
      ? -1
      : ((l.pos[u * 3] = t),
        (l.pos[u * 3 + 1] = n),
        (l.pos[u * 3 + 2] = r),
        (l.quat[u * 4] = 0),
        (l.quat[u * 4 + 1] = Math.sin(i / 2)),
        (l.quat[u * 4 + 2] = 0),
        (l.quat[u * 4 + 3] = Math.cos(i / 2)),
        l.ppos.set(l.pos.subarray(u * 3, u * 3 + 3), u * 3),
        l.pquat.set(l.quat.subarray(u * 4, u * 4 + 4), u * 4),
        (l.scale[u] = 1),
        (l.state[u] = B_ATTACHED),
        (l.owner[u] = c),
        l.mesh.setColorAt(u, _bColor.set(a)),
        (l.ipbr.array[u * 3] = o),
        (l.ipbr.array[u * 3 + 1] = s),
        (l.ipbr.array[u * 3 + 2] = 1),
        l.write(u),
        (l.dirty = true),
        (l.pbrDirty = true),
        (l.colorDirty = true),
        u);
  }
  sealStatic() {
    for (let e in this.pools) {
      let t = this.pools[e];
      t.staticEnd = t.used;
    }
  }
  setFade(e, t, n) {
    let r = this.pools[e];
    for (let e of t) {
      if (r.state[e] === B_ATTACHED) {
        r.ipbr.array[e * 3 + 2] = n;
      }
    }
    r.pbrDirty = true;
  }
  _makeBody(e, t) {
    let n = this.game.physics;
    let r = n.R;
    let i = e.scale[t];
    let a = r.RigidBodyDesc.dynamic()
      .setTranslation(e.pos[t * 3], e.pos[t * 3 + 1], e.pos[t * 3 + 2])
      .setRotation({
        x: e.quat[t * 4],
        y: e.quat[t * 4 + 1],
        z: e.quat[t * 4 + 2],
        w: e.quat[t * 4 + 3],
      })
      .setLinvel(e.vel[t * 3], e.vel[t * 3 + 1], e.vel[t * 3 + 2])
      .setAngvel({
        x: e.ang[t * 3],
        y: e.ang[t * 3 + 1],
        z: e.ang[t * 3 + 2],
      })
      .setLinearDamping(0.15)
      .setAngularDamping(0.4)
      .setCanSleep(true);
    let o = n.world.createRigidBody(a);
    let s = r.ColliderDesc.cuboid(e.half[0] * i, e.half[1] * i, e.half[2] * i)
      .setDensity(0.3)
      .setFriction(0.85)
      .setRestitution(0.12)
      .setCollisionGroups(COLLIDE.debris);
    n.world.createCollider(s, o);
    e.bodies[t] = o;
    this.physCount++;
    this.physQueue.push([e, t]);
  }
  _removeBody(e, t) {
    let n = e.bodies[t];
    if (n) {
      this.game.physics.world.removeRigidBody(n);
      e.bodies[t] = null;
      this.physCount--;
    }
  }
  launch(e, t, n, r, i, a = true, o = 0) {
    let s = this.pools[e];
    if (!(t < 0 || (s.state[t] !== B_ATTACHED && s.state[t] !== B_DELAYED))) {
      s.vel[t * 3] = n;
      s.vel[t * 3 + 1] = r;
      s.vel[t * 3 + 2] = i;
      s.ang[t * 3] = (Math.random() - 0.5) * 8;
      s.ang[t * 3 + 1] = (Math.random() - 0.5) * 8;
      s.ang[t * 3 + 2] = (Math.random() - 0.5) * 8;
      s.ipbr.array[t * 3 + 2] = 1;
      s.pbrDirty = true;
      if (o > 0) {
        s.state[t] = B_DELAYED;
        s.delay[t] = o;
        this.pending.push([s, t, a]);
        return;
      }
      this._start(s, t, a);
    }
  }
  _start(e, t, n) {
    e.ppos.set(e.pos.subarray(t * 3, t * 3 + 3), t * 3);
    e.pquat.set(e.quat.subarray(t * 4, t * 4 + 4), t * 4);
    if (n && (this.physCount >= this.maxBodies && this._recycleOldest(), this.physCount < this.maxBodies)) {
      this._makeBody(e, t);
      e.state[t] = B_BODY;
      e.life[t] = this.game.quality.debrisLife * (0.8 + Math.random() * 0.4);
      e.moving.add(t);
      return;
    }
    e.state[t] = B_FLYING;
    e.life[t] = 2.5 + Math.random() * 2.5;
    e.moving.add(t);
  }
  _recycleOldest() {
    for (; this.physQueue.length; ) {
      let [e, t] = this.physQueue.shift();
      if (e.bodies[t]) {
        this._removeBody(e, t);
        e.state[t] = B_FADING;
        e.life[t] = 1.2;
        return;
      }
    }
  }
  spawn(e, t, n, r, i, a, o, s, c = 0.5, l = false, u = 0.45, d = 0) {
    let f = this.pools[e];
    let p = f.free.length ? f.free.pop() : f.used < f.cap ? f.used++ : -1;
    if (p < 0) {
      return -1;
    }
    f.pos[p * 3] = t;
    f.pos[p * 3 + 1] = n;
    f.pos[p * 3 + 2] = r;
    let m = Math.random() * Math.PI * 2;
    f.quat[p * 4] = 0;
    f.quat[p * 4 + 1] = Math.sin(m / 2);
    f.quat[p * 4 + 2] = 0;
    f.quat[p * 4 + 3] = Math.cos(m / 2);
    f.scale[p] = c;
    f.owner[p] = -2;
    f.mesh.setColorAt(p, _bColor.set(i));
    f.colorDirty = true;
    f.ipbr.array[p * 3] = u;
    f.ipbr.array[p * 3 + 1] = d;
    f.ipbr.array[p * 3 + 2] = 1;
    f.pbrDirty = true;
    f.state[p] = B_ATTACHED;
    this.launch(e, p, a, o, s, l);
    return p;
  }
  fixedUpdate(e) {
    let t = this.game.world;
    if (this.pending.length) {
      let t = [];
      for (let n of this.pending) {
        let [r, i, a] = n;
        if (r.state[i] === B_DELAYED) {
          r.delay[i] -= e;
          if (r.delay[i] <= 0) {
            this._start(r, i, a);
          } else {
            t.push(n);
          }
        }
      }
      this.pending = t;
    }
    for (let n in this.pools) {
      let r = this.pools[n];
      if (!r.moving.size) {
        continue;
      }
      r.dirty = true;
      let i = [];
      for (let n of r.moving) {
        let a = r.state[n];
        let o = n * 3;
        let s = n * 4;
        r.ppos[o] = r.pos[o];
        r.ppos[o + 1] = r.pos[o + 1];
        r.ppos[o + 2] = r.pos[o + 2];
        r.pquat[s] = r.quat[s];
        r.pquat[s + 1] = r.quat[s + 1];
        r.pquat[s + 2] = r.quat[s + 2];
        r.pquat[s + 3] = r.quat[s + 3];
        if (a === B_BODY) {
          let t = r.bodies[n];
          if (!t) {
            r.state[n] = B_FADING;
            r.life[n] = 1;
            continue;
          }
          let i = t.translation();
          let a = t.rotation();
          r.pos[o] = i.x;
          r.pos[o + 1] = i.y;
          r.pos[o + 2] = i.z;
          r.quat[s] = a.x;
          r.quat[s + 1] = a.y;
          r.quat[s + 2] = a.z;
          r.quat[s + 3] = a.w;
          r.life[n] -= e;
          if (r.life[n] <= 0 || i.y < -30) {
            this._removeBody(r, n);
            r.state[n] = B_FADING;
            r.life[n] = 1.4;
          }
        } else if (a === B_FLYING || a === B_RESTING) {
          if (a === B_FLYING) {
            r.vel[o + 1] += -22 * e;
            r.pos[o] += r.vel[o] * e;
            r.pos[o + 1] += r.vel[o + 1] * e;
            r.pos[o + 2] += r.vel[o + 2] * e;
            let i = t.groundY(r.pos[o], r.pos[o + 2], r.pos[o + 1] + 0.5) + r.half[1] * r.scale[n];
            if (r.pos[o + 1] < i) {
              r.pos[o + 1] = i;
              if (Math.abs(r.vel[o + 1]) > 3) {
                r.vel[o + 1] *= -0.3;
                r.vel[o] *= 0.6;
                r.vel[o + 2] *= 0.6;
                r.ang[o] *= 0.5;
                r.ang[o + 2] *= 0.5;
              } else {
                r.state[n] = B_RESTING;
                r.vel[o] = r.vel[o + 1] = r.vel[o + 2] = 0;
              }
            }
            let a = r.ang[o];
            let c = r.ang[o + 1];
            let l = r.ang[o + 2];
            _bQ1.set(r.quat[s], r.quat[s + 1], r.quat[s + 2], r.quat[s + 3]);
            _bQ2.set(a * e * 0.5, c * e * 0.5, l * e * 0.5, 1).normalize();
            _bQ1.premultiply(_bQ2).normalize();
            if (r.state[n] === B_RESTING) {
              let e = Math.atan2(2 * (_bQ1.w * _bQ1.y + _bQ1.x * _bQ1.z), 1 - 2 * (_bQ1.y * _bQ1.y + _bQ1.x * _bQ1.x));
              _bQ1.set(0, Math.sin(e / 2), 0, Math.cos(e / 2));
            }
            r.quat[s] = _bQ1.x;
            r.quat[s + 1] = _bQ1.y;
            r.quat[s + 2] = _bQ1.z;
            r.quat[s + 3] = _bQ1.w;
          }
          r.life[n] -= e;
          if (r.life[n] <= 0) {
            r.state[n] = B_FADING;
            r.life[n] = 1.4;
          }
        } else {
          if (a === B_FADING) {
            r.pos[o + 1] -= e * 1.3;
            r.life[n] -= e;
            if (r.life[n] <= 0) {
              r.state[n] = B_FREE;
              r._writeHidden(n);
              i.push(n);
              if (n >= r.staticEnd) {
                r.free.push(n);
              }
            }
          } else {
            if (a === B_FREE || a === B_ATTACHED) {
              i.push(n);
            }
          }
        }
      }
      for (let e of i) {
        r.moving.delete(e);
      }
    }
  }
  render(e) {
    for (let t in this.pools) {
      let n = this.pools[t];
      if (n.moving.size) {
        for (let t of n.moving) {
          if (n.state[t] !== B_FREE) {
            n.write(t, e);
          }
        }
        n.dirty = true;
      }
      n.dirty &&= ((n.mesh.instanceMatrix.needsUpdate = true), false);
      n.pbrDirty &&= ((n.ipbr.needsUpdate = true), false);
      n.colorDirty &&= ((n.mesh.instanceColor.needsUpdate = true), false);
    }
  }
  blast(e, t, n, r, i) {
    for (let [a, o] of this.physQueue) {
      let s = a.bodies[o];
      if (!s) {
        continue;
      }
      let c = s.translation();
      let l = c.x - e;
      let u = c.y - t;
      let d = c.z - n;
      let f = Math.hypot(l, u, d);
      if (f < r && f > 0.01) {
        let e = (i * (1 - f / r)) / f;
        s.applyImpulse(
          {
            x: l * e,
            y: u * e + i * 0.3 * (1 - f / r),
            z: d * e,
          },
          true,
        );
      }
    }
  }
  dispose(e) {
    for (let t in this.pools) {
      let n = this.pools[t];
      e.remove(n.mesh);
      n.mesh.dispose();
    }
  }
}
const BUILDING_STYLES = {
  diner: {
    wall: [14168619, 14699068],
    band: 15921902,
    glass: 8373480,
    roof: 13222840,
    door: 5913122,
    accent: 16761370,
    win: (e, t) => (e === 1 || e === 2 ? t % 3 != 0 : false),
  },
  apartment: {
    wall: [13208410, 12549967, 13669990],
    band: 15260872,
    glass: 2772856,
    roof: 9341829,
    door: 4008476,
    accent: 15260872,
    win: (e, t) => e % 3 == 1 && t % 2 == 0,
  },
  shop: {
    wall: [3108822, 3832800],
    band: 15921902,
    glass: 10475248,
    roof: 14078407,
    door: 1842210,
    accent: 16761370,
    win: (e, t) => (e === 1 || e === 2 ? t % 4 != 0 : e % 3 == 1 && t % 2 == 0),
  },
  office: {
    wall: [15658730, 14869212],
    band: 12107978,
    glass: 2246511,
    roof: 10134446,
    door: 1842210,
    accent: 10134446,
    win: (e, t) => e % 3 != 0,
  },
  garage: {
    wall: [10133670, 9344154],
    band: 16761370,
    glass: 1842210,
    roof: 7304572,
    door: 1842210,
    accent: 16761370,
    win: (e, t) => e % 3 == 1 && t % 3 != 1,
  },
  warehouse: {
    wall: [5208726, 4616331],
    band: 14707231,
    glass: 1847109,
    roof: 8095633,
    door: 8028038,
    accent: 14707231,
    win: (e, t) => e % 4 == 2 && t % 3 == 0,
  },
  bank: {
    wall: [15789282, 15130834],
    band: 13148474,
    glass: 2045266,
    roof: 12038304,
    door: 1842210,
    accent: 13148474,
    win: (e, t) => e % 3 == 1 && t % 2 == 1,
  },
  shed: {
    wall: [6262600, 5604415],
    band: 15921902,
    glass: 2177103,
    roof: 9080724,
    door: 5913122,
    accent: 15921902,
    win: (e, t) => e === 2 && t % 2 == 0,
  },
  lab: {
    wall: [15921902, 15133674],
    band: 2073498,
    glass: 1919838,
    roof: 12174022,
    door: 2073498,
    accent: 2073498,
    win: (e, t) => e % 3 == 1,
  },
};
let buildingCounter = 0;
class Building {
  constructor(e, t) {
    this.sys = e;
    this.def = t;
    this.id = t.id;
    this.name = t.name;
    this.index = buildingCounter++;
    let n = t.w;
    let r = t.d;
    let i = t.courses;
    let a = t.y || 0;
    this.baseY = a;
    this.height = i * 1.2 + 0.4;
    this.box = {
      minX: t.x - n / 2,
      maxX: t.x + n / 2,
      minZ: t.z - r / 2,
      maxZ: t.z + r / 2,
      y0: a,
      y1: a + this.height,
    };
    this.cx = t.x;
    this.cz = t.z;
    this.maxHp = Math.round(45 + n * r * i * 0.065);
    this.hp = this.maxHp;
    this.value = Math.round((n * r * i * 260) / 100) * 100;
    this.alive = true;
    this.inPath = false;
    this.bricks = [];
    this.plates = [];
    this.hitCd = 0;
    this.fade = 1;
    this.fadeTarget = 1;
    this._build();
    let { body: o, col: s } = e.game.physics.fixedBox(t.x, a + this.height / 2, t.z, n / 2, this.height / 2, r / 2, {
      groups: COLLIDE.building,
      owner: this,
    });
    this.body = null;
    this.collider = s;
  }
  _build() {
    let e = this.def;
    let t = BUILDING_STYLES[e.style] || BUILDING_STYLES.apartment;
    let n = this.sys.bricks;
    let r = seededRandom(e.id.charCodeAt(0) * 131 + e.id.charCodeAt(1) * 7);
    let i = e.w;
    let a = e.d;
    let o = e.courses;
    let s = this.baseY;
    let c = (n, i, a, s) =>
      n === o - 1
        ? [t.band, 0.45, 0]
        : n < 2 && a === 2 && Math.abs(i) < 1.1
          ? [t.door, 0.5, 0.05]
          : !s && t.win(n, Math.abs(Math.round(i)))
            ? [t.glass, 0.08, 0.35]
            : (e.style === 'garage' || e.style === 'warehouse') && n % 4 == 3
              ? [t.band, 0.45, 0]
              : [t.wall[Math.floor(r() * t.wall.length)], 0.42, 0];
    let l = (e) => {
      let t = new Color(e);
      let n = 0.94 + r() * 0.1;
      t.multiplyScalar(n);
      return t.getHex();
    };
    for (let t = 0; t < o; t++) {
      let r = s + 0.6 + t * 1.2;
      let o = t % 2 == 0;
      let u = o ? i / 2 : (i - 2) / 2;
      let d = o ? -i / 2 + 1 : -i / 2 + 2;
      for (let [i, s] of [
        [-1, 0],
        [1, 2],
      ]) {
        let f = e.z + i * (a / 2 - 0.5);
        for (let i = 0; i < u; i++) {
          let a = d + 2 * i;
          let p = o && (i === 0 || i === u - 1);
          let [m, h, g] = c(t, a / 2, s, p);
          let _ = n.addStatic('brick', e.x + a, r, f, 0, l(m), h, g, this.index);
          if (_ >= 0) {
            this.bricks.push(_);
          }
        }
      }
      let f = o ? (a - 2) / 2 : a / 2;
      let p = o ? -a / 2 + 2 : -a / 2 + 1;
      for (let [a, s] of [
        [-1, 3],
        [1, 1],
      ]) {
        let u = e.x + a * (i / 2 - 0.5);
        for (let i = 0; i < f; i++) {
          let a = p + 2 * i;
          let d = !o && (i === 0 || i === f - 1);
          let [m, h, g] = c(t, a / 2 + 0.5, s, d);
          let _ = n.addStatic('brick', u, r, e.z + a, Math.PI / 2, l(m), h, g, this.index);
          if (_ >= 0) {
            this.bricks.push(_);
          }
        }
      }
    }
    let u = s + o * 1.2 + 0.2;
    for (let r = 0; r < i / 2; r++) {
      for (let o = 0; o < a / 2; o++) {
        let s = n.addStatic(
          'plate',
          e.x - i / 2 + 1 + 2 * r,
          u,
          e.z - a / 2 + 1 + 2 * o,
          0,
          l(t.roof),
          0.5,
          0,
          this.index,
        );
        if (s >= 0) {
          this.plates.push(s);
        }
      }
    }
    let d = u + 0.2 + 0.6;
    let f = [
      [e.x - i / 4, e.z - a / 4],
      [e.x + i / 4 - 1, e.z + a / 4],
    ];
    for (let [e, t] of f) {
      let r = n.addStatic('brick', e, d, t, 0, 10133670, 0.35, 0.6, this.index);
      if (r >= 0) {
        this.bricks.push(r);
      }
      let i = n.addStatic('brick', e, d + 1.2, t, Math.PI / 2, 12107978, 0.35, 0.6, this.index);
      if (i >= 0) {
        this.bricks.push(i);
      }
    }
    if (e.style === 'diner' || e.style === 'shop' || e.style === 'bank') {
      for (let r = -1; r <= 1; r++) {
        let i = n.addStatic('brick', e.x + r * 2, d, e.z + a / 2 - 0.5, 0, t.accent, 0.35, 0.1, this.index);
        if (i >= 0) {
          this.bricks.push(i);
        }
      }
    }
  }
  get centerY() {
    return this.baseY + this.height / 2;
  }
  closest(e, t, n) {
    let r = this.box;
    return [clampNum(e, r.minX, r.maxX), clampNum(t, r.y0, r.y1), clampNum(n, r.minZ, r.maxZ)];
  }
  damage(e, t, n, r, i, a, o = 'ram') {
    if (!this.alive || e <= 0) {
      return false;
    }
    let s = this.sys.game;
    this.hp -= e;
    s.objectives.addDamage(e * 120);
    let c = clampNum(Math.round(e / 9), 2, 12);
    this._detachNear(t, n, r, c, i, a, e);
    s.fx.dust(t, n, r, 6 + c, 2.5);
    s.fx.sparks(t, n, r, 5);
    s.audio.play('sfx.brick_hit', {
      pos: {
        x: t,
        y: n,
        z: r,
      },
      detune: 0.2,
      volume: clampNum(e / 70, 0.4, 1.1),
    });
    s.camera.shake(clampNum(e / 160, 0.1, 0.6));
    s.hud.hitFlash(this, this.hp / this.maxHp);
    if (this.hp <= 0) {
      this.collapse(i, a, o);
    }
    return true;
  }
  _detachNear(e, t, n, r, i, a, o) {
    let s = this.sys.bricks;
    let c = s.pools.brick;
    let l = [];
    for (let r of this.bricks) {
      if (c.state[r] !== 1) {
        continue;
      }
      let i = c.pos[r * 3];
      let a = c.pos[r * 3 + 1];
      let o = c.pos[r * 3 + 2];
      l.push([(i - e) ** 2 + (a - t) ** 2 * 1.4 + (o - n) ** 2, r]);
    }
    l.sort((e, t) => e[0] - t[0]);
    let u = 3 + o / 20;
    for (let e = 0; e < Math.min(r, l.length); e++) {
      let t = l[e][1];
      s.launch(
        'brick',
        t,
        i * u + (Math.random() - 0.5) * 4,
        2 + Math.random() * 4,
        a * u + (Math.random() - 0.5) * 4,
        true,
      );
    }
  }
  collapse(e = 0, t = 0, n = 'ram') {
    if (!this.alive) {
      return;
    }
    this.alive = false;
    let r = this.sys.game;
    r.objectives.addDamage(this.value);
    r.physics.removeCollider(this.collider);
    this.collider = null;
    let i = this.sys.bricks;
    let a = i.pools.brick;
    let o = i.pools.plate;
    let s = Math.max(0, Math.min(r.quality.collapseBodies, r.quality.maxDebrisBodies));
    let c = [];
    for (let e of this.bricks) {
      if (a.state[e] === 1) {
        c.push(['brick', e, a.pos[e * 3 + 1]]);
      }
    }
    for (let e of this.plates) {
      if (o.state[e] === 1) {
        c.push(['plate', e, o.pos[e * 3 + 1]]);
      }
    }
    let l = new Set();
    let u = c.map((e, t) => t).sort(() => Math.random() - 0.5);
    for (let e = 0; e < Math.min(s, u.length); e++) {
      l.add(u[e]);
    }
    this.baseY + this.height;
    c.forEach(([n, r, a], o) => {
      let s = i.pools[n];
      let c = s.pos[r * 3] - this.cx;
      let u = s.pos[r * 3 + 2] - this.cz;
      let d = Math.hypot(c, u) || 1;
      let f = (a - this.baseY) / this.height;
      let p = 1.5 + Math.random() * 4 + f * 3;
      let m = (1 - f) * 0.45 + Math.random() * 0.12;
      i.launch(n, r, (c / d) * p + e * 5, 1 + Math.random() * 3 + f * 2, (u / d) * p + t * 5, l.has(o), m);
    });
    let d = this.cx;
    let f = this.cz;
    let p = this.baseY;
    r.fx.explosion(d, p + this.height * 0.4, f, 1.2 + this.height / 14);
    r.fx.collapseDust(d, p, f, this.box.maxX - this.box.minX, this.box.maxZ - this.box.minZ, this.height);
    r.fx.flash(d, p + 4, f, 1);
    r.audio.play('sfx.collapse', {
      pos: {
        x: d,
        y: p,
        z: f,
      },
      detune: 0.1,
    });
    r.audio.play('sfx.explosion_small', {
      pos: {
        x: d,
        y: p,
        z: f,
      },
      volume: 0.7,
      detune: 0.2,
    });
    r.camera.shake(0.9);
    r.hitStop(0.09);
    i.blast(d, p + 2, f, 16, 3);
    this.sys.onCollapse(this, n);
    this.sys.showRubble(this);
  }
}
class Buildings {
  constructor(e, t, n) {
    this.game = e;
    this.scene = t;
    this.bricks = e.bricks;
    buildingCounter = 0;
    this.list = n.map((e) => new Building(this, e));
    this.byId = new Map(this.list.map((e) => [e.id, e]));
    this.beaconMat = glowMaterial(4);
    this.group = new Group();
    t.add(this.group);
    this.rubble = new Map();
    this.beacons = new Map();
    let r = brickMaterial();
    for (let e of this.list) {
      let t = new BrickBuilder();
      let n = e.box.maxX - e.box.minX;
      let i = e.box.maxZ - e.box.minZ;
      let a = seededRandom(e.index + 9);
      t.box(e.cx, e.baseY + 0.1, e.cz, n - 0.5, 0.2, i - 0.5, 7301730, {
        bevel: 0.05,
        studs: false,
        ao: false,
        r: 0.95,
      });
      for (let r = 0; r < 18; r++) {
        let o = e.cx + (a() - 0.5) * (n - 2);
        let s = e.cz + (a() - 0.5) * (i - 2);
        let c = [9078144, 8025196, 10130314][r % 3];
        t.pushT(o, e.baseY + 0.3, s, a() * 3);
        t.box(0, 0, 0, 1 + a(), 0.35, 0.8 + a() * 0.6, c, {
          bevel: 0.06,
          studs: true,
          ao: false,
        });
        t.pop();
      }
      let o = new Mesh(t.build(), r);
      o.visible = false;
      o.receiveShadow = true;
      o.castShadow = false;
      this.group.add(o);
      this.rubble.set(e.id, o);
    }
  }
  markPath(e) {
    for (let t of this.list) {
      t.inPath = e.has(t.id);
    }
    new BrickBuilder();
    for (let e of this.list) {
      if (e.inPath) {
        let t = new BrickBuilder();
        let n = e.baseY + e.height + 0.4;
        t.cyl(0, 0.25, 0, 0.7, 0.5, 2763306, {
          seg: 8,
          r: 0.5,
        });
        t.cyl(0, 0.9, 0, 0.55, 0.9, 16722458, {
          seg: 8,
          e: 1,
          ao: false,
        });
        let r = new Mesh(t.build(), this.beaconMat);
        r.position.set(e.cx, n, e.cz);
        this.group.add(r);
        this.beacons.set(e.id, r);
      }
    }
  }
  showRubble(e) {
    let t = this.rubble.get(e.id);
    if (t) {
      t.visible = true;
    }
    let n = this.beacons.get(e.id);
    if (n) {
      n.visible = false;
    }
  }
  onCollapse(e, t) {
    this.game.onBuildingDestroyed(e, t);
  }
  query(e) {
    for (let t of this.list) {
      if (t.alive) {
        e(t);
      }
    }
  }
  update(e, t) {
    this.beaconMat.glow.value = 2 + Math.max(0, Math.sin(t * 8)) * 8;
    for (let t of this.list) {
      if (t.hitCd > 0) {
        t.hitCd -= e;
      }
      if (t.alive && Math.abs(t.fade - t.fadeTarget) > 0.01) {
        t.fade += (t.fadeTarget - t.fade) * Math.min(1, e * 8);
        this.bricks.setFade('brick', t.bricks, t.fade);
        this.bricks.setFade('plate', t.plates, t.fade);
      }
    }
  }
  dispose() {
    this.scene.remove(this.group);
  }
}
const PROP_TYPES = {
  lamp: {
    r: 0.35,
    value: 1200,
    debris: [5595243, 5595243, 16774352],
    n: 4,
    sound: 'sfx.clang',
    solid: true,
    build: (e) => {
      e.box(0, 0.25, 0, 0.7, 0.5, 0.7, 3816772, {
        bevel: 0.08,
      });
      e.cyl(0, 3.3, 0, 0.14, 6, 7042176, {
        seg: 8,
        m: 0.7,
        r: 0.35,
      });
      e.box(0, 6.3, -0.9, 0.25, 0.2, 2, 7042176, {
        m: 0.7,
        r: 0.35,
        ao: false,
      });
      e.box(0, 6.15, -1.7, 0.6, 0.25, 0.9, 3816772, {
        ao: false,
      });
      e.box(0, 6, -1.7, 0.45, 0.06, 0.7, 16774352, {
        e: 0.6,
        ao: false,
      });
    },
  },
  tree: {
    r: 1,
    value: 800,
    debris: [5151290, 5941315, 8016432],
    n: 7,
    sound: 'sfx.wood',
    solid: true,
    build: (e) => {
      e.box(0, 1.2, 0, 0.7, 2.4, 0.7, 8016432, {
        bevel: 0.1,
        r: 0.9,
      });
      e.box(0, 3, 0, 3.2, 1.4, 3.2, 5151290, {
        bevel: 0.2,
        studs: true,
        r: 0.7,
      });
      e.box(0, 4.3, 0, 2.2, 1.2, 2.2, 5941315, {
        bevel: 0.2,
        studs: true,
        r: 0.7,
      });
      e.box(0, 5.3, 0, 1.2, 0.8, 1.2, 6731853, {
        bevel: 0.15,
        studs: true,
        r: 0.7,
      });
    },
  },
  bench: {
    r: 1,
    value: 400,
    debris: [9268810, 3816772],
    n: 3,
    sound: 'sfx.wood',
    build: (e) => {
      e.box(0, 0.5, 0, 2.4, 0.15, 0.7, 9268810, {
        bevel: 0.04,
      });
      e.box(0, 0.95, 0.3, 2.4, 0.5, 0.12, 9268810, {
        bevel: 0.04,
      });
      for (let t of [-1, 1]) {
        e.box(t, 0.25, 0, 0.15, 0.5, 0.6, 3816772, {
          bevel: 0.03,
        });
      }
    },
  },
  hydrant: {
    r: 0.4,
    value: 300,
    debris: [14168619],
    n: 2,
    sound: 'sfx.clang',
    water: true,
    build: (e) => {
      e.cyl(0, 0.45, 0, 0.26, 0.9, 14168619, {
        seg: 8,
        r: 0.35,
      });
      e.cyl(0, 0.95, 0, 0.2, 0.2, 14168619, {
        seg: 8,
        r: 0.35,
      });
      e.box(0, 0.6, 0, 0.8, 0.14, 0.14, 14168619, {
        ao: false,
      });
    },
  },
  cone: {
    r: 0.4,
    value: 50,
    debris: [16738816, 15921902],
    n: 1,
    sound: 'sfx.plastic',
    build: (e) => {
      e.box(0, 0.05, 0, 0.7, 0.1, 0.7, 16738816, {
        bevel: 0.03,
      });
      e.cyl(0, 0.45, 0, 0.26, 0.8, 16738816, {
        seg: 8,
        r2: 0.06,
        r: 0.5,
      });
      e.cyl(0, 0.55, 0, 0.19, 0.14, 15921902, {
        seg: 8,
        r2: 0.16,
        ao: false,
        noTop: true,
      });
    },
  },
  car: {
    r: 2.3,
    hw: 1,
    hl: 2.2,
    value: 6000,
    debris: [15921902, 1914192, 2040102],
    n: 7,
    sound: 'sfx.crunch',
    tint: true,
    solid: true,
    build: (e) => {
      e.box(0, 0.62, 0, 2, 0.65, 4.3, 16777215, {
        r: 0.25,
        m: 0.2,
      });
      e.box(0, 1.2, 0.2, 1.7, 0.55, 2.2, 16777215, {
        r: 0.25,
        m: 0.2,
      });
      e.box(0, 1.22, -0.92, 1.5, 0.42, 0.08, 1914192, {
        r: 0.05,
        ao: false,
      });
      e.box(0, 1.22, 1.32, 1.5, 0.42, 0.08, 1914192, {
        r: 0.05,
        ao: false,
      });
      for (let t of [-0.87, 0.87]) {
        e.box(t, 1.24, 0.2, 0.08, 0.4, 1.8, 1914192, {
          r: 0.05,
          ao: false,
        });
      }
      for (let [t, n] of [
        [-0.9, -1.35],
        [0.9, -1.35],
        [-0.9, 1.35],
        [0.9, 1.35],
      ]) {
        e.cyl(t, 0.4, n, 0.4, 0.35, 2040102, {
          axis: 'x',
          seg: 10,
        });
      }
      for (let t of [-0.6, 0.6]) {
        e.box(t, 0.72, -2.16, 0.45, 0.18, 0.06, 16774352, {
          e: 0.8,
          ao: false,
        });
      }
    },
  },
  mailbox: {
    r: 0.5,
    value: 250,
    debris: [3108822],
    n: 2,
    sound: 'sfx.clang',
    build: (e) => {
      e.box(0, 0.35, 0, 0.1, 0.7, 0.1, 3816772, {
        ao: false,
      });
      e.box(0, 0.95, 0, 0.8, 0.7, 0.6, 3108822, {
        bevel: 0.1,
        studs: false,
        r: 0.3,
      });
    },
  },
  bin: {
    r: 0.45,
    value: 100,
    debris: [3116874],
    n: 2,
    sound: 'sfx.plastic',
    build: (e) => {
      e.cyl(0, 0.5, 0, 0.35, 1, 3116874, {
        seg: 8,
        r: 0.5,
      });
      e.cyl(0, 1.02, 0, 0.38, 0.08, 2055984, {
        seg: 8,
        ao: false,
      });
    },
  },
  planter: {
    r: 1.1,
    value: 300,
    debris: [9268810, 5151290],
    n: 3,
    sound: 'sfx.wood',
    build: (e) => {
      e.box(0, 0.5, 0, 2.2, 1, 2.2, 12104360, {
        bevel: 0.1,
        studs: false,
      });
      e.box(0, 1.3, 0, 1.8, 0.8, 1.8, 5151290, {
        bevel: 0.25,
        studs: true,
      });
    },
  },
};
const CAR_COLORS = [14168619, 3108822, 15921902, 3116874, 16761370, 2040102];
class Props {
  constructor(e, t, n) {
    this.game = e;
    this.scene = t;
    this.items = [];
    this.meshes = {};
    this.grid = new Map();
    this.cell = 12;
    let r = brickMaterial();
    let i = new Matrix4();
    let a = new Quaternion();
    let o = new Vector3();
    let s = new Vector3();
    let c = new Color();
    for (let e in PROP_TYPES) {
      let l = (e, t) =>
        BUILDINGS.some(
          (n) =>
            e > n.x - n.w / 2 - 1.2 && e < n.x + n.w / 2 + 1.2 && t > n.z - n.d / 2 - 1.2 && t < n.z + n.d / 2 + 1.2,
        );
      let u = (n[e] || []).filter((e) => !l(e[0], e[2]));
      if (!u.length) {
        continue;
      }
      let d = PROP_TYPES[e];
      let f = new BrickBuilder();
      d.build(f);
      let p = new InstancedMesh(f.build(), r, u.length);
      p.castShadow = true;
      p.receiveShadow = true;
      if (d.tint) {
        p.setColorAt(0, c.set(16777215));
      }
      u.forEach((t, n) => {
        let [r, l, u, f = 0, m = 1] = t;
        let h = e === 'tree' ? m : 1;
        s.set(r, l, u);
        a.setFromAxisAngle(new Vector3(0, 1, 0), f);
        o.set(h, h, h);
        p.setMatrixAt(n, i.compose(s, a, o));
        let g = d.tint ? CAR_COLORS[m % CAR_COLORS.length] : null;
        if (d.tint) {
          p.setColorAt(n, c.set(g));
        }
        let _ = {
          type: e,
          def: d,
          i: n,
          x: r,
          y: l,
          z: u,
          yaw: f,
          r: d.r * h,
          alive: true,
          color: g,
          mesh: p,
          collider: null,
        };
        this.items.push(_);
        let v = this._key(r, u);
        if (!this.grid.has(v)) {
          this.grid.set(v, []);
        }
        this.grid.get(v).push(_);
      });
      p.computeBoundingSphere();
      t.add(p);
      this.meshes[e] = p;
    }
  }
  _key(e, t) {
    return Math.floor(e / this.cell) + ',' + Math.floor(t / this.cell);
  }
  createColliders(e) {
    for (let t of this.items) {
      if (!t.def.solid || !t.alive) {
        continue;
      }
      let n = t.def.hw ?? t.r * 0.6;
      let r = t.def.hl ?? t.r * 0.6;
      let { col: i } = e.fixedBox(t.x, t.y + 1, t.z, n, 1, r, {
        yaw: t.yaw,
        groups: COLLIDE.prop,
      });
      t.collider = i;
    }
  }
  near(e, t, n, r) {
    let i = this.cell;
    let a = Math.floor((e - n) / i);
    let o = Math.floor((e + n) / i);
    let s = Math.floor((t - n) / i);
    let c = Math.floor((t + n) / i);
    for (let e = a; e <= o; e++) {
      for (let t = s; t <= c; t++) {
        let n = this.grid.get(e + ',' + t);
        if (n) {
          for (let e of n) {
            if (e.alive) {
              r(e);
            }
          }
        }
      }
    }
  }
  sweep(e, t, n, r) {
    let i = Math.max(e.hw, e.hl) + 3;
    this.near(e.x, e.z, i, (i) => {
      if (
        Math.abs(i.y - t) > 3 ||
        !obbOverlap(e, {
          x: i.x,
          z: i.z,
          hw: i.def.hw ?? i.r,
          hl: i.def.hl ?? i.r,
          yaw: i.def.hw ? i.yaw : 0,
        })
      ) {
        return;
      }
      let a = i.x - e.x;
      let o = i.z - e.z;
      let s = Math.hypot(a, o) || 1;
      this.smash(i, (a / s) * (3 + n * 0.5), (o / s) * (3 + n * 0.5), r);
    });
  }
  blast(e, t, n, r, i) {
    this.near(e, n, r, (a) => {
      let o = a.x - e;
      let s = a.z - n;
      let c = Math.hypot(o, s);
      if (c < r + a.r && Math.abs(a.y - t) < r) {
        this.smash(a, (o / (c || 1)) * 8, (s / (c || 1)) * 8, i);
      }
    });
  }
  smash(e, t, n, r) {
    if (!e.alive) {
      return;
    }
    e.alive = false;
    let i = new Matrix4().makeScale(0, 0, 0);
    e.mesh.setMatrixAt(e.i, i);
    e.mesh.instanceMatrix.needsUpdate = true;
    e.collider &&= (this.game.physics.removeCollider(e.collider), null);
    let a = this.game;
    let o = e.def;
    let s = a.bricks.physCount < a.quality.maxDebrisBodies * 0.8;
    for (let r = 0; r < o.n; r++) {
      let i = o.tint && r < 3 ? e.color : o.debris[r % o.debris.length];
      let c = r % 3 == 2 ? 'plate' : 'brick';
      a.bricks.spawn(
        c,
        e.x + (Math.random() - 0.5) * e.r,
        e.y + 0.6 + Math.random() * (e.type === 'lamp' || e.type === 'tree' ? 4 : 1),
        e.z + (Math.random() - 0.5) * e.r,
        i,
        t * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 3,
        2 + Math.random() * 4,
        n * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 3,
        e.type === 'car' ? 0.7 : 0.45,
        s && r < 3,
        0.45,
        0,
      );
    }
    a.fx.dust(e.x, e.y + 0.5, e.z, 5, 1.5);
    if (e.type === 'car') {
      a.fx.sparks(e.x, e.y + 1, e.z, 10);
      a.fx.explosion(e.x, e.y + 0.8, e.z, 0.5);
    }
    if (o.water) {
      a.fx.sparkle(e.x, e.y + 1, e.z, [1.6, 2.6, 4], 26, 8);
    }
    a.audio.play(o.sound, {
      pos: {
        x: e.x,
        y: e.y,
        z: e.z,
      },
      detune: 0.2,
      volume: 0.8,
    });
    a.objectives.addDamage(o.value);
    a.objectives.propSmashed(e);
  }
  dispose() {
    for (let e in this.meshes) {
      this.scene.remove(this.meshes[e]);
      this.meshes[e].dispose();
    }
  }
}
const _pM4 = new Matrix4();
const _pQ = new Quaternion();
const _pEuler = new Euler();
const _pV1 = new Vector3();
const _pV2 = new Vector3();
const _pColor = new Color();
class ParticlePool {
  constructor(e, t, n, r, i) {
    this.cap = t;
    this.mesh = new InstancedMesh(n, r, t);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = !!i;
    this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.setColorAt(0, _pColor.set(1, 1, 1));
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    e.add(this.mesh);
    let a = (e) => new Float32Array(t * e);
    this.p = a(3);
    this.v = a(3);
    this.life = a(1);
    this.max = a(1);
    this.s0 = a(1);
    this.s1 = a(1);
    this.c0 = a(3);
    this.c1 = a(3);
    this.g = a(1);
    this.drag = a(1);
    this.rot = a(3);
    this.spin = a(3);
    this.floor = a(1);
    this.n = 0;
  }
  spawn(e, t, n, r, i, a, o, s, c, l, u, d = 0, f = 0, p = -1000000000) {
    if (this.n >= this.cap) {
      return;
    }
    let m = this.n++;
    this.p[m * 3] = e;
    this.p[m * 3 + 1] = t;
    this.p[m * 3 + 2] = n;
    this.v[m * 3] = r;
    this.v[m * 3 + 1] = i;
    this.v[m * 3 + 2] = a;
    this.life[m] = o;
    this.max[m] = o;
    this.s0[m] = s;
    this.s1[m] = c;
    this.c0[m * 3] = l[0];
    this.c0[m * 3 + 1] = l[1];
    this.c0[m * 3 + 2] = l[2];
    this.c1[m * 3] = u[0];
    this.c1[m * 3 + 1] = u[1];
    this.c1[m * 3 + 2] = u[2];
    this.g[m] = d;
    this.drag[m] = f;
    this.floor[m] = p;
    this.rot[m * 3] = Math.random() * 6;
    this.rot[m * 3 + 1] = Math.random() * 6;
    this.rot[m * 3 + 2] = Math.random() * 6;
    this.spin[m * 3] = (Math.random() - 0.5) * 6;
    this.spin[m * 3 + 1] = (Math.random() - 0.5) * 6;
    this.spin[m * 3 + 2] = (Math.random() - 0.5) * 6;
  }
  copy(e, t) {
    for (let n of [this.p, this.v, this.c0, this.c1, this.rot, this.spin]) {
      n[e * 3] = n[t * 3];
      n[e * 3 + 1] = n[t * 3 + 1];
      n[e * 3 + 2] = n[t * 3 + 2];
    }
    for (let n of [this.life, this.max, this.s0, this.s1, this.g, this.drag, this.floor]) {
      n[e] = n[t];
    }
  }
  update(e) {
    let t = 0;
    for (; t < this.n; ) {
      this.life[t] -= e;
      if (this.life[t] <= 0) {
        this.n--;
        if (t !== this.n) {
          this.copy(t, this.n);
        }
        continue;
      }
      let n = t * 3;
      let r = Math.max(0, 1 - this.drag[t] * e);
      this.v[n] *= r;
      this.v[n + 1] = this.v[n + 1] * r + this.g[t] * e;
      this.v[n + 2] *= r;
      this.p[n] += this.v[n] * e;
      this.p[n + 1] += this.v[n + 1] * e;
      this.p[n + 2] += this.v[n + 2] * e;
      if (this.p[n + 1] < this.floor[t]) {
        this.p[n + 1] = this.floor[t];
        this.v[n + 1] *= -0.3;
        this.v[n] *= 0.7;
        this.v[n + 2] *= 0.7;
      }
      this.rot[n] += this.spin[n] * e;
      this.rot[n + 1] += this.spin[n + 1] * e;
      this.rot[n + 2] += this.spin[n + 2] * e;
      let i = 1 - this.life[t] / this.max[t];
      let a = this.s0[t] + (this.s1[t] - this.s0[t]) * i;
      _pV1.set(this.p[n], this.p[n + 1], this.p[n + 2]);
      _pQ.setFromEuler(_pEuler.set(this.rot[n], this.rot[n + 1], this.rot[n + 2]));
      _pV2.set(a, a, a);
      _pM4.compose(_pV1, _pQ, _pV2);
      this.mesh.setMatrixAt(t, _pM4);
      _pColor.setRGB(
        this.c0[n] + (this.c1[n] - this.c0[n]) * i,
        this.c0[n + 1] + (this.c1[n + 1] - this.c0[n + 1]) * i,
        this.c0[n + 2] + (this.c1[n + 2] - this.c0[n + 2]) * i,
      );
      this.mesh.setColorAt(t, _pColor);
      t++;
    }
    this.mesh.count = this.n;
    if (this.n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
}
const rand = Math.random;
class Effects {
  constructor(e, t) {
    this.game = e;
    let n = cubeGeometry(1, 0.12);
    this.glow = new ParticlePool(t, 900, n, unlitMaterial(), false);
    this.matter = new ParticlePool(t, 1100, n, matteMaterial(), false);
    this.flashLight = new PointLight(16757606, 0, 60, 1.6);
    this.flashLight.position.set(0, -100, 0);
    t.add(this.flashLight);
    this.flashT = 0;
    this.flashI = 0;
    this.rings = [];
    let r = new RingGeometry(0.85, 1, 40, 1);
    r.rotateX(-Math.PI / 2);
    for (let e = 0; e < 4; e++) {
      let e = new Mesh(
        r,
        new MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          blending: 2,
          color: new Color(2.5, 1.8, 1),
        }),
      );
      e.visible = false;
      e.frustumCulled = false;
      t.add(e);
      this.rings.push({
        m: e,
        t: 0,
        dur: 1,
        r: 10,
      });
    }
  }
  get q() {
    return this.game.quality.particleScale;
  }
  n(e) {
    return Math.max(1, Math.round(e * this.q));
  }
  explosion(e, t, n, r = 1) {
    let i = this.glow;
    let a = this.matter;
    for (let a = 0; a < this.n(24 * r); a++) {
      let a = rand() * 6.28;
      let o = (2 + rand() * 8) * r;
      let s = 2 + rand() * 7 * r;
      let c = rand() < 0.35;
      i.spawn(
        e + (rand() - 0.5) * 2 * r,
        t + rand() * r,
        n + (rand() - 0.5) * 2 * r,
        Math.cos(a) * o,
        s,
        Math.sin(a) * o,
        0.45 + rand() * 0.5,
        (0.7 + rand() * 1.1) * r,
        0.1,
        c ? [6, 4.2, 1.6] : [4.2, 1.5, 0.25],
        [0.9, 0.12, 0.02],
        -3,
        2.8,
      );
    }
    for (let i = 0; i < this.n(14 * r); i++) {
      let i = rand() * 6.28;
      let o = (1 + rand() * 4) * r;
      let s = 0.12 + rand() * 0.1;
      a.spawn(
        e + (rand() - 0.5) * 3 * r,
        t + rand() * 2,
        n + (rand() - 0.5) * 3 * r,
        Math.cos(i) * o,
        3 + rand() * 4,
        Math.sin(i) * o,
        1.4 + rand() * 1.4,
        (0.8 + rand() * 0.8) * r,
        (2 + rand() * 1.4) * r,
        [s, s * 0.95, s * 0.9],
        [s * 3.2, s * 3.1, s * 3],
        1.4,
        1.5,
      );
    }
    this.sparks(e, t, n, Math.round(14 * r));
    this.shockwave(e, t - 0.5, n, 10 * r, 0.55);
  }
  column(e, t, n, r = 1) {
    for (let i = 0; i < this.n(6); i++) {
      let i = 0.15 + rand() * 0.12;
      this.matter.spawn(
        e + (rand() - 0.5) * 6 * r,
        t + rand() * 3,
        n + (rand() - 0.5) * 6 * r,
        (rand() - 0.5) * 2,
        9 + rand() * 7,
        (rand() - 0.5) * 2,
        3 + rand() * 1.5,
        2 * r,
        6 * r,
        [i * 1.6, i * 0.9, i * 0.5],
        [i * 2.4, i * 2.3, i * 2.2],
        0,
        0.3,
      );
      this.glow.spawn(
        e + (rand() - 0.5) * 4 * r,
        t + rand() * 2,
        n + (rand() - 0.5) * 4 * r,
        (rand() - 0.5) * 2,
        8 + rand() * 6,
        (rand() - 0.5) * 2,
        0.9 + rand() * 0.5,
        1.6 * r,
        0.3,
        [6, 3.2, 1],
        [1.2, 0.2, 0.03],
        0,
        0.4,
      );
    }
  }
  sparks(e, t, n, r = 8) {
    for (let i = 0; i < this.n(r); i++) {
      let r = rand() * 6.28;
      let i = 6 + rand() * 12;
      this.glow.spawn(
        e,
        t,
        n,
        Math.cos(r) * i,
        3 + rand() * 9,
        Math.sin(r) * i,
        0.3 + rand() * 0.5,
        0.22,
        0.06,
        [10, 8, 3],
        [3, 1, 0.2],
        -22,
        0.5,
        this.game.world.groundY(e, n, t) + 0.05,
      );
    }
  }
  dust(e, t, n, r = 8, i = 2) {
    let a = this.game.world.groundY(e, n, t + 1);
    for (let o = 0; o < this.n(r); o++) {
      let r = rand() * 6.28;
      let o = 1 + rand() * 3.5;
      let s = 0.55 + rand() * 0.15;
      this.matter.spawn(
        e + (rand() - 0.5) * i,
        t + (rand() - 0.5) * i,
        n + (rand() - 0.5) * i,
        Math.cos(r) * o,
        1 + rand() * 2.5,
        Math.sin(r) * o,
        0.9 + rand() * 0.9,
        0.5 + rand() * 0.5,
        1.4 + rand() * 1.2,
        [s, s * 0.95, s * 0.88],
        [s * 1.1, s * 1.06, s],
        -1,
        1.5,
        a,
      );
    }
  }
  collapseDust(e, t, n, r, i, a) {
    let o = this.n(40 + (r + i) * 1.5);
    for (let a = 0; a < o; a++) {
      let a = rand() * 6.28;
      let o = Math.cos(a) * (r / 2 + rand() * 2);
      let s = Math.sin(a) * (i / 2 + rand() * 2);
      let c = 3 + rand() * 6;
      let l = 0.6 + rand() * 0.15;
      this.matter.spawn(
        e + o,
        t + rand() * 2,
        n + s,
        Math.cos(a) * c,
        0.5 + rand() * 2,
        Math.sin(a) * c,
        1.8 + rand() * 1.8,
        1.2 + rand(),
        3.4 + rand() * 2.4,
        [l, l * 0.95, l * 0.86],
        [l * 1.15, l * 1.1, l],
        0.4,
        1.2,
        t,
      );
    }
    for (let o = 0; o < this.n(22); o++) {
      let o = 0.58 + rand() * 0.12;
      this.matter.spawn(
        e + (rand() - 0.5) * r,
        t + rand() * a,
        n + (rand() - 0.5) * i,
        (rand() - 0.5) * 2,
        2 + rand() * 4,
        (rand() - 0.5) * 2,
        2 + rand() * 1.5,
        1.5,
        4 + rand() * 2,
        [o, o, o * 0.92],
        [o * 1.1, o * 1.1, o],
        0.6,
        0.9,
      );
    }
    this.shockwave(e, t + 0.2, n, Math.max(r, i) * 1.3, 0.8);
  }
  smoke(e, t, n, r = 1, i = 0.3) {
    let a = i + rand() * 0.1;
    this.matter.spawn(
      e,
      t,
      n,
      (rand() - 0.5) * 1.5,
      1.5 + rand() * 1.5,
      (rand() - 0.5) * 1.5,
      0.8 + rand() * 0.6,
      0.3 * r,
      1.4 * r,
      [a, a, a],
      [a + 0.35, a + 0.35, a + 0.33],
      0.6,
      1.2,
    );
  }
  tireSmoke(e, t, n) {
    let r = 0.8;
    this.matter.spawn(
      e + (rand() - 0.5) * 0.6,
      t + 0.3,
      n + (rand() - 0.5) * 0.6,
      (rand() - 0.5) * 1.2,
      0.8 + rand() * 0.8,
      (rand() - 0.5) * 1.2,
      0.7 + rand() * 0.4,
      0.4,
      1.8,
      [r, r, r],
      [0.95, 0.95, 0.95],
      0.3,
      1.5,
    );
  }
  sparkle(e, t, n, r = [3, 5, 2], i = 12, a = 5) {
    for (let o = 0; o < this.n(i); o++) {
      let i = rand() * 6.28;
      let o = 1 + rand() * a;
      this.glow.spawn(
        e,
        t,
        n,
        Math.cos(i) * o,
        2 + rand() * a,
        Math.sin(i) * o,
        0.5 + rand() * 0.5,
        0.35,
        0.05,
        r,
        [r[0] * 0.3, r[1] * 0.3, r[2] * 0.3],
        -6,
        1.5,
      );
    }
  }
  confetti(e, t, n, r = 40) {
    let i = [
      [4, 0.6, 0.4],
      [4, 3.2, 0.3],
      [0.6, 1.6, 4],
      [0.6, 3.5, 0.8],
      [3.6, 3.6, 3.6],
    ];
    for (let a = 0; a < this.n(r); a++) {
      let r = rand() * 6.28;
      let o = 2 + rand() * 6;
      let s = i[a % i.length];
      this.glow.spawn(
        e,
        t,
        n,
        Math.cos(r) * o,
        6 + rand() * 8,
        Math.sin(r) * o,
        1.2 + rand() * 0.8,
        0.35,
        0.3,
        s,
        s,
        -12,
        1.2,
      );
    }
  }
  jet(e, t, n, r = 0, i = 0) {
    this.glow.spawn(
      e + (rand() - 0.5) * 0.3,
      t,
      n + (rand() - 0.5) * 0.3,
      r + (rand() - 0.5) * 2,
      -10 - rand() * 6,
      i + (rand() - 0.5) * 2,
      0.22 + rand() * 0.12,
      0.55,
      0.1,
      [6, 4.2, 1.6],
      [3, 0.6, 0.1],
      0,
      0.5,
    );
  }
  trail(e, t, n) {
    this.glow.spawn(
      e,
      t,
      n,
      rand() - 0.5,
      rand() - 0.5,
      rand() - 0.5,
      0.25,
      0.35,
      0.05,
      [8, 4, 1.2],
      [2, 0.3, 0.05],
      0,
      1,
    );
    let r = 0.7;
    this.matter.spawn(
      e,
      t,
      n,
      (rand() - 0.5) * 0.8,
      0.5 + rand() * 0.5,
      (rand() - 0.5) * 0.8,
      0.6 + rand() * 0.4,
      0.3,
      1.1,
      [r, r, r],
      [0.92, 0.92, 0.92],
      0.2,
      1,
    );
  }
  radiation(e, t, n) {
    this.glow.spawn(
      e + (rand() - 0.5) * 3,
      t,
      n + (rand() - 0.5) * 6,
      (rand() - 0.5) * 0.6,
      1 + rand(),
      (rand() - 0.5) * 0.6,
      1.2 + rand() * 0.6,
      0.25,
      0.05,
      [1.2, 5, 0.8],
      [0.2, 1.2, 0.2],
      0.3,
      0.2,
    );
  }
  shockwave(e, t, n, r, i = 0.6) {
    let a = this.rings.find((e) => !e.m.visible) || this.rings[0];
    a.m.visible = true;
    a.t = 0;
    a.dur = i;
    a.r = r;
    a.m.position.set(e, t + 0.15, n);
  }
  flash(e, t, n, r = 1) {
    this.flashLight.position.set(e, t, n);
    this.flashI = Math.max(this.flashI, 700 * r);
    this.flashT = 0;
  }
  update(e) {
    this.glow.update(e);
    this.matter.update(e);
    if (this.flashI > 0) {
      this.flashI *= Math.exp(-e * 7);
      if (this.flashI < 5) {
        this.flashI = 0;
      }
      this.flashLight.intensity = this.flashI;
    }
    for (let t of this.rings) {
      if (t.m.visible) {
        t.t += e;
        let n = t.t / t.dur;
        if (n >= 1) {
          t.m.visible = false;
          continue;
        }
        let r = 1 + t.r * (1 - (1 - n) * (1 - n));
        t.m.scale.set(r, 1, r);
        t.m.material.opacity = (1 - n) * 0.9;
      }
    }
  }
  clear() {
    this.glow.clear();
    this.matter.clear();
    for (let e of this.rings) {
      e.m.visible = false;
    }
    this.flashI = 0;
    this.flashLight.intensity = 0;
  }
}
class Skids {
  constructor(e, t = 600) {
    this.cap = t;
    let n = new BufferGeometry();
    this.pos = new Float32Array(t * 4 * 3);
    this.alpha = new Float32Array(t * 4);
    let r = new Uint32Array(t * 6);
    for (let e = 0; e < t; e++) {
      let t = e * 4;
      r.set([t, t + 1, t + 2, t, t + 2, t + 3], e * 6);
    }
    n.setIndex(new BufferAttribute(r, 1));
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(DynamicDrawUsage);
    this.aAttr = new BufferAttribute(this.alpha, 1);
    this.aAttr.setUsage(DynamicDrawUsage);
    n.setAttribute('position', this.posAttr);
    n.setAttribute('skidA', this.aAttr);
    n.boundingSphere = new Sphere(new Vector3(), 100000);
    let i = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      color: 1315860,
    });
    i.opacityNode = attribute('skidA', 'float').mul(0.55);
    i.polygonOffset = true;
    i.polygonOffsetFactor = -3;
    i.polygonOffsetUnits = -3;
    this.mesh = new Mesh(n, i);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    e.add(this.mesh);
    this.head = 0;
    this.last = new Map();
    this.age = new Float32Array(t);
  }
  add(e, t, n, r, i = 0.6, a = 1) {
    let o = this.last.get(e);
    this.last.set(e, {
      x: t,
      y: n,
      z: r,
      t: performance.now(),
    });
    if (!o || performance.now() - o.t > 120) {
      return;
    }
    let s = t - o.x;
    let c = r - o.z;
    let l = Math.hypot(s, c);
    if (l < 0.05 || l > 4) {
      return;
    }
    let u = ((-c / l) * i) / 2;
    let d = ((s / l) * i) / 2;
    let f = this.head;
    this.head = (this.head + 1) % this.cap;
    let p = this.pos;
    let m = f * 12;
    p[m] = o.x + u;
    p[m + 1] = o.y + 0.04;
    p[m + 2] = o.z + d;
    p[m + 3] = o.x - u;
    p[m + 4] = o.y + 0.04;
    p[m + 5] = o.z - d;
    p[m + 6] = t - u;
    p[m + 7] = n + 0.04;
    p[m + 8] = r - d;
    p[m + 9] = t + u;
    p[m + 10] = n + 0.04;
    p[m + 11] = r + d;
    this.alpha.fill(Math.min(1, a), f * 4, f * 4 + 4);
    this.age[f] = 0;
    this.dirty = true;
  }
  break(e) {
    this.last.delete(e);
  }
  update(e) {
    this.fadeT = (this.fadeT || 0) + e;
    if (this.fadeT > 0.5) {
      this.fadeT = 0;
      for (let e = 0; e < this.cap; e++) {
        this.age[e] += 0.5;
        if (this.age[e] > 20 && this.alpha[e * 4] > 0) {
          let t = Math.max(0, this.alpha[e * 4] - 0.05);
          this.alpha.fill(t, e * 4, e * 4 + 4);
          this.dirty = true;
        }
      }
    }
    this.dirty &&= ((this.posAttr.needsUpdate = true), (this.aAttr.needsUpdate = true), false);
  }
  clear() {
    this.alpha.fill(0);
    this.pos.fill(0);
    this.dirty = true;
    this.last.clear();
  }
}
const SUN_DIR = new Vector3(-0.52, 0.74, 0.42).normalize();
function skyDomeGeometry(e, t = 1, n = false) {
  let r = new SphereGeometry(e, 48, 24);
  let i = r.attributes.position;
  let a = [];
  let o = new Color(0.2, 0.42, 0.86);
  let s = new Color(0.78, 0.86, 0.95);
  let c = new Color(0.42, 0.42, 0.4);
  let l = new Color(1, 0.92, 0.8);
  let u = new Vector3();
  let d = new Color();
  for (let e = 0; e < i.count; e++) {
    u.fromBufferAttribute(i, e).normalize();
    let r = u.y;
    if (r >= 0) {
      let e = r ** 0.55;
      d.copy(s).lerp(o, e);
    } else {
      let e = Math.min(1, -r * 4);
      d.copy(s).lerp(c, e);
    }
    let f = Math.max(0, u.dot(SUN_DIR));
    d.lerp(l, f ** 6 * 0.5);
    if (n) {
      let e = f ** 400 * 60 + f ** 30 * 1.5;
      d.r += e;
      d.g += e * 0.95;
      d.b += e * 0.85;
    }
    a.push(d.r * t, d.g * t, d.b * t);
  }
  r.setAttribute('color', new Float32BufferAttribute(a, 3));
  return r;
}
function createSky(e, t) {
  let n = new MeshBasicNodeMaterial({
    vertexColors: true,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  let r = new Mesh(skyDomeGeometry(900, 1, false), n);
  r.frustumCulled = false;
  r.renderOrder = -10;
  e.add(r);
  let i = new Scene();
  let a = new MeshBasicNodeMaterial({
    vertexColors: true,
    side: BackSide,
  });
  i.add(new Mesh(skyDomeGeometry(50, 1.15, true), a));
  let o = new MeshBasicNodeMaterial({
    color: new Color(0.5, 0.52, 0.56),
  });
  let s = seededRandom(3);
  for (let e = 0; e < 18; e++) {
    let t = (e / 18) * Math.PI * 2;
    let n = 4 + s() * 14;
    let r = new Mesh(new BoxGeometry(6 + s() * 6, n, 6), o);
    r.position.set(Math.cos(t) * 30, n / 2 - 3, Math.sin(t) * 30);
    r.lookAt(0, n / 2 - 3, 0);
    i.add(r);
  }
  e.environment = new PMREMGenerator(t).fromScene(i, 0.02, 0.1, 100).texture;
  e.environmentIntensity = 0.62;
  let c = new DirectionalLight(16773596, 3.4);
  c.castShadow = true;
  c.shadow.mapSize.set(2048, 2048);
  c.shadow.bias = -0.0006;
  c.shadow.normalBias = 0.04;
  Object.assign(c.shadow.camera, {
    left: -70,
    right: 70,
    top: 70,
    bottom: -70,
    near: 1,
    far: 400,
  });
  c.shadow.camera.updateProjectionMatrix();
  e.add(c);
  e.add(c.target);
  let l = new HemisphereLight(13624319, 6972504, 0.25);
  e.add(l);
  e.fog = new Fog(13162214, 320, 1100);
  let u = new BrickBuilder();
  let d = seededRandom(11);
  for (let e = 0; e < 14; e++) {
    let e = d() * Math.PI * 2;
    let t = 250 + d() * 350;
    let n = 14 + Math.cos(e) * t;
    let r = 28 + Math.sin(e) * t;
    let i = 110 + d() * 60;
    let a = 3 + Math.floor(d() * 4);
    for (let e = 0; e < a; e++) {
      u.box(
        n + (d() - 0.5) * 40,
        i + (d() - 0.3) * 8,
        r + (d() - 0.5) * 24,
        16 + d() * 22,
        6 + d() * 6,
        12 + d() * 14,
        16777215,
        {
          bevel: 1.2,
          studs: false,
          ao: false,
          r: 0.9,
        },
      );
    }
  }
  let f = new Mesh(u.build(), brickMaterial());
  f.castShadow = false;
  f.receiveShadow = false;
  e.add(f);
  return {
    dome: r,
    sun: c,
    hemi: l,
    clouds: f,
    update(e, t) {
      r.position.copy(e);
      let n = (c.shadow.camera.right * 2) / c.shadow.mapSize.x;
      let i = Math.round(t.x / n) * n;
      let a = Math.round(t.z / n) * n;
      c.target.position.set(i, t.y, a);
      c.position.set(i + SUN_DIR.x * 180, t.y + SUN_DIR.y * 180, a + SUN_DIR.z * 180);
    },
  };
}
class CameraRig {
  constructor(e) {
    this.cam = e;
    this.yaw = 0;
    this.pitch = 0.86;
    this.zoomLevels = [36, 50, 70];
    this.zoomIdx = 1;
    this.dist = 50;
    this.distT = 50;
    this.target = new Vector3(0, 0, 190);
    this.look = new Vector3(0, 0, 190);
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.manualT = 99;
    this.autoRotate = true;
    this.shakeEnabled = true;
    this.script = null;
  }
  shake(e) {
    if (this.shakeEnabled) {
      this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, e));
    }
  }
  cycleZoom() {
    this.zoomIdx = (this.zoomIdx + 1) % this.zoomLevels.length;
  }
  snap(e, t, n, r) {
    this.target.set(e, t, n);
    this.look.set(e, t, n);
    if (r !== undefined) {
      this.yaw = r;
    }
    this.dist = this.distT;
  }
  update(e, t, n) {
    if (this.script) {
      return this.updateScript(e);
    }
    if (n) {
      if (Math.abs(n.camYaw) > 0.0001) {
        this.yaw += n.camYaw;
        this.manualT = 0;
      }
      if (n.camZoom) {
        this.zoomIdx = clampNum(this.zoomIdx + Math.sign(n.camZoom), 0, this.zoomLevels.length - 1);
      }
      if (n.zoomPressed) {
        this.cycleZoom();
      }
    }
    this.manualT += e;
    let r = 0;
    if (t) {
      let { x: n, y: i, z: a, vx: o = 0, vz: s = 0, air: c = 0, kind: l } = t;
      let u = Math.hypot(o, s);
      let d = clampNum(u * 0.35, 0, 9);
      let f = u > 0.5 ? (o / u) * d : 0;
      let p = u > 0.5 ? (s / u) * d : 0;
      this.target.set(n + f, i, a + p);
      if (this.autoRotate && this.manualT > 2.5 && u > 9 && !t.drifting && Math.abs(t.yawRate || 0) < 0.35) {
        let t = Math.atan2(-o, -s);
        this.yaw = dampAngle(this.yaw, t, 0.35, e);
      }
      r = c * 0.5 + (l === 'jbomb' ? 8 : l === 'worker' ? -6 : l === 'train' ? 4 : 0);
    }
    this.distT = this.zoomLevels[this.zoomIdx] + r;
    this.dist = damp(this.dist, this.distT, 3, e);
    this.look.x = damp(this.look.x, this.target.x, 5, e);
    this.look.y = damp(this.look.y, this.target.y, 4, e);
    this.look.z = damp(this.look.z, this.target.z, 5, e);
    this.apply(e);
  }
  apply(e) {
    let t = this.cam;
    let n = this.dist;
    let r = this.pitch;
    let i = Math.sin(this.yaw) * Math.cos(r) * n;
    let a = Math.cos(this.yaw) * Math.cos(r) * n;
    let o = Math.sin(r) * n;
    t.position.set(this.look.x + i, this.look.y + o, this.look.z + a);
    t.lookAt(this.look.x, this.look.y + 1, this.look.z);
    if (this.shakeAmt > 0.001) {
      this.shakeT += e * 40;
      let n = this.shakeAmt * this.shakeAmt * 0.6;
      t.position.x += (Math.sin(this.shakeT * 1.3) + Math.sin(this.shakeT * 2.9)) * n;
      t.position.y += (Math.sin(this.shakeT * 1.7) + Math.sin(this.shakeT * 3.3)) * n * 0.6;
      t.position.z += (Math.sin(this.shakeT * 2.1) + Math.sin(this.shakeT * 2.3)) * n;
      this.shakeAmt = Math.max(0, this.shakeAmt - e * 2.2);
    }
  }
  play(e, t) {
    this.script = {
      keys: e,
      t: 0,
      onDone: t,
    };
  }
  skip() {
    if (this.script) {
      let e = this.script;
      this.script = null;
      if (e.onDone) {
        e.onDone();
      }
    }
  }
  updateScript(e) {
    let t = this.script;
    t.t += e;
    let n = t.keys;
    let r = n[n.length - 1].t;
    if (t.t >= r) {
      this.script = null;
      if (t.onDone) {
        t.onDone();
      }
      return;
    }
    let i = 0;
    for (; i < n.length - 2 && n[i + 1].t < t.t; ) {
      i++;
    }
    let a = n[i];
    let o = n[i + 1];
    let s = (t.t - a.t) / (o.t - a.t);
    s = s * s * (3 - 2 * s);
    let c = (e, t) => e + (t - e) * s;
    this.cam.position.set(c(a.pos[0], o.pos[0]), c(a.pos[1], o.pos[1]), c(a.pos[2], o.pos[2]));
    this.cam.lookAt(c(a.look[0], o.look[0]), c(a.look[1], o.look[1]), c(a.look[2], o.look[2]));
  }
}
let blobShadowGeo = null;
function blobShadow(e, t) {
  if (!blobShadowGeo) {
    blobShadowGeo = new PlaneGeometry(1, 1);
    blobShadowGeo.rotateX(-Math.PI / 2);
  }
  let n = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    color: 0,
  });
  let r = uniform(0.5);
  let i = length(uv().sub(0.5).mul(2));
  n.opacityNode = smoothstep(float(1), float(0.25), i).mul(r);
  n.polygonOffset = true;
  n.polygonOffsetFactor = -4;
  n.polygonOffsetUnits = -4;
  let a = new Mesh(blobShadowGeo, n);
  a.scale.set(e, 1, t);
  a.userData.op = r;
  a.renderOrder = 2;
  a.frustumCulled = false;
  return a;
}
let figureMat = null;
const figureMaterial = () => (figureMat ||= brickMaterial());
const SUIT_YELLOW = 16761370;
const TRIM_DARK = 2040102;
const WORKER_BLUE = 1914192;
function buildFigure({
  suit: e = SUIT_YELLOW,
  pants: t = 2895928,
  head: n = 15843965,
  hat: r = 16747008,
  coat: i = null,
  visor: a = true,
} = {}) {
  let o = new Group();
  let s = (e, t, n, r) => {
    let i = new BrickBuilder();
    e(i);
    let a = new Mesh(i.build(), figureMaterial());
    a.castShadow = true;
    let s = new Group();
    s.position.set(t, n, r);
    s.add(a);
    o.add(s);
    return s;
  };
  let c = s(
    (e) => {
      e.box(0, -0.42, 0, 0.36, 0.84, 0.4, t, {
        r: 0.6,
      });
      e.box(0, -0.8, -0.05, 0.38, 0.12, 0.5, TRIM_DARK, {
        ao: false,
      });
    },
    -0.21,
    0.88,
    0,
  );
  let l = s(
    (e) => {
      e.box(0, -0.42, 0, 0.36, 0.84, 0.4, t, {
        r: 0.6,
      });
      e.box(0, -0.8, -0.05, 0.38, 0.12, 0.5, TRIM_DARK, {
        ao: false,
      });
    },
    0.21,
    0.88,
    0,
  );
  let u = s(
    (t) => {
      t.box(0, 0.4, 0, 0.9, 0.8, 0.5, i ?? e, {
        r: 0.55,
      });
      if (!i) {
        t.box(0, 0.3, 0, 0.92, 0.14, 0.52, TRIM_DARK, {
          ao: false,
        });
      }
      t.box(0, 0.86, 0, 0.3, 0.12, 0.3, n, {
        ao: false,
      });
    },
    0,
    0.9,
    0,
  );
  return {
    root: o,
    parts: {
      legL: c,
      legR: l,
      armL: s(
        (t) => {
          t.box(0, -0.32, 0, 0.24, 0.72, 0.28, i ?? e, {
            r: 0.55,
          });
          t.box(0, -0.72, 0, 0.2, 0.14, 0.2, n, {
            ao: false,
          });
        },
        -0.58,
        1.62,
        0,
      ),
      armR: s(
        (t) => {
          t.box(0, -0.32, 0, 0.24, 0.72, 0.28, i ?? e, {
            r: 0.55,
          });
          t.box(0, -0.72, 0, 0.2, 0.14, 0.2, n, {
            ao: false,
          });
        },
        0.58,
        1.62,
        0,
      ),
      torso: u,
      head: s(
        (e) => {
          e.cyl(0, 0.24, 0, 0.26, 0.48, n, {
            seg: 10,
            r: 0.5,
          });
          if (r) {
            e.cyl(0, 0.52, 0, 0.3, 0.22, r, {
              seg: 10,
              r: 0.35,
            });
            e.box(0, 0.44, -0.2, 0.5, 0.06, 0.25, r, {
              ao: false,
            });
          }
          if (a) {
            e.box(0, 0.28, -0.25, 0.34, 0.12, 0.04, TRIM_DARK, {
              ao: false,
              r: 0.1,
            });
          }
        },
        0,
        1.86,
        0,
      ),
    },
  };
}
function animateFigure(e, t, n, r = 0) {
  let i = Math.sin(t) * 0.7 * n;
  e.parts.legL.rotation.x = i;
  e.parts.legR.rotation.x = -i;
  e.parts.armL.rotation.x = -i * 0.9;
  e.parts.armR.rotation.x = i * 0.9;
  if (r) {
    e.parts.armR.rotation.z = 2.6 + Math.sin(r * 10) * 0.35;
    e.parts.armR.rotation.x = 0;
  } else {
    e.parts.armR.rotation.z = 0;
  }
  e.parts.torso.position.y = 0.9 + Math.abs(Math.cos(t)) * 0.06 * n;
}
class Worker {
  constructor(e, t, n, r, i) {
    this.game = e;
    this.kind = 'worker';
    this.name = 'On Foot';
    this.isWalker = true;
    let a = e.physics.R;
    let o = e.physics.world;
    this.body = o.createRigidBody(a.RigidBodyDesc.kinematicPositionBased().setTranslation(t, n + 0.95, r));
    this.collider = o.createCollider(a.ColliderDesc.capsule(0.5, 0.42).setCollisionGroups(COLLIDE.player), this.body);
    this.cc = o.createCharacterController(0.06);
    this.cc.setMaxSlopeClimbAngle((58 * Math.PI) / 180);
    this.cc.setMinSlopeSlideAngle((65 * Math.PI) / 180);
    this.cc.enableAutostep(0.5, 0.25, false);
    this.cc.enableSnapToGround(0.5);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.vy = 0;
    this.grounded = true;
    this.yaw = i;
    this.speed = 0;
    this.curr = {
      x: t,
      y: n + 0.95,
      z: r,
      yaw: i,
    };
    this.prev = {
      ...this.curr,
    };
    this.fig = buildFigure();
    this.group = this.fig.root;
    e.scene.add(this.group);
    this.shadow = blobShadow(1.3, 1.3);
    e.scene.add(this.shadow);
    this.phase = 0;
    this.roll = 0;
    this.rollCd = 0;
    this.stepT = 0;
    this.vx = 0;
    this.vz = 0;
    this.driven = true;
  }
  get x() {
    return this.curr.x;
  }
  get y() {
    return this.curr.y;
  }
  get z() {
    return this.curr.z;
  }
  get groundPos() {
    return {
      x: this.curr.x,
      y: this.curr.y - 0.95,
      z: this.curr.z,
    };
  }
  obb() {
    return {
      x: this.curr.x,
      z: this.curr.z,
      hw: 0.45,
      hl: 0.45,
      yaw: 0,
    };
  }
  touchLabels() {
    return {
      action: 'ROLL',
      alt: '',
    };
  }
  hudInfo() {
    return {
      tip: 'Find a vehicle',
    };
  }
  fixedUpdate(e, t) {
    let n = 0;
    let r = 0;
    let i = 0;
    if (t && t.moveMag > 0.1) {
      let e = this.game.camera.yaw;
      n = forwardX(e) * t.moveY + rightX(e) * t.moveX;
      r = forwardZ(e) * t.moveY + rightZ(e) * t.moveX;
      i = Math.min(1, t.moveMag);
      let a = Math.hypot(n, r) || 1;
      n /= a;
      r /= a;
    }
    this.rollCd -= e;
    if (t && t.actionPressed && this.rollCd <= 0 && this.grounded) {
      this.roll = 0.45;
      this.rollCd = 0.85;
      this.game.audio.play('sfx.whoosh', {
        volume: 0.5,
      });
      i ||= ((n = forwardX(this.yaw)), (r = forwardZ(this.yaw)), 1);
    }
    let a = this.roll > 0 ? 11 : 6.2 * i;
    if (this.roll > 0) {
      this.roll -= e;
      n = forwardX(this.yaw);
      r = forwardZ(this.yaw);
    }
    let o = n * a;
    let s = r * a;
    this.vx = damp(this.vx, o, 14, e);
    this.vz = damp(this.vz, s, 14, e);
    if (i > 0.1 && this.roll <= 0) {
      this.yaw = dampAngle(this.yaw, Math.atan2(-n, -r), 14, e);
    }
    if (this.knock) {
      this.vy = this.knock;
      this.knock = 0;
      this.grounded = false;
    } else {
      this.vy = this.grounded ? -2 : Math.max(-40, this.vy + -22 * e);
    }
    let c = {
      x: this.vx * e,
      y: this.vy * e,
      z: this.vz * e,
    };
    this.cc.computeColliderMovement(this.collider, c, undefined, RAY_ANY);
    let l = this.cc.computedMovement();
    let u = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: u.x + l.x,
      y: u.y + l.y,
      z: u.z + l.z,
    });
    this.grounded = this.cc.computedGrounded();
    this.speed = Math.hypot(l.x, l.z) / e;
  }
  afterStep(e) {
    let t = this.body.translation();
    Object.assign(this.prev, this.curr);
    this.curr.x = t.x;
    this.curr.y = t.y;
    this.curr.z = t.z;
    this.curr.yaw = this.yaw;
    if (this.curr.y < -40) {
      this.body.setNextKinematicTranslation({
        x: t.x,
        y: 5,
        z: t.z,
      });
    }
  }
  render(e, t) {
    let n = this.prev;
    let r = this.curr;
    let i = n.x + (r.x - n.x) * e;
    let a = n.y + (r.y - n.y) * e;
    let o = n.z + (r.z - n.z) * e;
    this.group.position.set(i, a - 0.95, o);
    this.group.rotation.set(this.roll > 0 ? ((0.45 - this.roll) / 0.45) * Math.PI * 2 : 0, this.yaw, 0, 'YXZ');
    let s = clampNum(this.speed / 6, 0, 1.2);
    this.phase += t * (4 + this.speed * 1.5);
    animateFigure(this.fig, this.phase, s);
    let c = this.game.world.groundY(i, o, a);
    this.shadow.position.set(i, c + 0.05, o);
    this.stepT += t * this.speed;
    if (this.grounded && this.stepT > 2.2) {
      this.stepT = 0;
      this.game.audio.play('sfx.step', {
        volume: 0.35,
        detune: 0.3,
      });
    }
  }
  dispose() {
    this.game.scene.remove(this.group);
    this.game.scene.remove(this.shadow);
    this.game.physics.world.removeCharacterController(this.cc);
    this.game.physics.removeBody(this.body);
  }
  teleport(e, t, n, r = this.yaw) {
    this.body.setTranslation(
      {
        x: e,
        y: t + 0.95,
        z: n,
      },
      true,
    );
    this.body.setNextKinematicTranslation({
      x: e,
      y: t + 0.95,
      z: n,
    });
    this.curr = {
      x: e,
      y: t + 0.95,
      z: n,
      yaw: r,
    };
    this.prev = {
      ...this.curr,
    };
    this.yaw = r;
    this.vy = 0;
    this.vx = this.vz = 0;
  }
}
class JBomb {
  constructor(e, t, n, r, i) {
    this.game = e;
    this.kind = 'jbomb';
    this.name = 'J-Bomb';
    this.isVehicle = true;
    this.isWalker = true;
    let a = e.physics.R;
    let o = e.physics.world;
    this.hh = 2.4;
    this.foot = 0.2;
    this.body = o.createRigidBody(
      a.RigidBodyDesc.dynamic()
        .setTranslation(t, n + this.hh + this.foot + 0.05, r)
        .setRotation(yawQuat(i))
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setLinearDamping(0.05),
    );
    this.body.setEnabledRotations(false, false, false, true);
    this.collider = o.createCollider(
      a.ColliderDesc.cuboid(1.3, this.hh, 1.1).setDensity(1.6).setFriction(0.1).setCollisionGroups(COLLIDE.vehicle),
      this.body,
    );
    e.physics.colliderOwner.set(this.collider.handle, this);
    this.yaw = i;
    this.grounded = true;
    this.fuel = 1;
    this.jetting = false;
    this.stomping = false;
    this.airPeak = 0;
    this.curr = {
      x: t,
      y: n + this.hh + this.foot,
      z: r,
      yaw: i,
    };
    this.prev = {
      ...this.curr,
    };
    this.groundY = n;
    this.phase = 0;
    this.driven = false;
    this.speed = 0;
    this.vf = 0;
    this.group = new Group();
    e.scene.add(this.group);
    this.buildVisual();
    this.shadow = blobShadow(3.4, 3.4);
    e.scene.add(this.shadow);
    this.jetLoop = e.audio.loop('sfx.jet');
    this.stepT = 0;
    this.lastGroundBuilding = null;
  }
  get x() {
    return this.curr.x;
  }
  get y() {
    return this.curr.y;
  }
  get z() {
    return this.curr.z;
  }
  get groundPos() {
    return {
      x: this.curr.x,
      y: this.curr.y - this.hh - this.foot,
      z: this.curr.z,
    };
  }
  obb(e = 0) {
    return {
      x: this.curr.x,
      z: this.curr.z,
      hw: 1.3 + e,
      hl: 1.1 + e,
      yaw: this.yaw,
    };
  }
  get spec() {
    return {
      hw: 1.3,
      hl: 1.1,
    };
  }
  touchLabels() {
    return {
      action: 'JETS',
      alt: 'STOMP',
    };
  }
  hudInfo() {
    return {
      meter: this.fuel,
      meterLabel: 'JET FUEL',
      tip: this.grounded ? 'Hold JETS to fly' : 'STOMP to crush!',
    };
  }
  buildVisual() {
    let e = 3108822;
    let t = 15921902;
    let n = (e) => {
      let t = new BrickBuilder();
      e(t);
      let n = new Mesh(t.build(), figureMaterial());
      n.castShadow = true;
      return n;
    };
    this.torso = new Group();
    this.torso.position.y = 3.1;
    this.group.add(this.torso);
    this.torso.add(
      n((n) => {
        n.box(0, 0.6, 0, 2.4, 1.8, 2, e, {
          studs: true,
          r: 0.35,
          m: 0.3,
        });
        n.box(0, 0.8, -1.02, 1.6, 0.8, 0.1, WORKER_BLUE, {
          r: 0.05,
          m: 0.4,
          ao: false,
        });
        n.box(0, -0.35, 0, 2, 0.4, 1.8, 3816772, {
          r: 0.5,
          m: 0.5,
        });
        n.box(0, 1.6, 0.2, 1.2, 0.3, 1, SUIT_YELLOW, {
          r: 0.4,
          studs: true,
        });
        n.box(0, 0.8, -1.08, 1.7, 0.18, 0.1, SUIT_YELLOW, {
          ao: false,
        });
        for (let e of [-0.45, 0.45]) {
          n.box(e, 1.05, -1.06, 0.36, 0.2, 0.08, 16774352, {
            e: 2.2,
            ao: false,
          });
        }
        n.cyl(0.8, 2.3, 0.5, 0.06, 1.2, 5595243, {
          seg: 6,
          m: 0.8,
        });
        n.box(0.8, 2.95, 0.5, 0.18, 0.18, 0.18, 16722458, {
          e: 2,
          ao: false,
        });
        for (let e of [-0.8, 0.8]) {
          n.cyl(e, 0.4, 1.25, 0.42, 1.5, 10134446, {
            seg: 10,
            m: 0.8,
            r: 0.3,
          });
          n.cyl(e, -0.45, 1.25, 0.3, 0.3, 3816772, {
            seg: 10,
          });
        }
        n.box(0, 0.6, 1, 2.5, 0.25, 0.1, SUIT_YELLOW, {
          ao: false,
        });
        for (let r of [-1.35, 1.35]) {
          n.box(r, 0.7, 0, 0.5, 0.6, 0.8, t, {
            r: 0.4,
          });
          n.box(r, 0.1, -0.2, 0.4, 0.7, 0.4, e, {
            r: 0.4,
          });
        }
      }),
    );
    let r = () => {
      let r = new Group();
      r.add(
        n((n) => {
          n.box(0, -0.6, 0, 0.7, 1.3, 0.8, t, {
            r: 0.45,
          });
          n.box(0, -1.9, 0.1, 0.6, 1.3, 0.7, e, {
            r: 0.4,
            m: 0.3,
          });
          n.box(0, -2.65, -0.2, 1, 0.35, 1.5, 3816772, {
            r: 0.6,
            m: 0.4,
          });
        }),
      );
      return r;
    };
    this.legL = r();
    this.legL.position.set(-0.75, 2.85, 0);
    this.group.add(this.legL);
    this.legR = r();
    this.legR.position.set(0.75, 2.85, 0);
    this.group.add(this.legR);
    let i = new BrickBuilder();
    for (let e of [-0.8, 0.8]) {
      i.cyl(e, 2.55, 1.25, 0.26, 0.2, 16752704, {
        seg: 10,
        e: 1,
        ao: false,
      });
    }
    this.flameMat = glowMaterial(0);
    this.torso.add(new Mesh(i.build(), this.flameMat));
    this.torso.children[1].position.y = -3.1;
  }
  fixedUpdate(e, t) {
    let n = this.body;
    let r = n.translation();
    let i = n.linvel();
    this.preVy = i.y;
    let a = this.game.physics.ray(r.x, r.y, r.z, 0, -1, 0, 60, RAY_GROUND, n, false);
    let o = a ? r.y - a.toi : -50;
    let s = r.y - o;
    let c = this.hh + this.foot;
    let l = this.grounded;
    this.grounded = s < c + 0.35 && i.y <= 1.5;
    this.groundCollider = a ? a.collider : null;
    this.groundY = o;
    let u = i.y;
    let d = 0;
    let f = 0;
    let p = 0;
    if (t && t.moveMag > 0.1) {
      let e = this.game.camera.yaw;
      d = forwardX(e) * t.moveY + rightX(e) * t.moveX;
      f = forwardZ(e) * t.moveY + rightZ(e) * t.moveX;
      p = Math.min(1, t.moveMag);
      let n = Math.hypot(d, f) || 1;
      d /= n;
      f /= n;
    }
    this.jetting = !!(t && t.action && this.fuel > 0.02 && !this.stomping);
    if (this.grounded) {
      let t = c - s;
      if (!this.jetting) {
        u = t * 12;
      }
      this.fuel = Math.min(1, this.fuel + e * 0.7);
      this.stomping = false;
    }
    if (this.jetting) {
      this.fuel = Math.max(0, this.fuel - e * 0.14);
      let t = clampNum((o + 20 - r.y) / 5, 0, 1);
      u = Math.min(u + (46 * t + 4) * e, 11 * t + 1);
    } else {
      if (!this.grounded) {
        u += 0;
      }
    }
    if (t && t.altPressed && !this.stomping) {
      if (!this.grounded && s > c + 0.4) {
        this.stomping = true;
        this.game.audio.play('sfx.whoosh', {
          pos: this.curr,
          rate: 0.7,
        });
      } else {
        if (this.grounded && !(this.pendingStomp > 0)) {
          u = 11;
          this.grounded = false;
          this.pendingStomp = 0.32;
          this.game.audio.play('sfx.jet', {
            pos: this.curr,
            volume: 0.4,
          });
        }
      }
    }
    if (this.pendingStomp > 0) {
      this.pendingStomp -= e;
      if (this.pendingStomp <= 0) {
        this.stomping = true;
        this.game.audio.play('sfx.whoosh', {
          pos: this.curr,
          rate: 0.7,
        });
      }
    }
    if (this.stomping) {
      u = Math.min(u, -34);
    }
    let m = !this.grounded;
    let h = m ? 13 : 7.5;
    let g = d * h * p;
    let _ = f * h * p;
    let v = m ? 3.5 : 10;
    let y = damp(i.x, g, v, e);
    let b = damp(i.z, _, v, e);
    n.setLinvel(
      {
        x: y,
        y: u,
        z: b,
      },
      true,
    );
    if (p > 0.1) {
      this.yaw = dampAngle(this.yaw, Math.atan2(-d, -f), m ? 5 : 9, e);
    }
    n.setRotation(yawQuat(this.yaw), true);
    n.setAngvel(
      {
        x: 0,
        y: 0,
        z: 0,
      },
      true,
    );
    this.speed = Math.hypot(y, b);
    this.vf = this.speed;
    if (!this.grounded) {
      this.airPeak = Math.max(this.airPeak, s);
    }
    this.justLanded = !l && this.grounded;
  }
  afterStep(e) {
    let t = this.body.translation();
    Object.assign(this.prev, this.curr);
    this.curr.x = t.x;
    this.curr.y = t.y;
    this.curr.z = t.z;
    this.curr.yaw = this.yaw;
    let n = this.game;
    if (this.justLanded) {
      let e = -(this.preVy ?? 0);
      let t = e > 25;
      if (t || e > 15) {
        this.land(t, e);
      }
      this.airPeak = 0;
      this.justLanded = false;
      this.stomping = false;
    }
    let r = this.speed;
    if (r > 0.5 || !this.grounded) {
      n.props.sweep(this.obb(0.4), this.curr.y - this.hh - this.foot, Math.max(r, 3), this);
    }
  }
  land(e, t) {
    let n = this.game;
    let r = this.curr.x;
    let i = this.curr.z;
    let a = this.curr.y - this.hh - this.foot;
    let o = e ? 5.5 : 3.5;
    n.camera.shake(e ? 1 : 0.4);
    n.fx.dust(r, a, i, e ? 30 : 12, 3);
    n.fx.shockwave(r, a, i, e ? 14 : 6, 0.5);
    n.audio.play(e ? 'sfx.stomp' : 'sfx.thud', {
      pos: this.curr,
    });
    n.rumble(e ? 1 : 0.4, 200);
    for (let t of n.buildings.list) {
      if (!t.alive) {
        continue;
      }
      let s = t.box;
      let c = Math.max(s.minX - r, 0, r - s.maxX);
      let l = Math.max(s.minZ - i, 0, i - s.maxZ);
      let u = Math.hypot(c, l);
      let d = u < 0.01 && Math.abs(a - s.y1) < 1.5;
      if (u > o + 3 || a < s.y0 - 2) {
        continue;
      }
      let f = 0;
      f = e ? (d ? 400 : u < o ? 170 : 60) : d ? 60 : u < o ? 25 : 0;
      if (f > 0) {
        t.damage(f, clampNum(r, s.minX, s.maxX), Math.min(a, s.y1), clampNum(i, s.minZ, s.maxZ), 0, 0, 'jbomb');
        n.hud.popup(Math.round(f), [r, a + 2, i], f > 150 ? 'big' : '');
      }
    }
    n.blastAt(r, a, i, e ? 7 : 3.5, e ? 120 : 30, 'stomp', this);
    n.bricks.blast(r, a, i, e ? 12 : 6, e ? 4 : 1.5);
  }
  render(e, t) {
    let n = this.prev;
    let r = this.curr;
    let i = n.x + (r.x - n.x) * e;
    let a = n.y + (r.y - n.y) * e;
    let o = n.z + (r.z - n.z) * e;
    this.group.position.set(i, a - this.hh - this.foot, o);
    this.group.rotation.set(this.grounded ? 0 : clampNum(-this.speed * 0.02, -0.25, 0), this.yaw, 0, 'YXZ');
    let s = this.grounded ? clampNum(this.speed / 7, 0, 1) : 0;
    this.phase += t * (3 + this.speed * 0.9);
    let c = Math.sin(this.phase) * 0.55 * s;
    this.legL.rotation.x = this.grounded ? c : 0.35;
    this.legR.rotation.x = this.grounded ? -c : 0.15;
    this.torso.position.y = 3.1 + Math.abs(Math.cos(this.phase)) * 0.12 * s + (this.stomping ? -0.2 : 0);
    this.flameMat.glow.value = this.jetting ? 7 + Math.random() * 3 : 0;
    if (this.jetting) {
      let e = Math.cos(this.yaw);
      let t = Math.sin(this.yaw);
      for (let n of [-0.8, 0.8]) {
        let r = i + n * e + 1.25 * t;
        let s = o - n * t + 1.25 * e;
        this.game.fx.jet(r, a - this.hh - this.foot + 2.4, s);
      }
    }
    let l = this.groundY;
    this.shadow.position.set(i, l + 0.06, o);
    this.shadow.userData.op.value = clampNum(0.55 - (a - l) * 0.02, 0.12, 0.55);
    this.jetLoop.set(this.jetting ? 0.8 : 0, 1 + (1 - this.fuel) * 0.2, this.curr);
    this.jetLoop.update();
    this.stepT += t * this.speed * s;
    if (this.grounded && this.stepT > 3.4) {
      this.stepT = 0;
      this.game.audio.play('sfx.mech_step', {
        pos: this.curr,
        volume: 0.6,
        detune: 0.1,
      });
      this.game.camera.shake(0.06);
    }
  }
  setDriven(e) {
    this.driven = e;
  }
  exitSpot() {
    for (let [e, t] of [
      [-2.4, 0],
      [2.4, 0],
      [0, 2.4],
      [0, -2.4],
    ]) {
      let n = Math.cos(this.yaw);
      let r = Math.sin(this.yaw);
      let i = this.curr.x + e * n + t * r;
      let a = this.curr.z - e * r + t * n;
      let o = this.game.world.groundY(i, a, this.curr.y);
      if (
        !(Math.abs(o - this.groundY) > 1.6) &&
        this.game.physics.spotFree(i, o + 1.1, a, 0.45, 0.85, 0.45, RAY_BODIES)
      ) {
        return {
          x: i,
          y: o,
          z: a,
        };
      }
    }
    return null;
  }
  dispose() {
    this.game.scene.remove(this.group);
    this.game.scene.remove(this.shadow);
    this.jetLoop.stop();
    this.game.physics.removeBody(this.body);
  }
}
let objectiveMat = null;
const objectiveMaterial = () => (objectiveMat ||= brickMaterial());
const COMPLETION_WEIGHTS = {
  buildings: 30,
  rdus: 30,
  survivors: 15,
  comms: 10,
  scientists: 10,
  secrets: 5,
};
function medalFor(e) {
  if (!e.pathClear) {
    return 'none';
  }
  let t = e.percent;
  return t >= 100 ? (e.time <= 660 ? 'platinum' : 'gold') : t >= 70 ? 'silver' : 'bronze';
}
class Objectives {
  constructor(e, t, n, r) {
    this.game = e;
    this.scene = t;
    this.totals = {
      buildings: n.BUILDINGS.length,
      rdus: 0,
      survivors: n.BUILDINGS.filter((e) => e.survivor).length,
      comms: n.COMMS.length,
      scientists: 1,
      secrets: 1,
    };
    this.got = {
      buildings: 0,
      rdus: 0,
      survivors: 0,
      comms: 0,
      scientists: 0,
      secrets: 0,
    };
    this.damage = 0;
    this.propsSmashed = 0;
    this.group = new Group();
    t.add(this.group);
    let i = n.rduPositions();
    for (let e = 0; e < r.length && i.length < 100; e += 2) {
      let [t, a] = r[e];
      i.push([n.MAZE.x0 + n.MAZE.cell * (a + 0.5) + 2.2, -6, n.MAZE.z0 + n.MAZE.cell * (t + 0.5) + 2.2]);
    }
    for (; i.length < 100; ) {
      let [e, t] = r[r.length - 1 - (i.length % 3)];
      i.push([n.MAZE.x0 + n.MAZE.cell * (t + 0.5) - 2.5, -6, n.MAZE.z0 + n.MAZE.cell * (e + 0.5) - 2.5]);
    }
    for (let e of i) {
      for (let t of n.BUILDINGS) {
        let n = t.x - t.w / 2 - 1.6;
        let r = t.x + t.w / 2 + 1.6;
        let i = t.z - t.d / 2 - 1.6;
        let a = t.z + t.d / 2 + 1.6;
        if (e[0] > n && e[0] < r && e[2] > i && e[2] < a && Math.abs((t.y || 0) - e[1]) < 3) {
          let t = [
            [n - e[0], 0],
            [r - e[0], 0],
            [0, i - e[2]],
            [0, a - e[2]],
          ].sort((e, t) => Math.hypot(...e) - Math.hypot(...t));
          e[0] += t[0][0];
          e[2] += t[0][1];
        }
      }
    }
    this.rdus = i.map(([e, t, n]) => ({
      x: e,
      y: t,
      z: n,
      lit: false,
    }));
    this.totals.rdus = this.rdus.length;
    let a = new BrickBuilder();
    a.box(0, 0.12, 0, 0.9, 0.24, 0.9, 3816772, {
      bevel: 0.05,
      r: 0.5,
    });
    a.cyl(0, 0.55, 0, 0.14, 0.7, 10133672, {
      seg: 6,
      m: 0.8,
      r: 0.3,
    });
    a.cyl(0, 1.05, 0, 0.32, 0.36, 8257354, {
      seg: 8,
      r: 0.2,
      e: 1,
    });
    this.glowAttr = new InstancedBufferAttribute(new Float32Array(this.rdus.length), 1);
    this.rduMesh = new InstancedMesh(a.build(), pulseMaterial(this.glowAttr), this.rdus.length);
    this.rduMesh.castShadow = true;
    let o = new Matrix4();
    this.rdus.forEach((e, t) => {
      o.makeTranslation(e.x, e.y, e.z);
      this.rduMesh.setMatrixAt(t, o);
      this.glowAttr.array[t] = 0.02;
      this.rduMesh.setColorAt(t, new Color(7829367));
    });
    this.rduMesh.computeBoundingSphere();
    this.group.add(this.rduMesh);
    this.streak = 0;
    this.streakT = 0;
    this.comms = n.COMMS.map((e) => this._makeComm(e));
    let s = n.SCIENTIST;
    let c = buildFigure({
      suit: 15921902,
      coat: 15921902,
      pants: 3820138,
      head: 15843965,
      hat: 7031338,
      visor: false,
    });
    c.root.position.set(s.x, s.y, s.z);
    c.root.rotation.y = -Math.PI * 0.75;
    this.group.add(c.root);
    let l = new BrickBuilder();
    l.cyl(0, 0.08, 0, 1.6, 0.16, 16761370, {
      seg: 12,
      e: 0.6,
    });
    let u = new Mesh(l.build(), objectiveMaterial());
    u.position.set(s.x, s.y, s.z);
    this.group.add(u);
    this.scientist = {
      ...s,
      fig: c,
      pad: u,
      found: false,
      t: 0,
    };
    this.survivors = [];
    this.choppers = [];
    this.chopperGeo = this._chopperGeo();
    this.finish = this._makeTruck(n.FINISH);
  }
  _makeComm(e) {
    let t = new BrickBuilder();
    t.box(0, 0.4, 0, 2.4, 0.8, 2.4, 5595243, {
      studs: true,
      r: 0.5,
    });
    t.cyl(0, 1.6, 0, 0.25, 1.8, 10133672, {
      seg: 8,
      m: 0.8,
    });
    let n = new Mesh(t.build(), objectiveMaterial());
    n.castShadow = true;
    let r = new BrickBuilder();
    r.cyl(0, 0, 0, 1.6, 0.25, 15921902, {
      seg: 14,
      r2: 1.2,
      r: 0.3,
      m: 0.2,
    });
    r.cyl(0, 0.6, 0, 0.08, 1.2, 5595243, {
      seg: 6,
    });
    r.box(0, 1.25, 0, 0.3, 0.3, 0.3, 14168619, {
      ao: false,
    });
    let i = new Mesh(r.build(), objectiveMaterial());
    i.castShadow = true;
    let a = new Group();
    a.position.y = 2.7;
    a.rotation.x = -0.6;
    a.add(i);
    let o = new BrickBuilder();
    o.box(0, 0.95, 1.25, 0.4, 0.4, 0.1, 16777215, {
      e: 1,
      ao: false,
    });
    let s = glowMaterial(3);
    let c = new Mesh(o.build(), s);
    let l = new Group();
    l.add(n, a, c);
    l.position.set(e.x, e.y, e.z);
    this.group.add(l);
    s.tint.value.set(16724000);
    return {
      ...e,
      grp: l,
      pivot: a,
      light: c,
      lmat: s,
      active: false,
      spin: 0,
    };
  }
  _makeTruck(e) {
    let t = new BrickBuilder();
    let n = 16761370;
    t.box(0, 1, 0, 2.8, 0.6, 9.6, 2895928, {
      r: 0.6,
    });
    t.box(0, 2.3, -3.6, 3, 2.2, 2.4, n, {
      studs: true,
    });
    t.box(0, 2.7, -4.82, 2.6, 0.8, 0.08, 1914192, {
      r: 0.05,
      ao: false,
    });
    t.box(0, 2.7, 1.3, 3.2, 3, 6.6, 15921902, {
      studs: true,
      r: 0.35,
    });
    for (let e = 0; e < 6; e++) {
      t.box(1.62, 1.6, -1.4 + e * 1.1, 0.05, 0.6, 0.55, e % 2 ? 1842210 : n, {
        ao: false,
      });
    }
    for (let e = 0; e < 6; e++) {
      t.box(-1.62, 1.6, -1.4 + e * 1.1, 0.05, 0.6, 0.55, e % 2 ? 1842210 : n, {
        ao: false,
      });
    }
    t.box(1.63, 3.1, 1.3, 0.04, 1.2, 4.4, 1842210, {
      ao: false,
    });
    t.box(1.66, 3.1, 1.3, 0.04, 0.8, 4, n, {
      ao: false,
      e: 0.4,
    });
    for (let [e, n] of [
      [-1.3, -3.4],
      [1.3, -3.4],
      [-1.3, 2.4],
      [1.3, 2.4],
      [-1.3, 3.9],
      [1.3, 3.9],
    ]) {
      t.cyl(e, 0.6, n, 0.6, 0.5, 2040102, {
        axis: 'x',
        seg: 10,
      });
    }
    let r = new Mesh(t.build(), objectiveMaterial());
    r.castShadow = true;
    r.receiveShadow = true;
    let i = new BrickBuilder();
    i.cyl(0, 0, 0, 0.9, 30, 6750054, {
      seg: 10,
      e: 1,
      ao: false,
      noTop: true,
      noBottom: true,
    });
    let a = new MeshBasicNodeMaterial({
      color: new Color(0.6, 3, 0.8),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: 2,
    });
    let o = new Mesh(i.build(), a);
    o.position.set(0, 15, 6);
    o.visible = false;
    let s = new Group();
    s.add(r, o);
    s.position.set(e.x, e.y, e.z);
    s.rotation.y = e.yaw;
    this.group.add(s);
    e.x + Math.sin(e.yaw) * 6 * 0;
    e.z;
    return {
      ...e,
      grp: s,
      beam: o,
      active: false,
      zone: {
        x: e.x - 6 * Math.sin(e.yaw + Math.PI) * 0,
        z: e.z,
      },
    };
  }
  _chopperGeo() {
    let e = new BrickBuilder();
    e.box(0, 0, 0, 2.2, 1.8, 4, 16761370, {
      r: 0.35,
      studs: true,
    });
    e.box(0, 0.2, -1.9, 1.8, 1.2, 0.5, 1914192, {
      r: 0.05,
      m: 0.3,
      ao: false,
    });
    e.box(0, 0.3, 4.2, 0.5, 0.5, 4.8, 16761370, {
      r: 0.4,
    });
    e.box(0, 1, 6.4, 0.2, 1.6, 0.9, 1842210, {
      ao: false,
    });
    for (let t of [-1.1, 1.1]) {
      e.box(t, -1.4, 0, 0.14, 0.14, 4.4, 3816772, {
        ao: false,
      });
      e.box(t, -1.1, -1, 0.1, 0.6, 0.1, 3816772, {
        ao: false,
      });
      e.box(t, -1.1, 1, 0.1, 0.6, 0.1, 3816772, {
        ao: false,
      });
    }
    e.cyl(0, 1.2, 0, 0.2, 0.6, 3816772, {
      seg: 6,
    });
    let t = e.build();
    let n = new BrickBuilder();
    n.box(0, 0, 0, 10, 0.1, 0.5, 1842210, {
      ao: false,
    });
    n.box(0, 0, 0, 0.5, 0.1, 10, 1842210, {
      ao: false,
    });
    return {
      body: t,
      rotor: n.build(),
    };
  }
  addDamage(e) {
    this.damage += e;
  }
  propSmashed() {
    this.propsSmashed++;
  }
  spawnSurvivor(e) {
    let t = this.game;
    let n = Math.random() < 0.5 ? 1 : -1;
    let r = e.cx + n * ((e.box.maxX - e.box.minX) / 2 + 1);
    let i = e.box.maxZ + 1.5;
    let a = [14168619, 3108822, 3116874, 9064406, 16747008];
    let o = buildFigure({
      suit: a[this.survivors.length % a.length],
      pants: 3816772,
      hat: null,
      visor: false,
      head: [15843965, 13010498, 9262372, 14724201][this.survivors.length % 4],
    });
    o.root.position.set(e.cx, e.baseY, e.cz);
    this.group.add(o.root);
    let s = {
      fig: o,
      x: e.cx,
      y: e.baseY,
      z: e.cz,
      tx: r + n * 4,
      tz: i + 4,
      state: 'run',
      t: 0,
      name: e.name,
    };
    this.survivors.push(s);
    t.hud.toast('A survivor escaped from ' + e.name + '!', 'good');
    this._callChopper(s);
  }
  _callChopper(e) {
    let t = new Group();
    let n = new Mesh(this.chopperGeo.body, objectiveMaterial());
    n.castShadow = true;
    let r = new Mesh(this.chopperGeo.rotor, objectiveMaterial());
    r.position.y = 1.55;
    let i = new Mesh(this.chopperGeo.rotor, objectiveMaterial());
    i.position.set(0.3, 1, 6.4);
    i.scale.set(0.25, 1, 0.25);
    i.rotation.z = Math.PI / 2;
    t.add(n, r, i);
    let a = Math.random() * Math.PI * 2;
    t.position.set(e.tx + Math.cos(a) * 160, 40, e.tz + Math.sin(a) * 160);
    this.group.add(t);
    let o = this.game.audio.loop('sfx.chopper', {
      ref: 40,
      max: 200,
    });
    this.choppers.push({
      grp: t,
      rotor: r,
      tail: i,
      s: e,
      state: 'in',
      t: 0,
      loop: o,
      from: t.position.clone(),
    });
  }
  fixedUpdate(e) {
    let t = this.game;
    let n = t.controlled;
    if (!n || !n.curr) {
      return;
    }
    let r = n.groundPos || {
      x: n.curr.x,
      y: n.curr.y,
      z: n.curr.z,
    };
    this.streakT -= e;
    if (this.streakT <= 0) {
      this.streak = 0;
    }
    let i = n.isTrain ? 4.2 : n.kind === 'jbomb' ? 4.8 : 4.4;
    for (let e = 0; e < this.rdus.length; e++) {
      let n = this.rdus[e];
      if (n.lit) {
        continue;
      }
      let a = n.x - r.x;
      let o = n.z - r.z;
      if (a * a + o * o < i * i && Math.abs(n.y - r.y) < 4.5) {
        n.lit = true;
        this.got.rdus++;
        this.glowAttr.array[e] = 1;
        this.glowAttr.needsUpdate = true;
        this.rduMesh.setColorAt(e, new Color(16777215));
        this.rduMesh.instanceColor.needsUpdate = true;
        this.streak = Math.min(this.streak + 1, 14);
        this.streakT = 1.6;
        t.audio.play('sfx.rdu', {
          rate: 1 + this.streak * 0.045,
          volume: 0.8,
        });
        t.fx.sparkle(n.x, n.y + 1.2, n.z, [2, 6, 1.2], 10, 3);
        t.hud.rduPulse(this.got.rdus, this.totals.rdus);
        if (this.got.rdus === this.totals.rdus) {
          t.hud.banner('ALL RDUs ACTIVE', 'Radiation dispersal network online', 'good');
          t.audio.play('sfx.fanfare_small');
        }
      }
    }
    for (let e of this.comms) {
      if (!e.active) {
        if (Math.hypot(e.x - r.x, e.z - r.z) < 5 && Math.abs(e.y - r.y) < 3.5) {
          e.active = true;
          this.got.comms++;
          e.lmat.tint.value.set(3211104);
          t.audio.play('sfx.comm');
          t.fx.sparkle(e.x, e.y + 3, e.z, [1.5, 3, 6], 30, 6);
          t.hud.banner('COMMUNICATION POINT', `${e.name} online  (${this.got.comms}/${this.totals.comms})`, 'info');
        }
      }
    }
    let a = this.scientist;
    if (!a.found && Math.hypot(a.x - r.x, a.z - r.z) < 4.2 && Math.abs(a.y - r.y) < 3) {
      a.found = true;
      a.t = 0;
      this.got.scientists++;
      t.audio.play('sfx.fanfare');
      t.hud.banner('SCIENTIST FOUND!', 'One of the six elite scientists is safe (1/1 in Argent Towers)', 'gold');
      t.fx.confetti(a.x, a.y + 2, a.z, 60);
    }
    let o = this.finish;
    if (o.active) {
      let e = Math.hypot(o.x - r.x, o.z - r.z);
      this.nearFinish = e < 9 && Math.abs(r.y - o.y) < 3;
    } else {
      this.nearFinish = false;
    }
    for (let t of this.survivors) {
      t.t += e;
      if (t.state === 'run') {
        let n = t.tx - t.x;
        let r = t.tz - t.z;
        let i = Math.hypot(n, r);
        if (i < 0.3 || t.t > 3) {
          t.state = 'wave';
        } else {
          t.x += (n / i) * 5 * e;
          t.z += (r / i) * 5 * e;
          t.yaw = Math.atan2(-n, -r);
        }
      }
    }
    for (let n = this.choppers.length - 1; n >= 0; n--) {
      let r = this.choppers[n];
      let i = r.s;
      r.t += e;
      let a = r.grp.position;
      if (r.hoverY === undefined) {
        r.hoverY = i.y + 9;
      }
      let o = r.hoverY;
      if (r.state === 'in') {
        let t = i.x;
        let n = i.z;
        let s = t - a.x;
        let c = n - a.z;
        let l = Math.hypot(s, c);
        let u = Math.min(38, l * 1.2 + 4);
        if (l > 0.5) {
          a.x += (s / l) * u * e;
          a.z += (c / l) * u * e;
          r.grp.rotation.y = Math.atan2(-s, -c);
        }
        a.y += (Math.max(o, l > 30 ? 30 : o) - a.y) * Math.min(1, e * 1.5);
        r.grp.rotation.x = -clampNum(u / 80, 0, 0.3);
        if (l < 1.5 && Math.abs(a.y - o) < 1.2 && i.state === 'wave') {
          r.state = 'lift';
          r.t = 0;
        }
      } else {
        if (r.state === 'lift') {
          r.grp.rotation.x *= 0.9;
          i.y += e * 4;
          i.x += (a.x - i.x) * e * 3;
          i.z += (a.z - i.z) * e * 3;
          if (i.y > o - 1.5) {
            i.state = 'gone';
            this.group.remove(i.fig.root);
            this.got.survivors++;
            t.audio.play('sfx.survivor');
            t.hud.toast(`Survivor rescued! (${this.got.survivors}/${this.totals.survivors})`, 'good');
            r.state = 'out';
            r.t = 0;
          }
        } else {
          if (r.state === 'out') {
            a.y += e * 10;
            a.x += (a.x - r.from.x > 0 ? 1 : -1) * e * 30;
            a.z += e * -20;
            r.grp.rotation.x = -0.25;
            if (r.t > 7) {
              this.group.remove(r.grp);
              r.loop.stop();
              this.choppers.splice(n, 1);
            }
          }
        }
      }
    }
  }
  render(e, t, n) {
    for (let e of this.comms) {
      e.spin += t * (e.active ? 1.5 : 0.15);
      e.pivot.rotation.y = e.spin;
      e.lmat.glow.value = e.active ? 6 : Math.sin(n * 4) > 0 ? 3 : 0.3;
    }
    let r = this.scientist;
    if (r.found) {
      if (r.fig.root.visible) {
        r.t += t;
        r.fig.root.position.y = r.y + r.t * 6;
        r.fig.root.rotation.y += t * 10;
        if (Math.random() < 0.6) {
          this.game.fx.sparkle(r.x, r.y + r.t * 6, r.z, [4, 4, 1], 2, 2);
        }
        if (r.t > 2) {
          r.fig.root.visible = false;
        }
      }
    } else {
      animateFigure(r.fig, n * 2, 0, n);
    }
    for (let e of this.survivors) {
      if (e.state !== 'gone') {
        e.fig.root.position.set(e.x, e.y, e.z);
        if (e.yaw !== undefined) {
          e.fig.root.rotation.y = e.yaw;
        }
        animateFigure(e.fig, n * 12, +(e.state === 'run'), e.state === 'run' ? 0 : n + e.x);
      }
    }
    for (let e of this.choppers) {
      e.rotor.rotation.y += t * 30;
      e.tail.rotation.x += t * 40;
      e.loop.set(0.7, 1, e.grp.position);
      e.loop.update();
    }
    let i = this.finish;
    i.beam.visible = i.active;
    if (i.active) {
      i.beam.material.opacity = 0.25 + Math.sin(n * 4) * 0.1;
    }
  }
  get percent() {
    let e = 0;
    for (let t in COMPLETION_WEIGHTS) {
      e += COMPLETION_WEIGHTS[t] * (this.totals[t] ? this.got[t] / this.totals[t] : 1);
    }
    return Math.floor(e + 0.000001);
  }
  stats() {
    let e = this.game;
    return {
      buildings: [this.got.buildings, this.totals.buildings],
      rdus: [this.got.rdus, this.totals.rdus],
      survivors: [this.got.survivors, this.totals.survivors],
      comms: [this.got.comms, this.totals.comms],
      scientists: [this.got.scientists, this.totals.scientists],
      secrets: [this.got.secrets, this.totals.secrets],
      damage: this.damage,
      time: e.levelTime,
      pathClear: e.pathClear,
      pathTime: e.pathClearTime,
      percent: this.percent,
      relaxed: e.settings.carrierSpeed === 'relaxed',
    };
  }
  dispose() {
    this.scene.remove(this.group);
    for (let e of this.choppers) {
      e.loop.stop();
    }
  }
}
const SAVE_KEY = 'brickblast.argent.v1';
const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.55,
  sfx: 0.9,
  mute: false,
  quality: 'auto',
  diag: false,
  touch: 'auto',
  scheme: 'direct',
  autocam: true,
  shake: true,
  hints: true,
  minimap: true,
  carrierSpeed: 'standard',
  slideAssist: true,
};
const MEDAL_RANK = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};
class SaveData {
  constructor() {
    this.data = {
      settings: {
        ...DEFAULT_SETTINGS,
      },
      records: {
        medal: 'none',
        bestPercent: 0,
        bestTime100: null,
        bestPathTime: null,
        bestDamage: 0,
        plays: 0,
        clears: 0,
      },
    };
    try {
      let e = localStorage.getItem(SAVE_KEY);
      if (e) {
        let t = JSON.parse(e);
        Object.assign(this.data.settings, t.settings || {});
        Object.assign(this.data.records, t.records || {});
      }
    } catch {}
  }
  get settings() {
    return this.data.settings;
  }
  get records() {
    return this.data.records;
  }
  write() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {}
  }
  recordRun(e, t) {
    let n = this.records;
    let r = [];
    n.plays++;
    if (e.pathClear) {
      n.clears++;
    }
    if (MEDAL_RANK[t] > MEDAL_RANK[n.medal]) {
      n.medal = t;
      r.push('medal');
    }
    if (e.percent > n.bestPercent) {
      n.bestPercent = e.percent;
      r.push('percent');
    }
    if (e.percent >= 100 && (n.bestTime100 === null || e.time < n.bestTime100)) {
      n.bestTime100 = e.time;
      r.push('time100');
    }
    if (e.pathClear && e.pathTime !== null && (n.bestPathTime === null || e.pathTime < n.bestPathTime)) {
      n.bestPathTime = e.pathTime;
      r.push('pathTime');
    }
    if (e.damage > n.bestDamage) {
      n.bestDamage = e.damage;
      r.push('damage');
    }
    this.write();
    return r;
  }
  resetRecords() {
    this.data.records = {
      medal: 'none',
      bestPercent: 0,
      bestTime100: null,
      bestPathTime: null,
      bestDamage: 0,
      plays: 0,
      clears: 0,
    };
    this.write();
  }
}
const _vEuler = new Euler();
const _vQuat = new Quaternion();
class Car {
  constructor(e, t, n, r, i, a) {
    this.game = e;
    this.spec = t;
    this.kind = t.kind;
    this.name = t.name;
    this.isVehicle = true;
    this.isCar = true;
    this.rideHeight = t.hh + t.clearance;
    let o = e.physics.R;
    let s = e.physics.world;
    let c = o.RigidBodyDesc.dynamic()
      .setTranslation(n, r + this.rideHeight + 0.05, i)
      .setRotation(yawQuat(a))
      .setLinearDamping(0.02)
      .setAngularDamping(1.5)
      .setCcdEnabled(true)
      .setCanSleep(false);
    this.body = s.createRigidBody(c);
    this.body.setEnabledRotations(false, true, false, true);
    let l = o.ColliderDesc.cuboid(t.hw, t.hh, t.hl)
      .setDensity(t.density ?? 2)
      .setFriction(0.15)
      .setRestitution(0.05)
      .setCollisionGroups(COLLIDE.vehicle);
    this.collider = s.createCollider(l, this.body);
    e.physics.colliderOwner.set(this.collider.handle, this);
    this.mass = this.body.mass();
    this.yaw = a;
    this.yawRate = 0;
    this.vf = 0;
    this.vr = 0;
    this.grounded = true;
    this.airTime = 0;
    this.prev = {
      x: n,
      y: r + this.rideHeight,
      z: i,
      yaw: a,
    };
    this.curr = {
      ...this.prev,
    };
    this.pitch = 0;
    this.roll = 0;
    this.bob = 0;
    this.lean = 0;
    this.gF = r;
    this.gB = r;
    this.gL = r;
    this.gR = r;
    this.groundY = r;
    this.steerVis = 0;
    this.wheelSpin = 0;
    this.driven = false;
    this.sliding = false;
    this.slip = 0;
    this.preVel = {
      x: 0,
      y: 0,
      z: 0,
    };
    this.hitCooldown = new Map();
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.group = new Group();
    this.wheels = [];
    this.buildVisual();
    this.shadow = blobShadow(t.hw * 2.6, t.hl * 2.4);
    e.scene.add(this.group);
    e.scene.add(this.shadow);
    this.engine = e.audio.loop(t.engineSound || 'sfx.engine_truck');
    this.skidLoop = e.audio.loop('sfx.skid');
  }
  buildVisual() {}
  special(e, t) {}
  attacks(e) {}
  hudInfo() {
    return null;
  }
  touchLabels() {
    return {
      action: '',
      alt: 'HORN',
    };
  }
  get x() {
    return this.curr.x;
  }
  get y() {
    return this.curr.y;
  }
  get z() {
    return this.curr.z;
  }
  get speed() {
    return Math.abs(this.vf);
  }
  get groundPos() {
    return {
      x: this.curr.x,
      y: this.curr.y - this.rideHeight,
      z: this.curr.z,
    };
  }
  obb(e = 0) {
    return {
      x: this.curr.x,
      z: this.curr.z,
      hw: this.spec.hw + e,
      hl: this.spec.hl + e,
      yaw: this.yaw,
    };
  }
  toWorld(e, t) {
    let n = Math.cos(this.yaw);
    let r = Math.sin(this.yaw);
    return [this.curr.x + e * n + t * r, this.curr.z - e * r + t * n];
  }
  fixedUpdate(e, t) {
    let n = this.spec;
    let r = this.body;
    let i = r.translation();
    let a = r.linvel();
    this.preVel.x = a.x;
    this.preVel.y = a.y;
    this.preVel.z = a.z;
    let o = quatYaw(r.rotation());
    this.yaw = o;
    let s = forwardX(o);
    let c = forwardZ(o);
    let l = rightX(o);
    let u = rightZ(o);
    let d = this.game.physics;
    let f = n.hw * 0.8;
    let p = n.hl * 0.8;
    let m = (e, t) => {
      let n = i.x + l * e * f + s * t * p;
      let a = i.z + u * e * f + c * t * p;
      let o = d.ray(n, i.y + 0.3, a, 0, -1, 0, this.rideHeight + 3, RAY_GROUND, r, false);
      return o ? i.y + 0.3 - o.toi : null;
    };
    let h = m(1, 1);
    let g = m(-1, 1);
    let _ = m(1, -1);
    let v = m(-1, -1);
    let y = [h, g, _, v].filter((e) => e !== null);
    let b = a.y;
    if (y.length) {
      let t = y.reduce((e, t) => e + t, 0) / y.length;
      let n = i.y - t;
      this.grounded = n < this.rideHeight + 0.5;
      if (this.grounded) {
        let r = this.rideHeight - n;
        b += (r * 160 - b * 16) * e - -22 * e;
        if (r > 0.6) {
          b = Math.max(b, r * 6);
        }
        this.groundY = t;
        let i = (e, n) => (e !== null && n !== null ? (e + n) / 2 : (e ?? n ?? t));
        this.gF = i(h, g);
        this.gB = i(_, v);
        this.gR = i(h, _);
        this.gL = i(g, v);
      }
    } else {
      this.grounded = false;
    }
    if (this.grounded) {
      this.airTime = 0;
    } else {
      this.airTime += e;
    }
    let x = 0;
    let S = 0;
    let ee = 0;
    let te = false;
    if (t) {
      if (t.direct && t.moveMag > 0.12) {
        let e = this.game.camera.yaw;
        let n = forwardX(e) * t.moveY + rightX(e) * t.moveX;
        let r = forwardZ(e) * t.moveY + rightZ(e) * t.moveX;
        let i = Math.atan2(-n, -r);
        let a = t.brake > 0.5;
        let s = angleDelta(o, a ? i + Math.PI : i);
        ee = clampNum(-s * 2.4, -1, 1) * (a ? -1 : 1);
        if (a) {
          S = 1;
        } else {
          x = t.moveMag * (Math.abs(s) < 1.6 ? 1 : 0.35);
          S = 0;
        }
      } else {
        x = t.throttle;
        S = t.brake;
        ee = t.steer;
      }
      te = this.wantsSlide ? this.wantsSlide(t, ee) : false;
    }
    this.throttle = x;
    this.brake = S;
    this.steer = ee;
    let ne = a.x * s + a.z * c;
    let re = a.x * l + a.z * u;
    let ie = this.traction ?? 1;
    if (this.grounded) {
      let i = 0;
      let a = n.maxSpeed * (this.speedMul ?? 1);
      if (x > 0.01) {
        i =
          ne < -0.5
            ? n.brakeDecel * x
            : n.accel *
              x *
              Math.max(0, 1 - (Math.max(0, ne) / a) ** 2) *
              (this.sliding ? (n.slideAccelMul ?? 0.45) : 1);
      }
      if (S > 0.01) {
        i -= ne > 0.6 ? n.brakeDecel * S : n.accel * 0.7 * S * Math.max(0, 1 - Math.max(0, -ne) / n.reverseMax);
      }
      ne += i * e * ie;
      if (x < 0.01 && S < 0.01) {
        ne *= Math.max(0, 1 - (t ? (n.rollDrag ?? 0.6) : 3.5) * e);
      }
      this.sliding = te && Math.abs(ne) > 3;
      let o = this.sliding ? n.slideGrip : n.grip * (t ? 1 : 1.5);
      let s = re;
      re *= Math.max(0, 1 - o * e);
      this.slip = Math.abs(s);
      let c = clampNum(Math.abs(ne) / (n.turnRef ?? 5), 0, 1) * Math.sign(ne || 1);
      if (n.pivot && Math.abs(c) < n.pivot) {
        c = n.pivot * (ne < -0.3 ? -1 : 1);
      }
      let l = -ee * n.turnRate * c * (this.sliding ? (n.slideTurnMul ?? 1.9) : 1);
      if (!t) {
        l = 0;
      }
      let u = this.sliding ? (n.slideResp ?? 7) : 10;
      this.yawRate = lerpNum(r.angvel().y, l, 1 - Math.exp(-u * e));
    } else {
      this.yawRate = r.angvel().y * (1 - 0.8 * e) + (t ? -ee * 0.8 * e : 0);
      this.sliding = false;
      this.slip = 0;
    }
    this.tiltP = this.tiltP ?? 0;
    this.tiltR = this.tiltR ?? 0;
    let ae = this.grounded ? Math.atan2(this.gF - this.gB, n.hl * 1.6) : this.tiltP * (1 - 3 * e);
    let oe = this.grounded ? Math.atan2(this.gR - this.gL, n.hw * 1.6) : this.tiltR * (1 - 3 * e);
    this.tiltP += (clampNum(ae, -0.5, 0.5) - this.tiltP) * Math.min(1, 12 * e);
    this.tiltR += (clampNum(oe, -0.4, 0.4) - this.tiltR) * Math.min(1, 12 * e);
    _vEuler.set(this.tiltP, o, this.tiltR, 'YXZ');
    _vQuat.setFromEuler(_vEuler);
    r.setRotation(_vQuat, true);
    this.special(e, t, {
      vf: ne,
      vr: re,
      fx: s,
      fz: c,
      rx: l,
      rz: u,
    });
    if (this.boost) {
      ne += this.boost * e;
    }
    let se = Math.hypot(ne, re);
    let ce = n.maxSpeed * 1.6;
    if (se > ce) {
      ne *= ce / se;
      re *= ce / se;
    }
    r.setLinvel(
      {
        x: s * ne + l * re,
        y: b,
        z: c * ne + u * re,
      },
      true,
    );
    r.setAngvel(
      {
        x: 0,
        y: this.yawRate,
        z: 0,
      },
      true,
    );
    this.vf = ne;
    this.vr = re;
  }
  afterStep(e) {
    let t = this.body.translation();
    this.prev.x = this.curr.x;
    this.prev.y = this.curr.y;
    this.prev.z = this.curr.z;
    this.prev.yaw = this.curr.yaw;
    this.curr.x = t.x;
    this.curr.y = t.y;
    this.curr.z = t.z;
    this.curr.yaw = quatYaw(this.body.rotation());
    this.yaw = this.curr.yaw;
    for (let [t, n] of this.hitCooldown) {
      if (n - e <= 0) {
        this.hitCooldown.delete(t);
      } else {
        this.hitCooldown.set(t, n - e);
      }
    }
    let n = Math.hypot(this.body.linvel().x, this.body.linvel().z);
    if (n > 0.8) {
      this.game.props.sweep(this.obb(0.3), this.curr.y - this.rideHeight, n, this);
    }
    if (this.driven) {
      this.attacks(e);
    }
    if (this.wasAir && this.grounded && this.preVel.y < -8) {
      this.game.camera.shake(0.25);
      this.game.audio.play('sfx.thud', {
        pos: this.curr,
        volume: 0.6,
      });
      this.game.fx.dust(this.curr.x, this.groundY, this.curr.z, 8, 2);
    }
    this.wasAir = !this.grounded;
  }
  hitBuildings(e, t, n, r, i, a, o) {
    let [s, c] = this.toWorld(e, t);
    let l = {
      x: s,
      z: c,
      hw: n,
      hl: r,
      yaw: this.yaw,
    };
    for (let e of this.game.buildings.list) {
      if (!e.alive) {
        continue;
      }
      let t = e.box;
      if (
        !(
          a < t.y0 ||
          i > t.y1 ||
          !obbOverlap(l, {
            x: (t.minX + t.maxX) / 2,
            z: (t.minZ + t.maxZ) / 2,
            hw: (t.maxX - t.minX) / 2,
            hl: (t.maxZ - t.minZ) / 2,
            yaw: 0,
          }) ||
          this.hitCooldown.has(e.id)
        )
      ) {
        if (o(e, e.closest(s, (i + a) / 2, c), s, c) !== false) {
          this.hitCooldown.set(e.id, 0.35);
        }
      }
    }
    return l;
  }
  bumpBack(e = 0.5) {
    let t = this.body.linvel();
    this.body.setLinvel(
      {
        x: -t.x * e,
        y: t.y + 2,
        z: -t.z * e,
      },
      true,
    );
  }
  render(e, t) {
    let n = this.prev;
    let r = this.curr;
    let i = n.x + (r.x - n.x) * e;
    let a = n.y + (r.y - n.y) * e;
    let o = n.z + (r.z - n.z) * e;
    let s = n.yaw + angleDelta(n.yaw, r.yaw) * e;
    let c = this.spec;
    let l = this.grounded ? Math.atan2(this.gF - this.gB, c.hl * 1.6) : this.pitch * 0.98;
    let u = this.grounded ? Math.atan2(this.gR - this.gL, c.hw * 1.6) : this.roll * 0.98;
    let d = clampNum(-this.yawRate * Math.abs(this.vf) * 0.006, -0.12, 0.12) * (c.leanMul ?? 1);
    this.lean = damp(this.lean, d, 6, t);
    this.pitch = damp(this.pitch, l + clampNum(-(this.throttle - this.brake) * 0.02, -0.03, 0.03), 10, t);
    this.roll = damp(this.roll, u, 10, t);
    this.group.position.set(i, a - this.rideHeight, o);
    this.group.rotation.set(this.pitch, s, this.roll + this.lean, 'YXZ');
    this.steerVis = damp(this.steerVis, -this.steer * 0.5, 10, t);
    this.wheelSpin += (this.vf / (c.wheelR || 0.6)) * t;
    for (let e of this.wheels) {
      if (e.pivot) {
        e.pivot.rotation.y = e.steer ? this.steerVis : 0;
      }
      e.mesh.rotation.x = -this.wheelSpin;
    }
    let f = this.grounded ? this.groundY : this.game.world.groundY(i, o, a);
    this.shadow.position.set(i, f + 0.06, o);
    this.shadow.rotation.y = s;
    let p = a - this.rideHeight - f;
    if (this.shadow.material.opacityNode) {
      this.shadow.userData.op.value = clampNum(0.55 - p * 0.05, 0.1, 0.55);
    }
    if (this.renderExtra) {
      this.renderExtra(e, t);
    }
    let m = this.driven ? 0.55 + 0.45 * Math.abs(this.throttle - this.brake * 0.5) : 0.25;
    let h = 0.7 + (Math.abs(this.vf) / c.maxSpeed) * 0.9 + (this.driven ? this.throttle * 0.15 : 0);
    this.engine.set(this.driven ? 0.55 * m : 0, h, this.curr);
    this.engine.update();
    let g = this.grounded ? clampNum((this.slip - 3) / 8, 0, 1) : 0;
    this.skidLoop.set(g * 0.7, 0.9 + g * 0.2, this.curr);
    this.skidLoop.update();
    if (g > 0.05) {
      for (let e of [-1, 1]) {
        let [t, n] = this.toWorld(e * c.hw * 0.8, c.hl * 0.7);
        this.game.skids.add(this.kind + e, t, f, n, 0.7, g);
        if (Math.random() < g * 0.5) {
          this.game.fx.tireSmoke(t, f, n);
        }
      }
    } else {
      this.game.skids.break(this.kind + -1);
      this.game.skids.break(this.kind + 1);
    }
  }
  exitSpot(e = 0) {
    let t = this.spec;
    let n =
      e >= 0
        ? [
            [-1, 0],
            [1, 0],
            [0, 1],
            [0, -1],
          ]
        : [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
    for (let [e, r] of n) {
      let n = e * (t.hw + 1.2);
      let i = r * (t.hl + 1.3);
      let [a, o] = this.toWorld(n, i);
      let s = this.game.world.groundY(a, o, this.curr.y + 1);
      if (
        !(Math.abs(s - (this.curr.y - this.rideHeight)) > 1.6) &&
        this.game.physics.spotFree(a, s + 1.1, o, 0.45, 0.85, 0.45, RAY_BODIES)
      ) {
        return {
          x: a,
          y: s,
          z: o,
        };
      }
    }
    return null;
  }
  setDriven(e) {
    this.driven = e;
    if (!e) {
      this.throttle = 0;
      this.brake = 0;
      this.steer = 0;
    }
  }
  dispose() {
    this.game.scene.remove(this.group);
    this.game.scene.remove(this.shadow);
    this.engine.stop();
    this.skidLoop.stop();
    this.game.physics.removeBody(this.body);
  }
}
function addWheel(e, t, n, r, i, a, o = false) {
  let s = new Group();
  s.position.set(r, i, a);
  let c = new Mesh(t, n);
  c.castShadow = true;
  s.add(c);
  e.group.add(s);
  e.wheels.push({
    pivot: s,
    mesh: c,
    steer: o,
  });
}
const C_YELLOW = 16761370;
const C_BLACK = 2040102;
const C_DARK = 2895928;
const C_STEEL = 10134446;
const C_BLUE = 1914192;
const C_RED = 14168619;
const C_WHITE = 15921902;
let vehicleMat = null;
const vehicleMaterial = () => (vehicleMat ||= brickMaterial());
const wheelCache = new Map();
function wheelGeometry(e, t, n = C_YELLOW) {
  let r = e + ':' + t + ':' + n;
  if (wheelCache.has(r)) {
    return wheelCache.get(r);
  }
  let i = new BrickBuilder();
  i.cyl(0, 0, 0, e, t, C_BLACK, {
    axis: 'x',
    seg: 12,
    r: 0.85,
  });
  i.cyl(0, 0, 0, e * 0.55, t + 0.08, n, {
    axis: 'x',
    seg: 8,
    r: 0.35,
    m: 0.4,
  });
  for (let n = 0; n < 6; n++) {
    let r = (n / 6) * Math.PI * 2;
    i.box(0, Math.cos(r) * e * 0.97, Math.sin(r) * e * 0.97, t * 0.9, 0.16, 0.3, 2763306, {
      bevel: 0.03,
      ao: false,
      r: 0.9,
    });
  }
  let a = i.build();
  wheelCache.set(r, a);
  return a;
}
function vehicleMesh(e, t = true) {
  let n = new Mesh(e.build(), vehicleMaterial());
  n.castShadow = t;
  n.receiveShadow = true;
  return n;
}
function hazardStripes(e, t, n, r, i, a, o) {
  let s = (n - t) / o;
  for (let n = 0; n < o; n++) {
    e.box(t + s * (n + 0.5), r, i, s, a, 0.12, n % 2 ? C_BLACK : C_YELLOW, {
      bevel: 0.02,
      ao: false,
    });
  }
}
class Backlash extends Car {
  constructor(e, t, n, r, i) {
    super(
      e,
      {
        kind: 'backlash',
        name: 'Backlash',
        hw: 1.9,
        hh: 1.15,
        hl: 3.9,
        clearance: 0.6,
        density: 2.2,
        maxSpeed: 21,
        accel: 12,
        reverseMax: 8,
        brakeDecel: 22,
        turnRate: 1.5,
        grip: 9,
        slideGrip: 0.8,
        slideTurnMul: 2.5,
        slideAccelMul: 0.5,
        slideResp: 12,
        turnRef: 6,
        wheelR: 0.85,
        engineSound: 'sfx.engine_truck',
        leanMul: 1.4,
      },
      t,
      n,
      r,
      i,
    );
    this.slamPower = 0;
  }
  buildVisual() {
    let e = new BrickBuilder();
    e.box(0, 1.05, 0, 3, 0.7, 7.5, C_DARK, {
      r: 0.6,
      m: 0.3,
    });
    e.box(0, 2.3, -2.75, 3.4, 1.9, 2.3, C_YELLOW, {
      studs: true,
      r: 0.4,
    });
    e.box(0, 2.75, -3.9, 2.8, 0.8, 0.12, C_BLUE, {
      r: 0.05,
      m: 0.3,
      ao: false,
      bevel: 0.03,
    });
    for (let t of [-1.71, 1.71]) {
      e.box(t, 2.75, -2.7, 0.12, 0.8, 1.5, C_BLUE, {
        r: 0.05,
        m: 0.3,
        ao: false,
        bevel: 0.03,
      });
    }
    e.box(0, 1.1, -3.95, 3.6, 0.7, 0.35, C_BLACK, {
      r: 0.5,
    });
    for (let t of [-1.2, 1.2]) {
      e.box(t, 1.55, -3.9, 0.7, 0.35, 0.12, 16774352, {
        e: 2.5,
        ao: false,
      });
    }
    e.box(0, 3.35, -2.1, 1.2, 0.25, 0.4, 16747008, {
      e: 1.2,
      ao: false,
    });
    e.box(0, 2.55, 1.35, 3.9, 1.9, 5.1, C_STEEL, {
      studs: true,
      r: 0.32,
      m: 0.8,
    });
    e.box(0, 3.55, 1.35, 4, 0.2, 5.2, C_YELLOW, {
      r: 0.4,
      ao: false,
    });
    hazardStripes(e, -1.9, 1.9, 2.5, 3.95, 1.6, 8);
    e.box(0, 1.3, 4, 3.8, 0.5, 0.3, C_BLACK, {
      r: 0.5,
    });
    for (let t of [-1.4, 1.4]) {
      e.box(t, 1.35, 4.12, 0.5, 0.3, 0.1, 16722458, {
        e: 2,
        ao: false,
      });
    }
    e.cyl(1.45, 3.6, -1.6, 0.16, 1.6, 5595243, {
      seg: 8,
      m: 0.8,
      r: 0.4,
    });
    this.group.add(vehicleMesh(e));
    let t = wheelGeometry(0.85, 0.7);
    for (let [e, n, r] of [
      [-1.75, -2.6, true],
      [1.75, -2.6, true],
      [-1.75, 1.6, false],
      [1.75, 1.6, false],
      [-1.75, 3.1, false],
      [1.75, 3.1, false],
    ]) {
      addWheel(this, t, vehicleMaterial(), e, 0.85, n, r);
    }
    let n = new BrickBuilder();
    n.box(0, 3.72, 3.9, 3.9, 0.14, 0.2, 16738816, {
      e: 1,
      ao: false,
    });
    this.slamMat = glowMaterial(0);
    this.slamMesh = new Mesh(n.build(), this.slamMat);
    this.group.add(this.slamMesh);
  }
  wantsSlide(e, t) {
    return e.action || (e.brake > 0.5 && Math.abs(t) > 0.35 && this.vf > 7);
  }
  touchLabels() {
    return {
      action: 'SLIDE',
      alt: 'HORN',
    };
  }
  special(e, t) {
    if (t && t.altPressed) {
      this.game.audio.play('sfx.horn', {
        pos: this.curr,
      });
    }
    if (t && this.sliding && this.game.settings.slideAssist !== false) {
      let e = null;
      let t = 9;
      let n = this.curr.x;
      let r = this.curr.z;
      for (let i of this.game.buildings.list) {
        if (!i.alive || i.baseY > 2) {
          continue;
        }
        let a = Math.max(i.box.minX, Math.min(n, i.box.maxX));
        let o = Math.max(i.box.minZ, Math.min(r, i.box.maxZ));
        let s = Math.hypot(a - n, o - r);
        if (s < t) {
          t = s;
          e = [a - n, o - r];
        }
      }
      if (e) {
        let n = Math.atan2(e[0], e[1]) - this.yaw;
        for (; n > Math.PI; ) {
          n -= 2 * Math.PI;
        }
        for (; n < -Math.PI; ) {
          n += 2 * Math.PI;
        }
        if (Math.abs(n) < 2.3) {
          this.yawRate += clampNum(n * 3, -1, 1) * (1 - t / 9);
        }
      }
    }
    let n = 3.2;
    let r = this.yawRate;
    let i = Math.cos(this.yaw);
    let a = n * Math.sin(this.yaw);
    let o = n * i;
    let s = this.body.linvel();
    this.rearSpeed = Math.hypot(s.x + r * o, s.z - r * a);
    let c = (this.sliding || Math.abs(r) > 1) && this.rearSpeed > 5;
    this.slamPower = clampNum(c ? (this.rearSpeed - 4) / 16 : 0, 0, 1);
  }
  attacks() {
    let e = this.spec;
    let t = this.game;
    let n = this.preVel;
    let r = 3.2;
    let i = this.yawRate;
    let a = Math.cos(this.yaw);
    let o = Math.sin(this.yaw);
    let s = Math.hypot(n.x + i * r * a, n.z - i * r * o);
    let c = this.curr.y - this.rideHeight;
    let l = (this.sliding || Math.abs(i) > 0.9) && s > 5;
    this.hitBuildings(0, 2.1, e.hw + 0.55, 2.4, c + 0.3, c + 3.6, (e, n, r, a) => {
      if (!l) {
        return false;
      }
      let o = Math.min(160, (s - 3) * 9.5);
      let c = e.cx - r;
      let u = e.cz - a;
      let d = Math.hypot(c, u) || 1;
      c /= d;
      u /= d;
      e.damage(o, n[0], n[1], n[2], c, u, 'backlash');
      t.fx.sparks(n[0], n[1], n[2], 12);
      t.audio.play('sfx.metal_slam', {
        pos: this.curr,
        detune: 0.15,
      });
      t.hud.popup(Math.round(o), n, o > 80 ? 'big' : '');
      this.body.setAngvel(
        {
          x: 0,
          y: -i * 0.35,
          z: 0,
        },
        true,
      );
      let f = this.body.linvel();
      this.body.setLinvel(
        {
          x: f.x * 0.4 - c * 3,
          y: f.y + 1.5,
          z: f.z * 0.4 - u * 3,
        },
        true,
      );
      t.rumble(0.6, 120);
      if (o > 80) {
        t.hitStop(0.05);
      }
    });
    if (n.x * -o + n.z * -a > 7) {
      this.hitBuildings(0, -e.hl - 0.3, e.hw, 0.6, c + 0.3, c + 3, (e, n) => {
        t.audio.play('sfx.clang', {
          pos: this.curr,
          volume: 0.8,
        });
        t.fx.sparks(n[0], n[1], n[2], 6);
        t.hud.hint('backlash-rear', 'Backlash only smashes with its armoured REAR — power-slide into buildings!');
        this.bumpBack(0.35);
      });
    }
  }
  renderExtra(e, t) {
    this.slamMat.glow.value += (this.slamPower * 7 - this.slamMat.glow.value) * Math.min(1, t * 12);
  }
  hudInfo() {
    return {
      meter: this.slamPower,
      meterLabel: 'SLAM POWER',
      tip: this.sliding ? 'Swing that rear!' : 'Hold SLIDE + steer at speed',
    };
  }
}
class Ramdozer extends Car {
  constructor(e, t, n, r, i) {
    super(
      e,
      {
        kind: 'ramdozer',
        name: 'Ramdozer',
        hw: 1.9,
        hh: 1.1,
        hl: 3.2,
        clearance: 0.45,
        density: 2.6,
        maxSpeed: 13.5,
        accel: 9,
        reverseMax: 6,
        brakeDecel: 20,
        turnRate: 1.6,
        grip: 13,
        slideGrip: 13,
        turnRef: 3,
        wheelR: 0.5,
        pivot: 0.7,
        engineSound: 'sfx.engine_dozer',
        leanMul: 0.5,
      },
      t,
      n,
      r,
      i,
    );
    this.treadT = 0;
  }
  buildVisual() {
    let e = new BrickBuilder();
    for (let t of [-1.55, 1.55]) {
      e.box(t, 0.75, 0.2, 0.9, 1.3, 5.8, C_BLACK, {
        r: 0.9,
        bevel: 0.25,
      });
      e.cyl(t, 0.75, -2.5, 0.55, 0.95, 3816772, {
        axis: 'x',
        seg: 10,
      });
      e.cyl(t, 0.75, 2.9, 0.55, 0.95, 3816772, {
        axis: 'x',
        seg: 10,
      });
    }
    e.box(0, 1.9, 0.6, 2.8, 1.3, 4.4, C_YELLOW, {
      studs: true,
      r: 0.4,
    });
    e.box(0, 1.6, -1.6, 2.6, 0.9, 1.2, C_YELLOW, {
      r: 0.4,
    });
    e.box(0, 3.1, 1.2, 2.4, 0.15, 2.2, C_YELLOW, {
      studs: true,
      r: 0.4,
    });
    for (let [t, n] of [
      [-1.1, 0.2],
      [1.1, 0.2],
      [-1.1, 2.2],
      [1.1, 2.2],
    ]) {
      e.box(t, 2.75, n, 0.18, 0.9, 0.18, C_BLACK, {
        ao: false,
      });
    }
    e.box(0, 2.9, 1.2, 1.9, 0.5, 1.7, C_BLUE, {
      r: 0.05,
      m: 0.3,
      ao: false,
    });
    e.cyl(-0.9, 3.4, -0.4, 0.14, 1.4, 5595243, {
      seg: 8,
      m: 0.7,
    });
    for (let t of [-1.3, 1.3]) {
      e.box(t, 1.2, -2.6, 0.3, 0.4, 2.2, C_DARK, {
        r: 0.5,
        m: 0.5,
      });
    }
    e.box(0, 1.25, -3.65, 4.5, 1.9, 0.5, 9081502, {
      r: 0.35,
      m: 0.85,
      bevel: 0.1,
    });
    e.box(0, 0.35, -3.95, 4.6, 0.25, 0.4, 14211288, {
      r: 0.25,
      m: 0.95,
      ao: false,
    });
    hazardStripes(e, -2.2, 2.2, 2.05, -3.93, 0.3, 10);
    for (let t of [-0.9, 0.9]) {
      e.box(t, 2.2, -2.2, 0.4, 0.3, 0.12, 16774352, {
        e: 2,
        ao: false,
      });
    }
    this.group.add(vehicleMesh(e));
  }
  touchLabels() {
    return {
      action: 'HORN',
      alt: '',
    };
  }
  special(e, t) {
    if (t && (t.actionPressed || t.altPressed)) {
      this.game.audio.play('sfx.horn_low', {
        pos: this.curr,
      });
    }
  }
  attacks() {
    let e = this.spec;
    let t = this.game;
    let n = this.preVel;
    let r = Math.cos(this.yaw);
    let i = Math.sin(this.yaw);
    let a = n.x * -i + n.z * -r;
    let o = this.curr.y - this.rideHeight;
    if (a > 4) {
      this.hitBuildings(0, -e.hl - 0.6, 2.4, 0.9, o, o + 2.6, (e, n, o, s) => {
        let c = (a - 3) * 9;
        e.damage(c, n[0], n[1], n[2], -i, -r, 'ramdozer');
        t.audio.play('sfx.metal_slam', {
          pos: this.curr,
          rate: 0.8,
        });
        t.hud.popup(Math.round(c), n);
        this.bumpBack(0.3);
        t.rumble(0.5, 100);
      });
    }
  }
  hudInfo() {
    return {
      tip: 'Ram buildings, push TNT',
    };
  }
}
class PoliceCar extends Car {
  constructor(e, t, n, r, i) {
    super(
      e,
      {
        kind: 'police',
        name: 'Police Car',
        hw: 1.05,
        hh: 0.62,
        hl: 2.35,
        clearance: 0.3,
        density: 1.2,
        maxSpeed: 27,
        accel: 15,
        reverseMax: 9,
        brakeDecel: 26,
        turnRate: 2.4,
        grip: 11,
        slideGrip: 2,
        turnRef: 5,
        wheelR: 0.45,
        engineSound: 'sfx.engine_car',
      },
      t,
      n,
      r,
      i,
    );
    this.siren = false;
    this.sirenLoop = e.audio.loop('sfx.siren');
  }
  buildVisual() {
    let e = new BrickBuilder();
    e.box(0, 0.7, 0, 2.1, 0.7, 4.6, C_WHITE, {
      r: 0.25,
      m: 0.15,
    });
    e.box(0, 0.72, -0.3, 2.14, 0.3, 1.9, C_BLACK, {
      r: 0.3,
      ao: false,
    });
    e.box(0, 1.35, 0.25, 1.8, 0.62, 2.3, C_WHITE, {
      r: 0.25,
      m: 0.1,
      studs: false,
    });
    e.box(0, 1.35, -0.93, 1.6, 0.5, 0.1, C_BLUE, {
      r: 0.05,
      m: 0.3,
      ao: false,
    });
    e.box(0, 1.35, 1.43, 1.6, 0.5, 0.1, C_BLUE, {
      r: 0.05,
      m: 0.3,
      ao: false,
    });
    for (let t of [-0.91, 0.91]) {
      e.box(t, 1.38, 0.25, 0.1, 0.45, 1.9, C_BLUE, {
        r: 0.05,
        m: 0.3,
        ao: false,
      });
    }
    e.box(0, 0.62, -2.35, 2.1, 0.35, 0.2, 3355443, {
      r: 0.4,
    });
    for (let t of [-0.7, 0.7]) {
      e.box(t, 0.82, -2.33, 0.5, 0.2, 0.1, 16774352, {
        e: 2.5,
        ao: false,
      });
    }
    for (let t of [-0.7, 0.7]) {
      e.box(t, 0.82, 2.33, 0.5, 0.2, 0.1, 16722458, {
        e: 1.5,
        ao: false,
      });
    }
    e.box(0, 0.9, -1.2, 0.6, 0.02, 0.6, 2052008, {
      ao: false,
    });
    this.group.add(vehicleMesh(e));
    let t = new BrickBuilder();
    t.box(-0.45, 1.78, 0.25, 0.8, 0.22, 0.4, 16718362, {
      e: 1,
      ao: false,
    });
    let n = new BrickBuilder();
    n.box(0.45, 1.78, 0.25, 0.8, 0.22, 0.4, 1723135, {
      e: 1,
      ao: false,
    });
    this.redMat = glowMaterial(0.2);
    this.blueMat = glowMaterial(0.2);
    this.group.add(new Mesh(t.build(), this.redMat));
    this.group.add(new Mesh(n.build(), this.blueMat));
    let r = wheelGeometry(0.45, 0.4, 12632256);
    for (let [e, t, n] of [
      [-0.95, -1.45, true],
      [0.95, -1.45, true],
      [-0.95, 1.45, false],
      [0.95, 1.45, false],
    ]) {
      addWheel(this, r, vehicleMaterial(), e, 0.45, t, n);
    }
  }
  wantsSlide(e, t) {
    return e.brake > 0.5 && Math.abs(t) > 0.5 && this.vf > 10;
  }
  touchLabels() {
    return {
      action: 'SIREN',
      alt: 'HORN',
    };
  }
  special(e, t) {
    if (t && t.actionPressed) {
      this.siren = !this.siren;
    }
    if (t && t.altPressed) {
      this.game.audio.play('sfx.horn', {
        pos: this.curr,
        rate: 1.25,
      });
    }
  }
  renderExtra(e, t) {
    let n = performance.now() / 1000;
    let r = this.siren;
    this.redMat.glow.value = r ? (Math.sin(n * 14) > 0 ? 9 : 0.4) : 0.3;
    this.blueMat.glow.value = r ? (Math.sin(n * 14) > 0 ? 0.4 : 9) : 0.3;
    this.sirenLoop.set(r ? 0.6 : 0, 1, this.curr);
    this.sirenLoop.update();
  }
  hudInfo() {
    return {
      tip: this.siren ? 'Siren ON' : 'Fast & nimble',
    };
  }
  dispose() {
    this.sirenLoop.stop();
    super.dispose();
  }
}
class Ballista extends Car {
  constructor(e, t, n, r, i) {
    super(
      e,
      {
        kind: 'ballista',
        name: 'Ballista',
        hw: 0.6,
        hh: 0.7,
        hl: 1.55,
        clearance: 0.3,
        density: 2.5,
        maxSpeed: 29,
        accel: 17,
        reverseMax: 6,
        brakeDecel: 28,
        turnRate: 2.9,
        grip: 12,
        slideGrip: 3,
        turnRef: 4,
        wheelR: 0.55,
        engineSound: 'sfx.engine_bike',
        leanMul: 4,
      },
      t,
      n,
      r,
      i,
    );
    this.ammo = 6;
    this.maxAmmo = 8;
    this.cool = 0;
    this.turbo = 0;
    this.turboCd = 0;
  }
  buildVisual() {
    let e = new BrickBuilder();
    e.box(0, 0.95, 0, 0.7, 0.55, 2.2, C_RED, {
      r: 0.3,
      m: 0.3,
    });
    e.box(0, 1.35, 0.5, 0.6, 0.3, 1.1, C_BLACK, {
      r: 0.6,
    });
    e.box(0, 1.25, -0.8, 0.8, 0.5, 0.6, C_RED, {
      r: 0.3,
      m: 0.3,
    });
    e.box(0, 1.55, -1, 0.7, 0.35, 0.1, C_BLUE, {
      r: 0.05,
      ao: false,
    });
    e.box(0, 1.5, -0.7, 1.2, 0.08, 0.08, 10133672, {
      m: 0.9,
      ao: false,
    });
    e.box(0, 1.1, -1.15, 0.3, 0.2, 0.1, 16774352, {
      e: 3,
      ao: false,
    });
    for (let t of [-0.62, 0.62]) {
      e.box(t, 1.05, 0.1, 0.4, 0.4, 1.6, 3816772, {
        r: 0.4,
        m: 0.6,
      });
      e.cyl(t, 1.05, -0.8, 0.02, 0.35, C_RED, {
        axis: 'z',
        seg: 6,
        r2: 0.13,
        e: 0.3,
      });
    }
    e.box(0, 1.85, 0.25, 0.7, 0.8, 0.45, C_YELLOW, {
      r: 0.6,
    });
    e.box(0, 2.45, 0.1, 0.5, 0.45, 0.5, 16747008, {
      r: 0.35,
      studs: true,
    });
    e.box(0, 2.42, -0.15, 0.4, 0.2, 0.05, C_BLUE, {
      r: 0.05,
      ao: false,
    });
    for (let t of [-0.4, 0.4]) {
      e.box(t, 1.85, -0.3, 0.18, 0.18, 0.8, C_YELLOW, {
        r: 0.6,
        ao: false,
      });
    }
    this.group.add(vehicleMesh(e));
    let t = wheelGeometry(0.55, 0.35, 10133672);
    addWheel(this, t, vehicleMaterial(), 0, 0.55, -1.15, true);
    addWheel(this, t, vehicleMaterial(), 0, 0.55, 1.1, false);
  }
  touchLabels() {
    return {
      action: 'FIRE',
      alt: 'TURBO',
    };
  }
  special(e, t) {
    this.cool -= e;
    this.turboCd -= e;
    if (t && t.actionPressed) {
      if (this.ammo > 0 && this.cool <= 0) {
        this.ammo--;
        this.cool = 0.3;
        let e = Math.cos(this.yaw);
        let t = Math.sin(this.yaw);
        let n = this.ammo % 2 ? 0.62 : -0.62;
        let r = this.curr.x + n * e + -1.2 * t;
        let i = this.curr.z - n * t + -1.2 * e;
        this.game.missiles.fire(r, this.curr.y - this.rideHeight + 1.1, i, this.yaw, this);
      } else {
        if (this.ammo <= 0) {
          this.game.audio.play('sfx.click', {
            volume: 0.7,
          });
          this.game.hud.hint('ballista-ammo', 'Out of missiles! Grab a glowing missile crate to reload.');
        }
      }
    }
    if (t && t.altPressed && this.turboCd <= 0 && this.grounded) {
      this.turbo = 1.3;
      this.turboCd = 3.5;
      this.game.audio.play('sfx.turbo', {
        pos: this.curr,
      });
    }
    if (this.turbo > 0) {
      this.turbo -= e;
      this.speedMul = 1.35;
      this.boost = 18;
      if (Math.random() < 0.6) {
        let e = Math.cos(this.yaw);
        let t = Math.sin(this.yaw);
        this.game.fx.jet(this.curr.x + 1.6 * t, this.curr.y - 0.3, this.curr.z + 1.6 * e, t * 4, e * 4);
      }
    } else {
      this.speedMul = 1;
      this.boost = 0;
    }
  }
  hudInfo() {
    return {
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      meter: this.turboCd > 0 ? 1 - Math.max(0, this.turboCd) / 3.5 : 1,
      meterLabel: 'TURBO',
    };
  }
}
class SubwayTrain {
  constructor(e, t) {
    this.game = e;
    this.def = t;
    this.kind = 'train';
    this.name = 'Subway Train';
    this.isVehicle = true;
    this.isTrain = true;
    this.x = t.x;
    this.baseY = t.y;
    this.z = t.start;
    this.v = 0;
    this.yaw = 0;
    this.halfLen = 11.6;
    this.hw = 1.7;
    this.zMin = t.z1 + this.halfLen + 1.5;
    this.zMax = t.z0 - this.halfLen - 1.5;
    let n = e.physics.R;
    let r = e.physics.world;
    this.body = r.createRigidBody(
      n.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, this.baseY + 1.9, this.z),
    );
    this.collider = r.createCollider(
      n.ColliderDesc.cuboid(this.hw, 1.8, this.halfLen).setCollisionGroups(COLLIDE.train),
      this.body,
    );
    e.physics.colliderOwner.set(this.collider.handle, this);
    this.curr = {
      x: this.x,
      y: this.baseY + 1.9,
      z: this.z,
      yaw: 0,
    };
    this.prev = {
      ...this.curr,
    };
    this.group = new Group();
    e.scene.add(this.group);
    this.build();
    this.hum = e.audio.loop('sfx.train');
    this.driven = false;
    this.throttle = 0;
    this.vf = 0;
    this.speed = 0;
  }
  get spec() {
    return {
      hw: this.hw,
      hl: this.halfLen,
    };
  }
  get groundPos() {
    return {
      x: this.curr.x,
      y: this.baseY,
      z: this.curr.z,
    };
  }
  obb(e = 0) {
    return {
      x: this.curr.x,
      z: this.curr.z,
      hw: this.hw + e,
      hl: this.halfLen + e,
      yaw: 0,
    };
  }
  touchLabels() {
    return {
      action: 'HORN',
      alt: '',
    };
  }
  hudInfo() {
    let e = null;
    let t = 1000000000;
    for (let n of this.def.stations) {
      let r = Math.abs(n.z - this.z);
      if (r < t) {
        t = r;
        e = n;
      }
    }
    return {
      tip: t < 10 ? `At ${e.name}` : `Next: ${this.nextStation().name}`,
      meter: Math.abs(this.v) / 16,
      meterLabel: 'SPEED',
    };
  }
  nextStation() {
    let e = this.v <= 0 ? -1 : 1;
    let t = this.def.stations.filter((t) => (e < 0 ? t.z < this.z - 5 : t.z > this.z + 5));
    t.sort((e, t) => Math.abs(e.z - this.z) - Math.abs(t.z - this.z));
    return t[0] || this.def.stations[e < 0 ? this.def.stations.length - 1 : 0];
  }
  build() {
    let e = brickMaterial();
    let t = new BrickBuilder();
    let n = 1914192;
    for (let e of [-5.8, 5.8]) {
      t.box(0, 0.45, e, 2.6, 0.5, 10.6, 2895928, {
        r: 0.6,
      });
      t.box(0, 2.1, e, 3.3, 2.9, 10.8, 13225686, {
        r: 0.3,
        m: 0.75,
        studs: false,
      });
      t.box(0, 1.35, e, 3.34, 0.35, 10.84, 3108822, {
        r: 0.35,
        ao: false,
      });
      t.box(0, 2.45, e, 3.36, 0.9, 9.6, n, {
        r: 0.05,
        m: 0.4,
        ao: false,
      });
      for (let n of [-2.6, 2.6]) {
        for (let r of [-1.69, 1.69]) {
          t.box(r, 1.95, e + n, 0.08, 2.3, 1.5, 5595243, {
            r: 0.4,
            m: 0.7,
            ao: false,
          });
        }
      }
      t.box(0, 3.65, e, 2.9, 0.2, 10.2, 11581376, {
        r: 0.4,
        m: 0.7,
        studs: true,
      });
      for (let n of [-3.8, 3.8]) {
        for (let r of [-0.9, 0.9]) {
          t.cyl(r, 0.55, e + n, 0.5, 0.4, 2040102, {
            axis: 'x',
            seg: 10,
          });
        }
      }
    }
    for (let [e, r] of [
      [-11.3, -1],
      [11.3, 1],
    ]) {
      t.box(0, 2, e, 3.1, 2.8, 0.5, 16761370, {
        r: 0.4,
      });
      t.box(0, 2.7, e + r * 0.26, 2.4, 0.9, 0.06, n, {
        r: 0.05,
        m: 0.4,
        ao: false,
      });
      for (let n of [-1, 1]) {
        t.box(n, 1.2, e + r * 0.27, 0.5, 0.3, 0.06, r < 0 ? 16774352 : 16722458, {
          e: 3,
          ao: false,
        });
      }
    }
    t.box(0, 2, 0, 2.6, 2.4, 1.2, 3816772, {
      r: 0.7,
    });
    let r = new Mesh(t.build(), e);
    r.castShadow = true;
    r.receiveShadow = true;
    this.group.add(r);
  }
  setDriven(e) {
    this.driven = e;
  }
  fixedUpdate(e, t) {
    let n = 0;
    if (t) {
      let e = t.throttle > 0.05 ? t.throttle : (t.direct || t.moveMag > 0.2) && t.moveY > 0.2 ? t.moveY : 0;
      let r = t.brake > 0.05 ? t.brake : (t.direct || t.moveMag > 0.2) && t.moveY < -0.2 ? -t.moveY : 0;
      if (e) {
        n = this.v > 0.2 ? -9 * e : -4.2 * e;
      }
      if (r) {
        n = this.v < -0.2 ? 9 * r : 3 * r;
      }
      if (t.actionPressed) {
        this.game.audio.play('sfx.train_horn', {
          pos: this.curr,
        });
      }
      this.throttle = e - r;
    } else {
      this.throttle = 0;
    }
    if (!n) {
      this.v *= Math.max(0, 1 - 0.35 * e);
    }
    this.v = clampNum(this.v + n * e, -16, 10);
    let r = this.z + this.v * e;
    if (r < this.zMin) {
      r = this.zMin;
      if (Math.abs(this.v) > 4) {
        this.game.camera.shake(0.3);
        this.game.audio.play('sfx.thud', {
          pos: this.curr,
        });
      }
      this.v = 0;
    }
    if (r > this.zMax) {
      r = this.zMax;
      this.v = 0;
    }
    this.z = r;
    this.body.setNextKinematicTranslation({
      x: this.x,
      y: this.baseY + 1.9,
      z: r,
    });
    this.speed = Math.abs(this.v);
    this.vf = -this.v;
  }
  afterStep() {
    Object.assign(this.prev, this.curr);
    this.curr.z = this.z;
    if (this.speed > 1) {
      this.game.props.sweep(this.obb(0.2), this.baseY, this.speed, this);
    }
  }
  render(e, t) {
    let n = this.prev.z + (this.curr.z - this.prev.z) * e;
    this.group.position.set(this.x, this.baseY, n);
    this.hum.set(
      this.speed > 0.2 || this.driven ? 0.25 + (this.speed / 16) * 0.6 : 0,
      0.7 + (this.speed / 16) * 0.6,
      this.curr,
    );
    this.hum.update();
  }
  exitSpot(e = 0) {
    let t = [this.curr.z - 5.8, this.curr.z + 5.8, this.curr.z];
    let n = e > 0 ? [1, -1] : [-1, 1];
    for (let e of n) {
      for (let n of t) {
        let t = this.x + e * 3.4;
        if (this.game.physics.spotFree(t, this.baseY + 1.1, n, 0.45, 0.85, 0.45, RAY_BODIES)) {
          return {
            x: t,
            y: this.baseY,
            z: n,
          };
        }
      }
    }
    return null;
  }
  dispose() {
    this.game.scene.remove(this.group);
    this.hum.stop();
    this.game.physics.removeBody(this.body);
  }
}
class MissileCarrier {
  constructor(e, t, n) {
    this.game = e;
    this.cfg = n;
    this.hw = n.halfWidth;
    this.hl = n.halfLength;
    this.pts = t;
    this.cum = [0];
    for (let e = 1; e < t.length; e++) {
      this.cum.push(this.cum[e - 1] + Math.hypot(t[e][0] - t[e - 1][0], t[e][1] - t[e - 1][1]));
    }
    this.length = this.cum[this.cum.length - 1];
    this.s = 0;
    this.speed = n.speed;
    this.state = 'idle';
    let r = this.sample(0);
    let i = e.physics.R;
    let a = e.physics.world;
    this.body = a.createRigidBody(
      i.RigidBodyDesc.kinematicPositionBased().setTranslation(r.x, 2.2, r.z).setRotation(yawQuat(r.yaw)),
    );
    this.collider = a.createCollider(
      i.ColliderDesc.cuboid(this.hw, 2.1, this.hl).setCollisionGroups(COLLIDE.carrier),
      this.body,
    );
    e.physics.colliderOwner.set(this.collider.handle, this);
    this.curr = {
      x: r.x,
      z: r.z,
      yaw: r.yaw,
    };
    this.prev = {
      ...this.curr,
    };
    this.group = new Group();
    e.scene.add(this.group);
    this.build();
    this.shadow = blobShadow(this.hw * 2.6, this.hl * 2.3);
    e.scene.add(this.shadow);
    this.engine = e.audio.loop('sfx.engine_carrier', {
      ref: 40,
      max: 220,
    });
    this.beep = e.audio.loop('sfx.carrier_beep', {
      ref: 30,
      max: 160,
    });
    this.wheelSpin = 0;
    this.t = 0;
    let o = new BrickBuilder();
    o.pushT(0, 0.07, 0, -0.6);
    o.box(0.55, 0, 0, 1.6, 0.06, 0.4, 16742938, {
      e: 1,
      ao: false,
      bevel: 0.02,
    });
    o.pop();
    o.pushT(0, 0.07, 0, 0.6);
    o.box(-0.55, 0, 0, 1.6, 0.06, 0.4, 16742938, {
      e: 1,
      ao: false,
      bevel: 0.02,
    });
    o.pop();
    this.chevMat = glowMaterial(2.5);
    this.chevN = 22;
    this.chev = new InstancedMesh(o.build(), this.chevMat, this.chevN);
    this.chev.frustumCulled = false;
    this.chev.castShadow = false;
    this.chev.receiveShadow = false;
    e.scene.add(this.chev);
    this._m4 = new Matrix4();
    this._q = new Quaternion();
    this._v = new Vector3();
    this._s = new Vector3();
  }
  sample(e) {
    e = clampNum(e, 0, this.length);
    let t = 0;
    let n = this.cum.length - 1;
    for (; n - t > 1; ) {
      let r = (t + n) >> 1;
      if (this.cum[r] <= e) {
        t = r;
      } else {
        n = r;
      }
    }
    let r = this.pts[t];
    let i = this.pts[n];
    let a = this.cum[n] - this.cum[t] || 1;
    let o = (e - this.cum[t]) / a;
    let s = r[0] + (i[0] - r[0]) * o;
    let c = r[1] + (i[1] - r[1]) * o;
    let l = Math.min(this.length, e + 2);
    let u = Math.max(0, e - 2);
    let d = this._raw(u);
    let f = this._raw(l);
    return {
      x: s,
      z: c,
      yaw: Math.atan2(-(f[0] - d[0]), -(f[1] - d[1])),
    };
  }
  _raw(e) {
    let t = 0;
    let n = this.cum.length - 1;
    for (; n - t > 1; ) {
      let r = (t + n) >> 1;
      if (this.cum[r] <= e) {
        t = r;
      } else {
        n = r;
      }
    }
    let r = this.pts[t];
    let i = this.pts[n];
    let a = this.cum[n] - this.cum[t] || 1;
    let o = (e - this.cum[t]) / a;
    return [r[0] + (i[0] - r[0]) * o, r[1] + (i[1] - r[1]) * o];
  }
  obbAt(e, t = 0) {
    let n = this.sample(e);
    return {
      x: n.x,
      z: n.z,
      hw: this.hw + t,
      hl: this.hl + t,
      yaw: n.yaw,
    };
  }
  computeObstacles(e) {
    let t = new Set();
    for (let n of e) {
      n.sHit = null;
      if (n.baseY > 2) {
        continue;
      }
      let e = {
        x: n.cx,
        z: n.cz,
        hw: (n.box.maxX - n.box.minX) / 2,
        hl: (n.box.maxZ - n.box.minZ) / 2,
        yaw: 0,
      };
      for (let r = 0; r <= this.length; r += 0.5) {
        if (obbOverlap(this.obbAt(r, 0.15), e)) {
          n.sHit = r;
          t.add(n.id);
          break;
        }
      }
    }
    return t;
  }
  build() {
    let e = brickMaterial();
    let t = new BrickBuilder();
    let n = 14168619;
    let r = 16761370;
    t.box(0, 1.1, 0, 4.6, 0.8, 16.8, 2895928, {
      r: 0.6,
      m: 0.3,
    });
    t.box(0, 2.6, -6.9, 5, 2.6, 3.2, 15921902, {
      r: 0.3,
      m: 0.2,
      studs: true,
    });
    t.box(0, 3.1, -8.52, 4.2, 1, 0.1, 1914192, {
      r: 0.05,
      m: 0.4,
      ao: false,
    });
    t.box(0, 1.55, -8.5, 5.2, 0.5, 0.3, n, {
      r: 0.4,
    });
    for (let e of [-1.8, 1.8]) {
      t.box(e, 1.9, -8.5, 0.7, 0.35, 0.12, 16774352, {
        e: 3,
        ao: false,
      });
    }
    carrierStripes(t, -2.5, 2.5, 1.2, -8.66, 0.5);
    t.box(0, 1.75, 1.6, 5.2, 0.5, 13.2, 5595243, {
      r: 0.5,
      m: 0.6,
      studs: 2,
    });
    for (let e of [-3.5, 1.5, 6.5]) {
      t.box(0, 2.3, e, 4.8, 0.6, 0.8, r, {
        r: 0.4,
      });
    }
    for (let e of [-1.25, 1.25]) {
      t.cyl(e, 3.35, 1.2, 1, 11, 15263976, {
        axis: 'z',
        seg: 12,
        r: 0.25,
        m: 0.35,
      });
      t.cyl(e, 3.35, -5.3, 0.12, 2, n, {
        axis: 'z',
        seg: 12,
        r2: 1,
        r: 0.3,
      });
      t.cyl(e, 3.35, 7.2, 0.9, 1, 5595243, {
        axis: 'z',
        seg: 12,
        m: 0.8,
      });
      t.box(e, 3.35, 1.2, 2.1, 0.12, 0.6, 1842210, {
        ao: false,
      });
      for (let r of [
        [0, 1.3],
        [0, -1.3],
        [1.3, 0],
        [-1.3, 0],
      ]) {
        t.box(e + r[0] * 0.5, 3.35 + r[1] * 0.5, 6.5, r[0] ? 1.2 : 0.15, r[1] ? 1.2 : 0.15, 1.2, n, {
          ao: false,
        });
      }
    }
    for (let e of [-2.62, 2.62]) {
      t.box(e, 1.75, 1.6, 0.08, 0.9, 1.4, r, {
        ao: false,
        e: 0.3,
      });
      t.box(e * 1.01, 1.75, 1.6, 0.06, 0.4, 0.4, 1842210, {
        ao: false,
      });
    }
    let i = new Mesh(t.build(), e);
    i.castShadow = true;
    i.receiveShadow = true;
    this.group.add(i);
    let a = new BrickBuilder();
    a.cyl(0, 0, 0, 0.75, 0.6, 2040102, {
      axis: 'x',
      seg: 12,
    });
    a.cyl(0, 0, 0, 0.42, 0.66, r, {
      axis: 'x',
      seg: 8,
    });
    let o = a.build();
    this.wheels = [];
    for (let t of [-7, -4.2, 1, 3.2, 5.4, 7.6]) {
      for (let n of [-2.3, 2.3]) {
        let r = new Mesh(o, e);
        r.position.set(n, 0.75, t);
        r.castShadow = true;
        this.group.add(r);
        this.wheels.push(r);
      }
    }
    let s = new BrickBuilder();
    for (let [e, t] of [
      [-1.8, -6.2],
      [1.8, -6.2],
      [-2.3, 8.2],
      [2.3, 8.2],
    ]) {
      s.cyl(e, 4.1 + (t < 0 ? 0 : -1.6), t, 0.3, 0.45, 16751130, {
        seg: 8,
        e: 1,
        ao: false,
      });
    }
    this.beaconMat = glowMaterial(1);
    this.group.add(new Mesh(s.build(), this.beaconMat));
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'moving';
    }
  }
  fixedUpdate(e) {
    if (this.state !== 'moving') {
      return;
    }
    this.prevS = this.s;
    this.s += this.speed * e;
    if (this.s >= this.length) {
      this.s = this.length;
      this.state = 'arrived';
      this.game.onCarrierArrived();
    }
    let t = this.sample(this.s);
    this.body.setNextKinematicTranslation({
      x: t.x,
      y: 2.2,
      z: t.z,
    });
    this.body.setNextKinematicRotation(yawQuat(t.yaw));
    Object.assign(this.prev, this.curr);
    this.curr.x = t.x;
    this.curr.z = t.z;
    this.curr.yaw = t.yaw;
    let n = this.obbAt(this.s, 0.1);
    for (let e of this.game.buildings.list) {
      if (
        !(!e.alive || !e.inPath || (e.sHit !== null && e.sHit > this.s + 2)) &&
        obbOverlap(n, {
          x: e.cx,
          z: e.cz,
          hw: (e.box.maxX - e.box.minX) / 2,
          hl: (e.box.maxZ - e.box.minZ) / 2,
          yaw: 0,
        })
      ) {
        this.game.carrierCrash(e.name, this.frontPoint());
        return;
      }
    }
    let r = this.game.controlled;
    let i = this.game.worker;
    if (i && r === i) {
      let e = this.obbAt(this.s, 0.7);
      if (
        obbOverlap(
          {
            x: i.curr.x,
            z: i.curr.z,
            hw: 0.45,
            hl: 0.45,
            yaw: 0,
          },
          e,
        ) &&
        i.curr.y < 5
      ) {
        let e = Math.cos(t.yaw);
        let n = -Math.sin(t.yaw);
        let r = (i.curr.x - t.x) * e + (i.curr.z - t.z) * n >= 0 ? 1 : -1;
        let a = t.x + e * r * (this.hw + 1.4);
        let o = t.z + n * r * (this.hw + 1.4);
        let s = (i.curr.x - t.x) * -Math.sin(t.yaw) + (i.curr.z - t.z) * -Math.cos(t.yaw);
        i.teleport(a + -Math.sin(t.yaw) * s, this.game.world.groundY(a, o, 2), o + -Math.cos(t.yaw) * s, i.yaw);
        this.game.hud.warn('Watch out for the carrier!', 1);
      }
    }
    if (r && r.isVehicle && !r.isTrain && r.body && !this.game.pathClear) {
      let e = r.obb ? r.obb(0.35) : null;
      if (e && obbOverlap(e, this.obbAt(this.s, 0.2))) {
        let e = r.body.linvel();
        let n = -Math.sin(t.yaw) * this.speed;
        let i = -Math.cos(t.yaw) * this.speed;
        let a = Math.hypot(e.x - n, e.z - i);
        if (a > 7.5 && Math.abs(r.curr.y - 1.5) < 4) {
          this.game.carrierCrash('your ' + r.name, [r.curr.x, 2, r.curr.z]);
          return;
        }
        if (a > 3) {
          this.game.hud.warn("Careful! Don't hit the carrier!");
        }
      }
    }
    this.game.props.sweep(n, 0, 6, this);
  }
  frontPoint() {
    let e = this.obbAt(this.s);
    return [e.x - Math.sin(e.yaw) * this.hl, 2, e.z - Math.cos(e.yaw) * this.hl];
  }
  nextObstacle() {
    let e = null;
    for (let t of this.game.buildings.list) {
      if (t.alive && t.inPath && t.sHit !== null && (!e || t.sHit < e.sHit)) {
        e = t;
      }
    }
    return e
      ? {
          t: Math.max(0, (e.sHit - this.s) / this.speed),
          b: e,
        }
      : {
          t: 1 / 0,
          b: null,
        };
  }
  render(e, t) {
    this.t += t;
    let n = this.prev;
    let r = this.curr;
    let i = n.x + (r.x - n.x) * e;
    let a = n.z + (r.z - n.z) * e;
    let o = n.yaw + angleDelta(n.yaw, r.yaw) * e;
    this.group.position.set(i, 0, a);
    this.group.rotation.y = o;
    this.shadow.position.set(i, 0.05, a);
    this.shadow.rotation.y = o;
    let s = this.state === 'moving';
    if (s) {
      this.wheelSpin += (this.speed / 0.75) * t;
    }
    for (let e of this.wheels) {
      e.rotation.x = -this.wheelSpin;
    }
    this.beaconMat.glow.value = this.state === 'arrived' ? 0.5 : Math.sin(this.t * 9) > 0 ? 9 : 0.6;
    let c = this.state === 'idle' || this.state === 'moving';
    this.chev.visible = c;
    if (c) {
      let t = this.prevS === undefined ? this.s : this.prevS + (this.s - this.prevS) * e;
      let n = (this.t * 4) % 4;
      for (let e = 0; e < this.chevN; e++) {
        let r = t + this.hl + 3 + e * 4 + n;
        let i = this.sample(r);
        let a = 1 - e / this.chevN;
        this._q.setFromAxisAngle(this._v.set(0, 1, 0), i.yaw);
        this._s.setScalar(r > this.length ? 0 : 0.6 + 0.4 * a);
        this._m4.compose(this._v.set(i.x, 0, i.z), this._q, this._s);
        this.chev.setMatrixAt(e, this._m4);
      }
      this.chev.instanceMatrix.needsUpdate = true;
      let r = this.game.carrierUrgency || 0;
      this.chevMat.glow.value = 1.6 + r * 3 + Math.sin(this.t * 6) * 0.4;
      this.chevMat.tint.value.setHex(this.game.pathClear ? 4521830 : 16777215);
    }
    if (s && Math.random() < t * 6) {
      this.game.fx.radiation(i, 4.5, a);
    }
    let l = this.state === 'moving' || this.state === 'idle';
    this.engine.set(l ? 0.7 : 0, s ? 0.85 : 0.7, {
      x: i,
      y: 2,
      z: a,
    });
    this.engine.update();
    let u = this.game.carrierUrgency || 0;
    this.beep.set(s ? 0.35 + u * 0.4 : 0, 1 + u * 0.5, {
      x: i,
      y: 2,
      z: a,
    });
    this.beep.update();
  }
  dispose() {
    this.game.scene.remove(this.group);
    this.game.scene.remove(this.shadow);
    this.game.scene.remove(this.chev);
    this.engine.stop();
    this.beep.stop();
    this.game.physics.removeBody(this.body);
  }
}
function carrierStripes(e, t, n, r, i, a) {
  let o = (n - t) / 10;
  for (let n = 0; n < 10; n++) {
    e.box(t + o * (n + 0.5), r, i, o, a, 0.1, n % 2 ? 1842210 : 16761370, {
      bevel: 0.01,
      ao: false,
    });
  }
}
let propMat = null;
const propMaterial = () => (propMat ||= brickMaterial());
const propMesh = (e, t = true) => {
  let n = new Mesh(e.build(), propMaterial());
  n.castShadow = t;
  n.receiveShadow = true;
  return n;
};
class TntCrate {
  constructor(e, t) {
    this.game = e;
    this.spawn = t;
    this.alive = true;
    this.fuse = null;
    this.lastBeep = 99;
    this.h = 1.2;
    let n = e.physics.R;
    let r = e.physics.world;
    this.body = r.createRigidBody(
      n.RigidBodyDesc.dynamic()
        .setTranslation(t.x, t.y + this.h + 0.05, t.z)
        .setLinearDamping(1.2)
        .setAngularDamping(2)
        .setCanSleep(false),
    );
    this.body.setEnabledRotations(false, true, false, true);
    this.collider = r.createCollider(
      n.ColliderDesc.cuboid(1.2, 1.2, 1.2).setDensity(0.7).setFriction(0.25).setCollisionGroups(COLLIDE.dyn),
      this.body,
    );
    let i = new BrickBuilder();
    i.box(0, 0, 0, 2.4, 2.4, 2.4, 14168619, {
      studs: true,
      r: 0.5,
    });
    for (let e of [-0.7, 0.7]) {
      i.box(0, e, 0, 2.46, 0.3, 2.46, 9268810, {
        ao: false,
        r: 0.8,
      });
    }
    for (let [e, t] of [
      [0, -1.24],
      [0, 1.24],
    ]) {
      i.box(e, 0, t, 1.5, 0.6, 0.06, 16761370, {
        ao: false,
        e: 0.2,
      });
    }
    for (let [e, t] of [
      [-1.24, 0],
      [1.24, 0],
    ]) {
      i.box(e, 0, t, 0.06, 0.6, 1.5, 16761370, {
        ao: false,
        e: 0.2,
      });
    }
    i.cyl(0, 1.5, 0, 0.08, 0.6, 3816772, {
      seg: 6,
    });
    this.mesh = propMesh(i);
    e.scene.add(this.mesh);
    this.curr = {
      x: t.x,
      y: t.y + this.h,
      z: t.z,
      yaw: 0,
    };
    this.prev = {
      ...this.curr,
    };
  }
  fixedUpdate(e) {
    if (!this.alive) {
      return;
    }
    let t = this.game;
    if (this.fuse === null) {
      let e = {
        x: this.curr.x,
        z: this.curr.z,
        hw: 1.6,
        hl: 1.6,
        yaw: 0,
      };
      for (let n of t.vehicles) {
        if (
          n.isCar &&
          n.body &&
          !(Math.abs(n.curr.y - n.rideHeight - (this.curr.y - this.h)) > 2) &&
          obbOverlap(n.obb(0.2), e)
        ) {
          this.light(12);
          break;
        }
      }
    } else {
      this.fuse -= e;
      let n = Math.ceil(this.fuse);
      if (n !== this.lastBeep) {
        this.lastBeep = n;
        t.audio.play(n <= 3 ? 'sfx.tnt_beep_fast' : 'sfx.tnt_beep', {
          pos: this.curr,
        });
      }
      if (this.fuse <= 0) {
        this.explode();
      }
    }
    if (this.curr.y < -30) {
      this.explode();
    }
  }
  light(e) {
    if (this.fuse !== null) {
      this.fuse = Math.min(this.fuse, e);
      return;
    }
    this.fuse = e;
    this.game.hud.toast('TNT fuse lit! Push it into the blast door!', 'warn');
    this.game.hud.hint('tnt', 'The TNT fuse starts on first touch. Shove it against the door before it blows!');
  }
  afterStep() {
    if (!this.alive) {
      return;
    }
    let e = this.body.translation();
    Object.assign(this.prev, this.curr);
    this.curr.x = e.x;
    this.curr.y = e.y;
    this.curr.z = e.z;
    this.curr.yaw = quatYaw(this.body.rotation());
  }
  render(e) {
    if (!this.alive) {
      return;
    }
    let t = this.prev;
    let n = this.curr;
    this.mesh.position.set(t.x + (n.x - t.x) * e, t.y + (n.y - t.y) * e, t.z + (n.z - t.z) * e);
    this.mesh.rotation.y = n.yaw;
    if (this.fuse !== null) {
      let e = Math.sin(performance.now() / (this.fuse < 3 ? 40 : 110)) > 0;
      this.mesh.scale.setScalar(e ? 1.04 : 1);
      this.game.hud.worldLabel(
        'tnt' + this.spawn.x,
        String(Math.max(0, Math.ceil(this.fuse))),
        {
          x: this.mesh.position.x,
          y: this.mesh.position.y + 2.4,
          z: this.mesh.position.z,
        },
        'tnt',
      );
    }
  }
  explode() {
    if (!this.alive) {
      return;
    }
    this.alive = false;
    let t = this.game;
    let { x: n, y: r, z: i } = this.curr;
    t.hud.worldLabel('tnt' + this.spawn.x, null);
    this.game.scene.remove(this.mesh);
    t.physics.removeBody(this.body);
    this.body = null;
    t.fx.explosion(n, r, i, 1.8);
    t.fx.flash(n, r + 2, i, 1.6);
    t.audio.play('sfx.explosion_big', {
      pos: this.curr,
    });
    t.camera.shake(1);
    t.rumble(1, 300);
    t.blastAt(n, r, i, 9, 420, 'tnt', this);
    for (let e = 0; e < 6; e++) {
      t.bricks.spawn(
        'brick',
        n,
        r,
        i,
        e % 2 ? 14168619 : 9268810,
        (Math.random() - 0.5) * 16,
        6 + Math.random() * 8,
        (Math.random() - 0.5) * 16,
        0.4,
        true,
      );
    }
    t.after(4.5, () => {
      if (t.tnts.includes(this) && t.needsTNT()) {
        let n = t.tnts.indexOf(this);
        t.tnts[n] = new TntCrate(t, this.spawn);
        t.hud.toast('A fresh TNT crate has been delivered.', 'info');
      }
    });
  }
  dispose() {
    this.game.scene.remove(this.mesh);
    if (this.body) {
      this.game.physics.removeBody(this.body);
    }
    this.game.hud.worldLabel('tnt' + this.spawn.x, null);
  }
}
class PushBlock {
  constructor(e, t) {
    this.game = e;
    this.d = t;
    let n = e.physics.R;
    let r = e.physics.world;
    this.body = r.createRigidBody(
      n.RigidBodyDesc.dynamic()
        .setTranslation(t.x, t.y + t.h / 2 + 0.02, t.z)
        .setLinearDamping(2.5)
        .setAngularDamping(4)
        .setCanSleep(false),
    );
    this.body.setEnabledRotations(false, true, false, true);
    r.createCollider(
      n.ColliderDesc.cuboid(t.w / 2, t.h / 2, t.d / 2)
        .setDensity(1.4)
        .setFriction(0.18)
        .setCollisionGroups(COLLIDE.dyn),
      this.body,
    );
    let i = new BrickBuilder();
    i.box(0, 0, 0, t.w, t.h, t.d, 11117980, {
      studs: true,
      r: 0.8,
      bevel: 0.12,
    });
    for (let e = 0; e < 4; e++) {
      i.box(
        -t.w / 2 - 0.02,
        -0.6 + (e % 2) * 0.3,
        -t.d / 2 + 0.75 + e * 1.5,
        0.05,
        0.3,
        1.2,
        e % 2 ? 1842210 : 16761370,
        {
          ao: false,
        },
      );
    }
    this.mesh = propMesh(i);
    e.scene.add(this.mesh);
    this.curr = {
      x: t.x,
      y: t.y + t.h / 2,
      z: t.z,
      yaw: 0,
    };
    this.prev = {
      ...this.curr,
    };
    this.moved = false;
  }
  afterStep() {
    let e = this.body.translation();
    Object.assign(this.prev, this.curr);
    this.curr.x = e.x;
    this.curr.y = e.y;
    this.curr.z = e.z;
    this.curr.yaw = quatYaw(this.body.rotation());
    if (!this.moved && Math.hypot(e.x - this.d.x, e.z - this.d.z) > 3.2) {
      this.moved = true;
      this.game.onBlockMoved();
    }
  }
  render(e) {
    let t = this.prev;
    let n = this.curr;
    this.mesh.position.set(t.x + (n.x - t.x) * e, t.y + (n.y - t.y) * e, t.z + (n.z - t.z) * e);
    this.mesh.rotation.y = n.yaw;
  }
  dispose() {
    this.game.scene.remove(this.mesh);
    this.game.physics.removeBody(this.body);
  }
}
class Door {
  constructor(e, t) {
    this.game = e;
    this.d = t;
    this.id = t.id;
    this.alive = true;
    this.name = t.name;
    let { col: n } = e.physics.fixedBox(t.x, t.y + t.h / 2, t.z, t.w / 2, t.h / 2, t.d / 2, {
      groups: COLLIDE.building,
      owner: this,
    });
    this.col = n;
    let r = new BrickBuilder();
    if (t.kind === 'steel') {
      r.box(0, 0, 0, t.w, t.h, t.d, 7042176, {
        r: 0.35,
        m: 0.85,
        bevel: 0.1,
      });
      for (let e = 0; e < 6; e++) {
        r.box(t.w / 2 + 0.03, -t.h / 2 + 0.4, -t.d / 2 + 0.5 + e, 0.06, 0.6, 0.5, e % 2 ? 1842210 : 16761370, {
          ao: false,
        });
      }
      for (let e = 0; e < 6; e++) {
        r.box(-t.w / 2 - 0.03, -t.h / 2 + 0.4, -t.d / 2 + 0.5 + e, 0.06, 0.6, 0.5, e % 2 ? 1842210 : 16761370, {
          ao: false,
        });
      }
      r.box(t.w / 2 + 0.05, 0.5, 0, 0.08, 0.3, t.d * 0.8, 3816772, {
        ao: false,
      });
    } else {
      for (let e = 0; e < 6; e++) {
        r.box(-t.w / 2 + ((e + 0.5) * t.w) / 6, 0, 0, t.w / 6 - 0.05, t.h, t.d, e % 2 ? 9268810 : 8019260, {
          r: 0.85,
          bevel: 0.05,
        });
      }
      for (let e of [-1.2, 1.2]) {
        r.box(0, e, -t.d / 2 - 0.05, t.w, 0.35, 0.1, 5913122, {
          ao: false,
        });
      }
    }
    this.mesh = propMesh(r);
    this.mesh.position.set(t.x, t.y + t.h / 2, t.z);
    e.scene.add(this.mesh);
  }
  destroy() {
    if (!this.alive) {
      return;
    }
    this.alive = false;
    let e = this.game;
    let t = this.d;
    e.scene.remove(this.mesh);
    e.physics.removeCollider(this.col);
    let n = t.kind === 'steel' ? [7042176, 16761370, 3816772] : [9268810, 8019260];
    for (let r = 0; r < 14; r++) {
      e.bricks.spawn(
        r % 3 ? 'brick' : 'plate',
        t.x + (Math.random() - 0.5) * t.w,
        t.y + Math.random() * t.h,
        t.z + (Math.random() - 0.5) * t.d,
        n[r % n.length],
        (Math.random() - 0.5) * 14,
        3 + Math.random() * 6,
        (Math.random() - 0.5) * 14,
        0.55,
        r < 8,
      );
    }
    e.fx.dust(t.x, t.y + 1, t.z, 20, 3);
    e.audio.play(t.kind === 'steel' ? 'sfx.metal_slam' : 'sfx.wood', {
      pos: {
        x: t.x,
        y: t.y,
        z: t.z,
      },
    });
    e.onDoorDestroyed(this);
  }
  dispose() {
    if (this.alive) {
      this.game.scene.remove(this.mesh);
    }
  }
}
class Gate {
  constructor(e, t) {
    this.game = e;
    this.d = t;
    this.open = 0;
    this.unlocked = false;
    this.openTimer = 0;
    let n = e.physics.R;
    let r = e.physics.world;
    this.body = r.createRigidBody(n.RigidBodyDesc.kinematicPositionBased().setTranslation(t.x, t.y + t.h / 2, t.z));
    r.createCollider(n.ColliderDesc.cuboid(t.w / 2, t.h / 2, t.d / 2).setCollisionGroups(COLLIDE.static), this.body);
    let i = new BrickBuilder();
    i.box(0, 0, 0, t.w, t.h, t.d, 5595243, {
      r: 0.4,
      m: 0.8,
    });
    for (let e = 0; e < 5; e++) {
      i.box(-t.w / 2 - 0.03, -t.h / 2 + 0.5 + e * 1, 0, 0.05, 0.12, t.d * 0.96, 3816772, {
        ao: false,
      });
    }
    for (let e = 0; e < 8; e++) {
      i.box(t.w / 2 + 0.03, -t.h / 2 + 0.3, -t.d / 2 + 0.6 + e * 1.25, 0.05, 0.4, 0.6, e % 2 ? 1842210 : 16761370, {
        ao: false,
      });
    }
    this.mesh = propMesh(i);
    e.scene.add(this.mesh);
    let a = new BrickBuilder();
    for (let e of [-1, 1]) {
      a.box(0, t.h + 0.5, e * (t.d / 2 + 0.5), 1.4, t.h * 2 + 1, 1, 3816772, {
        r: 0.6,
        m: 0.5,
      });
    }
    a.box(0, t.h * 2 + 1.1, 0, 1.4, 0.8, t.d + 2, 16761370, {
      r: 0.5,
    });
    this.frame = propMesh(a);
    this.frame.position.set(t.x, t.y, t.z);
    e.scene.add(this.frame);
    e.physics.fixedBox(t.x, t.y + t.h, t.z - (t.d / 2 + 0.5), 0.7, t.h, 0.5);
    e.physics.fixedBox(t.x, t.y + t.h, t.z + (t.d / 2 + 0.5), 0.7, t.h, 0.5);
    this.y = t.y + t.h / 2;
  }
  fixedUpdate(e) {
    let t = this.game.controlled;
    let [n, r, i, a] = this.d.trigger;
    if (t && t.curr && t.curr.x > n && t.curr.x < i && t.curr.z > r && t.curr.z < a && t.curr.y < 1 && !this.unlocked) {
      this.unlocked = true;
      this.game.hud.toast('Gate unlocked from the inside.', 'info');
      this.game.audio.play('sfx.gate', {
        pos: {
          x: this.d.x,
          y: 0,
          z: this.d.z,
        },
      });
    }
    let o = +!!this.unlocked;
    this.open += (o - this.open) * Math.min(1, e * 1.5);
    this.y = this.d.y + this.d.h / 2 + this.open * (this.d.h + 0.4);
    this.body.setNextKinematicTranslation({
      x: this.d.x,
      y: this.y,
      z: this.d.z,
    });
  }
  render() {
    this.mesh.position.set(this.d.x, this.y, this.d.z);
  }
  dispose() {
    this.game.scene.remove(this.mesh);
    this.game.scene.remove(this.frame);
  }
}
class Missiles {
  constructor(e) {
    this.game = e;
    this.list = [];
    let t = new BrickBuilder();
    t.cyl(0, 0, 0, 0.16, 1.2, 15921902, {
      axis: 'z',
      seg: 8,
      r: 0.3,
    });
    t.cyl(0, 0, -0.75, 0.02, 0.3, 14168619, {
      axis: 'z',
      seg: 8,
      r2: 0.16,
    });
    for (let [e, n] of [
      [0.25, 0],
      [-0.25, 0],
      [0, 0.25],
      [0, -0.25],
    ]) {
      t.box(e, n, 0.45, e ? 0.3 : 0.05, n ? 0.3 : 0.05, 0.3, 14168619, {
        ao: false,
      });
    }
    this.geo = t.build();
  }
  fire(e, t, n, r, i) {
    let a = new Mesh(this.geo, propMaterial());
    a.rotation.y = r;
    a.position.set(e, t, n);
    this.game.scene.add(a);
    this.list.push({
      m: a,
      x: e,
      y: t,
      z: n,
      px: e,
      py: t,
      pz: n,
      vx: -Math.sin(r) * 48,
      vz: -Math.cos(r) * 48,
      life: 1.6,
      owner: i,
    });
    this.game.audio.play('sfx.missile', {
      pos: {
        x: e,
        y: t,
        z: n,
      },
    });
    this.game.fx.sparks(e, t, n, 4);
    this.game.rumble(0.3, 60);
  }
  fixedUpdate(e) {
    let t = this.game;
    for (let n = this.list.length - 1; n >= 0; n--) {
      let r = this.list[n];
      r.px = r.x;
      r.py = r.y;
      r.pz = r.z;
      r.life -= e;
      let i = r.vx * e;
      let a = r.vz * e;
      let o = Math.hypot(i, a);
      let s = t.physics.ray(r.x, r.y, r.z, i / o, 0, a / o, o, RAY_SOLID, r.owner && r.owner.body);
      let c = null;
      if (s) {
        c = s;
      }
      if (!c && t.secret && t.secret.alive) {
        let e = t.secret;
        if (Math.hypot(r.x + i - e.x, r.z + a - e.z) < 1.6 && Math.abs(r.y - e.y) < 3) {
          c = {
            x: r.x + i,
            y: r.y,
            z: r.z + a,
          };
        }
      }
      if (!c) {
        let e = t.world.groundY(r.x + i, r.z + a, r.y);
        if (r.y < e + 0.1) {
          c = {
            x: r.x + i,
            y: e + 0.2,
            z: r.z + a,
          };
        }
      }
      if (c || r.life <= 0) {
        let e = c ? c.x : r.x;
        let i = c ? c.y : r.y;
        let a = c ? c.z : r.z;
        t.fx.explosion(e, i, a, 0.8);
        t.fx.flash(e, i + 1, a, 0.7);
        t.audio.play('sfx.explosion_small', {
          pos: {
            x: e,
            y: i,
            z: a,
          },
        });
        t.camera.shake(0.35);
        let o = s && t.physics.ownerOf(s.collider);
        if (o && o.damage && o.alive) {
          o.damage(45, e, i, a, r.vx / 48, r.vz / 48, 'missile');
        }
        t.blastAt(e, i, a, 4.5, 40, 'missile', r.owner);
        t.scene.remove(r.m);
        this.list.splice(n, 1);
        continue;
      }
      r.x += i;
      r.z += a;
      if (Math.random() < 0.9) {
        t.fx.trail(r.x, r.y, r.z);
      }
    }
  }
  render(e) {
    for (let t of this.list) {
      t.m.position.set(t.px + (t.x - t.px) * e, t.py + (t.y - t.py) * e, t.pz + (t.z - t.pz) * e);
    }
  }
  dispose() {
    for (let e of this.list) {
      this.game.scene.remove(e.m);
    }
    this.list = [];
  }
}
class AmmoCrates {
  constructor(e, t) {
    this.game = e;
    this.items = [];
    let n = new BrickBuilder();
    n.box(0, 0.6, 0, 1.6, 1.2, 1.6, 3824170, {
      studs: true,
      r: 0.6,
    });
    n.box(0, 0.6, -0.82, 1.1, 0.35, 0.05, 16761370, {
      ao: false,
      e: 0.6,
    });
    n.box(0, 0.6, 0.82, 1.1, 0.35, 0.05, 16761370, {
      ao: false,
      e: 0.6,
    });
    let r = n.build();
    let i = new BrickBuilder();
    i.cyl(0, 1.9, 0, 0.18, 1, 16734762, {
      seg: 8,
      e: 1,
      r2: 0.18,
      ao: false,
    });
    i.cyl(0, 2.6, 0, 0.02, 0.4, 16734762, {
      seg: 8,
      e: 1,
      r2: 0.18,
      ao: false,
    });
    this.glowMat = glowMaterial(3);
    let a = i.build();
    for (let n of t) {
      let t = new Group();
      t.position.set(n.x, n.y, n.z);
      let i = new Mesh(r, propMaterial());
      i.castShadow = true;
      t.add(i);
      let o = new Mesh(a, this.glowMat);
      t.add(o);
      e.scene.add(t);
      this.items.push({
        ...n,
        grp: t,
        ic: o,
        alive: true,
        t: 0,
      });
    }
  }
  fixedUpdate(e) {
    let t = this.game.controlled;
    for (let n of this.items) {
      if (!n.alive) {
        n.t -= e;
        if (n.t <= 0) {
          n.alive = true;
          n.grp.visible = true;
        }
        continue;
      }
      if (
        t &&
        t.kind === 'ballista' &&
        Math.hypot(t.curr.x - n.x, t.curr.z - n.z) < 3.2 &&
        Math.abs(t.curr.y - n.y) < 3 &&
        t.ammo < t.maxAmmo
      ) {
        t.ammo = Math.min(t.maxAmmo, t.ammo + 4);
        n.alive = false;
        n.grp.visible = false;
        n.t = 25;
        this.game.audio.play('sfx.pickup');
        this.game.fx.sparkle(n.x, n.y + 1, n.z, [6, 3, 1], 16);
        this.game.hud.toast('+4 missiles', 'good');
      }
    }
  }
  render(e, t) {
    for (let e of this.items) {
      if (e.alive) {
        e.ic.rotation.y = t * 2;
        e.ic.position.y = Math.sin(t * 3) * 0.2;
      }
    }
  }
  dispose() {
    for (let e of this.items) {
      this.game.scene.remove(e.grp);
    }
  }
}
class TunnelBeacon {
  constructor(e, t) {
    this.game = e;
    let n = new BrickBuilder();
    n.box(0, 0, 0, 0.6, 1.4, 1.4, 3816772, {
      r: 0.5,
    });
    let r = propMesh(n);
    let i = new BrickBuilder();
    i.cyl(-0.45, 0, 0, 0.45, 0.5, 16769126, {
      axis: 'x',
      seg: 10,
      e: 1,
      ao: false,
    });
    this.mat = glowMaterial(1);
    let a = new Mesh(i.build(), this.mat);
    this.grp = new Group();
    this.grp.add(r, a);
    this.grp.position.set(t.x, t.y, t.z);
    e.scene.add(this.grp);
    this.pos = t;
  }
  render(e, t) {
    let n = Math.sin(t * 10) > 0.2;
    this.mat.glow.value = n ? 14 : 0.5;
    if (n && Math.random() < 0.3) {
      this.game.fx.sparkle(this.pos.x - 0.8, this.pos.y, this.pos.z, [6, 5, 1.5], 1, 2);
    }
  }
  dispose() {
    this.game.scene.remove(this.grp);
  }
}
class SecretCrystal {
  constructor(e, t) {
    this.game = e;
    this.x = t.x;
    this.y = t.y + 3.2;
    this.z = t.z;
    this.alive = true;
    let n = new OctahedronGeometry(1.1, 0);
    let r = new MeshStandardNodeMaterial({
      color: 8379647,
      emissive: new Color(0.05, 0.45, 0.8),
      roughness: 0.08,
      metalness: 0.3,
      flatShading: true,
    });
    this.mesh = new Mesh(n, r);
    this.mesh.scale.set(1, 1.6, 1);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.castShadow = true;
    e.scene.add(this.mesh);
  }
  render(e, t) {
    if (this.alive) {
      this.mesh.rotation.y = t * 1.2;
      this.mesh.position.y = this.y + Math.sin(t * 2) * 0.3;
      if (Math.random() < 0.15) {
        this.game.fx.sparkle(
          this.x + (Math.random() - 0.5) * 2,
          this.y + (Math.random() - 0.5) * 2,
          this.z + (Math.random() - 0.5) * 2,
          [2, 5, 7],
          1,
          1.5,
        );
      }
    }
  }
  shatter() {
    if (this.alive) {
      this.alive = false;
      this.game.scene.remove(this.mesh);
      this.game.fx.sparkle(this.x, this.y, this.z, [2, 6, 9], 60, 10);
      this.game.fx.flash(this.x, this.y, this.z, 0.8);
      this.game.onSecretFound();
    }
  }
  dispose() {
    this.game.scene.remove(this.mesh);
  }
}
const byId = (e) => document.getElementById(e);
const _hudVec = new Vector3();
class Hud {
  constructor(e) {
    this.game = e;
    this.root = byId('hud');
    this.el = {
      vname: byId('v-name'),
      vicon: byId('v-icon'),
      vmeter: byId('v-meter'),
      vfill: byId('v-fill'),
      vlabel: byId('v-meter-label'),
      vammo: byId('v-ammo'),
      vtip: byId('v-tip'),
      carrier: byId('hud-carrier'),
      ctitle: byId('c-title'),
      ctime: byId('c-time'),
      csub: byId('c-sub'),
      cbar: byId('c-bar-fill'),
      prompt: byId('hud-prompt'),
      toasts: byId('hud-toasts'),
      banner: byId('hud-banner'),
      btitle: byId('b-title'),
      bsub: byId('b-sub'),
      warn: byId('hud-warn'),
      hint: byId('hud-hint'),
      hintText: byId('hint-text'),
      labels: byId('hud-labels'),
      arrow: byId('hud-arrow'),
      arrowDist: byId('arrow-dist'),
      bb: byId('bldg-bar'),
      bbName: byId('bb-name'),
      bbFill: byId('bb-fill'),
      countdown: byId('countdown'),
      money: byId('s-money'),
      time: byId('s-time'),
      map: byId('minimap'),
      mapWrap: byId('hud-map'),
    };
    this.rows = {
      rdus: byId('s-rdu'),
      buildings: byId('s-bld'),
      survivors: byId('s-surv'),
      comms: byId('s-comm'),
      scientists: byId('s-sci'),
      secrets: byId('s-sec'),
    };
    this.last = {};
    this.labels = new Map();
    let t = [];
    try {
      t = JSON.parse(localStorage.getItem('bbb.hints') || '[]');
    } catch {}
    this.hintsShown = new Set(t);
    this.hintQueue = [];
    byId('hint-close').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.hideHint();
    });
    this.bannerT = 0;
    this.warnT = 0;
    this.promptText = '';
    this.bbT = 0;
    this.hintT = 0;
    this.mapCtx = this.el.map.getContext('2d');
    this.mapT = 0;
    this.buildStaticMap();
  }
  show(e) {
    this.root.classList.toggle('hidden', !e);
  }
  reset() {
    this.el.toasts.innerHTML = '';
    for (let [e, t] of this.labels) {
      t.remove();
    }
    this.labels.clear();
    this.el.banner.classList.remove('show');
    this.el.warn.classList.remove('show');
    this.hideHint();
    this.last = {};
    this.el.prompt.classList.remove('show');
  }
  buildStaticMap() {
    let e = this.game.world.bounds;
    let t = 1.25;
    let n = Math.ceil((e.x1 - e.x0) / t);
    let r = Math.ceil((e.z1 - e.z0) / t);
    let i = document.createElement('canvas');
    i.width = n;
    i.height = r;
    let a = i.getContext('2d');
    let o = (n, r) => [(n - e.x0) / t, (r - e.z0) / t];
    a.fillStyle = '#5b606a';
    a.fillRect(0, 0, n, r);
    let s = (e, t) => {
      let [n, r] = o(e[0], e[1]);
      let [i, s] = o(e[2], e[3]);
      a.fillStyle = t;
      a.fillRect(n, r, i - n, s - r);
    };
    for (let [e, t] of PAINT_RECTS) {
      s(
        t,
        e === 'grass'
          ? '#3f7a34'
          : e === 'plaza'
            ? '#8a7d62'
            : e === 'compound'
              ? '#56606a'
              : e === 'safe'
                ? '#a07c10'
                : '#5b606a',
      );
    }
    for (let e of ROADS) {
      s([e.rect[0] - 1, e.rect[1] - 1, e.rect[2] + 1, e.rect[3] + 1], '#2a2c31');
    }
    for (let e of SUNKEN) {
      s(e.rect, '#1b1c20');
    }
    for (let e of ROOFS) {
      s(e.rect, '#34373d');
    }
    for (let e of RAISED) {
      s(e.rect, '#8f8a80');
    }
    for (let e of TOWERS) {
      s([e.x - e.w / 2, e.z - e.d / 2, e.x + e.w / 2, e.z + e.d / 2], '#b9c0ca');
    }
    this.staticMap = i;
    this.mapScale = t;
    this.route = carrierPath();
  }
  drawMap(e) {
    let t = this.game;
    let n = this.mapCtx;
    let r = this.el.map.width;
    let i = this.el.map.height;
    let a = t.controlled;
    if (!a || !a.curr) {
      return;
    }
    let o = t.world.bounds;
    let s = this.mapScale;
    let c = a.curr.x;
    let l = a.curr.z;
    let u = 1.25;
    n.save();
    n.clearRect(0, 0, r, i);
    n.fillStyle = '#23262c';
    n.fillRect(0, 0, r, i);
    n.translate(r / 2, i / 2);
    n.rotate(t.camera.yaw);
    n.scale(u, u);
    n.translate(-(c - o.x0) / s, -(l - o.z0) / s);
    n.drawImage(this.staticMap, 0, 0);
    let d = (e, t) => [(e - o.x0) / s, (t - o.z0) / s];
    let f = t.carrier;
    if (f) {
      n.strokeStyle = t.pathClear ? 'rgba(110,255,110,0.6)' : 'rgba(255,90,60,0.85)';
      n.lineWidth = (2.2 / u) * 1.6;
      n.setLineDash([4, 3]);
      n.beginPath();
      let e = false;
      for (let t = 0; t < this.route.length; t += 3) {
        if (f.cum[t] < f.s) {
          continue;
        }
        let [r, i] = d(this.route[t][0], this.route[t][1]);
        if (e) {
          n.lineTo(r, i);
        } else {
          n.moveTo(r, i);
          e = true;
        }
      }
      n.stroke();
      n.setLineDash([]);
    }
    for (let e of t.buildings.list) {
      let [t, r] = d(e.box.minX, e.box.minZ);
      let [i, a] = d(e.box.maxX, e.box.maxZ);
      if (e.alive) {
        n.fillStyle = e.inPath ? (Math.sin(performance.now() / 150) > 0 ? '#ff3a2a' : '#ff8a6a') : '#ff9a3a';
        n.fillRect(t, r, i - t, a - r);
      } else {
        n.strokeStyle = 'rgba(255,255,255,0.35)';
        n.lineWidth = 1;
        n.strokeRect(t, r, i - t, a - r);
      }
    }
    n.fillStyle = '#7dff4a';
    for (let e of t.objectives.rdus) {
      if (e.lit || Math.abs(e.x - c) > 90 || Math.abs(e.z - l) > 90) {
        continue;
      }
      let [t, r] = d(e.x, e.z);
      n.fillRect(t - 1, r - 1, 2, 2);
    }
    for (let e of t.objectives.comms) {
      if (e.active) {
        let [t, r] = d(e.x, e.z);
        n.fillStyle = '#56a8ff';
        n.beginPath();
        n.arc(t, r, 3, 0, 7);
        n.fill();
      }
    }
    if (t.objectives.finish.active) {
      let [e, r] = d(t.objectives.finish.x, t.objectives.finish.z);
      n.fillStyle = Math.sin(performance.now() / 200) > 0 ? '#6dff6a' : '#fff';
      n.fillRect(e - 4, r - 4, 8, 8);
    }
    for (let e of t.vehicles) {
      if (e === a) {
        continue;
      }
      let [t, r] = d(e.curr.x, e.curr.z);
      n.fillStyle = '#56d8ff';
      n.beginPath();
      n.arc(t, r, 3, 0, 7);
      n.fill();
    }
    if (f) {
      let [e, t] = d(f.curr.x, f.curr.z);
      n.save();
      n.translate(e, t);
      n.rotate(-f.curr.yaw);
      n.fillStyle = '#ffc21a';
      n.fillRect(-2.5, -8, 5, 16);
      n.restore();
    }
    let [p, m] = d(c, l);
    n.save();
    n.translate(p, m);
    n.rotate(-(a.yaw ?? a.curr.yaw ?? 0));
    n.fillStyle = '#fff';
    n.strokeStyle = '#000';
    n.lineWidth = 1;
    n.beginPath();
    n.moveTo(0, -6);
    n.lineTo(4.5, 5);
    n.lineTo(0, 2.5);
    n.lineTo(-4.5, 5);
    n.closePath();
    n.fill();
    n.stroke();
    n.restore();
    n.restore();
    n.save();
    n.translate(r / 2, i / 2);
    n.rotate(t.camera.yaw);
    n.fillStyle = '#ffc21a';
    n.font = 'bold 14px Arial';
    n.textAlign = 'center';
    n.fillText('N', 0, -i / 2 + 16);
    n.restore();
  }
  update(e) {
    let t = this.game;
    let n = t.controlled;
    if (n) {
      let e = (n.hudInfo && n.hudInfo()) || {};
      if (this.last.vname !== n.name) {
        this.el.vname.textContent = n.name.toUpperCase();
        this.last.vname = n.name;
        this.el.vicon.style.background = VEHICLE_COLORS[n.kind] || '#ffc21a';
      }
      if (e.meter === undefined) {
        this.el.vmeter.style.display = 'none';
      } else {
        this.el.vmeter.style.display = '';
        this.el.vfill.style.width = (clampNum(e.meter, 0, 1) * 100).toFixed(1) + '%';
        if (this.last.vlabel !== e.meterLabel) {
          this.el.vlabel.textContent = e.meterLabel || '';
          this.last.vlabel = e.meterLabel;
        }
      }
      if (e.ammo !== undefined) {
        let t = e.ammo + '/' + e.maxAmmo;
        if (this.last.ammo !== t) {
          this.last.ammo = t;
          let n = '';
          for (let t = 0; t < e.maxAmmo; t++) {
            n += `<i class="${t < e.ammo ? '' : 'off'}"></i>`;
          }
          this.el.vammo.innerHTML = n;
        }
        this.el.vammo.style.display = '';
      } else {
        this.el.vammo.style.display = 'none';
      }
      let t = e.tip || '';
      if (this.last.tip !== t) {
        this.el.vtip.textContent = t;
        this.last.tip = t;
      }
    }
    this.updateCarrier(e);
    let r = t.objectives;
    for (let e in this.rows) {
      let t = `${r.got[e]}/${r.totals[e]}`;
      if (this.last[e] !== t) {
        let n = this.rows[e];
        n.querySelector('b').textContent = t;
        n.classList.toggle('done', r.got[e] >= r.totals[e]);
        if (this.last[e] !== undefined) {
          n.classList.remove('bump');
          n.offsetWidth;
          n.classList.add('bump');
        }
        this.last[e] = t;
      }
    }
    let i = formatMoney(r.damage);
    if (this.last.money !== i) {
      this.el.money.textContent = i;
      this.last.money = i;
    }
    this.el.time.textContent = formatTime(t.levelTime);
    if (this.bannerT > 0) {
      this.bannerT -= e;
      if (this.bannerT <= 0) {
        this.el.banner.classList.remove('show');
      }
    }
    if (this.warnT > 0) {
      this.warnT -= e;
      if (this.warnT <= 0) {
        this.el.warn.classList.remove('show');
      }
    }
    if (this.bbT > 0) {
      this.bbT -= e;
      if (this.bbT <= 0) {
        this.el.bb.classList.remove('show');
      }
    }
    if (this.hintT > 0) {
      this.hintT -= e;
      if (this.hintT <= 0) {
        this.hideHint();
      }
    } else {
      if (this.hintQueue.length && !this.el.hint.classList.contains('show')) {
        this._showHint(this.hintQueue.shift());
      }
    }
    for (let [e, t] of this.labels) {
      this._place(t, t._pos);
    }
    this.mapT -= e;
    if (this.mapT <= 0 && t.settings.minimap) {
      this.mapT = 1 / 24;
      this.drawMap(e);
    }
    if (this.last.minimap !== t.settings.minimap) {
      this.last.minimap = t.settings.minimap;
      this.el.mapWrap.style.display = t.settings.minimap ? '' : 'none';
    }
    this.updateArrow();
  }
  updateCarrier() {
    let e = this.game;
    let t = e.carrier;
    let n = this.el;
    if (!t) {
      return;
    }
    let r = '';
    if (e.pathClear) {
      n.ctitle.textContent = 'CARRIER';
      n.ctime.textContent = t.state === 'arrived' ? 'SAFE' : 'PATH CLEAR';
      let e = Math.max(0, t.length - t.s);
      n.csub.textContent = t.state === 'arrived' ? 'DECON STATION REACHED' : `${Math.round(e)} m TO DECON`;
      n.cbar.style.width = ((t.s / t.length) * 100).toFixed(1) + '%';
      r = 'clear';
    } else {
      let i = e.carrierNext;
      let a = i.t;
      let o = e.buildings.list.filter((e) => e.inPath && e.alive).length;
      n.ctitle.textContent = t.state === 'idle' ? 'CARRIER STANDBY' : 'CARRIER IMPACT IN';
      n.ctime.textContent = isFinite(a) ? a.toFixed(1) + 's' : '--';
      n.csub.textContent = i.b ? `${i.b.name.toUpperCase()} · ${o} IN PATH` : '';
      n.cbar.style.width = ((t.s / t.length) * 100).toFixed(1) + '%';
      if (a < 8 && t.state === 'moving') {
        r = 'danger';
      }
    }
    if (this.last.ccls !== r) {
      n.carrier.className = 'panel ' + r;
      this.last.ccls = r;
    }
  }
  updateArrow() {
    let e = this.game;
    let t = e.carrier;
    let n = this.el.arrow;
    if (!t || e.state !== 'play' || t.state === 'arrived') {
      n.style.display = 'none';
      return;
    }
    _hudVec.set(t.curr.x, 3, t.curr.z).project(e.camera3);
    if (_hudVec.z < 1 && Math.abs(_hudVec.x) < 0.95 && Math.abs(_hudVec.y) < 0.95) {
      n.style.display = 'none';
      return;
    }
    let r = _hudVec.x;
    let i = _hudVec.y;
    if (_hudVec.z > 1) {
      r = -r;
      i = -i;
    }
    let a = Math.max(Math.abs(r), Math.abs(i)) || 1;
    r /= a;
    i /= a;
    let o = window.innerWidth;
    let s = window.innerHeight;
    let c = ((r * 0.86 + 1) / 2) * o;
    let l = (1 - (i * 0.8 + 1) / 2) * s;
    n.style.display = 'block';
    n.style.left = c + 'px';
    n.style.top = l + 'px';
    n.firstElementChild.style.transform = `rotate(${Math.atan2(r, i)}rad)`;
    let u = e.controlled;
    let d = u ? Math.hypot(t.curr.x - u.curr.x, t.curr.z - u.curr.z) : 0;
    this.el.arrowDist.textContent = 'CARRIER ' + Math.round(d) + 'm';
  }
  toast(e, t = '') {
    let n = document.createElement('div');
    for (
      n.className = 'toast ' + t, n.textContent = e, this.el.toasts.prepend(n);
      this.el.toasts.children.length > 5;
    ) {
      this.el.toasts.lastChild.remove();
    }
    setTimeout(() => {
      n.classList.add('out');
      setTimeout(() => n.remove(), 450);
    }, 3600);
  }
  banner(e, t = '', n = '', r = 2.8) {
    this.el.btitle.textContent = e;
    this.el.bsub.textContent = t;
    this.el.banner.className = 'show ' + n;
    this.bannerT = r;
  }
  warn(e, t = 1.2) {
    this.el.warn.textContent = e;
    this.el.warn.classList.add('show');
    this.warnT = t;
  }
  prompt(e) {
    if (e !== this.promptText) {
      this.promptText = e;
      if (e) {
        this.el.prompt.innerHTML = e;
        this.el.prompt.classList.add('show');
      } else {
        this.el.prompt.classList.remove('show');
      }
    }
  }
  hint(e, t, n = false) {
    if ((this.game.settings.hints || n) && !this.hintsShown.has(e)) {
      this.hintsShown.add(e);
      try {
        localStorage.setItem('bbb.hints', JSON.stringify([...this.hintsShown]));
      } catch {}
      this.hintQueue.push(t);
    }
  }
  _showHint(e) {
    this.el.hintText.textContent = e;
    this.el.hint.classList.add('show');
    this.hintT = 7;
    this.game.audio.play('sfx.ui_tip', {
      volume: 0.5,
    });
  }
  hideHint() {
    this.el.hint.classList.remove('show');
    this.hintT = 0;
  }
  resetHints() {
    this.hintsShown.clear();
    try {
      localStorage.removeItem('bbb.hints');
    } catch {}
  }
  hitFlash(e, t) {
    this.el.bbName.textContent = e.name.toUpperCase() + (e.inPath ? '  ·  IN CARRIER PATH' : '');
    this.el.bbFill.style.width = (clampNum(t, 0, 1) * 100).toFixed(0) + '%';
    this.el.bb.classList.add('show');
    this.bbT = 2.2;
  }
  rduPulse() {}
  _place(e, t) {
    _hudVec.set(t.x, t.y, t.z).project(this.game.camera3);
    if (_hudVec.z > 1) {
      e.style.display = 'none';
      return;
    }
    e.style.display = '';
    e.style.left = ((_hudVec.x + 1) / 2) * window.innerWidth + 'px';
    e.style.top = (1 - (_hudVec.y + 1) / 2) * window.innerHeight + 'px';
  }
  worldLabel(e, t, n, r = '') {
    let i = this.labels.get(e);
    if (t === null) {
      if (i) {
        i.remove();
        this.labels.delete(e);
      }
      return;
    }
    if (!i) {
      i = document.createElement('div');
      i.className = 'wlabel ' + r;
      this.el.labels.appendChild(i);
      this.labels.set(e, i);
    }
    if (i.textContent !== t) {
      i.textContent = t;
    }
    i._pos = n;
  }
  popup(e, t, n = '') {
    let r = document.createElement('div');
    r.className = 'popup ' + n;
    r.textContent = typeof e == 'number' ? '-' + e : e;
    this._place(r, {
      x: t[0],
      y: t[1] + 1,
      z: t[2],
    });
    this.el.labels.appendChild(r);
    setTimeout(() => r.remove(), 900);
  }
  countdown(e) {
    let t = this.el.countdown;
    t.textContent = e;
    t.classList.remove('go');
    t.offsetWidth;
    t.classList.add('go');
  }
}
const VEHICLE_COLORS = {
  backlash: '#ffc21a',
  ramdozer: '#ffb000',
  police: '#56a8ff',
  ballista: '#ff4a3a',
  jbomb: '#2f6fd6',
  train: '#c9ced6',
  worker: '#ff8a00',
};
class Menus {
  constructor(e) {
    this.game = e;
    this.stack = [];
    this.focusStack = [];
    this.current = null;
    this.focusIdx = 0;
    document.querySelectorAll('#menus .btn').forEach((e) => {
      e.addEventListener('click', (t) => {
        t.preventDefault();
        this.game.audio.unlock();
        this.game.audio.play('sfx.ui_select', {
          volume: 0.7,
        });
        this.action(e.dataset.act);
      });
      e.addEventListener('pointerenter', () => {
        let t = this.buttons().indexOf(e);
        if (t >= 0) {
          this.focusIdx = t;
          this.paintFocus();
        }
      });
    });
    this.bindOptions();
    byId('title-foot').textContent =
      `Brickblast Brigade vertical slice · generated ${e.meta.date} · AI model: ${e.meta.model} · based on Blast Corps (Rare, 1997) for internal testing`;
  }
  show(e, t = false) {
    if (t && this.current) {
      this.stack.push(this.current);
      this.focusStack.push(this.focusIdx);
    }
    document.querySelectorAll('#menus .screen').forEach((t) => t.classList.toggle('active', t.id === e));
    this.current = e;
    // Start on the screen's main button (Start, Begin, Resume, Back…).
    this.focusIdx = Math.max(
      0,
      this.buttons().findIndex((e) => e.classList.contains('primary')),
    );
    if (e === 'scr-pause') {
      byId('btn-finish').style.display = this.game.pathClear ? '' : 'none';
    }
    if (e === 'scr-options') {
      this.syncOptions();
    }
    if (e === 'scr-stats') {
      this.renderStats();
    }
    if (e === 'scr-records') {
      this.renderRecords();
    }
    if (e === 'scr-about') {
      this.renderAbout();
    }
    if (e === 'scr-docs') {
      this.renderDocs();
    }
    this.paintFocus();
  }
  hide() {
    document.querySelectorAll('#menus .screen').forEach((e) => e.classList.remove('active'));
    this.current = null;
    this.stack = [];
    this.focusStack = [];
  }
  back() {
    let e = this.stack.pop();
    if (e) {
      let t = this.focusStack.pop();
      this.show(e);
      // Back on the button that opened the screen, so a gamepad does not start over at the top.
      if (t !== undefined && t < this.buttons().length) {
        this.focusIdx = t;
        this.paintFocus();
      }
    } else {
      if (this.game.state === 'paused') {
        this.game.resume();
      }
    }
  }
  /** What the gamepad and arrow keys can land on: buttons, and option rows (a label around an input or select). */
  buttons() {
    let e = this.current && byId(this.current);
    return e
      ? [...e.querySelectorAll('.btn, .opts label, .inline-opt')].filter((e) => e.offsetParent !== null && !e.disabled)
      : [];
  }
  /** Change an option row from the gamepad or keyboard: left/right steps it, confirm toggles or cycles it. */
  adjust(e, t, n = false) {
    let r = e.querySelector('input, select');
    if (!r) {
      return;
    }
    if (r.type === 'checkbox') {
      r.checked = !r.checked;
      r.dispatchEvent(new Event('change'));
    } else if (r.tagName === 'SELECT') {
      let e = r.options.length;
      r.selectedIndex = (r.selectedIndex + t + e) % e;
      r.dispatchEvent(new Event('change'));
    } else if (r.type === 'range') {
      if (n) {
        return;
      }
      let e = +r.step || 0.05;
      let i = clampNum(+r.value + t * e, +r.min, +r.max);
      r.value = String(Math.round(i / e) * e);
      r.dispatchEvent(new Event('input'));
    }
    this.game.audio.play('sfx.ui_move', {
      volume: 0.5,
    });
  }
  paintFocus() {
    this.buttons().forEach((e, t) => {
      let n = t === this.focusIdx && this.navUsed;
      e.classList.toggle('focus', n);
      // Keep the focused row visible in a card that scrolls (Options on a phone).
      if (n) {
        e.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  /**
   * On a screen that is text plus a row of buttons (Documentation, Controls,
   * Stats…), up/down scrolls the text for the gamepad and keyboard.
   */
  scrollBox(e) {
    if (!e.every((e) => e.closest('.menu.row'))) {
      return null;
    }
    let t = byId(this.current);
    for (let n of t.querySelectorAll('.docs-scroll, .card')) {
      if (n.scrollHeight > n.clientHeight + 4) {
        return n;
      }
    }
    return null;
  }
  nav(e, t) {
    if (!this.current) {
      return;
    }
    let n = this.buttons();
    if (!n.length) {
      return;
    }
    let r = 0;
    let o = 0;
    let i = performance.now();
    let a = t.moveY;
    let sb = Math.abs(a) > 0.3 ? this.scrollBox(n) : null;
    if (sb) {
      sb.scrollTop -= a * 900 * Math.min(0.05, (i - (this.scrollT || i)) / 1000 || 1 / 60);
      a = 0;
    }
    this.scrollT = i;
    if (Math.abs(a) > 0.5 || Math.abs(t.moveX) > 0.5) {
      if (!this.navHeld || i - this.navT > 220) {
        let e = n[this.focusIdx];
        if (Math.abs(a) <= 0.5 && e && e.tagName === 'LABEL') {
          o = t.moveX > 0 ? 1 : -1;
        } else {
          r = Math.abs(a) > 0.5 ? (a > 0 ? -1 : 1) : t.moveX > 0 ? 1 : -1;
        }
        this.navT = i;
      }
      this.navHeld = true;
    } else {
      this.navHeld = false;
    }
    if (o) {
      this.navUsed = true;
      this.paintFocus();
      this.adjust(n[this.focusIdx], o);
    }
    if (r) {
      this.navUsed = true;
      this.focusIdx = (this.focusIdx + r + n.length) % n.length;
      this.paintFocus();
      this.game.audio.play('sfx.ui_move', {
        volume: 0.5,
      });
    }
    // Start also begins from the title screen, as its prompt says.
    let s = this.current === 'scr-title' && e.pausePressed;
    if (e.enterPressed || e.actionPressed || s) {
      if (this.current === 'scr-title' && !this.navUsed) {
        this.navUsed = true;
        this.action('start');
        return;
      }
      let e = n[this.focusIdx];
      if (e && e.tagName === 'LABEL') {
        this.navUsed = true;
        this.paintFocus();
        this.adjust(e, 1, true);
      } else if (e) {
        this.game.audio.play('sfx.ui_select', {
          volume: 0.7,
        });
        this.action(e.dataset.act);
      }
      return;
    }
    if (e.pausePressed || e.altPressed || e.backPressed) {
      if (this.current === 'scr-pause') {
        this.game.resume();
      } else {
        if (this.current !== 'scr-title' && this.current !== 'scr-results' && this.current !== 'scr-failed') {
          this.game.audio.play('sfx.ui_back', {
            volume: 0.6,
          });
          this.back();
        }
      }
    }
  }
  action(e) {
    let t = this.game;
    switch (e) {
      case 'start':
        this.show('scr-briefing', true);
        byId('brief-speed').value = t.settings.carrierSpeed;
        break;
      case 'begin':
        t.settings.carrierSpeed = byId('brief-speed').value;
        t.save.write();
        this.hide();
        t.beginMission();
        break;
      case 'controls':
        this.show('scr-controls', true);
        break;
      case 'options':
        this.show('scr-options', true);
        break;
      case 'records':
        this.show('scr-records', true);
        break;
      case 'docs':
        this.show('scr-docs', true);
        break;
      case 'about':
        this.show('scr-about', true);
        break;
      case 'stats':
        this.show('scr-stats', true);
        break;
      case 'back':
        this.back();
        break;
      case 'resume':
        t.resume();
        break;
      case 'restart':
        this.hide();
        t.restart();
        break;
      case 'retry':
        this.hide();
        t.restart();
        break;
      case 'finish':
        this.hide();
        t.finishMission();
        break;
      case 'quit':
        this.hide();
        t.quitToTitle();
        break;
      case 'fullscreen':
        t.toggleFullscreen();
        break;
      case 'kitmenu':
        t.kit.menu.open();
        break;
      case 'resetsave': {
        // Press twice to confirm (a native confirm() cannot be answered with a gamepad).
        let n = document.querySelector('#scr-options [data-act="resetsave"]');
        if (!this.resetArmed) {
          this.resetArmed = true;
          n.textContent = 'Press again to reset';
          clearTimeout(this.resetTimer);
          this.resetTimer = setTimeout(() => {
            this.resetArmed = false;
            n.textContent = 'Reset Records';
          }, 3000);
        } else {
          clearTimeout(this.resetTimer);
          this.resetArmed = false;
          t.save.resetRecords();
          t.hud.resetHints();
          n.textContent = 'Records reset';
          this.resetTimer = setTimeout(() => (n.textContent = 'Reset Records'), 1500);
        }
        break;
      }
    }
  }
  bindOptions() {
    let e = this.game;
    let t = (e, t, n) => byId(e).addEventListener(t, n);
    t('opt-master', 'input', (t) => {
      e.settings.master = +t.target.value;
      e.applySettings();
    });
    t('opt-music', 'input', (t) => {
      e.settings.music = +t.target.value;
      e.applySettings();
    });
    t('opt-sfx', 'input', (t) => {
      e.settings.sfx = +t.target.value;
      e.applySettings();
    });
    t('opt-mute', 'change', (t) => {
      e.settings.mute = t.target.checked;
      e.applySettings();
    });
    t('opt-diag', 'change', (t) => {
      e.settings.diag = t.target.checked;
      e.applySettings();
    });
    t('opt-scheme', 'change', (t) => {
      e.settings.scheme = t.target.value;
      e.applySettings();
    });
    t('opt-autocam', 'change', (t) => {
      e.settings.autocam = t.target.checked;
      e.applySettings();
    });
    t('opt-assist', 'change', (t) => {
      e.settings.slideAssist = t.target.checked;
      e.applySettings();
    });
    t('opt-shake', 'change', (t) => {
      e.settings.shake = t.target.checked;
      e.applySettings();
    });
    t('opt-hints', 'change', (t) => {
      e.settings.hints = t.target.checked;
      e.applySettings();
    });
    t('opt-map', 'change', (t) => {
      e.settings.minimap = t.target.checked;
      e.applySettings();
    });
    t('opt-speed', 'change', (t) => {
      e.settings.carrierSpeed = t.target.value;
      e.applySettings();
    });
  }
  syncOptions() {
    let e = this.game.settings;
    byId('opt-master').value = e.master;
    byId('opt-music').value = e.music;
    byId('opt-sfx').value = e.sfx;
    byId('opt-mute').checked = e.mute;
    byId('opt-diag').checked = e.diag;
    byId('opt-scheme').value = e.scheme;
    byId('opt-autocam').checked = e.autocam;
    byId('opt-assist').checked = e.slideAssist !== false;
    byId('opt-shake').checked = e.shake;
    byId('opt-hints').checked = e.hints;
    byId('opt-map').checked = e.minimap;
    byId('opt-speed').value = e.carrierSpeed;
  }
  statsTable(e) {
    let t = (e, [t, n], r = '') => `<tr class="${t >= n ? 'ok' : ''}"><td>${e}</td><td>${t} / ${n}${r}</td></tr>`;
    return `<table class="stat-table">
      <tr class="${e.pathClear ? 'ok' : ''}"><td>Carrier path cleared</td><td>${e.pathClear ? 'YES · ' + formatTime(e.pathTime) : 'NOT YET'}</td></tr>
      ${t('Buildings destroyed', e.buildings)}${t('RDUs activated', e.rdus)}${t('Survivors rescued', e.survivors)}
      ${t('Communication points', e.comms)}${t('Scientists found', e.scientists)}${t('Secrets', e.secrets)}
      <tr><td>Damage bill</td><td>${formatMoney(e.damage)}</td></tr>
      <tr><td>Mission time</td><td>${formatTime(e.time)}</td></tr>
      <tr class="${e.percent >= 100 ? 'ok' : ''}"><td>Completion</td><td>${e.percent}%</td></tr></table>`;
  }
  renderStats() {
    byId('stats-body').innerHTML = this.statsTable(this.game.objectives.stats());
  }
  renderRecords() {
    let e = this.game.save.records;
    byId('records-body').innerHTML = `
      <div class="rec-row"><span>Best commendation</span><span>${e.medal.toUpperCase()}</span></div>
      <div class="rec-row"><span>Best completion</span><span>${e.bestPercent}%</span></div>
      <div class="rec-row"><span>Fastest path clear</span><span>${e.bestPathTime === null ? '—' : formatTime(e.bestPathTime)}</span></div>
      <div class="rec-row"><span>Fastest 100%</span><span>${e.bestTime100 === null ? '—' : formatTime(e.bestTime100)}</span></div>
      <div class="rec-row"><span>Biggest damage bill</span><span>${formatMoney(e.bestDamage)}</span></div>
      <div class="rec-row"><span>Missions played / cleared</span><span>${e.plays} / ${e.clears}</span></div>
      <p style="font-size:12px;color:#aaa">Commendations: <b>Bronze</b> path cleared · <b>Silver</b> 70%+ · <b>Gold</b> 100% · <b>Platinum</b> 100% in under ${formatTime(660)}. Saved locally in this browser.</p>`;
  }
  renderAbout() {
    let e = this.game;
    byId('about-body').innerHTML =
      `<p><b>Brickblast Brigade</b> is a playable vertical slice that remasters the <b>Argent Towers</b> carrier mission of <i>Blast Corps</i> (Rare, Nintendo 64, 1997) in a low-poly, brick-built toy style.</p>
      <p>Generated on <b>${e.meta.date}</b> by AI model <b>${e.meta.model}</b>.</p>
      <p>Renderer: <b>${e.renderer.backend}</b> · Three.js r${e.meta.three} · Rapier ${e.meta.rapier}</p>
      <p style="font-size:12px;color:#aaa">Internal, non-commercial test build. Blast Corps and all related names belong to their respective owners. Audio in this build is original synthesized placeholder material routed through a swappable manifest — see Documentation.</p>`;
  }
  renderDocs() {
    let e = document.getElementById('embedded-docs');
    byId('docs-body').innerHTML = e ? e.innerHTML : '<p>Documentation not embedded.</p>';
  }
  showResults(e, t, n) {
    let r = byId('res-medal');
    r.className = 'medal ' + t;
    r.textContent = t === 'none' ? 'NO MEDAL' : t.toUpperCase();
    let i = n.length
      ? `<p style="color:#6dff6a;font-weight:900">NEW RECORD: ${n
          .map(
            (e) =>
              ({
                medal: 'Commendation',
                percent: 'Completion',
                time100: '100% time',
                pathTime: 'Path clear time',
                damage: 'Damage bill',
              })[e],
          )
          .join(' · ')}</p>`
      : '';
    let a =
      t === 'gold'
        ? `<p style="font-size:12px;color:#aaa">Platinum: finish at 100% in under ${formatTime(660)}.</p>`
        : t === 'bronze' || t === 'silver'
          ? '<p style="font-size:12px;color:#aaa">Gold needs 100%: every RDU, building, survivor, comm point, the scientist and the secret.</p>'
          : '';
    byId('res-body').innerHTML =
      this.statsTable(e) +
      i +
      a +
      (e.relaxed ? '<p style="font-size:12px;color:#aaa">Played with Relaxed carrier speed.</p>' : '');
    this.show('scr-results');
  }
  showFailed(e) {
    byId('fail-reason').textContent = e;
    this.show('scr-failed');
  }
}
const _occTarget = new Vector3();
const _occDir = new Vector3();
const _occHit = new Vector3();
const _occRay = new Ray();
const _occBox = new Box3();
const VEHICLE_CLASSES = {
  backlash: Backlash,
  ramdozer: Ramdozer,
  police: PoliceCar,
  ballista: Ballista,
  jbomb: JBomb,
};
const AREA_HINTS = [
  {
    key: 'area-block',
    x: -76,
    z: 55,
    r: 22,
    text: 'That concrete block is hiding a stairway. Shove it aside with a vehicle.',
    when: (e) => !e.block.moved,
  },
  {
    key: 'area-fountain',
    x: 42,
    z: 120,
    r: 16,
    text: 'A strange crystal sparkles inside the bollards. Something with range — or from the air — could reach it.',
    when: (e) => e.secret.alive,
  },
  {
    key: 'area-pit',
    x: 150,
    z: 100,
    r: 20,
    text: 'Two buildings wall off a pit behind them. Clear them to get in.',
    when: (e) => e.buildings.byId.get('B1').alive || e.buildings.byId.get('B2').alive,
  },
  {
    key: 'area-compound',
    x: 94,
    z: -104,
    r: 14,
    text: 'This fence is too tall for any wheels. Only something that flies will get inside.',
    when: (e) => e.controlled.kind !== 'jbomb',
  },
  {
    key: 'area-deck',
    x: -40,
    z: -104,
    r: 14,
    text: "The Skydeck sits 8 m up with no ramps. You'll need to get airborne.",
    when: (e) => e.controlled.kind !== 'jbomb',
  },
  {
    key: 'area-maze',
    x: -123,
    z: -61,
    r: 8,
    text: 'The cave across from the beacon is a maze. The police car makes quick work of it.',
    when: (e) => !e.objectives.got.scientists,
  },
];
const VEHICLE_HINTS = {
  backlash: 'BACKLASH: build speed, then hold SLIDE (Space / ACT) and steer to swing the armoured rear into buildings.',
  ramdozer: 'RAMDOZER: ram buildings head-on and shove TNT crates with the blade.',
  police: 'POLICE CAR: quick and nimble — no demolition power. Action toggles the siren.',
  ballista: 'BALLISTA: Action fires missiles (limited ammo), Alt kicks in the turbo.',
  jbomb: 'J-BOMB: hold Action to fly, then press Alt in mid-air to STOMP straight down onto a building.',
  train: 'SUBWAY: throttle drives north, brake heads south. Stop at a station and hop off.',
  worker: "ON FOOT: walk where vehicles can't. Press F / Y / ENTER beside any vehicle to climb in.",
};
class Game {
  constructor({ kit: k, renderer: e, audio: t, input: n, meta: r }) {
    this.kit = k;
    this.renderer = e;
    this.audio = t;
    this.input = n;
    this.meta = r;
    this.save = new SaveData();
    this.settings = this.save.settings;
    this.state = 'loading';
    this.time = 0;
    this.levelTime = 0;
    this.accum = 0;
    this.perf = {
      frameMs: 16.7,
    };
    // Effect budgets (debris bodies, particles…) follow the kit's quality tier.
    this.quality = e.preset;
    e.onPreset((e) => (this.quality = e));
  }
  async init(e) {
    let t = (this.scene = new Scene());
    this.camera3 = new PerspectiveCamera(42, this.kit.size.width / this.kit.size.height, 0.5, 2000);
    this.camera = new CameraRig(this.camera3);
    e(0.35, 'Lighting the sky…');
    this.sky = createSky(t, this.renderer.r);
    e(0.42, 'Starting physics…');
    this.physics = new Physics();
    this.physics.init(this.kit.RAPIER);
    this.meta.rapier = this.physics.R.version();
    e(0.5, 'Laying bricks…');
    this.world = new World();
    this.world.build(t);
    this.fx = new Effects(this, t);
    this.skids = new Skids(t, 600);
    this.renderer.setScene(t, this.camera3, this.sky.sun);
    this.hud = new Hud(this);
    this.menus = new Menus(this);
    e(0.62, 'Building Argent Towers…');
    this.newRun();
    this.applySettings();
    e(0.75, 'Compiling shaders…');
    let n = [];
    t.traverse((e) => {
      e.visible ||= (n.push(e), true);
    });
    let r = [];
    t.traverse((e) => {
      if (e.isInstancedMesh && e.count === 0) {
        r.push(e);
        e.count = 1;
      }
    });
    try {
      await this.renderer.r.compileAsync(t, this.camera3);
    } catch (e) {
      console.warn(e);
    }
    for (let e of n) {
      e.visible = false;
    }
    for (let e of r) {
      e.count = 0;
    }
    e(0.95, 'Ready');
  }
  /** Graphics quality and touch controls live in the kit's settings panel; these are the game's own. */
  applySettings() {
    let t = this.settings;
    this.audio.setVolumes({
      master: t.master,
      music: t.music,
      sfx: t.sfx,
    });
    this.audio.setMuted(t.mute);
    document.getElementById('diag').classList.toggle('hidden', !t.diag);
    this.input.touchScheme = t.scheme;
    this.camera.autoRotate = t.autocam;
    this.camera.shakeEnabled = t.shake;
    if (this.carrier) {
      this.carrier.speed = t.carrierSpeed === 'relaxed' ? CARRIER.relaxedSpeed : CARRIER.speed;
    }
    this.save.write();
  }
  newRun() {
    let e = this.physics;
    e.newWorld();
    this.world.createColliders(e);
    let t = this.scene;
    let n = 0;
    let r = 0;
    for (let e of BUILDINGS) {
      n += e.courses * (e.w + e.d - 2) + 12;
      r += (e.w / 2) * (e.d / 2);
    }
    this.bricks = new Bricks(this, t, n + 700, r + 260);
    this.buildings = new Buildings(this, t, BUILDINGS);
    this.bricks.sealStatic();
    this.props = new Props(this, t, propLayout());
    this.props.createColliders(e);
    let i = this.settings.carrierSpeed === 'relaxed' ? CARRIER.relaxedSpeed : CARRIER.speed;
    this.carrier = new MissileCarrier(this, carrierPath(), {
      ...CARRIER,
      speed: i,
    });
    this.buildings.markPath(this.carrier.computeObstacles(this.buildings.list));
    this.vehicles = VEHICLE_SPAWNS.map((e) => new VEHICLE_CLASSES[e.type](this, e.x, e.y, e.z, e.yaw));
    this.train = new SubwayTrain(this, TRAIN);
    this.vehicles.push(this.train);
    this.tnts = TNT.map((e) => new TntCrate(this, e));
    this.block = new PushBlock(this, BLOCK);
    this.doors = DOORS.map((e) => new Door(this, e));
    this.gate = new Gate(this, GATES[0]);
    this.missiles = new Missiles(this);
    this.ammo = new AmmoCrates(this, AMMO);
    this.beacon = new TunnelBeacon(this, BEACON);
    this.secret = new SecretCrystal(this, SECRET);
    this.objectives = new Objectives(this, t, LEVEL, this.world.maze.path);
    this.worker = null;
    this.controlled = this.vehicles[0];
    this.controlled.setDriven(true);
    this.levelTime = 0;
    this.pathClear = false;
    this.pathClearTime = null;
    this.carrierNext = this.carrier.nextObstacle();
    this.carrierUrgency = 0;
    this.alarmT = 0;
    this.accum = 0;
    this.timeScale = 1;
    this.timers = [];
    this.fx.clear();
    this.skids.clear();
    this.hud.reset();
    let a = this.controlled;
    this.camera.snap(a.curr.x, 0, a.curr.z, 0);
    this.updateTouchLabels();
  }
  disposeRun() {
    for (let e of this.vehicles) {
      e.dispose();
    }
    if (this.worker) {
      this.worker.dispose();
    }
    this.carrier.dispose();
    for (let e of this.tnts) {
      e.dispose();
    }
    this.block.dispose();
    for (let e of this.doors) {
      e.dispose();
    }
    this.gate.dispose();
    this.missiles.dispose();
    this.ammo.dispose();
    this.beacon.dispose();
    this.secret.dispose();
    this.objectives.dispose();
    this.props.dispose();
    this.buildings.dispose();
    this.bricks.dispose(this.scene);
    this.vehicles = [];
    this.worker = null;
  }
  toTitle() {
    this.state = 'title';
    this.menus.show('scr-title');
    this.hud.show(false);
    this.setPlaying(false);
    this.audio.playMusic('music.title');
  }
  beginMission() {
    this.state = 'intro';
    this.hud.show(false);
    this.audio.playMusic('music.level', {
      fade: 1.5,
    });
    carrierPath();
    this.hud.banner('ARGENT TOWERS', 'Carrier route: 7 buildings in the way', '', 3.5);
    this.hud.show(true);
    this.camera.play(
      [
        {
          t: 0,
          pos: [40, 70, 300],
          look: [0, 0, 230],
        },
        {
          t: 2.6,
          pos: [34, 55, 150],
          look: [0, 0, 90],
        },
        {
          t: 5,
          pos: [40, 55, 40],
          look: [0, 0, -10],
        },
        {
          t: 7.2,
          pos: [110, 60, 10],
          look: [80, 0, -58],
        },
        {
          t: 9,
          pos: [0, 40, 222],
          look: [0, 0, 190],
        },
      ],
      () => this.startCountdown(),
    );
  }
  startCountdown() {
    let e = this.controlled;
    this.camera.snap(e.curr.x, 0, e.curr.z, 0);
    this.state = 'countdown';
    this.cdT = 3;
    this.cdShown = 4;
    this.hud.show(true);
    this.setPlaying(true);
    this.hud.hint(
      'start',
      'The carrier is coming up Main Street! Clear the 7 flashing buildings in its path before it arrives.',
      true,
    );
    this.hud.hint('backlash', VEHICLE_HINTS.backlash);
  }
  /** In play the HUD styles switch and the kit's touch controls show; menus and cutscenes hide them. */
  setPlaying(e) {
    document.body.classList.toggle('playing', e);
    this.input.suspendTouch(!e);
  }
  pause() {
    if (this.state === 'play') {
      this.state = 'paused';
      this.menus.show('scr-pause');
      this.audio.duckMusic(0.35);
      this.setPlaying(false);
    }
  }
  resume() {
    if (this.state === 'paused') {
      this.menus.hide();
      this.state = 'play';
      this.audio.duckMusic(1);
      this.setPlaying(true);
      // The button that closed the menu must not also fire in the game.
      this.kit.input.settle();
    }
  }
  restart() {
    this.disposeRun();
    this.newRun();
    this.audio.playMusic('music.level', {
      fade: 0.5,
    });
    this.hud.show(true);
    this.startCountdown();
  }
  quitToTitle() {
    this.disposeRun();
    this.newRun();
    this.toTitle();
  }
  finishMission() {
    if (!this.pathClear) {
      return;
    }
    this.state = 'results';
    this.setPlaying(false);
    this.hud.show(false);
    let e = this.objectives.stats();
    let t = medalFor(e);
    let n = this.save.recordRun(e, t);
    this.audio.playMusic('music.results', {
      fade: 0.4,
    });
    this.audio.play('sfx.medal');
    this.fx.confetti(this.controlled.curr.x, this.controlled.curr.y + 3, this.controlled.curr.z, 80);
    this.menus.showResults(e, t, n);
  }
  toggleFullscreen() {
    let e = document;
    if (!e.fullscreenElement && !e.webkitFullscreenElement) {
      let t = e.documentElement;
      (t.requestFullscreen || t.webkitRequestFullscreen)?.call(t);
    } else {
      (e.exitFullscreen || e.webkitExitFullscreen)?.call(e);
    }
  }
  debugStart() {
    this.menus.hide();
    this.camera.script = null;
    this.hud.show(true);
    this.setPlaying(true);
    this.state = 'play';
    this.carrier.start();
  }
  debugSim(e, t) {
    let n = Math.round(e / FIXED_DT);
    for (let e = 0; e < n; e++) {
      let n = this.input.blank();
      if (t) {
        t(n, e * FIXED_DT, this);
      }
      if (this.state === 'meltdown') {
        this.meltT += FIXED_DT;
        if (this.meltT > 3.2) {
          this.state = 'failed';
        }
      }
      this.fixedStep(FIXED_DT, this.state === 'play' ? n : null);
      if (this.state !== 'play' && this.state !== 'meltdown') {
        break;
      }
    }
  }
  debugRender(e = 1, t = true) {
    let n = this.controlled;
    if (t && n && this.state !== 'title') {
      this.camera.snap(n.curr.x, (n.groundPos || n.curr).y, n.curr.z);
    }
    for (let t = 0; t < e; t++) {
      this.time += 1 / 60;
      this.render(1, 1 / 60, this.input.blank());
    }
  }
  frame(e) {
    let t = Math.min(e, 0.1);
    this.time += t;
    let n = this.controlled;
    let r = this.state === 'play' ? (n && n.isCar ? 'car' : n && n.isTrain ? 'train' : 'walker') : 'menu';
    let i = this.input.poll(r, t);
    if (i.anyPressed) {
      this.audio.unlock();
    }
    if (i.diagPressed) {
      this.settings.diag = !this.settings.diag;
      this.applySettings();
    }
    if (i.mapPressed && this.state === 'play') {
      this.settings.minimap = !this.settings.minimap;
      this.applySettings();
    }
    this.trackPerf(e);
    let a = 0;
    switch (this.state) {
      case 'title':
        this.titleCam(t);
        this.menus.nav(i, i);
        break;
      case 'intro':
        if (i.anyPressed || i.enterPressed) {
          this.camera.skip();
        }
        break;
      case 'countdown': {
        this.cdT -= t;
        let e = Math.ceil(this.cdT);
        if (e !== this.cdShown && e >= 0) {
          this.cdShown = e;
          this.hud.countdown(e > 0 ? String(e) : 'GO!');
          this.audio.play(e > 0 ? 'sfx.count' : 'sfx.go');
        }
        if (this.cdT <= 0) {
          this.state = 'play';
          this.carrier.start();
        }
        a = t;
        break;
      }
      case 'play':
        if (i.pausePressed) {
          this.pause();
          break;
        }
        if (i.statsPressed) {
          this.pause();
          this.menus.show('scr-stats', true);
          break;
        }
        a = t;
        if (this.hitStopT > 0) {
          this.hitStopT -= t;
          a = t * 0.12;
        }
        break;
      case 'meltdown':
        this.meltT += t;
        a = t * 0.35;
        if (this.meltT > 3.2) {
          this.state = 'failed';
          this.menus.showFailed(this.failReason);
          this.hud.show(false);
          this.setPlaying(false);
        }
        break;
      default:
        this.menus.nav(i, i);
        a = this.state === 'results' || this.state === 'failed' ? t : 0;
    }
    let o = (this.pressBuf ||= {
      actionPressed: false,
      altPressed: false,
      enterPressed: false,
      hornPressed: false,
    });
    if (this.state === 'play') {
      for (let e in o) {
        o[e] = o[e] || i[e];
      }
    } else {
      for (let e in o) {
        o[e] = false;
      }
    }
    if (a > 0) {
      this.accum += a;
      let e = 0;
      let t = this.state === 'play';
      for (; this.accum >= 0.016666666666666666 && e < 4; ) {
        if (t && e === 0) {
          for (let e in o) {
            i[e] = o[e];
            o[e] = false;
          }
        }
        this.fixedStep(FIXED_DT, t ? i : null);
        if (t && e === 0) {
          i.actionPressed = i.altPressed = i.enterPressed = i.hornPressed = false;
        }
        this.accum -= FIXED_DT;
        e++;
      }
      if (e === 4) {
        this.accum = 0;
      }
    }
    let s = clampNum(this.accum / FIXED_DT, 0, 1);
    this.render(s, t, i);
  }
  hitStop(e = 0.06) {
    this.hitStopT = Math.max(this.hitStopT || 0, e);
  }
  after(e, t) {
    this.timers.push({
      t: e,
      fn: t,
    });
  }
  fixedStep(e, t) {
    let n = this.controlled;
    if (this.timers.length) {
      let t = [];
      this.timers = this.timers.filter((n) => ((n.t -= e), n.t <= 0 ? (t.push(n.fn), false) : true));
      for (let e of t) {
        e();
      }
    }
    if (t && t.enterPressed) {
      this.handleEnterExit(t);
    }
    if (t && t.hornPressed && n.isCar) {
      this.audio.play('sfx.horn', {
        pos: n.curr,
      });
    }
    for (let n of this.vehicles) {
      n.fixedUpdate(e, n === this.controlled ? t : null);
    }
    if (this.worker) {
      this.worker.fixedUpdate(e, this.worker === this.controlled ? t : null);
    }
    if (this.state === 'play') {
      this.carrier.fixedUpdate(e);
    }
    for (let t of this.tnts) {
      t.fixedUpdate(e);
    }
    this.gate.fixedUpdate(e);
    this.missiles.fixedUpdate(e);
    this.ammo.fixedUpdate(e);
    if (this.state === 'play') {
      this.objectives.fixedUpdate(e);
    }
    this.bricks.fixedUpdate(e);
    this.physics.step();
    for (let t of this.vehicles) {
      t.afterStep(e);
    }
    if (this.worker) {
      this.worker.afterStep(e);
    }
    for (let t of this.tnts) {
      t.afterStep(e);
    }
    this.block.afterStep(e);
    if (this.state === 'play') {
      this.levelTime += e;
      this.hintScanT = (this.hintScanT || 0) - e;
      if (this.hintScanT <= 0) {
        this.hintScanT = 0.5;
        let e = this.controlled.curr;
        for (let t of AREA_HINTS) {
          if (!this.hud.hintsShown.has(t.key) && Math.hypot(e.x - t.x, e.z - t.z) < t.r && t.when(this)) {
            this.hud.hint(t.key, t.text);
          }
        }
      }
      this.carrierNext = this.carrier.nextObstacle();
      this.carrierUrgency =
        this.carrier.state === 'moving' && !this.pathClear ? clampNum(1 - this.carrierNext.t / 14, 0, 1) : 0;
      this.alarmT -= e;
      if (this.carrierNext.t < 6 && this.carrier.state === 'moving' && this.alarmT <= 0) {
        this.alarmT = 1;
        this.audio.play('sfx.alarm', {
          volume: 0.7,
        });
        this.hud.warn('⚠ COLLISION IMMINENT ⚠', 1.1);
      }
    }
  }
  nearestEnterable() {
    let e = this.worker;
    if (!e) {
      return null;
    }
    let t = null;
    let n = 3.4;
    for (let r of this.vehicles) {
      let i = r.obb ? r.obb(0) : null;
      if (!i) {
        continue;
      }
      let a = r.groundPos ? r.groundPos.y : r.curr.y;
      if (Math.abs(a - (e.curr.y - 0.95)) > 2.6) {
        continue;
      }
      let o = obbDistance(e.curr.x, e.curr.z, i);
      if (o < n) {
        n = o;
        t = r;
      }
    }
    return t;
  }
  handleEnterExit(e) {
    let t = this.controlled;
    if (this.objectives.nearFinish && this.pathClear) {
      this.finishMission();
      return;
    }
    if (t === this.worker) {
      let e = this.nearestEnterable();
      if (e) {
        this.possess(e);
      }
      return;
    }
    if (!(t.isTrain ? Math.abs(t.v) < 1.2 : t.kind === 'jbomb' ? t.grounded : Math.abs(t.vf) < 4.5)) {
      this.hud.toast(
        t.isTrain ? 'Stop the train first.' : t.kind === 'jbomb' ? 'Land first!' : 'Slow down to hop out.',
        'warn',
      );
      return;
    }
    let n = e.moveX || 0;
    let r = t.exitSpot(n);
    if (!r) {
      this.hud.toast('No room to get out here.', 'warn');
      return;
    }
    t.setDriven(false);
    this.worker = new Worker(this, r.x, r.y, r.z, t.yaw ?? 0);
    this.controlled = this.worker;
    this.audio.play('sfx.door', {
      pos: r,
    });
    this.hud.hint('worker', VEHICLE_HINTS.worker);
    this.updateTouchLabels();
  }
  possess(e) {
    this.worker &&= (this.worker.dispose(), null);
    this.controlled = e;
    e.setDriven(true);
    this.audio.play('sfx.door', {
      pos: e.curr,
    });
    this.audio.play('sfx.engine_start', {
      pos: e.curr,
      volume: 0.8,
    });
    this.hud.hint(e.kind, VEHICLE_HINTS[e.kind]);
    this.hud.toast(e.name + ' ready.', 'info');
    this.updateTouchLabels();
    if (e.kind === 'train') {
      this.hud.hint('beacon', 'Watch for a flashing beacon on the tunnel wall — something is hidden across from it.');
    }
  }
  updateTouchLabels() {
    let e = this.controlled;
    if (!e) {
      return;
    }
    let t = e.touchLabels
      ? e.touchLabels()
      : {
          action: '',
          alt: '',
        };
    let n = e.isWalker;
    this.input.setTouchLabels({
      action: t.action,
      alt: t.alt,
      enter: n && e === this.worker ? '' : 'EXIT',
      showGas: !n,
      brake: e.isTrain ? 'SOUTH' : 'BRAKE',
    });
    this.input.setTouchLabels({
      gas: e.isTrain ? 'NORTH' : 'GAS',
    });
  }
  blastAt(e, t, n, r, i, a, o) {
    for (let o of this.buildings.list) {
      if (!o.alive) {
        continue;
      }
      let s = o.closest(e, t, n);
      let c = Math.hypot(s[0] - e, s[1] - t, s[2] - n);
      if (c < r) {
        let t = i * (1 - (c / r) * 0.6);
        let l = o.cx - e;
        let u = o.cz - n;
        let d = Math.hypot(l, u) || 1;
        o.damage(t, s[0], s[1], s[2], l / d, u / d, a);
        if (t > 30) {
          this.hud.popup(Math.round(t), s, t > 120 ? 'big' : '');
        }
      }
    }
    for (let i of this.doors) {
      if (!i.alive) {
        continue;
      }
      let a = i.d;
      let o = clampNum(e, a.x - a.w / 2, a.x + a.w / 2);
      let s = clampNum(t, a.y, a.y + a.h);
      let c = clampNum(n, a.z - a.d / 2, a.z + a.d / 2);
      if (Math.hypot(o - e, s - t, c - n) < r) {
        i.destroy();
      }
    }
    if (
      this.secret.alive &&
      Math.hypot(this.secret.x - e, this.secret.z - n) < r + 1.5 &&
      Math.abs(this.secret.y - t) < r + 3
    ) {
      this.secret.shatter();
    }
    for (let t of this.tnts) {
      if (t.alive && t !== o && Math.hypot(t.curr.x - e, t.curr.z - n) < r) {
        t.light(0.35);
      }
    }
    this.props.blast(e, t, n, r * 0.9, o);
    for (let t of this.vehicles) {
      if (!t.body || t.isTrain) {
        continue;
      }
      let i = t.curr.x - e;
      let a = t.curr.z - n;
      let o = Math.hypot(i, a);
      if (o < r * 1.3 && o > 0.1) {
        let e = (1 - o / (r * 1.3)) * 8;
        let n = t.body.linvel();
        t.body.setLinvel(
          {
            x: n.x + (i / o) * e,
            y: n.y + e * 0.4,
            z: n.z + (a / o) * e,
          },
          true,
        );
      }
    }
    if (this.worker && Math.hypot(this.worker.curr.x - e, this.worker.curr.z - n) < r) {
      this.worker.knock = 7;
    }
  }
  onBuildingDestroyed(e, t) {
    let n = this.objectives;
    n.got.buildings++;
    if (e.def.survivor) {
      this.after(0.9, () => {
        if (this.objectives === n) {
          n.spawnSurvivor(e);
        }
      });
    }
    if (e.inPath && !this.pathClear) {
      let t = this.buildings.list.filter((e) => e.inPath && e.alive).length;
      let n = this.buildings.list.filter((e) => e.inPath).length;
      if (t === 0) {
        this.pathClear = true;
        this.pathClearTime = this.levelTime;
        this.objectives.finish.active = true;
        this.hud.banner(
          'PATH CLEAR!',
          'The carrier is safe. Go for 100% — then return to the Blast Corps truck.',
          'good',
          4,
        );
        this.audio.play('jingle.pathclear');
        this.fx.confetti(e.cx, e.baseY + 4, e.cz, 70);
        this.hud.hint(
          'after',
          'Path clear! Explore at your own pace: light RDUs, free survivors, find comm points, the scientist and the secret. Finish at the yellow Blast Corps truck near the start (or from the pause menu).',
          true,
        );
      } else {
        this.hud.toast(`Obstacle cleared: ${e.name} (${n - t}/${n})`, 'good');
        this.audio.play('sfx.obstacle_clear');
      }
    } else {
      this.hud.toast(`${e.name} demolished (${n.got.buildings}/${n.totals.buildings})`, '');
    }
  }
  onDoorDestroyed(e) {
    if (e.id === 'blastdoor') {
      this.hud.banner('BLAST DOOR DOWN', 'The subway is open — take the train north', 'info');
      this.hud.hint('subway', 'Walk through the blown door and hop on the subway train.');
    } else {
      this.hud.banner('DOOR SMASHED', 'A tunnel leads deeper under the pit…', 'info');
    }
    this.audio.play('sfx.fanfare_small');
  }
  onBlockMoved() {
    this.hud.toast('Stairs uncovered on the west road!', 'info');
    this.hud.hint('stairs', "Vehicles can't use stairs. Stop, press F / Y / EXIT to hop out, and head down on foot.");
  }
  onSecretFound() {
    this.objectives.got.secrets++;
    this.hud.banner('SECRET FOUND!', 'The Argent Fountain Crystal shattered', 'gold');
    this.audio.play('sfx.secret');
  }
  onCarrierArrived() {
    if (this.pathClear) {
      this.hud.toast('The carrier reached the decon station safely.', 'good');
    }
  }
  needsTNT() {
    return this.doors.some((e) => e.id === 'blastdoor' && e.alive);
  }
  /** Controller rumble or phone haptics, through the kit (respects its Vibration setting). */
  rumble(e = 0.5, t = 100) {
    this.kit.input.rumble(e, t);
  }
  carrierCrash(e, t) {
    if (this.state !== 'play') {
      return;
    }
    this.state = 'meltdown';
    this.meltT = 0;
    this.failReason = `The carrier collided with ${e}. Argent Towers is now a glow-in-the-dark crater.`;
    let [n, r, i] = t;
    this.audio.stopMusic(0.2);
    this.audio.play('sfx.nuke');
    this.fx.explosion(n, 3, i, 5);
    this.fx.flash(n, 10, i, 6);
    this.fx.shockwave(n, 0.3, i, 90, 2.2);
    this.camera.shake(1.4);
    this.rumble(1, 900);
    let a = document.getElementById('flash');
    a.style.opacity = '0.9';
    setTimeout(() => {
      a.style.transition = 'opacity 1.4s';
      a.style.opacity = '0';
      setTimeout(() => (a.style.transition = ''), 1500);
    }, 120);
    this.carrier.state = 'exploded';
    this.carrier.group.visible = false;
    for (let e of this.buildings.list) {
      if (!e.alive) {
        continue;
      }
      let t = Math.hypot(e.cx - n, e.cz - i);
      if (t < 70) {
        this.after(t * 0.018, () => {
          if (e.alive) {
            e.collapse((e.cx - n) / (t || 1), (e.cz - i) / (t || 1), 'nuke');
          }
        });
      }
    }
    this.props.blast(n, 0, i, 45, null);
    for (let e = 0; e < 40; e++) {
      this.after(0.05 + e * 0.08, () => this.fx.column(n, 1 + e * 0.6, i, 1 + e * 0.03));
    }
    for (let e = 0; e < 5; e++) {
      this.after(0.15 + e * 0.16, () =>
        this.fx.explosion(n + (Math.random() - 0.5) * 20, 2, i + (Math.random() - 0.5) * 20, 3),
      );
    }
  }
  titleCam(e) {
    let t = this.time * 0.05;
    this.camera3.position.set(20 + Math.sin(t) * 150, 95, 40 + Math.cos(t) * 150);
    this.camera3.lookAt(10, 0, 30);
  }
  render(e, t, n) {
    let r = this.time;
    for (let n of this.vehicles) {
      n.render(e, t);
    }
    if (this.worker) {
      this.worker.render(e, t);
    }
    this.carrier.render(e, t);
    for (let t of this.tnts) {
      t.render(e);
    }
    this.block.render(e);
    this.gate.render();
    this.missiles.render(e);
    this.ammo.render(e, r);
    this.beacon.render(e, r);
    this.secret.render(e, r);
    this.bricks.render(e);
    this.buildings.update(t, r);
    this.objectives.render(e, t, r);
    this.fx.update(t);
    this.skids.update(t);
    for (let e of this.world.glowMats) {
      e.glow.value = Math.sin(r * 3) > 0.6 ? 8 : 0.3;
    }
    let i = this.controlled;
    if (
      this.state === 'play' ||
      this.state === 'countdown' ||
      this.state === 'paused' ||
      this.state === 'meltdown' ||
      this.state === 'results' ||
      this.state === 'failed'
    ) {
      let e =
        i.body && i.body.linvel
          ? i.body.linvel()
          : {
              x: 0,
              z: 0,
            };
      let r = i.groundPos || i.curr;
      let a = i.kind === 'jbomb' ? Math.max(0, i.curr.y - i.groundY - 3) : 0;
      let o = {
        x: i.curr.x,
        y: r.y,
        z: i.curr.z,
        vx: i.isTrain ? 0 : e.x,
        vz: i.isTrain ? i.v : e.z,
        air: a,
        kind: i.kind,
        drifting: i.sliding,
        yawRate: i.yawRate || 0,
      };
      if (this.state === 'meltdown') {
        o.x = this.carrier.curr.x;
        o.z = this.carrier.curr.z;
        o.vx = o.vz = 0;
      }
      this.camera.update(t, o, this.state === 'play' ? n : null);
    } else {
      if (this.state === 'intro') {
        this.camera.update(t, null, null);
      }
    }
    this.updateOcclusion(t);
    let a = this.camera3.position;
    let o =
      i && this.state !== 'title'
        ? i.groundPos || i.curr
        : {
            x: 10,
            y: 0,
            z: 30,
          };
    this.sky.update(a, o);
    this.audio.setListener(this.camera.look.x, this.camera.look.y, this.camera.look.z, this.camera.yaw);
    if (this.state === 'play' || this.state === 'countdown' || this.state === 'intro') {
      this.hud.update(t);
      this.updatePrompt();
    }
    this.renderer.render();
    this.updateDiag();
  }
  updatePrompt() {
    let e = this.controlled;
    let t = this.input.lastDevice;
    let n = t === 'gamepad' ? 'Y' : t === 'touch' ? 'TAP' : 'F';
    let r = '';
    if (this.state === 'play') {
      if (this.objectives.nearFinish && this.pathClear) {
        r = `<kbd>${n}</kbd>Finish mission`;
      } else if (e === this.worker) {
        let e = this.nearestEnterable();
        if (e) {
          r = `<kbd>${n}</kbd>Enter ${e.name}`;
        }
      }
    }
    this.hud.prompt(r);
    if (this.input.hasTouch) {
      let t =
        this.objectives.nearFinish && this.pathClear
          ? 'FINISH'
          : e === this.worker
            ? this.nearestEnterable()
              ? 'ENTER'
              : ''
            : 'EXIT';
      if (this._enterLbl !== t) {
        this._enterLbl = t;
        this.input.setTouchLabels({
          enter: t,
        });
      }
    }
  }
  updateOcclusion(e) {
    let t = this.camera3.position;
    let n = this.controlled;
    if (!n || this.state === 'title') {
      for (let e of this.world.occluders) {
        e.fade.value = 1;
      }
      return;
    }
    let r = n.groundPos || n.curr;
    // Scratch objects shared by every frame (no per-frame allocations).
    let i = _occTarget.set(r.x, r.y + 1.5, r.z);
    let a = _occDir.copy(i).sub(t);
    let o = a.length();
    a.normalize();
    let s = _occRay.set(t, a);
    let c = _occHit;
    for (let n of this.world.occluders) {
      let i = 1;
      if (n.kind === 'roof') {
        let e = n.box;
        if (r.y < -1.5 && r.x > e.min.x - 2 && r.x < e.max.x + 2 && r.z > e.min.z - 2 && r.z < e.max.z + 2) {
          i = 0.1;
        }
      } else {
        if (s.intersectBox(n.box, c) && c.distanceTo(t) < o - 1) {
          i = 0.22;
        }
      }
      n.cur += (i - n.cur) * Math.min(1, e * 6);
      n.fade.value = n.cur;
      n.mesh.visible = n.cur > 0.14;
      n.mesh.castShadow = n.cur > 0.5;
    }
    let l = _occBox;
    for (let e of this.buildings.list) {
      if (e.alive) {
        l.min.set(e.box.minX, e.box.y0, e.box.minZ);
        l.max.set(e.box.maxX, e.box.y1 + 1, e.box.maxZ);
        e.fadeTarget = s.intersectBox(l, c) && c.distanceTo(t) < o - 1.5 && !l.containsPoint(i) ? 0.3 : 1;
      }
    }
  }
  trackPerf(e) {
    let t = this.perf;
    t.frameMs = t.frameMs * 0.9 + e * 1000 * 0.1;
    // Small screens move the toasts clear of the touch controls (style.css, body.touch).
    let n = !!(this.kit.touch && this.kit.touch.visible);
    if (n !== this.touchShown) {
      this.touchShown = n;
      document.body.classList.toggle('touch', n);
    }
  }
  updateDiag() {
    if (!this.settings.diag || ((this.diagT = (this.diagT || 0) - 1), this.diagT > 0)) {
      return;
    }
    this.diagT = 10;
    let e = this.renderer;
    let t = e.info;
    let n = this.perf;
    let r = `${this.kit.tier.name} → ${e.preset.name}`;
    document.getElementById('diag').textContent =
      `${e.backend} | ${r} (px ${e.pixelRatio.toFixed(2)}) | ${n.frameMs.toFixed(1)} ms (${(1000 / n.frameMs).toFixed(0)} fps)\ndraws ${t.calls} | tris ${(t.tris / 1000).toFixed(0)}k | bodies ${this.physics.bodyCount} | debris ${this.bricks.physCount}/${this.quality.maxDebrisBodies} | fx ${this.fx.glow.n + this.fx.matter.n}`;
  }
}
const META = {
  date: '2026-09-28',
  model: 'claude-opus-5-5',
  title: 'Brickblast Brigade',
  source: 'Blast Corps (N64)',
  three: '186',
  rapier: '',
};
/**
 * Start-up: the kit first (renderer, input, touch controls, Rapier), then the
 * game builds Argent Towers behind the kit's loading card.
 */
async function main() {
  patchIdentitySwizzle();
  let kit = await boot({
    title: 'Brickblast Brigade',
    canvas: byId('game-canvas'),
    physics: true,
    input: INPUT_ACTIONS,
    // The post chain anti-aliases (SMAA on High, FXAA below), as the game always did.
    renderer: { antialias: false },
    // Options → Graphics & Controls (or F9) opens the kit's settings panel.
    gear: 'none',
    touch: { top: 'left', topOffset: 112 },
    holdLoading: true,
    accent: '#ffc21a',
    background: '#16181d',
  });
  try {
    let e = new RenderHost(kit);
    let t = new AudioEngine();
    t.init();
    let n = new Game({
      kit,
      renderer: e,
      audio: t,
      input: new GameInput(kit),
      meta: META,
    });
    window.__game = n;
    await n.init((e, t) => kit.loading.progress(0.6 + e * 0.4, t));
    n.toTitle();
    kit.onPause((e) => t.setPaused(e));
    // The II pill sits under the vehicle panel, as the game's own pause button did.
    kit.onResize((e, t) => kit.touch && kit.touch.placeTop('left', e <= 760 || t <= 520 ? 92 : 112));
    addEventListener('pointerdown', () => t.unlock(), true);
    addEventListener('keydown', () => t.unlock(), true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && n.state === 'play') {
        n.pause();
      }
    });
    kit.start((e) => n.frame(e));
    kit.loading.done();
  } catch (e) {
    kit.loading.progress(1, 'Failed to start: ' + (e && e.message ? e.message : e));
    throw e;
  }
}
main();
