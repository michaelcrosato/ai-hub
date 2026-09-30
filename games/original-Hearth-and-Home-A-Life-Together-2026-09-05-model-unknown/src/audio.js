/**
 * audio.js — the soft original melody and the activity chimes.
 *
 * One AudioContext, created and resumed on the player's first gesture
 * (unlockAudio). Nothing is scheduled while the context is still locked, so
 * notes never pile up and burst out together when it unlocks, and the melody
 * rests while the game is paused or the tab is hidden.
 */
let ctx = null, master = null, musicBus = null, sfxBus = null;
let musicOn = false, paused = false, timer = 0, step = 0;

function context() {
    if (ctx)
        return ctx;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A)
        return null;
    try {
        ctx = new A();
    }
    catch {
        return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    return ctx;
}
/** Call from a user gesture (pointer, key, gamepad button). Cheap once running. */
export function unlockAudio() {
    if (ctx?.state === 'running')
        return;
    const c = context();
    if (c && c.state !== 'running')
        c.resume().catch(() => { });
}
const running = () => !!ctx && ctx.state === 'running';

function tone(bus, freq, dur, vol, { type = 'sine', at = 0, attack = 0.025 } = {}) {
    if (!running())
        return;
    try {
        const t = ctx.currentTime + at;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + dur + 0.05);
    }
    catch { }
}

// [frequency, duration, volume, delay]
const CUES = {
    good: [[523.25, 0.23, 0.035], [659.25, 0.3, 0.025, 0.1]],
    bad: [[293.66, 0.23, 0.035]],
    story: [[392, 0.3, 0.03], [493.88, 0.3, 0.026, 0.09], [587.33, 0.45, 0.024, 0.18]],
    buy: [[523.25, 0.2, 0.03], [783.99, 0.35, 0.025, 0.08]],
    page: [[659.25, 0.35, 0.026], [523.25, 0.4, 0.024, 0.12], [392, 0.7, 0.022, 0.24]],
    wish: [[523.25, 0.3, 0.03], [659.25, 0.3, 0.028, 0.1], [783.99, 0.3, 0.026, 0.2], [1046.5, 0.7, 0.022, 0.3]],
};
/** A short chime: 'good' | 'bad' | 'story' | 'buy' | 'page' | 'wish' (true/false mean good/bad). */
export function playCue(enabled, kind = 'good') {
    if (!enabled)
        return;
    const list = CUES[kind === true ? 'good' : kind === false ? 'bad' : kind] || CUES.good;
    for (const [f, d, v, at = 0] of list)
        tone(sfxBus, f, d, v, { at });
}

// The game's original melody, with a soft low note under each bar.
const TUNE = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 261.63, 329.63, 392, 523.25, 440, 349.23, 329.63, 293.66];
const BASS = [130.81, 146.83, 130.81, 174.61];
function beat() {
    if (!musicOn || paused || document.hidden || !running())
        return;
    const i = step++ % TUNE.length;
    tone(musicBus, TUNE[i], 1.15, 0.023);
    if (i % 4 === 0)
        tone(musicBus, BASS[(i / 4) % BASS.length], 4.2, 0.014, { type: 'triangle', attack: 0.35 });
}
export function setMusic(on) {
    if (musicOn === !!on)
        return;
    musicOn = !!on;
    clearInterval(timer);
    timer = 0;
    if (musicOn) {
        beat();
        timer = setInterval(beat, 1100);
    }
}
/** The kit's settings panel pauses the game: the melody rests too. */
export function setAudioPaused(p) { paused = !!p; }
