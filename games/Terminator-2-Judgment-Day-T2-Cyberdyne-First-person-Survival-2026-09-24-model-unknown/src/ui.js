/* The DOM overlay: title, HUD, pause/results box, settings panel. Writes only what changed. */
import { VEHICLES, OFFICERS, DIFFICULTIES, wavePlan } from './waves.js';
import { VisionUI } from './vision.js';

const pad = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

const CONTROLS = {
  keyboard: [['W A S D', 'Move'], ['MOUSE', 'Aim / fire'], ['RMB', 'Zoom'], ['TAB', 'T-800 vision'], ['Q', 'Lock'], ['C', 'Cover'], ['G', 'Tear gas'], ['R', 'Restart'], ['ESC / P', 'Pause']],
  gamepad: [['L STICK', 'Move'], ['R STICK', 'Aim'], ['RT', 'Fire'], ['LT', 'Zoom'], ['Y', 'Vision'], ['RB', 'Lock'], ['B', 'Cover'], ['LB', 'Tear gas'], ['START', 'Pause']],
  touch: [],
};
const HELP = {
  keyboard: 'Mouse aims, left click fires. Hold right click (or K) to zoom. W A S D or the arrow keys move, Shift sprints, C crouches behind cover. Tab or V: T-800 vision. Scan a vehicle, press Q to lock it, then hold right click to assist aim. G fires M79 tear gas. F5 saves a checkpoint, F8 loads it, M mutes, F9 opens graphics settings.',
  gamepad: 'Left stick moves (click it to sprint), right stick aims. RT or X fires, LT zooms and assists aim. B crouches behind cover. Y toggles T-800 vision, RB locks a scanned vehicle. LB fires M79 tear gas. Start pauses, Back restarts.',
  touch: 'Left thumb moves; drag on the right half to aim. Fire, Aim, Cover and Gas sit on the right; Lock appears while T-800 vision is on. Vision and pause are the pills at the top.',
};
const VISION_LABEL = { keyboard: 'TAB / VISION', gamepad: 'Y / VISION', touch: 'VISION' };
const GAS_KEY = { keyboard: 'G', gamepad: 'LB', touch: 'GAS' };

export class HUD {
  constructor(root) {
    this.root = root;
    const q = (s) => root.querySelector(s), id = (s) => root.querySelector('#t2-' + s);
    this.q = q;
    this.id = id;
    this.E = {
      intro: q('.t2-intro'), warning: q('.t2-warning'), bottom: q('.t2-bottom'), playhud: q('.t2-playhud'), pause: q('.t2-pause'), pauseBox: q('.t2-pause-box'),
      settings: q('.t2-settings-panel'), toast: q('.t2-toast'), result: q('.t2-result'), damage: q('.t2-damage'), reticle: q('.t2-reticle'), message: q('.t2-message'),
      demo: q('.t2-demo-label'), objLabel: q('.t2-objective .t2-label'), objTitle: q('.t2-objective h2'), objText: q('.t2-objective p'), banner: q('.t2-wave-banner'),
      visionPanel: q('.t2-vision-panel'), visionStatus: q('.t2-vision-status'), controls: id('controls'),
      carCount: id('car-count'), safeCount: id('safe-count'), safeBar: id('safe-bar'), health: id('health'), healthBar: id('health-bar'), ammo: id('ammo'),
      heatBar: id('heat-bar'), heatLabel: id('heat-label'), gas: id('gas'), gasRow: id('gas-row'), gasKey: id('gas-key'), visionButton: id('vision-button'),
      waveState: id('wave-state'), waveScore: id('wave-score'), waveLive: id('wave-live'), breakLabel: id('break-label'), breakTitle: id('break-title'), breakText: id('break-text'),
      alert: id('threat-alert'), vTarget: id('v-target'), vClass: id('v-class'), vRange: id('v-range'), vState: id('v-state'), vCondition: id('v-condition'),
      vAnalysis: id('v-analysis'), vProgress: id('v-progress'), vHelp: id('v-help'), vLock: id('v-lock-state'),
      pauseButton: id('pause-button'), resume: id('resume'), retry: id('retry'), save: id('save'), load: id('load'), kicker: id('pause-kicker'), pauseTitle: id('pause-title'),
      pauseText: id('pause-text'), pauseHelp: id('pause-help'), resultWave: id('result-wave'), resultScore: id('result-score'), resultCars: id('result-cars'), resultSafe: id('result-safe'),
      resultTime: id('result-time'), resultAcc: id('result-acc'), resultBest: id('result-best'), continueBtn: id('continue'), difficulty: id('difficulty'), difficultyText: id('difficulty-text'), best: id('best'),
      featureKey: id('feature-key'), settingsHelp: id('settings-help'), mute: id('mute'),
    };
    this.vision = new VisionUI(q('.t2-machine-layer'), this.E.visionPanel);
    this.toastTimer = 0;
    this.source = '';
    this.hasBegun = false;
    this.nextPlan = null;
  }

  /* cached DOM writes */
  show(el, v) {
    v = !!v;
    if (el._shown !== v) { el._shown = v; el.classList.toggle('t2-hide', !v); }
  }
  text(el, v) {
    v = String(v);
    if (el._t !== v) { el._t = v; el.textContent = v; }
  }
  html(el, v) {
    if (el._h !== v) { el._h = v; el.innerHTML = v; }
  }
  width(el, pct) {
    const v = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
    if (el._w !== v) { el._w = v; el.style.width = v; }
  }
  cls(el, name, on) {
    on = !!on;
    const k = '_c_' + name;
    if (el[k] !== on) { el[k] = on; el.classList.toggle(name, on); }
  }

  toast(t) {
    this.text(this.E.toast, t);
    this.show(this.E.toast, true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.show(this.E.toast, false), 4000);
  }

  /** Button prompts follow the last device used. */
  setSource(src) {
    if (src === this.source) return;
    this.source = src;
    const E = this.E;
    E.controls.innerHTML = (CONTROLS[src] || []).map(([k, label]) => `<span><kbd>${k}</kbd>${label}</span>`).join('');
    this.text(E.settingsHelp, HELP[src] || HELP.keyboard);
    this.text(E.pauseHelp, HELP[src] || HELP.keyboard);
    this.text(E.featureKey, src === 'gamepad' ? 'Y' : src === 'touch' ? 'EYE' : 'TAB');
    this.text(E.visionButton, VISION_LABEL[src] || VISION_LABEL.keyboard);
    this.text(E.gasKey, GAS_KEY[src] || 'G');
    this.cls(this.root, 't2-pad', src === 'gamepad');
    E.visionButton._t = null; // the per-frame label below re-applies ON/OFF
  }

  setMute(muted) {
    this.text(this.E.mute, muted ? 'SOUND OFF' : 'SOUND ON');
  }

  /**
   * s: { status: 'title'|'play'|'paused'|'failed', pauseKind, hasBegun, game, checkpoint, best, difficulty, newBest }
   */
  setMode(s) {
    const E = this.E, e = s.game, failed = s.status === 'failed', title = s.status === 'title';
    this.hasBegun = s.hasBegun;
    this.cls(this.root, 't2-live', s.hasBegun && !title);
    this.cls(this.root, 't2-hide-reticle', failed);
    this.show(E.intro, title);
    this.show(E.warning, title);
    this.show(E.bottom, title);
    this.show(E.playhud, s.hasBegun && !title);
    this.show(E.pause, s.status === 'paused' || failed);
    this.show(E.pauseButton, s.status === 'play');
    this.show(E.result, failed);
    this.show(E.resume, !failed);
    this.show(E.retry, failed && !!s.checkpoint);
    this.show(E.save, !failed && !e?.demo && s.hasBegun);
    this.show(E.load, !!s.checkpoint);
    this.show(E.demo, !!e?.demo && !title);
    const checkpoint = s.pauseKind === 'checkpoint';
    this.text(E.kicker, failed ? 'SYSTEM OFFLINE' : checkpoint ? 'CHECKPOINT READY' : 'SIMULATION PAUSED');
    this.text(E.pauseTitle, failed ? 'T-800 disabled.' : checkpoint ? (e.wave ? `Wave ${e.wave} restored.` : 'Scene restored.') : 'Scene paused.');
    this.text(
      E.pauseText,
      failed
        ? `Wave ${e.wave}. Score ${e.score.toLocaleString()}. ${e.wavesCleared} waves cleared, ${e.totalSafe} officers withdrawn safely.` + (s.checkpoint ? ' Retry from your last checkpoint or restart.' : ' Restart to play again.')
        : 'Resume to continue from this position.'
    );
    if (failed) {
      this.text(E.resultWave, e.wave);
      this.text(E.resultScore, e.score.toLocaleString());
      this.text(E.resultCars, e.totalVehicles);
      this.text(E.resultSafe, e.totalSafe);
      this.text(E.resultTime, formatTime(e.time));
      this.text(E.resultAcc, e.shots ? Math.round((e.hits / e.shots) * 100) + '%' : '—');
    }
    const diff = DIFFICULTIES[s.difficulty] || DIFFICULTIES.terminator;
    const best = s.best?.[diff.id];
    this.text(E.resultBest, failed ? (s.newBest ? `NEW BEST / ${diff.name.toUpperCase()}` : best ? `BEST / ${best.score.toLocaleString()} / WAVE ${best.wave}` : '') : '');
    this.show(E.continueBtn, title && !!s.checkpoint);
    if (s.checkpoint) this.text(E.continueBtn, s.checkpoint.label);
    this.text(E.difficulty, `Difficulty / ${diff.name}`);
    this.text(E.difficultyText, diff.blurb);
    this.text(E.best, best ? `BEST ON ${diff.name.toUpperCase()} / ${best.score.toLocaleString()} POINTS / ${best.wave} WAVES CLEARED` : '');
  }

  /** The live HUD, every frame while a run is on screen. */
  frame(e, now, key) {
    if (!this.hasBegun) return;
    const E = this.E;
    let disabled = 0, safe = 0;
    for (const c of e.cars) if (c.disabled) disabled++;
    for (const o of e.officers) if (o.safe) safe++;
    this.html(E.carCount, pad(disabled) + ' <small>/ ' + pad(e.cars.length) + '</small>');
    this.text(E.safeCount, 'OFFICERS WITHDRAWN / ' + pad(safe) + ' OF ' + e.officers.length);
    this.width(E.safeBar, (safe / Math.max(1, e.officers.length)) * 100);
    this.text(E.health, Math.ceil(e.integrity));
    this.width(E.healthBar, e.integrity);
    this.text(E.ammo, e.ammo);
    this.width(E.heatBar, e.heat);
    this.text(E.heatLabel, e.overheated ? 'COOLING' : 'HEAT');
    this.text(E.gas, e.gasRounds);
    this.cls(E.gasRow, 'is-empty', e.gasRounds === 0);
    this.cls(E.gasRow, 'is-cooling', e.gasCooldown > 0 && e.gasRounds > 0);
    const hurt = Math.min(0.85, e.hurt * 3).toFixed(2);
    if (E.damage._o !== hurt) { E.damage._o = hurt; E.damage.style.opacity = hurt; }
    this.cls(this.root, 'scanner', e.scan);
    this.cls(E.visionButton, 'vision-on', e.scan);
    const vl = VISION_LABEL[this.source] || VISION_LABEL.keyboard;
    this.text(E.visionButton, e.scan ? vl + ' ON' : vl);
    this.show(E.visionPanel, e.scan);
    this.show(E.visionStatus, e.scan);
    this.cls(E.reticle, 'hit', e.hit > 0);
    this.cls(E.reticle, 'safe', e.heldSafe);
    const msg = e.heldSafe ? 'HUMAN DETECTED / FIRE BLOCKED' : e.overheated ? 'BARRELS COOLING / RELEASE FIRE' : e.beltTimer > 0 ? 'FEEDING NEW BELT' : e.messageTime > 0 ? e.message : disabled === e.cars.length && e.phase !== 'intermission' ? 'HOLD FIRE / OFFICERS WITHDRAWING' : '';
    this.text(E.message, msg);
    this.show(E.message, !!msg && !e.failed);
    this.show(E.demo, e.demo);
    const between = e.phase === 'intermission', plan = e.currentPlan;
    this.text(E.objLabel, e.wave === 0 ? 'SCENE 01 / ORIGINAL STANDOFF' : `WAVE ${pad(e.wave)} / ${(plan?.name || 'POLICE RESPONSE').toUpperCase()}`);
    this.text(E.objTitle, between ? 'Police line clear.' : e.wave === 0 ? 'Clear the police line.' : 'Hold the balcony.');
    this.text(E.objText, e.wave === 0 ? 'Disable the vehicles. Let the officers withdraw.' : 'Disable each vehicle. Suppress or gas the officers. Use cover.');
    this.text(E.waveState, between ? 'NEXT WAVE / ' + Math.ceil(e.intermission) + ' S' : e.wave === 0 ? 'SCENE 01' : `WAVE ${e.wave} / ENDLESS`);
    this.text(E.waveScore, 'SCORE / ' + e.score.toLocaleString());
    this.text(E.waveLive, e.lit ? 'IN SEARCHLIGHT' : e.inCover ? 'COVER POSITION' : e.cars.length - disabled + ' VEHICLES ACTIVE');
    this.show(E.banner, between && !e.failed);
    if (between) {
      if (!this.nextPlan || this.nextPlan.number !== e.wave + 1) this.nextPlan = wavePlan(e.wave + 1);
      this.text(E.breakLabel, e.wave === 0 ? 'ORIGINAL SCENE COMPLETE / NO CASUALTIES' : `WAVE CLEAR / SYSTEM REPAIR +${e.diff.repair}% / AMMO AND GAS REFILLED`);
      this.text(E.breakTitle, 'WAVE ' + (e.wave + 1) + ' IN ' + Math.ceil(e.intermission));
      this.text(E.breakText, this.nextPlan.notice);
    }
    const warning = e.integrity < 25 ? 'SYSTEM DAMAGE / MOVE TO COVER' : e.warning;
    this.text(E.alert, warning);
    this.show(E.alert, !!warning && !between && !e.failed);
    if (e.scan) {
      const unit = e.focus, known = unit && e.identified.has(unit.data.id), human = unit?.kind === 'human';
      this.text(E.vTarget, e.scanBoot ? 'VISION STARTING' : unit ? (human ? OFFICERS[unit.officerType].name : VEHICLES[unit.vehicleType].name).toUpperCase() : 'SEARCHING');
      this.text(E.vClass, unit ? (human ? 'HUMAN' : unit.vehicleType === 'helicopter' ? 'AIR VEHICLE' : 'GROUND VEHICLE') : '—');
      if (unit) {
        const c = e.center(unit), eye = e.eye();
        this.text(E.vRange, Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]).toFixed(1) + ' M');
      } else this.text(E.vRange, '—');
      this.text(E.vState, unit ? (human ? (unit.mode === 'run' ? 'WITHDRAWING' : unit.charge > 0 ? 'AIMING' : 'ACTIVE') : unit.disabled ? 'DISABLED' : unit.vehicleType === 'helicopter' ? 'TRACKING' : unit.arrived ? 'IN POSITION' : 'APPROACHING') : '—');
      this.text(E.vCondition, unit ? (human ? 'PROTECTED' : known ? Math.ceil((unit.hp / unit.maxHP) * 100) + '%' : 'SCANNING') : '—');
      const pct = known ? 100 : Math.round((e.focusTime / 0.65) * 100);
      this.text(E.vAnalysis, known ? 'ANALYSIS COMPLETE' : unit ? 'ANALYSIS / ' + pct + '%' : 'WAITING FOR TARGET');
      this.width(E.vProgress, pct);
      this.text(
        E.vHelp,
        human
          ? `Human protection is active. Fire and target lock are blocked. Tear gas (${key('gas')}) makes officers withdraw.`
          : unit?.disabled
            ? 'Vehicle disabled. Select another target.'
            : e.lockID
              ? `Target lock is active. Hold ${key('aim')} to assist aim.`
              : known
                ? `Drive module identified: 2.35× damage. Press ${key('lock')} to lock this vehicle.`
                : 'Keep a vehicle in the reticle to scan its drive module.'
      );
      this.text(E.vLock, e.lockID ? 'TARGET LOCK / ACTIVE' : 'TARGET LOCK / NONE');
    }
    this.vision.draw(e, now);
  }
}
