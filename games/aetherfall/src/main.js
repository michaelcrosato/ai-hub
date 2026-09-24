import { BALANCE, levelFromXp, maxHpFor, attackFor, damageAfterArmor } from './balance.js';

const $ = (id) => document.getElementById(id);
const ui = {
  viewport: $('viewport'), hud: $('hud'), loading: $('loading'), loadingText: $('loading-text'),
  start: $('start-screen'), startBtn: $('start-btn'), startHelp: $('start-help'),
  end: $('end-screen'), endSummary: $('end-summary'), restartBtn: $('restart-btn'),
  death: $('death-screen'), retryBtn: $('retry-btn'), objective: $('objective-text'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
  levelText: $('level-text'), gearText: $('gear-text'), toast: $('toast'), prompt: $('prompt'),
  rendererBadge: $('renderer-badge'), mobile: $('mobile-controls'), stickZone: $('stick-zone'), stickKnob: $('stick-knob'),
  attackBtn: $('attack-btn'), dashBtn: $('dash-btn'), interactBtn: $('interact-btn'), bossHud: $('boss-hud'), bossFill: $('boss-fill'),
};

const params = new URLSearchParams(location.search);
const forcedRenderer = params.get('renderer');
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
if (coarse) ui.startHelp.textContent = 'Left stick: move · BLADE: attack / hold to charge · DASH: evade · ACT: interact · Pinch: zoom';

let THREE;
let renderer;
let renderFrame;
let rendererKind = 'WebGL2';
let pipeline = null;
let scene, camera, clock;
let started = false;
let gameOver = false;
let complete = false;
let runStartedAt = 0;

async function initRenderer() {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  ui.viewport.appendChild(canvas);

  const canWebGPU = !!navigator.gpu && forcedRenderer !== 'webgl2' && forcedRenderer !== 'webgl1';
  if (canWebGPU || forcedRenderer === 'webgpu') {
    try {
      THREE = await import('three/webgpu');
      renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      if (renderer.shadowMap) renderer.shadowMap.enabled = true;
      rendererKind = 'WebGPU';
      await renderer.init();
      renderFrame = () => pipeline ? pipeline.render() : renderer.render(scene, camera);
      return;
    } catch (err) {
      console.warn('WebGPU init failed, using WebGL fallback.', err);
    }
  }

  const testCanvas = document.createElement('canvas');
  const gl2 = forcedRenderer !== 'webgl1' && testCanvas.getContext('webgl2', { antialias: true });
  if (gl2) {
    THREE = await import('three');
    renderer = new THREE.WebGLRenderer({ canvas, context: canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' }), antialias: true });
    rendererKind = 'WebGL2';
  } else {
    THREE = await import('three-legacy');
    const gl1 = canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl');
    if (!gl1) throw new Error('This browser has no WebGPU, WebGL2, or WebGL1 context.');
    renderer = new THREE.WebGLRenderer({ canvas, context: gl1, antialias: true });
    rendererKind = 'WebGL1 legacy';
  }
  renderFrame = () => renderer.render(scene, camera);
}

const C = {
  sand: 0xd8b77b, sand2: 0xc89a5c, grass: 0x4f8b61, grass2: 0x356c4c, cliff: 0x8d4f37,
  cliffDark: 0x613827, wood: 0x6d452d, woodLight: 0xae7744, stone: 0x6f766f, darkStone: 0x39403b,
  water: 0x3a96a9, wind: 0x79f3c8, wind2: 0xb8ffe7, hero: 0x6955a8, hero2: 0xd8c16e,
  enemy: 0x7ba66a, enemy2: 0xb9d880, boss: 0x7b6d8f, bossGlow: 0xc69cff, white: 0xf3ecd3,
};

const mats = {};
function mat(name, color, opts = {}) {
  if (mats[name]) return mats[name];
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.roughness ?? .82, metalness: opts.metalness ?? .05, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0 });
  mats[name] = m;
  return m;
}

function mesh(geo, material, x=0, y=0, z=0, cast=true, receive=true) {
  const m = new THREE.Mesh(geo, material); m.position.set(x,y,z); m.castShadow = cast; m.receiveShadow = receive; return m;
}

const colliders = [];
const interactables = [];
const enemies = [];
const projectiles = [];
const effects = [];
let boss = null;
let windmillBlades = null;
let caveSeal = null;
let runeWall = null;
let objectiveMarker = null;
let keeper = null;
let coreChest = null;
let armorChest = null;

const state = {
  quest: 0, sparks: 0, xp: 0, level: 1, swordTier: 1, armorTier: 0,
  maxHp: maxHpFor(1), hp: maxHpFor(1), attackHeld: false, attackHold: 0,
  attackCooldown: 0, dashCooldown: 0, dashTimer: 0, invuln: 0, kills: 0,
  coreClaimed: false, millOn: false, runeBroken: false, bossDefeated: false,
};

const input = { x:0, z:0, keys:new Set(), stickX:0, stickZ:0, attack:false, interact:false, dash:false };
const cameraState = { zoom: 1, targetZoom: 1, shake: 0 };
const pointerState = new Map();
const tempV = () => new THREE.Vector3();

let player;
function createHero() {
  const g = new THREE.Group();
  const cloak = mat('hero', C.hero, { roughness:.7 });
  const trim = mat('heroTrim', C.hero2, { metalness:.35, roughness:.42 });
  const skin = mat('skin', 0xc48c68);
  const hair = mat('hair', 0x2e253c);
  const boot = mat('boot', 0x352923);
  const wind = mat('wind', 0x9affdd, { emissive: C.wind, emissiveIntensity: 2.4, roughness:.3 });
  const body = mesh(new THREE.CylinderGeometry(.42,.56,1.15,6), cloak,0,1,0); g.add(body);
  const head = mesh(new THREE.IcosahedronGeometry(.34,1), skin,0,1.78,0); g.add(head);
  const hood = mesh(new THREE.ConeGeometry(.43,.48,6), hair,0,2.1,.05); hood.rotation.x=.08; g.add(hood);
  const armL = mesh(new THREE.BoxGeometry(.24,.68,.24), cloak,-.48,1.08,0); armL.rotation.z=-.18; g.add(armL);
  const armR = armL.clone(); armR.position.x=.48; armR.rotation.z=.18; g.add(armR);
  const legL = mesh(new THREE.BoxGeometry(.24,.7,.28), boot,-.2,.38,0); g.add(legL);
  const legR = legL.clone(); legR.position.x=.2; g.add(legR);
  const swordPivot = new THREE.Group(); swordPivot.position.set(.5,1.12,0); swordPivot.rotation.z=-.42; g.add(swordPivot);
  const sword = mesh(new THREE.BoxGeometry(.12,1.25,.14), trim,0,.6,0); swordPivot.add(sword);
  const blade = mesh(new THREE.BoxGeometry(.08,.95,.10), wind,0,1.18,0); swordPivot.add(blade);
  const shield = mesh(new THREE.CylinderGeometry(.38,.38,.12,8), mat('shield',0x506b72,{metalness:.45,roughness:.4}),-.48,1.06,.1); shield.rotation.z=Math.PI/2; g.add(shield);
  g.userData = { swordPivot, blade, walk:0, attackAnim:0, facing: new THREE.Vector3(0,0,-1) };
  g.position.set(-15,0,33);
  scene.add(g);
  return g;
}

function addRectCollider(x,z,w,d, tag='wall') { colliders.push({type:'rect',x,z,w,d,tag,active:true}); }
function addCircleCollider(x,z,r, tag='rock') { colliders.push({type:'circle',x,z,r,tag,active:true}); }

function addBox(x,z,w,d,h,material, y=h/2, collidable=true) {
  const m=mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z); scene.add(m); if(collidable) addRectCollider(x,z,w,d); return m;
}

function addCliffLine(points) {
  for (const [x,z,s=1] of points) {
    const rock=mesh(new THREE.DodecahedronGeometry(2.1*s,0),mat('cliff',C.cliff),x,1.3*s,z);
    rock.scale.set(1.2,.8,.9); rock.rotation.y=(x*1.7+z*.8)%2.4; scene.add(rock); addCircleCollider(x,z,1.55*s,'cliff');
    const cap=mesh(new THREE.DodecahedronGeometry(1.55*s,0),mat('cliffDark',C.cliffDark),x+.15,2.0*s,z-.1); cap.scale.set(1.15,.65,.88); scene.add(cap);
  }
}

function addTree(x,z,s=1) {
  const g=new THREE.Group(); g.position.set(x,0,z);
  const trunk=mesh(new THREE.CylinderGeometry(.23,.34,1.5,6),mat('wood',C.wood),0,.75,0); g.add(trunk);
  const crown=mesh(new THREE.IcosahedronGeometry(.95,1),mat('grassDark',C.grass2),0,1.85,0); crown.scale.set(1,.9,1); g.add(crown);
  const crown2=mesh(new THREE.IcosahedronGeometry(.68,1),mat('grass',C.grass),.35,2.25,.05); g.add(crown2);
  g.scale.setScalar(s); scene.add(g); addCircleCollider(x,z,.55*s,'tree'); return g;
}

function addSign(x,z,rotation,text) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rotation;
  g.add(mesh(new THREE.BoxGeometry(.16,1.25,.16),mat('wood',C.wood),0,.62,0));
  g.add(mesh(new THREE.BoxGeometry(1.25,.58,.14),mat('woodLight',C.woodLight),0,1.25,0));
  scene.add(g); addCircleCollider(x,z,.35,'sign');
  interactables.push({type:'sign', position:g.position, radius:2.1, prompt:'Read sign', action:()=>toast(text,2600)});
}

function addHouse(x,z,scale=1,roofColor=0x965d3d) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(scale);
  const base=mesh(new THREE.BoxGeometry(5,2.4,4),mat('plaster',0xdcc99b),0,1.2,0); g.add(base);
  const roofMat = new THREE.MeshStandardMaterial({color:roofColor,flatShading:true,roughness:.9});
  const roof=mesh(new THREE.ConeGeometry(3.6,1.8,4),roofMat,0,3.0,0); roof.rotation.y=Math.PI/4; g.add(roof);
  const door=mesh(new THREE.BoxGeometry(1.15,1.65,.15),mat('door',0x5d3927),0,.85,2.06); g.add(door);
  const lamp=mesh(new THREE.OctahedronGeometry(.18,0),mat('lamp',0xffc875,{emissive:0xffa739,emissiveIntensity:2.3}),1.25,1.45,2.18); g.add(lamp);
  scene.add(g); addRectCollider(x,z,5*scale,4*scale,'house'); return g;
}

function addBridge(x,z,w=4,d=7) {
  const g=new THREE.Group(); g.position.set(x,0,z);
  for(let i=-2;i<=2;i++) { const plank=mesh(new THREE.BoxGeometry(w,.22,1.15),mat('bridge',C.woodLight),0,.25,i*1.25); g.add(plank); }
  for(const sx of [-w/2+.18,w/2-.18]) {
    g.add(mesh(new THREE.BoxGeometry(.16,.85,d),mat('rail',C.wood),sx,.75,0));
    for(let p=-2;p<=2;p++) g.add(mesh(new THREE.BoxGeometry(.14,1.05,.14),mat('rail',C.wood),sx,.58,p*1.4));
  }
  scene.add(g); return g;
}

function addStairs(x,z,rot=0) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rot;
  for(let i=0;i<4;i++){const step=mesh(new THREE.BoxGeometry(3.1,.18+i*.12,.95),mat('stone',C.stone),0,.09+i*.06,-1.35+i*.82);g.add(step);}
  scene.add(g); return g;
}

function createWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x85b8a3);
  scene.fog = new THREE.FogExp2(0x8db5a5, 0.0125);

  camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, .1, 180);
  camera.position.set(-15,17,48);

  const hemi = new THREE.HemisphereLight(0xcdf4ea,0x63442e,1.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe3b0,3.6); sun.position.set(-18,28,20); sun.castShadow=true;
  if (sun.shadow) { sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048); sun.shadow.camera.left=-42; sun.shadow.camera.right=42; sun.shadow.camera.top=42; sun.shadow.camera.bottom=-42; sun.shadow.camera.near=.5; sun.shadow.camera.far=90; sun.shadow.bias=-.0008; }
  scene.add(sun);

  const ground = mesh(new THREE.PlaneGeometry(110,95,1,1),mat('ground',C.grass),0,-.02,4,false,true); ground.rotation.x=-Math.PI/2; scene.add(ground);
  const villagePatch=mesh(new THREE.PlaneGeometry(35,27),mat('sand',C.sand),-13,.015,31,false,true); villagePatch.rotation.x=-Math.PI/2; scene.add(villagePatch);
  const fieldPath=mesh(new THREE.PlaneGeometry(13,55),mat('sand2',C.sand2),7,.025,9,false,true); fieldPath.rotation.x=-Math.PI/2; fieldPath.rotation.z=.08; scene.add(fieldPath);
  const millPatch=mesh(new THREE.CircleGeometry(10,24),mat('sand',C.sand),20,.03,4,false,true); millPatch.rotation.x=-Math.PI/2; scene.add(millPatch);
  const cavePath=mesh(new THREE.PlaneGeometry(34,12),mat('sand',C.sand),37,.035,-12,false,true); cavePath.rotation.x=-Math.PI/2; cavePath.rotation.z=-.11; scene.add(cavePath);
  const arena=mesh(new THREE.CircleGeometry(13.3,24),mat('darkGround',0x596c5b),48,.04,-25,false,true); arena.rotation.x=-Math.PI/2; scene.add(arena);

  // River and a strongly readable bridge route.
  const river=mesh(new THREE.PlaneGeometry(86,5.2),new THREE.MeshStandardMaterial({color:C.water,roughness:.22,metalness:.05,transparent:true,opacity:.88}),0,.06,17,false,true); river.rotation.x=-Math.PI/2; river.rotation.z=-.09; scene.add(river);
  addBridge(7.5,16.5,4.2,7.5);
  addRectCollider(-28,17,67,4.2,'water'); addRectCollider(28,17,33,4.2,'water');

  addHouse(-19,32,.92); addHouse(-9,36,.82,0x775044); addHouse(-24,24,.76,0xa16e43);
  addSign(-2,27,0,'GALE MILL →  •  Shrine path ←');
  addSign(12,10,Math.PI*.5,'Mill yard →  •  Zephyr Grotto beyond the ridge');
  addStairs(7,22,0);

  addTree(-31,35,1.2); addTree(-29,28,.9); addTree(-3,38,1.0); addTree(1,31,.8); addTree(-16,15,.85);
  addTree(-8,11,.9); addTree(-14,4,.85); addTree(16,21,.92); addTree(28,16,.84); addTree(31,6,.9);

  addCliffLine([
    [-34,5,1.15],[-31,1,1],[-27,-2,1.1],[-22,-5,.95],[-17,-8,1],[-12,-10,.92],
    [4,-9,.9],[9,-10,.92],[14,-10,.9],[19,-9,.92],[24,-8,1],[29,-7,1.1],
    [32,-3,1],[34,2,1],[35,8,1.1],[35,13,1.1],
    [30,31,1.1],[25,35,1.05],[20,39,1.1],[12,42,1.15],[4,44,1.2],[-5,46,1.1],[-16,47,1.05],[-27,45,1.15],[-35,40,1.1],
    [33,-15,1],[35,-19,1],[37,-22,.95],[39,-31,1],[44,-36,1.05],[50,-38,1],[57,-35,1.1],[60,-29,1.05],[61,-22,1],[59,-15,1.05],[55,-11,1],[50,-10,.95]
  ]);

  // Mill tower and animated rotor.
  const mill = new THREE.Group(); mill.position.set(21,0,4);
  const tower=mesh(new THREE.CylinderGeometry(2.7,3.2,6.1,8),mat('millStone',0xd7d3bf),0,3.05,0); mill.add(tower);
  const roof=mesh(new THREE.ConeGeometry(3.35,2.2,8),mat('millRoof',0x436f6c),0,7.15,0); mill.add(roof);
  const door=mesh(new THREE.BoxGeometry(1.5,2.15,.18),mat('door',0x523324),0,1.08,3.14); mill.add(door);
  windmillBlades = new THREE.Group(); windmillBlades.position.set(0,5.25,3.18); mill.add(windmillBlades);
  for(let i=0;i<4;i++){const arm=new THREE.Group(); arm.rotation.z=i*Math.PI/2; const spar=mesh(new THREE.BoxGeometry(.22,3.3,.18),mat('bladeWood',0x8a6038),0,1.55,0); arm.add(spar); const sail=mesh(new THREE.BoxGeometry(1.02,1.8,.12),mat('sail',0xebe1bf),.42,2.3,.03); arm.add(sail); windmillBlades.add(arm);}
  scene.add(mill); addCircleCollider(21,4,2.7,'mill');

  // Keeper NPC.
  keeper = createNPC(14,7,0x4c6d7e,0xcdbd82);
  interactables.push({type:'keeper',position:keeper.position,radius:2.4,prompt:'Speak to Nilo',action:keeperAction});

  // Mill console.
  const consoleMesh=addBox(17.3,4.3,1.1,1.0,1.3,mat('console',0x525d55),.65,true);
  const crystal=mesh(new THREE.OctahedronGeometry(.28,0),mat('consoleCrystal',C.wind,{emissive:C.wind,emissiveIntensity:2}),17.3,1.45,4.3); scene.add(crystal);
  interactables.push({type:'millConsole',position:consoleMesh.position,radius:2.2,prompt:'Use rotor sparks',action:millAction});

  // Cave seal that drops once the mill starts.
  caveSeal = addBox(31.2,-8.4,1.1,13.0,4.5,mat('seal',0x47645c,{emissive:0x2f8068,emissiveIntensity:.6}),2.25,true);
  caveSeal.userData.collider = colliders[colliders.length-1];
  // Terrain-backed partition colliders keep the ridge gate meaningful while leaving a generous opening once the seal drops.
  addRectCollider(31.2,23.5,1.2,51.0,'ridgeNorth');
  addRectCollider(31.2,-27.0,1.2,24.0,'ridgeSouth');

  // Wind core chest and optional armor chest.
  coreChest=createChest(37.2,-12.5,C.wind); interactables.push({type:'coreChest',position:coreChest.position,radius:2.25,prompt:'Open wind reliquary',action:coreAction});
  armorChest=createChest(-20.5,-2.2,0x7ad5ff); interactables.push({type:'armorChest',position:armorChest.position,radius:2.25,prompt:'Open ridge cache',action:armorAction});

  // Breakable rune wall inside the grotto.
  runeWall=addBox(42.2,-17.5,17.0,1.15,4.0,mat('runeWall',0x59645e,{emissive:0x5a4f91,emissiveIntensity:.55}),2,true);
  runeWall.userData.collider=colliders[colliders.length-1];
  addRectCollider(32.45,-17.5,2.5,1.4,'runeBankWest');
  addRectCollider(56.35,-17.5,11.3,1.4,'runeBankEast');
  for(const x of [40.4,42.2,44]) { const r=mesh(new THREE.TorusGeometry(.34,.08,4,8),mat('rune',C.bossGlow,{emissive:C.bossGlow,emissiveIntensity:2.1}),x,2.15,-16.88); r.rotation.x=Math.PI/2; scene.add(r); runeWall.userData.runes=(runeWall.userData.runes||[]).concat(r); }

  // Arena stones create a readable circle without hard-closing the player in.
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2; const x=48+Math.cos(a)*13.8,z=-25+Math.sin(a)*13.8; const r=mesh(new THREE.DodecahedronGeometry(1.05+(i%3)*.12,0),mat('arenaRock',C.darkStone),x,.7,z); scene.add(r); addCircleCollider(x,z,.8,'arena');}

  // Decorative wind crystals.
  for(const [x,z] of [[24,10],[29,-4],[39,-10],[48,-31],[54,-21]]) addCrystal(x,z);

  // Low-cost grass instances.
  addGrassInstances();

  player=createHero();
  objectiveMarker=createObjectiveMarker();

  spawnEnemy('raider',-6,8); spawnEnemy('raider',3,7); spawnEnemy('raider',11,1); spawnEnemy('raider',20,-2);
  spawnEnemy('spitter',-14,1); spawnEnemy('spitter',25,-3); spawnEnemy('raider',7,-5);
}

function createNPC(x,z,coatColor,hatColor){
  const g=new THREE.Group(); g.position.set(x,0,z);
  g.add(mesh(new THREE.CylinderGeometry(.38,.5,1.15,6),new THREE.MeshStandardMaterial({color:coatColor,flatShading:true,roughness:.85}),0,.9,0));
  g.add(mesh(new THREE.IcosahedronGeometry(.31,1),mat('skin',0xc48c68),0,1.62,0));
  const hat=mesh(new THREE.ConeGeometry(.5,.55,6),new THREE.MeshStandardMaterial({color:hatColor,flatShading:true,roughness:.8}),0,1.98,0); g.add(hat);
  scene.add(g); return g;
}

function createChest(x,z,glowColor){
  const g=new THREE.Group(); g.position.set(x,0,z);
  const base=mesh(new THREE.BoxGeometry(1.15,.65,.85),mat('chest',0x704723),0,.36,0); g.add(base);
  const lid=mesh(new THREE.BoxGeometry(1.18,.35,.88),mat('chestLid',0x9a6a35),0,.8,-.05); g.add(lid);
  const lock=mesh(new THREE.BoxGeometry(.2,.3,.12),new THREE.MeshStandardMaterial({color:glowColor,emissive:glowColor,emissiveIntensity:1.8,flatShading:true}),0,.58,.48); g.add(lock);
  g.userData={opened:false,lid}; scene.add(g); addCircleCollider(x,z,.6,'chest'); return g;
}

function addCrystal(x,z){
  const g=new THREE.Group(); g.position.set(x,0,z);
  const m=mat('windCrystal',C.wind,{emissive:C.wind,emissiveIntensity:2.5,roughness:.24});
  const c=mesh(new THREE.OctahedronGeometry(.38,0),m,0,.78,0); c.scale.y=1.8; g.add(c);
  const base=mesh(new THREE.CylinderGeometry(.45,.62,.35,6),mat('darkStone',C.darkStone),0,.18,0); g.add(base); scene.add(g); addCircleCollider(x,z,.38,'crystal');
}

function addGrassInstances(){
  const count=180; const geo=new THREE.ConeGeometry(.11,.55,3); const material=mat('grassBlade',0x6ca268); const inst=new THREE.InstancedMesh(geo,material,count); inst.castShadow=false; inst.receiveShadow=false;
  const dummy=new THREE.Object3D(); let used=0; for(let i=0;i<count*3 && used<count;i++){const x=-34+Math.random()*92,z=-8+Math.random()*54; if(Math.abs(z-17)<4.2||Math.abs(x-7)<7||Math.hypot(x-21,z-4)<9||x>31&&z<-6) continue; dummy.position.set(x,.28,z); dummy.rotation.y=Math.random()*Math.PI*2; const s=.6+Math.random()*.9; dummy.scale.set(s,s,s); dummy.updateMatrix(); inst.setMatrixAt(used++,dummy.matrix);} inst.count=used; scene.add(inst);
}

function createObjectiveMarker(){
  const g=new THREE.Group();
  const ring=mesh(new THREE.TorusGeometry(.55,.08,6,18),mat('marker',C.wind,{emissive:C.wind,emissiveIntensity:2}),0,.12,0,false,false); ring.rotation.x=Math.PI/2; g.add(ring);
  const arrow=mesh(new THREE.ConeGeometry(.22,.55,5),mat('marker',C.wind,{emissive:C.wind,emissiveIntensity:2}),0,2.5,0,false,false); arrow.rotation.x=Math.PI; g.add(arrow);
  scene.add(g); return g;
}

function spawnEnemy(type,x,z){
  const def=BALANCE[type]; const g=new THREE.Group(); g.position.set(x,0,z);
  if(type==='raider'){
    const body=mesh(new THREE.IcosahedronGeometry(.62,1),mat('enemy',C.enemy),0,.72,0); body.scale.y=.85; g.add(body);
    g.add(mesh(new THREE.ConeGeometry(.28,.45,5),mat('enemy2',C.enemy2),-.25,1.15,.05));
    g.add(mesh(new THREE.ConeGeometry(.28,.45,5),mat('enemy2',C.enemy2),.25,1.15,.05));
  } else {
    const body=mesh(new THREE.DodecahedronGeometry(.55,0),mat('spitter',0x8f6f66),0,.7,0); g.add(body);
    for(let i=0;i<5;i++){const s=mesh(new THREE.ConeGeometry(.11,.45,4),mat('spike',0xd6ad72),0,1.0,0); s.rotation.z=(i/5)*Math.PI*2; s.position.x=Math.cos(i/5*Math.PI*2)*.35; s.position.z=Math.sin(i/5*Math.PI*2)*.35; g.add(s);}
  }
  scene.add(g); enemies.push({type,mesh:g,hp:def.hp,maxHp:def.hp,damage:def.damage,xp:def.xp,speed:def.speed,attackRange:def.attackRange,cooldown:Math.random()*.5,dead:false,hitFlash:0,home:new THREE.Vector3(x,0,z)}); return g;
}

function spawnBoss(){
  if(boss) return;
  const g=new THREE.Group(); g.position.set(48,0,-25);
  const rockMat=mat('boss',C.boss,{roughness:.72}); const glowMat=mat('bossGlow',C.bossGlow,{emissive:C.bossGlow,emissiveIntensity:2.3,roughness:.3});
  const core=mesh(new THREE.DodecahedronGeometry(1.25,0),rockMat,0,1.55,0); g.add(core);
  for(let i=0;i<4;i++){const limb=mesh(new THREE.DodecahedronGeometry(.72,0),rockMat,Math.cos(i*Math.PI/2)*1.15,1.25,Math.sin(i*Math.PI/2)*1.15); limb.scale.set(.85,1.2,.85); g.add(limb);}
  const eye=mesh(new THREE.OctahedronGeometry(.38,0),glowMat,0,1.72,.92); g.add(eye);
  const crown=mesh(new THREE.TorusGeometry(1.35,.12,5,10),glowMat,0,2.6,0); crown.rotation.x=Math.PI/2; g.add(crown);
  scene.add(g);
  boss={type:'boss',mesh:g,hp:BALANCE.boss.hp,maxHp:BALANCE.boss.hp,damage:BALANCE.boss.touchDamage,speed:BALANCE.boss.speed,attackRange:1.8,cooldown:1.2,dead:false,phase:0,gustTimer:2.5,chargeTimer:4.2,hitFlash:0};
  enemies.push(boss); ui.bossHud.classList.remove('hidden'); toast('STONE GALE AWAKENS',1800); cameraState.shake=.4;
}

function keeperAction(){
  if(state.quest===0){state.quest=state.sparks>=3?2:1;toast(state.sparks>=3?'Nilo: “You already found all three sparks. Feed them into the mill.”':'Nilo: “Three rotor sparks were stolen by ridge raiders.”',3000);updateObjective();}
  else if(state.quest===1) toast(`Nilo: “Bring ${Math.max(0,3-state.sparks)} more rotor spark${3-state.sparks===1?'':'s'}.”`,2100);
  else if(state.quest===2) toast('Nilo: “Feed the sparks into the mill console.”',2100);
  else toast('Nilo: “The old current is moving again.”',1800);
}

function millAction(){
  if(state.quest<1){toast('The mill console is dormant.',1500);return;}
  if(state.sparks<3){toast(`The rotor needs ${3-state.sparks} more spark${3-state.sparks===2?'s':''}.`,1800);return;}
  if(state.millOn){toast('The gale mill is already running.',1400);return;}
  state.millOn=true; state.quest=3; caveSeal.userData.collider.active=false;
  animateOut(caveSeal,1.1); toast('GALE MILL RESTORED · GROTTO SEAL OPENED',2600); updateObjective(); sfx('chime');
}

function coreAction(){
  if(!state.millOn){toast('A windless lock holds the reliquary.',1600);return;}
  if(state.coreClaimed){toast('The reliquary is empty.',1200);return;}
  openChest(coreChest); state.coreClaimed=true; state.swordTier=2; addXp(BALANCE.coreXp); state.quest=4; updateObjective(); updateHud();
  toast('WIND CORE ACQUIRED · HOLD BLADE, THEN RELEASE',3000); sfx('upgrade');
}

function armorAction(){
  if(armorChest.userData.opened){toast('The ridge cache is empty.',1200);return;}
  openChest(armorChest); state.armorTier=1; updateHud(); toast('RIDGE GUARD EQUIPPED · DAMAGE −16%',2300); sfx('upgrade');
}

function openChest(chest){chest.userData.opened=true; chest.userData.lid.rotation.x=-.85; chest.userData.lid.position.y=1.05;}

function updateObjective(){
  const text=[
    'Reach Gale Mill · speak to Keeper Nilo',
    `Recover rotor sparks from raiders · ${state.sparks}/3`,
    'Restart Gale Mill at the console',
    'Enter Zephyr Grotto · claim the Wind Core',
    'Hold BLADE / Space · shatter the rune wall',
    'Defeat the Stone Gale',
    'Wind restored'
  ][state.quest] || 'Explore the ridge';
  ui.objective.textContent=text;
}

function objectivePosition(){
  if(state.quest===0||state.quest===1) return state.quest===0?keeper.position:new THREE.Vector3(8,0,3);
  if(state.quest===2) return new THREE.Vector3(17.3,0,4.3);
  if(state.quest===3) return coreChest.position;
  if(state.quest===4) return runeWall.position;
  if(state.quest===5) return new THREE.Vector3(48,0,-25);
  return player.position;
}

function addXp(amount){
  const old=state.level; state.xp+=amount; state.level=levelFromXp(state.xp);
  if(state.level>old){const oldMax=state.maxHp; state.maxHp=maxHpFor(state.level); state.hp=Math.min(state.maxHp,state.hp+(state.maxHp-oldMax)+12); toast(`LEVEL ${state.level} · LIFE AND ATTACK UP`,2200); sfx('level');}
  updateHud();
}

function updateHud(){
  state.maxHp=maxHpFor(state.level); const next=state.level>=BALANCE.maxLevel?state.xp:BALANCE.xpThresholds[state.level]; const prev=BALANCE.xpThresholds[state.level-1]||0;
  ui.levelText.textContent=`LV ${state.level}`; ui.hpText.textContent=`${Math.ceil(state.hp)} / ${state.maxHp}`; ui.hpFill.style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;
  const xpPct=state.level>=BALANCE.maxLevel?100:Math.max(0,Math.min(100,(state.xp-prev)/(next-prev)*100)); ui.xpFill.style.width=`${xpPct}%`; ui.xpText.textContent=state.level>=BALANCE.maxLevel?`${state.xp} / MAX`:`${state.xp} / ${next}`;
  ui.gearText.textContent=`Windshard ${state.swordTier===2?'II':'I'} · ${state.armorTier?'Ridge Guard':'Traveler Wrap'}`;
  if(boss&&!boss.dead) ui.bossFill.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
}

let toastTimer=0;
function toast(text,duration=1800){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),duration);}

function animateOut(obj,duration){effects.push({type:'fadeScale',obj,t:0,duration,startY:obj.position.y});}

function attackPressed(){ if(gameOver||complete) return; state.attackHeld=true; state.attackHold=0; ui.attackBtn.classList.add('pressed'); }
function attackReleased(){
  if(!state.attackHeld||gameOver||complete)return; state.attackHeld=false; ui.attackBtn.classList.remove('pressed');
  if(state.attackCooldown>0)return;
  if(state.swordTier>=2&&state.attackHold>=BALANCE.player.chargeSeconds) chargedAttack(); else meleeAttack(); state.attackHold=0;
}

function meleeAttack(){
  state.attackCooldown=BALANCE.player.meleeCooldown; player.userData.attackAnim=.24; sfx('slash');
  const facing=player.userData.facing; const dmg=attackFor(state.level,state.swordTier);
  for(const e of enemies){if(e.dead)continue; const dx=e.mesh.position.x-player.position.x,dz=e.mesh.position.z-player.position.z; const dist=Math.hypot(dx,dz); if(dist>BALANCE.player.meleeRange)continue; const dot=(dx*facing.x+dz*facing.z)/(dist||1); if(dot>.05) damageEnemy(e,e===boss?Math.max(1,Math.round(dmg*.55)):dmg);}
}

function chargedAttack(){
  state.attackCooldown=.52; player.userData.attackAnim=.32; const f=player.userData.facing.clone();
  const orb=mesh(new THREE.IcosahedronGeometry(.34,1),mat('wind',0x9affdd,{emissive:C.wind,emissiveIntensity:2.4}),player.position.x+f.x*1.1,1.0,player.position.z+f.z*1.1,false,false); scene.add(orb);
  projectiles.push({owner:'player',mesh:orb,vel:f.multiplyScalar(12.8),life:1.25,damage:Math.round(attackFor(state.level,state.swordTier)*BALANCE.player.chargedMultiplier),radius:.75});
  sfx('charge'); cameraState.shake=.08;
}

function damageEnemy(e,amount){
  if(e.dead)return; e.hp-=amount; e.hitFlash=.12; popEffect(e.mesh.position,C.wind); sfx('hit'); if(e===boss) cameraState.shake=.09;
  if(e.hp<=0) killEnemy(e); updateHud();
}

function killEnemy(e){
  e.dead=true; e.mesh.visible=false; state.kills++; if(e===boss){state.bossDefeated=true;state.quest=6;addXp(BALANCE.boss.xp);ui.bossHud.classList.add('hidden');completeRun();return;}
  addXp(e.xp); if(e.type==='raider'&&state.sparks<3){state.sparks++; popPickup(e.mesh.position); toast(state.quest===0?`STRANGE ROTOR SPARK ${state.sparks}/3`:`ROTOR SPARK ${state.sparks}/3`,1200); if(state.quest===1&&state.sparks>=3){state.quest=2;toast('ROTOR SET COMPLETE · RETURN TO THE MILL',2300);} updateObjective();}
}

function popEffect(pos,color){
  const g=new THREE.Group();g.position.copy(pos);g.position.y=1.0; for(let i=0;i<5;i++){const p=mesh(new THREE.TetrahedronGeometry(.11,0),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}),0,0,0,false,false); p.userData.v=new THREE.Vector3((Math.random()-.5)*4,2+Math.random()*2,(Math.random()-.5)*4);g.add(p);} scene.add(g);effects.push({type:'burst',obj:g,t:0,duration:.45});
}
function popPickup(pos){const orb=mesh(new THREE.OctahedronGeometry(.27,0),mat('wind',C.wind,{emissive:C.wind,emissiveIntensity:2.6}),pos.x,1,pos.z,false,false);scene.add(orb);effects.push({type:'pickup',obj:orb,t:0,duration:.9});sfx('pickup');}

function updatePlayer(dt){
  state.attackCooldown=Math.max(0,state.attackCooldown-dt); state.dashCooldown=Math.max(0,state.dashCooldown-dt); state.invuln=Math.max(0,state.invuln-dt); if(state.attackHeld) state.attackHold+=dt;
  let x=input.stickX,z=input.stickZ;
  if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))x-=1; if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))x+=1; if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))z-=1; if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))z+=1;
  const len=Math.hypot(x,z); if(len>1){x/=len;z/=len;}
  if(Math.hypot(x,z)>.08){player.userData.facing.set(x,0,z).normalize(); player.rotation.y=Math.atan2(x,z); player.userData.walk+=dt*10;}
  if(input.dash&&state.dashCooldown<=0&&state.dashTimer<=0){state.dashTimer=BALANCE.player.dashDuration;state.dashCooldown=BALANCE.player.dashCooldown;state.invuln=Math.max(state.invuln,.27);sfx('dash');input.dash=false;}
  let speed=BALANCE.player.speed; if(state.dashTimer>0){state.dashTimer-=dt;speed=BALANCE.player.dashSpeed;x=player.userData.facing.x;z=player.userData.facing.z;}
  const slow=state.attackHeld?.78:1; moveEntity(player,x*speed*slow*dt,z*speed*slow*dt,.48);
  player.position.y=Math.abs(Math.sin(player.userData.walk))*0.04;
  if(state.attackHeld&&state.swordTier>=2){const p=Math.min(1,state.attackHold/BALANCE.player.chargeSeconds);player.userData.blade.scale.setScalar(1+p*.25);player.userData.blade.material.emissiveIntensity=2.4+p*3.2;} else {player.userData.blade.scale.setScalar(1);player.userData.blade.material.emissiveIntensity=2.4;}
  if(player.userData.attackAnim>0){player.userData.attackAnim-=dt; const t=1-player.userData.attackAnim/.32; player.userData.swordPivot.rotation.z=-.4+Math.sin(t*Math.PI)*1.8;} else player.userData.swordPivot.rotation.z=-.42;
  if(input.interact){doInteract();input.interact=false;}
}

function moveEntity(obj,dx,dz,radius){
  const tryX=obj.position.x+dx; if(!collides(tryX,obj.position.z,radius)) obj.position.x=tryX;
  const tryZ=obj.position.z+dz; if(!collides(obj.position.x,tryZ,radius)) obj.position.z=tryZ;
  obj.position.x=Math.max(-38,Math.min(62,obj.position.x)); obj.position.z=Math.max(-39,Math.min(49,obj.position.z));
}

function collides(x,z,r){
  for(const c of colliders){if(!c.active)continue; if(c.type==='circle'){if(Math.hypot(x-c.x,z-c.z)<r+c.r)return true;} else {const nx=Math.max(c.x-c.w/2,Math.min(x,c.x+c.w/2));const nz=Math.max(c.z-c.d/2,Math.min(z,c.z+c.d/2));if((x-nx)**2+(z-nz)**2<r*r)return true;}}
  return false;
}

function updateEnemies(dt){
  for(const e of enemies){if(e.dead)continue; e.cooldown=Math.max(0,e.cooldown-dt);e.hitFlash=Math.max(0,e.hitFlash-dt); const dx=player.position.x-e.mesh.position.x,dz=player.position.z-e.mesh.position.z;const dist=Math.hypot(dx,dz);
    if(e===boss){updateBoss(e,dt,dx,dz,dist);continue;}
    if(dist<9.5&&dist>e.attackRange*.92){const nx=dx/(dist||1),nz=dz/(dist||1);moveEntity(e.mesh,nx*e.speed*dt,nz*e.speed*dt,.48);e.mesh.rotation.y=Math.atan2(nx,nz);}
    if(e.type==='raider'&&dist<e.attackRange&&e.cooldown<=0){e.cooldown=BALANCE.raider.cooldown;hurtPlayer(e.damage,e.mesh.position);}
    if(e.type==='spitter'&&dist<e.attackRange&&dist>2&&e.cooldown<=0){e.cooldown=BALANCE.spitter.cooldown; enemyShot(e,dx,dz,dist);}
    e.mesh.position.y=Math.sin(performance.now()*.004+e.home.x)*.06;
  }
  if(state.quest>=5&&!boss&&player.position.x>43&&player.position.z<-18)spawnBoss();
}

function updateBoss(e,dt,dx,dz,dist){
  e.gustTimer-=dt;e.chargeTimer-=dt; const hpRatio=e.hp/e.maxHp; e.phase=hpRatio<.5?1:0;
  if(dist>2.3){const nx=dx/(dist||1),nz=dz/(dist||1);moveEntity(e.mesh,nx*e.speed*(e.phase?1.15:1)*dt,nz*e.speed*(e.phase?1.15:1)*dt,1.05);e.mesh.rotation.y=Math.atan2(nx,nz);} else if(e.cooldown<=0){e.cooldown=e.phase?.86:1.15;hurtPlayer(BALANCE.boss.touchDamage,e.mesh.position);cameraState.shake=.18;}
  if(e.gustTimer<=0){e.gustTimer=e.phase?1.55:2.15;bossGust(e);}
  if(e.chargeTimer<=0){e.chargeTimer=e.phase?3.0:4.3; const dir=new THREE.Vector3(dx,0,dz).normalize(); for(let i=0;i<3;i++){setTimeout(()=>{if(!e.dead){moveEntity(e.mesh,dir.x*2.4,dir.z*2.4,1.05);cameraState.shake=.08;}},i*120);}}
  e.mesh.rotation.y+=dt*.35;
}

function enemyShot(e,dx,dz,dist){
  const dir=new THREE.Vector3(dx/(dist||1),0,dz/(dist||1)); const orb=mesh(new THREE.IcosahedronGeometry(.22,0),mat('enemyShot',0xffb579,{emissive:0xff7f50,emissiveIntensity:2}),e.mesh.position.x,.9,e.mesh.position.z,false,false);scene.add(orb);projectiles.push({owner:'enemy',mesh:orb,vel:dir.multiplyScalar(6.4),life:2.0,damage:e.damage,radius:.42});sfx('spit');
}

function bossGust(e){
  const count=e.phase?10:8;for(let i=0;i<count;i++){const a=i/count*Math.PI*2+(e.phase?.23:0);const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));const orb=mesh(new THREE.OctahedronGeometry(.26,0),mat('bossGlow',C.bossGlow,{emissive:C.bossGlow,emissiveIntensity:2.3}),e.mesh.position.x,1.1,e.mesh.position.z,false,false);scene.add(orb);projectiles.push({owner:'enemy',mesh:orb,vel:dir.multiplyScalar(e.phase?7.4:6.2),life:2.2,damage:BALANCE.boss.gustDamage,radius:.42});}sfx('gust');
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.x+=dt*5;p.mesh.rotation.y+=dt*7;
    let remove=p.life<=0;
    if(p.owner==='player'&&!remove&&runeWall&&state.quest===4&&runeWall.userData.collider.active&&Math.abs(p.mesh.position.x-runeWall.position.x)<4.2&&Math.abs(p.mesh.position.z-runeWall.position.z)<1.35){breakRuneWall();remove=true;}
    if(!remove&&collides(p.mesh.position.x,p.mesh.position.z,p.radius*.6)) remove=true;
    if(p.owner==='player'){
      if(!remove){for(const e of enemies){if(e.dead)continue;if(Math.hypot(p.mesh.position.x-e.mesh.position.x,p.mesh.position.z-e.mesh.position.z)<p.radius+(e===boss?1.2:.6)){damageEnemy(e,p.damage);remove=true;break;}}}
    } else if(!remove&&Math.hypot(p.mesh.position.x-player.position.x,p.mesh.position.z-player.position.z)<p.radius+.48){hurtPlayer(p.damage,p.mesh.position);remove=true;}
    if(remove){scene.remove(p.mesh);projectiles.splice(i,1);}
  }
}

function breakRuneWall(){
  if(state.runeBroken)return;state.runeBroken=true;state.quest=5;runeWall.userData.collider.active=false;animateOut(runeWall,.8);for(const r of runeWall.userData.runes||[])animateOut(r,.6);toast('RUNE WALL SHATTERED · SOMETHING STIRS AHEAD',2500);cameraState.shake=.28;sfx('break');updateObjective();
}

function hurtPlayer(raw,source){
  if(state.invuln>0||gameOver||complete)return; const dmg=damageAfterArmor(raw,state.armorTier);state.hp-=dmg;state.invuln=BALANCE.player.invulnAfterHit;cameraState.shake=.22;popEffect(player.position,0xff785f);sfx('hurt');updateHud(); if(state.hp<=0)die();
}

function doInteract(){
  let best=null,bestD=Infinity;for(const it of interactables){const d=Math.hypot(player.position.x-it.position.x,player.position.z-it.position.z);if(d<it.radius&&d<bestD){best=it;bestD=d;}}if(best)best.action();
}

function updatePrompt(){
  if(!started||gameOver||complete){ui.prompt.classList.remove('show');return;}
  let best=null,bestD=Infinity;for(const it of interactables){const d=Math.hypot(player.position.x-it.position.x,player.position.z-it.position.z);if(d<it.radius&&d<bestD){best=it;bestD=d;}}
  if(best){ui.prompt.textContent=`${coarse?'ACT':'E'} · ${best.prompt}`;ui.prompt.classList.add('show');}else ui.prompt.classList.remove('show');
}

function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.t+=dt;const p=Math.min(1,e.t/e.duration);
    if(e.type==='fadeScale'){e.obj.scale.setScalar(1-p);e.obj.position.y=e.startY-p*1.3;}
    else if(e.type==='burst'){for(const c of e.obj.children){c.position.addScaledVector(c.userData.v,dt);c.userData.v.y-=dt*6;c.material.opacity=1-p;}}
    else if(e.type==='pickup'){e.obj.position.y=1+p*2.5;e.obj.rotation.y+=dt*8;e.obj.scale.setScalar(1-p*.4);}
    if(p>=1){scene.remove(e.obj);effects.splice(i,1);}
  }
}

function updateWorld(dt){
  if(windmillBlades)windmillBlades.rotation.z+=dt*(state.millOn?2.25:.08);
  if(objectiveMarker){const target=objectivePosition();objectiveMarker.position.set(target.x,.05,target.z);objectiveMarker.children[1].position.y=2.5+Math.sin(performance.now()*.005)*.22;objectiveMarker.rotation.y+=dt*.8;objectiveMarker.visible=state.quest<6;}
}

function updateCamera(dt){
  cameraState.zoom+=(cameraState.targetZoom-cameraState.zoom)*(1-Math.pow(.001,dt));cameraState.targetZoom=Math.max(.68,Math.min(1.55,cameraState.targetZoom));
  const aspect=innerWidth/innerHeight;const mobileBias=aspect<.8?1.18:1;const offY=15.5*cameraState.zoom*mobileBias,offZ=13*cameraState.zoom*mobileBias;
  const desired=new THREE.Vector3(player.position.x,offY,player.position.z+offZ);const k=1-Math.pow(.00008,dt);camera.position.lerp(desired,k);
  if(cameraState.shake>0){cameraState.shake=Math.max(0,cameraState.shake-dt*1.8);camera.position.x+=(Math.random()-.5)*cameraState.shake;camera.position.z+=(Math.random()-.5)*cameraState.shake;}
  camera.lookAt(player.position.x,0,player.position.z-2.0);
}

let audioCtx=null;
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
function sfx(kind){if(!audioCtx||audioCtx.state!=='running')return;const t=audioCtx.currentTime;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);let f=220,d=.09,type='triangle';
  if(kind==='slash'){f=360;d=.06;type='sawtooth';}if(kind==='hit'){f=120;d=.05;type='square';}if(kind==='charge'){f=680;d=.16;type='triangle';}if(kind==='hurt'){f=90;d=.16;type='sawtooth';}if(kind==='pickup'){f=720;d=.09;}if(kind==='upgrade'||kind==='level'){f=520;d=.28;}if(kind==='break'){f=70;d=.24;type='square';}if(kind==='gust'){f=180;d=.12;}if(kind==='spit'){f=250;d=.06;}if(kind==='dash'){f=440;d=.045;}if(kind==='chime'){f=600;d=.34;}
  o.type=type;o.frequency.setValueAtTime(f,t);if(kind==='upgrade'||kind==='level'||kind==='chime')o.frequency.exponentialRampToValueAtTime(f*1.8,t+d);else o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.65),t+d);g.gain.setValueAtTime(.055,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.start(t);o.stop(t+d+.01);
}

function completeRun(){complete=true;const secs=Math.max(1,Math.round((performance.now()-runStartedAt)/1000));const min=Math.floor(secs/60),s=String(secs%60).padStart(2,'0');ui.endSummary.textContent=`Clear time ${min}:${s} · Level ${state.level} · ${state.kills} foes · Windshard II${state.armorTier?' · Ridge Guard':''}.`;setTimeout(()=>ui.end.classList.remove('hidden'),800);}
function die(){gameOver=true;setTimeout(()=>ui.death.classList.remove('hidden'),500);}

function bindInput(){
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();input.keys.add(e.code);if(e.code==='Space'&&!state.attackHeld)attackPressed();if((e.code==='ShiftLeft'||e.code==='ShiftRight'))input.dash=true;if(e.code==='KeyE')input.interact=true;});
  addEventListener('keyup',e=>{input.keys.delete(e.code);if(e.code==='Space')attackReleased();if(e.code==='ShiftLeft'||e.code==='ShiftRight')input.dash=false;});
  addEventListener('wheel',e=>{cameraState.targetZoom+=Math.sign(e.deltaY)*.08;cameraState.targetZoom=Math.max(.68,Math.min(1.55,cameraState.targetZoom));},{passive:true});
  addEventListener('blur',()=>{input.keys.clear();input.stickX=input.stickZ=0;if(state.attackHeld)attackReleased();});

  let stickPointer=null;
  const updateStick=(e)=>{const r=ui.stickZone.getBoundingClientRect();const cx=r.left+r.width*.44,cy=r.top+r.height*.57;let dx=e.clientX-cx,dy=e.clientY-cy;const max=44,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max;}input.stickX=dx/max;input.stickZ=dy/max;ui.stickKnob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;};
  ui.stickZone.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;ui.stickZone.setPointerCapture(e.pointerId);updateStick(e);});
  ui.stickZone.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e);});
  const endStick=e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;input.stickX=input.stickZ=0;ui.stickKnob.style.transform='translate(-50%,-50%)';};ui.stickZone.addEventListener('pointerup',endStick);ui.stickZone.addEventListener('pointercancel',endStick);

  ui.attackBtn.addEventListener('pointerdown',e=>{e.preventDefault();ui.attackBtn.setPointerCapture(e.pointerId);attackPressed();});
  ui.attackBtn.addEventListener('pointerup',e=>{e.preventDefault();attackReleased();});ui.attackBtn.addEventListener('pointercancel',attackReleased);
  ui.dashBtn.addEventListener('pointerdown',e=>{e.preventDefault();input.dash=true;ui.dashBtn.classList.add('pressed');});ui.dashBtn.addEventListener('pointerup',()=>{input.dash=false;ui.dashBtn.classList.remove('pressed');});ui.dashBtn.addEventListener('pointercancel',()=>{input.dash=false;ui.dashBtn.classList.remove('pressed');});
  ui.interactBtn.addEventListener('pointerdown',e=>{e.preventDefault();input.interact=true;ui.interactBtn.classList.add('pressed');});ui.interactBtn.addEventListener('pointerup',()=>ui.interactBtn.classList.remove('pressed'));

  // Two-finger pinch zoom can run at the same time as other touch controls.
  let lastPinch=0;
  addEventListener('pointerdown',e=>{if(e.pointerType==='touch')pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY,target:e.target});},{capture:true});
  addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!pointerState.has(e.pointerId))return;const p=pointerState.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;if(pointerState.size>=2){const pts=[...pointerState.values()].slice(0,2);if(pts.some(p=>p.target.closest?.('.action')))return;const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(lastPinch){cameraState.targetZoom-= (d-lastPinch)*.0035;cameraState.targetZoom=Math.max(.68,Math.min(1.55,cameraState.targetZoom));}lastPinch=d;}},{capture:true});
  const clearPointer=e=>{if(e.pointerType==='touch'){pointerState.delete(e.pointerId);if(pointerState.size<2)lastPinch=0;}};addEventListener('pointerup',clearPointer,{capture:true});addEventListener('pointercancel',clearPointer,{capture:true});
}

function onResize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}

let lastTime=0,acc=0,qualityTimer=0,frameAccum=0,frameCount=0;
function frame(now){
  const realDt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;
  if(started&&!gameOver&&!complete){acc+=realDt;const step=1/60;let loops=0;while(acc>=step&&loops<4){updatePlayer(step);updateEnemies(step);updateProjectiles(step);updateEffects(step);updateWorld(step);acc-=step;loops++;}updatePrompt();}
  if(player)updateCamera(realDt);
  renderFrame();
  frameAccum+=realDt;frameCount++;qualityTimer+=realDt;if(qualityTimer>2.0){const avg=frameAccum/frameCount;adaptResolution(avg);qualityTimer=frameAccum=frameCount=0;}
}

let pixelRatio=1;
function adaptResolution(avg){
  const cap=coarse?Math.min(devicePixelRatio,1.45):Math.min(devicePixelRatio,1.8);if(pixelRatio===1)pixelRatio=cap;
  let next=pixelRatio;if(avg>.020)next=Math.max(.78,pixelRatio-.12);else if(avg<.015)next=Math.min(cap,pixelRatio+.08);if(Math.abs(next-pixelRatio)>.04){pixelRatio=next;renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight,false);}
}

async function setupPost(){
  if(rendererKind!=='WebGPU')return;
  try{const TSL=await import('three/tsl');const {bloom}=await import('three/addons/tsl/display/BloomNode.js');const pass=TSL.pass(scene,camera);const color=pass.getTextureNode('output');const glow=bloom(color,.22,.18,1.15);if(glow.setResolutionScale)glow.setResolutionScale(coarse?.42:.55);pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=color.add(glow);}catch(err){console.warn('WebGPU post pipeline unavailable, using direct render.',err);pipeline=null;}
}

function configureRenderer(){
  renderer.setPixelRatio(coarse?Math.min(devicePixelRatio,1.35):Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight,false);
  if('toneMapping' in renderer&&THREE.AgXToneMapping!==undefined)renderer.toneMapping=THREE.AgXToneMapping;if('toneMappingExposure' in renderer)renderer.toneMappingExposure=1.08;
  if('outputColorSpace' in renderer&&THREE.SRGBColorSpace)renderer.outputColorSpace=THREE.SRGBColorSpace;
  if(renderer.shadowMap){renderer.shadowMap.enabled=true;if(THREE.PCFShadowMap!==undefined)renderer.shadowMap.type=THREE.PCFShadowMap;}
  ui.rendererBadge.textContent=`${rendererKind.toUpperCase()} · DYNAMIC RES`;
}

function resetState(){
  Object.assign(state,{quest:0,sparks:0,xp:0,level:1,swordTier:1,armorTier:0,maxHp:maxHpFor(1),hp:maxHpFor(1),attackHeld:false,attackHold:0,attackCooldown:0,dashCooldown:0,dashTimer:0,invuln:0,kills:0,coreClaimed:false,millOn:false,runeBroken:false,bossDefeated:false});
}

function hardRestart(){location.reload();}

async function boot(){
  try{
    ui.loadingText.textContent='Selecting WebGPU / WebGL renderer…';await initRenderer();
    ui.loadingText.textContent='Building Aetherfall Ridge…';configureRenderer();createWorld();await setupPost();bindInput();onResize();addEventListener('resize',onResize);
    clock=new THREE.Clock();updateObjective();updateHud();
    renderer.setAnimationLoop(frame);
    setTimeout(()=>ui.loading.classList.add('hidden'),220);
  }catch(err){console.error(err);ui.loadingText.textContent='Renderer setup failed. Open the console for details.';ui.loading.querySelector('.loader')?.remove();}
}

ui.startBtn.addEventListener('click',()=>{ensureAudio();started=true;runStartedAt=performance.now();ui.start.classList.add('hidden');ui.hud.classList.remove('hidden');if(coarse)ui.mobile.classList.remove('hidden');toast('FOLLOW THE WIND MARKER TO GALE MILL',2200);});
ui.restartBtn.addEventListener('click',hardRestart);ui.retryBtn.addEventListener('click',hardRestart);

// Test/debug surface. It is intentionally small and does not change normal play.
window.__AETHERFALL__={getState:()=>({...state,rendererKind}),teleport:(x,z)=>player?.position.set(x,0,z),damageBoss:(n=50)=>boss&&damageEnemy(boss,n)};

boot();
