/**
 * main.js — Little Orbit · The Coffee Post, on the shared 3D kit.
 *
 * boot() starts WebGPU (WebGL2 as fallback), the quality tiers, the settings
 * panel and keyboard / mouse / gamepad / touch input. The game keeps its own
 * rules, walk, camera, world and menus; Renderer (engine.js) draws its node
 * trees with three.js.
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { Journey } from './wayfinding.js';
import { TrailerDirector } from './trailer.js';
import { SUNROOM } from './sunroom-spec.js';
import { DetourUI } from './detour-ui.js';
import { LifeMotion } from './life-motion.js';
import { LifeUI } from './life-ui.js';
import { LIFE_SITES, FILMS } from './life-spec.js';
import { CoffeeCraft } from './coffee-craft.js';
import { EspressoMotion, ESPRESSO_DURATION } from './espresso-motion.js';
import { PocketFilm } from './cinema-film.js';
import { NEW_REGIONS, STAMPS } from './expansion-spec.js';
import { Renderer, Node } from './engine.js';
import { CharacterMotion } from './character-motion.js';
import { COFFEE_SLOTS } from './courier-spec.js';
import { primitives } from './geometry.js';
import { loadAssetPack } from './assets.js';
import { buildWorld } from './world.js';
import { Walker, normalAt, frameAt } from './physics.js';
import { RoundState } from './state.js';
import { ACTIONS, Input } from './input.js';
import { MenuNav } from './menu-nav.js';
import { UI } from './ui.js';
import { AudioGarden } from './audio.js';
import { CONFIG } from './config.js';
import { updatePost, ALL_LETTERS } from './post.js';
import { clamp, norm, vmul, vadd, vsub, dot, cross, projectTangent, rotate, mixv, lerp, basis } from './math.js';

// The old renderer wrote its colours straight to the screen. Keep that look: no colour
// management and linear output, so every paint and tint reads exactly as before.
THREE.ColorManagement.enabled = false;

const $ = id => document.getElementById(id);
const DETAIL_KEY = 'little-orbit-detail-v1';
let started = null; // the kit, once boot() has finished

async function startApp() {
  const kit = await boot({
    title: 'Little Orbit · The Coffee Post',
    canvas: $('game'),
    input: ACTIONS,
    // The sky is the page's own soft gradient, so the canvas stays transparent.
    renderer: { alpha: true, antialias: true },
    gear: 'none', // the pause menu and the title screen carry a Settings button instead
    holdLoading: true,
    accent: '#c6754f',
    background: '#ece3cc',
    touch: { theme: 'light' },
  });
  started = kit;
  kit.loading.progress(.65, 'Unpacking the little world…');
  kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  kit.renderer.toneMapping = THREE.NoToneMapping;
  kit.renderer.setClearColor(0x000000, 0);

  const renderer = new Renderer(kit);
  for (const [name, g] of Object.entries(primitives())) renderer.register(name, g);
  const fetchBytes = async file => {
    const r = await fetch(new URL(file, import.meta.url));
    if (!r.ok) throw new Error('A game file is missing: ' + file.replace('../', ''));
    return r.arrayBuffer();
  };
  const [bytes, espressoBytes] = await Promise.all([fetchBytes('../assets/orbit-assets.glb'), fetchBytes('../assets/espresso-machine.glb')]);
  const originalAssets = loadAssetPack(bytes, renderer);
  const espressoAssets = loadAssetPack(espressoBytes, renderer, 'espresso');
  const assets = { get(name) { return name === 'espresso_machine' ? espressoAssets.get(name) : originalAssets.get(name); } };
  // The mural streams in while the walk starts; the wall shows plain plaster until it arrives.
  renderer.imageTexture(SUNROOM.texture, new URL('../assets/sunroom-mural.jpg', import.meta.url).href).catch(err => console.warn('Sunroom mural:', err));
  kit.loading.progress(.8, 'Planting the orchard…');
  const world = buildWorld(renderer, assets);
  // The clouds never move, so they join the scenery instead of being walked every frame.
  const skyRoot = new Node('clouds');
  for (let i = 0; i < 13; i++) {
    const root = new Node('cloud'); root.matrix = frameAt(-74 + i * 12, (i % 3 - 1) * 15);
    for (let j = 0; j < 4; j++) root.part('pebble', '#f7eed9', [(j - 1.5) * 1.4, 14.5 + (i % 3) * 1.8, .5 * Math.sin(j)], [1.8 + (j % 2) * .7, 1.0, 1.1]);
    skyRoot.add(root);
  }
  world.statics.push(skyRoot);
  renderer.setStatic(world.statics);

  const state = new RoundState(), saved = state.load(), player = new Walker(world.surfaces), audio = new AudioGarden();
  player.facing = [0, 0, -1];
  let mode = 'title', time = 0, forward = [0, 0, 1], zoom = 10.8, pitch = .60, nearest = null, brew = null, lastStep = 0, lastSave = 0;
  let currentArea = 'Little Orbit Café', overviewYaw = 0, overviewPitch = 0, portraitYaw = .25, portraitPitch = .16, portraitDistance = 4.9, busy = null, film = null;
  let detail = !matchMedia('(any-pointer:coarse)').matches;
  try { const d = localStorage.getItem(DETAIL_KEY); if (d === '1' || d === '0') detail = d === '1'; } catch { /* private mode */ }
  const pocketFilm = new PocketFilm(renderer);
  let machineYaw = -.28, machinePitch = .25, machineDistance = 3.7;
  const machineMotion = new EspressoMotion(world.espresso);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  machineMotion.reduced = reduced;
  const narrow = () => kit.size.width <= 700;
  let cameraEye = vmul(norm([.20, 1, .36]), 84), cameraTarget = [0, 0, 0], cameraUp = [0, 0, 1], cameraShift = narrow() ? 0 : -.44, cameraYShift = narrow() ? -.42 : 0;
  const ui = new UI(action), input = new Input(kit), journey = new Journey(), nav = new MenuNav(input);
  let cameraCut = true, recenterUntil = 0, completionPending = null, resetArmed = 0;
  const lifeUI = new LifeUI(action);
  const detourUI = new DetourUI(action);
  const life = new LifeMotion(world, state.life, {
    player, audio, reduced,
    say: (id, name, text) => say(id, name, text),
    cue: k => courierMotion.cue(k),
    save,
    note: () => { ui.toast('A small moment saved in your journal.', time, 3); audio.chime(); spawn(player.n, player.h + 1.3, 8); },
    toast: text => ui.toast(text, time),
  });
  const craft = new CoffeeCraft(world.espresso, assets, audio);
  const playerRoot = new Node('courier_root'), courier = assets.get('codey'); playerRoot.add(courier);
  const cups = [], tray = courier.find('tray');
  if (!tray) throw new Error('The courier model needs a named tray group.');
  for (let i = 0; i < 4; i++) { const c = assets.get('coffee'); c.name = 'coffee_' + i; c.position = [...COFFEE_SLOTS[i]]; tray.add(c); cups.push(c); }
  const trailPin = assets.get('trail_pin'); trailPin.position = [.24, .76, -.72]; trailPin.rotation[1] = Math.PI; trailPin.scale = [1.20, 1.20, 1.20]; courier.add(trailPin);
  // A small bundle of letters rides on the backpack while the courier carries post.
  // It sits on the pack pocket's back face (the courier faces +Z), opposite the trail pin.
  const letterBag = new Node('letter_bag'); letterBag.position = [-.19, .72, -.724]; letterBag.rotation = [0, 0, .18]; courier.add(letterBag);
  letterBag.part('box', '#f2e3c2', [.02, .03, .019], [.20, .14, .018]); letterBag.part('box', '#fbf1dc', [0, 0, 0], [.20, .14, .02]); letterBag.part('box', '#d98a5f', [.06, .035, -.013], [.04, .04, .008]);
  const courierMotion = new CharacterMotion(courier, { seed: 41, reduced });
  for (let i = 0; i < world.pets.length; i++) world.pets[i].motion = new CharacterMotion(world.pets[i].node, { seed: 143 + i * 97, reduced });
  for (let i = 0; i < world.locals.length; i++) world.locals[i].motion = new CharacterMotion(world.locals[i].node, { seed: 643 + i * 97, reduced });
  const steam = new Node('coffee_steam'); steam.transparent = true; tray.add(steam);
  const steamPuffs = [];
  for (let i = 0; i < 8; i++) { const n = steam.part('smooth', '#f5efda', [0, 0, 0], [.05, .1, .05]); n.unlit = true; steamPuffs.push(n); }
  world.dynamics.push(playerRoot);
  // Kindness particles come from a fixed pool: no nodes are created or dropped while playing.
  const particleRoot = new Node('kindness_particles'); world.dynamics.push(particleRoot);
  const PARTICLE_COLORS = ['#efc679', '#efb39a', '#fff3d5', '#a8be91'].map(h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1]);
  const particles = Array.from({ length: 120 }, () => { const node = particleRoot.part('smooth', '#fff3d5', [0, 0, 0], [.065, .10, .065]); node.visible = false; return { node, n: null, h: 0, x: null, z: null, t: -100, angle: 0, speed: 0, live: false }; });
  let nextParticle = 0;

  if (saved && Array.isArray(saved.n) && saved.n.length === 3 && saved.n.every(Number.isFinite) && Math.hypot(...saved.n) > .5) {
    player.setAt(saved.n, clamp(Number(saved.h) || 0, 0, 9));
    if (Array.isArray(saved.forward) && saved.forward.length === 3 && saved.forward.every(Number.isFinite)) forward = projectTangent(saved.forward, player.n);
    if (Math.hypot(...forward) < .5) forward = projectTangent([0, 0, 1], player.n);
    player.facing = [...forward];
  }
  for (const pet of world.pets) if (state.served.has(pet.id)) { pet.cup = assets.get('coffee'); pet.cup.position = [.60, .67, .30]; pet.cup.scale = [.8, .8, .8]; pet.node.add(pet.cup); }

  /* ------------------------------------------------------------ the trailer */
  let director = null, trailerState = null;
  function getTrailer() {
    if (!director) {
      director = new TrailerDirector(renderer, world, assets);
      director.output.id = 'trailer-preview'; director.output.hidden = true; document.body.append(director.output);
    }
    return director;
  }
  function startTrailer() {
    if (trailerState) return;
    trailerState = { elapsed: 0, ready: false, returnMode: mode, soundWasOn: audio.enabled };
    input.reset(); ui.clearTransient(); if (ui.journalOpen) ui.toggleJournal(); if (ui.helpOpen) ui.toggleHelp();
    const d = getTrailer(); d.output.hidden = false; document.body.classList.add('trailer-view'); $('trailer-exit').hidden = false;
    mode = 'trailer'; audio.pause(false); if (!audio.enabled) { audio.toggle(false); syncSound(); } else audio.start(); audio.scene('trailer');
    audio.load()?.then(() => { if (!trailerState) return; audio.stop('trailer'); audio.fx('trailer', .80, 0, 1, 0, 'trailer'); trailerState.audioStart = audio.ctx?.currentTime || 0; trailerState.ready = true; });
    if (!audio.ctx || !audio.loading) trailerState.ready = true;
    $('trailer-exit').focus({ preventScroll: true });
  }
  function closeTrailer() {
    if (!trailerState) return;
    const back = trailerState.returnMode, wasOn = trailerState.soundWasOn; trailerState = null;
    audio.stop('trailer'); if (!wasOn && audio.enabled) { audio.toggle(false); syncSound(); } audio.scene('walk'); renderer.cinematic = false;
    director.output.hidden = true; document.body.classList.remove('trailer-view'); $('trailer-exit').hidden = true;
    setMode(back === 'title' ? 'title' : back === 'paused' ? 'paused' : 'play');
  }

  /* ------------------------------------------------------------ settings and sound */
  $('music-volume').value = String(Math.round(audio.musicVolume * 100)); $('effects-volume').value = String(Math.round(audio.fxVolume * 100));
  const syncVolumes = () => { audio.volumes(Number($('music-volume').value) / 100, Number($('effects-volume').value) / 100); $('music-value').textContent = Math.round(audio.musicVolume * 100) + '%'; $('effects-value').textContent = Math.round(audio.fxVolume * 100) + '%'; };
  for (const id of ['music-volume', 'effects-volume']) $(id).addEventListener('input', syncVolumes);
  syncVolumes();
  function syncSound() {
    const yes = audio.enabled;
    $('sound-btn').innerHTML = yes ? '♫' : '♫<span class="mute-slash">/</span>';
    $('sound-btn').setAttribute('aria-label', yes ? 'Mute sound' : 'Enable sound');
    $('sound-btn').title = yes ? 'Mute music and sound' : 'Enable music and sound';
    $('title-sound').textContent = yes ? 'Sound: on' : 'Sound: off';
    $('audio-status').textContent = yes ? 'Music and sound are on.' : 'Music and sound are off.';
  }
  const syncDetail = () => { $('quality-btn').textContent = detail ? 'Detail: soft shadows' : 'Detail: light mode'; };
  syncDetail();
  // Browsers only start audio from a gesture. A player who left the sound on gets it back at the first tap or key.
  const resumeSound = e => {
    removeEventListener('pointerdown', resumeSound, true); removeEventListener('keydown', resumeSound, true);
    if (!audio.wanted || audio.enabled || e.target?.closest?.('[data-action="sound"]')) return;
    audio.toggle(false); syncSound();
  };
  addEventListener('pointerdown', resumeSound, true); addEventListener('keydown', resumeSound, true);

  ui.loaded(!!saved?.active); $('sunroom-start').disabled = false; $('settings-title').disabled = false;
  ui.setSource(kit.input.source); ui.journal(state); ui.setMode(mode);
  kit.input.onSourceChange(src => ui.setSource(src));
  input.onRun = on => { kit.touch?.setLabel('run', on ? 'Run on' : 'Run'); kit.touch?.button('run')?.classList.toggle('is-on', on); };

  /* ------------------------------------------------------------ game actions */
  function save() { state.save(player, forward); }
  function say(id, name, text) { ui.dialogue(name, text, time); const label = audio.voice(id); $('dialog-voice').textContent = label + (audio.enabled ? '' : ' · sound off'); }
  function startFilm(id) {
    const spec = FILMS.find(f => f.id === id); if (!spec || (!spec.free && !state.explore.reel)) return;
    audio.stop('tone'); audio.lastFilm = -1; film = { id: spec.id, elapsed: 0, duration: spec.seconds, finished: false };
    pocketFilm.select(id); setMode('cinema'); pocketFilm.draw(0); lifeUI.film(film, state); ui.clearTransient();
  }
  function setMode(next) {
    cameraCut = true; if (ui.journalOpen) ui.toggleJournal(); if (next === 'play') kit.canvas.focus({ preventScroll: true });
    if (mode === 'cinema' && next !== 'cinema') film = null;
    mode = next; input.reset(); ui.setMode(mode);
    document.body.classList.toggle('mural-view', mode === 'mural'); $('mural-panel').hidden = mode !== 'mural';
    if (mode === 'paused') { resetArmed = 0; $('reset-btn').textContent = 'Reset saved progress'; $('pause').querySelector('button').focus({ preventScroll: true }); }
    if (mode === 'mural') { ui.clearTransient(); $('mural-panel').querySelector('button').focus({ preventScroll: true }); }
    document.body.classList.toggle('machine-view', mode === 'machine'); $('machine-panel').hidden = mode !== 'machine';
    if (mode === 'machine') { machineYaw = -.28; machinePitch = .25; machineDistance = narrow() ? 4.4 : 3.7; ui.clearTransient(); }
    if (mode !== 'play') save();
    if (mode === 'overview') { overviewYaw = 0; overviewPitch = 0; }
    if (mode === 'courier') { portraitYaw = .25; portraitPitch = .16; portraitDistance = narrow() ? 5.9 : 4.9; ui.clearTransient(); courierMotion.cue('curious'); }
    if (mode === 'title') $('start').focus({ preventScroll: true });
  }
  function home() {
    cameraCut = true; busy = null; film = null; life.wait = null; life.walk = null; life.music = null; ui.clearTransient();
    const n = normalAt(-.8, .2); player.setAt(n, world.surfaces.floorHeight(n, 2)); forward = [0, 0, 1]; player.facing = [0, 0, -1]; brew = null;
    cameraEye = vadd(player.position, vadd(vmul(player.n, 10), vmul(forward, -12))); cameraTarget = vadd(player.position, vmul(player.n, 1.4)); cameraUp = [...player.n];
    ui.toast('Back at the café. Your coffees are safe.', time); save();
  }
  function visitStudio() {
    if (ui.modal || brew || busy) { ui.toast('Finish your current task before you visit the studio.', time); return; }
    if (ui.journalOpen) ui.toggleJournal();
    life.wait = null; life.walk = null; life.music = null; film = null;
    const room = world.sunroom; player.setAt(room.spawn.n, room.spawn.h);
    forward = projectTangent(vmul(room.view.front, -1), player.n); player.facing = [...forward];
    zoom = 9.2; pitch = .48; state.active = true; setMode('play');
    cameraEye = vadd(player.position, vadd(vmul(player.n, 6.0), vmul(forward, -9.2)));
    cameraTarget = vadd(player.position, vmul(player.n, 1.6)); cameraUp = [...player.n];
    cameraShift = 0; cameraYShift = 0; ui.clearTransient(); audio.start(); save();
    ui.toast('Sunroom Studio. ' + (input.isTouch ? 'Tap Use' : input.isPad ? 'Press X' : 'Press E') + ' inside to look at the mural.', time, 5);
  }
  const clearTracks = () => { state.detours.track = ''; state.life.track = ''; state.explore.track = ''; state.post.track = ''; };
  function action(a) {
    if (a === 'trailer-close') { closeTrailer(); return; }
    if (a === 'trailer') { if (!brew && !busy) startTrailer(); return; }
    if (mode === 'trailer') return;
    if (a === 'settings') { kit.menu.open(); return; }
    if (ui.modal && !['help', 'keep', 'next', 'title', 'quality', 'reset', 'sound'].includes(a)) return;
    if (mode === 'paused' && !['resume', 'pause', 'help', 'home', 'title', 'quality', 'reset', 'sound', 'globe'].includes(a)) return;
    if (a === 'onboard-done') { state.onboarded = true; save(); kit.canvas.focus({ preventScroll: true }); return; }
    if (a === 'run') { if (mode === 'play' && !ui.journalOpen && !ui.modal) input.setRun(!input.run); return; }
    if (a === 'recenter') { if (mode === 'play' && !ui.journalOpen && !ui.modal) { recenterUntil = time + .8; pitch = .60; zoom = 10.8; } return; }
    if (a.startsWith('film:')) { if (mode === 'cinema') startFilm(a.slice(5)); return; }
    if (a.startsWith('note:')) { if (mode === 'play' && !ui.modal && !ui.journalOpen) life.playNote(life.music, Number(a.slice(5))); return; }
    if (a === 'music-tune') { life.tune(); return; } if (a === 'music-close') { life.music = null; return; }
    if (a === 'talk') { if (nearest?.type === 'neighbor' && mode === 'play' && !ui.modal && !ui.journalOpen && !brew) { courierMotion.cue('wave'); const p = world.pets.find(p => p.id === nearest.id); p.motion.cue('curious'); p.talkTime = time + 3; life.talk(nearest); } return; }
    if (a.startsWith('detour-track:')) { const id = a.slice(13); if (!world.detours.objects.some(x => x.id === id)) return; clearTracks(); state.detours.track = id; save(); return; }
    if (a.startsWith('life-track:')) { clearTracks(); state.life.track = a.slice(11); save(); ui.journal(state); return; }
    if (a.startsWith('post-track:')) { const id = a.slice(11); if (id !== 'box' && !ALL_LETTERS.some(l => l.id === id)) return; clearTracks(); state.post.track = id; save(); ui.journal(state); return; }
    if (a.startsWith('track:')) { const id = a.slice(6); clearTracks(); state.explore.track = NEW_REGIONS.some(r => r.id === id) ? id : ''; ui.journal(state); save(); return; }
    switch (a) {
      case 'studio': visitStudio(); break;
      case 'mural-close': if (mode === 'mural') { setMode('play'); kit.canvas.focus({ preventScroll: true }); } break;
      case 'machine': if ((mode === 'play' || mode === 'machine') && !ui.modal && !brew && !busy) { if (mode === 'machine') setMode('play'); else if (Math.acos(clamp(dot(player.n, world.machineN), -1, 1)) * 26 < 6) setMode('machine'); else ui.toast('Return to the café to inspect the machine.', time); } break;
      case 'machine-brew': if (mode === 'machine') { machineMotion.cue('brew', time); audio.brew(); } break;
      case 'machine-steam': if (mode === 'machine') { machineMotion.cue('steam', time); audio.fx('steam', .28, .2); } break;
      case 'machine-open': if (mode === 'machine') machineMotion.cue('open', time); break;
      case 'film-close': if (mode === 'cinema') setMode('play'); break;
      case 'untrack': clearTracks(); save(); ui.journal(state); break;
      case 'start': state.active = true; setMode('play'); if (state.complete && state.acknowledgedRound < state.round) completionPending = { round: state.round, elapsed: 0 }; audio.start(); save(); break;
      case 'interact': interact(); break;
      case 'courier': if ((mode !== 'play' && mode !== 'courier') || ui.modal || ui.journalOpen || brew || busy) return; setMode(mode === 'courier' ? 'play' : 'courier'); break;
      case 'smile': if (mode === 'courier') courierMotion.cue('happy'); break;
      case 'blink': if (mode === 'courier') courierMotion.cue('blink'); break;
      case 'tilt': if (mode === 'courier') courierMotion.cue('curious'); break;
      case 'wave': if ((mode === 'play' || mode === 'courier') && !ui.modal) { courierMotion.cue('wave'); audio.hello(); if (mode === 'play') { life.wave(player); for (const pet of world.pets) if (dot(pet.n, player.n) > .95) { pet.talkTime = time + 2; pet.motion.cue('wave'); spawn(pet.n, pet.h + 2.1, 5); } ui.toast('A little hello goes a long way.', time, 2.2); } } break;
      case 'jump': if (mode === 'play' && !ui.modal && !ui.journalOpen && player.jump()) audio.fx('jump', .22); break;
      case 'journal': if (mode === 'title') return; audio.fx('paper', .17); ui.toggleJournal(); input.reset(); break;
      case 'help': ui.toggleHelp(); input.reset(); break;
      case 'globe': if (mode === 'title') return; setMode(mode === 'overview' ? 'play' : 'overview'); break;
      case 'sound': { const yes = audio.toggle(); syncSound(); if (yes) audio.chime(); break; }
      case 'pause': if (mode !== 'title') setMode(mode === 'paused' ? 'play' : 'paused'); break;
      case 'resume': setMode('play'); break;
      case 'home': if (mode !== 'title') { home(); setMode('play'); } break;
      case 'title': setMode('title'); ui.closeComplete(); break;
      case 'quality': detail = !detail; try { localStorage.setItem(DETAIL_KEY, detail ? '1' : '0'); } catch { /* private mode */ } syncDetail(); break;
      case 'keep': state.acknowledgedRound = state.round; completionPending = null; ui.closeComplete(); input.reset(); save(); break;
      case 'next': state.acknowledgedRound = state.round; completionPending = null; ui.closeComplete(); home(); setMode('play'); ui.toast((input.isTouch ? 'Tap Use' : input.isPad ? 'Press X' : 'Press E') + ' at the machine to start a new round.', time, 5); break;
      case 'reset':
        // Two presses, no browser dialog: works the same with a mouse, a finger or a controller.
        if (time < resetArmed) { state.clear(); try { localStorage.removeItem(DETAIL_KEY); } catch { /* private mode */ } location.reload(); }
        else { resetArmed = time + 4; $('reset-btn').textContent = 'Press again to erase your walk'; }
        break;
    }
  }
  /** Esc, P or Start: close the innermost thing that is open, or pause. */
  function onPause() {
    if (mode === 'title') { if (ui.helpOpen) action('help'); else if (input.isPad) action('start'); return; }
    if (mode === 'mural') { action('mural-close'); return; }
    if (life.music) { life.music = null; return; }
    if (mode === 'machine' && !ui.modal) { setMode('play'); return; }
    if (mode === 'cinema' && !ui.modal) { action('film-close'); return; }
    if (mode === 'courier' && !ui.modal) { setMode('play'); return; }
    if (ui.helpOpen) { action('help'); return; }
    if (ui.journalOpen) { action('journal'); return; }
    if (!$('complete').hidden) { action('keep'); return; }
    action('pause');
  }
  /** B on a controller: step back out of whatever is open, but never open the pause menu. */
  function onBack() {
    if (mode === 'title') { if (ui.helpOpen) action('help'); return; }
    if (mode === 'paused' && !ui.helpOpen) { action('resume'); return; }
    if (mode === 'overview') { setMode('play'); return; }
    if (mode === 'play' && !life.music && !ui.helpOpen && !ui.journalOpen && $('complete').hidden) return;
    onPause();
  }
  function spawn(n, h = 1.6, num = 18) {
    if (reduced) return;
    const x = projectTangent([1, 0, .1], n), z = norm(cross(n, x));
    for (let i = 0; i < num; i++) {
      const p = particles[nextParticle]; nextParticle = (nextParticle + 1) % particles.length;
      Object.assign(p, { n, h, x, z, t: time, angle: i / num * Math.PI * 2, speed: .65 + Math.random() * .75, live: true });
      p.node.tint = PARTICLE_COLORS[i % 4].slice(); p.node.visible = true;
    }
  }
  function deliverLetter(o, withCoffee) {
    const letter = state.post.letterFor(o.id); if (!letter) return false;
    const r = state.post.deliver(letter.id); if (!r.ok) return false;
    if (state.post.track === letter.id) state.post.track = state.post.remaining()[0]?.id || (state.post.complete ? '' : 'box');
    audio.fx('paper', .22); kit.input.rumble(.25, 80);
    if (!withCoffee) say(letter.voice, o.name, letter.reply);
    if (r.complete) { ui.toast('Every letter delivered. The Morning Post rests.', time, 5); audio.fx('complete', .30); spawn(player.n, player.h + 1.5, 16); state.post.track = ''; }
    else if (r.bundleDone) { ui.toast('The town wrote back. Replies wait at the post box.', time, 5); audio.chime(); spawn(player.n, player.h + 1.4, 10); }
    else ui.toast((withCoffee ? 'And a letter from ' + letter.from + '. ' : 'A letter from ' + letter.from + '. ') + state.post.count + ' / ' + state.post.total + ' delivered', time, 4);
    return true;
  }
  function interact() {
    if (mode !== 'play' || ui.modal || ui.journalOpen || brew || busy) return;
    nearest = selectNearest(); if (!nearest) return;
    const o = nearest;
    if (o.type === 'mural') { life.music = null; setMode('mural'); return; }
    if (o.type === 'post') {
      const r = state.post.pickup(); ui.dialogue(r.title, r.text, time); audio.fx('paper', .22); courierMotion.cue('curious');
      if (r.ok) {
        spawn(o.n, o.h + 1.5, 8); kit.input.rumble(.2, 60);
        // A player who was following the post box keeps following: on to the first letter.
        if (state.post.track === 'box') state.post.track = state.post.remaining()[0]?.id || '';
        ui.toast(state.post.remaining().length + ' letters in your bag. The journal shows who they are for.', time, 4);
      }
      save(); return;
    }
    if (o.type === 'detour') { const result = state.detours.use(o.id); if (result.ok) { o.lastUse = world.detours.clock; courierMotion.cue('curious'); say(result.voice, result.title, result.text); audio.chime(); if (result.fresh) { spawn(player.n, player.h + 1.3, 9); ui.toast('A note from your walk · ' + state.detours.count + ' / 8', time, 3.5); } save(); } return; }
    if (o.type === 'local') {
      if (!deliverLetter(o, false)) say(o.voice, o.name, o.lines[state.life.chat(o.id, o.lines.length)]);
      o.local.motion.cue('wave'); courierMotion.cue('happy'); save(); return;
    }
    if (o.type === 'life') { life.use(o); return; }
    if (o.type === 'activity') { useActivity(o); return; }
    if (o.type === 'machine') {
      if (state.complete) { state.nextRound(); for (const p of world.pets) { if (p.cup) p.cup.visible = false; } ui.toast('A fresh round. New cups, familiar friends.', time); }
      if (state.coffees > 0) return ui.toast('Your tray is ready. Follow the next neighbor direction.', time);
      brew = { start: time, duration: ESPRESSO_DURATION, count: 4 - state.served.size }; input.reset(); courierMotion.cue('brew'); audio.brew(); return;
    }
    if (o.type === 'neighbor') {
      const result = state.deliver(o.id), pet = world.pets.find(p => p.id === o.id); pet.talkTime = time + 3;
      courierMotion.cue(result.ok ? 'deliver' : 'wave'); pet.motion.cue(result.ok ? 'happy' : 'wave');
      if (result.ok) {
        say(o.id, o.name, o.line); audio.fx('delivery', .30); spawn(o.n, o.h + 1.8); kit.input.rumble(.35, 120);
        if (!pet.cup) { pet.cup = assets.get('coffee'); pet.cup.position = [.60, .67, .30]; pet.cup.scale = [.8, .8, .8]; pet.node.add(pet.cup); }
        pet.cup.visible = true;
        const letter = deliverLetter(o, true);
        if (result.complete) { completionPending = { round: state.round, elapsed: 0 }; input.reset(); ui.toast('4 of 4 delivered. Your round is complete.', time, 4); }
        else if (!letter) ui.toast(pet.name + ' has a coffee · ' + state.served.size + ' of 4 delivered', time, 3.5);
      } else if (deliverLetter(o, false)) { /* a letter, no coffee this time */ }
      else if (result.reason === 'served') say(o.id, o.name, o.after);
      else life.talk(o);
      save(); return;
    }
    courierMotion.cue('curious'); state.wonders.add(o.type); o.lastUse = time;
    if (o.type === 'boat') audio.fx('water', .23); else audio.chime();
    spawn(o.n, o.h + 1.4, 12);
    const lines = { tree: ['Old apricot tree', 'A little shake. A little gift. The tree seems pleased.'], boat: ['A very small voyage', 'Off it goes. Pebble gives the boat a quiet wave.'], mushroom: ['The singing mushroom', 'Boop! A tiny song was hiding under that cap.'], bell: ['Hello, other side!', 'Your little hello has gone all the way around.'] };
    const [title, text] = lines[o.type] || ['A little wonder', 'There is always something else to find.'];
    ui.dialogue(title, text, time);
    if (o.type === 'bell') audio.bell();
    if (o.type === 'mushroom') { [440, 554, 659, 880].forEach((f, i) => audio.note(f, .28, .035, 'sine', i * .1)); player.jump(); }
    save();
  }
  function showActivity(result, o) {
    if (result.cue) courierMotion.cue(result.cue);
    if (result.title) say(({ bakery: 'bramble', seeds: 'sprig', plant: 'sprig', tap: 'baths', rest: 'baths', pottery: 'kiln', clay: 'kiln', read: 'archive', chime: 'tilly' })[o?.kind] || 'miso', result.title, result.text);
    const local = world.locals.find(p => p.name.toLowerCase().includes(({ bakery: 'bramble', seeds: 'seed', pottery: 'kiln', read: 'archive' })[o?.kind] || '___')); if (local) local.motion.cue('happy');
    if (result.ok) {
      o.lastUse = time;
      if (result.stamp) {
        audio.chime(); spawn(player.n, player.h + 1.5, 14); kit.input.rumble(.25, 90);
        const mark = STAMPS.find(x => x.id === result.stamp); ui.toast('Field note ' + state.explore.count + ' / 8 · ' + mark.title, time, 5);
        if (state.explore.count === 4) ui.dialogue('A leaf for your bag', 'Four field notes. A small leaf pin is now on your backpack.', time);
        if (state.explore.complete) ui.dialogue('You took the long way round.', 'All eight field notes are complete. The path lanterns are now lit. Your coffee round has not changed.', time);
      } else audio.hello();
    }
    save();
  }
  function useActivity(o) {
    if (o.kind === 'film') { startFilm(state.explore.reel ? 'home' : 'rain'); return; }
    const result = state.explore.use(o.kind, o.note);
    if (result.timed) { busy = { kind: result.timed, object: o, elapsed: 0, duration: result.seconds }; courierMotion.cue(o.kind === 'rest' ? 'happy' : 'brew'); ui.dialogue(result.title, result.text, time); return; }
    if (result.film) { film = { elapsed: 0, duration: result.seconds, finished: false }; setMode('cinema'); pocketFilm.draw(0); audio.hello(); ui.clearTransient(); return; }
    if (o.kind === 'plant' && result.stamp) state.explore.plantTime = time;
    if (o.kind === 'chime' && result.ok) { audio.note([392, 494, 587][o.note], .6, .06, 'sine'); if (state.explore.has('woodland')) [392, 494, 587, 784].forEach((f, i) => audio.note(f, .35, .04, 'sine', .20 + i * .2)); }
    showActivity(result, o);
  }
  function selectNearest() {
    const old = nearest; let best = null, bestScore = Infinity;
    for (const o of world.interactions) {
      const d = Math.acos(clamp(dot(o.n, player.n), -1, 1)) * 26, dh = Math.abs(o.h - player.h);
      if (o.type === 'neighbor' && d < 5.5 && dh < 2.6) state.met.add(o.id);
      if (d > (input.isTouch ? 2.5 : 2.3) || dh > 1.2) continue;
      const from = vmul(player.n, 26 + player.h + .85), to = vmul(o.n, 26 + o.h + .85);
      if (world.surfaces.rayFraction(from, to, .025, false) < .98) continue;
      const wanted = (o.type === 'neighbor' && state.coffees && !state.served.has(o.id)) || ((o.type === 'neighbor' || o.type === 'local') && state.post.letterFor(o.id));
      const score = d - (old?.id === o.id ? .23 : 0) - (wanted ? .30 : 0);
      if (score < bestScore) { best = o; bestScore = score; }
    }
    return best;
  }
  /** What the journal's "Show direction" points at: a letter's reader, the post box, or a place. */
  function trackedTarget() {
    const p = state.post.track;
    if (p) {
      if (p === 'box') return { ...world.post.target, name: 'The Morning Post', kind: 'post', hint: 'The post box beside the café. Collect the letters.' };
      const letter = ALL_LETTERS.find(l => l.id === p), who = letter && world.interactions.find(o => o.id === letter.to);
      if (who) return { n: who.n, h: who.h, id: who.id, name: 'A letter for ' + letter.name, kind: 'post', hint: letter.where + '. The letter is from ' + letter.from + '.' };
    }
    if (state.detours.track) return world.detours.objects.find(r => r.id === state.detours.track) || null;
    if (state.life.track) return LIFE_SITES.find(r => r.id === state.life.track) || (state.life.track === 'cinema' ? NEW_REGIONS.find(r => r.id === 'cinema') : null) || null;
    return NEW_REGIONS.find(r => r.id === state.explore.track) || null;
  }

  /* ------------------------------------------------------------ input each frame */
  const panels = { help: $('help'), complete: $('complete'), pause: $('pause'), journal: $('journal'), title: $('title'), courier: $('courier-panel'), machine: $('machine-panel'), cinema: $('film-panel'), mural: $('mural-panel'), music: $('music-panel') };
  /** The DOM panel that owns the controller right now, or null while walking. */
  function activePanel() {
    if (ui.helpOpen) return panels.help;
    if (!panels.complete.hidden) return panels.complete;
    if (mode === 'paused') return panels.pause;
    if (ui.journalOpen) return panels.journal;
    if (mode === 'title') return panels.title;
    if (panels[mode] && mode !== 'music') return panels[mode];
    // On a controller the instrument's five keys become a small menu; keyboards keep 1–5 and walking.
    if (mode === 'play' && life.music && input.isPad) return panels.music;
    return null;
  }
  const NOTE_ACTIONS = ['note0', 'note1', 'note2', 'note3', 'note4'];
  const PLAY_ACTIONS = [['interact', 'interact'], ['jump', 'jump'], ['recenter', 'recenter'], ['talk', 'talk'], ['wave', 'wave'], ['journal', 'journal'], ['globe', 'globe'], ['courier', 'courier'], ['machine', 'machine'], ['home', 'home'], ['help', 'help']];
  function handleInput(dt) {
    const k = kit.input;
    if (trailerState) { if (k.pressed('pause') || k.pressed('back') || k.pressed('confirm') || k.pressed('jump')) closeTrailer(); return; }
    const panel = activePanel();
    const inMenu = nav.update(dt, panel, onBack);
    if (k.pressed('pause')) { onPause(); return; }
    if (!inMenu && k.pressed('back')) { onBack(); return; }
    if (mode === 'title') { if (k.pressed('confirm')) action('start'); else if (k.pressed('help')) action('help'); return; }
    if (mode === 'mural') { if (k.pressed('interact')) action('mural-close'); return; }
    if (life.music && !inMenu) for (let i = 0; i < 5; i++) if (k.pressed(NOTE_ACTIONS[i])) action('note:' + i);
    for (const [name, a] of PLAY_ACTIONS) {
      // A controller's A presses the focused menu button; it must not also hop or use.
      if (inMenu && (name === 'jump' || name === 'interact') && input.isPad) continue;
      if (k.pressed(name)) action(a);
    }
  }

  /* ------------------------------------------------------------ touch controls */
  let touchHidden = null, talkShown = null, useLabel = '', useIdle = null;
  function syncTouch(prompt) {
    const t = kit.touch; if (!t) return;
    const hide = mode !== 'play' || ui.modal || ui.journalOpen || !!life.music || !!trailerState;
    if (hide !== touchHidden) { touchHidden = hide; t.suspend(hide, 'game'); }
    const talk = nearest?.type === 'neighbor';
    if (talk !== talkShown) { talkShown = talk; t.setShown('talk', talk); }
    if (prompt.label !== useLabel) { useLabel = prompt.label; t.setLabel('interact', prompt.label); }
    if (prompt.idle !== useIdle) { useIdle = prompt.idle; t.button('interact')?.classList.toggle('is-idle', prompt.idle); }
  }

  /* ------------------------------------------------------------ the frame */
  const completeEl = $('complete'), inspectEl = $('inspect-machine'), homeN = normalAt(0, 0);
  const view = { eye: null, target: null, up: null, fov: 0, shift: 0, yshift: 0, sun: null, focus: null, focusUp: null, shadows: false };
  let lastDistance = player.distance;
  function frame(rawDt) {
    const dt = Math.min(rawDt, .055);
    input.poll(dt);
    handleInput(dt);
    if (trailerState) {
      audio.pause(document.hidden); audio.scene('trailer');
      if (trailerState.ready && !document.hidden) trailerState.elapsed = audio.enabled && audio.ctx?.state === 'running' ? audio.ctx.currentTime - trailerState.audioStart : trailerState.elapsed + dt;
      getTrailer().composite(Math.min(29.999, trailerState.elapsed));
      if (trailerState.elapsed >= 30) closeTrailer();
      syncTouch({ label: 'Use', idle: true });
      return;
    }
    time += dt;
    const walking = mode === 'play' && !ui.modal && !ui.journalOpen;
    if (walking) {
      forward = projectTangent(forward, player.n);
      if (input.yaw) { forward = rotate(forward, player.n, -input.yaw); input.yaw = 0; recenterUntil = 0; }
      if (time < recenterUntil) { const f = projectTangent(player.facing, player.n), angle = Math.atan2(dot(cross(forward, f), player.n), dot(forward, f)); forward = rotate(forward, player.n, angle * (1 - Math.exp(-dt * 8))); }
      pitch = clamp(pitch + input.pitch, .35, 1.1); input.pitch = 0; zoom = clamp(zoom + input.zoom, 6.5, 20); input.zoom = 0;
      const move = input.read(), wasGrounded = player.grounded;
      player.update(dt, move, forward);
      if (!wasGrounded && player.grounded) audio.fx('land', .16);
      forward = projectTangent(forward, player.n);
      // A quiet record of the round for the results card. Nothing on screen counts down.
      if (state.active && !state.complete) { state.roundTime += dt; state.roundDistance += Math.max(0, player.distance - lastDistance); }
      if (player.moving && player.grounded && time - lastStep > (move.run ? .28 : .43)) { lastStep = time; audio.footstep(player.h > .12, move.run); }
      audio.ambience(time);
      if (busy) { const d = Math.acos(clamp(dot(player.n, busy.object.n), -1, 1)) * CONFIG.radius; if (d > 2.8 || Math.abs(player.h - busy.object.h) > 1.4) { busy = null; ui.toast('Activity paused. Come back to finish it.', time); } else { busy.elapsed += dt; if (busy.elapsed >= busy.duration) { const done = busy; busy = null; showActivity(state.explore.finish(done.kind), done.object); } } }
      if (brew) { const d = Math.acos(clamp(dot(player.n, world.machineN), -1, 1)) * 26; if (d > 3.2) { brew = null; ui.toast('Stay by the machine while the coffee brews.', time); } else if (time - brew.start >= brew.duration) { state.brew(); brew = null; courierMotion.cue('happy'); audio.chime(); spawn(player.n, player.h + 1.5, 12); kit.input.rumble(.3, 100); ui.toast(state.coffees + ' warm coffees. Follow the next neighbor direction.', time); save(); } }
    } else { player.moving = 0; if (brew) brew.start += dt; }
    lastDistance = player.distance;
    const completeOpen = !completeEl.hidden;
    audio.pause(mode === 'paused' || ui.helpOpen || ui.journalOpen || document.hidden);
    audio.scene(life.music ? 'instrument' : mode === 'cinema' ? 'cinema' : completeOpen ? 'complete' : 'walk');
    life.active = walking; life.update(life.active ? dt : 0, player, life.active && input.read().run);
    if (mode === 'cinema' && film && !ui.modal) {
      if (!film.finished) { film.elapsed += dt; pocketFilm.draw(film.elapsed); audio.film(film.id, film.elapsed); if (film.elapsed >= film.duration) { film.finished = true; state.life.watch(film.id); if (film.id === 'home') showActivity(state.explore.finish('film'), world.activities.find(o => o.kind === 'film')); save(); pocketFilm.draw(film.duration, true); } }
      ui.film(film.elapsed, film.duration, film.finished);
    }
    if (mode === 'overview') { overviewYaw -= input.yaw; overviewPitch = clamp(overviewPitch + input.pitch, -.65, .65); }
    if (mode === 'courier') { portraitYaw -= input.yaw; portraitPitch = clamp(portraitPitch + input.pitch, .03, .70); portraitDistance = clamp(portraitDistance + input.zoom, 3.6, 7); }
    if (mode === 'machine') { machineYaw -= input.yaw; machinePitch = clamp(machinePitch + input.pitch, .05, .85); machineDistance = clamp(machineDistance + input.zoom * .5, 2.4, 6.3); }
    // Camera turns only count where a view uses them; nothing piles up behind a menu.
    input.yaw = 0; input.pitch = 0; input.zoom = 0;
    // Use angular distance so interactions work on either side of the globe.
    nearest = mode === 'play' ? selectNearest() : null;
    if (completionPending && walking) { if (!state.complete || completionPending.round !== state.round) completionPending = null; else { completionPending.elapsed += dt; if (completionPending.elapsed >= 1.2) { completionPending = null; ui.complete(state); input.reset(); audio.fx('complete', .36); kit.input.rumble(.5, 220); } } }
    if (mode === 'play') { let area = null, dist = Infinity; for (const r of world.regions) { const d = Math.acos(clamp(dot(r.n, player.n), -1, 1)) * 26; if (d < r.radius && d < dist) { area = r; dist = d; } } currentArea = area ? area.name : 'The quiet path'; if (area && !state.places.has(area.id)) { state.places.add(area.id); if (area.id !== 'cafe') ui.place(area, time); save(); } }
    const prompt = ui.prompt(mode === 'play' ? nearest : null, state, brew, busy);
    const homeD = Math.acos(clamp(dot(homeN, player.n), -1, 1)) * 26, homeDir = projectTangent(homeN, player.n), r = norm(cross(forward, player.n)), bearing = Math.atan2(dot(homeDir, r), dot(homeDir, forward));
    ui.update(time, state, currentArea, homeD, bearing);
    const tracked = trackedTarget(); let trackD = 0, trackBearing = 0;
    if (tracked) { const tn = tracked.n || normalAt(...tracked.at), td = projectTangent(tn, player.n); trackD = Math.acos(clamp(dot(tn, player.n), -1, 1)) * CONFIG.radius; trackBearing = Math.atan2(dot(td, r), dot(td, forward)); }
    ui.trail(state, tracked, trackD, trackBearing); detourUI.update(state); journey.update(state, world, player, forward, input, tracked, mode, brew, ui);
    syncTouch(prompt);
    // Use a first-person seat view so the courier does not cover the film.
    playerRoot.visible = mode !== 'cinema' && mode !== 'machine' && mode !== 'mural' && !life.music;
    machineMotion.update(time, brew); craft.update(time, brew, machineMotion.snapshot());
    lifeUI.update(life, state, mode, nearest, craft.snapshot(), input.isPad ? 'RT' : 'T');
    const showInspect = mode === 'play' && nearest?.type === 'machine'; if (inspectEl.hidden === showInspect) inspectEl.hidden = !showInspect;
    world.detours.update(walking ? dt : 0, state);
    trailPin.visible = state.explore.pin; letterBag.visible = state.post.carrying; world.expansion.update(time, state, busy, mode === 'cinema' && !!film && !film.finished);
    updatePost(world, state.post);
    for (const local of world.locals) local.motion.update(mode === 'play' ? dt : 0);
    if (time - lastSave > 6 && state.active) { lastSave = time; save(); }
    const facing = projectTangent(player.facing, player.n), right = norm(cross(player.n, facing)); playerRoot.matrix = basis(right, player.n, facing, player.position);
    const poseDt = (mode === 'play' || mode === 'courier') && !ui.modal && !ui.journalOpen ? dt : 0;
    let interest = null, interestDistance = 4.8;
    if (mode === 'play') for (const o of world.interactions) { const d = Math.acos(clamp(dot(o.n, player.n), -1, 1)) * 26; if (d < interestDistance && Math.abs(o.h - player.h) < 1.8) { const target = projectTangent(vsub(vmul(o.n, 26 + o.h), player.position), player.n); if (dot(target, facing) > .15) { interest = { yaw: Math.atan2(dot(target, right), dot(target, facing)), pitch: o.type === 'neighbor' ? -.04 : .08 }; interestDistance = d; } } }
    if (mode === 'courier') interest = { yaw: Math.sin(portraitYaw) * .35, pitch: -.045 };
    courierMotion.update(poseDt, { moving: player.moving, running: input.read().run, look: interest, grounded: player.grounded });
    const packed = brew ? Math.min(brew.count, craft.snapshot().packed) : 0;
    for (let i = 0; i < 4; i++) cups[i].visible = i < state.coffees || (!!brew && i < packed);
    for (let i = 0; i < 8; i++) {
      const c = cups[Math.floor(i / 2)], p = steamPuffs[i]; p.visible = c.visible;
      const phase = (time * .7 + i * .37) % 1, size = .010 + phase * .012;
      p.position[0] = c.position[0] + Math.sin(time * 1.4 + i) * .025; p.position[1] = c.position[1] + .50 + phase * .38; p.position[2] = c.position[2];
      p.scale[0] = size; p.scale[1] = size * 3.2; p.scale[2] = size; p.tint[3] = .25 * (1 - phase);
    }
    for (const pet of world.pets) { pet.motion.update(poseDt); if (pet.cup) pet.cup.visible = state.served.has(pet.id); if (time < pet.talkTime) { const face = projectTangent(vsub(player.position, vmul(pet.n, 26 + pet.h)), pet.n); const side = norm(cross(pet.n, face)); pet.root.matrix = basis(side, pet.n, face, vmul(pet.n, 26)); } }
    for (const o of world.interactions) { const elapsed = o.lastUse == null ? 100 : time - o.lastUse; if (o.type === 'tree') o.node.rotation[2] = elapsed < 3 ? Math.sin(elapsed * 16) * .05 * Math.exp(-elapsed) : 0; if (o.type === 'bell') o.node.rotation[2] = elapsed < 8 ? Math.sin(elapsed * 7) * .45 * Math.exp(-elapsed * .4) : 0; if (o.type === 'mushroom') o.node.scale[1] = elapsed < 2 ? 1 + Math.sin(elapsed * 13) * .25 * Math.exp(-elapsed * 1.7) : 1; if (o.type === 'boat') { const t = elapsed < 100 ? Math.min(elapsed, 20) : 0; o.node.position = [.2 + Math.sin(t * .6) * 1.8, .24, .4 + Math.cos(t * .6) * .75]; o.node.rotation[1] = .7 + t * .6; } }
    for (const p of particles) {
      if (!p.live) continue;
      const age = time - p.t;
      if (age > 1.6 || age < 0) { p.live = false; p.node.visible = false; continue; }
      const up = 26 + p.h + age * 1.8 - age * age * .6, ox = Math.cos(p.angle) * age * p.speed, oz = Math.sin(p.angle) * age * p.speed, pos = p.node.position;
      for (let a = 0; a < 3; a++) pos[a] = p.n[a] * up + p.x[a] * ox + p.z[a] * oz;
      const s = .09 * (1 - age / 1.6); p.node.scale[0] = s; p.node.scale[1] = s * 1.3; p.node.scale[2] = s;
    }

    /* ---- camera */
    const aspect = kit.size.width / kit.size.height;
    let wantEye, wantTarget, wantUp, shift = 0, yshift = 0;
    if (mode === 'title') { const angle = reduced ? 0 : Math.sin(time * .075) * .14; wantEye = vmul(norm([.20 + angle, 1, .36]), narrow() ? 102 : 84); wantTarget = [0, 0, 0]; wantUp = [0, 0, 1]; shift = narrow() ? 0 : -.44; yshift = narrow() ? -.50 : 0; }
    else if (mode === 'courier') { const f = rotate(facing, player.n, portraitYaw); wantEye = vadd(player.position, vadd(vmul(player.n, 1.25 + portraitDistance * portraitPitch), vmul(f, portraitDistance))); wantTarget = vadd(player.position, vmul(player.n, .86)); wantUp = player.n; }
    else if (mode === 'machine') { const target = world.machineView.target, cs = Math.cos(machineYaw), sn = Math.sin(machineYaw); wantTarget = target; wantEye = vadd(target, [cs * machineDistance, machineDistance * machinePitch, -sn * machineDistance]); wantUp = [0, 1, 0]; }
    else if (mode === 'mural') { const v = world.sunroom.view; const distance = v.size * .5 / Math.tan(24 * Math.PI / 180) * 1.15; wantTarget = v.target; wantEye = vadd(v.target, vmul(v.front, distance)); wantUp = v.up; }
    else if (mode === 'cinema') { wantEye = world.expansion.cinema.eye; wantTarget = world.expansion.cinema.target; const m = world.expansion.cinema.frame; wantUp = [m[4], m[5], m[6]]; }
    else if (mode === 'play' && life.music) { const a = life.music, side = norm(cross(forward, player.n)); wantTarget = vmul(a.n, 26 + .75); wantEye = vadd(wantTarget, vadd(vmul(a.n, 3.5), vadd(vmul(side, 3.2), vmul(forward, -5.5)))); wantUp = a.n; }
    else if (mode === 'overview') { const f = rotate(forward, player.n, overviewYaw), n = norm(vadd(vmul(player.n, Math.cos(overviewPitch)), vmul(f, Math.sin(overviewPitch)))); wantEye = vmul(n, 82); wantTarget = [0, 0, 0]; wantUp = vmul(f, -1); }
    else { wantEye = vadd(player.position, vadd(vmul(player.n, zoom * pitch + 1.6), vmul(forward, -zoom))); wantTarget = vadd(player.position, vadd(vmul(player.n, 1.35), vmul(forward, 1.3))); wantUp = player.n; }
    const walkingCamera = (mode === 'play' && !life.music) || mode === 'paused';
    const pivot = vadd(player.position, vmul(player.n, 1.42));
    if (walkingCamera) { const hit = world.surfaces.rayFraction(pivot, wantEye, .24); if (hit < 1) wantEye = mixv(pivot, wantEye, Math.max(.035, hit - .025)); }
    const smooth = cameraCut ? 1 : 1 - Math.exp(-dt * (mode === 'title' ? 2 : 7)); cameraCut = false;
    cameraEye = mixv(cameraEye, wantEye, smooth); cameraTarget = mixv(cameraTarget, wantTarget, smooth); cameraUp = norm(mixv(cameraUp, wantUp, smooth)); cameraShift = lerp(cameraShift, shift, smooth); cameraYShift = lerp(cameraYShift, yshift, smooth);
    if (walkingCamera) { const hit = world.surfaces.rayFraction(pivot, cameraEye, .22); if (hit < 1) cameraEye = mixv(pivot, cameraEye, Math.max(.03, hit - .02)); }
    const fov = mode === 'mural' ? 2 * Math.atan(Math.tan(24 * Math.PI / 180) * Math.max(1, 1 / aspect)) : mode === 'cinema' ? 2 * Math.atan(Math.tan(24 * Math.PI / 180) * Math.max(1, .84 / aspect)) : 48 * Math.PI / 180;
    let sun = mode === 'title' ? norm([-.45, 1, -.65]) : norm(vadd(vadd(vmul(player.n, 1.4), vmul(forward, -.65)), vmul(norm(cross(player.n, forward)), -.6)));
    if (mode === 'machine') sun = norm([1.2, 1.7, -.6]);
    if (mode === 'courier') sun = norm(vadd(vadd(vmul(player.n, 1.4), vmul(facing, .85)), vmul(right, -.55)));
    view.eye = cameraEye; view.target = cameraTarget; view.up = cameraUp; view.fov = fov; view.shift = cameraShift; view.yshift = cameraYShift; view.sun = sun;
    view.focus = mode === 'title' ? [0, 10, 0] : player.position; view.focusUp = mode === 'title' ? [0, 0, 1] : forward;
    view.shadows = detail && mode !== 'title' && mode !== 'overview';
    renderer.setDynamic(world.dynamics); renderer.render(view);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) return; input.reset(); audio.pause(true); save(); if (mode === 'play') setMode('paused'); });
  kit.onPause(p => { if (p) { audio.pause(true); input.reset(); } });
  addEventListener('pagehide', save); addEventListener('beforeunload', save);
  if (new URLSearchParams(location.search).has('test')) window.__ORBIT__ = { kit, world, player, state, renderer, input, ui, journey, life, craft, audio, pocketFilm, startFilm, courier, courierMotion, cups, tray, trailPin, action, interact, home, save, get trailer() { return getTrailer(); }, get zoom() { return zoom; }, get pitch() { return pitch; }, get brew() { return brew; }, get busy() { return busy; }, get film() { return film; }, get mode() { return mode; }, get nearest() { return nearest?.id || null; }, get forward() { return forward; }, get time() { return time; }, at(u, v, h) { const n = normalAt(u, v); player.setAt(n, h == null ? world.surfaces.floorHeight(n, 8) : h); forward = projectTangent([0, 0, 1], player.n); player.facing = [...forward]; cameraCut = true; }, orient(v) { forward = projectTangent(v, player.n); } };

  kit.loading.progress(.95, 'Warming the cups…');
  // Build every pipeline before the first frame, so the walk starts without a hitch.
  frame(0);
  try { await kit.renderer.compileAsync(renderer.scene, renderer.camera); } catch (err) { console.warn('Precompile skipped:', err); }
  kit.start(frame);
  kit.loading.done();
  $('start').focus({ preventScroll: true });
}

startApp().catch(error => {
  console.error(error);
  // A graphics failure is explained on the kit's own loading card. Anything later
  // (a missing file) lifts that card so the game's message can be read.
  if (!started) return;
  started.loading.done();
  $('error-message').textContent = error?.message || String(error);
  $('error').hidden = false;
});
