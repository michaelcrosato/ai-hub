import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { WebGL1Fallback } from './webgl1Fallback.js';
import { BALANCE, PLATFORMS, ANCHORS, ENEMY_SPECS, PICKUP_SPECS, CHECKPOINT_X, SPIRE } from './data.js';

const shell = document.querySelector('#game-shell');
const ui = {
  health: document.querySelector('#health'), xpFill: document.querySelector('#xp-fill'), xpLabel: document.querySelector('#xp-label'),
  rank: document.querySelector('#rank'), gear: document.querySelector('#gear'), objective: document.querySelector('#objective'),
  backend: document.querySelector('#backend'), tutorial: document.querySelector('#tutorial'), tutorialText: document.querySelector('#tutorial-text'),
  toast: document.querySelector('#toast'), checkpoint: document.querySelector('#checkpoint'), damageFlash: document.querySelector('#damage-flash'), start: document.querySelector('#start-card'),
  complete: document.querySelector('#complete-card'), stats: document.querySelector('#stats'), startBtn: document.querySelector('#start-btn'),
  restartBtn: document.querySelector('#restart-btn'), stickBase: document.querySelector('#stick-base'), stick: document.querySelector('#stick'),
  grappleBtn: document.querySelector('#grapple-btn'), fireBtn: document.querySelector('#fire-btn'), actBtn: document.querySelector('#act-btn')
};

const isCoarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const tempV = new THREE.Vector3();
const tempV2 = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const platforms = PLATFORMS.map(p => ({ ...p }));
const anchors = ANCHORS.map((a, i) => ({ ...a, id: i, mesh: null, active: false }));
const enemies = ENEMY_SPECS.map((e, i) => ({
  ...e, id: i, startX: e.x, dir: i % 2 ? -1 : 1, hp: e.kind === 'turret' ? 3 : 2,
  maxHp: e.kind === 'turret' ? 3 : 2, dead: false, fireTimer: 0.4 + (i % 3) * 0.4, mesh: null
}));
const pickups = PICKUP_SPECS.map(p => ({ ...p, taken: false, mesh: null }));
const bullets = [];

const player = {
  x: 3.5, y: 0, vx: 0, vy: 0, facing: 1, grounded: true,
  hp: BALANCE.playerMaxHp, maxHp: BALANCE.playerMaxHp, xp: 0, rank: 1,
  invuln: 0, fireTimer: 0, grapple: null, grappleRange: BALANCE.grappleBaseRange,
  reelSpeed: BALANCE.reelSpeed, fireCooldown: BALANCE.fireCooldown,
  gear: new Set(), mesh: null, respawnX: 3.5, respawnY: 0, deaths: 0
};

const game = {
  started: false, complete: false, startTime: 0, kills: 0, shots: 0, hits: 0,
  checkpoint: false, interact: 0, everGrappled: false, tutorialPhase: 0, lastTime: performance.now(),
  cameraX: 7, cameraY: 4.8, zoom: isCoarse ? 14.3 : 13.4, shake: 0, renderScale: isCoarse ? 1.45 : 1.8,
  fpsAccum: 0, fpsFrames: 0, perfChecked: false
};

const input = { left: false, right: false, up: false, down: false, fire: false, act: false, stickX: 0, stickY: 0 };
let renderer = null, pipeline = null, fallback = null, scene = null, camera = null, ropeMesh = null, spireBeacon = null, consoleLight = null;
let worldGroup = null;
let activeToastTimer = 0, checkpointTimer = 0;
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume?.();
}
function tone(freq, duration=.08, type='square', volume=.035, endFreq=null, delay=0) {
  if (!audioCtx) return;
  const t=audioCtx.currentTime+delay, osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);
  gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
  osc.connect(gain).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.02);
}
function sfx(name) {
  if(name==='grapple'){tone(180,.09,'square',.045,420);tone(620,.05,'triangle',.025,360,.07);navigator.vibrate?.(18);}
  else if(name==='fire'){tone(520,.055,'square',.025,170);}
  else if(name==='hit'){tone(120,.09,'sawtooth',.035,65);navigator.vibrate?.([22,18,28]);}
  else if(name==='kill'){tone(180,.08,'square',.03,260);tone(330,.1,'triangle',.025,520,.07);}
  else if(name==='gear'){tone(330,.09,'triangle',.035,470);tone(660,.15,'triangle',.035,880,.08);navigator.vibrate?.(22);}
  else if(name==='checkpoint'){tone(300,.12,'triangle',.035,450);tone(600,.16,'triangle',.04,840,.12);}
  else if(name==='complete'){tone(240,.15,'triangle',.04,360);tone(480,.18,'triangle',.04,720,.14);tone(960,.25,'sine',.04,760,.30);navigator.vibrate?.([30,40,60]);}
}

function hasWebGL2() {
  const c = document.createElement('canvas');
  return !!c.getContext('webgl2');
}

async function initRenderer() {
  if (!hasWebGL2()) {
    fallback = new WebGL1Fallback(shell);
    ui.backend.textContent = 'GPU: WEBGL1 COMPAT';
    return;
  }
  const createModernRenderer = async (forceWebGL = false) => {
    const r = new THREE.WebGPURenderer({ antialias: true, alpha: false, samples: 4, forceWebGL });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, game.renderScale));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    shell.appendChild(r.domElement);
    try { await r.init(); return r; }
    catch (err) { r.domElement.remove(); try { r.dispose?.(); } catch {} throw err; }
  };
  try {
    renderer = await createModernRenderer(false);
  } catch (webgpuErr) {
    console.warn('WebGPU initialization failed; retrying with WebGL2.', webgpuErr);
    try {
      renderer = await createModernRenderer(true);
    } catch (webgl2Err) {
      console.warn('WebGL2 initialization failed; using WebGL1 compatibility renderer.', webgl2Err);
      fallback = new WebGL1Fallback(shell);
      ui.backend.textContent = 'GPU: WEBGL1 COMPAT';
      return;
    }
  }
  const backendName = renderer.backend?.constructor?.name || 'GPU';
  ui.backend.textContent = `GPU: ${backendName.replace('Backend', '').toUpperCase()}`;
  buildScene();
  try {
    pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomPass = bloom(sceneColor);
    bloomPass.strength.value = isCoarse ? 0.22 : 0.3;
    bloomPass.radius.value = 0.18;
    bloomPass.threshold.value = 0.78;
    pipeline.outputNode = sceneColor.add(bloomPass);
    game.bloomPass = bloomPass;
  } catch (err) {
    console.warn('Post pipeline unavailable, using direct render.', err);
    pipeline = null;
  }
}

function material(color, roughness = 0.82, metalness = 0.06, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, emissive, emissiveIntensity });
}
function basic(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }); }
function addMesh(geo, mat, x=0, y=0, z=0, parent=worldGroup) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(w,h,d,mat,x,y,z=0,parent=worldGroup) { return addMesh(new THREE.BoxGeometry(w,h,d), mat, x,y,z,parent); }
function cyl(rTop,rBot,h,segments,mat,x,y,z=0,parent=worldGroup) { return addMesh(new THREE.CylinderGeometry(rTop,rBot,h,segments),mat,x,y,z,parent); }

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x132b20);
  scene.fog = new THREE.FogExp2(0x183326, 0.022);
  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(game.cameraX, game.cameraY, game.zoom);
  camera.lookAt(game.cameraX + 1.5, game.cameraY - 0.8, 0);
  worldGroup = new THREE.Group(); scene.add(worldGroup);

  const hemi = new THREE.HemisphereLight(0xb8e3c0, 0x182219, 1.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1c7, 3.2); sun.position.set(-16, 28, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
  sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0007; scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7fc8a7, 0.8); fill.position.set(18,8,-12); scene.add(fill);

  buildEnvironment();
  buildPlayer();
  for (const e of enemies) buildEnemy(e);
  for (const p of pickups) buildPickup(p);
  buildSpire();

  ropeMesh = addMesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), basic(0x78f4d1), 0,0,0, scene);
  ropeMesh.visible = false; ropeMesh.castShadow = false;
}

function buildEnvironment() {
  const earth = material(0x43533d, 0.95, 0.0);
  const earthTop = material(0x5e7448, 0.94, 0.0);
  const metal = material(0x56625b, 0.55, 0.5);
  const hazard = material(0xc6802f, 0.7, 0.15);
  for (const p of platforms) {
    const mat = p.kind === 'metal' ? metal : earth;
    const m = box(p.w,p.h,3.4,mat,p.x,p.y,0);
    if (p.kind === 'earth') box(p.w,0.18,3.46,earthTop,p.x,p.y+p.h/2+0.09,0);
    if (p.kind === 'metal' && p.y > 2) {
      addRail(p.x - p.w/2 + 0.25, p.x + p.w/2 - 0.25, p.y+p.h/2, -1.25);
    }
  }
  // Stairs get bright tread lips for navigation.
  for (const x of [36.0,37.2,38.4,93.6,94.7,95.8]) box(0.95,0.12,3.52,hazard,x,platforms.find(p=>Math.abs(p.x-x)<.01).y + platforms.find(p=>Math.abs(p.x-x)<.01).h/2 + .06,0);

  // Anchor rings and mounting brackets.
  const ringMat = material(0xe7c85b,0.45,0.5,0xb88918,0.8);
  for (const a of anchors) {
    const group = new THREE.Group(); group.position.set(a.x,a.y,0); worldGroup.add(group);
    const ring = addMesh(new THREE.TorusGeometry(0.33,0.105,6,10),ringMat.clone(),0,0,0,group); ring.rotation.x = Math.PI/2;
    const bracket = box(.22,.65,.3,metal,0,.45,0,group); bracket.rotation.z = (a.id%2 ? .25 : -.25);
    a.mesh = group;
  }

  // Layered canopy and jungle props.
  const trunkMat = material(0x574631,1,0); const leafA = material(0x1f5a38,1,0); const leafB = material(0x2b7443,1,0);
  for (let i=0;i<30;i++) {
    const x = -5 + i*4.1 + ((i*17)%7)*0.13;
    const z = -7 - (i%3)*2.2;
    const h = 3.8 + (i%5)*0.45;
    cyl(.16,.24,h,6,trunkMat,x,h/2-0.3,z);
    addMesh(new THREE.ConeGeometry(1.6+(i%3)*.2,3.2,6),i%2?leafA:leafB,x,h+0.8,z);
  }
  const rockMat = material(0x39483e,0.98,0);
  for (let i=0;i<24;i++) {
    const x = 2 + ((i*13)%103); const z = -3.4 + (i%2)*6.8;
    const r = .35 + (i%4)*.16; const rock = addMesh(new THREE.IcosahedronGeometry(r,0),rockMat,x,r*.55,z); rock.scale.y=.65;
  }

  // Bunker block, high route supports, signs and railings.
  const concrete = material(0x62675d,.92,.05); const dark = material(0x1b2420,.8,.2);
  box(9.6,3.55,4.8,concrete,46,1.78,0.6); box(4.4,1.7,4.95,dark,48.2,.85,0.58);
  addSign('AUX BUNKER',43.2,2.35,2.66,0xffd858);
  addSign('RELAY 7',99.1,5.85,2.0,0xffd858);
  for (const x of [41,45,49,53,69,73,77]) cyl(.13,.13,5.6,6,metal,x,2.8,0);
  // A few unmistakable rails at dangerous edges.
  addRail(39.2,42.0,4.05,1.45); addRail(50.0,55.4,6.25,1.4); addRail(68.0,76.0,5.25,1.4); addRail(98.0,100.0,4.3,1.4);
}

function addRail(x1,x2,y,z) {
  const railMat = material(0x7a8179,.5,.6);
  const len = Math.max(.1,x2-x1); const cx=(x1+x2)/2;
  box(len,.09,.09,railMat,cx,y+1.05,z);
  for (let x=x1;x<=x2+.01;x+=1.7) box(.08,1.15,.08,railMat,x,y+.55,z);
}

function addSign(text,x,y,z,color) {
  const c=document.createElement('canvas'); c.width=512; c.height=128; const ctx=c.getContext('2d');
  ctx.fillStyle='#101812'; ctx.fillRect(0,0,c.width,c.height); ctx.strokeStyle='#78887c'; ctx.lineWidth=10; ctx.strokeRect(6,6,c.width-12,c.height-12);
  ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`; ctx.font='bold 58px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,256,66);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const m=addMesh(new THREE.PlaneGeometry(3.6,.9),new THREE.MeshBasicMaterial({map:tex}),x,y,z); m.castShadow=false;
}

function buildPlayer() {
  const g = new THREE.Group(); worldGroup.add(g); player.mesh = g;
  const uniform = material(0x2e8356,.72,.12); const armor=material(0x193a30,.55,.38); const skin=material(0xc5a27b,.9,0); const gun=material(0x303936,.42,.65);
  box(.72,.72,.52,uniform,0,.7,0,g); box(.82,.34,.58,armor,0,1.02,0,g);
  box(.48,.38,.48,skin,0,1.36,0,g); box(.55,.16,.53,armor,0,1.58,0,g);
  const legL=box(.25,.65,.28,uniform,-.2,.18,0,g), legR=box(.25,.65,.28,uniform,.2,.18,0,g);
  const arm=box(.22,.7,.25,armor,.48,.78,0,g); arm.rotation.z=-.18;
  const gunMesh=box(.68,.16,.18,gun,.68,.86,.02,g); gunMesh.rotation.z=.03;
  g.userData.legs=[legL,legR]; g.userData.arm=arm;
}

function buildEnemy(e) {
  const g=new THREE.Group(); worldGroup.add(g); e.mesh=g;
  const uniform=material(e.kind==='turret'?0x7b3d2d:0x89713a,.76,.15); const dark=material(0x292f28,.52,.5); const skin=material(0xa78564,.95,0);
  if(e.kind==='turret') {
    box(.85,.55,.8,dark,0,.28,0,g); const head=box(.8,.35,.62,uniform,0,.72,0,g); box(.85,.13,.15,dark,.64,.76,0,g); g.userData.head=head;
  } else {
    box(.65,.75,.48,uniform,0,.72,0,g); box(.42,.35,.42,skin,0,1.31,0,g); box(.48,.14,.45,dark,0,1.52,0,g);
    const gun=box(.62,.13,.16,dark,.55,.86,0,g); g.userData.gun=gun;
  }
}

function buildPickup(p) {
  const group=new THREE.Group(); group.position.set(p.x,p.y,0); worldGroup.add(group); p.mesh=group;
  const col=p.kind==='med'?0x55cc6b:(p.id==='pulse'?0xffb54c:0x4ed8bf);
  const m=addMesh(new THREE.OctahedronGeometry(.34,0),material(col,.35,.22,col,.9),0,.4,0,group); m.rotation.z=.3;
  const base=box(.55,.18,.55,material(0x313b35,.7,.4),0,.08,0,group); base.castShadow=true;
}

function buildSpire() {
  const steel=material(0x59635f,.48,.62), dark=material(0x252e2b,.55,.5), red=material(0x6d2e28,.55,.3,0xff2f1f,1.8);
  for(let y=1;y<15;y+=2.2) {
    cyl(.12,.12,2.4,6,steel,SPIRE.x-1.15,y,0); cyl(.12,.12,2.4,6,steel,SPIRE.x+1.15,y,0);
    const cross=box(2.55,.09,.09,steel,SPIRE.x,y+.95,0); cross.rotation.z=(y%4>2?.28:-.28);
  }
  box(2.8,.3,2.2,dark,SPIRE.x,8.28,0);
  box(.8,1.15,.8,dark,SPIRE.consoleX,8.87,0);
  consoleLight=box(.42,.18,.09,material(0x2d9e62,.35,.1,0x3cff87,1.3),SPIRE.consoleX,9.12,.45);
  spireBeacon=addMesh(new THREE.OctahedronGeometry(.48,0),red,SPIRE.x,15.15,0); spireBeacon.castShadow=false;
  const light=new THREE.PointLight(0xff3d2e,20,8,2); light.position.set(SPIRE.x,15.1,0); scene.add(light); spireBeacon.userData.light=light;
}

function resetRun() {
  Object.assign(player,{x:3.5,y:0,vx:0,vy:0,facing:1,hp:BALANCE.playerMaxHp,maxHp:BALANCE.playerMaxHp,xp:0,rank:1,invuln:0,fireTimer:0,grapple:null,grappleRange:BALANCE.grappleBaseRange,reelSpeed:BALANCE.reelSpeed,fireCooldown:BALANCE.fireCooldown,respawnX:3.5,respawnY:0,deaths:0});
  player.gear.clear();
  for(const e of enemies){e.x=e.startX;e.dir=e.id%2?-1:1;e.hp=e.maxHp;e.dead=false;e.fireTimer=.4+(e.id%3)*.4;if(e.mesh)e.mesh.visible=true;}
  for(const p of pickups){p.taken=false;if(p.mesh)p.mesh.visible=true;}
  bullets.splice(0); Object.assign(game,{complete:false,kills:0,shots:0,hits:0,checkpoint:false,interact:0,everGrappled:false,tutorialPhase:0,startTime:performance.now(),cameraX:7,cameraY:4.8,zoom:isCoarse?14.3:13.4});
  ui.complete.classList.remove('open'); ui.tutorial.classList.remove('hidden'); showTutorial('Move with A/D or the left stick.'); updateHUD();
}

function moveAxis() { return Math.max(-1,Math.min(1,(input.right?1:0)-(input.left?1:0)+input.stickX)); }
function reelAxis() { return Math.max(-1,Math.min(1,(input.up?1:0)-(input.down?1:0)-input.stickY)); }

function toggleGrapple(targetId=null) {
  if(!game.started||game.complete)return;
  if(player.grapple){detachGrapple();return;}
  let best=null,bestScore=Infinity;
  for(const a of anchors){
    const dx=a.x-player.x,dy=a.y-(player.y+1.05),d=Math.hypot(dx,dy);
    if(d>player.grappleRange||dy<-1.0)continue;
    let score=d + (Math.sign(dx)!==player.facing?1.2:0);
    if(targetId!==null){ if(a.id!==targetId)continue; score=0; }
    if(score<bestScore){best=a;bestScore=score;}
  }
  if(!best){showToast('OUT OF CABLE RANGE');return;}
  const dx=player.x-best.x,dy=(player.y+1.05)-best.y;
  player.grapple={id:best.id,length:Math.max(2.0,Math.hypot(dx,dy)*.94)};
  best.active=true; game.everGrappled=true; showToast('GRIP LOCKED'); sfx('grapple');
}
function detachGrapple(){ if(!player.grapple)return; anchors[player.grapple.id].active=false; player.grapple=null; }

function firePlayer() {
  if(player.fireTimer>0||!game.started||game.complete)return;
  player.fireTimer=player.fireCooldown; game.shots++; sfx('fire');
  bullets.push({x:player.x+player.facing*.72,y:player.y+1.0,vx:player.facing*BALANCE.playerBulletSpeed,vy:0,enemy:false,life:2.2,mesh:createBullet(false)});
}
function createBullet(enemy) {
  if(!scene)return null;
  const col=enemy?0xff5338:0xffdf49; const m=addMesh(new THREE.BoxGeometry(.28,.09,.1),material(col,.3,.1,col,1.4),0,0,0,scene); m.castShadow=false; return m;
}

function update(dt) {
  player.invuln=Math.max(0,player.invuln-dt); player.fireTimer=Math.max(0,player.fireTimer-dt);
  if(input.fire)firePlayer();
  const mx=moveAxis(), ry=reelAxis(); if(Math.abs(mx)>.1)player.facing=mx>0?1:-1;
  const accel=player.grounded?BALANCE.groundAccel:BALANCE.airAccel;
  if(Math.abs(mx)>.06) player.vx += mx*accel*dt; else if(player.grounded) player.vx *= Math.pow(.045,dt);
  player.vx=Math.max(-BALANCE.maxSpeed,Math.min(BALANCE.maxSpeed,player.vx));
  player.vy-=BALANCE.gravity*dt;

  const oldX=player.x, oldY=player.y;
  player.x+=player.vx*dt; resolveHorizontal(oldX);
  player.y+=player.vy*dt; player.grounded=false; resolveVertical(oldY);

  if(player.grapple) applyGrapple(dt,ry,mx);
  if(player.y<-13){ damagePlayer(99); }
  player.x=Math.max(-1,Math.min(108,player.x));

  updateEnemies(dt); updateBullets(dt); updatePickups(dt); updateProgression(); updateObjective(dt); updateTutorial(); updateVisuals(dt); updateCamera(dt); updateHUD();
}

function resolveHorizontal(oldX) {
  const half=.34, bottom=player.y+.05, top=player.y+1.68;
  for(const p of platforms){
    const l=p.x-p.w/2,r=p.x+p.w/2,b=p.y-p.h/2,t=p.y+p.h/2;
    if(top<=b+.04||bottom>=t-.04)continue;
    if(player.x+half>l&&player.x-half<r){
      const step=t-player.y;
      if(player.grounded&&step>0&&step<=.62){player.y=t;continue;}
      if(oldX+half<=l){player.x=l-half-.002;player.vx=Math.min(0,player.vx);}
      else if(oldX-half>=r){player.x=r+half+.002;player.vx=Math.max(0,player.vx);}
    }
  }
}
function resolveVertical(oldY) {
  const half=.31, left=player.x-half,right=player.x+half, height=1.7;
  for(const p of platforms){
    const l=p.x-p.w/2,r=p.x+p.w/2,b=p.y-p.h/2,t=p.y+p.h/2;
    if(right<=l+.02||left>=r-.02)continue;
    if(player.vy<=0 && oldY>=t-.08 && player.y<=t+.02){player.y=t;player.vy=0;player.grounded=true;}
    else if(player.vy>0 && oldY+height<=b+.08 && player.y+height>=b-.02){player.y=b-height-.002;player.vy=0;}
  }
}

function applyGrapple(dt, reel, move) {
  const a=anchors[player.grapple.id]; if(!a){detachGrapple();return;}
  player.grapple.length -= Math.max(0,reel)*player.reelSpeed*dt;
  player.grapple.length += Math.max(0,-reel)*2.5*dt;
  player.grapple.length=Math.max(1.8,Math.min(player.grapple.length,player.grappleRange));
  player.vx += move*12*dt;
  const px=player.x,py=player.y+1.05,rx=px-a.x,ry=py-a.y,d=Math.hypot(rx,ry)||.001;
  if(d>player.grapple.length){
    const ux=rx/d,uy=ry/d;
    player.x=a.x+ux*player.grapple.length;
    player.y=a.y+uy*player.grapple.length-1.05;
    const vr=player.vx*ux+player.vy*uy;
    if(vr>0){player.vx-=vr*ux;player.vy-=vr*uy;}
    const tangentBoost=move*5.0*dt; player.vx+=tangentBoost;
    resolveVertical(player.y+.05);
  }
  if(Math.hypot(player.x-a.x,player.y+1.05-a.y)>player.grappleRange+1.5)detachGrapple();
}

function updateEnemies(dt) {
  for(const e of enemies){if(e.dead)continue;
    const dx=player.x-e.x,dy=(player.y+.8)-(e.y+.8),dist=Math.hypot(dx,dy);
    if(e.kind==='guard'&&dist>7.5){e.x+=e.dir*1.05*dt;if(Math.abs(e.x-e.startX)>e.patrol){e.dir*=-1;e.x=e.startX+Math.sign(e.x-e.startX)*e.patrol;}}
    if(dist<12 && Math.abs(dy)<5.5){
      e.dir=dx>=0?1:-1; e.fireTimer-=dt;
      if(e.fireTimer<=0){
        e.fireTimer=BALANCE.enemyFireCooldown*(e.kind==='turret'?.82:1)+(e.id%3)*.08;
        const len=Math.hypot(dx,dy)||1, speed=BALANCE.enemyBulletSpeed*(e.kind==='turret'?1.1:1);
        bullets.push({x:e.x+e.dir*.55,y:e.y+.9,vx:dx/len*speed,vy:dy/len*speed,enemy:true,life:3.0,mesh:createBullet(true)});
      }
    }
  }
}

function updateBullets(dt) {
  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i]; b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.mesh)b.mesh.position.set(b.x,b.y,0.25);
    let remove=b.life<=0;
    if(!remove&&pointHitsPlatform(b.x,b.y))remove=true;
    if(!remove&&!b.enemy){
      for(const e of enemies){if(e.dead)continue;if(Math.abs(b.x-e.x)<.55&&b.y>e.y-.1&&b.y<e.y+1.7){e.hp--;game.hits++;remove=true;if(e.hp<=0)killEnemy(e);break;}}
    } else if(!remove&&b.enemy&&player.invuln<=0&&Math.abs(b.x-player.x)<.42&&b.y>player.y&&b.y<player.y+1.7){damagePlayer(1,Math.sign(b.vx));remove=true;}
    if(remove){if(b.mesh)b.mesh.removeFromParent();bullets.splice(i,1);}
  }
}
function pointHitsPlatform(x,y){for(const p of platforms){if(x>p.x-p.w/2&&x<p.x+p.w/2&&y>p.y-p.h/2&&y<p.y+p.h/2)return true;}return false;}
function killEnemy(e){e.dead=true;if(e.mesh)e.mesh.visible=false;player.xp+=e.xp;game.kills++;showToast(`+${e.xp} FIELD XP`);sfx('kill');}
function damagePlayer(amount,dir=0){
  if(player.invuln>0&&amount<90)return; player.hp-=amount;player.invuln=1.05;player.vx+=dir*3.8;player.vy=4.6;game.shake=.32;detachGrapple();sfx('hit');ui.damageFlash.classList.add('show');setTimeout(()=>ui.damageFlash.classList.remove('show'),90);
  if(player.hp<=0)respawn();
}
function respawn(){
  player.deaths++;player.hp=player.maxHp;player.x=player.respawnX;player.y=player.respawnY;player.vx=0;player.vy=0;player.invuln=1.6;bullets.splice(0).forEach(b=>b.mesh?.removeFromParent());showToast('FIELD RESET');
}

function updatePickups(dt){
  for(const p of pickups){if(p.taken)continue;if(p.mesh){p.mesh.rotation.y+=dt*1.3;p.mesh.position.set(p.x,p.y+.08*Math.sin(performance.now()/260+p.x),0);}
    if(Math.abs(player.x-p.x)<.65&&Math.abs((player.y+.7)-p.y)<1.25){p.taken=true;if(p.mesh)p.mesh.visible=false;applyPickup(p);}
  }
}
function applyPickup(p){
  if(p.kind==='med'){player.hp=Math.min(player.maxHp,player.hp+2);showToast('FIELD PATCH +2');return;}
  player.gear.add(p.id);
  if(p.id==='grip')player.grappleRange+=BALANCE.gripGearBonus;
  if(p.id==='reel')player.reelSpeed+=BALANCE.reelGearBonus;
  if(p.id==='pulse')player.fireCooldown=BALANCE.pulseFireCooldown;
  showToast(p.label);sfx('gear');
}
function updateProgression(){
  if(player.rank===1&&player.xp>=BALANCE.rank2XP){player.rank=2;player.grappleRange+=BALANCE.grappleRankBonus;player.hp=Math.min(player.maxHp,player.hp+1);showToast('RANK 2: CABLE RANGE +1m');}
  if(player.rank===2&&player.xp>=BALANCE.rank3XP){player.rank=3;player.maxHp++;player.hp=player.maxHp;showToast('RANK 3: VITAL +1');}
  if(!game.checkpoint&&player.x>=CHECKPOINT_X){game.checkpoint=true;player.respawnX=51;player.respawnY=0;showCheckpoint();}
}

function updateObjective(dt){
  const d=Math.hypot(player.x-SPIRE.consoleX,(player.y+.8)-SPIRE.consoleY);
  if(player.x<52)ui.objective.textContent='Cross the gorge • Find Relay Spire 7';
  else if(player.x<94)ui.objective.textContent='Advance through the relay fortress';
  else if(d>2.2)ui.objective.textContent='Ascend Relay Spire 7';
  else ui.objective.textContent='Hold ACT to cut the transmitter';
  if(d<1.45&&input.act){game.interact+=dt;if(game.interact>=BALANCE.interactTime)completeMission();} else game.interact=Math.max(0,game.interact-dt*1.5);
  if(consoleLight&&d<2.2)consoleLight.material.emissiveIntensity=1.3+game.interact*2.2;
}
function completeMission(){
  if(game.complete)return;game.complete=true;detachGrapple();
  if(spireBeacon){spireBeacon.material.color.setHex(0x35d86d);spireBeacon.material.emissive.setHex(0x35ff78);spireBeacon.userData.light.color.setHex(0x4aff87);}sfx('complete');
  ui.objective.textContent='Relay Spire 7 offline';
  const elapsed=(performance.now()-game.startTime)/1000; const accuracy=game.shots?Math.round(game.hits/game.shots*100):0;
  ui.stats.innerHTML=`<div class="stat"><b>${formatTime(elapsed)}</b><span>MISSION TIME</span></div><div class="stat"><b>${game.kills}/${enemies.length}</b><span>HOSTILES DISABLED</span></div><div class="stat"><b>${accuracy}%</b><span>SHOT ACCURACY</span></div><div class="stat"><b>${player.deaths}</b><span>FIELD RESETS</span></div>`;
  setTimeout(()=>ui.complete.classList.add('open'),700);
}
function formatTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return `${m}:${String(sec).padStart(2,'0')}`;}

function updateTutorial(){
  if(game.tutorialPhase===0&&player.x>6){game.tutorialPhase=1;showTutorial(isCoarse?'No jump. Tap a glowing ring or GRAPPLE.':'No jump. Aim for a glowing ring and press SPACE.');}
  if(game.tutorialPhase===1&&game.everGrappled){game.tutorialPhase=2;showTutorial(isCoarse?'Swing with the stick. Push it up/down to reel.':'Swing with A/D. Reel with W/S. SPACE releases.');}
  if(game.tutorialPhase===2&&player.x>23){game.tutorialPhase=3;showTutorial(isCoarse?'Use FIRE to clear the patrol. High and low routes both work.':'Use F/J to fire. High and low routes both work.');}
  if(game.tutorialPhase===3&&game.kills>0){game.tutorialPhase=4;showTutorial('XP upgrades your cable and vitality. Gear caches improve equipment.');setTimeout(()=>ui.tutorial.classList.add('hidden'),5200);}
}
function showTutorial(text){ui.tutorialText.textContent=text;ui.tutorial.classList.remove('hidden');}
function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');activeToastTimer=1.4;}
function showCheckpoint(){ui.checkpoint.classList.add('show');checkpointTimer=2.2;sfx('checkpoint');}

function updateVisuals(dt){
  activeToastTimer-=dt;if(activeToastTimer<=0)ui.toast.classList.remove('show'); checkpointTimer-=dt;if(checkpointTimer<=0)ui.checkpoint.classList.remove('show');
  if(!scene)return;
  if(player.mesh){
    player.mesh.position.set(player.x,player.y,0);player.mesh.scale.x=player.facing;
    player.mesh.rotation.z=Math.max(-.18,Math.min(.18,-player.vx*.018));
    const phase=performance.now()*.012*Math.min(1,Math.abs(player.vx)/2); const legs=player.mesh.userData.legs; if(legs){legs[0].rotation.z=Math.sin(phase)*.35;legs[1].rotation.z=-Math.sin(phase)*.35;}
    player.mesh.visible=!(player.invuln>0&&Math.floor(player.invuln*14)%2===0);
  }
  for(const a of anchors){if(a.mesh){const ring=a.mesh.children[0];ring.material.emissiveIntensity=a.active?2.3:.8;const s=a.active?1.18:1;ring.scale.setScalar(s);}}
  for(const e of enemies){if(e.mesh&&!e.dead){e.mesh.position.set(e.x,e.y,0);e.mesh.scale.x=e.dir;}}
  if(ropeMesh){
    if(player.grapple){const a=anchors[player.grapple.id],from=tempV.set(player.x,player.y+1.05,.06),to=tempV2.set(a.x,a.y,.06),mid=new THREE.Vector3().addVectors(from,to).multiplyScalar(.5),dir=new THREE.Vector3().subVectors(to,from),len=dir.length();ropeMesh.visible=true;ropeMesh.position.copy(mid);ropeMesh.scale.set(1,len,1);ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());}
    else ropeMesh.visible=false;
  }
  if(spireBeacon){spireBeacon.rotation.y+=dt*1.8;spireBeacon.rotation.x+=dt*.55;}
}

function updateCamera(dt){
  const targetX=Math.max(6,Math.min(101,player.x+player.facing*1.8));
  const targetY=Math.max(4.3,Math.min(12.5,player.y+4.2));
  const k=1-Math.exp(-dt*4.2);game.cameraX+=(targetX-game.cameraX)*k;game.cameraY+=(targetY-game.cameraY)*k;
  game.shake=Math.max(0,game.shake-dt);
  if(camera){const shake=game.shake?Math.sin(performance.now()*.08)*game.shake:0;camera.position.set(game.cameraX+shake,game.cameraY+shake*.35,game.zoom);camera.lookAt(game.cameraX+1.2,game.cameraY-1.1,0);}
}

const hudCache = { hp: '', xp: '', rank: -1, gear: '' };
function updateHUD(){
  const hpKey=`${player.hp}/${player.maxHp}`;
  if(hudCache.hp!==hpKey){
    hudCache.hp=hpKey;ui.health.innerHTML='';
    for(let i=0;i<player.maxHp;i++){const pip=document.createElement('i');pip.className=`pip${i>=player.hp?' off':''}`;ui.health.appendChild(pip);}
  }
  const next=player.rank===1?BALANCE.rank2XP:player.rank===2?BALANCE.rank3XP:BALANCE.rank3XP;
  const prev=player.rank===1?0:player.rank===2?BALANCE.rank2XP:BALANCE.rank3XP;
  const pct=player.rank>=3?100:Math.max(0,Math.min(100,(player.xp-prev)/(next-prev)*100));
  const xpKey=`${player.xp}/${next}/${player.rank}`;
  if(hudCache.xp!==xpKey){hudCache.xp=xpKey;ui.xpFill.style.width=`${pct}%`;ui.xpLabel.textContent=player.rank>=3?`${player.xp} / MAX`:`${player.xp} / ${next}`;}
  if(hudCache.rank!==player.rank){hudCache.rank=player.rank;ui.rank.textContent=player.rank;}
  const gear=[];if(player.gear.has('grip'))gear.push('GRIP-2');else gear.push('GRIP-1');if(player.gear.has('reel'))gear.push('REEL-2');if(player.gear.has('pulse'))gear.push('PULSE');
  const gearText=gear.join(' • ');if(hudCache.gear!==gearText){hudCache.gear=gearText;ui.gear.textContent=gearText;}
}

function snapshot(){return {camera:{x:game.cameraX,y:game.cameraY,worldH:game.zoom*.88},platforms,anchors,player:{x:player.x,y:player.y,invuln:player.invuln},rope:player.grapple?anchors[player.grapple.id]:null,enemies,bullets,pickups,spire:SPIRE,complete:game.complete};}

function render(){
  if(fallback){fallback.render(snapshot());return;}
  if(!renderer||!scene)return;
  if(pipeline)pipeline.render();else renderer.render(scene,camera);
}

function frame(now){
  const raw=(now-game.lastTime)/1000; game.lastTime=now; const dt=Math.min(.033,Math.max(.001,raw));
  if(game.started&&!game.complete)update(dt); else {updateVisuals(dt);updateCamera(dt);}
  render();
  game.fpsAccum+=dt;game.fpsFrames++;
  if(!game.perfChecked&&game.fpsAccum>4.0&&renderer){const fps=game.fpsFrames/game.fpsAccum;game.perfChecked=true;if(fps<46){game.renderScale=Math.max(1.0,game.renderScale-.35);renderer.setPixelRatio(Math.min(devicePixelRatio||1,game.renderScale));if(game.bloomPass)game.bloomPass.strength.value=.14;showToast('ADAPTIVE RENDER SCALE');}}
  requestAnimationFrame(frame);
}

function onResize(){if(renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,game.renderScale));renderer.setSize(innerWidth,innerHeight);}fallback?.setSize();}
window.addEventListener('resize',onResize);

function bindKeyboard(){
  const map={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyF:'fire',KeyJ:'fire',KeyE:'act'};
  addEventListener('keydown',e=>{if(map[e.code]){input[map[e.code]]=true;e.preventDefault();}if((e.code==='Space'||e.code==='KeyK')&&!e.repeat){toggleGrapple();e.preventDefault();}});
  addEventListener('keyup',e=>{if(map[e.code]){input[map[e.code]]=false;e.preventDefault();}});
}

function bindTouch(){
  let stickId=null;
  const stickMove=(e)=>{if(e.pointerId!==stickId)return;const r=ui.stickBase.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len);const x=dx*k,y=dy*k;ui.stick.style.transform=`translate(${x}px,${y}px)`;input.stickX=x/max;input.stickY=y/max;};
  ui.stickBase.addEventListener('pointerdown',e=>{stickId=e.pointerId;ui.stickBase.setPointerCapture(e.pointerId);stickMove(e);});
  ui.stickBase.addEventListener('pointermove',stickMove);
  const end=e=>{if(e.pointerId!==stickId)return;stickId=null;input.stickX=0;input.stickY=0;ui.stick.style.transform='translate(0,0)';};ui.stickBase.addEventListener('pointerup',end);ui.stickBase.addEventListener('pointercancel',end);
  ui.grappleBtn.addEventListener('pointerdown',e=>{e.preventDefault();ui.grappleBtn.classList.add('active');toggleGrapple();});ui.grappleBtn.addEventListener('pointerup',()=>ui.grappleBtn.classList.remove('active'));ui.grappleBtn.addEventListener('pointercancel',()=>ui.grappleBtn.classList.remove('active'));
  const bindHold=(el,key)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);input[key]=true;el.classList.add('active');});const up=()=>{input[key]=false;el.classList.remove('active');};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);};
  bindHold(ui.fireBtn,'fire');bindHold(ui.actBtn,'act');
}

function bindCanvasGestures(){
  const pointers=new Map();let pinchStart=null,tapStart=new Map();
  const canvas=()=>renderer?.domElement||fallback?.canvas;
  const setup=()=>{
    const c=canvas(); if(!c)return;
    c.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});tapStart.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now()});c.setPointerCapture?.(e.pointerId);if(pointers.size===2){const v=[...pointers.values()];pinchStart={d:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),zoom:game.zoom};}});
    c.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchStart){const v=[...pointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);game.zoom=Math.max(10.5,Math.min(18.5,pinchStart.zoom*(pinchStart.d/Math.max(20,d))));}});
    const finish=e=>{const start=tapStart.get(e.pointerId),wasPinch=pointers.size>1;pointers.delete(e.pointerId);tapStart.delete(e.pointerId);if(pointers.size<2)pinchStart=null;if(start&&!wasPinch&&performance.now()-start.t<280&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<14){const id=anchorAtScreen(e.clientX,e.clientY);if(id!==null)toggleGrapple(id);}};
    c.addEventListener('pointerup',finish);c.addEventListener('pointercancel',finish);
  };
  setup();
}

function anchorAtScreen(clientX,clientY){
  let best=null,bestD=isCoarse?74:48;
  if(camera){
    for(const a of anchors){tempV.set(a.x,a.y,0).project(camera);const sx=(tempV.x*.5+.5)*innerWidth,sy=(-tempV.y*.5+.5)*innerHeight,d=Math.hypot(sx-clientX,sy-clientY);if(d<bestD){bestD=d;best=a.id;}}
  } else {
    const aspect=innerWidth/innerHeight,viewH=game.zoom*.88,viewW=viewH*aspect;
    for(const a of anchors){const sx=((a.x-game.cameraX)/viewW+.5)*innerWidth,sy=(.5-(a.y-game.cameraY)/viewH)*innerHeight,d=Math.hypot(sx-clientX,sy-clientY);if(d<bestD){bestD=d;best=a.id;}}
  }
  return best;
}

ui.startBtn.addEventListener('click',()=>{initAudio();resetRun();game.started=true;game.startTime=performance.now();ui.start.classList.remove('open');});
ui.restartBtn.addEventListener('click',()=>{initAudio();resetRun();game.started=true;ui.complete.classList.remove('open');});

bindKeyboard();bindTouch();updateHUD();
await initRenderer();bindCanvasGestures();
game.lastTime=performance.now();requestAnimationFrame(frame);
