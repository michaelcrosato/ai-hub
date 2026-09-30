import { Host } from './host/Host.js';
import { MenuNav } from './host/MenuNav.js';
import { shell } from './shell.js';
import { validateHandoff } from './core/contracts.js';
import { downloadText } from './host/Package.js';
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);
/** HUD writes only when the value changes (no layout work every frame). */
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
const SLOT = {
  breach: { chapter: '01', label: 'Breach' },
  escape: { chapter: '02', label: 'Escape' },
  arrival: { chapter: '03', label: 'Arrival' },
  finale: { chapter: '04', label: 'Finale' },
};
const FEATURED = 'cyberdyne';

/** Put the workbench markup in place. Called before the kit boots so the canvas can live in the stage. */
export function mountShell(studio = true) {
  $('app').className = '';
  $('app').innerHTML = shell;
  document.body.classList.toggle('player', !studio);
  $('product-type').textContent = studio ? 'WORKBENCH' : 'CARTRIDGE PLAYER';
}

export async function createApp(kit, registry, { studio = false, createEditor = null, start = null } = {}) {
  if (!$('viewport')) mountShell(studio);
  let boot = {};
  try {
    boot = JSON.parse($('strata-boot')?.textContent || '{}');
  } catch {}
  const host = new Host(kit, registry, { studio, boot });
  const nav = new MenuNav(kit);
  let editor = null,
    tab = 'experiences',
    noticeTimer = 0,
    importMode = 'document',
    variant = 'foundry';
  const chapter = () => SLOT[host.manifest?.slot]?.chapter || '01';
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
    const all = registry.all().filter((x) => x.id !== FEATURED),
      first = all.find((x) => x.id === variant) || all[0],
      order = ['escape', 'arrival', 'finale'];
    return [first, ...all.filter((x) => x.slot !== 'breach').sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))];
  }
  function artFor(e) {
    if (e.id === FEATURED) return ['t2', 'T2 / FEATURED'];
    if (e.kind === 'driving') return ['road', 'ARCADE / DRIVING'];
    if (e.id === 'yard') return ['yard', 'FPS / SIGNALS'];
    if (e.id === 'vault') return ['vault', 'FPS / LOGIC'];
    return ['', 'FPS / COMBAT'];
  }
  function cards() {
    const m = host.manifest,
      featured = registry.entries.get(FEATURED)?.manifest,
      primary = chain();
    const card = (e, number) => {
      const [art, tag] = artFor(e);
      return `<button class="experience-card ${m?.id === e.id ? 'active' : ''}" data-load="${esc(e.id)}"><div class="experience-art ${art}"><span class="art-number">${number}</span><span class="art-tag">${tag}</span></div><div class="experience-info"><b>${esc(e.title)}<span>${m?.id === e.id ? '↗' : ''}</span></b><small>${esc(e.subtitle)}</small></div></button>`;
    };
    $('experience-list').innerHTML =
      (featured ? card(featured, 'T2') + `<p class="aside-note">Northbound / the original sequence</p>` : '') +
      primary
        .map(
          (e, i) =>
            card(e, '0' + (i + 1)) +
            (i === 0 && registry.entries.has('foundry-alt')
              ? `<div class="variant-row"><span>Variant</span><select id="variant-select" aria-label="Combat variant"><option value="foundry" ${variant === 'foundry' ? 'selected' : ''}>Standard breach</option><option value="foundry-alt" ${variant === 'foundry-alt' ? 'selected' : ''}>Crossfire</option></select></div>`
              : ''),
        )
        .join('') +
      `<p class="aside-note">Each experience has its own rules.<br>The host connects their exits.</p>`;
    $('sequence-cards').innerHTML = primary
      .map(
        (e, i) =>
          `<button class="sequence-card ${m?.id === e.id ? 'active' : ''}" data-load="${esc(e.id)}"><small>0${i + 1} / ${e.kind.toUpperCase()}</small><b>${esc(e.title)}</b><span>${SLOT[e.slot]?.label || 'Chapter'}</span></button>`,
      )
      .join('');
  }
  function objects() {
    const doc = host.experience?.editor?.getDocument(),
      search = $('object-search').value.toLowerCase(),
      entities = doc?.entities || [];
    $('object-count').textContent = doc?.entities ? `${entities.length} objects` : 'Route parameters';
    $('add-button').disabled = !doc?.entities;
    if (!entities.length) {
      $('object-list').innerHTML = '<p class="empty">This experience uses a generated road. Change its route parameters in the inspector.</p>';
      return;
    }
    const groups = [
      ['Gameplay', (e) => e.components.length > 0 || e.prefab === 'crate'],
      ['Structure', (e) => !(e.components.length > 0 || e.prefab === 'crate') && ['block', 'column', 'stairs', 'set'].includes(e.prefab)],
      ['Nature', (e) => ['tree', 'rock'].includes(e.prefab)],
    ];
    $('object-list').innerHTML = groups
      .map(([label, filter]) => {
        const list = entities.filter(filter).filter((e) => (e.name + ' ' + e.prefab).toLowerCase().includes(search));
        return list.length
          ? `<div class="object-group">${label} / ${list.length}</div>` +
              list
                .map(
                  (e) =>
                    `<button class="object-row ${editor?.selected === e.id ? 'selected' : ''}" data-entity="${esc(e.id)}"><i>${e.prefab === 'enemy' || e.prefab === 'policecar' ? '⌖' : e.prefab === 'spawn' ? '↗' : e.prefab === 'exit' || e.prefab === 'goal' ? '▱' : '◇'}</i><span>${esc(e.name)}</span></button>`,
                )
                .join('')
          : '';
      })
      .join('');
  }
  const slider = (key, label, value, min, max, step = 1, source = 'player') =>
    `<label class="slider-row"><span>${label}<output data-output="${key}">${Number(value).toFixed(step < 1 ? 2 : 0)}</output></span><input type="range" aria-label="${label}" data-setting="${key}" data-source="${source}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
  function inspector() {
    if (!studio || !host.experience) return;
    const api = host.experience.editor;
    if (!api) {
      $('inspector').innerHTML = '<p class="empty">This cartridge does not expose an editor.</p>';
      return;
    }
    const doc = api.getDocument(),
      entity = doc.entities?.find((e) => e.id === editor?.selected);
    $('inspector-tag').textContent = entity ? 'OBJECT' : api.kind === 'driving' ? 'ROUTE' : 'LEVEL';
    if (entity) {
      $('inspector').innerHTML =
        `<div class="object-badge"><span>◇</span><div><b>${esc(api.prefabs().find((p) => p.id === entity.prefab)?.name || entity.prefab)}</b><small>${esc(entity.id)}</small></div></div><label class="field-label" for="object-name">Object name</label><input id="object-name" class="full-input" data-field="name" value="${esc(entity.name)}">${['position', 'rotation', 'scale'].map((key) => `<span class="field-label">${key === 'position' ? 'Position / meters' : key === 'rotation' ? 'Rotation / degrees' : 'Scale'}</span><div class="vector-fields">${entity[key].map((value, i) => `<label>${['X', 'Y', 'Z'][i]}<input type="number" aria-label="${key} ${['X', 'Y', 'Z'][i]}" data-field="${key}" data-axis="${i}" value="${Number(value.toFixed(3))}" step="${key === 'rotation' ? 15 : key === 'scale' ? 0.25 : 0.5}"></label>`).join('')}</div>`).join('')}<label class="color-row">Base color<input type="color" data-field="color" aria-label="Base color" value="${esc(entity.color || '#a6b38b')}"></label><div class="object-actions"><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button></div><label class="field-label" for="component-json">Components / JSON</label><textarea id="component-json" class="component-area" spellcheck="false">${esc(JSON.stringify(entity.components, null, 2))}</textarea><button class="apply-components" data-action="components">Apply components</button><p class="hint">Collision uses world-aligned boxes. A rotated box uses its full bounds.</p>`;
    } else if (api.kind === 'driving') {
      $('inspector').innerHTML =
        `<div class="object-badge"><span>▱</span><div><b>Driving experience</b><small>Independent arcade simulation</small></div></div><label class="field-label" for="level-name">Experience name</label><input id="level-name" class="full-input" data-level-field="name" value="${esc(doc.name)}"><p class="inspector-description">No FPS controller or box-physics world is created here. Player inventory passes through unchanged.</p><div class="section-label">ROUTE PARAMETERS <span>NEXT TEST</span></div>${api.fields.map((f) => slider(f.key, f.label, doc[f.key], f.min, f.max, f.step, 'document')).join('')}`;
    } else {
      $('inspector').innerHTML =
        `<div class="object-badge"><span>◇</span><div><b>Experience overview</b><small>Editable ${api.kind === 'custom' ? 'custom' : 'FPS'} cartridge</small></div></div><label class="field-label" for="level-name">Experience name</label><input id="level-name" class="full-input" data-level-field="name" value="${esc(doc.name)}"><label class="field-label" for="level-objective">Objective</label><input id="level-objective" class="full-input" data-level-field="objective" value="${esc(doc.objective)}"><p class="inspector-description">Select an object to change its position and behavior. Test changes without changing the source level.</p><div class="facts"><div><b>${doc.entities.length}</b><small>LEVEL OBJECTS</small></div><div><b>${api.prefabs().length}</b><small>READY PARTS</small></div></div><div class="section-label">PLAYER MOVEMENT <span>NEXT TEST</span></div>${slider('walkSpeed', 'Walk speed / m/s', doc.player.walkSpeed, 0.5, 15, 0.1)}${slider('jumpSpeed', 'Jump speed / m/s', doc.player.jumpSpeed, 1, 18, 0.1)}${slider('fov', 'Field of view / degrees', doc.player.fov, 50, 110)}<details><summary class="field-label">More movement settings</summary>${slider('sprintSpeed', 'Sprint speed / m/s', doc.player.sprintSpeed, 0.5, 25, 0.1)}${slider('gravity', 'Gravity / m/s²', doc.player.gravity, 1, 60)}${slider('acceleration', 'Acceleration / m/s²', doc.player.acceleration, 1, 100)}${slider('stepHeight', 'Step height / m', doc.player.stepHeight, 0, 0.5, 0.01)}${slider('headBob', 'Head motion', doc.player.headBob, 0, 1, 0.05)}</details>`;
    }
    $('capability-list').innerHTML = host.manifest.capabilities.map((c) => `<span class="capability">${esc(c)}</span>`).join('');
    $('contract-description').textContent =
      host.manifest.kind === 'driving'
        ? 'The driving kit owns its controls and simulation. Shared state stays in the host.'
        : host.manifest.kind === 'custom'
          ? 'This cartridge owns its own combat, vehicles and camera. The host owns the loop and the state.'
          : 'The FPS kit owns movement, collision, and combat. The host owns the sequence.';
  }
  function renderEditor() {
    objects();
    inspector();
    for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('active', b.dataset.tool === editor?.tool);
    $('snap-button').classList.toggle('active', !!editor?.snap);
    $('undo-button').disabled = !editor?.historyState?.canUndo || host.status !== 'edit';
    $('redo-button').disabled = !editor?.historyState?.canRedo || host.status !== 'edit';
  }
  if (createEditor) editor = createEditor(host, renderEditor);
  function overlayText(status) {
    if (status === 'loading') return 'Preparing the experience and its local systems.';
    if (status === 'paused')
      return src() === 'keyboard' ? 'Simulation time is stopped. Resume to capture the mouse and continue.' : 'Simulation time is stopped. Resume when you are ready.';
    if (status === 'complete') return 'This experience has reached its exit. The player state is ready for the next cartridge.';
    if (status === 'error') return 'Open Diagnostics in the guide for the latest error. Restart the experience or return to the workbench.';
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
      : 'Move with W A S D. Use the mouse to aim. Click to fire. Press E to interact. Press Esc to pause.';
  }
  function renderModes() {
    const status = host.status,
      edit = status === 'edit',
      test = ['play', 'paused', 'ready', 'complete'].includes(status);
    document.body.classList.toggle('editing', edit);
    document.body.classList.toggle('playing', !edit && test);
    $('hud').classList.toggle('hidden', !test);
    $('play-button').classList.toggle('hidden', test);
    $('stop-button').classList.toggle('hidden', !test || !studio);
    $('play-button').disabled = host.busy || status === 'loading' || status === 'error';
    $('play-button').querySelector('span').textContent = studio ? 'Play test' : 'Play';
    $('export-button').disabled = status === 'loading';
    const overlay = ['loading', 'paused', 'ready', 'complete', 'error'].includes(status);
    $('modal-overlay').classList.toggle('hidden', !overlay);
    $('status-label').textContent =
      {
        edit: 'Workbench ready',
        play: 'Play test',
        paused: 'Paused',
        ready: 'Experience ready',
        loading: 'Loading cartridge',
        complete: 'Sequence complete',
        error: 'Runtime stopped',
      }[status] || status;
    $('overlay-eyebrow').textContent =
      {
        loading: 'LOADING CARTRIDGE',
        paused: 'SIMULATION PAUSED',
        ready: 'EXPERIENCE READY',
        complete: 'HANDOFF COMPLETE',
        error: 'RUNTIME STOPPED',
      }[status] || '';
    $('overlay-title').textContent =
      status === 'complete'
        ? 'Sequence complete.'
        : status === 'paused'
          ? 'Return to the sequence.'
          : status === 'error'
            ? 'Check the runtime.'
            : host.manifest?.title || 'Starting Strata';
    $('overlay-text').textContent = overlayText(status);
    $('resume-button').classList.toggle('hidden', !['paused', 'ready'].includes(status));
    $('resume-button').textContent = status === 'paused' ? '▶ Resume' : '▶ Start sequence';
    $('restart-button').classList.toggle('hidden', !['paused', 'ready', 'complete', 'error'].includes(status));
    $('overlay-settings').classList.toggle('hidden', !['paused', 'ready'].includes(status));
    $('return-button').classList.toggle('hidden', !studio || status === 'loading');
    $('handoff-button').classList.toggle('hidden', status !== 'complete');
    renderEditor();
  }
  host.events.on('loaded', () => {
    if (host.manifest.slot === 'breach' && host.manifest.id !== FEATURED) variant = host.manifest.id;
    cards();
    $('scene-eyebrow').textContent = `CHAPTER ${host.manifest.id === FEATURED ? 'T2' : chapter()} / ${host.manifest.kind === 'driving' ? 'ARCADE DRIVING' : host.manifest.kind === 'custom' ? 'CUSTOM SCENE' : 'FPS KIT'}`;
    $('scene-title').innerHTML = `${esc(host.experience.document?.name || host.manifest.title)}<span>.</span>`;
    $('scene-subtitle').textContent = host.manifest.subtitle;
    $('active-physics').textContent =
      host.manifest.kind === 'driving' ? 'ARCADE / 60 Hz' : host.manifest.kind === 'fps' ? 'BOX PHYSICS / 60 Hz' : 'CUSTOM / 60 Hz';
    renderEditor();
  });
  host.events.on('status', renderModes);
  host.events.on('document', renderEditor);
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
  host.events.on('resume-request', () => {
    if (host.manifest?.id === FEATURED) return; // the T2 overlay has its own pause screen
    void host.play();
  });
  // Source-aware hints are rebuilt when the device changes, not every frame.
  let hintKey = '';
  function hints(driving) {
    const s = src();
    if (s === 'gamepad')
      return driving
        ? '<kbd>RT / LT</kbd> Accelerate / reverse &nbsp; <kbd>L STICK</kbd> Steer &nbsp; <kbd>B</kbd> Brake &nbsp; <kbd>Y</kbd> Reset'
        : `<kbd>L STICK</kbd> Move &nbsp; <kbd>L3</kbd> Sprint &nbsp; <kbd>A</kbd> Jump &nbsp; <kbd>X</kbd> Use &nbsp; <kbd>RB</kbd> Weapon`;
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
    const t2 = host.overlay?.menu?.();
    if (t2) return t2;
    if (!$('modal-overlay').classList.contains('hidden') && host.manifest?.id !== FEATURED)
      return { root: $('modal-overlay'), back: host.status === 'paused' ? () => void host.play() : null };
    if (host.status === 'edit') return { root: $('app'), keyboard: false };
    return null;
  }
  host.events.on('frame', () => {
    const target = navTarget();
    nav.update(target?.root || null, target || {});
    if (!host.experience || !['play', 'paused', 'ready', 'complete'].includes(host.status)) return;
    const h = host.experience.hud?.();
    $('hud').classList.toggle('hidden', !h);
    if (!h) return;
    const driving = h.kind === 'driving';
    setText($('hud-chapter'), `${chapter()} / ${host.manifest.title.toUpperCase()}`);
    setText($('hud-objective'), h.objective);
    setText($('hud-detail'), h.detail);
    setText($('hud-kit'), driving ? 'ARCADE / DRIVING' : 'FPS / BOX PHYSICS');
    setText($('health-label'), driving ? 'VEHICLE INTEGRITY' : 'PLAYER HEALTH');
    setText($('health-value'), String(Math.round(h.health)));
    setStyle($('health-bar'), 'width', `${h.health}%`);
    setText($('weapon-name'), driving ? 'GROUND SPEED' : h.weapon);
    setText($('mag-value'), String(driving ? h.speed : h.mag));
    setText($('reserve-value'), driving ? 'km/h' : `/ ${h.reserve}`);
    setText($('weapon-hint'), weaponHint(h, driving));
    setText($('interaction'), h.prompt);
    $('crosshair').classList.toggle('hidden', driving);
    setStyle($('hit-marker'), 'opacity', h.hit ? '1' : '0');
    setStyle($('damage-overlay'), 'opacity', String(Math.min(0.85, h.hurt || 0)));
    const key = src() + driving;
    if (key !== hintKey) {
      hintKey = key;
      setHTML($('play-hints'), hints(driving));
    }
    $('route-progress').classList.toggle('hidden', !driving);
    if (driving) {
      setText($('route-distance'), h.best ? `${h.distance} / ${h.total} m · best ${h.best}` : `${h.distance} / ${h.total} m`);
      setStyle($('route-fill'), 'width', `${h.progress * 100}%`);
    }
  });
  kit.input.onSourceChange(() => {
    hintKey = '';
    if (['paused', 'ready'].includes(host.status)) $('overlay-text').textContent = overlayText(host.status);
  });
  host.scope.on(document, 'click', (e) => {
    const load = e.target.closest('[data-load]');
    if (load && !host.busy) {
      editor?.select(null);
      void host.load(load.dataset.load, { mode: studio ? 'edit' : 'play' });
    }
    const tool = e.target.closest('[data-tool]');
    if (tool) editor?.setTool(tool.dataset.tool);
  });
  listen('experience-list', 'change', (e) => {
    if (e.target.id === 'variant-select') {
      variant = e.target.value;
      void host.load(variant, { mode: studio ? 'edit' : 'play' });
    }
  });
  listen('tab-experiences', 'click', () => switchTab('experiences'));
  listen('tab-objects', 'click', () => switchTab('objects'));
  function switchTab(next) {
    tab = next;
    $('experience-list').classList.toggle('hidden', tab !== 'experiences');
    $('objects-panel').classList.toggle('hidden', tab !== 'objects');
    $('tab-experiences').classList.toggle('active', tab === 'experiences');
    $('tab-objects').classList.toggle('active', tab === 'objects');
  }
  listen('object-search', 'input', objects);
  listen('object-list', 'click', (e) => {
    const row = e.target.closest('[data-entity]');
    if (row) editor?.select(row.dataset.entity);
  });
  listen('play-button', 'click', () => void host.play());
  listen('stop-button', 'click', () => void host.edit());
  listen('resume-button', 'click', () => void host.play());
  listen('return-button', 'click', () => void host.edit());
  listen('restart-button', 'click', () => void host.restart());
  listen('overlay-settings', 'click', () => kit.menu.open());
  listen('title-button', 'click', () => {
    if (host.busy || !registry.entries.has(FEATURED)) return;
    editor?.select(null);
    host.audio.unlock();
    void host.load(FEATURED, { mode: 'play', ready: true });
  });
  listen('home-button', 'click', () => editor?.home());
  listen('focus-button', 'click', () => editor?.focus());
  listen('snap-button', 'click', () => {
    if (editor) {
      editor.snap = !editor.snap;
      renderEditor();
    }
  });
  listen('undo-button', 'click', () => void editor?.history('undo'));
  listen('redo-button', 'click', () => void editor?.history('redo'));
  listen('run-sequence', 'click', async () => {
    if (host.busy) return;
    host.audio.unlock();
    await host.load(variant, { mode: 'play', ready: true });
  });
  listen('inspector', 'input', (e) => {
    const key = e.target.dataset.setting;
    if (key) {
      const output = document.querySelector(`[data-output="${key}"]`);
      if (output) output.textContent = Number(e.target.value).toFixed(Number(e.target.step) < 1 ? 2 : 0);
    }
  });
  listen('inspector', 'change', (e) => {
    const input = e.target;
    if (!editor) return;
    const field = input.dataset.field,
      key = input.dataset.setting,
      level = input.dataset.levelField;
    void editor.commit((doc) => {
      if (level && ['name', 'objective'].includes(level)) doc[level] = input.value;
      else if (key) {
        if (input.dataset.source === 'document') doc[key] = Number(input.value);
        else doc.player[key] = Number(input.value);
      } else if (field) {
        const entity = doc.entities.find((x) => x.id === editor.selected);
        if (!entity) return;
        if (['position', 'rotation', 'scale'].includes(field)) entity[field][Number(input.dataset.axis)] = Number(input.value);
        else if (['name', 'color'].includes(field)) entity[field] = input.value;
      }
    });
  });
  listen('inspector', 'click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'duplicate') void editor?.duplicate();
    if (action === 'delete') void editor?.remove();
    if (action === 'components') {
      try {
        const components = JSON.parse($('component-json').value);
        void editor.commit((doc) => {
          doc.entities.find((x) => x.id === editor.selected).components = components;
        });
      } catch (error) {
        host.notify(error.message);
      }
    }
  });
  listen('dialog-close', 'click', () => $('dialog').close());
  listen('dialog', 'click', (e) => {
    if (e.target === $('dialog')) {
      const r = $('dialog').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('dialog').close();
    }
  });
  // Buttons pressed with a gamepad inside the dialog should not also count as game input.
  listen('dialog', 'close', () => kit.input.settle());
  listen('add-button', 'click', () => {
    const prefabs = host.experience?.editor?.prefabs?.();
    if (!prefabs) return;
    dialog(
      'Add a building block',
      `<p>New objects are placed at the center of the editor view. Select Move to position them.</p><div class="asset-grid">${prefabs.map((p) => `<button class="asset-button" data-add="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.group)}</small></button>`).join('')}</div>`,
    );
  });
  function showGuide() {
    dialog(
      'Strata / Field guide',
      `<h3>T2 / Cyberdyne</h3><p>The featured scene. Disable the patrol cars and let the officers withdraw, then hold the balcony against endless waves. Tab (Y on a gamepad, Vision on touch) scans; Q (X) locks a scanned vehicle; hold right mouse (LT, Aim) to assist aim; C or Ctrl (B, Crouch) takes cover. Each cleared wave saves a checkpoint you can continue from the title screen. The original chapters remain below.</p><h3>Test the Northbound sequence</h3><p>The Foundry is an FPS experience. Disable the four sentries and use the vehicle. Switchback then starts with its own driving controls. The Signal Yard and The Vault close the sequence: power the vault with three signal cells and clear its sentries.</p><h3>Build and test</h3><p>Use Objects to select a part. Change its transform or components in the inspector. Use Q to orbit, W to move, E to rotate, and R to scale. Drag the selected object to change it; pinch or scroll to zoom. Play test uses a separate runtime copy. A gamepad can walk the workbench with the D-pad and A.</p><h3>FPS controls</h3><p>Keyboard: W A S D move, mouse looks, left click fires, right click aims, Space jumps, Shift sprints, C crouches, E uses or carries, G throws, R reloads, 1 and 2 switch weapons, Backspace respawns. Gamepad: sticks move and aim, RT fires, LT aims, A jumps, B crouches, X uses, Y reloads, RB switches, LB throws. Touch: stick to move (push to its rim to sprint), drag to look, on-screen buttons for the rest.</p><h3>Driving controls</h3><p>W and S (RT and LT, Gas and Rev) accelerate and reverse. A and D (left stick) steer. Space (B, Brake) brakes. C (RB, View) changes the camera. R (Y, Reset) restarts at the route checkpoint.</p><h3>Save and transfer</h3><p>F5 saves a play checkpoint. F8 loads it. F9 opens graphics and control settings. Export saves the level document or the shared handoff state as JSON; the workbench can import both.</p><h3>Build scope</h3><p>This release has world-aligned box collision, simple sentry AI, two weapons, arcade driving and a custom T2 scene. It has no multiplayer, mesh physics, navigation mesh, model importer, or live AI service. Cartridges are trusted code, not security sandboxes.</p><div class="dialog-footer-actions"><button class="quiet" data-action="diagnostics">Diagnostics</button><button class="quiet" data-action="import-handoff">Load handoff</button>${studio ? '<button class="quiet" data-action="import-level">Import level</button>' : ''}</div>`,
    );
  }
  listen('guide-button', 'click', showGuide);
  document.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    showGuide();
  });
  function settings() {
    const s = host.settings;
    dialog(
      'Player and browser settings',
      `<label class="settings-row">Sound volume<input type="range" id="setting-volume" min="0" max="1" step=".01" value="${s.volume}"></label><label class="settings-row">Mute sound<input type="checkbox" id="setting-muted" ${s.muted ? 'checked' : ''}></label><label class="settings-row">Camera head motion<input type="checkbox" id="setting-motion" ${s.motion ? 'checked' : ''}></label><p class="hint">Graphics quality, look speed, invert Y, touch layout and vibration are shared by every game on this wall.</p><button class="quiet wide" data-action="kit-settings">Graphics, controls and touch…</button><h3>Input preferences</h3><p class="hint">These keys apply to the matching actions in each cartridge. Gamepad and touch use the standard layout.</p>${[
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
        )}<p class="hint">Keyboard and mouse, a gamepad, or touch. Shared preferences do not change each cartridge’s movement rules.</p><div class="dialog-footer-actions"><button class="quiet" data-action="save">Save checkpoint</button><button class="quiet" data-action="load-save">Load checkpoint</button></div>`,
    );
  }
  listen('settings-button', 'click', settings);
  listen('dialog-body', 'change', (e) => {
    const input = e.target;
    if (input.id.startsWith('setting-')) {
      const key = input.id.slice(8);
      host.settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
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
  listen('export-button', 'click', () =>
    dialog(
      'Export an experience',
      `<button class="dialog-action" data-export="json"><b>Level document / JSON ↗</b><small>Editable source data for the current cartridge, including your level edits. No play state or executable code.</small></button><button class="dialog-action" data-export="handoff"><b>Player handoff / JSON ↗</b><small>The shared player state: health, inventory, ammunition, story flags and statistics.</small></button><button class="quiet wide" data-action="import-level">Import level JSON</button><button class="quiet wide" data-action="import-handoff">Load handoff JSON</button>`,
    ),
  );
  function buildBrief() {
    const doc = host.experience.document;
    return `Build a new Strata cartridge for this project.\n\nContract: protocol 1, profile strata.soldier/1. Export create() from the experience module. Return a new instance. The instance must have mount(context, handoff), fixedUpdate(dt), update(dt, alpha), exportState(), and dispose(). saveLocal() is optional.\n\nContext provides scene, scope, input, audio, settings, document, local, manifest, notify(text), rumble(strength, ms), checkpoint() and requestExit(exitName). The host owns the frame loop. Do not create another loop or read another cartridge's internals. Keep local state local. Export only JSON. Preserve unknown fields in the shared state. Declare a control scheme ('fps', 'driving' or 'cyberdyne') in the controls profile so keyboard, gamepad and touch map to its actions.\n\nAn FPS cartridge can return new FPSExperience(levelDocument). A driving or custom cartridge can use its own simulation. Keep imports inside the selected kit. Add a manifest and loader to the registry.\n\nCurrent manifest:\n${JSON.stringify(host.manifest, null, 2)}\n\nCurrent authored document:\n${JSON.stringify(doc, null, 2)}\n\nChange the experience to match the design brief below. Add tests for the new behavior. Do not expand the host without a demonstrated need.\n\nDESIGN BRIEF:\n[Describe the intended experience here.]`;
  }
  listen('brief-button', 'click', () =>
    dialog(
      'Cartridge build brief',
      `<p>Copy this interface and the current document into your coding tool. This workbench does not call an AI service.</p><textarea id="brief-text" class="brief-area" spellcheck="false">${esc(buildBrief())}</textarea><button class="primary wide" data-action="copy-brief">Copy build brief</button>`,
    ),
  );
  const exportHandoff = () =>
    downloadText('strata-handoff.json', JSON.stringify(host.lastHandoff || host.experience.exportState(), null, 2), 'application/json');
  listen('handoff-button', 'click', exportHandoff);
  listen('dialog-body', 'click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      $('dialog').close();
      switchTab('objects');
      await editor?.add(add.dataset.add);
      return;
    }
    const exp = e.target.closest('[data-export]');
    if (exp) {
      try {
        if (exp.dataset.export === 'json')
          downloadText(`${host.manifest.id}.json`, JSON.stringify(host.experience.document, null, 2), 'application/json');
        else exportHandoff();
        $('dialog').close();
      } catch (error) {
        host.notify(error.message);
      }
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'import-level' || action === 'import-handoff') {
      importMode = action === 'import-level' ? 'document' : 'handoff';
      $('import-file').click();
    }
    if (action === 'kit-settings') {
      $('dialog').close();
      kit.menu.open();
    }
    if (action === 'save') host.saveCheckpoint();
    if (action === 'load-save') {
      $('dialog').close();
      await host.loadCheckpoint();
    }
    if (action === 'diagnostics') {
      const r = host.renderer;
      dialog(
        'Runtime diagnostics',
        `<p><strong>${esc(host.manifest?.title || 'No cartridge')}</strong><br>Status: ${host.status} / protocol 1</p><p>Live scenes: ${r.scenes.size}<br>Renderer: ${esc(r.backend)} / three.js r${esc(kit.THREE.REVISION)} / quality ${esc(kit.tier.name)}<br>Shared geometry types: ${r.geometries.size}<br>Visible meshes: ${r.stats.meshes}<br>Draw calls: ${r.stats.draws}<br>Input: ${esc(src())}<br>Dropped simulation time: ${host.clock.droppedTime.toFixed(3)} seconds<br>Browser storage: ${host.store.available ? 'available' : 'memory fallback'}</p><h3>Recent events</h3>${host.logs
          .slice(0, 15)
          .map((l) => `<p class="hint"><code>${esc(l.time)}</code> ${esc(l.text)}</p>`)
          .join('')}`,
      );
    }
    if (action === 'copy-brief') {
      const text = $('brief-text');
      try {
        await navigator.clipboard.writeText(text.value);
        host.notify('Build brief copied.');
      } catch {
        text.select();
        host.notify('Press Ctrl+C or Command+C to copy the selected brief.');
      }
    }
  });
  listen('import-file', 'change', async () => {
    const file = $('import-file').files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw Error('The JSON file must be smaller than 2 MB.');
      const raw = JSON.parse(await file.text());
      $('dialog').close();
      if (importMode === 'handoff') {
        const state = validateHandoff(raw);
        await host.load(host.manifest.id, { mode: 'play', handoff: state, ready: true });
      } else {
        if (host.status !== 'edit') await host.edit();
        if (!editor) throw Error('Open the workbench to import a level.');
        await editor.commit((doc) => {
          for (const key of Object.keys(doc)) delete doc[key];
          Object.assign(doc, raw);
        });
      }
    } catch (error) {
      host.notify(`Import failed: ${error.message}`);
    } finally {
      $('import-file').value = '';
    }
  });
  const first = start && registry.entries.has(start) ? start : registry.entries.has(boot.start) ? boot.start : registry.all()[0]?.id;
  window.strata = {
    host,
    registry,
    editor,
    exportDocument: () => structuredClone(host.experience?.document),
    exportHandoff: () => host.experience?.exportState(),
    diagnostics: () => ({
      status: host.status,
      experience: host.manifest?.id,
      liveScenes: host.renderer.scenes.size,
      backend: host.renderer.backend,
      geometryBuffers: host.renderer.geometries.size,
      ...host.renderer.stats,
    }),
    load: (id) => host.load(id, { mode: studio ? 'edit' : 'play' }),
  };
  // The featured scene opens on its own title screen; the workbench is one button away.
  await host.load(first, start ? { mode: 'play', ready: true } : { mode: studio ? 'edit' : 'play' });
  renderModes();
  cards();
  host.scope.on(window, 'pagehide', (e) => {
    if (!e.persisted) {
      editor?.dispose();
      void host.dispose();
    }
  });
  return host;
}
