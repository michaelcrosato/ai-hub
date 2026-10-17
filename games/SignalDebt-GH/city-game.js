// Original driving caper. WASD/stick move; Shift/R1 sprint; Space/✕ dodge/handbrake;
// F/△ interact/enter/exit; J/mouse/R2 fire; R/□ reload; V/L1 scan; M map; Esc pause.
import {
  THREE,
  PALETTE,
  toonMaterial,
  setLookLayer,
  LOOK_PRESETS,
  HERO_MODEL,
} from "./pixel-engine.js";
import { buildWorld } from "./world.js";
import { createActor, createPedestrian } from "./actors.js";
import { CityAudio } from "./audio.js";
import { GameUI } from "./ui.js";
import { Ride, TrafficCar } from "./vehicles.js";
import { Story, MISSIONS } from "./missions.js";
import {
  clamp,
  distance,
  visible,
  angleDelta,
  point,
  recoverySpot,
} from "./navigation.js";
import { equipment, SIGNAL_CASE, RELAY } from "./equipment.js";
import {
  readSave as loadCheckpoint,
  writeSave,
  validateSave,
  SAVE_KEY,
} from "./persistence.js";
const { Vector3, Mesh, TorusGeometry, CylinderGeometry, BoxGeometry, Group } =
  THREE;
const START = [-18, 0.2, 18];
const CACHE_SPOTS = [
  [-92, -124],
  [-125, 95],
  [125, 125],
  [230, -14],
  [-230, 12],
  [14, -230],
];

export class SignalDebt {
  name = "Signal Debt";
  assets = [HERO_MODEL];
  targetVector = new Vector3();
  feet = new Vector3();
  move = new Vector3();
  aimOrigin = new Vector3();
  health = 100;
  ammo = 12;
  reserve = 192;
  cash = 0;
  heat = 0;
  heatState = "clear";
  playTime = 0;
  shotCooldown = 0;
  reloadTime = 0;
  scan = 0;
  scanCooldown = 0;
  damageCooldown = 0;
  sinceDamage = 0;
  rides = [];
  traffic = [];
  police = [];
  enemies = [];
  pedestrians = [];
  pendingSpawns = 0;
  cacheTaken = [];
  dialogueQueue = [];
  tracers = [];
  started = false;
  ready = false;
  ride = null;
  contextPrompt = null;
  lastCheckpoint = null;
  signalHealth = 100;
  triggerValues = { left: 0, right: 0 };
  async setup(ctx) {
    this.ctx = ctx;
    this.rng = ctx.random.fork("city-events");
    this.world = await buildWorld(ctx);
    this.audio = new CityAudio(ctx);
    this.player = await createActor(ctx, { at: START });
    this.story = new Story(this);
    this.ui = new GameUI(ctx, {
      onAction: (a, v) => this.action(a, v),
      prepareAction: (a, v) =>
        a === "continue" ? { checkpoint: this.availableCheckpoint() } : v,
    });
    ctx.input.gamepadButtons = {
      0: "Space",
      1: "Escape",
      2: "KeyR",
      3: "KeyF",
      4: "KeyV",
      5: "ShiftLeft",
      6: "KeyC",
      7: "KeyJ",
      8: "KeyM",
      9: "Escape",
      12: "ArrowUp",
      13: "ArrowDown",
      14: "ArrowLeft",
      15: "ArrowRight",
    };
    ctx.input.preventKeys.add("Tab");
    ctx.input.gamepadLookSpeed = 100;
    for (const spec of [
      {
        id: "loaner",
        at: [-9, 1.2, 0],
        yaw: Math.PI / 2,
        color: "teal",
        label: "Bo’s loaner",
      },
      {
        id: "cormorant",
        at: [-183, 1.2, -192],
        yaw: 0,
        color: "orange",
        label: "Serrin Cormorant",
      },
      {
        id: "freighter",
        at: [145, 1.4, 157],
        yaw: Math.PI / 2,
        color: "white",
        kind: "van",
        label: "Porter panel van",
      },
      {
        id: "marina",
        at: [229, 1.2, 108],
        yaw: Math.PI,
        color: "red",
        label: "Morrow coupe",
      },
      {
        id: "market",
        at: [-108, 1.2, 86],
        yaw: 0,
        color: "sand",
        label: "Sable coupe",
      },
    ]) {
      const r = new Ride(ctx, spec);
      r.onCrash = (n) => this.crash(r, n);
      this.rides.push(r);
    }
    for (let i = 0; i < 10; i++) {
      const a = i % 2 ? 108 : 216,
        route = [
          point(-a + 4, -a + 4),
          point(a - 4, -a + 4),
          point(a - 4, a - 4),
          point(-a + 4, a - 4),
        ],
        s = route[i % 4];
      const c = new TrafficCar(ctx, {
        at: [s.x + ((i % 3) - 1) * 9, 1, s.z],
        route,
        color: ["sand", "slate", "teal", "red", "white"][i % 5],
        speed: 7 + i * 0.5,
      });
      c.index = ((i % 4) + 1) % 4;
      this.traffic.push(c);
    }
    const starts = [
      [-18, 15],
      [-80, 95],
      [-90, 90],
      [229, 126],
      [235, 132],
      [144, -70],
      [154, -80],
      [-190, 145],
      [138, 150],
      [-120, -122],
      [10, 30],
      [120, 20],
    ];
    for (let i = 0; i < starts.length; i++) {
      const [x, z] = starts[i],
        actor = await createPedestrian(ctx, {
          at: [x, 0.2, z],
          color: ["teal", "sand", "red", "plum"][i % 4],
        });
      this.pedestrians.push({
        actor,
        home: point(x, z),
        target: point(x + 5, z + 6),
        wait: i * 0.7,
        stationary: i < 2,
      });
    }
    this.marker = new Group();
    const ring = new Mesh(
        new TorusGeometry(3, 0.12, 4, 32).rotateX(Math.PI / 2),
        toonMaterial(PALETTE.orange),
      ),
      beacon = new Mesh(
        new THREE.OctahedronGeometry(0.55),
        toonMaterial(PALETTE.orange),
      );
    beacon.position.y = 4;
    this.marker.add(ring, beacon);
    ctx.scene.add(this.marker);
    setLookLayer(this.marker, "actors");
    this.defenseRing = new Mesh(
      new TorusGeometry(23, 0.12, 4, 64).rotateX(Math.PI / 2),
      toonMaterial(PALETTE.cyan),
    );
    this.defenseRing.visible = false;
    ctx.scene.add(this.defenseRing);
    setLookLayer(this.defenseRing, "actors");
    this.targetReticle = new Mesh(
      new TorusGeometry(0.65, 0.08, 4, 20).rotateX(Math.PI / 2),
      toonMaterial(PALETTE.red),
    );
    ctx.scene.add(this.targetReticle);
    this.caches = CACHE_SPOTS.map(([x, z], id) => {
      const mesh = equipment(SIGNAL_CASE);
      mesh.position.set(x, 0.03, z);
      ctx.scene.add(mesh);
      return { id, mesh, at: point(x, z), taken: false };
    });
    this.relays = [];
    for (const [x, z, y] of [
      [-185, 145, 0],
      [-80, 90, 0],
      [235, 120, 0],
      [145, 145, 0],
      [145, -80, 0],
      [195, -192, 8.2],
    ]) {
      const m = equipment(RELAY);
      m.position.set(x + 2.7, y, z + 1);
      ctx.scene.add(m);
      ctx.physics.addStaticBox({
        position: [x + 2.7, y + 1.1, z + 1],
        halfExtents: [0.7, 1.1, 0.5],
      });
      this.relays.push(m);
    }
    const keyCase = equipment(SIGNAL_CASE);
    keyCase.position.set(-186, 0.08, -181);
    ctx.scene.add(keyCase);
    this.ui.show("title", { canContinue: !!this.availableCheckpoint() });
    if (ctx.camera.preset === "third") {
      ctx.camera.yaw = Math.PI;
      ctx.camera.pitch = 0.78;
    }
    this.ready = true;
    document.getElementById("boot")?.remove();
  }
  get position() {
    return this.ride ? this.ride.position : this.player.position(this.feet);
  }
  action(a, v) {
    if (a === "new") {
      this.resetProgress();
      this.story.brief(0);
    } else if (a === "replay") {
      const backup = this.availableCheckpoint();
      this.resetProgress(true);
      this.replayBackup = backup;
      this.replaying = !!backup;
      this.story.approach = backup?.story.approach ?? "jam";
      this.story.brief(typeof v === "number" ? v : 0);
    } else if (a === "continue") {
      const d = v?.checkpoint
        ? validateSave(v.checkpoint)
        : this.availableCheckpoint();
      if (d) {
        this.replaying = false;
        this.replayBackup = null;
        this.restoreCheckpoint(d);
        this.ui.hide();
        this.started = true;
      } else this.toast("No saved checkpoint yet.");
    } else if (a === "begin") {
      this.started = true;
      this.story.begin();
    } else if (a === "approach") {
      this.story.approach = v ?? "jam";
    } else if (a === "next") {
      if (this.replaying && this.replayBackup) {
        this.returnFromReplay();
      } else {
        this.story.mission++;
        this.story.stage = 0;
        this.story.brief();
      }
    } else if (a === "resume") {
      if (this.replaying && !this.story.active && this.replayBackup)
        this.returnFromReplay();
      else this.ui.hide();
    } else if (a === "retry") {
      this.restoreCheckpoint(this.lastCheckpoint ?? this.readSave());
      this.ui.hide();
    } else if (a === "quit")
      this.ui.show("title", { canContinue: !!this.availableCheckpoint() });
    else if (["pause", "map", "help", "options"].includes(a)) this.ui.show(a);
    else if (a === "repair") {
      if (distance(this.position, point(-18, 15)) > 36)
        this.toast("Repairs are available at Bo’s garage.");
      else if (this.cash < 150) this.toast("Repair costs $150.");
      else {
        this.cash -= 150;
        this.health = 100;
        this.ammo = 12;
        this.reserve = 192;
        for (const r of this.rides)
          if (distance(r.position, this.position) < 40) r.repair();
        this.audio.event("repair");
        this.toast("Vehicle repaired · supplies replenished");
        this.checkpoint();
      }
    } else if (a === "upgrade") {
      if (distance(this.position, point(-18, 15)) > 36)
        this.toast("Bring the Cormorant to Bo’s garage.");
      else if (this.rides[1].upgraded)
        this.toast("Performance package already fitted.");
      else if (this.cash < 600) this.toast("Performance package costs $600.");
      else {
        this.cash -= 600;
        this.rides[1].upgrade();
        this.audio.event("repair");
        this.toast("Cormorant upgraded · power and top speed increased");
        this.checkpoint();
      }
    } else if (a === "courier") {
      if (this.story.active) this.toast("Finish the current story job first.");
      else {
        this.courierChallenge = {
          index: 0,
          time: 180,
          route: [
            point(-80, 90),
            point(235, 120),
            point(-185, 145),
            point(-9, 0),
          ],
        };
        this.ui.hide();
        this.toast("COURIER RUN · four deliveries · 3 minutes · $450", 6);
      }
    }
    this.ctx.engine.timeScale = this.ui.screen ? 0 : 1;
  }
  returnFromReplay() {
    const data = this.replayBackup;
    this.replaying = false;
    this.replayBackup = null;
    this.restoreCheckpoint(data);
    this.ui.hide();
    this.toast("Back in your story · campaign checkpoint preserved");
  }
  resetProgress(preserveSave = false) {
    this.exitCar(true);
    this.player.teleport(START);
    this.started = false;
    this.health = 100;
    this.ammo = 12;
    this.reserve = 192;
    this.cash = 0;
    this.playTime = 0;
    this.cacheTaken = [];
    this.story = new Story(this);
    this.placeCrew(0, 0);
    this.clearEnemies();
    this.clearHeat();
    this.dialogueQueue = [];
    this.reloadTime = 0;
    this.courierChallenge = null;
    this.courier?.dispose();
    this.courier = null;
    this.courierStopped = false;
    this.interceptPosition = null;
    if (this.scan > 0) this.ctx.engine.setLook(this.lookBeforeScan);
    this.scan = 0;
    this.scanCooldown = 0;
    this.replaying = false;
    this.replayBackup = null;
    for (const r of this.rides) {
      r.reset(r.spawn, r.spawnYaw);
      r.integrity = 100;
      r.setUpgraded(false);
    }
    for (const c of this.caches) {
      c.taken = false;
      c.mesh.visible = true;
    }
    this.lastCheckpoint = null;
    if (!preserveSave && !this.ctx.input.playing)
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
  }
  say(speaker, text) {
    this.dialogueQueue.push({
      speaker,
      text,
      remaining: Math.max(6, text.length / 12),
    });
  }
  placeCrew(mission, stage) {
    const bo = this.pedestrians[0];
    if (!bo) return;
    const at =
      mission === 2 && stage >= 4 && stage <= 7
        ? [140, 0.2, 146]
        : mission === 3 && stage >= 8
          ? [238, 0.2, 220]
          : [-18, 0.2, 15];
    bo.home = point(at[0], at[2]);
    bo.target = { ...bo.home };
    bo.actor.teleport(at);
    bo.actor.face(mission === 2 ? Math.PI / 2 : 0);
  }
  toast(text, seconds = 4) {
    this.toastMessage = text;
    this.toastTime = seconds;
  }
  currentToast() {
    if (typeof this.toastMessage === "string") return this.toastMessage;
    if (this.toastMessage?.type === "vehicle") {
      const controls =
        this.ui.mode === "gamepad"
          ? "R2 accelerate · L2 brake / reverse"
          : this.ui.mode === "touch"
            ? "GAS accelerate · BRAKE / reverse"
            : "W accelerate · S brake / reverse";
      return `${this.toastMessage.label} · ${controls}`;
    }
    if (this.toastMessage?.type === "recovery")
      return `Engine disabled · hold ${this.ui.mode === "touch" ? "RECOVER" : this.ui.key("KeyR")} to recover`;
    return "";
  }
  crash(r, n) {
    this.audio.event("crash");
    if (r === this.ride) {
      if (this.ui.preferences.motion !== false) this.ctx.engine.shake.add(0.25);
      this.ui.rumble(0.4, 150);
      this.damage(Math.max(0, n - 12) * 0.6);
    }
    if (
      this.started &&
      (this.story.mission > 0 || !this.story.active) &&
      n > 10
    )
      this.addHeat(0.4);
  }
  enterCar(r) {
    if (this.ride || Math.abs(r.speed) > 4) return;
    this.ride = r;
    r.occupied = true;
    this.player.hero.body.setEnabled(false);
    this.player.model.visible = false;
    this.player.shadow.visible = false;
    this.audio.event("enter");
    this.toast({ type: "vehicle", label: r.label }, 5);
  }
  exitCar(force = false) {
    if (!this.ride) return;
    if (!force && Math.abs(this.ride.speed) > 5) {
      this.toast("Slow down before getting out.");
      return;
    }
    const r = this.ride,
      p = r.position;
    let exit = point(p.x + Math.cos(r.yaw) * 2.5, p.z - Math.sin(r.yaw) * 2.5);
    if (
      this.world.buildings.some(
        (b) =>
          Math.abs(exit.x - b.x) < b.w / 2 + 1 &&
          Math.abs(exit.z - b.z) < b.d / 2 + 1,
      )
    )
      exit = point(p.x - Math.cos(r.yaw) * 2.5, p.z + Math.sin(r.yaw) * 2.5);
    this.ride = null;
    r.occupied = false;
    this.player.hero.body.setEnabled(true);
    this.player.teleport([exit.x, 0.3, exit.z]);
    this.player.model.visible = true;
    this.audio.event("exit");
  }
  recoverCar() {
    const r = this.ride;
    if (!r) return;
    const traffic = [
      ...this.rides.filter((other) => other !== r),
      ...this.traffic,
      ...this.police,
      ...(this.courier ? [this.courier] : []),
    ];
    const spot = recoverySpot(
      r.position,
      r.yaw,
      this.world.roads,
      this.world.buildings,
      traffic.map((car) => car.position),
    );
    if (!spot) {
      this.toast("The road is blocked. Try recovery again in a moment.");
      return;
    }
    r.reset([spot.x, 1.3, spot.z], spot.yaw);
    r.integrity = Math.max(30, r.integrity);
    this.toast("Back on the road.");
  }
  async spawnEnemies(center, count) {
    const generation = this.enemyGeneration ?? 0;
    this.pendingSpawns += count;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.6,
        roof = (center.y ?? 0) > 5;
      let p = point(
        center.x + Math.cos(angle) * (roof ? 5 : 12),
        (roof ? -194 : center.z) + Math.sin(angle) * (roof ? 3 : 12),
        center.y ?? 0,
      );
      if (
        !roof &&
        this.world.buildings.some(
          (b) =>
            Math.abs(p.x - b.x) < b.w / 2 + 1 &&
            Math.abs(p.z - b.z) < b.d / 2 + 1,
        )
      )
        p = point(center.x + (i - 2) * 2, center.z + 8, center.y ?? 0);
      const actor = await createActor(this.ctx, {
        at: [p.x, p.y + 0.2, p.z],
        role: "enemy",
        color: "navy",
      });
      if ((this.enemyGeneration ?? 0) !== generation) {
        actor.dispose();
        this.pendingSpawns--;
        continue;
      }
      const indicator = new Mesh(
        new TorusGeometry(0.7, 0.08, 4, 16).rotateX(Math.PI / 2),
        toonMaterial(PALETTE.red),
      );
      this.ctx.scene.add(indicator);
      this.enemies.push({
        actor,
        health: 3,
        attack: 1.5 + i * 0.4,
        telegraph: 0,
        indicator,
        home: p,
      });
      this.pendingSpawns--;
    }
  }
  clearEnemies() {
    this.enemyGeneration = (this.enemyGeneration ?? 0) + 1;
    this.aimTarget = null;
    if (this.targetReticle) this.targetReticle.visible = false;
    for (const e of this.enemies) {
      e.actor.dispose();
      e.indicator.removeFromParent();
    }
    this.enemies = [];
  }
  damage(n) {
    if (this.damageCooldown > 0 || this.player.dodging || n <= 0) return;
    this.health = Math.max(0, this.health - n);
    this.sinceDamage = 0;
    this.damageCooldown = 0.28;
    this.audio.event("hit");
    this.ui.rumble(0.25, 110);
    if (this.ui.preferences.motion !== false)
      this.ctx.engine.screen.flash("red", { duration: 0.12 });
    if (this.health <= 0) this.fail("The crew lost your signal.");
  }
  fail(reason) {
    this.audio.event("fail");
    this.ui.show("failure", {
      title: "Signal lost",
      body: reason,
      subtitle: "RETRY FROM THE LAST CHECKPOINT",
    });
  }
  reload() {
    if (this.reloadTime || this.ammo >= 12 || !this.reserve) return;
    this.reloadTime = 1.15;
    this.audio.event("reload");
  }
  shoot() {
    if (this.ride || this.shotCooldown > 0 || this.reloadTime > 0) return;
    if (!this.ammo) {
      this.audio.event("empty");
      this.shotCooldown = 0.35;
      this.reload();
      return;
    }
    this.ammo--;
    this.shotCooldown = 0.24;
    this.audio.event("shoot");
    this.ui.rumble(0.13, 60);
    const p = this.position,
      t = this.aimTarget,
      end = t
        ? t.actor.position(new Vector3())
        : new Vector3(
            p.x + Math.sin(this.player.hero.facing) * 25,
            p.y + 1,
            p.z + Math.cos(this.player.hero.facing) * 25,
          );
    this.drawTracer(p, end, "sand");
    if (
      t &&
      distance(p, end) < 42 &&
      visible({ ...p, y: p.y + 1 }, end, this.world.buildings)
    ) {
      t.health--;
      this.ctx.particles.burst("impact", { x: end.x, y: end.y + 1, z: end.z });
      if (t.health <= 0) {
        t.actor.hero.body.setEnabled(false);
        t.actor.model.visible = false;
        t.actor.shadow.visible = false;
        t.indicator.visible = false;
        this.cash += 25;
      }
    }
    if (this.story.mission > 0 || !this.story.active) this.addHeat(0.08);
  }
  drawTracer(a, b, color = "sand") {
    const from = new Vector3(a.x, a.y + 1, a.z),
      to = new Vector3(b.x, b.y + 1, b.z),
      diff = to.clone().sub(from),
      mesh = new Mesh(
        new CylinderGeometry(0.035, 0.035, diff.length(), 4),
        toonMaterial(PALETTE[color]),
      );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), diff.normalize());
    this.ctx.scene.add(mesh);
    this.tracers.push({ mesh, time: 0.09 });
  }
  tickEnemies(dt) {
    const p = this.position;
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      const ep = e.actor.position(this.aimOrigin),
        d = distance(ep, p),
        sees = visible(
          { ...ep, y: ep.y + 1 },
          { ...p, y: p.y + 1 },
          this.world.buildings,
        );
      let x = 0,
        z = 0;
      if (d > 13 && d < 65 && sees) {
        x = (p.x - ep.x) / d;
        z = (p.z - ep.z) / d;
      }
      const stage = this.story.active ? this.story.current : null;
      const canHitUplink =
        stage?.type === "defend" &&
        this.story.stageArrived &&
        distance(ep, stage.at) < 32 &&
        visible(
          { ...ep, y: ep.y + 1 },
          { ...stage.at, y: (stage.at.y ?? 0) + 1 },
          this.world.buildings,
        );
      const canEngage = (sees && d < 34) || canHitUplink;
      e.actor.setAiming(canEngage);
      e.actor.face(Math.atan2(p.x - ep.x, p.z - ep.z));
      e.actor.move(dt, { x: x * 0.55, z: z * 0.55 });
      e.attack = canEngage ? e.attack - dt : Math.max(e.attack, 1.2);
      e.telegraph = e.attack < 0.8 && canEngage ? 1 - e.attack / 0.8 : 0;
      if (e.attack <= 0) {
        e.attack = 2.6 + this.rng.range(0, 0.7);
        if (canHitUplink && this.rng.chance(0.4)) {
          this.drawTracer(ep, stage.at, "red");
          this.signalHealth = Math.max(0, this.signalHealth - 4);
          if (this.signalHealth === 0)
            this.fail(
              "The transmitter was disabled. Clear the guards before they can damage the uplink.",
            );
        } else if (d < 34 && sees) {
          this.drawTracer(ep, p, "red");
          if (this.ride)
            this.ride.integrity = Math.max(0, this.ride.integrity - 3);
          else this.damage(9);
          this.audio.event("shoot", { volume: 0.4 });
        }
      }
      if (d < 25 && sees && this.story.mission > 0) this.addHeat(dt * 0.04);
    }
  }
  chooseAim() {
    let best = null,
      score = Infinity;
    const p = this.position;
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      const ep = e.actor.position(this.aimOrigin),
        d = distance(p, ep);
      if (
        d > 42 ||
        !visible(
          { ...p, y: p.y + 1 },
          { ...ep, y: ep.y + 1 },
          this.world.buildings,
        )
      )
        continue;
      let s = d;
      if (this.ui.mode === "keyboard" && this.ctx.input.pointer.over) {
        const v = ep.clone().project(this.ctx.camera.camera);
        s +=
          Math.hypot(
            v.x - this.ctx.input.pointer.x,
            v.y - this.ctx.input.pointer.y,
          ) * 24;
      }
      if (s < score) {
        score = s;
        best = e;
      }
    }
    this.aimTarget = best;
  }
  witnessed() {
    const p = this.position;
    const sees = (q) =>
      distance(p, q) < 42 &&
      visible({ ...p, y: p.y + 1 }, { ...q, y: q.y + 1 }, this.world.buildings);
    for (const e of this.enemies)
      if (e.health > 0 && sees(e.actor.position(this.aimOrigin))) return true;
    for (const ped of this.pedestrians)
      if (sees(ped.actor.position(this.aimOrigin))) return true;
    for (const car of [...this.traffic, ...this.police])
      if (sees(car.position)) return true;
    return !!this.courier && sees(this.courier.position);
  }
  addHeat(n, forced = false) {
    if (!this.started || (!forced && !this.witnessed())) return;
    const before = this.heat;
    this.heat = clamp(this.heat + n, 0, 3);
    if (before === 0 && this.heat > 0) {
      this.heatState = "pursuit";
      this.searchTimer = 0;
      this.lastSeen = { ...this.position };
      this.spawnPolice();
    }
  }
  spawnPolice() {
    if (this.police.length) return;
    const p = this.position,
      near = (n) => Math.round(n / 108) * 108;
    for (let i = 0; i < 2; i++) {
      const x = clamp(near(p.x) + (i ? 108 : -108), -216, 216),
        z = clamp(near(p.z), -216, 216);
      this.police.push(
        new TrafficCar(this.ctx, {
          at: [x, 1, z],
          route: [point(x, z)],
          color: "navy",
          speed: 14 + i * 2,
          police: true,
        }),
      );
    }
  }
  clearHeat() {
    this.heat = 0;
    this.heatState = "clear";
    this.searchTimer = 0;
    for (const p of this.police) p.dispose();
    this.police = [];
  }
  tickHeat(dt) {
    if (this.heat <= 0) return;
    const p = this.position;
    let seen = false;
    for (const c of this.police) {
      const cp = c.position,
        d = distance(cp, p);
      if (
        d < 65 &&
        visible({ ...cp, y: 1 }, { ...p, y: p.y + 1 }, this.world.buildings)
      ) {
        seen = true;
        if (d < 8 && !this.ride && Math.abs(cp.y - p.y) < 2.6)
          this.damage(dt * 10);
      }
      c.tick(
        dt,
        this.heatState === "pursuit" ? p : this.lastSeen,
        this.world.roads,
      );
    }
    if (seen) {
      this.heatState = "pursuit";
      this.lastSeen = { ...p };
      this.searchTimer = 0;
    } else {
      this.heatState = "search";
      this.searchTimer = (this.searchTimer ?? 0) + dt;
      if (this.searchTimer > 10 + this.heat * 2) {
        this.clearHeat();
        this.toast("SIGNAL CLEAR · pursuit evaded");
        this.audio.event("interact");
      }
    }
  }
  startCourier() {
    if (this.courier) this.courier.dispose();
    this.courierStopped = false;
    this.courierDamage = 0;
    this.courierHitCooldown = 0;
    this.interceptPosition = null;
    this.courier = new TrafficCar(this.ctx, {
      at: [216, 1, -108],
      route: [
        point(212, -212),
        point(-212, -212),
        point(-212, 212),
        point(212, 212),
      ],
      color: "cyan",
      kind: "van",
      speed: 12,
    });
  }
  tickCourier(dt) {
    if (
      !this.courier ||
      this.courierStopped ||
      !this.story.active ||
      this.story.current?.type !== "intercept"
    )
      return;
    this.courier.tick(dt);
    this.courierHitCooldown -= dt;
    if (
      this.ride &&
      distance(this.ride.position, this.courier.position) < 5.2 &&
      Math.abs(this.ride.speed) > 7 &&
      this.courierHitCooldown <= 0
    ) {
      this.courierDamage += 35;
      this.courierHitCooldown = 1;
      this.audio.event("crash");
      this.toast(`Courier bodywork ${Math.max(0, 100 - this.courierDamage)}%`);
      this.addHeat(1);
      if (this.courierDamage >= 100) {
        this.courierStopped = true;
        this.courier.stopped = 1e9;
        this.interceptPosition = { ...this.courier.position };
        this.story.current.at = { ...this.interceptPosition };
      }
    }
  }
  fixedUpdate(ctx, dt) {
    if (!this.ready || this.ui.screen || !this.started) return;
    this.playTime += dt;
    this.sinceDamage += dt;
    if (this.sinceDamage > 8 && this.health < 60)
      this.health = Math.min(60, this.health + dt * 4);
    this.contextPrompt = null;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        this.reloadTime = 0;
        const n = Math.min(12 - this.ammo, this.reserve);
        this.ammo += n;
        this.reserve -= n;
      }
    }
    const axis = ctx.input.moveAxis();
    if (this.ride) {
      const leftKey = ctx.input.isDown("KeyA", "ArrowLeft"),
        rightKey = ctx.input.isDown("KeyD", "ArrowRight");
      const steering =
        leftKey || rightKey ? Number(rightKey) - Number(leftKey) : axis.x;
      const forward = Math.max(
          this.triggerValues.right,
          ctx.input.isDown("KeyW", "ArrowUp") ? 1 : 0,
          this.ui.mode === "touch" ? Math.max(0, axis.y) : 0,
        ),
        back = Math.max(
          this.triggerValues.left,
          ctx.input.isDown("KeyS", "ArrowDown") ? 1 : 0,
          this.ui.mode === "touch" ? Math.max(0, -axis.y) : 0,
        ),
        reverse = back > 0 && this.ride.speed < 1;
      this.ride.drive(dt, {
        throttle: reverse ? -back : forward,
        brake: !reverse ? back : 0,
        steer: steering * (this.ui.preferences.steering ?? 1),
        handbrake: ctx.input.isDown("Space"),
      });
      if (ctx.input.consumePress("KeyF")) this.exitCar();
      if (ctx.input.isDown("KeyR")) {
        this.recoveryTime = (this.recoveryTime ?? 0) + dt;
        if (this.recoveryTime > 1.6) {
          this.recoverCar();
          this.recoveryTime = 0;
        }
      } else this.recoveryTime = 0;
    } else {
      const basis = ctx.camera.groundBasis();
      this.move
        .copy(basis.right)
        .multiplyScalar(axis.x)
        .addScaledVector(basis.forward, axis.y);
      this.chooseAim();
      const aiming = ctx.input.isDown("KeyJ", "MouseLeft", "KeyC");
      this.player.setAiming(aiming);
      if (this.aimTarget && aiming) {
        const p = this.aimTarget.actor.position(this.aimOrigin);
        this.player.face(
          Math.atan2(p.x - this.position.x, p.z - this.position.z),
        );
      }
      this.player.move(dt, {
        x: this.move.x,
        z: this.move.z,
        sprint: ctx.input.isDown("ShiftLeft", "ShiftRight"),
        dodge: ctx.input.consumePress("Space"),
      });
      if (ctx.input.isDown("KeyJ", "MouseLeft")) this.shoot();
      if (ctx.input.consumePress("KeyR")) this.reload();
      let car = null,
        nearest = 4;
      for (const r of this.rides) {
        const d = distance(r.position, this.position);
        if (d < nearest) {
          car = r;
          nearest = d;
        }
      }
      const s = this.story.current,
        interacting =
          this.story.active &&
          s.type === "interact" &&
          distance(s.at, this.position) < 6;
      if (car && !interacting) {
        this.contextPrompt = { key: "KeyF", text: `Drive ${car.label}` };
        if (ctx.input.consumePress("KeyF")) this.enterCar(car);
      }
    }
    for (const r of this.rides)
      if (r !== this.ride) r.drive(dt, { brake: true });
    for (const c of this.traffic) c.tick(dt, null, null, this.position);
    this.tickCourier(dt);
    this.tickEnemies(dt);
    this.tickHeat(dt);
    for (const ped of this.pedestrians) {
      const p = ped.actor.position(this.aimOrigin),
        threat =
          distance(p, this.position) < 12 &&
          (this.shotCooldown > 0.15 || Math.abs(this.ride?.speed ?? 0) > 6);
      let x = 0,
        z = 0;
      if (!ped.stationary) {
        ped.wait -= dt;
        if (threat) {
          x = p.x - this.position.x;
          z = p.z - this.position.z;
        } else if (ped.wait <= 0) {
          x = ped.target.x - p.x;
          z = ped.target.z - p.z;
          if (Math.hypot(x, z) < 1) {
            ped.target = point(
              ped.home.x + this.rng.range(-7, 7),
              ped.home.z + this.rng.range(-7, 7),
            );
            ped.wait = this.rng.range(1, 4);
          }
        }
        const len = Math.hypot(x, z);
        if (len) {
          x = (x / len) * (threat ? 1 : 0.18);
          z = (z / len) * (threat ? 1 : 0.18);
        }
      }
      ped.actor.move(dt, { x, z, sprint: threat });
    }
    this.story.tick(dt);
    if (
      !this.story.active &&
      !this.story.finished &&
      this.story.completed > 0 &&
      distance(this.position, point(-18, 15)) < 6 &&
      !this.ride
    ) {
      this.contextPrompt = { key: "KeyF", text: "Plan the next job with Bo" };
      if (ctx.input.consumePress("KeyF")) this.action("next");
    }
    if (ctx.input.consumePress("KeyV") && this.scanCooldown === 0) {
      this.scan = 4;
      this.scanCooldown = 12;
      this.lookBeforeScan = ctx.engine.look;
      ctx.engine.setLook(LOOK_PRESETS.night_ops);
      this.audio.event("scan");
      this.toast("SIGNAL SCAN · evidence highlighted", 3);
    }
    if (this.scan > 0) {
      this.scan -= dt;
      if (this.scan <= 0) {
        ctx.engine.setLook(
          LOOK_PRESETS[ctx.engine.settings.values.look] ?? this.lookBeforeScan,
        );
        this.scan = 0;
      }
    }
    for (const c of this.caches)
      if (!c.taken && !this.ride && distance(c.at, this.position) < 2) {
        c.taken = true;
        c.mesh.visible = false;
        this.cacheTaken.push(c.id);
        this.cash += 120;
        this.reserve += 12;
        this.toast("HIDDEN EVIDENCE · +$120 · ammunition recovered");
        this.audio.event("collect");
        this.checkpoint();
      }
    if (this.courierChallenge) {
      const c = this.courierChallenge;
      c.time -= dt;
      if (
        this.ride &&
        distance(this.position, c.route[c.index]) < 9 &&
        Math.abs(this.ride.speed) < 3
      ) {
        c.index++;
        this.audio.event("collect");
        if (c.index === c.route.length) {
          this.cash += 450;
          this.toast("COURIER COMPLETE · +$450");
          this.courierChallenge = null;
          this.checkpoint();
        }
      }
      if (c.time <= 0) {
        this.toast("Courier window closed. Try again from Pause.");
        this.courierChallenge = null;
      }
    }
    const p = this.position;
    if (p.y < -5 || Math.abs(p.x) > 265 || Math.abs(p.z) > 265) {
      if (this.ride) this.recoverCar();
      else {
        this.damage(20);
        this.player.teleport(START);
        this.toast("Bo pulled you back from the waterfront.");
      }
    }
    if (this.ride?.integrity <= 0) {
      this.toast({ type: "recovery" });
      this.contextPrompt = { key: "KeyR", text: "Hold to recover vehicle" };
    }
  }
  update(ctx, dt) {
    if (!this.ready) return;
    for (const c of ctx.input.commands)
      if (c?.type === "analog-triggers")
        this.triggerValues = { left: c.left, right: c.right };
    if (!ctx.input.playing) {
      const pad = Array.from(navigator.getGamepads?.() ?? []).find(
          (p) => p && p.connected !== false,
        ),
        left = pad?.buttons?.[6]?.value ?? 0,
        right = pad?.buttons?.[7]?.value ?? 0;
      if (
        left !== this.triggerValues.left ||
        right !== this.triggerValues.right
      )
        ctx.input.send({ type: "analog-triggers", left, right });
    }
    const menuWasOpen = !!this.ui.screen;
    this.ui.update(dt || 1 / 60);
    if (!menuWasOpen && !this.ui.screen && this.started) {
      if (ctx.input.wasPressed("Escape")) this.ui.show("pause");
      else if (ctx.input.wasPressed("KeyM")) this.ui.show("map");
    }
    ctx.engine.timeScale = this.ui.screen ? 0 : 1;
    const p = this.position;
    this.world.update(dt, ctx.time);
    this.player.update(dt);
    for (const r of this.rides) r.update();
    for (const c of [...this.traffic, ...this.police]) c.update(ctx.time);
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      e.actor.update(dt);
      const ep = e.actor.position(this.aimOrigin);
      e.indicator.position.set(ep.x, ep.y + 0.07, ep.z);
      e.indicator.scale.setScalar(1 + e.telegraph * 0.7);
      e.indicator.visible = e.telegraph > 0;
    }
    for (const ped of this.pedestrians) ped.actor.update(dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.time -= dt;
      if (t.time <= 0) {
        t.mesh.removeFromParent();
        t.mesh.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    const target =
      this.courierChallenge?.route[this.courierChallenge.index] ??
      this.story.target();
    this.marker.visible = !!target && this.started;
    if (target) {
      this.marker.position.set(target.x, (target.y ?? 0) + 0.12, target.z);
      this.marker.rotation.y = ctx.time * 0.5;
    }
    const defense = this.story.active && this.story.current?.type === "defend";
    this.defenseRing.visible = !!defense;
    if (defense) {
      const center = this.story.current.at;
      this.defenseRing.position.set(center.x, (center.y ?? 0) + 0.28, center.z);
    }
    this.targetReticle.visible =
      !!this.aimTarget && !this.ride && !this.ui.screen;
    if (this.aimTarget) {
      const ep = this.aimTarget.actor.position(this.aimOrigin);
      this.targetReticle.position.set(ep.x, ep.y + 0.04, ep.z);
    }
    for (const c of this.caches)
      if (!c.taken) {
        c.mesh.rotation.y = ctx.time * 0.5;
        c.mesh.scale.setScalar(this.scan > 0 ? 2 : 1);
      }
    if (this.ride && ctx.camera.preset === "third" && !this.ui.screen) {
      const mouse = ctx.input.mouseDelta;
      if (Math.abs(mouse.x) < 0.1 && Math.abs(mouse.y) < 0.1)
        ctx.camera.yaw +=
          angleDelta(this.ride.yaw + Math.PI, ctx.camera.yaw) *
          Math.min(1, dt * 1.5);
      ctx.camera.pitch = 0.68;
    }
    this.audio.update(dt, {
      speed: this.ride?.speed ?? 0,
      heat: this.heat,
      inVehicle: !!this.ride,
    });
    if (this.dialogueQueue.length) {
      this.dialogueQueue[0].remaining -= dt;
      if (this.dialogueQueue[0].remaining <= 0) this.dialogueQueue.shift();
    }
    if (this.toastTime > 0) this.toastTime -= dt;
    const location =
      p.x > 200
        ? "SABLE WATERFRONT"
        : p.z < -130
          ? "CIVIC QUARTER"
          : p.z > 110
            ? "THE FREIGHT YARDS"
            : p.x < -60
              ? "OLD MARKET"
              : "BREAKWATER AVENUE";
    const mission = this.courierChallenge
      ? {
          chapter: "C",
          title: "After-hours courier",
          objective: `Delivery ${this.courierChallenge.index + 1} / 4`,
          detail: `${Math.ceil(this.courierChallenge.time)} seconds remaining`,
          progress: this.courierChallenge.index / 4,
        }
      : this.story.hud();
    this.ui.renderHUD({
      mission,
      location,
      heat: Math.ceil(this.heat),
      heatState: this.heatState,
      health: this.health,
      ammo: this.reloadTime > 0 ? "…" : this.ammo,
      reserve: this.reserve,
      cash: this.cash,
      speed: Math.round(Math.abs(this.ride?.speed ?? 0) * 3.6),
      inVehicle: !!this.ride,
      vehicleHealth: this.ride?.integrity ?? 100,
      subtitle: this.dialogueQueue[0] ?? null,
      prompt: this.contextPrompt,
      position: {
        x: p.x,
        z: p.z,
        yaw: this.ride?.yaw ?? this.player.hero.facing,
      },
      target,
      world: this.world,
      enemies: [
        ...this.enemies
          .filter((e) => e.health > 0)
          .map((e) => e.actor.position(new Vector3())),
        ...this.police.map((c) => c.position),
      ],
      scan: this.scan,
      toast: this.toastTime > 0 ? this.currentToast() : null,
    });
    ctx.hud.clear();
  }
  cameraTarget() {
    const p = this.ready ? this.position : { x: -18, y: 0, z: 18 };
    return this.targetVector.set(p.x, p.y + (this.ride ? 1 : 1.2), p.z);
  }
  status() {
    return this.ready
      ? `${this.ui.screen ?? "playing"} | job ${this.story.mission + 1}/4 stage ${this.story.stage + 1}/${this.story.chapter.stages.length} | ${this.story.current?.label ?? "free roam"} | health ${Math.ceil(this.health)} | heat ${this.heat.toFixed(1)} | ${this.ride?.id ?? "on foot"} | ${this.playTime.toFixed(1)}s`
      : "Building Port Sable";
  }
  fingerprint() {
    const p = this.position;
    return JSON.stringify({
      x: p.x,
      z: p.z,
      health: this.health,
      cash: this.cash,
      story: this.story.data(),
      ride: this.ride?.id,
      heat: this.heat,
    });
  }
  saveData() {
    const p = this.position;
    return {
      version: 1,
      story: this.story.data(),
      health: this.health,
      ammo: this.ammo,
      reserve: this.reserve,
      cash: this.cash,
      playTime: this.playTime,
      player: [p.x, p.y, p.z],
      ride: this.ride?.id ?? null,
      rides: this.rides.map((r) => ({
        id: r.id,
        at: [r.position.x, r.position.y, r.position.z],
        yaw: r.yaw,
        integrity: r.integrity,
        upgraded: r.upgraded,
      })),
      cacheTaken: [...this.cacheTaken],
      interceptPosition: this.interceptPosition ?? null,
    };
  }
  checkpoint() {
    if (!this.ready) return;
    this.lastCheckpoint = structuredClone(this.saveData());
    if (
      !this.replaying &&
      !this.ctx.input.playing &&
      !writeSave(this.lastCheckpoint)
    )
      this.toast(
        "Checkpoint kept for this session; browser storage is unavailable.",
      );
  }
  readSave() {
    return loadCheckpoint();
  }
  availableCheckpoint() {
    return (
      (this.replaying ? validateSave(this.replayBackup) : null) ??
      validateSave(this.lastCheckpoint) ??
      this.readSave()
    );
  }
  restoreCheckpoint(raw) {
    const d = validateSave(raw);
    if (!d) {
      this.toast("That checkpoint could not be read.");
      return;
    }
    this.exitCar(true);
    this.clearHeat();
    this.clearEnemies();
    this.started = true;
    this.courier?.dispose();
    this.courier = null;
    this.courierStopped = false;
    this.courierDamage = 0;
    this.courierHitCooldown = 0;
    this.courierChallenge = null;
    if (this.scan > 0)
      this.ctx.engine.setLook(
        LOOK_PRESETS[this.ctx.engine.settings.values.look] ??
          this.lookBeforeScan,
      );
    this.scan = 0;
    this.scanCooldown = 0;
    this.shotCooldown = 0;
    this.damageCooldown = 0;
    this.sinceDamage = 0;
    this.health = Math.max(60, d.health);
    this.ammo = 12;
    this.reserve = Math.max(72, d.reserve);
    this.cash = d.cash;
    this.playTime = d.playTime;
    this.cacheTaken = d.cacheTaken;
    this.interceptPosition = d.interceptPosition;
    this.player.teleport(d.player);
    for (const saved of d.rides) {
      const r = this.rides.find((r) => r.id === saved.id);
      r.reset(saved.at, saved.yaw);
      r.integrity = Math.max(35, saved.integrity);
      r.setUpgraded(saved.upgraded);
    }
    if (d.ride) {
      const r = this.rides.find((r) => r.id === d.ride);
      this.enterCar(r);
    }
    for (const c of this.caches) {
      c.taken = this.cacheTaken.includes(c.id);
      c.mesh.visible = !c.taken;
    }
    this.story.restore(d.story);
    this.placeCrew(this.story.mission, this.story.stage);
    if (d.story.mission === 2 && d.story.stage >= 2 && d.interceptPosition) {
      const p = d.interceptPosition;
      this.courier = new TrafficCar(this.ctx, {
        at: [p.x, 0.85, p.z],
        route: [],
        color: "cyan",
        kind: "van",
        speed: 0,
      });
      this.courier.stopped = 1e9;
      this.courierStopped = true;
    }
    this.lastCheckpoint = structuredClone(d);
    this.reloadTime = 0;
    this.dialogueQueue = [];
    this.say("IONA", "Signal restored. We’re right where we left off.");
  }
  dispose() {
    this.ui?.dispose();
    this.audio?.dispose();
    this.world?.dispose();
    this.clearEnemies();
    this.player?.dispose();
    for (const p of this.pedestrians) p.actor.dispose();
    for (const r of this.rides) r.dispose();
    for (const t of [...this.traffic, ...this.police]) t.dispose();
    this.courier?.dispose();
  }
}
