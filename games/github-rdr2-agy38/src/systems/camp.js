/**
 * DEAD HORIZON: 1899 - Camp Life, Chores & Gang Upgrades
 * Living gang camp with Dutch/Julian, Hosea/Finch, Sadie/Sarah, Pearson/Cookie,
 * camp chores (chopping wood, hauling water), daily stew pot, and donation ledger.
 */

import { CAMP_UPGRADES } from '../data/compendium.js';

export class CampSystem {
  constructor(engine, audio) {
    this.E = engine;
    this.audio = audio;

    // Camp funds & morale
    this.funds = 145;
    this.provisions = 80; // 0..100
    this.medicine = 75;
    this.ammo = 85;

    // Purchased ledger upgrades
    this.purchasedUpgrades = new Set(['ledger']);

    // Camp chores
    this.choresCompleted = 0;
    this.choreActive = false;
    this.choreType = null; // 'wood', 'water', 'hay'
    this.choreTimer = 0;

    // Daily stew pot status
    this.ateStewToday = false;

    // Gang members around camp
    this.members = [
      { id: 'julian', name: 'Julian Sterling', title: 'The Prophet', x: 120, y: 310, quote: "'One more big score, Silas! Then we are buying land in Tahiti!'", rig: new this.E.Humanoid({ hat: { style: 'cowboy', color: '#161616' }, colors: { cloth: '#1a252f', coat: '#11171d' } }) },
      { id: 'finch', name: 'Josiah Finch', title: 'The Old Mentor', x: 145, y: 325, quote: "'I've known Julian twenty years. But lately, I don't know who is looking back in his eyes.'", rig: new this.E.Humanoid({ hat: { style: 'bowler', color: '#33271d' }, colors: { cloth: '#4a3b32', coat: '#33271d' } }) },
      { id: 'sarah', name: 'Sarah Cross', title: 'The Widow', x: 110, y: 335, quote: "'They killed my Jake. I won't stop till every one of them is in the ground.'", rig: new this.E.Humanoid({ hat: { style: 'cowboy', color: '#9a7d0a' }, colors: { cloth: '#d4ac0d', pants: '#2980b9' } }) },
      { id: 'cookie', name: 'Cookie Potts', title: 'Camp Cook', x: 135, y: 345, quote: "'Get yourself a hot bowl of venison stew, Silas! Put some lead in your pencil!'", rig: new this.E.Humanoid({ build: 'bulky', outfit: 'shirt', colors: { cloth: '#eaeded', pants: '#5d6d7e' } }) },
      { id: 'jack', name: 'Jack Caldwell', title: 'Brother-in-Arms', x: 160, y: 315, quote: "'Alma wants me to take the boy and run. Maybe she's right.'", rig: new this.E.Humanoid({ hat: { style: 'cowboy', color: '#4a2c16' }, colors: { cloth: '#5d4037', pants: '#212f3d' } }) }
    ];
  }

  eatStew(player) {
    if (this.ateStewToday) return false;
    this.ateStewToday = true;
    player.health = 100;
    player.healthCore = 100;
    player.staminaCore = 100;
    player.deadeyeCore = 100;
    if (this.audio) this.audio.playSfx('coin', { vol: 0.6 });
    return true;
  }

  donateToCamp(amount, lawAndHonor) {
    this.funds += amount;
    if (lawAndHonor) {
      lawAndHonor.changeHonor(Math.round(amount / 5), 'Camp Donation');
    }
    if (this.audio) this.audio.playSfx('cash_register');
  }

  buyUpgrade(upgradeId) {
    const up = CAMP_UPGRADES.find(u => u.id === upgradeId);
    if (!up || this.purchasedUpgrades.has(upgradeId)) return false;
    if (this.funds < up.cost) return false;

    this.funds -= up.cost;
    this.purchasedUpgrades.add(upgradeId);
    if (this.audio) this.audio.playSfx('cash_register', { vol: 1.0 });
    return true;
  }

  startChore(type = 'wood') {
    this.choreActive = true;
    this.choreType = type;
    this.choreTimer = 1.0;
  }

  finishChore(lawAndHonor) {
    this.choreActive = false;
    this.choresCompleted++;
    if (lawAndHonor) {
      lawAndHonor.changeHonor(5, 'Camp Chore Completed');
    }
    if (this.audio) this.audio.playSfx('coin');
  }

  update(dt) {
    // Idle animations for camp members
    for (const m of this.members) {
      m.rig.update(dt, {
        x: m.x, y: m.y, z: 0,
        vx: 0, vy: 0,
        facing: Math.PI / 2
      });
    }
  }

  draw(r) {
    // Draw Camp Members
    for (const m of this.members) {
      r.actor(m.x, m.y, 0, (g, ox, oy) => {
        m.rig.draw(g, ox, oy, r.view);
      });

      // Name & Quote floating above
      const [sx, sy] = r.w(m.x, m.y, 24);
      if (r.visible(m.x, m.y, 24) && !(sy > r.H - 55 && sx < 115)) {
        r.overlay(g => {
          this.E.font.text(g, m.name, sx, sy - 8, '#f4d03f', {
            outline: '#100a08',
            align: 'center',
            scale: 0.9
          });
        });
      }
    }

    // Draw Stew Pot at center of camp
    r.actor(135, 335, 0, (g, ox, oy) => {
      // Iron cauldron on campfire
      this.E.px.disc(g, ox, oy - 4, 7, '#1b1b1b');
      this.E.px.disc(g, ox, oy - 4, 5, '#873600'); // bubbling brown stew
      // Fire embers below
      this.E.px.rect(g, ox - 5, oy, 10, 3, '#d35400');
    });
  }
}
