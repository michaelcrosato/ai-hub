export function createAudioSystem() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let step = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
    return ctx;
  }

  async function start() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') await c.resume();
    if (!musicTimer) {
      musicTimer = setInterval(() => {
        if (!enabled || !ctx || ctx.state !== 'running') return;
        const notes = [146.83, 174.61, 196.00, 174.61, 130.81, 164.81, 196.00, 164.81];
        const bass = [73.42, 73.42, 65.41, 65.41, 82.41, 82.41, 65.41, 65.41];
        tone(notes[step % notes.length], 0.07, 'square', 0.022, 0);
        if (step % 2 === 0) tone(bass[step % bass.length], 0.12, 'triangle', 0.028, 0);
        if (step % 4 === 2) noise(0.025, 0.018, 500, 2200);
        step++;
      }, 310);
    }
  }

  function tone(freq, dur = 0.08, type = 'square', gain = 0.05, glide = 0) {
    if (!enabled) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.01);
  }

  function noise(dur = 0.05, gain = 0.05, low = 250, high = 5000) {
    if (!enabled) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, n, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buffer;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = (low + high) * .5; filter.Q.value = .7;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(filter); filter.connect(g); g.connect(master); src.start();
  }

  function handle(events) {
    for (const ev of events) {
      if (ev.type === 'playerShot') { noise(.026, .035, 900, 4200); tone(360, .04, 'square', .022, -120); }
      else if (ev.type === 'enemyShot') { tone(170, .055, 'square', .03, -60); }
      else if (ev.type === 'bossShot') { tone(105, .09, 'sawtooth', .05, -45); }
      else if (ev.type === 'hit' || ev.type === 'woodHit') noise(.035, .028, 450, 3100);
      else if (ev.type === 'playerHit') { noise(.09, .06, 100, 1500); tone(82, .13, 'sawtooth', .055, -30); }
      else if (ev.type === 'enemyDown') tone(104, .12, 'triangle', .04, -45);
      else if (ev.type === 'pickup') { tone(440, .07, 'square', .035); setTimeout(() => tone(660, .08, 'square', .03), 55); }
      else if (ev.type === 'equipment') { tone(392, .08, 'triangle', .04); setTimeout(() => tone(523.25, .1, 'triangle', .04), 70); }
      else if (ev.type === 'posterFound') { [293.66, 369.99, 440].forEach((n, i) => setTimeout(() => tone(n, .18, 'triangle', .05), i * 90)); }
      else if (ev.type === 'levelUp') { [330, 440, 554.37].forEach((n, i) => setTimeout(() => tone(n, .12, 'square', .035), i * 60)); }
      else if (ev.type === 'upgrade') { [220, 330, 440].forEach((n, i) => setTimeout(() => tone(n, .11, 'triangle', .04), i * 65)); }
      else if (ev.type === 'bossIntro' || ev.type === 'bossEnrage') { tone(73.42, .35, 'sawtooth', .06, -20); setTimeout(() => tone(98, .3, 'square', .035), 160); }
      else if (ev.type === 'bossDown') { [196, 246.94, 293.66, 392].forEach((n, i) => setTimeout(() => tone(n, .3, 'triangle', .055), i * 110)); }
      else if (ev.type === 'defeat') tone(98, .55, 'sawtooth', .05, -55);
    }
  }

  function setEnabled(v) { enabled = Boolean(v); if (master) master.gain.value = enabled ? .28 : 0; }
  function dispose() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; ctx?.close?.(); ctx = null; }
  return { start, handle, setEnabled, dispose };
}
