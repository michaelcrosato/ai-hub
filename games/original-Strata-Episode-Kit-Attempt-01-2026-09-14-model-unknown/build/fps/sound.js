/** Optional procedural cues. No audio context is created before a user gesture. */
export class Sound {
    context = null;
    volume = .15;
    async resume() { this.context ??= new AudioContext(); if (this.context.state === 'suspended')
        await this.context.resume(); }
    cue(kind) {
        const context = this.context;
        if (!context || context.state !== 'running' || this.volume <= 0)
            return;
        const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
        oscillator.type = kind === 'shot' ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(kind === 'shot' ? 140 : kind === 'hit' ? 620 : 90, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + .09);
        gain.gain.setValueAtTime(this.volume * .15, now);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .11);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + .12);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    dispose() { if (this.context)
        void this.context.close().catch(() => { }); this.context = null; }
}
