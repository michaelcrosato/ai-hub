/*
 * The Lion’s Oath — an unofficial tactical chronicle after Final Fantasy Tactics (PS1).
 * Game rules and campaign flow are the recovered 1.2 code. The battlefield now renders with
 * three.js r186 through the shared kit (WebGPU, WebGL2 fallback) and all input goes through
 * kit.input actions. Campaign data lives in ../data/campaign.json; the source-coverage ledger
 * in ../data/ledger.json loads only when its checklist opens.
 */
import * as THREE from 'three/webgpu';
import { uniform, varying, modelWorldMatrix, normalLocal, normalize, dot, mix, vec3, vec4 } from 'three/tsl';
import { boot as bootKit } from 'kit/boot.js';

// The original drew stored colours straight to the screen (no sRGB conversion). Keep that look.
THREE.ColorManagement.enabled = false;
/** Campaign data, loaded before anything below runs. */
let DB = null;
const clone = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const hash = (s) => {
    let x = 2166136261;
    for (const c of s)
        x = Math.imul(x ^ c.charCodeAt(0), 16777619);
    return x >>> 0;
};
class RNG {
    constructor(s) { this.state = s || 90210; }
    next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 4294967296; }
    int(n) { return Math.floor(this.next() * n); }
    pick(xs) { return xs[this.int(xs.length)]; }
}
const POSITIVE = ['Protect', 'Shell', 'Haste', 'Regen', 'Reraise', 'Float', 'Reflect', 'Transparent', 'Faith'];
const NEGATIVE = ['Poison', 'Dark', 'Silence', 'Frog', 'Petrify', 'Sleep', 'Confuse', 'Berserk', 'Charm', 'Slow', 'Stop', 'Dont Move', 'Dont Act', 'Doom', 'Undead', 'Blood Suck', 'Oil', 'Innocent'];
const DIRECTIONS = [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }];
const JOB_THRESH = [0, 0, 100, 250, 500, 800, 1200, 1800, 2500];
/** Proving Ring medals: at or under par is gold, up to six turns over is silver. */
function arenaMedal(par, turns) { return turns <= par ? 'Gold' : turns <= par + 6 ? 'Silver' : 'Bronze'; }
function jobLevel(u, j) {
    const jp = u.totalJP?.[j] || 0;
    let lv = 1;
    for (let i = 2; i <= 8; i++)
        if (jp >= JOB_THRESH[i])
            lv = i;
    return lv;
}
function unlocked(u, j) {
    if (isMonster(u) || u.job === 'Steel Giant' || u.job === 'Byblos')
        return j === u.job;
    const d = DB.jobs[j];
    if (!d)
        return false;
    if (d.special)
        return u.native === j;
    return (!d.sex || u.sex === d.sex) && Object.entries(d.req).every(([name, lv]) => jobLevel(u, name) >= lv);
}
function item(n) { return DB.items[n] || {}; }
function isMonster(u) { return !!DB.monsters[u.job]; }
function has(u, s) { return !!u.status?.[s]; }
function passive(u, s) { return u.support === s || u.reaction === s || u.movement === s || (u.job === 'Ninja' && s === 'Two Swords') || (u.job === 'Monk' && s === 'Martial Arts') || (u.job === 'Dragoner' && ['Two Swords', 'Train', 'Monster Skill'].includes(s)) || (u.job === 'Byblos' && s === 'Secret Hunt'); }
function isActive(u) { return u.hp > 0 && !u.removed && !has(u, 'Petrify'); }
function team(u) { return has(u, 'Charm') || has(u, 'Blood Suck') ? 1 - u.team : u.team; }
function equipValues(u, key) { return Object.values(u.equip || {}).map(n => item(n)[key]).filter(v => v !== undefined); }
function equipHas(u, key, value) { return equipValues(u, key).some(v => String(v).split('/').some(x => x === value || x === 'all')); }
function stats(u) {
    const j = DB.jobs[u.job] || DB.jobs.Squire, eq = Object.values(u.equip || {}).map(n => item(n)), mod = u.mod || {};
    const sum = (key) => eq.reduce((s, e) => s + (typeof e[key] === 'number' ? e[key] : 0), 0);
    let hp = Math.floor((64 + u.level * 8) * j.hp) + sum('hp'), mp = Math.floor((12 + u.level * 3) * (j.ma || .4)) + sum('mp');
    if (u.hpOverride)
        hp = u.hpOverride;
    if (u.mult)
        hp = Math.floor(hp * u.mult);
    let pa = Math.max(1, Math.floor((5 + u.level * .57) * j.pa) + sum('pa') + (mod.pa || 0));
    let ma = Math.max(1, Math.floor((5 + u.level * .6) * j.ma) + sum('ma') + (mod.ma || 0));
    let speed = Math.max(1, Math.round((6 + Math.floor(u.level / 15)) * j.spd) + sum('speed') + (mod.speed || 0));
    if (has(u, 'Haste'))
        speed = Math.ceil(speed * 1.5);
    if (has(u, 'Slow'))
        speed = Math.max(1, Math.floor(speed * .5));
    if (has(u, 'Stop') || has(u, 'Petrify'))
        speed = 0;
    let move = j.move + sum('move'), jump = j.jump + sum('jump');
    for (let i = 1; i <= 3; i++) {
        if (passive(u, 'Move +' + i))
            move += i;
        if (passive(u, 'Jump +' + i))
            jump += i;
    }
    if (has(u, 'Dont Move'))
        move = 0;
    if (has(u, 'Frog')) {
        pa = 1;
        ma = 1;
        jump = 2;
    }
    if (u.brave < 10)
        move = Math.max(move, 5);
    return { hp, mp, pa, ma, speed, move, jump };
}
function canEquip(u, n, slot) {
    const a = item(n);
    if (!a.name || u.job === 'Mime' || isMonster(u) || u.job === 'Steel Giant')
        return false;
    if (a.slot === 'item')
        return false;
    if (slot === 'shield' && a.slot === 'weapon')
        return passive(u, 'Two Swords') && (DB.jobs[u.job].weapons.includes(a.type) || passive(u, 'Equip ' + a.type));
    if (slot && a.slot !== slot)
        return false;
    const armored = ['Knight', 'Lancer', 'Samurai', 'Holy Knight', 'Holy Swordsman', 'Divine Knight', 'Temple Knight', 'Dark Knight'];
    if (a.type === 'Ribbon' || a.type === 'Perfume' || a.type === 'Bag')
        return u.sex === 'F';
    if (a.slot === 'weapon')
        return DB.jobs[u.job].weapons.includes(a.type) || passive(u, 'Equip ' + a.type) || (a.type === 'Knife' && DB.jobs[u.job].weapons.includes('Knife'));
    if (a.type === 'Shield')
        return ['Knight', 'Archer', 'Geomancer', 'Lancer', ...armored].includes(u.job) || passive(u, 'Equip Shield');
    if (['Armor', 'Helmet'].includes(a.type))
        return armored.includes(u.job) || passive(u, 'Equip Armor');
    if (a.type === 'Robe')
        return !['Archer', 'Thief', 'Ninja', 'Bard', 'Dancer'].includes(u.job);
    if (a.type === 'Hat')
        return !armored.includes(u.job) && u.job !== 'Monk';
    if (a.type === 'Clothes')
        return !armored.includes(u.job);
    return true;
}
function affordableGear(job, sex, level, slot) {
    let u = { job, sex }, tier = clamp(1 + Math.floor(level / 12), 1, 4);
    const pool = Object.values(DB.items).filter((a) => a.slot === slot && !a.rare && a.tier <= tier && canEquip(u, a.name));
    pool.sort((a, b) => (a.power || a.hp || a.evade || a.move || 0) - (b.power || b.hp || b.evade || b.move || 0));
    return pool[Math.max(0, Math.floor(pool.length * .55) - 1)]?.name || null;
}
function makeUnit(name, job, level = 1, side = 0, seed = 1) {
    const c = DB.characters[name] || {}, j = DB.jobs[job] || DB.jobs.Squire, r = new RNG(seed + hash(name));
    const u = { id: 'u' + hash(name + ':' + seed + ':' + side), name, job, native: j.special ? job : null, level, sex: c.sex || r.pick(['M', 'F']), brave: 70, faith: job === 'Steel Giant' ? 0 : 70, sign: r.int(12), team: side, guest: false, unique: !!DB.characters[name], hp: 1, mp: 1, ct: 0, x: 0, z: 0, dir: side ? 2 : 0, exp: 0, jp: {}, totalJP: {}, learned: [], secondary: 'Chemist', reaction: null, support: null, movement: null, equip: {}, status: {}, mod: {}, moved: false, acted: false, down: 3, removed: false };
    u.hpOverride = c.hp;
    u.mult = c.mult;
    u.color = c.color || j.color;
    u.reviveOnce = c.reviveOnce;
    if (!isMonster(u) && job !== 'Steel Giant' && job !== 'Mime')
        for (const slot of ['weapon', 'head', 'body', 'shield']) {
            const n = c[slot] || affordableGear(job, u.sex, level, slot);
            if (n)
                u.equip[slot] = n;
        }
    if (c.accessory)
        u.equip.accessory = c.accessory;
    if (job === 'Squire')
        u.equip.weapon = 'Broad Sword';
    const defaults = ['Potion', 'Phoenix Down', 'Antidote', 'Heal', 'Accumulate', 'Throw Stone'];
    u.learned = [...new Set([...defaults, ...j.skills.filter((s) => DB.skills[s]?.kind !== 'passive').filter((n) => !side || j.special || DB.skills[n].cost <= 80 + level * 25).slice(0, side || j.special ? 99 : 3), ...(c.extra || [])])];
    u.extra = c.extra || [];
    for (const [n, lv] of Object.entries(j.req)) {
        u.totalJP[n] = JOB_THRESH[lv];
        u.jp[n] = 120;
    }
    u.jp[job] = 150;
    u.totalJP[job] = side ? 1000 : 0;
    u.totalJP.Chemist = Math.max(u.totalJP.Chemist || 0, 100);
    u.totalJP.Squire = Math.max(u.totalJP.Squire || 0, 100);
    if (side) {
        u.learned = [...new Set([...u.learned, ...j.skills.filter((s) => DB.skills[s]?.kind !== 'passive' && (j.special || DB.skills[s].cost <= 80 + level * 25))])];
        u.secondary = ['Wizard', 'Priest', 'Chemist'].includes(job) ? 'Priest' : 'Chemist';
        u.learned.push('Cure', 'Raise');
    }
    if (job === 'Monk')
        u.reaction = 'Counter';
    if (job === 'Samurai')
        u.reaction = 'Blade Grasp';
    if (name === 'Orlandu')
        u.support = 'Attack Up';
    for (const s of equipValues(u, 'auto').flatMap(v => String(v).split('/')))
        u.status[s] = 9999;
    if (DB.monsters[job]?.traits.includes('undead'))
        u.status.Undead = 9999;
    const st = stats(u);
    u.hp = st.hp;
    u.mp = st.mp;
    return u;
}
function generateMap(m) {
    const r = new RNG(hash(m.id + ':' + m.name)), w = m.solo ? 9 : 12 + (hash(m.id) % 2), h = m.solo ? 9 : 11;
    const tiles = [], props = [];
    const theme = m.theme;
    const snow = theme.includes('snow'), desert = theme.includes('desert'), inside = ['hall', 'chapel', 'library', 'crypt', 'demonHall', 'dungeon', 'angel', 'airship', 'machine'].includes(theme);
    for (let z = 0; z < h; z++)
        for (let x = 0; x < w; x++) {
            let ht = 0, t = inside ? 'stone' : snow ? 'snow' : desert ? 'sand' : 'grass';
            if (['hills', 'mountain', 'valley', 'plains', 'forest', 'snowForest', 'windmill', 'desert', 'desertFort', 'volcano'].includes(theme))
                ht = Math.max(0, Math.round(1.5 * Math.sin((x + (hash(m.id) % 7)) * .48) + 1.2 * Math.cos(z * .7)));
            if (['town', 'rainTown', 'fort', 'snowFort', 'desertFort', 'abbey', 'castleGate', 'gallows', 'palace', 'ruins', 'sluice'].includes(theme)) {
                t = snow ? 'snow' : 'stone';
                ht = z < 3 ? 1 : 0;
            }
            if (inside)
                ht = z < 3 ? 1 : 0;
            if (theme === 'mountain')
                ht = Math.max(0, 4 - Math.floor(Math.abs(x - w / 2) * .7 + Math.abs(z - 5) * .45));
            if (theme === 'roof') {
                ht = 2 + Math.max(0, 2 - Math.abs(z - 5));
                t = 'roof';
            }
            if (['river', 'falls', 'lake', 'swamp', 'sluice'].includes(theme)) {
                const stream = theme === 'swamp' ? ((x + z) % 4 < 2) : theme === 'lake' ? (x > 3 && x < w - 3 && z > 2 && z < h - 2) : (x >= Math.floor(w / 2) - 1 && x <= Math.floor(w / 2) + 1);
                if (stream) {
                    t = theme === 'swamp' ? 'swamp' : 'water';
                    ht = -.4;
                }
                else
                    ht = theme === 'falls' ? Math.max(0, 3 - Math.floor(z / 3)) : 0;
                if (theme !== 'swamp' && theme !== 'lake' && (z === 5 || z === 6)) {
                    t = 'wood';
                    ht = theme === 'falls' ? 2 : 1;
                }
            }
            if (theme === 'volcano' && ((x + z * 2) % 9 === 0 || x === 0)) {
                t = 'lava';
                ht = -.2;
            }
            if (theme === 'library') {
                t = (x >= 4 && x <= 7) ? 'carpet' : 'brick';
            }
            if (['chapel', 'hall', 'demonHall'].includes(theme) && x >= 4 && x <= 7)
                t = 'carpet';
            if (theme === 'mine') {
                t = 'soil';
                ht = (x < 3 || x > w - 4) ? 2 : 0;
            }
            if (theme === 'dungeon') {
                ht = ((Math.floor(x / 3) + Math.floor(z / 3) + hash(m.id)) % 3);
                t = (x + z) % 3 ? 'brick' : 'stone';
            }
            if (theme === 'airship' || theme === 'angel') {
                t = (x < 2 || x > w - 3) ? 'stone' : 'wood';
                ht = (z < 3 ? 2 : 1);
            }
            if (theme === 'arena') {
                // A sand pit ringed by a low stone wall, a raised dais in the middle and the stands to the north.
                const ring = x === 0 || x === w - 1 || z === 0;
                t = ring ? 'stone' : 'sand';
                ht = z === 0 ? 2 : ring ? 1 : (Math.abs(x - (w - 1) / 2) <= 1 && (z === 4 || z === 5)) ? 1 : 0;
                if (!ring && ht)
                    t = 'stone';
            }
            tiles.push({ x, z, h: ht, t, block: false });
        }
    const at = (x, z) => tiles[z * w + x];
    const structure = (kind, x, z, sx = 1, sz = 1, extra = {}) => {
        const heights = [];
        for (let dz = 0; dz < sz; dz++)
            for (let dx = 0; dx < sx; dx++) {
                const a = at(x + dx, z + dz);
                if (a) {
                    a.block = true;
                    heights.push(a.h);
                }
            }
        props.push({ kind, x: x + (sx - 1) / 2, z: z + (sz - 1) / 2, h: Math.max(...heights), sx, sz, ...extra });
    };
    if (['town', 'rainTown', 'palace', 'gallows'].includes(theme)) {
        structure('house', 0, 0, 3, 3, { roof: '#80605c' });
        structure('house', w - 3, 1, 3, 3, { roof: '#667b7f' });
        structure('house', 0, 5, 2, 3, { roof: '#817159' });
        structure('house', w - 2, 7, 2, 3, { roof: '#6c727d' });
        props.push({ kind: 'well', x: Math.floor(w / 2) + 2, z: 5, h: at(Math.floor(w / 2) + 2, 5).h });
        at(Math.floor(w / 2) + 2, 5).block = true;
    }
    if (['fort', 'snowFort', 'desertFort', 'castleGate', 'abbey', 'ruins', 'sluice'].includes(theme)) {
        for (let x = 0; x < w; x++)
            if (x < 4 || x > 7) {
                at(x, 2).h = 3;
                at(x, 2).t = 'brick';
                if (x % 3 === 0)
                    props.push({ kind: 'battlement', x, z: 2, h: 3 });
            }
        structure('tower', 0, 0, 2, 2);
        structure('tower', w - 2, 0, 2, 2);
        if (theme === 'abbey')
            structure('chapel', 0, 3, 3, 4);
        if (theme === 'ruins')
            for (const [x, z] of [[3, 4], [8, 5], [2, 7], [10, 7]])
                props.push({ kind: 'column', x, z, h: at(x, z).h });
        if (theme === 'sluice') {
            for (const [x, z] of [[2, 2], [w - 3, 2]]) {
                at(x, z).feature = 'switch';
                at(x, z).h = 3;
            }
        }
    }
    if (theme === 'castleGate' && m.gate) {
        for (let x = 0; x < w; x++) {
            at(x, 4).h = 3;
            at(x, 4).block = true;
        }
        at(6, 4).feature = 'gate';
        at(6, 3).feature = 'lever';
        at(6, 3).block = false;
        props.push({ kind: 'gate', x: 6, z: 4, h: 0 });
    }
    if (theme === 'forest' || theme === 'snowForest')
        for (const [x, z] of [[0, 1], [1, 2], [w - 1, 1], [w - 2, 4], [0, 6], [w - 1, 8], [3, 0], [8, 0]])
            structure('tree', x, z, 1, 1, { snow });
    if (['plains', 'hills', 'valley', 'mountain', 'desert', 'volcano'].includes(theme))
        for (let i = 0; i < 7; i++) {
            const x = r.pick([0, 1, w - 2, w - 1]), z = r.int(h - 2);
            if (!at(x, z).block)
                structure(desert ? 'rock' : 'tree', x, z, 1, 1);
        }
    if (theme === 'windmill')
        structure('windmill', 0, 0, 3, 3);
    if (theme === 'library') {
        for (let z = 0; z < 7; z += 3)
            for (const x of [0, 1, w - 2, w - 1])
                structure('bookshelf', x, z, 1, 2);
    }
    if (['hall', 'chapel', 'crypt', 'demonHall'].includes(theme)) {
        for (const [x, z] of [[1, 1], [w - 2, 1], [1, 5], [w - 2, 5]])
            structure('column', x, z);
        structure(theme === 'crypt' ? 'tomb' : 'altar', 5, 0, 2, 1);
    }
    if (theme === 'machine' || theme === 'airship' || theme === 'angel')
        for (const [x, z] of [[0, 0], [w - 2, 1], [0, 4], [w - 1, 5]])
            structure('machine', x, z);
    if (theme === 'gallows')
        structure('gallows', 7, 0, 3, 2);
    if (theme === 'mine')
        for (const x of [1, w - 2])
            for (const z of [1, 4, 7])
                structure('minepost', x, z);
    if (theme === 'dungeon')
        for (const [x, z] of [[0, 0], [w - 1, 0], [0, 4], [w - 1, 7]])
            structure('column', x, z);
    if (theme === 'arena') {
        structure('stands', 0, 0, w, 1);
        structure('brazier', 1, 1);
        structure('brazier', w - 2, 1);
        for (const z of [3, 6]) {
            structure('banner', 0, z);
            structure('banner', w - 1, z);
        }
    }
    for (const a of tiles)
        if (a.z >= h - 3 && a.x >= 2 && a.x < w - 2) {
            a.block = false;
            if (a.t === 'water' || a.t === 'lava') {
                a.t = 'stone';
                a.h = 0;
            }
        }
    if (m.solo) {
        for (const a of tiles)
            a.block = false;
    }
    if (m.treasures) {
        const available = tiles.filter(a => !a.block && a.z < 5 && a.x > 1 && a.x < w - 2);
        m.treasures.forEach((n, i) => { const a = available[(hash(m.id) + i * 13) % available.length]; a.treasure = n; });
    }
    if (m.id === 'blade') {
        const a = tiles.filter(a => !a.block).sort((a, b) => b.h - a.h)[0];
        a.treasure = 'Materia Blade';
        a.feature = 'relic';
    }
    if (m.objective === 'exit') {
        const possible = tiles.filter(a => !a.block && a.z < 3);
        r.pick(possible).feature = 'exit';
    }
    return { w, h, tiles, props };
}
class GameModel {
    constructor(s) {
        this.battle = null;
        this.options = { reduceMotion: false, volume: .45, muted: false, speed: 1, quality: 'high', difficulty: 'standard', permadeath: false, music: true, showGrid: true };
        this.state = s || this.fresh();
    }
    fresh() { const roster = [makeUnit('Ramza', 'Squire', 1, 0, 1), makeUnit('Helene', 'Knight', 1, 0, 2), makeUnit('Alden', 'Archer', 1, 0, 3), makeUnit('Mira', 'Chemist', 1, 0, 4), makeUnit('Liora', 'Wizard', 1, 0, 5), makeUnit('Beren', 'Squire', 1, 0, 6)]; roster[4].unique = false; roster[4].native = null; roster[4].learned.push('Cure'); roster[4].secondary = 'Priest'; return { version: 1, next: 0, day: 1, gil: 2500, roster, party: roster.slice(0, 5).map(u => u.id), inventory: { 'Potion': 18, 'Phoenix Down': 8, 'Antidote': 8, 'Ether': 6, 'Broad Sword': 2, 'Oak Staff': 1, 'Battle Boots': 1 }, completed: [], visited: ['Gariland'], place: 'Gariland', flags: {}, dispatch: [], doneProps: [], eggs: [], poach: {}, discoveries: [], history: [], stats: { wins: 0, kills: 0, casts: 0, rescues: 0 }, uid: 100, ended: false }; }
    chapter() { return DB.missions[Math.min(this.state.next, DB.missions.length - 1)].chapter || 1; }
    roster(id) { return this.state.roster.find((u) => u.id === id); }
    mission(id) { return [...DB.missions, ...DB.sideMissions].find((m) => m.id === id); }
    begin(m) { this.battle = new Battle(this, m); return this.battle; }
    addItem(n, num = 1) {
        if (!DB.items[n])
            return;
        this.state.inventory[n] = (this.state.inventory[n] || 0) + num;
    }
    addUnit(n, job) {
        var _a;
        if (this.state.roster.length >= 40) {
            (_a = this.state).pendingRecruits ?? (_a.pendingRecruits = []);
            if (!this.state.pendingRecruits.some((r) => r.name === n) && !this.state.roster.some((u) => u.name === n))
                this.state.pendingRecruits.push({ name: n, job: job || DB.characters[n]?.job || 'Squire' });
            this.state.history.push(n + ' waits for a place in the company.');
            return;
        }
        if (this.state.roster.some((u) => u.name === n))
            return;
        const lv = Math.max(1, ...this.state.roster.filter((u) => !u.dead).map((u) => u.level));
        const u = makeUnit(n, job || DB.characters[n]?.job || 'Squire', lv, 0, ++this.state.uid);
        this.state.roster.push(u);
        this.state.history.push(n + ' joined the company.');
        return u;
    }
    changeJob(id, j) {
        var _a, _b;
        const u = this.roster(id);
        if (!u || u.away || u.dead || !unlocked(u, j))
            return false;
        u.job = j;
        (_a = u.jp)[j] ?? (_a[j] = 0);
        (_b = u.totalJP)[j] ?? (_b[j] = 0);
        u.color = DB.jobs[j].color;
        for (const sl of Object.keys(u.equip))
            if (!canEquip(u, u.equip[sl], sl)) {
                this.addItem(u.equip[sl]);
                delete u.equip[sl];
            }
        if (!u.equip.weapon) {
            const n = Object.keys(this.state.inventory).find(n => this.state.inventory[n] > 0 && item(n).slot === 'weapon' && canEquip(u, n));
            if (n)
                this.equip(id, n, 'weapon');
        }
        u.hp = stats(u).hp;
        u.mp = stats(u).mp;
        return true;
    }
    equip(id, n, slot) {
        const u = this.roster(id), sl = slot || item(n).slot;
        if (!u || u.away || u.dead || !canEquip(u, n, sl) || (this.state.inventory[n] || 0) <= 0)
            return false;
        if (u.equip[sl])
            this.addItem(u.equip[sl]);
        this.state.inventory[n]--;
        u.equip[sl] = n;
        return true;
    }
    unequip(id, slot) {
        const u = this.roster(id);
        if (!u || u.away || u.dead || !u.equip[slot])
            return false;
        this.addItem(u.equip[slot]);
        delete u.equip[slot];
        return true;
    }
    learn(id, n) {
        const u = this.roster(id), a = DB.skills[n];
        if (!a || !u || u.away || u.dead || isMonster(u) || u.job === 'Steel Giant' || u.learned.includes(n))
            return false;
        const j = a.job === 'Ramza' ? 'Squire' : a.job;
        if ((u.jp[j] || 0) < a.cost || a.learnOnly || (!unlocked(u, j) && j !== u.native))
            return false;
        u.jp[j] -= a.cost;
        u.learned.push(n);
        return true;
    }
    buy(n, qty = 1, poach = false) {
        const a = item(n), price = poach ? Math.max(100, Math.round(a.price * .5)) : a.price;
        if (!a.name || !Number.isInteger(qty) || qty < 1 || qty > 9999 || this.state.gil < price * qty || (!poach && (a.rare || a.tier > this.chapter() || a.price <= 0)) || (poach && (this.state.poach[n] || 0) < qty))
            return false;
        this.state.gil -= price * qty;
        this.addItem(n, qty);
        if (poach)
            this.state.poach[n] -= qty;
        return true;
    }
    sell(n) {
        if ((this.state.inventory[n] || 0) < 1)
            return false;
        this.state.inventory[n]--;
        this.state.gil += Math.max(1, Math.floor(item(n).price * .5));
        return true;
    }
    hire(name, sex = 'F') {
        name = String(name || ('Recruit ' + (this.state.uid + 1))).trim().slice(0, 24);
        if (!name || !['M', 'F'].includes(sex) || Object.keys(DB.characters).some(n => n.toLowerCase() === name.toLowerCase()) || this.state.roster.some((u) => u.name.toLowerCase() === name.toLowerCase()) || this.state.gil < 500 || this.state.roster.length + this.state.eggs.filter((e) => !e.hatched).length >= 40)
            return false;
        this.state.gil -= 500;
        const u = makeUnit(name, 'Squire', Math.max(1, this.chapter() * 3 - 2), 0, ++this.state.uid);
        u.sex = sex;
        u.unique = false;
        u.native = null;
        this.state.roster.push(u);
        return true;
    }
    dismiss(id) {
        const u = this.roster(id);
        if (!u || u.unique || u.away || u.name === 'Ramza' || this.state.eggs.some((e) => !e.hatched && e.parent === id))
            return false;
        for (const n of Object.values(u.equip))
            this.addItem(n);
        this.state.party = this.state.party.filter((x) => x !== id);
        this.state.roster = this.state.roster.filter((r) => r.id !== id);
        this.state.history.push(u.name + ' left the company. Equipment returned.');
        const waiting = (this.state.pendingRecruits || []).shift();
        if (waiting)
            this.addUnit(waiting.name, waiting.job);
        this.advanceDays(0);
        return true;
    }
    setLoadout(id, slot, value) {
        const u = this.roster(id);
        if (!u || u.dead || u.away || isMonster(u) || u.job === 'Steel Giant' || !['secondary', 'reaction', 'support', 'movement'].includes(slot))
            return false;
        if (value && (slot === 'secondary' ? !DB.jobs[value] || DB.jobs[value].special && value !== u.native || !u.learned.some((n) => DB.skills[n]?.job === value && DB.skills[n].kind !== 'passive') : !u.learned.includes(value) || DB.skills[value]?.passive !== slot))
            return false;
        u[slot] = value || null;
        for (const sl of Object.keys(u.equip))
            if (!canEquip(u, u.equip[sl], sl)) {
                this.addItem(u.equip[sl]);
                delete u.equip[sl];
            }
        u.hp = Math.min(u.hp, stats(u).hp);
        u.mp = Math.min(u.mp, stats(u).mp);
        return true;
    }
    advanceDays(n) {
        if (!Number.isInteger(n) || n < 0 || n > 10000)
            return false;
        this.state.day += n;
        for (const e of this.state.eggs.filter((e) => e.day <= this.state.day && !e.hatched)) {
            if (this.state.roster.length >= 40)
                continue;
            const u = this.addUnit(e.name, e.job);
            e.hatched = !!u;
            if (u) {
                u.unique = false;
                u.native = null;
                this.state.history.push('An egg hatched: ' + e.job + '.');
            }
        }
    }
    breed(id) {
        const u = this.roster(id), m = u && DB.monsters[u.job];
        if (!m || u.away || u.dead || !m.poach?.length || this.state.roster.length + this.state.eggs.filter((e) => !e.hatched).length >= 40)
            return false;
        if (this.state.gil < 200 || this.state.eggs.some((e) => !e.hatched && e.parent === id))
            return false;
        this.state.gil -= 200;
        const family = Object.values(DB.monsters).filter((x) => x.family === m.family && x.poach.length), r = new RNG(hash('egg' + this.state.day + id + this.state.uid));
        const child = r.pick(family);
        const num = ++this.state.uid;
        this.state.eggs.push({ job: child.name, name: child.name + ' ' + num, day: this.state.day + 5, parent: id, hatched: false });
        return true;
    }
    sendProposition(pid, ids) {
        const p = DB.propositions.find((p) => p.id === pid);
        if (!p || p.chapter > this.chapter() || p.late && this.state.next < 50 || ids.length !== 3 || new Set(ids).size !== 3 || this.state.gil < p.cost || this.state.doneProps.includes(pid) || this.state.dispatch.some((d) => d.pid === pid))
            return false;
        const us = ids.map(id => this.roster(id));
        if (us.some(u => !u || u.unique || u.away || u.dead))
            return false;
        this.state.gil -= p.cost;
        for (const u of us)
            u.away = true;
        this.state.party = this.state.party.filter((id) => !ids.includes(id));
        this.state.dispatch.push({ pid, ids, returnDay: this.state.day + p.days, bonus: us.some(u => u.job === p.job) ? 1.5 : 1 });
        return true;
    }
    claimProposition(pid) {
        const d = this.state.dispatch.find((d) => d.pid === pid), p = DB.propositions.find((p) => p.id === pid);
        if (!d || d.returnDay > this.state.day)
            return null;
        const reward = Math.floor((p.cost + 900 + this.chapter() * 600) * d.bonus), jp = Math.floor(180 * d.bonus);
        this.state.gil += reward;
        for (const id of d.ids) {
            const u = this.roster(id);
            if (u) {
                u.away = false;
                u.jp[u.job] = (u.jp[u.job] || 0) + jp;
                u.totalJP[u.job] = (u.totalJP[u.job] || 0) + jp;
            }
        }
        this.state.doneProps.push(pid);
        this.state.dispatch = this.state.dispatch.filter((x) => x !== d);
        if (p.reward !== 'gil')
            this.state.discoveries.push({ name: p.name, kind: p.reward });
        return { reward, jp, name: p.name };
    }
    finishBattle() {
        const b = this.battle;
        if (!b || b.phase !== 'won' || b.paid)
            return null;
        b.paid = true;
        const m = b.mission, g = this.state;
        g.inventory = clone(b.inventory);
        g.gil += b.gil;
        for (const bu of b.units.filter(u => u.team === 0 && !u.guest)) {
            const u = this.roster(bu.originId || bu.id);
            if (!u) {
                if (bu.recruited && g.roster.length < 40 && !(bu.removed && this.options.permadeath)) {
                    bu.unique = false;
                    bu.native = null;
                    bu.hp = stats(bu).hp;
                    bu.status = {};
                    g.roster.push(clone(bu));
                }
                continue;
            }
            if (m.id === 'm0')
                continue;
            for (const key of ['level', 'exp', 'jp', 'totalJP', 'learned', 'equip', 'brave', 'faith'])
                u[key] = clone(bu[key]);
            const st = stats(u);
            u.hp = st.hp;
            u.mp = st.mp;
            u.status = {};
            if (bu.removed && this.options.permadeath && !u.unique && u.name !== 'Ramza')
                u.dead = true;
        }
        const reward = 500 + m.level * 130, winJP = 110 + this.chapter() * 20;
        g.gil += reward;
        g.stats.wins++;
        // Victory JP and EXP go to the company members who fought (the opening battle still trains the whole party).
        const fought = new Set(b.units.filter(u => u.team === 0 && !u.guest).map(u => u.originId || u.id));
        for (const u of g.roster.filter((u) => (m.id === 'm0' ? g.party.includes(u.id) : fought.has(u.id)) && !u.dead)) {
            u.jp[u.job] = (u.jp[u.job] || 0) + winJP;
            u.totalJP[u.job] = (u.totalJP[u.job] || 0) + winJP;
            u.exp += 40;
            while (u.exp >= 100) {
                u.exp -= 100;
                u.level = Math.min(99, u.level + 1);
            }
        }
        for (const [n, v] of Object.entries(b.poach))
            g.poach[n] = (g.poach[n] || 0) + v;
        for (const n of m.join || []) {
            if (n === 'Reis') {
                g.roster = g.roster.filter((u) => u.name !== 'Reis Dragon');
                g.party = g.party.filter((id) => g.roster.some((u) => u.id === id));
            }
            if (n === 'Byblos' && !b.units.some(u => u.name === 'Byblos' && isActive(u)))
                continue;
            this.addUnit(n);
        }
        let arena = null;
        if (m.arena) {
            const key = 'arena:' + m.id, turns = b.playerTurns || 0, prev = Number(g.flags[key]) || 0;
            arena = { turns, par: m.par, medal: arenaMedal(m.par, turns), best: prev ? Math.min(prev, turns) : turns, newBest: !prev || turns < prev, first: !g.completed.includes(m.id), reward: null, goldGil: 0 };
            g.flags[key] = arena.best;
            if (arena.first && m.reward && DB.items[m.reward[0]]) {
                this.addItem(m.reward[0], m.reward[1] || 1);
                arena.reward = m.reward;
            }
            if (arena.medal === 'Gold' && m.goldGil && !g.flags['arenaGold:' + m.id]) {
                g.flags['arenaGold:' + m.id] = true;
                g.gil += m.goldGil;
                arena.goldGil = m.goldGil;
            }
            g.history.push(m.name + ' — ' + arena.medal.toLowerCase() + ' medal in ' + turns + ' turns.');
        }
        if (!g.completed.includes(m.id))
            g.completed.push(m.id);
        if (/^m\d+$/.test(m.id) && Number(m.id.slice(1)) === g.next)
            g.next = Math.min(DB.missions.length, g.next + 1);
        if (m.ending)
            g.ended = true;
        if (m.id === 'c3')
            g.flags.colliery = true;
        if (m.id === 'nel')
            g.flags.nelveska = true;
        if (m.id === 'cloud')
            g.flags.cloud = true;
        this.advanceDays(3);
        g.place = m.area;
        g.visited = [...new Set([...g.visited, m.area])];
        g.history.push(m.name + ' — victory.');
        this.addItem('Potion', 3);
        this.addItem('Phoenix Down', 1);
        this.battle = null;
        return { gil: reward + b.gil, jp: winJP, loot: b.treasuresFound, joined: m.join || [], mission: m, arena };
    }
    serialize() { return { state: this.state, options: this.options, battle: this.battle?.serialize() || null }; }
    static restore(d) {
        var _a;
        validateSavedState(d);
        const g = new GameModel(clone(d.state));
        g.options = normalizeOptions(d.options);
        (_a = g.state).pendingRecruits ?? (_a.pendingRecruits = []);
        if (d.battle)
            g.battle = Battle.restore(g, clone(d.battle));
        return g;
    }
}
class Battle {
    constructor(game, mission) {
        this.units = [];
        this.poach = {};
        this.gil = 0;
        this.clock = 0;
        this.casts = [];
        this.phase = 'deploy';
        this.activeId = '';
        this.events = [];
        this.log = [];
        this.switches = [];
        this.exitFound = false;
        this.treasuresFound = [];
        this.groundLoot = [];
        this.paid = false;
        this.pendingLoot = null;
        this.turn = 0;
        this.playerTurns = 0;
        this.game = game;
        this.mission = clone(mission);
        this.rng = new RNG(hash(mission.id + ':' + game.state.day));
        const map = generateMap(mission);
        this.w = map.w;
        this.h = map.h;
        this.tiles = map.tiles;
        this.props = map.props;
        this.inventory = clone(game.state.inventory);
        let friends = game.state.party.map((id) => game.roster(id)).filter((u) => u && !u.dead && !u.away).slice(0, 5);
        const ramza = game.state.roster.find((u) => u.name === 'Ramza');
        if (!friends.some((u) => u.name === 'Ramza'))
            friends.unshift(ramza);
        friends = friends.slice(0, 5);
        if (mission.solo || mission.ramzaOnly)
            friends = [ramza];
        if (mission.id === 'm0') {
            friends = [makeUnit('Ramza', 'Squire', 8, 0, 900)];
            friends[0].learned.push('Yell');
        }
        for (const raw of friends) {
            const u = clone(raw);
            u.originId = raw.id;
            u.status = {};
            u.mod = {};
            u.moved = false;
            u.acted = false;
            u.removed = false;
            u.down = 3;
            u.ct = this.rng.int(35);
            u.guest = false;
            u.team = 0;
            this.prepare(u);
            this.units.push(u);
        }
        const lv = mission.id === 'm0' ? 8 : mission.level;
        for (const name of mission.guests || []) {
            if (this.units.some(u => u.name === name))
                continue;
            const job = mission.guestJobs?.[name] || ((name === 'Delita' && mission.chapter === 1) ? 'Squire' : DB.characters[name]?.job || 'Knight');
            const u = makeUnit(name, job, Math.max(1, lv), 0, this.rng.int(999999));
            u.guest = true;
            u.protected = mission.objective === 'protect:' + name;
            u.extra = DB.characters[name]?.extra || [];
            if (mission.guestUnarmed && name === 'Mustadio')
                u.equip = {};
            this.prepare(u);
            this.units.push(u);
        }
        const es = [];
        for (const e of (mission.enemies || '').split(',')) {
            if (!e)
                continue;
            const [name, n] = e.split(':');
            for (let i = 0; i < Number(n); i++)
                es.push(name);
        }
        for (let i = 0; i < es.length; i++) {
            const name = es[i], u = makeUnit(name + ' ' + (i + 1), name, lv, 1, this.rng.int(999999));
            u.name = name === 'Squire' ? ['Brigand', 'Militiaman', 'Deserter'][i % 3] : name;
            u.unique = false;
            u.native = null;
            if (mission.undeadHumans && !isMonster(u))
                u.status.Undead = 9999;
            if (mission.lootEnemy && name === 'Chemist')
                u.equip.weapon = mission.lootEnemy;
            this.prepare(u);
            this.units.push(u);
        }
        for (const name of [mission.boss, ...(mission.extraEnemies || [])].filter(Boolean)) {
            const c = DB.characters[name] || {}, u = makeUnit(name, c.job || (name === mission.boss && mission.bossJob) || 'Knight', lv, 1, this.rng.int(999999));
            u.boss = true;
            u.leader = name === mission.boss;
            this.prepare(u);
            this.units.push(u);
        }
        const positions = (side) => this.tiles.filter(t => !t.block && (side === 0 ? t.z >= this.h - 3 : t.z <= 3)).sort((a, b) => side === 0 ? (Math.abs(a.x - this.w / 2) + Math.abs(a.z - (this.h - 2)) * 2) - (Math.abs(b.x - this.w / 2) + Math.abs(b.z - (this.h - 2)) * 2) : (Math.abs(a.x - this.w / 2) + a.z * 2) - (Math.abs(b.x - this.w / 2) + b.z * 2));
        for (const side of [0, 1]) {
            const ps = positions(side);
            this.units.filter(u => u.team === side).forEach((u, i) => { const t = ps[(i * 2) % ps.length] || ps[i]; u.x = t.x; u.z = t.z; u.dir = side === 0 ? 0 : 2; });
        }
        const used = new Set();
        for (const u of this.units) {
            let t = this.tile(u.x, u.z);
            if (used.has(t.x + ',' + t.z)) {
                t = this.tiles.filter(a => !a.block && !used.has(a.x + ',' + a.z)).sort((a, b) => distance(a, u) - distance(b, u))[0];
                u.x = t.x;
                u.z = t.z;
            }
            used.add(u.x + ',' + u.z);
        }
        const guarded = this.units.find(u => u.protected);
        if (guarded)
            guarded.ct = 85; // An escort must be able to react before the opening rush.
        if (guarded && mission.id !== 'm12') {
            this.placeNearest(guarded, { x: Math.floor(this.w / 2) + 2, z: Math.floor(this.h / 2) });
        }
        if (mission.gate) {
            const hero = this.units.find(u => u.name === 'Ramza');
            this.placeNearest(hero, { x: 5, z: 2 });
            const boss = this.units.find(u => u.leader);
            if (boss)
                this.placeNearest(boss, { x: 7, z: 2 });
        }
        if (mission.poison)
            for (const u of this.units.filter(u => u.team === 0))
                u.status.Poison = 4;
        this.message('Objective: ' + this.objectiveText());
    }
    prepare(u) {
        for (const s of equipValues(u, 'auto').flatMap(v => String(v).split('/')))
            u.status[s] = 9999;
        if (DB.monsters[u.job]?.traits.includes('undead'))
            u.status.Undead = 9999;
        if (u.job === 'Steel Giant')
            u.faith = 0;
        const st = stats(u), difficulty = this.game.options.difficulty;
        if (u.team === 1 && difficulty === 'story') {
            u.hpOverride = Math.floor(st.hp * .78 / (u.mult || 1));
            u.mod.pa = -Math.ceil(st.pa * .18);
            u.mod.ma = -Math.ceil(st.ma * .18);
        }
        if (u.team === 1 && difficulty === 'tactician') {
            u.hpOverride = Math.floor(st.hp * 1.2 / (u.mult || 1));
            u.mod.pa = Math.ceil(st.pa * .1);
            u.mod.ma = Math.ceil(st.ma * .1);
        }
        u.hp = stats(u).hp;
        u.mp = stats(u).mp;
        u.ct = u.ct || this.rng.int(50);
        u.dir = u.team ? 2 : 0;
    }
    placeNearest(u, p) {
        const t = this.tiles.filter(t => !t.block && !this.occupant(t.x, t.z, u.id)).sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (t) {
            u.x = t.x;
            u.z = t.z;
        }
    }
    tile(x, z) { return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && x < this.w && z >= 0 && z < this.h ? this.tiles[z * this.w + x] : null; }
    unit(id) { return this.units.find(u => u.id === id); }
    active() { return this.unit(this.activeId); }
    occupant(x, z, except) { return this.units.find(u => u.id !== except && !u.removed && !u.airborne && u.x === x && u.z === z); }
    live() { return this.units.filter(isActive); }
    objectiveText() { const o = this.mission.objective; return o === 'leader' ? 'Defeat ' + this.mission.boss : o === 'wound' ? 'Bring any named enemy to critical HP' : o === 'switches' ? 'Ramza must activate both sluice switches' : o === 'exit' ? 'Find the hidden exit and defeat every enemy' : o.startsWith('protect:') ? 'Protect ' + o.split(':')[1] + ' and defeat every enemy' : this.mission.id === 'blade' ? 'Find the Materia Blade and defeat every enemy' : 'Defeat every enemy'; }
    message(text) {
        this.log.push(text);
        if (this.log.length > 90)
            this.log.shift();
    }
    event(e) {
        this.events.push(e);
        if (e.text)
            this.message(e.text);
    }
    start() {
        if (this.phase !== 'deploy')
            return;
        this.phase = 'turn';
        const hero = this.units.find(u => u.name === 'Ramza') || this.units[0];
        hero.ct = 100;
        this.activate(hero);
    }
    activate(u) {
        this.activeId = u.id;
        u.moved = false;
        u.acted = false;
        u.moveOrigin = null;
        u.guard = false;
        this.turn++;
        if (u.channel) {
            this.casts = this.casts.filter(c => !(c.caster === u.id && c.repeat));
            u.channel = null;
        }
        for (const [s, left] of Object.entries(u.status)) {
            if (s === 'Poison' && u.hp > 0)
                this.hurt(u, Math.max(1, Math.floor(stats(u).hp / 8)), null, 'poison');
            if (s === 'Regen')
                this.heal(u, Math.floor(stats(u).hp / 8), null);
            if (s === 'Doom' && Number(left) <= 1) {
                this.hurt(u, u.hp, null, 'doom');
                delete u.status.Doom;
            }
            if (Number(left) < 9999) {
                u.status[s] = Number(left) - 1;
                if (u.status[s] <= 0)
                    delete u.status[s];
            }
        }
        for (const s of equipValues(u, 'auto').flatMap(v => String(v).split('/')))
            if (!u.status[s])
                u.status[s] = 9999;
        if (!isActive(u)) {
            u.ct = 0;
            this.activeId = '';
            this.check();
            return;
        }
        if (u.team === 0 && !u.guest)
            this.playerTurns = (this.playerTurns || 0) + 1;
        this.event({ type: 'turn', id: u.id, text: u.name + ' is ready.' });
    }
    end(dir) {
        const u = this.active();
        if (!u || this.phase !== 'turn' || this.pendingLoot)
            return;
        if (dir !== undefined) {
            if (!Number.isInteger(dir) || dir < 0 || dir > 3)
                return;
            u.dir = dir;
        }
        u.ct = u.moved && u.acted ? 0 : u.moved || u.acted ? 20 : 40;
        this.activeId = '';
        this.check();
        if (this.phase === 'turn')
            this.advance();
    }
    advance() {
        if (this.phase !== 'turn' || this.activeId)
            return;
        for (let loops = 0; loops < 1500; loops++) {
            this.clock++;
            const due = this.casts.filter(c => c.due <= this.clock);
            this.casts = this.casts.filter(c => c.due > this.clock);
            for (const c of due) {
                const u = this.unit(c.caster);
                if (!u || !isActive(u) || has(u, 'Sleep') || has(u, 'Stop') || has(u, 'Dont Act')) {
                    if (u) {
                        u.airborne = false;
                        u.casting = null;
                    }
                    continue;
                }
                const target = c.lock ? this.unit(c.lock) : null, p = target && !target.removed ? { x: target.x, z: target.z } : c.point;
                u.casting = null;
                u.airborne = false;
                this.resolve(u, c.skill, p, c, true);
                if (c.repeat && isActive(u) && u.channel) {
                    this.casts.push({ ...c, due: this.clock + Math.max(4, c.skill.charge) });
                }
            }
            if (this.check())
                return;
            for (const u of this.units) {
                if (u.removed)
                    continue;
                const speed = stats(u).speed;
                u.ct += Math.max(1, speed);
                if (u.hp <= 0) {
                    if (u.ct >= 100) {
                        u.ct = 0;
                        u.down--;
                        if (u.down <= 0) {
                            u.removed = true;
                            this.groundLoot.push({ x: u.x, z: u.z, type: this.rng.next() < .6 ? 'crystal' : 'chest', skill: u.learned.find((n) => !['Potion', 'Phoenix Down'].includes(n) && DB.skills[n]?.kind !== 'passive'), item: u.equip.weapon || 'Potion' });
                            this.event({ type: 'crystal', id: u.id, text: u.name + ' leaves a crystal or treasure.' });
                        }
                    }
                    continue;
                }
                if (has(u, 'Petrify') || has(u, 'Stop') || has(u, 'Sleep') || u.airborne) {
                    if (u.ct >= 100) {
                        u.ct = 0;
                        for (const s of ['Stop', 'Sleep'])
                            if (u.status[s] && u.status[s] < 9999) {
                                u.status[s]--;
                                if (u.status[s] <= 0)
                                    delete u.status[s];
                            }
                    }
                    continue;
                }
            }
            const ready = this.live().filter(u => u.ct >= 100 && !has(u, 'Stop') && !has(u, 'Sleep') && !u.airborne).sort((a, b) => b.ct - a.ct || stats(b).speed - stats(a).speed);
            if (ready.length) {
                this.activate(ready[0]);
                if (this.activeId)
                    return;
            }
        }
        const ally = this.units.find(u => u.team === 0 && u.hp > 0 && !u.removed);
        if (ally) {
            for (const s of ['Stop', 'Sleep', 'Petrify'])
                delete ally.status[s];
            this.activate(ally);
            this.message('The stalemate breaks.');
        }
        else {
            this.phase = 'lost';
        }
    }
    forecast(n = 8) {
        const turns = this.live().filter(u => !u.airborne).map(u => ({ name: u.name, id: u.id, team: team(u), ticks: u.id === this.activeId ? 0 : Math.ceil(Math.max(0, 100 - u.ct) / Math.max(1, stats(u).speed)), cast: false }));
        for (const c of this.casts)
            turns.push({ name: c.skill.name, id: c.caster, team: this.unit(c.caster)?.team || 0, ticks: c.due - this.clock, cast: true });
        return turns.sort((a, b) => a.ticks - b.ticks).slice(0, n);
    }
    canTraverse(u, t, from) {
        if (t.block)
            return false;
        const o = this.occupant(t.x, t.z, u.id);
        if (o && isActive(o) && team(o) !== team(u))
            return false;
        const tr = DB.monsters[u.job]?.traits || [], fly = tr.includes('fly') || tr.includes('teleport') || tr.includes('height') || passive(u, 'Fly') || passive(u, 'Teleport') || passive(u, 'Ignore Height');
        if (from && !fly && Math.abs(t.h - from.h) > stats(u).jump)
            return false;
        if (t.t === 'lava' && !fly && !passive(u, 'Move on Lava') && !equipHas(u, 'absorb', 'Fire'))
            return false;
        return true;
    }
    reachable(u) {
        const result = new Map(), max = stats(u).move;
        result.set(u.x + ',' + u.z, { cost: 0, path: [] });
        if (u.moved || !isActive(u) || has(u, 'Dont Move'))
            return result;
        const tr = DB.monsters[u.job]?.traits || [], fly = tr.includes('fly') || tr.includes('teleport') || passive(u, 'Fly') || passive(u, 'Teleport');
        if (fly) {
            for (const t of this.tiles)
                if (distance(t, u) <= max + (passive(u, 'Teleport') ? 2 : 0) && !t.block && !this.occupant(t.x, t.z, u.id))
                    result.set(t.x + ',' + t.z, { cost: distance(t, u), path: [{ x: t.x, z: t.z }] });
            return result;
        }
        const q = [{ x: u.x, z: u.z }];
        for (let qi = 0; qi < q.length; qi++) {
            const p = q[qi], old = result.get(p.x + ',' + p.z);
            for (const d of DIRECTIONS) {
                const x = p.x + d.x, z = p.z + d.z, t = this.tile(x, z);
                if (!t || !this.canTraverse(u, t, this.tile(p.x, p.z)))
                    continue;
                const water = ['water', 'swamp'].includes(t.t), free = tr.includes('water') || tr.includes('float') || passive(u, 'Any Ground') || passive(u, 'Walk on Water') || passive(u, 'Move in Water') || has(u, 'Float') || passive(u, 'Float');
                const cost = old.cost + (water && !free ? 2 : 1), key = x + ',' + z;
                if (cost > max || (result.get(key)?.cost ?? Infinity) <= cost)
                    continue;
                result.set(key, { cost, path: [...old.path, { x, z }] });
                q.push({ x, z });
            }
        }
        for (const [key] of result) {
            const [x, z] = key.split(',').map(Number);
            if (this.occupant(x, z, u.id))
                result.delete(key);
        }
        return result;
    }
    move(u, x, z) {
        if (this.pendingLoot || !u || this.phase !== 'turn' || u.id !== this.activeId || u.moved || u.airborne)
            return false;
        const route = this.reachable(u).get(x + ',' + z);
        if (!route || !route.path.length)
            return false;
        if (passive(u, 'Teleport') && route.cost > stats(u).move && this.rng.next() < .2 * (route.cost - stats(u).move)) {
            u.moved = true;
            this.event({ type: 'text', id: u.id, text: 'Teleport failed.' });
            return true;
        }
        u.moveOrigin = { x: u.x, z: u.z, dir: u.dir };
        const origin = { x: u.x, z: u.z };
        u.x = x;
        u.z = z;
        u.moved = true;
        this.face(u, origin, true);
        this.event({ type: 'move', id: u.id, path: [origin, ...route.path] });
        this.visit(u);
        if (passive(u, 'Move HP Up')) {
            this.heal(u, Math.ceil(stats(u).hp * .1), u);
            u.moveOrigin = null;
        }
        if (passive(u, 'Move MP Up')) {
            u.mp = Math.min(stats(u).mp, u.mp + Math.ceil(stats(u).mp * .1));
            u.moveOrigin = null;
        }
        if (passive(u, 'Move-Get EXP')) {
            this.experience(u, 5);
            u.moveOrigin = null;
        }
        if (passive(u, 'Move-Get JP')) {
            this.jp(u, 10);
            u.moveOrigin = null;
        }
        const t = this.tile(x, z);
        if (t.t === 'swamp' && !has(u, 'Float') && !passive(u, 'Float') && !DB.monsters[u.job]?.traits.some((t) => ['water', 'float'].includes(t))) {
            this.status(u, 'Poison', 4);
            u.moveOrigin = null;
        }
        return true;
    }
    undo() {
        const u = this.active();
        if (!u || u.acted || !u.moveOrigin)
            return false;
        const p = u.moveOrigin;
        if (this.occupant(p.x, p.z, u.id))
            return false;
        u.x = p.x;
        u.z = p.z;
        if (p.dir !== undefined)
            u.dir = p.dir;
        u.moved = false;
        u.moveOrigin = null;
        return true;
    }
    visit(u) {
        const t = this.tile(u.x, u.z);
        if (t.feature === 'switch' && u.name === 'Ramza' && !this.switches.includes(u.x + ',' + u.z)) {
            this.switches.push(u.x + ',' + u.z);
            t.found = true;
            u.moveOrigin = null;
            this.event({ type: 'switch', id: u.id, text: 'Sluice switch ' + this.switches.length + ' / 2 activated.' });
        }
        if (t.feature === 'lever' && !t.found && u.name === 'Ramza') {
            for (const a of this.tiles)
                if (a.feature === 'gate') {
                    a.block = false;
                    a.h = 0;
                    a.feature = 'openGate';
                }
            t.found = true;
            u.moveOrigin = null;
            this.event({ type: 'switch', id: u.id, text: 'The gate opens!' });
        }
        if (t.feature === 'exit' && team(u) === 0) {
            this.exitFound = true;
            t.found = true;
            u.moveOrigin = null;
            this.event({ type: 'treasure', id: u.id, text: 'The hidden staircase is found.' });
        }
        if (t.treasure && !t.found && (passive(u, 'Move-Find Item') || t.feature === 'relic')) {
            t.found = true;
            const n = this.rng.next() < (100 - u.brave) / 100 || t.feature === 'relic' ? t.treasure : 'Potion';
            if (team(u) === 0) {
                this.inventory[n] = (this.inventory[n] || 0) + 1;
                this.treasuresFound.push(n);
            }
            u.moveOrigin = null;
            this.event({ type: 'treasure', id: u.id, text: u.name + ' found ' + n + '!' });
        }
        const loot = this.groundLoot.find(l => l.x === u.x && l.z === u.z && !l.taken);
        if (loot) {
            loot.taken = true;
            u.moveOrigin = null;
            if (loot.type === 'crystal' && u.team === 0 && !u.guest && loot.skill && !u.learned.includes(loot.skill))
                this.pendingLoot = { unit: u.id, skill: loot.skill };
            else if (loot.type === 'crystal') {
                u.hp = stats(u).hp;
                u.mp = stats(u).mp;
                this.event({ type: 'heal', id: u.id, text: 'Crystal restores HP and MP.' });
            }
            else {
                if (team(u) === 0)
                    this.inventory[loot.item] = (this.inventory[loot.item] || 0) + 1;
                this.event({ type: 'treasure', id: u.id, text: 'Recovered ' + loot.item + '.' });
            }
        }
        this.check();
    }
    chooseCrystal(learn) {
        if (!this.pendingLoot)
            return;
        const u = this.unit(this.pendingLoot.unit);
        if (u) {
            if (learn) {
                u.learned.push(this.pendingLoot.skill);
                this.message(u.name + ' learned ' + this.pendingLoot.skill + '.');
            }
            else {
                u.hp = stats(u).hp;
                u.mp = stats(u).mp;
            }
        }
        this.pendingLoot = null;
    }
    face(u, p, away = false) {
        let dx = p.x - u.x, dz = p.z - u.z;
        if (away) {
            dx = -dx;
            dz = -dz;
        }
        if (dx || dz)
            u.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
    }
    weaponRange(u, t) {
        let r = item(u.equip.weapon).range || 1;
        if (item(u.equip.weapon).type === 'Bow' && t)
            r += Math.max(0, Math.floor((this.tile(u.x, u.z).h - this.tile(t.x, t.z).h) / 2));
        return r;
    }
    jumpRanges(u) { return { range: Math.max(1, ...u.learned.filter((n) => n.startsWith('Level Jump ')).map((n) => DB.skills[n]?.power || 1)), height: Math.max(1, ...u.learned.filter((n) => n.startsWith('Vertical Jump ')).map((n) => DB.skills[n]?.power || 1)) }; }
    skillList(u) {
        let names = [...(DB.jobs[u.job]?.skills || []), ...(DB.jobs[u.secondary]?.skills || []), ...(u.extra || [])];
        if (u.name === 'Ramza') {
            if (this.mission.chapter >= 1)
                names.push('Wish', 'Yell');
            if (this.mission.chapter >= 3)
                names.push('Cheer Up');
            if (this.mission.chapter >= 4)
                names.push('Scream');
            if (u.learned.includes('Ultima'))
                names.push('Ultima');
        }
        if (isMonster(u)) {
            names = [...DB.monsters[u.job].skills];
            if (this.units.some(v => v.id !== u.id && team(v) === team(u) && isActive(v) && distance(v, u) <= 1 && passive(v, 'Monster Skill')))
                names.push(DB.monsters[u.job].extra);
        }
        return [...new Set(names)].filter(n => DB.skills[n] && DB.skills[n].kind !== 'passive' && (u.learned.includes(n) || isMonster(u) || (u.native && DB.jobs[u.job]?.special) || DB.skills[n].job === 'Ramza' && n !== 'Ultima'));
    }
    skillCost(u, a) { return Math.ceil((a.mp || 0) * (passive(u, 'Half MP') ? .5 : 1)); }
    usable(u, a) {
        if (!isActive(u) || u.acted || has(u, 'Dont Act') || has(u, 'Sleep') || has(u, 'Stop') || u.airborne)
            return 'Cannot act';
        if (a.kind === 'attack')
            return '';
        if (has(u, 'Frog') || has(u, 'Berserk'))
            return 'Only Attack is available';
        if ((a.magic || ['magic', 'randomMagic'].includes(a.kind) || a.mp > 0) && has(u, 'Silence'))
            return 'Silenced';
        if (u.casting)
            return 'Already charging';
        if (u.mp < this.skillCost(u, a))
            return 'Not enough MP';
        if (a.item && u.team === 0 && (this.inventory[a.item] || 0) < 1)
            return 'No ' + a.item;
        if (a.katana && (this.inventory[a.katana] || 0) < 1 && u.team === 0)
            return 'Requires ' + a.katana + ' in inventory';
        if (a.requires && u.equip.weapon !== a.requires)
            return 'Equip ' + a.requires;
        if (a.kind === 'geomancy' && this.tile(u.x, u.z).t !== a.terrain)
            return 'Requires ' + a.terrain + ' underfoot';
        if (a.kind === 'throw' && !a.selectedItem)
            return 'Choose an item to throw';
        if (a.selectedItem && (!DB.items[a.selectedItem] || item(a.selectedItem).type !== a.throwType || (this.inventory[a.selectedItem] || 0) < 1))
            return 'Thrown item is unavailable';
        return '';
    }
    lineOfSight(u, p, bow = false) {
        const d = distance(u, p), start = this.tile(u.x, u.z).h + 1.2, end = this.tile(p.x, p.z).h + 1;
        for (let i = 1; i < d * 3; i++) {
            const f = i / (d * 3), x = Math.round(u.x + (p.x - u.x) * f), z = Math.round(u.z + (p.z - u.z) * f);
            if ((x === u.x && z === u.z) || (x === p.x && z === p.z))
                continue;
            const t = this.tile(x, z);
            if (!t)
                continue;
            const ray = start + (end - start) * f + (bow ? Math.sin(f * Math.PI) * 4 : 0);
            if (t.h + (t.block ? 3 : 0) > ray)
                return false;
        }
        return true;
    }
    inRange(u, a, p) {
        const t = this.tile(p.x, p.z);
        if (!t)
            return false;
        let r = a.range < 0 ? this.weaponRange(u, p) : a.kind === 'attack' ? this.weaponRange(u, p) : a.range;
        if (a.kind === 'jump') {
            r = this.jumpRanges(u).range;
            const v = this.jumpRanges(u).height;
            if (Math.abs(this.tile(u.x, u.z).h - t.h) > v)
                return false;
        }
        if (a.item && (u.job === 'Chemist' || passive(u, 'Throw Item')))
            r = 4;
        if (distance(u, p) > r)
            return false;
        if (r === 1 && a.kind !== 'jump' && Math.abs(this.tile(u.x, u.z).h - t.h) > 3 && !a.magic)
            return false;
        if (a.line && u.x !== p.x && u.z !== p.z)
            return false;
        if (a.kind === 'attack' || a.range < 0) {
            const type = item(u.equip.weapon).type;
            if (['Gun', 'Crossbow', 'Bow'].includes(type) && !this.lineOfSight(u, p, type === 'Bow'))
                return false;
        }
        return true;
    }
    targets(u, a, p) {
        if (a.kind === 'calculate')
            return this.units.filter(v => !v.removed && !v.airborne && this.mathMatches(v, a.field, a.divisor));
        const ar = a.area || 0, global = a.global || a.range >= 99 || ['song', 'dance'].includes(a.kind);
        return this.units.filter(v => {
            if (v.removed || v.airborne)
                return false;
            if ((a.smart || global) && (a.friendly ? team(v) !== team(u) : team(v) === team(u)))
                return false;
            if (global)
                return true;
            if (a.line)
                return distance(v, u) <= a.range && ((u.x === p.x && v.x === u.x && Math.sign(v.z - u.z) === Math.sign(p.z - u.z)) || (u.z === p.z && v.z === u.z && Math.sign(v.x - u.x) === Math.sign(p.x - u.x)));
            return distance(v, p) <= ar && Math.abs(this.tile(v.x, v.z).h - this.tile(p.x, p.z).h) <= 3;
        });
    }
    mathMatches(v, field, divisor) {
        const val = field === 'CT' ? Math.floor(v.ct) : field === 'Level' ? v.level : field === 'EXP' ? v.exp : Math.max(0, Math.round(this.tile(v.x, v.z).h));
        if (divisor === 'Prime') {
            if (val < 2)
                return false;
            for (let i = 2; i * i <= val; i++)
                if (val % i === 0)
                    return false;
            return true;
        }
        return val % Number(divisor) === 0;
    }
    compatibility(u, v) { const d = (u.sign - v.sign + 12) % 12; return [4, 8].includes(d) ? 1.15 : [3, 9].includes(d) ? .85 : d === 6 ? (u.sex === v.sex ? .75 : 1.25) : 1; }
    faith(u) { return has(u, 'Innocent') ? 0 : has(u, 'Faith') ? 100 : u.faith; }
    magicFactor(u, v, inverse = false) { const a = this.faith(u), b = this.faith(v); return inverse ? ((100 - a) * (100 - b)) / 900 : (a * b) / 4900; }
    facing(u, v) { const d = DIRECTIONS[v.dir], dx = u.x - v.x, dz = u.z - v.z, dot = d.x * dx + d.z * dz; return dot > 0 ? 'front' : dot < 0 ? 'back' : 'side'; }
    preview(u, a, v) {
        const us = stats(u), vs = stats(v), w = item(a.selectedItem || u.equip.weapon), magic = a.magic || ['magic', 'randomMagic'].includes(a.kind), friendly = ['heal', 'mp', 'elixir', 'revive', 'cleanse', 'chakra', 'golem', 'sacrifice', 'sacrificeLevel'].includes(a.kind) || a.friendly;
        let val = 0, hit = 100, kind = a.kind, kp = typeof a.power === 'number' ? a.power : 1, element = a.element || null;
        const physicalBase = () => {
            if (w.magicGun) {
                element = w.element;
                return us.ma * w.power * .7 * this.magicFactor(u, v);
            }
            if (w.type === 'Gun')
                return w.power * w.power * .8 + u.level * .35;
            let power = w.power || 0;
            if (!power)
                return Math.max(12, us.pa * us.pa * .55) * (passive(u, 'Martial Arts') ? 1.25 : 1);
            if (['Stick', 'Dictionary', 'Harp', 'Cloth'].includes(w.type))
                return us.ma * (power + 2) * .75;
            return us.pa * (power + 2) * .75;
        };
        if (['attack', 'physical', 'jump', 'sword', 'swordbreak', 'sworddrain', 'swordmp', 'throw', 'geomancy', 'mpdamage', 'blood'].includes(kind))
            val = physicalBase() * kp;
        if (kind === 'attack') {
            element = w.element;
            if (w.healing)
                val = -us.ma * 5;
        }
        if (['magic', 'randomMagic'].includes(kind))
            val = us.ma * kp * this.magicFactor(u, v, a.inverseFaith);
        if (kind === 'throw') {
            val = (w.power || 8) * us.speed * 1.2;
            element = w.element || null;
        }
        if (kind === 'geomancy')
            val = (us.pa + us.ma) * kp;
        if (kind === 'heal')
            val = -(a.fixed ? kp : us.ma * kp * (magic ? this.magicFactor(u, v) : 1));
        if (kind === 'chakra')
            val = -us.pa * 3;
        if (kind === 'percent')
            val = v.hp * kp * (magic ? this.magicFactor(u, v) : 1);
        if (['drain', 'blood'].includes(kind))
            val = v.hp * kp;
        if (kind === 'missing')
            val = (us.hp - u.hp) * kp;
        if (kind === 'targetMissing')
            val = (vs.hp - v.hp) * kp;
        if (kind === 'difference')
            val = Math.abs(u.mp - v.mp) + us.ma * 3;
        if (kind === 'fixed')
            val = kp;
        if (kind === 'selfdestruct')
            val = u.hp;
        if (kind === 'sacrifice')
            val = -Math.min(u.hp - 1, Math.floor(us.hp * .3)) * 2;
        if (kind === 'status' || ['break', 'steal', 'invite', 'brave', 'faith', 'debuff', 'ct', 'morph', 'leveldown'].includes(kind)) {
            hit = kind === 'invite' ? 25 + (100 * v.hp / vs.hp < 25 ? 45 : 0) : kind === 'steal' ? 55 + (us.speed - vs.speed) * 4 : kind === 'break' ? 70 : 80;
            if (magic)
                hit *= this.magicFactor(u, v);
            if (a.friendly || team(u) === team(v) && ['brave', 'faith', 'ct'].includes(kind))
                hit = 100;
            if (v.boss && ['invite', 'morph', 'leveldown'].includes(kind))
                hit = 0;
        }
        if (val > 0 && !magic && !['percent', 'missing', 'targetMissing', 'fixed', 'selfdestruct', 'difference', 'drain', 'blood'].includes(kind)) {
            if (!['sword', 'swordbreak', 'sworddrain', 'swordmp', 'geomancy'].includes(kind)) {
                const f = this.facing(u, v), ev = (f === 'front' ? (item(v.equip.shield).evade || 0) : 0) + (f !== 'back' ? (item(v.equip.accessory).evade || 0) : 0) + (f === 'front' && passive(v, 'Weapon Guard') ? (item(v.equip.weapon).evade || 0) : 0);
                hit = clamp(100 - ev - (f === 'front' ? 8 : 0), 10, 100);
                if (passive(v, 'Abandon'))
                    hit = clamp(hit - ev, 5, 100);
                if (passive(v, 'Blade Grasp'))
                    hit *= 1 - v.brave * .0065;
                if (passive(v, 'Arrow Guard') && ['Bow', 'Crossbow'].includes(w.type))
                    hit *= .25;
            }
            if (passive(u, 'Concentrate'))
                hit = 100;
            if (has(u, 'Dark'))
                hit *= .5;
            if (this.mission.theme === 'rainTown' && w.type === 'Bow' && !passive(u, 'Any Weather'))
                hit *= .85;
            if (has(v, 'Protect'))
                val *= .67;
            if (passive(v, 'Defense Up'))
                val *= .75;
            if (passive(u, 'Attack Up'))
                val *= 1.3;
            if (passive(u, 'Two Hands') && !u.equip.shield)
                val *= 1.35;
            if (has(u, 'Berserk'))
                val *= 1.5;
            val *= clamp(1 + (this.tile(u.x, u.z).h - this.tile(v.x, v.z).h) * .06, .7, 1.3);
        }
        if (magic) {
            if (val > 0 && has(v, 'Shell'))
                val *= .67;
            if (passive(v, 'Magic Defense Up'))
                val *= .7;
            if (passive(u, 'Magic Attack Up'))
                val *= 1.3;
            hit *= 1 - (item(v.equip.shield).magicEvade || 0) / 100;
        }
        if (has(v, 'Sleep') || has(v, 'Stop') || has(v, 'Petrify'))
            hit = 100;
        if (v.guard && val > 0)
            val *= .5;
        val *= this.compatibility(u, v);
        if (element) {
            if (equipHas(u, 'boost', element))
                val *= 1.3;
            if (equipHas(v, 'half', element))
                val *= .5;
            if (equipHas(v, 'weak', element) || DB.monsters[v.job]?.weak === element)
                val *= 1.5;
            if (equipHas(v, 'absorb', element) || DB.monsters[v.job]?.absorb === element)
                val = -Math.abs(val);
            if (element === 'Fire' && has(v, 'Oil'))
                val *= 2;
        }
        if (kind === 'heal' && has(v, 'Undead'))
            val = Math.abs(val);
        if (a.undeadOnly && !has(v, 'Undead'))
            hit = 0;
        if (a.dragonOnly && !['Dragon', 'Hydra'].includes(DB.monsters[v.job]?.family) && v.job !== 'Dragoner')
            hit = 0;
        if (a.opposite && (u.sex === v.sex || isMonster(v)))
            hit = 0;
        if (a.status?.some((s) => equipHas(v, 'immune', s)) && a.status.every((s) => equipHas(v, 'immune', s)))
            hit = 0;
        if (a.talk && (passive(v, 'Finger Guard') || isMonster(v) && u.job !== 'Mediator' && !passive(u, 'Monster Talk')))
            hit = 0;
        return { value: Math.round(val), hit: Math.round(clamp(hit, 0, 100)), friendly, kind, element };
    }
    check() {
        if (this.phase !== 'turn')
            return this.phase === 'won' || this.phase === 'lost';
        const protect = this.units.find(u => u.protected), hero = this.units.find(u => u.name === 'Ramza'), allies = this.units.filter(u => u.team === 0 && !u.guest && !u.recruited);
        const lost = !!(protect && (protect.hp <= 0 || protect.removed || has(protect, 'Petrify'))) || !!(hero?.removed) || !allies.some(isActive);
        if (lost) {
            this.phase = 'lost';
            this.event({ type: 'defeat', text: protect?.hp <= 0 ? protect.name + ' has fallen.' : 'The company has fallen.' });
            return true;
        }
        const foes = this.units.filter(u => u.team === 1 && isActive(u) && !u.recruited), o = this.mission.objective;
        let win = o === 'switches' ? this.switches.length >= 2 : o === 'leader' ? !this.units.some(u => u.leader && isActive(u)) : o === 'wound' ? this.units.some(u => u.boss && (u.hp <= stats(u).hp * .2 || !isActive(u))) : o === 'exit' ? foes.length === 0 && this.exitFound : foes.length === 0;
        if (this.mission.id === 'blade')
            win = win && this.treasuresFound.includes('Materia Blade');
        if (win) {
            this.phase = 'won';
            this.event({ type: 'victory', text: 'Victory — ' + this.mission.name });
            return true;
        }
        return false;
    }
    status(u, s, n = 4) {
        if (!u || u.removed || equipHas(u, 'immune', s) || u.job === 'Steel Giant' && NEGATIVE.includes(s) && s !== 'Oil' || u.boss && ['Death', 'Petrify', 'Doom', 'Charm', 'Frog', 'Blood Suck'].includes(s))
            return false;
        if (s === 'Death') {
            this.hurt(u, u.hp, null, 'death');
            return true;
        }
        const opposites = { Haste: 'Slow', Slow: 'Haste', Faith: 'Innocent', Innocent: 'Faith', Regen: 'Poison', Poison: 'Regen' };
        if (opposites[s])
            delete u.status[opposites[s]];
        u.status[s] = s === 'Doom' ? 3 : n;
        if (['Sleep', 'Petrify', 'Stop', 'Dont Act'].includes(s)) {
            this.casts = this.casts.filter(c => c.caster !== u.id);
            u.casting = null;
            u.airborne = false;
        }
        this.event({ type: 'status', id: u.id, kind: s, text: u.name + ': ' + s });
        return true;
    }
    hurt(u, n, source, kind = 'physical') {
        if (!u || u.hp <= 0 || u.removed)
            return 0;
        n = Math.max(0, Math.round(n));
        if (passive(u, 'MP Switch') && u.mp > 0 && this.rng.next() < u.brave / 100 && kind !== 'death') {
            const v = Math.min(n, u.mp);
            u.mp -= v;
            this.event({ type: 'mp', id: u.id, value: -v, text: 'MP Switch absorbs ' + v + '.' });
            return 0;
        }
        if (u.golem > 0 && !['magic', 'death', 'poison', 'doom'].includes(kind)) {
            const v = Math.min(n, u.golem);
            u.golem -= v;
            n -= v;
            this.event({ type: 'block', id: u.id, text: 'Golem absorbs ' + v + '.' });
        }
        const taken = Math.min(u.hp, n);
        u.hp = Math.max(0, u.hp - n);
        if (taken) {
            delete u.status.Sleep;
            delete u.status.Charm;
            delete u.status.Transparent;
            this.event({ type: 'hit', id: u.id, value: taken, kind, text: u.name + ' −' + taken + ' HP' });
        }
        if (u.hp === 0) {
            this.casts = this.casts.filter(c => c.caster !== u.id);
            u.casting = null;
            u.airborne = false;
            u.down = 3;
            u.ct = 0;
            if (u.reviveOnce && !u.revivedOnce) {
                u.revivedOnce = true;
                u.hp = 1;
                this.event({ type: 'revive', id: u.id, text: u.name + ' reboots with 1 HP!' });
            }
            else if (has(u, 'Reraise')) {
                delete u.status.Reraise;
                u.hp = Math.ceil(stats(u).hp * .3);
                this.event({ type: 'revive', id: u.id, value: u.hp, text: 'Reraise restores ' + u.name + '.' });
            }
            else {
                this.event({ type: 'ko', id: u.id, text: u.name + ' falls. Revive within three personal turns.' });
                if (source?.team === 0)
                    this.game.state.stats.kills++;
            }
        }
        return taken;
    }
    heal(u, n, source) {
        if (!u || u.removed || u.hp <= 0)
            return 0;
        const max = stats(u).hp, amount = Math.max(0, Math.min(max - u.hp, Math.round(n)));
        u.hp += amount;
        if (amount)
            this.event({ type: 'heal', id: u.id, value: amount, text: u.name + ' +' + amount + ' HP' });
        if (source && passive(source, 'Distribute') && n > amount) {
            const near = this.units.filter(v => v.id !== u.id && team(v) === team(u) && isActive(v));
            for (const v of near)
                v.hp = Math.min(stats(v).hp, v.hp + Math.floor((n - amount) / Math.max(1, near.length)));
        }
        return amount;
    }
    experience(u, n) {
        if (u.team !== 0)
            return;
        u.exp += Math.max(1, Math.floor(n * (passive(u, 'Gained EXP Up') ? 1.5 : 1)));
        while (u.exp >= 100 && u.level < 99) {
            u.exp -= 100;
            u.level++;
            u.hp = Math.min(stats(u).hp, u.hp + 8);
            u.mp = Math.min(stats(u).mp, u.mp + 3);
            this.event({ type: 'level', id: u.id, text: u.name + ' reaches level ' + u.level + '.' });
        }
        if (u.level === 99)
            u.exp = Math.min(99, u.exp);
    }
    jp(u, n) {
        if (u.team !== 0)
            return;
        const gain = Math.floor(n * (passive(u, 'Gained JP Up') ? 1.5 : 1));
        u.jp[u.job] = (u.jp[u.job] || 0) + gain;
        u.totalJP[u.job] = (u.totalJP[u.job] || 0) + gain;
        for (const v of this.units.filter(v => v.team === 0 && v.id !== u.id && !v.guest)) {
            v.jp[u.job] = (v.jp[u.job] || 0) + Math.floor(gain * .25);
            v.totalJP[u.job] = (v.totalJP[u.job] || 0) + Math.floor(gain * .25);
        }
    }
    execute(u, a, p, lockUnit = true) {
        if (this.pendingLoot || !u || !a || !p || !Number.isInteger(p.x) || !Number.isInteger(p.z) || this.phase !== 'turn' || u.id !== this.activeId || this.usable(u, a) || !this.inRange(u, a, p) || !this.tile(p.x, p.z))
            return false;
        a = clone(a);
        u.acted = true;
        u.moveOrigin = null;
        u.mp -= this.skillCost(u, a);
        if (a.item && u.team === 0)
            this.inventory[a.item]--;
        if (a.selectedItem)
            this.inventory[a.selectedItem]--;
        this.face(u, p);
        delete u.status.Transparent;
        this.experience(u, 12);
        this.jp(u, 25);
        if (a.mp || a.magic)
            this.game.state.stats.casts++;
        const target = this.occupant(p.x, p.z);
        let charge = a.charge || 0;
        if (passive(u, 'Short Charge'))
            charge = Math.ceil(charge * .5);
        if (a.kind === 'calculate')
            charge = 0;
        if (charge) {
            const c = { caster: u.id, skill: a, point: { ...p }, lock: lockUnit && !a.tileOnly && target ? target.id : null, due: this.clock + charge, repeat: ['song', 'dance'].includes(a.kind) };
            this.casts.push(c);
            u.casting = a.name;
            if (a.kind === 'jump')
                u.airborne = true;
            if (c.repeat)
                u.channel = a.name;
            this.event({ type: 'cast', id: u.id, x: p.x, z: p.z, kind: a.element || a.kind, text: u.name + ' prepares ' + a.name + ' · ' + charge + ' CT.' });
        }
        else
            this.resolve(u, a, p, {}, false);
        this.check();
        return true;
    }
    resolve(u, a, p, c = {}, charged = false) {
        if (!u || u.removed)
            return;
        if (a.kind === 'calculate') {
            const spell = DB.skills[a.spell];
            if (!spell)
                return;
            const targets = this.units.filter(v => !v.removed && !v.airborne && this.mathMatches(v, a.field, a.divisor));
            for (const v of targets)
                this.apply(u, { ...spell, charge: 0, area: 0, mp: 0, math: true }, v);
            this.event({ type: 'cast', id: u.id, text: 'Arithmetic: ' + a.field + ' ' + a.divisor + ' — ' + spell.name });
            return;
        }
        if (a.kind === 'guard') {
            u.guard = true;
            this.event({ type: 'block', id: u.id, text: u.name + ' takes a defensive stance.' });
            return;
        }
        if (a.kind === 'wait') {
            this.end();
            return;
        }
        if (a.kind === 'scream') {
            for (const s of ['pa', 'ma', 'speed'])
                u.mod[s] = (u.mod[s] || 0) + 1;
            u.brave = clamp(u.brave + 5, 1, 100);
            this.event({ type: 'buff', id: u.id, text: u.name + ' gains power, magic, speed and bravery.' });
            return;
        }
        if (['song', 'dance'].includes(a.kind)) {
            a = { ...a, kind: a.payload, fixed: true, global: true, status: a.payload === 'status' ? [this.rng.pick(a.status)] : [] };
        }
        let ts = this.targets(u, a, p);
        if (a.kind === 'randomMagic') {
            const spots = this.tiles.filter(t => distance(t, p) <= a.area && !t.block);
            ts = [];
            for (let i = 0, n = 2 + this.rng.int(4); i < n; i++) {
                const t = this.rng.pick(spots), v = t && this.occupant(t.x, t.z);
                if (v)
                    ts.push(v);
            }
            a = { ...a, kind: 'magic' };
        }
        this.event({ type: 'action', id: u.id, x: p.x, z: p.z, kind: a.element || a.kind, targets: ts.map(v => v.id), text: u.name + ' uses ' + a.name + '.' });
        for (const v of ts) {
            this.apply(u, a, v, c);
            if (this.phase === 'lost')
                break;
        }
        if (a.katana && u.team === 0 && this.rng.next() < .12) {
            this.inventory[a.katana] = Math.max(0, (this.inventory[a.katana] || 0) - 1);
            this.event({ type: 'break', id: u.id, text: a.katana + ' shatters after Draw Out.' });
        }
        if (a.kind === 'selfdestruct')
            this.hurt(u, u.hp, null, 'death');
        if (a.recoil)
            this.hurt(u, Math.ceil(stats(u).hp * a.recoil), null, 'recoil');
        if (!c.mime && !charged && !a.item && !['song', 'dance', 'calculate', 'invite', 'selfdestruct'].includes(a.kind))
            for (const v of this.units.filter(v => v.id !== u.id && team(v) === team(u) && v.job === 'Mime' && isActive(v))) {
                const q = { x: v.x + p.x - u.x, z: v.z + p.z - u.z };
                if (this.tile(q.x, q.z)) {
                    this.event({ type: 'text', id: v.id, text: v.name + ' mimics ' + a.name + '.' });
                    this.resolve(v, a, q, { mime: true }, true);
                }
            }
    }
    apply(u, a, v, c = {}) {
        if (v.removed || v.airborne)
            return;
        const kind = a.kind, st = stats(v), before = v.hp, magic = a.magic || ['magic', 'randomMagic'].includes(kind) || a.mp > 0;
        if (v.hp <= 0 && kind !== 'revive')
            return;
        if (has(v, 'Reflect') && magic && !a.smart && !a.reflected && !a.math) {
            this.event({ type: 'reflect', id: v.id, text: v.name + ' reflects ' + a.name + '!' });
            this.apply(u, { ...a, reflected: true }, u, c);
            return;
        }
        let prev = this.preview(u, a, v);
        if (['cleanse', 'mp', 'elixir', 'buff', 'golem', 'sacrifice', 'sacrificeLevel'].includes(kind))
            prev.hit = 100;
        if (kind === 'revive')
            prev.hit = a.item ? 100 : 90;
        if (kind === 'throw' && passive(v, 'Catch') && this.rng.next() < v.brave / 100) {
            if (v.team === 0)
                this.inventory[a.selectedItem] = (this.inventory[a.selectedItem] || 0) + 1;
            this.event({ type: 'block', id: v.id, text: v.name + ' catches ' + a.selectedItem + '.' });
            return;
        }
        if (this.rng.next() * 100 >= prev.hit) {
            this.event({ type: 'miss', id: v.id, text: v.name + ': Miss (' + prev.hit + '%).' });
            return;
        }
        if (kind === 'revive') {
            if (has(v, 'Undead')) {
                this.hurt(v, v.hp, u, 'death');
                return;
            }
            if (v.hp > 0)
                return;
            v.hp = Math.max(1, Math.round(st.hp * a.power));
            v.down = 3;
            v.ct = 0;
            this.event({ type: 'revive', id: v.id, value: v.hp, text: v.name + ' returns to battle.' });
            return;
        }
        if (kind === 'heal' || kind === 'sacrifice' || kind === 'chakra') {
            if (prev.value > 0)
                this.hurt(v, prev.value, u, 'magic');
            else
                this.heal(v, -prev.value, u);
            if (kind === 'sacrifice')
                this.hurt(u, Math.ceil(-prev.value * .5), null, 'sacrifice');
            if (kind === 'chakra') {
                v.mp = Math.min(st.mp, v.mp + Math.floor(stats(u).pa * 1.5));
            }
            return;
        }
        if (kind === 'mp') {
            const n = a.fixed ? a.power : stats(u).ma * a.power;
            v.mp = Math.min(st.mp, v.mp + Math.ceil(n));
            this.event({ type: 'mp', id: v.id, text: v.name + ' recovers MP.' });
            return;
        }
        if (kind === 'elixir') {
            if (has(v, 'Undead'))
                this.hurt(v, v.hp, u, 'death');
            else {
                this.heal(v, st.hp, u);
                v.mp = st.mp;
            }
            return;
        }
        if (kind === 'cleanse' || kind === 'dispel') {
            const remove = kind === 'cleanse' ? (!a.remove || a.remove.includes('all') ? NEGATIVE : a.remove) : POSITIVE;
            for (const s of remove)
                delete v.status[s];
            this.event({ type: 'cleanse', id: v.id, text: v.name + ': ' + (kind === 'cleanse' ? 'ailments removed.' : 'enchantments dispelled.') });
            return;
        }
        if (kind === 'golem') {
            v.golem = stats(u).hp;
            this.event({ type: 'buff', id: v.id, text: v.name + ' is shielded by Golem.' });
            return;
        }
        if (kind === 'buff' || kind === 'debuff') {
            const n = (a.power || 1) * (kind === 'debuff' ? -1 : 1);
            if (a.stat === 'mp')
                v.mp = Math.max(0, v.mp - Math.floor(st.mp * .4));
            else
                v.mod[a.stat] = (v.mod[a.stat] || 0) + n;
            this.event({ type: 'buff', id: v.id, text: v.name + ' ' + String(a.stat).toUpperCase() + ' ' + (n > 0 ? '+' : '') + n });
            return;
        }
        if (kind === 'ct') {
            v.ct = a.power;
            this.event({ type: 'buff', id: v.id, text: v.name + ' CT becomes ' + a.power + '.' });
            return;
        }
        if (kind === 'brave' || kind === 'faith') {
            v[kind] = clamp(v[kind] + a.power, 1, 100);
            this.event({ type: 'buff', id: v.id, text: v.name + ' ' + kind + ': ' + v[kind] });
            return;
        }
        if (kind === 'invite') {
            if (u.team === 0 && this.game.state.roster.length + this.units.filter(t => t.recruited && t.team === 0).length >= 40) {
                this.message('The company is full. Recruitment failed.');
                return;
            }
            if (v.boss || v.unique || team(v) === team(u))
                return;
            v.team = u.team;
            v.recruited = true;
            v.guest = false;
            delete v.status.Charm;
            this.event({ type: 'recruit', id: v.id, text: v.name + ' joins your cause!' });
            return;
        }
        if (kind === 'gil') {
            const n = Math.floor(v.level * 70 + 100);
            if (u.team === 0)
                this.gil += n;
            this.event({ type: 'treasure', id: u.id, text: 'Acquired ' + n + ' gil.' });
            return;
        }
        if (kind === 'steal' && a.slot === 'exp') {
            this.experience(u, 30);
            v.exp = Math.max(0, v.exp - 30);
            return;
        }
        if (['steal', 'break', 'swordbreak'].includes(kind)) {
            const n = v.equip[a.slot];
            if (n && !passive(v, 'Maintenance')) {
                delete v.equip[a.slot];
                v.hp = Math.min(v.hp, stats(v).hp);
                v.mp = Math.min(v.mp, stats(v).mp);
                if (kind === 'steal' && u.team === 0)
                    this.inventory[n] = (this.inventory[n] || 0) + 1;
                this.event({ type: 'break', id: v.id, text: n + (kind === 'steal' ? ' stolen!' : ' broken!') });
            }
            else
                this.event({ type: 'block', id: v.id, text: n ? 'Maintenance protects equipment.' : 'No equipment in that slot.' });
            if (kind !== 'swordbreak')
                return;
        }
        if (kind === 'status') {
            for (const s of a.randomStatus ? [this.rng.pick(a.status || [])] : a.status || [])
                if (s)
                    this.status(v, s, s === 'Doom' ? 3 : 4);
            return;
        }
        if (kind === 'leveldown') {
            if (!v.boss) {
                v.level = Math.max(1, v.level - 1);
                v.mp = Math.min(v.mp, stats(v).mp);
                v.hp = Math.min(v.hp, stats(v).hp);
                this.event({ type: 'text', id: v.id, text: v.name + ' loses a level.' });
            }
            return;
        }
        if (kind === 'morph') {
            if (!v.boss && !v.unique) {
                v.job = 'Morbol';
                v.equip = {};
                v.learned = DB.monsters.Morbol.skills;
                v.hp = Math.min(v.hp, stats(v).hp);
                this.event({ type: 'transform', id: v.id, text: v.name + ' transforms into a Morbol!' });
            }
            return;
        }
        if (kind === 'sacrificeLevel') {
            if (v.id !== u.id) {
                v.level = Math.min(99, v.level + 1);
                this.hurt(u, u.hp, null, 'death');
                this.event({ type: 'level', id: v.id, text: v.name + ' gains a level.' });
            }
            return;
        }
        if (['drainmp', 'mpdamage', 'swordmp'].includes(kind)) {
            const n = Math.min(v.mp, kind === 'drainmp' ? Math.ceil(st.mp * a.power) : Math.abs(prev.value));
            v.mp -= n;
            if (kind !== 'mpdamage')
                u.mp = Math.min(stats(u).mp, u.mp + n);
            this.event({ type: 'mp', id: v.id, text: v.name + ' −' + n + ' MP' });
            return;
        }
        if (passive(v, 'Hamedo') && kind === 'attack' && distance(u, v) === 1 && this.rng.next() < v.brave / 100 && !c.counter) {
            this.hurt(u, Math.abs(this.preview(v, DB.skills.Attack, u).value), v, 'counter');
            if (!isActive(u))
                return;
        }
        const n = prev.value > 0 ? this.hurt(v, prev.value, u, magic ? 'magic' : kind) : (-this.heal(v, -prev.value, u));
        if (['drain', 'sworddrain', 'blood'].includes(kind) || kind === 'attack' && item(u.equip.weapon).drain)
            this.heal(u, Math.max(0, n), u);
        if (kind === 'blood' && v.hp > 0)
            this.status(v, 'Blood Suck', 5);
        for (const s of a.status || [])
            if (this.rng.next() < (a.statusChance ?? .22) && v.hp > 0)
                this.status(v, s, 4);
        const weapon = item(u.equip.weapon);
        if (kind === 'attack' && weapon.proc && isActive(v) && this.rng.next() < .2) {
            const proc = DB.skills[weapon.proc];
            if (proc)
                this.apply(u, { ...proc, reflected: true }, v, { counter: true });
            else
                this.status(v, weapon.proc, 4);
        }
        if (kind === 'attack' && weapon.cast && isActive(v) && this.rng.next() < .2 && DB.skills[weapon.cast])
            this.apply(u, { ...DB.skills[weapon.cast], reflected: true }, v, { counter: true });
        if (a.push && isActive(v) && this.rng.next() < .4) {
            const old = { x: v.x, z: v.z }, dx = Math.sign(v.x - u.x), dz = Math.sign(v.z - u.z), p = { x: v.x + (Math.abs(v.x - u.x) >= Math.abs(v.z - u.z) ? dx : 0), z: v.z + (Math.abs(v.x - u.x) < Math.abs(v.z - u.z) ? dz : 0) }, t = this.tile(p.x, p.z);
            if (t && !t.block && !this.occupant(p.x, p.z)) {
                v.x = p.x;
                v.z = p.z;
                this.event({ type: 'move', id: v.id, path: [old, p] });
            }
        }
        if (kind === 'attack' && passive(u, 'Two Swords') && u.equip.shield && item(u.equip.shield).slot === 'weapon' && !c.offhand && isActive(v)) {
            const saved = u.equip.weapon;
            u.equip.weapon = u.equip.shield;
            this.apply(u, a, v, { ...c, offhand: true });
            u.equip.weapon = saved;
        }
        if (v.hp <= 0 && before > 0 && kind === 'attack' && passive(u, 'Secret Hunt') && DB.monsters[v.job]?.poach.length) {
            const pool = DB.monsters[v.job].poach, n = pool[this.rng.next() < .18 ? 1 : 0] || pool[0];
            if (u.team === 0 && DB.items[n])
                this.poach[n] = (this.poach[n] || 0) + 1;
            v.removed = true;
            this.event({ type: 'poach', id: u.id, text: v.job + ' poached: ' + n + ' at the Fur Shop.' });
        }
        if (isActive(v) && v.hp < stats(v).hp * .2 && passive(u, 'Train') && isMonster(v) && !v.boss && this.game.state.roster.length + this.units.filter(t => t.recruited && t.team === 0).length < 40) {
            v.team = u.team;
            v.guest = false;
            v.recruited = true;
            this.event({ type: 'recruit', id: v.id, text: 'Train: ' + v.name + ' joins the company.' });
        }
        if (isActive(v) && a.name === 'Ultima' && v.name === 'Ramza' && v.job === 'Squire' && !v.learned.includes('Ultima')) {
            v.learned.push('Ultima');
            this.event({ type: 'learn', id: v.id, text: 'Ramza learned Ultima!' });
        }
        if (isActive(v) && a.name === 'Zodiac' && v.job === 'Summoner' && !v.learned.includes('Zodiac')) {
            v.learned.push('Zodiac');
            this.event({ type: 'learn', id: v.id, text: v.name + ' learned Zodiac!' });
        }
        if (n > 0 && !c.counter && isActive(v))
            this.react(v, u, a, n);
    }
    react(v, u, a, n) {
        if (!v.reaction || this.rng.next() > v.brave / 100 || has(v, 'Frog') || has(v, 'Dont Act'))
            return;
        const r = v.reaction, critical = v.hp < stats(v).hp * .25;
        const physical = !a.magic && !['magic', 'randomMagic'].includes(a.kind) && !a.mp;
        if (['Counter', 'Counter Tackle', 'Meatbone Slash'].includes(r) && (r !== 'Meatbone Slash' || critical) && physical && this.inRange(v, DB.skills.Attack, u)) {
            const aa = { ...DB.skills.Attack };
            if (r === 'Counter Tackle') {
                aa.kind = 'physical';
                aa.power = .6;
            }
            if (r === 'Meatbone Slash' && critical) {
                aa.kind = 'fixed';
                aa.power = stats(v).hp;
            }
            this.event({ type: 'text', id: v.id, text: r + '!' });
            this.apply(v, aa, u, { counter: true });
        }
        if (r === 'Counter Magic' && !physical && a.mp)
            this.apply(v, { ...a, area: 0, reflected: true }, u, { counter: true });
        if (r === 'Auto Potion') {
            const p = v.team === 0 ? ['X-Potion', 'Hi-Potion', 'Potion'].find(n => (this.inventory[n] || 0) > 0) : 'Potion';
            if (p) {
                if (v.team === 0)
                    this.inventory[p]--;
                this.apply(v, DB.skills[p], v, { counter: true });
            }
        }
        if (r === 'HP Restore' && critical)
            this.heal(v, stats(v).hp, v);
        if (r === 'MP Restore' && critical)
            v.mp = stats(v).mp;
        if (r === 'Regenerator')
            this.status(v, 'Regen', 4);
        if (r === 'Dragon Spirit')
            this.status(v, 'Reraise', 9999);
        if (r === 'Caution')
            v.guard = true;
        if (r === 'Sunken State')
            this.status(v, 'Transparent', 3);
        if (r === 'Critical Quick' && critical)
            v.ct = 100;
        if (r === 'Gilgame Heart' && v.team === 0)
            this.gil += n;
        if (r === 'Absorb Used MP')
            v.mp = Math.min(stats(v).mp, v.mp + (a.mp || 0));
        if (r === 'Damage Split') {
            this.heal(v, Math.floor(n / 2), v);
            this.hurt(u, Math.floor(n / 2), v, 'counter');
        }
        for (const [name, s] of [['Speed Save', 'speed'], ['A Save', 'pa'], ['MA Save', 'ma']])
            if (r === name)
                v.mod[s] = (v.mod[s] || 0) + 1;
        if (r === 'Brave Up')
            v.brave = Math.min(100, v.brave + 3);
        if (r === 'Face Up')
            v.faith = Math.min(100, v.faith + 3);
        if (r === 'Counter Flood') {
            const g = DB.jobs.Geomancer.skills.find((s) => DB.skills[s].terrain === this.tile(v.x, v.z).t);
            if (g && distance(u, v) <= 5)
                this.apply(v, DB.skills[g], u, { counter: true });
        }
    }
    // A full-board distance field prevents the AI from getting stuck behind walls.
    distanceField(u, goal) {
        const costs = new Map(), queue = [{ x: goal.x, z: goal.z }];
        costs.set(goal.x + ',' + goal.z, 0);
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi], cur = this.tile(p.x, p.z);
            if (!cur)
                continue;
            for (const d of DIRECTIONS) {
                const t = this.tile(p.x + d.x, p.z + d.z);
                if (!t || t.block)
                    continue;
                const traits = DB.monsters[u.job]?.traits || [], free = traits.some((s) => ['fly', 'height', 'teleport'].includes(s)) || passive(u, 'Fly') || passive(u, 'Teleport') || passive(u, 'Ignore Height');
                if (!free && Math.abs(t.h - cur.h) > stats(u).jump)
                    continue;
                if (t.t === 'lava' && !free && !passive(u, 'Move on Lava') && !equipHas(u, 'absorb', 'Fire'))
                    continue;
                const key = t.x + ',' + t.z, cost = costs.get(p.x + ',' + p.z) + 1;
                if ((costs.get(key) ?? Infinity) <= cost)
                    continue;
                costs.set(key, cost);
                queue.push(t);
            }
        }
        return costs;
    }
    aiPlan(u) {
        const confused = has(u, 'Confuse');
        const foes = this.units.filter(v => isActive(v) && !v.airborne && v.id !== u.id && (confused || team(v) !== team(u))), friends = this.units.filter(v => !v.removed && !v.airborne && team(v) === team(u));
        const usable = [DB.skills.Attack, ...this.skillList(u).map(n => DB.skills[n])].filter(a => !this.usable(u, a) && !['invite', 'gil', 'steal', 'break', 'brave', 'faith', 'buff', 'scream', 'guard', 'sacrificeLevel', 'morph', 'leveldown', 'randomMagic', 'throw', 'ct', 'debuff', 'dispel'].includes(a.kind));
        let best = { score: -Infinity, p: { x: u.x, z: u.z }, a: null, target: null };
        const origin = { x: u.x, z: u.z };
        let positions = [...this.reachable(u).keys()].map(k => { const [x, z] = k.split(',').map(Number); return { x, z }; });
        if (!positions.length)
            positions = [origin];
        if (confused) {
            const candidates = [];
            for (const p of positions) {
                u.x = p.x;
                u.z = p.z;
                for (const v of foes)
                    if (this.inRange(u, DB.skills.Attack, v))
                        candidates.push({ p: { ...p }, a: DB.skills.Attack, target: { x: v.x, z: v.z } });
            }
            u.x = origin.x;
            u.z = origin.z;
            return candidates.length ? this.rng.pick(candidates) : { p: this.rng.pick(positions), a: null, target: null };
        }
        if (u.brave < 10 && foes.length) {
            positions.sort((a, b) => Math.min(...foes.map(v => distance(v, b))) - Math.min(...foes.map(v => distance(v, a))));
            return { p: positions[0], a: null, target: null, retreat: true };
        }
        if (positions.length > 45)
            positions = positions.sort((p, q) => Math.min(...foes.map(v => distance(v, p))) - Math.min(...foes.map(v => distance(v, q)))).slice(0, 44).concat([origin]);
        const relevant = usable.filter(a => ['attack', 'physical', 'magic', 'sword', 'sworddrain', 'swordbreak', 'drain', 'jump', 'percent', 'missing', 'targetMissing', 'heal', 'revive', 'chakra', 'status', 'golem', 'selfdestruct', 'fixed'].includes(a.kind)).slice(0, 28);
        for (const p of positions) {
            u.x = p.x;
            u.z = p.z;
            const threat = foes.reduce((sum, v) => sum + (distance(v, p) < 3 ? 1 : 0), 0), travel = distance(p, origin) * .15;
            for (const a of relevant) {
                const friendly = a.friendly || ['heal', 'revive', 'chakra', 'mp', 'golem', 'cleanse'].includes(a.kind), potential = a.range === 0 ? [u] : friendly ? friends : foes;
                for (const v of potential) {
                    if (!this.inRange(u, a, v))
                        continue;
                    if (a.kind === 'revive' && v.hp > 0)
                        continue;
                    let value = 0;
                    for (const t of this.targets(u, a, v)) {
                        const pr = this.preview(u, a, t), ally = team(t) === team(u);
                        if (a.kind === 'revive')
                            value += ally && t.hp <= 0 ? stats(t).hp * .9 : 0;
                        else if (['heal', 'chakra'].includes(a.kind)) {
                            if (ally && t.hp > 0)
                                value += Math.min(stats(t).hp - t.hp, Math.abs(pr.value)) * 1.35 + (t.protected && t.hp < stats(t).hp * .5 ? 30 : 0);
                            else if (has(t, 'Undead') && !ally)
                                value += Math.min(t.hp, Math.abs(pr.value));
                        }
                        else if (a.kind === 'status') {
                            const statuses = a.status || [], pos = statuses.some((s) => POSITIVE.includes(s));
                            if (ally === pos && !statuses.every((s) => has(t, s)) && !t.boss)
                                value += pos ? 12 : 22;
                            else
                                value -= 20;
                        }
                        else if (a.kind === 'golem') {
                            if (ally && !t.golem)
                                value += 18;
                        }
                        else {
                            let dmg = Math.min(Math.max(0, pr.value), t.hp);
                            value += (ally ? -1.5 : 1) * dmg * pr.hit / 100;
                            if (!ally && pr.value >= t.hp)
                                value += 40;
                            if (ally && t.protected)
                                value -= dmg * 2;
                        }
                    }
                    if (a.kind === 'selfdestruct')
                        value -= u.hp * .85;
                    const score = value - (a.mp || 0) * .12 - (a.charge || 0) * .45 - travel - threat * (u.hp < stats(u).hp * .4 ? 5 : .3);
                    if (score > best.score && value > 0)
                        best = { score, p: { ...p }, a, target: { x: v.x, z: v.z } };
                }
            }
        }
        u.x = origin.x;
        u.z = origin.z;
        let objective = null;
        if (u.name === 'Ramza' && this.mission.objective === 'switches')
            objective = this.tiles.filter(t => t.feature === 'switch' && !this.switches.includes(t.x + ',' + t.z)).sort((a, b) => distance(u, a) - distance(u, b))[0];
        if (u.name === 'Ramza' && this.mission.gate && this.tiles.some(t => t.feature === 'gate'))
            objective = this.tiles.find(t => t.feature === 'lever') || null;
        if (!foes.length && this.mission.objective === 'exit' && !this.exitFound)
            objective = this.tiles.find(t => t.feature === 'exit') || null;
        if (this.mission.id === 'blade' && !this.treasuresFound.includes('Materia Blade') && !foes.length)
            objective = this.tiles.find(t => t.feature === 'relic') || null;
        if (objective) {
            const field = this.distanceField(u, objective), p = positions.sort((a, b) => (field.get(a.x + ',' + a.z) ?? 999) - (field.get(b.x + ',' + b.z) ?? 999))[0];
            return { p, a: null, target: null, score: 1 };
        }
        if (u.protected && foes.length) {
            const escorts = friends.filter(v => v.id !== u.id && !v.guest && isActive(v));
            if (escorts.length) {
                const danger = (p) => foes.reduce((s, v) => s + Math.max(0, 6 - distance(v, p)) * (v.mp > 10 ? 2 : 1), 0), guardDistance = (p) => Math.min(...escorts.map(v => distance(v, p)));
                const safe = positions.slice().sort((a, b) => (danger(a) * 4 + guardDistance(a)) - (danger(b) * 4 + guardDistance(b)))[0];
                if (best.score <= 0 || danger(best.p) > danger(safe) + 1)
                    return { p: safe, a: null, target: null, score: 1 };
            }
        }
        if (best.score > 0)
            return best;
        const target = foes.sort((a, b) => distance(u, a) - distance(u, b))[0];
        if (!target)
            return { p: origin, a: null, target: null };
        const field = this.distanceField(u, target), p = positions.sort((a, b) => (field.get(a.x + ',' + a.z) ?? 999) - (field.get(b.x + ',' + b.z) ?? 999) || this.tile(b.x, b.z).h - this.tile(a.x, a.z).h)[0];
        return { p, a: null, target: null };
    }
    aiTurn() {
        const u = this.active();
        if (!u || this.phase !== 'turn')
            return;
        const plan = this.aiPlan(u);
        if (plan.p && distance(plan.p, u) > 0)
            this.move(u, plan.p.x, plan.p.z);
        if (this.phase !== 'turn')
            return;
        if (plan.a && isActive(u))
            this.execute(u, plan.a, plan.target, true);
        if (!u.acted && !has(u, 'Dont Act') && !u.casting && !plan.retreat && !has(u, 'Confuse')) {
            const t = this.units.filter(v => isActive(v) && team(v) !== team(u)).sort((a, b) => distance(a, u) - distance(b, u))[0];
            if (t && this.inRange(u, DB.skills.Attack, t))
                this.execute(u, DB.skills.Attack, t, true);
            else if (this.skillList(u).includes('Accumulate'))
                this.execute(u, DB.skills.Accumulate, u);
            else
                u.guard = true;
        }
        this.end();
    }
    serialize() {
        const out = {};
        for (const k of ['mission', 'w', 'h', 'tiles', 'props', 'units', 'inventory', 'poach', 'gil', 'clock', 'casts', 'phase', 'activeId', 'log', 'switches', 'exitFound', 'treasuresFound', 'groundLoot', 'paid', 'pendingLoot', 'turn', 'playerTurns', 'banterIndex', 'lastBanterTurn'])
            out[k] = clone(this[k]);
        out.rng = this.rng.state;
        return out;
    }
    static restore(game, d) {
        validateSavedBattle(d);
        const b = Object.create(Battle.prototype);
        Object.assign(b, d);
        b.game = game;
        b.rng = new RNG(d.rng);
        b.events = [];
        return b;
    }
}
// All imported data is checked before the live session is replaced.
// Limits protect the renderer and simulation. They are not an anti-cheat system.
function normalizeOptions(raw = {}) {
    const out = { volume: .45, muted: false, speed: 1, quality: 'high', difficulty: 'standard', permadeath: false, music: true, showGrid: true, reduceMotion: false };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return out;
    for (const key of ['muted', 'permadeath', 'music', 'showGrid', 'reduceMotion'])
        if (typeof raw[key] === 'boolean')
            out[key] = raw[key];
    if (typeof raw.volume === 'number' && Number.isFinite(raw.volume))
        out.volume = clamp(raw.volume, 0, 1);
    if ([1, 1.5, 2, 3].includes(raw.speed))
        out.speed = raw.speed;
    if (['high', 'low'].includes(raw.quality))
        out.quality = raw.quality;
    if (['story', 'standard', 'tactician'].includes(raw.difficulty))
        out.difficulty = raw.difficulty;
    return out;
}
function saveAssert(ok, message) { if (!ok)
    throw new Error('Invalid save: ' + message + '.'); }
function saveRecord(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function saveNumber(v, min = 0, max = 100000000, integer = false) { return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v)); }
function saveText(v, max = 500) { return typeof v === 'string' && v.length <= max; }
function validateSaveTree(value) {
    let count = 0;
    const walk = (v, depth) => {
        saveAssert(++count < 180000 && depth < 28, 'data is too complex');
        if (typeof v === 'number')
            saveAssert(Number.isFinite(v), 'non-finite value');
        if (v && typeof v === 'object')
            for (const [key, child] of Object.entries(v)) {
                saveAssert(!['__proto__', 'prototype', 'constructor'].includes(key), 'unsafe data key');
                walk(child, depth + 1);
            }
    };
    walk(value, 0);
}
function validateInventory(inv) {
    saveAssert(saveRecord(inv), 'inventory is missing');
    for (const [n, v] of Object.entries(inv))
        saveAssert(Object.prototype.hasOwnProperty.call(DB.items, n) && saveNumber(v, 0, 1000000, true), 'item count for ' + n);
}
function validateSavedUnit(u, width, height) {
    saveAssert(saveRecord(u) && saveText(u.id, 100) && u.id.length && saveText(u.name, 100) && u.name.trim(), 'unit identity');
    saveAssert(Object.prototype.hasOwnProperty.call(DB.jobs, u.job) && (!u.native || !!DB.jobs[u.native]), 'unit job');
    saveAssert(saveNumber(u.level, 1, 99, true) && saveNumber(u.exp, 0, 1000000, true), 'unit level or experience');
    saveAssert(['M', 'F'].includes(u.sex) && saveNumber(u.brave, 0, 100) && saveNumber(u.faith, 0, 100) && saveNumber(u.sign, 0, 11, true), 'unit traits');
    for (const k of ['hp', 'mp', 'ct'])
        saveAssert(saveNumber(u[k]), 'unit ' + k);
    saveAssert([0, 1].includes(u.team) && saveNumber(u.dir, 0, 3, true) && saveNumber(u.down, 0, 3, true), 'unit team, direction or countdown');
    for (const k of ['x', 'z'])
        saveAssert(saveNumber(u[k], 0, 39, true), 'unit coordinate');
    if (width && height)
        saveAssert(u.x < width && u.z < height, 'unit outside battlefield');
    saveAssert(saveRecord(u.equip) && Object.entries(u.equip).every(([slot, n]) => ['weapon', 'shield', 'head', 'body', 'accessory'].includes(slot) && typeof n === 'string' && DB.items[n] && (DB.items[n].slot === slot || slot === 'shield' && DB.items[n].slot === 'weapon')), 'unit equipment');
    saveAssert(Array.isArray(u.learned) && u.learned.length <= 600 && u.learned.every((n) => typeof n === 'string' && DB.skills[n]), 'learned abilities');
    saveAssert(!u.secondary || !!DB.jobs[u.secondary], 'secondary job');
    for (const slot of ['reaction', 'support', 'movement'])
        saveAssert(!u[slot] || DB.skills[u[slot]]?.passive === slot, 'equipped ' + slot);
    for (const k of ['jp', 'totalJP']) {
        saveAssert(saveRecord(u[k]), 'job point records');
        for (const [j, n] of Object.entries(u[k]))
            saveAssert(DB.jobs[j] && saveNumber(n, 0, 100000000, true), 'job point value');
    }
    saveAssert(saveRecord(u.status) && Object.entries(u.status).every(([n, ticks]) => [...POSITIVE, ...NEGATIVE].includes(n) && saveNumber(ticks, 1, 9999, true)), 'status effects');
    saveAssert(saveRecord(u.mod) && Object.entries(u.mod).every(([n, v]) => ['pa', 'ma', 'speed'].includes(n) && saveNumber(v, -10000, 10000)), 'battle modifiers');
    for (const k of ['hpOverride', 'mult', 'golem'])
        if (u[k] !== undefined)
            saveAssert(saveNumber(u[k], 0, 10000000), 'unit override');
    if (u.extra !== undefined)
        saveAssert(Array.isArray(u.extra) && u.extra.length <= 600 && u.extra.every((n) => typeof n === 'string' && DB.skills[n]), 'extra abilities');
    for (const k of ['moved', 'acted', 'removed', 'guest', 'unique', 'dead', 'away', 'airborne', 'boss', 'leader', 'protected', 'recruited', 'guard'])
        if (u[k] !== undefined)
            saveAssert(typeof u[k] === 'boolean', 'unit ' + k);
    for (const k of ['casting', 'channel'])
        if (u[k])
            saveAssert(saveText(u[k], 100) && !!DB.skills[u[k]], 'unit ' + k);
    if (u.moveOrigin)
        saveAssert(saveNumber(u.moveOrigin.x, 0, (width || 40) - 1, true) && saveNumber(u.moveOrigin.z, 0, (height || 40) - 1, true) && (u.moveOrigin.dir === undefined || saveNumber(u.moveOrigin.dir, 0, 3, true)), 'undo position');
}
function validateSavedState(d) {
    validateSaveTree(d);
    const s = d?.state;
    saveAssert(saveRecord(s) && s.version === 1, 'not a compatible Lion’s Oath save');
    saveAssert(saveNumber(s.next, 0, DB.missions.length, true), 'story position');
    for (const k of ['gil', 'day', 'uid'])
        saveAssert(saveNumber(s[k], 0, 1000000000000, true), k);
    saveAssert(Array.isArray(s.roster) && s.roster.length >= 1 && s.roster.length <= 40, 'company size');
    const ids = new Set();
    for (const u of s.roster) {
        validateSavedUnit(u);
        saveAssert(!ids.has(u.id), 'duplicate unit id');
        ids.add(u.id);
    }
    saveAssert(s.roster.filter((u) => u.name === 'Ramza').length === 1, 'Ramza record');
    saveAssert(Array.isArray(s.party) && s.party.length <= 5 && new Set(s.party).size === s.party.length && s.party.every((id) => ids.has(id)), 'deployed company');
    validateInventory(s.inventory);
    validateInventory(s.poach);
    for (const k of ['completed', 'visited', 'doneProps', 'history'])
        saveAssert(Array.isArray(s[k]) && s[k].length <= 20000 && s[k].every((v) => saveText(v, 2000)), k);
    saveAssert(saveText(s.place, 100) && s.place.length, 'location');
    saveAssert(typeof s.ended === 'boolean' && (!s.ended || s.next === DB.missions.length), 'ending state');
    saveAssert(saveRecord(s.flags) && Object.values(s.flags).every(v => typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || saveText(v, 100)), 'story flags');
    saveAssert(saveRecord(s.stats) && ['wins', 'kills', 'casts', 'rescues'].every(k => saveNumber(s.stats[k], 0, 100000000, true)), 'campaign totals');
    saveAssert(Array.isArray(s.dispatch) && s.dispatch.length <= 95, 'assignments');
    const dispatched = new Set();
    for (const a of s.dispatch) {
        saveAssert(saveRecord(a) && DB.propositions.some((p) => p.id === a.pid) && Array.isArray(a.ids) && a.ids.length === 3 && new Set(a.ids).size === 3 && saveNumber(a.returnDay, 0, 100000000, true) && [1, 1.5].includes(a.bonus), 'assignment record');
        for (const id of a.ids) {
            saveAssert(ids.has(id) && !dispatched.has(id) && s.roster.find((u) => u.id === id)?.away, 'assigned companion');
            dispatched.add(id);
        }
    }
    saveAssert(Array.isArray(s.eggs) && s.eggs.length <= 20000, 'eggs');
    for (const e of s.eggs)
        saveAssert(saveRecord(e) && DB.monsters[e.job] && saveText(e.name, 100) && saveNumber(e.day, 0, 100000000, true) && typeof e.hatched === 'boolean' && (e.hatched || ids.has(e.parent)), 'egg record');
    saveAssert(Array.isArray(s.discoveries) && s.discoveries.length <= 500 && s.discoveries.every((v) => saveRecord(v) && saveText(v.name) && saveText(v.kind)), 'discoveries');
    if (s.pendingRecruits !== undefined)
        saveAssert(Array.isArray(s.pendingRecruits) && s.pendingRecruits.length <= 100 && s.pendingRecruits.every((v) => saveRecord(v) && saveText(v.name, 100) && DB.jobs[v.job]), 'waiting companions');
}
function validateSavedBattle(d) {
    saveAssert(saveRecord(d) && saveRecord(d.mission) && saveText(d.mission.id, 100) && saveText(d.mission.name, 200) && saveNumber(d.mission.level, 1, 99, true) && saveText(d.mission.theme, 50), 'battle mission');
    if (d.mission.area !== undefined)
        saveAssert(saveText(d.mission.area, 200), 'battle area');
    for (const k of ['intro', 'outro', 'banter'])
        if (d.mission[k] !== undefined) {
            const scene = d.mission[k];
            saveAssert(saveText(scene, 100000) || Array.isArray(scene) && scene.length <= 10000 && scene.every((l) => saveRecord(l) && saveText(l.text, 25000) && ['source', 'speaker', 'title'].every(f => l[f] === undefined || saveText(l[f], 500))), 'battle scene');
        }
    for (const k of ['paid', 'exitFound'])
        if (d[k] !== undefined)
            saveAssert(typeof d[k] === 'boolean', 'battle ' + k);
    for (const k of ['banterIndex', 'lastBanterTurn', 'playerTurns'])
        if (d[k] !== undefined)
            saveAssert(saveNumber(d[k], 0, 100000000, true), 'battle ' + k);
    const objective = d.mission.objective;
    saveAssert(['defeat', 'leader', 'wound', 'switches', 'exit'].includes(objective) || typeof objective === 'string' && objective.startsWith('protect:'), 'battle objective');
    saveAssert(saveNumber(d.w, 1, 40, true) && saveNumber(d.h, 1, 40, true) && Array.isArray(d.tiles) && d.tiles.length === d.w * d.h, 'battlefield size');
    const terrain = ['grass', 'snow', 'sand', 'stone', 'brick', 'soil', 'carpet', 'wood', 'roof', 'water', 'swamp', 'lava'];
    for (let i = 0; i < d.tiles.length; i++) {
        const t = d.tiles[i];
        saveAssert(saveRecord(t) && t.x === i % d.w && t.z === Math.floor(i / d.w) && saveNumber(t.h, -10, 50) && terrain.includes(t.t) && typeof t.block === 'boolean' && (!t.treasure || DB.items[t.treasure]), 'battle tile');
    }
    saveAssert(Array.isArray(d.units) && d.units.length >= 1 && d.units.length <= 100, 'battle units');
    const ids = new Set();
    for (const u of d.units) {
        validateSavedUnit(u, d.w, d.h);
        saveAssert(!ids.has(u.id), 'duplicate battle unit');
        ids.add(u.id);
    }
    saveAssert(['deploy', 'turn', 'won', 'lost'].includes(d.phase) && saveText(d.activeId, 100) && (!d.activeId || ids.has(d.activeId)), 'active turn');
    for (const k of ['gil', 'clock', 'turn', 'rng'])
        saveAssert(saveNumber(d[k], 0, k === 'rng' ? 4294967295 : 100000000, true), 'battle ' + k);
    validateInventory(d.inventory);
    validateInventory(d.poach);
    saveAssert(Array.isArray(d.props) && d.props.length <= 500 && d.props.every((v) => saveRecord(v) && saveText(v.kind, 50) && saveNumber(v.x, -5, 45) && saveNumber(v.z, -5, 45) && saveNumber(v.h, -10, 50)), 'battle scenery');
    saveAssert(Array.isArray(d.casts) && d.casts.length <= 100, 'cast queue');
    for (const c of d.casts) {
        saveAssert(saveRecord(c) && ids.has(c.caster) && (!c.lock || ids.has(c.lock)) && saveNumber(c.due, 0, 100000000, true) && saveRecord(c.point) && saveNumber(c.point.x, 0, d.w - 1, true) && saveNumber(c.point.z, 0, d.h - 1, true) && saveRecord(c.skill) && DB.skills[c.skill.name], 'queued spell');
        const original = DB.skills[c.skill.name];
        saveAssert([...new Set([...Object.keys(c.skill), ...Object.keys(original)])].every(k => JSON.stringify(c.skill[k]) === JSON.stringify(original[k])), 'queued spell data');
        saveAssert(c.repeat === undefined || typeof c.repeat === 'boolean', 'repeating spell');
    }
    for (const k of ['log', 'switches', 'treasuresFound'])
        saveAssert(Array.isArray(d[k]) && d[k].length <= 10000 && d[k].every((v) => saveText(v, 2000)), 'battle ' + k);
    saveAssert(Array.isArray(d.groundLoot) && d.groundLoot.length <= 100, 'ground loot');
    for (const l of d.groundLoot)
        saveAssert(saveRecord(l) && saveNumber(l.x, 0, d.w - 1, true) && saveNumber(l.z, 0, d.h - 1, true) && ['crystal', 'chest'].includes(l.type) && (!l.item || DB.items[l.item]) && (!l.skill || DB.skills[l.skill]), 'loot record');
    saveAssert(!d.pendingLoot || saveRecord(d.pendingLoot) && ids.has(d.pendingLoot.unit) && DB.skills[d.pendingLoot.skill], 'crystal choice');
}
globalThis.OathCore = { GameModel, Battle, get DB() { return DB; }, stats, makeUnit, generateMap, unlocked, jobLevel, canEquip, item, has, isActive, team, passive, clone, hash, normalizeOptions, validateSavedState, validateSavedBattle };
/** Original low-poly artwork. Built as three.js r186 objects, baked into vertex-coloured meshes and drawn by the kit's WebGPU renderer (WebGL2 fallback). */
const rgb = (c) => {
    if (typeof c === 'number')
        return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
    return rgb(parseInt(String(c).replace('#', ''), 16));
};
const shade = (c, k) => '#' + rgb(c).map(v => Math.round(clamp(v * k, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
// Shape definitions: a flat vertex list and a triangle list. Parts are transformed and merged by bake().
const geocache = {};
function geom(key, vs, fs) {
    if (geocache[key])
        return geocache[key];
    return geocache[key] = { v: vs.flat(), f: fs.flat() };
}
function boxGeom() { return geom('box', [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]], [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5], [3, 7, 6], [3, 6, 2], [0, 1, 5], [0, 5, 4]]); }
function coneGeom(n = 6, top = 0) {
    const v = [], f = [];
    for (const y of [0, 1])
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2, r = y ? top : .5;
            v.push([Math.cos(a) * r, y - .5, Math.sin(a) * r]);
        }
    v.push([0, -.5, 0], [0, .5, 0]);
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        f.push([i, n + j, j], [i, n + i, n + j], [2 * n, i, j], [2 * n + 1, n + j, n + i]);
    }
    return geom('cone' + n + ':' + top, v, f);
}
function octGeom() { return geom('oct', [[0, .5, 0], [.5, 0, 0], [0, 0, .5], [-.5, 0, 0], [0, 0, -.5], [0, -.5, 0]], [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]]); }
// A part is an Object3D carrying a shape and a colour; callers may still set its rotation before baking.
function mesh(p, g, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Object3D(); m.userData.geo = g; m.userData.color = c; m.position.set(x, y, z); m.scale.set(sx, sy, sz); p.add(m); return m; }
function box(p, c, x, y, z, sx, sy, sz) { return mesh(p, boxGeom(), c, x, y, z, sx, sy, sz); }
function cone(p, c, x, y, z, sx, sy, sz, n = 6, top = 0) { return mesh(p, coneGeom(n, top), c, x, y, z, sx, sy, sz); }
function gem(p, c, x, y, z, sx, sy, sz) { return mesh(p, octGeom(), c, x, y, z, sx, sy, sz); }
// The original shader, in TSL: a fixed warm key light, a sky/ground ambient and an optional night tint.
// Colours are used as stored (the original never converted to sRGB), so colour management is off.
const NIGHT = uniform(0);
function litMaterial(params = {}) {
    const m = new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.DoubleSide, ...params });
    const n = normalize(varying(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz));
    const diff = dot(n, vec3(-0.6, 1, 0.45).normalize()).max(0);
    const ambient = mix(vec3(0.32, 0.39, 0.42), vec3(0.73, 0.8, 0.79), n.y.mul(0.5).add(0.5));
    const light = ambient.mul(0.78).add(vec3(1.08, 0.96, 0.77).mul(diff.mul(0.68)));
    m.colorNode = vec4(mix(light, light.mul(vec3(0.77, 0.84, 1)), NIGHT), 1);
    return m;
}
let LIT = null, MARKER_MAT = null;
function materials() {
    LIT ??= litMaterial();
    MARKER_MAT ??= litMaterial({ transparent: true, opacity: 0.9, depthWrite: false });
}
/** Merge every part under root into one mesh: flat face normals, one vertex colour per part. */
function bake(root, material = LIT) {
    root.updateMatrixWorld(true);
    const pos = [], nor = [], col = [], tv = [];
    const put = (k, nx, ny, nz, c) => {
        pos.push(tv[k], tv[k + 1], tv[k + 2]);
        nor.push(nx, ny, nz);
        col.push(c[0], c[1], c[2]);
    };
    root.traverse((o) => {
        const g = o.userData.geo;
        if (!g)
            return;
        const e = o.matrixWorld.elements, c = rgb(o.userData.color), v = g.v, f = g.f;
        tv.length = 0;
        for (let i = 0; i < v.length; i += 3) {
            const x = v[i], y = v[i + 1], z = v[i + 2];
            tv.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        }
        for (let i = 0; i < f.length; i += 3) {
            const a = f[i] * 3, b = f[i + 1] * 3, d = f[i + 2] * 3;
            // Same face normal as the original renderer: (C - B) × (A - B), after the transform.
            const cbx = tv[d] - tv[b], cby = tv[d + 1] - tv[b + 1], cbz = tv[d + 2] - tv[b + 2];
            const abx = tv[a] - tv[b], aby = tv[a + 1] - tv[b + 1], abz = tv[a + 2] - tv[b + 2];
            let nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
            const len = Math.hypot(nx, ny, nz);
            if (len < 1e-12)
                continue; // zero-area triangle (a cone's tip)
            nx /= len;
            ny /= len;
            nz /= len;
            put(a, nx, ny, nz, c);
            put(b, nx, ny, nz, c);
            put(d, nx, ny, nz, c);
        }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, material);
}
function disposeTree(o) {
    o.traverse((m) => m.geometry?.dispose());
}
/** What a figure's model depends on: a change rebuilds it (morph, recruitment, stolen or swapped gear). */
function figureKey(u) { return u.job + '|' + u.team + '|' + (u.guest ? 1 : 0) + '|' + (u.equip?.weapon || '') + '|' + (u.equip?.shield || ''); }
const TERRAIN = { grass: '#809476', snow: '#d8e4de', sand: '#d2b77e', stone: '#b7b7a2', brick: '#969d94', soil: '#95866b', carpet: '#795f70', wood: '#a58a66', roof: '#92806f', water: '#477e8b', swamp: '#677e64', lava: '#c86b45' };
const NIGHT_THEMES = ['rainTown', 'crypt', 'dungeon', 'demonHall'];
const _pv = new THREE.Vector3();
const _quad = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
const _hp = { x: 0, y: 0, z: 0 }, _fp = { x: 0, y: 0, z: 0 };
class BattleView {
    constructor(kit, hud) {
        this.kit = kit;
        this.renderer = kit.renderer;
        this.units = {};
        this.tiles = [];
        this.props = [];
        this.b = null;
        this.W = 12;
        this.H = 11;
        this.theme = 'abbey';
        this.width = 1;
        this.height = 1;
        this.dpr = 1;
        this.reduceMotion = false;
        this.angle = Math.PI / 4;
        this.desiredAngle = Math.PI / 4;
        this.zoom = 1;
        this.targetZoom = 1;
        this.viewSize = 13;
        this.focusX = 5.5;
        this.focusZ = 5;
        this.follow = null;
        this.tileHighlights = {};
        this.target = null;
        this.cursor = null;
        this.time = 0;
        this.anim = [];
        this.pop = [];
        this.effects = [];
        this.rebuild = [];
        this.dirty = true;
        this.rainCount = 40;
        this.hud = hud;
        this.ctx = hud.getContext('2d');
        materials();
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
        this.terrain = null;
        kit.onResize((w, h) => this.resize(w, h));
        kit.onQuality(() => this.resize());
    }
    resize(w = this.kit.size.width, h = this.kit.size.height) {
        this.width = Math.max(1, w);
        this.height = Math.max(1, h);
        // The 2D overlay follows the tier's pixel-ratio cap (it does not need dynamic resolution).
        this.dpr = Math.min(devicePixelRatio || 1, this.kit.tier.pixelRatio);
        this.rainCount = this.kit.detail(40, 12);
        this.hud.width = Math.round(this.width * this.dpr);
        this.hud.height = Math.round(this.height * this.dpr);
        this.hud.style.width = this.width + 'px';
        this.hud.style.height = this.height + 'px';
        this.updateCamera();
        this.dirty = true;
    }
    updateCamera() {
        // The field fills the window; in battle the top bar and command dock lie over it,
        // so the board is framed in the band between them.
        const top = screenName === 'battle' ? $('.battle-top')?.offsetHeight || 0 : 0;
        const bottom = screenName === 'battle' ? $('.battle-dock')?.offsetHeight || 0 : 0;
        const band = Math.max(1, this.height - top - bottom);
        const aspect = this.width / this.height, cam = this.camera;
        const fit = Math.max(this.H * 1.18, (this.W + this.H) * .71 / Math.max(.35, this.width / band)) / this.zoom;
        const full = this.viewSize = fit * this.height / band, shift = (top - bottom) / 2 * fit / band;
        const x = this.focusX, z = this.focusZ;
        cam.position.set(x + Math.sin(this.angle) * 26, 23, z + Math.cos(this.angle) * 26);
        cam.lookAt(x, 1, z);
        cam.left = -full * aspect / 2;
        cam.right = full * aspect / 2;
        cam.top = full / 2 + shift;
        cam.bottom = -full / 2 + shift;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
    }
    /** Where the camera should look when zoomed in: a unit (tracked while it walks) or a tile. */
    followUnit(id) { this.follow = id ? { id } : null; }
    followTile(x, z) { this.follow = { x, z }; }
    followPoint() {
        const f = this.follow;
        if (!f)
            return null;
        if (f.id) {
            const o = this.units[f.id];
            return o && !o.u.removed ? o.root.position : null;
        }
        return f;
    }
    clearScene() {
        disposeTree(this.scene);
        this.scene = new THREE.Scene();
    }
    setBattle(b) {
        this.b = b;
        this.clearScene();
        const demo = b || { ...generateMap({ id: 'title', name: 'The Lion’s Oath', theme: 'abbey' }), units: [makeUnit('Ramza', 'Squire', 8, 0, 1), makeUnit('Agrias', 'Holy Knight', 10, 0, 2), makeUnit('Mira', 'Priest', 8, 0, 3), makeUnit('Knight', 'Knight', 9, 1, 4), makeUnit('Archer', 'Archer', 8, 1, 5)], mission: { theme: 'abbey' } };
        this.W = demo.w;
        this.H = demo.h;
        this.tiles = demo.tiles;
        this.props = demo.props;
        this.theme = demo.mission.theme;
        this.units = {};
        this.anim = [];
        this.pop = [];
        this.effects = [];
        this.rebuild = [];
        this.tileHighlights = {};
        this.target = null;
        this.cursor = null;
        this.follow = null;
        const root = new THREE.Object3D();
        for (const t of this.tiles) {
            const rng = new RNG(hash(t.x + ':' + t.z + this.theme)), col = shade(TERRAIN[t.t] || TERRAIN.grass, .95 + rng.next() * .10), top = t.h * .55;
            box(root, shade(col, .67), t.x, (top - 1) / 2, t.z, .985, top + 1, .985);
            box(root, col, t.x, top + .026, t.z, .977, .052, .977);
            if (!t.block && ['stone', 'brick'].includes(t.t)) {
                box(root, shade(col, .87), t.x - .20, top + .058, t.z, .012, .006, .86);
                box(root, shade(col, .87), t.x + .28, top + .058, t.z + .1, .42, .006, .012);
            }
            else if (!t.block && t.t === 'grass' && rng.next() < .15) {
                for (let i = 0; i < 2; i++)
                    cone(root, shade(col, .76), t.x + (rng.next() - .5) * .65, top + .1, t.z + (rng.next() - .5) * .65, .035, .16, .035, 3);
            }
            if (['switch', 'lever'].includes(t.feature || '')) {
                box(root, '#766d5c', t.x, top + .13, t.z, .48, .24, .48);
                box(root, '#e2c981', t.x, top + .30, t.z, .11, .21, .11);
            }
        }
        for (const p of this.props)
            this.prop(root, p);
        this.terrain = bake(root);
        this.scene.add(this.terrain);
        if (!b)
            demo.units.forEach((u, i) => { u.x = [5, 4, 6, 7, 8][i]; u.z = [7, 7, 8, 3, 4][i]; u.dir = i < 3 ? 0 : 2; });
        for (const u of demo.units)
            this.addFigure(u);
        this.desiredAngle = this.angle = Math.PI / 4;
        this.zoom = this.targetZoom = 1;
        this.focusX = (this.W - 1) / 2;
        this.focusZ = (this.H - 1) / 2;
        NIGHT.value = NIGHT_THEMES.includes(this.theme) ? .25 : 0;
        this.resize();
    }
    prop(p, a) {
        const x = a.x, z = a.z, y = (a.h || 0) * .55, sx = a.sx || 1, sz = a.sz || 1, k = a.kind, stone = '#bab8a3', edge = '#d2c9ac';
        if (k === 'stands') {
            // The Proving Ring's north stands: three stone tiers packed with a low-poly crowd.
            const r = new RNG(hash('stands:' + x + ':' + sx)), crowd = ['#8d6656', '#6b8592', '#b3a47b', '#84998b', '#9c6355', '#7b8382', '#c8b27d', '#675ea0'];
            for (let i = 0; i < 3; i++) {
                const h = .42 * (i + 1), zz = z - .2 - i * .5, topY = y + h;
                box(p, i % 2 ? edge : stone, x, (topY - 1) / 2, zz, sx, topY + 1, .5);
                for (let xx = x - sx / 2 + .35; xx < x + sx / 2 - .2; xx += .55) {
                    if (r.next() < .28)
                        continue;
                    const ox = (r.next() - .5) * .12, col = crowd[r.int(crowd.length)];
                    box(p, col, xx + ox, topY + .14, zz, .24, .28, .2);
                    box(p, '#e4c3a2', xx + ox, topY + .36, zz, .15, .15, .15);
                    if (r.next() < .2)
                        box(p, shade(col, .8), xx + ox + .12, topY + .4, zz, .06, .3, .06).rotation.z = -.4;
                }
            }
            for (const s of [-1, 1]) {
                box(p, '#766148', x + s * (sx / 2 - .2), y + 1.6, z - 1.2, .09, 3.2, .09);
                box(p, s < 0 ? '#9c6355' : '#537b9b', x + s * (sx / 2 - .5), y + 2.9, z - 1.2, .55, .42, .04);
            }
            return;
        }
        if (k === 'banner') {
            const cloth = Math.round(z) % 2 ? '#9c6355' : '#537b9b', side = x < this.W / 2 ? 1 : -1;
            box(p, '#766148', x, y + 1.15, z, .1, 2.3, .1);
            box(p, cloth, x + side * .07, y + 1.6, z, .04, .95, .56);
            box(p, '#e3d397', x + side * .09, y + 1.6, z, .03, .12, .4);
            box(p, edge, x, y + 2.12, z, .08, .07, .66);
            gem(p, '#e2c981', x, y + 2.36, z, .16, .24, .16);
            return;
        }
        if (k === 'brazier') {
            cone(p, stone, x, y + .36, z, .46, .72, .46, 6, .65);
            cone(p, edge, x, y + .76, z, .74, .12, .74, 8, .8);
            gem(p, '#d9824f', x, y + 1.02, z, .5, .56, .5);
            gem(p, '#f3d491', x, y + 1.1, z, .26, .42, .26);
            return;
        }
        if (k === 'tree') {
            cone(p, '#71664f', x, y + .7, z, .20, 1.4, .23, 5, .12);
            for (let i = 0; i < 3; i++)
                cone(p, shade(this.theme === 'forest' ? '#66867b' : '#748f70', .94 + i * .07), x, y + 1.15 + i * .43, z, 1.42 - i * .27, 1.4 - i * .1, 1.42 - i * .27, 6);
            return;
        }
        if (k === 'rock') {
            gem(p, '#8b948a', x, y + .39, z, 1.15, .82, 1.05);
            return;
        }
        if (['house', 'chapel', 'windmill'].includes(k)) {
            const h = k === 'chapel' ? 2.25 : k === 'windmill' ? 2.5 : 1.65;
            box(p, stone, x, y + h / 2, z, sx, h, sz);
            box(p, edge, x, y + .13, z, sx + .13, .23, sz + .13);
            const roof = geom('gable', [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [0, .7, -.5], [0, .7, .5]], [[0, 4, 1], [3, 2, 5], [0, 3, 5], [0, 5, 4], [4, 5, 2], [4, 2, 1], [0, 1, 2], [0, 2, 3]]);
            mesh(p, roof, a.roof || '#7b8382', x, y + h, z, sx + .3, 1, sz + .34);
            box(p, edge, x, y + h + .71, z, .1, .09, sz + .4);
            for (let i = 0; i < Math.max(1, Math.floor(sx)); i++) {
                const xx = x - sx / 2 + .43 + i;
                box(p, '#4f5f5b', xx, y + .91, z + sz / 2 + .025, .30, .65, .04);
                box(p, '#d6b879', xx, y + .92, z + sz / 2 + .05, .24, .54, .03);
                box(p, edge, xx, y + .92, z + sz / 2 + .072, .04, .58, .024);
                box(p, edge, xx, y + .92, z + sz / 2 + .073, .27, .035, .023);
            }
            box(p, '#675746', x, y + .49, z - sz / 2 - .02, .49, .98, .04);
            box(p, '#d6c489', x + .16, y + .48, z - sz / 2 - .052, .045, .07, .028);
            if (k === 'chapel') {
                box(p, stone, x, y + h + 1, z - sz / 2 + .3, .77, 1.7, .77);
                cone(p, '#687c80', x, y + h + 2.07, z - sz / 2 + .3, 1, 1, 1, 4);
                box(p, edge, x, y + h + 2.90, z - sz / 2 + .3, .085, .65, .085);
                box(p, edge, x, y + h + 3.0, z - sz / 2 + .3, .39, .075, .075);
            }
            if (k === 'windmill') {
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2 + .3, m = box(p, '#d2c9a4', x - Math.sin(angle) * .78, y + 2 + Math.cos(angle) * .78, z + sz / 2 + .2, .22, 1.6, .08);
                    m.rotation.z = angle;
                }
            }
            return;
        }
        if (['tower', 'battlement', 'gate', 'arch', 'column'].includes(k)) {
            if (k === 'column') {
                cone(p, edge, x, y + .12, z, .7, .24, .7, 8, .5);
                cone(p, stone, x, y + 1.1, z, .44, 1.9, .44, 8, .5);
                box(p, edge, x, y + 2.12, z, .72, .22, .72);
                return;
            }
            if (k === 'gate' || k === 'arch') {
                for (const d of [-1, 1])
                    box(p, stone, x + d * sx * .37, y + 1.2, z, sx * .23, 2.4, sz);
                box(p, edge, x, y + 2.47, z, sx, .38, sz + .10);
                return;
            }
            const h = k === 'tower' ? 2.75 : 1.20;
            box(p, stone, x, y + h / 2, z, sx, h, sz);
            box(p, edge, x, y + h, z, sx + .15, .20, sz + .15);
            for (let i = 0; i < Math.ceil(sx * 1.3); i++) {
                const xx = x - sx / 2 + .21 + i * .7;
                for (const d of [-1, 1])
                    box(p, stone, xx, y + h + .3, z + d * (sz / 2 - .17), .36, .5, .34);
            }
            if (k === 'tower') {
                box(p, '#9c6355', x, y + 1.8, z + sz / 2 + .025, .37, .86, .035);
                box(p, '#d6c189', x, y + 1.8, z + sz / 2 + .05, .055, .48, .02);
            }
            return;
        }
        if (k === 'shelf' || k === 'bookshelf') {
            box(p, '#6b5b48', x, y + .9, z, sx, 1.8, sz);
            for (let j = 0; j < 4; j++) {
                box(p, '#aa906c', x, y + .2 + j * .42, z + sz / 2 + .026, sx, .06, .05);
                for (let i = 0; i < Math.floor(sx * 7); i++)
                    box(p, ['#84998b', '#8d6656', '#b3a47b', '#6b8592'][i % 4], x - sx / 2 + .1 + i * .14, y + .36 + j * .42, z + sz / 2 + .05, .10, .23 + (i % 2) * .065, .06);
            }
            return;
        }
        if (k === 'tomb') {
            box(p, '#92988c', x, y + .49, z, .65, .98, .23);
            box(p, edge, x, y + .64, z + .13, .075, .54, .03);
            box(p, edge, x, y + .73, z + .13, .34, .07, .03);
            return;
        }
        if (k === 'well') {
            cone(p, stone, x, y + .39, z, .86, .78, .86, 8, .5);
            cone(p, '#3b6671', x, y + .79, z, .64, .02, .64, 8, .5);
            return;
        }
        if (k === 'gallows') {
            box(p, '#937453', x, y + .13, z, sx, .26, sz);
            for (const d of [-.72, .72])
                box(p, '#766148', x + d, y + 1.21, z, .15, 2.4, .17);
            box(p, '#766148', x, y + 2.3, z, 1.8, .17, .20);
            box(p, '#d6c49d', x, y + 1.8, z, .027, .85, .027);
            return;
        }
        if (k === 'minepost') {
            for (const d of [-.35, .35])
                box(p, '#8b7456', x + d, y + .7, z, .15, 1.4, .16);
            box(p, '#b09770', x, y + 1.35, z, 1, .14, .18);
            return;
        }
        if (k === 'machine') {
            box(p, '#81948f', x, y + .6, z, sx, 1.2, sz);
            for (const d of [-.5, .5])
                cone(p, '#c0b59a', x + d, y + 1.5, z, .35, 1.6, .35, 8, .5);
            gem(p, '#88c6bd', x, y + 1.8, z, .45, .7, .45);
            return;
        }
        if (k === 'altar') {
            box(p, edge, x, y + .43, z, sx, .86, sz);
            box(p, '#8b6872', x, y + .9, z, sx + .1, .06, sz + .1);
            gem(p, '#ead48d', x, y + 1.17, z, .19, .45, .19);
            return;
        }
        box(p, stone, x, y + .4, z, sx, .8, sz);
    }
    addFigure(u) {
        const root = new THREE.Object3D(), raw = new THREE.Object3D(), teamColor = u.team === 1 ? '#ad695c' : u.guest ? '#aa9d69' : '#508fad', color = u.color || DB.jobs[u.job]?.color || teamColor;
        if (isMonster(u))
            this.monster(raw, u, teamColor);
        else
            this.human(raw, u, teamColor, color);
        const body = bake(raw);
        root.add(body);
        const ring = new THREE.Object3D();
        cone(ring, teamColor, 0, .02, 0, .70, .02, .70, 8, .5);
        const marker = bake(ring, MARKER_MAT);
        marker.renderOrder = 1;
        root.add(marker);
        this.scene.add(root);
        const old = this.units[u.id];
        this.units[u.id] = { root, body, marker, u, key: figureKey(u), swing: old?.swing || 0, hitAt: old?.hitAt || 0 };
        if (old) {
            body.rotation.y = old.body.rotation.y;
            root.position.copy(old.root.position);
        }
        return root;
    }
    human(p, u, teamColor, color) {
        const skin = '#e4c3a2', hair = u.name === 'Ramza' ? '#c9a773' : u.name === 'Agrias' ? '#dfc793' : ['#77644f', '#af9163', '#56504b'][hash(u.name) % 3], caster = ['Wizard', 'Priest', 'Oracle', 'Time Mage', 'Summoner', 'Mediator', 'Calculator', 'Heaven Knight', 'Hell Knight'].includes(u.job), heavy = ['Knight', 'Holy Knight', 'Holy Swordsman', 'Divine Knight', 'Dark Knight', 'Lancer', 'Samurai', 'Temple Knight'].includes(u.job);
        if (u.job === 'Lucavi') {
            const c = u.name.includes('Altima') ? '#ddd3b7' : u.name === 'Queklain' ? '#a3a276' : '#9c868b';
            gem(p, c, 0, .9, 0, 1.13, 1.55, .85);
            gem(p, shade(c, 1.15), 0, 1.84, -.1, .54, .6, .51);
            for (const s of [-1, 1]) {
                cone(p, shade(c, .73), s * .8, 1.50, .15, 1.5, 1.85, .18, 3).rotation.z = -s * .55;
                box(p, c, s * .55, .91, -.12, .26, .83, .30);
                cone(p, '#e1cf9f', s * .22, 2.27, 0, .14, .55, .15, 5);
                box(p, '#bf7072', s * .12, 1.89, -.37, .08, .065, .03);
            }
            gem(p, '#d4c888', 0, 1.1, -.44, .20, .38, .07);
            return;
        }
        if (u.job === 'Steel Giant') {
            box(p, '#879690', 0, .69, 0, .72, .85, .51);
            gem(p, '#cbb987', 0, 1.27, 0, .53, .52, .5);
            box(p, '#88d3c9', 0, 1.26, -.25, .31, .08, .025);
            for (const s of [-1, 1]) {
                box(p, '#879690', s * .25, .18, 0, .29, .35, .39);
                box(p, '#627b75', s * .52, .75, 0, .27, .65, .30);
                cone(p, '#c5b27d', s * .54, .43, -.08, .3, .28, .3, 6, .5);
            }
            return;
        }
        for (const s of [-1, 1]) {
            box(p, '#434f51', s * .125, .22, 0, .18, .43, .2);
            box(p, '#5f594c', s * .13, .06, -.065, .21, .13, .29);
        }
        const cloth = caster ? color : heavy ? '#b2c0b7' : color;
        cone(p, cloth, 0, .65, 0, .55, .73, .4, 4, .35);
        box(p, teamColor, 0, .72, -.205, .19, .49, .035);
        box(p, '#675f4d', 0, .43, 0, .53, .075, .38);
        box(p, '#d8c389', 0, .43, -.207, .10, .10, .035);
        cone(p, teamColor, 0, .62, .21, .61, .83, .17, 4, .18).rotation.x = -.13;
        for (const s of [-1, 1]) {
            box(p, cloth, s * .32, .73, 0, .18, .44, .23).rotation.z = s * .13;
            if (heavy)
                gem(p, '#c6d0c1', s * .32, .96, 0, .34, .27, .35);
            box(p, skin, s * .35, .46, -.02, .15, .18, .16);
        }
        box(p, skin, 0, 1.13, 0, .36, .36, .34);
        box(p, hair, 0, 1.33, .02, .39, .14, .37);
        box(p, hair, 0, 1.17, .15, .38, .3, .06);
        box(p, hair, -.18, 1.23, .02, .045, .18, .23);
        for (const s of [-1, 1])
            box(p, '#2f4850', s * .09, 1.15, -.179, .04, .048, .015);
        box(p, '#eed6b2', 0, 1.08, -.19, .05, .055, .03);
        if (caster) {
            if (u.job === 'Priest') {
                cone(p, '#e7e4d2', 0, 1.28, .03, .56, .45, .46, 5, .12);
                box(p, skin, 0, 1.14, -.22, .29, .27, .05);
                for (const s of [-1, 1])
                    box(p, '#415256', s * .07, 1.16, -.253, .04, .044, .012);
            }
            else {
                cone(p, '#cbb072', 0, 1.64, 0, .64, .65, .64, 7);
                cone(p, '#dcc58c', 0, 1.38, 0, .86, .075, .78, 8, .5);
            }
        }
        if (heavy && !['Agrias', 'Orlandu'].includes(u.name)) {
            cone(p, '#aebfb6', 0, 1.38, .02, .45, .25, .43, 6, .29);
            for (const s of [-1, 1])
                box(p, '#c8d0bd', s * .19, 1.17, .04, .075, .3, .3);
            box(p, teamColor, 0, 1.57, .05, .1, .24, .12);
        }
        if (u.job === 'Ninja') {
            box(p, color, 0, 1.29, -.16, .4, .09, .05);
            box(p, color, 0, 1.04, -.19, .38, .12, .05);
        }
        if (u.job === 'Monk') {
            box(p, '#d8c8a2', 0, 1.31, -.17, .4, .065, .04);
            return;
        }
        const weapon = item(u.equip.weapon), type = weapon.type;
        if (caster || ['Staff', 'Rod', 'Stick', 'Harp', 'Dictionary'].includes(type)) {
            box(p, '#907953', -.40, .84, -.1, .06, 1.3, .06);
            gem(p, u.job === 'Wizard' ? '#eac67f' : '#b1d8bc', -.40, 1.50, -.1, .18, .27, .18);
        }
        else if (['Bow', 'Crossbow'].includes(type)) {
            for (const s of [-1, 1])
                box(p, '#c5a773', -.44, .76 + s * .22, -.12, .055, .51, .065).rotation.x = s * .4;
            box(p, '#e6dbb1', -.44, .75, -.25, .015, .86, .015);
        }
        else if (type === 'Gun') {
            box(p, '#455354', -.41, .67, -.35, .1, .1, .67);
            box(p, '#9f7752', -.41, .62, -.05, .13, .17, .25);
        }
        else if (type === 'Spear') {
            box(p, '#aa8e61', -.44, .91, -.1, .055, 1.8, .055);
            gem(p, '#d3ded0', -.44, 1.9, -.1, .15, .40, .08);
        }
        else if (type || u.job === 'Squire') {
            const sword = new THREE.Object3D();
            sword.position.set(-.4, .45, -.13);
            sword.rotation.z = -.22;
            box(sword, '#c9d5cd', 0, .47, 0, .067, .88, .038);
            gem(sword, '#efe8d0', 0, .96, 0, .065, .15, .037);
            box(sword, '#dcc187', 0, .035, 0, .25, .06, .085);
            box(sword, '#6e5c4a', 0, -.08, 0, .067, .17, .067);
            p.add(sword);
        }
        if (u.equip.shield && item(u.equip.shield).slot === 'shield') {
            box(p, '#c8cbb2', .44, .67, -.05, .13, .65, .46);
            box(p, teamColor, .514, .68, -.05, .018, .47, .32);
            box(p, '#e3d397', .532, .68, -.05, .02, .075, .29);
        }
    }
    monster(p, u, c) {
        const d = DB.monsters[u.job] || {}, family = d.family, base = d.color || DB.jobs[u.job]?.color || '#91a783';
        if (u.job.includes('Chocobo')) {
            const col = u.job === 'Black Chocobo' ? '#626e8c' : u.job === 'Red Chocobo' ? '#c67b64' : '#ddc26f';
            gem(p, col, 0, .7, 0, .8, .94, .72);
            gem(p, col, 0, 1.13, -.30, .45, .61, .48);
            cone(p, '#d5a569', 0, 1.1, -.66, .23, .45, .24, 4).rotation.x = Math.PI / 2;
            for (const s of [-1, 1]) {
                box(p, '#ad8b50', s * .17, .21, -.05, .064, .4, .08);
                box(p, '#c3a463', s * .17, .044, -.17, .14, .075, .36);
                gem(p, shade(col, .87), s * .36, .66, .07, .25, .74, .52);
                box(p, '#2b4449', s * .14, 1.22, -.50, .055, .07, .024);
            }
            for (let i = 0; i < 3; i++)
                cone(p, col, (i - 1) * .1, 1.48, -.20, .11, .40, .14, 4);
            return;
        }
        if (['Dragon', 'Hydra'].includes(family) || /Dragon|Hyudra|Tiamat/.test(u.job)) {
            gem(p, base, 0, .54, .02, 1, .8, 1);
            for (const s of [-1, 1]) {
                cone(p, shade(base, .8), s * .47, .9, .2, .95, 1.1, .16, 3).rotation.z = -s * .6;
                box(p, base, s * .29, .17, -.18, .23, .30, .33);
            }
            for (let i = 0, n = family === 'Hydra' ? 3 : 1; i < n; i++) {
                const x = (i - (n - 1) / 2) * .30;
                cone(p, base, x, .95, -.33, .22, .84, .24, 6, .32);
                gem(p, shade(base, 1.13), x, 1.3, -.53, .36, .3, .53);
                for (const s of [-1, 1])
                    box(p, '#ead59b', x + s * .12, 1.34, -.72, .045, .05, .024);
            }
            cone(p, base, 0, .47, .7, .2, .80, .23, 5).rotation.x = 1.2;
            return;
        }
        if (family === 'Bomb') {
            gem(p, base, 0, .86, 0, 1.05, 1.03, 1.04);
            for (let i = 0; i < 5; i++)
                cone(p, i % 2 ? '#e7b574' : '#ce8050', Math.sin(i) * .22, 1.5 + Math.cos(i) * .15, Math.cos(i) * .22, .23, .66, .24, 4);
            for (const s of [-1, 1])
                box(p, '#f2d48e', s * .2, .89, -.46, .13, .12, .04);
            return;
        }
        if (family === 'Morbol' || /Morbol|Ochu/.test(u.job)) {
            gem(p, base, 0, .52, 0, 1.1, 1, 1);
            gem(p, '#435647', 0, .68, -.43, .81, .47, .27);
            for (let i = 0; i < 7; i++) {
                const a = i / 7 * 6.28;
                cone(p, shade(base, .8), Math.cos(a) * .46, .22, Math.sin(a) * .46, .16, .82, .16, 5).rotation.z = Math.sin(a) * .8;
                box(p, '#e0d6b1', (i - 3) * .1, .7, -.56, .045, .15, .04);
            }
            return;
        }
        if (family === 'Woodman') {
            cone(p, '#897b57', 0, .67, 0, .49, 1.25, .39, 6, .35);
            for (const s of [-1, 1])
                box(p, '#7b7858', s * .37, .85, 0, .62, .14, .14).rotation.z = s * .4;
            gem(p, base, 0, 1.43, 0, 1.2, 1, .83);
            return;
        }
        if (['Behemoth', 'Bull Demon', 'Pig', 'Panther'].includes(family)) {
            gem(p, base, 0, .55, 0, 1, .85, 1.2);
            gem(p, shade(base, 1.1), 0, .88, -.56, .68, .63, .59);
            for (const s of [-1, 1]) {
                for (const z of [-.3, .4])
                    box(p, shade(base, .8), s * .34, .21, z, .22, .39, .23);
                if (family !== 'Pig' && family !== 'Panther')
                    cone(p, '#ded0ac', s * .27, 1.24, -.55, .15, .55, .15, 5);
                box(p, '#ead292', s * .20, .94, -.84, .06, .06, .02);
            }
            return;
        }
        if (['Flotiball', 'Ahriman', 'Juravis'].includes(family)) {
            gem(p, base, 0, 1, 0, .95, .85, .8);
            gem(p, '#efdbb1', 0, 1, -.39, .45, .45, .13);
            gem(p, '#795565', 0, 1, -.46, .2, .31, .07);
            for (const s of [-1, 1])
                cone(p, shade(base, .8), s * .64, 1, .1, 1, .75, .14, 3).rotation.z = s * .7;
            return;
        }
        const col = family === 'Skeleton' ? '#ddd1b2' : base;
        for (const s of [-1, 1]) {
            box(p, col, s * .16, .26, 0, .12, .47, .16);
            box(p, col, s * .38, .75, 0, .15, .56, .17);
        }
        gem(p, col, 0, .77, 0, .69, .76, .46);
        gem(p, col, 0, 1.27, 0, .52, .51, .46);
        for (const s of [-1, 1]) {
            box(p, '#314748', s * .12, 1.28, -.21, .10, .11, .03);
            if (family !== 'Skeleton')
                cone(p, '#cebe91', s * .21, 1.59, .05, .14, .5, .15, 5);
        }
    }
    project(x, y, z, out = {}) {
        _pv.set(x, y, z).project(this.camera);
        out.x = (_pv.x + 1) * this.width / 2;
        out.y = (1 - _pv.y) * this.height / 2;
        out.z = _pv.z;
        return out;
    }
    tilePoint(t) { return this.project(t.x, t.h * .55 + .07, t.z); }
    pick(x, y) {
        const figures = Object.values(this.units).filter(o => !o.u.removed && !o.u.airborne).map(o => ({ u: o.u, p: this.project(o.root.position.x, o.root.position.y + .9, o.root.position.z) })).sort((a, b) => a.p.z - b.p.z);
        for (const o of figures)
            if (Math.hypot(x - o.p.x, y - o.p.y) < Math.max(10, this.height / this.viewSize * .20))
                return { x: o.u.x, z: o.u.z };
        const tiles = this.tiles.map(t => ({ t, p: this.tilePoint(t) })).sort((a, b) => a.p.z - b.p.z);
        for (const { t } of tiles) {
            const ps = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([dx, dz]) => this.project(t.x + dx, t.h * .55 + .07, t.z + dz));
            let inside = false;
            for (let i = 0, j = 3; i < 4; j = i++) {
                const a = ps[i], b = ps[j];
                if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)
                    inside = !inside;
            }
            if (inside)
                return { x: t.x, z: t.z };
        }
        return null;
    }
    events(events, speed = 1) {
        const now = performance.now();
        for (const e of events) {
            const o = e.id && this.units[e.id];
            if (e.type === 'move' && o && e.path?.length > 1) {
                this.anim = this.anim.filter(a => a.id !== e.id);
                this.anim.push({ id: e.id, path: e.path, start: now, duration: this.reduceMotion ? 1 : Math.max(180, e.path.length * 130) / speed });
            }
            if (e.type === 'action' && o)
                o.swing = now;
            if ((e.type === 'hit' || e.type === 'ko') && o)
                o.hitAt = now;
            if (['hit', 'heal', 'miss', 'status', 'level', 'revive', 'learn', 'mp', 'block', 'recruit'].includes(e.type) && o)
                this.pop.push({ id: e.id, start: now, text: e.value !== undefined ? (e.type === 'heal' || e.type === 'mp' && e.value > 0 ? '+' : '−') + Math.abs(e.value) : e.type === 'status' ? e.kind : e.type === 'level' ? 'LEVEL UP' : e.type.toUpperCase(), color: e.type === 'heal' ? '#c8e6b4' : e.type === 'hit' ? '#ffe0b4' : '#f3d79b' });
            if (e.type === 'action')
                this.effects.push({ x: e.x, z: e.z, kind: e.kind, start: now, duration: 650 / speed });
        }
    }
    /** One frame. `live` is false on the world map and ending, where the blurred field only redraws when it changed. */
    draw(now, dt, live = true) {
        // Dynamic resolution resizes (and so clears) the canvas: a still screen must redraw after that.
        const ratio = this.renderer.getPixelRatio();
        if (ratio !== this.pixelRatio) {
            this.pixelRatio = ratio;
            this.dirty = true;
        }
        if (document.hidden || (!live && !this.dirty))
            return;
        this.dirty = false;
        dt = Math.min(.06, dt);
        this.time = this.reduceMotion ? 0 : now / 1000;
        if (this.reduceMotion) {
            this.angle = this.desiredAngle;
            this.zoom = this.targetZoom;
        }
        this.angle += (this.desiredAngle - this.angle) * Math.min(1, dt * 10);
        this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8);
        // Zoomed in, the camera eases towards the unit or tile in play; at full view it frames the whole field.
        const cx = (this.W - 1) / 2, cz = (this.H - 1) / 2, k = clamp((this.zoom - 1) / .6, 0, 1), f = k > 0 ? this.followPoint() : null;
        const fx = f ? cx + (f.x - cx) * k : cx, fz = f ? cz + (f.z - cz) * k : cz, ease = this.reduceMotion ? 1 : Math.min(1, dt * 5);
        this.focusX += (fx - this.focusX) * ease;
        this.focusZ += (fz - this.focusZ) * ease;
        this.updateCamera();
        for (const id in this.units) {
            const o = this.units[id], u = o.u;
            if (o.key !== figureKey(u)) {
                this.rebuild.push(o);
                continue;
            }
            o.root.visible = !u.removed && !u.airborne;
            const tile = this.tiles[u.z * this.W + u.x];
            let x = u.x, z = u.z, y = (tile?.h || 0) * .55 + .075;
            const a = this.anim.find(a => a.id === u.id);
            if (a) {
                const t = clamp((now - a.start) / a.duration, 0, 1), v = t * (a.path.length - 1), i = Math.min(a.path.length - 2, Math.floor(v)), p = a.path[i], q = a.path[i + 1], fr = v - i;
                x = p.x + (q.x - p.x) * fr;
                z = p.z + (q.z - p.z) * fr;
                const yp = this.tiles[p.z * this.W + p.x]?.h || 0, yq = this.tiles[q.z * this.W + q.x]?.h || 0;
                y = (yp + (yq - yp) * fr) * .55 + .075 + Math.sin(fr * Math.PI) * .16;
                if (t >= 1)
                    this.anim = this.anim.filter(e => e !== a);
            }
            // A short recoil when struck.
            const since = now - (o.hitAt || 0);
            if (since < 280 && !this.reduceMotion) {
                const s = Math.sin(since / 280 * Math.PI * 5) * .075 * (1 - since / 280);
                x += s * Math.cos(this.angle);
                z -= s * Math.sin(this.angle);
            }
            o.body.rotation.z = u.hp <= 0 ? Math.PI * .49 : this.reduceMotion ? 0 : Math.sin(this.time * 2.2 + hash(u.id) % 6) * .015;
            const target = -u.dir * Math.PI / 2, turn = ((target - o.body.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            o.body.rotation.y += turn * Math.min(1, dt * 12);
            o.body.rotation.x = !this.reduceMotion && o.swing && now - o.swing < 360 ? -Math.sin((now - o.swing) / 360 * Math.PI) * .33 : 0;
            o.root.position.set(x, y + (u.hp <= 0 ? -.10 : 0), z);
            o.marker.visible = u.hp > 0;
        }
        if (this.rebuild.length) {
            for (const o of this.rebuild) {
                this.scene.remove(o.root);
                disposeTree(o.root);
                this.addFigure(o.u);
            }
            this.rebuild.length = 0;
            this.dirty = true;
        }
        this.renderer.render(this.scene, this.camera);
        this.drawHUD(now);
    }
    drawHUD(now) {
        const c = this.ctx;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, this.width, this.height);
        const poly = (t, fill, line, n = 1) => {
            const y = t.h * .55 + .08;
            this.project(t.x - .47, y, t.z - .47, _quad[0]);
            this.project(t.x + .47, y, t.z - .47, _quad[1]);
            this.project(t.x + .47, y, t.z + .47, _quad[2]);
            this.project(t.x - .47, y, t.z + .47, _quad[3]);
            c.beginPath();
            c.moveTo(_quad[0].x, _quad[0].y);
            c.lineTo(_quad[1].x, _quad[1].y);
            c.lineTo(_quad[2].x, _quad[2].y);
            c.lineTo(_quad[3].x, _quad[3].y);
            c.closePath();
            c.fillStyle = fill;
            c.fill();
            c.strokeStyle = line;
            c.lineWidth = n;
            c.stroke();
        };
        for (const key in this.tileHighlights) {
            const color = this.tileHighlights[key], i = key.indexOf(','), t = this.tiles[Number(key.slice(i + 1)) * this.W + Number(key.slice(0, i))];
            if (t)
                poly(t, color, color.includes('213') ? '#dfaa81' : '#a2d8d3');
        }
        if (this.target) {
            const t = this.tiles[this.target.z * this.W + this.target.x];
            if (t)
                poly(t, 'rgba(244,218,145,.23)', '#ffe299', 2.3);
        }
        if (this.cursor) {
            const t = this.tiles[this.cursor.z * this.W + this.cursor.x];
            if (t)
                poly(t, 'rgba(255,255,255,.07)', '#fff0c7', 1.7);
        }
        if (this.b)
            for (const t of this.tiles)
                if (['switch', 'lever', 'relic'].includes(t.feature || '') || t.feature === 'exit' && t.found) {
                    const p = this.project(t.x, t.h * .55 + .22, t.z, _hp);
                    c.font = 'bold 18px Georgia';
                    c.fillStyle = '#f3d491';
                    c.textAlign = 'center';
                    c.fillText(t.feature === 'switch' ? (t.found ? '✓' : '⚙') : t.feature === 'exit' ? '↓' : t.feature === 'relic' ? '✦' : '⚑', p.x, p.y - 4);
                }
        for (const id in this.units) {
            const o = this.units[id], u = o.u;
            if (u.removed || u.airborne)
                continue;
            const p = this.project(o.root.position.x, o.root.position.y + (u.job === 'Lucavi' ? 2.55 : 1.83), o.root.position.z, _hp), s = stats(u);
            c.textAlign = 'center';
            if (u.hp > 0) {
                const width = 32;
                c.fillStyle = '#112d37';
                c.fillRect(p.x - width / 2 - 1, p.y - 1, width + 2, 6);
                c.fillStyle = u.team === 1 ? '#eaa28a' : u.guest ? '#ead696' : '#afdccc';
                c.fillRect(p.x - width / 2, p.y, width * clamp(u.hp / s.hp, 0, 1), 4);
                if (u.id === this.b?.activeId) {
                    c.fillStyle = '#ffe09b';
                    const a = Math.sin(now / 230) * 2;
                    c.beginPath();
                    c.moveTo(p.x, p.y - 8 + a);
                    c.lineTo(p.x - 5, p.y - 16 + a);
                    c.lineTo(p.x + 5, p.y - 16 + a);
                    c.fill();
                }
                const tags = Object.keys(u.status).filter(t => t !== 'Undead');
                if (u.casting || tags.length) {
                    c.font = 'bold 10px system-ui';
                    c.fillStyle = '#f4deb0';
                    c.strokeStyle = '#1c3840';
                    c.lineWidth = 3;
                    const text = u.casting ? '◷ ' + u.casting : tags.slice(0, 2).join(' · ');
                    c.strokeText(text, p.x, p.y + 16);
                    c.fillText(text, p.x, p.y + 16);
                }
                const d = DIRECTIONS[u.dir], fp = this.project(u.x + d.x * .46, (this.tiles[u.z * this.W + u.x]?.h || 0) * .55 + .14, u.z + d.z * .46, _fp);
                c.fillStyle = '#f1e1b5';
                c.beginPath();
                c.arc(fp.x, fp.y, 2, 0, Math.PI * 2);
                c.fill();
            }
            else {
                c.font = 'bold 17px Georgia';
                c.fillStyle = '#f5cfae';
                c.fillText(String(u.down), p.x, p.y + 22);
            }
        }
        this.effects = this.effects.filter(a => now - a.start < a.duration);
        for (const a of this.effects) {
            const t = (now - a.start) / a.duration, p = this.project(a.x || 0, (this.tiles[(a.z || 0) * this.W + (a.x || 0)]?.h || 0) * .55 + .3, a.z || 0, _hp);
            c.globalAlpha = 1 - t;
            c.strokeStyle = ['attack', 'physical', 'sword', 'Fire'].includes(a.kind) ? '#ffd79e' : ['heal', 'cleanse', 'Holy'].includes(a.kind) ? '#e6f2b9' : '#b4e2e7';
            c.lineWidth = 2 + (1 - t) * 2;
            for (let k = 0; k < 2; k++) {
                c.beginPath();
                c.ellipse(p.x, p.y - t * 25, 8 + t * 35 + k * 7, 5 + t * 18 + k * 4, 0, 0, Math.PI * 2);
                c.stroke();
            }
            c.globalAlpha = 1;
        }
        this.pop = this.pop.filter(p => now - p.start < 1300);
        for (const p of this.pop) {
            const o = this.units[p.id];
            if (!o)
                continue;
            const s = this.project(o.root.position.x, o.root.position.y + 1.6, o.root.position.z, _hp), t = (now - p.start) / 1300;
            c.globalAlpha = Math.min(1, (1 - t) * 3);
            c.font = 'bold ' + (this.width < 600 ? '17' : '21') + 'px Georgia';
            c.textAlign = 'center';
            c.lineWidth = 4;
            c.strokeStyle = '#1e343b';
            c.strokeText(p.text, s.x, s.y - 27 - t * 32);
            c.fillStyle = p.color;
            c.fillText(p.text, s.x, s.y - 27 - t * 32);
            c.globalAlpha = 1;
        }
        if (this.theme === 'rainTown' && !this.reduceMotion) {
            c.strokeStyle = 'rgba(207,226,225,.22)';
            c.lineWidth = 1;
            c.beginPath();
            for (let i = 0; i < this.rainCount; i++) {
                const x = (i * 73 + now * .07) % this.width, y = (i * 137 + now * .4) % this.height;
                c.moveTo(x, y);
                c.lineTo(x - 3, y + 13);
            }
            c.stroke();
        }
    }
}
/** Original procedural score. No original recordings or samples are used. */
class OathAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicBus = null;
        this.timer = null;
        this.step = 0;
        this.mode = 'title';
        this.volume = .45;
        this.muted = false;
        this.music = true;
    }
    start() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.master = this.ctx.createGain();
                this.master.connect(this.ctx.destination);
                this.musicBus = this.ctx.createGain();
                this.musicBus.gain.value = .4;
                this.musicBus.connect(this.master);
                this.update();
                this.timer = setInterval(() => this.tick(), 270);
            }
            catch {
                return;
            }
        }
        if (this.ctx.state === 'suspended')
            this.ctx.resume().catch(() => { });
    }
    update() {
        if (this.master && this.ctx)
            this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * .45, this.ctx.currentTime, .05);
        if (this.musicBus && this.ctx)
            this.musicBus.gain.setTargetAtTime(this.music ? .4 : 0, this.ctx.currentTime, .05);
    }
    note(midi, duration, gain = .12, type = 'triangle', delay = 0, music = false) {
        if (!this.ctx || !this.master)
            return;
        const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(.001, gain), t + .025);
        g.gain.exponentialRampToValueAtTime(.0001, t + duration);
        o.connect(g);
        g.connect(music ? this.musicBus : this.master);
        o.onended = () => { o.disconnect(); g.disconnect(); };
        o.start(t);
        o.stop(t + duration + .03);
    }
    noise(duration = .10, gain = .08) {
        if (!this.ctx || !this.master)
            return;
        // One decaying noise burst per length, made once and reused.
        this.noiseCache ??= new Map();
        let b = this.noiseCache.get(duration);
        if (!b) {
            const n = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
            b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
            const a = b.getChannelData(0);
            for (let i = 0; i < n; i++)
                a[i] = (Math.random() * 2 - 1) * Math.exp(-i / n * 6);
            this.noiseCache.set(duration, b);
        }
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
        s.buffer = b;
        f.type = 'lowpass';
        f.frequency.value = 1700;
        g.gain.value = gain;
        s.connect(f);
        f.connect(g);
        g.connect(this.master);
        s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
        s.start();
    }
    /** The Proving Ring crowd: a band of noise that swells and fades. */
    crowd(gain = .07) {
        if (!this.ctx || !this.master || this.muted)
            return;
        if (!this.crowdBuffer) {
            const n = Math.floor(this.ctx.sampleRate * 1.4);
            this.crowdBuffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
            const a = this.crowdBuffer.getChannelData(0);
            for (let i = 0; i < n; i++)
                a[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / n), 1.5) * (.75 + .25 * Math.sin(i / n * 37));
        }
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = this.crowdBuffer;
        f.type = 'bandpass';
        f.frequency.value = 850;
        f.Q.value = .7;
        g.gain.value = gain;
        s.connect(f);
        f.connect(g);
        g.connect(this.master);
        s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
        s.start();
    }
    tick() {
        if (!this.ctx || this.ctx.state !== 'running' || !this.music || this.muted || document.hidden)
            return;
        const combat = this.mode === 'battle', root = [50, 46, 48, 45][Math.floor(this.step / 32) % 4], i = this.step % 32;
        if (i % 8 === 0) {
            for (const n of [root, root + 7, root + 12, root + 15])
                this.note(n, 2.8, .032, 'triangle', 0, true);
            this.note(root - 12, 2.6, .055, 'sine', 0, true);
        }
        if (i % 2 === 0) {
            const p = combat ? [0, 7, 12, 15, 14, 7, 10, 12, 7, 3, 7, 10, 12, 15, 19, 14] : [12, 7, 15, 14, 12, 7, 10, 7, 12, 19, 17, 15, 14, 10, 7, 3];
            this.note(root + p[Math.floor(i / 2)], combat ? .45 : .9, .032, 'triangle', 0, true);
        }
        if (combat && i % 4 === 0) {
            this.note(34, .18, .1, 'sine', 0, true);
            if (i % 8 === 4)
                this.note(70, .08, .015, 'triangle', 0, true);
        }
        this.step++;
    }
    sfx(n) {
        this.start();
        if (n === 'move') {
            this.noise(.035, .035);
            this.note(47, .07, .025);
        }
        else if (n === 'hit') {
            this.noise(.12, .12);
            this.note(37, .15, .08, 'sawtooth');
        }
        else if (['heal', 'revive'].includes(n)) {
            [72, 76, 79, 84].forEach((v, i) => this.note(v, .65, .05, 'sine', i * .06));
        }
        else if (['action', 'cast'].includes(n)) {
            this.note(63, .45, .05);
            this.note(75, .55, .04, 'sine', .08);
        }
        else if (n === 'victory') {
            [60, 64, 67, 72, 76, 79].forEach((v, i) => this.note(v, 1, .07, 'triangle', i * .14));
        }
        else if (n === 'defeat') {
            [55, 53, 50, 46].forEach((v, i) => this.note(v, 1.1, .07, 'triangle', i * .22));
        }
        else if (['treasure', 'learn', 'level', 'recruit'].includes(n)) {
            [79, 83, 86].forEach((v, i) => this.note(v, .45, .05, 'sine', i * .09));
        }
        else if (n === 'ko') {
            this.noise(.2, .1);
            [52, 45].forEach((v, i) => this.note(v, .4, .06, 'triangle', i * .13));
        }
        else
            this.note(n === 'cancel' ? 59 : 72, .065, .035, 'sine');
    }
}
/** Recovered game flow, rebuilt controls, persistent saves, and source scene playback. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ROMAN = ['', 'I', 'II', 'III', 'IV'], CHAPTERS = ['', 'The Meager', 'The Manipulator & the Subservient', 'The Valiant', 'Somebody to Love'];
const CREST = `<svg class="brand-mark" viewBox="0 0 90 105" fill="none" aria-hidden="true"><path d="M45 4L78 18V55C78 76 63 91 45 101C27 91 12 76 12 55V18L45 4Z" stroke="currentColor" stroke-width="1.4"/><path d="M45 11L71 23V55C71 72 60 85 45 94C30 85 19 72 19 55V23L45 11Z" stroke="currentColor" opacity=".45"/><path d="M40 26L51 26L61 34L63 47L55 54L58 67L51 77L45 72L37 80L34 68L28 65L31 55L26 47L30 34L40 26Z" fill="currentColor"/><path d="M40 35L36 43L42 50L40 59L47 66L52 61L49 52L57 44L52 35M34 43L39 43M49 42L54 41" stroke="#25444a" stroke-width="2.7"/><path d="M41 50L48 49L45 54Z" fill="#25444a"/></svg>`;
const ICON = { move: '◇', attack: '⚔', arts: '✦', items: '▣', wait: '◷', formation: '♜', shop: '⚖', tavern: '♧', quests: '⚑', journal: '▤', saves: '▧' };
let kit = null, game = null, audio = new OathAudio(), view, screenName = 'title', modalName = '', mode = 'inspect', action = null, target = null, inspectedId = '', deployId = '', castLock = true, autoAll = false, aiBusy = false, aiTimer = null, preBattle = null, dialogue = null;
let modalReturnFocus = null;
let rosterId = '', formationTab = 'jobs', learnJob = '', shopMode = 'buy', shopFilter = 'all', shopQuery = '', tavernCity = 'Gariland', tavernTab = 'rumors', journalChapter = 1, toastTimer = null, saveWarned = false, hasStarted = false, padCursor = { x: 5, z: 7 }, lastActiveId = '';
const storage = { get(k) {
        try {
            return localStorage.getItem('lions-oath:' + k);
        }
        catch {
            return null;
        }
    }, set(k, v) {
        try {
            localStorage.setItem('lions-oath:' + k, v);
            return true;
        }
        catch {
            if (!saveWarned) {
                saveWarned = true;
                toast('Browser storage is not available. Use Save & load to export a save.');
            }
            return false;
        }
    } };
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000); }
function play(n = 'click') { audio.sfx(n); }
function readPrefs() {
    try {
        return JSON.parse(storage.get('prefs') || '{}');
    }
    catch {
        return {};
    }
}
function applyOptions() {
    audio.volume = game.options.volume;
    audio.muted = game.options.muted;
    audio.music = game.options.music;
    audio.update();
    document.body.classList.toggle('reduce-motion', !!game.options.reduceMotion);
    if (view) {
        view.reduceMotion = !!game.options.reduceMotion;
        view.dirty = true;
    }
}
function saveEnvelope() {
    const flow = { screen: screenName, tavernCity, journalChapter };
    if (dialogue)
        flow.dialogue = { lines: dialogue.lines, index: dialogue.index, title: dialogue.title, resume: dialogue.resume };
    return { ...game.serialize(), savedAt: new Date().toISOString(), recovery: game.battle ? preBattle : null, flow };
}
function saveAuto() { if (hasStarted)
    storage.set('auto', JSON.stringify(saveEnvelope())); }
function validatedFlow(raw, candidate) {
    if (raw === undefined || raw === null)
        return null;
    saveAssert(saveRecord(raw), 'screen state');
    saveAssert(['title', 'world', 'battle', 'ending'].includes(raw.screen), 'saved screen');
    const flow = { screen: raw.screen };
    if (raw.tavernCity !== undefined) {
        saveAssert(saveText(raw.tavernCity, 100), 'tavern');
        flow.tavernCity = raw.tavernCity;
    }
    if (raw.journalChapter !== undefined) {
        saveAssert(saveNumber(raw.journalChapter, 1, 4, true), 'journal chapter');
        flow.journalChapter = raw.journalChapter;
    }
    if (raw.dialogue) {
        const d = raw.dialogue;
        saveAssert(saveRecord(d) && Array.isArray(d.lines) && d.lines.length > 0 && d.lines.length <= 10000, 'scene lines');
        saveAssert(saveText(d.title, 300), 'scene title');
        saveAssert(saveNumber(d.index, 0, d.lines.length - 1, true), 'scene position');
        saveAssert(['intro', 'battle', 'world', 'ending', 'tavern', 'journal'].includes(d.resume), 'scene continuation');
        saveAssert(!['intro', 'battle'].includes(d.resume) || !!candidate.battle, 'battle scene');
        saveAssert(d.resume !== 'ending' || candidate.state.ended, 'ending scene');
        const lines = d.lines.map((l) => {
            saveAssert(saveRecord(l), 'scene line');
            saveAssert(saveText(l.text, 25000), 'scene text');
            const line = { text: l.text };
            for (const k of ['speaker', 'source', 'title'])
                if (l[k] !== undefined) {
                    saveAssert(saveText(l[k], 500), 'scene ' + k);
                    line[k] = l[k];
                }
            line.direction = l.direction === true;
            return line;
        });
        flow.dialogue = { lines, title: d.title, index: d.index, resume: d.resume };
    }
    return flow;
}
function resumeScene(kind) {
    if (kind === 'intro')
        finishIntro();
    else if (kind === 'battle') {
        renderBattle();
        scheduleAI();
    }
    else if (kind === 'ending')
        showEnding();
    else if (kind === 'tavern') {
        setScreen('world');
        renderWorld();
        showTavern();
    }
    else if (kind === 'journal') {
        setScreen('world');
        renderWorld();
        showJournal();
    }
    else
        world();
}
function setScreen(name) { screenName = name; document.body.dataset.screen = name; audio.mode = name === 'battle' ? 'battle' : name; }
function closeModal(resume = true) {
    modalName = '';
    $('#modal').classList.remove('open');
    $('#modal').innerHTML = '';
    $('#interface').inert = false;
    if (modalReturnFocus?.isConnected)
        modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
    if (resume && screenName === 'battle')
        scheduleAI();
}
function modal(title, content, subtitle = '', narrow = false, footer = '') { clearTimeout(aiTimer); aiBusy = false; const opened = $('#modal').classList.contains('open'); const focused = document.activeElement; const oldKey = focused?.dataset ? { ...focused.dataset } : {}; if (!opened)
    modalReturnFocus = focused; $('#modal').classList.add('open'); $('#interface').inert = true; $('#modal').innerHTML = `<section class="modal-window ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><div>${subtitle ? `<div class="eyebrow">${esc(subtitle)}</div>` : ''}<h2>${esc(title)}</h2></div><button data-act="close" aria-label="Close dialog">×</button></header><div class="modal-body">${content}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}</section>`; setTimeout(() => { const candidates = Array.from(document.querySelectorAll('#modal button, #modal select, #modal input')); const match = opened && Object.keys(oldKey).length ? candidates.find(el => Object.keys(oldKey).every(k => el.dataset[k] === oldKey[k])) : null; (match || candidates[0])?.focus({ preventScroll: true }); }, 20); }
/** Button prompts for every device; CSS shows the one that matches kit.input.source. */
function keyHint(kb, pad, touch = '') { return `<i class="pk pk-kb">${kb}</i><i class="pk pk-pad">${pad}</i>${touch ? `<i class="pk pk-touch">${touch}</i>` : ''}`; }
const PAD_KEYS = { move: 'Y', attack: 'RT', arts: 'X', items: 'LT', wait: 'R3' };
function portrait(u, big = false) { return `<div class="portrait ${big ? 'big' : ''}" style="--unit-color:${esc(DB.jobs[u.job]?.color || '#568fa2')}" aria-hidden="true"></div>`; }
function title() { if (hasStarted)
    saveAuto(); hasStarted = false; dialogue = null; clearTimeout(aiTimer); autoAll = false; aiBusy = false; closeModal(false); setScreen('title'); view.setBattle(null); $('#interface').innerHTML = `<div class="title-shadow"></div><div class="title-ribbon">A tale recovered from the Durai Papers</div><section class="title-shell">${CREST}<div class="eyebrow">An Ivalice tactical chronicle</div><h1>The Lion’s<br>Oath</h1><p class="tagline">History remembers the crown.<br>It forgets the hands that would not hold it.</p><div class="title-buttons"><button class="primary" data-act="${storage.get('auto') ? 'continue' : 'new'}">${storage.get('auto') ? 'Continue the chronicle' : 'Begin the chronicle'} <span style="float:right">→</span></button><button data-act="${storage.get('auto') ? 'new' : 'controls'}">${storage.get('auto') ? 'New campaign' : 'How to play'}</button><button data-act="saves">Load / import</button><button class="ghost" data-act="options">Options</button><button class="ghost" data-act="credits">About & coverage</button></div></section><footer class="title-footer"><div>UNOFFICIAL FAN ADAPTATION · FINAL FANTASY TACTICS (PS1)<br>2026-09-25 · GPT-6 Astra Pro · Build 1.3</div><div>TOUCH · MOUSE & KEYBOARD · GAMEPAD<br>Original low-poly art and procedural score</div></footer>`; }
function newCampaign(confirmed = false) {
    if ((hasStarted || storage.get('auto')) && !confirmed) {
        modalName = 'new';
        modal('Begin a new chronicle?', `<p>The automatic save will be replaced. Manual slots and exported saves will remain.</p><div class="row" style="margin-top:20px"><button class="primary" data-act="newConfirm">Begin new campaign</button><button data-act="close">Keep current save</button></div>`, 'A new beginning', true);
        return;
    }
    const keepOptions = normalizeOptions({ ...game.options, ...readPrefs() });
    game = new GameModel();
    game.options = keepOptions;
    hasStarted = true;
    preBattle = null;
    applyOptions();
    startMission(DB.missions[0]);
}
function restoreSave(raw) {
    if (raw.length > 4000000)
        throw new Error('Save exceeds the 4 MB size limit.');
    const value = JSON.parse(raw);
    const candidate = GameModel.restore(value.game || value);
    const flow = validatedFlow(value.flow, candidate);
    let recovery = null;
    if (candidate.battle) {
        // Old saves have no scene state. Their roster is still the pre-battle roster.
        recovery = value.recovery ? GameModel.restore(value.recovery).serialize() : { ...clone(candidate.serialize()), battle: null };
        saveAssert(!recovery.battle && recovery.state.next === candidate.state.next && recovery.state.day === candidate.state.day, 'recovery point');
        saveAssert(JSON.stringify(recovery.state.roster.map((u) => u.id)) === JSON.stringify(candidate.state.roster.map((u) => u.id)), 'recovery company');
    }
    // No session fields change until all parts of the import pass validation.
    clearTimeout(aiTimer);
    game = candidate;
    preBattle = recovery;
    hasStarted = true;
    autoAll = false;
    aiBusy = false;
    mode = 'inspect';
    action = null;
    target = null;
    dialogue = null;
    if (flow?.tavernCity)
        tavernCity = flow.tavernCity;
    if (flow?.journalChapter)
        journalChapter = flow.journalChapter;
    applyOptions();
    closeModal(false);
    setScreen(game.battle ? 'battle' : flow?.screen === 'ending' && game.state.ended ? 'ending' : 'world');
    view.setBattle(game.battle);
    deployId = game.battle?.units.find(u => u.team === 0 && !u.guest)?.id || '';
    if (flow?.dialogue) {
        dialogue = { ...flow.dialogue, done: () => resumeScene(flow.dialogue.resume) };
        renderDialogue();
    }
    else if (game.battle) {
        renderBattle();
        scheduleAI();
    }
    else if (screenName === 'ending')
        showEnding();
    else
        renderWorld();
    saveAuto();
    toast('Chronicle restored.');
}
function loadSave(key = 'auto') {
    try {
        const raw = storage.get(key);
        if (!raw)
            throw new Error('This save slot is empty.');
        restoreSave(raw);
    }
    catch (e) {
        toast(e.message);
    }
}
function world() { clearTimeout(aiTimer); aiBusy = false; autoAll = false; dialogue = null; closeModal(false); setScreen('world'); game.battle = null; preBattle = null; view.setBattle(null); saveAuto(); renderWorld(); }
function campaignBrief(m) { return m.brief || (Array.isArray(m.intro) ? m.intro.find((l) => !l.direction)?.text : '') || String(m.intro || '').split('\n')[0].split('|').slice(1).join('|') || 'Prepare your company and travel to ' + m.area + '.'; }
function renderWorld() {
    const s = game.state, ch = game.chapter(), next = DB.missions[s.next], points = DB.places.filter((p) => p[4] <= ch);
    const roads = points.map((p, i) => {
        if (!i)
            return '';
        const n = points.slice(0, i).sort((a, b) => Math.hypot(a[1] - p[1], a[2] - p[2]) - Math.hypot(b[1] - p[1], b[2] - p[2]))[0];
        return `<path class="road" d="M${p[1]},${p[2]} L${n[1]},${n[2]}"/>`;
    }).join('');
    const nodes = points.map((p) => `<button class="place ${p[0] === s.place ? 'current' : ''} ${p[0] === next?.area ? 'next' : ''}" data-act="travel" data-name="${esc(p[0])}" style="left:${p[1]}%;top:${p[2]}%" aria-label="Travel to ${esc(p[0])}">${esc(p[0])}</button>`).join('');
    $('#interface').innerHTML = `<main class="world texture"><header class="world-head"><div class="world-brand">${CREST}<div><div class="eyebrow">The Lion’s Oath</div><h2>The roads of Ivalice</h2></div></div><div class="resources"><div>WAR CHEST<b>${fmt(s.gil)} <small>gil</small></b></div><div>DAY<b>${s.day}</b></div><div>LOCATION<b style="font-size:17px">${esc(s.place)}</b></div><button class="square ghost" data-act="options" aria-label="Options">☷</button></div></header><section class="world-body"><div class="atlas"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="land" d="M3,7 L22,8 30,17 39,8 54,14 69,9 84,18 91,32 84,45 96,62 85,86 69,95 52,86 43,94 25,87 7,71 12,55 2,36Z"/><path d="M54,18 C48,35 54,45 44,55 S42,75 33,88 M70,12 Q65,32 78,45 T82,80" stroke="#b1c7b329" fill="none" stroke-width="1.7"/><path d="M28,9 L32,14 26,14Z M35,15 L39,23 31,23Z M69,70 L76,82 61,82Z M65,64 L71,75 59,75Z" fill="#c6c69c22" stroke="#e4ddb53b" stroke-width=".3"/>${roads}<circle cx="88" cy="12" r="5" fill="none" stroke="#d6c89950" stroke-width=".3"/><path d="M88,6 L88,18 M82,12 L94,12 M88,7 L86,13 90,13Z" stroke="#d6c89980" fill="none" stroke-width=".35"/></svg>${nodes}<div class="atlas-caption">Every road remembers.</div><div class="atlas-legend">◇ SETTLEMENT &nbsp; ◆ NEXT ENGAGEMENT</div></div><aside class="journey"><article class="chapter-card panel"><div class="ordinal">${ROMAN[ch]}</div><div class="eyebrow">Chapter ${ROMAN[ch]} · ${s.next} / ${DB.missions.length} stages</div><h2>${CHAPTERS[ch]}</h2><div class="rule"></div><div class="eyebrow">${next ? 'Your next destination' : 'The campaign is complete'}</div><div class="mission-title">${esc(next?.name || 'Beyond recorded history')}</div><p>${esc(next ? campaignBrief(next) : 'The company can finish its side journeys, enter the Deep Dungeon, and return to earlier battles.')}</p><div class="row wrap" style="margin-top:12px"><span class="pill">${esc(next?.area || 'Postgame')}</span>${next ? `<span class="tag">Suggested Lv ${next.level}</span>` : ''}</div><button class="primary" data-act="${next ? 'nextMission' : 'ending'}">${next ? 'Set forth' : 'Read the epilogue'} <span style="float:right">→</span></button></article><article class="company-mini panel"><div class="row spread"><span class="eyebrow">The company</span><small>${s.party.length} / 5 deployed</small></div><div class="mini-portraits">${s.party.map((id) => game.roster(id)).filter(Boolean).map((u) => portrait(u)).join('')}</div><small>${s.roster.filter((u) => !u.dead).length} members · ${s.dispatch.length} expeditions</small><div class="row" style="margin-top:12px"><button class="tiny ghost grow" data-act="formation">Manage company</button><button class="tiny ghost" data-act="rest">Rest 1 day</button></div></article></aside></section><nav class="world-nav">${[['formation', 'Company'], ['shop', 'Outfitter'], ['tavern', 'Tavern'], ['quests', 'Side journeys'], ['journal', 'Chronicle'], ['saves', 'Save & load']].map(([a, n]) => `<button data-act="${a}"><span class="nav-icon">${ICON[a]}</span>${n}</button>`).join('')}</nav><footer class="world-footer"><span>${esc(s.history.slice(-1)[0] || 'Prepare your company, then set forth. Progress is saved after every turn.')}</span><span>SELECT A SETTLEMENT TO TRAVEL</span></footer></main>`;
}
function travel(name) {
    if (!DB.places.some((p) => p[0] === name && p[4] <= game.chapter()))
        return;
    if (game.state.place === name) {
        tavernCity = name;
        showTavern();
        return;
    }
    game.state.place = name;
    game.state.visited = [...new Set([...game.state.visited, name])];
    game.advanceDays(1);
    saveAuto();
    renderWorld();
    toast('Arrived at ' + name + '. One day passes.');
    const p = DB.places.find((p) => p[0] === name);
    if (!['town', 'palace', 'castleGate', 'chapel', 'abbey'].includes(p[3]) && hash(name + game.state.day) % 6 === 0) {
        modalName = 'encounter';
        modal('Trouble on the road', `<p>Hostile forces block the road near ${esc(name)}. Fight for experience and equipment, or take a longer route.</p><div class="row" style="margin-top:20px"><button class="primary" data-act="skirmish">Stand and fight</button><button data-act="bypass">Take the longer road</button></div>`, 'Optional encounter', true);
    }
}
function skirmish() { const p = DB.places.find((p) => p[0] === game.state.place) || DB.places[0], level = Math.max(1, ...game.state.party.map((id) => game.roster(id)?.level || 1)), enemies = level < 10 ? 'Goblin:2,Chocobo:2,Squire:2' : level < 25 ? 'Knight:2,Archer:2,Wizard:1,Monk:1' : 'Red Chocobo:2,Behemoth:2,Dragon:2'; startMission({ id: 'r' + game.state.day, name: 'Patrol at ' + p[0], area: p[0], theme: p[3], chapter: game.chapter(), level, enemies, boss: '', objective: 'defeat', guests: [], intro: 'Ramza|Stay together. We will keep the roads open.', outro: 'Ramza|The road is clear. Tend the wounded before we move on.', optional: true }); }
function startMission(m) {
    if (!m)
        return;
    closeModal(false);
    clearTimeout(aiTimer);
    autoAll = false;
    aiBusy = false;
    mode = 'inspect';
    action = null;
    target = null;
    inspectedId = '';
    preBattle = clone(game.serialize());
    preBattle.battle = null;
    const b = game.begin(m);
    deployId = b.units.find(u => u.team === 0 && !u.guest)?.id || '';
    // Keyboard and gamepad cursors start on the first unit to deploy.
    const first = b.unit(deployId);
    padCursor = first ? { x: first.x, z: first.z } : { x: Math.floor(b.w / 2), z: b.h - 2 };
    lastActiveId = '';
    setScreen('battle');
    view.setBattle(b);
    saveAuto();
    showDialogue(m.intro, m.name, finishIntro, 'intro');
}
function finishIntro() {
    renderBattle();
    if (game.battle?.mission.id === 'm0' && !game.state.flags.tutorial) {
        modalName = 'tutorial';
        modal('Lead with a steady hand', `<p>You control <b>Ramza</b> in this opening battle. Agrias and the other guards act as guests.</p><div class="rule"></div><p><b class="gold">Each turn has one Move and one Act.</b> Use either order. Select a highlighted tile. Check the preview. Then confirm.</p><div class="gap"></div><p>Choose <b>Wait</b> to end your turn and select a facing direction. Side and rear attacks are harder to block. Spells can take time to cast and can hit allies.</p><div class="gap"></div><p>There is no time limit for your orders. The top row shows who will act next.</p><button class="primary" style="width:100%;margin-top:22px" data-act="tutorialDone">Choose your starting position</button>`, 'First battle', true);
    }
}
function showDialogue(text, titleText, done, resume = 'world') {
    const lines = Array.isArray(text) ? text : String(text || '').split('\n').filter(Boolean).map(l => { const i = l.indexOf('|'); return i >= 0 ? { speaker: l.slice(0, i), text: l.slice(i + 1) } : { speaker: 'The Durai Papers', text: l }; });
    if (!lines.length) {
        done();
        return;
    }
    dialogue = { lines, index: 0, title: titleText, done, resume };
    renderDialogue();
    saveAuto();
}
function renderDialogue() {
    if (!dialogue)
        return;
    const d = dialogue, line = d.lines[d.index];
    $('#interface').innerHTML = `<div class="letterbox"></div><div class="dialogue-chapter"><div class="eyebrow">${line.source ? (line.source.startsWith('scene-') ? 'Guide scene · ' : 'Adapted scene · ') + esc(line.source) : 'Chapter ' + ROMAN[game.battle?.mission.chapter || game.chapter()]}</div><h2>${esc(line.title || d.title)}</h2></div><section class="dialogue-box"><div class="row spread"><div class="dialogue-name">${esc(line.speaker || 'The Durai Papers')}</div><span class="eyebrow" style="font-size:9px">${d.index + 1} / ${d.lines.length}</span></div><p class="dialogue-text ${line.direction ? 'direction' : ''}">${esc(line.text)}</p><div class="dialogue-bottom"><button class="tiny ghost" data-act="skipDialogue">Skip scene</button><small>Continue · ${keyHint('Enter', 'Ⓐ', 'tap Next')}</small><button class="primary" data-act="dialogueNext">${d.index === d.lines.length - 1 ? 'Continue →' : 'Next →'}</button></div></section>`;
}
function nextDialogue(skip = false) {
    if (!dialogue)
        return;
    const d = dialogue;
    if (skip || ++d.index >= d.lines.length) {
        dialogue = null;
        d.done();
    }
    else
        renderDialogue();
    saveAuto();
}
function refreshHighlights() {
    const b = game.battle, u = b.active();
    view.tileHighlights = {};
    view.target = target;
    if (!u || u.team || u.guest || autoAll)
        return;
    if (mode === 'move')
        for (const [key] of b.reachable(u))
            view.tileHighlights[key] = 'rgba(117,190,201,.19)';
    if (action)
        for (const t of b.tiles)
            if (!t.block && b.inRange(u, action, t))
                view.tileHighlights[t.x + ',' + t.z] = 'rgba(213,136,115,.13)';
    if (action && target && action.area)
        for (const t of b.tiles)
            if (distance(t, target) <= action.area)
                view.tileHighlights[t.x + ',' + t.z] = 'rgba(236,199,133,.28)';
}
function renderBattle() {
    const b = game.battle;
    if (!b || dialogue)
        return;
    setScreen('battle');
    if (['won', 'lost'].includes(b.phase)) {
        battleResult();
        return;
    }
    const active = b.active(), u = b.unit(inspectedId) || active || b.unit(deployId) || b.units[0], s = stats(u), can = !!active && active.team === 0 && !active.guest && team(active) === 0 && !autoAll && !aiBusy && b.phase === 'turn';
    // A new turn: the camera (when zoomed in) follows the unit in play, and the keyboard/gamepad cursor starts on it.
    const turnKey = b.turn + ':' + b.activeId;
    if (active && turnKey !== lastActiveId) {
        lastActiveId = turnKey;
        view.followUnit(active.id);
        if (active.team === 0 && !active.guest)
            padCursor = { x: active.x, z: active.z };
    }
    const timeline = b.phase === 'turn' ? `<div class="timeline" aria-label="Upcoming turns">${b.forecast(7).map((t) => `<div class="turn-chip ${t.team ? 'enemy' : 'ally'} ${t.id === b.activeId && !t.cast ? 'current' : ''}"><b>${esc(t.name)}</b><span>${t.cast ? 'CAST' : t.ticks === 0 ? 'NOW' : t.ticks + ' CT'}</span></div>`).join('')}</div>` : '';
    const unitPanel = b.phase === 'turn' ? `<aside class="unit-panel"><div class="turn-label">${u.id === b.activeId ? (u.team ? 'Enemy turn' : u.guest ? 'Guest turn' : 'Your turn') : 'Inspected unit'}</div><div class="row unit-heading">${portrait(u, true)}<div><div class="unitname">${esc(u.name)}</div><div class="jobline">Lv ${u.level} · ${esc(u.job)}</div></div></div><div class="health"><div class="bar-caption"><span>HP</span><span>${u.hp} / ${s.hp}</span></div><div class="meter"><i style="width:${100 * u.hp / s.hp}%"></i></div><div class="bar-caption"><span>MP</span><span>${u.mp} / ${s.mp}</span></div><div class="meter mp"><i style="width:${100 * u.mp / Math.max(1, s.mp)}%"></i></div></div><div class="stats">${[['Move', s.move], ['Jump', s.jump], ['ATK', s.pa], ['SPD', s.speed]].map(([n, v]) => `<div class="stat">${n}<b>${v}</b></div>`).join('')}</div><div class="statusline"><span class="tag">Brave ${u.brave}</span><span class="tag">Faith ${u.faith}</span>${Object.keys(u.status).map(n => `<span class="tag">${esc(n)}</span>`).join('')}</div></aside>` : '';
    let dock = '', tip = '', card = '';
    if (b.phase === 'deploy') {
        const friends = b.units.filter(u => u.team === 0 && !u.guest);
        view.tileHighlights = {};
        for (const t of b.tiles)
            if (!t.block && t.z >= b.h - 3)
                view.tileHighlights[t.x + ',' + t.z] = 'rgba(117,190,201,.17)';
        const du = b.unit(deployId);
        view.target = du ? { x: du.x, z: du.z } : null;
        dock = `<div class="deploy-label"><div class="eyebrow">Company deployment</div><h2>Choose your ground.</h2><p>Select a unit. Then select a blue tile. Guests act independently.<span class="pk pk-pad"> Select, then Ⓐ on “Begin battle”, starts the fight.</span></p></div><footer class="battle-dock deployment-dock"><div class="command-info"><div class="eyebrow">Formation</div><div class="instruction">${friends.length} combatants</div></div><div class="deployment-units">${friends.map(u => `<button class="${u.id === deployId ? 'selected' : ''}" data-act="deployUnit" data-id="${u.id}">${portrait(u)}<div><b>${esc(u.name)}</b><small>${esc(u.job)}</small></div></button>`).join('')}</div><button class="primary" data-act="battleStart">Begin battle →</button></footer>`;
    }
    else {
        refreshHighlights();
        const commands = [['move', 'Move', '1', active?.moved ? 'Used' : 'Choose tile'], ['attack', 'Strike', '2', active?.acted ? 'Used' : 'Weapon'], ['arts', 'Arts', '3', 'Job abilities'], ['items', 'Items', '4', 'Consumables'], ['wait', 'Wait', '5', 'End turn']];
        dock = `<footer class="battle-dock"><div class="command-info"><div class="eyebrow">${can ? 'Command' : 'Battle in progress'}</div><div class="instruction">${esc(active?.name || 'Charge time')}</div><small>${active?.moved ? 'Move used' : 'Move ready'} · ${active?.acted ? 'Act used' : 'Act ready'}</small></div><div class="commands">${commands.map(([id, name, key, sub]) => `<button class="command ${mode === id ? 'selected' : ''}" data-act="command" data-name="${id}" ${!can || (id === 'move' ? active?.moved : id !== 'wait' ? active?.acted : false) ? 'disabled' : ''}><span class="key">${keyHint(key, PAD_KEYS[id])}</span><span class="icon">${ICON[id]}</span><b>${name}</b><small>${sub}</small></button>`).join('')}</div><div class="dock-right"><button class="ghost" data-act="autoTurn" ${!can ? 'disabled' : ''}>Auto turn</button><button class="ghost" data-act="undo" ${!can || !active?.moveOrigin || active?.acted ? 'disabled' : ''}>Undo move</button></div></footer>`;
        if (can)
            tip = mode === 'move' ? 'Select a blue tile to preview movement.' : action ? 'Select a target. Check the area. Then confirm.' : active.acted ? 'Move to safety, or choose Wait.' : 'Choose Move or Strike. Either can come first.';
        else
            dock += `<div class="enemy-banner"><div class="eyebrow">${autoAll ? 'Company auto-command' : active?.team ? 'Enemy turn' : 'Guest ally'}</div><h3>${esc(active?.name || 'Charge time advances')}</h3>${autoAll ? '<button class="tiny ghost" style="margin-top:8px" data-act="stopAuto">Take command</button>' : ''}</div>`;
        if (target && can)
            card = targetCard();
    }
    $('#interface').innerHTML = `<header class="battle-top"><div><div class="battle-title">${esc(b.mission.area)} <span style="opacity:.45">/</span> ${esc(b.mission.name)}</div><div class="battle-objective">${esc(b.objectiveText())}</div></div><div class="compact-controls"><button class="ghost" data-act="fieldUnits" aria-label="Battlefield units">♟</button><button class="ghost" data-act="options" aria-label="Battle menu">☷</button><button class="ghost" data-act="fullscreen" aria-label="Full screen">⛶</button></div></header>${timeline}${unitPanel}<div class="camera-controls"><button data-act="rotateLeft" aria-label="Rotate left">↶</button><button data-act="rotateRight" aria-label="Rotate right">↷</button><button class="zoom" data-act="zoomIn" aria-label="Zoom in">+</button><button class="zoom" data-act="zoomOut" aria-label="Zoom out">−</button></div>${tip && !card ? `<div class="field-tip">${esc(tip)}<span class="pk pk-kb"> · Arrows / WASD move the cursor · Enter selects</span><span class="pk pk-pad"> · D-pad cursor · Ⓐ select · Ⓑ back</span></div>` : ''}${b.phase === 'turn' ? '<button class="log-button" data-act="log">▤ Combat log</button>' : ''}${card}${dock}`;
    if (b.pendingLoot && !modalName) {
        modalName = 'crystal';
        modal('A memory in crystal', `<p>The crystal offers ${esc(b.pendingLoot.skill)}. Learn the ability, or restore this unit’s HP and MP.</p><div class="row" style="margin-top:20px"><button class="primary" data-act="crystalLearn">Learn ability</button><button data-act="crystalHeal">Restore HP / MP</button></div>`, 'Choose a reward', true);
    }
}
function showFieldUnits() {
    const b = game.battle;
    if (!b)
        return;
    modalName = 'fieldUnits';
    const actor = b.active(), aiming = !!action && actor && !actor.team && !actor.guest && !autoAll;
    modal('Battlefield units', `<p>${aiming ? 'Select a unit to preview this action. You must still confirm it on the field.' : 'Select any unit to inspect its health, equipment, and status.'}</p><div class="field-unit-list">${b.units.filter(u => !u.removed).map(u => {
        const st = stats(u), aim = aiming && !u.airborne && b.inRange(actor, action, u);
        return `<button class="field-unit-row" data-act="fieldUnit" data-id="${u.id}"><span class="pill">${team(u) ? 'Enemy' : u.guest ? 'Guest' : 'Ally'}</span><span><b>${esc(u.name)}</b><small>Lv ${u.level} · ${esc(u.job)} · ${u.x}, ${u.z}</small><small>${u.hp <= 0 ? 'Fallen · ' + u.down + ' turns left' : Object.keys(u.status).map(esc).join(' · ') || 'No status effects'}</small></span><span>HP ${u.hp} / ${st.hp}<small>MP ${u.mp} / ${st.mp}</small><small>${u.airborne ? 'In the air' : aiming ? aim ? 'Preview target →' : 'Out of range' : 'Inspect →'}</small></span></button>`;
    }).join('')}</div>`, 'Units · target selection', false, 'No action is spent until you confirm a target.');
}
function selectFieldUnit(id) {
    const b = game.battle, u = b?.unit(id);
    if (!b || !u)
        return;
    const active = b.active(), aiming = !!action && active && !active.team && !active.guest && !autoAll;
    closeModal(false);
    inspectedId = id;
    padCursor = { x: u.x, z: u.z };
    view.cursor = padCursor;
    if (aiming && !u.airborne) {
        target = { ...padCursor };
    }
    renderBattle();
    scheduleAI();
}
function targetCard() {
    const b = game.battle, u = b.active(), t = b.tile(target.x, target.z), v = b.occupant(t.x, t.z);
    let caption = '', text = '', value = '', hit = '', valid = false;
    if (mode === 'move') {
        const r = b.reachable(u).get(t.x + ',' + t.z);
        valid = !!r && r.path.length > 0;
        caption = 'Movement preview';
        value = r ? String(r.cost) : '—';
        hit = 'of ' + stats(u).move + ' move';
        text = valid ? 'Moving does not spend your action.' : v ? 'This tile is occupied.' : 'This tile is outside your movement range.';
    }
    else if (action) {
        valid = b.inRange(u, action, t) && !b.usable(u, action);
        const targets = b.targets(u, action, t), pr = v ? b.preview(u, action, v) : null;
        caption = action.name;
        value = pr ? (pr.value < 0 ? '+' : '−') + Math.abs(pr.value) : 'Area';
        hit = pr ? pr.hit + '% hit' : targets.length + ' units';
        if (['status', 'break', 'steal', 'invite', 'buff', 'brave', 'faith', 'ct', 'cleanse', 'dispel', 'golem', 'mp', 'revive', 'elixir', 'calculate'].includes(action.kind))
            value = action.status?.join(' / ') || action.kind;
        const allyRisk = targets.some(t => team(t) === team(u) && !action.friendly && !['heal', 'revive', 'cleanse', 'mp', 'buff'].includes(action.kind));
        text = !valid ? 'Out of range or unavailable.' : action.charge ? `Resolves in ${Math.ceil(action.charge * (passive(u, 'Short Charge') ? .5 : 1))} CT. ${allyRisk ? 'Ally in the area!' : 'Check the turn order.'}` : targets.length > 1 ? targets.map(t => t.name).join(', ') : v ? b.facing(u, v) + ' facing · height ' + t.h : 'Empty tile';
    }
    return `<section class="target-card"><div class="target-meta"><div class="eyebrow" style="font-size:8px">${esc(caption)}</div><h3>${esc(v?.name || t.t + ' · ' + t.x + ', ' + t.z)}</h3><p>${esc(text)}</p></div><div class="preview-row"><div class="damage ${value.startsWith('+') ? 'heal' : ''}" style="${value.length > 8 ? 'font-size:16px' : ''}">${esc(value)}</div><small>${esc(hit)}</small></div>${action?.charge && !action.tileOnly && v ? `<div class="casting-lock"><button class="tiny ghost" data-act="castLock">${castLock ? '◉ Follow unit' : '◇ Lock tile'} · change</button></div>` : ''}<div class="btns"><button class="primary" data-act="confirmTarget" ${valid ? '' : 'disabled'}>${mode === 'move' ? 'Move here' : 'Confirm action'}</button><button class="ghost" data-act="cancelTarget">Cancel</button></div></section>`;
}
function chooseCommand(which) {
    const b = game.battle, u = b?.active();
    if (!b || !u || u.team || u.guest || aiBusy || autoAll)
        return;
    inspectedId = '';
    target = null;
    action = null;
    if (which === 'move') {
        if (u.moved)
            return;
        mode = 'move';
    }
    else if (which === 'attack') {
        if (u.acted)
            return;
        mode = 'attack';
        action = clone(DB.skills.Attack);
    }
    else if (which === 'arts' || which === 'items') {
        if (u.acted)
            return;
        mode = which;
        showAbilities(which === 'items');
        return;
    }
    else if (which === 'wait') {
        showFacing();
        return;
    }
    renderBattle();
}
function showAbilities(items = false) { const b = game.battle, u = b.active(); modalName = items ? 'items' : 'abilities'; const names = b.skillList(u).filter(n => items ? DB.skills[n].item : !DB.skills[n].item), cards = names.map(n => { const a = DB.skills[n], why = b.usable(u, a); return `<button class="skill-action" data-act="ability" data-name="${esc(n)}" ${why && a.kind !== 'throw' ? 'disabled' : ''}><h4>${esc(n)} ${a.item ? `<span class="tag">×${b.inventory[a.item] || 0}</span>` : ''}</h4><small>${esc(why || (a.kind === 'jump' ? 'Jump · Range ' + b.jumpRanges(u).range + ' · Height ' + b.jumpRanges(u).height : a.description))}</small><div class="row wrap" style="margin-top:9px"><span class="tag">${a.mp ? b.skillCost(u, a) + ' MP' : 'No MP'}</span><span class="tag">${a.charge ? Math.ceil(a.charge * (passive(u, 'Short Charge') ? .5 : 1)) + ' CT' : 'Instant'}</span>${a.area ? `<span class="tag">Area ${a.area}</span>` : ''}</div></button>`; }).join(''); const calc = !items && (u.job === 'Calculator' || u.secondary === 'Calculator') && u.learned.some((n) => n.startsWith('Math ')); modal(items ? 'Battle items' : 'Arts of ' + u.name, `${items ? '<p>Only learned Item abilities are available. Chemists and Throw Item users can reach four tiles.</p>' : `<div class="row wrap"><span class="pill">${esc(u.job)}</span><span class="tag">${esc(u.secondary || 'No secondary')}</span><span class="tag">${u.mp} MP</span></div>`}<div class="skill-list">${calc ? '<button class="skill-action" data-act="calculator"><h4>Arithmetic</h4><small>Choose a spell, numerical property, and divisor. No MP or charge time.</small></button>' : ''}${!items && passive(u, 'Equip Change') ? '<button class="skill-action" data-act="battleEquip"><h4>Equip Change</h4><small>Spend this action to change equipment from inventory.</small></button>' : ''}${cards || '<div class="empty">No learned abilities in this category.</div>'}</div>`, 'Choose an ability', false, 'Select a target on the battlefield. Check the preview before you confirm.'); }
function selectAbility(name) {
    const a = DB.skills[name];
    if (!a)
        return;
    if (a.kind === 'throw') {
        modalName = 'throw';
        modal('Choose a projectile', `<p>Throw uses one item. Weapon power and unit speed affect damage.</p><div class="item-grid">${Object.keys(game.battle.inventory).filter(n => game.battle.inventory[n] > 0 && item(n).type === a.throwType).map(n => `<button class="item-card" data-act="throwItem" data-name="${esc(n)}" data-skill="${esc(name)}"><h4>${esc(n)}</h4><small>Stock ${game.battle.inventory[n]} · Power ${item(n).power}</small></button>`).join('') || '<div class="empty">No compatible items in inventory.</div>'}</div>`, 'Ninja · Throw', true);
        return;
    }
    action = clone(a);
    mode = 'arts';
    target = null;
    closeModal(false);
    if (a.range === 0)
        target = { x: game.battle.active().x, z: game.battle.active().z };
    renderBattle();
}
function showCalculator() { const u = game.battle.active(), fields = ['CT', 'Level', 'EXP', 'Height'].filter(n => u.learned.includes('Math ' + n)), divs = ['Prime', '3', '4', '5'].filter(n => u.learned.includes('Math ' + n)), spells = u.learned.filter((n) => { const a = DB.skills[n]; return a && ['Priest', 'Wizard', 'Oracle', 'Time Mage'].includes(a.job) && ['magic', 'heal', 'revive', 'status', 'percent', 'dispel'].includes(a.kind); }); modalName = 'calculator'; modal('Arithmetic', `<p>The spell affects every matching unit, including allies. Height zero is divisible by 3, 4, and 5.</p><div class="stack" style="margin-top:17px"><label>Property<select id="math-field">${fields.map(n => `<option>${n}</option>`)}</select></label><label>Divisor<select id="math-divisor">${divs.map(n => `<option>${n}</option>`)}</select></label><label>Spell<select id="math-spell">${spells.map((n) => `<option>${esc(n)}</option>`)}</select></label><button class="primary" data-act="mathPrepare" ${!fields.length || !divs.length || !spells.length ? 'disabled' : ''}>Preview calculation</button></div>`, 'Calculator', true); }
function showFacing() {
    const u = game.battle?.active();
    if (!u || u.team || u.guest)
        return;
    modalName = 'facing';
    modal('Face the next threat', `<p>${u.moved && u.acted ? 'Move and action used.' : !u.moved && !u.acted ? 'Waiting without moving or acting retains 40 CT.' : 'Using only one command retains 20 CT.'} Your shield protects the direction you face.</p><div class="face-grid">${['North', 'East', 'South', 'West'].map((n, i) => `<button class="${u.dir === i ? 'selected' : ''}" data-act="face" data-n="${i}">${['↑', '→', '↓', '←'][i]}<br><small>${n}</small></button>`).join('')}</div>`, 'End turn', true);
}
function tileClick(p) {
    const b = game.battle;
    if (screenName !== 'battle' || !b || dialogue || modalName)
        return;
    if (b.phase === 'deploy') {
        const u = b.unit(deployId), t = b.tile(p.x, p.z), o = b.occupant(p.x, p.z);
        if (o && o.team === 0 && !o.guest) {
            deployId = o.id;
            renderBattle();
            return;
        }
        if (u && t && !t.block && !o && p.z >= b.h - 3 && !b.mission.gate && !b.mission.solo) {
            u.x = p.x;
            u.z = p.z;
            renderBattle();
            saveAuto();
            play('move');
        }
        else if (b.mission.solo || b.mission.gate)
            toast('This encounter has fixed starting positions.');
        return;
    }
    const u = b.active();
    if (!u || aiBusy || autoAll || u.team || u.guest)
        return;
    if (mode === 'inspect') {
        const o = b.occupant(p.x, p.z);
        inspectedId = o?.id || '';
        target = null;
    }
    else {
        target = p;
        inspectedId = '';
    }
    renderBattle();
    play();
}
function commitTarget() {
    const b = game.battle, u = b?.active();
    if (!b || !u || !target || aiBusy)
        return;
    const ok = mode === 'move' ? b.move(u, target.x, target.z) : action ? b.execute(u, action, target, castLock) : false;
    if (!ok) {
        toast('That command cannot be completed.');
        return;
    }
    mode = 'inspect';
    action = null;
    target = null;
    afterAction();
}
function flushEvents() {
    const b = game.battle;
    if (!b)
        return;
    const events = b.events.splice(0);
    view.events(events, game.options.speed);
    const sound = events.find(e => ['victory', 'defeat', 'ko', 'learn', 'level', 'recruit'].includes(e.type)) || events.slice().reverse().find(e => ['hit', 'heal', 'action', 'move', 'revive', 'cast', 'treasure'].includes(e.type));
    if (sound)
        play(sound.type);
    // The Proving Ring crowd roars when a fighter falls and when the bout is won.
    if (b.mission.arena && events.some(e => e.type === 'ko' || e.type === 'victory'))
        audio.crowd(events.some(e => e.type === 'victory') ? .1 : .06);
    // Controller rumble / phone haptics: light for blows, heavier when the company is hurt or falls.
    let strength = 0, ms = 0;
    for (const e of events) {
        const v = e.id ? b.unit(e.id) : null, mine = !!v && v.team === 0 && !v.guest;
        if (e.type === 'hit' && v) {
            strength = Math.max(strength, mine ? .45 : .22);
            ms = Math.max(ms, mine ? 140 : 80);
        }
        else if (e.type === 'ko' && mine) {
            strength = Math.max(strength, .8);
            ms = Math.max(ms, 260);
        }
        else if (e.type === 'victory' || e.type === 'defeat') {
            strength = Math.max(strength, e.type === 'defeat' ? .7 : .35);
            ms = Math.max(ms, 360);
        }
    }
    if (strength)
        kit.input.rumble(strength, ms);
}
function afterAction() {
    const b = game.battle;
    if (!b)
        return;
    flushEvents();
    saveAuto();
    if (b.phase === 'turn' && !dialogue && !modalName && b.mission.banter?.length && b.turn >= 4 && b.turn % 6 === 4 && b.lastBanterTurn !== b.turn) {
        const i = b.banterIndex || 0;
        if (i < b.mission.banter.length) {
            b.banterIndex = i + 1;
            b.lastBanterTurn = b.turn;
            saveAuto();
            showDialogue([b.mission.banter[i]], b.mission.name, () => { renderBattle(); scheduleAI(); }, 'battle');
            return;
        }
    }
    renderBattle();
    scheduleAI();
}
function scheduleAI() {
    clearTimeout(aiTimer);
    const b = game.battle;
    if (!b || b.phase !== 'turn' || modalName || dialogue || document.hidden || kit.paused)
        return;
    const u = b.active();
    if (!u) {
        b.advance();
        afterAction();
        return;
    }
    if (!(u.team !== 0 || team(u) !== 0 || u.guest || autoAll || has(u, 'Confuse') || has(u, 'Berserk') || u.brave < 10)) {
        aiBusy = false;
        return;
    }
    aiBusy = true;
    renderBattle();
    aiTimer = setTimeout(() => {
        if (game.battle !== b || modalName || dialogue || document.hidden || kit.paused) {
            aiBusy = false;
            return;
        }
        b.aiTurn();
        aiBusy = false;
        mode = 'inspect';
        target = null;
        inspectedId = '';
        afterAction();
    }, Math.max(150, 650 / game.options.speed));
}
function battleResult() {
    const b = game.battle;
    if (!b)
        return;
    clearTimeout(aiTimer);
    aiBusy = false;
    flushEvents();
    view.tileHighlights = {};
    view.target = null;
    const won = b.phase === 'won';
    $('#interface').innerHTML = `<div class="letterbox"></div><section class="result-card"><div class="eyebrow">${won ? 'The company prevails' : 'The chronicle need not end here'}</div><h1>${won ? 'Victory' : 'Defeat'}</h1><h3>${esc(b.mission.name)}</h3><div class="rule"></div>${won ? `<div class="rewards"><div><b>${fmt(500 + b.mission.level * 130 + b.gil)}</b><small>GIL AWARDED</small></div><div><b>${110 + game.chapter() * 20}</b><small>JP PER UNIT</small></div><div><b>${b.playerTurns || 0}</b><small>YOUR TURNS</small></div></div>${b.mission.arena ? arenaResult(b) : ''}<p>${b.mission.join?.length ? 'New allies: ' + b.mission.join.map(esc).join(', ') : 'Surviving company members recover before the next engagement.'}</p><p style="margin-top:9px">${b.treasuresFound.length ? 'Treasures: ' + b.treasuresFound.map(esc).join(', ') : 'Battle actions earned experience and job progress.'}</p><button class="primary" style="width:100%;margin-top:24px" data-act="victoryContinue">Continue the chronicle →</button>` : `<p>${esc(b.log.slice(-1)[0])}</p><p style="margin-top:13px">The pre-battle save is intact. Retry, change the difficulty, or return to the world to train and equip your company.</p><div class="stack" style="margin-top:22px"><button class="primary" data-act="retry">Retry this engagement</button><button data-act="returnWorld">Return to preparations</button><button class="ghost" data-act="options">Options</button></div>`}</section>`;
    // Keyboard and gamepad players land on the main choice; touch players just tap it.
    if (kit.input.source !== 'touch' && !modalName)
        $('.result-card .primary')?.focus({ preventScroll: true });
    saveAuto();
}
function victoryContinue() {
    const b = game.battle;
    if (!b || b.phase !== 'won')
        return;
    const m = b.mission, remaining = (m.banter || []).slice(b.banterIndex || 0), r = game.finishBattle();
    if (!r)
        return;
    saveAuto();
    closeModal(false);
    if (r.arena) {
        const a = r.arena, bits = [a.medal + ' medal in ' + a.turns + ' turns'];
        if (a.newBest && !a.first)
            bits.push('new record');
        if (a.reward)
            bits.push('prize: ' + a.reward[0] + (a.reward[1] > 1 ? ' ×' + a.reward[1] : ''));
        if (a.goldGil)
            bits.push('gold purse ' + fmt(a.goldGil) + ' gil');
        toast(bits.join(' · ') + '.');
    }
    const outro = Array.isArray(m.outro) ? m.outro : String(m.outro || '').split('\n').filter(Boolean).map((l) => ({ speaker: l.split('|')[0], text: l.split('|').slice(1).join('|') }));
    showDialogue([...remaining, ...outro], m.name, () => {
        if (m.ending)
            showEnding();
        else
            world();
    }, m.ending ? 'ending' : 'world');
}
function recover(retry = false) {
    const m = game.battle?.mission, opts = clone(game.options);
    if (preBattle) {
        try {
            game = GameModel.restore(clone(preBattle));
        }
        catch (error) {
            toast('The recovery point is not valid. Export this save before you leave.');
            return;
        }
    }
    else
        game.battle = null;
    game.options = opts;
    applyOptions();
    if (retry && m)
        startMission(m);
    else
        world();
}
function showEnding() { dialogue = null; preBattle = null; closeModal(false); setScreen('ending'); view.setBattle(null); saveAuto(); $('#interface').innerHTML = `<section class="ending texture"><div class="ending-content">${CREST}<div class="eyebrow">The last page of the Durai Papers</div><h1>What history forgot</h1><p>Altima falls in the ancient airship. Alma is free. The church’s account will not record the company’s victory.</p><p>At Alma’s funeral, Olan sees Ramza and Alma ride past on chocobos. He calls to them, but they continue on their way.</p><div class="rule"></div><p>Delita has won the throne. Ovelia believes that he used everyone around him. When he brings her flowers, she stabs him. He strikes back. She falls, and he is left with his question.</p><p><i>What did Ramza gain?</i></p><div class="rule"></div><p>Olan writes the truth. The church condemns him for heresy and burns him at the stake. His papers remain hidden for centuries.</p><p>Alazlam Durai recovers those pages. The account of the man called a heretic can finally be told.</p><div class="rule"></div><div class="eyebrow">Campaign complete</div><div class="rewards"><div><b>${game.state.stats.wins}</b><small>VICTORIES</small></div><div><b>${game.state.day}</b><small>DAYS</small></div><div><b>${game.state.roster.length}</b><small>COMPANIONS</small></div></div><p style="font:12px/1.6 system-ui">The side journeys and Deep Dungeon remain open. This build uses new battlefield layouts and adapted combat rules. See the coverage report for source differences.</p><div class="row" style="margin:28px 0"><button class="primary" data-act="world">Return to Ivalice</button><button data-act="endingScript">Full ending scenes</button><button data-act="saves">Save the chronicle</button></div><small>THE LION’S OATH · 2026-09-25 · GPT-6 ASTRA PRO</small></div></section>`; }
function itemDescription(n) {
    const a = item(n), v = [];
    for (const [k, l] of [['power', 'Power'], ['hp', 'HP'], ['mp', 'MP'], ['pa', 'Attack'], ['ma', 'Magic'], ['speed', 'Speed'], ['move', 'Move'], ['jump', 'Jump'], ['evade', 'Evade']])
        if (a[k])
            v.push(l + ' ' + a[k]);
    for (const [k, l] of [['auto', 'Auto'], ['immune', 'Immune'], ['element', 'Element'], ['absorb', 'Absorb'], ['half', 'Resist'], ['boost', 'Boost'], ['proc', 'Chance'], ['cast', 'Spell']])
        if (a[k])
            v.push(l + ': ' + a[k]);
    if (a.range)
        v.push('Range ' + a.range);
    if (a.drain)
        v.push('Drains HP');
    if (a.slot === 'item')
        v.push(DB.skills[n]?.description || 'Consumable');
    return v.join(' · ') || a.type || 'No equipment';
}
function passiveDescription(n) {
    const a = DB.skills[n];
    if (/^Move \+[123]$/.test(n))
        return 'Add ' + n.slice(-1) + ' to movement range while this trait is equipped.';
    if (/^Jump \+[123]$/.test(n))
        return 'Add ' + n.slice(-1) + ' to the height this unit can cross while moving.';
    if (a?.passive === 'jumpRange')
        return 'Increase the Jump action range to ' + a.power + ' tiles. The highest learned range applies. No trait slot is needed.';
    if (a?.passive === 'jumpHeight')
        return 'Allow the Jump action to cross a height difference of ' + a.power + '. The highest learned height applies. No trait slot is needed.';
    if (a?.passive === 'math')
        return ['CT', 'Level', 'EXP', 'Height'].includes(n.slice(5)) ? 'Use ' + n.slice(5) + ' as the target property for Arithmetic. Also learn a divisor and a spell.' : n === 'Math Prime' ? 'Use the prime-number test for Arithmetic. Also learn a target property and a spell.' : 'Use ' + n.slice(5) + ' as the divisor for Arithmetic. Also learn a target property and a spell.';
    const t = {
        'Move-Find Item': 'Find hidden items when you stop on their tile. Lower Brave improves the rare-item chance.',
        'Equip Change': 'Spend a battle action to change equipment.',
        'Maintenance': 'Protect equipped items from theft and breakage.',
        'Gained JP Up': 'Increase JP earned from battle actions by 50%.',
        'Gained EXP Up': 'Increase EXP earned from battle actions by 50%.',
        'Two Swords': 'Equip a second weapon in the shield slot. A normal strike uses both weapons.',
        'Two Hands': 'Increase physical damage with an empty shield slot.',
        'Short Charge': 'Reduce charge time by half, rounded up.',
        'Half MP': 'Reduce MP costs by half, rounded up.',
        'Secret Hunt': 'Poach monsters defeated by normal strikes. Buy the resulting stock at the Fur Shop.',
        'Train': 'A monster reduced to critical HP can join the company. A free roster slot is required.',
        'Monster Skill': 'Give adjacent allied monsters their additional command.',
        'Monster Talk': 'Allow speech abilities to affect monsters outside the Mediator job.',
        'Throw Item': 'Use learned medicine commands from up to four tiles away.',
        'Concentrate': 'Ignore normal physical evasion. Darkness can still reduce accuracy.',
        'Attack Up': 'Increase physical damage while this support trait is equipped.',
        'Defense Up': 'Reduce incoming physical damage.',
        'Magic Attack Up': 'Increase the power of magic effects.',
        'Magic Defense Up': 'Reduce the power of incoming magic effects.',
        'Martial Arts': 'Increase the power of unarmed strikes.',
        'Any Weather': 'Remove the bow accuracy penalty in rain.',
        'Any Ground': 'Ignore extra movement costs in water and swamps.',
        'Teleport': 'Cross obstacles. Movement beyond normal range can fail.',
        'Fly': 'Move over intervening obstacles and height differences.',
        'Ignore Height': 'Ignore height differences during movement.',
        'Move on Lava': 'Allow movement over lava.',
        'Walk on Water': 'Cross water without the extra movement cost.',
        'Move in Water': 'Cross water without the extra movement cost.',
        'Move HP Up': 'Recover HP after movement. A move that gives this benefit cannot be undone.',
        'Move MP Up': 'Recover MP after movement. A move that gives this benefit cannot be undone.',
        'Move-Get EXP': 'Gain EXP after movement. A move that gives this benefit cannot be undone.',
        'Move-Get JP': 'Gain JP after movement. A move that gives this benefit cannot be undone.',
        'Auto Potion': 'On a successful reaction check, use the strongest stocked potion. Company medicine is consumed.',
        'Counter': 'On a successful reaction check, answer a physical hit with a normal strike if the attacker is in range.',
        'Counter Tackle': 'On a successful reaction check, answer a physical hit with a weaker physical counter if the attacker is in range.',
        'Meatbone Slash': 'Below one-quarter HP, a successful reaction can answer a physical hit with damage based on maximum HP.',
        'Weapon Guard': 'Use weapon evasion against attacks from the front.',
        'Arrow Guard': 'Reduce the chance that bows and crossbows hit this unit.',
        'Blade Grasp': 'Reduce physical hit chance according to this unit’s Brave.',
        'Abandon': 'Improve the evasion supplied by equipment.',
        'Counter Magic': 'On a successful reaction check, return an incoming MP-based magic effect to its caster.',
        'HP Restore': 'Below one-quarter HP, a successful reaction restores HP.',
        'MP Restore': 'Below one-quarter HP, a successful reaction restores MP.',
        'Regenerator': 'A successful reaction gives Regen.',
        'Dragon Spirit': 'A successful reaction gives Reraise.',
        'Caution': 'A successful reaction sets a defensive guard.',
        'Sunken State': 'A successful reaction makes the unit Transparent.',
        'Critical Quick': 'Below one-quarter HP, a successful reaction fills CT to 100.',
        'Gilgame Heart': 'A successful reaction adds gil based on damage received.',
        'Absorb Used MP': 'A successful reaction restores MP based on the incoming ability’s MP cost.',
        'Damage Split': 'A successful reaction heals half the damage received and returns that amount to the attacker.',
        'Distribute': 'Share excess healing with nearby active allies.',
        'Speed Save': 'A successful reaction adds Speed for this battle.',
        'A Save': 'A successful reaction adds physical attack for this battle.',
        'MA Save': 'A successful reaction adds magic attack for this battle.',
        'Brave Up': 'A successful reaction adds three Brave, up to 100.',
        'Face Up': 'A successful reaction adds three Faith, up to 100.',
        'Counter Flood': 'A successful reaction uses the Geomancy effect of the ground under this unit, if the attacker is close enough.',
        'Finger Guard': 'Block incoming speech abilities.',
        'Catch': 'Use a Brave-based check to catch a thrown item instead of taking its damage.',
        'MP Switch': 'Use a Brave-based check to take damage from MP before HP.',
        'Hamedo': 'Use a Brave-based check to strike first against a normal attack from a nearby enemy.',
    };
    if (t[n])
        return t[n];
    if (n === 'Equip Armor')
        return 'Allow armor and helmets outside armored jobs.';
    if (n === 'Equip Shield')
        return 'Allow shields outside shield-using jobs.';
    if (n.startsWith('Equip '))
        return 'Allow ' + n.slice(6).toLowerCase() + ' weapons outside their normal jobs.';
    return a?.description || 'Equip this learned trait to apply its effect.';
}
function showFormation(id, tab) {
    if (game.battle && game.battle.phase !== 'deploy') {
        toast('Change the company before a battle. Equip Change works during combat.');
        return;
    }
    modalName = 'formation';
    if (id)
        rosterId = id;
    if (tab)
        formationTab = tab;
    if (!game.roster(rosterId))
        rosterId = game.state.roster.find((u) => !u.dead)?.id;
    const u = game.roster(rosterId);
    if (!u)
        return;
    const s = stats(u), jobs = Object.keys(DB.jobs).filter(j => !DB.jobs[j].special || j === u.native || j === u.job);
    if (!learnJob || !DB.jobs[learnJob] || !unlocked(u, learnJob))
        learnJob = u.job;
    let body = '';
    if (formationTab === 'jobs')
        body = `<p>Earn JP to raise job levels and unlock new jobs. Learned skills are retained.</p><div class="job-grid">${jobs.map(j => { const a = DB.jobs[j], ok = unlocked(u, j); return `<button class="job-button ${j === u.job ? 'selected' : ''}" data-act="changeJob" data-name="${esc(j)}" ${ok ? '' : 'disabled'}><b>${esc(j)}</b><small>${ok ? 'Job Lv ' + jobLevel(u, j) + ' · ' + (u.jp[j] || 0) + ' JP' : Object.entries(a.req || {}).map(([n, l]) => n + ' ' + l).join(' · ') || 'Special job'}</small></button>`; }).join('')}</div>`;
    if (formationTab === 'learn')
        body = `<div class="loadout-row"><label>Job skill list</label><select data-change="learnJob">${jobs.filter(j => unlocked(u, j) || j === u.job).map(j => `<option value="${esc(j)}" ${j === learnJob ? 'selected' : ''}>${esc(j)} · ${u.jp[j] || 0} JP</option>`).join('')}</select></div><div class="skill-list">${DB.jobs[learnJob].skills.map((n) => { const a = DB.skills[n], known = u.learned.includes(n); return `<article class="skill-card"><h4>${esc(n)}</h4><p>${esc(a.kind === 'passive' ? passiveDescription(n) : a.description)}</p><div class="row spread"><span class="cost">${a.learnOnly ? 'Learn in battle' : a.cost + ' JP'}</span><button data-act="learn" data-name="${esc(n)}" class="${known ? 'ghost' : 'primary'}" ${known || a.learnOnly || u.away || u.dead || isMonster(u) || u.job === 'Steel Giant' || (u.jp[learnJob] || 0) < a.cost ? 'disabled' : ''}>${known ? 'Learned' : 'Learn'}</button></div></article>`; }).join('')}</div>`;
    if (formationTab === 'equipment')
        body = `<div class="row spread" style="margin-top:18px"><p>Bonuses apply in battle.</p><button class="tiny" data-act="optimize" ${u.away || u.dead ? 'disabled' : ''}>Optimize owned gear</button></div><div class="equipment-list">${['weapon', 'shield', 'head', 'body', 'accessory'].map(sl => `<div class="equipment-row"><span class="slot">${sl}</span><button data-act="equipSlot" data-name="${sl}" ${u.away || u.dead ? 'disabled' : ''}>${esc(u.equip[sl] || 'Choose equipment')}<small style="display:block;margin-top:5px">${esc(itemDescription(u.equip[sl]))}</small></button>${u.equip[sl] ? `<button class="remove ghost" ${u.away || u.dead ? 'disabled' : ''} data-act="unequip" data-name="${sl}" aria-label="Unequip ${sl}">×</button>` : ''}</div>`).join('')}</div>`;
    if (formationTab === 'loadout')
        body = `<p>Combine your current job with one secondary command set and three learned traits.</p><div class="loadout-row"><label>Secondary</label><select data-change="secondary" ${u.away || u.dead || isMonster(u) || u.job === 'Steel Giant' ? 'disabled' : ''}><option value="">None</option>${Object.keys(DB.jobs).filter(j => (!DB.jobs[j].special || j === u.native) && u.learned.some((n) => DB.skills[n]?.job === j && DB.skills[n].kind !== 'passive')).map(j => `<option ${u.secondary === j ? 'selected' : ''}>${esc(j)}</option>`).join('')}</select></div>${['reaction', 'support', 'movement'].map(sl => `<div class="loadout-row"><label>${sl}</label><select data-change="loadout" data-slot="${sl}" ${u.away || u.dead || isMonster(u) || u.job === 'Steel Giant' ? 'disabled' : ''}><option value="">None</option>${u.learned.filter((n) => DB.skills[n]?.passive === sl).map((n) => `<option ${u[sl] === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`).join('')}${isMonster(u) ? '<div class="quest-card"><h3>Monster eggs</h3><p>An egg hatches after five days. The hatchling belongs to this monster family.</p><button data-act="breed">Arrange nesting · 200 gil</button></div>' : ''}`;
    modal('The company', `<div class="formation"><aside class="roster-list">${game.state.roster.map((r) => `<button class="roster-unit ${r.id === u.id ? 'selected' : ''}" data-act="roster" data-id="${r.id}">${portrait(r)}<div><b>${esc(r.name)}</b><small>Lv ${r.level} · ${esc(r.job)}${r.away ? ' · Away' : r.dead ? ' · Lost' : ''}</small></div>${game.state.party.includes(r.id) ? '<span class="in-party">◆</span>' : ''}</button>`).join('')}<button data-act="hire" class="ghost">+ Recruit · 500 gil</button></aside><section class="unit-detail"><div class="unit-detail-header">${portrait(u, true)}<div class="grow"><div class="eyebrow">${u.unique ? 'Companion' : 'Company member'}</div><h2>${esc(u.name)}</h2><p>Lv ${u.level} · ${u.exp}/100 EXP · Brave ${u.brave} · Faith ${u.faith}</p></div><button data-act="partyToggle" class="${game.state.party.includes(u.id) ? 'selected' : 'primary'}" ${u.name === 'Ramza' || u.away || u.dead ? 'disabled' : ''}>${game.state.party.includes(u.id) ? 'Deployed' : 'Deploy'}</button></div><div class="stats">${[['HP', s.hp], ['MP', s.mp], ['ATK', s.pa], ['MAG', s.ma], ['Move', s.move], ['Jump', s.jump]].map(([n, v]) => `<div class="stat">${n}<b>${v}</b></div>`).join('')}</div><div class="tabs unit-tabs">${[['jobs', 'Jobs'], ['learn', 'Learn'], ['equipment', 'Equipment'], ['loadout', 'Abilities']].map(([id, n]) => `<button class="${formationTab === id ? 'selected' : ''}" data-act="formationTab" data-name="${id}">${n}</button>`).join('')}</div>${u.away || u.dead ? '<div class="note">This unit is not available for changes.</div>' : ''}${body}${!u.unique && !u.away ? '<button class="danger tiny" style="margin-top:20px" data-act="dismiss">Release company member</button>' : ''}${game.state.pendingRecruits?.length ? '<div class="note">Waiting to join: ' + game.state.pendingRecruits.map((r) => esc(r.name)).join(', ') + '. Release a generic unit to make room.</div>' : ''}</section></div>`, 'Job points · skills · equipment', false, `<span>◆ ${game.state.party.length} / 5 deployed</span><span>${fmt(game.state.gil)} gil</span>`);
}
function equipPicker(slot, battle = false) { const u = battle ? game.battle.active() : game.roster(rosterId), inv = battle ? game.battle.inventory : game.state.inventory; modalName = battle ? 'battleEquipPick' : 'equipPick'; modal('Equip ' + slot, `<p>${battle ? 'This uses your action.' : 'The old item returns to the shared inventory.'}</p><div class="item-grid">${Object.keys(inv).filter(n => inv[n] > 0 && canEquip(u, n, slot)).sort((a, b) => (item(b).power || item(b).hp || 0) - (item(a).power || item(a).hp || 0)).map(n => `<button class="item-card" data-act="${battle ? 'equipBattleItem' : 'equipItem'}" data-slot="${slot}" data-name="${esc(n)}"><h4>${esc(n)}</h4><small>Stock ${inv[n]}</small><div class="desc">${esc(itemDescription(n))}</div></button>`).join('') || '<div class="empty">No compatible equipment in inventory.</div>'}</div>`, u.name, false, `<button class="tiny" data-act="${battle ? 'battleEquip' : 'formation'}">← Back</button>`); }
function optimize() {
    const u = game.roster(rosterId);
    let count = 0;
    for (const sl of ['weapon', 'head', 'body', 'shield', 'accessory']) {
        const score = (n) => { const a = item(n); return (a.power || 0) * 4 + (a.hp || 0) * .4 + (a.mp || 0) * .3 + (a.evade || 0) * .7 + (a.speed || 0) * 14 + (a.pa || 0) * 10 + (a.ma || 0) * 8 + (a.move || 0) * 12 + (a.auto ? 25 : 0); };
        const v = Object.keys(game.state.inventory).filter(n => game.state.inventory[n] > 0 && canEquip(u, n, sl)).sort((a, b) => score(b) - score(a));
        if (v[0] && score(v[0]) > score(u.equip[sl])) {
            if (game.equip(u.id, v[0], sl))
                count++;
        }
    }
    saveAuto();
    showFormation();
    toast(count ? 'Improved ' + count + ' slots.' : 'No stronger compatible gear in inventory.');
}
function showHire() { modalName = 'hire'; modal('A new companion', `<p>Recruit a Squire. Generic companions can change jobs and take tavern assignments.</p><div class="stack" style="margin-top:18px"><label>Name<input id="recruit-name" maxlength="24" value="Recruit ${game.state.uid + 1}"></label><label>Character type<select id="recruit-sex"><option value="F">Female</option><option value="M">Male</option></select></label><button class="primary" data-act="hireConfirm">Recruit · 500 gil</button></div>`, 'Soldier office', true); }
function showShop(m) {
    modalName = 'shop';
    if (m)
        shopMode = m;
    const inv = game.state.inventory, ch = game.chapter();
    const names = Object.keys(DB.items).filter(n => { const a = item(n); return (shopMode === 'sell' ? inv[n] > 0 : shopMode === 'fur' ? (game.state.poach[n] || 0) > 0 : !a.rare && a.tier <= ch && a.price > 0) && (shopFilter === 'all' || a.slot === shopFilter) && n.toLowerCase().includes(shopQuery.toLowerCase()); });
    modal(shopMode === 'fur' ? 'Fur Shop' : 'The outfitter', `<div class="row spread"><div class="tabs">${[['buy', 'Purchase'], ['sell', 'Sell'], ['fur', 'Fur Shop']].map(([id, n]) => `<button class="${shopMode === id ? 'selected' : ''}" data-act="shopMode" data-name="${id}">${n}</button>`).join('')}</div><span class="gold">${fmt(game.state.gil)} gil</span></div><div class="shop-toolbar"><input id="shop-search" type="search" value="${esc(shopQuery)}" placeholder="Search equipment and items"><select data-change="shopFilter">${[['all', 'All types'], ['weapon', 'Weapons'], ['head', 'Headgear'], ['body', 'Body armor'], ['shield', 'Shields'], ['accessory', 'Accessories'], ['item', 'Consumables']].map(([id, n]) => `<option value="${id}" ${shopFilter === id ? 'selected' : ''}>${n}</option>`).join('')}</select></div>${shopMode === 'fur' ? '<p>Equip Secret Hunt and defeat a monster with a normal attack to add stock.</p>' : ''}<div class="item-grid">${names.map(n => { const a = item(n), price = shopMode === 'sell' ? Math.max(1, Math.floor(a.price * .5)) : shopMode === 'fur' ? Math.max(100, Math.round(a.price * .5)) : a.price; return `<article class="item-card"><small>${esc(a.type)}${a.rare ? ' · RARE' : ''}</small><h4>${esc(n)}</h4><div class="desc">${esc(itemDescription(n))}</div><div class="row spread"><span class="price">${fmt(price)} gil</span><small>Owned ${inv[n] || 0}</small></div><button class="primary" data-act="trade" data-name="${esc(n)}" ${shopMode !== 'sell' && game.state.gil < price ? 'disabled' : ''}>${shopMode === 'sell' ? 'Sell one' : 'Purchase one'}</button></article>`; }).join('') || '<div class="empty">No matching stock.</div>'}</div>`, 'Weapons · armor · medicine', false, 'Assign purchased gear in Company → Equipment.');
    const input = $('#shop-search');
    input.oninput = () => { shopQuery = input.value; showShop(); const next = $('#shop-search'); next.focus(); next.setSelectionRange?.(next.value.length, next.value.length); };
}
function questAvailability() {
    const s = game.state, f = s.flags, done = (id) => s.completed.includes(id), a = [];
    if (f.beowulf)
        for (let i = 0; i < 4; i++)
            if (!done('c' + i) && (i === 0 || done('c' + (i - 1)))) {
                a.push(game.mission('c' + i));
                break;
            }
    if (f.island && f.worker8 && f.flower && !done('nel'))
        a.push(game.mission('nel'));
    if (f.cloudSummoned && !done('cloud'))
        a.push(game.mission('cloud'));
    if (f.cloud && !done('blade'))
        a.push(game.mission('blade'));
    if (f.deepDungeon)
        for (let i = 0; i < 10; i++)
            if (!done('d' + i) && (i === 0 || done('d' + (i - 1)))) {
                a.push(game.mission('d' + i));
                break;
            }
    return a.filter(Boolean);
}
function questHint() {
    const s = game.state, f = s.flags;
    if (s.next < 35)
        return 'The recruitment journeys open in Chapter IV. Tavern assignments open in Chapter II.';
    if (!f.flower)
        return 'Visit the flower seller in Zarghidas.';
    if (!f.gougBall)
        return 'Visit Goug with Mustadio. Besrodio has found a steel sphere.';
    if (!f.ghost)
        return 'Ask about the ghost at the Goland tavern.';
    if (!f.beowulf)
        return 'Meet Beowulf at Lesalia.';
    if (!f.colliery)
        return 'Clear four colliery levels and rescue Reis.';
    if (!f.worker8)
        return 'Return to Goug with the colliery stone.';
    if (!f.island)
        return 'Ask the Zeltennia tavern about the cursed island.';
    if (!f.nelveska)
        return 'Defeat Worker 7 at Nelveska.';
    if (!f.cloudSummoned)
        return 'Return to Goug to test another machine.';
    if (!f.cloud)
        return 'Rescue the stranger in Zarghidas.';
    if (!s.completed.includes('blade'))
        return 'Find the Materia Blade at Bervenia Volcano.';
    if (!f.deepDungeon)
        return s.next >= 50 ? 'Ask about Deep Dungeon at Warjilis.' : 'After the Murond battles, ask about Deep Dungeon at Warjilis.';
    return 'Search each Deep Dungeon floor for hidden stairs and treasure. Equip Move-Find Item to find the rare gear.';
}
function rumorList(city) {
    const s = game.state, f = s.flags, a = [];
    const add = (id, title, text, cost = 0) => a.push({ id, title, text, cost });
    if (s.next >= 35 && city === 'Zarghidas' && !f.flower)
        add('flower', 'A flower in wartime', 'Buy a blossom from the flower seller.', 1);
    if (s.next >= 35 && city === 'Goug' && !f.gougBall && s.roster.some((u) => u.name === 'Mustadio'))
        add('gougBall', 'Besrodio’s discovery', 'The steel sphere has a socket that resembles a Zodiac Stone.');
    if (f.gougBall && city === 'Goland' && !f.ghost)
        add('ghost', 'Ghost of the colliery', 'Miners fear the abandoned workings. A knight has been asking about them.');
    if (f.ghost && city === 'Lesalia' && !f.beowulf)
        add('beowulf', 'A knight’s search', 'Beowulf asks for help to find Reis, the woman he loves.');
    if (f.colliery && city === 'Goug' && !f.worker8)
        add('worker8', 'The steel giant awakens', 'The stone fits the sphere. Worker 8 awaits an order.');
    if (f.worker8 && city === 'Zeltennia' && !f.island)
        add('island', 'The cursed island', 'An ancient construct guards the ruins of Nelveska.');
    if (f.nelveska && f.worker8 && city === 'Goug' && !f.cloudSummoned)
        add('cloudSummoned', 'Beyond a distant sky', 'Besrodio’s second machine opens a path to a distant world.');
    if (s.next >= 50 && city === 'Warjilis' && !f.deepDungeon)
        add('deepDungeon', 'Below the harbor', 'A sailor tells of ten buried chambers and their hidden exits.');
    return a;
}
function hearRumor(id) {
    const card = rumorList(tavernCity).find((a) => a.id === id);
    if (!card || game.state.gil < card.cost)
        return;
    game.state.gil -= card.cost;
    game.state.flags[id] = true;
    if (id === 'worker8')
        game.addUnit('Worker 8', 'Steel Giant');
    game.state.history.push(card.title + '.');
    saveAuto();
    play('treasure');
    const lines = DB.questScenes?.[id];
    if (lines?.length) {
        closeModal(false);
        showDialogue(lines, card.title, () => { renderWorld(); showTavern(); }, 'tavern');
    }
    else {
        showTavern();
        toast(card.title + '.');
    }
}
/*
 * The Dorter Proving Ring: six staged bouts added in the 2026 upgrade. They run on the normal battle
 * rules with their own map theme ('arena'), a par in the company's own turns, medals, records kept in
 * the save (state.flags 'arena:<id>'), a prize on the first clear and a purse for the first gold medal.
 */
const ARENA = [
    { id: 'a1', name: 'Proving Ring · First Blood', level: 5, par: 14, need: 1, enemies: 'Goblin:2,Squire:2,Chocobo:1', objective: 'defeat', reward: ['Power Wrist', 1], goldGil: 600,
        blurb: 'Two hired brawlers, their goblins and a hungry chocobo. Learn the sand before it learns you.',
        intro: [['Ring Master', 'Dorter pays for blood on the sand, young lord. Six bouts, one crowd, and a record kept for each.'], ['Ramza', 'We came to train, not to kill. Hold the line together and let them come to us.'], ['Ring Master', 'Finish inside the par and the purse is gold. First bout: two brawlers, their goblins and a hungry bird.']],
        outro: [['Ring Master', 'The crowd liked that. Come back when you want a harder lesson.']] },
    { id: 'a2', name: 'Proving Ring · The Lone Lion', level: 8, par: 9, need: 4, ramzaOnly: true, enemies: 'Goblin:2,Black Goblin:1', objective: 'defeat', reward: ['Germinas Boots', 1], goldGil: 900,
        blurb: 'Ramza enters alone. No healers and no guests, only what he carries.',
        intro: [['Ring Master', 'This bout is for the one whose name is on the contract. No healers. No friends.'], ['Ramza', 'Then watch closely. I will not need them today.']],
        outro: [['Ring Master', 'Alone and still standing. The betting slips have your name on them now.']] },
    { id: 'a3', name: 'Proving Ring · Shield of the Weak', level: 14, par: 16, need: 8, enemies: 'Thief:2,Archer:2,Red Panther:1', guests: ['Herald Tomas'], guestJobs: { 'Herald Tomas': 'Chemist' }, objective: 'protect:Herald Tomas', reward: ['Aegis Shield', 1], goldGil: 1400,
        blurb: 'The herald carries the purse into the ring. Keep him standing while the thieves go for it.',
        intro: [['Ring Master', 'The herald carries the purse into the ring. If he falls, the purse is theirs and so is the bout.'], ['Herald Tomas', 'I only read the names! Nobody told me I would be standing in the middle.'], ['Ramza', 'Stay near us, Tomas. We will keep them off you.']],
        outro: [['Herald Tomas', 'I am never volunteering again. Thank you, all of you.']] },
    { id: 'a4', name: 'Proving Ring · The Champion’s Due', level: 22, par: 14, need: 14, enemies: 'Knight:2,Archer:1,Monk:1', boss: 'Champion Varrick', bossJob: 'Samurai', objective: 'leader', reward: ['Sprint Shoes', 1], goldGil: 2200,
        blurb: 'Six seasons unbeaten. Bring down Champion Varrick; his seconds do not matter.',
        intro: [['Champion Varrick', 'Six seasons unbeaten. The crowd came to see me, not a disgraced noble’s son.'], ['Ramza', 'Then we will give them something new to see.'], ['Ring Master', 'Bring down the champion. His seconds do not matter.']],
        outro: [['Champion Varrick', 'Well fought. Take the belt. I was getting tired of polishing it.']] },
    { id: 'a5', name: 'Proving Ring · Beasts of the Pit', level: 30, par: 18, need: 22, enemies: 'Behemoth:1,Red Panther:2,Bull Demon:2,Cockatoris:1', objective: 'defeat', reward: ['Elixir', 3], goldGil: 3000,
        blurb: 'The menagerie gates open. Bring Soft: the Cockatoris turns fighters to stone.',
        intro: [['Ring Master', 'The menagerie is hungry and the gates are old. Watch the Cockatoris. Stone does not heal on its own.'], ['Ramza', 'Soft and Remedy close at hand. Keep the behemoth away from the wounded.']],
        outro: [['Ring Master', 'My handlers will be days putting that behemoth back in its cage. The crowd wants you every week.']] },
    { id: 'a6', name: 'Proving Ring · Crown of the Ring', level: 40, par: 20, need: 34, enemies: 'Ninja:2,Wizard:2,Summoner:1', boss: 'Grand Champion Aldous', bossJob: 'Holy Knight', objective: 'leader', reward: ['Bracer', 1], goldGil: 5000,
        blurb: 'The last bout. A former knight of the Order and his hired mages hold the crown of the ring.',
        intro: [['Grand Champion Aldous', 'I fought for the Order before I fought for coin. Holy steel does not care whose side you are on.'], ['Ramza', 'Neither does the truth. Draw your sword.'], ['Ring Master', 'The last bout. Bring down the Grand Champion and the ring is yours.']],
        outro: [['Grand Champion Aldous', 'The crown of the ring. Wear it lightly. They will forget you by the next war.'], ['Ramza', 'I am counting on it.']] },
];
function arenaOpen(i) { return game.state.next >= ARENA[i].need && (i === 0 || game.state.completed.includes(ARENA[i - 1].id)); }
function arenaMission(a) {
    const line = ([speaker, text]) => ({ speaker, text });
    return { id: a.id, name: a.name, area: 'Dorter', theme: 'arena', chapter: game.chapter(), level: a.level, enemies: a.enemies, boss: a.boss || '', bossJob: a.bossJob || '', objective: a.objective, guests: a.guests || [], guestJobs: a.guestJobs || {}, ramzaOnly: !!a.ramzaOnly, intro: a.intro.map(line), outro: a.outro.map(line), brief: a.blurb, optional: true, arena: true, par: a.par, reward: a.reward, goldGil: a.goldGil };
}
function startArena(id) {
    const i = ARENA.findIndex(a => a.id === id);
    if (i < 0 || !arenaOpen(i))
        return;
    startMission(arenaMission(ARENA[i]));
}
function arenaCard() {
    const s = game.state, rows = ARENA.map((a, i) => {
        const best = Number(s.flags['arena:' + a.id]) || 0, done = s.completed.includes(a.id), open = arenaOpen(i);
        const status = [`Lv ${a.level}`, `Par ${a.par} turns`, best ? `Best ${best} · ${arenaMedal(a.par, best)}` : '', !open ? (s.next < a.need ? 'Opens later in the story' : 'Clear the previous bout') : ''].filter(Boolean).join(' · ');
        return `<div class="journal-row"><span class="mark">${best && arenaMedal(a.par, best) === 'Gold' ? '★' : done ? '◆' : '◇'}</span><div class="grow">${esc(a.name.split(' · ')[1])}<small style="display:block">${esc(status)}</small><small style="display:block;opacity:.75">${esc(a.blurb)}</small></div><button class="tiny ${open ? 'primary' : 'ghost'}" data-act="arenaBout" data-id="${a.id}" ${open ? '' : 'disabled'}>${done ? 'Rematch' : 'Enter'}</button></div>`;
    }).join('');
    return `<article class="quest-card"><div class="eyebrow">Dorter · Proving Ring</div><h3>Bouts of the Proving Ring</h3><p>Staged bouts before a paying crowd. Each bout has a par counted in your company’s turns: finish at or under par for gold, within six turns for silver. The first clear pays a prize and the first gold pays a purse. Records are kept.</p>${rows}</article>`;
}
function arenaResult(b) {
    const m = b.mission, turns = b.playerTurns || 0, medal = arenaMedal(m.par, turns), best = Number(game.state.flags['arena:' + m.id]) || 0, first = !game.state.completed.includes(m.id);
    return `<p><b class="gold">${medal} medal</b> · ${turns} of your turns · par ${m.par}${best ? ' · best so far ' + best : ''}</p>${first && m.reward ? `<p style="margin-top:6px">First-clear prize: ${esc(m.reward[0])}${m.reward[1] > 1 ? ' ×' + m.reward[1] : ''}</p>` : ''}${medal === 'Gold' && m.goldGil && !game.state.flags['arenaGold:' + m.id] ? `<p style="margin-top:6px">Gold purse: ${fmt(m.goldGil)} gil</p>` : ''}`;
}
function showQuests() { modalName = 'quests'; const a = questAvailability(); modal('Side journeys', `<div class="note">${esc(questHint())}</div>${arenaCard()}${a.map(m => `<article class="quest-card"><div class="eyebrow">${esc(m.area)} · Suggested Lv ${m.level}</div><h3>${esc(m.name)}</h3><p>${esc(campaignBrief(m))}</p><button class="primary" data-act="sideMission" data-id="${m.id}">Set forth →</button></article>`).join('') || '<div class="quest-card"><h3>Follow the rumors</h3><p>Travel to settlements. Hear local accounts at their taverns to open recruitment journeys.</p><button data-act="tavern">Visit a tavern</button></div>'}<div class="quest-card"><h3>Road patrol</h3><p>Practice jobs in a repeatable battle. Enemy levels follow your strongest deployed companion. Earn EXP, JP, gil, and poaching stock.</p><button data-act="skirmish">Patrol ${esc(game.state.place)}</button></div><div class="quest-card"><h3>Completed journeys</h3><p>${DB.sideMissions.filter((m) => game.state.completed.includes(m.id)).map((m) => esc(m.name)).join(' · ') || 'No optional engagements completed.'}</p></div>`, 'Recruitment · relics · Deep Dungeon', false, 'Optional journeys remain open after the ending.'); }
function tavernCities() { return [...new Set(['Igros', 'Gariland', 'Dorter', 'Goug', 'Goland', 'Lesalia', 'Zeltennia', 'Zarghidas', 'Warjilis', ...DB.propositions.map((p) => p.city)])].filter(n => (DB.places.find((p) => p[0] === n)?.[4] || 1) <= game.chapter()); }
function showTavern() {
    modalName = 'tavern';
    if (!tavernCities().includes(tavernCity))
        tavernCity = 'Gariland';
    const s = game.state, props = DB.propositions.filter((p) => p.city === tavernCity && p.chapter <= game.chapter() && (!p.late || s.next >= 50));
    let body = '';
    if (tavernTab === 'rumors') {
        const a = rumorList(tavernCity);
        body = a.map((r) => `<article class="quest-card"><div class="eyebrow">A local account</div><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p><button class="primary" data-act="rumor" data-name="${r.id}" ${s.gil < r.cost ? 'disabled' : ''}>${r.cost ? 'Pay ' + r.cost + ' gil' : 'Hear the account'} →</button></article>`).join('') || `<div class="quest-card"><h3>News from the road</h3><p>${esc(questHint())}</p></div>`;
    }
    if (tavernTab === 'board')
        body = props.map((p) => { const d = s.dispatch.find((d) => d.pid === p.id), done = s.doneProps.includes(p.id); return `<article class="quest-card"><div class="eyebrow">${p.days} days · ${fmt(p.cost)} gil · ${esc(p.reward)}</div><h3>${esc(p.name)}</h3><p>${p.job ? 'Recommended job: ' + esc(p.job) : 'Assign three generic companions.'}</p>${done ? '<p class="gold">✓ Completed</p>' : d ? `<button data-act="claimProp" data-id="${p.id}" ${d.returnDay > s.day ? 'disabled' : ''}>${d.returnDay > s.day ? 'Return in ' + (d.returnDay - s.day) + ' days' : 'Receive the report'}</button>` : `<button data-act="sendProp" data-id="${p.id}" class="primary" ${s.gil < p.cost ? 'disabled' : ''}>Assign three companions</button>`}</article>`; }).join('') || '<div class="empty">No assignments here yet. Check another settlement or advance the story.</div>';
    if (tavernTab === 'reports')
        body = s.dispatch.map((d) => { const p = DB.propositions.find((p) => p.id === d.pid); return `<article class="quest-card"><h3>${esc(p.name)}</h3><p>${d.ids.map((id) => esc(game.roster(id)?.name)).join(', ')}</p><button data-act="claimProp" data-id="${p.id}" ${d.returnDay > s.day ? 'disabled' : ''}>${d.returnDay > s.day ? 'Return in ' + (d.returnDay - s.day) + ' days' : 'Receive report'}</button></article>`; }).join('') + `<div class="quest-card"><h3>Let the days pass</h3><p>Rest advances assignments and monster eggs. It does not grant EXP.</p><div class="row wrap">${[1, 5, 20].map(n => `<button data-act="restDays" data-n="${n}">Rest ${n} day${n > 1 ? 's' : ''}</button>`).join('')}</div></div><div class="quest-card"><h3>Discovery records</h3><p>${s.discoveries.map((d) => esc(d.name) + ' · ' + esc(d.kind)).join('<br>') || 'No discoveries yet.'}</p><p style="margin-top:12px">Discovery records are adapted. The original artifact and unexplored-land catalogs are not complete here.</p></div>`;
    modal('The tavern', `<div class="row spread"><select data-change="tavernCity" aria-label="Travel to tavern" style="max-width:230px">${tavernCities().map(c => `<option ${c === tavernCity ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="gold">Day ${s.day} · ${fmt(s.gil)} gil</span></div><div class="tabs" style="margin:17px 0">${[['rumors', 'Rumors'], ['board', 'Propositions'], ['reports', 'Reports & rest']].map(([id, n]) => `<button class="${tavernTab === id ? 'selected' : ''}" data-act="tavernTab" data-name="${id}">${n}</button>`).join('')}</div>${body}`, 'Rumors · expeditions · discoveries', false, 'Changing towns takes one travel day. Companions on assignment cannot be deployed.');
}
function propositionAssign(id) {
    const p = DB.propositions.find((p) => p.id === id);
    if (!p)
        return;
    modalName = 'assignProp';
    modal('Assign an expedition', `<h3>${esc(p.name)}</h3><p>Choose exactly three generic companions. Cost: ${fmt(p.cost)} gil. Duration: ${p.days} days.</p><div class="checklist">${game.state.roster.filter((u) => !u.unique && !u.away && !u.dead).map((u) => `<label><input type="checkbox" name="dispatch-unit" value="${u.id}"><span>${esc(u.name)} · ${esc(u.job)}</span></label>`).join('')}</div><button class="primary" data-act="sendPropConfirm" data-id="${id}">Send the three companions</button>`, 'Tavern assignment', true);
}
function showJournal() { modalName = 'journal'; modal('The chronicle', `<div class="tabs">${[1, 2, 3, 4].map(c => `<button class="${journalChapter === c ? 'selected' : ''}" data-act="journalChapter" data-n="${c}">Chapter ${ROMAN[c]}</button>`).join('')}</div><p>${game.state.next} / ${DB.missions.length} story stages cleared. Replay does not rewind the campaign.</p>${DB.missions.filter((m) => m.chapter === journalChapter).map((m) => `<div class="journal-row"><span class="mark">${game.state.completed.includes(m.id) ? '◆' : '◇'}</span><div class="grow">${esc(m.name)}<small style="display:block">${esc(m.area)}</small></div>${game.state.completed.includes(m.id) ? `<button class="ghost tiny" data-act="replay" data-id="${m.id}">Replay battle</button><button class="ghost tiny" data-act="readScene" data-id="${m.id}">Read scene</button>` : ''}</div>`).join('')}<div class="rule"></div><h3>Company record</h3><div class="battle-log">${game.state.history.slice(-35).reverse().map((s) => `<div>${esc(s)}</div>`).join('')}</div>`, 'A record outside the official histories'); }
function showOptions() { modalName = 'options'; const o = game.options; modal('Options', `<div class="options-grid"><div class="option"><div><div class="name">Master volume</div><p>Music and combat sound.</p></div><input type="range" min="0" max="1" step=".05" value="${o.volume}" data-change="volume" aria-label="Master volume"></div><div class="option"><div><div class="name">Sound</div><p>Mute all audio.</p></div><button data-act="toggleOption" data-name="muted">${o.muted ? 'Muted' : 'On'}</button></div><div class="option"><div><div class="name">Original music</div><p>Locally generated instrumental score.</p></div><button data-act="toggleOption" data-name="music">${o.music ? 'On' : 'Off'}</button></div>${[['speed', 'Animation speed', 'Shortens AI pauses and effects.', [[1, '1×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']]], ['difficulty', 'Difficulty', 'Applied at battle start or retry.', [['story', 'Story'], ['standard', 'Standard'], ['tactician', 'Tactician']]]].map(([id, name, desc, opts]) => `<div class="option"><div><div class="name">${name}</div><p>${desc}</p></div><select data-change="${id}">${opts.map(([v, n]) => `<option value="${v}" ${o[id] == v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}<div class="option"><div><div class="name">Reduced motion</div><p>Stops idle sway and camera easing. Shortens movement effects.</p></div><button data-act="toggleOption" data-name="reduceMotion">${o.reduceMotion ? 'On' : 'Off'}</button></div><div class="option"><div><div class="name">Permanent unit loss</div><p>Generic companions who turn into crystals are lost after victory.</p></div><button data-act="toggleOption" data-name="permadeath">${o.permadeath ? 'On' : 'Off'}</button></div><div class="option"><div><div class="name">Graphics & controls</div><p>Quality, resolution, touch layout, look speed and vibration. Also F9.</p></div><button data-act="kitSettings">Open ⚙</button></div><div class="option"><div><div class="name">Fullscreen game mode</div><p>Requests fullscreen and landscape lock where supported.</p></div><button data-act="fullscreen">${document.fullscreenElement ? 'Exit' : 'Enter'} ⛶</button></div>${game.battle ? '<div class="row wrap"><button data-act="autoAll">Auto-command company</button><button data-act="retry">Retry battle</button><button class="danger" data-act="abandonConfirm">Return to preparations</button></div>' : ''}<div class="row wrap"><button data-act="controls">Controls</button><button data-act="saves">Save & load</button><button data-act="credits">About</button><button class="ghost" data-act="toTitle">Title screen</button></div></div>`, 'Presentation · sound · gameplay', true, 'The battle clock pauses while a menu is open.'); }
async function fullscreen() {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            try {
                await window.__oathWakeLock?.release();
                window.__oathWakeLock = null;
            }
            catch { }
            try {
                window.screen.orientation.unlock();
            }
            catch { }
        }
        else {
            if (!document.documentElement.requestFullscreen)
                throw new Error('This browser does not support fullscreen.');
            await document.documentElement.requestFullscreen();
            try {
                await window.screen.orientation.lock('landscape');
            }
            catch {
                toast('Fullscreen is on. This browser controls orientation lock.');
            }
            try {
                const lock = await navigator.wakeLock?.request('screen');
                window.__oathWakeLock = lock;
            }
            catch { }
        }
    }
    catch (e) {
        toast(e.message || 'Fullscreen is not available here.');
    }
    setTimeout(() => view.resize(), 180);
}
function showControls() {
    modalName = 'controls';
    const src = kit.input.source, quick = src === 'gamepad'
        ? 'D-pad or left stick moves the cursor · Ⓐ select and confirm · Ⓑ back · Y Move · RT Strike · X Arts · LT Items · R3 Wait · LB / RB rotate · right stick turns and zooms · L3 units · Select switches to the command bar · Start options.'
        : src === 'touch'
            ? 'Tap a tile or unit to select it, then use the command bar and the Confirm button. Drag to turn the camera, pinch to zoom. ☷ opens options.'
            : 'Click a tile or unit, or move the cursor with the arrows / WASD. Enter or Space confirms, Escape backs out. 1–5 pick Move, Strike, Arts, Items and Wait. Q / E rotate, wheel or + / − zoom, drag to turn. U lists units, O or P opens options, F toggles fullscreen, F9 opens graphics settings.';
    modal('Command reference', `<p><b class="gold">One Move and one Act, in either order.</b> Select a tile or skill. Check the preview. Confirm your order. Use Wait to end the turn and choose a facing direction.</p><div class="note" style="margin-top:14px"><b>${src === 'gamepad' ? 'Gamepad' : src === 'touch' ? 'Touch' : 'Keyboard & mouse'}:</b> ${quick}</div><table class="controls-table"><tr><th>Action</th><th>Touch / mouse</th><th>Keyboard</th><th>Gamepad</th></tr><tr><td>Select tile</td><td>Tap / click</td><td>Arrows / WASD</td><td>D-pad / left stick</td></tr><tr><td>Confirm</td><td>Confirm button</td><td>Enter / Space</td><td>A / Cross</td></tr><tr><td>Cancel / back</td><td>Cancel / ×</td><td>Escape</td><td>B / Circle</td></tr><tr><td>Move / Strike / Arts / Items / Wait</td><td>Command bar</td><td>1 / 2 / 3 / 4 / 5</td><td>Y / RT / X / LT / R3 · Select: command bar focus</td></tr><tr><td>Rotate</td><td>Drag / ↶ ↷</td><td>Q / E · drag</td><td>LB / RB · right stick</td></tr><tr><td>Zoom</td><td>Pinch / wheel / + −</td><td>+ / −</td><td>Right stick up / down</td></tr><tr><td>Units list</td><td>♟</td><td>U</td><td>L3</td></tr><tr><td>Options / fullscreen</td><td>☷ / ⛶</td><td>O or P / F</td><td>Start</td></tr><tr><td>Graphics & controls</td><td>Options → Graphics</td><td>F9</td><td>Options → Graphics</td></tr></table><h3>Unit selection</h3><p>Use the units button in the battle header, or press U, to inspect units. With a skill selected, the same list can select a target. It does not confirm the attack.</p><h3>Ground and facing</h3><p>Blue tiles show movement. Red tiles show action range. Gold marks an area of effect. Height affects movement and ranged attacks. A shield does not protect the rear. The cursor keys follow the camera: after a rotation, up still moves the cursor up the screen.</p><h3>Turn order and spell delay</h3><p>Speed fills CT. A unit acts at 100 CT. Using both commands leaves 0 CT. Using one leaves 20 CT. Waiting leaves 40 CT. Spells can follow a unit or stay on a tile. Area attacks can hit allies.</p><h3>Recovery and growth</h3><p>Downed units have three personal turns before becoming a crystal or chest. Use Phoenix Down or a revive skill. Learn skills with JP. Combine jobs with secondary commands and equipped reaction, support, and movement traits.</p><h3>Camera</h3><p>At full view the camera frames the whole battlefield. Zoom in and it follows the unit whose turn it is, or the cursor as you move it.</p><div class="note">Touch works in portrait and landscape. Gamepad menus use D-pad focus and A. Select switches between battlefield cursor and command focus. You can stop automatic commands at any time.</div>`, 'No timed input is required');
}
function savedWhen(iso) {
    const t = typeof iso === 'string' ? new Date(iso) : null;
    return t && !isNaN(t) ? ' · ' + esc(t.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })) : '';
}
function showSaves() {
    modalName = 'saves';
    const rows = ['auto', 'slot1', 'slot2', 'slot3'].map(k => {
        let d = null;
        try {
            d = JSON.parse(storage.get(k) || 'null');
            d = d?.game || d;
        }
        catch { }
        return `<article class="save-row"><div class="row spread"><h3>${k === 'auto' ? 'Automatic save' : 'Manual slot ' + k.slice(-1)}</h3><span class="tag">${d ? 'Saved' : 'Empty'}</span></div><p>${d?.state ? `Chapter ${ROMAN[DB.missions[clamp(Number(d.state.next) || 0, 0, DB.missions.length - 1)]?.chapter || 1]} · ${esc(d.state.next)}/${DB.missions.length} story stages · Day ${esc(d.state.day)}${d.state.place ? ' · ' + esc(d.state.place) : ''}${d.battle ? ' · In battle' : ''}${savedWhen(d.savedAt)}` : 'No chronicle in this slot.'}</p><div class="row">${k !== 'auto' ? `<button class="primary" data-act="saveSlot" data-name="${k}" ${!hasStarted ? 'disabled' : ''}>Save here</button>` : ''}<button data-act="loadSlot" data-name="${k}" ${!d ? 'disabled' : ''}>Load</button></div></article>`;
    }).join('');
    modal('Keep the chronicle', `<p>Automatic saves include the current battle. Export a backup to protect against cleared browser data.</p>${rows}<div class="row wrap"><button data-act="exportSave" ${!hasStarted ? 'disabled' : ''}>Export save file</button><button data-act="importSave">Import save file</button></div><input type="file" id="import-file" accept=".json,application/json" hidden><div class="note" style="margin-top:18px">Browser storage can be blocked for local files or in preview windows. Exported JSON saves work between copies. Import replaces the current session, not the manual slots.</div>`, 'Local saves · portable backups', true);
    $('#import-file').onchange = async (e) => {
        const f = e.target.files?.[0];
        if (!f)
            return;
        try {
            if (f.size > 4000000)
                throw new Error('The save exceeds 4 MB.');
            const raw = await f.text();
            GameModel.restore(JSON.parse(raw).game || JSON.parse(raw));
            pendingImport = raw;
            modalName = 'importConfirm';
            modal('Load this chronicle?', `<p>The current session will be replaced. Existing manual saves will remain.</p><button class="primary" data-act="importConfirm">Load imported save</button>`, 'Import save', true);
        }
        catch (e) {
            toast(e.message);
        }
    };
}
let pendingImport = '', padFocus = false;
function exportSave() { const data = saveEnvelope(), blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'the-lions-oath-day-' + game.state.day + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); toast('Save export requested. Keep the JSON file with your game.'); }
function showCredits() { modalName = 'credits'; modal('About this chronicle', `<div class="credits"><div class="row">${CREST}<div><div class="eyebrow">Unofficial fan adaptation</div><h2>The Lion’s Oath</h2><p>Original prompt: <b>2026-09-25</b><br>Original AI model: <b>GPT-6 Astra Pro</b></p></div></div><div class="rule"></div><p>This second pass checks the recovered campaign and combat code. It repairs save validation, scene recovery, company limits, equipment rules, and combat edge cases. It adds a battlefield unit list, keyboard focus control, and reduced-motion settings. The source package contains test scripts and results.</p><div class="note"><b>Source fidelity:</b> this is not certified as a 90%+ faithful remake. It has a complete campaign route, but uses new map layouts and adapted formulas. The coverage ledger identifies missing and partial source systems. Data counts alone do not prove content completion.</div><h3>Runtime catalog</h3><p>${DB.missions.length} story stages · ${DB.sideMissions.length} optional stages · 20 standard jobs · ${Object.keys(DB.items).length} items · ${Object.keys(DB.skills).length} ability records · ${DB.propositions.length} propositions.</p><button data-act="coverage">Open source-coverage checklist</button><h3>Source and additions</h3><p>Reference: the supplied FFT Unified Guide bundle and its six PS1 source guides. Source dialogue is presented with scene identifiers. New map geometry, tactical tuning, tutorial text, interface copy, audio, and procedural art are implementation additions.</p>${(DB.deviations || []).map((s) => `<p>${esc(s)}</p>`).join('')}<h3>Technology</h3><p>The battlefield is drawn with three.js r186 through the hub’s shared 3D kit: WebGPU where the browser has it, WebGL2 otherwise, with the original low-poly models and lighting. Keyboard and mouse, gamepad and touch all go through one set of actions. Campaign data, models and the procedural score load from this game’s own folder. No other network request is made.</p><p>The Dorter Proving Ring (six staged bouts with par turns and medals) was added in the 2026 upgrade pass.</p><h3>Credits and notice</h3><p>Final Fantasy Tactics, its characters, and its setting belong to their respective rights holders. This fan work is not affiliated with Square Enix. Three.js is by its contributors and is distributed under the MIT License. The full notice is embedded in the source.</p></div>`, 'Second pass 1.2 · scope and sources'); }
// The coverage ledger is half the campaign data and only this checklist reads it: fetch it on first open.
let ledgerLoading = null;
function loadLedger() {
    ledgerLoading ??= fetch(new URL('../data/ledger.json', import.meta.url)).then(r => { if (!r.ok)
        throw new Error('The checklist could not be loaded.'); return r.json(); }).then(l => { DB.ledger = Array.isArray(l) ? l : []; return DB.ledger; }).catch(e => { ledgerLoading = null; throw e; });
    return ledgerLoading;
}
function showCoverage(filter = '', query = '') { if (!DB.ledger) {
    modalName = 'coverage';
    modal('Source-coverage checklist', '<p>Opening the ledger…</p>', 'No unverified percentage');
    loadLedger().then(() => { if (modalName === 'coverage')
        showCoverage(filter, query); }).catch(e => toast(e.message));
    return;
} modalName = 'coverage'; const all = DB.ledger || [], rows = all.filter((e) => (!filter || e.category === filter) && (!query || JSON.stringify(e).toLowerCase().includes(query.toLowerCase()))), cats = [...new Set(all.map((e) => e.category))]; modal('Source-coverage checklist', `<p>Every supplied guide record is listed. Partial means playable behavior differs or some details are absent. Reference text is not counted as playable content.</p><div class="shop-toolbar"><select id="coverage-category"><option value="">All categories</option>${cats.map((c) => `<option ${c === filter ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><input id="coverage-query" type="search" placeholder="Search source entries" value="${esc(query)}"></div><p>${rows.length} matching records. First 200 shown; use the filters to inspect the rest.</p><table class="coverage-table"><thead><tr><th>Guide record</th><th>Content</th><th>Status and implementation</th></tr></thead><tbody>${rows.slice(0, 200).map((e) => `<tr><td>${esc(e.id)}<br>${esc(e.category)}</td><td>${esc(e.name)}</td><td><b class="gold">${esc(e.status)}</b><br>${esc(e.implementation)}</td></tr>`).join('')}</tbody></table>`, 'No unverified percentage', false, 'Every record is in the ledger: filter by category or search to reach the rest.'); $('#coverage-category').onchange = e => showCoverage(e.target.value, query); let timer; $('#coverage-query').oninput = e => { const v = e.target.value; clearTimeout(timer); timer = setTimeout(() => { showCoverage(filter, v); const q = $('#coverage-query'); q?.focus(); q?.setSelectionRange?.(q.value.length, q.value.length); }, 250); }; }
function showBattleEquipment() {
    const u = game.battle?.active();
    if (!u || !passive(u, 'Equip Change') || u.acted)
        return;
    modalName = 'battleEquip';
    modal('Equip Change', `<p>Choose a slot. A successful change uses this turn’s action.</p><div class="equipment-list">${['weapon', 'shield', 'head', 'body', 'accessory'].map(sl => `<button data-act="battleSlot" data-name="${sl}">${sl}: ${esc(u.equip[sl] || 'Empty')}</button>`).join('')}</div>`, u.name, true);
}
function safePrepare() {
    if (game.battle && preBattle) {
        const o = clone(game.options);
        try {
            game = GameModel.restore(clone(preBattle));
        }
        catch {
            // A damaged recovery point must not trap the player in the battle: keep the current company.
            toast('The recovery point was damaged. The company returns as it stands.');
        }
        game.options = o;
        game.battle = null;
    }
    world();
}
function nextMission() {
    const m = DB.missions[game.state.next];
    if (!m) {
        showEnding();
        return;
    }
    if (m.id === 'm38') {
        modalName = 'route';
        modal('Choose the approach', `<p>Bethla Garrison can be approached from the north or the south. The northern wall has height and ranged defenders. The southern gate has close combat and mages.</p><div class="row wrap"><button class="primary" data-act="bethlaRoute" data-name="north">North wall</button><button class="primary" data-act="bethlaRoute" data-name="south">South gate</button></div>`, 'Bethla Garrison', true);
        return;
    }
    if (m.id === 'm2' && !game.state.flags.mandaliaChoice) {
        modalName = 'mandalia';
        modal('A soldier in danger', `<p>A cadet is surrounded by the Death Corps. Choose Ramza’s priority.</p><div class="stack"><button class="primary" data-act="mandaliaChoice" data-name="rescue">Saving him is our priority.</button><button data-act="mandaliaChoice" data-name="fight">Our duty is to defeat the Death Corps.</button></div>`, 'Mandalia Plains', true);
        return;
    }
    startMission(m);
}
function dispatch(a, el) {
    const d = el.dataset, n = d.name || '', id = d.id || '', num = Number(d.n), b = game.battle, u = b?.active();
    switch (a) {
        case 'continue':
            loadSave();
            break;
        case 'new':
            newCampaign();
            break;
        case 'newConfirm':
            newCampaign(true);
            break;
        case 'close':
            closeModal();
            if (screenName === 'battle' && !dialogue)
                renderBattle();
            break;
        case 'controls':
            showControls();
            break;
        case 'saves':
            showSaves();
            break;
        case 'options':
            showOptions();
            break;
        case 'credits':
            showCredits();
            break;
        case 'coverage':
            showCoverage();
            break;
        case 'toTitle':
            saveAuto();
            title();
            break;
        case 'world':
            world();
            break;
        case 'ending':
            showEnding();
            break;
        case 'endingScript':
            closeModal(false);
            showDialogue(DB.endingScenes || [], 'Beyond recorded history', showEnding, 'ending');
            break;
        case 'formation':
            showFormation();
            break;
        case 'roster':
            learnJob = '';
            showFormation(id);
            break;
        case 'formationTab':
            showFormation(undefined, n);
            break;
        case 'partyToggle': {
            const r = game.roster(rosterId);
            if (!r || r.name === 'Ramza' || r.away || r.dead)
                break;
            const party = game.state.party;
            if (party.includes(r.id))
                game.state.party = party.filter((x) => x !== r.id);
            else if (party.length < 5)
                party.push(r.id);
            else
                toast('Five units are already deployed. Remove one first.');
            saveAuto();
            showFormation();
            break;
        }
        case 'changeJob':
            if (game.changeJob(rosterId, n)) {
                learnJob = n;
                saveAuto();
                showFormation();
                play('learn');
            }
            else
                toast('This job is not available.');
            break;
        case 'learn':
            if (game.learn(rosterId, n)) {
                saveAuto();
                showFormation();
                play('learn');
            }
            else
                toast('The ability cannot be learned yet.');
            break;
        case 'equipSlot':
            equipPicker(n);
            break;
        case 'equipItem':
            if (game.equip(rosterId, n, d.slot)) {
                saveAuto();
                showFormation(undefined, 'equipment');
                play('equip');
            }
            break;
        case 'unequip':
            game.unequip(rosterId, n);
            saveAuto();
            showFormation();
            break;
        case 'optimize':
            optimize();
            break;
        case 'dismiss': {
            const u = game.roster(rosterId);
            if (!u || u.unique || u.away)
                break;
            modalName = 'dismiss';
            modal('Release ' + u.name + '?', '<p>This removes the unit from your company. Equipment returns to inventory. This cannot be undone.</p><button class="danger" data-act="dismissConfirm">Release this unit</button>', 'Company roster', true);
            break;
        }
        case 'dismissConfirm':
            if (game.dismiss(rosterId)) {
                rosterId = '';
                saveAuto();
                showFormation();
                toast('The unit has left. Equipment returned to inventory.');
            }
            else
                toast('This unit cannot leave while assigned or guarding an egg.');
            break;
        case 'hire':
            showHire();
            break;
        case 'hireConfirm': {
            const name = $('#recruit-name').value.trim(), sex = $('#recruit-sex').value;
            if (!name) {
                toast('Enter a name.');
                break;
            }
            if (game.state.roster.some((r) => r.name.toLowerCase() === name.toLowerCase()) || Object.keys(DB.characters).some(n => n.toLowerCase() === name.toLowerCase())) {
                toast('Choose a different name.');
                break;
            }
            if (game.hire(name, sex)) {
                saveAuto();
                showFormation(game.state.roster.slice(-1)[0].id);
            }
            else
                toast('Recruitment needs 500 gil and a free roster slot.');
            break;
        }
        case 'breed':
            if (game.breed(rosterId)) {
                saveAuto();
                toast('An egg will hatch in five days.');
            }
            else
                toast('Nesting needs 200 gil and a free roster slot.');
            break;
        case 'shop':
            showShop();
            break;
        case 'shopMode':
            showShop(n);
            break;
        case 'trade': {
            const ok = shopMode === 'sell' ? game.sell(n) : game.buy(n, 1, shopMode === 'fur');
            if (ok) {
                saveAuto();
                showShop();
                play('treasure');
            }
            else
                toast('The trade cannot be completed.');
            break;
        }
        case 'tavern':
            if (tavernCities().includes(game.state.place))
                tavernCity = game.state.place;
            showTavern();
            break;
        case 'tavernTab':
            tavernTab = n;
            showTavern();
            break;
        case 'rumor':
            hearRumor(n);
            break;
        case 'quests':
            showQuests();
            break;
        case 'arenaBout':
            startArena(id);
            break;
        case 'kitSettings':
            kit.menu.open();
            break;
        case 'sideMission':
            if (questAvailability().some(m => m.id === id))
                startMission(game.mission(id));
            break;
        case 'sendProp':
            propositionAssign(id);
            break;
        case 'sendPropConfirm': {
            const ids = Array.from(document.querySelectorAll('input[name="dispatch-unit"]:checked')).map(i => i.value);
            if (game.sendProposition(id, ids)) {
                saveAuto();
                showTavern();
                toast('Expedition sent.');
            }
            else
                toast('Select three available generic companions. Check the cost.');
            break;
        }
        case 'claimProp': {
            const r = game.claimProposition(id);
            if (r) {
                saveAuto();
                showTavern();
                toast('Report received. Gil, JP, and discoveries added.');
                play('treasure');
            }
            break;
        }
        case 'rest':
            game.advanceDays(1);
            saveAuto();
            renderWorld();
            toast('One day passes.');
            break;
        case 'restDays':
            game.advanceDays(clamp(num, 1, 20));
            saveAuto();
            showTavern();
            break;
        case 'travel':
            travel(n);
            break;
        case 'bypass':
            game.advanceDays(1);
            world();
            break;
        case 'skirmish':
            skirmish();
            break;
        case 'nextMission':
            nextMission();
            break;
        case 'bethlaRoute': {
            game.state.flags.bethlaRoute = n;
            const m = clone(DB.missions[38]);
            if (n === 'south') {
                m.name = 'Bethla Garrison — South Wall';
                m.theme = 'castleGate';
                m.enemies = 'Knight:3,Archer:1,Wizard:2';
                m.intro = DB.bethlaSouth?.intro || m.intro;
                m.outro = DB.bethlaSouth?.outro || m.outro;
            }
            startMission(m);
            break;
        }
        case 'mandaliaChoice':
            game.state.flags.mandaliaChoice = n;
            {
                const m = clone(DB.missions[2]);
                if (n === 'fight')
                    m.objective = 'defeat';
                startMission(m);
            }
            break;
        case 'journal':
            showJournal();
            break;
        case 'journalChapter':
            journalChapter = num;
            showJournal();
            break;
        case 'replay':
            if (game.state.completed.includes(id))
                startMission(game.mission(id));
            break;
        case 'readScene': {
            const m = game.mission(id);
            if (m && game.state.completed.includes(id)) {
                closeModal(false);
                showDialogue([...(Array.isArray(m.intro) ? m.intro : []), ...(Array.isArray(m.outro) ? m.outro : [])], m.name, () => { renderWorld(); showJournal(); }, 'journal');
            }
            break;
        }
        case 'tutorialDone':
            game.state.flags.tutorial = true;
            closeModal(false);
            renderBattle();
            break;
        case 'dialogueNext':
            nextDialogue();
            break;
        case 'skipDialogue':
            nextDialogue(true);
            break;
        case 'deployUnit':
            deployId = id;
            renderBattle();
            break;
        case 'battleStart':
            if (b?.phase === 'deploy') {
                b.start();
                mode = 'inspect';
                afterAction();
            }
            break;
        case 'fieldUnits':
            showFieldUnits();
            break;
        case 'fieldUnit':
            selectFieldUnit(id);
            break;
        case 'command':
            chooseCommand(n);
            break;
        case 'ability':
            selectAbility(n);
            break;
        case 'calculator':
            showCalculator();
            break;
        case 'mathPrepare': {
            const field = $('#math-field').value, divisor = $('#math-divisor').value, spell = $('#math-spell').value;
            if (!field || !divisor || !spell || !u)
                break;
            action = { name: 'Arithmetic: ' + spell, kind: 'calculate', field, divisor, spell, mp: 0, charge: 0, range: 99, description: 'Every matching unit is affected.' };
            mode = 'arts';
            target = { x: u.x, z: u.z };
            closeModal(false);
            renderBattle();
            break;
        }
        case 'throwItem':
            if (DB.skills[d.skill || '']) {
                action = { ...DB.skills[d.skill], selectedItem: n };
                mode = 'arts';
                target = null;
                closeModal(false);
                renderBattle();
            }
            break;
        case 'castLock':
            castLock = !castLock;
            renderBattle();
            break;
        case 'confirmTarget':
            commitTarget();
            break;
        case 'cancelTarget':
            mode = 'inspect';
            action = null;
            target = null;
            renderBattle();
            break;
        case 'face':
            if (u) {
                closeModal(false);
                b.end(num);
                mode = 'inspect';
                target = null;
                action = null;
                afterAction();
            }
            break;
        case 'undo':
            if (b?.undo())
                afterAction();
            else
                toast('This movement can no longer be undone.');
            break;
        case 'crystalLearn':
            b?.chooseCrystal(true);
            closeModal(false);
            afterAction();
            break;
        case 'crystalHeal':
            b?.chooseCrystal(false);
            closeModal(false);
            afterAction();
            break;
        case 'battleEquip':
            showBattleEquipment();
            break;
        case 'battleSlot':
            equipPicker(n, true);
            break;
        case 'equipBattleItem':
            if (b && u && passive(u, 'Equip Change') && !u.acted && canEquip(u, n, d.slot) && b.inventory[n] > 0) {
                const sl = d.slot;
                if (u.equip[sl])
                    b.inventory[u.equip[sl]] = (b.inventory[u.equip[sl]] || 0) + 1;
                b.inventory[n]--;
                u.equip[sl] = n;
                u.hp = Math.min(u.hp, stats(u).hp);
                u.mp = Math.min(u.mp, stats(u).mp);
                u.acted = true;
                b.event({ type: 'text', id: u.id, text: u.name + ' equips ' + n + '.' });
                closeModal(false);
                afterAction();
            }
            break;
        case 'autoTurn':
            if (b && u && !u.team && !u.guest) {
                b.aiTurn();
                afterAction();
            }
            break;
        case 'autoAll':
            autoAll = true;
            closeModal(false);
            scheduleAI();
            break;
        case 'stopAuto':
            autoAll = false;
            clearTimeout(aiTimer);
            aiBusy = false;
            renderBattle();
            scheduleAI();
            break;
        case 'rotateLeft':
            view.desiredAngle -= Math.PI / 2;
            break;
        case 'rotateRight':
            view.desiredAngle += Math.PI / 2;
            break;
        case 'zoomIn':
            view.targetZoom = clamp(view.targetZoom + .15, .65, 1.75);
            break;
        case 'zoomOut':
            view.targetZoom = clamp(view.targetZoom - .15, .65, 1.75);
            break;
        case 'fullscreen':
            fullscreen();
            break;
        case 'log':
            modalName = 'log';
            modal('Battle record', `<div class="battle-log">${b?.log.slice().reverse().map(s => `<div>${esc(s)}</div>`).join('')}</div>`, 'Orders and effects', true);
            break;
        case 'retry':
            closeModal(false);
            recover(true);
            break;
        case 'returnWorld':
            safePrepare();
            break;
        case 'abandonConfirm':
            modalName = 'abandon';
            modal('Return to preparations?', `<p>This battle’s gains will be discarded. Your pre-battle company and items will be restored.</p><button class="danger" data-act="returnWorld">Return to the world map</button>`, 'Leave battle', true);
            break;
        case 'victoryContinue':
            victoryContinue();
            break;
        case 'toggleOption':
            if (['music', 'muted', 'permadeath', 'reduceMotion'].includes(n)) {
                game.options[n] = !game.options[n];
                applyOptions();
                storage.set('prefs', JSON.stringify(game.options));
                saveAuto();
                showOptions();
            }
            break;
        case 'saveSlot':
            if (!hasStarted)
                break;
            if (storage.get(n)) {
                modalName = 'overwrite';
                modal('Replace this slot?', `<p>The existing save in ${esc(n)} will be replaced by the current session.</p><button class="primary" data-act="saveSlotConfirm" data-name="${n}">Replace save</button>`, 'Manual save', true);
            }
            else
                writeSlot(n);
            break;
        case 'saveSlotConfirm':
            writeSlot(n);
            break;
        case 'loadSlot':
            if (storage.get(n)) {
                modalName = 'loadConfirm';
                modal('Load this save?', `<p>The current session will be replaced. Manual slots will remain unchanged.</p><button class="primary" data-act="loadSlotConfirm" data-name="${n}">Load save</button>`, 'Load chronicle', true);
            }
            break;
        case 'loadSlotConfirm':
            loadSave(n);
            break;
        case 'exportSave':
            exportSave();
            break;
        case 'importSave':
            $('#import-file')?.click();
            break;
        case 'importConfirm':
            try {
                const raw = pendingImport;
                pendingImport = '';
                restoreSave(raw);
                saveAuto();
            }
            catch (e) {
                toast(e.message);
            }
            break;
        default:
            console.warn('Unknown game action', a);
            toast('This control could not be used.');
    }
}
function writeSlot(n) {
    if (!/^slot[123]$/.test(n))
        return;
    const ok = storage.set(n, JSON.stringify(saveEnvelope()));
    showSaves();
    if (ok)
        toast('Saved in slot ' + n.slice(-1) + '.');
}
function bindControls() {
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled)
            return;
        audio.start();
        try {
            dispatch(el.dataset.act, el);
        }
        catch (err) {
            console.error(err);
            toast('The action stopped: ' + err.message);
        }
    });
    const settings = (e) => {
        const el = e.target, k = el.dataset.change;
        if (!k)
            return;
        const v = el.value;
        if (['volume', 'speed', 'difficulty'].includes(k)) {
            game.options[k] = k === 'volume' || k === 'speed' ? Number(v) : v;
            applyOptions();
            storage.set('prefs', JSON.stringify(game.options));
            return;
        }
        if (k === 'learnJob') {
            learnJob = v;
            showFormation();
        }
        else if (k === 'secondary') {
            if (!game.setLoadout(rosterId, 'secondary', v))
                toast('This command set is not available.');
            saveAuto();
            showFormation();
        }
        else if (k === 'loadout') {
            if (!game.setLoadout(rosterId, el.dataset.slot, v))
                toast('This trait is not available.');
            saveAuto();
            showFormation();
        }
        else if (k === 'shopFilter') {
            shopFilter = v;
            showShop();
        }
        else if (k === 'tavernCity') {
            tavernCity = v;
            if (game.state.place !== v) {
                game.state.place = v;
                game.advanceDays(1);
                game.state.visited = [...new Set([...game.state.visited, v])];
                saveAuto();
                renderWorld();
            }
            showTavern();
        }
    };
    document.addEventListener('change', settings);
    document.addEventListener('input', e => {
        if (e.target.dataset.change === 'volume')
            settings(e);
    });
    // Keyboard handling that is not game input: keep Tab inside an open dialog, and let Escape leave a text field.
    document.addEventListener('keydown', e => {
        const el = e.target;
        if (e.key === 'Escape' && el instanceof HTMLElement && el.matches('input, select, textarea')) {
            el.blur();
            return;
        }
        if (e.key !== 'Tab' || !modalName)
            return;
        const fs = focusables(), i = fs.indexOf(document.activeElement);
        if (fs.length && (i < 0 || e.shiftKey && i === 0 || !e.shiftKey && i === fs.length - 1)) {
            e.preventDefault();
            fs[e.shiftKey ? fs.length - 1 : 0].focus();
        }
    });
    // Browsers only start audio after a gesture: any key or tap unlocks it, not only clicks on buttons.
    const unlockAudio = () => { if (!kit.paused)
        audio.start(); };
    addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    addEventListener('keydown', unlockAudio, { capture: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimeout(aiTimer);
            aiBusy = false;
            saveAuto();
            audio.ctx?.suspend().catch(() => { });
        }
        else if (!kit.paused) {
            audio.ctx?.resume().catch(() => { });
            scheduleAI();
        }
    });
    // pagehide is the event mobile browsers reliably fire when a tab is closed or put away.
    window.addEventListener('beforeunload', () => saveAuto());
    window.addEventListener('pagehide', () => saveAuto());
    // The kit's settings panel pauses the loop: hold the battle clock and the music with it.
    kit.onPause((paused) => {
        if (paused) {
            clearTimeout(aiTimer);
            aiBusy = false;
            audio.ctx?.suspend().catch(() => { });
        }
        else if (!document.hidden) {
            audio.ctx?.resume().catch(() => { });
            if (screenName === 'battle' && !dialogue && !modalName) {
                renderBattle();
                scheduleAI();
            }
        }
    });
    document.body.dataset.input = kit.input.source;
    kit.input.onSourceChange((src) => { document.body.dataset.input = src; });
}
function focusables() { return Array.from(document.querySelectorAll((modalName ? '#modal' : '#interface') + ' button:not(:disabled), ' + (modalName ? '#modal' : '#interface') + ' select, ' + (modalName ? '#modal' : '#interface') + ' input')).filter(e => e.offsetParent !== null && !e.hasAttribute('hidden') && !e.hasAttribute('disabled')); }
function focusMove(delta) {
    const els = focusables();
    if (!els.length)
        return;
    const i = els.indexOf(document.activeElement);
    const el = els[i < 0 ? (delta > 0 ? 0 : els.length - 1) : (i + delta + els.length) % els.length];
    el.focus();
    el.scrollIntoView({ block: 'nearest' });
}
function cursorMove(dx, dz) {
    const b = game.battle;
    if (!b)
        return;
    // Keep the keys screen-relative: turn the step with the camera, a quarter turn at a time from the default view.
    const q = ((Math.round((view.angle - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4;
    for (let i = 0; i < q; i++)
        [dx, dz] = [dz, -dx];
    padCursor = { x: clamp(padCursor.x + dx, 0, b.w - 1), z: clamp(padCursor.z + dz, 0, b.h - 1) };
    view.cursor = padCursor;
    view.followTile(padCursor.x, padCursor.z);
    if (mode !== 'inspect') {
        target = { ...padCursor };
        renderBattle();
    }
}
function confirmInput() {
    if (dialogue) {
        const e = document.activeElement;
        if (e?.matches?.('#interface button'))
            e.click();
        else
            nextDialogue();
        return;
    }
    if (inMenus() || padFocus) {
        const e = document.activeElement;
        if (e?.matches('button'))
            e.click();
        else if (e?.matches('input[type="checkbox"]'))
            e.click();
        else
            focusables()[0]?.focus();
        return;
    }
    if (game.battle?.phase === 'deploy') {
        tileClick(padCursor);
        return;
    }
    if (target && mode !== 'inspect')
        commitTarget();
    else
        tileClick(padCursor);
}
function backInput() {
    if (modalName) {
        closeModal();
        if (screenName === 'battle' && !dialogue)
            renderBattle();
        return;
    }
    if (dialogue) {
        nextDialogue(true);
        return;
    }
    if (padFocus) {
        padFocus = false;
        document.activeElement?.blur?.();
        return;
    }
    if (screenName === 'battle' && mode !== 'inspect') {
        mode = 'inspect';
        target = null;
        action = null;
        renderBattle();
    }
    else
        showOptions();
}
/** Every device goes through these actions; the kit maps keys, pad buttons, mouse and touch onto them. */
const INPUT = {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    cam: { type: 'vector', gamepad: 'rightStick' },
    look: { type: 'look', mouse: 'drag', gamepad: [], touch: 'drag' },
    confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
    back: { keys: ['Escape'], gamepad: ['B'] },
    menu: { keys: ['KeyO', 'KeyP'], gamepad: ['Start'] },
    focusDock: { gamepad: ['Back'] },
    cmdMove: { keys: ['Digit1', 'Numpad1'], gamepad: ['Y'] },
    cmdAttack: { keys: ['Digit2', 'Numpad2'], gamepad: ['RT'] },
    cmdArts: { keys: ['Digit3', 'Numpad3'], gamepad: ['X'] },
    cmdItems: { keys: ['Digit4', 'Numpad4'], gamepad: ['LT'] },
    cmdWait: { keys: ['Digit5', 'Numpad5'], gamepad: ['RS'] },
    rotL: { keys: ['KeyQ'], gamepad: ['LB'] },
    rotR: { keys: ['KeyE'], gamepad: ['RB'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'] },
    units: { keys: ['KeyU'], gamepad: ['LS'] },
    fullscreen: { keys: ['KeyF'] },
};
const COMMAND_ACTIONS = [['cmdMove', 'move'], ['cmdAttack', 'attack'], ['cmdArts', 'arts'], ['cmdItems', 'items'], ['cmdWait', 'wait']];
const drag = { active: false, moved: false, sx: 0, sy: 0, hx: -1, hy: -1 };
let dirKey = '', dirNext = 0;
/** Called once per frame by the kit loop, before drawing. */
function gameInput(dt, now) {
    const inp = kit.input;
    if (inp.pressed('menu')) {
        if (modalName === 'options') {
            closeModal();
            if (screenName === 'battle' && !dialogue)
                renderBattle();
        }
        else
            showOptions();
        return;
    }
    if (inp.pressed('fullscreen'))
        fullscreen();
    if (inp.pressed('back')) {
        backInput();
        return;
    }
    if (inp.pressed('confirm')) {
        confirmInput();
        return;
    }
    if (inp.pressed('focusDock')) {
        padFocus = !padFocus;
        if (padFocus)
            focusables()[0]?.focus();
        else
            document.activeElement?.blur?.();
    }
    if (screenName === 'battle' && !modalName && !dialogue) {
        if (inp.pressed('units')) {
            showFieldUnits();
            return;
        }
        for (const [name, command] of COMMAND_ACTIONS)
            if (inp.pressed(name)) {
                chooseCommand(command);
                break;
            }
    }
    // Directions move menu focus or the battlefield cursor; a held direction repeats.
    const v = inp.vector('move'), dx = Math.abs(v.x) > .5 ? Math.sign(v.x) : 0, dy = Math.abs(v.y) > .5 ? Math.sign(v.y) : 0, key = dx + ',' + dy;
    if (!dx && !dy)
        dirKey = '';
    else if (key !== dirKey || now >= dirNext) {
        dirNext = now + (key !== dirKey ? 330 : 120);
        dirKey = key;
        stepDirection(dx, dy, inp.source);
    }
    if (!modalName)
        cameraInput(inp, dt, !dialogue);
}
/** Screens where directions and confirm drive DOM focus rather than the battlefield cursor. */
function inMenus() { return !!modalName || screenName !== 'battle' || !!dialogue || ['won', 'lost'].includes(game.battle?.phase); }
function stepDirection(dx, dy, source) {
    if (inMenus() || (padFocus && source !== 'keyboard')) {
        const el = document.activeElement;
        if (dx && el instanceof HTMLSelectElement) {
            el.selectedIndex = clamp(el.selectedIndex + dx, 0, el.options.length - 1);
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        else if (dx && el instanceof HTMLInputElement && el.type === 'range') {
            el.value = String(clamp(Number(el.value) + dx * .05, 0, 1));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        else
            focusMove(dy ? -dy : dx);
        return;
    }
    if (source === 'keyboard') {
        document.activeElement?.blur?.();
        padFocus = false;
    }
    cursorMove(dx, -dy);
}
function cameraInput(inp, dt, keys) {
    if (keys) {
        if (inp.pressed('rotL'))
            view.desiredAngle -= Math.PI / 2;
        if (inp.pressed('rotR'))
            view.desiredAngle += Math.PI / 2;
        if (inp.pressed('zoomIn'))
            view.targetZoom = clamp(view.targetZoom + .12, .65, 1.75);
        if (inp.pressed('zoomOut'))
            view.targetZoom = clamp(view.targetZoom - .12, .65, 1.75);
    }
    const cam = inp.vector('cam');
    if (cam.x)
        view.desiredAngle += cam.x * 2.4 * dt;
    if (cam.y)
        view.targetZoom = clamp(view.targetZoom + cam.y * .7 * dt, .65, 1.75);
    const p = inp.pointer, z = inp.zoom();
    if (z)
        view.targetZoom = clamp(view.targetZoom * Math.exp(z * (p.type === 'touch' ? .25 : .1)), .65, 1.75);
    // The pointer: a drag turns the camera, a tap or click without a drag selects.
    const look = inp.look('look');
    if (p.justDown) {
        drag.active = true;
        drag.moved = false;
        drag.sx = p.x;
        drag.sy = p.y;
    }
    if (drag.active && p.down) {
        if (z || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 9)
            drag.moved = true;
        if (drag.moved && look.x)
            view.desiredAngle += look.x * (p.type === 'touch' ? 1.6 : 3.75);
    }
    if (p.justUp) {
        if (drag.active && !drag.moved) {
            const pick = view.pick(p.x, p.y);
            if (pick) {
                padCursor = pick;
                tileClick(pick);
            }
        }
        drag.active = false;
    }
    else if (!p.down && p.over && p.type === 'mouse' && (p.x !== drag.hx || p.y !== drag.hy)) {
        drag.hx = p.x;
        drag.hy = p.y;
        if (screenName === 'battle' && !dialogue)
            view.cursor = view.pick(p.x, p.y);
    }
}
async function startGame() {
    const dataRequest = fetch(new URL('../data/campaign.json', import.meta.url)).then((r) => {
        if (!r.ok)
            throw new Error('The campaign data could not be loaded (' + r.status + ').');
        return r.json();
    });
    dataRequest.catch(() => { }); // reported below, once the loading card is up
    kit = await bootKit({
        title: 'The Lion’s Oath',
        mount: $('#stage'),
        canvas: $('#field'),
        renderer: { alpha: true },
        gear: 'none',
        accent: '#d8c08b',
        background: '#142b34',
        input: INPUT,
    });
    // The original wrote its colours straight to a transparent canvas over the stage gradient.
    kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    kit.renderer.setClearColor(0x000000, 0);
    kit.loading.progress(0.7, 'Opening the Durai Papers…');
    DB = await dataRequest;
    game = new GameModel();
    view = new BattleView(kit, $('#field-hud'));
    game.options = normalizeOptions({ ...game.options, ...readPrefs() });
    applyOptions();
    bindControls();
    title();
    try {
        await kit.renderer.compileAsync(view.scene, view.camera);
    }
    catch (e) {
        console.warn(e);
    }
    kit.start((dt) => {
        const now = performance.now();
        gameInput(dt, now);
        view.draw(now, dt, !(['world', 'ending'].includes(screenName) && !dialogue));
    });
    window.Oath = { version: '1.3.0', get game() { return game; }, get view() { return view; }, get screen() { return screenName; }, get dialogue() { return dialogue; }, get modal() { return modalName; }, get autoCommand() { return autoAll; }, snapshot: () => clone(game.serialize()), startNew: () => newCampaign(true), get counts() { return { missions: DB.missions.length, optional: DB.sideMissions.length, arena: ARENA.length, jobs: Object.keys(DB.jobs).filter(j => !DB.jobs[j].special).length, items: Object.keys(DB.items).length, skills: Object.keys(DB.skills).length }; } };
}
startGame().catch((e) => {
    console.error(e);
    kit?.loading.done();
    $('#interface').innerHTML = '<div style="padding:50px;max-width:700px"><h1>The game could not start.</h1><p>Reload the page. If this keeps happening, this browser may be missing WebGPU and WebGL2.</p><pre style="white-space:pre-wrap">' + esc(e?.message || e) + '</pre></div>';
});
