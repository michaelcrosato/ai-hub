/**
 * DEAD HORIZON: 1899 - Hunting, Skinning & Fishing System
 * Animal herd AI, Eagle Eye scent tracking, 3-Star clean kill pelt grading,
 * skinning, campfire meat cooking, and interactive fishing minigame.
 */

import { FAUNA, FISH } from '../data/compendium.js';

export class HuntingAndFishingSystem {
  constructor(engine, audio, particles) {
    this.E = engine;
    this.audio = audio;
    this.particles = particles;

    this.eagleEye = false;
    this.eagleEyeTimer = 0;

    // Active spawned animals in wilderness
    this.animals = [];
    this._spawnInitialWildlife();

    // Fishing minigame state
    this.fishing = {
      active: false,
      state: 'idle', // 'idle', 'cast', 'waiting', 'nibble', 'hooked', 'reeling', 'caught'
      timer: 0,
      tension: 0.2, // 0..1 (if > 0.95 line breaks!)
      distance: 25,
      currentFish: null
    };

    // Stowed harvested pelts in satchel
    this.pelts = [];
  }

  _spawnInitialWildlife() {
    const species = ['whitetail_buck', 'whitetail_deer', 'gray_wolf', 'grizzly_bear', 'jackrabbit', 'wild_boar'];
    for (let i = 0; i < 8; i++) {
      const spId = species[i % species.length];
      const data = FAUNA.find(f => f.id === spId) || FAUNA[0];
      this.animals.push({
        id: 'wild_' + Math.random().toString(36).substr(2, 8),
        speciesId: spId,
        name: data.name,
        category: data.category,
        x: 80 + Math.random() * 240,
        y: 120 + Math.random() * 200,
        z: 0,
        hp: data.hp,
        maxHp: data.hp,
        speed: (data.category === 'Predator' ? 55 : 40),
        facing: Math.random() * Math.PI * 2,
        state: 'graze', // 'graze', 'flee', 'stalk', 'attack', 'dead'
        qualityStars: (Math.random() < 0.4 ? 3 : (Math.random() < 0.7 ? 2 : 1)), // 3-Star = Pristine
        skinned: false,
        size: data.size,
        scentTrail: []
      });
    }
  }

  toggleEagleEye() {
    this.eagleEye = !this.eagleEye;
    if (this.eagleEye) {
      this.eagleEyeTimer = 12.0;
      if (this.audio) this.audio.playSfx('eagle_eye');
    }
  }

  evaluateKillQuality(animal, weaponUsed, wasHeadshot) {
    if (animal.qualityStars === 3 && wasHeadshot) {
      return 'Pristine (3-Star)';
    } else if (animal.qualityStars >= 2) {
      return 'Good (2-Star)';
    }
    return 'Poor (1-Star)';
  }

  skinAnimal(animal) {
    if (!animal.dead || animal.skinned) return null;
    animal.skinned = true;
    const quality = (animal.qualityStars === 3 ? 'Pristine' : (animal.qualityStars === 2 ? 'Good' : 'Poor'));
    const peltName = `${quality} ${animal.name} Pelt`;
    const pelt = {
      name: peltName,
      quality,
      speciesId: animal.speciesId,
      value: (animal.qualityStars === 3 ? 18 : (animal.qualityStars === 2 ? 10 : 4))
    };
    this.pelts.push(pelt);
    if (this.audio) this.audio.playSfx('punch', { vol: 0.3 });
    if (this.particles) this.particles.bits(animal.x, animal.y, 4, 8, ['#c0392b', '#8e44ad']);
    return pelt;
  }

  // --- FISHING MINIGAME ---
  startFishing() {
    this.fishing.active = true;
    this.fishing.state = 'cast';
    this.fishing.timer = 1.2;
    this.fishing.distance = 24;
    this.fishing.tension = 0.2;
    this.fishing.currentFish = this.E.pick(FISH);
    if (this.audio) this.audio.playSfx('whoosh');
  }

  updateFishing(dt, input) {
    if (!this.fishing.active) return;
    const f = this.fishing;
    f.timer -= dt;

    if (f.state === 'cast') {
      if (f.timer <= 0) {
        f.state = 'waiting';
        f.timer = 2.0 + Math.random() * 2.5;
      }
    } else if (f.state === 'waiting') {
      if (f.timer <= 0) {
        f.state = 'nibble';
        f.timer = 1.8;
        if (this.audio) this.audio.playSfx('coin', { vol: 0.3 });
      }
    } else if (f.state === 'nibble') {
      // Prompt player to strike/hook
      if (input.pressed('attack') || input.pressed('confirm')) {
        f.state = 'hooked';
        f.timer = 8.0;
        if (this.audio) this.audio.playSfx('ricochet', { vol: 0.4 });
      } else if (f.timer <= 0) {
        // Missed bite
        f.state = 'waiting';
        f.timer = 2.5;
      }
    } else if (f.state === 'hooked') {
      // Reeling mini-game
      const isReeling = input.down('attack') || input.down('confirm');
      if (isReeling) {
        f.distance -= 8 * dt;
        f.tension += 0.35 * dt;
        if (this.audio && Math.random() < dt * 6) this.audio.playSfx('lever_action', { vol: 0.2 });
      } else {
        f.tension = Math.max(0.1, f.tension - 0.45 * dt);
      }

      // Fish thrashing tension spikes
      if (Math.sin(Date.now() * 0.005) > 0.6) {
        f.tension += 0.25 * dt;
      }

      if (f.tension >= 0.98) {
        // Line snapped!
        f.state = 'idle';
        f.active = false;
        if (this.audio) this.audio.playSfx('hurt', { vol: 0.5 });
      } else if (f.distance <= 2) {
        // Caught!
        f.state = 'caught';
        f.active = false;
        if (this.audio) this.audio.playSfx('cash_register', { vol: 0.8 });
      }
    }
  }

  update(dt, player, combatSystem) {
    // Eagle eye timer
    if (this.eagleEye) {
      this.eagleEyeTimer -= dt;
      if (this.eagleEyeTimer <= 0) {
        this.eagleEye = false;
      }
    }

    // Animal herd AI
    for (const an of this.animals) {
      if (an.dead) continue;
      const dx = player.x - an.x;
      const dy = player.y - an.y;
      const dist = Math.hypot(dx, dy);

      // Record scent trail
      if (Math.random() < dt * 2) {
        an.scentTrail.push([an.x, an.y]);
        if (an.scentTrail.length > 8) an.scentTrail.shift();
      }

      if (an.category === 'Predator' && dist < 120 && !player.mounted) {
        // Stalk and attack player
        an.state = 'attack';
        an.facing = Math.atan2(dy, dx);
        an.x += Math.cos(an.facing) * an.speed * dt;
        an.y += Math.sin(an.facing) * an.speed * dt;

        if (dist < 18) {
          player.health = Math.max(0, player.health - 25 * dt);
          if (this.audio && Math.random() < dt * 2) this.audio.playSfx('hurt');
        }
      } else if (dist < 60) {
        // Spook and flee away from player
        an.state = 'flee';
        an.facing = Math.atan2(-dy, -dx);
        an.x += Math.cos(an.facing) * (an.speed * 1.4) * dt;
        an.y += Math.sin(an.facing) * (an.speed * 1.4) * dt;
      } else {
        // Graze peacefully
        an.state = 'graze';
        if (Math.random() < dt * 0.3) {
          an.facing += (Math.random() - 0.5) * 1.5;
        }
        an.x += Math.cos(an.facing) * (an.speed * 0.25) * dt;
        an.y += Math.sin(an.facing) * (an.speed * 0.25) * dt;
      }

      // Check bullet hits from combat system
      if (combatSystem) {
        combatSystem.bullets.hit([an], (b, hitAn) => {
          hitAn.hp -= b.dmg;
          if (this.particles) this.particles.sparks(hitAn.x, hitAn.y, 6, 4);
          if (hitAn.hp <= 0) {
            hitAn.dead = true;
            hitAn.hp = 0;
            if (this.particles) this.particles.dust(hitAn.x, hitAn.y, 0, 6);
          }
        }, 'player');
      }
    }
  }

  draw(r) {
    // Draw Eagle Eye scent trails
    if (this.eagleEye) {
      r.overlay(g => {
        for (const an of this.animals) {
          if (!an.dead && an.scentTrail.length > 1) {
            for (let i = 0; i < an.scentTrail.length - 1; i++) {
              const [p0x, p0y] = r.w(an.scentTrail[i][0], an.scentTrail[i][1], 2);
              const [p1x, p1y] = r.w(an.scentTrail[i+1][0], an.scentTrail[i+1][1], 2);
              this.E.px.line(g, p0x, p0y, p1x, p1y, 'rgba(245, 176, 65, 0.45)', 2);
              this.E.px.disc(g, p0x, p0y, 2, 'rgba(255, 230, 120, 0.6)');
            }
          }
        }
      });
    }

    // Draw Animals
    for (const an of this.animals) {
      if (an.dead) {
        // Dead carcass on ground
        r.actor(an.x, an.y, 0, (g, ox, oy) => {
          this.E.px.ell(g, ox, oy, 10, 5, (an.skinned ? '#922b21' : '#6e472e'));
        });
      } else {
        // Living animal
        r.actor(an.x, an.y, 0, (g, ox, oy) => {
          // Quadruped body
          const sc = (an.size === 'massive' ? 1.4 : (an.size === 'small' ? 0.6 : 1.0));
          this.E.px.ell(g, ox, oy - 6 * sc, 12 * sc, 7 * sc, (an.category === 'Predator' ? '#422513' : '#7d5236'));
          // Head
          const headX = ox + Math.cos(an.facing) * 9 * sc;
          const headY = oy - 10 * sc;
          this.E.px.disc(g, headX, headY, 4 * sc, '#5d3821');
          // Antlers for buck
          if (an.speciesId === 'whitetail_buck') {
            this.E.px.line(g, headX, headY - 3, headX - 4, headY - 8, '#d5dbdb', 1);
            this.E.px.line(g, headX, headY - 3, headX + 4, headY - 8, '#d5dbdb', 1);
          }
        });

        // 3-Star Quality indicator when Eagle Eye or aiming
        if (this.eagleEye) {
          const [sx, sy] = r.w(an.x, an.y, 16);
          r.overlay(g => {
            const stars = '★'.repeat(an.qualityStars);
            this.E.font.text(g, `${an.name} ${stars}`, sx, sy - 8, '#f4d03f', {
              outline: '#000000',
              align: 'center',
              scale: 1
            });
          });
        }
      }
    }

    // Draw Fishing HUD if active
    if (this.fishing.active) {
      r.overlay(g => {
        const f = this.fishing;
        const boxW = 160, boxH = 40;
        const bx = r.W / 2 - boxW / 2, by = r.H - 55;
        this.E.ui.box(g, bx, by, boxW, boxH, { bg: '#1c2833', border: '#5dade2' });
        
        let label = 'CASTING LINE...';
        if (f.state === 'waiting') label = 'WAITING FOR NIBBLE...';
        if (f.state === 'nibble') label = 'STRIKE! (PRESS SPACE / CLICK)';
        if (f.state === 'hooked') label = `REELING! DIST: ${Math.round(f.distance)}m`;

        this.E.font.text(g, label, r.W / 2, by + 6, '#ffffff', { align: 'center', scale: 1 });

        // Line tension meter bar
        if (f.state === 'hooked') {
          const barColor = (f.tension > 0.8 ? '#e74c3c' : (f.tension > 0.5 ? '#f39c12' : '#2ecc71'));
          this.E.ui.bar(g, bx + 10, by + 24, boxW - 20, 8, f.tension, barColor);
        }
      });
    }
  }
}
