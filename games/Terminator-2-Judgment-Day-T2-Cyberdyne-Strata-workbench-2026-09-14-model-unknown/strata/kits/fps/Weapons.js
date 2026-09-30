export const WEAPONS = {
  rifle: { name: 'AR-24 / Service rifle', capacity: 24, damage: 26, interval: 0.12, reload: 1.5, automatic: true, range: 90 },
  pistol: { name: 'P-12 / Sidearm', capacity: 12, damage: 40, interval: 0.3, reload: 1.05, automatic: false, range: 70 },
};
export class Weapons {
  cooldown = 0;
  reloadRemaining = 0;
  recoil = 0;
  flash = 0;
  constructor(state, shoot, sound) {
    this.state = state;
    this.shoot = shoot;
    this.sound = sound;
  }
  get id() {
    return this.state.player.weapon;
  }
  get spec() {
    return WEAPONS[this.id];
  }
  get ammo() {
    return this.state.player.ammo[this.id];
  }
  select(id) {
    if (id === this.id || !WEAPONS[id] || !this.state.player.inventory.includes(id)) return;
    this.state.player.weapon = id;
    this.reloadRemaining = 0;
    this.cooldown = 0.18;
  }
  reload() {
    if (this.reloadRemaining || this.ammo.mag === this.spec.capacity || !this.ammo.reserve) return false;
    this.reloadRemaining = this.spec.reload;
    this.sound('reload');
    return true;
  }
  fire() {
    if (this.cooldown > 0 || this.reloadRemaining > 0) return false;
    if (!this.ammo.mag) {
      this.cooldown = 0.3;
      this.sound('empty');
      this.reload();
      return false;
    }
    this.ammo.mag--;
    this.cooldown = this.spec.interval;
    this.flash = 0.07;
    this.recoil = Math.min(0.12, this.recoil + 0.05);
    this.state.stats.shots++;
    this.sound('shot');
    this.shoot(this.spec);
    return true;
  }
  update(dt, input) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.recoil *= Math.exp(-13 * dt);
    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      if (!this.reloadRemaining) {
        const count = Math.min(this.spec.capacity - this.ammo.mag, this.ammo.reserve);
        this.ammo.mag += count;
        this.ammo.reserve -= count;
        this.sound('reload');
      }
    }
    if (input.consume('weapon1')) this.select('rifle');
    if (input.consume('weapon2')) this.select('pistol');
    if (input.consume('swap')) this.select(this.id === 'rifle' ? 'pistol' : 'rifle');
    if (input.consume('reload')) this.reload();
    const pressed = input.consume('fire');
    if (this.spec.automatic ? input.down('fire') : pressed) this.fire();
  }
}
