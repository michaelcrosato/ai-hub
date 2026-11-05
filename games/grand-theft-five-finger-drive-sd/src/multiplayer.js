/* AI Hub Protocol v1 adapter. Transport lives only in the unmodified client.
 * A ghost is presentation data. It never enters the simulation or a save. */
(() => {
const G = Drive, E = G.E;
const COLORS = ['#e8443a', '#3b82f6', '#22c55e', '#f5b700'];
G.raceScore = s => Math.min(s.definition.stages.length, s.progress) * 1000;
G.raceResult = (s, elapsed, won) => ({
  ...(won ? {time: Math.max(0, Math.round(elapsed))} : {score: G.raceScore(s)}),
  stats: {Objectives: s.progress, Impacts: s.metrics.crashes, 'Crew switches': s.metrics.switches}
});
G.raceTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

G.HubRace = class {
  constructor(app, hub) {
    this.app = app; this.api = hub; this.phase = 'connecting'; this.info = null;
    this.peers = new Map(); this.left = new Set(); this.sequence = 0;
    this.lastSend = -Infinity; this.lastProgress = -Infinity; this.sentResult = false;
    this.off = [];
  }
  async connect() {
    const h = this.api;
    this.off.push(h.on('time-up', () => this.finish(false)));
    this.off.push(h.on('end', () => this.end()));
    this.off.push(h.on('leave', ({id}) => { this.left.add(id); this.peers.delete(id); }));
    this.off.push(h.on('message', (data, from) => this.receive(data, from)));
    try {
      const info = await h.connect({mode: 'ghost', seats: [1, 4]});
      if (this.phase === 'ended') return;
      if (!info) {
        this.dispose(); this.app.hub = null; this.app.game.o.autoPause = true;
        this.app.title(); return;
      }
      this.info = info;
      this.app.start({seed: info.seed >>> 0, ephemeral: true, hubRound: true});
      this.app.game.scenes.play.pausable = false;
      this.phase = 'waiting';
      h.ready();
    } catch (error) {
      if (this.phase !== 'ended') { h.fail('The Meter Job could not start: ' + error.message); this.end(); }
    }
  }
  frame() {
    if (!this.info || this.phase === 'ended' || this.phase === 'finished') return;
    const time = this.api.time();
    if (time < 0) return;
    if (this.phase === 'waiting') {
      this.phase = 'playing'; this.app.game.input.clear();
      this.app.game.resume(); this.app.musicState = null;
    }
    if (this.phase !== 'playing') return;
    const s = this.app.session;
    if (time - this.lastProgress >= 1000) {
      this.lastProgress = time;
      this.api.progress({score: G.raceScore(s), label: `${s.progress}/${s.definition.stages.length} objectives`});
    }
    if (time - this.lastSend >= 100) {
      this.lastSend = time;
      const a = s.controlled, car = s.cars.find(v => v.id === a.vehicle);
      this.api.send({v: 1, n: ++this.sequence, zone: a.zone, x: a.x, y: a.y,
        z: a.z, facing: car?.facing ?? a.facing ?? 0, crew: a.id,
        car: car?.type || null, moving: Math.hypot(a.vx || 0, a.vy || 0) > 5}, {reliable: false});
    }
    for (const [id, peer] of this.peers) if (time - peer.at > 5000) this.peers.delete(id);
  }
  beforeInput() {
    const input = this.app.game.input;
    // Options never pauses a hub round. Create + Options remains the hub's.
    input.consume('pause');
    if ((input.padValues?.[8] || 0) > .5) {
      for (const key of ['cancel', 'confirm', 'start']) input.consume(key);
    }
    if (this.phase !== 'playing') { input.clear(); return false; }
    return true;
  }
  receive(data, from) {
    if (!this.info || this.phase === 'ended' || this.left.has(from) || from === this.info.me) return;
    const player = this.info.players.find(p => p.id === from);
    if (!player || !data || data.v !== 1 || !Number.isSafeInteger(data.n) || data.n < 1) return;
    if (!['city', 'records', 'gantry'].includes(data.zone)) return;
    if (!['x', 'y', 'z', 'facing'].every(k => Number.isFinite(data[k]))) return;
    const bounds = data.zone === 'city' ? [2560, 1920] : data.zone === 'records' ? [512, 384] : [1280, 64];
    if (data.x < -32 || data.x > bounds[0] + 32 || data.y < -32 || data.y > bounds[1] + 32 || Math.abs(data.z) > 512) return;
    if (!G.content.crew.some(c => c.id === data.crew) || data.car !== null && !Object.hasOwn(G.content.vehicles, data.car)) return;
    const previous = this.peers.get(from);
    if (previous && data.n <= previous.n) return;
    // Copy only the small, validated packet. Names and colours come from seats.
    const color = COLORS[from] || COLORS[0];
    const peer = {n: data.n, x: data.x, y: data.y, z: data.z, zone: data.zone,
      facing: data.facing, crew: data.crew, car: data.car, moving: data.moving === true,
      at: this.api.time(), color, label: `P${from + 1}`,
      rig: previous?.rig || new E.Humanoid({size: 1.2, build: 'heroic', outfit: 'shirt',
        colors: {cloth: color, pants: '#567078', skin: '#d9b59a'}})};
    peer.rig.update(.1, {x: peer.x, y: peer.y, z: peer.z, facing: peer.facing,
      vx: peer.moving ? Math.cos(peer.facing) * 60 : 0,
      vy: peer.moving ? Math.sin(peer.facing) * 60 : 0, vz: 0});
    this.peers.set(from, peer);
  }
  finish(won) {
    if (this.sentResult || this.phase === 'ended' || !this.info) return;
    this.sentResult = true; this.phase = 'finished';
    const s = this.app.session;
    this.api.progress({score: G.raceScore(s), label: won ? 'Ledger delivered' : 'Run ended'});
    this.api.result(G.raceResult(s, this.api.time(), won));
    this.app.shell.hide(); this.app.game.pause('race-result');
    this.app.game.input.clear(); this.app.game.audio.stopMusic();
  }
  end() {
    if (this.phase === 'ended') return;
    this.phase = 'ended'; this.peers.clear(); this.dispose();
    this.app.shell.hide(); this.app.game.input.clear(); this.app.game.input.stopRumble();
    this.app.game.audio.stopMusic(); this.app.game.audio.mute(true);
    this.app.audioUnlocked = false; this.app.game.pause('hub-end');
  }
  dispose() { for (const off of this.off.splice(0)) off(); }
  draw(r) {
    if (!this.info) return;
    const zone = this.app.session.controlled.zone;
    for (const peer of this.peers.values()) {
      if (peer.zone !== zone || !r.visible(peer.x, peer.y, peer.z, 70, 70, 70)) continue;
      if (peer.car) {
        r.shape('sd-car-' + peer.car, peer.x, peer.y, peer.z,
          {facing: peer.facing, mats: {body: peer.color, glass: '#aecbd1'}, charView: false, alpha: .4, shadow: false, hides: false});
      } else {
        r.actor(peer.x, peer.y, peer.z, (g, x, y) => {
          peer.rig.draw(g, x, y, r.view);
        }, {key: peer.rig, every: 3, alpha: .4, hides: false});
      }
      r.queue(peer.x, peer.y, peer.z, g => {
        const [x, y] = r.w(peer.x, peer.y, peer.z + 46);
        G.text(g, peer.label + ' GHOST', x, y, peer.color, {font: 'tiny', align: 'center', shadow: '#102c35'});
      });
    }
    r.overlay(g => {
      const time = this.api.time();
      const text = this.phase === 'playing' ? `P${this.info.me + 1} / RACE ${G.raceTime(Math.max(0, time))}`
        : this.phase === 'finished' ? 'RUN ENDED / WAIT FOR RESULTS'
        : this.phase === 'ended' ? 'ROUND ENDED'
        : Number.isFinite(time) ? 'START IN ' + Math.ceil(-time / 1000) : 'WAITING FOR THE HUB';
      G.text(g, text, r.W / 2, 3, COLORS[this.info.me] || '#f5be62', {font: 'tiny', align: 'center', shadow: '#102c35'});
    });
  }
};

G.LocalRace = class {
  constructor(app, count, seed) {
    this.app = app; this.count = count; this.seed = seed; this.seat = 0;
    this.results = []; this.phase = 'card'; this.startedAt = 0; this.limitMs = 18 * 60 * 1000;
    this.now = () => typeof performance === 'undefined' ? app.clock * 1000 : performance.now();
  }
  card() {
    this.phase = 'card'; this.app.mode = 'party-card';
    this.app.shell.hide(); this.app.game.pause('pass-controller');
    this.app.shell.show('local-race-card', {kicker: 'LOCAL RACE / SAME START FOR EVERY PLAYER',
      title: `Player ${this.seat + 1} of ${this.count}`,
      text: 'Pass the controller. Deliver the ledger as fast as you can.\nEach turn has an 18-minute limit. Unfinished runs rank by objectives.\nPause menus do not stop the race clock.',
      back: () => this.app.title(),
      actions: [['Start this turn', () => this.start()], ['Cancel race', () => this.app.title()]]});
  }
  start() {
    if (this.phase !== 'card') return;
    this.app.start({seed: this.seed, ephemeral: true, partyRound: true});
    this.phase = 'playing'; this.startedAt = this.now();
  }
  frame() {
    if (this.phase === 'playing' && this.now() - this.startedAt >= this.limitMs) this.finish(false);
  }
  finish(won) {
    if (this.phase !== 'playing') return;
    this.phase = 'result';
    this.results.push({seat: this.seat, ...G.raceResult(this.app.session, this.now() - this.startedAt, won)});
    this.app.mode = 'party-results'; this.app.shell.hide(); this.app.game.pause('race-result');
    this.app.game.input.clear(); this.app.game.audio.stopMusic();
    const order = [...this.results].sort((a, b) =>
      a.time !== undefined && b.time !== undefined ? a.time - b.time :
      a.time !== undefined ? -1 : b.time !== undefined ? 1 : b.score - a.score);
    const last = this.results.length === this.count;
    this.app.shell.show('local-race-results', {kicker: last ? 'RACE COMPLETE' : 'TURN COMPLETE',
      title: last ? 'The crew race results' : `Player ${this.seat + 1} finished`,
      text: order.map((p, i) => `${i + 1}. Player ${p.seat + 1} / ${p.time !== undefined ? G.raceTime(p.time) : p.score / 1000 + ' objectives'}`).join('\n'),
      back: () => this.app.title(),
      actions: last ? [['Race again', () => this.app.localRace(this.count)], ['Title', () => this.app.title()]]
        : [['Next player', () => { if (this.phase !== 'result') return; this.seat++; this.card(); }], ['End race', () => this.app.title()]]});
  }
  draw(r) {
    if (this.phase !== 'playing') return;
    const left = Math.max(0, this.limitMs - (this.now() - this.startedAt));
    r.overlay(g => G.text(g, `PLAYER ${this.seat + 1} / ${G.raceTime(left)} LEFT`, r.W / 2, 3,
      COLORS[this.seat], {font: 'tiny', align: 'center', shadow: '#102c35'}));
  }
};
})();
