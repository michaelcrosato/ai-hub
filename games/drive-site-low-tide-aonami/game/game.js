/* LOW TIDE — The Missing Signal. Original game code. */
(function () {
    'use strict';
    const E = My3D2dge, D = HARBOR_DATA, $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    class LowTide {
        constructor() { this.game = new E.Game({ canvas: $('world'), view: new E.View('aonami', 'Aonami', 32, 37, 1.58, 1), res: [960, 540], fit: true, portrait: { res: [570, 720] }, bg: '#254850', input: { up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'], interact: ['KeyE', 'Enter', 'Pad0'], attack: ['KeyJ', 'Pad2'], kick: ['KeyK', 'Pad3'], guard: ['KeyL', 'Pad4'], dodge: ['Space', 'Pad1'], run: ['ShiftLeft', 'ShiftRight', 'Pad5'], notebook: ['KeyN', 'Pad8'], map: ['KeyM', 'Pad10'], pause: ['Escape', 'Pad9'] } }); this.game.pauseOverlay = false; this.game.cam.smooth = .24; this.game.cam.offset = [10, 5]; this.world = new HarborWorld(this.game); this.clock = new E.DailyClock(); this.case = new E.HarborCase(); this.saveStore = new E.HarborSave(); this.settings = { sound: true, assisted: false, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }; this.player = { x: 373, y: 370, z: 0, vx: 0, vy: 0, facing: 3.1, hp: 100, stamina: 100, hurt: 0, dodge: 0, dodgeCooldown: 0, counter: 0 }; this.rig = new E.HarborRig({ size: .96, hair: 'short', satchel: true, colors: { skin: '#d5ae95', hair: '#293b41', cloth: '#bc705a', pants: '#314653', boot: '#20343d', belt: '#6c725e' } }); this.runnerRig = new E.HarborRig({ size: 1, colors: { cloth: '#414f5b', pants: '#293846', hair: '#25323a', skin: '#c09e86' } }); this.sound = new E.HarborSound(this.game); this.mode = 'title'; this.path = []; this.nearest = null; this.carry = null; this.work = null; this.enemies = null; this.combo = new E.Combo(['jab', 'cross', 'hook'], { window: .38 }); this.kick = new E.Attack('roundhouse', { wind: .13, active: .13, recover: .32 }); this.toastTimer = 0; this.uiTimer = 0; this.saveTimer = 10; this.modalReturn = 'explore'; this.dialogue = null; this.training = false; this.inspection = null; this.arcade = null; this.chase = null; this.cinema = null; this.started = false; this.prevFocus = null; this.saved = this.saveStore.load(); if (this.saved && this.saved.settings)
            this.settings = { ...this.settings, ...this.saved.settings }; this.game.reduceMotion = this.settings.reducedMotion; this.sound.enabled = this.settings.sound; this.game.audio.mute(!this.settings.sound); this.activities = new HarborActivities(this); this.bind(); this.updateTitle(); this.game.focus(this.player.x, this.player.y, 15); this.game.start({ update: dt => this.update(dt), draw: r => { const now = performance.now(); this.game.stats.rawFrameMs = this.lastDrawTime ? now - this.lastDrawTime : 0; this.lastDrawTime = now; this.world.draw(r, this); } }); this.registerTools(); window.LOW_TIDE = this; }
        bind() {
            $('new-game').onclick = () => { if (this.saveStore.load())
                this.newGameConfirm();
            else
                this.begin(false); };
            $('continue-game').onclick = () => this.begin(true);
            $('title-settings').onclick = () => this.openSettings();
            $('pause-button').onclick = () => this.openSettings();
            $('notebook-button').onclick = () => this.openNotebook();
            $('map-button').onclick = $('mini-map-button').onclick = () => this.openMap();
            $('activities-button').onclick = () => this.activities.openDirectory();
            $('side-manage').onclick = () => this.activities.offer(this.activities.active.id);
            $('fullscreen-button').onclick = $('title-fullscreen').onclick = () => this.toggleFullscreen();
            $('hint-button').onclick = () => this.showHint();
            $('sound-button').onclick = () => { this.setSound(!this.settings.sound); this.save(false); };
            $('interaction').onclick = () => this.interact();
            $('modal-close').onclick = () => this.closeModal();
            $('qte-key').onclick = () => this.qtePress(this.chase && this.chase.steps[this.chase.index].action);
            this.game.input.bindButtons($('touch-controls'));
            if (matchMedia('(pointer: coarse)').matches)
                $('touch-controls').hidden = true;
            document.addEventListener('keydown', e => { if (e.code === 'Tab' && (this.mode === 'dialogue' || !$('modal-backdrop').hidden || this.mode === 'title')) {
                const parent = this.mode === 'dialogue' ? $('dialogue') : !$('modal-backdrop').hidden ? $('modal') : $('title-screen');
                const nodes = [...parent.querySelectorAll('button:not([disabled]),input,a[href]')].filter(n => n.offsetParent !== null);
                if (nodes.length) {
                    const i = nodes.indexOf(document.activeElement);
                    e.preventDefault();
                    nodes[(i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
                }
                return;
            } if (e.code === 'Enter' && document.activeElement?.tagName === 'BUTTON') {
                e.preventDefault();
                e.stopPropagation();
                this.game.input.consume('interact');
                if (!e.repeat)
                    document.activeElement.click();
                return;
            } if (this.mode === 'dialogue' && /^Digit[1-4]$/.test(e.code)) {
                const n = +e.code.slice(-1) - 1;
                $('dialogue-choices').children[n]?.click();
            } if (this.mode === 'inspect' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
                e.preventDefault();
                this.turnInspect(e.code === 'ArrowLeft' ? -1 : 1);
            } if (this.mode === 'inspect' && e.code === 'KeyE') {
                e.preventDefault();
                this.examine();
            } });
            $('world').addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' || e.button !== 0 || !['explore', 'work'].includes(this.mode))
                return; const q = this.game.screen.clientToScreen(e.clientX, e.clientY), p = this.game.view.toGround(...q); if (p && this.world.canWalk(...p))
                this.path = this.world.path(this.player, { x: p[0], y: p[1] }); });
            document.addEventListener('visibilitychange', () => { if (document.hidden && this.started) {
                this.save(false);
                if (['explore', 'work', 'combat'].includes(this.mode))
                    this.openSettings();
            } });
            window.addEventListener('pagehide', () => this.save(false));
            window.addEventListener('resize', () => this.updateHUD());
        }
        updateTitle() { this.saved = this.saveStore.load(); $('continue-game').hidden = !this.saved; $('new-game').className = this.saved ? 'text-button' : 'primary'; $('new-game').textContent = this.saved ? 'Start a new afternoon' : 'Begin the afternoon'; }
        newGameConfirm() { this.showModal('A NEW AFTERNOON', 'Start again?', `<p>This starts a new case. It replaces the saved afternoon on this device.</p><div class="modal-actions"><button class="primary" id="confirm-new">Start a new afternoon</button><button class="secondary" id="cancel-new">Keep this afternoon</button></div>`); $('confirm-new').onclick = () => { this.closeModal(); this.begin(false); }; $('cancel-new').onclick = () => this.closeModal(); }
        begin(resume) {
            this.hidePanels();
            this.started = true;
            this.world.reset();
            this.combo.cancel();
            this.kick.cancel();
            this.enemies = null;
            this.training = false;
            this.chase = null;
            this.arcade = null;
            this.path = [];
            this.carry = null;
            this.work = null;
            const saved = resume ? this.saveStore.load() : null;
            this.case = new E.HarborCase(saved?.case);
            this.clock = new E.DailyClock(saved?.minutes ?? 970);
            Object.assign(this.player, { x: 373, y: 370, z: 0, vx: 0, vy: 0, facing: 3.1, hp: 100, stamina: 100, hurt: 0, dodge: 0, dodgeCooldown: 0, counter: 0 });
            if (saved) {
                Object.assign(this.player, saved.player || {});
                this.player.hp = 100;
                this.player.stamina = 100;
                if (!this.world.canWalk(this.player.x, this.player.y)) {
                    this.player.x = 373;
                    this.player.y = 370;
                }
                this.settings = { ...this.settings, ...saved.settings };
                if (this.case.stage === 3 && saved.work?.active) {
                    this.work = { ...saved.work };
                    this.carry = saved.carry ?? null;
                    if (Array.isArray(saved.crates) && saved.crates.length === 3)
                        this.world.crates = saved.crates.map(c => ({ ...c }));
                }
                else if (this.case.flags.cargoPaid)
                    this.world.crates = this.world.crates.map(c => ({ ...c, delivered: true }));
            }
            this.world.syncSchedules(this.clock);
            this.mode = this.work ? 'work' : 'explore';
            this.activities.reset(saved?.activities);
            this.sound.enabled = this.settings.sound;
            this.sound.start();
            this.setSound(this.settings.sound);
            this.game.reduceMotion = this.settings.reducedMotion;
            $('title-screen').hidden = true;
            $('hud').hidden = false;
            this.setTouch(true);
            this.game.cam.snap = true;
            this.updateHUD();
            if (!saved) {
                this.save(false);
                this.showCinema('23 OCTOBER 1993 · 16:10', 'South Quay', 'The last call came from this harbor.', 3.4, () => { this.say('nao', ["Ken's call cut off at noon. He left an empty tape sleeve with Sato, the radio repairer.", "Hana knows everyone on this street. I should ask her what happened."], () => this.toast('WASD to move · E to talk', 'WELCOME TO AONAMI')); });
            }
            else {
                this.toast('Your afternoon is ready.', 'CONTINUE');
                if (this.case.stage === 5) {
                    this.player.x = 716;
                    this.player.y = 306;
                    this.toast('Meet the collectors by Warehouse 04.', 'CASE RESUMED');
                }
            }
        }
        setTouch(on) { $('touch-controls').hidden = !(on && matchMedia('(pointer: coarse)').matches && ['explore', 'work', 'combat'].includes(this.mode)); }
        hidePanels() { $('modal-backdrop').hidden = true; $('dialogue').hidden = true; $('chase').hidden = true; $('cinema').hidden = true; this.dialogue = null; this.inspection = null; this.arcade = null; this.cinema = null; }
        save(notify = true) { if (!this.started)
            return false; const p = this.player; const ok = this.saveStore.write({ case: this.case.export(), minutes: this.clock.minutes, player: { x: p.x, y: p.y, facing: p.facing }, settings: this.settings, activities: this.activities.export(), work: this.work, carry: this.carry, crates: this.world.crates.map(c => ({ ...c })) }); if (notify)
            this.toast(ok ? 'This afternoon is saved on this device.' : 'The browser could not save. Keep this tab open.', ok ? 'SAVED' : 'SAVE UNAVAILABLE'); return ok; }
        setSound(on) { this.settings.sound = on; this.sound.set(on); $('sound-button').textContent = on ? 'Sound on' : 'Sound off'; }
        toast(text, label = 'NOTEBOOK UPDATED') { this.toastTimer = 4; $('toast').innerHTML = `<small>${esc(label)}</small>${esc(text)}`; $('toast').classList.add('show'); }
        note(id, title, text) { if (this.case.note(id, title, text)) {
            this.sound.play('clue');
            this.toast(title);
            this.save(false);
            this.updateHUD();
        } }
        advance(stage) { if (this.case.advance(stage)) {
            this.updateHUD();
            this.save(false);
        } }
        targetFor(id) { if (!id)
            return null; if (this.mode === 'work' && id === 'jun') {
            if (this.carry !== null)
                return { x: 750, y: 525 };
            return this.world.crates.find(c => !c.delivered) || this.world.npc('jun');
        } if (id === 'fight')
            return { x: 751, y: 272, id: 'fight', name: 'Dock collectors', type: 'fight', r: 38 }; return this.world.npc(id) || D.props.find(p => p.id === id) || null; }
        location() { const p = this.player; const district=D.districts.slice(1).find(d=>p.x>=d.x&&p.x<d.x+d.w&&p.y>=d.y&&p.y<d.y+d.d); if(district)return district.name; if (p.x > 700)
            return p.y > 355 ? 'Cargo Quay' : 'Warehouse Yard'; if (p.y > 515)
            return 'The Waterfront'; if (p.x < 175 && p.y < 230)
            return 'Old Signal Station'; if (p.y < 160)
            return 'Upper Lane'; if (p.x < 255 && p.y > 380)
            return 'Practice Yard'; return 'Lantern Lane'; }
        updateHUD() { this.activities?.updateHUD(); $('mini-map-label').textContent = this.location().toUpperCase(); $('world').dataset.performance = JSON.stringify({ fps: this.game.fps, ...this.game.stats, errors: this.game.errors.length }); if (!this.started)
            return; const o = D.objectives[this.case.stage]; $('objective').querySelector('.eyebrow').textContent = o.title.toUpperCase(); $('objective-text').textContent = o.text; $('clock').textContent = this.clock.format(); $('money').textContent = '¥' + this.case.money.toLocaleString(); $('location-name').textContent = this.location(); $('note-count').textContent = this.case.entries.length; $('combat-hud').hidden = this.mode !== 'combat'; $('work-hud').hidden = !this.work?.active || this.mode === 'combat'; $('movement-hint').hidden = this.mode === 'combat'; if (this.mode === 'combat') {
            $('battle-title').textContent = this.training ? 'THE WHARF STEP' : 'HOLD YOUR GROUND';
            $('health-fill').style.width = this.player.hp + '%';
            $('stamina-fill').style.width = this.player.stamina + '%';
            $('enemy-count').textContent = this.training ? `${Math.min(2, this.trainingCounters || 0)} / 2 counters` : `${this.enemies.filter(e => !e.dead).length} OPPONENTS`;
            $('combat-tip').textContent = this.training ? 'Space: step away. Then press J near Imai. Land two counter hits.' : 'J Punch · K Kick · L Guard · Space Step';
        } if (this.work) {
            const n = this.world.crates.filter(c => c.delivered).length;
            $('work-count').textContent = `${n} / 3 crates`;
            $('work-tip').textContent = this.carry === null ? 'Pick up a marked crate with E.' : 'Carry the crate to the painted square. Press E to set it down.';
        } const m = this.clock.minutes, h = (m / 60 % 12) * Math.PI / 6 - Math.PI / 2, a = (m % 60) * Math.PI / 30 - Math.PI / 2; $('clock-hands').setAttribute('d', `M${26 + Math.cos(h) * 12} ${26 + Math.sin(h) * 12}L26 26L${26 + Math.cos(a) * 18} ${26 + Math.sin(a) * 18}`); this.world.drawMap($('mini-map'), this); this.setTouch(true); }
        update(dt) {
            const input = this.game.input, p = this.player;
            this.uiTimer -= dt;
            this.toastTimer -= dt;
            if (this.toastTimer <= 0)
                $('toast').classList.remove('show');
            if (this.uiTimer <= 0) {
                this.updateHUD();
                this.uiTimer = .12;
            }
            if (this.started && this.mode !== 'title') {
                this.case.stats.seconds += dt;
                this.saveTimer -= dt;
                if (this.saveTimer <= 0 && ['explore', 'work'].includes(this.mode)) {
                    this.save(false);
                    this.saveTimer = 10;
                }
            }
            if (input.pressed('pause')) {
                if (this.mode === 'dialogue') {
                    this.endDialogue();
                    return;
                }
                if (!$('modal-backdrop').hidden) {
                    if (!$('modal-close').hidden)
                        this.closeModal();
                    return;
                }
                if (this.mode === 'chase') {
                    this.chasePause();
                    return;
                }
                if (this.mode === 'cinema')
                    return;
                this.openSettings();
                return;
            }
            if (this.mode === 'title')
                return;
            if (this.mode === 'cinema') {
                this.cinema.t -= dt;
                if (this.cinema.t <= 0) {
                    const f = this.cinema.done;
                    this.cinema = null;
                    $('cinema').hidden = true;
                    this.mode = this.work?.active ? 'work' : 'explore';
                    if (f)
                        f();
                }
                this.updateRigs(dt);
                return;
            }
            if (this.mode === 'dialogue') {
                if (input.pressed('interact'))
                    $('dialogue-choices').children[0]?.click();
                this.updateRigs(dt);
                return;
            }
            if (['modal', 'inspect', 'arcade', 'radio'].includes(this.mode)) {
                this.activities.updateMini(dt);
                if (this.mode === 'inspect')
                    this.drawInspect(dt);
                if (this.mode === 'arcade')
                    this.updateArcade(dt);
                return;
            }
            if (this.mode === 'chase') {
                this.updateChase(dt);
                this.updateRigs(dt);
                return;
            }
            if (input.pressed('notebook')) {
                this.openNotebook();
                return;
            }
            if (input.pressed('map')) {
                this.openMap();
                return;
            }
            if (this.mode === 'combat') {
                this.updateCombat(dt);
                this.updateRigs(dt);
                return;
            }
            this.activities.update(dt);
            this.clock.tick(dt);
            if (this.work)
                this.work.elapsed += dt;
            let [sx, sy] = input.move();
            let [dx, dy] = this.game.view.screenDirToGround(sx, sy);
            if (dx || dy)
                this.path = [];
            else if (this.path.length) {
                const q = this.path[0], vx = q.x - p.x, vy = q.y - p.y, d = Math.hypot(vx, vy);
                if (d < 2.5)
                    this.path.shift();
                else {
                    dx = vx / d;
                    dy = vy / d;
                }
            }
            const speed = this.carry !== null || this.activities.isCarrying() ? 30 : input.down('run') ? 82 : 49;
            p.vx = dx * speed;
            p.vy = dy * speed;
            if (dx || dy) {
                p.facing = E.approachAng(p.facing, Math.atan2(dy, dx), dt * 12);
                const oldx = p.x, oldy = p.y;
                this.world.move(p, p.vx * dt, p.vy * dt);
                if (Math.hypot(p.x - oldx, p.y - oldy) < .005)
                    this.path = [];
                this.case.stats.steps += Math.hypot(p.x - oldx, p.y - oldy) / 16;
            }
            p.z = 0;
            this.sound.update(dt, !!(dx || dy));
            this.world.update(dt, this.clock, p, this.mode);
            this.findNearest();
            if (input.pressed('interact'))
                this.interact();
            this.updateRigs(dt);
            this.game.focus(p.x, p.y, 17);
        }
        updateRigs(dt) { const p = this.player; this.rig.update(dt, { ...p, attack: this.mode === 'combat' ? (this.kick.busy ? this.kick.state : this.combo.state) : null, hurt: p.hurt > 0, dash: p.dodge > 0, air: p.z > 2, pose: this.carry !== null || this.activities.isCarrying() ? 'cast' : this.mode === 'combat' && this.game.input.down('guard') ? 'block' : null, stance: this.mode === 'combat' ? 'guard' : null }); if (this.mode === 'chase')
            this.runnerRig.update(dt, { x: p.x + 38, y: p.y - 15, facing: p.facing, run: 1 }); if (!['explore', 'work'].includes(this.mode))
            this.world.update(dt, this.clock, p, this.mode); }
        findNearest() {
            if (!['explore', 'work'].includes(this.mode)) {
                $('interaction').hidden = true;
                return;
            }
            let list = [...this.world.npcs, ...D.props, ...this.activities.targets()];
            if (this.case.stage === 5)
                list.push(this.targetFor('fight'));
            let best = null;
            for (const o of list) {
                const d = Math.hypot(o.x - this.player.x, o.y - this.player.y), limit = o.r || 30;
                const score=d-(o.type==='side-target'?24:0);
                if (d <= limit && (!best || score < best.priority))
                    best = { ...o, distance: d, priority:score };
            }
            if (this.mode === 'work') {
                if (this.carry !== null) {
                    best = { id: 'drop', name: Math.hypot(this.player.x - 750, this.player.y - 525) < 43 ? 'Load this crate' : 'Set down the crate', type: 'cargo', distance: 0 };
                }
                else {
                    const c = this.world.crates.filter(c => !c.delivered).sort((a, b) => E.dist(this.player, a) - E.dist(this.player, b))[0];
                    if (c && E.dist(this.player, c) < 30)
                        best = { ...c, id: 'crate-' + c.id, crateId: c.id, name: 'Cargo crate ' + c.tag, type: 'cargo' };
                }
            }
            this.nearest = best;
            $('interaction').hidden = !best;
            if (best) {
                $('interaction-kind').textContent = best.type === 'cargo' ? 'CARGO' : best.role ? 'TALK' : best.type === 'bench' ? 'REST' : 'INSPECT';
                $('interaction-name').textContent = best.name;
            }
        }
        interact() { if (!['explore', 'work'].includes(this.mode))
            return; this.findNearest(); const o = this.nearest; if (!o) {
            this.toast('Move closer to a person or an object.', 'EXPLORE');
            return;
        } this.path = []; this.player.vx = this.player.vy = 0; this.game.input.clear(); if (o.type === 'cargo') {
            this.cargoInteract(o);
            return;
        } if(o.type==='side-target'){this.activities.interact(o);return;} if(o.type==='bus'){this.activities.openBus(o);return;} if (o.role) {
            this.talkTo(o.id);
            return;
        } switch (o.type) {
            case 'bench':
                this.openBench();
                break;
            case 'lockers':
                this.openLockers();
                break;
            case 'radio':
                this.openRadio();
                break;
            case 'arcade':
                this.arcadeMenu();
                break;
            case 'capsule':
                this.capsuleMenu();
                break;
            case 'vending':
                this.vendingMenu();
                break;
            case 'cat':
                this.catMenu();
                break;
            case 'board':
                this.openMap();
                break;
            case 'fight':
                if (this.case.flags.chaseDone)
                    this.startBattle(false);
                else
                    this.startChase();
                break;
            case 'flowers':
                this.say('nao', ["Fresh flowers. Someone comes here even in the rain.", "There is a name on the stone: 'For those who brought us home.'"]);
                this.note('flowers', 'By the seawall', 'Fresh flowers stand beside the names of the harbor crews lost at sea.');
                break;
            case 'ferrybell':
                this.sound.play('bell');
                this.say('tomo', ["The last ferry waits for the signal keeper's all-clear. We will not leave anyone behind."]);
                break;
        } }
        showCinema(kicker, title, text, seconds, done) { this.mode = 'cinema'; this.cinema = { t: seconds, done }; $('cinema-kicker').textContent = kicker; $('cinema-title').textContent = title; $('cinema-text').textContent = text; $('cinema').hidden = false; $('interaction').hidden = true; this.game.input.clear(); this.setTouch(false); }
        speaker(id) { if (id === 'nao')
            return { id: 'nao', name: 'Nao Mori', role: 'Radio technician', rig: this.rig }; if (id === 'ken')
            return { id: 'ken', name: 'Ken Mori', role: 'North light · radio signal', rig: this.rig }; if (id === 'collector')
            return { id, name: 'Dock collector', role: 'Warehouse yard', rig: this.runnerRig }; return this.world.npc(id) || { id, name: id, role: 'South Quay', rig: this.rig }; }
        say(id, pages, done) { this.dialogue = { speaker: id, pages: pages.map(x => typeof x === 'string' ? { text: x } : x), index: 0, done }; this.mode = 'dialogue'; this.path = []; this.game.input.clear(); $('dialogue').hidden = false; $('interaction').hidden = true; this.setTouch(false); this.renderDialogue(); }
        choose(id, text, choices) { this.say(id, [{ text, choices }]); }
        renderDialogue() { const d = this.dialogue; if (!d)
            return; const s = this.speaker(d.speaker), line = d.pages[d.index]; $('speaker-name').textContent = s.name; $('speaker-role').textContent = s.role; $('dialogue-place').textContent = this.location(); $('dialogue-text').textContent = line.text; const g = $('portrait').getContext('2d'); g.clearRect(0, 0, 140, 160); s.rig.drawPortrait(g, 0, 0, 138, { bg: '#203e45', facing: .5 }); const choices = line.choices || [{ label: d.index < d.pages.length - 1 || d.done ? 'Continue' : 'Return to the street', action: () => { if (d.index < d.pages.length - 1) {
                    d.index++;
                    this.renderDialogue();
                }
                else
                    this.endDialogue(true); } }]; $('dialogue-choices').innerHTML = ''; choices.forEach((q, i) => { const b = document.createElement('button'); b.innerHTML = `<span>${i + 1}</span>${esc(q.label)}`; b.onclick = () => { this.sound.play('paper'); this.game.input.clear(); if (line.choices)
            this.endDialogue(false); q.action(); }; $('dialogue-choices').appendChild(b); }); $('dialogue-choices').firstElementChild?.focus(); }
        endDialogue(runDone = false) { if (!this.dialogue)
            return; const done = this.dialogue.done; this.dialogue = null; $('dialogue').hidden = true; this.mode = this.work?.active ? 'work' : 'explore'; this.game.input.clear(); $('world').focus(); this.updateHUD(); if (runDone && done)
            done(); }
        showModal(label, title, html, mode = 'modal') { this.prevFocus = document.activeElement; this.modalReturn = ['modal', 'inspect', 'arcade', 'radio'].includes(this.mode) ? this.modalReturn : this.mode; this.mode = mode; $('modal-label').textContent = label; $('modal-title').textContent = title; $('modal-content').innerHTML = html; $('modal-backdrop').hidden = false; $('modal-close').hidden = false; $('interaction').hidden = true; $('dialogue').hidden = true; this.game.input.clear(); this.setTouch(false); $('modal').focus(); }
        closeModal() { this.activities.mini=null; if ($('modal-backdrop').hidden)
            return; if (this.mode === 'arcade' && this.arcade && !this.arcade.finished) {
            this.toast('The current game has ended.', 'SIGNAL CATCH');
            this.save(false);
        } this.inspection = null; this.arcade = null; $('modal-backdrop').hidden = true; this.mode = this.modalReturn || 'explore'; this.game.input.clear(); if (this.mode === 'chase')
            $('chase').hidden = false; this.updateHUD(); if (this.mode === 'dialogue' && this.dialogue) {
            $('dialogue').hidden = false;
            this.renderDialogue();
        }
        else
            (this.prevFocus?.isConnected ? this.prevFocus : $('world')).focus(); }
        openSettings() { const was = this.mode; const fromTitle = was === 'title' || this.modalReturn === 'title' && !this.started; this.showModal('LOW TIDE', 'Controls & settings', `<div class="controls-grid"><div><span>Move</span><span><kbd>WASD</kbd> / arrows</span></div><div><span>Talk / inspect / carry</span><kbd>E</kbd></div><div><span>Run</span><kbd>SHIFT</kbd></div><div><span>Notebook / map</span><span><kbd>N</kbd><kbd>M</kbd></span></div><div><span>Punch / kick</span><span><kbd>J</kbd><kbd>K</kbd></span></div><div><span>Guard / step away</span><span><kbd>L</kbd><kbd>SPACE</kbd></span></div></div><p class="text-small">Click the ground to walk. In dialogue, select an answer or press its number. A gamepad uses the left stick to move, A to interact, X to punch, Y to kick, B to step, and LB to guard.</p><div class="settings-row"><div><label for="setting-sound">Music and sound</label><p>Original music, footsteps, and small harbor sounds.</p></div><input id="setting-sound" type="checkbox" ${this.settings.sound ? 'checked' : ''}></div><div class="settings-row"><div><label for="setting-assist">Gentle action</label><p>Longer chase prompts and less damage from opponents.</p></div><input id="setting-assist" type="checkbox" ${this.settings.assisted ? 'checked' : ''}></div><div class="settings-row"><div><label for="setting-motion">Reduce motion</label><p>Remove rain streaks, screen shake, and extra motion.</p></div><input id="setting-motion" type="checkbox" ${this.settings.reducedMotion ? 'checked' : ''}></div><p class="save-status">${fromTitle ? 'Progress saves on this device. Play on the same browser to continue.' : 'The town clock is paused. Progress saves on this device.'}</p><div class="modal-actions"><button class="primary" id="resume">${fromTitle ? 'Return' : 'Resume the afternoon'}</button>${!fromTitle ? '<button class="secondary" id="save-game">Save game</button><button class="secondary" id="return-title">Save & return to title</button>' : ''}${this.training ? '<button class="secondary" id="leave-training">Leave practice</button>' : ''}</div><div class="credits">LOW TIDE · Version ${D.version}<br>Built on my-3D2dge by Michael Crosato. Original story, game art, and music for this slice.<br><a href="../../report.html" target="_blank" rel="noopener">Read the design report</a></div>`); $('setting-sound').onchange = e => { this.setSound(e.target.checked); this.save(false); }; $('setting-assist').onchange = e => { this.settings.assisted = e.target.checked; this.save(false); }; $('setting-motion').onchange = e => { this.settings.reducedMotion = e.target.checked; this.game.reduceMotion = e.target.checked; this.save(false); }; $('resume').onclick = () => this.closeModal(); if (!fromTitle) {
            $('save-game').onclick = () => this.save();
            $('return-title').onclick = () => { this.save(false); this.hidePanels(); this.mode = 'title'; this.started = false; $('hud').hidden = true; $('title-screen').hidden = false; this.setTouch(false); this.updateTitle(); $('continue-game').focus(); };
        } if (this.training)
            $('leave-training').onclick = () => { this.closeModal(); this.finishTraining(false); }; }
        openNotebook(tab = 'case') { if (['title', 'cinema', 'chase', 'dialogue'].includes(this.mode))
            return; const o = D.objectives[this.case.stage]; let content = `<div class="notebook-tabs"><button id="tab-case" class="${tab === 'case' ? 'active' : ''}">The case</button><button id="tab-items" class="${tab === 'items' ? 'active' : ''}">In your bag (${this.case.inventory.length})</button></div>`; if (tab === 'case') {
            content += `<div class="journal-current"><span class="eyebrow">${esc(o.title.toUpperCase())}</span><p>${esc(o.text)}</p></div><div class="journal-list">` + [...this.case.entries].reverse().map((e, i) => `<article class="journal-entry"><span class="journal-index">${String(this.case.entries.length - i).padStart(2, '0')}</span><div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div></article>`).join('') + '</div>';
        }
        else
            content += `<div class="evidence-grid">${this.case.inventory.length ? this.case.inventory.map(e => `<article class="evidence-item"><small>${e.id.startsWith('toy') ? 'HARBOR COLLECTION' : 'EVIDENCE / PERSONAL ITEM'}</small><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p></article>`).join('') : '<p>Your canvas bag is empty.</p>'}</div>`; this.showModal('NAO MORI · FIELD NOTES', 'The notebook', content); $('tab-case').onclick = () => this.openNotebook('case'); $('tab-items').onclick = () => this.openNotebook('items'); this.sound.play('paper'); }
        async toggleFullscreen() {
            try {
                if(document.fullscreenElement)await document.exitFullscreen();
                else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
                else {this.toast('The game already fills this window. Use your browser’s full-screen control to hide its toolbar.','FULL WINDOW');return;}
                this.game.screen.resize();
            }catch(e){this.toast('The game fills this window. Your browser controls full-screen access.','FULL WINDOW');}
        }
        openMap() {
            if (['title','cinema','chase','dialogue'].includes(this.mode))return;
            this.showModal('AONAMI · FIVE NEIGHBORHOODS','The open district',`<canvas class="large-map" id="large-map" width="800" height="640" aria-label="Aonami map. Select a street to walk there."></canvas><div class="map-legend"><span><b>◆</b> Main case</span><span class="mint">○ Active task</span><span>△ Nao · B Bus</span></div><p class="text-small muted">Select a street on the map to walk there. The small map follows you. All five neighborhoods connect on foot.</p><div class="modal-actions"><button class="primary" id="map-activities">Things to do</button><button class="secondary" id="map-lead">Walk to the next lead</button></div>`);
            const canvas=$('large-map');this.world.drawMap(canvas,this,true);
            canvas.onclick=e=>{const rc=canvas.getBoundingClientRect(),m=canvas.harborMap,p={x:((e.clientX-rc.left)*canvas.width/rc.width-m.ox)/m.scale,y:((e.clientY-rc.top)*canvas.height/rc.height-m.oy)/m.scale};if(this.world.canWalk(p.x,p.y)){this.closeModal();this.activities.walkTo(p);}};
            $('map-activities').onclick=()=>this.activities.openDirectory();
            $('map-lead').disabled=!this.targetFor(D.objectives[this.case.stage].target);
            $('map-lead').onclick=()=>{const p=this.targetFor(D.objectives[this.case.stage].target);this.closeModal();if(p)this.activities.walkTo(p);};
        }
        showHint() { const o = D.objectives[this.case.stage]; this.showModal('A SMALL NUDGE', o.title, `<p>${esc(o.hint)}</p><div class="modal-actions"><button class="primary" id="hint-close">Return to the street</button><button class="secondary" id="hint-map">Open the map</button></div>`); $('hint-close').onclick = () => this.closeModal(); $('hint-map').onclick = () => this.openMap(); }
        talkTo(id) {
            this.case.stats.talks++;
            if(this.activities.talk(id))return;
            const resident=this.world.npc(id); if(resident?.barks){this.say(id,[resident.barks[this.clock.minutes>=1080?1:0]]);return;}
            const s = this.case.stage;
            switch (id) {
                case 'hana':
                    this.choose('hana', s === 7 ? 'The harbor sounds like itself again. Ken always did choose the long way home.' : 'Nao? Your jacket is still wet. Come under the awning. What brings you back?', [
                        { label: 'Ask about Ken', action: () => this.say('hana', s >= 2 ? ["Ken bought two lunches. One for himself, and one for Emi at the ferry workshop.", "He was worried about the new breakwater. Ask people who work on the water. They know when something is wrong."] : ["Ken was here before noon. A man in a dark coat followed him down the lane.", "He left something at Sato's radio shop. Go east, past the bookshop. Sato has kept it for you."], () => { this.note('hana', 'Two lunches, one empty chair', "Hana saw Ken before noon. He left a parcel with Sato at the radio shop, east of the bookshop. Someone followed him."); this.advance(1); }) },
                        { label: 'Buy hot tea · ¥100', action: () => { if (!this.case.spend(100)) {
                                this.say('hana', ["Keep your coins. Sit for a moment. The rain has passed."]);
                                return;
                            } this.player.hp = 100; this.sound.play('bell'); this.say('hana', ["Drink slowly. You can hear the ferry bell from here.", "If you need to wait for someone, there is a bench beside the seawall."]); this.case.flags.tea = true; this.save(false); } },
                        { label: this.case.flags.fish ? 'Ask about the harbor cat' : 'Buy dried fish · ¥50', action: () => { if (this.case.flags.fish) {
                                this.say('hana', ["The little cat waits behind the morning store. It likes to keep its feet dry."]);
                                return;
                            } if (this.case.spend(50)) {
                                this.case.flags.fish = true;
                                this.case.addItem('fish', 'Dried fish', "Hana wrapped this for the small cat behind the morning store.");
                                this.say('hana', ["For the little cat? It waits behind the morning store, near the seawall."]);
                                this.save(false);
                            }
                            else
                                this.say('hana', ["Come back after your shift. The cat will wait."]); } },
                        { label: 'Say goodbye', action: () => { } }
                    ]);
                    break;
                case 'sato':
                    if (s < 2)
                        this.say('sato', ["I heard the line go dead, too. Ken brought me this tape sleeve before he left.", "Empty. But look at it carefully. Your brother never throws useful information away."], () => { this.advance(1); this.openInspect(); });
                    else
                        this.choose('sato', s === 7 ? 'A clear signal. That is all I ever ask of a good radio.' : 'A tape can hold a voice after its owner has gone. Be careful with this one.', [{ label: 'Inspect the sleeve again', action: () => this.openInspect() }, { label: 'Ask about the signal station', action: () => this.say('sato', ["Aya still keeps the old signal station open. West end of the upper lane.", "Its radio can reach the lighthouse. Find the frequency on the recording's label."]) }, { label: 'Leave', action: () => { } }]);
                    break;
                case 'emi':
                    if (this.clock.minutes < 1050)
                        this.say('emi', ["I cannot leave this engine yet. Meet me at the slipway after 17:30.", "There is a bench by the water if you want to wait. Or ask Imai to show you his footwork."], () => { if (s >= 2)
                            this.note('appointment', 'The end of Emi\'s shift', 'Emi leaves the workshop at 17:30. Meet her at the eastern slipway. The waterfront bench can advance time.'); });
                    else if (s < 2)
                        this.say('emi', ["Ken asked me to wait for his brother. You must be Nao.", "Go to Sato's radio shop first. Ken left you a sleeve with two useful marks."]);
                    else if (s === 2)
                        this.say('emi', ["Ken is safe. He crossed to the north light before those collectors came back.", "He recorded the real tide readings. The breakwater contractor changed the figures. Boats would have entered water that was too shallow.", "Jun put the recording in the ferry lockers. Help him finish the evening load, and he can give you the key."], () => { this.note('emi', 'Ken is alive', "Emi saw Ken leave for the north light. His tape records false breakwater readings. Jun has the locker key at the cargo quay."); this.advance(3); });
                    else
                        this.say('emi', s === 7 ? ["I heard Ken on the radio. The ferry crew has stopped the unsafe crossing.", "Tomorrow we can repair things properly."] : ["Jun is at the cargo quay, south of here. He has three crates left to load.", "When you get the tape, take it to Aya at the old signal station."]);
                    break;
                case 'jun':
                    if (s < 3)
                        this.say('jun', ["Three crates and one pair of hands. This ferry will leave without my lunch if I am not careful.", "Emi knows about Ken. Find her at the slipway when her shift ends at 17:30."]);
                    else if (s === 3 && !this.work?.active)
                        this.say('jun', ["Ken trusted you. That is enough for me.", "Help me put these three crates in the painted loading square. The key is in my coat. You will earn ¥600, too.", "Press E beside a marked crate to lift it. Carry it to the square near the seawall. Press E again to set it down."], () => this.startWork());
                    else if (this.work?.active)
                        this.say('jun', ["The marked crates go in the painted square. Take your time. The load matters more than the bonus."]);
                    else
                        this.say('jun', s === 7 ? ["The tape got through. Good. These boats carry our families.", "You still have a job here whenever you need one."] : ["Locker 04. Keep the brass key dry. The lockers are by the blue warehouse."]);
                    break;
                case 'imai':
                    this.choose('imai', this.case.flags.trained ? 'Your feet know the answer now. Keep your hands quiet and your eyes open.' : 'Do not meet force with more force. Give it somewhere empty to go.', [{ label: this.case.flags.trained ? 'Practice the Wharf Step' : 'Learn the Wharf Step', action: () => this.trainingIntro() }, { label: 'Ask about Ken', action: () => this.say('imai', ["Ken was troubled by those dock collectors. Strong voices, poor balance.", "If you must face them, watch their shoulders. Step as they commit, then answer with one clean strike."]) }, { label: 'Leave', action: () => { } }]);
                    break;
                case 'aya':
                    if (s >= 6 && s < 7)
                        this.say('aya', ["You have the tape. Sato told me to expect you.", "Use the radio on the table. The correct frequency is written on the tape label."], () => this.openRadio());
                    else if (s === 7)
                        this.say('aya', ["The coast watch has the recording. The ferry will use the safe channel tonight.", "Ken will come home on the next crossing. Wait with us, if you like."]);
                    else
                        this.say('aya', ["The signal station is old, but its voice still reaches across the bay.", "Ken called earlier. Something worried him. Bring me his recording when you find it."]);
                    break;
                case 'yui':
                    this.say('yui', ["Ken bought a notebook this morning. He said the printed tide tables could not be right.", s < 2 ? "Sato kept an empty tape sleeve for him. The repair shop is next door, to the east." : "Emi works on the ferry engines. Ask her when the shift ends at 17:30."], () => { this.note('yui', 'A second witness', "Yui sold Ken a notebook for his tide measurements. She also saw him visit Sato's radio shop."); if (s === 0)
                        this.advance(1); });
                    break;
                case 'tomo':
                    this.say('tomo', s === 7 ? ["A safe departure. We can ask for no better end to the day."] : ["The last ferry leaves after the signal keeper checks the channel. Time alone does not make a crossing safe.", "Jun is finishing the load on the eastern quay. He keeps the spare locker keys."]);
                    break;
                default: this.say(id, [id === 'visitor2' ? "The water looks calm. That does not tell you how deep it is." : id === 'visitor3' ? "Hana has opened this shop every morning for thirty years. You can set your watch by her kettle." : id === 'visitor4' ? "There is a new game in the arcade. I keep missing the center mark." : "This road used to be much narrower. The sea keeps taking it back."]);
            }
        }
        openBench() { this.showModal('A MOMENT BY THE WATER', 'Let the afternoon pass', `<p>The ferry rocks against its ropes. Emi finishes work at <strong>17:30</strong>.</p><p>It is now <strong>${this.clock.format()}</strong>. The town will move to its next routine when you wait.</p><div class="modal-actions"><button class="primary" id="wait-appointment">${this.clock.minutes < 1050 ? 'Wait until 17:30' : 'Rest for 20 minutes'}</button><button class="secondary" id="leave-bench">Keep walking</button></div>`); $('wait-appointment').onclick = () => { this.closeModal(); this.clock.waitUntil(this.clock.minutes < 1050 ? 1050 : this.clock.minutes + 20); this.clock.minutes = Math.min(this.clock.minutes, 1200); this.world.syncSchedules(this.clock); this.player.hp = 100; this.sound.play('bell'); this.save(false); this.showCinema('THE WATERFRONT', this.clock.format(), 'The wind turns. Somewhere, a kettle begins to sing.', 2, () => this.toast(this.case.stage === 2 ? 'Emi is at the eastern slipway.' : 'You feel rested.', 'THE AFTERNOON MOVES ON')); }; $('leave-bench').onclick = () => this.closeModal(); }
        openInspect() { this.inspection = { face: 0, angle: 25, target: 25 }; this.showModal('OBJECT INSPECTION', 'The tape sleeve', `<div class="inspect-layout"><div><canvas id="inspect-canvas" class="inspect-canvas" width="360" height="280" aria-label="Rotatable tape sleeve"></canvas><div class="inspect-controls"><button class="secondary" id="turn-left">Turn left</button><button class="secondary" id="turn-right">Turn right</button></div></div><div class="inspect-notes"><span class="eyebrow">LOOK ON BOTH SIDES</span><p>A cardboard sleeve, damp at one corner. Ken pressed something into the paper.</p><ul><li id="front-note"></li><li id="back-note"></li></ul><button class="secondary" id="examine-object">Examine this side · E</button><button class="primary" id="keep-sleeve" hidden>Keep the sleeve</button><p class="text-small muted">Turn with the buttons or left / right arrow keys.</p></div></div>`, 'inspect'); this.inspection = { face: 0, angle: 25, target: 25 }; $('turn-left').onclick = () => this.turnInspect(-1); $('turn-right').onclick = () => this.turnInspect(1); $('examine-object').onclick = () => this.examine(); $('keep-sleeve').onclick = () => { this.closeModal(); this.case.addItem('sleeve', 'Tape sleeve', "Front: Locker 04. Reverse: EMI · 17:30. Ken left it at Sato's repair shop."); this.note('sleeve', 'Locker 04 · Emi · 17:30', "The sleeve carries the number 04 on its front. On the reverse: EMI, 17:30. Find the ferry mechanic at the eastern slipway after her shift."); this.advance(2); }; this.inspectLabels(); this.drawInspect(0); }
        turnInspect(dir) { if (!this.inspection)
            return; this.inspection.face = 1 - this.inspection.face; this.inspection.target += dir * 180; this.sound.play('paper'); }
        inspectLabels() { if (!$('front-note'))
            return; const a = !!this.case.flags.inspectFront, b = !!this.case.flags.inspectBack; $('front-note').className = a ? 'found' : 'unfound'; $('front-note').textContent = a ? '✓ Front: FERRY LOCKER 04' : '○ Front: an unread stamp'; $('back-note').className = b ? 'found' : 'unfound'; $('back-note').textContent = b ? '✓ Reverse: EMI · 17:30' : '○ Reverse: a pencil mark'; $('keep-sleeve').hidden = !(a && b); }
        examine() { if (!this.inspection)
            return; const flag = this.inspection.face ? 'inspectBack' : 'inspectFront'; if (!this.case.flags[flag]) {
            this.case.flags[flag] = true;
            this.sound.play('clue');
            this.save(false);
        } this.inspectLabels(); }
        drawInspect(dt) { if (!this.inspection || !$('inspect-canvas'))
            return; const q = this.inspection; q.angle = E.approach(q.angle, q.target, dt * 440); const c = $('inspect-canvas'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); const v = new E.View('object', 'Object', q.angle, 22, 3, 1), w = (x, y, z) => { const p = v.p(x, y, z); return [p[0] + 180, p[1] + 207]; }; const poly = (p, c) => E.px.poly(g, p.map(a => w(...a)), c); poly([[-32, -3, 0], [32, -3, 0], [32, 3, 0], [-32, 3, 0]], '#8d8d76'); poly([[-32, 3, 0], [32, 3, 0], [32, 3, 41], [-32, 3, 41]], '#b8b19a'); poly([[-32, -3, 0], [32, -3, 0], [32, -3, 41], [-32, -3, 41]], '#b8b19a'); poly([[-32, -3, 41], [32, -3, 41], [32, 3, 41], [-32, 3, 41]], '#ddd3b5'); poly([[32, -3, 0], [32, 3, 0], [32, 3, 41], [32, -3, 41]], '#777f70'); if (Math.abs(q.target - q.angle) < 8) {
            const x = 180, y = 116;
            E.px.rect(g, x - 68, y - 24, 136, 56, '#d9d0b5');
            E.px.rect(g, x - 62, y - 20, 124, 2, '#8a7460');
            E.font.text(g, q.face ? 'EMI' : 'FERRY LOCKER', x, y - 11, '#3b5758', { align: 'center', scale: 1, shadow: false, outline: false });
            E.font.text(g, q.face ? '17:30' : '04', x, y + 5, '#425b5b', { align: 'center', scale: 2, shadow: false, outline: false });
            E.font.text(g, q.face ? 'REVERSE' : 'FRONT', 180, 246, '#a7b9aa', { align: 'center', shadow: false, outline: false });
        } }
        startWork() { this.mode = 'work'; this.work = { active: true, elapsed: 0 }; this.carry = null; this.world.crates = D.crates.map(c => ({ ...c, delivered: false })); this.toast('Move each marked crate into the painted loading square.', 'THE EVENING LOAD'); this.save(false); this.updateHUD(); }
        cargoInteract(o) { if (this.carry !== null) {
            const c = this.world.crates.find(c => c.id === this.carry);
            if (Math.hypot(this.player.x - 750, this.player.y - 525) < 43) {
                c.delivered = true;
                this.case.stats.crates++;
                this.carry = null;
                this.sound.play('crate');
                const count = this.world.crates.filter(c => c.delivered).length;
                if (count === 3) {
                    const bonus = this.work.elapsed <= 85 ? 100 : 0;
                    this.work.active = false;
                    this.work = null;
                    this.case.award('cargoPaid', 600 + bonus);
                    this.case.addItem('key', 'Brass locker key', 'A small key for Locker 04 beside the blue warehouse. Jun gave it to you after the evening load.');
                    this.advance(4);
                    this.note('cargo', 'The evening load', `The three crates are loaded. Jun paid ¥${600 + bonus} and gave me the key to Locker 04.`);
                    this.say('jun', ["Good work. Here is the key. Locker 04, beside the blue warehouse.", bonus ? '¥600 for the load, and ¥100 for the quick finish. Keep your head down out there.' : '¥600, as promised. You took care of the cargo. That matters.']);
                }
                else
                    this.toast(`${count} of 3 crates loaded.`, 'CARGO READY');
            }
            else {
                const a = this.player.facing;
                c.x = this.player.x + Math.cos(a) * 15;
                c.y = this.player.y + Math.sin(a) * 15;
                if (!this.world.canWalk(c.x, c.y)) {
                    c.x = this.player.x;
                    c.y = this.player.y;
                }
                this.carry = null;
                this.sound.play('crate');
                this.toast('The crate is here when you are ready.', 'SET DOWN');
            }
        }
        else if (o.crateId !== undefined) {
            this.carry = o.crateId;
            this.sound.play('crate');
            this.toast('Walk to the painted loading square.', 'CRATE LIFTED');
        } this.save(false); this.findNearest(); this.updateHUD(); }
        openLockers() { if (this.case.stage < 4) {
            this.say('nao', [this.case.stage < 2 ? 'Four lockers. Each one needs a key.' : 'Locker 04. Jun has the key at the cargo quay.']);
            return;
        } if (this.case.stage > 4) {
            this.say('nao', ["The empty locker smells of salt and machine oil. The tape was here."]);
            return;
        } this.showModal('FERRY PROPERTY', 'Choose a locker', `<p>The brass key is warm in your hand. Which number was stamped on the sleeve?</p><div class="locker-grid">${[1, 2, 3, 4].map(n => `<button id="locker-${n}" aria-label="Open locker ${n}">${String(n).padStart(2, '0')}</button>`).join('')}</div><p id="locker-message" class="text-small muted">Your notebook keeps the marks from the sleeve.</p>`); for (let n = 1; n <= 4; n++)
            $('locker-' + n).onclick = () => { if (n !== 4) {
                $('locker-message').textContent = 'The key does not turn. Check the number in your notebook.';
                this.sound.play('paper');
                return;
            } this.closeModal(); this.advance(5); this.case.flags.chaseDone = false; this.note('theft', 'A voice worth stealing', 'Locker 04 held Ken\'s recording. A dock collector took the tape and ran toward the warehouse yard.'); this.say('collector', ["That recording belongs to the contractor. Let it go."], () => this.say('nao', ["Then why are you running?"], () => this.startChase())); }; }
        vendingMenu() { this.showModal('A SMALL BREAK', 'A cold drink', `<p>Three rows of cans hum behind the glass. A citrus drink costs <strong>¥100</strong> and restores your health.</p><p>You have <strong>¥${this.case.money}</strong>.</p><div class="modal-actions"><button class="primary" id="buy-drink" ${this.case.money < 100 ? 'disabled' : ''}>Buy a drink · ¥100</button><button class="secondary" id="leave-vending">Leave</button></div>`); $('buy-drink').onclick = () => { if (!this.case.spend(100))
            return; this.player.hp = 100; this.case.flags.drink = true; this.sound.play('bell'); this.closeModal(); this.toast('Cold citrus. Warm hands. Health restored.', 'A SMALL BREAK'); this.save(false); }; $('leave-vending').onclick = () => this.closeModal(); }
        capsuleMenu() { const found = this.case.inventory.filter(i => i.id.startsWith('toy-')).length; this.showModal('HARBOR COLLECTION', 'A small piece of Aonami', `<p>A faded sign promises three harbor toys. Each turn costs <strong>¥50</strong>.</p><p>Collection: <strong>${found} / 3</strong> · Your money: <strong>¥${this.case.money}</strong></p><div id="toy-result"></div><div class="modal-actions"><button class="primary" id="buy-capsule" ${this.case.money < 50 ? 'disabled' : ''}>Turn the handle · ¥50</button><button class="secondary" id="leave-capsule">Leave</button></div>`); $('buy-capsule').onclick = () => { if (!this.case.spend(50))
            return; const n = this.case.flags.capsules || 0, toy = D.toys[n % 3]; this.case.flags.capsules = n + 1; const fresh = this.case.addItem(toy.id, toy.name, toy.description); this.sound.play('bell'); $('toy-result').innerHTML = `<div class="journal-current"><span class="eyebrow">${fresh ? 'NEW TOY' : 'ANOTHER LITTLE FRIEND'}</span><p>${esc(toy.name)}. ${esc(toy.description)}</p></div>`; $('buy-capsule').disabled = this.case.money < 50; this.save(false); this.updateHUD(); if (fresh && this.case.inventory.filter(i => i.id.startsWith('toy-')).length === 3)
            this.note('toys', 'Three pieces of the harbor', 'The gull, the ferry, and the north light. A complete little harbor fits in my bag.'); }; $('leave-capsule').onclick = () => this.closeModal(); }
        catMenu() { if (this.case.flags.catFed) {
            this.say('nao', ["The cat leans against my shoe. It has decided that I can stay."]);
            return;
        } if (!this.case.flags.fish) {
            this.say('nao', ["One ear is torn, but the eyes are bright. It watches my empty hands.", "Hana may have something it can eat."]);
            return;
        } this.choose('nao', 'The cat lifts its head at the paper packet.', [{ label: 'Give it the dried fish', action: () => { this.case.flags.catFed = true; this.case.flags.fish = false; this.case.inventory = this.case.inventory.filter(i => i.id !== 'fish'); this.note('cat', 'A friend at the seawall', 'The harbor cat ate the dried fish. It follows the sound of my footsteps now.'); this.say('nao', ["It eats the fish, then presses its head against my hand.", "Some things do not need a better reason."]); this.save(false); } }, { label: 'Leave it for now', action: () => { } }]); }
        arcadeMenu() { this.showModal('NAMI GAMES · 1993', 'Signal Catch', `<p>Catch five signals. Stop the moving line as close to the center as you can. Each catch scores up to 100 points.</p><p>A score of <strong>400</strong> earns <strong>¥150</strong>. Your best score is <strong>${this.case.stats.arcadeBest}</strong>.</p><div class="modal-actions"><button class="primary" id="start-arcade">${this.case.money >= 50 ? 'Insert coin · ¥50' : 'Free practice'}</button><button class="secondary" id="leave-arcade">Return to the street</button></div>`); $('start-arcade').onclick = () => this.startArcade(); $('leave-arcade').onclick = () => this.closeModal(); }
        startArcade() { const paid = this.case.spend(50); this.save(false); this.showModal('NAMI GAMES', 'Signal Catch', `<div class="arcade-screen"><div class="arcade-score"><span id="arcade-round">SIGNAL 1 / 5</span><span id="arcade-score">000</span></div><div class="arcade-title">SIGNAL CATCH</div><div class="arcade-track"><div class="arcade-target"></div><div id="arcade-marker" class="arcade-marker"></div></div><div class="arcade-message" id="arcade-message">Catch the center. Trust your timing.</div><button class="primary" id="arcade-catch">Catch · SPACE</button></div><p class="text-small muted">${paid ? 'Five signals. Reach 400 to earn ¥150.' : 'Free practice. No coins or prize money.'} Press Escape to leave.</p>`, 'arcade'); this.arcade = { t: 0, round: 0, score: 0, x: 0, lock: 0, paid, finished: false }; $('arcade-catch').onclick = () => this.catchSignal(); }
        updateArcade(dt) { const a = this.arcade; if (!a || a.finished)
            return; a.t += dt; a.lock = Math.max(0, a.lock - dt); a.x = .5 + Math.sin(a.t * (2.4 + a.round * .4)) * .49; $('arcade-marker').style.left = (a.x * 98) + '%'; if (this.game.input.pressed('dodge'))
            this.catchSignal(); }
        catchSignal() { const a = this.arcade; if (!a || a.finished || a.lock > 0)
            return; const pts = Math.max(0, Math.round(100 - Math.abs(a.x - .5) * 210)); a.score += pts; a.round++; a.lock = .5; this.sound.play(pts > 85 ? 'clue' : 'bell'); $('arcade-score').textContent = String(a.score).padStart(3, '0'); $('arcade-message').textContent = (pts >= 90 ? 'Clear signal. ' : pts >= 65 ? 'Good catch. ' : 'A little static. ') + '+' + pts; if (a.round >= 5) {
            a.finished = true;
            this.case.stats.arcadeBest = Math.max(this.case.stats.arcadeBest, a.score);
            if (a.paid && a.score >= 400)
                this.case.money += 150;
            this.case.flags.arcade = true;
            $('arcade-round').textContent = 'ALL SIGNALS CAUGHT';
            $('arcade-message').textContent = `Final score: ${a.score}. ${a.paid && a.score >= 400 ? 'Prize: ¥150.' : 'The harbor keeps its rhythm.'}`;
            $('arcade-catch').textContent = 'Play again';
            $('arcade-catch').onclick = () => this.arcadeMenu();
            this.save(false);
        }
        else
            $('arcade-round').textContent = `SIGNAL ${a.round + 1} / 5`; }
        trainingIntro() { this.showModal('IMAI\'S LESSON', 'The Wharf Step', `<p>Let the strike pass. Step away, then answer with a short punch. Practice uses the same controls as a real fight.</p><div class="training-steps"><div><span>01 · WATCH</span>Imai raises his shoulders before a strike.</div><div><span>02 · STEP</span>Press <kbd>SPACE</kbd> with a direction.</div><div><span>03 · ANSWER</span>Move close and press <kbd>J</kbd> within one second.</div></div><p>Land two counter hits. There is no penalty for a mistake. You can leave practice from the pause menu.</p><div class="modal-actions"><button class="primary" id="begin-training">Begin practice</button><button class="secondary" id="decline-training">Perhaps later</button></div>`); $('begin-training').onclick = () => { this.closeModal(); this.startBattle(true); }; $('decline-training').onclick = () => this.closeModal(); }
        makeEnemy(x, y, heavy = false, training = false) { return { x, y, z: 0, vx: 0, vy: 0, facing: Math.PI, hp: training ? 999 : heavy ? 132 : 90, maxHp: training ? 999 : heavy ? 132 : 90, heavy, dead: false, hurt: 0, cooldown: training ? 2 : heavy ? 2.1 : 1.1, intent: 0, attack: new E.Attack(heavy ? 'haymaker' : 'cross', { wind: .2, active: .16, recover: .5 }), rig: new E.HarborRig({ size: training ? .98 : heavy ? 1.09 : 1, build: heavy ? 'bulky' : 'heroic', hair: 'short', colors: { skin: training ? '#d3b79b' : '#c3a089', cloth: training ? '#b0b3a0' : heavy ? '#615953' : '#4b626b', pants: '#2f4350', hair: training ? '#c8c4b0' : '#293941', boot: '#1e343e' } }) }; }
        startBattle(training) { this.hidePanels(); this.mode = 'combat'; this.training = training; this.trainingCounters = 0; this.trainingReturn = { x: this.player.x, y: this.player.y }; this.player.hp = 100; this.player.stamina = 100; this.player.hurt = 0; this.player.dodge = 0; this.player.dodgeCooldown = 0; this.player.counter = 0; this.combo.cancel(); this.kick.cancel(); this.path = []; this.enemies = training ? [this.makeEnemy(241, 363, false, true)] : [this.makeEnemy(750, 205, false), this.makeEnemy(777, 246, true)]; Object.assign(this.player, training ? { x: 217, y: 369, facing: 0 } : { x: 714, y: 230, facing: 0 }); this.game.cam.snap = true; this.game.focus(this.player.x, this.player.y, 18); this.battleEndTimer = 0; this.game.input.clear(); this.toast(training ? 'Step with Space. Then strike with J. Land two counters.' : 'Watch the shoulders. Step, guard, and strike.', 'KEEP YOUR BALANCE'); this.updateHUD(); }
        updateCombat(dt) {
            const p = this.player, input = this.game.input;
            p.hurt = Math.max(0, p.hurt - dt);
            p.dodge = Math.max(0, p.dodge - dt);
            p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
            p.counter = Math.max(0, p.counter - dt);
            const guard = input.down('guard') && p.stamina > 2 && p.dodge <= 0;
            this.combo.update(dt);
            this.kick.update(dt);
            let [sx, sy] = input.move(), [dx, dy] = this.game.view.screenDirToGround(sx, sy);
            const live = this.enemies.filter(e => !e.dead), near = [...live].sort((a, b) => E.dist(p, a) - E.dist(p, b))[0];
            if (input.pressed('dodge') && p.dodgeCooldown <= 0 && p.stamina >= 22) {
                if (!dx && !dy) {
                    dx = near ? (p.x - near.x) / (E.dist(p, near) || 1) : -Math.cos(p.facing);
                    dy = near ? (p.y - near.y) / (E.dist(p, near) || 1) : -Math.sin(p.facing);
                }
                p.dodge = .26;
                p.dodgeCooldown = .66;
                p.counter = 1.15;
                p.stamina -= 22;
                p.dodgeX = dx;
                p.dodgeY = dy;
                this.combo.cancel();
                this.kick.cancel();
                this.sound.play('step');
            }
            if (input.buffered('attack') && !this.kick.busy && p.dodge < .1 && p.stamina > 5) {
                if (near && E.dist(p, near) < 62)
                    p.facing = Math.atan2(near.y - p.y, near.x - p.x);
                if (this.combo.press()) {
                    input.consume('attack');
                    p.stamina = Math.max(0, p.stamina - 5);
                }
            }
            if (input.buffered('kick') && !this.combo.busy && p.dodge < .1 && p.stamina >= 17) {
                if (near && E.dist(p, near) < 70)
                    p.facing = Math.atan2(near.y - p.y, near.x - p.x);
                if (this.kick.start()) {
                    input.consume('kick');
                    p.stamina -= 17;
                }
            }
            let speed = guard ? 19 : (this.combo.busy || this.kick.busy) ? 16 : 48;
            if (p.dodge > 0) {
                dx = p.dodgeX;
                dy = p.dodgeY;
                speed = 112;
            }
            p.vx = dx * speed;
            p.vy = dy * speed;
            if ((dx || dy) && !this.combo.busy && !this.kick.busy && p.dodge <= 0)
                p.facing = E.approachAng(p.facing, Math.atan2(dy, dx), dt * 14);
            if (guard && near)
                p.facing = Math.atan2(near.y - p.y, near.x - p.x);
            this.world.move(p, p.vx * dt, p.vy * dt);
            if (this.training) {
                p.x = E.clamp(p.x, 203, 250);
                p.y = E.clamp(p.y, 324, 418);
            }
            else {
                p.x = E.clamp(p.x, 709, 794);
                p.y = E.clamp(p.y, 150, 290);
            }
            p.stamina = E.clamp(p.stamina + dt * (guard ? -6 : (!this.combo.busy && !this.kick.busy ? 24 : 7)), 0, 100);
            const onHit = (en, kick = false) => { const counter = p.counter > 0; let damage = kick ? 24 : [14, 17, 22][this.combo.step] || 14; if (counter) {
                damage *= this.case.flags.trained || this.training ? 2 : 1.55;
                p.counter = 0;
                this.case.stats.counters++;
                if (this.training) {
                    this.trainingCounters++;
                    this.toast(`${Math.min(2, this.trainingCounters)} / 2 clean counters.`, 'THE WHARF STEP');
                }
            } if (en.heavy && en.intent > 0)
                damage *= .7; en.hp = Math.max(0, en.hp - damage); en.hurt = .25; if (!en.heavy || en.intent <= 0) {
                en.attack.cancel();
                en.intent = 0;
                en.cooldown = Math.max(en.cooldown, .7);
            } const a = Math.atan2(en.y - p.y, en.x - p.x); this.world.move(en, Math.cos(a) * (kick ? 9 : 4), Math.sin(a) * (kick ? 9 : 4), 6); if (this.training) {
                en.x = E.clamp(en.x, 207, 249);
                en.y = E.clamp(en.y, 327, 410);
            }
            else {
                en.x = E.clamp(en.x, 712, 790);
                en.y = E.clamp(en.y, 153, 282);
            } this.game.hitFx(en.x, en.y, 25, { power: counter ? .75 : .3, color: counter ? '#ffe0a4' : '#d8b58a', sound: 'hit' }); if (en.hp <= 0 && !this.training) {
                en.dead = true;
                en.attack.cancel();
                this.sound.play('kick');
            } };
            this.combo.hits(live, en => E.inArc(p, p.facing, en, 25, 1.25), en => onHit(en, false));
            this.kick.hits(live, en => E.inArc(p, p.facing, en, 32, 1.4), en => onHit(en, true));
            for (const en of this.enemies) {
                en.hurt = Math.max(0, en.hurt - dt);
                en.vx = en.vy = 0;
                if (!en.dead) {
                    en.cooldown -= dt;
                    en.facing = E.lerpAng(en.facing, Math.atan2(p.y - en.y, p.x - en.x), Math.min(1, dt * 7));
                    const dist = E.dist(p, en);
                    if (en.intent > 0) {
                        en.intent -= dt;
                        if (en.intent <= 0)
                            en.attack.start();
                    }
                    else if (!en.attack.busy && en.hurt <= 0) {
                        if (dist > 23) {
                            const sp = this.training ? 16 : en.heavy ? 21 : 27;
                            en.vx = Math.cos(en.facing) * sp;
                            en.vy = Math.sin(en.facing) * sp;
                            this.world.move(en, en.vx * dt, en.vy * dt, 6);
                        }
                        else if (en.cooldown <= 0 && !this.enemies.some(o => o !== en && !o.dead && (o.intent > 0 || o.attack.busy))) {
                            en.intent = this.training ? .85 : en.heavy ? .78 : .58;
                            en.cooldown = this.training ? 2.2 : en.heavy ? 2 : 1.4;
                        }
                    }
                    en.attack.update(dt);
                    en.attack.hits([p], () => E.dist(en, p) < 29 && p.dodge <= 0, () => { if (guard) {
                        p.stamina = Math.max(0, p.stamina - 15);
                        if (!this.training)
                            p.hp = Math.max(0, p.hp - 1);
                        this.sound.play('hit');
                        this.toast('Guard held. Step to make room.', 'BLOCK');
                    }
                    else {
                        const damage = (en.heavy ? 18 : 12) * (this.settings.assisted ? .45 : 1);
                        p.hp = Math.max(0, p.hp - (this.training ? 4 : damage));
                        p.hurt = .32;
                        this.combo.cancel();
                        this.kick.cancel();
                        this.game.hitFx(p.x, p.y, 25, { power: .45, color: '#e0b393' });
                        const a = en.facing;
                        this.world.move(p, Math.cos(a) * 7, Math.sin(a) * 7);
                        if (this.training && p.hp < 40)
                            p.hp = 100;
                    } });
                }
                en.rig.update(dt, { ...en, attack: en.attack.state, hurt: en.hurt > 0, pose: en.dead ? 'die' : en.intent > 0 ? 'guard' : null, stance: !en.dead ? 'guard' : null });
            }
            // Keep fighters separate without applying force through static walls.
            for (let i = 0; i < this.enemies.length; i++)
                for (let j = i + 1; j < this.enemies.length; j++) {
                    const a = this.enemies[i], b = this.enemies[j];
                    if (a.dead || b.dead)
                        continue;
                    const d = E.dist(a, b);
                    if (d > 0 && d < 15) {
                        const k = (15 - d) * .5;
                        this.world.move(a, (a.x - b.x) / d * k, (a.y - b.y) / d * k, 6);
                        this.world.move(b, (b.x - a.x) / d * k, (b.y - a.y) / d * k, 6);
                    }
                }
            if (this.training && this.trainingCounters >= 2) {
                this.finishTraining(true);
                return;
            }
            if (!this.training && p.hp <= 0) {
                this.battleDefeat();
                return;
            }
            if (!this.training && this.enemies.every(e => e.dead)) {
                this.battleEndTimer += dt;
                if (this.battleEndTimer > .85) {
                    this.battleVictory();
                    return;
                }
            }
            this.game.focus(p.x, p.y, 18);
        }
        finishTraining(success) { this.enemies = null; this.mode = this.work?.active ? 'work' : 'explore'; this.training = false; Object.assign(this.player, { ...this.trainingReturn, hp: 100, stamina: 100, vx: 0, vy: 0 }); this.combo.cancel(); this.kick.cancel(); this.game.cam.snap = true; if (success) {
            this.case.flags.trained = true;
            this.note('training', 'The Wharf Step', "Imai taught me to step away with Space, then counter with J within one second. The counter now deals more damage.");
            this.say('imai', ["There. A small step was enough.", "Use the same movement when it matters. A clean counter is stronger than a rushed exchange."]);
        }
        else
            this.toast('You can return to Imai at any time.', 'PRACTICE ENDED'); this.save(false); this.updateHUD(); }
        battleDefeat() { this.case.stats.defeats++; this.save(false); this.showModal('A SECOND BREATH', 'Find your balance', `<p>Nao gets back up. Your evidence and completed work are safe.</p><p>Watch for the amber warning. Use <kbd>L</kbd> to guard, or step with <kbd>SPACE</kbd>. Then strike with <kbd>J</kbd> or <kbd>K</kbd>.</p><div class="modal-actions"><button class="primary" id="retry-battle">Try the fight again</button><button class="secondary" id="gentle-battle">Retry with Gentle action</button></div>`); $('modal-close').hidden = true; $('retry-battle').onclick = () => { this.closeModal(); this.startBattle(false); }; $('gentle-battle').onclick = () => { this.settings.assisted = true; this.closeModal(); this.startBattle(false); }; }
        battleVictory() { this.enemies = null; this.mode = 'explore'; this.player.hp = Math.max(this.player.hp, 65); this.combo.cancel(); this.kick.cancel(); this.case.flags.chaseDone = true; this.case.addItem('tape', 'Ken\'s recording', "Real tide readings, recorded by Ken. Label: NORTH LIGHT · 82.4 MHz. Play it at the old signal station."); this.advance(6); this.note('recording', 'The real readings', "The recording is safe. Its label says NORTH LIGHT · 82.4 MHz. Aya's radio can reach Ken at the lighthouse."); this.say('collector', ["We were paid to take it. That is all I know."], () => this.say('nao', ["Those boats carry people. Walk away."], () => this.toast('Take the recording to the old signal station.', 'THE TAPE IS SAFE'))); this.save(false); this.updateHUD(); }
        startChase() { this.hidePanels(); this.mode = 'chase'; this.enemies = null; this.training = false; this.path = []; this.carry = null; this.chase = { index: 0, t: 0, prompt: false, paused: false, steps: [{ action: 'left', key: 'A', label: 'Turn into the market lane', place: 'The market lane', from: [596, 313], to: [666, 349] }, { action: 'down', key: 'S', label: 'Duck under the hanging net', place: 'The rope walk', from: [666, 349], to: [741, 365] }, { action: 'dodge', key: 'SPACE', label: 'Clear the cargo barrier', place: 'The warehouse yard', from: [741, 365], to: [752, 281] }] }; this.game.cam.snap = true; this.beginChaseStep(); }
        beginChaseStep() { const c = this.chase, s = c.steps[c.index]; c.t = 0; c.prompt = false; this.mode = 'chase'; $('chase').hidden = false; $('qte-key').disabled = true; $('qte-step').textContent = `OBSTACLE ${c.index + 1} / 3`; $('chase-scene').textContent = s.place; $('qte-action').textContent = 'Get ready…'; $('qte-key').textContent = s.key; $('qte-time').style.width = '100%'; Object.assign(this.player, { x: s.from[0], y: s.from[1], z: 0, facing: Math.atan2(s.to[1] - s.from[1], s.to[0] - s.from[0]), vx: 45, vy: 0 }); this.game.input.clear(); this.setTouch(false); }
        updateChase(dt) { const c = this.chase; if (!c)
            return; const s = c.steps[c.index], windowTime = this.settings.assisted ? 6 : 2.6; c.t += dt; const u = E.clamp(c.t / (1.5 + windowTime), 0, 1); this.player.x = E.lerp(s.from[0], s.to[0], u); this.player.y = E.lerp(s.from[1], s.to[1], u); this.player.facing = Math.atan2(s.to[1] - s.from[1], s.to[0] - s.from[0]); this.player.vx = Math.cos(this.player.facing) * 75; this.player.vy = Math.sin(this.player.facing) * 75; this.player.z = c.index === 2 && u > .8 ? Math.sin((u - .8) * Math.PI * 5) * 11 : 0; this.game.focus(this.player.x + 15, this.player.y, 20); if (c.t >= 1.5 && !c.prompt) {
            c.prompt = true;
            $('qte-key').disabled = false;
            $('qte-action').textContent = s.label;
            this.sound.play('bell');
            this.game.input.clear();
        } if (c.prompt) {
            $('qte-time').style.width = Math.max(0, 1 - (c.t - 1.5) / windowTime) * 100 + '%';
            for (const action of ['left', 'down', 'dodge', 'up', 'right', 'interact'])
                if (this.game.input.pressed(action)) {
                    this.qtePress(action);
                    return;
                }
            if (c.t > 1.5 + windowTime)
                this.qteFail();
        } }
        qtePress(action) { const c = this.chase; if (this.mode !== 'chase' || !c?.prompt)
            return; if (action !== c.steps[c.index].action) {
            this.qteFail();
            return;
        } this.sound.play('clue'); c.index++; if (c.index >= c.steps.length) {
            $('chase').hidden = true;
            this.case.flags.chaseDone = true;
            this.save(false);
            this.mode = 'explore';
            this.player.z = 0;
            this.say('collector', ["You should have stayed in the market."], () => this.startBattle(false));
        }
        else
            this.beginChaseStep(); }
        qteFail() { this.case.stats.qteMisses++; $('chase').hidden = true; this.showModal('KEEP GOING', 'A short stumble', `<p>The collector is still in sight. Retry this obstacle. Your earlier progress is safe.</p><div class="modal-actions"><button class="primary" id="retry-chase">Try this obstacle again</button><button class="secondary" id="gentle-chase">Use longer prompts</button></div>`); $('modal-close').hidden = true; $('retry-chase').onclick = () => { this.closeModal(); this.beginChaseStep(); }; $('gentle-chase').onclick = () => { this.settings.assisted = true; this.save(false); this.closeModal(); this.beginChaseStep(); }; }
        chasePause() { $('chase').hidden = true; this.showModal('CHASE PAUSED', 'Catch your breath', `<p>The chase will resume at this obstacle.</p><div class="modal-actions"><button class="primary" id="resume-chase">Resume chase</button></div>`); $('resume-chase').onclick = () => { this.closeModal(); this.beginChaseStep(); }; }
        openRadio() { if (this.case.stage < 6) {
            this.say('aya', ["The radio works. We need Ken's recording before we can send the real readings."]);
            return;
        } if (this.case.stage === 7) {
            this.choose('aya', 'The north light answers whenever we call.', [{ label: 'Read the closing note', action: () => this.showEnding() }, { label: 'Keep walking', action: () => { } }]);
            return;
        } this.showModal('OLD SIGNAL STATION', 'Find his voice', `<p>The tape label reads <strong>NORTH LIGHT · 82.4 MHz</strong>. Tune the radio, then play the recording.</p><div class="radio-face"><div class="radio-freq"><span id="radio-frequency">80.0</span> <small>MHz</small></div><input id="radio-dial" type="range" min="80" max="88" step="0.2" value="80" aria-label="Radio frequency"><div class="radio-range"><span>80.0</span><span>84.0</span><span>88.0</span></div></div><p id="radio-message" class="text-small">Turn the dial. Listen for a clear channel.</p><div class="modal-actions"><button class="primary" id="play-tape">Play the tape</button><button class="secondary" id="radio-left">Tune down</button><button class="secondary" id="radio-right">Tune up</button></div>`, 'radio'); const dial = $('radio-dial'); const update = () => { $('radio-frequency').textContent = Number(dial.value).toFixed(1); $('radio-message').textContent = Math.abs(+dial.value - 82.4) < .09 ? 'A clean tone. The north light is listening.' : 'Static. The voice is somewhere else.'; }; dial.oninput = update; $('radio-left').onclick = () => { dial.value = String(Math.max(80, +dial.value - .2)); update(); }; $('radio-right').onclick = () => { dial.value = String(Math.min(88, +dial.value + .2)); update(); }; $('play-tape').onclick = () => { if (Math.abs(+dial.value - 82.4) > .09) {
            $('radio-message').textContent = 'Only static. Match the frequency printed on the tape: 82.4 MHz.';
            this.sound.play('paper');
            return;
        } this.closeModal(); this.sound.play('clue'); this.say('ken', ["Nao? I knew you would find it. I am at the north light. I am safe.", "The recording has the real depths. The new channel is too shallow. Send the tape to the coast watch."], () => this.say('aya', ["They have it. The crew will use the old channel. No one will cross that breakwater tonight."], () => this.say('ken', ["Keep a cup of tea warm for me. I will be home on the next boat."], () => { this.advance(7); this.case.flags.complete = true; this.clock.waitUntil(1140); this.note('ending', 'A signal in the dark', "Ken is safe at the north light. The coast watch has the true readings. The evening ferry will take the safe channel. The case is complete."); this.save(false); this.showCinema('CHAPTER ONE · COMPLETE', 'A signal in the dark', 'Across the bay, the north light answers.', 3.6, () => this.showEnding()); }))); }; }
        showEnding() { const s = this.case.stats, toys = this.case.inventory.filter(i => i.id.startsWith('toy-')).length; this.showModal('LOW TIDE · CHAPTER ONE COMPLETE', 'A signal in the dark', `<p>The recording is safe. The ferry has a clear route. Ken will return on the next crossing.</p><p class="ending-quote">“Keep a cup of tea warm for me.”</p><div class="ending-summary"><div><strong>${this.case.entries.length}</strong><span>Notebook entries</span></div><div><strong>${s.counters}</strong><span>Clean counters</span></div><div><strong>${toys} / 3</strong><span>Harbor toys</span></div></div><p class="text-small">${this.case.flags.catFed ? 'A small cat waits by the seawall. ' : ''}${this.case.flags.trained ? 'Imai\'s lesson stays with you. ' : ''}${this.case.flags.arcade ? 'Your Signal Catch record is ' + s.arcadeBest + '. ' : ''}The afternoon belongs to you now.</p><div class="modal-actions"><button class="primary" id="epilogue">Stay in Aonami</button><button class="secondary" id="ending-title">Return to title</button></div><div class="credits">Original story, cast, world, music, and game art.<br>Engine: my-3D2dge v0.6.0 by Michael Crosato, with Low Tide extensions.<br>Thank you for spending an afternoon here.<br><a href="../../report.html" target="_blank" rel="noopener">Design and engineering report</a></div>`); this.modalReturn = 'explore'; $('epilogue').onclick = () => { this.closeModal(); this.toast('The case is complete. The neighborhood is still here.', 'STAY A WHILE'); }; $('ending-title').onclick = () => { this.closeModal(); this.save(false); this.mode = 'title'; this.started = false; $('hud').hidden = true; $('title-screen').hidden = false; this.setTouch(false); this.updateTitle(); }; }
        status() { return { title: D.title, version: D.version, mode: this.mode, objective: D.objectives[this.case.stage], time: this.clock.format(), position: { x: Math.round(this.player.x), y: Math.round(this.player.y) }, health: Math.round(this.player.hp), money: this.case.money, stage: this.case.stage, notes: this.case.entries.map(e => ({ title: e.title, text: e.text })), inventory: this.case.inventory, work: this.work ? { loaded: this.world.crates.filter(c => c.delivered).length, carrying: this.carry } : null, complete: !!this.case.flags.complete }; }
        registerTools() { const mc = document.modelContext; if (!mc?.registerTool)
            return; const controller = new AbortController(); const register = tool => { try {
            Promise.resolve(mc.registerTool(tool, { signal: controller.signal })).catch(() => { });
        }
        catch (e) { } }; register({ name: 'read_low_tide_state', title: 'Read Low Tide progress', description: 'Read the current objective, game time, notebook, inventory, and completion state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: input => { if (!input || Object.keys(input).length)
                throw new Error('This tool takes an empty object.'); return this.status(); } }); register({ name: 'open_low_tide_notebook', title: 'Open the notebook', description: 'Open the visible notebook while the game is in exploration or work mode.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { if (!input || Object.keys(input).length)
                throw new Error('This tool takes an empty object.'); if (!['explore', 'work'].includes(this.mode))
                throw new Error('Finish the current scene before opening the notebook.'); this.openNotebook(); return { opened: true, entries: this.case.entries.length }; } }); window.addEventListener('pagehide', () => controller.abort(), { once: true }); }
    }
    new LowTide();
})();
