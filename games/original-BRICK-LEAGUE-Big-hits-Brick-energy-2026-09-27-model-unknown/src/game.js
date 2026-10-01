import { BaseballRules } from './rules.js';
import { BallPhysics } from './physics.js';
import { TEAMS, getPlayer, slugger, derbyRivals } from './teams.js';
import { v3, clamp, lerp, distance, moveToward, seeded, BASES, FAIR, WALL, landing, feet } from './math.js';

export const DEFAULT_OPTIONS = { team: 1, innings: 9, difficulty: 'rookie', mode: 'arcade', assist: true, sound: true, reducedMotion: false, ghostRunner: false };
export const MODES = ['arcade', 'derby', 'practice', 'spectator'];
export const PITCH_TYPES = ['HEAT', 'CURVE', 'CHANGE', 'SLIDER'];
/** Home Run Derby: outs per round, and a moonshot this long (in feet) earns an out back. */
export const DERBY_OUTS = 10;
export const DERBY_BONUS_FT = 480;
const FIELD_SPOTS = [[0, 0, -59], [1, -12, -32], [3, 21, -21], [4, 37, -49], [5, -21, -21], [6, -37, -49], [7, 0, 3.2], [8, 12, -32], [-1, 0, -15.2]];
const MAX_PARTICLES = 420;
/** The one broadcast view every frame reports (the renderer owns the actual camera). */
const BROADCAST = Object.freeze({ eye: v3(91, 89, 108), at: v3(0, 0, -35), fov: 43 });
/**
 * Screen directions on the ground under the broadcast camera, so the stick moves a fielder
 * the way it points on screen (the camera looks in from the first-base side, so raw world
 * axes ran diagonally across the screen).
 */
const SCREEN_FWD = (() => {
  const x = BROADCAST.at.x - BROADCAST.eye.x;
  const z = BROADCAST.at.z - BROADCAST.eye.z;
  const l = Math.hypot(x, z);
  return { x: x / l, z: z / l };
})();
const SCREEN_RIGHT = { x: -SCREEN_FWD.z, z: SCREEN_FWD.x };
/** Contact window (seconds either side of the sweet spot) and base pitch time, per difficulty. */
const SWING_WINDOW = { rookie: 0.28, pro: 0.22, legend: 0.18 };
const PITCH_TIME = { rookie: 1.7, pro: 1.32, legend: 1.02 };
const NO_RUNNERS = Object.freeze([null, null, null]);

export class ArcadeGame {
  constructor() {
    this.rules = new BaseballRules();
    this.options = { ...DEFAULT_OPTIONS };
    this.phase = 'attract';
    this.phaseTime = 0;
    this.time = 0;
    this.paused = false;
    this.physics = new BallPhysics();
    this.heat = [40, 40];
    this.streak = [0, 0];
    this.powerArmed = false;
    this.pitchType = 'HEAT';
    this.aim = v3(0, 1.9, 0);
    this.loft = 0;
    this.spray = 0;
    this.pitchDuration = 1.75;
    this.pitchProgress = 0;
    this.pitchTarget = v3(0, 1.9, 0.2);
    this.pitchVelocity = 98;
    this.pitchPower = false;
    this.swingAt = null;
    this.swingMode = 'normal';
    this.ball = null;
    this.trail = [];
    this.particles = [];
    this.selected = 8;
    this.manualTimer = 0;
    this.diveTimer = 0;
    this.aggression = 0;
    this.stealArmed = false;
    this.stealMessage = '';
    this.throwBase = 1;
    this.practice = { pitches: 0, hits: 0, hr: 0, best: 0 };
    this.lastDistance = 0;
    this.lastQuality = 0;
    this.lastPitch = '';
    this.lastPlay = 'PLAY BALL!';
    this.replay = false;
    this.replayTime = 0;
    this.seed = Date.now() >>> 0;
    this.rng = seeded(this.seed);
    this.fielders = [];
    this.live = null;
    this.resultDuration = 1.8;
    this.aiSwingAt = null;
    this.trailClock = 0;
    this.emitClock = 0;
    this.replayFrames = [];
    this.replayStored = [];
    this.recordClock = 0;
    this.currentHalf = '';
    /** Analog aim/run input from kit.input, -1..1 each axis (y is up/forward). */
    this.move = { x: 0, y: 0 };
    /** Particle count multiplier from the quality tier (kit.detail). */
    this.particleScale = 1;
    this.derby = null;
    this.golden = false;
    this.onEvent = () => {};
    this.onSound = () => {};
    this.onChange = () => {};
    this.onSave = () => {};
    this.onFinish = () => {};
    // What frame() hands the renderer each frame, reused (the replay keeps its own copies).
    this.figPool = [];
    this.figs = [];
    this.view = { time: 0, camera: BROADCAST, figures: this.figs, ball: null, trail: null, power: false, golden: false, powerColor: '#ffffff', particles: null, target: null, selectedBase: 1 };
    this.viewTarget = v3();
    this.viewAim = { spray: 0, loft: 0 };
    this.resetField();
  }

  get derbyMode() {
    return this.options.mode === 'derby';
  }
  get batting() {
    return this.rules.offense === this.options.team && this.options.mode !== 'spectator';
  }
  get humanPitching() {
    return this.rules.defense === this.options.team && this.options.mode !== 'spectator' && this.options.mode !== 'practice' && this.options.mode !== 'derby';
  }
  /** The ball is in play and the player controls the defense. */
  get fielding() {
    return this.phase === 'live' && this.humanPitching;
  }
  get inPlay() {
    return this.phase !== 'attract' && this.phase !== 'finished';
  }
  get derbyTarget() {
    return this.derby ? this.derby.targets[this.derby.round] : 0;
  }
  get derbyRival() {
    return this.derby ? getPlayer(1 - this.options.team, this.derby.rivals[this.derby.round]) : null;
  }
  /**
   * The stretch of the timing bar where a normal swing makes contact, as fractions of the
   * pitch (the sweet spot is at 0.94). Slow pitches and harder levels shrink it; before the
   * pitch it shows a fastball's.
   */
  get swingWindow() {
    const win = SWING_WINDOW[this.options.difficulty] ?? SWING_WINDOW.rookie;
    const dur = this.phase === 'pitch' ? this.pitchDuration : (PITCH_TIME[this.options.difficulty] ?? PITCH_TIME.rookie) * (this.derbyMode ? 1.12 : 1);
    const half = win / dur;
    return { from: clamp(0.94 - half, 0, 1), to: clamp(0.94 + half, 0, 1) };
  }

  refreshPlayers() {
    const side = this.rules.defense;
    for (const f of this.fielders) f.player = f.slot < 0 ? getPlayer(side, this.rules.state.teams[side].pitcher) : getPlayer(side, this.rules.state.teams[side].lineup[f.slot]);
  }

  get status() {
    if (this.phase === 'attract') return 'WELCOME TO SUNSET PARK';
    if (this.phase === 'finished') return 'FINAL';
    if (this.replay) return 'INSTANT REPLAY';
    if (this.derbyMode) return this.phase === 'live' ? 'GET UP, GET OUT!' : this.phase === 'pitch' ? 'TIME YOUR SWING' : `HOME RUN DERBY • ROUND ${this.derby.round + 1}`;
    if (this.phase === 'live') return this.batting ? 'BALL IN PLAY' : 'MAKE THE PLAY';
    if (this.phase === 'pitch') return this.batting ? 'TIME YOUR SWING' : 'DEALING';
    return this.batting ? 'YOU’RE AT BAT' : 'YOU’RE ON THE MOUND';
  }

  /** Clear everything that belongs to one match, so a rematch or a restore starts clean. */
  clearPlay() {
    this.physics.stop();
    this.paused = false;
    this.replay = false;
    this.replayTime = 0;
    this.replayStored = [];
    this.replayFrames = [];
    this.powerArmed = false;
    this.stealArmed = false;
    this.particles.length = 0;
    this.trail = [];
    this.ball = null;
    this.live = null;
    this.lastDistance = 0;
    this.lastPlay = 'PLAY BALL!';
    this.streak = [0, 0];
    this.practice = { pitches: 0, hits: 0, hr: 0, best: 0 };
    this.derby = null;
    this.golden = false;
    this.diveTimer = 0;
    this.manualTimer = 0;
  }

  start(options, seed = Date.now() >>> 0) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rules = new BaseballRules(this.options.innings, this.options.ghostRunner);
    this.seed = seed;
    this.rng = seeded(seed);
    this.heat = [40, 40];
    this.clearPlay();
    if (this.options.mode === 'practice' || this.derbyMode) this.rules.state.half = this.options.team;
    if (this.derbyMode) this.setupDerby();
    this.currentHalf = `${this.rules.state.inning}-${this.rules.state.half}`;
    this.ready();
    if (this.derbyMode) {
      const rival = this.derbyRival;
      this.onEvent({ title: 'HOME RUN DERBY!', subtitle: `ROUND 1 • ${rival.name.toUpperCase()} HIT ${this.derbyTarget} • BEAT IT`, kind: 'inning' });
    } else this.onEvent({ title: 'PLAY BALL!', subtitle: this.options.mode === 'practice' ? 'BATTING PRACTICE • LET IT FLY' : 'SUNSET PARK • A WHOLE NEW BALL GAME', kind: 'inning' });
    this.save();
  }

  restore(save) {
    if (save.version !== 1) throw new Error('This save version is not supported.');
    const rules = new BaseballRules(save.options.innings, save.options.ghostRunner, save.rules);
    this.rules = rules;
    this.options = { ...DEFAULT_OPTIONS, ...save.options, mode: 'arcade' };
    this.heat = Array.isArray(save.heat) && save.heat.length === 2 ? save.heat.map((n) => clamp(Number(n) || 0, 0, 100)) : [40, 40];
    this.seed = save.seed >>> 0;
    this.rng = seeded(this.seed + this.rules.state.playLog.length);
    this.clearPlay();
    this.currentHalf = `${this.rules.state.inning}-${this.rules.state.half}`;
    if (this.rules.state.finished) this.phase = 'finished';
    else this.ready();
    this.onChange();
  }

  save() {
    if (this.options.mode === 'arcade' && this.phase !== 'attract') this.onSave({ version: 1, rules: this.rules.snapshot(), options: { ...this.options }, heat: [...this.heat], seed: this.seed });
  }

  menu() {
    this.clearPlay();
    this.phase = 'attract';
    this.resetField();
    this.onChange();
  }

  resetField() {
    const side = this.phase === 'attract' ? 0 : this.rules.defense;
    this.fielders = FIELD_SPOTS.map(([slot, x, z]) => ({
      p: v3(x, 0, z),
      home: v3(x, 0, z),
      player: slot < 0 ? getPlayer(side, this.rules.state.teams[side].pitcher) : getPlayer(side, this.rules.state.teams[side].lineup[slot]),
      slot,
      motion: 0,
    }));
    this.selected = 8;
  }

  ready() {
    const s = this.rules.state;
    if (this.options.mode === 'practice') {
      s.half = this.options.team;
      s.outs = 0;
      s.finished = false;
      s.winner = null;
      s.inning = 1;
    }
    if (this.derbyMode) {
      if (this.derbyAdvance()) return;
      // The derby hitter stays at the plate; the count never matters.
      s.half = this.options.team;
      s.outs = 0;
      s.balls = 0;
      s.strikes = 0;
      s.finished = false;
      s.winner = null;
      s.inning = 1;
      s.bases = [null, null, null];
      s.orders[this.options.team] = Math.max(0, s.teams[this.options.team].lineup.indexOf(this.derby.hitter));
    }
    if (s.finished) {
      this.finish();
      return;
    }
    this.phase = 'ready';
    this.phaseTime = 0;
    this.ball = null;
    this.trail = [];
    this.live = null;
    this.swingAt = null;
    this.pitchProgress = 0;
    this.stealArmed = false;
    this.aggression = 0;
    this.throwBase = 1;
    this.golden = false;
    this.resetField();
    this.physics.stop();
    this.onChange();
  }

  finish() {
    this.phase = 'finished';
    this.phaseTime = 0;
    this.ball = null;
    this.trail = [];
    this.live = null;
    this.physics.stop();
    if (this.derbyMode) {
      const d = this.derby;
      this.onSound(d.champion ? 'win' : 'out');
      this.onEvent(d.champion ? { title: 'DERBY CHAMPION!', subtitle: `${d.homers} HOME RUNS • LONGEST ${d.longest} FT`, kind: 'win' } : { title: 'DERBY OVER', subtitle: `OUT IN ROUND ${d.round + 1} • ${d.homers} HOME RUNS`, kind: 'bad' });
      if (d.champion) this.burst(v3(0, 8, -18), 65, '#ffd35b');
    } else {
      this.onSound('win');
      this.onEvent({ title: `${TEAMS[this.rules.state.winner ?? 1].name} WIN!`, subtitle: `FINAL • ${this.rules.score[0]} – ${this.rules.score[1]}`, kind: 'win' });
      this.burst(v3(0, 8, -18), 65, '#ffd35b');
      this.save();
    }
    this.onFinish(this);
    this.onChange();
  }

  /** The pitcher's choice for the next pitch. Not while one is in the air: that bent the CPU's pitches mid-flight. */
  selectPitch(index) {
    if (!this.humanPitching || this.phase === 'pitch' || this.phase === 'live') return;
    if (index >= 0 && index < 4) {
      this.pitchType = PITCH_TYPES[index];
      this.onChange();
    }
  }
  cyclePitch(step) {
    this.selectPitch((PITCH_TYPES.indexOf(this.pitchType) + step + 4) % 4);
  }
  cycleThrow(step) {
    this.action(`throw${((this.throwBase - 1 + step + 4) % 4) + 1}`);
    this.onChange();
  }

  action(name) {
    if (name === 'pause') {
      this.paused = !this.paused;
      this.onChange();
      return;
    }
    if (this.paused || !this.inPlay) return;
    if (name === 'replay') {
      // Replays run between pitches; starting one mid-play froze the live ball.
      if (this.replayStored.length && (this.replay || this.phase === 'ready' || this.phase === 'result')) {
        this.replay = !this.replay;
        this.replayTime = 0;
        this.onChange();
      }
      return;
    }
    if (this.replay) return;
    if (name === 'main' || name === 'powerSwing' || name === 'bunt') {
      if (name === 'bunt' && this.derbyMode) return;
      if (this.phase === 'pitch' && this.batting && this.swingAt === null) {
        this.swingAt = this.phaseTime;
        this.swingMode = name === 'bunt' ? 'bunt' : name === 'powerSwing' ? 'power' : 'normal';
        this.onSound('pitch');
        this.onChange();
      } else if (this.phase === 'ready' && this.humanPitching) this.throwPitch();
      return;
    }
    if (name === 'power') {
      const side = this.options.team;
      if (this.heat[side] >= 100) {
        this.powerArmed = !this.powerArmed;
        this.onSound('power');
        this.onChange();
      } else this.onEvent({ title: 'KEEP THE HEAT!', subtitle: `${Math.floor(this.heat[side])}% CHARGED • HITS & OUTS BUILD YOUR METER`, kind: 'neutral' });
      return;
    }
    if (name === 'advance') {
      if (this.batting && !this.derbyMode) {
        if (this.phase === 'ready' || this.phase === 'pitch') {
          this.stealArmed = !this.stealArmed;
          this.onEvent({ title: this.stealArmed ? 'RUN ON THE PITCH' : 'HOLD YOUR BASES', subtitle: 'STEALS ARE LIVE • SPEED VS. CATCHER’S ARM', kind: 'neutral' });
        } else if (this.phase === 'live') {
          this.aggression = 1;
          this.onEvent({ title: 'SEND ’EM!', subtitle: 'EXTRA BASES. EXTRA RISK.', kind: 'good' });
        }
        this.onChange();
      }
      return;
    }
    if (name === 'hold') {
      if (this.derbyMode) return;
      this.aggression = -1;
      this.stealArmed = false;
      this.onChange();
      return;
    }
    if (name === 'switch' && this.fielding) {
      this.selected = (this.selected + 1) % this.fielders.length;
      this.manualTimer = 1.4;
      this.onChange();
      return;
    }
    // Dive and throw belong to the defense: pressed at the plate they used to help the CPU fielders.
    if (name === 'dive' && this.fielding) {
      this.diveTimer = 0.7;
      this.onSound('pitch');
      return;
    }
    if (name.startsWith('throw') && this.fielding) {
      this.throwBase = Number(name.slice(5));
      if (this.live?.collected && this.live.throwTime === 0) this.beginThrow();
      this.onChange();
      return;
    }
    if (name === 'walk' && this.phase === 'ready' && this.humanPitching) {
      this.rules.walk(true);
      this.result('TAKE YOUR BASE', 'INTENTIONAL WALK', 'neutral', 1.2);
      return;
    }
    if (name === 'pickoff' && this.phase === 'ready' && this.humanPitching) {
      const base = this.rules.state.bases.findIndex(Boolean);
      if (base < 0) {
        this.onEvent({ title: 'BASES EMPTY', subtitle: 'NOBODY TO PICK OFF', kind: 'neutral' });
        return;
      }
      this.rules.pitcherStats.pitches++;
      if (this.rng() < 0.12) {
        this.rules.pickoff(base);
        this.result('PICKED OFF!', 'GOT ’EM LEANING', 'good');
        this.gainHeat(this.rules.defense, 15);
      } else this.result('BACK SAFE', 'PICKOFF ATTEMPT', 'neutral', 0.9);
    }
  }

  gainHeat(side, n) {
    this.heat[side] = clamp(this.heat[side] + n, 0, 100);
  }

  throwPitch() {
    if (this.phase !== 'ready') return;
    this.phase = 'pitch';
    this.phaseTime = 0;
    this.pitchProgress = 0;
    this.swingAt = null;
    this.swingMode = 'normal';
    this.stealMessage = '';
    this.lastDistance = 0;
    this.rules.pitch();
    const cpu = !this.humanPitching;
    const p = this.rules.pitcher;
    const derby = this.derbyMode;
    if (cpu) {
      // The derby pitcher grooves straight ones; everyone else mixes all four.
      this.pitchType = derby ? (this.rng() < 0.7 ? 'HEAT' : 'CHANGE') : PITCH_TYPES[Math.floor(this.rng() * 4)];
      const inZone = this.rng() < 0.76 || this.options.mode === 'practice' || derby;
      this.pitchTarget = v3(inZone ? (this.rng() - 0.5) * 1.5 : (this.rng() < 0.5 ? -1 : 1) * (1.25 + this.rng() * 0.6), inZone ? 1 + this.rng() * 1.8 : this.rng() < 0.5 ? 0.4 : 3.6, 0.2);
    } else this.pitchTarget = v3(this.aim.x, this.aim.y, 0.2);
    const fatigue = derby ? 0 : clamp((this.rules.pitcherStats.pitches - 45) / 75, 0, 0.7);
    if (fatigue > 0) {
      this.pitchTarget.x += (this.rng() - 0.5) * fatigue;
      this.pitchTarget.y += (this.rng() - 0.5) * fatigue;
    }
    this.pitchPower = !derby && (cpu ? this.heat[this.rules.defense] >= 100 && this.rng() < 0.3 : this.powerArmed && this.heat[this.rules.defense] >= 100);
    if (this.pitchPower) {
      this.heat[this.rules.defense] = 0;
      this.powerArmed = false;
      this.onSound('power');
    }
    if (derby) {
      this.golden = this.derby.pitches % 5 === 4;
      this.derby.pitches++;
    }
    const speedFactor = { HEAT: 1, CURVE: 0.82, CHANGE: 0.7, SLIDER: 0.9 }[this.pitchType];
    this.pitchVelocity = Math.round((82 + (p.arm - 70) * 0.7) * speedFactor * (1 - fatigue * 0.2) + (this.pitchPower ? 12 : 0)) - (derby ? 14 : 0);
    this.pitchDuration = ((PITCH_TIME[this.options.difficulty] ?? PITCH_TIME.rookie) / speedFactor) * (this.pitchPower ? 0.85 : 1) * (derby ? 1.12 : 1);
    this.aiSwingAt = null;
    if (!this.batting) {
      const inZone = Math.abs(this.pitchTarget.x) < 1.03 && this.pitchTarget.y > 0.75 && this.pitchTarget.y < 3.25;
      const chase = { rookie: 0.33, pro: 0.25, legend: 0.17 }[this.options.difficulty];
      if (this.rng() < (inZone ? 0.9 : chase) || (this.rules.state.strikes === 2 && this.rng() < 0.5)) {
        const error = { rookie: 0.46, pro: 0.34, legend: 0.26 }[this.options.difficulty] * (1.15 - this.rules.batter.contact / 230);
        this.aiSwingAt = this.pitchDuration * 0.94 + (this.rng() - 0.5) * error;
      }
    }
    this.ball = v3(0, 3.5, -15.2);
    this.replayFrames = [];
    this.onSound('pitch');
    this.onChange();
  }

  resolveSteal() {
    const should = (this.stealArmed && this.batting) || (!this.batting && this.rng() < 0.055);
    if (!should) return false;
    const s = this.rules.state;
    const oldHalf = s.half;
    const oldInning = s.inning;
    let base = -1;
    for (let i = 2; i >= 0; i--)
      if (s.bases[i] && (i === 2 || !s.bases[i + 1])) {
        base = i;
        break;
      }
    if (base < 0) return false;
    const runner = s.bases[base].player;
    const catcher = this.fielders[6].player;
    const probability = clamp(0.48 + (runner.speed - catcher.arm) * 0.012 + (this.pitchType === 'CHANGE' ? 0.16 : 0) - (base === 2 ? 0.43 : 0), 0.08, 0.9);
    const safe = this.rng() < probability;
    this.rules.advanceRunner(base, safe, true);
    this.stealMessage = safe ? 'STOLEN BASE!' : 'CAUGHT STEALING';
    this.stealArmed = false;
    if (s.half !== oldHalf || s.inning !== oldInning || s.finished) {
      this.result(this.stealMessage, 'THAT ENDS THE HALF INNING', safe ? 'good' : 'bad');
      return true;
    }
    return false;
  }

  resolvePitch() {
    this.practice.pitches++;
    const derby = this.derbyMode;
    if (!derby && this.resolveSteal()) return;
    const defense = this.rules.defense;
    this.lastPitch = `${this.pitchType} • ${this.pitchVelocity} MPH`;
    const inZone = Math.abs(this.pitchTarget.x) < 1.05 && this.pitchTarget.y >= 0.75 && this.pitchTarget.y <= 3.2;
    if (this.swingAt === null) {
      if (derby) {
        this.result(this.golden ? 'GOLDEN BALL TAKEN' : 'TAKE', `${this.lastPitch} • NO SWING, NO OUT`, 'neutral', 0.8);
        return;
      }
      if (this.pitchTarget.x < -1.9 && this.pitchTarget.y < 3) {
        this.rules.hitByPitch();
        this.result('TAKE YOUR BASE', 'HIT BY PITCH', 'neutral');
        return;
      }
      const msg = inZone ? this.rules.strike() : this.rules.ball();
      if (inZone) this.gainHeat(defense, 6);
      this.result(msg === 'STRIKEOUT' ? 'PUNCH OUT!' : msg === 'WALK' ? 'TAKE YOUR BASE' : inZone ? 'STRIKE!' : 'BALL', this.stealMessage || this.lastPitch, inZone ? (this.batting ? 'bad' : 'good') : 'neutral', msg === 'STRIKEOUT' ? 1.8 : 1.1);
      return;
    }
    const error = this.swingAt - this.pitchDuration * 0.94;
    const window = (SWING_WINDOW[this.options.difficulty] ?? SWING_WINDOW.rookie) * (this.swingMode === 'power' ? 0.74 : this.swingMode === 'bunt' ? 1.3 : 1);
    const reach = Math.abs(this.pitchTarget.x) < 1.75 && this.pitchTarget.y > 0.35 && this.pitchTarget.y < 3.85;
    if (Math.abs(error) > window || !reach) {
      const why = !reach ? 'CHASED OUTSIDE THE ZONE' : error < 0 ? 'TOO EARLY • LET IT TRAVEL' : 'TOO LATE • GET THE BAT AROUND';
      if (this.powerArmed && this.batting) {
        this.powerArmed = false;
        this.heat[this.options.team] = 0;
      }
      if (derby) {
        this.derbyOut('WHIFF!', why);
        return;
      }
      const msg = this.rules.strike(true);
      this.gainHeat(defense, 8);
      this.result(msg === 'STRIKEOUT' ? 'SIT DOWN!' : 'WHIFF!', why, this.batting ? 'bad' : 'good', msg === 'STRIKEOUT' ? 1.8 : 1.25);
      return;
    }
    let quality = clamp(1 - Math.abs(error) / window, 0, 1);
    quality *= 0.82 + this.rules.batter.contact / 500;
    if (quality < 0.19 || (!inZone && quality < 0.55)) {
      if (derby) {
        this.derbyOut('FOUL BALL', error < 0 ? 'OUT IN FRONT' : 'JUST BEHIND IT');
        return;
      }
      const msg = this.rules.foul(this.swingMode === 'bunt');
      this.result(msg === 'BUNT STRIKEOUT' ? 'BUNT STRIKEOUT' : 'FOUL BALL', error < 0 ? 'OUT IN FRONT' : 'JUST BEHIND IT', 'neutral', 1.1);
      return;
    }
    this.contact(quality, error);
  }

  contact(quality, error) {
    const side = this.rules.offense;
    const hitter = this.rules.batter;
    const power = this.batting ? this.powerArmed && this.heat[side] >= 100 : this.heat[side] >= 100 && this.rng() < 0.35;
    if (power) {
      this.heat[side] = 0;
      this.powerArmed = false;
      this.onSound('power');
    }
    this.gainHeat(side, 12);
    const bunt = this.swingMode === 'bunt';
    const speed = bunt ? 10 : 25 + quality * 12 + hitter.power * 0.02 + (this.swingMode === 'power' ? 4 : 0) + (power ? (side === 0 ? 10 : 12) : 0) + (this.streak[side] >= 3 ? 2 : 0);
    const theta = clamp(error * 3.5 + (this.batting ? this.spray * 0.26 : (this.rng() - 0.5) * 0.65), -1.1, 1.1);
    const launch = bunt ? 9 : quality < 0.28 ? 66 : clamp(26 + (this.batting ? this.loft * 18 : (this.rng() - 0.5) * 30) + (this.rng() - 0.5) * 8, 6, 53);
    const angle = (launch * Math.PI) / 180;
    const velocity = v3(Math.sin(theta) * Math.cos(angle) * speed, Math.sin(angle) * speed, -Math.cos(theta) * Math.cos(angle) * speed);
    this.physics.launch(v3(0, 1.45, 0), velocity);
    this.ball = v3(0, 1.45, 0);
    this.trail = [];
    this.phase = 'live';
    this.phaseTime = 0;
    const predicted = landing(this.ball, velocity);
    const closest = this.fielders.reduce((best, f, i) => (distance(f.p, predicted) < distance(this.fielders[best].p, predicted) ? i : best), 0);
    this.selected = closest;
    this.manualTimer = 0;
    this.live = { time: 0, bounced: false, bounceTime: 0, landing: predicted, fielder: closest, quality, power, startBases: this.rules.state.bases.map((r) => r?.player.id || null), collected: false, collectTime: 0, throwStart: v3(), throwEnd: v3(), throwTime: 0, throwDuration: 1, throwBase: 1, error: false, foul: !FAIR(predicted), distance: 0 };
    this.lastQuality = quality;
    this.onSound('hit');
    this.burst(v3(0, 2, 0), power ? 36 : 14, power ? '#ffcc3e' : '#fff2b9');
    this.onEvent({ title: power ? `${TEAMS[side].special}!` : quality > 0.88 ? 'PERFECT CONTACT!' : bunt ? 'LAY IT DOWN!' : 'LET IT FLY!', subtitle: power ? 'THIS ONE’S GOT SOME SERIOUS HEAT' : `${Math.round(speed * 2.3)} MPH EXIT VELOCITY • ${Math.round(launch)}° LAUNCH`, kind: power ? 'homer' : 'good' });
    this.onChange();
  }

  beginThrow() {
    const l = this.live;
    if (!l || !l.collected || l.throwTime > 0) return;
    l.throwBase = this.throwBase;
    l.throwStart = { ...this.fielders[l.fielder].p, y: 2.5 };
    l.throwEnd = { ...BASES[this.throwBase], y: 1.6 };
    l.throwDuration = distance(l.throwStart, l.throwEnd) / (22 + this.fielders[l.fielder].player.arm * 0.12);
    l.throwTime = 0.001;
    this.onSound('pitch');
  }

  /** Advance the live ball one step; returns the physics state. */
  stepBall(dt) {
    const l = this.live;
    const state = this.physics.step(dt);
    if (!this.ball) this.ball = v3();
    this.ball.x = state.position.x;
    this.ball.y = state.position.y;
    this.ball.z = state.position.z;
    if (state.grounded && !l.bounced) l.bounceTime = l.time;
    l.bounced = state.grounded;
    l.distance = Math.max(l.distance, Math.hypot(this.ball.x, this.ball.z));
    return state;
  }

  updateLive(dt) {
    const l = this.live;
    if (!l) return;
    l.time += dt;
    this.phaseTime = l.time;
    if (this.derbyMode) {
      this.updateDerbyLive(dt);
      return;
    }
    if (l.collected) {
      if (l.throwTime === 0) {
        if (l.time - l.collectTime > (this.humanPitching && !this.options.assist ? 3 : 0.3)) this.beginThrow();
        return;
      }
      l.throwTime += dt;
      const t = clamp(l.throwTime / l.throwDuration, 0, 1);
      this.ball = v3(lerp(l.throwStart.x, l.throwEnd.x, t), lerp(l.throwStart.y, l.throwEnd.y, t) + Math.sin(t * Math.PI) * 1.7, lerp(l.throwStart.z, l.throwEnd.z, t));
      if (t >= 1) this.resolveFielded();
      return;
    }
    const state = this.stepBall(dt);
    const radial = Math.hypot(this.ball.x, this.ball.z);
    if (radial >= WALL + 0.1 && FAIR(this.ball) && this.ball.y > 4) {
      if (l.bounced) {
        this.rules.hit(2);
        this.result('GROUND-RULE DOUBLE', 'BOUNCED OVER THE WALL • TWO BASES', 'good', 2.4);
      } else {
        const n = this.rules.state.bases.filter(Boolean).length + 1;
        const side = this.rules.offense;
        this.rules.hit(4);
        this.streak[side]++;
        this.practice.hits++;
        this.practice.hr++;
        this.lastDistance = feet(Math.hypot(l.landing.x, l.landing.z));
        this.practice.best = Math.max(this.practice.best, this.lastDistance);
        this.gainHeat(side, 25);
        this.burst(this.ball, 65, TEAMS[side].accent);
        this.result(n === 4 ? 'GRAND SLAM!' : 'HOME RUN!', `${this.lastDistance} FT • ${n} RUN${n === 1 ? '' : 'S'} • OUTTA HERE!`, 'homer', 3.4);
      }
      return;
    }
    if (l.time > 0.7 && l.quality < 0.28 && !l.foul && Math.hypot(l.landing.x, l.landing.z) < 30 && this.rules.state.bases[0] && this.rules.state.bases[1] && this.rules.state.outs < 2) {
      this.rules.infieldFly();
      this.result('INFIELD FLY', 'BATTER IS OUT • RUNNERS HOLD', 'neutral', 1.9);
      return;
    }
    const target = l.bounced ? this.ball : l.landing;
    const best = this.fielders.reduce((b, f, i) => (distance(f.p, target) < distance(this.fielders[b].p, target) ? i : b), 0);
    l.fielder = best;
    if (this.manualTimer <= 0) this.selected = best;
    for (let i = 0; i < this.fielders.length; i++) {
      const f = this.fielders[i];
      const manual = this.humanPitching && i === this.selected && this.manualTimer > 0;
      if (!manual) {
        const shouldChase = (i === best && (!this.humanPitching || this.options.assist)) || (i === this.selected && this.humanPitching && this.options.assist);
        if (shouldChase) {
          const bx = f.p.x;
          const bz = f.p.z;
          moveToward(f.p, target, dt * (5.0 + f.player.field * 0.031) * (this.diveTimer > 0 && i === this.selected ? 1.75 : 1));
          if (Math.hypot(f.p.x - bx, f.p.z - bz) > 0.01) f.motion += dt * 14;
        } else if (i !== 8 && (!this.humanPitching || i !== this.selected)) {
          const dest = i === 2 ? BASES[1] : i === 7 ? BASES[2] : f.home;
          moveToward(f.p, dest, dt * 3);
        }
      }
      const catchRadius = this.diveTimer > 0 && i === this.selected ? 4.3 : 1.8 + f.player.field * 0.007;
      if (l.time > 0.55 && distance(f.p, this.ball) < catchRadius && this.ball.y < 4.1 && state.velocity.y < 0 && !l.bounced) {
        const side = this.rules.offense;
        const sac = this.aggression >= 0 && l.distance > 44 && !!this.rules.state.bases[2] && this.rules.state.outs < 2;
        this.rules.flyOut(sac);
        this.streak[side] = 0;
        this.gainHeat(1 - side, 15);
        this.result(sac ? 'SACRIFICE FLY' : this.diveTimer > 0 ? 'DIVING CATCH!' : 'GOT IT!', sac ? 'TAG UP • RUN SCORES' : l.foul ? 'CAUGHT IN FOUL TERRITORY' : 'FLY OUT • WEB GEM', this.batting ? 'bad' : 'good', 1.8);
        return;
      }
      if (l.bounced && this.ball.y < 2.1 && distance(f.p, this.ball) < catchRadius) {
        if (!FAIR(this.ball)) {
          const msg = this.rules.foul(this.swingMode === 'bunt');
          this.result(msg === 'BUNT STRIKEOUT' ? 'BUNT STRIKEOUT' : 'FOUL BALL', 'OUTSIDE THE CHALK', 'neutral', 1.2);
          return;
        }
        l.collected = true;
        l.collectTime = l.time;
        l.fielder = i;
        l.throwStart = { ...f.p, y: 2 };
        l.throwBase = this.throwBase;
        this.physics.stop();
        this.ball = { ...l.throwStart };
        l.error = this.rng() < (100 - f.player.field) * 0.001 && l.quality > 0.65;
        return;
      }
    }
    if (l.foul && l.bounced && radial > 5) {
      const msg = this.rules.foul(this.swingMode === 'bunt');
      this.result(msg === 'BUNT STRIKEOUT' ? 'BUNT STRIKEOUT' : 'FOUL BALL', 'OUTSIDE THE CHALK', 'neutral', 1.2);
      return;
    }
    if (l.time > 13 || radial > 150) {
      if (l.foul) {
        this.rules.foul();
        this.result('FOUL BALL', 'DEAD BALL', 'neutral');
      } else {
        this.rules.hit(3);
        this.practice.hits++;
        this.result('TRIPLE!', 'ALL THE WAY TO THIRD', 'good', 2);
      }
    }
  }

  resolveFielded() {
    const l = this.live;
    const side = this.rules.offense;
    const runnerTime = 25.45 / (6.6 + this.rules.batter.speed * 0.032);
    const grounder = l.distance < 32;
    if (l.throwBase > 1 && grounder && l.time < runnerTime + 0.7) {
      const base = l.throwBase;
      const forced = this.rules.state.bases.slice(0, base - 1).every(Boolean);
      if (forced) {
        this.rules.fieldersChoice(base);
        this.streak[side] = 0;
        this.gainHeat(1 - side, 14);
        this.result('FORCE OUT!', `FIELDER’S CHOICE • OUT AT ${base === 4 ? 'HOME' : base}`, this.batting ? 'bad' : 'good');
        return;
      }
    }
    if (grounder && l.time < runnerTime && !l.error) {
      const dp = !!this.rules.state.bases[0] && this.rules.state.outs < 2 && l.time + 0.75 < runnerTime;
      const sac = this.swingMode === 'bunt' && this.rules.state.outs < 2 && this.rules.state.bases.some(Boolean);
      if (sac) this.rules.sacrificeBunt();
      else this.rules.groundOut(dp, this.aggression >= 0);
      this.streak[side] = 0;
      this.gainHeat(1 - side, dp ? 26 : 14);
      this.result(sac ? 'SACRIFICE BUNT' : dp ? 'DOUBLE PLAY!' : 'YOU’RE OUT!', sac ? 'ONE OUT • RUNNERS ADVANCE' : dp ? 'TURN TWO • THAT’S HOW IT’S DONE' : 'GROUND OUT • BEAT THE RUNNER', this.batting ? 'bad' : 'good');
      return;
    }
    let bases = clamp(Math.floor((l.time + 0.3) / runnerTime), 1, 3);
    if (this.aggression < 0) bases = 1;
    if (this.aggression === 0) bases = Math.min(bases, 2);
    let stretch = false;
    if (this.aggression > 0 && bases < 3) {
      stretch = this.rng() > 0.53 + (this.rules.batter.speed - 75) * 0.006;
      if (!stretch) bases = bases + 1;
    }
    this.rules.hit(bases, l.error);
    this.streak[side]++;
    this.practice.hits++;
    this.gainHeat(side, 8 + bases * 5);
    if (stretch && !this.rules.state.finished) {
      this.rules.advanceRunner(bases - 1, false);
      this.result('TAGGED OUT!', 'THROWN OUT TRYING FOR AN EXTRA BASE', this.batting ? 'bad' : 'good', 2);
    } else this.result(l.error ? 'SAFE ON ERROR' : ['', 'BASE HIT!', 'DOUBLE!', 'TRIPLE!'][bases], l.error ? 'THE DEFENSE COULDN’T HANDLE IT' : this.streak[side] >= 3 ? 'TEAM ON FIRE! • KEEP THE RALLY ALIVE' : `${TEAMS[side].name} KEEP IT ROLLING`, this.batting ? 'good' : 'bad', 1.9);
  }

  // ---- Home Run Derby ---------------------------------------------------

  setupDerby() {
    const side = this.options.team;
    const rivals = derbyRivals(1 - side);
    // Loft makes the derby: a level swing almost never clears the wall. Start the hitter with
    // some lift (the aim guide at the plate shows it), so a first derby is not ten flat outs.
    this.loft = Math.max(this.loft, 0.5);
    // Tuned in simulation: a steady normal swing hits ~2-3 per 10 outs, a lofted power swing many more.
    const base = { rookie: 3, pro: 4, legend: 6 }[this.options.difficulty] ?? 3;
    const step = { rookie: 1.5, pro: 2, legend: 2.5 }[this.options.difficulty] ?? 1.5;
    const targets = rivals.map((p, i) => Math.max(2, base + Math.round(i * step) + Math.round((p.power - 85) / 12) + Math.floor(this.rng() * 3) - 1));
    for (let i = 1; i < targets.length; i++) targets[i] = Math.max(targets[i], targets[i - 1]);
    this.derby = { round: 0, hitter: slugger(side).id, rivals: rivals.map((p) => p.id), targets, hr: 0, outs: 0, outLimit: DERBY_OUTS, swingoff: false, pitches: 0, homers: 0, longest: 0, total: 0, results: [], champion: false, over: false };
  }

  /** Between pitches: close a won or lost round. Returns true when the derby is over. */
  derbyAdvance() {
    const d = this.derby;
    if (!d || d.over) return !!d?.over;
    const target = d.targets[d.round];
    const rival = this.derbyRival;
    if (d.hr > target) {
      d.results.push({ rival: rival.id, target, hr: d.hr, won: true });
      if (d.round >= d.targets.length - 1) {
        d.champion = true;
        d.over = true;
        this.finish();
        return true;
      }
      d.round++;
      d.hr = 0;
      d.outs = 0;
      d.outLimit = DERBY_OUTS;
      d.swingoff = false;
      const next = this.derbyRival;
      this.onEvent({ title: d.round === d.targets.length - 1 ? 'THE FINAL!' : `ROUND ${d.round + 1}!`, subtitle: `${next.name.toUpperCase()} HIT ${d.targets[d.round]} • BEAT IT`, kind: 'inning' });
      return false;
    }
    if (d.outs >= d.outLimit) {
      if (d.hr === target && !d.swingoff) {
        d.swingoff = true;
        d.outLimit += 3;
        this.onEvent({ title: 'SWING-OFF!', subtitle: 'ALL TIED • 3 MORE OUTS • NEXT BOMB WINS', kind: 'inning' });
        return false;
      }
      d.results.push({ rival: rival.id, target, hr: d.hr, won: false });
      d.over = true;
      this.finish();
      return true;
    }
    return false;
  }

  derbyOut(title, subtitle) {
    const d = this.derby;
    d.outs++;
    this.result(title, `${subtitle} • OUT ${d.outs} OF ${d.outLimit}`, 'bad', 1.3);
  }

  derbyHomer() {
    const d = this.derby;
    const l = this.live;
    const side = this.rules.offense;
    const dist = feet(Math.hypot(l.landing.x, l.landing.z));
    const worth = this.golden ? 2 : 1;
    d.hr += worth;
    d.homers++;
    d.longest = Math.max(d.longest, dist);
    d.total += dist;
    const bonus = dist >= DERBY_BONUS_FT && d.outs > 0;
    if (bonus) d.outs--;
    this.lastDistance = dist;
    this.practice.hr++;
    this.practice.best = Math.max(this.practice.best, dist);
    this.gainHeat(side, 25);
    this.burst(this.ball, 65, this.golden ? '#ffd23f' : TEAMS[side].accent);
    const passed = d.hr > d.targets[d.round];
    const title = passed ? (d.round >= d.targets.length - 1 ? 'CHAMPION SWING!' : 'ROUND WON!') : this.golden ? 'GOLDEN BOMB!' : dist >= DERBY_BONUS_FT ? 'MOONSHOT!' : 'GONE!';
    const sub = `${dist} FT${worth > 1 ? ' • COUNTS DOUBLE' : ''}${bonus ? ' • BONUS OUT BACK' : ''} • ${d.hr} HR`;
    this.result(title, sub, 'homer', passed ? 3 : 2.4);
  }

  updateDerbyLive(dt) {
    const l = this.live;
    const state = this.stepBall(dt);
    const radial = Math.hypot(this.ball.x, this.ball.z);
    if (radial >= WALL + 0.1 && FAIR(this.ball) && this.ball.y > 4 && !l.bounced) {
      this.derbyHomer();
      return;
    }
    // The shaggers: the nearest fielder runs the ball down and can rob a short one.
    const target = l.bounced ? this.ball : l.landing;
    let best = 0;
    for (let i = 1; i < this.fielders.length; i++) if (distance(this.fielders[i].p, target) < distance(this.fielders[best].p, target)) best = i;
    const f = this.fielders[best];
    if (!moveToward(f.p, target, dt * (5.0 + f.player.field * 0.031))) f.motion += dt * 14;
    if (!l.foul && l.time > 0.55 && !l.bounced && state.velocity.y < 0 && this.ball.y < 4.1 && distance(f.p, this.ball) < 1.8 + f.player.field * 0.007) {
      this.derbyOut('ROBBED!', 'CAUGHT ON THE FLY');
      return;
    }
    if (l.foul && (l.bounced || (radial > 5 && this.ball.y < 1))) {
      this.derbyOut('FOUL BALL', 'HOOKED FOUL');
      return;
    }
    if ((l.bounced && l.time - l.bounceTime > 0.35) || l.time > 8) this.derbyOut('IN THE PARK', `${feet(l.distance)} FT • NEEDS MORE LIFT`);
  }

  // ---- shared -----------------------------------------------------------

  result(title, subtitle, kind, duration = 1.8) {
    this.physics.stop();
    this.phase = 'result';
    this.phaseTime = 0;
    this.resultDuration = duration;
    this.lastPlay = title;
    if (!this.lastDistance && this.live) this.lastDistance = feet(this.live.distance || 0);
    // Frames are deep copies already, and the next pitch starts a new list.
    this.replayStored = this.replayFrames.slice();
    this.onEvent({ title, subtitle, kind });
    this.onSound(kind === 'homer' ? 'homer' : kind === 'bad' ? 'out' : title.includes('FOUL') ? 'foul' : title.includes('STRIKE') ? 'strike' : kind === 'good' ? 'hit' : 'ui');
    const half = `${this.rules.state.inning}-${this.rules.state.half}`;
    if (half !== this.currentHalf) {
      this.currentHalf = half;
      this.resultDuration = Math.max(duration, 2.3);
    }
    this.save();
    this.onChange();
  }

  burst(p, n, color) {
    n = Math.max(1, Math.round(n * this.particleScale));
    for (let i = 0; i < n; i++) {
      const life = 0.5 + this.rng() * 1.0;
      this.particles.push({ p: { ...p }, v: v3((this.rng() - 0.5) * 17, this.rng() * 14 + 2, (this.rng() - 0.5) * 17), life, maxLife: life, color: i % 3 ? color : '#fff3c5', size: 0.12 + this.rng() * 0.45 });
    }
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.paused) return;
    this.time += dt;
    if (this.replay) {
      this.replayTime += dt;
      if (this.replayTime > this.replayStored.length * 0.05 + 1) {
        this.replay = false;
        this.onChange();
      }
      return;
    }
    let n = 0;
    for (const p of this.particles) {
      p.life -= dt;
      p.v.y -= 16 * dt;
      p.p.x += p.v.x * dt;
      p.p.y += p.v.y * dt;
      p.p.z += p.v.z * dt;
      if (p.life > 0 && p.p.y > 0) this.particles[n++] = p;
    }
    this.particles.length = n;
    if (!this.inPlay) return;
    this.manualTimer = Math.max(0, this.manualTimer - dt);
    this.diveTimer = Math.max(0, this.diveTimer - dt);
    const dx = this.move.x;
    const dy = this.move.y;
    if (dx || dy) {
      if (this.phase === 'live' && this.humanPitching) {
        this.manualTimer = 1;
        const f = this.fielders[this.selected];
        // Up on the stick is up on screen (into the field), right is screen-right.
        f.p.x = clamp(f.p.x + (SCREEN_RIGHT.x * dx + SCREEN_FWD.x * dy) * dt * 10, -64, 64);
        f.p.z = clamp(f.p.z + (SCREEN_RIGHT.z * dx + SCREEN_FWD.z * dy) * dt * 10, -79, 8);
        f.motion += dt * 15 * Math.hypot(dx, dy);
      } else if (this.humanPitching && this.phase === 'ready') {
        this.aim.x = clamp(this.aim.x + dx * dt * 1.8, -1.85, 1.85);
        this.aim.y = clamp(this.aim.y + dy * dt * 1.8, 0.3, 3.8);
      } else if (this.batting) {
        this.spray = clamp(this.spray + dx * dt * 1.8, -1, 1);
        this.loft = clamp(this.loft + dy * dt * 1.8, -1, 1);
      }
    }
    this.phaseTime += dt;
    if (this.phase === 'ready') {
      if (!this.humanPitching && this.phaseTime > 1.7) this.throwPitch();
      else if (this.humanPitching && this.phaseTime > 20) {
        this.rules.ball();
        this.result('PITCH CLOCK', 'AUTOMATIC BALL • 20-SECOND LIMIT', 'neutral');
      }
    } else if (this.phase === 'pitch') {
      this.pitchProgress = clamp(this.phaseTime / this.pitchDuration, 0, 1);
      const t = this.pitchProgress;
      const curve = this.pitchType === 'CURVE' ? -1.1 : this.pitchType === 'SLIDER' ? 1.5 : 0;
      if (!this.ball) this.ball = v3();
      this.ball.x = lerp(0, this.pitchTarget.x, t) + Math.sin(t * Math.PI) * curve;
      this.ball.y = lerp(3.5, this.pitchTarget.y, t) + Math.sin(t * Math.PI) * (this.pitchType === 'CURVE' ? 1.4 : 0.2);
      this.ball.z = lerp(-15.2, 0.2, t);
      if (this.aiSwingAt !== null && this.swingAt === null && this.phaseTime >= this.aiSwingAt) {
        this.swingAt = this.aiSwingAt;
        this.swingMode = 'normal';
      }
      if (this.phaseTime >= this.pitchDuration * 1.08) this.resolvePitch();
    } else if (this.phase === 'live') this.updateLive(dt);
    else if (this.phase === 'result' && this.phaseTime >= this.resultDuration) this.ready();
    this.trailClock += dt;
    if (this.ball && this.trailClock > 0.025) {
      this.trailClock = 0;
      this.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z });
      if (this.trail.length > 14) this.trail.shift();
    }
    this.recordClock += dt;
    if ((this.phase === 'pitch' || this.phase === 'live') && this.recordClock > 0.05) {
      this.recordClock = 0;
      this.replayFrames.push(this.frame(false, true));
      if (this.replayFrames.length > 160) this.replayFrames.shift();
    }
    this.emitClock += dt;
    if (this.emitClock > 0.075) {
      this.emitClock = 0;
      this.onChange();
    }
  }

  /**
   * What to draw. The live view reuses one set of objects and shares the game's own arrays
   * (nothing is allocated per frame); `copy` makes a frozen snapshot for the instant replay.
   */
  frame(replay = true, copy = false) {
    if (replay && this.replay && this.replayStored.length) return this.replayStored[Math.min(this.replayStored.length - 1, Math.floor(this.replayTime / 0.05))];
    const attract = this.phase === 'attract';
    const def = attract ? 0 : this.rules.defense;
    const live = this.phase === 'live';
    const figs = copy ? [] : this.figs;
    figs.length = 0;
    const pool = this.figPool;
    const fig = (x, y, z, ry, team, skin, role, number, motion, selected = false, swing = 0) => {
      let o;
      if (copy) o = { p: v3() };
      else {
        o = pool[figs.length];
        if (!o) o = pool[figs.length] = { p: v3() };
      }
      o.p.x = x;
      o.p.y = y;
      o.p.z = z;
      o.ry = ry;
      o.team = team;
      o.skin = skin;
      o.role = role;
      o.number = number;
      o.motion = motion;
      o.selected = selected;
      o.swing = swing;
      figs.push(o);
    };
    for (let i = 0; i < this.fielders.length; i++) {
      const f = this.fielders[i];
      const ry = live && this.ball ? Math.atan2(this.ball.x - f.p.x, this.ball.z - f.p.z) : Math.atan2(-f.p.x, -f.p.z);
      fig(f.p.x, f.p.y, f.p.z, ry, def, f.player.skin, f.slot === -1 ? 'pitcher' : 'fielder', f.player.number, f.motion, live && this.humanPitching && i === this.selected);
    }
    const batter = attract ? TEAMS[1].roster[2] : this.rules.batter;
    const off = attract ? 1 : this.rules.offense;
    const swing = attract || this.swingAt === null ? 0 : clamp((this.phaseTime - this.swingAt) * 5, 0, 1);
    if (!live) fig(-2.3, 0, 0.3, Math.PI * 0.45, off, batter.skin, 'batter', batter.number, 0, false, swing);
    fig(0, 0, 5.3, Math.PI, 0, '#c29677', 'umpire', 0, 0);
    if (live && this.live) {
      const start = this.live.startBases;
      for (let i = 0; i <= start.length; i++) {
        const id = i === 0 ? batter.id : start[i - 1];
        if (!id) continue;
        const player = getPlayer(off, id);
        const progress = clamp(this.live.time / (25.45 / (6.6 + player.speed * 0.032)), 0, this.aggression > 0 ? 3 : 2);
        const base = Math.min(4, i + Math.floor(progress));
        const next = Math.min(4, base + 1);
        const f = progress - Math.floor(progress);
        fig(lerp(BASES[base].x, BASES[next].x, f), 0, lerp(BASES[base].z, BASES[next].z, f), Math.atan2(BASES[next].x - BASES[base].x, BASES[next].z - BASES[base].z), off, player.skin, 'runner', player.number, this.time * 15);
      }
    } else {
      // The clubhouse screen shows an empty diamond, not the last game's runners.
      const runners = attract ? NO_RUNNERS : this.rules.state.bases;
      for (let i = 0; i < 3; i++) {
        const r = runners[i];
        if (r) fig(BASES[i + 1].x + 1.6, BASES[i + 1].y, BASES[i + 1].z, Math.PI / 4, off, r.player.skin, 'runner', r.player.number, 0);
      }
    }
    const view = copy ? { camera: BROADCAST } : this.view;
    view.time = this.time;
    view.figures = figs;
    view.ball = this.ball ? (copy ? { x: this.ball.x, y: this.ball.y, z: this.ball.z } : this.ball) : null;
    view.trail = copy ? this.trail.map((p) => ({ ...p })) : this.trail;
    view.power = this.phase === 'pitch' ? this.pitchPower : !!this.live?.power;
    view.golden = this.golden && (this.phase === 'pitch' || live);
    view.powerColor = TEAMS[this.phase === 'pitch' ? def : off].accent;
    view.particles = copy ? this.particles.map((p) => ({ ...p, p: { ...p.p }, v: { ...p.v } })) : this.particles;
    const landing = live && !this.live?.collected ? this.live?.landing : null;
    if (landing) {
      const t = copy ? v3() : this.viewTarget;
      t.x = landing.x;
      t.y = landing.y;
      t.z = landing.z;
      view.target = t;
    } else view.target = null;
    view.selectedBase = this.throwBase;
    // The batter's aim guide: shown at the plate between pitches, gone before the pitch arrives
    // (its dots sit on the pitch's path).
    const aiming = !copy && this.batting && !this.replay && (this.phase === 'ready' || (this.phase === 'pitch' && this.swingAt === null && this.pitchProgress < 0.25));
    if (aiming) {
      this.viewAim.spray = this.spray;
      this.viewAim.loft = this.loft;
      view.aim = this.viewAim;
    } else view.aim = null;
    return view;
  }
}
