import * as THREE from 'three';
import { pass, bloom } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (s) => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const lerp = (a,b,t) => a + (b-a)*t;
const len2 = (x,z) => Math.hypot(x,z);
const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const TAU = Math.PI*2;

class SoundBank {
  constructor(){ this.ctx=null; this.enabled=true; }
  unlock(){
    if(!this.ctx){
      const C = window.AudioContext || window.webkitAudioContext;
      if(C) this.ctx = new C();
    }
    this.ctx?.resume?.();
  }
  tone(freq=440, dur=.09, type='triangle', gain=.045, slide=1){
    if(!this.ctx || !this.enabled) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t+dur+.02);
  }
  chord(notes=[392,494,587]){ notes.forEach((n,i)=>setTimeout(()=>this.tone(n,.15,'triangle',.035,1.02),i*55)); }
}

class MossbellGame {
  constructor({stage,lowPower=false,requestedRenderer='WebGPU'}){
    this.stage=stage; this.lowPower=lowPower; this.requestedRenderer=requestedRenderer;
    this.mobile=matchMedia('(pointer: coarse)').matches || innerWidth<820;
    this.started=false; this.finished=false; this.elapsed=0; this.lastT=performance.now();
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x83c697); this.scene.fog=new THREE.Fog(0x86bf91,30,82);
    this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,140);
    this.cameraZoom=1; this.cameraTarget=new THREE.Vector3(); this.cameraShake=0;
    this.sound=new SoundBank();
    this.keys={}; this.joy={x:0,z:0,id:null}; this.touchPoints=new Map(); this.pinchStart=null;
    this.enemies=[]; this.projectiles=[]; this.interactables=[]; this.colliders=[]; this.glows=[]; this.tempFX=[];
    this.phase='bells'; this.bells=0; this.wardens=0; this.gateOpen=false; this.innerOpen=false; this.chestOpened=false; this.bossActive=false; this.relicClaimed=false;
    this.kills=0; this.deaths=0; this.checkpoint={x:0,z:17};
    this.toastTimer=0; this.hintTimer=0; this.uiTick=0; this.fpsFrames=0; this.fpsTime=0;
    this.pixelRatio=Math.min(devicePixelRatio || 1, this.mobile?1.45:2);
    this.nearby=null;
  }

  async init(){
    const forceWebGL = this.requestedRenderer.toLowerCase().includes('webgl2');
    this.renderer=new THREE.WebGPURenderer({antialias:!this.lowPower,forceWebGL,powerPreference:'high-performance',alpha:false,outputBufferType:this.mobile?THREE.UnsignedByteType:THREE.HalfFloatType});
    await this.renderer.init();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=!this.lowPower;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.toneMapping=THREE.AgXToneMapping;
    this.renderer.toneMappingExposure=1.08;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.domElement.tabIndex=0;
    this.stage.appendChild(this.renderer.domElement);

    const backendName=this.renderer.backend?.constructor?.name || '';
    this.rendererLabel=/webgpu/i.test(backendName)?'WebGPU · three.js r186':(/webgl/i.test(backendName)?'WebGL2 · three.js r186':`${this.requestedRenderer} · three.js r186`);
    $('#backend-pill').textContent=this.rendererLabel;

    this.makeMaterials();
    this.buildLights();
    this.buildWorld();
    this.buildPlayer();
    this.spawnEnemies();
    this.configureRenderPipeline();
    this.bindInput();
    this.resize();
    addEventListener('resize',()=>this.resize());
    this.renderer.setAnimationLoop((t)=>this.loop(t));
    this.updateUI(true);
  }


  configureRenderPipeline(){
    if(this.lowPower)return;
    try{
      const scenePass=pass(this.scene,this.camera);
      const sceneColor=scenePass.getTextureNode('output');
      const glow=bloom(sceneColor,this.mobile ? .12 : .18,.16,.86);
      this.renderPipeline=new THREE.RenderPipeline(this.renderer);
      this.renderPipeline.outputNode=sceneColor.add(glow);
    }catch(error){
      console.warn('Post-processing disabled; direct render path remains active.',error);
      this.renderPipeline=null;
    }
  }

  start(){
    this.started=true; this.sound.unlock();
    this.showToast('Wake the three gold chimes. The mossbound gate will answer.',3.8);
    this.showHint(this.mobile?'Move with the left joystick. BLADE attacks; GUARD reduces damage.':'WASD moves · Space attacks · Shift guards · E uses · Q dashes',5);
  }

  makeMaterials(){
    const std=(color,rough=.88,metal=.02,extra={})=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,flatShading:true,...extra});
    this.m={
      grass:std(0x628c51,.95), grass2:std(0x3f7047,.98), path:std(0xd4bd78,.96), earth:std(0x6b5f3e,1),
      stone:std(0x6e7869,.94), stoneDark:std(0x3c4c47,.96), stoneLight:std(0x9aa28a,.93),
      wood:std(0x6f4a2c,1), leaf:std(0x3f7c4e,.95), leaf2:std(0x5b9858,.95),
      gold:std(0xe7b84e,.5,.55,{emissive:0x3a2505,emissiveIntensity:.35}), ember:std(0xe87848,.42,.18,{emissive:0x6d1d0b,emissiveIntensity:1.5}),
      teal:std(0x3a8f88,.82), cloth:std(0xd96d45,.94), skin:std(0xe4b77c,.95), dark:std(0x24312d,.94),
      enemy:std(0x6aa34a,.86), enemy2:std(0x384d36,.92), red:std(0xb95443,.8),
      steel:std(0x9eaaa7,.45,.58), bronze:std(0xb57a3e,.55,.55),
      water:new THREE.MeshPhysicalMaterial({color:0x5ab0a8,roughness:.25,metalness:0,transparent:true,opacity:.62,flatShading:true}),
      glow:new THREE.MeshBasicMaterial({color:0xffdf72,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}),
      invisible:new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
    };
  }

  mesh(geo,mat,pos=[0,0,0],parent=this.scene,cast=true,receive=true){
    const o=new THREE.Mesh(geo,mat); o.position.set(...pos); o.castShadow=cast&&!this.lowPower; o.receiveShadow=receive; parent.add(o); return o;
  }
  box(w,h,d,pos,mat,parent=this.scene,cast=true){ return this.mesh(new THREE.BoxGeometry(w,h,d),mat,pos,parent,cast,true); }
  roundBox(w,h,d,r,pos,mat,parent=this.scene,cast=true){ return this.mesh(new RoundedBoxGeometry(w,h,d,2,r),mat,pos,parent,cast,true); }
  cyl(rt,rb,h,seg,pos,mat,parent=this.scene,cast=true){ return this.mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat,pos,parent,cast,true); }

  buildLights(){
    const hemi=new THREE.HemisphereLight(0xcaf0cd,0x314435,1.7); this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffe8b8,3.1); sun.position.set(-14,24,16); sun.castShadow=!this.lowPower;
    sun.shadow.mapSize.set(this.mobile?1024:2048,this.mobile?1024:2048); sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-34;sun.shadow.camera.near=1;sun.shadow.camera.far=70; sun.shadow.bias=-.00025;
    this.scene.add(sun); this.sun=sun;
  }

  groundY(z){
    if(z>-20) return 0;
    if(z>-24) return -(Math.abs(z+20)/4);
    return -1;
  }

  addCollider(x,z,w,d,active=()=>true){ this.colliders.push({x,z,w,d,active}); }
  blocked(x,z,r=.42){
    if(x<-27+r||x>27-r||z>25-r||z<-63+r) return true;
    for(const c of this.colliders){
      if(!c.active()) continue;
      const nx=clamp(x,c.x-c.w/2,c.x+c.w/2), nz=clamp(z,c.z-c.d/2,c.z+c.d/2);
      if((x-nx)**2+(z-nz)**2<r*r) return true;
    }
    return false;
  }

  buildWorld(){
    this.box(58,1,48,[0,-.55,2],this.m.grass,this.scene,false);
    this.box(16,1,42,[0,-1.55,-43],this.m.stoneDark,this.scene,false);

    // Meadow path and fork pads.
    this.box(6,.12,39,[0,.02,2],this.m.path,this.scene,false);
    this.box(19,.1,4,[0,.04,4],this.m.path,this.scene,false);
    this.box(14,.1,4,[-5,.04,-9],this.m.path,this.scene,false);

    // Pond gives the meadow a readable landmark without blocking the main route.
    const pond=this.mesh(new THREE.CylinderGeometry(5.3,5.7,.18,12),this.m.water,[-16,-.02,11],this.scene,false,false); pond.userData.baseY=-.02; this.water=pond;
    for(let i=0;i<8;i++){ const a=i/8*TAU; this.mesh(new THREE.DodecahedronGeometry(.6+((i%3)*.12),0),this.m.stone,[ -16+Math.cos(a)*5.1,.25,11+Math.sin(a)*5.1],this.scene,true,true); }

    // Deterministic trees and rocks around traversable space.
    let seed=92173; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<34;i++){
      let x=(rnd()*52)-26, z=(rnd()*42)-15;
      if(Math.abs(x)<5.2 && z>-18) x+=x<0?-7:7;
      if(Math.hypot(x+16,z-11)<6.5) continue;
      const questClear=[[-11.5,5.2,2.5],[11.5,2.2,2.5],[-7.5,-9.3,2.6],[2.7,14.3,2.1]];
      if(questClear.some(([qx,qz,qr])=>Math.hypot(x-qx,z-qz)<qr)) continue;
      this.makeTree(x,z,.78+rnd()*.55,rnd()>.5);
    }
    for(let i=0;i<26;i++){
      const x=(rnd()*52)-26,z=(rnd()*43)-16;
      if(Math.abs(x)<4.5) continue;
      const rock=this.mesh(new THREE.DodecahedronGeometry(.25+rnd()*.55,0),i%3?this.m.stone:this.m.stoneLight,[x,.25,z],this.scene,true,true); rock.scale.y=.55+rnd()*.5; rock.rotation.y=rnd()*TAU;
    }

    // Instanced low-poly grass blades keep draw calls low on mobile.
    const grassGeo=new THREE.ConeGeometry(.09,.55,3); const inst=new THREE.InstancedMesh(grassGeo,this.m.grass2,this.lowPower?90:180); inst.castShadow=false;inst.receiveShadow=false;
    const mx=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();
    for(let i=0;i<inst.count;i++){
      let x=(rnd()*54)-27,z=(rnd()*43)-16; if(Math.abs(x)<3.8&&z>-18)x+=x<0?-5:5;
      p.set(x,.24,z); q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd()*TAU); s.set(1,.7+rnd()*.7,1); mx.compose(p,q,s); inst.setMatrixAt(i,mx);
    }
    this.scene.add(inst);

    // Gate, stairs and railings.
    for(let i=0;i<5;i++) this.box(7.4,.28,1.15,[0,-.05-i*.21,-20.2-i*.82],this.m.path,this.scene,false);
    for(const x of [-4.15,4.15]){
      for(let i=0;i<5;i++) this.cyl(.12,.15,1.15,6,[x,.55-i*.2,-20.2-i*.82],this.m.wood);
      this.box(.18,.18,4.6,[x,.72,-21.85],this.m.wood);
    }
    this.addCollider(-4.15,-21.9,.45,5.3); this.addCollider(4.15,-21.9,.45,5.3);
    this.box(2.5,5,2.3,[-4.3,2.45,-19],this.m.stone);
    this.box(2.5,5,2.3,[4.3,2.45,-19],this.m.stone);
    this.box(7.1,1.2,2.1,[0,5.0,-19],this.m.stoneLight);
    this.gateDoor=this.box(6.1,4.1,.65,[0,2.05,-18.9],this.m.wood); this.gateDoor.userData.closedY=2.05;
    for(let x=-2.2;x<=2.2;x+=1.1) this.box(.12,3.6,.12,[x,0,.38],this.m.steel,this.gateDoor);
    // A low cliff line makes the gate the only route north; the tower collision prevents corner-cutting.
    for(const x of [-24,-21.4,-18.8,-16.2,-13.6,-11,-8.4,8.4,11,13.6,16.2,18.8,21.4,24]){
      const r=this.mesh(new THREE.DodecahedronGeometry(1.35+(Math.abs(x)%2)*.12,0),this.m.stone,[x,.55,-19],this.scene,true,true); r.scale.y=.72;
    }
    this.addCollider(-16,-19,20,2.3); this.addCollider(16,-19,20,2.3);
    this.addCollider(-4.3,-19,2.5,2.3); this.addCollider(4.3,-19,2.5,2.3);
    this.addCollider(0,-18.8,6.4,1,()=>!this.gateOpen);

    // Dungeon walls, inner gate and boss room.
    this.box(1.1,4,40,[-8.25,1,-43],this.m.stone);
    this.box(1.1,4,40,[8.25,1,-43],this.m.stone);
    this.addCollider(-8.25,-43,1.1,40); this.addCollider(8.25,-43,1.1,40);
    this.box(17,4,1.1,[0,1,-63],this.m.stone); this.addCollider(0,-63,17,1.1);
    this.innerDoor=this.box(12.5,3.6,.7,[0,.8,-44],this.m.stoneLight); this.innerDoor.userData.closedY=.8;
    this.addCollider(0,-44,12.7,.9,()=>!this.innerOpen);
    for(const z of [-27,-39,-53]) for(const x of [-6.5,6.5]) this.makeTorch(x,z);

    // Chimes define an exploration triangle but remain close enough for a short mobile loop.
    this.makeChime(-11.5,5.2,'West Chime');
    this.makeChime(11.5,2.2,'East Chime');
    this.makeChime(-7.5,-9.3,'Old Chime');
    this.makeSign(2.7,14.3,'Three meadow chimes share one song. Ring all three and the northern gate will lift.');
    this.makeSign(-4.7,-25.5,'The ruin tests rhythm, not grinding. Guard the heavy strikes, then answer between them.');
    this.makeChest(0,-30.4);
    this.makeFireflies();
  }

  makeTree(x,z,s=1,alt=false){
    const g=new THREE.Group(); g.position.set(x,0,z); this.scene.add(g);
    this.cyl(.22*s,.34*s,2.3*s,6,[0,1.1*s,0],this.m.wood,g);
    const mat=alt?this.m.leaf2:this.m.leaf;
    const a=this.mesh(new THREE.DodecahedronGeometry(1.05*s,0),mat,[0,2.55*s,0],g,true,true); a.scale.y=1.25;
    const b=this.mesh(new THREE.DodecahedronGeometry(.72*s,0),mat,[.45*s,3.05*s,.15*s],g,true,true);
    if(Math.abs(x)<20 && z<18) this.addCollider(x,z,.7*s,.7*s);
  }

  makeTorch(x,z){
    this.box(.22,1.35,.22,[x,.05,z],this.m.wood);
    const flame=this.mesh(new THREE.OctahedronGeometry(.25,0),this.m.ember,[x,.85,z],this.scene,false,false); this.glows.push({obj:flame,baseY:.85,phase:Math.random()*TAU,amp:.08});
    if(!this.lowPower){ const l=new THREE.PointLight(0xff7a45,7.5,7.5,2); l.position.set(x,.9,z); this.scene.add(l); }
  }

  makeChime(x,z,name){
    const g=new THREE.Group();g.position.set(x,0,z);this.scene.add(g);
    this.cyl(.85,1.05,.42,8,[0,.18,0],this.m.stone,g);
    for(const sx of [-.68,.68]) this.box(.3,2.6,.3,[sx,1.55,0],this.m.stoneLight,g);
    this.box(1.7,.34,.34,[0,2.78,0],this.m.stoneLight,g);
    const bell=this.cyl(.48,.7,.9,8,[0,1.7,0],this.m.gold,g); bell.rotation.z=Math.PI;
    const ring=this.mesh(new THREE.RingGeometry(1.05,1.19,24),this.m.glow,[0,.12,0],g,false,false); ring.rotation.x=-Math.PI/2;
    this.glows.push({obj:ring,baseY:.12,phase:Math.random()*TAU,amp:.08});
    this.interactables.push({type:'chime',name,x,z,used:false,visual:g,bell,ring,prompt:'RING'});
  }

  makeSign(x,z,text){
    const g=new THREE.Group();g.position.set(x,0,z);this.scene.add(g);
    this.box(.18,1.15,.18,[0,.55,0],this.m.wood,g); this.box(1.2,.62,.16,[0,1.16,0],this.m.wood,g);
    this.interactables.push({type:'sign',x,z,text,used:false,visual:g,prompt:'READ'});
  }

  makeChest(x,z){
    const g=new THREE.Group(); g.position.set(x,this.groundY(z),z); this.scene.add(g);
    this.roundBox(1.45,.72,.9,.12,[0,.4,0],this.m.wood,g);
    const lid=new THREE.Group();lid.position.set(0,.78,.36);g.add(lid);
    this.roundBox(1.48,.38,.92,.13,[0,.06,-.36],this.m.bronze,lid);
    this.box(.22,.48,.12,[0,.5,-.48],this.m.gold,g);
    const ring=this.mesh(new THREE.RingGeometry(.92,1.03,24),this.m.glow,[0,.06,0],g,false,false);ring.rotation.x=-Math.PI/2;
    this.glows.push({obj:ring,baseY:.06,phase:1.7,amp:.07});
    this.chest={type:'chest',x,z,used:false,visual:g,lid,ring,prompt:'OPEN'}; this.interactables.push(this.chest);
  }

  makeFireflies(){
    const n=this.lowPower?28:54, pos=new Float32Array(n*3); this.fireflyBase=[];
    for(let i=0;i<n;i++){
      const x=(Math.random()*46)-23,z=(Math.random()*35)-12,y=.6+Math.random()*3.5;
      pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;this.fireflyBase.push({x,y,z,p:Math.random()*TAU});
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0xffe58a,size:this.mobile ? .11 : .09,sizeAttenuation:true,transparent:true,opacity:.85,depthWrite:false});
    this.fireflies=new THREE.Points(geo,mat);this.scene.add(this.fireflies);
  }

  buildPlayer(){
    const g=new THREE.Group(); this.scene.add(g);
    const body=this.roundBox(.78,1.05,.58,.13,[0,.86,0],this.m.teal,g);
    const head=this.roundBox(.66,.66,.62,.18,[0,1.68,-.02],this.m.skin,g);
    const scarf=this.box(.86,.18,.68,[0,1.35,.05],this.m.cloth,g);
    this.cyl(.34,.43,.48,5,[0,2.13,.08],this.m.cloth,g).rotation.z=.08;
    for(const sx of [-.48,.48]) this.roundBox(.2,.72,.22,.06,[sx,.86,0],this.m.skin,g);
    for(const sx of [-.24,.24]) this.roundBox(.23,.72,.26,.06,[sx,.22,.02],this.m.dark,g);
    this.swordPivot=new THREE.Group(); this.swordPivot.position.set(.63,1.0,-.06);g.add(this.swordPivot);
    this.box(.13,.13,.95,[0,0,-.52],this.m.steel,this.swordPivot);this.box(.44,.12,.14,[0,0,-.02],this.m.gold,this.swordPivot);this.box(.16,.16,.36,[0,0,.2],this.m.wood,this.swordPivot);
    this.shield=this.roundBox(.12,.76,.62,.12,[-.56,.95,.08],this.m.bronze,g);
    this.player={x:0,z:17,y:0,visual:g,hp:60,maxHp:60,level:1,xp:0,xpNext:40,weapon:'Sprigblade',weaponBonus:0,attackCd:0,attackTimer:0,guarding:false,invuln:0,dashCd:0,dashTimer:0,facing:{x:0,z:-1},knockX:0,knockZ:0};
    g.position.set(0,.08,17);
    this.playerParts={body,head,scarf};
  }

  buildEnemyVisual(type){
    const g=new THREE.Group();
    if(type==='mossling'){
      const b=this.mesh(new THREE.IcosahedronGeometry(.62,0),this.m.enemy,[0,.58,0],g); b.scale.y=.72;
      this.box(.13,.15,.07,[-.22,.69,-.52],this.m.dark,g,false);this.box(.13,.15,.07,[.22,.69,-.52],this.m.dark,g,false);
      this.cyl(.2,.34,.32,5,[0,1.05,.03],this.m.leaf2,g);
    }else if(type==='sentry'){
      this.roundBox(1.0,1.25,.8,.13,[0,.72,0],this.m.stone,g);
      this.roundBox(.78,.58,.72,.12,[0,1.58,0],this.m.stoneLight,g);
      this.mesh(new THREE.OctahedronGeometry(.15,0),this.m.ember,[0,1.58,-.39],g,false,false);
      for(const sx of [-.62,.62]) this.box(.27,.95,.28,[sx,.75,0],this.m.stoneDark,g);
    }else{
      this.roundBox(1.8,2.0,1.5,.18,[0,1.25,0],this.m.stoneDark,g);
      this.roundBox(1.55,.92,1.35,.18,[0,2.63,0],this.m.stone,g);
      this.mesh(new THREE.OctahedronGeometry(.24,0),this.m.ember,[0,2.63,-.7],g,false,false);
      for(const sx of [-1.18,1.18]){this.roundBox(.58,1.55,.62,.13,[sx,1.37,0],this.m.stone,g);this.roundBox(.65,.55,.72,.12,[sx,.36,0],this.m.stoneLight,g);}
      this.cyl(.62,.85,.5,8,[0,.17,0],this.m.ember,g,false);
    }
    return g;
  }

  addEnemy(type,x,z,opts={}){
    const defaults=type==='mossling'?{hp:24,speed:2.15,damage:8,xp:14,aggro:7.5,range:1.0}:type==='sentry'?{hp:38,speed:1.35,damage:10,xp:30,aggro:9,range:1.35}:{hp:150,speed:1.65,damage:14,xp:120,aggro:14,range:2.0};
    const e={type,x,z,homeX:x,homeZ:z,visual:this.buildEnemyVisual(type),alive:true,cooldown:1+Math.random(),special:3.5,hp:defaults.hp,maxHp:defaults.hp,...defaults,...opts,knockX:0,knockZ:0,hitFlash:0,phase:Math.random()*TAU};
    e.visual.position.set(x,this.groundY(z),z); this.scene.add(e.visual); this.enemies.push(e); return e;
  }

  spawnEnemies(){
    this.addEnemy('mossling',-8.7,7.2); this.addEnemy('mossling',8.6,5.0); this.addEnemy('mossling',-5.7,-6.8); this.addEnemy('mossling',4.2,-7.6);
    this.addEnemy('mossling',0,-27.2,{hp:28,xp:18});
    this.addEnemy('sentry',-3.6,-37,{tag:'warden'}); this.addEnemy('sentry',3.6,-37,{tag:'warden'});
    this.boss=this.addEnemy('boss',0,-54,{active:false}); this.boss.visual.rotation.y=Math.PI;
  }

  bindInput(){
    addEventListener('keydown',(e)=>{
      this.keys[e.code]=true;
      if(!this.started||this.finished)return;
      if(e.code==='Space'){e.preventDefault();this.attack();}
      if(e.code==='KeyE')this.use();
      if(e.code==='KeyQ')this.dash();
    });
    addEventListener('keyup',(e)=>{this.keys[e.code]=false;});

    const joy=$('#joystick'),knob=$('#joy-knob');
    const updateJoy=(e)=>{
      const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=40,l=Math.max(1,Math.hypot(dx,dy)),k=Math.min(1,max/l);
      const ox=dx*k,oy=dy*k; this.joy.x=ox/max;this.joy.z=oy/max;knob.style.transform=`translate(${ox}px,${oy}px)`;
    };
    joy.addEventListener('pointerdown',(e)=>{this.sound.unlock();this.joy.id=e.pointerId;joy.setPointerCapture(e.pointerId);updateJoy(e);});
    joy.addEventListener('pointermove',(e)=>{if(e.pointerId===this.joy.id)updateJoy(e);});
    const endJoy=(e)=>{if(e.pointerId===this.joy.id){this.joy.id=null;this.joy.x=0;this.joy.z=0;knob.style.transform='translate(0,0)';}};
    joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);

    const atk=$('#btn-attack'),guard=$('#btn-guard'),use=$('#btn-use');
    atk.addEventListener('pointerdown',(e)=>{e.preventDefault();this.sound.unlock();atk.classList.add('pressed');this.attack();});
    ['pointerup','pointercancel','pointerleave'].forEach(n=>atk.addEventListener(n,()=>atk.classList.remove('pressed')));
    guard.addEventListener('pointerdown',(e)=>{e.preventDefault();this.sound.unlock();this.mobileGuard=true;guard.classList.add('pressed');});
    ['pointerup','pointercancel','pointerleave'].forEach(n=>guard.addEventListener(n,()=>{this.mobileGuard=false;guard.classList.remove('pressed');}));
    use.addEventListener('pointerdown',(e)=>{e.preventDefault();this.sound.unlock();use.classList.add('pressed');this.use();});
    ['pointerup','pointercancel','pointerleave'].forEach(n=>use.addEventListener(n,()=>use.classList.remove('pressed')));

    const canvas=this.renderer.domElement;
    canvas.addEventListener('wheel',(e)=>{e.preventDefault();this.cameraZoom=clamp(this.cameraZoom+Math.sign(e.deltaY)*.08,.72,1.34);},{passive:false});
    canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
    canvas.addEventListener('pointerdown',(e)=>{
      if(e.pointerType!=='touch')return; this.sound.unlock(); this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touchPoints.size===2){const a=[...this.touchPoints.values()];this.pinchStart={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom:this.cameraZoom};}
    });
    canvas.addEventListener('pointermove',(e)=>{
      if(!this.touchPoints.has(e.pointerId))return;this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touchPoints.size===2&&this.pinchStart){const a=[...this.touchPoints.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);this.cameraZoom=clamp(this.pinchStart.zoom*(this.pinchStart.d/d),.72,1.34);}
    });
    const drop=(e)=>{this.touchPoints.delete(e.pointerId);if(this.touchPoints.size<2)this.pinchStart=null;};
    canvas.addEventListener('pointerup',drop);canvas.addEventListener('pointercancel',drop);
  }

  resize(){
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    this.renderer?.setSize(innerWidth,innerHeight);
  }

  loop(t){
    const dt=clamp((t-this.lastT)/1000,0,.04);this.lastT=t;this.elapsed+=this.started&&!this.finished?dt:0;
    this.animateWorld(dt,t/1000);
    if(this.started&&!this.finished){this.updatePlayer(dt);this.updateEnemies(dt);this.updateProjectiles(dt);this.updateProgress();}
    this.updateCamera(dt);
    this.uiTick-=dt;if(this.uiTick<=0){this.uiTick=.08;this.updateUI();}
    if(this.renderPipeline)this.renderPipeline.render();else this.renderer.render(this.scene,this.camera);
    this.dynamicResolution(dt);
  }

  animateWorld(dt,time){
    if(this.water){this.water.position.y=this.water.userData.baseY+Math.sin(time*1.2)*.025;this.water.rotation.y+=dt*.035;}
    for(const g of this.glows){g.obj.position.y=g.baseY+Math.sin(time*2+g.phase)*g.amp;g.obj.rotation.z+=dt*.12;}
    if(this.fireflies){const a=this.fireflies.geometry.attributes.position;for(let i=0;i<this.fireflyBase.length;i++){const b=this.fireflyBase[i];a.setXYZ(i,b.x+Math.sin(time*.55+b.p)*.25,b.y+Math.sin(time*1.4+b.p)*.18,b.z+Math.cos(time*.5+b.p)*.25);}a.needsUpdate=true;}
    if(this.gateDoor){const target=this.gateOpen?6.4:this.gateDoor.userData.closedY;this.gateDoor.position.y=lerp(this.gateDoor.position.y,target,1-Math.exp(-dt*2.8));}
    if(this.innerDoor){const target=this.innerOpen?5.7:this.innerDoor.userData.closedY;this.innerDoor.position.y=lerp(this.innerDoor.position.y,target,1-Math.exp(-dt*3.2));}
    for(let i=this.tempFX.length-1;i>=0;i--){const f=this.tempFX[i];f.life-=dt;f.obj.position.x+=f.vx*dt;f.obj.position.z+=f.vz*dt;f.obj.position.y+=f.vy*dt;f.vy-=4*dt;f.obj.scale.multiplyScalar(.97);if(f.life<=0){this.scene.remove(f.obj);this.tempFX.splice(i,1);}}
  }

  inputVector(){
    let x=this.joy.x,z=this.joy.z;
    if(this.keys.KeyA||this.keys.ArrowLeft)x-=1;if(this.keys.KeyD||this.keys.ArrowRight)x+=1;
    if(this.keys.KeyW||this.keys.ArrowUp)z-=1;if(this.keys.KeyS||this.keys.ArrowDown)z+=1;
    const l=len2(x,z);if(l>1){x/=l;z/=l;}return{x,z};
  }

  updatePlayer(dt){
    const p=this.player; p.attackCd=Math.max(0,p.attackCd-dt);p.invuln=Math.max(0,p.invuln-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.attackTimer=Math.max(0,p.attackTimer-dt);p.dashTimer=Math.max(0,p.dashTimer-dt);
    p.guarding=!!(this.keys.ShiftLeft||this.keys.ShiftRight||this.mobileGuard);
    const inp=this.inputVector(); let speed=p.guarding?3.05:5.05;
    if(p.attackTimer>0)speed*=.68;if(p.dashTimer>0)speed=9.2;
    let dx=inp.x,dz=inp.z;if(p.dashTimer>0){dx=p.facing.x;dz=p.facing.z;}
    if((dx||dz)&&p.dashTimer<=0){p.facing.x=dx;p.facing.z=dz;const l=len2(dx,dz);p.facing.x/=l;p.facing.z/=l;}
    dx=dx*speed*dt+p.knockX*dt;dz=dz*speed*dt+p.knockZ*dt;p.knockX*=Math.exp(-dt*8);p.knockZ*=Math.exp(-dt*8);
    const nx=p.x+dx,nz=p.z+dz;if(!this.blocked(nx,p.z))p.x=nx;if(!this.blocked(p.x,nz))p.z=nz;
    p.visual.position.x=p.x;p.visual.position.z=p.z;p.visual.position.y=this.groundY(p.z)+.08;
    const yaw=Math.atan2(-p.facing.x,-p.facing.z);p.visual.rotation.y=lerpAngle(p.visual.rotation.y,yaw,1-Math.exp(-dt*12));
    const stride=Math.min(1,len2(inp.x,inp.z))*Math.sin(this.elapsed*12)*.035;p.visual.position.y+=stride;
    this.swordPivot.visible=true;
    if(p.attackTimer>0){const q=1-p.attackTimer/.28;this.swordPivot.rotation.y=-1.15+q*2.3;this.swordPivot.rotation.z=-.25+Math.sin(q*Math.PI)*.45;}else{this.swordPivot.rotation.y=.25;this.swordPivot.rotation.z=0;}
    this.shield.rotation.z=lerp(this.shield.rotation.z,p.guarding?-.55:0,1-Math.exp(-dt*14));this.shield.position.z=lerp(this.shield.position.z,p.guarding?-.35:.08,1-Math.exp(-dt*14));
    const near=this.findInteractable();if(near!==this.nearby){this.nearby=near;}
  }

  attack(){
    if(!this.started||this.finished)return;const p=this.player;if(p.attackCd>0)return;
    p.attackCd=.42;p.attackTimer=.28;this.sound.tone(190,.08,'sawtooth',.032,1.8);
    const dmg=12+p.weaponBonus+(p.level-1)*1.5;
    for(const e of this.enemies){
      if(!e.alive||e===this.boss&&!this.bossActive)continue;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d>2.15+(e.type==='boss'?.5:0))continue;
      const dot=(dx*p.facing.x+dz*p.facing.z)/(d||1);if(dot<-.18)continue;this.hitEnemy(e,dmg,p.facing.x*3.4,p.facing.z*3.4);
    }
  }

  dash(){
    const p=this.player;if(!this.started||p.dashCd>0||p.guarding)return;p.dashCd=1.05;p.dashTimer=.18;p.invuln=Math.max(p.invuln,.2);this.sound.tone(130,.07,'triangle',.025,1.6);this.burst(p.x,p.z,0xc8d5a2,5,.55);
  }

  use(){
    if(!this.started||this.finished)return;this.sound.unlock();const a=this.findInteractable();if(!a){this.dash();return;}
    if(a.type==='sign'){this.showToast(a.text,4.4);this.sound.tone(520,.06,'triangle',.025,1);return;}
    if(a.type==='chime'&&!a.used){
      a.used=true;this.bells++;a.bell.rotation.z=Math.PI+.45;setTimeout(()=>{if(a.bell)a.bell.rotation.z=Math.PI;},320);a.ring.material=this.m.ember;this.sound.chord([392,523,659]);this.burst(a.x,a.z,0xffdc6a,10,1.25);
      if(this.bells>=3){this.gateOpen=true;this.phase='gate';this.showToast('The three notes join. The mossbound gate rises.',3.7);this.sound.chord([330,440,554,659]);}
      else this.showToast(`${a.name} answers. ${3-this.bells} chime${3-this.bells===1?'':'s'} remain.`,2.4);
      return;
    }
    if(a.type==='chest'&&!a.used){
      if(this.phase==='bells'||this.phase==='gate'){this.showToast('The old lock is cold. The gate must be opened first.',2.2);return;}
      a.used=true;this.chestOpened=true;a.lid.rotation.x=-1.05;a.ring.visible=false;this.player.weapon='Bronzeleaf Edge';this.player.weaponBonus=5;const beforeLevel=this.player.level;this.gainXP(40);if(this.player.level===beforeLevel){this.player.maxHp+=10;this.player.hp=this.player.maxHp;}else this.player.hp=this.player.maxHp;this.phase='wardens';this.checkpoint={x:0,z:-28};this.sound.chord([440,554,659,880]);this.burst(a.x,a.z,0xffa24d,14,1.5);this.showToast('Bronzeleaf Edge acquired · +5 blade power · +1 heart · 40 XP',4.0);return;
    }
    if(a.type==='relic'&&!a.used){a.used=true;this.relicClaimed=true;this.complete();}
  }

  findInteractable(){
    let best=null,bd=2.15;for(const a of this.interactables){if(a.used&&(a.type==='chime'||a.type==='chest'||a.type==='relic'))continue;const d=Math.hypot(this.player.x-a.x,this.player.z-a.z);if(d<bd){bd=d;best=a;}}return best;
  }

  hitEnemy(e,dmg,kx=0,kz=0){
    if(!e.alive)return;e.hp-=dmg;e.knockX+=kx/(e.type==='boss'?4:1);e.knockZ+=kz/(e.type==='boss'?4:1);e.hitFlash=.12;this.burst(e.x,e.z,e.type==='boss'?0xff7549:0xd7e876,6,.7);this.sound.tone(e.type==='boss'?95:150,.055,'square',.02,.75);
    if(e.hp<=0)this.killEnemy(e);
  }

  killEnemy(e){
    if(!e.alive)return;e.alive=false;e.visual.visible=false;this.kills++;this.gainXP(e.xp);this.burst(e.x,e.z,e.type==='boss'?0xff6a3d:0x9ed36a,e.type==='boss'?26:10,e.type==='boss'?2.3:1);
    if(e.tag==='warden'){
      this.wardens++;this.showToast(`Ruin warden broken · ${this.wardens}/2`,2.2);
      if(this.wardens>=2){this.innerOpen=true;this.phase='bossApproach';this.sound.chord([294,392,494]);this.showToast('The inner seal releases. The Ember Warden waits ahead.',3.4);}
    }
    if(e.type==='boss'){
      this.bossActive=false;$('#boss-wrap').classList.add('hidden');this.phase='relic';this.spawnRelic(e.x,e.z);this.sound.chord([262,330,392,523,659]);this.showToast('The Ember Warden falls. Claim the bell-core.',4);
    }else if(Math.random()<.22&&this.player.hp<this.player.maxHp-5){this.player.hp=Math.min(this.player.maxHp,this.player.hp+10);this.showToast('Wild mint restores one heart.',1.5);}
  }

  gainXP(n){
    const p=this.player;p.xp+=n;while(p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=40+(p.level-1)*50;p.maxHp+=10;p.hp=p.maxHp;this.sound.chord([523,659,784]);this.showToast(`Level ${p.level} · +1 heart · blade power increased`,2.8);}
  }

  damagePlayer(amount,sourceX,sourceZ){
    const p=this.player;if(p.invuln>0||this.finished)return;const actual=p.guarding?Math.ceil(amount*.35):amount;p.hp-=actual;p.invuln=p.guarding?.22:.62;
    const dx=p.x-sourceX,dz=p.z-sourceZ,l=Math.hypot(dx,dz)||1;p.knockX+=(dx/l)*(p.guarding?2:5.5);p.knockZ+=(dz/l)*(p.guarding?2:5.5);this.cameraShake=Math.max(this.cameraShake,p.guarding?.12:.3);this.sound.tone(p.guarding?115:70,.11,p.guarding?'triangle':'sawtooth',.04,p.guarding?1.5:.7);
    if(p.hp<=0)this.respawn();
  }

  respawn(){
    const p=this.player;this.deaths++;p.hp=p.maxHp;p.x=this.checkpoint.x;p.z=this.checkpoint.z;p.knockX=p.knockZ=0;p.invuln=2;
    if(this.boss&&this.bossActive){this.boss.alive=true;this.boss.visual.visible=true;this.boss.hp=this.boss.maxHp;this.boss.x=0;this.boss.z=-54;this.boss.visual.position.set(0,this.groundY(-54),-54);}
    this.showToast('The shrine pulls you back. No experience lost.',3.2);this.sound.chord([220,277,330]);
  }

  updateEnemies(dt){
    for(const e of this.enemies){
      if(!e.alive)continue;e.cooldown=Math.max(0,e.cooldown-dt);e.special=Math.max(0,e.special-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);
      if(e===this.boss){this.updateBoss(e,dt);continue;}
      const p=this.player,dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),l=d||1;let vx=0,vz=0;
      if(d<e.aggro){
        if(e.type==='sentry'&&d>2.4){
          if(d>4.6){vx=dx/l*e.speed;vz=dz/l*e.speed;}
          if(e.cooldown<=0){this.fireProjectile(e.x,e.z,dx/l,dz/l,e.tag==='warden'?7.2:6.2,e.damage,0xff704a);e.cooldown=e.tag==='warden'?1.55:2.0;}
        }else if(d>e.range){vx=dx/l*e.speed;vz=dz/l*e.speed;}
        else if(e.cooldown<=0){this.damagePlayer(e.damage,e.x,e.z);e.cooldown=e.type==='mossling'?1.0:1.35;}
      }else{
        const tx=e.homeX+Math.cos(this.elapsed*.55+e.phase)*1.1,tz=e.homeZ+Math.sin(this.elapsed*.5+e.phase)*1.1,dd=Math.hypot(tx-e.x,tz-e.z)||1;vx=(tx-e.x)/dd*e.speed*.28;vz=(tz-e.z)/dd*e.speed*.28;
      }
      vx+=e.knockX;vz+=e.knockZ;e.knockX*=Math.exp(-dt*8);e.knockZ*=Math.exp(-dt*8);
      e.x+=vx*dt;e.z+=vz*dt;
      if(e.z<-23){e.x=clamp(e.x,-7.1,7.1);e.z=clamp(e.z,-61,-24.2);} else {e.x=clamp(e.x,-26,26);e.z=clamp(e.z,-17,23);}
      e.visual.position.set(e.x,this.groundY(e.z)+Math.sin(this.elapsed*3+e.phase)*.03,e.z);if(d<e.aggro)e.visual.rotation.y=Math.atan2(-dx,-dz);
      const s=e.hitFlash>0?1.09:1;e.visual.scale.setScalar(lerp(e.visual.scale.x,s,.45));
    }
  }

  updateBoss(e,dt){
    if(!this.bossActive){e.visual.position.y=this.groundY(e.z)+Math.sin(this.elapsed*1.4)*.04;return;}
    const p=this.player,dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),l=d||1;
    if(e.telegraph){
      e.telegraph-=dt;e.visual.rotation.y+=dt*2.4;
      if(e.telegraph<=0){if(d<3.0)this.damagePlayer(16,e.x,e.z);this.burst(e.x,e.z,0xff7a45,18,1.9);this.cameraShake=.45;e.cooldown=1.1;}
    }else if(e.special<=0){
      for(let i=0;i<8;i++){const a=i/8*TAU;this.fireProjectile(e.x,e.z,Math.cos(a),Math.sin(a),5.2,10,0xff6e42);}e.special=5.4;this.sound.tone(82,.2,'sawtooth',.05,.6);this.cameraShake=.18;
    }else if(d>2.15){e.x+=dx/l*e.speed*dt;e.z+=dz/l*e.speed*dt;}
    else if(e.cooldown<=0){e.telegraph=.58;e.cooldown=2.1;this.sound.tone(92,.42,'triangle',.035,.55);}
    e.x=clamp(e.x,-6.5,6.5);e.z=clamp(e.z,-60,-46);e.visual.position.set(e.x,this.groundY(e.z),e.z);e.visual.rotation.y=Math.atan2(-dx,-dz);
  }

  fireProjectile(x,z,dx,dz,speed,damage,color){
    const mat=new THREE.MeshBasicMaterial({color});const obj=this.mesh(new THREE.OctahedronGeometry(.19,0),mat,[x,this.groundY(z)+.8,z],this.scene,false,false);obj.scale.z=1.5;this.projectiles.push({x,z,dx,dz,speed,damage,obj,life:4});
  }

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){const b=this.projectiles[i];b.life-=dt;b.x+=b.dx*b.speed*dt;b.z+=b.dz*b.speed*dt;b.obj.position.set(b.x,this.groundY(b.z)+.72+Math.sin(this.elapsed*10)*.05,b.z);b.obj.rotation.x+=dt*7;b.obj.rotation.z+=dt*5;
      if(Math.hypot(b.x-this.player.x,b.z-this.player.z)<.62){this.damagePlayer(b.damage,b.x,b.z);this.scene.remove(b.obj);this.projectiles.splice(i,1);continue;}
      if(b.life<=0||Math.abs(b.x)>30||b.z>28||b.z<-66){this.scene.remove(b.obj);this.projectiles.splice(i,1);}
    }
  }

  updateProgress(){
    const p=this.player;
    if(this.phase==='gate'&&p.z<-24.3){this.phase='chest';this.checkpoint={x:0,z:-25.5};this.showToast('Below the gate, a forged blade waits in the first chamber.',3.2);}
    if(this.phase==='bossApproach'&&p.z<-46){this.phase='boss';this.bossActive=true;this.boss.active=true;$('#boss-wrap').classList.remove('hidden');this.checkpoint={x:0,z:-46.8};this.showToast('EMBER WARDEN',2.0);this.sound.tone(73,.5,'sawtooth',.06,.8);}
  }

  spawnRelic(x,z){
    const g=new THREE.Group();g.position.set(x,this.groundY(z)+.45,z);this.scene.add(g);
    this.mesh(new THREE.TorusGeometry(.5,.14,6,12),this.m.gold,[0,.65,0],g,false,false).rotation.x=Math.PI/2;
    const core=this.mesh(new THREE.OctahedronGeometry(.38,0),this.m.ember,[0,.65,0],g,false,false);this.glows.push({obj:g,baseY:this.groundY(z)+.45,phase:0,amp:.16});
    const relic={type:'relic',x,z,visual:g,core,used:false,prompt:'CLAIM'};this.interactables.push(relic);this.relic=relic;
  }

  burst(x,z,color,count=8,power=1){
    for(let i=0;i<count;i++){
      const mat=new THREE.MeshBasicMaterial({color});const obj=this.mesh(new THREE.TetrahedronGeometry(.07+Math.random()*.08,0),mat,[x,this.groundY(z)+.7,z],this.scene,false,false);const a=Math.random()*TAU,s=(.5+Math.random())*power;this.tempFX.push({obj,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:1+Math.random()*2*power,life:.45+Math.random()*.45});
    }
  }

  updateCamera(dt){
    const p=this.player,zoom=this.cameraZoom;const mobileLift=this.mobile?1.12:1;
    const desired=new THREE.Vector3(p.x,(12.2*zoom)*mobileLift+this.groundY(p.z),p.z+11.6*zoom);
    const target=new THREE.Vector3(p.x,this.groundY(p.z)+.65,p.z-1.35);
    const k=1-Math.exp(-dt*6.5);this.camera.position.lerp(desired,k);this.cameraTarget.lerp(target,1-Math.exp(-dt*8));
    if(this.cameraShake>0){this.camera.position.x+=(Math.random()-.5)*this.cameraShake;this.camera.position.y+=(Math.random()-.5)*this.cameraShake;this.cameraShake=Math.max(0,this.cameraShake-dt*1.8);}
    this.camera.lookAt(this.cameraTarget);
  }

  updateUI(force=false){
    const p=this.player,maxHearts=Math.ceil(p.maxHp/10),hearts=$('#hearts');let html='';for(let i=0;i<maxHearts;i++)html+=`<span class="heart ${p.hp>i*10?'on':''}">◆</span>`;if(force||hearts.innerHTML!==html)hearts.innerHTML=html;
    $('#level').textContent=p.level;$('#xp-text').textContent=`${Math.floor(p.xp)} / ${p.xpNext} XP`;$('#xp-fill').style.width=`${clamp(p.xp/p.xpNext*100,0,100)}%`;$('#gear').textContent=`${p.weapon} · Barkguard`;
    let title='',sub='';
    if(this.phase==='bells'){title='Awaken the meadow chimes';sub=`${this.bells} / 3`;}else if(this.phase==='gate'){title='Enter the Mossbound Gate';sub='The northern gate is open';}
    else if(this.phase==='chest'){title='Claim the relic-forged blade';sub='A chest glows in the first chamber';}else if(this.phase==='wardens'){title='Break the two ruin wardens';sub=`${this.wardens} / 2`;}
    else if(this.phase==='bossApproach'){title='Enter the Ember Warden hall';sub='The inner seal is open';}else if(this.phase==='boss'){title='Defeat the Ember Warden';sub='Guard the slam · punish the recovery';}
    else if(this.phase==='relic'){title='Claim the Ember Bell';sub='The guardian is broken';}else{title='Shrine restored';sub='Mission complete';}
    $('#objective').textContent=title;$('#objective-sub').textContent=sub;
    if(this.boss&&this.boss.alive)$('#boss-fill').style.width=`${clamp(this.boss.hp/this.boss.maxHp*100,0,100)}%`;
    const prompt=$('#prompt');if(this.nearby){prompt.textContent=this.nearby.prompt;prompt.classList.remove('hidden');$('#btn-use').textContent='USE';}else{prompt.classList.add('hidden');$('#btn-use').textContent='DASH';}
    if(this.toastTimer>0){this.toastTimer-=.08;if(this.toastTimer<=0)$('#toast').classList.add('hidden');}
    if(this.hintTimer>0){this.hintTimer-=.08;if(this.hintTimer<=0)$('#hint').classList.add('hidden');}
  }

  showToast(text,seconds=2.4){const el=$('#toast');el.textContent=text;el.classList.remove('hidden');this.toastTimer=seconds;}
  showHint(text,seconds=3){const el=$('#hint');el.textContent=text;el.classList.remove('hidden');this.hintTimer=seconds;}

  dynamicResolution(dt){
    if(!this.started)return;this.fpsFrames++;this.fpsTime+=dt;if(this.fpsFrames<150)return;const fps=this.fpsFrames/this.fpsTime;this.fpsFrames=0;this.fpsTime=0;
    const cap=this.mobile?1.45:2;let next=this.pixelRatio;if(fps<43)next=Math.max(.85,next-.15);else if(fps>58)next=Math.min(cap,next+.08);if(Math.abs(next-this.pixelRatio)>.03){this.pixelRatio=next;this.renderer.setPixelRatio(next);this.renderer.setSize(innerWidth,innerHeight);}
  }

  complete(){
    if(this.finished)return;this.finished=true;this.phase='done';this.sound.chord([330,392,494,659,784]);$('#boss-wrap').classList.add('hidden');$('#prompt').classList.add('hidden');
    const min=Math.floor(this.elapsed/60),sec=Math.floor(this.elapsed%60).toString().padStart(2,'0');$('#complete-stats').textContent=`Time ${min}:${sec} · Level ${this.player.level} · ${this.kills} enemies broken · ${this.deaths} shrine returns. The Ember Bell is awake.`;$('#complete').classList.remove('hidden');
  }
}

function lerpAngle(a,b,t){let d=(b-a+Math.PI)%TAU-Math.PI;return a+d*t;}

export async function mountGame(options){const g=new MossbellGame(options);await g.init();return {start:()=>g.start(),rendererLabel:g.rendererLabel,game:g};}
