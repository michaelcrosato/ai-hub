/**
 * DEAD HORIZON: 1899 - Horse Bonding & Riding System
 * Quadruped movement physics, mounting, whistling, feeding, grooming,
 * and 4 progressive bonding levels.
 */

export class HorseSystem {
  constructor(engine, audio, initialBreed = 'thoroughbred') {
    this.E = engine;
    this.audio = audio;
    this.breed = initialBreed;
    this.x = 240;
    this.y = 280;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 0;
    this.speed = 0;
    this.maxSpeed = 160;
    
    // Cores and meters
    this.health = 100;
    this.maxHealth = 100;
    this.healthCore = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.staminaCore = 100;

    // Bonding: Levels 1 to 4
    this.bondingPoints = 220; // Starts at Level 2
    this.bondedLevel = 2;

    // State
    this.mounted = false;
    this.rearing = false;
    this.rearingTimer = 0;
    this.agitated = false;
    this.whistleTarget = null;
    this.saddleStow = {
      longarmPrimary: 'carbine_repeater',
      longarmSecondary: 'hunting_bow',
      pelt: 'Pristine Whitetail Buck Pelt',
      carcass: null
    };

    // Instantiate procedural 3D rig from engine
    this.rig = new this.E.WesternHorse({ breed: this.breed });
  }

  getBondingLevel() {
    if (this.bondingPoints >= 800) return 4;
    if (this.bondingPoints >= 450) return 3;
    if (this.bondingPoints >= 150) return 2;
    return 1;
  }

  addBonding(points) {
    this.bondingPoints = Math.min(1000, this.bondingPoints + points);
    const newLvl = this.getBondingLevel();
    if (newLvl > this.bondedLevel) {
      this.bondedLevel = newLvl;
      if (this.audio) this.audio.playSfx('cash_register', { vol: 0.8 });
      return true; // Leveled up
    }
    return false;
  }

  whistle(playerPos) {
    if (this.mounted) return;
    if (this.audio) {
      this.audio.playSfx('whistle_call');
      setTimeout(() => this.audio.playSfx('horse_whinny', { vol: 0.5 }), 300);
    }
    this.whistleTarget = [playerPos[0] + 15, playerPos[1] + 10];
  }

  feed(item = 'apple') {
    this.stamina = Math.min(this.maxStamina, this.stamina + 40);
    this.staminaCore = Math.min(100, this.staminaCore + 30);
    this.healthCore = Math.min(100, this.healthCore + 25);
    this.agitated = false;
    this.addBonding(25);
    if (this.audio) this.audio.playSfx('coin');
  }

  brush() {
    this.staminaCore = Math.min(100, this.staminaCore + 15);
    this.agitated = false;
    this.addBonding(15);
    if (this.audio) this.audio.playSfx('punch', { vol: 0.2 });
  }

  calm() {
    this.agitated = false;
    this.stamina = Math.min(this.maxStamina, this.stamina + 20);
    this.addBonding(10);
    if (this.audio) this.audio.playSfx('horse_whinny', { vol: 0.3 });
  }

  rear() {
    if (this.rearing || this.bondedLevel < 2) return;
    this.rearing = true;
    this.rearingTimer = 1.0;
    if (this.audio) this.audio.playSfx('horse_whinny', { vol: 0.8 });
  }

  mount(player) {
    this.mounted = true;
    this.whistleTarget = null;
    player.mounted = true;
    this.x = player.x;
    this.y = player.y;
    if (this.audio) this.audio.playSfx('punch', { vol: 0.3 });
  }

  dismount(player) {
    this.mounted = false;
    player.mounted = false;
    // place player slightly beside horse
    player.x = this.x + Math.sin(this.facing) * 12;
    player.y = this.y - Math.cos(this.facing) * 12;
    player.z = 0;
    this.vx = 0;
    this.vy = 0;
    if (this.audio) this.audio.playSfx('punch', { vol: 0.2 });
  }

  update(dt, input, player, map) {
    // Rearing animation countdown
    if (this.rearing) {
      this.rearingTimer -= dt;
      if (this.rearingTimer <= 0) {
        this.rearing = false;
      }
    }

    if (this.mounted) {
      // Player controls the horse
      const move = input.move(); // [dx, dy] on screen
      const mx = move[0], my = move[1];
      const isSprinting = input.down('dash');
      
      let targetSpeed = 0;
      if (Math.hypot(mx, my) > 0.1) {
        // Turn facing toward move direction
        const ang = Math.atan2(my, mx);
        this.facing = this.E.approachAng(this.facing, ang, dt * 6);

        if (isSprinting && this.stamina > 5) {
          targetSpeed = this.maxSpeed * (1 + (this.bondedLevel - 1) * 0.1);
          this.stamina -= (this.bondedLevel === 4 ? 6 : 12) * dt;
        } else {
          targetSpeed = 75; // Trot
          this.stamina = Math.min(this.maxStamina, this.stamina + 6 * dt);
        }

        // Gallop audio rhythm
        if (Math.random() < dt * (isSprinting ? 4.5 : 2.5)) {
          if (this.audio) this.audio.playSfx('horse_gallop', { vol: 0.4 });
        }
      } else {
        // Natural resting recovery
        this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt);
        if (input.pressed('jump')) {
          this.rear();
        }
      }

      this.speed = this.E.lerp(this.speed, targetSpeed, Math.min(1, dt * 7));
      this.vx = Math.cos(this.facing) * this.speed;
      this.vy = Math.sin(this.facing) * this.speed;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Keep player locked onto horse rider point
      const offset = this.rig.riderOffset();
      player.x = this.x + offset[0];
      player.y = this.y + offset[1];
      player.z = offset[2];
      player.facing = this.facing;

    } else if (this.whistleTarget) {
      // Auto-gallop toward whistle caller
      const dx = this.whistleTarget[0] - this.x;
      const dy = this.whistleTarget[1] - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 18) {
        this.facing = Math.atan2(dy, dx);
        this.speed = this.E.lerp(this.speed, 95, Math.min(1, dt * 8));
        this.vx = Math.cos(this.facing) * this.speed;
        this.vy = Math.sin(this.facing) * this.speed;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else {
        this.speed = this.E.lerp(this.speed, 0, Math.min(1, dt * 10));
        this.whistleTarget = null;
      }
    } else {
      // Idle grazing or standing
      this.speed = this.E.lerp(this.speed, 0, Math.min(1, dt * 8));
      this.vx = 0;
      this.vy = 0;
    }

    // Update 3D procedural rig
    this.rig.update(dt, {
      vx: this.vx,
      vy: this.vy,
      facing: this.facing,
      rearing: this.rearing
    });
  }

  draw(r) {
    r.actor(this.x, this.y, this.z, (g, ox, oy) => {
      this.rig.draw(g, ox, oy, r.view);
    });
  }
}
