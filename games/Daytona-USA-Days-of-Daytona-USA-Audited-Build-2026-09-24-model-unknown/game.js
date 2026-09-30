// Days of Daytona USA 12.1 — Audited Build on the shared 3D stack: three.js r186 through kit/boot.js
// (WebGPU, WebGL2 fallback). SI units: metres, seconds, m/s. The pit-crew radio uses original
// synthetic dialogue and three announcer calls, loaded lazily from ./audio.
// Player, AI, and AI-to-AI contact use the same track-space impulse solver.
import * as THREE from 'three/webgpu';
import * as T from 'three/tsl';
import { boot } from 'kit/boot.js';

// The hand-written WebGL renderer wrote its colours straight to the screen (no sRGB encode).
// Keep that look: no colour management, linear output.
THREE.ColorManagement.enabled = false;

const kit = await boot({
  title: 'Days of Daytona USA',
  canvas: document.getElementById('game'),
  gear: 'none', // the title and the pause menu both have a Settings button (F9 also works)
  accent: '#ffdc35',
  background: '#071f35',
  touch: { top: 'right', topOffset: 150 },
  input: {
    steer: { type: 'vector', keys: { up: [], down: [], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] }, gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    gas: { keys: ['ArrowUp', 'KeyW'], gamepad: ['RT', 'A', 'Up'], touch: 'GAS' },
    brake: { keys: ['ArrowDown', 'KeyS'], gamepad: ['LT', 'Down'], touch: 'BRAKE' },
    slide: { keys: ['Space'], gamepad: ['B'], touch: 'SLIDE' },
    shiftDown: { keys: ['KeyQ', 'KeyZ'], gamepad: ['LB'], touch: 'GEAR −' },
    shiftUp: { keys: ['KeyE', 'KeyX'], gamepad: ['RB'], touch: 'GEAR +' },
    camera: { keys: ['KeyC'], gamepad: ['Y', 'X'], touch: { label: 'VIEW', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    start: { gamepad: ['Start'] },
    mute: { keys: ['KeyM'] },
    fullscreen: { keys: ['KeyF'] },
    restart: { keys: ['KeyR'] },
    // Menus: arrows / stick / D-pad move between buttons, Enter or A selects, Esc or B goes back.
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    ok: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Escape', 'Backspace'], gamepad: ['B'] },
  },
});
kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.loading.progress(.62, 'Building Sunshore Park…');
const nextPaint = () => new Promise((r) => setTimeout(r, 0));

// Five front runners. Speed and defense increase from fifth place to first.
// Drivers read past motion, not input. A real move or traffic can break a defense.
const FIELD_SIZE=40, ROLL_DURATION=6.6;
const BATTLE_SPACING=340, BATTLE_REVEAL=205, BATTLE_TRIGGER=88, BATTLE_INTRO=1.75, BATTLE_TOP_LOCK_GAP=7.2, RIVAL_SPEED_BONUS=10/3.6;
const CHAMPIONS=[
 {name:'NINA VEGA',tag:'VIPER',number:'17',color:'#48e6c7',paint:'#13a992',accent:'#082f38',voice:'vega',style:'reader',reaction:.68,commit:1.45,recover:1.1,move:5.1,mass:1.0,pace:71.0,skill:.83,desc:'READS YOUR FIRST MOVE'},
 {name:'BO KANE',tag:'HAMMER',number:'44',color:'#ff8050',paint:'#ed643b',accent:'#fff5d5',voice:'kane',style:'brawler',reaction:.80,commit:1.25,recover:1.35,move:4.7,mass:1.25,pace:72.0,skill:.79,desc:'FIGHTS DOOR TO DOOR'},
 {name:'ELI CROSS',tag:'GHOST',number:'88',color:'#c4a2ff',paint:'#7f60c4',accent:'#eae7ff',voice:'cross',style:'runner',reaction:.74,commit:1.1,recover:1.1,move:5.7,mass:.94,pace:73.0,skill:.9,desc:'FAST ON CORNER EXITS'},
 {name:'REX MADDOX',tag:'IRON',number:'09',color:'#d5e9ff',paint:'#385779',accent:'#e6eef3',voice:'maddox',style:'heavy',reaction:.66,commit:1.4,recover:1.4,move:4.9,mass:1.4,pace:74.0,skill:.9,desc:'HEAVY CAR. STRONG DEFENSE'},
 {name:'DUKE CALDER',tag:'KING',number:'01',color:'#ffda48',paint:'#edbd32',accent:'#122936',voice:'calder',style:'champion',reaction:.51,commit:1.05,recover:.95,move:6.0,mass:1.12,pace:74.8,skill:.95,desc:'THE LAST CAR TO BEAT'}
];
const RIVAL_MOVES=[
 {hint:'DRAW THE BLOCK. SWITCH SIDES.',move:'FEINT / SWITCHBACK',speed:94.5,headroom:4.0,hold:1.14,reaction:.135,rate:16.4,open:2.35,read:.10,lead:.36,sell:1.0,reverse:2.8,escape:2.25,feintGap:25,draftHold:.46,launchGap:24,guardGap:8.6,contact:1.00,bump:2.8,corner:1.70},
 {hint:'CLIP THE REAR CORNER. TAKE THE GAP.',move:'BUMP & RUN / SIDE PRESSURE',speed:96.5,headroom:4.6,hold:1.06,reaction:.115,rate:17.7,open:2.18,read:.09,lead:.39,sell:1.15,reverse:3.0,escape:2.40,feintGap:23,draftHold:.59,launchGap:22,guardGap:8.4,contact:.95,bump:3.4,corner:1.40},
 {hint:'FILL THE DRAFT. PASS AT CLOSE RANGE.',move:'DRAFT / SLINGSHOT',speed:98.5,headroom:5.2,hold:.99,reaction:.100,rate:19.0,open:2.02,read:.08,lead:.42,sell:1.30,reverse:3.3,escape:2.55,feintGap:21,draftHold:.73,launchGap:20,guardGap:8.2,contact:.89,bump:4.0,corner:1.15},
 {hint:'MAKE HIM COMMIT. FORCE HIM WIDE.',move:'WALL PRESSURE / SWITCHBACK',speed:100.5,headroom:5.8,hold:.93,reaction:.085,rate:20.3,open:1.88,read:.07,lead:.45,sell:1.45,reverse:3.6,escape:2.70,feintGap:19,draftHold:.88,launchGap:18,guardGap:8.0,contact:.83,bump:4.6,corner:.95},
 {hint:'DRAW A BLOCK. DRAFT INTO THE GAP.',move:'COMBINE YOUR MOVES',speed:103.0,headroom:6.4,hold:.88,reaction:.070,rate:21.6,open:1.74,read:.06,lead:.48,sell:1.60,reverse:3.9,escape:2.85,feintGap:17,draftHold:1.04,launchGap:16,guardGap:7.8,contact:.77,bump:5.2,corner:.75}
];
// SI units: speed is m/s, distance is m, and time is s. No pass requires a flag.
const OPENING_LOSS=Object.freeze({'SWITCHBACK':0,'DRAFT':0,'SLINGSHOT':0,'BUMP & RUN':0,'CLIP':0,'SIDE PRESSURE':0,'CHAIN HIT':0,'WALL PRESSURE':0});
const MANEUVER_EDGE=Object.freeze({
 'DRAFT':{player:2.4,rival:0,label:'DRAFT CHARGE'},
 'SLINGSHOT':{player:3.1,rival:0,label:'SLINGSHOT'},
 'SWITCHBACK':{player:0,rival:4.0,label:'DEKE HIGH / LOW'},
 'BUMP & RUN':{player:0,rival:3.2,label:'BUMP'},
 'CLIP':{player:0,rival:7.2,label:'CLIP / SPIN'},
 'SIDE PRESSURE':{player:0,rival:4.6,label:'SIDE RAM'},
 'CHAIN HIT':{player:0,rival:6.0,label:'CHAIN HIT'},
 'WALL PRESSURE':{player:0,rival:12.0,label:'WALL RAM'}
});
function battleCruiseSpeed(){const spec=carSpecs[cfg.car];return Math.max(94.7,spec.max+.65)+RIVAL_SPEED_BONUS+(cfg.difficulty==='pro'?.45:cfg.difficulty==='tour'?-.35:0)}
function applyBattleEdge(c,kind){
 if(!c||!c.elite||c.defeated||c!==battle.active)return false;const e=MANEUVER_EDGE[kind];if(!e)return false;
 c.edgeMoves||(c.edgeMoves=Object.create(null));if(c.edgeMoves[kind])return false;c.edgeMoves[kind]=true;
 c.playerEdge=clamp((c.playerEdge||0)+e.player,0,6.5);c.rivalEdge=clamp((c.rivalEdge||0)+e.rival,0,14);c.edgeKind=e.label;c.edgeAt=worldTime;c.moveKind=e.label;c.moveAt=worldTime;
 const pk=Math.round(c.playerEdge*3.6),rk=Math.round(c.rivalEdge*3.6);c.edgeText=pk&&rk?'YOU +'+pk+' / RIVAL -'+rk+' KM/H':pk?'YOU +'+pk+' KM/H':'RIVAL -'+rk+' KM/H';
 return true
}
function rivalTopSpeed(c){
 const m=RIVAL_MOVES[c.id-34],spec=carSpecs[cfg.car];
 // The grip car can still reach an attack. The power car keeps its speed advantage.
 return Math.min(m.speed,spec.max+m.headroom)+RIVAL_SPEED_BONUS+(cfg.difficulty==='pro'?1.0:cfg.difficulty==='tour'?-.65:0)-Math.min(m.corner,Math.abs(frame(c.s).cur)*(125-(c.id-34)*14));
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};

const nodeCache=new Map();
const $=id=>{let node=nodeCache.get(id);if(!node){node=document.getElementById(id);if(node)nodeCache.set(id,node)}return node}, TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt)), mod=(a,b)=>((a%b)+b)%b;
const V={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,n)=>[a[0]*n,a[1]*n,a[2]*n],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let n=Math.hypot(...a)||1;return a.map(x=>x/n)},mix:(a,b,t)=>a.map((x,i)=>lerp(x,b[i],t))};
const I=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mm(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function mat(x=0,y=0,z=0,yaw=0,pitch=0,roll=0,sx=1,sy=1,sz=1){let c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);return new Float32Array([(c*cr+s*sp*sr)*sx,cp*sr*sx,(-s*cr+c*sp*sr)*sx,0,(-c*sr+s*sp*cr)*sy,cp*cr*sy,(s*sr+c*sp*cr)*sy,0,s*cp*sz,-sp*sz,c*cp*sz,0,x,y,z,1])}
function matInto(o,k,x=0,y=0,z=0,yaw=0,pitch=0,roll=0,sx=1,sy=1,sz=1){const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);o[k]=(c*cr+s*sp*sr)*sx;o[k+1]=cp*sr*sx;o[k+2]=(-s*cr+c*sp*sr)*sx;o[k+3]=0;o[k+4]=(-c*sr+s*sp*cr)*sy;o[k+5]=cp*cr*sy;o[k+6]=(s*sr+c*sp*cr)*sy;o[k+7]=0;o[k+8]=s*cp*sz;o[k+9]=-sp*sz;o[k+10]=c*cp*sz;o[k+11]=0;o[k+12]=x;o[k+13]=y;o[k+14]=z;o[k+15]=1}
function transform(a,m){return [a[0]*m[0]+a[1]*m[4]+a[2]*m[8]+m[12],a[0]*m[1]+a[1]*m[5]+a[2]*m[9]+m[13],a[0]*m[2]+a[1]*m[6]+a[2]*m[10]+m[14]]}
const hexCache=new Map();
function hex(h){if(Array.isArray(h))return h;let v=hexCache.get(h);if(!v){const k=h.replace('#','');v=[parseInt(k.slice(0,2),16)/255,parseInt(k.slice(2,4),16)/255,parseInt(k.slice(4,6),16)/255];hexCache.set(h,v)}return v}
let seed=2798;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const atlas=document.createElement('canvas');atlas.width=atlas.height=2048;const ax=atlas.getContext('2d');ax.fillStyle='white';ax.fillRect(0,0,2048,2048);const tiles={white:[2,2,8,8]};
function textTile(key,x,y,w,h,bg,text,fg='#fff',size=70){tiles[key]=[x+2,y+2,w-4,h-4];ax.fillStyle=bg;ax.fillRect(x,y,w,h);ax.save();ax.beginPath();ax.rect(x,y,w,h);ax.clip();ax.translate(x+w/2,y+h/2);ax.fillStyle=fg;ax.textAlign='center';ax.textBaseline='middle';ax.font=`italic 900 ${size}px Arial`;ax.fillText(text,0,5,w-30);ax.restore()}
tiles.road=[18,2,508,508];ax.fillStyle='#52616a';ax.fillRect(16,0,512,512);for(let i=0;i<33000;i++){let v=50+rand()*65;ax.fillStyle=`rgba(${v},${v+6},${v+12},.18)`;ax.fillRect(16+rand()*512,rand()*512,1+rand()*2,1+rand()*2)}
textTile('park',0,512,1024,128,'#072d4c','SUNSHORE  PARK','#ffdf3e',92);textTile('checkpoint',1024,512,1024,128,'#ffdc35','CHECKPOINT  >>>','#07243b',83);
textTile('sunline',0,640,512,128,'#ffffff','SUNLINE','#ed3a31',77);textTile('apex',512,640,512,128,'#092d47','APEX  MOTOR CO.','#53e2d4',52);textTile('volt',1024,640,512,128,'#ffdb31','VOLT  RACING','#09243d',57);textTile('ocean',1536,640,512,128,'#007fab','BLUE COAST','#ffffff',60);
['27','08','64','91','12','56','33','76'].forEach((n,i)=>textTile('num'+i,i*256,768,256,256,i===0?'#fff6dd':i===1?'#10334a':i===2?'#ffda3a':'#ffffff',n,i===1?'#ffffff':'#102e40',177));
textTile('side0',0,1024,1024,256,'#f04431','27   SUNLINE','#ffffff',148);textTile('side1',1024,1024,1024,256,'#0c9eae','08    APEX','#fffadf',148);textTile('side2',0,1280,1024,256,'#ffdc35','64    VOLT','#07263c',148);textTile('side3',1024,1280,1024,256,'#1d67c3','91    NOVA','#ffffff',148);
textTile('start',0,1536,1024,128,'#fffbe6','DAYS OF DAYTONA','#092e49',77);textTile('brake',1024,1536,512,128,'#ffdb30','BRAKE !','#112d40',85);textTile('chevron',1536,1536,512,128,'#082b41','› › › › ›','#ffe339',113);
textTile('finish',0,1664,1024,128,'#fffce7','START / FINISH','#0c2c46',91);textTile('tunnel',1024,1664,1024,128,'#0b314d','OCEAN  RUN  TUNNEL','#76e7ee',78);
textTile('coaster',0,1792,1024,128,'#f34336','THE SUNCHASER','#fffade',92);textTile('racing',1024,1792,1024,128,'#fffbe6','FULL THROTTLE. ALWAYS.','#164266',62);
CHAMPIONS.forEach((d,j)=>{let y=j*102;textTile('eliteSide'+j,544,y,512,100,d.paint,d.number+'  '+d.tag,'#fff9e5',64);textTile('eliteNum'+j,1056,y,128,100,d.accent,d.number,d.paint,79);textTile('eliteHood'+j,1184,y,352,100,d.accent,d.tag,d.paint,62)});
['91','12','56','33','76'].forEach((n,j)=>textTile('trafficSide'+j,1536,j*102,512,100,['#f04431','#148fbc','#8661b4','#efe6ca','#1e8a74'][j],n+'  RACING','#fff9e5',65));
// The atlas is one canvas texture with mipmaps and anisotropic filtering, as before.
const atlasTex=new THREE.CanvasTexture(atlas);atlasTex.anisotropy=8;
function uvrect(key){let [x,y,w,h]=tiles[key]||tiles.white;return [x/2048,1-(y+h)/2048,(x+w)/2048,1-y/2048]}
// Geometry builders write interleaved position / normal / colour / uv (11 floats per vertex)
// into a growing Float32Array, and become one THREE.BufferGeometry each.
const FLAT_UV=[[.003,.997],[.003,.997],[.003,.997]];
class Geo{
 constructor(cap=1<<15){this.data=new Float32Array(cap);this.n=0;this.m=I}
 reset(){this.n=0;this.m=I;return this}
 vert(p,n,co,t){const d=this.data,o=this.n;d[o]=p[0];d[o+1]=p[1];d[o+2]=p[2];d[o+3]=n[0];d[o+4]=n[1];d[o+5]=n[2];d[o+6]=co[0];d[o+7]=co[1];d[o+8]=co[2];d[o+9]=t[0];d[o+10]=t[1];this.n=o+11}
 tri(a,b,c,color='#ffffff',uv){if(this.m!==I){a=transform(a,this.m);b=transform(b,this.m);c=transform(c,this.m)}const n=V.norm(V.cross(V.sub(b,a),V.sub(c,a))),co=hex(color),t=uv||FLAT_UV;if(this.n+33>this.data.length){const d=new Float32Array(this.data.length*2);d.set(this.data.subarray(0,this.n));this.data=d}this.vert(a,n,co,t[0]);this.vert(b,n,co,t[1]);this.vert(c,n,co,t[2])}
 quad(a,b,c,d,col='#ffffff',key='white'){let [u0,v0,u1,v1]=uvrect(key);if(/^(side|eliteSide|trafficSide)/.test(key))[u0,u1]=[u1,u0];let t=[[u0,v0],[u0,v1],[u1,v1],[u1,v0]];this.tri(a,b,c,col,[t[0],t[1],t[2]]);this.tri(a,c,d,col,[t[0],t[2],t[3]])}
 box(x,y,z,w,h,d,col,key='white'){let a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;this.quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],col,key);this.quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],col,key);this.quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],col,key);this.quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],col,key);this.quad([a,e,g],[b,e,g],[b,e,f],[a,e,f],col);this.quad([a,c,f],[b,c,f],[b,c,g],[a,c,g],col)}
 cylinder(x,y,z,r,h,col,sides=8,r2=r){for(let i=0;i<sides;i++){let a=i/sides*TAU,b=(i+1)/sides*TAU,p=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],u=[x+Math.cos(b)*r2,y+h/2,z+Math.sin(b)*r2],v=[x+Math.cos(a)*r2,y+h/2,z+Math.sin(a)*r2];this.quad(p,q,u,v,col);this.tri([x,y+h/2,z],v,u,col);this.tri([x,y-h/2,z],q,p,col)}}
 beam(a,b,r,col,sides=6){let t=V.norm(V.sub(b,a)),n=V.norm(V.cross(t,Math.abs(t[1])>.9?[1,0,0]:[0,1,0])),q=V.cross(t,n);for(let i=0;i<sides;i++){let r0=i/sides*TAU,r1=(i+1)/sides*TAU,off=k=>V.add(V.mul(n,Math.cos(k)*r),V.mul(q,Math.sin(k)*r)),p=off(r0),s=off(r1);this.quad(V.add(a,p),V.add(b,p),V.add(b,s),V.add(a,s),col)}}
 sphere(x,y,z,rx,ry,rz,col,sides=10,rings=6){for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){let p=(j,i)=>{let t=j/rings*Math.PI,a=i/sides*TAU;return[x+rx*Math.sin(t)*Math.cos(a),y+ry*Math.cos(t),z+rz*Math.sin(t)*Math.sin(a)]};this.quad(p(j,i),p(j+1,i),p(j+1,i+1),p(j,i+1),col)}}
 disc(x,y,z,rx,rz,col,sides=20){for(let i=0;i<sides;i++){let a=i/sides*TAU,b=(i+1)/sides*TAU;this.tri([x,y,z],[x+Math.cos(b)*rx,y,z+Math.sin(b)*rz],[x+Math.cos(a)*rx,y,z+Math.sin(a)*rz],col)}}
 geometry(){const g=new THREE.BufferGeometry(),ib=new THREE.InterleavedBuffer(this.data.slice(0,this.n),11);g.setAttribute('position',new THREE.InterleavedBufferAttribute(ib,3,0));g.setAttribute('normal',new THREE.InterleavedBufferAttribute(ib,3,3));g.setAttribute('color',new THREE.InterleavedBufferAttribute(ib,3,6));g.setAttribute('uv',new THREE.InterleavedBufferAttribute(ib,2,9));g.computeBoundingSphere();this.data=null;return g}
}
// A closed, arc-length sampled circuit. x is across the track; s is distance along it.
const control=[[-240,0,-170],[-240,0,20],[-230,3,190],[-120,12,325],[60,18,370],[245,6,295],[325,1,160],[280,2,40],[365,8,-85],[320,16,-235],[145,10,-335],[-40,0,-310],[-215,0,-255]].map(p=>[p[0],p[1]+4,p[2]]);
function catmull(points,t){let n=points.length,f=mod(t,1)*n,i=Math.floor(f),a=f-i,p0=points[mod(i-1,n)],p1=points[i%n],p2=points[(i+1)%n],p3=points[(i+2)%n];return[0,1,2].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*a+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*a*a+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*a*a*a))}
let raw=[],acc=[0],L=0;for(let i=0;i<=4000;i++){raw.push(catmull(control,i===4000?0:i/4000));if(i){L+=Math.hypot(...V.sub(raw[i],raw[i-1]));acc.push(L)}}
const N=1400,track=[];let ri=0;for(let i=0;i<N;i++){let s=i/N*L;while(ri<acc.length-2&&acc[ri+1]<s)ri++;track.push(V.mix(raw[ri],raw[ri+1],(s-acc[ri])/(acc[ri+1]-acc[ri])))}
// REVERSE runs the same road the other way round: s is measured backwards along the forward spline.
let trackDir=1;
function pointF(s){let f=mod(s,L)/L*N,i=Math.floor(f);return V.mix(track[i],track[(i+1)%N],f-i)}
function point(s){return pointF(trackDir>0?s:L-s)}
const frameCache=new Map();
function frame(s){let cached=frameCache.get(s);if(cached)return cached;if(frameCache.size>=256)frameCache.clear();let value=computeFrame(s);frameCache.set(s,value);return value}
function computeFrame(s){let p=point(s),t=V.norm(V.sub(point(s+1),point(s-1))),r=V.norm([t[2],0,-t[0]]),before=V.norm(V.sub(point(s),point(s-4))),after=V.norm(V.sub(point(s+4),point(s))),cur=(Math.atan2(after[0],after[2])-Math.atan2(before[0],before[2]));cur=mod(cur+Math.PI,TAU)-Math.PI;cur/=4;return{p,t,r,cur,bank:clamp(-cur*23,-.18,.18),yaw:Math.atan2(t[0],t[2]),pitch:-Math.asin(t[1])}}
function roadPos(s,x=0,h=0){let f=frame(s);return V.add(V.add(f.p,V.mul(f.r,x)),[0,h+x*Math.sin(f.bank),0])}
function pose(s,x=0,h=0,yawOffset=0){let f=frame(s),p=V.add(V.add(f.p,V.mul(f.r,x)),[0,h+x*Math.sin(f.bank),0]);return mat(...p,f.yaw+yawOffset,f.pitch,f.bank)}
function setTrackDir(d){if(d===trackDir)return;trackDir=d;frameCache.clear()}
function poseInto(o,k,s,x=0,h=0,yawOffset=0){const f=frame(s),lift=h+x*Math.sin(f.bank);matInto(o,k,f.p[0]+f.r[0]*x,f.p[1]+f.r[1]*x+lift,f.p[2]+f.r[2]*x,f.yaw+yawOffset,f.pitch,f.bank)}
// The scenery is built for the forward direction; course-specific brake boards and grid boxes
// live in their own meshes so each direction gets boards before its own corners.
const world=new Geo(1<<20),road=new Geo(1<<20),decor=new Geo(1<<21),courseFwd=new Geo(),courseRev=new Geo();
// Ocean, island, and an infield lagoon.
world.quad([-4200,-4,4200],[4200,-4,4200],[4200,-4,-4200],[-4200,-4,-4200],'#209db5');
let shore=[[-1250,-740],[-1150,740],[-600,960],[160,850],[530,560],[535,240],[500,-70],[515,-500],[120,-750],[-650,-850]];
for(let i=0;i<shore.length;i++){let a=shore[i],b=shore[(i+1)%shore.length];world.tri([0,-1.2,0],[a[0],-1.2,a[1]],[b[0],-1.2,b[1]],'#79b84e');let v=V.norm([a[0],0,a[1]]),w=V.norm([b[0],0,b[1]]);world.quad([a[0],-1.1,a[1]],[b[0],-1.1,b[1]],[b[0]+w[0]*24,-3,b[1]+w[2]*24],[a[0]+v[0]*24,-3,a[1]+v[2]*24],'#ead7a0')}
world.disc(10,-.95,75,104,99,'#d8d5b2',56);world.disc(0,-.9,78,69,66,'#3fc0c2',50);
for(let i=0;i<38;i++){let x=560+rand()*1600,z=-1500+rand()*3000;world.quad([x,-3.85,z],[x+2,-3.85,z+3],[x+10+rand()*30,-3.85,z+3],[x+11+rand()*30,-3.85,z],'#71d0d8')}
// Continuous road ribbons, painted lanes, curbs, and crash barriers.
const sections=Math.ceil(L/4);for(let i=0;i<sections;i++){let s=i/sections*L,s2=(i+1)/sections*L,f=frame(s),g=frame(s2),rp=(f,x,h=0)=>V.add(V.add(f.p,V.mul(f.r,x)),[0,h+Math.sin(f.bank)*x,0]);let col=(s/L>.61&&s/L<.72)?'#929fac':'#ffffff';road.quad(rp(f,-11),rp(g,-11),rp(g,11),rp(f,11),col,'road');
 for(let side of [-1,1]){let inner=side*11,outer=side*12.1;road.quad(rp(f,inner,.017),rp(g,inner,.017),rp(g,outer,.017),rp(f,outer,.017),i%3===0?'#f14d3c':'#eeeedd');road.quad(rp(f,side*12.1,-.04),rp(g,side*12.1,-.04),rp(g,side*21,-.5),rp(f,side*21,-.5),i%2?'#76b749':'#73b247');road.quad(rp(f,side*10.65,.025),rp(g,side*10.65,.025),rp(g,side*10.80,.025),rp(f,side*10.80,.025),'#f8efc9');road.quad(rp(f,side*13.1,0),rp(g,side*13.1,0),rp(g,side*13.1,1.15),rp(f,side*13.1,1.15),Math.floor(i/4)%2?'#f2eee1':'#217daa');road.quad(rp(f,side*13.1,1.15),rp(g,side*13.1,1.15),rp(g,side*13.6,1.15),rp(f,side*13.6,1.15),'#f4f1dc');let a=rp(f,side*21,-.5),b=rp(g,side*21,-.5),c=rp(g,side*45),d=rp(f,side*45);c[1]=d[1]=-1.17;road.quad(a,b,c,d,'#6fac4a');}
 if(i%4<2)for(let x of [-3.65,3.65])road.quad(rp(f,x-.08,.028),rp(g,x-.08,.028),rp(g,x+.08,.028),rp(f,x+.08,.028),'#f0ebd4');
}
// Start grid and checkerboard. Markers are flat geometry, not external textures.
for(let i=0;i<14;i++)for(let j=0;j<3;j++){let x=-11+i*22/14,s=j*1.25;road.quad(roadPos(s,x,.04),roadPos(s+1.25,x,.04),roadPos(s+1.25,x+22/14,.04),roadPos(s,x+22/14,.04),(i+j)%2?'#fff6de':'#122b3c')}
for(let k=1;k<=8;k++)for(let x of [-5.5,5.5]){let s=-k*10;courseFwd.quad(roadPos(s,x-1.35,.04),roadPos(s+.13,x-1.35,.04),roadPos(s+.13,x+1.35,.04),roadPos(s,x+1.35,.04),'#edeedb');for(let xx of [x-1.35,x+1.35])courseFwd.quad(roadPos(s,xx,.04),roadPos(s+3.7,xx,.04),roadPos(s+3.7,xx+.12,.04),roadPos(s,xx+.12,.04),'#edeedb')}
// Reverse grid boxes sit on the other side of the line (built in forward coordinates).
for(let k=1;k<=8;k++)for(let x of [-5.5,5.5]){let s=k*10;courseRev.quad(roadPos(s-.13,x-1.35,.04),roadPos(s,x-1.35,.04),roadPos(s,x+1.35,.04),roadPos(s-.13,x+1.35,.04),'#edeedb');for(let xx of [x-1.35,x+1.35])courseRev.quad(roadPos(s-3.7,xx,.04),roadPos(s,xx,.04),roadPos(s,xx+.12,.04),roadPos(s-3.7,xx+.12,.04),'#edeedb')}
function arch(s,key){decor.m=mm(pose(s),mat(0,0,0,0,0,0,1,key==='checkpoint'&&s/L>.6?.78:1,1));for(let x of [-15,15]){decor.box(x,4.4,0,.8,8.8,.9,'#e4e8dd');decor.box(x,1,0,1.8,2,1.8,'#174d64');decor.beam([x,6.8,0],[x*.66,9,0],.15,'#fdd748')}decor.box(0,9,0,31,3,.7,'#092e49');decor.quad([-15,7.55,-.37],[-15,10.45,-.37],[15,10.45,-.37],[15,7.55,-.37],'#ffffff',key);decor.quad([15,7.55,.37],[15,10.45,.37],[-15,10.45,.37],[-15,7.55,.37],'#ffffff',key);decor.m=I}
arch(0,'start');arch(L/3,'checkpoint');arch(L*2/3,'checkpoint');
function billboard(s,side,key,w=15,h=3.8,high=4,g=decor){g.m=pose(s,side*20);g.box(-w*.35,high*.5,0,.22,high,.22,'#9bb3aa');g.box(w*.35,high*.5,0,.22,high,.22,'#9bb3aa');g.box(0,high+h/2,0,w,h,.35,'#133f55');g.quad([-w/2,high,-.19],[-w/2,high+h,-.19],[w/2,high+h,-.19],[w/2,high,-.19],'#ffffff',key);g.quad([w/2,high,.19],[w/2,high+h,.19],[-w/2,high+h,.19],[-w/2,high,.19],'#ffffff',key);g.m=I}
for(let s=105;s<L;s+=110)billboard(s,s%220>110?-1:1,['sunline','ocean','volt','apex','racing'][Math.floor(s/110)%5],13,3.2,2.8);
for(let s of [390,830,1160,1450,1830]){billboard(s,-1,'brake',8,2.6,2,courseFwd);billboard(s+35,-1,'chevron',10,2.5,2,courseFwd)}
// Reverse: brake boards ahead of the reverse corners, on the driver's left (forward side +1), placed
// clear of the flags, arches and sponsor boards. Pairs are [brake, chevron] in reverse distance.
for(let [b,c] of [[752,790],[875,905],[1030,1052],[1775,1805],[2140,2170]]){billboard(L-b,1,'brake',8,2.6,2,courseRev);billboard(L-c,1,'chevron',10,2.5,2,courseRev)}
// Grandstands at the rolling start.
decor.m=pose(85,-34);decor.box(-8,-.3,0,23,.6,153,'#aebcae');for(let row=0;row<9;row++){decor.box(-row*2,(2.65+row*1.25)/2,0,2.6,2.65+row*1.25,154,['#086db0','#e85241','#f2d346'][Math.floor(row/3)]);for(let j=0;j<95;j++){let z=-74+j*1.58;decor.box(-row*2,3.0+row*1.25,z,.48,.70,.52,['#fff4d2','#153d64','#ffcd3c','#e74440','#73d1dc'][Math.floor(rand()*5)])}}for(let z=-77;z<=77;z+=22){decor.box(-19,13,z,.45,26,.45,'#e6e5d6');decor.beam([-19,24,z],[4,21,z],.24,'#e5e8dc')}decor.box(-8,24,0,27,.4,165,'#f6f2d8');decor.box(5,22,0,.3,2,165,'#1585b4');decor.m=I;
// Pit buildings opposite the grandstand.
decor.m=pose(80,35);decor.box(0,3.4,0,15,6.8,123,'#f3e8c8');decor.box(0,7.1,0,17,.5,128,'#168da3');for(let j=0;j<12;j++){decor.box(-7.6,2.6,-54+j*10,.15,3.8,7,'#173e57');decor.box(-7.72,4.6,-54+j*10,.16,.6,7,j%2?'#ffda38':'#f24e3d')}decor.box(0,10,-23,14,5,42,'#e5eadc');decor.box(-7.15,10,-23,.15,3.5,38,'#266881');decor.box(0,12.6,-23,16,.4,45,'#ffdc35');decor.m=I;
// Trees use hand-built low-polygon fronds and trunks.
function palm(x,y,z,h=12,angle=0){decor.m=mat(x,y,z,angle);decor.beam([0,0,0],[.6,h*.58,0],.32,'#be9061',7);decor.beam([.6,h*.58,0],[1.6,h,0],.24,'#d3a675',7);for(let i=0;i<7;i++){let a=i/7*TAU,dx=Math.cos(a),dz=Math.sin(a),side=[-dz*.7,0,dx*.7],c=[1.6,h,0],mid=[1.6+dx*h*.28,h+.6,dz*h*.28],tip=[1.6+dx*h*.50,h-h*.13,dz*h*.50];decor.tri(c,V.add(mid,side),tip,i%2?'#287c45':'#309b48');decor.tri(c,tip,V.sub(mid,side),'#47ad4d')}decor.m=I}
for(let s=15;s<L;s+=43){let f=frame(s);for(let side of [-1,1]){if(s/L>.60&&s/L<.73)continue;if(s<180&&side<0)continue;let p=roadPos(s,side*(24+rand()*14));p[1]=lerp(roadPos(s,side*21,-.5)[1],-1.17,clamp((Math.hypot(p[0]-f.p[0],p[2]-f.p[2])-21)/24,0,1));palm(p[0],p[1]-.4,p[2],10+rand()*7,rand()*TAU)}}
// Low-poly coastal hills and blue mountain silhouettes.
for(let i=0;i<50;i++){let angle=TAU*i/50,x=Math.cos(angle)*(750+rand()*330),z=Math.sin(angle)*(750+rand()*250);if(x>420)continue;let h=80+rand()*150;world.cylinder(x,h/2-2,z,105+rand()*100,h,['#78a98c','#76af85','#6da882','#8bb196'][i%4],7,3)}
for(let i=0;i<31;i++){let x=-630+rand()*1350,z=580+rand()*380;let h=70+rand()*110;world.cylinder(x,h/2,z,130+rand()*100,h,['#709e9e','#7baaa5','#75a297'][i%3],6,5)}
// Puffy faceted clouds, with no downloaded skybox.
for(let i=0;i<33;i++){let a=i/33*TAU,r=620+rand()*500,cx=Math.cos(a)*r,cz=Math.sin(a)*r,cy=170+rand()*160;for(let j=0;j<4;j++)world.sphere(cx+j*24,cy+(j%2)*9,cz,38+rand()*22,20+rand()*15,27,'#f6f8ef',7,4)}
// Track lamps and flags.
for(let s=0;s<330;s+=35){decor.m=pose(s,-17);decor.box(0,8,0,.23,16,.23,'#c8d4cd');decor.beam([0,16,0],[3.6,15.5,0],.14,'#cedacf');decor.box(3.6,15.4,0,1.3,.25,2.1,'#fff6cf');decor.m=I}
for(let s=0;s<L;s+=88){decor.m=pose(s,18);decor.cylinder(0,5,0,.08,10,'#d8e1d8',5);decor.quad([0,10,0],[0,7.6,0],[3.5,8.1,.7],[3.3,10,.5],Math.floor(s/88)%2?'#f64c35':'#ffdc35');decor.m=I}
// The ocean tunnel: open portals, lights, and steel ribs.
for(let s=L*.615;s<L*.719;s+=7){let end=Math.min(s+7,L*.719);for(let side of [-1,1])decor.quad(roadPos(s,side*14,-.2),roadPos(end,side*14,-.2),roadPos(end,side*14,9),roadPos(s,side*14,9),'#426777');decor.quad(roadPos(s,-14,9),roadPos(end,-14,9),roadPos(end,14,9),roadPos(s,14,9),'#2f5267');if(Math.floor(s/7)%3===0){decor.m=pose(s);decor.box(-13.7,4.5,0,.38,9,.5,'#a5bec4');decor.box(13.7,4.5,0,.38,9,.5,'#a5bec4');decor.box(0,8.85,0,27,.4,.5,'#a5bec4');decor.box(-8,8.56,0,1.5,.18,2.5,'#fff7bd');decor.box(8,8.56,0,1.5,.18,2.5,'#fff7bd');decor.m=I}}
arch(L*.615,'tunnel');arch(L*.719,'ocean');
// Amusement park buildings, a candy-striped tower, and a giant wheel.
for(let i=0;i<12;i++){let a=i/12*TAU,x=20+Math.cos(a)*114,z=75+Math.sin(a)*103;if(x<-70&&z>30)continue;let h=4+rand()*4;decor.box(x,h/2,z,13,h,12,['#f8d772','#f2a091','#9cd9c2','#92cada'][i%4]);decor.cylinder(x,h+2,z,10,4,['#f65242','#4caeae','#f7dc53'][i%3],4,0)}
decor.cylinder(82,31,120,4,62,'#e9e3cd',10);for(let j=0;j<12;j++)decor.cylinder(82,4+j*4.8,120,4.1,2.2,j%2?'#ffdb38':'#ef583f',10);decor.cylinder(82,63,120,12,4,'#ec4639',12,9);decor.cylinder(82,68,120,9,6,'#ffe9ad',12,1);
const wheelCenter=[-100,63,132],wheelR=53;
for(let z of [wheelCenter[2]-5,wheelCenter[2]+5]){decor.beam([-125,0,z-2],[-100,63,z],1.2,'#ef4d3b',8);decor.beam([-75,0,z+2],[-100,63,z],1.2,'#ef4d3b',8);decor.beam([-125,0,z-2],[-75,0,z+2],.9,'#f2d347',8)}decor.beam([-100,63,121],[-100,63,143],2,'#f7d34c',10);
let wg=new Geo();for(let i=0;i<72;i++){let a=i/72*TAU,b=(i+1)/72*TAU;for(let z of [-3,3])wg.beam([Math.cos(a)*wheelR,Math.sin(a)*wheelR,z],[Math.cos(b)*wheelR,Math.sin(b)*wheelR,z],.65,'#f9e8bd',6);if(i%6===0){for(let z of [-3,3])wg.beam([0,0,z],[Math.cos(a)*wheelR,Math.sin(a)*wheelR,z],.21,'#f8e8c8',5);wg.beam([Math.cos(a)*wheelR,Math.sin(a)*wheelR,-3],[Math.cos(a)*wheelR,Math.sin(a)*wheelR,3],.5,'#f7ce35',6)}}let wheelMesh=wg.geometry();let gondolas=[];for(let i=0;i<4;i++){let g=new Geo(),col=['#f45336','#ffce3c','#27bac7','#ef729a'][i];g.box(0,-2.4,0,4.2,2.4,4.4,col);g.box(0,-.4,0,3.8,1.8,4,'#17475e');g.box(0,.7,0,4.5,.5,4.6,col);g.beam([0,1,0],[0,3.3,0],.2,'#f8efd5');gondolas.push(g.geometry())}
// Red coaster rails with visible sleepers and support columns.
let cp=[[15,12,5],[90,20,-10],[183,51,40],[205,42,150],[120,14,217],[5,8,204],[-50,17,120],[8,25,77],[107,13,112],[117,8,33]];
for(let i=0;i<240;i++){let p=catmull(cp,i/240),q=catmull(cp,(i+1)/240),t=V.norm(V.sub(q,p)),r=V.norm([t[2],0,-t[0]]);for(let side of [-1,1])decor.beam(V.add(p,V.mul(r,side*1.2)),V.add(q,V.mul(r,side*1.2)),.31,'#ed4738',6);if(i%2===0)decor.beam(V.add(p,V.mul(r,-1.45)),V.add(p,V.mul(r,1.45)),.16,'#ffad44',5);if(i%8===0){decor.beam([p[0]-3,0,p[2]],V.add(p,V.mul(r,-1.4)),.38,'#e5e4cc',6);decor.beam([p[0]+3,0,p[2]],V.add(p,V.mul(r,1.4)),.38,'#e5e4cc',6)}}
// A vertical loop makes the skyline read as an arcade theme park.
for(let i=0;i<64;i++){let a=i/64*TAU,b=(i+1)/64*TAU;for(let z of [45,48])decor.beam([155+Math.cos(a)*30,34+Math.sin(a)*30,z],[155+Math.cos(b)*30,34+Math.sin(b)*30,z],.40,'#ef483c',6);if(i%4===0)decor.beam([155+Math.cos(a)*30,34+Math.sin(a)*30,45],[155+Math.cos(a)*30,34+Math.sin(a)*30,48],.20,'#f8c66c',5);if(i%8===0&&Math.sin(a)>0)decor.beam([155+Math.cos(a)*30,0,46.5],[155+Math.cos(a)*30,34+Math.sin(a)*30,46.5],.36,'#efe7cc',6)}
decor.box(155,5.5,29,44,4,.8,'#ef4a38');decor.quad([133,3.5,28.5],[133,7.5,28.5],[177,7.5,28.5],[177,3.5,28.5],'#ffffff','coaster');
let trainGeo=new Geo();for(let i=0;i<4;i++){trainGeo.box(0,1,-i*3.2,2.2,1.1,2.6,'#ffdc3b');trainGeo.box(0,1.7,-i*3.2-.6,2,1,1,'#de4b38');for(let x of [-.55,.55])trainGeo.sphere(x,2,-i*3.2+.1,.3,.35,.3,'#efc194',6,4)}const trainMesh=trainGeo.geometry();
const worldMesh=world.geometry(),roadMesh=road.geometry(),decorMesh=decor.geometry(),courseFwdMesh=courseFwd.geometry(),courseRevMesh=courseRev.geometry();
await nextPaint();

// Stock cars: shaped panels, window glass, sponsor paint, slick tires, and a rear wing.
const carSpecs=[{name:'SUNLINE',number:'27',col:'#ef4635',accent:'#fff8df',max:94,accel:1,grip:1,desc:'BALANCED / A steady car with a strong top speed.'},{name:'APEX',number:'08',col:'#12a8b5',accent:'#092d48',max:91,accel:1.08,grip:1.22,desc:'GRIP / Fast pickup. Stable in the tight turns.'},{name:'VOLT',number:'64',col:'#ffdc37',accent:'#132d46',max:99,accel:.93,grip:.86,desc:'POWER / The fastest car. Take care in the turns.'}];
function makeCar(index){let spec=carSpecs[index%3],col=index>=8?CHAMPIONS[index-8].paint:index<3?spec.col:['#267acd','#9558bb','#eeeece','#ea7039','#238c78'][index%5],accent=index>=8?CHAMPIONS[index-8].accent:spec.accent,g=new Geo();
 let x=1.15;g.box(0,.52,0,2.24,.48,4.75,col);g.box(0,.34,0,2.31,.14,4.65,'#192f3b');
 // Tapered main body. Nose is +z.
 g.quad([-1.12,.62,2.42],[-1.02,1.01,2.23],[1.02,1.01,2.23],[1.12,.62,2.42],col);g.quad([-1.12,.65,-2.35],[1.12,.65,-2.35],[1.1,1.02,-2.12],[-1.1,1.02,-2.12],col);
 g.quad([-1.02,1.01,2.23],[-1.06,1.12,.61],[1.06,1.12,.61],[1.02,1.01,2.23],col);g.quad([-1.1,1.02,-2.12],[1.1,1.02,-2.12],[1.08,1.1,-1.06],[-1.08,1.1,-1.06],col);
 for(let side of [-1,1]){g.quad([side*1.12,.66,-2.35],[side*1.12,.66,2.42],[side*1.02,1.01,2.23],[side*1.1,1.02,-2.12],col);g.box(side*1.156,.67,0,.018,.43,2.2,col);if(side<0)g.quad([side*1.172,.48,-1.13],[side*1.172,.96,-1.13],[side*1.172,.96,1.18],[side*1.172,.48,1.18],'#ffffff',(index>=8?'eliteSide'+(index-8):index>=3?'trafficSide'+(index-3):'side'+index));else g.quad([side*1.172,.48,1.18],[side*1.172,.96,1.18],[side*1.172,.96,-1.13],[side*1.172,.48,-1.13],'#ffffff',(index>=8?'eliteSide'+(index-8):index>=3?'trafficSide'+(index-3):'side'+index));}
 // Roof and raked glass.
 g.quad([-.86,1.12,-1.08],[-.79,1.69,-.59],[.79,1.69,-.59],[.86,1.12,-1.08],'#163f58');g.quad([-.79,1.69,.20],[-1.0,1.12,.81],[1.0,1.12,.81],[.79,1.69,.20],'#194a65');g.quad([-.79,1.69,-.59],[-.79,1.69,.20],[.79,1.69,.20],[.79,1.69,-.59],accent,(index>=8?'eliteNum'+(index-8):'num'+index));
 for(let side of [-1,1]){g.quad([side*.86,1.12,-1.08],[side*1.0,1.12,.81],[side*.79,1.69,.2],[side*.79,1.69,-.59],'#173c52');g.beam([side*.86,1.12,-1.08],[side*.79,1.69,-.59],.046,col,5);g.beam([side*1.0,1.12,.81],[side*.79,1.69,.20],.048,col,5);g.beam([side*.9,1.13,-.15],[side*.80,1.67,-.15],.04,col,5);g.box(side*1.14,1.18,.63,.27,.14,.27,col)}
 // Glass highlights, windshield header, and hood stripe.
 g.quad([-.74,1.68,.21],[-.97,1.15,.78],[-.60,1.15,.78],[-.51,1.68,.21],'#437994');g.quad([-.79,1.69,.201],[-.82,1.61,.29],[.82,1.61,.29],[.79,1.69,.201],col);
 g.quad([-.43,1.017,2.2],[-.43,1.127,.67],[.43,1.127,.67],[.43,1.017,2.2],accent);g.quad([-.57,1.034,1.94],[-.57,1.073,1.40],[.57,1.073,1.40],[.57,1.034,1.94],'#ffffff',(index>=8?'eliteHood'+(index-8):['sunline','apex','volt'][index%3]));
 // Rear deck sponsor, taillights, grille, and exhausts.
 g.quad([-.69,.65,-2.365],[-.69,.96,-2.23],[.69,.96,-2.23],[.69,.65,-2.365],'#ffffff',(index>=8?'eliteHood'+(index-8):['sunline','apex','volt'][index%3]));g.box(0,.58,2.437,.96,.20,.05,'#163041');for(let side of [-1,1]){g.box(side*.77,.81,2.37,.44,.19,.08,'#eeeac6');g.box(side*.89,.82,-2.34,.27,.16,.08,'#961e24');g.box(side*.72,.36,-2.41,.18,.14,.18,'#282d31');g.box(side*.67,1.12,-1.94,.11,.48,.17,'#23394a')}g.box(0,1.37,-1.98,2.49,.12,.56,accent);g.box(-1.24,1.41,-1.98,.055,.26,.56,col);g.box(1.24,1.41,-1.98,.055,.26,.56,col);
 // Dark wheel arches and twelve-sided tires.
 for(let side of [-1,1])for(let z of [-1.52,1.47]){g.m=mat(side*1.10,.46,z,0,0,Math.PI/2);g.cylinder(0,0,0,.445,.29,'#17212a',12);g.cylinder(0,side<0?.162:-.162,0,.286,.026,'#667278',10);g.cylinder(0,side<0?.180:-.180,0,.19,.03,'#a6afaa',8);g.cylinder(0,side<0?.2:-.2,0,.075,.035,'#313e49',6);g.m=I;}
 return g.geometry()
}
const carMeshes=[];for(let i=0;i<13;i++)carMeshes.push(makeCar(i));
let sg=new Geo();sg.disc(0,.035,0,1.30,2.52,'#33403e',20);const shadowMesh=sg.geometry();let pg=new Geo();pg.sphere(0,0,0,1,1,1,'#d3d6c8',6,3);const smokeMesh=pg.geometry();let spg=new Geo();spg.box(0,0,0,.06,.06,.55,'#ffe84d');const sparkMesh=spg.geometry();
let brakeGeo=new Geo();for(let x of [-.89,.89])brakeGeo.box(x,.82,-2.39,.28,.16,.035,'#ff6241');const brakeMesh=brakeGeo.geometry();

// ---- three.js scene -------------------------------------------------------------------------
// The original view matrix mirrored the picture left/right (its "right" vector was z × up), so the
// whole world sits under a root scaled -1 on x and the camera is placed in that mirrored space.
// Game logic keeps its own coordinates; only the camera, the light and screen projection know.
const scene=new THREE.Scene();
const root=new THREE.Group();root.scale.x=-1;scene.add(root);
const camera=kit.fitCamera(new THREE.PerspectiveCamera(65,1,.17,2400));
// Sky: the original full-screen gradient with a warm sun glow, tilted with the camera pitch.
const skyPitch=T.uniform(0);
{
 const v=T.vec2(T.screenUV.x.mul(2).sub(1),T.float(1).sub(T.screenUV.y.mul(2)));
 const h=T.clamp(v.y.add(skyPitch).mul(.65).add(.40),0,1),sun=v.sub(T.vec2(.7,.7));
 scene.backgroundNode=T.mix(T.vec3(.73,.91,.95),T.vec3(.07,.49,.85),T.pow(h,.6)).add(T.vec3(.10,.07,.015).mul(T.exp(T.dot(sun,sun).mul(-10))));
}
// One material for everything: atlas × vertex colour × (0.72 + 0.36·N·L), then the original
// distance fog curve. The light's x is mirrored with the scene root. Faces draw from both sides,
// as they did (the old renderer never enabled face culling).
const SUN_DIR=T.normalize(T.vec3(.45,.85,.30)),FOG_COLOR=T.vec3(.69,.86,.90);
function arcadeMaterial(params={}){
 const m=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,...params});
 const light=T.float(.72).add(T.max(T.dot(T.normalWorldGeometry,SUN_DIR),0).mul(.36));
 const lit=T.texture(atlasTex).rgb.mul(T.attribute('color','vec3')).mul(light);
 const fog=T.smoothstep(260,1120,T.positionWorld.distance(T.cameraPosition)).mul(.96);
 m.colorNode=T.vec4(T.mix(lit,FOG_COLOR,fog),1);
 return m;
}
const arcadeMat=arcadeMaterial(),ghostMat=arcadeMaterial({transparent:true,opacity:.42,depthWrite:false});
function addMesh(geo,material=arcadeMat){const m=new THREE.Mesh(geo,material);root.add(m);return m}
function movingMesh(geo,material){const m=addMesh(geo,material);m.matrixAutoUpdate=false;return m}
function instanced(geo,cap){const m=new THREE.InstancedMesh(geo,arcadeMat,cap);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.count=0;m.visible=false;root.add(m);return m}
function setMatrix(obj,arr){obj.matrix.fromArray(arr);obj.matrixWorldNeedsUpdate=true}
function commitInstances(m,n){m.count=n;m.visible=n>0;if(n){m.instanceMatrix.clearUpdateRanges();m.instanceMatrix.addUpdateRange(0,n*16);m.instanceMatrix.needsUpdate=true}}
addMesh(worldMesh);addMesh(roadMesh);addMesh(decorMesh);
const courseFwdObj=addMesh(courseFwdMesh),courseRevObj=addMesh(courseRevMesh);courseRevObj.visible=false;
const wheelObj=movingMesh(wheelMesh),gondolaObjs=[];for(let i=0;i<12;i++)gondolaObjs.push(movingMesh(gondolas[i%4]));
const trainObj=movingMesh(trainMesh);
// Rivals only ever use models 3–12; each model is one instanced draw, and all contact shadows are one more.
const carInst=carMeshes.map((g,i)=>i<3?null:instanced(g,40)),carCounts=new Int32Array(carMeshes.length);
const shadowInst=instanced(shadowMesh,48);
const PARTICLE_CAP=128,smokeInst=instanced(smokeMesh,PARTICLE_CAP),sparkInst=instanced(sparkMesh,PARTICLE_CAP);
const playerObj=movingMesh(carMeshes[0]),brakeObj=movingMesh(brakeMesh),ghostObj=movingMesh(carMeshes[0],ghostMat);ghostObj.visible=false;ghostObj.renderOrder=2;
const tmpM=new Float32Array(16);

// Persistent tire marks: a ring of 700 segments in one dynamic buffer.
const skidMax=700,SKID_FLOATS=12*11,skidArray=new Float32Array(skidMax*SKID_FLOATS),skidBuffer=new THREE.InterleavedBuffer(skidArray,11);skidBuffer.setUsage(THREE.DynamicDrawUsage);
const skidGeometry=new THREE.BufferGeometry();skidGeometry.setAttribute('position',new THREE.InterleavedBufferAttribute(skidBuffer,3,0));skidGeometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(skidBuffer,3,3));skidGeometry.setAttribute('color',new THREE.InterleavedBufferAttribute(skidBuffer,3,6));skidGeometry.setAttribute('uv',new THREE.InterleavedBufferAttribute(skidBuffer,2,9));skidGeometry.setDrawRange(0,0);
const skidObj=addMesh(skidGeometry);skidObj.frustumCulled=false;skidObj.visible=false;
const skidGeo=new Geo(SKID_FLOATS);
let skidCount=0,skidIndex=0,lastSkidS=-9999,lastSkidX=0;
function clearSkids(){skidCount=skidIndex=0;skidGeometry.setDrawRange(0,0);skidObj.visible=false;lastSkidS=-9999}
function addSkid(s,x){if(Math.abs(s-lastSkidS)<.65)return;let g=skidGeo.reset(),from=s-1.0,oldx=x;if(Math.abs(s-lastSkidS)<3){from=lastSkidS;oldx=lastSkidX}for(let offset of [-.92,.92])g.quad(roadPos(from-1.6,oldx+offset-.085,.05),roadPos(s-1.6,x+offset-.085,.05),roadPos(s-1.6,x+offset+.085,.05),roadPos(from-1.6,oldx+offset+.085,.05),'#343e43');skidArray.set(g.data.subarray(0,SKID_FLOATS),skidIndex*SKID_FLOATS);skidBuffer.addUpdateRange(skidIndex*SKID_FLOATS,SKID_FLOATS);skidBuffer.needsUpdate=true;skidIndex=(skidIndex+1)%skidMax;skidCount=Math.min(skidMax,skidCount+1);skidGeometry.setDrawRange(0,skidCount*12);skidObj.visible=true;lastSkidS=s;lastSkidX=x}
// Original synthesised V8, tire noise, arcade cues, and a small rock sequencer.
class AudioRig{
 constructor(){this.ctx=null;this.muted=false;this.music=true;this.volume=.65;this.nextBeat=0;this.beat=0;this.radioUntil=0;this.blocked=new Set()}
 async start(){if(this.ctx){if(this.ctx.state==='suspended'&&!this.blocked.size)await this.ctx.resume().catch(()=>{});return}try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;let c=this.ctx=new AC();this.master=c.createGain();this.master.gain.value=this.muted?0:this.volume*.55;let limiter=c.createDynamicsCompressor();limiter.threshold.value=-13;limiter.knee.value=18;limiter.ratio.value=5;this.master.connect(limiter);limiter.connect(c.destination);this.musicBus=c.createGain();this.musicBus.gain.value=.27;this.musicBus.connect(this.master);this.engineBus=c.createGain();this.engineBus.gain.value=0;let filter=this.engineFilter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;let distortion=c.createWaveShaper();let curve=new Float32Array(1024);for(let i=0;i<1024;i++){let x=i/512-1;curve[i]=Math.tanh(x*2.5)}distortion.curve=curve;this.engineBus.connect(filter);filter.connect(distortion);distortion.connect(this.master);this.oscs=[];for(let [type,ratio,vol] of [['sawtooth',1,.35],['sawtooth',2.005,.18],['triangle',.5,.3]]){let o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=70*ratio;g.gain.value=vol;o.connect(g);g.connect(this.engineBus);o.start();this.oscs.push({o,ratio})}let nb=this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.wind=this.noiseLoop('lowpass',1900);this.skid=this.noiseLoop('bandpass',1900);this.wind.g.gain.value=0;this.skid.g.gain.value=0;this.squeal=c.createOscillator();this.squeal.type='sine';this.squeal.frequency.value=760;this.squealG=c.createGain();this.squealG.gain.value=0;this.squeal.connect(this.squealG);this.squealG.connect(this.master);this.squeal.start();this.nextBeat=c.currentTime+.15;if(this.blocked.size)await c.suspend().catch(()=>{});else await c.resume().catch(()=>{})}catch(e){console.warn('Audio disabled:',e.message);this.ctx=null}}
 noiseLoop(type,freq){let c=this.ctx,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;n.loop=true;f.type=type;f.frequency.value=freq;f.Q.value=.8;n.connect(f);f.connect(g);g.connect(this.master);n.start();return{n,g,f}}
 setMute(v){this.muted=v;if(this.ctx)this.master.gain.setTargetAtTime(v?0:this.volume*.55,this.ctx.currentTime,.035);if(v&&window.speechSynthesis)window.speechSynthesis.cancel();if(v&&typeof crew!=='undefined')crew.silence();$('muteBtn').textContent=v?'SOUND OFF':'SOUND ON';savePrefs()}
 setVolume(v){v=clamp(Number.isFinite(v)?v:0,0,1);this.volume=v;if(v===0&&typeof crew!=='undefined')crew.silence();if(this.ctx)this.master.gain.setTargetAtTime(this.muted?0:v*.55,this.ctx.currentTime,.04)}
 tone(freq,duration=.1,vol=.2,type='square',when,bus){if(!this.ctx)return;let c=this.ctx,t=when??c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.007);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(bus||this.master);o.start(t);o.stop(t+duration+.015);o.onended=()=>{o.disconnect();g.disconnect()}}
 noiseHit(t,duration,vol,type='highpass',freq=2000,bus){let c=this.ctx;if(!c)return;let n=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();n.buffer=this.noise;f.type=type;f.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);n.connect(f);f.connect(g);g.connect(bus||this.master);n.start(t);n.stop(t+duration+.01);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect()}}
 cue(type){if(!this.ctx||this.muted)return;let t=this.ctx.currentTime;if(type==='go'){[523,659,784,1047].forEach((f,i)=>this.tone(f,.19,.17,'square',t+i*.07))}else if(type==='checkpoint'){[660,880,1100,1320].forEach((f,i)=>this.tone(f,.22,.13,'square',t+i*.075))}else if(type==='hit'){this.noiseHit(t,.23,.8,'lowpass',1000);this.tone(67,.20,.4,'triangle')}else if(type==='shift')this.noiseHit(t,.045,.15,'bandpass',700);else if(type==='finish'){[523,659,784,1047,784,1047,1318].forEach((f,i)=>this.tone(f,.24,.20,'square',t+i*.12))}else this.tone(620,.12,.17)}
 // Suspend the whole mix while the settings panel is open or the tab is hidden.
 block(reason,on){if(on)this.blocked.add(reason);else this.blocked.delete(reason);if(!this.ctx)return;if(this.blocked.size)this.ctx.suspend().catch(()=>{});else this.ctx.resume().catch(()=>{})}
 tick(dt,p,active){if(!this.ctx)return;let c=this.ctx,t=c.currentTime;this.engineBus.gain.setTargetAtTime((active?.36+p.throttle*.13:state==='paused'?0:.035)*(t<this.radioUntil?.48:1),t,.06);let f=(27+p.rpm/85)*(state==='race'?lerp(.57,1,battle.scale):1);for(let {o,ratio} of this.oscs)o.frequency.setTargetAtTime(f*ratio,t,.035);this.engineFilter.frequency.setTargetAtTime(550+p.rpm*.18+p.throttle*600,t,.08);this.wind.g.gain.setTargetAtTime(active?Math.pow(p.v/100,2)*.17:0,t,.1);this.skid.g.gain.setTargetAtTime(active?p.drift*.12+Math.min(1,Math.abs(p.lat)/16)*p.drift*.1:0,t,.035);this.squealG.gain.setTargetAtTime(active?p.drift*.043:0,t,.04);this.squeal.frequency.setTargetAtTime(640+p.v*4+Math.sin(t*22)*35,t,.04);this.musicBus.gain.setTargetAtTime(this.music&&active?(t<this.radioUntil?.043:.20):0,t,.1);
 if(!active||!this.music){this.nextBeat=t+.1;return}if(this.nextBeat<t-.3)this.nextBeat=t+.05;let n=0;while(this.nextBeat<t+.14&&n++<4){this.musicStep(this.nextBeat,this.beat++);this.nextBeat+=60/142/4}}
 musicStep(t,step){let c=this.ctx,b=this.musicBus,k=step%16,bar=Math.floor(step/16)%8,root=[40,40,43,43,38,38,45,47][bar],hz=n=>440*Math.pow(2,(n-69)/12);if(k%4===0){let o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(43,t+.12);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.19);o.connect(g);g.connect(b);o.start(t);o.stop(t+.21);o.onended=()=>{o.disconnect();g.disconnect()}}if(k===4||k===12){this.noiseHit(t,.14,.52,'highpass',900,b);this.tone(175,.10,.14,'triangle',t,b)}this.noiseHit(t,k%4===2?.07:.025,k%2===0?.12:.055,'highpass',6500,b);if(k%2===0){let off=[0,0,7,0,10,7,3,5][k/2];this.tone(hz(root+off),.18,.26,'sawtooth',t,b);if(k%4===0){this.tone(hz(root+12),.24,.07,'sawtooth',t,b);this.tone(hz(root+19),.24,.055,'sawtooth',t,b)}}if(bar>=4&&k%2===1){let melody=[12,15,19,22,19,15,17,19];this.tone(hz(root+12+melody[Math.floor(k/2)]),.14,.055,'square',t,b)}}
}
const sound=new AudioRig();
const cfg={car:0,trans:'auto',difficulty:'arcade',mode:'race',course:'fwd'};
let state='menu',resumeState='race',cameraMode=0,worldTime=0,simTime=0,elapsed=0,clock=45,countdown=0,countLast=-1,nextCheckpoint=1,lapStart=0,lapTimes=[],raceRank=40,topSpeed=0,passes=0,prevRank=40,nearCrash=0,checkpointFlash=0,messageTime=0,messageText='',uiClock=0,finished=false;
let lastBrake=false,steerInput=0,particles=[],cameraPos=null,cameraTarget=null,frameId=0;const ctl={steer:0,gas:0,brake:0,slide:false};
let player={s:70,x:0,v:65,lat:0,yaw:0,drift:0,driftTimer:0,driftSide:0,draft:0,sling:0,gear:3,rpm:5500,throttle:0,brake:0,hit:0,wheel:0,wallTouch:false};let rivals=[];
function freshStats(){return{bumps:0,shoves:0,wallPuts:0,chains:0,feints:0,draftPasses:0,elitePasses:0,trafficPasses:0,lappedPasses:0,blocks:0,battles:0,battlesWon:0,openingPasses:0,damageHits:0,speedLost:0}}
let raceStats=freshStats(),contactPairs=new Map(),damageContactPairs=new Set(),contactClock=0,tacticUntil=0,tacticName='',lastContactSound=-10;
const trackDelta=d=>mod(d+L/2,L)-L/2;
const CONTACT_LENGTH=4.72,CONTACT_WIDTH=2.33,CONTACT_RELEASE_MARGIN=.22;
const contactCellCount=Math.max(3,Math.floor(L/8)),contactCellSize=L/contactCellCount;
const contactBuckets=Array.from({length:contactCellCount},()=>[]),contactCandidates=[];
const auditCounters={pairChecks:0,fullPairChecks:0};
function nearbyContactPairs(cars){
 for(const bucket of contactBuckets)bucket.length=0;
 for(let i=0;i<cars.length;i++)contactBuckets[Math.min(contactCellCount-1,Math.floor(mod(cars[i].s,L)/contactCellSize))].push(i);
 contactCandidates.length=0;
 for(let k=0;k<contactCellCount;k++){
  const a=contactBuckets[k],b=contactBuckets[(k+1)%contactCellCount];
  for(let i=0;i<a.length;i++){
   for(let j=i+1;j<a.length;j++)contactCandidates.push(Math.min(a[i],a[j])*FIELD_SIZE+Math.max(a[i],a[j]));
   for(const j of b)contactCandidates.push(Math.min(a[i],j)*FIELD_SIZE+Math.max(a[i],j));
  }
 }
 contactCandidates.sort((a,b)=>a-b);return contactCandidates;
}
function tactic(title,sub='',duration=2.2){tacticName=title;tacticUntil=worldTime+duration;$('tacticToast').replaceChildren(document.createTextNode(title));if(sub){let small=document.createElement('small');small.textContent=sub;$('tacticToast').append(small)}$('tacticToast').classList.add('show')}
const DAMAGE_EVENTS=[
 {part:'QUARTER PANEL',speed:3,voice:'damage_quarter'},
 {part:'FRONT SPLITTER',speed:2,voice:'damage_splitter'},
 {part:'RADIATOR',speed:5,smoke:.16,voice:'damage_radiator'},
 {part:'WINDSHIELD',visibility:.16,crack:.22,voice:'damage_glass'},
 {part:'STEERING LINKAGE',steer:.055,pull:.018,voice:'damage_steering'},
 {part:'RIGHT FRONT TIRE',grip:.065,speed:2,voice:'damage_tire'},
 {part:'BRAKE DUCT',brake:.075,voice:'damage_brakes'},
 {part:'SUSPENSION',steer:.04,grip:.035,pull:.014,voice:'damage_suspension'}
];
let damage=null,damageCallUntil=0;
function resetDamage(){damage={incidents:0,speedLoss:0,steer:0,grip:0,brake:0,visibility:0,crack:0,smoke:0,pull:0,history:[]};damageContactPairs.clear();damageCallUntil=0;updateDamageUI(true)}
function damageControlPct(){return clamp(Math.round(100-(damage.steer*.85+damage.grip*.95+Math.abs(damage.pull)*1.8)*100),55,100)}
function updateDamageUI(reset=false){if(!damage)return;const speed=Math.round(damage.speedLoss*3.6),control=damageControlPct(),severity=clamp((damage.speedLoss/11.2+damage.steer/.30+damage.grip/.28+damage.brake/.32+Math.max(damage.visibility/.70,damage.crack/.72)+damage.smoke/.68)/6,0,1);$('damageSpeed').textContent='-'+speed+' KM/H';$('damageControl').textContent=control+'%';$('damagePct').textContent=Math.round(severity*100)+'%';$('damageBar').style.width=(severity*100).toFixed(0)+'%';$('damageHUD').classList.toggle('hurt',damage.incidents>0);$('damageGlass').style.opacity=String(clamp(damage.crack,0,.72));$('damageSmoke').style.opacity=String(clamp(damage.smoke,0,.68));$('damageSmoke').classList.toggle('active',damage.smoke>0);if(reset){$('damageCall').classList.remove('show')}}
function damagePenaltyText(e){const bits=[];if(e.speed)bits.push('-'+e.speed+' KM/H TOP SPEED');if(e.steer)bits.push('STEERING -'+Math.round(e.steer*100)+'%');if(e.grip)bits.push('GRIP -'+Math.round(e.grip*100)+'%');if(e.brake)bits.push('BRAKING -'+Math.round(e.brake*100)+'%');if(e.visibility)bits.push('VISIBILITY -'+Math.round(e.visibility*100)+'%');if(e.smoke)bits.push('SMOKE +'+Math.round(e.smoke*100)+'%');return bits.join('  •  ')}
function pickDamageEvent(kind,strength){let pool=kind==='wall'?[0,2,3,4,5,7,1]:kind==='side'?[0,4,5,7,3,1]:[1,0,2,4,6,5,3,7];if(strength>1.05)pool=kind==='wall'?[2,4,5,3,7,0]:[2,4,5,7,3,0];const idx=pool[(damage.incidents+Math.floor(rand()*Math.min(3,pool.length)))%pool.length];return DAMAGE_EVENTS[idx]}
function applyPlayerDamage(kind='car',strength=.6,side=0){if(state!=='race'||!damage)return false;const e=pickDamageEvent(kind,strength),before=damage.speedLoss,oldDamage={...damage};damage.incidents++;damage.speedLoss=clamp(damage.speedLoss+(e.speed||0)/3.6,0,11.2);damage.steer=clamp(damage.steer+(e.steer||0),0,.30);damage.grip=clamp(damage.grip+(e.grip||0),0,.28);damage.brake=clamp(damage.brake+(e.brake||0),0,.32);damage.visibility=clamp(damage.visibility+(e.visibility||0),0,.70);damage.crack=clamp(damage.crack+(e.crack||0),0,.72);damage.smoke=clamp(damage.smoke+(e.smoke||0),0,.68);if(e.pull){const dir=side||((damage.incidents&1)?1:-1);damage.pull=clamp(damage.pull+dir*e.pull,-.075,.075)}const applied={};for(const key of ['steer','grip','brake','visibility','crack','smoke'])applied[key]=Math.max(0,damage[key]-oldDamage[key]);applied.speed=Math.round((damage.speedLoss-before)*360)/100;const penalty=damagePenaltyText(applied)||'DAMAGE LIMIT REACHED / NO FURTHER LOSS';const fullLoss=['steer','grip','brake','visibility','smoke','speed'].every(key=>!e[key]||Math.abs(applied[key]-e[key])<.001);damage.history.push({part:e.part,at:elapsed,penalty});if(damage.history.length>200)damage.history.shift();raceStats.damageHits++;raceStats.speedLost=Math.round(damage.speedLoss*3.6);$('damagePart').textContent=e.part;$('damagePenalty').textContent=penalty;$('damageCall').classList.add('show');damageCallUntil=worldTime+2.15;updateDamageUI();checkpointFlash=-.14;tactic('CAR DAMAGE',e.part+' • '+penalty,2.1);if(crew)crew.say(fullLoss?e.voice:'motivate',5,true);return damage.speedLoss>before||!!(e.steer||e.grip||e.brake||e.visibility)}

function setupRivals(menu=false){rivals=[];contactPairs.clear();damageContactPairs.clear();if(!menu&&cfg.mode==='trial')return;// time trial: an open track
 const shift=cfg.difficulty==='tour'?-7:0;
 for(let i=0;i<39;i++){let elite=i>=34,j=i-34,profile=elite?CHAMPIONS[j]:null,lane=elite?[-6,3.6,-2.8,6.4,0][j]:[-7.8,-3.9,0,3.9,7.8][(i*3+1)%5];let gap=elite?580+j*BATTLE_SPACING:18+i*13.4+i*i*.075;
 rivals.push({id:i,s:player.s+gap*(!elite&&cfg.difficulty==='pro'?.90:1),x:lane,lane,v:menu?65+i%5:40,base:(elite?profile.pace:48+i*.63)+shift,phase:i*.87,car:elite?8+j:3+i%5,elite,profile,lat:0,kick:0,spin:0,hit:0,stun:0,wallCD:0,ai:'LINE',target:lane,think:.1+(i%7)*.035,readTime:0,commit:0,recover:0,readX:lane,blockedX:lane,fooled:0,feintCredited:false,introduced:false,passed:false,passReady:true,taggedAt:-10,wallSource:-10,passCount:0,wasDelta:gap,wasS:player.s,mass:elite?profile.mass:1+(i%3)*.045,braking:false,awake:false,defeated:false,clearTime:0,opening:0,openingKind:'',moveAt:-100,moveKind:'',blockDir:0,commitAge:0,observedX:lane,observedLat:0,sampleClock:0,draftHeld:0,slingshotUsed:false,battleTime:0,planned:0,commitPlayerX:lane,commitTravel:0,lastDraftAt:-100,draftLane:lane,trafficHold:0,trafficLane:lane,trafficLock:0,openingTotal:0,combo:0,comboUntil:0,playerEdge:0,rivalEdge:0,edgeMoves:Object.create(null),edgeKind:'',edgeText:'',edgeAt:-100,speedLocked:false})
 }
}
function laneFree(car,x,look=18){for(let o of rivals){if(o===car)continue;let d=trackDelta(o.s-car.s);if(d>-6&&d<look&&Math.abs(o.x-x)<2.7)return false}let dp=trackDelta(player.s-car.s);return !(dp>-5&&dp<10&&Math.abs(player.x-x)<2.5)}
function chooseOpenLane(car){const choices=[car.x-3.8,car.x+3.8,car.lane];choices.sort((a,b)=>Math.abs(a-car.lane)-Math.abs(b-car.lane));return choices.find(x=>Math.abs(x)<10.0&&laneFree(car,x))}
function decideRival(c,dt){
 const behind=trackDelta(c.s-player.s),close=behind>-8&&behind<104;
 let desiredLane=c.lane+Math.sin(worldTime*.48+c.phase)*.40;
 c.commit=Math.max(0,c.commit-dt);c.recover=Math.max(0,c.recover-dt);c.fooled=Math.max(0,c.fooled-dt);c.opening=Math.max(0,c.opening-dt);c.trafficHold=Math.max(0,c.trafficHold-dt);c.trafficLock=Math.max(0,c.trafficLock-dt);c.think-=dt;
 if(c.elite&&!c.defeated&&c===nextChampion()&&close){
  const j=c.id-34,m=RIVAL_MOVES[j],hard=cfg.difficulty==='pro',easy=cfg.difficulty==='tour',response=hard?.85:easy?1.14:1;
  c.battleTime+=dt;c.sampleClock-=dt;
  // Only sample positions already reached. No steering keys or future input are read.
  if(c.sampleClock<=0){c.observedX=player.x;c.observedLat=player.lat;c.sampleClock=m.reaction*response}
  const inDraft=behind>5&&behind<43&&Math.abs(player.x-c.x)<1.9;
  if(inDraft&&player.draft>.73){c.draftHeld=Math.min(2.5,c.draftHeld+dt);c.lastDraftAt=worldTime;c.draftLane=c.x;if(c.draftHeld>=m.draftHold&&applyBattleEdge(c,'DRAFT')){tactic('DRAFT CHARGED','BATTLE SPEED +'+Math.round(c.playerEdge*3.6)+' KM/H');crew.say('draft_hold',2)}}
  else if(worldTime-c.lastDraftAt>.50)c.draftHeld=Math.max(0,c.draftHeld-dt*1.8);
  // A boost from another car, an early exit, or a mere lane tap does not break this guard.
  const launch=player.sling>0&&behind>1&&behind<m.launchGap&&c.draftHeld>=m.draftHold&&worldTime-c.lastDraftAt<.50&&Math.abs(player.x-c.draftLane)>2.15&&Math.abs(player.x-c.x)>2.05;
  if(launch&&!c.slingshotUsed){c.slingshotUsed=true;openRival(c,'SLINGSHOT',m.open*.91);c.recover=Math.max(c.recover,c.opening);c.commit=0;c.blockedX=c.x}
  if(player.sling<=0&&player.draft<.4)c.slingshotUsed=false;
  if(c.stun>.2){c.ai='UNSETTLED';desiredLane=c.x;c.commit=0;c.readTime=0}
  else if(c.opening>0||c.recover>0){
   c.ai=c.fooled>0?'WRONG LINE':c.openingKind==='SLINGSHOT'?'DRAFT EXPOSED':'RECOVER';desiredLane=c.blockedX;c.readTime=0;
  }else if(c.commit>0){
   c.commitAge+=dt;c.ai='BLOCK';desiredLane=c.blockedX;
   c.commitTravel=Math.max(c.commitTravel,(c.observedX-c.commitPlayerX)*c.blockDir);
   // First sell the move. Then reverse during the block, close to the rear bumper.
   const sold=c.commitTravel>=m.sell&&c.commitAge>.19&&behind>1&&behind<m.feintGap;
   const reversed=c.observedLat*c.blockDir<-m.reverse&&(c.blockedX-c.observedX)*c.blockDir>m.escape;
   if(!c.feintCredited&&sold&&reversed){
    c.feintCredited=true;openRival(c,'SWITCHBACK',m.open);c.fooled=c.opening;c.recover=c.opening;c.commit=0;
    raceStats.feints++;tactic('SOLD THE FAKE','SWITCH SIDES. TAKE THE GAP.');crew.say('fooled',3)
   }
  }else{
   c.ai='GUARD';
   const lead=m.lead*(hard?1.08:easy?.92:1);
   desiredLane=clamp(c.observedX+c.observedLat*lead,-10.65,10.65);
   const moving=Math.abs(c.observedLat)>3.0+j*.18&&Math.abs(c.observedX-c.readX)>.75+j*.09;
   c.readTime=moving?c.readTime+dt:Math.max(0,c.readTime-dt*2);
   if(!moving&&Math.abs(c.observedLat)<1.8)c.readX=damp(c.readX,c.observedX,3.0,dt);
   if(behind<67&&moving&&c.readTime>m.read*response){
    c.blockDir=Math.sign(c.observedLat);c.readX=c.observedX;c.commitPlayerX=c.observedX;c.commitTravel=0;
    c.blockedX=clamp(c.observedX+c.observedLat*(.25+j*.017)+c.blockDir*(1.65+j*.10),-10.65,10.65);
    c.target=c.blockedX;c.commit=m.hold*(hard?.94:easy?1.07:1);c.commitAge=0;c.readTime=0;c.feintCredited=false;c.ai='BLOCK';desiredLane=c.blockedX;raceStats.blocks++;
    if(behind<26){tactic('BLOCK COMMITTED','SELL THE MOVE. THEN SWITCH.',1.05);crew.say('block',2)}
   }
   const along=Math.abs(behind)<5.1&&Math.abs(player.x-c.x)<4.6;
   if(along&&j>=1){desiredLane=clamp(player.x-Math.sign(player.x-c.x||1)*2.15,-10.8,10.8);c.ai='LEAN'}
  }
 }else if(c.elite){c.ai=c.defeated?'BEATEN':'PACE';c.readTime=0}
 // Traffic is physical. Plan around it, but brake if a safe escape lane is not available.
 const fighting=c.elite&&!c.defeated&&c===nextChampion()&&close,eliteTraffic=c.elite&&!c.defeated;
 if(c.trafficLock>0&&c.commit<=0&&c.opening<=0){desiredLane=c.trafficLane;c.ai='TRAFFIC'}
 let obstacle=null,nearest=eliteTraffic?clamp(32+(c.v-50)*1.2,52,126):28;
 for(const o of rivals){if(o===c)continue;const d=trackDelta(o.s-c.s);if(d>0&&d<nearest&&Math.abs(o.x-c.x)<2.7){nearest=d;obstacle=o}}
 if(obstacle&&c.stun<.3){
  const catchSpeed=Math.max(0,c.v-obstacle.v),brakeDistance=eliteTraffic?clamp(12+catchSpeed*1.35,23,112):19;
  if(nearest<brakeDistance){
   const held=c.trafficLock>0&&laneFree(c,c.trafficLane,11),open=held?c.trafficLane:chooseOpenLane(c),canMove=c.commit<=0&&c.opening<=0;
   if(open!==undefined&&canMove){
    // Hold the selected lane. Re-selecting left/right each frame traps a car in traffic.
    if(!held){c.trafficLane=open;c.trafficLock=1.8}
    desiredLane=open;c.ai='TRAFFIC';c.trafficHold=.36
   }
   if(nearest<Math.max(8,(eliteTraffic?catchSpeed*catchSpeed/50+10:catchSpeed*.55+5))&&Math.abs(obstacle.x-c.x)<2.65){c.braking=true;c.trafficHold=.50}
  }
 }
 c.target=clamp(desiredLane,-10.8,10.8);return obstacle&&c.braking?obstacle:null
}

function updateRivals(dt,mode){
 const plans=mode==='race'?planRivalPace():new Map(),front=mode==='race'?nextChampion():null;
 for(let c of rivals){
  c.wasDelta=trackDelta(c.s-player.s);c.wasS=player.s;c.hit=Math.max(0,c.hit-dt);c.stun=Math.max(0,c.stun-dt);c.wallCD=Math.max(0,c.wallCD-dt);c.kick=damp(c.kick,0,2.2,dt);c.spin=damp(c.spin,0,2.6,dt);c.braking=false;
  if(mode==='countdown'){c.v=40;c.lat=0;c.s+=c.v*dt;continue}
  let oldx=c.x;
  if(mode==='race'){
   let obstacle=decideRival(c,dt),f=frame(c.s),corner=Math.min(17,Math.abs(f.cur)*1180);
   let desired=c.elite?plans.get(c.id):c.base-corner;
   if(c.elite&&c.defeated)desired=58+(c.id-34)*1.4-Math.min(5,Math.abs(f.cur)*400);
   // Keep the regular field behind the lead rivals, without removing its contact physics.
   if(!c.elite&&front&&c.s<front.s+5&&front.s-c.s<95)desired=Math.min(desired,Math.max(28,front.v+(front.s-c.s-29)*.65));
   if(c.opening>0)desired-=(OPENING_LOSS[c.openingKind]||0);if(c.elite&&c===battle.active&&c.rivalEdge>0)desired-=c.rivalEdge;
   if(c.stun>0)desired-=Math.min(21,c.stun*12);
   if(obstacle&&c.braking)desired=Math.min(desired,Math.max(15,obstacle.v-2));
   c.planned=desired;
   const bumperLock=c.elite&&c===battle.active&&c.speedLocked&&c.stun<=0&&!c.braking;const paceRate=c.elite?(c===battle.active?(bumperLock?34:11.5+(c.id-34)*1.45):25):4.5;
   c.v+=clamp(desired-c.v,-(c.stun>0?22:c.elite?27:7)*dt,paceRate*dt);
   const fighting=c.elite&&!c.defeated&&c===nextChampion()&&Math.abs(c.s-player.s)<100;
   const rate=fighting?RIVAL_MOVES[c.id-34].rate*(cfg.difficulty==='tour'?.93:cfg.difficulty==='pro'?1.07:1):c.elite?9.5:3.7;
   const steer=clamp((c.target-c.x)*(fighting?4.6+(c.id-34)*.23:1.7),-rate,rate)*(c.stun>.5?.24:1);
   c.lat=damp(c.lat,steer,fighting?10.5+(c.id-34)*.5:4.3,dt);c.x+=(c.lat+c.kick)*dt;
  }else{c.v=damp(c.v,64+c.id%6,1,dt);c.x=damp(c.x,c.lane+Math.sin(worldTime*.5+c.phase)*.4,2,dt);c.lat=(c.x-oldx)/dt}
  if(Math.abs(c.x)>11.9){
   const side=Math.sign(c.x);c.x=side*11.9;
   if(mode==='race'&&c.wallCD<=0){
    const lateral=Math.abs(c.lat+c.kick),loss=clamp(lateral*1.3+6,7,22);
    c.v=Math.max(15,c.v-loss);c.stun=1.35;c.spin=-side*.42;c.kick=-side*3.8;c.lat=-side*1.7;c.wallCD=.8;
    if(worldTime-c.wallSource<3){raceStats.wallPuts++;openRival(c,'WALL PRESSURE',2.6);tactic('INTO THE WALL','RIVAL SLOWED');crew.say('wall_put',3)}
    contactFX(c.s,c.x,.9,false);c.wallSource=-10
   }
  }
  c.v=clamp(c.v,8,128);c.s+=c.v*dt;
 }
}

function contactFX(s,x,strength,withPlayer){const near=Math.abs(trackDelta(s-player.s))<45;if(!near)return;for(let i=0;i<Math.min(12,4+Math.floor(strength*5));i++)particles.push({p:roadPos(s,x,.65),v:[(rand()-.5)*7,1+rand()*3,(rand()-.5)*8],life:.22+rand()*.18,max:.4,size:.27+rand()*.13,spark:true});if(withPlayer){nearCrash=Math.max(nearCrash,.25+strength*.35);checkpointFlash=-.07;kit.input.rumble(Math.min(.8,.3+strength*.3),90)}if(worldTime-lastContactSound>.17){sound.cue('hit');lastContactSound=worldTime}}
function impulseX(c,j){if(c===player)c.lat+=j;else{c.kick+=j;c.spin=clamp(c.spin+j*.034,-.65,.65)}}
function solveContacts(dt){const cars=[player,...rivals],currentDamageContacts=new Set(),damageAppliedThisStep=new Set();
 // Keep a contact latched through tiny solver separations. A clear separation allows a new hit.
 for(const b of rivals){const pair='P:'+b.id;if(damageContactPairs.has(pair)&&Math.abs(trackDelta(b.s-player.s))<CONTACT_LENGTH+CONTACT_RELEASE_MARGIN&&Math.abs(b.x-player.x)<CONTACT_WIDTH+CONTACT_RELEASE_MARGIN)currentDamageContacts.add(pair)}
 for(let iteration=0;iteration<2;iteration++){
 const candidates=nearbyContactPairs(cars);auditCounters.fullPairChecks+=cars.length*(cars.length-1)/2;
 for(const encoded of candidates){const i=Math.floor(encoded/FIELD_SIZE),j=encoded%FIELD_SIZE;auditCounters.pairChecks++;
 let a=cars[i],b=cars[j],ds=trackDelta(b.s-a.s),dx=b.x-a.x;if(Math.abs(ds)>=4.72||Math.abs(dx)>=2.33)continue;
 const am=a===player?1.16:a.mass,bm=b.mass||1.16,inv=1/am+1/bm,px=2.33-Math.abs(dx),pz=4.72-Math.abs(ds),side=px/2.33<pz/4.72,withPlayer=a===player||b===player,pair=(a===player?'P':a.id)+':'+b.id,last=contactPairs.get(pair)??-10,fresh=worldTime-last>.58;if(withPlayer)currentDamageContacts.add(pair);
 let strength=0,closing=0;
 if(side){let sign=Math.sign(dx)||1,al=a.lat+(a.kick||0),bl=b.lat+(b.kick||0);closing=(al-bl)*sign;const shove=Math.max(0,closing)*.66;let impulse=shove/inv;impulseX(a,-sign*impulse/am);impulseX(b,sign*impulse/bm);const push=Math.max(0,px-.01)*.65;a.x-=sign*push*(1/am)/inv;b.x+=sign*push*(1/bm)/inv;strength=Math.min(1.4,.25+Math.abs(closing)/9);
 if(fresh&&Math.abs(closing)>1.6){a.v=Math.max(8,a.v-.7);b.v=Math.max(8,b.v-1.1);if(withPlayer){raceStats.shoves++;if(Math.abs(closing)>(b.elite?3+(b.id-34)*.35:3))openRival(b,'SIDE PRESSURE',1.25);b.wallSource=worldTime;b.taggedAt=worldTime;tactic('DOOR TO DOOR','HOLD YOUR LINE');crew.say('side',2)}}
 }else{let sign=Math.sign(ds)||1;closing=(a.v-b.v)*sign;const impulse=Math.max(0,closing)*1.08/inv;a.v=Math.max(8,a.v-sign*impulse/am);b.v=Math.max(8,b.v+sign*impulse/bm);const push=Math.max(0,pz-.02)*.68;a.s-=sign*push*(1/am)/inv;b.s+=sign*push*(1/bm)/inv;strength=Math.min(1.65,.25+closing/14);
 let clipHit=false;if(closing>4&&Math.abs(dx)>.60){const spin=Math.sign(dx)*clamp(closing*.19,1,6);impulseX(b,spin);if(b!==player)b.stun=Math.max(b.stun,.55);if(withPlayer&&sign>0&&b.elite&&Math.abs(dx)>.78&&Math.abs(dx)<1.95&&closing>4.8){clipHit=true;b.spin=clamp(b.spin+Math.sign(dx)*.72,-1.05,1.05);b.kick+=Math.sign(dx)*2.3;b.stun=Math.max(b.stun,1.05)}}
 if(fresh&&closing>2.5){const front=sign>0?b:a;if(front!==player)front.stun=Math.max(front.stun,(.6+Math.min(.9,closing/18))*(front.elite?RIVAL_MOVES[front.id-34].contact:1));if(withPlayer&&sign>0){b.taggedAt=worldTime;b.wallSource=worldTime;raceStats.bumps++;const move=clipHit?'CLIP':'BUMP & RUN';if(!b.elite||closing>=RIVAL_MOVES[b.id-34].bump*(clipHit?.70:1))openRival(b,move,clipHit?2.35:2.0);tactic(clipHit?'CLIP / SPIN':'BUMP & RUN',clipHit?'HE IS UNSETTLED. GO NOW.':'KEEP YOUR CAR STRAIGHT');crew.say('bump',2)}else if(!withPlayer&&(worldTime-a.taggedAt<1.4||worldTime-b.taggedAt<1.4)){a.taggedAt=b.taggedAt=worldTime;a.wallSource=b.wallSource=worldTime;raceStats.chains++;openRival(a,'CHAIN HIT',2.2);openRival(b,'CHAIN HIT',2.2);tactic('CHAIN REACTION','TRAFFIC IS MOVING');crew.say('chain',3)}}
 }
 if(fresh){contactPairs.set(pair,worldTime);a.hit=Math.max(a.hit,.2);b.hit=Math.max(b.hit,.2);if(closing>1.5||side&&withPlayer)contactFX(a.s+ds*.5,(a.x+b.x)*.5,strength,withPlayer)}if(withPlayer&&!damageContactPairs.has(pair)&&!damageAppliedThisStep.has(pair)){damageAppliedThisStep.add(pair);applyPlayerDamage(side?'side':'car',Math.max(.35,strength),Math.sign(dx)||1)}
 }
 }
 // A side impact can put the player into the wall after the normal movement step.
 resolvePlayerWall();damageContactPairs=currentDamageContacts;contactClock+=dt;if(contactClock>5){contactClock=0;for(let [k,t] of contactPairs)if(worldTime-t>3)contactPairs.delete(k)}
}
function trackPasses(){for(let c of rivals){let d=trackDelta(c.s-player.s);if(c.wasDelta>0&&d<=0&&c.wasDelta<25&&player.v>c.v-4){raceStats.trafficPasses++;c.passCount++;c.passed=c.s<player.s;if(c.s<player.s-L*.6){raceStats.lappedPasses++}if(player.sling>0||player.draft>.5){raceStats.draftPasses++;tactic('DRAFT PASS','SPEED DOES THE WORK');crew.say('sling',2)}if(c.elite&&c.s<player.s){c.passReady=false}else if(raceStats.trafficPasses%8===0)crew.say('cleanpass',1)}c.passed=c.s<player.s}
}

// The next opponent remains at least one long straight away from the current battle.
let battle={active:null,introAge:99,scale:1,cooldown:0,won:0,wins:[],lastWin:null,winAge:99};
function nextChampion(){return rivals.find(c=>c.elite&&!c.defeated)||null}
function resetBattles(){battle={active:null,introAge:99,scale:1,cooldown:0,won:0,wins:[],lastWin:null,winAge:99};$('battleIntro').classList.remove('show');$('battleHUD').classList.remove('show');$('battleWin').classList.remove('show');document.body.classList.remove('duel-intro','duel-active')}
function planRivalPace(){
 const plans=new Map(),alive=rivals.filter(c=>c.elite&&!c.defeated);
 let previous=null,previousPace=52;
 for(const c of alive){
  const gap=c.s-player.s,m=RIVAL_MOVES[c.id-34];let desired;
  if(!previous){
   if(c===battle.active||gap<BATTLE_TRIGGER+3){
    const top=rivalTopSpeed(c),inline=Math.abs(player.x-c.x)<2.25,duelTop=battleCruiseSpeed();
    desired=top;
    // Close a distant approach. Once the player reaches the rear bumper, match normal top speed.
    if(c===battle.active&&gap>-7&&gap<=BATTLE_TOP_LOCK_GAP)c.speedLocked=true;
    if(c===battle.active&&c.speedLocked)desired=duelTop;
    else if(c===battle.active&&(c.playerEdge>0||c.rivalEdge>0)&&gap>-7&&gap<30)desired=duelTop;
    else if(gap>43)desired=Math.min(top,Math.max(58,player.v-clamp((gap-32)*.85,7,30)));
    else if(inline&&gap>m.guardGap+1&&c.opening<=0&&c.stun<=0){
     // Cover the bumper while the player builds a draft. Leave no free lane beside it.
     desired=Math.min(top,Math.max(53,player.v-clamp((gap-m.guardGap)*.82,0,22)));
    }
   }else desired=battle.won>0?43:52;
  }else{
   const spacing=c.s-previous.s;
   desired=clamp(previousPace+(BATTLE_SPACING-spacing)*1.05,32,128);
  }
  plans.set(c.id,desired);previous=c;previousPace=desired;
 }
 return plans
}
function openRival(c,kind,seconds){
 if(!c||!c.elite||c.defeated)return;
 const m=RIVAL_MOVES[c.id-34],contact=kind!=='SWITCHBACK'&&kind!=='SLINGSHOT'&&kind!=='DRAFT';
 let duration=seconds*(contact?m.contact:1)*(cfg.difficulty==='pro'?.95:cfg.difficulty==='tour'?1.06:1);
 const combo=c.opening>0&&kind!==c.openingKind&&worldTime-c.moveAt<1.65;
 if(combo){duration+=.36;c.comboUntil=worldTime+duration;c.combo=Math.min(3,c.combo+1)}
 c.opening=Math.max(c.opening,duration);c.openingTotal=c.opening;c.openingKind=kind;c.moveKind=combo?'COMBO / '+kind:kind;c.moveAt=worldTime;applyBattleEdge(c,kind);
}

function beginBattle(c){
 battle.active=c;battle.introAge=0;c.introduced=true;c.observedX=player.x;c.observedLat=player.lat;c.readX=player.x;c.clearTime=0;c.blockedX=c.x;c.draftHeld=0;c.lastDraftAt=-100;c.commitTravel=0;c.playerEdge=0;c.rivalEdge=0;c.edgeMoves=Object.create(null);c.edgeKind='';c.edgeText='';c.edgeAt=-100;c.speedLocked=false;
 raceStats.battles++;const d=c.profile,m=RIVAL_MOVES[c.id-34];
 $('battleIntro').style.setProperty('--duel',d.color);$('battleHUD').style.setProperty('--duel',d.color);
 $('battleNumber').textContent=d.number;$('battleName').textContent=d.tag;$('battleDriver').textContent=d.name;
 $('battleIndex').textContent='DEFENSE '+String(c.id-33).padStart(2,'0')+' / 05';$('battleMove').textContent=m.hint;
 $('battleHUDName').textContent=d.tag+' / #'+d.number;$('battleHUDIndex').textContent='DEFENSE '+(c.id-33)+' / 5';
 if(sound.ctx&&!sound.muted){const t=sound.ctx.currentTime;sound.noiseHit(t,.28,.34,'lowpass',1300);[110,164.8,220].forEach((f,i)=>sound.tone(f,.36,.12,'sawtooth',t+i*.09));sound.tone(880,.15,.10,'square',t+.4)}
 crew.seen.add(c.id);crew.say(d.voice,4,true);
}
function winBattle(c){
 if(c.defeated)return;c.defeated=true;c.ai='BEATEN';c.commit=c.recover=c.opening=0;c.speedLocked=false;
 const kind=c.edgeKind||(worldTime-c.moveAt<6?c.moveKind:player.sling>0?'SLINGSHOT':player.v-c.v>3?'SPEED PASS':'CLEAN PASS');
 battle.won++;battle.wins.push({driver:c.profile.tag,move:kind,time:elapsed});battle.active=null;battle.cooldown=2.0;battle.lastWin=c;battle.winAge=0;
 raceStats.battlesWon++;raceStats.elitePasses++;if(kind!=='CLEAN PASS'&&kind!=='SPEED PASS')raceStats.openingPasses++;
 $('battleWin').style.setProperty('--duel',c.profile.color);$('battleWinName').textContent=c.profile.tag+' / BEATEN';$('battleWinMove').textContent=kind+'  /  '+battle.won+' OF 5';
 sound.cue('checkpoint');crew.say(c.profile.voice+'_pass',4,true);tactic('RIVAL BEATEN',kind,2.6);
}
function updateBattles(dt){
 battle.cooldown=Math.max(0,battle.cooldown-dt);
 if(battle.active){
  const c=battle.active,gap=c.s-player.s;
  if(gap<-7.5)c.clearTime+=dt;else c.clearTime=0;
  if(c.clearTime>.38){winBattle(c)}
 }else if(battle.cooldown<=0){
  const c=nextChampion();if(c&&c.s-player.s<=BATTLE_TRIGGER&&c.s-player.s>-7)beginBattle(c);
 }
}
function advanceBattleFX(realDt){
 if(state!=='race'){battle.scale=1;return}
 battle.introAge+=realDt;battle.winAge+=realDt;
 const t=battle.introAge;
 battle.scale=t>=BATTLE_INTRO?1:t<.16?lerp(1,.26,smooth(t/.16)):t<1.03?.26:lerp(.26,1,smooth((t-1.03)/(BATTLE_INTRO-1.03)));
}
function updateBattleUI(){
 const racing=state==='race',intro=racing&&!!battle.active&&battle.introAge<BATTLE_INTRO;
 document.body.classList.toggle('duel-intro',intro);document.body.classList.toggle('duel-active',racing&&!!battle.active);$('battleIntro').classList.toggle('show',intro);
 if(intro){const t=battle.introAge,fade=smooth(t/.12)*(1-smooth((t-1.35)/.40));$('battleIntro').style.opacity=fade;$('battleIntro').style.setProperty('--entry',(1-smooth(t/.26))*50+'px')}
 const c=battle.active;$('battleHUD').classList.toggle('show',racing&&!!c&&!intro);
 if(c){
  const gap=c.s-player.s,open=c.opening>0||c.fooled>0;
  const edge=(c.playerEdge||0)>0||(c.rivalEdge||0)>0;let line=gap<-2?'GET CLEAR. HOLD YOUR LINE.':open?(c.comboUntil>worldTime?'COMBO OPENING / ':'OPEN LANE / ')+(c.opening||c.fooled).toFixed(1)+' S':edge?'BATTLE EDGE / '+c.edgeText:c.braking||c.ai==='TRAFFIC'?'TRAFFIC AHEAD / FIND THE GAP':c.ai==='BLOCK'?'BLOCK COMMITTED / SELL THE FAKE':c.draftHeld>=RIVAL_MOVES[c.id-34].draftHold?(gap<RIVAL_MOVES[c.id-34].launchGap?'DRAFT READY / PULL OUT AND PASS':'DRAFT READY / GET CLOSER'):gap>38?'CLOSE IN. BUILD YOUR DRAFT.':c.speedLocked?'TOP SPEED LOCK / FORCE AN OPENING':c.id===38?'LEADER GUARD / SPEED IS NOT ENOUGH':'GUARD UP / MAKE YOUR MOVE';
  $('battleHUDState').textContent=line;$('battleHUDHint').textContent=edge&&!open?c.edgeKind+' ACTIVE UNTIL YOU CLEAR HIM.':open?(c.openingKind==='SLINGSHOT'?'PULL OUT. KEEP THE GAS DOWN.':'TAKE THE GAP NOW.'):RIVAL_MOVES[c.id-34].hint;
  $('battleHUD').classList.toggle('open',open);$('battleMeter').style.width=(open?clamp(c.opening/Math.max(.01,c.openingTotal),0,1)*100:100)+'%';
 }
 $('battleWin').classList.toggle('show',racing&&battle.winAge<2.4);
}
setupRivals(true);

// Pit-crew and announcer lines. The recordings live in ./audio/<id>.mp3 and decode on first use.
// System voice is optional. The recorded radio voice remains the default.
const CREW_BANK={
 "intro":{"text":"Start your engines!","duration":2.85,"announcer":true,"gain":0.45},
 "draft":{"text":"You're drafting.","duration":1.045,"gain":1.55},
 "draft_hold":{"text":"Now step out. Slingshot past him.","duration":2.586,"gain":1.55},
 "sling":{"text":"Go.","duration":0.653,"gain":1.55},
 "feint":{"text":"Fake one side. Switch.","duration":2.011,"gain":1.55},
 "fooled":{"text":"He bit. Switch sides.","duration":1.959,"gain":1.55},
 "block":{"text":"He is trying to block.","duration":1.541,"gain":1.55},
 "traffic":{"text":"Traffic ahead.","duration":1.28,"gain":1.55},
 "bump":{"text":"That moved him.","duration":1.254,"gain":1.55},
 "chain":{"text":"Combo.","duration":0.914,"gain":1.55},
 "side":{"text":"Hold your ground.","duration":1.28,"gain":1.55},
 "wall_put":{"text":"He is in the wall. Go.","duration":1.75,"gain":1.55},
 "left":{"text":"Car left.","duration":1.019,"gain":1.55},
 "right":{"text":"Car right.","duration":0.967,"gain":1.55},
 "clear":{"text":"Clear.","duration":0.836,"gain":1.55},
 "frontfive":{"text":"Five rivals ahead.","duration":1.411,"gain":1.55},
 "vega":{"text":"Vega. Blocks your first move.","duration":2.194,"gain":1.55},
 "kane":{"text":"Kane. Strong side block.","duration":2.09,"gain":1.55},
 "cross":{"text":"Cross. Fast on the straight.","duration":2.064,"gain":1.55},
 "maddox":{"text":"Maddox. Heavy car.","duration":1.855,"gain":1.55},
 "calder":{"text":"Calder. Strong blocker.","duration":2.011,"gain":1.55},
 "vega_pass":{"text":"Vega cleared.","duration":1.123,"gain":1.55},
 "kane_pass":{"text":"Kane cleared.","duration":1.176,"gain":1.55},
 "cross_pass":{"text":"Cross cleared.","duration":1.176,"gain":1.55},
 "maddox_pass":{"text":"Maddox cleared.","duration":1.28,"gain":1.55},
 "calder_pass":{"text":"Calder cleared.","duration":1.28,"gain":1.55},
 "ten":{"text":"Top ten.","duration":1.123,"gain":1.55},
 "lap2":{"text":"Lap two.","duration":0.94,"gain":1.55},
 "final":{"text":"This is the final lap!","duration":3.545,"announcer":true,"gain":0.45},
 "checkpoint":{"text":"Time added.","duration":1.045,"gain":1.55},
 "clock":{"text":"Ten seconds.","duration":1.254,"gain":1.55},
 "win":{"text":"A new winner!","duration":1.289,"announcer":true,"gain":0.45},
 "finish":{"text":"Race over.","duration":0.967,"gain":1.55},
 "timeout":{"text":"Time's up.","duration":1.071,"gain":1.55},
 "corner":{"text":"Brake. Turn. Power.","duration":2.142,"gain":1.55},
 "road":{"text":"Use the full track.","duration":1.306,"gain":1.55},
 "lead":{"text":"You're leading.","duration":0.94,"gain":1.55},
 "motivate":{"text":"Avoid contact.","duration":1.358,"gain":1.55},
 "mirror":{"text":"Hold your line.","duration":1.228,"gain":1.55},
 "lapped":{"text":"Lapped traffic ahead.","duration":1.593,"gain":1.55},
 "cleanpass":{"text":"Pass complete.","duration":1.228,"gain":1.55},
 "preview":{"text":"Radio check. Mack.","duration":1.672,"gain":1.55},
 "damage_quarter":{"text":"Quarter panel. Minus three.","duration":2.038,"gain":1.55},
 "damage_splitter":{"text":"Front splitter. Minus two.","duration":2.038,"gain":1.55},
 "damage_radiator":{"text":"Radiator. Minus five. Smoke.","duration":2.664,"gain":1.55},
 "damage_glass":{"text":"Windshield cracked. Visibility reduced.","duration":2.717,"gain":1.55},
 "damage_steering":{"text":"Steering damaged. Control reduced.","duration":2.612,"gain":1.55},
 "damage_tire":{"text":"Right front damaged. Less grip. Minus two.","duration":3.37,"gain":1.55},
 "damage_brakes":{"text":"Brakes damaged. Longer stopping.","duration":2.351,"gain":1.55},
 "damage_suspension":{"text":"Suspension damaged. Less grip.","duration":2.377,"gain":1.55}
};

class PitRadio{
 constructor(){this.mode='radio';this.cache=new Map();this.serial=0;this.source=null;this.gain=null;this.utterance=null;this.last=new Map();this.time=0;this.until=0;this.next=0;this.priority=0;this.active=false;this.lastAmbient=0;this.lastSide=0;this.seen=new Set();this.history=[];this.queue=[];this.queueSerial=0;this.backend='text';this.current=null;this.suspended=null;this.systemVoice=null}
 reset(){this.stop();this.suspended=null;this.last.clear();this.time=this.until=this.next=0;this.lastAmbient=0;this.lastSide=0;this.seen.clear();this.history=[];this.queueSerial=0}
 stopAudio(){
  this.serial++;
  if(this.source){const src=this.source;this.source=null;src.onended=null;try{src.stop();src.disconnect()}catch(e){}}
  if(this.gain){try{this.gain.disconnect()}catch(e){}this.gain=null}
  if(this.utterance){this.utterance.onend=this.utterance.onerror=null;this.utterance=null;if(window.speechSynthesis)try{speechSynthesis.cancel()}catch(e){}}
  if(sound.ctx)sound.radioUntil=0;
 }
 stop(clearQueue=true){this.stopAudio();this.active=false;this.current=null;this.backend='text';this.next=this.time;if(clearQueue)this.queue=[];$('crewRadio').classList.remove('show')}
 silence(){if(!this.active)return;this.stopAudio();this.backend='text';$('crewStatus').textContent='TEXT ONLY'}
 suspend(){
  const current=this.active&&this.current?{...this.current,remaining:Math.max(.15,this.until-this.time)}:null;
  if(current&&this.backend==='buffer'&&sound.ctx)current.offset=Math.max(0,(this.playOffset||0)+Math.max(0,sound.ctx.currentTime-this.playStarted));
  this.suspended={current,queue:this.queue.map(q=>({...q,remaining:Math.max(.1,q.expires-this.time)})),gap:Math.max(0,this.next-this.time)};
  this.stop();
 }
 resume(){
  const saved=this.suspended;if(!saved)return;this.stop();this.suspended=null;
  this.queue=saved.queue.map(q=>({...q,expires:this.time+q.remaining}));
  if(saved.current){this.startLine(saved.current.id,saved.current.priority,{offset:saved.current.offset||0,record:false});if(this.backend==='text')this.until=this.time+saved.current.remaining}
  else this.next=this.time+Math.min(saved.gap,.35);
 }
 async decode(id){
  if(this.cache.has(id))return this.cache.get(id);if(!sound.ctx||!CREW_BANK[id])return null;
  const ctx=sound.ctx,promise=fetch(new URL('./audio/'+id+'.mp3',import.meta.url)).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}).then(buf=>ctx.decodeAudioData(buf)).catch(()=>{this.cache.delete(id);return null});
  this.cache.set(id,promise);return promise;
 }
 prepare(){for(const id of ['intro','final','win','draft','checkpoint','vega','damage_quarter','damage_radiator'])this.decode(id)}
 queueLife(priority){return priority>=6?60:priority>=5?14:priority>=4?12:priority>=3?6:priority>=2?3.6:1.7}
 relevant(id){
  if(state==='paused')return id==='preview';
  if(state==='results')return ['win','finish','timeout'].includes(id)||id.startsWith('damage_');
  if(id==='intro')return state==='countdown';
  if(id==='final')return state==='race'&&lapTimes.length===2;
  if(id==='left'||id==='right'){const side=id==='left'?-1:1;return rivals.some(c=>Math.abs(trackDelta(c.s-player.s))<7&&Math.abs(c.x-player.x)<5.4&&Math.sign(c.x-player.x)===side)}
  if(id==='draft')return player.draft>.2;
  if(id==='draft_hold')return player.draft>.73;
  if(id==='block'||id==='feint')return !!battle.active&&battle.active.ai==='BLOCK';
  if(CHAMPIONS.some(c=>c.voice===id))return battle.active?.profile.voice===id;
  return true;
 }
 say(id,priority=1,force=false){
  if(!CREW_BANK[id])return false;const now=this.time;
  if(!force&&priority<5&&(this.last.get(id)??-100)>now-19)return false;
  if(this.active||now<this.next){
   if(priority<=1)return false;const expires=now+this.queueLife(priority),existing=this.queue.find(q=>q.id===id);
   if(existing){existing.priority=Math.max(existing.priority,priority);existing.expires=Math.max(existing.expires,expires);return true}
   this.queue.push({id,priority,expires,seq:this.queueSerial++});this.queue.sort((a,b)=>b.priority-a.priority||a.seq-b.seq);if(this.queue.length>24)this.queue.length=24;return true;
  }
  return this.startLine(id,priority);
 }
 startLine(id,priority,options={}){
  const clip=CREW_BANK[id];if(!clip||this.active)return false;
  const offset=clamp(options.offset||0,0,Math.max(0,clip.duration-.02));
  this.priority=priority;this.until=this.time+clip.duration-offset+.25;this.next=this.until;this.last.set(id,this.time);this.lastAmbient=this.time;this.active=true;this.current={id,priority,offset};this.backend='text';
  if(options.record!==false){this.history.push({id,time:elapsed});if(this.history.length>160)this.history.shift()}
  $('crewCaption').textContent=clip.text;$('crewSpeaker').textContent=clip.announcer?'ANNOUNCER':'MACK / PIT CHIEF';$('crewStatus').textContent=this.mode==='off'||sound.muted||sound.volume===0?'TEXT ONLY':clip.announcer?'RACE CALL':'RADIO / 04';$('crewRadio').classList.add('show');
  const token=++this.serial;
  if(this.mode!=='off'&&!sound.muted&&sound.volume>0&&sound.ctx){this.backend='pending';this.pendingUntil=this.time+8;sound.radioUntil=sound.ctx.currentTime+clip.duration+.5;this.play(id,token,offset)}
  return true;
 }
 complete(token){
  if(token!==this.serial||!this.active)return;
  this.stopAudio();this.active=false;this.current=null;this.backend='text';this.next=this.time+(this.queue.length?.16:this.priority>=4?.35:1.0);$('crewRadio').classList.remove('show');
 }
 async play(id,token,offset=0){
  if(!sound.ctx)return;const c=sound.ctx,clip=CREW_BANK[id];
  if(!clip.announcer&&this.mode==='system'&&window.speechSynthesis){
   const voices=speechSynthesis.getVoices().filter(v=>v.localService&&/^en/i.test(v.lang));
   this.systemVoice=this.systemVoice||voices.find(v=>/david|daniel|alex|mark|george/i.test(v.name))||voices[0];
   if(this.systemVoice){try{const u=new SpeechSynthesisUtterance(clip.text);u.voice=this.systemVoice;u.rate=1.02;u.pitch=.8;u.volume=sound.volume;this.utterance=u;this.backend='system';this.pendingUntil=this.time+Math.max(15,clip.duration*4);u.onend=u.onerror=()=>this.complete(token);speechSynthesis.speak(u);return}catch(e){this.utterance=null}}
  }
  const buffer=await this.decode(id);
  if(token!==this.serial||!this.active)return;
  if(!buffer||sound.muted||this.mode==='off'||sound.volume===0){this.backend='text';this.until=this.time+Math.max(.3,clip.duration-offset);return}
  try{
   const src=c.createBufferSource(),g=c.createGain();src.buffer=buffer;g.gain.value=clip.gain??1.55;src.connect(g);g.connect(sound.master);this.source=src;this.gain=g;this.backend='buffer';
   offset=clamp(offset,0,Math.max(0,buffer.duration-.02));this.playOffset=offset;this.playStarted=c.currentTime+(clip.announcer||offset>0?0:.065);this.audioEnd=this.playStarted+buffer.duration-offset;this.until=this.time+buffer.duration-offset+.25;sound.radioUntil=this.audioEnd+.18;
   if(!clip.announcer&&offset===0){sound.tone(1240,.045,.07,'sine',c.currentTime);sound.noiseHit(c.currentTime,.065,.09,'bandpass',2500)}
   src.onended=()=>{if(token!==this.serial)return;if(!clip.announcer&&!sound.muted)sound.tone(1060,.038,.045,'sine');this.complete(token)};
   src.start(this.playStarted,offset);
  }catch(e){this.stopAudio();this.backend='text';this.until=this.time+Math.max(.3,clip.duration-offset)}
 }
 pumpQueue(){
  if(this.active||this.time<this.next||!this.queue.length)return;
  this.queue=this.queue.filter(q=>q.expires>this.time&&this.relevant(q.id));if(!this.queue.length)return;
  this.queue.sort((a,b)=>b.priority-a.priority||a.seq-b.seq);const q=this.queue.shift();this.startLine(q.id,q.priority);
 }
 tick(dt,paused=false){
  this.time+=Math.max(0,dt);
  if(this.active){
   if(this.backend==='text'&&this.time>=this.until)this.complete(this.serial);
   else if(this.backend==='pending'&&this.time>this.pendingUntil){this.stopAudio();this.backend='text';this.until=this.time+1}
   else if(this.backend==='buffer'&&sound.ctx&&sound.ctx.currentTime>this.audioEnd+.5)this.complete(this.serial);
   else if(this.backend==='system'&&this.time>this.pendingUntil&&!speechSynthesis.speaking)this.complete(this.serial);
  }
  this.pumpQueue();if(paused||state!=='race')return;
  let nearest=null,dist=Infinity;
  for(const c of rivals){const dx=Math.abs(c.x-player.x);if(Math.abs(trackDelta(c.s-player.s))<7&&dx<5.4&&dx<dist){nearest=c;dist=dx}}
  const side=nearest?Math.sign(nearest.x-player.x):0;
  // Keep the previous side until its change can be reported. Do not lose the cue while busy.
  if(!this.active&&this.time>=this.next){if(side&&side!==this.lastSide)this.say(side<0?'left':'right',2);else if(!side&&this.lastSide)this.say('clear',2);this.lastSide=side}
  if(this.active||this.queue.length||this.time<this.next||this.time-this.lastAmbient<9)return;
  // Time trial: an empty track, so only driving tips (no traffic, draft or position calls).
  if(cfg.mode==='trial'){if(Math.abs(frame(player.s+42).cur)>.012&&player.v>70)this.say('corner',1);else this.say(['road','mirror','motivate'][Math.floor(elapsed/13)%3],1);return}
  if(player.draft>.78)this.say('draft_hold',1);else if(player.draft>.25)this.say('draft',1);else if(raceRank===1)this.say('lead',1);else if(battle.active?.ai==='BLOCK')this.say('feint',2);else if(rivals.some(c=>c.s<player.s-L*.6&&trackDelta(c.s-player.s)>0&&trackDelta(c.s-player.s)<95))this.say('lapped',2);else if(Math.abs(frame(player.s+42).cur)>.012&&player.v>70)this.say('corner',1);else this.say(['motivate','mirror','road','traffic'][Math.floor(elapsed/13)%4],1);
 }
}
const crew=new PitRadio();

const rpmBars=[];for(let i=0;i<30;i++){let n=document.createElement('i');if(i>=24)n.classList.add('red');$('rpm').appendChild(n);rpmBars.push(n)}
const cinemaTicks=[...document.querySelectorAll('.cinema-ticks i')];
function storageGet(key){try{let v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:null}catch(e){return null}}
function storagePut(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
// Saved between visits: the last setup, sound settings and camera. Records and ghosts have their own keys.
const PREFS_KEY='ddusa.prefs.v1';
function savePrefs(){storagePut(PREFS_KEY,{car:cfg.car,trans:cfg.trans,difficulty:cfg.difficulty,mode:cfg.mode,course:cfg.course,camera:cameraMode,music:sound.music,volume:sound.volume,muted:sound.muted})}
// Forward Grand Prix records keep the original key, so existing personal bests carry over.
const recordKey=()=>cfg.mode==='trial'?`ddusa.sunshore.v12.trial.${cfg.course}.${cfg.difficulty}.${cfg.car}.${cfg.trans}`:cfg.course==='rev'?`ddusa.sunshore.v12.rev.${cfg.difficulty}.${cfg.car}.${cfg.trans}`:`ddusa.sunshore.v12.${cfg.difficulty}.${cfg.car}.${cfg.trans}`;
const ghostKey=()=>`ddusa.ghost.v1.${cfg.course}.${cfg.difficulty}.${cfg.car}.${cfg.trans}`;
function readRecord(){let r=storageGet(recordKey());if(r&&Number.isFinite(r.time)&&r.time>0){let text='PERSONAL BEST / '+formatTime(r.time);if(Number.isFinite(r.lap)&&r.lap>0)text+='  ·  BEST LAP '+formatTime(r.lap);$('menuRecord').textContent=text;$('menuRecord').classList.remove('hidden')}else $('menuRecord').classList.add('hidden')}
function formatTime(t){if(!Number.isFinite(t)||t<0)return '—:——.———';let m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*1000)%1000;return `${m}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`}
function message(title,subtitle='',seconds=2){messageText=title;$('message').replaceChildren();$('message').append(document.createTextNode(title));if(subtitle){let small=document.createElement('small');small.textContent=subtitle;$('message').append(small)}$('message').classList.add('show');messageTime=seconds}
function hideMessage(){messageTime=0;$('message').classList.remove('show')}
function clearInput(){ctl.steer=ctl.gas=ctl.brake=0;ctl.slide=false;steerInput=0;lastBrake=false;kit.input.settle()}
function showScreen(id,on){$(id).classList.toggle('hidden',!on)}
function courseLabel(){return cfg.course==='rev'?'SUNSHORE PARK REVERSE':'SUNSHORE PARK'}
function updateCourseUI(){
 const rev=cfg.course==='rev',trial=cfg.mode==='trial';
 $('trackName').innerHTML='SUNSHORE PARK'+(rev?'<small>REVERSE</small>':'');
 $('trackMinor').textContent=(rev?'02':'01')+' / THE AMUSEMENT COAST'+(trial?' / TIME TRIAL':'');
 $('trackPills').innerHTML=(L/1000).toFixed(2)+' KM &nbsp; / &nbsp; 3 LAPS &nbsp; / &nbsp; '+(trial?'GHOST RUN':'40 DRIVERS');
 const short=rev?'SUNSHORE REVERSE':'SUNSHORE PARK';$('hudTrack').textContent=short;$('mapName').textContent=short;
 $('cinemaTrack').textContent=courseLabel();$('cinemaField').textContent=trial?'TIME TRIAL / BEAT YOUR GHOST':'39 RIVALS AHEAD';
 const live=document.querySelector('.live-label');if(live)live.textContent=courseLabel()+' · LIVE';
}
// Switch the running direction. The title's attract race restarts on the new course.
function applyCourse(v){cfg.course=v==='rev'?'rev':'fwd';setTrackDir(cfg.course==='rev'?-1:1);courseFwdObj.visible=cfg.course!=='rev';courseRevObj.visible=cfg.course==='rev';clearSkids();if(state==='menu'){player.s=75;player.x=-1;setupRivals(true);cameraPos=null;cameraTarget=null}}

// ---- Time trial ghost ----------------------------------------------------------------------
// Samples of the best lap (lap time, lap distance, lane, yaw) at 20 Hz, saved per course, class, car
// and gearbox. The ghost replays it; the centre readout compares lap time at the same distance.
const GHOST_STEP=1/20,ghostOut={s:0,x:0,yaw:0};
let ghostBest=null,ghostRec=[],ghostNext=0,ghostCursor=0,ghostSaved=false;
function ghostLoad(){const g=storageGet(ghostKey());if(g&&Number.isFinite(g.lap)&&g.lap>0&&Array.isArray(g.d)&&g.d.length>=8&&g.d.length%4===0&&g.d.every(Number.isFinite))return{lap:g.lap,d:g.d};return null}
function ghostStartLap(){ghostRec=[];ghostNext=0;ghostCursor=0}
function ghostStartRace(){ghostBest=cfg.mode==='trial'?ghostLoad():null;ghostSaved=false;ghostStartLap()}
function ghostSample(t,s){ghostRec.push(Math.round(t*1000)/1000,Math.round(s*100)/100,Math.round(player.x*100)/100,Math.round(player.yaw*1000)/1000)}
function ghostRecord(){const t=elapsed-lapStart;if(t+1e-9<ghostNext)return;ghostSample(t,player.s-lapTimes.length*L);ghostNext=t+GHOST_STEP}
function ghostFinishLap(lapTime){const n=ghostRec.length;if(n>=4&&ghostRec[n-3]>=L){ghostRec[n-4]=Math.round(lapTime*1000)/1000;ghostRec[n-3]=L}else ghostSample(lapTime,L);const better=ghostRec.length>=8&&(!ghostBest||lapTime<ghostBest.lap);if(better){ghostBest={lap:lapTime,d:ghostRec};storagePut(ghostKey(),{v:1,lap:lapTime,d:ghostRec});ghostSaved=true}ghostStartLap();return better}
// Ghost lap time at a lap distance (distance only grows, so a binary search works).
function ghostTimeAt(sLap){const d=ghostBest.d,n=d.length>>2;if(sLap<=d[1])return d[0];if(sLap>=d[(n-1)*4+1])return d[(n-1)*4];let lo=0,hi=n-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(d[mid*4+1]<sLap)lo=mid;else hi=mid}const s0=d[lo*4+1],s1=d[hi*4+1],k=s1>s0?(sLap-s0)/(s1-s0):0;return d[lo*4]+(d[hi*4]-d[lo*4])*k}
function ghostPoseAt(t){const d=ghostBest.d,n=d.length>>2;if(t>d[(n-1)*4])return null;if(ghostCursor>n-2||d[ghostCursor*4]>t)ghostCursor=0;while(ghostCursor<n-2&&d[(ghostCursor+1)*4]<=t)ghostCursor++;const i=ghostCursor*4,j=i+4,t0=d[i],t1=d[j],k=t1>t0?clamp((t-t0)/(t1-t0),0,1):0;ghostOut.s=lerp(d[i+1],d[j+1],k);ghostOut.x=lerp(d[i+2],d[j+2],k);ghostOut.yaw=lerp(d[i+3],d[j+3],k);return ghostOut}
function ghostDeltaNow(){return ghostBest&&state==='race'?(elapsed-lapStart)-ghostTimeAt(player.s-lapTimes.length*L):null}
const signed=(d,digits=2)=>(d<0?'-':'+')+Math.abs(d).toFixed(digits);

function startRace(){
 sound.start();clearInput();Nav.reset();state='countdown';finished=false;resumeState='countdown';countdown=ROLL_DURATION;countLast=-1;elapsed=0;
 const trial=cfg.mode==='trial';
 clock=trial?0:cfg.difficulty==='tour'?60:cfg.difficulty==='pro'?38:45;nextCheckpoint=1;lapStart=0;lapTimes=[];raceRank=trial?1:40;prevRank=raceRank;topSpeed=0;passes=0;nearCrash=0;checkpointFlash=0;particles=[];clearSkids();resetBattles();
 player={s:-40*ROLL_DURATION,x:1.8,v:40,lat:0,yaw:0,drift:0,driftTimer:0,driftSide:0,draft:0,sling:0,gear:2,rpm:6000,throttle:0,brake:0,hit:0,wheel:0,wallTouch:false};setupRivals();cameraPos=null;cameraTarget=null;
 for(let id of ['menu','results','pauseScreen','helpScreen'])showScreen(id,false);showScreen('hud',true);
 document.body.classList.toggle('trial',trial);$('gearType').textContent=cfg.trans==='auto'?'AUTO':'MAN';document.body.classList.toggle('manual-controls',cfg.trans==='manual');
 $('clockLabel').textContent=trial?'VS GHOST':'TIME LEFT';$('rankLabel').textContent=trial?'TIME TRIAL':'POSITION';$('rankOf').textContent=trial?'LAP / 3':'/ 40';$('timeleft').classList.remove('danger','ahead','behind');
 $('timeAdd').textContent='';hideMessage();raceStats=freshStats();resetDamage();tacticUntil=0;crew.reset();crew.prepare();ghostStartRace();
 setRollingUI(true);message('ROLLING START',trial?'TIME TRIAL / 3 LAPS / OPEN TRACK':'STARTING 40TH / 40 CARS',1.64);crew.say('intro',4,true);updateHUD();kit.input.settle();
}
function toTitle(){state='menu';resetBattles();resetDamage();setRollingUI(false);crew.reset();hideTags();clearInput();Nav.reset();for(let id of ['results','pauseScreen','hud','helpScreen'])showScreen(id,false);showScreen('menu',true);document.body.classList.remove('trial');player.s=75;player.x=-1;player.v=68;player.draft=player.drift=player.hit=player.sling=player.brake=player.lat=player.yaw=0;player.gear=3;player.rpm=6300;setupRivals(true);cameraPos=null;cameraTarget=null;hideMessage();ghostObj.visible=false;if(window.speechSynthesis)speechSynthesis.cancel();readRecord();updateTouchUI();if(kit.input.source==='gamepad')Nav.focus($('startBtn'))}
function pause(){if(state!=='race'&&state!=='countdown')return;resumeState=state;state='paused';crew.suspend();clearInput();Nav.reset();showScreen('pauseScreen',true);if(window.speechSynthesis)speechSynthesis.cancel();updateTouchUI();if(kit.input.source==='gamepad')Nav.focus($('resumeBtn'))}
function resume(){if(state!=='paused')return;state=resumeState;clearInput();Nav.reset();crew.resume();showScreen('pauseScreen',false);updateTouchUI();sound.start()}
function shift(dir){if(state!=='race'||cfg.trans!=='manual')return;let g=clamp(player.gear+dir,1,4);if(g!==player.gear){player.gear=g;sound.cue('shift')}}
function toggleCamera(){if(state==='countdown'||state==='paused'&&resumeState==='countdown')return;cameraMode=(cameraMode+1)%3;cameraPos=null;cameraTarget=null;$('cameraBtn').textContent=['CLOSE / C','BUMPER / C','FAR / C'][cameraMode];if(state==='race')message(['CLOSE CHASE','BUMPER VIEW','FAR CHASE'][cameraMode],'',.65);savePrefs()}
function ordinalSuffix(n){const k=n%100;return k>=11&&k<=13?'TH':({1:'ST',2:'ND',3:'RD'}[n%10]||'TH')}
let resultsReadyAt=0;
function endRace(complete){if(finished)return;if(complete&&battle.active&&player.s-battle.active.s>7.5)winBattle(battle.active);finished=true;const trial=cfg.mode==='trial';let rank=complete?1+rivals.filter(c=>c.s>player.s).length:raceRank;raceRank=clamp(rank,1,40);state='results';resultsReadyAt=performance.now()+700;$('damageCall').classList.remove('show');damageCallUntil=0;crew.queue=crew.queue.filter(q=>q.id.startsWith('damage_'));setRollingUI(false);clearInput();Nav.reset();showScreen('hud',false);showScreen('results',true);hideMessage();hideTags();ghostObj.visible=false;
 const best=lapTimes.length?Math.min(...lapTimes):0,old=storageGet(recordKey()),oldTime=old&&Number.isFinite(old.time)&&old.time>0?old.time:0,oldLap=old&&Number.isFinite(old.lap)&&old.lap>0?old.lap:0;
 if(trial){
  $('resultRank').innerHTML='TT<small>'+lapTimes.length+'/3</small>';$('resultTitle').textContent=best>0&&(!oldLap||best<oldLap)?'NEW LAP RECORD!':'TIME TRIAL COMPLETE.';$('resultSub').textContent=courseLabel()+' / TIME TRIAL';
  $('resultPassesLabel').textContent='VS OLD BEST LAP';$('resultPasses').textContent=oldLap&&best>0?signed(best-oldLap,3):'FIRST RUN';
  $('resultCombat').innerHTML='<span><b>'+(best>0?formatTime(best):'—')+'</b> BEST LAP</span><span><b>'+(ghostSaved?'NEW':ghostBest?'KEPT':'NONE')+'</b> GHOST</span><span><b>'+raceStats.damageHits+'</b> DAMAGE HITS</span><span><b>-'+raceStats.speedLost+' KM/H</b> TOP SPEED DAMAGE</span><span><b>'+damageControlPct()+'%</b> FINAL CONTROL</span>';
 }else{
  $('resultRank').innerHTML=raceRank+'<small>'+ordinalSuffix(raceRank)+'</small>';$('resultTitle').textContent=!complete?'TIME’S UP.':raceRank===1?'WHAT A DRIVE!':raceRank<=3?'ON THE PODIUM!':'RACE COMPLETE.';$('resultSub').textContent=complete?courseLabel()+' / 3 LAPS COMPLETE':'REACH THE NEXT CHECKPOINT TO ADD TIME.';
  $('resultPassesLabel').textContent='CLEAN PASSES';$('resultPasses').textContent=String(passes);
  $('resultCombat').innerHTML='<span><b>'+battle.won+'/5</b> RIVAL BATTLES WON</span><span><b>'+raceStats.draftPasses+'</b> DRAFT PASSES</span><span><b>'+raceStats.feints+'</b> FALSE MOVES SOLD</span><span><b>'+raceStats.wallPuts+'</b> WALL PUTS</span><span><b>'+raceStats.chains+'</b> CHAIN HITS</span><span><b>'+raceStats.lappedPasses+'</b> LAPPED PASSES</span><span><b>'+raceStats.damageHits+'</b> DAMAGE HITS</span><span><b>-'+raceStats.speedLost+' KM/H</b> TOP SPEED DAMAGE</span><span><b>'+damageControlPct()+'%</b> FINAL CONTROL</span>';
 }
 $('resultTime').textContent=formatTime(elapsed);$('resultBest').textContent=best>0?formatTime(best):'—:——.———';$('resultSpeed').textContent=Math.round(topSpeed*3.6)+' KM/H';$('lapResults').textContent=lapTimes.map((t,i)=>'LAP '+(i+1)+'  '+formatTime(t)).join('   /   ');$('newRecord').classList.add('hidden');
 if(complete){
  // Keep the best race time and the best lap separately, so a quick lap in a slow race still counts.
  const timeBetter=!oldTime||elapsed<oldTime,lapBetter=best>0&&(!oldLap||best<oldLap);
  if(timeBetter||lapBetter){storagePut(recordKey(),{time:timeBetter?elapsed:oldTime,lap:lapBetter?best:oldLap,rank:timeBetter?raceRank:(old&&old.rank)||raceRank});$('newRecord').textContent=timeBetter?'NEW PERSONAL BEST':'NEW BEST LAP';$('newRecord').classList.remove('hidden')}
  sound.cue('finish');crew.say((trial?timeBetter||lapBetter:raceRank===1)?'win':'finish',6,true);
 }else{sound.tone(180,.8,.20,'sawtooth');crew.say('timeout',6,true)}
 updateTouchUI();if(kit.input.source==='gamepad')Nav.focus($('againBtn'));
}
// Every control comes from kit.input actions (keyboard, gamepad, touch), read once per frame.
function readControls(){const I=kit.input,v=I.vector('steer');ctl.steer=clamp(v.x,-1,1);ctl.gas=clamp(I.value('gas'),0,1);ctl.brake=clamp(I.value('brake'),0,1);ctl.slide=I.down('slide')}
function controls(){return ctl}
function collide(strength=.8,side=0,permanent=true){if(permanent)applyPlayerDamage('wall',strength,side);if(player.hit>0)return;player.hit=.7;nearCrash=Math.max(nearCrash,strength);player.v=Math.max(8,player.v*(1-.11*strength)-2);if(side)player.lat=side*5;checkpointFlash=-.17;sound.cue('hit');for(let i=0;i<10;i++){let p=roadPos(player.s-1,player.x+(side<0?1:-1),.7);particles.push({p,v:[(rand()-.5)*8,rand()*4,(rand()-.5)*9],life:.25+rand()*.2,max:.45,size:.4,spark:true})}kit.input.rumble(.65,110)}

function resolvePlayerWall(){
 const ax=Math.abs(player.x);
 if(ax>12){const side=Math.sign(player.x),incoming=Math.max(0,player.lat*side);player.x=side*12;
  if(incoming>0)player.lat=-side*2.5;
  if(player.v>15||incoming>1.5)collide(.65,-side,!player.wallTouch);
  player.wallTouch=true;
 }else if(ax<11.55)player.wallTouch=false;
}
function updatePlayer(dt){const input=controls(),spec=carSpecs[cfg.car],f=frame(player.s);const steerHealth=1-(damage?.steer||0),gripHealth=1-(damage?.grip||0),brakeHealth=1-(damage?.brake||0);steerInput=damp(steerInput,input.steer,10*(.72+.28*steerHealth),dt);player.throttle=input.gas;player.brake=input.brake;player.hit=Math.max(0,player.hit-dt);player.sling=Math.max(0,player.sling-dt);let brakeTap=input.brake>.2&&!lastBrake;lastBrake=input.brake>.2;
 if((input.slide||brakeTap)&&Math.abs(steerInput)>.18&&player.v>30){player.driftTimer=input.slide?.48:1.0;player.driftSide=Math.sign(steerInput)}player.driftTimer=Math.max(0,player.driftTimer-dt);if(Math.sign(steerInput)!==player.driftSide&&Math.abs(steerInput)>.18)player.driftTimer=Math.max(0,player.driftTimer-dt*4);let drifting=player.driftTimer>0&&player.v>24;player.drift=damp(player.drift,drifting?1:0,drifting?7:5,dt);
 let drafting=false;for(let c of rivals){let d=mod(c.s-player.s+L/2,L)-L/2;if(d>5&&d<49&&Math.abs(c.x-player.x)<1.9)drafting=true}if(player.draft>.87&&!drafting&&player.sling<=0){player.sling=2.0;sound.cue('shift');crew.say('sling',2)}player.draft=damp(player.draft,drafting?1:0,drafting?1.8:1.4,dt);
 let battleBoost=battle.active&&!battle.active.defeated?(battle.active.playerEdge||0):0,maxSpeed=Math.max(66,spec.max-(damage?.speedLoss||0))+player.draft*6.5+(player.sling>0?4:0)+battleBoost,gears=[0,31,54,78,maxSpeed],targetGear=player.gear;if(cfg.trans==='auto'){if(player.gear<4&&player.v>[0,22,44,67][player.gear])targetGear++;if(player.gear>1&&player.v<[0,0,17,37,58][player.gear])targetGear--;if(targetGear!==player.gear){player.gear=targetGear;sound.cue('shift')}}
 let cap=cfg.trans==='manual'?gears[player.gear]:maxSpeed;let power=22*spec.accel*(1-.63*Math.pow(Math.min(1,player.v/maxSpeed),1.6));if(cfg.trans==='manual'&&player.v/gears[player.gear]<.34)power*=.65;
 let acc=input.gas*power-(1.5+player.v*player.v*.00036)-input.brake*40*brakeHealth-player.drift*1.3-f.t[1]*10;if(!input.gas)acc-=3.5;player.v=Math.max(0,player.v+acc*dt);if(player.v>cap)player.v=damp(player.v,cap,8,dt);
 let centrifugal=cfg.difficulty==='tour'?.14:cfg.difficulty==='pro'?.21:.18,effectiveGrip=spec.grip*gripHealth,steerPower=(3+player.v*.177)*effectiveGrip*steerHealth;let damagedSteer=clamp(steerInput+(damage?.pull||0)*(0.55+player.v/Math.max(70,maxSpeed)),-1,1);let targetLat=damagedSteer*steerPower*(1+player.drift*.34)-f.cur*player.v*player.v*centrifugal*(1-player.drift*.13)+Math.sin(worldTime*7.3)*(damage?.grip||0)*1.8;if(player.v<1.5)targetLat=0;player.lat=damp(player.lat,targetLat,Math.max(1.45,4.6*effectiveGrip-player.drift*2.1),dt);player.x+=player.lat*dt;
 const ax=Math.abs(player.x);if(ax>11.2){player.v=Math.max(0,player.v-(8+(player.v>53?player.v*.35:0))*dt);if(rand()<dt*20){particles.push({p:roadPos(player.s-2,player.x,.15),v:[(rand()-.5)*2,1,-1],life:.6,max:.6,size:.4,spark:false})}}resolvePlayerWall();
 player.yaw=damp(player.yaw,Math.atan2(player.lat,Math.max(20,player.v))+steerInput*.045+player.drift*player.driftSide*.29,7,dt);let forward=Math.max(.88,1-player.drift*.035);player.s+=player.v*forward*dt;player.rpm=damp(player.rpm,clamp(1400+(player.v/gears[player.gear])*7200+input.gas*200,1300,9400),10,dt);player.wheel+=player.v*dt;

 if(player.drift>.3&&player.v>25&&rand()<dt*30){for(let x of [-.94,.94]){let pos=roadPos(player.s-1.8,player.x+x,.2);particles.push({p:pos,v:[player.lat*.25+(rand()-.5),1.2+rand(),0],life:.48,max:.48,size:.25+rand()*.12,spark:false})}}
 if(player.drift>.35&&player.v>28)addSkid(player.s,player.x);topSpeed=Math.max(topSpeed,player.v);
}

function tick(dt){if(!Number.isFinite(dt)||dt<=0)return;frameCache.clear();const radioDt=dt;if(state==='paused'){crew.tick(radioDt,true);sound.tick(dt,player,false);return}advanceBattleFX(dt);dt*=battle.scale;worldTime+=dt;simTime+=dt;uiClock+=dt;nearCrash=Math.max(0,nearCrash-dt*2.3);checkpointFlash=damp(checkpointFlash,0,7,dt);if(messageTime>0){messageTime-=dt;if(messageTime<=0)hideMessage()}
 if(state==='menu'){player.s+=68*dt;player.x=damp(player.x,Math.sin(worldTime*.32)*2.1,2,dt);player.yaw=Math.sin(worldTime*.3)*.018;player.v=68;player.throttle=.5;player.rpm=6200;updateRivals(dt,'menu')}
 else if(state==='countdown'){let inp=controls();player.throttle=inp.gas;player.rpm=4500+inp.gas*2600;const step=Math.min(dt,countdown);player.s+=40*step;updateRivals(step,'countdown');countdown=Math.max(0,countdown-dt);if(countdown<1e-6)countdown=0;let count=Math.ceil(countdown/1.65);if(count!==countLast&&count>0&&count<=3){countLast=count;message(String(count),'ROLLING START / CONTROL AT GREEN',1.65);sound.cue('count')}let phase=(ROLL_DURATION-countdown)/ROLL_DURATION;setText('startPhase',phase<.22?'CAMERA LOCK / FRONT':phase<.43?'LOW SWEEP / FRONT QUARTER':phase<.65?'SIDE VIEW / HOLD POSITION':phase<.95?'CHASE VIEW / GET READY':'CAMERA SET / WAIT FOR GREEN');for(let i=0;i<cinemaTicks.length;i++)cinemaTicks[i].classList.toggle('on',count<=3-i);if(countdown<=0){const offset=player.s;player.s=0;for(let c of rivals)c.s-=offset;state='race';setRollingUI(false);message('GO!','YOU HAVE CONTROL.',1.5);sound.cue('go');kit.input.rumble(.3,120)}}
 else if(state==='race'){const trial=cfg.mode==='trial';elapsed+=dt;if(!trial)clock-=dt;updateRivals(dt,'race');updatePlayer(dt);solveContacts(dt);trackPasses();updateBattles(dt);let rank=1+rivals.filter(c=>c.s>player.s).length;if(rank<prevRank&&player.hit<=0)passes+=prevRank-rank;if(prevRank>10&&rank<=10)crew.say('ten',3);if(prevRank>6&&rank<=6)crew.say('frontfive',3);prevRank=rank;raceRank=rank;
 if(trial)ghostRecord();
 while(player.s>=nextCheckpoint*(L/3)&&nextCheckpoint<9){
  if(trial){if(nextCheckpoint%3!==0){const sp=ghostDeltaNow();message('SPLIT',sp===null?'SECTOR '+(nextCheckpoint%3)+' / '+formatTime(elapsed-lapStart):signed(sp)+' VS GHOST',1.6);checkpointFlash=.075;sound.cue('checkpoint')}nextCheckpoint++;continue}
  let bonus=cfg.difficulty==='tour'?18:cfg.difficulty==='pro'?12:15;clock=Math.min(99,clock+bonus);checkpointFlash=.075;$('timeAdd').textContent='+'+bonus+' SECONDS';if(nextCheckpoint%3!==0){message('CHECKPOINT!','TIME EXTENDED +'+bonus,2);sound.cue('checkpoint');crew.say('checkpoint',2)}nextCheckpoint++}
 if(player.s>=(lapTimes.length+1)*L&&lapTimes.length<3){const lapTime=elapsed-lapStart,newGhost=trial&&ghostFinishLap(lapTime);lapTimes.push(lapTime);lapStart=elapsed;if(lapTimes.length===3){endRace(true)}else{message(lapTimes.length===2?'FINAL LAP!':'LAP 2',trial?'LAP '+formatTime(lapTime)+(newGhost?'  /  NEW GHOST':''):'BEST LAP '+formatTime(Math.min(...lapTimes)),2.2);sound.cue('checkpoint');crew.say(lapTimes.length===2?'final':'lap2',4,true)}}
 if(!trial&&state==='race'&&clock<=0){clock=0;endRace(false)}if(!trial&&Math.floor(clock)===10&&Math.floor(clock+dt)>10){crew.say('clock',4,true);sound.cue('count')}}
 else if(state==='results'){player.v=damp(player.v,0,2,dt);player.throttle=0;player.rpm=damp(player.rpm,1200,2,dt);updateRivals(dt,'menu')}
 for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.p[0]+=p.v[0]*dt;p.p[1]+=p.v[1]*dt;p.p[2]+=p.v[2]*dt;if(p.spark)p.v[1]-=dt*7;p.size+=dt*(p.spark?0:1.05)}const particleCap=Math.min(PARTICLE_CAP,kit.detail(90,24));if(particles.length>particleCap)particles.splice(0,particles.length-particleCap);if(damageCallUntil&&worldTime>damageCallUntil){$('damageCall').classList.remove('show');damageCallUntil=0}if(uiClock>.04){if(state==='race'||state==='countdown')updateHUD();uiClock=0}crew.tick(radioDt);sound.tick(dt,player,state==='race'||state==='countdown')}
const mapCtx=$('map').getContext('2d');let minX=Math.min(...track.map(p=>p[0])),maxX=Math.max(...track.map(p=>p[0])),minZ=Math.min(...track.map(p=>p[2])),maxZ=Math.max(...track.map(p=>p[2]));let mapScale=Math.min(304/(maxX-minX),250/(maxZ-minZ));function mapPoint(s){let p=point(s);return[(p[0]-(minX+maxX)/2)*mapScale+185,155-(p[2]-(minZ+maxZ)/2)*mapScale]}
const mapBase=document.createElement('canvas');mapBase.width=370;mapBase.height=310;
(function buildMapBase(){const c=mapBase.getContext('2d');c.lineJoin='round';c.lineCap='round';c.beginPath();for(let i=0;i<=N;i+=7){let p=mapPoint(i/N*L);if(i===0)c.moveTo(...p);else c.lineTo(...p)}c.closePath();c.strokeStyle='#06273dbb';c.lineWidth=18;c.stroke();c.strokeStyle='#fff8da';c.lineWidth=5;c.stroke();for(let cp of [0,L/3,L*2/3]){let p=mapPoint(cp);c.fillStyle='#ffdc35';c.fillRect(p[0]-4,p[1]-4,8,8)}})();
function drawMap(){const c=mapCtx;c.clearRect(0,0,370,310);c.drawImage(mapBase,0,0);for(let car of rivals){let p=mapPoint(car.s);c.beginPath();c.arc(...p,car.elite?5.2:3.1,0,TAU);c.fillStyle=car.elite?car.profile.color:'#ef654c';c.fill();if(car.elite){c.strokeStyle='#052a42';c.lineWidth=2;c.stroke()}}let p=mapPoint(player.s);c.beginPath();c.arc(...p,8,0,TAU);c.fillStyle='#052a42';c.fill();c.beginPath();c.arc(...p,5.5,0,TAU);c.fillStyle='#ffdf35';c.fill()}
function setText(id,value){const node=$(id),text=String(value);if(node.textContent!==text)node.textContent=text}
const shiftUpHint=()=>kit.input.source==='gamepad'?'RB':kit.input.source==='touch'?'GEAR +':'E';
let hudRpmBars=-1,hudDraft=-1,hudDrive='',hudDelta='';
function updateHUD(){let p=player;const trial=cfg.mode==='trial';setText('rank',trial?Math.min(3,lapTimes.length+1):raceRank);setText('lap',Math.min(3,Math.floor(Math.max(0,p.s)/L)+1));
 if(trial){const d=ghostDeltaNow(),cls=d===null?'':d<0?'ahead':'behind';setText('timeleft',d===null?'—':signed(d));if(cls!==hudDelta){$('timeleft').classList.toggle('ahead',cls==='ahead');$('timeleft').classList.toggle('behind',cls==='behind');hudDelta=cls}}
 else{setText('timeleft',Math.max(0,Math.ceil(clock)).toString().padStart(2,'0'));$('timeleft').classList.toggle('danger',clock<=10)}
 setText('elapsed',elapsed>0?formatTime(elapsed):'0:00.000');const bestLap=Math.min(lapTimes.length?Math.min(...lapTimes):Infinity,trial&&ghostBest?ghostBest.lap:Infinity);setText('bestlap',Number.isFinite(bestLap)?formatTime(bestLap):'—:——.———');setText('speed',Math.round(p.v*3.6).toString().padStart(3,'0'));setText('gear',p.gear);
 let bars=Math.floor(p.rpm/9400*30);if(bars!==hudRpmBars){rpmBars.forEach((n,i)=>n.classList.toggle('on',i<bars));hudRpmBars=bars}
 const draft=Math.round(p.draft*100);if(draft!==hudDraft){$('draftFill').style.width=draft+'%';hudDraft=draft}
 let label=p.hit>.1?'WATCH THE PAINT!':p.sling>0?'SLINGSHOT!':p.drift>.45?'POWER SLIDE':p.draft>.35?'SLIPSTREAM':'FIND YOUR LINE';if(label!==hudDrive){setText('driveState',label);$('driveState').style.color=p.drift>.45?'#ffdc35':p.hit>.1?'#ff7658':'#65eff0';hudDrive=label}
 setText('advice',cfg.trans==='manual'&&p.rpm>8200&&p.gear<4?'SHIFT UP / '+shiftUpHint():p.drift>.4?'COUNTERSTEER TO STRAIGHTEN UP.':trial?'CLEAN LINES. BEAT YOUR GHOST.':'STAY CLOSE. CATCH THE DRAFT.');
 // Sector names belong to places on the island, so reverse uses the forward fraction for them.
 let f=mod(p.s,L)/L,pf=trackDir>0?f:mod(1-f,1);setText('sectorName',pf<.15?'GRANDSTAND STRAIGHT':pf<.30?'COASTER CLIMB':pf<.46?'THE HIGH BANK':pf<.615?'OCEAN CHICANE':pf<.719?'OCEAN RUN TUNNEL':pf<.87?'COAST SWEEP':'HOME STRETCH');setText('mapSector','SECTOR 0'+(Math.floor(f*3)+1)+' / 03');if(messageTime<=0)setText('timeAdd','');drawMap();updateRivalHUD()}
const helmetSVG='<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M7 24V19C7 10 12 6 21 6c8 0 13 6 13 14v11H17l-4-6z" fill="currentColor"/><path d="M10 16h24v8H12z" fill="#06253a"/><path d="M14 28h10M18 32v3h11" stroke="#06253a" stroke-width="2"/><path d="M13 19h16" stroke="#d8faff" stroke-width="1.5"/></svg>';
const railRows=[],tagNodes=[];
for(let j=4;j>=0;j--){const d=CHAMPIONS[j],row=document.createElement('div');row.className='rival-row';row.style.setProperty('--rival',d.color);row.innerHTML='<span class="rnum">'+d.number+'</span><strong>'+d.tag+'</strong><span class="rgap">—</span>';$('rivalRows').append(row);railRows[j]=row}
for(let j=0;j<5;j++){const d=CHAMPIONS[j],tag=document.createElement('div');tag.className='rival-tag';tag.style.setProperty('--rival',d.color);tag.innerHTML=helmetSVG+'<div><strong>'+d.tag+' <span class="tagnum">#'+d.number+'</span></strong><small>'+d.name+'</small></div>';$('rivalTags').append(tag);tagNodes[j]=tag}
for(const tag of tagNodes)tag.style.display='none';
const railGaps=railRows.map(row=>row.querySelector('.rgap')),tagSmall=tagNodes.map(tag=>tag.querySelector('small'));
function updateRivalHUD(){
 const next=nextChampion();
 for(let c of rivals){if(!c.elite)continue;const j=c.id-34,row=railRows[j],gap=c.s-player.s;
  row.classList.toggle('passed',c.defeated);row.classList.toggle('target',c===next);
  const text=c.defeated?'BEATEN':c===battle.active?'BATTLE':c===next?Math.max(0,Math.round(gap))+' M':'AHEAD';if(railGaps[j].textContent!==text)railGaps[j].textContent=text;
 }
 setText('rivalCount',battle.won+' / 5');$('tacticToast').classList.toggle('show',worldTime<tacticUntil&&state==='race')
}

// Screen position of a game-space point (the scene root mirrors x, so the point does too).
const tagV=new THREE.Vector3();
function projectToScreen(p){tagV.set(-p[0],p[1],p[2]).applyMatrix4(camera.matrixWorldInverse);if(-tagV.z<=.1)return null;tagV.applyMatrix4(camera.projectionMatrix);return{x:tagV.x*W*.5+W*.5,y:-tagV.y*H*.5+H*.5}}
let tagShown=-1;
function hideTags(){if(tagShown>=0){tagNodes[tagShown].style.display='none';tagShown=-1}}
function drawRivalTags(){
 if(state!=='race'||battle.introAge<BATTLE_INTRO){hideTags();return}
 const c=battle.active||nextChampion();if(!c){hideTags();return}const d=trackDelta(c.s-player.s);if(d<-6||d>BATTLE_REVEAL){hideTags();return}
 const j=c.id-34,tag=tagNodes[j],compact=d>(W<650?35:90);
 const pos=projectToScreen(roadPos(c.s,c.x,2.65));if(!pos||pos.x<40||pos.x>W-40||pos.y<110||pos.y>H-100){hideTags();return}
 if(tagShown!==j){hideTags();tag.style.display='flex';tagShown=j}
 tag.classList.toggle('compact',compact);tag.style.left=pos.x+'px';tag.style.top=pos.y+'px';tag.style.opacity=String(clamp((BATTLE_REVEAL-d)/75,.30,1));
 const text=c.opening>0?'OPEN / '+c.openingKind:c.ai==='BLOCK'?'BLOCK COMMITTED':c.profile.name;if(tagSmall[j].textContent!==text)tagSmall[j].textContent=text;
}
function localRaceCamera(mode,speed){
 const f=clamp(speed/100,0,1.1);
 return mode===1?{eye:[0,.87,1.75],target:[0,1.2,48],fov:76+f*8}
  :mode===2?{eye:[0,7.4,-15.2],target:[0,1.2,14],fov:70+f*6}
  :{eye:[0,2.75,-6.45-f*.20],target:[0,1.10,12],fov:64+f*5};
}

function startCameraPose(){const t=clamp((ROLL_DURATION-countdown)/ROLL_DURATION,0,1),goal=localRaceCamera(cameraMode,40),keyframes=[
 {t:0,eye:[0,2.65,9.8],target:[0,1.05,0],fov:51},
 {t:.22,eye:[0,2.65,9.8],target:[0,1.05,0],fov:51},
 {t:.40,eye:[-3.6,.92,5.7],target:[0,.95,.25],fov:60},
 {t:.61,eye:[-5.7,1.28,-.7],target:[0,1.0,.30],fov:63},
 {t:.78,eye:[-4.4,2.8,-8.0],target:[0,1.2,4],fov:68},
 ...(cameraMode===1?[{t:.87,eye:[-1,4.0,-.3],target:[0,1.2,29],fov:73}]:[]),
 {t:.95,...goal},{t:1,...goal}];let a=keyframes[0],b=keyframes[1];for(let i=0;i<keyframes.length-1;i++)if(t>=keyframes[i].t&&t<=keyframes[i+1].t){a=keyframes[i];b=keyframes[i+1];break}const k=smooth((t-a.t)/Math.max(.001,b.t-a.t));return{eye:V.mix(a.eye,b.eye,k),target:V.mix(a.target,b.target,k),fov:lerp(a.fov,b.fov,k),t}}
function toCameraWorld(local,p,f){return V.add(V.add(p,V.mul(f.r,local[0])),V.add([0,local[1],0],V.mul(f.t,local[2])))}
function setRollingUI(on){document.body.classList.toggle('rolling',on);$('cinema').classList.toggle('active',on);$('cameraBtn').disabled=on;if(!on)for(let n of cinemaTicks)n.classList.remove('on');updateTouchUI()}

// Camera, particles, and a full 3D render. The moving camera adds speed without blur filters.
const fx=document.createElement('canvas');fx.id='speedfx';fx.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';document.body.insertBefore(fx,$('menu'));const fxctx=fx.getContext('2d');let W=innerWidth,H=innerHeight,fxDirty=false,lastFlash=-1;
kit.onResize((w,h)=>{W=w;H=h;fx.width=w;fx.height=h;fxDirty=false;placeTouchPills()});
function render(dt){frameCache.clear();const f=frame(player.s),p=roadPos(player.s,player.x,.08);let eye,target,up=[0,1,0],speedFrac=player.v/100,fov=69+speedFrac*9;
 if(state==='menu'){eye=V.add(V.add(p,V.mul(f.t,-8.0)),V.add(V.mul(f.r,-4.0),[0,3.85,0]));target=V.add(V.add(p,V.mul(f.t,8)),V.add(V.mul(f.r,-2.0),[0,.8,0]));fov=65}
 else if(state==='results'){let a=worldTime*.13;eye=V.add(p,[Math.cos(a)*9,4.1,Math.sin(a)*9]);target=V.add(p,[0,1,0]);fov=61}
 else if(state==='countdown'||state==='paused'&&resumeState==='countdown'){const rig=startCameraPose();eye=toCameraWorld(rig.eye,p,f);target=toCameraWorld(rig.target,p,f);eye[1]=Math.max(eye[1],roadPos(player.s+rig.eye[2],player.x+rig.eye[0],.48)[1]);fov=rig.fov}
  else{
   const rig=localRaceCamera(cameraMode,player.v);
   eye=toCameraWorld(rig.eye,p,f);target=toCameraWorld(rig.target,p,f);fov=rig.fov;
   if(cameraMode!==1){const lean=-steerInput*.028-player.drift*player.driftSide*.022;up=V.norm(V.add([0,1,0],V.mul(f.r,lean)))}
  }
  if(nearCrash>0&&state!=='paused'){eye[0]+=Math.sin(worldTime*89)*nearCrash*.09;eye[1]+=Math.cos(worldTime*67)*nearCrash*.065}
  const following=state==='race'||state==='paused'&&resumeState==='race';
  if(!cameraPos||state==='countdown'||following){cameraPos=eye;cameraTarget=target}
  else if(state!=='paused'){cameraPos=V.mix(cameraPos,eye,1-Math.exp(-9*dt));cameraTarget=V.mix(cameraTarget,target,1-Math.exp(-11*dt))}
  // Sample the road under the rig, including banking. Close chase stays close on crests.
  if(following&&cameraMode!==1){const rig=localRaceCamera(cameraMode,player.v);cameraPos[1]=Math.max(cameraPos[1],roadPos(player.s+rig.eye[2],player.x,.65)[1])}

 if(W/H<1&&state!=='menu'&&state!=='results'){const horizontal=cameraMode===0?56:64;fov=Math.max(fov,2*Math.atan(Math.tan(horizontal*Math.PI/360)/(W/H))*180/Math.PI)}
 // Place the three.js camera in the mirrored world (see the scene root).
 camera.position.set(-cameraPos[0],cameraPos[1],cameraPos[2]);camera.up.set(-up[0],up[1],up[2]);camera.lookAt(-cameraTarget[0],cameraTarget[1],cameraTarget[2]);
 if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix()}camera.updateMatrixWorld();
 skyPitch.value=(cameraTarget[1]-cameraPos[1])/(Math.hypot(cameraTarget[0]-cameraPos[0],cameraTarget[1]-cameraPos[1],cameraTarget[2]-cameraPos[2])||1)*1.7;
 let angle=worldTime*.10;matInto(tmpM,0,wheelCenter[0],wheelCenter[1],wheelCenter[2],0,0,angle);setMatrix(wheelObj,tmpM);for(let i=0;i<12;i++){let a=i/12*TAU+angle;matInto(tmpM,0,wheelCenter[0]+Math.cos(a)*wheelR,wheelCenter[1]+Math.sin(a)*wheelR-3.3,wheelCenter[2]);setMatrix(gondolaObjs[i],tmpM)}
 let tt=mod(worldTime*.011,1),tp=catmull(cp,tt),tq=catmull(cp,tt+.002),td=V.norm(V.sub(tq,tp));matInto(tmpM,0,tp[0],tp[1],tp[2],Math.atan2(td[0],td[2]),-Math.asin(td[1]));setMatrix(trainObj,tmpM);
 carCounts.fill(0);let shadows=0;const focus=battle.active||nextChampion();
 for(let c of rivals){let d=mod(c.s-player.s+L/2,L)-L/2;if(d>550||d<-160)continue;if(c.elite&&(d>BATTLE_REVEAL||d<-75))continue;if(c.elite&&!c.defeated&&c!==focus&&d>42)continue;poseInto(shadowInst.instanceMatrix.array,16*shadows++,c.s,c.x,.025);poseInto(carInst[c.car].instanceMatrix.array,16*carCounts[c.car]++,c.s,c.x,.075,Math.atan2(c.lat+(c.kick||0),Math.max(20,c.v))+(c.spin||0))}
 const showPlayer=cameraMode!==1||state==='menu'||state==='results'||(state==='countdown'&&countdown>ROLL_DURATION*.055);
 if(playerObj.geometry!==carMeshes[cfg.car])playerObj.geometry=carMeshes[cfg.car];playerObj.visible=showPlayer;brakeObj.visible=showPlayer&&player.brake>.15;
 if(showPlayer){poseInto(shadowInst.instanceMatrix.array,16*shadows++,player.s,player.x,.025);poseInto(tmpM,0,player.s,player.x,.08+Math.sin(worldTime*38)*speedFrac*.008,player.yaw);setMatrix(playerObj,tmpM);setMatrix(brakeObj,tmpM)}
 for(let i=3;i<carInst.length;i++)commitInstances(carInst[i],carCounts[i]);commitInstances(shadowInst,shadows);drawGhost();
 let smokes=0,sparks=0;for(const q of particles){if(q.spark){if(sparks<PARTICLE_CAP)matInto(sparkInst.instanceMatrix.array,16*sparks++,q.p[0],q.p[1],q.p[2],worldTime,0,0,q.size,q.size,q.size)}else if(smokes<PARTICLE_CAP)matInto(smokeInst.instanceMatrix.array,16*smokes++,q.p[0],q.p[1],q.p[2],worldTime,0,0,q.size,q.size*.75,q.size)}commitInstances(smokeInst,smokes);commitInstances(sparkInst,sparks);
 kit.renderer.render(scene,camera);
 if(state==='race'&&(player.draft>.40||player.v>89)){fxctx.clearRect(0,0,W,H);fxDirty=true;let intensity=clamp((player.v-76)/30+player.draft*.6,0,1);fxctx.strokeStyle=`rgba(240,252,255,${intensity*.22})`;fxctx.lineWidth=1.25;for(let i=0;i<18;i++){let a=i/18*TAU,r=mod(worldTime*(.8+speedFrac)+i*.417,1),inner=.40+r*.52,outer=inner+.06+speedFrac*.025,cx=W*.5,cy=H*.48;fxctx.beginPath();fxctx.moveTo(cx+Math.cos(a)*W*inner,cy+Math.sin(a)*H*inner);fxctx.lineTo(cx+Math.cos(a)*W*outer,cy+Math.sin(a)*H*outer);fxctx.stroke()}}else if(fxDirty){fxctx.clearRect(0,0,W,H);fxDirty=false}
 drawRivalTags();updateBattleUI();const flash=Math.round(Math.abs(checkpointFlash)*400)/400;if(flash!==lastFlash){$('flash').style.opacity=flash;lastFlash=flash}frameId++;
}
function drawGhost(){
 if(cfg.mode==='trial'&&ghostBest&&lapTimes.length<3&&(state==='race'||state==='paused'&&resumeState==='race')){const g=ghostPoseAt(elapsed-lapStart);if(g){if(ghostObj.geometry!==carMeshes[cfg.car])ghostObj.geometry=carMeshes[cfg.car];poseInto(tmpM,0,lapTimes.length*L+g.s,g.x,.08,g.yaw);setMatrix(ghostObj,tmpM);ghostObj.visible=true;return}}
 ghostObj.visible=false;
}


// ---- Menus: mouse and touch click the buttons; keyboard and gamepad move a focus ring ----------
const Nav={
 current:null,
 screen(){if(!$('helpScreen').classList.contains('hidden'))return $('helpScreen');if(state==='paused')return $('pauseScreen');if(state==='results')return $('results');if(state==='menu')return $('menu');return null},
 primary(root){return root===$('helpScreen')?$('closeHelp'):root===$('pauseScreen')?$('resumeBtn'):root===$('results')?$('againBtn'):$('startBtn')},
 items(root){return[...root.querySelectorAll('button,input[type=range]')].filter(el=>!el.disabled&&el.getClientRects().length>0)},
 focus(el){this.clear();if(!el)return;this.current=el;el.classList.add('navfocus');try{el.focus({preventScroll:true})}catch(e){}el.scrollIntoView?.({block:'nearest'})},
 clear(){if(this.current)this.current.classList.remove('navfocus');this.current=null},
 // Leaving a screen: drop the ring and the DOM focus, so Space or Enter never reach a hidden button.
 reset(){this.clear();const a=document.activeElement;if(a&&a!==document.body&&a.matches?.('button,input'))a.blur()},
 valid(){const root=this.screen();return !!(this.current&&root&&root.contains(this.current)&&this.current.getClientRects().length)},
 step(dir){
  const root=this.screen();if(!root)return;if(!this.valid()){this.focus(this.primary(root));return}
  const cur=this.current;
  if(cur.type==='range'&&(dir==='l'||dir==='r')){cur.value=String(clamp(Number(cur.value)+(dir==='r'?5:-5),Number(cur.min)||0,Number(cur.max)||100));cur.dispatchEvent(new Event('input',{bubbles:true}));return}
  const dx=dir==='l'?-1:dir==='r'?1:0,dy=dir==='u'?-1:dir==='d'?1:0,r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let best=null,score=Infinity;
  for(const el of this.items(root)){if(el===cur)continue;const q=el.getBoundingClientRect(),vx=q.left+q.width/2-cx,vy=q.top+q.height/2-cy,along=vx*dx+vy*dy;if(along<=2)continue;const s=along+Math.abs(vx*dy-vy*dx)*2.5;if(s<score){score=s;best=el}}
  if(best)this.focus(best);
 },
 activate(fallback){if(this.valid()){if(this.current.type!=='range')this.current.click()}else fallback()}
};
addEventListener('pointerdown',()=>Nav.clear(),true);
let navDir='',navRepeatAt=0;
function navInput(){const v=kit.input.vector('nav');let dir='';if(Math.max(Math.abs(v.x),Math.abs(v.y))>.55)dir=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?'r':'l'):(v.y>0?'u':'d');const now=performance.now();if(dir&&(dir!==navDir||now>=navRepeatAt)){navRepeatAt=now+(dir!==navDir?420:150);Nav.step(dir)}navDir=dir}
// Discrete actions, once per frame. Held controls (steer, gas, brake, slide) go through readControls().
function handleInput(){
 const I=kit.input;
 if(I.pressed('fullscreen'))fullScreen();
 if(I.pressed('mute'))sound.setMute(!sound.muted);
 if(!$('helpScreen').classList.contains('hidden')){if(I.pressed('back')||I.pressed('start')){closeHelp();return}navInput();if(I.pressed('ok'))Nav.activate(closeHelp);return}
 if(state==='menu'){navInput();if(I.pressed('ok'))Nav.activate(startRace);else if(I.pressed('start'))startRace()}
 else if(state==='results'){if(performance.now()<resultsReadyAt)return;navInput();if(I.pressed('ok'))Nav.activate(startRace);else if(I.pressed('start')||I.pressed('restart'))startRace();else if(I.pressed('back'))toTitle()}
 else if(state==='paused'){if(I.pressed('pause')||I.pressed('back')){resume();return}navInput();if(I.pressed('ok'))Nav.activate(resume);else if(I.pressed('restart'))startRace()}
 else if(state==='race'||state==='countdown'){if(I.pressed('pause')){pause();return}if(I.pressed('camera'))toggleCamera();if(I.pressed('shiftDown'))shift(-1);if(I.pressed('shiftUp'))shift(1)}
}

// ---- Touch controls: the kit's floating steering stick, pedals on the right, view and pause pills ----
function updateTouchUI(){
 const t=kit.touch;if(!t)return;
 const driving=(state==='race'||state==='countdown')&&$('helpScreen').classList.contains('hidden');
 t.suspend(!driving,'game');t.setShown('shiftDown',cfg.trans==='manual');t.setShown('shiftUp',cfg.trans==='manual');t.setShown('camera',state==='race');
}
function placeTouchPills(){if(kit.touch)kit.touch.placeTop('right',H<=500?106:W<=850?128:150)}

// ---- Help: controls for the device in hand ----------------------------------------------------
const CONTROL_HELP={
 keyboard:[['ACCELERATE / BRAKE','<kbd>↑</kbd> <kbd>↓</kbd> or <kbd>W</kbd> <kbd>S</kbd>'],['STEER','<kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>'],['START A SLIDE','<kbd>Space</kbd> + steer, or brake + steer'],['MANUAL GEARS','<kbd>Q</kbd> down &nbsp; <kbd>E</kbd> up'],['CAMERA / SOUND','<kbd>C</kbd> view &nbsp; <kbd>M</kbd> mute'],['PAUSE / FULL SCREEN','<kbd>P</kbd> or <kbd>Esc</kbd> &nbsp; <kbd>F</kbd>'],['MENUS','<kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> move &nbsp; <kbd>Enter</kbd> select'],['GRAPHICS','<kbd>F9</kbd> or SETTINGS']],
 gamepad:[['GAS / BRAKE','<kbd>RT</kbd> <kbd>LT</kbd> (or <kbd>A</kbd> and the D-pad)'],['STEER','Left stick or D-pad'],['START A SLIDE','<kbd>B</kbd> + steer, or brake + steer'],['MANUAL GEARS','<kbd>LB</kbd> down &nbsp; <kbd>RB</kbd> up'],['CAMERA','<kbd>Y</kbd> cycles the view'],['PAUSE','<kbd>Start</kbd>'],['MENUS','Stick or D-pad to move, <kbd>A</kbd> select, <kbd>B</kbd> back'],['RUMBLE','On contact and wall hits. Turn it off in SETTINGS.']],
 touch:[['STEER','Put your left thumb down anywhere on the left side and slide it left or right'],['GAS / BRAKE','Right thumb on GAS and BRAKE'],['START A SLIDE','Hold SLIDE and steer, or tap BRAKE while steering'],['MANUAL GEARS','GEAR − and GEAR + above the pedals'],['VIEW / PAUSE','The VIEW and II buttons at the top right'],['LAYOUT','SETTINGS can mirror the controls or make them bigger']]
};
function renderHelp(device){if(!CONTROL_HELP[device])device='keyboard';setActive('helpDevice',device);$('controlsGrid').innerHTML=CONTROL_HELP[device].map(([title,text])=>'<div><b>'+title+'</b>'+text+'</div>').join('')}
function openHelp(){renderHelp(kit.input.source);showScreen('helpScreen',true);updateTouchUI();const d=$('helpScreen').querySelector('.dialog');if(d)d.scrollTop=0;if(kit.input.source==='gamepad')Nav.focus($('closeHelp'))}
function closeHelp(){showScreen('helpScreen',false);Nav.reset();updateTouchUI();kit.input.settle();if(kit.input.source==='gamepad'&&state==='menu')Nav.focus($('helpBtn'))}

// Button prompts follow the last device used.
function updatePrompts(){
 const pad=kit.input.source==='gamepad',touch=kit.input.source==='touch';
 $('startKey').textContent=pad?'A / START':'ENTER';$('startKey').hidden=touch;
 $('startNote').innerHTML=pad?'RT GAS &nbsp; · &nbsp; B TO SLIDE &nbsp; · &nbsp; Y TO CHANGE VIEW':touch?'LEFT THUMB STEERS &nbsp; · &nbsp; RIGHT THUMB DRIVES':'ARROW KEYS TO DRIVE &nbsp; · &nbsp; SPACE TO SLIDE &nbsp; · &nbsp; C TO CHANGE VIEW';
 $('keyhint').innerHTML=pad?'RT ACCELERATE &nbsp; · &nbsp; LT BRAKE &nbsp; · &nbsp; STICK STEER &nbsp; · &nbsp; B SLIDE &nbsp; · &nbsp; LB / RB SHIFT &nbsp; · &nbsp; Y VIEW':'↑ / W ACCELERATE &nbsp; · &nbsp; ↓ / S BRAKE &nbsp; · &nbsp; ← → STEER &nbsp; · &nbsp; SPACE DRIFT &nbsp; · &nbsp; Q / E SHIFT';
 $('cameraBtn').title=pad?'Change view (Y)':'Change view (C)';
 if(pad&&!Nav.valid()){const root=Nav.screen();if(root)Nav.focus(Nav.primary(root))}
}
kit.input.onSourceChange(updatePrompts);

function optionGroup(id,change){$(id).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{$(id).querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));change(b.dataset.value)}))}
function setActive(id,value){$(id).querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.value===value))}
optionGroup('transChoice',v=>{cfg.trans=v;document.body.classList.toggle('manual-controls',v==='manual');readRecord();savePrefs()});optionGroup('difficultyChoice',v=>{cfg.difficulty=v;readRecord();savePrefs()});optionGroup('modeChoice',v=>{cfg.mode=v==='trial'?'trial':'race';updateCourseUI();readRecord();savePrefs()});optionGroup('courseChoice',v=>{applyCourse(v);updateCourseUI();readRecord();savePrefs()});optionGroup('musicChoice',v=>{sound.music=v==='on';savePrefs()});optionGroup('voiceChoice',v=>{crew.mode=v;crew.stop();storagePut('ddusa.radio',{mode:v})});optionGroup('helpDevice',v=>renderHelp(v));$('radioTest').onclick=()=>{sound.start();crew.say('preview',5,true)};const savedVoice=storageGet('ddusa.radio');if(savedVoice&&['radio','system','off'].includes(savedVoice.mode)){crew.mode=savedVoice.mode;document.querySelectorAll('#voiceChoice button').forEach(b=>b.classList.toggle('active',b.dataset.value===crew.mode))}
function selectCar(n){cfg.car=n;document.querySelectorAll('[data-car]').forEach(x=>x.classList.toggle('active',Number(x.dataset.car)===n));$('carInfo').textContent=carSpecs[n].desc;$('carCaption').textContent=carSpecs[n].number+' / '+carSpecs[n].name}
document.querySelectorAll('[data-car]').forEach(b=>b.addEventListener('click',()=>{selectCar(Number(b.dataset.car));readRecord();savePrefs()}));
// HUD buttons let go of focus after a click, so Space (slide) never presses them again.
const hudButton=(id,fn)=>{$(id).onclick=()=>{fn();$(id).blur()}};
$('startBtn').onclick=startRace;$('againBtn').onclick=startRace;$('restartBtn').onclick=startRace;$('titleBtn').onclick=toTitle;$('quitBtn').onclick=toTitle;$('resumeBtn').onclick=resume;hudButton('pauseBtn',pause);hudButton('cameraBtn',toggleCamera);hudButton('muteBtn',()=>sound.setMute(!sound.muted));$('volume').oninput=e=>{sound.setVolume(Number(e.target.value)/100);savePrefs()};$('helpBtn').onclick=openHelp;$('closeHelp').onclick=closeHelp;$('settingsBtn').onclick=()=>kit.menu.open();$('menuSettingsBtn').onclick=()=>kit.menu.open();
function fullScreen(){try{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{})}catch(e){}}
addEventListener('blur',()=>{clearInput();pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause()}sound.block('hidden',document.hidden)});
// Browsers only start audio after a gesture: unlock on the first key, click or tap anywhere.
const unlockAudio=()=>{if(!sound.blocked.size)sound.start()};for(const type of ['pointerdown','keydown','touchend'])addEventListener(type,unlockAudio,true);
// The settings panel pauses the loop: pause the race behind it and silence the mix until it closes.
kit.onPause(on=>{if(on){if(state==='race'||state==='countdown')pause();if(window.speechSynthesis)speechSynthesis.cancel()}sound.block('menu',on)});

function applyPrefs(){
 const p=storageGet(PREFS_KEY)||{};
 if([0,1,2].includes(p.car))cfg.car=p.car;if(['auto','manual'].includes(p.trans))cfg.trans=p.trans;if(['tour','arcade','pro'].includes(p.difficulty))cfg.difficulty=p.difficulty;if(['race','trial'].includes(p.mode))cfg.mode=p.mode;
 if([0,1,2].includes(p.camera))cameraMode=p.camera;if(typeof p.music==='boolean')sound.music=p.music;if(Number.isFinite(p.volume))sound.volume=clamp(p.volume,0,1);
 selectCar(cfg.car);setActive('transChoice',cfg.trans);setActive('difficultyChoice',cfg.difficulty);setActive('modeChoice',cfg.mode);setActive('musicChoice',sound.music?'on':'off');
 document.body.classList.toggle('manual-controls',cfg.trans==='manual');$('volume').value=String(Math.round(sound.volume*100));$('cameraBtn').textContent=['CLOSE / C','BUMPER / C','FAR / C'][cameraMode];
 applyCourse(p.course==='rev'?'rev':'fwd');setActive('courseChoice',cfg.course);
 if(p.muted===true)sound.setMute(true);
}

// Read-only diagnostics. The test harness is active only with ?test in the URL.
window.DaysOfDaytona={version:'12.1.0',get state(){return state},get telemetry(){return{state,mode:cfg.mode,course:cfg.course,s:player.s,speed:player.v,x:player.x,lap:Math.min(3,lapTimes.length+1),rank:raceRank,clock,elapsed,gear:player.gear,drift:player.drift,draft:player.draft,trackLength:L,frames:frameId,fieldSize:1+rivals.length,countdown,ghost:ghostBest?{lap:ghostBest.lap,delta:ghostDeltaNow()}:null,performance:{pairChecks:auditCounters.pairChecks,fullPairChecks:auditCounters.fullPairChecks,drawCalls:kit.renderer.info.render.calls},stats:{...raceStats},radioLines:crew.history.length,camera:['close','bumper','far'][cameraMode],battle:battle.active?.profile.tag||null,battleWins:battle.won,timeScale:battle.scale,rivalDefense:battle.active?battle.active.id-33:0,rivalSpeed:battle.active?battle.active.v:null,battlePlayerEdge:battle.active?battle.active.playerEdge||0:0,battleRivalEdge:battle.active?battle.active.rivalEdge||0:0,battleEdge:battle.active?battle.active.edgeKind||null:null,damage:damage?{incidents:damage.incidents,speedLossKmh:Math.round(damage.speedLoss*3.6),steering:damage.steer,grip:damage.grip,brake:damage.brake,visibility:damage.visibility,control:damageControlPct(),history:[...damage.history]}:null}}};
if(new URLSearchParams(location.search).has('test'))window.__test={start:startRace,tick,render,getPlayer:()=>player,getRivals:()=>rivals,getFrame:frame,getConfig:()=>cfg,getLaps:()=>lapTimes,getStats:()=>({...raceStats}),getCrew:()=>({history:crew.history,mode:crew.mode,active:crew.active,cache:crew.cache.size,queue:crew.queue.map(q=>q.id)}),getCamera:()=>({eye:cameraPos,target:cameraTarget,mode:cameraMode,rig:state==='countdown'?startCameraPose():localRaceCamera(cameraMode,player.v)}),getControls:()=>({...ctl}),getCountdown:()=>countdown,setState:s=>state=s,setCountdown:t=>countdown=t,setClock:t=>clock=t,setCamera:m=>{cameraMode=m;cameraPos=null;cameraTarget=null},setQuiet:()=>{sound.setMute(true);crew.mode='off'},setElapsed:t=>elapsed=t,crewSay:id=>crew.say(id,5,true),solveContacts,updateRivals,decideRival,trackPasses,getBattle:()=>battle,nextChampion,beginBattle,openRival,applyBattleEdge,updateBattles,planRivalPace,rivalTopSpeed,battleCruiseSpeed,getRivalMoves:()=>RIVAL_MOVES,getCarSpecs:()=>carSpecs,updatePlayer,getSound:()=>sound,getDamage:()=>damage,applyDamage:applyPlayerDamage,getRadio:()=>crew,getBank:()=>CREW_BANK,getCounters:()=>({...auditCounters}),nearbyContactPairs,resolvePlayerWall,ordinalSuffix,computeFrame,toggleCamera,localRaceCamera,projectToScreen,roadPos,setCourse:v=>{applyCourse(v);updateCourseUI()},setMode:v=>{cfg.mode=v;updateCourseUI()},getGhost:()=>ghostBest,finish:()=>{player.s=L*3;lapTimes=[30,31];lapStart=61;elapsed=92;tick(1/90)},timeout:()=>{state='race';clock=.001;tick(1/90)},pause,resume,toTitle,resetCamera:()=>{cameraPos=null;cameraTarget=null},step:seconds=>{for(let i=0;i<Math.ceil(seconds*90);i++)tick(1/90)}};

// ---- Start ------------------------------------------------------------------------------------
applyPrefs();updateCourseUI();updatePrompts();readRecord();renderHelp('keyboard');showScreen('menu',true);updateTouchUI();placeTouchPills();
// Compile every pipeline up front (the ghost, sparks and skids appear later), so nothing hitches mid-race.
kit.loading.progress(.9,'Warming up the engines…');
render(1/60);
{const warm=[ghostObj,skidObj,smokeInst,sparkInst,shadowInst,brakeObj,courseFwdObj,courseRevObj,...carInst.filter(Boolean)],was=warm.map(o=>o.visible);for(const o of warm){o.visible=true;if(o.isInstancedMesh&&!o.count)o.count=1}try{await kit.renderer.compileAsync(scene,camera)}catch(e){console.warn('[daytona] compile warm-up skipped:',e?.message||e)}warm.forEach((o,i)=>{o.visible=was[i];if(o.isInstancedMesh&&!was[i])o.count=0})}
const STEP=1/90;let accumulator=0;
kit.start(dt=>{
 handleInput();readControls();
 accumulator+=dt;let steps=0;while(accumulator>=STEP&&steps<12){tick(STEP);accumulator-=STEP;steps++}if(steps>=12)accumulator=0;
 render(Math.max(.001,dt));
});
