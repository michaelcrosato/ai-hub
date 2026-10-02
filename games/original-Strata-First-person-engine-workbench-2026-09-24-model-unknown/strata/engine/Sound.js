/**
 * Small synthesized cues for the play test (no audio files). The context starts on the
 * first key, click or tap, follows the kit's pause, and the mute choice is remembered.
 */
const KEY = 'strata.fpw.v1.muted';

export class Sound {
    ctx = null;
    master = null;
    noise = null;
    muted = false;
    #paused = false;
    constructor() {
        try {
            this.muted = localStorage.getItem(KEY) === '1';
        }
        catch { /* storage unavailable */ }
        const unlock = () => {
            this.#ensure();
            if (this.ctx?.state === 'suspended' && !this.#paused)
                void this.ctx.resume().catch(() => { });
        };
        for (const type of ['pointerdown', 'keydown', 'touchend'])
            addEventListener(type, unlock, { capture: true, passive: true });
    }
    #ensure() {
        if (this.ctx)
            return this.ctx;
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC)
            return null;
        try {
            this.ctx = new AC();
        }
        catch {
            return null;
        }
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        comp.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : .55;
        this.master.connect(comp);
        // One second of white noise, shared by every noisy cue.
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++)
            data[i] = Math.random() * 2 - 1;
        this.noise = buffer;
        return this.ctx;
    }
    setMuted(muted) {
        this.muted = !!muted;
        try {
            localStorage.setItem(KEY, this.muted ? '1' : '0');
        }
        catch { /* storage unavailable */ }
        if (this.master)
            this.master.gain.setTargetAtTime(this.muted ? 0 : .55, this.ctx.currentTime, .02);
    }
    /** The kit pauses the loop (settings panel, hidden tab): hold the sound with it. */
    setPaused(paused) {
        this.#paused = paused;
        if (!this.ctx)
            return;
        if (paused && this.ctx.state === 'running')
            void this.ctx.suspend().catch(() => { });
        else if (!paused && this.ctx.state === 'suspended')
            void this.ctx.resume().catch(() => { });
    }
    #ready() {
        return !this.muted && !this.#paused && this.ctx && this.ctx.state === 'running' ? this.ctx : null;
    }
    #tone(type, from, to, start, length, volume, attack = .005) {
        const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, start);
        if (to !== from)
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + length);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + attack);
        gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        osc.connect(gain).connect(this.master);
        osc.start(start);
        osc.stop(start + length + .02);
    }
    #hiss(start, length, volume, filter = 'lowpass', from = 1200, to = from, q = .8) {
        const ctx = this.ctx, src = ctx.createBufferSource(), biquad = ctx.createBiquadFilter(), gain = ctx.createGain();
        src.buffer = this.noise;
        biquad.type = filter;
        biquad.Q.value = q;
        biquad.frequency.setValueAtTime(from, start);
        if (to !== from)
            biquad.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + length);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + .004);
        gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        src.connect(biquad).connect(gain).connect(this.master);
        src.start(start, Math.random() * .5);
        src.stop(start + length + .02);
    }
    play(name, info) {
        const ctx = this.#ready();
        if (!ctx)
            return;
        const t = ctx.currentTime + .005;
        switch (name) {
            case 'step':
                this.#hiss(t, .05, .05 + .05 * (info ?? .5), 'lowpass', 520);
                break;
            case 'jump':
                this.#tone('sine', 230, 420, t, .13, .09);
                this.#hiss(t, .08, .04, 'highpass', 1800);
                break;
            case 'land':
                this.#hiss(t, .1 + .12 * (info ?? 0), .09 + .14 * (info ?? 0), 'lowpass', 380, 140);
                this.#tone('sine', 120, 60, t, .14, .06 + .1 * (info ?? 0));
                break;
            case 'switch':
                this.#tone('square', info ? 660 : 520, info ? 660 : 520, t, .05, .05);
                this.#tone('square', info ? 990 : 390, info ? 990 : 390, t + .06, .07, .05);
                break;
            case 'door':
                this.#tone('sawtooth', info ? 70 : 90, info ? 95 : 60, t, .7, .045, .05);
                this.#hiss(t, .65, .05, 'bandpass', 300, 600, 1.4);
                break;
            case 'mover':
                this.#tone('triangle', 180, 260, t, .3, .06, .02);
                break;
            case 'plate':
                this.#tone('sine', info ? 150 : 120, info ? 95 : 80, t, .12, .12);
                this.#hiss(t, .06, .06, 'lowpass', 700);
                if (info)
                    this.#tone('triangle', 784, 784, t + .07, .12, .04);
                break;
            case 'pickup':
                [660, 880, 1320].forEach((f, i) => this.#tone('sine', f, f, t + i * .06, .2, .07));
                break;
            case 'checkpoint':
                this.#tone('triangle', 523, 523, t, .16, .07);
                this.#tone('triangle', 784, 784, t + .09, .24, .07);
                break;
            case 'pad':
                this.#tone('sine', 170, 760, t, .38, .11, .01);
                this.#hiss(t, .25, .04, 'bandpass', 800, 3000, 2);
                break;
            case 'respawn':
                if (info === 'hazard')
                    this.#tone('square', 140, 70, t, .28, .06);
                this.#tone('sine', 880, 330, t, .3, .05);
                break;
            case 'grab':
                this.#tone('sine', 300, 420, t, .07, .05);
                break;
            case 'drop':
                this.#tone('sine', 380, 260, t, .07, .04);
                break;
            case 'throw':
                this.#hiss(t, .22, .09, 'bandpass', 500, 2200, 1.2);
                break;
            case 'deny':
                this.#tone('square', 220, 220, t, .1, .04);
                this.#tone('square', 165, 165, t + .11, .16, .04);
                break;
            case 'unlock':
                [392, 523, 659].forEach((f, i) => this.#tone('triangle', f, f, t + i * .08, .26, .06));
                break;
            case 'goal':
                [523, 659, 784, 1046].forEach((f, i) => this.#tone('triangle', f, f, t + i * .1, .5, .07));
                break;
            case 'best':
                [784, 988, 1175, 1568].forEach((f, i) => this.#tone('sine', f, f, t + .45 + i * .07, .35, .05));
                break;
        }
    }
}
