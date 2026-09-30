/**
 * campaign.js — SIGNAL, the puzzle campaign on top of the laboratory: the
 * mission panel, placement, test runs with replay, records and files.
 *
 * It talks to the app through a small bridge (see main.js) and never reads
 * devices itself: main.js turns kit.input actions into calls on this object.
 */

import { transformPoints } from './life.js';
import {
  MISSIONS,
  PIECES,
  findMission,
  placementCells,
  validatePlacements,
  buildField,
  MissionRun,
  importReplay,
  importProgress,
  newProgress,
  recordRun,
  orientationLabel,
  pieceTurns,
  pieceBudget,
} from './missions.js';

const $ = (id) => document.getElementById(id);
const clone = (v) => JSON.parse(JSON.stringify(v));
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const pad2 = (n) => String(n).padStart(2, '0');
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const TOTAL = MISSIONS.length;
const CHAPTER_TWO = MISSIONS.findIndex((m) => m.id === 'long-haul');
const PROGRESS_KEY = 'emergence.signal.progress';
const SOUND_KEY = 'emergence.signal.sound';

function pieceIcon(piece) {
  const w = Math.max(...piece.points.map((p) => p[0])) + 1;
  const h = Math.max(...piece.points.map((p) => p[1])) + 1;
  const s = Math.max(3, w, h);
  const ox = (s - w) / 2;
  const oy = (s - h) / 2;
  return `<svg viewBox="-1 -1 ${s + 2} ${s + 2}" aria-hidden="true">${piece.points
    .map(([x, y]) => `<rect x="${x + ox + 0.08}" y="${y + oy + 0.08}" width=".84" height=".84" rx=".06"/>`)
    .join('')}</svg>`;
}

/** Write only when the value changes (the HUD refreshes every generation). */
const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};
const setHTML = (el, html, cache, key) => {
  if (cache[key] === html) return false;
  cache[key] = html;
  el.innerHTML = html;
  return true;
};

export class Campaign {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.progress = newProgress();
    this.placements = [];
    this.past = [];
    this.future = [];
    this.selected = 'glider';
    this.rotation = 0;
    this.flip = false;
    this.candidate = null;
    this.lockedPreview = false;
    this.mode = 'place';
    this.run = null;
    this.previousRun = null;
    this.hintLevel = 0;
    this.showGhost = false;
    this.resultRecorded = false;
    this.newRecord = false;
    this.dismissedResult = false;
    this.sandbox = null;
    this.uiReady = false;
    this.lastEventCount = 0;
    this.cache = {};
    this.overlayDirty = true;
    this.overlayWidth = 0;
    this.overlayHeight = 0;
    let sound = false;
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) this.progress = importProgress(JSON.parse(saved));
      sound = localStorage.getItem(SOUND_KEY) === 'true';
    } catch {
      this.storageWarning = 'Saved campaign data could not be read. A new campaign is ready.';
    }
    this.app.audio.setEnabled(sound);
    this.mount();
    this.bind();
    this.updateMap();
    window.signal = {
      getState: () => this.getState(),
      selectMission: (id) => this.selectMission(id),
      preview: (p) => this.setCandidate(p),
      confirm: () => this.confirm(),
      launch: () => this.app.play(true),
      step: () => this.app.step(),
      retry: () => this.rebuild(),
      seek: (i) => this.seek(i),
      undo: () => this.undo(),
      redo: () => this.redo(),
      sandbox: () => this.toSandbox(),
      campaign: () => this.toCampaign(),
      exportReplay: () => this.replayData(),
      getProgress: () => clone(this.progress),
    };
  }

  get sound() {
    return this.app.audio.enabled;
  }

  beep(type) {
    if (this.app.settings().reducedMotion && type === 'launch') return;
    this.app.audio.play(type);
  }

  // ---------------------------------------------------------------- DOM

  mount() {
    document.querySelector('.brand-sub').innerHTML = '<span>SIGNAL</span><small>A Game of Life puzzle</small>';
    document
      .querySelector('.header-actions')
      .insertAdjacentHTML(
        'afterbegin',
        '<div class="mode-switch" aria-label="Game mode"><button id="campaignMode" aria-pressed="true">Campaign</button><button id="sandboxMode" aria-pressed="false">Sandbox</button></div>'
      );
    $('sidebar').insertAdjacentHTML(
      'afterbegin',
      `<section class="campaign-panel" id="campaignPanel">
      <div class="campaign-panel-head"><span class="eyebrow">RESTORE THE NETWORK</span><button id="missionMap" class="text-button">Missions ${icon('arrow')}</button></div>
      <div id="missionProgress" class="mission-progress" aria-label="Mission progress"></div>
      <div class="mission-number"><span id="missionNumber">01</span><span>/ ${pad2(TOTAL)}<br><b id="missionKind">PLACEMENT</b></span></div>
      <h1 id="missionName">First light</h1><p id="missionBrief" class="mission-brief"></p>
      <div class="mission-section-head"><span>OBJECTIVES</span><span id="missionLimit"></span></div><div id="goalList" class="goal-list"></div>
      <div class="mission-section-head"><span>AVAILABLE PIECES</span><span id="pieceBudget"></span></div><div id="pieceInventory" class="piece-inventory"></div>
      <p class="piece-instruction" id="pieceInstruction">Select a piece. Choose a position. Confirm.</p>
      <div class="hint-panel"><button id="missionHint">${icon('help')}<span>Need a hint?</span><span id="hintCount">0 / 2</span></button><p id="hintText" hidden></p></div>
      <div id="missionRecord" class="mission-record"></div>
      <div class="campaign-files"><button id="saveProgress">${icon('download')}Save progress</button><button id="loadProgress">${icon('upload')}Load file</button><button id="saveReplay">${icon('step')}Save replay</button></div>
      <input id="campaignFile" type="file" accept=".json,application/json" hidden>
      <button id="campaignGuide" class="campaign-guide">How to play ${icon('arrow')}</button>
    </section>`
    );
    $('stage').insertAdjacentHTML(
      'beforeend',
      `<div class="campaign-hud" id="campaignHUD"><div class="mission-phase"><span id="phaseDot"></span><b id="phaseLabel">BUILD</b><span id="missionFraction">01 / ${pad2(TOTAL)}</span></div><p id="shortGoal"></p><div id="receiverPills" class="receiver-pills"></div></div>
      <canvas id="missionOverlay" class="mission-overlay" aria-hidden="true"></canvas>
      <div class="mission-legend"><span><i class="launch-key"></i>Placement</span><span><i class="receiver-key"></i>Receiver</span><span id="hazardLegend"><i class="hazard-key"></i>Forbidden</span></div>
      <div id="campaignDock" class="campaign-dock">
        <div id="buildControls" class="build-controls">
          <div class="game-tools"><button id="gameOrbit" title="Move the camera (V)" aria-label="Move the camera">${icon('orbit')}<span>View</span></button><button id="gamePlace" class="selected" title="Place a piece (S)" aria-label="Place a piece">${icon('stamp')}<span>Place</span></button><button id="gameRemove" title="Remove your piece (E)" aria-label="Remove your piece">${icon('erase')}<span>Remove</span></button><span class="game-divider"></span><button id="gameUndo" title="Undo placement (Ctrl+Z)" aria-label="Undo placement">${icon('undo')}</button><button id="gameRedo" title="Redo placement" aria-label="Redo placement">${icon('redo')}</button></div>
          <div class="placement-controls" id="placementControls"><span class="piece-chip" id="selectedPiece">Glider</span><button id="gameRotate" title="Rotate (R)">${icon('reset')}<span id="directionLabel">SE</span></button><button id="gameFlip" title="Flip (X)" aria-label="Flip piece">${icon('flip')}</button><button id="gameConfirm" class="game-confirm">Confirm ${icon('check')}</button><button id="gameCancel" class="game-cancel" title="Cancel preview" aria-label="Cancel preview">${icon('close')}</button></div>
          <div id="positionRow" class="position-row"><span id="positionStatus">Tap the cyan zone to preview.</span><div class="nudge-controls"><button data-nudge="-1,0" aria-label="Move preview left">←</button><button data-nudge="0,-1" aria-label="Move preview up">↑</button><button data-nudge="0,1" aria-label="Move preview down">↓</button><button data-nudge="1,0" aria-label="Move preview right">→</button></div></div>
        </div>
        <div id="replayControls" class="replay-controls" hidden><div class="replay-heading"><button id="returnToBuild">${icon('undo')}Edit start</button><span>INSPECT <b id="replayPosition">0 / 0</b></span><button id="ghostToggle" aria-pressed="false">Previous run</button></div><div class="timeline-track"><input id="replaySlider" type="range" min="0" max="0" value="0" aria-label="Inspect recorded generation"><div id="timelineEvents" class="timeline-events"></div></div><div id="eventReadout" class="event-readout">Pause or move the slider to inspect.</div></div>
      </div>
      <div id="missionResult" class="mission-result" hidden aria-live="polite"><div class="result-symbol" id="resultSymbol">✓</div><div class="result-copy"><span class="eyebrow" id="resultEyebrow">NETWORK RESTORED</span><h3 id="resultTitle">Signal received.</h3><p id="resultMessage"></p><div id="resultRecords" class="result-records"></div></div><div class="result-actions"><button id="resultInspect" data-pad="B">Inspect run</button><button id="resultRetry" data-pad="Y">Edit start</button><button id="nextMission" class="game-confirm" data-pad="A">Next mission ${icon('arrow')}</button></div></div>
      <button id="gameSound" class="game-sound" aria-pressed="false" title="Toggle game sound">Sound off</button>`
    );
    document.body.insertAdjacentHTML(
      'beforeend',
      `<dialog id="missionDialog" class="dialog mission-dialog"><div class="dialog-head"><div><span class="eyebrow">EMERGENCE / SIGNAL</span><h2>Restore the network.</h2></div><button class="icon-button" data-close="missionDialog" aria-label="Close missions">${icon('close')}</button></div><p class="dialog-intro">${WORDS[TOTAL] || TOTAL} missions in two chapters. Simple rules. No cost for a retry.</p><div id="missionCards" class="mission-cards"></div><p class="map-caption" id="mapCaption"></p></dialog>
      <dialog id="gameGuideDialog" class="dialog game-guide-dialog"><div class="dialog-head"><div><span class="eyebrow">FIELD MANUAL / SIGNAL</span><h2>Build a living machine.</h2></div><button class="icon-button" data-close="gameGuideDialog" aria-label="Close game guide">${icon('close')}</button></div><div class="guide-steps"><section><b>01</b><h3>Build</h3><p>Select a piece. Tap or click a cyan zone to set its preview. Rotate, flip, or move it. Select Confirm to place it.</p></section><section><b>02</b><h3>Run</h3><p>Select Launch. Conway’s rules move the field. Receivers detect live cells. Red regions cause failure; they do not block growth.</p></section><section><b>03</b><h3>Improve</h3><p>Pause and inspect any recorded generation. Select Edit start to change your arrangement. Tests and hints have no cost.</p></section></div><p class="guide-note">All deadlines use generations, not seconds. The speed control does not change the result. In containment missions, the field must stay safe through the full generation limit. Chapter two adds the Lightweight ship, which flies straight, and the Eater, a still shape that absorbs Gliders.</p><div class="guide-keys" id="guideKeys"></div><button id="guideDone" class="game-confirm">Start building ${icon('arrow')}</button></dialog>`
    );
    document.querySelector('.sprite defs').insertAdjacentHTML('beforeend', '<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>');
  }

  bind() {
    $('campaignMode').onclick = () => (this.active ? this.openMap() : this.toCampaign());
    $('sandboxMode').onclick = () => this.toSandbox();
    $('missionMap').onclick = () => this.openMap();
    $('campaignGuide').onclick = () => this.openGuide();
    $('guideDone').onclick = () => $('gameGuideDialog').close();
    document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
    $('gameOrbit').onclick = () => this.setMode('orbit');
    $('gamePlace').onclick = () => this.selectPiece(this.selected);
    $('gameRemove').onclick = () => this.setMode('remove');
    $('gameRotate').onclick = () => this.rotate();
    $('gameFlip').onclick = () => this.flipPiece();
    $('gameConfirm').onclick = () => this.confirm();
    $('gameCancel').onclick = () => this.cancelPreview();
    $('gameUndo').onclick = () => this.undo();
    $('gameRedo').onclick = () => this.redo();
    $('returnToBuild').onclick = () => this.rebuild();
    $('resultRetry').onclick = () => this.rebuild();
    $('resultInspect').onclick = () => this.inspectResult();
    $('nextMission').onclick = () => this.nextMission();
    $('replaySlider').oninput = (e) => this.seek(Number(e.target.value));
    $('ghostToggle').onclick = () => {
      this.showGhost = !this.showGhost;
      this.refresh();
    };
    document.querySelectorAll('[data-nudge]').forEach((b) => (b.onclick = () => this.nudge(...b.dataset.nudge.split(',').map(Number))));
    $('missionHint').onclick = () => this.hint();
    $('gameSound').onclick = () => this.toggleSound();
    $('saveProgress').onclick = () => this.download(this.progress, 'emergence-signal-progress.json');
    $('loadProgress').onclick = () => $('campaignFile').click();
    $('saveReplay').onclick = () => this.download(this.replayData(), `signal-${this.mission.id}-replay.json`);
    $('campaignFile').onchange = async (e) => {
      const file = e.target.files[0];
      try {
        if (!file) return;
        if (file.size > 250e3) throw new Error('Choose a file smaller than 250 KB.');
        const data = JSON.parse(await file.text());
        if (data.format === 'emergence-signal/replay-v1') {
          const replay = importReplay(data);
          this.selectMission(replay.mission.id, { placements: replay.placements });
          this.app.toast('Replay loaded. Launch to check the result.');
        } else {
          this.progress = importProgress(data);
          this.save();
          this.selectMission(this.progress.lastMission);
          this.app.toast('Progress loaded. Saved solutions were checked.');
        }
      } catch (err) {
        this.app.toast(err.message || 'The file could not be read.');
      } finally {
        e.target.value = '';
      }
    };
    addEventListener('pagehide', () => this.save());
  }

  boot() {
    this.selectMission(this.progress.lastMission);
    if (this.storageWarning) this.app.toast(this.storageWarning);
  }

  getState() {
    return {
      active: this.active,
      mission: this.mission?.id,
      phase: this.run ? this.run.result?.status || (this.app.isPlaying() ? 'run' : 'inspect') : 'build',
      placements: clone(this.placements),
      candidate: this.candidate ? clone(this.candidate) : null,
      generation: this.run?.life.generation || 0,
      hits: { ...this.run?.hits },
      result: this.run?.result ? clone(this.run.result) : null,
      frames: this.run?.frames.length || 0,
      cursor: this.run?.cursor || 0,
      mode: this.mode,
      selected: this.selected,
    };
  }

  save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch {
      this.storageWarning = 'Browser storage is unavailable. Use Save progress for a file copy.';
    }
  }

  storeDraft() {
    if (!this.mission) return;
    this.progress.drafts[this.mission.id] = clone(this.placements);
    this.progress.lastMission = this.mission.id;
    this.save();
  }

  download(data, name) {
    this.app.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);
    this.app.toast('File saved. Keep it as a separate backup.');
  }

  replayData() {
    return { format: 'emergence-signal/replay-v1', missionVersion: 1, mission: this.mission.id, placements: clone(this.placements) };
  }

  toggleSound() {
    const on = !this.sound;
    this.app.audio.setEnabled(on);
    try {
      localStorage.setItem(SOUND_KEY, String(on));
    } catch {
      /* the choice lasts for this visit */
    }
    this.beep('place');
    this.refresh();
  }

  hint() {
    if (!this.mission) return;
    this.hintLevel = Math.min(this.mission.hints.length, this.hintLevel + 1);
    this.refresh();
    // The hint panel sits in the sidebar, which phones keep in a closed drawer (and the
    // game menu offers hints too): show the text where the player is looking as well.
    const text = this.mission.hints[this.hintLevel - 1];
    if (text) this.app.toast(`Hint ${this.hintLevel}: ${text}`, 8000);
  }

  // ---------------------------------------------------------------- modes

  toSandbox() {
    if (!this.active) return;
    this.app.play(false);
    this.storeDraft();
    this.active = false;
    document.body.classList.remove('campaign-mode');
    $('campaignMode').setAttribute('aria-pressed', 'false');
    $('sandboxMode').setAttribute('aria-pressed', 'true');
    this.app.restoreSandbox(this.sandbox);
    this.app.setTool('orbit');
    this.app.closeSidebar();
    $('missionDialog').close();
    this.app.view()?.setMission(null);
    this.clearOverlay();
    this.app.toast('Sandbox: all patterns and editing tools are available.');
  }

  toCampaign() {
    if (!this.active) this.selectMission(this.progress.lastMission);
  }

  /** The zone a fresh piece should appear in: the first one where it fits next to what is placed. */
  defaultPlacement(pieceId) {
    const m = this.mission;
    const pts = transformPoints(PIECES[pieceId].points, 0, false);
    const w = Math.max(...pts.map((p) => p[0])) + 1;
    const h = Math.max(...pts.map((p) => p[1])) + 1;
    // Prefer an empty zone (each launch zone usually takes one piece) that is meant for this
    // piece (EATER zones for the Eater), then any zone it fits.
    const used = (z) => this.placements.some((p) => placementCells(p).some(([x, y]) => x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h));
    const fits = (z) => (z.label === 'EATER') === (pieceId === 'eater');
    const score = (z) => (used(z) ? 2 : 0) + (fits(z) ? 0 : 1);
    const zones = [...m.zones].sort((a, b) => score(a) - score(b));
    let first = null;
    for (const z of zones) {
      const c = { piece: pieceId, x: z.x + Math.floor((z.w - w) / 2), y: z.y + Math.floor((z.h - h) / 2), rotation: 0, flip: false };
      first ||= c;
      try {
        validatePlacements(m, [...this.placements, c]);
        return c;
      } catch {
        /* try the next zone */
      }
    }
    return first;
  }

  selectMission(id, opts = {}) {
    const mission = findMission(id);
    if (!mission) return false;
    if (this.active) this.storeDraft();
    else this.sandbox = this.app.captureSandbox();
    this.app.play(false);
    this.uiReady = false;
    this.active = true;
    this.mission = mission;
    this.placements = clone(opts.placements || this.progress.drafts[id] || []);
    try {
      validatePlacements(mission, this.placements);
    } catch {
      this.placements = [];
    }
    this.run = null;
    this.previousRun = null;
    this.resultRecorded = false;
    this.newRecord = false;
    this.dismissedResult = false;
    this.past = [];
    this.future = [];
    this.hintLevel = 0;
    this.showGhost = false;
    this.candidate = null;
    this.lockedPreview = false;
    this.selected = Object.keys(mission.inventory)[0];
    this.rotation = 0;
    this.flip = false;
    this.mode = 'place';
    this.cache = {};
    document.body.classList.add('campaign-mode');
    $('campaignMode').setAttribute('aria-pressed', 'true');
    $('sandboxMode').setAttribute('aria-pressed', 'false');
    this.app.replace(buildField(mission, this.placements), mission.name, mission.lesson);
    this.app.speed(12);
    this.app.setTool('stamp');
    this.app.closeSidebar();
    document.querySelectorAll('dialog[open]:not(.kit-menu)').forEach((d) => d.close());
    this.progress.lastMission = id;
    this.storeDraft();
    this.refreshStatic();
    this.selectPiece(this.selected);
    this.app.view()?.fit();
    this.syncMarkers();
    this.overlaySize();
    return true;
  }

  refreshStatic() {
    const m = this.mission;
    $('missionNumber').textContent = m.chapter;
    $('missionKind').textContent = m.kind;
    $('missionName').textContent = m.name;
    $('missionBrief').textContent = m.brief;
    $('missionLimit').textContent = `${m.limit} GEN`;
    $('missionFraction').textContent = `${m.chapter} / ${pad2(TOTAL)}`;
    $('shortGoal').textContent = m.goal;
    $('fieldLabel').textContent = `MISSION ${m.chapter}`;
    document.querySelector('.scene-tag').textContent = 'SIGNAL';
    $('hazardLegend').hidden = !m.hazards.length;
    $('pieceInventory').innerHTML = Object.entries(m.inventory)
      .map(
        ([id, n]) =>
          `<button data-piece="${id}" class="inventory-card"><span class="inventory-thumb">${pieceIcon(PIECES[id])}</span><span><b>${PIECES[id].name}</b><small>${PIECES[id].detail}</small></span><strong id="inventory-${id}">${n}</strong></button>`
      )
      .join('');
    $('pieceInventory')
      .querySelectorAll('[data-piece]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            this.selectPiece(b.dataset.piece, { sound: true });
            this.app.closeSidebar();
          })
      );
    this.uiReady = true;
    this.updateMap();
    this.refresh();
  }

  setMode(mode) {
    if (!this.active) return;
    if (this.run && mode !== 'orbit') {
      this.app.toast('Select Edit start before you change pieces.');
      return;
    }
    this.mode = mode;
    this.candidate = null;
    this.lockedPreview = false;
    this.app.setTool(mode === 'orbit' ? 'orbit' : mode === 'remove' ? 'erase' : 'stamp');
    this.refresh();
  }

  /** Pieces still in stock, in inventory order. */
  piecesLeft() {
    return Object.keys(this.mission?.inventory || {}).filter((id) => this.placements.filter((p) => p.piece === id).length < this.mission.inventory[id]);
  }

  /** Cycle View → Place (each piece type in stock) → Remove (gamepad Back). */
  nextMode() {
    if (this.run) return this.setMode('orbit');
    const left = this.piecesLeft();
    if (this.mode === 'orbit') {
      if (left.length) return this.selectPiece(left.includes(this.selected) ? this.selected : left[0], { sound: true });
      return this.setMode('remove');
    }
    if (this.mode === 'place') {
      const i = left.indexOf(this.selected);
      if (i >= 0 && i < left.length - 1) return this.selectPiece(left[i + 1], { sound: true });
      return this.placements.length ? this.setMode('remove') : this.setMode('orbit');
    }
    this.setMode('orbit');
  }

  selectPiece(id, { sound = false } = {}) {
    if (!this.active || this.run || !this.mission.inventory[id]) return;
    this.selected = id;
    this.rotation = 0;
    this.flip = false;
    this.mode = 'place';
    this.app.setTool('stamp');
    this.candidate = this.defaultPlacement(id);
    this.lockedPreview = true;
    this.refresh();
    this.showPreview();
    this.app.setCursorCell(this.candidateCenter());
    if (sound) this.beep('select');
  }

  setCandidate(p) {
    if (!this.active || this.run) return false;
    try {
      placementCells(p);
    } catch {
      return false;
    }
    this.selected = p.piece;
    this.rotation = p.rotation;
    this.flip = p.flip;
    this.mode = 'place';
    this.candidate = clone(p);
    this.lockedPreview = true;
    this.app.setTool('stamp');
    this.refresh();
    this.showPreview();
    return true;
  }

  candidateAt(cell) {
    const pts = transformPoints(PIECES[this.selected].points, this.rotation, this.flip);
    const w = Math.max(...pts.map((p) => p[0])) + 1;
    const h = Math.max(...pts.map((p) => p[1])) + 1;
    return { piece: this.selected, x: cell.x - Math.floor(w / 2), y: cell.y - Math.floor(h / 2), rotation: this.rotation, flip: this.flip };
  }

  /** The cell a cursor sits on to hold the current candidate. */
  candidateCenter() {
    if (!this.candidate) return null;
    const pts = transformPoints(PIECES[this.candidate.piece].points, this.candidate.rotation, this.candidate.flip);
    const w = Math.max(...pts.map((p) => p[0])) + 1;
    const h = Math.max(...pts.map((p) => p[1])) + 1;
    return { x: this.candidate.x + Math.floor(w / 2), y: this.candidate.y + Math.floor(h / 2) };
  }

  /** The keyboard/gamepad cursor carries the preview in Place mode. */
  moveCandidateTo(cell) {
    if (!this.active || this.run || this.mode !== 'place' || !cell) return;
    const c = this.candidateAt(cell);
    if (this.candidate && c.x === this.candidate.x && c.y === this.candidate.y && c.rotation === this.candidate.rotation && c.flip === this.candidate.flip) return;
    this.candidate = c;
    this.lockedPreview = true;
    this.refresh();
  }

  hoverCell(cell) {
    if (!this.active) return;
    if (this.mode === 'place' && !this.run && !this.lockedPreview) {
      const c = this.candidateAt(cell);
      if (!this.candidate || c.x !== this.candidate.x || c.y !== this.candidate.y || c.rotation !== this.candidate.rotation || c.flip !== this.candidate.flip) {
        this.candidate = c;
        this.refresh();
      }
    }
    this.showPreview();
  }

  /** A click or tap on the field. */
  pick(cell) {
    if (!this.active || this.run || this.mode === 'orbit' || !cell) return;
    if (this.mode === 'remove') {
      const i = this.placements.findIndex((p) => placementCells(p).some(([x, y]) => x === cell.x && y === cell.y));
      if (i < 0) {
        this.app.toast('Select one of your placed cells. Prepared cells cannot be removed.');
        return;
      }
      this.record();
      this.placements.splice(i, 1);
      this.updateBuild();
      this.beep('remove');
      this.app.rumble(0.25, 60);
    } else {
      this.candidate = this.candidateAt(cell);
      this.lockedPreview = true;
      this.refresh();
      this.showPreview();
    }
  }

  /**
   * The gamepad/keyboard "use" button at a cursor cell: in Place mode, the
   * first press moves the preview there and a second press confirms it.
   */
  actAt(cell, confirmFirst = false) {
    if (!this.active || this.run) return;
    if (this.mode === 'orbit') {
      this.selectPiece(this.selected);
      return;
    }
    if (this.mode === 'remove') return this.pick(cell);
    if (confirmFirst && this.candidate) return this.confirm();
    if (!cell) return;
    const c = this.candidateAt(cell);
    if (this.candidate && c.x === this.candidate.x && c.y === this.candidate.y && c.rotation === this.candidate.rotation && c.flip === this.candidate.flip) {
      this.confirm();
    } else {
      this.candidate = c;
      this.lockedPreview = true;
      this.refresh();
      this.showPreview();
    }
  }

  showPreview() {
    if (!this.active) return;
    const view = this.app.view();
    if (!view) return;
    let cells = [];
    if (!this.run && this.mode === 'place' && this.candidate) {
      try {
        cells = placementCells(this.candidate);
      } catch {
        cells = [];
      }
      view.previewCells(cells, !!this.validationError());
    } else {
      // No piece in hand: show where the keyboard/gamepad cursor is (red in Remove mode).
      view.previewCells(this.app.cursorPreview() || [], this.mode === 'remove' && !this.run);
    }
    this.overlayDirty = true;
  }

  validationError() {
    if (!this.candidate) return 'Choose a position in a cyan zone.';
    try {
      validatePlacements(this.mission, [...this.placements, this.candidate]);
      return '';
    } catch (err) {
      return err.message;
    }
  }

  record() {
    this.past.push(clone(this.placements));
    if (this.past.length > 64) this.past.shift();
    this.future = [];
  }

  confirm() {
    if (!this.active || this.run || !this.candidate) return false;
    const error = this.validationError();
    if (error) {
      this.app.toast(error);
      this.app.rumble(0.2, 50);
      return false;
    }
    this.record();
    this.placements.push(clone(this.candidate));
    this.candidate = null;
    this.lockedPreview = false;
    this.updateBuild();
    this.beep('place');
    this.app.rumble(0.35, 70);
    if (this.placements.length === pieceBudget(this.mission)) {
      this.mode = 'orbit';
      this.app.setTool('orbit');
      this.refresh();
      this.app.toast('Pieces placed. Select Launch to test your arrangement.');
    } else {
      // More pieces to place: show the next one ready to move.
      const left = this.piecesLeft();
      const next = left.includes(this.selected) ? this.selected : left[0];
      if (next) this.selectPiece(next);
    }
    return true;
  }

  cancelPreview() {
    this.candidate = null;
    this.lockedPreview = false;
    this.refresh();
    this.showPreview();
  }

  rotate() {
    if (this.run || !pieceTurns(this.selected)) return;
    this.rotation = (this.rotation + 1) % 4;
    if (this.candidate) this.candidate.rotation = this.rotation;
    this.refresh();
    this.showPreview();
    this.app.setCursorCell(this.candidateCenter());
  }

  flipPiece() {
    if (this.run || !pieceTurns(this.selected)) return;
    this.flip = !this.flip;
    if (this.candidate) this.candidate.flip = this.flip;
    this.refresh();
    this.showPreview();
    this.app.setCursorCell(this.candidateCenter());
  }

  nudge(dx, dy) {
    if (this.run || !this.candidate) return;
    this.candidate.x += dx;
    this.candidate.y += dy;
    this.lockedPreview = true;
    this.refresh();
    this.showPreview();
    this.app.setCursorCell(this.candidateCenter());
  }

  updateBuild() {
    this.app.adopt(buildField(this.mission, this.placements));
    this.app.changed(true);
    this.storeDraft();
    this.syncMarkers();
    this.refresh();
    this.showPreview();
  }

  // ---------------------------------------------------------------- runs

  ensureRun() {
    if (!this.active) return true;
    if (!this.run) {
      if (!this.placements.length) {
        this.app.toast('Confirm at least one piece before you launch.');
        return false;
      }
      this.run = new MissionRun(this.mission, this.placements);
      this.candidate = null;
      this.resultRecorded = false;
      this.newRecord = false;
      this.dismissedResult = false;
      this.lastEventCount = 0;
      this.mode = 'orbit';
      this.app.setTool('orbit');
      this.app.adopt(this.run.life);
      this.beep('launch');
      this.app.changed(true);
    }
    if (this.run.result) {
      this.app.toast('Select Edit start to change the arrangement, or inspect an earlier generation.');
      return false;
    }
    return true;
  }

  advance(count = 1, render = true) {
    if (!this.ensureRun()) return;
    for (let i = 0; i < count && this.run.step(); i++) {
      this.app.adopt(this.run.life);
      this.app.pushGraph();
      this.handleEvents();
      if (this.run.result) {
        this.app.play(false);
        break;
      }
    }
    if (render) this.app.changed();
    else this.syncMarkers();
  }

  handleEvents() {
    const events = this.run.events;
    if (events.length > this.lastEventCount) {
      for (const e of events.slice(this.lastEventCount)) {
        this.beep(e.type);
        if (e.type === 'receiver') this.app.rumble(0.45, 110);
        else if (e.type === 'failure') this.app.rumble(0.8, 260);
        else if (e.type === 'success') this.app.rumble(0.6, 220);
      }
      this.lastEventCount = events.length;
    }
    if (this.run.result?.status === 'success' && !this.resultRecorded) {
      this.newRecord = recordRun(this.progress, this.run);
      this.resultRecorded = true;
      this.save();
      this.updateMap();
    }
  }

  seek(index) {
    if (!this.run) return;
    this.app.play(false);
    this.run.seek(index);
    this.lastEventCount = this.run.events.length;
    this.dismissedResult = true;
    this.app.adopt(this.run.life);
    this.app.changed(true);
    this.syncMarkers();
  }

  rebuild() {
    if (!this.active) return;
    this.app.play(false);
    if (this.run) {
      this.previousRun = this.run;
      this.run = null;
    }
    this.resultRecorded = false;
    this.dismissedResult = false;
    this.mode = 'place';
    this.candidate = null;
    this.app.setTool('stamp');
    this.updateBuild();
    this.app.toast('Starting arrangement restored. Change pieces, then launch again.');
  }

  inspectResult() {
    this.dismissedResult = true;
    this.refresh();
  }

  nextMission() {
    const next = MISSIONS[MISSIONS.indexOf(this.mission) + 1];
    if (next) this.selectMission(next.id);
    else this.openMap();
  }

  /** The result card is up: its buttons answer the gamepad directly. */
  get resultShown() {
    return !!(this.active && this.run?.result && !this.dismissedResult);
  }

  undo() {
    if (!this.active) return;
    if (this.run) {
      if (this.run.cursor > 0) this.seek(this.run.cursor - 1);
      return;
    }
    if (this.past.length) {
      this.future.push(clone(this.placements));
      this.placements = this.past.pop();
      this.updateBuild();
    }
  }

  redo() {
    if (!this.active) return;
    if (this.run) {
      if (this.run.cursor < this.run.frames.length - 1) this.seek(this.run.cursor + 1);
      return;
    }
    if (this.future.length) {
      this.past.push(clone(this.placements));
      this.placements = this.future.pop();
      this.updateBuild();
    }
  }

  openMap() {
    this.app.play(false);
    this.app.closeSidebar();
    this.updateMap();
    this.app.openDialog('missionDialog');
  }

  openGuide() {
    this.app.play(false);
    this.app.closeSidebar();
    $('guideKeys').innerHTML = this.app.controlsHelp('campaign');
    this.app.openDialog('gameGuideDialog');
  }

  updateMap() {
    const done = MISSIONS.filter((m) => this.progress.records[m.id]).length;
    $('missionCards').innerHTML = MISSIONS.map((m, i) => {
      const r = this.progress.records[m.id];
      const heading =
        i === 0
          ? '<h3 class="map-chapter">Chapter one · Restore the network</h3>'
          : i === CHAPTER_TWO
            ? '<h3 class="map-chapter">Chapter two · The gun line</h3>'
            : '';
      const par = r ? (r.pieces <= m.par ? ' · par ✓' : ` · par ${m.par}`) : '';
      return `${heading}<button class="mission-card ${r ? 'complete' : ''} ${this.mission?.id === m.id ? 'current' : ''}" data-mission="${m.id}"><span class="map-number">${m.chapter}</span><span><small>${m.kind}</small><b>${m.name}</b><em>${
        r ? `${r.pieces} piece${r.pieces === 1 ? '' : 's'}${par} · first complete arrival ${r.arrival}` : m.lesson
      }</em></span><i>${r ? '✓' : '↗'}</i></button>`;
    }).join('');
    $('missionCards')
      .querySelectorAll('[data-mission]')
      .forEach((b) => (b.onclick = () => this.selectMission(b.dataset.mission)));
    $('missionProgress').innerHTML = MISSIONS.map(
      (m) =>
        `<button data-mission="${m.id}" class="${this.progress.records[m.id] ? 'complete' : ''} ${this.mission?.id === m.id ? 'current' : ''}" title="${m.name}" aria-label="Mission ${m.chapter}: ${m.name}">${
          this.progress.records[m.id] ? '✓' : m.chapter
        }</button>`
    ).join('');
    $('missionProgress')
      .querySelectorAll('button')
      .forEach((b) => (b.onclick = () => this.selectMission(b.dataset.mission)));
    $('mapCaption').textContent =
      done === TOTAL
        ? `All ${TOTAL} missions passed. Improve your records, or build freely in Sandbox.`
        : `${done} of ${TOTAL} missions complete. All missions are available. Play in order to learn each tool.`;
  }

  refresh() {
    if (!this.active || !this.mission || !this.uiReady) return;
    this.overlayDirty = true;
    const m = this.mission;
    const run = this.run;
    const gen = run?.life.generation || 0;
    const hits = run?.hits || {};
    const playing = this.app.isPlaying();
    const result = run?.result;
    const phase = result ? (result.status === 'success' ? 'COMPLETE' : 'STOPPED') : run ? (playing ? 'RUNNING' : 'INSPECT') : 'BUILD';
    setText($('phaseLabel'), phase);
    $('phaseDot').className = phase.toLowerCase();
    $('buildControls').hidden = !!run;
    $('replayControls').hidden = !run;
    setText($('playText'), run ? (playing ? 'Pause' : result ? 'Finished' : 'Resume') : 'Launch');
    $('play').disabled = !!result;
    $('play').setAttribute('aria-label', run ? (playing ? 'Pause run' : result ? 'Run finished' : 'Resume run') : 'Launch mission');
    $('step').disabled = !!result;
    $('reset').title = 'Return to your starting arrangement';
    $('reset').setAttribute('aria-label', 'Return to your starting arrangement');
    $('backStep').disabled = run ? !run.cursor : !this.past.length;
    $('undo').disabled = $('backStep').disabled;
    $('redo').disabled = run ? run.cursor >= run.frames.length - 1 : !this.future.length;
    $('gameUndo').disabled = !this.past.length;
    $('gameRedo').disabled = !this.future.length;
    for (const [id, n] of Object.entries(m.inventory)) {
      const used = this.placements.filter((p) => p.piece === id).length;
      setText($(`inventory-${id}`), `${n - used}/${n}`);
      const card = $('pieceInventory').querySelector(`[data-piece="${id}"]`);
      card.disabled = !!run || used >= n;
      card.classList.toggle('selected', this.selected === id && this.mode === 'place');
    }
    setText($('pieceBudget'), `${this.placements.length} / ${pieceBudget(m)} PLACED`);
    const goal = (r) => {
      const hit = hits[r.id] !== undefined;
      const detail = hit
        ? `Activated at generation ${hits[r.id]}`
        : r.window
          ? `First contact: ${r.window[0]}–${r.window[1]}`
          : m.order
            ? `Order ${m.order.indexOf(r.id) + 1} · by ${m.limit}`
            : `By generation ${m.limit}`;
      return `<div class="goal-item ${hit ? 'complete' : ''}"><span class="goal-mark">${hit ? '✓' : r.id}</span><span><b>Receiver ${r.id}</b><small>${detail}</small></span><i>${hit ? 'ONLINE' : 'WAITING'}</i></div>`;
    };
    const goals =
      m.receivers.map(goal).join('') +
      (m.hazards.length
        ? `<div class="goal-item safety ${result?.status === 'success' ? 'complete' : ''}"><span class="goal-mark">${result?.code === 'hazard' ? '!' : '◇'}</span><span><b>Keep red regions empty</b><small>Full test: ${gen} / ${m.limit} generations</small></span></div>`
        : '');
    setHTML($('goalList'), goals, this.cache, 'goals');
    setHTML(
      $('receiverPills'),
      m.receivers
        .map((r) => `<span class="${hits[r.id] !== undefined ? 'complete' : ''}">${hits[r.id] !== undefined ? '✓' : '◎'} ${r.id}${hits[r.id] !== undefined ? ` <b>${hits[r.id]}</b>` : ''}</span>`)
        .join('') + `<span class="generation-pill">${gen} / ${m.limit}</span>`,
      this.cache,
      'pills'
    );
    setText($('selectedPiece'), PIECES[this.selected]?.name || '');
    setText($('directionLabel'), orientationLabel(this.selected, this.rotation, this.flip));
    $('gameRotate').disabled = $('gameFlip').disabled = !pieceTurns(this.selected);
    for (const [id, mode] of [
      ['gameOrbit', 'orbit'],
      ['gamePlace', 'place'],
      ['gameRemove', 'remove'],
    ]) {
      $(id).classList.toggle('selected', this.mode === mode);
      $(id).setAttribute('aria-pressed', String(this.mode === mode));
    }
    $('placementControls').hidden = this.mode !== 'place';
    $('positionRow').hidden = this.mode !== 'place';
    const error = this.validationError();
    $('gameConfirm').disabled = !!error || !this.candidate;
    setText($('positionStatus'), this.candidate ? `${this.candidate.x}, ${this.candidate.y} · ${error || 'Ready to place'}` : 'Tap a cyan zone to preview.');
    $('positionStatus').classList.toggle('invalid', !!this.candidate && !!error);
    document.querySelectorAll('[data-nudge]').forEach((b) => (b.disabled = !this.candidate));
    setText($('hintCount'), `${this.hintLevel} / ${m.hints.length}`);
    $('hintText').hidden = !this.hintLevel;
    setText($('hintText'), m.hints[this.hintLevel - 1] || '');
    $('missionHint').disabled = this.hintLevel >= m.hints.length;
    const rec = this.progress.records[m.id];
    setHTML(
      $('missionRecord'),
      rec
        ? `<span>PERSONAL RECORDS · PAR ${m.par}</span><b>${rec.pieces} piece${rec.pieces === 1 ? '' : 's'} <i> / </i> arrival ${rec.arrival}</b>`
        : `<span>NO PENALTY FOR RETRIES OR HINTS · PAR ${m.par} PIECE${m.par === 1 ? '' : 'S'}</span>`,
      this.cache,
      'record'
    );
    setText(
      $('pieceInstruction'),
      run
        ? 'Pieces are locked during a test. Select Edit start to make changes.'
        : this.mode === 'remove'
          ? 'Select a cell in one of your pieces to remove that complete piece.'
          : 'Select a piece. Choose a position. Confirm.'
    );
    $('ghostToggle').disabled = !this.previousRun;
    $('ghostToggle').setAttribute('aria-pressed', String(this.showGhost));
    if (run) {
      const last = run.frames.length - 1;
      $('replaySlider').max = last;
      $('replaySlider').value = run.cursor;
      setText($('replayPosition'), `${run.cursor} / ${last}`);
      const span = Math.max(1, last);
      $('replaySlider').style.setProperty('--range', `${(run.cursor / span) * 100}%`);
      const marks = run.frames
        .at(-1)
        .events.filter((e) => e.type === 'receiver' || e.type === 'failure')
        .map(
          (e) =>
            `<button style="left:${(e.generation / span) * 100}%" class="${e.type}" data-generation="${e.generation}" title="${e.type === 'receiver' ? 'Receiver ' + e.id : 'Failure'} at ${e.generation}" aria-label="Inspect generation ${e.generation}"></button>`
        )
        .join('');
      if (setHTML($('timelineEvents'), marks, this.cache, 'marks')) {
        $('timelineEvents')
          .querySelectorAll('button')
          .forEach((b) => (b.onclick = () => this.seek(Number(b.dataset.generation))));
      }
      const latest = run.events.at(-1);
      setText(
        $('eventReadout'),
        result?.message ||
          (latest?.type === 'receiver'
            ? `Receiver ${latest.id} activated at generation ${latest.generation}. ${m.holdToEnd ? 'Safety test continues.' : ''}`
            : 'Each generation is recorded. Pause to inspect.')
      );
    }
    $('missionResult').hidden = !result || this.dismissedResult;
    if (result) {
      const ok = result.status === 'success';
      $('missionResult').classList.toggle('failed', !ok);
      setText($('resultSymbol'), ok ? '✓' : '!');
      setText($('resultEyebrow'), ok ? (this.newRecord ? 'NEW PERSONAL RECORD' : 'MISSION COMPLETE') : 'TEST STOPPED');
      setText($('resultTitle'), ok ? 'Signal received.' : 'Change the start.');
      setText(
        $('resultMessage'),
        ok ? (m.holdToEnd ? `All receivers activated. Safety test passed through generation ${m.limit}.` : `Receiver check passed at generation ${gen}.`) : result.message
      );
      setText(
        $('resultRecords'),
        ok
          ? `${result.pieces} piece${result.pieces === 1 ? '' : 's'} used (par ${m.par}${result.pieces <= m.par ? ' ✓' : ''}) · last receiver ${result.arrival}`
          : 'Inspect the marked generation. Retries have no cost.'
      );
      $('nextMission').hidden = !ok;
      setHTML($('nextMission'), MISSIONS.indexOf(m) === TOTAL - 1 ? `Mission map ${icon('arrow')}` : `Next mission ${icon('arrow')}`, this.cache, 'next');
    }
    setText($('gameSound'), this.sound ? 'Sound on' : 'Sound off');
    $('gameSound').setAttribute('aria-pressed', String(this.sound));
    setText($('interactionHint'), this.app.hintText());
    this.syncMarkers();
    this.showPreview();
  }

  syncMarkers() {
    this.overlayDirty = true;
    this.app.view()?.setMission(
      this.active
        ? { mission: this.mission, hits: this.run?.hits || {}, generation: this.run?.life.generation || 0, failure: this.run?.result?.cell || null }
        : null
    );
  }

  // ---------------------------------------------------------------- overlay

  overlaySize() {
    const canvas = $('missionOverlay');
    const stage = $('stage');
    this.overlayWidth = stage.clientWidth;
    this.overlayHeight = stage.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(this.overlayWidth * dpr);
    canvas.height = Math.round(this.overlayHeight * dpr);
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    this.overlayDirty = true;
  }

  clearOverlay() {
    const canvas = $('missionOverlay');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Labels, outlines and the ghost run over the 3D view. Redrawn only when the camera or the state changed. */
  drawOverlay(cameraMoved) {
    if (!this.active || !this.mission) return;
    const view = this.app.view();
    if (!view) return;
    if (!cameraMoved && !this.overlayDirty) return;
    this.overlayDirty = false;
    const canvas = $('missionOverlay');
    const ctx = canvas.getContext('2d');
    // Cached rects (measured on resize and once a second): no layout reads while the camera moves.
    const stageRect = this.app.stageRect();
    const canvasRect = this.app.canvasRect();
    if (Math.round(this.overlayWidth) !== Math.round(stageRect.width) || Math.round(this.overlayHeight) !== Math.round(stageRect.height)) this.overlaySize();
    ctx.clearRect(0, 0, this.overlayWidth, this.overlayHeight);
    const at = (x, y) => {
      const p = view.cellToScreen(x - 0.5, y - 0.5, canvasRect);
      return [p.x - stageRect.left, p.y - stageRect.top];
    };
    const box = (r, stroke, fill, dash = []) => {
      const pts = [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
      ].map((p) => at(...p));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.stroke();
      ctx.setLineDash([]);
      return pts;
    };
    const label = (text, p, tint, backing = true) => {
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 14;
      if (backing) {
        ctx.fillStyle = '#07171de8';
        ctx.beginPath();
        ctx.roundRect(p[0] - w / 2, p[1] - 17, w, 21, 4);
        ctx.fill();
      }
      ctx.fillStyle = tint;
      ctx.fillText(text, p[0], p[1] - 3);
    };
    const m = this.mission;
    for (const z of m.zones) {
      box(z, '#72cbe0', null, [4, 4]);
      label(z.label, at(z.x + z.w / 2, z.y), '#a1e1ef');
    }
    for (const h of m.hazards) {
      const pts = box(h, '#fb9a89', null, [5, 3]);
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = '#e5937933';
      ctx.lineWidth = 1;
      for (let d = -this.overlayHeight; d < this.overlayWidth; d += 14) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + this.overlayHeight, this.overlayHeight);
        ctx.stroke();
      }
      ctx.restore();
      // Thin strips (a frame of red) stay unlabelled so the labels do not pile up.
      if (h.w >= 3 && h.h >= 3) label('! FORBIDDEN', at(h.x + h.w / 2, h.y + h.h / 2), '#ffb5a0');
    }
    for (const r of m.receivers) {
      const hit = this.run?.hits[r.id] !== undefined;
      const tint = hit ? '#d6ee9d' : '#e5c788';
      box(r, tint, null);
      const c = at(r.x + r.w / 2, r.y + r.h / 2);
      ctx.beginPath();
      ctx.arc(c[0], c[1], Math.max(9, Math.min(17, Math.abs(at(r.x + r.w, r.y)[0] - at(r.x, r.y)[0]) * 0.35)), 0, Math.PI * 2);
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(`${hit ? '✓ ' : ''}${r.id}`, at(r.x + r.w / 2, r.y), tint);
    }
    const failure = this.run?.result?.cell;
    if (failure) {
      box({ x: failure.x, y: failure.y, w: 1, h: 1 }, '#ffbfae', '#ff775a44');
      label('FAILURE', at(failure.x + 0.5, failure.y), '#ffbfae');
    }
    if (this.showGhost && this.previousRun) {
      const frame = Math.min(this.run?.cursor || 0, this.previousRun.frames.length - 1);
      const ghost = this.previousRun.frames[frame].life;
      for (let i = 0; i < ghost.cells.length; i++) {
        if (ghost.cells[i]) box({ x: i % ghost.size, y: Math.floor(i / ghost.size), w: 1, h: 1 }, '#c3b4e46b', '#cab6f015');
      }
    }
    if (!this.run && this.candidate && this.mode === 'place') {
      const error = this.validationError();
      let cells = [];
      try {
        cells = placementCells(this.candidate);
      } catch {
        cells = [];
      }
      for (const [x, y] of cells) box({ x, y, w: 1, h: 1 }, error ? '#ff9985' : '#d7ef9e', error ? '#ff998522' : '#d7ef9e28', [3, 2]);
    }
  }
}
