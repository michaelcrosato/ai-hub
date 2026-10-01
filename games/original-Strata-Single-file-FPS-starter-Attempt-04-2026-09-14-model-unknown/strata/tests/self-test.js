/** Dependency-free checks. These do not test Three.js, Rapier, or GPU output. */
import { FixedClock, Timeline } from '../core/clock.js';
import { Events, Signals } from '../core/events.js';
import { Motor, defaultMotor } from '../core/motor.js';
import { random } from '../core/math.js';
import { Vitals, Weapon } from '../fps/combat.js';
import { Scope } from '../kit/scope.js';
import { MemoryStorage, EpisodeSession } from '../kit/session.js';
import { validateCampaign, jsonObject, parseSave, storageKey } from '../kit/contract.js';
import { builtinSchemas, validateLevel } from '../level/schema.js';
import { createPrefabs } from '../level/prefabs.js';
import { yardLevel } from '../episode/level.js';
import { pumpLevel, registerEpisodeArt, validateSupply } from '../episode/pump-house.js';
import { createStarterSession } from '../episode/session.js';

export function runChecks() {
    const results = [];
    const ok = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
    const eq = (actual, expected) => ok(Object.is(actual, expected), `Expected ${String(expected)}, got ${String(actual)}`);
    const near = (a, b, e = 1e-7) => ok(Math.abs(a - b) < e, `${a} is not near ${b}`);
    const throws = fn => { let thrown = false; try { fn(); } catch { thrown = true; } ok(thrown, 'Expected an error'); };
    const check = (name, fn) => {
        try { fn(); results.push({ name, passed: true }); }
        catch (error) { results.push({ name, passed: false, error: String(error) }); }
    };
    const idle = { x: 0, z: 0, sprint: false, crouch: false, jump: false };
    const motor = () => { const m = new Motor({ ...defaultMotor }); m.grounded = true; return m; };
    const makeLevel = () => {
        const prefabs = createPrefabs(); registerEpisodeArt(prefabs);
        const schemas = builtinSchemas(); schemas.register('board-car', () => {}); schemas.register('supply', validateSupply);
        return { prefabs, schemas, data: yardLevel() };
    };
    const valid = data => { const { prefabs, schemas } = makeLevel(); return validateLevel(data, prefabs.ids, schemas); };
    check('Sample level passes its schema', () => eq(valid(yardLevel()).version, 1));
    check('Sample owns its level data', () => { const a = yardLevel(), b = valid(a); a.entities[0].position[0] = 900; ok(b.entities[0].position[0] !== 900); });
    check('Duplicate entity IDs are rejected', () => { const a = yardLevel(); a.entities[1].id = a.entities[0].id; throws(() => valid(a)); });
    check('A player spawn is required', () => { const a = yardLevel(); a.entities = a.entities.filter(e => e.prefab !== 'spawn'); throws(() => valid(a)); });
    check('Invalid scale is rejected', () => { const a = yardLevel(); a.entities[0].scale[0] = 0; throws(() => valid(a)); });
    check('Unknown components are rejected', () => { const a = yardLevel(); a.entities[0].components = [{ type: 'not-installed' }]; throws(() => valid(a)); });
    check('Movement limits are enforced', () => { const a = yardLevel(); a.player.walkSpeed = 900; throws(() => valid(a)); });
    check('Configuration changes the generated level', () => { const a = yardLevel({ title: 'Test', player: { walkSpeed: 6 }, environment: { sun: 2 } }); eq(a.name, 'Test'); eq(valid(a).player.walkSpeed, 6); eq(a.environment.sun, 2); });
    check('Every prefab has finite collision sizes', () => { const { prefabs } = makeLevel(); for (const p of prefabs.all()) { const e = prefabs.create(p.id, [0, 0, 0], 'test'); for (const c of p.build(e).colliders) ok(c.size.every(v => Number.isFinite(v) && v > 0)); } });
    check('Pump House passes its schema', () => eq(valid(pumpLevel()).name, 'Pump House'));
    check('Pump House has three cells, four sentries and one exit', () => { const e = pumpLevel().entities; eq(e.filter(x => x.prefab === 'pickup').length, 3); eq(e.filter(x => x.id.startsWith('guard-')).length, 4); eq(e.filter(x => x.components.some(c => c.type === 'goal')).length, 1); });
    check('Pump House power needs every cell', () => { const counter = pumpLevel().entities.flatMap(x => x.components).find(c => c.type === 'counter'); eq(counter.count, pumpLevel().entities.filter(x => x.prefab === 'pickup').length); });
    check('Supply data is validated', () => { throws(() => validateSupply({ type: 'supply', kind: 'armor' })); throws(() => validateSupply({ type: 'supply', kind: 'health', amount: 0 })); validateSupply({ type: 'supply', kind: 'ammo', amount: 24 }); });
    check('Clock produces 60 equal steps per second', () => { const c = new FixedClock(); let n = 0; for (let i = 0; i < 144; i++) c.advance(1 / 144, dt => { eq(dt, 1 / 60); n++; }); eq(n, 60); });
    check('Clock limits stalled-frame catch-up', () => { const c = new FixedClock(); let n = 0; c.advance(10, () => n++); eq(n, 5); ok(c.droppedTime > 9); });
    check('Clock reports render interpolation', () => near(new FixedClock().advance(1 / 120, () => {}), .5));
    check('Clock ignores invalid time', () => { const c = new FixedClock(); for (const n of [-1, NaN, Infinity]) eq(c.advance(n, () => { throw new Error('Unexpected tick'); }), 0); });
    check('Clock reset clears partial time', () => { const c = new FixedClock(); c.advance(.001, () => {}); c.reset(); eq(c.advance(0, () => {}), 0); });
    check('Timeline fires once at simulation time', () => { const t = new Timeline(); let n = 0; t.after(.5, () => n++); t.update(.4); eq(n, 0); t.update(.2); t.update(1); eq(n, 1); });
    check('Timeline can cancel a task', () => { const t = new Timeline(); let n = 0; t.after(0, () => n++)(); t.update(1); eq(n, 0); });
    check('Events release unsubscribed listeners', () => { const e = new Events(); let n = 0; const off = e.on('use', () => n++); e.emit('use', 1); off(); e.emit('use', 2); eq(n, 1); });
    check('Signals retain values and queue order', () => { const s = new Signals(), values = []; s.on('gate', v => values.push(v.value)); s.send('gate', true); s.send('gate', false); eq(s.flush(), 2); eq(JSON.stringify(values), '[true,false]'); eq(s.values.get('gate'), false); });
    check('Signal cycles stop at a bounded limit', () => { const s = new Signals(); s.on('cycle', v => s.send('cycle', v.value)); s.send('cycle'); throws(() => s.flush(20)); eq(s.flush(), 0); });
    check('Diagonal movement does not add speed', () => { const m = motor(); for (let i = 0; i < 120; i++) m.update(1 / 60, { ...idle, x: 1, z: 1 }, 0); near(Math.hypot(m.vx, m.vz), defaultMotor.walkSpeed); });
    check('Yaw rotates the movement direction', () => { const m = motor(); for (let i = 0; i < 120; i++) m.update(1 / 60, { ...idle, z: -1 }, Math.PI / 2); ok(m.vx < -5); near(m.vz, 0); });
    check('Sprint reaches its specified speed', () => { const m = motor(); for (let i = 0; i < 120; i++) m.update(1 / 60, { ...idle, z: -1, sprint: true }, 0); near(-m.vz, defaultMotor.sprintSpeed); });
    check('Crouch overrides sprint speed', () => { const m = motor(); m.crouched = true; for (let i = 0; i < 120; i++) m.update(1 / 60, { ...idle, z: -1, sprint: true }, 0); near(-m.vz, defaultMotor.crouchSpeed); });
    check('Jump cannot repeat in midair', () => { const m = motor(); m.update(1 / 60, { ...idle, jump: true }, 0); eq(m.vy, defaultMotor.jumpSpeed); m.update(1 / 60, { ...idle, jump: true }, 0); ok(m.vy < defaultMotor.jumpSpeed); });
    check('A late jump uses the edge allowance', () => { const m = motor(); m.update(1 / 60, idle, 0); m.grounded = false; m.update(.03, { ...idle, jump: true }, 0); eq(m.vy, defaultMotor.jumpSpeed); });
    check('The late-jump allowance expires', () => { const m = motor(); m.update(1 / 60, idle, 0); m.grounded = false; m.update(.2, idle, 0); m.update(1 / 60, { ...idle, jump: true }, 0); ok(m.vy < 0); });
    check('A buffered jump fires on ground contact', () => { const m = new Motor({ ...defaultMotor }); m.update(1 / 60, { ...idle, jump: true }, 0); m.grounded = true; m.update(1 / 60, idle, 0); eq(m.vy, defaultMotor.jumpSpeed); });
    check('Seeded random values are repeatable', () => { const a = random(41), b = random(41); for (let i = 0; i < 100; i++) { const x = a(); eq(x, b()); ok(x >= 0 && x < 1); } });
    check('Armor absorbs part of the damage', () => { const v = new Vitals(); v.armor = 50; const d = v.damage(10); eq(d.armorLost, 6); eq(d.healthLost, 4); });
    check('Damage grace prevents repeated hits', () => { const v = new Vitals(); v.damage(10, .2); v.damage(10); eq(v.health, 90); v.tick(.2); v.damage(10); eq(v.health, 80); });
    check('Health cannot go below zero', () => { const v = new Vitals(); ok(v.damage(1000).killed); eq(v.health, 0); });
    check('Invalid vitals are rejected', () => throws(() => new Vitals().restore({ health: 101, armor: 0 })));
    check('A shot consumes one round', () => { const w = new Weapon(); ok(w.fire(true, true)); eq(w.ammo, 11); });
    check('Fire timing limits repeat shots', () => { const w = new Weapon(); ok(w.fire(true, true)); eq(w.fire(true, true), false); w.tick(.16); ok(w.fire(false, true)); });
    check('Reload moves reserve rounds into the magazine', () => { const w = new Weapon(); w.fire(true, true); ok(w.reload()); w.tick(w.spec.reloadTime); eq(w.ammo, 12); eq(w.reserve, 59); });
    check('Reload cannot create ammunition', () => { const w = new Weapon(); w.restore({ ammo: 0, reserve: 2 }); w.reload(); w.tick(w.spec.reloadTime); eq(w.ammo, 2); eq(w.reserve, 0); });
    check('Invalid weapon saves are rejected', () => throws(() => new Weapon().restore({ ammo: 99, reserve: 0 })));
    check('Scope cleanup is reverse-order and idempotent', () => { const s = new Scope(), a = []; s.own(() => a.push(1)); s.own(() => a.push(2)); s.dispose(); s.dispose(); eq(a.join(','), '2,1'); });
    check('Scope runs remaining cleanup after an error', () => { const s = new Scope(); let freed = false; s.own(() => { freed = true; }); s.own(() => { throw new Error('Test error'); }); throws(() => s.dispose()); ok(freed); });
    check('JSON rejects cycles', () => { const a = {}; a.self = a; throws(() => jsonObject(a)); });
    check('JSON rejects non-finite numbers', () => throws(() => jsonObject({ x: Infinity })));
    check('JSON rejects unsafe property names', () => throws(() => jsonObject(JSON.parse('{"__proto__":{}}'))));
    check('JSON rejects oversized saves', () => throws(() => jsonObject({ a: 'x'.repeat(32768), b: 'x'.repeat(32768) })));
    check('JSON snapshots do not share mutable data', () => { const a = { values: [1] }, b = jsonObject(a); a.values[0] = 2; eq(b.values[0], 1); });
    check('Standalone checkpoint restores local state', () => { const store = new MemoryStorage(); const a = createStarterSession({}, () => {}, () => {}, store); a.session.checkpoint({ health: 77 }); const b = createStarterSession({}, () => {}, () => {}, store); eq(b.session.local.health, 77); });
    check('Old sessions cannot overwrite new sessions', () => { const store = new MemoryStorage(); const a = createStarterSession({}, () => {}, () => {}, store); createStarterSession({}, () => {}, () => {}, store); throws(() => a.session.checkpoint({})); });
    check('Standalone exit saves before callback', () => { const store = new MemoryStorage(); let seen; const a = createStarterSession({}, result => { seen = result; }, () => {}, store); ok(a.session.complete('finish', { local: { health: 88 }, shared: { escaped: true } })); eq(seen.active, 'pump'); eq(seen.episodes.fps.data.health, 88); eq(seen.shared.escaped, true); });
    check('Pump House exit finishes the campaign', () => { let seen; const a = createStarterSession({}, result => { seen = result; }, () => {}, new MemoryStorage(), 'pump'); ok(a.session.complete('finish', { local: { health: 61 } })); eq(seen.active, 'result'); eq(seen.episodes.pump.data.health, 61); });
    check('Progress carries from Loading Bay into Pump House', () => { const store = new MemoryStorage(); const a = createStarterSession({}, () => {}, () => {}, store); a.session.complete('finish', { shared: { 'yard-cleared': true } }); const b = createStarterSession({}, () => {}, () => {}, store, 'pump'); eq(b.session.shared['yard-cleared'], true); eq(b.session.snapshot.active, 'pump'); });
    check('Completion happens only once', () => { let n = 0; const a = createStarterSession({}, () => n++, () => {}, new MemoryStorage()); a.session.complete('finish'); eq(a.session.complete('finish'), false); eq(n, 1); });
    check('Unknown exits cannot complete', () => { const a = createStarterSession({}, () => {}, () => {}, new MemoryStorage()); throws(() => a.session.complete('not-defined')); });
    check('Import rejects another campaign save', () => { const a = createStarterSession({}, () => {}, () => {}, new MemoryStorage()); const b = createStarterSession({ saveId: 'another-game' }, () => {}, () => {}, new MemoryStorage()); throws(() => a.importSave(b.session.export())); });
    check('Reset removes the sample checkpoint', () => { const store = new MemoryStorage(); const a = createStarterSession({}, () => {}, () => {}, store); a.session.checkpoint({ health: 12 }); a.reset(); const b = createStarterSession({}, () => {}, () => {}, store); eq(b.session.local.health, undefined); });
    check('Campaign paths cannot escape their root', () => throws(() => validateCampaign({ api: 1, id: 'test', title: 'Test', start: 'a', episodes: [{ id: 'a', title: 'A', entry: '../a.html', stateVersion: 1, exits: {} }] })));
    check('A valid export can be parsed again', () => { const a = createStarterSession({}, () => {}, () => {}, new MemoryStorage()); eq(parseSave(a.session.export(), a.session.campaign).api, 1); });
    check('A failed storage write blocks completion', () => {
        const raw = new MemoryStorage(); let fail = false, calls = 0;
        const store = { getItem: key => raw.getItem(key), removeItem: key => raw.removeItem(key), setItem(key, value) { if (fail) throw new Error('Quota'); raw.setItem(key, value); } };
        const a = createStarterSession({}, () => calls++, () => {}, store); fail = true;
        throws(() => a.session.complete('finish')); eq(calls, 0); eq(a.session.transitioning, false);
    });
    return { passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length,
        scope: 'Pure logic only. No 3D, Rapier integration, or frame-rate claim.', results };
}
