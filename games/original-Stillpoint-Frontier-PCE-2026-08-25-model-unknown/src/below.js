/**
 * below.js — "00 / Below", the epilogue the original only hinted at. A sealed
 * hatch on the Stillpoint foundation shows one notch per recorded Whisperglass
 * echo; with all six it opens onto a survey vault under the basin where the
 * six bearings meet and the last coordinate can be read.
 */
import * as THREE from 'three/webgpu';
import { ECHOES, VAULT, GUIDE_BELOW_ID } from './data.js';
import { StaticBatch, prim, glowMaterial } from './primitives.js';

export class StillpointBelow {
  constructor({ scene, terrain, player, collision, interactions, materials, hud, soundscape, input, render, isKnown, recordGuide, reward, onRevelation }) {
    this.terrain = terrain;
    this.player = player;
    this.collision = collision;
    this.interactions = interactions;
    this.materials = materials;
    this.hud = hud;
    this.soundscape = soundscape;
    this.input = input;
    this.isKnown = isKnown;
    this.recordGuide = recordGuide;
    this.reward = reward;
    this.onRevelation = onRevelation;
    this.disposers = [];
    this.ownedMaterials = [];
    this.inside = false;
    this.elapsed = 0;
    this.notchCount = -1;
    this.root = new THREE.Group();
    this.root.name = '00 / Below';
    scene.add(this.root);
    this.buildHatch();
    this.buildVault(render);
    this.update(0);
  }

  get recorded() {
    return ECHOES.filter((e) => this.isKnown(e.entryId)).length;
  }
  get unlocked() {
    return this.recorded >= ECHOES.length;
  }
  get revealed() {
    return this.isKnown(GUIDE_BELOW_ID);
  }

  /** True while the player stands in the vault. */
  contains(p) {
    return Math.abs(p.x - VAULT.x) <= VAULT.half + 1 && Math.abs(p.z - VAULT.z) <= VAULT.half + 1 && p.y < VAULT.floorY + VAULT.height + 2 && p.y > VAULT.floorY - 3;
  }

  buildHatch() {
    const ground = this.terrain.heightAt(0, 0);
    const top = ground + 0.7;
    const hatch = new THREE.Group();
    hatch.name = 'Sealed hatch';
    hatch.position.set(0, top, -3.1);
    this.root.add(hatch);
    const batch = new StaticBatch();
    batch.add('cylinder', this.materials.structureAccent, [0, 0.03, 0], [1.9, 0.06, 1.9], null, false);
    batch.add('cylinder', this.materials.structure, [0, 0.05, 0], [1.5, 0.05, 1.5], null, false);
    batch.build(hatch);
    this.hatchGlow = prim(hatch, 'cylinder', this.materials.lichenGlow, [0, 0.075, 0], [1.1, 0.02, 1.1], { cast: false, name: 'Hatch seal light' });
    this.notches = ECHOES.map((echo, i) => {
      const a = (i / ECHOES.length) * Math.PI * 2;
      const lit = glowMaterial(`Hatch notch / ${echo.id}`, echo.color, 3);
      this.ownedMaterials.push(lit);
      const notch = prim(hatch, 'box', this.materials.structure, [Math.cos(a) * 0.82, 0.08, Math.sin(a) * 0.82], [0.14, 0.05, 0.3], { cast: false, rotation: [0, (-a * 180) / Math.PI, 0], name: `Notch ${i + 1}` });
      notch.userData.lit = lit;
      return notch;
    });
    this.disposers.push(
      this.interactions.register({
        id: 'below:hatch',
        entity: hatch,
        range: 5,
        holdSeconds: 1.2,
        label: () => (this.unlocked ? 'Descend below the Stillpoint' : `Sealed hatch // ${this.recorded} / ${ECHOES.length} bearings`),
        interact: () => {
          if (!this.unlocked) {
            this.hud.showToast(
              'The hatch will not answer',
              `It listens for all six Whisperglass bearings (${this.recorded} / ${ECHOES.length} recorded). Each recorded echo resolves the next bearing on the atlas.`,
              'SEALED // 00',
              5200,
            );
            this.soundscape.reject();
            return;
          }
          this.descend();
        },
      }),
    );
  }

  buildVault(render) {
    const y = VAULT.floorY;
    const h = VAULT.height;
    const half = VAULT.half;
    const m = this.materials;
    const vault = new THREE.Group();
    vault.name = 'Survey vault';
    vault.position.set(VAULT.x, 0, VAULT.z);
    vault.visible = false;
    this.root.add(vault);
    this.vault = vault;
    const batch = new StaticBatch();
    const span = half * 2 + 1.2;
    batch.add('box', m.structure, [0, y - 0.2, 0], [span, 0.4, span]);
    batch.add('box', m.structure, [0, y + h + 0.2, 0], [span, 0.4, span]);
    for (const [x, z, sx, sz] of [
      [0, -(half + 0.3), span, 0.6],
      [0, half + 0.3, span, 0.6],
      [-(half + 0.3), 0, 0.6, span],
      [half + 0.3, 0, 0.6, span],
    ]) {
      batch.add('box', m.structureAccent, [x, y + h / 2, z], [sx, h + 0.8, sz]);
      this.disposers.push(
        this.collision.add({ id: `vault:wall:${x}:${z}`, minX: VAULT.x + x - sx / 2, maxX: VAULT.x + x + sx / 2, minZ: VAULT.z + z - sz / 2, maxZ: VAULT.z + z + sz / 2, minY: y - 2, maxY: y + h + 1 }),
      );
    }
    // Pilasters and a floor ring, in the compound's language.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      batch.add('box', i % 2 ? m.structure : m.roof, [Math.cos(a) * (half - 0.5), y + h / 2, Math.sin(a) * (half - 0.5)], [0.7, h, 0.7], [0, (-a * 180) / Math.PI, 0]);
    }
    batch.add('cylinder', m.structureAccent, [0, y + 0.02, 0], [15.4, 0.04, 15.4], null, false);
    batch.add('cylinder', m.structure, [0, y + 0.03, 0], [14.2, 0.05, 14.2], null, false);
    batch.add('box', m.structureAccent, [0, y + 2.1, 0], [1.6, 4.2, 0.6]);
    batch.add('box', m.fieldOrange, [0, y + 0.1, 10.2], [1.4, 0.2, 1.4], null, false);
    batch.build(vault);
    this.disposers.push(
      this.collision.addFloor({ id: 'vault:floor', minX: VAULT.x - half, maxX: VAULT.x + half, minZ: VAULT.z - half, maxZ: VAULT.z + half, height: y, headroom: h - 1 }),
      this.collision.add({ id: 'vault:monolith', minX: VAULT.x - 0.8, maxX: VAULT.x + 0.8, minZ: VAULT.z - 0.3, maxZ: VAULT.z + 0.3, minY: y - 1, maxY: y + 4.2 }),
    );

    this.shards = ECHOES.map((echo, i) => {
      // Offset so no plinth stands on the lift axis where the player arrives.
      const a = (i / ECHOES.length) * Math.PI * 2 - Math.PI / 3;
      const x = Math.cos(a) * 8;
      const z = Math.sin(a) * 8;
      prim(vault, 'box', m.structureAccent, [x, y + 0.8, z], [1.1, 1.6, 1.1], { name: `Bearing plinth ${i + 1}` });
      const glow = glowMaterial(`Below bearing / ${echo.id}`, echo.color, 4);
      this.ownedMaterials.push(glow);
      const shard = prim(vault, 'cone', glow, [x, y + 2.3, z], [0.5, 1.3, 0.5], { cast: false, rotation: [0, echo.phase * 37, 180], name: echo.name });
      this.disposers.push(this.collision.add({ id: `vault:plinth:${i}`, minX: VAULT.x + x - 0.55, maxX: VAULT.x + x + 0.55, minZ: VAULT.z + z - 0.55, maxZ: VAULT.z + z + 0.55, minY: y - 1, maxY: y + 3 }));
      return { shard, glow, phase: echo.phase };
    });

    this.beam = prim(vault, 'box', m.beam, [0, y + (4.2 + h) / 2, 0], [0.3, h - 4.2, 0.3], { cast: false, receive: false, name: 'Inverted Stillpoint beam' });
    const plate = prim(vault, 'box', m.window, [0, y + 2.6, 0.33], [1.1, 0.5, 0.06], { cast: false, name: 'Last coordinate' });
    const lift = prim(vault, 'box', m.fieldOrange, [0, y + 1, 11.4], [0.7, 1.8, 0.35], { cast: false, name: 'Vault lift' });

    this.disposers.push(
      this.interactions.register({
        id: 'below:coordinate',
        entity: plate,
        range: 4.5,
        holdSeconds: 1.5,
        label: () => (this.revealed ? 'Read the last coordinate again' : 'Read the last coordinate'),
        enabled: () => this.inside,
        interact: () => this.readCoordinate(),
      }),
      this.interactions.register({
        id: 'below:lift',
        entity: lift,
        range: 5,
        holdSeconds: 0.6,
        label: 'Return to the Stillpoint',
        enabled: () => this.inside,
        interact: () => this.ascend(),
      }),
      render.addLight({ position: new THREE.Vector3(VAULT.x, y + 6.5, VAULT.z), color: [0.4, 1, 0.82], intensity: 3.2, range: 20, enabled: () => this.inside }),
      render.addLight({ position: new THREE.Vector3(VAULT.x, y + 3, VAULT.z + 9), color: [1, 0.55, 0.25], intensity: 2, range: 10, enabled: () => this.inside }),
    );
  }

  descend() {
    this.player.teleport(VAULT.x, VAULT.z + 7.5, VAULT.floorY);
    this.player.setHeading(0);
    this.soundscape.below();
    this.input?.rumble(0.5, 320);
    this.hud.showToast('00 / Below', 'A survey vault the atlas never listed. Six bearings stand in a ring around one coordinate.', 'BENEATH THE STILLPOINT', 5200);
    this.update(0);
  }

  ascend() {
    this.player.teleport(2.2, -3.2);
    this.hud.showToast('The Stillpoint', 'Back on the basin floor. The hatch stays open for you.', 'LIFT TRANSIT');
    this.update(0);
  }

  readCoordinate() {
    const first = !this.revealed;
    if (first) {
      this.recordGuide(GUIDE_BELOW_ID);
      this.reward({ relic: 3, first_aid_kit: 2 }, 150);
    }
    this.soundscape.finale();
    this.input?.rumble(0.8, 420);
    this.onRevelation(first);
  }

  update(dt) {
    this.elapsed += dt;
    this.inside = this.contains(this.player.worldPosition);
    this.vault.visible = this.inside;
    const count = this.recorded;
    if (count !== this.notchCount) {
      this.notchCount = count;
      this.notches.forEach((notch, i) => {
        notch.material = this.isKnown(ECHOES[i].entryId) ? notch.userData.lit : this.materials.structure;
      });
      this.hatchGlow.visible = count >= ECHOES.length;
    }
    if (this.inside) {
      for (const s of this.shards) s.glow.emissiveIntensity = 3.2 + Math.sin(this.elapsed * 1.6 + s.phase) * 1.4;
      this.beam.visible = true;
    }
  }

  destroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    for (const material of this.ownedMaterials) material.dispose();
    this.root.removeFromParent();
  }
}
