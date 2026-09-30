/**
 * stamps.js — GRID LAB field stamps: small authored props placed ahead of the
 * player and kept in their own layout record (up to 128).
 */
import * as THREE from 'three/webgpu';
import { STAMP_KINDS, STORAGE } from './data.js';
import { StaticBatch, setEulerDeg, disposeObject } from './primitives.js';

const LIMIT = 48000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function validPlacement(point, slopeAt = () => 0) {
  return Number.isFinite(point.x) && Number.isFinite(point.z) && Math.abs(point.x) <= LIMIT && Math.abs(point.z) <= LIMIT && slopeAt(point.x, point.z) <= 1.1;
}

function cleanRecords(value, slopeAt) {
  if (!Array.isArray(value)) return [];
  const kinds = new Set(STAMP_KINDS);
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (typeof raw.id !== 'string' || raw.id.length < 1 || raw.id.length > 120 || seen.has(raw.id)) continue;
    if (typeof raw.kind !== 'string' || !kinds.has(raw.kind)) continue;
    if (![raw.x, raw.y, raw.z, raw.yaw].every(Number.isFinite) || !validPlacement({ x: raw.x, z: raw.z }, slopeAt)) continue;
    const record = { id: raw.id, kind: raw.kind, x: clamp(raw.x, -LIMIT, LIMIT), y: clamp(raw.y, -256, 4096), z: clamp(raw.z, -LIMIT, LIMIT), yaw: ((raw.yaw % 360) + 360) % 360 };
    seen.add(record.id);
    out.push(record);
    if (out.length >= 128) break;
  }
  return out;
}

export class FieldStamps {
  constructor({ scene, terrain, player, materials }) {
    this.terrain = terrain;
    this.player = player;
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'GRID LAB / persistent field stamps';
    scene.add(this.root);
    this.objects = new Map();
    this.kindIndex = 0;
    this.records = this.load();
    this.sequence = this.records.reduce((n, r) => {
      const id = Number(r.id.split(':').at(-1));
      return Number.isInteger(id) ? Math.max(n, id + 1) : n;
    }, 1);
    for (const record of this.records) this.createStamp(record);
  }

  get count() {
    return this.records.length;
  }
  get selectedKind() {
    return STAMP_KINDS[this.kindIndex];
  }

  cycleKind() {
    this.kindIndex = (this.kindIndex + 1) % STAMP_KINDS.length;
    return this.selectedKind;
  }

  place() {
    if (this.records.length >= 128) return { ok: false, reason: 'Manifest limit reached.' };
    const yaw = (this.player.yawDegrees * Math.PI) / 180;
    const x = this.player.worldPosition.x - Math.sin(yaw) * 5;
    const z = this.player.worldPosition.z - Math.cos(yaw) * 5;
    if (!validPlacement({ x, z }, (px, pz) => this.terrain.slopeAt(px, pz, 1.6))) return { ok: false, reason: 'Ground is too steep or outside the authored atlas.' };
    const record = { id: `grid-stamp:${this.sequence++}`, kind: this.selectedKind, x, y: this.terrain.heightAt(x, z), z, yaw: ((Math.round(this.player.yawDegrees / 15) * 15) % 360 + 360) % 360 };
    this.records = [...this.records, record];
    this.createStamp(record);
    this.save();
    return { ok: true, reason: 'Field stamp written to the layout manifest.', record };
  }

  undo() {
    const last = this.records.at(-1) ?? null;
    if (!last) return null;
    this.records = this.records.slice(0, -1);
    disposeObject(this.objects.get(last.id));
    this.objects.delete(last.id);
    this.save();
    return last;
  }

  destroy() {
    this.root.removeFromParent();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE.layout);
      return cleanRecords(raw ? JSON.parse(raw) : null, (x, z) => this.terrain.slopeAt(x, z, 1.6));
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE.layout, JSON.stringify(this.records));
    } catch {
      /* layout stays for this session */
    }
  }

  createStamp(record) {
    const group = new THREE.Group();
    group.name = record.id;
    group.position.set(record.x, record.y, record.z);
    setEulerDeg(group, 0, record.yaw, 0);
    this.root.add(group);
    this.objects.set(record.id, group);
    const m = this.materials;
    const batch = new StaticBatch();
    if (record.kind === 'survey_stake') {
      batch.add('box', m.structure, [0, 1.25, 0], [0.18, 2.5, 0.18]);
      batch.add('sphere', m.fieldOrange, [0, 2.55, 0], [0.28, 0.28, 0.28]);
    } else if (record.kind === 'hush_cairn') {
      for (let i = 0; i < 4; i += 1) batch.add('sphere', i === 3 ? m.fieldOrange : m.rock, [0, 0.22 + i * 0.42, 0], [1.1 - i * 0.19, 0.42, 0.9 - i * 0.13]);
    } else if (record.kind === 'weather_memory_plate') {
      batch.add('cylinder', m.structure, [0, 0.35, 0], [1.4, 0.7, 1.4]);
      batch.add('box', m.fieldOrange, [0, 1.3, 0], [1.9, 0.08, 1.1], [12, 0, 0]);
    } else if (record.kind === 'route_slab') {
      batch.add('box', m.road, [0, 0.08, 0], [3.4, 0.16, 1.4]);
      batch.add('box', m.fieldOrange, [0, 0.18, 0], [0.12, 0.04, 0.85]);
    } else {
      batch.add('box', m.structure, [0, 0.62, 0], [2.2, 1.24, 1.35]);
      batch.add('box', m.fieldOrange, [0, 0.78, -0.69], [1.45, 0.12, 0.04]);
    }
    batch.build(group);
  }
}
