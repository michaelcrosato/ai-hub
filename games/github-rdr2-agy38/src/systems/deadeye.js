/**
 * DEAD HORIZON: 1899 - Dead Eye Targeting System
 * Real-time time dilation (0.2x speed), amber chromatic filter,
 * target tagging ('X' crosshairs on fatal hitboxes), and rapid execution barrage.
 */

export class DeadEyeSystem {
  constructor(audio) {
    this.audio = audio;
    this.active = false;
    this.meter = 100;       // outer ring (current energy)
    this.maxMeter = 100;
    this.core = 100;        // inner core (drain / recharge baseline)
    this.level = 3;         // Dead Eye Level 3: Manual multi-tag painting
    this.dilation = 1.0;
    this.paintedTargets = [];
    this.executing = false;
    this.execTimer = 0;
    this.execInterval = 0.09; // rapid-fire trigger fanning
    this.execIndex = 0;
    this.flash = 0;
  }

  toggle() {
    if (this.active) {
      this.deactivate(true);
    } else {
      this.activate();
    }
  }

  activate() {
    if (this.active || this.meter < 10 || this.executing) return;
    this.active = true;
    this.dilation = 0.2;
    this.paintedTargets = [];
    if (this.audio) this.audio.playSfx('deadeye_enter');
  }

  deactivate(triggerExecution = true) {
    if (!this.active) return;
    this.active = false;
    this.dilation = 1.0;
    if (this.audio) this.audio.playSfx('deadeye_exit');

    if (triggerExecution && this.paintedTargets.length > 0) {
      this.startExecution();
    } else {
      this.paintedTargets = [];
    }
  }

  addTag(target, hitPos, hitZone = 'head') {
    if (!this.active || this.executing) return false;
    if (this.paintedTargets.length >= 8) return false;

    // Check if duplicate tag on same zone
    const exists = this.paintedTargets.some(t => t.target === target && t.hitZone === hitZone);
    if (exists) return false;

    this.paintedTargets.push({
      target,
      hitZone,
      wx: hitPos[0],
      wy: hitPos[1],
      wz: hitPos[2] || 10,
      t: 0
    });

    // Small meter cost per painted target
    this.meter = Math.max(0, this.meter - 8);
    if (this.audio) this.audio.playSfx('deadeye_tag');

    if (this.meter <= 0) {
      this.deactivate(true);
    }
    return true;
  }

  startExecution() {
    this.executing = true;
    this.execIndex = 0;
    this.execTimer = 0;
  }

  update(dt, player, onShootTarget) {
    // Meter drain while active
    if (this.active) {
      const drainRate = 18; // drain over ~5.5 seconds
      this.meter -= drainRate * dt;
      if (this.meter <= 0) {
        this.meter = 0;
        this.deactivate(true);
      }
    }

    // Core passive drain & natural slow recovery
    if (!this.active && !this.executing) {
      if (this.meter < this.maxMeter) {
        const regenRate = 4 * (this.core / 100);
        this.meter = Math.min(this.maxMeter, this.meter + regenRate * dt);
      }
    }

    // Execution barrage sequence
    if (this.executing) {
      this.execTimer += dt;
      if (this.execTimer >= this.execInterval) {
        this.execTimer = 0;
        if (this.execIndex < this.paintedTargets.length) {
          const tag = this.paintedTargets[this.execIndex];
          if (onShootTarget) {
            onShootTarget(tag);
          }
          if (this.audio) {
            this.audio.playSfx('gunshot_revolver', { vol: 1.0 });
            this.audio.playSfx('ricochet', { vol: 0.6 });
          }
          this.execIndex++;
        } else {
          // Finished execution
          this.executing = false;
          this.paintedTargets = [];
        }
      }
    }
  }

  replenish(amount) {
    this.meter = Math.min(this.maxMeter, this.meter + amount);
    this.core = Math.min(100, this.core + amount * 0.5);
  }

  draw(r, pxHelper) {
    const W = r.W, H = r.H;

    // Amber vignette when Dead Eye is active
    if (this.active) {
      r.overlay(g => {
        // Red/amber gradient edge
        const grad = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
        grad.addColorStop(0, 'rgba(235, 175, 45, 0.08)');
        grad.addColorStop(0.65, 'rgba(195, 75, 20, 0.22)');
        grad.addColorStop(1, 'rgba(120, 15, 10, 0.65)');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
      });
    }

    // Draw painted target Xs
    for (let i = 0; i < this.paintedTargets.length; i++) {
      const tag = this.paintedTargets[i];
      const [sx, sy] = r.w(tag.wx, tag.wy, tag.wz);
      if (sx >= -20 && sx <= W + 20 && sy >= -20 && sy <= H + 20) {
        r.overlay(g => {
          const color = (tag.hitZone === 'head' ? '#ff2a2a' : '#ff992a');
          const sz = (tag.hitZone === 'head' ? 5 : 4);
          // Red crosshair 'X'
          pxHelper.line(g, sx - sz, sy - sz, sx + sz, sy + sz, color, 2);
          pxHelper.line(g, sx - sz, sy + sz, sx + sz, sy - sz, color, 2);
          // Target order number dot
          pxHelper.disc(g, sx, sy, 2, '#ffffff');
        });
      }
    }
  }
}
