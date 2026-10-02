import { defaultMotor } from '../core/motor.js';
import { controlRows, promptLabel } from '../engine/Input.js';
import { IMPORT_SLOT } from '../level/library.js';
import { MenuNav } from './MenuNav.js';
const elements = new Map();
const $ = (id) => {
    let element = elements.get(id);
    if (!element) {
        element = document.getElementById(id);
        if (!element)
            throw new Error(`Missing UI element: ${id}`);
        elements.set(id, element);
    }
    return element;
};
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = { block: '◇', column: '▥', stairs: '▤', crate: '⬡', switch: '⊙', plate: '▣', door: '▥', platform: '▱', trigger: '▧', pickup: '◈', checkpoint: '◎', pad: '⇧', hazard: '△', goal: 'Π', tree: '♧', rock: '⬡', spawn: '↗' };
/** m:ss.t */
export const formatTime = (seconds) => {
    if (seconds == null || !Number.isFinite(seconds))
        return '—';
    const tenths = Math.floor(seconds * 10), s = Math.floor(tenths / 10) % 60, m = Math.floor(tenths / 600);
    return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`;
};
const firstSentence = (text) => (String(text).match(/^[^.!?]*[.!?]/)?.[0] ?? String(text)).trim();
const SUBTITLES = { yard: 'MOVEMENT & INTERACTION', quarry: 'SIGNALS & PHYSICS', [IMPORT_SLOT]: 'IMPORTED LEVEL' };
/** The one-line control strip under the crosshair (touch shows its own buttons instead). */
const STRIP = {
    keyboard: [['W A S D', 'Move'], ['Space', 'Jump'], ['Shift', 'Sprint'], ['C', 'Crouch'], ['E', 'Use'], ['Click', 'Throw'], ['R', 'Reset'], ['Esc', 'Pause']],
    gamepad: [['L stick', 'Move'], ['A', 'Jump'], ['L3', 'Sprint'], ['B', 'Crouch'], ['X', 'Use'], ['RT', 'Throw'], ['View', 'Reset'], ['Start', 'Pause']],
};
const EDITOR_HINTS = {
    keyboard: '<kbd>Drag</kbd> Orbit <b>·</b> <kbd>Right drag</kbd> Pan <b>·</b> <kbd>Scroll</kbd> Zoom',
    touch: '<kbd>Drag</kbd> Orbit <b>·</b> <kbd>Two fingers</kbd> Pan and zoom <b>·</b> <kbd>Tap</kbd> Select',
    gamepad: '<kbd>A</kbd> Play test <b>·</b> <kbd>R stick</kbd> Orbit <b>·</b> <kbd>L stick</kbd> Pan <b>·</b> <kbd>LT RT</kbd> Zoom <b>·</b> <kbd>LB RB</kbd> Select <b>·</b> <kbd>X</kbd> Focus <b>·</b> <kbd>Y</kbd> Levels',
};
export class Panel {
    engine;
    editor;
    library;
    nav;
    tab = 'scene';
    search = '';
    noticeTimer = 0;
    flashTimer = 0;
    debug = false;
    levelsOpen = false;
    /** Last value written per HUD field, so the DOM only changes when a value does. */
    #hud = new Map();
    constructor(engine, editor, library) {
        this.engine = engine;
        this.editor = editor;
        this.library = library;
        this.nav = new MenuNav(engine.kit.input);
        editor.blocked = () => this.levelsOpen;
        const click = (id, fn) => $(id).addEventListener('click', fn);
        click('play', () => engine.play());
        click('stop', () => engine.stop());
        click('resume', () => engine.resume());
        click('restart', () => engine.restart());
        click('return-editor', () => engine.stop());
        click('pause-settings', () => engine.kit.menu.open());
        click('pause-sound', () => this.setSound(!engine.sound.muted));
        click('results-again', () => engine.restart());
        click('results-next', () => {
            const next = library.next(engine.slot);
            if (next)
                this.openLevel(next, { play: true });
        });
        click('results-explore', () => engine.resume());
        click('results-editor', () => engine.stop());
        click('levels-open', () => this.openLevels());
        click('levels-close', () => this.closeLevels());
        $('levels-list').addEventListener('click', e => {
            const button = e.target.closest('[data-level]');
            if (!button)
                return;
            const id = button.dataset.level, action = button.dataset.action;
            if (action === 'play')
                this.openLevel(id, { play: true });
            else if (action === 'edit')
                this.openLevel(id);
            else if (action === 'reset')
                this.resetLevel(id, button);
        });
        click('undo', () => engine.undo());
        click('redo', () => engine.redo());
        click('focus', () => editor.focus());
        click('home', () => editor.home());
        click('grid', () => editor.toggleGrid());
        click('debug', () => { this.debug = !this.debug; engine.setDebug(this.debug); $('debug').classList.toggle('active', this.debug); });
        click('snap', () => { editor.setSnap(!editor.snapping); this.toggle($('snap'), editor.snapping); });
        click('sound', () => this.setSound(!engine.sound.muted));
        click('display', () => engine.kit.menu.open());
        click('settings', () => engine.kit.menu.open());
        click('add-object', () => this.switchTab('assets'));
        document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => this.switchTab(button.dataset.tab)));
        document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => editor.setTool(button.dataset.tool)));
        $('search').addEventListener('input', () => { this.search = $('search').value.toLowerCase(); this.renderList(); });
        $('scene-list').addEventListener('click', e => {
            const button = e.target.closest('[data-entity]');
            if (button)
                editor.select(button.dataset.entity);
        });
        $('asset-list').addEventListener('click', e => {
            const button = e.target.closest('[data-prefab]');
            if (button)
                editor.add(button.dataset.prefab);
        });
        $('inspector').addEventListener('change', e => this.changeInspector(e.target));
        $('inspector').addEventListener('click', e => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'duplicate')
                editor.duplicate();
            if (action === 'delete')
                editor.remove();
            if (action === 'components') {
                try {
                    const components = JSON.parse($('component-json').value);
                    if (!Array.isArray(components))
                        throw new Error('Components must be an array.');
                    const id = editor.selected;
                    engine.commit(d => {
                        const entity = d.entities.find(e => e.id === id);
                        if (entity)
                            entity.components = components;
                    });
                }
                catch (error) {
                    engine.notice(error instanceof Error ? error.message : String(error));
                }
            }
        });
        $('player-settings').addEventListener('input', e => {
            const input = e.target;
            if (input.dataset.setting)
                $(`value-${input.dataset.setting}`).textContent = this.formatSetting(input.dataset.setting, Number(input.value));
        });
        $('player-settings').addEventListener('change', e => {
            const input = e.target, key = input.dataset.setting;
            if (key)
                engine.commit(d => { d.player[key] = Number(input.value); });
        });
        document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
            const name = button.dataset.preset;
            const settings = name === 'quick' ? { walkSpeed: 7, sprintSpeed: 11, acceleration: 65, friction: 50, airAcceleration: 22, jumpSpeed: 9, gravity: 27, fov: 86 } : name === 'heavy' ? { walkSpeed: 4, sprintSpeed: 6.5, acceleration: 18, friction: 19, airAcceleration: 4, jumpSpeed: 7, gravity: 25, fov: 74 } : defaultMotor;
            engine.commit(d => { Object.assign(d.player, settings); });
            document.querySelectorAll('[data-preset]').forEach(el => el.classList.toggle('active', el === button));
        }));
        $('sun').addEventListener('input', () => { const value = Number($('sun').value); $('sun-value').textContent = value.toFixed(1); engine.view.sun.intensity = value; });
        $('sun').addEventListener('change', () => engine.commit(d => { d.environment.sun = Number($('sun').value); }));
        click('export', () => this.export());
        click('import', () => $('file-input').click());
        $('file-input').addEventListener('change', () => { void this.import(); });
        editor.events.on('selection', entity => { this.inspector(entity); this.highlight(); });
        editor.events.on('grid', on => $('grid').classList.toggle('active', on));
        editor.events.on('tool', mode => document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === mode)));
        engine.events.on('document', data => this.#onDocument(data));
        engine.events.on('mode', mode => this.#onMode(mode));
        engine.events.on('notice', message => this.notice(message));
        engine.events.on('stats', stats => {
            $('fps').textContent = `${stats.fps} fps`;
            $('draws').textContent = `${stats.draws} draws`;
            $('triangles').textContent = `${(stats.triangles / 1000).toFixed(1)}k triangles`;
            if (engine.mode === 'play')
                $('mode-status').textContent = `${stats.speed.toFixed(1)} m/s · ${stats.grounded ? 'Grounded' : 'Airborne'}`;
        });
        engine.events.on('cue', cue => {
            if (cue.name === 'respawn' && cue.info !== 'manual')
                this.#flash();
        });
        engine.events.on('finish', results => this.#onFinish(results));
        engine.kit.input.onSourceChange(source => this.#renderDevice(source));
        engine.onFrame(dt => this.#frame(dt));
        this.#onDocument(engine.document);
        this.inspector(null);
        this.setSound(engine.sound.muted);
        this.#renderDevice(engine.kit.input.source);
        this.#onMode(engine.mode);
    }
    toggle(button, on) { button.classList.toggle('on', on); button.setAttribute('aria-checked', String(on)); }
    notice(message) { window.clearTimeout(this.noticeTimer); $('notice').textContent = message; $('notice').classList.add('show'); this.noticeTimer = window.setTimeout(() => $('notice').classList.remove('show'), 5000); }
    setSound(muted) {
        this.engine.sound.setMuted(muted);
        this.toggle($('sound'), !muted);
        $('pause-sound').textContent = `Sound: ${muted ? 'off' : 'on'}`;
    }
    #flash() {
        const el = $('flash');
        el.classList.add('on');
        window.clearTimeout(this.flashTimer);
        this.flashTimer = window.setTimeout(() => el.classList.remove('on'), 90);
    }
    #onDocument(data) {
        const slot = this.engine.slot;
        $('project-name').textContent = data.name;
        document.querySelector('.scene-title h1').textContent = data.name + '.';
        $('scene-eyebrow').innerHTML = `SANDBOX ${escape(this.library.number(slot))} <i></i> ${escape(SUBTITLES[slot] ?? 'CUSTOM LEVEL')}`;
        $('scene-tagline').textContent = firstSentence(data.description || 'A small place to test big ideas.');
        this.renderList();
        this.playerSettings();
        $('sun').value = String(data.environment.sun);
        $('sun-value').textContent = data.environment.sun.toFixed(1);
    }
    #onMode(mode) {
        const e = this.engine;
        document.body.classList.toggle('playing', mode !== 'edit');
        $('play-hud').classList.toggle('hidden', mode === 'edit');
        $('pause').classList.toggle('hidden', mode !== 'paused');
        $('results').classList.toggle('hidden', mode !== 'done');
        $('play').classList.toggle('hidden', mode !== 'edit');
        $('stop').classList.toggle('hidden', mode === 'edit');
        $('mode-status').textContent = mode === 'edit' ? 'Editor ready' : mode === 'play' ? 'Play test' : mode === 'paused' ? 'Paused' : 'Test complete';
        for (const id of ['import', 'export', 'levels-open'])
            $(id).disabled = mode !== 'edit';
        if (mode !== 'edit')
            this.closeLevels();
        $('test-number').textContent = this.library.number(e.slot);
        $('objective-sub').textContent = e.slot === 'yard' ? 'Explore the yard. Test the movement.' : 'Explore the level. Test the movement.';
        // A focused button inside a card that just closed would keep Enter and Space.
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body && active.closest('.overlay') && !active.closest('.overlay:not(.hidden)'))
            active.blur();
        if (mode === 'paused') {
            $('pause-controls').innerHTML = controlRows(e.kit.input.source).map(([key, label]) => `<dt>${escape(key)}</dt><dd>${escape(label)}</dd>`).join('');
            this.nav.focusFirst($('pause'));
        }
    }
    #onFinish(results) {
        const e = this.engine, key = this.library.bestKey(e.slot, e.document.name);
        const { best, isNew } = this.library.recordBest(key, results.time);
        $('results-title').textContent = e.document.name;
        $('results-message').textContent = results.message || 'Test complete.';
        $('results-time').textContent = formatTime(results.time);
        $('results-best').textContent = formatTime(best);
        $('results-new').classList.toggle('hidden', !isNew);
        $('results-cells').textContent = results.cellsTotal ? `${results.cells}/${results.cellsTotal}` : '—';
        $('results-resets').textContent = String(results.respawns);
        const next = this.library.next(e.slot);
        $('results-next').classList.toggle('hidden', !next);
        if (next)
            $('results-next').textContent = `Next level · ${this.library.load(next).name}`;
        if (isNew)
            e.sound.play('best');
        this.nav.focusFirst($('results'));
    }
    #renderDevice(source) {
        document.body.dataset.input = source;
        const strip = STRIP[source];
        $('play-controls').innerHTML = strip ? strip.map(([key, label]) => `<span><kbd>${escape(key)}</kbd> ${escape(label)}</span>`).join('') : '';
        $('play-controls').classList.toggle('hidden', !strip);
        $('editor-hint').innerHTML = EDITOR_HINTS[source] ?? EDITOR_HINTS.keyboard;
        if (this.engine.mode === 'paused')
            $('pause-controls').innerHTML = controlRows(source).map(([key, label]) => `<dt>${escape(key)}</dt><dd>${escape(label)}</dd>`).join('');
        this.#hud.delete('interaction');
    }
    #text(id, value) {
        if (this.#hud.get(id) === value)
            return;
        this.#hud.set(id, value);
        $(id).textContent = value;
    }
    #shown(id, show) {
        const key = `${id}:shown`;
        if (this.#hud.get(key) === show)
            return;
        this.#hud.set(key, show);
        $(id).classList.toggle('hidden', !show);
    }
    #disabled(id, disabled) {
        const key = `${id}:disabled`;
        if (this.#hud.get(key) === disabled)
            return;
        this.#hud.set(key, disabled);
        $(id).disabled = disabled;
    }
    /** Use and Throw only appear on touch screens when there is something to use or throw. */
    #touch(name, shown) {
        const key = `touch:${name}`;
        if (this.#hud.get(key) === shown)
            return;
        this.#hud.set(key, shown);
        this.engine.kit.touch?.setShown(name, shown);
    }
    #frame(dt) {
        const e = this.engine, k = e.kit.input;
        // Cards first: the levels menu, the pause card and the results card take the pad and arrows.
        if (this.levelsOpen)
            this.nav.update(dt, $('levels'), { back: () => this.closeLevels() });
        else if (e.mode === 'paused')
            this.nav.update(dt, $('pause'), { back: () => e.resume(), escBack: false });
        else if (e.mode === 'done')
            this.nav.update(dt, $('results'), { escBack: false });
        else {
            this.nav.update(dt, null);
            if (e.mode === 'edit') {
                if (k.pressed('edPlay'))
                    e.play();
                else if (k.pressed('edLevels'))
                    this.openLevels();
                else if (k.pressed('edSearch') && $('search').getClientRects().length)
                    $('search').focus();
            }
        }
        if (e.mode !== 'edit') {
            const rt = e.runtime, source = k.source;
            let prompt = '';
            if (rt.prompt === 'held')
                prompt = `${promptLabel('interact', source)} · Drop     ${promptLabel('throw', source)} · Throw`;
            else if (rt.prompt === 'use')
                prompt = `${promptLabel('interact', source)} · ${rt.promptText}`;
            this.#text('interaction', e.mode === 'play' ? prompt : '');
            this.#text('objective-text', rt.complete ? 'Test complete. Make it your own.' : e.document.objective);
            this.#text('run-time', formatTime(e.session?.time ?? 0));
            this.#text('run-cells', rt.stats.cellsTotal ? `Cells ${rt.stats.cells}/${rt.stats.cellsTotal}` : '');
            this.#shown('lock-hint', e.mode === 'play' && source === 'keyboard' && !k.pointerLocked);
            this.#touch('interact', e.mode === 'play' && rt.prompt !== null);
            this.#touch('throwKey', e.mode === 'play' && rt.prompt === 'held');
        }
        this.#disabled('undo', !e.history.canUndo || e.mode !== 'edit');
        this.#disabled('redo', !e.history.canRedo || e.mode !== 'edit');
    }
    openLevels() {
        if (this.engine.mode !== 'edit' || this.levelsOpen)
            return;
        this.renderLevels();
        $('levels').classList.remove('hidden');
        this.levelsOpen = true;
        this.nav.focusFirst($('levels'));
    }
    closeLevels() {
        if (!this.levelsOpen)
            return;
        this.levelsOpen = false;
        $('levels').classList.add('hidden');
        if ($('levels').contains(document.activeElement))
            document.activeElement.blur();
        this.engine.kit.input.settle();
    }
    renderLevels() {
        const current = this.engine.slot;
        $('levels-list').innerHTML = this.library.entries().map(l => {
            const id = escape(l.id), here = l.id === current;
            const where = here ? 'Open now' : l.builtin ? 'Built-in sandbox' : 'Imported level';
            return `<article class="level-item${here ? ' current' : ''}"><div class="level-head"><span class="level-number">${escape(l.number)}</span><div><strong>${escape(l.name)}</strong><small>${where}${l.edited ? ' · edited' : ''}</small></div><span class="level-best">${l.best ? `Best ${formatTime(l.best)}` : 'No best time yet'}</span></div><p>${escape(l.description)}</p><div class="level-actions"><button class="primary" data-level="${id}" data-action="play"${here ? ' data-autofocus' : ''}>Play</button><button class="quiet" data-level="${id}" data-action="edit">Edit</button>${l.edited && l.builtin ? `<button class="quiet" data-level="${id}" data-action="reset">Restore original</button>` : ''}</div></article>`;
        }).join('');
    }
    /** Open a level from the library in the editor, or straight into a play test. */
    openLevel(id, { play = false } = {}) {
        try {
            const doc = this.library.load(id);
            if (this.engine.mode !== 'edit')
                this.engine.stop();
            this.closeLevels();
            this.editor.select(null);
            this.engine.load(doc, id);
            this.library.current = id;
            this.editor.home();
            if (play)
                this.engine.play();
            else
                this.notice(`${doc.name} is open in the editor.`);
        }
        catch (error) {
            this.notice(error instanceof Error ? error.message : String(error));
        }
    }
    /** Restore a built-in level. Asks for a second press first, since edits are lost. */
    resetLevel(id, button) {
        if (button.dataset.armed !== '1') {
            button.dataset.armed = '1';
            button.textContent = 'Press again to restore';
            window.setTimeout(() => {
                if (button.isConnected) {
                    button.dataset.armed = '';
                    button.textContent = 'Restore original';
                }
            }, 3500);
            return;
        }
        const doc = this.library.reset(id);
        if (!doc)
            return;
        if (id === this.engine.slot) {
            this.editor.select(null);
            this.engine.load(doc, id);
            this.editor.home();
        }
        this.notice(`${doc.name} is back to its original layout.`);
        this.renderLevels();
        this.nav.focusFirst($('levels'));
    }
    switchTab(tab) { this.tab = tab; this.search = ''; $('search').value = ''; $('scene-list').classList.toggle('hidden', tab !== 'scene'); $('asset-list').classList.toggle('hidden', tab !== 'assets'); document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === tab)); this.renderList(); }
    renderList() {
        const data = this.engine.document;
        $('entity-count').textContent = `${data.entities.length} objects`;
        if (this.tab === 'scene') {
            const filtered = data.entities.filter(e => (e.name + ' ' + e.prefab).toLowerCase().includes(this.search));
            const categories = [['Gameplay', e => e.components.length > 0 || e.prefab === 'crate'], ['Structures', e => ['block', 'stairs', 'column'].includes(e.prefab)], ['Nature', e => ['tree', 'rock'].includes(e.prefab)], ['Custom', e => !['block', 'stairs', 'column', 'tree', 'rock', 'crate'].includes(e.prefab) && e.components.length === 0]];
            $('scene-list').innerHTML = categories.map(([name, filter]) => {
                const items = filtered.filter(filter);
                if (!items.length)
                    return '';
                return `<div class="group-title">⌄ ${name}<span>${items.length}</span></div>` + items.map(e => `<button class="entity-row ${e.id === this.editor.selected ? 'selected' : ''}" data-entity="${escape(e.id)}" title="${escape(e.name)}"><span class="object-icon">${icons[e.prefab] ?? '◇'}</span><span class="entity-name">${escape(e.name)}</span><span class="entity-dot"></span></button>`).join('');
            }).join('') || '<p class="empty-result">No matching objects.</p>';
        }
        else {
            $('asset-list').innerHTML = this.engine.prefabs.all().filter(p => (p.name + ' ' + p.group).toLowerCase().includes(this.search)).map(p => `<button class="asset-card" data-prefab="${escape(p.id)}" title="${escape(p.summary)}"><span>${icons[p.id] ?? '◇'}</span><div><b>${escape(p.name)}</b><small>${escape(p.group)}</small></div><span>＋</span></button>`).join('') || '<p class="empty-result">No matching prefabs.</p>';
        }
    }
    highlight() {
        document.querySelectorAll('[data-entity]').forEach(button => button.classList.toggle('selected', button.dataset.entity === this.editor.selected));
        // Selecting with the shoulder buttons: keep the row in view.
        if (this.engine.kit.input.source === 'gamepad')
            document.querySelector('.entity-row.selected')?.scrollIntoView({ block: 'nearest' });
    }
    inspector(entity) {
        $('inspector-mode').textContent = entity ? 'OBJECT' : 'LEVEL';
        if (!entity) {
            $('inspector').innerHTML = `<div class="inspector-intro"><div class="object-badge"><span class="badge-icon">◇</span><div><strong>Level overview</strong><small>Low-poly sandbox</small></div></div><label class="field-label">Level name</label><input class="name-input" data-level-field="name" aria-label="Level name" value="${escape(this.engine.document.name)}"><label class="field-label">Play-test objective</label><input class="name-input" data-level-field="objective" aria-label="Play-test objective" value="${escape(this.engine.document.objective)}"><p class="inspector-description">Select an object to change its shape, position, and behavior. Add parts from the object library.</p><div class="level-facts"><div><strong>${this.engine.document.entities.length}</strong><span>LEVEL OBJECTS</span></div><div><strong>${this.engine.prefabs.all().length}</strong><span>MODULAR PREFABS</span></div></div></div>`;
            return;
        }
        const prefab = this.engine.prefabs.get(entity.prefab);
        $('inspector').innerHTML = `<div class="object-badge"><span class="badge-icon">${icons[entity.prefab] ?? '◇'}</span><div><strong>${escape(prefab.name)}</strong><small>${escape(prefab.group)} / ${escape(entity.id)}</small></div></div><input class="name-input" data-field="name" aria-label="Object name" value="${escape(entity.name)}">${['position', 'rotation', 'scale'].map(key => `<div class="transform-group"><span class="transform-label">${key === 'rotation' ? 'Rotation · degrees' : key === 'position' ? 'Position · meters' : 'Scale'}</span><div class="vector-fields">${entity[key].map((value, i) => `<label class="vector-field"><span>${['X', 'Y', 'Z'][i]}</span><input type="number" step="${key === 'rotation' ? 15 : key === 'scale' ? .25 : .5}" value="${Number(value.toFixed(3))}" data-field="${key}" data-index="${i}" aria-label="${key} ${['X', 'Y', 'Z'][i]}"></label>`).join('')}</div></div>`).join('')}<label class="color-row">Base color<input type="color" data-field="color" value="${escape(entity.color ?? prefab.build(entity).visuals[0]?.color ?? '#e5d7bd')}"></label><div class="object-actions"><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button></div><span class="field-label">Components · JSON</span><textarea id="component-json" class="component-area" spellcheck="false" aria-label="Component data">${escape(JSON.stringify(entity.components, null, 2))}</textarea><button class="apply-components" data-action="components">Apply components</button>`;
        elements.delete('component-json');
    }
    changeInspector(input) {
        const levelField = input.dataset.levelField;
        if (levelField === 'name' || levelField === 'objective') {
            this.engine.commit(d => { d[levelField] = input.value; });
            return;
        }
        const key = input.dataset.field, id = this.editor.selected;
        if (!key || !id)
            return;
        this.engine.commit(d => {
            const e = d.entities.find(e => e.id === id);
            if (!e)
                return;
            if (key === 'name')
                e.name = input.value;
            else if (key === 'color')
                e.color = input.value;
            else if (key === 'position' || key === 'rotation' || key === 'scale')
                e[key][Number(input.dataset.index)] = Number(input.value);
        });
    }
    formatSetting(key, value) {
        if (key === 'fov')
            return `${value}°`;
        if (key === 'sensitivity')
            return value.toFixed(4);
        if (['coyoteTime', 'jumpBuffer'].includes(key))
            return `${Math.round(value * 1000)} ms`;
        return `${Number(value.toFixed(2))}`;
    }
    playerSettings() {
        const settings = [
            { key: 'walkSpeed', label: 'Walk speed · m/s', min: .5, max: 15, step: .1 }, { key: 'jumpSpeed', label: 'Jump speed · m/s', min: 1, max: 18, step: .1 },
            { key: 'airAcceleration', label: 'Air control · m/s²', min: 0, max: 40, step: 1 }, { key: 'fov', label: 'Field of view', min: 50, max: 110, step: 1 },
            { key: 'sprintSpeed', label: 'Sprint speed · m/s', min: .5, max: 25, step: .1 }, { key: 'crouchSpeed', label: 'Crouch speed · m/s', min: .1, max: 10, step: .1 },
            { key: 'acceleration', label: 'Ground acceleration · m/s²', min: 1, max: 100, step: 1 }, { key: 'friction', label: 'Braking · m/s²', min: 0, max: 100, step: 1 },
            { key: 'gravity', label: 'Gravity · m/s²', min: 1, max: 60, step: 1 }, { key: 'stepHeight', label: 'Step height · m', min: 0, max: .5, step: .01 },
            { key: 'maxSlope', label: 'Maximum slope · degrees', min: 1, max: 65, step: 1 }, { key: 'coyoteTime', label: 'Late jump allowance', min: 0, max: .4, step: .01 },
            { key: 'jumpBuffer', label: 'Early jump allowance', min: 0, max: .4, step: .01 }, { key: 'sensitivity', label: 'Mouse sensitivity', min: .0002, max: .006, step: .0001 },
            { key: 'headBob', label: 'Head movement', min: 0, max: 1, step: .05 },
        ];
        // Keep "More movement settings" open across re-renders (every change re-renders this list).
        const open = $('player-settings').querySelector('details')?.open ? ' open' : '';
        const slider = (s) => `<label class="slider-row"><span>${s.label}<output id="value-${s.key}">${this.formatSetting(s.key, this.engine.document.player[s.key])}</output></span><input type="range" data-setting="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${this.engine.document.player[s.key]}"></label>`;
        $('player-settings').innerHTML = settings.slice(0, 4).map(slider).join('') + `<details${open}><summary class="field-label" style="cursor:pointer">More movement settings</summary>${settings.slice(4).map(slider).join('')}</details>`;
        for (const s of settings)
            elements.delete(`value-${s.key}`);
    }
    export() {
        const blob = new Blob([JSON.stringify(this.engine.document, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = this.engine.document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.notice('Level exported. The play state is not included.');
    }
    async import() {
        const input = $('file-input'), file = input.files?.[0];
        if (!file)
            return;
        try {
            if (file.size > 2000000)
                throw new Error('The level file must be smaller than 2 MB.');
            const data = JSON.parse(await file.text());
            // An import gets its own slot, so the built-in levels keep their edits.
            this.engine.load(data, IMPORT_SLOT);
            this.library.current = IMPORT_SLOT;
            this.editor.select(null);
            this.editor.home();
            this.notice('Level imported. Find it again under Levels.');
        }
        catch (error) {
            this.notice(error instanceof Error ? error.message : String(error));
        }
        finally {
            input.value = '';
        }
    }
}
