import { clamp, damp, distance, dot, add, sub, scale, forward, right, wrapAngle, boxCorners, polygonHit, polygonsOverlap, hash, rng } from './math.js';
import { TrafficSystem, signalPhase } from './traffic.js';
import { makePassenger, interactionFor, AMBIENT } from './dialogue.js';

export const BUS_SPEC = Object.freeze({ length: 12, width: 2.55, wheelbase: 5.9, massEmpty: 12800, passengerMass: 75, maxPower: 230000, maxForce: 21000, maxSteer: 0.58, batteryKWh: 300 });

/** Shift types on the title screen: traffic density, extra riders, and the stop-approach guide. */
export const DIFFICULTIES = Object.freeze({
  training: Object.freeze({ id: 'training', label: 'Training', traffic: 0.6, extraRiders: 0, guide: true }),
  standard: Object.freeze({ id: 'standard', label: 'Standard', traffic: 1, extraRiders: 0, guide: true }),
  rush: Object.freeze({ id: 'rush', label: 'Rush hour', traffic: 1.6, extraRiders: 1, guide: false }),
});

export class Simulation {
  constructor(world, options = {}) {
    const difficulty = DIFFICULTIES[options.difficulty] || DIFFICULTIES.standard;
    this.world = world; this.difficulty = difficulty;
    this.options = { traffic: difficulty.traffic, weather: 'dry', ...options, difficulty: difficulty.id };
    this.random = rng(options.seed ?? 4070147);
    this.memory = { ...(options.memory || {}) }; this.time = 0; this.paused = true; this.started = false; this.completed = false; this.endReason = null;
    const initial = world.stops[0], p = world.at(initial.s);
    this.bus = {
      x: initial.dock[0], z: initial.dock[1], yaw: initial.yaw ?? p.yaw, v: 0, steer: 0, acceleration: 0, lateralAcceleration: 0,
      throttle: 0, brake: 0, brakePressure: 0, engine: false, starting: 0, gear: 'N', parking: true, belt: false, lights: true,
      indicator: null, hazards: false, front: 0, rear: 0, frontTarget: 0, rearTarget: 0, kneel: 0, kneelTarget: 0, ramp: 0, rampTarget: 0,
      battery: 88, air: 9.8, wipers: false, odometer: 0, energyUsed: 0,
    };
    this.scores = { safety: 100, service: 100, punctuality: 100, comfort: 100 }; this.events = []; this.log = []; this.cooldown = new Map();
    this.stopIndex = 0; this.routePosition = initial.s; this.previousRoutePosition = initial.s;
    this.roadInfo = world.nearestRoad([this.bus.x, this.bus.z]); this.roadClock = 0;
    this.passengers = []; this.served = []; this.interaction = null; this.boardingTimer = 0; this.alightTimer = 0; this.extraWait = 0;
    this.arrivedAt = null; this.serviceReady = false; this.stopRequested = false; this.mirrorChecked = -100; this.pulloutChecked = false;
    this.overspeedTime = 0; this.wrongSideTime = 0; this.offroadTime = 0; this.beltTime = 0; this.signalStates = new Map(); this.stopSignStates = new Map(); this.turnsChecked = new Set();
    this.ambientNext = 65; this.ambientUsed = new Set(); this.ambientQueue = []; this.ambientLineAt = 0; this.status = 'Secure the bus, greet your first riders.';
    this.lastImpact = -10; this.indicatorTurned = false;
    const specials = new Map(world.specials.map(([stop, slot, kind]) => [`${stop}:${slot}`, kind]));
    this.manifests = world.stops.map((stop, i) => {
      if (i === world.stops.length - 1 || String(stop.pickupType) === '1') return [];
      const destinations = world.stops.map((s, k) => (k > i && String(s.dropOffType) !== '1' ? k : -1)).filter((k) => k >= 0); if (!destinations.length) return [];
      const count = (i === 0 ? 3 : 2 + Math.floor(this.random() * 3)) + difficulty.extraRiders; const riders = [];
      for (let j = 0; j < count; j++) {
        const kind = specials.get(`${i}:${j}`) || null;
        const passenger = makePassenger(`${i}-${j}`, i, world.stops.length - 1, options.seed || 0, kind);
        if (!destinations.includes(passenger.destination)) passenger.destination = destinations.find((k) => k >= passenger.destination) ?? destinations.at(-1);
        if (kind === 'wheelchair') passenger.destination = destinations.at(-1);
        riders.push(passenger);
      }
      return riders;
    });
    this.traffic = new TrafficSystem(world, this.options.traffic);
  }
  get currentStop() { return this.world.stops[this.stopIndex] || null; }
  get speed() { return Math.abs(this.bus.v) * 3.6; }
  get speedLimit() { return this.roadInfo?.road.speedLimit || 30; }
  get doorsClosed() { return this.bus.front < 0.015 && this.bus.rear < 0.015 && !this.bus.frontTarget && !this.bus.rearTarget; }
  get immobilized() { const b = this.bus; return b.parking || !this.doorsClosed || b.ramp > 0.01 || b.rampTarget > 0 || b.kneel > 0.05 || b.kneelTarget > 0; }
  get waiting() { return this.manifests[this.stopIndex] || []; }
  get alighters() { return this.passengers.filter((p) => p.destination === this.stopIndex); }
  get arrivalDelta() { return this.currentStop ? this.time - this.currentStop.arrival : 0; }
  get departureWait() { return this.currentStop ? Math.max(0, this.currentStop.departure - this.time) : 0; }
  get overall() { const s = this.scores; return Math.round(s.safety * 0.55 + s.service * 0.25 + s.comfort * 0.15 + s.punctuality * 0.05); }
  emit(type, message, extra = {}) { this.events.push({ type, message, time: this.time, ...extra }); if (this.events.length > 80) this.events.shift(); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  notify(message, type = 'info') { this.emit(type, message); return { ok: false, message }; }
  start() { this.started = true; this.paused = false; this.emit('dispatch', `Training control: begin when ready. Your first stop is ${this.currentStop.name}.`); }
  pause(value = !this.paused) { this.paused = value; this.emit('pause', value ? 'Shift paused.' : 'Shift resumed.'); }
  violation(code, message, points = 4, category = 'safety', cooldown = 8) {
    if (this.time < (this.cooldown.get(code) || -1)) return;
    this.cooldown.set(code, this.time + cooldown); this.scores[category] = clamp(this.scores[category] - points, 0, 100);
    const entry = { time: +this.time.toFixed(2), code, message, points, category, speed: +this.speed.toFixed(1), position: [+this.bus.x.toFixed(2), +this.bus.z.toFixed(2)] };
    this.log.push(entry); this.emit('violation', message, { points, category, code });
  }
  docking() {
    const s = this.currentStop; if (!s) return { ok: false, reason: 'No active stop', distance: Infinity };
    const b = this.bus, p = [b.x, b.z], delta = sub(p, s.dock), along = dot(delta, forward(s.yaw)), lateral = dot(delta, right(s.yaw));
    const aligned = Math.abs(wrapAngle(b.yaw - s.yaw)) < 0.42;
    const ok = Math.abs(along) < 6.2 && Math.abs(lateral) < 1.35 && aligned && Math.abs(b.v) < 0.13;
    let reason = 'At the stop. Secure the bus before opening the doors.';
    if (Math.abs(b.v) >= 0.13) reason = 'Come to a complete stop.';
    else if (!aligned) reason = 'Align the bus with the stop.';
    else if (Math.abs(lateral) >= 1.35) reason = 'Move closer to the stopping position, parallel to the kerb.';
    else if (Math.abs(along) >= 6.2) reason = along < 0 ? 'Move forward to the stop marker.' : 'The front door is past the stopping position.';
    return { ok, reason, along, lateral, aligned, distance: distance(p, s.dock) };
  }
  act(action, value = null) {
    const b = this.bus, stationary = Math.abs(b.v) < 0.15;
    if (action === 'pause') { this.pause(); return { ok: true }; }
    if (this.completed) return this.notify('This shift has ended. Start a new shift from the menu.');
    if (action === 'reply') return this.reply(value);
    if (action === 'mirror') { this.mirrorChecked = this.time; this.emit('mirror', 'Mirrors checked. Look for cyclists before pulling away.'); return { ok: true }; }
    if (action === 'horn') { this.emit('horn', ''); return { ok: true }; }
    if (action === 'announce') { const next = this.currentStop; this.emit('announcement', next ? `Next stop: ${next.name}.` : 'This is the final stop.'); return { ok: true }; }
    if (action === 'indicator-left' || action === 'indicator-right') { const dir = action.endsWith('left') ? 'left' : 'right'; b.indicator = b.indicator === dir ? null : dir; this.indicatorTurned = false; this.emit('switch', ''); return { ok: true }; }
    if (action === 'hazards') { b.hazards = !b.hazards; this.emit('switch', b.hazards ? 'Hazard lights on.' : 'Hazard lights off.'); return { ok: true }; }
    if (action === 'lights') { b.lights = !b.lights; this.emit('switch', b.lights ? 'Driving lights on.' : 'Driving lights off.'); return { ok: true }; }
    if (action === 'wipers') { b.wipers = !b.wipers; this.emit('switch', b.wipers ? 'Wipers on.' : 'Wipers off.'); return { ok: true }; }
    if (['engine', 'belt', 'parking', 'gear', 'reverse', 'front', 'rear', 'kneel', 'ramp'].includes(action) && !stationary) {
      this.emit('interlock', 'Control interlock: come to a complete stop first.'); return { ok: false, message: 'Stop first.' };
    }
    switch (action) {
      case 'engine': b.engine = !b.engine; b.starting = b.engine ? 1.8 : 0; this.emit('switch', b.engine ? 'Systems starting. Buckle up and prepare your doors.' : 'Traction power off.'); break;
      case 'belt': b.belt = !b.belt; this.emit('switch', b.belt ? 'Driver’s belt fastened.' : 'Driver’s belt released.'); break;
      case 'parking':
        if (b.parking && b.ramp > 0.02) return this.notify('Retract the ramp before releasing the parking brake.', 'interlock');
        b.parking = !b.parking; this.emit('air', b.parking ? 'Parking brake applied.' : 'Parking brake released.'); break;
      case 'gear': b.gear = b.gear === 'D' ? 'N' : 'D'; this.emit('switch', `Transmission: ${b.gear}.`); break;
      case 'reverse': b.gear = b.gear === 'R' ? 'N' : 'R'; this.emit('switch', `Transmission: ${b.gear}. Check the surroundings before reversing.`); break;
      case 'front': case 'rear': {
        const closing = b[`${action}Target`] === 1;
        if (closing && action === 'rear' && (b.ramp > 0.015 || b.rampTarget)) return this.notify('Retract the ramp before closing the middle door.', 'interlock');
        if (closing && ((action === 'front' && this.boardingTimer > 0.35 && this.boardingTimer < 1.75) || (action === 'rear' && this.alightTimer > 0.15))) return this.notify('Doorway occupied. Wait for the passenger to clear it.', 'interlock');
        if (b.air < 5.5 && !closing) return this.notify('Air pressure is too low. Turn on the bus and allow pressure to recover.', 'interlock');
        b[`${action}Target`] = closing ? 0 : 1; b.air = Math.max(0, b.air - 0.09); this.emit('door', `${action === 'front' ? 'Front' : 'Middle'} door ${closing ? 'closing' : 'opening'}.`, { closing }); break;
      }
      case 'kneel':
        if (b.ramp > 0.02 || b.rampTarget) return this.notify('Retract the ramp before raising the suspension.', 'interlock');
        b.kneelTarget = b.kneelTarget ? 0 : 1; this.emit('air', b.kneelTarget ? 'Lowering the bus.' : 'Raising to driving height.'); break;
      case 'ramp':
        if (!b.parking || b.kneel < 0.95 || b.rear < 0.95) return this.notify('Apply the parking brake, lower the bus, and open the middle door before operating the ramp.', 'interlock');
        if (this.boardingTimer > 0.2 || this.alightTimer > 0.15) return this.notify('Wait until the passenger has cleared the ramp.', 'interlock');
        b.rampTarget = b.rampTarget ? 0 : 1; this.emit('switch', b.rampTarget ? 'Ramp deploying.' : 'Ramp retracting.'); break;
      default: return { ok: false, message: 'Unknown control.' };
    }
    return { ok: true };
  }
  reply(index) {
    if (Math.abs(this.bus.v) > 0.15) return this.notify('Answer once you are safely stopped. Keep your attention on the road.', 'interlock');
    if (!this.interaction) return { ok: false };
    const option = this.interaction.choices[index]; if (!option) return { ok: false };
    const passenger = this.waiting.find((p) => p.id === this.interaction.passengerId); if (!passenger) { this.interaction = null; return { ok: false }; }
    this.emit('driver', option.text); this.emit('passenger', option.reply, { speaker: this.interaction.speaker });
    if (option.value < 0) this.violation('service-reply', option.reply, Math.abs(option.value), 'service', 0);
    if (option.action === 'retry') return { ok: true };
    passenger.approved = true;
    if (option.action === 'wait') passenger.sitWait = 4.5;
    if (option.action === 'pram' || option.action === 'kneel') passenger.needsKneel = true;
    if (option.action === 'ramp') { passenger.needsKneel = true; passenger.needsRamp = true; }
    this.interaction = null; this.boardingTimer = 0; return { ok: true };
  }
  update(dt, input = {}) {
    if (this.paused || this.completed || !this.started) return;
    dt = clamp(dt, 0, 0.025); if (!dt) return; this.time += dt;
    const b = this.bus, old = { x: b.x, z: b.z, yaw: b.yaw, v: b.v };
    this.extraWait = Math.max(0, this.extraWait - dt); b.starting = Math.max(0, b.starting - dt);
    if (b.engine) b.air = Math.min(10, b.air + dt * 0.065);
    for (const key of ['front', 'rear', 'kneel', 'ramp']) {
      const target = b[key + 'Target'], rate = key === 'ramp' ? 0.37 : key === 'kneel' ? 0.6 : 0.7;
      if (Math.abs(b[key] - target) < rate * dt) b[key] = target; else b[key] += Math.sign(target - b[key]) * rate * dt;
    }
    const steering = clamp(Number(input.steer) || 0, -1, 1), speedFactor = 1 / (1 + Math.abs(b.v) * 0.052);
    const desiredSteer = steering * BUS_SPEC.maxSteer * speedFactor;
    b.steer = damp(b.steer, desiredSteer, input.analog ? 6.5 : 2.35, dt);
    b.throttle = clamp(Number(input.throttle) || 0, 0, 1); b.brake = clamp(Number(input.brake) || 0, 0, 1);
    b.brakePressure = damp(b.brakePressure, input.emergency ? 1 : b.brake, input.emergency ? 12 : 5.6, dt);
    const load = BUS_SPEC.massEmpty + this.passengers.length * BUS_SPEC.passengerMass;
    const gearSign = b.gear === 'D' ? 1 : b.gear === 'R' ? -1 : 0;
    const tractionReady = b.engine && b.starting === 0 && !this.immobilized && this.extraWait === 0;
    const forceAvailable = Math.min(BUS_SPEC.maxForce, BUS_SPEC.maxPower / Math.max(2, Math.abs(b.v)));
    let drive = tractionReady ? gearSign * forceAvailable * (b.throttle || (b.brakePressure < 0.02 ? 0.045 : 0)) : 0;
    if ((b.v > 22.2 && gearSign > 0) || (b.v < -3.4 && gearSign < 0)) drive = 0;
    const direction = Math.sign(b.v || drive), rolling = Math.abs(b.v) > 0.02 ? load * 9.81 * 0.009 : 0;
    const drag = 0.5 * 1.225 * 5.9 * b.v * b.v;
    const grip = this.options.weather === 'rain' ? 0.69 : 1;
    const braking = b.brakePressure * load * (input.emergency ? 6.2 : 4.6) * grip;
    let acceleration = (drive - direction * (rolling + drag + braking)) / load;
    if (b.v === 0 && Math.abs(drive) < rolling + braking) acceleration = 0;
    let v = b.v + acceleration * dt;
    if (b.brakePressure > 0.03 && Math.sign(v) !== Math.sign(b.v) && Math.abs(b.v) < 0.3) v = 0;
    if (this.immobilized) { v = 0; acceleration = 0; }
    if (Math.abs(v) < 0.025 && (!tractionReady || b.brakePressure > 0.05)) v = 0;
    b.v = v; b.acceleration = acceleration;
    const beta = Math.atan(0.46 * Math.tan(b.steer));
    const yawRate = (b.v * Math.cos(beta) * Math.tan(b.steer)) / BUS_SPEC.wheelbase;
    b.yaw = wrapAngle(b.yaw + yawRate * dt); b.x += Math.sin(b.yaw + beta) * b.v * dt; b.z -= Math.cos(b.yaw + beta) * b.v * dt;
    b.lateralAcceleration = b.v * yawRate; b.odometer += Math.abs(b.v) * dt;
    const consumed = (Math.max(0, Math.abs(drive * b.v)) * dt) / 3600000 + 0.00018 * dt;
    const recovered = b.brakePressure ? (Math.min(0.028, (Math.abs(b.v) * load * 1.2) / 3600000)) * dt : 0;
    b.energyUsed += consumed - recovered; b.battery = clamp(b.battery - ((consumed - recovered) / BUS_SPEC.batteryKWh) * 100, 0, 100);
    this.roadClock -= dt;
    if (this.roadClock <= 0) {
      this.roadClock = 0.1; this.previousRoutePosition = this.routePosition;
      const p = this.world.route.project([b.x, b.z], this.routePosition, 100);
      if (p.distance < 80) this.routePosition = p.s; else this.routePosition = this.world.route.project([b.x, b.z]).s;
      this.roadInfo = this.world.nearestRoad([b.x, b.z]);
    }
    this.traffic.update(dt, this);
    this.checkRules(dt, old);
    this.checkCollisions(old);
    this.updateService(dt);
    this.updateAmbient();
    // Simple steering-linked indicator cancellation after an intentional turn.
    if (b.indicator && Math.abs(b.steer) > 0.18) this.indicatorTurned = true;
    if (b.indicator && this.indicatorTurned && Math.abs(b.steer) < 0.035 && this.speed > 5) { b.indicator = null; this.indicatorTurned = false; }
  }
  checkRules(dt, old) {
    const b = this.bus, speed = this.speed, road = this.roadInfo;
    this.overspeedTime = speed > this.speedLimit + 2 ? this.overspeedTime + dt : 0;
    if (this.overspeedTime > 2) this.violation('speeding', `Speed limit exceeded: ${this.speedLimit} km/h.`, Math.min(8, 2 + (speed - this.speedLimit) * 0.2), 'safety', 10);
    this.beltTime = speed > 2 && !b.belt ? this.beltTime + dt : 0;
    if (this.beltTime > 1.5) this.violation('belt', 'Driver’s seat belt is not fastened.', 5, 'safety', 25);
    if (speed > 3 && !b.lights) this.violation('lights', 'Driving lights are off.', 3, 'safety', 30);
    if (speed > 12 && this.options.weather === 'rain' && !b.wipers) this.violation('visibility', 'Rain is reducing visibility. Switch on the wipers.', 1, 'safety', 35);
    if (Math.abs(b.lateralAcceleration) > 2.0 && speed > 12) this.violation('harsh-turn', 'Take the turn more gently; standing passengers need a stable ride.', 2, 'comfort', 10);
    if (b.acceleration < -3.4 && this.passengers.length) this.violation('harsh-brake', 'Heavy braking affected passenger comfort.', 1, 'comfort', 8);
    if (road && speed > 4) {
      const p = [b.x, b.z], direction = dot(forward(b.yaw), road.dir), alignment = Math.abs(direction);
      const nearJunction = this.world.roadHash.query(p, 14).filter((r) => r.path.project(p).distance < r.width * 0.5 + 4).length > 1;
      const wrong = road.road.oneway ? direction < -0.2 : alignment > 0.8 && road.lateral * Math.sign(direction) < -0.4;
      this.wrongSideTime = wrong && !nearJunction ? this.wrongSideTime + dt : 0;
      if (this.wrongSideTime > 2) this.violation('wrong-side', road.road.oneway ? 'This is a one-way street. Follow the direction of travel.' : 'Keep to the right-hand traffic lane.', 7, 'safety', 10);
      const off = road.edge + BUS_SPEC.width / 2 > 0.8;
      this.offroadTime = off && !nearJunction ? this.offroadTime + dt : 0;
      if (this.offroadTime > 1.6) this.violation('kerb', 'The bus is outside the carriageway. Check the kerb and pavement.', 5, 'safety', 8);
    }
    if (!road && speed > 2) { this.offroadTime += dt; if (this.offroadTime > 2) this.violation('off-road', 'You have left the mapped carriageway.', 6, 'safety', 10); }
    const front = add([b.x, b.z], scale(forward(b.yaw), BUS_SPEC.length / 2));
    const oldFront = add([old.x, old.z], scale(forward(old.yaw), BUS_SPEC.length / 2));
    const crosses = (line) => {
      const f = forward(line.yaw), r = right(line.yaw), before = dot(sub(oldFront, line.point), f), after = dot(sub(front, line.point), f);
      return before < 0 && after >= 0 && Math.abs(dot(sub(front, line.point), r)) < 5.2 && dot(forward(b.yaw), f) > 0.6;
    };
    for (const signal of this.world.signals) {
      const phase = signalPhase(this.time, signal.offset); let record = this.signalStates.get(signal.id);
      if (!record) { record = { phase, mustStop: true }; this.signalStates.set(signal.id, record); }
      if (phase === 'amber' && record.phase !== 'amber') {
        const gap = -dot(sub(front, signal.point), forward(signal.yaw)); record.mustStop = gap > Math.max(1, (b.v * b.v) / (2 * 3.0) + Math.abs(b.v) * 0.45);
      }
      record.phase = phase;
      if (crosses(signal) && (phase === 'red' || phase === 'red-amber' || (phase === 'amber' && record.mustStop))) this.violation(`red-${signal.id}`, phase === 'amber' ? 'Amber signal crossed when there was room to stop.' : 'Red signal crossed. Stop before the stop line.', 15, 'safety', 10);
    }
    for (const w of this.traffic.walkers) if ((w.waiting || w.active) && crosses(w.crossing)) this.violation(`yield-${w.id}`, 'Give way to the pedestrian using or waiting at the crossing.', 15, 'safety', 20);
    for (const sign of this.world.stopSigns) {
      const record = this.stopSignStates.get(sign.id) || { halted: false };
      const gap = -dot(sub(front, sign.point), forward(sign.yaw));
      if (gap > 0 && gap < 7 && Math.abs(b.v) < 0.07) record.halted = true;
      if (crosses(sign)) { if (!record.halted) this.violation(`stop-${sign.id}`, 'The bus did not come to a complete stop at the STOP sign.', 10); record.halted = false; }
      this.stopSignStates.set(sign.id, record);
    }
    for (const [i, turn] of this.world.turns.entries()) if (!this.turnsChecked.has(i) && this.routePosition > turn.s - 8 && this.routePosition < turn.s + 14 && speed > 3) {
      if (b.indicator !== turn.direction) this.violation(`turn-${i}`, `Signal ${turn.direction} before making the turn.`, 3, 'safety', 20);
      this.turnsChecked.add(i);
    }
    // Pulling away is a procedure check, not a substitute for observing actual traffic.
    if (!this.pulloutChecked && speed > 2 && this.arrivedAt !== null) {
      this.pulloutChecked = true;
      if (b.indicator !== 'left') this.violation('pullout-indicator', 'Signal left before pulling out from the stop.', 2, 'safety', 10);
      if (this.time - this.mirrorChecked > 12) this.violation('pullout-mirrors', 'Remember the mirror check before pulling out.', 1, 'safety', 10);
    }
  }
  checkCollisions(old) {
    const b = this.bus; if (Math.abs(b.v) < 0.015) return;
    const p = [b.x, b.z], shape = boxCorners(p, b.yaw, BUS_SPEC.width / 2, BUS_SPEC.length / 2);
    let collision = null;
    for (const building of this.world.buildingHash.query(p, 9)) if (polygonHit(shape, building.footprint, building.holes || [])) { collision = 'building'; break; }
    if (!collision) for (const car of this.world.propHash.query(p, 9)) if (polygonsOverlap(shape, boxCorners(car.point, car.yaw, 0.96, 2.3))) { collision = 'parked vehicle'; break; }
    if (!collision) for (const car of this.traffic.cars) if (!car.retired && distance(p, car.point) < 10 && polygonsOverlap(shape, boxCorners(car.point, car.yaw, 0.92, 2.22))) { collision = 'vehicle'; car.v = 0; break; }
    for (const w of this.traffic.walkers) if (w.active && distance(p, w.point) < 8 && polygonHit(shape, boxCorners(w.point, 0, 0.3, 0.3))) { collision = 'pedestrian'; break; }
    if (collision) {
      const impact = Math.abs(old.v);
      b.x = old.x; b.z = old.z; b.yaw = old.yaw; b.v = 0; b.acceleration = 0;
      // One contact is scored once: holding the throttle against an obstacle used to cost 25 points every 3 s
      // (and thud every 0.6 s) until safety hit zero. A new contact needs a second of separation first.
      const fresh = this.time - this.lastImpact > 1; this.lastImpact = this.time;
      if (fresh) {
        this.emit('impact', '', { what: collision, strength: clamp(impact / 6, 0.25, 1) });
        this.violation('collision', `Contact with a ${collision}. Stop, secure the bus, and assess the situation.`, 25, 'safety', 3);
      }
      if (collision === 'pedestrian') { b.parking = true; this.completed = true; this.paused = true; this.endReason = 'pedestrian'; this.emit('complete', 'Shift ended after contact with a pedestrian.'); }
    }
  }
  updateService(dt) {
    const s = this.currentStop; if (!s) return; const b = this.bus, dock = this.docking(), gap = s.s - this.routePosition;
    if (!this.stopRequested && gap < 155 && gap > 12 && this.alighters.length) { this.stopRequested = true; this.emit('stop-request', 'Stop requested.'); }
    if (dock.ok) {
      if (this.arrivedAt === null) { this.arrivedAt = this.time; this.emit('arrival', `${s.name}. ${this.waiting.length} waiting; ${this.alighters.length} alighting.`); }
      // Alighting is possible only through the middle door; accessible riders need the ramp again.
      const leaving = this.alighters[0];
      if (leaving && b.rear > 0.97) {
        if (leaving.needsRamp && (b.ramp < 0.97 || b.kneel < 0.97)) { this.status = 'A wheelchair user needs the ramp to alight.'; this.alightTimer = 0; }
        else {
          this.alightTimer += dt;
          if (this.alightTimer > 1.2) { this.passengers = this.passengers.filter((p) => p.id !== leaving.id); this.alightTimer = 0; this.emit('alighted', 'Kiitos. Thank you.', { passenger: leaving }); }
        }
      } else this.alightTimer = 0;
      const next = this.waiting[0], accessible = next && (next.kind === 'pram' || next.kind === 'wheelchair');
      const canApproach = next && (b.front > 0.96 || (accessible && b.rear > 0.96));
      if (canApproach) {
        if (!next.approved && !this.interaction) { this.interaction = interactionFor(next, this); next.asked = true; this.emit('interaction', this.interaction.text, { speaker: this.interaction.speaker }); }
        const accessReady = (!next.needsKneel || b.kneel > 0.97) && (!next.needsRamp || b.ramp > 0.97) && (!accessible || b.rear > 0.97);
        if (next.approved && accessReady && !this.alighters.length) {
          this.boardingTimer += dt;
          if (this.boardingTimer > 1.85) {
            this.waiting.shift(); next.boarded = true; this.passengers.push(next); this.boardingTimer = 0;
            if (next.regular) this.memory[next.regular.id] = (this.memory[next.regular.id] || 0) + 1;
            this.extraWait = Math.max(this.extraWait, next.sitWait || 0);
            this.emit('boarded', next.kind === 'pram' ? 'Pushchair safely on board.' : next.kind === 'wheelchair' ? 'Wheelchair user on board. Check the bay before departure.' : next.kind === 'luggage' ? 'Suitcase on board. Raise the bus before you leave.' : 'Ticket accepted.', { passenger: next });
          }
        } else this.boardingTimer = 0;
      } else this.boardingTimer = 0;
      this.serviceReady = !this.waiting.length && !this.alighters.length && !this.interaction && this.extraWait === 0;
      if (this.interaction) this.status = 'Listen to the rider and choose a reply.';
      else if (this.alighters.length && b.rear < 0.97) this.status = 'Open the middle door to let passengers alight.';
      else if (next?.needsRamp && b.ramp < 0.97) this.status = 'Apply parking brake, kneel, open middle door, and deploy ramp.';
      else if (next?.needsKneel && b.kneel < 0.97) this.status = next.kind === 'pram' ? 'Lower the bus and open the middle door for the pushchair.' : 'Lower the bus (kneel) so the rider can step on with the luggage.';
      else if (this.extraWait > 0) this.status = 'Give the passenger time to sit down.';
      else if (this.waiting.length && b.front < 0.97 && !accessible) this.status = 'Open the front door for boarding.';
      else if (this.serviceReady) {
        if (b.ramp > 0.01) this.status = 'Service complete. Retract the ramp.';
        else if (b.kneel > 0.02) this.status = 'Service complete. Raise the bus to driving height.';
        else if (!this.doorsClosed) this.status = 'Service complete. Close both doors.';
        else if (this.stopIndex === this.world.stops.length - 1) this.status = b.parking ? 'End of the line.' : 'End of the line. Apply the parking brake to finish the shift.';
        else if (this.departureWait > 1) this.status = `Ready. Wait ${Math.ceil(this.departureWait)} seconds for departure.`;
        else this.status = 'Check mirrors, signal left, select drive and release the brake.';
      } else this.status = 'Passenger service in progress. Keep the bus stationary.';
      if (this.stopIndex === this.world.stops.length - 1 && this.serviceReady && this.doorsClosed && b.parking && b.ramp < 0.01 && b.kneel < 0.01) {
        this.recordStop('served'); this.completed = true; this.paused = true; this.endReason = 'complete'; this.emit('complete', 'End of the line. Your shift is complete.');
      }
    } else {
      if (this.arrivedAt !== null && gap < -13) {
        this.recordStop(this.serviceReady ? 'served' : 'incomplete');
        if (!this.serviceReady) this.violation('incomplete-stop', 'Departed before passenger service was complete.', 8, 'service', 0);
        // Riders who could not get off here ask for the following stop instead.
        this.passengers.forEach((p) => { if (p.destination === this.stopIndex) p.destination = Math.min(this.stopIndex + 1, this.world.stops.length - 1); });
        this.nextStop();
      } else if (this.arrivedAt === null && gap < -42) {
        const required = this.waiting.length || this.alighters.length;
        this.recordStop(required ? 'missed' : 'not requested');
        if (required) this.violation(`missed-${this.stopIndex}`, `Missed required stop: ${s.name}.`, 12, 'service', 0);
        // Riders who could not get off request the following stop instead.
        this.passengers.forEach((p) => { if (p.destination === this.stopIndex) p.destination = Math.min(this.stopIndex + 1, this.world.stops.length - 1); });
        this.nextStop();
      } else if (dock.distance < 22) this.status = dock.reason;
      else this.status = gap > 0 ? `Continue to ${s.name}.` : 'Return to the stopping position safely, or use a practice reset.';
    }
  }
  recordStop(status) {
    const s = this.currentStop; if (!s) return;
    const departure = this.time, delay = departure - s.departure;
    if (status === 'served' && delay < -5 && this.stopIndex !== this.world.stops.length - 1) this.violation(`early-${s.id}`, 'Departed before the scheduled time. Do not leave waiting riders behind.', Math.min(5, Math.abs(delay) / 15), 'punctuality', 0);
    // Late arrival never penalizes safety or encourages recovery by speeding.
    if (status === 'served' && delay > 120) this.scores.punctuality = Math.max(0, this.scores.punctuality - 2);
    this.served.push({ id: s.id, name: s.name, status, arrival: this.arrivedAt === null ? null : +this.arrivedAt.toFixed(1), departure: +departure.toFixed(1), scheduledDeparture: s.departure, delay: +delay.toFixed(1) });
    this.emit('departed', '', { status });
  }
  nextStop() {
    if (this.interaction) { this.interaction = null; this.emit('interaction-close', ''); }
    this.stopIndex++; this.arrivedAt = null; this.serviceReady = false; this.stopRequested = false; this.pulloutChecked = false; this.boardingTimer = 0; this.alightTimer = 0;
    if (this.stopIndex >= this.world.stops.length) { this.completed = true; this.paused = true; this.bus.parking = true; this.bus.v = 0; this.endReason = 'route-finished'; this.emit('complete', 'Route finished. Review the stop-service report.'); }
  }
  updateAmbient() {
    if (this.time >= this.ambientLineAt && this.ambientQueue.length) { const q = this.ambientQueue.shift(); this.emit('ambient', q.text, { speaker: q.speaker }); this.ambientLineAt = this.time + 5; }
    if (this.time < this.ambientNext || this.interaction || this.passengers.length < 2) return;
    this.ambientNext = this.time + 70 + this.random() * 60;
    if (this.random() < 0.32) return; // Quiet is normal. Riders do not continuously perform dialogue.
    const indices = AMBIENT.map((_, i) => i).filter((i) => !this.ambientUsed.has(i)); if (!indices.length) return;
    const idx = indices[Math.floor(this.random() * indices.length)], scene = AMBIENT[idx]; this.ambientUsed.add(idx);
    this.ambientQueue = scene.lines.map((text) => ({ text, speaker: scene.speaker })); this.ambientLineAt = this.time;
  }
  practiceReset() {
    const s = this.currentStop || this.world.stops.at(-1), b = this.bus;
    b.x = s.dock[0]; b.z = s.dock[1]; b.yaw = s.yaw; b.v = 0; b.steer = 0; b.throttle = 0; b.brake = 0; b.brakePressure = 0; b.acceleration = 0; b.parking = true; b.gear = 'N'; this.routePosition = s.s;
    this.offroadTime = 0; this.wrongSideTime = 0; this.overspeedTime = 0;
    this.violation('practice-reset', 'Practice reset used. This run is not an assessed shift.', 0, 'safety', 0); this.practice = true;
    this.paused = false; this.emit('info', 'Repositioned at the current stop, secured in neutral.');
  }
  snapshot() {
    return {
      version: 1, world: hash(this.world.meta.title + this.world.route.length), difficulty: this.difficulty.id, weather: this.options.weather, time: this.time, bus: { ...this.bus }, stopIndex: this.stopIndex,
      routePosition: this.routePosition, passengers: this.passengers, manifests: this.manifests, served: this.served, scores: this.scores, log: this.log, memory: this.memory,
      arrivedAt: this.arrivedAt, serviceReady: this.serviceReady, stopRequested: this.stopRequested, extraWait: this.extraWait, practice: !!this.practice,
    };
  }
  restore(snap) {
    if (snap?.version !== 1 || snap.world !== hash(this.world.meta.title + this.world.route.length)) throw new Error('Saved shift belongs to a different city pack.');
    if (!snap.bus || ![snap.bus.x, snap.bus.z, snap.bus.yaw, snap.time].every(Number.isFinite)) throw new Error('Invalid saved shift.');
    if (Math.abs(snap.bus.x) > 50000 || Math.abs(snap.bus.z) > 50000 || !(snap.stopIndex >= 0) || snap.stopIndex >= this.world.stops.length) throw new Error('Saved position is outside the supported city pack.');
    this.bus = { ...this.bus, ...snap.bus, v: 0, parking: true, gear: 'N', throttle: 0, brake: 0, brakePressure: 0, steer: 0 };
    for (const k of ['time', 'stopIndex', 'routePosition', 'passengers', 'manifests', 'served', 'scores', 'log', 'memory', 'arrivedAt', 'serviceReady', 'stopRequested', 'extraWait', 'practice']) if (snap[k] !== undefined) this[k] = snap[k];
    this.previousRoutePosition = this.routePosition;
    // Turns already behind the bus are not checked again.
    this.world.turns.forEach((t, i) => { if (t.s < this.routePosition - 8) this.turnsChecked.add(i); });
    this.roadInfo = this.world.nearestRoad([this.bus.x, this.bus.z]);
    this.started = true; this.paused = true; this.emit('info', 'Saved position restored, stationary with parking brake applied.');
  }
  report() {
    return {
      title: 'Helsinki Driver — shift report', generatedAt: new Date().toISOString(), cityData: this.world.meta, route: this.world.data.route.number, difficulty: this.difficulty.label, weather: this.options.weather, prototype: true, practice: !!this.practice,
      durationSeconds: +this.time.toFixed(1), distanceMetres: Math.round(this.bus.odometer), scores: this.scores, overall: this.overall, stops: this.served, events: this.log,
      disclaimer: 'Simulation scoring is not a certification of compliance with every Finnish traffic rule. Signal timings, vehicle parameters and dialogue are simulated.',
    };
  }
}
