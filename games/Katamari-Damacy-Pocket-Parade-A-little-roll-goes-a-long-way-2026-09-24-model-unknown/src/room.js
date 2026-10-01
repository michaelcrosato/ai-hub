// Pocket Parade. The sunny-side room: floor, mats, rug, walls, window, cabinet, bookshelf,
// the tea table and its ruler ramp, plus the ground rules (terrain heights, obstacles and
// clear spots) the game logic uses. Textures are painted on canvases; render.js uploads them.
import { Builder, compose, Q, PI, TAU, clamp } from './geometry.js';
import { P, colors } from './models.js';

export const ROOM = { minX: -18, maxX: 18, minZ: -16, maxZ: 16 }, TABLE = { x: 7, z: -6.9, w: 9.5, d: 6.8, y: 4 };
export const envMeshes = [], staticModels = [], obstacles = [];
export let shadowTex = null, markerMesh = null;
function obstacle(x, z, w, d, lo, hi) { obstacles.push({ x, z, w, d, lo, hi }); }
function paint(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }

export function initRoom() {
const C = colors;
let b = new Builder();
const weave=paint(128,128,(c,w,h)=>{c.fillStyle='#eeeddc';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=4){c.fillStyle=y%8?'#e6e6d2':'#f3f0dc';c.fillRect(0,y,w,2);for(let x=0;x<w;x+=8){c.fillStyle=((x+y)%16)?'rgba(100,115,74,.09)':'rgba(255,255,238,.3)';c.fillRect(x+(y%8?3:0),y,1,3)}}});
const wood=paint(128,128,(c,w,h)=>{c.fillStyle='#d8c3a5';c.fillRect(0,0,w,h);for(let y=0;y<128;y+=3){c.strokeStyle=`rgba(104,81,54,${.018+(y%7)*.005})`;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(34,y+4,76,y-2,128,y+1);c.stroke()}});
let woodFloor=new Builder();woodFloor.quad([-18,-.02,16],[18,-.02,16],[18,-.02,-16],[-18,-.02,-16],'#ba9670',[0,1,0],[[0,0],[9,0],[9,8],[0,8]]);envMeshes.push(woodFloor.build({tex:wood}));
for(let x=-18;x<18;x+=2)b.box('#9b7d60',[x,-.014,0],[.023,.014,32]);for(let z=-16;z<16;z+=4)b.box('#ae8c66',[0,-.010,z],[36,.014,.027]);
let mats=new Builder();for(let ix=0;ix<5;ix++)for(let iz=0;iz<4;iz++){let x=-12+ix*6,z=-10.5+iz*7,col=(ix+iz)%2?'#e4dfb2':'#dbd9ad',u=(ix+iz)%2;let uv=u?[[0,0],[0,12],[14,12],[14,0]]:[[0,0],[12,0],[12,14],[0,14]];mats.quad([x-2.94,.008,z+3.44],[x+2.94,.008,z+3.44],[x+2.94,.008,z-3.44],[x-2.94,.008,z-3.44],col,[0,1,0],uv);for(let dx of[-3,3])b.box('#7e9e87',[x+dx,.026,z],[.115,.05,7]);for(let dz of[-3.5,3.5])b.box('#8aab91',[x,.027,z+dz],[6,.05,.115]);}
envMeshes.push(mats.build({tex:weave}));
// A woven rug gives the center of the room a warm patch of color.
let rugTex=paint(128,128,(c,w,h)=>{c.fillStyle='#edc1b4';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=3){c.fillStyle=y%9?'rgba(141,84,76,.08)':'rgba(255,239,209,.15)';c.fillRect(0,y,w,1)}for(let x=0;x<w;x+=4){c.fillStyle='rgba(130,86,76,.04)';c.fillRect(x,0,1,h)}});
let rug=new Builder();rug.quad([-6.6,.063,.9],[2.4,.063,.9],[2.4,.063,-7.7],[-6.6,.063,-7.7],'#e6a492',[0,1,0],[[0,0],[8,0],[8,8],[0,8]]);envMeshes.push(rug.build({tex:rugTex}));
for(let x=-6.4;x<2.3;x+=.24){b.box('#f0d1ad',[x,.065,1.04],[.06,.025,.37]).box('#f0d1ad',[x,.065,-7.84],[.06,.025,.37]);}for(let x=-6.25;x<2.1;x+=.34){b.box('#f3c8a6',[x,.08,.58],[.17,.017,.044]).box('#f3c8a6',[x,.08,-7.36],[.17,.017,.044]);}for(let z=-7.2;z<.5;z+=.34){b.box('#f3c8a6',[-6.3,.08,z],[.045,.017,.17]).box('#f3c8a6',[2.1,.08,z],[.045,.017,.17]);}
// Walls and warm timber. There is no front wall to block the view.
b.box('#adc3ae',[0,5.45,-16.2],[36.6,11.1,.42]);b.box('#a5bdad',[-18.2,5.45,0],[.42,11.1,32.3]);b.box('#bdcdb5',[18.2,5.45,-4],[.42,11.1,24.3]);
b.box('#927454',[0,.34,-15.89],[36,.68,.21]).box('#8f7356',[-17.89,.34,0],[.21,.68,32]).box('#a08361',[17.89,.34,-4],[.21,.68,24]);
for(let x of[-18,-2,7,18])b.box('#9e805e',[x,5.5,-15.91],[.24,11,.22]);b.box('#9c805f',[0,10.6,-15.91],[36,.28,.24]);for(let z of[-16,-6,4,14])b.box('#9c805f',[-17.9,5.5,z],[.23,11,.23]);b.box('#987d5c',[-17.88,10.6,0],[.22,.28,32]);
// The paper window: soft garden colors behind a wooden grid.
const paperTex=paint(512,512,(c,w,h)=>{let g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f6f0d6');g.addColorStop(.7,'#e7e7c8');g.addColorStop(1,'#cbd8b2');c.fillStyle=g;c.fillRect(0,0,w,h);c.filter='blur(24px)';c.fillStyle='rgba(128,160,115,.22)';for(let i=0;i<6;i++){c.beginPath();c.arc(i*110-30,510-i%2*45,110,0,TAU);c.fill()}c.filter='none';});
let win=new Builder();win.quad([-16.55,1.3,-15.945],[-2.7,1.3,-15.945],[-2.7,9.62,-15.945],[-16.55,9.62,-15.945],'#ffffff',[0,0,1]);envMeshes.push(win.build({tex:paperTex,unlit:true}));
for(let x of[-16.6,-9.65,-2.7])b.box('#967e5b',[x,5.46,-15.79],[.22,8.5,.22]);for(let x=-16.6;x<=-2.6;x+=1.73)b.box('#b19b73',[x,5.46,-15.79],[.085,8.4,.13]);for(let y=1.3;y<9.7;y+=1.39)b.box('#b19b73',[-9.65,y,-15.78],[14,.085,.14]);b.box('#9b805d',[-9.65,1.26,-15.72],[14.2,.17,.3]).box('#9b805d',[-9.65,9.67,-15.72],[14.2,.17,.3]);
// A high side window fills the scene with warm squares of light.
b.box('#e5e7c8',[17.94,6.3,2],[.065,6.6,9]);for(let z=-2.5;z<=6.6;z+=1.5)b.box('#ac9775',[17.83,6.3,z],[.19,6.7,.09]);for(let y=3;y<=9.7;y+=1.65)b.box('#ac9775',[17.82,y,2],[.2,.1,9.1]);
// Back cabinet, doors, and recessed little handles.
b.box('#749994',[12.6,3.1,-14],[8.25,6.2,2.8]);b.box('#9cbaa6',[12.6,6.26,-14],[8.6,.23,3.03]);b.box('#668b84',[12.6,.25,-14],[8.25,.5,2.8]);for(let x of[10.62,14.60]){b.box('#c1c7a2',[x,3.25,-12.54],[3.72,5.52,.16]);b.box('#abb796',[x,3.25,-12.43],[3.47,5.24,.08]);for(let y of[1,3.25,5.5])b.box('#b9c39f',[x,y,-12.36],[3.5,.072,.09]);}b.box('#71968b',[12.56,3.08,-12.25],[.10,.73,.055]);obstacle(12.6,-14,8.25,2.9,0,6.5);
// Books on the cabinet, a little bowl, and a flower in a vase.
for(let i=0;i<5;i++){let x=10+i*.46,h=1.1+(i%3)*.3;b.box(['#e7c888','#cc9290','#a7b89b','#d7bf87','#839e9e'][i],[x,6.45+h/2,-14],[.36,h,1.07],[0,0,i===4?-.09:0]);b.box('#e9dfb8',[x,6.53+h/2,-13.45],[.25,h-.23,.014]);}
b.cyl('#dcb38d',[14.4,6.54,-13.8],.66,.50,.28,[],14).cyl('#e9cb9d',[14.4,6.69,-13.8],.61,.61,.016,[],14);b.sphere('#d8a161',[14.25,6.86,-13.8],.3).sphere('#deac69',[14.68,6.87,-13.9],.29);
b.cyl('#e8c8a1',[16.1,6.82,-14],.26,.38,1.1,[],12).cyl('#75966b',[16.1,7.65,-14],.025,.035,.9,[],6);for(let i=0;i<6;i++){let a=i/6*TAU;b.sphere('#de8b8a',[16.1+Math.sin(a)*.27,8.12+Math.cos(a)*.27,-14],[.18,.18,.065]);}b.sphere('#e5bc62',[16.1,8.12,-13.95],[.14,.14,.05]);
// Low bookshelf at the left: a large, clear obstacle with color along its spine.
b.box('#bf936e',[-14.6,2.0,-12.7],[4.5,4,2.05]);b.box('#d4b08a',[-14.6,4.08,-12.7],[4.75,.18,2.3]);for(let y of[.3,2.12]){b.box('#997653',[-14.6,y+.70,-11.655],[3.98,1.40,.07]);for(let i=0;i<8;i++){let h=.86+(i%4)*.15,x=-16.26+i*.47;b.box(['#aaba9a','#da9d84','#719b98','#d5bf88'][i%4],[x,y+h/2,-11.53],[.36,h,.55]);b.box('#ebdfb8',[x,y+h*.64,-11.244],[.26,.04,.023]);}b.box('#bd9069',[-14.6,y+1.54,-11.53],[4.45,.15,.64]);}obstacle(-14.6,-12.7,4.55,2.1,0,4.2);
staticModels.push({p:P.clock,mat:compose([-14.9,4.85,-12.4],Q.euler(0,.1,0),[.85,.85,.85])});
// Low tea table. The space below remains open while the player is small.
b.box('#c3956e',[7,3.78,-6.9],[9.5,.44,6.8]).box('#e6c394',[7,4.01,-6.9],[9.57,.09,6.85]);for(let x of[2.65,11.35])for(let z of[-9.92,-3.89]){b.box('#a67e5d',[x,1.8,z],[.54,3.6,.54]);obstacle(x,z,.60,.60,0,3.75)}obstacle(7,-6.9,9.5,6.8,3.56,4.08);
b.box('#ced0a1',[9.9,4.071,-6.9],[1.85,.025,6.78]);for(let z=-10.2;z<-3.6;z+=.33){b.box('#8ba186',[9.14,4.088,z],[.035,.012,.15]).box('#8ba186',[10.65,4.088,z],[.035,.012,.15]);}
// A giant ruler is the ramp. Its marks follow the slope, not the floor.
let angle=Math.atan2(4,8.2),len=Math.hypot(4,8.2);b.box('#d6b475',[7,1.99,.6],[3.4,.15,len],[angle,0,0]);for(let i=0;i<33;i++){let z=4.7-i*8.2/32,y=(4.7-z)/8.2*4;let tick=i%4===0?.78:i%2===0?.5:.31;b.box('#937e51',[5.37+tick/2,y+.083,z],[tick,.016,.035],[angle,0,0]);}for(let z of[-3.15,4.32]){let y=(4.7-z)/8.2*4;b.box('#d99883',[7,y+.092,z],[3.35,.022,.19],[angle,0,0]);}
// Quiet room details: a socket, little frames, a wall shelf, paper mobile.
b.box('#e9ddbd',[-17.86,1.37,7.4],[.12,.83,.65]);for(let z of[7.24,7.53])b.box('#9b9e7f',[-17.78,1.42,z],[.04,.23,.057]);
b.box('#b99a75',[-16.78,5.20,-3],[2.1,.22,5.7]);for(let z of[-4.9,-1.1])b.box('#9c8565',[-17.19,4.78,z],[1.1,.7,.13],[0,0,-.45]);for(let z of[-4.1,-2.5]){b.cyl('#d3b28e',[-16.67,5.65,z],.31,.38,.70,[],10).sphere('#88a77d',[-16.67,6.30,z],[.49,.48,.49]);}
let postTex=paint(256,384,(c,w,h)=>{c.fillStyle='#f2e4bc';c.fillRect(0,0,w,h);c.fillStyle='#d8997b';c.beginPath();c.arc(128,114,76,0,TAU);c.fill();c.fillStyle='#f4dda5';for(let i=0;i<8;i++){let a=i*PI/4;c.beginPath();c.ellipse(128+Math.sin(a)*37,111+Math.cos(a)*37,19,32,-a,0,TAU);c.fill()}c.fillStyle='#657d62';c.beginPath();c.arc(128,113,32,0,TAU);c.fill();c.fillStyle='#f3e2b2';c.beginPath();c.arc(116,109,3,0,TAU);c.arc(140,109,3,0,TAU);c.fill();c.strokeStyle='#f3e2b2';c.lineWidth=3;c.beginPath();c.arc(128,119,12,0,PI);c.stroke();c.fillStyle='#506e57';c.font='bold 41px Arial';c.textAlign='center';c.fillText('SMALL',128,253);c.fillText('IS BIG.',128,302);c.font='12px Arial';c.fillText('A LITTLE MORE EVERY DAY',128,347);});let poster=new Builder();poster.quad([-.45,3.35,-15.81],[3.75,3.35,-15.81],[3.75,9.65,-15.81],[-.45,9.65,-15.81],'#ffffff',[0,0,1]);envMeshes.push(poster.build({tex:postTex}));for(let x of[-.52,3.82])b.box('#90775c',[x,6.5,-15.74],[.13,6.47,.15]);for(let y of[3.29,9.72])b.box('#90775c',[1.65,y,-15.74],[4.47,.13,.15]);
for(let i=0;i<3;i++){let x=-5.8+i*1.35,y=8.2-(i%2)*.85;b.box('#b6ae87',[x,(y+10.4)/2,-10.5],[.019,10.4-y,.019]);b.star(['#e3b573','#dca6aa','#a4bf93'][i],[x,y,-10.5],.65,[0,-.2+i*.15,.1]);}
envMeshes.push(b.build());
// Soft shadows and a patch of sunlight are built in, with no image files.
shadowTex=paint(128,128,(c,w,h)=>{let g=c.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.38,'rgba(255,255,255,.50)');g.addColorStop(.75,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
let sh=new Builder();shadowQuad(sh,7.25,-6.2,.074,6.4,4.5,.35);shadowQuad(sh,12.5,-12.1,.071,5.7,3,.28);shadowQuad(sh,-14.0,-11.0,.071,3.8,2.7,.25);shadowQuad(sh,-16,-3,.071,2,4,.15);envMeshes.push(sh.build({tex:shadowTex,transparent:true,unlit:true,doubleSided:true}));
// The patch is wound facing down, so the old renderer culled it away; double-sided, it shows.
let sun=new Builder();sun.quad([-14,.082,-13],[.1,.082,-8],[3.5,.082,3.5],[-10,.082,-1.8],[1,.96,.77,.10],[0,1,0]);envMeshes.push(sun.build({transparent:true,unlit:true,doubleSided:true}));
// The ring under each golden wish.
const mk = new Builder(), n = 40;
for (let i = 0; i < n; i++) { const a = i / n * TAU, d = (i + 1) / n * TAU; mk.quad([Math.cos(a), 0, Math.sin(a)], [Math.cos(d), 0, Math.sin(d)], [Math.cos(d) * .94, 0, Math.sin(d) * .94], [Math.cos(a) * .94, 0, Math.sin(a) * .94], [1, .94, .68, .58], [0, 1, 0]); }
markerMesh = mk.build({ transparent: true, unlit: true, doubleSided: true });
}

export function shadowQuad(b, x, z, y, rx, rz, alpha = .2) { b.quad([x - rx, y, z + rz], [x + rx, y, z + rz], [x + rx, y, z - rz], [x - rx, y, z - rz], [.22, .31, .24, alpha], [0, 1, 0]); }
export function rugHeight(x, z) { return x > -6.6 && x < 2.4 && z > -7.7 && z < .9 ? .068 : .032; }
export function inTable(x, z) { return Math.abs(x - 7) < 4.75 && Math.abs(z + 6.9) < 3.4; }
export function inRamp(x, z, margin = 0) { return Math.abs(x - 7) < 1.7 - margin && z >= -3.56 && z <= 4.77; }
export function terrain(x, z, previous = 0) { if (inRamp(x, z)) return clamp((4.7 - z) / 8.2 * 4, 0, 4.05); if (inTable(x, z) && previous > 3.32) return 4.065; return 0; }
/** True when an item of footprint `rad` can sit on the floor here: inside the walls, off the ramp, the start spot and the furniture. */
export function clearSpot(x, z, rad = .4) {
  if (Math.hypot(x + 7, z - 9) < 1.25 + rad) return false;
  if (x < -16.6 + rad || x > 16.6 - rad || z < -14.6 + rad || z > 14.6 - rad) return false;
  if (Math.abs(x - 7) < 2.15 + rad && z > -3.5 && z < 5.1) return false;
  for (const o of obstacles) { if (o.lo > .25) continue; if (Math.abs(x - o.x) < o.w / 2 + rad * .8 && Math.abs(z - o.z) < o.d / 2 + rad * .8) return false; }
  return true;
}
