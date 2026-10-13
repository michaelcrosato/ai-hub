/**
 * DEAD HORIZON: 1899 - Law, Bounty & Honor System
 * Witness mechanics, crimes, lawmen investigation radius, territory bounties,
 * pursuing bounty hunter posses, and -100 to +100 morality Honor meter.
 */

export class LawAndHonorSystem {
  constructor(engine, audio) {
    this.E = engine;
    this.audio = audio;

    // Honor Meter: -100 (Pure Dishonor) to +100 (Pure High Honor)
    this.honor = 15;
    this.honorRank = 'Honorable Outlaw';

    // Wanted state
    this.wanted = false;
    this.wantedTitle = 'WANTED'; // 'INVESTIGATING', 'WANTED', 'DEAD OR ALIVE'
    this.currentCrime = '';
    this.wantedTimer = 0;
    this.searchRadius = 80;

    // Territory Bounties
    this.bounties = {
      new_hanover: 0,
      lemoyne: 0,
      west_elizabeth: 0,
      ambarino: 0,
      new_austin: 0
    };

    // Active witnesses running to report crimes
    this.witnesses = [];

    // Bounty hunter posse tracker
    this.posseTimer = 45; // checks every 45s if bounty > $50
    this.activePosse = [];
  }

  get storeDiscount() {
    // High honor gives up to 50% discount at general stores and gunsmiths
    if (this.honor >= 80) return 0.50;
    if (this.honor >= 50) return 0.25;
    if (this.honor >= 25) return 0.10;
    return 0.0;
  }

  changeHonor(amount, reason = '') {
    const oldHonor = this.honor;
    this.honor = Math.max(-100, Math.min(100, this.honor + amount));
    
    if (this.honor >= 60) this.honorRank = 'Righteous Hero';
    else if (this.honor >= 20) this.honorRank = 'Honorable Outlaw';
    else if (this.honor >= -20) this.honorRank = 'Conflicted Drifter';
    else if (this.honor >= -60) this.honorRank = 'Cold-Blooded Bandit';
    else this.honorRank = 'Desperado (Black Hat)';

    if (this.audio) {
      if (amount > 0) this.audio.playSfx('coin', { vol: 0.5 });
      else this.audio.playSfx('hurt', { vol: 0.4 });
    }
  }

  reportCrime(crimeType, playerPos, territory = 'new_hanover') {
    const crimeCosts = {
      'Disturbing the Peace': { bounty: 5, honor: -2 },
      'Theft': { bounty: 15, honor: -5 },
      'Horse Theft': { bounty: 20, honor: -10 },
      'Assault': { bounty: 25, honor: -10 },
      'Murder': { bounty: 60, honor: -25 },
      'Train Robbery': { bounty: 120, honor: -30 },
      'Bank Robbery': { bounty: 250, honor: -40 }
    };

    const c = crimeCosts[crimeType] || { bounty: 10, honor: -5 };
    this.currentCrime = crimeType;
    this.changeHonor(c.honor, crimeType);

    // Spawn a witness fleeing toward town
    this.witnesses.push({
      x: playerPos[0] + (Math.random() - 0.5) * 40,
      y: playerPos[1] + (Math.random() - 0.5) * 40,
      targetX: 330, targetY: 190, // Sheriff office
      crime: crimeType,
      bountyValue: c.bounty,
      territory,
      timer: 8.0 // 8 seconds to silence or bribe witness
    });

    if (this.audio) this.audio.playSfx('ricochet', { vol: 0.5 });
  }

  silenceWitness(witnessIndex) {
    if (witnessIndex >= 0 && witnessIndex < this.witnesses.length) {
      this.witnesses.splice(witnessIndex, 1);
    }
  }

  payBounty(territory) {
    const cost = this.bounties[territory] || 0;
    this.bounties[territory] = 0;
    this.wanted = false;
    this.wantedTimer = 0;
    if (this.audio) this.audio.playSfx('cash_register');
    return cost;
  }

  update(dt, player, combatSystem) {
    // Process fleeing witnesses
    for (let i = this.witnesses.length - 1; i >= 0; i--) {
      const w = this.witnesses[i];
      w.timer -= dt;
      const dx = w.targetX - w.x;
      const dy = w.targetY - w.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        w.x += (dx / dist) * 65 * dt;
        w.y += (dy / dist) * 65 * dt;
      }

      if (w.timer <= 0 || dist <= 10) {
        // Witness reached lawmen! Trigger wanted level
        this.wanted = true;
        this.wantedTitle = 'WANTED: ' + w.crime.toUpperCase();
        this.wantedTimer = 35; // 35 seconds to lose wanted status
        this.bounties[w.territory] = (this.bounties[w.territory] || 0) + w.bountyValue;

        // Spawn 3 investigating lawmen
        if (combatSystem) {
          combatSystem.spawnEnemy({ name: 'Sheriff Deputy', faction: 'law', x: 330, y: 190, hp: 60 });
          combatSystem.spawnEnemy({ name: 'Town Marshal', faction: 'law', x: 340, y: 180, hp: 75 });
        }

        this.witnesses.splice(i, 1);
      }
    }

    // Wanted cooldown countdown
    if (this.wanted) {
      this.wantedTimer -= dt;
      if (this.wantedTimer <= 0) {
        this.wanted = false;
        this.wantedTitle = '';
      }
    }
  }

  draw(r) {
    const W = r.W;

    // Draw active witnesses (red eye icon above their heads)
    for (const w of this.witnesses) {
      const [sx, sy] = r.w(w.x, w.y, 16);
      if (r.visible(w.x, w.y, 16)) {
        r.overlay(g => {
          // Witness Eye Icon
          this.E.px.disc(g, sx, sy - 8, 4, '#d93829');
          this.E.px.dot(g, sx, sy - 8, '#ffffff');
          this.E.font.text(g, 'WITNESS', sx, sy - 18, '#ff3030', {
            outline: '#000000',
            align: 'center',
            scale: 1
          });
        });
      }
    }

    // Draw Wanted Header Banner
    if (this.wanted) {
      r.overlay(g => {
        // Red Western Parchment Banner
        this.E.ui.box(g, W / 2 - 90, 8, 180, 22, {
          bg: '#7b1812',
          border: '#e8be48'
        });
        this.E.font.text(g, this.wantedTitle, W / 2, 13, '#ffffff', {
          outline: '#200505',
          align: 'center',
          scale: 1.1
        });
      });
    }
  }
}
