/* SOURCE: src/adapters/my-3d2dge/assets.js */
/* Registry-bound local media and procedural pose assets. No engine internals. */
(function (root) {
  'use strict';
  const poses = ['cheer', 'cast', 'guard', 'kneel', 'crouch', 'wave', 'hips', 'block', 'die', 'down'];
  function create(game, registry, options = {}) {
    const AudioClass = options.Audio || root.Audio;
    const document = options.document || root.document;
    const eventTarget = options.events || root;
    const channels = new Set();
    const failures = [];
    let musicChannel = null, musicRef = null;
    const report = (id, error) => {
      const message = `${id}: ${error?.message || 'Audio could not be decoded.'}`;
      if (!failures.includes(message)) failures.push(message);
      options.onError?.(message);
    };
    function settingsFor(channel) {
      const muted = game.settings.sound === false || game.audio.muted || (document?.hidden && !game.settings.background);
      channel.element.muted = !!muted;
      channel.element.volume = Math.max(0, Math.min(1, (game.audio.volume ?? .7) * (channel.kind === 'music' ? game.audio.musicVolume ?? .5 : game.audio.sfxVolume ?? 1) * (channel.volume ?? 1) * (channel.kind === 'music' && (game.paused || game.audio.ducked) ? .35 : 1)));
    }
    function attempt(channel) {
      if (!channels.has(channel)) return;
      settingsFor(channel);
      try {
        const result = channel.element.play();
        if (result?.then) result.then(() => { channel.waiting = false; }).catch(error => {
          if (error?.name === 'NotAllowedError') channel.waiting = true;
          else { report(channel.id, error); stop(channel); }
        });
      } catch (error) { report(channel.id, error); stop(channel); }
    }
    function stop(channel) {
      if (!channel) return;
      channel.element.pause(); channels.delete(channel);
      if (channel === musicChannel) musicChannel = null;
    }
    function local(record, kind) {
      if (!AudioClass) { report(record.id, new Error('HTML audio is unavailable.')); return null; }
      if (!/^assets\/[\w./ -]+\.(wav|ogg|mp3)$/i.test(record.src || '') || record.src.includes('..')) {
        report(record.id, new Error('Use a validated local assets/ WAV, OGG or MP3 path.')); return null;
      }
      if (channels.size >= 12) stop([...channels].find(c => c.kind !== 'music') || [...channels][0]);
      const element = new AudioClass(record.src);
      element.preload = 'auto'; element.loop = kind === 'music' && record.loop !== false;
      const channel = { id: record.id, kind, element, volume: record.volume ?? 1, waiting: false, suspended: false };
      channels.add(channel);
      element.addEventListener('ended', () => { if (!element.loop) stop(channel); }, { once: true });
      element.addEventListener('error', () => { report(record.id, element.error); stop(channel); }, { once: true });
      attempt(channel); return channel;
    }
    function sfx(ref) {
      const record = typeof ref === 'string' ? registry.get('assets', ref) : null;
      if (record?.src) return local(record, 'sfx');
      game.audio.sfx(record?.voice || record?.preset || ref || 'powerup');
      return null;
    }
    function music(ref) {
      if (musicRef === ref && (musicChannel || game.audio.song)) return;
      musicRef = ref; stop(musicChannel);
      const record = typeof ref === 'string' ? registry.get('assets', ref) : null;
      if (record?.src) { game.audio.stopMusic(); musicChannel = local(record, 'music'); }
      else game.audio.music(record?.song || record?.preset || ref);
    }
    function animation(ref) {
      const record = typeof ref === 'string' ? registry.get('assets', ref) : ref;
      const pose = record?.pose || ref || 'cast';
      if (!poses.includes(pose)) throw new Error(`Unsupported ability pose ${String(pose)}. Use a supported procedural pose or registered animation adapter.`);
      return { pose, duration: Math.max(.05, Math.min(30, record?.duration || 1)) };
    }
    function sync() {
      for (const channel of channels) {
        settingsFor(channel);
        if (document?.hidden && !game.settings.background) {
          if (!channel.element.paused) { channel.element.pause(); channel.suspended = true; }
        } else if (channel.suspended) { channel.suspended = false; attempt(channel); }
      }
    }
    const resume = () => { for (const channel of channels) if (channel.waiting) attempt(channel); };
    eventTarget?.addEventListener?.('pointerdown', resume);
    eventTarget?.addEventListener?.('keydown', resume);
    document?.addEventListener?.('visibilitychange', sync);
    function dispose() {
      for (const channel of [...channels]) stop(channel);
      eventTarget?.removeEventListener?.('pointerdown', resume);
      eventTarget?.removeEventListener?.('keydown', resume);
      document?.removeEventListener?.('visibilitychange', sync);
    }
    return { sfx, music, animation, sync, dispose,
      snapshot: () => ({ channels: [...channels].map(c => ({ id: c.id, kind: c.kind, paused: c.element.paused, muted: c.element.muted, volume: c.element.volume, currentTime: c.element.currentTime, readyState: c.element.readyState, waiting: c.waiting })), failures: [...failures] }) };
  }
  root.HBAssets = { create, poses };
})(globalThis);

/* SOURCE: src/adapters/my-3d2dge/game.js */
/* Browser adapter: my-3D2dge owns display, bodies, navigation, input and audio.
 * The RPG runtime owns commands and persistent state. No story IDs belong here. */
(() => {
  'use strict';
  const E = My3D2dge, UI = HBUI;
  const query = new URLSearchParams(location.search);
  const preview = query.has('preview') || query.get('dev') === '1';
  const registry = HBContent.getRegistry();
  const settings = registry.settings;
  const presentation = settings.presentation || {};
  const playerConfig = settings.player || {};
  const saveKey = preview ? `hollow-bell:preview:${query.get('preview') || 'all'}:${query.get('scenario') || 'arrival'}` : 'hollow-bell:save:v2';
  const persistence = HBPersistence.create({ registry, storage: localStorage, key: saveKey, legacyKey: preview ? null : 'hollow-bell:save:v1' });
  let saveStatus = { ok: true, message: 'Your journey saves on this device.' };
  let model, world, map, path, hero, rig, npcs = [], enemies = [];
  let goal = null, near = null, selected = null, currentPanel = null;
  let castTime = 0, castPose = 'cast', suppressNotification = false, hurtTime = 0, uiTick = 0, saveTick = 0, footTick = 0;
  let playing = false, endShown = false, arrivalTip = false, mounting = false;
  let sword = new E.Attack('slash');
  let debugOverlay = '', debugSelected = null;
  const commandLog = [];
  let replayInitial = null;
  const bindings = { ...E.Input.DEFAULT,
    interact: ['KeyE', 'Pad0'], attack: ['KeyJ', 'Pad2'], magic: ['KeyQ', 'Pad3'],
    inventory: ['KeyI', 'Pad4'], journal: ['KeyL', 'Pad5'], map: ['KeyM', 'Pad8'],
    kit: ['KeyK'], cancel: (E.Input.DEFAULT.cancel || []).filter(k => k !== 'KeyK'), dash: ['ShiftLeft', 'ShiftRight', 'Pad7'], skill: [], jump: [] };
  const game = new E.Game({ canvas: 'screen', id: 'hollow-bell', res: [384, 256], expand: true,
    view: 'iso', views: ['iso'], input: bindings, bg: '#142424',
    menu: { controls: { interact: 'Speak / use', attack: 'Blade', magic: 'Spellbook', inventory: 'Satchel', journal: 'Journal', map: 'Region map', kit: 'Field kit', dash: 'Run', skill: false, jump: false },
      items: [['Save journey', () => save(true)], ['Field journal', () => { game.resume(); showJournal(); }], ['Field kit', () => { game.resume(); showPanel('kit'); }]],
      settings: [{ key: 'hints', label: 'Show interaction markers', value: true },
        { key: 'difficulty', label: 'Combat', options: ['Story', 'Standard'], value: 'Standard' },
        { key: 'lighting', label: 'Lighting', options: ['Soft', 'Dynamic'], value: 'Soft', help: 'Soft preserves the painted palette. Dynamic adds moving pools of light.' }], quit: 'title' } });
  const music = settings.music || { bpm: 66, steps: 2, tracks: [
    { wave: 'sine', vol: .11, notes: 'D4 - - . A4 - F4 - E4 - - . C4 - - . D4 - - . A4 - C5 - Bb4 - A4 - F4 - E4 -' },
    { wave: 'triangle', vol: .08, notes: 'D3 - - - - - - - C3 - - - - - - - Bb2 - - - - - - - A2 - - - - - - -' },
    { wave: 'sine', vol: .035, notes: '. . A5 . . . . . . . G5 . . . . . . . F5 . . . . . . . E5 . . . . .' }
  ] };
  const assets = HBAssets.create(game, registry, { onError: message => UI.toast(message, 'warning') });
  addEventListener('pagehide', () => assets.dispose(), { once: true });
  const runtime = () => model.runtime;
  const entity = id => id === 'player' ? { id, ...model.state.player, regionId: model.state.regionId } : model.state.entities[id];
  const definition = e => e && registry.get(e.kind === 'actor' ? 'actors' : 'prefabs', e.definition);
  const actorDef = id => registry.get('actors', model.state.entities[id]?.definition) || {};
  const maxHP = () => model ? runtime().stat('maxHp') : 100;
  const maxMana = () => model ? runtime().stat('maxMana') : 60;
  const actorHP = e => e?.hp ?? e?.state?.hp ?? actorDef(e?.id).stats?.hp ?? 100;
  const isParty = id => model.state.party.some(p => (typeof p === 'string' ? p : p.id) === id);
  const partyMode = id => model.state.party.find(p => p.id === id)?.mode || 'follow';
  const region = () => registry.get('regions', model.state.regionId);
  const modifiedStat = (key, id, base) => Math.max(0, runtime().modifiedStat(key, id, base));
  const actorName = id => id === 'player' ? 'Wayfarer' : actorDef(id).name || id;

  function flushPositions() {
    if (!model || !hero) return;
    runtime().syncPosition('player', hero.x, hero.y);
    for (const actor of [...npcs, ...enemies]) {
      runtime().syncPosition(actor.id, actor.body.x, actor.body.y);
    }
    const enemyStates = Object.values(model.state.entities).filter(e => ['hostile', 'enemy'].includes(actorDef(e.id).team)).map(e => ({ id: e.id, hp: e.hp }));
    runtime().sync({ enemies: enemyStates });
  }
  function readSave() {
    saveStatus = persistence.load();
    return saveStatus.ok ? saveStatus.state : null;
  }
  function save(notify = false) {
    if (!model || !playing) return;
    flushPositions();
    const result = persistence.save(model.state);
    saveStatus = { ...saveStatus, ...result };
    if (notify || !result.ok) UI.toast(result.message || (result.ok ? 'Journey saved on this device.' : 'Unable to save. Export a backup from the field kit.'), result.ok ? 'success' : 'warning');
    return result;
  }
  function changed(event = {}) {
    if (!model || mounting) return;
    for (const change of event.events || []) {
      const targets = change.kind === 'move' ? [change.target] : change.kind === 'recover' ? ['player'] : change.kind === 'sync' ? change.targets || [] : [];
      for (const id of targets) {
        const stored = entity(id), body = id === 'player' ? hero : [...npcs, ...enemies].find(a => a.id === id)?.body;
        if (stored && body) { body.x = stored.x; body.y = stored.y; body.z = stored.z || 0; body.vx = body.vy = 0; }
        if (id === 'player') { goal = null; game.cam.snap = true; }
      }
      if (change.kind === 'cast') {
        const clip = assets.animation(change.animation || 'cast');
        const caster = change.actor || 'player';
        if (caster === 'player') { castPose = clip.pose; castTime = clip.duration; }
        else { const actor = [...npcs, ...enemies].find(a => a.id === caster); if (actor) { actor.castPose = clip.pose; actor.casting = clip.duration; } }
        const p = entity(change.target || caster) || hero;
        game.particles.glints(p.x, p.y, 18, 14, '#b7edda'); assets.sfx(change.sfx || 'powerup');
      }
    }
    if (world && world.regionId !== model.state.regionId) {
      UI.close(); mountRegion(); currentPanel = null;
    } else if (world) {
      world.sync(model.state);
      reconcileActors();
    }
    if (event.message && !suppressNotification) UI.toast(event.message, event.kind);
    if (event.message && event.kind !== 'warning' && playing && !(event.events || []).some(e => e.kind === 'cast')) game.audio.sfx('coin');
    save(); refreshUI();
  }
  function bodyFor(e, def) {
    const b = new E.Body({ x: e.x, y: e.y, r: def.stats?.radius || 4 });
    b.facing = e.state?.facing ?? .8;
    return b;
  }
  function makeActor(e) {
    const def = actorDef(e.id), profile = def.attack || {};
    const appearance = def.appearance || { outfit: 'tunic', colors: { cloth: '#738e79' } };
    return { id: e.id, definition: e.definition, name: def.name || e.id,
      def, body: bodyFor(e, def), rig: new E.Humanoid(appearance), flow: new E.FlowField(map),
      attack: new E.Attack(profile.pose || 'overhead', { wind: profile.windup ?? .65, active: profile.active ?? .2, recover: profile.recover ?? .9 }),
      cooldown: Math.max(0, (e.state?.attackReadyAt ?? (model.state.time + 1)) - model.state.time), facing: e.state?.facing ?? .8, flash: 0, hit: false, assist: 0, casting: 0, stuck: 0, t: 0 };
  }
  function activeActorEntities() {
    return Object.values(model.state.entities).filter(e => e.kind === 'actor' && e.regionId === model.state.regionId && !e.state?.removed && !e.state?.hidden);
  }
  function reconcileActors() {
    if (!map) return;
    const old = new Map([...npcs, ...enemies].map(a => [a.id, a]));
    const next = activeActorEntities().map(e => old.get(e.id) || makeActor(e));
    npcs = next.filter(a => !['hostile', 'enemy'].includes(a.def.team) || isParty(a.id));
    enemies = next.filter(a => ['hostile', 'enemy'].includes(a.def.team) && !isParty(a.id));
  }
  function mountRegion() {
    mounting = true;
    world = HBWorld.create(E, registry, model.state);
    map = world.map; path = new E.FlowField(map);
    const spawn = model.state.player || world.spawn;
    hero = new E.Body({ x: spawn.x, y: spawn.y, r: 4.3 });
    hero.facing = -Math.PI / 2;
    if (!map.standable(hero.x, hero.y, 0, hero.r)) { hero.x = world.spawn.x; hero.y = world.spawn.y; }
    runtime().syncPosition('player', hero.x, hero.y);
    rig = new E.Humanoid(playerConfig.appearance || { size: 1.23, build: 'heroic', outfit: 'coat', weapon: 'sword', hair: 'ponytail', sleeves: 'long',
      cape: { len: 8, width: 5, seg: 2.5 }, colors: { skin: '#d3ae86', hair: '#362b27', cloth: '#4b7475', coat: '#3b666b', pants: '#393b3b', boot: '#332c27', belt: '#755338', trim: '#d8ba77', cape: '#b77f43', capeIn: '#604333', metal: '#d8d7c2' } });
    npcs = []; enemies = []; reconcileActors();
    runtime().setAdapter({
      canReach(a, b, range = 40, state = model.state) {
        const resolve = id => id === 'player' ? { ...state.player, regionId: state.regionId } : state.entities[id];
        a = typeof a === 'string' ? resolve(a) : a; b = typeof b === 'string' ? resolve(b) : b;
        return !!a && !!b && a.regionId === b.regionId && Math.hypot(a.x - b.x, a.y - b.y) <= range;
      },
      sight(a, b, state) {
        a = typeof a === 'string' ? (a === 'player' ? { ...state.player, regionId: state.regionId } : state.entities[a]) : a;
        b = typeof b === 'string' ? (b === 'player' ? { ...state.player, regionId: state.regionId } : state.entities[b]) : b;
        return !!a && !!b && a.regionId === b.regionId && world.lineOfSight(a, b);
      },
      canPlace(target, x, y, regionId, state) {
        if (regionId === model.state.regionId && target !== 'player') return world.canPlace(target, x, y, state);
        return HBWorld.canPlace ? HBWorld.canPlace(registry, state, target, x, y, regionId) : true;
      }
    });
    goal = near = selected = null; sword = new E.Attack(playerConfig.attack?.pose || 'slash');
    game.cam.snap = true; rig.update(0, { x: hero.x, y: hero.y, facing: hero.facing });
    UI.configure?.({ assets: registry, regionName: region()?.name || model.state.regionId, chapterName: presentation.chapterName || 'The Hollow Bell' });
    mounting = false;
    if (playing) assets.music(region()?.music || music);
  }
  function reset(saved) {
    model = HBContent.createModel(saved || HBContent.createState(), changed);
    if (preview && !saved) {
      const pack = registry.packs.find(p => p.id === query.get('preview'));
      if (pack?.preview?.region) {
        const r = registry.get('regions', pack.preview.region);
        if (r) { model.state.regionId = r.id; model.state.player = { ...(r.spawns?.[pack.preview.spawn] || r.spawn) }; }
      }
      if (globalThis.HBAuthoring?.scenario?.initialEffects) {
        mounting = true;
        const result = runtime().effects(globalThis.HBAuthoring.scenario.initialEffects);
        mounting = false;
        if (!result.ok) console.error('Preview scenario:', result.message);
      }
    }
    if (preview) {
      commandLog.length = 0; replayInitial = JSON.parse(JSON.stringify(model.state));
      const command = runtime().command;
      runtime().command = record => {
        const before = { time: model.state.time, player: { ...model.state.player }, actors: Object.values(model.state.entities).filter(e => e.kind === 'actor').map(e => ({ id: e.id, x: e.x, y: e.y, regionId: e.regionId })) };
        const result = command(record);
        commandLog.push({ ...before, command: JSON.parse(JSON.stringify(record)), ok: result.ok, message: result.message });
        if (commandLog.length > 2000) commandLog.shift();
        return result;
      };
    }
    castTime = hurtTime = 0; endShown = !!model.state.ending; arrivalTip = !!saved;
    mountRegion();
  }
  function begin(fresh = false) {
    if (fresh && playing) save();
    const restored = fresh ? null : readSave();
    if (!fresh && !saveStatus.ok && !restored) {
      UI.dialog({ title: 'Your saved journey needs attention', subtitle: 'SAVE RECOVERY', text: saveStatus.message,
        choices: [{ label: 'Open save recovery', panel: 'saves' }, { label: 'Return', action: 'close' }] });
      return;
    }
    reset(restored);
    playing = true; UI.hideTitle(); UI.close(); game.resume(); game.go('play');
    assets.music(region()?.music || music); refreshUI(); save();
    if (!arrivalTip) { UI.toast(presentation.welcome || 'Welcome. Speak with the people nearby and follow the clues.'); arrivalTip = true; }
  }
  function activeThings() {
    return [...world.objects, ...npcs.filter(n => actorHP(entity(n.id)) > 0).map(n => ({ ...entity(n.id), name: n.name, x: n.body.x, y: n.body.y, character: true, pick: n.def.pick, range: n.def.range || 32 }))];
  }
  function reachable(o) {
    const def = definition(entity(o.id)) || {};
    return Math.hypot(hero.x - o.x, hero.y - o.y) <= (o.range || def.range || 32) &&
      world.lineOfSight(hero, { ...entity(o.id), x: o.x, y: o.y, z: 0 });
  }
  function getNear() {
    return activeThings().filter(reachable).sort((a, b) => E.dist(hero, a) - E.dist(hero, b))[0] || null;
  }
  function standardChoices(id) {
    const e = entity(id), def = definition(e) || {}, choices = [];
    const verbs = Array.isArray(def.verbs) ? def.verbs : Object.keys(def.verbs || {});
    if (def.capacity || def.inventory) choices.push({ label: 'Open container · transfer items', panel: 'container', params: { id } });
    if (registry.all('recipes').some(r => r.station === e?.definition)) choices.push({ label: 'Craft at this station', panel: 'crafting', params: { station: id } });
    for (const vendor of registry.all('vendors').filter(v => v.entity === id)) choices.push({ label: 'Trade supplies', panel: 'trading', params: { vendor: vendor.id } });
    if (def.companion) choices.push({ label: isParty(id) ? 'Manage companion' : 'Companions · recruitment', panel: 'party' });
    for (const verb of verbs) {
      const spec = Array.isArray(def.verbs) ? {} : def.verbs[verb];
      const reason = spec?.conditions ? runtime().explain(spec.conditions, { actor: 'player', target: id }) : '';
      if (['take', 'give', 'drop'].includes(verb)) { choices.push({ label: spec?.label || 'Transfer supplies', panel: 'container', params: { id }, reason }); continue; }
      if (verb === 'use') { choices.push({ label: spec?.label || 'Use a carried item here', panel: 'use-target', params: { target: id }, reason }); continue; }
      if (['inspect', 'read'].includes(verb) && def.dialogue) continue;
      if (verb === 'move') {
        const step = def.move?.grid || 16;
        for (const [label, dx, dy] of [['north', 0, -step], ['east', step, 0], ['south', 0, step], ['west', -step, 0]]) {
          choices.push({ label: `Move ${label}`, command: { type: 'verb', target: id, verb, destination: { x: e.x + dx, y: e.y + dy } } });
        }
      } else choices.push({ label: spec?.label || verb[0].toUpperCase() + verb.slice(1), reason, command: { type: verb === 'travel' ? 'travel' : 'verb', target: id, verb } });
    }
    for (const exit of region()?.exits || []) if (exit.entity === id) choices.push({ label: exit.label || 'Travel onwards', command: { type: 'travel', target: exit.id } });
    return choices;
  }
  function interact(target = near) {
    if (!playing || game.paused || !target) { if (playing && !target) UI.toast('Move close to a person or object to interact.'); return; }
    flushPositions();
    if (!reachable(target)) { UI.toast('Move closer; a clear approach is needed.', 'warning'); return; }
    goal = null; selected = target.id; hero.vx = hero.vy = 0;
    const def = definition(entity(target.id)) || {};
    const dialogue = model.interact(target.id);
    const extra = standardChoices(target.id);
    if (dialogue) UI.dialog({ ...dialogue, choices: [...dialogue.choices.filter(c => c.action !== 'close'), ...extra, { label: 'Leave', action: 'close' }] });
    else UI.dialog({ title: def.name || target.name || target.id, subtitle: region()?.name || '', portrait: def.portrait || '', text: def.description || 'Choose an interaction.', choices: [...extra, { label: 'Leave', action: 'close' }] });
    refreshUI();
  }
  function choose(action) {
    if (action?.startsWith('spell:')) { cast(action.slice(6)); return; }
    if (action === 'game:revive') { revive(); return; }
    if (action?.startsWith('talk:')) {
      const destination = activeThings().find(o => o.id === action.slice(5));
      if (destination && !reachable(destination)) { UI.close(); walkTo(destination.x, destination.y, destination.id); return; }
    }
    flushPositions();
    const dialogue = model.choose(action, { actor: 'player', target: selected });
    if (dialogue) UI.dialog(dialogue); else UI.close();
    world.sync(model.state); refreshUI(); save();
    if (model.state.ending && !endShown) finish();
  }
  function dispatch(command, context = {}) {
    flushPositions();
    suppressNotification = Object.hasOwn(context, 'panel');
    let result;
    try { result = model.command(command); } finally { suppressNotification = false; }

    if (result.ok) {
      world.sync(model.state); reconcileActors(); refreshUI(); save();

      if (result.dialogue) { UI.dialog(typeof result.dialogue === 'string' ? model.dialogue(result.dialogue) : result.dialogue); return { ...result, handled: true }; }
      if (command.type === 'travel' || command.type === 'cast') { UI.close(); return { ...result, handled: true }; }
      if (context.panel === null && selected) {
        const target = activeThings().find(o => o.id === selected);
        if (target && reachable(target)) interact(target);
      }
      if (model.state.ending && !endShown) { finish(); return { ...result, handled: true }; }
    }
    return result;
  }
  function finish() {
    endShown = true; goal = null; UI.close(); assets.music(presentation.endingMusic || 'victory');
    game.particles.glints(hero.x, hero.y, 18, 25, '#dfc77b'); game.shake(1.5);
    const ending = model.interact(presentation.endingTarget) || { title: 'Journey complete', text: '' };
    UI.ending({ ...model.state, ending: { title: ending.title, text: ending.text }, endingText: ending.text, clues: clueCount(), clueTotal: clueTotal(), regionName: region()?.name, chapterName: presentation.chapterName });
    save();
  }
  function showInventory() { if (playing) { goal = null; UI.inventory(runtime().view('inventory')); } }
  function showJournal() { if (playing) { goal = null; UI.journal({ entries: model.journal(), objective: model.objective(), clues: clueCount(), clueTotal: clueTotal() }); } }
  function showMap() {
    if (playing) { goal = null; UI.map({ ...region(), ...(region()?.mapPresentation || {}), name: region()?.mapPresentation?.name || region()?.name, width: world.width, height: world.height, player: { x: hero.x, y: hero.y }, locations: world.landmarks || region()?.landmarks || [], objects: world.objects, npcs: npcs.map(n => ({ ...entity(n.id), name: n.name, x: n.body.x, y: n.body.y })) }); }
  }
  function spellbook() {
    if (!playing || game.paused) return;
    goal = null;
    const abilities = registry.all('abilities').filter(a => !a.hidden && (!a.requiresLearned || runtime().check({ op: 'learned', ability: a.id })));
    UI.dialog({ title: presentation.spellbookTitle || 'The ways of small magic', subtitle: `SPELLBOOK · ${Math.round(model.state.mana)} / ${maxMana()} focus`, portrait: 'magic',
      text: presentation.spellbookText || 'Select a spell. Targeted spells ask you to choose a nearby recipient before spending resources.',
      choices: [...abilities.map(a => ({ label: `${a.name} · ${a.costs?.mana || 0} focus${Object.entries(a.costs?.items || {}).map(([id, n]) => `, ${n} ${registry.get('items', id)?.name || id}`).join('')}`, action: `spell:${a.id}` })), { label: 'Close the spellbook', action: 'close' }] });
  }
  function cast(id, target) {
    const ability = registry.get('abilities', id);
    if (!ability) { UI.toast('Unknown ability.', 'warning'); return; }
    if (!target && !['self', 'none'].includes(ability.target || 'self')) {
      const candidates = [...npcs, ...enemies].map(a => ({ ...entity(a.id), name: a.name })).concat(world.objects).filter(o => E.dist(hero, o) <= (ability.range || 80));
      if (ability.target === 'actor' || ability.target === 'any') candidates.unshift({ id: 'player', name: 'Yourself' });
      UI.dialog({ title: ability.name, subtitle: 'CHOOSE A TARGET', text: ability.description || 'The command checks range, line of sight and resources before casting.', choices: [...candidates.map(o => ({ label: o.name || o.id, command: { type: 'cast', ability: ability.id, target: o.id } })), { label: 'Cancel', action: 'close' }] });
      return;
    }
    const result = dispatch({ type: 'cast', ability: ability.id, target: target || 'player' });
    if (result.ok) {
      UI.close();
      game.particles.ring(hero.x, hero.y, 8, 50, '#8de3cf', 1.3);
      
    } else UI.toast(result.message, 'warning');
  }
  function attack() {
    if (!playing || UI.isOpen() || game.paused || model.state.hp <= 0) return;
    const target = enemies.filter(e => actorHP(entity(e.id)) > 0 && E.dist(hero, e.body) < 46).sort((a, b) => E.dist(hero, a.body) - E.dist(hero, b.body))[0];
    if (target) hero.facing = E.angleTo(hero, target.body);
    if (sword.start()) { game.audio.sfx('swing'); goal = null; }
  }
  function revive() {
    UI.close(); const result = dispatch({ type: 'recover' });
    if (result.ok) { mountRegion(); hurtTime = 0; UI.toast(presentation.recovery || 'You recover at a safe resting place. Your discoveries are safe.'); }
    else UI.toast(result.message, 'warning');
  }
  function hurt(damage, source) {
    if (hurtTime > 0 || model.state.hp <= 0) return;
    const result = runtime().damage('player', damage, source);
    if (!result.ok) return;
    hurtTime = .7;
    game.hitFx(hero.x, hero.y, 14, { damage, power: .55, color: '#d29773', sound: 'hurt' });
    if (model.state.hp <= 0) showDeath();
  }
  function showDeath() {
      goal = null; UI.dialog({ title: presentation.deathTitle || 'A hand in the dark', subtitle: 'YOU HAVE FALLEN', text: presentation.deathText || 'A friendly hand brings you to safety. Your discoveries will not be lost.', choices: [{ label: presentation.deathChoice || 'Recover at a safe resting place', action: 'game:revive' }] });
  }
  function walkTo(x, y, object = null) {
    const points = [{ x, y }];
    for (const radius of [12, 24, 36]) for (let i = 0; i < 8; i++) points.push({ x: x + Math.cos(i * Math.PI / 4) * radius, y: y + Math.sin(i * Math.PI / 4) * radius });
    for (const p of points) {
      if (!map.standable(p.x, p.y, 0, hero.r)) continue;
      path.update(p.x, p.y);
      const idx = Math.floor(hero.y / map.T) * map.w + Math.floor(hero.x / map.T);
      if (path.d[idx] < 1e9) { goal = { ...p, object, age: 0 }; return true; }
    }
    UI.toast('There is no clear path. Look for a doorway.', 'warning'); return false;
  }
  function clickWorld(click) {
    const ground = game.view.toGround(click[0] + game.screen.ix, click[1] + game.screen.iy);
    const candidates = activeThings().map(o => {
      const p = game.view.p(o.x, o.y, 0), sx = p[0] - game.screen.ix, sy = p[1] - game.screen.iy;
      const height = (o.pick?.height || (o.character ? 38 : 28)) * game.zoom;
      const hit = Math.abs(click[0] - sx) < (o.pick?.width || (o.character ? 12 : 18)) * game.zoom && click[1] > sy - height && click[1] < sy + 5;
      return { o, d: hit ? Math.abs(click[0] - sx) * .1 : 30 + Math.hypot(ground[0] - o.x, ground[1] - o.y) };
    }).sort((a, b) => a.d - b.d);
    const target = candidates[0]?.d < 54 ? candidates[0].o : null;
    if (preview && query.get('inspect') === '1' && target) { showPanel('inspector', { selected: target.id }); return; }
    if (target && reachable(target)) interact(target);
    else walkTo(target?.x ?? ground[0], target?.y ?? ground[1], target?.id);
  }
  function moveBody(body, target, speed, flow, dt) {
    flow.update(target.x, target.y);
    const idx = Math.floor(body.y / map.T) * map.w + Math.floor(body.x / map.T);
    if (flow.d[idx] >= 1e9) { body.vx = body.vy = 0; return false; }
    const d = flow.dir(body.x, body.y, target.x, target.y);
    body.vx = d[0] * speed; body.vy = d[1] * speed; body.facing = Math.atan2(d[1], d[0]); body.update(dt, map);
    return true;
  }
  function peaceful(actor) {
    return !runtime().isHostileActive(actor.id) || !!(actor.def.peaceWhen && runtime().check(actor.def.peaceWhen, { actor: actor.id, target: 'player' })) ||
      model.state.statuses.some(s => (s.target === actor.id || s.target === 'player') && (registry.get('statuses', s.id)?.modifiers?.pacified || registry.get('statuses', s.id)?.pacifies));
  }
  function updateNPCs(dt, title = false) {
    for (const n of npcs) {
      const b = n.body; n.t += dt; n.casting = Math.max(0, n.casting - dt); b.vx = b.vy = 0;
      let pose = n.def.pose || null;
      if (!title && !UI.isOpen() && actorHP(entity(n.id)) > 0) {
        if (isParty(n.id)) {
          if (partyMode(n.id) !== 'wait') {
            const distance = E.dist(b, hero);
            if (distance > 25) {
              const moved = moveBody(b, hero, modifiedStat('speed', n.id, distance > 80 ? n.def.companion?.runSpeed ?? 95 : n.def.companion?.speed ?? 70), n.flow, dt);
              n.stuck = moved ? 0 : n.stuck + dt;
              if (n.stuck > 6 && distance > 90) {
                for (let i = 0; i < 8; i++) {
                  const x = hero.x + Math.cos(i * Math.PI / 4) * 24, y = hero.y + Math.sin(i * Math.PI / 4) * 24;
                  if (map.standable(x, y, 0, b.r) && map.sight(hero, { x, y, z: 0 })) { b.x = x; b.y = y; n.stuck = 0; break; }
                }
              }
            }
          }
          n.assist = Math.max(0, n.assist - dt);
          const config = n.def.companion || {};
          const stance = model.state.party.find(p => p.id === n.id)?.stance;
          const foe = enemies.find(e => (stance !== 'defensive' || E.dist(hero, e.body) < 48) && actorHP(entity(e.id)) > 0 && !peaceful(e) && E.dist(b, e.body) < (config.assistRange || 85) && E.dist(hero, e.body) < 140 && map.sight(b, e.body));
          if (foe && !n.assist && config.assistDamage) {
            n.assist = config.assistInterval || 5; n.casting = .8;
            entity(n.id).state.assistReadyAt = model.state.time + n.assist;
            const damage = modifiedStat('damage', n.id, config.assistDamage);
            runtime().damage(foe.id, damage, n.id);
            foe.flash = .2;
            game.particles.glints(foe.body.x, foe.body.y, 18, 8, '#a8dfc1');
            game.particles.text(foe.body.x, foe.body.y, 24, String(modifiedStat('damage', n.id, config.assistDamage)), '#a8dfc1');
          }
        } else {
          const behavior = runtime().behavior(n.id, dt);
          const schedule = behavior || runtime().schedule(n.id);
          const target = schedule?.target || schedule?.destination || schedule;
          if (target && Number.isFinite(target.x) && Number.isFinite(target.y) && (!schedule.regionId || schedule.regionId === model.state.regionId)) {
            if (E.dist(b, target) > 3) moveBody(b, target, modifiedStat('speed', n.id, n.def.stats?.speed ?? 22), n.flow, dt);
            else pose = schedule.pose || (schedule.activity === 'rest' ? 'kneel' : n.def.pose);
          }
        }
      }
      n.facing = b.facing ?? n.facing;
      runtime().syncPosition(n.id, b.x, b.y);
      n.rig.update(dt, { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, facing: n.facing, pose: n.casting > 0 ? n.castPose || 'cast' : pose });
    }
  }
  function updateEnemies(dt) {
    for (const e of enemies) {
      e.flash = Math.max(0, e.flash - dt); e.cooldown -= dt; e.casting = Math.max(0, e.casting - dt);
      const b = e.body, d = E.dist(hero, b), calm = peaceful(e), config = e.def.attack || {};
      const range = config.range || 32, activeRange = config.aggroRange || 140;
      b.vx = b.vy = 0;
      if (actorHP(entity(e.id)) > 0 && !calm && d < activeRange && map.sight(b, hero)) {
        e.facing = E.angleTo(b, hero);
        const behavior = runtime().behavior(e.id, dt);
        const destination = behavior?.target || behavior?.destination || behavior;
        if (destination && Number.isFinite(destination.x) && Number.isFinite(destination.y)) moveBody(b, destination, modifiedStat('speed', e.id, behavior.speed ?? e.def.stats?.speed ?? 29), e.flow, dt);
        else if (d > range * .8 && !e.attack.busy) moveBody(b, hero, modifiedStat('speed', e.id, e.def.stats?.speed ?? 29), e.flow, dt);
        if (d < range && e.cooldown <= 0 && !e.attack.busy) { e.attack.start(); e.hit = false; e.cooldown = config.cooldown || 2; entity(e.id).state.attackReadyAt = model.state.time + e.cooldown; game.audio.sfx('blip'); }
        e.attack.update(dt);
        if (e.attack.active && !e.hit && d < range + 2 && map.sight(b, hero)) {
          e.hit = true;
          if (config.ability) {
            const result = runtime().command({ type: 'cast', actor: e.id, ability: config.ability, target: 'player' });
            if (result.ok) game.particles.ring(hero.x, hero.y, 12, 20, '#a8b4df', .5);
          } else {
            const damage = modifiedStat('damage', e.id, config.damage ?? e.def.stats?.damage ?? 13);
            hurt(game.settings.difficulty === 'Story' ? Math.round(damage * .38) : damage, e.id);
          }
        }
      } else e.attack.cancel();
      runtime().syncPosition(e.id, b.x, b.y);
      e.rig.update(dt, { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, facing: e.facing, attack: e.attack.state, pose: actorHP(entity(e.id)) <= 0 ? 'down' : calm ? 'kneel' : e.casting > 0 ? e.castPose || 'cast' : null, stance: 'ready', hurt: e.flash });
    }
  }
  function clueCount() { return model.clueCount?.() || 0; }
  function clueTotal() { return model.clueTotal?.() || 0; }
  function refreshUI() {
    if (!model || !hero) return;
    const s = model.state;
    UI.update({ hp: { current: s.hp, max: maxHP() }, mana: { current: s.mana, max: maxMana() }, gold: s.gold, objective: model.objective(), objectiveTitle: registry.get('quests', s.trackedQuest || settings.primaryQuest)?.title || 'Field guide', location: world.location(hero.x, hero.y), companion: s.party.length > 0, partyCount: s.party.length, nearName: near?.name || '', time: (() => { const hour = (6 + s.time / (settings.dayLength || 240) * 24) % 24; return String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.floor(hour % 1 * 60)).padStart(2, '0'); })(), clues: clueCount(), clueTotal: clueTotal(), muted: !game.settings.sound, labels: Object.fromEntries(['interact', 'attack', 'magic', 'inventory', 'journal', 'map', 'kit'].map(k => [k, game.input.label(k)])) });
  }
  function playUpdate(dt) {
    const I = game.input;
    if (UI.isOpen()) {
      if (UI.isEditing?.()) return;
      if (I.repeat('down', .3, .15) || I.repeat('right', .3, .15)) UI.navigate(1);
      if (I.repeat('up', .3, .15) || I.repeat('left', .3, .15)) UI.navigate(-1);
      if (I.pressed('confirm')) UI.confirm();
      if (I.pressed('cancel')) UI.back();
      return;
    }
    runtime().tick(dt); castTime = Math.max(0, castTime - dt); hurtTime = Math.max(0, hurtTime - dt);
    if (I.pressed('inventory')) { showInventory(); return; } if (I.pressed('journal')) { showJournal(); return; }
    if (I.pressed('map')) { showMap(); return; } if (I.pressed('magic')) { spellbook(); return; } if (I.pressed('kit')) { showPanel('kit'); return; }
    if (I.pressed('interact')) { interact(); return; } if (I.pressed('attack')) attack();
    const click = I.clicked(); if (click) clickWorld(click);
    const m = I.move(), moving = Math.hypot(m[0], m[1]) > .06;
    hero.vx = hero.vy = 0;
    if (moving) {
      goal = null;
      const [dx, dy] = game.view.screenDirToGround(m[0], m[1]), speed = modifiedStat('speed', 'player', I.down('dash') ? playerConfig.runSpeed ?? 108 : playerConfig.speed ?? 75);
      hero.vx = dx * speed; hero.vy = dy * speed; hero.facing = Math.atan2(dy, dx); hero.update(dt, map);
    } else if (goal) {
      goal.age += dt;
      const object = goal.object && activeThings().find(o => o.id === goal.object);
      if (object && reachable(object)) { goal = null; interact(object); }
      else if (Math.hypot(hero.x - goal.x, hero.y - goal.y) < 3 || goal.age > 20) goal = null;
      else moveBody(hero, goal, modifiedStat('speed', 'player', playerConfig.pathSpeed ?? 85), path, dt);
    } else hero.update(dt, map);
    runtime().syncPosition('player', hero.x, hero.y);
    sword.update(dt);
    sword.hits(enemies, e => actorHP(entity(e.id)) > 0 && E.inArc(hero, hero.facing, e.body, playerConfig.attack?.range || 36, 1.7) && map.sight(hero, e.body), e => {
      const result = runtime().command({ type: 'attack', target: e.id });
      if (result.ok) {
        e.flash = .2; game.hitFx(e.body.x, e.body.y, 18, { damage: Math.max(0, runtime().stat('damage')), power: .6, color: '#cfb777' });
        if (actorHP(entity(e.id)) <= 0) { game.particles.glints(e.body.x, e.body.y, 16, 12, '#8dceb9'); UI.toast(e.def.defeatText || `${e.name} falls silent.`); save(); }
      }
    });
    updateEnemies(dt); updateNPCs(dt);
    if (model.state.hp <= 0 && !UI.isOpen()) showDeath();
    rig.update(dt, { x: hero.x, y: hero.y, z: hero.z, vx: hero.vx, vy: hero.vy, facing: hero.facing, attack: sword.state, pose: castTime > 0 ? castPose : null, hurt: hurtTime, stance: enemies.some(e => actorHP(entity(e.id)) > 0 && E.dist(hero, e.body) < 140) ? 'ready' : null });
    near = getNear();
    if (Math.hypot(hero.vx, hero.vy) > 5) { footTick += dt; if (footTick > .36) { footTick = 0; game.particles.dust(hero.x, hero.y, 0, 1); } }
    game.focus(hero.x, hero.y, 14); game.cam.offset = [0, game.upright ? -22 : 0];
    I.touchSet('interact', near ? 'USE' : 'TALK', true); I.touchSet('attack', 'BLADE', true); I.touchSet('magic', 'MAGIC', true);
    uiTick += dt; saveTick += dt;
    if (uiTick > .12) { uiTick = 0; refreshUI(); } if (saveTick > 8) { saveTick = 0; save(); }
  }
  function draw(r, title = false) {
    assets.sync();
    world.draw(r, model.state, game.time);
    if (goal) r.decal(() => r.groundRing(goal.x, goal.y, 5, '#e2c780', .8));
    const drawPerson = (b, character, options = {}) => { if (!r.visible(b.x, b.y, 0)) return; r.shadow(b.x, b.y, 6, .25); r.actor(b.x, b.y, b.z || 0, (g, x, y) => character.draw(g, x, y, r.view), options); };
    for (const n of npcs) drawPerson(n.body, n.rig, { every: 2, key: n });
    for (const e of enemies) {
      drawPerson(e.body, e.rig, { flash: e.flash > 0 });
      const hp = actorHP(entity(e.id)), max = Math.max(1, runtime().stat('maxHp', e.id));
      if (hp > 0 && hp < max) r.textAt(e.body.x, e.body.y, 44, `${Math.ceil(hp)} / ${max}`, '#e5be8a', { align: 'center' });
      if (e.attack.busy && e.attack.state?.phase === 'wind') r.decal(() => r.groundArc(e.body.x, e.body.y, 0, e.def.attack?.range || 34, e.facing - .9, e.facing + .9, '#df9270', .32));
    }
    if (!title) {
      r.decal(() => r.groundRing(hero.x, hero.y, 8, '#e4d099', .8));
      drawPerson(hero, rig, { flash: hurtTime > .45, xray: { color: '#eddb9e', outline: true } }); rig.drawSmear(r);
      if (model.state.statuses.some(s => s.target === 'player')) r.decal(() => r.groundRing(hero.x, hero.y, 19 + Math.sin(game.time * 3), '#9ddfc6', .6));
      if (near) { r.marker(near.x, near.y, 36, { color: '#e8cb82', offscreen: false }); r.textAt(near.x, near.y, 47, near.name, '#f8e7b9', { align: 'center', shadow: '#132221' }); }
      if (game.settings.hints) for (const o of activeThings()) {
        if (o.id === near?.id || E.dist(hero, o) > 130) continue;
        r.marker(o.x, o.y, 30, { color: o.character ? '#d8e6c8' : '#bbac75', offscreen: false });
      }
      for (const o of world.objects) { const def = definition(entity(o.id)); if (def?.revealWhen && runtime().check(def.revealWhen)) r.marker(o.x, o.y, 40, { color: '#91d9d1', offscreen: false }); }
    }
    if (preview && debugOverlay) drawDebug(r);
    r.glowMask = false;
    game.lights.enabled = game.settings.lighting === 'Dynamic'; game.lights.ambient = .78;
    game.lights.add(hero.x, hero.y, 18, 80, .45, { color: '#eac68c' });
  }

  // Toolkit view models and safe preview hooks are supplied below.
  function showPanel(name, params = {}) {
    goal = null; currentPanel = { name, params };
    if (name === 'inventory') return showInventory();
    if (name === 'kit') return UI.kit({});
    if (name === 'use-target') {
      return UI.menuPanel({ title: 'Use a carried item', text: 'Choose an item to use on this object.', choices: runtime().view('inventory').items.filter(item => registry.get('items', item.id)?.use).map(item => ({ label: item.name, command: { type: 'verb', verb: 'use', target: params.target, item: item.id }, reason: runtime().explain(registry.get('items', item.id).use.conditions, { actor: 'player', target: params.target }) })) });
    }
    if (name === 'saves') return UI.saves({ status: saveStatus.message, error: !saveStatus.ok ? saveStatus.message : '', backupAvailable: !!persistence.legacyBackup(), previousBackupAvailable: (() => { try { return !!localStorage.getItem(persistence.keys.backupKey); } catch { return false; } })(), params });
    if (name === 'inspector') return showInspector(params);
    if (name === 'gallery') return showGallery(params);
    if (name === 'trading' && !params.vendor) {
      return UI.menuPanel({ title: 'Trade supplies', text: 'Approach a trader to buy or sell supplies.', choices: registry.all('vendors').map(v => ({ label: v.name || v.id, description: actorName(v.entity), panel: 'trading', params: { vendor: v.id }, reason: v.entity && !reachable({ ...entity(v.entity), id: v.entity }) ? 'Approach this trader first.' : '' })) });
    }
    if (name === 'crafting' && !params.station) {
      const nearby = world.objects.filter(o => reachable(o) && registry.all('recipes').some(r => registry.resolve('prefabs', r.station) === o.definition));
      if (nearby.length === 1) params = { ...params, station: nearby[0].id };
    }
    const type = name;
    const view = runtime().view(type, params);
    if (typeof UI[name] === 'function') UI[name]({ ...view, params });
  }
  function showInspector(params) {
    if (!preview) return;
    debugSelected = params.selected || debugSelected;
    const entities = Object.values(model.state.entities).map(e => ({ ...e, name: definition(e)?.name || e.id }));
    const target = entities.find(e => e.id === debugSelected);
    const conditions = registry.all('actions').filter(a => a.conditions).slice(0, 100).map(a => ({ label: a.id, ok: runtime().check(a.conditions, { target: debugSelected, actor: 'player' }), reason: runtime().explain(a.conditions, { target: debugSelected, actor: 'player' }) }));
    UI.inspector({ selected: target, entities, conditions, events: commandLog, quests: model.journal(), time: model.state.time, overlay: debugOverlay, source: target ? { record: definition(target), file: 'Content registry: ' + target.definition } : {}, params });
  }
  function showGallery(params) {
    if (!preview) return;
    const entries = [...registry.all('actors').map(a => ({ ...a, kind: 'actor' })), ...registry.all('prefabs').map(p => ({ ...p, kind: 'prefab' }))];
    UI.gallery({ entries, ...params, params });
  }
  function drawDebug(r) {
    if (debugOverlay === 'collision' || debugOverlay === 'all') {
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        if (map.standable(x * map.T + 8, y * map.T + 8, 0, 3) || !r.visible(x * map.T, y * map.T, 0, 20, 20, 20)) continue;
        r.decal(() => r.groundRing(x * map.T + 8, y * map.T + 8, 5, '#ef927f', .55));
      }
    }
    if (debugOverlay === 'paths' || debugOverlay === 'all') {
      path.update(hero.x, hero.y);
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        const wx = x * map.T + 8, wy = y * map.T + 8, distance = path.d[y * map.w + x];
        if (Math.hypot(wx - hero.x, wy - hero.y) > 140 || !map.standable(wx, wy, 0, 2)) continue;
        r.decal(() => r.groundRing(wx, wy, 2, distance < 1e9 ? '#9de7ac' : '#e99c8d', .5));
      }
      for (const o of activeThings()) if (r.visible(o.x, o.y, 0)) r.textAt(o.x, o.y, 20, o.id, '#b4dfb4', { align: 'center' });
    }
  }
  function debugCommand(cmd) {
    if (!preview) return { ok: false, message: 'Designer tools require an isolated preview session.' };
    if (cmd.type === 'clock') runtime().advance(Number(cmd.minutes || 1) * 60);
    else if (cmd.type === 'overlay') debugOverlay = cmd.layer || '';
    else if (cmd.type === 'teleport') {
      const e = entity(cmd.target); if (e && e.regionId === model.state.regionId) teleport(e.x, e.y);
    } else if (cmd.type === 'select') debugSelected = cmd.id;
    else if (cmd.type === 'reset' || cmd.type === 'reload' && cmd.mode === 'restart') begin(true);
    else if (cmd.type === 'reload') { save(); location.reload(); }
    refreshUI(); return { ok: true };
  }
  function previewAsset(canvas, options) {
    const d = registry.get(options.kind === 'actor' ? 'actors' : 'prefabs', options.id);
    if (d) return HBWorld.preview(E, canvas, d, { ...options, world });
  }
  function exportSave(options = {}) {
    if (options.backup) return persistence.legacyBackup() || '';
    if (options.replay) return JSON.stringify({ format: 'hollow-bell-command-replay', schemaVersion: 1, packVersions: model.state.packVersions, initialState: replayInitial, steps: commandLog, note: 'Diagnostic command log; movement and engine input are not recorded as a deterministic replay.' }, null, 2);
    flushPositions(); return persistence.export(model.state);
  }
  function restoreSave() {
    const result = persistence.restoreBackup();
    if (result.ok) { reset(result.state); playing = true; UI.hideTitle(); game.resume(); game.go('play'); save(); refreshUI(); }
    return result;
  }
  function importSave(text) {
    const result = persistence.import(text);
    if (result.ok) { reset(result.state); playing = true; UI.hideTitle(); game.resume(); game.go('play'); save(); refreshUI(); }
    return result;
  }
  function teleport(x, y) {
    hero.x = x; hero.y = y; hero.vx = hero.vy = 0; goal = null;
    runtime().syncPosition('player', x, y); game.cam.snap = true; near = getNear(); refreshUI();
  }
  reset(null);
  UI.init({ begin, interact: () => interact(), attack, magic: spellbook, inventory: showInventory, journal: showJournal, map: showMap, menu: () => game.menu(), choose,
    trackQuest: quest => { const result = dispatch({ type: 'trackQuest', quest }, { panel: 'journal' }); if (result.ok) showJournal(); return result; },
    command: dispatch, panel: showPanel, exportSave, importSave, restoreSave, debug: debugCommand, previewAsset,
    useItem: id => { const d = model.useItem(id); if (d) UI.dialog(d); else UI.inventory(runtime().view('inventory')); save(); refreshUI(); },
    continueEnding: () => { UI.close(); assets.music(region()?.music || music); }, save: () => save(true) });
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape' && UI.isOpen() && !UI.titleOpen() && !game.paused && !game.shell?.screen) { event.preventDefault(); event.stopImmediatePropagation(); UI.back(); game.input.clear(); }
  }, true);
  game.start({ scene: 'title', scenes: {
    title: { enter() { playing = false; const s = readSave(); UI.showTitle(!!s || !saveStatus.ok); game.input.touchButtons([]); },
      update(dt) { updateNPCs(dt, true); const p = region()?.titleCamera || { x: 340, y: 340 }; game.focus(p.x + Math.sin(game.time * .08) * 22, p.y + Math.cos(game.time * .08) * 14, 5); const I = game.input; if (I.lastDevice === 'gamepad') { if (I.repeat('down', .3, .15)) UI.navigate(1); if (I.repeat('up', .3, .15)) UI.navigate(-1); if (I.pressed('confirm')) UI.confirm(); if (I.pressed('cancel')) UI.back(); } if (!UI.isOpen() && I.pressed('start')) begin(false); },
      draw: r => draw(r, true), camera: { start: .88, tall: 1, zoom: false } },
    play: { pausable: true, touch: [], camera: { start: 1.05, tall: 1.08, zoom: [.7, 1.6] }, enter() { game.input.use(bindings); game.focus(hero.x, hero.y, 14); game.cam.snap = true; }, update: playUpdate, draw: r => draw(r), back() { if (UI.isOpen()) { UI.back(); return true; } return false; } }
  } });
  game.debug = {
    snapshot: () => ({ title: !playing, regionId: model.state.regionId, player: { x: hero.x, y: hero.y, hp: model.state.hp, mana: model.state.mana }, location: world.location(hero.x, hero.y), objective: model.objective(), flags: { ...model.state.flags }, inventory: { ...model.state.inventory }, ending: model.state.ending, party: model.state.party, enemies: enemies.map(e => ({ id: e.id, hp: actorHP(entity(e.id)) })), errors: game.errors }),
    teleport, interact(id) { const o = activeThings().find(o => o.id === id); if (o && reachable(o)) interact(o); },
    objects: () => activeThings().map(({ id, name, x, y }) => ({ id, name, x, y })), save: () => save(), begin, choose, cast, walkTo,
    command: dispatch, panel: showPanel, state: () => model.state, world: () => world, registry: () => registry, runtime,
    advanceTime: seconds => { if (preview) runtime().advance(seconds); }, events: () => commandLog,
    assets: () => ({ ...assets.snapshot(), animation: { pose: castPose, remaining: castTime } }),
    actorCounts: () => ({ actors: 1 + npcs.length + enemies.length, props: world.props?.length || 0, interactiveEntities: world.objects.length })
  };
  if (preview && query.get('preview') === 'benchmark') {
    window.__HBPerformanceFixture = { configure({ density = 1, seed = 4731 } = {}) {
      game.settings.lighting = 'Soft'; game.settings.hints = true; game.settings.sound = false;
      model.state.time = 0; model.state.rng = seed; teleport(360, 440); UI.close();
      if (density === 2) {
        const originals = activeActorEntities();
        for (const e of originals) {
          const copy = JSON.parse(JSON.stringify(e)); copy.id += '-benchmark'; copy.x += 3; copy.y += 3;
          model.state.entities[copy.id] = copy;
        }
        const def = registry.all('actors').find(a => a.team === 'player') || registry.all('actors')[0];
        model.state.entities['benchmark:hero'] = { id: 'benchmark:hero', kind: 'actor', definition: def.id, regionId: model.state.regionId, x: hero.x + 3, y: hero.y + 3, z: 0, hp: 100, mana: 60, state: {}, inventory: {}, equipment: {} };
        reconcileActors();
      }
      return { actors: 1 + npcs.length + enemies.length, npcs: npcs.length, enemies: enemies.length, ...world.benchmarkDensity(density) };
    } };
  }
  window.__hollowBell = { game, snapshot: game.debug.snapshot }; window.__game = game;
})();
