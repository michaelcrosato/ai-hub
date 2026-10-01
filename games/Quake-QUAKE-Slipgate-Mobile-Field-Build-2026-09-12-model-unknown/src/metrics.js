// Frame-time measurement for the Engine Room panel: mean FPS, 1% low, P95 frame time, a graph,
// the 20-second render test and the JSON export. Measures callback intervals, not GPU time.

export function summarize(samples) {
  if (!samples.length) return { fps: 0, low: 0, p95: 0, mean: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const slow = sorted.slice(-Math.max(1, Math.ceil(samples.length * 0.01)));
  return {
    fps: 1000 / mean,
    low: 1000 / (slow.reduce((s, v) => s + v, 0) / slow.length),
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    mean,
  };
}

const KEEP = 300;

export class Metrics {
  constructor() {
    // Ring buffers, so recording a frame never allocates.
    this.ring = new Float32Array(KEEP);
    this.cpuRing = new Float32Array(KEEP);
    this.size = 0;
    this.head = 0;
    this.last = 0;
    this.ignoreUntil = 0;
    this.benchmark = null;
    this.lastBenchmark = null;
  }

  reset() {
    this.size = 0;
    this.head = 0;
    this.last = 0;
    this.ignoreUntil = performance.now() + 600;
  }

  record(now, cpu) {
    if (this.last && now > this.ignoreUntil) {
      const dt = now - this.last;
      if (dt > 0 && dt < 2000) {
        this.ring[this.head] = dt;
        this.cpuRing[this.head] = cpu;
        this.head = (this.head + 1) % KEEP;
        this.size = Math.min(KEEP, this.size + 1);
        if (this.benchmark && now - this.benchmark.start > 1000) this.benchmark.samples.push(dt);
      }
    }
    this.last = now;
  }

  /** Oldest first. */
  get samples() {
    const out = new Array(this.size);
    const start = (this.head - this.size + KEEP) % KEEP;
    for (let i = 0; i < this.size; i++) out[i] = this.ring[(start + i) % KEEP];
    return out;
  }

  cpuMean() {
    if (!this.size) return null;
    let sum = 0;
    for (let i = 0; i < this.size; i++) sum += this.cpuRing[i];
    return sum / this.size;
  }

  stats() {
    return summarize(this.samples);
  }

  report(info) {
    return {
      schema: 2,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      secureContext: window.isSecureContext,
      ...info,
      measured: this.stats(),
      jsSubmitMeanMs: this.cpuMean(),
      lastRenderBenchmark: this.lastBenchmark,
      notes: [
        'FPS measures render callback intervals, not physical display scan-out or GPU time.',
        'JS submit time is not GPU execution time.',
        'Driver version, temperature, and physical-device identity are not inferred.',
        'No claim of physical Galaxy S26 validation.',
      ],
      recentFrameTimesMs: this.samples,
    };
  }

  graph(canvas) {
    const c = canvas.getContext('2d');
    if (!c) return;
    const w = canvas.width;
    const h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#82979e33';
    c.lineWidth = 1;
    c.beginPath();
    for (const ms of [16.67, 33.33]) {
      const y = h - (ms / 50) * h;
      c.moveTo(0, y);
      c.lineTo(w, y);
    }
    c.stroke();
    c.strokeStyle = '#eeb382';
    c.lineWidth = 1.4;
    c.beginPath();
    const list = this.samples.slice(-150);
    list.forEach((ms, i) => {
      const x = (i / 149) * w;
      const y = h - (Math.min(ms, 50) / 50) * h;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.stroke();
  }
}
