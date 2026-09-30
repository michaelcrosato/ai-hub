// DATAPUNK 2078 — Blindside / The Quiet Route.
// Rendered with three.js r186 (WebGPU, WebGL2 fallback) through the shared kit in /lib/kit.
// The game's own geometry builders, twelve-light shading, wet-street reflections, bloom and
// film grade are kept: they now run as node materials (TSL), a TSL reflector and kit/post.js.
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';

const $cache=new Map();
// Element lookups are cached; an element that was replaced (re-rendered panels) is looked up again.
const $=id=>{let el=$cache.get(id);if(!el||!el.isConnected){el=document.getElementById(id);if(el)$cache.set(id,el);}return el;};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), lerp=(a,b,t)=>a+(b-a)*t;
let seed=2078;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const rr=(a,b)=>a+(b-a)*rand(), pick=a=>a[Math.floor(rand()*a.length)], TAU=Math.PI*2;
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]), mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], norm=a=>mul(a,1/(Math.hypot(...a)||1));
// Matrices from compose() and multiply() come from a scratch ring, so the hundreds built each
// frame for guards, weapons and props allocate nothing. draw() copies them at once; nothing keeps
// one past the current function. Long-lived matrices (the view-projection) pass their own `out`.
const M_RING=Array.from({length:128},()=>new Float32Array(16));let mRingAt=0;
const mScratch=()=>{const m=M_RING[mRingAt];mRingAt=(mRingAt+1)&127;return m;};
const M={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 multiply:(a,b,o=mScratch())=>{for(let c=0;c<4;c++){const b0=b[c*4],b1=b[c*4+1],b2=b[c*4+2],b3=b[c*4+3];for(let r=0;r<4;r++)o[c*4+r]=a[r]*b0+a[4+r]*b1+a[8+r]*b2+a[12+r]*b3;}return o;},
 perspective:(fov,aspect,near,far,o=new Float32Array(16))=>{const f=1/Math.tan(fov/2),nf=1/(near-far);o.set([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);return o;},
 look:(eye,target,up=[0,1,0],o=new Float32Array(16))=>{const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);o.set([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);return o;},
 compose:(x,y,z,ry=0,rx=0,rz=0,sx=1,sy=1,sz=1)=>{const cy=Math.cos(ry),syy=Math.sin(ry),cx=Math.cos(rx),sxx=Math.sin(rx),cz=Math.cos(rz),szz=Math.sin(rz),o=mScratch();
  o[0]=(cy*cz+syy*sxx*szz)*sx;o[1]=cx*szz*sx;o[2]=(-syy*cz+cy*sxx*szz)*sx;o[3]=0;o[4]=(-cy*szz+syy*sxx*cz)*sy;o[5]=cx*cz*sy;o[6]=(syy*szz+cy*sxx*cz)*sy;o[7]=0;o[8]=syy*cx*sz;o[9]=-sxx*sz;o[10]=cy*cx*sz;o[11]=0;o[12]=x;o[13]=y;o[14]=z;o[15]=1;return o;},
 point:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
 dir:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]]
};
// Colours are parsed once. The arrays are shared: callers read them and never write into them.
const hexCache=new Map();
const hex=h=>{if(Array.isArray(h))return h;let v=hexCache.get(h);if(!v){const n=typeof h==='number'?h:parseInt(h.replace('#',''),16);v=[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];hexCache.set(h,v);}return v;};
const ERR=[];addEventListener('error',e=>{ERR.push(e.message);console.error('Datapunk:',e.message);});

// ---------------------------------------------------------------------------------------------
// Boot: the shared kit starts the renderer (WebGPU, WebGL2 fallback), input, touch and settings.
// The original wrote linear colour straight to the canvas, so colour management stays off.
// ---------------------------------------------------------------------------------------------
THREE.ColorManagement.enabled=false;
const INPUT={
 move:{type:'vector',keys:'wasd+arrows',gamepad:'leftStick',touch:'stick'},
 look:{type:'look',mouse:'drag',gamepad:'rightStick',touch:'drag'},
 // Touch cluster, in order: the first is the big button.
 fire:{mouse:[0],gamepad:['RT'],touch:'Fire'},
 jump:{keys:['Space'],gamepad:['A'],touch:'Jump'},
 crouch:{keys:['KeyC'],gamepad:['B'],touch:'Crouch'},
 dash:{keys:['ControlLeft'],gamepad:['RB'],touch:'Dash'},
 scanToggle:{keys:['CapsLock'],touch:'Scan'},
 interact:{keys:['KeyF'],gamepad:['X'],touch:'Use'},
 // Top-row touch pills, left to right (Reload, Bolt and Carry only show when they apply).
 pause:{keys:['Escape','KeyP'],gamepad:['Start'],touch:{label:'II',slot:'top'}},
 inventory:{keys:['KeyI'],gamepad:['Back'],touch:{label:'Menu',slot:'top'}},
 weapon:{keys:['AltLeft','AltRight'],gamepad:['Y'],touch:{label:'Weapon',slot:'top'}},
 reload:{keys:['KeyR'],touch:{label:'Reload',slot:'top'}},
 heal:{keys:['KeyX'],gamepad:['Up'],touch:{label:'Heal',slot:'top'}},
 emp:{keys:['KeyG'],mouse:[1],gamepad:['Right'],touch:{label:'EMP',slot:'top'}},
 bolt:{keys:['KeyZ'],gamepad:['Left'],touch:{label:'Bolt',slot:'top'}},
 carry:{keys:['KeyH'],touch:{label:'Carry',slot:'top'}},
 // Keyboard / mouse / gamepad only.
 aim:{keys:['KeyK'],mouse:[2],gamepad:['LT']},
 scan:{keys:['Tab'],gamepad:['LB']},
 crouchHold:{keys:['ControlRight']},
 sprint:{keys:['ShiftLeft'],gamepad:['LS']},
 sprintHold:{keys:['ShiftRight']},
 overclock:{keys:['KeyE'],gamepad:['Down']},
 melee:{keys:['KeyQ'],gamepad:['RS']},
 inspect:{keys:['KeyB']},
 journal:{keys:['KeyJ']},map:{keys:['KeyM']},contact:{keys:['KeyT']},call:{keys:['KeyV']},
 quickSave:{keys:['F5']},quickLoad:{keys:['F8']},
 // Menus and conversations.
 back:{keys:['Escape'],gamepad:['B']},
 confirm:{keys:['Enter','NumpadEnter'],gamepad:['A']},
 transcript:{keys:['KeyL'],gamepad:['Y']},
 tabPrev:{gamepad:['LB']},tabNext:{gamepad:['RB']}
};
for(let i=1;i<=9;i++)INPUT['num'+i]={keys:['Digit'+i,'Numpad'+i]};
const kit=await boot({
 title:'DATAPUNK 2078',
 canvas:document.getElementById('world'),
 accent:'#e5ff47',background:'#090e16',
 gear:'none', // the game's pause and settings menus open the shared panel (F9 too)
 touch:{top:'center',topOffset:8},
 input:INPUT
});
const input=kit.input,renderer=kit.renderer,canvas=kit.canvas;
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
// The weapon layer clears to transparent so it can be laid over the world in the post chain.
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
scene.background=new THREE.Color(.033,.052,.079);
const viewScene=new THREE.Scene(); // first-person weapon, hands and scanner outlines
const camera=kit.fitCamera(new THREE.PerspectiveCamera(80,1,.045,240));
let proj,view,VP;const PROJ_BUF=new Float32Array(16),VIEW_BUF=new Float32Array(16),VP_BUF=new Float32Array(16);

// Shared shader inputs. Lights, time and the scanner grade are the same for every object.
const G={time:TSL.uniform(0).setGroup(TSL.renderGroup),scan:TSL.uniform(0).setGroup(TSL.renderGroup),hurt:TSL.uniform(0).setGroup(TSL.renderGroup),lightPos:[],lightCol:[]};
for(let i=0;i<12;i++){G.lightPos.push(TSL.uniform(new THREE.Vector4(0,0,0,.01)).setGroup(TSL.renderGroup));G.lightCol.push(TSL.uniform(new THREE.Vector3()).setGroup(TSL.renderGroup));}
// Per-object tint, alpha and weapon flash (the old uTint / uAlpha / uFlash) come from userData.
const ONE_V3=new THREE.Vector3(1,1,1); // shared default; never written
const objTint=TSL.uniform(new THREE.Vector3(1,1,1)).onObjectUpdate(({object})=>object.userData.tint||ONE_V3);
const objAlpha=TSL.uniform(1).onObjectUpdate(({object})=>object.userData.alpha??1);
const objFlash=TSL.uniform(0).onObjectUpdate(({object})=>object.userData.flash||0);

const defaults={sprintToggle:true,volume:.65,sensitivity:.65,difficulty:'OPERATOR',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
const storage={get(k){try{return JSON.parse(localStorage.getItem('datapunk2078-'+k));}catch{return null;}},set(k,v){try{localStorage.setItem('datapunk2078-'+k,JSON.stringify(v));}catch{}},remove(k){try{localStorage.removeItem('datapunk2078-'+k);}catch{}}};
let settings={...defaults,...storage.get('settings')};delete settings.quality; // graphics quality now lives in the shared settings panel
if(!['STORY','OPERATOR','HARDCORE'].includes(settings.difficulty))settings.difficulty='OPERATOR';
// Difficulty: incoming damage, guard fire rate and how fast guards recognise the player.
const DIFF={STORY:{damage:.55,fire:1.18,detect:.85,armor:75},OPERATOR:{damage:1,fire:1,detect:1,armor:50},HARDCORE:{damage:1.35,fire:.86,detect:1.22,armor:35}};
const diff=()=>DIFF[settings.difficulty]||DIFF.OPERATOR;
// HUD writes only touch the DOM when a value changes.
const _hudCache=new Map();
function setText(id,v){v=String(v);if(_hudCache.get(id)!==v){_hudCache.set(id,v);const el=$(id);if(el)el.textContent=v;}}
function setHTML(id,v){const k='<'+id;if(_hudCache.get(k)!==v){_hudCache.set(k,v);const el=$(id);if(el)el.innerHTML=v;}}
function setStyle(id,prop,v){const k=id+'|'+prop;v=String(v);if(_hudCache.get(k)!==v){_hudCache.set(k,v);const el=$(id);if(el)el.style[prop]=v;}}
// Button prompts follow the device in use: keyboard + mouse, controller or touch.
const PROMPT={
 keyboard:{interact:'F',heal:'X',emp:'MMB',scan:'TAB',scanToggle:'CAPS',overclock:'E',reload:'R',weapon:'ALT',carry:'H',bolt:'Z',inventory:'I',journal:'J',map:'M',contact:'T',call:'V',jump:'SPACE',crouch:'C',dash:'CTRL',sprint:'SHIFT',fire:'LMB',aim:'RMB',melee:'Q',tag:'MMB',upload:'F',details:'Z',select:'WHEEL',pause:'ESC',lethal:'F',nonlethal:'R',release:'ESC',holster:'ALT ×2',back:'ESC',transcript:'L'},
 gamepad:{interact:'X',heal:'D-PAD ↑',emp:'D-PAD →',scan:'LB',scanToggle:'LB',overclock:'D-PAD ↓',reload:'X',weapon:'Y',carry:'R3',bolt:'D-PAD ←',inventory:'VIEW',journal:'VIEW',map:'VIEW',contact:'VIEW',call:'VIEW › CONTACT',jump:'A',crouch:'B',dash:'RB',sprint:'L3',fire:'RT',aim:'LT',melee:'R3',tag:'D-PAD →',upload:'X',details:'D-PAD ←',select:'Y',pause:'MENU',lethal:'X',nonlethal:'A',release:'B',holster:'Y ×2',back:'B',transcript:'Y'},
 touch:{interact:'USE',heal:'HEAL',emp:'EMP',scan:'SCAN',scanToggle:'SCAN',overclock:'OC',reload:'RELOAD',weapon:'WEAPON',carry:'CARRY',bolt:'BOLT',inventory:'MENU',journal:'MENU',map:'MENU',contact:'MENU',call:'MENU › CONTACT',jump:'JUMP',crouch:'CROUCH',dash:'DASH',sprint:'PUSH THE STICK',fire:'FIRE',aim:'AIM',melee:'FIRE',tag:'TAG',upload:'UPLOAD',details:'DETAILS',select:'HACK ›',pause:'II',lethal:'LETHAL',nonlethal:'NONLETHAL',release:'RELEASE',holster:'WEAPON ×2',back:'✕',transcript:'TRANSCRIPT'}
};
function pk(a){return (PROMPT[input.source]||PROMPT.keyboard)[a]||String(a).toUpperCase();}
// Story text names PC keys; on a controller or touch screen they are swapped for that device's.
const KEY_TEXT=[[/During a talk, use the mouse or 1–9 to choose\. Use Up\/Down and F to confirm\. L opens the transcript\. Esc leaves\./g,()=>input.source==='touch'?'During a talk, tap a choice. TRANSCRIPT and STEP AWAY are at the top.':'During a talk, use the D-pad or left stick to choose and A to confirm. Y opens the transcript. B leaves.'],
 [/then F for a lethal strike or R for a nonlethal strike/g,()=>'then '+pk('lethal')+' for a lethal strike or '+pk('nonlethal')+' for a nonlethal strike'],[/Press the middle mouse button to tag the target/g,()=>'Press '+pk('tag')+' to tag the target'],[/Use the wheel to select a quickhack/g,()=>'Use '+pk('select')+' to select a quickhack'],[/USE THE WHEEL TO CHANGE WEAPON/g,()=>'PRESS '+pk('weapon')+' TO CHANGE WEAPON'],[/\bWHEEL TO SELECT\b/g,()=>pk('select')+' TO SELECT'],[/\bF TO UPLOAD\b/g,()=>pk('upload')+' TO UPLOAD'],[/\bRelease Tab\b/g,()=>input.source==='touch'?'Close the scanner':'Release '+pk('scan')],[/\b(Use|use) ([FZH]) to\b/g,(m,w,k)=>(input.source==='touch'?'Tap':w)+' '+pk(k==='F'?'interact':k==='Z'?'bolt':'carry')+' to'],[/\b(Use|use) F\b/g,(m,w)=>(input.source==='touch'?'Tap':w)+' '+pk('interact')],
 [/\b(Press|press|Hold|hold|PRESS|HOLD) F\b/g,(m,w)=>w+' '+pk('interact')],[/\[F\]/g,()=>'['+pk('interact')+']'],[/\bF \/ TAKE/g,()=>pk('interact')+' / TAKE'],[/\b(Hold|HOLD) (Tab|TAB)\b/g,(m,w)=>input.source==='touch'?(w==='HOLD'?'TAP ':'Tap ')+pk('scan'):w+' '+pk('scan')],[/\bPress V\b/g,()=>'Press '+pk('call')],[/\bTAB \+ MIDDLE MOUSE\b/g,()=>pk('scan')+' + '+pk('tag')],[/\bTAB \/ SCAN\b/g,()=>pk('scan')+' / SCAN'],[/\bZ (THROWS|\/)/g,(m,w)=>pk('bolt')+' '+w],[/\bH (\/|TO)/g,(m,w)=>pk('carry')+' '+w],[/\[H\]/g,()=>'['+pk('carry')+']'],[/Double-tap Alt/g,()=>'Double-tap '+pk('weapon')],[/\bI \/ CHARACTER/g,()=>pk('inventory')+' / CHARACTER'],[/\bJ \/ EVIDENCE/g,()=>pk('journal')+' / EVIDENCE'],[/\bM \/ (ROUTE|MAP)/g,(m,w)=>pk('map')+' / '+w],[/\bC \/ CROUCH/g,()=>pk('crouch')+' / CROUCH'],[/\[I\]/g,()=>'['+pk('inventory')+']'],[/\[J\]/g,()=>'['+pk('journal')+']']];
function keyText(t){if(typeof t!=='string'||input.source==='keyboard')return t;for(const [re,fn] of KEY_TEXT)t=t.replace(re,fn);return t;}

// Texture atlas: every sign is drawn locally, then uploaded once.
const ATLAS_H=3072; // 12 rows of 4 signs
const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=ATLAS_H;const ac=atlas.getContext('2d');ac.fillStyle='#ffffff';ac.fillRect(0,0,2048,ATLAS_H);let atlasIndex=0;
function signTexture(title,subline='',color='#5ce3eb',style='normal'){const col=atlasIndex%4,row=Math.floor(atlasIndex/4);atlasIndex++;const x=col*512,y=row*256;ac.save();ac.translate(x,y);ac.fillStyle=style==='yellow'?'#d6e332':style==='red'?'#a31a38':'#07151d';ac.fillRect(0,0,512,256);ac.fillStyle=style==='yellow'?'#17281e':color;ac.strokeStyle=ac.fillStyle;ac.lineWidth=3;
 if(style==='poster'){const grd=ac.createLinearGradient(0,0,512,256);grd.addColorStop(0,'#031c34');grd.addColorStop(1,'#692341');ac.fillStyle=grd;ac.fillRect(0,0,512,256);ac.strokeStyle=color;ac.lineWidth=2;for(let i=0;i<12;i++){ac.beginPath();ac.arc(385,132,22+i*8,0,TAU);ac.stroke();}ac.fillStyle=color;ac.font='bold 51px Arial';ac.fillText(title,23,90);ac.font='bold 23px Arial';ac.fillText(subline,25,138);ac.font='12px monospace';ac.fillText('UPGRADE THE HUMAN CONDITION',25,218);}
 else if(style==='vertical'){ac.font='900 107px Arial';ac.textAlign='center';ac.fillText(title,256,146);ac.font='23px monospace';ac.fillText(subline,256,212);}
 else{ac.strokeRect(9,9,494,238);ac.font=`900 ${title.length>13?42:title.length>10?50:title.length>8?60:74}px Arial`;ac.textAlign='center';ac.textBaseline='middle';ac.fillText(title,256,108,470);ac.globalAlpha=.82;ac.font='20px monospace';ac.fillText(subline,256,186,456);ac.globalAlpha=1;ac.fillRect(23,27,46,5);ac.fillRect(443,225,46,5);}
 ac.fillStyle='rgba(0,0,0,.13)';for(let yy=0;yy<256;yy+=4)ac.fillRect(0,yy,512,1);ac.restore();return[(x+2)/2048,(y+2)/ATLAS_H,(x+510)/2048,(y+254)/ATLAS_H];}
const signs={mercy:signTexture('MERCY STREET','SOUTH APPROACH / NO ONE FORGOTTEN','#79d5de'),clinic:signTexture('NIGHT CARE','TREATMENT IS NOT OWNERSHIP','#a9f4ce'),laundry:signTexture('LAST WASH','CLEAN CLOTHES / DIRTY CITY','#f28ac3'),transit:signTexture('NIGHT LINE','SERVICE SUSPENDED / 03:17','#baf5c5'),checkpoint:signTexture('NULL MARKET','VISITOR ACCESS / REPORT TO VALE','#f7c084'),visitor:signTexture('SPEAK TO VALE','A GATE IS NOT A RIGHT','#f3bd82'),archive:signTexture('COLD ARCHIVE','NEURAL STORAGE / SUBLEVEL 07','#ff6674'),coolant:signTexture('COOLANT','CORE LOCK // HOLD [F]','#85e9df'),archiveExit:signTexture('RELAY 06','EXIT / MARKET →','#cfe6a2'),null:signTexture('NULL MARKET','NIGHT SHIFT // ALWAYS OPEN','#e5ff47','yellow'),noodle:signTexture('NOODLE.EXE','HOT FOOD · COLD CITY','#ff715f'),splice:signTexture('SPLICE','BODY REPAIR / 24H','#76f4dc'),vanta:signTexture('VANTA','YOUR MEMORY. OUR BUSINESS.','#fc7be4'),relay:signTexture('RELAY 06','AUTHORIZED PERSONNEL ONLY','#5ce3eb'),koi:signTexture('KOI / 08','BAR · AUDIO · AFTERHOURS','#ff5e9d'),hot:signTexture('EAT','SLEEP // REPEAT','#ff8061','vertical'),open:signTexture('24 H','NEVER LOG OFF','#5ce3eb','vertical'),code:signTexture('SOFT RESET','FORGET SOMETHING TONIGHT','#f591e3','poster'),poster:signTexture('BECOME','MORE THAN HUMAN','#67eae8','poster'),pawn:signTexture('SECOND LIFE','BUY · SELL · REPLACE','#b0ff8d'),warning:signTexture('RESTRICTED','VANTA SECURITY // 06','#ffbe62'),access:signTexture('ACCESS','LOCAL LINK // [F]','#75ecdd'),ramen:signTexture('RAMEN','FRESH / SYNTHETIC / 08','#e7ff64'),exit:signTexture('GETAWAY','MARA / SECURE EXTRACTION','#5ce3eb'),core:signTexture('GHOST SIGNAL','MEMORY CORE // 98.4 TB','#91e5ff'),advert:signTexture('SYNTHETIC','GOOD TASTE. NO GUILT.','#fe9aa4','poster'),tower:signTexture('NOVA','A BETTER TOMORROW™','#bd8af7'),garage:signTexture('03 / GARAGE','NO QUESTIONS ASKED','#ffae58'),police:signTexture('SECURITY','KEEP YOUR HANDS VISIBLE','#ff6b7b'),arrow:signTexture('06 →','MARKET / RELAY ACCESS','#e5ff47'),food:signTexture('MIDNIGHT','STREET FOOD / 24:7','#ffb678')};
Object.assign(signs,{service:signTexture('SERVICE C7','BLINDSIDE / KEEP THE BLUE LINE LIVE','#8fd1c1'),quiet:signTexture('DRAIN ACCESS','CROUCH / NO CAMERA COVERAGE','#aad8b7'),works:signTexture('SWITCHWORKS','LIVE PLANT / WATCH THE PATROL','#f0bd73'),pump:signTexture('PUMP GALLERY','C7 / SENSOR TEST / ARCHIVE REAR','#88d8d4'),bridge:signTexture('SENSOR BRIDGE','DRY CONTACT / CLINIC FEED SAFE','#a7f0c9'),hatch:signTexture('ARCHIVE REAR','LOW CLEARANCE / CROUCH TO ENTER','#b6e1c0'),locker:signTexture('SERVICE LOCKER','BODY STORAGE / NONLETHAL SAFE','#89b9c4')});
kit.loading.progress(.66,'Painting Mercy Street…');await new Promise(r=>setTimeout(r,0));
// The sign atlas is uploaded once, with mipmaps, exactly as drawn (no vertical flip).
const atlasTex=new THREE.CanvasTexture(atlas);atlasTex.flipY=false;atlasTex.colorSpace=THREE.NoColorSpace;atlasTex.generateMipmaps=true;atlasTex.minFilter=THREE.LinearMipmapLinearFilter;atlasTex.magFilter=THREE.LinearFilter;atlasTex.anisotropy=8;

// ---------------------------------------------------------------------------------------------
// Materials: the original world shader, rebuilt with TSL node materials.
//   base colour (vertex colour × sign atlas or concrete grain) · ambient + sky light · the twelve
//   nearest point lights with specular · emission · per-object tint and flash · exponential fog ·
//   the red scanner grade. The wet floor adds a planar reflection, seams, grit and rain glints.
// ---------------------------------------------------------------------------------------------
const hash2=p=>TSL.fract(TSL.sin(TSL.dot(p,TSL.vec2(127.1,311.7))).mul(43758.5453));
const vnoise=TSL.Fn(([p])=>{const i=TSL.floor(p),f=TSL.fract(p),u=f.mul(f).mul(f.mul(-2).add(3));return TSL.mix(TSL.mix(hash2(i),hash2(i.add(TSL.vec2(1,0))),u.x),TSL.mix(hash2(i.add(TSL.vec2(0,1))),hash2(i.add(TSL.vec2(1,1))),u.x),u.y);});
function shadeNode({floor=false,reflection=null}={}){
 const {Fn,vec3,vec4,float,mix,smoothstep,step,max:tmax,pow:tpow,dot:tdot,length:tlen,abs:tabs,fract,sin,exp,positionWorld:wp,cameraPosition}=TSL;
 const worldNormal=TSL.varying(TSL.modelWorldMatrix.mul(vec4(TSL.normalLocal,0)).xyz);
 return Fn(()=>{
  const n=worldNormal.normalize();
  const col0=TSL.attribute('color','vec3'),matA=TSL.attribute('surface','vec2'),emission=matA.x,typ=matA.y;
  let base=col0;
  if(!floor){
   const tex=TSL.texture(atlasTex,TSL.uv());
   const grain=vnoise(wp.xz.mul(29).add(wp.y.mul(7)));
   base=col0.mul(mix(vec3(grain.mul(.2).add(.87)),tex.rgb,step(.5,typ)));
  }
  const illum=vec3(.28,.33,.42).add(vec3(.32,.39,.47).mul(tmax(tdot(n,vec3(-.3,1,.2).normalize()),0))).toVar();
  const spec=vec3(0).toVar();
  const eyeDir=cameraPosition.sub(wp).normalize();
  for(let i=0;i<12;i++){
   const L=G.lightPos[i],C=G.lightCol[i];
   const d=L.xyz.sub(wp),len=tlen(d),l=d.div(tmax(len,.001));
   const atten=tpow(tmax(float(1).sub(len.div(L.w)),0),2);
   illum.addAssign(C.mul(atten).mul(tmax(tdot(n,l),0).mul(1.65).add(.16)));
   const h=l.add(eyeDir).normalize();
   spec.addAssign(C.mul(tpow(tmax(tdot(n,h),0),44)).mul(atten).mul(.2));
  }
  const col=vec3(0).toVar();
  if(!floor)col.assign(base.mul(illum).add(spec).add(base.mul(emission)));
  else{
   const q=wp.xz,patch=vnoise(q.mul(.29)),grit=vnoise(q.mul(52));
   const grid=tabs(fract(q.mul(TSL.vec2(.33,.58))).sub(.5));
   const seam=smoothstep(.47,.495,tmax(grid.x,grid.y));
   col.assign(base.mul(illum).mul(grit.mul(.2).add(.53)).mul(seam.mul(-.36).add(1)));
   if(reflection){
    const fres=tpow(float(1).sub(tmax(tdot(n,eyeDir),0)),2);
    const wet=mix(float(.10),float(.36),smoothstep(.28,.65,patch));
    col.assign(mix(col,reflection.rgb,TSL.clamp(wet.add(fres.mul(.23)),0,.84)));
   }
   col.addAssign(spec.mul(.9));
   const d1=vnoise(q.mul(12));
   col.addAssign(tpow(tmax(sin(d1.add(G.time.mul(.8)).mul(70)),0),32).mul(.015));
  }
  col.mulAssign(objTint);
  col.addAssign(vec3(.30,.22,.11).mul(objFlash));
  const fog=float(1).sub(exp(tlen(cameraPosition.sub(wp)).mul(-.012)));
  col.assign(mix(col,vec3(.033,.052,.079),TSL.clamp(fog,0,.98)));
  const gray=tdot(col,vec3(.299,.587,.114));
  col.assign(mix(col,mix(vec3(gray.mul(.9),gray.mul(.72),gray.mul(.73)),col,.24),G.scan.mul(.78)));
  return vec4(col,objAlpha);
 })();
}
// The original never culled faces, so every material is double-sided.
const worldMat=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,fog:false});worldMat.colorNode=shadeNode();
// Scanner outlines: flat colour, blended, seen through walls (they live in the weapon layer).
const outlineMat=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,fog:false,transparent:true,depthWrite:false});outlineMat.colorNode=TSL.vec4(objTint,objAlpha);
// Planar reflection of the street in the wet asphalt (half resolution; off on the low tier, as the old LOW preset did).
const reflection=TSL.reflector({resolutionScale:.5,bounces:false});
reflection.target.rotateX(-Math.PI/2);scene.add(reflection.target);
{const q=TSL.positionWorld.xz,patch=vnoise(q.mul(.29));
 reflection.uvNode=reflection.uvNode.add(TSL.vec2(TSL.sin(q.y.mul(19).add(q.x.mul(9)).add(G.time.mul(1.5))),TSL.cos(q.x.mul(23).sub(q.y.mul(8)).add(G.time))).mul(TSL.mix(TSL.float(.00012),TSL.float(.00072),patch)));}
const floorMatWet=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,fog:false});floorMatWet.colorNode=shadeNode({floor:true,reflection});
const floorMatDry=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,fog:false});floorMatDry.colorNode=shadeNode({floor:true});

// ---------------------------------------------------------------------------------------------
// Geometry: the original batch builders, writing into a growable Float32Array.
// Layout per vertex: position 3, normal 3, colour 3, uv 2, surface 2 (emission, type).
// ---------------------------------------------------------------------------------------------
const UV0=[0,0];
function geometryFrom(data,count,index=null){
 const pos=new Float32Array(count*3),nor=new Float32Array(count*3),col=new Float32Array(count*3),uvs=new Float32Array(count*2),mat=new Float32Array(count*2);
 for(let i=0;i<count;i++){const s=(index?index[i]:i)*13,a=i*3,b=i*2;pos[a]=data[s];pos[a+1]=data[s+1];pos[a+2]=data[s+2];nor[a]=data[s+3];nor[a+1]=data[s+4];nor[a+2]=data[s+5];col[a]=data[s+6];col[a+1]=data[s+7];col[a+2]=data[s+8];uvs[b]=data[s+9];uvs[b+1]=data[s+10];mat[b]=data[s+11];mat[b+1]=data[s+12];}
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setAttribute('surface',new THREE.BufferAttribute(mat,2));
 g.computeBoundingSphere();return g;
}
class Batch{
 constructor(){this.data=new Float32Array(13*384);this.n=0;this.count=0;this.geometry=null;this.pools=[];}
 vert(p,n,c,uv=UV0,em=0,type=0){let d=this.data;const o=this.n*13;if(o+13>d.length){const g=new Float32Array(d.length*2);g.set(d);this.data=d=g;}const k=hex(c);d[o]=p[0];d[o+1]=p[1];d[o+2]=p[2];d[o+3]=n[0];d[o+4]=n[1];d[o+5]=n[2];d[o+6]=k[0];d[o+7]=k[1];d[o+8]=k[2];d[o+9]=uv[0];d[o+10]=uv[1];d[o+11]=em;d[o+12]=type;this.n++;}
 quad(a,b,c,d,col,em=0,type=0,uv=null){const n=norm(cross(sub(b,a),sub(c,a)));const u=uv?[[uv[0],uv[3]],[uv[2],uv[3]],[uv[2],uv[1]],[uv[0],uv[1]]]:[[0,0],[1,0],[1,1],[0,1]];const ps=[a,b,c,d];for(const i of [0,1,2,0,2,3])this.vert(ps[i],n,col,u[i],em,type);}
 box(x,y,z,w,h,d,col,em=0,rot=0){const mat=M.compose(x,y,z,rot);const p=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]].map(v=>M.point(mat,v));for(const f of [[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[3,7,6,2],[0,1,5,4]])this.quad(...f.map(i=>p[i]),col,em);}
 cylinder(x,y,z,r,h,col,em=0,sides=10,rTop=r){for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides;const p=[x+Math.sin(a)*r,y-h/2,z+Math.cos(a)*r],q=[x+Math.sin(b)*r,y-h/2,z+Math.cos(b)*r],s=[x+Math.sin(b)*rTop,y+h/2,z+Math.cos(b)*rTop],t=[x+Math.sin(a)*rTop,y+h/2,z+Math.cos(a)*rTop];this.quad(q,p,t,s,col,em);this.quad([x,y+h/2,z],s,t,[x,y+h/2,z],col,em);}}
 beam(a,b,r,col,em=0){const d=sub(b,a),n=norm(d),right=norm(cross(n,Math.abs(n[1])>.98?[1,0,0]:[0,1,0])),up=cross(right,n);const p=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([u,v])=>add(a,add(mul(right,r*u),mul(up,r*v))));const q=p.map(v=>add(v,d));for(let i=0;i<4;i++)this.quad(p[i],p[(i+1)%4],q[(i+1)%4],q[i],col,em);}
 sign(x,y,z,w,h,uv,rot=0,col='#ffffff',em=1.2){const m=M.compose(x,y,z,rot),p=[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]].map(v=>M.point(m,v));this.quad(...p,col,em,1,uv);}
 upload(){this.count=this.n;this.geometry=geometryFrom(this.data,this.n);this.data=null;return this;}
 // Static scenery is split into spatial chunks so frustum culling can skip what is out of view
 // (the main view and the reflection both benefit). Returns the chunk geometries.
 uploadChunks(size=24){const tris=this.n/3,bins=new Map();
  for(let t=0;t<tris;t++){const s=t*39,d=this.data,cx=(d[s]+d[s+13]+d[s+26])/3,cz=(d[s+2]+d[s+15]+d[s+28])/3;const bx=cx<-20?0:cx<-9.9?1:cx<=9.9?2:cx<=20?3:4;const key=bx*1000+Math.floor(cz/size)+500;let b=bins.get(key);if(!b){b=[];bins.set(key,b);}b.push(t);}
  const out=[];for(const list of bins.values()){const idx=new Uint32Array(list.length*3);for(let i=0;i<list.length;i++){const t=list[i]*3;idx[i*3]=t;idx[i*3+1]=t+1;idx[i*3+2]=t+2;}out.push(geometryFrom(this.data,idx.length,idx));}
  this.count=this.n;this.data=null;return out;}
}
// ---------------------------------------------------------------------------------------------
// Drawing. The game still says draw(batch, matrix, tint, alpha) every frame; each batch keeps a
// pool of meshes per layer, reused frame to frame, and whatever is not drawn is hidden.
// Layer 0: the world. 1: first-person weapon. 2: scanner outlines (over everything but the weapon).
// ---------------------------------------------------------------------------------------------
let drawLayer=0,drawFlash=0;const drawPools=[];
function draw(batch,model=IDENTITY,tint=null,alpha=1){if(!batch||!batch.count)return;const layer=drawLayer;let pool=batch.pools[layer];
 if(!pool){pool=batch.pools[layer]={meshes:[],used:0};drawPools.push(pool);}
 let m=pool.meshes[pool.used];
 if(!m){m=new THREE.Mesh(batch.geometry,layer===2?outlineMat:worldMat);m.matrixAutoUpdate=false;m.matrixWorldAutoUpdate=false;m.userData.tint=new THREE.Vector3(1,1,1);m.userData.alpha=1;m.userData.flash=0;if(layer===2)m.renderOrder=2;(layer===0?scene:viewScene).add(m);pool.meshes.push(m);}
 pool.used++;m.visible=true;m.matrixWorld.fromArray(model);
 if(tint)m.userData.tint.set(tint[0],tint[1],tint[2]);else m.userData.tint.set(1,1,1);m.userData.alpha=alpha;m.userData.flash=drawFlash;}
function beginDraw(){for(const p of drawPools)p.used=0;}
function endDraw(){for(const p of drawPools)for(let i=p.used;i<p.meshes.length;i++)p.meshes[i].visible=false;}
// Static scenery: one mesh per chunk, never moved.
function addStatic(geometries,material=worldMat){const out=[];for(const g of geometries){const m=new THREE.Mesh(g,material);m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);out.push(m);}return out;}
const IDENTITY=M.identity(),world=new Batch(),floorBatch=new Batch();
const colliders=[],lights=[];function wallBox(x,y,z,w,h,d,col,collision=true,rot=0){world.box(x,y,z,w,h,d,col,0,rot);if(collision)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y-h/2,maxY:y+h/2});}
function light(x,y,z,color,range=15,power=1){lights.push({p:[x,y,z,range],c:hex(color).map(c=>c*power)});}
function neonBox(x,y,z,w,h,d,color){world.box(x,y,z,w,h,d,color,1.5);}
// One continuous district, with no loading screens between mission stages.
floorBatch.quad([-90,0,-140],[-90,0,65],[90,0,65],[90,0,-140],'#263137',0,2);floorBatch.upload();
const floorMesh=addStatic([floorBatch.geometry],floorMatWet)[0];
function applyReflectionTier(t){floorMesh.material=t.name==='low'?floorMatDry:floorMatWet;reflection.reflector.resolutionScale=t.name==='medium'?.35:.5;}
applyReflectionTier(kit.tier);kit.onQuality(applyReflectionTier);
// Street boundaries and raised walkways.
for(const s of [-1,1]){wallBox(s*10.4,.12,-12,1.0,.24,69,'#3d4446',false);for(let z=21;z>-48;z-=3){world.box(s*9.65,.018,z,.12,.022,1.45,'#7d8056');world.box(s*10.05,.14,z,1,.04,.07,'#6e7070');}}
// The former south wall is now the Mercy Street approach.
wallBox(-6.05,2.4,-51,7.7,4.8,7,'#192c36');wallBox(-9.1,13.4,-51,13.8,17.2,7,'#192c36');wallBox(9.1,11,-51,13.8,22,7,'#192c36');wallBox(0,12.8,-51,4.4,18.4,7,'#192c36');
for(const side of [-1,1]){
 for(let block=0;block<3;block++){
  const z=1-block*21,h=rr(19,28),x=side*15.4,w=10.7,d=19;
  if(side>0)wallBox(x,h/2,z,w,h,d,pick(['#243440','#2f3c44','#263b45']));else wallBox(x,(h+5.3)/2,z,w,h-5.3,d,pick(['#243440','#2f3c44','#263b45']));
  const fx=side*9.98;
  // Concrete floor bands, seams, bays, cables, balconies and air units.
  for(let yy=4;yy<h;yy+=3.25){world.box(fx,yy,z,.42,.27,d+1,'#182a34');world.box(fx-side*.22,yy+.28,z,.08,.08,d,'#5f6d72');
   for(let zz=z-d/2+1.3;zz<z+d/2-.7;zz+=2.65){const lit=rand()>.35,c=pick(['#3a6c78','#77a29f','#bc8d62','#4e718f','#524968']);world.box(fx-side*.08,yy+1.40,zz,.12,1.63,1.40,lit?c:'#0d1e2b',lit?.23:0);world.box(fx-side*.17,yy+1.42,zz,.1,1.65,.045,'#17262e');world.box(fx-side*.20,yy+1.39,zz,.1,.065,1.47,'#162630');
    if(rand()>.65){world.box(fx-side*.42,yy+.47,zz,.88,.36,1.95,'#1d303a');world.box(fx-side*.93,yy+.90,zz,.06,.72,1.90,'#50656b');for(let bz=-.7;bz<=.7;bz+=.35)world.box(fx-side*.93,yy+.7,zz+bz,.08,.58,.035,'#567078');}
    if(rand()>.78){world.box(fx-side*.36,yy+1.4,zz+.9,.65,.67,.55,'#59656b');for(let a=-.2;a<.25;a+=.1)world.box(fx-side*.70,yy+1.4+a,zz+.9,.02,.03,.46,'#172c37');}
   }
  }
  for(let zz=z-d/2+.2;zz<z+d/2;zz+=6.2){world.box(fx-side*.18,h/2,zz,.25,h,.23,'#58636c');world.box(fx-side*.37,3.3,zz,.24,.35,.65,'#0d1c26');}
  // Ground-floor shutter bays.
  for(let zz=z-7;zz<=z+7;zz+=4.5){world.box(fx-side*.15,1.75,zz,.15,3.05,3.9,'#10202b');for(let y=.45;y<3.15;y+=.17)world.box(fx-side*.24,y,zz,.06,.028,3.7,'#364750');}
  // Rooftop machinery and aerials.
  world.box(x,h+.35,z,11.3,.45,19.5,'#1d3039');world.box(x,h+1.5,z+4,4,2.3,4,'#34464e');world.cylinder(x-1,h+2.7,z-3,1.5,4,'#233d49',0,12);world.beam([x,h,z-3],[x,h+8,z-3],.04,'#7c9fa3');world.beam([x-1,h+6,z-3],[x+1,h+6,z-3],.025,'#849ca8');
 }
}
// Towers frame the city above the narrow market.
for(let i=0;i<26;i++){
 const s=i%2?-1:1,x=s*rr(23,68),z=rr(-97,25),w=rr(5,12),d=rr(5,12),h=rr(28,77);world.box(x,h/2,z,w,h,d,pick(['#142636','#1b283b','#212e43','#172b38']));world.box(x,h+1.1,z,w*.7,2.2,d*.7,'#182e3a');
 for(let y=5;y<h-2;y+=2.2)for(let xx=x-w/2+.9;xx<x+w/2-.6;xx+=1.25){if(rand()>.42)world.box(xx,y,z+d/2+.03,.35,.65,.03,pick(['#35636f','#446a7a','#537581','#846882']),.45);}
 for(let y=5;y<h-2;y+=2.7)for(let zz=z-d/2+.7;zz<z+d/2;zz+=1.4)if(rand()>.55)world.box(x-s*w/2-s*.025,y,zz,.035,.7,.4,'#335d71',.35);
 if(i%4===0){neonBox(x-s*w/2-.03,h*.7,z,.08,h*.45,d*.45,pick(['#4088a9','#a23581','#39a4aa']));world.beam([x,h,z],[x,h+7,z],.04,'#293e49');neonBox(x,h+7,z,.13,.15,.13,'#f15562');}
}
// Signature market arch, three-dimensional lettering panel and bridge.
for(const x of [-8.7,8.7]){wallBox(x,4.1,-12.9,.55,8.2,.65,'#263b42');neonBox(x,3.25,-12.51,.07,6.1,.05,'#60c9c6');world.box(x,6.7,-12.5,.95,.18,.3,'#7d8271');}
world.box(0,7.7,-13,18.3,.72,1.9,'#253740');world.box(0,7.18,-11.98,15.1,2.0,.32,'#17222b');world.sign(0,7.18,-11.78,14.6,1.65,signs.null,0,'#ffffff',.82);neonBox(0,6.12,-11.73,14.9,.06,.05,'#e5ff47');
world.box(0,9.30,-13.2,20,.18,2.7,'#253943');for(const z of [-14.5,-11.9]){world.box(0,10.2,z,20,.06,.06,'#6c7b81');for(let x=-9.8;x<10;x+=.65)world.box(x,9.75,z,.03,1.05,.03,'#536d78');}
world.sign(7.90,11.65,-11.65,3.6,1.7,signs.arrow,0,'#ffffed',.95);
// The relay gate seals the far end of the street.
wallBox(-6.8,2,-28,6.3,4,1.0,'#2e434a');wallBox(6.8,2,-28,6.3,4,1.0,'#2e434a');wallBox(0,4.9,-28,20,1.8,1,'#203c45');
world.sign(0,5.0,-27.45,7.8,1.18,signs.relay,0,'#a8ffff',.83);
for(const x of [-3.57,3.57]){world.box(x,2.1,-27.70,.4,4.2,.4,'#567076');neonBox(x,2.0,-27.43,.055,3.6,.065,'#f87265');}
const gateBatch=new Batch();gateBatch.box(0,1.9,0,6.75,3.8,.36,'#1d3039');for(let x=-3.2;x<3.3;x+=.48){gateBatch.box(x,1.9,.20,.075,3.8,.07,'#78867c');}for(let y=.3;y<3.8;y+=.7)gateBatch.box(0,y,.22,6.7,.045,.07,'#758179');gateBatch.sign(0,2.2,.3,3.9,.9,signs.warning,0,'#ffcc8c',.35);gateBatch.upload();
const gateCollider={minX:-3.43,maxX:3.43,minZ:-28.5,maxZ:-27.5,minY:0,maxY:4,gate:true};colliders.push(gateCollider);
// Terminal, core pedestal, server racks.
world.box(-4.55,.7,-25.85,.65,1.4,.64,'#182e39');world.box(-4.55,1.50,-25.85,.89,.65,.42,'#4b6570');world.sign(-4.55,1.51,-25.61,.72,.42,signs.access,0,'#b7ffed',1.1);neonBox(-4.55,.76,-25.49,.46,.035,.02,'#5ce3eb');
const corePos=[0,1.3,-69.0],terminalPos=[-4.55,1.5,-25.5];
world.box(0,.45,-69,2.4,.9,1.5,'#283f4a');world.box(0,.96,-69,2.7,.12,1.8,'#728b8d');colliders.push({minX:-1.35,maxX:1.35,minZ:-69.9,maxZ:-68.1,minY:0,maxY:1.04});neonBox(0,.78,-68.22,2.1,.08,.04,'#67deed');world.box(0,1.07,-69,1.2,.14,.8,'#111f2c');
world.sign(0,3.7,-47.42,7.4,1.55,signs.core,0,'#6edce8',.8);
for(const x of [-6.1,-3.7,3.7,6.1]){wallBox(x,1.7,-44,1.6,3.4,1.4,'#152b37');for(let y=.25;y<3.2;y+=.26){world.box(x,y,-43.27,1.36,.14,.06,'#3c5b64');for(let xx=-.5;xx<.6;xx+=.2)neonBox(x+xx,y,-43.21,.07,.03,.025,rand()>.3?'#4bbbb5':'#e2735b');}neonBox(x-.72,1.7,-43.23,.03,3.1,.05,'#4c929f');}
for(const x of [-8.4,8.4])for(let z=-32;z>-46;z-=3){world.box(x,2,z,1.1,4,2.3,'#233d48');neonBox(x+(x<0?.57:-.57),2,z,.04,3.5,.10,'#447d94');}
// Shop signs, vertical neon, giant ads.
function sideSign(side,z,y,w,h,uv,glow=1.0){const x=side*9.62;world.box(side*9.83,y,z,.24,h+.25,w+.24,'#111f2b');world.sign(x,y,z,w,h,uv,-side*Math.PI/2,'#ffffff',glow);}
sideSign(-1,7,4.2,7.7,1.40,signs.noodle);sideSign(1,5.5,4.4,7.0,1.65,signs.splice);sideSign(-1,-6.1,5.6,5.5,1.65,signs.pawn);sideSign(1,-10,5.6,7.6,2.2,signs.koi);sideSign(1,-22.6,7.8,5.8,5.2,signs.code,.75);sideSign(-1,-21,7.0,5.6,4.4,signs.poster,.8);sideSign(-1,12,9.6,5.8,3,signs.advert,.85);sideSign(1,12,8.8,7.2,3.7,signs.vanta,.85);sideSign(-1,-41,8.0,8,2.7,signs.vanta,.8);sideSign(1,-40,10,5,5,signs.tower,.8);
for(const [x,z,y,uv,c] of [[7.1,-6.3,7.4,signs.open,'#5ce3eb'],[-7.7,-3.1,7.6,signs.hot,'#ff8058'],[7.9,-19.5,10.5,signs.koi,'#ed6dae'],[-7.8,9.5,6.8,signs.ramen,'#d8e97a']]){world.box(x,y,z,1.75,3.65,.35,'#1c2733');world.sign(x,y,z+.19,1.53,3.40,uv,0,'#ffffff',.95);world.beam([x,y+1.4,z],[Math.sign(x)*9.8,y+1.4,z],.065,'#50666f');neonBox(x-.88,y,z+.19,.035,3.4,.05,c);}
// Street stalls: awnings, stock, cookware, seats, local light.
function stall(x,z,uv,color){wallBox(x,.51,z,3.0,1.02,1.6,'#384549');world.box(x,1.07,z,3.4,.16,1.95,'#76817a');world.box(x,1.24,z+.97,3.3,.23,.04,color,.15);for(const xx of [x-1.5,x+1.5])for(const zz of [z-.72,z+.74])world.box(xx,1.93,zz,.075,3.85,.075,'#6f7a78');
 world.box(x,3.2,z,3.8,.16,2.45,'#272d39');for(let i=0;i<8;i++)world.box(x-1.65+i*.46,3.29,z,.23,.025,2.38,i%2?'#754b49':color,0);
 world.box(x,2.79,z+1.23,3.55,.63,.12,'#1a2934');world.sign(x,2.79,z+1.302,3.40,.55,uv,0,'#ffffff',.85);neonBox(x,2.42,z+1.3,3.3,.045,.045,color);
 for(let i=0;i<8;i++){const xx=x+rr(-1.3,1.3),zz=z+rr(-.6,.6);world.cylinder(xx,1.22,zz,rr(.09,.18),.23,pick(['#879e96','#9e7a57','#747c7c']),0,8);}
 for(const xx of [x-.95,x+.95]){world.cylinder(xx,.55,z+1.75,.3,.12,'#875751');world.cylinder(xx,.27,z+1.75,.065,.53,'#658285');}
 for(let k=0;k<5;k++){const xx=x-1.1+k*.55;world.beam([xx,2.42,z-.3],[xx,2.02,z-.3],.015,'#87886d');world.cylinder(xx,1.98,z-.3,.10,.20,'#b37d51');}
 light(x,2.3,z+1.6,color,8,1.15);
}
stall(-6.9,3.3,signs.ramen,'#f4a571');stall(6.7,-2.4,signs.splice,'#64d1c2');stall(-6.7,-16.5,signs.food,'#f68768');stall(6.5,-20.5,signs.noodle,'#e88586');
// Hanging lanterns, cable bundles, street lamps and damp road detail.
for(const z of [5.5,-4.0,-18.4,-34]){for(let i=0;i<12;i++){const a=i/12,b=(i+1)/12;world.beam([-10+a*20,6.7-Math.sin(a*Math.PI)*1.65,z],[-10+b*20,6.7-Math.sin(b*Math.PI)*1.65,z],.017,'#29444e');}for(let x=-7;x<8;x+=3.4){const y=6.7-Math.sin((x+10)/20*Math.PI)*1.65;world.beam([x,y,z],[x,y-.45,z],.015,'#272d36');world.cylinder(x,y-.72,z,.26,.53,'#ce6751',.62,10,.21);world.cylinder(x,y-.42,z,.25,.065,'#383640');world.cylinder(x,y-.99,z,.22,.06,'#242b35');}}
for(const side of [-1,1])for(const z of [13,-8,-23,-38]){const x=side*8.8;world.box(x,2.8,z,.095,5.6,.095,'#566569');world.beam([x,5.6,z],[x-side*1.5,5.6,z],.065,'#687b7c');world.box(x-side*1.1,5.55,z,.85,.13,.4,'#36434b');neonBox(x-side*1.1,5.47,z,.7,.03,.3,'#9ee3d6');}
for(let j=0;j<9;j++){const z=15-j*7;world.box(0,.008,z,.13,.012,1.3,'#a49962');world.box(.3,.008,z,.13,.012,1.3,'#a49962');}
for(let j=0;j<28;j++){const x=rr(-9,9),z=rr(-45,19);world.box(x,.013,z,rr(.07,.2),.01,rr(.1,.3),pick(['#5c6364','#706956','#425e65']),0,rr(-2,2));}
for(const [x,z] of [[-3,10],[4,-8],[-2,-20],[2,-38]]){world.box(x,.014,z,1.8,.015,.55,'#111e28');for(let i=-.75;i<.8;i+=.15)world.box(x+i,.026,z,.055,.01,.48,'#596771');}
// Cover crates, vending machine and power cells.
function crate(x,z,w=1.4,h=1.25,d=1.25){wallBox(x,h/2,z,w,h,d,'#3e4c4b');world.box(x,h+.015,z,w+.06,.10,d+.06,'#65746e');for(const xx of [x-w*.35,x+w*.35]){world.box(xx,h/2,z+d/2+.014,.075,h,.025,'#858064');world.box(xx,h/2,z-d/2-.014,.075,h,.025,'#858064');}world.box(x,h*.48,z+d/2+.022,w*.63,.26,.028,'#28363b');world.box(x-w*.2,h*.5,z+d/2+.04,.15,.11,.01,'#c4bd78',.12);}
for(const c of [[-3.8,-3,1.8,1.35,1.2],[3.9,-12,2.0,1.3,1.4],[-3.5,-18,1.6,1.45,1.5],[4.5,-24,1.6,1.3,1.6],[-3.1,-34,1.8,1.4,1.3],[3.3,-38,2.0,1.3,1.4],[-8.5,11,1.5,1.5,1.8],[7.9,14,1.6,1.1,1.5]])crate(...c);
world.box(8.8,1.35,9.1,1.45,2.7,.85,'#263540');world.sign(8.8,1.82,9.55,1.23,1.22,signs.poster,0,'#d8ffff',.75);neonBox(8.8,.3,9.56,1.25,.07,.05,'#5ce3eb');world.box(8.8,.78,9.56,.9,.28,.06,'#071722');
const barrels=[];const barrelMesh=new Batch();barrelMesh.cylinder(0,.57,0,.40,1.14,'#713644',0,12);for(const y of [.12,.92])barrelMesh.cylinder(0,y,0,.43,.09,'#a45452',0,12);barrelMesh.box(0,.58,.405,.34,.4,.018,'#db8e60',.4);barrelMesh.box(0,.57,.42,.07,.29,.02,'#422b36');barrelMesh.upload();
for(const [x,z] of [[5.8,-7.9],[-5.8,-22.7],[4.8,-34.2],[-4,6.8]]){barrels.push({x,z,hp:40,alive:true});colliders.push({minX:x-.42,maxX:x+.42,minZ:z-.42,maxZ:z+.42,minY:0,maxY:1.16,barrel:barrels.length-1});}
const supplyMesh=new Batch();supplyMesh.box(0,.21,0,.92,.42,.64,'#25454b');supplyMesh.box(0,.43,0,.95,.09,.66,'#7a9c8f');supplyMesh.box(0,.44,.12,.34,.03,.09,'#d1eea4',.9);supplyMesh.box(0,.44,.12,.09,.03,.32,'#d1eea4',.9);supplyMesh.upload();
const supplies=[{x:-7.8,z:-8.8,used:false},{x:6.0,z:-32.0,used:false},{x:-2.0,z:20.3,used:false},{x:6.6,z:-70.5,used:false}];
// A low, armoured getaway vehicle anchors the return route.
const van=new Batch();van.box(0,.53,0,2.7,.45,5.4,'#203a43');van.box(0,1.14,-.55,2.65,.83,3.9,'#34424a');van.box(0,1.73,-.15,2.38,.62,2.4,'#27343f');van.box(0,1.27,2.1,2.6,.57,1.1,'#46595e');van.box(0,1.70,1.08,2.25,.52,.07,'#0b2635',.12);for(const x of [-1.37,1.37])for(const z of [-1.8,1.8]){van.box(x,.46,z,.34,.88,.98,'#101b26');van.box(x*1.01,.47,z,.355,.41,.55,'#637177');}for(const x of [-.94,.94]){van.box(x,1.03,2.67,.47,.13,.055,'#c7e3c2',1.4);van.box(x,1.23,-2.52,.24,.12,.06,'#e23d5e',1.1);}van.box(0,.66,2.77,2.75,.19,.16,'#83908a');van.box(0,2.10,-.1,1.2,.16,1.35,'#243640');van.sign(0,1.30,-2.55,1.7,.52,signs.exit,Math.PI,'#7bcbc9',.3);van.upload();
// Holographic core and extraction geometry.
const coreMesh=new Batch();coreMesh.box(0,0,0,.48,.7,.48,'#71e2ed',1.4);for(const y of [-.42,.42])coreMesh.box(0,y,0,.61,.05,.61,'#d0ffdc',1.2);coreMesh.upload();
const extractMesh=new Batch();for(let i=0;i<48;i++){const a=i*TAU/48,b=(i+.7)*TAU/48;extractMesh.beam([Math.sin(a)*2.8,.025,Math.cos(a)*2.8],[Math.sin(b)*2.8,.025,Math.cos(b)*2.8],.028,'#8cf4dd',1.4);}extractMesh.upload();
// Additional coloured light is selected by distance at render time.
light(-8,5.2,9,'#fc7862',19,1.5);light(8,4.3,7,'#4be5dc',18,1.6);light(-7,4.8,-5,'#eb8255',17,1.4);light(7,5.1,-10,'#ee53b6',19,1.6);light(0,6.0,-12,'#c6d949',14,.7);light(-7,5,-22,'#43cdd2',17,1.2);light(7,6,-23,'#c27af0',18,1.1);light(0,4,-30,'#31a6c5',15,1.1);light(0,3,-42,'#4ab6ce',17,1.35);light(-5,3,17,'#91cdce',12,.9);
// COLD ARCHIVE: one connected room beyond the rear access corridor.
const coolantPos=[-5.65,1.35,-59.1],shardPos=[5.25,1.0,-70.0];
wallBox(-9.5,2.6,-62.45,.7,5.2,15.7,'#22353f');wallBox(-9.5,3.3,-71.65,.7,3.8,2.7,'#22353f');wallBox(9.5,2.6,-63.8,.7,5.2,18.4,'#22353f');wallBox(0,2.6,-73.1,19.7,5.2,.8,'#1e323d');
wallBox(-5.8,2.6,-54.75,7.2,5.2,.5,'#263a42');wallBox(5.8,2.6,-54.75,7.2,5.2,.5,'#263a42');wallBox(0,4.8,-54.75,4.5,.8,.5,'#263a42');
wallBox(0,5.3,-63.8,19.7,.25,18.7,'#182b36');world.box(0,.013,-63.8,19.0,.025,18.4,'#334249');
for(let x=-8.6;x<9;x+=1.2)for(let z=-55.4;z>-73;z-=1.25){world.box(x,.030,z,1.17,.018,1.21,'#2b3a42');world.box(x+.56,.045,z,.012,.014,1.20,'#5e737b');}
for(const side of [-1,1]){neonBox(side*8.95,.13,-63.9,.035,.07,17.4,'#62bebf');neonBox(side*2.08,2.0,-51,.04,.07,6.5,'#d15c6a');world.box(side*2.08,1.7,-51,.05,.03,6.5,'#748c8e');}
for(const z of [-56.7,-61.5,-66.5,-71.1]){world.box(0,5.10,z,17.8,.18,.28,'#4e6972');for(const x of [-5.2,0,5.2])neonBox(x,4.99,z,3.15,.04,.19,'#a5dad6');}
// Luminous pressure pipes and rack aisles leave several routes through the room.
for(const x of [-6.9,6.9])for(const z of [-62.3,-66.8]){wallBox(x,1.65,z,1.8,3.3,2.2,'#152630');for(let y=.35;y<3.2;y+=.32){world.box(x,y,z+1.12,1.50,.23,.035,'#394c55');for(let dx=-.56;dx<.7;dx+=.25)neonBox(x+dx,y+.035,z+1.15,.08,.035,.025,rand()>.25?'#5ecccc':'#ef6a85');}world.sign(x,2.45,z-1.12,1.25,.55,signs.vanta,Math.PI,'#b9dae0',.33);}
for(const x of [-8.65,8.65]){world.cylinder(x,1.65,-70.4,.43,3.3,'#3b6470',.14,12);world.cylinder(x,1.68,-70.4,.46,.15,'#7fafba',.3,12);world.beam([x,3.3,-70.4],[x,4.5,-70.4],.12,'#496475');world.beam([x,4.5,-70.4],[x,4.5,-56],.12,'#496475');for(const y of [.32,2.96])world.cylinder(x,y,-70.4,.48,.09,'#9db6ac',.22,12);}
crate(-2.7,-61.9,2.2,1.15,1.6);crate(2.65,-65.6,2.5,1.23,1.55);
// The coolant console is a mission object, not just a lighted panel.
world.box(coolantPos[0],.55,coolantPos[2],1.2,1.1,.75,'#253b49');world.box(coolantPos[0],1.25,coolantPos[2],1.38,.75,.28,'#526a71');world.sign(coolantPos[0],1.28,coolantPos[2]+.16,1.21,.59,signs.coolant,0,'#96e6de',.75);neonBox(coolantPos[0],.68,coolantPos[2]+.4,.9,.04,.05,'#ef647b');
colliders.push({minX:coolantPos[0]-.69,maxX:coolantPos[0]+.69,minZ:coolantPos[2]-.4,maxZ:coolantPos[2]+.4,minY:0,maxY:1.65});
world.sign(0,3.5,-47.35,4.05,.62,signs.archive,0,'#ffb2bd',.88);world.sign(0,3.45,-55.03,3.8,.7,signs.archiveExit,Math.PI,'#d9f7d4',.72);world.sign(0,3.55,-72.62,6.4,1.1,signs.core,0,'#b3f4ef',.9);
for(const x of [-1.8,1.8]){world.box(x,2.0,-69,.16,4,.16,'#557c87');neonBox(x,2.0,-68.89,.035,3.8,.04,'#f1667c');world.beam([x,4,-69],[0,4,-69],.07,'#72939d');}
world.box(shardPos[0],.55,shardPos[2],1.4,1.1,.9,'#3b4e57');world.box(shardPos[0],1.15,shardPos[2],.38,.07,.28,'#81e5ec',.9);
world.box(5.1,1.0,-58.0,1.0,2.0,.6,'#31434c');world.sign(5.1,1.44,-57.67,.78,.8,signs.code,0,'#afc5e8',.65);
light(0,4.3,-57,'#ff607d',11,1.1);light(-4.8,3.4,-61.3,'#52ccd4',10,1.5);light(5.8,3.4,-66,'#7871ef',11,1.2);light(0,3.5,-69.2,'#70dde4',12,1.6);
const archiveDoorMesh=new Batch();archiveDoorMesh.box(0,1.95,0,4.10,3.90,.20,'#2b3b46');for(const x of [-1.86,1.86])archiveDoorMesh.box(x,1.95,.14,.045,3.70,.035,'#ff5d77',1.2);for(let y=.35;y<3.9;y+=.45)archiveDoorMesh.box(0,y,.12,3.72,.024,.025,'#4d6570');archiveDoorMesh.sign(0,2.3,.14,3.4,.75,signs.archive,0,'#efa4ad',.6);archiveDoorMesh.upload();
colliders.push({minX:-2.12,maxX:2.12,minZ:-48.2,maxZ:-47.8,minY:0,maxY:4.0,archiveDoor:true});
const cameraMesh=new Batch();cameraMesh.box(0,0,0,.65,.24,.48,'#607883');cameraMesh.box(0,-.07,.25,.20,.18,.04,'#101f2c');cameraMesh.cylinder(0,.19,-.1,.08,.35,'#5d777e');cameraMesh.upload();
const cameraLamp=new Batch();cameraLamp.box(0,-.08,.28,.07,.045,.026,'#ff536f',1.2);cameraLamp.upload();
const deviceGlow=new Batch();deviceGlow.box(0,0,0,.09,.035,.035,'#a4f4eb',1.5);deviceGlow.upload();

colliders.push({minX:5.55,maxX:6.25,minZ:-57.16,maxZ:-56.45,minY:3.35,maxY:3.83,device:"archive-camera"});

// Mercy Street extends the original south entrance by 34 metres.
for(const side of [-1,1]){
 if(side>0)wallBox(side*14.9,10.5,39.5,10.0,21,35,'#24313e');else wallBox(side*14.9,13,39.5,10,16,35,'#24313e');
 world.box(side*9.6,.10,39.5,.95,.20,33,'#4c5558');
 for(let z=25;z<57;z+=4.4){
  if(side>0||z<44.8||z>49.2){world.box(side*9.85,1.65,z,.16,2.95,3.9,'#14242e');
  for(let y=.35;y<3.1;y+=.2)world.box(side*9.74,y,z,.04,.03,3.8,'#43505a');}
  for(let y=5;y<20;y+=3.4){world.box(side*9.8,y,z,.23,1.7,1.95,'#23313c');world.box(side*9.65,y+.05,z,.04,1.3,1.5,pick(['#787250','#427080','#5b455e']),.35);world.box(side*9.61,y+.05,z,.04,1.3,.055,'#142c35');}
  world.box(side*9.5,.02,z,.14,.025,2.1,'#97a06a');
 }
 for(let y=3.5;y<21;y+=3.4)world.box(side*9.58,y,39.5,.62,.19,35,'#586167');
 world.beam([side*8.75,6,25],[side*8.75,6,56],.075,'#647a7b');
}
wallBox(0,2.8,57.5,22,5.6,1,'#273642');world.sign(0,3.5,56.96,7,1.6,signs.mercy,0,'#dee7e6',.9);
// The checkpoint has a real shutter and solid side walls. Its passage is 5.2 m wide.
for(const x of [-6.25,6.25]){wallBox(x,1.4,24,7.0,2.8,.7,'#30444b');world.box(x,2.86,24,7.0,.12,.86,'#7e8986');neonBox(x,1.9,24.38,6.5,.06,.03,'#ef9375');}
for(const x of [-2.68,2.68]){wallBox(x,2.5,24,.3,5,.7,'#44565b');neonBox(x,2.4,24.42,.055,4.2,.04,'#f28c6c');}
world.box(0,4.9,24,6.1,.44,.9,'#3d515a');world.sign(0,4.94,24.48,5.2,.64,signs.checkpoint,0,'#ffcc9d',1.0);
const streetGateMesh=new Batch();streetGateMesh.box(0,2,0,5.03,4,.20,'#233840');
for(let x=-2.36;x<2.5;x+=.32)streetGateMesh.box(x,2,.14,.065,3.9,.07,'#607776');
streetGateMesh.sign(0,2.45,.20,3.5,.60,signs.visitor,0,'#fbb283',.75);streetGateMesh.upload();
colliders.push({minX:-2.53,maxX:2.53,minZ:23.8,maxZ:24.2,minY:0,maxY:4,streetGate:true});
// A service panel is a separate, always available fallback to the social route.
world.box(4.55,1.1,25.1,.85,2.2,.6,'#263e48');world.sign(4.55,1.7,25.42,.65,.58,signs.access,0,'#8adfda',.8);
// Clinic and laundry frontage, a tram shelter, a news stand, and street cables.
sideSign(-1,41.5,3.8,6.1,1.0,signs.clinic,1.1);sideSign(1,36.5,4.1,7.0,1.1,signs.laundry,1.0);
world.box(-7.5,2.8,41.5,4.0,.14,4.8,'#537c76');for(const z of [39.2,43.8])world.box(-5.48,1.4,z,.08,2.8,.08,'#527a7a');
world.box(-8.55,1.1,41.5,1.3,2.2,1.1,'#96ac9a');neonBox(-7.86,1.45,41.5,.04,.3,.08,'#a6ffbf');
for(let z=32;z<38;z+=1.4){wallBox(8.1,.7,z,1.5,1.4,1.15,'#52606b');world.box(7.33,.71,z,.06,.89,.85,'#152b36');world.cylinder(8.1,1.45,z,.4,.09,'#77909b');}
world.box(4.9,.8,37.7,1.15,.08,.7,'#657a82');world.box(4.9,.41,37.7,.08,.8,.1,'#4b646b');
world.box(6.8,3.6,47.0,4.6,.2,6,'#435a64');world.sign(6.8,3.65,50.12,4.3,.8,signs.transit,0,'#d0ecc0',.7);
for(const z of [44.2,49.8])wallBox(8.65,1.8,z,.14,3.6,.15,'#728d91');
world.box(8.4,1.05,47,1.1,.13,4.7,'#6b7e75');world.box(8.85,1.43,47,.12,.6,4.7,'#46596a');
for(const z of [30,44,53]){world.box(0,.013,z,3.2,.016,.14,'#8e9262');for(const x of [-1.6,1.6])world.box(x,.015,z+.9,.08,.017,1.75,'#8e9262');}
world.box(0,9.3,32,19.8,.3,2.4,'#243f4b');world.box(0,10.15,32.9,19.8,.08,.06,'#71888a');
for(let x=-9;x<=9;x+=.6)world.box(x,9.74,32.9,.04,.88,.04,'#526c76');
world.sign(0,7.45,33.1,11,1.7,signs.mercy,0,'#c8ffff',.88);neonBox(0,6.48,33.0,11.5,.05,.06,'#66d8df');
for(let x=-7;x<=7;x+=3.5){world.beam([x,10,54],[x+1.5,8.8,38],.016,'#253b43');world.beam([x+1.5,8.8,38],[x,11,25],.016,'#253b43');}
world.sign(-7.9,5.9,51,2.2,3.3,signs.poster,0,'#c3d8e7',.7);
light(0,5.4,33,'#42c7dd',17,1.8);light(-5.3,2.3,41.2,'#64dcb7',10,1.45);light(5.2,2.8,37.3,'#e174a4',10,1.65);light(-3.2,2.3,50,'#d0a168',10,1.25);light(-1.8,2.7,26.5,'#dd9b69',11,1.45);light(0,3.4,-23.5,'#85b6c8',8,1.0);
// Civilian meshes have faces, clothes, and distinct tools rather than guard helmets.
const citizenMeshes={};
function makeCitizen(coat,skin,hair,accent,kind){
 const b=new Batch();b.box(0,.97,0,.52,.68,.34,coat);b.box(0,.62,0,.54,.24,.35,coat);
 b.box(0,1.37,0,.15,.20,.16,skin);b.box(0,1.63,.02,.32,.38,.29,skin);
 b.box(0,1.82,0,.36,.12,.31,hair);b.box(0,1.67,-.13,.35,.26,.07,hair);
 for(const x of [-.075,.075]){b.box(x,1.68,.173,.035,.025,.012,'#132b34');b.box(x,1.724,.172,.066,.025,.014,hair);}
 b.box(0,1.61,.19,.04,.08,.06,skin);b.box(0,1.535,.18,.10,.018,.014,'#614e51');
 b.box(.17,1.66,.035,.035,.11,.18,accent,.7);b.box(.107,1.679,.18,.04,.035,.02,accent,1.0);
 for(const x of [-.18,.18]){b.box(x,.33,0,.19,.61,.23,'#253745');b.box(x,.07,.075,.23,.14,.38,'#1b2b35');}
 for(const x of [-.355,.355]){b.box(x,1.07,.015,.18,.48,.21,coat);b.box(x,.78,.07,.16,.2,.18,skin);}
 b.box(-.115,1.13,.18,.12,.065,.015,accent,.25);b.box(0,1.18,.18,.04,.45,.03,'#5b696f');
 if(kind==='medic'){b.box(0,1.19,.225,.22,.08,.025,'#acdfc8');b.box(0,1.19,.228,.075,.22,.025,'#acdfc8');b.box(.36,.66,.09,.26,.23,.28,'#769187');}
 if(kind==='courier'){b.box(-.2,.97,-.27,.35,.65,.3,'#957454');b.box(.33,.9,.23,.25,.05,.4,'#537b92');b.box(.33,.935,.23,.21,.015,.34,'#4acae0',.5);}
 if(kind==='fixer'){b.box(0,1.39,.05,.33,.12,.38,'#768069');b.box(0,1.8,.09,.44,.045,.49,hair);}
 if(kind==='officer'){b.box(0,1.77,.05,.39,.08,.35,'#52665e');b.box(0,1.77,.19,.43,.026,.25,'#2c413e');b.box(.20,.78,.24,.13,.27,.12,'#182c35');}
 b.upload();return b;
}
citizenMeshes.mara=makeCitizen('#745b42','#aa846b','#273543','#c1db87','fixer');
citizenMeshes.iona=makeCitizen('#517c75','#977660','#29323a','#b4edd0','medic');
citizenMeshes.jax=makeCitizen('#714665','#b8997d','#181e2e','#ef9bcc','courier');
citizenMeshes.vale=makeCitizen('#425761','#bc9b87','#535a5a','#f2c590','officer');

// BLINDSIDE / A continuous service wing. Every passage has physical walls.
// The long west wall keeps the rooms inside the existing skyline.
wallBox(-20.6,2.8,-7.6,.6,5.6,130.2,'#273c42');
wallBox(-15.45,2.8,57.2,10.9,5.6,.5,'#273c42');
wallBox(-15.1,2.8,-73.1,11.8,5.6,.7,'#273c42');
function stripX(x,z0,z1,openings=[],height=5.25){
 let lo=z0;for(const [a,b] of [...openings].sort((a,b)=>a[0]-b[0])){if(a>lo)wallBox(x,height/2,(lo+a)/2,.45,height,a-lo,'#263b43');wallBox(x,4.25,(a+b)/2,.45,2,b-a,'#2c454e');lo=b;}if(lo<z1)wallBox(x,height/2,(lo+z1)/2,.45,height,z1-lo,'#263b43');
}
stripX(-10.25,-47.5,57.0,[[-31.5,-29.5],[16,18.4],[45,49]]);
// Service floor and an old blue return line. Follow the line back to Mercy Street.
for(let z=55;z>-73;z-=2.25){world.box(-15.25,.016,z,10,.026,2.22,'#2b3b40');world.box(-15.25,.034,z,.075,.012,1.25,'#739f98',.13);world.box(-19.0,.029,z,.65,.022,1.9,'#142b31');for(let i=-.7;i<.8;i+=.3)world.box(-19.0,.043,z+i,.64,.019,.045,'#42636b');}
for(const z of [53,37,4,-17,-43,-57]){world.box(-15.35,4.85,z,10.0,.22,.36,'#557178');for(const x of [-18,-13])neonBox(x,4.7,z,1.9,.035,.14,'#87c8bf');}
// Clearly visible entrance, with no test, payment, or conversation required.
world.sign(-9.94,3.44,47,3.85,.82,signs.service,Math.PI/2,'#d4ede1',.95);
for(const z of [45.12,48.9])neonBox(-9.93,1.58,z,.055,3.02,.06,'#69b5a6');
world.box(-14.0,.02,47.0,7.6,.025,.13,'#8dd2b8',.22);
world.sign(-15.6,2.65,44.8,4.8,.84,signs.service,0,'#d6ebdf',.7);
// A local service record explains the complete route, including the core alarm.
wallBox(-18.7,.7,43.0,1.6,1.4,.8,'#35545b');world.box(-18.7,1.5,43.0,1.5,.24,.85,'#5c777e');
world.sign(-18.7,1.4,43.46,1.18,.42,signs.access,0,'#b8f3dd',.8);
// Laundry rear: deep machines and a safe reading alcove.
for(const z of [39,35]){wallBox(-11.65,1.25,z,2.0,2.5,2.0,'#41555f');world.box(-12.69,1.32,z,.055,1.58,1.5,'#182d36');for(let q=-.5;q<=.6;q+=.2)world.box(-12.73,1.32+q,z,.045,.035,1.3,'#63797a');}
crate(-17.3,36.8,2.4,1.55,1.5);crate(-12.2,28.7,2,1.2,1.8);
world.sign(-15.0,3.5,25.0,4.9,.78,signs.quiet,0,'#c9e4cf',.65);
// An optional drain sleeve bypasses the first patrol and its sweeping camera.
// Roof height 1.30 m: standing is blocked; crouching fits.
wallBox(-17.45,1.3,19.0,.28,2.6,22.0,'#203840');
wallBox(-18.86,1.48,19.0,2.60,.36,22.0,'#36515a');
world.sign(-19.0,1.07,30.22,1.65,.34,signs.quiet,0,'#d5e5c7',.4);
for(let z=29;z>8;z-=3.2){neonBox(-20.18,.32,z,.035,.065,.55,'#6aa796');world.box(-18.85,.05,z,2.3,.02,.1,'#708681');}
// Loading yard: the sky gap between the existing buildings is now playable.
world.sign(-10.55,3.7,17.2,2.05,.68,signs.null,-Math.PI/2,'#c9d28b',.6);
wallBox(-13.3,1.5,21.2,2.3,3,2.2,'#355059');
wallBox(-14.9,.76,14.7,2.1,1.52,2.7,'#435653');
for(let z=13.8;z<16;z+=.3)world.box(-16,1.10,z,.045,.055,.19,'#a2a388');
for(const x of [-13.8,-12.8]){world.cylinder(x,1.2,10.8,.48,2.4,'#516a71');world.beam([x,2.4,10.8],[x,3.6,10.8],.14,'#719295');}
light(-13.8,4.4,19,'#d9a76a',7.4,1.2);light(-15,3.7,12,'#55968f',6,1);
// Switchworks. Alternating racks break long sight lines and give two floor paths.
world.sign(-15.2,3.55,3.3,5.8,1.03,signs.works,0,'#e0bc82',.7);
for(const [x,z] of [[-12.2,1],[-17.4,-5],[-12.2,-12],[-16.9,-18]]){wallBox(x,1.37,z,2.5,2.74,2.2,'#29424c');for(let y=.35;y<2.5;y+=.29){world.box(x,y,z+1.12,2.22,.20,.04,'#4b656c');neonBox(x-.82,y,z+1.15,.09,.045,.02,'#729b9b');}world.box(x,2.83,z,2.62,.18,2.35,'#57717a');}
// A low cable trough is a waiting point between the two west racks.
wallBox(-18.2,.72,-10,.24,1.44,4.6,'#43616a');world.box(-18.2,1.46,-10,.40,.06,4.72,'#71978e');
for(const z of [-8,-10,-12])world.box(-18.35,.55,z,.06,.20,.55,'#253d46');
world.box(-18.9,4.0,-9,.33,.33,35,'#5a7a78');world.box(-11.1,3.7,-9,.25,.25,35,'#315568');
light(-13.8,4.1,-8,'#5b95a0',6.5,1.0);light(-15.8,3.9,-20,'#daa66e',6,1.1);
// A second crawl route bypasses the relay service patrol. No skill is required.
wallBox(-17.45,1.3,-31.3,.28,2.6,22.6,'#223941');
wallBox(-18.86,1.48,-31.3,2.6,.36,22.6,'#36515a');
world.sign(-19,1.06,-19.96,1.65,.33,signs.quiet,0,'#d0e1c0',.42);
for(let z=-20.7;z>-42.6;z-=3.4)neonBox(-20.18,.33,z,.036,.06,.55,'#6aa796');
world.sign(-10.53,3.40,-30.5,1.86,.58,signs.relay,-Math.PI/2,'#aececb',.55);
// A physical handwheel opens the pump room. It is not tied to the public gates.
for(const [x,w] of [[-19.0,3.0],[-12.0,3.1]])wallBox(x,2.5,-47.0,w,5,.55,'#2f444d');
wallBox(-15.5,4.25,-47.0,4.0,1.5,.55,'#2f444d');
const serviceDoorMesh=new Batch();serviceDoorMesh.box(0,1.65,0,3.9,3.3,.25,'#304650');for(const x of [-1.7,1.7])serviceDoorMesh.box(x,1.65,.16,.035,3.15,.03,'#85b9a1',.6);serviceDoorMesh.sign(0,2.2,.16,3.25,.72,signs.pump,0,'#b4dacf',.5);serviceDoorMesh.upload();
colliders.push({minX:-17.48,maxX:-13.52,minZ:-47.2,maxZ:-46.8,minY:0,maxY:3.35,serviceDoor:true});
world.box(-13.6,1.23,-45.8,.30,.30,.10,'#648b8b');world.cylinder(-13.6,1.24,-45.8,.21,.06,'#9bb39c',.1,12);
world.sign(-15.4,3.97,-46.67,4.6,.6,signs.pump,0,'#d2dfbd',.7);
// A pump gallery runs along the west wall of the Cold Archive.
world.box(-15.0,5.0,-61.1,10.5,.28,23.7,'#1c3441');
for(const z of [-52,-59,-65.3]){wallBox(-18.55,1.4,z,2.4,2.8,2.6,'#355464');for(let yy=.4;yy<2.7;yy+=.5)world.box(-17.3,yy,z,.08,.07,2.32,'#759493');world.cylinder(-18.55,3.1,z,.76,.64,'#668582',0,12);}
world.box(-19.6,3.5,-60.5,.24,.24,24.0,'#447c85');world.box(-11.05,3.8,-60.5,.18,.18,24.0,'#8a795b');
// The alarm bridge is separate from power and record storage. The clinic stays live.
wallBox(-11.5,.72,-55.8,1.7,1.44,1.0,'#345861');world.sign(-11.5,1.30,-55.24,1.46,.70,signs.bridge,0,'#b5ecdb',.7);
world.sign(-11.3,2.63,-56.3,2.75,.73,signs.bridge,0,'#adead4',.65);
world.box(-11.5,1.88,-55.8,1.6,.035,.8,'#b9c4ad',.1);
light(-14.4,3.8,-52.5,'#699eae',7,1);light(-12.8,3.3,-56.2,'#79a786',5,1);light(-13.5,3.8,-66.7,'#547c96',7,1);
// Crouch-only rear access. It joins the original room, not a teleporter.
world.sign(-9.92,1.08,-71.6,2.17,.43,signs.hatch,-Math.PI/2,'#b2dcb9',.44);
world.sign(-14.6,2.7,-72.62,5.3,.84,signs.hatch,0,'#c1e4c5',.65);
neonBox(-9.92,.15,-71.65,.055,.065,2.35,'#78baae');
// Privacy screens make the rear aisle usable without harming the custodian.
wallBox(-5.48,.98,-68.25,5.7,1.96,.23,'#344c55');world.box(-5.48,2.01,-68.25,5.8,.08,.3,'#75958f');
wallBox(-.2,.72,-67.62,2.8,1.44,.24,'#3b535b');
// Service lockers retain bodies without killing unconscious guards.
const hideSpots=[{id:'laundry-locker',x:-19.0,z:49.9},{id:'works-locker',x:-11.55,z:-3.1},{id:'pump-locker',x:-11.65,z:-63.5}];
for(const h of hideSpots){wallBox(h.x,.92,h.z,1.6,1.84,1.25,'#3d5b61');world.sign(h.x,1.23,h.z+.65,1.3,.52,signs.locker,0,'#b4d6d2',.45);world.box(h.x,.78,h.z+.65,1.4,.028,.03,'#93b4aa');}
// Small, distant maintenance sounds have visible sources.
for(const [x,z] of [[-11.1,14],[-11.1,-18.3]]){world.box(x,1.4,z,.5,1.4,.55,'#354f5b');world.sign(x,1.8,z+.29,.43,.32,signs.access,0,'#9bdecb',.6);}
// CLEAN FEED side gig: two more Vanta ad kiosks with face-cam lenses (the third is the market
// vending wall). They join the same static batch; the lens glow is drawn per frame.
function adKiosk(id,x,z,rot,uv,color){const m=M.compose(x,0,z,rot),at=(lx,ly,lz)=>M.point(m,[lx,ly,lz]);
 world.box(x,1.3,z,1.35,2.6,.8,'#1f2f3b',0,rot);let p=at(0,1.46,.41);world.sign(p[0],p[1],p[2],1.14,1.34,uv,rot,'#e6f6ff',.78);
 p=at(0,2.48,.36);world.box(p[0],p[1],p[2],.46,.2,.14,'#101d27',0,rot);p=at(0,.32,.41);world.box(p[0],p[1],p[2],1.1,.06,.05,color,1.5,rot);
 p=at(0,.72,.42);world.box(p[0],p[1],p[2],.84,.26,.05,'#08141d',0,rot);
 const hw=Math.abs(Math.cos(rot))*.675+Math.abs(Math.sin(rot))*.4,hd=Math.abs(Math.sin(rot))*.675+Math.abs(Math.cos(rot))*.4;colliders.push({minX:x-hw,maxX:x+hw,minZ:z-hd,maxZ:z+hd,minY:0,maxY:2.6,device:id});}
adKiosk('ad-mercy',-8.75,33.4,Math.PI/2,signs.advert,'#fe9aa4');adKiosk('ad-relay',8.75,-25.3,-Math.PI/2,signs.tower,'#bd8af7');

kit.loading.progress(.8,'Wiring the relay…');await new Promise(r=>setTimeout(r,0));
addStatic(world.uploadChunks(24));
// Shared low-poly guard parts. Dark ceramic armour, illuminated visor, red faction patches.
const enemyTorso=new Batch();enemyTorso.box(0,1.05,0,.55,.66,.33,'#303f4a');enemyTorso.box(0,1.17,.19,.49,.40,.12,'#67716d');enemyTorso.box(0,.81,.12,.54,.12,.38,'#222e36');for(const x of [-.18,.18])enemyTorso.box(x,.94,.24,.115,.14,.12,'#677361');enemyTorso.box(.30,1.29,0,.13,.21,.36,'#803d4d');enemyTorso.box(-.3,1.29,0,.13,.21,.36,'#637577');enemyTorso.box(.31,1.30,.185,.10,.09,.02,'#e05e69',.8);enemyTorso.upload();
const enemyHead=new Batch();enemyHead.box(0,1.61,0,.36,.39,.34,'#43545a');enemyHead.box(0,1.72,-.025,.40,.19,.37,'#253a45');enemyHead.box(0,1.64,.182,.32,.078,.035,'#ff5a68',1.2);enemyHead.box(0,1.49,.182,.26,.14,.03,'#172b35');enemyHead.box(-.23,1.65,-.03,.08,.16,.16,'#697371');enemyHead.upload();
const enemyLimb=new Batch();enemyLimb.box(0,-.22,0,.20,.46,.23,'#354550');enemyLimb.box(0,-.4,.075,.205,.19,.17,'#708080');enemyLimb.box(0,-.60,.02,.17,.38,.20,'#1f3542');enemyLimb.box(0,-.81,.06,.23,.15,.40,'#283b43');enemyLimb.upload();
const enemyArm=new Batch();enemyArm.box(0,-.17,0,.18,.38,.21,'#4b5d66');enemyArm.box(0,-.37,.15,.19,.20,.40,'#223c49');enemyArm.box(0,-.35,.37,.16,.17,.15,'#667677');enemyArm.upload();
const enemyGun=new Batch();enemyGun.box(0,0,0,.15,.16,.62,'#1b2a36');enemyGun.box(0,.015,.39,.075,.10,.37,'#4d6b71');enemyGun.box(0,-.17,-.09,.1,.26,.12,'#151f29');enemyGun.box(0,.12,-.15,.08,.09,.12,'#798c7c');enemyGun.upload();
// Detailed first-person weapons, with separate magazine meshes for reload motion.
Batch.prototype.bevelBox=function(x,y,z,w,h,d,col,em=0){const b=Math.min(w,h)*.15;const shape=[[-w/2+b,-h/2],[w/2-b,-h/2],[w/2,-h/2+b],[w/2,h/2-b],[w/2-b,h/2],[-w/2+b,h/2],[-w/2,h/2-b],[-w/2,-h/2+b]];for(let i=0;i<8;i++){const a=shape[i],n=shape[(i+1)%8],front=[x+a[0],y+a[1],z+d/2],back=[x+a[0],y+a[1],z-d/2],nf=[x+n[0],y+n[1],z+d/2],nb=[x+n[0],y+n[1],z-d/2];this.quad(front,nf,nb,back,col,em);this.quad([x,y,z+d/2],nf,front,[x,y,z+d/2],col,em);this.quad([x,y,z-d/2],back,nb,[x,y,z-d/2],col,em);}};
function makeWeapon(pistol=false){const b=new Batch();if(!pistol){b.bevelBox(0,0,0,.16,.19,.61,'#34444f');b.box(0,.078,-.20,.15,.085,.51,'#6b797a');b.box(0,-.025,-.38,.14,.13,.24,'#222f3c');b.box(0,.026,-.64,.06,.06,.36,'#8c9691');b.cylinder(0,.022,-.83,.04,.065,'#1d2b36');b.box(0,-.09,.33,.16,.13,.25,'#273d49');b.box(0,-.18,.13,.10,.27,.14,'#152a35',0,-.13);b.box(.088,.006,-.06,.014,.065,.27,'#bfaa64');b.box(.096,-.015,.02,.018,.027,.073,'#e4f967',1);b.box(-.087,.03,-.11,.013,.045,.30,'#9d4a4c');for(let i=0;i<7;i++)b.box(0,.131,-.42+i*.054,.17,.014,.025,'#223943');b.box(0,.166,-.22,.022,.07,.028,'#8a9594');b.box(-.052,.156,.055,.018,.055,.035,'#647979');b.box(.052,.156,.055,.018,.055,.035,'#647979');b.box(0,.203,-.218,.019,.012,.016,'#f56959',1.3);b.box(0,.125,.07,.14,.024,.05,'#536e73');b.box(.13,.032,.10,.07,.055,.04,'#849394');b.box(.07,-.06,-.36,.055,.08,.22,'#51636c');}
 else{b.bevelBox(0,.035,-.09,.14,.17,.44,'#596b72');b.box(0,.032,-.31,.143,.17,.05,'#253e49');b.box(0,-.11,.10,.13,.29,.16,'#253945');b.box(0,-.028,-.09,.145,.066,.36,'#314954');b.box(0,.126,-.22,.020,.034,.032,'#ed895f',.7);b.box(-.04,.123,.082,.022,.028,.04,'#a9c0a3');b.box(.04,.123,.082,.022,.028,.04,'#a9c0a3');b.box(.075,.014,-.10,.02,.028,.23,'#d6b875');for(let z=-.0;z<.11;z+=.025)b.box(.075,.046,z,.008,.06,.01,'#1a303a');}
 return b.upload();}
const rifleMesh=makeWeapon(),pistolMesh=makeWeapon(true),magMesh=new Batch();magMesh.box(0,0,0,.12,.32,.20,'#253640');magMesh.box(0,-.15,0,.15,.05,.22,'#66797c');for(let y=-.09;y<.11;y+=.065)magMesh.box(.066,y,0,.007,.01,.15,'#586b6d');magMesh.upload();
const handMesh=new Batch();handMesh.box(0,0,0,.13,.17,.19,'#334957');handMesh.box(0,.045,-.04,.135,.085,.13,'#7b8d89');handMesh.box(0,-.12,.09,.16,.18,.22,'#263c4d');handMesh.box(.072,-.10,.1,.013,.038,.10,'#67ddd5',.5);for(let x=-.048;x<.06;x+=.032){handMesh.box(x,.023,-.116,.026,.055,.053,'#5c757a');handMesh.box(x,-.020,-.119,.027,.031,.051,'#263e48');}handMesh.box(0,-.24,.20,.17,.29,.28,'#1e3445');handMesh.box(.088,-.24,.20,.014,.16,.17,'#557b82');handMesh.box(.097,-.19,.24,.014,.032,.12,'#72c4c7',.5);handMesh.upload();
// Effects: soft additive sprites (kit/points.js, same size on WebGPU and WebGL2) and one additive
// line set for rain and tracers. Buffers are allocated once and refilled each frame.
const RAIN_MAX=1125,FX_MAX=720,LINE_MAX=(RAIN_MAX+96)*2;
let effects=[],tracers=[],rain=[];for(let i=0;i<RAIN_MAX;i++)rain.push({x:rr(-24,24),y:rr(0,23),z:rr(-44,24),speed:rr(14,23)});
function particle(p,v,color,size=.13,life=.5,alpha=1,gravity=0){effects.push({p:p.slice(),v:v.slice(),c:hex(color),size,life,max:life,alpha,gravity});if(effects.length>700)effects.shift();}
function burst(p,color='#ffd695',n=12){for(let i=0;i<n;i++)particle(p,[rr(-3,3),rr(.5,4),rr(-3,3)],color,rr(.04,.1),rr(.18,.55),1,9);}
function tracer(a,b,color='#ffd394',life=.055){tracers.push({a:a.slice(),b:b.slice(),c:hex(color),life,max:life});}
const fxSprites=createPoints({positions:new Float32Array(FX_MAX*3),colors:new Float32Array(FX_MAX*3),sizes:new Float32Array(FX_MAX),sizeAttenuation:true,material:{transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}});
// Round soft falloff, as the old gl_PointCoord shader had.
fxSprites.material.opacityNode=TSL.pow(TSL.max(TSL.float(1).sub(TSL.uv().sub(.5).length().mul(2)),0),1.8);
fxSprites.setCount(0);scene.add(fxSprites.object);
const linePos=new Float32Array(LINE_MAX*3),lineCol=new Float32Array(LINE_MAX*3),lineGeo=new THREE.BufferGeometry();
lineGeo.setAttribute('position',new THREE.BufferAttribute(linePos,3).setUsage(THREE.DynamicDrawUsage));lineGeo.setAttribute('color',new THREE.BufferAttribute(lineCol,3).setUsage(THREE.DynamicDrawUsage));lineGeo.setDrawRange(0,0);
const fxLines=new THREE.LineSegments(lineGeo,new THREE.LineBasicNodeMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));fxLines.frustumCulled=false;scene.add(fxLines);
function rainCount(){return Math.min(RAIN_MAX,kit.detail(900));}
// Colours carry their alpha (additive blending adds colour × alpha).
let lineV=0;
function seg(ax,ay,az,ar,ag,ab,bx,by,bz,br,bg,bb){if(lineV+2>LINE_MAX)return;let o=lineV*3;linePos[o]=ax;linePos[o+1]=ay;linePos[o+2]=az;lineCol[o]=ar;lineCol[o+1]=ag;lineCol[o+2]=ab;o+=3;linePos[o]=bx;linePos[o+1]=by;linePos[o+2]=bz;lineCol[o]=br;lineCol[o+1]=bg;lineCol[o+2]=bb;lineV+=2;}
function drawFX(){
 const P=fxSprites.positions.array,C=fxSprites.colors.array,S=fxSprites.sizes.array;let n=0;
 for(const e of effects){if(n>=FX_MAX)break;const a=e.alpha*clamp(e.life/e.max,0,1),o=n*3;P[o]=e.p[0];P[o+1]=e.p[1];P[o+2]=e.p[2];C[o]=e.c[0]*a;C[o+1]=e.c[1]*a;C[o+2]=e.c[2]*a;S[n]=e.size*1.3;n++;}
 fxSprites.setCount(n);if(n){fxSprites.positions.needsUpdate=true;fxSprites.colors.needsUpdate=true;fxSprites.sizes.needsUpdate=true;}
 lineV=0;
 const rc=rainCount();for(let i=0;i<rc;i++){const r=rain[i];if(r.z<-47.3&&r.y<5.25)continue;seg(r.x,r.y,r.z,.35*.21,.61*.21,.70*.21,r.x-.045,r.y+.31,r.z+.022,.45*.11,.72*.11,.81*.11);}
 for(const t of tracers){const k=t.life/t.max;seg(t.a[0],t.a[1],t.a[2],t.c[0]*k,t.c[1]*k,t.c[2]*k,t.b[0],t.b[1],t.b[2],t.c[0]*.8*k,t.c[1]*.8*k,t.c[2]*.8*k);}
 lineGeo.setDrawRange(0,lineV);if(lineV){lineGeo.attributes.position.needsUpdate=true;lineGeo.attributes.color.needsUpdate=true;}
}
// Audio is synthesized locally. The score follows combat intensity.
const Audio={ctx:null,master:null,music:null,sfx:null,beat:0,nextBeat:0,started:false,
 init(){if(this.started){this.ctx?.resume();return;}try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();const c=this.ctx;this.master=c.createGain();this.master.gain.value=settings.volume*.65;this.master.connect(c.destination);this.music=c.createGain();this.music.gain.value=.38;this.music.connect(this.master);this.sfx=c.createGain();this.sfx.gain.value=.9;this.sfx.connect(this.master);this.noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const a=this.noiseBuffer.getChannelData(0);let last=0;for(let i=0;i<a.length;i++){const w=Math.random()*2-1;last=(last+.035*w)/1.035;a[i]=last*3.5;}this.whiteBuffer=c.createBuffer(1,c.sampleRate,c.sampleRate);const b=this.whiteBuffer.getChannelData(0);for(let i=0;i<b.length;i++)b[i]=Math.random()*2-1;const rain=c.createBufferSource();rain.buffer=this.whiteBuffer;rain.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;const gain=c.createGain();gain.gain.value=.070;rain.connect(filter);filter.connect(gain);gain.connect(this.master);this.rainGain=gain;rain.start();this.nextBeat=c.currentTime+.05;this.started=true;}catch(e){console.warn('Audio unavailable',e);}},
 tone(freq,dur=.1,vol=.1,type='sine',end=null,delay=0,music=false){if(!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+dur);f.type='lowpass';f.frequency.value=type==='sawtooth'?(threatLevel?1300:540):6000;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(f);f.connect(g);g.connect(music?this.music:this.sfx);o.start(t);o.stop(t+dur+.02);},
 noise(dur=.10,vol=.18,cutoff=2800,delay=0,pan=0){if(!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.whiteBuffer;f.type='lowpass';f.frequency.value=cutoff;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=clamp(pan,-1,1);g.connect(p);p.connect(this.sfx);}else g.connect(this.sfx);s.start(t);s.stop(t+dur+.01);},
 shot(pistol=false,pan=0){this.noise(.095,pistol?.46:.30,3800,0,pan);this.tone(pistol?155:120,.12,pistol?.38:.28,'triangle',35);this.tone(1680,.025,.045,'square',620);this.noise(.035,.04,6800,.09,pan);},
 enemy(pan=0){this.noise(.075,.09,2200,0,pan);this.tone(190,.07,.07,'sawtooth',80);},
 hit(head=false){this.tone(head?1260:810,.07,.09,'triangle',head?2200:460);this.noise(.04,.11,4300);},
 reload(){this.noise(.08,.15,3000);this.tone(390,.05,.07,'square',180);this.noise(.10,.12,4000,.85);this.tone(260,.055,.065,'square',150,.9);},
 hack(){for(let i=0;i<4;i++)this.tone(390+i*160,.10,.12,'sine',null,i*.07);},
 click(ok=true){this.tone(ok?880:140,.07,.10,ok?'sine':'square',ok?1300:80);},
 explosion(){this.noise(.65,.52,1200);this.tone(90,.65,.45,'triangle',24);this.noise(.35,.16,4600,.08);},
 dash(){this.noise(.26,.23,1400);this.tone(110,.2,.06,'sawtooth',330);},
 tick(){if(!this.started||this.ctx.state!=='running')return;const now=this.ctx.currentTime;if(this.nextBeat<now-.6)this.nextBeat=now;while(this.nextBeat<now+.07){const b=this.beat++,delay=Math.max(0,this.nextBeat-now),notes=[36,36,43,36,34,34,41,34,32,32,39,32,34,34,46,41];const f=440*Math.pow(2,(notes[b%16]-69)/12);this.tone(f,.24,threatLevel?.24:.17,'sawtooth',f*.995,delay,true);if(b%2===0)this.tone(145,.18,.25,'sine',38,delay,true);if(b%4===2){this.noise(.065,.08,2400,delay);this.tone(180,.045,.07,'triangle',110,delay,true);}if(threatLevel||b%2)this.noise(.018,.021,6500,delay);if(b%16===0){for(const semi of [0,7,12])this.tone(f*2*Math.pow(2,semi/12),3.5,.055,'triangle',null,delay,true);}if(threatLevel&&b%4===1)this.tone(f*8,.12,.054,'square',f*4,delay,true);this.nextBeat+=60/108/2;}this.master.gain.setTargetAtTime(settings.volume*(mode==='playing'?.65:.40),now,.2);this.music.gain.setTargetAtTime(scan?.16:.38,now,.12);this.sfx.gain.setTargetAtTime(scan?.55:.9,now,.1);this.rainGain?.gain.setTargetAtTime(player.z<-48?.012:scan?.025:.070,now,.5);}
};
// The mission uses the standard on-foot PC layout. All functions below are local.
// Reference: Cyberpunk 2077 Update 2.0, 21 September 2023:
// https://www.cyberpunk.net/en/news/49060/update-2-0
// Control reference: https://cyberpunk2077.wiki.fextralife.com/Controls
let mode='menu',stage=1,elapsed=0,time=0,threatLevel=0,gateLift=0,extraction=0,transfer=0,scan=false,hitTime=0,hurt=0,recoil=0,muzzle=0,killFlash=0,medFlash=0,weaponIndex=0,reloadTime=0,weaponSwap=0,shotWait=0,meleeTime=0,grenades=[],checkpoint=null,frameNumber=0,frameMS=16.6;
let stats={kills:0,shots:0,hits:0,headshots:0,hacks:0,alarms:0,takedowns:0,nonlethal:0},player,foots=0,stepClock=0,scanTarget=null,interactable=null,noticeTimer=0,commsTimer=0,toastTimer=0;
let archiveUnlocked=false,archiveDoorLift=0,roomSeen=false,shardRead=false,coolantTransfer=0,scanLatched=false,scanObject=null,scanLock=0,scanKey='',scanZoom=1,hackSelected=0,hackDetails=false,hackQueue=[],trace=0,traceActive=false,traceAlarm=false,revealUntil=0,holstered=false,wheelOpen=false,wheelSlot=0,wheelDX=0,wheelDY=0,altStart=0,altPending=0,lastAltTap=-1,inspectTime=0,grappleTarget=null,activePanel='inventory',heldAttackAt=0,strongStrike=false;
const weapons=[
 {name:'M-10 RONIN / AUTO',short:'M-10 RONIN',type:'ASSAULT RIFLE',cap:30,ammo:30,reserve:180,damage:27,baseDamage:27,rate:.105,reload:1.45,upgrades:0},
 {name:'K-8 GHOST / SEMI',short:'K-8 GHOST',type:'SUPPRESSED PISTOL',cap:12,ammo:12,reserve:60,damage:46,baseDamage:46,rate:.25,reload:1.16,upgrades:0,suppressed:true},
 {name:'ION EDGE / THERMAL BLADE',short:'ION EDGE',type:'THERMAL BLADE',cap:0,ammo:0,reserve:0,damage:55,baseDamage:55,rate:.48,reload:0,upgrades:0,melee:true},
 {name:'CHROME FISTS / UNARMED',short:'CHROME FISTS',type:'UNARMED',cap:0,ammo:0,reserve:0,damage:34,baseDamage:34,rate:.40,reload:0,upgrades:0,melee:true}
];
const initialEnemies=[{x:3.1,z:-1.1},{x:-3.0,z:-10.0},{x:3.0,z:-20.0},{x:-4.4,z:-23.4},{x:2.0,z:-34.7},{x:-3.0,z:-40.0},{x:3.5,z:-59.7},{x:-3.7,z:-65.8},{x:1.7,z:-70.0,warden:true}];let enemies=[],nextEnemyId=0;
const devices=[
 {id:'archive-camera',name:'ARCHIVE CAM / 07',type:'camera',x:5.9,y:3.55,z:-56.8,active:true,tagged:false,detect:0,yaw:-2.0},
 {id:'coolant',name:'COOLANT CONTROL',type:'coolant',x:coolantPos[0],y:coolantPos[1],z:coolantPos[2]+.46,active:true,tagged:false},
 {id:'archive-speaker',name:'MAINTENANCE TERMINAL',type:'distraction',x:5.1,y:1.44,z:-57.67,active:true,tagged:false},
 {id:'market-speaker',name:'STREET AD TERMINAL',type:'distraction',x:8.8,y:1.82,z:9.55,active:true,tagged:false}
];
function makeEnemy(x,z,aggro=false,warden=false){return{id:nextEnemyId++,name:warden?'ARCHIVE WARDEN':'VANTA SECURITY',x,z,homeX:x,homeZ:z,hp:warden?160:81,maxHp:warden?160:81,alive:true,aggro,warden,stun:0,blind:0,jam:0,burn:0,detect:0,tagged:false,attack:rr(.7,1.5),yaw:rr(-2,2),phase:rr(0,TAU),walk:0,deadTime:0,hit:0,flash:0,patrol:rr(0,TAU),lastSeen:0,loot:false,distracted:0,investigate:null,netTimer:7};}
function spawnEnemy(x,z,aggro=true,warden=false){const e=makeEnemy(x,z,aggro,warden);enemies.push(e);return e;}
function freshPlayer(){return{x:.8,y:1.68,z:53.0,yaw:-.015,pitch:.015,hp:100,armor:diff().armor,maxArmor:diff().armor,ram:12,maxRam:12,stamina:100,meds:2,emp:2,medTimer:0,empTimer:0,overclock:0,overclockCooldown:0,components:0,credits:300,perkPoints:2,earnedPoints:0,perks:{ram:false,charge:false,armor:false},speed:0,bob:0,crouch:0,crouchToggle:false,sprintToggle:false,dashTime:0,dashCooldown:0,dashDir:[0,0],slide:0,invuln:1,lastHurt:0,lastAttack:-5,lastWarning:-20,moveX:0,moveZ:0,footY:0,vy:0,grounded:true,jumpCount:0,airDashed:false,vault:null,blockAt:-10};}
player=freshPlayer();
let unlockPending=false;let mouseDown=false,aiming=false,locked=false,interactLock=false,wheelAcc=0;
function setVisible(id,on){const el=$(id);if(el)el.classList.toggle('hidden',!on);}
// Messages name the keys of the device in use (keyText swaps PC keys for pad or touch names).
function toast(text){$('toast').textContent=keyText(text);$('toast').style.opacity=1;toastTimer=3;}
function notice(label,title,detail,duration=3.1){$('notice-label').textContent=label;$('notice-title').textContent=title;$('notice-detail').textContent=keyText(detail);$('notice').style.opacity=1;noticeTimer=duration;}
const commsQueue=[];
function say(text,duration=7){if(commsTimer>1){commsQueue.push({text,duration});return;}$('comms-text').textContent=keyText(text);$('comms').style.opacity=1;commsTimer=duration;Audio.tone(840,.06,.07,'sine');Audio.tone(1120,.045,.045,'sine',null,.09);}
function resetInputs(){input.settle();interactLock=true;wheelAcc=0;mouseDown=false;aiming=false;scanLatched=false;setScan(false,true);wheelOpen=false;altPending=0;altStart=0;lastAltTap=-1;heldAttackAt=0;setVisible('weapon-wheel',false);if(player){player.sprintToggle=false;player.slide=0;} }
function resetWorld(){enemies=[];nextEnemyId=0;for(const e of initialEnemies)spawnEnemy(e.x,e.z,false,!!e.warden);for(const b of barrels){b.hp=40;b.alive=true;}for(const s of supplies)s.used=false;for(const d of devices){d.active=true;d.tagged=false;d.detect=0;d.cooldown=0;d.alerted=false;}effects=[];tracers=[];grenades=[];gateLift=0;extraction=0;transfer=0;archiveUnlocked=false;archiveDoorLift=0;roomSeen=false;shardRead=false;coolantTransfer=0;scan=false;scanLatched=false;scanObject=null;scanTarget=null;scanKey='';scanLock=0;hackQueue=[];trace=0;traceActive=false;traceAlarm=false;revealUntil=0;holstered=false;wheelOpen=false;inspectTime=0;grappleTarget=null;setVisible('scan-layer',false);setHTML('scan-tags','');document.body.classList.remove('scanning');}
const CHECKPOINT_KEY='checkpoint-v4',QUICKSAVE_KEY='quicksave-v4';
function validSave(s){return !!(s&&s.version===4&&Number.isInteger(s.stage)&&s.stage>=1&&s.stage<=4&&s.player&&Number.isFinite(s.player.x)&&Number.isFinite(s.player.z)&&Array.isArray(s.enemies)&&s.enemies.length<100&&Array.isArray(s.weapons)&&s.weapons.length===4);}
function makeSave(checkpointMode=false){const p=JSON.parse(JSON.stringify(player));p.vault=null;p.vy=0;p.footY=0;p.y=1.68;p.grounded=true;p.jumpCount=0;p.dashTime=0;p.slide=0;p.crouch=0;p.crouchToggle=false;p.sprintToggle=false;if(checkpointMode){p.hp=100;p.armor=p.maxArmor;p.meds=Math.max(1,p.meds);p.emp=Math.max(1,p.emp);p.ram=p.maxRam;p.invuln=2.5;}return{version:4,stage,elapsed,stats:{...stats},player:p,enemies:enemies.map(e=>({...e})),barrels:barrels.map(b=>({alive:b.alive,hp:b.hp})),supplies:supplies.map(s=>s.used),weapons:weapons.map(w=>({...w,ammo:checkpointMode?w.cap:w.ammo,reserve:checkpointMode?Math.max(w.reserve,w.cap*2):w.reserve})),weaponIndex,holstered,devices:devices.map(d=>({...d})),archiveUnlocked,archiveDoorLift,roomSeen,shardRead,trace,traceActive,traceAlarm,revealUntil,gateLift,hackQueue:checkpointMode?[]:hackQueue.map(q=>({...q})),savedAt:Date.now()};}
function saveCheckpoint(){checkpoint=makeSave(true);storage.set(CHECKPOINT_KEY,checkpoint);}
function restoreCheckpoint(s){if(!validSave(s))return false;stage=s.stage;elapsed=s.elapsed||0;stats={kills:0,shots:0,hits:0,headshots:0,hacks:0,alarms:0,takedowns:0,nonlethal:0,...s.stats};player={...freshPlayer(),...s.player,perks:{ram:false,charge:false,armor:false,...s.player.perks}};enemies=s.enemies.map(e=>({...e,attack:1.5,hit:0,flash:0}));nextEnemyId=Math.max(-1,...enemies.map(e=>e.id))+1;(s.barrels||[]).forEach((b,i)=>{if(barrels[i])Object.assign(barrels[i],b);});(s.supplies||[]).forEach((b,i)=>{if(supplies[i])supplies[i].used=b;});s.weapons.forEach((w,i)=>Object.assign(weapons[i],w));(s.devices||[]).forEach((d,i)=>{if(devices[i])Object.assign(devices[i],d);});archiveUnlocked=!!s.archiveUnlocked;archiveDoorLift=s.archiveDoorLift||0;roomSeen=!!s.roomSeen;shardRead=!!s.shardRead;trace=s.trace||0;traceActive=!!s.traceActive;traceAlarm=!!s.traceAlarm;revealUntil=s.revealUntil||0;gateLift=stage>=2?4.3:0;weaponIndex=clamp(s.weaponIndex||0,0,3);holstered=!!s.holstered;hackQueue=(s.hackQueue||[]).map(q=>({...q}));player.invuln=2.5;checkpoint=s;return true;}
function startGame(fromSave=false){const data=fromSave?(checkpoint||storage.get(CHECKPOINT_KEY)):null;Audio.init();resetInputs();resetWorld();extractionActive=false;missionHint=0;for(const f of floats)f.el.remove();floats.length=0;player=freshPlayer();elapsed=0;stats={kills:0,shots:0,hits:0,headshots:0,hacks:0,alarms:0,takedowns:0,nonlethal:0};stage=1;weaponIndex=0;reloadTime=0;shotWait=0;weaponSwap=.25;hurt=0;recoil=0;hitTime=0;foots=0;commsQueue.length=0;commsTimer=0;noticeTimer=0;for(const w of weapons){w.ammo=w.cap;w.reserve=w.cap===30?180:w.cap===12?60:0;w.damage=w.baseDamage;w.upgrades=0;}if(validSave(data))restoreCheckpoint(data);else{checkpoint=null;saveCheckpoint();}
 for(const id of ['menu','pause','death','win','hack','settings','controls','field-panel','grapple-ui','weapon-wheel'])setVisible(id,false);setVisible('hud',true);mode='playing';canvas.focus();if(fromSave)captureMouse();updateObjective();if(!fromSave){notice('NEW CONTRACT','GHOST SIGNAL','MERCY STREET / CONTACT MARA',4);say('Mara is by the car on Mercy Street. Press F near a contact. Iona and Jax can help you get past the checkpoint.',8);}else{notice('CHECKPOINT RESTORED','LINK RESTORED',objectiveData().title.toUpperCase(),3);}updateHUD();}
function captureMouse(){if(mode==='playing'&&!locked)input.lockPointer();} // mouse look also works by dragging when capture is refused
function releaseMouse(){if(document.pointerLockElement){unlockPending=true;input.unlockPointer();}}
function pauseGame(){if(mode!=='playing')return;mode='paused';resetInputs();setVisible('pause',true);$('pause-status').textContent='GHOST SIGNAL / '+(player.z<-54?'COLD ARCHIVE':player.z<-28?'RELAY 06':'NULL MARKET');releaseMouse();}
function resumeGame(){mode='playing';setVisible('pause',false);resetInputs();canvas.focus();captureMouse();}
function returnMenu(){mode='menu';resetInputs();releaseMouse();for(const id of ['pause','win','death','hud','hack','settings','controls','field-panel','grapple-ui'])setVisible(id,false);setVisible('menu',true);commsTimer=0;checkContinue();}
function checkContinue(){setVisible('continue-btn',validSave(storage.get(CHECKPOINT_KEY)));}
function quickSave(){if(mode!=='playing'&&mode!=='paused')return;if(scan||inCombat()||hackQueue.length||player.footY>.05||!player.grounded||player.vault||extractionActive){toast('SAVE BLOCKED · LEAVE COMBAT AND STAND ON THE FLOOR');return;}storage.set(QUICKSAVE_KEY,makeSave());toast(validSave(storage.get(QUICKSAVE_KEY))?'QUICK SAVE COMPLETE':'BROWSER STORAGE IS NOT AVAILABLE');Audio.click();}
function quickLoad(){const s=storage.get(QUICKSAVE_KEY);if(!validSave(s)){toast('NO QUICK SAVE IN THIS BROWSER');return;}checkpoint=s;startGame(true);toast('QUICK SAVE LOADED');}
function objectiveData(){if(stage===1)return{title:'Breach the relay access panel.',sub:'Press F at the yellow marker.',pos:terminalPos,label:'RELAY'};if(stage===2)return{title:'Release the Cold Archive lock.',sub:'Enter the new room. Use the coolant console.',pos:coolantPos,label:'COOLANT'};if(stage===3)return{title:'Take the memory core.',sub:'Hold F at the archive core.',pos:corePos,label:'CORE'};return{title:'Reach the getaway.',sub:'Return through the relay and the market.',pos:extractPos,label:'GETAWAY'};}
function updateObjective(){const o=objectiveData();$('objective').textContent=o.title;$('objective-sub').textContent=o.sub;}
function die(){if(mode!=='playing'&&mode!=='grapple')return;mode='dead';resetInputs();releaseMouse();setVisible('grapple-ui',false);setVisible('death',true);Audio.tone(240,1.6,.22,'sawtooth',25);Audio.noise(.65,.22,900);}
function win(){if(mode!=='playing')return;mode='won';resetInputs();releaseMouse();setVisible('win',true);const m=Math.floor(elapsed/60),ss=Math.floor(elapsed%60);$('stat-time').textContent=String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');$('stat-kills').textContent=stats.kills;$('stat-accuracy').textContent=Math.round(stats.hits/Math.max(stats.shots,1)*100)+'%';$('stat-hacks').textContent=stats.hacks;const rank=stats.alarms===0&&stats.takedowns>=2?'SILENT SIGNAL':stats.alarms===0&&stats.hacks>=2?'GHOST RUNNER':stats.headshots>=5?'CHROME ACE':elapsed<300?'FAST SIGNAL':'STREET OPERATOR';$('rank-value').textContent=rank;$('rank-label').textContent='STREET CRED +'+(900+stats.kills*45+stats.hacks*90+(shardRead?200:0));storage.set('best-v4',{time:elapsed,rank,stats});storage.remove(CHECKPOINT_KEY);checkpoint=null;Audio.hack();for(let i=0;i<4;i++)Audio.tone(261.6*Math.pow(2,[0,4,7,12][i]/12),1.5,.10,'triangle',null,i*.13);}
function hurtPlayer(amount,source,meleeSource=null){if(player.invuln>0||(mode!=='playing'&&mode!=='grapple'))return;if(meleeSource&&aiming&&weaponIndex>=2&&player.stamina>=12&&dot(norm([meleeSource.x-player.x,0,meleeSource.z-player.z]),aimDir())>.25){player.stamina-=12;player.lastAttack=elapsed;if(elapsed-player.blockAt<.3){meleeSource.stun=2.4;toast('PARRY · TARGET STUNNED');Audio.hit(true);return;}amount*=.2;toast('ATTACK BLOCKED');}amount*=diff().damage;const absorb=Math.min(player.armor,amount*.70);player.armor-=absorb;player.hp=Math.max(0,player.hp-(amount-absorb));hurt=Math.min(1,hurt+.38);input.rumble(Math.min(1,.25+amount/40),140);player.lastHurt=elapsed;player.invuln=.08;Audio.noise(.11,.18,950);if(player.hp<=0)die();else if(player.hp<31&&elapsed-player.lastWarning>10){toast('CRITICAL HEALTH · '+pk('heal')+' TO HEAL');player.lastWarning=elapsed;}}
function validCollider(c){return !(c.streetGate&&social.streetLift>4.1)&&!(c.gate&&gateLift>3.5)&&!(c.archiveDoor&&archiveDoorLift>3.65)&&!(c.barrel!==undefined&&!barrels[c.barrel].alive);}
function blocked(x,z,r=.32,height=1.55,foot=0){if(x<-20.12||x>9.05||z<-72.55||z>56.7)return true;for(const c of colliders){if(!validCollider(c)||c.maxY<=foot+.06||c.minY>=foot+height)continue;if(x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ)return true;}return false;}
function moveEntity(e,dx,dz,r=.32,height=1.55){let moved=false;const foot=e===player?player.footY:0;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));for(let i=0;i<steps;i++){if(!blocked(e.x+dx/steps,e.z,r,height,foot)){e.x+=dx/steps;moved=true;}if(!blocked(e.x,e.z+dz/steps,r,height,foot)){e.z+=dz/steps;moved=true;}}return moved;}
function rayBox(origin,dir,c){let near=0,far=1e6;for(let i=0;i<3;i++){const lo=i===0?c.minX:i===1?c.minY:c.minZ,hi=i===0?c.maxX:i===1?c.maxY:c.maxZ;if(Math.abs(dir[i])<1e-7){if(origin[i]<lo||origin[i]>hi)return Infinity;}else{let a=(lo-origin[i])/dir[i],b=(hi-origin[i])/dir[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}}return far>=0?near:Infinity;}
function wallRay(origin,dir,maxDist=150){let near=maxDist,collider=null;for(const c of colliders){if(!validCollider(c))continue;const d=rayBox(origin,dir,c);if(d<near){near=d;collider=c;}}if(dir[1]<-.001){const ground=-origin[1]/dir[1];if(ground>0&&ground<near){near=ground;collider={floor:true};}}return{dist:near,collider};}
function lineOfSight(a,b){const delta=sub(b,a),d=Math.hypot(...delta);return wallRay(a,mul(delta,1/(d||1)),d).dist>=d-.12;}
function aimDir(spread=0){const yaw=player.yaw+rr(-spread,spread),pitch=player.pitch+rr(-spread,spread);return[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];}
function enemyRay(o,d,maxD){let found=null,best=maxD;for(const e of enemies){if(!e.alive)continue;const head={minX:e.x-.245,maxX:e.x+.245,minY:1.44,maxY:1.88,minZ:e.z-.245,maxZ:e.z+.245},body={minX:e.x-.36,maxX:e.x+.36,minY:.18,maxY:1.44,minZ:e.z-.31,maxZ:e.z+.31};const hd=rayBox(o,d,head),bd=rayBox(o,d,body);if(hd<best){best=hd;found={e,dist:hd,head:true};}if(bd<best){best=bd;found={e,dist:bd,head:false};}}return found;}
function alertEnemies(x,z,radius=28){for(const e of enemies)if(e.alive&&Math.hypot(e.x-x,e.z-z)<radius){e.aggro=true;e.lastSeen=elapsed;}}
function damageEnemy(e,amount,head=false,silent=false,nonlethal=false){if(!e.alive)return;e.hp-=amount;e.hit=.16;if(!silent){e.aggro=true;e.lastSeen=elapsed;}if(e.hp<=0){e.hp=0;e.alive=false;e.deadTime=0;e.nonlethal=nonlethal;stats.kills++;if(nonlethal)stats.nonlethal++;if(head)stats.headshots++;burst([e.x,1.25,e.z],'#75dce3',9);Audio.tone(420,.12,.065,'sine',160);killFlash=.18;floatText(nonlethal?'NONLETHAL +150':head?'HEADSHOT +150':'+100 XP',[e.x,2.05,e.z],'#e5ff47',1.2);}else burst([e.x,1.2,e.z],'#ed927e',5);}
function fire(){if(mode!=='playing'||scan||wheelOpen||reloadTime>0||weaponSwap>0||shotWait>0||meleeTime>0)return;if(holstered){holstered=false;weaponSwap=.22;return;}const w=weapons[weaponIndex];if(w.melee){melee(false);return;}if(w.ammo<=0){if(w.reserve>0)reload();else{Audio.click(false);shotWait=.35;toast('NO AMMO · USE THE WHEEL TO CHANGE WEAPON');}return;}markAggression('WEAPON FIRED');w.ammo--;stats.shots++;player.stamina=Math.max(0,player.stamina-(weaponIndex===0?4:7));player.lastAttack=elapsed;shotWait=w.rate;recoil+=weaponIndex?.09:.055;muzzle=.055;const o=[player.x,player.y,player.z],spread=(aiming?.0018:.010)+(player.speed>5?.016:0)+(player.crouch>.4?-.001:0)+(player.stamina<15?.018:0);const d=aimDir(Math.max(.001,spread));let hit=wallRay(o,d),target=enemyRay(o,d,hit.dist);const droneHit=droneRay(o,d,target?target.dist:hit.dist);if(droneHit)target=null;const end=add(o,mul(d,droneHit?droneHit.dist:target?target.dist:hit.dist));const right=[Math.cos(player.yaw),0,Math.sin(player.yaw)];tracer(add(add(o,mul(d,.55)),add(mul(right,.20),[0,-.14,0])),end,weaponIndex?'#b1ece8':'#ffd496');Audio.shot(weaponIndex===1);input.rumble(weaponIndex?.22:.14,weaponIndex?70:45);alertEnemies(player.x,player.z,w.suppressed?3.2:27);
 if(droneHit){stats.hits++;hitTime=.13;$('hitmarker').style.borderColor='#e1ffff';damageDrone(droneHit.d,w.damage);Audio.hit(false);}else if(target){stats.hits++;const damage=target.head?Math.round(w.damage*3.5):w.damage;damageEnemy(target.e,damage,target.head,w.suppressed&&!target.e.aggro);hitTime=.13;$('hitmarker').style.borderColor=target.head?'#e5ff47':'#e1ffff';floatText(String(damage),add(end,[rr(-.15,.15),.18,0]),target.head?'#e5ff47':'#f6eece',.65);Audio.hit(target.head);}else{burst(end,'#ffd49a',7);if(hit.collider?.barrel!==undefined){const b=barrels[hit.collider.barrel];b.hp-=w.damage;if(b.hp<=0)explodeBarrel(b);}for(const dv of devices){if(dv.type==='camera'&&dv.active&&Math.hypot(dv.x-end[0],dv.y-end[1],dv.z-end[2])<.8){dv.active=false;toast('CAMERA DESTROYED');}}}
 const shellP=add(add(o,mul(right,.3)),[0,-.15,0]);particle(shellP,add(mul(right,rr(1.5,3)),[0,rr(1.2,2.2),0]),'#e4c57d',.055,1,1,9.8);
}
function reload(){const w=weapons[weaponIndex];if(mode!=='playing'||scan||wheelOpen||w.melee||reloadTime>0||w.ammo===w.cap||w.reserve<=0)return;holstered=false;reloadTime=w.reload;aiming=false;Audio.reload();}
function switchWeapon(i){if(mode!=='playing'&&mode!=='panel')return;i=clamp(Math.round(i),0,3);if(i===weaponIndex&&!holstered)return;weaponIndex=i;holstered=false;reloadTime=0;weaponSwap=.3;shotWait=.25;recoil=0;mouseDown=false;aiming=false;Audio.noise(.10,.12,3200);}
function medpatch(){if(mode!=='playing'||scan||wheelOpen)return;if(player.meds<=0){toast('HEALTH ITEM RECHARGING');Audio.click(false);return;}if(player.hp>=100){toast('HEALTH IS FULL');return;}player.meds--;if(player.medTimer<=0)player.medTimer=healthRecharge();player.hp=Math.min(100,player.hp+65);medFlash=.4;Audio.tone(400,.24,.13,'sine',1100);toast('HEALTH +65 · CHARGE REPLENISHES OVER TIME');}
function healthRecharge(){return player.perks.charge?16:24;}function empRecharge(){return player.perks.charge?20:30;}
function inCombat(){return threatLevel>0||enemies.some(e=>e.alive&&!neutralEnemy(e)&&e.aggro&&elapsed-e.lastSeen<8&&Math.hypot(e.x-player.x,e.z-player.z)<35);}
function dash(){if(mode!=='playing'||scan||wheelOpen||player.dashCooldown>0||player.vault||lowClearance(player.x,player.z)||stealth.carryId!==null)return;const cost=inCombat()?22:0;if(player.stamina<cost)return;if(!player.grounded&&player.airDashed)return;const mv=input.vector('move');let x=mv.x,z=mv.y;if(Math.hypot(x,z)<.2){x=0;z=1;}const len=Math.hypot(x,z);x/=len;z/=len;player.dashDir=[Math.cos(player.yaw)*x+Math.sin(player.yaw)*z,Math.sin(player.yaw)*x-Math.cos(player.yaw)*z];player.dashTime=.20;player.dashCooldown=.48;player.stamina-=cost;player.invuln=Math.max(player.invuln,.13);if(!player.grounded){player.airDashed=true;player.vy=Math.max(player.vy,1);}Audio.dash();}
function toggleCrouch(hold=false){if(mode!=='playing'||scan||wheelOpen)return;if(!hold)player.crouchToggle=!player.crouchToggle;if((hold||player.crouchToggle)&&player.speed>6&&player.grounded){player.slide=.62;player.sprintToggle=false;if(inCombat())player.stamina=Math.max(0,player.stamina-10);Audio.dash();}}
function jump(){if(mode!=='playing'||scan||wheelOpen||player.vault)return;player.crouchToggle=false;player.slide=0;if(lowClearance(player.x,player.z)||stealth.carryId!==null){player.crouchToggle=lowClearance(player.x,player.z);toast('NO JUMP / LOW CEILING OR BODY CARRIED');return;}if(player.grounded&&tryVault())return;if(player.jumpCount>=2)return;const cost=inCombat()?10:0;if(player.stamina<cost)return;player.stamina-=cost;player.vy=7.1;player.grounded=false;player.jumpCount++;Audio.noise(.14,.06,850);if(player.jumpCount===2){Audio.tone(175,.16,.07,'triangle',400);particle([player.x,.15+player.footY,player.z],[0,-1,0],'#75d9ef',.7,.25,.35);}}
function tryVault(){const dx=Math.sin(player.yaw),dz=-Math.cos(player.yaw);const ray=wallRay([player.x,player.footY+.65,player.z],[dx,0,dz],1.25);const c=ray.collider;if(!c||c.floor||c.gate||c.archiveDoor||c.maxY>player.footY+1.6||c.maxY<player.footY+.45)return false;const tx=player.x+dx*2.45,tz=player.z+dz*2.45;if(blocked(tx,tz,.32,1.65,0))return false;player.vault={fromX:player.x,fromZ:player.z,toX:tx,toZ:tz,fromY:player.footY,peak:c.maxY+.22,t:0};player.grounded=false;Audio.dash();return true;}
function setScan(on,silent=false){on=!!on;if(on&&mode!=='playing')return;if(scan===on){if(!on){setVisible('scan-layer',false);document.body.classList.remove('scanning');}return;}scan=on;setVisible('scan-layer',on);document.body.classList.toggle('scanning',on);mouseDown=false;aiming=false;scanLock=0;scanKey='';scanObject=null;hackSelected=0;scanZoom=1;if(on){player.sprintToggle=false;player.slide=0;wheelOpen=false;setVisible('weapon-wheel',false);}if(!silent){Audio.tone(on?210:640,.22,.09,'sine',on?980:160);Audio.noise(.12,.035,3800);}}
function toggleScan(){scanLatched=!scanLatched;setScan(scanLatched||input.down('scan'));}
const HACKS={
 short:{name:'SHORT CIRCUIT',cost:4,time:.7,trace:true,detail:'45 electrical damage. Stuns the target for 3.8 seconds.'},
 optics:{name:'REBOOT OPTICS',cost:3,time:.55,trace:false,detail:'Blinds the target for 8 seconds. This upload does not start a trace.'},
 jam:{name:'WEAPON GLITCH',cost:3,time:.6,trace:true,detail:'Stops the target from firing for 9 seconds. The target can still move.'},
 ping:{name:'PING',cost:2,time:.4,trace:false,detail:'Reveals local guards and devices through cover for 12 seconds.'},
 heat:{name:'OVERHEAT',cost:4,time:.85,trace:true,detail:'Deals 14 thermal damage each second for 6 seconds.'},
 disable:{name:'TURN OFF',cost:2,time:.6,trace:false,detail:'Disables this camera for the rest of the mission.'},
 distract:{name:'DISTRACT ENEMIES',cost:2,time:.5,trace:false,detail:'Makes nearby guards inspect the sound source for 8 seconds.'},
 override:{name:'OVERRIDE LOCK',cost:4,time:1.1,trace:false,detail:'Releases the coolant interlock. The memory core becomes accessible.'},
 detonate:{name:'DETONATE',cost:4,time:.7,trace:true,detail:'Overloads the power cell. The explosion can damage nearby guards.'}
};
function scanActions(t=scanObject){if(!t)return[];if(t.kind==='enemy')return['short','optics','jam','ping','heat'];if(t.kind==='barrel')return['detonate','ping'];if(t.kind==='device'){if(t.obj.type==='camera')return t.obj.active?['disable','ping']:['ping'];if(t.obj.type==='coolant')return archiveUnlocked?['ping']:['override','ping'];return['distract','ping'];}return[];}
function objectId(t){return t?t.kind+':'+(t.obj.id??t.index??0):'';}
function objectPosition(t){if(!t)return[0,0,0];if(t.pos)return t.pos;return[t.obj.x,t.kind==='enemy'?1.3:(t.obj.y??.7),t.obj.z];}
function findScanObject(){const o=[player.x,player.y,player.z],d=aimDir(),wall=wallRay(o,d,35),eh=enemyRay(o,d,Math.min(wall.dist+.1,35));let best=eh?{kind:'enemy',obj:eh.e,pos:[eh.e.x,1.3,eh.e.z],dist:eh.dist}:null;let near=best?best.dist:35;
 const test=(kind,obj,index,pos,r=.6)=>{const delta=sub(pos,o),dist=Math.hypot(...delta),along=dot(delta,d);if(dist>35||along<0||dist>near)return;const obstruction=wallRay(o,mul(delta,1/(dist||1)),dist);const own=(kind==='barrel'&&obstruction.collider?.barrel===index)||(kind==='device'&&obstruction.collider?.device===obj.id);if(obstruction.dist<dist-.12&&!own)return;const offset=Math.hypot(...sub(delta,mul(d,along)));if(offset<r){best={kind,obj,index,pos,dist};near=dist;}};
 for(const dv of devices)test('device',dv,dv.id,[dv.x,dv.y,dv.z],dv.type==='camera'?.65:.85);
 barrels.forEach((b,i)=>{if(b.alive)test('barrel',b,i,[b.x,.65,b.z],.56);});
 if(stage===1)test('terminal',{name:'RELAY ACCESS PANEL'},0,terminalPos,.8);
 if(stage<4)test('core',{name:'GHOST SIGNAL CORE'},0,[corePos[0],1.75,corePos[2]],.75);
 supplies.forEach((sp,i)=>{if(!sp.used)test('supply',sp,i,[sp.x,.45,sp.z],.65);});return best;}
function tagTarget(){if(!scan||!scanObject)return;const o=scanObject.obj;if(scanObject.kind!=='enemy'&&scanObject.kind!=='device')return;o.tagged=!o.tagged;Audio.click();toast(o.tagged?'TARGET TAGGED · VISIBLE THROUGH COVER':'TARGET TAG REMOVED');}
function queueTarget(q){if(q.kind==='enemy'){const e=enemies.find(e=>e.id===q.id);return e?.alive?{kind:'enemy',obj:e}:null;}if(q.kind==='device'){const d=devices.find(d=>d.id===q.id);return d?{kind:'device',obj:d}:null;}if(q.kind==='barrel'){const b=barrels[q.id];return b?.alive?{kind:'barrel',obj:b,index:q.id}:null;}return null;}
function executeHack(){if(!scan||!scanObject)return;if(scanLock<.99){toast('SCANNING · KEEP THE TARGET IN VIEW');return;}const list=scanActions(),id=list[clamp(hackSelected,0,list.length-1)];if(id)queueHack(scanObject,id);}
function queueHack(t,id){const h=HACKS[id];if(!h||!t)return false;const targetId=t.kind==='barrel'?t.index:t.obj.id;if(hackQueue.filter(q=>q.kind===t.kind&&q.id===targetId).length>=2){toast('TARGET QUEUE FULL · TWO UPLOADS MAXIMUM');return false;}if(hackQueue.length>=6){toast('UPLOAD QUEUE FULL');return false;}const deficit=Math.max(0,h.cost-player.ram);if(deficit>0){if(player.overclock<=0){toast('NOT ENOUGH RAM · WAIT FOR RECHARGE');Audio.click(false);return false;}const hpCost=Math.ceil(deficit*5);if(player.hp-hpCost<10){toast('OVERCLOCK BLOCKED · HEALTH TOO LOW');return false;}player.hp-=hpCost;player.ram=0;hurt=.15;}else player.ram-=h.cost;hackQueue.push({kind:t.kind,id:targetId,hack:id,left:h.time,total:h.time});Audio.tone(560,.13,.06,'triangle',1040);toast(h.name+' · QUEUED');return true;}
function quickhack(e){return queueHack({kind:'enemy',obj:e},'short');}
function applyHack(q,t){const h=HACKS[q.hack],e=t.obj;stats.hacks++;Audio.hack();if(h.trace&&!traceAlarm){traceActive=true;trace=Math.max(5,trace);}switch(q.hack){case'short':e.stun=3.8;damageEnemy(e,45);break;case'optics':e.blind=8;e.detect=0;break;case'jam':e.jam=9;e.aggro=true;break;case'heat':e.burn=6;e.aggro=true;break;case'ping':revealUntil=elapsed+12;break;case'disable':e.active=false;e.detect=0;break;case'distract':for(const en of enemies)if(en.alive&&!en.aggro&&Math.hypot(en.x-e.x,en.z-e.z)<22){en.distracted=8;en.investigate=[e.x,e.z];}e.cooldown=8;Audio.tone(340,.5,.16,'square',850);break;case'override':unlockArchive();break;case'detonate':explodeBarrel(e);break;}const p=objectPosition(t);for(let i=0;i<16;i++)particle(add(p,[rr(-.4,.4),rr(-.5,.5),rr(-.4,.4)]),[rr(-1,1),rr(.2,2),rr(-1,1)],'#ed657f',rr(.04,.12),rr(.2,.7),1);toast(h.name+' · COMPLETE');}
function activateOverclock(){if(mode!=='playing'||wheelOpen)return;if(player.overclock>0){toast('OVERCLOCK IS ACTIVE');return;}if(player.overclockCooldown>0){toast('OVERCLOCK RECHARGING · '+Math.ceil(player.overclockCooldown)+' S');return;}player.overclock=9;player.overclockCooldown=35;Audio.tone(130,.6,.12,'sawtooth',620);notice('CYBERDECK / ACTIVE','OVERCLOCK','INSUFFICIENT RAM USES HEALTH / 9 SECONDS',2.4);}
function throwEMP(){if(mode!=='playing'||scan||wheelOpen)return;if(player.emp<=0){toast('EMP RECHARGING');return;}markAggression('EMP THROWN');player.emp--;if(player.empTimer<=0)player.empTimer=empRecharge();const d=aimDir(),p=[player.x,player.y-.15,player.z];grenades.push({p:add(p,mul(d,.65)),v:add(mul(d,12),[0,2.8,0]),timer:1.22});weaponSwap=.25;Audio.noise(.13,.16,1100);}
function explode(p,radius=6.2,damage=110,emp=false){Audio.explosion();for(let i=0;i<52;i++)particle(p,[rr(-8,8),rr(-2,8),rr(-8,8)],emp?'#6ddef6':pick(['#ffc387','#ff674d','#e9dc9b']),rr(.07,.26),rr(.25,.95),1,6);particle(p,[0,.6,0],emp?'#387a92':'#8f5f43',7,.55,.7,0);for(const e of enemies){if(!e.alive)continue;const dist=Math.hypot(e.x-p[0],e.z-p[2]);if(dist<radius&&lineOfSight(p,[e.x,1.2,e.z])){if(emp)e.stun=4;damageEnemy(e,damage*(1-dist/(radius*1.65)));}}for(const b of barrels){if(b.alive&&Math.hypot(b.x-p[0],b.z-p[2])<radius*.65){b.alive=false;burst([b.x,.7,b.z],'#f4af83',18);}}for(const d of devices)if(d.type==='camera'&&emp&&Math.hypot(d.x-p[0],d.z-p[2])<radius)d.active=false;const dist=Math.hypot(player.x-p[0],player.z-p[2]);if(!emp&&dist<radius)hurtPlayer(35*(1-dist/radius),p);hurt=Math.max(hurt,dist<12?.14:0);alertEnemies(p[0],p[2],35);}
function explodeBarrel(b){if(!b.alive)return;b.alive=false;explode([b.x,.7,b.z],5.6,130,false);}
function melee(strong=false,quick=false){if(mode!=='playing'||scan||wheelOpen||meleeTime>0||reloadTime>0)return;const cost=strong?24:quick?12:14;if(player.stamina<cost){toast('LOW STAMINA');return;}markAggression('MELEE ATTACK');player.stamina-=cost;player.lastAttack=elapsed;holstered=false;strongStrike=strong;meleeTime=strong?.62:.42;shotWait=meleeTime;Audio.noise(.20,strong?.26:.17,1200);let hit=false;const reach=weaponIndex===2&&!quick?2.8:2.15,damage=quick?34:weapons[weaponIndex].melee?Math.round(weapons[weaponIndex].damage*(strong?1.9:1)):34;for(const e of enemies){if(!e.alive)continue;const d=[e.x-player.x,0,e.z-player.z];if(Math.hypot(...d)<reach&&dot(norm(d),aimDir())>.57&&Math.abs(player.footY)<1.3&&lineOfSight([player.x,player.y-.3,player.z],[e.x,1.3,e.z])){damageEnemy(e,damage,false,false,weaponIndex===3&&!quick);e.stun=strong?1.3:.35;hit=true;hitTime=.2;Audio.hit();}}if(hit)toast(strong?'STRONG STRIKE':'MELEE HIT');}
function canGrab(e){if(neutralEnemy(e)||!e.alive||e.aggro||player.footY>.2)return false;const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz);return d<1.85&&(Math.sin(e.yaw)*dx+Math.cos(e.yaw)*dz)/(d||1)<-.25&&lineOfSight([player.x,1.3,player.z],[e.x,1.3,e.z]);}
function beginGrapple(e){if(!canGrab(e))return;grappleTarget=e;mode='grapple';resetInputs();setVisible('grapple-ui',true);Audio.noise(.25,.13,700);}
function completeGrapple(lethal=false){const e=grappleTarget;if(mode!=='grapple'||!e)return;stats.takedowns++;damageEnemy(e,e.hp+1,false,true,!lethal);grappleTarget=null;mode='playing';setVisible('grapple-ui',false);resetInputs();toast(lethal?'LETHAL TAKEDOWN':'NONLETHAL TAKEDOWN');}

const floats=[];
function floatText(text,p,color,life){const el=document.createElement('div');el.className='float-number';el.textContent=text;el.style.color=color;$('hud').appendChild(el);floats.push({el,p:p.slice(),life,max:life});}
const extractPos=[-3.1,0,50.2];let extractionActive=false,missionHint=0;
colliders.push({minX:-7.85,maxX:-4.65,minZ:47.6,maxZ:53.4,minY:0,maxY:2.2});
let hackState=null;
function openHack(){if(mode!=='playing'||stage!==1)return;mode='hacking';resetInputs();scan=false;setVisible('scan-layer',false);releaseMouse();setVisible('hack',true);const codes=['1C','BD','55','E9','7A'];const grid=Array.from({length:25},()=>pick(codes));grid[2]='1C';grid[17]='BD';grid[19]='55';grid[9]='E9';hackState={grid,sequence:['1C','BD','55','E9'],step:0,row:0,col:0,axis:'row',trace:0,time:20,started:false,used:[]};renderHack();Audio.hack();}
function renderHack(){const h=hackState;if(!h)return;$('hack-grid').innerHTML='';h.grid.forEach((code,i)=>{const b=document.createElement('button');b.className='code-cell';b.textContent=code;b.setAttribute('aria-label',`Row ${Math.floor(i/5)+1}, column ${i%5+1}: ${code}`);const active=h.axis==='row'?Math.floor(i/5)===h.row:i%5===h.col;if(active&&!h.used.includes(i))b.classList.add('active');else b.disabled=true;if(h.used.includes(i))b.classList.add('used');b.addEventListener('click',()=>chooseCode(i));$('hack-grid').appendChild(b);});$('hack-sequence').innerHTML=h.sequence.map((s,i)=>`<span class="${i<h.step?'done':i===h.step?'current':''}">${s}</span>`).join('');$('hack-instruction').textContent=String(h.step+1).padStart(2,'0')+' / SELECT '+h.sequence[h.step]+' IN '+(h.step===0?'THE TOP ROW':h.axis==='col'?'THIS COLUMN':'THIS ROW');$('hack-trace').textContent='TRACE: '+h.trace+' / 3';$('hack-timer').textContent=h.time.toFixed(1);}
function chooseCode(i){if(mode!=='hacking'||!hackState)return;const h=hackState;if(!Number.isInteger(i)||i<0||i>24||h.used.includes(i)||(h.axis==='row'?Math.floor(i/5)!==h.row:i%5!==h.col))return;h.started=true;const ok=h.grid[i]===h.sequence[h.step];Audio.click(ok);if(!ok){h.trace++;h.step=0;h.axis='row';h.row=0;h.used=[];if(h.trace>=3){finishHack(true);return;}renderHack();return;}h.used.push(i);h.row=Math.floor(i/5);h.col=i%5;h.axis=h.axis==='row'?'col':'row';h.step++;if(h.step===4){finishHack(false);return;}renderHack();}
function cancelHack(){if(mode!=='hacking')return;hackState=null;setVisible('hack',false);mode='playing';resetInputs();canvas.focus();captureMouse();}

function finishHack(forced=false){if(mode!=='hacking')return;setVisible('hack',false);hackState=null;stage=2;mode='playing';resetInputs();captureMouse();if(forced){stats.alarms++;spawnEnemy(4.6,-17.5,true);spawnEnemy(-2.1,-30.4,true);alertEnemies(0,-27,40);notice('SECURITY ALERT','ACCESS FORCED','02 / ENTER THE COLD ARCHIVE',3.5);say('The gate is open. Go through the relay. The Cold Archive is behind the rear shutter.',7);Audio.tone(480,.8,.15,'sawtooth',230);}else{notice('BREACH COMPLETE','ACCESS GRANTED','02 / RELEASE THE COOLANT LOCK',3.5);say('The rear shutter is unlocked. Go to the Cold Archive. Use the coolant control to release the core lock.',7);Audio.hack();}updateObjective();saveCheckpoint();toast('CHECKPOINT SAVED');}
function unlockArchive(){if(stage!==2||archiveUnlocked)return;archiveUnlocked=true;stage=3;coolantTransfer=0;traceActive=false;trace=0;notice('COOLANT RELEASED','CORE LOCK OPEN','03 / TAKE THE MEMORY CORE',3.5);say('The core is ready. It is on the center stand at the back of the room. Hold F to take it.',7);Audio.hack();updateObjective();saveCheckpoint();toast('CORE UNLOCKED · CHECKPOINT SAVED');}
function takeCore(){if(stage!==3||!archiveUnlocked)return;stage=4;transfer=0;resetInputs();spawnEnemy(4.3,-17,true);spawnEnemy(-4.9,-8.1,true);spawnEnemy(2.4,5,true);spawnEnemy(-2.1,-33,true);for(const e of enemies)if(e.alive){e.aggro=true;e.lastSeen=elapsed;}updateObjective();notice('CORE SECURED','RETURN TO THE MARKET','04 / REACH THE GETAWAY',4);commsTimer=0;commsQueue.length=0;say('You have the core. More guards are on the way. Return through the relay. My car is at the south end of Mercy Street.',8);Audio.tone(430,.9,.16,'sawtooth',180);saveCheckpoint();toast('CORE SECURED · CHECKPOINT SAVED');}
function interact(){if(mode!=='playing'||wheelOpen)return;if(scan){executeHack();return;}updateInteractions(0);if(!interactable)return;switch(interactable.type){case'terminal':openHack();break;case'grab':beginGrapple(interactable.enemy);break;case'loot':{const e=interactable.enemy;if(e.loot)return;e.loot=true;weapons[0].reserve+=15;weapons[1].reserve+=4;player.components+=5;player.credits+=40;Audio.click();toast('COLLECTED · 15 RIFLE / 4 PISTOL / 5 COMPONENTS / €$40');break;}case'supply':{const s=supplies[interactable.index];if(s.used)return;s.used=true;player.meds=Math.min(2,player.meds+1);player.emp=Math.min(2,player.emp+1);player.hp=Math.min(100,player.hp+25);player.armor=Math.min(player.maxArmor,player.armor+25);player.components+=10;weapons[0].reserve+=90;weapons[1].reserve+=24;Audio.hack();toast('SUPPLIES · AMMO / HEALTH / EMP / 10 COMPONENTS');break;}case'shard':if(!shardRead){shardRead=true;player.credits+=200;player.components+=10;Audio.hack();toast('ARCHIVE LOG SAVED · €$200 / 10 COMPONENTS');openField('journal');}break;case'exit':if(!extractionActive){extractionActive=true;extraction=0;notice('DRIVER CONNECTED','HOLD THE PICKUP','STAY IN THE RING',2.3);commsTimer=0;say('I have your signal. Stay in the ring until the doors open.',5);Audio.hack();}break;}}
function updateInteractions(dt){interactable=null;const o=[player.x,player.y,player.z],d=aimDir();if(scan){const next=findScanObject(),key=objectId(next);if(key!==scanKey){scanKey=key;scanLock=0;hackSelected=0;}scanObject=next;scanTarget=next?.kind==='enemy'?next.obj:null;scanLock=next?Math.min(1,scanLock+dt/0.42):0;setVisible('interaction',false);return;}scanObject=null;scanLock=0;scanKey='';const eh=enemyRay(o,d,Math.min(wallRay(o,d,28).dist,28));scanTarget=eh?.e||null;
 const near=(p,r)=>Math.hypot(player.x-p[0],player.z-p[2])<r&&Math.abs(player.footY)<1.1;
 if(stage===1&&near(terminalPos,2.65)){interactable={type:'terminal'};showPrompt('BREACH ACCESS PANEL','VANTA / LOCAL NETWORK',false);}
 else if(stage===2&&near(coolantPos,2.35)){interactable={type:'coolant'};showPrompt('HOLD TO RELEASE COOLANT','CORE INTERLOCK / '+Math.floor(coolantTransfer/1.4*100)+'%',true);if(interactHeld()){coolantTransfer+=dt;if(coolantTransfer>=1.4)unlockArchive();}else coolantTransfer=0;$('action-progress').firstElementChild.style.width=clamp(coolantTransfer/1.4*100,0,100)+'%';}
 else if(stage===3&&near(corePos,2.7)){interactable={type:'core'};showPrompt('HOLD TO TAKE CORE','MEMORY TRANSFER / '+Math.floor(transfer/1.8*100)+'%',true);if(interactHeld()){transfer+=dt;if(transfer>=1.8)takeCore();}else transfer=0;$('action-progress').firstElementChild.style.width=clamp(transfer/1.8*100,0,100)+'%';}
 else if(stage===2&&near(corePos,2.7)){showPrompt('CORE LOCKED','RELEASE THE COOLANT LOCK FIRST',false);}
 else if(stage===4&&near(extractPos,2.85)){interactable={type:'exit'};showPrompt(extractionActive?'HOLD THE PICKUP':'CALL THE GETAWAY',extractionActive?'DOORS OPEN IN '+Math.max(0,4.5-extraction).toFixed(1)+' S':'MARA / SECURE TRANSPORT',extractionActive);if(extractionActive){extraction+=dt;$('action-progress').firstElementChild.style.width=clamp(extraction/4.5*100,0,100)+'%';if(extraction>=4.5)win();}}
 else{transfer=0;coolantTransfer=0;const grab=enemies.find(canGrab);if(grab){interactable={type:'grab',enemy:grab};showPrompt('GRAB GUARD','CHOOSE A LETHAL OR NONLETHAL TAKEDOWN',false);}else if(!shardRead&&near(shardPos,1.85)){interactable={type:'shard'};showPrompt('TAKE ARCHIVE LOG','OPTIONAL / DATA SHARD',false);}else{for(let i=0;i<supplies.length;i++){const s=supplies[i];if(!s.used&&near([s.x,0,s.z],1.9)){interactable={type:'supply',index:i};showPrompt('TAKE SUPPLIES','AMMO / HEALTH / EMP / COMPONENTS',false);break;}}if(!interactable){const e=enemies.find(e=>!e.alive&&!e.loot&&near([e.x,0,e.z],1.9));if(e){interactable={type:'loot',enemy:e};showPrompt('TAKE EQUIPMENT','AMMO / COMPONENTS / CREDITS',false);}else setVisible('interaction',false);}}}
}
function showPrompt(text,sub,progress){setVisible('interaction',true);setText('interact-key',pk('interact'));setText('interact-text',text);setText('interact-sub',keyText(sub));setVisible('action-progress',progress);}
function updatePlayer(dt){const mv=input.vector('move');let x=mv.x,z=mv.y;if(wheelOpen){x=0;z=0;}const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}if(z<=0)player.sprintToggle=false;const combat=inCombat();const crouched=player.crouchToggle||input.down('crouchHold')||player.slide>0||lowClearance(player.x,player.z);const sprint=(player.sprintToggle||input.down('sprintHold')||(input.source==='touch'&&len>.96&&z>.7))&&z>0&&!aiming&&!scan&&!crouched&&(!combat||player.stamina>0);let speed=sprint?8.2:aiming?3.05:4.75;if(crouched)speed=2.65;if(stealth.carryId!==null)speed=Math.min(speed,social.skills.body>=5?2.25:1.65);if(scan)speed*=.45;player.crouch=lerp(player.crouch,crouched?1:0,Math.min(1,dt*12));if(sprint&&len&&combat){player.stamina=Math.max(0,player.stamina-12*dt);player.lastAttack=elapsed;}else if(elapsed-player.lastAttack>.6)player.stamina=Math.min(100,player.stamina+dt*24);
 let dx=(Math.cos(player.yaw)*x+Math.sin(player.yaw)*z)*speed*dt,dz=(Math.sin(player.yaw)*x-Math.cos(player.yaw)*z)*speed*dt;if(player.dashTime>0){player.dashTime=Math.max(0,player.dashTime-dt);dx=player.dashDir[0]*17*dt;dz=player.dashDir[1]*17*dt;}if(player.slide>0){player.slide=Math.max(0,player.slide-dt);dx=Math.sin(player.yaw)*10.5*dt;dz=-Math.cos(player.yaw)*10.5*dt;}
 const ox=player.x,oz=player.z;if(player.vault){const v=player.vault;v.t+=dt;const k=clamp(v.t/.43,0,1);player.x=lerp(v.fromX,v.toX,k);player.z=lerp(v.fromZ,v.toZ,k);player.footY=lerp(v.fromY,0,k)+Math.sin(k*Math.PI)*v.peak;if(k>=1){player.vault=null;player.footY=0;player.vy=0;player.grounded=true;player.jumpCount=0;player.airDashed=false;}}else{const oldY=player.footY;moveEntity(player,dx,dz,.32,1.55-player.crouch*.45);let support=0;for(const c of colliders){if(!validCollider(c)||c.maxY>oldY+.12||c.minY>=oldY+1.5)continue;if(player.x+.25>c.minX&&player.x-.25<c.maxX&&player.z+.25>c.minZ&&player.z-.25<c.maxZ)support=Math.max(support,c.maxY);}if(player.footY>support+.05)player.grounded=false;if(!player.grounded){player.vy-=18*dt;let nextY=player.footY+player.vy*dt;const head=1.6-player.crouch*.45;if(player.vy>0)for(const c of colliders){if(!validCollider(c)||c.minY<oldY+head-.05||c.minY>nextY+head)continue;if(player.x+.28>c.minX&&player.x-.28<c.maxX&&player.z+.28>c.minZ&&player.z-.28<c.maxZ){nextY=c.minY-head-.015;player.vy=0;}}
 if(player.vy<=0){for(const c of colliders){if(!validCollider(c)||c.maxY>oldY+.05||c.maxY<nextY)continue;if(player.x+.26>c.minX&&player.x-.26<c.maxX&&player.z+.26>c.minZ&&player.z-.26<c.maxZ)support=Math.max(support,c.maxY);}if(nextY<=support){nextY=support;player.vy=0;player.grounded=true;player.jumpCount=0;player.airDashed=false;Audio.noise(.055,.045,430);}}player.footY=Math.max(0,nextY);}else player.footY=support;}
 player.speed=Math.hypot(player.x-ox,player.z-oz)/Math.max(dt,.001);player.moveX=x;player.moveZ=z;player.bob+=dt*player.speed*1.65;const bob=settings.motion&&player.grounded?Math.sin(player.bob)*Math.min(player.speed*.0035,.025):0;player.y=player.footY+1.68-player.crouch*.52+bob;player.ram=Math.min(player.maxRam,player.ram+dt*(scan?.28:.65));player.invuln=Math.max(0,player.invuln-dt);player.dashCooldown=Math.max(0,player.dashCooldown-dt);player.overclock=Math.max(0,player.overclock-dt);player.overclockCooldown=Math.max(0,player.overclockCooldown-dt);
 for(const [charge,timer,period] of [['meds','medTimer',healthRecharge()],['emp','empTimer',empRecharge()]]){if(player[charge]>=2){player[timer]=0;continue;}if(player[timer]<=0)player[timer]=period;player[timer]-=dt;if(player[timer]<=0){player[charge]=Math.min(2,player[charge]+1);player[timer]=player[charge]<2?period:0;Audio.tone(840,.055,.04,'sine');}}
 if(elapsed-player.lastHurt>9&&player.armor<player.maxArmor)player.armor=Math.min(player.maxArmor,player.armor+dt*3.5);if(player.speed>1&&player.grounded&&!scan){stepClock+=dt;if(stepClock>(sprint?.25:.38)){stepClock=0;Audio.noise(.055,sprint?.065:.036,player.z<-48?850:500,0,foots%2?.25:-.25);foots++;}}for(const e of enemies)if(!e.alive)e.deadTime+=dt;
 const earned=Math.floor((stats.kills*100+stats.hacks*80+stats.takedowns*50+social.xp)/600);if(earned>player.earnedPoints){player.perkPoints+=earned-player.earnedPoints;player.earnedPoints=earned;toast('NEW PERK POINT · OPEN INVENTORY [I]');}
}
function updateEnemies(dt){threatLevel=0;for(const e of enemies){if(!e.alive||e===grappleTarget)continue;if(neutralEnemy(e)){neutralTick(e,dt);continue;}e.hit=Math.max(0,e.hit-dt);e.flash=Math.max(0,e.flash-dt);e.blind=Math.max(0,e.blind-dt);e.jam=Math.max(0,e.jam-dt);e.distracted=Math.max(0,e.distracted-dt);if(e.burn>0){e.burn=Math.max(0,e.burn-dt);damageEnemy(e,14*dt);if(rand()<dt*12)particle([e.x,1.2,e.z],[0,1,0],'#ff9c69',.13,.5,1);if(!e.alive)continue;}if(e.stun>0){e.stun=Math.max(0,e.stun-dt);if(e.aggro)threatLevel++;if(rand()<dt*15)particle([e.x+rr(-.3,.3),rr(.7,1.8),e.z+rr(-.3,.3)],[rr(-.7,.7),rr(.2,1),rr(-.7,.7)],'#ee7589',.08,.3,1);continue;}
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz),los=dist<27&&lineOfSight([e.x,1.55,e.z],[player.x,player.y-.08,player.z]),front=(Math.sin(e.yaw)*dx+Math.cos(e.yaw)*dz)/(dist||1),visible=los&&e.blind<=0;const sees=visible&&(front>.40||dist<1.2)&&dist<(player.crouch>.5?10.8:18);e.patrol+=dt*.65;if(!e.aggro){e.detect=clamp(e.detect+dt*(sees?(player.crouch>.5?.55:.95)*(dist<5?2:1):-.6),0,1);if(e.detect>=1){e.aggro=true;e.lastSeen=elapsed;Audio.tone(350,.14,.07,'sawtooth',680);}}else{e.detect=1;if(visible)e.lastSeen=elapsed;if(!visible&&elapsed-e.lastSeen>12){e.aggro=false;e.detect=.2;e.homeX=e.x;e.homeZ=e.z;}}
 if(e.aggro){threatLevel++;e.yaw=Math.atan2(dx,dz);let mx=0,mz=0;if(dist>8){mx=dx/(dist||1)*2.35*dt;mz=dz/(dist||1)*2.35*dt;}else if(dist>3.2&&visible){const strafe=Math.sin(e.patrol+e.phase);mx=dz/(dist||1)*strafe*1.05*dt;mz=-dx/(dist||1)*strafe*1.05*dt;}const ox=e.x,oz=e.z;const moved=moveEntity(e,mx,mz,.31,1.7);if(!moved&&dist>8){moveEntity(e,Math.cos(e.phase)*1.6*dt,Math.sin(e.phase)*1.6*dt,.31,1.7);e.phase+=dt;}e.walk=Math.hypot(e.x-ox,e.z-oz)>.001?e.walk+dt*7:e.walk*.95;e.attack-=dt;
 if(e.attack<=0&&visible&&dist<2.25&&player.footY<1){e.attack=1.2;hurtPlayer(19,[e.x,1.2,e.z],e);e.flash=.1;Audio.noise(.13,.12,900);}else if(e.attack<=0&&visible&&e.jam<=0&&dist<23){e.attack=rr(.95,1.6)*diff().fire;e.flash=.11;const origin=[e.x,1.25,e.z],accuracy=clamp(.78-dist*.016-(player.speed>6?.24:0)-(player.crouch>.5?.15:0),.14,.76),hit=rand()<accuracy,end=hit?[player.x,player.y-.2,player.z]:[player.x+rr(-1.1,1.1),player.y+rr(-.7,.7),player.z+rr(-1,1)],dd=norm(sub(end,origin)),ray=wallRay(origin,dd,Math.hypot(...sub(end,origin)));tracer(origin,add(origin,mul(dd,ray.dist)),'#ed8c76',.10);Audio.enemy(clamp(Math.sin(e.yaw-player.yaw),-.9,.9));if(hit&&ray.dist>dist-.7)hurtPlayer(rr(9,14),origin);}
 if(e.warden&&visible&&e.jam<=0&&e.blind<=0){e.netTimer-=dt;if(e.netTimer<=0){e.netTimer=9;if(!traceAlarm){traceActive=true;trace=Math.min(100,trace+14);toast('WARDEN IS TRACING YOUR LINK');}}}
 }else{let tx=e.homeX+Math.sin(e.patrol+e.phase)*1.1,tz=e.homeZ+Math.cos(e.patrol*.7+e.phase)*1.45;if(e.distracted>0&&e.investigate){tx=e.investigate[0];tz=e.investigate[1];}const ax=tx-e.x,az=tz-e.z,dist2=Math.hypot(ax,az);if(dist2>.4&&e.blind<=0){e.yaw=Math.atan2(ax,az);moveEntity(e,ax/dist2*.65*dt,az/dist2*.65*dt,.31,1.7);e.walk+=dt*3;}}
 }}
function updateDevices(dt){for(const d of devices){d.cooldown=Math.max(0,(d.cooldown||0)-dt);if(d.type!=='camera'||!d.active||(social.permits.archive&&!social.hostile)){d.detect=0;continue;}d.yaw=-2.0+Math.sin(time*.4)*.45;const dx=player.x-d.x,dz=player.z-d.z,dist=Math.hypot(dx,dz),front=(Math.sin(d.yaw)*dx+Math.cos(d.yaw)*dz)/(dist||1);const visible=dist<15&&player.z<-52&&front>.2&&lineOfSight([d.x+Math.sin(d.yaw)*.62,d.y-.08,d.z+Math.cos(d.yaw)*.62],[player.x,player.y-.1,player.z]);d.detect=clamp(d.detect+dt*(visible?.65:-.4),0,1);if(d.detect>=1&&!d.alerted){d.alerted=true;stats.alarms++;alertEnemies(d.x,d.z,27);traceActive=true;trace=Math.max(trace,18);notice('CAMERA DETECTION','SECURITY ALERT','DISABLE THE CAMERA OR BREAK LINE OF SIGHT',2.5);}}}
function updateNetwork(dt){const busy=new Set();for(let i=0;i<hackQueue.length;){const q=hackQueue[i],key=q.kind+q.id;if(busy.has(key)){i++;continue;}busy.add(key);const target=queueTarget(q);if(!target){hackQueue.splice(i,1);continue;}q.left-=dt;if(q.left<=0){hackQueue.splice(i,1);applyHack(q,target);}else i++;}if(traceActive&&!traceAlarm){trace=Math.min(100,trace+dt*2.5);if(trace>=100){traceAlarm=true;stats.alarms++;alertEnemies(player.x,player.z,100);if(player.z<-48){spawnEnemy(-1.1,-55.8,true);spawnEnemy(1.2,-56.1,true);}else{spawnEnemy(4.3,-14,true);spawnEnemy(-2.1,-32,true);}notice('NETWORK TRACE COMPLETE','LINK EXPOSED','REINFORCEMENTS INBOUND',3);Audio.tone(450,.8,.16,'sawtooth',190);}}}
function projectileBlocked(x,y,z,r){if(x<-20.5||x>9.5||z<-72.7||z>57.1)return true;for(const c of colliders){if(!validCollider(c)||c.maxY<y-r||c.minY>y+r)continue;if(x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ)return true;}return false;}
function updateProjectiles(dt){for(let i=grenades.length-1;i>=0;i--){const g=grenades[i];g.timer-=dt;const nx=g.p[0]+g.v[0]*dt,nz=g.p[2]+g.v[2]*dt;if(projectileBlocked(nx,g.p[1],nz,.09)){g.v[0]*=-.45;g.v[2]*=-.45;}else{g.p[0]=nx;g.p[2]=nz;}g.p[1]+=g.v[1]*dt;g.v[1]-=12*dt;if(g.p[1]<.12){g.p[1]=.12;g.v[1]=Math.abs(g.v[1])*.3;g.v[0]*=.8;g.v[2]*=.8;}if(g.timer<=0){explode(g.p,6.5,118,true);grenades.splice(i,1);}else if(rand()<.5)particle(g.p,[0,.1,0],'#65e8d5',.10,.15,1);}}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;if(p.life<=0){effects.splice(i,1);continue;}p.v[1]-=p.gravity*dt;for(let a=0;a<3;a++)p.p[a]+=p.v[a]*dt;if(p.p[1]<.02&&p.gravity>0){p.p[1]=.02;p.v[1]*=-.32;p.v[0]*=.6;p.v[2]*=.6;}}
 for(let i=tracers.length-1;i>=0;i--){tracers[i].life-=dt;if(tracers[i].life<=0)tracers.splice(i,1);}
 for(const r of rain){r.y-=r.speed*dt;r.x-=dt*.9;if(r.y<0){r.y=rr(17,24);r.x=player.x+rr(-23,23);r.z=player.z+rr(-33,24);}if(r.z>player.z+30)r.z-=58;if(r.z<player.z-34)r.z+=58;}
 if(rand()<dt*18){const vents=[[-6.8,1.25,3.3],[6.5,1.25,-2.4],[-6.5,1.25,-16.5],[6.5,1.25,-20.5],[-3,.12,10]];const p=pick(vents);particle(add(p,[rr(-.3,.3),0,rr(-.25,.25)]),[rr(-.12,.12),rr(.35,.65),rr(-.1,.1)],'#789caa',rr(.65,1.1),rr(1.4,2.4),.18,0);}
}

// Standard on-foot keyboard layout, with browser-safe input cleanup.
function hideWheel(equip=true){if(!wheelOpen)return;wheelOpen=false;setVisible('weapon-wheel',false);if(equip)switchWeapon(wheelSlot);}
function showWheel(){if(scan||mode!=='playing')return;wheelOpen=true;wheelSlot=weaponIndex;wheelDX=0;wheelDY=0;mouseDown=false;aiming=false;setVisible('weapon-wheel',true);updateWheel();Audio.click();}
function updateWheel(){document.querySelectorAll('.wheel-slot').forEach(el=>el.classList.toggle('selected',+el.dataset.slot===wheelSlot));}
function processAlt(){const now=performance.now();if(input.down('weapon')&&altStart&&now-altStart>220&&!wheelOpen&&input.source!=='touch')showWheel();if(altPending&&now>altPending){altPending=0;switchWeapon((weaponIndex+1)%4);}if(input.down('inspect')&&!scan&&!wheelOpen&&!holstered)inspectTime=Math.max(inspectTime,1.15);}
// ---------------------------------------------------------------------------------------------
// Input. Every device goes through kit.input actions: the original PC 2.0 keyboard/mouse layout,
// a Cyberpunk-style controller layout (see the field guide) and the kit's touch controls.
// ---------------------------------------------------------------------------------------------
const P_=n=>input.pressed(n),D_=n=>input.down(n),R_=n=>input.released(n);
// Hold-to-use actions need a fresh press after a menu, a conversation or a completed action.
function interactHeld(){return input.down('interact')&&!interactLock;}
document.addEventListener('pointerlockchange',()=>{const wasLocked=locked;locked=document.pointerLockElement===canvas;if(locked)return;if(unlockPending){unlockPending=false;if(mode==='playing')captureMouse();}else if(wasLocked&&mode==='playing')pauseGame();});
function bodyInReach(){if(stealth.carryId!==null)return true;for(const e of enemies)if(!e.alive&&!e.hidden&&!e.carried&&Math.hypot(e.x-player.x,e.z-player.z)<2.1)return true;return false;}
// X on a controller uses whatever is in front of you, and reloads when nothing is.
function interactPress(){if(scan){executeHack();return;}if(input.source==='gamepad'){updateInteractions(0);if(!interactable&&stealth.carryId===null){reload();return;}}interact();}
function nextHack(){const list=scanActions();if(list.length){hackSelected=(hackSelected+1)%list.length;Audio.click();}}
function gameInput(){
 const now=performance.now(),touch=input.source==='touch';
 if(!D_('interact'))interactLock=false;
 if(!D_('fire'))mouseDown=false;
 // Mouse look is captured on the first click in the game (browsers need the click).
 if(input.pointer.justDown&&input.pointer.type==='mouse'&&!locked)captureMouse();
 const lk=input.look('look');
 if(wheelOpen){
  wheelDX=clamp(wheelDX+lk.x/.0024,-180,180);wheelDY=clamp(wheelDY+lk.y/.0024,-180,180);
  const st=input.vector('move');if(Math.hypot(st.x,st.y)>.5){wheelDX=st.x*100;wheelDY=-st.y*100;}
  if(Math.hypot(wheelDX,wheelDY)>15){const s=Math.abs(wheelDX)>Math.abs(wheelDY)?wheelDX>0?1:3:wheelDY>0?2:0;if(s!==wheelSlot){wheelSlot=s;updateWheel();}}
 }else{
  // settings.sensitivity .65 keeps the original 0.0018 rad per pixel; a controller gets a little
  // aim slow-down over a hostile target.
  const k=settings.sensitivity*1.1667*(aiming?.63:scan?.6/scanZoom:1)*(input.source==='gamepad'&&scanTarget&&!scan?.62:1);
  player.yaw+=lk.x*k;player.pitch=clamp(player.pitch-lk.y*k,-1.25,1.25);
 }
 // Mouse wheel (and pinch in the scanner): weapons, the wheel, quickhacks or scanner zoom.
 wheelAcc+=input.zoom();
 while(Math.abs(wheelAcc)>=1){const step=wheelAcc<0?1:-1;wheelAcc+=step;
  if(scan){const list=scanActions();if(list.length){hackSelected=(hackSelected+step+list.length)%list.length;Audio.click();}else scanZoom=clamp(scanZoom-step*.2,1,2.4);}
  else if(wheelOpen){wheelSlot=(wheelSlot+step+4)%4;updateWheel();}
  else if(!touch)switchWeapon((weaponIndex-step+4)%4);}
 if(P_('pause')){hideWheel(false);pauseGame();return;}
 if(P_('scan'))setScan(true);
 if(R_('scan'))setScan(scanLatched);
 if(P_('scanToggle'))toggleScan();
 if(R_('fire')){if(heldAttackAt&&!scan&&!wheelOpen)melee(now-heldAttackAt>350);heldAttackAt=0;mouseDown=false;}
 if(R_('aim'))aiming=false;
 if(scan){
  if(P_('interact')||P_('fire'))executeHack();
  if(P_('emp')||(touch&&P_('jump')))tagTarget();
  if(P_('bolt')){hackDetails=!hackDetails;Audio.click();}
  if(P_('weapon')||(touch&&P_('dash')))nextHack();
  if(P_('overclock')||(touch&&P_('crouch')))activateOverclock();
 }else{
  if(P_('fire')&&!wheelOpen){if(weaponIndex>=2)heldAttackAt=now;else{mouseDown=true;fire();}}
  if(P_('aim')&&!wheelOpen){aiming=true;player.blockAt=elapsed;}
  if(P_('interact'))interactPress();
  if(P_('jump'))jump();
  if(P_('crouch'))toggleCrouch();
  if(P_('crouchHold'))toggleCrouch(true);
  if(P_('sprint'))player.sprintToggle=!player.sprintToggle;
  if(P_('dash'))dash();
  if(P_('reload'))reload();
  if(P_('heal'))medpatch();
  if(P_('emp'))throwEMP();
  if(P_('overclock'))activateOverclock();
  if(P_('bolt'))throwBolt();
  if(P_('carry'))bodyAction();
  // R3 on a controller: carry or hide a body when one is in reach, otherwise a quick melee.
  if(P_('melee')){if(input.source==='gamepad'&&bodyInReach())bodyAction();else melee(false,true);}
  if(P_('weapon')){altStart=now;altPending=0;}
  for(let i=1;i<=4;i++)if(P_('num'+i))switchWeapon(i-1);
 }
 if(R_('weapon')){if(wheelOpen){hideWheel(true);lastAltTap=-1;}else if(altStart&&!scan){if(lastAltTap>0&&now-lastAltTap<310){altPending=0;holstered=!holstered;weaponSwap=.25;lastAltTap=-1;mouseDown=false;aiming=false;toast(holstered?'WEAPON HOLSTERED':'WEAPON READY');}else{lastAltTap=now;altPending=now+245;}}altStart=0;}
 if(mode!=='playing')return;
 if(P_('inventory'))openField('inventory');else if(P_('journal'))openField('journal');else if(P_('map'))openField('map');else if(P_('contact'))openField('contact');
 else if(P_('call'))callGetaway();else if(P_('quickSave'))quickSave();else if(P_('quickLoad'))quickLoad();
}
// ---------------------------------------------------------------------------------------------
// Menus. Arrows / WASD / left stick / D-pad move the focus spatially, A or Enter chooses, B or
// Esc goes back, the right stick scrolls long pages. Mouse and touch click as before.
// ---------------------------------------------------------------------------------------------
let navHeld='',navNext=0;
function navDirection(){const v=input.vector('move');let d='';
 if(Math.hypot(v.x,v.y)>.55)d=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?'right':'left'):(v.y>0?'up':'down');
 if(!d&&input.source==='gamepad'){if(D_('heal'))d='up';else if(D_('overclock'))d='down';else if(D_('bolt'))d='left';else if(D_('emp'))d='right';}
 const now=performance.now();if(!d){navHeld='';return '';}
 if(d!==navHeld){navHeld=d;navNext=now+380;return d;}
 if(now>=navNext){navNext=now+120;return d;}return '';}
function navItems(root){return [...root.querySelectorAll('button,input[type=range],summary')].filter(el=>!el.disabled&&el.offsetParent!==null&&!el.closest('.hidden'));}
function focusEl(el){if(!el)return;el.focus({preventScroll:true});el.scrollIntoView?.({block:'nearest',inline:'nearest'});}
function spatial(cur,items,d){const a=cur.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,bs=1e9;
 for(const el of items){if(el===cur)continue;const b=el.getBoundingClientRect(),dx=b.left+b.width/2-ax,dy=b.top+b.height/2-ay;const main=d==='right'?dx:d==='left'?-dx:d==='down'?dy:-dy,cross=d==='right'||d==='left'?Math.abs(dy):Math.abs(dx);if(main<=4)continue;const s=main+cross*2.2;if(s<bs){bs=s;best=el;}}
 if(!best&&(d==='down'||d==='up')){const i=items.indexOf(cur);best=items[(i+(d==='down'?1:-1)+items.length)%items.length];}
 return best;}
function uiNav(root,{fallback=null,scroller=null}={}){if(!root)return;
 const d=navDirection(),confirm=P_('confirm'),pad=input.source==='gamepad';
 if(pad&&scroller){const lk=input.look('look');if(lk.y)scroller.scrollTop+=lk.y*600;}
 if(!d&&!confirm)return;
 const items=navItems(root);if(!items.length)return;
 let cur=document.activeElement;if(!items.includes(cur))cur=null;
 const first=fallback&&items.includes(fallback)?fallback:items[0];
 if(d){if(!cur){focusEl(first);return;}
  if(cur.type==='range'&&(d==='left'||d==='right')){cur.value=+cur.value+(d==='right'?5:-5);cur.dispatchEvent(new Event('input',{bubbles:true}));return;}
  const next=spatial(cur,items,d);if(next)focusEl(next);return;}
 // Enter on a focused button is a native click; here it only lands when nothing is focused.
 if(confirm){if(pad&&cur&&cur.type!=='range')cur.click();else if(!cur)focusEl(first);}}
// Menus opened with a controller or the keyboard start with their main button focused.
function focusDefault(el){if(el&&input.source!=='touch'&&!(input.source==='keyboard'&&input.pointer.over))setTimeout(()=>{if(el.offsetParent!==null)focusEl(el);},0);}
let settingsFrom='menu',controlsFrom='menu';
function closeSettings(){setVisible('settings',false);setVisible(settingsFrom,true);focusDefault($(settingsFrom==='pause'?'pause-settings':'menu-settings'));}
function closeControls(){setVisible('controls',false);setVisible(controlsFrom,true);focusDefault($(controlsFrom==='pause'?'pause-controls':'menu-controls'));}
function releaseGrapple(){if(mode!=='grapple')return;const en=grappleTarget;grappleTarget=null;if(en){en.aggro=true;en.lastSeen=elapsed;}mode='playing';setVisible('grapple-ui',false);resetInputs();}
const PANELS=['inventory','character','cyberware','journal','map','contact'];
function menuInput(){
 if(mode==='menu'||mode==='paused'){
  if(!$('settings').classList.contains('hidden')){if(P_('back')||P_('pause'))closeSettings();else uiNav($('settings'),{fallback:$('settings-back')});return;}
  if(!$('controls').classList.contains('hidden')){if(P_('back')||P_('pause'))closeControls();else uiNav($('controls'),{fallback:$('controls-back'),scroller:$('controls').querySelector('.modal-card')});return;}
  if(mode==='paused'){if(P_('back')||P_('pause'))resumeGame();else uiNav($('pause'),{fallback:$('resume-btn')});return;}
  uiNav($('menu'),{fallback:$('continue-btn').classList.contains('hidden')?$('start-btn'):$('continue-btn')});return;}
 if(mode==='dead'){uiNav($('death'),{fallback:$('retry-btn')});return;}
 if(mode==='won'){uiNav($('win'),{fallback:$('replay-btn'),scroller:$('win').querySelector('.end-card')});return;}
 if(mode==='hacking'){if(P_('back')||P_('pause'))cancelHack();else uiNav($('hack'));return;}
 if(mode==='grapple'){if(P_('interact'))completeGrapple(true);else if(P_('reload')||P_('confirm'))completeGrapple(false);else if(P_('back')||P_('pause'))releaseGrapple();return;}
 if(mode==='panel'){
  if(P_('back')||P_('pause')){closeField();return;}
  for(const id of ['inventory','journal','map','contact'])if(P_(id)){if(activePanel===id||input.source==='gamepad')closeField();else openField(id);return;}
  if(P_('tabPrev')||P_('tabNext')){const i=PANELS.indexOf(activePanel);openField(PANELS[(i+(P_('tabNext')?1:PANELS.length-1))%PANELS.length]);return;}
  uiNav($('field-panel'),{scroller:$('field-content')});return;}
 if(mode==='profile'){
  for(let i=1;i<=3;i++)if(P_('num'+i)){profilePick=Object.keys(BACKGROUNDS)[i-1];profileBoost={cool:0,intelligence:0,technical:0,body:0};renderProfile();return;}
  if(P_('confirm')&&input.source!=='gamepad'){confirmProfile();return;}
  uiNav($('profile-screen'),{fallback:$('profile-confirm'),scroller:$('profile-screen')});return;}
 if(mode==='dialogue'&&dialogue){
  if(dialogue.historyOpen){if(P_('transcript')||P_('back'))toggleHistory();else uiNav($('talk-history'),{scroller:$('talk-history-content')});return;}
  if(P_('back')){closeDialogue();return;}
  if(P_('transcript')){toggleHistory();return;}
  for(let i=1;i<=9;i++)if(P_('num'+i)){selectChoice(i-1);return;}
  if(P_('interact')){const b=document.activeElement?.closest?.('[data-choice]');if(b&&!b.disabled)selectChoice(+b.dataset.choice);return;}
  uiNav($('dialogue-choices'),{scroller:document.querySelector('.talk-shell')});}
}
addEventListener('blur',()=>{if(mode==='playing')pauseGame();resetInputs();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pauseGame();if(document.hidden)resetInputs();});
$('start-btn').onclick=()=>startGame(false);$('continue-btn').onclick=()=>{checkpoint=storage.get(CHECKPOINT_KEY);startGame(true);};$('resume-btn').onclick=resumeGame;$('restart-btn').onclick=()=>startGame(false);$('quit-btn').onclick=returnMenu;$('retry-btn').onclick=()=>startGame(true);$('death-menu').onclick=returnMenu;$('replay-btn').onclick=()=>startGame(false);$('win-menu').onclick=returnMenu;$('hack-cancel').onclick=cancelHack;$('hack-force').onclick=()=>finishHack(true);
function syncSettings(){$('volume').value=settings.volume*100;$('sensitivity').value=settings.sensitivity*100;$('quality-btn').textContent=(kit.settings.get().quality==='auto'?'AUTO / ':'')+kit.tier.name.toUpperCase();$('difficulty-btn').textContent=settings.difficulty;$('motion-btn').textContent=settings.motion?'ON':'OFF';storage.set('settings',settings);}
function openSettings(from){settingsFrom=from;setVisible(from,false);setVisible('settings',true);syncSettings();focusDefault($('volume'));}
kit.onQuality(()=>{if(!$('settings').classList.contains('hidden'))syncSettings();});
$('menu-settings').onclick=()=>openSettings('menu');$('pause-settings').onclick=()=>openSettings('pause');$('settings-back').onclick=closeSettings;$('volume').oninput=e=>{settings.volume=Number(e.target.value)/100;Audio.init();storage.set('settings',settings);};$('sensitivity').oninput=e=>{settings.sensitivity=Number(e.target.value)/100;storage.set('settings',settings);};$('quality-btn').onclick=()=>kit.menu.open();$('difficulty-btn').onclick=()=>{const ds=['STORY','OPERATOR','HARDCORE'];settings.difficulty=ds[(ds.indexOf(settings.difficulty)+1)%3];syncSettings();};$('motion-btn').onclick=()=>{settings.motion=!settings.motion;syncSettings();};
function openControls(from){controlsFrom=from;setVisible(from,false);setVisible('controls',true);renderControlsGuide();focusDefault($('controls-back'));}$('menu-controls').onclick=()=>openControls('menu');$('pause-controls').onclick=()=>openControls('pause');$('controls-back').onclick=closeControls;
$('field-close').onclick=closeField;$('field-nav').addEventListener('click',e=>{const b=e.target.closest('[data-panel]');if(b)openField(b.dataset.panel);});$('field-content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.equip!==undefined){switchWeapon(+b.dataset.equip);renderField();}if(b.dataset.upgrade!==undefined)upgradeWeapon(+b.dataset.upgrade);if(b.dataset.perk)choosePerk(b.dataset.perk);if(b.dataset.call){closeField();callGetaway();}});

const droneMesh=new Batch();droneMesh.box(0,0,0,.65,.20,.85,'#3c515e');for(const x of [-.55,.55]){droneMesh.box(x,0,0,.65,.065,.18,'#526371');droneMesh.cylinder(x,.055,0,.23,.035,'#192c37',0,10);}droneMesh.box(0,-.11,.43,.22,.055,.06,'#e4737c',1.1);droneMesh.upload();
const muzzleMesh=new Batch();muzzleMesh.box(0,0,0,.045,.045,.20,'#f3eac1',2);for(let i=0;i<6;i++){const a=i*TAU/6;muzzleMesh.beam([0,0,-.025],[Math.sin(a)*.085,Math.cos(a)*.085,-.12],.012,'#ffb97b',1.6);}muzzleMesh.upload();
// Local meshes for the new room, scan outlines, and melee equipment.
const bladeMesh=new Batch();bladeMesh.box(0,0,.14,.068,.075,.27,'#203540');bladeMesh.box(0,0,-.015,.25,.055,.055,'#62828b');bladeMesh.box(0,0,-.52,.085,.027,.99,'#b1cdd0');bladeMesh.box(-.038,0,-.52,.012,.033,.97,'#fb798c',1.6);bladeMesh.beam([-.04,0,-1.015],[0,0,-1.11],.028,'#c3e0df');bladeMesh.box(0,.05,.15,.032,.02,.16,'#5adbe4',.7);bladeMesh.upload();
const scanEnemyMesh=new Batch();for(const x of [-.42,.42])for(const z of [-.36,.36]){scanEnemyMesh.beam([x,.08,z],[x,1.94,z],.012,'#ff7186',1);scanEnemyMesh.beam([x,1.94,z],[x-Math.sign(x)*.17,1.94,z],.015,'#ff7186',1);scanEnemyMesh.beam([x,.08,z],[x-Math.sign(x)*.17,.08,z],.015,'#ff7186',1);}scanEnemyMesh.beam([0,.8,0],[0,1.5,0],.025,'#ff7186',1);scanEnemyMesh.beam([-.34,1.32,0],[.34,1.32,0],.022,'#ff7186',1);scanEnemyMesh.box(0,1.7,0,.32,.33,.29,'#ff7186',1);for(const x of [-.18,.18])scanEnemyMesh.beam([x,.83,0],[x,.14,0],.024,'#ff7186',1);scanEnemyMesh.upload();
const scanDeviceMesh=new Batch();for(const x of [-.42,.42])for(const z of [-.35,.35]){scanDeviceMesh.beam([x,-.28,z],[x,.28,z],.014,'#82e3e0',1);scanDeviceMesh.beam([x,.28,z],[-x,.28,z],.014,'#82e3e0',1);scanDeviceMesh.beam([x,-.28,z],[-x,-.28,z],.014,'#82e3e0',1);}scanDeviceMesh.upload();
function drawArchiveDevices(){for(const d of devices){if(d.type==='camera'){draw(cameraMesh,M.compose(d.x,d.y,d.z,d.yaw));draw(cameraLamp,M.compose(d.x,d.y,d.z,d.yaw),d.active?[1,1,1]:[.07,.12,.12]);}else if(d.type==='coolant'){draw(deviceGlow,M.compose(d.x,d.y,d.z),archiveUnlocked?[.35,1.4,1.1]:[1.4,.3,.4]);}}}
function drawScannerOutlines(){const reveal=elapsed<revealUntil;const targets=enemies.filter(e=>e.alive&&Math.hypot(e.x-player.x,e.z-player.z)<36&&(e.tagged||reveal||(scan&&lineOfSight([player.x,player.y,player.z],[e.x,1.3,e.z]))));const ds=devices.filter(d=>d.tagged||reveal||(scan&&scanObject?.obj===d));if(!targets.length&&!ds.length)return;drawLayer=2;for(const e of targets){const alpha=scan?.68:e.tagged?.44:.30;draw(scanEnemyMesh,M.compose(e.x,0,e.z,e.yaw),e.stun>0?[.4,.86,.9]:[1,.24,.37],alpha);}for(const d of ds)draw(scanDeviceMesh,M.compose(d.x,d.y,d.z),d.active?[.35,.85,.83]:[.45,.48,.5],scan?.65:.3);drawLayer=0;}
function drawMeleeWeapon(eye){const camera=M.compose(...eye,-player.yaw,player.pitch),attack=meleeTime>0?Math.sin(meleeTime/(strongStrike?.62:.42)*Math.PI):0,bob=settings.motion?Math.sin(player.bob)*.009:0;drawLayer=1;drawFlash=.24;if(weaponIndex===2){const local=M.compose(aiming?.05:.32-attack*.35,(aiming?-.11:-.22)+attack*.12+bob,-.5+attack*.1,aiming?1.15:-.25+attack*1.2,1.0-attack*.9,aiming?.9:-.18-attack*.5);const model=M.multiply(camera,local);draw(bladeMesh,model);draw(handMesh,M.multiply(model,M.compose(0,-.075,.17,0,.2)));}else{for(const sign of [-1,1]){const punch=sign>0?attack:attack*.3;draw(handMesh,M.multiply(camera,M.compose(sign*(aiming?.16:.25)-punch*sign*.12,(aiming?-.04:-.25)+bob,-.36-punch*.5,0,-.3,sign*.3,1.35,1.35,1.35)));}}drawLayer=0;drawFlash=0;}
function openField(id='inventory'){if(mode!=='playing'&&mode!=='panel')return;mode='panel';resetInputs();releaseMouse();activePanel=['inventory','character','cyberware','journal','map','contact'].includes(id)?id:'inventory';setVisible('field-panel',true);renderField();Audio.click();}
function closeField(){if(mode!=='panel')return;setVisible('field-panel',false);mode='playing';resetInputs();canvas.focus();captureMouse();}
function choosePerk(id){if(!['ram','charge','armor'].includes(id)||mode!=='panel')return;if(player.perks[id]){toast('THIS UPGRADE IS ALREADY ACTIVE');return;}if(player.perkPoints<1){toast('NO PERK POINTS');return;}player.perkPoints--;player.perks[id]=true;if(id==='ram'){player.maxRam+=4;player.ram=Math.min(player.maxRam,player.ram+4);}if(id==='armor'){player.maxArmor+=25;player.armor+=25;}if(id==='charge'){player.medTimer=Math.min(player.medTimer,healthRecharge());player.empTimer=Math.min(player.empTimer,empRecharge());}Audio.hack();renderField();toast('CYBERWARE UPGRADE INSTALLED');}
function upgradeWeapon(index){if(mode!=='panel'||!Number.isInteger(index)||index<0||index>3)return;const w=weapons[index];if(w.upgrades>=2||player.components<10)return;player.components-=10;w.upgrades++;w.damage=Math.round(w.baseDamage*(1+.18*w.upgrades));Audio.hack();renderField();toast(w.short+' · DAMAGE UPGRADE INSTALLED');}
function callGetaway(){if(mode!=='playing')return;if(scan)setScan(false);if(stage===4){if(Math.hypot(player.x-extractPos[0],player.z-extractPos[2])<2.85){updateInteractions(0);interact();}else{say('The car is at the south end of Mercy Street. Follow the yellow marker. I will open the doors when you reach the pickup.',6);toast('GETAWAY LOCATION MARKED');}}else say(stage===1?'Use the access panel on the left of the relay gate. Hold Tab to scan. Press F to connect.':stage===2?'The Cold Archive is behind the relay. Disable the camera. The coolant console is on the left.':'The core lock is open. Hold F at the center stand to take the core.',7);}
function renderField(){document.querySelectorAll('#field-nav button').forEach(b=>b.classList.toggle('active',b.dataset.panel===activePanel));$('field-title').textContent=activePanel==='contact'?'MARA / SECURE LINE':activePanel.toUpperCase();$('field-footer').textContent=`HEALTH ${Math.ceil(player.hp)} / 100   ·   RAM ${Math.floor(player.ram)} / ${player.maxRam}   ·   €$ ${player.credits}   ·   ${player.components} COMPONENTS   ·   ${player.perkPoints} PERK POINTS`;let html='';
 if(activePanel==='inventory'){html='<h3>COMBAT LOADOUT</h3><div class="loadout-grid">'+weapons.map((w,i)=>`<article class="gear-card ${weaponIndex===i?'active':''}"><span class="slot-num">0${i+1}</span><strong>${w.short}</strong><span class="gear-class">${w.type}</span><div class="gear-stat">DAMAGE ${w.damage}<br>${w.melee?'STRONG STRIKE '+Math.round(w.damage*1.9):'AMMO '+w.ammo+' / '+w.reserve}<br>UPGRADE ${w.upgrades} / 2</div><button data-equip="${i}">${weaponIndex===i?'EQUIPPED':'EQUIP [ '+(i+1)+' ]'}</button><button class="upgrade" data-upgrade="${i}" ${w.upgrades>=2||player.components<10?'disabled':''}>${w.upgrades>=2?'MAX UPGRADE':'UPGRADE / 10 COMPONENTS'}</button></article>`).join('')+'</div><div class="inventory-info"><span>HEALTH ITEMS '+player.meds+' / 2 · EMP '+player.emp+' / 2</span><span>Each item refills over time.</span></div><p>Use F to take guard equipment and supply caches. Weapon upgrades use components. Select the Cyberware tab to spend perk points.</p>';}
 else if(activePanel==='cyberware'){const perks=[['ram','+4','EXPANDED RAM','Adds 4 RAM units. Use them for more quickhacks.'],['charge','−33%','RAPID CHARGE','Health items refill in 16 seconds. EMP charges refill in 20 seconds.'],['armor','+25','SUBDERMAL ARMOR','Adds 25 armor. Armor starts to repair 9 seconds after damage.']];html='<h3>KESTREL CYBERDECK / '+player.perkPoints+' PERK POINTS</h3><div class="perk-grid">'+perks.map(([id,n,title,text])=>`<article class="perk-card ${player.perks[id]?'active':''}"><b>${n}</b><h3>${title}</h3><p>${text}</p><button data-perk="${id}" ${player.perks[id]||player.perkPoints<1?'disabled':''}>${player.perks[id]?'INSTALLED':'INSTALL / 1 POINT'}</button></article>`).join('')+'</div><p>Overclock [E] is installed. It lasts 9 seconds and recharges in 35 seconds. When RAM is low, each missing RAM unit uses 5 health. Double jump, air dash, and the two-slot quickhack queue are installed.</p><p>Earn a new perk point for each 600 mission XP. These upgrades belong to this mission build. They are not the complete Cyberpunk 2077 perk trees.</p>';}
 else if(activePanel==='journal'){const jobs=[['BREACH THE RELAY','Reach the panel at the north gate. Solve the access sequence or force the gate.'],['RELEASE THE COOLANT LOCK','Enter the Cold Archive. Hold F at the left console, or use its Override Lock quickhack.'],['TAKE THE MEMORY CORE','Hold F at the stand at the back of the Cold Archive.'],['REACH THE GETAWAY','Return through the relay and market. Press F at the car. Stay in the pickup ring.']];html='<h3>GHOST SIGNAL / ACTIVE CONTRACT</h3>'+jobs.map(([t,txt],i)=>`<div class="job-row ${stage===i+1?'active':stage>i+1?'done':''}"><b>${stage>i+1?'✓':'0'+(i+1)}</b><div><h3>${t}</h3><p>${txt}</p></div></div>`).join('')+`<div class="journal-shard"><h3>${shardRead?'ARCHIVE LOG / RECOVERED':'OPTIONAL / FIND THE ARCHIVE LOG'}</h3><p>${shardRead?'Relay 06 / Incident 441. The stored memories belong to residents of Null Market. Vanta marked them as test data. The Cold Archive log gives the owners their names back. Mara can use it to verify the core.':'A maintenance log is on the right desk at the back of the new room. Use F to take it. The log adds credits, components, and mission reward.'}</p></div>`;}
 else if(activePanel==='map'){html='<h3>NULL MARKET → RELAY 06 → COLD ARCHIVE</h3><canvas id="full-map" width="900" height="440" aria-label="Mission map with current objective and player location"></canvas><p>Yellow: current objective and route. Cyan: your location. Red: known guards. The center passage connects the relay to the Cold Archive.</p>';}
 else{html='<div class="contact-layout"><div class="contact-avatar">M</div><div><div class="eyebrow">MARA / DRIVER + FIXER</div><h3>SECURE CHANNEL / 06</h3><p>Contract: recover the Ghost Signal core from the Cold Archive. The getaway is at the south end of Mercy Street.</p><p>Current order: '+objectiveData().title+'</p><button class="primary" data-call="1">CALL MARA <span>↗</span></button><p>Press V in the mission to call the getaway or ask for the current objective.</p></div></div>';}
 $('field-content').innerHTML=html;if(activePanel==='map')drawFullMap();}
function drawFullMap(){const el=$('full-map');if(!el)return;const ctx=el.getContext('2d'),X=z=>40+(22-z)*8.4,Y=x=>220+x*12;ctx.fillStyle='#091923';ctx.fillRect(0,0,900,440);ctx.strokeStyle='#19333f';ctx.lineWidth=1;for(let x=20;x<900;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,440);ctx.stroke();}for(let y=4;y<440;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(900,y);ctx.stroke();}ctx.fillStyle='#19323e';ctx.fillRect(X(21.7),Y(-9),X(-47.5)-X(21.7),216);ctx.fillRect(X(-47.5),Y(-2.2),X(-55)-X(-47.5),52.8);ctx.fillRect(X(-55),Y(-9),X(-73)-X(-55),216);for(const c of colliders){if(!validCollider(c)||c.minY>2.8||c.maxX<-9||c.minX>9||c.minZ<-74||c.maxZ>23)continue;ctx.fillStyle=c.gate||c.archiveDoor?'#a68b50':'#38535f';ctx.fillRect(X(c.maxZ),Y(c.minX),(c.maxZ-c.minZ)*8.4,(c.maxX-c.minX)*12);}ctx.font='bold 12px monospace';ctx.fillStyle='#9dc4c7';ctx.fillText('NULL MARKET',130,60);ctx.fillText('RELAY 06',480,60);ctx.fillText('COLD ARCHIVE',664,60);ctx.fillStyle='#6d9baa';ctx.font='10px monospace';ctx.fillText('SOUTH / GETAWAY',35,380);ctx.fillText('NORTH / CORE',716,380);const o=objectiveData().pos;ctx.strokeStyle='#dfef79';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(X(player.z),Y(player.x));for(const p of routePoints())ctx.lineTo(X(p[2]),Y(p[0]));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e5ff47';ctx.save();ctx.translate(X(o[2]),Y(o[0]));ctx.rotate(Math.PI/4);ctx.fillRect(-5,-5,10,10);ctx.restore();for(const e of enemies)if(e.alive&&(e.tagged||e.aggro||elapsed<revealUntil)){ctx.fillStyle='#f17387';ctx.beginPath();ctx.arc(X(e.z),Y(e.x),3.5,0,TAU);ctx.fill();}ctx.fillStyle='#86f1e2';ctx.save();ctx.translate(X(player.z),Y(player.x));ctx.rotate(player.yaw);ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-4,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();ctx.restore();}

let fovCurrent=80;
let renderEye=[0,1.7,17],renderForward=[0,0,-1];
const _lightPick=new Uint8Array(256),_lookAt=new THREE.Vector3();
// The eleven lights nearest the camera, plus one on the player (the muzzle flash while firing).
function updateLights(){const n=Math.min(lights.length,256);_lightPick.fill(0,0,n);
 for(let k=0;k<11;k++){let best=-1,bd=1e18;for(let i=0;i<n;i++){if(_lightPick[i])continue;const l=lights[i].p,d=(l[0]-renderEye[0])**2+(l[2]-renderEye[2])**2;if(d<bd){bd=d;best=i;}}
  if(best<0){G.lightPos[k].value.set(0,0,0,.01);G.lightCol[k].value.set(0,0,0);continue;}
  _lightPick[best]=1;const l=lights[best];G.lightPos[k].value.set(l.p[0],l.p[1],l.p[2],l.p[3]);G.lightCol[k].value.set(l.c[0],l.c[1],l.c[2]);}
 if(muzzle>0){G.lightPos[11].value.set(player.x,player.y-.2,player.z,8);G.lightCol[11].value.set(3.9,2.4,.9);}else{G.lightPos[11].value.set(player.x,1.5,player.z,7);G.lightCol[11].value.set(.11,.18,.20);}}
// Film grade from the original final pass: chromatic fringe, bloom, gamma lift, vignette, grain,
// the red damage edge and the scanner's scanlines. The weapon layer is laid over the world first.
const viewPass=TSL.pass(viewScene,camera),viewTex=viewPass.getTextureNode('output');
function finalGrade(node,color){const {Fn,vec2,vec3,vec4,float,uv,sin,fract,dot:tdot,smoothstep,max:tmax,pow:tpow,screenSize}=TSL;
 return Fn(()=>{const q=uv(),edge=q.sub(.5).length(),off=q.sub(.5).mul(G.scan.mul(.0017).add(.0013));
  const glow=node.rgb.sub(color.rgb);
  const world=vec3(color.sample(q.add(off)).r,color.sample(q).g,color.sample(q.sub(off)).b).add(glow);
  const w=viewTex.sample(q);
  const col=world.mul(w.a.oneMinus()).add(w.rgb).toVar();
  col.assign(tpow(tmax(col,vec3(0)),vec3(.91)));
  col.mulAssign(float(1).sub(smoothstep(.30,.78,edge).mul(.32)));
  const grain=fract(sin(tdot(q.mul(screenSize).add(fract(G.time)),vec2(12.9898,78.233))).mul(43758.5453));
  col.addAssign(grain.sub(.5).mul(.015));
  col.addAssign(vec3(.12,0,.015).mul(G.hurt).mul(edge));
  col.mulAssign(float(1).sub(G.scan.mul(.06).mul(sin(q.y.mul(screenSize.y).mul(1.8)).mul(.5).add(.5))));
  col.addAssign(vec3(.045,.002,.008).mul(G.scan).mul(smoothstep(.15,.72,edge)));
  return vec4(col,1);
 })();}
const post=createPost(kit,scene,camera,{bloom:{strength:.55,radius:.3,threshold:.52},output:(node,{color})=>finalGrade(node,color)});
function render(dt){const menuView=mode==='menu';if(menuView){renderEye=[2.55+Math.sin(time*.075)*.40,1.80,16.0];renderForward=norm(sub([-.7,4.7,-15],renderEye));}else if(mode==='dialogue'){dialogueView();}else{const shake=settings.motion?hurt*.012:0;renderEye=[player.x+Math.sin(time*53)*shake,player.y+Math.cos(time*47)*shake,player.z];renderForward=aimDir(0);}
 const targetFov=menuView?76:mode==='dialogue'?64:scan?72/scanZoom:aiming&&weaponIndex<2?57:player.dashTime>0?89:player.speed>6?85:80;fovCurrent=lerp(fovCurrent,targetFov,1-Math.exp(-dt*11.9));
 camera.fov=fovCurrent;camera.updateProjectionMatrix();camera.position.set(renderEye[0],renderEye[1],renderEye[2]);_lookAt.set(renderEye[0]+renderForward[0],renderEye[1]+renderForward[1],renderEye[2]+renderForward[2]);camera.lookAt(_lookAt);
 // The same view-projection, kept for the HUD markers (project()).
 proj=M.perspective(fovCurrent*Math.PI/180,kit.size.width/Math.max(1,kit.size.height),.045,240,PROJ_BUF);view=M.look(renderEye,add(renderEye,renderForward),undefined,VIEW_BUF);VP=M.multiply(proj,view,VP_BUF);
 G.time.value=time;G.scan.value=scan?1:0;G.hurt.value=hurt;updateLights();
 beginDraw();drawWorld(null,renderEye);drawFX();drawScannerOutlines();if(!menuView)drawWeapon(renderEye);endDraw();
 post.render();}
function drawEnemy(e){if(e.hidden||e.carried)return;if(Math.hypot(e.x-renderEye[0],e.z-renderEye[2])>75)return;const base=e.alive?M.compose(e.x,e.stun>0?Math.sin(time*30)*.006:0,e.z,e.yaw):M.compose(e.x,.20,e.z,e.yaw,-Math.PI/2);const tint=e.hit>0?[1.8,.7,.6]:e.stun>0?[.55,1.35,1.7]:e.alive?(neutralEnemy(e)?[.9,1.15,1.13]:e.warden?[1.25,.75,.83]:[1,1,1]):[.45,.5,.55];draw(enemyTorso,base,tint);draw(enemyHead,base,tint);const stride=e.alive?Math.sin(e.walk)*.38:0;draw(enemyLimb,M.multiply(base,M.compose(-.18,.85,0,0,stride)),tint);draw(enemyLimb,M.multiply(base,M.compose(.18,.85,0,0,-stride)),tint);draw(enemyArm,M.multiply(base,M.compose(-.36,1.33,.04,0,-.12)),tint);draw(enemyArm,M.multiply(base,M.compose(.36,1.33,.04,0,-.15)),tint);if(!neutralEnemy(e))draw(enemyGun,M.multiply(base,M.compose(.18,1.07,.62)),tint);if(e.flash>0&&e.alive)draw(muzzleMesh,M.multiply(base,M.compose(.18,1.09,1.19,Math.PI,0,0,1.3,1.3,1.3)));}
function drawWorld(vp,eye,reflectionPass=false){draw(gateBatch,M.compose(0,gateLift,-28));draw(archiveDoorMesh,M.compose(0,archiveDoorLift,-48));drawArchiveDevices();for(const b of barrels)if(b.alive)draw(barrelMesh,M.compose(b.x,0,b.z));for(const s of supplies)if(!s.used)draw(supplyMesh,M.compose(s.x,0,s.z));draw(van,M.compose(-6.25,0,50.5,.04));for(const e of enemies)drawEnemy(e);
 if(stage<4||mode==='menu'){draw(coreMesh,M.compose(corePos[0],corePos[1]+.39+Math.sin(time*1.5)*.11,corePos[2],time*.65,.12,Math.sin(time)*.12));}
 draw(extractMesh,M.compose(...extractPos),stage===4?[.8,1,1]:[.13,.30,.34]);
 for(let i=0;i<2;i++){const z=22-((time*(i?2:2.8)+i*38)%85),x=i?3.7:-4.1;draw(droneMesh,M.compose(x,14.3+i*4+Math.sin(time+i)*.17,z,Math.PI));}
}
function drawWeapon(eye){if(mode!=='playing'||scan||holstered||wheelOpen)return;if(weaponIndex>=2){drawMeleeWeapon(eye);return;}const w=weapons[weaponIndex],rp=reloadTime>0?1-reloadTime/w.reload:0,reloadMove=reloadTime>0?Math.sin(rp*Math.PI):0,swap=Math.max(0,weaponSwap/.3),bob=settings.motion?Math.sin(player.bob)*.008*Math.min(player.speed/4,1):0,lean=settings.motion?-player.moveX*.025:0;
 const cameraWorld=M.compose(...eye,-player.yaw,player.pitch),gunPos=[aiming?0:.265,(aiming?-.202:-.285)+bob-reloadMove*.18-swap*.23,-.71+recoil*.37];const gunLocal=M.compose(...gunPos,-reloadMove*.38,recoil*.9+reloadMove*.29,-reloadMove*.72+lean+(inspectTime>0?Math.sin(inspectTime/1.5*Math.PI)*.85:0)+(meleeTime>0?Math.sin(meleeTime/.45*Math.PI)*.7:0));const gun=M.multiply(cameraWorld,gunLocal);drawLayer=1;drawFlash=.28;draw(weaponIndex?pistolMesh:rifleMesh,gun,[1.06,1.06,1.06]);if(weaponIndex===0){draw(magMesh,M.multiply(gun,M.compose(0,-.23-reloadMove*.34,-.08,0,reloadMove*.1)));}draw(handMesh,M.multiply(gun,M.compose(.035,-.20,.19,0,-.1,-.14)));if(weaponIndex===0)draw(handMesh,M.multiply(gun,M.compose(-.045,-.12,-.32,0,0,.22)));if(muzzle>0)draw(muzzleMesh,M.multiply(gun,M.compose(0,weaponIndex?.035:.023,weaponIndex?-.37:-.88,0,0,time*60,1.2,1.2,1.2)));drawLayer=0;drawFlash=0;}
function project(p){if(!VP)return null;const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],w=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];return{x:(x/w*.5+.5)*innerWidth,y:(-.5*y/w+.5)*innerHeight,w};}
const map=$('minimap').getContext('2d');
function drawMap(){const w=466,h=326,scale=10.7;map.clearRect(0,0,w,h);map.fillStyle='rgba(3,15,23,.88)';map.fillRect(0,0,w,h);map.save();map.translate(w/2,h*.58);map.rotate(-player.yaw);map.scale(scale,scale);map.translate(-player.x,-player.z);
 map.fillStyle='#17372e';map.fillRect(-20.3,-72.8,10.4,129.5);map.fillStyle='#10252f';map.fillRect(-9.8,-48.5,19.6,105.5);map.fillRect(-2.2,-55,4.4,7);map.fillRect(-9.1,-73,18.2,18);map.strokeStyle='#27505a';map.lineWidth=.08;for(let z=-74;z<59;z+=4){map.beginPath();map.moveTo(-10,z);map.lineTo(10,z);map.stroke();}for(const c of colliders){if(!validCollider(c)||c.minY>2.8)continue;map.fillStyle=c.gate?'#ab9659':c.maxY>5?'#24404a':'#304d54';map.fillRect(c.minX,c.minZ,c.maxX-c.minX,c.maxZ-c.minZ);map.strokeStyle='#40606b';map.lineWidth=.09;map.strokeRect(c.minX,c.minZ,c.maxX-c.minX,c.maxZ-c.minZ);}
 const target=navigationTarget();map.strokeStyle='#c0d866';map.lineWidth=.12;map.setLineDash([.45,.4]);map.beginPath();map.moveTo(player.x,player.z);map.lineTo(target[0],target[2]);map.stroke();map.setLineDash([]);map.fillStyle='#e5ff47';map.save();map.translate(target[0],target[2]);map.rotate(Math.PI/4);map.fillRect(-.32,-.32,.64,.64);map.restore();for(const e of enemies){if(!e.alive)continue;if(e.aggro||e.tagged||elapsed<revealUntil||(scan&&lineOfSight([player.x,player.y,player.z],[e.x,1.3,e.z]))||Math.hypot(e.x-player.x,e.z-player.z)<6){map.fillStyle=e.stun>0?'#65e7e9':'#ff6678';map.beginPath();map.arc(e.x,e.z,.24,0,TAU);map.fill();}}
 for(const s of supplies)if(!s.used){map.fillStyle='#6aa1ad';map.fillRect(s.x-.2,s.z-.2,.4,.4);}map.restore();map.fillStyle='rgba(92,227,235,.04)';map.beginPath();map.moveTo(w/2,h*.58);map.arc(w/2,h*.58,100,-Math.PI*.68,-Math.PI*.32);map.closePath();map.fill();map.strokeStyle='#8edcda';map.lineWidth=2;map.beginPath();map.moveTo(w/2,h*.58-11);map.lineTo(w/2-6,h*.58+6);map.lineTo(w/2,h*.58+3);map.lineTo(w/2+6,h*.58+6);map.closePath();map.fillStyle='#c1fff0';map.fill();map.stroke();map.strokeStyle='#446874';map.lineWidth=1;map.beginPath();map.moveTo(16,20);map.lineTo(16,37);map.moveTo(8,28);map.lineTo(24,28);map.stroke();map.fillStyle='#6495a4';map.font='14px monospace';map.fillText('N',13,55);map.font='12px monospace';map.fillStyle='#8db8ba';map.fillText(stage===4?'EXTRACTION ROUTE':'SECTOR 06',18,h-18);}

function routePoints(){const target=objectiveData().pos,pts=[];if(stage===2||stage===3){if(player.z>-44)pts.push([0,1.3,-44]);if(player.z>-48)pts.push([0,1.3,-49]);if(player.z>-55)pts.push([0,1.3,-55.8]);}else if(stage===4){if(player.z<-55)pts.push([0,1.3,-55.5]);if(player.z<-48)pts.push([0,1.3,-47]);if(player.z<-28)pts.push([0,1.3,-27]);}pts.push(target);return pts;}
function navigationTarget(){const points=routePoints();return points.find(p=>Math.hypot(p[0]-player.x,p[2]-player.z)>2)||points[points.length-1];}
function renderScannerHUD(){if(!scan)return;const t=scanObject,list=scanActions(),selected=list[Math.min(hackSelected,list.length-1)],h=HACKS[selected];setHTML('scan-ram','<b>RAM '+Math.floor(player.ram)+' / '+player.maxRam+'</b>'+Array.from({length:player.maxRam},(_,i)=>'<i class="'+(i>=Math.floor(player.ram)?'empty':'')+'"></i>').join(''));setHTML('hack-list',list.length?list.map((id,i)=>{const h=HACKS[id];return`<div class="hack-row ${i===hackSelected?'selected':''} ${player.ram<h.cost&&player.overclock<=0?'expensive':''}"><span class="hack-title">${h.name}<small>${h.trace?'TRACEABLE':'COVERT'} / ${h.time.toFixed(1)} S UPLOAD</small></span><b>${h.cost} RAM</b></div>`;}).join(''):'<div class="hack-row">'+(t?'NO REMOTE ACTIONS':'AIM AT A GUARD OR DEVICE')+'</div>');$('hack-description').textContent=h?(hackDetails?h.detail+' '+(h.trace?'This action starts a network trace.':'This action does not start a trace.') :h.detail):'Hold a target in the frame to scan it. Use the wheel to zoom when no target is selected.';
 $('scan-lock-label').textContent=!t?'SEARCHING':scanLock<1?'ANALYZING '+Math.floor(scanLock*100)+'%':'TARGET ACQUIRED';$('scan-acquire-bar').style.width=scanLock*100+'%';$('scan-name').textContent=t?(t.obj.name||({barrel:'VOLATILE POWER CELL',supply:'SUPPLY CACHE',core:'GHOST SIGNAL CORE',terminal:'RELAY ACCESS PANEL'}[t.kind])||'NETWORK DEVICE'):'NO TARGET';let meta='Aim at a guard or a device.',details='NEURAL LINK / ACTIVE';if(t){meta=Math.round(t.dist||Math.hypot(player.x-objectPosition(t)[0],player.z-objectPosition(t)[2]))+' METERS / '+t.kind.toUpperCase();if(t.kind==='enemy'){const e=t.obj;details='HEALTH '+Math.ceil(e.hp)+' / '+e.maxHp+'<br>'+(e.warden?'NETRUNNER / ARMORED':'VANTA / SECURITY')+'<br>'+(e.stun>0?'STUNNED':e.blind>0?'OPTICS OFFLINE':e.jam>0?'WEAPON JAMMED':e.aggro?'HOSTILE':'UNAWARE')+(e.tagged?'<br>TAGGED / TRACKING':'');}else if(t.kind==='device')details=(t.obj.active?'CONNECTED':'OFFLINE')+'<br>'+t.obj.type.toUpperCase()+(t.obj.tagged?'<br>TAGGED / TRACKING':'');else if(t.kind==='core')details=archiveUnlocked?'CORE LOCK OPEN / HOLD F NEAR THE CORE':'COOLANT INTERLOCK / LOCKED';else if(t.kind==='barrel')details='EXPLOSIVE / REMOTE DETONATION';else if(t.kind==='supply')details='AMMO / HEALTH / COMPONENTS';else details='LOCAL ACCESS ONLY / PRESS F NEAR THE PANEL';} $('scan-meta').textContent=meta;$('scan-details').innerHTML=details;}
function renderTags(){let html='';for(const e of enemies){if(!e.alive||Math.hypot(e.x-player.x,e.z-player.z)>36)continue;const visible=lineOfSight([player.x,player.y,player.z],[e.x,1.3,e.z]);if(!e.tagged&&elapsed>=revealUntil&&!(scan&&visible))continue;const p=project([e.x,2.12,e.z]);if(p&&p.w>0&&p.x>0&&p.x<innerWidth&&p.y>30&&p.y<innerHeight-100)html+=`<div class="scan-tag ${e.tagged?'tagged':''}" style="left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%)">${e.tagged?'◇ ':''}${e.warden?'WARDEN':'VANTA'}<small>${e.stun>0?'STUNNED':e.blind>0?'BLINDED':Math.round(e.hp)+' HP'} · ${Math.round(Math.hypot(e.x-player.x,e.z-player.z))} M</small><span class="tag-health"><i style="width:${e.hp/e.maxHp*100}%"></i></span></div>`;}
 for(const d of devices){if(!d.tagged&&elapsed>=revealUntil&&!(scan&&scanObject?.obj===d))continue;const p=project([d.x,d.y+.6,d.z]);if(p&&p.w>0&&p.x>0&&p.x<innerWidth&&p.y>30&&p.y<innerHeight-100)html+=`<div class="scan-tag device" style="left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%)">${d.name}<small>${d.active?'CONNECTED':'OFFLINE'}</small></div>`;}setHTML('scan-tags',html);}
function updateHUD(dt=0){setText('health-num',Math.ceil(player.hp));setStyle('health-bar','width',player.hp+'%');setText('armor-num',Math.ceil(player.armor));setStyle('armor-bar','width',clamp(player.armor/player.maxArmor*100,0,100)+'%');setText('ram-num',Math.floor(player.ram)+' / '+player.maxRam);setStyle('ram-bar','width',player.ram/player.maxRam*100+'%');setText('med-count',String(player.meds).padStart(2,'0'));setText('grenade-count',String(player.emp).padStart(2,'0'));setText('med-label',player.meds<2?'+'+Math.ceil(player.medTimer)+' S':'HEALTH');setText('emp-label',player.emp<2?'+'+Math.ceil(player.empTimer)+' S':'EMP');setStyle('med-charge','width',(player.meds>=2?100:100*(1-player.medTimer/healthRecharge()))+'%');setStyle('emp-charge','width',(player.emp>=2?100:100*(1-player.empTimer/empRecharge()))+'%');setText('cyber-count',player.overclock>0?Math.ceil(player.overclock)+'s':player.overclockCooldown>0?Math.ceil(player.overclockCooldown)+'s':'OC');setText('cyber-label',player.overclock>0?'ACTIVE':player.overclockCooldown>0?'RECHARGE':'OVERCLOCK');setVisible('overclock-layer',player.overclock>0);setStyle('stamina-bar','width',player.stamina+'%');setText('xp-num',stats.kills*100+stats.hacks*80+stats.takedowns*50+social.xp+' XP');const w=weapons[weaponIndex];setText('ammo-num',w.melee?'—':String(w.ammo).padStart(3,'0'));setStyle('ammo-num','color',!w.melee&&w.ammo<6?'#ff6973':'#f0f4dd');setText('reserve-num',w.melee?'∞':String(w.reserve).padStart(3,'0'));setText('weapon-name',holstered?'HOLSTERED / '+w.short:w.name);setText('ammo-caption',reloadTime>0?'RELOADING / '+Math.round((1-reloadTime/w.reload)*100)+'%':w.melee?'['+pk('fire')+'] ATTACK / HOLD STRONG  ['+pk('aim')+'] BLOCK':'['+pk('reload')+'] RELOAD  ['+pk('weapon')+' HOLD] WEAPON WHEEL');setStyle('crosshair','opacity',scan?'0':aiming?'.25':'.9');setStyle('crosshair','transform',`translate(-50%,-50%) scale(${1+recoil*3+(player.speed>5?.2:0)})`);setStyle('hitmarker','opacity',hitTime>0?1:0);setStyle('damage-layer','opacity',clamp(hurt*.47+(player.hp<25?.10:0),0,.7));setVisible('threat',threatLevel>0);setText('map-status',scan?'SCANNING':threatLevel>0?'COMBAT':traceActive?'TRACE ACTIVE':'CONNECTED');setStyle('map-status','color',threatLevel>0||traceActive?'#ff6973':'#5ce3eb');setText('zone-name',player.z<-54.75?'COLD ARCHIVE / NEURAL STORAGE':player.z<-47?'ARCHIVE ACCESS / SECURE ZONE':player.z<-28?'RELAY 06 / SECURE ZONE':'NULL MARKET / CHROME DISTRICT');
 const cardinal=['N','NE','E','SE','S','SW','W','NW'],angle=((player.yaw%TAU)+TAU)%TAU,i=Math.round(angle/(Math.PI/4))%8;setText('compass',cardinal[(i+7)%8]+' · · '+cardinal[i]+' · · '+cardinal[(i+1)%8]);if(scanTarget&&!scan){setVisible('target-info',true);$('target-info').querySelector('b').style.width=scanTarget.hp/scanTarget.maxHp*100+'%';}else setVisible('target-info',false);
 const target=navigationTarget(),goal=objectiveData(),marker=project([target[0],target[1]+.75,target[2]]),dist=Math.hypot(player.x-goal.pos[0],player.z-goal.pos[2]);if(marker){let px=marker.x,py=marker.y;if(marker.w<0){px=innerWidth-px;py=innerHeight*.77;}px=clamp(px,55,innerWidth-55);py=clamp(py,innerHeight*.17,innerHeight*.79);setStyle('waypoint','left',px+'px');setStyle('waypoint','top',py+'px');setStyle('waypoint','transform','translate(-50%,-50%)');setStyle('waypoint','opacity',scan?.22:interactable?.28:.95);$('waypoint').querySelector('span').textContent=goal.label+' · '+Math.round(dist)+' M';}
 let detection=0;for(const e of enemies)if(e.alive&&!e.aggro&&(e.detect||0)>detection)detection=e.detect;for(const d of devices)if(d.active&&!d.alerted&&(d.detect||0)>detection)detection=d.detect;setVisible('detection-ui',detection>.04&&threatLevel===0);setStyle('detection-bar','width',detection*100+'%');setText('detection-text',detection>.7?'DETECTION / TAKE COVER':'DETECTION');setVisible('network-ui',traceActive||traceAlarm);setText('network-text',traceAlarm?'LINK EXPOSED / REINFORCEMENTS':'NETWORK TRACE / '+Math.floor(trace)+'%');setStyle('network-bar','width',trace+'%');const q=hackQueue[0];setVisible('upload-ui',!!q);if(q){setText('upload-text',HACKS[q.hack].name+' / '+hackQueue.length+' QUEUED');setStyle('upload-bar','width',(1-q.left/q.total)*100+'%');}
 if(frameNumber%4===0){drawMap();renderTags();}renderScannerHUD();for(let f=floats.length-1;f>=0;f--){const t=floats[f];t.life-=dt;t.p[1]+=dt*.42;const p=project(t.p);if(t.life<=0||!p||p.w<0){t.el.remove();floats.splice(f,1);}else{t.el.style.left=p.x+'px';t.el.style.top=p.y+'px';t.el.style.opacity=clamp(t.life/.3,0,1);}}
}
function updateUI(dt){if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').style.opacity=0;}if(noticeTimer>0){noticeTimer-=dt;if(noticeTimer<=0)$('notice').style.opacity=0;}if(mode==='playing'){if(commsTimer>0){commsTimer-=dt;if(commsTimer<=0){$('comms').style.opacity=0;if(commsQueue.length){const s=commsQueue.shift();say(s.text,s.duration);}}}}}

function advanceGame(dt){elapsed+=dt;processAlt();const gameDT=dt*(scan?.18:wheelOpen?.08:1);hitTime=Math.max(0,hitTime-dt);hurt=Math.max(0,hurt-dt*.72);recoil=Math.max(0,recoil-dt*.48);muzzle=Math.max(0,muzzle-dt);killFlash=Math.max(0,killFlash-dt);medFlash=Math.max(0,medFlash-dt);meleeTime=Math.max(0,meleeTime-dt);shotWait=Math.max(0,shotWait-dt);weaponSwap=Math.max(0,weaponSwap-dt);inspectTime=Math.max(0,inspectTime-dt);
 if(reloadTime>0){reloadTime-=dt;if(reloadTime<=0){const w=weapons[weaponIndex],amount=Math.min(w.cap-w.ammo,w.reserve);w.ammo+=amount;w.reserve-=amount;Audio.click();}}
 updatePlayer(dt);if(mouseDown&&weaponIndex===0&&!scan&&!wheelOpen)fire();updateEnemies(gameDT);updateDevices(gameDT);updateNetwork(gameDT);if(mode==='playing')updateInteractions(dt);updateProjectiles(gameDT);updateEffects(gameDT);if(stage>=2&&(!stealth.used||stealth.frontOpen||social.permits.relay||(!inService()&&player.z>-47&&player.z<24))){gateLift=lerp(gateLift,4.3,Math.min(1,dt*2));if(player.z<-42||archiveDoorLift>.05)archiveDoorLift=lerp(archiveDoorLift,4.5,Math.min(1,dt*3));}
 if(!roomSeen&&player.x>-9.1&&player.z<-55&&stage>=2){roomSeen=true;notice('NEW AREA','COLD ARCHIVE','NEURAL STORAGE / SUBLEVEL 07',3.5);say(stealth.used?'You are behind the archive. Stay below the screens. The sensor bridge leaves clinic power and the owner records intact.':'The archive has its own camera and custodian. A visitor pass prevents detection. Ask Sable for a signed release, or use the coolant console to open the lock yourself.',7);saveCheckpoint();}
 if(stage===1&&elapsed>17&&missionHint===0){missionHint=1;toast('HOLD TAB TO SCAN · WHEEL TO SELECT · F TO UPLOAD');}if(stage===1&&social.entryOpen&&!social.permits.market&&elapsed>70&&missionHint===1){missionHint=2;say('The access panel is on the left of the gate. Follow the yellow marker.',7);}
}

// The kit runs the loop (setAnimationLoop) and pauses it while its settings panel is open.
function frame(rawDt){const dt=clamp(rawDt,.001,.05);frameMS=lerp(frameMS,rawDt*1000,.035);time+=dt;frameNumber++;Audio.tick();updateUI(dt);syncTouch();
 if(mode==='playing'){gameInput();if(mode==='playing')advanceGame(dt);}
 else{menuInput();
  if(mode==='grapple'){elapsed+=dt;updateEnemies(dt*.2);updateEffects(dt*.2);}else if(mode==='menu'){updateEffects(dt);hurt=0;muzzle=0;}
  else if(mode==='hacking'&&hackState?.started){hackState.time-=dt;setText('hack-timer',Math.max(0,hackState.time).toFixed(1));if(hackState.time<=0)finishHack(true);}}
 render(dt);if(mode!=='menu')updateHUD(mode==='playing'?dt:0);
 if(location.hash==='#dev')setText('fps',Math.round(1000/frameMS)+' FPS · '+world.count+' V · '+effects.length+' FX · '+kit.backendLabel);}
// Mercy Street / Social mission layer. State is serializable and lives in v3 saves.
const BACKGROUNDS={
 mediator:{name:'STREET MEDIATOR',tag:'COOL / READ THE ROOM',blurb:'You settled disputes before anyone drew a weapon. You know the cost of a promise.',skills:{cool:6,intelligence:3,technical:3,body:2}},
 analyst:{name:'SYSTEMS ANALYST',tag:'INTELLIGENCE / FOLLOW THE RECORD',blurb:'You once built the systems that count people as assets. Now you know where the records disagree.',skills:{cool:3,intelligence:6,technical:5,body:2}},
 veteran:{name:'EX-SECURITY',tag:'BODY / KNOW THE CHAIN OF COMMAND',blurb:'You wore the uniform. You know when an order protects people, and when it protects the person who gave it.',skills:{cool:4,intelligence:3,technical:3,body:6}}
};
const SKILL_NAMES={cool:'COOL',intelligence:'INTELLIGENCE',technical:'TECHNICAL',body:'BODY'};
const SKILL_SHORT={cool:'COOL',intelligence:'INT',technical:'TECH',body:'BODY'};
const SKILL_DESC={cool:'Read motives. Make a case.',intelligence:'Read data. Test a claim.',technical:'Use systems and service rules.',body:'Show force. Know security work.'};
const EVIDENCE={
 clinicNeed:['CLINIC POWER','The clinic shares the relay power supply. A forced outage puts patients at risk.'],
 residentLedger:['REDACTED OWNERSHIP LEDGER','Patient consent covers treatment, not a sale of memories. Iona removed all names from this copy.'],
 workOrder:['SERVICE ORDER C7 / BLUE','Jax has a valid coolant service order. C7 is the work type. BLUE is the closed loop.'],
 payroll:['PAYROLL HOLD','Vanta withholds staff wages until the archive audit closes. The guards have a stake in the result.'],
 policy:['CHAIN OF CUSTODY','Rhee needs a signed transfer record. A visitor permit does not authorize removal of the core.'],
 archiveLog:['INCIDENT 441 / OWNER MATCH','The archive record matches the clinic ledger. The memories belong to residents, not Vanta.'],
 splitKey:['SHARED KEY PLAN','A clinic, a worker representative, and a resident trustee can each hold one key. No single party can sell the archive.']
};
const CONTACTS={
 mara:{id:'mara',name:'MARA',full:'MARA / FIXER',role:'DRIVER · MERCY STREET',x:-3.4,z:50,topic:'THE CONTRACT',read:'She wants a complete core. Ask who pays for it before you agree to deliver it.'},
 iona:{id:'iona',name:'IONA REYES',full:'IONA REYES',role:'CLINIC WORKER · LAST SHIFT',x:-5.8,z:41,topic:'WHO OWNS A MEMORY?',read:'She protects patients, not property. A true fact can still put someone at risk.'},
 jax:{id:'jax',name:'JAX WEI',full:'JAX “STATIC” WEI',role:'COURIER · WORKERS’ NETWORK',x:5.8,z:37.2,topic:'THE PEOPLE AT THE GATE',read:'He trusts practical help more than a claim about good intentions.'},
 vale:{id:'vale',name:'SERGEANT VALE',full:'SERGEANT VALE',role:'CHECKPOINT OFFICER · SOUTH GATE',x:-1.8,z:26.3,topic:'A REASON TO LET YOU THROUGH',read:'He needs a reason he can put in a report. A threat may open a door, but it will not open every door.'},
 rhee:{id:'rhee',name:'LIEUTENANT RHEE',full:'LIEUTENANT RHEE',role:'RELAY SECURITY · DUTY OFFICER',enemyId:3,topic:'WHO SIGNS THE ORDER?',read:'His badge carries liability. Separate his duty from the company’s orders.'},
 sable:{id:'sable',name:'WARDEN SABLE',full:'WARDEN SABLE',role:'COLD ARCHIVE · CUSTODIAN',enemyId:8,topic:'THE TERMS OF RELEASE',read:'She can release the core. She cannot make its ownership dispute disappear.'}
};
function freshSocial(){return{background:'mediator',skills:{...BACKGROUNDS.mediator.skills},focus:2,profileSet:false,entryOpen:false,streetLift:0,permits:{market:false,relay:false,archive:false,exit:false},trust:{mara:2,iona:0,jax:0,vale:0,rhee:0,sable:0},suspicion:{mara:0,iona:0,jax:0,vale:0,rhee:0,sable:0},evidence:{},promises:{},flags:{},routes:{},seen:{},events:[],transcript:[],checks:0,xp:0,violence:0,hostile:false,deal:null,fee:0,bond:0,witnessExposed:false,streetSeen:false};}
let social=freshSocial(),dialogue=null,profilePick='mediator',profileBoost={cool:0,intelligence:0,technical:0,body:0},socialMessage='',socialMessageTimer=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function socialEvent(id,text,xp=0){if(social.events.some(e=>e.id===id))return;social.events.push({id,text,time:elapsed});social.xp+=xp;socialMessage=text;socialMessageTimer=7;}
function learn(id){if(!EVIDENCE[id]||social.evidence[id])return;social.evidence[id]=true;socialEvent('evidence-'+id,'EVIDENCE ADDED / '+EVIDENCE[id][0],40);Audio.click();}
function trust(id,n=1){social.trust[id]=clamp((social.trust[id]||0)+n,0,5);}
function suspicion(id,n=1){social.suspicion[id]=clamp((social.suspicion[id]||0)+n,0,3);}
function promise(id,text){if(!social.promises[id]){social.promises[id]=text;socialEvent('promise-'+id,'PROMISE RECORDED / '+text);}}
function contactActor(id){const c=CONTACTS[id];if(!c)return null;if(c.enemyId!==undefined){const e=enemies.find(e=>e.id===c.enemyId);return e?.alive?{...c,x:e.x,z:e.z,enemy:e}:null;}return c;}
function neutralEnemy(e){if(!e.alive||social.hostile)return false;const zone=e.homeZ>-28?'market':e.homeZ>-48?'relay':'archive';return !!social.permits[zone];}
function neutralTick(e,dt){e.aggro=false;e.detect=0;e.hit=Math.max(0,e.hit-dt);e.flash=0;e.walk=0;e.patrol+=dt*.4;e.attack=Math.max(e.attack,1);if(e.id===3||e.id===8){const dx=player.x-e.x,dz=player.z-e.z;if(Math.hypot(dx,dz)<9)e.yaw=Math.atan2(dx,dz);}else e.yaw=Math.sin(e.patrol)*.7;}
function grantMarket(route){social.entryOpen=true;social.permits.market=true;social.routes.market=route;social.hostile=false;socialEvent('market-pass','MARKET ACCESS / '+route.toUpperCase(),150);for(const e of enemies)if(e.homeZ>-28){e.aggro=false;e.detect=0;}threatLevel=0;updateObjective();saveCheckpoint();}
function grantRelay(route,visitor=true){social.entryOpen=true;social.permits.market=true;social.permits.relay=true;social.permits.archive=visitor;social.routes.relay=route;social.hostile=false;if(stage===1)stage=2;for(const e of enemies)if(neutralEnemy(e)){e.aggro=false;e.detect=0;}threatLevel=0;trace=0;traceActive=false;traceAlarm=false;socialEvent('relay-pass',visitor?'RELAY + ARCHIVE / VISITOR ACCESS':'RELAY ACCESS / ARCHIVE NOT CLEARED',225);updateObjective();saveCheckpoint();}
function signDeal(kind){const endings={community:{fee:450,route:'Three-key community trust'},sealed:{fee:1000,route:'Sealed corporate transfer'},blind:{fee:650,route:'Anonymous release'},threat:{fee:800,route:'Release under threat'}};
 const d=endings[kind];if(!d)return;social.deal=kind;social.fee=d.fee;social.hostile=false;social.permits.market=true;social.permits.relay=true;social.permits.archive=true;social.permits.exit=kind!=='threat';social.routes.archive=d.route;social.flags.dealSigned=true;social.flags.brokenDeal=false;
 if(kind==='community')promise('community','Give the owners control through three independent keys.');
 if(kind==='sealed')promise('sealed','Deliver the core sealed. No independent copy.');
 if(kind==='blind')social.flags.indexErased=true;
 if(stage===2){archiveUnlocked=true;stage=3;coolantTransfer=0;}
 trace=0;traceActive=false;traceAlarm=false;hackQueue=[];for(const e of enemies){if(neutralEnemy(e)){e.aggro=false;e.detect=0;}}for(const d of devices)d.detect=0;threatLevel=0;
 socialEvent('archive-deal','CORE RELEASE / '+d.route.toUpperCase(),300);updateObjective();saveCheckpoint();Audio.hack();
}
function markAggression(reason){if(mode!=='playing'&&mode!=='grapple')return;social.violence++;const had=social.permits.market||social.permits.relay||social.permits.archive||social.permits.exit;social.hostile=true;social.permits={market:false,relay:false,archive:false,exit:false};social.flags.brokenDeal=!!social.deal;socialEvent('first-violence','HOSTILE ACTION / '+reason);if(had){socialEvent('permits-revoked','ACCESS REVOKED / SECURITY NO LONGER HONORS YOUR PASS');notice('TERMS BROKEN','ACCESS REVOKED','HOLSTER TO ASK FOR A TRUCE. LETHAL FORCE CLOSES THAT ROUTE.',3.5);}updateObjective();}
function drawContacts(){for(const id of ['mara','iona','jax','vale']){const c=CONTACTS[id];if(Math.hypot(c.x-renderEye[0],c.z-renderEye[2])>73)continue;const yaw=mode==='dialogue'&&dialogue?.speaker===id?0:Math.hypot(c.x-player.x,c.z-player.z)<8?Math.atan2(player.x-c.x,player.z-c.z):0;const y=settings.motion?Math.sin(time*1.1+c.z)*.005:0;draw(citizenMeshes[id],M.compose(c.x,y,c.z,yaw));}draw(streetGateMesh,M.compose(0,social.streetLift,24));}
function skillHTML(skills,controls=false){return '<div class="skill-allocation">'+Object.keys(SKILL_NAMES).map(id=>`<div class="skill-box"><div><strong>${SKILL_NAMES[id]}</strong><b>${skills[id]}</b></div><p>${SKILL_DESC[id]}</p>${controls?`<div class="skill-buttons"><button data-skill-minus="${id}" aria-label="Remove one ${SKILL_NAMES[id]} point" ${profileBoost[id]===0?'disabled':''}>−</button><button data-skill-plus="${id}" aria-label="Add one ${SKILL_NAMES[id]} point" ${Object.values(profileBoost).reduce((a,b)=>a+b,0)>=2?'disabled':''}>+</button></div>`:''}</div>`).join('')+'</div>';}
function renderProfile(){const b=BACKGROUNDS[profilePick];$('background-cards').innerHTML=Object.entries(BACKGROUNDS).map(([id,p],i)=>`<button class="background-card ${profilePick===id?'selected':''}" data-background="${id}" aria-pressed="${profilePick===id}"><span class="profile-id">0${i+1} / BACKGROUND</span><strong>${p.name}</strong><p>${p.blurb}</p><small>${p.tag}</small></button>`).join('');const sk={};for(const id in b.skills)sk[id]=b.skills[id]+profileBoost[id];$('profile-skills').innerHTML=skillHTML(sk,true);const left=2-Object.values(profileBoost).reduce((a,b)=>a+b,0);$('profile-note').innerHTML=`${left} FOCUS POINT${left===1?'':'S'} LEFT / MAXIMUM SKILL 8<br>Choose your skills now. This mission does not allow a reset.`;}
function openProfile(){profilePick='mediator';profileBoost={cool:0,intelligence:0,technical:0,body:0};mode='profile';resetInputs();releaseMouse();document.body.classList.add('profiling');setVisible('profile-screen',true);renderProfile();$('profile-confirm').focus();}
function confirmProfile(){if(mode!=='profile')return;const remaining=2-Object.values(profileBoost).reduce((a,b)=>a+b,0);if(remaining>0){socialMessage='Spend the two focus points before you start.';$('profile-note').textContent=socialMessage;Audio.click(false);return false;}social.background=profilePick;social.skills={...BACKGROUNDS[profilePick].skills};for(const id in profileBoost)social.skills[id]+=profileBoost[id];social.focus=0;social.profileSet=true;mode='playing';holstered=true;setVisible('profile-screen',false);document.body.classList.remove('profiling');resetInputs();saveCheckpoint();canvas.focus();captureMouse();notice('NEW AREA','MERCY STREET','TALK TO MARA. KEEP YOUR WEAPON HOLSTERED.',4.5);commsTimer=0;commsQueue.length=0;say('I am by the car. Talk to me before you head for the checkpoint. People here know things the scanner does not.',7);updateObjective();return true;}
function node(text,choices,read=''){return{text,choices,read};}
function C(id,text,next,extra={}){return{id,text,next,...extra};}
function back(text='I have another question.'){return C('back',text,'root',{hint:'ASK / No commitment'});}
function leave(text='I will be back.'){return C('leave',text,null,{hint:'LEAVE / Keep all agreed terms'});}
function req(skill,n){return{skill,n};}
function has(id){return !!social.evidence[id];}
function getCheck(c){let reason='';if(c.skill&&social.skills[c.skill.skill]<c.skill.n)reason=`${SKILL_NAMES[c.skill.skill]} ${c.skill.n} required / current ${social.skills[c.skill.skill]}`;if(c.need&&!c.need())reason=c.reason||'The required evidence is missing.';if(c.cost&&player.credits<c.cost)reason=`Need €$${c.cost} / you have €$${player.credits}`;if(c.once&&social.flags[c.once])reason='This action is complete.';return{ok:!reason,reason};}
function rootFor(id){if(social.hostile&&['vale','rhee','sable'].includes(id))return 'truce';if(id==='vale'&&social.permits.market)return'cleared';if(id==='rhee'&&stage>=2&&social.permits.relay)return'cleared';if(id==='sable'&&social.deal)return'agreed';return'root';}
function canTalk(id){const c=contactActor(id);if(!c)return false;if(social.hostile&&['mara','iona','jax'].includes(id))return !inCombat();if(inCombat())return holstered&&['vale','rhee','sable'].includes(id)&&stats.kills-stats.nonlethal===0;return true;}
function openDialogue(id,forcedNode=null){if(mode!=='playing')return false;const c=contactActor(id);if(!c||Math.hypot(c.x-player.x,c.z-player.z)>3.5)return false;if(grenades.length||hackQueue.length||enemies.some(e=>e.alive&&e.burn>0)){toast('WAIT FOR ACTIVE WEAPONS AND UPLOADS TO STOP.');return false;}if(!canTalk(id)){toast('COMBAT ACTIVE / HOLSTER AND WITHDRAW TO TALK.');return false;}
 mode='dialogue';resetInputs();holstered=true;releaseMouse();setVisible('dialogue-screen',true);document.body.classList.add('talking');setVisible('interaction',false);commsTimer=0;commsQueue.length=0;$('comms').style.opacity=0;dialogue={speaker:id,node:forcedNode||rootFor(id),selected:0,result:'',historyOpen:false};social.seen[id]=true;renderDialogue(true);Audio.click();return true;}
function closeDialogue(){if(mode!=='dialogue')return;setVisible('dialogue-screen',false);setVisible('talk-history',false);document.body.classList.remove('talking');dialogue=null;mode='playing';resetInputs();holstered=true;shotWait=.35;player.invuln=Math.max(player.invuln,.7);canvas.focus();captureMouse();updateObjective();if(!inCombat()&&!social.hostile)saveCheckpoint();}
function addTranscript(speaker,text){social.transcript.push({speaker,text});if(social.transcript.length>160)social.transcript.shift();}
function selectChoice(index){if(mode!=='dialogue'||!dialogue||dialogue.historyOpen)return false;const nd=dialogueNode(dialogue.speaker,dialogue.node),c=nd.choices[index];if(!c)return false;const check=getCheck(c);if(!check.ok){dialogue.result=check.reason;renderDialogue();Audio.click(false);return false;}const who=dialogue.speaker;socialMessage='';addTranscript('YOU',c.text);if(c.cost){player.credits-=c.cost;socialEvent('spend-'+who+'-'+c.id,'PAID / €$'+c.cost);}if(c.once)social.flags[c.once]=true;if(c.skill&&!social.flags['check-'+who+'-'+c.id]){social.flags['check-'+who+'-'+c.id]=true;social.checks++;social.xp+=60;}if(c.effect)c.effect();const next=typeof c.next==='function'?c.next():c.next;dialogue.result=c.result||socialMessage||'';if(next===null){closeDialogue();return true;}dialogue.node=next||'root';dialogue.selected=0;renderDialogue(true);Audio.click();return true;}
function renderDialogue(record=false){if(!dialogue)return;const c=CONTACTS[dialogue.speaker],nd=dialogueNode(dialogue.speaker,dialogue.node);if(record)addTranscript(c.name,nd.text);$('talk-role').textContent=c.role;$('talk-person').textContent=c.full;$('talk-state').textContent=`TRUST ${social.trust[c.id]||0} / 5  ·  DOUBT ${social.suspicion[c.id]||0} / 3`;$('talk-read').textContent=nd.read||c.read;$('talk-skills').innerHTML=Object.keys(SKILL_NAMES).map(id=>`<span>${SKILL_SHORT[id]} ${social.skills[id]}</span>`).join('');$('talk-evidence').textContent=`€$ ${player.credits} · ${Object.keys(social.evidence).length} RECORDS · ${Object.keys(social.promises).length} PROMISES`;$('talk-topic').textContent=c.topic;$('talk-count').textContent=BACKGROUNDS[social.background].name;$('dialogue-name').textContent=c.name;$('dialogue-line').textContent=nd.text;$('talk-result').textContent=dialogue.result;
 $('dialogue-choices').innerHTML=nd.choices.map((ch,i)=>{const check=getCheck(ch);let tag=ch.skill?`[${SKILL_SHORT[ch.skill.skill]} ${ch.skill.n} / YOU ${social.skills[ch.skill.skill]}] `:'';if(ch.cost)tag+=`[€$ ${ch.cost}] `;return`<button class="dialogue-choice ${ch.commit?'commit':''}" data-choice="${i}" ${check.ok?'':'disabled'} aria-label="${i+1}. ${esc(ch.text)}${check.ok?'':'. Locked: '+esc(check.reason)}"><span class="choice-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(ch.text)}</strong><small><span class="${check.ok?'check-pass':'check-fail'}">${esc(tag)}</span>${esc(check.ok?(ch.hint||'ASK / Learn more'):check.reason)}</small></span></button>`;}).join('');
 if(record){$('dialogue-choices').querySelector('button:not(:disabled)')?.focus({preventScroll:true});document.querySelector('.talk-shell').scrollTop=0;}
}
function toggleHistory(){if(mode!=='dialogue'||!dialogue)return;dialogue.historyOpen=!dialogue.historyOpen;setVisible('talk-history',dialogue.historyOpen);if(dialogue.historyOpen){$('talk-history-content').innerHTML=social.transcript.map(t=>`<div class="transcript-row"><strong>${esc(t.speaker)}</strong><p>${esc(t.text)}</p></div>`).join('');$('talk-history-content').scrollTop=$('talk-history-content').scrollHeight;$('talk-history-close').focus();}else $('dialogue-choices').querySelector('button:not(:disabled)')?.focus({preventScroll:true});}

function rapport(id,key,n=1){const k='rapport-'+id+'-'+key;if(!social.flags[k]){social.flags[k]=true;trust(id,n);}}
function dialogueNode(id,n){
 if(n==='root'){
  if(id==='vale'&&social.permits.market)n='cleared';
  if(id==='rhee'&&stage>=2&&social.permits.relay)n='cleared';
  if(id==='sable'&&social.deal)n='agreed';
 }
 if(n==='truce')return node(stats.kills-stats.nonlethal>0?'Someone died. I can report a mistake. I cannot report a body as a mistake. There will be no private deal now.':'You broke the terms. Keep your hands empty. A new pass is possible only if there are no deaths and you cover the security callout.',[
  C('repair','I pay the callout. Put a truce on the record.','repaired',{cost:200,need:()=>stats.kills-stats.nonlethal===0,reason:'A lethal casualty prevents a truce.',commit:true,hint:'DEAL / Restore entry and market access. Renegotiate the other areas.',effect:()=>{social.hostile=false;social.flags.brokenDeal=true;social.deal=null;social.permits={market:false,relay:false,archive:false,exit:false};social.suspicion[id]=Math.max(0,social.suspicion[id]-1);trace=0;traceActive=false;traceAlarm=false;for(const e of enemies){e.aggro=false;e.detect=0;e.lastSeen=-99;e.attack=2;}grantMarket('Recorded truce');if(id==='sable'){social.permits.relay=true;social.permits.archive=true;}threatLevel=0;socialEvent('truce','TRUCE SIGNED / THE EARLIER VIOLENCE REMAINS IN THE RECORD');}}),leave('I am leaving.')]);
 if(n==='repaired')return node('The callout is closed. The next breach will still cost you. A truce is not permission to take the core.',[C('continue','Let us discuss the job.','root'),leave()]);
 if(id==='mara')return maraDialogue(n);
 if(id==='iona')return ionaDialogue(n);
 if(id==='jax')return jaxDialogue(n);
 if(id==='vale')return valeDialogue(n);
 if(id==='rhee')return rheeDialogue(n);
 if(id==='sable')return sableDialogue(n);
 if(id==='panel')return panelDialogue(n);
 return node('There is nothing more to add.',[leave()]);
}
function maraDialogue(n){switch(n){
 case'root':return node(stage===4?(social.permits.exit?'Your transfer is signed. No one has to die for this. Get in the car when you are ready.':'The core is here. Your return pass is not. Reach the car and I will get us out.'):'The market is one street north. Vale holds the gate. Rhee holds the relay. Sable holds the core. Three people. Three reasons to say no.\n\nYou can shoot the locks. Or find out what each person is protecting.',[
  C('terms','Before I agree: who is buying these memories?','buyer'),
  C('people','Tell me about the people, not the locks.','people'),
  C('skills','What does my background get me?','skills'),
  C('nonviolence','I want the core without a body count.','peace',{effect:()=>rapport('mara','peace')}),
  leave(stage===4?'Open the car. I am ready.':'I will talk to the street first.')]);
 case'buyer':return node('A broker offered a thousand for a sealed transfer. The broker sells access, not the box. That may be legal. It does not make the memories theirs.\n\nI can change the buyer. A community trust can pay four-fifty. Less money. Less risk that we do this job again next month.',[
  C('broker','So the clean paperwork is not the clean outcome.','buyer-truth',{effect:()=>rapport('mara','buyer')}),
  C('community','A community trust still has people who can sell out.','trust'),back()]);
 case'buyer-truth':return node('Correct. You asked what the job pays. Now you know what it costs.\n\nA sealed handover can get you in and out without a shot. It leaves the ownership rules in Vanta’s hands. Do not mistake a quiet exit for a good result.',[back(),leave()]);
 case'trust':return node('Then do not give one person the key. Iona can speak for the clinic. Jax can speak for the workers. Find a resident trustee for the third share. Sable can hold it until that person is chosen.\n\nIt will be slow. Some people may never agree. That is what consent looks like when it is not a button.',[
  C('split','Three keys. No single owner can sell the archive.','peace',{effect:()=>learn('splitKey'),result:'PLAN RECORDED / SHARED KEYS'}),back()]);
 case'people':return node('Iona is outside the clinic on the left. Ask what a power cut would do. Jax has a work order, and a long memory for unpaid wages.\n\nVale needs a defensible entry in his report. Rhee needs someone else to share liability. Sable needs to believe the next owner will be different.',[C('privacy','Do not use them as disposable cover.','peace',{effect:()=>{promise('protect','Keep the clinic and its witnesses out of security reports.');rapport('mara','privacy');}}),back()]);
 case'skills':return node(BACKGROUNDS[social.background].blurb+'\n\nCool helps you read motives. Intelligence tests claims. Technical skill turns a work order into a route. Body can make a threat credible.\n\nThe number shows whether you can make an argument. It does not make that argument wise. Facts can open routes that no skill check can.',[back(),leave()]);
 case'peace':return node('Keep your weapon holstered. Press F to talk. Read the terms before you agree. Your journal keeps the facts and promises.\n\nA pass only covers the named area. Shooting, harmful hacks, or an EMP will cancel it. A bluff can fail. An honest correction can still recover a deal.',[back(),leave('I will bring back more than a box.')]);
 default:return maraDialogue('root');}}
function ionaDialogue(n){switch(n){
 case'root':return node(social.witnessExposed?'Security has my name now. I asked you for one thing. Take what you already know. You will get no more from me.':has('residentLedger')?'You have the proof. The missing part is what you will do with it. Do not turn my patients into the price of admission.':'You are looking north. Everyone with a gun does. Before you cut the relay power, look at the clinic behind me. Six people inside cannot breathe on a battery.',social.witnessExposed?[leave('I have no excuse.')]:[
  C('power','The clinic and archive share power?','power',{effect:()=>{learn('clinicNeed');rapport('iona','power');}}),
  C('owners','Whose memories are in the archive?','owners'),
  C('hands','You keep hiding the names on that screen.','names',{skill:req('cool',5),hint:'READ / Notice what she protects. Do not claim to read her mind.',effect:()=>rapport('iona','read')}),
  C('support','Put this toward the clinic supply line.','support',{cost:80,once:'clinicDonation',hint:'HELP / Spend €$80. No access pass is included.',effect:()=>{rapport('iona','donation',2);social.flags.clinicHelped=true;},result:'CLINIC SUPPORT / €$80'}),
  leave()]);
 case'power':return node('Vanta calls it shared infrastructure. We call it a switch they can hold over us.\n\nThe coolant loop can be isolated without touching clinic power. A good technician knows that. A loud breach sends everyone onto backup power, even if the lights come back.',[
  C('loop','Use a closed coolant loop. Keep the clinic feed live.','power-plan',{skill:req('technical',5),effect:()=>{learn('workOrder');rapport('iona','loop');},result:'SERVICE DETAIL / C7 CLOSED LOOP, BLUE LINE'}),
  C('askCourier','Who can get me a service order?','courier',{effect:()=>rapport('iona','listen')}),back()]);
 case'power-plan':return node('C7, blue line. Jax has the actual order. If you know the system, that is enough to make a credible service request.\n\nYou know how not to hurt us. Now find out how they hurt us without breaking anything.',[C('owners','Tell me about the people in that core.','owners'),back()]);
 case'courier':return node('Jax, at the laundry stop. He has a coolant service job. He does not have permission to touch the memories. Those are different doors.',[back(),leave('I will speak to him.')]);
 case'owners':return node('Most are residents who traded a copy for treatment. Some knew there was a price. Some were too ill to read it.\n\nThey signed a treatment license, not a sale. Vanta changed the label from patient record to test data. The memories stayed the same. The rights did not.',[
  C('proof','Can you prove the license changed?','proof',{effect:()=>rapport('iona','proof')}),
  C('consent','Some signed willingly. Do they get to choose again?','consent',{effect:()=>rapport('iona','consent',2)}),
  C('shortcut','Give me one patient name. Security can check it.','name-risk',{hint:'RISK / An easy check can expose a person.'}),back()]);
 case'consent':return node('Yes. That is the point. Not every person wants a rescue. A memory can hold grief, or the last trace of someone they loved.\n\nGive each person a choice. Do not erase everyone because erasure looks clean in your report.',[C('proof','Then I need proof without their names.','proof',{effect:()=>rapport('iona','names')}),back()]);
 case'names':return node('I am hiding witnesses, not errors. If I show you one person, Vanta will know which person spoke.\n\nYou noticed the screen. Notice the cost of asking me to turn it around.',[C('redact','Keep the names. Give me the terms and the dates.','proof',{effect:()=>rapport('iona','redaction')}),back()]);
 case'name-risk':return node('A patient with rent due. A brother with a security badge. A girl whose medicine comes from a Vanta account. Which life would you like to use as your password?',[
  C('sorry','None. Show me proof that does not expose them.','proof',{effect:()=>rapport('iona','correction')}),leave('I will find another route.')]);
 case'proof':return node('I can give you the license terms, signed dates, and anonymous record hashes. Sable can match them inside.\n\nMy name is not on the file. That does not make me safe if you put my part in a report. Will you keep the clinic and its witnesses out of the deal?',[
  C('protect','Yes. No names. No witnesses in a security report.','ledger',{commit:true,hint:'PROMISE / Protect the source. Gain redacted ownership proof.',effect:()=>{promise('protect','Keep the clinic and its witnesses out of security reports.');learn('residentLedger');rapport('iona','pledge',2);},result:'OWNERSHIP LEDGER ADDED / SOURCE PROTECTION PROMISED'}),
  C('noPromise','I will not make a promise I may have to break.','limited',{effect:()=>rapport('iona','honesty')}),back()]);
 case'ledger':return node('Here. The dates, not the people. That file proves the consent limit. Match it to Incident 441 in the archive.\n\nIf Sable wants a better owner, ask who gets to hold the key. One honest person is not a system.',[C('three','The clinic, workers, and residents can each hold a key.','keys',{effect:()=>learn('splitKey')}),leave('I will keep the source out of it.')]);
 case'keys':return node('Then no one can sell it alone. It will take longer. A person may need help to prove a claim.\n\nThat is better than making a decision for everyone at once.',[leave('Three keys. I will put it to Sable.'),back()]);
 case'limited':return node('Thank you for saying it plainly. You can still ask Vale for a logged visit. You do not get to carry my proof without carrying the duty that comes with it.',[back(),leave()]);
 case'support':return node('That pays for clean filters. It does not buy my patients.\n\nStill, it is the first help tonight that did not come with an ownership clause.',[C('proof','I need to understand what Vanta took.','owners'),back(),leave()]);
 default:return ionaDialogue('root');}}
function jaxDialogue(n){switch(n){
 case'root':return node('A contractor walks in with a badge. A courier walks in with a number. A guard walks in with a pension to lose.\n\nWhich story were you planning to tell?',[
  C('order','I need the coolant service order.','order'),
  C('wages','What are the guards afraid of losing?','wages',{effect:()=>{learn('payroll');rapport('jax','workers');}}),
  C('codeRead','That work code is for a closed loop, not a full outage.','code',{skill:req('technical',5),effect:()=>{learn('workOrder');rapport('jax','trade');}}),
  C('veteran','A badge does not mean the company pays you on time.','wages',{skill:req('body',5),hint:'BACKGROUND / Use security experience, not a threat.',effect:()=>{learn('payroll');rapport('jax','uniform',2);}}),leave()]);
 case'wages':return node('Vanta froze overtime until the audit closes. Vale has a sick parent. Rhee signs the pay sheets but cannot release the money.\n\nDo not say they are innocent. Say their employer is making them absorb the risk. That is a fact they can recognize.',[C('copy','They should get the audit record, not just a warning.','workers',{effect:()=>{promise('staff','Give staff a copy of the audit record.');rapport('jax','copy',2);}}),back()]);
 case'workers':return node('A copy they can use to claim the wages. Good. But remember that promise if someone offers you more money for a sealed file.',[C('order','Can your work order get me inside?','order'),back(),leave()]);
 case'order':return node('C7, blue line. The code is not the hard part. Vale will ask why a stranger has my order.\n\nI can sign you on as relief. You carry the responsibility if you touch the wrong feed. Or you can buy the route and leave my name out.',[
  C('clinic','I checked the clinic feed. I will keep it live.','code',{need:()=>has('clinicNeed'),reason:'Ask Iona about the clinic power first.',hint:'EVIDENCE / A truthful relief-worker request.',effect:()=>{learn('workOrder');promise('power','Keep clinic power live. Do not force the street gate.');rapport('jax','clinic',2);}}),
  C('medicine','Take a health charge for the clinic queue.','code',{need:()=>player.meds>0,reason:'You need at least one health charge.',once:'courierMed',hint:'TRADE / Spend one health charge. It will recharge.',effect:()=>{player.meds--;if(player.medTimer<=0)player.medTimer=healthRecharge();learn('workOrder');rapport('jax','meds',2);}}),
  C('buy','I pay for the route. Your name stays out.','code',{cost:60,once:'boughtWorkOrder',hint:'TRADE / €$60 for the service facts, not an access pass.',effect:()=>learn('workOrder')}),back()]);
 case'code':return node('C7 is coolant maintenance. BLUE is the isolated loop. No resident data access.\n\nUse the real service terms with Vale. A technician can explain why the job is urgent. A smooth talker can explain why the delay belongs in his report. Both need a story that survives a second question.',[back(),leave('C7. Blue line. No full outage.')]);
 default:return jaxDialogue('root');}}
function valeDialogue(n){switch(n){
 case'root':return node(social.suspicion.vale>=2?'You have already given me a story that did not survive a check. Bring evidence, pay a visitor bond, or go back. Another bluff will not help.':'Stop there. Weapon stays down. Delivery, inspection, or a man who thinks a gun is an argument?\n\nTell me why I should be the person who lets you in.',[
  C('honest','I need to discuss a memory transfer with Rhee.','visit',{hint:'HONEST / Ask for a logged visit.'}),
  C('service','C7 maintenance. Blue loop. The clinic feed stays live.','service',{need:()=>has('workOrder'),reason:'Learn the service terms from Iona or Jax.',hint:'EVIDENCE / Use the actual work order.'}),
  C('rights','Those records have owners. I have the consent terms.','rights',{need:()=>has('residentLedger'),reason:'Get Iona’s redacted ownership ledger.'}),
  C('read','You need an entry that survives the morning review.','review',{skill:req('cool',5),effect:()=>rapport('vale','read')}),
  C('bluff','City audit. Full access. You know how this works.','badge',{need:()=>social.suspicion.vale<2,reason:'Vale will not accept another unsupported authority claim.',hint:'BLUFF / No city credentials. Expect a check.'}),
  C('threat','You know I can move that gate with you behind it.','threat',{skill:req('body',6),hint:'PRESSURE / Threats are logged. Internal access is not included.'}),leave('I will come back with a better reason.')]);
 case'visit':return node('A real answer. It is not a pass. A logged visit takes a hundred-credit bond and your handle in the record. You get it back only after a signed transfer.\n\nOr show me a reason to waive it. And understand this: I can clear the market. I cannot clear the archive.',[
  C('bond','Log my handle. I will post the bond.','cleared',{cost:100,commit:true,hint:'DEAL / Market access. €$100 held until an approved exit.',effect:()=>{social.bond=100;social.flags.handleLogged=true;grantMarket('Logged visitor bond');rapport('vale','honest');}}),
  C('ledger','Use these anonymous license records as the reason.','rights',{need:()=>has('residentLedger'),reason:'You do not have the redacted ownership ledger.'}),
  C('liability','Log the request, not a charge. Let Rhee judge the transfer.','review',{skill:req('cool',6),effect:()=>rapport('vale','limits')}),back()]);
 case'rights':return node('The people might own the memories. That does not mean you own a right to enter.\n\nStill, a consent dispute belongs with the duty officer, not a street gate. I can admit a complainant without putting the source on the report.',[
  C('redacted','Log a consent dispute. Keep the source out.','cleared',{commit:true,hint:'DEAL / Market access. No payment. No source named.',effect:()=>{grantMarket('Redacted consent complaint');rapport('vale','source',2);}}),
  C('victims','Then help me get more than a polite rejection.','review',{skill:req('cool',5)}),back()]);
 case'review':return node(has('payroll')?'You know the audit is holding our wages too. Good. Then do not pretend you are the only one with something at risk.\n\nI will log a civilian transfer inquiry. Rhee decides the rest. No city badge. No invented authority.':'I need a report, not a performance. A civilian transfer inquiry is within my discretion. A city audit is not.\n\nI can log your handle and let Rhee decide. It costs me trust with him, so do not spend it on another story.',[
  C('inquiry','A civilian inquiry. That is the truth.','cleared',{commit:true,hint:'DEAL / Market access. Your handle is on the record.',effect:()=>{social.flags.handleLogged=true;grantMarket('Civilian transfer inquiry');rapport('vale','report',2);}}),back()]);
 case'service':return node('Which feed are you isolating, and why is this job not waiting until daylight?\n\nDo not read the code back at me. Tell me what it does.',[
  C('technical','C7 closes the coolant loop. It does not cut clinic power.','cleared',{skill:req('technical',5),commit:true,hint:'TECHNICAL / Correct service explanation. Market access.',effect:()=>{grantMarket('Verified maintenance relief');rapport('vale','service',2);}}),
  C('urgency','Delay the coolant job, and you sign for the patient risk.','cleared',{skill:req('cool',6),need:()=>has('clinicNeed'),reason:'Ask Iona about the clinic risk first.',commit:true,hint:'PERSUADE / Use a known risk, not a fabricated threat.',effect:()=>grantMarket('Urgent clinic maintenance')}),
  C('honestLimit','I am the courier, not the technician. Check with Rhee.','visit',{effect:()=>rapport('vale','admission')}),
  C('wrong','Red feed. Full shutdown. Standard procedure.','caught',{hint:'BLUFF / Contradicts the work order.',effect:()=>suspicion('vale')}),back()]);
 case'badge':return node('Then you have a city warrant number and a named audit lead.\n\nI do not need to like a warrant. I do need to see one.',[
  C('confess','I do not have a warrant. I need a logged visit.','visit',{effect:()=>{suspicion('vale');rapport('vale','correction');},result:'BLUFF WITHDRAWN / DOUBT +1'}),
  C('pressure','Call your supervisor and tell them you delayed me.','caught',{hint:'BLUFF / He can make that call.',effect:()=>suspicion('vale',2)}),
  C('pivot','No warrant. An ownership dispute. Here are the terms.','rights',{need:()=>has('residentLedger'),reason:'You need the redacted ownership ledger.',effect:()=>suspicion('vale')}),back()]);
 case'caught':return node('That is not correct. If you want trust, stop charging me for the effort of checking your claims.\n\nYou can still ask for a real visit. You cannot use that story again.',[C('correct','Let us use the real visitor process.','visit'),back(),leave()]);
 case'threat':return node('You can move the gate. Then a guard with a family has to decide whether to shoot you.\n\nI will not make that decision for him. If I clear the market, your threat goes on the record. Rhee will see it.',[
  C('pressurePass','Put it in the record. Open the market.','cleared',{commit:true,hint:'PARTIAL DEAL / Market pass. Rhee starts with more doubt.',effect:()=>{suspicion('rhee');social.flags.threatenedVale=true;grantMarket('Entry under pressure');}}),
  C('withdraw','Keep the threat out. I will use the visitor process.','visit',{effect:()=>rapport('vale','withdraw')}),back()]);
 case'cleared':return node('The market is clear for you. Rhee is by Relay 06, at the far end.\n\nKeep your weapon down. The pass is an agreement, not armor. It does not protect you after an attack.',[C('limits','And the archive?','limits'),leave('I will speak to Rhee.')]);
 case'limits':return node('Rhee can approve the visit. Sable must approve removal. Get both, and you might come back through here without making me choose between you and my job.',[leave(),back()]);
 default:return valeDialogue('root');}}
function rheeDialogue(n){switch(n){
 case'root':return node(social.flags.threatenedVale?'Vale logged your threat. So let us begin with what force cannot give you: a valid transfer.\n\nThe gate is not the same as the right to take what is behind it.':'Vale sent a visitor, not a search warrant. The archive contains disputed property and a great deal of liability.\n\nTell me which of those you plan to take off my hands.',[
  C('terms','What would make a transfer valid?','terms',{effect:()=>learn('policy')}),
  C('consent','The treatment license never sold the memories.','consent',{need:()=>has('residentLedger'),reason:'Get Iona’s redacted ownership ledger.'}),
  C('payroll','Your people carry risk while Vanta holds their wages.','staff',{need:()=>has('payroll'),reason:'Ask Jax about the audit and the wages.'}),
  C('liability','You can record a dispute without deciding who wins.','liability',{skill:req('intelligence',5),effect:()=>{learn('policy');rapport('rhee','limits');}}),
  C('pay','You have a shift to cover. I have €$180.','paid',{cost:180,commit:true,hint:'PAYMENT / Supervised archive visit. Core release is not included.',effect:()=>{grantRelay('Paid supervised inspection');social.flags.paidRhee=true;}}),
  C('force','The gate opens. I decide what happens after that.','pressure',{skill:req('body',6),hint:'PRESSURE / Relay only. The archive will remain hostile.'}),leave()]);
 case'terms':return node('A custodian signature. A destination. A record that survives an audit.\n\nI can admit a courier for a sealed transfer under Vanta rules. Sable sets the terms. You get a quiet route. The owners do not gain a voice just because the courier is polite.',[
  C('sealedVisit','Admit me as the courier. I will hear Sable’s terms.','cleared',{commit:true,hint:'DEAL / Relay and archive visitor pass. No skill or fee required.',effect:()=>{grantRelay('Recorded transfer appointment');social.flags.corporateVisit=true;rapport('rhee','process');}}),
  C('different','I want to challenge ownership, not confirm it.','consent',{need:()=>has('residentLedger'),reason:'An ownership challenge needs the redacted ledger.'}),
  C('shared','Let us make an inspection record both sides can use.','liability',{skill:req('cool',6)}),back()]);
 case'consent':return node('Those signatures prove a limit. They do not prove this core contains the same records. Sable can match them.\n\nWho gave you this file? I can make this fast if I can name the witness. Or I can keep the source out and make the record harder to challenge.',[
  C('anonymous','The source stays out. Match the record hashes.','source',{effect:()=>rapport('rhee','privacy',2)}),
  C('expose','Iona at the clinic. She gave me the file.','exposed',{commit:true,hint:'BREACH OF TRUST / Easier access. Exposes Iona to security.',effect:()=>{social.witnessExposed=true;social.trust.iona=0;socialEvent('witness-exposed','SOURCE EXPOSED / IONA NAMED IN SECURITY RECORD');grantRelay('Named-witness complaint');}}),
  C('hash','A matching hash is evidence. A name is leverage.','source',{skill:req('intelligence',6),effect:()=>{rapport('rhee','hash',2);learn('policy');}}),back()]);
 case'source':return node('Good distinction. I will sign an inspection of the contested records, not a finding of theft.\n\nYou do not get to sell my signature as proof that every claim was true. Will you carry that limit?',[
  C('limit','Inspection only. Sable decides the release.','cleared',{commit:true,hint:'DEAL / Relay and archive visitor access. No witness exposed.',effect:()=>{grantRelay('Redacted ownership inspection');learn('policy');rapport('rhee','bounded',2);}}),back()]);
 case'staff':return node('They do not get their overtime. I do not get my signature back if this is mishandled.\n\nA transfer record could close the audit. A sealed sale could close it without letting anyone see what happened. What exactly are you offering my people?',[
  C('staffCopy','A copy of the audit. Staff can use it to claim the wages.','staff-deal',{commit:true,hint:'PROMISE / Share the audit. Gain visitor access.',effect:()=>{promise('staff','Give staff a copy of the audit record.');grantRelay('Worker-backed audit');rapport('rhee','staff',2);}}),
  C('noGuarantee','A visit. I cannot promise the result before I see it.','terms',{effect:()=>rapport('rhee','honest')}),
  C('threatWages','Help me, or I publish the pay sheets with your name.','blackmail',{hint:'PRESSURE / A wage claim can become a threat.'}),back()]);
 case'liability':return node('An inspection without a verdict. That I can defend.\n\nYou keep a custody record. I keep a copy. Sable checks the ownership claim. If you steal the core before she signs, this permit means nothing.',[
  C('record','We keep the record. We do not hide the dispute.','cleared',{commit:true,hint:'DEAL / Relay and archive visitor access. Shared audit promised.',effect:()=>{promise('staff','Give staff a copy of the audit record.');grantRelay('Joint custody inspection');rapport('rhee','joint',2);}}),back()]);
 case'blackmail':return node('Publish them. They show the same unpaid wages I have been trying to release.\n\nYou found a grievance and mistook it for guilt. Come back to me with a use for that file which helps someone.',[
  C('repair','Then let the staff use the audit. Not me against you.','staff',{effect:()=>suspicion('rhee')}),back()]);
 case'pressure':return node('I can move my people away from this gate. I cannot order Sable to hand you the core. The archive will treat you as an intruder.\n\nThat is the exact limit of what your threat can buy.',[
  C('takePartial','That is enough. Clear the relay.','partial',{commit:true,hint:'PARTIAL ROUTE / Relay safe. Archive guards and camera remain active.',effect:()=>{grantRelay('Security withdrawal',false);social.flags.pressuredRhee=true;}}),
  C('proper','Then tell me about a proper transfer.','terms'),back()]);
 case'partial':return node('The relay is clear. That is all. You can still ask me to arrange a proper archive visit before you go further.',[C('upgrade','I want the archive visit as well.','terms'),leave('I will handle the archive.')]);
 case'staff-deal':return node('The visit is approved. My staff need a record they can inspect, not a promise that the new owner is better.\n\nSable has the release authority. If you accept a sealed corporate transfer, you will not be able to keep the audit promise.',[leave('I will discuss the release with Sable.')]);
 case'paid':return node('Inspection duty. That is how the fee appears.\n\nYou can reach Sable. You have not bought her signature. Remember that before you ask for a refund.',[leave('I understand the limit.')]);
 case'exposed':return node('I have the witness name. The visit is approved.\n\nInternal review will speak to Iona. You cannot remove a source from the system just because the door is now open.',[leave('I will see Sable.')]);
 case'cleared':return node(social.permits.archive?'Relay and archive visitor access are active. Keep your weapon holstered. The camera will recognize your pass.\n\nSable is at the front of the Cold Archive. Ask before you touch the coolant lock or the core.':'The relay is clear. The archive is not. You can still arrange a supervised visit.',[
  ...(social.permits.archive?[]:[C('visit','Arrange the archive visit.','terms')]),
  C('sourceStatus','What will your report say about the source?','report'),leave('I will take the rear passage.')]);
 case'report':return node(social.witnessExposed?'Iona’s name is in the case. Her clinic will receive a review notice. That is what naming a witness does.':'The report names a disputed consent limit and an anonymous record hash. It does not name Iona or her patients.\n\nKeep it that way when you speak to Sable.',[leave(),back()]);
 default:return rheeDialogue('root');}}
function sableDialogue(n){switch(n){
 case'root':return node('Rhee cleared a visitor. He did not clear an owner.\n\nBefore I release the lock, tell me what the person on the other end of your car door gets to do with these memories.',[
  C('ownership','First, tell me why you have kept them.','why'),
  C('proof','The clinic license and this archive do not agree.','proof',{need:()=>has('residentLedger'),reason:'You need Iona’s redacted ownership ledger.'}),
  C('sealed','I can carry a sealed transfer under your terms.','sealed'),
  C('threeKeys','No single buyer. Three independent key holders.','community',{need:()=>has('splitKey'),reason:'Discuss shared keys with Mara or Iona.'}),
  C('anonymous','Remove the identity index before release.','blind'),
  C('body','Give me the core. You and your guards walk away.','threat',{skill:req('body',6),hint:'PRESSURE / Archive stands down. No safe exit is promised.'}),leave('I need to inspect the record first.')]);
 case'why':return node('Because one of those records is my sister’s last clear memory of our mother. Vanta calls it test data. A thief calls it leverage. A reformer might erase it to make a point.\n\nTell me which of those people you are not.',[
  C('noErasure','No one should lose a memory to prove that I helped.','care',{effect:()=>rapport('sable','care',2)}),
  C('conflict','Your private stake also makes you a conflicted custodian.','conflict',{skill:req('intelligence',5),effect:()=>rapport('sable','truth')}),
  C('blackmail','Your sister. That is a fact security could use.','blackmail',{hint:'THREAT / Names can hurt people even when no shot is fired.'}),back()]);
 case'care':return node('Then preserve the memories and change who can authorize access. That is harder than taking a box.\n\nWho stops the next owner from being just as certain that they know what is best?',[
  C('keys','Use three keys. Clinic, workers, and a resident trustee.','community',{effect:()=>learn('splitKey')}),
  C('smallStep','I can promise a sealed transfer, not a new system.','sealed'),back()]);
 case'conflict':return node('Yes. Which is why I should not be the sole person deciding what survives.\n\nA conflict of interest is a reason to share control. It is not a reason to pretend I have no useful evidence.',[
  C('distributed','Split the authority. Do not replace one owner with another.','community',{effect:()=>{learn('splitKey');rapport('sable','shared');}}),back()]);
 case'blackmail':return node('It could. But now I know the shape of the next owner.\n\nYou can still walk back from that. Do not ask me to call it kindness.',[
  C('withdraw','Her name stays here. I was wrong to use it.','care',{effect:()=>{suspicion('sable');rapport('sable','repair');}}),
  C('double','Then make the transfer before I make the call.','threat',{skill:req('cool',6),hint:'PRESSURE / This will not produce a safe exit.'}),back()]);
 case'proof':return node(has('archiveLog')?'Incident 441 matches your ledger. The people licensed treatment. Vanta recorded ownership. The gap is real.\n\nProof tells us what went wrong. It does not settle who gets the next key.':'The license may be real. Match its anonymous hashes to Incident 441. There is a local archive log on the right desk at the back. Your visitor pass covers that inspection.\n\nOr show me a way to verify the match without taking a copy of the names.',[
  C('readHashes','Compare the consent hash with the stored license version.','verified',{skill:req('intelligence',6),hint:'VERIFY / Read metadata, not resident identities.',effect:()=>{learn('archiveLog');rapport('sable','verify',2);},result:'OWNER MATCH VERIFIED / NO NAMES COPIED'}),
  C('showLog','Here is the archive log. Compare the signed dates.','verified',{need:()=>has('archiveLog'),reason:'Take the archive log from the right desk at the back.',effect:()=>rapport('sable','physical',2)}),
  C('fetch','I will get the local log.',null,{hint:'LEAVE / The visitor pass keeps guards and camera neutral.'}),back()]);
 case'verified':return node('The match holds. This is not Vanta’s property to sell.\n\nBut a public dump would expose every person in it. Erasing the index would protect identities and also prevent many people from reclaiming their own records. Neither is a simple rescue.',[
  C('trust','Three keys. Owners choose access, one claim at a time.','community',{effect:()=>learn('splitKey')}),C('unlink','Explain the cost of erasing the index.','blind'),back()]);
 case'community':return node('A clinic key. A worker key. A resident key, held here until a trustee is chosen. No party can sell or release the archive alone.\n\nI need a verified ownership claim and a source you did not hand to security. Mara takes the core as a bonded carrier, not an owner. Her fee falls to four-fifty.',[
  C('safeguard','How do we stop three powerful people replacing one?','safeguard'),
  C('consent','Every resident can refuse access. Record that limit.','community-sign',{need:()=>has('residentLedger')&&has('archiveLog')&&!social.witnessExposed&&social.trust.sable>=2,reason:social.witnessExposed?'The source was exposed. Iona will not hold a key for this deal.':social.trust.sable<2?'Build Sable’s trust: discuss her concern or verify the records with her.':'You need the clinic ledger and the matching archive log.',hint:'EVIDENCE / Set resident consent as a condition.',effect:()=>rapport('sable','consent',2)}),
  C('missing','Let me collect the missing proof.','proof',{need:()=>has('residentLedger'),reason:'Speak to Iona on Mercy Street for the redacted ledger.'}),back()]);
 case'safeguard':return node('Give residents a right to refuse, and a way to replace their trustee. Keep the access log available to the workers. No clinic can demand a memory in exchange for medicine.\n\nIt will be slow, and not every claim will be easy. Those are problems to solve. A sale would just make them someone else’s problems.',[
  C('bind','Put those limits in the charter.','community-sign',{need:()=>has('residentLedger')&&has('archiveLog')&&!social.witnessExposed&&social.trust.sable>=2,reason:social.witnessExposed?'The exposed witness will not join the trust.':social.trust.sable<2?'Build Sable’s trust: hear her concern or verify the records with her.':'Match the clinic ledger to the archive log first.',effect:()=>rapport('sable','charter',2)}),back()]);
 case'community-sign':return node('Then the terms are these: resident consent, three keys, a replaceable trustee, and an audit copy for staff. The clinic source stays out of the security report.\n\nThe core stays intact. Your fee is €$450. I sign a release, not a sale. Do you accept the limits as well as the route?',[
  C('signCommunity','I accept. Record the limits. Sign the release.','agreed',{commit:true,need:()=>has('residentLedger')&&has('archiveLog')&&!social.witnessExposed,reason:'This deal requires protected sources and verified ownership proof.',hint:'COMMIT / €$450. Safe exit. Resident control. Audit shared.',effect:()=>{promise('staff','Give staff a copy of the audit record.');signDeal('community');rapport('sable','agreement',2);},result:'COMMUNITY RELEASE SIGNED / ALL FOUR AREAS CLEARED'}),
  C('rethink','Not yet. I need to consider the other terms.','root')]);
 case'sealed':return node('A sealed corporate transfer. You carry the core. Vanta keeps the identity index and final say over access. No independent audit copy leaves with you.\n\nYou receive €$1,000 and a signed exit. No fight is required. The residents still have to ask the company for their own memories.',[
  C('impact','What happens to the promises I already made?','sealed-cost'),
  C('acceptSealed','I accept the sealed transfer. No independent copy.','agreed',{commit:true,hint:'COMMIT / €$1,000. Safe exit. Vanta keeps control. Staff-copy promise fails.',effect:()=>signDeal('sealed'),result:'SEALED TRANSFER SIGNED / SAFE EXIT AUTHORIZED'}),back()]);
 case'sealed-cost':return node(social.promises.staff?'You promised staff a copy of the audit. This deal prevents it. You will break that promise.\n\nSource protection can remain intact, but the workers cannot inspect the terms that held their wages. A quiet route does not remove that cost.':'The source can stay private. The memories stay intact. But access still depends on the company.\n\nThis is a transport job with clean paperwork. It is not a transfer of power to the people in the records.',[C('returnTerms','Show me the sealed terms again.','sealed'),back()]);
 case'blind':return node('Erase the link between identities and memory files. Copies survive, but Vanta cannot reliably find a person through the index.\n\nNeither can the people who want their records back. My sister may lose her route to our mother’s memory. The act cannot be undone from this core.',[
  C('method','Destroy only the identity index. Verify the erase boundary.','blind-sign',{skill:req('technical',6),hint:'TECHNICAL / Protect the memory files from the erase.'}),
  C('custodian','Can you make the erase without damaging the memories?','blind-help',{skill:req('cool',6),hint:'PERSUADE / Ask Sable to do the work, not to call it harmless.'}),
  C('reject','Protection should not mean taking away the owner’s key.','care',{effect:()=>rapport('sable','rejectErasure')}),back()]);
 case'blind-help':return node('I can. I will not call it a cure. It removes a tool of surveillance by also removing a tool of recovery.\n\nThe buyer pays €$650 for an anonymous archive. I can sign that transfer. The owners do not regain reliable access.',[C('choose','Show me the final erase terms.','blind-sign'),back()]);
 case'blind-sign':return node('The identity index will be erased. Memory data will stay intact. The buyer receives anonymous records, not resident control. The fee is €$650.\n\nIf you promised an audit copy to staff, I can release a redacted one. A promise to protect people is not the same as a promise to restore their choices.',[
  C('signBlind','Erase the index. Keep the memories. Sign the transfer.','agreed',{commit:true,hint:'IRREVERSIBLE / €$650. Safe exit. Owners lose reliable record lookup.',effect:()=>signDeal('blind'),result:'INDEX ERASE AUTHORIZED / ANONYMOUS TRANSFER SIGNED'}),back()]);
 case'threat':return node('I can stand my people down and open the core lock. I cannot sign ownership over under a threat.\n\nTake it this way and the market will receive a theft alert. This gets you through the room, not out of the district.',[
  C('partial','Open the lock. I will take the risk outside.','agreed',{commit:true,hint:'PARTIAL ROUTE / Core released. Reinforcements on removal.',effect:()=>signDeal('threat'),result:'ARCHIVE STANDS DOWN / EXIT NOT AUTHORIZED'}),
  C('backOff','Then let us find terms you can sign.','root',{effect:()=>rapport('sable','backoff')})]);
 case'agreed':return node(social.flags.brokenDeal?'You broke the agreement. I cannot make an exit pass erase that. Renegotiate a truce or take the route you have left.':social.deal==='community'?'The release is signed. Take the core from the center stand. The guards and camera will honor the pass all the way back to Mercy Street.\n\nYou leave with a duty to people, not a title to them.':social.deal==='sealed'?'The sealed transfer is signed. Take the core and return to Mara. No one will stop you while the terms hold.\n\nThe box moves. The ownership rules do not.':social.deal==='blind'?'The index erase is authorized. The anonymous transfer is signed. Take the core and return to Mara.\n\nNo names on the box. Fewer ways home for the people inside.':'My people will stand down. The core is unlocked. The theft alert will go out when you take it.\n\nYou chose a door, not an agreement.',[leave('I will take the core.')]);
 default:return sableDialogue('root');}}
CONTACTS.panel={id:'panel',name:'GATE SERVICE LINK',full:'SERVICE ACCESS',role:'CHECKPOINT / LOCAL PANEL',x:4.55,z:25.45,topic:'MANUAL ACCESS',read:'Opening a gate does not create a visitor permit. Talk to Vale for a social route.'};
function panelDialogue(n){if(n==='opened')return node(social.permits.market?'A maintenance identity is accepted. The street gate is open. Market access is logged.':'The street gate is open. No visitor pass was created. Market guards will treat you as an intruder.',[leave('Disconnect.')]);return node('Local service mode. The gate can be opened here. A valid service claim can also create market access.\n\nA forced opening cuts shared power briefly and triggers an alarm. You can leave this panel and speak to Vale instead.',[
 C('service','Use the C7 work order and register maintenance relief.','opened',{skill:req('technical',5),need:()=>has('workOrder'),reason:'Learn the C7 service terms from Iona or Jax.',commit:true,hint:'COVERT / Market pass. No outage.',effect:()=>grantMarket('Registered maintenance relief')}),
 C('bypass','Bypass the shutter motor. Do not register a visitor.','opened',{skill:req('technical',5),commit:true,hint:'STEALTH / Gate opens. Guards remain hostile to intruders.',effect:()=>{social.entryOpen=true;social.routes.market='Motor bypass / no pass';socialEvent('entry-bypass','STREET GATE OPEN / NO SECURITY PASS',80);updateObjective();saveCheckpoint();}}),
 C('force','Force the gate open.','opened',{commit:true,hint:'LOUD / Alarm. Clinic power interrupted. Combat route remains open.',effect:()=>{social.entryOpen=true;social.flags.powerCut=true;social.hostile=true;social.violence++;stats.alarms++;social.permits={market:false,relay:false,archive:false,exit:false};socialEvent('gate-force','GATE FORCED / CLINIC POWER INTERRUPTED');alertEnemies(0,16,26);updateObjective();saveCheckpoint();Audio.explosion();}}),leave('I will speak to Vale instead.')]);}

// Connect dialogue outcomes to the existing mission, input, AI, HUD, and save system.
const baseResetWorld=resetWorld;
resetWorld=function(){social=freshSocial();dialogue=null;document.body.classList.remove('talking','profiling');for(const id of ['dialogue-screen','profile-screen','talk-history'])setVisible(id,false);setHTML('npc-labels','');baseResetWorld();const r=enemies.find(e=>e.id===3),s=enemies.find(e=>e.id===8);if(r)Object.assign(r,{name:'LIEUTENANT RHEE',x:2.4,z:-25,homeX:2.4,homeZ:-25,yaw:0});if(s)Object.assign(s,{name:'WARDEN SABLE',x:2.6,z:-59.1,homeX:2.6,homeZ:-59.1,yaw:0});};
const baseMakeSave=makeSave;
makeSave=function(checkpointMode=false){const s=baseMakeSave(checkpointMode);s.social=JSON.parse(JSON.stringify(social));return s;};
const baseValidSave=validSave;
validSave=function(s){return baseValidSave(s)&&!!s.social&&!!BACKGROUNDS[s.social.background]&&!!s.social.skills&&Object.keys(SKILL_NAMES).every(k=>Number.isFinite(s.social.skills[k])&&s.social.skills[k]>=2&&s.social.skills[k]<=8)&&typeof s.social.permits==='object'&&Array.isArray(s.social.events)&&Array.isArray(s.social.transcript);};
const baseRestoreCheckpoint=restoreCheckpoint;
restoreCheckpoint=function(s){if(!validSave(s))return false;const ok=baseRestoreCheckpoint(s);if(ok){const v=JSON.parse(JSON.stringify(s.social)),d=freshSocial();social={...d,...v,skills:{...d.skills,...v.skills},permits:{...d.permits,...v.permits},trust:{...d.trust,...v.trust},suspicion:{...d.suspicion,...v.suspicion},flags:{...v.flags},evidence:{...v.evidence},promises:{...v.promises},routes:{...v.routes}};social.streetLift=social.entryOpen?4.7:0;}return ok;};
const baseStartGame=startGame;
startGame=function(fromSave=false){const resumable=fromSave&&validSave(checkpoint||storage.get(CHECKPOINT_KEY));baseStartGame(!!resumable);socialMessage='';socialMessageTimer=0;holstered=true;if(!resumable)openProfile();else{updateObjective();if(!social.profileSet)openProfile();}updateHUD(0);};
const baseObjectiveData=objectiveData;
objectiveData=function(){if(!social.entryOpen&&!social.flags.bypassed)return !social.seen.mara?{title:'Speak to Mara on Mercy Street.',sub:'Weapon holstered. Press F near a contact.',pos:[CONTACTS.mara.x,1.4,CONTACTS.mara.z],label:'MARA'}:{title:'Get past the Mercy Street checkpoint.',sub:'Talk to Vale. Iona and Jax can help.',pos:[CONTACTS.vale.x,1.4,CONTACTS.vale.z],label:'VALE'};if(stage===1&&social.permits.market&&!social.hostile){const c=contactActor('rhee');if(c)return{title:'Discuss archive access with Rhee.',sub:'Your pass covers the market only.',pos:[c.x,1.4,c.z],label:'RHEE'};}if(stage===2&&social.permits.archive&&!social.hostile){const c=contactActor('sable');if(c)return{title:'Negotiate the core release with Sable.',sub:has('residentLedger')&&!has('archiveLog')?'Optional: get the archive log from the rear-right desk.':'Visitor access is not permission to take the core.',pos:[c.x,1.4,c.z],label:'SABLE'};}const o=baseObjectiveData();if(stage===3&&social.permits.exit){o.sub='Release signed. Hold F at the center stand.';}if(stage===4){o.sub=social.permits.exit?'Signed return route. Go back to Mercy Street.':'Return through the relay, market, and Mercy Street.';}return o;};
const baseUpdateInteractions=updateInteractions;
updateInteractions=function(dt){baseUpdateInteractions(dt);if(mode!=='playing')return;if(scan)return;if(interactable?.type==='exit')return;const o=[player.x,player.y,player.z],forward=aimDir();let near=null;for(const id of Object.keys(CONTACTS)){const c=contactActor(id);if(!c)continue;const delta=[c.x-player.x,1.3-player.y,c.z-player.z],dist=Math.hypot(delta[0],delta[2]);if(dist>2.85||Math.abs(player.footY)>.5)continue;const facing=dot(norm(delta),forward);if(facing<.1||!lineOfSight(o,[c.x,1.3,c.z]))continue;if(!near||dist<near.dist)near={c,dist};}
 if(near){const c=near.c,available=canTalk(c.id);interactable={type:'talk',contact:c.id};showPrompt(c.id==='panel'?'USE GATE SERVICE PANEL':social.hostile&&['vale','rhee','sable'].includes(c.id)?'REQUEST A TRUCE':'TALK TO '+c.name,available?(c.id==='panel'?'ALTERNATIVE / TECHNICAL OR FORCED ACCESS':'CONVERSATION / NO TIME LIMIT'):'HOLSTER AND LEAVE COMBAT TO TALK',false);}
 else if(stage===3&&interactable?.type==='core'&&!social.permits.exit)setText('interact-sub',keyText('NO SIGNED RELEASE / REMOVAL TRIGGERS AN ALERT'));};
const baseInteract=interact;
interact=function(){if(mode==='playing'&&!scan&&!wheelOpen){updateInteractions(0);if(interactable?.type==='talk'){openDialogue(interactable.contact);return;}}baseInteract();if(shardRead&&!has('archiveLog')){learn('archiveLog');if(mode==='panel')renderField();}};
const baseFindScanObject=findScanObject;
findScanObject=function(){let t=baseFindScanObject();const o=[player.x,player.y,player.z],d=aimDir();for(const id of ['mara','iona','jax','vale']){const c=CONTACTS[id],v=sub([c.x,1.35,c.z],o),dist=Math.hypot(...v),along=dot(v,d),offset=Math.hypot(...sub(v,mul(d,along)));if(along>0&&dist<26&&offset<.55&&(!t||dist<t.dist)&&lineOfSight(o,[c.x,1.35,c.z]))t={kind:'contact',obj:c,pos:[c.x,1.35,c.z],dist};}return t;};
const baseRenderScannerHUD=renderScannerHUD;
renderScannerHUD=function(){baseRenderScannerHUD();if(!scan||!scanObject)return;const t=scanObject;if(t.kind==='contact'){$('scan-name').textContent=t.obj.name;$('scan-details').innerHTML=esc(t.obj.role)+'<br>LOCAL CONVERSATION / PRESS F NEARBY';$('hack-description').textContent='Release Tab and approach to talk. A scan shows context, not a person’s private thoughts.';}else if(t.kind==='enemy'&&neutralEnemy(t.obj)){$('scan-details').innerHTML=esc(t.obj.name)+'<br>VISITOR PASS RECOGNIZED<br>HARMFUL ACTIONS CANCEL ACCESS';}};
const baseDrawWorld=drawWorld;
drawWorld=function(vp,eye,reflect=false){baseDrawWorld(vp,eye,reflect);drawContacts();};
const baseDrawEnemy=drawEnemy;
drawEnemy=function(e){const c=dialogue?CONTACTS[dialogue.speaker]:null;baseDrawEnemy(mode==='dialogue'&&c?.enemyId===e.id?{...e,yaw:0}:e);};
function dialogueView(){const c=contactActor(dialogue?.speaker)||CONTACTS.mara;renderEye=[c.x+1.0,1.71,c.z+2.9];renderForward=norm(sub([c.x+1.82,1.4,c.z],renderEye));}
const baseTakeCore=takeCore;
takeCore=function(){if(stage!==3||!archiveUnlocked)return;if(social.permits.exit&&!social.hostile&&social.deal){stage=4;transfer=0;social.flags.coreReleased=true;resetInputs();holstered=true;trace=0;traceActive=false;traceAlarm=false;for(const e of enemies){if(neutralEnemy(e)){e.aggro=false;e.detect=0;}}threatLevel=0;updateObjective();notice('RELEASE SIGNED','CORE IN CUSTODY','RETURN TO MERCY STREET / DO NOT BREAK THE TERMS',4.5);commsTimer=0;commsQueue.length=0;say(social.deal==='community'?'The release is valid. I have the trust charter. Bring the core back to Mercy Street. No one owns those people now.':social.deal==='sealed'?'Your paperwork cleared. Come back to Mercy Street. The broker gets a sealed core. We get paid.':'The anonymous transfer cleared. Come back to Mercy Street. The memories survived. The way to find them changed.',8);Audio.hack();socialEvent('signed-removal','CORE COLLECTED / EXIT PERMIT ACTIVE',100);saveCheckpoint();toast('CORE SECURED / NO REINFORCEMENTS CALLED');}else{social.entryOpen=true;social.hostile=true;social.permits={market:false,relay:false,archive:false,exit:false};social.flags.theftAlert=true;socialEvent('core-theft','CORE TAKEN WITHOUT A VALID RELEASE / THEFT ALERT');baseTakeCore();}};
const baseUnlockArchive=unlockArchive;
unlockArchive=function(){const was=stage;baseUnlockArchive();if(was===2&&stage===3&&!social.deal){notice('CORE LOCK OPEN','RELEASE NOT SIGNED','TALK TO SABLE FOR A SAFE EXIT. TAKING THE CORE NOW TRIGGERS AN ALERT.',4);}};
const baseFinishHack=finishHack;
finishHack=function(forced=false){if(mode==='hacking'&&forced){social.hostile=true;social.permits={market:false,relay:false,archive:false,exit:false};social.flags.relayForced=true;socialEvent('relay-forced','RELAY FORCED / SECURITY AGREEMENTS CANCELED');}baseFinishHack(forced);};
const baseApplyHack=applyHack;
applyHack=function(q,t){if(['short','jam','heat','detonate','optics'].includes(q.hack)&&mode==='playing')markAggression('HARMFUL QUICKHACK');baseApplyHack(q,t);};
const baseBeginGrapple=beginGrapple;
beginGrapple=function(e){if(canGrab(e))markAggression('GUARD GRABBED');baseBeginGrapple(e);};
const baseAdvanceGame=advanceGame;
advanceGame=function(dt){const wasStage=stage;baseAdvanceGame(dt);if(mode!=='playing')return;if(!social.entryOpen&&player.z<23&&!social.flags.bypassed){social.flags.bypassed=true;socialEvent('checkpoint-bypassed','CHECKPOINT BYPASSED / NO VISITOR PASS');updateObjective();}if(social.entryOpen)social.streetLift=lerp(social.streetLift,4.7,Math.min(1,dt*3));if(shardRead&&!has('archiveLog'))learn('archiveLog');if(player.z>23&&!social.streetSeen&&social.profileSet){social.streetSeen=true;updateObjective();}if(wasStage!==stage)updateObjective();};
const baseUpdateUI=updateUI;
updateUI=function(dt){baseUpdateUI(dt);if(socialMessageTimer>0)socialMessageTimer=Math.max(0,socialMessageTimer-dt);const active=mode==='playing';setVisible('social-hud',active&&!scan);if(!active)setHTML('npc-labels','');if(mode==='dialogue'&&Audio.music?.gain)Audio.music.gain.value=.14;else if(Audio.music?.gain)Audio.music.gain.value=.38;};
const baseUpdateHUD=updateHUD;
updateHUD=function(dt=0){baseUpdateHUD(dt);if(player.z>23)setText('zone-name','MERCY STREET / SOUTH APPROACH');if(mode==='playing'){const zone=player.z>-28?'market':player.z>-48?'relay':'archive';setText('social-status',social.hostile?'TERMS BROKEN / ACCESS REVOKED':social.permits.exit?'SIGNED RELEASE / EXIT CLEAR':social.permits[zone]?'VISITOR PASS / '+zone.toUpperCase():'LOCAL CONTACTS / '+pk('interact')+' TO TALK');setText('social-hint',keyText(socialMessageTimer>0?socialMessage:!social.entryOpen?'I / CHARACTER   ·   J / EVIDENCE + PROMISES':social.permits[zone]?'Attacks cancel this pass. Double-tap Alt to holster.':'A visitor pass can prevent a fight.'));if(frameNumber%5===0)renderContactLabels();}};
function renderContactLabels(){if(mode!=='playing'||scan){setHTML('npc-labels','');return;}let html='';for(const id of Object.keys(CONTACTS)){if(id==='panel')continue;const c=contactActor(id);if(!c)continue;const dist=Math.hypot(c.x-player.x,c.z-player.z);if(dist>22||!lineOfSight([player.x,player.y,player.z],[c.x,1.55,c.z]))continue;const p=project([c.x,2.18,c.z]);if(!p||p.w<=0||p.x<35||p.x>innerWidth-35||p.y<75||p.y>innerHeight*.82)continue;html+=`<div class="npc-label" style="left:${p.x}px;top:${p.y}px">${esc(c.name)}<small>${dist<2.9?'['+pk('interact')+'] TALK':Math.round(dist)+' M / CONTACT'}</small></div>`;}setHTML('npc-labels',html);}
const baseRenderField=renderField;
renderField=function(){baseRenderField();if(activePanel==='character'){$('field-title').textContent='CHARACTER / '+BACKGROUNDS[social.background].name;$('field-content').innerHTML=`<h3>${BACKGROUNDS[social.background].name}</h3><p>${esc(BACKGROUNDS[social.background].blurb)}</p>${skillHTML(social.skills)}<p>Skill checks are fixed, not random. The choice shows the required level and your level. Evidence can open a route without a high skill. Skills cannot change during this mission.</p><h3>ACCESS AGREEMENTS</h3>${permitHTML()}<p>Each pass covers only the named area. A harmful action cancels all active access agreements. A signed core release prevents the return ambush.</p>`;}else if(activePanel==='journal'){const base=$('field-content').innerHTML;$('field-content').innerHTML=`<h3>MERCY STREET / PEOPLE, PROOF, AND TERMS</h3><p>${esc(objectiveData().title)} ${esc(objectiveData().sub)}</p>${permitHTML()}<h3>EVIDENCE / ${Object.keys(social.evidence).length} RECORDS</h3><div class="evidence-grid">${Object.entries(EVIDENCE).map(([id,[title,text]])=>`<article class="evidence-item"><strong>${has(id)?esc(title):'LOCKED / '+esc(title)}</strong><p>${has(id)?esc(text):id==='archiveLog'?'Inspect the rear-right desk in the Cold Archive.':id==='residentLedger'?'Speak to Iona about consent and source safety.':id==='splitKey'?'Discuss shared authority with Mara, Iona, or Sable.':id==='policy'?'Ask Rhee about a valid transfer.':id==='workOrder'?'Ask Jax about maintenance.':'Talk to the people on Mercy Street.'}</p></article>`).join('')}</div><h3 style="margin-top:24px">PROMISES</h3>${Object.entries(social.promises).map(([id,text])=>`<div class="promise-row">${esc(text)}${id==='protect'&&social.witnessExposed?' <b>/ BROKEN</b>':id==='power'&&social.flags.powerCut?' <b>/ BROKEN</b>':''}</div>`).join('')||'<p>No promises recorded.</p>'}<h3 style="margin-top:24px">DECISION RECORD</h3>${social.events.slice(-14).reverse().map(e=>`<p>${esc(e.text)}</p>`).join('')||'<p>No agreements yet.</p>'}<details><summary>Mission actions and archive log</summary>${base}</details>`;}else if(activePanel==='contact'){$('field-content').innerHTML=`<div class="contact-layout"><div class="contact-avatar">M</div><div><div class="eyebrow">MARA / DRIVER + FIXER</div><h3>MERCY STREET / SOUTH APPROACH</h3><p>Talk to Mara by the car for the full contract terms. Iona has ownership proof. Jax knows the work orders. Vale, Rhee, and Sable control separate parts of the route.</p><p>${esc(objectiveData().title)}</p><button class="primary" data-call="1">CALL MARA <span>↗</span></button><p>The signed community release pays €$450. A sealed corporate transfer pays €$1,000. Anonymous release pays €$650. Force can recover the core but does not create a safe exit.</p></div></div>`;}else if(activePanel==='map'){$('field-content').querySelector('h3').textContent='MERCY STREET → NULL MARKET → RELAY 06 → COLD ARCHIVE';}};
function permitHTML(){return '<div class="social-route">'+[['market','MARKET'],['relay','RELAY'],['archive','ARCHIVE VISIT'],['exit','CORE + EXIT']].map(([id,name])=>`<div class="${social.permits[id]&&!social.hostile?'pass':''}">${name}<br>${social.permits[id]&&!social.hostile?'AUTHORIZED':'NOT AUTHORIZED'}</div>`).join('')+'</div>';}
const baseCallGetaway=callGetaway;
callGetaway=function(){if(mode!=='playing')return;if(stage===4){baseCallGetaway();return;}if(scan)setScan(false);say(!social.entryOpen?'I am by the car on Mercy Street. Iona and Jax can help you get past Vale. Press F to talk near a contact.':social.permits.market&&stage===1?'Rhee is at the north gate. Your market pass will get you to him. Ask for a visit, not a right to take the core.':social.permits.archive&&stage===2?'Sable is in the Cold Archive. Keep your weapon down. Get a signed release if you need a quiet way back.':objectiveData().sub,7);};
const baseRoutePoints=routePoints;
routePoints=function(){const pts=baseRoutePoints();if(stage===4&&player.z<24){pts.splice(pts.length-1,0,[0,1.3,26]);}return pts;};
drawFullMap=function(){const el=$('full-map');if(!el)return;const c=el.getContext('2d'),scale=6.1,X=z=>40+(57-z)*scale,Y=x=>230+x*10.7;c.fillStyle='#0a1720';c.fillRect(0,0,900,440);c.strokeStyle='#203641';for(let x=10;x<900;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,440);c.stroke();}for(let y=12;y<440;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(900,y);c.stroke();}c.fillStyle='#203a43';c.fillRect(X(56.7),Y(-9),X(-47.5)-X(56.7),192.6);c.fillRect(X(-47.5),Y(-2.2),X(-55)-X(-47.5),47.1);c.fillRect(X(-55),Y(-9),X(-73)-X(-55),192.6);for(const co of colliders){if(!validCollider(co)||co.minY>2.8||co.maxX<-9||co.minX>9||co.minZ<-74||co.maxZ>58)continue;c.fillStyle=co.streetGate||co.gate||co.archiveDoor?'#b09868':'#45606a';c.fillRect(X(co.maxZ),Y(co.minX),(co.maxZ-co.minZ)*scale,(co.maxX-co.minX)*10.7);}for(const [txt,z]of[['MERCY STREET',53],['NULL MARKET',15],['RELAY 06',-29],['COLD ARCHIVE',-55]]){c.fillStyle='#bbd9c5';c.font='bold 11px monospace';c.fillText(txt,X(z),63);c.strokeStyle='#385363';c.beginPath();c.moveTo(X(z),75);c.lineTo(X(z),107);c.stroke();}const target=objectiveData().pos;c.strokeStyle='#dbed8d';c.setLineDash([5,4]);c.beginPath();c.moveTo(X(player.z),Y(player.x));for(const p of routePoints())c.lineTo(X(p[2]),Y(p[0]));c.stroke();c.setLineDash([]);for(const id of Object.keys(CONTACTS)){if(id==='panel')continue;const a=contactActor(id);if(!a)continue;c.fillStyle='#92dcbd';c.fillRect(X(a.z)-3.5,Y(a.x)-3.5,7,7);c.font='9px monospace';c.fillText(id.toUpperCase(),X(a.z)-10,Y(a.x)-10);}c.fillStyle='#ecf283';c.beginPath();c.arc(X(target[2]),Y(target[0]),6,0,TAU);c.strokeStyle='#f0ffb1';c.stroke();c.save();c.translate(X(player.z),Y(player.x));c.rotate(player.yaw);c.fillStyle='#a7f1e3';c.beginPath();c.moveTo(8,0);c.lineTo(-6,-5);c.lineTo(-3,0);c.lineTo(-6,5);c.closePath();c.fill();c.restore();c.font='10px monospace';c.fillStyle='#9cc5ca';c.fillText('SOUTH / GETAWAY',40,390);c.fillText('NORTH / CORE',748,390);c.fillText('SQUARE = CONTACT     RING = OBJECTIVE',280,412);};
function endingData(){const signed=social.permits.exit&&!social.hostile&&!!social.deal;const zero=social.violence===0&&stats.kills===0;const fee=signed?social.fee:800;let title='THE CORE CHANGES HANDS',text='The core reaches Mara without a valid release. The owners still face a fight over what comes next.';if(signed&&social.deal==='community'){title='NO ONE OWNS A PERSON';text='The clinic, workers, and residents share control. No party can sell the archive alone. Residents can refuse access and replace their trustee. The claims will take time, but the decision is no longer Vanta’s alone.';}if(signed&&social.deal==='sealed'){title='THE BOX MOVES. POWER DOES NOT.';text='The broker receives a sealed core. Vanta keeps the identity index and the rules for access. A quiet transfer preserved the memories, but did not return control to their owners.';}if(signed&&social.deal==='blind'){title='SAFE FROM THE INDEX. LOST TO THE OWNERS.';text='The memories survive without a usable identity index. Vanta loses a tool of surveillance. Many residents also lose a reliable way to find their own records.';}const rank=signed&&zero?social.deal==='community'?'UNBROKEN SIGNAL':social.deal==='sealed'?'SIGNED CARGO':'NAMES IN THE RAIN':signed?'HARD-WON ACCORD':social.flags.brokenDeal?'BROKEN WORD':'STREET OPERATOR';return{signed,zero,fee,title,text,rank};}
const baseWin=win;
win=function(){if(mode!=='playing')return;const e=endingData();baseWin();if(mode!=='won')return;toastTimer=0;$('toast').style.opacity=0;const refund=e.signed?social.bond:0;player.credits+=e.fee+refund;social.bond=0;social.flags.paid=true;const promises=Object.entries(social.promises).map(([id,t])=>{let kept=true;if(id==='protect')kept=!social.witnessExposed;if(id==='power')kept=!social.flags.powerCut;if(id==='staff')kept=e.signed&&['community','blind'].includes(social.deal);if(id==='sealed')kept=e.signed&&social.deal==='sealed';if(id==='community')kept=e.signed&&social.deal==='community';return `<p><b>${kept?'KEPT':'NOT KEPT'}</b> / ${esc(t)}</p>`;}).join('');$('win').querySelector('h2').innerHTML=e.zero&&e.signed?'NO SHOTS.<br>REAL CONSEQUENCES.':'GHOST IN.<br>GHOST OUT.';$('win').querySelector('.end-card>p').textContent=e.signed?'The release is signed. The terms still matter.':'The core is out. The city keeps the record.';$('rank-value').textContent=e.rank;$('rank-label').textContent=`MISSION FEE €$${e.fee} / BOND REFUND €$${refund}`;let el=$('ending-details');if(!el){el=document.createElement('section');el.id='ending-details';$('win').querySelector('.rank').after(el);}el.innerHTML=`<h3>${e.title}</h3><p>${esc(e.text)}</p><p class="ending-metrics">${social.checks} SKILL CHECKS / ${Object.keys(social.evidence).length} RECORDS / ${social.violence} HOSTILE ACTIONS<br>MARKET: ${esc(social.routes.market||'NO AGREEMENT')}<br>RELAY: ${esc(social.routes.relay||'NO AGREEMENT')}<br>ARCHIVE: ${esc(social.routes.archive||'NO AGREEMENT')}</p>${social.witnessExposed?'<p>IONA / Her name is in the security record. The clinic faces review.</p>':'<p>IONA / The clinic source was not named in the security record.</p>'}${promises||'<p>No promises were recorded.</p>'}`;storage.set('best-v4',{time:elapsed,rank:e.rank,stats,social});};
$('background-cards').addEventListener('click',e=>{const b=e.target.closest('[data-background]');if(!b)return;profilePick=b.dataset.background;profileBoost={cool:0,intelligence:0,technical:0,body:0};renderProfile();});
$('profile-skills').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const plus=b.dataset.skillPlus,minus=b.dataset.skillMinus;if(plus&&Object.values(profileBoost).reduce((a,b)=>a+b,0)<2)profileBoost[plus]++;if(minus&&profileBoost[minus]>0)profileBoost[minus]--;renderProfile();});$('profile-confirm').onclick=()=>confirmProfile();
$('dialogue-choices').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b&&!b.disabled)selectChoice(+b.dataset.choice);});$('talk-leave-btn').onclick=closeDialogue;$('talk-history-btn').onclick=toggleHistory;$('talk-history-close').onclick=toggleHistory;

// ============================================================================
// BLINDSIDE / V4. The physical route and its security systems share saved state.
// No path uses teleportation, invulnerability, or automatic dialogue permission.
// ============================================================================
function freshStealth(){return{used:false,inService:false,frontOpen:false,routeKnown:false,doorOpen:false,doorLift:0,loopBridged:false,quietCore:false,carryId:null,noise:0,exposure:.3,lureCooldown:0,noiseClock:0,detections:0,bodiesFound:0,bodiesHidden:0,lures:0,seenZones:{},lockerContents:{},lastNoise:null};}
let stealth=freshStealth(),serviceAction=null;
const stealthObjects=[
 {id:'service-plan',name:'C7 SERVICE RECORD',x:-18.7,y:1.4,z:43.48,r:2.05},
 {id:'pump-door',name:'PUMP HANDWHEEL',x:-13.6,y:1.25,z:-45.6,r:2.55},
 {id:'sensor-bridge',name:'CORE SENSOR BRIDGE',x:-11.5,y:1.3,z:-55.15,r:2.45}
];
const servicePatrols=[
 {name:'C7 / LOADING WATCH',points:[[-12.3,18.7],[-12.3,12.3],[-15.9,12.3],[-15.9,18.7]],wait:2.3},
 {name:'C7 / SWITCHWORKS TECH',points:[[-14.8,.4],[-14.8,-8.9],[-14.8,-14.7],[-14.8,-8.9]],wait:2.0},
 {name:'C7 / RELAY WATCH',points:[[-12.3,-24.0],[-12.3,-33.8],[-15.4,-33.8],[-15.4,-24.0]],wait:2.1}
];
devices.push(
 {id:'yard-camera',name:'C7 / LOADING CAMERA',type:'camera',x:-10.85,y:3.3,z:12.1,active:true,tagged:false,detect:0,yaw:-.85,baseYaw:-.85,range:14,service:true},
 {id:'relay-camera',name:'C7 / RELAY CAMERA',type:'camera',x:-10.85,y:3.3,z:-33.3,active:true,tagged:false,detect:0,yaw:-.55,baseYaw:-.55,range:12,service:true},
 {id:'pump-camera',name:'C7 / PUMP CAMERA',type:'camera',x:-10.9,y:3.3,z:-59.1,active:true,tagged:false,detect:0,yaw:-2.1,baseYaw:-2.1,range:14,service:true},
 {id:'yard-chime',name:'C7 / DELIVERY CHIME',type:'distraction',x:-11.1,y:1.8,z:14.29,active:true,tagged:false,service:true},
 {id:'works-chime',name:'C7 / TEST SPEAKER',type:'distraction',x:-11.1,y:1.8,z:-18.01,active:true,tagged:false,service:true}
);
const lightPools=[[-13.8,19,7.4],[-15,12,5.8],[-13.8,-8,6.5],[-15.8,-20,6],[-13.4,-28,5],[-14.4,-52.5,5.5],[-12.8,-56.2,4.5],[-13.5,-66.7,6]];
function inService(x=player.x,z=player.z){return x<-9.7||(x<-9.05&&z<-54.5);}
function lowClearance(x,z){for(const c of colliders){if(c.minY>.95&&c.minY<1.5&&c.maxY>1.4&&x+.28>c.minX&&x-.28<c.maxX&&z+.28>c.minZ&&z-.28<c.maxZ)return true;}return false;}
function stealthZone(){if(inService()){if(player.z>30)return 'LAUNDRY SERVICE';if(player.z>8)return player.x<-17.55?'RAIN DRAIN':'LOADING YARD';if(player.z>-20)return 'SWITCHWORKS';if(player.z>-43)return player.x<-17.55?'CABLE CRAWL':'RELAY SERVICE';if(player.z>-48)return 'PUMP ACCESS';return 'PUMP GALLERY';}return player.z>23?'MERCY STREET':player.z<-54?'COLD ARCHIVE':player.z<-28?'RELAY 06':'NULL MARKET';}
function visibilityAt(x=player.x,z=player.z){if(lowClearance(x,z))return .14;if(!inService(x,z))return z<-68?.32:z>24?.56:.70;let value=.24;for(const [lx,lz,r] of lightPools){const dist=Math.hypot(x-lx,z-lz);if(dist<r&&lineOfSight([lx,3.1,lz],[x,1.3,z]))value=Math.max(value,.26+.65*(1-dist/r));}return clamp(value,.14,.94);}
const v4ValidCollider=validCollider;
validCollider=function(c){if(c.serviceDoor)return stealth.doorLift<3.25;return v4ValidCollider(c);};
const v4NeutralEnemy=neutralEnemy;
neutralEnemy=function(e){if(e.service)return !!(social.permits.exit&&!social.hostile);return v4NeutralEnemy(e);};
const v4ResetWorld=resetWorld;
resetWorld=function(){stealth=freshStealth();serviceAction=null;v4ResetWorld();for(const p of servicePatrols){const e=spawnEnemy(...p.points[0],false);Object.assign(e,{name:p.name,service:true,route:p.points.map(v=>v.slice()),routeIndex:1,routeWait:p.wait,pauseLeft:p.wait,yaw:Math.atan2(p.points[1][0]-e.x,p.points[1][1]-e.z)});}for(const e of enemies){e.lastKnown=null;e.searchLeft=0;e.spotRecorded=false;e.radioCalled=false;e.hidden=false;e.carried=false;e.bodyFound=false;e.suspicionState='unaware';}const rear=enemies.find(e=>e.id===7);if(rear){rear.route=[[-3.7,-65.8],[-3.7,-63.2],[-.3,-63.2],[-.3,-65.8]];rear.routeIndex=1;rear.routeWait=2.7;rear.pauseLeft=2.7;rear.yaw=0;}setVisible('stealth-hud',false);setHTML('stealth-alerts','');};
const v4MakeSave=makeSave;
makeSave=function(cp=false){const s=v4MakeSave(cp);s.stealth=JSON.parse(JSON.stringify(stealth));if(lowClearance(s.player.x,s.player.z)){s.player.crouch=1;s.player.crouchToggle=true;s.player.y=1.16;}return s;};
const v4ValidSave=validSave;
validSave=function(s){return v4ValidSave(s)&&!!s.stealth&&typeof s.stealth.loopBridged==='boolean'&&Number.isFinite(s.stealth.detections);};
const v4Restore=restoreCheckpoint;
restoreCheckpoint=function(s){if(!validSave(s))return false;const ok=v4Restore(s);if(ok){stealth={...freshStealth(),...JSON.parse(JSON.stringify(s.stealth))};serviceAction=null;stealth.doorLift=stealth.doorOpen?3.8:0;gateLift=s.gateLift||0;archiveDoorLift=s.archiveDoorLift||0;if(lowClearance(player.x,player.z)){player.crouch=1;player.crouchToggle=true;player.y=1.16;}for(const e of enemies)if(!e.alive&&e.carried&&e.id!==stealth.carryId)e.carried=false;updateObjective();}return ok;};
// Hearing gives a guard a place to inspect. It does not give the player's position.
function beginSearch(e,x,z,duration=8){if(!e.alive||neutralEnemy(e)||e.aggro)return;e.investigate=[x,z];e.searchLeft=Math.max(e.searchLeft||0,duration);e.searchPhase=0;e.suspicionState='searching';e.distracted=duration;}
function noticeNoise(x,z,radius=8,kind='sound'){
 stealth.lastNoise={x,z,radius,kind,at:elapsed};
 for(const e of enemies){if(!e.alive||neutralEnemy(e)||e.aggro||e.stun>0)continue;const dist=Math.hypot(e.x-x,e.z-z),clear=lineOfSight([x,1.0,z],[e.x,1.5,e.z]);if(dist<radius*(clear?1:.27))beginSearch(e,x,z,kind==='bolt'?9:6);}
}
function confirmSight(e){if(!e.spotRecorded){e.spotRecorded=true;stealth.detections++;Audio.tone(330,.18,.07,'sawtooth',650);}e.aggro=true;e.detect=1;e.lastSeen=elapsed;e.lastKnown=[player.x,player.z];e.searchLeft=12;e.suspicionState='hostile';}
alertEnemies=function(x,z,radius=28){for(const e of enemies){if(!e.alive||neutralEnemy(e)||Math.hypot(e.x-x,e.z-z)>=radius)continue;const d=Math.hypot(e.x-player.x,e.z-player.z),front=(Math.sin(e.yaw)*(player.x-e.x)+Math.cos(e.yaw)*(player.z-e.z))/(d||1);if(d<18&&front>.3&&e.blind<=0&&lineOfSight([e.x,1.55,e.z],[player.x,player.y-.08,player.z]))confirmSight(e);else beginSearch(e,x,z,12);}};
function throwBolt(){if(mode!=='playing'||scan||wheelOpen||stealth.carryId!==null)return;if(stealth.lureCooldown>0){toast('WAIT / '+Math.ceil(stealth.lureCooldown)+' S UNTIL NEXT BOLT');return;}const o=[player.x,player.y-.08,player.z],dir=aimDir(),hit=wallRay(o,dir,13),p=add(o,mul(dir,Math.max(.5,hit.dist-.12)));p[1]=Math.max(.1,Math.min(1.2,p[1]));stealth.lureCooldown=3.2;stealth.lures++;noticeNoise(p[0],p[2],10,'bolt');Audio.tone(1600,.13,.08,'triangle',680);Audio.noise(.05,.07,2400);for(let i=0;i<7;i++)particle(p,[rr(-.6,.6),rr(.1,.9),rr(-.6,.6)],'#aad7c3',.045,.65,.8,5);weaponSwap=.18;toast('BOLT THROWN / GUARDS WILL CHECK THE SOUND');}
function bodyAction(){if(mode!=='playing'||scan||wheelOpen)return;if(stealth.carryId!==null){const e=enemies.find(e=>e.id===stealth.carryId);if(!e){stealth.carryId=null;return;}const h=hideSpots.find(h=>Math.hypot(h.x-player.x,h.z-player.z)<2.35&&lineOfSight([player.x,1.0,player.z],[h.x,1.7,h.z+.68]));if(h){const used=stealth.lockerContents[h.id]||[];if(used.length>=3){toast('LOCKER FULL / THREE BODIES');return;}used.push(e.id);stealth.lockerContents[h.id]=used;e.hidden=true;e.carried=false;e.x=h.x;e.z=h.z;stealth.carryId=null;stealth.bodiesHidden++;Audio.noise(.18,.065,650);toast(e.nonlethal?'GUARD HIDDEN / STILL ALIVE':'BODY HIDDEN');return;}e.carried=false;e.x=player.x;e.z=player.z;e.deadTime=0;stealth.carryId=null;toast('BODY PLACED / H TO CARRY');return;}
 const e=enemies.filter(e=>!e.alive&&!e.hidden&&!e.carried&&Math.hypot(e.x-player.x,e.z-player.z)<2.1&&lineOfSight([player.x,1.1,player.z],[e.x,.45,e.z])).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];if(!e){toast('NO BODY IN REACH / H TO CARRY');return;}e.carried=true;stealth.carryId=e.id;holstered=true;resetInputs();toast('BODY CARRIED / H TO PLACE OR HIDE AT A LOCKER');}
// AI: perception -> investigation -> last-known-position search -> patrol.
// Combat accuracy, guard attacks, the warden, and status effects remain active.
updateEnemies=function(dt){
 threatLevel=0;stealth.exposure=visibilityAt();
 for(const e of enemies){
  if(!e.alive||e===grappleTarget)continue;
  if(neutralEnemy(e)){neutralTick(e,dt);e.searchLeft=0;e.suspicionState='authorized';continue;}
  e.hit=Math.max(0,e.hit-dt);e.flash=Math.max(0,e.flash-dt);e.blind=Math.max(0,e.blind-dt);e.jam=Math.max(0,e.jam-dt);e.distracted=Math.max(0,e.distracted-dt);e.patrol+=dt*.65;
  if(e.burn>0){e.burn=Math.max(0,e.burn-dt);damageEnemy(e,14*dt);if(rand()<dt*12)particle([e.x,1.2,e.z],[0,1,0],'#ff9c69',.13,.5,1);if(!e.alive)continue;}
  if(e.stun>0){e.stun=Math.max(0,e.stun-dt);if(e.aggro)threatLevel++;continue;}
  const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz),front=(Math.sin(e.yaw)*dx+Math.cos(e.yaw)*dz)/(dist||1);
  const los=dist<27&&lineOfSight([e.x,1.55,e.z],[player.x,player.y-.08,player.z]);
  const range=(player.crouch>.5?9.2:17.5)*(.52+stealth.exposure*.70);
  const sees=e.blind<=0&&los&&((front>.48&&dist<range)||dist<.88);
  const visible=e.blind<=0&&los&&(front>.12||dist<2.2);
  if(!e.aggro){
   const cool=1-Math.max(0,social.skills.cool-3)*.035;
   const gain=(player.crouch>.5?.58:.96)*(.45+stealth.exposure*.7)*(dist<3?2.4:dist<5?1.65:1)*cool*diff().detect;
   e.detect=clamp((e.detect||0)+dt*(sees?gain:-.46),0,1);
   if(sees&&e.detect>.28){e.investigate=[player.x,player.z];e.searchLeft=Math.max(e.searchLeft||0,5);e.suspicionState='suspicious';}
   if(e.detect>=1)confirmSight(e);
  }else{
   if(!e.lastKnown)e.lastKnown=[player.x,player.z];
   if(visible){if(!e.spotRecorded)confirmSight(e);e.lastSeen=elapsed;e.lastKnown=[player.x,player.z];}
   // A blind or blocked guard searches a stored position, never the hidden player.
   if(!visible&&elapsed-e.lastSeen>2.1){const p=e.lastKnown;e.aggro=false;e.detect=.25;beginSearch(e,p[0],p[1],12);}
  }
  if(e.aggro){
   threatLevel++;e.suspicionState='hostile';
   const target=visible?[player.x,player.z]:e.lastKnown;
   const ax=target[0]-e.x,az=target[1]-e.z,dd=Math.hypot(ax,az);e.yaw=Math.atan2(ax,az);
   let mx=0,mz=0;if(dd>8||!visible){mx=ax/(dd||1)*2.35*dt;mz=az/(dd||1)*2.35*dt;}else if(dist>3.2){const strafe=Math.sin(e.patrol+e.phase);mx=dz/(dist||1)*strafe*dt;mz=-dx/(dist||1)*strafe*dt;}
   const ox=e.x,oz=e.z;moveEntity(e,mx,mz,.31,1.7);e.walk=Math.hypot(e.x-ox,e.z-oz)>.001?e.walk+dt*7:e.walk*.95;e.attack-=dt;
   if(e.attack<=0&&visible&&dist<2.25&&player.footY<1){e.attack=1.2;hurtPlayer(19,[e.x,1.2,e.z],e);e.flash=.1;Audio.noise(.13,.12,900);}
   else if(e.attack<=0&&visible&&e.jam<=0&&dist<23){e.attack=rr(.95,1.6)*diff().fire;e.flash=.11;const origin=[e.x,1.25,e.z],accuracy=clamp(.78-dist*.016-(player.speed>6?.24:0)-(player.crouch>.5?.15:0),.14,.76),hit=rand()<accuracy,end=hit?[player.x,player.y-.2,player.z]:[player.x+rr(-1.1,1.1),player.y+rr(-.7,.7),player.z+rr(-1,1)],dd=norm(sub(end,origin)),ray=wallRay(origin,dd,Math.hypot(...sub(end,origin)));tracer(origin,add(origin,mul(dd,ray.dist)),'#ed8c76',.10);Audio.enemy(clamp(Math.sin(e.yaw-player.yaw),-.9,.9));if(hit&&ray.dist>dist-.7)hurtPlayer(rr(9,14),origin);}
   if(e.warden&&visible&&e.jam<=0){e.netTimer-=dt;if(e.netTimer<=0){e.netTimer=9;if(!traceAlarm){traceActive=true;trace=Math.min(100,trace+14);toast('WARDEN IS TRACING YOUR LINK');}}}
   continue;
  }
  // A body is evidence, not a beacon that reveals the player.
  e.bodyCheck=(e.bodyCheck||0)-dt;
  if(e.bodyCheck<=0&&e.blind<=0){e.bodyCheck=.4;for(const b of enemies){if(b.alive||b.hidden||b.carried||b.bodyFound)continue;const bx=b.x-e.x,bz=b.z-e.z,bd=Math.hypot(bx,bz);if(bd<9&&(Math.sin(e.yaw)*bx+Math.cos(e.yaw)*bz)/(bd||1)>.40&&lineOfSight([e.x,1.55,e.z],[b.x,.45,b.z])){b.bodyFound=true;stealth.bodiesFound++;stats.alarms++;beginSearch(e,b.x,b.z,14);noticeNoise(b.x,b.z,12,'body');notice('BODY FOUND','LOCAL SEARCH','THEY KNOW SOMETHING HAPPENED. THEY DO NOT KNOW WHERE YOU ARE.',3.4);break;}}}
  let tx,tz,moveSpeed=.7;
  if((e.searchLeft||0)>0&&e.investigate){
   e.searchLeft=Math.max(0,e.searchLeft-dt);[tx,tz]=e.investigate;moveSpeed=1.12;const d=Math.hypot(tx-e.x,tz-e.z);
   if(d<.65){e.searchPhase=(e.searchPhase||0)+dt;e.yaw+=Math.sin(e.searchPhase*1.6)*dt*.85;tx=e.x;tz=e.z;}
   if(e.searchLeft===0){e.investigate=null;e.distracted=0;e.suspicionState='unaware';e.detect=Math.min(e.detect,.15);}
   else e.suspicionState=e.detect>.28?'suspicious':'searching';
  }else if(e.route){
   e.suspicionState=e.detect>.2?'suspicious':'unaware';
   const p=e.route[e.routeIndex||0];[tx,tz]=p;
   if(Math.hypot(tx-e.x,tz-e.z)<.32){e.pauseLeft=(e.pauseLeft??e.routeWait)-dt;if(e.pauseLeft<=0){e.routeIndex=((e.routeIndex||0)+1)%e.route.length;e.pauseLeft=e.routeWait||2;[tx,tz]=e.route[e.routeIndex];}}
  }else{tx=e.homeX+Math.sin(e.patrol+e.phase)*1.1;tz=e.homeZ+Math.cos(e.patrol*.7+e.phase)*1.45;e.suspicionState=e.detect>.2?'suspicious':'unaware';}
  if(sees&&e.detect>.3){e.yaw=Math.atan2(dx,dz);continue;}
  const ax=tx-e.x,az=tz-e.z,d=Math.hypot(ax,az);if(d>.32&&e.blind<=0){e.yaw=Math.atan2(ax,az);const moved=moveEntity(e,ax/d*moveSpeed*dt,az/d*moveSpeed*dt,.31,1.7);if(moved)e.walk+=dt*4;}
 }
};
updateDevices=function(dt){for(const d of devices){d.cooldown=Math.max(0,(d.cooldown||0)-dt);if(d.type!=='camera')continue;const authorized=d.service?social.permits.exit&&!social.hostile:social.permits.archive&&!social.hostile;
 if(!d.active||authorized){d.detect=0;continue;}d.yaw=(d.baseYaw??-2.0)+Math.sin(time*.37+d.z*.2)*.54;
 const dx=player.x-d.x,dz=player.z-d.z,dist=Math.hypot(dx,dz),front=(Math.sin(d.yaw)*dx+Math.cos(d.yaw)*dz)/(dist||1);
 const visible=dist<(d.range||15)&&front>.58&&(!d.service?player.z<-52:true)&&lineOfSight([d.x+Math.sin(d.yaw)*.42,d.y-.08,d.z+Math.cos(d.yaw)*.42],[player.x,player.y-.10,player.z]);
 d.detect=clamp(d.detect+dt*(visible?(player.crouch>.5?.49:.76)*diff().detect:-.48),0,1);
 if(d.detect>=1&&!d.alerted){d.alerted=true;stats.alarms++;stealth.detections++;alertEnemies(player.x,player.z,22);traceActive=true;trace=Math.max(trace,18);notice('CAMERA DETECTION','LOCAL SECURITY ALERT','BREAK SIGHT. THE CAMERA REPORTED YOUR LAST POSITION.',3);}
 if(d.alerted&&!visible&&d.detect<=0)d.alerted=false;
}};
// Existing distraction hacks now use the same finite search as a thrown bolt.
const v4ApplyHack=applyHack;
applyHack=function(q,t){v4ApplyHack(q,t);if(q.hack==='distract'){for(const e of enemies)if(e.alive&&!e.aggro&&e.distracted>0&&Math.hypot(e.x-t.obj.x,e.z-t.obj.z)<22)beginSearch(e,t.obj.x,t.obj.z,9);}if(q.hack==='optics'){t.obj.detect=0;}};
function nearStealthObject(o){return Math.hypot(player.x-o.x,player.z-o.z)<o.r&&player.footY<.3&&lineOfSight([player.x,player.y,player.z],[o.x,o.y,o.z]);}
function actionDuration(id){return id==='pump-door'?(social.skills.technical>=5?2.2:5):id==='sensor-bridge'?(social.skills.intelligence>=5?3.0:6.0):0;}
function stealthAction(id){
 if(id==='service-plan'){stealth.routeKnown=true;stealth.used=true;learn('servicePlan');socialEvent('quiet-plan','C7 ROUTE / DRAIN, CABLE CRAWL, PUMP BRIDGE, ARCHIVE REAR',60);Audio.click();updateObjective();openField('journal');return;}
 if(id==='pump-door'){stealth.doorOpen=true;stealth.used=true;if(stage===1)stage=2;socialEvent('service-pump','PUMP ACCESS OPEN / PUBLIC GATES LEFT UNCHANGED',80);notice('SERVICE ACCESS','PUMP GALLERY','SENSOR BRIDGE AHEAD / KEEP THE CLINIC FEED LIVE',3.4);Audio.noise(.32,.11,750);saveCheckpoint();updateObjective();return;}
 if(id==='sensor-bridge'){stealth.loopBridged=true;stealth.used=true;archiveUnlocked=true;if(stage<3)stage=3;const cam=devices.find(d=>d.id==='pump-camera');if(cam){cam.active=false;cam.detect=0;}trace=0;traceActive=false;socialEvent('sensor-bridge','DRY SENSOR LOOP BRIDGED / CLINIC POWER AND OWNER RECORDS UNCHANGED',160);notice('SENSOR TEST ACTIVE','QUIET REMOVAL READY','CORE LOCK RELEASED / REAR HATCH: CROUCH / NO SIGNED OWNERSHIP TRANSFER',4.5);Audio.hack();commsTimer=0;commsQueue.length=0;say('The stand will report a service test, not a missing core. You have not touched clinic power or the owner records. Use the low rear hatch. The bridge is not an ownership agreement.',9);saveCheckpoint();updateObjective();}
}
const v4Interactions=updateInteractions;
updateInteractions=function(dt){
 // Extraction requires a clear pickup, including on a mixed stealth/combat run.
 const blockedExit=stage===4&&Math.hypot(player.x-extractPos[0],player.z-extractPos[2])<2.85&&enemies.some(e=>e.alive&&e.aggro&&Math.hypot(e.x-player.x,e.z-player.z)<22);
 if(blockedExit){extraction=0;extractionActive=false;interactable={type:'exit-wait'};showPrompt('PICKUP BLOCKED','BREAK SIGHT AND LOSE THE GUARDS FIRST',false);return;}
 v4Interactions(dt);if(mode!=='playing'||scan||wheelOpen){serviceAction=null;return;}
 if(inService()||stealth.used){
  const o=stealthObjects.find(o=>nearStealthObject(o)&&!(o.id==='pump-door'&&stealth.doorOpen)&&!(o.id==='sensor-bridge'&&(stealth.loopBridged||stage===4)));
  if(o){interactable={type:'stealth',id:o.id};
   if(o.id==='service-plan'){serviceAction=null;showPrompt('READ C7 SERVICE RECORD','QUIET ROUTE / NO SKILL OR PAYMENT REQUIRED',false);return;}
   const dur=actionDuration(o.id),sk=o.id==='pump-door'?'technical':'intelligence',fast=social.skills[sk]>=5;
   if(!serviceAction||serviceAction.id!==o.id)serviceAction={id:o.id,t:0};
   showPrompt(o.id==='pump-door'?'HOLD TO TURN HANDWHEEL':'HOLD TO BRIDGE CORE SENSOR',(fast?SKILL_NAMES[sk]+' 5 / FAST METHOD':'MANUAL METHOD / NO SKILL REQUIRED')+' / '+dur.toFixed(1)+' S',true);
   if(interactHeld()&&player.speed<.55&&!inCombat()){serviceAction.t+=dt;}else serviceAction.t=0;
   $('action-progress').firstElementChild.style.width=clamp(serviceAction.t/dur*100,0,100)+'%';
   if(inCombat())setText('interact-sub',keyText('LEAVE COMBAT BEFORE YOU WORK'));else if(player.speed>.55)setText('interact-sub',keyText('STAND STILL AND HOLD F'));
   if(serviceAction.t>=dur){const id=serviceAction.id;serviceAction=null;interactLock=true;stealthAction(id);}return;
  }
 }
 serviceAction=null;
 if(stage===3&&interactable?.type==='core'&&stealth.loopBridged&&!social.permits.exit)setText('interact-sub',keyText('SENSOR BRIDGED / QUIET REMOVAL / OWNERSHIP UNRESOLVED'));
 if(stealth.carryId!==null){const h=hideSpots.find(h=>Math.hypot(h.x-player.x,h.z-player.z)<2.35);showPrompt(h?'HIDE CARRIED BODY':'BODY CARRIED',h?'[H] STORE IN LOCKER / UNCONSCIOUS GUARDS STAY ALIVE':'[H] PLACE BODY / FIND A SERVICE LOCKER',false);setText('interact-key',pk('carry'));}
 else if(interactable?.type==='loot')setText('interact-sub',keyText('F / TAKE EQUIPMENT    H / CARRY BODY'));
};
const v4Interact=interact;
interact=function(){if(mode==='playing'&&!scan&&!wheelOpen){updateInteractions(0);if(interactable?.type==='stealth'){if(interactable.id==='service-plan')stealthAction(interactable.id);return;}if(interactable?.type==='exit-wait')return;}v4Interact();};
const v4TakeCore=takeCore;
takeCore=function(){if(stage!==3||!archiveUnlocked)return;if(!stealth.loopBridged||social.permits.exit){v4TakeCore();return;}stage=4;transfer=0;stealth.quietCore=true;social.flags.quietTheft=true;social.flags.coreReleased=false;resetInputs();holstered=true;trace=0;traceActive=false;updateObjective();notice('SENSOR LOOP STABLE','CORE REMOVED / NO ALERT','RETURN THROUGH SERVICE C7 / WATCH FOR LOCAL SEARCHES',4.2);commsTimer=0;commsQueue.length=0;say('The core is out. The system still sees a service test. Come back the way you came. No pass was signed. We still have to answer to the people whose memories are in that box.',9);Audio.tone(260,.4,.08,'triangle',620);socialEvent('quiet-removal','CORE REMOVED UNDER SENSOR TEST / NO REINFORCEMENTS CALLED',200);saveCheckpoint();toast('QUIET CHECKPOINT SAVED / RETURN TO MERCY STREET');};
// Use normal physical movement. Crouch, lighting, and wall occlusion drive stealth.
const v4UpdatePlayer=updatePlayer;
updatePlayer=function(dt){v4UpdatePlayer(dt);stealth.lureCooldown=Math.max(0,stealth.lureCooldown-dt);stealth.noise=player.speed<.3?0:player.crouch>.6?(stealth.carryId!==null?.27:.08):player.speed>6?.95:stealth.carryId!==null?.48:.38;if(lowClearance(player.x,player.z))stealth.noise=Math.min(stealth.noise,.13);stealth.noiseClock-=dt;if(stealth.noiseClock<=0&&stealth.noise>.2){stealth.noiseClock=player.speed>6?.42:.8;noticeNoise(player.x,player.z,player.speed>6?8.5:stealth.carryId!==null?3.5:2.2,'steps');}if(stealth.carryId!==null){const e=enemies.find(e=>e.id===stealth.carryId);if(e){e.x=player.x;e.z=player.z;}else stealth.carryId=null;}};
const v4AdvanceGame=advanceGame;
advanceGame=function(dt){stealth.inService=inService();if(stealth.inService&&!stealth.used){stealth.used=true;stealth.routeKnown=true;socialEvent('service-discovered','SERVICE C7 FOUND / NO VISITOR PASS NEEDED',40);updateObjective();}
 v4AdvanceGame(dt);if(mode!=='playing')return;
 if(stealth.doorOpen)stealth.doorLift=lerp(stealth.doorLift,3.85,Math.min(1,dt*3));
 if(stealth.used&&player.x>-9.1&&player.z<-28&&player.z>-47&&stage===1){stage=2;stealth.frontOpen=true;updateObjective();saveCheckpoint();}
 if(stealth.inService){const zone=stealthZone();if(!stealth.seenZones[zone]){stealth.seenZones[zone]=true;if(['RAIN DRAIN','CABLE CRAWL'].includes(zone))toast('LOW PASSAGE / STAY CROUCHED / STANDING IS BLOCKED');else if(zone==='LOADING YARD')toast('PATROL AHEAD / TAG WITH TAB + MIDDLE MOUSE / Z THROWS A BOLT');else if(zone==='SWITCHWORKS')notice('SERVICE C7','SWITCHWORKS','KEEP TO COVER / DRAIN OPENINGS BYPASS THE WATCH',2.8);}}
};
// A compact view cone is drawn on the floor only while scanning or tagging.
const sightConeMesh=new Batch();
for(const a of [-.55,.55])sightConeMesh.beam([0,.025,0],[Math.sin(a),.025,Math.cos(a)],.005,'#e6b77b',.55);
for(let i=0;i<12;i++){const a=-.55+i*1.1/12,b=-.55+(i+1)*1.1/12;sightConeMesh.beam([Math.sin(a),.025,Math.cos(a)],[Math.sin(b),.025,Math.cos(b)],.004,'#e6b77b',.55);}sightConeMesh.upload();
const v4DrawWorld=drawWorld;
drawWorld=function(vp,eye,reflect=false){v4DrawWorld(vp,eye,reflect);draw(serviceDoorMesh,M.compose(-15.5,stealth.doorLift,-47));if(!reflect){for(const e of enemies){if(e.alive&&!neutralEnemy(e)&&(scan||e.tagged)&&Math.hypot(e.x-player.x,e.z-player.z)<30){const r=(player.crouch>.5?9.2:17.5)*(.52+stealth.exposure*.70);draw(sightConeMesh,M.compose(e.x,0,e.z,e.yaw,0,0,r,1,r),e.aggro?[1,.4,.5]:[.85,.9,.8]);}}for(const d of devices){if(d.type==='camera'&&d.active&&(scan||d.tagged)&&Math.hypot(d.x-player.x,d.z-player.z)<28)draw(sightConeMesh,M.compose(d.x,0,d.z,d.yaw,0,0,d.range||15,1,d.range||15),[.9,.65,.65]);}}};
// Route guidance leads along actual passages; offshoots join the original level.
const v4Objective=objectiveData;
objectiveData=function(){if(stealth.used&&(inService()||stealth.quietCore||(stealth.loopBridged&&player.z<-55)||(!social.permits.market&&player.z>24))){if(stage===4)return{title:'Return unseen to Mercy Street.',sub:'Use Service C7. Cross the low rear hatch while crouched.',pos:extractPos,label:'GETAWAY'};if(!stealth.doorOpen&&stage<3)return{title:'Reach the pump handwheel.',sub:'West drains bypass the patrols. Hold F at the handwheel.',pos:[-13.6,1.3,-45.6],label:'PUMP ACCESS'};if(!stealth.loopBridged&&stage<4)return{title:'Bridge the core sensor.',sub:'Hold F at the dry-contact panel. Clinic power stays live.',pos:[-11.5,1.3,-55.15],label:'SENSOR BRIDGE'};if(stage===3)return{title:'Take the core through rear access.',sub:'Crouch through the low hatch. Stay behind the screens.',pos:corePos,label:'CORE'};}return v4Objective();};
const quietRoute=[[-8.8,1.2,47],[-15.3,1.2,47],[-15.3,1.2,32.1],[-19,1.1,32.1],[-19,1.1,6.4],[-19,1.2,-18.7],[-19,1.1,-44],[-15.5,1.2,-44],[-15.5,1.2,-49.5],[-14.8,1.2,-55],[-14.7,1.2,-71.6],[-8.3,1.1,-71.6],[-1.4,1.1,-71.2]];
const v4RoutePoints=routePoints;
routePoints=function(){if(!stealth.used||(!inService()&&stage!==4&&player.z>-55))return v4RoutePoints();const target=objectiveData().pos;
 if(stage===4&&(stealth.quietCore||inService())){const route=quietRoute.slice().reverse();let idx=0,best=1e9;route.forEach((p,i)=>{const d=Math.hypot(p[0]-player.x,p[2]-player.z);if(d<best){best=d;idx=i;}});const p=route.slice(idx);p.push([-8.8,1.2,46],[-3.3,1.2,46],extractPos);return p;}
 let max=quietRoute.length;if(!stealth.doorOpen)max=8;else if(!stealth.loopBridged)max=10;let idx=0,best=1e9;quietRoute.slice(0,max).forEach((p,i)=>{const d=Math.hypot(p[0]-player.x,p[2]-player.z);if(d<best){best=d;idx=i;}});return [...quietRoute.slice(idx,max),target];};
// Map uses the expanded floor plan. It also shows the two independent crawl loops.
drawFullMap=function(){const el=$('full-map');if(!el)return;const c=el.getContext('2d'),X=z=>42+(57-z)*6.05,Y=x=>246+x*6.5;c.fillStyle='#0b1820';c.fillRect(0,0,900,440);c.strokeStyle='#233941';c.lineWidth=1;for(let x=12;x<900;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,440);c.stroke();}for(let y=12;y<440;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(900,y);c.stroke();}
 c.fillStyle='#223e43';c.fillRect(X(56.7),Y(-9),X(-47.5)-X(56.7),18*6.5);c.fillRect(X(-47.5),Y(-2.2),X(-55)-X(-47.5),4.4*6.5);c.fillRect(X(-55),Y(-9),X(-73)-X(-55),18*6.5);c.fillStyle='#29463e';c.fillRect(X(56.7),Y(-20.3),X(-72.7)-X(56.7),10.4*6.5);
 for(const co of colliders){if(!validCollider(co)||co.minY>2.4||co.maxX<-20.5||co.minX>9.4||co.minZ<-74||co.maxZ>58)continue;c.fillStyle=co.streetGate||co.gate||co.archiveDoor||co.serviceDoor?'#b2996a':co.minY>1?'#344f4b':'#506970';c.fillRect(X(co.maxZ),Y(co.minX),Math.max(1,(co.maxZ-co.minZ)*6.05),Math.max(1,(co.maxX-co.minX)*6.5));}
 c.lineWidth=2;c.setLineDash([4,3]);c.strokeStyle='#96bfa8';c.beginPath();quietRoute.forEach((p,i)=>i?c.lineTo(X(p[2]),Y(p[0])):c.moveTo(X(p[2]),Y(p[0])));c.stroke();c.setLineDash([]);
 for(const [txt,z]of[['MERCY STREET',53],['NULL MARKET',15],['RELAY 06',-29],['COLD ARCHIVE',-55]]){c.fillStyle='#c0d7ce';c.font='bold 11px monospace';c.fillText(txt,X(z),350);c.strokeStyle='#53716d';c.beginPath();c.moveTo(X(z),330);c.lineTo(X(z),Y(9));c.stroke();}
 for(const [txt,z]of[['LAUNDRY',52],['RAIN DRAIN',29],['SWITCHWORKS',3],['CABLE CRAWL',-20],['PUMP GALLERY',-48]]){c.fillStyle='#b5d9bd';c.font='10px monospace';c.fillText(txt,X(z),70);c.strokeStyle='#466f59';c.beginPath();c.moveTo(X(z),78);c.lineTo(X(z),Y(-20));c.stroke();}
 for(const o of stealthObjects){c.fillStyle='#b9e2bd';c.fillRect(X(o.z)-3,Y(o.x)-3,6,6);}for(const h of hideSpots){c.strokeStyle='#adcfc0';c.strokeRect(X(h.z)-3,Y(h.x)-3,6,6);}
 for(const e of enemies){if(!e.alive||(!e.tagged&&!e.aggro&&elapsed>=revealUntil))continue;c.fillStyle='#ed8e8e';c.beginPath();c.arc(X(e.z),Y(e.x),3,0,TAU);c.fill();}
 for(const d of devices){if(d.type!=='camera'||!d.service)continue;c.fillStyle=d.active?'#d5a875':'#597b70';c.fillRect(X(d.z)-2,Y(d.x)-2,4,4);}
 for(const id of Object.keys(CONTACTS)){if(id==='panel')continue;const a=contactActor(id);if(!a)continue;c.fillStyle='#a3c9d8';c.fillRect(X(a.z)-3,Y(a.x)-3,6,6);}
 const target=objectiveData().pos;c.strokeStyle='#e5dc86';c.beginPath();c.arc(X(target[2]),Y(target[0]),6,0,TAU);c.stroke();c.fillStyle='#ccfff0';c.save();c.translate(X(player.z),Y(player.x));c.rotate(player.yaw);c.beginPath();c.moveTo(8,0);c.lineTo(-5,-4);c.lineTo(-3,0);c.lineTo(-5,4);c.closePath();c.fill();c.restore();
 c.fillStyle='#90b2a7';c.font='10px monospace';c.fillText('DASHED LINE / QUIET ROUTE     FILLED SQUARE / PANEL     EMPTY SQUARE / BODY LOCKER',44,392);c.fillText('Both drains are low. Crouch to enter. Market and relay side doors allow a change of plan.',44,414);
};
const v4DrawMap=drawMap;
drawMap=function(){v4DrawMap();/* The full map is the route planner; this is local security telemetry. */};
function renderWatchIndicators(){if(mode!=='playing'){ setHTML('stealth-alerts','');return;}let html='';for(const e of enemies){if(!e.alive||neutralEnemy(e)||!(e.detect>.08||e.searchLeft>0||e.aggro)||Math.hypot(e.x-player.x,e.z-player.z)>22)continue;if(!e.tagged&&!scan&&!lineOfSight([player.x,player.y,player.z],[e.x,1.6,e.z]))continue;const p=project([e.x,2.36,e.z]);if(!p||p.w<=0||p.x<40||p.x>innerWidth-40||p.y<60||p.y>innerHeight-90)continue;const label=e.aggro?'SPOTTED':e.detect>.28?'CHECKING YOU':'SEARCHING';html+=`<div class="watch-indicator ${e.aggro?'confirmed':''}" style="left:${p.x}px;top:${p.y}px">${label}<small>${e.aggro?'BREAK SIGHT':e.searchLeft>0&&e.detect<.28?'LAST KNOWN POSITION':Math.round(e.detect*100)+'% IDENTIFIED'}</small><i><b style="width:${Math.max(12,e.detect*100)}%"></b></i></div>`;}setHTML('stealth-alerts',html);}
const v4HUD=updateHUD;
updateHUD=function(dt=0){v4HUD(dt);const active=mode==='playing';setVisible('stealth-hud',active&&!scan&&(stealth.used||player.crouch>.5));if(!active){setHTML('stealth-alerts','');return;}const searching=enemies.some(e=>e.alive&&!neutralEnemy(e)&&(e.searchLeft>0||e.detect>.15)&&Math.hypot(e.x-player.x,e.z-player.z)<25);
 setText('stealth-state',threatLevel?'SPOTTED':searching?'LOCAL SEARCH':'UNSEEN');setStyle('stealth-state','color',threatLevel?'#ffa4a1':searching?'#e4c994':'#b8e3c5');setText('stealth-zone',inService()?'SERVICE C7':stealth.quietCore?'QUIET RETURN':'SHADOW LINK');setStyle('exposure-fill','width',stealth.exposure*100+'%');setStyle('noise-fill','width',stealth.noise*100+'%');setText('exposure-value',stealth.exposure>.55?'LIT':stealth.exposure>.3?'DIM':'SHADOW');setText('noise-value',stealth.noise<.01?'SILENT':stealth.noise<.16?'QUIET':stealth.noise>.7?'LOUD':'FOOTSTEPS');setText('stealth-tip',keyText(stealth.carryId!==null?'H / PLACE BODY OR HIDE AT A LOCKER':lowClearance(player.x,player.z)?'LOW CEILING / STAY CROUCHED':stealth.loopBridged?'SENSOR BRIDGED · Z / LURE · H / CARRY':'Z / THROW BOLT · H / CARRY · M / ROUTE'));
 if(inService()){setText('zone-name',stealthZone()+' / SERVICE C7');setText('social-status',stealth.quietCore?'CORE OFFLINE / QUIET RETURN':'SERVICE ROUTE / NO VISITOR PASS');setText('social-hint',stealth.loopBridged?'Sensor bridge active. Clinic power is unchanged.':'Crouch through drains. Watch patrols. Do not cut clinic power.');}
 if(!threatLevel&&searching){setText('map-status','LOCAL SEARCH');setStyle('map-status','color','#e1c286');}
 if(frameNumber%5===0)renderWatchIndicators();
};
const v4UI=updateUI;
updateUI=function(dt){v4UI(dt);if(mode!=='playing'){setVisible('stealth-hud',false);setHTML('stealth-alerts','');}};
const v4Scanner=renderScannerHUD;
renderScannerHUD=function(){v4Scanner();if(!scan||!scanObject)return;const t=scanObject;if(t.kind==='enemy'&&!neutralEnemy(t.obj)){$('scan-details').innerHTML+=`<br>${esc(t.obj.suspicionState||'UNAWARE').toUpperCase()} / ${Math.round((t.obj.detect||0)*100)}% IDENTIFIED`;$('hack-description').textContent+=(t.obj.searchLeft>0?' Searchers know a sound or last sighting, not your current position.':' The floor arc is a sight guide. Walls still block sight.');}};
// A service record gives every background the same complete manual route.
EVIDENCE.servicePlan=['C7 SERVICE ROUTE','Use the open service door on the west side of Mercy Street. The rain drain bypasses the loading watch. The cable crawl bypasses the relay watch. Open the pump handwheel, then bridge the core sensor at the dry-contact panel. Clinic power and owner records stay unchanged. Crouch through the rear hatch and take the core. Return through the same passages. No skill, kill, quickhack, or signed pass is required.'];
const v4Field=renderField;
renderField=function(){v4Field();if(activePanel==='journal'){$('field-content').insertAdjacentHTML('afterbegin',`<section class="route-brief"><div class="eyebrow">BLINDSIDE / OPTIONAL APPROACH</div><h3>THE QUIET ROUTE</h3><p>Enter the green service door on the west side of Mercy Street, beside the getaway. Read the C7 service record inside.</p><p><b>Laundry service → rain drain → Switchworks → cable crawl → pump gallery → archive rear hatch.</b></p><p>Both low passages require crouching. A west-wall route avoids every guard. The handwheel opens the pump room. The sensor bridge releases the coolant lock and stops the removal alarm. It does not change ownership or clinic power. Return through the same service route.</p><p><b>Before taking the core:</b> ${stealth.loopBridged?'SENSOR BRIDGED / QUIET REMOVAL READY':'SENSOR NOT BRIDGED / UNAUTHORIZED REMOVAL WILL CALL GUARDS'}.</p><p>Tab: scan and read targets. Middle mouse while scanning: tag. Z outside the scanner: throw a bolt. H: carry, place, or hide a body. Break sight after detection; guards search your last known position.</p><p>Technical 5 turns the handwheel faster. Intelligence 5 bridges the sensor faster. Cool slows recognition. Body 5 increases carrying speed. Every route has a manual method.</p><p>${stealth.detections} confirmed sightings · ${stats.alarms} alarms · ${stealth.bodiesFound} bodies found · ${stealth.bodiesHidden} bodies hidden.</p></section>`);}else if(activePanel==='map'){$('field-content').querySelector('h3').textContent='BLINDSIDE / TWO ROUTES, ONE DISTRICT';$('field-content').querySelector('p').textContent='Green dashed line: the service route. Low passages require crouching. Side doors join the market and relay. Tagged guards appear in red.';}else if(activePanel==='character'){$('field-content').insertAdjacentHTML('beforeend','<h3>STEALTH SKILLS</h3><p>Technical 5: handwheel 2.2 seconds instead of 5. Intelligence 5: sensor bridge 3 seconds instead of 6. Each Cool point above 3 reduces recognition speed by 3.5%. Body 5: carry speed 2.25 m/s instead of 1.65. No skill is required to finish unseen.</p>');}};
const v4MaraDialogue=maraDialogue;
maraDialogue=function(n){if(n==='quiet')return node('There is an old service line behind the clinic. The door is open, but the plant still has a watch. Use the drains, not the main aisle.\n\nThe archive stand checks its load. Bridge that sensor in the pump gallery before you lift the core. Do not cut the shared feed. A silent job that stops someone breathing is not a clean job.',[C('quiet-map','Give me the route, not a cover story.','quiet-cost',{effect:()=>{stealth.routeKnown=true;learn('servicePlan');}}),back()]);if(n==='quiet-cost')return node('Laundry service. Rain drain. Switchworks. Cable crawl. Pump gallery. A low hatch enters the rear of the archive. Go back the same way.\n\nThe sensor test does not name a worker or erase a resident. It also does not give you the right to sell their memories. You can avoid security and still owe people an answer.',[back(),leave('I will keep that distinction.')]);const v=v4MaraDialogue(n);if(n==='root'&&stage<4)v.choices.splice(v.choices.length-1,0,C('quiet','Can I go around security without using anyone as cover?','quiet'));return v;};
const v4JaxDialogue=jaxDialogue;
jaxDialogue=function(n){if(n==='quiet')return node('C7 is still there. They budget for camera coverage, not the drains behind it. Crouch. Do not run on the open floor.\n\nThe old sensor bridge is a dry contact. You can leave the clinic feed live and leave our names out of the security record. The public gate and the service line are separate routes.',[C('quiet-record','Show me the manual route. No worker names.','quiet-done',{effect:()=>{stealth.routeKnown=true;learn('servicePlan');rapport('jax','quiet-safety');}}),back()]);if(n==='quiet-done')return node('It is in your journal. Every latch has a hand-operated method. Technical skill saves time at the pump door. Intelligence saves time at the bridge.\n\nDo not let a skill label fool you into thinking there is only one way through a room.',[back(),leave('I will use the service line.')]);const v=v4JaxDialogue(n);if(n==='root')v.choices.splice(v.choices.length-1,0,C('quiet','Show me a way around the gates.','quiet'));return v;};
const v4Call=callGetaway;
callGetaway=function(){if(stealth.used&&inService()&&mode==='playing'&&stage<4){say(!stealth.doorOpen?'Stay near the west wall. The two low drain passages bypass the watch. The handwheel is before the pump gallery.':!stealth.loopBridged?'The dry-contact panel is ahead, by the archive wall. Hold F there. It releases the lock and masks removal without cutting clinic power.':'The low hatch is at the far end of the gallery. Crouch through it and stay behind the archive screens. The core is on the stand.',8);return;}v4Call();};
const v4ConfirmProfile=confirmProfile;
confirmProfile=function(){const ok=v4ConfirmProfile();if(ok){notice('GHOST SIGNAL / BLINDSIDE','THREE WAYS THROUGH','TALK / FIGHT / USE THE WEST SERVICE DOOR',4.5);commsTimer=0;commsQueue.length=0;say('I am by the car. We can talk terms, or you can take the service door on the west side. The green sign says C7. The maintenance record inside gives you the quiet route.',8);}return ok;};
// Clear lures and progress on pause, dialogue, and a loss of keyboard focus.
const v4ResetInputs=resetInputs;
resetInputs=function(){v4ResetInputs();serviceAction=null;};
function ghostReport(){const lethal=Math.max(0,stats.kills-stats.nonlethal),unseen=stealth.detections===0&&stats.alarms===0&&stealth.bodiesFound===0;const ghost=stealth.quietCore&&unseen&&stats.kills===0&&stats.shots===0&&social.violence===0;const silent=stealth.quietCore&&unseen&&lethal===0&&stats.shots===0;return{ghost,silent,unseen,lethal,title:ghost?'TRUE GHOST':silent?'SILENT HANDS':stealth.quietCore?'LOW SIGNAL':'APPROACH RECORD'};}
// Carrying occupies both hands. The body must be placed before combat.
const v4Fire=fire;fire=function(){if(stealth.carryId!==null)return;return v4Fire();};
const v4Melee=melee;melee=function(strong=false,quick=false){if(stealth.carryId!==null){toast('HANDS OCCUPIED / H TO PLACE BODY');return;}return v4Melee(strong,quick);};
const v4SwitchWeapon=switchWeapon;switchWeapon=function(i){if(stealth.carryId!==null){toast('HANDS OCCUPIED / H TO PLACE BODY');return;}return v4SwitchWeapon(i);};
const v4ThrowEMP=throwEMP;throwEMP=function(){if(stealth.carryId!==null){toast('HANDS OCCUPIED / H TO PLACE BODY');return;}return v4ThrowEMP();};
const v4FinishHack=finishHack;finishHack=function(forced=false){if(mode==='hacking')stealth.frontOpen=true;return v4FinishHack(forced);};
const v4Win=win;
win=function(){if(mode!=='playing')return;const report=ghostReport();v4Win();if(mode!=='won')return;if(stealth.quietCore&&!social.permits.exit){$('rank-value').textContent=report.title;$('win').querySelector('h2').innerHTML=report.ghost?'NEVER SEEN.<br>NOTHING ERASED.':report.silent?'QUIET HANDS.<br>LIVE SIGNAL.':'CORE OUT.<br>TRACE LEFT.';}
 let el=$('quiet-report');if(!el){el=document.createElement('section');el.id='quiet-report';el.className='quiet-report';$('win').querySelector('.rank').after(el);}el.innerHTML=`<h3>${report.title}</h3><p>${stealth.detections} CONFIRMED SIGHTINGS / ${stats.alarms} ALARMS<br>${stats.shots} SHOTS / ${report.lethal} LETHAL / ${stats.nonlethal} NONLETHAL<br>${stealth.bodiesFound} BODIES FOUND / ${stealth.bodiesHidden} BODIES HIDDEN<br>${stealth.quietCore?'CORE REMOVAL MASKED / NO AMBUSH CALLED':social.permits.exit?'CORE RELEASE SIGNED':'CORE REMOVAL NOT MASKED'}</p>`;storage.set('best-v4',{time:elapsed,rank:$('rank-value').textContent,stats,social,stealth});setVisible('stealth-hud',false);$('stealth-alerts').innerHTML='';};

// ============================================================================
// V5 / SHARED STACK. Prompts for every device, touch controls that follow the
// situation, Vanta WASP drones, the Clean Feed side gig and run records.
// ============================================================================
// ---- Prompts: every label that names a key follows the device used last.
const PROMPT_TEXT={
 menuKeys:{keyboard:'<span><b class="key">W A S D</b> MOVE</span><span><b class="key">MOUSE</b> LOOK / FIRE</span><span><b class="key">TAB</b> HOLD TO SCAN</span>',
  gamepad:'<span><b class="key">L STICK</b> MOVE</span><span><b class="key">R STICK</b> LOOK</span><span><b class="key">RT</b> FIRE</span><span><b class="key">LB</b> HOLD TO SCAN</span>',
  touch:'<span><b class="key">LEFT THUMB</b> MOVE</span><span><b class="key">DRAG</b> LOOK</span><span><b class="key">SCAN</b> SCANNER</span>'},
 menuDevice:{keyboard:'HEADPHONES RECOMMENDED  ·  KEYBOARD + MOUSE',gamepad:'HEADPHONES RECOMMENDED  ·  CONTROLLER',touch:'HEADPHONES RECOMMENDED  ·  TOUCH / LANDSCAPE'},
 pauseHint:{keyboard:'Click Resume to capture the mouse. Press Esc to release it.',gamepad:'B or Menu resumes. The left stick or D-pad moves between buttons.',touch:'Tap Resume to return to the street.'},
 scanFooter:{keyboard:'HOLD TAB / RELEASE TO EXIT  ·  CAPS LOCK Toggle  ·  MMB Tag target',gamepad:'HOLD LB / RELEASE TO EXIT  ·  Y Next quickhack  ·  D-PAD → Tag target',touch:'SCAN Exit  ·  UPLOAD  ·  TAG  ·  HACK › Next'},
 wheelHint:{keyboard:'MOVE MOUSE OR WHEEL · RELEASE ALT',gamepad:'LEFT STICK · RELEASE Y',touch:''},
 fieldClose:{keyboard:'[ESC] RETURN TO MISSION',gamepad:'[B] RETURN  ·  LB / RB TABS',touch:'RETURN TO MISSION'},
 hackCancel:{keyboard:'[ESC] DISCONNECT',gamepad:'[B] DISCONNECT',touch:'DISCONNECT'},
 talkHistory:{keyboard:'[L] TRANSCRIPT',gamepad:'[Y] TRANSCRIPT',touch:'TRANSCRIPT'},
 talkLeave:{keyboard:'[ESC] STEP AWAY',gamepad:'[B] STEP AWAY',touch:'STEP AWAY'},
 talkHistoryClose:{keyboard:'[L / ESC] CLOSE',gamepad:'[Y / B] CLOSE',touch:'CLOSE'},
 talkFooter:{keyboard:'[1–9] CHOOSE  ·  [↑ ↓] SELECT  ·  [F / ENTER] CONFIRM',gamepad:'[D-PAD / L STICK] SELECT  ·  [A] CONFIRM  ·  [R STICK] SCROLL',touch:'TAP A CHOICE  ·  DRAG TO SCROLL'},
 guideEyebrow:{keyboard:'FIELD GUIDE / KEYBOARD + MOUSE',gamepad:'FIELD GUIDE / CONTROLLER',touch:'FIELD GUIDE / TOUCH'}
};
const SHORT_PAD={heal:'D↑',emp:'D→',overclock:'D↓'};
const KB_GUIDE=document.querySelector('#controls .control-grid')?.innerHTML||'';
const GUIDE_P=[...document.querySelectorAll('#controls .guide-p')].map(p=>p.innerHTML);
const PAD_GUIDE=[['L STICK','Move'],['R STICK','Look'],['RT','Fire / melee attack (hold for a strong strike)'],['LT','Aim / melee block'],['A','Jump / vault / double jump'],['B','Crouch / slide'],['RB','Dash / air dash'],['L3','Toggle sprint'],['X','Use / take / grab · reload when nothing is in reach'],['Y','Tap: next weapon · hold: wheel · double-tap: holster'],['LB (HOLD)','Scanner'],['R3','Quick melee · carry or hide a body in reach'],['D-PAD ↑','Health item'],['D-PAD →','EMP grenade · tag in the scanner'],['D-PAD ←','Noise bolt · details in the scanner'],['D-PAD ↓','Overclock'],['VIEW','Inventory, journal, map (LB / RB switch tabs)'],['MENU','Pause'],['SCANNER','RT or X uploads · Y next quickhack'],['TAKEDOWN','X lethal · A nonlethal · B release'],['MENUS','D-pad or L stick moves · A chooses · B goes back · R stick scrolls']];
const TOUCH_GUIDE=[['LEFT THUMB','Move (the stick appears under your thumb) · push to the edge to sprint'],['DRAG','Look'],['FIRE','Fire or strike · hold with the rifle for automatic fire'],['JUMP','Jump / vault / double jump'],['CROUCH','Crouch / slide'],['DASH','Dash / air dash'],['SCAN','Scanner on and off'],['USE','Talk, take, grab · hold at consoles (shows when something is in reach)'],['II','Pause'],['MENU','Inventory, journal, map, contact'],['WEAPON','Tap: next weapon · double-tap: holster'],['RELOAD','Shows when the magazine is not full'],['HEAL / EMP','Health item / EMP grenade (charges on the button)'],['BOLT','Noise bolt (shows while sneaking)'],['CARRY','Carry, place or hide a body (shows near one)'],['SCANNER','UPLOAD runs the quickhack · TAG · HACK › next · OC overclock'],['MENUS AND TALKS','Tap a button or a choice'],['SETTINGS','Pause › Settings › Graphics quality: resolution, button size, left-handed layout']];
function renderControlsGuide(){const src=input.source,grid=document.querySelector('#controls .control-grid');if(!grid)return;
 const list=src==='gamepad'?PAD_GUIDE:src==='touch'?TOUCH_GUIDE:null;
 grid.innerHTML=list?list.map(([k,t])=>`<span><b class="key">${esc(k)}</b> ${esc(t)}</span>`).join(''):KB_GUIDE;
 document.querySelectorAll('#controls .guide-p').forEach((p,i)=>{p.innerHTML=keyText(GUIDE_P[i]??p.innerHTML);});
 setText('guide-eyebrow',PROMPT_TEXT.guideEyebrow[src]||PROMPT_TEXT.guideEyebrow.keyboard);}
function applyPrompts(){const src=PROMPT[input.source]?input.source:'keyboard';document.documentElement.dataset.input=src;
 document.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k;el.textContent=src==='gamepad'&&SHORT_PAD[k]&&el.closest('.ability')?SHORT_PAD[k]:pk(k);});
 const put=(id,key,html=false)=>{const el=$(id),t=PROMPT_TEXT[key];if(!el||!t)return;const v=t[src]??t.keyboard;if(html)el.innerHTML=v;else el.textContent=v;};
 put('menu-keys','menuKeys',true);put('menu-device','menuDevice');put('pause-hint','pauseHint');put('scan-footer','scanFooter');put('wheel-hint','wheelHint');put('field-close','fieldClose');put('hack-cancel','hackCancel');put('talk-history-btn','talkHistory');put('talk-leave-btn','talkLeave');put('talk-history-close','talkHistoryClose');put('talk-footer','talkFooter');
 document.querySelectorAll('#field-nav button[data-kb]').forEach(b=>{b.textContent=src==='keyboard'?b.dataset.kb:b.dataset.plain;});
 if(!$('controls').classList.contains('hidden'))renderControlsGuide();
 _hudCache.clear(); // HUD strings that name keys are rebuilt on the next frame
}
input.onSourceChange(()=>applyPrompts());
KEY_TEXT.unshift([/Press F to upload it/g,()=>'Press '+pk('upload')+' to upload it'],[/Check I → Character and J → Journal/g,()=>'Check '+pk('inventory')+' → Character and Journal']);

// ---- Touch: the kit's controls follow the situation. Menus and talks hide them; labels switch in
// the scanner; Use, Reload, Bolt and Carry only show when they do something. DOM work happens only
// when something changes.
const touchCache={suspended:null,label:{},shown:{}};
function touchLabel(name,text){if(touchCache.label[name]!==text){touchCache.label[name]=text;kit.touch.setLabel(name,text);}}
function touchShown(name,on){if(touchCache.shown[name]!==on){touchCache.shown[name]=on;kit.touch.setShown(name,on);}}
function syncTouch(){const t=kit.touch;if(!t)return;const playing=mode==='playing';
 if(touchCache.suspended!==!playing){touchCache.suspended=!playing;t.suspend(!playing,'game');}
 if(!playing||!t.visible)return;
 const w=weapons[weaponIndex];
 touchLabel('fire',scan?'Upload':w.melee&&!holstered?'Strike':'Fire');touchLabel('jump',scan?'Tag':'Jump');touchLabel('dash',scan?'Hack ›':'Dash');
 touchLabel('crouch',scan?'OC':player.crouchToggle?'Stand':'Crouch');touchLabel('scanToggle',scan?'Exit':'Scan');
 touchLabel('interact',interactable?.type==='talk'?'Talk':interactable?.type==='loot'||interactable?.type==='supply'?'Take':'Use');
 touchLabel('heal','Heal '+player.meds);touchLabel('emp',scan?'Tag':'EMP '+player.emp);touchShown('heal',!scan);
 touchShown('interact',!scan&&!!interactable&&interactable.type!=='exit-wait');
 touchShown('reload',!scan&&!w.melee&&!holstered&&w.ammo<w.cap&&w.reserve>0);
 touchShown('carry',!scan&&bodyInReach());
 touchShown('bolt',!scan&&(stealth.used||player.crouch>.5||inService()));}

// ---- Audio: a context created without a gesture (a controller press) starts suspended. The next
// key, click or tap wakes it, unless the game is paused.
const unlockAudio=()=>{if(Audio.started&&Audio.ctx?.state==='suspended'&&!kit.paused)Audio.ctx.resume?.()?.catch?.(()=>{});};
for(const ev of ['pointerdown','keydown','touchend'])addEventListener(ev,unlockAudio,{capture:true,passive:true});

// ---- Takedown choice: buttons for mouse and touch; the keys and pad buttons still work.
$('grapple-lethal').onclick=()=>completeGrapple(true);$('grapple-nonlethal').onclick=()=>completeGrapple(false);$('grapple-release').onclick=()=>releaseGrapple();
const v5Complete=completeGrapple;completeGrapple=function(lethal=false){const was=mode==='grapple';v5Complete(lethal);if(was&&mode==='playing')input.rumble(.5,160);};

// ---- VANTA WASP drones. Alarms launch them: a completed network trace, a forced relay or street
// gate, or a core taken without a release. They hunt by line of sight, circle the last known
// position, and can be shot (fire() tests droneRay before guards), short-circuited, blinded,
// tagged, or fried by an EMP. A truce or a signed deal recalls them.
let drones=[],nextDroneId=0,droneDispatch={},pendingDrones=0,droneTimer=0;
function freshDrone(x,y,z){return{id:nextDroneId++,name:'VANTA WASP / DRONE',x,y,z,vy:0,yaw:0,hp:55,maxHp:55,alive:true,stun:0,blind:0,hit:0,flash:0,attack:rr(1.8,2.6),orbit:rr(0,TAU),lastSeen:-99,lastKnown:null,retreat:false,tagged:false,deadTime:0};}
function dispatchDrones(n){n=Math.min(n,3-drones.filter(d=>d.alive&&!d.retreat).length);if(n<=0)return;
 for(let i=0;i<n;i++){let x,y,z;
  if(player.z<-47.3){x=i%2?1.6:-1.6;y=3.4;z=-63.5-i;}          // the archive keeps its own drones
  else{x=clamp((inService()?-5:player.x)+[-3.5,3.5,0][i%3],-8,8);z=clamp(player.z+[12,-11,5][i%3],-45,54);y=15;}
  const d=freshDrone(x,y,z);d.lastKnown=[player.x,player.z];d.lastSeen=elapsed-3;drones.push(d);}
 notice('AERIAL SECURITY','DRONES LAUNCHED',n>1?n+' VANTA WASPS / BREAK LINE OF SIGHT OR BRING THEM DOWN':'VANTA WASP / BREAK LINE OF SIGHT OR BRING IT DOWN',2.8);
 Audio.tone(620,.5,.09,'sawtooth',1240);Audio.tone(930,.35,.05,'square',1400,.25);}
function droneTriggers(dt){if(!(social.hostile||traceAlarm)){droneTimer=0;return;}
 const bonus=settings.difficulty==='HARDCORE'?1:0;
 for(const [k,on,n] of [['trace',traceAlarm,1],['theft',!!social.flags.theftAlert,settings.difficulty==='STORY'?1:2],['relay',!!social.flags.relayForced,1],['gate',!!social.flags.powerCut,1]])if(on&&!droneDispatch[k]){droneDispatch[k]=true;pendingDrones+=n+bonus;}
 if(pendingDrones>0){droneTimer+=dt;if(droneTimer>2.5){dispatchDrones(pendingDrones);pendingDrones=0;droneTimer=0;}}}
// Drones stay over the public street and the archive: service walls and low lintels keep them out.
function droneBlocked(x,y,z){if(x<-9.2||x>8.8||z<-72.2||z>56.2)return true;for(const c of colliders){if(!validCollider(c)||c.maxY<y-.28||c.minY>y+.28)continue;if(x+.42>c.minX&&x-.42<c.maxX&&z+.42>c.minZ&&z-.42<c.maxZ)return true;}return false;}
function updateDrones(dt){const hostile=social.hostile||traceAlarm;
 for(let i=drones.length-1;i>=0;i--){const d=drones[i];
  if(!d.alive){if(d.y>.16){d.vy-=14*dt;d.y=Math.max(.16,d.y+d.vy*dt);if(d.y<=.16){burst([d.x,.3,d.z],'#ffb07a',10);Audio.noise(.2,.12,700);}}d.deadTime+=dt;if(d.deadTime>14)drones.splice(i,1);continue;}
  d.hit=Math.max(0,d.hit-dt);d.flash=Math.max(0,d.flash-dt);d.blind=Math.max(0,d.blind-dt);
  if(!hostile)d.retreat=true;
  if(d.retreat){d.y+=3.4*dt;if(d.y>16)drones.splice(i,1);continue;}
  if(d.stun>0){d.stun=Math.max(0,d.stun-dt);d.y=Math.max(1.3,d.y-.7*dt);if(rand()<dt*14)particle([d.x+rr(-.3,.3),d.y,d.z+rr(-.3,.3)],[rr(-.6,.6),rr(-.2,.8),rr(-.6,.6)],'#8fe9ff',.07,.3,1);continue;}
  threatLevel++;
  const dx=player.x-d.x,dz=player.z-d.z,dist=Math.hypot(dx,dz);
  const sees=d.blind<=0&&dist<30&&lineOfSight([d.x,d.y-.15,d.z],[player.x,player.y-.1,player.z]);
  if(sees){d.lastSeen=elapsed;d.lastKnown=[player.x,player.z];}
  // A low rotor drone tells the player where it is before it is in view.
  d.buzz=(d.buzz||0)-dt;if(d.buzz<=0){d.buzz=.5;if(dist<24)Audio.tone(88+d.id%3*9,.45,.004+.018*(1-dist/24),'sawtooth',96+d.id%3*9);}
  let tx=d.x,tz=d.z;
  if(sees||elapsed-d.lastSeen<1.5){d.orbit+=dt*.35;tx=player.x+Math.cos(d.orbit)*8.5;tz=player.z+Math.sin(d.orbit)*8.5;}
  else if(d.lastKnown){d.orbit+=dt*.8;tx=d.lastKnown[0]+Math.cos(d.orbit)*2.5;tz=d.lastKnown[1]+Math.sin(d.orbit)*2.5;}
  const ax=tx-d.x,az=tz-d.z,ad=Math.hypot(ax,az),step=Math.min(ad,(sees?4.2:3.2)*dt);
  if(ad>.05){const nx=d.x+ax/ad*step,nz=d.z+az/ad*step;if(!droneBlocked(nx,d.y,d.z))d.x=nx;if(!droneBlocked(d.x,d.y,nz))d.z=nz;}
  const alt=(d.z<-47.3?2.75:3.5)+Math.sin(time*2.1+d.id)*.12;d.y=lerp(d.y,alt,Math.min(1,dt*(d.y>alt+2?1.3:3)));
  if(sees)d.yaw=Math.atan2(dx,dz);else if(ad>.05)d.yaw=Math.atan2(ax,az);
  d.attack-=dt;
  if(sees&&d.attack<=0&&dist<26){d.attack=rr(1.4,2.1)*diff().fire;d.flash=.1;
   const origin=[d.x,d.y-.2,d.z],acc=clamp(.62-dist*.014-(player.speed>6?.2:0)-(player.crouch>.5?.08:0),.12,.6),hit=rand()<acc,end=hit?[player.x,player.y-.25,player.z]:[player.x+rr(-1.2,1.2),player.y+rr(-.8,.6),player.z+rr(-1.2,1.2)],len=Math.hypot(...sub(end,origin)),dd=norm(sub(end,origin)),ray=wallRay(origin,dd,len);
   tracer(origin,add(origin,mul(dd,ray.dist)),'#ff6f8a',.09);Audio.tone(1350,.05,.05,'square',500);Audio.noise(.05,.06,4200);if(hit&&ray.dist>len-.7)hurtPlayer(rr(6,9),origin);}
 }}
function droneRay(o,dir,maxD){let best=null,bd=maxD;for(const d of drones){if(!d.alive)continue;const cx=d.x-o[0],cy=d.y-o[1],cz=d.z-o[2],t=cx*dir[0]+cy*dir[1]+cz*dir[2];if(t<0||t>bd)continue;const px=cx-dir[0]*t,py=cy-dir[1]*t,pz=cz-dir[2]*t;if(px*px+py*py*2.2+pz*pz<.36){best={d,dist:t};bd=t;}}return best;}
function damageDrone(d,amount){if(!d||!d.alive)return;d.hp-=amount;d.hit=.14;d.lastSeen=elapsed;d.lastKnown=[player.x,player.z];burst([d.x,d.y,d.z],'#9fe9ff',5);if(d.hp<=0)destroyDrone(d);}
function destroyDrone(d,emp=false){if(!d.alive)return;d.alive=false;d.hp=0;d.vy=1.2;d.deadTime=0;stats.drones=(stats.drones||0)+1;social.xp+=60;
 for(let i=0;i<26;i++)particle([d.x,d.y,d.z],[rr(-4,4),rr(-1,4),rr(-4,4)],emp?'#6ddef6':pick(['#ffc387','#ff674d','#e9dc9b']),rr(.05,.16),rr(.25,.8),1,7);
 Audio.noise(.4,.3,1600);Audio.tone(220,.4,.18,'sawtooth',40);killFlash=.18;floatText('DRONE DOWN +60 XP',[d.x,d.y+.5,d.z],'#e5ff47',1.2);input.rumble(.35,120);}
const v5Explode=explode;
explode=function(p,radius=6.2,damage=110,emp=false){v5Explode(p,radius,damage,emp);for(const d of drones){if(!d.alive)continue;const dist=Math.hypot(d.x-p[0],d.y-p[1],d.z-p[2]);if(dist<radius*(emp?1.3:1)){if(emp)destroyDrone(d,true);else damageDrone(d,damage*(1-dist/(radius*1.65)));}}
 const near=Math.hypot(player.x-p[0],player.z-p[2]);if(near<14)input.rumble(clamp(1-near/14,.25,1),220);};
const v5InCombat=inCombat;inCombat=function(){return v5InCombat()||drones.some(d=>d.alive&&!d.retreat&&elapsed-d.lastSeen<8);};
function drawDrones(){if(mode==='menu')return;for(const d of drones){if(Math.hypot(d.x-renderEye[0],d.z-renderEye[2])>80)continue;
 if(!d.alive){draw(droneMesh,M.compose(d.x,d.y,d.z,d.yaw,.35,1.1),[.32,.34,.38]);continue;}
 const wob=d.stun>0?Math.sin(time*26)*.25:0,model=M.compose(d.x,d.y,d.z,d.yaw,.08+wob*.5,wob);
 draw(droneMesh,model,d.hit>0?[1.8,.75,.65]:d.stun>0?[.55,1.35,1.7]:d.blind>0?[.8,.8,.95]:[1.12,.92,.96]);
 if(d.flash>0)draw(muzzleMesh,M.multiply(model,M.compose(0,-.14,.5,Math.PI,0,0,.9,.9,.9)));}}
// Scanner: drones can be read, tagged and hacked.
const v5FindScan=findScanObject;
findScanObject=function(){let t=v5FindScan();const o=[player.x,player.y,player.z],dir=aimDir();for(const d of drones){if(!d.alive||d.retreat)continue;const v=[d.x-o[0],d.y-o[1],d.z-o[2]],dist=Math.hypot(...v),along=dot(v,dir);if(along<=0||dist>35)continue;const off=Math.hypot(...sub(v,mul(dir,along)));if(off<.75&&(!t||dist<t.dist)&&lineOfSight(o,[d.x,d.y,d.z]))t={kind:'drone',obj:d,pos:[d.x,d.y,d.z],dist};}return t;};
const v5QueueTarget=queueTarget;queueTarget=function(q){if(q.kind==='drone'){const d=drones.find(d=>d.id===q.id);return d?.alive?{kind:'drone',obj:d}:null;}return v5QueueTarget(q);};
const v5Tag=tagTarget;tagTarget=function(){if(scan&&scanObject?.kind==='drone'){const d=scanObject.obj;d.tagged=!d.tagged;Audio.click();toast(d.tagged?'DRONE TAGGED · VISIBLE THROUGH COVER':'DRONE TAG REMOVED');return;}v5Tag();};
const v5Outlines=drawScannerOutlines;
drawScannerOutlines=function(){v5Outlines();if(mode==='menu')return;const reveal=elapsed<revealUntil;drawLayer=2;for(const d of drones){if(!d.alive||d.retreat)continue;if(!(d.tagged||reveal||(scan&&(scanObject?.obj===d||lineOfSight([player.x,player.y,player.z],[d.x,d.y,d.z])))))continue;draw(scanDeviceMesh,M.compose(d.x,d.y,d.z,d.yaw,0,0,1.55,.62,1.15),d.stun>0?[.4,.86,.9]:[1,.24,.37],scan?.66:d.tagged?.44:.3);}drawLayer=0;};

// ---- CLEAN FEED side gig (Jax). Three Vanta ad kiosks keep a face-cam cache of everyone on the
// street. Wipe them at the kiosk (hold Use) or from the scanner. Each pays; all three add evidence
// that opens a new way past Vale.
HACKS.wipe={name:'WIPE FACE-CAM CACHE',cost:2,time:1.0,trace:false,detail:'Deletes the resident face log on this ad kiosk. Covert. It counts toward the Clean Feed gig.'};
EVIDENCE.faceCam=['FACE-CAM LOG','Vanta’s street ad kiosks logged every face on Mercy Street and matched them to the clinic queue. The caches are wiped. The log proves the archive was still collecting.'];
{const md=devices.find(d=>d.id==='market-speaker');if(md)Object.assign(md,{adcam:true,ex:8.8,ey:2.54,ez:9.57,rot:0,wiped:false});}
devices.push(
 {id:'ad-mercy',name:'VANTA AD KIOSK / MERCY STREET',type:'distraction',adcam:true,x:-8.33,y:1.46,z:33.4,ex:-8.3,ey:2.48,ez:33.4,rot:Math.PI/2,active:true,tagged:false,detect:0,wiped:false},
 {id:'ad-relay',name:'VANTA AD KIOSK / RELAY 06',type:'distraction',adcam:true,x:8.33,y:1.46,z:-25.3,ex:8.3,ey:2.48,ez:-25.3,rot:-Math.PI/2,active:true,tagged:false,detect:0,wiped:false});
const adEyeMesh=new Batch();adEyeMesh.box(0,0,0,.2,.1,.05,'#ffffff',1.4);adEyeMesh.box(0,0,.03,.07,.07,.02,'#ffffff',2.2);adEyeMesh.upload();
function drawAdcams(){for(const d of devices){if(!d.adcam||Math.hypot(d.x-renderEye[0],d.z-renderEye[2])>70)continue;draw(adEyeMesh,M.compose(d.ex,d.ey,d.ez,d.rot),d.wiped?[.3,1.25,1.05]:[1.5,.28,.38]);}}
function wipedCount(){let n=0;for(const d of devices)if(d.adcam&&d.wiped)n++;return n;}
function discoverGig(how){if(social.flags.gigKnown)return;social.flags.gigKnown=true;socialEvent('gig-known','SIDE GIG / CLEAN FEED / WIPE THREE FACE-CAM CACHES',20);if(how==='scan')toast('FACE-CAM FOUND · SIDE GIG: CLEAN FEED · JOURNAL UPDATED');}
function wipeAdcam(d){if(!d||!d.adcam||d.wiped)return;discoverGig('wipe');d.wiped=true;const n=wipedCount();player.credits+=50;player.components+=3;Audio.hack();
 for(let i=0;i<14;i++)particle([d.ex+rr(-.25,.25),d.ey+rr(-.2,.2),d.ez+rr(-.25,.25)],[rr(-.8,.8),rr(.2,1.4),rr(-.8,.8)],'#7ff0e0',rr(.04,.1),rr(.3,.8),1);
 socialEvent('adcam-'+d.id,'FACE-CAM CACHE WIPED / '+n+' OF 3',50);toast('FACE-CAM CACHE WIPED · '+n+' / 3 · €$50 / 3 COMPONENTS');
 if(n>=3&&!social.flags.gigDone){social.flags.gigDone=true;player.credits+=150;learn('faceCam');rapport('jax','cleanfeed',2);socialEvent('gig-clean-feed','SIDE GIG COMPLETE / CLEAN FEED / €$150 FROM JAX',150);notice('SIDE GIG COMPLETE','CLEAN FEED','THREE CACHES WIPED / €$150 FROM JAX / FACE-CAM LOG ADDED',3.8);}}
function nearAdcam(){const fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw);for(const d of devices){if(!d.adcam||d.wiped)continue;const dx=d.x-player.x,dz=d.z-player.z,dist=Math.hypot(dx,dz);if(dist<1.9&&Math.abs(player.footY)<.6&&(dx*fx+dz*fz)/(dist||1)>.25)return d;}return null;}
let adWipe=null;
const v5Interactions=updateInteractions;
updateInteractions=function(dt){v5Interactions(dt);if(mode!=='playing'||scan||wheelOpen||interactable||stealth.carryId!==null){adWipe=null;return;}const d=nearAdcam();if(!d){adWipe=null;return;}
 interactable={type:'adcam',id:d.id};if(!adWipe||adWipe.id!==d.id)adWipe={id:d.id,t:0};showPrompt('HOLD TO WIPE FACE-CAM CACHE','SIDE GIG / CLEAN FEED / '+wipedCount()+' OF 3 WIPED',true);
 if(interactHeld())adWipe.t+=dt;else adWipe.t=0;$('action-progress').firstElementChild.style.width=clamp(adWipe.t/1.3*100,0,100)+'%';
 if(adWipe.t>=1.3){adWipe=null;interactLock=true;wipeAdcam(d);}};
const v5ScanActions=scanActions;
scanActions=function(t=scanObject){if(t?.kind==='drone')return t.obj.alive?['short','optics','ping']:[];const list=v5ScanActions(t);if(t?.kind==='device'&&t.obj.adcam&&!t.obj.wiped&&!list.includes('wipe'))return['wipe',...list];return list;};
const v5ApplyHack=applyHack;
applyHack=function(q,t){if(q.hack==='wipe'){stats.hacks++;wipeAdcam(t.obj);return;}
 if(t.kind==='drone'){const d=t.obj,h=HACKS[q.hack];stats.hacks++;Audio.hack();if(h.trace&&!traceAlarm){traceActive=true;trace=Math.max(5,trace);}
  if(q.hack==='short'){d.stun=3.8;damageDrone(d,45);}else if(q.hack==='optics')d.blind=8;else if(q.hack==='ping')revealUntil=elapsed+12;
  for(let i=0;i<12;i++)particle([d.x+rr(-.3,.3),d.y+rr(-.2,.2),d.z+rr(-.3,.3)],[rr(-1,1),rr(.2,2),rr(-1,1)],'#ed657f',rr(.04,.1),rr(.2,.6),1);toast(h.name+' · COMPLETE');return;}
 v5ApplyHack(q,t);};
const v5Scanner=renderScannerHUD;
renderScannerHUD=function(){v5Scanner();if(!scan)return;const t=scanObject;
 if(t?.kind==='drone'){const d=t.obj;$('scan-meta').textContent=Math.round(Math.hypot(d.x-player.x,d.y-player.y,d.z-player.z))+' METERS / AERIAL';$('scan-details').innerHTML='HEALTH '+Math.ceil(d.hp)+' / '+d.maxHp+'<br>VANTA WASP / ARMED DRONE<br>'+(d.stun>0?'SYSTEMS STUNNED':d.blind>0?'OPTICS OFFLINE':'HUNTING')+(d.tagged?'<br>TAGGED / TRACKING':'')+'<br>AN EMP BRINGS IT DOWN';}
 else if(t?.kind==='device'&&t.obj.adcam)$('scan-details').innerHTML=(t.obj.wiped?'CACHE WIPED / LENS DARK':'FACE-CAM ACTIVE / RECORDING RESIDENTS')+'<br>CLEAN FEED '+wipedCount()+' / 3'+(t.obj.wiped?'':'<br>WIPE HERE, OR HOLD F AT THE KIOSK');
 if(input.source!=='keyboard'){const sd=$('scan-details');sd.innerHTML=keyText(sd.innerHTML);const hd=$('hack-description');hd.textContent=keyText(hd.textContent);}};
const v5Jax=jaxDialogue;
jaxDialogue=function(n){
 const accept=()=>C('gigAccept','I will clean the feed. No one gets hurt.','facecam-ok',{hint:'SIDE GIG / €$150 when all three caches are wiped.',effect:()=>{discoverGig('talk');rapport('jax','gig');}});
 if(n==='facecam')return node(social.flags.gigDone?'You wiped all three. The street feed went dark at the same second the archive stopped matching faces to the clinic queue.\n\nThe money is in your account. The log of what they took is in your journal. Use it.':'Look above the screens. The ads sell noodles. The lens sells you. Every face on Mercy Street goes into a Vanta cache, matched against the clinic queue.\n\nThree kiosks: the vending wall in the market, the kiosk across from the clinic, and the one in front of the relay gate. Wipe the caches and I pay €$150. Work the kiosk by hand, or push a wipe from your scanner. Nobody gets hurt.',social.flags.gigDone?[back(),leave()]:[accept(),C('gigWhy','Why does a courier care about ad screens?','facecam-why'),back()]);
 if(n==='facecam-why')return node('Because couriers get stopped at gates. The gate asks the archive who you are, and the archive asks the ad screens where you have been.\n\nI do not want my face to be the reason a door closes on me.',[accept(),back()]);
 if(n==='facecam-ok')return node('Good. The screens stay on. Only the caches go. Vanta will call it a glitch.\n\nWhen all three are clean, I send the money and the log. Vale might like to see where his gate camera sends its pictures.',[back(),leave('I will start with the nearest kiosk.')]);
 const v=v5Jax(n);if(n==='root')v.choices.splice(v.choices.length-1,0,C('facecam',social.flags.gigDone?'The face-cam caches are clean.':'What else is Vanta collecting out here?','facecam'));return v;};
const v5Vale=valeDialogue;
valeDialogue=function(n){
 if(n==='facecam')return node('I sign that camera off every shift. I thought it counted visitors.\n\nIf it has been selling faces to the archive, then my gate log is evidence, not security. I can log you as the person who reported it. No bond. My name goes on the complaint next to yours.',[C('facecamPass','File the complaint. Log me as the one who reported it.','cleared',{commit:true,hint:'DEAL / Market access. No bond. Vale shares the risk.',effect:()=>{grantMarket('Face-cam privacy complaint');rapport('vale','facecam',2);}}),back()]);
 const v=v5Vale(n);if(n==='root'&&has('faceCam'))v.choices.splice(v.choices.length-1,0,C('facecam','Your gate camera feeds the same face cache as the ads.','facecam',{hint:'EVIDENCE / The Clean Feed log.'}));return v;};
const v5Field=renderField;
renderField=function(){v5Field();if(activePanel!=='journal'||!social.flags.gigKnown)return;const n=wipedCount();
 const where=devices.filter(d=>d.adcam).map(d=>`${d.wiped?'✓':'○'} ${d.id==='market-speaker'?'Market vending wall, east side':d.id==='ad-mercy'?'Mercy Street kiosk, across from the clinic':'Relay approach kiosk, east of the gate'}`).join('<br>');
 $('field-content').insertAdjacentHTML('afterbegin',`<section class="route-brief gig-brief"><div class="eyebrow">SIDE GIG / JAX WEI</div><h3>CLEAN FEED ${n} / 3${social.flags.gigDone?' / COMPLETE':''}</h3><p>Vanta’s ad kiosks keep a face-cam cache of everyone on the street. Stand at a kiosk and hold ${esc(pk('interact'))}, or scan it and upload WIPE FACE-CAM CACHE (2 RAM, covert).</p><p><b>${where}</b></p><p>${social.flags.gigDone?'Paid €$150. The face-cam log is in your evidence. Vale may want to see it.':'Each wipe pays €$50 and 3 components. Jax pays €$150 when the feed is clean.'}</p></section>`);};

// ---- World hooks: draw, update, reset.
const v5DrawWorld=drawWorld;drawWorld=function(vp,eye,reflect=false){v5DrawWorld(vp,eye,reflect);drawDrones();drawAdcams();};
const v5DrawMap=drawMap;
drawMap=function(){v5DrawMap();const gig=social.flags.gigKnown&&!social.flags.gigDone,live=drones.some(d=>d.alive&&!d.retreat);if(!gig&&!live)return;const w=466,h=326;
 map.save();map.translate(w/2,h*.58);map.rotate(-player.yaw);map.scale(10.7,10.7);map.translate(-player.x,-player.z);
 if(gig)for(const d of devices){if(!d.adcam||d.wiped)continue;map.fillStyle='#7ff0e0';map.fillRect(d.x-.28,d.z-.28,.56,.56);}
 for(const d of drones){if(!d.alive||d.retreat)continue;map.fillStyle=d.stun>0?'#65e7e9':'#ff8a6a';map.save();map.translate(d.x,d.z);map.rotate(-d.yaw);map.beginPath();map.moveTo(0,.42);map.lineTo(-.3,-.26);map.lineTo(.3,-.26);map.closePath();map.fill();map.restore();}
 map.restore();};
const v5Advance=advanceGame;
advanceGame=function(dt){v5Advance(dt);if(mode!=='playing')return;droneTriggers(dt);updateDrones(dt*(scan?.18:wheelOpen?.08:1));if(scan&&scanObject?.kind==='device'&&scanObject.obj.adcam)discoverGig('scan');};
const v5ResetWorld=resetWorld;
resetWorld=function(){v5ResetWorld();drones=[];droneDispatch={};pendingDrones=0;droneTimer=0;adWipe=null;for(const d of devices)if(d.adcam)d.wiped=false;};

// ---- Run records: best time, endings found, last result. Shown on the title and the result card.
const RECORD_KEY='record-v5',ALL_RANKS=['UNBROKEN SIGNAL','SIGNED CARGO','NAMES IN THE RAIN','HARD-WON ACCORD','BROKEN WORD','STREET OPERATOR','TRUE GHOST','SILENT HANDS','LOW SIGNAL'];
function readRecord(){const r=storage.get(RECORD_KEY);const o={runs:0,bestTime:0,ranks:[],last:null,...(r&&typeof r==='object'?r:{})};if(!Array.isArray(o.ranks))o.ranks=[];if(!Number.isFinite(o.bestTime))o.bestTime=0;return o;}
const fmtTime=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
function endingsFound(r){return r.ranks.filter(k=>ALL_RANKS.includes(k)).length;}
function renderMenuRecord(){const r=readRecord(),el=$('menu-record');if(!el)return;el.textContent=r.runs?`BEST TIME ${fmtTime(r.bestTime)}  ·  ENDINGS ${endingsFound(r)} / ${ALL_RANKS.length}  ·  LAST: ${r.last?.rank||'—'}`:'';}
const v5Win=win;
win=function(){if(mode!=='playing')return;v5Win();if(mode!=='won')return;const r=readRecord(),rank=$('rank-value').textContent,newBest=!r.bestTime||elapsed<r.bestTime;
 r.runs=(r.runs|0)+1;if(!r.ranks.includes(rank))r.ranks.push(rank);if(newBest)r.bestTime=elapsed;r.last={rank,time:elapsed,drones:stats.drones||0,gig:!!social.flags.gigDone};storage.set(RECORD_KEY,r);
 $('record-line').textContent=(newBest?'NEW BEST TIME ':'BEST TIME ')+fmtTime(r.bestTime)+'  ·  ENDINGS FOUND '+endingsFound(r)+' / '+ALL_RANKS.length+(stats.drones?'  ·  '+stats.drones+' DRONE'+(stats.drones>1?'S':'')+' DOWNED':'')+(social.flags.gigDone?'  ·  CLEAN FEED':'');
 renderMenuRecord();input.rumble(.3,160);};

// A read-only status report is available for browser diagnostics.
window.Datapunk=Object.freeze({version:'5.0.0',status:()=>({mode,stage,drones:drones.filter(d=>d.alive).length,cleanFeed:wipedCount(),backend:kit.backend,input:input.source,objective:objectiveData().title,zone:stealthZone(),stealth:{used:stealth.used,bridge:stealth.loopBridged,quietCore:stealth.quietCore,detections:stealth.detections,bodiesFound:stealth.bodiesFound,bodiesHidden:stealth.bodiesHidden,noise:stealth.noise,exposure:stealth.exposure,carrying:stealth.carryId!==null},health:player.hp,ammo:weapons[weaponIndex].ammo,scanner:scan,background:social.background,permits:{...social.permits},deal:social.deal,activeGuards:enemies.filter(e=>e.alive).length,frameRate:Math.round(1000/frameMS),audio:Audio.ctx?.state||'idle',errors:[...ERR]})});
// The optional developer hash is used only by the local test harness.
if(location.hash==='#dev')window.__DP={step(dt=1/60){time+=dt;frameNumber++;if(mode==='playing')advanceGame(dt);},updateHUD,updateUI,get stealth(){return stealth;},get stealthObjects(){return stealthObjects;},get patrols(){return servicePatrols;},throwBolt,actionDuration,nearStealthObject,hideSpots,beginGrapple,inCombat,moveEntity,updateDevices,updateNetwork,noticeNoise,beginSearch,alertEnemies,stealthAction,lowClearance,bodyAction,damageEnemy,queueHack,applyHack,visibilityAt,stealthZone,ghostReport,routePoints,objectiveData,render,get social(){return social;},get dialogue(){return dialogue;},get colliders(){return colliders;},get contacts(){return CONTACTS;},get interactable(){return interactable;},openDialogue,closeDialogue,selectChoice,dialogueNode,confirmProfile,renderProfile,neutralEnemy,canTalk,grantMarket,grantRelay,signDeal,endingData,validSave,makeSave,learn,get profile(){return{pick:profilePick,boost:profileBoost};},setProfile(id,boost){if(mode!=='profile'||!BACKGROUNDS[id])return false;profilePick=id;profileBoost={cool:0,intelligence:0,technical:0,body:0,...boost};renderProfile();return confirmProfile();},get systems(){return{scanLatched,scanObject,scanLock,hackSelected,hackQueue,trace,traceActive,traceAlarm,archiveUnlocked,archiveDoorLift,roomSeen,shardRead,holstered,wheelOpen,weaponIndex,grappleTarget,activePanel,devices};},takeCore,unlockArchive,scanActions,setScan,executeHack,tagTarget,jump,toggleCrouch,activateOverclock,openField,closeField,quickSave,quickLoad,completeGrapple,findScanObject,updateInteractions,updatePlayer,choosePerk,upgradeWeapon,switchWeapon,get grenades(){return grenades;},resetInputs,simulate(seconds){const n=Math.ceil(seconds*60);for(let i=0;i<n;i++){time+=1/60;frameNumber++;updateUI(1/60);if(mode==='playing')advanceGame(1/60);}updateHUD(0);return window.Datapunk.status();},get locked(){return locked;},get player(){return player;},get enemies(){return enemies;},get stats(){return stats;},get weapons(){return weapons;},get hack(){return hackState;},get stage(){return stage;},get mode(){return mode;},get supplies(){return supplies;},get barrels(){return barrels;},get gateLift(){return gateLift;},get extraction(){return extraction;},get scan(){return scan;},get target(){return scanTarget;},get checkpoint(){return checkpoint;},teleport(x,z,yaw=0,pitch=0){player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch;player.footY=0;player.vy=0;player.y=1.68;player.grounded=true;},start:startGame,finishHack,chooseCode,openHack,interact,fire,reload,hurtPlayer,quickhack,throwEMP,medpatch,dash,melee,saveCheckpoint,restoreCheckpoint,pauseGame,resumeGame,updateEnemies,blocked,wallRay,settings,kit};
resetWorld();syncSettings();checkContinue();applyPrompts();renderMenuRecord();
kit.loading.progress(.92,'Compiling shaders…');
// Build every pipeline before the first frame: the street, the weapon layer, outlines and effects.
{beginDraw();drawWorld(null,renderEye);drawLayer=1;draw(rifleMesh);draw(handMesh);drawLayer=2;draw(scanEnemyMesh,IDENTITY,[1,.24,.37],.5);drawLayer=0;particle([0,1,0],[0,0,0],'#ffffff',.1,.05);tracer([0,1,0],[0,2,0]);drawFX();
 try{await renderer.compileAsync(scene,camera);await renderer.compileAsync(viewScene,camera);}catch(err){console.warn('Datapunk: pipeline warm-up skipped',err);}
 endDraw();effects.length=0;tracers.length=0;}
setVisible('menu',true);focusDefault($('continue-btn').classList.contains('hidden')?$('start-btn'):$('continue-btn'));
kit.onPause(p=>{if(!Audio.ctx)return;if(p)Audio.ctx.suspend?.();else if(Audio.started)Audio.ctx.resume?.();});
kit.start(frame);
