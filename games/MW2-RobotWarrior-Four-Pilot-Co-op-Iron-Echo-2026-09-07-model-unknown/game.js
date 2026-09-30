/* RobotWarrior — Four-Pilot Co-op / Iron Echo. All distances are meters.
   Simulation, HUD, audio and co-op live here. render.js draws the world with
   three.js r186 through the shared kit (WebGPU with a WebGL2 fallback) and
   net.js holds the co-op transports. Solo play loads only the game's own files. */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { R, uNight, upload, blend, draw, beginFrame, renderFrame, setCamera, warmUp, prebuildEdges } from './render.js';
import { LanceTransport, LanceRelayTransport } from './net.js';

let coop=null; // Network state is optional. Solo mode has no network requests.

const $=id=>document.getElementById(id), TAU=Math.PI*2, DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{let l=Math.hypot(...a)||1;return a.map(x=>x/l)};
let seed=82731;function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}const rand=(a,b)=>mix(a,b,random());
const hex=s=>{let n=parseInt(s.replace('#',''),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
const M={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 // `o` lets hot paths write into a scratch matrix instead of allocating (it must not be a or b).
 mul:(a,b,o=new Float32Array(16))=>{for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o},
 transform:(p=[0,0,0],s=[1,1,1],r=[0,0,0],o=new Float32Array(16))=>{let cx=Math.cos(r[0]),sx=Math.sin(r[0]),cy=Math.cos(r[1]),sy=Math.sin(r[1]),cz=Math.cos(r[2]),sz=Math.sin(r[2]);o[0]=(cy*cz+sy*sx*sz)*s[0];o[1]=cx*sz*s[0];o[2]=(-sy*cz+cy*sx*sz)*s[0];o[3]=0;o[4]=(-cy*sz+sy*sx*cz)*s[1];o[5]=cx*cz*s[1];o[6]=(sy*sz+cy*sx*cz)*s[1];o[7]=0;o[8]=sy*cx*s[2];o[9]=-sx*s[2];o[10]=cy*cx*s[2];o[11]=0;o[12]=p[0];o[13]=p[1];o[14]=p[2];o[15]=1;return o},
 point:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
 vector:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]],
 view:(eye,target)=>{const z=norm(vsub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])},
 perspective:(fov,asp,near,far,offset=0)=>{let f=1/Math.tan(fov/2);return new Float32Array([f/asp,0,0,0,0,f,0,0,0,offset,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
};

/* Controls. The game asks about actions, never devices, so keyboard and mouse,
   gamepad and touch all drive the same code. The keyboard keeps the original sim
   layout: W/S set the throttle, A/D turn the legs, the mouse or arrows twist the torso. */
const ACTIONS={
 drive:{type:'vector',keys:{up:['KeyW'],down:['KeyS'],left:['KeyA'],right:['KeyD']},gamepad:'leftStick',touch:'stick',clamp:false},
 aim:{type:'vector',keys:{up:['ArrowUp'],down:['ArrowDown'],left:['ArrowLeft','KeyQ'],right:['ArrowRight','KeyE']},gamepad:[],clamp:false},
 look:{type:'look',mouse:'drag',gamepad:'rightStick',touch:'drag'},
 fire:{keys:['Space'],mouse:[0],gamepad:['RT'],touch:'Fire'},
 jets:{keys:['ShiftLeft','ShiftRight'],gamepad:['A','LT'],touch:'Jets'},
 targetNext:{keys:['KeyT'],gamepad:['Y'],touch:'Target'},
 weaponNext:{gamepad:['RB'],touch:'Weapon'},
 stop:{keys:['KeyX'],gamepad:['B'],touch:'Stop'},
 coolant:{keys:['KeyG'],gamepad:['Down'],touch:{label:'Cool',slot:'top'}},
 imaging:{keys:['KeyI'],gamepad:['Left'],touch:{label:'Scan',slot:'top'}},
 align:{keys:['KeyC'],gamepad:['LS'],touch:{label:'Align',slot:'top'}},
 map:{keys:['KeyM'],gamepad:['Back'],touch:{label:'Map',slot:'top'}},
 pause:{keys:['Escape','KeyP'],gamepad:['Start'],touch:{label:'II',slot:'top'}},
 restore:{keys:['KeyJ'],gamepad:['B'],touch:{label:'Restore',slot:'top'}},
 target:{keys:['KeyR']},
 weaponPrev:{gamepad:['LB']},
 full:{keys:['KeyB'],gamepad:['Up']},
 fireAll:{keys:['KeyF'],gamepad:['X']},
 nav:{keys:['KeyN'],gamepad:['Right']},
 zoom:{keys:['KeyZ'],gamepad:['RS']},
 center:{keys:['Home']},
 vision:{keys:['KeyV']},
 weapon1:{keys:['Digit1','Numpad1']},weapon2:{keys:['Digit2','Numpad2']},weapon3:{keys:['Digit3','Numpad3']},
 help:{keys:['KeyH']},
 mute:{keys:['KeyU']},
 start:{keys:['Enter','NumpadEnter']},
 // Menus: arrows, the left stick or the D-pad move the focus, A confirms, B goes back.
 uiMove:{type:'vector',keys:{up:['ArrowUp'],down:['ArrowDown'],left:['ArrowLeft'],right:['ArrowRight']},gamepad:'leftStick+dpad',clamp:false},
 confirm:{gamepad:['A']},
 back:{gamepad:['B']}
};
const kit=await boot({
 title:'RobotWarrior',
 canvas:$('world'),
 renderer:{antialias:false}, // hard pixels, as the original drew them
 gear:'none', // the title screen and the pause menu carry a Settings button
 accent:'#f58b51',background:'#141c1b',
 touch:{top:'right',topOffset:46},
 input:ACTIONS
});
const input=kit.input,world=kit.canvas,hud=$('hud'),ctx=hud.getContext('2d');
// The old renderer wrote its colours straight to the screen: no sRGB conversion, no tone mapping.
kit.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
kit.loading.progress(.7,'Building Kestrel Basin…');
await new Promise(r=>setTimeout(r,30));
// Tab targets the next contact in combat, but moves the focus in menus: bind it only while piloting.
let tabBound=false;
function bindCombatKeys(on){if(on===tabBound)return;tabBound=on;input.define({targetNext:{...ACTIONS.targetNext,keys:on?['KeyT','Tab']:['KeyT']}})}
// Button prompts follow the device in use: radio lines and HUD hints carry {action} slots.
const PROMPTS={
 keyboard:{throttle:'W/S',turn:'A/D',full:'B',stop:'X',target:'R',imaging:'I',coolant:'G',weapons:'1–3',help:'H',map:'M',restore:'J',fire:'SPACE',fireAll:'F',jets:'SHIFT',nav:'N',zoom:'Z',align:'C',pause:'ESC',vision:'V'},
 gamepad:{throttle:'L-STICK ↑↓',turn:'L-STICK ↔',full:'D-PAD ↑',stop:'B',target:'Y',imaging:'D-PAD ←',coolant:'D-PAD ↓',weapons:'LB/RB',help:'START',map:'BACK',restore:'HOLD B',fire:'RT',fireAll:'X',jets:'A',nav:'D-PAD →',zoom:'R3',align:'L3',pause:'START',vision:'MENU'},
 touch:{throttle:'STICK ↑↓',turn:'STICK ↔',full:'STICK ↑',stop:'STOP',target:'TARGET',imaging:'SCAN',coolant:'COOL',weapons:'WEAPON',help:'II',map:'MAP',restore:'RESTORE',fire:'FIRE',fireAll:'FIRE',jets:'JETS',nav:'MAP',zoom:'PINCH',align:'ALIGN',pause:'II',vision:'II'}
};
const promptSource=()=>input.source==='gamepad'?'gamepad':input.source==='touch'?'touch':'keyboard';
function key(name){return PROMPTS[promptSource()][name]||PROMPTS.keyboard[name]||String(name).toUpperCase()}
const promptCache=new Map();input.onSourceChange(()=>promptCache.clear());
/** Replace {action} slots with the current device's button names (cached; the HUD asks every frame). */
function prompted(text){if(!text||!text.includes('{'))return text;let v=promptCache.get(text);if(v===undefined){v=text.replace(/\{(\w+)\}/g,(_,n)=>key(n));if(promptCache.size>240)promptCache.clear();promptCache.set(text,v)}return v}
const promptText=prompted;
function polygon(out,points,color=[1,1,1],outward=false){let n=norm(cross(vsub(points[1],points[0]),vsub(points[2],points[0])));if(outward&&dot(n,points.reduce((a,p)=>vadd(a,p),[0,0,0]))<0){points=points.slice().reverse();n=vmul(n,-1)}for(let i=1;i<points.length-1;i++)for(let p of[points[0],points[i],points[i+1]])out.push(...p,...n,...color)}
function boxGeom(bevel=0){let out=[],b=1-bevel;for(let axis=0;axis<3;axis++)for(let sign of[-1,1]){let a=(axis+1)%3,c=(axis+2)%3,ps=[];for(let uv of[[-b,-b],[b,-b],[b,b],[-b,b]]){let p=[0,0,0];p[axis]=sign;p[a]=uv[0];p[c]=uv[1];ps.push(p)}polygon(out,ps,[1,1,1],true)}if(bevel){for(let axis=0;axis<3;axis++){let a=(axis+1)%3,c=(axis+2)%3;for(let sa of[-1,1])for(let sc of[-1,1]){let ps=[];for(let q of[[-b,1,b],[b,1,b],[b,b,1],[-b,b,1]]){let p=[0,0,0];p[axis]=q[0];p[a]=q[1]*sa;p[c]=q[2]*sc;ps.push(p)}polygon(out,ps,[1,1,1],true)}}for(let x of[-1,1])for(let y of[-1,1])for(let z of[-1,1])polygon(out,[[x,b*y,b*z],[b*x,y,b*z],[b*x,b*y,z]],[1,1,1],true)}return out}
function cylinderGeom(n=10,top=1){let out=[];for(let i=0;i<n;i++){let a=i/n*TAU,b=(i+1)/n*TAU,p=[Math.cos(a),-1,Math.sin(a)],q=[Math.cos(b),-1,Math.sin(b)],r=[q[0]*top,1,q[2]*top],s=[p[0]*top,1,p[2]*top];polygon(out,[p,q,r,s],[1,1,1],true);polygon(out,[[0,-1,0],q,p],[1,1,1],true);if(top)polygon(out,[[0,1,0],s,r],[1,1,1],true)}return out}
function sphereGeom(rings=7,n=12){let out=[];function pt(a,b){return[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)]}for(let j=0;j<rings;j++)for(let i=0;i<n;i++)polygon(out,[pt(j/rings*Math.PI,i/n*TAU),pt(j/rings*Math.PI,(i+1)/n*TAU),pt((j+1)/rings*Math.PI,(i+1)/n*TAU),pt((j+1)/rings*Math.PI,i/n*TAU)],[1,1,1],true);return out}
function dishGeom(){let out=[];for(let j=0;j<4;j++)for(let i=0;i<18;i++){const p=(r,a)=>[r*Math.cos(a),r*Math.sin(a),r*r*.55];polygon(out,[p(j/4,i/18*TAU),p((j+1)/4,i/18*TAU),p((j+1)/4,(i+1)/18*TAU),p(j/4,(i+1)/18*TAU)]);polygon(out,[p(j/4,(i+1)/18*TAU),p((j+1)/4,(i+1)/18*TAU),p((j+1)/4,i/18*TAU),p(j/4,i/18*TAU)])}return out}
function rockGeom(variant){let out=[],n=7,levels=[-1,-.14,.54,1],radii=[1,.86,.61,.29],rings=[];for(let j=0;j<4;j++){let ring=[];for(let i=0;i<n;i++){let a=i/n*TAU+variant*.41,r=radii[j]*(.86+.21*Math.sin(i*13.1+variant*4.8+j*.7));ring.push([Math.cos(a)*r+.13*j*Math.sin(variant*2),levels[j]+(j===0?0:.07*Math.cos(i*3.4+variant)),Math.sin(a)*r+.05*j*Math.cos(variant)])}rings.push(ring)}for(let j=0;j<3;j++)for(let i=0;i<n;i++){let k=(i+1)%n,c=[1,1,1].map(v=>v*(.93+.05*Math.cos(i*4+j+variant)));polygon(out,[rings[j][i],rings[j][k],rings[j+1][k]],c,true);polygon(out,[rings[j][i],rings[j+1][k],rings[j+1][i]],c,true)}polygon(out,rings[3],[1,1,1],true);return out}
function ringGeom(n=48,width=.015){let out=[];for(let i=0;i<n;i++){let a=i/n*TAU,b=(i+1)/n*TAU;polygon(out,[[Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)],[Math.cos(b)*(1-width),0,Math.sin(b)*(1-width)],[Math.cos(a)*(1-width),0,Math.sin(a)*(1-width)]])}return out}
const geo={box:upload(boxGeom()),bevel:upload(boxGeom(.19)),cyl:upload(cylinderGeom()),cone:upload(cylinderGeom(7,.35)),sphere:upload(sphereGeom()),dish:upload(dishGeom()),ring:upload(ringGeom()),disk:upload(cylinderGeom(32))};
for(let i=0;i<6;i++)geo['rock'+i]=upload(rockGeom(i+1));
const palette={armor:hex('#56645b'),edge:hex('#849082'),dark:hex('#242f30'),joint:hex('#252d2b'),accent:hex('#d19250'),light:hex('#d8d3af'),visor:hex('#ffc976'),hostile:hex('#845a49'),hostileLight:hex('#a27758'),ground:hex('#9d7455'),rock:hex('#705c4c')};
let screenW=innerWidth,screenH=innerHeight,viewProj=M.identity(),cameraEye=[0,20,60],cameraForward=[0,0,-1],fov=62*DEG,viewShift=0;
const settings={volume:.7,music:.35,quality:'balanced',shake:true};
try{Object.assign(settings,JSON.parse(localStorage.getItem('robotwarrior.settings')||'{}'))}catch(e){}
if(!['retro','balanced','sharp'].includes(settings.quality))settings.quality='balanced';
function saveSettings(){try{localStorage.setItem('robotwarrior.settings',JSON.stringify({volume:settings.volume,music:settings.music,quality:settings.quality,shake:settings.shake}))}catch(e){}}
// Look turn per kit radian: the original mouse feel at the kit's default look sensitivity (Settings adjusts it).
const LOOK=.4;
// Space the kit's touch controls take (CSS pixels), so the canvas HUD can keep clear of them.
const touchInsets={l:0,r:0,b:0,t:0};
function readTouchInsets(){const cs=getComputedStyle(document.documentElement),v=k=>parseFloat(cs.getPropertyValue('--kit-touch-'+k))||0;touchInsets.l=v('left');touchInsets.r=v('right');touchInsets.b=v('bottom');touchInsets.t=v('top')}
// Render detail keeps the original look: a fixed number of pixels across, scaled up with hard pixels. Sharp lets the kit choose.
function applyRenderDetail(){const cap=settings.quality==='retro'?640:settings.quality==='sharp'?0:960;kit.setPixelHeight(cap?Math.max(120,Math.round(Math.min(screenW,cap)*screenH/Math.max(1,screenW))):0)}
function resize(w,h){screenW=w;screenH=h;applyRenderDetail();const dpr=Math.min(devicePixelRatio||1,2);hud.width=Math.round(screenW*dpr);hud.height=Math.round(screenH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);readTouchInsets()}
kit.onResize(resize);
// Scratch matrices for the draw path, so a frame allocates no matrices.
const ONE3=[1,1,1],ZERO3=[0,0,0],_s3=[1,1,1],IDENTITY=M.identity();
const _pA=new Float32Array(16),_pB=new Float32Array(16),_mA=new Float32Array(16),_mB=new Float32Array(16),_mT=new Float32Array(16),_mBody=new Float32Array(16),_mLeg=new Float32Array(16),_eA=new Float32Array(16),_eB=new Float32Array(16),_eT=new Float32Array(16),_eR=new Float32Array(16),_w0=new Float32Array(16),_w1=new Float32Array(16),_w2=new Float32Array(16);
function part(g,p,s,c,r=[0,0,0],glow=0){return{g:geo[g],p,s:s.map(v=>v/2),r,c:typeof c==='string'?hex(c):c,glow}}
function drawPart(p,parent){if(p.owned){draw(p.g,parent,p.c,1,p.glow||0);return}draw(p.g,M.mul(parent,M.transform(p.p,p.s,p.r,_pA),_pB),p.c,1,p.glow||0)}
function bake(parts){let data=[];for(let p of parts){let m=M.transform(p.p,p.s,p.r),d=p.g.data;for(let i=0;i<d.length;i+=9){let v=M.point(m,[d[i],d[i+1],d[i+2]]),n=norm(M.vector(m,[d[i+3],d[i+4],d[i+5]]));data.push(v[0],v[1],v[2],n[0],n[1],n[2],d[i+6]*p.c[0],d[i+7]*p.c[1],d[i+8]*p.c[2])}}return upload(data)}
function packParts(parts){const groups=new Map();for(let p of parts){let key=(p.component||'core')+'/'+(p.glow||0);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}return[...groups.values()].map(list=>({g:bake(list),p:[0,0,0],s:[1,1,1],r:[0,0,0],c:[1,1,1],glow:list[0].glow||0,component:list[0].component||'core',owned:true}))}
// Structure models are baked once and shared by every deployment (restarts no longer re-bake them).
const modelCache=new Map();
function cachedParts(key,build){if(!modelCache.has(key))modelCache.set(key,build());return modelCache.get(key)}
function project(p){let m=viewProj,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<.1)return null;return{x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*screenW,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*screenH,w}}
const serviceBay={x:190,z:-960,r:32},canyonNav={x:125,z:-1440,r:90};
const supplyBay={x:260,z:-2380,r:32},ridgeGate={x:210,z:-2610,width:150,height:32};
const ridgeNav={x:120,z:-2860,r:95},batterySite={x:-115,z:-3230};
const flightLink={x:100,z:-3490,r:62,duration:40},beaconSite={x:182,z:-3510};
const extraction={x:220,z:-3830,r:42};
const reactorSite={x:65,z:-2110};
function terrainY(x,z){
 const raw=(a,b)=>{let rise=clamp((-b-2540)/550,0,1);rise=rise*rise*(3-2*rise);return Math.sin(a*.006+b*.003)*2.8+Math.cos(b*.008-a*.001)*1.9+Math.sin(a*.021+b*.016)*.4+rise*23};
 let y=raw(x,z);
 for(let p of[[190,-960,57],[260,-2380,58],[65,-2110,78],[-105,-1870,32],[240,-1950,32],[220,-3830,62],[100,-3490,105],[-115,-3230,45]]){let blend=clamp((Math.hypot(x-p[0],z-p[1])-p[2])/48,0,1);blend=blend*blend*(3-2*blend);y=mix(raw(p[0],p[1]),y,blend)}
 return y;
}
const staticParts=[],solidObstacles=[];
function prop(g,p,s,c,r=[0,0,0]){let q=part(g,p,s,c,r);staticParts.push(q);return q}
function groundMesh(){let out=[],n=174,size=7700,step=size/n;for(let j=0;j<n;j++)for(let i=0;i<n;i++){let x=(i-n/2)*step,z=(j-n/2)*step-1400,p=[x,terrainY(x,z),z],q=[x+step,terrainY(x+step,z),z],r=[x+step,terrainY(x+step,z+step),z+step],s=[x,terrainY(x,z+step),z+step];let shade=rand(.87,1.10),c=palette.ground.map((v,k)=>mix(v,[.34,.38,.37][k],clamp((-z-2530)/570,0,1))*shade);polygon(out,[p,s,r],c);polygon(out,[p,r,q],c.map(v=>v*rand(.98,1.04)))}return upload(out)}
const ground=groundMesh();ground.grid=true;
// Enhanced Imaging shows the whole terrain grid. Its edges are known, so they are built directly
// (walking 180,000 vertices for shared edges stalled the first switch to the wireframe view).
ground.edgeBuilder=()=>{const n=174,size=7700,step=size/n,H=new Float32Array((n+1)*(n+1)),X=i=>(i-n/2)*step,Z=j=>(j-n/2)*step-1400;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)H[j*(n+1)+i]=terrainY(X(i),Z(j));const out=new Float32Array(((n+1)*n*2+n*n)*6);let k=0;const put=(i,j)=>{out[k++]=X(i);out[k++]=H[j*(n+1)+i];out[k++]=Z(j)};for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){if(i<n){put(i,j);put(i+1,j)}if(j<n){put(i,j);put(i,j+1)}if(i<n&&j<n){put(i,j);put(i+1,j+1)}}return out};
function rock(x,z,rad,height,collidable=true){let y=terrainY(x,z),c=palette.rock.map((v,k)=>mix(v,[.28,.32,.33][k],clamp((-z-2530)/450,0,1))*rand(.86,1.15));prop('rock'+Math.floor(rand(0,6)),[x,y+height*.46,z],[rad*2,height,rad*rand(1.65,2.2)],c,[rand(-.05,.05),rand(0,TAU),rand(-.045,.045)]);if(collidable)solidObstacles.push({x,z,r:rad*.78,h:height})}
// A broad, open combat basin, with low polygon cliffs on both sides.
for(let i=0;i<42;i++){let z=rand(-1500,700),side=i%2?1:-1,x=side*rand(360,560);rock(x,z,rand(38,95),rand(45,160))}
for(let i=0;i<65;i++){let a=rand(0,TAU),rad=rand(2700,3200),x=Math.sin(a)*rad,z=-1000+Math.cos(a)*rad;if(z<-2450&&Math.abs(x)<1100)z-=1900;rock(x,z,rand(180,370),rand(160,480),false)}
for(let p of[[-160,-115,25,33],[165,-225,27,31],[-260,-315,42,67],[238,-560,33,43],[-220,-615,44,65],[295,-910,51,110],[-155,-855,25,33],[100,95,15,21]])rock(...p);
for(let i=0;i<150;i++){let x=rand(-520,520),z=rand(-1200,450);prop('bevel',[x,terrainY(x,z)+rand(.2,.65),z],[rand(.8,3.5),rand(.4,1.3),rand(.8,3)],palette.rock,[rand(-.4,.4),rand(0,TAU),rand(-.3,.3)])}
// Roads and ground strips are real geometry, not external textures.
for(let z=60;z>-850;z-=18){let x=34+Math.sin(z*.006)*30,y=terrainY(x,z)+.08;prop('box',[x-5,y,z],[1.3,.035,7],hex('#87654e'));prop('box',[x+5,y,z],[1.3,.035,7],hex('#87654e'))}
function smallBuilding(x,z,w,d,h){let y=terrainY(x,z);prop('bevel',[x,y+h/2,z],[w,h,d],hex('#777568'));prop('box',[x,y+h,z],[w*.8,.6,d*.85],hex('#a2a087'));for(let i=-1;i<=1;i++)prop('box',[x+i*w*.23,y+h*.72,z+d/2+.05],[w*.13,.75,.15],hex('#353f3b'));solidObstacles.push({x,z,r:Math.max(w,d)*.46,h})}
smallBuilding(-140,-420,25,26,10);smallBuilding(-58,-452,18,24,8);smallBuilding(167,-738,32,23,12);smallBuilding(100,-781,23,20,9);smallBuilding(195,-782,27,20,10);
for(let i=0;i<8;i++){let x=100+(i%4)*19,z=-664-Math.floor(i/4)*18,y=terrainY(x,z);prop('box',[x,y+2,z],[12,4,8],i%2?hex('#72634f'):hex('#596159'));prop('box',[x,y+4.2,z],[12.5,.5,8.5],hex('#979079'))}
for(let p of[[-125,-390],[-65,-390],[110,-708],[178,-708]]){let[x,z]=p,y=terrainY(x,z);prop('cyl',[x,y+7,z],[.9,14,.9],hex('#474d47'));prop('box',[x,y+14,z],[3,.8,1.4],hex('#c9ae79'));}
// Extraction pad, beacons, and survey markers.

prop('cyl',[extraction.x,terrainY(extraction.x,extraction.z)+.06,extraction.z],[94,.1,94],hex('#726853'));
for(let i=0;i<8;i++){let a=i/8*TAU,x=extraction.x+Math.sin(a)*45,z=extraction.z+Math.cos(a)*45;prop('bevel',[x,terrainY(x,z)+.5,z],[1.8,1,1.8],palette.dark)}

// Needle Pass: a wide, winding route connects the two combat areas.
const routePoints=[serviceBay,{x:105,z:-1180},canyonNav,{x:25,z:-1640},{x:55,z:-1790},reactorSite,supplyBay,{x:210,z:-2610},ridgeNav,{x:35,z:-3070},{x:65,z:-3310},flightLink,extraction];
for(let z=-1090;z>=-1610;z-=78){let x=115+Math.sin((z+1180)*.008)*65;for(let side of[-1,1])rock(x+side*rand(135,164),z,rand(39,59),rand(82,152))}
for(let z=-1750;z>=-2490;z-=130)for(let side of[-1,1])rock(side*rand(430,545),z,rand(55,88),rand(70,155));
// Leave a wide gate in the old north wall. All chassis can pass without jumping.
for(let x of[-480,-320,-160,0,440,600])rock(x,-2610,rand(49,64),rand(95,160));
for(let z=-2750;z>=-3010;z-=90){let x=mix(175,35,(-z-2750)/300);for(let side of[-1,1])rock(x+side*rand(155,180),z,rand(38,54),rand(88,145))}
for(let z=-3140;z>=-3990;z-=130)for(let side of[-1,1])rock(side*rand(455,550),z,rand(45,76),rand(85,185));
for(let x=-460;x<=560;x+=160)rock(x,-4080,rand(65,95),rand(105,175));
for(let j=0;j<routePoints.length-1;j++){let a=routePoints[j],b=routePoints[j+1],len=dist2(a,b),yaw=Math.atan2(b.x-a.x,b.z-a.z);for(let u=0;u<len;u+=22){let t=u/len,x=mix(a.x,b.x,t),z=mix(a.z,b.z,t);prop('box',[x,terrainY(x,z)+.10,z],[18,.10,23],hex('#777466'),[0,yaw,0]);if(Math.floor(u/22)%3===0){for(let side of[-1,1]){let xx=x+Math.cos(yaw)*side*13,zz=z-Math.sin(yaw)*side*13;prop('bevel',[xx,terrainY(xx,zz)+1.1,zz],[.8,2.2,.8],hex('#adb3a0'))}}}}
// The old landing pad is now a one-use field service bay.
prop('cyl',[serviceBay.x,terrainY(serviceBay.x,serviceBay.z)+.13,serviceBay.z],[72,.2,72],hex('#5e7168'));
for(let side of[-1,1]){let x=serviceBay.x+side*29,y=terrainY(x,serviceBay.z);prop('bevel',[x,y+14,serviceBay.z],[5,28,9],hex('#8c9277'));prop('box',[x,y+17,serviceBay.z+4.6],[4.7,6,.35],palette.accent);prop('bevel',[x+side*11,y+3,serviceBay.z],[15,6,18],hex('#4c6261'))}
prop('bevel',[serviceBay.x,terrainY(serviceBay.x,serviceBay.z)+28,serviceBay.z],[65,4,10],hex('#78877a'));
// An industrial landmark changes the skyline in the north.
smallBuilding(-170,-1990,55,42,17);smallBuilding(330,-1840,42,45,15);smallBuilding(-190,-2190,58,47,18);smallBuilding(295,-2160,40,33,12);
for(let p of[[-205,-2090],[-285,-2000],[330,-2230]]){let[x,z]=p,y=terrainY(x,z);prop('cyl',[x,y+34,z],[15,68,15],hex('#737d76'));prop('cyl',[x,y+60,z],[15.3,9,15.3],hex('#a8845b'));prop('cyl',[x,y+68,z],[18,2,18],palette.dark);solidObstacles.push({x,z,r:8,h:68})}
for(let x=-100;x<=230;x+=55){let z=-2225,y=terrainY(x,z);prop('cyl',[x,y+8,z],[4,34,4],hex('#819188'),[0,0,Math.PI/2]);prop('bevel',[x,y+3,z],[3,6,12],hex('#595f58'))}
for(let i=0;i<6;i++){let x=-260+i*24,z=-1790,y=terrainY(x,z);prop('bevel',[x,y+2.7,z],[17,5.4,12],i%2?hex('#7b6b55'):hex('#59716e'))}
// Blackglass Ridge: basalt spires, blast walls, and a hardened flight beacon.
for(let p of[[-240,-3060,31,82],[310,-3170,27,60],[-290,-3300,28,74],[310,-3615,24,70],[-245,-3810,34,100]])rock(...p);
for(let p of[[-230,-3550,32,27,12],[335,-3330,35,28,14],[-125,-3650,29,30,10]])smallBuilding(...p);
for(let z=-3130;z>=-3730;z-=120){let x=-365,y=terrainY(x,z);prop('bevel',[x,y+8,z],[18,16,46],hex('#485652'));solidObstacles.push({x,z,r:18,h:16})}
for(let side of[-1,1]){let x=ridgeGate.x+side*79,z=ridgeGate.z,y=terrainY(x,z);prop('bevel',[x,y+19,z],[10,38,17],hex('#727e72'));prop('box',[x,y+23,z+9],[7,12,.6],palette.accent);solidObstacles.push({x,z,r:7,h:38})}
prop('bevel',[ridgeGate.x,terrainY(ridgeGate.x,ridgeGate.z)+37,ridgeGate.z],[170,5,18],hex('#556761'));
// A second independent service bay replaces the old extraction site.
prop('cyl',[supplyBay.x,terrainY(supplyBay.x,supplyBay.z)+.12,supplyBay.z],[74,.2,74],hex('#526968'));
for(let side of[-1,1]){let x=supplyBay.x+side*30,z=supplyBay.z,y=terrainY(x,z);prop('bevel',[x,y+13,z],[5,26,10],hex('#7e9588'));prop('box',[x,y+17,z+5.2],[4,7,.5],palette.accent);prop('bevel',[x+side*11,y+3,z],[15,6,16],hex('#536765'))}
prop('bevel',[supplyBay.x,terrainY(supplyBay.x,supplyBay.z)+26,supplyBay.z],[65,4,11],hex('#869487'));
prop('cyl',[flightLink.x,terrainY(flightLink.x,flightLink.z)+.13,flightLink.z],[132,.2,132],hex('#414f4c'));
for(let i=0;i<12;i++){let a=i/12*TAU,x=flightLink.x+Math.sin(a)*65,z=flightLink.z+Math.cos(a)*65;prop('bevel',[x,terrainY(x,z)+.7,z],[2,1.4,2],hex('#adbb9f'))}
{const x=beaconSite.x,z=beaconSite.z,y=terrainY(x,z);prop('bevel',[x,y+5,z],[25,10,23],hex('#6d8179'));prop('bevel',[x,y+20,z],[12,22,12],hex('#404f4f'));prop('cyl',[x,y+38,z],[5,20,5],hex('#8eac9f'));for(let side of[-1,1]){prop('bevel',[x+side*12,y+21,z],[8,25,8],hex('#778e84'));prop('box',[x+side*12,y+24,z+4.1],[4,16,.5],hex('#68c3c7'))}solidObstacles.push({x,z,r:17,h:31})}
for(let i=0;i<75;i++){let x=rand(-430,430),z=rand(-3940,-3000);prop('bevel',[x,terrainY(x,z)+.3,z],[rand(1,3),.6,rand(1,3)],hex('#495454'),[0,rand(0,TAU),0])}
const scenery=bake(staticParts);staticParts.length=0;



const componentNames=['head','core','leftTorso','rightTorso','leftArm','rightArm','leftLeg','rightLeg'];
const chassisSpecs={
 kestrel:{name:'KESTREL',code:'KST—40',role:'SCOUT',tons:40,speed:32.2,accel:8.4,brake:12,turn:1.05,eye:10.2,armor:.72,cooling:1.17,ammo:.75,missiles:.65,jumpAccel:32,jumpSpeed:18,fuelUse:22,fuelRegen:25,jetHeat:9,maxAlt:80,lockTime:.9,previewScale:1.13,radius:4.8,volley:2,step:.76,
  desc:'Light armor. Fast turns and long jumps. Two-missile volleys. Use speed and cover to stay alive.',
  weapons:[{name:'TWIN PULSE',heat:13,damage:31,cooldown:.68,range:780},{name:'LIGHT COIL',heat:7,damage:46,cooldown:1.4,range:1050},{name:'MISSILE / 2',heat:13,damage:21,cooldown:3.0,range:1150}]},
 warden:{name:'WARDEN',code:'WRD—70',role:'HEAVY',tons:70,speed:22.2,accel:5.8,brake:8,turn:.7,eye:13,armor:1,cooling:1,ammo:1,missiles:1,jumpAccel:26,jumpSpeed:15,fuelUse:30,fuelRegen:19,jetHeat:12,maxAlt:65,lockTime:1.25,previewScale:1.34,radius:6,volley:4,step:1,
  desc:'Balanced armor and firepower. Four-missile volleys. Standard jump jets. A stable choice for all three sectors.',
  weapons:[{name:'DUAL PULSE',heat:17,damage:38,cooldown:.84,range:820},{name:'COIL CANNON',heat:9,damage:61,cooldown:1.7,range:1150},{name:'MISSILE / 4',heat:23,damage:22,cooldown:4,range:1150}]},
 bastion:{name:'BASTION',code:'BST—95',role:'ASSAULT',tons:95,speed:16.7,accel:3.7,brake:6,turn:.49,eye:15.2,armor:1.46,cooling:.9,ammo:1.4,missiles:1.45,jumpAccel:22,jumpSpeed:9,fuelUse:43,fuelRegen:13,jetHeat:15,maxAlt:40,lockTime:1.5,previewScale:1.42,radius:7,volley:6,step:1.3,
  desc:'Heavy armor and a siege cannon. Six-missile volleys. Slow turns and short jumps. High weapon heat.',
  weapons:[{name:'HEAVY PULSE',heat:22,damage:50,cooldown:1.08,range:850},{name:'SIEGE COIL',heat:15,damage:94,cooldown:2.2,range:1250},{name:'MISSILE / 6',heat:30,damage:25,cooldown:4.6,range:1250}]}
};
let chassis='warden';try{let v=localStorage.getItem('robotwarrior.chassis');if(chassisSpecs[v])chassis=v}catch(e){}
const chassisData=()=>chassisSpecs[chassis];

function makeMechModel(enemy=false,heavy=false){let c=enemy?palette.hostile:palette.armor,e=enemy?palette.hostileLight:palette.edge,j=palette.joint,d=palette.dark,a=palette.accent;
 const torso=[],legs=[],arms=[[],[]];
 const add=(arr,g,p,s,col,r=[0,0,0],glow=0,component='core')=>{let v=part(g,p,s,col,r,glow);v.component=component;arr.push(v)};
 add(torso,'bevel',[0,12.7,0],[8.4,7.2,5.8],c);
 add(torso,'bevel',[0,15.9,1.45],[5.1,3,5.2],e,[.12,0,0],0,'head');
 add(torso,'bevel',[0,16.25,4.4],[4.15,1.13,.3],palette.visor,[.12,0,0],.8,'head');
 add(torso,'box',[0,16.25,4.61],[.2,1.2,.14],d,[0,0,0],0,'head');
 add(torso,'bevel',[0,12.35,3.01],[3.8,3.4,.55],d);
 add(torso,'box',[0,13.25,3.35],[2.55,.25,.17],a,[0,0,0],.2);
 for(let n=0;n<4;n++)add(torso,'box',[0,12.45-n*.43,3.34],[2.5,.16,.2],j);
 add(torso,'bevel',[0,11.6,-3.55],[6.8,5.3,2.4],d);
 for(let s of[-1,1]){
  const comp=s<0?'leftTorso':'rightTorso';
  add(torso,'bevel',[s*3.9,12.8,.1],[2.5,6.8,5.1],c,[0,0,s*-.11],0,comp);
  add(torso,'box',[s*4.15,14.6,2.63],[1.25,2.2,.23],a,[0,0,0],0,comp);
  add(torso,'cyl',[s*2.2,13.8,-4.6],[1.45,4.3,1.45],e,[0,0,0],0,comp);
  add(torso,'cyl',[s*2.2,16.02,-4.6],[.95,.16,.95],d,[0,0,0],0,comp);
  add(torso,'bevel',[s*6.5,17.15,-.55],[5,5.5,5.7],c,[.035,0,s*-.055],0,comp);
  add(torso,'box',[s*6.5,17.3,2.42],[4.25,4.4,.24],d,[0,0,0],0,comp);
  add(torso,'box',[s*6.5,19.85,-.5],[4.65,.22,4.7],e,[0,0,0],0,comp);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
   add(torso,'cyl',[s*6.5+(col-1)*1.25,17.4+(row-1)*1.24,2.65],[.84,.35,.84],j,[Math.PI/2,0,0],0,comp);
   add(torso,'cyl',[s*6.5+(col-1)*1.25,17.4+(row-1)*1.24,2.86],[.47,.08,.47],a.map(v=>v*.52),[Math.PI/2,0,0],0,comp);
  }
  const ai=s<0?0:1,ac=s<0?'leftArm':'rightArm';
  add(arms[ai],'cyl',[s*5.3,12.7,0],[2.6,2.6,2.6],j,[0,0,Math.PI/2],0,ac);
  add(arms[ai],'bevel',[s*6.2,10.8,.4],[2.8,5.1,3.4],c,[.05,0,s*.055],0,ac);
  add(arms[ai],'bevel',[s*6.2,9.15,2.65],[3.15,2.8,6.2],d,[0,0,0],0,ac);
  add(arms[ai],'bevel',[s*6.2,10.55,2.15],[2.9,.65,4.8],e,[0,0,0],0,ac);
  add(arms[ai],'cyl',[s*6.2,9.2,6.05],[1.5,2.3,1.5],j,[Math.PI/2,0,0],0,ac);
  add(arms[ai],'cyl',[s*6.2,9.2,7.24],[1.08,.17,1.08],a,[Math.PI/2,0,0],.1,ac);
  add(arms[ai],'cyl',[s*6.2,9.2,7.35],[.7,.05,.7],d,[Math.PI/2,0,0],0,ac);
  let leg=[];const lc=s<0?'leftLeg':'rightLeg';
  add(leg,'cyl',[s*2.6,8.5,0],[2.8,2.1,2.8],j,[0,0,Math.PI/2],0,lc);
  add(leg,'bevel',[s*2.65,6.9,-.9],[3.1,4.3,3.6],c,[-.35,0,s*-.025],0,lc);
  add(leg,'cyl',[s*2.65,5,-1.7],[2.6,3.3,2.6],j,[0,0,Math.PI/2],0,lc);
  add(leg,'bevel',[s*2.65,3.1,-.4],[2.65,4.4,2.9],e,[.42,0,0],0,lc);
  add(leg,'box',[s*2.65,3.35,1.02],[1.6,2.0,.38],c,[.42,0,0],0,lc);
  add(leg,'cyl',[s*3.6,4.1,-.15],[.32,4.3,.32],palette.light,[.38,0,0],0,lc);
  add(leg,'bevel',[s*2.65,.85,1.1],[3.6,1.7,5.3],d,[0,0,0],0,lc);
  add(leg,'box',[s*2.65,1.71,1.7],[2.8,.25,3.4],c,[0,0,0],0,lc);
  add(leg,'box',[s*2.65,.85,3.81],[2.5,.54,.18],a,[0,0,0],0,lc);
  legs.push(leg);
 }
 add(torso,'cyl',[0,8.6,0],[5.2,1.9,5.2],j);
 add(torso,'bevel',[0,8,0],[6.1,2.6,4.1],c);
 add(torso,'cyl',[-3.8,21.2,-.6],[.15,4.4,.15],d,[0,0,-.12],0,'leftTorso');
 add(torso,'cyl',[-4.1,23.5,-.6],[.2,.35,.2],a,[0,0,0],.8,'leftTorso');
 return{torso:packParts(torso),arms:arms.map(packParts),legs:legs.map(packParts)};
}
function makeVariantModel(kind,enemy=false){
 if(kind==='warden')return makeMechModel(enemy);
 const heavy=kind==='bastion',c=enemy?palette.hostile:hex(heavy?'#626858':'#617979'),e=enemy?palette.hostileLight:hex(heavy?'#93957a':'#92aaa4'),d=palette.dark,j=palette.joint,a=heavy?hex('#cc9b61'):hex('#caaf72'),torso=[],legs=[[],[]],arms=[[],[]];
 const put=(arr,g,p,s,col,r=[0,0,0],component='core',glow=0)=>{let v=part(g,p,s,col,r,glow);v.component=component;arr.push(v)};
 put(torso,'bevel',[0,12.1,0],heavy?[10.4,7.8,6.7]:[6.7,6.3,4.8],c);
 put(torso,'bevel',[0,16.2,2.1],heavy?[5.5,3.1,5.1]:[4,2.4,4.8],e,[.18,0,0],'head');
 put(torso,'bevel',[0,16.45,4.57],heavy?[4.35,1.0,.3]:[3.15,.65,.28],palette.visor,[.18,0,0],'head',.8);
 put(torso,'bevel',[0,12.3,3.4],heavy?[6.6,4.6,.65]:[3.2,3.6,.55],d);
 for(let n=0;n<4;n++)put(torso,'box',[0,13.3-n*.65,3.8],[heavy?4.8:2.4,.2,.2],e);
 put(torso,'box',[0,14.2,3.8],[heavy?5.5:2.6,.5,.25],a);
 put(torso,'cyl',[0,8.4,0],[5.8,2,5.8],j);
 put(torso,'bevel',[0,8.1,0],heavy?[7.1,2.7,4.8]:[5.5,2,3.6],c);
 for(let side of[-1,1]){
  const i=side<0?0:1,tc=side<0?'leftTorso':'rightTorso',ac=side<0?'leftArm':'rightArm',lc=side<0?'leftLeg':'rightLeg';
  put(torso,'bevel',[side*4.4,13.5,0],heavy?[3.8,7.5,6.4]:[2.2,5.1,4.1],e,[0,0,side*-.09],tc);
  if(heavy){
   put(torso,'bevel',[side*6.3,17.9,-.7],[5.4,4.3,7.4],c,[.04,0,side*-.05],tc);
   put(torso,'box',[side*6.3,18,3.06],[4.7,3.6,.25],d,[0,0,0],tc);
   for(let row=0;row<2;row++)for(let col=0;col<3;col++)put(torso,'cyl',[side*6.3+(col-1)*1.37,17.3+row*1.45,3.3],[.93,.35,.93],a,[Math.PI/2,0,0],tc);
   put(torso,'bevel',[side*3,12.5,-4.3],[3.2,6.7,3.2],d,[0,0,0],tc);
  }else{
   put(torso,'bevel',[side*4.2,17.5,-1.6],[2.6,3.2,5.5],c,[.09,0,0],tc);
   for(let row=0;row<2;row++)put(torso,'cyl',[side*4.2,16.9+row*1.2,1.25],[.84,.3,.84],a,[Math.PI/2,0,0],tc);
   put(torso,'cyl',[side*2.3,12,-3.4],[1.6,5.8,1.6],e,[0,0,0],tc);
   put(torso,'bevel',[side*2.7,15.2,-3.7],[1.7,2,3.8],d,[.4,0,0],tc);
  }
  put(arms[i],'cyl',[side*5.6,12.8,.1],[2.6,heavy?3.2:2.3,2.6],j,[0,0,Math.PI/2],ac);
  put(arms[i],'bevel',[side*6.2,10.7,.5],heavy?[3.7,5.7,4.3]:[2.1,4.8,2.8],c,[0,0,side*.07],ac);
  put(arms[i],'bevel',[side*6.2,9.5,3.6],heavy?[3.8,3.6,8.4]:[2.3,2.3,5.8],d,[0,0,0],ac);
  put(arms[i],'box',[side*6.2,11.1,3.5],heavy?[3.2,.5,6.3]:[1.9,.35,4.3],e,[0,0,0],ac);
  const barrel=heavy&&side>0?1.05:.61;
  put(arms[i],'cyl',[side*6.2,9.6,heavy?8:6.5],[barrel*2,heavy?3.8:2.4,barrel*2],j,[Math.PI/2,0,0],ac);
  put(arms[i],'cyl',[side*6.2,9.6,heavy?9.95:7.75],[barrel*1.7,.16,barrel*1.7],a,[Math.PI/2,0,0],ac);
  if(heavy){put(arms[i],'box',[side*6.2,9.6,7.8],[4.1,.45,.5],e,[0,0,0],ac);put(arms[i],'box',[side*6.2,9.6,6.8],[4.1,.45,.5],e,[0,0,0],ac)}
  const leg=legs[i];put(leg,'cyl',[side*2.65,8,0],[2.5,3,2.5],j,[0,0,Math.PI/2],lc);
  put(leg,'bevel',[side*2.65,6.4,heavy?-.1:-1.1],heavy?[3.7,4.9,4.1]:[2.15,4.6,2.7],c,[-.25,0,0],lc);
  put(leg,'cyl',[side*2.65,4.7,-1.3],[2.5,heavy?3.8:2.6,2.5],j,[0,0,Math.PI/2],lc);
  put(leg,'bevel',[side*2.65,2.9,.1],heavy?[3.9,4.8,3.8]:[1.9,4.4,2.4],e,[.27,0,0],lc);
  put(leg,'box',[side*2.65,3,heavy?2.03:1.4],heavy?[3.3,2.7,.5]:[1.4,2.5,.3],c,[.27,0,0],lc);
  put(leg,'cyl',[side*3.7,3.4,-.2],[.28,4.6,.28],palette.light,[.32,0,0],lc);
  put(leg,'bevel',[side*2.65,.75,1.3],heavy?[4.7,1.5,6.6]:[3,1.3,4.9],d,[0,0,0],lc);
  put(leg,'box',[side*2.65,.8,heavy?4.65:3.8],heavy?[3.4,.42,.2]:[2.4,.3,.2],a,[0,0,0],lc);
 }
 put(torso,'cyl',[heavy?2.9:-2.9,20.1,-1.8],[.13,6,.13],e,[0,0,heavy?.1:-.16],'leftTorso');
 return{torso:packParts(torso),legs:legs.map(packParts),arms:arms.map(packParts)};
}
const playerModels={kestrel:makeVariantModel('kestrel'),warden:makeVariantModel('warden'),bastion:makeVariantModel('bastion')};
const enemyModels={scout:makeVariantModel('kestrel',true),medium:makeVariantModel('warden',true),heavy:makeVariantModel('bastion',true)};

const compSpec={head:{p:[0,16.2,1.7],r:2.05,hp:50},core:{p:[0,12,0],r:3.5,hp:155},leftTorso:{p:[-4.4,15,0],r:2.6,hp:85},rightTorso:{p:[4.4,15,0],r:2.6,hp:85},leftArm:{p:[-6.4,10,2],r:2,hp:60},rightArm:{p:[6.4,10,2],r:2,hp:60},leftLeg:{p:[-2.6,4.1,0],r:2.0,hp:80},rightLeg:{p:[2.6,4.1,0],r:2.0,hp:80}};
let entities=[],particles=[],beams=[],projectiles=[],entityID=0;
function makeMech(x,z,name,type='medium'){if(collides(x,z,0,7)){let found=false;for(let r=15;r<=150&&!found;r+=15)for(let i=0;i<12;i++){let a=i/12*TAU,xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;if(!collides(xx,zz,0,7)){x=xx;z=zz;found=true;break}}}let scale=type==='scout'?.74:type==='heavy'?1.1:.93,health=type==='scout'?.73:type==='heavy'?1.35:1,components={};for(let k of componentNames)components[k]={hp:compSpec[k].hp*health,max:compSpec[k].hp*health};let o={id:++entityID,type:'mech',class:type,name,x,z,y:terrainY(x,z),yaw:Math.PI,scale,components,alive:true,phase:rand(0,TAU),speed:0,cooldown:rand(1,3),missileCooldown:rand(7,12),alert:false,contact:false,strafe:random()<.5?-1:1,hitFlash:0,deathTime:0,model:enemyModels[type]||enemyModels.medium};coopScaleEntity(o);entities.push(o);return o}
function createTower(){let x=-95,z=-435,y=terrainY(x,z),parts=[];let put=(g,p,s,c,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,c,r,glow));
 put('bevel',[0,4,0],[25,8,24],hex('#74796b'));put('box',[0,8,0],[27,1,26],palette.edge);
 for(let s of[-1,1])for(let t of[-1,1]){put('bevel',[s*7,23,t*7],[2.1,34,2.1],palette.light,[0,0,s*.08]);put('box',[s*7,39,t*7],[1.6,2,1.6],palette.accent,[0,0,0],.8)}
 for(let i=0;i<4;i++){put('box',[0,12+i*8,0],[17,1,17],hex('#858a78'));put('box',[0,16+i*8,7],[20,.9,.9],hex('#6e796c'),[0,0,i%2?.38:-.38])}
 put('bevel',[0,41,0],[21,5,19],palette.dark);put('box',[0,42,9.8],[16,1.2,.35],palette.accent,[0,0,0],.6);
 put('cyl',[0,50,0],[1.2,16,1.2],palette.light);put('cyl',[0,58.6,0],[1.9,1.4,1.9],hex('#f27346'),[0,0,0],1);
 put('dish',[0,47,3],[20,20,20],palette.light,[-.2,.7,0]);
 let o={id:++entityID,type:'tower',name:'RELAY TOWER',x,z,y,scale:1,yaw:Math.PI,parts:cachedParts('tower',()=>packParts(parts)),alive:true,height:60,radius:15,hp:230,maxHP:230,hitFlash:0,deathTime:0,objective:0};entities.push(o);return o}
function createUplink(){let parts=[],x=140,z=-745,y=terrainY(x,z),put=(g,p,s,c,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,c,r,glow));
 put('bevel',[0,7,0],[47,14,40],hex('#898779'));put('box',[0,14.3,0],[45,1,38],hex('#a4a28b'));put('bevel',[0,19,0],[15,10,15],palette.dark);
 put('cyl',[0,26,0],[4,14,4],palette.edge);put('dish',[0,32,0],[49,49,49],palette.light,[-.48,-.3,0]);
 put('cyl',[0,36,7],[.7,22,.7],palette.dark,[-.55,0,0]);
 for(let i=-2;i<=2;i++)put('box',[i*8,10.2,20.1],[5,2,.3],palette.visor,[0,0,0],.4);
 for(let s of[-1,1]){put('bevel',[s*17,16,-8],[7,4,9],palette.armor);put('cyl',[s*21,22,-17],[.6,16,.6],palette.edge);put('cyl',[s*21,30.4,-17],[1,1,1],palette.accent,[0,0,0],.8)}
 let o={id:++entityID,type:'uplink',name:'UPLINK STATION',x,z,y,scale:1,yaw:Math.PI,parts:cachedParts('uplink',()=>packParts(parts)),alive:true,height:51,radius:27,hp:330,maxHP:330,hitFlash:0,deathTime:0,objective:1};entities.push(o);return o}
function createTurret(x,z,name){let o={id:++entityID,type:'turret',name,x,z,y:terrainY(x,z),scale:1,yaw:Math.PI,alive:true,height:9,radius:5,hp:115,maxHP:115,cooldown:rand(3,5),hitFlash:0,deathTime:0,alert:false};coopScaleEntity(o);entities.push(o);return o}
let relay,uplink,westFeed,eastFeed,reactor,skyguard;
function createPowerFeed(x,z,name){const parts=[],put=(g,p,s,c,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,c,r,glow));
 put('bevel',[0,4,0],[25,8,25],hex('#748078'));put('box',[0,8.2,0],[27,1,27],palette.edge);
 for(let side of[-1,1]){put('cyl',[side*6,17,0],[7,18,7],palette.dark);for(let y of[11,16,21])put('cyl',[side*6,y,0],[8.2,1.8,8.2],palette.edge);put('cyl',[side*6,27,0],[3,3,3],hex('#71cdd0'),[0,0,0],.8)}
 put('bevel',[0,31,0],[23,4,8],hex('#7e9389'));put('box',[0,30.8,4.3],[16,1.2,.3],hex('#8cdddb'),[0,0,0],.7);
 const o={id:++entityID,type:'generator',zone:'works',name,x,z,y:terrainY(x,z),yaw:0,scale:1,alive:true,height:34,radius:15,hp:240,maxHP:240,parts:cachedParts('feed',()=>packParts(parts)),hitFlash:0,deathTime:0};entities.push(o);return o;
}
function createReactor(){const parts=[],put=(g,p,s,c,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,c,r,glow));
 put('bevel',[0,4,0],[64,8,64],hex('#58665f'));put('cyl',[0,23,0],[31,40,31],hex('#6e817b'));
 for(let y of[9,21,34,43])put('cyl',[0,y,0],[39,3,39],hex('#93a08b'));
 put('cyl',[0,50,0],[23,13,23],palette.dark);put('cyl',[0,57,0],[25,2,25],palette.edge);
 for(let i=0;i<8;i++){let a=i/8*TAU,x=Math.sin(a)*17,z=Math.cos(a)*17;put('box',[x,26,z],[3,28,2],hex('#d8a96b'),[0,a,0],.6);put('bevel',[x*1.6,10,z*1.6],[8,13,8],palette.dark,[0,a,0])}
 const o={id:++entityID,type:'reactor',zone:'works',name:'ASHFALL REACTOR',x:reactorSite.x,z:reactorSite.z,y:terrainY(reactorSite.x,reactorSite.z),yaw:0,scale:1,alive:true,height:59,radius:31,hp:620,maxHP:620,parts:cachedParts('reactor',()=>packParts(parts)),hitFlash:0,deathTime:0};entities.push(o);return o;
}
function createSkyguard(){
 const e=createTurret(batterySite.x,batterySite.z,'SKYGUARD BATTERY'),parts=[];
 const put=(g,p,s,c,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,c,r,glow));
 put('bevel',[0,3,0],[43,6,36],hex('#50615c'));put('cyl',[0,7,0],[22,6,22],palette.dark);
 put('bevel',[0,12,0],[13,10,17],hex('#829185'));put('box',[0,13,8.7],[9,2,.4],palette.accent,[0,0,0],.7);
 for(let side of[-1,1]){put('bevel',[side*13,13,0],[13,14,26],hex('#697e73'));put('box',[side*13,14,13.3],[10,9,.5],palette.dark);for(let j=0;j<3;j++){put('cyl',[side*13+(j-1)*3,14,14],[2.4,4,2.4],palette.light,[Math.PI/2,0,0]);put('cyl',[side*13+(j-1)*3,14,16.1],[1.6,.3,1.6],palette.dark,[Math.PI/2,0,0])}put('box',[side*13,20.2,0],[10,.5,19],palette.accent)}
 put('cyl',[0,21,-5],[1.5,12,1.5],palette.edge);put('dish',[0,27,-5],[16,9,10],hex('#b0beb0'),[-.25,0,0]);
 Object.assign(e,{zone:'ridge',skyguard:true,height:31,radius:23,hitRadius:20,centerHeight:13,collisionRadius:24,collisionHeight:9,hp:470,maxHP:470,parts:cachedParts('skyguard',()=>packParts(parts)),coopScaled:false});coopScaleEntity(e);return e;
}
// LONGBOW: a tracked missile carrier. It keeps its distance and lobs artillery volleys that
// arc over cover and burst on the ground, so pilots have to keep moving or jump clear.
function longbowParts(){const parts=[],c=palette.hostile,e=palette.hostileLight,d=palette.dark,j=palette.joint,a=palette.accent,put=(g,p,s,col,r=[0,0,0],glow=0)=>parts.push(part(g,p,s,col,r,glow));
 put('bevel',[0,2.3,0],[9.4,3,13.5],c);put('bevel',[0,4.2,-1],[7.2,1.5,9],e);put('box',[0,3.2,6.8],[4.4,.5,.3],palette.visor,[0,0,0],.8);
 for(const side of[-1,1]){put('box',[side*5,1.4,0],[2.3,2.6,14.6],d);put('box',[side*5,2.8,0],[2.5,.3,15],j);for(const z of[-5.2,-2.6,0,2.6,5.2])put('cyl',[side*5.05,1.25,z],[1.5,2.5,1.5],j,[0,0,Math.PI/2]);
  put('bevel',[side*2.4,6.4,-1.8],[3.6,3.2,6.4],c,[-.28,0,0]);put('box',[side*2.4,7.3,1.3],[3.2,2.6,.3],d,[-.28,0,0]);
  for(let row=0;row<2;row++)for(let col=0;col<2;col++)put('cyl',[side*2.4+(col-.5)*1.3,6.8+row*1.1,1.55+row*.3],[.75,.35,.75],a,[Math.PI/2-.28,0,0],.35)}
 put('cyl',[0,6.4,-5.2],[.35,4.4,.35],palette.light);put('dish',[0,8.9,-5.2],[2.6,2.6,2.6],palette.light,[-.5,0,0]);
 return packParts(parts)}
function createLongbow(x,z,name){const e=createTurret(x,z,name);Object.assign(e,{class:'longbow',longbow:true,height:9,radius:7,hitRadius:7.5,centerHeight:4.5,collisionRadius:7,collisionHeight:6,hp:200,maxHP:200,parts:cachedParts('longbow',longbowParts),speed:0,phase:0,cooldown:rand(4,6),strafe:random()<.5?-1:1,coopScaled:false});coopScaleEntity(e);return e}
function makeCommander(e){e.commander=true;e.model=enemyModels.heavy;e.scale=1.19;for(let c of Object.values(e.components)){c.max*=1.25;c.hp=c.max}return e}
const ridgeResponseThreats=()=>entities.filter(e=>e.alive&&e.assaultLink);
const linkThreats=()=>entities.filter(e=>e.alive&&(e.type==='mech'||e.type==='turret')&&dist2(e,flightLink)<90);
const ridgeGateLocked=()=>!missionFlags[3]||!missionFlags[4];
const basinThreats=()=>entities.filter(e=>e.alive&&e.zone==='basin'&&(e.type==='mech'||e.type==='turret'));
const reactorShielded=()=>!!(westFeed?.alive||eastFeed?.alive);
const allObjectivesComplete=()=>missionFlags.every(Boolean);

function populate(){entities=[];particles=[];beams=[];projectiles=[];entityID=0;seed=56711;relay=uplink=westFeed=eastFeed=reactor=skyguard=null;
 if(mode==='arena'){arenaReset();return}
 relay=createTower();uplink=createUplink();makeMech(-42,-176,'HOUND 01','scout');makeMech(118,-354,'HOUND 02','medium');makeMech(60,-620,'BASTION 03','heavy');createTurret(-72,-396,'SENTRY 04');createTurret(186,-701,'SENTRY 05');for(let e of entities)e.zone='basin';
 westFeed=createPowerFeed(-105,-1870,'WEST POWER FEED');eastFeed=createPowerFeed(240,-1950,'EAST POWER FEED');reactor=createReactor();
 for(let e of[makeMech(30,-1850,'WORKS GUARD 09','medium'),makeMech(130,-2040,'IRON GUARD 10','heavy'),makeMech(-105,-2140,'WORKS GUARD 11','medium'),createTurret(-42,-1770,'WORKS SENTRY 12'),createTurret(300,-2050,'WORKS SENTRY 13')])e.zone='works';
 skyguard=createSkyguard();
 for(let e of[makeMech(-30,-3100,'RIDGE HOUND 14','medium'),makeMech(240,-3360,'RIDGE GUARD 15','heavy'),createTurret(-240,-3430,'RIDGE SENTRY 16')])e.zone='ridge';
}
function actorMatrix(o,out){const s=o.scale||1;_s3[0]=_s3[1]=_s3[2]=s;return M.transform([o.x,o.y,o.z],_s3,[0,Math.PI-o.yaw,0],out)}
function center(o){return[o.x,o.y+(o.centerHeight??(o.type==='mech'?12*(o.scale||1):o.type==='tower'?30:o.type==='uplink'?19:o.type==='generator'?17:o.type==='reactor'?29:6)),o.z]}
function entityHealth(o){if(o.type==='mech'){let h=0,m=0;for(let k of componentNames){h+=Math.max(0,o.components[k].hp);m+=o.components[k].max}return h/m}return Math.max(0,o.hp)/o.maxHP}
const WIRE={dead:[.20,.32,.24],downAlly:[.7,.28,.17],crit:[1,.24,.16],hurt:[1,.44,.16],target:[1,.89,.38],hostile:[.94,.61,.24],wreck:[.19,.31,.24],site:[.2,.86,.95]};
function componentWire(o,key){if(o.friendly)return o.alive?COOP_RGB[o.slot||0]:WIRE.downAlly;if(!o.alive)return WIRE.dead;let c=o.components?.[key],r=c?Math.max(0,c.hp/c.max):entityHealth(o);return r<.3?WIRE.crit:r<.65?WIRE.hurt:target===o?WIRE.target:WIRE.hostile}
function drawMech(o,hero=false){let mat=actorMatrix(o,_mA),mod=hero?playerModels[chassis]:o.model;let fade=o.alive?0:clamp(o.deathTime/3,0,1);if(fade)mat=M.mul(_mA,M.transform([0,-fade*7,0],ONE3,[fade*.8,0,fade*.24],_mT),_mB);const phase=o.phase||0,bob=Math.abs(Math.sin(phase))*Math.min(1,(o.speed||0)/8)*.4;
 const bodyMat=M.mul(mat,M.transform([0,bob,0],ONE3,[0,hero?Math.sin(realTime*.16)*.065:-(o.torso||0),0],_mT),_mBody);
 for(let p of mod.torso){if(o.components?.[p.component]?.hp<=0&&p.component!=='core')continue;if(R.imaging)R.wire=componentWire(o,p.component);drawPart(p,bodyMat)}
 for(let i=0;i<2;i++){const lift=Math.sin(phase+i*Math.PI)*Math.min(1,(o.speed||0)/7);const legMat=M.mul(mat,M.transform([0,Math.max(0,lift)*.9,lift*1.4],ONE3,[lift*.05,0,0],_mT),_mLeg);for(let p of mod.legs[i]){if(o.components?.[p.component]?.hp<=0)continue;if(R.imaging)R.wire=componentWire(o,p.component);drawPart(p,legMat)}for(let p of mod.arms[i]){if(o.components?.[p.component]?.hp<=0)continue;if(R.imaging)R.wire=componentWire(o,p.component);drawPart(p,bodyMat)}}
}
const TURRET_BASE=hex('#666b5e');
function drawEntity(o){if(o.type==='mech')return drawMech(o);if(R.imaging)R.wire=!o.alive?WIRE.wreck:o.type==='turret'?componentWire(o,'core'):WIRE.site;let mat=actorMatrix(o,_eA);if(!o.alive){const t=clamp(o.deathTime/3,0,1);mat=M.mul(_eA,M.transform([0,-t*o.height*.65,0],ONE3,[0,0,t*.4],_eT),_eB)}
 if(o.parts){for(let p of o.parts)drawPart(p,mat)}
 else if(o.type==='turret'){const at=(p,s,r=ZERO3)=>M.mul(mat,M.transform(p,s,r,_eT),_eR);draw(geo.bevel,at([0,2,0],[5,2,5]),TURRET_BASE);draw(geo.cyl,at([0,4.6,0],[3,1.6,3]),palette.dark);draw(geo.bevel,at([0,6.7,0],[3.8,2,3]),palette.hostile);for(let s of[-1,1]){draw(geo.cyl,at([s*2.3,7.3,5],[.6,4,.6],[Math.PI/2,0,0]),palette.dark);draw(geo.cyl,at([s*2.3,7.3,9.1],[.5,.1,.5],[Math.PI/2,0,0]),palette.accent,1,.5)}}}
function lineMatrix(a,b,r,m=M.identity()){let y=norm(vsub(b,a)),x=norm(cross(Math.abs(y[1])>.98?[1,0,0]:[0,1,0],y)),z=cross(x,y),l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])*.5;for(let i=0;i<3;i++){m[i]=x[i]*r;m[4+i]=y[i]*l;m[8+i]=z[i]*r;m[12+i]=(a[i]+b[i])*.5;m[3+4*i]=0}m[15]=1;return m}
// Particle budget follows the quality tier (the look stays, the count scales).
let particleCap=kit.detail(320,120);kit.onQuality(()=>{particleCap=kit.detail(320,120)});
const SMOKE=hex('#524d43');
function burst(p,color,n=18,power=12){if(coop?.replaying)return;for(let i=0;i<n;i++){if(particles.length>particleCap*.75)particles.shift();particles.push({p:p.slice(),v:[rand(-power,power),rand(1,power*1.25),rand(-power,power)],color,size:rand(.25,1.3),life:rand(.4,1.5),max:1.5,smoke:false})}for(let i=0;i<5;i++)particles.push({p:p.slice(),v:[rand(-2,2),rand(4,8),rand(-2,2)],color:SMOKE,size:rand(2,4),life:rand(2,4),max:4,smoke:true})}
function soloSpawnBeam(a,b,c,width=.15,life=.19){beams.push({a:a.slice(),b:b.slice(),c,width,life,max:life})}

// Original extraction transport, built from the same low-polygon mesh library.
const transportParts=(()=>{const a=[],put=(g,p,s,c,r=[0,0,0],glow=0)=>a.push(part(g,p,s,c,r,glow));put('bevel',[0,0,0],[22,12,38],hex('#637165'));put('bevel',[0,2,15],[17,8,15],hex('#8c9380'),[.17,0,0]);put('bevel',[0,3.5,23],[12,2.4,.8],palette.visor,[.17,0,0],.7);put('box',[0,-6,1],[13,.8,22],palette.dark);put('bevel',[0,7,-7],[7,7,21],palette.armor);for(let side of[-1,1]){put('bevel',[side*18,-.3,-3],[19,4,17],palette.dark,[0,0,side*-.06]);put('bevel',[side*23,0,-5],[9,10,25],hex('#78806c'));put('box',[side*23,5.1,-5],[7,.3,18],palette.accent);for(let z of[-12,3]){put('cyl',[side*23,-5.5,z],[5.7,2,5.7],palette.joint);put('cyl',[side*23,-6.6,z],[4.2,.2,4.2],hex('#a9d7c3'),[0,0,0],1)}put('box',[side*9,1,-22],[5,12,1.4],palette.edge,[0,0,side*.25]);}return packParts(a)})();


// The supplied audio ships as MP3 files next to the game. Music decodes on demand, and only the
// playing track (plus the short startup cue) stays decoded, so a phone does not hold ~100 MB of PCM.
const AUDIO_BASE=new URL('./audio/',import.meta.url);
const SOUNDTRACK_INFO = Object.freeze({
 boot: {title:'3-01 "Reactor Online"', duration:8.542041, loop:false},
 basin: {title:'1-02 Umber Wall', duration:137.848163, loop:true},
 works: {title:'1-03 Silent Thunder', duration:143.072653, loop:true}
});
const VOICE_KEYS=['ammo','armor','basinSecure','batteryDown','commander','contact','coolant','death','destroy','disabled','enhanced','exposed','extract','feed','flightClear','heat','insertion','limb','linkAttack','linkJammed','lock','nav','nolock','online','optical','relay','repair','ridgeEntry','ridgeRoute','shield','shutdown','target','uplink','victory','works'];
const fetchBytes=path=>fetch(new URL(path,AUDIO_BASE)).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.arrayBuffer()});

class MissionSoundtrack {
 constructor(context, master, music) {
  this.ctx=context; this.master=master; this.music=music;
  this.buffers={}; this.loads={}; this.failures={}; this.bytes={};
  this.key=null; this.current=null; this.fading=new Set();
  this.offset=0; this.ended=false; this.paused=true; this.fadeIn=0; this.bootAsked=0;
 }
 /** Download a track ahead of time without decoding it (compressed bytes only). */
 warm(key) {
  if(this.bytes[key]||this.loads[key])return;
  this.bytes[key]=fetchBytes('music/'+key+'.mp3').catch(()=>null);
 }
 load(key) {
  if(this.loads[key])return this.loads[key];
  // Free any other decoded music track that is not playing.
  if(key!=='boot')for(const k of Object.keys(this.loads))if(k!=='boot'&&k!==key&&k!==this.key){delete this.loads[k];delete this.buffers[k]}
  this.loads[key]=(async()=>{
   const bytes=(await this.bytes[key])||await fetchBytes('music/'+key+'.mp3');
   delete this.bytes[key];
   const buffer=await this.ctx.decodeAudioData(bytes);
   if(this.loads[key])this.buffers[key]=buffer;
   return buffer;
  })().catch(error=>{
   this.failures[key]=String(error.message||error);
   console.warn('Soundtrack could not be loaded: '+SOUNDTRACK_INFO[key].title, error);
   return null;
  });
  return this.loads[key];
 }
 preload() {
  this.load('boot');
  this.warm('basin');
 }
 position() {
  if(!this.current)return this.offset;
  const clip=this.current, elapsed=clip.offset+Math.max(0,this.ctx.currentTime-clip.startedAt);
  return clip.loop?elapsed%clip.duration:Math.min(elapsed,clip.duration);
 }
 duration() {return this.key?(this.buffers[this.key]?.duration||SOUNDTRACK_INFO[this.key].duration):0}
 disconnect(clip) {
  try{clip.source.disconnect();clip.gain.disconnect()}catch(e){}
  this.fading.delete(clip);
 }
 retire(clip, seconds=0) {
  if(!clip)return;
  this.fading.add(clip);
  const now=this.ctx.currentTime, gain=clip.gain.gain;
  if(seconds>0){
   if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
   else{const value=gain.value;gain.cancelScheduledValues(now);gain.setValueAtTime(value,now)}
   gain.linearRampToValueAtTime(0,now+seconds);
   try{clip.source.stop(now+seconds+.01)}catch(e){this.disconnect(clip)}
  }else{
   clip.source.onended=null;
   try{clip.source.stop()}catch(e){}
   this.disconnect(clip);
  }
 }
 start() {
  if(!this.key||this.paused||this.current||this.ended||this.ctx.state!=='running')return;
  // A startup cue that arrives after the startup sequence fell back to its own clock stays silent.
  if(this.key==='boot'&&this.bootLate)return;
  const buffer=this.buffers[this.key];
  if(!buffer)return;
  const loop=SOUNDTRACK_INFO[this.key].loop;
  if(!loop&&this.offset>=buffer.duration){this.ended=true;return}
  const source=this.ctx.createBufferSource(), gain=this.ctx.createGain();
  source.buffer=buffer; source.loop=loop;
  const level=this.key==='boot'?.85:1, now=this.ctx.currentTime;
  gain.gain.setValueAtTime(this.fadeIn>0?0:level,now);
  if(this.fadeIn>0)gain.gain.linearRampToValueAtTime(level,now+this.fadeIn);
  source.connect(gain); gain.connect(this.key==='boot'?this.master:this.music);
  const clip={source,gain,key:this.key,loop,duration:buffer.duration,offset:this.offset,startedAt:now};
  this.current=clip;
  source.onended=()=>{
   // A stopped or fading source must not end a newer cue.
   if(this.current===clip){this.current=null;this.offset=clip.duration;this.ended=true}
   this.disconnect(clip);
  };
  source.start(0,loop?this.offset%buffer.duration:this.offset);
  this.fadeIn=0;
 }
 sync(key, paused=false) {
  if(!key){if(this.key!==null||this.current)this.stop();return}
  if(key!==this.key){
   const old=this.current, crossfade=!!this.key&&this.key!=='boot'&&key!=='boot';
   this.current=null; this.key=key; this.offset=0; this.ended=false;
   this.fadeIn=key==='boot'?0:crossfade?1.2:.35;
   if(key==='boot'){this.bootAsked=performance.now();this.bootLate=false}
   if(old)this.retire(old,crossfade?1.2:.025);
   this.load(key);
  }
  if(paused){this.pause();return}
  this.paused=false;
  this.start();
 }
 pause() {
  if(this.paused)return;
  this.offset=this.position(); this.paused=true;
  const old=this.current; this.current=null;
  for(const clip of [...this.fading])this.retire(clip,0);
  if(old)this.retire(old,.025);
  this.fadeIn=.025;
 }
 stop() {
  const old=this.current; this.current=null;
  this.key=null; this.offset=0; this.ended=false; this.paused=true; this.fadeIn=0;
  for(const clip of [...this.fading])this.retire(clip,0);
  if(old)this.retire(old,.025);
 }
 status() {
  return {cue:this.key,title:this.key?SOUNDTRACK_INFO[this.key].title:null,
   playing:!!this.current&&this.ctx.state==='running',paused:this.paused,
   position:this.position(),duration:this.duration(),loop:this.key?SOUNDTRACK_INFO[this.key].loop:false,
   loaded:Object.keys(this.buffers),failed:Object.keys(this.failures)};
 }
}

class SoundSystem{
 constructor(){this.ctx=null;this.buffers={};this.lastVoice={};this.voiceSource=null;this.muted=false;this.active=false;this.lastVoiceAt=-10;this.voiceUntil=0;this.soundtrack=null}
 async init(){
  if(this.ctx){this.ctx.resume().catch(()=>{});this.active=true;return}
  try{
   this.ctx=new(window.AudioContext||window.webkitAudioContext)();const c=this.ctx;
   this.master=c.createGain();this.master.gain.value=this.muted?0:settings.volume;this.master.connect(c.destination);
   this.fx=c.createGain();this.fx.gain.value=.7;this.fx.connect(this.master);
   this.music=c.createGain();this.music.gain.value=settings.music;this.music.connect(this.master);
   this.soundtrack=new MissionSoundtrack(c,this.master,this.music);this.soundtrack.preload();
   this.engine=c.createGain();this.engine.gain.value=.03;this.engine.connect(this.fx);this.engineOsc=[];
   for(let f of[41,82.3]){let o=c.createOscillator();o.type='sawtooth';o.frequency.value=f;let fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=160;o.connect(fl);fl.connect(this.engine);o.start();this.engineOsc.push(o)}
   let b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;this.noiseBuffer=b;this.active=true;
   // Radio clips are small: fetch and decode them all once audio starts (MP3, so Safari plays them too).
   for(const k of VOICE_KEYS)fetchBytes('voice/'+k+'.mp3').then(b=>c.decodeAudioData(b)).then(b=>{this.buffers[k]=b}).catch(()=>{});
   await c.resume();
  }catch(e){this.active=false;console.warn('Audio unavailable:',e.message)}
 }
 tone(f,to,dur,vol=.1,type='sine',dest=null,at=0){if(!this.ctx||!this.active)return;let c=this.ctx,t=at||c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(10,f),t);o.frequency.exponentialRampToValueAtTime(Math.max(10,to),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||this.fx);o.start(t);o.stop(t+dur+.03)}
 noise(dur,vol=.1,freq=1200,at=0){if(!this.ctx||!this.active)return;let c=this.ctx,t=at||c.currentTime,o=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();o.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.15),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(f);f.connect(g);g.connect(this.fx);o.start(t,Math.random());o.stop(t+dur)}
 say(name,force=false){
  // The supplied startup clip replaces the old spoken startup sequence.
  if(!this.ctx||!this.active||state==='boot'||state==='paused'&&pausedFrom==='boot')return;
  let t=this.ctx.currentTime;if(!force&&((this.lastVoice[name]||-99)+7>t||t-this.lastVoiceAt<1.8))return;if(!this.buffers[name])return;
  this.lastVoice[name]=t;this.lastVoiceAt=t;this.stopVoice();
  let s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers[name];g.gain.value=.72;s.connect(g);g.connect(this.master);s.start();this.voiceSource=s;this.voiceUntil=t+s.buffer.duration;
  s.onended=()=>{if(this.voiceSource===s){this.voiceSource=null;this.voiceUntil=0}s.disconnect();g.disconnect()};
  this.tone(1040,1040,.065,.025);
 }
 fxPlay(kind,vol=1){if(!this.ctx||!this.active)return;switch(kind){case'laser':this.tone(900,130,.26,.11*vol,'sawtooth');this.tone(1550,230,.19,.07*vol);this.noise(.14,.08*vol,6500);break;case'cannon':this.tone(145,32,.42,.28*vol,'triangle');this.noise(.35,.33*vol,5000);this.tone(1900,70,.075,.12*vol,'square');break;case'missile':this.noise(.7,.23*vol,2800);this.tone(95,260,.48,.08*vol,'sawtooth');break;case'explosion':this.noise(1.4,.38*vol,2300);this.tone(74,23,1.2,.33*vol);break;case'hit':this.noise(.24,.19*vol,4400);this.tone(112,35,.28,.17*vol);break;case'step':this.tone(60,24,.3,.23*vol);this.noise(.15,.07*vol,1200);break;case'beep':this.tone(680,950,.075,.04*vol,'square');break;case'warning':this.tone(510,510,.18,.07*vol,'square');this.tone(420,420,.18,.05*vol,'square',null,this.ctx.currentTime+.25);break;case'coolant':this.noise(1.4,.16*vol,7500);break;case'jet':this.noise(.22,.1*vol,1000);break}}
 update(){
  if(!this.ctx||!this.active)return;
  let c=this.ctx,t=c.currentTime,run=(state==='playing'||state==='boot')&&!coop?.held;
  const scene=state==='paused'?pausedFrom:state;
  const cue=scene==='boot'?'boot':scene==='playing'?musicCue():null;
  this.soundtrack.sync(cue,state==='paused'||!!coop?.held);
  // Fetch (not decode) the next track ahead of time.
  if(scene==='boot')this.soundtrack.warm(musicCue());else if(scene==='playing'&&cue==='basin'&&(mode==='arena'?arena.wave>=4:missionFlags[0]||missionFlags[1]))this.soundtrack.warm('works');
  this.master.gain.setTargetAtTime(this.muted?0:settings.volume,t,.08);
  // Keep radio speech clear. The startup cue follows master volume, not music volume.
  this.music.gain.setTargetAtTime(run?settings.music*(t<this.voiceUntil?.48:1):0,t,.14);
  this.engine.gain.setTargetAtTime(run?(player.shutdown>0?.006:.022+Math.abs(player.speed)/22*.035):0,t,.12);
  for(let i=0;i<this.engineOsc.length;i++)this.engineOsc[i].frequency.setTargetAtTime((i?82.3:41)+Math.abs(player.speed)*(i?1.4:.7),t,.2);
 }
 bootStatus(){
  const track=this.soundtrack,duration=track?.buffers.boot?.duration||SOUNDTRACK_INFO.boot.duration;
  if(!this.active||!track||track.failures.boot||track.bootLate)return{time:null,duration,ended:false};
  // The cue could not start (slow download, or audio still locked): run the startup on its own clock.
  if(track.key==='boot'&&!track.current&&!track.ended&&!track.paused&&performance.now()-track.bootAsked>2500){track.bootLate=true;return{time:null,duration,ended:false}}
  return{time:track.key==='boot'?track.position():0,duration,ended:track.key==='boot'&&track.ended};
 }
 stopVoice(){this.voiceUntil=0;if(this.voiceSource){const source=this.voiceSource;this.voiceSource=null;try{source.stop()}catch(e){}}}
 resetMissionAudio(){this.soundtrack?.stop();this.stopVoice();this.lastVoice={};this.lastVoiceAt=-10}
}
const sound=new SoundSystem();

let state='menu',realTime=0,missionTime=0,bootTime=0,bootStep=-1,player,target=null,lock=0,lockSpoken=false,weaponIndex=0,navIndex=0,mapOpen=false,helpFrom='menu';
let kills=0,score=0,shotsFired=0,shotsHit=0,extractTime=0,reinforcements=false,extractAnnounced=false,transportTime=0,missionFlags=Array(8).fill(false),radio=[],toastTimer=0,damageFlash=0,shakePower=0,zoom=false;
let missionStage='basin',serviceTime=0,serviceUsed=false,sectorBanner=null,imagingSwitch=0;
let supplyTime=0,supplyUsed=false,linkTime=0,linkWave=0,linkStatus='LOCKED',linkBlocked=false;
// Operation: 'mission' (Iron Echo, three sectors) or 'arena' (Proving Grounds, ten waves).
let mode='mission',arena={wave:0,phase:'intro',timer:8,serial:21,turret:0},resumeCheckpoint=null;

let difficulty='regular',loadout='balanced';
// What the pilot asks of the machine this frame: from kit actions, or from a co-op pilot's input packet.
const NO_CTL=Object.freeze({thr:0,turn:0,ax:0,ay:0,jets:false,fire:false,all:false,restore:false});
let ctl={...NO_CTL};const timers={};
const config={balanced:{label:'BALANCED',ammo:60,missiles:40,cool:8.5,coolants:2,damage:1,desc:'Two pulse lasers, a coil cannon, and guided missiles. A flexible combat load with two coolant charges.'},cool:{label:'COOL RUNNER',ammo:45,missiles:32,cool:12.5,coolants:3,damage:.9,desc:'Extra heat sinks and three coolant charges. Ten percent less weapon damage, with a smaller ammunition load.'},heavy:{label:'HEAVY GUN',ammo:85,missiles:56,cool:7,coolants:1,damage:1.2,desc:'Twenty percent more weapon damage and extra ammunition. Less cooling capacity. One coolant charge.'}};
let weapons=[{name:'DUAL PULSE',short:'PULSE',heat:17,damage:38,cooldown:.84,range:820,color:hex('#a5ee73'),remaining:0},{name:'COIL CANNON',short:'CANNON',heat:9,damage:61,cooldown:1.7,range:1150,color:hex('#ffda85'),remaining:0},{name:'MISSILE / 4',short:'MISSILE',heat:23,damage:22,cooldown:4.0,range:1150,color:hex('#ffae64'),remaining:0}];
function applyChassisWeapons(){chassisData().weapons.forEach((w,i)=>Object.assign(weapons[i],w,{remaining:0}))}
function capacities(){return{ammo:Math.round(config[loadout].ammo*chassisData().ammo),missiles:Math.round(config[loadout].missiles*chassisData().missiles),coolants:config[loadout].coolants}}
function newPlayer(){let components={};for(let k of componentNames){let hp={head:100,core:240,leftTorso:140,rightTorso:140,leftArm:110,rightArm:110,leftLeg:150,rightLeg:150}[k];hp=Math.round(hp*chassisData().armor);components[k]={hp,max:hp}}return{x:0,z:92,y:terrainY(0,92),yaw:0,torso:0,pitch:0,speed:0,throttle:0,altitude:0,vy:0,grounded:true,phase:0,heat:0,fuel:100,ammo:capacities().ammo,missiles:capacities().missiles,coolants:capacities().coolants,components,shutdown:0,vision:false,imaging:false,align:false,centerTorso:false,legStep:0,jetSound:0,heatWarning:false,armorWarning:false,alive:true}}
applyChassisWeapons();player=newPlayer();populate();
function soloAnnounce(text,voice=null,duration=7){radio.push({text,time:duration,max:duration});if(radio.length>3)radio.shift();if(voice)sound.say(voice,true)}
function soloToast(text,seconds=3){const el=$('toast');if(el.textContent!==text)el.textContent=text;el.hidden=false;toastTimer=seconds}
function closeOverlays(){document.querySelectorAll('.overlay').forEach(e=>e.hidden=true)}
function resetGame(){sound.resetMissionAudio();Object.assign(ctl,NO_CTL);applyChassisWeapons();player=newPlayer();populate();target=null;lock=0;lockSpoken=false;weaponIndex=0;navIndex=0;mapOpen=false;missionTime=0;kills=0;score=0;shotsFired=0;shotsHit=0;extractTime=0;reinforcements=false;extractAnnounced=false;transportTime=0;missionFlags=Array(8).fill(false);missionStage=mode==='arena'?'arena':'basin';serviceTime=0;serviceUsed=false;supplyTime=0;supplyUsed=false;linkTime=0;linkWave=0;linkStatus='LOCKED';linkBlocked=false;sectorBanner=null;imagingSwitch=0;$('enhancedView').checked=false;$('nightVision').checked=false;radio=[];damageFlash=0;shakePower=0;zoom=false;for(let k in timers)delete timers[k];for(let w of weapons)w.remaining=0;resumeCheckpoint=null}
// Mouse capture only for a mouse; touch and gamepad aim without it.
function requestCapture(){if(input.source==='touch'||!matchMedia('(any-pointer: fine)').matches)return;input.lockPointer()}
function soloStartMission(cp=null){closeOverlays();$('menu').hidden=true;resetGame();if(mode==='mission'){if(cp)applyCheckpoint(cp);else clearCheckpoint()}state='boot';bootTime=0;bootStep=-1;input.settle();sound.init();sound.update();requestCapture()}
let pausedFrom='playing';
function soloPauseGame(){if(state!=='playing'&&state!=='boot')return;pausedFrom=state;state='paused';$('pause').hidden=false;Object.assign(ctl,NO_CTL);input.unlockPointer();sound.stopVoice();sound.update();focusFirstLater($('pause'))}
function soloResumeGame(){closeOverlays();state=pausedFrom;input.settle();sound.ctx?.resume().catch(()=>{});sound.update();requestCapture()}
function soloReturnMenu(){state='menu';input.unlockPointer();sound.stopVoice();closeOverlays();$('menu').hidden=false;mode='mission';resetGame();$('toast').hidden=true;refreshMenu();focusFirstLater($('menu'))}
function finishSoloMission(won){if(state==='won'||state==='lost')return;state=won?'won':'lost';sound.soundtrack?.stop();player.throttle=0;Object.assign(ctl,NO_CTL);mapOpen=false;input.unlockPointer();
 const arenaRun=mode==='arena',guest=!!(coop?.active&&coop.guest);let accuracy=shotsFired?Math.round(shotsHit/shotsFired*100):0,armor=Math.round(playerArmor()*100);
 if(won&&!guest)score+=arenaRun?3000+Math.round(armor*10):2000+Math.round(armor*10)+Math.max(0,1200-Math.floor(missionTime*2));
 closeOverlays();$('result').hidden=false;
 $('resultCode').textContent=arenaRun?'RANGE DEBRIEF / PROVING GROUNDS':'MISSION DEBRIEF / 01';
 $('resultEyebrow').textContent=arenaRun?(won?'ALL '+ARENA.waves+' WAVES CLEARED.':'WAVE '+Math.max(1,arena.wave)+' OF '+ARENA.waves+'. PILOT RECOVERED.'):won?'FLIGHT PATH OPEN. MISSION COMPLETE.':'SIGNAL LOST. PILOT RECOVERED.';
 $('resultTitle').textContent=arenaRun?(won?'GROUNDS CLEARED.':'MACHINE LOST.'):won?'FLIGHT PATH SECURED.':'MACHINE LOST.';
 $('resultText').textContent=arenaRun?(won?'Ten waves are down, the proving commander with them. Range control has logged your machine as combat ready.':'Your machine went down on wave '+Math.max(1,arena.wave)+'. Range control recovered the pilot. The trial log keeps your best wave.'):won?'The basin relay and the Ashfall reactor are down. You crossed Blackglass Ridge, destroyed the Skyguard battery, and secured the flight codes. The transport has recovered your machine.':'Your machine took critical damage. The emergency system recovered the pilot, but the mission is not complete.';
 $('resultMech').textContent=chassisData().code+' / '+chassisData().name;$('resultTime').textContent=formatTime(missionTime);$('resultKills').textContent=kills+' / '+entities.filter(e=>e.type==='mech'||e.type==='turret').length;$('resultScore').textContent=score.toLocaleString();
 let record='';
 try{
  if(arenaRun){const b=JSON.parse(localStorage.getItem('robotwarrior.arena.best.v1')||'{}'),reached=won?ARENA.waves+1:Math.max(1,arena.wave),bw=Number(b.wave)||0,bs=Number(b.score)||0,better=reached>bw||reached===bw&&score>bs;if(better)localStorage.setItem('robotwarrior.arena.best.v1',JSON.stringify({wave:reached,score}));const w=better?reached:bw,sc=better?score:bs;record=' · Best trial: '+(w>ARENA.waves?'all waves':'wave '+w)+' / '+sc.toLocaleString()}
  else{const best=Number(localStorage.getItem('robotwarrior.best.v3')||0),bt=Number(localStorage.getItem('robotwarrior.besttime.v1')||0);if(won&&score>best)localStorage.setItem('robotwarrior.best.v3',String(score));if(won&&(!bt||missionTime<bt))localStorage.setItem('robotwarrior.besttime.v1',String(missionTime));if(won)record=' · Best score: '+Math.max(best,score).toLocaleString()+' · Best time: '+formatTime(bt?Math.min(bt,missionTime):missionTime);if(won&&!guest)clearCheckpoint()}
 }catch(e){}
 $('resultDetail').textContent=`Armor remaining: ${armor}% · Hit rate: ${Math.min(100,accuracy)}% · ${chassisData().name} · ${difficulty.toUpperCase()} / ${config[loadout].label}`+record;
 $('retryBtn').hidden=won||arenaRun||!!coop?.active||!readCheckpoint();
 sound.say(won?'victory':'death',true);focusFirstLater($('result'))}
function playerArmor(){let a=0,b=0;for(let c of Object.values(player.components)){a+=Math.max(0,c.hp);b+=c.max}return a/b}
function formatTime(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
// In co-op the host simulates every pilot in turn; only effects for the pilot at this screen shake, flash or rumble it.
const isLocal=()=>!(coop?.executing&&coop.executing!==coop.id);
function localPilot(){return isLocal()?player:coop.members.get(coop.id)?.sim?.p||player}
function localRumble(strength,ms){if(isLocal()&&!coop?.replaying)input.rumble(strength,ms)}
let hitMarker=0;
function chooseTarget(cycle=false){let list=entities.filter(e=>e.alive&&dist2(player,e)<1600).sort((a,b)=>dist2(player,a)-dist2(player,b));if(!list.length){target=null;return}let index=cycle?list.indexOf(target)+1:0;target=list[index%list.length];lock=0;lockSpoken=false;sound.say('target');sound.fxPlay('beep')}
function forward(){const y=player.yaw+player.torso,p=player.pitch;return[Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)]}
function fireOrigin(){return[player.x,player.y+chassisData().eye+player.altitude,player.z]}
function raySphere(origin,dir,c,r,max=1e9){let oc=vsub(origin,c),b=dot(oc,dir),q=dot(oc,oc)-r*r,d=b*b-q;if(d<0)return Infinity;let t=-b-Math.sqrt(d);if(t<0)t=-b+Math.sqrt(d);return t>=0&&t<=max?t:Infinity}
function coverDistance(origin,dir,max,exclude=null){let t=max;
 if(ridgeGateLocked()&&Math.abs(dir[2])>.00001){let u=(ridgeGate.z-origin[2])/dir[2],x=origin[0]+dir[0]*u,y=origin[1]+dir[1]*u,base=terrainY(x,ridgeGate.z);if(u>0&&u<t&&Math.abs(x-ridgeGate.x)<ridgeGate.width/2&&y>base&&y<base+ridgeGate.height)t=u}for(let o of solidObstacles){let c=[o.x,terrainY(o.x,o.z)+o.h*.5,o.z];let ox=origin[0]-o.x,oz=origin[2]-o.z,b=ox*dir[0]+oz*dir[2],a=dir[0]*dir[0]+dir[2]*dir[2],disc=b*b-a*(ox*ox+oz*oz-o.r*o.r);if(disc>0&&a>.00001){let u=(-b-Math.sqrt(disc))/a,yy=origin[1]+dir[1]*u;if(u>1&&u<t&&yy>c[1]-o.h*.5&&yy<c[1]+o.h*.5)t=u}}
 for(let u=8;u<t;u+=18){let x=origin[0]+dir[0]*u,z=origin[2]+dir[2]*u,y=origin[1]+dir[1]*u;if(y<terrainY(x,z)+.1){t=u;break}}
 return t}
function clearLOS(a,b){let dif=vsub(b,a),d=Math.hypot(...dif);return coverDistance(a,vmul(dif,1/d),d)>d-4}
function trace(origin,dir,range,assist=true){let nearest=coverDistance(origin,dir,range),hit=null,component='core';for(let e of entities){if(!e.alive)continue;if(e.type==='mech'){let m=actorMatrix(e);for(let k of componentNames){if(e.components[k].hp<=0)continue;let c=M.point(m,compSpec[k].p),r=compSpec[k].r*e.scale+(assist?.45:0),t=raySphere(origin,dir,c,r,range);if(t<nearest){nearest=t;hit=e;component=k}}}else{let c=center(e),r=e.hitRadius??(e.type==='tower'?17:e.type==='uplink'?26:e.type==='generator'?17:e.type==='reactor'?30:5);let t=raySphere(origin,dir,c,r,range);if(t<nearest){nearest=t;hit=e;component='core'}}}return{entity:hit,component,distance:nearest,point:vadd(origin,vmul(dir,nearest))}}
function applyDamage(e,amount,component='core'){if(coop?.guest&&coop.active)return;if(!e?.alive)return;if(e.skyguard&&reactor?.alive){if(missionTime>(timers.batteryShield||-1)){announce('SKYGUARD ARMORED / Destroy the Ashfall reactor first.',null,5);timers.batteryShield=missionTime+7}burst(center(e),hex('#6cbfc8'),5,4);return}if(e===reactor&&reactorShielded()){if(!timers.shieldWarning||missionTime>timers.shieldWarning){announce('REACTOR SHIELDED / Destroy both power feeds first.','shield',6);timers.shieldWarning=missionTime+7}burst(center(e),hex('#6cbfc8'),5,4);return;}e.hitFlash=.16;if(e.type==='mech'){let c=e.components[component]||e.components.core;if(c.hp<=0){component='core';c=e.components.core}const spill=Math.max(0,amount-c.hp);c.hp-=amount;if(component!=='core')e.components.core.hp-=amount*.18+spill*.5;if(c.hp<=0&&component!=='core'){burst(M.point(actorMatrix(e),compSpec[component].p),hex('#ffb05f'),12,7);if(component==='leftLeg'||component==='rightLeg')e.speed*=.4}if(e.components.core.hp<=0||e.components.head.hp<=0||(e.components.leftLeg.hp<=0&&e.components.rightLeg.hp<=0))destroyEntity(e)}else{e.hp-=amount;if(e.hp<=0)destroyEntity(e)}}
function destroyEntity(e){
 if(!e.alive)return;e.alive=false;e.deathTime=0;burst(center(e),hex('#ffac56'),45,e.type==='mech'?18:30);{const me=localPilot(),d=dist2(me,e),v=clamp(1-d/1200,.12,.9);if(isLocal())sound.fxPlay('explosion',v);else if(!coop?.replaying)coopRawFx.call(sound,'explosion',v);shakePower=Math.max(shakePower,clamp(200/Math.max(1,d),0,1));if(d<260)input.rumble(clamp(90/Math.max(1,d),.15,.7),220)}
 if(e.type==='mech'||e.type==='turret'){kills++;score+=e.type==='mech'?(e.class==='heavy'?650:450)+(e.commander?500:0):e.longbow?400:250;announce(e.name+' — DESTROYED','destroy',4)}
 if(e===relay){missionFlags[0]=true;score+=1000;navIndex=missionFlags[1]?0:1;announce('CONTROL / Relay is down. Clear the basin defenders.','relay',8);if(!reinforcements){let r=makeMech(-225,-640,'BASTION 06','medium');r.alert=true;r.zone='basin';reinforcements=true}}
 if(e===uplink){missionFlags[1]=true;score+=1500;navIndex=missionFlags[0]?1:0;announce(missionFlags[0]?'CONTROL / Uplink is down. Clear the remaining basin defenders.':'CONTROL / Uplink is down. Destroy the relay.','uplink',8)}
 if(e===westFeed||e===eastFeed){score+=800;if(reactorShielded()){navIndex=westFeed.alive?3:4;announce('CONTROL / One power feed remains.','feed',6)}else{navIndex=5;announce('CONTROL / Shield is down. Destroy the exposed reactor.','exposed',8)}}
 if(e===reactor){missionFlags[4]=true;score+=2400;transportTime=0;if(missionFlags[3])beginRidgeTransit();else announce('CONTROL / Reactor destroyed. Clear the basin and cross NAV CHARLIE first.',null,9);burst(center(e),hex('#ffd093'),60,44)}
 if(e===skyguard){missionFlags[6]=true;score+=1500;if(missionFlags[5]){missionStage='link';navIndex=8;sectorBanner={title:'AIR DEFENSES DOWN',sub:'NAV INDIA / SECURE THE FLIGHT CODES',time:6};announce('CONTROL / Skyguard is down. Stop inside the flight-link ring at NAV INDIA.','batteryDown',10)}}
 if(target===e){lock=0;lockSpoken=false}
}
function damagePlayer(amount,from,component=null){if(coop?.guest&&coop.active)return;if(state!=='playing'||!player.alive)return;amount*=difficulty==='cadet'?.55:difficulty==='veteran'?1.4:1;const choices=['core','core','leftTorso','rightTorso','leftArm','rightArm','leftLeg','rightLeg'];component=component||choices[Math.floor(random()*choices.length)];let c=player.components[component];if(c.hp<=0){component='core';c=player.components.core}let spill=Math.max(0,amount-c.hp);c.hp-=amount;if(component!=='core')player.components.core.hp-=spill*.6;if(c.hp<=0&&component!=='core'){announce(component.replace(/([A-Z])/g,' $1').toUpperCase()+' — DISABLED','limb',4);burst(fireOrigin(),hex('#ffb164'),10,6)}if(isLocal()){damageFlash=Math.min(.5,damageFlash+.22);shakePower=Math.min(1.3,shakePower+.3)}sound.fxPlay('hit',.7);localRumble(Math.min(1,.3+amount/60),160);if(player.components.core.hp<=0||player.components.head.hp<=0||(player.components.leftLeg.hp<=0&&player.components.rightLeg.hp<=0)){player.alive=false;if(coop?.active)coop.downCurrent();else endMission(false)}if(!player.armorWarning&&(player.components.core.hp/player.components.core.max<.38||playerArmor()<.35)){player.armorWarning=true;announce('WARNING / Armor is critical. Use cover.','armor',6)}}
function weaponDisabled(index){return index===0&&player.components.leftArm.hp<=0||index===1&&player.components.rightArm.hp<=0||index===2&&player.components.leftTorso.hp<=0&&player.components.rightTorso.hp<=0}
function soloFireWeapon(index){if(state!=='playing'||player.shutdown>0)return;let w=weapons[index];if(w.remaining>0)return;if(weaponDisabled(index)){sound.say('disabled');return}if(index===1&&player.ammo<=0||index===2&&player.missiles<=0){sound.say('ammo');return}if(index===2&&(!target?.alive||lock<1)){sound.say('nolock');if(!timers.noLock||missionTime>timers.noLock){toast('Keep the selected target near the center sight to gain missile lock.',3);timers.noLock=missionTime+7}return}
 let origin=fireOrigin(),dir=forward(),right=[Math.cos(player.yaw+player.torso),0,Math.sin(player.yaw+player.torso)];let result=trace(origin,dir,w.range);w.remaining=w.cooldown;player.heat+=w.heat;shotsFired++;if(isLocal()){shakePower=Math.max(shakePower,index===1?.32:.12);input.rumble(index===1?.4:index===2?.3:.12,index===0?50:110)}const owner=coop?.currentId||'';let dmg=w.damage*config[loadout].damage;
 if(index===0){for(let s of[-1,1]){let muzzle=vadd(origin,vadd(vmul(right,3.9*s),[0,-2.7,0]));spawnBeam(muzzle,result.point,w.color,.13,.22)}burst(result.point,w.color,5,3);if(result.entity){shotsHit++;if(isLocal())hitMarker=.18;applyDamage(result.entity,dmg,result.component)}sound.fxPlay('laser')}
 if(index===1){player.ammo--;let muzzle=vadd(origin,vadd(vmul(right,4.4),[0,-2.9,0]));let d=norm(vsub(result.point,muzzle));projectiles.push({p:muzzle,v:vmul(d,550),type:'cannon',friendly:true,life:3,damage:dmg,color:w.color,prev:muzzle.slice(),hit:false,range:w.range,traveled:0,owner});sound.fxPlay('cannon')}
 if(index===2){let n=Math.min(chassisData().volley,player.missiles);player.missiles-=n;for(let i=0;i<n;i++){let muzzle=vadd(origin,vadd(vmul(right,(i%2?1:-1)*5.2),[0,3.3+Math.floor(i/2)*1,0]));projectiles.push({p:muzzle,v:vadd(vmul(dir,52),[rand(-4,4),rand(7,15),rand(-4,4)]),type:'missile',friendly:true,target,life:10,damage:dmg,color:w.color,prev:muzzle.slice(),trail:0,hit:false,age:0,shotCount:i===0,owner})}sound.fxPlay('missile')}
 if(player.heat>=100)shutdown();
}
function shutdown(){if(player.shutdown>0)return;player.shutdown=5;player.heat=100;announce('REACTOR SHUTDOWN / Cooling in progress. [{coolant}] Coolant.','shutdown',6);sound.fxPlay('warning');localRumble(.6,320)}
function soloCoolant(){if(player.coolants<=0){toast('No coolant charges remain.');return}if(player.heat<12){toast('Heat is low. Keep your coolant.');return}player.coolants--;player.heat=Math.max(0,player.heat-55);if(player.shutdown>0){player.shutdown=0;announce('REACTOR RESTORED','online',3)}sound.fxPlay('coolant');sound.say('coolant');burst(vadd(fireOrigin(),[0,-3,-2]),hex('#aebaaa'),5,3)}
function collides(x,z,alt=0,radius=5,self=null){if(mode==='mission'&&ridgeGateLocked()&&alt<ridgeGate.height&&Math.abs(z-ridgeGate.z)<3+radius&&Math.abs(x-ridgeGate.x)<ridgeGate.width/2+radius)return true;for(let o of solidObstacles){if(alt<o.h&&Math.hypot(x-o.x,z-o.z)<o.r+radius)return true}for(let e of entities){if(!e.alive||e.type==='mech'||e===self)continue;if(alt<(e.collisionHeight??(e.type==='turret'?5:e.type==='reactor'?45:16))&&Math.hypot(x-e.x,z-e.z)<(e.collisionRadius??(e.type==='uplink'?29:e.type==='tower'?17:e.type==='reactor'?33:e.type==='generator'?17:6))+radius)return true}return false}
function moveActor(e,dx,dz,alt=0,r=5){if(!collides(e.x+dx,e.z+dz,alt,r,e)){e.x+=dx;e.z+=dz}else if(!collides(e.x+dx,e.z,alt,r,e))e.x+=dx;else if(!collides(e.x,e.z+dz,alt,r,e))e.z+=dz;else return false;e.x=clamp(e.x,-640,640);e.z=clamp(e.z,mode==='arena'?ARENA.minZ:-3990,430);e.y=terrainY(e.x,e.z);return true}
function soloEnemyFire(e){if(e.longbow)return longbowFire(e);let a=center(e),b=fireOrigin(),distance=dist2(player,e);if(!clearLOS(a,b))return;let dir=norm(vsub(b,a)),lead=.22,spread=(difficulty==='cadet'?9:6)+distance*.008+Math.abs(player.speed)*.18;let aim=vadd(b,[Math.sin(player.yaw)*player.speed*lead+rand(-spread,spread),rand(-spread*.55,spread*.55),-Math.cos(player.yaw)*player.speed*lead+rand(-spread,spread)]);if(e.type==='turret'||e.class==='heavy'){projectiles.push({p:a.slice(),v:vmul(norm(vsub(aim,a)),245),type:'hostile',friendly:false,life:4.5,damage:e.skyguard?32:e.commander?34:e.class==='heavy'?28:18,color:hex('#ff7150'),prev:a.slice(),hit:false});spawnBeam(a,vadd(a,vmul(dir,10)),hex('#ffb16a'),.3,.12);sound.fxPlay('cannon',clamp(1-distance/950,.05,.28))}else{spawnBeam(a,aim,hex('#f87156'),.18,.24);let off=Math.hypot(...vsub(aim,b));if(off<(player.altitude>2?5:6.4))damagePlayer(e.class==='scout'?12:17,e);sound.fxPlay('laser',clamp(1-distance/950,.05,.28))}}
function updateOneEnemy(e,dt){e.hitFlash=Math.max(0,e.hitFlash-dt);if(!e.alive){e.deathTime+=dt;if(e.deathTime<2&&random()<dt*9)burst(vadd(center(e),[rand(-5,5),rand(-5,5),rand(-5,5)]),hex('#ff9e51'),8,10);if(e.deathTime<50&&random()<dt*3){particles.push({p:[e.x,e.y+5,e.z],v:[.8,3.5,.2],color:hex('#373b36'),size:4,life:5,max:5,smoke:true})}return}if(e.type!=='mech'&&e.type!=='turret')return;if(e.zone==='ridge'&&!missionFlags[5]&&player.z>-2960&&e.hitFlash<=0)return;if(e.zone==='pass'&&!e.alert&&player.z>-1120&&e.hitFlash<=0)return;let distance=dist2(player,e);if(distance<440||e.hitFlash>0)e.alert=true;if(!e.alert)return;if(!e.contact&&distance<510){e.contact=true;announce('SENSOR / '+e.name+' detected.','contact',5)}let focus=e.assaultLink&&!missionFlags[7]?flightLink:player,focusDistance=dist2(e,focus),desired=Math.atan2(focus.x-e.x,-(focus.z-e.z));e.yaw+=clamp(wrap(desired-e.yaw),-dt*.8,dt*.8);if(e.type==='mech'){let desiredRange=e.class==='scout'?155:e.class==='heavy'?270:225,speed=e.class==='scout'?11:e.class==='heavy'?5.7:8;let legFactor=(e.components.leftLeg.hp<=0||e.components.rightLeg.hp<=0)?.28:1;let radial=distance>desiredRange?1:distance<100?-.55:0,side=distance<450?.42*e.strafe:0;if(e.assaultLink&&!missionFlags[7]){radial=focusDistance>48?1:0;side=focusDistance>75?0:.18*e.strafe}else if(entityHealth(e)<.23)radial=-.6;let dx=(Math.sin(desired)*radial+Math.cos(desired)*side)*speed*dt*legFactor,dz=(-Math.cos(desired)*radial+Math.sin(desired)*side)*speed*dt*legFactor;let moved=moveActor(e,dx,dz,0,6);if(!moved){e.strafe*=-1;moveActor(e,Math.cos(desired)*speed*dt*e.strafe,Math.sin(desired)*speed*dt*e.strafe,0,6)}e.speed=Math.hypot(dx,dz)/dt;e.phase+=e.speed*dt*.27}
 else if(e.longbow){const want=distance>620?1:distance<340?-1:0,spd=7*dt,dx=(Math.sin(desired)*want+Math.cos(desired)*e.strafe*.35)*spd,dz=(-Math.cos(desired)*want+Math.sin(desired)*e.strafe*.35)*spd;if(!moveActor(e,dx,dz,0,7))e.strafe*=-1;e.speed=Math.hypot(dx,dz)/dt}
 e.cooldown-=dt;if(distance<(e.longbow?950:560)&&e.cooldown<=0){enemyFire(e);let lost=e.type==='mech'&&(e.components.leftArm.hp<=0||e.components.rightArm.hp<=0);e.cooldown=(e.longbow?rand(6.5,9.5):rand(e.skyguard?4.2:3.4,e.skyguard?6.2:5.8))*(lost?1.7:1)*(difficulty==='cadet'?1.35:1)}
 }
function updateProjectiles(dt){for(let i=projectiles.length-1;i>=0;i--){let p=projectiles[i];p.life-=dt;p.prev=p.p.slice();if(p.type==='missile'){p.age+=dt;if(p.target?.alive){let aim=center(p.target),direction=norm(vsub(aim,p.p)),speed=mix(55,170,clamp(p.age/1.2,0,1));p.v=vadd(vmul(p.v,Math.max(0,1-dt*4)),vmul(direction,speed*dt*4))}p.trail-=dt;if(p.trail<=0){p.trail=.05;particles.push({p:p.p.slice(),v:[.2,1,.1],color:MISSILE_SMOKE,size:.7,life:.7,max:.7,smoke:true})}}
 else if(p.type==='artillery'){p.v[1]-=ART_G*dt;p.trail-=dt;if(p.trail<=0){p.trail=.07;particles.push({p:p.p.slice(),v:[.2,.8,.1],color:ART_SMOKE,size:.8,life:.8,max:.8,smoke:true})}}
 let movement=vmul(p.v,dt),len=Math.hypot(...movement),dir=vmul(movement,1/len);if(p.friendly){let hit=trace(p.p,dir,len+.5,false);if(hit.entity){applyDamage(hit.entity,p.damage,hit.component);if(p.type==='cannon'||p.shotCount)shotsHit++;if(!p.owner||p.owner===coop?.id)hitMarker=.18;p.hit=true;burst(hit.point,p.color,p.type==='missile'?14:9,p.type==='missile'?10:6);sound.fxPlay('hit',clamp(1-dist2(player,hit.entity)/950,.03,.35))}else if(hit.distance<len-.5){p.hit=true;burst(hit.point,p.color,8,5)}}else if(coop?.host&&coop.active){coop.projectileHit(p,dir,len)}else{let b=fireOrigin(),t=raySphere(p.p,dir,b,6,len+1);if(t!==Infinity){p.hit=p.direct=true;damagePlayer(p.damage,p)}else if(coverDistance(p.p,dir,len)<len-.5){p.hit=true;burst(p.p,p.color,7,4)}}p.p=vadd(p.p,movement);if(p.life<=0||p.hit||p.p[1]<terrainY(p.p[0],p.p[2])){if(p.type==='artillery'&&!p.direct)artilleryBlast(p);projectiles.splice(i,1)}}}
function updateEffects(dt){for(let i=beams.length-1;i>=0;i--)if((beams[i].life-=dt)<=0)beams.splice(i,1);for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.p=vadd(p.p,vmul(p.v,dt));if(p.smoke){p.size+=dt*1.5;p.v[0]+=.1*dt}else{p.v[1]-=17*dt;if(p.p[1]<terrainY(p.p[0],p.p[2]))p.life=0}}if(particles.length>particleCap)particles.splice(0,particles.length-particleCap);shakePower=Math.max(0,shakePower-dt*1.8);damageFlash=Math.max(0,damageFlash-dt*.6);hitMarker=Math.max(0,hitMarker-dt)}
function updatePlayer(dt){if(!player.alive)return;const c=ctl;if(c.thr>0)player.throttle=clamp(player.throttle+dt*.65*Math.min(1,c.thr),-.45,1);else if(c.thr<0)player.throttle=clamp(player.throttle+dt*.75*Math.max(-1,c.thr),-.45,1);let turn=clamp(c.turn,-1,1);if(player.shutdown<=0)player.yaw+=turn*dt*chassisData().turn*(1-Math.abs(player.speed)/chassisData().speed*.21);player.yaw=wrap(player.yaw);let aimX=clamp(c.ax,-1,1),aimY=clamp(c.ay,-1,1);player.torso=clamp(player.torso+aimX*dt*.9,-1.68,1.68);player.pitch=clamp(player.pitch+aimY*dt*.65,-.62,.6);if(player.align){let d=clamp(player.torso,-dt*1.0,dt*1.0);player.yaw+=d;player.torso-=d;if(Math.abs(player.torso)<.005)player.align=false}if(player.centerTorso){player.torso*=Math.exp(-dt*5);if(Math.abs(player.torso)<.005)player.centerTorso=false}
 let legFactor=(player.components.leftLeg.hp<=0||player.components.rightLeg.hp<=0)?.4:1;let want=player.shutdown>0?0:player.throttle*chassisData().speed*legFactor;player.speed+=clamp(want-player.speed,-dt*chassisData().brake,dt*chassisData().accel);let support=0;for(let o of solidObstacles)if(Math.hypot(player.x-o.x,player.z-o.z)<o.r&&player.altitude>=o.h-.5)support=Math.max(support,o.h);for(let e of entities){if(!e.alive||e.type==='mech')continue;let roof=e.collisionHeight??(e.type==='uplink'?15:e.type==='tower'?9:e.type==='reactor'?45:e.type==='generator'?9:5),r=e.collisionRadius??(e.type==='uplink'?23:e.type==='tower'?12:e.type==='reactor'?30:e.type==='generator'?13:5);if(dist2(player,e)<r&&player.altitude>=roof-.5)support=Math.max(support,roof)}player.grounded=player.altitude<=support+.05&&player.vy<=0;let jet=ctl.jets&&player.fuel>1&&player.shutdown<=0&&player.altitude<chassisData().maxAlt;if(jet){player.vy=Math.min(chassisData().jumpSpeed,player.vy+dt*chassisData().jumpAccel);player.fuel=Math.max(0,player.fuel-dt*chassisData().fuelUse);player.heat+=dt*chassisData().jetHeat;player.jetSound-=dt;if(player.jetSound<=0){sound.fxPlay('jet');player.jetSound=.16}}else{player.vy-=dt*18;if(player.grounded)player.fuel=Math.min(100,player.fuel+dt*chassisData().fuelRegen)}player.altitude+=player.vy*dt;if(player.altitude<support){if(player.vy<-9){sound.fxPlay('step',Math.min(1.7,-player.vy/13));if(isLocal())shakePower=.7;localRumble(Math.min(1,-player.vy/22),180)}player.altitude=support;player.vy=0;player.grounded=true}
 let moved=moveActor(player,Math.sin(player.yaw)*player.speed*dt,-Math.cos(player.yaw)*player.speed*dt,player.altitude,chassisData().radius);if(!moved)player.speed*=.92;player.phase+=Math.abs(player.speed)*dt*.24;let step=Math.floor(player.phase/Math.PI);if(step!==player.legStep&&player.grounded&&Math.abs(player.speed)>2){player.legStep=step;sound.fxPlay('step',Math.min(1,Math.abs(player.speed)/18)*chassisData().step);if(isLocal())shakePower=Math.max(shakePower,.08)}
 for(let w of weapons)w.remaining=Math.max(0,w.remaining-dt);player.heat=Math.max(0,player.heat-dt*config[loadout].cool*chassisData().cooling*(player.shutdown>0?1.6:1));if(player.shutdown>0){player.shutdown=Math.max(0,player.shutdown-dt);if(player.shutdown===0){player.heat=Math.min(player.heat,42);announce('REACTOR RESTORED','online',4)}}if(player.heat>82&&!player.heatWarning){player.heatWarning=true;announce('WARNING / Heat critical. Press [{coolant}] to release coolant.','heat',5)}if(player.heat<60)player.heatWarning=false;if(player.heat>=100)shutdown();
 if(ctl.fire)fireWeapon(weaponIndex);if(ctl.all)for(let i=0;i<3;i++)fireWeapon(i);
 if(target?.alive){let d=vsub(center(target),fireOrigin()),distance=Math.hypot(...d),angle=dot(norm(d),forward());if(distance<weapons[2].range&&angle>.974&&clearLOS(fireOrigin(),center(target))){lock=clamp(lock+dt/chassisData().lockTime,0,1);if(lock>=1&&!lockSpoken){lockSpoken=true;sound.say('lock')}}else{lock=Math.max(0,lock-dt*1.3);if(lock<.2)lockSpoken=false}}else lock=0;
}
function toggleImaging(){player.imaging=!player.imaging;imagingSwitch=.45;$('enhancedView').checked=player.imaging;sound.fxPlay('beep');sound.say(player.imaging?'enhanced':'optical',true);toast(player.imaging?'ENHANCED IMAGING / ON · ['+key('imaging')+'] Normal view':'ENHANCED IMAGING / OFF',2.5)}
function toggleVision(){player.vision=!player.vision;$('nightVision').checked=player.vision;sound.fxPlay('beep')}
function repairMachine(which='basin'){
 const cap=capacities(),ridge=which==='ridge',repair=ridge?.45:.38;
 for(let c of Object.values(player.components))c.hp=Math.min(c.max,Math.max(0,c.hp)+c.max*repair);
 player.ammo=cap.ammo;player.missiles=cap.missiles;player.coolants=cap.coolants;player.heat=0;player.fuel=100;player.shutdown=0;player.armorWarning=false;player.heatWarning=false;
 if(ridge){supplyUsed=true;supplyTime=6}else{serviceUsed=true;serviceTime=6}
 score+=300;announce((ridge?'RIDGE BAY':'FIELD BAY')+' / Armor repaired. Weapons rearmed. Coolant restored.','repair',8);
}
function beginRidgeTransit(){
 missionStage='ridgeTransit';navIndex=6;
 sectorBanner={title:'ASHFALL REACTOR DOWN',sub:'SECTOR 03 / CROSS CINDER CUT AT NAV GOLF',time:7};
 announce('CONTROL / North gate is open. Repair at the ridge bay, then cross Cinder Cut.','ridgeRoute',10);
}
function launchLinkWave(wave){
 linkWave=wave;
 let units=wave===1?[makeMech(-170,-3500,'RESPONSE HOUND 17','scout'),makeMech(330,-3375,'RESPONSE GUARD 18','medium')]:[makeMech(-45,-3780,'RIDGE COMMANDER','heavy')];
 for(let e of units){e.zone='ridge';e.assaultLink=true;e.alert=true;e.contact=true;e.cooldown=3.5;if(wave===2)makeCommander(e)}
 announce(wave===1?'SENSOR / Counterattack inbound. Keep the flight-link ring clear.':'SENSOR / Ridge commander inbound. Defeat the command mech.',wave===1?'linkAttack':'commander',9);
}
function landingThreats(){return entities.filter(e=>e.alive&&(e.type==='mech'||e.type==='turret')&&dist2(e,extraction)<155)}
function updateRepairBays(dt){
 // Both repair bays have their own one-use supply stock. In the Proving Grounds the field bay restocks every third wave.
 const arenaRun=mode==='arena';
 for(let bay of[{site:serviceBay,key:'basin',active:arenaRun||missionFlags[2],used:serviceUsed},{site:supplyBay,key:'ridge',active:!arenaRun&&missionFlags[3]&&missionFlags[4],used:supplyUsed}]){
  if(bay.used)continue;
  const isRidge=bay.key==='ridge',hintKey=isRidge?'ridgeBayHint':'bayHint';let elapsed=isRidge?supplyTime:serviceTime;
  if(bay.active&&dist2(player,bay.site)<bay.site.r&&player.altitude<3){
   if(!timers[hintKey]){timers[hintKey]=true;announce((isRidge?'RIDGE BAY':'FIELD BAY')+' / Stop inside the blue ring. Hold for 6 seconds.',null,7)}
   elapsed=Math.abs(player.speed)<1.5&&player.shutdown<=0?elapsed+dt:Math.max(0,elapsed-dt*2);
  }else elapsed=Math.max(0,elapsed-dt*2);
  if(isRidge)supplyTime=elapsed;else serviceTime=elapsed;
  if(elapsed>=6)repairMachine(bay.key);
 }
}
function tickBanners(dt){if(sectorBanner)sectorBanner.time-=dt;imagingSwitch=Math.max(0,imagingSwitch-dt)}
function updateMission(dt){
 missionTime+=dt;if(coop?.host&&coop.active)coop.updatePilots(dt);else updatePlayer(dt);if(state!=='playing')return;updateEnemies(dt);if(state!=='playing')return;updateProjectiles(dt);if(state!=='playing')return;
 if(mode==='arena'){updateArena(dt);tickBanners(dt);return}
 if(missionTime>3&&!timers.firstHint){timers.firstHint=true;announce('CONTROL / [{full}] Full throttle. [{target}] Select target. [{imaging}] Enhanced Imaging.',null,10)}
 if(!missionFlags[2]&&missionFlags[0]&&missionFlags[1]&&basinThreats().length===0){
  missionFlags[2]=true;missionStage='transit';navIndex=2;score+=800;sectorBanner={title:'KESTREL BASIN SECURED',sub:'CROSS NEEDLE PASS / NAV CHARLIE',time:6};
  announce('CONTROL / Basin secure. Repair at the field bay. Cross Needle Pass.','basinSecure',10);
  for(let e of[makeMech(-5,-1260,'PASS HOUND 07','scout'),makeMech(215,-1510,'PASS HOUND 08','scout')])e.zone='pass';
 }
 if(missionFlags[2]&&!missionFlags[3]&&squadAny(p=>dist2(p,canyonNav)<canyonNav.r)){
  missionFlags[3]=true;score+=500;
  if(!reactor.alive)beginRidgeTransit();else{missionStage='works';navIndex=westFeed.alive?3:eastFeed.alive?4:5;sectorBanner={title:'ASHFALL WORKS',sub:'SECTOR 02 / CUT BOTH POWER FEEDS',time:6};announce('CONTROL / Ashfall Works ahead. Cut both power feeds to expose the reactor.','works',10)}
  saveCheckpoint(missionStage==='works'?'SECTOR 02 / ASHFALL WORKS':'SECTOR 03 / CINDER CUT');
 }
 if(coop?.active)coop.repairAll(dt);else updateRepairBays(dt);
 if(missionFlags[3]&&missionFlags[4]&&!missionFlags[5]&&squadAny(p=>dist2(p,ridgeNav)<ridgeNav.r||p.z<-3070)){
  missionFlags[5]=true;missionStage=skyguard.alive?'ridge':'link';navIndex=skyguard.alive?7:8;score+=600;
  sectorBanner={title:'BLACKGLASS RIDGE',sub:'SECTOR 03 / '+(skyguard.alive?'DESTROY THE SKYGUARD BATTERY':'SECURE THE FLIGHT-CONTROL LINK'),time:7};
  announce(skyguard.alive?'CONTROL / Blackglass Ridge. Destroy the Skyguard battery at NAV HOTEL.':'CONTROL / Skyguard is down. Secure the flight-control codes at NAV INDIA.','ridgeEntry',10);
  saveCheckpoint('SECTOR 03 / BLACKGLASS RIDGE');
 }
 if(missionFlags[5]&&missionFlags[6]&&!missionFlags[7]){
  const linkPilot=coop?.active?(coop.living().map(r=>coop.playerOf(r)).find(p=>dist2(p,flightLink)<flightLink.r&&p.altitude<3&&Math.abs(p.speed)<2.2&&p.shutdown<=0)||coop.living().map(r=>coop.playerOf(r)).find(p=>dist2(p,flightLink)<flightLink.r)||player):player;
  const inRange=dist2(linkPilot,flightLink)<flightLink.r,onGround=linkPilot.altitude<3,stopped=Math.abs(linkPilot.speed)<2.2;
  linkBlocked=linkThreats().length>0;
  linkStatus=!inRange?'MOVE TO NAV INDIA':!onGround?'LAND INSIDE THE RING':linkPilot.shutdown>0?'REACTOR OFFLINE':!stopped?'STOP INSIDE THE RING / [{stop}]':linkBlocked?'LINK JAMMED / CLEAR THE RING':linkTime>=flightLink.duration?'TRANSFER READY / DEFEAT RESPONSE':'RECEIVING FLIGHT CODES';
  if(inRange&&onGround&&stopped&&linkPilot.shutdown<=0){
   if(linkWave===0)launchLinkWave(1);
   if(!linkBlocked&&linkTime<flightLink.duration)linkTime=Math.min(flightLink.duration,linkTime+dt);
  }
  if(linkTime>=20&&linkWave===1)launchLinkWave(2);
  if(linkBlocked&&!timers.linkJammed){timers.linkJammed=true;announce('FLIGHT LINK / Enemy inside the perimeter. Transfer paused. Progress saved.','linkJammed',8)}
  if(!linkBlocked)timers.linkJammed=false;
  if(linkTime>=flightLink.duration&&linkWave===2&&ridgeResponseThreats().length===0){
   missionFlags[7]=true;missionStage='extract';navIndex=9;score+=2600;transportTime=0;linkStatus='FLIGHT CODES SECURED';
   sectorBanner={title:'FLIGHT PATH SECURED',sub:'NAV JULIET / REACH THE TRANSPORT',time:7};
   announce('TRANSPORT / Flight codes received. Move to NAV JULIET for extraction.','flightClear',10);
  }
 }
 if(allObjectivesComplete()){
  transportTime+=dt;
  if(transportTime>=14&&squadAll(p=>dist2(p,extraction)<extraction.r&&p.altitude<3&&Math.abs(p.speed)<2.2)&&landingThreats().length===0){if(!extractAnnounced){extractAnnounced=true;announce('TRANSPORT / Hold position. Extraction in progress.','extract',6)}extractTime+=dt;if(extractTime>=5)endMission(true)}else extractTime=Math.max(0,extractTime-dt*2);
 }
 if(!timers.idleHint&&missionTime>25&&dist2(player,START)<60){timers.idleHint=true;toast(promptText('Set speed with [{throttle}] or [{full}]. Turn with [{turn}]. [{stop}] stops the machine.'),7)}
 if(!timers.imagingHint&&player.z<-1120){timers.imagingHint=true;announce('SENSOR / Press [{imaging}] for Enhanced Imaging. Wireframe view is available.',null,7)}
 if(player.z<-1650&&!missionFlags[3]&&!timers.routeWarning){timers.routeWarning=true;announce('CONTROL / Complete the basin objectives and cross NAV CHARLIE first.',null,8)}
 if(dist2(player,ridgeGate)<130&&ridgeGateLocked()&&missionTime>(timers.gateHint||0)){timers.gateHint=missionTime+18;announce('NORTH GATE / Complete the basin route and destroy the Ashfall reactor to open the gate.',null,8)}
 if(player.z<-3000&&!missionFlags[5]&&missionTime>(timers.ridgeOrder||0)){timers.ridgeOrder=missionTime+22;announce('CONTROL / Complete the basin route and reactor objective first.',null,8)}
 if(player.z<-1560&&player.z>-2700&&missionTime>(timers.exhaust||0)){timers.exhaust=missionTime+.7;for(let p of[[-205,-2090],[-285,-2000],[330,-2230]])particles.push({p:[p[0],terrainY(...p)+70,p[1]],v:[1.2,4.2,.4],color:STACK_SMOKE,size:3,life:7,max:7,smoke:true})}
 tickBanners(dt);
}
const START={x:0,z:92},MISSILE_SMOKE=hex('#b8afa0'),ART_SMOKE=hex('#9d8f7e'),STACK_SMOKE=hex('#777d74'),ART_COLOR=hex('#ff8a4c'),ART_G=30,ART_RADIUS=15;
function musicCue(){return mode==='arena'?(arena.wave>5?'works':'basin'):missionFlags[2]?'works':'basin'}
// Re-read the current objective when a mission resumes from a checkpoint (same words and radio clip as before).
function stageBriefing(){
 if(missionStage==='works')announce('CONTROL / Ashfall Works ahead. Cut both power feeds to expose the reactor.','works',10);
 else if(missionStage==='ridgeTransit')announce('CONTROL / North gate is open. Repair at the ridge bay, then cross Cinder Cut.','ridgeRoute',10);
 else if(missionStage==='ridge')announce('CONTROL / Blackglass Ridge. Destroy the Skyguard battery at NAV HOTEL.','ridgeEntry',10);
 else if(missionStage==='link')announce('CONTROL / Skyguard is down. Secure the flight-control codes at NAV INDIA.','ridgeEntry',10);
 else announce('CONTROL / Cut the relay and uplink. Clear the basin, then cross Needle Pass.','insertion',9);
}

/* ---- Checkpoints (solo Iron Echo): saved on entering Sector 02 and Sector 03, offered as CONTINUE. ---- */
const CHECKPOINT_KEY='robotwarrior.checkpoint.v1';
function readCheckpoint(){try{const cp=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null');return cp&&cp.v===1&&chassisSpecs[cp.chassis]&&config[cp.loadout]&&Array.isArray(cp.entities)&&Array.isArray(cp.flags)&&cp.player?cp:null}catch(e){return null}}
function clearCheckpoint(){try{localStorage.removeItem(CHECKPOINT_KEY)}catch(e){}}
function saveCheckpoint(label){
 if(mode!=='mission'||coop?.active||state!=='playing')return;
 const p=player,cp={v:1,label,stage:missionStage,chassis,loadout,difficulty,missionTime,kills,score,shotsFired,shotsHit,flags:missionFlags.slice(),navIndex,reinforcements,serviceUsed,supplyUsed,timers:{...timers},
  player:{x:p.x,z:p.z,yaw:p.yaw,heat:Math.min(p.heat,40),fuel:p.fuel,ammo:p.ammo,missiles:p.missiles,coolants:p.coolants,components:p.components},
  entities:entities.map(e=>({name:e.name,type:e.type,class:e.class,zone:e.zone,x:e.x,z:e.z,yaw:e.yaw,alive:e.alive,hp:e.hp,components:e.components,alert:e.alert,contact:e.contact,commander:e.commander,assaultLink:e.assaultLink}))};
 try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify(cp));toast('CHECKPOINT SAVED / '+label,3)}catch(e){}
}
function applyCheckpoint(cp){
 const num=(v,d=0)=>Number.isFinite(v)?v:d;
 missionTime=num(cp.missionTime);kills=num(cp.kills);score=num(cp.score);shotsFired=num(cp.shotsFired);shotsHit=num(cp.shotsHit);missionFlags=Array.from({length:8},(_,i)=>!!cp.flags[i]);missionStage=typeof cp.stage==='string'?cp.stage:'works';navIndex=clamp(num(cp.navIndex),0,11);reinforcements=!!cp.reinforcements;serviceUsed=!!cp.serviceUsed;supplyUsed=!!cp.supplyUsed;
 if(cp.timers&&typeof cp.timers==='object')Object.assign(timers,cp.timers);
 const q=cp.player;Object.assign(player,{x:num(q.x,player.x),z:num(q.z,player.z),yaw:num(q.yaw),heat:num(q.heat),fuel:num(q.fuel,100),ammo:num(q.ammo,player.ammo),missiles:num(q.missiles,player.missiles),coolants:num(q.coolants,player.coolants)});player.y=terrainY(player.x,player.z);
 for(const k of componentNames){const c=q.components?.[k];if(c&&Number.isFinite(c.hp))player.components[k].hp=Math.min(player.components[k].max,c.hp)}
 player.armorWarning=playerArmor()<.35;
 for(const s of cp.entities){if(!s||typeof s.name!=='string')continue;let e=entities.find(x=>x.name===s.name&&x.type===s.type);if(!e&&s.type==='mech'&&['scout','medium','heavy'].includes(s.class))e=makeMech(num(s.x),num(s.z),s.name,s.class);if(!e)continue;
  Object.assign(e,{x:num(s.x,e.x),z:num(s.z,e.z),yaw:num(s.yaw,e.yaw),alive:!!s.alive,zone:s.zone??e.zone,alert:!!s.alert,contact:!!s.contact,assaultLink:!!s.assaultLink});e.y=terrainY(e.x,e.z);
  if(s.commander&&!e.commander)makeCommander(e);
  if(e.components&&s.components){for(const k of componentNames){const c=s.components[k];if(c&&Number.isFinite(c.hp)&&Number.isFinite(c.max)){e.components[k].hp=c.hp;e.components[k].max=c.max}}}
  else if(!e.components&&Number.isFinite(s.hp))e.hp=s.hp;
  if(!e.alive)e.deathTime=60;
 }
 resumeCheckpoint=cp;
 sectorBanner={title:'CHECKPOINT',sub:cp.label,time:6};
}
function continueMission(){const cp=readCheckpoint();if(!cp||coop&&coop.mode!=='offline')return;mode='mission';chassis=cp.chassis;loadout=cp.loadout;difficulty=['cadet','regular','veteran'].includes(cp.difficulty)?cp.difficulty:'regular';try{localStorage.setItem('robotwarrior.chassis',chassis)}catch(e){}updateChassisUI();syncChoiceUI();soloStartMission(cp)}

/* ---- Proving Grounds: ten waves in Kestrel Basin, with Longbow missile carriers. ---- */
const ARENA={waves:10,minZ:-1250,
 spawns:[[-80,-1050],[150,-1100],[320,-980],[-300,-950],[430,-600],[440,-250],[-430,-520],[-420,-180],[200,380],[-200,360]],
 turrets:[[-72,-396],[186,-701],[-160,-760],[260,-420],[40,-980],[-240,-60]]};
const ARENA_WAVES=[
 {name:'SCOUT SCREEN',brief:'Two light hounds. Learn the range.',units:[['scout',2]]},
 {name:'LIGHT LANCE',brief:'Hounds with a medium escort.',units:[['scout',2],['medium',1]]},
 {name:'SENTRY LINE',brief:'Sentries dug in across the basin, and two guards.',units:[['turret',2],['medium',2]]},
 {name:'LONGBOW SUPPORT',brief:'A Longbow missile carrier shells you from range. Keep moving.',units:[['longbow',1],['medium',1],['scout',2]]},
 {name:'HEAVY PUSH',brief:'An iron guard leads two mediums.',units:[['heavy',1],['medium',2]]},
 {name:'CROSSFIRE',brief:'Two Longbows and a hound pack.',units:[['longbow',2],['scout',3]]},
 {name:'IRON WALL',brief:'Two heavies under Longbow cover, behind new sentries.',units:[['heavy',2],['longbow',1],['turret',2]]},
 {name:'HUNTER PACK',brief:'Six fast machines from every side.',units:[['scout',4],['medium',2]]},
 {name:'ARTILLERY STORM',brief:'Three Longbows. Close the distance.',units:[['longbow',3],['heavy',1],['medium',1]]},
 {name:'PROVING COMMANDER',brief:'The range commander and its full escort.',units:[['commander',1],['heavy',1],['longbow',2],['scout',2]]}
];
function arenaReset(){arena={wave:0,phase:'intro',timer:9,serial:21,turret:0};navIndex=0}
function freeSpot(x,z,r=7){if(!collides(x,z,0,r))return[x,z];for(let d=15;d<=150;d+=15)for(let i=0;i<12;i++){const a=i/12*TAU,xx=x+Math.sin(a)*d,zz=z+Math.cos(a)*d;if(!collides(xx,zz,0,r))return[xx,zz]}return[x,z]}
function arenaThreats(){return entities.filter(e=>e.alive&&e.zone==='arena'&&(e.type==='mech'||e.type==='turret'))}
// HUD objective lines for the Proving Grounds, in the same [label, done] form as the mission list.
function arenaObjectives(){
 const bay=['FIELD BAY / '+(serviceUsed?'USED · RESTOCKS W3 W6 W9':'READY'),serviceUsed];
 if(arena.phase==='fight'){const def=ARENA_WAVES[clamp(arena.wave-1,0,ARENA_WAVES.length-1)];return[['WAVE '+arena.wave+' OF '+ARENA.waves+' / '+def.name,false],['HOSTILES REMAINING '+arenaThreats().length,false],bay]}
 if(arena.phase==='done')return[['ALL '+ARENA.waves+' WAVES CLEARED',true]];
 return[[arena.wave?'WAVE '+arena.wave+' CLEARED':'RANGE OPEN / STAND BY',true],['NEXT WAVE IN '+Math.max(0,Math.ceil(arena.timer))+'s',false],bay];
}
// A Longbow round is falling close to this pilot: warn in the HUD.
function incomingArtillery(){for(const p of projectiles)if(p.type==='artillery'&&p.v[1]<0&&Math.hypot(p.p[0]-player.x,p.p[2]-player.z)<ART_RADIUS*3.5)return true;return false}
function squadPilots(){return coop?.active?coop.living().map(r=>coop.playerOf(r)):[player]}
// Run fn once for every pilot (in co-op the host swaps each pilot's machine in).
function forEachPilot(fn){if(coop?.active&&coop.host){for(const r of coop.members.values())coop.withPilot(r,fn)}else fn()}
function arenaWave(n){
 const def=ARENA_WAVES[n-1],pilots=squadPilots();arena.wave=n;arena.phase='fight';
 const spawns=ARENA.spawns.map(([x,z])=>({x,z,d:pilots.length?Math.min(...pilots.map(p=>Math.hypot(p.x-x,p.z-z))):1e9})).sort((a,b)=>b.d-a.d).slice(0,4);
 let k=0;
 for(const [kind,count] of def.units)for(let i=0;i<count;i++){
  const s=spawns[k++%spawns.length],x=s.x+rand(-35,35),z=s.z+rand(-35,35);let e;
  if(kind==='turret'){const t=ARENA.turrets[arena.turret++%ARENA.turrets.length];e=createTurret(t[0],t[1],'SENTRY '+arena.serial++)}
  else if(kind==='longbow'){const [fx,fz]=freeSpot(x,z,9);e=createLongbow(fx,fz,'LONGBOW '+arena.serial++)}
  else if(kind==='commander')e=makeCommander(makeMech(x,z,'PROVING COMMANDER','heavy'));
  else e=makeMech(x,z,(kind==='scout'?'HOUND ':kind==='heavy'?'IRON GUARD ':'GUARD ')+arena.serial++,kind);
  e.zone='arena';e.alert=true;e.contact=true;e.cooldown=rand(2.5,4.5);e.yaw=Math.atan2(START.x-e.x,-(START.z-e.z));
 }
 sectorBanner={title:'WAVE '+n+' OF '+ARENA.waves,sub:def.name,time:5};
 announce('RANGE CONTROL / Wave '+n+', '+def.name+'. '+def.brief,null,8);
 sound.fxPlay('warning');
}
function arenaCleared(){
 const n=arena.wave;score+=400*n;
 if(n>=ARENA.waves){arena.phase='done';endMission(true);return}
 const restock=n%3===0;arena.phase='break';arena.timer=restock?22:14;
 // Between waves every pilot gets a quarter of their ammunition and a coolant charge back.
 forEachPilot(()=>{const cap=capacities();player.ammo=Math.min(cap.ammo,player.ammo+Math.ceil(cap.ammo*.25));player.missiles=Math.min(cap.missiles,player.missiles+Math.ceil(cap.missiles*.25));player.coolants=Math.min(cap.coolants,player.coolants+1);if(restock){serviceUsed=false;serviceTime=0}});
 sectorBanner={title:'WAVE '+n+' CLEARED',sub:(restock?'FIELD BAY RESTOCKED':'AMMUNITION TOPPED UP')+' / NEXT WAVE IN '+Math.round(arena.timer)+'s',time:5};
 announce('RANGE CONTROL / Wave '+n+' cleared. '+(restock?'The field bay at SERVICE 01 is restocked.':'Ammunition topped up.'),null,7);
}
function updateArena(dt){
 if(!timers.firstHint&&missionTime>2){timers.firstHint=true;announce('RANGE CONTROL / Ten waves. [{full}] Full throttle. [{target}] Select target. The field bay restocks after waves 3, 6 and 9.',null,10)}
 if(arena.phase==='intro'||arena.phase==='break'){arena.timer-=dt;if(arena.timer<=0)arenaWave(arena.wave+1)}
 else if(arena.phase==='fight'&&arenaThreats().length===0)arenaCleared();
 if(state!=='playing')return;
 if(coop?.active)coop.repairAll(dt);else updateRepairBays(dt);
 if(squadAny(p=>p.z<ARENA.minZ+45)&&missionTime>(timers.boundary||0)){timers.boundary=missionTime+9;announce('RANGE CONTROL / You are at the edge of the proving grounds. Turn back.',null,5)}
 if(!timers.artilleryHint&&arena.wave>=4&&arena.phase==='fight'){timers.artilleryHint=true;announce('RANGE CONTROL / Longbow rounds burst where you stood. Keep moving, or jump clear as they land.',null,8)}
}
// A Longbow volley: four rounds on a ballistic arc toward where the target will be.
function longbowFire(e){
 const tgt=player,d=dist2(tgt,e),base=[e.x,e.y+7.5,e.z],T=clamp(d/150,2.2,4.6),spread=difficulty==='cadet'?20:difficulty==='veteran'?10:14,lead=T*.6;
 for(let i=0;i<4;i++){
  const ax=tgt.x+Math.sin(tgt.yaw)*tgt.speed*lead+rand(-spread,spread),az=tgt.z-Math.cos(tgt.yaw)*tgt.speed*lead+rand(-spread,spread),aim=[ax,terrainY(ax,az),az];
  const t=T*rand(.92,1.08),start=vadd(base,[rand(-1.5,1.5),rand(0,1.2),rand(-1.5,1.5)]);
  const v=[(aim[0]-start[0])/t,(aim[1]-start[1]+.5*ART_G*t*t)/t,(aim[2]-start[2])/t];
  projectiles.push({p:start,v,type:'artillery',friendly:false,life:t+2.5,damage:e.commander?20:15,color:ART_COLOR,prev:start.slice(),hit:false,target:aim,trail:i*.02});
 }
 spawnBeam(base,vadd(base,[0,14,0]),hex('#ffb16a'),.45,.22);
 sound.fxPlay('missile',clamp(1-d/950,.05,.3));sound.fxPlay('warning',.6);
}
function artilleryBlast(p){
 const at=p.p;burst(at,ART_COLOR,10,9);
 const me=localPilot(),near=Math.hypot(me.x-at[0],me.z-at[2]);if(isLocal())sound.fxPlay('explosion',clamp(1-near/700,.04,.45));if(near<60){if(isLocal())shakePower=Math.max(shakePower,.35);input.rumble(.3,120)}
 const hit=()=>{const d=Math.hypot(player.x-at[0],player.z-at[2]),h=Math.abs(player.y+player.altitude-at[1]);if(player.alive&&d<ART_RADIUS&&h<12)damagePlayer(p.damage*(1-d/ART_RADIUS*.6),p)};
 if(coop?.active){if(coop.host)for(const r of coop.living())coop.withPilot(r,hit)}else hit();
}
const CAM={x:0,z:0},_r3=[0,0,0],SHADOW=[.12,.14,.12],HERO_SHADOW=[.11,.14,.12],PROJ_CORE=[1,.9,.6],GROUND_WIRE=[.13,.53,.33],SCENERY_WIRE=[.20,.74,.49],TRANSPORT_WIRE=[.29,.84,.72],BAY_WIRE=[.28,.84,.96],SHIELD_WIRE=[.28,.77,.94],GATE_LOCKED=[1,.48,.18],GATE_OPEN=[.28,.84,.76];
const C={bay:hex('#6fd5e3'),shield:hex('#70c6e8'),shieldRing:hex('#5aacbb'),gateLocked:hex('#f7a04f'),gateOpen:hex('#8be3c1'),gateGlow:hex('#e7a758'),gateBars:hex('#ffba63'),linkDone:hex('#ace493'),linkOn:hex('#72dee4'),linkOff:hex('#bf9465'),dish:hex('#a9bfb3'),thruster:hex('#9fbac2'),padRing:hex('#99dda2'),padRing2:hex('#b9deb0'),padLights:hex('#adffad'),padBeam:hex('#b8eead'),jet:hex('#acddeb')};
const hero={x:0,z:92,y:terrainY(0,92),scale:1,yaw:Math.PI+.19,phase:0,speed:0,alive:true};
function drawMissionStructures(){
 for(let b of[{p:serviceBay,on:(mode==='arena'||missionFlags[2])&&!serviceUsed},{p:supplyBay,on:mode==='mission'&&missionFlags[3]&&missionFlags[4]&&!supplyUsed}]){
  if(!b.on)continue;const y=terrainY(b.p.x,b.p.z);R.wire=BAY_WIRE;
  blend('add');draw(geo.ring,M.transform([b.p.x,y+.25,b.p.z],[b.p.r,1,b.p.r],ZERO3,_w0),C.bay,.8,1);blend('opaque');
  for(let side of[-1,1])draw(geo.box,M.transform([b.p.x+side*24,y+25.9,b.p.z+5.2],[5,.5,.15],ZERO3,_w0),C.bay,1,1);
 }
 if(mode!=='mission')return;
 drawRidgeStructures();
 if(reactor?.alive&&reactorShielded()){
  blend('add');R.wire=SHIELD_WIRE;
  if(!R.imaging)draw(geo.sphere,M.transform([reactor.x,reactor.y+26,reactor.z],[41,39,41],ZERO3,_w0),C.shield,.065,1);
  for(let i=0;i<3;i++){_r3[0]=Math.PI/2;_r3[1]=i*Math.PI/3+realTime*.12;_r3[2]=0;draw(geo.ring,M.transform([reactor.x,reactor.y+26,reactor.z],[42,42,42],_r3,_w0),C.shieldRing,R.imaging?.65:.14,1)}
  blend('opaque');
 }
}

function drawRidgeStructures(){
 const gy=terrainY(ridgeGate.x,ridgeGate.z),locked=ridgeGateLocked();R.wire=locked?GATE_LOCKED:GATE_OPEN;
 for(let side of[-1,1])draw(geo.box,M.transform([ridgeGate.x+side*78,gy+30,ridgeGate.z+9.1],[2,2,.2],ZERO3,_w0),locked?C.gateLocked:C.gateOpen,1,1);
 if(locked){
  blend('add');
  if(!R.imaging)draw(geo.box,M.transform([ridgeGate.x,gy+16,ridgeGate.z],[75,16,.5],ZERO3,_w0),C.gateGlow,.08,1);
  for(let i=0;i<7;i++)draw(geo.box,M.transform([ridgeGate.x,gy+2+i*4.5,ridgeGate.z+.1],[75,.06,.1],ZERO3,_w0),C.gateBars,.55,1);
  blend('opaque');
 }
 const on=missionFlags[5]&&missionFlags[6],col=missionFlags[7]?C.linkDone:on?C.linkOn:C.linkOff;R.wire=col;
 const by=terrainY(beaconSite.x,beaconSite.z);_r3[0]=0;_r3[1]=realTime*.22;_r3[2]=0;const base=M.transform([beaconSite.x,by+48,beaconSite.z],ONE3,_r3,_w1);
 draw(geo.dish,M.mul(base,M.transform(ZERO3,[13,10,10],[-.55,0,0],_w0),_w2),C.dish);
 draw(geo.sphere,M.transform([beaconSite.x,by+57,beaconSite.z],[.9,.9,.9],ZERO3,_w0),col,1,1);
 const fy=terrainY(flightLink.x,flightLink.z);
 blend('add');
 draw(geo.ring,M.transform([flightLink.x,fy+.25,flightLink.z],[flightLink.r,1,flightLink.r],ZERO3,_w0),col,on?.9:.28,1);
 if(on){draw(geo.ring,M.transform([flightLink.x,fy+.28,flightLink.z],[flightLink.r-4,1,flightLink.r-4],ZERO3,_w0),col,.3,1);
  if(!R.imaging)draw(geo.cyl,M.transform([beaconSite.x,by+71,beaconSite.z],[.35,14,.35],ZERO3,_w0),col,.28,1);
  const filled=Math.floor(linkTime/flightLink.duration*20);
  for(let i=0;i<20;i++){const a=i/20*TAU,x=flightLink.x+Math.sin(a)*57,z=flightLink.z+Math.cos(a)*57;_r3[0]=0;_r3[1]=a;_r3[2]=0;draw(geo.box,M.transform([x,fy+.3,z],[1.6,.07,.65],_r3,_w0),col,i<filled?.9:.13,1)}
 }
 blend('opaque');
}

function renderWorld(){
 beginFrame();
 const imaging=state!=='menu'&&player.imaging;R.imaging=imaging;
 if(state==='menu'){const x=30+Math.sin(realTime*.09)*3,z=143+Math.cos(realTime*.06)*2;cameraEye=[x,terrainY(0,92)+18.5,z];const look=[-17,terrainY(0,92)+13.1,91];cameraForward=norm(vsub(look,cameraEye));fov=49*DEG}else{let bob=settings.shake&&player.grounded?Math.sin(player.phase*2)*Math.min(1,Math.abs(player.speed)/17)*.16:0;let shake=settings.shake?shakePower:0;cameraEye=[player.x+Math.sin(realTime*67)*shake*.12,player.y+chassisData().eye+player.altitude+bob+Math.sin(realTime*49)*shake*.1,player.z];cameraForward=forward();fov=(zoom?31:65)*DEG;if(settings.shake&&shake>.01)cameraForward=norm(vadd(cameraForward,[Math.sin(realTime*91)*shake*.002,Math.sin(realTime*57)*shake*.003,0]))}
 if(coop?.active&&coop.guest&&state!=='menu')cameraEye=vadd(cameraEye,coop.cameraError);
 viewShift=state==='menu'?0:-.14;
 const view=M.view(cameraEye,vadd(cameraEye,cameraForward));viewProj=M.mul(M.perspective(fov,screenW/screenH,.3,6200,viewShift),view);
 setCamera(cameraEye,cameraForward,fov,screenW/screenH,viewShift,imaging);uNight.value=player?.vision?1:0;
 CAM.x=cameraEye[0];CAM.z=cameraEye[2];
 R.wire=GROUND_WIRE;draw(ground,IDENTITY);R.wire=SCENERY_WIRE;draw(scenery,IDENTITY);
 // Contact shadows keep the low-polygon machines grounded.
 blend('alpha');
 if(!imaging)for(let e of entities){if(dist2(CAM,e)>1700)continue;let r=e.type==='mech'?10*e.scale:e.type==='tower'?20:e.type==='uplink'?33:7;draw(geo.disk,M.transform([e.x,e.y+.10,e.z],[r,.014,r*.8],ZERO3,_w0),SHADOW,.22)}
 if(state==='menu'){hero.scale=chassisData().previewScale;draw(geo.disk,M.transform([hero.x,hero.y+.13,hero.z],[19,.02,12],ZERO3,_w0),HERO_SHADOW,.32)}
 blend('opaque');
 for(let e of entities){if(dist2(CAM,e)<1700)drawEntity(e)}if(state==='menu')drawMech(hero,true);drawAllies();drawMissionStructures();R.wire=TRANSPORT_WIRE;
 // The transport arrives only after all three sectors and the flight codes are secure.
 if(allObjectivesComplete()){let descent=clamp(transportTime/14,0,1),y=terrainY(extraction.x,extraction.z)+28+(1-descent)*125+Math.sin(realTime*.8)*.5;_r3[0]=0;_r3[1]=-.22;_r3[2]=0;const mat=M.transform([extraction.x,y,extraction.z],ONE3,_r3,_w1);for(let p of transportParts)drawPart(p,mat);blend('add');for(let side of[-1,1])for(let z of[-12,3])draw(geo.cone,M.mul(mat,M.transform([side*23,-10,z],[1.9,4+Math.sin(realTime*20)*.2,1.9],ZERO3,_w0),_w2),C.thruster,.15,1);blend('opaque');
  const y0=terrainY(extraction.x,extraction.z),rr=32+Math.sin(realTime*2)*3;blend('add');draw(geo.ring,M.transform([extraction.x,y0+.3,extraction.z],[42,1,42],ZERO3,_w0),C.padRing,.8,1);draw(geo.ring,M.transform([extraction.x,y0+.3,extraction.z],[rr,1,rr],ZERO3,_w0),C.padRing2,.35,1);for(let i=0;i<8;i++){let a=i/8*TAU,x=extraction.x+Math.sin(a)*45,z=extraction.z+Math.cos(a)*45;draw(geo.sphere,M.transform([x,terrainY(x,z)+1,z],[.6,.5,.6],ZERO3,_w0),C.padLights,1,1)}draw(geo.cyl,M.transform([extraction.x,y0+30,extraction.z],[1,30,1],ZERO3,_w0),C.padBeam,.12,1);blend('opaque')}
 R.imaging=false;blend('alpha');
 for(let p of particles){if(!p.smoke)continue;_s3[0]=_s3[1]=_s3[2]=p.size;draw(geo.sphere,M.transform(p.p,_s3,ZERO3,_w0),p.color,clamp(p.life/p.max*.42,0,.42),0)}
 blend('add');
 for(let p of particles){if(p.smoke)continue;_s3[0]=_s3[1]=_s3[2]=p.size*.35;_r3[0]=p.life*3;_r3[1]=p.life*2;_r3[2]=0;draw(geo.bevel,M.transform(p.p,_s3,_r3,_w0),p.color,clamp(p.life/.3,0,1),1)}
 for(let b of beams){draw(geo.cyl,lineMatrix(b.a,b.b,b.width*2.6,_w0),b.c,b.life/b.max*.28,1);draw(geo.cyl,lineMatrix(b.a,b.b,b.width,_w0),b.c,b.life/b.max,1)}
 for(let p of projectiles){const art=p.type==='artillery',tailLen=p.type==='missile'||art?3:8;let tail=vsub(p.p,vmul(norm(p.v),tailLen));draw(geo.cyl,lineMatrix(tail,p.p,tailLen===3?.33:.23,_w0),p.color,1,1);_s3[0]=_s3[1]=_s3[2]=art?.55:.38;draw(geo.sphere,M.transform(p.p,_s3,ZERO3,_w0),PROJ_CORE,1,1)}
 blend('opaque');
 renderFrame(kit.renderer);
}
const hudColor='#adcb8b',hudDim='#708763',hudAmber='#e6b372',hudRed='#ed8865';
let hudScale=1;
function txt(text,x,y,size=11,color=hudColor,align='left'){ctx.fillStyle=color;ctx.font=`${Math.round(size*hudScale)}px Consolas,"Liberation Mono",monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y)}
function ln(x1,y1,x2,y2,c=hudColor,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function poly(points,fill,stroke=null,width=1){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function rect(x,y,w,h,fill,stroke=null){if(fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1)}}
function circle(x,y,r,c,width=1,fill=null){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill()}ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke()}
function damageColor(r){return r>.62?hudColor:r>.28?hudAmber:hudRed}
function corners(x,y,w,h,c=hudColor,len=8){ctx.strokeStyle=c;ctx.lineWidth=1.2;for(let sx of[-1,1])for(let sy of[-1,1]){let xx=x+sx*w/2,yy=y+sy*h/2;ctx.beginPath();ctx.moveTo(xx-sx*len,yy);ctx.lineTo(xx,yy);ctx.lineTo(xx,yy-sy*len);ctx.stroke()}}
function panelBox(x,y,w,h,title){rect(x-4,y-4,w+8,h+8,'#202721','#555e4c');rect(x-2,y-2,w+4,h+4,'#101910','#121a13');rect(x,y,w,h,'#0d180f','#596748');rect(x+1,y+1,w-2,20*hudScale,'#273423');txt(title,x+9*hudScale,y+10*hudScale,9,'#a7b792');ln(x,y+20*hudScale,x+w,y+20*hudScale,'#596748');for(let i=0;i<4;i++){let xx=i%2?x+w+1:x-2,yy=i<2?y-2:y+h+2;circle(xx,yy,1.5,'#96957b',1,'#171d18')}}
function drawCockpit(){const w=screenW,h=screenH,s=hudScale;
 let metal=ctx.createLinearGradient(0,h*.71,0,h);metal.addColorStop(0,'#55594a');metal.addColorStop(.15,'#303a31');metal.addColorStop(.65,'#252f28');metal.addColorStop(1,'#151e1a');
 poly([[0,h*.745],[w*.085,h*.703],[w*.24,h*.738],[w*.37,h*.724],[w*.425,h*.741],[w*.575,h*.741],[w*.64,h*.724],[w*.78,h*.736],[w*.915,h*.704],[w,h*.746],[w,h],[0,h]],metal,'#77775b',2);
 poly([[0,0],[w*.055,0],[w*.033,h*.44],[w*.064,h*.718],[0,h*.76]],'#29352d','#72745a',2);
 poly([[w,0],[w*.945,0],[w*.967,h*.44],[w*.936,h*.718],[w,h*.76]],'#29352d','#72745a',2);
 poly([[0,0],[w,0],[w*.95,h*.04],[w*.75,h*.032],[w*.64,h*.023],[w*.36,h*.023],[w*.25,h*.032],[w*.05,h*.04]],'#293329','#686d53',1.5);
 ln(w*.052,0,w*.029,h*.43,'#0a130e',5);ln(w*.029,h*.43,w*.059,h*.704,'#0a130e',5);ln(w*.948,0,w*.971,h*.43,'#0a130e',5);ln(w*.971,h*.43,w*.941,h*.704,'#0a130e',5);
 for(let side of[0,1]){const x=side?w*.979:w*.021;for(let y of[h*.1,h*.33,h*.6]){circle(x,y,3*s,'#88866c',1,'#18211a');ln(x-2*s,y,x+2*s,y,'#090e0b')}}
 // Lower frame, seams, ventilation slots, and panel fasteners.
 ln(w*.06,h*.987,w*.94,h*.987,'#6e6e52');for(let i=0;i<15;i++){let x=w*.285+i*w*.006;ln(x,h*.962,x+w*.0025,h*.986,'#101c15',3*s);let xr=w-x;ln(xr,h*.962,xr-w*.0025,h*.986,'#101c15',3*s)}
 for(let x of[w*.036,w*.274,w*.407,w*.593,w*.657,w*.963])for(let y of[h*.76,h*.972]){circle(x,y,3.2*s,'#88856a',1,'#18201a');ln(x-1.5*s,y+1.5*s,x+1.5*s,y-1.5*s,'#060f0a')}
 txt(chassisData().code+'  /  '+chassisData().name,w*.081,h*.023,9,'#b6b696');txt('COCKPIT LINK 01  //  '+(player.shutdown>0?'REACTOR OFFLINE':'ONLINE'),w*.92,h*.023,9,player.shutdown>0?hudRed:'#b6b696','right');
 // The three panels share the band between the touch controls (the whole .072–.928 width without them).
 const py=h*.78,ph=h*.184,bandL=Math.max(w*.072,touchInsets.l+6),bandR=Math.min(w*.928,w-touchInsets.r-6),BW=Math.max(150,bandR-bandL),lx=bandL,lw=BW*.34229;panelBox(lx,py,lw,ph,'DAMAGE CONTROL / FRONT ARMOR');
 drawArmor(lx+lw*.24,py+ph*.61,ph*.62);
 const ax=lx+lw*.46,aw=lw*.48,rows=[['CORE','core'],['L. TORSO','leftTorso'],['R. TORSO','rightTorso'],['LEGS',null]];
 rows.forEach((r,i)=>{let y=py+32*s+i*(ph-40*s)/4,ratio=r[1]?Math.max(0,player.components[r[1]].hp/player.components[r[1]].max):Math.max(0,(player.components.leftLeg.hp+player.components.rightLeg.hp)/(player.components.leftLeg.max+player.components.rightLeg.max));txt(r[0],ax,y,8,hudDim);const bw=aw*.42;rect(ax+aw*.38,y-3*s,bw,5*s,'#283c23');rect(ax+aw*.38,y-3*s,bw*ratio,5*s,damageColor(ratio));txt(String(Math.round(ratio*100)).padStart(3,'0'),ax+aw,y,9,damageColor(ratio),'right')});
 const cx=bandL+BW*.39836,cw=BW*.20327;panelBox(cx,py,cw,ph,'SENSOR / 1,200 M');drawRadar(cx+cw/2,py+ph*.58,Math.min(cw*.38,ph*.36));
 const wx=bandL+BW*.65771,ww=BW*.34229;panelBox(wx,py,ww,ph,'WEAPON SYSTEMS / GROUP '+(weaponIndex+1));drawWeapons(wx+8*s,py+27*s,ww-16*s,ph-34*s);
 const stripY=h*.75;txt('ARMOR '+String(Math.round(playerArmor()*100)).padStart(3,'0')+'%',lx,stripY,13,damageColor(playerArmor()));txt('JET '+Math.round(player.fuel)+'%',(bandL+bandR)/2,stripY,11,hudColor,'center');txt('COOLANT '+player.coolants+' / '+config[loadout].coolants,wx+ww,stripY,11,hudColor,'right');
 txt(prompted('[{target}] TARGET   [{imaging}] IMAGING   [{weapons}] WEAPONS   [{coolant}] COOLANT'),(bandL+bandR)/2,h*.982,8,'#8b997b','center');
}
function drawArmor(cx,cy,size){const s=size/100;function shape(k,points){let c=player.components[k],ratio=Math.max(0,c.hp/c.max),col=damageColor(ratio);poly(points.map(p=>[cx+p[0]*s,cy+p[1]*s]),ratio<=0?'#22251c':col+'25',col,1);if(ratio<=0){ln(cx+points[0][0]*s,cy+points[0][1]*s,cx+points[2][0]*s,cy+points[2][1]*s,hudRed)}}
 shape('head',[[-10,-44],[10,-44],[13,-30],[-13,-30]]);shape('core',[[-12,-27],[12,-27],[11,5],[-11,5]]);shape('leftTorso',[[-30,-31],[-15,-27],[-14,3],[-26,2]]);shape('rightTorso',[[15,-27],[30,-31],[26,2],[14,3]]);shape('leftArm',[[-41,-30],[-32,-33],[-29,10],[-39,13]]);shape('rightArm',[[32,-33],[41,-30],[39,13],[29,10]]);shape('leftLeg',[[-24,8],[-7,8],[-10,33],[-10,48],[-30,48],[-29,38]]);shape('rightLeg',[[7,8],[24,8],[29,38],[30,48],[10,48],[10,33]]);ln(cx-9*s,cy+5*s,cx+9*s,cy+5*s,hudDim);
}
function drawRadar(cx,cy,r){ctx.save();circle(cx,cy,r,'#657d50',1,'#102014');circle(cx,cy,r*.66,'#3c5434');circle(cx,cy,r*.33,'#334b2c');ln(cx-r,cy,cx+r,cy,'#354c2d');ln(cx,cy-r,cx,cy+r,'#354c2d');txt('N',cx,cy-r-7*hudScale,8,hudDim,'center');let sweep=realTime*.7;ln(cx,cy,cx+Math.sin(sweep)*r,cy-Math.cos(sweep)*r,'#8faa6955');ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.clip();
 for(let e of entities){if(!e.alive)continue;let dx=e.x-player.x,dz=e.z-player.z,a=-player.yaw,x=(dx*Math.cos(a)+dz*Math.sin(a))/1200*r,y=(-dx*Math.sin(a)+dz*Math.cos(a))/1200*r;if(Math.hypot(x,y)>r)continue;let c=e.type==='tower'||e.type==='uplink'||e.type==='generator'||e.type==='reactor'?hudAmber:hudRed;if(target===e)corners(cx+x,cy+y,10*hudScale,10*hudScale,c,3*hudScale);if(e.type==='mech')poly([[cx+x,cy+y-3],[cx+x-3,cy+y+3],[cx+x+3,cy+y+3]],c);else rect(cx+x-2,cy+y-2,4,4,c)}
 drawCoopRadar(cx,cy,r);{let n=navPoints()[navIndex];if(n?.active&&!n.done){let dx=n.x-player.x,dz=n.z-player.z,a=-player.yaw,x=(dx*Math.cos(a)+dz*Math.sin(a))/1200*r,y=(-dx*Math.sin(a)+dz*Math.cos(a))/1200*r;circle(cx+x,cy+y,4,n.service?'#80d6df':hudColor)}}poly([[cx,cy-5],[cx-3,cy+4],[cx+3,cy+4]],hudColor);let twist=player.torso;ln(cx,cy,cx+Math.sin(twist)*r*.55,cy-Math.cos(twist)*r*.55,'#b0c78577');ctx.restore()}
function drawWeapons(x,y,w,h){let row=h/3;for(let i=0;i<3;i++){let wp=weapons[i],yy=y+i*row,disabled=weaponDisabled(i),selected=weaponIndex===i,c=disabled?hudRed:selected?hudColor:hudDim;if(selected)rect(x-3,yy-2,w+6,row-2,'#293d2466');txt(String(i+1),x+5*hudScale,yy+row*.34,11,c);txt(wp.name,x+28*hudScale,yy+row*.34,11,c);let ammo=i===0?'∞':String(i===1?player.ammo:player.missiles).padStart(2,'0');txt(ammo,x+w,yy+row*.34,12,c,'right');let status=disabled?'DISABLED':wp.remaining>0?'RECHARGE '+wp.remaining.toFixed(1)+'s':i===2&&lock<1?'LOCK REQUIRED':'READY';txt(status,x+28*hudScale,yy+row*.72,8,wp.remaining>0?hudAmber:c);const bx=x+w*.72,bw=w*.19;rect(bx,yy+row*.66,bw,3*hudScale,'#33482a');rect(bx,yy+row*.66,bw*(disabled?0:1-wp.remaining/wp.cooldown),3*hudScale,c);if(i<2)ln(x,yy+row-2,x+w,yy+row-2,'#33462a')}}
function drawCompass(){const w=screenW,h=screenH,s=hudScale,cx=w*.5,y=h*.075,span=w*.34,yaw=player.yaw+player.torso;let hdg=(yaw/DEG+360)%360;ln(cx-span/2,y,cx+span/2,y,'#77936288');for(let d=-60;d<=60;d+=5){let ang=Math.floor(hdg/5)*5+d,off=wrap(ang*DEG-yaw)/DEG,x=cx+off/120*span;if(Math.abs(x-cx)>span/2)continue;let major=ang%30===0;ln(x,y,x,y+(major?9:4)*s,major?hudColor:hudDim);if(major){let a=(ang%360+360)%360,label=({0:'N',90:'E',180:'S',270:'W'})[a]||String(a).padStart(3,'0');txt(label,x,y-10*s,10,hudColor,'center')}}poly([[cx-4*s,y-2*s],[cx+4*s,y-2*s],[cx,y+4*s]],hudAmber);txt(String(Math.round(hdg)%360).padStart(3,'0'),cx,y+23*s,11,hudColor,'center')}
function navPoints(){if(mode==='arena')return[{x:serviceBay.x,z:serviceBay.z,name:'SERVICE 01',desc:'STOP TO REPAIR',service:true,done:serviceUsed,active:true,y:terrainY(serviceBay.x,serviceBay.z)+33}];return[
 {x:relay.x,z:relay.z,name:'ALPHA',desc:'RELAY',done:missionFlags[0],active:!missionFlags[2],y:relay.y+65},
 {x:uplink.x,z:uplink.z,name:'BRAVO',desc:'UPLINK',done:missionFlags[1],active:!missionFlags[2],y:uplink.y+55},
 {x:canyonNav.x,z:canyonNav.z,name:'CHARLIE',desc:'NEEDLE PASS',done:missionFlags[3],active:missionFlags[2],y:terrainY(canyonNav.x,canyonNav.z)+18},
 {x:westFeed.x,z:westFeed.z,name:'DELTA',desc:'WEST FEED',done:!westFeed.alive,active:missionFlags[3],y:westFeed.y+38},
 {x:eastFeed.x,z:eastFeed.z,name:'ECHO',desc:'EAST FEED',done:!eastFeed.alive,active:missionFlags[3],y:eastFeed.y+38},
 {x:reactor.x,z:reactor.z,name:'FOXTROT',desc:reactorShielded()?'REACTOR / SHIELDED':'REACTOR / EXPOSED',done:!reactor.alive,active:missionFlags[3],y:reactor.y+63},
 {x:ridgeNav.x,z:ridgeNav.z,name:'GOLF',desc:'CINDER CUT',done:missionFlags[5],active:missionFlags[3]&&missionFlags[4],y:terrainY(ridgeNav.x,ridgeNav.z)+20},
 {x:skyguard.x,z:skyguard.z,name:'HOTEL',desc:'SKYGUARD BATTERY',done:missionFlags[6],active:missionFlags[5],y:skyguard.y+35},
 {x:flightLink.x,z:flightLink.z,name:'INDIA',desc:'FLIGHT LINK / '+Math.floor(linkTime/flightLink.duration*100)+'%',done:missionFlags[7],active:missionFlags[5]&&missionFlags[6],y:terrainY(flightLink.x,flightLink.z)+14},
 {x:extraction.x,z:extraction.z,name:'JULIET',desc:'EXTRACTION',done:false,active:allObjectivesComplete(),y:terrainY(extraction.x,extraction.z)+9},
 {x:serviceBay.x,z:serviceBay.z,name:'SERVICE 01',desc:'STOP TO REPAIR',service:true,done:serviceUsed,active:missionFlags[2],y:terrainY(serviceBay.x,serviceBay.z)+33},
 {x:supplyBay.x,z:supplyBay.z,name:'SERVICE 02',desc:'STOP TO REPAIR',service:true,done:supplyUsed,active:missionFlags[3]&&missionFlags[4],y:terrainY(supplyBay.x,supplyBay.z)+32}
 ]}

function drawNav(){let points=navPoints();for(let i=0;i<points.length;i++){let n=points[i];if(n.done||!n.active)continue;let p=project([n.x,n.y,n.z]);if(!p||p.x<screenW*.09||p.x>screenW*.91||p.y<screenH*.14||p.y>screenH*.68)continue;const col=n.service?'#80d6df':i===navIndex?hudColor:'#8fa87888',sz=6*hudScale;poly([[p.x,p.y-sz],[p.x+sz,p.y],[p.x,p.y+sz],[p.x-sz,p.y]],null,col);txt(n.name+' / '+Math.round(dist2(player,n))+' M',p.x,p.y-16*hudScale,9,col,'center');txt(n.desc,p.x,p.y+17*hudScale,8,col,'center')}
 let n=points[navIndex];if(n&&!n.done&&n.active){let d=wrap(Math.atan2(n.x-player.x,-(n.z-player.z))-(player.yaw+player.torso));if(Math.abs(d)>.6){let side=d>0?1:-1,x=side>0?Math.min(screenW*.895,screenW-touchInsets.r-16):screenW*.105,y=screenH*.29;poly([[x+side*8,y],[x-side*1,y-5],[x-side*1,y+5]],hudColor);txt(n.name,x-side*16,y,9,hudColor,side>0?'right':'left')}}
}
function drawTarget(){if(!target?.alive)return;let c=center(target),p=project(c),distance=dist2(player,target),s=hudScale,color=lock>=1?hudAmber:hudRed;if(p&&p.x>screenW*.065&&p.x<screenW*.935&&p.y>screenH*.105&&p.y<screenH*.70){let height=target.type==='mech'?22*target.scale:target.height||12;let half=clamp(height/(2*Math.tan(fov/2)*p.w)*screenH*.52,18*s,110*s),bw=target.type==='tower'?half*.65:half*.8;corners(p.x,p.y,bw*2,half*2,color,7*s);txt(target.name,p.x-bw,p.y-half-11*s,10,color);txt(Math.round(distance)+' M',p.x-bw,p.y+half+11*s,10,color);let ratio=entityHealth(target);rect(p.x-bw,p.y+half+22*s,bw*2,3*s,'#473b26');rect(p.x-bw,p.y+half+22*s,bw*2*ratio,3*s,color);if(lock>0){ctx.beginPath();ctx.arc(p.x,p.y,Math.max(half,bw)+7*s,-Math.PI/2,-Math.PI/2+TAU*lock);ctx.strokeStyle=lock>=1?hudAmber:color+'66';ctx.lineWidth=1;ctx.stroke()}}
 const ty=Math.max(screenH*.135,touchInsets.t+10*s);txt('TARGET / '+target.name,screenW*.92,ty,10,color,'right');txt((lock>=1?'LOCKED':lock>0?'ACQUIRING '+Math.round(lock*100)+'%':'NO LOCK')+'  /  '+Math.round(distance)+' M',screenW*.92,ty+screenH*.023,10,color,'right');
 if(!p||p.x<screenW*.07||p.x>screenW*.93||p.y>screenH*.70||p.y<screenH*.1){let d=wrap(Math.atan2(target.x-player.x,-(target.z-player.z))-(player.yaw+player.torso)),side=d>0?1:-1,x=side>0?Math.min(screenW*.895,screenW-touchInsets.r-16):screenW*.105,y=screenH*.37;poly([[x+side*10,y],[x-side*2,y-6],[x-side*2,y+6]],color);txt('TARGET',x-side*18,y,9,color,side>0?'right':'left')}
}
function drawFlightHUD(){let w=screenW,h=screenH,s=hudScale,cx=w*.5,cy=h*.43,accent=player.shutdown>0?hudRed:hudColor;
 drawCompass();drawNav();drawTarget();
 // Velocity and heat ladders remain visible through the canopy.
 const sy=h*.36,bh=h*.23,x=w*.09;ln(x,sy,x,sy+bh,hudDim);for(let i=0;i<=8;i++){let y=sy+bh-i/8*bh;ln(x-4*s,y,x+(i%2===0?8:4)*s,y,hudDim);if(i%2===0)txt(String(Math.round(i/8*chassisData().speed*3.6)),x-10*s,y,8,hudDim,'right')}let v=clamp(Math.abs(player.speed)/chassisData().speed,0,1);rect(x+4*s,sy+bh*(1-v),4*s,bh*v,hudColor);let ty=sy+bh*(1-clamp(player.throttle,0,1));poly([[x+12*s,ty],[x+20*s,ty-4*s],[x+20*s,ty+4*s]],hudAmber);txt(String(Math.round(player.speed*3.6)).padStart(2,'0'),x+3*s,sy+bh+25*s,26,hudColor,'center');txt('KM/H',x+3*s,sy+bh+45*s,9,hudDim,'center');txt('THR '+Math.round(player.throttle*100)+'%',x+2*s,sy-20*s,9,hudColor,'center');
 const hx=Math.min(w*.91,w-touchInsets.r-30*s);ln(hx,sy,hx,sy+bh,hudDim);for(let i=0;i<=10;i++){let y=sy+bh-i/10*bh;ln(hx-(i%2===0?8:4)*s,y,hx+4*s,y,i>=8?hudAmber:hudDim);if(i%2===0)txt(String(i*10),hx+10*s,y,8,i>=8?hudAmber:hudDim)}let heat=clamp(player.heat/100,0,1),hc=player.heat>82?hudRed:player.heat>60?hudAmber:hudColor;rect(hx-8*s,sy+bh*(1-heat),4*s,bh*heat,hc);txt(Math.round(player.heat)+'%',hx-2*s,sy+bh+25*s,26,hc,'center');txt('HEAT',hx-2*s,sy+bh+45*s,9,hudDim,'center');txt(player.shutdown>0?'OFFLINE':'REACTOR',hx-2*s,sy-20*s,9,hc,'center');
 // Center sight: four separated brackets, a precise aiming point, and range ticks.
 let gap=11*s,arm=13*s;for(let side of[-1,1]){ln(cx+side*gap,cy,cx+side*(gap+arm),cy,accent);ln(cx,cy+side*gap,cx,cy+side*(gap+arm),accent)}rect(cx-s,cy-s,2*s,2*s,hudAmber);if(hitMarker>0){const k=(12+hitMarker*40)*s,hm='rgba(255,214,150,'+Math.min(1,hitMarker*7).toFixed(2)+')';for(const sx of[-1,1])for(const sy of[-1,1])ln(cx+sx*k*.55,cy+sy*k*.55,cx+sx*k,cy+sy*k,hm,1.6)}corners(cx,cy,64*s,64*s,accent+'88',6*s);if(lock>=1){txt('LOCK',cx,cy+49*s,9,hudAmber,'center')}if(zoom)txt('2.1×',cx+53*s,cy,10,hudColor);if(player.vision&&!player.imaging)txt('NIGHT VISION',cx,cy-49*s,9,hudColor,'center');
 for(let n of[-10,-5,5,10]){let y=cy+(player.pitch/DEG-n)*h*.009;if(y<h*.24||y>h*.62)continue;ln(cx-65*s,y,cx-40*s,y,'#9cb88355');ln(cx+40*s,y,cx+65*s,y,'#9cb88355');txt(String(n),cx+74*s,y,8,'#99b27a88')}
 const by=h*.678,bw=120*s;ln(cx-bw,by,cx+bw,by,hudDim);for(let i=-2;i<=2;i++)ln(cx+i*bw/2,by-3*s,cx+i*bw/2,by+3*s,hudDim);let tx=cx+player.torso/1.68*bw;poly([[tx,by-2*s],[tx-4*s,by-9*s],[tx+4*s,by-9*s]],hudAmber);poly([[cx,by+2*s],[cx-3*s,by+7*s],[cx+3*s,by+7*s]],hudColor);txt('TORSO '+(player.torso<0?'−':'+')+String(Math.round(Math.abs(player.torso)/DEG)).padStart(2,'0')+'°',cx,by+20*s,9,hudColor,'center');
 txt(mode==='arena'?'PROVING GROUNDS / W'+String(Math.max(1,arena.wave)).padStart(2,'0'):'OP. IRON ECHO / '+(missionStage==='basin'?'01':['transit','works'].includes(missionStage)?'02':'03'),w*.08,h*.134,11,hudColor);txt(formatTime(missionTime)+' / '+difficulty.toUpperCase(),w*.08,h*.155,9,hudDim);
 let objs=mode==='arena'?arenaObjectives()
 :missionStage==='basin'?[['RELAY',missionFlags[0]],['UPLINK',missionFlags[1]],['BASIN GUARDS '+basinThreats().length,missionFlags[2]]]
 :missionStage==='transit'?[['BASIN SECURED',true],['CROSS NEEDLE PASS',missionFlags[3]],['REPAIR BAY / OPTIONAL',serviceUsed]]
 :missionStage==='works'?[['WEST POWER FEED',!westFeed.alive],['EAST POWER FEED',!eastFeed.alive],[reactorShielded()?'REACTOR SHIELDED':'REACTOR EXPOSED',!reactor.alive]]
 :missionStage==='ridgeTransit'?[['ASHFALL REACTOR DOWN',true],['CROSS CINDER CUT / GOLF',missionFlags[5]],['RIDGE BAY / OPTIONAL',supplyUsed]]
 :missionStage==='ridge'?[['CINDER CUT CROSSED',true],['SKYGUARD / NAV HOTEL',missionFlags[6]],['FLIGHT CODES / LOCKED',false]]
 :missionStage==='link'?[['SKYGUARD DESTROYED',true],['FLIGHT CODES '+Math.floor(linkTime/flightLink.duration*100)+'%',linkTime>=flightLink.duration],['RESPONSE '+ridgeResponseThreats().length+' / WAVE '+linkWave+' OF 2',linkWave===2&&ridgeResponseThreats().length===0]]
 :[['FLIGHT CODES SECURED',true],['NAV JULIET / EXTRACT',extractTime>=5],['LANDING ZONE CLEAR',landingThreats().length===0]];
 for(let i=0;i<objs.length;i++)txt((objs[i][1]?'[×] ':'[ ] ')+objs[i][0],w*.08,h*.19+i*18*s,9,objs[i][1]?hudDim:hudColor);
 txt('HOSTILES DESTROYED / '+kills,w*.08,h*.19+56*s,8,hudDim);
 if(radio.length){let r=radio[radio.length-1];ctx.save();ctx.globalAlpha=clamp(r.time,0,1);ctx.font=Math.round(11*s)+'px monospace';let max=w*.61,words=prompted(r.text).split(' '),lines=[''];for(let word of words){let i=lines.length-1;if(ctx.measureText(lines[i]+word).width>max&&lines[i])lines.push(word+' ');else lines[i]+=word+' '}lines.forEach((t,i)=>txt(t.trim(),cx,h*.218+i*15*s,11,hudColor,'center'));ctx.restore()}
 if(player.imaging){txt('ENHANCED IMAGING / [I]',cx,h*.135,11,'#81e5bf','center');txt('MESH EDGES / ARMOR SCAN',cx,h*.156,8,'#63b392','center');if(target?.alive&&target.type==='mech'){let tr=trace(fireOrigin(),forward(),weapons[weaponIndex].range,false);if(tr.entity===target){let cp=target.components[tr.component],name=tr.component.replace(/([A-Z])/g,' $1').toUpperCase();txt(name+' / '+Math.max(0,Math.round(cp.hp/cp.max*100))+'% ARMOR',cx,cy+69*s,10,damageColor(cp.hp/cp.max),'center')}}}
 if(sectorBanner&&sectorBanner.time>0){ctx.save();ctx.globalAlpha=clamp(sectorBanner.time,0,1);rect(cx-228*s,h*.305,456*s,57*s,'#0c1715e8','#758e68');txt(sectorBanner.title,cx,h*.305+20*s,18,hudColor,'center');txt(sectorBanner.sub,cx,h*.305+42*s,9,hudAmber,'center');ctx.restore()}
 for(let b of[{p:serviceBay,on:(mode==='arena'||missionFlags[2])&&!serviceUsed,time:serviceTime,name:'FIELD BAY'},{p:supplyBay,on:mode==='mission'&&missionFlags[3]&&missionFlags[4]&&!supplyUsed,time:supplyTime,name:'RIDGE BAY'}]){
  if(!b.on||dist2(player,b.p)>=b.p.r+10)continue;const text=player.altitude>=3?'LAND INSIDE THE RING':Math.abs(player.speed)>=1.5?b.name+' / STOP ['+key('stop')+']':'REPAIR / '+Math.max(0,6-b.time).toFixed(1)+'s';
  rect(cx-150*s,h*.56,300*s,32*s,'#0b2022ed','#80d6df');txt(text,cx,h*.56+13*s,11,'#80d6df','center');rect(cx-146*s,h*.56+27*s,292*s*clamp(b.time/6,0,1),3*s,'#80d6df');
 }
 if(missionStage==='link'&&player.shutdown<=0){
  const col=linkBlocked?hudAmber:'#80d6df',pct=Math.floor(linkTime/flightLink.duration*100);
  rect(cx-222*s,h*.557,444*s,64*s,'#0b1b1ded',col);txt('FLIGHT CONTROL / '+pct+'% / '+Math.max(0,flightLink.duration-linkTime).toFixed(1)+'s',cx,h*.557+13*s,11,col,'center');
  txt(prompted(linkStatus),cx,h*.557+32*s,9,col,'center');txt('TURN AND FIRE / PROGRESS SAVED WHEN PAUSED',cx,h*.557+47*s,8,hudDim,'center');rect(cx-217*s,h*.557+59*s,434*s*linkTime/flightLink.duration,3*s,col);
 }

 if(allObjectivesComplete()&&dist2(player,extraction)<extraction.r+35){let msg=transportTime<14?'TRANSPORT INBOUND / '+Math.ceil(14-transportTime)+'s':landingThreats().length?'LANDING ZONE CONTESTED':Math.abs(player.speed)>=2.2?'STOP FOR EXTRACTION / ['+key('stop')+']':player.altitude>=3?'LAND INSIDE THE ZONE':'HOLD POSITION';txt(msg,cx,h*.56,12,hudColor,'center')}
 if(extractTime>0){rect(cx-110*s,h*.59,220*s,35*s,'#102315d9',hudColor);rect(cx-107*s,h*.59+30*s,214*s*extractTime/5,3*s,hudColor);txt('EXTRACTING / '+Math.max(0,5-extractTime).toFixed(1)+'s',cx,h*.59+15*s,12,hudColor,'center')}
 if(player.shutdown>0){rect(cx-190*s,h*.54,380*s,59*s,'#20160ee8',hudRed);txt('REACTOR SHUTDOWN',cx,h*.54+18*s,20,hudRed,'center');txt('COOLING '+player.shutdown.toFixed(1)+'s  /  ['+key('coolant')+'] COOLANT',cx,h*.54+42*s,10,hudAmber,'center')}else if(player.heat>82&&Math.sin(realTime*5)>0)txt('HEAT CRITICAL',cx,h*.56,15,hudRed,'center');
 if(missionTime<20&&state==='playing')txt(prompted('[{full}] FULL THROTTLE  ·  [{target}] TARGET  ·  [{imaging}] IMAGING  ·  [{help}] HELP'),cx,h*.625,10,hudColor,'center');
 if(incomingArtillery()&&Math.sin(realTime*10)>-.3)txt('INCOMING ARTILLERY / KEEP MOVING',cx,h*.505,13,hudRed,'center');
}
function drawBoot(){let w=screenW,h=screenH,s=hudScale,cx=w*.5,cy=h*.34;rect(cx-195*s,cy-65*s,390*s,230*s,'#0d1a12e8','#8f9f6a');txt(chassisData().name+' / SYSTEM START',cx,cy-38*s,14,hudColor,'center');ln(cx-171*s,cy-19*s,cx+171*s,cy-19*s,hudDim);let stages=['REACTOR CONTROL','SENSOR ARRAY','WEAPON SYSTEMS','COMBAT LINK'];stages.forEach((t,i)=>{let y=cy+10*s+i*30*s;txt(t,cx-166*s,y,11,i<=bootStep?hudColor:hudDim);txt(i<bootStep?'ONLINE':i===bootStep?'STARTING...':'WAIT',cx+166*s,y,11,i<=bootStep?hudColor:hudDim,'right')});let y=cy+145*s;rect(cx-170*s,y,340*s,3*s,'#33472a');rect(cx-170*s,y,340*s*clamp(bootTime/sound.bootStatus().duration,0,1),3*s,hudColor)}
function drawMap(){let w=screenW,h=screenH,s=hudScale,size=Math.min(w*.58,h*.63),x=(w-size)/2,y=h*.12;rect(x-16*s,y-32*s,size+32*s,size+70*s,'#0c1811f5','#8f9f6a');txt('TACTICAL MAP / IRON ECHO',x,y-16*s,12,hudColor);drawTacticalMap(ctx,x,y,size,size,true);txt('['+key('map')+'] CLOSE  /  NORTH ↑  /  GRID 200 M',x,y+size+23*s,9,hudDim)}
function drawTacticalMap(c,x,y,w,h,live=false){
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#0d1913';c.fillRect(x,y,w,h);
 const minX=-660,maxX=680,minZ=-4110,maxZ=240,px=v=>x+(v-minX)/(maxX-minX)*w,py=v=>y+(v-minZ)/(maxZ-minZ)*h;
 c.fillStyle='#112124';c.fillRect(x,py(-4100),w,py(-2670)-py(-4100));
 c.strokeStyle='#2c4030';c.lineWidth=.7;for(let n=-600;n<=650;n+=200){c.beginPath();c.moveTo(px(n),y);c.lineTo(px(n),y+h);c.stroke()}for(let n=-4200;n<=400;n+=200){c.beginPath();c.moveTo(x,py(n));c.lineTo(x+w,py(n));c.stroke()}
 c.strokeStyle='#495b3b';for(let o of solidObstacles){if(o.r<12)continue;c.beginPath();for(let i=0;i<=7;i++){let a=i/7*TAU,xx=px(o.x+Math.cos(a)*o.r),yy=py(o.z+Math.sin(a)*o.r);if(i===0)c.moveTo(xx,yy);else c.lineTo(xx,yy)}c.stroke()}
 const label=(t,p,col,align='left',dy=0)=>{c.fillStyle=col;c.strokeStyle=col;c.strokeRect(px(p.x)-3,py(p.z)-3,6,6);c.font=Math.max(8,Math.round(w*.020))+'px monospace';c.textAlign=align;c.fillText(t,px(p.x)+(align==='left'?8:-8),py(p.z)+3+dy)};
 const missionMap=!!relay;
 if(!missionMap){
  // Proving Grounds: the range limit and the field bay.
  c.strokeStyle='#e6b37299';c.setLineDash([6,4]);c.beginPath();c.moveTo(x,py(ARENA.minZ));c.lineTo(x+w,py(ARENA.minZ));c.stroke();c.setLineDash([]);
  c.fillStyle='#e6b372';c.font=Math.max(7,Math.round(w*.018))+'px monospace';c.textAlign='left';c.fillText('RANGE LIMIT',x+7,py(ARENA.minZ)-5);
  label('SERVICE 01',serviceBay,serviceUsed?'#526a48':'#80d6df');
 }else{
 const points=[{x:0,z:92},relay,uplink,...routePoints];c.setLineDash([4,5]);c.strokeStyle='#abbf8188';c.beginPath();points.forEach((p,i)=>i?c.lineTo(px(p.x),py(p.z)):c.moveTo(px(p.x),py(p.z)));c.stroke();c.setLineDash([]);
 label('A / RELAY',relay,live&&missionFlags[0]?'#526a48':'#e6b372');label('B / UPLINK',uplink,live&&missionFlags[1]?'#526a48':'#e6b372');label('SERVICE 01',serviceBay,serviceUsed?'#526a48':'#80d6df');label('C / NEEDLE PASS',canyonNav,'#adcb8b');
 label('D / WEST',westFeed,westFeed.alive?'#e6b372':'#526a48','right');label('E / EAST',eastFeed,eastFeed.alive?'#e6b372':'#526a48');label('F / REACTOR',reactor,reactor.alive?'#e6b372':'#526a48');label('SERVICE 02',supplyBay,supplyUsed?'#526a48':'#80d6df');
 label('G / CINDER CUT',ridgeNav,missionFlags[5]?'#526a48':'#adcb8b');label('H / SKYGUARD',skyguard,skyguard.alive?'#e6b372':'#526a48');label('I / FLIGHT LINK',flightLink,missionFlags[7]?'#526a48':'#80d6df');label('J / EXTRACTION',extraction,'#adcb8b');
 }
 for(let e of entities){if(!e.alive||!['mech','turret'].includes(e.type)||(live&&dist2(player,e)>1600))continue;c.fillStyle=e.commander?'#ffd58a':'#e68866';c.fillRect(px(e.x)-2,py(e.z)-2,4,4)}
 c.font=Math.max(7,Math.round(w*.018))+'px monospace';c.fillStyle='#6d8976';c.textAlign='left';
 for(let a of missionMap?[['01 / KESTREL',-180],['02 / ASHFALL',-1590],['03 / BLACKGLASS',-2710]]:[['PROVING GROUNDS / KESTREL BASIN',-180]])c.fillText(a[0],x+7,py(a[1]));
 if(live&&coop?.active)for(const member of coop.members.values()){if(member.id===coop.id)continue;const q=coop.playerOf(member);if(!q)continue;c.fillStyle=q.alive?COOP_COLORS[member.slot]:'#e47e62';c.fillRect(px(q.x)-3,py(q.z)-3,6,6);c.fillText(String(member.slot+1),px(q.x)+6,py(q.z)+3);}
 let p=live?player:{x:0,z:92,yaw:0},xx=px(p.x),yy=py(p.z);c.save();c.translate(xx,yy);c.rotate(p.yaw);c.fillStyle='#d8e8b1';c.beginPath();c.moveTo(0,-7);c.lineTo(-4,5);c.lineTo(4,5);c.closePath();c.fill();c.restore();c.restore();
}

function soloDrawHUD(){ctx.clearRect(0,0,screenW,screenH);if(state==='menu')return;hudScale=clamp(Math.min(screenW/1440,screenH/860),.65,1.55);drawFlightHUD();drawCockpit();if(imagingSwitch>0){ctx.fillStyle='rgba(104,226,177,'+(imagingSwitch*.14)+')';ctx.fillRect(0,0,screenW,screenH*.74);ln(screenW*.065,screenH*.1+screenH*.6*(1-imagingSwitch/.45),screenW*.935,screenH*.1+screenH*.6*(1-imagingSwitch/.45),'#8affe377',1)}if(input.source==='touch'&&screenH>screenW*1.1&&state==='playing'&&missionTime<30)txt('TURN THE PHONE SIDEWAYS FOR THE FULL COCKPIT',screenW*.5,screenH*.66,10,hudAmber,'center');if(state==='boot'||state==='paused'&&pausedFrom==='boot')drawBoot();if(mapOpen)drawMap();if(damageFlash>0){let g=ctx.createRadialGradient(screenW*.5,screenH*.42,screenH*.13,screenW*.5,screenH*.45,screenW*.65);g.addColorStop(0,'#ff603500');g.addColorStop(1,'rgba(220,58,24,'+damageFlash+')');ctx.fillStyle=g;ctx.fillRect(0,0,screenW,screenH)}if(player.heat>75){ctx.fillStyle=`rgba(172,60,14,${Math.max(0,(player.heat-75)/500)})`;ctx.fillRect(0,0,screenW,screenH)}}

function updateChassisUI(){const c=chassisData();document.querySelectorAll('[data-chassis]').forEach(b=>{let selected=b.dataset.chassis===chassis;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});$('menuEyebrow').textContent=c.tons+' TONS. ONE PILOT.';$('menuMechNote').textContent=c.desc;$('heroCode').textContent=c.code;$('heroClass').textContent=c.name+' / '+c.role+' CLASS';$('heroWeapons').textContent=c.weapons.map(w=>w.name).join(' / ');$('heroMobility').textContent='JUMP CAPABLE · '+Math.round(c.speed*3.6)+' KM/H';$('menuChassis').textContent=c.name+' / '+c.tons+' T';$('chassisStatLine').textContent=c.name+' / '+c.tons+' T / '+Math.round(c.speed*3.6)+' KM/H';$('chassisSummary').textContent=c.desc+' Armor: '+Math.round(c.armor*100)+'% of Warden. Lock time: '+c.lockTime.toFixed(2)+' s. All weapon configurations remain available.'}
for(let b of document.querySelectorAll('[data-chassis]'))b.addEventListener('click',()=>{if(state!=='menu')return;chassis=b.dataset.chassis;applyChassisWeapons();updateChassisUI();try{localStorage.setItem('robotwarrior.chassis',chassis)}catch(e){}sound.fxPlay('beep')});
$('enhancedView').addEventListener('change',()=>{if($('enhancedView').checked!==player.imaging)toggleImaging()});
$('nightVision').addEventListener('change',()=>{if($('nightVision').checked!==player.vision)toggleVision()});

/* ---- Operations menu, brief and field manual ---- */
const MODE_DESC={
 mission:'Operation Iron Echo: three sectors, eight objectives and two one-use repair bays. Progress is saved when you enter Sector 02 and Sector 03.',
 arena:'Proving Grounds: ten waves in Kestrel Basin, with Longbow missile carriers from wave 4. The field bay restocks after waves 3, 6 and 9. Your best wave is kept.'
};
let briefMode='mission';
try{const c=JSON.parse(localStorage.getItem('robotwarrior.choices')||'{}');if(config[c.loadout])loadout=c.loadout;if(['cadet','regular','veteran'].includes(c.difficulty))difficulty=c.difficulty;if(c.mode==='arena')briefMode='arena'}catch(e){}
function saveChoices(){try{localStorage.setItem('robotwarrior.choices',JSON.stringify({loadout,difficulty,mode:briefMode}))}catch(e){}}
function syncChoiceUI(){
 document.querySelectorAll('[data-loadout]').forEach(e=>e.classList.toggle('active',e.dataset.loadout===loadout));$('loadoutDesc').textContent=config[loadout].desc;$('menuLoadout').textContent=config[loadout].label;
 document.querySelectorAll('[data-difficulty]').forEach(e=>e.classList.toggle('active',e.dataset.difficulty===difficulty));
 document.querySelectorAll('[data-mode]').forEach(e=>e.classList.toggle('active',e.dataset.mode===briefMode));$('modeDesc').textContent=MODE_DESC[briefMode];
}
function refreshMenu(){
 const cp=coop&&coop.mode!=='offline'?null:readCheckpoint();$('continueBtn').hidden=!cp;if(cp)$('continueLabel').textContent=String(cp.label).split(' / ')[0];
 const parts=[];
 try{const best=Number(localStorage.getItem('robotwarrior.best.v3')||0),bt=Number(localStorage.getItem('robotwarrior.besttime.v1')||0),ab=JSON.parse(localStorage.getItem('robotwarrior.arena.best.v1')||'{}'),aw=Number(ab.wave)||0;
  if(best)parts.push('IRON ECHO BEST '+best.toLocaleString()+(bt?' / '+formatTime(bt):''));
  if(aw)parts.push('PROVING GROUNDS '+(aw>ARENA.waves?'ALL WAVES':'WAVE '+aw)+' / '+(Number(ab.score)||0).toLocaleString())}catch(e){}
 $('menuRecord').textContent=parts.join('  ·  ');$('menuRecord').hidden=!parts.length;
}
function refreshSourceText(){
 const s=promptSource();
 $('menuHint').textContent=s==='gamepad'?'GAMEPAD / STICK OR D-PAD MOVES · A SELECTS · B BACK':s==='touch'?'TOUCH / LEFT STICK DRIVES · DRAG TO AIM · HEADPHONES RECOMMENDED':'KEYBOARD + MOUSE · GAMEPAD · TOUCH / HEADPHONES RECOMMENDED';
 $('manualBtn').textContent=s==='keyboard'?'[ H ]   FIELD MANUAL':'FIELD MANUAL';
}
input.onSourceChange(refreshSourceText);
function showControls(which){for(const b of document.querySelectorAll('[data-controls]')){const on=b.dataset.controls===which;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}for(const p of document.querySelectorAll('[data-controls-panel]'))p.hidden=p.dataset.controlsPanel!==which}
for(const b of document.querySelectorAll('[data-controls]'))b.addEventListener('click',()=>showControls(b.dataset.controls));
function openBrief(){$('brief').hidden=false;syncChoiceUI();const c=$('briefMap').getContext('2d');drawTacticalMap(c,0,0,$('briefMap').width,$('briefMap').height,false);focusFirstLater($('brief'))}
function openManual(){showControls(promptSource());
 if(coop?.active){coop.pauseLocal();helpFrom='pause';$('pause').hidden=true;$('manual').hidden=false;focusFirstLater($('manual'));return}
 if(state==='playing'||state==='boot'){pauseGame();helpFrom='pause';$('pause').hidden=true}else if(state==='paused'){helpFrom='pause';$('pause').hidden=true}else{helpFrom=$('brief').hidden?'menu':'brief';$('brief').hidden=true}$('manual').hidden=false;focusFirstLater($('manual'))}
function closeManual(){$('manual').hidden=true;if(helpFrom==='pause'){$('pause').hidden=false;focusFirstLater($('pause'))}else if(helpFrom==='brief')openBrief();else focusFirstLater(state==='menu'?$('menu'):$('result'))}
$('startBtn').addEventListener('click',()=>{if(!coop||coop.mode==='offline')mode='mission';startMission()});
$('arenaBtn').addEventListener('click',()=>{if(coop&&coop.mode!=='offline')return;mode='arena';startMission()});
$('continueBtn').addEventListener('click',continueMission);$('retryBtn').addEventListener('click',continueMission);
$('briefStart').addEventListener('click',()=>{if(!coop||coop.mode==='offline')mode=briefMode;startMission()});
$('briefBtn').addEventListener('click',openBrief);$('manualBtn').addEventListener('click',openManual);$('pauseManual').addEventListener('click',openManual);$('resumeBtn').addEventListener('click',resumeGame);$('restartBtn').addEventListener('click',startMission);$('quitBtn').addEventListener('click',returnMenu);$('againBtn').addEventListener('click',startMission);$('resultMenu').addEventListener('click',returnMenu);
// The kit's panel holds look sensitivity, invert Y, graphics quality and the touch layout.
for(const id of['settingsBtn','pauseSettings'])$(id).addEventListener('click',()=>kit.menu.open());
for(let b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>{let id=b.dataset.close;if(id==='manual')closeManual();else{$(id).hidden=true;if(id==='brief')focusFirstLater($('menu'))}});
for(let b of document.querySelectorAll('[data-loadout]'))b.addEventListener('click',()=>{loadout=b.dataset.loadout;syncChoiceUI();saveChoices();sound.fxPlay('beep')});
for(let b of document.querySelectorAll('[data-difficulty]'))b.addEventListener('click',()=>{difficulty=b.dataset.difficulty;syncChoiceUI();saveChoices();sound.fxPlay('beep')});
for(let b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{briefMode=b.dataset.mode==='arena'?'arena':'mission';syncChoiceUI();saveChoices();sound.fxPlay('beep')});
for(let id of['volume','music']){$(id).value=Math.round(settings[id]*100);$(id).addEventListener('input',()=>{settings[id]=Number($(id).value)/100;saveSettings()})}
$('quality').value=settings.quality;$('quality').addEventListener('change',()=>{settings.quality=['retro','balanced','sharp'].includes($('quality').value)?$('quality').value:'balanced';applyRenderDetail();saveSettings()});
$('shake').checked=settings.shake;$('shake').addEventListener('change',()=>{settings.shake=$('shake').checked;saveSettings()});
async function fullScreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(e){toast('Use your browser full screen command.')}}
// Alt+Enter is a window command, not a game action: it never reaches the kit's Enter binding.
window.addEventListener('keydown',e=>{if(e.altKey&&(e.code==='Enter'||e.code==='NumpadEnter')){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)fullScreen()}},true);
let hadLock=false;document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===world){hadLock=true;if(/mouse/i.test($('toast').textContent))$('toast').hidden=true}else if(hadLock){hadLock=false;if(state==='playing'||state==='boot')pauseGame()}});
window.addEventListener('blur',()=>{if(state==='playing'||state==='boot')pauseGame()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='playing'||state==='boot'))pauseGame()});
// A mouse click on the cockpit captures the mouse (touch and gamepad aim without it).
world.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&(state==='playing'||state==='boot')&&!coop?.localMenu&&!coop?.held&&document.pointerLockElement!==world)requestCapture()});
// Browsers start audio only after a gesture: any tap, click or key wakes a suspended context.
for(const type of['pointerdown','keydown'])addEventListener(type,()=>{const c=sound.ctx;if(c&&c.state==='suspended'&&!kit.paused)c.resume().catch(()=>{})},{capture:true,passive:true});
// The kit's settings panel pauses the loop: silence the game while it is open (a hosting pilot also holds the lance).
kit.onPause(p=>{if(p)sound.ctx?.suspend?.().catch(()=>{});else if(sound.ctx&&!document.hidden)sound.ctx.resume().catch(()=>{});coop?.kitMenu(p)});

/* ---- Menus with a gamepad or the arrow keys ---- */
function focusables(root){return[...root.querySelectorAll('button,input,select,summary')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length>0)}
// Pads get a focused button at once. Keys and mice do not (a held Space would click it on release).
function focusFirstLater(root){if(!root)return;setTimeout(()=>{if(root.hidden||input.source!=='gamepad')return;const a=document.activeElement;if(a&&a!==document.body&&root.contains(a))return;const el=root.querySelector('.button.primary:not([disabled]):not([hidden])')||focusables(root)[0];if(el&&!el.closest('[hidden]'))el.focus({preventScroll:true})},0)}
function topLayer(){for(const id of['manual','coopLobby','brief','result','pause'])if(!$(id).hidden)return $(id);return state==='menu'&&!$('menu').hidden?$('menu'):null}
function moveFocus(layer,cur,dir){
 const els=focusables(layer);if(!els.length)return;const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let best=null,bestScore=Infinity;
 for(const el of els){if(el===cur)continue;const q=el.getBoundingClientRect(),dx=q.left+q.width/2-cx,dy=q.top+q.height/2-cy,along=dir===1?-dy:dir===3?dy:dir===2?dx:-dx,across=dir===1||dir===3?Math.abs(dx):Math.abs(dy);if(along<=4)continue;const score=along+across*2.2;if(score<bestScore){bestScore=score;best=el}}
 if(!best){const i=els.indexOf(cur);best=els[(i+(dir===1||dir===4?-1:1)+els.length)%els.length]}
 best.focus({preventScroll:true});best.scrollIntoView?.({block:'nearest'});sound.fxPlay('beep',.4);
}
// Sliders and drop-downs step with left/right on a pad (keys already do this natively).
function adjustControl(el,d){
 if(el.tagName==='INPUT'&&el.type==='range'){const lo=Number(el.min)||0,hi=Number(el.max||100),step=(Number(el.step)||1)*5;el.value=String(clamp(Number(el.value)+d*step,lo,hi));el.dispatchEvent(new Event('input',{bubbles:true}));return true}
 if(el.tagName==='SELECT'){el.selectedIndex=clamp(el.selectedIndex+d,0,el.options.length-1);el.dispatchEvent(new Event('change',{bubbles:true}));return true}
 return false;
}
let navDir=0;
function menuNav(){
 const layer=topLayer();if(!layer){navDir=0;return}
 const v=input.vector('uiMove'),dir=Math.abs(v.y)>=Math.abs(v.x)?(v.y>.5?1:v.y<-.5?3:0):(v.x>.5?2:v.x<-.5?4:0),fresh=dir&&dir!==navDir?dir:0;navDir=dir;
 const a=document.activeElement,cur=a&&a!==document.body&&layer.contains(a)&&!a.closest('[hidden]')?a:null;
 if(fresh){if(!cur){const el=layer.querySelector('.button.primary:not([disabled]):not([hidden])')||focusables(layer)[0];el?.focus({preventScroll:true});return}if((fresh===2||fresh===4)&&input.source==='gamepad'&&adjustControl(cur,fresh===2?1:-1))return;moveFocus(layer,cur,fresh)}
 if(input.pressed('confirm')){if(cur){if(!cur.matches('input[type=range],select,input[type=text],input:not([type])'))cur.click()}else(layer.querySelector('.button.primary:not([disabled]):not([hidden])')||focusables(layer)[0])?.focus({preventScroll:true})}
 if(input.pressed('back'))goBack();
}
// Escape, P, Start or B: close the top panel, pause, or resume.
function goBack(){
 if(!$('manual').hidden){closeManual();return true}
 if(!$('coopLobby').hidden){if(!coop||coop.mode==='offline'){$('coopLobby').hidden=true;focusFirstLater($('menu'))}return true}
 if(!$('brief').hidden){$('brief').hidden=true;focusFirstLater($('menu'));return true}
 if(coop?.active&&coop.localMenu){coop.resumeLocal();return true}
 if(state==='playing'||state==='boot'){pauseGame();return true}
 if(state==='paused'){resumeGame();return true}
 return false;
}

/* ---- Combat controls ---- */
// What the pilot asks of the machine this frame (analog on sticks). Discrete actions act at once below.
function readControls(o){const d=input.vector('drive'),a=input.vector('aim');o.thr=d.y;o.turn=d.x;o.ax=a.x;o.ay=a.y;o.jets=input.down('jets');o.fire=input.down('fire');o.all=input.down('fireAll');o.restore=input.down('restore');return o}
let wheelAcc=0,pinchAcc=0;
function handleInput(){
 if(input.pressed('pause')){goBack();return}
 if(input.pressed('help')&&$('coopLobby').hidden){if(!$('manual').hidden)closeManual();else openManual();return}
 if(input.pressed('mute')){sound.muted=!sound.muted;toast(sound.muted?'Sound is off. [U] Sound on.':'Sound is on.')}
 const flying=(state==='playing'||state==='boot')&&!coop?.localMenu&&$('manual').hidden&&$('pause').hidden;
 bindCombatKeys(flying);
 if(!flying){wheelAcc=pinchAcc=0;menuNav();if(state==='menu'&&input.pressed('start')&&topLayer()===$('menu')){mode='mission';startMission()}return}
 if(input.pressed('stop'))player.throttle=0;
 if(input.pressed('full'))player.throttle=1;
 if(input.pressed('target'))chooseTarget();
 if(input.pressed('targetNext'))chooseTarget(true);
 if(input.pressed('align')){player.align=true;player.centerTorso=false}
 if(input.pressed('center')){player.centerTorso=true;player.align=false}
 for(let i=0;i<3;i++)if(input.pressed('weapon'+(i+1))){weaponIndex=i;sound.fxPlay('beep')}
 if(input.pressed('weaponNext')){weaponIndex=(weaponIndex+1)%3;sound.fxPlay('beep')}
 if(input.pressed('weaponPrev')){weaponIndex=(weaponIndex+2)%3;sound.fxPlay('beep')}
 if(input.pressed('coolant'))coolant();
 if(input.pressed('vision'))toggleVision();
 if(input.pressed('imaging'))toggleImaging();
 if(input.pressed('zoom'))zoom=!zoom;
 if(input.pressed('map')){mapOpen=!mapOpen;sound.fxPlay('beep')}
 if(input.pressed('nav')){const n=navPoints().map((p,i)=>p.active&&!p.done?i:-1).filter(i=>i>=0);navIndex=n[(n.indexOf(navIndex)+1)%n.length]??0;sound.say('nav')}
 // Mouse wheel cycles weapons; a pinch on touch toggles the zoom.
 const z=input.zoom();
 if(z){if(input.source==='touch'){pinchAcc+=z;if(Math.abs(pinchAcc)>.6){zoom=pinchAcc>0;pinchAcc=0}}else{wheelAcc+=z;if(Math.abs(wheelAcc)>=.5){weaponIndex=(weaponIndex+(wheelAcc<0?1:2))%3;wheelAcc=0;sound.fxPlay('beep',.5)}}}
 // Mouse, right stick or a touch drag twist the torso and pitch the arms, as the mouse always did.
 const lk=input.look('look');if(lk.x||lk.y){const k=LOOK*(zoom?.55:1);player.torso=clamp(player.torso+lk.x*k,-1.68,1.68);player.pitch=clamp(player.pitch-lk.y*k,-.62,.6);player.centerTorso=false}
}

/* ---- Touch controls follow the game state ---- */
let touchHidden=null,touchRestore=null;
function touchChanged(){requestAnimationFrame(()=>requestAnimationFrame(readTouchInsets))}
function syncTouch(){
 if(!kit.touch)return;
 const hide=!(state==='playing'||state==='boot')||!!coop?.localMenu||!$('manual').hidden||!$('pause').hidden;
 if(hide!==touchHidden){touchHidden=hide;kit.touch.suspend(hide,'game');touchChanged()}
 const r=!!coop?.active;if(r!==touchRestore){touchRestore=r;kit.touch.setShown('restore',r);touchChanged()}
}
input.onSourceChange(touchChanged);kit.settings.subscribe(touchChanged);

/* ---- The frame ---- */
function tick(dt){
 realTime+=dt;
 handleInput();syncTouch();
 if(coop?.active){coop.frame(dt)}else{
  if(state==='boot'){
   const startup=sound.bootStatus();
   // Use the audio clock so the full clip plays, even on a slow device or after a pause.
   bootTime=startup.time===null?bootTime+dt:startup.time;
   const progress=bootTime/startup.duration;
   bootStep=progress<.035?-1:progress<.23?0:progress<.45?1:progress<.67?2:progress<.86?3:4;
   if(startup.ended||bootTime>=startup.duration){state='playing';if(resumeCheckpoint)stageBriefing();else if(mode==='arena')announce('RANGE CONTROL / Proving Grounds are live. Ten waves inbound. Hold the basin.',null,8);else announce('CONTROL / Cut the relay and uplink. Clear the basin, then cross Needle Pass.','insertion',9)}
  }
  if(state==='playing'){readControls(ctl);const steps=Math.ceil(dt/.025);for(let i=0;i<steps&&state==='playing';i++)updateMission(dt/steps)}
 }
 if(state!=='paused'){updateEffects(dt);for(let i=radio.length-1;i>=0;i--)if((radio[i].time-=dt)<=0)radio.splice(i,1)}
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').hidden=true}
 sound.update();renderWorld();drawHUD();
}

/* RobotWarrior co-op: one authoritative host, up to three remote pilots.
   Fixed 40 Hz simulation. Inputs are predicted locally, then replayed after
   a host correction. World snapshots are sent at 10 Hz. No client may submit damage. */
const COOP_PROTOCOL=5, COOP_STEP=.025; // 5: kit controls in the input packet, Proving Grounds
const COOP_COLORS=['#80d6df','#aaca8c','#f4c47c','#c3acfa'],COOP_RGB=COOP_COLORS.map(hex);
const coopNumber=(v,lo,hi,fallback=0)=>Number.isFinite(v)?clamp(v,lo,hi):fallback;
const coopCopy=v=>JSON.parse(JSON.stringify(v));
const coopName=v=>String(v||'PILOT').replace(/[^a-z0-9 _.-]/gi,'').trim().slice(0,16).toUpperCase()||'PILOT';
function squadAny(test){return coop?.active?coop.living().some(r=>test(coop.playerOf(r))):test(player)}
function squadAll(test){if(!coop?.active)return test(player);const a=coop.living();return a.length>0&&a.every(r=>test(coop.playerOf(r)))}
function coopScaleEntity(e){if(!coop?.sessionStarted||!['mech','turret'].includes(e.type)||e.coopScaled)return;e.coopScaled=true;const f=1+.6*(coop.crewSize-1);if(e.components)for(const c of Object.values(e.components)){c.hp*=f;c.max*=f}else{e.hp*=f;e.maxHP*=f}}
class LanceCoop {
 constructor(){
  this.mode='offline';this.transport=null;this.id='';this.hostId='';this.room='';this.members=new Map();this.session='';this.sessionStarted=false;this.crewSize=1;
  this.accumulator=0;this.snapClock=0;this.netClock=0;this.seq=0;this.history=[];this.actions=[];this.executing=null;this.replaying=false;this.inStep=false;this.receiving=false;
  this.events=[];this.eventId=0;this.lastEvent=0;this.snapshotId=0;this.lastSnapshot=0;this.projectileId=0;this.localMenu=false;this.held=false;this.menuHold=false;this.localBootDone=false;
  this.cameraError=[0,0,0];this.lastSnapshotAt=0;this.lastNetAt=0;this.connecting=false;this.suppressClose=false;this.error='';this.renderedRoster='';this.startedAt=0;this.menuHold=false;
  this.wireUI();this.netTimer=setInterval(()=>this.heartbeat(),1000);
 }
 get active(){return this.sessionStarted&&this.mode!=='offline'}
 get host(){return this.mode==='host'}
 get guest(){return this.mode==='guest'}
 get currentId(){return this.executing||this.id}
 playerOf(r){if(r.id===this.id)return this.executing&&this.executing!==this.id?this.members.get(this.id)?.sim.p:player;return this.host?r.sim?.p:r.p||r.sim?.p}
 living(){return [...this.members.values()].filter(r=>this.playerOf(r)?.alive)}
 currentRecord(){return this.members.get(this.currentId)}
 message(text,bad=false){this.error=bad?text:'';$('coopMessage').textContent=text;$('coopMessage').classList.toggle('bad',bad)}
 notice(title,text){$('coopNoticeTitle').textContent=title;$('coopNoticeText').textContent=text;$('coopNotice').hidden=false}
 hideNotice(){$('coopNotice').hidden=true}
 show(){if(state!=='menu')return;$('coopLobby').hidden=false;$('brief').hidden=true;$('manual').hidden=true;$('coopChassis').value=chassis;$('coopLoadout').value=loadout;$('coopDifficulty').value=difficulty;if(this.mode==='offline')$('coopMode').value=briefMode;this.paint();focusFirstLater($('coopLobby'))}
 wireUI(){
  try{$('coopName').value=localStorage.getItem('robotwarrior.pilot')||'PILOT'}catch(_) {$('coopName').value='PILOT'}
  $('coopOpen').addEventListener('click',()=>this.show());$('coopClose').addEventListener('click',()=>{if(this.mode==='offline')$('coopLobby').hidden=true;else this.leave()});
  $('coopHost').addEventListener('click',()=>this.connect(true));$('coopJoin').addEventListener('click',()=>this.connect(false));
  $('coopCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();this.connect(false)}});
  $('coopLeave').addEventListener('click',()=>this.mode==='offline'?$('coopLobby').hidden=true:this.leave());
  $('coopCopy').addEventListener('click',()=>this.copy(this.formattedRoom()));
  $('coopInvite').addEventListener('click',()=>{const isWeb=['https:','http:'].includes(location.protocol),u=isWeb?new URL(location.href):null;if(u){u.hash='room='+this.room;this.copy(u.href)}else this.copy('RobotWarrior co-op room: '+this.formattedRoom()+'. Open RobotWarrior_Coop.html, select ONLINE CO-OP, then JOIN.')});
  $('coopReady').addEventListener('click',()=>this.ready());$('coopLaunch').addEventListener('click',()=>this.startRequested());
  for(const id of ['coopName','coopChassis','coopLoadout','coopDifficulty','coopMode'])$(id).addEventListener('change',()=>this.changeProfile());
  if(new URLSearchParams(location.search).get('relay')==='1'&&['http:','https:'].includes(location.protocol)){$('coopTransport').value='relay';$('coopSignal').value=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/peerjs';}
  const invite=new URLSearchParams(location.hash.slice(1)).get('room');if(invite){$('coopCodeInput').value=invite;setTimeout(()=>this.show(),0)}
  // Controls come through the kit's actions; the local menu and a host hold simply stop sampling them.
  window.addEventListener('pagehide',()=>{if(this.transport)this.transport.close()});
 }
 formattedRoom(){return this.room?this.room.slice(0,4)+'-'+this.room.slice(4):'—'}
 async copy(text){try{await navigator.clipboard.writeText(text);this.message('Copied. Send it to your friends.')}catch(_){const a=document.createElement('textarea');a.value=text;a.style.cssText='position:fixed;top:0;left:0;opacity:.01';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}a.remove();this.message(ok?'Copied. Send it to your friends.':'Copy this text: '+text)}}
 profile(){return {name:coopName($('coopName').value),chassis:chassisSpecs[$('coopChassis').value]?$('coopChassis').value:'warden',loadout:config[$('coopLoadout').value]?$('coopLoadout').value:'balanced'}}
 changeProfile(){
  if(this.active)return;const p=this.profile();chassis=p.chassis;loadout=p.loadout;applyChassisWeapons();updateChassisUI();
  try{localStorage.setItem('robotwarrior.pilot',p.name)}catch(_){}
  if(this.host){difficulty=['cadet','regular','veteran'].includes($('coopDifficulty').value)?$('coopDifficulty').value:'regular';const r=this.members.get(this.id);if(r)Object.assign(r,p,{ready:false});this.lobbyBroadcast()}
  else if(this.mode==='offline')briefMode=$('coopMode').value==='arena'?'arena':'mission';
  else if(this.guest){this.sendHost({t:'profile',...p})}
  this.paint();
 }
 paint(){
  const connected=this.mode!=='offline',r=this.members.get(this.id),ready=!!r?.ready;
  $('coopState').textContent=this.connecting?'CONNECTING':connected?(this.host?'HOST ONLINE':'LINK ONLINE'):'OFFLINE';
  $('coopCount').textContent=connected?this.members.size+' / 4 PILOTS':'UP TO 4 PLAYERS';$('coopConnect').hidden=connected;$('coopRoom').hidden=!connected;
  $('coopRoomCode').textContent=this.formattedRoom();$('coopClose').setAttribute('aria-label',connected?'Leave co-op room':'Close co-op lobby');
  $('coopLeave').textContent=connected?(this.host?'CLOSE ROOM':'LEAVE ROOM'):'RETURN TO OPERATIONS';
  $('coopHost').disabled=this.connecting;$('coopJoin').disabled=this.connecting;$('coopReady').textContent=ready?'CANCEL READY':'READY';
  $('coopLaunch').hidden=!this.host;$('coopLaunch').disabled=this.active||this.members.size<1||![...this.members.values()].every(x=>x.ready);
  $('coopLaunchHint').textContent=this.host?'All pilots must be ready. Deployment closes the room to new pilots.':'Choose your mech and select READY. The host starts the mission.';
  for(const id of ['coopName','coopChassis','coopLoadout'])$(id).disabled=ready||this.active||this.connecting;
  $('coopDifficulty').disabled=$('coopMode').disabled=this.guest||this.active||this.connecting;
  for(const id of ['coopTransport','coopSignal','coopTurn','coopTurnUser','coopTurnPass','coopForceRelay'])$(id).disabled=connected||this.connecting;
  $('coopMechDesc').textContent=chassisSpecs[$('coopChassis').value]?.desc||'';
  const roster=[...this.members.values()].sort((a,b)=>a.slot-b.slot),key=JSON.stringify(roster.map(x=>[x.id,x.slot,x.name,x.chassis,x.loadout,x.ready]));
  if(this.renderedRoster!==key){this.renderedRoster=key;$('coopRoster').replaceChildren();for(let i=0;i<4;i++){
   const pilot=roster.find(x=>x.slot===i),row=document.createElement('div');row.className='coop-slot'+(pilot?'':' coop-empty');
   const number=document.createElement('span');number.className='coop-slot-number';number.style.color=COOP_COLORS[i];number.textContent=String(i+1).padStart(2,'0');
   const main=document.createElement('div');main.className='coop-slot-main';const name=document.createElement('strong'),info=document.createElement('small');name.textContent=pilot?pilot.name+(pilot.id===this.id?' / YOU':''):'OPEN SLOT';
   info.textContent=pilot?chassisSpecs[pilot.chassis].name+' / '+config[pilot.loadout].label:'WAITING FOR A FRIEND';main.append(name,info);
   const status=document.createElement('span');status.className='coop-slot-state';status.textContent=pilot?(pilot.ready?'READY':'HANGAR')+(pilot.id===this.hostId?' · HOST':''):'—';row.append(number,main,status);$('coopRoster').append(row);
  }}
 }
 async connect(asHost){
  if(this.connecting||this.mode!=='offline')return;let code=$('coopCodeInput').value.toUpperCase().trim();
  if(!asHost){try{if(code.includes('://'))code=new URLSearchParams(new URL($('coopCodeInput').value).hash.slice(1)).get('room')||''}catch(_){}code=code.replace(/[^A-Z2-9]/g,'');if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){this.message('Enter the eight-character room code from your host.',true);return}}
  const signal=$('coopSignal').value.trim();let url;try{url=new URL(signal);if(!['ws:','wss:'].includes(url.protocol))throw Error()}catch(_){this.message('Enter a valid ws:// or wss:// signal server address.',true);return}
  if(location.protocol==='https:'&&url.protocol!=='wss:'){this.message('This secure page needs a wss:// signal server.',true);return}
  const turn=$('coopTurn').value.trim();if(turn&&!/^turns?:[^\s]+$/i.test(turn)){this.message('The TURN address must start with turn: or turns:.',true);return}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';if(asHost){const bytes=crypto.getRandomValues(new Uint8Array(8));code=[...bytes].map(b=>chars[b%chars.length]).join('')}
  const ice=[{urls:'stun:stun.l.google.com:19302'},{urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}];
  if(turn)ice.push({urls:turn,username:$('coopTurnUser').value.trim(),credential:$('coopTurnPass').value});
  this.connecting=true;this.room=code;this.hostId='rw4-'+code;this.id=asHost?this.hostId:'rw4c-'+[...crypto.getRandomValues(new Uint8Array(10))].map(x=>x.toString(16).padStart(2,'0')).join('');this.paint();sound.init();
  this.message(asHost?'Creating the room…':'Finding the host…');
  const Transport=$('coopTransport').value==='relay'?LanceRelayTransport:LanceTransport;
  const transport=this.transport=new Transport({id:this.id,signal,iceServers:ice,relayOnly:$('coopForceRelay').checked,
   onSignal:online=>{if(!online&&this.mode!=='offline')this.message('Signal server disconnected. Existing data links can continue. New pilots cannot join until it returns.',true)},
   onChannel:l=>this.channel(l),onError:m=>this.connectionError(m),onClose:(id,wasOpen)=>this.disconnected(id,wasOpen)});
  try{await transport.open();if(this.transport!==transport)return;
   if(asHost){this.mode='host';this.members.set(this.id,{id:this.id,slot:0,...this.profile(),ready:false,bootReady:false});difficulty=$('coopDifficulty').value;this.connecting=false;this.message('Room open. Share the code, then select READY.');this.paint()}
   else{this.message('Host found. Opening the data connection…');await transport.connect(this.hostId)}
  }catch(e){if(this.transport===transport){transport.close();this.transport=null;this.connecting=false;this.mode='offline';this.message(e.message,true);this.paint()}}
 }
 connectionError(message){this.message(message,true);if(this.mode==='offline'){this.connecting=false;this.transport?.close();this.transport=null;this.paint()}}
 sendHost(packet,essential=true){return this.transport?.send(this.hostId,packet,essential)}
 broadcast(packet,essential=true){for(const id of this.members.keys())if(id!==this.id)this.transport?.send(id,packet,essential)}
 channel(link){
  const sourceTransport=this.transport;
  if(this.host){
   if(this.active||this.members.size>=4){this.transport.send(link.id,{t:'reject',reason:this.active?'This mission has started. Join after the host opens a new room.':'This room already has four pilots.'},true);setTimeout(()=>this.transport?.drop(link.id),150);return}
   link.onData=m=>{if(this.transport===sourceTransport)this.receiveHost(link,m)};link.handshake=setTimeout(()=>{if(!this.members.has(link.id))this.transport?.drop(link.id)},6000);
  }else{
   if(link.id!==this.hostId){this.transport?.drop(link.id);return}
   link.onData=m=>{if(this.transport===sourceTransport)this.receiveGuest(m)};this.transport.send(link.id,{t:'hello',v:COOP_PROTOCOL,...this.profile()},true);
  }
 }
 receiveHost(link,m){
  if(m.t==='ping'){this.transport.send(link.id,{t:'pong',at:m.at},true);return}if(m.t==='pong'){link.rtt=clamp(performance.now()-m.at,0,9999);return}
  if(m.t==='hello'){
   if(this.members.has(link.id))return;
   if(m.v!==COOP_PROTOCOL||this.active||this.members.size>=4){this.transport.send(link.id,{t:'reject',reason:m.v!==COOP_PROTOCOL?'Game versions differ. Use the same RobotWarrior co-op HTML file.':this.active?'The mission has started.':'The room is full.'},true);setTimeout(()=>this.transport?.drop(link.id),150);return}
   clearTimeout(link.handshake);const used=new Set([...this.members.values()].map(r=>r.slot));let slot=0;while(used.has(slot))slot++;
   this.members.set(link.id,{id:link.id,slot,name:coopName(m.name),chassis:chassisSpecs[m.chassis]?m.chassis:'warden',loadout:config[m.loadout]?m.loadout:'balanced',ready:false,bootReady:false,queue:[],ack:0,credit:0,intent:null});
   this.lobbyBroadcast();this.message('Pilot linked. All pilots must select READY.');return;
  }
  const r=this.members.get(link.id);if(!r)return;
  if(m.t==='leave'){this.transport.drop(link.id);return}
  if(m.t==='profile'&&!this.active){Object.assign(r,{name:coopName(m.name),chassis:chassisSpecs[m.chassis]?m.chassis:r.chassis,loadout:config[m.loadout]?m.loadout:r.loadout,ready:false});this.lobbyBroadcast();return}
  if(m.t==='ready'&&!this.active){r.ready=!!m.value;this.lobbyBroadcast();return}
  if(m.t==='bootReady'&&m.session===this.session){r.bootReady=true;return}
  if(m.t==='input'&&m.session===this.session&&state==='playing'&&!this.held){
   const x=this.validateInput(m.input);if(!x||x.seq<=(r.lastReceived||0)||x.seq>(r.lastReceived||0)+240)return;
   r.lastReceived=x.seq;if(r.queue.length>=120){this.transport.drop(link.id);return}r.queue.push(x);
  }
 }
 receiveGuest(m){
  if(m.t==='ping'){this.sendHost({t:'pong',at:m.at});return}if(m.t==='pong'){const l=this.transport?.links.get(this.hostId);if(l)l.rtt=clamp(performance.now()-m.at,0,9999);return}
  if(m.t==='reject'||m.t==='closed'){const message=m.reason||'The host closed this room.';this.leave(false);this.show();this.message(message,true);return}
  if(m.t==='lobby'&&m.v===COOP_PROTOCOL&&!this.active){
   if(!Array.isArray(m.members)||m.members.length>4||!m.members.some(r=>r.id===this.id))return;
   this.mode='guest';this.connecting=false;this.members=new Map(m.members.map(r=>[r.id,r]));difficulty=['cadet','regular','veteran'].includes(m.difficulty)?m.difficulty:'regular';$('coopDifficulty').value=difficulty;$('coopMode').value=m.mode==='arena'?'arena':'mission';this.message('Connected. Select READY when your mech is set.');this.paint();return;
  }
  if(m.t==='start'&&m.v===COOP_PROTOCOL&&Array.isArray(m.members)&&m.members.length<=4){this.begin(m);return}
  if(m.session!==this.session)return;
  if(m.t==='go'&&state==='boot'){this.go();return}
  if(m.t==='hold'){this.held=!!m.value;if(this.held){this.accumulator=0;this.notice('HOST PAUSED','The host must return to the game to continue.')}else this.hideNotice();sound.update();return}
  if(m.t==='snapshot'){this.applySnapshot(m);return}
  if(m.t==='finish'){this.receiving=true;score=m.score;kills=m.kills;finishSoloMission(!!m.won);$('resultScore').textContent=score.toLocaleString();this.receiving=false;this.configureResult();this.hideNotice();return}
  if(m.t==='roster'){const keep=new Set(m.ids||[]);for(const id of this.members.keys())if(!keep.has(id))this.members.delete(id);announce(m.message||'A pilot left the mission.',null,6);return}
 }
 lobbyBroadcast(){const list=[...this.members.values()].map(({id,slot,name,chassis,loadout,ready})=>({id,slot,name,chassis,loadout,ready}));this.broadcast({t:'lobby',v:COOP_PROTOCOL,difficulty,mode:$('coopMode').value==='arena'?'arena':'mission',members:list});this.paint()}
 ready(){if(this.active||this.mode==='offline')return;sound.init();const r=this.members.get(this.id);if(!r)return;if(this.host){r.ready=!r.ready;this.lobbyBroadcast()}else this.sendHost({t:'ready',value:!r.ready})}
 startRequested(){
  if(this.mode==='offline'){soloStartMission();return}
  if(!this.host){toast('The host starts or restarts the mission.');return}
  if(!this.active&&![...this.members.values()].every(r=>r.ready)){this.show();this.message('Each pilot must select READY before deployment.',true);return}
  const packet={t:'start',v:COOP_PROTOCOL,session:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),difficulty,mode:$('coopMode').value==='arena'?'arena':'mission',members:[...this.members.values()].map(({id,slot,name,chassis,loadout})=>({id,slot,name,chassis,loadout}))};
  this.broadcast(packet);this.begin(packet);requestCapture();
 }
 capture(){return {p:player,chassis,loadout,weapons,target,lock,lockSpoken,weaponIndex,serviceTime,serviceUsed,supplyTime,supplyUsed}}
 restore(c){player=c.p;chassis=c.chassis;loadout=c.loadout;weapons=c.weapons;target=c.target;lock=c.lock;lockSpoken=c.lockSpoken;weaponIndex=c.weaponIndex;serviceTime=c.serviceTime;serviceUsed=c.serviceUsed;supplyTime=c.supplyTime;supplyUsed=c.supplyUsed}
 withPilot(r,fn){if(!r||r.id===this.id)return fn();const saved=this.capture(),prior=this.executing;if(!prior&&this.members.has(this.id))this.members.get(this.id).sim=saved;this.restore(r.sim);this.executing=r.id;try{return fn()}finally{r.sim=this.capture();this.restore(saved);this.executing=prior}}
 makeSimulation(r){const saved=this.capture();chassis=r.chassis;loadout=r.loadout;weapons=weapons.map(w=>({...w}));applyChassisWeapons();player=newPlayer();const spots=[[0,92],[-26,119],[26,119],[0,151]],s=spots[r.slot]||spots[0];player.x=s[0];player.z=s[1];player.y=terrainY(player.x,player.z);target=null;lock=0;lockSpoken=false;weaponIndex=0;serviceTime=0;serviceUsed=false;supplyTime=0;supplyUsed=false;const sim=this.capture();this.restore(saved);return sim}
 begin(packet){
  this.session=packet.session;this.sessionStarted=true;this.crewSize=packet.members.length;difficulty=['cadet','regular','veteran'].includes(packet.difficulty)?packet.difficulty:'regular';mode=packet.mode==='arena'?'arena':'mission';
  this.members=new Map(packet.members.map(r=>[r.id,{...r,ready:true,bootReady:false,queue:[],ack:0,lastReceived:0,credit:0,intent:null,revive:0}]));
  const mine=this.members.get(this.id);if(!mine){this.leave(false);return}
  chassis=mine.chassis;loadout=mine.loadout;resetGame();for(const r of this.members.values())r.sim=this.makeSimulation(r);this.restore(mine.sim);
  delete this.pendingFinish;this.history=[];this.actions=[];this.seq=0;this.snapshotId=0;this.lastSnapshot=0;this.events=[];this.eventId=0;this.lastEvent=0;this.projectileId=0;this.localMenu=false;this.held=false;this.menuHold=false;this.localBootDone=false;this.cameraError=[0,0,0];this.lastSnapshotAt=performance.now();this.accumulator=0;this.snapClock=0;this.startedAt=performance.now();
  document.querySelectorAll('.overlay').forEach(e=>e.hidden=true);$('menu').hidden=true;this.hideNotice();state='boot';bootTime=0;bootStep=-1;sound.init();sound.update();
  $('restartBtn').disabled=!this.host;$('restartBtn').textContent=this.host?'RESTART LANCE MISSION':'HOST CONTROLS RESTART';$('quitBtn').textContent=this.host?'CLOSE ROOM AND LEAVE':'LEAVE CO-OP';
  $('pause').querySelector('.pause-head h2').textContent='MISSION IS LIVE.';$('pause').querySelector('.panel-header span').textContent='LOCAL MENU / CO-OP CONTINUES';
 }
 go(){state='playing';this.accumulator=0;this.hideNotice();if(mode==='arena')announce('RANGE CONTROL / Ten waves inbound. Stay together. Hold [{restore}] near a downed teammate to restore the mech.',null,10);else announce('LANCE CONTROL / Clear all three sectors. Stay together. Hold [{restore}] to restore a downed teammate.','insertion',10);if(!document.pointerLockElement&&input.source==='keyboard')toast('Click the cockpit to capture the mouse. [H] Help.',5)}
 boot(dt){
  if(this.held)return;const startup=sound.bootStatus();bootTime=startup.time===null?bootTime+dt:startup.time;const progress=bootTime/startup.duration;bootStep=progress<.035?-1:progress<.23?0:progress<.45?1:progress<.67?2:progress<.86?3:4;
  if(!this.localBootDone&&(startup.ended||bootTime>=startup.duration)){
   this.localBootDone=true;this.members.get(this.id).bootReady=true;if(this.guest)this.sendHost({t:'bootReady',session:this.session});
   this.notice('SYSTEMS ONLINE','Waiting for all pilots to complete startup.');
  }
  if(this.host&&this.localBootDone&&[...this.members.values()].every(r=>r.bootReady)){this.broadcast({t:'go',session:this.session});this.go()}
 }
 validateInput(x){
  if(!x||!Number.isInteger(x.seq)||x.seq<1)return null;const q=x.c&&typeof x.c==='object'?x.c:{};
  const c={thr:coopNumber(q.thr,-1,1),turn:coopNumber(q.turn,-1,1),ax:coopNumber(q.ax,-1,1),ay:coopNumber(q.ay,-1,1),jets:q.jets===true,fire:q.fire===true,all:q.all===true,restore:q.restore===true};
  return {seq:x.seq,c,throttle:coopNumber(x.throttle,-.45,1),torso:coopNumber(x.torso,-1.68,1.68),pitch:coopNumber(x.pitch,-.62,.6),align:x.align===true,center:x.center===true,weapon:Math.floor(coopNumber(x.weapon,0,2)),target:Number.isInteger(x.target)?x.target:0,actions:Array.isArray(x.actions)?x.actions.filter(a=>a==='coolant').slice(0,1):[]};
 }
 sampleInput(){
  const halted=this.localMenu||this.held||!player.alive,c=halted?{...NO_CTL}:readControls({});
  return {seq:++this.seq,c,throttle:halted?0:player.throttle,torso:player.torso,pitch:player.pitch,align:!halted&&player.align,center:!halted&&player.centerTorso,weapon:weaponIndex,target:target?.id||0,actions:halted?[]:this.actions.splice(0)};
 }
 stepInput(r,x,replay=false){
  const oldCtl=ctl,oldStep=this.inStep,oldReplay=this.replaying;this.inStep=true;this.replaying=replay;
  try{
   ctl=x.c;player.throttle=x.throttle;player.torso=x.torso;player.pitch=x.pitch;player.align=x.align;player.centerTorso=x.center;weaponIndex=x.weapon;
   const wanted=entities.find(e=>e.id===x.target&&e.alive)||null;if(target!==wanted){target=wanted;lock=0;lockSpoken=false}
   if(player.alive){for(const a of x.actions)if(a==='coolant')soloCoolant();updatePlayer(COOP_STEP)}else{player.speed=0;player.throttle=0;}
   r.intent=x;r.ack=x.seq;
  }finally{ctl=oldCtl;this.inStep=oldStep;this.replaying=oldReplay}
 }
 updatePilots(dt){
  const local=this.members.get(this.id),input=this.sampleInput();this.stepInput(local,input);
  for(const r of this.members.values())if(r.id!==this.id){
   r.credit=Math.min(.35,r.credit+dt);let steps=0;
   while(r.queue.length&&r.credit>=COOP_STEP-.000001&&steps++<8){const next=r.queue.shift();this.withPilot(r,()=>this.stepInput(r,next));r.credit-=COOP_STEP;}
  }
  this.updateRevives(dt);
 }
 frame(dt){
  this.cameraError=this.cameraError.map(x=>x*Math.exp(-dt*13));
  if(state==='boot'){this.boot(dt);return}
  if(state!=='playing'||this.held)return;
  this.accumulator=Math.min(.2,this.accumulator+dt);
  while(this.accumulator>=COOP_STEP&&state==='playing'){
   this.accumulator-=COOP_STEP;
   if(this.host){updateMission(COOP_STEP);if(this.pendingFinish!==undefined){const won=this.pendingFinish;delete this.pendingFinish;this.finish(won);}}
   else {const r=this.members.get(this.id);const input=this.sampleInput();this.history.push(input);if(this.history.length>160){this.history.splice(0,this.history.length-160);this.notice('LINK DELAY','Waiting for the host. Your controls will recover when the link returns.')}this.sendHost({t:'input',session:this.session,input},false);this.stepInput(r,input);this.visualProjectiles(COOP_STEP)}
  }
  if(this.host){this.snapClock+=dt;if(this.snapClock>=.1){this.snapClock%=.1;this.sendSnapshot()}}
  else this.interpolate(dt);
  if(this.held)this.notice('HOST PAUSED','The host must return to the game to continue.');
  else if(!player.alive)this.notice('MECH DISABLED','A teammate must stop within 32 meters and hold '+key('restore')+' for 6 seconds.');
  else if(this.guest&&performance.now()-this.lastSnapshotAt>2500)this.notice('HOST LINK DELAY','Waiting for mission data. Check that the host has the game open.');
  else this.hideNotice();
 }
 nearestPilot(e){let best=null,distance=Infinity;for(const r of this.living()){const p=this.playerOf(r),d=dist2(p,e);if(d<distance){best=r;distance=d}}return best}
 downCurrent(){const r=this.currentRecord();if(r){r.revive=0;r.downAt=missionTime;announce('LANCE / '+r.name+' is down. Stop nearby and hold [{restore}] to restore the mech.',null,9)}if(this.living().length===0)endMission(false)}
 updateRevives(dt){
  for(const fallen of this.members.values()){
   const p=this.playerOf(fallen);if(p.alive){fallen.revive=0;continue}
   const helper=this.living().find(r=>{const q=this.playerOf(r);return r.id!==fallen.id&&r.intent?.c?.restore&&dist2(q,p)<32&&q.altitude<3&&Math.abs(q.speed)<2.2&&q.shutdown<=0});
   fallen.revive=helper?Math.min(6,(fallen.revive||0)+dt):Math.max(0,(fallen.revive||0)-dt*.5);
   if(fallen.revive>=6){this.withPilot(fallen,()=>{for(const [k,c]of Object.entries(player.components))c.hp=Math.max(c.hp,c.max*(k==='core'?.45:.3));player.alive=true;player.speed=0;player.throttle=0;player.heat=20;player.shutdown=0;player.armorWarning=false;player.heatWarning=false;});fallen.revive=0;announce('LANCE / '+fallen.name+' restored. Repair supplies remain available at the field bays.',null,8)}
  }
 }
 repairAll(dt){for(const r of this.members.values())if(this.playerOf(r).alive)this.withPilot(r,()=>updateRepairBays(dt))}
 projectileHit(p,dir,len){
  const cover=coverDistance(p.p,dir,len);let hit=null,near=Math.min(len+1,cover);
  for(const r of this.living()){const q=this.playerOf(r),eye=[q.x,q.y+q.altitude+chassisSpecs[r.chassis].eye,q.z],t=raySphere(p.p,dir,eye,chassisSpecs[r.chassis].radius,len+1);if(t<near){near=t;hit=r}}
  if(hit){p.hit=p.direct=true;this.withPilot(hit,()=>damagePlayer(p.damage,p));return}
  if(cover<len-.5){p.hit=true;burst(vadd(p.p,vmul(dir,cover)),p.color,7,4)}
 }
 visualProjectiles(dt){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;p.p=vadd(p.p,vmul(p.v,dt));if(p.life<=0)projectiles.splice(i,1)}}
 emit(event){if(this.host&&this.active&&!this.replaying){this.events.push({...event,id:++this.eventId});if(this.events.length>160)this.events.shift()}}
 snapshotPlayer(r){let c=r.id===this.id?this.capture():r.sim;return {id:r.id,p:c.p,ack:r.ack||0,cd:c.weapons.map(w=>w.remaining),target:c.target?.id||0,lock:c.lock,lockSpoken:c.lockSpoken,weapon:c.weaponIndex,repair:[c.serviceTime,c.serviceUsed,c.supplyTime,c.supplyUsed],revive:r.revive||0}}
 snapshotEntity(e){return {id:e.id,type:e.type,class:e.class,name:e.name,zone:e.zone,x:e.x,y:e.y,z:e.z,yaw:e.yaw,scale:e.scale,alive:e.alive,hp:e.hp,maxHP:e.maxHP,components:e.components,phase:e.phase,speed:e.speed,deathTime:e.deathTime,hitFlash:e.hitFlash,skyguard:e.skyguard,commander:e.commander,assaultLink:e.assaultLink,longbow:e.longbow}}
 sendSnapshot(){
  if(!this.host||!this.active)return;const packet={t:'snapshot',session:this.session,n:++this.snapshotId,time:missionTime,stage:missionStage,flags:missionFlags,nav:navIndex,kills,score,shotsFired,shotsHit,extractTime,transportTime,reinforcements,link:[linkTime,linkWave,linkStatus,linkBlocked],banner:sectorBanner,arena:mode==='arena'?{wave:arena.wave,phase:arena.phase,timer:arena.timer}:null,players:[...this.members.values()].map(r=>this.snapshotPlayer(r)),entities:entities.map(e=>this.snapshotEntity(e)),projectiles:projectiles.slice(-100).map(p=>({id:p.netId||(p.netId=++this.projectileId),p:p.p,v:p.v,type:p.type,friendly:p.friendly,life:p.life,color:p.color})),events:this.events.slice(-80)};
  this.broadcast(packet,false);this.events=[];
 }
 applySnapshot(m){
  if(!this.guest||!this.active||!Number.isInteger(m.n)||m.n<=this.lastSnapshot||!Array.isArray(m.players)||!Array.isArray(m.entities)||m.entities.length>120)return;
  this.lastSnapshot=m.n;this.lastSnapshotAt=performance.now();missionTime=m.time;missionStage=m.stage;missionFlags=m.flags.slice(0,8);navIndex=m.nav;kills=m.kills;score=m.score;shotsFired=m.shotsFired;shotsHit=m.shotsHit;extractTime=m.extractTime;transportTime=m.transportTime;reinforcements=m.reinforcements;[linkTime,linkWave,linkStatus,linkBlocked]=m.link;sectorBanner=m.banner;
  if(m.arena&&typeof m.arena==='object'){arena.wave=coopNumber(m.arena.wave,0,ARENA.waves,arena.wave);arena.timer=coopNumber(m.arena.timer,0,99,arena.timer);if(['intro','fight','break','done'].includes(m.arena.phase))arena.phase=m.arena.phase}
  this.receiving=true;
  try{
   for(const item of m.entities){
    let e=entities.find(x=>x.id===item.id),first=!e;
    if(!e&&item.type==='mech'){e=makeMech(item.x,item.z,item.name,item.class);e.id=item.id;entityID=Math.max(entityID,e.id)}
    // Proving Grounds sentries and Longbows appear mid-mission on the host: build them here too.
    else if(!e&&item.type==='turret'&&Number.isInteger(item.id)){e=item.longbow?createLongbow(item.x,item.z,String(item.name||'LONGBOW')):createTurret(item.x,item.z,String(item.name||'SENTRY'));e.id=item.id;entityID=Math.max(entityID,e.id)}
    if(!e)continue;const old={x:e.x,y:e.y,z:e.z,yaw:e.yaw},wasAlive=e.alive;
    Object.assign(e,item);if(e.type==='mech'){e.model=enemyModels[e.class]||enemyModels.medium;if(e.commander)e.model=enemyModels.heavy;}
    if(!first&&['mech','turret'].includes(e.type)){e.netTo={x:item.x,y:item.y,z:item.z,yaw:item.yaw};Object.assign(e,old)}
    if(wasAlive&&!e.alive){burst(center(e),hex('#ffac56'),35,20);sound.fxPlay('explosion',clamp(1-dist2(player,e)/1200,.1,.8))}
   }
   for(const data of m.players){const r=this.members.get(data.id);if(!r)continue;r.revive=data.revive;r.p=data.p;r.repair=data.repair;
    if(data.id!==this.id){r.netTo=data.p;if(!r.view)r.view=coopCopy(data.p);continue}
    const oldPosition=[player.x,player.y+player.altitude,player.z],look={throttle:player.throttle,align:player.align,centerTorso:player.centerTorso,torso:player.torso,pitch:player.pitch,imaging:player.imaging,vision:player.vision,target:target?.id,weapon:weaponIndex},oldArmor=playerArmor();
    this.history=this.history.filter(x=>x.seq>data.ack);player=coopCopy(data.p);for(let i=0;i<3;i++)weapons[i].remaining=data.cd[i];target=entities.find(x=>x.id===data.target)||null;lock=data.lock;lockSpoken=data.lockSpoken;weaponIndex=data.weapon;[serviceTime,serviceUsed,supplyTime,supplyUsed]=data.repair;
    for(const input of this.history)this.stepInput(r,input,true);
    player.throttle=player.alive&&!this.localMenu?look.throttle:0;player.align=look.align;player.centerTorso=look.centerTorso;player.torso=look.torso;player.pitch=look.pitch;player.imaging=look.imaging;player.vision=look.vision;weaponIndex=look.weapon;
    if(look.target!==target?.id){target=entities.find(e=>e.id===look.target&&e.alive)||null;lock=0;lockSpoken=false}
    const nowPosition=[player.x,player.y+player.altitude,player.z];for(let i=0;i<3;i++)this.cameraError[i]=clamp(this.cameraError[i]+oldPosition[i]-nowPosition[i],-12,12);
    if(playerArmor()<oldArmor-.0001){damageFlash=Math.min(.5,damageFlash+.18);shakePower=Math.max(shakePower,.18);sound.fxPlay('hit',.6)}
   }
   projectiles=m.projectiles.map(p=>({...p,prev:p.p.slice(),net:true}));
   for(const ev of m.events||[]){if(ev.id<=this.lastEvent)continue;this.lastEvent=ev.id;if(ev.kind==='beam'&&ev.owner!==this.id)spawnBeam(ev.a,ev.b,ev.c,ev.width,ev.life);if(ev.kind==='radio'){radio.push({text:ev.text,time:ev.duration,max:ev.duration});if(radio.length>3)radio.shift();if(ev.voice)sound.say(ev.voice,true)}if(ev.kind==='shot'&&ev.owner!==this.id)sound.fxPlay(ev.sound,clamp(1-dist2(player,ev)/1000,.02,.7))}
  }finally{this.receiving=false}
 }
 interpolate(dt){const t=1-Math.exp(-dt*17);for(const e of entities)if(e.netTo){e.x=mix(e.x,e.netTo.x,t);e.y=mix(e.y,e.netTo.y,t);e.z=mix(e.z,e.netTo.z,t);e.yaw+=wrap(e.netTo.yaw-e.yaw)*t;}
  for(const r of this.members.values())if(r.id!==this.id&&r.netTo){const p=r.netTo,v=r.view||(r.view=coopCopy(p));for(const k of ['x','y','z','altitude','torso','pitch','speed','phase'])v[k]=mix(v[k]||0,p[k]||0,t);v.yaw+=wrap(p.yaw-v.yaw)*t;v.alive=p.alive;v.components=p.components;}
 }
 pauseLocal(){
  if(!['playing','boot'].includes(state))return;this.localMenu=true;Object.assign(ctl,NO_CTL);player.throttle=0;this.actions=[];$('pause').hidden=false;focusFirstLater($('pause'));$('pause').querySelector('.pause-head h2').textContent=this.held?'LANCE ON HOLD.':'MISSION IS LIVE.';$('pause').querySelector('.panel-header span').textContent=this.held?'HOST ON HOLD / ALL PILOTS PAUSED':'LOCAL MENU / CO-OP CONTINUES';input.unlockPointer();
  if(this.host&&document.hidden){this.held=true;this.broadcast({t:'hold',session:this.session,value:true});$('pause').querySelector('.pause-head h2').textContent='LANCE ON HOLD.';$('pause').querySelector('.panel-header span').textContent='HOST TAB HIDDEN / ALL PILOTS PAUSED';}
  sound.update();
 }
 resumeLocal(){this.localMenu=false;document.querySelectorAll('.overlay').forEach(e=>e.hidden=true);if(this.host&&this.held&&!this.menuHold){this.held=false;this.broadcast({t:'hold',session:this.session,value:false});this.accumulator=0;}input.settle();sound.ctx?.resume().catch(()=>{});this.hideNotice();requestCapture()}
 // The kit's settings panel stops this page's loop: a host holds the whole lance until it closes.
 kitMenu(open){if(!this.active||!this.host)return;if(open&&!this.held){this.held=true;this.menuHold=true;this.broadcast({t:'hold',session:this.session,value:true})}else if(!open&&this.menuHold){this.menuHold=false;if(!document.hidden){this.held=false;this.accumulator=0;this.broadcast({t:'hold',session:this.session,value:false})}}}
 finish(won){
  if(this.guest&&!this.receiving)return;if(['won','lost'].includes(state))return;
  this.sendSnapshot();finishSoloMission(won);this.configureResult();this.hideNotice();this.localMenu=false;this.held=false;
  if(this.host)this.broadcast({t:'finish',session:this.session,won,score,kills});
 }
 configureResult(){$('againBtn').disabled=!this.host;$('againBtn').textContent=this.host?'DEPLOY LANCE AGAIN':'WAITING FOR THE HOST';$('resultMenu').textContent=this.host?'CLOSE ROOM':'LEAVE ROOM';$('resultCode').textContent='LANCE DEBRIEF / '+this.members.size+' PILOTS';$('resultDetail').textContent+=' · Shared team score · Friendly fire off';}
 heartbeat(){
  if(this.mode==='offline')return;const now=performance.now();for(const l of this.transport?.links.values()||[]){if(!l.open)continue;if(now-l.lastSeen>(this.held?180000:18000)){this.transport.drop(l.id);continue}this.transport.send(l.id,{t:'ping',at:now},true);if(Math.random()<.1)this.transport.inspectRoute(l)}
  if(this.active&&this.host&&state==='boot'&&now-this.startedAt>70000){for(const r of [...this.members.values()])if(r.id!==this.id&&!r.bootReady)this.transport?.drop(r.id)}
 }
 disconnected(id,wasOpen){
  if(this.suppressClose||this.mode==='offline')return;
  if(this.host){const r=this.members.get(id);if(!r)return;this.members.delete(id);if(this.active){this.broadcast({t:'roster',session:this.session,ids:[...this.members.keys()],message:r.name+' left the mission.'});announce('LANCE / '+r.name+' disconnected. Remaining pilots can continue.',null,8);if(this.living().length===0&&state==='playing')endMission(false)}else this.lobbyBroadcast()}
  else if(id===this.hostId){this.leave(false);this.show();this.message('Connection to the host was lost. The mission ended. Create or join a new room.',true)}
 }
 leave(send=true){
  if(send&&this.transport){if(this.host)this.broadcast({t:'closed',reason:'The host closed this room.'});else this.sendHost({t:'leave'})}
  const transport=this.transport;this.transport=null;this.suppressClose=true;setTimeout(()=>transport?.close(),70);this.mode='offline';this.connecting=false;this.sessionStarted=false;this.members.clear();this.history=[];this.actions=[];this.room='';this.held=false;this.localMenu=false;this.suppressClose=false;this.hideNotice();
  soloReturnMenu();$('coopLobby').hidden=true;$('restartBtn').disabled=false;$('restartBtn').textContent='RESTART MISSION';$('quitBtn').textContent='RETURN TO OPERATIONS';$('againBtn').disabled=false;$('againBtn').textContent='DEPLOY AGAIN';$('resultMenu').textContent='OPERATIONS';$('pause').querySelector('.pause-head h2').textContent='HOLD POSITION.';$('pause').querySelector('.panel-header span').textContent='COMBAT SYSTEM / PAUSED';this.paint();
 }
 status(){return {mode:this.mode,room:this.room,id:this.id,hostId:this.hostId,session:this.session,started:this.sessionStarted,players:[...this.members.values()].map(r=>({id:r.id,name:r.name,slot:r.slot,chassis:r.chassis,loadout:r.loadout,ready:r.ready,bootReady:r.bootReady,alive:this.playerOf(r)?.alive,position:this.playerOf(r)?{x:this.playerOf(r).x,z:this.playerOf(r).z}:null,ack:r.ack||0,revive:r.revive||0})),links:[...this.transport?.links.values()||[]].map(l=>({id:l.id,open:l.open,route:l.route,ping:Math.round(l.rtt),buffered:l.dc?.bufferedAmount||0,bytesIn:l.bytesIn,bytesOut:l.bytesOut})),snapshot:this.lastSnapshot,history:this.history.length,held:this.held,localMenu:this.localMenu,error:this.error}}
}

function startMission(){if(coop&&coop.mode!=='offline')return coop.startRequested();soloStartMission()}
function pauseGame(){if(coop?.active)return coop.pauseLocal();soloPauseGame()}
function resumeGame(){if(coop?.active)return coop.resumeLocal();soloResumeGame()}
function returnMenu(){if(coop&&coop.mode!=='offline')return coop.leave();soloReturnMenu()}
function endMission(won){if(coop?.active){if(coop.executing){coop.pendingFinish=won;return}return coop.finish(won)}finishSoloMission(won)}
function announce(text,voice=null,duration=7){if(coop?.replaying)return;if(coop?.host&&coop.active)coop.emit({kind:'radio',text,voice,duration});if(coop?.executing&&coop.executing!==coop.id)return;soloAnnounce(text,voice,duration)}
function toast(text,seconds=3){if(coop?.replaying||coop?.executing&&coop.executing!==coop.id)return;soloToast(text,seconds)}
function spawnBeam(a,b,c,width=.15,life=.19){if(coop?.replaying)return;soloSpawnBeam(a,b,c,width,life);if(!coop?.receiving)coop?.emit({kind:'beam',a,b,c,width,life,owner:coop.weaponOwner||''})}
function coolant(){if(coop?.active&&!coop.inStep){if(player.alive&&coop.actions.length<2)coop.actions.push('coolant');return}soloCoolant()}
function fireWeapon(index){
 if(!player.alive)return;if(coop?.guest&&coop.active)return predictWeapon(index,!coop.replaying);
 const before=weapons[index].remaining,owner=coop?.weaponOwner;if(coop)coop.weaponOwner=coop.currentId;
 try{soloFireWeapon(index)}finally{if(coop)coop.weaponOwner=owner}
 if(coop?.host&&coop.active&&before<=0&&weapons[index].remaining>0){const kind=index===0?'laser':index===1?'cannon':'missile';coop.emit({kind:'shot',owner:coop.currentId,sound:kind,x:player.x,z:player.z});if(coop.executing&&coop.executing!==coop.id){const main=coop.members.get(coop.id).sim.p;const context=coop.executing;coop.executing=null;try{coopRawFx.call(sound,kind,clamp(1-dist2(main,player)/1000,.03,.75))}finally{coop.executing=context}}}
}
function predictWeapon(index,visual){
 if(state!=='playing'||player.shutdown>0||!player.alive)return;const w=weapons[index];if(w.remaining>0)return;
 if(weaponDisabled(index)){if(visual)sound.say('disabled');return}
 if(index===1&&player.ammo<=0||index===2&&player.missiles<=0){if(visual)sound.say('ammo');return}
 if(index===2&&(!target?.alive||lock<1)){if(visual)sound.say('nolock');return}
 w.remaining=w.cooldown;player.heat+=w.heat;if(index===1)player.ammo--;const count=index===2?Math.min(chassisData().volley,player.missiles):0;if(index===2)player.missiles-=count;
 if(visual){const origin=fireOrigin(),dir=forward(),right=[Math.cos(player.yaw+player.torso),0,Math.sin(player.yaw+player.torso)],result=trace(origin,dir,w.range);shakePower=Math.max(shakePower,index===1?.32:.12);
  if(index===0){for(const side of [-1,1])soloSpawnBeam(vadd(origin,vadd(vmul(right,3.9*side),[0,-2.7,0])),result.point,w.color,.13,.22);burst(result.point,w.color,5,3)}
  if(index===1){const muzzle=vadd(origin,vadd(vmul(right,4.4),[0,-2.9,0]));projectiles.push({p:muzzle,v:vmul(norm(vsub(result.point,muzzle)),550),type:'cannon',friendly:true,life:1,color:w.color,prev:muzzle.slice(),predicted:true})}
  if(index===2)for(let i=0;i<count;i++){const muzzle=vadd(origin,vadd(vmul(right,(i%2?1:-1)*5.2),[0,3.3+Math.floor(i/2),0]));projectiles.push({p:muzzle,v:vmul(dir,100),type:'missile',friendly:true,life:.8,color:w.color,prev:muzzle.slice(),predicted:true})}
  sound.fxPlay(index===0?'laser':index===1?'cannon':'missile');
 }
 if(player.heat>=100)shutdown();
}
function enemyFire(e){const n=beams.length+projectiles.length;soloEnemyFire(e);if(coop?.host&&coop.active&&beams.length+projectiles.length>n)coop.emit({kind:'shot',owner:'',sound:e.type==='turret'||e.class==='heavy'?'cannon':'laser',x:e.x,z:e.z})}
function updateEnemies(dt){for(const e of entities){if(coop?.host&&coop.active){const r=coop.nearestPilot(e);if(r)coop.withPilot(r,()=>updateOneEnemy(e,dt));else updateOneEnemy(e,dt)}else updateOneEnemy(e,dt)}}
function drawAllies(){
 if(!coop?.active||state==='menu')return;
 for(const r of coop.members.values())if(r.id!==coop.id){const p=coop.host?r.sim?.p:r.view||r.p;if(!p||dist2(CAM,p)>1800)continue;
  const o={...p,y:p.y+p.altitude,type:'mech',scale:1,model:playerModels[r.chassis]||playerModels.warden,friendly:true,slot:r.slot,deathTime:p.alive?0:2.7};drawMech(o);
  const col=COOP_RGB[r.slot]||COOP_RGB[0];R.wire=col;
  draw(geo.ring,M.transform([p.x,p.y+.25,p.z],[9,1,9],ZERO3,_w0),col,1,.3);
  if(p.altitude>1&&p.alive){blend('add');for(const side of [-1,1])draw(geo.cone,M.transform([p.x+side*2.7,p.y+p.altitude+4,p.z],[.9,3,1],ZERO3,_w0),C.jet,.45,1);blend('opaque')}
 }
}
function drawCoopRadar(cx,cy,r){if(!coop?.active)return;for(const member of coop.members.values()){if(member.id===coop.id)continue;const p=coop.playerOf(member);if(!p)continue;const dx=p.x-player.x,dz=p.z-player.z,a=-player.yaw,x=(dx*Math.cos(a)+dz*Math.sin(a))/1200*r,y=(-dx*Math.sin(a)+dz*Math.cos(a))/1200*r;if(Math.hypot(x,y)>r-4)continue;const c=COOP_COLORS[member.slot];poly([[cx+x,cy+y-4],[cx+x-4,cy+y],[cx+x,cy+y+4],[cx+x+4,cy+y]],p.alive?c:'#e47e62');}}
function drawCoopHUD(){
 if(!coop?.active||state==='menu'||mapOpen)return;const w=screenW,h=screenH,s=hudScale,rows=[...coop.members.values()].sort((a,b)=>a.slot-b.slot),x=w*.73,y=h*.20,bw=w*.18;
 rect(x-8*s,y-11*s,bw+16*s,26*s+rows.length*21*s,'#0a1818b8','#647d7255');txt('LANCE / '+rows.length+' PILOTS'+(coop.host?' / HOST':''),x,y+2*s,8,'#80d6df');
 rows.forEach((r,i)=>{const p=coop.playerOf(r);if(!p)return;const yy=y+23*s+i*21*s,c=COOP_COLORS[r.slot];let total=0,max=0;for(const q of Object.values(p.components)){total+=Math.max(0,q.hp);max+=q.max}txt((r.slot+1)+' '+r.name.slice(0,12)+(r.id===coop.id?' *':''),x,yy,9,c);const status=p.alive?Math.round(total/max*100)+'%':r.revive>0?'RESTORE '+Math.floor(r.revive/6*100)+'%':'DOWN';txt(status,x+bw,yy,8,p.alive?c:'#f49473','right');});
 const l=coop.guest?coop.transport?.links.get(coop.hostId):null;txt(coop.guest?(l?.route||'LINK')+' / '+Math.round(l?.rtt||0)+' MS':coop.formattedRoom()+' / FRIENDLY FIRE OFF',x,y+22*s+rows.length*21*s,7,'#8dab9a');
 for(const r of rows){if(r.id===coop.id)continue;const p=coop.host?r.sim?.p:r.view||r.p;if(!p)continue;const d=dist2(player,p),point=project([p.x,p.y+p.altitude+23,p.z]),c=p.alive?COOP_COLORS[r.slot]:'#f49473';
  if(point&&point.x>w*.13&&point.x<w*.87&&point.y>h*.12&&point.y<h*.68){const size=5*s;poly([[point.x,point.y-size],[point.x-size,point.y],[point.x,point.y+size],[point.x+size,point.y]],null,c);txt(r.name,point.x,point.y-13*s,9,c,'center');txt((p.alive?'':'DOWN / ')+Math.round(d)+' M',point.x,point.y+16*s,8,c,'center')}
  else if(d<3000){const bearing=wrap(Math.atan2(p.x-player.x,-(p.z-player.z))-(player.yaw+player.torso)),side=bearing>0?1:-1,xx=w*(side>0?.855:.145),yy=h*(.39+r.slot*.035);txt((side<0?'‹ ':'')+(r.slot+1)+(side>0?' ›':''),xx,yy,11,c,'center')}
  if(!p.alive&&d<38&&player.alive){rect(w*.5-175*s,h*.495,350*s,36*s,'#0b1d1fe8',c);txt('STOP + HOLD ['+key('restore')+'] / RESTORE '+r.name,w*.5,h*.495+14*s,10,c,'center');rect(w*.5-170*s,h*.495+29*s,340*s*clamp((r.revive||0)/6,0,1),3*s,c)}
 }
 if(allObjectivesComplete()&&dist2(player,extraction)<extraction.r+35){const living=coop.living(),inside=living.filter(r=>{const p=coop.playerOf(r);return dist2(p,extraction)<extraction.r&&p.altitude<3&&Math.abs(p.speed)<2.2}).length;txt('LANCE AT EXTRACTION / '+inside+' OF '+living.length,w*.5,h*.53,10,'#80d6df','center')}
}
function drawHUD(){soloDrawHUD();drawCoopHUD()}

const coopRawFx=sound.fxPlay;
for(const name of ['tone','noise','say','fxPlay']){const original=sound[name];sound[name]=function(...args){if(coop?.replaying||coop?.executing&&coop.executing!==coop.id)return;return original.apply(this,args)}}
coop=new LanceCoop();

updateChassisUI();syncChoiceUI();refreshMenu();refreshSourceText();
// Compile the draw layer's pipelines now, then build the Enhanced Imaging edge lists in small idle slices.
kit.loading.progress(.9,'Starting combat systems…');
await warmUp(kit.renderer,geo.box);
{const list=[ground,scenery,...Object.values(geo)],add=parts=>{for(const p of parts)if(p.g)list.push(p.g)};
 cachedParts('longbow',longbowParts);
 for(const m of[...Object.values(playerModels),...Object.values(enemyModels)]){add(m.torso);m.arms.forEach(add);m.legs.forEach(add)}
 for(const parts of modelCache.values())add(parts);add(transportParts);prebuildEdges(list)}
kit.start(tick);
// The read-only status API is useful for performance checks and mission testing.
Object.defineProperty(window,'RobotWarrior',{value:Object.freeze({version:'5.0.0',getCoopStatus:()=>coop.status(),getStatus:()=>({state,audio:sound.soundtrack?.status()||{cue:null,playing:false},chassis,sector:missionStage,imaging:player.imaging,nightVision:player.vision,shielded:reactorShielded(),serviceUsed,serviceProgress:serviceTime,supplyUsed,supplyProgress:supplyTime,linkProgress:linkTime,linkDuration:flightLink.duration,linkStatus,linkWave,linkBlocked,responseRemaining:ridgeResponseThreats().length,gateLocked:ridgeGateLocked(),extractionProgress:extractTime,transportTime,basinDefenders:basinThreats().length,navIndex,fps:window.__kit?.fps||0,mode,arenaWave:arena.wave,backend:kit.backend,time:missionTime,position:{x:player.x,y:player.y+player.altitude,z:player.z},speed:player.speed*3.6,heat:player.heat,armor:playerArmor(),ammo:player.ammo,missiles:player.missiles,objectiveLabels:['relay','uplink','basinClear','needlePass','reactor','blackglassRidge','skyguard','flightCodes'],objectives:missionFlags.slice(),kills,score,entities:entities.map(e=>({name:e.name,type:e.type,zone:e.zone,x:e.x,z:e.z,alive:e.alive,health:entityHealth(e)}))})}),writable:false});
