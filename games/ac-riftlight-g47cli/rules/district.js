// The Ochre Ward: the original street, plus the Salt Quay and the cistern lane.
// Positions are metres. Y is up. The player starts on the street facing +Z.
// West and east blocks are buildings; their tops are the roofs. The gap between
// those tops is the roof jump. The west block's street face is the climb.
// The pre-expansion footprint is x -18..18, z -14..38. New land sits outside it.

export const DISTRICT_NAME = 'The Ochre Ward';

export const LETHAL_DROP = 5;
export const BLEND_RADIUS = 1.7;
export const EAVESDROP_TIME = 2.2;
export const MAX_HEALTH = 4;

/** The ward before this expansion. New ground must stick out of this box. */
export const OLD_FOOTPRINT = { minX: -18, maxX: 18, minZ: -14, maxZ: 38 };

const west = { at: [8.2, 4, 8.8], size: [5.2, 8, 6.4] };
const east = { at: [8.2, 4, 17.8], size: [5.2, 8, 6.4] };

export const DISTRICT = {
  name: DISTRICT_NAME,
  spawn: [0, 0, 2],
  facade: { id: 'west-block', climbable: true, at: west.at, size: west.size },
  mantle: { id: 'mantle', at: [2.5, 0.95, 4.2], size: [1.6, 1.9, 1.3], top: 1.9 },
  roofs: {
    west: { at: west.at, size: west.size, top: west.at[1] + west.size[1] / 2 },
    east: { at: east.at, size: east.size, top: east.at[1] + east.size[1] / 2 },
  },
  leap: { at: [3.2, 0, 8.8], radius: 1.65, safe: true },
  unsafeDrop: { at: [3.2, 0, 11.4], radius: 1.15 },
  hiding: { at: [2.15, 0, 16.3], radius: 1.25 },
  quayHide: { at: [18.4, 0, 40.2], radius: 1.35 },
  viewpoint: { at: [9.4, 13, 19.9], radius: 1.15 },
  eavesdrop: {
    at: [-1.5, 0, 7.0],
    radius: 1.75,
    pair: [
      { at: [-1.85, 0, 6.55], yaw: 0.7 },
      { at: [-1.15, 0, 7.45], yaw: 0.7 + Math.PI },
    ],
  },
  pickpocket: {
    at: [0.85, 0, 12.4],
    radius: 1.35,
    yaw: 0,
    role: 'civilian',
    walk: [[0.85, 0, 12.4], [0.85, 0, 16.6]],
  },
  interrogation: { at: [-1.45, 0, 18.6], radius: 1.45, yaw: 0.4, role: 'ally' },
  target: {
    at: [-8, 0, 24],
    radius: 1.5,
    yaw: 0,
    role: 'target',
    name: 'Merro Voss',
    route: [[-8, 0, 24], [-5.2, 0, 26.4]],
  },
  escape: { at: [0, 0, -8.2], radius: 1.7 },
  crowd: [
    { id: 'c1', at: [0.15, 0, 9.0], role: 'civilian', elevated: false, yaw: 0.5, cloth: 'sand' },
    { id: 'c2', at: [1.15, 0, 9.55], role: 'civilian', elevated: false, yaw: 2.4, cloth: 'white' },
    { id: 'c3', at: [-0.55, 0, 10.05], role: 'civilian', elevated: false, yaw: 1.2, cloth: 'mist' },
    { id: 'w1', at: [0.55, 0, 12.2], role: 'civilian', elevated: false, yaw: 0, cloth: 'orange', walk: [[0.55, 0, 12.2], [0.55, 0, 15.4]] },
    { id: 'w2', at: [-0.35, 0, 15.2], role: 'civilian', elevated: false, yaw: Math.PI, cloth: 'slate', walk: [[-0.35, 0, 15.2], [-0.35, 0, 11.6]] },
    { id: 'w3', at: [0.4, 0, 18.2], role: 'civilian', elevated: false, yaw: 0, cloth: 'white', walk: [[0.4, 0, 18.2], [0.4, 0, 21.4]] },
    { id: 'w4', at: [19.2, 0, 39.2], role: 'civilian', elevated: false, yaw: 0, cloth: 'sand', walk: [[19.2, 0, 39.2], [22.4, 0, 39.6]] },
    { id: 'w5', at: [-1.1, 0, 4.6], role: 'civilian', elevated: false, yaw: 0, cloth: 'orange', walk: [[-1.1, 0, 4.6], [-1.1, 0, 8.2]] },
    { id: 'c4', at: [20.2, 0, 42.5], role: 'civilian', elevated: false, yaw: 1.2, cloth: 'mist' },
    { id: 'c5', at: [1.6, 0, 20.4], role: 'civilian', elevated: false, yaw: 0.4, cloth: 'slate' },
  ],
  guards: [
    {
      id: 'street',
      at: [1.15, 0, 23],
      elevated: false,
      role: 'guard',
      yaw: Math.PI,
      homeY: 0,
      patrol: [[1.15, 0, 21.6], [1.15, 0, 26.4]],
    },
    {
      id: 'roof',
      at: [8.2, 8.02, 17.6],
      elevated: true,
      role: 'guard',
      yaw: -Math.PI / 2,
      homeY: 8.02,
      patrol: [[6.6, 8.02, 15.6], [9.6, 8.02, 18.2]],
      roof: { minX: 5.9, maxX: 10.5, minZ: 14.9, maxZ: 18.6 },
    },
    {
      id: 'quay',
      at: [20.4, 0, 39.4],
      elevated: false,
      role: 'guard',
      yaw: 0,
      homeY: 0,
      patrol: [[20.4, 0, 39.4], [23.6, 0, 40.4]],
    },
    {
      id: 'cistern',
      at: [-20.6, 0, 6],
      elevated: false,
      role: 'guard',
      yaw: 0,
      homeY: 0,
      patrol: [[-20.6, 0, 6], [-20.6, 0, 14]],
    },
    {
      id: 'searcher',
      at: [-6.2, 0, 23.2],
      elevated: false,
      role: 'guard',
      yaw: Math.PI,
      homeY: 0,
      searcher: true,
      patrol: [[-6.2, 0, 23.2], [-4.2, 0, 26]],
    },
  ],
  solids: [
    { id: 'west-block', at: west.at, size: west.size, color: 'sand', tex: 'sandstone', climbable: true },
    { id: 'east-block', at: east.at, size: east.size, color: 'mist', tex: 'sandstone', climbable: false },
    { id: 'tower', at: [9.4, 10.5, 19.9], size: [1.8, 5, 1.8], color: 'slate', tex: 'sandstone', climbable: true },
    { id: 'mantle', at: [2.5, 0.95, 4.2], size: [1.6, 1.9, 1.3], color: 'sand', tex: 'flagstones', climbable: false },
    { id: 'left-a', at: [-7.6, 3.1, 7.6], size: [5.6, 6.2, 7.2], color: 'sand', tex: 'sandstone' },
    { id: 'left-b', at: [-7.8, 3.6, 17.2], size: [5.4, 7.2, 5.2], color: 'mist', tex: 'sandstone' },
    { id: 'court-back', at: [-7.6, 3, 28.4], size: [9, 6, 0.7], color: 'slate', tex: 'sandstone' },
    { id: 'court-side', at: [-12.1, 3, 25.2], size: [0.7, 6, 6.2], color: 'sand', tex: 'sandstone' },
    { id: 'end-wall', at: [4, 3.2, 31.2], size: [14, 6.4, 0.8], color: 'mist', tex: 'sandstone' },
    { id: 'back-wall', at: [0, 2.6, -12.2], size: [20, 5.2, 0.7], color: 'slate', tex: 'sandstone' },
    { id: 'quay-house', at: [22, 4, 44], size: [5, 8, 6], color: 'sand', tex: 'sandstone', climbable: true },
    { id: 'quay-wall', at: [26.4, 2.4, 44], size: [1.2, 4.8, 12], color: 'mist', tex: 'sandstone' },
    { id: 'cistern-wall', at: [-23.4, 2.2, 10], size: [1.2, 4.4, 14], color: 'slate', tex: 'sandstone' },
  ],
  ground: { at: [2, -0.5, 18], size: [52, 1, 70] },
};

export function roofGap(d = DISTRICT) {
  const westMax = d.roofs.west.at[2] + d.roofs.west.size[2] / 2;
  const eastMin = d.roofs.east.at[2] - d.roofs.east.size[2] / 2;
  return eastMin - westMax;
}

export function groundBox(d = DISTRICT) {
  const [cx, , cz] = d.ground.at;
  const [w, , depth] = d.ground.size;
  return {
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minZ: cz - depth / 2,
    maxZ: cz + depth / 2,
    area: w * depth,
  };
}

export function onGround(x, z, d = DISTRICT) {
  const b = groundBox(d);
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

export function outsideOld(x, z) {
  return x < OLD_FOOTPRINT.minX || x > OLD_FOOTPRINT.maxX || z < OLD_FOOTPRINT.minZ || z > OLD_FOOTPRINT.maxZ;
}

export function routeOutsideOld(route) {
  return !!route && route.length >= 2 && route.every((p) => outsideOld(p[0], p[2]) && onGround(p[0], p[2]));
}

/** Counts the expansion has to keep. */
export function wardCensus(d = DISTRICT) {
  const box = groundBox(d);
  const civilians = [
    ...d.crowd,
    ...(d.eavesdrop?.pair ?? []),
    d.pickpocket,
  ].filter((p) => p && (p.role === 'civilian' || p.role === undefined));
  const walkers = d.crowd.filter((c) => c.walk && c.walk.length >= 2 && c.role === 'civilian' && !c.elevated);
  const patrols = d.guards.filter((g) => g.patrol && g.patrol.length >= 2 && !g.searcher);
  const sample = [22, 42];
  return {
    area: box.area,
    oldArea: (OLD_FOOTPRINT.maxX - OLD_FOOTPRINT.minX) * (OLD_FOOTPRINT.maxZ - OLD_FOOTPRINT.minZ),
    outside: onGround(sample[0], sample[1], d) && outsideOld(sample[0], sample[1]),
    outsidePoint: sample,
    guards: d.guards.length,
    patrols: patrols.length,
    newPatrols: patrols.filter((g) => routeOutsideOld(g.patrol)).length,
    civilians: civilians.length,
    walkingBlend: walkers.length,
    climbables: d.solids.filter((s) => s.climbable).length,
    newClimb: d.solids.some((s) => s.climbable && outsideOld(s.at[0], s.at[2])),
    newHide: !!d.quayHide && outsideOld(d.quayHide.at[0], d.quayHide.at[2]),
    searchers: d.guards.filter((g) => g.searcher).length,
  };
}

export function inDisc(x, z, spot) {
  const dx = x - spot.at[0];
  const dz = z - spot.at[2];
  return dx * dx + dz * dz <= spot.radius * spot.radius;
}

/** Every affordance the slice has to contain. */
export function affordanceReport(d = DISTRICT) {
  const gap = roofGap(d);
  return {
    facade: d.facade.climbable === true,
    mantle: d.mantle.top >= 1.3 && d.mantle.top <= 2.25,
    roofGap: gap >= 2 && gap <= 4,
    leap: d.leap.safe === true,
    unsafeDrop: !!d.unsafeDrop,
    crowd: d.crowd.some((c) => c.role === 'civilian' && !c.elevated),
    hiding: !!d.hiding,
    viewpoint: !!d.viewpoint,
    eavesdrop: !!d.eavesdrop,
    pickpocket: d.pickpocket.role === 'civilian',
    interrogation: d.interrogation.role === 'ally',
    target: d.target.role === 'target',
    escape: !!d.escape,
    streetGuard: d.guards.some((g) => g.role === 'guard' && !g.elevated),
    elevatedGuard: d.guards.some((g) => g.role === 'guard' && g.elevated),
  };
}
