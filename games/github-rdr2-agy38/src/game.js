/**
 * DEAD HORIZON: 1899 - Master Game Engine & Controller
 * An original content-complete spiritual successor to Red Dead Redemption 2.
 * Powered by my-3D2dge AGENT EDITION.
 */

import { WesternAudio } from './systems/audio.js';
import { DeadEyeSystem } from './systems/deadeye.js';
import { HorseSystem } from './systems/horse.js';
import { CombatSystem } from './systems/combat.js';
import { FrontierWorld } from './systems/world.js';
import { LawAndHonorSystem } from './systems/law.js';
import { HuntingAndFishingSystem } from './systems/hunting.js';
import { CampSystem } from './systems/camp.js';
import { MinigamesSystem } from './systems/minigames.js';
import { JournalSystem } from './systems/journal.js';
import { MissionRunner } from './systems/mission-runner.js';

(() => {
  const E = My3D2dge;

  // Initialize Game instance
  const game = new E.Game({
    canvas: 'screen',
    res: 'ps1',
    view: 'threequarter',
    views: ['threequarter', 'iso', 'topdown', 'brawler'],
    input: 'DEFAULT'
  });

  // Systems
  const audio = new WesternAudio(game.audio);
  const world = new FrontierWorld(E, game);
  const combat = new CombatSystem(E, game, audio, game.particles);
  const deadeye = new DeadEyeSystem(audio);
  const horse = new HorseSystem(E, audio, 'thoroughbred');
  const law = new LawAndHonorSystem(E, audio);
  const hunting = new HuntingAndFishingSystem(E, audio, game.particles);
  const camp = new CampSystem(E, audio);
  const minigames = new MinigamesSystem(E, audio);
  const journal = new JournalSystem(E, audio);
  const missions = new MissionRunner(E, audio, combat, world, law);

  // Player Protagonist: Silas Vance
  const player = {
    name: 'Silas Vance',
    x: 230,
    y: 260,
    z: 0,
    vx: 0,
    vy: 0,
    facing: Math.PI / 2,
    speed: 75,
    mounted: false,
    
    // Vitality Cores & Outer Bars
    health: 100,
    maxHealth: 100,
    healthCore: 100,
    stamina: 100,
    maxStamina: 100,
    staminaCore: 100,
    deadeyeCore: 100,
    
    cash: 145,
    satchel: {
      provisions: 4,
      tonics: 3,
      gunOil: 2
    },

    // 3D Procedural Humanoid Rig
    rig: new E.Humanoid({
      size: 1.15,
      build: 'heroic',
      outfit: 'coat',
      weapon: 'gun',
      hat: { style: 'cowboy', color: '#382218' },
      colors: {
        cloth: '#2c3e50',
        coat: '#4e2d19',
        pants: '#1c2833',
        boot: '#17202a',
        belt: '#b7950b'
      }
    })
  };

  // Keyboard shortcut helpers
  let activeWeaponWheel = false;

  // Connect Dead Eye execution callback to Combat ballistics
  const onDeadEyeShoot = (tag) => {
    combat.fire([player.x, player.y, player.z + 10], [tag.wx, tag.wy], 'player', { deadEye: true });
    if (tag.target && tag.target.hp !== undefined) {
      const dmg = (tag.hitZone === 'head' ? 120 : 45);
      tag.target.hp -= dmg;
      if (tag.target.hp <= 0) {
        tag.target.dead = true;
        tag.target.hp = 0;
        game.particles.dust(tag.target.x, tag.target.y, 0, 8);
      }
    }
  };

  // Main Game Loop
  game.start({
    update(dt) {
      // Allow audio initialization on first user interaction
      if (game.input.anyPressed()) {
        audio.init();
        if (!audio.currentTrack) {
          audio.playMusic('exploration');
        }
      }

      // Handle Modals (Journal, Poker, Mission Browser)
      if (journal.isOpen) {
        if (game.input.pressed('left')) journal.prevPage();
        if (game.input.pressed('right')) journal.nextPage();
        if (game.input.pressed('cancel') || game.input.pressed('pause')) journal.toggle();
        return;
      }

      if (minigames.activeGame) {
        if (game.input.pressed('confirm')) minigames.pokerAction('check');
        if (game.input.pressed('attack')) minigames.pokerAction('raise');
        if (game.input.pressed('cancel')) minigames.pokerAction('fold');
        if (game.input.pressed('pause')) minigames.close();
        return;
      }

      if (missions.browserOpen) {
        if (game.input.pressed('up')) {
          missions.browserSelectedIndex = Math.max(0, missions.browserSelectedIndex - 1);
        }
        if (game.input.pressed('down')) {
          const list = missions.getFilteredMissions();
          missions.browserSelectedIndex = Math.min(list.length - 1, missions.browserSelectedIndex + 1);
        }
        if (game.input.pressed('confirm') || game.input.pressed('start')) {
          const list = missions.getFilteredMissions();
          missions.startMissionByIndex(list[missions.browserSelectedIndex] ? missions.allMissions.indexOf(list[missions.browserSelectedIndex]) : 0);
        }
        if (game.input.pressed('cancel') || game.input.pressed('pause')) {
          missions.toggleBrowser();
        }
        return;
      }

      // Global hotkeys
      // M: Mission Browser
      // J: Journal
      // Q: Dead Eye
      // E: Mount / Dismount
      // H: Whistle for horse
      // R: Reload
      // P: Saloon Poker
      // F: Fishing

      // Dead Eye Time Dilation
      const effectiveDt = dt * deadeye.dilation;

      // Update Systems
      world.update(effectiveDt);
      camp.update(effectiveDt);
      missions.update(effectiveDt, player);
      law.update(effectiveDt, player, combat);
      hunting.update(effectiveDt, player, combat);
      deadeye.update(dt, player, onDeadEyeShoot); // deadeye runs on real dt

      // Player Movement on Foot
      if (!player.mounted) {
        const move = game.input.move();
        const mx = move[0], my = move[1];
        const isSprinting = game.input.down('dash');

        if (Math.hypot(mx, my) > 0.1) {
          player.facing = Math.atan2(my, mx);
          const spd = (isSprinting && player.stamina > 5 ? player.speed * 1.6 : player.speed);
          player.vx = Math.cos(player.facing) * spd;
          player.vy = Math.sin(player.facing) * spd;
          player.x += player.vx * effectiveDt;
          player.y += player.vy * effectiveDt;

          if (isSprinting) {
            player.stamina = Math.max(0, player.stamina - 10 * effectiveDt);
          } else {
            player.stamina = Math.min(player.maxStamina, player.stamina + 8 * effectiveDt);
          }
        } else {
          player.vx = 0;
          player.vy = 0;
          player.stamina = Math.min(player.maxStamina, player.stamina + 16 * effectiveDt);
        }

        // Firing weapon
        if (game.input.pressed('attack')) {
          if (deadeye.active) {
            // Paint target in front
            const target = combat.enemies[0] || hunting.animals[0];
            if (target) {
              deadeye.addTag(target, [target.x, target.y, 10], 'head');
            }
          } else {
            const targetPos = [player.x + Math.cos(player.facing) * 150, player.y + Math.sin(player.facing) * 150];
            combat.fire([player.x, player.y, player.z + 10], targetPos, 'player');
          }
        }

        // Update player 3D rig
        player.rig.update(effectiveDt, {
          x: player.x, y: player.y, z: player.z,
          vx: player.vx, vy: player.vy,
          facing: player.facing,
          point: true
        });
      }

      // Horse update
      horse.update(effectiveDt, game.input, player, world.map);

      // Combat ballistics update
      combat.update(effectiveDt, player, world.map);

      // Camera Focus
      game.focus(player.x, player.y, player.z + 14);
    },

    draw(r) {
      // 1. World Sky, Terrain, Buildings, Train
      world.draw(r);

      // 2. Horse
      if (!player.mounted) {
        horse.draw(r);
      }

      // 3. Camp Members & Stew Pot
      camp.draw(r);

      // 4. Wildlife
      hunting.draw(r);

      // 5. Combat Foes & Bullets
      combat.draw(r);

      // 6. Player (if mounted, drawn on horse back)
      if (player.mounted) {
        horse.draw(r);
        r.actor(player.x, player.y, player.z, (g, ox, oy) => {
          player.rig.draw(g, ox, oy, r.view);
        });
      } else {
        r.actor(player.x, player.y, player.z, (g, ox, oy) => {
          player.rig.draw(g, ox, oy, r.view);
        });
      }

      // 7. Law & Witnesses
      law.draw(r);

      // 8. Missions HUD & Prompts
      missions.draw(r);

      // 9. Dead Eye Amber Vignette & 'X' Markers
      deadeye.draw(r, E.px);

      // 10. Modals: Journal, Poker
      journal.draw(r);
      minigames.draw(r);

      // 11. HUD: Cores, Minimap, Weapon Wheel, Money
      this._drawHUD(r);
    },

    _drawHUD(r) {
      const W = r.W, H = r.H;

      r.overlay(g => {
        // --- BOTTOM LEFT: CIRCULAR MINIMAP & CORES ---
        const mapX = 32, mapY = H - 32, mapR = 22;
        // Minimap disc
        E.px.disc(g, mapX, mapY, mapR + 2, '#1a1410');
        E.px.disc(g, mapX, mapY, mapR, '#3e4a3d'); // ground terrain color
        
        // Compass Cardinal Directions
        E.font.text(g, 'N', mapX - 2, mapY - mapR - 1, '#d4ac0d', { scale: 0.8 });

        // Player Blip
        E.px.dot(g, mapX, mapY, '#ffffff');

        // Horse Blip
        if (!player.mounted) {
          const hdx = (horse.x - player.x) * 0.15;
          const hdy = (horse.y - player.y) * 0.15;
          if (Math.hypot(hdx, hdy) < mapR - 2) {
            E.px.dot(g, mapX + hdx, mapY + hdy, '#eedaa2');
          }
        }

        // --- RDR2 THREE CORES (Health, Stamina, Dead Eye) ---
        // 1. Health Core (Heart)
        const coreX1 = mapX + 32, coreY = H - 18;
        E.px.disc(g, coreX1, coreY, 8, '#1b120c');
        E.px.disc(g, coreX1, coreY, 6, '#d93829'); // red heart core
        // Outer Health ring
        const hpPct = player.health / player.maxHealth;
        E.ui.bar(g, coreX1 - 8, coreY + 9, 16, 2, hpPct, '#e74c3c');

        // 2. Stamina Core (Lightning Bolt)
        const coreX2 = coreX1 + 22;
        E.px.disc(g, coreX2, coreY, 8, '#1b120c');
        E.px.disc(g, coreX2, coreY, 6, '#27ae60'); // green stamina core
        const stamPct = player.stamina / player.maxStamina;
        E.ui.bar(g, coreX2 - 8, coreY + 9, 16, 2, stamPct, '#2ecc71');

        // 3. Dead Eye Core (Eye)
        const coreX3 = coreX2 + 22;
        E.px.disc(g, coreX3, coreY, 8, '#1b120c');
        E.px.disc(g, coreX3, coreY, 6, '#d4ac0d'); // gold dead eye core
        const dePct = deadeye.meter / deadeye.maxMeter;
        E.ui.bar(g, coreX3 - 8, coreY + 9, 16, 2, dePct, '#f1c40f');

        // --- TOP RIGHT: EQUIPPED WEAPON & AMMO COUNTER ---
        const eq = combat.equipped;
        const mag = combat.ammoInMag[combat.equippedId] || 0;
        const pool = combat.ammoPouch[eq.ammoType] || 0;
        E.ui.box(g, W - 112, 6, 106, 24, { bg: '#1c140e', border: '#b7950b' });
        E.font.text(g, eq.name.toUpperCase(), W - 107, 10, '#f5b041', { scale: 0.85 });
        if (eq.ammoType) {
          E.font.text(g, `${mag} / ${pool}`, W - 107, 19, '#ffffff', { scale: 0.95 });
        } else {
          E.font.text(g, 'MELEE', W - 107, 19, '#bdc3c7', { scale: 0.85 });
        }

        // --- TOP LEFT: CASH & HONOR RANK ---
        E.font.text(g, `$${player.cash}.00`, 10, 8, '#2ecc71', { scale: 1.1, outline: '#151515' });
        E.font.text(g, law.honorRank, 10, 20, (law.honor >= 0 ? '#f4d03f' : '#e74c3c'), { scale: 0.85, outline: '#151515' });

        // --- BOTTOM RIGHT: CONTROLS HELP BAR ---
        E.ui.box(g, W - 148, H - 23, 142, 19, { bg: '#1c140e', border: '#5a3d28', alpha: 0.9 });
        E.font.text(g, '[M] Quests(153)  [J] Journal  [E] Horse', W - 144, H - 20, '#ffffff', {
          scale: 0.75
        });
        E.font.text(g, '[Q] Dead Eye   [P] Poker   [F] Fish', W - 144, H - 11, '#f5cba7', {
          scale: 0.75
        });
      });
    }
  });

  // Expose global controller for UI buttons & Touch
  window.RDR2Game = {
    game, player, combat, deadeye, horse, world, law, hunting, camp, minigames, journal, missions, audio,
    mount() {
      if (player.mounted) horse.dismount(player);
      else horse.mount(player);
    },
    whistle() { horse.whistle([player.x, player.y]); },
    deadeye() { deadeye.toggle(); },
    journal() { journal.toggle(); },
    missions() { missions.toggleBrowser(); },
    poker() { minigames.startPoker(); },
    reload() { combat.reload(); },
    shoot() {
      if (deadeye.active) {
        const target = combat.enemies[0] || hunting.animals[0];
        if (target) deadeye.addTag(target, [target.x, target.y, 10], 'head');
      } else {
        const targetPos = [player.x + Math.cos(player.facing) * 150, player.y + Math.sin(player.facing) * 150];
        combat.fire([player.x, player.y, player.z + 10], targetPos, 'player');
      }
    }
  };
})();
