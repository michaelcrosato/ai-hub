import { Host, DIFFICULTY } from './host/Host.js';
import { MenuNav } from './host/MenuNav.js';
import { shell } from './shell.js';
import { validateHandoff } from './core/contracts.js';
import { downloadText } from './host/Package.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);
/** HUD writes only when the value changes (no DOM work every frame). */
const setText = (el, v) => {
  if (el && el._text !== v) {
    el._text = v;
    el.textContent = v;
  }
};
const setHTML = (el, v) => {
  if (el && el._html !== v) {
    el._html = v;
    el.innerHTML = v;
  }
};
const setStyle = (el, prop, v) => {
  const k = '_s_' + prop;
  if (el && el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
};
const toggle = (el, cls, on) => {
  const k = '_c_' + cls;
  if (el && el[k] !== on) {
    el[k] = on;
    el.classList.toggle(cls, on);
  }
};
const clock = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const SLOT = {
  breach: { chapter: '01', label: 'Breach' },
  escape: { chapter: '02', label: 'Escape' },
  arrival: { chapter: '03', label: 'Arrival' },
  finale: { chapter: '04', label: 'Departure' },
};
const ORDER = ['escape', 'arrival', 'finale'];
const TAGS = { foundry: 'FPS / COMBAT', 'foundry-alt': 'FPS / COMBAT', switchback: 'ARCADE / DRIVING', yard: 'FPS / SIGNALS', depot: 'FPS / LOGIC' };

/** Put the player markup in place. Called before the kit boots so the canvas can live in the stage. */
export function mountShell() {
  $('app').className = '';
  $('app').innerHTML = shell;
  document.body.classList.add('player');
}

export async function createApp(kit, registry) {
  const host = new Host(kit, registry);
  const nav = new MenuNav(kit);
  let noticeTimer = 0,
    variant = registry.entries.has(host.store.get('variant')) ? host.store.get('variant') : 'foundry';
  const chapter = (m = host.manifest) => SLOT[m?.slot]?.chapter || '01';
  const listen = (id, event, callback) => host.scope.on($(id), event, callback);
  const src = () => kit.input.source;
  const L = (action) => host.input.label(action);
  function dialog(title, html) {
    if (host.status === 'play') host.pause();
    $('dialog-title').textContent = title;
    $('dialog-body').innerHTML = html;
    if (!$('dialog').open) $('dialog').showModal();
  }
  /** The Northbound chain: one breach variant, then every other chapter in slot order. */
  function chain() {
    const all = registry.all(),
      first = all.find((x) => x.id === variant) || all[0];
    return [first, ...all.filter((x) => x.slot !== 'breach').sort((a, b) => ORDER.indexOf(a.slot) - ORDER.indexOf(b.slot))];
  }

  function overlayText(status) {
    if (status === 'loading') return 'Preparing the chapter and its local systems.';
    if (status === 'paused')
      return src() === 'keyboard' ? 'Simulation time is stopped. Resume to capture the mouse and continue.' : 'Simulation time is stopped. Resume when you are ready.';
    if (status === 'complete') return 'The northbound train is on its way. Every chapter time is below.';
    if (status === 'error') return 'Open Diagnostics in the guide for the latest error, then restart the chapter.';
    const driving = host.manifest?.kind === 'driving';
    if (src() === 'gamepad')
      return driving
        ? 'RT to accelerate, LT to reverse, left stick to steer, B to brake. Avoid the barriers and reach the Signal Yard.'
        : 'Left stick to move, right stick to aim, RT to fire, X to interact, Start to pause.';
    if (src() === 'touch')
      return driving
        ? 'Hold Gas, steer with the stick, tap Brake. Avoid the barriers and reach the Signal Yard.'
        : 'Move with the stick, drag to aim, tap Fire. Use appears when something is in reach. II pauses.';
    return driving
      ? 'Drive with W A S D. Use Space to brake. Avoid the barriers and reach the Signal Yard.'
      : `Move with W A S D. Use the mouse to aim. Click to fire. Press ${L('interact')} to interact. Press Esc to pause.`;
  }
  function refreshContinue() {
    const info = host.checkpointInfo(),
      title = info ? registry.entries.get(info.experience)?.manifest.title : '';
    $('continue-button').classList.toggle('hidden', !info || ['play', 'loading'].includes(host.status));
    if (info) $('continue-button').title = `Continue: ${title} (F8)`;
    $('overlay-continue').classList.toggle('hidden', !info || !['ready', 'complete', 'error'].includes(host.status));
    if (info) $('overlay-continue').textContent = `Continue: ${title}`;
  }
  function renderModes() {
    const status = host.status,
      test = ['play', 'paused', 'ready', 'complete'].includes(status);
    $('hud').classList.toggle('hidden', !test || status === 'complete');
    $('chapters-button').disabled = host.busy || status === 'loading';
    const overlay = ['loading', 'paused', 'ready', 'complete', 'error'].includes(status);
    $('modal-overlay').classList.toggle('hidden', !overlay);
    $('status-label').textContent =
      { play: 'Playing', paused: 'Paused', ready: 'Chapter ready', loading: 'Loading cartridge', complete: 'Northbound complete', error: 'Runtime stopped' }[status] ||
      status;
    const m = host.manifest;
    $('overlay-eyebrow').textContent =
      status === 'loading'
        ? 'LOADING CARTRIDGE'
        : status === 'complete'
          ? 'NORTHBOUND / COMPLETE'
          : status === 'error'
            ? 'RUNTIME STOPPED'
            : `CHAPTER ${chapter()} / ${status === 'paused' ? 'PAUSED' : SLOT[m?.slot]?.label.toUpperCase() || 'READY'}`;
    $('overlay-title').textContent =
      status === 'complete' ? 'End of the line.' : status === 'paused' ? 'Return to the sequence.' : status === 'error' ? 'Check the runtime.' : m?.title || 'Starting Strata';
    $('overlay-text').textContent = overlayText(status);
    $('results').classList.toggle('hidden', status !== 'complete');
    $('resume-button').classList.toggle('hidden', !['paused', 'ready'].includes(status));
    $('resume-button').textContent = status === 'paused' ? '▶ Resume' : m?.slot === 'breach' ? '▶ Start sequence' : '▶ Start chapter';
    $('restart-button').classList.toggle('hidden', !['paused', 'ready', 'complete', 'error'].includes(status));
    $('restart-button').textContent = status === 'complete' ? 'Replay the last chapter' : 'Restart chapter';
    $('rerun-button').classList.toggle('hidden', status !== 'complete');
    $('overlay-chapters').classList.toggle('hidden', !['paused', 'ready', 'complete', 'error'].includes(status));
    $('overlay-settings').classList.toggle('hidden', !['paused', 'ready', 'complete'].includes(status));
    $('handoff-button').classList.toggle('hidden', status !== 'complete');
    refreshContinue();
  }
  host.events.on('loaded', () => {
    if (host.manifest.slot === 'breach' && variant !== host.manifest.id) {
      variant = host.manifest.id;
      host.store.set('variant', variant);
    }
    $('active-physics').textContent = host.manifest.kind === 'driving' ? 'ARCADE / 60 Hz' : host.manifest.kind === 'fps' ? 'BOX PHYSICS / 60 Hz' : 'CUSTOM / 60 Hz';
  });
  host.events.on('status', renderModes);
  host.events.on('checkpoint', refreshContinue);
  host.events.on('notice', (text) => {
    clearTimeout(noticeTimer);
    $('notice').textContent = text;
    $('notice').classList.add('show');
    noticeTimer = setTimeout(() => $('notice').classList.remove('show'), 4500);
  });
  host.scope.own(() => clearTimeout(noticeTimer));
  host.events.on('stats', (s) => {
    setText($('fps-value'), `${s.fps} fps`);
    setText($('draws-value'), `${s.draws} draws`);
    setText($('triangles-value'), `${(s.triangles / 1000).toFixed(1)}k triangles`);
  });
  // A finished chapter: a toast and a chime for a new best (the notice line is busy with the next load).
  host.events.on('chapter', ({ title, time, previous, isBest }) => {
    if (isBest && previous) {
      kit.toast(`${title}: ${clock(time)}, a new best (was ${clock(previous)}).`);
      host.audio.play('best');
    }
  });

  /** The results card for a finished sequence: chapter times, combat statistics and the best run. */
  host.events.on('complete', (handoff) => {
    const times = handoff.extensions?.['strata.run']?.times || {},
      stats = handoff.stats || {},
      chapters = chain(),
      bests = host.chapterBests();
    const rows = chapters
      .filter((m) => Number.isFinite(times[m.id]))
      .map(
        (m) =>
          `<li><span>${esc(chapter(m))} / ${esc(m.title)}</span><b>${clock(times[m.id])}${bests[m.id] && bests[m.id] >= times[m.id] ? ' <em>best</em>' : ''}</b></li>`,
      );
    const total = Object.values(times).reduce((a, t) => a + (Number(t) || 0), 0);
    const accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
    // A full run (every chapter of the chain played in one go) can set a record.
    const full = chapters.every((m) => Number.isFinite(times[m.id]));
    let best = '';
    if (full) {
      const records = host.store.get('records', {}) || {},
        key = chapters[0].id,
        previous = Number(records[key]) || 0;
      if (!previous || total < previous) {
        records[key] = Math.round(total * 10) / 10;
        host.store.set('records', records);
        if (previous) host.audio.play('best');
        best = previous ? `<p class="results-best">New best run · was ${clock(previous)}</p>` : `<p class="results-best">First full run recorded.</p>`;
      } else best = `<p class="results-note">Best run ${clock(previous)}</p>`;
    } else best = `<p class="results-note">Run the whole sequence from chapter 01 to record a best run.</p>`;
    const vehicle = handoff.extensions?.['strata.driving'];
    setHTML(
      $('results'),
      `<ul class="results-times">${rows.join('')}<li class="total"><span>Total</span><b>${clock(total)}</b></li></ul>` +
        `<div class="results-stats"><div><b>${stats.kills || 0}</b><small>SENTRIES</small></div><div><b>${accuracy}%</b><small>ACCURACY</small></div><div><b>${vehicle ? Math.round(vehicle.health) + '%' : '—'}</b><small>VEHICLE</small></div><div><b>${Math.round(handoff.player?.health ?? 0)}</b><small>HEALTH</small></div></div>` +
        best,
    );
    renderModes();
  });

  /** Chapters: every chapter of the chain, locked until a run reaches it, with best times. */
  function showChapters() {
    const bests = host.chapterBests(),
      records = host.store.get('records', {}) || {},
      list = chain();
    const rows = list
      .map((m, i) => {
        const open = host.isReached(m.id),
          best = bests[m.id] ? `best ${clock(bests[m.id])}` : open ? 'no time yet' : 'locked · reach it in a run';
        const variantRow =
          i === 0 && registry.entries.has('foundry-alt')
            ? `<label class="settings-row chapter-variant">Breach variant<select id="variant-select" aria-label="Breach variant"><option value="foundry" ${variant === 'foundry' ? 'selected' : ''}>Standard breach</option><option value="foundry-alt" ${variant === 'foundry-alt' ? 'selected' : ''}>Crossfire</option></select></label>`
            : '';
        return `<button class="chapter-row${host.manifest?.id === m.id ? ' active' : ''}" data-chapter="${esc(m.id)}" ${open ? '' : 'disabled'}><span class="chapter-number">${esc(chapter(m))}</span><span class="chapter-info"><b>${esc(m.title)}</b><small>${esc(TAGS[m.id] || m.kind.toUpperCase())} · ${esc(m.subtitle)}</small></span><span class="chapter-best">${esc(best)}</span></button>${variantRow}`;
      })
      .join('');
    const run = records[variant] ? `Best full run (${variant === 'foundry-alt' ? 'Crossfire' : 'standard breach'}): ${clock(records[variant])}.` : 'No full run recorded yet.';
    dialog(
      'Northbound / Chapters',
      `<p>Start any chapter you have reached. A chapter started here begins with a fresh kit; a full run carries health, ammunition and the access card from one chapter to the next.</p><div class="chapter-list">${rows}</div><p class="hint">${esc(run)}</p><div class="dialog-footer-actions"><button class="quiet" data-action="run-sequence">▶ Run the whole sequence</button></div>`,
    );
  }
  const startChapter = async (id) => {
    if (host.busy || !host.isReached(id)) return;
    if ($('dialog').open) $('dialog').close();
    host.audio.unlock();
    await host.load(id, { mode: 'play', ready: true });
  };
  const runSequence = async () => {
    if (host.busy) return;
    if ($('dialog').open) $('dialog').close();
    host.audio.unlock();
    await host.load(variant, { mode: 'play', ready: true });
  };
  const continueRun = () => {
    if (host.busy) return;
    if ($('dialog').open) $('dialog').close();
    host.audio.unlock();
    void host.loadCheckpoint();
  };

  // Source-aware hints are rebuilt when the device changes, not every frame.
  let hintKey = '';
  function hints(driving) {
    const s = src();
    if (s === 'gamepad')
      return driving
        ? '<kbd>RT / LT</kbd> Accelerate / reverse &nbsp; <kbd>L STICK</kbd> Steer &nbsp; <kbd>B</kbd> Brake &nbsp; <kbd>Y</kbd> Reset'
        : '<kbd>L STICK</kbd> Move &nbsp; <kbd>L3</kbd> Sprint &nbsp; <kbd>A</kbd> Jump &nbsp; <kbd>X</kbd> Use &nbsp; <kbd>RB</kbd> Weapon';
    if (s === 'touch') return driving ? '<kbd>GAS / REV</kbd> Drive &nbsp; <kbd>STICK</kbd> Steer &nbsp; <kbd>VIEW</kbd> Camera' : '<kbd>STICK</kbd> Move (push to sprint) &nbsp; <kbd>DRAG</kbd> Look';
    return driving
      ? '<kbd>W S</kbd> Accelerate / reverse &nbsp; <kbd>A D</kbd> Steer &nbsp; <kbd>R</kbd> Reset'
      : `<kbd>W A S D</kbd> Move &nbsp; <kbd>Shift</kbd> Sprint &nbsp; <kbd>Space</kbd> Jump &nbsp; <kbd>${esc(L('interact'))}</kbd> Use`;
  }
  function weaponHint(h, driving) {
    if (driving) return `${L('brake')} / Brake · ${L('camera')} / Camera`;
    if (h.reloading) return 'Reloading…';
    return `${L('reload')} / Reload · ${L('swap')} / Switch`;
  }
  function navTarget() {
    const d = $('dialog');
    if (d.open) return { root: d, back: () => d.close() };
    if (!$('modal-overlay').classList.contains('hidden')) return { root: $('modal-overlay'), back: host.status === 'paused' ? () => void host.play() : null };
    return null;
  }
  const hud = {
    root: $('hud'),
    chapter: $('hud-chapter'),
    objective: $('hud-objective'),
    detail: $('hud-detail'),
    kit: $('hud-kit'),
    healthLabel: $('health-label'),
    health: $('health-value'),
    bar: $('health-bar'),
    weapon: $('weapon-name'),
    mag: $('mag-value'),
    reserve: $('reserve-value'),
    weaponHint: $('weapon-hint'),
    prompt: $('interaction'),
    crosshair: $('crosshair'),
    hit: $('hit-marker'),
    damage: $('damage-overlay'),
    hints: $('play-hints'),
    route: $('route-progress'),
    distance: $('route-distance'),
    fill: $('route-fill'),
  };
  host.events.on('frame', () => {
    const target = navTarget();
    nav.update(target?.root || null, target || {});
    if (!host.experience || !['play', 'paused', 'ready'].includes(host.status)) return;
    const h = host.experience.hud?.();
    hud.root.classList.toggle('hidden', !h);
    if (!h) return;
    const driving = h.kind === 'driving';
    // The chapter clock (whole seconds, so the eyebrow is rewritten once a second at most).
    setText(hud.chapter, `${chapter()} / ${host.manifest.title.toUpperCase()} · ${clock(host.experience.time || 0)}`);
    setText(hud.objective, h.objective);
    setText(hud.detail, h.detail);
    setText(hud.kit, driving ? 'ARCADE / DRIVING' : 'FPS / BOX PHYSICS');
    setText(hud.healthLabel, driving ? 'VEHICLE INTEGRITY' : 'PLAYER HEALTH');
    setText(hud.health, String(Math.round(h.health)));
    setStyle(hud.bar, 'width', `${h.health}%`);
    setText(hud.weapon, driving ? 'GROUND SPEED' : h.weapon);
    setText(hud.mag, String(driving ? h.speed : h.mag));
    setText(hud.reserve, driving ? 'km/h' : `/ ${h.reserve}`);
    setText(hud.weaponHint, weaponHint(h, driving));
    setText(hud.prompt, h.prompt);
    toggle(hud.crosshair, 'hidden', driving);
    setStyle(hud.hit, 'opacity', h.hit ? '1' : '0');
    setStyle(hud.damage, 'opacity', String(Math.min(0.85, Math.round((h.hurt || 0) * 50) / 50)));
    const key = src() + driving;
    if (key !== hintKey) {
      hintKey = key;
      setHTML(hud.hints, hints(driving));
    }
    toggle(hud.route, 'hidden', !driving);
    if (driving) {
      setText(hud.distance, h.best ? `${h.distance} / ${h.total} m · best ${h.best}` : `${h.distance} / ${h.total} m`);
      setStyle(hud.fill, 'width', `${(h.progress * 100).toFixed(1)}%`);
    }
  });
  kit.input.onSourceChange(() => {
    hintKey = '';
    if (['paused', 'ready'].includes(host.status)) $('overlay-text').textContent = overlayText(host.status);
  });

  listen('resume-button', 'click', () => void host.play());
  listen('restart-button', 'click', () => void host.restart());
  listen('rerun-button', 'click', runSequence);
  listen('continue-button', 'click', continueRun);
  listen('overlay-continue', 'click', continueRun);
  listen('overlay-settings', 'click', settings);
  listen('overlay-chapters', 'click', showChapters);
  listen('chapters-button', 'click', showChapters);
  listen('dialog-close', 'click', () => $('dialog').close());
  listen('dialog', 'click', (e) => {
    if (e.target === $('dialog')) {
      const r = $('dialog').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('dialog').close();
    }
  });
  // Buttons pressed with a gamepad inside the dialog should not also count as game input.
  listen('dialog', 'close', () => kit.input.settle());
  function showGuide() {
    dialog(
      'Strata / Field guide',
      `<h3>Northbound</h3><p>Four chapters, one continuous game. Clear the Foundry's four sentries and take the escape vehicle. Drive Switchback to the Signal Yard, open its gate, then end the line at the Northbound Depot: throw both breakers to power the gantry, ride it over the live rails, clear the platform, set the points and board car 03. Health, ammunition and the Foundry's access card carry from chapter to chapter, and the card opens the depot's lamp room.</p><h3>Chapters and records</h3><p>Chapters unlock as a run reaches them; start any of them from Chapters, where the Foundry's Crossfire variant lives too. Every finished chapter can set a best time, and a full run from chapter 01 sets a best run. Each new chapter saves a checkpoint: Continue (or F8) resumes it, F5 saves one during play.</p><h3>FPS controls</h3><p>Keyboard: W A S D move, mouse looks, left click fires, right click aims, Space jumps, Shift sprints, C crouches, E uses or carries, G throws, R reloads, 1 and 2 or the mouse wheel switch weapons, Backspace respawns. Gamepad: sticks move and aim, RT fires, LT aims, A jumps, B crouches, X uses, Y reloads, RB switches, LB throws, L3 sprints. Touch: stick to move (push to its rim to sprint), drag to look, on-screen buttons for the rest; Use and Throw appear when they apply.</p><h3>Driving controls</h3><p>W and S (RT and LT, Gas and Rev) accelerate and reverse. A and D (left stick) steer. Space (B, Brake) brakes. C (RB, View) changes the camera. R (Y, Reset) restarts at the route checkpoint.</p><h3>Settings</h3><p>Esc, P or Start pauses. Settings has volume, sentry difficulty and key choices; F9 opens the shared graphics and control settings.</p><h3>Build scope</h3><p>This release has world-aligned box collision, simple sentry AI, two weapons, and arcade driving. It has no multiplayer, mesh physics, navigation mesh, model importer, or live AI service. Cartridges are trusted code, not security sandboxes.</p><div class="dialog-footer-actions"><button class="quiet" data-action="diagnostics">Diagnostics</button><button class="quiet" data-action="import-handoff">Load handoff</button></div>`,
    );
  }
  listen('guide-button', 'click', showGuide);
  host.scope.on(document.querySelector('.brand'), 'click', (e) => {
    e.preventDefault();
    showGuide();
  });
  function settings() {
    const s = host.settings;
    dialog(
      'Player and browser settings',
      `<label class="settings-row">Sound volume<input type="range" id="setting-volume" min="0" max="1" step=".01" value="${s.volume}"></label><label class="settings-row">Mute sound<input type="checkbox" id="setting-muted" ${s.muted ? 'checked' : ''}></label><label class="settings-row">Camera head motion<input type="checkbox" id="setting-motion" ${s.motion ? 'checked' : ''}></label><label class="settings-row">Sentry difficulty<select id="setting-difficulty">${Object.entries(
        DIFFICULTY,
      )
        .map(([k, d]) => `<option value="${k}" ${s.difficulty === k ? 'selected' : ''}>${d.label}</option>`)
        .join(
          '',
        )}</select></label><p class="hint">Graphics quality, look speed, invert Y, touch layout and vibration are shared by every game on this wall.</p><button class="quiet wide" data-action="kit-settings">Graphics, controls and touch…</button><h3>Input preferences</h3><p class="hint">These keys apply to the matching actions in each cartridge. Gamepad and touch use the standard layout.</p>${[
        ['interact', 'Use / interact', 'KeyE'],
        ['reload', 'Reload', 'KeyR'],
        ['crouch', 'Crouch', 'KeyC'],
      ]
        .map(
          ([key, label, fallback]) =>
            `<label class="settings-row">${label}<select data-binding="${key}">${['KeyE', 'KeyF', 'KeyQ', 'KeyR', 'KeyC', 'KeyV', 'KeyX'].map((k) => `<option value="${k}" ${(s.bindings[key] || fallback) === k ? 'selected' : ''}>${k.replace('Key', '')}</option>`).join('')}</select></label>`,
        )
        .join(
          '',
        )}<p class="hint">Keyboard and mouse, a gamepad, or touch. Shared preferences do not change each cartridge’s movement rules.</p><div class="dialog-footer-actions"><button class="quiet" data-action="save">Save checkpoint</button><button class="quiet" data-action="load-save">Load checkpoint</button><button class="quiet" data-action="reset-progress">Reset progress</button></div>`,
    );
  }
  listen('settings-button', 'click', settings);
  listen('dialog-body', 'change', (e) => {
    const input = e.target;
    if (input.id === 'variant-select') {
      variant = input.value;
      host.store.set('variant', variant);
      showChapters();
      return;
    }
    if (input.id.startsWith('setting-')) {
      const key = input.id.slice(8);
      host.settings[key] = input.type === 'checkbox' ? input.checked : input.tagName === 'SELECT' ? input.value : Number(input.value);
      host.settingsChanged();
    }
    if (input.dataset.binding) {
      const key = input.dataset.binding,
        next = { interact: 'KeyE', reload: 'KeyR', crouch: 'KeyC', ...host.settings.bindings, [key]: input.value };
      if (new Set(Object.values(next)).size !== Object.values(next).length) {
        host.notify('These actions must use different keys.');
        settings();
        return;
      }
      host.settings.bindings = next;
      host.settingsChanged();
    }
  });
  const exportHandoff = () => downloadText('strata-handoff.json', JSON.stringify(host.lastHandoff || host.experience.exportState(), null, 2), 'application/json');
  listen('handoff-button', 'click', exportHandoff);
  listen('dialog-body', 'click', async (e) => {
    const row = e.target.closest('[data-chapter]');
    if (row) {
      await startChapter(row.dataset.chapter);
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'run-sequence') await runSequence();
    if (action === 'import-handoff') $('import-file').click();
    if (action === 'kit-settings') {
      $('dialog').close();
      kit.menu.open();
    }
    if (action === 'save') host.saveCheckpoint();
    if (action === 'load-save') {
      $('dialog').close();
      await host.loadCheckpoint();
    }
    if (action === 'reset-progress') {
      // Two presses, so a stray click (or a gamepad A) cannot wipe the records.
      const b = e.target.closest('[data-action]');
      b.dataset.action = 'reset-confirm';
      b.textContent = 'Press again to reset';
      return;
    }
    if (action === 'reset-confirm') {
      for (const key of ['reached', 'chapter-best', 'records', 'checkpoint', 'route-best']) host.store.remove(key);
      host.reached = new Set(['foundry', 'foundry-alt']);
      host.notify('Progress reset. Chapter 01 is open.');
      refreshContinue();
    }
    if (action === 'diagnostics') {
      const r = host.renderer;
      dialog(
        'Runtime diagnostics',
        `<p><strong>${esc(host.manifest?.title || 'No cartridge')}</strong><br>Status: ${host.status} / protocol 1</p><p>Live scenes: ${r.scenes.size}<br>Renderer: ${esc(r.backend)} · three.js · ${kit.tier.name} quality<br>Shared geometry types: ${r.geometries.size}<br>Visible meshes: ${r.stats.meshes}<br>Draw batches: ${r.stats.draws}<br>Dropped simulation time: ${host.clock.droppedTime.toFixed(3)} seconds<br>Browser storage: ${host.store.available ? 'available' : 'memory fallback'}</p><h3>Recent events</h3>${host.logs
          .slice(0, 15)
          .map((l) => `<p class="hint"><code>${esc(l.time)}</code> ${esc(l.text)}</p>`)
          .join('')}`,
      );
    }
  });
  listen('import-file', 'change', async () => {
    const file = $('import-file').files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw Error('The JSON file must be smaller than 2 MB.');
      const state = validateHandoff(JSON.parse(await file.text()));
      $('dialog').close();
      await host.load(host.manifest.id, { mode: 'play', handoff: state, ready: true });
    } catch (error) {
      host.notify(`Import failed: ${error.message}`);
    } finally {
      $('import-file').value = '';
    }
  });

  window.strata = {
    host,
    registry,
    exportHandoff: () => host.experience?.exportState(),
    diagnostics: () => ({
      status: host.status,
      experience: host.manifest?.id,
      liveScenes: host.renderer.scenes.size,
      backend: host.renderer.backend,
      geometryBuffers: host.renderer.geometries.size,
      ...host.renderer.stats,
    }),
    /** Open any chapter, reached or not (for testing). */
    load: (id) => host.load(id, { mode: 'play', ready: true }),
  };
  await host.load(variant, { mode: 'play' });
  renderModes();
  host.scope.on(window, 'pagehide', (e) => {
    if (!e.persisted) void host.dispose();
  });
  return host;
}
