export const PROTOCOL = 1;
export const PLAYER_PROFILE = 'strata.soldier/1';
const safeID = /^[a-z][a-z0-9-]{0,63}$/;
export function jsonData(value, maxBytes = 262144) {
  const seen = new Set();
  const visit = (v, depth = 0) => {
    if (depth > 20) throw Error('State is too deeply nested.');
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (typeof v !== 'object') throw Error('State must contain JSON values only.');
    if (seen.has(v)) throw Error('State contains a cycle.');
    seen.add(v);
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype) throw Error('State must use plain objects.');
    for (const [k, x] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('Unsafe state key.');
      visit(x, depth + 1);
    }
    seen.delete(v);
  };
  visit(value);
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > maxBytes) throw Error('State exceeds its size limit.');
  return JSON.parse(text);
}
export function validateManifest(m) {
  if (!m || m.protocol !== PROTOCOL) throw Error('Unsupported experience protocol.');
  if (!safeID.test(m.id)) throw Error('Invalid experience id.');
  if (typeof m.title !== 'string' || !m.title.trim() || m.title.length > 100) throw Error('Invalid experience title.');
  if (!['fps', 'driving', 'custom'].includes(m.kind)) throw Error('Invalid experience kind.');
  if (!Array.isArray(m.accepts) || !m.accepts.every((x) => typeof x === 'string')) throw Error('A state profile is required.');
  if (!Array.isArray(m.capabilities) || !m.capabilities.every((x) => typeof x === 'string')) throw Error('Invalid capabilities.');
  return jsonData(m);
}
export function freshState() {
  return {
    protocol: PROTOCOL,
    profile: PLAYER_PROFILE,
    player: {
      health: 100,
      inventory: ['rifle', 'pistol'],
      weapon: 'rifle',
      ammo: { rifle: { mag: 24, reserve: 120 }, pistol: { mag: 12, reserve: 60 } },
    },
    story: {},
    stats: { kills: 0, shots: 0, hits: 0 },
    extensions: {},
  };
}
export function validateHandoff(raw) {
  const s = jsonData(raw);
  if (s.protocol !== PROTOCOL || typeof s.profile !== 'string') throw Error('Unsupported handoff.');
  if (s.profile === PLAYER_PROFILE) {
    if (!s.player || !Number.isFinite(s.player.health) || s.player.health < 0 || s.player.health > 100) throw Error('Invalid player health.');
    if (
      !Array.isArray(s.player.inventory) ||
      s.player.inventory.length > 64 ||
      !s.player.inventory.every((x) => typeof x === 'string' && x.length <= 80)
    )
      throw Error('Invalid inventory.');
    if (!s.player.ammo || !['rifle', 'pistol'].includes(s.player.weapon)) throw Error('Invalid weapon state.');
    for (const id of ['rifle', 'pistol']) {
      const a = s.player.ammo[id];
      if (
        !a ||
        !Number.isInteger(a.mag) ||
        a.mag < 0 ||
        a.mag > (id === 'rifle' ? 24 : 12) ||
        !Number.isInteger(a.reserve) ||
        a.reserve < 0 ||
        a.reserve > 9999
      )
        throw Error('Invalid ammunition.');
    }
    for (const k of ['kills', 'shots', 'hits']) if (!Number.isSafeInteger(s.stats?.[k]) || s.stats[k] < 0) throw Error('Invalid statistics.');
    for (const k of ['story', 'extensions']) if (!s[k] || Array.isArray(s[k]) || typeof s[k] !== 'object') throw Error('Invalid state section.');
  }
  return s;
}
export function accepts(manifest, state) {
  if (!manifest.accepts.includes(state.profile)) throw Error(`${manifest.title} cannot receive ${state.profile}.`);
}
export function validateCheckpoint(raw) {
  const s = jsonData(raw, 1048576);
  if (s.version !== 1 || !safeID.test(s.experience)) throw Error('Unsupported checkpoint.');
  s.handoff = validateHandoff(s.handoff);
  return s;
}
export class Registry {
  entries = new Map();
  register(manifest, load) {
    const m = validateManifest(manifest);
    if (this.entries.has(m.id)) throw Error(`Duplicate experience: ${m.id}`);
    if (typeof load !== 'function') throw Error('An experience loader is required.');
    this.entries.set(m.id, { manifest: m, load });
  }
  get(id) {
    const e = this.entries.get(id);
    if (!e) throw Error(`Unknown experience: ${id}`);
    return e;
  }
  all() {
    return [...this.entries.values()].map((e) => e.manifest);
  }
}
