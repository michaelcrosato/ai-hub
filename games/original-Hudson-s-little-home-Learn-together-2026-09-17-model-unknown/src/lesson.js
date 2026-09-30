/**
 * lesson.js — the one-minute lesson clock and the grown-up PIN gate.
 */

/**
 * One object stays on screen for a minute. After 30 seconds the lesson offers
 * its second page ("sentence"), and at the end it says "ready" so the child can
 * go back to the room. Time only moves while play is active.
 */
export class LessonTimer {
  constructor(duration = 60) {
    this.duration = duration;
    this.elapsed = 0;
    this.stage = 0;
    this.paused = false;
  }

  /** Move the clock on by `seconds`; returns the events crossed: 'sentence', 'ready'. */
  advance(seconds) {
    if (this.paused || !Number.isFinite(seconds) || seconds < 0) return [];
    const events = [];
    const before = this.elapsed;
    this.elapsed = Math.min(this.duration, Math.round((this.elapsed + seconds) * 1e9) / 1e9);
    if (before < 30 && this.elapsed >= 30) {
      this.stage = 1;
      events.push('sentence');
    }
    if (before < this.duration && this.elapsed >= this.duration) {
      this.stage = 2;
      events.push('ready');
    }
    return events;
  }

  get remaining() {
    return Math.max(0, Math.ceil(this.duration - this.elapsed));
  }

  get ready() {
    return this.elapsed >= this.duration;
  }

  get progress() {
    return this.elapsed / this.duration;
  }
}

export const PIN_CHOICES = ['1234', '1111'];

/** Checks the four-digit PIN; five misses in a row lock it for 15 seconds. */
export class PinGate {
  constructor(pin = '1234') {
    this.setPin(pin);
    this.failures = 0;
    this.blockedUntil = 0;
  }

  setPin(pin) {
    if (!PIN_CHOICES.includes(pin)) throw new Error('Choose 1111 or 1234.');
    this.pin = pin;
  }

  check(entry, now = Date.now()) {
    if (now < this.blockedUntil) return { ok: false, wait: Math.ceil((this.blockedUntil - now) / 1000) };
    if (/^\d{4}$/.test(entry) && entry === this.pin) {
      this.failures = 0;
      return { ok: true, wait: 0 };
    }
    this.failures += 1;
    if (this.failures >= 5) {
      this.failures = 0;
      this.blockedUntil = now + 15000;
    }
    return { ok: false, wait: Math.max(0, Math.ceil((this.blockedUntil - now) / 1000)) };
  }
}
