// HOVER DUTY — Night Freight. All geometry, textures, sound and game code are local.
// Reference: G-Police (1997), PC. These are original missions, not an exact port.
// Mouse steering, reduced difficulty and a readable fog range are deliberate adaptations.
//
// Rendering runs on the shared 3D stack: three.js r186 WebGPURenderer (WebGL2 fallback),
// started by kit/boot.js. The original hand-written WebGL shader lives on as five node
// materials (lit hull, procedural windows, emissive, sign atlas, ground) that keep its fixed
// sun, height-tinted fog and both-sided faces. The sky is a TSL dome and the old FBO chain
// (bright-pass blur, vignette, scanline, grain, damage glow) is a kit/post.js output chain.
// Colours go to the screen unconverted, exactly as the original drew them.
import * as THREE from 'three/webgpu';
import * as T from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';

const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>mul(a,1/(len(a)||1));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const pmod=(a,n)=>((a%n)+n)%n;
let seed=9017;
function rng(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const rnd=(a,b)=>a+(b-a)*rng();
function basis(yaw,pitch,roll=0){let f=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],r=[Math.cos(yaw),0,Math.sin(yaw)],u=cross(r,f);if(roll){const rr=add(mul(r,Math.cos(roll)),mul(u,Math.sin(roll)));u=add(mul(u,Math.cos(roll)),mul(r,-Math.sin(roll)));r=rr;}return {f,r,u};}
// The same basis written into existing arrays (no allocation), for per-frame use.
function basisInto(o,yaw,pitch,roll){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),f=o.f,r=o.r,u=o.u;
 f[0]=sy*cp;f[1]=sp;f[2]=-cy*cp;r[0]=cy;r[1]=0;r[2]=sy;
 u[0]=r[1]*f[2]-r[2]*f[1];u[1]=r[2]*f[0]-r[0]*f[2];u[2]=r[0]*f[1]-r[1]*f[0];
 if(roll){const c=Math.cos(roll),s=Math.sin(roll),r0=r[0]*c+u[0]*s,r1=r[1]*c+u[1]*s,r2=r[2]*c+u[2]*s;u[0]=u[0]*c-r[0]*s;u[1]=u[1]*c-r[1]*s;u[2]=u[2]*c-r[2]*s;r[0]=r0;r[1]=r1;r[2]=r2;}
 return o;}
function formatTime(t){t=Math.max(0,t);return Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');}

// ---------------------------------------------------------------- saved progress
const store=(()=>{const KEY='hoverDuty.v2';let data={};try{data=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){data={};}
 return{get:(k,d)=>(data[k]===undefined?d:data[k]),set(k,v){data[k]=v;try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}}};})();

// ---------------------------------------------------------------- boot
// The original never converted colours for the screen: keep linear output and raw colours.
THREE.ColorManagement.enabled=false;
const kit=await boot({
 title:'HOVER DUTY — Night Freight',accent:'#ffbd73',background:'#09131c',
 canvas:$('view'),
 gear:'none',                                   // Settings lives in the top bar and the pause panel
 touch:{top:'left',topOffset:150,hint:true},    // altitude pills sit under the objective panel
 input:{
  fire:{keys:['KeyJ'],mouse:[0],gamepad:['RT'],touch:'Fire'},
  missile:{keys:['KeyK'],mouse:[2],gamepad:['LT','B'],touch:'Missile'},
  brake:{keys:['Space'],gamepad:['A'],touch:'Brake'},
  boost:{keys:['ShiftLeft','ShiftRight'],gamepad:['Y','LS'],touch:'Boost'},
  scan:{keys:['KeyF'],gamepad:['X'],touch:'Scan'},
  move:{type:'vector',keys:{up:['KeyW'],down:['KeyS'],left:['KeyA'],right:['KeyD']},gamepad:'leftStick',touch:'stick'},
  look:{type:'look',mouse:'drag',gamepad:'rightStick',touch:'drag'},
  steer:{type:'vector',keys:{up:['ArrowUp'],down:['ArrowDown'],left:['ArrowLeft'],right:['ArrowRight']},gamepad:'dpad',clamp:false},
  lift:{type:'axis',keys:{pos:['KeyE'],neg:['KeyQ']},gamepad:{pos:'RB',neg:'LB'},touch:{pos:'▲ Up',neg:'▼ Down',slot:'top'}},
  pause:{keys:['Escape','KeyP'],gamepad:['Start']},
  restart:{keys:['KeyR']},
  mute:{keys:['KeyM']},
  confirm:{keys:['Enter','NumpadEnter'],gamepad:['A']},
  back:{gamepad:['B']},
  menu:{type:'vector',keys:'arrows',gamepad:'leftStick+dpad'},
 },
});
const input=kit.input;
const canvas=kit.canvas;
kit.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
kit.loading.progress(.62,'Building the dome…');

const hc=$('hud'),ctx=hc.getContext('2d');

// ---------------------------------------------------------------- scene, camera, materials
const scene=new THREE.Scene();
scene.background=new THREE.Color(.06,.1,.15);
const camera=kit.fitCamera(new THREE.PerspectiveCamera(.99*180/Math.PI,1,.6,1300));
camera.rotation.order='YXZ';
scene.add(camera);

const SIGN_NAMES=[['EAST DOCK','07 / FREIGHT TERMINAL'],['MOTH','NOODLE HOUSE / OPEN ALL NIGHT'],['VANTA','LOGISTICS / WE MOVE THE DARK'],['CIVIC AIR','09 / PATROL DIVISION'],['KITE','LIVE ABOVE IT ALL'],['NIGHT MARKET','EAT / REST / REPEAT'],['OXYGEN','BREATHE EASY'],['DOCK 07','AUTHORIZED CARGO ONLY'],['H','CIVIC AIR / LANDING'],['SLOW','AIR TRAFFIC BELOW 60 M'],['SECTOR 07','LOWER EAST / INDUSTRIAL'],['VERGE','THE FUTURE IS RENTED'],['PORTAL N','DOME SERVICE GATE / NO CIVIL TRAFFIC'],['VANTA','HAULER 3 / BONDED FREIGHT']];
const ATLAS_W=1024,ATLAS_H=1152;
function makeAtlas(){let c=document.createElement('canvas');c.width=ATLAS_W;c.height=ATLAS_H;let a=c.getContext('2d');a.fillStyle='#0c171f';a.fillRect(0,0,ATLAS_W,ATLAS_H);for(let i=0;i<SIGN_NAMES.length;i++){let x=i%2*512,y=Math.floor(i/2)*160;let amber=i%3===0;a.fillStyle=amber?'#102027':'#0c2029';a.fillRect(x+4,y+4,504,152);a.strokeStyle=amber?'#e4a86e':'#79c9cc';a.lineWidth=3;a.strokeRect(x+11,y+11,490,138);a.fillStyle=amber?'#ffc083':'#c5efee';a.textAlign='center';a.textBaseline='middle';a.font='bold '+(SIGN_NAMES[i][0].length>12?39:54)+'px Arial';a.fillText(SIGN_NAMES[i][0],x+256,y+66);a.font='17px monospace';a.fillStyle=amber?'#d99763':'#6fb8c4';a.fillText(SIGN_NAMES[i][1],x+256,y+113);a.fillRect(x+31,y+133,450,2);}
 const t=new THREE.CanvasTexture(c);t.flipY=false;t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;return t;}
const atlasTex=makeAtlas();

// The original world shader, one material per surface kind (0 lit, 1 windows, 2 emissive,
// 3 sign atlas, 4 ground). Faces draw from both sides and keep their own normals, as before.
const LDIR=T.vec3(-.6,.8,.3).normalize();
const hash2=T.Fn(([p])=>T.fract(T.sin(T.dot(p,T.vec2(127.1,311.7))).mul(43758.5453)));
function worldMat(kind){
 const m=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,fog:false});
 const c=T.attribute('vcol','vec3');
 const nW=T.modelNormalMatrix.mul(T.normalLocal).normalize();
 const light=T.varying(T.vec3(.50,.61,.71).add(T.vec3(.65,.59,.52).mul(T.dot(nW,LDIR).max(0))));
 const p=T.positionWorld;
 let col;
 if(kind===2)col=c.mul(1.35);
 else if(kind===3)col=T.texture(atlasTex,T.uv()).rgb.mul(1.18);
 else if(kind===4){
  const road=T.float(1).sub(T.smoothstep(39,46,T.abs(p.x)));
  const grain=hash2(T.floor(p.xz.mul(3))).mul(.016);
  col=c.mul(light).add(grain);
  const patches=T.sin(p.x.mul(.11).add(p.z.mul(.31))).mul(T.sin(p.z.mul(.19)));
  col=col.add(T.vec3(.024,.060,.071).mul(road).mul(patches.mul(.4).add(.5)));
  const rim=T.exp(T.abs(T.abs(p.x).sub(38)).mul(-.22));
  col=col.add(T.vec3(.03,.11,.13).mul(rim).mul(T.sin(p.z.mul(.13)).mul(.4).add(.45)));
 }else{
  col=c.mul(light);
  if(kind===1){
   const U=T.uv(),g=T.vec2(4.3,5.1),cell=T.floor(U.div(g)),q=T.mod(U,g);
   const lit=T.step(.5,hash2(cell.add(T.floor(c.x.mul(100)))));
   const w=T.step(.72,q.x).mul(T.step(q.x,2.95)).mul(T.step(1.3,q.y)).mul(T.step(q.y,3.15)).mul(lit);
   const lamp=T.mix(T.vec3(.33,.68,.73),T.vec3(1,.64,.30),T.step(.47,hash2(T.floor(c.yz.mul(73)).add(1))));
   col=col.mul(T.step(.16,T.mod(U.y,5.1)).mul(.20).add(.78));
   col=col.add(lamp.mul(w).mul(hash2(cell.add(7)).mul(.4).add(.52)));
   col=col.add(lamp.mul(w).mul(T.step(.75,hash2(cell.add(10)))).mul(.27));
  }
 }
 const fogC=T.mix(T.vec3(.063,.115,.15),T.vec3(.076,.09,.139),T.clamp(p.y.div(260),0,1));
 let amount=T.smoothstep(90,640,T.length(p.sub(T.cameraPosition)));
 if(kind===2||kind===3)amount=amount.mul(.86);
 m.colorNode=T.vec4(T.mix(col,fogC,amount),1);
 return m;
}
const MATS=[0,1,2,3,4].map(worldMat);

// Sky: the original full-screen gradient, aurora bands, stars and ringed planet, on a dome
// that follows the camera and draws first without depth.
const skyMat=new THREE.MeshBasicNodeMaterial({side:THREE.BackSide,depthTest:false,depthWrite:false,fog:false});
const vDir=T.varying(T.positionLocal);
skyMat.colorNode=T.Fn(()=>{
 const d=T.normalize(vDir).toVar();
 const col=T.mix(T.vec3(.079,.14,.175),T.vec3(.019,.026,.064),T.smoothstep(-.05,.85,d.y)).toVar();
 const bands=T.sin(d.x.mul(6).add(d.z.mul(5)).add(T.sin(d.y.mul(9)))).mul(.5).add(.5);
 col.addAssign(T.vec3(.04,.007,.035).mul(bands).mul(T.smoothstep(0,.6,d.y)));
 const st=T.vec2(T.atan(d.z,d.x),T.asin(d.y)).mul(240).toVar();
 const star=T.step(.994,hash2(T.floor(st)));
 const twinkle=T.pow(T.max(T.float(0),T.float(1).sub(T.length(T.fract(st).sub(.5)).mul(2))),4);
 col.addAssign(T.vec3(.3,.42,.48).mul(star).mul(twinkle).mul(T.smoothstep(.10,.8,d.y)));
 const pd=T.acos(T.clamp(T.dot(d,T.vec3(.50945,.40548,-.75898)),-1,1)).toVar();
 const disk=T.float(1).sub(T.smoothstep(.107,.109,pd));
 const b=T.sin(d.y.mul(180)).mul(.12).add(.72).add(T.sin(d.y.mul(430).add(d.x.mul(25))).mul(.06));
 const shade=T.clamp(d.x.sub(.50945).add(.15).mul(4),.12,1);
 col.assign(T.mix(col,T.vec3(.39,.29,.24).mul(b).mul(shade),disk.mul(.8)));
 col.addAssign(T.vec3(.13,.073,.05).mul(T.exp(pd.mul(-18))).mul(.13));
 return T.vec4(col,1);
})();
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),skyMat);
sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);

// Post: the original bright-pass (scene clamped to 1, minus .45) blurred at quarter size and
// added at .55, then vignette, scanline, film grain and the red damage edge.
const uDamage=T.uniform(0);
let glowNode=null;
const post=createPost(kit,scene,camera,{bloom:false,output:(color)=>{
 const base=T.min(color.rgb,T.vec3(1));
 if(!glowNode){
  const bright=T.rtt(T.vec4(T.max(base.sub(.45),T.vec3(0)),1),null,null,{resolutionScale:.5});
  glowNode=gaussianBlur(bright,T.float(1.4),2,{resolutionScale:.5});
 }
 const d=T.screenUV.sub(.5);
 let c=base.add(glowNode.rgb.mul(.55));
 c=c.mul(T.float(1).sub(T.dot(d,d).mul(.37)));
 c=c.mul(T.sin(T.screenUV.y.mul(T.screenSize.y).mul(3.14159)).mul(.005).add(.995));
 const grain=T.fract(T.sin(T.dot(T.screenUV.add(T.fract(T.time)),T.vec2(12.9898,78.233))).mul(43758.5453)).sub(.5);
 c=c.add(grain.mul(.009));
 c=c.add(T.vec3(.38,.035,.018).mul(uDamage).mul(T.clamp(T.length(d).mul(1.4),.05,1)));
 return T.vec4(c,1);
}});

// ---------------------------------------------------------------- geometry builders
const STRIDE=11; // position 3, normal 3, colour 3, uv 2
function setAttrs(geo,ib){geo.setAttribute('position',new THREE.InterleavedBufferAttribute(ib,3,0));geo.setAttribute('normal',new THREE.InterleavedBufferAttribute(ib,3,3));geo.setAttribute('vcol',new THREE.InterleavedBufferAttribute(ib,3,6));geo.setAttribute('uv',new THREE.InterleavedBufferAttribute(ib,2,9));}
// Build-time mesh builder with the original API. Vertices are sorted by surface kind, and
// each kind becomes one geometry group drawn with its material.
class Mesh{
 constructor(){this.b=[[],[],[],[],[]];}
 vert(p,n,c,uv,m=0){this.b[m].push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],uv?uv[0]:0,uv?uv[1]:0);}
 tri(a,b,c,col,m=0,uvs=null){let n=norm(cross(sub(b,a),sub(c,a)));this.vert(a,n,col,uvs?uvs[0]:null,m);this.vert(b,n,col,uvs?uvs[1]:null,m);this.vert(c,n,col,uvs?uvs[2]:null,m);}
 quad(a,b,c,d,col,m=0,sz=null,tex=null){let u=sz?sz[0]:dist(a,b),v=sz?sz[1]:dist(a,d),t=tex||[[0,0],[u,0],[u,v],[0,v]];this.tri(a,b,c,col,m,[t[0],t[1],t[2]]);this.tri(a,c,d,col,m,[t[0],t[2],t[3]]);}
 box(x,y,z,w,h,d,c,m=0,yaw=0){const f=(a,b,e)=>[x+a*Math.cos(yaw)+e*Math.sin(yaw),y+b,z-a*Math.sin(yaw)+e*Math.cos(yaw)];w/=2;h/=2;d/=2;let p=[f(-w,-h,-d),f(w,-h,-d),f(w,h,-d),f(-w,h,-d),f(-w,-h,d),f(w,-h,d),f(w,h,d),f(-w,h,d)];this.quad(p[4],p[5],p[6],p[7],c,m);this.quad(p[1],p[0],p[3],p[2],c,m);this.quad(p[0],p[4],p[7],p[3],c,m);this.quad(p[5],p[1],p[2],p[6],c,m);this.quad(p[7],p[6],p[2],p[3],mul(c,1.12),0);this.quad(p[0],p[1],p[5],p[4],mul(c,.65),0);}
 rod(a,b,r,c,m=0,sides=5){const axis=norm(sub(b,a));let x=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),y=cross(axis,x);for(let i=0;i<sides;i++){let t=i/sides*Math.PI*2,t2=(i+1)/sides*Math.PI*2;let p=add(mul(x,Math.cos(t)*r),mul(y,Math.sin(t)*r)),q=add(mul(x,Math.cos(t2)*r),mul(y,Math.sin(t2)*r));this.quad(add(a,p),add(a,q),add(b,q),add(b,p),c,m);}}
 ring(x,y,z,r,c,m=2,width=.3){for(let i=0;i<64;i++){let a=i/64*Math.PI*2,b=(i+1)/64*Math.PI*2;this.quad([x+Math.cos(a)*(r-width),y,z+Math.sin(a)*(r-width)],[x+Math.cos(b)*(r-width),y,z+Math.sin(b)*(r-width)],[x+Math.cos(b)*(r+width),y,z+Math.sin(b)*(r+width)],[x+Math.cos(a)*(r+width),y,z+Math.sin(a)*(r+width)],c,m);}}
 sign(x,y,z,w,h,id,yaw=0){let xx=[Math.cos(yaw)*w/2,0,-Math.sin(yaw)*w/2];let a=[x-xx[0],y-h/2,z-xx[2]],b=[x+xx[0],y-h/2,z+xx[2]],c=[x+xx[0],y+h/2,z+xx[2]],d=[x-xx[0],y+h/2,z-xx[2]];let u=(id%2*512+6)/ATLAS_W,v=(Math.floor(id/2)*160+5)/ATLAS_H,uu=u+500/ATLAS_W,vv=v+150/ATLAS_H;this.quad(a,b,c,d,[1,1,1],3,null,[[u,vv],[uu,vv],[uu,v],[u,v]]);}
 appendAt(other,px,py,pz){for(let k=0;k<5;k++){const s=other.b[k],d=this.b[k];for(let i=0;i<s.length;i+=STRIDE){d.push(s[i]+px,s[i+1]+py,s[i+2]+pz);for(let j=3;j<STRIDE;j++)d.push(s[i+j]);}}}
 count(){let n=0;for(const a of this.b)n+=a.length;return n/STRIDE;}
 geometry(){let total=0;for(const a of this.b)total+=a.length;const data=new Float32Array(total),geo=new THREE.BufferGeometry();let off=0;for(let k=0;k<5;k++){const a=this.b[k];if(!a.length)continue;data.set(a,off);geo.addGroup(off/STRIDE,a.length/STRIDE,k);off+=a.length;}setAttrs(geo,new THREE.InterleavedBuffer(data,STRIDE));geo.computeBoundingSphere();return geo;}
}

// ---------------------------------------------------------------- the city
const buildings=[],traffic=[];
let city=new Mesh();
const C={steel:[.095,.145,.19],dark:[.046,.074,.099],metal:[.18,.23,.26],amber:[.92,.51,.21],cyan:[.16,.66,.70],red:[.86,.17,.10],white:[.64,.77,.76]};
const HOME=[0,4,174],CARGO=[0,4,-155];
function solid(x,z,w,h,d,c=C.steel,windows=true){city.box(x,h/2,z,w,h,d,c,windows?1:0);buildings.push({x,z,w:w/2,d:d/2,h});if(h>35){city.box(x,h+.6,z,w+1.2,1.2,d+1.2,mul(c,.76));city.box(x+3,h+2,z-2,w*.42,4,d*.35,mul(c,.72));}if(h>90){city.rod([x,h+4,z],[x,h+18,z],.35,C.metal);city.box(x,h+18,z,1.1,.7,1.1,C.red,2);}}
function buildCity(){seed=9017;
 city.box(0,-2,0,1250,4,1250,[.035,.057,.072],4);
 // Street grid, road markings, kerbs and inlaid lane lights.
 city.box(0,.018,0,88,.035,840,[.027,.045,.059],4);
 for(let z=-410;z<410;z+=13){city.box(-3,.055,z,.5,.025,5,[.23,.30,.30],2);city.box(3,.055,z,.5,.025,5,[.23,.30,.30],2);if(z<-230||z>-80&&z<100){for(let x of [-42,42])city.box(x,.08,z,.45,.04,6,[.07,.37,.41],2);}}
 for(let z=-350;z<350;z+=80){city.box(0,.03,z+40,900,.035,26,[.029,.049,.062],4);for(let x=-390;x<400;x+=18)city.box(x,.06,z+40,7,.025,.35,[.17,.24,.26]);}
 // Low-poly blocks with procedural windows, roof plant and advertising.
 for(let x of [-350,-272,-194,-116,-69,69,116,194,272,350]){
  for(let z of [-350,-270,-190,-110,-30,50,130,210,290,370]){
   if(Math.hypot(x,z)>485)continue;
   if(Math.abs(x)<140&&((z>=110&&z<=220)||(z>=-210&&z<=-90)))continue;
   if(Math.abs(x)===116&&z>-90&&z<90)continue;
   let w=Math.abs(x)===69?38:rnd(36,53),d=rnd(38,55),h=rnd(31,148);
   if(Math.abs(x)===69)h=rnd(80,156);
   if(Math.abs(x)>220)h*=1.25;
   let col=[rnd(.070,.120),rnd(.11,.17),rnd(.16,.225)];
   solid(x,z,w,h,d,col);
   if(rng()>.38){let yy=h*.78;city.box(x,yy,z,w+1.0,1.0,d+1.0,rng()>.5?[.09,.38,.42]:[.43,.24,.115],2);}
   if(rng()>.4){let id=Math.floor(rnd(1,8));if(x>0){city.sign(x-w/2-.08,Math.min(h-10,35+rnd(0,12)),z,Math.min(d-4,36),11,id,-Math.PI/2);}else{city.sign(x+w/2+.08,Math.min(h-10,36+rnd(0,18)),z,Math.min(d-4,36),11,id,Math.PI/2);}}
   if(rng()>.70){city.box(x,h+6,z,14,8,14,C.dark);city.rod([x,h+10,z],[x,h+24,z],.25,C.metal);}
  }
 }
 // Distinctive skyline towers and a glazed skybridge above the main route.
 solid(-181,-258,48,186,50,[.10,.14,.20]);city.sign(-181,143,-232.9,42,16,11);
 solid(188,-172,64,175,50,[.10,.17,.21]);city.sign(188,142,-146.9,51,18,4);
 city.box(0,68,-34,137,7,14,[.065,.12,.15],1);city.box(0,64,-34,140,1.5,16,C.dark);city.box(0,72,-34,140,1,16,C.dark);city.box(0,67,-26.8,127,.5,.2,[.20,.52,.57],2);
 buildings.push({x:0,z:-34,w:68.5,d:7,h:71.5,minY:64.5});
 // East Dock: a low freight terminal, gantry, stacks and loading bays.
 solid(-94,-163,46,23,106,[.13,.16,.19],false);city.sign(-70.8,15,-145,42,11,7,Math.PI/2);
 solid(88,-173,46,32,115,[.13,.17,.20],false);city.sign(64.8,21,-173,52,12,0,-Math.PI/2);
 city.box(88,33,-173,48,1,117,[.21,.35,.36]);
 solid(0,-224,111,34,19,[.11,.16,.20],false);city.sign(0,22,-214.3,78,17,0);
 for(let x of [-38,-20,21,39]){city.box(x,8,-214,13,16,1,C.dark);city.box(x,16.3,-213.4,14,.7,.25,C.amber,2);}
 for(let x of [-46,46]){city.box(x,24,-96,2,48,2,C.metal);city.box(x,47,-96,4,2,4,C.amber,2);buildings.push({x,z:-96,w:1,d:1,h:48});}
 city.box(0,47,-96,94,2,3,C.metal);city.sign(0,43,-94.4,48,7,7);
 buildings.push({x:0,z:-96,w:47,d:1.5,h:48,minY:46});
 for(let i=0;i<13;i++){let x=(i%2?1:-1)*(32+(i%3)*9),z=-124-Math.floor(i/2)*11;city.box(x,3.5,z,8,7,17,i%3===0?[.20,.29,.30]:[.25,.16,.13]);for(let a=-3;a<=3;a+=1.5)city.box(x+a,3.5,z+8.56,.13,6.5,.12,[.33,.31,.25]);buildings.push({x,z,w:4,d:8.5,h:7});}
 for(let x of [-50,50]){city.rod([x,0,-119],[x,61,-119],.7,C.metal,0,6);city.rod([x,61,-119],[x*.35,61,-172],.8,C.metal,0,6);city.rod([x*.35,61,-172],[x*.35,26,-172],.13,[.29,.33,.31]);}
 // Home pad, civic hangar and approach lights.
 city.box(0,.4,174,68,.8,69,[.075,.12,.135]);city.ring(0,.83,174,25,[.14,.55,.58],2,.4);city.ring(0,.84,174,22,[.13,.26,.30],0,.14);
 city.box(-6,.87,174,2.4,.06,16,[.44,.66,.65],2);city.box(6,.87,174,2.4,.06,16,[.44,.66,.65],2);city.box(0,.87,174,10,.06,2.6,[.44,.66,.65],2);
 for(let i=0;i<12;i++){let a=i/12*Math.PI*2;city.box(Math.cos(a)*30,1,174+Math.sin(a)*30,1.2,.8,1.2,C.cyan,2);}
 solid(-72,185,53,32,86,[.09,.15,.19],false);city.sign(-44.9,21,174,42,13,3,Math.PI/2);city.box(-45.1,5,174,.2,9,45,C.dark);
 solid(73,184,40,27,86,[.10,.155,.19],false);city.sign(52.8,18,169,34,10,8,-Math.PI/2);
 city.box(0,1,211,65,2,1.5,[.20,.31,.33]);for(let x=-26;x<=26;x+=13)city.box(x,2.2,211,4,.4,.7,C.amber,2);
 // Road lights, service pipes and background ground traffic.
 for(let z=-320;z<360;z+=41){for(let side of [-1,1]){let x=side*44;if(z>100&&z<235||z< -90&&z> -240)continue;city.rod([x,0,z],[x,17,z],.32,[.16,.23,.26]);city.rod([x,17,z],[x-side*5,17,z],.25,C.metal);city.box(x-side*4,16.8,z,4,.4,1.1,[.50,.65,.60],2);}}
 for(let s of [-1,1]){city.rod([s*55,4,78],[s*55,4,-78],1.1,[.17,.22,.24],0,8);}
 for(let i=0;i<18;i++){traffic.push({x:(i%2?1:-1)*rnd(14,24),z:rnd(-405,405),y:.95,speed:(i%2?1:-1)*rnd(8,17),air:false,color:i%4});}
 for(let i=0;i<7;i++)traffic.push({x:rnd(-320,320),z:rnd(-230,280),y:rnd(92,165),speed:rnd(12,22),air:true,color:i%4});
 // Habitat ribs arch over the colony. They are structure, not a sky texture.
 const r=580;
 for(let j=0;j<18;j++){let a=j/18*Math.PI*2;for(let i=0;i<28;i++){let t=i/28*Math.PI/2,t2=(i+1)/28*Math.PI/2;let p=[Math.cos(a)*Math.cos(t)*r,Math.sin(t)*r,Math.sin(a)*Math.cos(t)*r],q=[Math.cos(a)*Math.cos(t2)*r,Math.sin(t2)*r,Math.sin(a)*Math.cos(t2)*r];city.rod(p,q,.55,[.075,.145,.18],2,3);}}
 for(let j=1;j<6;j++){let y=j*90,rr=Math.sqrt(r*r-y*y);for(let i=0;i<96;i++){let a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2;city.rod([Math.cos(a)*rr,y,Math.sin(a)*rr],[Math.cos(b)*rr,y,Math.sin(b)*rr],.42,[.052,.115,.148],2,3);}}
 // Dome base wall and the luminous north service portal (Case 08's escape gate).
 for(let i=0;i<72;i++){let a=i/72*Math.PI*2,b=(i+1)/72*Math.PI*2;city.quad([Math.cos(a)*482,0,Math.sin(a)*482],[Math.cos(b)*482,0,Math.sin(b)*482],[Math.cos(b)*482,26,Math.sin(b)*482],[Math.cos(a)*482,26,Math.sin(a)*482],[.073,.11,.145]);}
 for(let s of [-1,1]){city.box(s*16,15,-474,3,30,4,C.metal);city.box(s*14.2,15,-471.9,.4,28,.3,C.amber,2);}
 city.box(0,31.5,-474,35,3,4,C.metal);city.box(0,29.3,-471.9,28,.4,.3,C.amber,2);
 city.box(0,14,-476.5,29,28,.4,[.03,.12,.14],2);
 city.sign(0,37,-471.8,30,6,12);
 // The cargo truck at East Dock never moves, so it is part of the static city.
 city.appendAt(makeCargo(),0,.2,-155);
}

// ---------------------------------------------------------------- models
function makeShip(friendly=false){let m=new Mesh();let body=friendly?[.20,.31,.36]:[.39,.19,.15],trim=friendly?C.cyan:C.red;
 m.box(0,0,0,3.2,2,7.5,body);m.box(0,.9,-1,2.6,1.3,3.3,[.10,.16,.21]);m.quad([-1.35,.5,-3.6],[1.35,.5,-3.6],[1.0,1.6,-1.6],[-1.0,1.6,-1.6],[.06,.24,.29],2);
 m.tri([-1.6,0,-3.7],[1.6,0,-3.7],[0,-.55,-5.2],body);m.tri([-1.6,0,-3.7],[0,.55,-4.6],[1.6,0,-3.7],body);
 m.box(0,-.05,.65,9.8,.55,2.4,body);for(let s of [-1,1]){m.box(s*4.7,-.1,.55,1.7,1.3,3.9,[.13,.18,.22]);m.rod([s*4.7,-.15,-2],[s*4.7,-.15,3.2],1.05,[.23,.26,.26],0,8);m.box(s*4.7,.87,.4,.78,.08,2.8,friendly?[.58,.68,.66]:[.43,.24,.15]);for(let j=0;j<8;j++){let a=j/8*Math.PI*2,b=(j+1)/8*Math.PI*2;m.rod([s*4.7+Math.cos(a)*.86,-.15+Math.sin(a)*.86,-2.08],[s*4.7+Math.cos(b)*.86,-.15+Math.sin(b)*.86,-2.08],.035,mul(trim,.4),2,3);}m.box(s*4.7,-.35,3.25,1.4,1.3,.1,trim,2);m.rod([s*1.35,-.8,-2],[s*1.35,-.8,-6.3],.22,[.23,.27,.26],0,6);m.box(s*1.35,-.8,-6.3,.35,.35,.2,[.36,.41,.38]);m.box(s*5.4,.25,0,.15,.3,2.2,trim,2);m.quad([s*1.2,.7,2.2],[s*1.2,2.3,3.2],[s*1.2,2.3,4.3],[s*1.2,.7,3.9],body);}
 m.box(0,1.9,.9,1.6,.15,.5,trim,2);return m;
}
function makeVan(){let m=new Mesh();m.box(0,2.1,0,4.6,3.8,9,[.14,.25,.29]);m.box(0,2.9,-3.3,4.3,2,2.5,[.23,.33,.36]);m.box(0,3.3,-4.61,3.7,1.1,.05,[.09,.30,.36],2);m.box(0,4.22,-1,3,.3,1,C.cyan,2);for(let s of [-1,1]){m.box(s*2.36,2,0,.12,.65,7,[.63,.71,.66]);for(let z of [-3,3])m.box(s*2.33,.4,z,.8,1.5,1.7,[.027,.038,.043]);m.box(s*1.6,1.7,-4.61,.55,.45,.08,[.7,.76,.62],2);}return m;}
function makeCargo(){let m=new Mesh();m.box(0,1.6,1,6.7,3.5,15,[.14,.18,.18]);m.box(0,3,2,6.4,5,11,[.38,.23,.145]);m.box(0,2.2,-6,6.1,3.9,4,[.32,.29,.20]);m.box(0,3,-8.05,5.5,1.4,.1,[.05,.18,.21],2);for(let z=-3;z<8;z+=1.5){m.box(-3.25,3,z,.12,4.8,.12,[.60,.37,.20]);m.box(3.25,3,z,.12,4.8,.12,[.60,.37,.20]);}for(let s of [-1,1]){for(let z of [-6,2,6])m.box(s*3.1,.4,z,1,1.7,2,[.035,.04,.037]);m.box(s*2.3,1.8,-8.12,.8,.5,.1,C.amber,2);}m.box(0,5.61,2,3,.06,5,[.70,.50,.19],2);return m;}
function makeTurret(){let m=new Mesh();m.box(0,1,0,6,2,6,[.22,.17,.15]);m.box(0,3,0,4,2,4,[.31,.23,.19]);m.box(0,4.1,0,2,.3,1,C.red,2);for(let s of [-1,1])m.rod([s*1.2,3,-1],[s*1.2,3,-5],.32,C.metal,0,6);return m;}
function makeCockpit(){const m=new Mesh();for(let s of [-1,1]){m.box(s*1.83,-1.17,-2.0,.65,.55,2.2,[.10,.16,.19]);m.rod([s*1.73,-1.06,-2.3],[s*1.63,-.90,-5.0],.15,[.18,.24,.25],0,8);m.box(s*1.63,-.90,-4.87,.24,.08,.15,C.cyan,2);m.box(s*1.91,-1.01,-1.6,.17,.06,.4,C.amber,2);}return m;}
function makeCar(){const m=new Mesh();m.box(0,1.15,0,2.2,1.2,4.6,[.16,.23,.26]);m.box(0,2,-.25,1.85,.85,2.25,[.075,.145,.19]);for(let s of [-1,1]){m.box(s*.75,1.2,-2.34,.4,.24,.1,[.75,.78,.56],2);m.box(s*.75,1.2,2.34,.35,.2,.1,C.red,2);}return m;}
function makeAirCar(){const m=new Mesh();m.box(0,0,0,5,1.7,2.2,[.13,.21,.25]);m.box(-2.6,0,0,.12,.6,1.6,C.cyan,2);m.box(2.6,0,0,.12,.3,1.1,C.amber,2);return m;}
// Case 08: a Vanta freight hauler, flown nose first (-Z) with two engine pods astern.
const POD_X=5.3,POD_Y=-.6,POD_Z=3;
function makeHauler(){const m=new Mesh(),hull=[.15,.14,.13],rust=[.33,.20,.13],strut=[.2,.22,.22];
 m.box(0,0,0,6.6,4.6,17,hull);m.box(0,.7,.4,7,3.8,11,rust);
 for(const z of [-4.9,5.7]){m.box(-3.52,.7,z,.1,3.6,.14,[.52,.34,.18]);m.box(3.52,.7,z,.1,3.6,.14,[.52,.34,.18]);}
 m.box(0,1.2,-8.9,5,2.6,2.6,[.20,.23,.24]);m.box(0,1.5,-10.22,4.2,1.1,.06,[.06,.17,.20],2);
 m.tri([-2.5,-.2,-10.2],[2.5,-.2,-10.2],[0,-1.9,-8.8],hull);
 m.box(0,2.72,6.8,1.2,.25,1.2,C.red,2);m.box(0,-1.1,8.52,4.4,1.2,.1,[.45,.28,.12],2);
 for(const s of [-1,1]){m.box(s*4.1,-.6,POD_Z,2.4,.5,4.2,C.dark);m.box(s*2.6,-2.55,-5,.5,.5,5.5,strut);m.box(s*2.6,-2.55,5,.5,.5,5.5,strut);m.box(s*3.4,2.55,-8,.35,.3,.35,C.red,2);}
 m.sign(3.58,.8,.4,9,2.6,13,Math.PI/2);m.sign(-3.58,.8,.4,9,2.6,13,-Math.PI/2);
 return m;}
function makePod(){const m=new Mesh();m.rod([0,0,-3.2],[0,0,3],1.3,[.22,.25,.25],0,8);m.box(0,0,-3.3,1.9,1.9,.2,[.12,.16,.18]);m.box(0,0,3.1,1.8,1.8,.12,C.amber,2);m.box(0,1.35,.2,.18,.7,3.2,[.36,.2,.12]);m.box(0,-1.35,-2.6,.5,.25,.5,C.red,2);return m;}

kit.loading.progress(.72,'Building the dome…');
buildCity();
const worldVertices=city.count();
const cityMesh=new THREE.Mesh(city.geometry(),MATS);
cityMesh.matrixAutoUpdate=false;cityMesh.frustumCulled=false;scene.add(cityMesh);
city=null; // the build arrays are no longer needed

const GEO={ship:makeShip(false).geometry(),preview:makeShip(true).geometry(),van:makeVan().geometry(),turret:makeTurret().geometry(),cockpit:makeCockpit().geometry(),car:makeCar().geometry(),air:makeAirCar().geometry(),hauler:makeHauler().geometry(),pod:makePod().geometry()};
function addMesh(geo,parent=scene){const o=new THREE.Mesh(geo,MATS);o.rotation.order='YXZ';o.visible=false;parent.add(o);return o;}
const previewMesh=addMesh(GEO.preview);previewMesh.scale.setScalar(2.2);
const vanMesh=addMesh(GEO.van);
const cockpitMesh=addMesh(GEO.cockpit,camera);cockpitMesh.frustumCulled=false;
const haulerObj=new THREE.Group();haulerObj.rotation.order='YXZ';haulerObj.visible=false;scene.add(haulerObj);
const haulerBody=addMesh(GEO.hauler,haulerObj);haulerBody.visible=true;
const podMeshes=[-1,1].map(s=>{const o=addMesh(GEO.pod,haulerObj);o.position.set(s*POD_X,POD_Y,POD_Z);o.visible=true;return o;});
// Enemy models come from small pools instead of being rebuilt into one buffer every frame.
class Pool{constructor(geo){this.geo=geo;this.items=[];this.used=0;}next(){let o=this.items[this.used++];if(!o){o=addMesh(this.geo);this.items.push(o);}o.visible=true;return o;}begin(){this.used=0;}end(){for(let i=this.used;i<this.items.length;i++)this.items[i].visible=false;}}
const shipPool=new Pool(GEO.ship),turretPool=new Pool(GEO.turret);
for(let i=0;i<3;i++)shipPool.next();turretPool.next();shipPool.begin();shipPool.end();turretPool.begin();turretPool.end();
// Street and sky traffic: one instanced draw per model.
function instanced(geo,count){const o=new THREE.InstancedMesh(geo,MATS,count);o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);o.frustumCulled=false;o.count=0;scene.add(o);return o;}
const carInst=instanced(GEO.car,18),airInst=instanced(GEO.air,7);
function setInst(inst,i,x,y,z,yaw){const c=Math.cos(-yaw),s=Math.sin(-yaw),e=inst.instanceMatrix.array,o=i*16;e[o]=c;e[o+1]=0;e[o+2]=-s;e[o+3]=0;e[o+4]=0;e[o+5]=1;e[o+6]=0;e[o+7]=0;e[o+8]=s;e[o+9]=0;e[o+10]=c;e[o+11]=0;e[o+12]=x;e[o+13]=y;e[o+14]=z;e[o+15]=1;}

// Shots, missiles, particles, blinking lights and rings: written each frame into preallocated
// vertex buffers (one per material) instead of new JS arrays.
class Dyn{
 constructor(cap,kind){this.cap=cap;this.a=new Float32Array(cap*STRIDE);this.n=0;this.ib=new THREE.InterleavedBuffer(this.a,STRIDE);this.ib.setUsage(THREE.DynamicDrawUsage);this.geo=new THREE.BufferGeometry();setAttrs(this.geo,this.ib);this.geo.setDrawRange(0,0);this.mesh=new THREE.Mesh(this.geo,MATS[kind]);this.mesh.frustumCulled=false;this.mesh.matrixAutoUpdate=false;this.mesh.visible=false;scene.add(this.mesh);}
 begin(){this.n=0;}
 v(x,y,z,nx,ny,nz,r,g,b){const o=this.n*STRIDE,a=this.a;a[o]=x;a[o+1]=y;a[o+2]=z;a[o+3]=nx;a[o+4]=ny;a[o+5]=nz;a[o+6]=r;a[o+7]=g;a[o+8]=b;a[o+9]=0;a[o+10]=0;this.n++;}
 tri(ax,ay,az,bx,by,bz,cx,cy,cz,r,g,b){if(this.n+3>this.cap)return;const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;this.v(ax,ay,az,nx,ny,nz,r,g,b);this.v(bx,by,bz,nx,ny,nz,r,g,b);this.v(cx,cy,cz,nx,ny,nz,r,g,b);}
 quad(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,r,g,b){this.tri(ax,ay,az,bx,by,bz,cx,cy,cz,r,g,b);this.tri(ax,ay,az,cx,cy,cz,dx,dy,dz,r,g,b);}
 commit(){const n=this.n;this.geo.setDrawRange(0,n);this.mesh.visible=n>0;if(n){this.ib.clearUpdateRanges();this.ib.addUpdateRange(0,n*STRIDE);this.ib.needsUpdate=true;}}
}
const dyn0=new Dyn(6000,0),dyn2=new Dyn(14000,2);
const dq=m=>m===2?dyn2:dyn0;
// An axis-aligned box like Mesh.box: sides in its own kind, lit top and bottom.
function dBox(x,y,z,w,h,d,r,g,b,m=0){w/=2;h/=2;d/=2;const x0=x-w,x1=x+w,y0=y-h,y1=y+h,z0=z-d,z1=z+d,s=dq(m);
 s.quad(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y1,z1,r,g,b);s.quad(x1,y0,z0,x0,y0,z0,x0,y1,z0,x1,y1,z0,r,g,b);s.quad(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y1,z0,r,g,b);s.quad(x1,y0,z1,x1,y0,z0,x1,y1,z0,x1,y1,z1,r,g,b);
 dyn0.quad(x0,y1,z1,x1,y1,z1,x1,y1,z0,x0,y1,z0,r*1.12,g*1.12,b*1.12);dyn0.quad(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z1,r*.65,g*.65,b*.65);}
function dRod(ax,ay,az,bx,by,bz,rad,r,g,b,m,sides){let dx=bx-ax,dy=by-ay,dz=bz-az;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;let xx,xy,xz;if(Math.abs(dy)>.9){xx=0;xy=dz;xz=-dy;}else{xx=-dz;xy=0;xz=dx;}const xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=dy*xz-dz*xy,yy=dz*xx-dx*xz,yz=dx*xy-dy*xx,s=dq(m);
 for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,t2=(i+1)/sides*Math.PI*2,c1=Math.cos(t)*rad,s1=Math.sin(t)*rad,c2=Math.cos(t2)*rad,s2=Math.sin(t2)*rad,px=xx*c1+yx*s1,py=xy*c1+yy*s1,pz=xz*c1+yz*s1,qx=xx*c2+yx*s2,qy=xy*c2+yy*s2,qz=xz*c2+yz*s2;s.quad(ax+px,ay+py,az+pz,ax+qx,ay+qy,az+qz,bx+qx,by+qy,bz+qz,bx+px,by+py,bz+pz,r,g,b);}}
function dRing(x,y,z,rad,col,width){for(let i=0;i<64;i++){const a=i/64*Math.PI*2,c=(i+1)/64*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(c),sb=Math.sin(c),ri=rad-width,ro=rad+width;dyn2.quad(x+ca*ri,y,z+sa*ri,x+cb*ri,y,z+sb*ri,x+cb*ro,y,z+sb*ro,x+ca*ro,y,z+sa*ro,col[0],col[1],col[2]);}}

// ---------------------------------------------------------------- sound
const VOICE_KEYS=['intro','contact','escort','return','win','fail','warning','clear'];
class Sound{
 constructor(){this.ctx=null;this.muted=!!store.get('muted',false);this.voices={};this.voice=null;this.pendingVoice=null;this.pendingAt=0;this.step=0;this.nextBeat=0;this.events=0;}
 async start(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.66;this.master.connect(this.ctx.destination);this.engineGain=this.ctx.createGain();this.engineGain.gain.value=.017;this.engineGain.connect(this.master);this.engineFilter=this.ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=270;this.engineFilter.connect(this.engineGain);this.engines=[];for(let f of [47,70.5,94.4]){let o=this.ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(this.engineFilter);o.start();this.engines.push(o);}
  const n=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),a=n.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;this.noiseBuffer=n;
  let wind=this.ctx.createBufferSource();wind.buffer=n;wind.loop=true;let filt=this.ctx.createBiquadFilter();filt.type='lowpass';filt.frequency.value=500;wind.connect(filt);this.windGain=this.ctx.createGain();this.windGain.gain.value=.017;filt.connect(this.windGain);this.windGain.connect(this.master);wind.start();
  this.loadVoices();
 }catch(e){console.warn('Audio is not available:',e);this.ctx=null;return;}}
 if(this.ctx.state!=='running'){try{await this.ctx.resume();}catch(e){}}this.nextBeat=this.ctx.currentTime+.15;}
 // The radio voices are separate files, fetched and decoded after the first gesture.
 loadVoices(){for(const k of VOICE_KEYS){fetch('voice/'+k+'.mp3').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(buf=>{this.voices[k]=buf;if(this.pendingVoice===k&&performance.now()-this.pendingAt<4000)this.speak(k);}).catch(e=>console.warn('Voice line '+k+' did not load:',e));}}
 toggle(){this.muted=!this.muted;store.set('muted',this.muted);if(this.ctx)this.master.gain.setTargetAtTime(this.muted?0:.66,this.ctx.currentTime,.03);this.label();}
 label(){const b=$('muteBtn');b.innerHTML=this.muted?'♫<span class="lbl"> SOUND OFF</span>':'♫<span class="lbl"> SOUND ON</span>';b.setAttribute('aria-pressed',String(this.muted));b.setAttribute('aria-label',this.muted?'Sound off':'Sound on');}
 pause(){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend().catch(()=>{});}
 resume(){if(this.ctx){this.ctx.resume().catch(()=>{});this.nextBeat=this.ctx.currentTime+.1;}}
 tone(freq,duration,vol=.05,type='sine',end=null,delay=0){if(!this.ctx)return;this.events++;let t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(end,8),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
 noise(dur,vol=.07,freq=1500){if(!this.ctx)return;this.events++;let s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),t=this.ctx.currentTime;s.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+dur);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
 cannon(){this.noise(.10,.10,1800);this.tone(150,.08,.09,'triangle',45);}
 missile(){this.noise(.55,.17,2200);this.tone(180,.45,.09,'sawtooth',65);}
 hit(){this.tone(130,.11,.06,'triangle',60);this.noise(.10,.06,1900);}
 explode(){this.noise(.85,.24,1100);this.tone(100,.60,.22,'sine',24);}
 scan(){this.tone(850,.085,.028,'sine',1100);}
 lock(){this.tone(1200,.07,.06,'sine',null,0);this.tone(1550,.13,.06,'sine',null,.09);}
 radio(){this.noise(.14,.024,2500);this.tone(1050,.065,.06,'sine');this.tone(1450,.10,.04,'sine',null,.08);}
 speak(key){if(!this.ctx||!key)return;if(!this.voices[key]){this.pendingVoice=key;this.pendingAt=performance.now();return;}if(this.voice){try{this.voice.stop();}catch(e){}}this.pendingVoice=null;const src=this.ctx.createBufferSource();src.buffer=this.voices[key];const gain=this.ctx.createGain();gain.gain.value=.70;src.connect(gain);gain.connect(this.master);src.start(this.ctx.currentTime+.23);src.onended=()=>{src.disconnect();gain.disconnect();};this.voice=src;this.events++;}
 stopVoice(){this.pendingVoice=null;if(this.voice){try{this.voice.stop();}catch(e){}this.voice=null;}}
 update(speed,boost,combat){if(!this.ctx||this.ctx.state!=='running')return;let t=this.ctx.currentTime;this.engineGain.gain.setTargetAtTime(.015+speed*.0004,t,.2);this.engineFilter.frequency.setTargetAtTime(210+speed*6+boost*220,t,.15);this.windGain.gain.setTargetAtTime(.008+speed*.0005,t,.3);for(let i=0;i<3;i++)this.engines[i].frequency.setTargetAtTime([47,70.5,94.4][i]+speed*.44,t,.12);
 if(t>=this.nextBeat){this.nextBeat=t+.375;let k=this.step++;const base=[55,55,49,49,41.2,41.2,46.25,46.25][Math.floor(k/8)%8];if(k%4===0){this.tone(base,1.5,.028,'triangle');this.tone(base*3,1.8,.009,'sine');}if(k%2===0){let f=base*[4,6,8,9,6,4,12,8][Math.floor(k/2)%8];this.tone(f,.32,combat?.015:.009,'sine');}if(combat){if(k%4===0)this.tone(82,.19,.05,'sine',28);if(k%2===1)this.noise(.035,.012,3500);}}
 }
}
const sound=new Sound();

// ---------------------------------------------------------------- prompts for the active device
const PROMPTS={
 keyboard:{fwd:'W',thrust:'W S',brake:'SPACE',boost:'SHIFT',fire:'LMB / J',missile:'RIGHT CLICK OR K',missileShort:'RMB / K',scan:'F',down:'Q'},
 gamepad:{fwd:'L-STICK',thrust:'L-STICK',brake:'A',boost:'Y',fire:'RT',missile:'LT OR B',missileShort:'LT',scan:'X',down:'LB'},
 touch:{fwd:'STICK',thrust:'STICK',brake:'BRAKE',boost:'BOOST',fire:'FIRE',missile:'TAP MISSILE',missileShort:'MISSILE',scan:'SCAN',down:'▼ DOWN'},
};
const K=()=>PROMPTS[input.source]||PROMPTS.keyboard;
const fmt=s=>s.replace(/\{(\w+)\}/g,(m,w)=>K()[w.toLowerCase()]||m);
const CONTROL_ROWS={
 keyboard:[['MOUSE','Steer and aim'],['W S','Forward / reverse'],['A D','Slide left / right'],['Q E','Down / up'],['SPACE','Air brake / hover'],['SHIFT','Boost'],['LMB / J','Fire cannon'],['RMB / K','Fire locked missile'],['HOLD F','Scan cargo'],['ARROWS','Steer without mouse']],
 gamepad:[['R-STICK','Steer and aim'],['L-STICK','Forward / slide'],['LB RB','Down / up'],['A','Air brake / hover'],['Y / L3','Boost'],['RT','Fire cannon'],['LT / B','Fire locked missile'],['HOLD X','Scan cargo'],['D-PAD','Fine steering'],['START','Pause']],
 touch:[['DRAG','Steer and aim (right side)'],['STICK','Forward / slide (left side)'],['▲ ▼','Up / down'],['BRAKE','Air brake / hover'],['BOOST','Boost'],['FIRE','Cannon'],['MISSILE','Locked missile'],['SCAN','Scan (hold)'],['Ⅱ','Pause (top bar)'],['⚙','Settings (top bar)']],
};
const UNDER={keyboard:'P / ESC PAUSE &nbsp; · &nbsp; R RESTART &nbsp; · &nbsp; M MUTE &nbsp; · &nbsp; F9 SETTINGS',gamepad:'START PAUSE &nbsp; · &nbsp; D-PAD AND A TO CHOOSE &nbsp; · &nbsp; B BACK',touch:'TAP Ⅱ TO PAUSE &nbsp; · &nbsp; ⚙ SETTINGS IN THE TOP BAR'};
const FOOT={keyboard:'<b>W S</b> THRUST &nbsp; <b>A D</b> SLIDE &nbsp; <b>Q E</b> ALTITUDE &nbsp; <b>SPACE</b> BRAKE &nbsp; <b>F</b> SCAN &nbsp; <b>LMB / J</b> CANNON &nbsp; <b>RMB / K</b> MISSILE &nbsp; <b>P</b> PAUSE &nbsp; <b>R</b> RESTART',gamepad:'<b>L-STICK</b> THRUST / SLIDE &nbsp; <b>R-STICK</b> STEER &nbsp; <b>LB RB</b> ALTITUDE &nbsp; <b>A</b> BRAKE &nbsp; <b>Y</b> BOOST &nbsp; <b>X</b> SCAN &nbsp; <b>RT</b> CANNON &nbsp; <b>LT</b> MISSILE &nbsp; <b>START</b> PAUSE',touch:''};

// ---------------------------------------------------------------- cases and difficulty
const DIFFS={
 rookie:{label:'ROOKIE',note:'LESS INCOMING DAMAGE · SLOWER ENEMY FIRE · A SLOWER HAULER',taken:.6,fire:1.3,hauler:.88},
 officer:{label:'OFFICER',note:'THE ORIGINAL BALANCE',taken:1,fire:1,hauler:1},
 veteran:{label:'VETERAN',note:'HEAVIER INCOMING FIRE · A FASTER HAULER',taken:1.4,fire:.82,hauler:1.1},
};
const CASE_INFO={
 7:{code:'CASE 07 / NIGHT FREIGHT',lead:'The city sleeps. You hover.',desc:'Check a suspect cargo truck at East Dock. Protect the arrest team. Bring your gunship home.',num:'07',place:'EAST DOCK',tag:'LIVE / EAST DOCK',par:330},
 8:{code:'CASE 08 / RUNNING DARK',lead:'A hauler runs without lights.',desc:'A Vanta freight hauler lifted off East Dock with no flight plan. Catch it before the north service portal, cut its engines, scan the wreck and bring your gunship home.',num:'08',place:'NORTH PORTAL',tag:'LIVE / SECTOR 07 SKYLINE',par:230},
};
const PHASES={
 7:[['01 / CARGO CHECK','Inspect the truck','Follow the amber marker to East Dock. Get within 70 m. Aim at the truck and hold {SCAN}.'],
  ['02 / ARMED CONTACT','Clear East Dock','Stop the two gunships and the ground turret. Keep a target near the sight to lock a missile.'],
  ['03 / GROUND SUPPORT','Protect the arrest van','Stop the new gunships. Stay within 145 m of the blue van so it can reach the truck.'],
  ['04 / RETURN TO BASE','Bring your ship home','Return to the blue pad. Descend below 16 m with {DOWN}, then hold {BRAKE} above the pad.']],
 8:[['01 / PURSUIT','Catch the hauler','A Vanta hauler is running dark for the north service portal. Follow the amber marker and close to 120 m.'],
  ['02 / ENGINES','Cut its engines','Destroy both engine pods. The hull is armoured. Two escort gunships cover it.'],
  ['03 / EVIDENCE','Scan the downed hauler','Stop the interceptors. Get within 70 m, stop, aim at the hauler and hold {SCAN}.'],
  ['04 / RETURN TO BASE','Bring your ship home','Return to the blue pad. Descend below 16 m with {DOWN}, then hold {BRAKE} above the pad.']],
};
// The hauler's flight plan: street canyons at 60–100 m, then down the avenue to the portal.
const ROUTE=[[0,58,-128],[0,90,-70],[311,95,-70],[311,100,250],[-311,100,250],[-311,95,-225],[0,80,-225],[0,40,-400],[0,22,-470]];
const ROUTE_S=[0];for(let i=1;i<ROUTE.length;i++)ROUTE_S.push(ROUTE_S[i-1]+dist(ROUTE[i-1],ROUTE[i]));
const ROUTE_L=ROUTE_S[ROUTE_S.length-1];
const HAULER_SPEED=21,POD_HP=150;
function routeAt(s,out){s=clamp(s,0,ROUTE_L);let i=1;while(i<ROUTE.length-1&&ROUTE_S[i]<s)i++;const a=ROUTE[i-1],b=ROUTE[i],k=(s-ROUTE_S[i-1])/((ROUTE_S[i]-ROUTE_S[i-1])||1);out[0]=a[0]+(b[0]-a[0])*k;out[1]=a[1]+(b[1]-a[1])*k;out[2]=a[2]+(b[2]-a[2])*k;return out;}

// ---------------------------------------------------------------- game state
const IN={moveX:0,moveY:0,steerX:0,steerY:0,lookX:0,lookY:0,lift:0,brake:false,boost:false,fire:false,scan:false};
const G={mode:'brief',caseId:store.get('case',7)===8?8:7,diff:DIFFS[store.get('diff','officer')]?store.get('diff','officer'):'officer',phase:0,t:0,visualT:0,player:null,enemies:[],bolts:[],traces:[],missiles:[],particles:[],ally:null,hauler:null,scan:0,scanned:false,dock:0,lock:null,lockTime:0,shotCD:0,missileCD:0,damageFlash:0,hitFlash:0,radioTimer:0,radioOn:false,scanBeep:0,kills:0,warning:false,clearCall:false,stats:{},lastHint:'',hintTime:0,pausedAt:0,boostOn:false,grade:'',newBest:false,hurtDir:[0,0,1],hurtT:0,alarm:0};
const D=()=>DIFFS[G.diff];
let enemyID=0,sessionOver=false;
function setPhase(n){G.phase=n;renderObjective();document.querySelectorAll('.step').forEach((x,i)=>{x.className='step'+(i<n?' done':i===n?' active':'');});syncTouchButtons();}
function renderObjective(){const p=PHASES[G.caseId][G.phase];$('phaseLabel').textContent=p[0];$('objTitle').textContent=p[1];$('objText').textContent=fmt(p[2]);}
function signal(text,key,who='CONTROL / NIGHT DESK'){G.radioTimer=Math.max(8,text.length*.067);G.radioOn=true;$('radioName').textContent=who;$('radioText').textContent=text;$('radio').classList.add('show');sound.radio();if(key)sound.speak(key);}
function showHint(text,seconds=1.8){G.lastHint=text;G.hintTime=seconds;}
function reset(){G.player={pos:[0,31,174],vel:[0,0,0],yaw:0,pitch:-.065,roll:0,hull:100,heat:0,overheat:false,boost:100,ammo:8,collisionCD:0};G.enemies=[];G.bolts=[];G.traces=[];G.missiles=[];G.particles=[];G.ally={pos:[0,.15,117],hull:100,active:false,moving:false};G.hauler=null;G.t=0;G.scan=0;G.scanned=false;G.dock=0;G.lock=null;G.lockTime=0;G.shotCD=0;G.missileCD=0;G.damageFlash=0;G.hitFlash=0;G.radioTimer=0;G.scanBeep=0;G.kills=0;G.warning=false;G.clearCall=false;G.lastHint='';G.hintTime=0;G.boostOn=false;G.grade='';G.newBest=false;G.hurtT=0;G.alarm=0;G.stats={shots:0,hits:0,missiles:0,collisions:0,scans:0};enemyID=0;clearInput();setPhase(0);sound.step=0;sound.stopVoice();}
function clearInput(){IN.lookX=IN.lookY=0;}
function requestMouse(){if(input.source!=='keyboard')return;input.lockPointer();}
function blurOverlayFocus(){const a=document.activeElement;if(a&&a!==document.body&&a.closest&&a.closest('.overlay,#brief'))a.blur();}
function launch(){if(sessionOver||AIHub.active&&AIHub.time()<0)return;reset();if(G.caseId===8)startCase8();G.mode='play';blurOverlayFocus();$('brief').classList.add('hide');$('pause').classList.add('hide');$('result').classList.add('hide');$('flightUI').classList.remove('hide');$('mouseNote').classList.add('hide');sound.start();requestMouse();input.settle();
 if(G.caseId===7)signal('Kestrel 09, check the amber truck at East Dock. Hold the scan until the cargo is identified.','intro');
 else signal('Kestrel 09, a Vanta hauler just lifted off East Dock with no flight plan. It is running for the north service portal. Catch it.',null);
 syncUI();placePills();}
function pauseGame(){if(G.mode!=='play')return;G.mode='pause';G.pausedAt=performance.now();clearInput();$('pause').classList.remove('hide');if(document.pointerLockElement)document.exitPointerLock();sound.pause();syncUI();focusDefault();}
function resumeGame(){if(G.mode!=='pause')return;G.mode='play';clearInput();blurOverlayFocus();$('pause').classList.add('hide');sound.resume();requestMouse();input.settle();syncUI();}
// Back to the briefing: clear the finished flight so no frozen gunships, shots or smoke hang
// in the backdrop behind the title (the original left them there).
function briefing(){if(sessionOver)return;reset();G.mode='brief';clearInput();$('brief').classList.remove('hide');$('pause').classList.add('hide');$('result').classList.add('hide');$('flightUI').classList.add('hide');if(document.pointerLockElement)document.exitPointerLock();sound.stopVoice();sound.resume();G.radioOn=false;$('radio').classList.remove('show');renderBrief();syncUI();focusDefault();}
const GRADE_RANK={C:1,B:2,A:3,S:4};
function rating(){const c=CASE_INFO[G.caseId],acc=G.stats.shots?G.stats.hits/G.stats.shots:0;let s=0;if(G.player.hull>=75)s+=2;else if(G.player.hull>=45)s+=1;if(G.t<=c.par)s+=2;else if(G.t<=c.par*1.35)s+=1;if(acc>=.35)s+=1;return s>=5?'S':s>=4?'A':s>=2?'B':'C';}
function resultStamp(win){if(win)return(G.caseId===7?'CARGO SEIZED':'HAULER GROUNDED')+' / RATING '+G.grade+' / '+G.kills+' HOSTILES STOPPED'+(G.newBest?' / NEW BEST':'');return 'NEW AIRCRAFT READY / '+(input.source==='gamepad'?'PRESS A TO RETRY':input.source==='touch'?'TAP FLY AGAIN':'PRESS R TO RETRY');}
function finish(win,reason=''){if(G.mode!=='play')return;G.mode=win?'win':'fail';clearInput();if(document.pointerLockElement)document.exitPointerLock();
 const c=G.caseId;
 $('result').classList.remove('hide');$('resultTag').textContent=win?'CONTROL / CASE CLOSED':'CONTROL / PATROL LOST';$('resultTitle').textContent=win?'SHIFT COMPLETE':'PATROL FAILED';$('resultTitle').style.color=win?'var(--white)':'var(--red)';
 $('resultText').textContent=win?(c===7?'The cargo is secure. The arrest team is safe. Your ship is home. Another quiet night on paper.':'The hauler is grounded and its manifests are seized. Vanta Logistics has questions to answer. Your ship is home.'):reason;
 const key='best'+c+'_'+G.diff;let best=store.get(key,0);G.newBest=false;
 if(win){if(!best||G.t<best){G.newBest=true;best=Math.round(G.t*10)/10;store.set(key,best);}store.set('cleared'+c,true);G.grade=rating();
  const gk='grade'+c+'_'+G.diff;if((GRADE_RANK[G.grade]||0)>(GRADE_RANK[store.get(gk,'')]||0))store.set(gk,G.grade);}
 const acc=G.stats.shots?Math.round(G.stats.hits/G.stats.shots*100)+'%':'—';
 const third=c===7?['ARREST VAN',Math.max(0,Math.ceil(G.ally.hull))+'%']:['PORTAL MARGIN',G.hauler&&G.hauler.state!=='run'?formatTime(G.hauler.margin):'—'];
 const cells=[['FLIGHT TIME',formatTime(G.t),''],['SHIP HULL',Math.max(0,Math.ceil(G.player.hull))+'%',''],[third[0],third[1],''],['HOSTILES',String(G.kills),''],['ACCURACY',acc,''],['BEST / '+D().label,best?formatTime(best):'—',G.newBest?'best':'']];
 $('resultStats').innerHTML=cells.map(([a,b,cl])=>'<div><span>'+a+'</span><strong'+(cl?' class="'+cl+'"':'')+'>'+b+'</strong></div>').join('');
 $('resultStamp').textContent=resultStamp(win);
 $('nextBtn').classList.toggle('hide',!(win&&c===7));
 signal(win?'Good work, Nine. Another quiet night on paper.':reason,win?'win':'fail');
 input.rumble(win?.3:.8,win?160:420);
 // Side by side: a finished run reports its time (the hub's clock); a lost run is ranked by its last progress.
 if(AIHub.active){sessionOver=true;if(win)AIHub.result({time:AIHub.time()});}
 syncUI();focusDefault();}
function damagePlayer(n){if(G.mode!=='play'||n<=0)return;n*=D().taken;G.player.hull-=n;G.damageFlash=Math.min(1,G.damageFlash+.5);sound.hit();input.rumble(clamp(n/12,.25,.9),140);if(G.player.hull<=0){G.player.hull=0;finish(false,'Your gunship was lost. Slide or change height to avoid enemy fire. Use '+K().brake+' to stop before a wall.');}}
function damageAlly(n){if(G.mode!=='play'||G.caseId!==7||G.phase<1||G.phase>2)return;G.ally.hull-=n;if(G.ally.hull<65&&!G.warning){G.warning=true;signal('The arrest team is under fire. Protect the blue van.','warning','GROUND TEAM / UNIT 04');}if(G.ally.hull<=0){G.ally.hull=0;finish(false,'The arrest van was lost. Stay close to the blue marker and stop the gunships that attack the team.');}}
function rayBox(o,d,max,b,expand=0){let lo=0,hi=max;let mins=[b.x-b.w-expand,(b.minY||0)-expand,b.z-b.d-expand],maxs=[b.x+b.w+expand,b.h+expand,b.z+b.d+expand];for(let i=0;i<3;i++){if(Math.abs(d[i])<.00001){if(o[i]<mins[i]||o[i]>maxs[i])return Infinity;}else{let a=(mins[i]-o[i])/d[i],c=(maxs[i]-o[i])/d[i];if(a>c){let t=a;a=c;c=t;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}}return lo;}
function wallRay(o,d,max){let hit=max;for(let b of buildings){let v=rayBox(o,d,hit,b);if(v<hit&&v>.1)hit=v;}if(d[1]<0){let ground=(.1-o[1])/d[1];if(ground>0)hit=Math.min(hit,ground);}return hit;}
function sightClear(a,b){let v=sub(b,a),l=len(v);return wallRay(a,mul(v,1/(l||1)),l)>=l-2;}
function raySphere(o,d,p,r){let v=sub(p,o),t=dot(v,d);if(t<0)return Infinity;let dd=dot(v,v)-t*t;if(dd>r*r)return Infinity;return Math.max(0,t-Math.sqrt(r*r-dd));}
function groundAt(x,z,m=4){let g=0;for(const b of buildings){if(!b.minY&&x>b.x-b.w-m&&x<b.x+b.w+m&&z>b.z-b.d-m&&z<b.z+b.d+m)g=Math.max(g,b.h);}return g;}
const ENEMY_HP={turret:140,interceptor:120,drone:85,escort:85};
function spawnEnemy(kind,pos,phase,mode='hold'){const id=++enemyID,hp=ENEMY_HP[kind]||85;G.enemies.push({id,kind,pos:[...pos],origin:[...pos],hp,maxHp:hp,r:kind==='turret'?4.8:5.5,phase,mode,age:0,shootCD:(2+id*.55)*D().fire,yaw:0,roll:0,flash:0,dead:false});}
function liveEnemies(){let n=0;for(const e of G.enemies)if(!e.dead&&e.kind!=='pod')n++;return n;}
function waveOne(){setPhase(1);G.ally.active=true;spawnEnemy('drone',[-27,31,-146],1);spawnEnemy('drone',[29,45,-188],1);spawnEnemy('turret',[-19,4,-188],1);G.stats.scans=1;signal('Weapons confirmed. Two hostile gunships and a ground turret. Clear the dock. Do not fire on the cargo.','contact');for(let e of G.enemies)particles(e.pos,8,C.red,8);}
function waveTwo(){setPhase(2);let z=G.ally.pos[2];spawnEnemy('interceptor',[-26,39,z-36],2,'escortVan');spawnEnemy('interceptor',[29,49,z-11],2,'escortVan');signal('Arrest team moving. New gunships inbound. Stay with the blue van and protect it.','escort');}
function killEnemy(e){if(e.dead)return;e.dead=true;if(e.kind!=='pod')G.kills++;G.hitFlash=.35;particles(e.pos,46,C.amber,22);particles(e.pos,18,[.16,.18,.20],10,2.3);sound.explode();input.rumble(.55,200);if(G.lock===e){G.lock=null;G.lockTime=0;}if(e.kind==='pod')podDown();}
function hitEnemy(e,damage){if(e.dead)return;e.hp-=damage;e.flash=.13;G.hitFlash=.13;if(e.hp<=0)killEnemy(e);else{particles(e.pos,5,C.amber,9);sound.tone(340,.035,.025,'triangle',190);}if(e.kind==='pod'&&G.phase===0&&G.caseId===8)startPursuit();}
const particleCap=()=>kit.detail(240,80);
function pushParticle(pos,vel,life,max,size,color){const P=G.particles;while(P.length>=particleCap())P.shift();P.push({pos,vel,life,max,size,color});}
function particles(pos,count,col,force=10,life=.7){for(let i=0;i<count;i++)pushParticle([pos[0],pos[1],pos[2]],[(Math.random()-.5)*force,(Math.random()-.25)*force,(Math.random()-.5)*force],life*(.4+Math.random()*.7),life,life>1?2.1:.35+Math.random()*.8,col);}
function shootCannon(){if(G.shotCD>0||G.player.overheat)return;G.shotCD=.105;let p=G.player,b=basis(p.yaw,p.pitch),d=b.f;
 // A small aim aid offsets the original game's high digital-input difficulty.
 let closest=null,best=.996;for(let e of G.enemies){if(e.dead)continue;let v=sub(e.pos,p.pos),l=len(v),a=dot(d,mul(v,1/l));if(l<330&&a>best&&sightClear(p.pos,e.pos)){best=a;closest=e;}}
 if(closest)d=norm(sub(closest.pos,p.pos));let travel=wallRay(p.pos,d,350),victim=null;
 for(let e of G.enemies){if(e.dead)continue;let t=raySphere(p.pos,d,e.pos,e.r);if(t<travel){travel=t;victim=e;}}
 // The cargo is evidence. Its weapon safety guard is automatic.
 let cargoHit=raySphere(p.pos,d,add(CARGO,[0,2,0]),7);if(G.caseId===7&&G.phase===0&&cargoHit<travel){showHint('CARGO SAFETY ON · HOLD '+K().scan+' TO SCAN');return;}
 if(G.caseId===7&&G.ally.active&&G.phase<3){let a=raySphere(p.pos,d,add(G.ally.pos,[0,2,0]),4);if(a<travel){travel=a;victim=null;damageAlly(.6);showHint('FRIENDLY VAN · CHECK YOUR FIRE');}}
 // Case 08: the hauler's armoured hull stops rounds before they reach anything behind it.
 let armour=false;if(G.hauler){let a=raySphere(p.pos,d,G.hauler.pos,4.6);if(a<travel){travel=a;victim=null;armour=true;}}
 p.heat=Math.min(1.05,p.heat+.073);G.stats.shots++;if(p.heat>=1)p.overheat=true;
 let end=add(p.pos,mul(d,travel)),muzzle=add(add(p.pos,mul(b.r,G.stats.shots%2?1.1:-1.1)),add(mul(b.u,-.6),mul(b.f,3)));
 G.traces.push({a:muzzle,b:end,life:.08,max:.08,color:[1,.69,.27],width:.075});sound.cannon();
 if(victim){G.stats.hits++;hitEnemy(victim,15);}else if(armour){particles(end,4,[.85,.53,.27],7,.28);if(G.hintTime<=0&&G.hauler.state==='run')showHint('ARMOURED HULL · AIM FOR THE ENGINE PODS',1.2);}else if(travel<349)particles(end,3,[.85,.53,.27],6,.28);
}
function fireMissile(){if(G.mode!=='play'||G.missileCD>0)return;let p=G.player;if(p.ammo<=0){showHint('NO MISSILES · USE THE CANNON');sound.tone(140,.12,.035,'square');return;}if(!G.lock||G.lock.dead||G.lockTime<1){showHint('NO LOCK · KEEP A RED TARGET NEAR THE SIGHT');sound.tone(170,.10,.028,'triangle');return;}
 p.ammo--;G.stats.missiles++;G.missileCD=.9;const b=basis(p.yaw,p.pitch);G.missiles.push({pos:add(add(p.pos,mul(b.f,4)),mul(b.r,p.ammo%2?-1.8:1.8)),vel:mul(b.f,85),target:G.lock,age:0,trail:0});sound.missile();input.rumble(.35,110);G.lockTime=0;}
function updateLock(dt){let p=G.player,b=basis(p.yaw,p.pitch),best=.9848,target=null;for(let e of G.enemies){if(e.dead)continue;const v=sub(e.pos,p.pos),d=len(v),a=dot(mul(v,1/d),b.f);if(d<330&&a>best&&sightClear(p.pos,e.pos)){best=a;target=e;}}
 if(target!==G.lock){G.lock=target;G.lockTime=0;}if(target){let old=G.lockTime;G.lockTime=Math.min(1.1,G.lockTime+dt);if(old<1&&G.lockTime>=1)sound.lock();}else G.lockTime=0;
}
function collision(){let p=G.player,pos=p.pos,r=2.7;
 for(let b of buildings){if(pos[0]<b.x-b.w-r||pos[0]>b.x+b.w+r||pos[2]<b.z-b.d-r||pos[2]>b.z+b.d+r||pos[1]>b.h+r||pos[1]<(b.minY||0)-r)continue;
  let edges=[Math.abs(pos[0]-(b.x-b.w-r)),Math.abs(pos[0]-(b.x+b.w+r)),Math.abs(pos[2]-(b.z-b.d-r)),Math.abs(pos[2]-(b.z+b.d+r)),Math.abs(pos[1]-(b.h+r))];if(b.minY)edges.push(Math.abs(pos[1]-(b.minY-r)));let i=edges.indexOf(Math.min(...edges)),impact=len(p.vel);if(i===0){pos[0]=b.x-b.w-r-.03;p.vel[0]=-Math.abs(p.vel[0])*.12;}if(i===1){pos[0]=b.x+b.w+r+.03;p.vel[0]=Math.abs(p.vel[0])*.12;}if(i===2){pos[2]=b.z-b.d-r-.03;p.vel[2]=-Math.abs(p.vel[2])*.12;}if(i===3){pos[2]=b.z+b.d+r+.03;p.vel[2]=Math.abs(p.vel[2])*.12;}if(i===4){pos[1]=b.h+r+.03;p.vel[1]=Math.abs(p.vel[1])*.12;}if(i===5){pos[1]=b.minY-r-.03;p.vel[1]=-Math.abs(p.vel[1])*.12;}
  if(impact>9&&p.collisionCD<=0){p.collisionCD=1.1;G.stats.collisions++;damagePlayer(clamp(impact*.22,2,12));showHint('COLLISION · HOLD '+K().brake+' TO BRAKE');}
 }
 // Case 08: the hauler is solid.
 if(G.hauler){const h=G.hauler,dx=pos[0]-h.pos[0],dy=pos[1]-h.pos[1],dz=pos[2]-h.pos[2],d=Math.hypot(dx,dy,dz),R=9;if(d<R&&d>1e-4){const nx=dx/d,ny=dy/d,nz=dz/d,impact=len(p.vel),vn=p.vel[0]*nx+p.vel[1]*ny+p.vel[2]*nz;pos[0]=h.pos[0]+nx*R;pos[1]=h.pos[1]+ny*R;pos[2]=h.pos[2]+nz*R;if(vn<0){p.vel[0]-=vn*nx*1.12;p.vel[1]-=vn*ny*1.12;p.vel[2]-=vn*nz*1.12;}if(impact>9&&p.collisionCD<=0){p.collisionCD=1.1;G.stats.collisions++;damagePlayer(clamp(impact*.22,2,12));showHint('COLLISION · HOLD '+K().brake+' TO BRAKE');}}}
 if(pos[1]<4.5){if(p.vel[1]<-12&&p.collisionCD<=0){damagePlayer(Math.min(8,-p.vel[1]*.18));p.collisionCD=1;}pos[1]=4.5;p.vel[1]=Math.max(0,p.vel[1]);}
 if(pos[1]>225){pos[1]=225;p.vel[1]=Math.min(0,p.vel[1]);showHint('DOME CEILING · DESCEND WITH '+K().down,.4);}
 let rr=Math.hypot(pos[0],pos[2]);if(rr>450){pos[0]*=450/rr;pos[2]*=450/rr;p.vel[0]*=.7;p.vel[2]*=.7;showHint('PATROL LIMIT · TURN BACK',.7);}
}
function updatePlayer(dt){let p=G.player,oldYaw=p.yaw;
 p.yaw+=IN.lookX;p.pitch-=IN.lookY;IN.lookX=IN.lookY=0;
 p.yaw+=IN.steerX*1.15*dt;p.pitch+=IN.steerY*.84*dt;p.pitch=clamp(p.pitch,-1.28,1.14);p.yaw=wrap(p.yaw);
 const brake=IN.brake,forward=IN.moveY>0?IN.moveY:IN.moveY*.68,slide=IN.moveX,lift=IN.lift,boost=IN.boost&&forward>0&&!brake&&p.boost>1;
 G.boostOn=IN.boost;
 let speed=boost?74:40,b=basis(p.yaw,p.pitch),desired=add(add(mul(b.f,forward*speed),mul(b.r,slide*29)),[0,lift*25,0]);if(len(desired)>speed*1.13)desired=mul(norm(desired),speed*1.13);if(brake)desired=[0,0,0];
 let a=1-Math.exp(-dt*(brake?10:2.6));for(let i=0;i<3;i++)p.vel[i]=mix(p.vel[i],desired[i],a);for(let i=0;i<3;i++)p.pos[i]+=p.vel[i]*dt;
 p.roll=mix(p.roll,clamp(-slide*.09-wrap(p.yaw-oldYaw)/dt*.065,-.18,.18),1-Math.exp(-dt*4));
 p.boost=clamp(p.boost+(boost?-25:15)*dt,0,100);p.heat=Math.max(0,p.heat-dt*(p.overheat?.34:.18));if(p.overheat&&p.heat<.31)p.overheat=false;p.collisionCD=Math.max(0,p.collisionCD-dt);G.shotCD-=dt;G.missileCD-=dt;
 collision();updateLock(dt);if(IN.fire)shootCannon();
 sound.update(len(p.vel),boost?1:0,(G.phase===1||G.phase===2)&&liveEnemies()>0);
}
function updateEnemies(dt){const h=G.hauler;for(let e of G.enemies){if(e.dead||e.kind==='pod')continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);
 if(e.kind!=='turret'){let tx,ty,tz,follow=1.4;
  if(e.mode==='escortVan'){tx=e.origin[0]+Math.sin(e.age*.48+e.id)*10;ty=e.origin[1]+Math.sin(e.age*.67+e.id)*7;tz=G.ally.pos[2]-23+(e.id%2?-24:19)+Math.cos(e.age*.48)*13;}
  else if(h&&(e.mode==='escortHauler'||e.mode==='guardHauler')){
   // Case 08 flights keep to the hauler's street canyon: offsets along its heading, not across it.
   const side=e.id%2?1:-1;let lx,ly,lz;
   if(e.mode==='escortHauler'){lx=side*6+Math.sin(e.age*.9+e.id)*2;ly=8+Math.sin(e.age*.67+e.id)*3;lz=22+side*4+Math.cos(e.age*.5+e.id)*5;}
   else{lx=Math.sin(e.age*.7+e.id)*4;ly=26+side*5+Math.sin(e.age*.67+e.id)*3;lz=side*24+Math.cos(e.age*.45)*6;}
   const B=h.b;tx=h.pos[0]+B.r[0]*lx+B.u[0]*ly-B.f[0]*lz;ty=h.pos[1]+B.r[1]*lx+B.u[1]*ly-B.f[1]*lz;tz=h.pos[2]+B.r[2]*lx+B.u[2]*ly-B.f[2]*lz;follow=2.2;}
  else{tx=e.origin[0]+Math.sin(e.age*.65+e.id)*13;ty=e.origin[1]+Math.sin(e.age*.67+e.id)*7;tz=e.origin[2]+Math.cos(e.age*.56)*11;}
  const f=Math.min(1,dt*follow);e.pos[0]+=(tx-e.pos[0])*f;e.pos[1]+=(ty-e.pos[1])*f;e.pos[2]+=(tz-e.pos[2])*f;e.roll=Math.sin(e.age*.6+e.id)*.16;}
 let target=G.player.pos;const shootAlly=G.caseId===7&&G.ally.active&&G.phase===2&&(e.id%2===0||dist(G.player.pos,e.pos)>220);if(shootAlly)target=add(G.ally.pos,[0,2.5,0]);
 let d=sub(target,e.pos);e.yaw=Math.atan2(d[0],-d[2]);e.shootCD-=dt;
 if(e.shootCD<=0){e.shootCD=(e.kind==='turret'?2.6:3.0+Math.random()*.55)*D().fire;if(len(d)<300&&sightClear(e.pos,target)){let aim=add(target,shootAlly?[0,0,-1.3]:mul(G.player.vel,.24));aim=add(aim,[(Math.random()-.5)*4,(Math.random()-.5)*3,(Math.random()-.5)*4]);const origin=add(e.pos,mul(norm(d),5));G.bolts.push({pos:origin,vel:mul(norm(sub(aim,origin)),e.kind==='turret'?65:60),life:5,damage:e.kind==='turret'?6:4});G.traces.push({a:origin,b:add(origin,mul(norm(d),10)),life:.08,max:.08,color:C.red,width:.16});if(dist(e.pos,G.player.pos)<160)sound.tone(220,.07,.025,'sawtooth',90);}}
 }}
function updateProjectiles(dt){
 for(let i=G.bolts.length-1;i>=0;i--){let b=G.bolts[i],old=b.pos;b.pos=add(b.pos,mul(b.vel,dt));b.life-=dt;let direction=norm(b.vel),length=dist(old,b.pos),wall=wallRay(old,direction,length);if(wall<length-.05)b.life=0;let hp=raySphere(old,direction,G.player.pos,2.8);if(hp<=length){hurtFrom(direction);damagePlayer(b.damage);particles(b.pos,5,C.amber,6);b.life=0;}if(G.caseId===7&&G.ally.active&&G.phase===2){let ha=raySphere(old,direction,add(G.ally.pos,[0,2.5,0]),4);if(ha<=length){damageAlly(b.damage*.75*D().taken);particles(b.pos,4,C.amber,5);b.life=0;}}if(b.life<=0)G.bolts.splice(i,1);}
 for(let i=G.missiles.length-1;i>=0;i--){let m=G.missiles[i];m.age+=dt;let old=[...m.pos];if(m.target&&!m.target.dead){const v=norm(sub(m.target.pos,m.pos));m.vel=mul(norm(add(mul(norm(m.vel),Math.max(0,1-dt*5)),mul(v,dt*5))),112);}m.pos=add(m.pos,mul(m.vel,dt));m.trail+=dt;if(m.trail>.038){m.trail=0;pushParticle([...m.pos],[0,1,0],.48,.48,.8,[.67,.37,.16]);}let l=dist(old,m.pos),d=norm(m.vel),wall=wallRay(old,d,l);let hit=null;for(let e of G.enemies){if(!e.dead&&raySphere(old,d,e.pos,e.r+1)<l)hit=e;}if(hit){hitEnemy(hit,105);particles(m.pos,12,C.amber,17);G.missiles.splice(i,1);}else if(wall<l-.05||m.age>5){particles(m.pos,15,C.amber,12);sound.explode();G.missiles.splice(i,1);}}
 for(let i=G.traces.length-1;i>=0;i--){G.traces[i].life-=dt;if(G.traces[i].life<=0)G.traces.splice(i,1);}
 const damp=Math.exp(-dt*1.2);
 for(let i=G.particles.length-1;i>=0;i--){const q=G.particles[i];q.life-=dt;q.pos[0]+=q.vel[0]*dt;q.pos[1]+=q.vel[1]*dt;q.pos[2]+=q.vel[2]*dt;q.vel[1]-=dt*(q.max>1?-1:5);q.vel[0]*=damp;q.vel[1]*=damp;q.vel[2]*=damp;if(q.life<=0)G.particles.splice(i,1);}
}
function scanStatus(target){const p=G.player,v=sub(target,p.pos),d=len(v),a=dot(mul(v,1/(d||1)),basis(p.yaw,p.pitch).f);return{d,aim:a>.953,slow:len(p.vel)<15,clear:sightClear(p.pos,target)};}
// Hold scan within 70 m, slow, aimed and with a clear view. Returns true when the scan completes.
function scanStep(dt,target){const s=scanStatus(target);
 if(IN.scan&&s.d<70&&s.aim&&s.slow&&s.clear){G.scan=Math.min(1,G.scan+dt/3.2);G.scanBeep-=dt;if(G.scanBeep<=0){G.scanBeep=.35;sound.scan();}return G.scan>=1;}
 if(IN.scan)showHint(s.d>=70?'SCAN RANGE 70 M · MOVE CLOSER':!s.slow?'HOLD '+K().brake+' TO STOP':!s.clear?'SCAN BLOCKED · FIND A CLEAR VIEW':G.caseId===7?'AIM AT THE AMBER TRUCK':'AIM AT THE HAULER',.18);
 else G.scan=Math.max(0,G.scan-dt*.055);
 return false;}
function landingStep(dt){let p=G.player,horizontal=Math.hypot(p.pos[0]-HOME[0],p.pos[2]-HOME[2]);if(horizontal<24&&p.pos[1]<16&&len(p.vel)<10&&IN.brake){G.dock+=dt;p.pos[1]=mix(p.pos[1],5,dt*.8);if(G.dock>=2.4)finish(true);}else G.dock=Math.max(0,G.dock-dt);}
function updateCase7(dt){
 if(G.phase===0){if(scanStep(dt,add(CARGO,[0,2,0])))waveOne();}
 if(G.phase===1||G.phase===2){let goal=G.phase===1?35:-140,near=dist(G.player.pos,add(G.ally.pos,[0,20,0]))<145;G.ally.moving=G.ally.pos[2]>goal&&(G.phase===1||near);if(G.ally.moving)G.ally.pos[2]=Math.max(goal,G.ally.pos[2]-dt*(G.phase===1?7:9));
 if(G.phase===1&&G.enemies.filter(e=>e.phase===1).every(e=>e.dead))waveTwo();
 if(G.phase===2){let clear=G.enemies.every(e=>e.dead);if(clear&&!G.clearCall){G.clearCall=true;signal('Airspace clear. Stay with the arrest van until the cargo is secure.','clear','GROUND TEAM / UNIT 04');}if(clear&&G.ally.pos[2]<=-139.9){setPhase(3);G.ally.moving=false;signal('Cargo secured. The ground team is safe. Return to the blue pad, descend, and hold '+K().brake+' to land.','return');}}}
 if(G.phase===3)landingStep(dt);
}

// ---------------------------------------------------------------- Case 08: Running Dark
function startCase8(){const h={pos:[...ROUTE[0]],goal:[...ROUTE[0]],s:0,base:HAULER_SPEED*D().hauler,speed:HAULER_SPEED*D().hauler,yaw:Math.PI,pitch:0,roll:0,state:'run',vy:0,fallT:0,groundY:0,smoke:0,margin:0,warned:false,b:basis(Math.PI,0,0),pods:[]};
 for(const side of [-1,1]){const id=++enemyID;const e={id,kind:'pod',side,pos:[0,0,0],origin:[0,0,0],hp:POD_HP,maxHp:POD_HP,r:3.2,phase:1,mode:'static',age:0,shootCD:99,yaw:0,roll:0,flash:0,dead:false};G.enemies.push(e);h.pods.push(e);}
 G.hauler=h;placePods(h);}
function placePods(h){const B=h.b;for(const pd of h.pods){const lx=pd.side*POD_X;pd.pos[0]=h.pos[0]+B.r[0]*lx+B.u[0]*POD_Y-B.f[0]*POD_Z;pd.pos[1]=h.pos[1]+B.r[1]*lx+B.u[1]*POD_Y-B.f[1]*POD_Z;pd.pos[2]=h.pos[2]+B.r[2]*lx+B.u[2]*POD_Y-B.f[2]*POD_Z;}}
function startPursuit(){if(G.phase!==0||!G.hauler)return;setPhase(1);const h=G.hauler;for(const side of [-1,1]){const o=add(h.pos,add(mul(h.b.f,-60),[side*6,14,0]));spawnEnemy('escort',o,1,'escortHauler');}
 signal('Hauler in sight. Two escorts breaking off to cover it. The hull is armoured. Cut the engine pods.',null);}
function podDown(){const h=G.hauler;if(!h)return;let alive=0;for(const pd of h.pods)if(!pd.dead)alive++;
 if(alive===1)signal('One engine is out. It is slowing down. Finish the other pod.',null);
 else if(alive===0&&h.state==='run'){h.state='falling';h.vy=2;h.fallT=0;h.margin=(ROUTE_L-h.s)/h.base;for(const e of G.enemies)if(!e.dead&&e.mode==='escortHauler')e.mode='guardHauler';signal('Both engines are out. It is coming down. Stay on it.',null);showHint('HAULER GOING DOWN',2.5);input.rumble(.5,220);}}
function haulerDown(){const h=G.hauler;particles(h.pos,40,[.16,.18,.20],12,2.3);particles(h.pos,26,C.amber,16);sound.explode();input.rumble(.6,260);G.hitFlash=.3;setPhase(2);
 const B=h.b,fx=B.f[0],fz=B.f[2],fl=Math.hypot(fx,fz)||1,top=h.pos[1]+30;
 spawnEnemy('interceptor',[h.pos[0]+fx/fl*30,top,h.pos[2]+fz/fl*30],2,'guardHauler');spawnEnemy('interceptor',[h.pos[0]-fx/fl*30,top+10,h.pos[2]-fz/fl*30],2,'guardHauler');
 signal('Hauler down. Two Vanta interceptors inbound. Clear them, then scan the hauler.',null);}
function updateHauler(dt){const h=G.hauler;
 if(h.state==='run'){let alive=0;for(const pd of h.pods)if(!pd.dead)alive++;h.speed=h.base*(alive===2?1:.72);h.s=Math.min(ROUTE_L,h.s+h.speed*dt);routeAt(h.s,h.goal);
  if(h.s>=ROUTE_L-.5){finish(false,'The hauler slipped through the north service portal. Boost to close the gap and aim for the engine pods, not the hull.');return;}
  if(!h.warned&&(ROUTE_L-h.s)/h.speed<22){h.warned=true;signal('It is twenty seconds from the portal. Cut those engines now.',null);}}
 else if(h.state==='falling'){h.fallT+=dt;const sp=h.speed*Math.max(0,1-h.fallT/3.2);h.s=Math.min(ROUTE_L-4,h.s+sp*dt);const y=h.pos[1];routeAt(h.s,h.goal);h.groundY=groundAt(h.goal[0],h.goal[2])+2.8;h.vy=Math.max(-15,h.vy-dt*10);h.goal[1]=Math.max(h.groundY,y+h.vy*dt);
  h.smoke-=dt;if(h.smoke<=0){h.smoke=.05;for(const pd of h.pods)particles(pd.pos,1,[.16,.17,.18],3,2.2);}
  if(h.goal[1]<=h.groundY+.02&&h.fallT>1.2&&sp<2){h.state='down';h.goal[1]=h.groundY;haulerDown();}}
 else{h.smoke-=dt;if(h.smoke<=0){h.smoke=.2;particles(h.pods[0].pos,1,[.16,.17,.18],2.5,2.2);}}
 // Ease the body toward its path point (rounded corners), then face the way it moves.
 const ox=h.pos[0],oy=h.pos[1],oz=h.pos[2],k=1-Math.exp(-dt*(h.state==='run'?3:6));
 h.pos[0]+=(h.goal[0]-ox)*k;h.pos[2]+=(h.goal[2]-oz)*k;h.pos[1]=h.state==='run'?oy+(h.goal[1]-oy)*k:h.goal[1];
 const vx=h.pos[0]-ox,vy=h.pos[1]-oy,vz=h.pos[2]-oz,hv=Math.hypot(vx,vz),ease=1-Math.exp(-dt*2.5);
 if(h.state==='down'){h.pitch=mix(h.pitch,0,ease);h.roll=mix(h.roll,.05,ease);}
 else if(hv>1e-4){const turn=clamp(wrap(Math.atan2(vx,-vz)-h.yaw),-2*dt,2*dt);h.yaw=wrap(h.yaw+turn);h.roll=mix(h.roll,h.state==='falling'?.24:clamp(-turn/dt*.35,-.35,.35),ease);h.pitch=mix(h.pitch,h.state==='falling'?-.14:clamp(Math.atan2(vy,hv)*.8,-.25,.25),ease);}
 for(const pd of h.pods)pd.flash=Math.max(0,pd.flash-dt);
 basisInto(h.b,h.yaw,h.pitch,h.roll);placePods(h);}
function updateCase8(dt){const h=G.hauler;
 if(G.phase===0){if(dist(G.player.pos,h.pos)<120)startPursuit();}
 else if(G.phase===2){
  if(!G.scanned&&scanStep(dt,add(h.pos,[0,1.5,0]))){G.scanned=true;G.stats.scans=1;syncTouchButtons();signal(liveEnemies()?'Scan complete. Stolen dock manifests on board. Clear the interceptors.':'Scan complete. Stolen dock manifests on board.',null);}
  if(G.scanned&&!liveEnemies()){setPhase(3);signal('Evidence secured. A ground team is on its way to the hauler. Return to the blue pad and land.',null);}}
 else if(G.phase===3)landingStep(dt);}
function updateMission(dt){if(G.caseId===7)updateCase7(dt);else updateCase8(dt);}
// Which way the last hit came from (drawn as an arc around the sight), and a soft two-tone
// alarm while the hull is critical.
function hurtFrom(d){G.hurtDir[0]=-d[0];G.hurtDir[1]=-d[1];G.hurtDir[2]=-d[2];G.hurtT=.9;}
function lowHullAlarm(dt){if(G.player.hull>=30){G.alarm=0;return;}G.alarm-=dt;if(G.alarm<=0){G.alarm=1.6;sound.tone(988,.09,.022,'square');sound.tone(784,.11,.022,'square',null,.16);}}
function tick(dt){G.visualT+=dt;if(G.mode!=='play')return;G.t+=dt;G.damageFlash=Math.max(0,G.damageFlash-dt*1.3);G.hitFlash=Math.max(0,G.hitFlash-dt);G.hurtT=Math.max(0,G.hurtT-dt);G.hintTime=Math.max(0,G.hintTime-dt);G.radioTimer-=dt;if(G.radioTimer<=0&&G.radioOn){G.radioOn=false;$('radio').classList.remove('show');}
 if(G.hauler){updateHauler(dt);if(G.mode!=='play')return;}
 updatePlayer(dt);if(G.mode!=='play')return;lowHullAlarm(dt);updateEnemies(dt);updateProjectiles(dt);if(G.mode!=='play')return;updateMission(dt);}

// ---------------------------------------------------------------- menus, briefing, prompts
function selectCase(id){G.caseId=id===8?8:7;store.set('case',G.caseId);renderBrief();}
function selectDiff(id){if(!DIFFS[id])return;G.diff=id;store.set('diff',id);renderBrief();}
function renderBrief(){const info=CASE_INFO[G.caseId];$('caseCode').textContent=info.code;$('caseLead').textContent=info.lead;$('caseDesc').textContent=info.desc;$('previewLive').textContent=info.tag;$('zoneName').textContent=info.place;
 document.querySelectorAll('.case-btn').forEach(b=>{const on=+b.dataset.case===G.caseId;b.classList.toggle('sel',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelectorAll('#diffPick button').forEach(b=>{const on=b.dataset.diff===G.diff;b.classList.toggle('sel',on);b.setAttribute('aria-pressed',String(on));});
 $('diffNote').textContent=D().note;
 for(const id of [7,8]){const best=store.get('best'+id+'_'+G.diff,0),grade=store.get('grade'+id+'_'+G.diff,'');$('best'+id).textContent=best?'BEST '+formatTime(best)+(grade?' · '+grade:'')+' / '+D().label:store.get('cleared'+id,false)?'CLEARED':'NOT FLOWN';}}
function refreshPrompts(){const src=CONTROL_ROWS[input.source]?input.source:'keyboard',k=K();
 const rows=CONTROL_ROWS[src].map(([key,label])=>'<div class="control"><span class="key">'+key+'</span>'+label+'</div>').join('');
 $('briefControls').innerHTML=rows;$('pauseControls').innerHTML=rows;$('underKeys').innerHTML=UNDER[src];$('footControls').innerHTML=FOOT[src];
 $('pauseTip').innerHTML='KEEP A TARGET NEAR THE SIGHT TO LOCK A MISSILE.<br>HOLD '+k.brake+' TO STOP. '+k.down+' LOWERS THE AIRCRAFT.';
 renderObjective();if(G.mode==='fail')$('resultStamp').textContent=resultStamp(false);shownHint='';}
function overlayRoot(){return G.mode==='brief'?$('brief'):G.mode==='pause'?$('pause'):(G.mode==='win'||G.mode==='fail')?$('result'):null;}
// The briefing also reaches the top bar's sound and settings buttons, so a gamepad can use them.
function menuButtons(root){const list=Array.from(root.querySelectorAll('button'));if(G.mode==='brief')list.push(...document.querySelectorAll('#topbar .tool'));return list.filter(b=>!b.disabled&&b.offsetParent!==null);}
// Only a gamepad needs a pre-focused button. For the keyboard, Enter works without one
// (confirm below), and a focused button would be clicked natively by the Space still held from
// landing or braking, skipping the results screen as soon as the key comes up.
function focusDefault(){const root=overlayRoot();if(!root||input.source!=='gamepad'||menuButtons(root).includes(document.activeElement))return;const b=$(G.mode==='brief'?'launchBtn':G.mode==='pause'?'resumeBtn':'replayBtn');try{b.focus({preventScroll:true});}catch(e){b.focus();}}
function moveFocus(root,dir){const list=menuButtons(root);if(!list.length)return;let i=list.indexOf(document.activeElement);i=i<0?list.indexOf($(G.mode==='brief'?'launchBtn':G.mode==='pause'?'resumeBtn':'replayBtn')):clamp(i+dir,0,list.length-1);if(i<0)i=0;list[i].focus();list[i].scrollIntoView?.({block:'nearest'});}
let navDir=0,navT=0;
// Gamepad and arrow-key navigation for the game's own screens (A / Enter picks, B backs out).
function handleMenus(dt){const root=overlayRoot();if(!root){navDir=0;return;}
 const v=input.vector('menu'),dir=v.y>.55?-1:v.y<-.55?1:v.x>.55?1:v.x<-.55?-1:0;
 if(dir&&dir!==navDir){moveFocus(root,dir);navT=.38;}else if(dir){navT-=dt;if(navT<=0){moveFocus(root,dir);navT=.13;}}
 navDir=dir;
 if(input.pressed('confirm')){const a=document.activeElement;if(a&&a.tagName==='BUTTON'&&menuButtons(root).includes(a))a.click();else if(G.mode==='pause')resumeGame();else launch();}
 else if(input.pressed('back')){if(G.mode==='pause')resumeGame();else if(G.mode==='win'||G.mode==='fail')briefing();}}
function handleGlobal(){
 if(input.pressed('mute'))sound.toggle();
 if(input.pressed('pause')){if(G.mode==='play')pauseGame();else if(G.mode==='pause'&&performance.now()-G.pausedAt>350)resumeGame();else if(G.mode==='win'||G.mode==='fail')briefing();}
 if(input.pressed('restart')&&G.mode!=='brief')launch();}
function syncTouchButtons(){if(!kit.touch)return;kit.touch.setShown('scan',(G.caseId===7&&G.phase===0)||(G.caseId===8&&G.phase===2&&!G.scanned));}
function syncUI(){const play=G.mode==='play';kit.touch?.suspend(!play,'game');syncTouchButtons();$('pauseBtn').classList.toggle('hide',!play);}
function readInput(){const mv=input.vector('move'),st=input.vector('steer'),lk=input.look('look'),src=input.source;
 // Mouse keeps the original feel (.00215 / .00195 rad per pixel); pad and touch are tamed.
 const sx=src==='gamepad'?.55:src==='touch'?.8:.8958,sy=src==='gamepad'?.55:src==='touch'?.8:.8125;
 IN.moveX=mv.x;IN.moveY=mv.y;IN.steerX=st.x;IN.steerY=st.y;
 if(G.mode==='play'){IN.lookX+=lk.x*sx;IN.lookY+=lk.y*sy;}else IN.lookX=IN.lookY=0;
 IN.lift=input.value('lift');IN.brake=input.down('brake');IN.boost=input.down('boost');IN.fire=input.down('fire');IN.scan=input.down('scan');}

// ---------------------------------------------------------------- HUD (Canvas2D overlay)
let W=innerWidth,H=innerHeight,compact=false,narrow=false,barH=64,touchB=0,touchL=0,touchR=0,mkTop=92,mkBottom=H-202;
let shownHint='',shownOp='',shownClock='',uiAcc=0;
function text(str,x,y,size=11,color='#a9e3df',align='left'){ctx.font=size+'px Consolas,"Courier New",monospace';ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.fillText(str,x,y);}
function line(x1,y1,x2,y2,color='#6b98997a',width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function poly(points,color,stroke=null){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function bar(x,y,w,f,color='#a9e3df',height=4){ctx.fillStyle='#29444b';ctx.fillRect(x,y,w,height);ctx.fillStyle=color;ctx.fillRect(x,y,w*clamp(f,0,1),height);}
const camPos=[41,32,222],camBasis={f:[0,0,-1],r:[1,0,0],u:[0,1,0]};
let camYaw=-.4,camPitch=-.1,camRoll=0,camFov=.99,appliedFov=0;
function project(pos){let v=sub(pos,camPos),z=dot(v,camBasis.f),t=Math.tan(camFov/2);return {x:W/2+dot(v,camBasis.r)/Math.max(.01,z)/t*H/2,y:H/2-dot(v,camBasis.u)/Math.max(.01,z)/t*H/2,z,d:len(v),v};}
function marker(pos,name,color,type='diamond',isEnemy=null){let p=project(pos),margin=42,bottom=mkBottom,top=mkTop;let onscreen=p.z>1&&p.x>margin&&p.x<W-margin&&p.y>top&&p.y<bottom;
 if(!onscreen){if(type==='enemy'&&!compact)top=148;const cm=clamp(H*.48,top+10,bottom-10);let x=p.x,y=p.y;if(p.z<=1){let dx=dot(p.v,camBasis.r);x=dx<0?margin:W-margin;y=cm;}else{let dx=x-W/2,dy=y-cm,s=Math.min((W/2-margin)/(Math.abs(dx)||1),(cm-top)/(Math.max(-dy,1)),(bottom-cm)/(Math.max(dy,1)));x=W/2+dx*s;y=cm+dy*s;}x=clamp(x,margin,W-margin);y=clamp(y,top,bottom);let a=Math.atan2(y-cm,x-W/2);ctx.save();ctx.translate(x,y);ctx.rotate(a);poly([[8,0],[-5,-5],[-3,0],[-5,5]],color);ctx.restore();let align=x<W/2?'left':'right',lx=x+(x<W/2?14:-14);text(name,lx,y-8,9,color,align);text(Math.round(p.d)+' M'+(p.z<0?' / BEHIND':''),lx,y+5,9,color,align);return;}
 const x=p.x,y=p.y,r=type==='enemy'?clamp(H*isEnemy.r/p.z,15,42):18;
 ctx.strokeStyle=color;ctx.lineWidth=1.2;
 if(type==='enemy'){for(let s of [-1,1]){line(x+s*r,y-r,x+s*(r-8),y-r,color,1.3);line(x+s*r,y-r,x+s*r,y-r+8,color,1.3);line(x+s*r,y+r,x+s*(r-8),y+r,color,1.3);line(x+s*r,y+r,x+s*r,y+r-8,color,1.3);}text(name,x,y-r-9,9,color,'center');bar(x-r,y+r+7,r*2,isEnemy.hp/isEnemy.maxHp,color,2);text(Math.round(p.d)+' M',x,y+r+22,9,color,'center');if(G.lock===isEnemy){ctx.beginPath();ctx.arc(x,y,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(G.lockTime,1));ctx.strokeStyle=G.lockTime>=1?'#ffce86':'#ff756d';ctx.lineWidth=1.6;ctx.stroke();if(G.lockTime>=1)text('LOCKED / '+K().missileShort,x,y-r-23,9,'#ffce86','center');}}
 else{poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],null,color);line(x-5,y,x+5,y,color);line(x,y-5,x,y+5,color);text(name,x,y-r-11,10,color,'center');text(Math.round(p.d)+' M',x,y+r+15,10,color,'center');}
}
const radarR=()=>compact?40:(H<650?53:65);
// Lift the scope over the touch controls only when they reach under it (portrait phones),
// and never above the middle of the screen (short landscape phones used to push it there).
function radarY(r){const cx=W/2;return compact?(touchB>0&&(cx-r-8<touchL||cx+r+8>W-touchR)?Math.max(H*.5+r+44,H-r-12-touchB):H-r-12):H-r-33;}
function drawRadar(){const r=radarR(),cx=W/2,range=280,cy=radarY(r),s=r/range,px=G.player.pos[0],pz=G.player.pos[2],a=G.player.yaw,ca=Math.cos(a),sa=Math.sin(a);
 const RX=(x,z)=>cx+((x-px)*ca+(z-pz)*sa)*s,RY=(x,z)=>cy-((x-px)*sa-(z-pz)*ca)*s;
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#071b22e6';ctx.fill();ctx.clip();
 ctx.beginPath();for(let b of buildings){if(Math.hypot(b.x-px,b.z-pz)>310)continue;const x0=b.x-b.w,x1=b.x+b.w,z0=b.z-b.d,z1=b.z+b.d;ctx.moveTo(RX(x0,z0),RY(x0,z0));ctx.lineTo(RX(x1,z0),RY(x1,z0));ctx.lineTo(RX(x1,z1),RY(x1,z1));ctx.lineTo(RX(x0,z1),RY(x0,z1));ctx.closePath();}ctx.fillStyle='#16333a';ctx.fill();ctx.strokeStyle='#285057';ctx.lineWidth=1;ctx.stroke();
 for(let k of [.5,1]){ctx.beginPath();ctx.arc(cx,cy,r*k,0,Math.PI*2);ctx.strokeStyle='#71979838';ctx.lineWidth=1;ctx.stroke();}line(cx-r,cy,cx+r,cy,'#71979838');line(cx,cy-r,cx,cy+r,'#71979838');
 const angle=G.visualT*.6;line(cx,cy,cx+Math.cos(angle)*r,cy+Math.sin(angle)*r,'#80bdbe26');
 for(let e of G.enemies){if(e.dead)continue;const x=RX(e.pos[0],e.pos[2]),y=RY(e.pos[0],e.pos[2]);if(e.kind==='turret')poly([[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]],'#ff756d');else poly([[x,y-4],[x+3.6,y+3],[x-3.6,y+3]],'#ff756d');}
 if(G.caseId===7&&G.ally.active){const x=RX(G.ally.pos[0],G.ally.pos[2]),y=RY(G.ally.pos[0],G.ally.pos[2]);ctx.fillStyle='#9aeeee';ctx.fillRect(x-3,y-4,6,8);}
 const home=G.phase===3,target=home?HOME:G.caseId===8&&G.hauler?G.hauler.pos:CARGO;let tp=[RX(target[0],target[2]),RY(target[0],target[2])],d=Math.hypot(tp[0]-cx,tp[1]-cy);if(d>r-6){tp=[cx+(tp[0]-cx)*(r-6)/d,cy+(tp[1]-cy)*(r-6)/d];}poly([[tp[0],tp[1]-4],[tp[0]+4,tp[1]],[tp[0],tp[1]+4],[tp[0]-4,tp[1]]],home?'#a9e3df':'#ffc083');
 poly([[cx,cy-5],[cx+4,cy+4],[cx,cy+2],[cx-4,cy+4]],'#edf3e9');ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r+.5,0,Math.PI*2);ctx.strokeStyle='#689a9d';ctx.lineWidth=1;ctx.stroke();text('TACTICAL / 280 M',cx,cy-r-10,9,'#84adaf','center');text('N',cx+Math.sin(-a)*r,cy-Math.cos(a)*r-3,8,'#ebd1a8','center');
}
const heading=p=>((p.yaw*180/Math.PI)%360+360)%360;
// Touch and small screens: the two console panels fold into one block under the top bar.
// On narrow (portrait) screens it scales to half the width so it never runs into the objective.
function compactStatus(p){const w=190,k=narrow?clamp((W/2-22)/w,.7,1):1,hot=p.hull<30;ctx.save();ctx.translate(W-w*k-12,barH+8);ctx.scale(k,k);const x=0,y=0;
 ctx.fillStyle='#0c2028d8';ctx.fillRect(x,y,w,84);ctx.strokeStyle='#53727777';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,83);
 text('HULL',x+9,y+17,9,'#a7c0c3');bar(x+56,y+11,90,p.hull/100,hot?'#ff756d':'#8bc7c4',5);text(Math.max(0,Math.ceil(p.hull))+'%',x+w-9,y+17,10,hot?'#ff756d':'#dde9df','right');
 text('BOOST',x+9,y+34,9,'#8eb5bc');bar(x+56,y+28,90,p.boost/100,'#dca064',4);
 text(p.overheat?'HOT':'GUN',x+9,y+51,9,p.overheat?'#ff756d':'#aac2c4');bar(x+56,y+45,90,p.heat,p.overheat?'#ff756d':'#dca064',4);
 text('MSL '+String(p.ammo).padStart(2,'0'),x+9,y+73,10,p.ammo?'#e4d1b2':'#ff756d');for(let i=0;i<8;i++){ctx.fillStyle=i<p.ammo?'#d6a16f':'#2c434b';ctx.fillRect(x+66+i*7,y+63,4,11);}
 text(G.lockTime>=1?'LOCKED':'HDG '+String(Math.round(heading(p))%360).padStart(3,'0'),x+w-9,y+73,9,G.lockTime>=1?'#ffd091':'#8bb7bd','right');ctx.restore();}
function cockpitHUD(p){
 // Canopy edge and machined console panels leave the central flight view open.
 poly([[0,H],[0,H*.89],[W*.10,H*.80],[W*.26,H*.845],[W*.37,H*.925],[W*.63,H*.925],[W*.74,H*.845],[W*.90,H*.80],[W,H*.89],[W,H]],'#07121bec','#344b56');
 poly([[0,H*.891],[W*.10,H*.797],[W*.26,H*.842],[W*.255,H*.852],[W*.10,H*.809],[0,H*.91]],'#24353f','#48616a');
 poly([[W,H*.891],[W*.90,H*.797],[W*.74,H*.842],[W*.745,H*.852],[W*.90,H*.809],[W,H*.91]],'#24353f','#48616a');
 line(0,64,27,104,'#45636b',2);line(W,64,W-27,104,'#45636b',2);
 for(let s of [-1,1]){let x=s<0?W*.045:W*.955;poly([[x,H*.85],[x+s*7,H*.852],[x+s*9,H*.884],[x,H*.882]],'#09131b','#50636b');}
 if(compact)compactStatus(p);
 else{const sz=H<650?.86:1;
  ctx.save();ctx.translate(30,H-165*sz);ctx.scale(sz,sz);poly([[0,0],[217,0],[243,20],[243,119],[0,119]],'#0c2028e8','#53727777');text('AIRFRAME / KESTREL 09',12,19,9,'#7ca1a9');text('HULL',12,41,9,'#a7c0c3');text(String(Math.max(0,Math.ceil(p.hull))).padStart(3,'0'),12,71,30,p.hull<30?'#ff756d':'#dde9df');text('%',73,69,13,'#799fa6');bar(109,48,111,p.hull/100,p.hull<30?'#ff756d':'#8bc7c4',9);text(p.hull<30?'HULL CRITICAL':'ARMOUR ONLINE',110,73,8,p.hull<30?'#ff756d':'#668e98');text('BOOST',12,96,9,'#8eb5bc');bar(68,89,151,p.boost/100,'#dca064',5);text('HOVER ASSIST / ACTIVE',12,111,8,'#567e8a');ctx.restore();
  ctx.save();ctx.translate(W-276*sz-18,H-165*sz);ctx.scale(sz,sz);poly([[24,0],[276,0],[276,119],[0,119],[0,22]],'#0c2028e8','#53727777');text('FIRE CONTROL / LINKED',24,19,9,'#7ca1a9');text('CANNON',17,40,9,'#aac2c4');text(p.overheat?'COOLING':'12.7 MM',257,40,10,p.overheat?'#ff756d':'#e3c49a','right');bar(17,48,240,p.heat,p.overheat?'#ff756d':'#dca064',4);text('IR MISSILES',17,73,9,'#a7c0c3');text(String(p.ammo).padStart(2,'0'),18,107,29,p.ammo?'#e4d1b2':'#ff756d');text(G.lockTime>=1?'TARGET LOCKED':'AUTO LOCK',78,91,10,G.lockTime>=1?'#ffd091':'#8bb7bd');text(K().missileShort+' TO FIRE',78,106,8,'#688f9a');for(let i=0;i<8;i++){ctx.fillStyle=i<p.ammo?'#d6a16f':'#2c434b';ctx.fillRect(179+i*10,83,5,19);}ctx.restore();}
 drawRadar();
}
function sidePanel(title,frac,color,sub){const x=W-(compact?12:39),y=compact?barH+110:147;text(title,x,y,9,'#a9e3df','right');bar(x-123,y+9,124,frac,color,3);text(sub,x,y+29,9,'#87aab0','right');}
function clockText(){const s=(85680+Math.floor(G.t))%86400;return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function missionHint(p,k){
 if(G.caseId===7){
  if(G.phase===0){const s=scanStatus(add(CARGO,[0,2,0]));return s.d>=70?'EAST DOCK / '+Math.round(s.d)+' M · '+k.fwd+' FORWARD · '+k.boost+' BOOST':G.scan>0&&IN.scan?'SCANNING · KEEP THE TRUCK IN VIEW':!s.slow?'HOLD '+k.brake+' TO STOP':!s.aim?'AIM AT THE AMBER TRUCK':'HOLD '+k.scan+' TO SCAN CARGO';}
  if(G.phase<3){const n=liveEnemies();return G.lockTime>=1?'MISSILE LOCK · '+k.missile:n?n+' HOSTILE'+(n>1?'S':'')+' · AIM TO LOCK · '+k.fire+' CANNON':dist(p.pos,G.ally.pos)>145?'VAN WAITING · FLY WITHIN 145 M':'ESCORT THE VAN / '+Math.max(0,Math.round(G.ally.pos[2]+140))+' M TO CARGO';}
 }else{const h=G.hauler;
  if(G.phase===0)return 'VANTA HAULER / '+Math.round(dist(p.pos,h.pos))+' M · '+k.fwd+' FORWARD · '+k.boost+' BOOST';
  if(G.phase===1){if(h.state!=='run')return 'HAULER GOING DOWN · STAY ON IT';if(G.lockTime>=1)return 'MISSILE LOCK · '+k.missile;return 'CUT THE ENGINE PODS · '+k.fire+' CANNON · PORTAL IN '+formatTime((ROUTE_L-h.s)/h.speed);}
  if(G.phase===2){const n=liveEnemies();if(G.scanned)return n?n+' INTERCEPTOR'+(n>1?'S':'')+' · CLEAR THE AREA':'AREA CLEAR';if(n&&G.lockTime>=1)return 'MISSILE LOCK · '+k.missile;const s=scanStatus(add(h.pos,[0,1.5,0]));return G.scan>0&&IN.scan?'SCANNING · KEEP THE HAULER IN VIEW':s.d>=70?'DOWNED HAULER / '+Math.round(s.d)+' M · MOVE WITHIN 70 M':!s.slow?'HOLD '+k.brake+' TO STOP':!s.aim?'AIM AT THE HAULER':'HOLD '+k.scan+' TO SCAN THE HAULER';}
 }
 const d=Math.hypot(p.pos[0]-HOME[0],p.pos[2]-HOME[2]);return d>24?'RETURN TO PAD 09 / '+Math.round(d)+' M':p.pos[1]>=16?'HOLD '+k.down+' TO DESCEND BELOW 16 M':len(p.vel)>10?'HOLD '+k.brake+' TO BRAKE':'HOLD '+k.brake+' TO LAND';}
function drawHUD(dt){ctx.clearRect(0,0,W,H);
 if(G.mode==='brief'){if(W>700){const info=CASE_INFO[G.caseId];let x=W*.80,y=H*.28;text(info.num,x,y,58,'#bdcbc738','center');line(x-47,y+10,x+47,y+10,'#80aaa342');text(info.place,x,y+28,10,'#bfd5d166','center');}return;}
 if(!G.player)return;let p=G.player,cx=W/2,cy=H/2,k=K();
 mkTop=compact?barH+100:92;mkBottom=compact?radarY(radarR())-radarR()-18:H-202;if(mkBottom<mkTop+40)mkBottom=mkTop+40;
 cockpitHUD(p);
 // Heading strip.
 if(!compact){let hdg=heading(p),y=85;
  ctx.save();ctx.beginPath();ctx.rect(cx-165,66,330,46);ctx.clip();for(let d=-60;d<=60;d+=5){let deg=Math.floor(hdg/5)*5+d,off=wrap((deg-hdg)*Math.PI/180)*180/Math.PI,x=cx+off*4.1;line(x,y-5,x,y+(deg%10===0?4:0),'#87b3b68a');if(deg%30===0){let n=((deg%360)+360)%360;text(n===0?'N':n===90?'E':n===180?'S':n===270?'W':n.toString().padStart(3,'0'),x,y+18,10,'#a0c3c3','center');}}ctx.restore();poly([[cx-4,68],[cx+4,68],[cx,74]],'#ffc083');text(Math.round(hdg).toString().padStart(3,'0'),cx,119,10,'#d8c19e','center');}
 // Peripheral flight tapes, readable without covering the target.
 let lx=cx-Math.min(260,W*.24),rx=cx+Math.min(260,W*.24),tapeY=cy-70;
 text('ALT / M',lx-7,tapeY-18,8,'#83b0b5','right');text('SPD / M/S',rx+7,tapeY-18,8,'#83b0b5');
 for(let i=-3;i<=3;i++){let yy=cy+i*20;line(lx-14,yy,lx,yy,'#7da6a66b');line(rx,yy,rx+14,yy,'#7da6a66b');}
 poly([[lx-49,cy-12],[lx-9,cy-12],[lx,cy],[lx-9,cy+12],[lx-49,cy+12]],'#0b202699','#aac6bf');text(Math.round(p.pos[1]).toString().padStart(3,'0'),lx-13,cy+4,13,'#d3e2d7','right');poly([[rx+49,cy-12],[rx+9,cy-12],[rx,cy],[rx+9,cy+12],[rx+49,cy+12]],'#0b202699','#aac6bf');text(Math.round(len(p.vel)).toString().padStart(2,'0'),rx+14,cy+4,13,'#d3e2d7');
 // Flight sight and horizon bars.
 const color=p.overheat?'#ff8a75':G.lockTime>=1?'#ffd093':'#b5dfd5';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,12,.25,Math.PI-.25);ctx.arc(cx,cy,12,Math.PI+.25,Math.PI*2-.25);ctx.stroke();line(cx-26,cy,cx-15,cy,color);line(cx+15,cy,cx+26,cy,color);line(cx,cy-25,cx,cy-15,color);ctx.fillStyle=color;ctx.fillRect(cx-1,cy-1,2,2);
 ctx.save();ctx.translate(cx,cy);ctx.rotate(-p.roll);let horizon=clamp(p.pitch*90,-56,56);line(-105,horizon,-59,horizon,'#97c1bb68');line(59,horizon,105,horizon,'#97c1bb68');line(-59,horizon,-59,horizon+5,'#97c1bb68');line(59,horizon,59,horizon+5,'#97c1bb68');ctx.restore();
 if(G.hitFlash>0){for(let x of [-1,1])for(let y of [-1,1])line(cx+x*16,cy+y*16,cx+x*23,cy+y*23,'#ffce8c',2);}
 if(G.hurtT>0){const d=G.hurtDir,sx=dot(d,camBasis.r),sy=-dot(d,camBasis.u);let a=Math.atan2(sy,sx);if(Math.hypot(sx,sy)<.15)a=dot(d,camBasis.f)<0?Math.PI/2:-Math.PI/2;
  ctx.globalAlpha=Math.min(1,G.hurtT*1.4);ctx.beginPath();ctx.arc(cx,cy,compact?56:76,a-.38,a+.38);ctx.strokeStyle='#ff756d';ctx.lineWidth=4;ctx.stroke();ctx.globalAlpha=1;}
 const h=G.hauler;
 if(G.caseId===7&&G.phase===0)marker(add(CARGO,[0,4,0]),'CARGO / 07','#ffbf79');
 if(G.caseId===8&&h){
  if(G.phase===0)marker(add(h.pos,[0,7,0]),'VANTA HAULER','#ffbf79');
  else if(G.phase===1&&(h.state!=='run'||dist(p.pos,h.pos)>160))marker(add(h.pos,[0,7,0]),h.state==='run'?'VANTA HAULER':'HAULER / GOING DOWN','#ffbf79');
  else if(G.phase===2&&!G.scanned)marker(add(h.pos,[0,6,0]),'DOWNED HAULER / SCAN','#ffbf79');}
 for(let e of G.enemies){if(e.dead)continue;
  // During the chase the hauler's own marker leads; its engine pods get theirs in weapons range.
  if(e.kind==='pod'&&G.phase===0&&G.lock!==e&&dist(p.pos,e.pos)>330)continue;
  marker(e.pos,(e.kind==='pod'?'ENGINE POD / '+(e.side<0?'L':'R'):e.kind==='turret'?'GROUND TURRET / '+String(e.id).padStart(2,'0'):e.kind==='interceptor'?'INTERCEPTOR / '+String(e.id).padStart(2,'0'):e.kind==='escort'?'ESCORT / '+String(e.id).padStart(2,'0'):'GUNSHIP / '+String(e.id).padStart(2,'0')),'#ff8b7f','enemy',e);}
 if(G.caseId===7&&G.ally.active&&G.phase<3)marker(add(G.ally.pos,[0,7,0]),'UNIT 04 / '+Math.ceil(G.ally.hull)+'%','#9ce5ed');
 if(G.phase===3)marker(add(HOME,[0,5,0]),'HOME / PAD 09','#a9e3df');
 const scanning=((G.caseId===7&&G.phase===0)||(G.caseId===8&&G.phase===2&&!G.scanned))&&G.scan>0&&IN.scan;
 if(scanning){const yy=cy+(H<650?36:59);text((G.caseId===7?'CARGO SCAN / ':'HAULER SCAN / ')+Math.floor(G.scan*100)+'%',cx,yy,10,'#ffc083','center');bar(cx-90,yy+10,180,G.scan,'#ffc083',3);}
 if(G.dock>0&&G.phase===3){const yy=cy+(H<650?36:59);text('LANDING / '+Math.min(100,Math.floor(G.dock/2.4*100))+'%',cx,yy,10,'#a9e3df','center');bar(cx-90,yy+10,180,G.dock/2.4,'#a9e3df',3);}
 if(G.caseId===7&&(G.phase===1||G.phase===2))sidePanel('UNIT 04',G.ally.hull/100,G.ally.hull<40?'#ff756d':'#8fd4d8',G.ally.moving?'MOVING':'HOLDING');
 if(G.caseId===8&&h&&G.phase<=1){const eta=(ROUTE_L-h.s)/(h.speed||1);sidePanel('VANTA HAULER',h.s/ROUTE_L,h.state==='run'&&eta<25?'#ff756d':'#dca064',h.state==='run'?'PORTAL ETA '+formatTime(eta):'ENGINES OUT');}
 uiAcc+=dt;if(uiAcc>.08){uiAcc=0;const hint=G.hintTime>0?G.lastHint:p.overheat?'CANNON HOT · RELEASE FIRE TO COOL':missionHint(p,k);
  if(hint!==shownHint){shownHint=hint;$('statusHint').textContent=hint;}
  const op=(scanning&&G.hintTime<=0)||(G.phase===3&&G.dock>0&&IN.brake)?'0':'1';if(op!==shownOp){shownOp=op;$('statusHint').style.opacity=op;}
  const clock=clockText();if(clock!==shownClock){shownClock=clock;$('clockLabel').textContent=clock;}}
}

// ---------------------------------------------------------------- layout
function readTouchInsets(){const s=document.documentElement.style;touchB=parseFloat(s.getPropertyValue('--kit-touch-bottom'))||0;touchL=parseFloat(s.getPropertyValue('--kit-touch-left'))||0;touchR=parseFloat(s.getPropertyValue('--kit-touch-right'))||0;}
function placePills(){if(!kit.touch)return;let y=barH+100;if(!$('flightUI').classList.contains('hide')){const r=$('objective').getBoundingClientRect();if(r.height)y=Math.round(r.bottom+8);}kit.touch.placeTop('left',y);}
function syncCompact(force){readTouchInsets();const touchOn=document.documentElement.classList.contains('kit-touch-on'),c=touchOn||W<700||H<460,nw=W<640;barH=H<=620?54:64;
 if(c!==compact||nw!==narrow||force===true){compact=c;narrow=nw;document.body.classList.toggle('compact',c);document.body.classList.toggle('narrow',nw);placePills();}}
function resizeHud(w,h){W=w;H=h;const dpr=Math.min(devicePixelRatio||1,1.5);hc.width=Math.floor(W*dpr);hc.height=Math.floor(H*dpr);ctx.setTransform(hc.width/W,0,0,hc.height/H,0,0);syncCompact(true);}

// ---------------------------------------------------------------- scene sync
function placeObj(o,x,y,z,yaw,pitch,roll){o.position.set(x,y,z);o.rotation.set(pitch,-yaw,roll,'YXZ');}
function renderScene(dt){const t=G.visualT,brief=G.mode==='brief';let targetFov=.99;
 if(brief){camPos[0]=36+Math.sin(t*.09)*1.8;camPos[1]=25;camPos[2]=206;camYaw=-.86+Math.sin(t*.075)*.025;camPitch=-.025;camRoll=0;targetFov=1.01;}
 else if(G.player){const p=G.player;camPos[0]=p.pos[0];camPos[1]=p.pos[1]+Math.sin(t*1.4)*.09;camPos[2]=p.pos[2];camYaw=p.yaw;camPitch=p.pitch;camRoll=p.roll;if(G.mode==='play'&&G.boostOn&&len(p.vel)>45)targetFov=1.045;}
 // The boost widening eases in and out instead of snapping.
 camFov+=(targetFov-camFov)*(1-Math.exp(-dt*8));if(Math.abs(camFov-appliedFov)>1e-4){appliedFov=camFov;camera.fov=camFov*180/Math.PI;camera.updateProjectionMatrix();}
 basisInto(camBasis,camYaw,camPitch,camRoll);
 camera.position.set(camPos[0],camPos[1],camPos[2]);camera.rotation.set(camPitch,-camYaw,camRoll,'YXZ');sky.position.copy(camera.position);
 dyn0.begin();dyn2.begin();
 previewMesh.visible=brief;if(brief)placeObj(previewMesh,12,14+Math.sin(t*.7)*.45,164,2.63,.02,Math.sin(t*.5)*.015);
 const allyOn=!!(G.caseId===7&&G.ally&&G.ally.active);vanMesh.visible=allyOn;
 if(allyOn){const a=G.ally.pos;vanMesh.position.set(a[0],a[1],a[2]);if(Math.sin(t*12)>0)dBox(a[0]-.8,a[1]+4.5,a[2]-1,1,.2,.7,.27,.86,1,2);else dBox(a[0]+.8,a[1]+4.5,a[2]-1,1,.2,.7,.1,.42,1,2);}
 shipPool.begin();turretPool.begin();
 for(const e of G.enemies){if(e.kind==='pod')continue;if(e.dead){if(e.kind==='turret')dBox(e.pos[0],1.5,e.pos[2],6,3,6,.07,.062,.06,0);continue;}
  if(e.kind==='turret')placeObj(turretPool.next(),e.pos[0],0,e.pos[2],e.yaw,0,0);else placeObj(shipPool.next(),e.pos[0],e.pos[1],e.pos[2],e.yaw,0,e.roll);
  if(e.flash>0)dBox(e.pos[0],e.pos[1]+1,e.pos[2],3,1,3,.75,.55,.35,2);}
 shipPool.end();turretPool.end();
 const h=G.hauler;haulerObj.visible=!!h&&!brief;
 if(h&&!brief){placeObj(haulerObj,h.pos[0],h.pos[1],h.pos[2],h.yaw,h.pitch,h.roll);for(let i=0;i<2;i++){const pd=h.pods[i];podMeshes[i].visible=!pd.dead;if(!pd.dead&&pd.flash>0)dBox(pd.pos[0],pd.pos[1]+1.8,pd.pos[2],2.4,.5,2.4,.75,.55,.35,2);}}
 let nc=0,na=0;
 for(let i=0;i<traffic.length;i++){const v=traffic[i];
  if(v.air){const x=pmod(v.x+t*v.speed+700,900)-450;if(Math.hypot(x-camPos[0],v.y-camPos[1],v.z-camPos[2])<390)setInst(airInst,na++,x,v.y,v.z,0);}
  else{let z=pmod(v.z+t*v.speed+20000,168)-84,x=v.x;if(i>7){x=(i%2?1:-1)*(i>13?194:116);z=pmod(v.z+t*v.speed+20000,620)-310;}if(Math.hypot(x-camPos[0],.1-camPos[1],z-camPos[2])<340)setInst(carInst,nc++,x,.1,z,v.speed>0?Math.PI:0);}}
 carInst.count=nc;airInst.count=na;carInst.instanceMatrix.needsUpdate=true;airInst.instanceMatrix.needsUpdate=true;
 for(const b of G.bolts){const l=Math.hypot(b.vel[0],b.vel[1],b.vel[2])||1,k=3.3/l;dRod(b.pos[0]-b.vel[0]*k,b.pos[1]-b.vel[1]*k,b.pos[2]-b.vel[2]*k,b.pos[0],b.pos[1],b.pos[2],.21,1,.27,.08,2,4);}
 for(const a of G.traces){const bright=Math.max(.18,a.life/a.max);dRod(a.a[0],a.a[1],a.a[2],a.b[0],a.b[1],a.b[2],a.width,a.color[0]*bright,a.color[1]*bright,a.color[2]*bright,2,3);}
 for(const m of G.missiles){const l=Math.hypot(m.vel[0],m.vel[1],m.vel[2])||1,nx=m.vel[0]/l,ny=m.vel[1]/l,nz=m.vel[2]/l,P=m.pos;
  dRod(P[0],P[1],P[2],P[0]-nx*2.1,P[1]-ny*2.1,P[2]-nz*2.1,.21,C.metal[0],C.metal[1],C.metal[2],0,5);dRod(P[0]-nx*2.1,P[1]-ny*2.1,P[2]-nz*2.1,P[0]-nx*5.1,P[1]-ny*5.1,P[2]-nz*5.1,.16,C.amber[0],C.amber[1],C.amber[2],2,4);}
 const R=camBasis.r,U=camBasis.u;
 for(const q of G.particles){const f=clamp(q.life/q.max,0,1),r=q.size*(q.max>1?2-f:.4+f),k=q.max>1?.4:f,P=q.pos,s=q.max>1?dyn0:dyn2,ax=R[0]*r,ay=R[1]*r,az=R[2]*r,bx=U[0]*r,by=U[1]*r,bz=U[2]*r;
  s.quad(P[0]-ax-bx,P[1]-ay-by,P[2]-az-bz,P[0]-bx+ax,P[1]-by+ay,P[2]-bz+az,P[0]+ax+bx,P[1]+ay+by,P[2]+az+bz,P[0]-ax+bx,P[1]-ay+by,P[2]-az+bz,q.color[0]*k,q.color[1]*k,q.color[2]*k);}
 if(!brief&&IN.scan&&G.scan>0){if(G.caseId===7&&G.phase===0){dRing(0,1+((t*12)%10),-155,9,C.amber,.15);dRing(0,.7,-155,12,[.54,.34,.15],.15);}else if(G.caseId===8&&G.phase===2&&h&&!G.scanned){dRing(h.pos[0],h.pos[1]-2.6+((t*8)%7),h.pos[2],11,C.amber,.15);}}
 if(!brief&&G.phase===3)dRing(HOME[0],1.4,HOME[2],25.6+.4*Math.sin(t*2),C.cyan,.22);
 cockpitMesh.visible=!brief&&!!G.player;
 dyn0.commit();dyn2.commit();
}

// ---------------------------------------------------------------- wiring
$('launchBtn').onclick=launch;$('replayBtn').onclick=launch;$('restartBtn').onclick=launch;$('resumeBtn').onclick=resumeGame;$('briefBtn').onclick=briefing;$('quitBtn').onclick=briefing;$('pauseBtn').onclick=pauseGame;$('muteBtn').onclick=()=>sound.toggle();
$('settingsBtn').onclick=()=>kit.menu.open();$('pauseSettingsBtn').onclick=()=>kit.menu.open();
$('nextBtn').onclick=()=>{selectCase(8);launch();};
document.querySelectorAll('.case-btn').forEach(b=>b.addEventListener('click',()=>selectCase(+b.dataset.case)));
document.querySelectorAll('#diffPick button').forEach(b=>b.addEventListener('click',()=>selectDiff(b.dataset.diff)));
// A click on the flight view (re)captures the mouse; losing the capture mid-flight pauses.
canvas.addEventListener('pointerdown',e=>{if(G.mode==='play'&&e.pointerType==='mouse'&&document.pointerLockElement!==canvas)input.lockPointer();});
let wasLocked=false;
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(locked)$('mouseNote').classList.add('hide');if(wasLocked&&!locked&&G.mode==='play')pauseGame();wasLocked=locked;});
document.addEventListener('pointerlockerror',()=>{if(G.mode==='play'&&input.source==='keyboard')$('mouseNote').classList.remove('hide');});
window.addEventListener('blur',()=>{clearInput();if(G.mode==='play')pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='play')pauseGame();});
// Audio started by a gamepad press stays suspended until a real gesture: resume on the next one.
const unlockAudio=()=>{if(sound.ctx&&sound.ctx.state==='suspended'&&!kit.paused&&G.mode!=='pause')sound.ctx.resume().catch(()=>{});};
addEventListener('pointerdown',unlockAudio,true);addEventListener('keydown',unlockAudio,true);
kit.onPause(p=>{if(p)sound.pause();else if(G.mode!=='pause')sound.resume();});
input.onSourceChange(src=>{refreshPrompts();syncCompact();if(src==='gamepad')focusDefault();});
kit.onResize(resizeHud);
new MutationObserver(()=>syncCompact()).observe(document.documentElement,{attributes:true,attributeFilter:['class','style']});

// ---------------------------------------------------------------- start
sound.label();renderBrief();reset();G.mode='brief';refreshPrompts();syncUI();
kit.loading.progress(.85,'Compiling shaders…');
renderScene(0);
try{await kit.renderer.compileAsync(scene,camera);}catch(e){console.warn('Shader pre-compile skipped:',e);}
const STEP=1/60;let accumulator=0,frames=0;
kit.start(dt=>{
 readInput();handleGlobal();
 if(G.mode==='play'&&input.pressed('missile'))fireMissile();
 handleMenus(dt);
 accumulator=Math.min(accumulator+dt,.25);let steps=0;
 while(accumulator>=STEP&&steps<15){tick(STEP);accumulator-=STEP;steps++;}
 if(G.mode==='brief')sound.update(0,0,false);
 uDamage.value=G.damageFlash;
 if(AIHub.active&&G.mode==='brief')launch();
 if(AIHub.active&&G.mode==='play')AIHub.progress({score:G.phase,label:PHASES[G.caseId][G.phase][0]});
 renderScene(dt);post.render();drawHUD(dt);frames++;
});
focusDefault();

// Side by side: the hub opens the round, so the title is skipped and the run waits for the clock (launch above).
// No hub after all: the title stays.
if(AIHub.active){
 $('brief').classList.add('hide');
 AIHub.connect({mode:'parallel',seats:[1,4]}).then(info=>{if(info)AIHub.ready();else $('brief').classList.remove('hide');});
 AIHub.on('end',()=>{sessionOver=true;if(G.mode!=='win'&&G.mode!=='fail')G.mode='over';clearInput();sound.stopVoice();if(sound.master)sound.master.gain.value=0;['replayBtn','nextBtn','briefBtn','quitBtn'].forEach(id=>$(id).classList.add('hide'));});
}

// Read-only diagnostics support offline verification without adding game controls.
window.hoverDuty=Object.freeze({snapshot:()=>({mode:G.mode,caseId:G.caseId,difficulty:G.diff,phase:G.phase,time:G.t,position:G.player?[...G.player.pos]:null,velocity:G.player?[...G.player.vel]:null,yaw:G.player?.yaw,pitch:G.player?.pitch,hull:G.player?.hull,ammo:G.player?.ammo,heat:G.player?.heat,scan:G.scan,scanned:G.scanned,lock:G.lock?.id??null,lockTime:G.lockTime,dock:G.dock,kills:G.kills,ally:G.ally?{...G.ally,pos:[...G.ally.pos]}:null,hauler:G.hauler?{pos:[...G.hauler.pos],s:G.hauler.s,route:ROUTE_L,state:G.hauler.state,pods:G.hauler.pods.map(p=>p.hp)}:null,enemies:G.enemies.map(e=>({id:e.id,kind:e.kind,pos:[...e.pos],hp:e.hp,dead:e.dead})),stats:{...G.stats},audio:sound.ctx?{state:sound.ctx.state,muted:sound.muted,events:sound.events,voices:Object.keys(sound.voices).length}:null,graphics:{frames,backend:kit.backend,worldVertices,width:kit.size.width,height:kit.size.height},compact,pointerLocked:document.pointerLockElement===canvas})});
