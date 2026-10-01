// The light director: every light in the game registers here as a fixture. It owns
// on/off state, shadow-map sizes per quality tier, and a shadow refresh budget:
// shadow maps only re-render when something near them moved (dirty), at most
// `localBudget` local lights per frame, highest priority first.
import * as THREE from 'three/webgpu';
import { applySoftShadow } from './softShadows.js';

export const SHADOW_QUALITY = {
  low: { sunDistance: 40, sunSizes: [512, 512, 256, 256], localSize: 256, importantLocalSize: 512, localBudget: 1, softness: 1.7 },
  medium: { sunDistance: 56, sunSizes: [1024, 1024, 512, 512], localSize: 512, importantLocalSize: 1024, localBudget: 2, softness: 2.15 },
  high: { sunDistance: 64, sunSizes: [2048, 2048, 1024, 1024], localSize: 1024, importantLocalSize: 1024, localBudget: 3, softness: 2.7 },
  ultra: { sunDistance: 72, sunSizes: [4096, 2048, 2048, 1024], localSize: 1024, importantLocalSize: 2048, localBudget: 4, softness: 3.25 },
};
const QUALITY_RANK = { low: 0, medium: 1, high: 2, ultra: 3 };

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Black-body approximation: Kelvin to an RGB colour. */
function kelvinToColor(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  return new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255);
}

const NO_SHADOWS = [];

class FixtureHandle {
  constructor(director, id) {
    this.director = director;
    this.id = id;
  }
  setEnabled(on) {
    this.director.setEnabled(this.id, on);
  }
  isEnabled() {
    return this.director.isEnabled(this.id);
  }
  setZone(zone) {
    this.director.setZone(this.id, zone);
  }
  invalidate(urgent = false) {
    this.director.invalidate(this.id, urgent);
  }
}

export class LightDirector {
  constructor() {
    this.fixtures = new Map();
    this.playerPosition = new THREE.Vector3();
    this.quality = 'medium';
    this.activeZone = 'exterior';
    this.sunShadowUpdates = 0;
    this.localShadowUpdates = 0;
    this.due = [];
    this.byPriority = (a, b) => this.priority(b) - this.priority(a);
  }

  add(desc) {
    if (this.fixtures.has(desc.id)) throw new Error(`Light fixture ${desc.id} is already registered.`);
    const intensity = desc.intensity ?? desc.light.intensity;
    desc.light.intensity = intensity;
    if (desc.temperatureK !== undefined) desc.light.color.copy(kelvinToColor(desc.temperatureK));
    desc.light.name = desc.id;
    desc.light.userData.fixture = desc.fixture;
    desc.light.userData.zone = desc.zone;
    desc.light.userData.mobility = desc.mobility;
    desc.light.userData.importance = desc.importance ?? 0.5;
    const entry = {
      descriptor: desc,
      enabled: intensity > 0,
      dirty: true,
      urgent: true,
      elapsed: Number.POSITIVE_INFINITY,
      age: 0,
      queued: false,
      knownShadowCount: -1,
      baseIntensity: intensity,
      baseEmissiveIntensity: desc.emissiveIntensity ?? desc.emitter?.emissiveIntensity ?? 1,
    };
    this.fixtures.set(desc.id, entry);
    this.applyFixtureQuality(entry);
    return new FixtureHandle(this, desc.id);
  }

  setQuality(quality) {
    if (!SHADOW_QUALITY[quality] || quality === this.quality) return;
    this.quality = quality;
    for (const f of this.fixtures.values()) {
      f.dirty = true;
      f.urgent = true;
      this.applyFixtureQuality(f);
    }
  }

  beginFrame(dt, playerPosition, zone) {
    this.playerPosition.copy(playerPosition);
    this.activeZone = zone;
    for (const f of this.fixtures.values()) {
      f.elapsed += dt;
      if (f.dirty) f.age += dt;
    }
  }

  /** Decide which shadow maps re-render this frame. */
  beforeRender() {
    const due = this.due;
    due.length = 0;
    for (const f of this.fixtures.values()) {
      const shadows = this.getShadows(f);
      if (shadows.length !== f.knownShadowCount) {
        f.knownShadowCount = shadows.length;
        this.applyFixtureQuality(f);
        f.dirty = true;
      }
      for (const s of shadows) s.needsUpdate = false;
      if (!this.isShadowEligible(f) || !f.enabled || f.descriptor.light.intensity <= 1e-4 || !f.dirty) continue;
      if (!this.isDue(f)) continue;
      if (f.descriptor.light.isDirectionalLight) this.queue(f);
      else due.push(f);
    }
    if (due.length > 1) due.sort(this.byPriority);
    const budget = SHADOW_QUALITY[this.quality].localBudget;
    for (let i = 0; i < Math.min(budget, due.length); i += 1) this.queue(due[i]);
  }

  afterRender() {
    for (const f of this.fixtures.values()) {
      if (!f.queued) continue;
      f.queued = false;
      f.age = 0;
      // A shadow map still flagged means the renderer skipped it (not visible): try again.
      if (this.getShadows(f).some((s) => s.needsUpdate)) {
        f.urgent = true;
        continue;
      }
      if (f.descriptor.light.isDirectionalLight) this.sunShadowUpdates += 1;
      else this.localShadowUpdates += 1;
      f.dirty = false;
      f.urgent = false;
      f.elapsed = 0;
    }
  }

  invalidate(id, urgent = false) {
    const f = this.fixtures.get(id);
    if (!f) return;
    if (!f.dirty) f.age = 0;
    f.dirty = true;
    f.urgent ||= urgent;
  }

  /** Something moved at `position`: re-render the shadow maps that can see it. */
  invalidateDynamicCaster(position, radius = 7) {
    for (const f of this.fixtures.values()) {
      if (!this.isShadowEligible(f)) continue;
      if (f.descriptor.light.isDirectionalLight) {
        this.invalidate(f.descriptor.id);
        continue;
      }
      (f.descriptor.root ?? f.descriptor.light).getWorldPosition(tmpA);
      const reach = (f.descriptor.shadowDistance ?? 8) + radius;
      if (tmpA.distanceToSquared(position) <= reach * reach) this.invalidate(f.descriptor.id);
    }
  }

  invalidateCamera() {
    for (const f of this.fixtures.values()) if (f.descriptor.light.isDirectionalLight) this.invalidate(f.descriptor.id);
  }

  setEnabled(id, on) {
    const f = this.fixtures.get(id);
    if (!f || f.enabled === on) return;
    f.enabled = on;
    const d = f.descriptor;
    d.light.intensity = on ? f.baseIntensity : 0;
    if (d.emitter) {
      d.emitter.emissiveIntensity = on ? f.baseEmissiveIntensity : 0.015;
      if (on) d.emitter.color.copy(d.light.color);
      else d.emitter.color.set('#202225');
    }
    if (on) {
      f.dirty = true;
      f.urgent = true;
      f.elapsed = Number.POSITIVE_INFINITY;
    }
  }

  isEnabled(id) {
    return this.fixtures.get(id)?.enabled ?? false;
  }

  setZone(id, zone) {
    const f = this.fixtures.get(id);
    if (!f) return;
    f.descriptor.zone = zone;
    f.descriptor.light.userData.zone = zone;
  }

  /** How much local (non-sun) light reaches a point, log-scaled: drives auto exposure. */
  getLocalLightMeter(position) {
    let total = 0;
    for (const f of this.fixtures.values()) {
      const light = f.descriptor.light;
      if (!f.enabled || light.isDirectionalLight) continue;
      light.getWorldPosition(tmpA);
      tmpC.subVectors(position, tmpA);
      const dist = tmpC.length();
      const range = light.distance;
      if (range > 0 && dist >= range) continue;
      let cone = 1;
      if (light.isSpotLight) {
        light.target.getWorldPosition(tmpB);
        tmpB.sub(tmpA).normalize();
        const cos = tmpC.normalize().dot(tmpB);
        const outer = Math.cos(light.angle);
        const inner = Math.cos(light.angle * (1 - light.penumbra));
        const k = inner === outer ? +(cos >= outer) : clamp((cos - outer) / (inner - outer), 0, 1);
        cone = k * k * (3 - 2 * k);
      }
      const falloff = range > 0 ? Math.max(0, 1 - (dist / range) ** 4) ** 2 : 1;
      total += (f.baseIntensity * cone * falloff) / Math.max(dist ** light.decay, 0.01);
    }
    return Math.log2(1 + total);
  }

  isShadowEligible(f) {
    const d = f.descriptor;
    if ((d.shadow ?? 'never') === 'never') return false;
    return QUALITY_RANK[this.quality] >= QUALITY_RANK[d.shadowMinQuality ?? 'low'];
  }

  isDue(f) {
    if (f.urgent) return true;
    const fps = f.descriptor.shadowFps?.[this.quality] ?? 0;
    return fps <= 0 || f.elapsed >= 1 / fps;
  }

  priority(f) {
    const d = f.descriptor;
    (d.root ?? d.light).getWorldPosition(tmpA);
    const dist = Math.sqrt(tmpA.distanceToSquared(this.playerPosition));
    const zoneBonus = d.zone === this.activeZone ? 2.5 : 0;
    return (d.mobility === 'camera' ? 4 : 0) + zoneBonus + (d.importance ?? 0.5) * 3 + f.age * 2 - dist * 0.035;
  }

  queue(f) {
    const shadows = this.getShadows(f);
    if (!shadows.length) return;
    for (const s of shadows) s.needsUpdate = true;
    f.queued = true;
  }

  getShadows(f) {
    const d = f.descriptor;
    if (d.shadowProvider) return d.shadowProvider();
    return d.light.shadow ? (d.shadowList ??= [d.light.shadow]) : NO_SHADOWS;
  }

  applyFixtureQuality(f) {
    const d = f.descriptor;
    const eligible = this.isShadowEligible(f);
    d.light.castShadow = eligible;
    if (!eligible) return;
    const q = SHADOW_QUALITY[this.quality];
    const shadows = this.getShadows(f);
    const directional = d.light.isDirectionalLight;
    const important = (d.importance ?? 0.5) >= 0.82;
    for (let i = 0; i < shadows.length; i += 1) {
      const s = shadows[i];
      const size = directional ? q.sunSizes[Math.min(i, q.sunSizes.length - 1)] : important ? q.importantLocalSize : q.localSize;
      s.autoUpdate = false;
      s.radius = q.softness * (0.72 + (d.sourceRadius ?? 0.2));
      if (directional || d.light.isSpotLight) applySoftShadow(s, this.quality, d.sourceRadius);
      // Only size a shadow before its map exists. These shadows render on demand (autoUpdate
      // off), and in r186 resizing one after its first render leaves the scene sampling the
      // destroyed old texture on WebGPU. CSM cascades appear on the first render at the sun's
      // size, so they keep it; a quality change resizes maps created later (or on reload).
      if (!s.map && (s.mapSize.x !== size || s.mapSize.y !== size)) s.mapSize.set(size, size);
      if (d.shadowDistance !== undefined) {
        s.camera.far = d.shadowDistance;
        s.camera.updateProjectionMatrix();
      }
    }
    d.onQualityChanged?.(q);
  }

  getFixtureCount() {
    return this.fixtures.size;
  }
}
