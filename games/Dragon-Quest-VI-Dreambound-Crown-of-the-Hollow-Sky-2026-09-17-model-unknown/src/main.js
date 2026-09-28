import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SAVE_KEY = 'dreambound-crown-save-v1';

const QUESTS = [
  'Speak to Elder Rowan in the village square.',
  'Find Puck the crown-maker on Moonstep Pass.',
  'Investigate the sky-rift near Puck.',
  'Find a way back from the Echo Below.',
  'Return to Puck on Moonstep Pass.',
  'Deliver the Starbell Crown to Elder Rowan.',
  'Defend the Starbell Festival.',
  'The festival is safe. Explore or begin again.'
];

const gameRoot = document.querySelector('#game');
gameRoot.innerHTML = `
  <div id="ui">
    <div id="topbar" class="hidden">
      <div id="quest" class="panel-chip"><small>STARWEAVE JOURNAL</small><div id="questText"></div></div>
      <button id="menuBtn" aria-label="Menu">☰</button>
    </div>
    <div id="prompt">ACTION</div>
    <div id="toast"></div>
    <div id="dialog" class="hidden"><div id="dialogName"></div><div id="dialogText"></div><div id="dialogHint">TAP / E TO CONTINUE</div></div>
    <div id="touch" class="hidden">
      <div id="joystick"><div id="stick"></div></div>
      <div id="actionButtons"><button id="dashBtn" class="touch-btn">DASH</button><button id="actionBtn" class="touch-btn">ACTION</button></div>
    </div>
    <div id="battleHud" class="hidden">
      <div id="enemyPlate" class="panel-chip"><div id="enemyName"></div><div class="bar"><i id="enemyHp"></i></div></div>
      <div id="partyCards"></div>
      <div id="battlePanel" class="panel-chip"><div id="battleMessage"></div><div id="commands"></div></div>
    </div>
    <div id="pause" class="hidden"><div class="title-card">
      <div class="eyebrow">TRAVEL NOTES</div><h2>Starweave Party</h2><div id="pauseQuest" class="title-copy"></div>
      <div class="stats-grid"><div class="statbox"><b>Kite</b><span>Wayfarer</span></div><div class="statbox"><b>Mara</b><span>Luminary</span></div><div class="statbox"><b>Bram</b><span>Warden</span></div></div>
      <button id="resumeBtn" class="primary">RESUME</button><button id="resetBtn" class="secondary">RESTART SLICE</button>
    </div></div>
    <div id="title"><div class="title-card">
      <div class="eyebrow">A POCKET-SIZED QUEST RPG</div><h1>Dreambound</h1><div class="subtitle">Crown of the Hollow Sky</div>
      <p class="title-copy">A mountain festival. A crack between two worlds. Three friends who were only supposed to fetch a crown.</p>
      <button id="newBtn" class="primary">NEW JOURNEY</button><button id="continueBtn" class="secondary hidden">CONTINUE</button>
      <div class="tiny">Original low-poly browser RPG · turn-based party combat · touch + keyboard</div>
    </div></div>
    <div id="ending" class="hidden"><div class="title-card">
      <div class="eyebrow">VERTICAL SLICE COMPLETE</div><h1>Starbell!</h1><div class="subtitle">The Hollow Sky is quiet—for now.</div>
      <p class="title-copy">You crossed the Echo Below, recovered the crown, and defended Starweave. Free-roam is now open.</p>
      <button id="freeBtn" class="primary">KEEP EXPLORING</button><button id="againBtn" class="secondary">PLAY AGAIN</button>
    </div></div>
    <div id="fade"></div>
  </div>`;

const $ = (id) => document.getElementById(id);
const ui = {
  topbar: $('topbar'), questText: $('questText'), prompt: $('prompt'), toast: $('toast'), dialog: $('dialog'),
  dialogName: $('dialogName'), dialogText: $('dialogText'), fade: $('fade'), touch: $('touch'), title: $('title'),
  newBtn: $('newBtn'), continueBtn: $('continueBtn'), menuBtn: $('menuBtn'), pause: $('pause'), pauseQuest: $('pauseQuest'),
  resumeBtn: $('resumeBtn'), resetBtn: $('resetBtn'), battleHud: $('battleHud'), enemyName: $('enemyName'),
  enemyHp: $('enemyHp'), partyCards: $('partyCards'), battleMessage: $('battleMessage'), commands: $('commands'),
  ending: $('ending'), freeBtn: $('freeBtn'), againBtn: $('againBtn'), joystick: $('joystick'), stick: $('stick'),
  actionBtn: $('actionBtn'), dashBtn: $('dashBtn')
};

class AudioKit {
  constructor() { this.ctx = null; this.master = null; this.nextNote = 0; this.step = 0; this.mode = 'field'; }
  async unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.23; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  tone(freq, dur = 0.12, type = 'triangle', vol = 0.15, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  }
  sfx(name) {
    if (!this.ctx) return;
    if (name === 'talk') { this.tone(640,.06,'square',.06); this.tone(790,.05,'square',.035,.05); }
    if (name === 'pickup') { [523,659,784].forEach((n,i)=>this.tone(n,.16,'triangle',.10,i*.07)); }
    if (name === 'hit') { this.tone(95,.11,'sawtooth',.14); this.tone(160,.07,'square',.06,.02); }
    if (name === 'heal') { [440,554,659,880].forEach((n,i)=>this.tone(n,.22,'sine',.09,i*.06)); }
    if (name === 'portal') { [180,240,360,520].forEach((n,i)=>this.tone(n,.42,'sine',.07,i*.08)); }
    if (name === 'win') { [392,523,659,784,1046].forEach((n,i)=>this.tone(n,.34,'triangle',.11,i*.10)); }
    if (name === 'guard') { this.tone(220,.18,'square',.07); this.tone(330,.16,'triangle',.05,.05); }
  }
  setMode(mode) { this.mode = mode; this.nextNote = 0; this.step = 0; }
  update() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now < this.nextNote) return;
    const sets = {
      field: [262,330,392,523,392,330,294,392],
      echo: [220,277,330,415,330,277,247,311],
      battle: [196,196,247,294,196,330,294,247]
    };
    const seq = sets[this.mode] || sets.field;
    const base = seq[this.step % seq.length];
    this.tone(base, this.mode === 'battle' ? .14 : .35, this.mode === 'echo' ? 'sine' : 'triangle', this.mode === 'battle' ? .055 : .032);
    if (this.step % 2 === 0) this.tone(base/2,.32,'sine',.018,.02);
    this.step++;
    this.nextNote = now + (this.mode === 'battle' ? .23 : .42);
  }
}
const audio = new AudioKit();

class InputState {
  constructor() {
    this.keys = new Set(); this.move = new THREE.Vector2(); this.touchDash = false; this.actionQueued = false;
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space','Enter','KeyE'].includes(e.code)) { e.preventDefault(); if (!ui.dialog.classList.contains('hidden')) game.advanceDialog(); else this.actionQueued = true; }
      if (['Escape','KeyM'].includes(e.code)) game.togglePause();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.setupTouch();
  }
  setupTouch() {
    let active = false, pid = -1;
    const center = () => { const r = ui.joystick.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, max:r.width*.33}; };
    const setStick = (e) => {
      const c = center(); let dx=e.clientX-c.x, dy=e.clientY-c.y; const len=Math.hypot(dx,dy)||1; const m=Math.min(c.max,len); dx=dx/len*m; dy=dy/len*m;
      ui.stick.style.transform = `translate(${dx}px,${dy}px)`; this.move.set(dx/c.max, dy/c.max);
    };
    ui.joystick.addEventListener('pointerdown', e=>{ active=true; pid=e.pointerId; ui.joystick.setPointerCapture(pid); setStick(e); });
    ui.joystick.addEventListener('pointermove', e=>{ if(active && e.pointerId===pid) setStick(e); });
    const end=()=>{active=false; this.move.set(0,0); ui.stick.style.transform='translate(0,0)';};
    ui.joystick.addEventListener('pointerup',end); ui.joystick.addEventListener('pointercancel',end);
    ui.actionBtn.addEventListener('pointerdown',()=>{ this.actionQueued=true; audio.unlock(); });
    ui.dashBtn.addEventListener('pointerdown',()=>{ this.touchDash=true; audio.unlock(); });
    ui.dashBtn.addEventListener('pointerup',()=>this.touchDash=false); ui.dashBtn.addEventListener('pointercancel',()=>this.touchDash=false);
  }
  vector() {
    const x=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);
    const y=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0);
    const v = this.move.lengthSq()>.01 ? this.move.clone() : new THREE.Vector2(x,y);
    if (v.lengthSq()>1) v.normalize(); return v;
  }
  dash() { return this.touchDash || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  consumeAction(){ const q=this.actionQueued; this.actionQueued=false; return q; }
}
const input = new InputState();

const mat = (color, opts={}) => new THREE.MeshStandardMaterial({ color, roughness:.82, metalness:.03, flatShading:true, ...opts });
function shadow(mesh){ mesh.castShadow=true; mesh.receiveShadow=true; return mesh; }
function box(w,h,d,color){ return shadow(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color))); }
function cyl(rt,rb,h,seg,color){ return shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color))); }

function createSky() {
  const geo = new THREE.SphereGeometry(140, 24, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false,
    uniforms:{ top:{value:new THREE.Color('#6e8fe8')}, bottom:{value:new THREE.Color('#f6dba3')}, accent:{value:new THREE.Color('#c7f1ff')}, time:{value:0} },
    vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform vec3 top;uniform vec3 bottom;uniform vec3 accent;uniform float time;varying vec3 vP;
      void main(){ float h=normalize(vP).y*.5+.5; float band=sin(vP.x*.035+time*.08)*.02; vec3 c=mix(bottom,top,smoothstep(.08,.88,h+band));
      float glow=pow(max(0.,1.-length(normalize(vP).xz-vec2(.32,-.22))),7.); c+=accent*glow*.12; gl_FragColor=vec4(c,1.); }`
  });
  return { mesh:new THREE.Mesh(geo, material), material };
}

function createWater(w=18,d=5) {
  const material = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{ time:{value:0}, colorA:{value:new THREE.Color('#347dc2')}, colorB:{value:new THREE.Color('#82e5d4')} },
    vertexShader:`varying vec2 vUv; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin((p.x+time)*2.)*.07;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 colorA;uniform vec3 colorB;void main(){float w=sin((vUv.x*18.+vUv.y*10.)+time*1.8)*.5+.5;vec3 c=mix(colorA,colorB,w*.35+.18);gl_FragColor=vec4(c,.78);}`
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d,32,4),material); mesh.rotation.x=-Math.PI/2; mesh.receiveShadow=true; return {mesh,material};
}

function createRift() {
  const g=new THREE.Group();
  const ringMat=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
    uniforms:{time:{value:0},a:{value:new THREE.Color('#7ae7ff')},b:{value:new THREE.Color('#a762ff')}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 a;uniform vec3 b;void main(){float q=sin(vUv.x*45.+time*5.)*.5+.5;vec3 c=mix(a,b,q);gl_FragColor=vec4(c,.68+.28*q);}`});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.23,8,32),ringMat); ring.position.y=2.1; g.add(ring);
  const diskMat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,
    uniforms:{time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;void main(){vec2 p=vUv-.5;float r=length(p);float n=sin(22.*r-time*5.+atan(p.y,p.x)*4.);float a=smoothstep(.5,.15,r)*(.32+.22*n);gl_FragColor=vec4(.34,.76,1.,a);}`});
  const disk=new THREE.Mesh(new THREE.CircleGeometry(1.82,28),diskMat); disk.position.y=2.1; g.add(disk);
  const pGeo=new THREE.BufferGeometry(); const pos=[];
  for(let i=0;i<42;i++){const a=Math.random()*Math.PI*2,r=1.8+Math.random()*1.4;pos.push(Math.cos(a)*r, .35+Math.random()*3.6, Math.sin(a)*r*.35);}
  pGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({color:'#a8f2ff',size:.09,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false})); g.add(pts);
  return {group:g,ringMat,diskMat,pts};
}

function makeCharacter({coat='#4a78c2',hair='#5a3b2c',skin='#f1bd8c',accent='#f1d05d',hat=false}={}) {
  const g=new THREE.Group();
  const body=box(.68,.8,.46,coat); body.position.y=.95; g.add(body);
  const belt=box(.73,.12,.49,'#47372e'); belt.position.y=.72; g.add(belt);
  const head=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(.38,1),mat(skin))); head.position.y=1.62; g.add(head);
  const hairMesh=shadow(new THREE.Mesh(new THREE.ConeGeometry(.39,.28,7),mat(hair))); hairMesh.position.y=1.91; hairMesh.rotation.y=.3; g.add(hairMesh);
  const armL=box(.18,.66,.2,coat),armR=armL.clone(); armL.position.set(-.44,.98,0);armR.position.set(.44,.98,0);g.add(armL,armR);
  const legL=box(.24,.62,.26,'#37405e'),legR=legL.clone();legL.position.set(-.2,.28,0);legR.position.set(.2,.28,0);g.add(legL,legR);
  const bootL=box(.27,.18,.4,'#302723'),bootR=bootL.clone();bootL.position.set(-.2,-.06,.06);bootR.position.set(.2,-.06,.06);g.add(bootL,bootR);
  const scarf=box(.82,.12,.5,accent); scarf.position.y=1.29;g.add(scarf);
  if(hat){ const brim=cyl(.49,.49,.08,8,accent); brim.position.y=1.92; const cap=cyl(.25,.38,.36,8,accent);cap.position.y=2.1;g.add(brim,cap); }
  g.userData.bob=Math.random()*6; return g;
}

function makeNPC(colors) { const g=makeCharacter(colors); g.scale.setScalar(.92); return g; }
function makeMonster(type='moss') {
  const g=new THREE.Group();
  if(type==='boss'){
    const body=shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(1.38,0),mat('#6750a4',{emissive:'#2b1649',emissiveIntensity:.35})));body.scale.y=1.18;body.position.y=1.45;g.add(body);
    const jaw=box(1.72,.5,.86,'#3b2b5d');jaw.position.set(0,.78,.26);g.add(jaw);
    for(const sx of [-.55,.55]){const eye=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),mat('#ffdf72',{emissive:'#ffb020',emissiveIntensity:2})));eye.position.set(sx,1.65,1.05);g.add(eye);}
    for(let i=0;i<5;i++){const horn=cyl(0,.13,.7,5,'#d6c9e8');horn.rotation.z=(i-2)*.18;horn.position.set((i-2)*.48,2.55-Math.abs(i-2)*.08,-.05);g.add(horn);}
    const footL=cyl(.38,.48,.55,6,'#3d315d'),footR=footL.clone();footL.position.set(-.72,.23,0);footR.position.set(.72,.23,0);g.add(footL,footR);
  } else {
    const body=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(.85,1),mat('#5ca86c')));body.scale.set(1.15,.82,1);body.position.y=.82;g.add(body);
    const snout=box(.75,.36,.5,'#75bf7c');snout.position.set(0,.78,.67);g.add(snout);
    for(const sx of [-.28,.28]){const eye=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.11,0),mat('#fff0b0',{emissive:'#ffd45d',emissiveIntensity:1.2})));eye.position.set(sx,1.14,.72);g.add(eye);}
    const leaf=new THREE.Mesh(new THREE.ConeGeometry(.34,.7,5),mat('#3a7e50'));leaf.position.set(.25,1.65,0);leaf.rotation.z=-.4;g.add(leaf);
  }
  return g;
}

function makeTree(x,z,scale=1) {
  const g=new THREE.Group(); const trunk=cyl(.24,.34,2.2,6,'#74533c');trunk.position.y=1.1;g.add(trunk);
  const leafMat=mat('#4f9c62');
  for(const [px,py,pz,s] of [[0,2.65,0,1],[.6,2.45,.1,.7],[-.55,2.35,.15,.76],[.1,2.5,-.45,.68]]){
    const m=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(.95*s,1),leafMat));m.position.set(px,py,pz);g.add(m);
  } g.position.set(x,0,z);g.scale.setScalar(scale);return g;
}

function makeHouse(x,z,bodyColor='#d9bd7c',roofColor='#a45b4f',rot=0) {
  const g=new THREE.Group();
  const base=box(4.4,2.65,3.8,bodyColor);base.position.y=1.32;g.add(base);
  const roof=shadow(new THREE.Mesh(new THREE.ConeGeometry(3.25,2.0,4),mat(roofColor)));roof.rotation.y=Math.PI/4;roof.scale.z=.8;roof.position.y=3.25;g.add(roof);
  const door=box(.85,1.55,.12,'#6b4936');door.position.set(0,.78,1.96);g.add(door);
  const winMat=mat('#8be0e2',{emissive:'#62a9b4',emissiveIntensity:.35});
  for(const sx of [-1.2,1.2]){const w=shadow(new THREE.Mesh(new THREE.BoxGeometry(.72,.65,.1),winMat));w.position.set(sx,1.65,1.98);g.add(w);}
  const chimney=box(.5,1.35,.5,'#73544b');chimney.position.set(1.3,3.65,-.55);g.add(chimney);
  g.position.set(x,0,z);g.rotation.y=rot;return g;
}

function makeWell(x,z){
  const g=new THREE.Group();
  const stoneMat=mat('#8b8a91');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const s=box(.58,.62,.48,'#8b8a91');s.position.set(Math.cos(a)*1.05,.32+((i%2)*.05),Math.sin(a)*1.05);s.rotation.y=-a;g.add(s);}
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.84,.84,.12,24),mat('#1a3354',{emissive:'#244d75',emissiveIntensity:.5}));inner.position.y=.39;g.add(inner);
  const postL=box(.18,2.2,.18,'#694b34'),postR=postL.clone();postL.position.set(-1.0,1.2,0);postR.position.set(1.0,1.2,0);g.add(postL,postR);
  const beam=box(2.35,.2,.2,'#694b34');beam.position.y=2.22;g.add(beam);g.position.set(x,0,z);return g;
}

class Game {
  constructor(){
    this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,260);
    this.renderer=new THREE.WebGLRenderer({antialias:!MOBILE,powerPreference:'high-performance',alpha:false});
    this.renderer.setSize(innerWidth,innerHeight); this.baseDpr=Math.min(devicePixelRatio,MOBILE?1.45:1.8); this.renderer.setPixelRatio(this.baseDpr);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.08;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap; gameRoot.prepend(this.renderer.domElement);
    this.composer=new EffectComposer(this.renderer); this.renderPass=new RenderPass(this.scene,this.camera); this.composer.addPass(this.renderPass);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.55,.78); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.clock=new THREE.Clock(); this.state={stage:0,echo:false,herbs:3,complete:false,fieldWin:false}; this.chestOpen=false; this.started=false; this.paused=false; this.dialogQueue=[]; this.dialogCallback=null; this.currentInteract=null;
    this.player=null; this.followers=[]; this.npcs=[]; this.interactables=[]; this.colliders=[]; this.theme=[]; this.rift=null; this.water=null; this.sky=null; this.battle=null; this.fpsSamples=[]; this.lastQualityCheck=performance.now();
    this.tmpV=new THREE.Vector3(); this.prevTrail=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]; this.walkPhase=0;
    this.buildWorld(); this.bindUI(); this.resize(); addEventListener('resize',()=>this.resize());
    this.renderer.setAnimationLoop(()=>this.tick());
  }
  buildWorld(){
    const sky=createSky(); this.sky=sky; this.scene.add(sky.mesh);
    this.scene.fog=new THREE.FogExp2('#b8c8ce',.013);
    const hemi=new THREE.HemisphereLight('#bfe4ff','#706150',1.55); this.scene.add(hemi);
    const sun=new THREE.DirectionalLight('#fff0c8',3.1); sun.position.set(-18,28,-10); sun.castShadow=true; sun.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048); sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.camera.near=1;sun.shadow.camera.far=90; sun.shadow.bias=-.0006; this.scene.add(sun);
    const rim=new THREE.DirectionalLight('#75a7ff',.7);rim.position.set(16,12,30);this.scene.add(rim);

    const groundMat=mat('#7abf69'); this.theme.push({m:groundMat,real:'#7abf69',echo:'#6876a2'});
    const ground=shadow(new THREE.Mesh(new THREE.PlaneGeometry(54,100,1,1),groundMat));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,25);this.scene.add(ground);
    const villageMat=mat('#8fcf78');this.theme.push({m:villageMat,real:'#8fcf78',echo:'#7583ac'});
    const village=shadow(new THREE.Mesh(new THREE.CylinderGeometry(22,24,.85,12),villageMat));village.position.set(0,-.48,0);this.scene.add(village);
    const passMat=mat('#a98e6d');this.theme.push({m:passMat,real:'#a98e6d',echo:'#77708f'});
    const path=shadow(new THREE.Mesh(new THREE.PlaneGeometry(6.5,64),passMat));path.rotation.x=-Math.PI/2;path.position.set(0,.005,29);this.scene.add(path);

    const water=createWater(24,5.5); water.mesh.position.set(0,.03,29.5);this.scene.add(water.mesh);this.water=water;
    for(let x=-9;x<=9;x+=1.55){const p=box(1.35,.24,5.3,'#8b603f');p.position.set(x,.18,29.5);this.scene.add(p);}
    const railMat=mat('#68462f');
    for(const z of [27.2,31.8]){const r=new THREE.Mesh(new THREE.BoxGeometry(19.3,.18,.16),railMat);r.position.set(0,.72,z);this.scene.add(r);for(let x=-9;x<=9;x+=3){const po=new THREE.Mesh(new THREE.BoxGeometry(.16,1.15,.16),railMat);po.position.set(x,.45,z);this.scene.add(po);}}

    for(let i=0;i<23;i++){const x=(i%2?1:-1)*(10+Math.random()*11);const z=-9+Math.random()*75;this.scene.add(makeTree(x,z,.75+Math.random()*.55));}
    for(let i=0;i<22;i++){const s=shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(.35+Math.random()*.5,0),mat(i%3===0?'#8e8276':'#756d68')));s.position.set((Math.random()-.5)*42,.18,12+Math.random()*58);s.scale.y=.55;this.scene.add(s);}

    const houses=[[-8,-5,'#e0bd7a','#a65249',.12],[8,-5,'#d8c68b','#6d6aa6',-.12],[-10,7,'#d9b789','#8c5a46',.04],[10,8,'#e2c985','#6b7e96',-.06]];
    for(const h of houses){this.scene.add(makeHouse(...h));this.colliders.push({x:h[0],z:h[1],w:5.2,d:4.7});}
    const shrine=new THREE.Group(); const plinth=cyl(1.65,2.0,.55,8,'#b7aa8a');plinth.position.y=.27;shrine.add(plinth);const bell=cyl(.58,.82,.85,8,'#d9b34a');bell.position.y=1.15;shrine.add(bell);const star=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.4,0),mat('#ffe07e',{emissive:'#ffcb4e',emissiveIntensity:.8})));star.position.y=1.95;shrine.add(star);shrine.position.set(0,0,2);this.scene.add(shrine);
    const bannerMat=mat('#d75b68');for(const x of [-5,5]){const pole=box(.16,4,.16,'#6a4b35');pole.position.set(x,2,-.5);const flag=box(1.4,1.1,.08,'#d75b68');flag.position.set(x,3.2,-.45);this.scene.add(pole,flag);}

    const cliffMat=mat('#6f625c');this.theme.push({m:cliffMat,real:'#6f625c',echo:'#56526a'});
    for(const x of [-18,18]){for(let z=18;z<72;z+=5){const c=shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(3.1,0),cliffMat));c.position.set(x+(Math.random()-.5)*2,1.5,z);c.scale.set(1.15,1.5,1);this.scene.add(c);}}

    this.player=makeCharacter({coat:'#3869b2',hair:'#443027',accent:'#f0c552'});this.player.position.set(0,0,-1);this.scene.add(this.player);
    const mara=makeCharacter({coat:'#9d5ca3',hair:'#c28755',accent:'#77dce3',hat:true}); const bram=makeCharacter({coat:'#557a54',hair:'#30261f',accent:'#e08955'}); bram.scale.setScalar(1.08);
    mara.position.set(-1,0,0);bram.position.set(1,0,0);this.scene.add(mara,bram);this.followers=[mara,bram];
    this.prevTrail=[this.player.position.clone(),this.player.position.clone(),this.player.position.clone()];

    this.addNPC('Elder Rowan',makeNPC({coat:'#7d664e',hair:'#d7d2c6',accent:'#dfb75a',hat:true}),3.4,-.8,()=>this.talkElder());
    this.addNPC('Puck',makeNPC({coat:'#b16a49',hair:'#49352c',accent:'#8ed5b0'}),-3.3,53.3,()=>this.talkPuck());
    this.addNPC('Linn',makeNPC({coat:'#4f8f8d',hair:'#4b2f29',accent:'#f2d273'}),-6.2,3.7,()=>this.say('Linn',this.state.echo?'...A cold breeze just walked through me.':'The festival bell only rings when the Starbell Crown is home.'));
    this.addNPC('Toma',makeNPC({coat:'#865f9e',hair:'#5f4937',accent:'#8ad2ec'}),7.1,4.4,()=>this.say('Toma',this.state.echo?'Did that banner move by itself?':'Puck went down the pass before sunrise. He was muttering about a crack in the sky.'));

    const well=makeWell(9.3,63);this.scene.add(well);this.interactables.push({name:'Mirror Well',pos:new THREE.Vector3(9.3,0,63),radius:2.3,fn:()=>this.useWell(),mode:'echo'});
    this.rift=createRift();this.rift.group.position.set(0,0,58);this.scene.add(this.rift.group);this.interactables.push({name:'Sky-rift',pos:new THREE.Vector3(0,0,58),radius:2.9,fn:()=>this.useRift()});
    const chest=new THREE.Group();const cb=box(1.1,.65,.78,'#805231');cb.position.y=.35;const lid=box(1.12,.26,.8,'#a56a36');lid.position.y=.78;chest.add(cb,lid);chest.position.set(-8,0,36);this.scene.add(chest);this.interactables.push({name:'Supply Chest',pos:new THREE.Vector3(-8,0,36),radius:1.8,fn:()=>{if(this.chestOpen)return this.toast('The chest is empty.');this.chestOpen=true;lid.rotation.x=-.65;lid.position.z=-.18;this.state.herbs+=2;audio.sfx('pickup');this.toast('Found 2 Brightleaf Herbs.');this.save();}});

    this.camera.position.set(10,13,-12);this.camera.lookAt(this.player.position);
    this.setWorldMode(false,true); this.updateQuest();
  }
  addNPC(name,obj,x,z,fn){obj.position.set(x,0,z);this.scene.add(obj);const item={name,obj,pos:obj.position,radius:2.15,fn};this.npcs.push(item);this.interactables.push(item);}
  bindUI(){
    ui.newBtn.onclick=()=>this.startNew(); ui.continueBtn.onclick=()=>this.continueGame(); ui.menuBtn.onclick=()=>this.togglePause(); ui.resumeBtn.onclick=()=>this.togglePause(false); ui.resetBtn.onclick=()=>this.startNew(); ui.freeBtn.onclick=()=>{ui.ending.classList.add('hidden');this.paused=false;}; ui.againBtn.onclick=()=>this.startNew();
    const saved=localStorage.getItem(SAVE_KEY); if(saved)ui.continueBtn.classList.remove('hidden');
    ui.dialog.onclick=()=>this.advanceDialog();
  }
  startNew(){localStorage.removeItem(SAVE_KEY);ui.pause.classList.add('hidden');ui.battleHud.classList.add('hidden');this.battle=null;this.state={stage:0,echo:false,herbs:3,complete:false,fieldWin:false};this.chestOpen=false;this.player.position.set(0,0,-1);this.followers[0].position.set(-1,0,0);this.followers[1].position.set(1,0,0);this.setWorldMode(false,true);this.startCommon();this.say('Mara','You were shouting about a horned king again. Come on—Elder Rowan is waiting in the square.');}
  continueGame(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s)this.state={...this.state,...s};}catch{} this.setWorldMode(this.state.echo,true);this.player.position.set(0,0,this.state.echo?55:Math.min(48,Math.max(-1,this.state.stage*8)));this.startCommon();if(this.state.stage===6)setTimeout(()=>this.startBattle(true),350);}
  startCommon(){audio.unlock();audio.setMode(this.state.echo?'echo':'field');ui.title.classList.add('hidden');ui.ending.classList.add('hidden');ui.topbar.classList.remove('hidden');if(MOBILE)ui.touch.classList.remove('hidden');this.started=true;this.paused=false;this.updateQuest();}
  save(){localStorage.setItem(SAVE_KEY,JSON.stringify(this.state));ui.continueBtn.classList.remove('hidden');}
  updateQuest(){ui.questText.textContent=QUESTS[this.state.stage]||QUESTS[0];ui.pauseQuest.textContent=ui.questText.textContent;}
  setStage(n){this.state.stage=n;this.updateQuest();this.save();}
  setWorldMode(echo,instant=false){this.state.echo=echo;this.scene.fog.color.set(echo?'#4b5679':'#b8c8ce');this.scene.fog.density=echo?.019:.013;
    for(const t of this.theme)t.m.color.set(echo?t.echo:t.real);this.sky.material.uniforms.top.value.set(echo?'#32395f':'#6e8fe8');this.sky.material.uniforms.bottom.value.set(echo?'#8c7ba2':'#f6dba3');this.water.material.uniforms.colorA.value.set(echo?'#443d72':'#347dc2');this.water.material.uniforms.colorB.value.set(echo?'#9e77c7':'#82e5d4');
    for(const n of this.npcs)n.obj.traverse(o=>{if(o.material)o.material.transparent=echo,o.material.opacity=echo?.24:1,o.material.needsUpdate=true;});audio.setMode(echo?'echo':'field');if(!instant)this.save();}
  async transitionWorld(echo){this.paused=true;ui.fade.classList.add('on');await delay(470);this.setWorldMode(echo);audio.sfx('portal');await delay(180);ui.fade.classList.remove('on');this.paused=false;}
  say(name,text,callback=null){this.dialogQueue=[{name,text}];this.dialogCallback=callback;this.showDialog();}
  converse(lines,callback=null){this.dialogQueue=lines.map(x=>({name:x[0],text:x[1]}));this.dialogCallback=callback;this.showDialog();}
  showDialog(){const d=this.dialogQueue[0];if(!d){ui.dialog.classList.add('hidden');const cb=this.dialogCallback;this.dialogCallback=null;if(cb)cb();return;}this.paused=true;ui.dialogName.textContent=d.name;ui.dialogText.textContent=d.text;ui.dialog.classList.remove('hidden');audio.sfx('talk');}
  advanceDialog(){if(ui.dialog.classList.contains('hidden'))return;this.dialogQueue.shift();if(this.dialogQueue.length)this.showDialog();else{ui.dialog.classList.add('hidden');this.paused=false;const cb=this.dialogCallback;this.dialogCallback=null;if(cb)cb();}}
  toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1700);}
  togglePause(force){if(!this.started||this.battle||!ui.dialog.classList.contains('hidden'))return;this.paused=force??!this.paused;ui.pause.classList.toggle('hidden',!this.paused);ui.pauseQuest.textContent=QUESTS[this.state.stage];}
  talkElder(){
    if(this.state.echo)return this.say('Elder Rowan','...');
    if(this.state.stage===0)this.converse([['Elder Rowan','Kite, Mara, Bram—the Starbell Crown is late. Puck took it down Moonstep Pass to polish the moonstone.'],['Bram','A simple delivery. Those are famous last words.'],['Elder Rowan','Bring Puck and the crown home before sunset. The festival cannot begin without them.']],()=>this.setStage(1));
    else if(this.state.stage===5)this.converse([['Elder Rowan','You found it! And you look as if you fell through the sky to do it.'],['Mara','That is uncomfortably accurate.'],['Elder Rowan','No time. Place the crown on the bell—wait... why is the shadow moving?']],()=>{this.setStage(6);setTimeout(()=>this.startBattle(true),300);});
    else this.say('Elder Rowan',this.state.stage>=7?'The bell has never sounded brighter. Starweave owes you three a feast.':'Puck is still down the pass. Follow the timber bridge and keep to the lantern stones.');
  }
  talkPuck(){
    if(this.state.echo)return this.say('Puck','...');
    if(this.state.stage===1)this.converse([['Puck','Don’t come closer! The cliff just opened its eye. I dropped the crown when the ground shook.'],['Kite','That blue ring?'],['Puck','That was not here this morning. If the crown fell through it, we are in trouble.']],()=>this.setStage(2));
    else if(this.state.stage===4)this.converse([['Puck','You vanished. Then you walked out of thin air. I am choosing not to understand that.'],['Mara','The crown?'],['Puck','Caught on a root after all. Here—take it before reality changes its mind.']],()=>{audio.sfx('pickup');this.toast('Starbell Crown obtained.');this.setStage(5);});
    else this.say('Puck',this.state.stage>=5?'I am going to spend the festival somewhere with a roof.':'The crown fell near that rift. Please be careful.');
  }
  useRift(){if(this.state.echo)return this.say('???','The tear hums, but the path back is sealed from this side.');if(this.state.stage<2)return this.toast('A cold wind pours from the strange ring.');if(this.state.stage===2)this.converse([['Mara','I can see another road inside it. Same mountain... wrong sky.'],['Bram','So naturally, we are going in.']],async()=>{await this.transitionWorld(true);this.player.position.set(0,0,55);this.setStage(3);this.say('???','You step into the Echo Below. The village lights are here, but no one can see you.');});}
  useWell(){if(!this.state.echo)return this.say('Mirror Well','Clear water reflects a sky that is not above you.');if(this.state.stage===3)this.converse([['Mara','The reflection is showing our sky.'],['Kite','Then let’s make it a door.']],async()=>{await this.transitionWorld(false);this.player.position.set(5.5,0,58);this.setStage(4);this.toast('Returned to the waking world.');});}
  nearestInteract(){let best=null,bd=999;for(const it of this.interactables){if(it.mode==='echo'&&!this.state.echo)continue;const d=this.player.position.distanceTo(it.pos);if(d<it.radius&&d<bd){best=it;bd=d;}}return best;}
  blocked(x,z){if(x<-20||x>20||z<-11||z>70)return true;for(const c of this.colliders){if(Math.abs(x-c.x)<c.w/2&&Math.abs(z-c.z)<c.d/2)return true;}return false;}
  movePlayer(dt){const v=input.vector();if(v.lengthSq()<.001)return;const speed=input.dash()?7.0:4.6;const dx=v.x*speed*dt,dz=v.y*speed*dt;let nx=this.player.position.x+dx,nz=this.player.position.z+dz;if(!this.blocked(nx,this.player.position.z))this.player.position.x=nx;if(!this.blocked(this.player.position.x,nz))this.player.position.z=nz;this.walkPhase+=dt*10;this.player.position.y=Math.abs(Math.sin(this.walkPhase))*.05;this.player.rotation.y=Math.atan2(v.x,v.y);}
  updateFollowers(dt){this.prevTrail[0].lerp(this.player.position,.14);this.prevTrail[1].lerp(this.prevTrail[0],.11);this.prevTrail[2].lerp(this.prevTrail[1],.09);for(let i=0;i<2;i++){const target=this.prevTrail[i+1];const f=this.followers[i];f.position.lerp(new THREE.Vector3(target.x+(i?-.55:.55),0,target.z+.65+i*.2),Math.min(1,dt*6));f.rotation.y=this.player.rotation.y;f.position.y=Math.abs(Math.sin(this.walkPhase-i))*.04;}}
  updatePrompt(){this.currentInteract=this.nearestInteract();ui.prompt.textContent=this.currentInteract?`ACTION · ${this.currentInteract.name}`:'ACTION';ui.prompt.classList.toggle('show',!!this.currentInteract);if(input.consumeAction()&&this.currentInteract){audio.unlock();this.currentInteract.fn();}}
  updateWorld(dt){this.sky.material.uniforms.time.value+=dt;this.water.material.uniforms.time.value+=dt;this.rift.ringMat.uniforms.time.value+=dt;this.rift.diskMat.uniforms.time.value+=dt;this.rift.group.rotation.y+=dt*.08;this.rift.pts.rotation.z+=dt*.06;
    for(const n of this.npcs){n.obj.position.y=Math.sin(performance.now()*.0015+n.obj.userData.bob)*.03;}
    if(!this.paused){this.movePlayer(dt);this.updateFollowers(dt);this.updatePrompt();if(this.state.stage>=1&&!this.state.echo&&!this.state.fieldWin&&this.player.position.z>23&&this.player.position.z<34)this.startBattle(false);}
    const desired=new THREE.Vector3(this.player.position.x+9,this.player.position.y+11,this.player.position.z-11.5);this.camera.position.lerp(desired,1-Math.pow(.001,dt));this.camera.lookAt(this.player.position.x,this.player.position.y+.9,this.player.position.z+2.2);
  }
  startBattle(boss){if(this.battle)return;this.paused=true;ui.topbar.classList.add('hidden');ui.touch.classList.add('hidden');this.battle=new BattleSystem(this,boss);audio.setMode('battle');}
  battleEnded(win,boss=true){this.battle=null;ui.battleHud.classList.add('hidden');ui.topbar.classList.remove('hidden');if(MOBILE)ui.touch.classList.remove('hidden');audio.setMode(this.state.echo?'echo':'field');this.paused=false;if(win&&boss){this.state.complete=true;this.setStage(7);audio.sfx('win');setTimeout(()=>{this.paused=true;ui.ending.classList.remove('hidden');},700);}}
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.composer.setSize(w,h);}
  quality(dt){this.fpsSamples.push(1/Math.max(dt,.001));if(this.fpsSamples.length>180)this.fpsSamples.shift();if(performance.now()-this.lastQualityCheck<4500||this.fpsSamples.length<90)return;const avg=this.fpsSamples.reduce((a,b)=>a+b,0)/this.fpsSamples.length;let d=this.renderer.getPixelRatio();if(avg<48&&d>.85)d=Math.max(.85,d-.15);else if(avg>58&&d<this.baseDpr)d=Math.min(this.baseDpr,d+.1);this.renderer.setPixelRatio(d);this.composer.setPixelRatio?.(d);this.lastQualityCheck=performance.now();}
  tick(){const dt=Math.min(this.clock.getDelta(),.05);audio.update();if(this.battle){this.battle.update(dt);this.renderPass.scene=this.battle.scene;this.renderPass.camera=this.battle.camera;}else{this.updateWorld(dt);this.renderPass.scene=this.scene;this.renderPass.camera=this.camera;}this.composer.render();this.quality(dt);}
}

class BattleSystem {
  constructor(game,boss=true){
    this.game=game; this.isBoss=boss; this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.1,120); this.camera.position.set(0,5.7,11.5);this.camera.lookAt(.2,1.3,0);
    this.round=1;this.busy=false;this.pick=0;this.actions=[];this.teamGuard=false;this.fx=[];
    this.party=[
      {name:'Kite',role:'Wayfarer',hp:74,max:74,mp:18,maxMp:18,atk:18,skill:'Skycut',cost:4,color:'#3869b2'},
      {name:'Mara',role:'Luminary',hp:56,max:56,mp:30,maxMp:30,atk:12,skill:'Lumen',cost:6,color:'#9d5ca3'},
      {name:'Bram',role:'Warden',hp:88,max:88,mp:14,maxMp:14,atk:16,skill:'Rally',cost:4,color:'#557a54'}
    ];
    this.enemy=boss?{name:'Riftjaw, Hollow-Sky Hound',hp:215,max:215,atk:18}:{name:'Mossback Grumbler',hp:86,max:86,atk:12};
    this.build();this.renderHud();this.ask();ui.battleHud.classList.remove('hidden');
  }
  build(){
    this.scene.fog=new THREE.Fog('#454367',13,38);const sky=createSky();sky.material.uniforms.top.value.set('#252846');sky.material.uniforms.bottom.value.set('#a3739a');this.scene.add(sky.mesh);this.battleSky=sky;
    this.scene.add(new THREE.HemisphereLight('#b7d3ff','#5b4257',1.6));const key=new THREE.DirectionalLight('#fff1c7',3);key.position.set(-6,11,7);key.castShadow=true;key.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;this.scene.add(key);
    const rim=new THREE.PointLight('#826cff',18,24,2);rim.position.set(4,5,-3);this.scene.add(rim);
    const arena=shadow(new THREE.Mesh(new THREE.CylinderGeometry(8.5,9,.85,12),mat('#575777')));arena.position.y=-.48;this.scene.add(arena);
    for(let i=0;i<14;i++){const r=shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(.25+Math.random()*.55,0),mat(i%2?'#72708d':'#5b596f')));r.position.set((Math.random()-.5)*15,.12,(Math.random()-.5)*7);this.scene.add(r);}
    this.partyMeshes=[
      makeCharacter({coat:'#3869b2',hair:'#443027',accent:'#f0c552'}),
      makeCharacter({coat:'#9d5ca3',hair:'#c28755',accent:'#77dce3',hat:true}),
      makeCharacter({coat:'#557a54',hair:'#30261f',accent:'#e08955'})
    ];
    const pp=[[-3.2,0,1.8],[-3.8,0,-.1],[-2.8,0,-2.0]];
    this.partyMeshes.forEach((m,i)=>{m.position.set(...pp[i]);m.rotation.y=Math.PI/2;m.scale.setScalar(i===2?1.06:.95);this.scene.add(m);});
    this.enemyMesh=makeMonster(this.isBoss?'boss':'moss');this.enemyMesh.position.set(2.6,0,-.2);this.enemyMesh.rotation.y=-Math.PI/2;this.scene.add(this.enemyMesh);
    const portal=createRift();portal.group.scale.setScalar(.72);portal.group.position.set(5.4,-.2,-3.2);portal.group.rotation.y=Math.PI/2;portal.group.visible=this.isBoss;this.scene.add(portal.group);this.portal=portal;
  }
  renderHud(){
    ui.enemyName.textContent=this.enemy.name;ui.enemyHp.style.width=`${Math.max(0,this.enemy.hp/this.enemy.max*100)}%`;
    ui.partyCards.innerHTML=this.party.map((p,i)=>`<div class="party-card ${i===this.pick&&!this.busy?'current':''}"><b>${p.name}</b><div>HP ${Math.max(0,p.hp)}/${p.max} · MP ${p.mp}/${p.maxMp}</div></div>`).join('');
  }
  message(t){ui.battleMessage.textContent=t;}
  ask(){
    if(this.busy)return; while(this.pick<this.party.length&&this.party[this.pick].hp<=0)this.pick++;
    if(this.pick>=this.party.length){this.resolveRound();return;}
    const p=this.party[this.pick];this.message(`${p.name} — choose a command.`);this.renderHud();
    const cmds=[
      ['Attack','Steady weapon strike','attack',false],
      [p.skill,p.name==='Kite'?'Heavy single hit':p.name==='Mara'?'Heal the whole party':'Reduce the next enemy attack','skill',p.mp<p.cost],
      ['Guard','Halve damage to this hero','guard',false],
      [`Herb ×${this.game.state.herbs}`,'Restore 32 HP','item',this.game.state.herbs<=0]
    ];
    ui.commands.innerHTML=cmds.map(c=>`<button class="command" data-cmd="${c[2]}" ${c[3]?'disabled':''}>${c[0]}<span>${c[1]}</span></button>`).join('');
    ui.commands.querySelectorAll('button').forEach(b=>b.onclick=()=>this.choose(b.dataset.cmd));
  }
  choose(type){if(this.busy)return;const p=this.party[this.pick];this.actions.push({actor:this.pick,type});this.pick++;audio.unlock();if(type==='guard')audio.sfx('guard');this.ask();}
  async resolveRound(){
    this.busy=true;ui.commands.innerHTML='';this.teamGuard=false;
    for(const a of this.actions){if(this.party[a.actor].hp<=0)continue;await this.playerAction(a);if(this.enemy.hp<=0){await this.victory();return;}}
    await this.enemyAction();
    if(this.party.every(p=>p.hp<=0)){this.defeat();return;}
    this.actions=[];this.pick=0;this.round++;this.busy=false;this.renderHud();this.ask();
  }
  async playerAction(a){
    const p=this.party[a.actor],mesh=this.partyMeshes[a.actor];
    if(a.type==='attack'){
      const dmg=Math.floor(p.atk*.72+Math.random()*7);this.message(`${p.name} attacks!  ${dmg} damage.`);await this.lunge(mesh,.65);this.enemy.hp-=dmg;audio.sfx('hit');this.flash(this.enemyMesh,'#ffd37a');
    } else if(a.type==='skill'&&p.name==='Kite'){
      p.mp-=p.cost;const dmg=30+Math.floor(Math.random()*9);this.message(`Kite uses Skycut!  ${dmg} damage.`);await this.lunge(mesh,1.0);this.enemy.hp-=dmg;audio.sfx('hit');this.flash(this.enemyMesh,'#8ce8ff');this.spark(this.enemyMesh.position,'#8ce8ff',14);
    } else if(a.type==='skill'&&p.name==='Mara'){
      p.mp-=p.cost;this.message('Mara casts Lumen. Warm light mends the party.');audio.sfx('heal');this.spark(mesh.position,'#a7ffcf',18);for(const q of this.party)if(q.hp>0)q.hp=Math.min(q.max,q.hp+24);await delay(520);
    } else if(a.type==='skill'&&p.name==='Bram'){
      p.mp-=p.cost;this.teamGuard=true;this.message('Bram uses Rally. The party braces together.');audio.sfx('guard');this.spark(mesh.position,'#ffe192',16);await delay(470);
    } else if(a.type==='guard'){
      p.guarding=true;this.message(`${p.name} guards.`);await delay(320);
    } else if(a.type==='item'){
      this.game.state.herbs=Math.max(0,this.game.state.herbs-1);p.hp=Math.min(p.max,p.hp+32);this.game.save();this.message(`${p.name} uses a Brightleaf Herb. +32 HP.`);audio.sfx('heal');this.spark(mesh.position,'#9bff8e',10);await delay(420);
    }
    this.renderHud();await delay(240);
  }
  async enemyAction(){
    if(this.enemy.hp<=0)return;
    const living=this.party.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);
    if(this.round%3===0||this.enemy.hp<this.enemy.max*.35){
      this.message(this.isBoss?`${this.enemy.name} exhales Gloam Breath!`:`${this.enemy.name} bursts a cloud of dizzy spores!`);this.enemyMesh.rotation.z=.12;this.spark(new THREE.Vector3(.7,1.4,0),'#b082ff',26);audio.sfx('hit');await delay(500);
      for(const i of living){let dmg=8+Math.floor(Math.random()*6);if(this.teamGuard)dmg=Math.ceil(dmg*.55);if(this.party[i].guarding)dmg=Math.ceil(dmg*.5);this.party[i].hp-=dmg;}
      this.enemyMesh.rotation.z=0;await delay(420);
    } else {
      const i=living[Math.floor(Math.random()*living.length)],p=this.party[i];let dmg=13+Math.floor(Math.random()*7);if(this.teamGuard)dmg=Math.ceil(dmg*.55);if(p.guarding)dmg=Math.ceil(dmg*.5);
      this.message(`${this.enemy.name} mauls ${p.name}.  ${dmg} damage.`);await this.lunge(this.enemyMesh,-.6);p.hp-=dmg;audio.sfx('hit');this.flash(this.partyMeshes[i],'#ff8e95');
    }
    for(const p of this.party)p.guarding=false;this.renderHud();await delay(520);
  }
  async lunge(mesh,amount){const x=mesh.position.x;mesh.position.x+=amount;await delay(150);mesh.position.x=x;await delay(120);}
  flash(group,color){group.traverse(o=>{if(o.material&&o.material.emissive){const old=o.material.emissive.clone(),inten=o.material.emissiveIntensity;o.material.emissive.set(color);o.material.emissiveIntensity=1.5;setTimeout(()=>{o.material.emissive.copy(old);o.material.emissiveIntensity=inten;},150);}});}
  spark(pos,color,count=12){
    const geo=new THREE.BufferGeometry(),a=[];for(let i=0;i<count;i++)a.push(pos.x+(Math.random()-.5)*1.4,pos.y+.5+Math.random()*1.6,pos.z+(Math.random()-.5)*1.4);geo.setAttribute('position',new THREE.Float32BufferAttribute(a,3));const points=new THREE.Points(geo,new THREE.PointsMaterial({color,size:.12,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(points);this.fx.push({o:points,t:0});
  }
  async victory(){this.busy=true;this.message(this.isBoss?'Riftjaw cracks into violet sparks. The Starbell rings!':'The Mossback tumbles away. The mountain path is clear.');this.spark(this.enemyMesh.position,'#ffd26f',40);this.enemyMesh.visible=false;audio.sfx('win');await delay(1250);if(!this.isBoss){this.game.state.fieldWin=true;this.game.state.herbs+=1;this.game.save();this.game.toast('Victory! Found 1 Brightleaf Herb.');}this.game.battleEnded(true,this.isBoss);}
  defeat(){this.busy=true;this.message('The party falls, but the festival bell pulls the moment backward.');ui.commands.innerHTML=`<button class="command" id="retryBattle">RETRY<span>Restore the party and try again</span></button><button class="command" id="restartSlice">RESTART<span>Return to the beginning</span></button>`;$('retryBattle').onclick=()=>this.retry();$('restartSlice').onclick=()=>{this.game.battle=null;ui.battleHud.classList.add('hidden');this.game.startNew();};}
  retry(){this.party.forEach(p=>{p.hp=p.max;p.mp=p.maxMp;p.guarding=false;});this.enemy.hp=this.enemy.max;this.enemyMesh.visible=true;this.actions=[];this.pick=0;this.round=1;this.busy=false;this.renderHud();this.ask();}
  update(dt){this.battleSky.material.uniforms.time.value+=dt;this.portal.ringMat.uniforms.time.value+=dt;this.portal.diskMat.uniforms.time.value+=dt;this.portal.group.rotation.z+=dt*.18;this.enemyMesh.rotation.y=-Math.PI/2+Math.sin(performance.now()*.002)*.05;
    for(const m of this.partyMeshes)m.position.y=Math.sin(performance.now()*.002+m.id)*.025;
    for(let i=this.fx.length-1;i>=0;i--){const f=this.fx[i];f.t+=dt;f.o.position.y+=dt*.55;f.o.material.opacity=1-f.t/1.0;f.o.scale.setScalar(1+f.t*.7);if(f.t>1){this.scene.remove(f.o);f.o.geometry.dispose();f.o.material.dispose();this.fx.splice(i,1);}}
  }
}

const game = new Game();
