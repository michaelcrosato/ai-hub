import { distance } from './math.js';

/** Levels are relative game values. This is not a calibrated acoustic simulation. */
export function propagateSound(nav, event, listenerNode, listener) {
  const route = nav.route(listenerNode, event.node, 'sound');
  if (!route) return null;
  let loss = 0;
  let pathLength = 0;
  if (route.nodes.length === 1) pathLength = distance(listener, event.position);
  else {
    let previous = listener;
    for (const p of route.portals) {
      pathLength += distance(previous, p.position);
      previous = p.position;
      if (p.kind === 'window') loss += 14;
      else if (p.kind === 'door') loss += p.door && nav.doorOpen.get(p.door) ? 2 : 18;
      else if (p.kind === 'stair') loss += 3;
    }
    pathLength += distance(previous, event.position);
  }
  pathLength = Math.max(pathLength, distance(listener, event.position));
  const level = event.level - 20 * Math.log10(Math.max(1, pathLength)) - loss - pathLength * 0.025;
  return {
    event,
    level,
    pathLength,
    loss,
    apparentPosition: loss > 3 && route.portals.length ? route.portals[0].position : event.position,
    lowpass: Math.max(350, 18000 * Math.exp(-loss * 0.095)),
    delay: pathLength / 343,
  };
}

export class NoiseLog {
  constructor() {
    this.sequence = 0;
    this.events = [];
  }
  emit(event) {
    const value = { ...event, position: [...event.position], id: ++this.sequence };
    this.events.push(value);
    if (this.events.length > 96) this.events.shift();
    return value;
  }
  prune(time) {
    while (this.events.length && time - this.events[0].time > 3) this.events.shift();
  }
  clear() {
    this.events.length = 0;
  }
}
