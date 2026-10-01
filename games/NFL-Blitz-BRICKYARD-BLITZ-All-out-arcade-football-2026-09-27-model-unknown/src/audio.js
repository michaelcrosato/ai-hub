// Original procedural audio: no samples, music or licensed sound effects.
// One shared noise buffer serves every hit, whistle and crowd swell (the original
// allocated a fresh AudioBuffer for each), and a quiet crowd bed rises on big plays.

export class AudioEngine {
    ctx = null;
    master = null;
    noiseBuffer = null;
    crowdGain = null;
    #enabled = true;
    #inGame = false;
    #cheerUntil = 0;

    get enabled() { return this.#enabled; }
    set enabled(on) {
        this.#enabled = !!on;
        if (this.master && this.ctx)
            this.master.gain.setTargetAtTime(this.#enabled ? 0.18 : 0, this.ctx.currentTime, 0.02);
    }

    /** Create or resume the context. Call from any user gesture (click, key, touch, pad press). */
    unlock() {
        if (!this.ctx) {
            try {
                this.ctx = new AudioContext();
            }
            catch {
                return;
            }
            this.master = this.ctx.createGain();
            this.master.gain.value = this.#enabled ? 0.18 : 0;
            this.master.connect(this.ctx.destination);
            const n = this.ctx.sampleRate * 2;
            this.noiseBuffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < n; i++)
                data[i] = Math.random() * 2 - 1;
            this.#startCrowd();
        }
        if (this.ctx.state === 'suspended' && !this.paused)
            void this.ctx.resume().catch(() => { });
    }

    paused = false;
    /** The kit menu, the pause screen or a hidden tab: silence everything, keep the context. */
    setPaused(on) {
        this.paused = !!on;
        if (!this.ctx)
            return;
        if (on)
            void this.ctx.suspend().catch(() => { });
        else
            void this.ctx.resume().catch(() => { });
    }

    /** A low stadium murmur while a game is on; silent in the lobby. */
    setInGame(on) {
        this.#inGame = !!on;
        this.#crowdLevel(on ? 0.05 : 0, 0.6);
    }

    /** The crowd rises for a moment: 0..1. */
    cheer(amount = 1) {
        if (!this.ctx || !this.crowdGain)
            return;
        const t = this.ctx.currentTime;
        const peak = (this.#inGame ? 0.05 : 0) + 0.32 * Math.min(1, amount);
        this.crowdGain.gain.cancelScheduledValues(t);
        this.crowdGain.gain.setTargetAtTime(peak, t, 0.08);
        this.#cheerUntil = t + 0.6 + amount * 1.6;
        this.crowdGain.gain.setTargetAtTime(this.#inGame ? 0.05 : 0, this.#cheerUntil, 0.7);
    }

    #crowdLevel(level, tau) {
        if (!this.ctx || !this.crowdGain)
            return;
        const t = Math.max(this.ctx.currentTime, this.#cheerUntil);
        this.crowdGain.gain.setTargetAtTime(level, t, tau);
    }

    #startCrowd() {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 620;
        band.Q.value = 0.55;
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 1800;
        this.crowdGain = ctx.createGain();
        this.crowdGain.gain.value = this.#inGame ? 0.05 : 0;
        src.connect(band);
        band.connect(low);
        low.connect(this.crowdGain);
        this.crowdGain.connect(this.master);
        src.start();
    }

    note(hz, duration, type = 'square', delay = 0, volume = 0.25, slide = 0) {
        if (!this.#enabled || !this.ctx || this.paused)
            return;
        const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(hz, t);
        if (slide)
            o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + duration);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volume, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + duration + 0.02);
    }

    /** A burst of the shared noise buffer with a cubic decay (the original envelope). */
    noise(duration = 0.12, volume = 0.25, filter = 0, delay = 0) {
        if (!this.#enabled || !this.ctx || this.paused)
            return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = this.noiseBuffer;
        g.gain.setValueAtTime(volume, t);
        g.gain.setTargetAtTime(0.0001, t, duration / 3);
        let out = s;
        if (filter) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filter;
            s.connect(f);
            out = f;
        }
        out.connect(g);
        g.connect(this.master);
        s.start(t, Math.random() * 1.5, duration + 0.05);
    }

    play(event) {
        switch (event) {
            case 'hit':
                this.noise(0.2, 0.9);
                this.note(110, 0.22, 'sawtooth', 0, 0.5, 30);
                break;
            case 'bighit':
                this.noise(0.28, 1, 0, 0);
                this.note(90, 0.3, 'sawtooth', 0, 0.55, 26);
                this.note(55, 0.35, 'square', 0.02, 0.3, 30);
                break;
            case 'score':
                [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((n, i) => this.note(n, i === 5 ? 0.8 : 0.22, 'square', i * 0.115, 0.25));
                this.noise(0.8, 0.16);
                break;
            case 'whistle':
                this.note(2100, 0.12, 'sine', 0, 0.18);
                this.note(2350, 0.2, 'sine', 0.14, 0.16);
                break;
            case 'snap':
                this.note(180, 0.12, 'square', 0, 0.3, 80);
                this.noise(0.08, 0.15);
                break;
            case 'pass':
            case 'kick':
                this.note(230, 0.22, 'sine', 0, 0.25, 900);
                break;
            case 'click':
                this.note(740, 0.055, 'triangle', 0, 0.3);
                break;
            case 'horn':
                this.note(146.8, 0.7, 'sawtooth', 0, 0.24);
                this.note(220, 0.7, 'sawtooth', 0, 0.18);
                break;
            case 'catch':
                this.note(520, 0.08, 'triangle', 0, 0.3);
                break;
            // Events the simulation always sent but the original never voiced.
            case 'whoosh':
                this.noise(0.16, 0.28, 2400);
                break;
            case 'bounce':
                this.note(150, 0.09, 'triangle', 0, 0.28, 90);
                break;
            case 'turnover':
                this.note(392, 0.12, 'square', 0, 0.22);
                this.note(311, 0.12, 'square', 0.12, 0.22);
                this.note(233, 0.3, 'square', 0.24, 0.22);
                break;
            case 'fumble':
                this.note(660, 0.1, 'square', 0, 0.2, 330);
                break;
            case 'firstdown':
                this.note(523.25, 0.1, 'square', 0, 0.2);
                this.note(659.25, 0.16, 'square', 0.1, 0.2);
                break;
            case 'fail':
                this.note(220, 0.25, 'sawtooth', 0, 0.2, 140);
                this.note(165, 0.45, 'sawtooth', 0.22, 0.2, 90);
                break;
        }
    }
}
