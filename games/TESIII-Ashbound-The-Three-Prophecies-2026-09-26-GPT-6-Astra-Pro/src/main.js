import { boot } from 'kit/boot.js';
import { View, THREE, presetFor } from './render.js';
import { resourceJSON } from './resources.js';
import { Physics } from './physics.js';
import { ACTIONS, Controls } from './controls.js';
import { AudioBus } from './audio.js';
import { UI } from './ui.js';
import { CAMPAIGN, SIDES, ESSENTIAL, ACTS, activeStep, gateForArea } from './campaign.js';
import * as M from './model.js';
import { clamp, random, hash, distance, saveJSON, loadJSON, escapeHTML as H } from './util.js';
const SAVE = 'ashbound.save.v3',
  BACKUP = 'ashbound.backup.v3';
// Graphics quality, look sensitivity and invert-Y are the kit's shared settings (Options → Graphics & controls).
const DEFAULTS = {
  volume: 0.55,
  musicVolume: 0.28,
  sfxVolume: 0.8,
  mute: false,
  diagnostics: true,
  difficulty: 1,
  motion: true,
};
const lines = {
  wake: 'I heard the guards say Seyda Neen. A little port, a great deal of paperwork. We are almost free. Best not keep the Imperial clerk waiting.',
  papers:
    'You are to take this sealed package to Caius Cosades in Balmora. What follows is his business, not mine. Your release papers are in order.',
  caius:
    'Find yourself a trade, a guild, a plausible reason to be here. Then we can work. Hasphat Antabolis knows the old histories, though he never gives anything away.',
  hasphat:
    'Bring me a Dwemer puzzle box from Arkngthand. Not scrap metal—a small cube, carefully worked. In exchange, you shall have your history.',
  sharn:
    'An old skull, from the Andrano tomb. An academic request. Take this enchanted blade; the ancestors do not always welcome curiosity.',
  cure: 'Corprus, and yet you are still speaking coherently. Interesting. Yagrum has finished repairing some boots for me. Fetch them, and we will discuss your treatment.',
  boots:
    'These boots are repaired. I remember the hands that made such things. Yours is a shorter errand than mine has been. Take them to Fyr.',
  cured: 'There is no promise of safety. Only an experiment, and the certainty that doing nothing will be worse. Drink.',
  vivec:
    'Our power has become a prison. Take Wraithguard. Strike the Heart with Sunder, then sever its enchantments with Keening. Do not mistake the death of a body for the death of a god.',
  mournhold:
    'Mournhold has little patience for unanswered questions. We will begin with the assassins beneath the Bazaar. Bring back whatever connects them to their employer.',
  almalexia:
    'My city is troubled, outlander. Its people look to their protectors. You will go beneath the plaza and discover what has disturbed their peace.',
  frostmoth:
    'The cold is not our only enemy. Supplies vanish, men grow restless, and the smugglers know this coast too well. Start at Gandrung Caverns.',
  skaal:
    'The land is not a thing to own. It gives, and we return what is owed. The stones must be honored before the coming hunt.',
  carius:
    'Another unwilling guest. We can stand together for the outer ring, at least. Keep your eyes on the passages. Nothing here was built for our benefit.',
};
export class Game {
  constructor() {
    this.state = null;
    this._modal = true;
    this.options = M.validateOptions(loadJSON('ashbound.options', {}), DEFAULTS);
    this.catalogue = null;
    this.target = null;
    this.cooldown = 0;
    this.castCooldown = 0;
    this.oxygen = 30;
    this.accumulator = 0;
    this.memorySave = null;
    this.memoryBackup = null;
    this.storageWarningShown = false;
    this.autosaveTime = 0;
    this.frameMs = 16.7;
    this.spawnedStage = null;
    this.projectiles = [];
    this.footstepTime = 0;
    this.sneaking = false;
    this.pendingRefresh = false;
    this.refreshKeep = true;
    this.frameNo = 0;
    this.notifyCount = 0;
    this.running = true;
  }
  /** While a game menu is up the kit's touch controls step aside. */
  get modal() {
    return this._modal;
  }
  set modal(v) {
    this._modal = v;
    this.kit?.touch?.suspend(v, 'game');
  }
  async init() {
    const status = document.getElementById('boot-status');
    if (status) status.textContent = 'Preparing the shores of Vvardenfell…';
    const catalogue = resourceJSON('data/source-catalogue.json');
    const kit = (this.kit = await boot({
      title: 'Ashbound · The Three Prophecies',
      canvas: document.getElementById('world'),
      physics: true,
      input: ACTIONS,
      gear: 'none', // the game's Options screen opens the kit's settings
      accent: '#d4b16e',
      background: '#142827',
    }));
    kit.touch?.suspend(this._modal, 'game');
    kit.loading.progress(0.7, 'Preparing the shores of Vvardenfell…');
    this.catalogue = await catalogue;
    this.view = new View(kit);
    this.view.init();
    this.physics = new Physics(kit.RAPIER);
    this.audio = new AudioBus();
    await this.audio.init();
    this.ui = new UI(this);
    this.controls = new Controls(this, kit);
    this.applyOptions();
    this.physics.setQuality(this.view.preset);
    kit.onQuality((tier) => this.physics.setQuality(presetFor(tier)));
    kit.onPause((paused) => this.audio.suspend(paused));
    this.loadTitle();
    this.ui.title();
    const unlockAudio = () => this.audio.unlock().catch((e) => console.warn('Audio unavailable', e));
    this.ui.root.addEventListener('pointerdown', unlockAudio);
    this.ui.root.addEventListener('keydown', unlockAudio);
    if (['localhost', '127.0.0.1'].includes(location.hostname)) window.__ASHBOUND__ = this;
    // Build the pipelines for the title scene, the held weapon, sparks and debris before the first frame.
    this.warmUp();
    await kit.renderer.compileAsync(this.view.scene, this.view.camera).catch(() => {});
    this.coolDown();
    kit.start((dt) => this.frame(dt));
  }
  /** Hidden-until-now meshes that use materials the title scene does not: compiled once at startup. */
  warmUp() {
    const v = this.view;
    this.warm = new THREE.Group();
    this.warm.add(new THREE.Mesh(v.particleGeometry, v.basic(0xe0be78)));
    for (const m of v.debrisMaterials) this.warm.add(new THREE.Mesh(v.debrisGeometry, m));
    this.warm.position.set(-1, 3, -7);
    v.scene.add(this.warm);
  }
  coolDown() {
    this.warm?.removeFromParent();
    this.warm = null;
  }
  loadTitle() {
    const a = this.catalogue.areas.find((a) => a.id === 'wlk002-2');
    this.view.loadArea(a);
    this.view.addActor({ name: 'Fargoth', type: 'npc', x: 2, z: 3 });
    this.view.addActor({ name: 'Arrille', type: 'npc', x: -6, z: 5 });
    this.view.addActor({ name: 'Imperial Guard', type: 'npc', x: 4, z: -9 });
    this.view.mode = 'title';
  }
  toTitle() {
    if (this.state && this.state.hp > 0) this.save(false);
    this.state = null;
    this.controls.clear();
    this.physics.unload();
    this.target = null;
    document.body.classList.remove('hurt', 'blinded', 'submerged');
    this.loadTitle();
    this.ui.title();
  }
  readSave(backup = false) {
    const memory = backup ? this.memoryBackup : this.memorySave;
    return memory ? structuredClone(memory) : loadJSON(backup ? BACKUP : SAVE, null);
  }
  hasSave() {
    return !!M.validateSave(this.readSave(), this.catalogue);
  }
  newGame(choice) {
    this.state = M.newState(this.catalogue, choice);
    this.enterArea('wlk001-1', null, false, false);
    this.save(false);
    this.ui.resume();
    const source = this.kit.input.source;
    const how =
      source === 'touch'
        ? 'Your left thumb moves; tap Use to interact. ☰ opens the handbook.'
        : source === 'gamepad'
          ? 'The left stick moves; X interacts. Start opens the handbook.'
          : 'WASD moves; E interacts. Press Esc for the handbook.';
    this.toast('Speak to Jiub. ' + how, true);
    this.audio.unlock().catch(() => {});
  }
  continueGame() {
    const s = M.validateSave(this.readSave(), this.catalogue);
    if (!s) {
      this.toast('No compatible save was found. Begin a new journey.');
      return;
    }
    this.state = s;
    this.enterArea(s.area, s.position, false, false);
    this.ui.resume();
    this.audio.unlock().catch(() => {});
    this.toast('Your journey continues.');
  }
  retry() {
    const oldDeaths = (this.state?.deaths || 0) + 1;
    let s = M.validateSave(this.readSave(), this.catalogue);
    if (!s || s.hp <= 0) s = M.validateSave(this.readSave(true), this.catalogue);
    if (!s) return this.toTitle();
    s.deaths = oldDeaths;
    this.state = s;
    this.enterArea(s.area, s.position, false, false);
    this.ui.resume();
    this.toast('A different approach may change the outcome.');
  }
  save(notify = true) {
    if (!this.state || this.state.hp <= 0) return false;
    this.snapshotWorld();
    this.state.position = { ...this.physics.current };
    const old = this.readSave();
    if (old && old.hp > 0) {
      this.memoryBackup = structuredClone(old);
      saveJSON(BACKUP, old);
    }
    this.memorySave = structuredClone(this.state);
    this.autosaveTime = 0;
    const ok = saveJSON(SAVE, this.state);
    if (!ok && !this.storageWarningShown) {
      this.storageWarningShown = true;
      this.toast('Browser storage is unavailable. This tab keeps a checkpoint. Export a save before closing the game.', true);
    } else if (notify)
      this.toast(ok ? 'Journey saved in this browser.' : 'Checkpoint saved for this tab only. Export it from Options.', !ok);
    return ok;
  }

  exportSave() {
    if (this.state) {
      this.snapshotWorld();
      this.state.position = { ...this.physics.current };
    }
    const s = this.state || this.readSave();
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = u;
    a.download = 'ashbound-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async importSave(file) {
    try {
      if (file.size > 2_000_000) throw Error('Save file is too large');
      const s = M.validateSave(JSON.parse(await file.text()), this.catalogue);
      if (!s) throw Error('Unsupported or damaged save');
      this.state = s;
      this.enterArea(s.area, s.position, false, false);
      this.save(false);
      this.ui.resume();
      this.toast('Save imported.');
    } catch (e) {
      this.toast('Import failed: ' + e.message);
    }
  }
  areaName(id) {
    return this.catalogue.areas.find((a) => a.id === id)?.name || id;
  }
  enterArea(id, position = null, autosave = true, snapshotCurrent = true) {
    if (snapshotCurrent) this.snapshotWorld();
    const a = this.catalogue.areas.find((x) => x.id === id);
    if (!a) throw Error('Unknown area: ' + id);
    this.projectiles = [];
    this.target = null;
    this.cooldown = 0.2;
    this.castCooldown = 0.2;
    this.oxygen = 30;
    this.accumulator = 0;
    this.pendingRefresh = false;
    this.physics.unload();
    this.view.loadArea(a);
    const s = this.state;
    if (s) {
      s.area = id;
      if (!s.visited.includes(id)) s.visited.push(id);
      const q = activeStep(s);
      if (q?.area === id && q.vertical) {
        this.view.addPlatform(0, 5, -19);
        this.view.goal.y = 5;
      }
    }
    const spawn = position || this.view.spawn;
    this.physics.load(this.view.colliders, spawn);
    this.physics.setQuality(this.view.preset);
    if (s) {
      s.position = { ...spawn };
      if (!position) {
        s.yaw = 0;
        s.pitch = 0;
      }
      this.populate(a);
      this.restoreWorld();
      this.view.mode = 'play';
      this.updateHeld();
      this.view.camera.position.set(spawn.x, spawn.y + 0.65, spawn.z);
      this.view.camera.rotation.set(s.pitch || 0, s.yaw || 0, 0, 'YXZ');
      if (autosave) this.save(false);
    }
    this.frameNo = 0;
  }
  worldKey(id) {
    return this.state.area + '|' + id;
  }
  rememberContainer(o) {
    if (!this.state || !o?.id || o.type !== 'loot') return;
    this.state.containers ??= {};
    const v = { items: [...o.items], locked: o.locked || 0, trapped: !!o.trapped };
    if (/^(dropped:|remains:)/.test(o.id))
      v.extra = { id: o.id, name: o.name, x: o.mesh.position.x, y: o.mesh.position.y, z: o.mesh.position.z };
    this.state.containers[this.worldKey(o.id)] = v;
  }
  snapshotWorld() {
    if (!this.state || this.view?.mode !== 'play' || this.view.area?.id !== this.state.area) return;
    for (const o of this.view.dynamic) this.rememberContainer(o);
    this.state.encounters ??= {};
    for (const a of this.view.actors) {
      if (a.type !== 'enemy' || a.dead) continue;
      const p = this.physics.actors.get(a)?.current || a.mesh.position;
      this.state.encounters[this.worldKey(a.id)] = { hp: a.hp, position: { x: p.x, y: p.y, z: p.z } };
    }
  }
  restoreWorld() {
    const s = this.state;
    s.containers ??= {};
    s.encounters ??= {};
    for (const o of [...this.view.dynamic]) {
      const v = s.containers[this.worldKey(o.id)];
      if (o.type !== 'loot' || !v) continue;
      o.items = [...v.items];
      o.locked = v.locked;
      o.trapped = v.trapped;
      if (!o.items.length) this.view.removeObject(o);
    }
    const prefix = s.area + '|';
    for (const [key, v] of Object.entries(s.containers))
      if (key.startsWith(prefix) && v.extra && v.items.length && !this.view.dynamic.some((o) => o.id === v.extra.id))
        this.view.addObject({ ...v.extra, type: 'loot', items: [...v.items], locked: v.locked, trapped: v.trapped });
    for (const a of this.view.actors) {
      const v = s.encounters[this.worldKey(a.id)];
      if (a.type !== 'enemy' || !v) continue;
      a.hp = Math.min(a.maxHp, v.hp);
      this.physics.teleportActor(a, v.position);
    }
  }
  refreshWorld() {
    const p = { ...this.physics.current };
    this.enterArea(this.state.area, p, false);
  }
  populate(area) {
    const s = this.state,
      q = activeStep(s),
      main = q?.area === area.id ? q : null;
    const rng = random(area.id);
    const region = this.catalogue.regions.find((r) => r.id === area.region);
    const index = region.areas.indexOf(area.id);
    let next = region.areas[index + 1],
      prev = region.areas[index - 1];
    const ridx = this.catalogue.regions.indexOf(region);
    if (!next) next = this.catalogue.regions[(ridx + 1) % this.catalogue.regions.length].areas[0];
    if (!prev) prev = this.catalogue.regions[Math.max(0, ridx - 1)].areas.slice(-1)[0];
    const ship = this.view.biome === 'ship';
    this.view.addObject({
      type: 'exit',
      name: 'Passage to ' + this.areaName(next),
      destination: next,
      x: 0,
      z: ship ? -9.5 : -28.5,
    });
    if (!ship)
      this.view.addObject({
        type: 'exit',
        name: 'Return to ' + this.areaName(prev),
        destination: prev,
        x: 0,
        z: this.view.indoor ? 23.5 : 30.5,
      });
    if (s.chapter >= 2) {
      this.view.addObject({ type: 'travel', name: this.transportName(area), x: -3.5, z: 17 });
      this.view.addObject({ type: 'shrine', name: 'Wayside shrine · rest & services', x: 4, z: 18 });
    }
    const sideHere = SIDES.filter((x) => x.area === area.id);
    const names = new Set();
    const addNPC = (name, x, z, y = 0) => {
      if (names.has(name)) return;
      names.add(name);
      const actor = this.view.addActor({ id: 'npc:' + name, type: 'npc', name, x, y, z, line: this.localLine(area) });
      this.physics.addActor(actor);
      return actor;
    };
    if (main?.type === 'talk') addNPC(main.target, this.view.goal.x, this.view.goal.z, this.view.goal.y);
    sideHere.forEach((side, i) => {
      if (!(side.enemy === side.giver && s.sides[side.id] === 1)) addNPC(side.giver, -5 - i * 2, 5 - i * 3);
    });
    const enemyNames = new Set(sideHere.filter((x) => s.sides[x.id] === 1).map((x) => x.enemy));
    if (main?.type === 'kill') enemyNames.add(main.target);
    area.npcs
      .filter((n) => !enemyNames.has(n) && n.length < 50 && !/guard|assassin|smuggler|bandit/i.test(n))
      .slice(0, ship ? 1 : 3)
      .forEach((name, i) => addNPC(name, (i % 2 ? -1 : 1) * (4 + i * 0.9), 8 - i * 6));
    if (main?.type === 'kill') this.spawnEnemy(main.target, main.id, 0, -15, main.act, true);
    if (main?.guard && !s.defeated.includes('guard:' + main.id))
      this.spawnEnemy(main.guard, 'guard:' + main.id, 3, -10, main.act, false);
    if (main?.type === 'collect') {
      if (main.id === 'kogoruhn') {
        for (const [i, n] of ['House Dagoth Cup', 'Corprus Weepings', 'Shadow Shield'].entries())
          this.view.addObject({
            id: 'goal:' + main.id + ':' + i,
            type: 'loot',
            name: n,
            items: [n],
            quest: true,
            x: (i - 1) * 3,
            y: 0,
            z: -22,
          });
      } else
        this.view.addObject({
          id: 'goal:' + main.id,
          type: 'loot',
          name: main.target,
          items: [main.target],
          quest: true,
          x: 0,
          y: this.view.goal.y,
          z: this.view.goal.z,
        });
    }
    if (main?.type === 'ritual')
      this.view.addObject({ id: 'heart', type: 'heart', name: 'Heart of Lorkhan', x: 0, y: 0, z: -21 });
    if (main?.type === 'puzzle')
      this.view.addObject({ id: 'puzzle:' + main.id, type: 'puzzle', name: main.target, x: 0, y: 0, z: -20 });
    if (main?.type === 'exit') {
      const gate = this.view.dynamic.find((x) => x.type === 'exit');
      gate.name = 'Freedom · leave the glacier';
      gate.finish = true;
    }
    sideHere.forEach((side, i) => {
      if (s.sides[side.id] !== 1) return;
      if (side.enemy && !s.defeated.includes('side:' + side.id))
        this.spawnEnemy(
          side.enemy,
          'side:' + side.id,
          -3 - i * 2,
          -11 - i * 2,
          side.source === 'WLK031' ? 3 : 1,
          side.id === 'umbra',
        );
      if (side.item && !M.hasItem(s, side.item))
        this.view.addObject({
          id: 'side-item:' + side.id,
          type: 'loot',
          name: side.item,
          items: [side.item],
          x: 6 + i * 2,
          z: -9 - i * 2,
        });
    });
    // Each catalogue item is placed in its source cell's cache, not merely listed in the UI.
    const sourceItems = area.items.filter((n) => n && n.length < 160 && !/^[0-9]+[.]?$/.test(n));
    if (sourceItems.length && !s.looted.includes('cache:' + area.id))
      this.view.addObject({
        id: 'cache:' + area.id,
        type: 'loot',
        name: 'Traveller’s cache · local finds',
        items: [...sourceItems],
        x: ship ? 3 : 6,
        z: ship ? 3 : 9,
        locked: 0,
      });
    if (!ship && !s.looted.includes('chest:' + area.id)) {
      const items = ['Standard Restore Health', 'Standard Restore Magicka', rng() > 0.5 ? 'Marshmerrow' : 'Saltrice'];
      if (this.view.indoor) items.push(rng() > 0.7 ? 'Grand Soul Gem' : 'Silver Dagger');
      this.view.addObject({
        id: 'chest:' + area.id,
        type: 'loot',
        name: 'Weathered coffer',
        items,
        x: -6,
        z: -7,
        locked: this.view.indoor ? 20 : 0,
        trapped: this.view.indoor && rng() > 0.6,
      });
    }
    const wild = /wilderness|road|tomb|cavern|cave|mine|ilunibi|kogoruhn|dwemer|arkng|sewer/i.test(area.name);
    if (wild && s.chapter >= 2) {
      for (let i = 0; i < 2; i++) {
        const id = area.id + ':wild:' + i;
        if (s.defeated.includes(id)) continue;
        const type =
          this.view.biome === 'snow' || this.view.biome === 'ice'
            ? 'Snow Wolf'
            : this.view.indoor
              ? i
                ? 'Ancestral Ghost'
                : 'Cave Rat'
              : i
                ? 'Nix-Hound'
                : 'Mudcrab';
        this.spawnEnemy(type, id, (i ? 1 : -1) * 6, -1 - i * 6, area.region === 'wlk031' ? 3 : 0, false);
      }
    }
  }
  transportName(area) {
    return area.region === 'wlk031'
      ? 'Northern passage · boats & roads'
      : this.view.biome === 'telvanni'
        ? 'Boat & guild-guide routes'
        : this.view.indoor
          ? 'Wayfinder · return routes'
          : 'Silt strider & road routes';
  }
  localLine(area) {
    if (this.view.biome === 'ash')
      return 'The ash gets into everything. Keep your waterskin close and your promises closer. Out here, a stranger is measured by what they do.';
    if (area.region === 'wlk031')
      return 'The snow has a way of making every sound seem farther away. Do not let it fool you. The wolves know exactly where you are.';
    if (this.view.biome === 'telvanni')
      return 'A staircase is a useful thing, if you have never considered levitation. The masters do not build their towers for everyone.';
    return 'The roads are open. Take care with the tombs, and keep something silver or enchanted in your pack. Not every ancestor sleeps peacefully.';
  }
  spawnEnemy(name, id, x, z, act = 0, boss = false) {
    if (this.state.defeated.includes(id)) return null;
    const rat = /rat/i.test(name),
      crab = /mudcrab/i.test(name),
      ghost = /ghost|spectre/i.test(name);
    let hp = rat ? 18 : crab ? 28 : ghost ? 48 : 55 + act * 30;
    const unique = {
      'Dagoth Gares': 135,
      'Bolvyn Venim': 155,
      'Ulath-Pal': 150,
      'Dagoth Araynys': 180,
      'Dagoth Vemyn': 180,
      'Dagoth Ur': 240,
      'The Imperfect': 280,
      Almalexia: 300,
      Udyrfrykte: 245,
      Karstaag: 300,
      'Tharsten Heart-Fang': 235,
      Hircine: 320,
      Umbra: 210,
    };
    hp = unique[name] || hp;
    const actor = this.view.addActor({
      id,
      type: 'enemy',
      name,
      x,
      z,
      hp,
      maxHp: hp,
      home: { x, z },
      damage: rat ? 3 : crab ? 5 : boss ? 12 + act * 4 : 6 + act * 2,
      speed: crab ? 1.2 : rat ? 2.4 : /Tharsten|Wolf/.test(name) ? 4 : 2.5,
      evasion: boss ? 14 : 8,
      normalImmune: ghost,
      element: /Almalexia|Imperfect/.test(name) ? 'Shock' : /Dagoth Ur/.test(name) ? 'Fire' : null,
      boss,
      timer: 0.9,
      winding: false,
      alerted: false,
      buffs: {},
      docile: name === 'Hircine' && !this.state.flags.aspectChosen,
    });
    if (name === 'Hircine' && this.state.flags.aspectChosen) this.applyAspect(actor, this.state.aspect);
    this.physics.addActor(actor);
    return actor;
  }
  inCombat() {
    if (!this.state) return false;
    return this.view.actors.some(
      (a) => a.type === 'enemy' && !a.dead && !a.docile && a.alerted && distance(a.mesh.position, this.physics.current) < 14,
    );
  }
  nearServices() {
    if (!this.state) return false;
    return (
      this.view.dynamic.some(
        (o) => ['travel', 'shrine', 'exit'].includes(o.type) && distance(o.mesh.position, this.physics.current) < 7,
      ) ||
      this.ui.screen === 'dialogue' ||
      this.ui.screen === 'barter' ||
      this.view.actors.some((a) => a.type === 'npc' && distance(a.mesh.position, this.physics.current) < 5)
    );
  }
  canTravel() {
    return !!this.state && this.state.chapter >= 2 && !this.inCombat() && this.nearServices();
  }
  travel(id, free = false) {
    if (!this.state) return;
    const gate = gateForArea(id, this.state);
    if (gate) {
      this.toast(gate);
      return;
    }
    if (!free && !this.canTravel()) {
      this.toast('Find nearby travel services and leave combat first.');
      return;
    }
    const from = this.catalogue.areas.find((x) => x.id === this.state.area),
      to = this.catalogue.areas.find((x) => x.id === id);
    const cost = free || from.region === to.region ? 0 : 12;
    if (this.state.gold < cost) {
      this.toast('You need 12 drakes for this passage. Local gates and roads are free.');
      return;
    }
    this.state.gold -= cost;
    this.state.days++;
    this.enterArea(id);
    this.ui.resume();
    this.audio.play('menu', 0.4);
    this.toast(this.areaName(id));
  }
  advance(event) {
    const q = activeStep(this.state);
    if (q?.id === 'kogoruhn' && !['House Dagoth Cup', 'Corprus Weepings', 'Shadow Shield'].every((n) => M.hasItem(this.state, n)))
      return false;
    if (!M.progress(this.state, event, this.catalogue)) return false;
    this.toast('Journal updated · ' + q.title, true);
    this.audio.play('reward', 0.7);
    this.pendingRefresh = true;
    this.save(false);
    if (q.reward.flag === 'ending') {
      this.pendingEnding = true;
    }
    return true;
  }
  completeTalk(actor) {
    const q = activeStep(this.state);
    if (!actor || q?.target !== actor.name || q.type !== 'talk' || q.area !== this.state.area) return;
    if (this.disposition(actor.name) < (q.disposition || 0)) return this.toast('Earn this person’s trust first.');
    M.gainSkill(this.state, 'Speechcraft', 12, this.catalogue);
    this.advance({ type: 'talk', target: actor.name, area: this.state.area });
    this.ui.resume();
  }
  dialogueLine(q) {
    return lines[q.id] || q.text;
  }
  disposition(name) {
    return clamp(
      Math.round(
        this.state.dispositions[name] ?? 30 + this.state.attrs.Personality * 0.45 + (this.state.race === 'Dark Elf' ? 5 : 0),
      ),
      0,
      100,
    );
  }
  persuade(actor, kind) {
    if (!actor) return;
    const s = this.state;
    let delta = 0;
    if (kind === 'bribe') {
      if (s.gold < 10) return;
      s.gold -= 10;
      delta = 12;
    } else {
      const chance = clamp(
        0.4 + s.skills.Speechcraft * 0.005 + (kind === 'intimidate' ? s.attrs.Strength : s.attrs.Personality) * 0.003,
        0.25,
        0.95,
      );
      delta = Math.random() < chance ? (kind === 'intimidate' ? 14 : 9) : -3;
    }
    s.dispositions[actor.name] = clamp(this.disposition(actor.name) + delta, 0, 100);
    M.gainSkill(s, 'Speechcraft', Math.max(1, delta), this.catalogue);
    this.toast(delta > 0 ? 'Your words have weight.' : 'That did not impress them.');
  }
  sideTalk(id, actor) {
    const q = SIDES.find((x) => x.id === id);
    const result = M.advanceSide(this.state, id, 'talk', actor.name, this.catalogue);
    if (result === 'accepted') {
      this.toast('Undertaking accepted · ' + q.title, true);
      this.ui.mount(
        q.title,
        `<p class="dialogue-quote">${H(q.description)}</p><p>${q.item ? 'Bring ' + H(q.item) + ' to ' + H(q.giver) + '.' : 'Confront ' + H(q.enemy) + ' in this area.'}</p><button data-action="resume" class="primary">I will see it done.</button>`,
        { compact: true },
      );
      this.pendingRefresh = true;
    } else if (result === 'completed') {
      if (q.item && !ESSENTIAL.has(q.item)) M.removeItem(this.state, q.item);
      this.toast('Promise kept · ' + q.title, true);
      this.audio.play('reward');
      this.ui.resume();
      this.pendingRefresh = true;
      this.save(false);
    } else this.toast('You still need ' + (q.item || 'to defeat ' + q.enemy) + '.');
  }
  rumors(actor) {
    const quests = SIDES.filter((q) => !this.state.sides[q.id]).slice(0, 3);
    this.ui.mount(
      'A few things worth hearing',
      `<p>${H(this.localLine(this.catalogue.areas.find((a) => a.id === this.state.area)))}</p>${quests.map((q) => `<div class="quest-card"><h3>${H(q.title)}</h3><p>${H(q.giver)} may have work at ${H(this.areaName(q.area))}.</p></div>`).join('')}<button data-action="resume" class="primary">Return to the road</button>`,
      { compact: true },
    );
  }
  interact() {
    if (this.modal || !this.state) return;
    const obj = this.view.aim([...this.view.actors, ...this.view.dynamic], 4.5);
    if (!obj) {
      this.toast('Move closer and look at a person, object, or passage.');
      return;
    }
    if (obj.type === 'npc') {
      this.ui.dialogue(obj);
      return;
    }
    if (obj.type === 'enemy') {
      if (obj.docile && obj.name === 'Hircine') this.ui.aspect(obj);
      else this.toast('They are not interested in conversation.');
      return;
    }
    if (obj.type === 'travel') {
      this.ui.map();
      return;
    }
    if (obj.type === 'shrine') {
      this.rest(true);
      return;
    }
    if (obj.type === 'exit') {
      if (obj.finish) {
        this.advance({ type: 'exit', target: 'Freedom', area: this.state.area });
        return;
      }
      this.travel(obj.destination, true);
      return;
    }
    if (obj.type === 'heart') {
      this.toast('Equip Wraithguard, then strike with Sunder once and Keening five times.');
      return;
    }
    if (obj.type === 'puzzle') {
      this.ui.puzzle(obj);
      return;
    }
    if (obj.type === 'loot') {
      if (obj.locked || obj.trapped) this.ui.lock(obj);
      else this.openContainer(obj);
    }
  }
  openContainer(obj) {
    if (!obj || obj.type !== 'loot' || obj.locked) return;
    if (obj.trapped) {
      obj.trapped = false;
      this.rememberContainer(obj);
      this.hurt(12, 'Shock');
      this.toast('The trap discharges!');
    }
    if (this.state.hp <= 0) return;
    this.ui.loot(obj);
    this.save(false);
  }
  take(obj, name) {
    if (!obj || obj.locked || obj.trapped || !obj.items?.includes(name)) return;
    M.addItem(this.state, name);
    obj.items.splice(obj.items.indexOf(name), 1);
    this.audio.play('pickup', 0.6);
    this.toast('Acquired · ' + name);
    const q = activeStep(this.state);
    if (q?.type === 'collect' && q.area === this.state.area) {
      if (q.id === 'kogoruhn') {
        if (['House Dagoth Cup', 'Corprus Weepings', 'Shadow Shield'].every((n) => M.hasItem(this.state, n)))
          this.advance({ type: 'collect', target: q.target, area: q.area });
      } else if (name === q.target) this.advance({ type: 'collect', target: name, area: this.state.area });
    }
    this.rememberContainer(obj);
    if (!obj.items.length) {
      if (obj.id && !this.state.looted.includes(obj.id)) this.state.looted.push(obj.id);
      this.view.removeObject(obj);
    }
    this.save(false);
  }
  takeAll(obj) {
    if (!obj) return;
    for (const n of [...obj.items]) this.take(obj, n);
    this.ui.resume();
  }
  lockChance(obj) {
    return clamp(
      ((this.state.skills.Security + this.state.attrs.Agility * 0.2 - obj.locked * 0.5) *
        (0.75 + (0.5 * this.state.fp) / M.maxFatigue(this.state))) /
        100,
      0.05,
      0.98,
    );
  }
  consumeTool(type) {
    const n = Object.keys(this.state.inventory).find((n) => M.itemInfo(n, this.catalogue).tool === type);
    if (!n) return false;
    this.state.toolCharges ??= {};
    this.state.toolCharges[n] = (this.state.toolCharges[n] ?? 25) - 1;
    if (this.state.toolCharges[n] <= 0) {
      M.removeItem(this.state, n);
      delete this.state.toolCharges[n];
    }
    return true;
  }
  pick(obj) {
    if (!obj?.locked) return this.openContainer(obj);
    if (!this.consumeTool('pick')) return this.toast('You need a lockpick. A merchant sells them.');
    this.audio.play('lock', 0.6);
    if (Math.random() < this.lockChance(obj)) {
      obj.locked = 0;
      M.gainSkill(this.state, 'Security', 14, this.catalogue);
      this.toast('Lock opened.');
      this.openContainer(obj);
    } else this.toast('The pick slips. One tool use spent.');
    this.save(false);
  }
  disarm(obj) {
    if (!obj?.trapped) return;
    if (!this.consumeTool('probe')) return this.toast('You need a probe to disarm a trap.');
    obj.trapped = false;
    M.gainSkill(this.state, 'Security', 16, this.catalogue);
    this.toast('Trap disarmed.');
    this.rememberContainer(obj);
    obj.locked ? this.ui.lock(obj) : this.openContainer(obj);
    this.save(false);
  }
  openLock(obj) {
    const sp = M.spellById(this.state, this.catalogue, this.state.selectedSpell);
    if (sp.effect !== 'Open') {
      this.toast('Ready an Open spell in the Magic menu first.');
      return;
    }
    if (this.state.mp < sp.cost) return this.toast('Not enough Magicka.');
    this.state.mp -= sp.cost;
    if (sp.magnitude >= obj.locked && Math.random() < M.spellChance(this.state, sp)) {
      obj.locked = 0;
      M.gainSkill(this.state, 'Alteration', 8, this.catalogue);
      this.rememberContainer(obj);
      this.openContainer(obj);
    } else this.toast('The spell cannot open this lock.');
  }
  equip(name) {
    const err = M.equip(this.state, name, this.catalogue);
    if (err) this.toast(err);
    else {
      this.updateHeld();
      this.audio.play('pickup', 0.35);
      this.toast('Equipped · ' + name);
      this.save(false);
    }
  }
  updateHeld() {
    const w = M.weapon(this.state, this.catalogue);
    this.view.buildWeapon(w.name, w.skill);
  }
  drink(name) {
    if (M.usePotion(this.state, name, this.catalogue)) {
      this.audio.play('heal', 0.5);
      this.toast('Used · ' + name);
    }
  }
  quickPotion(effect) {
    const n = Object.keys(this.state.inventory).find((n) => M.itemInfo(n, this.catalogue).effect === effect);
    if (n) this.drink(n);
    else this.toast('No ' + effect + ' potion in your pack.');
  }
  drop(name) {
    if (ESSENTIAL.has(name)) return this.toast('Keep this: the prophecy may depend on it.');
    if (Object.values(this.state.equipment).includes(name))
      return this.toast('Equip something else before dropping a worn item.');
    if (M.removeItem(this.state, name)) {
      const p = this.physics.current;
      this.view.addObject({
        type: 'loot',
        id: 'dropped:' + Date.now(),
        name: 'Dropped ' + name,
        items: [name],
        x: p.x + 1.2,
        y: Math.max(0, p.y - 0.8),
        z: p.z,
      });
      this.toast('Dropped · ' + name);
      this.save(false);
    }
  }
  read(name) {
    const s = this.state;
    let bonus = '';
    if (!s.read.includes(name)) {
      s.read.push(name);
      const skill = this.catalogue.skills.find((sk) =>
        sk.books?.some((b) => b.replace(/[.*]/g, '').trim() === name.replace(/[.*]/g, '').trim()),
      );
      if (skill) {
        s.skillXP[skill.name] = 0;
        M.gainSkill(s, skill.name, 5 + s.skills[skill.name] * 0.12, this.catalogue);
        bonus = `Studying this book increases ${skill.name} by 1.`;
      } else bonus = 'The title is recorded in your reading journal.';
    }
    this.ui.screen = 'book';
    this.ui.mount(
      name,
      `<p class="dialogue-quote">A traveller’s education does not end at the edge of a blade.</p><p>This volume is listed in the supplied guide. The original book’s complete prose is not included in this adaptation.</p><div class="notice">${H(bonus || 'You have already studied this volume.')}</div><small>Reading record: ${s.read.length} volumes</small><hr><button data-action="inventory" class="primary">Close the book</button>`,
      { compact: true },
    );
    this.save(false);
  }
  useRing(name) {
    const i = M.itemInfo(name, this.catalogue);
    if (!i.heal || !M.hasItem(this.state, name)) return;
    this.state.itemCharge ??= {};
    const charge = this.state.itemCharge[name] ?? 100;
    if (charge < 25) return this.toast('This enchantment needs to recharge.');
    this.state.itemCharge[name] = charge - 25;
    this.state.hp = Math.min(M.maxHealth(this.state), this.state.hp + i.heal);
    M.gainSkill(this.state, 'Enchant', 5, this.catalogue);
    this.audio.play('heal', 0.55);
  }
  repair(name) {
    if (!this.consumeTool('repair')) return this.toast('You need an armorer’s hammer.');
    this.state.condition[name] = 100;
    M.gainSkill(this.state, 'Armorer', 12, this.catalogue);
    this.toast('Repaired · ' + name);
    this.audio.play('lock', 0.5);
  }
  brew(a, b) {
    const r = M.alchemy(this.state, a, b, this.catalogue);
    this.toast(r.text);
    if (r.ok) this.audio.play('heal', 0.45);
  }
  enchant(name) {
    const s = this.state;
    if (s.gold < 80 || !M.removeItem(s, 'Filled Soul Gem')) return;
    s.gold -= 80;
    const i = M.itemInfo(name, this.catalogue);
    s.enchantments[name] = {
      effect: i.type === 'weapon' ? 'Shock Damage' : 'Restore Fatigue',
      magnitude: i.type === 'weapon' ? 8 : 2,
      charge: 100,
    };
    M.gainSkill(s, 'Enchant', 25, this.catalogue);
    this.toast('The soul settles into ' + name + '.', true);
    this.audio.play('spell');
    this.save(false);
  }
  stock() {
    const act = activeStep(this.state)?.act || 3;
    return [
      'Standard Restore Health',
      'Standard Restore Magicka',
      'Standard Restore Fatigue',
      'Quality Restore Health',
      'Journeyman’s Lockpick',
      'Journeyman’s Probe',
      'Apprentice’s Armorer’s Hammer',
      'Marshmerrow',
      'Saltrice',
      'Diamond',
      'Grand Soul Gem',
      'Iron Saber',
      'Silver Dagger',
      'Chitin Spear',
      'Chitin Short Bow',
      'Bonemold Cuirass',
      'Steel Shield',
      'Glass Cuirass',
      ...(act >= 2 ? ['Daedric Katana', 'Daedric Tower Shield'] : []),
    ];
  }
  price(name, buy, npc = 'Trader') {
    const i = M.itemInfo(name, this.catalogue);
    const factor = buy
      ? 1.12 - this.state.skills.Mercantile * 0.003 - (this.disposition(npc) - 50) * 0.002
      : 0.45 + this.state.skills.Mercantile * 0.002;
    return Math.max(1, Math.round(i.value * factor));
  }
  buy(name, npc) {
    const price = this.price(name, true, npc);
    if (this.state.gold < price) return;
    this.state.gold -= price;
    M.addItem(this.state, name);
    M.gainSkill(this.state, 'Mercantile', 6, this.catalogue);
    this.audio.play('pickup', 0.35);
  }
  sell(name, npc) {
    if (ESSENTIAL.has(name) || Object.values(this.state.equipment).includes(name)) return;
    if (M.removeItem(this.state, name)) {
      this.state.gold += this.price(name, false, npc);
      M.gainSkill(this.state, 'Mercantile', 6, this.catalogue);
      this.audio.play('pickup', 0.3);
    }
  }
  learn(id) {
    if (!this.nearServices()) return this.toast('Find a spellcaster or services first.');
    const sp = [...M.START_SPELLS, ...this.catalogue.spells].find((x) => x.id === id);
    if (!sp || this.state.knownSpells.includes(id)) return;
    const fee = 20 + sp.cost;
    if (this.state.gold < fee) return;
    this.state.gold -= fee;
    this.state.knownSpells.push(id);
    this.toast('Learned · ' + sp.name);
    this.audio.play('spell', 0.4);
  }
  makeSpell(spec) {
    if (!this.nearServices()) return this.toast('Spellmaking requires nearby services.');
    const sp = M.createSpell(
      this.state,
      spec.name,
      spec.effect,
      spec.school,
      spec.magnitude,
      spec.duration,
      spec.target,
      this.catalogue,
    );
    if (!sp) return this.toast('Not enough drakes.');
    this.state.selectedSpell = sp.id;
    this.toast('Created · ' + sp.name, true);
    this.audio.play('spell', 0.6);
    this.ui.magic();
    this.save(false);
  }
  rest(atShrine = false) {
    if (this.inCombat()) return this.toast('You cannot rest while enemies are near.');
    if (this.state.buffs.Levitate) return this.toast('Land before resting.');
    M.rest(this.state);
    if (atShrine && this.state.sign === 'The Atronach') {
      this.state.mp = M.maxMagicka(this.state);
      this.toast('The shrine’s blessing replenishes your Magicka.');
    }
    this.audio.play('heal', 0.5);
    if (this.state.pendingLevels.length) this.ui.level();
    else this.toast('You awaken rested.');
    this.save(false);
  }
  level(attrs) {
    if (M.levelUp(this.state, attrs)) {
      this.toast('Level ' + this.state.level + ' · your experience becomes strength.', true);
      this.audio.play('reward', 0.8);
      this.save(false);
      if (this.state.pendingLevels.length) this.ui.level();
      else this.ui.resume();
    }
  }
  slot(n) {
    if (!this.state) return;
    if (n === 1) {
      const names = Object.keys(this.state.inventory).filter((x) => M.itemInfo(x, this.catalogue).type === 'weapon');
      if (names.length)
        this.equip(names.sort((a, b) => M.itemInfo(b, this.catalogue).damage - M.itemInfo(a, this.catalogue).damage)[0]);
    } else this.state.selectedSpell = n === 2 ? 'embers' : n === 3 ? 'balm' : 'lift';
  }
  nextSpell() {
    const i = this.state.knownSpells.indexOf(this.state.selectedSpell);
    this.state.selectedSpell = this.state.knownSpells[(i + 1) % this.state.knownSpells.length];
    this.toast('Readied · ' + M.spellById(this.state, this.catalogue, this.state.selectedSpell).name);
  }
  nextWeapon() {
    const names = Object.keys(this.state.inventory).filter((x) => M.itemInfo(x, this.catalogue).type === 'weapon');
    const i = names.indexOf(this.state.equipment.weapon);
    if (names.length) this.equip(names[(i + 1) % names.length]);
  }
  attack(charge = 1) {
    if (this.modal || !this.state || this.cooldown > 0) return;
    this.cooldown = 0.32 + charge * 0.24;
    this.view.swing = 1;
    const s = this.state,
      w = M.weapon(s, this.catalogue);
    const chanceTarget = this.view.aim(
      this.view.actors.filter((a) => a.type === 'enemy'),
      w.skill === 'Marksman' ? 28 : w.skill === 'Spear' ? 4.7 : 3.7,
    );
    const heart = this.view.aim(
      this.view.dynamic.filter((o) => o.type === 'heart'),
      4,
    );
    const chance = M.attackChance(s, w.skill, chanceTarget || {});
    s.fp = Math.max(0, s.fp - (w.skill === 'Spear' ? 9 : 7) - charge * 5);
    delete s.buffs.Invisibility;
    if (heart) {
      this.strikeHeart(w.name);
      return;
    }
    if (!chanceTarget || chanceTarget.docile) {
      this.audio.play('miss', 0.4);
      if (chanceTarget?.docile) this.toast('Hear the Hunter’s question before you fight.');
      return;
    }
    if (Math.random() > chance) {
      this.audio.play('miss', 0.45);
      this.float(chanceTarget, 'Evaded', 0xd6c69e);
      return;
    }
    const enchanted = !!s.enchantments[w.name] || !!w.element || /Silver|Daedric|Bound|Sunder|Keening/.test(w.name);
    if (chanceTarget.normalImmune && !enchanted) {
      this.toast('Normal weapons pass through the spirit. Use silver, enchantments, or spells.');
      return;
    }
    let damage =
      ((w.damage || 6) * (0.4 + charge * 0.85) * (0.55 + M.attribute(s, 'Strength') / 100) * (s.condition[w.name] ?? 100)) / 100;
    if (this.sneaking && !chanceTarget.alerted) damage *= 2;
    if (s.enchantments[w.name]) damage += s.enchantments[w.name].magnitude;
    s.condition[w.name] = Math.max(5, (s.condition[w.name] ?? 100) - 0.65);
    M.gainSkill(s, w.skill || 'Hand-to-Hand', 6, this.catalogue);
    this.hit(chanceTarget, damage, w.element);
    this.audio.play('hit', 0.75);
  }
  strikeHeart(weapon) {
    const s = this.state,
      q = activeStep(s);
    if (q?.id !== 'heart') return;
    if (s.equipment.gauntlet !== 'Wraithguard') {
      this.hurt(15, 'Magicka');
      this.toast('Wraithguard must be equipped.');
      return;
    }
    if (s.heart === 0 && weapon === 'Sunder') {
      s.heart = 1;
      this.toast('The Heart’s enchantment is exposed. Now use Keening.', true);
      this.audio.play('spell');
    } else if (s.heart >= 1 && weapon === 'Keening') {
      s.heart++;
      this.toast(`Keening severs the bindings · ${s.heart - 1} / 5`);
      this.view.particle(0, 1.8, -21, 0xf7b174, 16);
      this.audio.play('hit', 0.8, 0.65);
      if (s.heart >= 6) this.advance({ type: 'ritual', target: 'Heart of Lorkhan', area: s.area });
    } else this.toast(s.heart === 0 ? 'Strike once with Sunder first.' : 'The hammer has done its work. Switch to Keening.');
  }
  hit(actor, damage, element = null) {
    if (actor.dead || actor.docile) return;
    actor.alerted = true;
    if (element === 'Fire' && /Flame/.test(actor.name)) damage *= 0.1;
    if (element === 'Frost' && /Karstaag|Snow|Frost/.test(actor.name)) damage *= 0.1;
    if (actor.buffs.Weakness) damage *= 1 + actor.buffs.Weakness.magnitude / 100;
    actor.hp -= damage;
    actor.hitTime = 0.22;
    this.float(actor, Math.round(damage), element ? 0xb4d8bc : 0xe9c18a);
    this.view.particle(
      actor.mesh.position.x,
      actor.mesh.position.y + 1,
      actor.mesh.position.z,
      element === 'Fire' ? 0xeaaa6e : 0xc9bc8b,
      7,
    );
    if (actor.hp <= 0) this.kill(actor);
  }
  kill(actor) {
    if (actor.dead) return;
    actor.dead = true;
    actor.hp = 0;
    const s = this.state;
    s.kills++;
    if (!s.defeated.includes(actor.id)) s.defeated.push(actor.id);
    if (s.encounters) delete s.encounters[this.worldKey(actor.id)];
    const p = actor.mesh.position.clone();
    this.physics.removeActor(actor);
    this.view.removeObject(actor);
    s.gold += actor.boss ? 50 : 10;
    if (actor.buffs.Soultrap) {
      const star = M.hasItem(s, 'Azura’s Star') || M.hasItem(s, "Azura's Star");
      const gem = Object.keys(s.inventory).find(
        (n) => M.itemInfo(n, this.catalogue).type === 'soul' && !M.itemInfo(n, this.catalogue).reusable,
      );
      if (star || gem) {
        if (gem && !star) M.removeItem(s, gem);
        M.addItem(s, 'Filled Soul Gem');
        this.toast('Soul captured.', true);
        M.gainSkill(s, 'Mysticism', 10, this.catalogue);
      }
    }
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(this.view.debrisGeometry, this.view.debrisMaterials[i % 2]);
      mesh.castShadow = true;
      mesh.position.copy(p);
      mesh.position.y += 1;
      mesh.userData.shared = true;
      this.view.root.add(mesh);
      this.physics.throwDebris(mesh, mesh.position);
    }
    const loot = ['Standard Restore Health', this.view.indoor ? 'Bonemeal' : 'Hide'];
    this.view.addObject({
      id: 'remains:' + actor.id,
      type: 'loot',
      name: actor.name + ' · remains',
      items: loot,
      x: p.x,
      y: Math.max(0, p.y),
      z: p.z,
    });
    this.advance({ type: 'kill', target: actor.name, area: s.area });
    const side = SIDES.find((q) => 'side:' + q.id === actor.id);
    if (side) {
      M.advanceSide(s, side.id, 'kill', actor.name, this.catalogue);
      this.toast('Undertaking complete · ' + side.title, true);
      this.audio.play('reward');
      this.save(false);
    }
  }
  hurt(amount, element = null) {
    const s = this.state;
    if (!s || s.hp <= 0) return;
    if (!element && s.equipment.shield && Math.random() < clamp((s.skills.Block || 5) / 200, 0.1, 0.5)) {
      M.gainSkill(s, 'Block', 9, this.catalogue);
      this.toast('Blocked.');
      this.audio.play('lock', 0.3);
      return;
    }
    const result = M.damagePlayer(s, amount, element, this.catalogue, this.options.difficulty);
    if (result.absorbed) {
      this.toast('Spell absorbed · Magicka restored.');
      this.audio.play('heal', 0.3);
      return;
    }
    if (result.amount <= 0) return;
    this.audio.play('hurt', 0.3);
    if (this.options.motion) this.view.shake = 0.7;
    document.body.classList.add('hurt');
    setTimeout(() => document.body.classList.remove('hurt'), 190);
    const armor = Object.values(s.equipment).find((n) => M.itemInfo(n, this.catalogue).type === 'armor');
    if (armor) {
      M.gainSkill(s, M.itemInfo(armor, this.catalogue).skill || 'Heavy Armor', 5, this.catalogue);
      s.condition[armor] = Math.max(5, (s.condition[armor] ?? 100) - 0.4);
    } else M.gainSkill(s, 'Unarmored', 6, this.catalogue);
    if (s.hp <= 0) {
      this.audio.play('death', 0.75);
      this.ui.death();
    }
  }
  cast() {
    if (this.modal || !this.state || this.castCooldown > 0) return;
    const s = this.state,
      sp = M.spellById(s, this.catalogue, s.selectedSpell);
    if (s.mp < sp.cost) return this.toast('Not enough Magicka. Rest, drink a potion, or use an enchantment.');
    if (s.buffs.Silence) return this.toast('You are silenced.');
    this.castCooldown = 0.58;
    s.mp -= sp.cost;
    delete s.buffs.Invisibility;
    if (Math.random() > M.spellChance(s, sp)) {
      this.audio.play('miss', 0.3);
      this.toast('Casting failed · ' + sp.name);
      return;
    }
    M.gainSkill(s, sp.school, 9, this.catalogue);
    this.audio.play('spell', 0.55);
    this.view.swing = 0.5;
    this.effect(sp);
  }
  effect(sp) {
    const s = this.state;
    const e = sp.effect || '',
      m = sp.magnitude || 10,
      d = sp.duration || 10;
    const target = this.view.aim(
      this.view.actors.filter((a) => a.type === 'enemy'),
      sp.target === 'Touch' ? 4.3 : 30,
    );
    const buff = (key, mag = m, dur = d) => {
      s.buffs[key] = { remaining: dur, magnitude: mag };
    };
    if (/Restore Health/.test(e)) {
      s.hp = Math.min(M.maxHealth(s), s.hp + m * Math.min(d, 3));
      this.audio.play('heal', 0.5);
      this.toast('Health restored.');
    } else if (/Restore Magicka/.test(e)) s.mp = Math.min(M.maxMagicka(s), s.mp + m);
    else if (/Restore Fatigue/.test(e)) s.fp = Math.min(M.maxFatigue(s), s.fp + m * Math.min(d, 3));
    else if (/Cure/.test(e)) {
      delete s.buffs.Poison;
      delete s.flags.disease;
      this.toast('Affliction cured.');
    } else if (e === 'Mark') {
      s.mark = { area: s.area, position: { ...this.physics.current } };
      this.toast('This place is marked.');
    } else if (e === 'Recall' || /Intervention/.test(e)) {
      if (['wlk029-15', 'wlk030-10', 'wlk031-13'].includes(s.area)) return this.toast('Teleportation is suppressed here.');
      if (e === 'Recall') {
        if (!s.mark) return this.toast('No location has been marked.');
        this.enterArea(s.mark.area, s.mark.position);
        this.ui.resume();
      } else {
        const reg = this.catalogue.regions.find((r) => r.areas.includes(s.area));
        this.enterArea(reg.areas[0]);
        this.ui.resume();
      }
    } else if (/Levitate/.test(e)) {
      if (s.area.startsWith('wlk030')) return this.toast('Levitation is forbidden in Mournhold.');
      buff('Levitate', m, Math.max(10, d));
      this.toast('Levitation · look up and move forward, or hold Space / ↑.');
    } else if (
      /Water Walking|Water Breathing|Slowfall|Swift Swim|Jump|Feather|Shield|Sanctuary|Night-Eye|Night Eye|Light|Invisibility|Chameleon|Resist|Reflect|Spell Absorption/.test(
        e,
      )
    ) {
      buff(e, m, Math.max(5, d));
      this.toast(sp.name + ' takes hold.');
    } else if (/^Bound /.test(e)) {
      buff(e, m, Math.max(15, d));
      this.updateHeld();
      this.toast('A daedric binding takes shape · ' + e);
    } else if (/^Summon /.test(e)) {
      this.summonAlly(e.replace('Summon ', ''), Math.max(10, d));
    } else if (/Open/.test(e)) {
      const obj = this.view.aim(
        this.view.dynamic.filter((o) => o.locked),
        5,
      );
      if (obj && m >= obj.locked) {
        obj.locked = 0;
        this.toast('The lock yields.');
      } else this.toast('No suitable lock in reach.');
    } else if (e === 'Lock') {
      const obj = this.view.aim(
        this.view.dynamic.filter((o) => o.type === 'loot'),
        5,
      );
      if (obj) {
        obj.locked = m;
        this.toast('Container locked.');
      }
    } else if (/Detect|Telekinesis/.test(e)) {
      buff('Detect', m, Math.max(10, d));
      this.toast(
        this.view.dynamic
          .filter((o) => o.type === 'loot')
          .map((o) => o.name)
          .slice(0, 3)
          .join(' · ') || 'Nothing nearby answers the spell.',
      );
    } else if (e === 'Fortify Attribute' || e === 'Restore Attribute') {
      const names = M.ATTRIBUTES.filter((n) => (sp.parameter || sp.sourceLabel || sp.name).includes(n));
      if (!names.length) names.push('Strength');
      for (const n of names) {
        if (e === 'Restore Attribute') {
          s.attributeDamage ??= {};
          s.attributeDamage[n] = Math.max(0, (s.attributeDamage[n] || 0) - m);
        } else buff('Fortify:' + n, m, d);
      }
      this.toast(names.join(', ') + ' ' + (e === 'Restore Attribute' ? 'restored.' : 'fortified.'));
    } else if (/^Fortify (Health|Magicka|Fatigue)$/.test(e)) {
      buff(e, m, d);
      if (e === 'Fortify Health') s.hp = Math.min(M.maxHealth(s), s.hp + m);
      if (e === 'Fortify Magicka') s.mp = Math.min(M.maxMagicka(s), s.mp + m);
      if (e === 'Fortify Fatigue') s.fp = Math.min(M.maxFatigue(s), s.fp + m);
    } else if (e === 'Dispel') {
      for (const ally of [...this.view.actors])
        if (ally.type === 'ally' && !ally.commanded) {
          this.physics.removeActor(ally);
          this.view.removeObject(ally);
        }
      s.buffs = {};
      s.hp = Math.min(s.hp, s.maxHp);
      this.updateHeld();
      this.toast('Temporary enchantments are dispelled.');
    } else if (e === 'Charm') {
      const person = this.view.aim(
        this.view.actors.filter((a) => a.type === 'npc'),
        30,
      );
      if (person) {
        s.dispositions[person.name] = clamp(this.disposition(person.name) + m, 0, 100);
        this.toast(person.name + ' warms to you.');
      } else this.toast('No person in reach.');
    } else if (!target) {
      this.toast('The spell finds no target.');
    } else if (/Calm|Paralyze|Demoralize|Turn Undead/.test(e)) {
      target.buffs.Disabled = { remaining: d, magnitude: m };
      this.toast(target.name + ' is held at bay.');
      this.view.particle(target.mesh.position.x, 1.5, target.mesh.position.z, 0x9ec8bd, 12);
    } else if (/Soultrap|Soul Trap/.test(e)) {
      target.buffs.Soultrap = { remaining: d, magnitude: m };
      this.toast('Soul Trap · ' + target.name);
    } else if (/Weakness/.test(e)) {
      target.buffs.Weakness = { remaining: d, magnitude: m };
      this.toast('Resistance weakened.');
    } else if (/Command/.test(e)) {
      target.type = 'ally';
      target.summonDuration = d;
      target.commanded = true;
      this.toast(target.name + ' fights at your side for ' + d + ' seconds.');
    } else if (e === 'Silence' || e === 'Sound') {
      target.buffs.Silence = { remaining: d, magnitude: m };
      this.toast('Spellcasting disrupted.');
    } else if (e === 'Blind') {
      target.buffs.Blind = { remaining: d, magnitude: m };
      this.toast('The enemy struggles to see.');
    } else if (/Damage Fatigue|Drain Fatigue|Absorb Fatigue/.test(e)) {
      target.fatigue = Math.max(0, (target.fatigue ?? 80) - m);
      if (target.fatigue <= 0) target.buffs.Disabled = { remaining: Math.max(3, d), magnitude: m };
      if (e === 'Absorb Fatigue') s.fp = Math.min(M.maxFatigue(s), s.fp + m);
      this.toast('The target loses ' + m + ' Fatigue.');
    } else if (/Damage Magicka|Drain Magicka/.test(e)) {
      target.magicka = Math.max(0, (target.magicka ?? 80) - m);
      if (target.magicka <= 0) target.buffs.Silence = { remaining: Math.max(15, d), magnitude: m };
      this.toast('Magicka diminished.');
    } else if (/Disintegrate Weapon/.test(e)) {
      target.damage = Math.max(1, target.damage - m * 0.2);
      this.toast('The enemy’s weapon is damaged.');
    } else if (/Disintegrate Armor/.test(e)) {
      target.buffs.Weakness = { remaining: 90, magnitude: m };
      this.toast('The enemy’s armor is damaged.');
    } else if (/Burden|Drain Attribute|Damage Attribute|Drain Skill|Absorb Attribute/.test(e)) {
      target.buffs.Slow = { remaining: Math.max(8, d), magnitude: m };
      if (e === 'Absorb Attribute') {
        const name = M.ATTRIBUTES.find((n) => (sp.sourceLabel || sp.name).includes(n)) || 'Strength';
        buff('Fortify:' + name, m, d);
      }
      this.toast('The target’s capabilities are diminished.');
    } else if (/Frenzy|Rally/.test(e)) {
      target.alerted = true;
      target.speed *= 1.1;
      this.toast(target.name + ' turns toward you.');
    } else {
      const element = /Fire/.test(e) ? 'Fire' : /Frost/.test(e) ? 'Frost' : /Shock/.test(e) ? 'Shock' : 'Magicka';
      let damage = m * Math.min(3, Math.max(1, d * 0.5));
      if (/Absorb Health/.test(e)) s.hp = Math.min(M.maxHealth(s), s.hp + damage);
      if (/Absorb Fatigue/.test(e)) s.fp = Math.min(M.maxFatigue(s), s.fp + damage);
      if (/Poison/.test(e)) target.buffs.Poison = { remaining: d, magnitude: Math.min(8, m * 0.25) };
      this.hit(target, damage, element);
    }
  }
  summonAlly(name, duration) {
    for (const a of [...this.view.actors])
      if (a.type === 'ally' && !a.commanded) {
        this.physics.removeActor(a);
        this.view.removeObject(a);
      }
    const p = this.physics.current;
    if (this.physics.count() >= this.physics.limit - 1)
      return this.toast('Too many active bodies; let the previous summon or debris disperse.');
    const ally = this.view.addActor({
      id: 'summon:' + name,
      type: 'ally',
      name: name + ' · summoned',
      x: p.x + 1.7,
      y: Math.max(0, p.y - 0.9),
      z: p.z - 1.7,
      hp: 100,
      maxHp: 100,
      buffs: {},
      damage: /Saint|Twilight|Daedroth|Storm/.test(name) ? 18 : 9,
      speed: 3.8,
      summonDuration: duration,
      timer: 0,
    });
    this.physics.addActor(ally);
    this.toast(name + ' answers your call.');
  }
  updateAllies(dt) {
    for (const a of [...this.view.actors]) {
      if (a.type !== 'ally') continue;
      a.summonDuration -= dt;
      if (a.summonDuration <= 0) {
        if (a.commanded) {
          a.type = 'enemy';
          a.commanded = false;
          a.alerted = false;
        } else {
          this.physics.removeActor(a);
          this.view.removeObject(a);
        }
        continue;
      }
      const enemy = this.view.actors
        .filter((x) => x.type === 'enemy' && !x.dead && !x.docile && x.alerted)
        .sort((x, y) => distance(x.mesh.position, a.mesh.position) - distance(y.mesh.position, a.mesh.position))[0];
      const target = enemy?.mesh.position || this.physics.current;
      const dx = target.x - a.mesh.position.x,
        dz = target.z - a.mesh.position.z,
        dist = Math.hypot(dx, dz);
      a.mesh.rotation.y = Math.atan2(dx, dz);
      a.moving = dist > (enemy ? 2.2 : 2.5);
      if (a.moving)
        this.physics.moveActor(a, a.mesh.position.x + (dx / dist) * a.speed * dt, a.mesh.position.z + (dz / dist) * a.speed * dt);
      else if (enemy) {
        a.timer -= dt;
        if (a.timer <= 0) {
          this.hit(enemy, a.damage, 'Magicka');
          a.timer = 1.8;
        }
      }
    }
  }
  power() {
    const s = this.state;
    if (!s || s.powerUsed) return this.toast('This power returns after resting.');
    const sign = s.sign;
    let used = true;
    if (sign === 'The Ritual') {
      s.hp = s.maxHp;
      this.audio.play('heal');
    } else if (sign === 'The Shadow') {
      s.buffs.Invisibility = { remaining: 60, magnitude: 100 };
    } else if (sign === 'The Lover') {
      const t = this.view.aim(
        this.view.actors.filter((a) => a.type === 'enemy'),
        25,
      );
      if (t) {
        t.buffs.Disabled = { remaining: 30, magnitude: 100 };
        s.fp = Math.max(0, s.fp - 200);
      } else used = false;
    } else if (sign === 'The Lord') {
      s.hp = Math.min(M.maxHealth(s), s.hp + 45);
    } else if (sign === 'The Serpent') {
      const t = this.view.aim(
        this.view.actors.filter((a) => a.type === 'enemy'),
        4,
      );
      if (t) {
        this.hit(t, 60, 'Poison');
        this.hurt(15, 'Magicka');
      } else used = false;
    } else if (sign === 'The Tower') {
      const o = this.view.aim(
        this.view.dynamic.filter((o) => o.locked && o.locked <= 50),
        5,
      );
      if (o) {
        o.locked = 0;
        this.toast('Tower Key opens the lock.');
      } else used = false;
    } else {
      used = false;
      this.toast('This birthsign grants passive abilities, not an activated power.');
    }
    if (used) {
      s.powerUsed = true;
      this.toast('The power of ' + sign + ' answers.');
    }
  }
  lever(key) {
    const q = activeStep(this.state);
    if (q?.type !== 'puzzle') return;
    const s = this.state;
    if (q.pattern[s.puzzle] !== key) {
      s.puzzle = 0;
      this.audio.play('miss', 0.5);
      this.toast('The mechanism resets.');
      this.ui.puzzle(this.ui.context);
      return;
    }
    s.puzzle++;
    this.audio.play('lock', 0.8);
    if (s.puzzle >= q.pattern.length) {
      this.advance({ type: 'puzzle', target: q.target, area: s.area });
      this.ui.resume();
    } else this.ui.puzzle(this.ui.context);
  }
  applyAspect(actor, aspect) {
    actor.docile = false;
    if (aspect === 'Strength') {
      actor.damage = 31;
      actor.speed = 2;
    } else if (aspect === 'Speed') {
      actor.damage = 16;
      actor.speed = 4.3;
    } else {
      actor.damage = 17;
      actor.speed = 2.5;
      actor.element = 'Shock';
    }
  }
  chooseAspect(aspect, actor) {
    this.state.aspect = aspect;
    this.state.flags.aspectChosen = true;
    this.applyAspect(actor, aspect);
    this.toast('The Hunter takes the aspect of ' + aspect + '.', true);
    this.ui.resume();
  }
  updateAI(dt) {
    const s = this.state,
      p = this.physics.current;
    for (const a of [...this.view.actors]) {
      if (a.type !== 'enemy' || a.dead || a.docile) continue;
      for (const [key, b] of Object.entries(a.buffs)) {
        b.remaining -= dt;
        if (key === 'Poison') a.hp -= b.magnitude * dt;
        if (b.remaining <= 0) delete a.buffs[key];
      }
      if (a.hp <= 0) {
        this.kill(a);
        continue;
      }
      if (a.buffs.Disabled) {
        a.moving = false;
        continue;
      }
      const dist = distance(a.mesh.position, p);
      const hidden = s.buffs.Invisibility || (s.buffs.Chameleon && s.buffs.Chameleon.magnitude > 50);
      const detect = this.sneaking ? Math.max(2.1, 7 - (s.skills.Sneak || 0) * 0.045) : 10;
      if (dist < detect && !hidden) a.alerted = true;
      if (dist > 21 || hidden) a.alerted = false;
      if (!a.alerted) {
        a.moving = false;
        continue;
      }
      const dx = p.x - a.mesh.position.x,
        dz = p.z - a.mesh.position.z;
      a.mesh.rotation.y = Math.atan2(dx, dz);
      const casting = !!a.element && !a.buffs.Silence;
      const attackRange = casting ? 9 : 2.5;
      a.timer -= dt;
      if (dist > attackRange) {
        a.moving = true;
        const speed = a.speed * (a.buffs.Slow ? 0.4 : 1);
        this.physics.moveActor(a, a.mesh.position.x + (dx / dist) * speed * dt, a.mesh.position.z + (dz / dist) * speed * dt);
        a.winding = false;
      } else {
        a.moving = false;
        a.winding = a.timer < 0.65;
        a.mesh.rotation.x = a.winding ? -0.1 : 0;
        if (a.timer <= 0) {
          if (Math.abs(p.y - a.mesh.position.y) < (a.element ? 8 : 2.7)) {
            const dodge = (s.buffs.Sanctuary?.magnitude || 0) / 100 + (s.sign === 'The Thief' ? 0.1 : 0);
            if (Math.random() > dodge + (a.buffs.Blind?.magnitude || 0) / 100) {
              const from = a.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
                to = new THREE.Vector3(p.x, p.y + 0.3, p.z);
              this.view.ray.set(from, to.clone().sub(from).normalize());
              this.view.ray.far = from.distanceTo(to) - 0.3;
              const occluded = this.view.staticMesh && this.view.ray.intersectObject(this.view.staticMesh, false).length;
              if (!occluded) {
                if (casting && Math.random() < (s.buffs.Reflect?.magnitude || 0) / 100) {
                  this.hit(a, a.damage, a.element);
                  this.toast('Spell reflected.');
                } else this.hurt(a.damage, casting ? a.element : null);
              }
            } else this.toast('You evade the attack.');
          }
          a.timer = a.boss ? 1.7 : 2;
          a.winding = false;
        }
      }
      if (a.hitTime > 0) {
        a.hitTime -= dt;
        a.mesh.rotation.z = Math.sin(a.hitTime * 30) * 0.13;
      }
    }
  }
  fixed(dt) {
    const s = this.state;
    if (!s || this.modal) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.castCooldown = Math.max(0, this.castCooldown - dt);
    s.seconds += dt;
    this.autosaveTime += dt;
    if (s.hp <= 0) {
      this.ui.death();
      return;
    }
    this.physics.beginStep();
    const move = this.controls.movement();
    this.sneaking = move.sneak;
    const enc = M.weight(s, this.catalogue) / Math.max(1, M.capacity(s));
    let speed = (3.1 + M.attribute(s, 'Speed') * 0.018 + (s.skills.Athletics || 0) * 0.012) * (1 - clamp(enc, 0, 1) * 0.3);
    if (enc > 1) speed = 0;
    if (move.sneak) speed *= 0.5;
    if (move.run && s.fp > 2) speed *= 1.6;
    if (M.itemInfo(s.equipment.boots || '', this.catalogue).speed) speed *= 2;
    let x = move.x * Math.cos(s.yaw) + move.z * Math.sin(s.yaw),
      z = move.z * Math.cos(s.yaw) - move.x * Math.sin(s.yaw);
    const moving = Math.hypot(x, z) > 0.1;
    this.moving = moving;
    const slowfall = !!s.buffs.Slowfall || Object.values(s.equipment).some((n) => M.itemInfo(n, this.catalogue).slowfall);
    const fly = !!s.buffs.Levitate;
    const swim = this.view.biome === 'coast' && this.physics.current.x < -26;
    let vertical = 0;
    if (fly) vertical = -move.z * Math.sin(s.pitch) * speed + (move.jump ? 3 : 0) - (move.sneak ? 3 : 0);
    if (swim) {
      speed *= 0.6 * (1 + (s.buffs['Swift Swim']?.magnitude || 0) / 100);
      vertical =
        clamp((-0.67 - this.physics.current.y) * 2, -2, 2) -
        move.z * Math.sin(s.pitch) * 2 +
        (move.jump ? 3 : 0) -
        (move.sneak ? 3 : 0);
      if (s.buffs['Water Walking']) vertical = (0.8 - this.physics.current.y) * 5;
    }
    this.updateAI(dt);
    if (this.modal) return;
    this.updateAllies(dt);
    const landed = this.physics.step({
      x: x * speed,
      z: z * speed,
      fly,
      swim,
      y: vertical,
      jump: move.jump,
      slowfall,
      jumpSpeed: 6 + (s.skills.Acrobatics || 0) * 0.015 + (s.buffs.Jump?.magnitude || 0) * 0.1,
    });
    if (landed > 4 && !slowfall && !s.buffs.Levitate && !swim) this.hurt((landed - 4) * 4);
    if (Math.abs(this.physics.current.x) > 40 || Math.abs(this.physics.current.z) > 40 || this.physics.current.y < -8)
      this.physics.teleport(this.view.spawn);
    document.body.classList.toggle(
      'blinded',
      !!M.itemInfo(s.equipment.boots || '', this.catalogue).blind && !s.buffs['Resist Magicka'],
    );
    const underwater = swim && this.physics.current.y + 0.62 < -0.2;
    document.body.classList.toggle('submerged', underwater);
    if (underwater && !s.buffs['Water Breathing'] && s.race !== 'Argonian') {
      this.oxygen = Math.max(0, this.oxygen - dt);
      if (this.oxygen <= 0) this.hurt(dt * 5);
    } else this.oxygen = Math.min(30, this.oxygen + dt * 8);
    s.hp = Math.min(s.hp, M.maxHealth(s));
    s.mp = Math.min(s.mp, M.maxMagicka(s));
    s.fp = clamp(s.fp + dt * (moving && move.run ? -14 : 9), 0, M.maxFatigue(s));
    if (moving) {
      this.footstepTime -= dt;
      if (this.footstepTime <= 0 && !fly && !swim) {
        this.audio.play('step', move.sneak ? 0.12 : 0.22, 0.9 + Math.random() * 0.2);
        this.footstepTime = move.run ? 0.31 : 0.46;
      }
      M.gainSkill(s, 'Athletics', dt * 0.6, this.catalogue);
      if (move.sneak) M.gainSkill(s, 'Sneak', dt * 0.9, this.catalogue);
    }
    if (move.jump && this.physics.grounded && !fly && !swim) {
      s.fp = Math.max(0, s.fp - 3);
      M.gainSkill(s, 'Acrobatics', 0.7, this.catalogue);
    }
    for (const [key, b] of Object.entries(s.buffs)) {
      b.remaining -= dt;
      if (key === 'Poison') s.hp = Math.max(1, s.hp - b.magnitude * dt);
      if (b.remaining <= 0) {
        delete s.buffs[key];
        if (key.startsWith('Bound')) this.updateHeld();
      }
    }
    for (const n of Object.values(s.equipment)) {
      if (s.enchantments[n]?.effect === 'Restore Fatigue') s.fp = Math.min(M.maxFatigue(s), s.fp + dt * 2);
    }
    for (const n in s.itemCharge) s.itemCharge[n] = Math.min(100, s.itemCharge[n] + dt * 1.5);
    s.hp = Math.min(s.hp, M.maxHealth(s));
    s.mp = Math.min(s.mp, M.maxMagicka(s));
    s.fp = Math.min(s.fp, M.maxFatigue(s));
    s.position = { ...this.physics.current };
    if (this.autosaveTime >= 45 && !this.inCombat() && this.state.hp > 0) this.save(false);
  }
  /** One frame from the kit loop: dt in seconds, already clamped to 0.1. */
  frame(dt) {
    if (!this.running) return;
    try {
      this.frameMs = this.frameMs * 0.94 + dt * 1000 * 0.06;
      this.frameNo++;
      this.controls.update(dt);
      if (this.state && !this.modal) {
        this.controls.applyLook(this.state, dt);
        this.accumulator += dt;
        const maxSteps = M.bodyLimits(this.view.preset).substeps;
        let steps = 0;
        while (this.accumulator >= this.physics.dt && steps < maxSteps && !this.modal) {
          this.fixed(this.physics.dt);
          this.accumulator -= this.physics.dt;
          steps++;
        }
        if (steps >= maxSteps) this.accumulator = Math.min(this.accumulator, this.physics.dt);
      } else this.accumulator = 0;
      if (this.pendingRefresh && this.state) {
        this.refreshWorld();
        this.pendingRefresh = false;
      }
      if (this.pendingEnding) {
        this.pendingEnding = false;
        this.ui.ending();
      }
      const pos = this.state ? this.physics.interpolate(this.modal ? 1 : clamp(this.accumulator / this.physics.dt, 0, 1)) : null;
      if (pos && this.state) {
        pos.yaw = this.state.yaw;
        pos.pitch = this.state.pitch;
        pos.eye = this.sneaking ? 0.37 : 0.65;
        pos.moving = this.options.motion && this.moving && !this.modal;
      }
      this.view.fill.intensity =
        (this.view.indoor ? 2.2 : 1.7) +
        (this.state?.buffs['Night-Eye'] || this.state?.buffs['Night Eye'] ? 2 : 0) +
        (this.state?.buffs.Light ? 1 : 0);
      this.view.animate(dt, pos);
      if (this.state) this.physics.render(this.modal ? 1 : clamp(this.accumulator / this.physics.dt, 0, 1));
      this.view.render();
      if (this.state && !this.modal) {
        this.target = this.view.aim(
          [...this.view.actors, ...this.view.dynamic],
          this.view.actors.some((a) => a.type === 'enemy' && a.alerted) ? 15 : 5,
        );
        this.controls.showUse(this.target);
        if (this.frameNo % 5 === 0) this.ui.updateHUD();
        if (this.frameNo % 180 === 0) this.audio.playMusic(this.inCombat() ? 'battle' : 'explore');
      }
      if (this.frameNo % 20 === 0 && this.options.diagnostics) {
        const diag = document.getElementById('diagnostics');
        const text = `${this.kit.backendLabel} · ${this.kit.tier.name} → ${this.view.preset} · ${this.frameMs.toFixed(1)} ms · ${this.state ? this.physics.count() : 0}/${this.physics.limit} bodies`;
        if (diag.textContent !== text) diag.textContent = text;
      }
    } catch (e) {
      this.fatal(e);
    }
  }
  applyOptions() {
    saveJSON('ashbound.options', this.options);
    this.audio?.update(this.options);
    document.getElementById('diagnostics').hidden = !this.options.diagnostics;
  }
  fullscreen() {
    try {
      const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
      p?.catch(() => this.toast('Fullscreen is unavailable in this browser context.'));
      if (!p && !document.fullscreenElement) this.toast('Fullscreen is unavailable; use your browser’s full-screen controls.');
    } catch {
      this.toast('Fullscreen is unavailable.');
    }
  }
  toast(text, important = false) {
    const box = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = 'toast' + (important ? ' important' : '');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild.remove();
    setTimeout(() => el.remove(), important ? 5500 : 3600);
  }
  float(actor, text, col) {
    const p = actor.mesh.position.clone();
    p.y += 1.9;
    p.project(this.view.camera);
    const el = document.createElement('span');
    el.className = 'combat-float';
    el.textContent = text;
    el.style.left = (p.x * 0.5 + 0.5) * innerWidth + 'px';
    el.style.top = (-p.y * 0.5 + 0.5) * innerHeight + 'px';
    el.style.color = '#' + col.toString(16);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  fatal(e) {
    console.error(e);
    this.running = false;
    this.modal = true;
    this.kit?.stop();
    document.exitPointerLock?.();
    const root = document.getElementById('ui');
    root.innerHTML = `<div class="modal-shade"><section class="window compact" role="dialog" aria-modal="true" aria-label="Startup failed"><div class="window-header"><h2>The world could not be drawn</h2></div><div class="window-body"><p>${H(e.message || e)}</p><p>This game needs WebGPU or WebGL2. Check browser graphics acceleration, then try again. Your saved journey has not been deleted.</p><div class="stack"><button id="retry-gl" class="primary">Retry with WebGL2</button><button id="retry-reload">Reload this game</button><button id="rescue-save">Export saved journey</button></div><p><small>Retrying with WebGL2 remembers that choice; change it later under Options → Graphics &amp; controls.</small></p></div></section></div>`;
    root.querySelector('#retry-gl').onclick = () => {
      if (this.kit) {
        this.kit.settings.set({ backend: 'webgl2' });
        location.reload();
        return;
      }
      const u = new URL(location.href);
      u.searchParams.set('kit-backend', 'webgl2');
      location.replace(u.href);
    };
    root.querySelector('#retry-reload').onclick = () => location.reload();
    root.querySelector('#rescue-save').onclick = () => this.exportSave();
    root.querySelector('#rescue-save').disabled = !this.state && !this.readSave();
    root.querySelector('#retry-gl').focus();
  }
}
if (typeof document !== 'undefined' && !globalThis.__ASHBOUND_TEST__) {
  const game = new Game();
  game.init().catch((e) => game.fatal(e));
}
