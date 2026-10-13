/* Wayfarer: The Glass Tide. Original game built on Michael Crosato's my-3D2dge. */
(function () {
  'use strict';
  const E = My3D2dge;
  const D = WayfarerData, R = WayfarerRules, Art = WayfarerArt;
  const $ = id => document.getElementById(id);
  const SAVE = 'wayfarer-glass-tide-v1';
  let loaded = R.validSave(E.store.get(SAVE));
  let state = R.fresh(), mode = 'title', zone = D.zones.quay, map, party = [], enemies = [], battle = null;
  let context = null, dialogue = null, transition = false, clock = 0, hudClock = 0, autoSaveClock = 0, ui, flow;
  let hazards = [], echoes = [], fxRings = [], motes = [], toastSerial = 0, zoneTimer = 0, timeSinceInput = 0;
  let puzzle = { progress: [], object: null, message: '' }, leaderTarget = null, lastDevice = 'keyboard', discoveryClock = 0;
  const mapCache = new Map(), touchFirst = matchMedia('(pointer: coarse)').matches;
  const game = new E.Game({ canvas: 'screen', view: new E.View('wayfarer', 'The old coast', 0, 55, 1.5, 1.35), input: WayfarerControls.INPUT, fillScreen: true, minW: 480, minH: 300, portrait: { minW: 280, minH: 460 }, bg: '#143842' });
  game.r.outline = '#18323e'; game.r.rim = '#f0d39b'; game.r.rimAlpha = .16; game.particles.max = 340;
  const shots = new E.Bullets(game, { max: 150, plane: 'ground', sparks: false });
  const sound = new WayfarerSound(game);
  const controls = new WayfarerControls(game, {
    onZoom(z) { state.options.zoom = z; },
    onDevice(device) { lastDevice = device; document.body.classList.toggle('touch', device === 'touch'); updateDeviceLabels(); },
    onAction(action) { if (mode === 'title') return true; return false; }
  });
  document.body.classList.toggle('touch', touchFirst);
  if (touchFirst) lastDevice = 'touch';

  const isBoss = e => e && (e.type === 'warden' || e.type === 'loom');
  const bossDone = id => id === 'loom' ? state.flags.loomDefeated : state.flags.bossDefeated;
  function ensureWorld() {
    const seed = WayfarerWorld.normalizeSeed(state.world.seed);
    if (D.zones.overworld.seed !== seed || !D.zones.overworld.tiles.length) {
      const generated = WayfarerWorld.create(seed), checked = WayfarerWorld.validate(generated);
      if (!checked.ok) throw new Error('The wind roads could not be charted: ' + checked.errors.join('; '));
      D.zones.overworld = generated; mapCache.delete('overworld');
    }
    return D.zones.overworld;
  }
  function safePosition(m, x, y, fallback) {
    const fits = (xx, yy) => {
      if (m.reachable && !(m.reachable[Math.floor(yy / 16) * zone.w + Math.floor(xx / 16)] < 1e9)) return false;
      for (let j = Math.floor((yy - 6) / 16); j <= Math.floor((yy + 6) / 16); j++)
        for (let i = Math.floor((xx - 6) / 16); i <= Math.floor((xx + 6) / 16); i++) if (!m.walkable(i, j)) return false;
      return true;
    };
    if (Number.isFinite(x) && Number.isFinite(y) && fits(x, y)) return { x, y };
    const cx = Math.max(1, Math.min(zone.w - 2, Math.floor((Number.isFinite(x) ? x : fallback.x) / 16)));
    const cy = Math.max(1, Math.min(zone.h - 2, Math.floor((Number.isFinite(y) ? y : fallback.y) / 16)));
    for (let r = 0; r < Math.max(zone.w, zone.h); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const xx = (cx + dx) * 16 + 8, yy = (cy + dy) * 16 + 8;
      if (cx + dx > 0 && cx + dx < zone.w - 1 && cy + dy > 0 && cy + dy < zone.h - 1 && fits(xx, yy)) return { x: xx, y: yy };
    }
    return { ...fallback };
  }
  function discoverWorld(announce = true) {
    const p = party[state.leader];
    const found = R.discover(state, zone, p.x, p.y);
    if (announce) for (const site of found) toast(site.name, site.fastTravel ? 'Landmark charted. Travel here from the world map.' : 'A new place on your chart.', true);
    return found;
  }
  function makeMap(z) {
    if (mapCache.has(z.id)) return mapCache.get(z.id);
    const m = new E.TileMap({ rows: z.tiles, tile: 16, legend: { '~': { floor: 'water', block: true }, '^': { floor: 'mountain', block: true }, '.': 0, ':': 0, '=': 0, 's': 0, ',': 0, 'd': 0 }, shimmer: false });
    for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
      if (x === 0 || y === 0 || x === z.w - 1 || y === z.h - 1 || z.blockers.some(b => x * 16 < b.x + b.w && (x + 1) * 16 > b.x && y * 16 < b.y + b.h && (y + 1) * 16 > b.y)) m.block(x, y, true);
    }
    if (z.id === 'overworld') { const reach = new E.FlowField(m); reach.update(z.spawn.x, z.spawn.y); m.reachable = reach.d; }
    mapCache.set(z.id, m); return m;
  }
  function makeParty() {
    party = D.heroes.map((def, i) => {
      const p = new E.Body({ x: state.position.x + (i - 1) * 19, y: state.position.y + i * 14, r: 6, z: 0, id: def.id, def, index: i, facing: -Math.PI / 2, hurt: 0, invul: 0, dash: 0, dashCd: 0, artCd: 0, basicCd: 0, cast: 0, knockX: 0, knockY: 0, actionLock: 0, aiTimer: i * .2 });
      Object.defineProperties(p, { hp: { get: () => state.party[i].hp, set: v => { state.party[i].hp = v; } }, mp: { get: () => state.party[i].mp, set: v => { state.party[i].mp = v; } }, rank: { get: () => state.party[i].rank }, dead: { get: () => p.hp <= 0 } });
      p.rig = new E.Humanoid(def.rig);
      p.combo = new E.Combo(i === 0 ? [new E.Attack('slash', { recover: .19 }), new E.Attack('backslash', { recover: .19 }), new E.Attack('overhead', { wind: .12, recover: .24 })] : [new E.Attack('thrust', { wind: .13, active: .12, recover: .32 })]);
      return p;
    });
    renderPartyHud();
  }
  function spawnEnemy(type, x, y, groupId, index) {
    const base = D.enemyStats[type], tier = zone.groups.find(g => g.id === groupId)?.level || 1;
    const scale = ['warden', 'loom'].includes(type) ? 1 : 1 + (tier - 1) * .25;
    const def = { ...base, hp: Math.round(base.hp * scale), atk: Math.round(base.atk * (1 + (scale - 1) * .45)), xp: Math.round(base.xp * scale) };
    const e = new E.Body({ ...def, x, y, z: 0, type, id: groupId + ':' + index, groupId, maxHp: def.hp, hp: def.hp, facing: 1.5, homeX: x, homeY: y, t: index * 1.7, cd: .7 + index * .2, hurt: 0, flash: 0, stun: 0, windup: 0, state: 'idle', attack: null, break: 0, exposed: 0, phase: 1, cycle: 0, summoned: false, knockX: 0, knockY: 0, deathTime: 0 });
    map.collide(e); return e;
  }
  function populateEnemies() {
    enemies = [];
    for (const g of zone.groups) {
      if (state.flags.cleared.includes(g.id) || (g.boss && bossDone(g.id))) continue;
      g.enemies.forEach((type, i) => {
        const a = i * 2.4 + .6, spread = g.enemies.length === 1 ? 0 : 23;
        enemies.push(spawnEnemy(type, g.x + Math.cos(a) * spread, g.y + Math.sin(a) * spread, g.id, i));
      });
    }
  }
  function useZone(id, x, y, announce = true) {
    if (id === 'overworld' || state.flags.chapterTwoStarted) ensureWorld();
    zone = D.zones[id]; state.zone = id; map = makeMap(zone); flow = new E.FlowField(map);
    ({ x, y } = safePosition(map, x, y, zone.spawn));
    state.position = { x, y }; battle = null; hazards = []; shots.clear(); fxRings = []; context = null;
    party.forEach((p, i) => { p.x = x + (i - state.leader) * 15; p.y = y + (i === state.leader ? 0 : 20); p.vx = p.vy = p.z = 0; p.dash = 0; p.combo.cancel(); p.artCd = 0; const spot = safePosition(map, p.x, p.y, { x, y }); p.x = spot.x; p.y = spot.y; map.collide(p); });
    populateEnemies(); game.particles.list.length = 0;
    game.cam.bounds = view => map.bounds(view); game.cam.offset = [0, controls.touch ? -15 : -4];
    game.follow(party[state.leader], { z: 13, lead: 8 }); game.cam.snap = true;
    motes = Array.from({ length: 34 }, (_, i) => ({ x: E.hash2(i, 7) * zone.w * 16, y: E.hash2(i, 9) * zone.h * 16, z: 12 + E.hash2(i, 3) * 45, phase: E.hash2(i, 11) * 6.28 }));
    if (id === 'overworld') discoverWorld(false);
    if (['refuge', 'spire'].includes(id) && !state.world.discovered.includes(id)) state.world.discovered.push(id);
    setMusic(); updateHud();
    if (announce) showZoneTitle();
  }
  function travel(exit) {
    if (transition || battle || mode !== 'play') return;
    if (exit.requiresChapterOne && !state.flags.complete) return;
    if (exit.target === 'overworld' && !state.flags.chapterTwoStarted) { beginChapterTwo(); return; }
    if (exit.requiresBeacons && (!state.flags.maraMet || state.flags.windBeacons.length < 2)) { say([{ who: 'orren', text: 'The crosswinds are too strong. Mara can help us chart them. We need both wind beacons before we can enter the spire.' }]); return; }
    if (exit.targetLandmark) { const site = ensureWorld().landmarks.find(p => p.id === exit.targetLandmark); if (!site) return; exit = { ...exit, tx: site.x, ty: site.y + 32 }; }
    if (!state.flags.quest && exit.target === 'fen') { talkAda(); return; }
    if (exit.requiresRelays && state.flags.relays.length < 3) { say([{ who: 'orren', text: 'Three silent channels. The gate will open when every tide relay has power.' }]); return; }
    transition = true; const travelState = state; controls.clear(); $('transition').classList.add('covered');
    setTimeout(() => {
      if (state !== travelState || mode !== 'play') return;
      useZone(exit.target, exit.tx, exit.ty);
      state.checkpoint = { zone: zone.id, x: state.position.x, y: state.position.y }; save();
      $('transition').classList.remove('covered'); transition = false;
      if (zone.id === 'refuge' && !state.flags.maraMet) say([{ who: 'sera', text: 'The doors are open, but every roof has a rope around it.' }, { who: 'iona', text: 'Find the person with the charts. They will know where this wind began.' }]);
      if (zone.id === 'spire' && !state.flags.loomDefeated) say([{ who: 'orren', text: 'This machine is trying to shelter the valley. It has forgotten that weather must be allowed to move.' }, { who: 'iona', text: 'Then we will teach it how to let go.' }]);
      if (zone.id === 'observatory' && !state.flags.bossDefeated) say([{ who: 'orren', text: 'This was never a temple. It is a receiver. The whole coast has been answering someone.' }, { who: 'iona', text: 'Then we will tell it something new. The people below are not part of its machine.' }]);
    }, 330);
  }
  function save(quiet = false) {
    if (mode !== 'play' && !state.flags.complete) return false;
    const p = party[state.leader]; if (p) state.position = { x: p.x, y: p.y };
    const ok = E.store.set(SAVE, state); loaded = ok ? R.validSave(state) : loaded;
    if (!quiet) { $('save-status').textContent = ok ? '◇ JOURNEY SAVED' : 'SAVE UNAVAILABLE IN THIS BROWSER'; setTimeout(() => { $('save-status').textContent = ''; }, 2300); }
    return ok;
  }
  function applyOptions() {
    sound.setMuted(!state.options.music); sound.setVolume(state.options.volume);
    game.reduceMotion = state.options.reduceMotion; document.body.classList.toggle('reduce-motion', state.options.reduceMotion);
    if (game.zoom !== state.options.zoom) game.setZoom(state.options.zoom);
    $('sound-button').textContent = state.options.music ? '♪' : '♩';
    $('sound-button').setAttribute('aria-label', state.options.music ? 'Mute music' : 'Enable music');
  }
  function startJourney(resume = false) {
    sound.unlock();
    const options = { ...state.options };
    state = resume && loaded ? R.validSave(loaded) : R.fresh();
    state.options = options;
    state.options.autoAttack ||= touchFirst;
    mode = 'play'; transition = false; $('transition').classList.remove('covered'); ui.close(); dialogue = null; $('dialogue').hidden = true; $('title-screen').hidden = true; $('hud').hidden = false;
    makeParty(); useZone(state.zone, state.position.x, state.position.y, resume);
    applyOptions(); controls.setPaused(false); controls.clear();
    controls.enterGameMode({ fullscreen: controls.touch });
    $('screen').focus({ preventScroll: true });
    if (!resume || !state.flags.intro) {
      say([
        { who: 'iona', kicker: 'LARKSPUR QUAY · FIRST LIGHT', text: 'The tide should have turned before dawn. It is still coming in.' },
        { who: 'sera', text: 'The sea grass is turning to glass. Even the roots are full of light.' },
        { who: 'orren', text: 'There is a signal beneath the harbour. I recognise the pattern. I wish I did not.' },
        { who: 'iona', text: 'Keeper Ada is waiting in the square. Let us hear what she knows.' }
      ], () => { state.flags.intro = true; save(); showZoneTitle(); showControlHint(); });
    } else { if (R.isComplete(state)) ui.open('ending'); else showControlHint(); }
    updateHud();
  }
  function title() {
    save(true); mode = 'title'; transition = false; $('transition').classList.remove('covered'); ui.close(); controls.clear(); controls.setPaused(false); sound.resume(); sound.setMode('title');
    battle = null; shots.clear(); hazards = []; dialogue = null; $('dialogue').hidden = true; $('hud').hidden = true; $('title-screen').hidden = false;
    const keptOptions = { ...state.options }; state = R.fresh(); state.options = keptOptions; makeParty(); useZone('quay', 702, 454, false); game.setZoom(.75); game.follow(null); game.focus(630, 415, 10);
    updateContinue();
  }
  function updateContinue() { $('continue-button').hidden = !loaded; if (loaded) $('continue-label').textContent = D.zones[loaded.zone].name + ' · Level ' + loaded.level + (R.isComplete(loaded) ? ' · Chapter complete' : loaded.flags.chapterTwoStarted ? ' · Chapter II' : ''); }
  function setMusic() { sound.setMode(mode === 'title' ? 'title' : R.isComplete(state) ? 'victory' : battle ? battle.group.boss ? 'boss' : 'battle' : ['quay','refuge'].includes(zone.id) ? 'village' : ['fen','overworld'].includes(zone.id) ? 'field' : 'ruins'); }
  function toast(text, detail = '', good = false) {
    const el = document.createElement('div'); el.className = 'toast' + (good ? ' good' : ''); el.dataset.id = ++toastSerial;
    const titleNode = document.createElement('span'); titleNode.textContent = text; el.appendChild(titleNode);
    if (detail) { const small = document.createElement('small'); small.textContent = detail; el.appendChild(small); }
    $('toast-area').appendChild(el); while ($('toast-area').children.length > 3) $('toast-area').firstElementChild.remove();
    setTimeout(() => el.remove(), 3900);
  }
  function showZoneTitle() { $('zone-kicker').textContent = zone.id === 'quay' ? 'THE OLD COAST' : zone.id === 'fen' ? 'BEYOND THE LANTERNS' : zone.id === 'aqueduct' ? 'A ROAD BENEATH THE YEARS' : zone.id === 'overworld' ? 'CHAPTER II · A SKY WORTH SHARING' : zone.id === 'refuge' ? 'A LANTERN AGAINST THE WIND' : zone.id === 'spire' ? 'THE WEATHER WE INHERIT' : 'THE END OF THE SIGNAL'; $('zone-heading').textContent = zone.name; $('zone-subtitle').textContent = zone.subtitle; $('zone-title').hidden = false; $('zone-title').style.animation = 'none'; void $('zone-title').offsetWidth; $('zone-title').style.animation = ''; zoneTimer = 4.5; }
  function showControlHint() { if (controls.touch) { $('touch-hint').hidden = false; setTimeout(() => { $('touch-hint').hidden = true; }, 9000); } else toast('Follow the brass lamps.', 'WASD to move · E to interact · Tab to open the journal'); }
  function say(lines, onEnd) {
    controls.clear(); dialogue = { lines, index: 0, onEnd, full: '', shown: 0, done: false, choice: false }; $('dialogue').hidden = false; $('context-prompt').hidden = true; renderDialogue();
  }
  function renderDialogue() {
    const line = dialogue.lines[dialogue.index], i = D.heroes.findIndex(h => h.id === line.who), def = D.heroes[i];
    $('dialogue-name').textContent = line.name || def?.name || (line.who === 'ada' ? 'Keeper Ada' : line.who === 'mara' ? 'Mara' : 'The tide');
    $('dialogue-role').textContent = def?.role.toUpperCase() || (line.who === 'ada' ? 'HARBOUR KEEPER' : line.who === 'mara' ? 'WINDWARD CARTOGRAPHER' : 'AN OLD MEMORY');
    $('dialogue-kicker').textContent = line.kicker || (line.choices ? 'A QUIET MOMENT' : 'THE TIDE THAT REMEMBERS');
    Art.portrait($('dialogue-portrait'), line.who || 'orren');
    dialogue.full = line.text; dialogue.shown = 0; dialogue.done = false; dialogue.choice = !!line.choices;
    $('dialogue-text').textContent = ''; $('dialogue-choices').innerHTML = ''; $('dialogue-next').hidden = false;
    $('dialogue-count').textContent = String(dialogue.index + 1).padStart(2, '0') + ' / ' + String(dialogue.lines.length).padStart(2, '0');
  }
  function revealDialogue() {
    if (!dialogue) return;
    dialogue.shown = dialogue.full.length; dialogue.done = true; $('dialogue-text').textContent = dialogue.full;
    const line = dialogue.lines[dialogue.index];
    if (line.choices && !$('dialogue-choices').children.length) {
      $('dialogue-next').hidden = true;
      line.choices.forEach(c => { const b = document.createElement('button'); b.className = 'choice-button'; b.setAttribute('data-nav', ''); b.textContent = c.label; if (c.detail) { const small = document.createElement('small'); small.textContent = c.detail; b.appendChild(small); } b.addEventListener('click', () => { c.action(); dialogue.choice = false; nextDialogue(true); }); $('dialogue-choices').appendChild(b); });
      $('dialogue-choices').firstElementChild?.focus({ preventScroll: true });
    }
  }
  function nextDialogue(chosen = false) {
    if (!dialogue) return;
    if (!dialogue.done) { revealDialogue(); return; }
    if (dialogue.choice && !chosen) return;
    sound.sfx('menu'); dialogue.index++;
    if (dialogue.index < dialogue.lines.length) renderDialogue();
    else { const done = dialogue.onEnd; dialogue = null; $('dialogue').hidden = true; controls.clear(); $('screen').focus({ preventScroll: true }); if (done) done(); }
  }
  function talkAda() {
    if (state.flags.complete) { say([{ who: 'ada', text: 'The boats are back. The children are arguing about the colour of the sky. It sounds like home again.' }]); return; }
    if (state.flags.quest) { say([{ who: 'ada', text: 'Three relays: one in Glassfen, two in the old aqueduct. Their lamps will lead you to the observatory.' }, { who: 'ada', text: 'Rest at the road lanterns. Use what you find. A fine plan will not mend an empty medicine bag.' }]); return; }
    say([
      { who: 'ada', text: 'The observatory used to hold the tide steady. Last night, its bell rang without a keeper.' },
      { who: 'orren', text: 'Its relays are damaged. Restore all three and we can reach the control chamber.' },
      { who: 'ada', text: 'One relay stands in Glassfen. Two more lie in the sunken aqueduct. Follow the north road.' },
      { who: 'sera', text: 'I will bring the remedies. We can make more at a workshop, if we gather sunleaf.' },
      { who: 'iona', text: 'Keep the harbour clear. We will bring the tide home.' }
    ], () => { state.flags.quest = true; state.inventory.tonic += 1; save(); toast('A signal in the reeds', 'New objective: restore three tide relays. +1 Sunleaf tonic', true); updateHud(); });
  }
  function bondScene(hero) {
    if (hero === 'sera') {
      if (state.flags.seraBond) { say([{ who: 'sera', text: state.flags.seraBond === 'shelter' ? 'I have the last lantern. If anyone falls behind, I will find them.' : 'We do not have to stop being afraid. We only have to take the next step.' }]); return; }
      say([
        { who: 'sera', kicker: 'QUIET MOMENT · THE EMPTY BENCH', text: 'My brother left from this dock. I keep setting a place for him when I make tea.' },
        { who: 'sera', text: 'Is it foolish to keep a light for someone who may never see it?', choices: [
          { label: 'Keep the light. Someone will need it.', detail: 'Shelter: Sera can rescue the party once per battle.', action: () => { state.flags.seraBond = 'shelter'; } },
          { label: 'Bring it with us. Let it show the way.', detail: 'Courage: the party deals 10% more damage.', action: () => { state.flags.seraBond = 'courage'; } }
        ] },
        { who: 'sera', text: 'Then I will keep it burning. For all of us.' }
      ], () => { save(); toast('A light worth keeping', state.flags.seraBond === 'shelter' ? 'Sera learned Shelter. A rescue heal is ready each battle.' : 'Sera learned Courage. Party damage increased by 10%.', true); });
    } else {
      if (state.flags.orrenBond) { say([{ who: 'orren', text: state.flags.orrenBond === 'trust' ? 'I can hear your footsteps through the stone. Our signals are learning the same rhythm.' : 'The Warden has a flaw in its core shutters. I will mark it when they open.' }]); return; }
      say([
        { who: 'orren', kicker: 'QUIET MOMENT · THE SURVEY CAMP', text: 'The machine below uses my first language. I cannot remember who taught it to me.' },
        { who: 'orren', text: 'What if I was made to guard it, and not to help you?', choices: [
          { label: 'You have already chosen to help us.', detail: 'Trust: start every battle with 25 more resonance.', action: () => { state.flags.orrenBond = 'trust'; } },
          { label: 'Then learn its weakness. Choose again.', detail: 'Insight: the Warden’s exposed core stays open longer.', action: () => { state.flags.orrenBond = 'truth'; } }
        ] },
        { who: 'orren', text: 'A new choice. I would like to keep that.' }
      ], () => { save(); toast('More than a machine', state.flags.orrenBond === 'trust' ? 'Orren learned Trust. +25 resonance at each battle start.' : 'Orren learned Insight. Core exposure lasts 2 seconds longer.', true); });
    }
  }
  function availableObject(o) {
    if (['chest', 'gather'].includes(o.type) && state.flags.collected.includes(o.id)) return false;
    if (o.requiresChapterOne && !state.flags.complete) return false;
    if (o.type === 'heart' && !bossDone(o.bossId)) return false;
    if (o.type === 'boss' && bossDone(o.bossId)) return false;
    if (o.type === 'survey' && state.flags.windBeacons.includes(o.id)) return false;
    if (o.type === 'relay' && state.flags.relays.includes(o.id)) return false;
    return true;
  }
  function findContext() {
    if (battle || dialogue || ui.isOpen || transition) return null;
    const p = party[state.leader];
    return [...zone.objects, ...zone.exits].filter(availableObject).filter(o => E.dist(p, o) < (o.type === 'exit' ? 51 : 42)).sort((a, b) => E.dist(p, a) - E.dist(p, b))[0] || null;
  }
  function interact(o = context) {
    if (!o || battle) return;
    sound.sfx('confirm');
    if (o.type === 'exit') return travel(o);
    if (o.type === 'npc') return o.id === 'mara' ? talkMara() : talkAda();
    if (o.type === 'survey') return surveyBeacon(o);
    if (o.type === 'bond') return bondScene(o.hero);
    if (o.type === 'workshop') return openMenu('craft');
    if (o.type === 'camp') {
      R.rest(state); state.checkpoint = { zone: zone.id, x: o.x, y: o.y + 19 }; sound.sfx('heal');
      party.forEach(p => ring(p.x, p.y, '#a9e8a7', 32, .8)); save(); toast('Rest beneath the lantern', 'Health and energy restored. Checkpoint saved.', true); updateHud(); return;
    }
    if (o.type === 'chest' || o.type === 'gather') {
      const loot = o.loot || { [o.material]: o.amount }; R.addLoot(state, loot); state.flags.collected.push(o.id); sound.sfx('pickup');
      ring(o.x, o.y, '#f1d38a', 22, .7); game.particles.glints(o.x, o.y, 12, 12, '#f0d692');
      toast(o.type === 'chest' ? o.secret ? 'A path worth taking' : 'Supplies found' : 'Gathered', Object.entries(loot).map(([k, v]) => '+' + v + ' ' + D.materialNames[k]).join(' · '), true); save(true); updateHud(); return;
    }
    if (o.type === 'lore') { if (!state.flags.read.includes(o.id)) state.flags.read.push(o.id); say([{ who: 'orren', name: o.title, kicker: 'FIELD NOTE', text: o.text }], () => save(true)); return; }
    if (o.type === 'relay') {
      if (!state.flags.cleared.includes(o.group)) { startBattle(zone.groups.find(g => g.id === o.group)); return; }
      if (o.puzzle) { puzzle = { progress: [], object: o, message: 'The etched clue reads: leaf, sun, star.' }; ui.open('puzzle', puzzle); controls.setPaused(true); }
      else activateRelay(o);
      return;
    }
    if (o.type === 'boss' && o.bossId === 'loom') {
      if (!state.flags.maraMet || state.flags.windBeacons.length < 2) return;
      if (zone.groups.some(g => !g.boss && !g.optional && !state.flags.cleared.includes(g.id))) { say([{ who: 'iona', text: 'The path behind us must be clear. We cannot bring those sentries into the chamber.' }]); return; }
      say([{ who: 'orren', text: 'The Tempest Loom. A whole valley of wind, trapped in one frightened machine.' }, { who: 'sera', text: 'Those bright lanes are the crosswinds. Step between them before the light fills.' }, { who: 'iona', text: 'Break its guard with arts. When the core opens, we make it listen.' }], () => startBattle(zone.groups.find(g => g.id === 'loom'))); return;
    }
    if (o.type === 'boss') {
      say([{ who: 'iona', text: 'The keeper is still here.' }, { who: 'orren', text: 'Its core is shielded. Use our arts to break the shell. Strike when the glass opens.' }, { who: 'sera', text: 'Then stay close. I cannot heal a memory.' }], () => startBattle(zone.groups.find(g => g.boss))); return;
    }
    if (o.type === 'heart') o.bossId === 'loom' ? endChapterTwo() : endJourney();
  }
  function activateRelay(o) {
    if (state.flags.relays.includes(o.id)) return;
    state.flags.relays.push(o.id); state.sp += 2; state.link = Math.min(100, state.link + 20); sound.sfx('relay'); ring(o.x, o.y, '#93f0d9', 70, 1.6); game.particles.glints(o.x, o.y, 32, 20, '#b8ffee');
    toast(['The reeds answer.', 'The stone remembers.', 'The sky is listening.'][o.order], 'Relay ' + state.flags.relays.length + ' of 3 restored. +2 skill points.', true);
    if (state.flags.relays.length === 3) say([{ who: 'orren', text: 'All three channels are clear. The observatory gate is open.' }, { who: 'iona', text: 'One more climb. Then we find out what is calling the tide.' }]);
    save(); updateHud();
  }
  function endJourney() {
    if (state.flags.complete) { if (state.flags.chapterTwoStarted && !state.flags.chapterTwoComplete) say([{ who: 'orren', text: 'The tide is steady. The new signal is coming from the Windward Reach.' }]); else ui.open('ending'); return; }
    say([
      { who: 'orren', kicker: 'THE HEART OF THE TIDE', text: 'It is a distress call. The receiver has been waiting centuries for a ship that never came.' },
      { who: 'sera', text: 'All this time, the sea was trying to bring someone home.' },
      { who: 'iona', text: 'Then let it rest. Leave one small light, and give the rest back to the harbour.' },
      { who: 'orren', text: state.flags.orrenBond === 'trust' ? 'I have saved this moment. My first memory that belongs only to me.' : state.flags.orrenBond === 'truth' ? 'I know what I was made for. I also know what I choose.' : 'A new signal. Three voices, travelling together.' },
      { who: 'sera', text: state.flags.seraBond === 'shelter' ? 'One light for anyone still out there. And a warm place for those who return.' : state.flags.seraBond === 'courage' ? 'There is a long road beyond the harbour. We have enough light for the first step.' : 'The reeds are green again. I think it is time for tea.' }
    ], () => {
      state.flags.complete = true; state.link = 100; R.rest(state); save(); sound.setMode('victory'); sound.sfx('relay');
      const completedState = state;
      const stillHere = () => state === completedState && mode === 'play' && state.flags.complete && !state.flags.chapterTwoStarted;
      for (let i = 0; i < 7; i++) setTimeout(() => { if (!stillHere()) return; ring(512, 230, '#aee8cf', 45 + i * 19, 2); game.particles.glints(450 + i * 19, 225, 35, 12, '#f0d8a1'); }, i * 170);
      setTimeout(() => { if (!stillHere()) return; ui.open('ending'); controls.setPaused(true); }, 950);
    });
  }

  /* Chapter II grows out of the restored receiver. Its world seed never changes mid-journey. */
  function persistOptions() {
    if (mode === 'title' && loaded) {
      loaded.options = { ...state.options };
      E.store.set(SAVE, loaded);
    }
  }
  function beginChapterTwo() {
    if (!state.flags.complete || mode !== 'play' || battle || dialogue || transition) return;
    if (state.flags.chapterTwoStarted) { closeMenu(); return; }
    const journey = state; closeMenu();
    say([
      { who: 'orren', kicker: 'CHAPTER II · A SKY WORTH SHARING', text: 'Wait. The receiver has answered. This signal is new. Someone beyond the northern hills is still there.' },
      { who: 'sera', text: 'Someone kept a light for us. We should take them a little tea.' },
      { who: 'iona', text: 'The harbour can sleep now. Ada has a boat ready for the north shore. Let us see who is awake.' },
      { who: 'orren', text: 'The Windward Reach. Old roads, moving weather, and a chart with more questions than names.' }
    ], () => {
      if (state !== journey || mode !== 'play') return;
      state.flags.chapterTwoStarted = true; state.sp = Math.min(99, state.sp + 4);
      R.addLoot(state, { tonic: 2, tea: 1, herb: 3, ore: 2 }); R.rest(state);
      const world = ensureWorld();
      useZone('overworld', world.spawn.x, world.spawn.y);
      state.checkpoint = { zone: 'overworld', ...world.spawn };
      save(); toast('A new road opens', '+4 skill points · New rank cap: 5 · Stormglass focus recipe learned', true);
      toast('Find Windfall Refuge', 'Open the map. Major destinations are marked; explore to chart the land.');
    });
  }
  function talkMara() {
    if (state.flags.chapterTwoComplete) {
      say([{ who: 'mara', text: 'A courier crossed the eastern bridge this morning. A child asked me to draw a road we have not walked yet.' }, { who: 'mara', text: 'That is a good kind of unfinished map.' }]); return;
    }
    if (state.flags.maraMet) {
      say([{ who: 'mara', text: state.flags.loomDefeated ? 'The wind has changed. Finish your work at the Skyheart. We will keep the lamps burning.' : state.flags.windBeacons.length === 2 ? 'Both bearings hold. Stormglass Spire is open. Rest here, finish your tools, then follow the northern road.' : 'The western beacon reads the sea. The eastern beacon reads the upper wind. Clear their guardians and align both. Your chart marks their positions.' },
        { who: 'mara', text: 'Discovered waystones let you return by the world map. The coast road, our refuge, the crosswind camp, and the spire all have one.' }]); return;
    }
    const journey = state;
    say([
      { who: 'mara', kicker: 'WINDFALL REFUGE · AN UNFINISHED MAP', text: 'You came from the coast? Then the tide receiver is working. We have been sending that call for six nights.' },
      { who: 'iona', text: 'We heard you. What is holding the wind here?' },
      { who: 'mara', text: 'The Tempest Loom, inside Stormglass Spire. It once made safe weather for the farms. Now it keeps every storm it has ever caught.' },
      { who: 'orren', text: 'The sea below. The sky above. Two parts of the same shelter.' },
      { who: 'mara', text: 'Chart our west and east beacons. Their bearings will open a calm path to the spire. Take the roads, use the camp, and bring everyone back.' }
    ], () => { if (state !== journey) return; state.flags.maraMet = true; R.addLoot(state,{herb:2,shard:2}); save(); toast('Two bearings for a restless sky', 'Chart both wind beacons. +2 sunleaf · +2 glass shards', true); updateHud(); });
  }
  function surveyBeacon(o) {
    if (!state.flags.chapterTwoStarted || state.flags.windBeacons.includes(o.id)) return;
    if (!state.flags.maraMet) { say([{ who: 'orren', text: 'A wind bearing, but the reference chart is missing. Someone at Windfall Refuge will know how to align it.' }]); return; }
    if (!state.flags.cleared.includes(o.group)) { startBattle(zone.groups.find(g => g.id === o.group)); return; }
    state.flags.windBeacons.push(o.id); state.sp = Math.min(99, state.sp + 2); state.link = Math.min(100, state.link + 20);
    sound.sfx('relay'); ring(o.x,o.y,'#b4ece0',76,1.7); game.particles.glints(o.x,o.y,30,22,'#d5f6df');
    toast(o.order === 0 ? 'The sea wind holds.' : 'The sky wind answers.', 'Bearing ' + state.flags.windBeacons.length + ' of 2 charted. +2 skill points.', true);
    if (state.flags.windBeacons.length === 2) say([{ who:'orren',text:'Both bearings are clear. There is a calm path to Stormglass Spire.' },{who:'sera',text:'Mara has a workshop. Let us make sure we are ready before we climb.'}]);
    save(); updateHud();
  }
  function fastTravel(id) {
    if (mode !== 'play' || !state.flags.chapterTwoStarted || battle || dialogue || transition) return;
    const site = ensureWorld().landmarks.find(p => p.id === id);
    if (!site || !site.fastTravel || !state.world.discovered.includes(id)) { toast('Chart this place first', 'Reach its waystone on foot to unlock travel.'); return; }
    if (id === 'spire' && (!state.flags.maraMet || state.flags.windBeacons.length < 2)) { toast('The crosswinds still block the spire', 'Meet Mara and chart both wind beacons first.'); return; }
    closeMenu(); travel({ target:'overworld', tx:site.x, ty:site.y+24 });
  }
  function endChapterTwo() {
    if (!state.flags.loomDefeated || !state.flags.chapterTwoStarted) return;
    if (state.flags.chapterTwoComplete) { openMenu('ending'); return; }
    const journey = state;
    say([
      { who:'orren',kicker:'THE SKYHEART · A SKY WORTH SHARING',text:'It was given one rule: keep them safe. It never learned the difference between shelter and a locked door.' },
      { who:'iona',text:'Give it a new rule. A safe road must let people leave.' },
      { who:'sera',text:state.flags.seraBond==='shelter'?'And keep a light for when they choose to come home.':state.flags.seraBond==='courage'?'And enough light to take the next step, even when the map ends.':'And a place to share the stories they bring back.' },
      { who:'orren',text:state.flags.orrenBond==='truth'?'The new weather chart belongs to the refuge. No hidden instructions. No sealed records.':'I have opened the channels. Not one voice in command. Everyone listening.' },
      { who:'mara',kicker:'WINDFALL REFUGE · THE FIRST CLEAR EVENING',text:'The bridge bells are ringing. The sky is moving again. Wherever you go next, there will be a road back to us.' }
    ], () => {
      if (state !== journey || mode !== 'play') return;
      state.flags.chapterTwoComplete = true; R.rest(state); state.link=100; save();
      sound.setMode('victory'); sound.sfx('relay'); ring(512,200,'#e1f7c6',160,2.4);
      openMenu('ending');
    });
  }

  /* Combat uses the engine's bodies, attack phases, combo windows and projectiles. */
  function ring(x, y, color, max = 40, life = .6) { fxRings.push({ x, y, color, max, life, t: 0 }); }
  function currentEnemies() { return battle ? enemies.filter(e => e.groupId === battle.group.id && !e.dead) : []; }
  function nearestEnemy(p, limit = 220) { let best = null, dist = limit; for (const e of currentEnemies()) { const d = E.dist(p, e); if (d < dist) { best = e; dist = d; } } return best; }
  function startBattle(group) {
    if (!group || battle || state.flags.cleared.includes(group.id)) return;
    battle = { group, time: 0, rescue: false, clean: true }; context = null;
    if (state.flags.orrenBond === 'trust') state.link = Math.min(100, state.link + 25);
    for (const e of currentEnemies()) { e.cd = 1.0; e.state = 'idle'; e.guardLock = isBoss(e) ? 2.5 : 0; }
    party.forEach(p => { p.aiTimer = .4; p.artCd = Math.min(2, p.artCd); });
    if (group.boss) { game.follow(null); updateCamera(); toast(group.id === 'loom' ? 'The Tempest Loom' : 'The Glass Warden', group.id === 'loom' ? 'Break its guard. Step between the crosswind lanes.' : 'Break its guard with arts. Evade the marked ground.'); sound.sfx('boss'); }
    else toast(group.tutorial ? 'The reeds are moving' : 'Hold the line', group.tutorial ? controls.touch ? 'Basic attacks are automatic. Move out of amber warnings. Tap an art to spend energy.' : 'Hold J to attack. K uses an art. L evades amber warnings. Q changes leader.' : 'Your companions will fight beside you.');
    setMusic(); updateHud();
  }
  function victory() {
    if (!battle) return;
    const g = battle.group, list = enemies.filter(e => e.groupId === g.id), xp = list.reduce((n, e) => n + e.xp, 0), count = list.length, oldSp = state.sp;
    state.flags.cleared.push(g.id); const levels = R.award(state, xp, count);
    R.addLoot(state, g.boss ? { shard: 3, ore: 2 } : { shard: 1, ...(count > 2 ? { herb: 1 } : {}) });
    if (g.boss) { if (g.id === 'loom') state.flags.loomDefeated = true; else state.flags.bossDefeated = true; }
    battle = null; shots.clear('enemy'); hazards = []; party.forEach(p => { p.combo.cancel(); p.cast = 0; });
    if (g.boss) { game.follow(party[state.leader], { z: 13, lead: 8 }); game.cam.offset = [0, controls.touch ? -15 : -4]; game.setZoom(state.options.zoom); }
    sound.sfx(levels ? 'levelup' : 'confirm'); setMusic();
    toast(g.boss ? g.id === 'loom' ? 'The wind is yours again.' : 'The Warden is still.' : 'Field clear', '+' + xp + ' experience · +' + (state.sp - oldSp) + ' skill points · ' + (levels ? 'Party level ' + state.level : 'Supplies recovered'), true);
    if (levels) { renderPartyHud(); party.forEach(p => { ring(p.x, p.y, '#ebd18c', 38, 1.2); game.particles.glints(p.x, p.y, 20, 9, '#f7de9e'); }); }
    if (g.boss) { say([{ who: 'orren', text: g.id === 'loom' ? 'The crosswinds have stopped. The Skyheart is ready. Give this weather back to the valley.' : 'The shutters are open. We can reach the heart now.' }]); }
    save(); updateHud();
  }
  function damageEnemy(e, amount, source, art = false) {
    if (!e || e.dead) return;
    let dmg = amount * (state.flags.seraBond === 'courage' ? 1.1 : 1);
    if (isBoss(e)) {
      dmg *= e.exposed > 0 ? 1.65 : .72;
      if (e.exposed <= 0 && !(e.guardLock > 0)) e.break += art ? 20 : 3.4;
      if (e.break >= 100 && e.exposed <= 0 && !(e.guardLock > 0)) { e.break = 0; e.exposed = state.flags.orrenBond === 'truth' ? 7 : 5; e.attack = null; e.windup = 0; e.state = 'exposed'; e.cd = e.exposed; ring(e.x, e.y, '#b5fce1', 70, 1.1); toast('Core exposed', 'Attack now. The open core takes more damage.', true); sound.sfx('relay'); }
    }
    dmg = Math.max(1, Math.round(dmg));
    // Crossing the phase boundary ends the current opening, even during a large burst.
    if (isBoss(e) && e.phase === 1) dmg = Math.min(dmg, Math.max(0, e.hp - Math.ceil(e.maxHp * .52)));
    e.hp = Math.max(0, e.hp - dmg); e.hurt = .12; e.flash = .12;
    if (isBoss(e) && e.phase === 1 && e.hp <= Math.ceil(e.maxHp * .52)) beginBossPhaseTwo(e);
    if (source) { const a = E.angleTo(source, e); if (!isBoss(e)) { e.knockX += Math.cos(a) * (art ? 48 : 18); e.knockY += Math.sin(a) * (art ? 48 : 18); } }
    game.particles.text(e.x + (E.hash2(e.hp, 8) - .5) * 9, e.y, isBoss(e) ? 50 : 25, String(dmg), art ? '#d9fae6' : '#ffe4b0', { bounce: true });
    game.particles.impact(e.x, e.y, isBoss(e) ? 30 : 14, art ? 7 : 4, art ? '#8eeadd' : '#ffe2a3');
    if (source?.index === state.leader) { game.freeze(art ? .025 : .014); sound.sfx('hit'); }
    state.link = Math.min(100, state.link + (art ? 5.5 : 2.3) + state.party[2].rank * .4);
    if (source?.index !== undefined) source.mp = Math.min(R.maxMp(state, source.index), source.mp + (art ? 0 : 1.3));
    if (e.hp <= 0) { e.dead = true; e.deathTime = .6; e.attack = null; e.windup = 0; game.particles.sparks(e.x, e.y, 16, isBoss(e) ? 30 : 10, null, { color: e.color }); sound.sfx('pickup');
      if (isBoss(e)) { enemies.filter(q => q.groupId === e.groupId && !q.dead).forEach(q => { q.dead = true; q.hp = 0; q.deathTime = .4; }); game.shake(3); ring(e.x, e.y, '#9ef9e4', 130, 1.8); }
    }
  }
  function damageHero(p, amount, from) {
    if (!p || p.hp <= 0 || p.invul > 0 || p.dash > 0) return false;
    let dmg = amount * (state.options.difficulty === 'story' ? .5 : 1) * (state.options.tactics === 'guard' ? .85 : 1) * (p.index !== state.leader ? .72 : 1);
    dmg = Math.max(1, Math.round(dmg)); p.hp = Math.max(0, p.hp - dmg); p.hurt = .28; p.invul = .42; state.stats.damageTaken += dmg;
    if (battle) battle.clean = false;
    if (from) { const a = E.angleTo(from, p); p.knockX += Math.cos(a) * 58; p.knockY += Math.sin(a) * 58; }
    game.particles.text(p.x, p.y, 31, String(dmg), '#ffac92', { bounce: true });
    if (p.index === state.leader) { game.shake(1.3); sound.sfx('hurt'); }
    if (p.hp <= 0) { p.combo.cancel(); toast(p.def.name + ' is down', 'A Sunleaf tonic can bring them back.'); if (p.index === state.leader) switchLeader(); }
    if (battle && !battle.rescue && state.flags.seraBond === 'shelter' && party.some(q => q.hp / R.maxHp(state, q.index) < .25) && party[1].hp > 0) {
      battle.rescue = true; party.forEach(q => { if (q.hp > 0) { q.hp = Math.min(R.maxHp(state, q.index), q.hp + 40); ring(q.x, q.y, '#c8e5a8', 28, .8); } });
      toast('Sera · Shelter', '“No one is left behind.” +40 party health', true); sound.sfx('heal');
    }
    if (party.every(q => q.hp <= 0)) defeat();
    return true;
  }
  function defeat() { if (mode !== 'play') return; state.stats.defeats++; mode = 'defeat'; controls.clear(); controls.setPaused(true); sound.sfx('defeat'); setTimeout(() => { if (mode === 'defeat') sound.suspend(); }, 1400); ui.open('defeat'); updateHud(); }
  function retry() {
    mode = 'play'; ui.close(); controls.setPaused(false); sound.resume(); R.rest(state); state.link = Math.max(25, state.link); state.inventory.tonic = Math.max(2, state.inventory.tonic);
    const c = state.checkpoint; useZone(c.zone, c.x, c.y); save(); toast('The lantern is still lit.', 'Progress kept. Health restored. Two tonics are available.', true);
  }
  function switchLeader(index) {
    const next = Number.isInteger(index) && party[index]?.hp > 0 ? index : [1, 2, 3].map(n => (state.leader + n) % 3).find(i => party[i].hp > 0);
    if (next === undefined || next === state.leader) return;
    state.leader = next; if (battle?.group.boss) { game.follow(null); updateCamera(); } else game.follow(party[next], { z: 13, lead: 8 }); sound.sfx('menu'); renderPartyHud(); updateHud();
  }
  function tryAttack(p, target = nearestEnemy(p)) {
    if (p.hp <= 0 || p.basicCd > 0 || p.dash > 0 || p.actionLock > 0) return false;
    if (target) p.facing = E.angleTo(p, target);
    if (p.combo.press()) {
      p.basicCd = p.index === 0 ? .33 : p.index === 1 ? .78 : .66;
      p.pendingShot = p.index !== 0 ? { angle: p.facing, dmg: R.attack(state, p.index), target } : null;
      if (p.index === state.leader) sound.sfx('attack');
      return true;
    }
    return false;
  }
  function projectile(p, angle, damage, extra = {}) {
    const color = p.def?.color || p.color || '#9de4d1';
    shots.fire({ x: p.x + Math.cos(angle) * 10, y: p.y + Math.sin(angle) * 10, z: 12, vx: Math.cos(angle) * (extra.speed || 225), vy: Math.sin(angle) * (extra.speed || 225), r: extra.r || 3.5, dmg: damage, team: extra.team || 'player', color, core: '#f5ffdd', life: 1.8, data: { source: p, art: !!extra.art }, ...extra });
  }
  function useArt(p = party[state.leader], automated = false) {
    if (p.hp <= 0 || p.artCd > 0 || p.dash > 0 || p.actionLock > 0) return false;
    if (p.mp < p.def.cost) { if (!automated) toast('Not enough energy', 'Basic hits restore energy. Starlight tea restores 40.'); return false; }
    const target = nearestEnemy(p, 290);
    if (p.index !== 1 && !target) { if (!automated) toast('No threat in range', 'Save your energy for the next encounter.'); return false; }
    if (p.index === 1 && party.every(q => q.hp >= R.maxHp(state, q.index))) { if (!automated) toast('Everyone is well', 'Sunmend restores party health.'); return false; }
    p.mp -= p.def.cost; p.artCd = p.index === 1 ? 7 : p.index === 0 ? 4.3 : 5.5; p.cast = .52; p.actionLock = .32; p.combo.cancel(); state.stats.arts++;
    if (target) p.facing = E.angleTo(p, target);
    sound.sfx(p.index === 1 ? 'heal' : 'art');
    if (p.index === 0) {
      if (E.dist(p, target) < 65) {
        currentEnemies().filter(e => E.dist(p, e) < 71 + e.r).forEach(e => damageEnemy(e, R.attack(state, 0) * 2.25, p, true));
        fxRings.push({ x: p.x, y: p.y, color: '#9effe3', max: 69, life: .45, t: 0, arc: true, angle: p.facing }); game.shake(1.1);
      } else { projectile(p, p.facing, R.attack(state, 0) * 2.2, { r: 9, pierce: true, art: true, speed: 255, life: 1.3 }); ring(p.x, p.y, '#7cdad5', 28, .4); }
    } else if (p.index === 1) {
      const heal = 46 + p.rank * 10 + (state.level - 1) * 4;
      party.forEach(q => { if (q.hp > 0) { q.hp = Math.min(R.maxHp(state, q.index), q.hp + heal); ring(q.x, q.y, '#d9e7a1', 37, .9); game.particles.text(q.x, q.y, 33, '+' + heal, '#d6edaa', { bounce: false }); game.particles.glints(q.x, q.y, 15, 8, '#d9e7a1'); } });
    } else {
      const x = target.x, y = target.y; ring(x, y, '#c9b6ff', 73, .7);
      currentEnemies().filter(e => Math.hypot(e.x - x, e.y - y) < 78 + e.r).forEach(e => { damageEnemy(e, R.attack(state, 2) * 2.45, p, true); if (!isBoss(e)) e.stun = 1.55; });
      game.particles.glints(x, y, 18, 20, '#cbb9fc');
    }
    updateHud(); return true;
  }
  function evade(p = party[state.leader], direction) {
    if (p.hp <= 0 || p.dashCd > 0 || p.dash > 0) return false;
    let dir = direction || game.view.screenDirToGround(...controls.move());
    if (Math.hypot(...dir) < .1) dir = [Math.cos(p.facing), Math.sin(p.facing)];
    const l = Math.hypot(...dir) || 1; p.dashX = dir[0] / l; p.dashY = dir[1] / l; p.dash = .24; p.invul = .35; p.dashCd = 1.05; p.combo.cancel(); p.cast = 0;
    sound.sfx('dodge'); return true;
  }
  function useTonic() { const result = R.heal(state); if (!result.ok) { toast(result.reason); return; } party.forEach(p => { ring(p.x, p.y, '#bbebb1', 31, .9); }); sound.sfx('heal'); updateHud(); save(true); }
  function useLink() {
    if (!battle) { toast('Convergence needs a battle', 'Build resonance with hits and arts.'); return; }
    if (state.link < 100) { toast('The party is still finding its rhythm', 'Resonance: ' + Math.floor(state.link) + ' / 100'); return; }
    if (party.some(p => p.hp <= 0)) { toast('Convergence needs all three companions', 'Use a tonic to revive a fallen ally.'); return; }
    state.link = 0; state.stats.links++; sound.sfx('link'); game.freeze(.1); game.shake(3); game.flash('#cfefd6', .14, .25);
    const p = party[state.leader]; party.forEach(q => { q.hp = Math.min(R.maxHp(state, q.index), q.hp + 25); q.cast = .7; q.invul = .8; ring(q.x, q.y, q.def.color, 65, .9); });
    currentEnemies().forEach(e => { damageEnemy(e, isBoss(e) ? 210 : 110, p, true); if (!isBoss(e)) e.stun = 1.4; });
    state.link = 0; toast('CONVERGENCE', 'Three voices. One signal.', true); updateHud();
  }

  function canWalkLine(x, y, tx, ty) {
    const n = Math.max(1, Math.ceil(Math.hypot(tx - x, ty - y) / 9));
    for (let i = 1; i <= n; i++) if (!map.walkable(Math.floor((x + (tx - x) * i / n) / 16), Math.floor((y + (ty - y) * i / n) / 16))) return false;
    return true;
  }
  function walkTo(p, tx, ty, speed) {
    let dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 3) { p.vx = p.vy = 0; return; }
    if (canWalkLine(p.x, p.y, tx, ty)) { dx /= d; dy /= d; }
    else { if (!p.flow || p.flow.map !== map) p.flow = new E.FlowField(map); p.flow.update(tx, ty); [dx, dy] = p.flow.dir(p.x, p.y, tx, ty); }
    p.vx = dx * speed; p.vy = dy * speed; p.facing = Math.atan2(dy, dx);
  }
  function allyAI(p, dt) {
    const lead = party[state.leader]; p.vx = p.vy = 0; p.aiTimer -= dt;
    if (p.hp <= 0) return;
    if (battle) {
      let target = state.options.tactics === 'focus' && leaderTarget && !leaderTarget.dead ? leaderTarget : nearestEnemy(p, 600);
      const trouble = hazards.find(h => h.kind === 'mark' && h.t < h.wind && h.t > .25 && Math.hypot(h.x - p.x, h.y - p.y) < h.r + 8);
      if (trouble && p.dashCd <= 0 && p.aiTimer < 0) { evade(p, [p.x - trouble.x || 1, p.y - trouble.y || 1]); p.aiTimer = .6; }
      const lane = hazards.find(h => h.kind === 'lane' && !h.done && h.t > .2 && pointSegment(p.x,p.y,h.x1,h.y1,h.x2,h.y2) < h.halfWidth + 12);
      if (lane && p.dashCd <= 0 && p.aiTimer < 0) { const vx=lane.x2-lane.x1,vy=lane.y2-lane.y1,side=(p.x-lane.x1)*vy-(p.y-lane.y1)*vx; evade(p,[vy*(side>=0?1:-1),-vx*(side>=0?1:-1)]); p.aiTimer=.65; }
      const threshold = state.options.tactics === 'guard' ? .8 : .6;
      if (p.index === 1 && party.some(q => q.hp > 0 && q.hp < R.maxHp(state, q.index) * threshold)) useArt(p, true);
      if (target) {
        const d = E.dist(p, target), range = p.index === 0 ? 27 : p.index === 1 ? 95 : 84;
        const guardTooFar = state.options.tactics === 'guard' && E.dist(p, lead) > 78;
        if (guardTooFar) walkTo(p, lead.x, lead.y, p.def.speed);
        else if (d > range) walkTo(p, target.x, target.y, p.def.speed * .89);
        else if (p.index !== 0 && d < 48) { const a = E.angleTo(target, p); p.vx = Math.cos(a) * p.def.speed * .65; p.vy = Math.sin(a) * p.def.speed * .65; }
        if (d < p.def.range + target.r + 8) { tryAttack(p, target); p.facing = E.angleTo(p, target); }
        if (p.index !== 1 && p.aiTimer <= 0 && d < (p.index === 0 ? 64 : 180) && p.mp >= p.def.cost + (state.options.tactics === 'guard' ? 22 : 8)) { useArt(p, true); p.aiTimer = 1.1; }
      }
    } else {
      const side = p.index < state.leader ? -1 : 1, a = lead.facing;
      const tx = lead.x - Math.cos(a) * (23 + p.index * 7) + Math.cos(a + Math.PI / 2) * side * 17;
      const ty = lead.y - Math.sin(a) * (23 + p.index * 7) + Math.sin(a + Math.PI / 2) * side * 17;
      if (Math.hypot(p.x - tx, p.y - ty) > 12) walkTo(p, tx, ty, p.def.speed * (E.dist(p, lead) > 100 ? 1.4 : 1.05));
    }
  }
  function updateParty(dt) {
    for (const p of party) {
      for (const k of ['hurt', 'invul', 'dashCd', 'artCd', 'basicCd', 'cast', 'actionLock']) p[k] = Math.max(0, p[k] - dt);
      if (p.hp > 0) p.mp = Math.min(R.maxMp(state, p.index), p.mp + dt * (battle ? .75 : 2.1));
      if (p.index !== state.leader) allyAI(p, dt);
      else {
        p.vx = p.vy = 0;
        if (p.hp > 0) { const [sx, sy] = controls.move(); const [dx, dy] = game.view.screenDirToGround(sx, sy); if (dx || dy) { p.vx = dx * p.def.speed; p.vy = dy * p.def.speed; if (!p.combo.busy) p.facing = Math.atan2(dy, dx); timeSinceInput = 0; } }
      }
      if (p.hp <= 0) { p.vx = p.vy = 0; }
      if (zone.id === 'overworld' && !battle) { p.vx *= 1.35; p.vy *= 1.35; }
      if (p.actionLock > 0) { p.vx *= .22; p.vy *= .22; }
      if (p.dash > 0) {
        p.dash -= dt; p.vx = p.dashX * 240; p.vy = p.dashY * 240;
        if (Math.floor((clock - dt) * 32) !== Math.floor(clock * 32)) echoes.push({ x: p.x, y: p.y, color: p.def.color, t: .26 });
      }
      p.vx += p.knockX; p.vy += p.knockY; p.knockX *= Math.exp(-dt * 12); p.knockY *= Math.exp(-dt * 12);
      p.update(dt, map);
      if (battle?.group.boss) { const g = battle.group, d = Math.hypot(p.x - g.x, p.y - g.y); if (d > 190) { p.x = g.x + (p.x - g.x) / d * 190; p.y = g.y + (p.y - g.y) / d * 190; } }
      const phase = p.combo.update(dt);
      if (phase === 'active' && p.pendingShot) { projectile(p, p.pendingShot.angle, p.pendingShot.dmg); p.pendingShot = null; }
      if (p.index === 0 && !p.dead) p.combo.hits(currentEnemies(), e => E.inArc(p, p.facing, e, p.def.range, 1.25), e => damageEnemy(e, R.attack(state, 0) * (p.combo.step === 2 ? 1.45 : 1), p));
      p.rig.update(dt, { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, facing: p.facing, attack: p.combo.state, hurt: p.hurt > 0, dash: p.dash > 0, pose: p.hp <= 0 ? 'down' : p.cast > 0 ? 'cast' : undefined, stance: battle ? 'ready' : undefined });
    }
    // Soft separation keeps three silhouettes readable without blocking a doorway.
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) { const a = party[i], b = party[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 11 && d > .01 && a.hp > 0 && b.hp > 0) { const shift = (11 - d) * .3; if (i !== state.leader) { a.x -= dx / d * shift; a.y -= dy / d * shift; map.collide(a); } if (j !== state.leader) { b.x += dx / d * shift; b.y += dy / d * shift; map.collide(b); } } }
  }
  function aimEnemy(e, target, kind, duration) {
    e.attack = { kind, tx: target.x, ty: target.y, angle: E.angleTo(e, target), duration, t: 0 }; e.windup = duration; e.state = 'windup'; e.vx = e.vy = 0;
  }
  function resolveEnemyAttack(e, a) {
    const boss = isBoss(e);
    if (a.kind === 'bite') {
      party.filter(p => !p.dead && E.inArc(e, a.angle, p, e.range + 7, 1.15)).forEach(p => damageHero(p, e.atk, e));
      fxRings.push({ x: e.x, y: e.y, color: '#edb47f', max: e.range + 6, life: .2, t: 0, arc: true, angle: a.angle });
    } else if (a.kind === 'bolt' || a.kind === 'fan') {
      const n = boss ? e.phase === 2 ? 7 : 5 : ['sentinel','coilkeeper'].includes(e.type) ? 3 : 1;
      for (let i = 0; i < n; i++) projectile(e, a.angle + (i - (n - 1) / 2) * (boss ? .28 : .2), e.atk, { speed: boss ? 130 : 112, team: 'enemy', color: boss ? '#ffc58c' : '#e7aad0', r: boss ? 6 : 4.5, life: 3.8 });
      sound.sfx('attack');
    } else if (a.kind === 'crosswind') {
      e.crosswindCycle = (e.crosswindCycle || 0) + 1;
      const vertical = e.crosswindCycle % 2 === 1, offsets = e.phase === 2 ? [-126, -42, 42, 126] : [-96, 0, 96];
      for (const offset of offsets) {
        const x1 = e.x + (vertical ? offset : -188), y1 = e.y + (vertical ? -188 : offset);
        const x2 = e.x + (vertical ? offset : 188), y2 = e.y + (vertical ? 188 : offset);
        hazards.push({ kind: 'lane', x1, y1, x2, y2, halfWidth: 13, wind: e.phase === 2 ? 1.0 : 1.2, t: 0, source: e, dmg: e.atk + 4, done: false });
      }
      sound.sfx('boss');
    } else if (a.kind === 'pulse') {
      hazards.push({ kind: 'ring', x: e.x, y: e.y, radius: 12, max: 183, speed: e.phase === 2 ? 118 : 98, t: 0, source: e, dmg: e.atk, hits: new Set() });
      if (e.phase === 2) hazards.push({ kind: 'ring', x: e.x, y: e.y, radius: -55, max: 183, speed: 118, t: 0, source: e, dmg: e.atk, hits: new Set() });
      sound.sfx('boss');
    } else if (a.kind === 'rain') {
      const points = e.phase === 2 ? party.filter(p => !p.dead) : [party[state.leader]];
      points.forEach(p => hazards.push({ kind: 'mark', x: p.x, y: p.y, r: 35, wind: 1.1, t: 0, source: e, dmg: e.atk + 3, done: false }));
    } else if (a.kind === 'beam') {
      hazards.push({ kind: 'beam', x: e.x, y: e.y, angle: a.angle, wind: .75, t: 0, source: e, dmg: e.atk + 5, done: false });
    }
    e.cd = boss ? e.phase === 2 ? 1.5 : 2.0 : e.cool; e.state = 'recover'; e.attack = null; e.windup = 0;
  }
  function beginBossPhaseTwo(e) {
    if (e.phase !== 1) return;
    e.phase = 2; e.exposed = 0; e.stun = 0; e.break = 0; e.guardLock = 4;
    e.attack = null; e.windup = 0; e.cd = 0; e.cycle = 0; e.crosswindCycle = 0;
    aimEnemy(e, party[state.leader], e.type === 'loom' ? 'crosswind' : 'pulse', 1.15);
    ring(e.x, e.y, '#edb48e', 130, 1); game.shake(2.5); sound.sfx('boss');
    toast(e.type === 'loom' ? 'Phase II · Eye of the storm' : 'Phase II · High tide', e.type === 'loom' ? 'The lanes turn. Find the gaps before the wind strikes.' : 'The guard is stabilising. Evade the two marked waves.');
    if (!e.summoned) { e.summoned = true; enemies.push(spawnEnemy(e.type === 'loom' ? 'gustling' : 'mite', e.x - 85, e.y + 50, e.groupId, 10), spawnEnemy(e.type === 'loom' ? 'gustling' : 'mite', e.x + 85, e.y + 50, e.groupId, 11)); }
  }
  function updateEnemies(dt) {
    const aliveParty = party.filter(p => p.hp > 0);
    for (const e of enemies) {
      e.t += dt; e.hurt = Math.max(0, e.hurt - dt); e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt); e.deathTime = Math.max(0, e.deathTime - dt);
      if (e.dead) continue;
      const active = battle && e.groupId === battle.group.id;
      if (!active) { e.vx = Math.cos(e.t * .8) * 2; e.vy = Math.sin(e.t * .65) * 2; e.x = e.homeX + Math.cos(e.t * .7) * 4; e.y = e.homeY + Math.sin(e.t * .6) * 3; map.collide(e); continue; }
      e.vx = e.vy = 0; e.cd -= dt; e.guardLock = Math.max(0, (e.guardLock || 0) - dt);
      if (isBoss(e) && e.hp <= Math.ceil(e.maxHp * .52) && e.phase === 1) beginBossPhaseTwo(e);
      if (e.exposed > 0) { e.exposed -= dt; e.state = 'exposed'; e.windup = 0; e.attack = null; if (e.exposed <= 0) { e.state = 'idle'; e.cd = .5; e.guardLock = 3.5; } continue; }
      if (e.stun > 0) { e.state = 'stagger'; e.attack = null; e.windup = 0; continue; }
      if (e.attack) { e.attack.t += dt; e.windup = Math.max(0, e.attack.duration - e.attack.t); if (e.attack.t >= e.attack.duration) resolveEnemyAttack(e, e.attack); }
      else if (aliveParty.length) {
        const target = aliveParty.reduce((a, p) => E.dist(e, p) < E.dist(e, a) ? p : a), dist = E.dist(e, target);
        if (isBoss(e)) {
          e.facing = E.lerpAng(e.facing, E.angleTo(e, target), dt * 2);
          if (e.cd <= 0) { const patterns = e.type === 'loom' ? (e.phase === 2 ? ['crosswind', 'rain', 'crosswind', 'fan'] : ['crosswind', 'fan', 'rain']) : e.phase === 2 ? ['rain', 'pulse', 'fan', 'beam'] : ['pulse', 'fan', 'rain']; const kind = patterns[e.cycle++ % patterns.length]; aimEnemy(e, target, kind, kind === 'pulse' || kind === 'crosswind' ? 1.2 : .8); }
        } else {
          const ranged = ['spitter','sentinel','coilkeeper'].includes(e.type);
          if (dist > e.range) walkTo(e, target.x, target.y, e.speed);
          else if (e.cd <= 0) aimEnemy(e, target, ranged ? 'bolt' : 'bite', e.wind);
          else if (ranged && dist < 48) { const a = E.angleTo(target, e); e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed; }
        }
      }
      e.vx += e.knockX; e.vy += e.knockY; e.knockX *= Math.exp(-dt * 12); e.knockY *= Math.exp(-dt * 12); e.update(dt, map);
    }
  }
  function pointSegment(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = E.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
  function updateHazards(dt) {
    for (const h of hazards) {
      h.t += dt;
      if (h.kind === 'ring') { h.radius += h.speed * dt; if (h.radius > 0) party.filter(p => !p.dead && !h.hits.has(p) && Math.abs(E.dist(h, p) - h.radius) < 9).forEach(p => { damageHero(p, h.dmg, h.source); h.hits.add(p); }); if (h.radius > h.max) h.dead = true; }
      if (h.kind === 'mark') { if (!h.done && h.t >= h.wind) { h.done = true; party.filter(p => !p.dead && E.dist(h, p) < h.r + p.r).forEach(p => damageHero(p, h.dmg, h.source)); game.particles.impact(h.x, h.y, 8, 18, '#ffc793'); ring(h.x, h.y, '#fac28b', 42, .35); sound.sfx('hit'); } if (h.t > h.wind + .4) h.dead = true; }
      if (h.kind === 'lane') { if (!h.done && h.t >= h.wind) { h.done = true; party.filter(p => !p.dead && pointSegment(p.x,p.y,h.x1,h.y1,h.x2,h.y2) < h.halfWidth + p.r).forEach(p => damageHero(p,h.dmg,h.source)); sound.sfx('art'); } if (h.t > h.wind + .45) h.dead = true; }
      if (h.kind === 'beam') { if (!h.done && h.t >= h.wind) { h.done = true; party.filter(p => !p.dead && pointSegment(p.x, p.y, h.x, h.y, h.x + Math.cos(h.angle) * 330, h.y + Math.sin(h.angle) * 330) < 13).forEach(p => damageHero(p, h.dmg, h.source)); sound.sfx('art'); } if (h.t > h.wind + .4) h.dead = true; }
    }
    E.prune(hazards, h => h.dead);
  }
  function processPlayInput() {
    if (controls.pressed('map')) { openMenu('map'); return; }
    if (controls.pressed('switch')) switchLeader();
    if (context && controls.pressed('interact')) { interact(); return; }
    if (controls.pressed('heal')) useTonic();
    if (controls.pressed('link')) useLink();
    if (controls.pressed('dodge')) evade();
    if (controls.pressed('art')) useArt();
    const p = party[state.leader]; leaderTarget = nearestEnemy(p);
    const auto = battle && (controls.touch || state.options.autoAttack) && leaderTarget && E.dist(p, leaderTarget) < p.def.range + leaderTarget.r;
    if (controls.down('attack') || auto) tryAttack(p, leaderTarget);
  }
  function menuNavigation() {
    const host = ui.isOpen ? $('modal-panel') : dialogue ? $('dialogue') : $('title-screen');
    let dir = controls.pressed('down') || controls.pressed('right') ? 1 : controls.pressed('up') || controls.pressed('left') ? -1 : 0;
    const padMove = controls.move();
    if (controls.device === 'gamepad') { if (Math.abs(padMove[1]) > .5 || Math.abs(padMove[0]) > .5) { if (clock - (menuNavigation.lastPad || 0) > .21) { dir = padMove[1] > .5 || padMove[0] > .5 ? 1 : -1; menuNavigation.lastPad = clock; } } else menuNavigation.lastPad = clock - .3; }
    const nodes = [...host.querySelectorAll('[data-nav]')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    if (dir && nodes.length) { let i = nodes.indexOf(document.activeElement); i = i < 0 ? 0 : (i + dir + nodes.length) % nodes.length; nodes[i].focus({ preventScroll: false }); sound.sfx('menu'); }
    if (controls.pressed('confirm')) {
      if (dialogue && !ui.isOpen && (!dialogue.done || !dialogue.choice)) nextDialogue();
      else if (nodes.includes(document.activeElement)) document.activeElement.click();
      else if (dialogue?.choice) nodes[0]?.focus({ preventScroll: true });
      else nodes[0]?.click();
    } else if (dialogue && !ui.isOpen && controls.pressed('interact')) nextDialogue();
    if (ui.isOpen && controls.pressed('cancel')) { if (!['ending','defeat','new-confirm'].includes(ui.kind)) closeMenu(); else if (ui.kind === 'new-confirm') closeMenu(); }
  }
  function openMenu(kind = 'journal') { controls.clear(); controls.setPaused(true); ui.open(kind); sound.sfx('menu'); }
  function closeMenu() { ui.close(); controls.clear(); controls.setPaused(false); sound.resume(); $('screen').focus({ preventScroll: true }); updateHud(); }
  function uiCommand(name, value) {
    sound.unlock();
    if (name === 'resume') return closeMenu();
    if (name === 'title') return title();
    if (name === 'restart') { loaded = null; return startJourney(false); }
    if (name === 'retry') return retry();
    if (name === 'begin-chapter-two') return beginChapterTwo();
    if (name === 'fast-travel') return fastTravel(value);
    if (name === 'continue-explore') { closeMenu(); mode = 'play'; updateHud(); return; }
    if (name === 'leader') { switchLeader(Number(value)); ui.refresh(); return; }
    if (name === 'craft') { if (battle) return toast('Craft after the battle.'); const c = R.craft(state, value); sound.sfx(c.ok ? 'confirm' : 'menu'); toast(c.ok ? c.name + ' crafted' : c.reason, c.ok ? 'Ready for the journey.' : '', c.ok); save(true); ui.refresh(); updateHud(); return; }
    if (name === 'upgrade') { const r = R.upgrade(state, Number(value)); toast(r.ok ? D.heroes[Number(value)].skill + ' improved' : r.reason, r.ok ? D.heroes[Number(value)].perk : '', r.ok); sound.sfx(r.ok ? 'levelup' : 'menu'); save(true); ui.refresh(); updateHud(); return; }
    if (name === 'use') { const r = R.heal(state, value); toast(r.ok ? (D.materialNames[value] || value) + ' used' : r.reason, '', r.ok); if (r.ok) sound.sfx('heal'); save(true); ui.refresh(); updateHud(); return; }
    if (name === 'option') {
      if (value.key === 'fullscreen') return controls.toggleFullscreen().then(() => ui.refresh());
      if (value.key === 'gameMode') return (value.value ? controls.enterGameMode({ fullscreen: true }) : controls.leaveGameMode()).then(() => ui.refresh());
      state.options[value.key] = value.value; applyOptions(); persistOptions(); save(true); ui.refresh(); updateDeviceLabels(); return;
    }
    if (name === 'retreat') { if (battle) { closeMenu(); R.rest(state); const c = state.checkpoint; useZone(c.zone, c.x, c.y); toast('Back beneath the lantern', 'The encounter has reset. Your discoveries are kept.'); save(); } return; }
    if (name === 'puzzle-note') {
      if (Number(value) === puzzle.progress.length) { puzzle.progress.push(Number(value)); sound.sfx('relay'); puzzle.message = puzzle.progress.length === 3 ? 'The relay wakes.' : 'The note holds. Listen for the next.'; }
      else { puzzle.progress = []; puzzle.message = 'The light fades. Begin again: leaf, sun, star.'; sound.sfx('menu'); }
      if (puzzle.progress.length === 3) { const o = puzzle.object; closeMenu(); activateRelay(o); } else ui.open('puzzle', puzzle);
      return;
    }
  }
  function updateCamera() {
    if (!battle?.group.boss) return;
    const boss = enemies.find(e => isBoss(e) && !e.dead);
    if (!boss) return;
    // Fit the actual fighters inside a clear area between the upper and lower HUD.
    // Work in the unzoomed projection so changing zoom cannot feed back into the fit.
    const view = game.baseView, s = view.scale;
    const points = party.filter(p => p.hp > 0).map(p => ({ body: p, left: 17, right: 17, top: 45, bottom: 9 }));
    points.push(boss.type === 'loom' ? { body: boss, left: 70, right: 70, top: 120, bottom: 15 } : { body: boss, left: 62, right: 62, top: 73, bottom: 35 });
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const item of points) {
      const [x, y] = view.p(item.body.x, item.body.y, 0);
      left = Math.min(left, x - item.left * s); right = Math.max(right, x + item.right * s);
      top = Math.min(top, y - item.top * s); bottom = Math.max(bottom, y + item.bottom * s);
    }
    const topSpace = game.H * .27, bottomSpace = game.H * .18;
    const fit = Math.min(state.options.zoom, game.W * .82 / (right - left + 24), (game.H - topSpace - bottomSpace) / (bottom - top + 16));
    const zoom = Math.max(boss.type === 'loom' ? .375 : .5, Math.floor(fit * 16) / 16);
    if (game.zoom !== zoom) game.setZoom(zoom);
    const center = view.toGround((left + right) / 2, (top + bottom) / 2);
    game.cam.offset = [0, (topSpace - bottomSpace) / 2];
    game.focus(center[0], center[1], 0);
  }
  function update(dt) {
    clock += dt; controls.update(dt); timeSinceInput += dt;
    if (controls.pressed('fullscreen')) controls.toggleFullscreen();
    if (controls.pressed('menu')) {
      if (ui.isOpen && !['ending', 'defeat'].includes(ui.kind)) closeMenu();
      else if (!dialogue && mode === 'play') openMenu('journal');
      else if (mode === 'title') openMenu('settings');
    }
    if (zoneTimer > 0) { zoneTimer -= dt; if (zoneTimer <= 0) $('zone-title').hidden = true; }
    for (const fx of fxRings) fx.t += dt;
    E.prune(fxRings, fx => fx.t > fx.life);
    for (const e of echoes) e.t -= dt;
    E.prune(echoes, e => e.t <= 0);
    if (mode === 'title') {
      game.focus(630 + Math.sin(clock * .045) * 24, 415 + Math.cos(clock * .065) * 14, 10);
      party.forEach(p => p.rig.update(dt, { x: p.x, y: p.y, z: 0, facing: -.8, vx: 0, vy: 0 }));
      menuNavigation(); return;
    }
    updateCamera();
    if (ui.isOpen || mode === 'defeat') { menuNavigation(); return; }
    if (dialogue) {
      if (!dialogue.done) { dialogue.shown += dt * 48; $('dialogue-text').textContent = dialogue.full.slice(0, Math.floor(dialogue.shown)); if (dialogue.shown >= dialogue.full.length) revealDialogue(); }
      menuNavigation(); party.forEach(p => p.rig.update(dt, { x: p.x, y: p.y, z: 0, facing: p.facing, vx: 0, vy: 0, pose: p.hp <= 0 ? 'down' : undefined })); return;
    }
    if (transition || mode !== 'play') return;
    if (!R.isComplete(state)) state.stats.seconds += dt;
    context = findContext(); processPlayInput();
    if (ui.isOpen || dialogue || transition) return;
    updateParty(dt); updateEnemies(dt); updateHazards(dt);
    shots.update(dt, map); shots.hit(currentEnemies(), (b, e) => damageEnemy(e, b.dmg, b.data.source, b.data.art), 'player'); shots.hit(party.filter(p => !p.dead), (b, p) => damageHero(p, b.dmg, b.data.source), 'enemy');
    if (battle) { battle.time += dt; if (!currentEnemies().length) victory(); }
    else if (!R.isComplete(state) || state.flags.chapterTwoStarted) {
      const p = party[state.leader], g = zone.groups.find(g => !g.manual && !state.flags.cleared.includes(g.id) && Math.hypot(g.x - p.x, g.y - p.y) < 82);
      if (g) startBattle(g);
    }
    discoveryClock += dt; if (zone.id === 'overworld' && discoveryClock > .35) { discoveryClock = 0; discoverWorld(); }
    autoSaveClock += dt; if (autoSaveClock > 15 && !battle) { autoSaveClock = 0; save(true); }
    hudClock += dt; if (hudClock > .08) { hudClock = 0; updateHud(); }
  }

  /* Pixel presentation. All world art is original and uses the engine renderer. */
  function drawEnemy(r, e) {
    if (e.dead && !e.deathTime) return;
    if (isBoss(e)) { if (!e.dead) { if (e.type === 'loom') Art.drawTempestLoom(r, e, clock); else Art.drawWarden(r, e, clock); } return; }
    if (!r.visible(e.x, e.y, 20, 60, 75, 80)) return;
    const active = battle && e.groupId === battle.group.id;
    const px = E.px, s = r.view.scale, t = e.t;
    r.shadow(e.x, e.y, e.r * .8, .26);
    r.queue(e.x, e.y, 0, g => {
      const [x, y] = r.w(e.x, e.y, 0), bob = Math.sin(t * 5) * 1.3 * s, C = e.hurt > 0 ? '#fff0c6' : e.color;
      const dark = '#244247', mid = E.shade(C, -.2), light = E.shade(C, .18);
      const oldAlpha = g.globalAlpha; if (e.dead) g.globalAlpha = e.deathTime / .6;
      if (e.type === 'reedling') {
        for (let i = -1; i <= 1; i++) { const a = Math.sin(t * 8 + i) * 2; px.line(g, x + i * 5 * s, y - 5 * s, x + (i * 8 + a) * s, y + 1 * s, dark, Math.max(2, s * 2)); }
        px.ell(g, x, y - 10 * s + bob, 11 * s, 9 * s, dark); px.ell(g, x, y - 11 * s + bob, 10 * s, 8 * s, mid); px.ell(g, x - 2 * s, y - 13 * s + bob, 7 * s, 5 * s, C);
        for (let i = 0; i < 5; i++) { const xx = x + (i - 2) * 3.6 * s, yy = y - (20 + (i % 2) * 6) * s; px.poly(g, [[xx - 3 * s, y - 13 * s + bob], [xx + Math.sin(t * 1.8 + i) * 2 * s, yy + bob], [xx + 3 * s, y - 14 * s + bob]], i % 2 ? '#d4c68b' : '#69945e'); }
        px.rect(g, x - 6 * s, y - 10 * s + bob, 4 * s, 3 * s, '#192e35'); px.rect(g, x + 2 * s, y - 10 * s + bob, 4 * s, 3 * s, '#192e35'); px.dot(g, x - 4 * s, y - 9 * s + bob, '#f8daa0'); px.dot(g, x + 4 * s, y - 9 * s + bob, '#f8daa0');
      } else if (e.type === 'gustling') {
        const flap=Math.sin(t*11)*5*s;
        for(const side of [-1,1]){
          px.poly(g,[[x+side*3*s,y-13*s+bob],[x+side*23*s,y-(18*s+flap)],[x+side*16*s,y-6*s+bob],[x+side*7*s,y-8*s+bob]],dark);
          px.poly(g,[[x+side*5*s,y-13*s+bob],[x+side*21*s,y-(18*s+flap)],[x+side*12*s,y-10*s+bob]],C);
          px.line(g,x+side*7*s,y-12*s+bob,x+side*16*s,y-(15*s+flap),'#dbefc6',s);
        }
        px.ell(g,x,y-14*s+bob,7*s,10*s,mid);px.ell(g,x-2*s,y-16*s+bob,5*s,7*s,C);
        px.poly(g,[[x-3*s,y-22*s+bob],[x,y-30*s+bob],[x+3*s,y-22*s+bob]],'#e2d4a0');
        px.rect(g,x-4*s,y-16*s+bob,2*s,3*s,'#f8e6a6');px.rect(g,x+2*s,y-16*s+bob,2*s,3*s,'#f8e6a6');
      } else if (e.type === 'coilkeeper') {
        px.ell(g,x,y-3*s,13*s,5*s,dark);
        px.poly(g,[[x-10*s,y-6*s],[x-8*s,y-26*s+bob],[x,y-34*s+bob],[x+8*s,y-26*s+bob],[x+10*s,y-6*s]],dark);
        px.poly(g,[[x-7*s,y-7*s],[x-6*s,y-24*s+bob],[x,y-31*s+bob],[x+6*s,y-24*s+bob],[x+7*s,y-7*s]],C);
        for(let i=0;i<3;i++){const yy=y-(10+i*6)*s+bob;px.ell(g,x,yy,(10-i)*s,3*s,'#d7bf85');px.ell(g,x,yy-1*s,(8-i)*s,2*s,mid);}
        px.disc(g,x,y-25*s+bob,4*s,'#193c4b');px.disc(g,x,y-25*s+bob,2*s,'#befae5');
        for(const side of [-1,1])px.line(g,x+side*9*s,y-14*s+bob,x+side*(15+Math.sin(t*3))*s,y-20*s+bob,'#a1ddcd',2*s);
      } else if (e.type === 'spitter') {
        px.ell(g, x, y - 5 * s, 10 * s, 5 * s, dark); px.ell(g, x, y - 9 * s + bob, 8 * s, 9 * s, mid); px.ell(g, x - 1 * s, y - 12 * s + bob, 6 * s, 7 * s, C);
        for (let i = 0; i < 5; i++) { const a = i * 1.26 + t * .12, xx = x + Math.cos(a) * 9 * s, yy = y - 15 * s + Math.sin(a) * 3 * s + bob; px.poly(g, [[xx, yy - 8 * s], [xx + 4 * s, yy], [xx, yy + 3 * s], [xx - 4 * s, yy]], i % 2 ? '#c7b5e8' : '#7a79a8'); }
        px.ell(g, x, y - 8 * s + bob, 4 * s, 3 * s, '#283649'); px.rect(g, x - 3 * s, y - 14 * s + bob, 2 * s, 2 * s, '#fff1bb'); px.rect(g, x + 3 * s, y - 14 * s + bob, 2 * s, 2 * s, '#fff1bb');
      } else if (e.type === 'mite') {
        for (let side of [-1, 1]) for (let i = 0; i < 3; i++) { const yy = y - (4 + i * 4) * s; px.line(g, x + side * 7 * s, yy, x + side * 15 * s, yy + (3 + Math.sin(t * 9 + i)) * s, '#3a4948', Math.max(2, s * 2)); px.line(g, x + side * 7 * s, yy - s, x + side * 13 * s, yy + Math.sin(t * 9 + i) * s, '#d4b27e', Math.max(1, s)); }
        px.ell(g, x, y - 10 * s + bob, 11 * s, 9 * s, dark); px.ell(g, x, y - 12 * s + bob, 10 * s, 8 * s, mid); px.ell(g, x - 2 * s, y - 14 * s + bob, 7 * s, 5 * s, light); px.line(g, x, y - 20 * s + bob, x, y - 6 * s + bob, '#846847', s); px.rect(g, x - 4 * s, y - 5 * s, 3 * s, 2 * s, '#9ef2cf'); px.rect(g, x + 3 * s, y - 5 * s, 3 * s, 2 * s, '#9ef2cf');
      } else {
        px.poly(g, [[x, y - 37 * s + bob], [x + 11 * s, y - 23 * s + bob], [x + 7 * s, y - 7 * s + bob], [x, y - 2 * s + bob], [x - 9 * s, y - 15 * s + bob], [x - 10 * s, y - 24 * s + bob]], dark);
        px.poly(g, [[x, y - 35 * s + bob], [x + 9 * s, y - 23 * s + bob], [x, y - 5 * s + bob], [x - 8 * s, y - 23 * s + bob]], C); px.poly(g, [[x, y - 33 * s + bob], [x + 6 * s, y - 23 * s + bob], [x, y - 20 * s + bob]], '#c5e8cc');
        px.line(g, x - 13 * s, y - 16 * s + bob, x + 13 * s, y - 16 * s + bob, '#c5ac76', 3 * s); px.ell(g, x, y - 17 * s + bob, 4 * s, 4 * s, '#153844'); px.disc(g, x, y - 17 * s + bob, 2 * s, '#f9e2a1');
      }
      if (e.stun > 0) { const xx = x + Math.sin(t * 5) * 8 * s; px.line(g, xx - 2, y - 32 * s, xx + 2, y - 32 * s, '#e7cbff', 1); px.line(g, xx, y - 32 * s - 2, xx, y - 32 * s + 2, '#e7cbff', 1); }
      g.globalAlpha = oldAlpha;
    });
    if (active && !e.dead) r.overlay(g => { const [x, y] = r.w(e.x, e.y, e.type === 'sentinel' ? 46 : 34); E.px.rect(g, x - 15, y, 30, 3, '#132a34'); E.px.rect(g, x - 14, y + 1, Math.round(28 * e.hp / e.maxHp), 1, e.stun > 0 ? '#bcaae9' : '#d7b88b'); });
  }
  function drawMarker(r, o, label, color = '#e3c484') {
    if (mode === 'title') return;
    const [x, y] = r.w(o.x, o.y, o.type === 'npc' ? 42 : o.type === 'relay' ? 42 : 27);
    if (x < -20 || x > r.W + 20 || y < -40 || y > r.H + 40) return;
    r.overlay(g => { const bob = Math.sin(clock * 2.5 + o.x) * 1.5; E.font.text(g, label, x, y + bob, color, { align: 'center', outline: '#163440' }); });
  }
  function drawObjects(r) {
    for (const o of zone.objects) {
      const collected = state.flags.collected.includes(o.id), relayed = state.flags.relays.includes(o.id) || state.flags.windBeacons.includes(o.id);
      if (o.type === 'relay' || o.type === 'survey') { Art.drawRelay(r, o.x, o.y, relayed, clock); if (!relayed && !battle) drawMarker(r, o, '◇'); }
      else if (o.type === 'chest') { Art.drawChest(r, o.x, o.y, collected, clock); if (!collected && !battle) drawMarker(r, o, '+', '#f1d89e'); }
      else if (o.type === 'gather' && !collected) {
        r.queue(o.x, o.y, 0, g => { const [x, y] = r.w(o.x, o.y, 0), s = r.view.scale; if (o.material === 'herb') { for (let i = -1; i <= 1; i++) { E.px.line(g, x, y, x + i * 5 * s, y - (10 - Math.abs(i) * 3) * s, '#a5c16e', 2 * s); E.px.disc(g, x + i * 5 * s, y - (10 - Math.abs(i) * 3) * s, 2 * s, '#ecd59a'); } } else { E.px.poly(g, [[x - 7 * s, y], [x - 3 * s, y - 10 * s], [x + 5 * s, y - 7 * s], [x + 8 * s, y]], '#be9d78'); E.px.line(g, x - 3 * s, y - 9 * s, x + 2 * s, y - 5 * s, '#f1d5a3', 2 * s); } });
        if (Math.sin(clock * 3 + o.x) > .75) drawMarker(r, o, '+', '#e9db97');
      } else if (o.type === 'camp') {
        r.groundRing(o.x, o.y, 17, '#d6cf9a', .45); r.queue(o.x, o.y, 0, g => { const [x, y] = r.w(o.x, o.y, 0), s = r.view.scale; E.px.rect(g, x - 5 * s, y - 3 * s, 10 * s, 4 * s, '#4c5c50'); E.px.line(g, x, y - 4 * s, x, y - 16 * s, '#b29c6d', 2 * s); E.px.rect(g, x - 4 * s, y - 23 * s, 8 * s, 9 * s, '#b59e67'); E.px.rect(g, x - 2 * s, y - 21 * s, 4 * s, 6 * s, '#f3d690'); });
        if (!battle) drawMarker(r, o, 'REST', '#e3d8ac');
      } else if (o.type === 'npc') {
        if (!o.rig) o.rig = new E.Humanoid(o.id === 'mara' ? { build:'chibi', size:1.15, hair:'short', weapon:null, outfit:'coat', sleeves:'long', cape:'#6b9875', colors:{skin:'#c59170',hair:'#303d48',cloth:'#a88658',coat:'#6d8c70',pants:'#3b4c52',boot:'#4b4744'} } : { build: 'chibi', size: 1.16, hair: 'bun', weapon: null, outfit: 'robe', sleeves: 'long', colors: { skin: '#bc8f77', hair: '#cac2a1', cloth: '#665f7b', pants: '#474754', boot: '#36434b' } });
        o.rig.update(.016, { x: o.x, y: o.y, facing: 1.6, pose: Math.sin(clock * .4) > .65 ? 'hips' : undefined }); r.shadow(o.x, o.y, 7, .22); r.actor(o.x, o.y, 0, (g, x, y) => o.rig.draw(g, x, y, r.view), { xray: true });
        if (!battle) drawMarker(r, o, (o.id === 'mara' ? state.flags.maraMet : state.flags.quest) ? '...' : '!', '#f6d98b');
      } else if (o.type === 'bond' && !battle) { const done = o.hero === 'sera' ? state.flags.seraBond : state.flags.orrenBond; if (!done) drawMarker(r, o, 'TALK', '#c1b6e4'); }
      else if (o.type === 'workshop' && !battle) drawMarker(r, o, 'MAKE', '#dbcca7');
      else if (o.type === 'lore' && !state.flags.read.includes(o.id) && !battle) drawMarker(r, o, '?', '#afd4c7');
      else if (o.type === 'heart' && bossDone(o.bossId)) { Art.drawRelay(r, o.x, o.y, true, clock); drawMarker(r, o, (o.bossId === 'loom' ? state.flags.chapterTwoComplete : state.flags.complete) ? 'RESTORED' : 'RESTORE', '#c8f2dc'); }
      else if (o.type === 'boss' && !bossDone(o.bossId) && !battle) drawMarker(r, o, 'AWAKEN', '#e2bd8b');
    }
    for (const ex of zone.exits) { if (!availableObject(ex)) continue; if (ex.requiresBeacons) Art.drawGate(r, ex.x, ex.y, state.flags.maraMet && state.flags.windBeacons.length === 2, clock); if (ex.requiresRelays) Art.drawGate(r, ex.x, ex.y, state.flags.relays.length === 3, clock); if (!battle) { const [x,y] = r.w(ex.x,ex.y,2); r.decal(g => { const s=r.view.scale; E.px.line(g,x-9*s,y+5*s,x,y-2*s,'#cfd5ad',1); E.px.line(g,x,y-2*s,x+9*s,y+5*s,'#cfd5ad',1); }); } }
  }
  function drawTelegraphs(r) {
    for (const e of currentEnemies()) {
      if (!e.attack) continue; const a = e.attack, u = a.t / a.duration;
      if (a.kind === 'bite') { r.groundArc(e.x, e.y, 3, e.range + 9, a.angle - 1.1, a.angle + 1.1, '#d19367', .24 + u * .22); r.groundArc(e.x, e.y, (e.range + 9) * u, (e.range + 9) * u + 1.5, a.angle - 1.1, a.angle + 1.1, '#ffdb9a', .9); }
      else if (a.kind === 'pulse') { r.groundRing(e.x, e.y, 28 + u * 120, '#efb181', .65); r.groundRing(e.x, e.y, 151, '#dda174', .2); }
      else { r.groundArc(e.x, e.y, 20, 90, a.angle - .035, a.angle + .035, '#e9b187', .35 + u * .4); }
    }
    for (const h of hazards) {
      if (h.kind === 'ring' && h.radius > 0) { r.groundRing(h.x, h.y, h.radius, '#fff1bb', .95); r.groundRing(h.x, h.y, h.radius + 2, '#e5ac85', .9); r.groundRing(h.x, h.y, h.radius - 2, '#da936e', .55); }
      if (h.kind === 'mark') { const u = Math.min(1, h.t / h.wind); r.groundDisc(h.x, h.y, h.r, h.done ? '#ffdda2' : '#bd795e', h.done ? .65 : .27); r.groundRing(h.x, h.y, h.r, '#f4c794', .9); r.groundRing(h.x, h.y, h.r * (1 - u), '#ffe9a4', .9); }
      if (h.kind === 'lane') {
        const dx=h.x2-h.x1,dy=h.y2-h.y1,len=Math.hypot(dx,dy),nx=-dy/len*h.halfWidth,ny=dx/len*h.halfWidth;
        const points=[[h.x1+nx,h.y1+ny],[h.x2+nx,h.y2+ny],[h.x2-nx,h.y2-ny],[h.x1-nx,h.y1-ny]].map(p=>r.w(p[0],p[1],0));
        r.decal(g=>{const a=g.globalAlpha;g.globalAlpha=h.done?.85:.24+.25*Math.min(1,h.t/h.wind);E.px.poly(g,points,h.done?'#ddfff1':'#ecbf86');g.globalAlpha=.9;E.px.line(g,...points[0],...points[1],'#ffe4ab',1);E.px.line(g,...points[3],...points[2],'#ffe4ab',1);g.globalAlpha=a;});
      }
      if (h.kind === 'beam') { const w = h.done ? .065 : .045; r.groundArc(h.x, h.y, 0, 330, h.angle - w, h.angle + w, h.done ? '#ffe8b3' : '#d49d79', h.done ? .9 : .38); }
    }
  }
  function draw(r) {
    Art.drawFloor(r, zone, clock, state.flags);
    drawTelegraphs(r);
    if (battle?.group.boss) r.groundRing(battle.group.x, battle.group.y, 190, '#d2b581', .35);
    if (context) r.groundRing(context.x, context.y, 16 + Math.sin(clock * 3), '#f2dca3', .55);
    if (leaderTarget && battle && !leaderTarget.dead) { r.groundRing(leaderTarget.x, leaderTarget.y, leaderTarget.r + 6, '#d9d9a0', .7); }
    for (const fx of fxRings) {
      const u = fx.t / fx.life;
      if (fx.arc) r.groundArc(fx.x, fx.y, fx.max * (.4 + u * .45), fx.max * (.54 + u * .46), fx.angle - 1.45 + u, fx.angle + 1.1 + u, fx.color, 1 - u);
      else { r.groundRing(fx.x, fx.y, 5 + fx.max * u, fx.color, (1 - u) * .8); r.groundRing(fx.x, fx.y, 4 + fx.max * u, fx.color, (1 - u) * .45); }
    }
    for (const e of echoes) r.groundDisc(e.x, e.y, 6, e.color, e.t * 1.4);
    Art.queueProps(r, zone, clock, state.flags); drawObjects(r);
    for (const e of enemies) drawEnemy(r, e);
    for (const p of party) {
      r.shadow(p.x, p.y, 7, .3);
      if (p.index === state.leader && mode !== 'title') { r.groundRing(p.x, p.y, 9, p.def.color, .8); r.groundArc(p.x, p.y, 11, 13, p.facing - .35, p.facing + .35, '#cde9c8', .72); }
      r.actor(p.x, p.y, p.z, (g, x, y) => p.rig.draw(g, x, y, r.view), { xray: { color: p.def.color, outline: '#e2f3ca' }, flash: p.hurt > 0 }); p.rig.drawSmear(r);
    }
    shots.draw(r);
    for (const m of motes) {
      const x = m.x + Math.sin(clock * .12 + m.phase) * 30, y = m.y + Math.sin(clock * .1 + m.phase) * 15;
      if (!r.visible(x, y, m.z, 3, 4, 3)) continue;
      r.queue(x, y, m.z, g => { const [sx, sy] = r.w(x, y, m.z + Math.sin(clock + m.phase) * 4); E.px.dot(g, sx, sy, Math.sin(clock * .7 + m.phase) > .4 ? '#dedcab' : '#94bd9c'); });
    }
    if (zone.id !== 'observatory') r.overlay(g => {
      // Slow, broad bands of light, not a per-pixel blur. They retain the pixel grid.
      const a = g.globalAlpha; g.globalAlpha = .035;
      for (let i=0;i<3;i++){const x=((i*173-clock*2)% (r.W+160))-80;E.px.poly(g,[[x,-5],[x+40,-5],[x+150,r.H+4],[x+115,r.H+4]],'#f4ddb0');}
      g.globalAlpha=a;
    });
  }
  function renderPartyHud() {
    $('party-hud').innerHTML = D.heroes.map((h, i) => '<button class="party-card '+(i===state.leader?'active':'')+'" style="--hero:'+h.color+'" data-leader="'+i+'" aria-label="Control '+h.name+'"><span class="leader-tag '+(i===state.leader?'show':'')+'">LEADER</span><span class="portrait-box"><canvas id="portrait-'+i+'" width="48" height="48"></canvas></span><span class="party-details"><span class="name">'+h.name+'<span class="level">LV '+state.level+'</span></span><span class="hp-text"><span id="hp-'+i+'"></span><span>HP</span></span><span class="hp-track"><i id="hp-fill-'+i+'"></i></span><span class="mp-track"><i id="mp-fill-'+i+'"></i></span></span></button>').join('');
    D.heroes.forEach((h,i)=>Art.portrait($('portrait-'+i),h.id));
  }
  function updateDeviceLabels() {
    const pad=controls.device==='gamepad',touch=controls.touch;
    const binds={attack:pad?'×':'J',art:pad?'□':'K',dodge:pad?'○':'L',heal:pad?'R1':'H',link:pad?'△':'R'};
    document.querySelectorAll('[data-action]').forEach(b=>{const k=b.querySelector('kbd');if(k&&binds[b.dataset.action])k.textContent=binds[b.dataset.action];});
    const key=$('context-prompt').querySelector('.context-key');key.textContent=touch?'◎':pad?'×':'E';
    $('field-hint').innerHTML=pad?'<span>LEFT STICK</span> Move <i>·</i> <span>L1</span> Change leader <i>·</i> <span>OPTIONS</span> Journal':'<span>W A S D</span> Move <i>·</i> <span>Q</span> Change leader <i>·</i> <span>Tab</span> Journal';
  }
  function updateHud() {
    $('chapter-label').textContent=state.flags.chapterTwoStarted?'A SKY WORTH SHARING':'THE TIDE THAT REMEMBERS';$('location-name').textContent=zone.name;$('objective-text').textContent=R.objective(state);
    party.forEach((p,i)=>{const hp=$('hp-'+i);if(!hp)return;hp.textContent=Math.ceil(p.hp)+' / '+R.maxHp(state,i);$('hp-fill-'+i).style.width=(100*p.hp/R.maxHp(state,i))+'%';$('mp-fill-'+i).style.width=(100*p.mp/R.maxMp(state,i))+'%';hp.closest('.party-card').classList.toggle('dead',p.hp<=0);});
    const p=party[state.leader];if(p){$('art-name').textContent=p.index===0&&leaderTarget&&E.dist(p,leaderTarget)>65?p.def.artLong:p.def.art;$('art-cooldown').style.height=(p.artCd/(p.index===1?7:p.index===0?4.3:5.5)*100)+'%';document.querySelector('.art-action').setAttribute('title',p.def.art+' · '+p.def.cost+' energy · '+Math.floor(p.mp)+' remaining');document.querySelector('.art-action').setAttribute('aria-label','Use '+p.def.art+'. Cost '+p.def.cost+' energy. '+Math.floor(p.mp)+' energy available.');}
    $('tonic-count').textContent=state.inventory.tonic+(controls.touch?'':' tonics');
    $('link-value').textContent=Math.floor(state.link)+'%';$('link-fill').style.width=state.link+'%';$('link-button').classList.toggle('ready',state.link>=100);
    $('action-hud').classList.toggle('outside-battle',!battle);document.querySelector('.link-hud').classList.toggle('outside-battle',!battle);
    $('context-prompt').hidden=!context||!!dialogue||ui?.isOpen||!!battle;$('context-label').textContent=context?.label||'';
    $('battle-banner').hidden=!battle||battle.group.boss;$('battle-name').textContent=battle?.group.tutorial?'First contact':'Party engaged';
    const boss=currentEnemies().find(isBoss);$('boss-hud').hidden=!boss;
    if(boss){$('boss-fill').style.width=100*boss.hp/boss.maxHp+'%';$('boss-name').textContent=boss.type==='loom'?'THE TEMPEST LOOM':'THE GLASS WARDEN';$('boss-phase').textContent=boss.type==='loom'?(boss.phase===2?'PHASE II · EYE OF THE STORM':'WEATHER CUSTODIAN'):(boss.phase===2?'PHASE II · HIGH TIDE':'ANCIENT CUSTODIAN');$('boss-state').textContent=boss.exposed>0?'CORE EXPOSED · '+Math.ceil(boss.exposed)+'s':boss.guardLock>0?'GUARD STABILISING · '+Math.ceil(boss.guardLock)+'s':'GUARD BREAK · '+Math.floor(boss.break)+' / 100';}
  }
  ui = new WayfarerUI({getState:()=>mode==='title'&&loaded&&ui?.kind==='new-confirm'?loaded:state,getParty:()=>party,getZone:()=>zone,getMode:()=>mode,isBattle:()=>!!battle,onCommand:uiCommand});
  document.addEventListener('click',e=>{
    const leader=e.target.closest('[data-leader]');if(leader&&mode==='play'&&!dialogue&&!ui.isOpen){switchLeader(Number(leader.dataset.leader));return;}
    const b=e.target.closest('[data-ui]');if(!b)return;const action=b.dataset.ui;sound.unlock();
    if(action==='begin'){if(loaded)openMenu('new-confirm');else startJourney(false);}
    else if(action==='continue')startJourney(true);
    else if(action==='next-dialogue')nextDialogue();
    else if(action==='pause')openMenu('journal');
    else if(['map','guide','settings','credits'].includes(action))openMenu(action);
    else if(action==='fullscreen')controls.toggleFullscreen();
    else if(action==='sound'){state.options.music=!state.options.music;applyOptions();persistOptions();save(true);}
  });
  document.addEventListener('keydown',e=>{if(['Enter','Space','KeyE','KeyJ','KeyK'].includes(e.code))sound.unlock();});
  window.addEventListener('blur',()=>{if(mode==='play'&&!ui.isOpen&&!dialogue&&!transition)openMenu('journal');save(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){save(true);if(mode==='play'&&!ui.isOpen&&!dialogue)openMenu('journal');}});
  window.addEventListener('pagehide',()=>save(true));
  window.addEventListener('error',e=>{if(e.message&&e.error){$('fatal-error').hidden=false;$('fatal-message').textContent=e.message;}});
  if(loaded)state.options={...loaded.options};applyOptions();makeParty();useZone('quay',702,454,false);game.setZoom(.75);game.follow(null);game.focus(630,415,10);updateContinue();updateDeviceLabels();sound.setMode('title');
  game.start({update,draw});
  // Read-only diagnostics are available for release checks. Test actions require ?qa=1.
  window.Wayfarer={version:'2.0.0',engine:game,get state(){return state;},get party(){return party;},get enemies(){return enemies;},get battle(){return battle;},get zone(){return zone;},get mode(){return mode;},get context(){return context;},get dialogue(){return dialogue;},get hazards(){return hazards;},controls,ui};
  if(new URLSearchParams(location.search).get('qa')==='1')window.Wayfarer.qa={startJourney,useZone,interact,activateRelay,startBattle,damageEnemy,damageHero,useArt,useLink,useTonic,evade,switchLeader,nextDialogue,update,draw,save,retry,uiCommand,endJourney,makeMap,ensureWorld,beginChapterTwo,talkMara,surveyBeacon,endChapterTwo,fastTravel,discoverWorld};
})();
