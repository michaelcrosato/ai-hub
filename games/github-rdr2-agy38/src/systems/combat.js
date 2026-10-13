/**
 * DEAD HORIZON: 1899 - Combat System
 * Weapon arsenal, ballistics bullets, condition cleaning, cover mechanics,
 * saloon brawling combos, and intelligent enemy outlaw AI.
 */

import { WEAPONS } from '../data/compendium.js';

export class CombatSystem {
  constructor(engine, game, audio, particles) {
    this.E = engine;
    this.game = game;
    this.audio = audio;
    this.particles = particles;

    // Bullet simulator on ground plane
    this.bullets = new this.E.Bullets(game, { plane: 'ground' });

    // Active weapon wheel / inventory
    this.weapons = JSON.parse(JSON.stringify(WEAPONS));
    this.equippedId = 'cattleman';
    this.ammoInMag = {
      cattleman: 6,
      schofield: 6,
      double_action: 6,
      volcanic: 8,
      mauser: 10,
      carbine_repeater: 7,
      lancaster_repeater: 14,
      springfield_rifle: 1,
      bolt_action_rifle: 5,
      varmint_rifle: 14,
      rolling_block: 1,
      double_barrel_shotgun: 2,
      pump_action_shotgun: 5,
      hunting_bow: 1,
      dynamite: 8,
      fire_bottle: 8,
      hunting_knife: 99,
      lasso: 99
    };
    this.ammoPouch = {
      revolver: 120,
      pistol: 100,
      repeater: 140,
      rifle: 60,
      shotgun: 48,
      varmint: 80,
      arrow: 40,
      explosive: 8,
      incendiary: 8
    };

    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.inCover = false;
    this.coverPoint = null;

    // Brawling state
    this.brawlCombo = new this.E.Combo(['jab', 'cross', 'uppercut'], { window: 0.35 });
    this.blocking = false;

    // Active enemies in the world
    this.enemies = [];
  }

  get equipped() {
    return this.weapons[this.equippedId] || this.weapons.cattleman;
  }

  equip(weaponId) {
    if (this.weapons[weaponId]) {
      this.equippedId = weaponId;
      this.reloading = false;
      if (this.audio) this.audio.playSfx('hammer_cock');
    }
  }

  cleanWeapon() {
    const w = this.equipped;
    if (w) {
      w.condition = 100;
      if (this.audio) this.audio.playSfx('lever_action');
    }
  }

  reload() {
    const w = this.equipped;
    if (!w || !w.ammoType || this.reloading) return;
    const current = this.ammoInMag[this.equippedId] || 0;
    const max = w.ammoMax || 6;
    if (current >= max) return;
    const pool = this.ammoPouch[w.ammoType] || 0;
    if (pool <= 0) return;

    this.reloading = true;
    this.reloadTimer = (w.reload ? (100 - w.reload) * 0.02 + 0.6 : 1.2);
    if (this.audio) this.audio.playSfx('lever_action');
  }

  fire(origin, targetPos, team = 'player', options = {}) {
    const w = this.equipped;
    if (!w || this.fireCooldown > 0 || this.reloading) return false;

    // Check ammo
    if (w.ammoType) {
      const mag = this.ammoInMag[this.equippedId] || 0;
      if (mag <= 0) {
        if (this.audio) this.audio.playSfx('hammer_cock', { vol: 0.4 });
        this.reload();
        return false;
      }
      this.ammoInMag[this.equippedId]--;
    }

    // Weapon condition degradation
    w.condition = Math.max(10, w.condition - 0.25);
    const condMult = w.condition / 100;

    // Aim direction with accuracy spread
    const dx = targetPos[0] - origin[0];
    const dy = targetPos[1] - origin[1];
    let angle = Math.atan2(dy, dx);
    const spread = (options.deadEye ? 0 : (100 - w.accuracy) * 0.002);
    angle += (Math.random() - 0.5) * spread;

    const speed = (w.category === 'Bow' ? 180 : (w.category === 'Shotgun' ? 240 : 320));
    const damage = Math.round(w.damage * (0.7 + 0.3 * condMult));

    if (w.category === 'Shotgun') {
      // 5-pellet buckshot spread
      for (let p = -2; p <= 2; p++) {
        const spreadAngle = angle + p * 0.08;
        this.bullets.fire({
          x: origin[0], y: origin[1], z: origin[2] || 10,
          vx: Math.cos(spreadAngle) * speed,
          vy: Math.sin(spreadAngle) * speed,
          vz: 0,
          r: 2,
          team,
          dmg: Math.round(damage / 3),
          color: '#ffd080',
          life: 0.6
        });
      }
    } else if (w.category === 'Thrown') {
      // Arc throw
      this.bullets.fire({
        x: origin[0], y: origin[1], z: origin[2] || 10,
        vx: Math.cos(angle) * 140,
        vy: Math.sin(angle) * 140,
        vz: 60,
        r: 3,
        team,
        dmg: damage,
        color: '#ff4020',
        life: 1.5,
        isExplosive: true
      });
    } else {
      // Single precision rifle / revolver bullet
      this.bullets.fire({
        x: origin[0], y: origin[1], z: origin[2] || 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0,
        r: 2,
        team,
        dmg: damage,
        color: (options.deadEye ? '#ff2020' : '#ffe090'),
        life: 1.5
      });
    }

    // Muzzle flash & smoke particles
    if (this.particles) {
      this.particles.sparks(origin[0] + Math.cos(angle) * 8, origin[1] + Math.sin(angle) * 8, origin[2] || 10, 6, angle);
      this.particles.smoke(origin[0] + Math.cos(angle) * 6, origin[1] + Math.sin(angle) * 6, origin[2] || 10, 3);
    }

    // Audio cue based on category
    if (this.audio) {
      if (w.category === 'Shotgun') this.audio.playSfx('gunshot_shotgun');
      else if (w.category === 'Rifle' || w.category === 'Sniper Rifle') this.audio.playSfx('gunshot_rifle');
      else if (w.category === 'Repeater') this.audio.playSfx('gunshot_repeater');
      else if (w.category === 'Bow') this.audio.playSfx('whoosh');
      else this.audio.playSfx('gunshot_revolver');
    }

    this.fireCooldown = (100 - w.fireRate) * 0.008 + 0.12;
    return true;
  }

  spawnEnemy(o = {}) {
    const enemy = {
      id: 'foe_' + Math.random().toString(36).substr(2, 9),
      name: o.name || 'Colter Outlaw',
      faction: o.faction || 'colter',
      x: o.x || 300,
      y: o.y || 300,
      z: 0,
      hp: o.hp || 70,
      maxHp: o.hp || 70,
      speed: 45,
      facing: 0,
      alert: false,
      dead: false,
      state: 'combat', // 'idle', 'patrol', 'cover', 'combat', 'charge'
      stateTimer: 0,
      fireTimer: Math.random() * 2 + 1,
      rig: new this.E.Humanoid({
        build: 'heroic',
        outfit: 'coat',
        hat: { style: 'cowboy', color: (o.faction === 'law' ? '#222d3b' : '#3d2516') },
        colors: {
          cloth: (o.faction === 'law' ? '#293e56' : '#593220'),
          coat: (o.faction === 'law' ? '#1b2838' : '#382218'),
          pants: '#2d251d'
        }
      })
    };
    this.enemies.push(enemy);
    return enemy;
  }

  update(dt, player, map) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Reloading cycle
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const w = this.equipped;
        if (w && w.ammoType) {
          const needed = (w.ammoMax || 6) - (this.ammoInMag[this.equippedId] || 0);
          const avail = Math.min(needed, this.ammoPouch[w.ammoType] || 0);
          this.ammoInMag[this.equippedId] += avail;
          this.ammoPouch[w.ammoType] -= avail;
        }
      }
    }

    // Update bullets
    this.bullets.update(dt, map);

    // Player bullets hitting enemies
    this.bullets.hit(this.enemies, (b, foe) => {
      if (foe.dead) return;
      foe.hp -= b.dmg;
      if (this.particles) {
        this.particles.sparks(b.x, b.y, b.z || 8, 4);
      }
      if (foe.hp <= 0) {
        foe.dead = true;
        foe.hp = 0;
        if (this.particles) {
          this.particles.dust(foe.x, foe.y, 0, 8);
        }
      }
    }, 'player');

    // Enemy AI update
    for (const foe of this.enemies) {
      if (foe.dead) continue;
      const dx = player.x - foe.x;
      const dy = player.y - foe.y;
      const dist = Math.hypot(dx, dy);

      foe.facing = Math.atan2(dy, dx);
      foe.fireTimer -= dt;

      if (dist > 35) {
        // Move closer
        foe.x += Math.cos(foe.facing) * foe.speed * dt;
        foe.y += Math.sin(foe.facing) * foe.speed * dt;
      }

      // Enemy firing at player
      if (foe.fireTimer <= 0 && dist < 250) {
        foe.fireTimer = Math.random() * 2.2 + 1.2;
        this.bullets.fire({
          x: foe.x, y: foe.y, z: 10,
          vx: Math.cos(foe.facing) * 220,
          vy: Math.sin(foe.facing) * 220,
          vz: 0,
          r: 2,
          team: 'foe',
          dmg: 15,
          color: '#ff8040',
          life: 1.5
        });
        if (this.audio) this.audio.playSfx('gunshot_revolver', { vol: 0.6 });
      }

      // Update enemy 3D humanoid rig
      foe.rig.update(dt, {
        x: foe.x, y: foe.y, z: foe.z,
        vx: Math.cos(foe.facing) * (dist > 35 ? foe.speed : 0),
        vy: Math.sin(foe.facing) * (dist > 35 ? foe.speed : 0),
        facing: foe.facing,
        point: true
      });
    }

    // Enemy bullets hitting player
    this.bullets.hit([player], (b, p) => {
      p.health -= b.dmg;
      if (this.audio) this.audio.playSfx('hurt');
      if (this.particles) this.particles.sparks(p.x, p.y, p.z || 10, 5);
      if (p.health <= 0) p.health = 0;
    }, 'foe');

    // Remove dead enemies that faded
    this.E.prune(this.enemies, f => f.dead && f.fadeTimer && f.fadeTimer <= 0);
  }

  draw(r) {
    // Draw active bullets
    this.bullets.draw(r);

    // Draw enemies
    for (const foe of this.enemies) {
      if (foe.dead) {
        // Fallen on ground
        r.actor(foe.x, foe.y, foe.z, (g, ox, oy) => {
          foe.rig.draw(g, ox, oy, r.view);
        });
      } else {
        r.actor(foe.x, foe.y, foe.z, (g, ox, oy) => {
          foe.rig.draw(g, ox, oy, r.view);
        });
        // Health bar above active enemy
        const [sx, sy] = r.w(foe.x, foe.y, foe.z + 24);
        if (r.visible(foe.x, foe.y, foe.z)) {
          r.overlay(g => {
            const pct = Math.max(0, foe.hp / foe.maxHp);
            this.E.px.rect(g, sx - 12, sy - 4, 24, 3, '#100a08');
            this.E.px.rect(g, sx - 11, sy - 3, Math.round(22 * pct), 1, '#d93829');
          });
        }
      }
    }
  }
}
