/**
 * main.js — Brick Bowl Turbo on the shared 3D kit.
 *
 * boot() starts WebGPU (WebGL2 fallback), loads Rapier 0.20, sizes the canvas,
 * wires keyboard / gamepad / touch into kit.input and runs the loop. The game
 * keeps its own fixed 60 Hz simulation step, menus, HUD and match flow.
 */
import { boot } from "kit/boot.js";
import { AudioEngine } from "./audio.js";
import { DEFAULT_SETTINGS, DIFFICULTY, PHYS } from "./config.js";
import { Effects } from "./fx.js";
import { ACTIONS, Controls } from "./input.js";
import { Match } from "./match.js";
import { Physics, setRapier } from "./physics.js";
import { CameraRig, Graphics, buildStadium } from "./scene.js";
import { TEAMS } from "./teams.js";
import { UI } from "./ui.js";

export function loadSettings() {
  let s = { ...DEFAULT_SETTINGS };
  try {
    let e = localStorage.getItem(`brickbowl-settings`);
    if (e) s = { ...s, ...JSON.parse(e) };
  } catch {
    /* blocked storage or bad JSON: defaults */
  }
  // A damaged save must not break the CPU (DIFFICULTY lookups) or the clock.
  if (!DIFFICULTY[s.difficulty]) s.difficulty = DEFAULT_SETTINGS.difficulty;
  if (![2, 3, 5, 8, 15].includes(s.quarterMinutes)) s.quarterMinutes = DEFAULT_SETTINGS.quarterMinutes;
  for (const k of [`penalties`, `announcer`, `music`, `sfx`, `bloom`]) s[k] = s[k] !== false;
  return s;
}
export function saveSettings(e) {
  try {
    localStorage.setItem(`brickbowl-settings`, JSON.stringify(e));
  } catch {
    /* blocked storage */
  }
}

const kit = await boot({
  title: `Brick Bowl Turbo`,
  physics: true,
  input: ACTIONS,
  gear: `none`, // SETTINGS → GRAPHICS & CONTROLS (and the pause menu) open the kit panel; F9 works anywhere
  touch: { top: `right`, topOffset: 12 },
  accent: `#ffd23f`,
  background: `#0b0620`,
});
setRapier(kit.RAPIER);

const params = new URLSearchParams(location.search);
const gr = new Graphics();
gr.init(kit);
kit.loading.progress(0.7, `Laying bricks for the stadium…`);
const stadium = buildStadium(gr.scene, TEAMS);
const fx = new Effects(gr.scene);
fx.detail = kit.tier.detail;
kit.onQuality((tier) => (fx.detail = tier.detail));
const rig = new CameraRig(gr.camera);
const physics = new Physics();
const audio = new AudioEngine();
const controls = new Controls(kit);
const ui = new UI(controls, audio);
const settings = loadSettings();
kit.loading.progress(0.85, `Suiting up the rosters…`);
const match = new Match(gr, rig, stadium, fx, physics, audio, controls, ui, settings);
window.__game = match;
match.applySettings(); // saved MUSIC/SOUND/ANNOUNCER/BLOOM choices apply on the menus too

// Browsers only start audio from a gesture: the first key, click or tap unlocks it.
const unlock = () => audio.unlock();
for (const ev of [`pointerdown`, `keydown`, `touchend`])
  addEventListener(ev, unlock, { capture: true, passive: true });
controls.whenAnyInput(unlock);

ui.openKitMenu = () => kit.menu.open();
ui.onPauseRequest = () => match.openPause();
kit.onPause((paused) => audio.hold(paused));
// Touch pills sit top-right; on narrow portrait screens they drop below the scorebug and down marker.
kit.onResize((w) => kit.touch?.placeTop(`right`, w < 700 ? 100 : 12));
// Leaving the tab mid-game opens the pause menu, so nobody comes back to a blown play.
document.addEventListener(`visibilitychange`, () => {
  if (document.hidden && match.inMatch && !match.paused) match.openPause();
  audio.hold(document.hidden || kit.paused); // no crowd noise from a background tab
});

// Compile the player, field and stadium pipelines up front so the first snap does not hitch.
try {
  kit.loading.progress(0.92, `Warming up…`);
  // Dress one player per side in a numbered jersey so that material variant compiles now too.
  match.squads.forEach((squad, team) => squad[0].bind(TEAMS[team].roster[0]));
  for (const squad of match.squads) for (const p of squad) p.model.root.visible = true;
  match.ball.mesh.visible = true;
  await kit.renderer.compileAsync(gr.scene, gr.camera);
} catch (err) {
  console.warn(`[brick-bowl] pipeline warm-up skipped:`, err);
} finally {
  for (const squad of match.squads) for (const p of squad) p.model.root.visible = p.active;
}

// ---- the loop: input → menus → fixed 60 Hz simulation → camera/effects → render
const sim = Math.max(1, Math.min(8, Number(params.get(`sim`)) || 1)); // QA fast-forward (?sim=4)
let acc = 0;
let touchOn = null;
let timeoutPill = null;
function syncTouch() {
  if (!kit.touch) return;
  // On-screen controls only during play; menus, dialogs and play select are tapped directly.
  const want = match.inMatch && !match.paused && ui.hud.shown && !ui.hasScreen();
  if (want !== touchOn) {
    touchOn = want;
    kit.touch.suspend(!want, `game`);
  }
  const s = match.session;
  const to = !!s && s.phase === `presnap` && s.setup.kind === `scrimmage` && match.mode !== `cpu`;
  if (to !== timeoutPill) {
    timeoutPill = to;
    kit.touch.setShown(`timeout`, to);
  }
}
kit.start((dt) => {
  controls.poll();
  const stepDt = PHYS.DT;
  const realDt = sim > 1 ? stepDt * sim : dt;
  ui.update(realDt);
  const scale = match.updateTimeScale(dt);
  acc += realDt * scale;
  let steps = 0;
  while (acc >= stepDt && steps < 6 * sim) {
    match.step(stepDt);
    acc -= stepDt;
    steps++;
  }
  if (steps > 0) controls.endStep();
  if (acc > stepDt * 6 * sim) acc = 0;
  match.frame(match.paused ? 0 : realDt); // the game's own pause menu freezes the scene too
  syncTouch();
  gr.render();
});

// ---- menus and matches
const backendTag = kit.backend === `webgpu` ? `WebGPU` : `WebGL2`;
const MENU = [`1p`, `2p`, `challenges`, `cpu`, `rosters`, `records`, `howto`, `settings`];

async function playExhibition(mode) {
  let team;
  try {
    team = (await ui.teamSelect(mode, settings)).p1Team;
  } catch {
    return; // BACK from team select
  }
  saveSettings(settings);
  match.settings = settings;
  match.challenge = null;
  match.configure(mode, team);
  audio.playMusic(null);
  while ((await match.playMatch()) === `again`);
  controls.setTwoPlayer(false);
}

let lastChallenge = { team: 0, id: null };
async function playChallenges() {
  for (;;) {
    const pick = await ui.challengesMenu(settings, lastChallenge);
    saveSettings(settings);
    if (!pick) return;
    lastChallenge = { team: pick.team, id: pick.challenge.id };
    match.settings = settings;
    match.challenge = pick.challenge;
    match.challengeTeam = pick.team;
    match.configure(`1p`, pick.team);
    audio.playMusic(null);
    while ((await match.playMatch()) === `again`);
    match.challenge = null;
  }
}

async function run() {
  const auto = params.get(`auto`); // QA: ?auto=cpu plays CPU vs CPU matches back to back
  if (auto) {
    window.__auto = true;
    settings.quarterMinutes = Number(params.get(`q`) ?? 2);
    settings.announcer = false;
    match.settings = settings;
    match.configure(auto === `1p` ? `1p` : auto === `2p` ? `2p` : `cpu`, 0);
    for (;;) await match.playMatch();
  }
  await ui.title(backendTag);
  audio.unlock();
  let menuIndex = 0;
  for (;;) {
    const choice = await ui.mainMenu(backendTag, menuIndex);
    menuIndex = Math.max(0, MENU.indexOf(choice));
    if (choice === `rosters`) await ui.rosters();
    else if (choice === `records`) await ui.records();
    else if (choice === `howto`) await ui.howTo();
    else if (choice === `settings`) {
      await ui.settingsMenu(settings);
      saveSettings(settings);
      match.applySettings();
    } else if (choice === `challenges`) await playChallenges();
    else await playExhibition(choice);
  }
}

run().catch((err) => {
  console.error(err);
  const pre = document.createElement(`pre`);
  pre.style.cssText = `position:fixed;inset:auto 12px 12px 12px;z-index:99;color:#fff;background:#300a;padding:12px;border-radius:8px;white-space:pre-wrap;font:12px monospace`;
  pre.textContent = `Brick Bowl hit an error: ${err?.message || err}`;
  document.body.appendChild(pre);
});
