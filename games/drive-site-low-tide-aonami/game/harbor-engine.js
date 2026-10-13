/* Low Tide extensions for my-3D2dge 0.6.0. Original engine remains separate. */
(function (root) {
    'use strict';
    const E = root.My3D2dge;
    class DailyClock {
        constructor(minutes = 970, rate = .2) { this.minutes = minutes; this.rate = rate; }
        tick(dt) { this.minutes = Math.min(20 * 60, this.minutes + dt * this.rate); }
        waitUntil(m) { this.minutes = Math.max(this.minutes, m); }
        format() { return String(Math.floor(this.minutes / 60)).padStart(2, '0') + ':' + String(Math.floor(this.minutes % 60)).padStart(2, '0'); }
    }
    class HarborCase {
        constructor(saved) { this.stage = 0; this.flags = {}; this.money = 500; this.entries = [{ id: 'arrival', title: 'An empty sleeve', text: 'Ken called from South Quay this morning. Then the line went dead. Hana at the tea shop may have seen him.' }]; this.inventory = []; this.stats = { talks: 0, crates: 0, arcadeBest: 0, qteMisses: 0, defeats: 0, counters: 0, steps: 0, seconds: 0 }; if (saved) {
            this.stage = E.clamp(+saved.stage || 0, 0, 7);
            this.flags = { ...(saved.flags || {}) };
            this.money = Math.max(0, +saved.money || 0);
            this.entries = Array.isArray(saved.entries) ? saved.entries : this.entries;
            this.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
            this.stats = { ...this.stats, ...saved.stats };
        } }
        note(id, title, text) { if (this.entries.some(e => e.id === id))
            return false; this.entries.push({ id, title, text }); return true; }
        award(id, amount) { if (this.flags[id])
            return false; this.flags[id] = true; this.money += amount; return true; }
        spend(amount) { if (this.money < amount)
            return false; this.money -= amount; return true; }
        advance(stage) { if (stage <= this.stage)
            return false; this.stage = stage; return true; }
        addItem(id, name, description) { if (this.inventory.some(e => e.id === id))
            return false; this.inventory.push({ id, name, description }); return true; }
        export() { return { stage: this.stage, flags: this.flags, money: this.money, entries: this.entries, inventory: this.inventory, stats: this.stats }; }
    }
    class HarborSave {
        constructor(key = 'low-tide-aonami-v1') { this.key = key; this.error = null; }
        write(state) { try {
            localStorage.setItem(this.key, JSON.stringify({ version: 1, ...state }));
            this.error = null;
            return true;
        }
        catch (e) {
            this.error = 'This browser could not save the game.';
            return false;
        } }
        load() { try {
            const s = JSON.parse(localStorage.getItem(this.key));
            if (!s || s.version !== 1 || !s.case || !Number.isFinite(s.minutes))
                return null;
            return s;
        }
        catch (e) {
            return null;
        } }
        clear() { try {
            localStorage.removeItem(this.key);
            return true;
        }
        catch (e) {
            return false;
        } }
    }
    class HarborRig extends E.Humanoid {
        constructor(o = {}) { super({ build: 'heroic', weapon: null, sleeves: 'long', cheat: .12, ...o }); this.satchel = !!o.satchel; }
        draw(g, ox, oy, view) { super.draw(g, ox, oy, view); if (!this.satchel || this.downW > .65)
            return; const v = E.charView(view), project = (p) => { const w = this._w(p), q = v.p(...w); return [ox + q[0], oy + q[1]]; }; const a = project([0, -this.o.shoulderHalf, this.o.hipZ + this.o.torso - 2]), b = project([1, this.o.hipHalf + 1, this.o.hipZ + 1]); E.px.line(g, ...a, ...b, '#d4c3a2', 2); E.px.rect(g, b[0] - 3, b[1] - 1, 8, 8, '#6b7463'); E.px.rect(g, b[0] - 3, b[1] - 1, 8, 2, '#b1b198'); E.px.dot(g, b[0], b[1] + 3, '#d4c3a2'); }
    }
    class HarborSound {
        constructor(game) { this.game = game; this.enabled = true; this.started = false; this.next = 0; this.foot = 0; this.rainNode = null; }
        start() { if (this.started)
            return; this.started = true; const a = this.game.audio; a.sfxVolume = .35; a.musicVolume = .3; a.define('step', { wave: 'noise', freq: 180, dur: .035, vol: .09, filter: "lowpass" }); a.define('paper', { wave: 'noise', freq: 900, dur: .06, vol: .12 }); a.define('clue', { wave: 'sine', freq: 680, to: 920, dur: .5, vol: .15 }); a.define('crate', { wave: 'noise', freq: 120, dur: .16, vol: .18 }); a.define('bell', { wave: 'sine', freq: 880, to: 660, dur: .65, vol: .16 }); a.music({ bpm: 66, steps: 2, tracks: [{ wave: 'sine', vol: .075, notes: 'D4 - . . A4 - . . F4 - . E4 D4 - . . C4 - . . A3 - . . C4 - E4 - D4 - . . D4 - . . A4 - . . C5 - . A4 F4 - . . E4 - . . A3 - . . C4 - E4 - D4 - . .' }, { wave: 'triangle', vol: .025, notes: 'D3 - - - . . . . A2 - - - . . . . C3 - - - . . . . G2 - - - . . . .' }] }); this.set(this.enabled); }
        set(v) { this.enabled = v; this.game.audio.mute(!v); }
        play(id) { if (this.enabled && this.started)
            this.game.audio.sfx(id); }
        update(dt, moving) { this.foot -= dt; if (moving && this.foot <= 0) {
            this.play('step');
            this.foot = .3;
        } }
    }
    // Match every viewport while keeping the pixel-art buffer within a fixed cost.
    const stockResize = E.Screen.prototype.resize, stockPresent = E.Screen.prototype.present;
    E.Screen.prototype.resize = function () {
        if (!this.o.fit) return stockResize.call(this);
        const rc = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
        const pw = Math.max(1, Math.round(rc.width * dpr)), ph = Math.max(1, Math.round(rc.height * dpr));
        const budget = this.o.bufferPixels || 960 * 540;
        const unit = Math.max(dpr, Math.sqrt(pw * ph / budget), pw / 1440, ph / 1440);
        this.canvas.width = pw; this.canvas.height = ph; this.dpr = dpr; this.portrait = ph > pw;
        this.W = Math.max(16, Math.ceil(pw / unit)); this.H = Math.max(16, Math.ceil(ph / unit));
        this.S = Math.max(pw / this.W, ph / this.H);
        this.OX = (pw - this.W * this.S) / 2; this.OY = (ph - this.H * this.S) / 2;
        this.buf.width = this.W + 2; this.buf.height = this.H + 2;
        this.ctx = E.ctx2d(this.buf); this.ctx._c = null;
        for (const f of this.listeners) f();
    };
    E.Screen.prototype.present = function () {
        if (!this.o.fit) return stockPresent.call(this);
        const g = this.sctx, S = this.S; g.imageSmoothingEnabled = false;
        g.drawImage(this.buf, 0, 0, this.W + 2, this.H + 2,
            this.OX - Math.round(this.fx * S), this.OY - Math.round(this.fy * S),
            (this.W + 2) * S, (this.H + 2) * S);
    };
    // Correct the floor texture return type. Existing RGB palettes remain valid.
    const flagstone = E.tex.flagstone;
    E.tex.flagstone = function (...args) { const c = flagstone(...args); return typeof c === 'string' ? E.hex(c) : c; };
    Object.assign(E, { DailyClock, HarborCase, HarborSave, HarborRig, HarborSound });
})(typeof window !== 'undefined' ? window : globalThis);
