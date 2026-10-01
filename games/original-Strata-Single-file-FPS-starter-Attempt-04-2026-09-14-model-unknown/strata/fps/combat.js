/** Optional FPS rules. No rendering, physics, DOM, AI, or campaign dependency. */
function positive(value, name, zero = false) {
    if (!Number.isFinite(value) || (zero ? value < 0 : value <= 0))
        throw new Error(`Invalid ${name}.`);
    return value;
}
export class Vitals {
    maxHealth;
    maxArmor;
    health;
    armor = 0;
    grace = 0;
    constructor(maxHealth = 100, maxArmor = 100) {
        this.maxHealth = maxHealth;
        this.maxArmor = maxArmor;
        this.health = positive(maxHealth, 'maximum health');
        positive(maxArmor, 'maximum armor', true);
    }
    get alive() { return this.health > 0; }
    tick(dt) { this.grace = Math.max(0, this.grace - positive(dt, 'delta', true)); }
    damage(amount, graceSeconds = 0) {
        positive(amount, 'damage', true);
        positive(graceSeconds, 'damage grace', true);
        if (!this.alive || this.grace > 0 || amount === 0)
            return { healthLost: 0, armorLost: 0, killed: false };
        const armorLost = Math.min(this.armor, amount * .6), healthLost = Math.min(this.health, amount - armorLost);
        this.armor -= armorLost;
        this.health -= healthLost;
        this.grace = graceSeconds;
        return { armorLost, healthLost, killed: !this.alive };
    }
    heal(amount) { positive(amount, 'healing', true); if (this.alive)
        this.health = Math.min(this.maxHealth, this.health + amount); }
    reset() { this.health = this.maxHealth; this.armor = 0; this.grace = 0; }
    restore(raw) {
        positive(raw.health, 'health', true);
        positive(raw.armor, 'armor', true);
        if (raw.health > this.maxHealth || raw.armor > this.maxArmor)
            throw new Error('Vitals exceed their limits.');
        this.health = raw.health;
        this.armor = raw.armor;
        this.grace = 0;
    }
}
export const rifleSpec = { capacity: 12, reserve: 60, interval: .16, reloadTime: 1.25, damage: 34, range: 70, automatic: true };
export class Weapon {
    spec;
    ammo;
    reserve;
    cooldown = 0;
    reloadLeft = 0;
    constructor(spec = rifleSpec) {
        for (const key of ['capacity', 'reserve'])
            if (!Number.isSafeInteger(spec[key]) || spec[key] < (key === 'capacity' ? 1 : 0))
                throw new Error(`Invalid ${key}.`);
        for (const key of ['interval', 'reloadTime', 'damage', 'range'])
            positive(spec[key], key);
        if (typeof spec.automatic !== 'boolean')
            throw new Error('Invalid fire mode.');
        this.spec = Object.freeze({ ...spec });
        this.ammo = spec.capacity;
        this.reserve = spec.reserve;
    }
    get reloading() { return this.reloadLeft > 0; }
    get reloadProgress() { return this.reloading ? 1 - this.reloadLeft / this.spec.reloadTime : 0; }
    tick(dt) {
        positive(dt, 'delta', true);
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.reloadLeft > 0) {
            this.reloadLeft = Math.max(0, this.reloadLeft - dt);
            if (this.reloadLeft < 1e-9)
                this.reloadLeft = 0;
            if (this.reloadLeft === 0) {
                const count = Math.min(this.spec.capacity - this.ammo, this.reserve);
                this.ammo += count;
                this.reserve -= count;
            }
        }
    }
    fire(pressed, held) {
        if (!(pressed || this.spec.automatic && held) || this.cooldown > 1e-9 || this.reloading || this.ammo <= 0)
            return false;
        this.ammo--;
        this.cooldown = this.spec.interval;
        return true;
    }
    reload() {
        if (this.reloading || this.ammo === this.spec.capacity || this.reserve === 0)
            return false;
        this.reloadLeft = this.spec.reloadTime;
        return true;
    }
    cancelReload() { this.reloadLeft = 0; }
    reset() { this.ammo = this.spec.capacity; this.reserve = this.spec.reserve; this.cooldown = this.reloadLeft = 0; }
    restore(raw) {
        if (!Number.isSafeInteger(raw.ammo) || raw.ammo < 0 || raw.ammo > this.spec.capacity || !Number.isSafeInteger(raw.reserve) || raw.reserve < 0 || raw.reserve > 100000)
            throw new Error('Invalid weapon save.');
        this.ammo = raw.ammo;
        this.reserve = raw.reserve;
        this.cooldown = this.reloadLeft = 0;
    }
}
