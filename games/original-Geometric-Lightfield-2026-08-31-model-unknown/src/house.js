// The atmospheric house: five rooms with one installed light each, plus the
// porch floodlight on the front wall and the garden shed with its swinging work
// lamp. Static geometry is instanced and frozen; fixtures register with the
// light director and animate here (TV static, flicker, clock blink, sensor, swing).
import * as THREE from 'three/webgpu';
import { pushBoxCollider, setInstance, finishInstanced, freeze } from './world.js';

export const ROOMS = [
  { id: 'living-room', label: 'Living room', minX: -21, maxX: -14.4, minZ: -12, maxZ: -5 },
  { id: 'kitchen', label: 'Kitchen', minX: -11.6, maxX: -5, minZ: -12, maxZ: -5 },
  { id: 'bedroom', label: 'Bedroom', minX: -21, maxX: -14.4, minZ: -19, maxZ: -12 },
  { id: 'hallway', label: 'Hallway', minX: -14.4, maxX: -11.6, minZ: -19, maxZ: -5 },
  { id: 'study', label: 'Study', minX: -11.6, maxX: -5, minZ: -19, maxZ: -12 },
  // New: the garden shed east of the house.
  { id: 'shed', label: 'Garden shed', minX: -3.2, maxX: 0.8, minZ: -15.4, maxZ: -10.6 },
];

/** Every light the player can switch in the house and yard (rounds count these). */
export const HOUSE_LIGHTS = [
  { room: 'living-room', id: 'tv-static-light', label: 'TV static', color: '#75d9ff', behavior: 'cold procedural static' },
  { room: 'kitchen', id: 'fridge-light', label: 'Open fridge', color: '#b9f3ff', behavior: 'cold open-door spill' },
  { room: 'bedroom', id: 'fallen-lamp', label: 'Fallen pink lamp', color: '#ff6fac', behavior: 'movable sideways beam' },
  { room: 'hallway', id: 'hall-flicker-light', label: 'Flickering hall bulb', color: '#ffc15a', behavior: 'unstable amber flicker' },
  { room: 'study', id: 'led-clock-light', label: 'Blinking LED clock', color: '#ff2d3f', behavior: 'red one-hertz pulse' },
  { room: 'exterior', id: 'porch-floodlight', label: 'Porch floodlight', color: '#eef4ff', behavior: 'motion-sensor flood' },
  { room: 'shed', id: 'shed-work-lamp', label: 'Swinging work lamp', color: '#ffdca0', behavior: 'pendulum work lamp' },
];

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const tmpColor = new THREE.Color();
const LED_RED = new THREE.Color('#ff2d3f');
const LED_GREEN = new THREE.Color('#6dff9a');

function shadowed(mesh, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

const PORCH = { x: -13, y: 3.35, z: -4.7 };
const SHED = { cx: -1.2, cz: -13, minX: -3.2, maxX: 0.8, minZ: -15.4, maxZ: -10.6, height: 2.7 };

export class House {
  constructor(scene, materials, director) {
    this.scene = scene;
    this.materials = materials;
    this.director = director;
    this.staticRoot = new THREE.Group();
    this.dynamicRoot = new THREE.Group();
    this.staticRoot.name = 'atmospheric-house-static';
    this.dynamicRoot.name = 'atmospheric-house-fixtures';
    this.colliders = [];
    this.contactPoints = [];
    this.lightControls = [];
    this.carryables = [];
    this.rooms = ROOMS;
    this.fixtures = new Map();
    this.hallCage = new THREE.Group();
    this.hallSweepTarget = new THREE.Object3D();
    this.lastLampPosition = new THREE.Vector3();
    this.hallCasterPosition = new THREE.Vector3();
    this.elapsed = 0;
    this.tvTimer = 1;
    this.clockTimer = 1;
    this.clockColonVisible = true;
    this.staticSeed = 4378637;
    this.events = { clockTick: null, porchTrigger: null };

    this.houseWall = this.standard('#626665', 0.92, 0.01);
    this.houseFloor = this.standard('#5b5147', 0.9, 0.01);
    this.darkWood = this.standard('#302620', 0.82, 0.02);
    this.paleWood = this.standard('#8f7458', 0.78, 0.02);
    this.fabric = this.standard('#425a58', 0.97, 0);
    this.appliance = this.standard('#d5d7d1', 0.48, 0.08);
    this.metal = this.standard('#41474a', 0.38, 0.48);
    this.pink = this.standard('#7f304c', 0.76, 0.02);

    this.tvCanvas = document.createElement('canvas');
    this.tvCanvas.width = 96;
    this.tvCanvas.height = 64;
    this.tvContext = this.tvCanvas.getContext('2d');
    this.tvTexture = this.canvasTexture(this.tvCanvas);
    this.tvImageData = this.tvContext?.createImageData(this.tvCanvas.width, this.tvCanvas.height) ?? null;
    this.clockCanvas = document.createElement('canvas');
    this.clockCanvas.width = 192;
    this.clockCanvas.height = 64;
    this.clockContext = this.clockCanvas.getContext('2d');
    this.clockTexture = this.canvasTexture(this.clockCanvas);

    this.buildShell();
    this.buildLivingRoom();
    this.buildKitchen();
    this.buildBedroom();
    this.buildHallway();
    this.buildStudy();
    this.buildPorch();
    this.buildShed();
    freeze(this.staticRoot);
    scene.add(this.staticRoot, this.dynamicRoot);
  }

  canvasTexture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  }

  standard(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness, flatShading: true });
  }

  emitter(color, intensity) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      roughness: 0.42,
      metalness: 0,
      flatShading: true,
    });
  }

  /** A unit-box mesh; with `collide` it also becomes a collider (rotation about Y only). */
  box(name, p, s, material, parent = this.staticRoot, rotationY = 0, collide = false) {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.name = name;
    mesh.position.set(p[0], p[1], p[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    mesh.rotation.y = rotationY;
    shadowed(mesh);
    parent.add(mesh);
    if (collide) {
      const sx = Math.abs(Math.cos(rotationY)) * s[0] + Math.abs(Math.sin(rotationY)) * s[2];
      const sz = Math.abs(Math.sin(rotationY)) * s[0] + Math.abs(Math.cos(rotationY)) * s[2];
      pushBoxCollider(this.colliders, p[0], p[2], sx, sz, s[1], p[1] - s[1] / 2);
    }
    return mesh;
  }

  addContact(x, z, sizeX, sizeZ) {
    this.contactPoints.push({ x, z, sizeX, sizeZ });
  }

  buildShell() {
    const walls = [
      { p: [-13, 2.1, -19], s: [16.3, 4.2, 0.34] },
      { p: [-21, 2.1, -12], s: [0.34, 4.2, 14.3] },
      { p: [-5, 2.1, -12], s: [0.34, 4.2, 14.3] },
      { p: [-17.5, 2.1, -5], s: [7, 4.2, 0.34] },
      { p: [-8.5, 2.1, -5], s: [7, 4.2, 0.34] },
      { p: [-14.4, 2.1, -6.55], s: [0.26, 4.2, 3.1] },
      { p: [-14.4, 2.1, -12.3], s: [0.26, 4.2, 3.8] },
      { p: [-14.4, 2.1, -17.6], s: [0.26, 4.2, 2.8] },
      { p: [-11.6, 2.1, -6.55], s: [0.26, 4.2, 3.1] },
      { p: [-11.6, 2.1, -12.3], s: [0.26, 4.2, 3.8] },
      { p: [-11.6, 2.1, -17.6], s: [0.26, 4.2, 2.8] },
      { p: [-17.7, 2.1, -12], s: [6.6, 4.2, 0.26] },
      { p: [-8.3, 2.1, -12], s: [6.6, 4.2, 0.26] },
      { p: [-13, 4.27, -12], s: [16.3, 0.3, 14.3] },
    ];
    const shell = new THREE.InstancedMesh(UNIT_BOX, this.houseWall, walls.length);
    shell.name = 'five-room-house-shell';
    walls.forEach(({ p, s }, i) => {
      setInstance(shell, i, p, s);
      pushBoxCollider(this.colliders, p[0], p[2], s[0], s[2], s[1], p[1] - s[1] / 2);
    });
    finishInstanced(shell);
    this.staticRoot.add(shell);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), this.houseFloor);
    floor.name = 'house-floor';
    floor.position.set(-13, 0.012, -12);
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    floor.receiveShadow = true;
    this.staticRoot.add(floor);

    const thresholds = [
      [[-13, 0.03, -5], [2, 0.035, 0.34]],
      [[-14.4, 0.03, -9.3], [0.34, 0.035, 2.2]],
      [[-11.6, 0.03, -9.3], [0.34, 0.035, 2.2]],
      [[-14.4, 0.03, -15.2], [0.34, 0.035, 2]],
      [[-11.6, 0.03, -15.2], [0.34, 0.035, 2]],
    ];
    const sills = new THREE.InstancedMesh(UNIT_BOX, this.metal, thresholds.length);
    sills.name = 'room-thresholds';
    thresholds.forEach(([p, s], i) => setInstance(sills, i, p, s));
    finishInstanced(sills, false);
    this.staticRoot.add(sills);

    const rugMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.98, metalness: 0, flatShading: true });
    const rugs = new THREE.InstancedMesh(UNIT_BOX, rugMaterial, 3);
    rugs.name = 'low-poly-room-rugs';
    setInstance(rugs, 0, [-17.5, 0.016, -8.6], [4.2, 0.006, 3.5]);
    setInstance(rugs, 1, [-17.8, 0.016, -15.7], [4.6, 0.006, 4]);
    setInstance(rugs, 2, [-8.2, 0.016, -15.7], [4.2, 0.006, 3.6]);
    rugs.setColorAt(0, tmpColor.set('#9b5548'));
    rugs.setColorAt(1, tmpColor.set('#60405f'));
    rugs.setColorAt(2, tmpColor.set('#344d61'));
    finishInstanced(rugs, false);
    this.staticRoot.add(rugs);
  }

  buildLivingRoom() {
    this.box('living-room-sofa-base', [-17.1, 0.58, -8.55], [1.05, 0.72, 3.2], this.fabric, this.staticRoot, 0, true);
    this.box('living-room-sofa-back', [-16.65, 1.15, -8.55], [0.28, 1.18, 3.2], this.fabric);
    this.box('living-room-coffee-table', [-18.75, 0.42, -8.55], [1.5, 0.18, 2.1], this.paleWood, this.staticRoot, 0, true);
    this.box('tv-console', [-20.45, 0.55, -8.55], [0.7, 1, 2.7], this.darkWood, this.staticRoot, 0, true);
    const feet = [
      [[-17.43, 0.11, -9.72], [0.16, 0.22, 0.16]],
      [[-16.77, 0.11, -9.72], [0.16, 0.22, 0.16]],
      [[-17.43, 0.11, -7.38], [0.16, 0.22, 0.16]],
      [[-16.77, 0.11, -7.38], [0.16, 0.22, 0.16]],
      [[-19.25, 0.17, -9.25], [0.12, 0.34, 0.12]],
      [[-18.25, 0.17, -9.25], [0.12, 0.34, 0.12]],
      [[-19.25, 0.17, -7.85], [0.12, 0.34, 0.12]],
      [[-18.25, 0.17, -7.85], [0.12, 0.34, 0.12]],
    ];
    const feetMesh = new THREE.InstancedMesh(UNIT_BOX, this.darkWood, feet.length);
    feetMesh.name = 'living-room-furniture-feet';
    feet.forEach(([p, s], i) => setInstance(feetMesh, i, p, s));
    finishInstanced(feetMesh);
    this.staticRoot.add(feetMesh);
    this.addContact(-17.1, -8.55, 1.2, 3.25);
    this.addContact(-18.75, -8.55, 1.6, 2.2);

    const root = new THREE.Group();
    root.name = 'tv-static-fixture';
    root.position.set(-20.73, 1.75, -8.55);
    const frame = shadowed(new THREE.Mesh(UNIT_BOX, this.metal));
    frame.scale.set(0.14, 1.65, 2.65);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: '#84dbff',
      map: this.tvTexture,
      emissive: '#5bc7ff',
      emissiveMap: this.tvTexture,
      emissiveIntensity: 4.2,
      roughness: 0.35,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 1.38), screenMaterial);
    screen.name = 'procedural-tv-static-screen';
    screen.position.x = 0.078;
    screen.rotation.y = Math.PI / 2;
    root.add(frame, screen);
    const target = new THREE.Object3D();
    target.position.set(5.2, -0.55, 0);
    const light = new THREE.SpotLight('#75d9ff', 92, 8.5, Math.PI * 0.28, 0.78, 2);
    light.position.set(0.24, -0.12, 0);
    light.target = target;
    light.castShadow = false;
    root.add(target, light);
    this.dynamicRoot.add(root);
    this.registerFixture('tv-static-light', 'living-room', root, light, screenMaterial, 92, false, {
      fixture: 'television-screen', mobility: 'static', importance: 0.58, sourceRadius: 0.34, shadowMinQuality: 'high', shadowFps: {},
    });
    this.updateTVTexture();
  }

  buildKitchen() {
    const counters = [
      { p: [-8.3, 0.48, -5.65], s: [4.8, 0.9, 0.75] },
      { p: [-5.65, 0.48, -7.3], s: [0.75, 0.9, 2.6] },
      { p: [-9, 0.47, -9.2], s: [1.2, 0.9, 2.8] },
    ];
    const counterMesh = new THREE.InstancedMesh(UNIT_BOX, this.paleWood, counters.length);
    counterMesh.name = 'kitchen-counters';
    counters.forEach(({ p, s }, i) => {
      setInstance(counterMesh, i, p, s);
      pushBoxCollider(this.colliders, p[0], p[2], s[0], s[2], s[1]);
      this.addContact(p[0], p[2], s[0], s[2]);
    });
    finishInstanced(counterMesh);
    this.staticRoot.add(counterMesh);
    this.box('fridge-cabinet', [-5.68, 1.22, -10.45], [1.05, 2.4, 1.65], this.appliance, this.staticRoot, 0, true);
    this.box('open-fridge-interior', [-6.23, 1.28, -10.45], [0.06, 1.92, 1.28], this.standard('#172326', 0.86, 0.02));

    const root = new THREE.Group();
    root.name = 'open-fridge-fixture';
    root.position.set(-6.33, 1.3, -10.45);
    const glow = this.emitter('#b9f3ff', 4.8);
    const panel = new THREE.Mesh(UNIT_BOX, glow);
    panel.name = 'fridge-cold-emitter';
    panel.scale.set(0.05, 1.7, 1.1);
    panel.castShadow = false;
    panel.receiveShadow = false;
    const hinge = new THREE.Group();
    hinge.name = 'open-fridge-door-hinge';
    hinge.position.set(0.15, 0, 0.72);
    hinge.rotation.y = -1.05;
    const door = shadowed(new THREE.Mesh(UNIT_BOX, this.appliance));
    door.name = 'open-fridge-door';
    door.position.set(0, 0, -0.72);
    door.scale.set(0.12, 2.36, 1.44);
    const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 6), this.metal));
    handle.position.set(-0.11, 0, -1.22);
    hinge.add(door, handle);
    const target = new THREE.Object3D();
    target.position.set(-4.8, -0.55, 0);
    const light = new THREE.SpotLight('#b9f3ff', 145, 9, Math.PI * 0.27, 0.68, 2);
    light.position.set(-0.15, 0.12, 0);
    light.target = target;
    root.add(panel, hinge, target, light);
    this.dynamicRoot.add(root);
    this.registerFixture('fridge-light', 'kitchen', root, light, glow, 145, true, {
      fixture: 'open-fridge', mobility: 'static', importance: 0.72, sourceRadius: 0.38, shadowMinQuality: 'low', shadowFps: {},
    });
    this.addContact(-5.85, -10.45, 1.2, 1.8);
  }

  buildBedroom() {
    this.box('low-poly-bed-frame', [-18.1, 0.35, -15.65], [3.4, 0.5, 4.8], this.darkWood, this.staticRoot, 0, true);
    this.box('bed-mattress', [-18.1, 0.72, -15.65], [3.15, 0.34, 4.5], this.materials.stoneLight);
    this.box('bed-pillow', [-18.1, 1, -17.15], [2.3, 0.24, 0.75], this.materials.playerHead);
    this.box('bedroom-dresser', [-20.15, 0.75, -13.05], [1.25, 1.42, 1.7], this.paleWood, this.staticRoot, 0, true);
    this.addContact(-18.1, -15.65, 3.55, 4.9);

    const root = new THREE.Group();
    root.name = 'fallen-lamp-fixture';
    root.position.set(-15.62, 0.54, -16.65);
    root.rotation.y = 0.28;
    const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.18, 9), this.metal));
    base.rotation.z = Math.PI / 2;
    base.position.x = 0.78;
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.55, 7), this.metal));
    pole.rotation.z = Math.PI / 2;
    const shade = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.52, 0.58, 8, 1, true), this.pink));
    shade.rotation.z = Math.PI / 2;
    shade.position.x = -0.86;
    const glow = this.emitter('#ff6fac', 5.4);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), glow);
    bulb.name = 'fallen-lamp-pink-emitter';
    bulb.position.set(-1.15, 0, 0);
    bulb.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(-6, -0.18, 0);
    const light = new THREE.SpotLight('#ff6fac', 165, 10, Math.PI * 0.24, 0.66, 2);
    light.position.set(-1.05, 0, 0);
    light.target = target;
    root.add(base, pole, shade, bulb, target, light);
    this.dynamicRoot.add(root);
    this.registerFixture('fallen-lamp', 'bedroom', root, light, glow, 165, true, {
      fixture: 'fallen-floor-lamp', mobility: 'movable', importance: 0.9, sourceRadius: 0.24, shadowMinQuality: 'low', shadowFps: {},
    });
    const control = this.lightControls.find((c) => c.id === 'fallen-lamp');
    this.carryables.push({ id: 'fallen-lamp', label: 'Fallen pink lamp', root, dropY: 0.54, pickupDistance: 6.1, light: control });
    this.lastLampPosition.copy(root.position);
  }

  buildHallway() {
    const pictureWood = this.standard('#9b6444', 0.72, 0.02);
    this.box('hall-console', [-13, 0.48, -17.8], [1.65, 0.9, 0.55], this.darkWood, this.staticRoot, 0, true);
    this.box('crooked-hall-picture', [-13, 2.05, -18.78], [1.15, 0.78, 0.08], pictureWood, this.staticRoot, 0.12);
    this.addContact(-13, -17.8, 1.75, 0.7);

    const root = new THREE.Group();
    root.name = 'hall-flicker-fixture';
    root.position.set(-13, 0, -12);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), this.metal);
    cord.position.y = 3.92;
    const glow = this.emitter('#ffc15a', 4.5);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glow);
    bulb.name = 'unstable-hall-bulb';
    bulb.position.y = 3.52;
    bulb.castShadow = false;
    this.hallCage.position.y = 3.52;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.5, 6, 1, true), this.metal);
    cage.castShadow = true;
    const barA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5), this.metal);
    barA.rotation.z = Math.PI / 2;
    const barB = barA.clone();
    barB.rotation.x = Math.PI / 2;
    barB.rotation.z = 0;
    this.hallSweepTarget.position.set(2.2, -2.35, 0);
    this.hallCage.add(cage, barA, barB, this.hallSweepTarget);
    const light = new THREE.SpotLight('#ffc15a', 128, 9.5, Math.PI * 0.22, 0.72, 2);
    light.position.y = 3.45;
    light.target = this.hallSweepTarget;
    light.castShadow = false;
    root.add(cord, bulb, this.hallCage, light);
    this.dynamicRoot.add(root);
    this.registerFixture('hall-flicker-light', 'hallway', root, light, glow, 128, true, {
      fixture: 'rotating-ceiling-lamp', mobility: 'animated', importance: 0.78, sourceRadius: 0.28, shadowMinQuality: 'high', shadowFps: { high: 30, ultra: 0 },
    });
  }

  buildStudy() {
    this.box('study-desk', [-8.2, 0.72, -17.65], [3.8, 0.18, 1.3], this.paleWood, this.staticRoot, 0, true);
    this.box('study-desk-drawer', [-9.55, 0.42, -17.65], [0.82, 0.72, 1.15], this.darkWood);
    this.box('study-chair', [-8.1, 0.52, -15.8], [1.05, 0.18, 1.05], this.fabric, this.staticRoot, 0, true);
    const shelves = new THREE.InstancedMesh(UNIT_BOX, this.darkWood, 4);
    shelves.name = 'study-wall-shelves';
    for (let i = 0; i < 4; i += 1) setInstance(shelves, i, [-5.55, 0.55 + i * 0.75, -14.6], [0.55, 0.12, 3.5]);
    finishInstanced(shelves);
    this.staticRoot.add(shelves);
    this.addContact(-8.2, -17.65, 3.9, 1.5);
    this.addContact(-8.1, -15.8, 1.15, 1.15);
    const ornament = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), this.materials.terracotta));
    ornament.name = 'faceted-desk-ornament';
    ornament.position.set(-7.15, 1.15, -17.65);
    this.staticRoot.add(ornament);

    const root = new THREE.Group();
    root.name = 'led-clock-fixture';
    root.position.set(-8.25, 1.42, -18.38);
    const body = shadowed(new THREE.Mesh(UNIT_BOX, this.metal));
    body.scale.set(1.45, 0.58, 0.45);
    const displayMaterial = new THREE.MeshStandardMaterial({
      color: '#ff2338',
      map: this.clockTexture,
      emissive: '#ff1830',
      emissiveMap: this.clockTexture,
      emissiveIntensity: 5,
      roughness: 0.42,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.34), displayMaterial);
    display.name = 'blinking-led-clock-display';
    display.position.z = 0.231;
    display.castShadow = false;
    const light = new THREE.PointLight('#ff2d3f', 15, 4.2, 2);
    light.position.set(0, 0, 0.4);
    light.castShadow = false;
    root.add(body, display, light);
    this.dynamicRoot.add(root);
    this.registerFixture('led-clock-light', 'study', root, light, displayMaterial, 15, false, {
      fixture: 'led-clock', mobility: 'static', importance: 0.25, sourceRadius: 0.08, shadowMinQuality: 'ultra', shadowFps: {},
    });
    this.updateClockTexture();
  }

  /** New: a motion-sensor floodlight above the front door. Armed, it wakes when someone walks the front yard after dark. */
  buildPorch() {
    const root = new THREE.Group();
    root.name = 'porch-floodlight-fixture';
    root.position.set(PORCH.x, PORCH.y, PORCH.z);
    const plate = shadowed(new THREE.Mesh(UNIT_BOX, this.metal));
    plate.scale.set(0.34, 0.3, 0.06);
    plate.position.set(0, 0.04, -0.06);
    const arm = shadowed(new THREE.Mesh(UNIT_BOX, this.metal));
    arm.scale.set(0.08, 0.08, 0.3);
    arm.position.set(0, 0.04, 0.1);
    // The head tilts its lens (its underside) out towards the yard.
    const head = new THREE.Group();
    head.position.set(0, 0, 0.26);
    head.rotation.x = -0.62;
    // The housing and sensor sit behind the light: they must not shadow their own beam.
    const housing = shadowed(new THREE.Mesh(UNIT_BOX, this.metal), false);
    housing.scale.set(0.66, 0.2, 0.3);
    const glow = this.emitter('#eef4ff', 5.2);
    const lens = new THREE.Mesh(UNIT_BOX, glow);
    lens.name = 'porch-floodlight-lens';
    lens.scale.set(0.58, 0.03, 0.24);
    lens.position.y = -0.1;
    lens.castShadow = false;
    head.add(housing, lens);
    const sensor = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), this.appliance), false);
    sensor.position.set(0.3, -0.14, 0.02);
    this.porchLed = new THREE.MeshStandardMaterial({ color: '#ff2d3f', emissive: '#ff2d3f', emissiveIntensity: 1.2, roughness: 0.4, metalness: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), this.porchLed);
    led.position.set(0.3, -0.2, 0.07);
    led.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(0, -PORCH.y, 7.6);
    const light = new THREE.SpotLight('#eef4ff', 260, 17, Math.PI * 0.3, 0.55, 2);
    // Just below the lens (head-local (0, -0.2, 0) under the -0.62 rad tilt).
    light.position.set(0, -0.165, 0.375);
    light.target = target;
    root.add(plate, arm, head, sensor, led, target, light);
    this.dynamicRoot.add(root);
    this.registerFixture('porch-floodlight', 'exterior', root, light, glow, 260, true, {
      fixture: 'motion-floodlight', mobility: 'static', importance: 0.7, sourceRadius: 0.3, shadowMinQuality: 'medium', shadowFps: {},
    });
    const fixture = this.fixtures.get('porch-floodlight');
    // Starts disarmed and dark: the player arms it, then the sensor switches it.
    this.porch = { fixture, armed: false, hold: 0, level: 0, triggered: false, blink: 0, ledColor: null };
    this.director.setEnabled('porch-floodlight', false);
    fixture.enabled = false;
    const control = this.lightControls.find((c) => c.id === 'porch-floodlight');
    control.maxDistance = 9;
    control.isEnabled = () => this.porch.armed;
    control.setEnabled = (on) => this.setPorchArmed(on);
  }

  setPorchArmed(on) {
    this.porch.armed = on;
    if (!on) this.porch.hold = 0;
    // Arming in the yard at night lights it at once, so the switch visibly does something.
    else this.porch.hold = Math.max(this.porch.hold, 2.5);
  }

  /** New: a garden shed east of the house, lit by a work lamp that swings on its chain. */
  buildShed() {
    const plank = this.standard('#5e5446', 0.9, 0.01);
    const roofMat = this.standard('#3b3f3d', 0.8, 0.12);
    const { cx, cz, minX, maxX, minZ, maxZ, height } = SHED;
    const h = height / 2;
    const walls = [
      { p: [cx, h, minZ + 0.1], s: [maxX - minX, height, 0.2] },
      { p: [minX + 0.1, h, cz], s: [0.2, height, maxZ - minZ] },
      { p: [maxX - 0.1, h, cz], s: [0.2, height, maxZ - minZ] },
      { p: [-2.575, h, maxZ - 0.1], s: [1.25, height, 0.2] },
      { p: [0.175, h, maxZ - 0.1], s: [1.25, height, 0.2] },
      { p: [cx, 2.45, maxZ - 0.1], s: [1.5, 0.5, 0.2] },
    ];
    const shell = new THREE.InstancedMesh(UNIT_BOX, plank, walls.length);
    shell.name = 'garden-shed-walls';
    walls.forEach(({ p, s }, i) => {
      setInstance(shell, i, p, s);
      pushBoxCollider(this.colliders, p[0], p[2], s[0], s[2], s[1], p[1] - s[1] / 2);
    });
    finishInstanced(shell);
    this.staticRoot.add(shell);
    // Roof slab (also the ceiling collider) with three ribs on top.
    this.box('garden-shed-roof', [cx, height + 0.1, cz], [maxX - minX + 0.5, 0.2, maxZ - minZ + 0.6], roofMat, this.staticRoot, 0, true);
    const ribs = new THREE.InstancedMesh(UNIT_BOX, roofMat, 3);
    ribs.name = 'garden-shed-roof-ribs';
    for (let i = 0; i < 3; i += 1) setInstance(ribs, i, [cx, height + 0.26, minZ + 0.9 + i * 1.5], [maxX - minX + 0.5, 0.12, 0.16]);
    finishInstanced(ribs);
    this.staticRoot.add(ribs);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX - 0.2, maxZ - minZ - 0.2), this.houseFloor);
    floor.name = 'garden-shed-floor';
    floor.position.set(cx, 0.014, cz);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.staticRoot.add(floor);

    // Workbench along the back wall, pegboard with tools, paint cans, a shelf of jars, a stool.
    this.box('shed-workbench', [cx, 0.92, minZ + 0.6], [3.2, 0.12, 0.8], this.paleWood, this.staticRoot, 0, true);
    const legs = new THREE.InstancedMesh(UNIT_BOX, this.darkWood, 4);
    legs.name = 'shed-workbench-legs';
    [[-2.7, -15.1], [0.3, -15.1], [-2.7, -14.5], [0.3, -14.5]].forEach(([x, z], i) => setInstance(legs, i, [x, 0.43, z], [0.1, 0.86, 0.1]));
    finishInstanced(legs);
    this.staticRoot.add(legs);
    this.addContact(cx, minZ + 0.6, 3.3, 0.9);
    this.box('shed-pegboard', [cx, 1.75, minZ + 0.22], [2.4, 0.9, 0.04], this.standard('#8a7a5f', 0.95, 0));
    const tools = new THREE.InstancedMesh(UNIT_BOX, this.metal, 4);
    tools.name = 'shed-tools';
    setInstance(tools, 0, [-2.1, 1.8, minZ + 0.27], [0.08, 0.55, 0.04]);
    setInstance(tools, 1, [-1.7, 1.95, minZ + 0.27], [0.34, 0.08, 0.04]);
    setInstance(tools, 2, [-0.9, 1.72, minZ + 0.27], [0.5, 0.18, 0.03]);
    setInstance(tools, 3, [-0.3, 1.8, minZ + 0.27], [0.06, 0.62, 0.04]);
    finishInstanced(tools);
    this.staticRoot.add(tools);
    const cans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 8), this.materials.terracotta, 3);
    cans.name = 'shed-paint-cans';
    setInstance(cans, 0, [-2.4, 1.11, minZ + 0.55], [1, 1, 1]);
    setInstance(cans, 1, [-2.1, 1.11, minZ + 0.7], [0.85, 0.9, 0.85]);
    setInstance(cans, 2, [0.2, 1.11, minZ + 0.6], [1.1, 1.2, 1.1]);
    cans.setColorAt(0, tmpColor.set('#ffffff'));
    cans.setColorAt(1, tmpColor.set('#9fb4c0'));
    cans.setColorAt(2, tmpColor.set('#d9c27a'));
    finishInstanced(cans);
    this.staticRoot.add(cans);
    this.box('shed-shelf', [minX + 0.38, 1.35, cz + 0.4], [0.5, 0.08, 2.2], this.darkWood, this.staticRoot, 0, true);
    const jars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 7), this.appliance, 5);
    jars.name = 'shed-jars';
    for (let i = 0; i < 5; i += 1) setInstance(jars, i, [minX + 0.38, 1.5, cz - 0.4 + i * 0.4], [1, 0.8 + (i % 3) * 0.2, 1]);
    finishInstanced(jars);
    this.staticRoot.add(jars);
    this.box('shed-stool', [0, 0.5, -13.4], [0.5, 0.08, 0.5], this.fabric, this.staticRoot, 0, true);
    this.box('shed-stool-leg', [0, 0.23, -13.4], [0.1, 0.46, 0.1], this.darkWood);
    this.addContact(0, -13.4, 0.6, 0.6);

    // A watering can to carry around the yard.
    const can = new THREE.Group();
    can.name = 'watering-can';
    const canBody = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.36, 9), this.materials.moss));
    const spout = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.46, 6), this.materials.moss));
    spout.position.set(0.28, 0.08, 0);
    spout.rotation.z = -0.95;
    const grip = shadowed(new THREE.Mesh(UNIT_BOX, this.materials.charcoal));
    grip.scale.set(0.3, 0.04, 0.05);
    grip.position.y = 0.24;
    can.add(canBody, spout, grip);
    can.position.set(-2.55, 0.18, -11.6);
    this.dynamicRoot.add(can);
    this.carryables.push({ id: 'watering-can', label: 'Watering can', root: can, dropY: 0.18, pickupDistance: 5.8 });

    // The swinging lamp: pivot at the ceiling, chain, cage shade, bulb, spot light pointing down.
    this.shedPivot = new THREE.Group();
    this.shedPivot.name = 'shed-lamp-pivot';
    this.shedPivot.position.set(cx, height, cz - 0.2);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), this.metal);
    chain.position.y = -0.4;
    chain.castShadow = true;
    const lampHead = new THREE.Group();
    lampHead.position.y = -0.85;
    const shadeMaterial = this.standard('#50585a', 0.5, 0.45);
    shadeMaterial.side = THREE.DoubleSide;
    const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 0.24, 8, 1, true), shadeMaterial);
    shadeMesh.castShadow = true;
    const glow = this.emitter('#ffdca0', 5);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow);
    bulb.name = 'shed-lamp-bulb';
    bulb.position.y = -0.06;
    bulb.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(0, -3, 0);
    const light = new THREE.SpotLight('#ffdca0', 150, 7.5, Math.PI * 0.3, 0.6, 2);
    light.position.y = -0.1;
    light.target = target;
    lampHead.add(shadeMesh, bulb, target, light);
    this.shedPivot.add(chain, lampHead);
    this.dynamicRoot.add(this.shedPivot);
    this.registerFixture('shed-work-lamp', 'shed', this.shedPivot, light, glow, 150, true, {
      fixture: 'swinging-work-lamp', mobility: 'animated', importance: 0.74, sourceRadius: 0.22, shadowMinQuality: 'medium', shadowFps: { medium: 20, high: 30, ultra: 0 },
    });
    this.swing = { ax: 0.08, az: -0.05, vx: 0, vz: 0, draft: 2.5, random: 918273 };
  }

  registerFixture(id, room, root, light, emitter, intensity, castsShadow, cfg) {
    light.name = id;
    light.userData.lightScope = 'room-local';
    light.userData.roomId = room;
    light.userData.lightId = id;
    root.userData.lightId = id;
    root.userData.roomId = room;
    if (castsShadow && light.isSpotLight) this.configureSpotShadow(light, light.distance);
    const label = HOUSE_LIGHTS.find((l) => l.id === id)?.label ?? id;
    const handle = this.director.add({
      id,
      label,
      fixture: cfg.fixture,
      zone: room,
      mobility: cfg.mobility,
      light,
      root,
      emitter,
      intensity,
      emissiveIntensity: emitter.emissiveIntensity,
      sourceRadius: cfg.sourceRadius,
      importance: cfg.importance,
      shadow: castsShadow ? 'auto' : 'never',
      shadowMinQuality: cfg.shadowMinQuality,
      shadowDistance: light.distance || undefined,
      shadowFps: cfg.shadowFps,
    });
    const fixture = { id, room, root, light, emitter, enabled: true, baseIntensity: intensity, handle };
    this.fixtures.set(id, fixture);
    this.lightControls.push({
      id,
      label,
      room,
      root,
      maxDistance: 8,
      isEnabled: () => fixture.enabled,
      setEnabled: (on) => this.setFixtureEnabled(id, on),
    });
  }

  configureSpotShadow(light, far) {
    light.castShadow = true;
    light.shadow.bias = -35e-5;
    light.shadow.normalBias = 0.035;
    light.shadow.camera.near = 0.18;
    light.shadow.camera.far = far;
    light.shadow.autoUpdate = false;
  }

  setFixtureEnabled(id, on) {
    const f = this.fixtures.get(id);
    if (!f) return;
    if (id === 'porch-floodlight') {
      this.setPorchArmed(on);
      return;
    }
    f.enabled = on;
    f.handle.setEnabled(on);
    if (id === 'shed-work-lamp') this.pushSwing(0.12, 0.05);
  }

  /** On/off state of every switchable house light (porch: armed). */
  getLightStates() {
    const out = {};
    for (const c of this.lightControls) out[c.id] = c.isEnabled();
    return out;
  }

  update(dt, ctx) {
    this.elapsed += dt;
    this.tvTimer += dt;
    this.clockTimer += dt;
    this.hallCage.rotation.y += dt * 0.52;
    this.hallCage.rotation.z = Math.sin(this.elapsed * 0.7) * 0.06;
    if (dt > 0) {
      this.hallCage.updateWorldMatrix(true, true);
      this.hallCage.getWorldPosition(this.hallCasterPosition);
      this.director.invalidateDynamicCaster(this.hallCasterPosition, 0.5);
    }

    const tv = this.fixtures.get('tv-static-light');
    if (tv.enabled && this.tvTimer >= 1 / 12) {
      this.updateTVTexture();
      const k = 0.82 + Math.sin(this.elapsed * 37) * 0.08 + this.random() * 0.1;
      tv.light.intensity = tv.baseIntensity * k;
      tv.emitter.emissiveIntensity = 3.8 + this.random() * 1.7;
      this.tvTimer = 0;
    }

    const hall = this.fixtures.get('hall-flicker-light');
    this.hallLevel = 0;
    if (hall.enabled) {
      const dropout = Math.sin(this.elapsed * 17.3) > 0.91 && Math.sin(this.elapsed * 41.7) > 0.55;
      const wave = 0.82 + Math.sin(this.elapsed * 6.2) * 0.11 + Math.sin(this.elapsed * 23.7) * 0.07;
      const k = dropout ? 0.08 : Math.max(0.55, wave);
      hall.light.intensity = hall.baseIntensity * k;
      hall.emitter.emissiveIntensity = 4.5 * k;
      hall.handle.invalidate();
      this.hallLevel = k;
    }

    const clock = this.fixtures.get('led-clock-light');
    if (clock.enabled && this.clockTimer >= 0.5) {
      this.clockColonVisible = !this.clockColonVisible;
      this.updateClockTexture();
      clock.light.intensity = clock.baseIntensity * (this.clockColonVisible ? 1 : 0.54);
      clock.emitter.emissiveIntensity = this.clockColonVisible ? 5 : 2.7;
      this.clockTimer = 0;
      this.events.clockTick?.(clock.root.position);
    }

    const lamp = this.fixtures.get('fallen-lamp');
    if (!lamp.root.position.equals(this.lastLampPosition)) {
      this.lastLampPosition.copy(lamp.root.position);
      lamp.root.updateMatrixWorld(true);
      lamp.handle.setZone(this.getRoomAt(lamp.root.position) ?? 'exterior');
      if (lamp.enabled) lamp.handle.invalidate(true);
    }

    if (ctx) {
      this.updatePorch(dt, ctx);
      this.updateShedLamp(dt, ctx);
    }
  }

  updatePorch(dt, ctx) {
    const p = this.porch;
    const f = p.fixture;
    if (p.armed && ctx.darkness > 0.45) {
      const dx = ctx.player.x - PORCH.x;
      const dz = ctx.player.z - PORCH.z;
      // The front yard only: the wall is at z = -5, the house is behind it.
      if (dz > -0.2 && dx * dx + dz * dz < 11 * 11) {
        if (p.hold <= 0) {
          p.triggered = true;
          this.events.porchTrigger?.(f.root.position);
        }
        p.hold = 9;
      }
    }
    p.hold = Math.max(0, p.hold - dt);
    const want = p.armed && p.hold > 0;
    if (!want) p.triggered = false;
    p.level += ((want ? 1 : 0) - p.level) * (1 - Math.exp(-dt * (want ? 7 : 1.6)));
    if (!want && p.level < 0.004) p.level = 0;
    const lit = p.level > 0;
    if (lit !== f.enabled) {
      f.enabled = lit;
      f.handle.setEnabled(lit);
    }
    if (lit) {
      // A cold lamp stutters for a moment as it strikes.
      const strike = want && p.level < 0.85 && Math.sin(this.elapsed * 53) > 0.4 ? 0.55 : 1;
      f.light.intensity = f.baseIntensity * p.level * strike;
      f.emitter.emissiveIntensity = Math.max(0.015, 5.2 * p.level * strike);
    }
    p.blink = (p.blink + dt) % 2.4;
    const led = this.porchLed;
    if (!p.armed) {
      // A dim steady standby glow, so the sensor can be found in the dark.
      led.emissiveIntensity = 0.35;
      if (p.ledColor !== LED_RED) {
        p.ledColor = LED_RED;
        led.color.copy(LED_RED);
        led.emissive.copy(LED_RED);
      }
    } else {
      led.emissiveIntensity = want || p.blink < 0.18 ? 3.2 : 0.15;
      const c = want ? LED_GREEN : LED_RED;
      if (p.ledColor !== c) {
        p.ledColor = c;
        led.color.copy(c);
        led.emissive.copy(c);
      }
    }
  }

  pushSwing(x, z) {
    this.swing.vx += x;
    this.swing.vz += z;
  }

  updateShedLamp(dt, ctx) {
    const s = this.swing;
    if (!(dt > 0)) return;
    // Drafts through the open door, stronger when the helicopter is overhead.
    s.draft -= dt;
    if (s.draft <= 0) {
      s.draft = 2 + this.swingRandom() * 4;
      this.pushSwing((this.swingRandom() - 0.5) * 0.18, (this.swingRandom() - 0.5) * 0.18);
    }
    if (ctx.heli) {
      const dx = ctx.heli.x - SHED.cx;
      const dz = ctx.heli.z - SHED.cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < 196) this.pushSwing((this.swingRandom() - 0.5) * 0.9 * dt, (this.swingRandom() - 0.5) * 0.9 * dt);
    }
    // Brushing past it (a standing head reaches the shade) pushes it away from the player.
    const px = ctx.player.x - this.shedPivot.position.x;
    const pz = ctx.player.z - this.shedPivot.position.z;
    if (px * px + pz * pz < 0.36) this.pushSwing(pz * 3 * dt, -px * 3 * dt);
    const k = 11.5;
    const damping = 0.35;
    s.vx += (-k * Math.sin(s.ax) - damping * s.vx) * dt;
    s.vz += (-k * Math.sin(s.az) - damping * s.vz) * dt;
    s.ax = Math.max(-0.7, Math.min(0.7, s.ax + s.vx * dt));
    s.az = Math.max(-0.7, Math.min(0.7, s.az + s.vz * dt));
    this.shedPivot.rotation.set(s.ax, 0, s.az);
    const f = this.fixtures.get('shed-work-lamp');
    if (f.enabled && Math.abs(s.vx) + Math.abs(s.vz) > 0.004) f.handle.invalidate();
  }

  swingRandom() {
    this.swing.random = (Math.imul(this.swing.random, 1664525) + 1013904223) >>> 0;
    return this.swing.random / 4294967296;
  }

  getRoomAt(p) {
    for (const r of ROOMS) if (p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ) return r.id;
    return null;
  }

  random() {
    this.staticSeed = Math.imul(this.staticSeed ^ (this.staticSeed >>> 15), 1 | this.staticSeed);
    this.staticSeed ^= this.staticSeed + Math.imul(this.staticSeed ^ (this.staticSeed >>> 7), 61 | this.staticSeed);
    return ((this.staticSeed ^ (this.staticSeed >>> 14)) >>> 0) / 4294967296;
  }

  updateTVTexture() {
    const ctx = this.tvContext;
    const img = this.tvImageData;
    if (!ctx || !img) return;
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = 72 + Math.floor(this.random() * 183);
      data[i] = Math.min(255, v * 0.72);
      data[i + 1] = Math.min(255, v * 0.93);
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const row = Math.floor(this.random() * this.tvCanvas.height);
    ctx.fillStyle = 'rgba(220,248,255,0.52)';
    ctx.fillRect(0, row, this.tvCanvas.width, 2);
    this.tvTexture.needsUpdate = true;
  }

  updateClockTexture() {
    const ctx = this.clockContext;
    if (!ctx) return;
    ctx.fillStyle = '#080303';
    ctx.fillRect(0, 0, this.clockCanvas.width, this.clockCanvas.height);
    ctx.fillStyle = '#ff243c';
    ctx.font = '700 46px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 13;
    ctx.shadowColor = '#ff1830';
    ctx.fillText(this.clockColonVisible ? '03:17' : '03 17', 96, 34);
    ctx.shadowBlur = 0;
    this.clockTexture.needsUpdate = true;
  }
}
