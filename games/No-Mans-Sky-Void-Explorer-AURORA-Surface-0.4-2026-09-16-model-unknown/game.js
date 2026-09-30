/* VOID EXPLORER — AURORA / Surface 0.4, on the shared 3D stack.
   Flight, catalogs, surface operations, crew and ship are the original game (BOUNDLESS 0.4).
   render.js draws with three.js r186 (WebGPU, WebGL2 fallback); world.js holds the world math.
   Every device reaches the game through kit.input actions. World units: kilometres. */
import { boot } from 'kit/boot.js';
import { V, Q, clamp, mix, smooth, hashString, rng, noise, rawHeight, heightAt, terrainColor, MeshBuilder, parseAurora } from './world.js';
import { ThreeRenderer } from './render.js';

const $=id=>document.getElementById(id);
const TEST_MODE=globalThis.__BOUNDLESS_TEST__===true||new URLSearchParams(location.search).has('test');

/* Actions, not devices. Flight and walking share the left stick and the touch stick;
   the keyboard keeps the original layout (W/S thrust, arrows steer, A/D roll, WASD walk). */
const INPUT_ACTIONS={
  stick:{type:'vector',gamepad:'leftStick',touch:'stick'},
  arrows:{type:'vector',keys:'arrows',gamepad:[]},
  walk:{type:'vector',keys:'wasd',gamepad:[]},
  nav:{type:'vector',gamepad:'dpad+leftStick'},
  look:{type:'look',mouse:'drag',gamepad:'rightStick',touch:'drag'},
  throttle:{type:'axis',keys:{pos:['KeyW'],neg:['KeyS']},gamepad:{pos:'RT',neg:'LT'},touch:{pos:'Thr +',neg:'Thr −'}},
  roll:{type:'axis',keys:{pos:['KeyA'],neg:['KeyD']},gamepad:{pos:'LB',neg:'RB'}},
  strafe:{type:'axis',keys:{pos:['KeyE'],neg:['KeyQ']}},
  boost:{keys:['ShiftLeft','ShiftRight'],gamepad:['A'],touch:'Boost'},
  brake:{keys:['KeyX'],gamepad:['B'],touch:'Brake'},
  drift:{keys:['Space'],gamepad:['LS']},
  transfer:{keys:['KeyF','KeyJ'],gamepad:['Y'],touch:'Go'},
  interact:{keys:['KeyE'],gamepad:['X'],touch:'Use'},
  descend:{keys:['KeyG'],gamepad:['Up']},
  target:{keys:['KeyT'],gamepad:['X'],touch:{label:'Aim',slot:'top'}},
  next:{keys:['Tab'],gamepad:['Right']},
  prev:{gamepad:['Left']},
  land:{keys:['KeyL'],gamepad:['Down'],touch:{label:'Land',slot:'top'}},
  takeoff:{keys:['KeyU'],gamepad:['Up'],touch:{label:'Lift',slot:'top'}},
  gear:{keys:['KeyK'],gamepad:['RS']},
  ramp:{keys:['KeyR'],gamepad:['Y'],touch:'Ramp'},
  map:{keys:['KeyM'],gamepad:['Back'],touch:{label:'Map',slot:'top'}},
  system:{keys:['KeyC']},
  help:{keys:['KeyH']},
  log:{keys:['KeyN']},
  bay:{keys:['KeyB']},
  photo:{keys:['KeyO']},
  hud:{keys:['KeyV']},
  pause:{keys:['Escape','KeyP'],gamepad:['Start'],touch:{label:'II',slot:'top'}},
  confirm:{gamepad:['A']},
  back:{gamepad:['B']},
};

const kit=await boot({
  title:'Void Explorer',
  accent:'#ff7854',
  background:'#080610',
  // Kilometre-scale space and centimetre-scale boots share one depth buffer.
  renderer:{logarithmicDepthBuffer:true},
  gear:'none', // the game's own Settings panel opens the kit settings
  touch:{top:'right',topOffset:76}, // the pill row sits under the header's icon buttons
  input:INPUT_ACTIONS,
});
const canvas=kit.canvas;
canvas.setAttribute('aria-label','3D flight view. Drag to steer, or use the arrow keys, a gamepad or the touch stick. Press H for controls.');
kit.loading.progress(.7,'Loading AURORA…');
$('error-retry').onclick=()=>location.reload();
let AuroraAsset;
try{
  const response=await fetch(new URL('./aurora.glb',import.meta.url));
  if(!response.ok)throw Error('The AURORA model could not be downloaded ('+response.status+').');
  AuroraAsset=parseAurora(await response.arrayBuffer());
}catch(e){
  // The kit's loading card would cover the game's own error panel: take it down first.
  kit.loading.done();$('error-text').textContent=e.message;$('error').style.display='flex';
  throw e;
}
kit.loading.progress(.85,'Building the universe…');
const R=new ThreeRenderer(kit,AuroraAsset);
initAuroraGeometry(R);
const gameQuality=()=>({low:.6,medium:.8})[kit.tier.name]??1;
/** Text writes that skip the DOM when nothing changed (the HUD refreshes every frame). */
const textCache=new Map();
function txt(id,value){const v=String(value);if(textCache.get(id)===v)return;textCache.set(id,v);const el=$(id);if(el)el.textContent=v}

/* ---- AURORA drawing helpers (the renderer API is render.js). */
function auroraExhaustGeometry(){const b=new MeshBuilder();for(const s of AuroraAsset.sockets){let [x,y,z]=s.position;for(let k=0;k<12;k++){const a=k*Math.PI/6,c=(k+1)*Math.PI/6,point=t=>[x+Math.cos(t)*s.radius,y+Math.sin(t)*s.radius,z];b.tri(point(a),point(c),[x,y,z+8],[.04,.68,1]);const n=b.data.length;b.data[n-3]=.002;b.data[n-2]=.011;b.data[n-1]=.035;}}return b.data}
function initAuroraGeometry(renderer){renderer.shipParts=AuroraAsset.groups.map(g=>({mesh:renderer.mesh(g.data),material:g.material}));renderer.ship=renderer.shipParts[0].mesh;renderer.exhaust=renderer.mesh(auroraExhaustGeometry())}
function drawAurora(renderer,world,rotation,style='materials',options={}){
 for(const p of renderer.shipParts){const m=p.material,idle=options.idle&&m.emission;renderer.draw(p.mesh,world,{rotation,scale:options.scale??1,kind:style==='silhouette'?9:m.emission?2:m.canopy?7:6,emission:style==='silhouette'?0:idle?.015:m.emission||.065,color:idle?[.07,.12,.14]:[1,1,1],roughness:m.roughness,metallic:m.metallic,fog:false,hatch:options.hatch||0})}
}
function auroraDrive(renderer,world,q,speed,boost=0,showPlume=true,scale=1,power=1){
 const rotation=renderer.rotation(q),stretch=.14+clamp(speed/1000,0,1)*1.8+boost*.9;
 if(showPlume&&power>0){const r=rotation.map(x=>x*scale);r[6]*=stretch;r[7]*=stretch;r[8]*=stretch;const nozzleZ=AuroraAsset.sockets[0].position[2],anchor=V.add(world,Q.rot([0,0,nozzleZ*(1-stretch)*scale],q));renderer.draw(renderer.exhaust,anchor,{rotation:r,kind:2,emission:1.5,alpha:.65*power,additive:true,fog:false})}
 const points=[];for(const socket of AuroraAsset.sockets){const p=V.add(world,Q.rot(V.mul(socket.position,scale),q)),size=scale===1?19+boost*9:clamp(socket.radius*scale/Math.max(V.dist(p,renderer.cam.pos),.0001)*innerHeight/renderer.tan*3,1,40);points.push(...V.sub(p,renderer.cam.pos),.04,.70,1,size)}
 if(power>.01)renderer.points(points,.22*power);
 const lights=[];for(const tip of AuroraAsset.tips){const p=V.add(world,Q.rot(V.mul(tip.position,scale),q));lights.push(...V.sub(p,renderer.cam.pos),1,.025,.34,scale===1?9:clamp(.12*scale/Math.max(V.dist(p,renderer.cam.pos),.0001)*innerHeight/renderer.tan*2,1,10))}renderer.points(lights,.22);
}

/* Surface rendering. World positions remain in kilometres. Asset positions are metres.
   Local terrain uses heightAt; no terrain is flattened for the landing site. */
const SurfaceShapes = {
  gearRoots: [[0,-.72,-3.35],[-1.82,-.69,2.3],[1.82,-.69,2.3]],
  gearFeet: [[0,-3.05,-3.55],[-2.05,-3.05,2.65],[2.05,-3.05,2.65]],
  rampStart: [0,-1.28,1.15], rampEndZ: 7.05, rampWidth: 1.22,
  corridorStart: .40, eyeHeight: 1.72,
};
function terrainPoint(p, world) {
  const n=V.norm(V.sub(world,p.pos));
  return V.add(p.pos,V.mul(n,p.radius+heightAt(n,p)));
}
function terrainNormal(p,world) {
  const n=V.norm(V.sub(world,p.pos));
  let right=V.norm(V.cross(Math.abs(n[1])<.9?[0,1,0]:[1,0,0],n));
  const front=V.cross(n,right),c=terrainPoint(p,world),epsilon=.002;
  const a=V.sub(terrainPoint(p,V.add(c,V.mul(right,epsilon))),terrainPoint(p,V.add(c,V.mul(right,-epsilon))));
  const b=V.sub(terrainPoint(p,V.add(c,V.mul(front,epsilon))),terrainPoint(p,V.add(c,V.mul(front,-epsilon))));
  let normal=V.norm(V.cross(a,b));if(V.dot(n,normal)<0)normal=V.mul(normal,-1);
  return normal;
}
function terrainSlope(p,world){return Math.acos(clamp(V.dot(terrainNormal(p,world),V.norm(V.sub(world,p.pos))),-1,1))*180/Math.PI;}
function terrainLOD(p,camera,quality) {
  const n=V.norm(V.sub(camera,p.pos)),h=(V.dist(camera,p.pos)-p.radius-heightAt(n,p))/p.radius;
  let detail=16,morph=1;
  if(h<3.2){detail=32;morph=1-smooth(1.6,3.2,h)}
  if(h<.60){detail=64;morph=1-smooth(.18,.60,h)}
  if(quality>=1&&h<.16){detail=128;morph=1-smooth(.04,.16,h)}
  return {detail,morph};
}
function cubeDirection(face,u,v){return V.norm(face===0?[1,v,-u]:face===1?[-1,v,u]:face===2?[u,1,-v]:face===3?[u,-1,v]:face===4?[u,v,1]:[-u,v,-1]);}
/* Intersect a ray with the exact morphed parent triangle. This makes the outer
   edge of a local patch meet the whole-planet mesh, including during LOD changes. */
function coarseTerrainRadius(p,n,res,morph) {
  const ax=n.map(Math.abs);let f,u,v;
  if(ax[0]>=ax[1]&&ax[0]>=ax[2]){f=n[0]>=0?0:1;u=(f===0?-n[2]:n[2])/ax[0];v=n[1]/ax[0]}
  else if(ax[1]>=ax[2]){f=n[1]>=0?2:3;u=n[0]/ax[1];v=(f===2?-n[2]:n[2])/ax[1]}
  else{f=n[2]>=0?4:5;u=(f===4?n[0]:-n[0])/ax[2];v=n[1]/ax[2]}
  const gx=(u+1)*res*.5,gy=(v+1)*res*.5,x=clamp(Math.floor(gx),0,res-1),y=clamp(Math.floor(gy),0,res-1);
  const xy=gy-y>gx-x?[[x,y],[x+1,y+1],[x,y+1]]:[[x,y],[x+1,y],[x+1,y+1]];
  const at=(a,b)=>{const d=cubeDirection(f,a/res*2-1,b/res*2-1);return V.mul(d,p.radius+heightAt(d,p))};
  const cx=Math.floor(x/2)*2,cy=Math.floor(y/2)*2,center=xy.reduce((s,t)=>[s[0]+t[0]/3,s[1]+t[1]/3],[0,0]);
  const upper=center[1]-cy>center[0]-cx,pv=upper?[at(cx,cy),at(cx+2,cy+2),at(cx,cy+2)]:[at(cx,cy),at(cx+2,cy),at(cx+2,cy+2)];
  const vertices=xy.map(([a,b])=>{const U=(a-cx)/2,W=(b-cy)/2,w=upper?[1-W,U,W-U]:[1-U,U-W,W];const parent=pv.reduce((s,t,i)=>V.add(s,V.mul(t,w[i])),[0,0,0]);return V.mix(parent,at(a,b),morph)});
  const normal=V.cross(V.sub(vertices[1],vertices[0]),V.sub(vertices[2],vertices[0]));
  return V.dot(vertices[0],normal)/V.dot(n,normal);
}
function buildGroundPatch(p,center,detail,morph,radius=42,settle=1) {
  const radial=V.norm(V.sub(center,p.pos)),east=V.norm(V.cross(Math.abs(radial[1])<.9?[0,1,0]:[1,0,0],radial)),north=V.cross(radial,east);
  const base=V.sub(center,p.pos),angles=96,rings=[0,.002,.004,.008,.016,.032,.064,.128,.256,.512,1,2,3.5,5.5,8,12,17,23,29,34,39,43,48];
  const grid=[],out=[];let maxInnerError=0;
  for(const r of rings){let row=[];for(let j=0;j<angles;j++){
    const a=j/angles*Math.PI*2,d=V.norm(V.add(base,V.add(V.mul(east,Math.cos(a)*r),V.mul(north,Math.sin(a)*r))));
    const h=heightAt(d,p),physical=p.radius+h,parent=coarseTerrainRadius(p,d,detail,morph);
    const edge=smooth(radius*.67,radius*.96,r);const point=V.mul(d,mix(parent,physical,(1-edge)*settle));
    const position=V.sub(point,base);let color=terrainColor(d,p,h);
    if(r<2){const grain=noise(point[0]*6,point[1]*6,point[2]*6,p.seed+57);color=V.mul(color,.96+grain*.06)}
    row.push({position,h,color});if(r<.128)maxInnerError=Math.max(maxInnerError,Math.abs(V.len(point)-physical));
  }grid.push(row)}
  function tri(a,b,c){let normal=V.norm(V.cross(V.sub(b.position,a.position),V.sub(c.position,a.position)));if(V.dot(normal,radial)<0)normal=V.mul(normal,-1);const color=V.mul(V.add(V.add(a.color,b.color),c.color),1/3);for(const v of [a,b,c])out.push(...v.position,...normal,...color,...v.position,...normal,...color,v.h/p.radius,v.h/p.radius)}
  for(let i=1;i<rings.length;i++)for(let j=0;j<angles;j++){const k=(j+1)%angles;if(i===1)tri(grid[0][0],grid[i][j],grid[i][k]);else{tri(grid[i-1][j],grid[i][j],grid[i][k]);tri(grid[i-1][j],grid[i][k],grid[i-1][k])}}
  return {data:new Float32Array(out),radius,center:center.slice(),maxInnerError};
}
function drawGroundPatch(renderer,p,center){
  const lod=terrainLOD(p,renderer.cam.pos,renderer.quality),old=renderer.groundPatch;
  const settle=renderer.env.patch?.settle??1;
  const key=p.id+':'+lod.detail+':'+lod.morph.toFixed(3)+':'+settle.toFixed(3);
  if(!old||old.key!==key||V.dist(center,old.center)>.020){
    if(old)renderer.freeMesh(old.mesh);
    const patch=buildGroundPatch(p,center,lod.detail,lod.morph,42,settle);patch.mesh=renderer.mesh(patch.data,true);delete patch.data;patch.key=key;renderer.groundPatch=patch;
  }
  const patch=renderer.groundPatch;
  renderer.draw(patch.mesh,patch.center,{kind:10,planet:p,sun:renderer.env.sun});
}
function surfacePrimitives(renderer){
  if(renderer.surfacePrimitives)return renderer.surfacePrimitives;
  const white=[1,1,1],box=new MeshBuilder().box([0,0,0],[1,1,1],white);
  return renderer.surfacePrimitives={box:renderer.mesh(box.data)};
}
function drawSurfaceModules(renderer,world,q,scale,gear,ramp,feetY,rampY=-3.05){
  const mesh=surfacePrimitives(renderer).box,ivory=[.86,.81,.70],indigo=[.09,.15,.26],metal=[.38,.48,.58],cyan=[.02,.60,.64];
  const worldPoint=p=>V.add(world,Q.rot(V.mul(p,scale),q));
  function box(c,size,color,kind=6,localRot=null){const columns=localRot||[1,0,0,0,1,0,0,0,1],rotation=[];for(let i=0;i<3;i++)rotation.push(...Q.rot(V.mul(columns.slice(i*3,i*3+3),size[i]*scale),q));renderer.draw(mesh,worldPoint(c),{rotation,color,kind,roughness:.48,metallic:.35,fog:false,emission:kind===2?.18:0})}
  function strut(a,b,width,color){const y=V.norm(V.sub(b,a)),x=V.norm(V.cross(Math.abs(y[2])<.85?[0,0,1]:[1,0,0],y)),z=V.cross(x,y);box(V.mul(V.add(a,b),.5),[width,V.dist(a,b),width],color,6,[...x,...y,...z])}
  const t=smooth(0,1,gear);
  for(let i=0;i<3;i++){
    const root=SurfaceShapes.gearRoots[i],foot=SurfaceShapes.gearFeet[i].slice();foot[1]=feetY?.[i]??-3.05;
    box(V.add(root,[0,-.025,0]),[.55,.16,.72],indigo);
    if(t<.006){box(V.add(root,[0,-.10,0]),[.52,.055,.65],ivory);continue}
    const deployed=V.mix(V.add(root,[0,-.08,.20]),foot,t),knee=V.mix(root,V.mix(root,foot,.57),t);knee[2]+=.33*t;
    strut(root,knee,.18,ivory);strut(knee,deployed,.10,metal);
    strut(V.add(root,[.16,0,-.20]),V.mix(knee,deployed,.52),.065,indigo);
    box(deployed,[.66,.13,.85],indigo);box(V.add(deployed,[0,.083,0]),[.54,.04,.66],metal);
    box(V.add(knee,[0,.01,-.10]),[.12,.26,.035],cyan,2);
  }
  // The aft belly hatch opens as two leaves. No wing is used as a ramp.
  if(ramp<.002){box([0,-.94,2.62],[1.24,.055,3.08],indigo);return}
  const opening=smooth(0,1,ramp);
  for(const side of [-1,1])box([side*(.32+.52*opening),-.94,2.62],[.60,.075,3.08],ivory);
  box([0,-1.33,.60],[1.28,.10,1.22],indigo);
  box([0,-1.272,.60],[1.12,.024,1.12],metal);
  for(const side of [-1,1]){
    box([side*.67,-.57,.65],[.085,1.43,1.23],indigo);
    box([side*.598,-1.24,.70],[.026,.020,1.04],cyan,2);
  }
  box([0,-.48,.02],[1.32,1.6,.08],indigo);
  const start=SurfaceShapes.rampStart,fullEnd=[0,rampY+.07,SurfaceShapes.rampEndZ];
  const end=V.mix([0,-1.28,2.30],fullEnd,opening),z=V.norm(V.sub(end,start)),x=[1,0,0],y=V.cross(z,x);
  box(V.mul(V.add(start,end),.5),[1.22,.10,V.dist(start,end)],indigo,6,[...x,...y,...z]);
  for(let i=0;i<14;i++){const at=V.add(V.mix(start,end,(i+.5)/14),V.mul(y,.058));box(at,[1.06,.018,.055],i%4===0?ivory:metal,6,[...x,...y,...z])}
  for(const side of [-1,1]){
    const a=V.add(start,[side*.62,.08,0]),b=V.add(end,[side*.62,.08,0]);strut(a,b,.045,cyan);
    for(const u of [.12,.88]){const s=V.mix(a,b,u);strut(s,V.add(s,[0,.62*opening,0]),.035,metal)}
    strut(V.add(V.mix(a,b,.12),[0,.62*opening,0]),V.add(V.mix(a,b,.88),[0,.62*opening,0]),.032,metal);
  }
}
/* A seeded surface scatter supplies scale, not a second terrain surface.
   Rock locations and collision radii are generated once per landing site. */
function buildSurfaceScatter(site){
  const p=site.planet,random=rng(hashString(p.id+':'+site.normal.map(n=>n.toFixed(5)).join(':'))),rocks=[],builder=new MeshBuilder();
  const right=Q.rot([1,0,0],site.q),front=Q.rot([0,0,1],site.q),up=Q.rot([0,1,0],site.q);
  for(let i=0;i<160;i++){
    const a=random()*Math.PI*2,range=10+Math.sqrt(random())*100,offset=V.add(V.mul(right,Math.cos(a)*range*.001),V.mul(front,Math.sin(a)*range*.001));
    const base=terrainPoint(p,V.add(site.ground,offset)),rad=(.18+Math.pow(random(),3)*1.05)*.001;
    if(rawHeight(V.norm(V.sub(base,p.pos)),p)<=0||terrainSlope(p,base)>35)continue;
    rocks.push({center:base,radius:rad*.94,height:rad*1.7});
    const color=V.mix(p.palette.land,[.48,.49,.49],.38+random()*.18),vertices=[];
    const local=V.sub(base,site.ground),height=rad*(.5+random()*1.3);
    for(let j=0;j<6;j++){const angle=j*Math.PI/3;vertices.push(V.add(local,V.add(V.mul(right,Math.cos(angle)*rad),V.mul(front,Math.sin(angle)*rad))))}
    const top=V.add(local,V.mul(up,height));
    for(let j=0;j<6;j++)builder.tri(vertices[j],vertices[(j+1)%6],top,V.mul(color,.8+random()*.25));
  }
  return {rocks,data:new Float32Array(builder.data)};
}
function drawSurfaceScatter(renderer,site){
  if(renderer.scatterSite!==site){if(renderer.scatterMesh)renderer.freeMesh(renderer.scatterMesh);renderer.scatterMesh=renderer.mesh(site.scatter.data);renderer.scatterSite=site}
  renderer.draw(renderer.scatterMesh,site.ground,{kind:6,roughness:.95,metallic:0,fog:true,sun:renderer.env.sun});
}
function drawLandingShadow(renderer,site,opacity=1){
  if(renderer.shadowSite!==site){
    for(const m of renderer.groundShadows||[])renderer.freeMesh(m);
    renderer.groundShadows=[];
    for(let layer=0;layer<3;layer++){
      const b=new MeshBuilder(),color=[.012,.018,.037],r=1-layer*.23;
      const point=(x,z)=>{const guess=V.add(site.ground,Q.rot([x*.001,0,z*.001],site.q));return V.sub(V.add(terrainPoint(site.planet,guess),V.mul(terrainNormal(site.planet,guess),.000012+layer*.000005)),site.ground)};
      const center=point(0,0);
      for(let j=0;j<48;j++){const a=j/48*Math.PI*2,c=(j+1)/48*Math.PI*2;b.tri(center,point(Math.cos(a)*5.2*r,Math.sin(a)*6*r),point(Math.cos(c)*5.2*r,Math.sin(c)*6*r),color)}
      renderer.groundShadows.push(renderer.mesh(b.data));
    }renderer.shadowSite=site;
  }
  for(const mesh of renderer.groundShadows)renderer.draw(mesh,site.ground,{kind:2,emission:0,alpha:.14*opacity,fog:false});
}

/* BOUNDLESS — procedural universe, flight simulation, navigation, and interface. */
const PALETTES=[
 {water:[.035,.49,.57],land:[.17,.095,.24],peak:[.58,.32,.44],air:[.08,.66,1],name:'OCEAN WORLD'},
 {water:[.14,.21,.42],land:[.35,.12,.45],peak:[.73,.44,.75],air:[.54,.27,1],name:'VIOLET WORLD'},
 {water:[.045,.34,.43],land:[.40,.25,.37],peak:[.96,.55,.37],air:[.26,.62,.86],name:'RIDGE WORLD'},
 {water:[.18,.15,.35],land:[.38,.30,.49],peak:[.67,.70,.82],air:[.46,.51,1],name:'FROST WORLD'},
 {water:[.07,.38,.35],land:[.17,.22,.27],peak:[.53,.66,.56],air:[.15,.81,.70],name:'JADE WORLD'}
];
const SECTOR=520000, HOME='0:0:0:0', ASTER='0:0:-1:0', starCache=new Map(),systemCache=new Map();
const prefixes=['Astra','Nacre','Vela','Cinder','Halcyon','Oris','Lumen','Sable','Aven','Solis','Eris','Echo','Iris','Mora','Zenith','Sora','Aster','Elara','Cael','Mirra'];
function makeStar(id){if(starCache.has(id))return starCache.get(id);let [x,y,z,k]=id.split(':').map(Number),seed=hashString(id+':boundless:42'),r=rng(seed),pos=[(x+r()*.84-.42)*SECTOR,(y+r()*.84-.42)*SECTOR,(z+r()*.84-.42)*SECTOR];if(V.len(pos)<105000)pos[2]-=135000;let col=[[.57,.8,1],[1,.59,.48],[.85,.71,1],[.73,.96,1]][Math.floor(r()*4)],name=prefixes[Math.floor(r()*prefixes.length)]+' '+(10+Math.floor(r()*89)),s={kind:'star',id,seed,pos,color:col,name,radius:950+r()*1100,cell:[x,y,z]};if(id===HOME)Object.assign(s,{name:'Solace',pos:[9600,8300,-26000],radius:1350,color:[1,.65,.37]});if(id===ASTER)Object.assign(s,{name:'Aster',pos:[-82000,14000,-460000],radius:1650,color:[.60,.77,1]});starCache.set(id,s);return s}
function getSystem(star){if(systemCache.has(star.id))return systemCache.get(star.id);let r=rng(star.seed),ps=[],count=4+Math.floor(r()*3);for(let i=0;i<count;i++){let a=r()*Math.PI*2,rad=9000+i*6600+r()*3000;let pos=V.add(star.pos,[Math.cos(a)*rad,(r()-.5)*6000,Math.sin(a)*rad]);let p={kind:'planet',id:star.id+'/p'+i,systemId:star.id,name:prefixes[Math.floor(r()*prefixes.length)]+' '+['I','II','III','IV','V','VI'][i],seed:hashString(star.id+':planet'+i),radius:630+r()*900,pos,palette:PALETTES[Math.floor(r()*PALETTES.length)],rings:i===2&&r()>.25};ps.push(p)}
 if(star.id===HOME){const defs=[['Veya',[650,-990,-2150],1300,0,false],['Nyx',[-3400,100,-9000],590,1,false],['Ione',[-8000,4300,-18100],2250,1,true],['Talos',[3300,4400,-16000],850,2,false],['Keph',[4400,3300,-9700],370,3,false]];ps=defs.map((d,i)=>({kind:'planet',id:HOME+'/p'+i,systemId:HOME,name:d[0],pos:d[1],radius:d[2],palette:PALETTES[d[3]],rings:d[4],seed:42+i*717}));}
 if(star.id===ASTER){ps[0].name='Aurelia';ps[0].pos=V.add(star.pos,[6100,-2900,16700]);ps[0].radius=1440;ps[0].palette=PALETTES[0];ps[0].seed=3471;ps[2].name='Vesper';ps[2].rings=true;}
 const sys={star,planets:ps};systemCache.set(star.id,sys);if(systemCache.size>20){let key=[...systemCache.keys()].find(k=>k!==HOME&&k!==S.currentId);if(key)systemCache.delete(key)}return sys}
let prefs={reduceMotion:false,bloom:.65,exposure:1.05,sound:true},saved=null;
try{Object.assign(prefs,JSON.parse(localStorage.getItem('boundless-settings-v1')||'{}'));saved=JSON.parse(localStorage.getItem('boundless-flight-v1')||'null')}catch{}
// Graphics quality, backend, look sensitivity and invert-Y now live in the kit settings.
for(const k of ['quality','invertY','sensitivity','renderer'])delete prefs[k];
prefs.reduceMotion=!!prefs.reduceMotion;prefs.sound=prefs.sound!==false;prefs.bloom=clamp(Number.isFinite(+prefs.bloom)?+prefs.bloom:.65,0,1.5);prefs.exposure=clamp(+prefs.exposure||1.05,.5,1.8);
function updateRendererLabel(){
 txt('renderer-label',kit.backendLabel.toUpperCase()+' / HDR');
 txt('renderer-status',kit.backendLabel+' · three.js r'+(window.__kit?.three||'186')+' · '+kit.tier.name.toUpperCase()+' QUALITY');
 txt('renderer-note',window.__kit?.fellBack?'WebGPU is not available here, so the WebGL2 path is active. Both draw the same scene.':'Quality, resolution, touch layout and controller options are in the system settings.');
}
kit.onQuality(updateRendererLabel);

const S={pos:[0,0,0],q:[0,0,0,1],velocity:[0,0,0],speed:0,throttle:0,time:0,started:false,paused:false,boost:false,cruise:false,auto:null,guide:null,currentId:HOME,selected:null,stars:[],active:[],nearest:null,clearance:Infinity,air:0,visited:new Set([HOME]),checks:{orbit:false,boost:false,travel:false,atmo:false,surface:false},stats:{distance:0,maxSpeed:0,boostTime:0,systemsEntered:0,atmoEntries:0,contacts:0,steps:0,minClearance:Infinity},events:[],worldCell:'',worldTimer:0,saveTimer:0,fov:65,angular:[0,0,0],mouseTurn:[0,0],cameraQ:[0,0,0,1],visualBank:0,boostMix:0,transitFX:0,drift:false,flightPhase:'HOLD',noticeUntil:0,hud:true,lastAutoDone:null};
const home=makeStar(HOME);getSystem(home);S.selected=getSystem(home).planets[0];
/* ---- Controls state, read from kit.input once per frame (the flight model steps at 90 Hz). */
const LOOK_SCALE=.0032/.0024; // the original drag rate per pixel over the kit's mouse-look rate
const ctl={throttle:0,roll:0,strafe:0,steer:[0,0],walk:[0,0],turn:[0,0],stickMag:0,boost:false,brake:false,drift:false};
const drag={active:false,sx:0,sy:0,moved:false};
let hoverPointer=null;
/* Button prompts follow the device in use (kit.input.source). */
const KEY_LABELS={
  keyboard:{land:'L',gear:'K',ramp:'R',interact:'E',takeoff:'U',descend:'G',transfer:'F',target:'T',next:'TAB',map:'M',system:'C',brake:'X',boost:'SHIFT',walk:'WASD',look:'DRAG',log:'N',pause:'ESC'},
  gamepad:{land:'D-PAD ↓',gear:'RS',ramp:'Y',interact:'X',takeoff:'D-PAD ↑',descend:'D-PAD ↑',transfer:'Y',target:'X',next:'D-PAD →',map:'VIEW',system:'VIEW',brake:'B',boost:'A',walk:'LEFT STICK',look:'RIGHT STICK',log:'START ▸ LOG',pause:'START'},
  touch:{land:'LAND',gear:'GEAR',ramp:'RAMP',interact:'USE',takeoff:'LIFT',descend:'LAND',transfer:'GO',target:'AIM',next:'NEXT',map:'MAP',system:'MAP',brake:'HOLD',boost:'RUN',walk:'STICK',look:'DRAG',log:'II ▸ LOG',pause:'II'},
};
function K(name){return(KEY_LABELS[kit.input.source]||KEY_LABELS.keyboard)[name]||name.toUpperCase()}
/* ---- Career: the explorer log survives resets and reloads. */
const SAMPLES_PER_SITE=4,SAMPLE_REACH=.0024;
const SAMPLE_TYPES=[{name:'AURORAL QUARTZ',tint:[.55,.95,1]},{name:'SPORE GLASS',tint:[.7,1,.55]},{name:'EMBER BASALT',tint:[1,.55,.35]},{name:'TIDE PEARL',tint:[.75,.82,1]},{name:'VOID OPAL',tint:[.86,.56,1]},{name:'IRON FERN',tint:[.95,.8,.5]}];
const RANKS=[[0,'CADET'],[3,'SURVEYOR'],[8,'PATHFINDER'],[16,'XENOLOGIST'],[30,'STAR CARTOGRAPHER'],[50,'AURORA LEGEND']];
const career={samples:0,sites:{},worlds:{},distance:0,maxSpeed:0,landings:0,walk:0,systems:['0:0:0:0']};
try{
  const c=JSON.parse(localStorage.getItem('boundless-career-v1')||'null');
  if(c&&typeof c==='object'){
    for(const k of ['samples','distance','maxSpeed','landings','walk'])if(Number.isFinite(c[k])&&c[k]>=0)career[k]=c[k];
    if(c.sites&&typeof c.sites==='object')for(const [k,v] of Object.entries(c.sites))if(Array.isArray(v))career.sites[k]=v.filter(Number.isInteger);
    if(c.worlds&&typeof c.worlds==='object')for(const [k,w] of Object.entries(c.worlds))if(w&&typeof w.name==='string')career.worlds[k]={name:w.name,kind:String(w.kind||''),landings:+w.landings||0,samples:+w.samples||0};
    if(Array.isArray(c.systems))career.systems=[...new Set(['0:0:0:0',...c.systems.filter(s=>typeof s==='string')])];
  }
}catch{}
function saveCareer(){try{localStorage.setItem('boundless-career-v1',JSON.stringify(career))}catch{}}
function rankFor(n){let r=RANKS[0];for(const x of RANKS)if(n>=x[0])r=x;return r}
/* ---- Surface survey. Every landing site hides a few glowing mineral samples on dry,
   walkable ground 20–80 m from the ship. The crew walks out, collects them with the
   interact action, and the explorer log keeps the count across flights. */
function surveyKey(site){return site.planet.id+'@'+site.normal.map(n=>n.toFixed(4)).join(',')}
function buildSurvey(site){
  const p=site.planet,random=rng(hashString('survey:'+p.id+':'+site.normal.map(n=>n.toFixed(5)).join(':'))),samples=[];
  const right=Q.rot([1,0,0],site.q),front=Q.rot([0,0,1],site.q),key=surveyKey(site),taken=new Set(career.sites[key]||[]);
  for(let tries=0;tries<90&&samples.length<SAMPLES_PER_SITE;tries++){
    const a=random()*Math.PI*2,range=(20+random()*60)*.001,type=SAMPLE_TYPES[Math.floor(random()*SAMPLE_TYPES.length)],seed=random();
    const guess=V.add(site.ground,V.add(V.mul(right,Math.cos(a)*range),V.mul(front,Math.sin(a)*range)));
    const base=terrainPoint(p,guess),up=V.norm(V.sub(base,p.pos));
    if(rawHeight(up,p)<=.0004||terrainSlope(p,base)>28)continue;
    if(samples.some(s=>V.dist(s.center,base)<.012)||site.scatter.rocks.some(r=>V.dist(r.center,base)<r.radius+.0025))continue;
    samples.push({index:samples.length,center:base,up,type,seed,taken:false});
  }
  for(const s of samples){s.taken=taken.has(s.index);site.scatter.rocks.push({center:s.center,radius:.00045,height:.0009});}
  site.survey={key,samples};
}
function sampleMesh(renderer,site,s){
  const r=rng(Math.floor(s.seed*4294967295)),rock=new MeshBuilder(),crystal=new MeshBuilder(),M=.001,up=s.up;
  const right=V.norm(V.cross(Math.abs(up[1])<.9?[0,1,0]:[1,0,0],up)),fwd=V.cross(up,right);
  const at=(x,y,z)=>V.add(V.add(V.mul(right,x*M),V.mul(up,y*M)),V.mul(fwd,z*M));
  const stone=V.mix(site.planet.palette.land,[.36,.37,.4],.5),cap=V.mul(stone,1.15);
  const ring=(rad,y,turn)=>Array.from({length:7},(_,j)=>{const a=j/7*Math.PI*2+turn,k=.85+.3*((j*37%5)/5);return at(Math.cos(a)*rad*k,y,Math.sin(a)*rad*k)});
  const lo=ring(.62,-.12,0),hi=ring(.42,.32,.3),top=at(0,.4,0);
  for(let j=0;j<7;j++){const k=(j+1)%7;rock.quad(lo[j],lo[k],hi[k],hi[j],V.mul(stone,.8+r()*.25));rock.tri(hi[j],hi[k],top,cap)}
  const tint=s.type.tint,count=3+Math.floor(r()*3);
  for(let c=0;c<count;c++){
    const a=r()*Math.PI*2,off=r()*.18,len=(.55+r()*.75)*M,w=(.07+r()*.06)*M,tilt=.15+r()*.35;
    const base=at(Math.cos(a)*off,.3,Math.sin(a)*off);
    const dir=V.norm(V.add(up,V.add(V.mul(right,Math.cos(a)*tilt),V.mul(fwd,Math.sin(a)*tilt))));
    const side=V.norm(V.cross(dir,Math.abs(V.dot(dir,right))<.9?right:fwd)),side2=V.cross(dir,side);
    const tip=V.add(base,V.mul(dir,len));
    const hex=Array.from({length:6},(_,j)=>{const b=j/6*Math.PI*2;return V.add(base,V.add(V.mul(side,Math.cos(b)*w),V.mul(side2,Math.sin(b)*w)))});
    const shoulder=hex.map(q=>V.add(q,V.mul(dir,len*.72)));
    for(let j=0;j<6;j++){const k=(j+1)%6,shade=.75+.25*Math.cos(j*1.7+c);crystal.quad(hex[j],hex[k],shoulder[k],shoulder[j],V.mul(tint,shade*.8));crystal.tri(shoulder[j],shoulder[k],tip,V.mul(tint,shade))}
  }
  return {rock:renderer.mesh(rock.data),crystal:renderer.mesh(crystal.data)};
}
function drawSurvey(renderer,site){
  const sv=site.survey;if(!sv||!sv.samples.length)return;
  if(renderer.surveySite!==site){
    for(const m of renderer.surveyMeshes||[]){renderer.freeMesh(m.rock);renderer.freeMesh(m.crystal)}
    renderer.surveyMeshes=sv.samples.map(s=>sampleMesh(renderer,site,s));renderer.surveySite=site;
  }
  const cam=renderer.cam.pos,pulse=.75+.25*Math.sin(S.time*3.2),glows=[];
  sv.samples.forEach((s,i)=>{
    const m=renderer.surveyMeshes[i];
    renderer.draw(m.rock,s.center,{kind:6,roughness:.9,metallic:0,fog:true,sun:renderer.env.sun});
    if(s.taken)return;
    renderer.draw(m.crystal,s.center,{kind:2,emission:.45+.4*pulse,fog:false});
    const top=V.add(s.center,V.mul(s.up,.0019)),d=Math.max(V.dist(top,cam),.00001);
    glows.push(...V.sub(top,cam),...s.type.tint,clamp(.0009/d*innerHeight/renderer.tan*1.6,3,34)*pulse);
  });
  if(glows.length)renderer.points(glows,.55);
}
function nearestSample(){
  const a=Surf.actor,sv=Surf.site?.survey;if(!a||!sv)return null;
  let best=null,bd=Infinity;for(const s of sv.samples){if(s.taken)continue;const d=V.dist(a.foot,s.center);if(d<bd){bd=d;best=s}}
  return best?{s:best,d:bd}:null;
}
function nearbySample(){const n=Surf.mode==='onfoot'?nearestSample():null;return n&&n.d<SAMPLE_REACH?n.s:null}
function worldRecord(p){return career.worlds[p.id]||(career.worlds[p.id]={name:p.name,kind:p.palette.name,landings:0,samples:0})}
function collectSample(s){
  const site=Surf.site,sv=site.survey;s.taken=true;
  const list=career.sites[sv.key]||(career.sites[sv.key]=[]);if(!list.includes(s.index))list.push(s.index);
  const before=rankFor(career.samples)[1];career.samples++;worldRecord(site.planet).samples++;
  const found=sv.samples.filter(x=>x.taken).length,now=rankFor(career.samples)[1];
  notice('SAMPLE LOGGED / '+s.type.name+' / '+found+' OF '+sv.samples.length+(found===sv.samples.length?' / SITE SURVEYED':''),5);
  sfx('sample');kit.input.rumble(.4,140);event('sample-collected',{planet:site.planet.id,type:s.type.name,total:career.samples});
  if(now!==before)setTimeout(()=>{notice('EXPLORER RANK / '+now+' / '+K('log')+' OPENS THE LOG',6);sfx('rank')},1800);
  saveCareer();
}
function recordLanding(site){career.landings++;worldRecord(site.planet).landings++;saveCareer()}
function crewNearRamp(){
  if(!Surf.actor||!Surf.site)return false;
  const local=surfaceLocal(Surf.actor.foot),end=surfaceWorld([0,Surf.site.rampY+.07,SurfaceShapes.rampEndZ+.55]);
  return (Math.abs(local[0])<.72&&local[2]>.25&&local[2]<7.75)||V.dist(Surf.actor.foot,end)<.0024;
}
const escapeHTML=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function renderLog(){
  const [,name]=rankFor(career.samples),next=RANKS.find(r=>r[0]>career.samples),prevAt=rankFor(career.samples)[0];
  txt('log-rank',name.charAt(0)+name.slice(1).toLowerCase());
  txt('log-rank-note',next?(next[0]-career.samples)+' more sample'+(next[0]-career.samples===1?'':'s')+' to '+next[1]+'. Samples glow near every landing site: land, open the ramp and walk out.':'Highest rank reached. Every star is still a destination.');
  $('log-progress').style.width=(next?clamp((career.samples-prevAt)/(next[0]-prevAt),0,1)*100:100).toFixed(1)+'%';
  const worlds=Object.values(career.worlds),walk=career.walk<1000?career.walk.toFixed(0)+' m':(career.walk/1000).toFixed(2)+' km';
  const stats=[['SAMPLES',career.samples],['WORLDS LANDED',worlds.length],['LANDINGS',career.landings],['SYSTEMS VISITED',career.systems.length],['DISTANCE FLOWN',formatDistance(career.distance)],['TOP SPEED',speedText(career.maxSpeed)],['DISTANCE WALKED',walk],['FIRST CONTACT',Object.values(S.checks).filter(Boolean).length+' / 5']];
  $('log-stats').innerHTML=stats.map(([k,v])=>'<div><span>'+k+'</span><strong>'+escapeHTML(v)+'</strong></div>').join('');
  $('log-worlds').innerHTML=worlds.length?worlds.sort((a,b)=>b.samples-a.samples||b.landings-a.landings).map(w=>'<div class="log-world"><b>'+escapeHTML(w.name.toUpperCase())+'</b><small>'+escapeHTML(w.kind)+'</small><span>'+w.samples+' SAMPLE'+(w.samples===1?'':'S')+' · '+w.landings+' LANDING'+(w.landings===1?'':'S')+'</span></div>').join(''):'<p class="chart-empty">No landings yet. Descend to a world, press '+escapeHTML(K('land'))+' to land on dry ground, open the ramp and walk out to find the glowing survey samples.</p>';
}
function openLog(){renderLog();openModal('log')}
function surfaceHint(mode,walking,ready,nearRamp,nearSample){
  return mode==='onfoot'?(nearSample?K('interact')+' · Collect '+nearSample.type.name.toLowerCase():nearRamp?K('interact')+' · Board AURORA through the ramp':K('walk')+' · Walk    '+K('look')+' · Look    '+K('boost')+' · Run')
    :mode==='landed'?(ready?K('interact')+' · Leave through the ramp    '+K('look')+' · Inspect ship    '+K('land')+' · Take off':K('ramp')+' · Open the ramp    '+K('look')+' · Inspect ship    '+K('land')+' · Take off')
    :mode==='landing'?K('brake')+' · Hold landing    Automatic contact on dry terrain'
    :mode==='hover'?K('land')+' · Continue landing    '+K('takeoff')+' · Return to flight'
    :walking?'Crew movement follows the ramp. Flight controls are locked.':K('land')+' · Land on the selected world    '+K('gear')+' · Deploy landing gear';
}
function updateSurveyHUD(walking,mode){
  const sv=Surf.site?.survey,beacon=$('sample-beacon'),total=sv?sv.samples.length:0,found=sv?sv.samples.filter(s=>s.taken).length:0;
  const row=document.querySelector('[data-survey-step]');
  if(row){row.hidden=!total;row.classList.toggle('done',total>0&&found===total)}
  txt('survey-count',found+' / '+total);txt('foot-samples',found+' / '+total);
  const ns=walking&&mode==='onfoot'?nearestSample():null;
  if(!ns){if(beacon.style.display!=='none')beacon.style.display='none';return}
  const bp=R.project(V.add(ns.s.center,V.mul(ns.s.up,.0012)));
  const x=bp.front?clamp(bp.x,70,innerWidth-70):(bp.x<innerWidth*.49?70:innerWidth-70),y=bp.front?clamp(bp.y,115,innerHeight-230):innerHeight*.47;
  beacon.style.display='block';beacon.style.left=x+'px';beacon.style.top=y+'px';beacon.classList.toggle('behind',!bp.front||x!==bp.x||y!==bp.y);
  txt('sample-name',ns.s.type.name);txt('sample-range',(ns.d*1000).toFixed(1)+' m');
}
/* ---- Input: one pass per frame over the kit actions. */
let flightInputWas=false,navHeld=0,navTimer=0,touchLayout='';
function readControls(){
  const I=kit.input,st=I.vector('stick'),ar=I.vector('arrows'),wk=I.vector('walk'),inv=kit.settings.get().invertY?-1:1;
  ctl.throttle=I.value('throttle');ctl.roll=I.value('roll');ctl.strafe=I.value('strafe');
  ctl.steer[0]=clamp(ar.x+st.x,-1,1);ctl.steer[1]=clamp(ar.y+st.y*inv,-1,1);
  ctl.walk[0]=clamp(wk.x+st.x,-1,1);ctl.walk[1]=clamp(wk.y+st.y,-1,1);
  ctl.turn[0]=ar.x;ctl.turn[1]=ar.y;ctl.stickMag=Math.hypot(st.x,st.y);
  ctl.boost=I.down('boost');ctl.brake=I.down('brake');ctl.drift=I.down('drift');
}
function frameInput(dt){
  readControls();
  const I=kit.input,P=n=>I.pressed(n),modal=document.querySelector('.modal.open');
  hoverPointer=I.pointer.over&&I.pointer.type==='mouse'?{x:I.pointer.x,y:I.pointer.y}:null;
  updateTouchLayout();
  if(P('pause')){if(modal)closeModals();else openModal('pause');return}
  if(P('bay')){if(modal?.id==='ship-bay')closeModals();else openShipBay();return}
  if(P('map')){if(modal?.id==='atlas')closeModals();else openAtlas();return}
  if(P('system')){openAtlas('system');return}
  if(P('help')){if(modal?.id==='help')closeModals();else openModal('help');return}
  if(P('log')){if(modal?.id==='log')closeModals();else openLog();return}
  if(modal){menuInput(modal,dt);return}
  if(!S.started){menuNav($('launch'),dt);if(I.source==='gamepad')return}
  applyLook();
  // Any flight control starts the flight and takes over from the assist, as the keys did.
  const flightInput=!surfaceOwnsFlight()&&(Math.abs(ctl.throttle)>.25||Math.hypot(ctl.turn[0],ctl.turn[1])>.3||Math.abs(ctl.roll)>.3||Math.abs(ctl.strafe)>.3||ctl.drift||(S.started&&ctl.stickMag>.3));
  if(flightInput&&!flightInputWas){if(!S.started)startFlight();if(S.auto)cancelAssist(false)}
  flightInputWas=flightInput;
  if(P('land'))requestLanding();
  if(P('gear'))toggleGear();
  if(surfaceOwnsFlight()){
    // Gamepad buttons do double duty (Y is ramp or transfer, X is use or target, D-pad up is
    // lift-off or descend): a press a surface action used is not also a flight command.
    const surfaceUsed=['land','gear','ramp','takeoff','interact','brake'].some(P);
    if(P('ramp'))toggleRamp();
    if(P('takeoff'))requestTakeoff();
    if(P('interact'))interactSurface();
    if(P('brake')){
      if(Surf.mode==='landing'){surfaceSetMode('hover','LANDING HOLD');S.velocity=[0,0,0];S.speed=0;notice('LANDING HOLD / '+K('land')+' TO CONTINUE / '+K('takeoff')+' TO TAKE OFF',5)}
      Surf.walkVelocity=[0,0,0];
    }
    if(!surfaceUsed&&['transfer','descend','target','next','prev'].some(P))surfaceWarning('BOARD AND TAKE OFF BEFORE STARTING A FLIGHT COURSE');
  }else{
    if(P('target')){const hit=pickDestination(innerWidth/2,innerHeight/2,32);if(hit)select(hit);else notice('NO VISIBLE TARGET AT THE AIM POINT')}
    // Before take-off, Tab moves through the launch card's buttons instead of cycling targets.
    if(S.started&&P('next'))nextTarget(1);
    if(S.started&&P('prev'))nextTarget(-1);
    if(P('transfer')){if(S.auto)cancelAssist();else engage(S.selected.kind==='star'?'cruise':'approach')}
    if(P('descend'))engage('descend');
    if(P('brake')){cancelAssist();S.throttle=0}
  }
  if(P('photo'))photo();
  if(P('hud'))document.body.classList.toggle('hud-hidden');
}
/* Drag steers (mouse, touch), the right stick always does; a click or tap that did not drag picks a target. */
function applyLook(){
  const I=kit.input,p=I.pointer,lk=I.look('look');
  if(p.justDown){drag.active=true;drag.sx=p.x;drag.sy=p.y;drag.moved=false}
  if(drag.active&&p.down&&Math.hypot(p.x-drag.sx,p.y-drag.sy)>5)drag.moved=true;
  if((lk.x||lk.y)&&(drag.moved||I.source==='gamepad')&&S.started&&!S.paused){
    const dx=lk.x*LOOK_SCALE,dy=lk.y*LOOK_SCALE;
    if(!surfaceTurn(dx,dy)){cancelAssist(false);S.mouseTurn[0]=clamp(S.mouseTurn[0]-dy,-.7,.7);S.mouseTurn[1]=clamp(S.mouseTurn[1]-dx,-.7,.7)}
  }
  if(p.justUp){if(drag.active&&!drag.moved&&!S.paused&&!surfaceOwnsFlight()){const hit=pickDestination(p.x,p.y);if(hit)select(hit)}drag.active=false}
}
/** dx, dy in the original drag units (0.0032 per pixel). */
function surfaceTurn(dx,dy){
  if(!surfaceOwnsFlight())return false;
  if(Surf.actor&&['onfoot','exiting'].includes(Surf.mode)){Surf.actor.yaw+=dx;Surf.actor.pitch=clamp(Surf.actor.pitch-dy,-1.3,1.3)}
  else if(['landed','hover'].includes(Surf.mode)){Surf.orbitYaw-=dx*(.005/.0032);Surf.orbitPitch=clamp(Surf.orbitPitch+dy*(.003/.0032),-.08,.85)}
  return true;
}
/* Menus: D-pad or stick moves the focus, A confirms, B or Start goes back. */
function focusables(root){return[...root.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length>0)}
function moveFocus(root,dir){
  const list=focusables(root);if(!list.length)return;
  let i=list.indexOf(document.activeElement);i=i<0?0:(i+dir+list.length)%list.length;
  list[i].focus();list[i].scrollIntoView?.({block:'nearest'});
}
function menuNav(root,dt){
  const I=kit.input,nv=I.vector('nav'),active=document.activeElement;
  const range=active?.type==='range'&&root.contains(active);
  const dir=Math.abs(nv.y)>.5?(nv.y>0?-1:1):Math.abs(nv.x)>.5?(nv.x>0?1:-1)*(range?10:1):0;
  if(dir){
    if(dir!==navHeld||navTimer<=0){
      if(Math.abs(dir)===10){if(dir>0)active.stepUp();else active.stepDown();active.dispatchEvent(new Event('input',{bubbles:true}))}
      else moveFocus(root,dir);
      navTimer=dir===navHeld?.12:.38;navHeld=dir;
    }else navTimer-=dt;
  }else{navHeld=0;navTimer=0}
  if(I.pressed('confirm')){
    if(active&&active!==document.body&&root.contains(active)&&active.matches('button,input[type=checkbox]'))active.click();
    else moveFocus(root,0);
  }
}
function menuInput(modal,dt){
  const I=kit.input;
  if(I.pressed('back')){closeModals();return}
  const lk=I.look('look'),zoom=-I.value('roll'); // RB zooms in, LB out
  if(I.source==='gamepad'&&(lk.x||lk.y)){
    if(modal.id==='ship-bay'){bay.yaw-=lk.x*2.2;bay.pitch=clamp(bay.pitch+lk.y*1.9,-1.4,1.4);setBayView('perspective')}
    else if(modal.id==='atlas'){mapPan=[mapPan[0]-lk.x*260,mapPan[1]-lk.y*260];drawAtlas()}
  }
  if(zoom&&I.source==='gamepad'){
    if(modal.id==='atlas')zoomChart(Math.exp(zoom*dt*1.8));
    else if(modal.id==='ship-bay'){bay.distance=clamp(bay.distance*Math.exp(-zoom*dt*1.2),17,50);setBayView('perspective')}
  }
  menuNav(modal,dt);
}
/* Touch controls change with the situation: flight, parked on the surface, or on foot. */
function updateTouchLayout(){
  const t=kit.touch;if(!t)return;
  const own=surfaceOwnsFlight(),foot=['onfoot','exiting','boarding'].includes(Surf.mode),flight=!own;
  const sample=nearbySample(),nearRamp=Surf.mode==='onfoot'&&crewNearRamp();
  const canUse=(Surf.mode==='landed'&&Surf.ramp>.999)||(Surf.mode==='onfoot'&&(!!sample||nearRamp));
  const useLabel=Surf.mode==='landed'?'Exit':sample?'Take':'Board',sealed=Surf.rampTarget<=.5;
  const key=[S.started,Surf.mode,canUse,useLabel,sealed].join('|');
  if(key===touchLayout)return;touchLayout=key;
  t.setShown('ramp',Surf.mode==='landed');t.setLabel('ramp',sealed?'Ramp':'Seal');
  t.suspend(!S.started,'launch');
  t.setShown('stick',flight||foot);
  for(const n of ['throttle+','throttle-','transfer','target'])t.setShown(n,flight);
  t.setShown('boost',flight||foot);t.setLabel('boost',foot?'Run':'Boost');
  t.setShown('brake',flight||Surf.mode==='landing');t.setLabel('brake',own?'Hold':'Brake');
  t.setShown('interact',canUse);t.setLabel('interact',useLabel);
  t.setShown('land',!foot&&!['landing','closing','takeoff'].includes(Surf.mode));t.setLabel('land',Surf.mode==='landed'?'Lift off':Surf.mode==='hover'?'Resume':'Land');
  t.setShown('takeoff',Surf.mode==='hover');
}
/* Prompts, the control dock and the flight manual follow the device in use. */
const HELP_ROWS=[
  ['Increase / decrease thrust',['W','S'],['RT','LT'],['THR +','THR −']],
  ['Turn and pitch',['↑ ↓ ← →','DRAG'],['LEFT STICK','RIGHT STICK'],['STICK','DRAG']],
  ['Roll / move sideways',['A D','Q E'],['LB RB'],[]],
  ['Hold boost / brake and cancel course',['SHIFT','X'],['A','B'],['BOOST','BRAKE']],
  ['Hold drift (turn without changing course)',['SPACE'],['LS'],[]],
  ['Fast transfer / descend to terrain',['F','G'],['Y','D-PAD ↑'],['GO','LAND']],
  ['Target at aim point / next target',['T','TAB'],['X','D-PAD ← →'],['AIM','TAP A WORLD']],
  ['Charts / local system chart',['M','C'],['VIEW'],['MAP']],
  ['Land and take off / landing gear',['L','K'],['D-PAD ↓','RS'],['LAND','CONSOLE']],
  ['Ramp / leave, board, collect samples',['R','E'],['Y','X'],['CONSOLE','USE']],
  ['Walk, run and look on foot',['W A S D','SHIFT','DRAG / ARROWS'],['LEFT STICK','A','RIGHT STICK'],['STICK','RUN','DRAG']],
  ['Explorer log / inspect AURORA',['N','B'],['START ▸ LOG'],['II ▸ LOG']],
  ['Save a photo / hide the display',['O','V'],[],[]],
  ['Pause / flight manual',['ESC','P','H'],['START'],['II']],
];
function renderHelp(){
  const source=kit.input.source,col={keyboard:1,gamepad:2,touch:3}[source]||1;
  txt('help-source',source==='gamepad'?'GAMEPAD':source==='touch'?'TOUCH':'KEYBOARD & MOUSE');
  $('help-rows').innerHTML=HELP_ROWS.filter(r=>r[col].length).map(r=>'<div class="help-row"><span>'+r[0]+'</span><div>'+r[col].map(k=>'<kbd>'+k+'</kbd>').join('')+'</div></div>').join('');
}
function startHint(){const s=kit.input.source;return s==='gamepad'?'LEFT STICK TO STEER / RT THRUST / X TARGETS THE AIM POINT / Y TO TRANSFER':s==='touch'?'TAP A WORLD TO TARGET / GO TO TRANSFER / STICK TO STEER':'CLICK A WORLD TO TARGET / F TO TRANSFER / DRAG TO STEER'}
function footHint(){return 'ON FOOT / '+K('walk')+' TO WALK / '+K('look')+' TO LOOK / '+K('boost')+' TO RUN'}
function updateControlHints(){
  const pad=kit.input.source==='gamepad',keys=document.querySelector('#control-dock .keys');
  const rows=pad?[['RT LT','Thrust'],['A','Boost',1],['B','Brake'],['Y','Transfer']]:[['W S','Thrust'],['SHIFT','Boost',1],['X','Brake'],['F','Transfer']];
  if(keys)keys.innerHTML=rows.map(([k,l,b])=>'<span'+(b?' class="key-boost"':'')+'><kbd>'+k+'</kbd>'+l+'</span>').join('');
  txt('steer-hint',pad?'LEFT STICK TO STEER · X AT AIM POINT · D-PAD → NEXT TARGET':'CLICK TO TARGET · DRAG TO STEER · T AT AIM POINT');
  txt('guide-hint','PRESS '+(kit.input.source==='touch'?'BRAKE':K('brake'))+' TO TAKE MANUAL CONTROL');
  for(const [id,a] of [['land-btn','land'],['gear-btn','gear'],['ramp-btn','ramp'],['crew-btn','interact']]){const k=$(id)?.querySelector('kbd');if(k)k.textContent=K(a)}
  renderHelp();
}
kit.input.onSourceChange(()=>{updateControlHints();touchLayout=''});
// Text fields are left alone by the kit, so Escape in the chart search closes the charts here.
addEventListener('keydown',e=>{if(e.code==='Escape'&&!kit.menu.isOpen&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)&&document.querySelector('.modal.open'))closeModals()});

/* ---- Sound: the engine drone and a few procedural cues. Created on the first gesture,
   remembered as a preference, silenced while any menu or the kit settings are open. */
let audio=null;
function ensureAudio(){
  if(audio)return audio;
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const osc=ctx.createOscillator(),low=ctx.createBiquadFilter();osc.type='sawtooth';osc.frequency.value=47;low.type='lowpass';low.frequency.value=150;
    const gain=ctx.createGain();gain.gain.value=.18;osc.connect(low);low.connect(gain);gain.connect(master);osc.start();
    const noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),arr=noiseBuffer.getChannelData(0),r=rng(91);for(let i=0;i<arr.length;i++)arr[i]=(r()*2-1)*.3;
    const source=ctx.createBufferSource();source.buffer=noiseBuffer;source.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=800;
    const noiseGain=ctx.createGain();noiseGain.gain.value=.02;source.connect(filter);filter.connect(noiseGain);noiseGain.connect(master);source.start();
    const fx=ctx.createGain();fx.gain.value=.5;fx.connect(ctx.destination);
    audio={ctx,master,osc,low,filter,noiseGain,fx,noiseBuffer};
  }catch{audio=null}
  return audio;
}
function unlockAudio(){
  if(!prefs.sound)return;
  const a=ensureAudio();
  if(a&&a.ctx.state!=='running'&&!kit.paused)a.ctx.resume().catch(()=>{});
  updateAudio();
}
addEventListener('pointerdown',unlockAudio,true);addEventListener('keydown',unlockAudio,true);
function updateSoundButton(){
  const on=prefs.sound,b=$('sound-btn');
  b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Mute sound':'Turn sound on');b.title=on?'Mute sound':'Turn sound on';
  b.innerHTML=on?'<svg viewBox="0 0 24 24"><path d="M10 5 5 9H2v6h3l5 4zM15 8q6 4 0 8M18 5q9 7 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M10 5 5 9H2v6h3l5 4zM15 9l6 6m0-6-6 6"/></svg>';
  if($('sound-toggle'))$('sound-toggle').checked=on;
}
function toggleAudio(){prefs.sound=!prefs.sound;savePrefs();if(prefs.sound)unlockAudio();updateSoundButton();updateAudio()}
function updateAudio(){
  if(!audio)return;
  const t=audio.ctx.currentTime,speed=clamp(S.speed/2000,0,1);
  audio.master.gain.setTargetAtTime(prefs.sound&&!S.paused&&!surfaceEnginesOff()?.28:0,t,.12);
  audio.osc.frequency.setTargetAtTime(38+speed*70,t,.15);audio.low.frequency.setTargetAtTime(120+speed*450,t,.2);
  audio.noiseGain.gain.setTargetAtTime(.015+speed*.16+(S.cruise?.14:0),t,.2);
  audio.fx.gain.setTargetAtTime(prefs.sound?.5:0,t,.05);
}
function sfx(name){
  if(!prefs.sound||!audio||audio.ctx.state!=='running')return;
  const c=audio.ctx,t=c.currentTime;
  const tone=(f,dur,type='sine',g=.2,to=0,at=0)=>{const o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t+at);if(to)o.frequency.exponentialRampToValueAtTime(to,t+at+dur);v.gain.setValueAtTime(0,t+at);v.gain.linearRampToValueAtTime(g,t+at+.012);v.gain.exponentialRampToValueAtTime(.0005,t+at+dur);o.connect(v);v.connect(audio.fx);o.start(t+at);o.stop(t+at+dur+.05)};
  const hiss=(dur,g=.2,f=900,at=0)=>{const s=c.createBufferSource(),bf=c.createBiquadFilter(),v=c.createGain();s.buffer=audio.noiseBuffer;bf.type='bandpass';bf.frequency.value=f;v.gain.setValueAtTime(g,t+at);v.gain.exponentialRampToValueAtTime(.0005,t+at+dur);s.connect(bf);bf.connect(v);v.connect(audio.fx);s.start(t+at,Math.random()*1.5);s.stop(t+at+dur+.05)};
  switch(name){
    case 'select':tone(880,.07,'sine',.07);tone(1320,.06,'sine',.05,0,.05);break;
    case 'open':tone(520,.08,'triangle',.05,780);break;
    case 'close':tone(700,.08,'triangle',.04,420);break;
    case 'confirm':tone(440,.12,'triangle',.07);tone(660,.16,'triangle',.07,0,.08);break;
    case 'discover':tone(392,.5,'sine',.07);tone(587,.6,'sine',.06,0,.12);tone(784,.8,'sine',.05,0,.24);break;
    case 'arrive':tone(330,.4,'triangle',.06);tone(494,.5,'triangle',.05,0,.1);break;
    case 'boost':hiss(.6,.16,420);tone(90,.5,'sawtooth',.05,180);break;
    case 'warn':tone(440,.09,'square',.04);tone(440,.09,'square',.04,0,.14);break;
    case 'gear':tone(120,.25,'square',.05,70);hiss(.2,.1,600,.12);break;
    case 'ramp':tone(210,1.2,'sawtooth',.025,330);break;
    case 'touchdown':tone(62,.5,'sine',.25,38);hiss(.35,.2,300);break;
    case 'sample':tone(1047,.25,'sine',.08);tone(1319,.3,'sine',.07,0,.08);tone(1760,.5,'sine',.06,0,.16);break;
    case 'rank':tone(523,.3,'triangle',.07);tone(659,.3,'triangle',.07,0,.12);tone(784,.3,'triangle',.07,0,.24);tone(1047,.7,'triangle',.07,0,.36);break;
    case 'photo':hiss(.08,.2,3000);break;
  }
}
kit.onPause(p=>{if(!audio)return;if(p)audio.ctx.suspend().catch(()=>{});else if(prefs.sound)audio.ctx.resume().catch(()=>{})});
function event(type,data={}){S.events.push({type,time:+S.time.toFixed(3),...data});if(S.events.length>300)S.events.shift()}
function formatDistance(d){if(!Number.isFinite(d))return '—';if(d<1)return(d*1000).toFixed(1)+' m';if(d>=1e6)return(d/1e6).toFixed(2)+' Gm';if(d>=1e4)return(d/1e3).toFixed(1)+' Mm';if(d>=100)return Math.round(d).toLocaleString('en-US')+' km';return d.toFixed(1)+' km'}
function surfaceDistance(p){let d=V.sub(S.pos,p.pos);return V.len(d)-p.radius-heightAt(V.norm(d),p)}
function targetDistance(obj){return obj.kind==='planet'?Math.max(0,surfaceDistance(obj)):Math.max(0,V.dist(S.pos,obj.pos)-obj.radius)}
function refreshStars(force=false){let cell=S.pos.map(x=>Math.floor((x+SECTOR*.5)/SECTOR)),key=cell.join(':');if(!force&&S.worldCell===key)return;S.worldCell=key;let stars=[];for(let z=cell[2]-3;z<=cell[2]+3;z++)for(let y=cell[1]-3;y<=cell[1]+3;y++)for(let x=cell[0]-3;x<=cell[0]+3;x++)for(let k=0;k<6;k++)stars.push(makeStar([x,y,z,k].join(':')));for(let id of [HOME,ASTER,S.currentId,...S.visited])if(!stars.some(s=>s.id===id))stars.push(makeStar(id));if(S.selected?.kind==='star'&&!stars.some(s=>s.id===S.selected.id))stars.push(S.selected);S.stars=stars;event('sector-stream',{cell:key,stars:stars.length});if(starCache.size>16000){const keep=new Set(stars.map(s=>s.id));for(let id of starCache.keys())if(!keep.has(id))starCache.delete(id)}}
function updateWorld(force=false){refreshStars(force);let closest=home,dist=Infinity;for(let s of S.stars){let d=V.dist(s.pos,S.pos);if(d<dist){closest=s;dist=d}}if(dist<70000&&closest.id!==S.currentId){S.currentId=closest.id;S.stats.systemsEntered++;S.visited.add(closest.id);if(closest.id!==HOME)S.checks.travel=true;event('system-enter',{id:closest.id,name:closest.name});notice('SYSTEM ACQUIRED / '+closest.name.toUpperCase());sfx('discover');kit.input.rumble(.2,90);if(!career.systems.includes(closest.id))career.systems.push(closest.id);updateLocal()}
 let ids=new Set([S.currentId]);if(dist<145000)ids.add(closest.id);if(S.selected?.kind==='planet')ids.add(S.selected.systemId);if(S.selected?.kind==='star'&&V.dist(S.pos,S.selected.pos)<150000)ids.add(S.selected.id);S.active=[...ids].map(id=>getSystem(makeStar(id)));findNearest();}
function findNearest(){let best=null,dist=Infinity;for(let sys of S.active)for(let p of sys.planets){let d=surfaceDistance(p);if(d<dist){dist=d;best=p}}let previous=S.air;S.nearest=best;S.clearance=dist;S.air=best?1-smooth(35,best.radius*.26,dist):0;if(S.started&&S.air>.05){S.checks.atmo=true;if(previous<=.05){S.stats.atmoEntries++;event('atmosphere-enter',{planet:best.name,clearance:dist})}}if(S.started&&dist<42){S.checks.surface=true;S.stats.minClearance=Math.min(S.stats.minClearance,dist)}if(S.started&&S.speed>10&&dist>best?.radius*.26&&dist<best?.radius*3)S.checks.orbit=true;}
function notice(text,duration=4){txt('notice',text);S.noticeUntil=S.time+duration;$('notice').classList.add('show')}
function select(obj,notify=true,keepAssist=false){if(!obj)return;if(S.selected?.id!==obj.id&&!keepAssist&&(S.auto||S.guide))cancelAssist(false);S.selected=obj;updateLocal();if(notify){notice('TRACKING / '+obj.name.toUpperCase()+' / '+formatDistance(targetDistance(obj)));sfx('select')}event('target-select',{id:obj.id});updateHUD();if(typeof mapSelected!=='undefined')mapSelected=obj}
function nextTarget(step=1){let ps=getSystem(makeStar(S.currentId)).planets,arr=[...ps,...S.stars.filter(s=>s.id!==S.currentId).sort((a,b)=>V.dist(a.pos,S.pos)-V.dist(b.pos,S.pos)).slice(0,3)],i=arr.findIndex(p=>p.id===S.selected.id);select(arr[(i+step+arr.length)%arr.length])}
function cancelAssist(notify=true){if(S.auto||S.guide){event('assist-cancel');if(notify)notice('MANUAL CONTROL / FLIGHT ASSIST OFF')}S.auto=null;S.guide=null;S.cruise=false;$('guide-caption').style.display='none'}
function startFlight(){S.started=true;document.body.classList.add('started');event('flight-start');canvas.focus();notice(startHint(),6);sfx('confirm')}
function nearestPlanet(){return S.selected?.kind==='planet'?S.selected:S.nearest}

// Pick actual land on the facing hemisphere. A guide never ends over an empty ocean.
function landingNormal(p){
 let n=V.norm(V.sub(S.pos,p.pos));if(p.landingNormal&&V.dot(n,p.landingNormal)>.82)return p.landingNormal;
 let right=V.norm(V.cross([0,1,0],n));if(V.len(right)<.1)right=[1,0,0];let up=V.norm(V.cross(n,right)),best=n,bestHeight=rawHeight(n,p);
 for(let radius=0;radius<=1.05;radius+=.075){let candidates=[];for(let i=0;i<32;i++){let a=i/32*Math.PI*2,nn=V.norm(V.add(n,V.add(V.mul(right,Math.cos(a)*radius),V.mul(up,Math.sin(a)*radius)))),h=rawHeight(nn,p);if(h>bestHeight){bestHeight=h;best=nn}if(h>p.radius*.02&&h<p.radius*.058)candidates.push({n:nn,h})}if(candidates.length){candidates.sort((a,b)=>Math.abs(a.h-p.radius*.032)-Math.abs(b.h-p.radius*.032));best=candidates[0].n;break}}
 p.landingNormal=best;return best;
}
function surfaceLook(p){let n=V.norm(V.sub(S.pos,p.pos)),right=V.norm(V.cross([0,1,0],n)),up=V.norm(V.cross(n,right)),best=right,bestH=-Infinity;for(let i=0;i<24;i++){let a=i/24*Math.PI*2,t=V.add(V.mul(right,Math.cos(a)),V.mul(up,Math.sin(a))),h=heightAt(V.norm(V.add(n,V.mul(t,.12))),p);if(h>bestH){bestH=h;best=t}}return Q.look(V.norm(V.add(best,V.mul(n,-.25))),n)}


// Route around a nearby world instead of driving through it. The intermediate
// points are flown with the same acceleration and swept-surface collision code.
function clearanceRoute(from,end){
 let planets=S.active.flatMap(sys=>sys.planets).sort((a,b)=>V.dist(from,a.pos)-V.dist(from,b.pos));
 for(let p of planets){let delta=V.sub(end,from),length=V.len(delta),dir=V.norm(delta),oc=V.sub(from,p.pos),nf=V.norm(oc),ne=V.norm(V.sub(end,p.pos)),angle=Math.acos(clamp(V.dot(nf,ne),-1,1));if(angle<.06)continue;
 let r=p.radius*1.18+40,b=V.dot(oc,dir),c=V.dot(oc,oc)-r*r,d=b*b-c;if(d<0)continue;let entry=-b-Math.sqrt(d),exit=-b+Math.sqrt(d);if(entry>length||exit<0)continue;
 let axis=V.norm(V.cross(nf,ne));if(V.len(axis)<.01)axis=V.norm(V.cross(nf,[0,1,0]));if(V.len(axis)<.01)axis=[1,0,0];let safe=p.radius*1.75+120,count=Math.ceil(angle/(Math.PI/7)),points=[V.add(p.pos,V.mul(nf,safe))];for(let i=1;i<=count;i++)points.push(V.add(p.pos,V.mul(Q.rot(nf,Q.axis(axis,angle*i/count)),safe)));points.push(end);event('clearance-route',{planet:p.name,waypoints:points.length});return points;
 }return [end];
}
function occluded(world,skipId){let ray=V.sub(world,R.cam.pos),length=V.len(ray),dir=V.norm(ray);for(let sys of S.active)for(let p of sys.planets){if(p.id===skipId)continue;let oc=V.sub(R.cam.pos,p.pos),b=V.dot(oc,dir),c=V.dot(oc,oc)-p.radius*p.radius,d=b*b-c;if(d>=0){let near=-b-Math.sqrt(d);if(near>1&&near<length-2)return true}}return false;}

function engage(mode,obj=S.selected,guide=false){
 if(!obj)return;
 if(surfaceOwnsFlight()){notice('BOARD AURORA AND TAKE OFF BEFORE STARTING A FLIGHT COURSE');return;}
 if(!S.started)startFlight();
 if(!guide)cancelAssist(false);
 // The destination card and the controller always refer to the same ID.
 if(S.selected.id!==obj.id)select(obj,false,guide);
 updateWorld(true);
 if(mode==='cruise'&&obj.kind==='planet')mode='approach';
 if(mode==='orbit'){
  if(obj.kind!=='planet'){notice('SELECT A WORLD FOR ORBIT');return}
  let n=V.norm(V.sub(S.pos,obj.pos)),alt=surfaceDistance(obj);
  if(alt>obj.radius*4||alt<obj.radius*.28){engage('approach',obj,guide);return}
  S.auto={mode,obj,orbitRadius:V.dist(S.pos,obj.pos),normal:n,t:0};S.cruise=false;
  notice('ORBIT ASSIST / '+obj.name.toUpperCase());event('assist-start',{mode,target:obj.id});return;
 }
 if(mode==='descend'&&obj.kind!=='planet'){notice('SELECT A WORLD BEFORE DESCENT');return}
 let n=V.norm(V.sub(S.pos,obj.pos)),point;
 if(obj.kind==='star'){mode='cruise';point=V.add(obj.pos,V.mul(n,obj.radius+24500));}
 else{n=landingNormal(obj);let altitude=mode==='descend'?17:Math.max(350,obj.radius*.34);point=V.add(obj.pos,V.mul(n,obj.radius+heightAt(n,obj)+altitude))}
 let route=clearanceRoute(S.pos,point),startLength=0,prev=S.pos;
 for(let wp of route){startLength+=V.dist(prev,wp);prev=wp}
 const finalPoint=point.slice();point=route.shift();
 S.auto={mode,obj,point,finalPoint,route,normal:n,startDistance:startLength,t:0};
 S.cruise=mode==='cruise';S.lastAutoDone=null;S.angular=[0,0,0];S.mouseTurn=[0,0];
 notice((mode==='cruise'?'STAR TRANSFER':mode==='descend'?'DESCENT ASSIST':'PLANET TRANSFER')+' / '+obj.name.toUpperCase());
 event('assist-start',{mode,target:obj.id,routeLength:startLength});
}
function beginGuide(){if(surfaceOwnsFlight()){notice('TAKE OFF BEFORE STARTING THE GUIDED FLIGHT');return}closeModals();if(!S.started)startFlight();cancelAssist(false);let p=S.nearest;if(!p||S.clearance>p.radius*4){p=getSystem(makeStar(S.currentId)).planets[0];select(p,false,true);engage('approach',p,true);S.guide={stage:'prelude',t:0,planet:p}}else{select(p,false,true);engage('orbit',p,true);S.guide={stage:'orbit',t:0,planet:p}}$('guide-caption').style.display='block';event('guide-start');}
const guideCopy={prelude:['FLIGHT 00 / ACQUIRE ORBIT','First, bring a world into view.'],orbit:['FLIGHT 01 / ORBIT','A real world beneath you. Not a distant backdrop.'],boost:['FLIGHT 02 / BOOST','Open the throttle. Leave the world behind.'],travel:['FLIGHT 03 / CROSS THE STARS','That light is another system. Keep going.'],approach:['FLIGHT 04 / A NEW WORLD','New oceans. New mountains. One continuous flight.'],descend:['FLIGHT 05 / ATMOSPHERIC DESCENT','Through the atmosphere. All the way to the terrain.'],complete:['JOURNEY COMPLETE','You crossed the stars. The rest is yours.']};
function guideUpdate(dt){let g=S.guide;if(!g)return;g.t+=dt;let copy=guideCopy[g.stage];txt('guide-stage',copy[0]);txt('guide-text',copy[1]);
 if(g.stage==='prelude'&&!S.auto){g.stage='orbit';g.t=0;engage('orbit',g.planet,true)}
 else if(g.stage==='orbit'&&g.t>5){g.stage='boost';g.t=0;let n=V.norm(V.sub(S.pos,g.planet.pos));let tangent=V.norm(V.cross([0,1,0],n));let direction=V.norm(V.add(n,V.mul(tangent,.20)));S.auto={mode:'escape',obj:g.planet,direction,t:0};S.throttle=1;event('guide-stage',{stage:'boost'})}
 else if(g.stage==='boost'&&g.t>4.5){g.stage='travel';g.t=0;let dest=S.currentId===ASTER?home:makeStar(ASTER);g.destination=dest;select(dest,false,true);engage('cruise',dest,true);event('guide-stage',{stage:'travel'})}
 else if(g.stage==='travel'&&!S.auto){g.stage='approach';g.t=0;let ps=getSystem(g.destination).planets;g.planet=ps.slice().sort((a,b)=>surfaceDistance(a)-surfaceDistance(b))[0];select(g.planet,false,true);engage('approach',g.planet,true);event('guide-stage',{stage:'approach'})}
 else if(g.stage==='approach'&&!S.auto){g.stage='descend';g.t=0;engage('descend',g.planet,true);event('guide-stage',{stage:'descend'})}
 else if(g.stage==='descend'&&!S.auto){g.stage='complete';g.t=0;S.throttle=0;S.velocity=[0,0,0];S.speed=0;S.q=surfaceLook(g.planet);notice('SURFACE REACHED / YOUR SHIP IS HOVERING',7);event('guide-complete',{planet:g.planet.name,clearance:surfaceDistance(g.planet)});saveFlight()}
 else if(g.stage==='complete'&&g.t>12){S.guide=null;$('guide-caption').style.display='none'}
}
function solveCollision(from,to){let delta=V.sub(to,from),length=V.len(delta);if(length<1e-10)return{pos:to,hit:null};let direction=V.mul(delta,1/length),bestT=1,hit=null;
 for(let sys of S.active)for(let obj of [...sys.planets,sys.star]){let radius=obj.radius*(obj.kind==='planet'?1.13:1)+12,oc=V.sub(from,obj.pos),b=V.dot(oc,direction),c=V.dot(oc,oc)-radius*radius,d=b*b-c;if(d<0)continue;let start=Math.max(0,-b-Math.sqrt(d)),end=Math.min(length,-b+Math.sqrt(d));if(end<0||start>length||end<start)continue;
 const signed=t=>{let v=V.sub(V.add(from,V.mul(direction,t)),obj.pos);return V.len(v)-obj.radius-(obj.kind==='planet'?heightAt(V.norm(v),obj):0)-12};
 let prev=start,prevD=signed(start);if(prevD<=0){if(signed(Math.min(length,start+.02))>prevD)continue;bestT=0;hit=obj;break}
 for(let j=1;j<=24;j++){let t=mix(start,end,j/24),sd=signed(t);if(sd<=0){let lo=prev,hi=t;for(let k=0;k<18;k++){let mid=(lo+hi)/2;if(signed(mid)>0)lo=mid;else hi=mid}if(lo/length<bestT){bestT=Math.max(0,lo/length-.00001);hit=obj}break}prev=t;prevD=sd}
 }
 return{pos:V.add(from,V.mul(delta,bestT)),hit};}
/* Flight controller v0.2. All rates use seconds. The fixed step is 1/90 s. */
const FLIGHT={planetMax:18000,starMax:110000,manualMax:8400,boostMax:110000};
let lastContactNotice=-10;
function rateStep(value,target,rate,dt){return mix(value,target,1-Math.exp(-rate*dt))}
function velocityStep(current,wanted,response,acceleration,dt){
 const delta=V.mul(V.sub(wanted,current),1-Math.exp(-response*dt));
 const length=V.len(delta),limit=acceleration*dt;
 return V.add(current,length>limit?V.mul(delta,limit/length):delta);
}
function safeClearance(){
 let clearance=S.clearance;
 for(const system of S.active)clearance=Math.min(clearance,V.dist(S.pos,system.star.pos)-system.star.radius);
 return Math.max(0,clearance);
}
function update(dt){
 if(!S.started||S.paused)return;
 S.time+=dt;S.stats.steps++;S.worldTimer+=dt;S.saveTimer+=dt;
 if(S.worldTimer>.16){S.worldTimer=0;updateWorld()}
 findNearest();guideUpdate(dt);
 const old=S.pos.slice();let auto=S.auto;
 const brake=ctl.brake;
 let boost=!brake&&(ctl.boost||auto?.mode==='escape');
 if(boost&&!S.boost&&!auto){kit.input.rumble(.25,90);sfx('boost')}S.boost=boost;S.boostMix=rateStep(S.boostMix,boost?1:0,boost?5:3.5,dt);
 if(!boost&&S.boostMix<.0001)S.boostMix=0;
 S.drift=ctl.drift&&!auto&&!brake;
 let desired=[0,0,0];
 if(brake){cancelAssist(false);S.throttle=0;S.velocity=V.mul(S.velocity,Math.exp(-12*dt));auto=null;S.boost=false}
 if(auto){
  auto.t+=dt;let targetQ;
  S.angular=V.mix(S.angular,[0,0,0],1-Math.exp(-dt*10));
  if(auto.mode==='orbit'){
   let n=V.norm(V.sub(S.pos,auto.obj.pos)),tangent=V.norm(V.cross([0,1,0],n));
   if(V.len(tangent)<.1)tangent=V.norm(V.cross([0,0,1],n));
   let radial=V.dist(S.pos,auto.obj.pos)-auto.orbitRadius;
   desired=V.add(V.mul(tangent,230),V.mul(n,-radial*2));
   targetQ=Q.look(V.norm(V.add(tangent,V.mul(n,-.42))),n);
   S.throttle=.5;S.checks.orbit=true;S.flightPhase='ORBIT';
  }else if(auto.mode==='escape'){
   desired=V.mul(auto.direction,3100);targetQ=Q.look(auto.direction);S.throttle=1;S.flightPhase='BOOST';
  }else{
   let delta=V.sub(auto.point,S.pos),dist=V.len(delta),dir=V.norm(delta),mode=auto.mode;
   let waypoint=auto.route?.length>0;
   const interstellar=mode==='cruise'?1:smooth(80000,150000,V.dist(S.pos,auto.obj.pos));
   S.cruise=mode==='cruise'||interstellar>.5;
   let max=mode==='descend'&&dist<1400?540:mix(FLIGHT.planetMax,FLIGHT.starMax,interstellar);
   let acceleration=mode==='descend'&&dist<1400?750:mix(15000,52000,interstellar);
   if(waypoint){max=Math.min(max,Math.max(650,(S.nearest?.radius||700)*1.6));acceleration=2600}
   // Stop at the planned point, not at the body's center or a chart symbol.
   let finalGain=mode==='descend'?1.2:2.6;
   let speed=Math.min(max,Math.sqrt(2*acceleration*dist)*.76,dist*finalGain+(mode==='descend'?3:28));
   const align=V.dot(Q.rot([0,0,-1],S.q),dir);
   speed*=smooth(.15,.96,align)*.99+.01;
   const clear=safeClearance();
   // A fast transfer opens only after the ship has left the local safety zone.
   if(mode!=='descend'||waypoint||dist>1400)speed=Math.min(speed,Math.max(280,clear*9));
   if(mode==='descend'&&!waypoint&&dist<1400)speed=Math.min(speed,Math.max(8,(clear-15)*1.4));
   desired=V.mul(dir,speed);
   let up=auto.obj.kind==='planet'?V.norm(V.sub(S.pos,auto.obj.pos)):[0,1,0],look=dir;
   if(mode==='descend'&&!waypoint&&dist<150){
    let tangent=V.norm(V.cross([0,1,0],up));
    look=V.norm(V.add(dir,V.mul(tangent,(1-smooth(0,150,dist))*1.1)));
   }
   targetQ=Q.look(look,up);
   S.throttle=clamp(speed/max,.06,1);
   S.flightPhase=align<.87?'ALIGN':waypoint?'CLEARANCE':mode==='descend'&&dist<1400?'DESCENT':speed<Math.min(max*.65,S.speed*.96)?'BRAKE':'TRANSFER';
   const tolerance=waypoint?28:mode==='cruise'?45:mode==='descend'?2.5:9;
   if(dist<tolerance&&waypoint){
    auto.point=auto.route.shift();event('waypoint-reached',{remaining:auto.route.length});
   }else if(dist<tolerance&&!waypoint){
    S.lastAutoDone=mode;S.flightPhase='HOLD';kit.input.rumble(.3,120);sfx('arrive');
    event('assist-arrive',{mode,target:auto.obj.id,clearance:S.clearance,elapsed:auto.t});
    S.auto=null;S.cruise=false;S.throttle=0;S.velocity=[0,0,0];desired=[0,0,0];
    if(!S.guide){
     notice(mode==='descend'?'SURFACE REACHED / HOVER HOLD / '+K('land')+' TO LAND':mode==='cruise'?'SYSTEM REACHED / '+K('system')+' FOR SYSTEM CHART':'ORBIT REACHED / '+K('descend')+' TO DESCEND',5);
     if(mode==='descend')targetQ=surfaceLook(auto.obj);
    }
   }
   S.velocity=velocityStep(S.velocity,desired,waypoint?7:mode==='cruise'?3.2:5.2,acceleration,dt);
   // Bound one step without moving the ship to the endpoint.
   let remain=V.dist(S.pos,auto.point),travel=V.len(S.velocity)*dt;
   if(travel>remain*.68)S.velocity=V.mul(V.norm(S.velocity),remain*.68/dt);
  }
  if(targetQ)S.q=Q.slerp(S.q,targetQ,1-Math.exp(-dt*(auto.mode==='escape'?2.4:3.8)));
  if(auto.mode==='orbit'||auto.mode==='escape')S.velocity=velocityStep(S.velocity,desired,3.4,6500,dt);
 }else{
  if(ctl.throttle>0)S.throttle=clamp(S.throttle+dt*.95*ctl.throttle,0,1);
  if(ctl.throttle<0)S.throttle=clamp(S.throttle+dt*1.3*ctl.throttle,0,1);
  const pitch=ctl.steer[1];
  const yaw=-ctl.steer[0];
  const roll=ctl.roll;
  const rates=[pitch*1.25,yaw*1.4,roll*1.85];
  for(let i=0;i<3;i++)S.angular[i]=rateStep(S.angular[i],rates[i],Math.abs(rates[i])>.001?9:13,dt);
  const blend=1-Math.exp(-17*dt),mouse=S.mouseTurn.map(v=>v*blend);
  S.mouseTurn=S.mouseTurn.map((v,i)=>v-mouse[i]);
  S.q=Q.norm(Q.mul(S.q,Q.mul(Q.axis([0,1,0],S.angular[1]*dt+mouse[1]),Q.mul(Q.axis([1,0,0],S.angular[0]*dt+mouse[0]),Q.axis([0,0,1],S.angular[2]*dt)))));
  let clear=safeClearance(),normalMax=Math.min(FLIGHT.manualMax,Math.max(140,clear)),boostMax=Math.min(FLIGHT.boostMax,Math.max(400,clear*9));
  if(S.air>.1){normalMax=Math.min(normalMax,220);boostMax=Math.min(boostMax,650)}
  let max=mix(normalMax,boostMax,S.boostMix);
  let speed=Math.max(S.throttle,boost?S.boostMix*.72:0)*max;
  desired=V.mul(Q.rot([0,0,-1],S.q),speed);
  let strafe=ctl.strafe;
  desired=V.add(desired,V.mul(Q.rot([1,0,0],S.q),strafe*Math.min(130,Math.max(20,clear*.35))));
  if(!brake&&!S.drift)S.velocity=velocityStep(S.velocity,desired,S.air>.1?4.6:3,Math.max(650,max*3.5),dt);
  S.flightPhase=brake?'BRAKE':S.drift?'DRIFT':S.boost?'BOOST':S.speed<.5?'HOLD':'MANUAL';
 }
 if(S.throttle===0&&!boost&&!S.drift&&V.len(S.velocity)<.001)S.velocity=[0,0,0];
 const collision=solveCollision(old,V.add(old,V.mul(S.velocity,dt)));
 S.pos=collision.pos;
 if(collision.hit){
  let n=V.norm(V.sub(S.pos,collision.hit.pos));
  S.velocity=V.mul(V.sub(S.velocity,V.mul(n,Math.min(0,V.dot(S.velocity,n)))),.2);S.throttle=0;S.stats.contacts++;
  if(S.auto||S.guide)cancelAssist(false);
  if(S.time-lastContactNotice>2){notice('SURFACE PROTECTION / THRUST LIMITED',3);kit.input.rumble(.55,160);sfx('warn');lastContactNotice=S.time;event('surface-protection',{body:collision.hit.name})}
 }
 S.speed=V.len(S.velocity);S.stats.distance+=V.dist(old,S.pos);S.stats.maxSpeed=Math.max(S.stats.maxSpeed,S.speed);career.distance+=V.dist(old,S.pos);career.maxSpeed=Math.max(career.maxSpeed,S.speed);
 if(S.boost&&S.speed>100){S.stats.boostTime+=dt;if(S.stats.boostTime>.5)S.checks.boost=true}
 S.transitFX=rateStep(S.transitFX,S.auto&&['approach','cruise','descend'].includes(S.auto.mode)&&S.speed>1600?1:0,3,dt);
 S.fov=rateStep(S.fov,prefs.reduceMotion?65:65+S.boostMix*10+S.transitFX*14,3,dt);
 S.cameraQ=prefs.reduceMotion?S.q.slice():Q.slerp(S.cameraQ,S.q,1-Math.exp(-dt*12));
 S.visualBank=rateStep(S.visualBank,prefs.reduceMotion?0:clamp(S.angular[1]*.2+S.mouseTurn[1]*.8,-.34,.34),9,dt);
 findNearest();
 if(S.saveTimer>5){S.saveTimer=0;saveFlight()}
 if(S.time>S.noticeUntil)$('notice').classList.remove('show');
 updateAudio();
}

// A stable seeded field of nearby dust. All bright star points use actual system coordinates.
const dustRng=rng(8182),dust=Array.from({length:kit.detail(420,120)},()=>({x:(dustRng()-.5)*560,y:(dustRng()-.5)*360,z:-dustRng()*1500,c:dustRng()}));
let frameCount=0,fps=60;
/* The starfield and the dust streaks refill the same typed arrays every frame (no per-frame garbage). */
let starBuf=new Float32Array(0);
const dustBuf=new Float32Array(dust.length*12),DUST_COLORS=[[.7,.34,.9],[.2,.6,.85],[.8,.83,1]];
function drawStarfield(cp){
 const stars=S.stars,n=stars.length,px=S.pos[0],py=S.pos[1],pz=S.pos[2];
 if(starBuf.length<n*7)starBuf=new Float32Array(n*7);
 let j=0;
 for(let i=0;i<n;i++){
  const s=stars[i],p=s.pos,c=s.color,d=Math.hypot(p[0]-px,p[1]-py,p[2]-pz);
  starBuf[j]=p[0]-cp[0];starBuf[j+1]=p[1]-cp[1];starBuf[j+2]=p[2]-cp[2];
  starBuf[j+3]=c[0];starBuf[j+4]=c[1];starBuf[j+5]=c[2];starBuf[j+6]=clamp(2.4+220000/Math.max(d,15000),2.1,6.5);j+=7;
 }
 R.points(starBuf.subarray(0,j),1);
}
function drawDust(dt,q,cp){
 const speedFX=clamp(S.speed/1100,0,1),warp=S.transitFX*clamp(S.speed/14000,0,1);
 const r=Q.rot([1,0,0],q),u=Q.rot([0,1,0],q),b=Q.rot([0,0,1],q),ox=S.pos[0]-cp[0],oy=S.pos[1]-cp[1],oz=S.pos[2]-cp[2];
 const advance=dt*(50+Math.min(S.speed,10000)*.6),tail=3+speedFX*75+warp*270;let j=0;
 for(const d of dust){
  d.z+=advance;if(d.z>40)d.z=-1500;
  const col=DUST_COLORS[d.c>.7?0:d.c>.35?1:2],sx=ox+r[0]*d.x+u[0]*d.y,sy=oy+r[1]*d.x+u[1]*d.y,sz=oz+r[2]*d.x+u[2]*d.y,tz=d.z-tail;
  dustBuf[j]=sx+b[0]*d.z;dustBuf[j+1]=sy+b[1]*d.z;dustBuf[j+2]=sz+b[2]*d.z;dustBuf[j+3]=col[0];dustBuf[j+4]=col[1];dustBuf[j+5]=col[2];
  dustBuf[j+6]=sx+b[0]*tz;dustBuf[j+7]=sy+b[1]*tz;dustBuf[j+8]=sz+b[2]*tz;dustBuf[j+9]=col[0]*.13;dustBuf[j+10]=col[1]*.13;dustBuf[j+11]=col[2]*.13;j+=12;
 }
 R.lines(dustBuf,(.12+speedFX*.43+warp*.28)*(1-S.air*.35));
}
function render(dt=.016){if(!R)return;if($('ship-bay').classList.contains('open')){renderShipBay();return;}if($('atlas').classList.contains('open')){drawAtlas();if(frameCount++%6===0)updateHUD();return}R.resize(gameQuality());let q=S.q,cq=prefs.reduceMotion?q:S.cameraQ,shipScale=surfaceShipScale(),camOffset=Q.rot(V.mul([0,8,28+(prefs.reduceMotion?0:S.boostMix*3)],shipScale),cq),cam=surfaceCamera({pos:V.add(S.pos,camOffset),q:cq});let radial=S.nearest?V.norm(V.sub(S.pos,S.nearest.pos)):[0,1,0];R.begin(cam,S.fov,S.air,radial,{planet:S.nearest,sun:makeStar(S.currentId),time:S.time,exposure:prefs.exposure,bloom:prefs.bloom,...surfaceEnvironment(cam,shipScale)});
 // Distant stars are drawn first, so a planet naturally occludes the starfield.
 drawStarfield(cam.pos);
 let bodies=[];for(let sys of S.active){for(let p of sys.planets)if(V.dist(S.pos,p.pos)<180000)bodies.push(p);let star=sys.star;if(V.dist(S.pos,star.pos)<170000){R.draw(R.shell,star.pos,{scale:star.radius,kind:2,emission:1.7,color:star.color,fog:false});let d=V.dist(cam.pos,star.pos),size=clamp(star.radius/d*innerHeight/R.tan*3,8,180);R.points([...V.sub(star.pos,cam.pos),...star.color,size],.9)}}
 bodies.sort((a,b)=>V.dist(b.pos,S.pos)-V.dist(a.pos,S.pos));for(let p of bodies){let alt=surfaceDistance(p),detail=alt<p.radius*.25?(gameQuality()>=.8?88:48):alt<p.radius*2?(gameQuality()>=.8?46:32):22;R.planet(p,detail,makeStar(p.systemId))}
 drawSurfaceWorld();
 // Engine and stellar-travel streaks are in the ship's local moving frame.
 if(!surfaceOwnsFlight()&&!prefs.reduceMotion&&S.speed>2)drawDust(dt,q,cam.pos);
 let shipQ=prefs.reduceMotion?q:Q.mul(q,Q.axis([0,0,1],S.visualBank));drawAurora(R,S.pos,R.rotation(shipQ),'materials',{scale:shipScale,hatch:Surf.ramp,idle:surfaceEnginesOff()});drawSurfaceModules(R,S.pos,shipQ,shipScale,Surf.gear,Surf.ramp,Surf.site?.feetY,Surf.site?.rampY);auroraDrive(R,S.pos,shipQ,S.speed,S.boostMix,!surfaceEnginesOff(),shipScale,surfaceEnginesOff()?0:1);R.end();
 updateMarkers();updateFlightNavigation();frameCount++;updateHUD();
}
function updateLocal(){let sys=getSystem(makeStar(S.currentId));txt('world-count',String(sys.planets.length).padStart(2,'0'));$('local-worlds').innerHTML='';sys.planets.forEach(p=>{let b=document.createElement('button');b.className='local-item'+(S.selected?.id===p.id?' selected':'');let rgb=p.palette.air.map(x=>Math.round(x*255)).join(',');b.innerHTML=`<span class="planet-icon" style="--pc:rgb(${rgb})"></span><span class="local-copy"><b>${p.name.toUpperCase()}</b><small>${p.palette.name}</small></span><span class="local-range" data-range-id="${p.id}"></span>`;b.onclick=()=>select(p);$('local-worlds').appendChild(b)})}
const bars=Array.from({length:25},()=>{let i=document.createElement('i');$('throttle-bars').appendChild(i);return i});
const stepEls=[...document.querySelectorAll('.step')];
function updateHUD(){let speed=S.speed;txt('speed',speed<100?speed.toFixed(1):speed<10000?Math.round(speed).toLocaleString('en-US'):(speed/1000).toFixed(1));txt('speed-unit',speed<10000?'km/s':'Mm/s');txt('thrust',String(Math.round(S.throttle*100)).padStart(3,'0'));bars.forEach((b,i)=>{const c=(i<S.throttle*25?'on':'')+(S.boost||S.cruise?' hot':'');if(b.className!==c)b.className=c});txt('drive-name',S.drift?'DRIFT':S.cruise?'STAR DRIVE':S.auto?.mode==='approach'?'TRANSFER':S.boost?'BOOST':'FLIGHT');txt('boost-status',S.boost?'BOOST ACTIVE':S.cruise?'DRIVE ACTIVE':'DRIVE READY');txt('altitude',formatDistance(Math.max(0,S.clearance)));let current=makeStar(S.currentId),deep=V.dist(S.pos,current.pos)>90000;txt('system-name',deep?'INTERSTELLAR SPACE':current.name.toUpperCase());txt('sector','SECTOR '+S.worldCell.replaceAll(':','.')+' / SEED 042');txt('flight-state',S.clearance<42?'SURFACE FLIGHT':S.air>.02?'ATMOSPHERIC FLIGHT':deep?'DEEP SPACE':'ORBITAL SPACE');
 let mode=!S.started?'FLIGHT ASSIST / STANDBY':S.cruise?'STAR DRIVE / TRANSIT':S.boost?'BOOST DRIVE / ACTIVE':S.auto?.mode==='descend'?'ATMOSPHERIC DESCENT':S.auto?.mode==='orbit'?'ORBIT ASSIST / ACTIVE':S.auto?'FLIGHT ASSIST / APPROACH':S.speed<.5?'HOVER HOLD':S.drift?'DRIFT / DAMPERS OFF':'MANUAL FLIGHT';txt('mode-label',mode);$('mode-label').classList.toggle('boost',S.boost||S.cruise);
 let f=Q.rot([0,0,-1],S.q),hdg=(Math.atan2(f[0],-f[2])*180/Math.PI+360)%360,pitch=Math.asin(clamp(f[1],-1,1))*180/Math.PI;txt('heading','HDG '+String(Math.round(hdg)%360).padStart(3,'0')+'° / PITCH '+(pitch>=0?'+':'')+Math.round(pitch)+'°');
 updateNavigationHUD();
 if(S.selected){txt('target-name',S.selected.name.toUpperCase());txt('target-type',S.selected.kind==='star'?'STAR SYSTEM':S.selected.palette.name);txt('target-distance',formatDistance(targetDistance(S.selected)));txt('approach-label',S.auto?'CANCEL COURSE':S.selected.kind==='star'?'STAR TRANSFER':'FAST TRANSFER');$('descend-btn').disabled=S.selected.kind!=='planet'}
 let n=Object.values(S.checks).filter(Boolean).length;txt('route-count',String(n).padStart(2,'0')+' / 05');let found=false;stepEls.forEach((el,i)=>{const done=!!S.checks[el.dataset.step];el.classList.toggle('done',done);el.classList.toggle('current',!done&&!found);if(!done)found=true;const mark=done?'✓':String(i+1),icon=el.firstElementChild;if(icon.textContent!==mark)icon.textContent=mark});if(n===5&&$('route-footer').dataset.done!=='1'){$('route-footer').dataset.done='1';$('route-footer').innerHTML='FIRST CONTACT COMPLETE.<br>KEEP EXPLORING.';if(S.started){notice('FIRST CONTACT COMPLETE / '+K('log')+' OPENS THE EXPLORER LOG',6);sfx('rank')}}if($('settings').classList.contains('open'))txt('graphics-info',`${R.backend} / ${Math.round(fps)} FPS / ${Math.round(R.triangles).toLocaleString()} TRIANGLES / ${kit.tier.name.toUpperCase()} QUALITY`);
 updateSurfaceHUD();
}
/* One destination record and one distance convention for every navigation view.
   Positions are double-precision world kilometres. Charts only project them. */
function resolveDestination(id){
 if(typeof id!=='string'||!/^(-?\d+:){3}\d+(\/p\d+)?$/.test(id))throw Error('Invalid destination ID');
 const [starId,index]=id.split('/p');
 if(index===undefined)return makeStar(starId);
 const body=getSystem(makeStar(starId)).planets[Number(index)];
 if(!body)throw Error('Unknown planet ID');
 return body;
}
function routeRemaining(auto=S.auto){
 if(!auto?.point)return 0;
 let length=V.dist(S.pos,auto.point),prev=auto.point;
 for(const next of auto.route||[]){length+=V.dist(prev,next);prev=next}
 return length;
}
function navigationMetrics(obj){
 const delta=V.sub(obj.pos,S.pos),centerDistance=V.len(delta),range=targetDistance(obj);
 return {id:obj.id,name:obj.name,kind:obj.kind,position:obj.pos.slice(),centerDistance,range,
  formattedRange:formatDistance(range),closingSpeed:V.dot(S.velocity,V.norm(delta)),
  systemId:obj.kind==='star'?obj.id:obj.systemId};
}
function navigationSnapshot(){
 const obj=S.selected,active=S.auto;
 return {...navigationMetrics(obj),activeTargetId:active?.obj.id||null,routeRemaining:routeRemaining(),
  arrivalPoint:active?.finalPoint?.slice()||null,waypoint:active?.point?.slice()||null,
  route:active?.route?.map(p=>p.slice())||[],phase:S.flightPhase,
  rangeConvention:'3D distance to the destination surface',chartView:mapView};
}
function speedText(speed){return Math.abs(speed)>=10000?(speed/1000).toFixed(1)+' Mm/s':Math.round(speed).toLocaleString('en-US')+' km/s'}
function updateNavigationHUD(){
 if(!$('target-id'))return;
 txt('target-id',S.selected.id);
 txt('range-label','RANGE TO SURFACE');
 const nav=navigationMetrics(S.selected);
 txt('closing-speed',(nav.closingSpeed>=0?'CLOSING ':'OPENING ')+speedText(Math.abs(nav.closingSpeed)));
 for(const el of ($('atlas').classList.contains('open')?document:$('local-worlds')).querySelectorAll('[data-range-id]')){const t=formatDistance(targetDistance(resolveDestination(el.dataset.rangeId)));if(el.textContent!==t)el.textContent=t}
 const active=S.auto?.point,strip=$('travel-strip');
 strip.classList.toggle('active',Boolean(active)&&S.started);
 if(active){
  const remaining=routeRemaining(),fraction=clamp(1-remaining/Math.max(1,S.auto.startDistance),0,1);
  txt('travel-phase',S.flightPhase);
  txt('travel-name',S.auto.obj.name.toUpperCase());
  txt('travel-range-label',S.auto.mode==='descend'?'TO HOVER':S.auto.obj.kind==='star'?'TO ARRIVAL':'TO ORBIT');
  txt('travel-range',formatDistance(remaining));
  $('travel-progress').style.width=(fraction*100).toFixed(1)+'%';
  txt('travel-complete',Math.round(fraction*100)+'%');
  txt('route-detail',(S.auto.route?.length?S.auto.route.length+' CLEARANCE POINTS':'DIRECT COURSE')+' / AUTO BRAKE');
 }
 txt('flight-feel',S.drift?'DAMPERS OFF / DRIFT':S.boost?'BOOST / HOLD SHIFT':'DAMPERS ON');
}
function rayBody(body,origin,direction){
 // Refine the base sphere against the same surface function as the renderer.
 let radius=body.radius,near=Infinity;
 for(let i=0;i<(body.kind==='planet'?3:1);i++){
  let oc=V.sub(origin,body.pos),b=V.dot(oc,direction),c=V.dot(oc,oc)-radius*radius,disc=b*b-c;
  if(disc<0)return Infinity;
  near=-b-Math.sqrt(disc);if(near<0)near=-b+Math.sqrt(disc);
  if(near<0)return Infinity;
  if(body.kind==='planet')radius=body.radius+heightAt(V.norm(V.sub(V.add(origin,V.mul(direction,near)),body.pos)),body);
 }
 return near;
}
function pickDestination(x,y,padding=12){
 if(!R.cam)return null;
 const nx=(x/innerWidth-.5)*2*R.tan*R.aspect,ny=(.5-y/innerHeight)*2*R.tan;
 const dir=V.norm(V.add(R.forward,V.add(V.mul(R.right,nx),V.mul(R.up,ny))));
 let result=null,depth=Infinity;
 for(const sys of S.active)for(const obj of [...sys.planets,sys.star]){
  if(V.dist(S.pos,obj.pos)>(obj.kind==='star'?170000:180000))continue;
  const t=rayBody(obj,R.cam.pos,dir);if(t<depth){depth=t;result=obj}
 }
 // Padding is for distant point lights, not for hidden planets.
 let pixelDistance=padding;
 for(const star of S.stars){
  let projected=R.project(star.pos);if(!projected.front||V.dist(R.cam.pos,star.pos)>depth)continue;
  let pixels=Math.hypot(projected.x-x,projected.y-y);
  if(pixels<pixelDistance&&!occluded(star.pos)){result=star;pixelDistance=pixels}
 }
 return result;
}
let markerElements=new Map();
function updateMarkers(){
 const keep=new Set(),objects=getSystem(makeStar(S.currentId)).planets.slice();
 if(!objects.some(p=>p.id===S.selected.id))objects.push(S.selected);
 const occupied=[];
 for(const obj of objects.sort((a,b)=>(b.id===S.selected.id)-(a.id===S.selected.id))){
  let d=V.dist(S.pos,obj.pos),selected=obj.id===S.selected.id;
  if(obj.kind==='planet'&&d<obj.radius*1.12)continue;
  let pos=obj.pos;
  if(obj.kind==='planet'){
   const n=V.norm(V.sub(S.pos,obj.pos));
   pos=V.add(obj.pos,V.add(V.mul(n,obj.radius*.68),V.mul(R.up,obj.radius*.55)));
  }
  const pp=R.project(pos);
  const left=innerWidth<760?32:225,right=innerWidth<760?36:235;
  if(!pp.front||occluded(pos,obj.id)||pp.x<left||pp.x>innerWidth-right||pp.y<160||pp.y>innerHeight-270)continue;
  if(occupied.some(p=>Math.abs(p.x-pp.x)<110&&Math.abs(p.y-pp.y)<36)&&!selected)continue;
  occupied.push(pp);keep.add(obj.id);
  let el=markerElements.get(obj.id);
  if(!el){
   el=document.createElement('button');el.className='world-marker';el.dataset.id=obj.id;
   el.innerHTML='<span class="diamond"></span><span class="marker-name"></span><small></small>';
   el.onclick=()=>select(resolveDestination(el.dataset.id));
   el.querySelector('.marker-name').textContent=obj.name.toUpperCase();el._range=el.querySelector('small');
   $('markers').appendChild(el);markerElements.set(obj.id,el);
  }
  el.classList.toggle('selected',selected);el.style.left=pp.x+'px';el.style.top=pp.y+'px';
  const range=formatDistance(targetDistance(obj));if(el._range.textContent!==range)el._range.textContent=range;
 }
 for(const [id,el]of markerElements)if(!keep.has(id)){el.remove();markerElements.delete(id)}
}
function updateFlightNavigation(){
 if(!R.cam)return;
 const arrow=$('bearing'),lock=$('target-lock'),obj=S.selected;
 let pp=R.project(obj.pos),hidden=occluded(obj.pos,obj.id);
 const padX=innerWidth<760?35:260,padY=innerWidth<760?170:185;
 const onscreen=pp.front&&pp.x>=padX&&pp.x<innerWidth-padX&&pp.y>=padY&&pp.y<innerHeight-255;
 const tooClose=obj.kind==='planet'&&targetDistance(obj)<obj.radius*.16;
 arrow.style.display=S.started&&!markerElements.has(obj.id)&&!tooClose&&(!onscreen||hidden)?'flex':'none';
 lock.style.display=S.started&&onscreen&&!hidden&&!tooClose?'block':'none';
 if(onscreen&&!hidden&&!tooClose){
  const radius=clamp(obj.radius/Math.max(pp.z,1)*innerHeight/(R.tan*2)+12,18,125);
  lock.style.width=radius*2+'px';lock.style.height=radius*2+'px';lock.style.left=pp.x+'px';lock.style.top=pp.y+'px';
 }
 if(S.started&&(!onscreen||hidden||tooClose)){
  let d=V.sub(obj.pos,R.cam.pos),dx=V.dot(d,R.right),dy=-V.dot(d,R.up);
  if(Math.abs(dx)+Math.abs(dy)<1)dy=1;
  const length=Math.hypot(dx,dy);dx/=length;dy/=length;
  let cx=innerWidth/2,cy=innerHeight/2,
   marginX=Math.max(100,cx-padX),marginY=Math.max(60,Math.min(cy-padY,innerHeight-260-cy));
  const t=Math.min(marginX/(Math.abs(dx)||.001),marginY/(Math.abs(dy)||.001));
  arrow.style.left=cx+dx*t+'px';arrow.style.top=cy+dy*t+'px';
  $('bearing-arrow').style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
  txt('bearing-name',obj.name.toUpperCase());
  txt('bearing-range',formatDistance(targetDistance(obj)));
  txt('bearing-state',tooClose?'BELOW':hidden?'OCCLUDED':!pp.front?'BEHIND YOU':'OFF SCREEN');
 }
 const fp=$('velocity-vector');
 if(S.speed>8&&S.started){
  const v=R.project(V.add(S.pos,V.mul(V.norm(S.velocity),1800)));
  fp.style.display=v.front&&v.x>20&&v.x<innerWidth-20&&v.y>100&&v.y<innerHeight-240?'block':'none';
  fp.style.left=v.x+'px';fp.style.top=v.y+'px';
 }else fp.style.display='none';
 const tooltip=$('target-hover');
 let hover=hoverPointer&&!drag.active&&S.started&&!S.paused&&!surfaceOwnsFlight()?pickDestination(hoverPointer.x,hoverPointer.y):null;
 tooltip.style.display=hover?'block':'none';
 if(hover){
  tooltip.textContent=hover.name.toUpperCase()+' / '+formatDistance(targetDistance(hover))+' / CLICK TO TARGET';
  tooltip.style.left=clamp(hoverPointer.x+16,15,innerWidth-285)+'px';
  tooltip.style.top=clamp(hoverPointer.y+20,95,innerHeight-245)+'px';
 }
 const waypoint=$('waypoint-marker');
 if(S.auto?.point&&(S.auto.route.length>0||S.auto.mode==='descend')){
  const p=R.project(S.auto.point);
  waypoint.style.display=p.front&&p.x>220&&p.x<innerWidth-225&&p.y>150&&p.y<innerHeight-230?'block':'none';
  waypoint.style.left=p.x+'px';waypoint.style.top=p.y+'px';
  waypoint.querySelector('small').textContent=(S.auto.route.length?'CLEARANCE':'ARRIVAL')+' / '+formatDistance(V.dist(S.pos,S.auto.point));
 }else waypoint.style.display='none';
}

// A chart is a projection. Its displayed range always uses all three axes.
let mapSelected=S.selected,mapView='system',chartSystemId=HOME,mapPlane='xz';
let mapScale=.01,mapCenter=[0,0,0],mapPan=[0,0],mapPoints=[],mapDragging=null,mapMoved=false,mapOffset=[0,0],mapHover=null;
function chartObjects(){return mapView==='system'?[getSystem(makeStar(chartSystemId)).star,...getSystem(makeStar(chartSystemId)).planets]:S.stars}
function planePoint(p){return [p[0],mapPlane==='xz'?p[2]:-p[1]]}
function chartProject(p,w,h){const a=planePoint(p),b=planePoint(mapCenter);return [w/2+(a[0]-b[0])*mapScale+mapPan[0],h/2+(a[1]-b[1])*mapScale+mapPan[1]]}
function fitChart(){
 const rect=$('map-canvas').getBoundingClientRect(),w=Math.max(220,rect.width),h=Math.max(260,rect.height);
 mapPan=[0,0];
 if(mapView==='system'){
  let objects=chartObjects().map(o=>o.pos),star=makeStar(chartSystemId);
  if(V.dist(S.pos,star.pos)<110000)objects.push(S.pos);
  const points=objects.map(planePoint),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  mapCenter=star.pos.slice();mapCenter[0]=(minX+maxX)/2;
  if(mapPlane==='xz')mapCenter[2]=(minY+maxY)/2;else mapCenter[1]=-(minY+maxY)/2;
  const largest=Math.max(...chartObjects().map(o=>o.radius))*4;
  mapScale=Math.min(Math.max(100,w-135)/(maxX-minX+largest),Math.max(100,h-160)/(maxY-minY+largest));
 }else{
  mapCenter=S.pos.slice();
  const range=Math.max(800000,V.dist(S.pos,S.selected.pos)*1.4);
  mapScale=Math.min(w,h)/Math.min(range*2,6500000);
 }
 drawAtlas();
}
function chartSelect(obj){
 select(obj,false);mapSelected=S.selected;
 updateMapDetails();updateStarList();drawAtlas();
}
function changeChart(view){
 mapView=view;
 if(view==='system')chartSystemId=S.selected.kind==='star'?S.selected.id:S.selected.systemId;
 $('star-search').value='';updateChartTabs();updateStarList();updateMapDetails();fitChart();
}
function updateChartTabs(){
 $('chart-system').classList.toggle('active',mapView==='system');
 $('chart-stars').classList.toggle('active',mapView==='stars');
 $('chart-system').setAttribute('aria-selected',String(mapView==='system'));
 $('chart-stars').setAttribute('aria-selected',String(mapView==='stars'));
 txt('chart-title',mapView==='system'?makeStar(chartSystemId).name.toUpperCase()+' SYSTEM':'NEARBY STARS');
 txt('chart-subtitle',mapView==='system'?'Select a world. The transfer drive brakes before orbit.':'Select any plotted star. Open its system to choose a world.');
 txt('map-legend-text',mapView==='system'?'TRUE POSITIONS / SYSTEM CHART':'TRUE POSITIONS / STAR CHART');
 $('star-search').placeholder=mapView==='system'?'Find a world or star…':'Find a star or catalog ID…';
 txt('plane-btn',mapPlane==='xz'?'TOP / XZ':'FRONT / XY');
}
function updateStarList(){
 const query=$('star-search').value.trim().toLowerCase();
 const objects=chartObjects().filter(s=>!query||s.name.toLowerCase().includes(query)||s.id.toLowerCase().includes(query))
  .sort((a,b)=>targetDistance(a)-targetDistance(b));
 const shown=objects.slice(0,100);
 if(!shown.some(o=>o.id===S.selected.id)&&objects.some(o=>o.id===S.selected.id))shown[shown.length-1]=S.selected;
 txt('star-count',objects.length>100?'100 SHOWN / '+objects.length.toLocaleString()+' SIGNALS':objects.length+' DESTINATIONS');
 const list=$('star-list');let scroll=list.scrollTop;list.innerHTML='';
 for(const obj of shown){
  let row=document.createElement('button');row.className='star-row'+(S.selected.id===obj.id?' selected':'');row.dataset.id=obj.id;
  let a=document.createElement('span');a.className='chart-row-name';
  let dot=document.createElement('i');dot.className=obj.kind==='star'?'chart-dot star':'chart-dot';
  dot.style.background=obj.kind==='star'?'#ffd192':`rgb(${obj.palette.air.map(x=>Math.round(x*255)).join(',')})`;
  a.append(dot,document.createTextNode(obj.name.toUpperCase()));
  let b=document.createElement('small');b.textContent=formatDistance(targetDistance(obj));b.dataset.rangeId=obj.id;
  row.append(a,b);row.onclick=()=>chartSelect(obj);list.appendChild(row);
 }
 if(!shown.length){let p=document.createElement('p');p.className='chart-empty';p.textContent='No matching destination. Search by name or catalog ID.';list.appendChild(p)}
 list.scrollTop=scroll;
}
function updateMapDetails(){
 const s=S.selected;mapSelected=s;
 txt('map-star-name',s.name.toUpperCase());
 txt('map-distance',formatDistance(targetDistance(s)));
 txt('map-kind',s.kind==='star'?'STAR SYSTEM':s.palette.name);
 txt('map-worlds-label',s.kind==='star'?'WORLDS':'RADIUS');
 txt('map-worlds',s.kind==='star'?getSystem(s).planets.length:formatDistance(s.radius));
 txt('map-seed',s.id);
 txt('map-visited',S.visited.has(s.kind==='star'?s.id:s.systemId)?'SYSTEM VISITED':'UNEXPLORED');
 const axis=mapPlane==='xz'?1:2,offset=s.pos[axis]-S.pos[axis];
 txt('map-elevation',(offset<0?'−':'+')+formatDistance(Math.abs(offset)));
 txt('map-axis-label',mapPlane==='xz'?'Y OFFSET':'Z OFFSET');
 txt('set-course-btn',s.kind==='star'?'FLY TO SYSTEM ↗':'FLY TO ORBIT ↗');
 $('open-system-btn').style.display=s.kind==='star'?'block':'none';
 $('map-preview').classList.toggle('is-star',s.kind==='star');
 $('map-preview').classList.toggle('has-rings',Boolean(s.rings));
 const rgb=(s.kind==='star'?s.color:s.palette.air).map(x=>Math.round(x*255)).join(',');
 $('map-preview').style.setProperty('--body-color','rgb('+rgb+')');
 txt('map-stop-note',s.kind==='star'?'Safe arrival point: 24,500 km above the star surface.':'Arrival stops in orbit. Press G to descend to terrain.');
}
function niceLength(value){const power=10**Math.floor(Math.log10(Math.max(.001,value)));const n=value/power;return (n>=5?5:n>=2?2:1)*power}
function drawAtlas(){
 const c=$('map-canvas'),rect=c.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,1.5);
 if(w<1||h<1)return;
 if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
 const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const project=p=>chartProject(p,w,h);
 const gridLength=niceLength(90/mapScale),grid=gridLength*mapScale;
 const [gx,gy]=project(mapCenter);
 ctx.strokeStyle='#7fbae30b';ctx.lineWidth=1;ctx.beginPath();
 for(let x=((gx%grid)+grid)%grid;x<w;x+=grid){ctx.moveTo(x,0);ctx.lineTo(x,h)}
 for(let y=((gy%grid)+grid)%grid;y<h;y+=grid){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke();
 const objects=chartObjects(),[px,py]=project(S.pos);
 if(mapView==='system'){
  const sys=getSystem(makeStar(chartSystemId)),[sx,sy]=project(sys.star.pos),sp=planePoint(sys.star.pos);
  ctx.strokeStyle='#7398d018';ctx.setLineDash([2,5]);
  // Reference circles show projected radius. Bodies do not orbit in this slice.
  for(const planet of sys.planets){let p=planePoint(planet.pos),radius=Math.hypot(p[0]-sp[0],p[1]-sp[1])*mapScale;
   ctx.beginPath();ctx.arc(sx,sy,radius,0,Math.PI*2);ctx.stroke()}
  ctx.setLineDash([]);
 }else{
  const ring=niceLength(180/mapScale);ctx.font='9px "Courier New"';
  for(let i=1;i<=5;i++){let rad=ring*i*mapScale;ctx.strokeStyle='#82b1ed17';ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#566783';ctx.fillText(formatDistance(ring*i),px+7,py-rad-5)}
 }
 const target=S.selected,[tx,ty]=project(target.pos);
 ctx.lineWidth=1.2;ctx.strokeStyle='#ff946880';ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(px,py);
 if(S.auto?.point&&S.auto.obj.id===target.id){
  for(const wp of [S.auto.point,...S.auto.route]){let a=project(wp);ctx.lineTo(...a)}
 }else ctx.lineTo(tx,ty);
 ctx.stroke();ctx.setLineDash([]);
 if(S.auto?.point){for(const wp of [S.auto.point,...S.auto.route]){let[x,y]=project(wp);ctx.strokeStyle='#ffd4bd';ctx.strokeRect(x-3,y-3,6,6)}}
 mapPoints=[];const usedLabels=[];const query=$('star-search').value.trim().toLowerCase();
 const sorted=objects.slice().sort((a,b)=>(a.id===S.selected.id)-(b.id===S.selected.id));
 for(const obj of sorted){
  const [x,y]=project(obj.pos);if(x<-30||x>w+30||y<-30||y>h+30)continue;
  const chosen=obj.id===target.id;
  const color=obj.kind==='star'?obj.color:obj.palette.air,rgb=color.map(v=>Math.round(v*255)).join(',');
  const match=!query||obj.name.toLowerCase().includes(query)||obj.id.includes(query);
  const radius=mapView==='system'?clamp(obj.radius*mapScale,6,32):chosen?4:obj.id===S.currentId?3:1.6;
  ctx.globalAlpha=match?1:.2;
  if(mapView==='system'){
   if(obj.rings){ctx.save();ctx.translate(x,y);ctx.rotate(-.35);ctx.strokeStyle=`rgba(${rgb},.5)`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,radius*1.85,radius*.48,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
   ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.clip();ctx.fillStyle=`rgb(${rgb})`;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
   ctx.fillStyle=obj.kind==='star'?'#ffffff22':'#100c3c80';ctx.beginPath();ctx.moveTo(x-radius*.4,y-radius);ctx.lineTo(x+radius*.2,y-radius*.15);ctx.lineTo(x-radius*.15,y+radius*.4);ctx.lineTo(x+radius*.8,y+radius);ctx.lineTo(x+radius,y+radius);ctx.lineTo(x+radius,y-radius);ctx.fill();
   ctx.fillStyle='#00000050';ctx.beginPath();ctx.arc(x+radius*.8,y+radius*.1,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }else{ctx.fillStyle=chosen?'#ffac87':S.visited.has(obj.id)?'#7ae5ee':`rgba(${rgb},.63)`;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill()}
  if(chosen){ctx.strokeStyle='#ff9c73';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,radius+8,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ff9c7333';ctx.beginPath();ctx.arc(x,y,radius+15,0,Math.PI*2);ctx.stroke()}
  if(mapView==='system'||chosen||obj.id===S.currentId){
   const lx=x+radius+13,ly=y-7;
   if(chosen||!usedLabels.some(p=>Math.abs(p.x-lx)<95&&Math.abs(p.y-ly)<33)){
    ctx.font='10px "Courier New"';ctx.fillStyle=chosen?'#ffbc9f':'#d2dce8';ctx.textAlign=lx>w-110?'right':'left';let textX=lx>w-110?x-radius-13:lx;
    ctx.fillText(obj.name.toUpperCase(),textX,ly);
    ctx.font='9px "Courier New"';ctx.fillStyle='#8a9cae';ctx.fillText(formatDistance(targetDistance(obj)),textX,ly+15);ctx.textAlign='left';usedLabels.push({x:lx,y:ly});
   }
  }
  ctx.globalAlpha=1;mapPoints.push({s:obj,x,y,radius:Math.max(radius+7,12)});
 }
 // The ship arrow has the same heading as the flight model.
 if(px>-12&&px<w+12&&py>-12&&py<h+12){
  const f=Q.rot([0,0,-1],S.q),heading=mapPlane==='xz'?Math.atan2(f[2],f[0]):Math.atan2(-f[1],f[0]);
  ctx.save();ctx.translate(px,py);ctx.rotate(heading);ctx.strokeStyle='#81f1ee26';ctx.fillStyle='#81f1ee0b';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,48,-.45,.45);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#a8ffff';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-3,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();ctx.restore();ctx.font='9px "Courier New"';ctx.fillStyle='#a8ffff';ctx.fillText('YOU',px+12,py+22);
 }else{ctx.font='9px "Courier New"';ctx.fillStyle='#a8ffff';ctx.fillText('SHIP OUTSIDE CHART',20,h-59)}
 const length=niceLength(100/mapScale),bar=length*mapScale;
 ctx.strokeStyle='#788da9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(22,h-40);ctx.lineTo(22+bar,h-40);ctx.moveTo(22,h-44);ctx.lineTo(22,h-36);ctx.moveTo(22+bar,h-44);ctx.lineTo(22+bar,h-36);ctx.stroke();ctx.font='9px "Courier New"';ctx.fillStyle='#a1b6cc';ctx.fillText(formatDistance(length)+' / PROJECTED',22,h-49);
 const hover=$('map-hover');let hit=mapHover?chartHit(mapHover[0],mapHover[1]):null;
 hover.textContent=hit?hit.name.toUpperCase()+' / '+formatDistance(targetDistance(hit))+' TO SURFACE':'';
}
/** Zoom the chart about a point (canvas pixels; the centre when omitted). */
function zoomChart(factor,x,y){
 const rect=$('map-canvas').getBoundingClientRect();
 if(x===undefined){x=rect.width/2;y=rect.height/2}
 const old=mapScale;mapScale=clamp(old*factor,.000008,.5);const f=mapScale/old;
 mapPan=[x-rect.width/2-(x-rect.width/2-mapPan[0])*f,y-rect.height/2-(y-rect.height/2-mapPan[1])*f];drawAtlas();
}
/** Two-finger pinch on a panel (charts, ship bay): onScale(ratio, clientX, clientY). Returns "is pinching". */
function pinchGesture(el,onScale){
 const pts=new Map();let last=0;
 const span=()=>{const [a,b]=pts.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0};
 el.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});last=span()});
 el.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;if(pts.size<2)return;const d=span();if(last>0&&d>0){const [a,b]=pts.values();onScale(d/last,(a.x+b.x)/2,(a.y+b.y)/2)}last=d});
 const end=e=>{if(pts.delete(e.pointerId))last=span()};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,end);
 return ()=>pts.size>1;
}
function chartHit(x,y){
 let hit=null,best=Infinity;
 for(const p of mapPoints){let distance=Math.hypot(x-p.x,y-p.y);if(distance<=p.radius&&distance<best){hit=p.s;best=distance}}
 return hit;
}
function openAtlas(view){
 if(view==='stars'||view==='system')mapView=view;
 if(mapView==='system')chartSystemId=S.selected.kind==='star'?S.selected.id:S.selected.systemId;
 mapSelected=S.selected;$('star-search').value='';openModal('atlas');
 updateChartTabs();updateStarList();updateMapDetails();fitChart();
}
function chartSnapshot(){
 return {view:mapView,plane:mapPlane,systemId:chartSystemId,selected:S.selected.id,
  range:navigationMetrics(S.selected).range,scale:mapScale,center:mapCenter.slice(),pan:mapPan.slice(),
  points:mapPoints.map(p=>({id:p.s.id,x:p.x,y:p.y,radius:p.radius,position:p.s.pos.slice(),range:targetDistance(p.s)}))};
}
function bindChartControls(){
 $('chart-system').onclick=()=>changeChart('system');$('chart-stars').onclick=()=>changeChart('stars');
 $('fit-chart').onclick=fitChart;
 $('plane-btn').onclick=()=>{mapPlane=mapPlane==='xz'?'xy':'xz';updateChartTabs();updateMapDetails();fitChart()};
 $('open-system-btn').onclick=()=>changeChart('system');
 $('star-search').oninput=()=>{updateStarList();drawAtlas()};
 $('set-course-btn').onclick=()=>{closeModals();engage(S.selected.kind==='star'?'cruise':'approach')};
 $('track-only-btn').onclick=()=>{closeModals();if(!S.started)startFlight();notice('TARGET SET / '+S.selected.name.toUpperCase()+' / F TO TRANSFER')};
 $('bearing').onclick=()=>notice('TURN TOWARD '+S.selected.name.toUpperCase()+' OR PRESS F TO TRANSFER');
 $('target-lock').onclick=()=>select(S.selected);
 const c=$('map-canvas');
 c.addEventListener('wheel',e=>{
  e.preventDefault();const rect=c.getBoundingClientRect();zoomChart(Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top);
 },{passive:false});
 $('zoom-in').onclick=()=>zoomChart(1.6);$('zoom-out').onclick=()=>zoomChart(1/1.6);
 // Pinch zooms about the fingers; a pinch never pans or picks a target.
 const pinching=pinchGesture(c,(ratio,x,y)=>{const r=c.getBoundingClientRect();mapMoved=true;zoomChart(ratio,x-r.left,y-r.top)});
 c.addEventListener('pointerdown',e=>{if(e.button!==0)return;mapDragging=[e.clientX,e.clientY];mapOffset=mapPan.slice();mapMoved=pinching();c.setPointerCapture(e.pointerId)});
 c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();mapHover=[e.clientX-r.left,e.clientY-r.top];
  if(mapDragging&&!pinching()){const dx=e.clientX-mapDragging[0],dy=e.clientY-mapDragging[1];if(Math.hypot(dx,dy)>4)mapMoved=true;mapPan=[mapOffset[0]+dx,mapOffset[1]+dy]}
  drawAtlas();
 });
 c.addEventListener('pointerup',e=>{if(mapDragging&&!mapMoved){const r=c.getBoundingClientRect(),hit=chartHit(e.clientX-r.left,e.clientY-r.top);if(hit)chartSelect(hit)}mapDragging=null});
 c.addEventListener('dblclick',e=>{const r=c.getBoundingClientRect(),hit=chartHit(e.clientX-r.left,e.clientY-r.top);if(hit?.kind==='star'){chartSelect(hit);changeChart('system')}});
 for(const type of ['pointercancel','lostpointercapture'])c.addEventListener(type,()=>mapDragging=null);
 c.addEventListener('pointerleave',()=>{mapHover=null;drawAtlas()});
 window.addEventListener('resize',()=>{if($('atlas').classList.contains('open'))fitChart()});
}

/* VOID EXPLORER / surface operations.
   Flight, catalogs, seeds, and destination records remain owned by v0.3.1.
   This controller owns only final landing, the parked ship, the crew, and lift-off.
   World distances are kilometres. Mechanism dimensions and crew UI use metres. */
function freshSurface(){return {
  mode:'flight',pending:null,gear:0,gearTarget:0,ramp:0,rampTarget:0,
  site:null,phase:'',phaseTime:0,orbitYaw:0,orbitPitch:.12,
  actor:null,transition:null,walkVelocity:[0,0,0],walkSpeed:0,
  checks:{gear:false,land:false,ramp:false,exit:false,walk:false,board:false,flight:false},
  stats:{landings:0,walkDistance:0,maxRange:0,boards:0,takeoffs:0,blocked:0},
  lastWarn:-100,steps:0,walkPath:[],
};}
let Surf=freshSurface();
function surfaceOwnsFlight(){return Surf.mode!=='flight';}
function surfaceEnginesOff(){return ['landed','exiting','onfoot','boarding','closing'].includes(Surf.mode);}
function surfaceShipScale(){return .001+.999*smooth(.16,16,S.clearance);}
function surfaceWorld(local,pose=S.pos,q=S.q){return V.add(pose,Q.rot(V.mul(local,.001),q));}
function surfaceLocal(world,pose=S.pos,q=S.q){return V.mul(Q.rot(V.sub(world,pose),[-q[0],-q[1],-q[2],q[3]]),1000);}
function surfaceWarning(text){if(S.time-Surf.lastWarn>1.8){notice(text,3);Surf.lastWarn=S.time;}}
function surfaceSetMode(mode,phase=''){
  Surf.mode=mode;Surf.phase=phase;Surf.phaseTime=0;kit.input.settle();
  S.mouseTurn=[0,0];S.angular=[0,0,0];
  document.body.classList.toggle('surface-active',mode!=='flight');
  document.body.classList.toggle('on-foot',['exiting','onfoot','boarding'].includes(mode));
  event('surface-mode',{mode,phase,planet:Surf.site?.planet.id});
}
function surfaceGroundY(p,pose,q,x,z){
  const origin=surfaceWorld([x,0,z],pose,q),up=Q.rot([0,1,0],q);
  const signed=y=>{const w=V.add(origin,V.mul(up,y*.001)),d=V.sub(w,p.pos);return V.len(d)-p.radius-heightAt(V.norm(d),p)};
  let lo=-20,hi=20;for(let i=0;i<40;i++){let m=(lo+hi)*.5;if(signed(m)>0)hi=m;else lo=m}return (lo+hi)*.5;
}
function makeLandingSite(p,n,forward=Q.rot([0,0,-1],S.q)){
  n=V.norm(n);const h=heightAt(n,p),ground=V.add(p.pos,V.mul(n,p.radius+h));
  const up=terrainNormal(p,ground),slope=Math.acos(clamp(V.dot(up,n),-1,1))*180/Math.PI;
  if(rawHeight(n,p)<.015||slope>12)return null;
  let tangent=V.sub(forward,V.mul(up,V.dot(forward,up)));
  if(V.len(tangent)<.1)tangent=V.cross(Math.abs(up[1])<.9?[0,1,0]:[1,0,0],up);
  const q=Q.look(V.norm(tangent),up),shipPos=V.add(ground,V.mul(up,.00325));
  const feetY=SurfaceShapes.gearFeet.map(f=>surfaceGroundY(p,shipPos,q,f[0],f[2])+.065);
  const rampY=surfaceGroundY(p,shipPos,q,0,SurfaceShapes.rampEndZ);
  const rampSlope=Math.atan2(-rampY-1.28,SurfaceShapes.rampEndZ-1.15)*180/Math.PI;
  const samples=[[-6.6,-2.40,6.1],[6.6,-2.4,6.1],[-6.6,1.2,-3],[6.6,1.2,-3],[0,-.9,0],[0,-.35,-6.2],[0,-.3,5.5]];
  const hullClearance=Math.min(...samples.map(v=>{const w=surfaceWorld(v,shipPos,q),d=V.sub(w,p.pos);return (V.len(d)-p.radius-heightAt(V.norm(d),p))*1000}));
  if(hullClearance<.35||rampSlope>25||rampSlope<7||feetY.some(y=>y> -2.55||y< -3.90))return null;
  return {planet:p,normal:n,ground,up,q,shipPos,feetY,rampY,slope,rampSlope,hullClearance};
}
function findLandingSite(p){
  const n=V.norm(V.sub(S.pos,p.pos)),east=V.norm(V.cross(Math.abs(n[1])<.9?[0,1,0]:[1,0,0],n)),north=V.cross(n,east);
  for(const r of [0,.0002,.0007,.002,.005,.011,.023,.045,.075])for(let i=0;i<(r?20:1);i++){
    const a=i/20*Math.PI*2,dir=V.norm(V.add(n,V.add(V.mul(east,Math.cos(a)*r),V.mul(north,Math.sin(a)*r))));
    const site=makeLandingSite(p,dir);if(site)return site;
  }return null;
}
function prepareLanding(p){
  const site=findLandingSite(p);
  if(!site){Surf.pending=null;notice('NO SAFE DRY SITE NEARBY / MOVE TO ANOTHER AREA',6);return false;}
  site.scatter=buildSurfaceScatter(site);buildSurvey(site);Surf.site=site;Surf.pending=null;
  const height=Math.max(18,S.clearance),approach=V.add(site.ground,V.mul(site.up,height));
  Surf.landingTarget=approach;Surf.gearTarget=1;Surf.rampTarget=0;Surf.actor=null;
  cancelAssist(false);S.throttle=0;S.boost=false;S.cruise=false;
  surfaceSetMode('landing','ALIGN OVER SITE');
  notice('LANDING SITE FOUND / '+site.slope.toFixed(1)+'° SLOPE / GEAR DEPLOYING',5);
  event('landing-site',{id:p.id,position:site.ground.slice(),slope:site.slope,rampSlope:site.rampSlope});
  return true;
}
function requestLanding(){
  if(['onfoot','exiting','boarding'].includes(Surf.mode)){surfaceWarning('BOARD AURORA BEFORE TAKEOFF');return;}
  if(Surf.mode==='landed'){requestTakeoff();return;}
  if(Surf.mode==='hover'){Surf.landingTarget=Surf.site.shipPos.slice();surfaceSetMode('landing','FINAL DESCENT');return;}
  if(Surf.mode!=='flight')return;
  if(Surf.pending){Surf.pending=null;cancelAssist(false);notice('LANDING CANCELLED / FLIGHT CONTROL');return;}
  const p=S.selected?.kind==='planet'?S.selected:S.nearest;
  if(!p){notice('SELECT A PLANET BEFORE LANDING');return;}
  if(!S.started)startFlight();
  cancelAssist(false);Surf.gearTarget=1;Surf.pending=p.id;
  if(S.nearest?.id===p.id&&S.clearance<45){prepareLanding(p);return;}
  engage('descend',p);notice('LANDING APPROACH / '+p.name.toUpperCase()+' / '+K('gear')+' FOR GEAR',5);
}
function requestTakeoff(){
  if(!['landed','hover'].includes(Surf.mode)){surfaceWarning(Surf.actor?'BOARD AURORA BEFORE TAKEOFF':'LAND FIRST / '+K('land')+' TO LAND');return;}
  Surf.pending=null;Surf.rampTarget=0;Surf.actor=null;Surf.orbitYaw=0;
  surfaceSetMode('closing','SEAL RAMP');S.throttle=0;S.velocity=[0,0,0];
  notice('TAKEOFF CHECK / SEALING RAMP / CREW ABOARD',4);
}
function toggleGear(){
  if(surfaceOwnsFlight()||Surf.pending){surfaceWarning('GEAR LOCKED / REQUIRED FOR SURFACE OPERATIONS');return;}
  Surf.gearTarget=Surf.gearTarget>.5?0:1;
  notice(Surf.gearTarget?'LANDING GEAR / DEPLOYING':'LANDING GEAR / RETRACTING',3);sfx('gear');
}
function toggleRamp(){
  if(Surf.mode!=='landed'){surfaceWarning(Surf.actor?'RAMP LOCKED OPEN / CREW OUTSIDE':'RAMP LOCKED / LAND FIRST');return;}
  Surf.rampTarget=Surf.rampTarget>.5?0:1;
  notice(Surf.rampTarget?'RAMP / OPENING':'RAMP / CLOSING',3);sfx('ramp');
}
function surfaceEyeHeight(foot){const local=surfaceLocal(foot);return V.dist(foot,S.pos)<.015&&Math.abs(local[0])<1.3&&local[2]>.15&&local[2]<6.2?mix(1.38,1.72,smooth(4.6,6.2,local[2])):1.72;}
function crewEye(){
  const a=Surf.actor,up=V.norm(V.sub(a.foot,Surf.site.planet.pos)),eye=V.add(a.foot,V.mul(up,surfaceEyeHeight(a.foot)*.001));
  let forward=Q.rot([Math.sin(a.yaw),0,Math.cos(a.yaw)],S.q);forward=V.norm(V.sub(forward,V.mul(up,V.dot(forward,up))));
  forward=V.norm(V.add(V.mul(forward,Math.cos(a.pitch)),V.mul(up,Math.sin(a.pitch))));
  return {pos:eye,q:Q.look(forward,up)};
}
function interactSurface(){
  if(Surf.mode==='landed'){
    if(Surf.ramp<.999){notice('OPEN THE RAMP FIRST / '+K('ramp'),4);return;}
    Surf.actor={foot:surfaceWorld([0,-1.28,SurfaceShapes.corridorStart]),yaw:0,pitch:-.10,fallVelocity:0,grounded:true};
    Surf.transition={camera:{pos:R.cam.pos.slice(),q:R.cam.q.slice()},distance:0};Surf.walkVelocity=[0,0,0];
    surfaceSetMode('exiting','LEAVING THROUGH RAMP');notice('LEAVING AURORA / RAMP CLEAR',3);return;
  }
  if(Surf.mode==='onfoot'){
    const sample=nearbySample();if(sample){collectSample(sample);return;}
    const local=surfaceLocal(Surf.actor.foot),end=surfaceWorld([0,Surf.site.rampY+.07,SurfaceShapes.rampEndZ+.55]);
    const inRamp=Math.abs(local[0])<.72&&local[2]>.25&&local[2]<7.75;
    if(!inRamp&&V.dist(Surf.actor.foot,end)>.0024){surfaceWarning('RETURN TO THE END OF THE RAMP TO BOARD');return;}
    Surf.transition={camera:crewEye(),distance:0,stage:inRamp?'ramp':'entry'};
    surfaceSetMode('boarding','BOARDING THROUGH RAMP');notice('BOARDING AURORA / FOLLOWING THE RAMP',3);return;
  }
  surfaceWarning('LAND AND OPEN THE RAMP BEFORE LEAVING');
}
function surfaceAction(action){
  if(S.paused)return surfaceSnapshot();
  if(action==='land')requestLanding();else if(action==='gear')toggleGear();else if(action==='ramp')toggleRamp();else if(action==='interact')interactSurface();else if(action==='takeoff')requestTakeoff();
  updateSurfaceHUD();return surfaceSnapshot();
}
/* Closed ship surfaces are solid to a small standing capsule. AABB rejection
   keeps the triangle test local. The belly aperture matches the render cutout. */
const surfaceHullTriangles=[];
for(const group of AuroraAsset.groups)for(let i=0;i<group.data.length;i+=27){
  const a=Array.from(group.data.slice(i,i+3)),b=Array.from(group.data.slice(i+9,i+12)),c=Array.from(group.data.slice(i+18,i+21));
  surfaceHullTriangles.push({a,b,c,min:a.map((x,k)=>Math.min(x,b[k],c[k])),max:a.map((x,k)=>Math.max(x,b[k],c[k]))});
}
function closestTrianglePoint(p,a,b,c){
  const ab=V.sub(b,a),ac=V.sub(c,a),ap=V.sub(p,a),d1=V.dot(ab,ap),d2=V.dot(ac,ap);
  if(d1<=0&&d2<=0)return a;
  const bp=V.sub(p,b),d3=V.dot(ab,bp),d4=V.dot(ac,bp);if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return V.add(a,V.mul(ab,d1/(d1-d3)));
  const cp=V.sub(p,c),d5=V.dot(ab,cp),d6=V.dot(ac,cp);if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return V.add(a,V.mul(ac,d2/(d2-d6)));
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return V.add(b,V.mul(V.sub(c,b),(d4-d3)/((d4-d3)+(d5-d6))));
  const den=1/(va+vb+vc);return V.add(a,V.add(V.mul(ab,vb*den),V.mul(ac,vc*den)));
}
function capsuleBlocked(foot){
  const local=surfaceLocal(foot),radius=.24,height=surfaceEyeHeight(foot);
  if(Math.abs(local[0])>7.2||local[2]<-7||local[2]>6.6)return false;
  for(let sphere=0;sphere<5;sphere++){
    const y=mix(.24,height-.15,sphere/4);
    const center=V.add(local,[0,y,0]);
    // Use the same deployed joints as the visible landing gear. Do not let the
    // crew walk through its load-bearing struts.
    if(Surf.gear>.999)for(let i=0;i<3;i++){
      const root=SurfaceShapes.gearRoots[i],foot=SurfaceShapes.gearFeet[i].slice();foot[1]=Surf.site.feetY[i];
      const knee=V.mix(root,foot,.57);knee[2]+=.33;
      for(const [a,b,r] of [[root,knee,.10],[knee,foot,.055]]){
        const ab=V.sub(b,a),t=clamp(V.dot(V.sub(center,a),ab)/V.dot(ab,ab),0,1);
        if(V.dist(center,V.add(a,V.mul(ab,t)))<radius+r)return true;
      }
    }
    for(const t of surfaceHullTriangles){
      if(t.min.some((v,k)=>center[k]+radius<v)||t.max.some((v,k)=>center[k]-radius>v))continue;
      const pt=closestTrianglePoint(center,t.a,t.b,t.c);
      if(Surf.ramp>.005&&Math.abs(pt[0])<.625&&pt[2]>.18&&pt[2]<5.60&&pt[1]<-.18)continue;
      if(V.dist(center,pt)<radius)return true;
    }
  }
  // A closed bulkhead keeps the crew inside the aft access passage.
  return Math.abs(local[0])<.75&&local[2]<.26&&local[2]>-.2&&local[1]<-.8;
}
function crewSupport(candidate){
  const p=Surf.site.planet,radial=V.norm(V.sub(candidate,p.pos)),ground=terrainPoint(p,candidate);let point=ground,kind='terrain';
  const local=surfaceLocal(candidate);
  if(Surf.ramp>.999&&Math.abs(local[0])<=.585&&local[2]>=.20&&local[2]<=SurfaceShapes.rampEndZ+.05){
    const y=local[2]<1.15?-1.28:mix(-1.28,Surf.site.rampY+.07,(local[2]-1.15)/(SurfaceShapes.rampEndZ-1.15));
    const deck=surfaceWorld([local[0],y+(local[2]<1.15?.02:.056),local[2]]);
    if(V.dot(V.sub(deck,ground),radial)>0){point=deck;kind=local[2]<1.15?'deck':'ramp';}
  }return {point,kind,radial,ground};
}
function rockBlocked(foot){
  const radial=V.norm(V.sub(foot,Surf.site.planet.pos));
  for(const rock of Surf.site.scatter.rocks){let d=V.sub(foot,rock.center),vertical=V.dot(d,radial);if(vertical>rock.height+.00015)continue;d=V.sub(d,V.mul(radial,vertical));if(V.len(d)<rock.radius+.00025)return true;}return false;
}
function walkStep(candidate,dt,scripted=false){
  const a=Surf.actor,p=Surf.site.planet,support=crewSupport(candidate),n=support.radial;
  if(support.kind==='terrain'&&(rawHeight(V.norm(V.sub(support.point,p.pos)),p)<=.0001||terrainSlope(p,support.point)>40))return false;
  const gap=V.dot(V.sub(support.point,candidate),n);
  let foot=candidate.slice(),fall=a.fallVelocity;
  if(gap>.00040&&a.grounded)return false;
  if((gap>-.00040&&gap<=.00040&&a.grounded)||gap>=0){foot=support.point;fall=0;a.grounded=true;}
  else {fall-=.00981*dt;foot=V.add(foot,V.mul(n,fall*dt));if(V.dot(V.sub(foot,support.point),n)<=0){foot=support.point;fall=0;a.grounded=true;}else a.grounded=false;}
  if(capsuleBlocked(foot)||rockBlocked(foot)){Surf.stats.blocked++;return false;}
  const distance=V.dist(a.foot,foot);a.foot=foot;a.fallVelocity=fall;
  if(!scripted){Surf.stats.walkDistance+=distance*1000;career.walk+=distance*1000;}
  Surf.stats.maxRange=Math.max(Surf.stats.maxRange,V.dist(foot,S.pos)*1000);
  if(Surf.stats.maxRange>12&&Surf.stats.walkDistance>8)Surf.checks.walk=true;
  return true;
}
function walkToward(target,dt,speed=.0018){
  const a=Surf.actor,up=V.norm(V.sub(a.foot,Surf.site.planet.pos));let d=V.sub(target,a.foot);d=V.sub(d,V.mul(up,V.dot(d,up)));const distance=V.len(d);
  if(distance<.000055)return true;
  const candidate=V.add(a.foot,V.mul(V.norm(d),Math.min(speed*dt,distance)));
  const ok=walkStep(candidate,dt,true);if(!ok){surfaceWarning('RAMP PATH BLOCKED / USE WASD TO MOVE CLEAR');surfaceSetMode('onfoot','EXPLORE');}
  return false;
}
function updateWalking(dt){
  const a=Surf.actor;
  a.yaw+=ctl.turn[0]*1.65*dt;
  a.pitch=clamp(a.pitch+ctl.turn[1]*1.1*dt,-1.3,1.3);
  const forward=ctl.walk[1],side=ctl.walk[0],effort=Math.min(1,Math.hypot(forward,side));
  let dir=[Math.sin(a.yaw)*forward+Math.cos(a.yaw)*side,0,Math.cos(a.yaw)*forward-Math.sin(a.yaw)*side];
  dir=Q.rot(V.norm(dir),S.q);const up=V.norm(V.sub(a.foot,Surf.site.planet.pos));dir=V.norm(V.sub(dir,V.mul(up,V.dot(dir,up))));
  const speed=(ctl.boost?.0064:.0034)*effort;
  Surf.walkVelocity=V.mix(Surf.walkVelocity,V.mul(dir,speed),1-Math.exp(-12*dt));if(V.len(Surf.walkVelocity)<.0000001)Surf.walkVelocity=[0,0,0];
  const before=a.foot.slice();const candidate=V.add(before,V.mul(Surf.walkVelocity,dt));
  if(!walkStep(candidate,dt))Surf.walkVelocity=[0,0,0];
  Surf.walkSpeed=V.dist(before,a.foot)/dt*1000;
}
function updateCrewPassage(dt){
  const a=Surf.actor;
  if(Surf.mode==='exiting'){
    const target=surfaceWorld([0,Surf.site.rampY,8.0]);
    if(walkToward(target,dt)){
      Surf.checks.exit=true;Surf.walkVelocity=[0,0,0];surfaceSetMode('onfoot','EXPLORE');
      event('crew-exited',{position:a.foot.slice()});notice(footHint()+(Surf.site.survey?.samples.some(s=>!s.taken)?' / FIND THE GLOWING SAMPLES':''),6);
    }
  }else{
    const transition=Surf.transition;
    if(transition.stage==='entry'){
      const target=surfaceWorld([0,Surf.site.rampY,7.30]);
      if(walkToward(target,dt))transition.stage='ramp';
    }else{
      const local=surfaceLocal(a.foot);
      if(Math.abs(local[0])>.08){walkToward(surfaceWorld([0,local[1],local[2]]),dt);return;}
      if(walkToward(surfaceWorld([0,-1.28,.42]),dt)){
        Surf.checks.board=true;Surf.stats.boards++;Surf.actor=null;Surf.walkVelocity=[0,0,0];Surf.walkSpeed=0;
        surfaceSetMode('landed','CREW ABOARD');notice('CREW ABOARD / '+K('land')+' TO TAKE OFF / '+K('ramp')+' TO SEAL RAMP',5);event('crew-boarded');saveFlight();
      }
    }
  }
}
function surfacePostFrame(dt){
  Surf.gear=clamp(Surf.gear+Math.sign(Surf.gearTarget-Surf.gear)*Math.min(Math.abs(Surf.gearTarget-Surf.gear),dt/1.8),0,1);
  Surf.ramp=clamp(Surf.ramp+Math.sign(Surf.rampTarget-Surf.ramp)*Math.min(Math.abs(Surf.rampTarget-Surf.ramp),dt/1.6),0,1);
  if(Surf.gear>.999)Surf.checks.gear=true;if(Surf.ramp>.999)Surf.checks.ramp=true;
}
function surfaceFlightFollow(dt){
  surfacePostFrame(dt);
  if(Surf.pending){
    if(S.selected.id!==Surf.pending){Surf.pending=null;return;}
    if(!S.auto){const p=resolveDestination(Surf.pending);if(S.lastAutoDone==='descend'&&S.nearest?.id===p?.id&&S.clearance<45)prepareLanding(p);else Surf.pending=null;}
  }
}
function updateSurface(dt){
  S.time+=dt;S.stats.steps++;S.saveTimer+=dt;S.worldTimer+=dt;Surf.phaseTime+=dt;Surf.steps++;
  if(S.worldTimer>.16){S.worldTimer=0;updateWorld();}
  findNearest();surfacePostFrame(dt);
  const old=S.pos.slice();S.boost=false;S.boostMix=rateStep(S.boostMix,0,7,dt);S.cruise=false;S.transitFX=rateStep(S.transitFX,0,5,dt);S.throttle=0;S.angular=[0,0,0];S.visualBank=rateStep(S.visualBank,0,10,dt);S.drift=false;
  const site=Surf.site;
  if(Surf.mode==='landing'){
    const delta=V.sub(Surf.landingTarget,S.pos),distance=V.len(delta);
    const final=Surf.phase==='FINAL DESCENT';
    let speed=final?Math.min(220,Math.max(.00028,distance*1.60)):Math.min(850,distance*2.0+.005);
    if(final&&distance<.025)speed=Math.min(speed,.006);
    const desired=V.mul(V.norm(delta),speed);
    S.velocity=velocityStep(S.velocity,desired,final?10:6,final?600:2200,dt);
    // One velocity-integrated step, bounded by the target. No position reset.
    let step=V.mul(S.velocity,dt);if(V.len(step)>distance)step=delta;
    S.pos=V.add(S.pos,step);S.q=Q.slerp(S.q,site.q,1-Math.exp(-4*dt));
    if(!final&&V.dist(S.pos,Surf.landingTarget)<.08){Surf.landingTarget=site.shipPos.slice();Surf.phase='FINAL DESCENT';event('landing-final');}
    if(final&&V.dist(S.pos,Surf.landingTarget)<.000003&&Surf.gear>.999){
      // The final correction is at most three millimetres.
      S.pos=site.shipPos.slice();S.q=site.q.slice();S.velocity=[0,0,0];
      Surf.checks.land=true;Surf.stats.landings++;surfaceSetMode('landed','GEAR CONTACT');
      notice('TOUCHDOWN / THREE FEET IN CONTACT / '+K('ramp')+' TO OPEN RAMP',6);kit.input.rumble(.5,220);sfx('touchdown');recordLanding(site);event('touchdown',{planet:site.planet.id,slope:site.slope});saveFlight();
    }
  }else if(Surf.mode==='closing'){
    S.velocity=[0,0,0];
    if(Surf.ramp<=.001){Surf.ramp=0;surfaceSetMode('takeoff','VERTICAL LIFT');event('lift-start');}
  }else if(Surf.mode==='takeoff'){
    const up=site.up,clearance=surfaceDistance(site.planet);
    const speed=Math.min(180,.0045+Math.max(0,clearance-.00325)*2.15);
    S.velocity=velocityStep(S.velocity,V.mul(up,speed),8,900,dt);S.pos=V.add(S.pos,V.mul(S.velocity,dt));
    if(clearance>.012)Surf.gearTarget=0;
    const heading=Q.rot([0,0,-1],site.q),tilt=smooth(.025,10,clearance)*.20;
    S.q=Q.slerp(S.q,Q.look(V.norm(V.add(heading,V.mul(up,tilt))),up),1-Math.exp(-3*dt));
    Surf.orbitYaw=rateStep(Surf.orbitYaw,0,4,dt);Surf.orbitPitch=rateStep(Surf.orbitPitch,.12,4,dt);
    if(clearance>=20){Surf.checks.flight=true;Surf.stats.takeoffs++;Surf.gearTarget=0;S.throttle=.30;surfaceSetMode('flight','');S.flightPhase='MANUAL';notice('FLIGHT CONTROL RESTORED / CONTINUE YOUR JOURNEY',6);sfx('arrive');event('takeoff-complete');saveFlight();}
  }else{
    S.velocity=[0,0,0];
    if(Surf.mode==='onfoot')updateWalking(dt);
    else if(Surf.mode==='exiting'||Surf.mode==='boarding')updateCrewPassage(dt);
    else if(Surf.mode==='landed'){
      Surf.orbitYaw-=ctl.steer[0]*dt;
      Surf.orbitPitch=clamp(Surf.orbitPitch+ctl.steer[1]*dt*.6,-.08,.85);
    }
  }
  S.speed=V.len(S.velocity);S.stats.distance+=V.dist(old,S.pos);S.stats.maxSpeed=Math.max(S.stats.maxSpeed,S.speed);career.distance+=V.dist(old,S.pos);career.maxSpeed=Math.max(career.maxSpeed,S.speed);
  S.fov=rateStep(S.fov,Surf.actor?72:65,3,dt);S.cameraQ=Q.slerp(S.cameraQ,S.q,1-Math.exp(-12*dt));
  if(surfaceOwnsFlight())S.flightPhase=Surf.mode.toUpperCase();
  findNearest();if(S.saveTimer>5){S.saveTimer=0;saveFlight();}
  if(S.time>S.noticeUntil)$('notice').classList.remove('show');updateAudio();
}
const updateOriginalFlight=update;
update=function(dt){if(!S.started||S.paused)return;if(surfaceOwnsFlight())updateSurface(dt);else{updateOriginalFlight(dt);surfaceFlightFollow(dt);}};
function surfaceChaseCamera(defaultCamera){
  if(!Surf.site||!surfaceOwnsFlight())return defaultCamera;
  const scale=surfaceShipScale();
  
  const y=Surf.orbitYaw,p=Surf.orbitPitch;
  const offset=[Math.sin(y)*28,8+Math.sin(p)*18,Math.cos(y)*28];
  const pos=V.add(S.pos,Q.rot(V.mul(offset,scale),S.q));
  const target=V.add(S.pos,Q.rot([0,scale*.5,0],S.q));
  const local={pos,q:Q.look(V.sub(target,pos),Q.rot([0,1,0],S.q))};
  const blend=1-smooth(.08,3,S.clearance);return {pos:V.mix(defaultCamera.pos,local.pos,blend),q:Q.slerp(defaultCamera.q,local.q,blend)};
}
function surfaceCamera(defaultCamera){
  const chase=surfaceChaseCamera(defaultCamera);
  if(!Surf.actor)return chase;
  const eye=crewEye(),local=surfaceLocal(Surf.actor.foot);
  if(Surf.mode==='onfoot')return eye;
  if(Surf.mode==='exiting'){
    const t=smooth(3.4,7.8,local[2]);return {pos:V.mix(Surf.transition.camera.pos,eye.pos,t),q:Q.slerp(Surf.transition.camera.q,eye.q,t)};
  }
  // The camera returns to chase view while the crew follows the same ramp inward.
  const t=Surf.transition.stage==='entry'?0:1-smooth(.42,5.1,local[2]);
  return {pos:V.mix(eye.pos,chase.pos,t),q:Q.slerp(eye.q,chase.q,t)};
}
function surfaceEnvironment(cam,scale){
  let patch=null;
  if(Surf.site&&S.nearest?.id===Surf.site.planet.id&&S.clearance<14){
    const p=Surf.site.planet,origin=Surf.actor?.foot||S.pos;
    const center=terrainPoint(p,origin),old=R.groundPatch;
    patch={center:old&&old.key.startsWith(p.id+':')&&V.dist(center,old.center)<.020?old.center:center,radius:42,settle:1-smooth(.08,14,S.clearance)};
  }
  return {near:Math.max(.00008,1.5*scale*scale),patch};
}
function drawSurfaceWorld(){
  if(!Surf.site||!R.env.patch)return;
  drawGroundPatch(R,Surf.site.planet,R.env.patch.center);
  if(S.clearance<.8){drawSurfaceScatter(R,Surf.site);drawSurvey(R,Surf.site);const alpha=1-smooth(.005,.020,S.clearance);if(alpha>0)drawLandingShadow(R,Surf.site,alpha);}
}
function surfaceSupportDiagnostics(){
  if(!Surf.site)return null;
  const feet=SurfaceShapes.gearFeet.map((f,i)=>{const w=surfaceWorld([f[0],Surf.site.feetY[i]-.065,f[2]]),p=Surf.site.planet,d=V.sub(w,p.pos);return {position:w,errorMetres:(V.len(d)-p.radius-heightAt(V.norm(d),p))*1000};});
  let actor=null;if(Surf.actor){const s=crewSupport(Surf.actor.foot);actor={support:s.kind,clearanceMetres:V.dot(V.sub(Surf.actor.foot,s.point),s.radial)*1000,insideSolid:capsuleBlocked(Surf.actor.foot)};}
  return {feet,actor,slope:Surf.site.slope,rampSlope:Surf.site.rampSlope,hullClearance:Surf.site.hullClearance};
}
function surfaceSnapshot(){
  const a=Surf.actor;return {mode:Surf.mode,phase:Surf.phase,pending:Surf.pending,gear:Surf.gear,gearTarget:Surf.gearTarget,ramp:Surf.ramp,rampTarget:Surf.rampTarget,
    crew:a?'outside':'aboard',planet:Surf.site?.planet.id||null,renderScale:surfaceShipScale(),
    site:Surf.site?{ground:Surf.site.ground.slice(),normal:Surf.site.normal.slice(),slope:Surf.site.slope,rampSlope:Surf.site.rampSlope,hullClearance:Surf.site.hullClearance,feetY:Surf.site.feetY.slice(),rampY:Surf.site.rampY}:null,
    actor:a?{position:a.foot.slice(),local:surfaceLocal(a.foot),yaw:a.yaw,pitch:a.pitch,grounded:a.grounded,speed:Surf.walkSpeed,shipDistance:V.dist(a.foot,S.pos)*1000,support:crewSupport(a.foot).kind}:null,
    checks:{...Surf.checks},stats:{...Surf.stats},camera:R.cam?{position:R.cam.pos.slice(),quaternion:R.cam.q.slice()}:null};
}
function serializeSurface(){
  if(!Surf.site||Surf.mode==='flight')return null;
  const a=Surf.actor;return {version:1,mode:Surf.mode,planet:Surf.site.planet.id,normal:Surf.site.normal,q:Surf.site.q,
    gear:Surf.gear,ramp:Surf.ramp,actor:a?{foot:a.foot,yaw:a.yaw,pitch:a.pitch}:null,checks:Surf.checks,stats:Surf.stats};
}
function restoreSurface(data){
  resetSurface();if(!data||data.version!==1)return;
  try{
    const valid=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
    if(!/^[-\d]+:[-\d]+:[-\d]+:\d+\/p\d+$/.test(data.planet)||!valid(data.normal,3)||!valid(data.q,4))throw Error('Invalid surface save');
    const p=resolveDestination(data.planet),site=makeLandingSite(p,data.normal,Q.rot([0,0,-1],data.q));if(!site)throw Error('Invalid landing site');
    site.scatter=buildSurfaceScatter(site);buildSurvey(site);Surf.site=site;Surf.gear=Surf.gearTarget=1;Surf.ramp=Surf.rampTarget=clamp(+data.ramp||0,0,1);
    Surf.checks={...Surf.checks,...data.checks};Surf.stats={...Surf.stats,...data.stats};
    if(['landed','onfoot','exiting','boarding','closing'].includes(data.mode)&&V.dist(S.pos,site.shipPos)<.005){
      // Saved landed positions already coincide with the contact pose.
      if(V.dist(S.pos,site.shipPos)>.0001)throw Error('Saved ship is not in contact');
      if(data.actor&&valid(data.actor.foot,3)&&Number.isFinite(data.actor.yaw)&&Number.isFinite(data.actor.pitch)&&V.dist(data.actor.foot,S.pos)<2){
        Surf.actor={foot:data.actor.foot.slice(),yaw:data.actor.yaw,pitch:clamp(data.actor.pitch,-1.3,1.3),grounded:true,fallVelocity:0};
        Surf.ramp=Surf.rampTarget=1;surfaceSetMode('onfoot','SESSION RESTORED');
        const support=crewSupport(Surf.actor.foot);if(Math.abs(V.dot(V.sub(Surf.actor.foot,support.point),support.radial))>.003||capsuleBlocked(Surf.actor.foot))throw Error('Saved crew position is unsafe');
      }else surfaceSetMode('landed','CREW ABOARD');
    }else surfaceSetMode('hover','LANDING HOLD');
  }catch(e){Surf.actor=null;if(Surf.site){surfaceSetMode('hover','LANDING HOLD');Surf.ramp=Surf.rampTarget=0;}else{Surf=freshSurface();}event('surface-save-rejected',{reason:e.message});}
}
function resetSurface(){Surf=freshSurface();document.body.classList.remove('surface-active','on-foot');}
function updateSurfaceHUD(){
  if(!$('surface-console'))return;
  const mode=Surf.mode,walking=!!Surf.actor,landed=mode==='landed',own=surfaceOwnsFlight();
  txt('surface-status',Surf.pending?'APPROACHING LANDING SITE':Surf.phase||'ORBIT → GROUND → ORBIT');
  txt('gear-status',Surf.gear>.999?'DEPLOYED':Surf.gear<.001?'STOWED':'MOVING');
  txt('ramp-status',Surf.ramp>.999?'OPEN':Surf.ramp<.001?'SEALED':'MOVING');
  txt('crew-status',walking?'OUTSIDE':'ABOARD');
  txt('land-label',landed?'TAKE OFF':mode==='hover'?'RESUME LANDING':Surf.pending?'CANCEL LANDING':mode==='landing'?'LANDING…':mode==='takeoff'||mode==='closing'?'TAKING OFF…':'LAND');
  $('land-btn').disabled=walking||['landing','takeoff','closing'].includes(mode);
  $('gear-btn').disabled=own||!!Surf.pending;
  $('ramp-btn').disabled=!landed;
  txt('ramp-label',Surf.rampTarget>.5?'SEAL RAMP':'OPEN RAMP');
  const ready=landed&&Surf.ramp>.999,local=walking?surfaceLocal(Surf.actor.foot):null;
  const end=Surf.site?surfaceWorld([0,Surf.site.rampY+.07,SurfaceShapes.rampEndZ+.55]):[0,0,0];
  const inRamp=walking&&Math.abs(local[0])<.72&&local[2]>.25&&local[2]<7.75;
  const nearRamp=walking&&(inRamp||V.dist(Surf.actor.foot,end)<.0024);
  const nearSample=walking&&mode==='onfoot'?nearbySample():null;
  $('crew-btn').disabled=!(ready||(mode==='onfoot'&&(nearRamp||nearSample)));txt('crew-label',walking?(nearSample?'COLLECT':'BOARD'):'LEAVE SHIP');
  txt('surface-hint',surfaceHint(mode,walking,ready,nearRamp,nearSample));
  for(const [k,v] of Object.entries(Surf.checks)){const el=document.querySelector('[data-surface-step="'+k+'"]');if(el)el.classList.toggle('done',v);}
  txt('surface-progress',Object.values(Surf.checks).filter(Boolean).length+' / 7');
  $('surface-plan').classList.toggle('visible',own||Object.values(Surf.checks).some(Boolean));
  if(own){
    txt('flight-state',walking?'SURFACE / ON FOOT':mode==='landed'?'SURFACE / LANDED':mode==='landing'?'SURFACE / LANDING':mode==='hover'?'SURFACE / HOLD':'SURFACE / TAKEOFF');
    txt('mode-label',Surf.phase);
    if(walking){txt('speed',Surf.walkSpeed.toFixed(1));txt('speed-unit','m/s');txt('drive-name','ON FOOT');}
    else if(S.speed<1){txt('speed',(S.speed*1000).toFixed(1));txt('speed-unit','m/s');txt('drive-name',mode.toUpperCase());}
    txt('boost-status',surfaceEnginesOff()?'ENGINES SAFE':'SURFACE THRUST');
    txt('altitude',S.clearance<1?(S.clearance*1000).toFixed(1)+' m':formatDistance(S.clearance));
    $('approach-btn').disabled=true;$('orbit-btn').disabled=true;$('descend-btn').disabled=true;
  }else{$('approach-btn').disabled=false;$('orbit-btn').disabled=false;}
  $('foot-hud').classList.toggle('visible',walking);
  if(walking){
    txt('foot-world',Surf.site.planet.name.toUpperCase());txt('foot-speed',Surf.walkSpeed.toFixed(1)+' m/s');
    txt('foot-range',(V.dist(Surf.actor.foot,S.pos)*1000).toFixed(1)+' m');
    txt('foot-slope',terrainSlope(Surf.site.planet,Surf.actor.foot).toFixed(1)+'°');
    const bearing=R.project(surfaceWorld([0,.35,0]));const x=bearing.front?clamp(bearing.x,70,innerWidth-70):(bearing.x<innerWidth*.49?70:innerWidth-70),y=bearing.front?clamp(bearing.y,115,innerHeight-230):innerHeight*.53;
    $('ship-beacon').style.left=x+'px';$('ship-beacon').style.top=y+'px';$('ship-beacon').classList.toggle('behind',!bearing.front||x!==bearing.x||y!==bearing.y);
    txt('ship-beacon-range',(V.dist(Surf.actor.foot,S.pos)*1000).toFixed(1)+' m');
    txt('foot-context',mode==='onfoot'?(nearSample?'[ '+K('interact')+' ] COLLECT '+nearSample.type.name:nearRamp?'[ '+K('interact')+' ] BOARD AURORA':'RETURN TO THE RAMP TO BOARD'):Surf.phase);
    if($('atlas').classList.contains('open'))txt('chart-subtitle','Crew outside. Chart ranges are measured from the parked AURORA. Take off before transfer.');
  }
  updateSurveyHUD(walking,mode);
}
$('land-btn').onclick=()=>surfaceAction('land');$('gear-btn').onclick=()=>surfaceAction('gear');$('ramp-btn').onclick=()=>surfaceAction('ramp');$('crew-btn').onclick=()=>surfaceAction('interact');
$('launch-land-btn').onclick=()=>surfaceAction('land');

let lastFocus=null;
function openModal(id){if(!document.querySelector('.modal.open'))lastFocus=document.activeElement;for(let m of document.querySelectorAll('.modal'))m.classList.remove('open');$(id).classList.add('open');S.paused=true;drag.active=false;S.mouseTurn=[0,0];S.angular=[0,0,0];kit.touch?.suspend(true,'modal');updateAudio();$(id).querySelector('button,input')?.focus();sfx('open');}
function closeModals(){const was=!!document.querySelector('.modal.open');for(let m of document.querySelectorAll('.modal'))m.classList.remove('open');S.paused=false;kit.touch?.suspend(false,'modal');if(lastFocus&&lastFocus!==document.body&&lastFocus.isConnected)lastFocus.focus?.();else canvas.focus();lastFocus=null;kit.input.settle();updateAudio();if(was)sfx('close');}
function savePrefs(){try{localStorage.setItem('boundless-settings-v1',JSON.stringify(prefs))}catch{}}
function saveFlight(){saveCareer();if(!S.started)return;let save={version:1,pos:S.pos,q:S.q,currentId:S.currentId,selectedId:S.selected.id,visited:[...S.visited],checks:S.checks,surface:serializeSurface()};try{localStorage.setItem('boundless-flight-v1',JSON.stringify(save));saved=save}catch{}}
function loadFlight(){try{let x=JSON.parse(localStorage.getItem('boundless-flight-v1')||'null');if(!x||x.version!==1||!Array.isArray(x.pos)||x.pos.length!==3||!x.pos.every(Number.isFinite)||!Array.isArray(x.q)||x.q.length!==4||!x.q.every(Number.isFinite)||!/^[-\d]+:[-\d]+:[-\d]+:\d+$/.test(x.currentId))throw Error('No valid saved flight was found.');cancelAssist(false);S.pos=x.pos.slice();S.q=Q.norm(x.q);S.cameraQ=S.q.slice();S.angular=[0,0,0];S.mouseTurn=[0,0];S.boostMix=0;S.transitFX=0;S.currentId=x.currentId;S.velocity=[0,0,0];S.speed=0;S.throttle=0;S.visited=new Set(x.visited||[HOME]);S.checks={...S.checks,...x.checks};let sys=getSystem(makeStar(x.currentId));let selected=String(x.selectedId||'');if(selected.includes('/p')){let [id,index]=selected.split('/p');S.selected=getSystem(makeStar(id)).planets[+index]||sys.planets[0]}else S.selected=makeStar(selected||x.currentId);updateWorld(true);updateLocal();startFlight();closeModals();restoreSurface(x.surface);notice(Surf.mode==='flight'?'SAVED FLIGHT LOADED / HOVER HOLD':'SURFACE SESSION RESTORED / ENGINES SAFE');event('save-loaded');kit.input.settle()}catch(e){txt('save-note',e.message);notice(e.message.toUpperCase(),5)}}
function resetFlight(){resetSurface();cancelAssist(false);S.pos=[0,0,0];S.q=[0,0,0,1];S.cameraQ=S.q.slice();S.angular=[0,0,0];S.mouseTurn=[0,0];S.visualBank=0;S.boostMix=0;S.transitFX=0;S.flightPhase='HOLD';S.drift=false;S.velocity=[0,0,0];S.speed=0;S.throttle=0;S.currentId=HOME;S.selected=getSystem(home).planets[0];S.checks={orbit:false,boost:false,travel:false,atmo:false,surface:false};S.started=false;S.paused=false;S.time=0;S.fov=65;S.air=0;lastContactNotice=-10;S.stats={distance:0,maxSpeed:0,boostTime:0,systemsEntered:0,atmoEntries:0,contacts:0,steps:0,minClearance:Infinity};S.events=[];S.worldCell='';document.body.classList.remove('started','hud-hidden');$('route-footer').dataset.done='0';$('route-footer').innerHTML='ONE SHIP. NO LOADING SCREENS.<br>THE REST IS UP TO YOU.';$('continue-btn').hidden=!saved;closeModals();updateWorld(true);updateLocal();updateHUD();}
async function photo(){if(document.querySelector('.modal.open'))return;render(0);sfx('photo');try{const blob=await R.capture();((blob)=>{if(!blob)return;let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='boundless-'+makeStar(S.currentId).name.toLowerCase().replaceAll(' ','-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('screenshot-flash').style.opacity='.4';setTimeout(()=>$('screenshot-flash').style.opacity='0',70);notice('FLIGHT PHOTO SAVED')})(blob)}catch(e){notice('PHOTO FAILED / '+e.message)}}
window.addEventListener('blur',()=>{drag.active=false;S.mouseTurn=[0,0];S.angular=[0,0,0];if(S.started&&!TEST_MODE&&!document.querySelector('.modal.open'))openModal('pause')});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.started&&!TEST_MODE&&!document.querySelector('.modal.open'))openModal('pause')});
$('start-btn').onclick=startFlight;$('guide-btn').onclick=beginGuide;$('pause-guide').onclick=beginGuide;$('atlas-btn').onclick=()=>openAtlas();$('map-dock-btn').onclick=()=>openAtlas();$('next-btn').onclick=()=>nextTarget(1);$('approach-btn').onclick=()=>S.auto?cancelAssist():engage(S.selected.kind==='star'?'cruise':'approach');$('orbit-btn').onclick=()=>engage('orbit',nearestPlanet());$('descend-btn').onclick=()=>engage('descend');$('help-btn').onclick=()=>openModal('help');$('settings-btn').onclick=()=>openModal('settings');$('sound-btn').onclick=toggleAudio;$('photo-btn').onclick=photo;for(let b of document.querySelectorAll('[data-close]'))b.onclick=closeModals;$('resume-save').onclick=loadFlight;$('reset-btn').onclick=resetFlight;
$('reduce-motion').checked=prefs.reduceMotion;$('reduce-motion').onchange=e=>{prefs.reduceMotion=e.target.checked;savePrefs()};txt('save-note',saved?'A saved flight is available. It will load with engines stopped.':'Flight progress saves locally after you start.');
$('bloom').value=String(prefs.bloom);txt('bloom-value',prefs.bloom.toFixed(2));$('bloom').oninput=e=>{prefs.bloom=+e.target.value;txt('bloom-value',prefs.bloom.toFixed(2));savePrefs()};
$('exposure').value=String(prefs.exposure);txt('exposure-value',prefs.exposure.toFixed(2));$('exposure').oninput=e=>{prefs.exposure=+e.target.value;txt('exposure-value',prefs.exposure.toFixed(2));savePrefs()};
bindChartControls();
// Keep keyboard focus within an open dialog. Tab cycles targets only in the flight view.
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||kit.menu.isOpen)return;let modal=document.querySelector('.modal.open')||(S.started?null:$('launch'));if(!modal)return;e.preventDefault();let list=[...modal.querySelectorAll('button,input,select')].filter(x=>!x.disabled),index=list.indexOf(document.activeElement);list[(index+(e.shiftKey?-1:1)+list.length)%list.length]?.focus()},true);
window.addEventListener('beforeunload',saveFlight);window.addEventListener('pagehide',saveFlight);
updateRendererLabel();updateWorld(true);updateLocal();updateHUD();
/* Inspection is a render-only view. The flight state stays paused and unchanged. */
const bay={view:'perspective',style:'materials',yaw:.66,pitch:.43,distance:25,drag:null};
const BAY_FAR=4000; // orthographic views: a far camera with a narrow lens
function openShipBay(){openModal('ship-bay')}
function setBayView(view){bay.view=view;for(const b of document.querySelectorAll('[data-bay-view]')){b.classList.toggle('active',b.dataset.bayView===view);b.setAttribute('aria-pressed',String(b.dataset.bayView===view))}txt('bay-projection',view==='perspective'?'PERSPECTIVE / DRAG TO ROTATE':'ORTHOGRAPHIC / '+view.toUpperCase())}
function renderShipBay(){if(!R)return;R.resize(gameQuality());
 let pos,up=[0,1,0],ortho=0;
 if(bay.view==='top'){pos=[0,38,0];up=[0,0,-1];ortho=8.25}
 else if(bay.view==='bottom'){pos=[0,-38,0];up=[0,0,1];ortho=8.25}
 else if(bay.view==='front'){pos=[0,0,-38];ortho=5.8}
 else if(bay.view==='rear'){pos=[0,0,38];ortho=5.8}
 else if(bay.view==='side'){pos=[38,0,0];ortho=5.8}
 else pos=[Math.sin(bay.yaw)*Math.cos(bay.pitch)*bay.distance,Math.sin(bay.pitch)*bay.distance,Math.cos(bay.yaw)*Math.cos(bay.pitch)*bay.distance];
 if(ortho)ortho=Math.max(ortho,7.6/(innerWidth/innerHeight));else pos=V.mul(pos,Math.max(1,.95/(innerWidth/innerHeight)));
 let fov=38,near=1.5,far=2e7;if(ortho){pos=V.mul(V.norm(pos),BAY_FAR);fov=2*Math.atan(ortho/BAY_FAR)*180/Math.PI;near=BAY_FAR-60;far=BAY_FAR+60}
 const q=Q.look(V.mul(pos,-1),up),cam={pos,q};
 R.begin(cam,fov,0,[0,1,0],{planet:null,sun:{pos:[-60,100,60],radius:1,color:[1,.96,.90]},time:S.time,exposure:.94,bloom:bay.style==='silhouette'?0:.22,studio:true,near,far});
 drawAurora(R,[0,0,0],R.identity,bay.style==='silhouette'?'silhouette':'materials');
 if(bay.style==='materials')auroraDrive(R,[0,0,0],[0,0,0,1],0,0,false);
 if(bay.style==='wire'){let lines=[];for(let i=0;i<AuroraAsset.wire.length;i+=6)lines.push(AuroraAsset.wire[i]-pos[0],AuroraAsset.wire[i+1]-pos[1],AuroraAsset.wire[i+2]-pos[2],.16,.75,.65);R.lines(lines,.52)}
 R.end();
}
$('ship-bay-btn').onclick=openShipBay;$('launch-bay-btn').onclick=openShipBay;$('bay-flight-btn').onclick=closeModals;
for(const b of document.querySelectorAll('[data-bay-view]'))b.onclick=()=>setBayView(b.dataset.bayView);
for(const b of document.querySelectorAll('[data-bay-style]'))b.onclick=()=>{bay.style=b.dataset.bayStyle;for(const c of document.querySelectorAll('[data-bay-style]')){c.classList.toggle('active',c===b);c.setAttribute('aria-pressed',String(c===b))}};
const bayDrag=$('bay-drag');
const bayPinching=pinchGesture(bayDrag,ratio=>{bay.distance=clamp(bay.distance/ratio,17,50);setBayView('perspective')});
bayDrag.onpointerdown=e=>{bay.drag={x:e.clientX,y:e.clientY};bayDrag.setPointerCapture(e.pointerId)};
bayDrag.onpointermove=e=>{if(!bay.drag)return;if(bayPinching()){bay.drag={x:e.clientX,y:e.clientY};return}bay.yaw-=(e.clientX-bay.drag.x)*.008;bay.pitch=clamp(bay.pitch+(e.clientY-bay.drag.y)*.007,-1.4,1.4);bay.drag={x:e.clientX,y:e.clientY};setBayView('perspective')};
bayDrag.onpointerup=e=>{bay.drag=null;if(bayDrag.hasPointerCapture(e.pointerId))bayDrag.releasePointerCapture(e.pointerId)};bayDrag.onpointercancel=()=>bay.drag=null;
bayDrag.onwheel=e=>{e.preventDefault();bay.distance=clamp(bay.distance*Math.exp(e.deltaY*.001),17,50);setBayView('perspective')};

// Read-only diagnostics are always available. Test controls are gated behind ?test=1.
function snapshot(){return{surface:surfaceSnapshot(),position:S.pos.slice(),quaternion:S.q.slice(),cameraQuaternion:S.cameraQ.slice(),angularVelocity:S.angular.slice(),velocity:S.velocity.slice(),drift:S.drift,flightPhase:S.flightPhase,speed:S.speed,throttle:S.throttle,started:S.started,paused:S.paused,currentSystem:S.currentId,selected:S.selected.id,selectedName:S.selected.name,navigation:navigationSnapshot(),clearance:S.clearance,air:S.air,boost:S.boost,auto:S.auto?.mode||null,guideStage:S.guide?.stage||null,time:S.time,checks:{...S.checks},stats:{...S.stats},visited:[...S.visited],starCount:S.stars.length,render:{...R.diagnostics(),fps:Math.round(fps)},events:S.events.slice()}}
window.boundless={version:'0.4.0-surface',snapshot,graphics:()=>R.diagnostics(),aurora:()=>JSON.parse(JSON.stringify(AuroraAsset.report)),surface:surfaceSnapshot,career:()=>JSON.parse(JSON.stringify(career))};if(TEST_MODE)Object.assign(window.boundless,{surfaceAction:surfaceAction,surfaceSupport:surfaceSupportDiagnostics,surfaceCandidate:id=>{const p=resolveDestination(id);return p?.kind==='planet'?findLandingSite(p):null},capture:async()=>{const blob=await R.capture();return {size:blob?.size,type:blob?.type}},setManualClock:v=>{manualClock=v;accumulator=0},advance:seconds=>{if(!Number.isFinite(seconds)||seconds<0||seconds>180)throw Error('advance must be 0–180 seconds');let n=Math.ceil(seconds*90);for(let i=0;i<n;i++)update(1/90);render();updateHUD();return snapshot()},select:id=>{let obj=id.includes('/p')?getSystem(makeStar(id.split('/p')[0])).planets[+id.split('/p')[1]]:makeStar(id);select(obj,false);return snapshot()},system:id=>JSON.parse(JSON.stringify(getSystem(makeStar(id)))),stars:()=>S.stars.map(s=>({id:s.id,pos:s.pos,name:s.name})),terrain:(id,n)=>{let p=getSystem(makeStar(id.split('/p')[0])).planets[+id.split('/p')[1]];return heightAt(V.norm(n),p)},reset:resetFlight,render:()=>render(),collision:(from,to)=>solveCollision(from,to),chart:()=>chartSnapshot(),pick:(x,y)=>pickDestination(x,y)?.id||null,project:id=>{let obj=resolveDestination(id);return R.project(obj.pos)},metrics:id=>navigationMetrics(resolveDestination(id)),simulate:seconds=>{if(!Number.isFinite(seconds)||seconds<0||seconds>180)throw Error('Use 0–180 seconds');for(let i=0;i<Math.ceil(seconds*90);i++)update(1/90);return snapshot()}});

/* ---- New interface wiring: explorer log, pause menu, system settings, continue, sound. */
$('log-btn').onclick=openLog;$('pause-log').onclick=openLog;
$('pause-help').onclick=()=>openModal('help');$('pause-settings').onclick=()=>openModal('settings');
$('system-settings').onclick=()=>kit.menu.open();
$('sound-toggle').onchange=e=>{if(prefs.sound!==e.target.checked)toggleAudio()};
$('continue-btn').hidden=!saved;$('continue-btn').onclick=()=>loadFlight();
updateSoundButton();updateControlHints();
// Compile every material once behind the loading card, then run the frame loop.
R.prewarm();
let accumulator=0,manualClock=false;
kit.start((dt)=>{
  fps=window.__kit?.fps||fps;
  frameInput(dt);
  if(manualClock)return;
  accumulator=Math.min(accumulator+dt,.3);
  while(accumulator>=1/90){update(1/90);accumulator-=1/90}
  render(S.paused?0:dt);
});
