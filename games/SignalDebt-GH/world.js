import {
  THREE, RAPIER, PALETTE, toonMaterial, glowMaterial, mergeStaticMeshes,
  buildModel, loadPack, WaterSurface,
} from './pixel-engine.js';

const ROAD_COORDS = [-216, -108, 0, 108, 216];
const SITES = [
  { name: 'Serrin Motor Works', x: -24, z: 24, radius: 25 },
  { name: 'Impound depot', x: -187, z: -187, radius: 20 },
  { name: 'Night market', x: -80, z: 90, radius: 17 },
  { name: 'Civic exchange', x: 145, z: -80, radius: 18 },
  { name: 'Marina office', x: 235, z: 120, radius: 15 },
  { name: 'Relay court', x: -185, z: 145, radius: 19 },
  { name: 'Freight yard', x: 145, z: 145, radius: 20 },
  { name: 'Public transmitter', x: 195, z: -185, radius: 20 },
  { name: 'Ferry terminal', x: 235, z: 220, radius: 16 },
];
const SHOPS = ['SABLE RECORDS', 'LOW TIDE CAFE', 'PORT LAUNDRY', 'AFTER HOURS', 'SUNSET SUPPLY', 'ANCHOR ELECTRIC', 'OPEN LATE', 'PIER PRINT', 'COMMON GROUND', 'SEA LEVEL', 'SABLE DENTAL', 'COASTAL CREDIT'];

function overlaps(a, b, margin = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin;
}

// The map is deliberately authored from a fixed street grid. Decoration is
// deterministic, so save data and missions retain the same spatial meaning.
export async function buildWorld(ctx) {
  const { scene, physics } = ctx;
  const root = new THREE.Group();
  root.name = 'Port Sable / Breakwater district';
  scene.add(root);
  const buckets = Array.from({ length: 4 }, () => []);
  const colliders = [], lightHandles = [], signs = [], buildings = [];
  const signTextures = new Map();
  const generatedGeometry = new Set();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  generatedGeometry.add(boxGeometry); generatedGeometry.add(cylinderGeometry);
  const bucketFor = (x, z) => (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0);
  function addMesh(mesh) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    buckets[bucketFor(mesh.position.x, mesh.position.z)].push(mesh);
    return mesh;
  }
  function box(x, y, z, w, h, d, color, solid = false, yaw = 0) {
    const mesh = new THREE.Mesh(boxGeometry, toonMaterial(PALETTE[color] ?? color));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.y = yaw;
    addMesh(mesh);
    if (solid) colliders.push(physics.addStaticBox({ position: [x, y, z], halfExtents: [w / 2, h / 2, d / 2], rotationY: yaw, friction: 0.7 }));
    return mesh;
  }
  function cylinder(x, y, z, radius, h, color, solid = false) {
    const mesh = new THREE.Mesh(cylinderGeometry, toonMaterial(PALETTE[color] ?? color));
    mesh.position.set(x, y, z); mesh.scale.set(radius, h, radius); addMesh(mesh);
    if (solid) colliders.push(physics.addStaticCylinder([x, y, z], h / 2, radius));
    return mesh;
  }
  function library(id, x, y, z, scale = 1, yaw = 0, palette = {}, catalog) {
    const object = buildModel(id, { palette, ...(catalog ? { catalog } : {}) }).object;
    object.position.set(x, y, z); object.scale.setScalar(scale); object.rotation.y = yaw;
    object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    buckets[bucketFor(x, z)].push(object);
    return object;
  }
  function sign(text, x, y, z, width, height, yaw = 0, accent = 'orange') {
    const key = `${text}:${accent}`;
    let texture = signTextures.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const c = canvas.getContext('2d');
      c.fillStyle = '#1a1c2c'; c.fillRect(0, 0, 512, 128);
      c.fillStyle = `#${PALETTE[accent].toString(16).padStart(6, '0')}`; c.fillRect(0, 0, 12, 128);
      c.fillRect(22, 108, 468, 5); c.fillStyle = '#f4f4f4';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 ${text.length > 17 ? 30 : text.length > 13 ? 36 : 44}px sans-serif`;
      c.fillText(text, 263, 61, 466);
      texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
      signTextures.set(key, texture);
    }
    const geometry = new THREE.PlaneGeometry(width, height);
    generatedGeometry.add(geometry);
    const mesh = new THREE.Mesh(geometry, toonMaterial(PALETTE.white, { map: texture }));
    mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.name = text;
    root.add(mesh); signs.push(mesh);
    return mesh;
  }

  // Pavement and asphalt are flush: cars do not catch artificial collider seams.
  box(0, -0.55, 0, 504, 1.1, 504, 'mist', true);
  for (const road of ROAD_COORDS) {
    box(road, 0.018, 0, 20, 0.035, 502, 'night');
    box(0, 0.02, road, 502, 0.035, 20, 'night');
    for (const side of [-1, 1]) {
      box(road + side * 12, 0.045, 0, 4, 0.06, 500, 'sand');
      box(0, 0.045, road + side * 12, 500, 0.06, 4, 'sand');
    }
    for (let p = -244; p <= 244; p += 12) {
      if (ROAD_COORDS.some(cross => Math.abs(cross - p) < 14)) continue;
      box(road, 0.055, p, 0.22, 0.04, 5, 'sand');
      box(p, 0.055, road, 5, 0.04, 0.22, 'sand');
      for (const side of [-1, 1]) {
        box(road + side * 8.6, 0.055, p, 0.14, 0.04, 11.8, 'mist');
        box(p, 0.055, road + side * 8.6, 11.8, 0.04, 0.14, 'mist');
      }
    }
  }
  // Intersections remain open even where the sidewalk strips cross.
  for (const x of ROAD_COORDS) for (const z of ROAD_COORDS) {
    box(x, 0.083, z, 28.1, 0.04, 28.1, 'night');
    for (let stripe = -7.5; stripe <= 7.5; stripe += 3) {
      box(x + stripe, 0.113, z - 11.4, 1.4, 0.025, 3.3, 'white');
      box(x + stripe, 0.113, z + 11.4, 1.4, 0.025, 3.3, 'white');
      box(x - 11.4, 0.113, z + stripe, 3.3, 0.025, 1.4, 'white');
      box(x + 11.4, 0.113, z + stripe, 3.3, 0.025, 1.4, 'white');
    }
  }

  const reservations = SITES.map(s => ({ x: s.x, z: s.z, w: s.radius * 2, d: s.radius * 2 }));
  // Every site gets a broad service approach from its nearest street.
  for (const s of SITES) {
    const rx = ROAD_COORDS.reduce((a, b) => Math.abs(a - s.x) < Math.abs(b - s.x) ? a : b);
    const rz = ROAD_COORDS.reduce((a, b) => Math.abs(a - s.z) < Math.abs(b - s.z) ? a : b);
    if (Math.abs(rx - s.x) < Math.abs(rz - s.z)) {
      const entry = { x: (rx + s.x) / 2, z: s.z, w: Math.abs(rx - s.x) + 12, d: 12 };
      reservations.push(entry); box(entry.x, 0.125, entry.z, entry.w, 0.025, entry.d, 'slate');
    } else {
      const entry = { x: s.x, z: (rz + s.z) / 2, w: 12, d: Math.abs(rz - s.z) + 12 };
      reservations.push(entry); box(entry.x, 0.125, entry.z, entry.w, 0.025, entry.d, 'slate');
    }
  }

  function building(x, z, w, d, h, index, style = 'residential') {
    const district = x > 110 && z > 110 ? 'cargo' : x > 110 && z < 0 ? 'business' : 'residential';
    const wall = district === 'cargo' ? ['teal', 'slate', 'orange'][index % 3] : ['sand', 'mist', 'orange', 'white', 'teal'][index % 5];
    const b = { x, z, w, d, h, style, district }; buildings.push(b);
    box(x, h / 2, z, w, h, d, wall, true);
    box(x, 0.5, z, w + 0.1, 1, d + 0.1, 'slate');
    box(x, h + 0.25, z, w + 0.6, 0.5, d + 0.6, 'mist');
    box(x, h + 0.54, z, w - 0.8, 0.12, d - 0.8, 'night');
    // Roofs, parapets and plant give the raised camera distinct silhouettes.
    for (const side of [-1, 1]) {
      box(x + side * (w / 2 - 0.25), h + 0.85, z, 0.5, 0.8, d, wall);
      box(x, h + 0.85, z + side * (d / 2 - 0.25), w, 0.8, 0.5, wall);
    }
    box(x - w * 0.2, h + 1.45, z + d * 0.17, w * 0.22, 1.8, d * 0.25, 'slate');
    for (let i = 0; i < 3; i++) box(x - w * 0.2, h + 2.38, z + d * (0.08 + i * 0.08), w * 0.2, 0.08, 0.25, 'mist');
    if (index % 4 === 0) {
      cylinder(x + w * 0.22, h + 1.5, z - d * 0.2, 1.1, 2.8, 'teal');
      cylinder(x + w * 0.22, h + 3, z - d * 0.2, 1.25, 0.3, 'slate');
    }
    if (index % 5 === 0) {
      cylinder(x, h + 3.6, z, 0.11, 6, 'night');
      box(x, h + 5.7, z, 3, 0.12, 0.12, 'mist');
    }
    const rows = Math.max(1, Math.floor((h - 3) / 3.4));
    for (let floor = 0; floor < rows; floor++) {
      const y = 3.3 + floor * 3.4;
      for (const side of [-1, 1]) {
        box(x, y, z + side * (d / 2 + 0.035), w - 2.3, 1.55, 0.07, 'navy');
        box(x + side * (w / 2 + 0.035), y, z, 0.07, 1.55, d - 2.3, 'navy');
        for (let q = -w / 2 + 3.4; q < w / 2 - 1.5; q += 4.8) box(x + q, y, z + side * (d / 2 + 0.08), 0.3, 1.65, 0.16, wall);
        for (let q = -d / 2 + 3.4; q < d / 2 - 1.5; q += 4.8) box(x + side * (w / 2 + 0.08), y, z + q, 0.16, 1.65, 0.3, wall);
      }
    }
    const front = z - d / 2 - 0.12;
    box(x, 1.3, front, 2.3, 2.6, 0.12, 'ink');
    box(x + 0.65, 1.3, front - 0.09, 0.12, 0.5, 0.08, 'sand');
    if (index % 3 === 0) {
      box(x, 2.95, front - 0.9, Math.min(w - 1.5, 11), 0.18, 2, index % 2 ? 'teal' : 'red');
      sign(SHOPS[index % SHOPS.length], x, 4.9, front - 0.08, Math.min(w - 2, 12), 2.3, Math.PI, index % 2 ? 'teal' : 'orange');
    }
    return b;
  }

  let index = 0;
  for (let gx = 0; gx < 4; gx++) for (let gz = 0; gz < 4; gz++) {
    const ax = ROAD_COORDS[gx], az = ROAD_COORDS[gz];
    const lots = [[29, 29, 23, 23], [79, 29, 23, 23], [29, 79, 23, 23], [79, 79, 23, 23], [54, 30, 17, 25], [54, 78, 17, 25]];
    for (const [dx, dz, w, d] of lots) {
      const x = ax + dx, z = az + dz;
      if (reservations.some(area => overlaps({ x, z, w, d }, area, 1))) continue;
      const height = 7.6 + ((gx * 13 + gz * 7 + index * 3) % 5) * 3.4;
      building(x, z, w, d, height, index++);
    }
  }
  // Narrow western fringe reads as another street frontage, not a map cliff.
  for (let z = -186; z < 205; z += 48) {
    if (ROAD_COORDS.some(r => Math.abs(r - z) < 22)) continue;
    building(-239, z, 15, 25, 10 + (index % 3) * 3.4, index++);
  }

  // Garage and its open forecourt are the emotional anchor of the district.
  const garage = { x: -39, z: 38, w: 25, d: 20, h: 7 };
  buildings.push(garage);
  box(-39, 3.5, 38, 25, 7, 20, 'teal', true);
  box(-39, 7.25, 38, 26.2, 0.5, 21.2, 'sand');
  box(-39, 2.4, 27.9, 15, 4.8, 0.15, 'night');
  for (let y = 0.7; y < 4.6; y += 0.5) box(-39, y, 27.75, 14.8, 0.09, 0.14, 'slate');
  sign('SERRIN MOTOR WORKS', -39, 6.1, 27.65, 21, 2.4, Math.PI, 'orange');
  box(-22, 0.15, 16, 24, 0.08, 22, 'slate');
  for (let x = -30; x < -12; x += 6) {
    box(x, 0.21, 21, 0.16, 0.025, 8, 'sand');
    box(x + 2.9, 0.21, 25, 5.8, 0.025, 0.16, 'sand');
  }
  library('barrel', -49, 0, 24, 1.2, 0, { wood: 'teal', band: 'night', lid: 'mist' });
  library('crate', -48, 0, 22, 1.4);
  sign('REPAIRS / OPEN LATE', -51.65, 3.8, 38, 14, 2.7, -Math.PI / 2, 'sand');
  lightHandles.push(ctx.lights.request({ position: [-36, 5, 24], color: PALETTE.orange, intensity: 8, radius: 12, priority: 3, name: 'garage canopy' }));

  // Mission places use recognizable, original silhouettes without closing the
  // approach lanes or filling their interaction pads with decorative obstacles.
  box(-187, 0.15, -187, 38, 0.08, 38, 'slate');
  box(-170, 2, -187, 0.6, 4, 34, 'teal', true);
  buildings.push({ x: -170, z: -187, w: 0.6, d: 34, h: 4 });
  sign('CIVIC SHIELD / RECOVERY', -170.4, 5.6, -187, 27, 3.4, -Math.PI / 2, 'cyan');
  for (const x of [-202, -172]) {
    cylinder(x, 3.3, -171, 0.25, 6.6, 'night', true);
    box(x, 6.8, -171, 2, 0.3, 1, 'sand');
  }
  for (const z of [-195, -186, -177]) { box(-201, 0.22, z, 0.15, 0.04, 7, 'sand'); box(-198, 0.22, z + 3.5, 6, 0.04, 0.15, 'sand'); }

  for (const [x, z, color] of [[-90, 82, 'orange'], [-78, 80, 'red'], [-67, 84, 'teal'], [-89, 96, 'teal']]) {
    library('market-stall', x, 0, z, 1.5, z > 90 ? Math.PI : 0, { cloth: color });
    colliders.push(physics.addStaticBox({ position: [x, 0.7, z], halfExtents: [2.55, 0.7, 0.75] }));
  }
  sign('THE NIGHT MARKET', -80, 5.3, 75, 19, 3, 0, 'orange');
  for (const x of [-91, -69]) cylinder(x, 2.7, 75, 0.18, 5.4, 'night', true);

  box(145, 0.13, -80, 34, 0.08, 34, 'sand');
  building(165, -83, 10, 28, 14, index++, 'exchange');
  sign('CIVIC EXCHANGE', 159.85, 7.4, -83, 25, 3.2, -Math.PI / 2, 'cyan');
  for (const x of [132, 159]) cylinder(x, 0.7, -69, 0.45, 1.4, 'night', true);

  box(-185, 0.13, 145, 35, 0.08, 35, 'slate');
  for (const x of [-198, -172]) {
    box(x, 1.6, 155, 3, 3.2, 3, 'teal', true);
    cylinder(x, 7, 155, 0.25, 11, 'night');
    box(x, 11.8, 155, 5, 0.3, 0.3, 'sand');
  }
  sign('SABLE SIGNAL SERVICE', -185, 4, 160, 21, 2.8, Math.PI, 'teal');

  box(145, 0.13, 145, 40, 0.08, 40, 'slate');
  for (const [x, z, color] of [[130, 134, 'teal'], [158, 157, 'orange'], [130, 158, 'red']]) {
    box(x, 1.55, z, 6, 3.1, 12, color, true);
    buildings.push({ x, z, w: 6, d: 12, h: 3.1 });
    for (let q = -4.5; q <= 4.5; q += 1.5) for (const side of [-1, 1]) box(x + side * 3.05, 1.55, z + q, 0.12, 2.9, 0.22, 'slate');
  }
  sign('BREAKWATER FREIGHT', 145, 6, 165, 30, 4, Math.PI, 'orange');
  for (const [x, z] of [[136, 157], [138, 158], [158, 135], [160, 133]]) library('crate', x, 0, z, 1.9);

  // Promenade, sea wall and piers. The visible wall matches the level boundary.
  box(240, 0.13, 0, 24, 0.08, 500, 'sand');
  box(251, 0.65, 0, 1.5, 1.3, 504, 'mist', true);
  box(251, 1.35, 0, 1.9, 0.15, 504, 'white');
  const water = new WaterSurface({
    size: [440, 720], at: [473, -1.2, 0], segments: [96, 160],
    // The pond preset aliases on a coast-sized grid; long crossed swells keep
    // the water resolved without paying for four vertices per square metre.
    waves: [
      { dir: [-0.993, 0.12], length: 22, amplitude: 0.28, speed: 1.4 },
      { dir: [-0.84, -0.543], length: 13, amplitude: 0.11, speed: 0.9 },
      { dir: [-0.6, 0.8], length: 9, amplitude: 0.07, speed: 0.6 },
    ],
    deep: PALETTE.teal, shallow: PALETTE.cyan, foam: PALETTE.sand, opacity: 1,
  });
  root.add(water);
  for (const z of [-155, -45, 80, 180, 239]) {
    box(267, -0.1, z, 30, 0.6, 8, 'orange');
    for (const x of [255, 267, 279]) for (const side of [-1, 1]) cylinder(x, -1.8, z + side * 3, 0.45, 4, 'night');
    for (let x = 254; x < 281; x += 1.6) box(x, 0.23, z, 0.11, 0.06, 8, 'sand');
  }
  building(239, 138, 13, 12, 5.5, index++, 'marina');
  sign('MARINA / OFFICE', 239, 4.2, 131.85, 12, 2, Math.PI, 'teal');
  box(236, 3.8, 235, 24, 0.5, 8, 'teal');
  for (const x of [227, 245]) cylinder(x, 1.9, 235, 0.3, 3.8, 'night', true);
  sign('SABLE FERRY', 236, 5.3, 230.9, 20, 3, Math.PI, 'orange');

  // Broadcast roof and the engine's rideable kinematic mover are visible from
  // the approach. Physics.bind supplies interpolated visuals; no mesh teleport.
  box(195, 7.9, -194, 16, 0.6, 13, 'teal', true);
  for (const x of [188, 202]) for (const z of [-199.5, -188.5]) box(x, 3.8, z, 0.5, 7.6, 0.5, 'night', true);
  box(195, 0.15, -185, 29, 0.08, 36, 'slate');
  for (const x of [191.8, 198.2]) box(x, 4.9, -187.9, 0.4, 9.8, 0.4, 'sand', true);
  const liftMesh = new THREE.Group(); liftMesh.name = 'broadcast service lift';
  const liftDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.44, 5.2), toonMaterial(PALETTE.orange));
  liftDeck.castShadow = true; liftDeck.receiveShadow = true; liftMesh.add(liftDeck);
  for (const x of [-2.5, 2.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 5), toonMaterial(PALETTE.sand));
    rail.position.set(x, 1.3, 0); liftMesh.add(rail);
    for (const z of [-2.4, 2.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), toonMaterial(PALETTE.night)); post.position.set(x, 0.7, z); liftMesh.add(post);
    }
  }
  root.add(liftMesh);
  // A 24cm bottom deck is below the character's 40cm autostep threshold.
  // The previous 44cm riser made boarding depend on the mover's exact phase.
  const liftBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(195, 0.02, -185));
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(2.6, 0.22, 2.6).setFriction(1), liftBody);
  const mover = physics.addMover(liftBody, { path: [[195, 0.02, -185], [195, 7.98, -185]], speed: 1.5, hold: 3, ease: 'inOutSine' });
  physics.bind(liftBody, liftMesh);
  const lift = { body: liftBody, mesh: liftMesh, mover, x: 195, z: -185, bottom: 0.24, top: 8.2, landing: { x: 195, y: 8.2, z: -194 } };
  cylinder(202, 14.8, -199, 0.45, 13.2, 'night');
  for (const y of [13, 17, 20]) box(202, y, -199, 6 - (y - 13) * 0.35, 0.22, 0.22, 'sand');
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 5), glowMaterial(PALETTE.red));
  beacon.position.set(202, 21.7, -199); root.add(beacon);
  sign('PUBLIC FREQUENCY 88.4', 195, 10.2, -200.7, 22, 3.2, Math.PI, 'orange');
  lightHandles.push(ctx.lights.request({ position: [195, 9.8, -185], color: PALETTE.orange, intensity: 6, radius: 12, name: 'broadcast lift' }));

  // Existing library street furniture and Kenney palms establish human scale.
  const nature = await loadPack('packs/kenney-nature.json');
  let palmCount = 0;
  function palm(x, z, scale = 1.6) {
    library(palmCount++ % 2 ? 'kenney-nature/tree-palm' : 'kenney-nature/tree-palm-bend', x, 0, z, scale, palmCount * 0.73, {}, nature);
    colliders.push(physics.addStaticCylinder([x, 1.6, z], 1.6, 0.28 * scale));
    cylinder(x, 0.1, z, 1.6, 0.2, 'teal');
  }
  for (let z = -238; z <= 242; z += 30) {
    if (SITES.some(s => s.x > 220 && Math.abs(s.z - z) < 14)) continue;
    palm(245, z, 1.7);
    library('park-bench', 242, 0.1, z + 5, 1.3, Math.PI / 2, { wood: 'sand', wood2: 'orange' });
    colliders.push(physics.addStaticBox({ position: [242, 0.45, z + 5], halfExtents: [0.4, 0.45, 1.05] }));
  }
  for (const x of [-96, 12, 120]) for (const z of [-180, -72, 36, 144]) {
    if (SITES.some(s => Math.hypot(s.x - x, s.z - z) < 21)) continue;
    palm(x, z, 1.35);
  }
  palm(-15, 32, 1.7); palm(-58, 22, 1.6);
  for (const x of [-216, -108, 0, 108, 216]) for (const z of [-162, -54, 54, 162]) {
    library('lamp-post', x + 12, 0, z, 2.2, -Math.PI / 2, { iron: 'night', flame: 'sand' });
    colliders.push(physics.addStaticCylinder([x + 12, 1.5, z], 1.5, 0.18));
    lightHandles.push(ctx.lights.request({ position: [x + 11.5, 4.4, z], color: PALETTE.sand, intensity: 4.5, radius: 10, priority: 0.4, name: 'street lamp' }));
  }
  // Clearly visible perimeter barriers, including street dead ends.
  for (const [x, z, w, d] of [[-251, 0, 2, 504], [0, -251, 504, 2], [0, 251, 504, 2]]) {
    box(x, 0.65, z, w, 1.3, d, 'slate', true);
    box(x, 1.34, z, w + 0.15, 0.12, d + 0.15, 'sand');
  }
  // Merged by quadrant and material: detailed buildings stay inexpensive while
  // off-screen quarters can be culled independently.
  const mergedMeshes = [];
  for (const bucket of buckets) {
    const meshes = mergeStaticMeshes(bucket, { castShadow: true, receiveShadow: true });
    root.add(...meshes); mergedMeshes.push(...meshes);
  }
  boxGeometry.dispose(); cylinderGeometry.dispose();
  generatedGeometry.delete(boxGeometry); generatedGeometry.delete(cylinderGeometry);
  let disposed = false;
  return {
    root, buildings,
    roads: { xs: [...ROAD_COORDS], zs: [...ROAD_COORDS], width: 20 },
    landmarks: SITES.map(({ name, x, z }) => ({ name, x, z })),
    bounds: 252, lift, water,
    stats: { buildings: buildings.length, palms: palmCount, mergedMeshes: mergedMeshes.length, signs: signs.length, lights: lightHandles.length },
    update(dt, time) {
      water.update(time ?? physics.time, ctx.engine.sunDir);
      beacon.visible = Math.sin((time ?? physics.time) * 3) > -0.25;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const light of lightHandles) light.release();
      mover.remove(); physics.unbind(liftMesh);
      if (physics.isAlive(liftBody)) physics.remove(liftBody);
      for (const collider of colliders) if (physics.isAlive(collider)) physics.remove(collider);
      water.dispose(); root.removeFromParent();
      for (const mesh of mergedMeshes) mesh.geometry.dispose();
      for (const geometry of generatedGeometry) geometry.dispose();
      for (const texture of signTextures.values()) texture.dispose();
      for (const mesh of signs) mesh.material.dispose();
      liftMesh.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
      beacon.geometry.dispose();
    },
  };
}
