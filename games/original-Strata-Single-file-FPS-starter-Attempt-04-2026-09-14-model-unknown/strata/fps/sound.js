/**
 * Procedural sound cues. No audio context is created before a user gesture,
 * and one context serves every mount of the game (browsers cap how many a page may open).
 */
const CUES = {
    shot: [{ type: 'sawtooth', f0: 140, f1: 40, ramp: .09, dur: .11 }, { noise: 2600, dur: .07, gain: .9 }],
    hit: [{ type: 'sine', f0: 620, f1: 40, ramp: .09, dur: .11 }],
    hurt: [{ type: 'sine', f0: 90, f1: 40, ramp: .09, dur: .11, gain: 1.3 }, { noise: 900, dur: .08, gain: .5 }],
    enemy: [{ type: 'square', f0: 210, f1: 70, ramp: .1, dur: .12, gain: .55 }, { noise: 1800, dur: .07, gain: .6 }],
    alert: [{ type: 'sine', f0: 880, dur: .05, gain: .35 }, { type: 'sine', f0: 880, dur: .05, gain: .35, at: .08 }],
    empty: [{ type: 'square', f0: 1100, f1: 900, dur: .03, gain: .35 }],
    reload: [{ type: 'triangle', f0: 320, f1: 260, dur: .06, gain: .6 }, { type: 'triangle', f0: 520, f1: 620, dur: .06, gain: .6, at: .24 }],
    kill: [{ type: 'sine', f0: 320, f1: 70, ramp: .28, dur: .32, gain: 1.1 }, { noise: 700, dur: .25, gain: .7 }],
    door: [{ type: 'sawtooth', f0: 62, f1: 96, ramp: .55, dur: .6, gain: .45 }],
    pickup: [{ type: 'sine', f0: 660, f1: 990, dur: .12, gain: .8 }, { type: 'sine', f0: 990, f1: 1320, dur: .14, gain: .7, at: .1 }],
    supply: [{ type: 'triangle', f0: 440, f1: 660, dur: .12, gain: .8 }, { type: 'triangle', f0: 660, f1: 880, dur: .14, gain: .7, at: .1 }],
    pad: [{ type: 'sine', f0: 180, f1: 720, ramp: .22, dur: .26, gain: .9 }],
    checkpoint: [{ type: 'triangle', f0: 523, dur: .12, gain: .7 }, { type: 'triangle', f0: 784, dur: .18, gain: .7, at: .11 }],
    switch: [{ type: 'square', f0: 420, f1: 380, dur: .04, gain: .45 }],
    finish: [523, 659, 784, 1047].map((f0, i) => ({ type: 'triangle', f0, dur: .22, gain: .8, at: i * .11 })),
    death: [{ type: 'sawtooth', f0: 220, f1: 40, ramp: .6, dur: .7, gain: 1.1 }, { noise: 500, dur: .4, gain: .6 }],
    ui: [{ type: 'sine', f0: 720, dur: .04, gain: .3 }],
};
export class Sound {
    context = null;
    master = null;
    noise = null;
    volume = .15;
    suspended = false;
    last = new Map();
    /** Create or wake the context. Call from a click or key press. */
    async resume() {
        if (!this.context) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass)
                return;
            this.context = new AudioContextClass();
            this.master = this.context.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.context.destination);
            const length = Math.floor(this.context.sampleRate * .5);
            this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < length; i++)
                data[i] = Math.random() * 2 - 1;
        }
        if (this.context.state === 'suspended' && !this.suspended)
            await this.context.resume();
    }
    setVolume(value) {
        this.volume = value;
        if (this.master)
            this.master.gain.setTargetAtTime(value, this.context.currentTime, .02);
    }
    /** Silence everything while the game is paused by the page (settings panel, hidden tab). */
    suspend(on) {
        this.suspended = on;
        const context = this.context;
        if (!context || context.state === 'closed')
            return;
        void (on ? context.suspend() : context.resume()).catch(() => { });
    }
    cue(kind) {
        const context = this.context, notes = CUES[kind];
        if (!context || !notes || context.state !== 'running' || this.volume <= 0)
            return;
        const now = context.currentTime;
        // The same cue twice within 30 ms (two hits in one frame) plays once.
        if (now - (this.last.get(kind) ?? -1) < .03)
            return;
        this.last.set(kind, now);
        for (const note of notes)
            this.#note(note, now);
    }
    #note(n, now) {
        const context = this.context, t = now + (n.at ?? 0), gain = context.createGain();
        gain.gain.setValueAtTime(.15 * (n.gain ?? 1), t);
        gain.gain.exponentialRampToValueAtTime(.0001, t + n.dur);
        let source, filter = null;
        if (n.noise) {
            source = context.createBufferSource();
            source.buffer = this.noise;
            filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = n.noise;
            source.connect(filter);
            filter.connect(gain);
        }
        else {
            source = context.createOscillator();
            source.type = n.type;
            source.frequency.setValueAtTime(n.f0, t);
            if (n.f1 && n.f1 !== n.f0)
                source.frequency.exponentialRampToValueAtTime(n.f1, t + (n.ramp ?? n.dur * .8));
            source.connect(gain);
        }
        gain.connect(this.master);
        source.start(t);
        source.stop(t + n.dur + .02);
        source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    }
    dispose() {
        if (this.context)
            void this.context.close().catch(() => { });
        this.context = null;
        this.master = null;
    }
}
