import { createGarden } from './garden.js';
import { buildYard } from './yard.js';
import { MAT } from '../voxel/palette.js';
import { VOXEL_SIZE } from '../engine/config.js';

// Bounds include the gaps between islands. These are not solid terrain squares.
export const AREAS = Object.freeze({
  small: Object.freeze({ name: 'Small', number: '01', label: 'PROCEDURAL TEST SCENE', title: 'The quiet ruin.', description: 'One garden. An arch, columns, and a pool.', size: 24, rings: [] }),
  medium: Object.freeze({ name: 'Medium', number: '02', label: 'PROCEDURAL TEST SCENE', title: 'The linked gardens.', description: 'Five gardens, stone paths, and an open court.', size: 64, rings: [22] }),
  large: Object.freeze({ name: 'Large', number: '03', label: 'PROCEDURAL TEST SCENE', title: 'The broken district.', description: 'Thirteen gardens with towers, courts, and bridges.', size: 128, rings: [24, 54] }),
  massive: Object.freeze({ name: 'Massive', number: '04', label: 'PROCEDURAL TEST SCENE', title: 'The stone archipelago.', description: 'Forty-one gardens across a wide field of ruins.', size: 256, rings: [24, 54, 86, 118] }),
  yard: Object.freeze({ name: 'Yard', number: '05', label: 'DEMOLITION TEST SCENE', title: 'The demolition yard.', description: 'A stacked tower, a span bridge, a copper wall and a column grove, built to come down.', size: 28, rings: [], custom: 'yard', steps: 16 }),
});
export function initialArea(search = globalThis.location?.search || '') {
  const requested = new URLSearchParams(search).get('area');
  return Object.hasOwn(AREAS, requested) ? requested : 'small';
}
export function areaPlan(id) {
  const area = Object.hasOwn(AREAS, id) ? AREAS[id] : null;
  if (!area) throw new RangeError(`Unknown area: ${id}`);
  const sites = [{ x: 0, z: 0, kind: 0, name: 'Central ruin' }];
  const links = [];
  area.rings.forEach((radius, ring) => {
    // Four, eight, twelve, then sixteen sites. No scaled-up voxels or meshes.
    const side = ring + 1, step = 2 * radius / side;
    for (let edge = 0; edge < 4; edge++) for (let j = 0; j < side; j++) {
      let x, z;
      if (edge === 0) { x = -radius + j * step; z = -radius; }
      if (edge === 1) { x = radius; z = -radius + j * step; }
      if (edge === 2) { x = radius - j * step; z = radius; }
      if (edge === 3) { x = -radius; z = radius - j * step; }
      const site = { x: Math.round(x / VOXEL_SIZE), z: Math.round(z / VOXEL_SIZE), kind: (sites.length % 3), name: `Ring ${ring + 1} · Garden ${j + 1 + edge * side}` };
      const index = sites.length;
      // Each new site connects to its nearest earlier site, making one connected path network.
      let nearest = 0, distance = Infinity;
      for (let k = 0; k < sites.length; k++) {
        const d = Math.abs(sites[k].x - site.x) + Math.abs(sites[k].z - site.z);
        if (d < distance) { distance = d; nearest = k; }
      }
      sites.push(site); links.push([nearest, index]);
    }
  });
  return { id, ...area, sites, links };
}
function translated(world, x, z) {
  return { set: (a, b, c, value) => world.set(a + x, b, c + z, value),
    get: (a, b, c) => world.get(a + x, b, c + z),
    fill: (min, max, value) => world.fill([min[0] + x, min[1], min[2] + z], [max[0] + x, max[1], max[2] + z], value) };
}
function addTower(world) {
  const { LIMESTONE, SANDSTONE, COPPER, GLOW, AIR } = MAT;
  world.fill([-13, 3, -3], [9, 6, 19], LIMESTONE);
  world.fill([-10, 6, 0], [6, 59, 16], LIMESTONE);
  world.fill([-7, 6, 3], [3, 59, 13], AIR);
  // Door and windows leave continuous corner piers.
  world.fill([-4, 6, 12], [0, 19, 17], AIR);
  for (const y of [24, 41]) {
    world.fill([-4, y, -1], [0, y + 8, 17], AIR);
    world.fill([-11, y, 6], [7, y + 8, 10], AIR);
    world.fill([-12, y - 3, -2], [8, y - 1, 18], SANDSTONE);
  }
  world.fill([-12, 57, -2], [8, 61, 18], COPPER);
  world.fill([-5, 61, 5], [1, 67, 11], GLOW);
}
function addCourt(world) {
  const { LIMESTONE, SANDSTONE, COPPER } = MAT;
  for (const x of [-22, -6, 10]) for (const z of [2, 17]) {
    world.fill([x, 3, z], [x + 5, 29, z + 5], LIMESTONE);
    world.fill([x - 1, 28, z - 1], [x + 6, 31, z + 6], SANDSTONE);
  }
  world.fill([-23, 31, 1], [16, 34, 7], LIMESTONE);
  world.fill([-23, 31, 16], [16, 34, 22], LIMESTONE);
  world.fill([-9, 34, 1], [-4, 36, 22], COPPER);
}
function pathSegment(world, x1, z1, x2, z2) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  world.fill([minX - 5, 1, minZ - 5], [maxX + 6, 3, maxZ + 6], MAT.LIMESTONE);
  const length = Math.abs(x2 - x1) + Math.abs(z2 - z1);
  for (let t = 0; t <= length; t += 48) {
    const x = x1 + Math.sign(x2 - x1) * t, z = z1 + Math.sign(z2 - z1) * t;
    world.fill([x - 3, -22, z - 3], [x + 4, -20, z + 4], MAT.ANCHOR);
    world.fill([x - 2, -20, z - 2], [x + 3, 1, z + 3], MAT.BASALT);
  }
}
function* buildSteps(world, id) {
  const plan = areaPlan(id), pools = [], lightCells = [], lights = [], landmarks = [];
  const half = Math.round(plan.size / VOXEL_SIZE / 2);
  const editBounds = { min: [-half, -24, -half], max: [half, 192, half] };
  if (plan.custom === 'yard') {
    const yard = yield* buildYard(world);
    return { ...plan, ...yard, focus: yard.landmarks[0].focus, editBounds };
  }
  // Make the paths first. The gardens then cut their own pools and open spaces.
  for (const [a, b] of plan.links) {
    const start = plan.sites[a], end = plan.sites[b];
    pathSegment(world, start.x, start.z, end.x, start.z);
    pathSegment(world, end.x, start.z, end.x, end.z);
    yield { phase: 'paths' };
  }
  for (const site of plan.sites) {
    const local = translated(world, site.x, site.z), garden = createGarden(local);
    if (site.kind === 1) addTower(local);
    if (site.kind === 2) addCourt(local);
    const x = site.x * VOXEL_SIZE, z = site.z * VOXEL_SIZE;
    pools.push({ ...garden.pool, x: garden.pool.x + x, z: garden.pool.z + z });
    garden.lightCells.forEach(cell => lightCells.push([cell[0] + site.x, cell[1], cell[2] + site.z]));
    garden.lights.forEach(point => lights.push([point[0] + x, point[1], point[2] + z]));
    landmarks.push({ name: site.name, focus: [x - 0.5, 1.65, z - 0.4] });
    yield { phase: 'gardens' };
  }
  return { ...plan, pools, lightCells, lights, landmarks, focus: landmarks[0].focus, editBounds };
}
export function createArea(world, id = 'small') {
  const steps = buildSteps(world, id); let result;
  do { result = steps.next(); } while (!result.done);
  return result.value;
}
export async function createAreaAsync(world, id = 'small', onProgress = () => {}) {
  const plan = areaPlan(id), total = plan.steps || plan.links.length + plan.sites.length;
  const steps = buildSteps(world, id); let result, done = 0;
  while (!(result = steps.next()).done) {
    onProgress(Math.min(1, ++done / total));
    // Give input and the loading panel a turn between sites.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return result.value;
}
