// Buttonwood Park: the coaster's shape, the park's rules and its words.
// Pure math over three.js vectors, no rendering.

import { Curve, Vector3 } from 'three/webgpu';

export const TAU = Math.PI * 2;
export const UP = new Vector3(0, 1, 0);

export const MODES = {
  assisted: {
    label: 'Assisted',
    short: 'A gentle scenic ride',
    description: 'The conductor handles hard braking and keeps the train comfortably planted.',
    maxSpeed: 21,
    boost: 2.2,
    drag: 0.005,
    score: 1,
  },
  coached: {
    label: 'Coached',
    short: 'Learn the rhythm',
    description: 'Early cues help you crest hills, lean into bends, and brake before trouble.',
    maxSpeed: 25,
    boost: 3.2,
    drag: 0.0045,
    score: 1.35,
  },
  limit: {
    label: 'Limit-pushing',
    short: 'Chase a perfect lap',
    description: 'Minimal intervention, narrower margins, and a generous keepsake multiplier.',
    maxSpeed: 31,
    boost: 4.4,
    drag: 0.0038,
    score: 1.8,
  },
  unhinged: {
    label: 'Unhinged',
    short: 'The model-maker looks away',
    description: 'An improbable toy motor, theatrical danger, and mercifully quick recovery.',
    maxSpeed: 40,
    boost: 7.2,
    drag: 0.0028,
    score: 2.5,
  },
};
export const MODE_KEYS = Object.keys(MODES);

export const CAMERAS = { chase: 'Chase', ride: 'Front seat', diorama: 'Diorama' };
export const CAMERA_KEYS = Object.keys(CAMERAS);

export const JUNCTIONS = [
  { center: 0.235, width: 0.13, amplitude: 6.5, title: 'Orchard Switch', left: 'Apple Row', right: 'Mill Chute' },
  { center: 0.505, width: 0.14, amplitude: 7.2, title: 'Pond Switch', left: 'Covered Bridge', right: 'Lilybank' },
  { center: 0.765, width: 0.14, amplitude: 5.8, title: 'Lantern Switch', left: 'Village Rise', right: 'Firefly Hollow' },
];

export const ROUTES = [
  'Sunday Picnic',
  'Millstream Flyer',
  'Bridge & Bloom',
  'Lilybank Limited',
  'Village Keepsake',
  'Firefly Express',
  'Moonlit Postcard',
  'Buttonwood Special',
];

/** What each route remembers, shown in the memory book once it is stamped. */
export const MEMORIES = [
  'A gingham blanket under the orchard, lemonade going warm, and nobody in any hurry at all.',
  'Racing the mill wheel downhill while Dad swore the brakes were only decorative.',
  'Lilies on the pond and a bridge painted the wrong shade of green, which everyone loved anyway.',
  'The express that never stopped for anyone, except the ducks. It always stopped for the ducks.',
  'A paper ticket kept in a coat pocket for thirty winters, still smelling faintly of apples.',
  'Lights out in the hollow, jars held high, and the whole train counting fireflies out loud.',
  'Written in pencil on the last ride of August: wish you were here. And you were.',
  'Every switch thrown wide, the whole family aboard, and Grandpa ringing the bell twice.',
];

/** The three switch branches a route takes, in riding order. */
export const routeBranches = (route) => JUNCTIONS.map((j, i) => ((route >> i) & 1 ? j.right : j.left));

/** The conductor's tickets: small goals, punched once and kept on this device. */
export const TICKETS = [
  { id: 'first', title: 'First Whistle', text: 'Finish your first loop of the park.' },
  { id: 'steady', title: 'Steady Hands', text: 'Finish a loop in Coached mode or wilder without the conductor stepping in.' },
  { id: 'clockwork', title: 'Clockwork', text: 'A clean loop under 22 seconds, Coached mode or wilder.' },
  { id: 'unhinged', title: 'Mercifully Quick', text: 'Ride a whole loop in Unhinged mode.' },
  { id: 'front', title: 'Front Seat Faithful', text: 'Ride a whole loop from the front seat camera.' },
  { id: 'lantern', title: 'Lantern Lighter', text: 'Ride a whole loop in the lantern evening.' },
  { id: 'moonlit', title: 'By Lantern Light', text: 'Ride the Moonlit Postcard route in the lantern evening.' },
  { id: 'tour', title: 'Grand Tour', text: 'Stamp four different routes in a single ride.' },
  { id: 'keeper', title: 'Keepsake Keeper', text: 'Gather 20,000 keepsakes in a single ride.' },
  { id: 'allroutes', title: 'Every Switch Remembers', text: 'Stamp all eight memory routes.' },
];
export const TICKET_IDS = TICKETS.map((t) => t.id);

export const HOURS = { afternoon: 'Summer afternoon', evening: 'Lantern evening' };

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Distance between two points on the loop (progress wraps at 1). */
function loopDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

/** A soft hill centred on c. */
function hill(p, c, w) {
  const d = loopDistance(p, c);
  return Math.exp(-(d * d) / (2 * w * w));
}

/** How far a switch pulls the track sideways at progress p (0 outside its window). */
function switchWindow(p, center, width) {
  const a = (p - (center - width / 2)) / width;
  return a > 0 && a < 1 ? Math.sin(Math.PI * a) ** 4 : 0;
}

/** The route index 0..7 for a set of three switch choices. */
export const routeIndex = (choices) => choices[0] | (choices[1] << 1) | (choices[2] << 2);

/** Point on the track at progress p (0..1) for the given switch choices. */
export function trackPoint(p, choices, out = new Vector3()) {
  const t = ((p % 1) + 1) % 1;
  const angle = t * TAU - Math.PI / 2;
  let spread = 0;
  let lift = 0;
  for (let i = 0; i < JUNCTIONS.length; i++) {
    const j = JUNCTIONS[i];
    const w = switchWindow(t, j.center, j.width);
    spread += (choices[i] === 1 ? 1 : -1) * j.amplitude * w;
    lift += (choices[i] === 1 ? 1.15 : -0.45) * w;
  }
  const rx = 42 + spread;
  const rz = 31 + spread * 0.62;
  const y = Math.max(
    2.25,
    3.15 +
      12.4 * hill(t, 0.145, 0.055) -
      2.1 * hill(t, 0.29, 0.035) +
      5.6 * hill(t, 0.405, 0.052) -
      1.2 * hill(t, 0.57, 0.045) +
      7.2 * hill(t, 0.67, 0.055) +
      3.3 * hill(t, 0.86, 0.035) +
      lift
  );
  return out.set(Math.cos(angle) * rx, y, Math.sin(angle) * rz);
}

/** The whole loop as a three.js curve, for building rails. */
export class TrackCurve extends Curve {
  constructor(choices) {
    super();
    this.choices = choices;
  }
  getPoint(t, out = new Vector3()) {
    return trackPoint(t, this.choices, out);
  }
}

/** A curve running beside another one (rails, stringers, handrails). */
export class OffsetCurve extends Curve {
  constructor(base, lateral, vertical = 0) {
    super();
    this.base = base;
    this.lateral = lateral;
    this.vertical = vertical;
  }
  getPoint(t, out = new Vector3()) {
    const p = this.base.getPoint(t, out);
    const tangent = this.base.getTangent(t, new Vector3()).normalize();
    const side = new Vector3().crossVectors(UP, tangent).normalize();
    const up = new Vector3().crossVectors(tangent, side).normalize();
    return p.addScaledVector(side, this.lateral).addScaledVector(up, this.vertical);
  }
}

/** A reusable frame: position, tangent, right, up, curvature and bank at a progress. */
export const newFrame = () => ({
  position: new Vector3(),
  tangent: new Vector3(),
  right: new Vector3(),
  up: new Vector3(),
  curvature: 0,
  signedCurvature: 0,
  metersPerProgress: 1,
  bank: 0,
});

const STEP = 0.0012;
const prev = new Vector3();
const next = new Vector3();
const inDir = new Vector3();
const outDir = new Vector3();

/**
 * The train's frame at progress p. `lean` (-1..1, + is left) tips the bank a
 * little. Writes into `out` so the per-frame callers allocate nothing.
 */
export function trackFrame(p, choices, lean = 0, out = newFrame()) {
  const pos = trackPoint(p, choices, out.position);
  trackPoint(p - STEP, choices, prev);
  trackPoint(p + STEP, choices, next);
  const tangent = out.tangent.copy(next).sub(prev).normalize();
  const right = out.right.crossVectors(UP, tangent).normalize();
  const up = out.up.crossVectors(tangent, right).normalize();
  inDir.copy(pos).sub(prev).normalize();
  outDir.copy(next).sub(pos).normalize();
  const turn = inDir.x * outDir.z - inDir.z * outDir.x;
  const span = Math.max(0.001, next.distanceTo(prev));
  const curvature = inDir.angleTo(outDir) / (span / 2);
  const signedCurvature = curvature * Math.sign(turn || 1);
  const bank = clamp(Math.atan((196 * signedCurvature) / 9.81) * 0.72 + lean * 0.1, -0.52, 0.52);
  right.applyAxisAngle(tangent, bank);
  up.applyAxisAngle(tangent, bank);
  out.curvature = curvature;
  out.signedCurvature = signedCurvature;
  out.metersPerProgress = span / (2 * STEP);
  out.bank = bank;
  return out;
}

/** The speed a bend can take comfortably, m/s. */
export const comfortSpeed = (frame) => clamp(Math.sqrt((0.8 * 9.81) / Math.max(frame.curvature, 0.0025)), 9.5, 27.5);

/** Lateral g the riders feel at speed v through this frame. */
export const lateralG = (frame, v) =>
  Math.abs((v * v * frame.signedCurvature * Math.cos(frame.bank) - 9.81 * Math.sin(frame.bank)) / 9.81);

/** A small deterministic random stream (Park-Miller), so the park grows the same every time. */
export function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
