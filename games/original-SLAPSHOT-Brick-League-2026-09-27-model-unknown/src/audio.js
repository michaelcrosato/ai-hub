/** All music and effects are synthesized locally; no samples or downloads. */
export class ArcadeAudio {
    context = null;
    sfxBus = null;
    musicBus = null;
    crowdGain = null;
    noiseBuffer = null;
    enabled = true;
    musicEnabled = true;
    nextBeat = 0;
    beat = 0;
    crowdLevel = 0;
    crowdTarget = .02;
    /** Create the context on the first user gesture (and resume it on later ones). Safe to call often. */
    unlock() {
        if (!this.context) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx)
                return;
            const c = this.context = new Ctx();
            this.sfxBus = c.createGain();
            this.sfxBus.gain.value = this.enabled ? .3 : 0;
            this.sfxBus.connect(c.destination);
            this.musicBus = c.createGain();
            this.musicBus.gain.value = this.musicEnabled ? .075 : 0;
            this.musicBus.connect(c.destination);
            this.nextBeat = c.currentTime + .08;
            // One shared two-second noise buffer feeds every hiss, thud and the crowd bed.
            const size = Math.floor(c.sampleRate * 2), buffer = c.createBuffer(1, size, c.sampleRate), data = buffer.getChannelData(0);
            for (let i = 0; i < size; i++)
                data[i] = Math.random() * 2 - 1;
            this.noiseBuffer = buffer;
            this.startCrowd();
        }
        if (this.context.state === 'suspended' && !this.held)
            void this.context.resume().catch(() => { });
    }
    /** Pause (kit menu, hidden tab) and resume all sound. */
    hold(on) {
        this.held = on;
        const c = this.context;
        if (!c)
            return;
        if (on && c.state === 'running')
            void c.suspend().catch(() => { });
        else if (!on && c.state === 'suspended')
            void c.resume().catch(() => { });
    }
    settings(s) {
        this.enabled = s.sound;
        this.musicEnabled = s.music;
        if (this.sfxBus)
            this.sfxBus.gain.value = s.sound ? .3 : 0;
        if (this.musicBus)
            this.musicBus.gain.value = s.music ? .075 : 0;
    }
    startCrowd() {
        const c = this.context, source = c.createBufferSource(), band = c.createBiquadFilter(), low = c.createBiquadFilter();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        band.type = 'bandpass';
        band.frequency.value = 650;
        band.Q.value = .7;
        low.type = 'lowpass';
        low.frequency.value = 1800;
        this.crowdGain = c.createGain();
        this.crowdGain.gain.value = 0;
        source.connect(band);
        band.connect(low);
        low.connect(this.crowdGain);
        this.crowdGain.connect(this.sfxBus);
        source.start();
    }
    /** Crowd noise swells on big moments and settles back to a murmur. */
    cheer(amount) { this.crowdLevel = Math.max(this.crowdLevel, amount); }
    tone(frequency, duration, type = 'square', volume = .15, when, endFrequency, music = false) {
        const c = this.context, bus = music ? this.musicBus : this.sfxBus;
        if (!c || !bus)
            return;
        const t = when ?? c.currentTime, osc = c.createOscillator(), gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        if (endFrequency)
            osc.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
        gain.gain.setValueAtTime(.001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + .012);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + duration + .01);
    }
    noise(duration, volume = .3, frequency = 1200, when) {
        const c = this.context;
        if (!c || !this.sfxBus || !this.noiseBuffer)
            return;
        const t = when ?? c.currentTime, source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
        source.buffer = this.noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.value = frequency;
        // The same fading envelope the per-call buffers had, as a gain ramp on the shared buffer.
        gain.gain.setValueAtTime(volume, t);
        gain.gain.linearRampToValueAtTime(0, t + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxBus);
        source.start(t, Math.random() * Math.max(0, 2 - duration - .05), duration + .02);
    }
    play(event) {
        if (!this.enabled || !this.context)
            return;
        const t = this.context.currentTime;
        switch (event.kind) {
            case 'goal':
                this.noise(1.2, .5, 1800);
                [196, 246.94, 293.66, 392].forEach((f, i) => this.tone(f, .75, 'sawtooth', .11, t + i * .07));
                [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, .16, 'square', .13, t + .6 + i * .13));
                this.cheer(1);
                break;
            case 'shot':
                this.tone(290, .12, 'triangle', .45, t, 80);
                this.noise(.08, .4, 3200);
                this.cheer(.25);
                break;
            case 'pass':
                this.tone(200, .055, 'triangle', .3, t, 140);
                break;
            case 'hit':
                this.tone(100, .2, 'sine', .85, t, 35);
                this.noise(.2, .55, 550);
                this.cheer(.45);
                break;
            case 'whistle':
                this.tone(2300, .2, 'sine', .14);
                this.tone(2750, .15, 'sine', .08, t + .05);
                break;
            case 'faceoff':
                this.tone(500, .08, 'square', .13);
                break;
            case 'save':
                this.noise(.11, .25, 1700);
                this.tone(330, .09, 'triangle', .3);
                this.cheer(.4);
                break;
            case 'post':
                // The ping every hockey fan dreads.
                this.tone(1850, .45, 'sine', .3, t, 1790);
                this.tone(2780, .3, 'sine', .16, t, 2700);
                this.tone(3700, .14, 'triangle', .06, t);
                this.cheer(.55);
                break;
            case 'boards':
                this.noise(.13, .18 + (event.strength ?? .5) * .35, 380);
                this.tone(85, .12, 'sine', .25 + (event.strength ?? .5) * .3, t, 50);
                break;
            case 'power':
                [220, 440, 880].forEach((f, i) => this.tone(f, .25, 'sawtooth', .13, t + i * .09, f * 1.8));
                this.cheer(.6);
                break;
            case 'period':
                this.tone(146.8, .85, 'sawtooth', .18);
                this.tone(164.8, .8, 'sawtooth', .1);
                break;
            case 'finish':
                [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this.tone(f, .23, 'square', .16, t + i * .2));
                this.cheer(.9);
                break;
            case 'cup':
                [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, .5, 'sawtooth', .1, t + 1.3 + i * .12));
                this.noise(2, .35, 2400, t + 1.2);
                break;
            default: break;
        }
    }
    /** Called every frame: schedules the soundtrack a little ahead and eases the crowd level. */
    tick(dt = 1 / 60, inMatch = false) {
        const c = this.context;
        if (!c || c.state !== 'running')
            return;
        if (this.crowdGain) {
            this.crowdLevel = Math.max(0, this.crowdLevel - dt * .45);
            const base = inMatch ? .05 : .025, level = this.enabled ? base + this.crowdLevel * .32 : 0;
            if (Math.abs(level - (this.crowdSet ?? -1)) > .002) {
                this.crowdSet = level;
                this.crowdGain.gain.setTargetAtTime(level, c.currentTime, .12);
            }
        }
        if (this.nextBeat < c.currentTime - 1)
            this.nextBeat = c.currentTime;
        const bass = [65.41, 65.41, 98, 65.41, 77.78, 77.78, 116.54, 77.78, 87.31, 87.31, 130.81, 87.31, 98, 98, 146.83, 98];
        const melody = [523.25, 0, 622.25, 783.99, 698.46, 0, 622.25, 523.25, 587.33, 0, 698.46, 880, 783.99, 698.46, 587.33, 0];
        while (this.nextBeat < c.currentTime + .12) {
            if (this.musicEnabled) {
                const i = this.beat % 16;
                this.tone(bass[i], .14, 'triangle', .75, this.nextBeat, undefined, true);
                if (melody[i])
                    this.tone(melody[i], .1, 'square', .15, this.nextBeat, undefined, true);
                if (i % 4 === 0)
                    this.tone(140, .1, 'sine', .8, this.nextBeat, 45, true);
                if (i % 2 === 1)
                    this.tone(4800, .018, 'triangle', .15, this.nextBeat, 1400, true);
            }
            this.beat++;
            this.nextBeat += 60 / 132 / 2;
        }
    }
}
