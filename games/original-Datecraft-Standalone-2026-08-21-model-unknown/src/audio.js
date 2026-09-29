// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
const exports = {};
class AudioDirector {
    constructor(settings = {}) {
        this.settings = settings;
        this.context = null;
        this.master = null;
        this.musicTimer = null;
        this.step = 0;
    }
    async unlock() {
        if (!this.context) {
            const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!Context)
                return false;
            this.context = new Context();
            this.master = this.context.createGain();
            this.master.gain.value = 0.11;
            this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended')
            await this.context.resume();
        if (this.settings.music)
            this.startMusic();
        return true;
    }
    setSettings(settings) {
        this.settings = settings;
        if (!settings.music)
            this.stopMusic();
        else if (this.context)
            this.startMusic();
    }
    tone(frequency = 440, duration = 0.08, type = 'sine', volume = 0.12, delay = 0) {
        if (!this.context || !this.settings.sound)
            return;
        const now = this.context.currentTime + delay;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }
    play(name) {
        const patterns = {
            click: [[420, .06, 'sine', .06]],
            success: [[523, .1, 'sine', .09], [659, .12, 'sine', .08, .08], [784, .16, 'sine', .07, .16]],
            warning: [[260, .11, 'triangle', .08], [220, .16, 'triangle', .07, .1]],
            cash: [[740, .06, 'sine', .08], [920, .09, 'sine', .07, .055]],
            message: [[480, .06, 'sine', .06], [590, .08, 'sine', .05, .05]],
        };
        for (const [frequency, duration, type, volume, delay] of patterns[name] || patterns.click)
            this.tone(frequency, duration, type, volume, delay || 0);
    }
    startMusic() {
        if (this.musicTimer || !this.context || !this.settings.music)
            return;
        const notes = [261.63, 329.63, 392, 493.88, 392, 329.63, 293.66, 349.23];
        this.musicTimer = setInterval(() => {
            if (!this.settings.music || this.context?.state !== 'running')
                return;
            const note = notes[this.step % notes.length];
            this.step += 1;
            const previousSound = this.settings.sound;
            this.settings.sound = true;
            this.tone(note, .65, 'sine', .018);
            this.tone(note / 2, .8, 'triangle', .009, .02);
            this.settings.sound = previousSound;
        }, 860);
    }
    stopMusic() {
        if (this.musicTimer)
            clearInterval(this.musicTimer);
        this.musicTimer = null;
    }
    dispose() {
        this.stopMusic();
        this.context?.close();
        this.context = null;
    }
}
exports.AudioDirector = AudioDirector;
export { AudioDirector };
