// The HUD and the game's own menus. Plain DOM; every write goes through a small
// cache so nothing touches the DOM unless a value actually changed. MenuNav drives
// any card or panel from kit.input actions, so a gamepad (and arrows + Enter) can
// work the title, pause and results cards and the light panel.

const $ = (id) => document.getElementById(id);

export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

export const dayLabel = (t) => (t < 0.3 ? 'Clear day' : t < 0.68 ? 'Late afternoon' : t < 0.9 ? 'Deep twilight' : 'Moonless night');

const HINTS = {
  keyboard: [
    ['WASD', 'Move'], ['Shift', 'Run'], ['Space', 'Jump'], ['E', 'Switch'], ['G', 'Carry'], ['F', 'Flashlight'],
    ['mouse', 'Look'], ['Wheel', 'View'], ['RMB', 'Orbit'], ['Esc', 'Pause'],
  ],
  gamepad: [
    ['LS', 'Move'], ['RS', 'Look'], ['A', 'Jump'], ['X', 'Switch'], ['Y', 'Carry'], ['RT', 'Flashlight'],
    ['B / L3', 'Run'], ['LB RB', 'Zoom'], ['LT', 'Orbit'], ['R3', 'View'], ['Start', 'Pause'],
  ],
  touch: [
    ['Left thumb', 'Move'], ['Drag', 'Look'], ['Pinch', 'Zoom'], ['View', 'First person'],
  ],
};

const TITLE_HINTS = {
  keyboard: ['Click to capture the mouse. Press Esc to release it.', 'Scroll fully inward for first-person. Hold right mouse to orbit.'],
  gamepad: ['Left stick moves, right stick looks, Start pauses.', 'LB / RB zoom, click the right stick for first person, hold LT to orbit.'],
  touch: ['Left thumb moves; drag the right side to look.', 'Pinch to zoom; View switches to first person.'],
};

export const KEYS = {
  keyboard: { light: 'E', carry: 'G' },
  gamepad: { light: 'X', carry: 'Y' },
  touch: { light: 'Switch', carry: 'Carry' },
};

/** Cached DOM writes. */
class View {
  constructor() {
    this.cache = new Map();
  }
  text(el, value) {
    if (this.cache.get(el) === value) return;
    this.cache.set(el, value);
    el.textContent = value;
  }
  html(el, value) {
    if (this.cache.get(el) === value) return;
    this.cache.set(el, value);
    el.innerHTML = value;
  }
  show(el, on) {
    if (el.hidden === !on) return;
    el.hidden = !on;
  }
  toggle(el, cls, on) {
    if (el.classList.contains(cls) === on) return;
    el.classList.toggle(cls, on);
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Hud {
  constructor() {
    this.view = new View();
    this.el = {
      cameraPill: $('camera-pill'),
      lightPill: $('light-pill'),
      backend: $('backend-label'),
      panelToggle: $('panel-toggle'),
      pauseButton: $('pause-button'),
      title: $('title-card'),
      titleHint1: $('title-hint-1'),
      titleHint2: $('title-hint-2'),
      titleBest: $('title-best'),
      pause: $('pause-card'),
      pauseSummary: $('pause-summary'),
      pauseRounds: $('pause-rounds'),
      controlsHelp: $('controls-help'),
      results: $('results-card'),
      resultsTime: $('results-time'),
      resultsBest: $('results-best'),
      resultsRuns: $('results-runs'),
      resultsNote: $('results-note'),
      panel: $('quality-panel'),
      tierBadge: $('tier-badge'),
      day: $('day-control'),
      dayOut: $('day-output'),
      exposure: $('exposure-control'),
      exposureOut: $('exposure-output'),
      qualitySegment: $('quality-segment'),
      autoExposure: $('auto-exposure'),
      helicopter: $('helicopter-light'),
      flashlight: $('flashlight-toggle'),
      autoSun: $('auto-sun'),
      contacts: $('contact-shadows'),
      sound: $('sound-toggle'),
      nightButton: $('night-button'),
      resetButton: $('reset-button'),
      settingsButton: $('settings-button'),
      prompt: $('prompt'),
      hint: $('control-hint'),
      crosshair: $('crosshair'),
      rounds: $('rounds-panel'),
      roundsCount: $('rounds-count'),
      roundsTimer: $('rounds-timer'),
      roundsList: $('rounds-list'),
      perf: {
        fps: $('perf-fps'),
        frame: $('perf-frame'),
        lights: $('perf-lights'),
        cpu: $('perf-cpu'),
        quality: $('perf-quality'),
        calls: $('perf-calls'),
        tris: $('perf-tris'),
        shadows: $('perf-shadows'),
      },
    };
  }

  setBackend(label) {
    this.view.text(this.el.backend, label);
  }

  setCameraMode(mode) {
    this.view.text(this.el.cameraPill, mode === 'first-person' ? 'First person' : 'Third person');
    this.view.toggle(this.el.cameraPill, 'is-close', mode === 'first-person');
  }

  setPanelOpen(open) {
    this.view.toggle(this.el.panel, 'is-open', open);
    this.el.panelToggle.setAttribute('aria-expanded', String(open));
    this.view.text(this.el.panelToggle, open ? 'Hide controls' : 'Show controls');
    this.el.panel.inert = !open;
  }

  /** Mirror the game settings into the panel controls and pills. */
  syncSettings(s, liveExposure = s.exposure) {
    const e = this.el;
    if (document.activeElement !== e.day) e.day.value = String(s.timeOfDay);
    this.view.text(e.dayOut, dayLabel(s.timeOfDay));
    if (document.activeElement !== e.exposure) e.exposure.value = String(s.exposure);
    this.setExposure(s.exposure, liveExposure);
    e.autoExposure.checked = s.autoExposure;
    e.helicopter.checked = s.helicopterLight;
    e.flashlight.checked = s.flashlight;
    e.autoSun.checked = s.autoSun;
    e.contacts.checked = s.contactShadows;
    e.sound.checked = s.sound;
    this.view.text(e.lightPill, `Flashlight ${s.flashlight ? 'on' : 'off'}`);
    this.view.toggle(e.lightPill, 'is-on', s.flashlight);
  }

  setExposure(bias, live) {
    this.view.text(this.el.exposureOut, `${bias.toFixed(2)} · live ${live.toFixed(2)}`);
  }

  syncQuality(setting, tierName) {
    for (const b of this.el.qualitySegment.querySelectorAll('button')) {
      const on = b.dataset.quality === setting;
      this.view.toggle(b, 'selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    this.view.text(this.el.tierBadge, setting === 'auto' ? `auto · ${tierName}` : 'manual');
    this.view.toggle(this.el.tierBadge, 'active', setting === 'auto');
  }

  setSource(source) {
    const hints = HINTS[source] || HINTS.keyboard;
    this.view.html(
      this.el.hint,
      hints.map(([k, label]) => (k === 'mouse' ? `<span><span class="mouse-icon" aria-hidden="true"></span> ${label}</span>` : `<span><kbd>${escapeHtml(k)}</kbd> ${label}</span>`)).join('')
    );
    this.view.html(this.el.controlsHelp, hints.map(([k, label]) => `<span>${k === 'mouse' ? 'Mouse' : `<kbd>${escapeHtml(k)}</kbd>`} ${label}</span>`).join(''));
    const t = TITLE_HINTS[source] || TITLE_HINTS.keyboard;
    this.view.text(this.el.titleHint1, t[0]);
    this.view.text(this.el.titleHint2, t[1]);
    const resetKey = source === 'gamepad' ? 'Back' : source === 'touch' ? '' : 'R';
    const kbd = this.el.resetButton.querySelector('kbd');
    if (kbd) {
      kbd.hidden = !resetKey;
      kbd.textContent = resetKey;
    }
  }

  setPrompt(text) {
    this.view.show(this.el.prompt, !!text);
    if (text) this.view.text(this.el.prompt, text);
  }

  setPlaying(playing, showHint) {
    this.view.show(this.el.crosshair, playing);
    this.view.show(this.el.hint, playing && showHint);
    if (!playing) this.setPrompt(null);
  }

  showCard(which) {
    this.view.show(this.el.title, which === 'title');
    this.view.show(this.el.pause, which === 'pause');
    this.view.show(this.el.results, which === 'results');
  }

  setTitleBest(best, runs) {
    this.view.text(this.el.titleBest, best === null ? 'Seven lights, one clock' : `Best ${formatTime(best)} · ${runs} run${runs === 1 ? '' : 's'}`);
  }

  setPauseSummary(text, roundsLabel) {
    this.view.text(this.el.pauseSummary, text);
    this.view.text(this.el.pauseRounds, roundsLabel);
  }

  showResults({ time, best, runs, record, previous }) {
    this.view.text(this.el.resultsTime, formatTime(time));
    this.view.text(this.el.resultsBest, formatTime(best));
    this.view.text(this.el.resultsRuns, String(runs));
    this.view.text(
      this.el.resultsNote,
      record
        ? previous === null
          ? 'First round on the books. Every light in the house and yard is burning again.'
          : `New best, ${formatTime(previous - time)} faster than before.`
        : `${formatTime(time - best)} off your best. The house waits for another round.`
    );
  }

  /** The rounds checklist: [{ id, label, room, on }]. */
  setRounds(visible, items, elapsed) {
    this.view.show(this.el.rounds, visible);
    if (!visible) return;
    const done = items.reduce((n, i) => n + (i.on ? 1 : 0), 0);
    this.view.text(this.el.roundsCount, `${done} / ${items.length}`);
    this.view.text(this.el.roundsTimer, formatTime(elapsed));
    this.view.html(
      this.el.roundsList,
      items.map((i) => `<li class="${i.on ? 'is-on' : ''}"><i aria-hidden="true"></i><span>${escapeHtml(i.label)}</span><small>${escapeHtml(i.room)}</small></li>`).join('')
    );
  }

  setPerf(p) {
    const v = this.view;
    const e = this.el.perf;
    v.text(e.fps, p.fps ? String(p.fps) : '—');
    v.text(e.frame, p.frameP95 ? `${p.frameP95.toFixed(1)} ms` : '—');
    v.text(e.cpu, p.cpuP95 ? `${p.cpuP95.toFixed(1)} ms` : '—');
    v.text(e.lights, p.lights);
    v.text(e.quality, p.quality);
    v.text(e.calls, p.calls ? String(p.calls) : '—');
    v.text(e.tris, p.triangles ? p.triangles.toLocaleString() : '—');
    v.text(e.shadows, `Sun ${p.sunUpdates} · Local ${p.localUpdates}`);
  }
}

/** Rolling frame and CPU timings: fps plus 95th percentiles over the last ~4 s. */
export class FrameStats {
  constructor(size = 240) {
    this.frame = new Float32Array(size);
    this.cpu = new Float32Array(size);
    this.scratch = new Float32Array(size);
    this.index = 0;
    this.count = 0;
    this.windowTime = 0;
    this.windowFrames = 0;
    this.fps = 0;
    this.frameP95 = 0;
    this.cpuP95 = 0;
  }

  /** Returns true about twice a second, when fresh numbers are ready. */
  push(frameSeconds, cpuMs) {
    if (!(frameSeconds > 0) || frameSeconds > 0.25) return false;
    this.frame[this.index] = frameSeconds * 1000;
    this.cpu[this.index] = cpuMs;
    this.index = (this.index + 1) % this.frame.length;
    this.count = Math.min(this.count + 1, this.frame.length);
    this.windowTime += frameSeconds;
    this.windowFrames += 1;
    if (this.windowTime < 0.5) return false;
    this.fps = Math.round(this.windowFrames / this.windowTime);
    this.windowTime = 0;
    this.windowFrames = 0;
    this.frameP95 = this.p95(this.frame);
    this.cpuP95 = this.p95(this.cpu);
    return true;
  }

  p95(values) {
    const n = this.count;
    const view = this.scratch.subarray(0, n);
    view.set(values.subarray(0, n));
    view.sort();
    return view[Math.min(n - 1, Math.max(0, Math.ceil(n * 0.95) - 1))];
  }
}

/**
 * Menu navigation from input actions: move (stick, D-pad, arrows, WASD) walks the
 * [data-nav] items of a container, left/right steps sliders, confirm (A / Enter)
 * clicks, back (B) or pause (Start / Esc) goes back. Stackable: the pause card can
 * hand over to the light panel and get it back.
 */
export class MenuNav {
  constructor(input) {
    this.input = input;
    this.stack = [];
    this.current = null;
    this.items = [];
    this.lastY = 0;
    this.lastX = 0;
    this.repeatY = 0;
    this.repeatX = 0;
  }

  get active() {
    return !!this.current;
  }

  get container() {
    return this.current?.container ?? null;
  }

  open(container, onBack) {
    this.stack.length = 0;
    this.current = { container, onBack, index: 0, openedAt: performance.now() };
    this.input.settle();
    this.paint();
  }

  push(container, onBack) {
    if (this.current) this.stack.push(this.current);
    this.current = { container, onBack, index: 0, openedAt: performance.now() };
    this.input.settle();
    this.paint();
  }

  pop() {
    this.current = this.stack.pop() || null;
    this.input.settle();
    this.paint();
  }

  close() {
    this.stack.length = 0;
    this.current = null;
    this.paint();
  }

  collect() {
    const c = this.current;
    this.items = c ? [...c.container.querySelectorAll('[data-nav]')].filter((el) => !el.disabled && !el.hidden && el.offsetParent !== null) : [];
    if (c) c.index = Math.max(0, Math.min(this.items.length - 1, c.index));
  }

  paint() {
    for (const el of document.querySelectorAll('.is-nav-focus')) el.classList.remove('is-nav-focus');
    this.collect();
    const el = this.current && this.items[this.current.index];
    if (!el) return;
    el.classList.add('is-nav-focus');
    el.scrollIntoView?.({ block: 'nearest' });
  }

  /** Point the highlight at an element (a mouse click on a card, say). */
  focus(el) {
    this.collect();
    const i = this.items.indexOf(el);
    if (i >= 0 && this.current) {
      this.current.index = i;
      this.paint();
    }
  }

  step(dir) {
    this.collect();
    if (!this.items.length || !this.current) return;
    this.current.index = (this.current.index + dir + this.items.length) % this.items.length;
    this.paint();
  }

  update() {
    const c = this.current;
    if (!c) return;
    const input = this.input;
    const now = performance.now();
    // Re-scan a few times a second (items can appear or hide), not every frame.
    if (now > (this.nextCollect || 0)) {
      this.nextCollect = now + 300;
      this.collect();
    }
    const item = this.items[c.index];
    const v = input.vector('move');
    const y = v.y > 0.55 ? -1 : v.y < -0.55 ? 1 : 0;
    const x = v.x > 0.55 ? 1 : v.x < -0.55 ? -1 : 0;
    const isRange = item?.type === 'range';
    // Up/down always walk the list; left/right walk it too, except on a slider.
    const dir = y || (isRange ? 0 : x);
    if (dir !== this.lastY) {
      this.lastY = dir;
      if (dir) {
        this.step(dir);
        this.repeatY = now + 380;
      }
    } else if (dir && now > this.repeatY) {
      this.step(dir);
      this.repeatY = now + 140;
    }
    const slide = isRange ? x : 0;
    if (slide !== this.lastX) {
      this.lastX = slide;
      if (slide) {
        this.nudge(item, slide);
        this.repeatX = now + 300;
      }
    } else if (slide && now > this.repeatX) {
      this.nudge(item, slide);
      this.repeatX = now + 60;
    }
    if (input.pressed('confirm') && item) {
      item.click();
      this.paint();
    }
    if (now - c.openedAt > 250 && (input.pressed('back') || input.pressed('pause'))) c.onBack?.();
  }

  nudge(el, dir) {
    const step = Number(el.step) || 0.01;
    const min = Number(el.min);
    const max = Number(el.max);
    const next = Math.min(max, Math.max(min, Number(el.value) + dir * step * 2));
    el.value = String(next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
