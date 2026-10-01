/**
 * Procedural cues for every episode. No audio context exists before a user gesture; the
 * shell unlocks it on the first key, click or tap anywhere on the page (not only on a
 * start button), so sound works for keyboard, mouse and touch players alike.
 */
const CUES = {
    //        wave        from  to    seconds gain
    shot: ['sawtooth', 140, 40, .11, 1],
    hit: ['sine', 620, 300, .09, .8],
    hurt: ['sine', 90, 45, .16, 1.2],
    down: ['triangle', 300, 55, .38, 1],
    reload: ['square', 340, 220, .05, .35],
    loaded: ['square', 520, 520, .04, .3],
    empty: ['square', 180, 160, .04, .3],
    pickup: ['sine', 520, 1040, .22, .8],
    switch: ['square', 260, 390, .08, .4],
    door: ['triangle', 110, 70, .5, .9],
    checkpoint: ['sine', 440, 660, .18, .6],
    pad: ['sine', 180, 720, .25, .7],
    impact: ['triangle', 120, 40, .22, 1.4],
    confirm: ['sine', 660, 880, .08, .45],
    finish: ['triangle', 392, 784, .6, .8],
    beacon: ['sine', 220, 440, .9, .8],
};

export class Sound {
    context = null;
    master = null;
    volume = .15;
    engineOsc = null;
    engineGain = null;
    engineFilter = null;
    /** Create or wake the context. Call from any user gesture. */
    unlock() {
        try {
            if (!this.context) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx)
                    return;
                this.context = new Ctx();
                this.master = this.context.createGain();
                this.master.gain.value = 1;
                this.master.connect(this.context.destination);
            }
            if (this.context.state === 'suspended' && !this.held)
                void this.context.resume().catch(() => { });
        }
        catch {
            /* no audio on this device */
        }
    }
    held = false;
    /** Hold all sound while the game is paused (menus, the kit's settings panel). */
    hold(on) {
        this.held = !!on;
        if (!this.context)
            return;
        if (on)
            void this.context.suspend().catch(() => { });
        else
            void this.context.resume().catch(() => { });
    }
    get running() { return !!this.context && this.context.state === 'running' && this.volume > 0; }
    cue(kind, gainScale = 1) {
        const spec = CUES[kind] ?? CUES.hurt;
        const context = this.context;
        if (!this.running)
            return;
        const [type, from, to, seconds, gainMul] = spec;
        const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds * .85);
        gain.gain.setValueAtTime(this.volume * .15 * gainMul * gainScale, now);
        gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(now);
        oscillator.stop(now + seconds + .02);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    /** A low engine note for the car: speed 0..1 sets pitch, on=false fades it out. */
    engine(on, speed = 0) {
        const context = this.context;
        if (!context || context.state !== 'running')
            return;
        if (!this.engineOsc) {
            if (!on)
                return;
            this.engineOsc = context.createOscillator();
            this.engineOsc.type = 'sawtooth';
            this.engineFilter = context.createBiquadFilter();
            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.value = 420;
            this.engineGain = context.createGain();
            this.engineGain.gain.value = 0;
            this.engineOsc.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.master);
            this.engineOsc.start();
        }
        // Re-target only on a real change: one automation event per frame piles up otherwise.
        const freq = Math.round(42 + 120 * Math.min(1, Math.abs(speed))), level = on ? this.volume * .09 : 0;
        if (freq === this.engineFreq && level === this.engineLevel)
            return;
        const now = context.currentTime;
        if (freq !== this.engineFreq)
            this.engineOsc.frequency.setTargetAtTime(freq, now, .08);
        if (level !== this.engineLevel)
            this.engineGain.gain.setTargetAtTime(level, now, on ? .1 : .05);
        this.engineFreq = freq;
        this.engineLevel = level;
    }
    engineFreq = -1;
    engineLevel = -1;
    stopEngine() {
        if (!this.engineOsc)
            return;
        try {
            this.engineOsc.stop();
        }
        catch { /* already stopped */ }
        this.engineOsc.disconnect();
        this.engineFilter.disconnect();
        this.engineGain.disconnect();
        this.engineOsc = this.engineFilter = this.engineGain = null;
        this.engineFreq = this.engineLevel = -1;
    }
    dispose() {
        this.stopEngine();
        if (this.context)
            void this.context.close().catch(() => { });
        this.context = null;
    }
}
