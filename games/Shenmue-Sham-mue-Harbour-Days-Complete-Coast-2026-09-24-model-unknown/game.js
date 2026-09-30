/* Sham-mue: Harbour Days · Complete Coast — story, work, collection and menus.
   Rendering runs on the shared 3D kit (three.js r186: WebGPU with a WebGL2 fallback); see render.js.
   All input arrives as kit.input actions (keyboard and mouse, gamepad, touch); see pumpInput(). */
import { boot as kitBoot } from 'kit/boot.js';
import { MeshBuilder, hex, createRenderEngine, ATLAS_COLS, ATLAS_ROWS, TILE } from './render.js';

const kit=await kitBoot({
 title:'Sham-mue — Harbour Days',
 gear:'none', // the game's own pause menu opens the kit settings (and F9 does)
 holdLoading:true,
 accent:'#d3b679',
 background:'#20383b',
 canvas:document.getElementById('scene'),
 touch:{top:'right',topOffset:innerWidth<760?104:136},
 input:{
  move:{type:'vector',keys:'wasd+arrows',gamepad:'leftStick+dpad',touch:'stick'},
  look:{type:'look',mouse:'drag',gamepad:'rightStick',touch:'drag'},
  use:{keys:['KeyE','Enter'],gamepad:['A'],touch:'E'},
  run:{keys:['ShiftLeft','ShiftRight'],gamepad:['B'],touch:'Run'},
  guard:{keys:['Space'],gamepad:['LT'],touch:'Guard'},
  kick:{keys:['KeyK'],touch:'Kick'},
  forkUp:{keys:['KeyQ'],gamepad:['RB'],touch:'Raise'},
  forkDown:{keys:['KeyZ'],gamepad:['LB'],touch:'Lower'},
  punch:{keys:['KeyJ']},
  evade:{keys:['KeyL']},
  padX:{gamepad:['X']},
  padY:{gamepad:['Y']},
  back:{gamepad:['B']},
  camera:{keys:['KeyC'],gamepad:['RS'],touch:{label:'Cab',slot:'top'}},
  horn:{keys:['KeyH'],gamepad:['LS']},
  exit:{keys:['KeyX'],touch:{label:'Out',slot:'top'}},
  recover:{keys:['KeyR'],touch:{label:'Recover',slot:'top'}},
  sheet:{gamepad:['Back'],touch:{label:'Sheet',slot:'top'}},
  notebook:{keys:['KeyN','Tab'],touch:{label:'Notes',slot:'top'}},
  pause:{keys:['Escape','KeyP'],gamepad:['Start'],touch:{label:'II',slot:'top'}},
  mute:{keys:['KeyM']},
  full:{keys:['KeyF']},
  choice1:{keys:['Digit1']},choice2:{keys:['Digit2']},choice3:{keys:['Digit3']},choice4:{keys:['Digit4']}
 }
});
kit.loading.progress(.62,'Painting the harbour…');
await new Promise(r=>setTimeout(r,30));

const PI=Math.PI,TAU=PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t;
const V=(x=0,y=0,z=0)=>[x,y,z], add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]), mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),angdiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
let seed=84171; function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
class Atlas{
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=ATLAS_COLS*TILE;this.canvas.height=ATLAS_ROWS*TILE;this.ctx=this.canvas.getContext('2d');this.index=0;this.names={};}
 tile(name,fn){let i=this.index++,x=(i%ATLAS_COLS)*TILE,y=Math.floor(i/ATLAS_COLS)*TILE;if(i>=ATLAS_COLS*ATLAS_ROWS)throw Error('Texture atlas full');let c=document.createElement('canvas');c.width=c.height=256;let ctx=c.getContext('2d');fn(ctx);this.ctx.drawImage(c,x,y);this.names[name]=i;return i;}
 texture(name,base,style){return this.tile(name,c=>{c.fillStyle=base;c.fillRect(0,0,256,256);for(let i=0;i<7500;i++){let k=rand();c.fillStyle=k>.5?'rgba(255,255,235,'+(rand()*.14)+')':'rgba(10,20,22,'+(rand()*.18)+')';let s=style==='concrete'?rand()*3+1:1+rand()*2;c.fillRect(rand()*256,rand()*256,s,s);}if(style==='metal'){for(let x=0;x<256;x+=16){c.fillStyle='rgba(10,24,28,.23)';c.fillRect(x,0,3,256);c.fillStyle='rgba(240,250,230,.16)';c.fillRect(x+3,0,3,256);}for(let i=0;i<40;i++){c.fillStyle='rgba(88,43,20,.15)';c.fillRect(rand()*256,180+rand()*76,rand()*9,rand()*70);}}if(style==='wood'){for(let x=0;x<256;x+=32){c.fillStyle='rgba(25,15,10,.4)';c.fillRect(x,0,2,256);}for(let i=0;i<250;i++){c.strokeStyle='rgba(45,26,12,.2)';c.beginPath();let x=rand()*256,y=rand()*256;c.moveTo(x,y);c.bezierCurveTo(x+4,y+20,x-4,y+30,x+1,y+50);c.stroke();}}if(style==='brick'){for(let y=0;y<256;y+=32){c.fillStyle='rgba(25,23,20,.4)';c.fillRect(0,y,256,2);for(let x=(y%64?16:0);x<256;x+=64)c.fillRect(x,y,2,32);}}});}
 sign(name,text,bg='#1d393c',fg='#e8e2cb',subtext='',size=45){return this.tile(name,c=>{c.fillStyle=bg;c.fillRect(0,0,256,256);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(9,12,238,232);c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.font='bold '+size+'px sans-serif';let lines=text.split('\n');lines.forEach((l,i)=>c.fillText(l,128,110+(i-(lines.length-1)/2)*58,223));if(subtext){c.font='18px sans-serif';c.fillText(subtext,128,202,220);}for(let i=0;i<150;i++){c.fillStyle='rgba(235,220,190,.07)';c.fillRect(rand()*256,rand()*256,rand()*18,rand()*3);}});}
}

const atlas=new Atlas();
const T={};
T.white=atlas.tile('white',c=>{c.fillStyle='#fff';c.fillRect(0,0,256,256);});
T.concrete=atlas.texture('concrete','#a6a797','concrete');
T.asphalt=atlas.texture('asphalt','#727c78','concrete');
T.metal=atlas.texture('metal','#bdc1af','metal');
T.roof=atlas.texture('roof','#526766','metal');
T.wood=atlas.texture('wood','#9a8059','wood');
T.brick=atlas.texture('brick','#8a6450','brick');
T.paint=atlas.texture('paint','#d8d4b9','concrete');
T.cloth=atlas.texture('cloth','#dbd9cf','cloth');
T.skin=atlas.texture('skin','#efc7a2','skin');
T.water=atlas.texture('water','#41676a','water');
T.glass=atlas.tile('glass',c=>{let g=c.createLinearGradient(0,0,256,256);g.addColorStop(0,'#96b7b8');g.addColorStop(.5,'#58767a');g.addColorStop(1,'#2d484e');c.fillStyle=g;c.fillRect(0,0,256,256);c.fillStyle='#bdd2ce44';c.beginPath();c.moveTo(30,0);c.lineTo(84,0);c.lineTo(226,256);c.lineTo(172,256);c.fill();});
T.windows=atlas.tile('windows',c=>{c.fillStyle='#384f52';c.fillRect(0,0,256,256);for(let x=0;x<256;x+=64){c.fillStyle='#778f8a';c.fillRect(x+5,7,53,115);c.fillStyle='#aeb8a277';c.fillRect(x+8,9,8,110);c.fillStyle='#4c6364';c.fillRect(x+5,130,53,119);}c.fillStyle='#727968';c.fillRect(0,122,256,8);for(let i=0;i<80;i++){c.fillStyle='#94846122';c.fillRect(rand()*256,rand()*256,rand()*25,rand()*70);}});
T.shutter=atlas.tile('shutter',c=>{c.fillStyle='#526866';c.fillRect(0,0,256,256);for(let y=0;y<256;y+=10){c.fillStyle='#293e3b';c.fillRect(0,y,256,2);c.fillStyle='#a9b8a366';c.fillRect(0,y+2,256,2);}for(let i=0;i<400;i++){c.fillStyle='#75604433';c.fillRect(rand()*256,200+rand()*56,rand()*9,rand()*50);}});
T.hazard=atlas.tile('hazard',c=>{c.fillStyle='#d1b55c';c.fillRect(0,0,256,256);c.fillStyle='#323d39';for(let x=-256;x<512;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x+32,0);c.lineTo(x+288,256);c.lineTo(x+256,256);c.fill();}});
function board(name,text,aspect=3,bg='#244849',fg='#e4ddbb',subtext=''){
 return atlas.tile(name,c=>{let w=600,h=w/aspect;c.scale(256/w,256/h);c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=fg;c.lineWidth=2;c.strokeRect(8,8,w-16,h-16);c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;let ls=text.split('\n'),fs=Math.min(h*.50/ls.length,500/Math.max(...ls.map(l=>l.length)) *1.55);c.font='bold '+fs+'px sans-serif';ls.forEach((l,i)=>c.fillText(l,w/2,h*(subtext?.40:.50)+(i-(ls.length-1)/2)*fs*1.2,w-36));if(subtext){c.font=Math.min(23,h*.17)+'px sans-serif';c.fillText(subtext,w/2,h*.78,w-32);}for(let i=0;i<100;i++){c.fillStyle='rgba(217,204,166,.10)';c.fillRect(rand()*w,rand()*h,rand()*12,rand()*3);}});
}
T.wh1=board('WH 01','01',1,'#c6c7b3','#244449','WAREHOUSE');
T.wh3=board('WH 03','03',1,'#c6c7b3','#244449','WAREHOUSE');
T.wh8=board('WH 08','08',1,'#b0b8a9','#253f41','WAREHOUSE');
T.tea=board('tea','BREAKWATER TEA',5,'#263e39','#efdbaf','HOT TEA   ·   LUNCH   ·   SINCE 1962');
T.drink=board('drink','SUN POP',2,'#a4382d','#ffe6b5','COLD DRINKS  /  ¥100');
T.darts=board('darts','LUCKY DARTS',2,'#b17836','#f4e5bb','THREE THROWS · ¥50');
T.freight=board('freight','FREIGHT OFFICE',3,'#234c57','#dfdfbd','MANIFESTS · DAILY SCHEDULE');
T.bus=board('bus','NAGAMATSU',3,'#d6dbc4','#29474b','HARBOUR  /  TERMINUS');
T.storage=board('storage','KITA SHIPPING',4,'#365863','#e1d8b8','INTERNATIONAL FREIGHT');
T.safety=board('safety','SAFETY\nFIRST',1,'#d8d9b8','#244a41','KEEP CLEAR');
T.capsule=board('capsule','POCKET\nPORT',1,'#d1ae5f','#5b4538','CAPSULE TOYS · ¥100');
T.gate=board('gate','NAGAMATSU HARBOUR',6,'#194348','#e5d6a6','EAST GATE   /   AUTHORIZED VEHICLES ONLY');
T.tag=board('tag','KITA / 08',2,'#d8c99b','#354543','HANDLE WITH CARE');
T.five=board('five','05',1,'#1c3638','#e8e1b9');
T.menu=board('menu','TEA  ¥80\nFISH BUN  ¥80\nLUNCH  ¥350',.8,'#eee4c5','#314444');
T.notice=atlas.tile('notice',c=>{c.fillStyle='#37534e';c.fillRect(0,0,256,256);for(let i=0;i<6;i++){let x=12+(i%3)*80,y=12+Math.floor(i/3)*118;c.fillStyle=i===1?'#eddfa7':'#d3cdb1';c.fillRect(x,y,71,107);c.fillStyle='#5b6d68';c.fillRect(x+7,y+10,57,6);for(let a=0;a<8;a++)c.fillRect(x+7,y+26+a*8,35+rand()*22,2);c.fillStyle='#a24b3d';c.beginPath();c.arc(x+53,y+86,9,0,TAU);c.strokeStyle='#a24b3d';c.stroke();}});
T.patch=atlas.tile('patch',c=>{c.fillStyle='#624533';c.fillRect(0,0,256,256);c.strokeStyle='#c9ba8d';c.lineWidth=3;c.beginPath();c.arc(128,122,100,0,TAU);c.stroke();c.lineWidth=6;c.beginPath();c.moveTo(32,104);c.quadraticCurveTo(82,48,126,115);c.quadraticCurveTo(172,47,224,100);c.quadraticCurveTo(170,82,145,142);c.lineTo(173,202);c.lineTo(128,175);c.lineTo(88,202);c.lineTo(110,140);c.quadraticCurveTo(79,84,32,104);c.stroke();c.font='bold 18px serif';c.textAlign='center';c.fillText('KISARAGI',128,232);});
T.face=atlas.tile('face',c=>{c.fillStyle='#d6aa89';c.fillRect(0,0,256,256);let g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'#8b694933');g.addColorStop(.5,'#e5b89522');g.addColorStop(1,'#62452e44');c.fillStyle=g;c.fillRect(0,0,256,256);c.fillStyle='#2d2c28';c.fillRect(43,78,52,9);c.fillRect(161,78,52,9);c.fillStyle='#f1dec5';c.fillRect(47,94,44,13);c.fillRect(165,94,44,13);c.fillStyle='#232d2d';c.fillRect(62,92,14,18);c.fillRect(178,92,14,18);c.fillStyle='#ad7a5c';c.beginPath();c.moveTo(126,112);c.lineTo(113,153);c.lineTo(140,156);c.fill();c.fillStyle='#895e4a';c.fillRect(95,190,65,4);c.fillStyle='#e8bea0';c.fillRect(108,195,42,3);});
T.lantern=board('lantern','港\n茶',.6,'#d2a75d','#672e24');
T.arrow=board('arrow','↑',1,'#bbab67','#3a4843');
T.poster=board('poster','THE BLUE\nHORIZON',.75,'#386873','#eee1b8','KOBE · DAILY FERRY');
T.door=board('door','OFFICE',2,'#315052','#d9d5b4');
const obstacles=[];const obstacle=(x,z,w,d,id='')=>obstacles.push({x,z,w,d,id});
let S=new MeshBuilder(1<<17);
function box(x,y,z,w,h,d,tx,col='#fff',tile=0){S.box(x,y,z,w,h,d,tx,col,tile);}
function label(x,y,z,w,h,tx,yaw=0,col='#ffffff'){S.plane(x,y,z,w,h,tx,col,yaw);}
function groundRect(x,z,w,d,col,y=.025,tx=T.white){S.push(x,y,z).rotateX(-PI/2);if(tx===T.asphalt||tx===T.concrete)S.quad([-w/2,-d/2,0],[w/2,-d/2,0],[w/2,d/2,0],[-w/2,d/2,0],tx,col,w/3,d/3);else S.plane(0,0,0,w,d,tx,col);S.pop();}
function warehouse(x,z,num,w=18,d=20,h=7.2){
 obstacle(x,z,w,d,'warehouse');box(x, h/2,z,w,h,d,T.metal,'#d6d8c5',4);box(x,.22,z,w+.25,.44,d+.25,T.concrete,'#8c9183',2);
 S.quad([x-w/2-.5,h,z+d/2+.5],[x,h+2.4,z+d/2+.5],[x,h+2.4,z-d/2-.5],[x-w/2-.5,h,z-d/2-.5],T.roof,'#d4d5c2',4,7);
 S.quad([x,h+2.4,z+d/2+.5],[x+w/2+.5,h,z+d/2+.5],[x+w/2+.5,h,z-d/2-.5],[x,h+2.4,z-d/2-.5],T.roof,'#c0c8b9',4,7);
 S.tri([x-w/2,h,z+d/2],[x+w/2,h,z+d/2],[x,h+2.4,z+d/2],T.metal,'#c8cebd');S.tri([x+w/2,h,z-d/2],[x-w/2,h,z-d/2],[x,h+2.4,z-d/2],T.metal,'#c8cebd');
 for(let dz=-d/2+.5;dz<d/2;dz+=5){box(x-w/2-.07,h/2,z+dz,.2,h,.20,T.paint,'#727c70');box(x+w/2+.07,h/2,z+dz,.2,h,.2,T.paint,'#727c70');}
 label(x-w/2-.12,2.1,z,7,4.15,T.shutter,-PI/2);label(x-w/2-.13,5.55,z,1.75,1.75,(T['wh'+num]||T.wh8),-PI/2);
 for(let a of [-1,1])label(x-w/2-.09,5.5,z+a*6.4,4.4,1.25,T.windows,-PI/2);
 box(x-w/2-.17,4.28,z,.4,.2,7.5,T.paint,'#485d52');groundRect(x-w/2-1.3,z,2.3,7.4,'#bfc0a5',.027,T.hazard);
 label(x-w/2-.11,1.3,z-7.5,1.1,2.3,T.shutter,-PI/2);label(x-w/2-.13,2.9,z-7.5,1.25,.5,T.door,-PI/2);
 for(let a of [-1,1]){box(x-w/2-.25,1.2,z+a*4,.12,2.4,.12,T.paint,'#758677');box(x-w/2-.4,3.65,z+a*4,.5,.12,.4,T.white,'#293d3c');S.plane(x-w/2-.65,3.57,z+a*4,.1,.25,T.white,'#eee4aa',-PI/2,1);}
 box(x,.3,z+d/2+.08,w,.6,.12,T.concrete,'#626e64');label(x,6.7,z+d/2+.03,w*.6,1.1,T.storage);
 for(let xx of [-1,1]){box(x+xx*w*.3,h+1.1,z,1.3,1.4,1.3,T.metal,'#818e80');box(x+xx*w*.3,h+1.87,z,1.7,.16,1.7,T.roof);}
}
function crate(b,x,y,z,sz=1.35,stamp=true){b.box(x,y+sz/2,z,sz,sz,sz,T.wood,'#dbd2ab',1);for(let a of [-1,1]){b.box(x+a*sz*.4,y+sz/2,z,sz*.09,sz+.02,sz+.03,T.wood,'#bfa374');b.box(x,y+sz/2,z+a*sz*.4,sz+.03,sz+.02,sz*.09,T.wood,'#c2a574');}b.box(x,y+sz*.07,z,sz+.10,sz*.10,sz+.10,T.wood,'#8e7956');if(stamp)b.plane(x,y+sz*.55,z+sz/2+.025,sz*.6,sz*.3,T.tag);}
function containerCargo(x,y,z,color,yaw=0){S.push(x,y,z,yaw);S.box(0,1.3,0,8,2.6,3.05,T.metal,color,2);for(let zz of [-1.56,1.56]){S.box(0,.12,zz,8.08,.22,.14,T.paint,color);S.box(0,2.48,zz,8.08,.20,.14,T.paint,color);for(let xx of [-3.9,3.9])S.box(xx,1.3,zz,.15,2.6,.14,T.paint,'#a4aaa0');}S.plane(0,1.5,1.535,4,.6,T.storage);S.pop();if(y===0)obstacle(x,z,yaw?3.1:8,yaw?8:3.1,'container');}
function barrel(x,z,c='#596f70'){S.cylinder(x,.52,z,.35,.35,1.04,T.paint,c,12);for(let y of [.12,.50,.92])S.cylinder(x,y,z,.365,.365,.07,T.white,'#344443',12);}
function pole(x,z){box(x,5.4,z,.2,10.8,.2,T.wood,'#677260');box(x,10.2,z,2.5,.15,.2,T.paint,'#747768');for(let a of [-1,0,1])S.cylinder(x+a*.9,10.4,z,.09,.09,.35,T.white,'#d4d3b7',8);}
function cable(a,b,sag=.7){for(let i=0;i<16;i++){let p=add(mul(a,1-i/16),mul(b,i/16)),q=add(mul(a,1-(i+1)/16),mul(b,(i+1)/16));p[1]-=Math.sin(i/16*PI)*sag;q[1]-=Math.sin((i+1)/16*PI)*sag;S.beam(p,q,.022,T.white,'#3e4c48');}}
function crane(x,z,scale=1){S.push(x,0,z);for(let a of [-1,1])for(let b of [-1,1]){S.beam([a*2,0,b*2],[a*1.15,14*scale,b*1.15],.26,T.paint,'#a58c53');for(let y=1;y<13*scale;y+=3){S.beam([a*2,y,-1.7],[a*1.3,y+3,1.4],.10,T.white,'#677264');S.beam([-1.7,y,b*2],[1.4,y+3,b*1.3],.10,T.white,'#677264');}}S.box(0,14*scale,0,3.5,.7,3.2,T.paint,'#b09a5e');S.box(.9,15*scale,0,2,1.6,2.2,T.metal,'#b3a270');S.plane(.9,15.2,1.11,1.5,.9,T.glass);S.beam([0,14.6*scale,0],[-13,16*scale,-3],.3,T.paint,'#b8a163');S.beam([0,16.2*scale,0],[-13,16*scale,-3],.2,T.paint,'#b8a163');for(let i=0;i<7;i++){let a=i/7,b=(i+1)/7;S.beam([-13*a,14.6*scale+1.4*scale*a,-3*a],[-13*b,16.2*scale-.2*scale*b,-3*b],.09,T.paint,'#88794f');}S.beam([-12,16*scale,-2.8],[-12,6,-2.8],.036,T.white,'#344849');S.cylinder(-12,5.8,-2.8,.2,.16,.35,T.white,'#344849',8);S.pop();obstacle(x,z,3.5,3.5,'crane');}
function buildWorld(){
 // The quay, open water, and road markings.
 box(42,-.45,-54,150,.9,182,T.concrete,'#b4b8a1',5);groundRect(1,-2,24,76,'#b3b7aa',.007,T.asphalt);
 for(let z=-39;z<34;z+=5){groundRect(1,z,.10,2.5,'#c8bc88');groundRect(-11.1,z,.08,2.8,'#d0c297');}groundRect(12.8,-2,.12,76,'#b3ad87');
 for(let z=-39;z<35;z+=4){box(-32.65,.07,z,.55,.14,3.9,T.hazard,'#cac0a0');S.cylinder(-31.5,.38,z,.15,.19,.75,T.paint,'#424f4b',8);if(z<30)S.beam([-31.5,.66,z],[-31.5,.66,z+4],.06,T.paint,'#737e70');}
 for(let z=-32;z<31;z+=12){box(-12,.027,z,.45,.04,1.1,T.white,'#344743');for(let i=0;i<8;i++)box(-12,.053,z-.5+i*.14,.47,.016,.04,T.paint,'#889386');}
 for(let i=0;i<75;i++){let x=rand()*43-30,z=rand()*75-40;S.push(x,.015,z,rand()*6);S.tri([0,0,0],[rand()*2+.1,0,rand()*.6],[.5,0,.014],T.white,'#65746c');S.pop();}
 for(let [x,z,w,d] of [[-16,9,4,1.2],[6,7,2.8,1.1],[-5,-6,3,1.6],[-23,-7,2.3,1.1],[8,-23,4,1.4]]){S.push(x,.02,z);S.sphere(0,0,0,w/2,.008,d/2,T.water,'#bbc3ad',2,11);S.pop();}
 warehouse(25,24,1,18,20,7.2);warehouse(25,0,3,18,22,7.4);warehouse(25,-28,8,18,24,8.0);
 // Tea shop: canopy, hand-painted menu, stools, and small details.
 obstacle(-22,22,9,6,'tea');box(-22,1.65,22,9,3.3,6,T.brick,'#c2b59a',2);box(-22,3.55,22,9.8,.35,6.8,T.roof,'#949c87',3);label(-22,2.85,25.03,8.2,1.05,T.tea);
 for(let x of [-24.8,-21.8]){label(x,1.65,25.05,2.4,1.4,T.glass);box(x,1.02,25.2,2.7,.18,.35,T.wood,'#a9ad8b');}label(-18.35,1.35,25.06,1.2,2.1,T.shutter);label(-26.4,1.8,25.08,.65,.95,T.menu);
 S.quad([-26.8,2.68,25.1],[-17.2,2.68,25.1],[-17.2,2.34,27.2],[-26.8,2.34,27.2],T.cloth,'#758671',4,1);for(let x=-26.6;x<-17.4;x+=1.2){S.quad([x,2.68,25.11],[x+.5,2.68,25.11],[x+.5,2.34,27.21],[x,2.34,27.21],T.cloth,'#ceccb1');}
 for(let x of [-26.5,-17.5]){box(x,1.17,27.1,.075,2.34,.075,T.paint,'#446158');S.sphere(x+.25,2.25,26,.25,.4,.25,T.paint,'#e4b871');S.plane(x+.25,2.25,26.24,.24,.5,T.lantern,'#fff',0,1);}
 box(-22,.73,26.1,4,.16,.72,T.wood,'#a59a75');for(let x of [-23.5,-20.5]){box(x,.35,26.1,.12,.7,.3,T.wood);S.cylinder(x,.76,26.05,.085,.085,.17,T.white,'#cdd5b2',10);}
 for(let x of [-24.3,-22,-19.7]){box(x,.5,27.25,.58,.12,.58,T.wood,'#b4a87d');for(let dx of [-.2,.2])box(x+dx,.25,27.25,.08,.5,.42,T.wood,'#6c7964');}
 // Vending machine with glass display and lit rows of tiny cans.
 obstacle(-14.2,24,1.8,1.4,'vending');box(-14.2,1.3,24,1.8,2.6,1.4,T.paint,'#b14836');label(-14.2,2.15,24.72,1.6,.66,T.drink);label(-14.36,1.35,24.715,1.25,1.02,T.glass);
 for(let r=0;r<2;r++)for(let i=0;i<5;i++){let x=-14.85+i*.25,y=1.12+r*.42;S.cylinder(x,y,24.77,.065,.065,.21,T.white,['#c9ad60','#b8c3b9','#659ea0','#a74a39','#e0c98d'][i],8);box(x,y-.17,24.78,.1,.035,.015,T.white,'#ece1ad');}box(-13.55,1.3,24.77,.14,.12,.1,T.white,'#d4c79b');box(-14.35,.48,24.73,.85,.2,.04,T.white,'#253c3d');label(-14.25,2.52,24.74,1.6,.1,T.white,0,'#f5d091');
 // Capsule machines are built by the harbour expansion.

 // Darts alcove on the west side of the kiosk.
 box(-26.65,1.1,20.2,.7,2.2,1.7,T.paint,'#486766');label(-27.01,1.8,20.2,1.5,.6,T.darts,-PI/2);S.push(-27.03,1.06,20.2,-PI/2).rotateX(PI/2);S.cylinder(0,0,0,.48,.48,.04,T.white,'#2f443e',20);S.cylinder(0,-.024,0,.32,.32,.045,T.white,'#c5c0a0',20);S.cylinder(0,-.05,0,.08,.08,.045,T.white,'#a1473c',12);S.pop();
 groundRect(-28.8,20.2,.1,1.8,'#d5bf7d');
 // Gate office and barrier.
 obstacle(6.5,30.6,3.4,3.2,'guard');box(6.5,1.5,30.6,3.4,3,3.2,T.paint,'#c4c7b0');box(6.5,3.1,30.6,3.8,.2,3.6,T.roof,'#84918a');label(6.5,1.85,32.23,2.8,1.05,T.windows);label(4.77,1.8,30.6,2.6,1.1,T.windows,-PI/2);label(6.5,2.7,32.25,2.6,.5,T.bus);label(6.5,1.2,28.96,1,1.3,T.poster,PI);
 for(let x of [-9,11]){box(x,3.6,35,.28,7.2,.28,T.paint,'#637f72');box(x,.35,35,.65,.7,.65,T.concrete);}
 label(1,6.15,35.02,19.5,2.5,T.gate);label(1,6.15,34.98,19.5,2.5,T.gate,PI);
 box(9.5,.65,34,1.1,1.3,1.1,T.paint,'#858975');S.beam([9.5,1.3,34],[9.5,5.3,35.6],.14,T.hazard,'#d8c695');
 // Benches and bus stop.
 for(let x of [-28.5,10]){let z=x<0?29:22;box(x,.65,z,3.3,.15,.75,T.wood,'#b4b494');box(x,.95,z-.3,3.3,.55,.11,T.wood,'#b4b494');for(let dx of [-1.2,1.2])box(x+dx,.3,z,.12,.6,.65,T.white,'#415a52');obstacle(x,z,3.3,.8,'bench');}
 box(-6,1.8,33,.09,3.6,.09,T.paint,'#a0ad9c');label(-6,2.9,33.05,1.1,1.05,T.bus);label(-6,1.8,33.055,.7,1.0,T.notice);
 // Work yard, destination, signs and shipping clutter.
 groundRect(9,-10,6,7,'#809487');for(let x of [6,12])groundRect(x,-10,.12,7,'#d9be77');for(let z of [-13.5,-6.5])groundRect(9,z,6,.12,'#d9be77');S.push(9,.04,-10).rotateX(-PI/2);S.plane(0,0,0,2.6,2.6,T.wh3);S.pop();
 for(let z of [-21,-15]){groundRect(-6,z,10,.1,'#c7bc8f');}for(let x of [-11,-1])groundRect(x,-18,.1,6,'#c7bc8f');
 label(15.72,2.5,-5.4,3.4,1.1,T.freight,-PI/2);label(15.70,1.4,-5.4,2.7,1.4,T.notice,-PI/2);label(15.7,2.5,8,1.05,1.2,T.safety,-PI/2);
 containerCargo(-24,-0.0,-18,'#768d83');containerCargo(-24,2.65,-18,'#aa6d51');containerCargo(-24,0,-30,'#597987');containerCargo(-24,2.65,-30,'#aa9c73');containerCargo(-22,0,-7,'#9b7458');
 for(let [x,z,sz] of [[-17,-27,1.4],[-17,-25,1.6],[10,7,1.5],[13,10,1.2],[-22,7,1.5],[-24,9,1.3],[-19,-33,1.4]]){crate(S,x,0,z,sz);obstacle(x,z,sz,sz,'cargo');}crate(S,10,1.5,7,1.25);
 for(let [x,z] of [[13,12],[12,13],[13.1,13.2],[-29,5],[-28,5.3],[-18,-10],[-18.5,-9],[-29,-38]])barrel(x,z);
 for(let [x,z] of [[-19,9],[13,16],[-16,-4]]){for(let y=0;y<.35;y+=.12){for(let i=0;i<5;i++)box(x-.6+i*.3,y+.05,z,.22,.10,1.5,T.wood,'#8b987e');}obstacle(x,z,1.5,1.5,'pallet');}
 // Lamps, cables and cranes.
 for(let z of [-36,-12,12]){pole(-12.5,z);box(-12.5,8.6,z,2,.1,.12,T.paint,'#536f64');box(-11.6,8.45,z,.65,.14,.34,T.white,'#b9b597');for(let a of [-.9,0,.9])if(z<12)cable([-12.5+a,10.5,z],[-12.5+a,10.5,z+24]);}
 crane(-28,-39,.95);crane(-28,0,1.05);
 // The north gate is now open.
 // The complete surroundings are built after the harbour expansion.
}
buildWorld();
function character(b,ch,time,extra={}){
 const skin=ch.skin||'#e2bd9a',coat=ch.coat||'#785139',pants=ch.pants||'#455d66',hair=ch.hair||'#252b28';let walking=ch.walk||0,phase=ch.phase||time*7,sw=Math.sin(phase)*.65*walking;
 let hit=ch.hit||0,attack=ch.attackTime||0,kind=ch.attackKind||'punch',atk=attack>0?Math.sin(clamp((.42-attack)/.42,0,1)*PI):0,dead=ch.dead||false,block=ch.block||false;
 b.push(ch.x,ch.y||0,ch.z,ch.yaw||0);if(dead){b.translate(0,.35,0);b.rotateX(-1.3);}if(hit>0)b.rotateZ(Math.sin(hit*35)*.08);if(extra.seated)b.translate(0,.34,0);
 // Lower body.
 b.taper(0,.88,0,.36,.42,.25,.24,.25,T.cloth,pants);
 for(let side of [-1,1]){let angle=side*sw;let knee=Math.max(0,-side*sw)*.6;if(extra.seated){angle=1.34;knee=-1.40;}if(kind==='kick'&&side===1&&atk>0){angle=1.5*atk;knee=-.15;}
 b.push(side*.115,.88,0).rotateX(angle);b.cylinder(0,-.21,0,.102,.12,.44,T.cloth,pants,8);b.push(0,-.41,0).rotateX(knee);b.cylinder(0,-.19,0,.083,.103,.40,T.cloth,pants,8);b.box(0,-.40,-.075,.185,.14,.34,T.cloth,'#d8d9c5');b.box(0,-.455,-.075,.19,.04,.345,T.white,'#9ba898');b.pop();b.pop();}
 // Jacket silhouette, belt, lapels and seams.
 b.taper(0,1.21,0,.40,.55,.55,.28,.36,T.cloth,coat);b.sphere(-.255,1.425,0,.125,.13,.17,T.cloth,coat,4,8);b.sphere(.255,1.425,0,.125,.13,.17,T.cloth,coat,4,8);b.box(0,.965,0,.4,.055,.27,T.cloth,'#39413a');b.box(0,.965,-.146,.055,.045,.02,T.white,'#bcb898');b.plane(0,1.25,-.176,.19,.45,T.cloth,'#e4dfc3',PI);
 for(let side of [-1,1]){b.push(side*.11,1.45,-.187,PI);b.tri([-.08,.09,0],[.08,.03,0],[side*.015,-.15,0],T.cloth,coat);b.pop();b.box(side*.22,1.08,-.143,.01,.14,.012,T.white,'#a28f6b');}
 if(ch.hero)b.plane(0,1.23,.171,.35,.37,T.patch);
 // Neck, faceted head and compact hair.
 b.cylinder(0,1.56,0,.087,.09,.14,T.skin,skin,8);b.sphere(0,1.77,-.012,.179,.23,.17,T.skin,skin,7,12);b.plane(0,1.756,-.175,.285,.315,T.face,'#ffffff',PI);
 b.sphere(0,1.933,.01,.186,.115,.179,T.cloth,hair,5,10);b.box(0,1.865,.122,.315,.14,.08,T.cloth,hair);for(let side of [-1,1]){b.box(side*.165,1.82,-.015,.045,.14,.13,T.cloth,hair);b.sphere(side*.18,1.74,.005,.035,.064,.035,T.skin,skin,4,6);}
 if(ch.cap){b.cylinder(0,1.99,0,.205,.18,.105,T.cloth,ch.cap,12);b.box(0,1.973,-.12,.30,.036,.23,T.cloth,ch.cap);}else if(ch.hero){for(let i=0;i<5;i++){b.tri([-.16+i*.062,1.92,-.13],[-.08+i*.062,1.94,-.13],[-.10+i*.062,2.055,-.07],T.cloth,hair);}}
 if(ch.vest){b.plane(-.16,1.25,-.18,.1,.4,T.cloth,'#d4af63',PI);b.plane(.16,1.25,-.18,.1,.4,T.cloth,'#d4af63',PI);b.plane(0,1.34,.18,.52,.10,T.cloth,'#d4bc73');}
 // Jointed arms; attacks use the same model as free movement.
 for(let side of [-1,1]){if(extra.hideArms)continue;let a=-side*sw*.8,elbow=.12;if(extra.seated){a=1.04;elbow=.42;}if(extra.rightArm!==undefined&&side===1){a=extra.rightArm;elbow=.75;}if(extra.leftArm!==undefined&&side===-1){a=extra.leftArm;elbow=.75;}if(block){a=1.0;elbow=1.1;}if(atk&&kind!=='kick'){if(side===1){a=atk*1.65;elbow=.2;}else{a=.5;elbow=.5;}}
 b.push(side*.32,1.44,0).rotateZ(side*-.08).rotateX(a);b.cylinder(0,-.145,0,.09,.12,.32,T.cloth,coat,8);b.push(0,-.30,0).rotateX(elbow);b.cylinder(0,-.145,0,.07,.09,.30,T.cloth,coat,8);b.box(0,-.285,0,.122,.05,.125,T.cloth,'#454b3d');b.sphere(0,-.365,0,.07,.09,.065,T.skin,skin,4,7);b.pop();b.pop();}
 b.pop();
}
function forkliftMesh(b,f,time,driver){b.push(f.x,0,f.z,f.yaw);b.box(0,.75,.2,1.65,.75,2.15,T.paint,(f.paint||'#bd8237'));b.taper(0,.86,1.1,1.5,1.6,.72,.7,.65,T.paint,(f.paint||'#bd853b'));b.box(0,.45,.15,1.7,.20,2.4,T.paint,'#364948');b.plane(0,1.03,1.435,.53,.56,f.plate||T.five);b.box(0,.9,-.25,1.40,.1,1.1,T.white,'#3e4d46');
 for(let x of [-.82,.82])for(let z of [-.72,.93]){b.push(x,.40,z).rotateZ(PI/2);b.cylinder(0,0,0,.4,.4,.30,T.cloth,'#293b39',12);b.cylinder(0,x<0?.17:-.17,0,.20,.20,.025,T.paint,(f.paint||'#d29440'),12);b.pop();}
 b.box(0,1.15,.3,.65,.17,.65,T.cloth,'#293c38');b.box(0,1.42,.58,.66,.55,.13,T.cloth,'#2b3e3d');for(let x of [-.66,.66])for(let z of [-.58,.7])b.box(x,1.99,z,.075,1.48,.075,T.paint,'#354e4b');b.box(0,2.75,.07,1.55,.14,1.58,T.paint,'#536458');
 for(let x of [-.55,.55]){b.box(x,1.44,-1.07,.12,2.6,.16,T.paint,'#3e5250');b.box(x*.85,1.53,-1.16,.045,2.5,.04,T.white,'#a8b3a5');}b.box(0,2.72,-1.07,1.28,.12,.17,T.paint,'#5c6c5c');let lift=Number.isFinite(f.lift)?f.lift:(f.carry!==null?.48:.10);for(let x of [-.43,.43]){b.box(x,lift,-1.95,.14,.08,1.72,T.paint,'#a4ab93');b.box(x,lift+.4,-1.17,.14,.8,.12,T.paint,'#87988b');}b.box(0,lift+.48,-1.2,1.2,.1,.09,T.paint,'#939f88');
 b.beam([0,1.05,-.25],[0,1.5,-.62],.045,T.white,'#43584e');b.push(0,1.53,-.62).rotateX(-.7);b.cylinder(0,0,0,.22,.22,.045,T.white,'#324a42',12);b.pop();if(f.carry!==null&&crates[f.carry])cargoMesh(b,crates[f.carry],0,lift+.07,-1.9);if(driver){let c={...driver,x:0,z:.25,yaw:0,walk:0};character(b,c,time,{seated:true});}b.pop();}
function catMesh(b,x,z,time){b.push(x,0,z,.7);b.sphere(0,.26,0,.15,.18,.30,T.cloth,'#c2aa73');b.sphere(0,.50,-.18,.14,.15,.13,T.cloth,'#d7c9a4');for(let side of [-1,1]){b.tri([side*.12,.58,-.24],[side*.03,.58,-.24],[side*.11,.74,-.2],T.cloth,'#ad966f');b.sphere(side*.059,.51,-.30,.019,.025,.014,T.white,'#30403c',3,6);b.box(side*.11,.1,-.13,.065,.2,.10,T.cloth,'#d4caae');}b.beam([0,.20,.25],[.18,.35,.49],.08,T.cloth,'#9c8964');b.beam([.18,.35,.49],[.20+Math.sin(time)*.04,.56,.52],.065,T.cloth,'#9c8964');b.pop();}
function shipMesh(b,time){b.push(-58,-.5+Math.sin(time*.3)*.08,-30,PI*.07);b.taper(0,1.7,0,5.2,7.5,3.4,27,34,T.paint,'#344f58');b.box(0,3.37,0,7.4,.25,33.7,T.paint,'#9a9a7e');b.box(0,4.9,8,6,3.1,8,T.paint,'#bdc4ae');b.box(0,6.8,9,5.8,.8,4.8,T.paint,'#e0d7b8');b.plane(0,6.8,6.59,5.2,.64,T.windows,'#fff',PI);for(let x of [-2.95,2.95])b.plane(x,5.4,8,6,1.2,T.windows,'#ffffff',x<0?-PI/2:PI/2);b.box(0,7.45,10,6.3,.13,5.1,T.roof,'#72857a');b.cylinder(0,8.1,11,.7,.7,1.6,T.paint,'#a7553a',12);b.cylinder(0,8.8,11,.71,.71,.35,T.white,'#304644',12);b.beam([0,3.5,-7],[0,12.5,-7],.13,T.white,'#aaa989');b.beam([0,11,-7],[0,5,-15],.055,T.white,'#687d72');b.beam([0,11,-7],[0,5,4],.055,T.white,'#687d72');for(let z=-14;z<5;z+=7){b.box(0,4.3,z,5.5,1.7,5.5,T.metal,['#9b8661','#667e76','#896957'][(z+14)/7],2);}
 for(let x of [-3.6,3.6]){for(let z=-15;z<=15;z+=3){b.box(x,3.93,z,.04,1,.04,T.white,'#b6c0a7');if(z<15)b.beam([x,4.4,z],[x,4.4,z+3],.035,T.white,'#b6c0a7');}}b.pop();}

class HarbourSound{
 constructor(){this.ctx=null;this.muted=false;this.volume=.55;this.voice=false;this.nextNote=0;this.note=0;this.mode='roam';this.lastFoot=0;}
 init(){if(this.ctx){this.ctx.resume().catch(()=>{});return;}try{const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();let c=this.ctx;this.master=c.createGain();this.master.gain.value=this.volume;this.master.connect(c.destination);this.music=c.createGain();this.music.gain.value=.65;this.music.connect(this.master);this.fx=c.createGain();this.fx.gain.value=.8;this.fx.connect(this.master);
 const length=Math.floor(c.sampleRate*2.8),buffer=c.createBuffer(2,length,c.sampleRate);for(let ch=0;ch<2;ch++){let a=buffer.getChannelData(ch);for(let i=0;i<length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/length,3)*.33;}this.reverb=c.createConvolver();this.reverb.buffer=buffer;let wet=c.createGain();wet.gain.value=.3;this.reverb.connect(wet);wet.connect(this.music);
 let wind=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=wind.getChannelData(0),v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()*2-1)*.025)*.997;data[i]=v;}let src=c.createBufferSource();src.buffer=wind;src.loop=true;let filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;let vol=c.createGain();vol.gain.value=.13;src.connect(filter);filter.connect(vol);vol.connect(this.master);src.start();this.wind=vol;
 this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=40;let ef=c.createBiquadFilter();ef.type='lowpass';ef.frequency.value=160;this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engine.connect(ef);ef.connect(this.engineGain);this.engineGain.connect(this.fx);this.engine.start();this.nextNote=c.currentTime+.2;this.nextGull=c.currentTime+9;
 }catch(e){console.warn('Audio is not available:',e.message);this.ctx=null;}}
 setMute(v){this.muted=v;if(this.ctx)this.master.gain.setTargetAtTime(v?0:this.volume,this.ctx.currentTime,.1);if(v&&window.speechSynthesis)speechSynthesis.cancel();}
 setVolume(v){this.volume=v;if(this.ctx)this.master.gain.setTargetAtTime(this.muted?0:v,this.ctx.currentTime,.1);}
 tone(freq,t,dur=.3,vol=.1,type='sine',dest=null){if(!this.ctx||this.muted)return;let c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||this.fx);o.start(t);o.stop(t+dur+.03);}
 pluck(midi,t,vol=.14){let f=440*Math.pow(2,(midi-69)/12);this.tone(f,t,2,vol,'triangle',this.music);this.tone(f*2,t,.8,vol*.15,'sine',this.reverb);this.tone(f,t,2.5,vol*.36,'sine',this.reverb);}
 // Decaying noise bursts are generated once per length and reused (footsteps, punches, cargo, ratchets).
 noiseBuffer(dur){const key=Math.round(dur*1000);this.noiseCache=this.noiseCache||new Map();let n=this.noiseCache.get(key);if(!n){const c=this.ctx;n=c.createBuffer(1,Math.max(1,Math.floor(c.sampleRate*dur)),c.sampleRate);const a=n.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,2);this.noiseCache.set(key,n);}return n;}
 noise(dur=.15,vol=.15,cut=900){if(!this.ctx||this.muted)return;let c=this.ctx,n=this.noiseBuffer(dur);let s=c.createBufferSource();s.buffer=n;let g=c.createGain();g.gain.value=vol;let f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;s.connect(f);f.connect(g);g.connect(this.fx);s.start();}
 sfx(name){if(!this.ctx||this.muted)return;let t=this.ctx.currentTime;switch(name){case 'click':this.tone(690,t,.08,.035,'triangle');break;case 'note':[62,69,74].forEach((n,i)=>this.pluck(n,t+i*.16,.09));break;case 'success':[65,69,72,77].forEach((n,i)=>this.pluck(n,t+i*.12,.12));break;case 'fail':this.tone(170,t,.4,.1,'triangle');this.tone(120,t+.13,.4,.1,'triangle');break;case 'step':this.noise(.09,.08,620);this.tone(72,t,.08,.035,'sine');break;case 'punch':this.noise(.14,.28,600);this.tone(95,t,.12,.08,'sine');break;case 'swing':this.noise(.12,.065,1700);break;case 'kick':this.noise(.18,.38,680);this.tone(68,t,.18,.12);break;case 'block':this.noise(.09,.15,2200);this.tone(340,t,.15,.05,'triangle');break;case 'load':this.noise(.35,.18,680);this.tone(150,t,.2,.08,'square');this.tone(200,t+.15,.15,.05,'square');break;case 'soda':this.noise(.7,.12,4700);this.tone(980,t,.06,.04,'triangle');break;case 'coin':this.tone(1700,t,.16,.06);this.tone(2300,t+.06,.25,.035);break;case 'meow':this.slide(700,1050,t,.18,.07);this.slide(1050,640,t+.16,.25,.06);break;case 'qte':this.tone(800,t,.12,.08,'triangle');this.tone(1000,t+.08,.2,.055,'triangle');break;case 'dart':this.noise(.06,.22,800);this.tone(150,t,.12,.055);break;}}
 slide(from,to,t,d,vol=.05){if(!this.ctx||this.muted)return;let c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+d);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.fx);o.start(t);o.stop(t+d+.03);}
 speak(text,name){if(!this.voice||this.muted||!window.speechSynthesis)return;speechSynthesis.cancel();let local=speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.startsWith('en'));if(!local.length)return;let u=new SpeechSynthesisUtterance(text);u.voice=local[name==='Hana'?Math.min(1,local.length-1):0];u.rate=.84;u.pitch=name==='Jun'?.82:name==='Hana'?1.12:.94;u.volume=this.volume*.9;try{speechSynthesis.speak(u);}catch(e){}}
 stopSpeech(){if(window.speechSynthesis)speechSynthesis.cancel();}
 update(mode,speed,rain){if(!this.ctx)return;let c=this.ctx,t=c.currentTime;this.engineGain.gain.setTargetAtTime(mode==='forklift'?.025+Math.abs(speed)*.013:0,t,.1);this.engine.frequency.setTargetAtTime(32+Math.abs(speed)*17,t,.12);this.wind.gain.setTargetAtTime((.11+rain*.12)*options.ambientVolume,t,.5);
 if(t>this.nextGull){if(mode!=='combat'){this.slide(940,1440,t,.22,.018);this.slide(1440,890,t+.2,.32,.021);this.slide(1100,1380,t+.75,.18,.014);}this.nextGull=t+15+Math.random()*20;}
 const combat=mode==='combat'||mode==='qte';const motif=combat?[50,57,60,57,53,60,62,60,48,55,58,55,50,57,62,57]:[62,69,72,74,69,65,67,69,62,65,69,67,65,60,62,0,65,69,74,77,74,72,69,67,62,65,60,62,0,57,60,62];
 if(t>this.nextNote+.5)this.nextNote=t+.05;while(this.nextNote<t+.14){let n=motif[this.note%motif.length];if(n)this.pluck(n,this.nextNote,combat?.055:.075);if(this.note%8===0){let bass=[38,41,36,38][Math.floor(this.note/8)%4];this.tone(440*Math.pow(2,(bass-69)/12),this.nextNote,5,.065,'sine',this.music);this.tone(440*Math.pow(2,(bass+7-69)/12),this.nextNote,4,.025,'sine',this.reverb);}this.note++;this.nextNote+=combat?.31:.65;}
 }
}
const sound=new HarbourSound();

const $=id=>document.getElementById(id), show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
// HUD writes are collected during updateHUD() and reach the DOM once, only when a value changed.
const hudPending=new Map(),hudStyles=new Map();
function hudText(id,v){hudPending.set(id,String(v));}
function hudStyle(id,prop,v){const key=id+'|'+prop;if(hudStyles.get(key)!==v){hudStyles.set(key,v);$(id).style[prop]=v;}}
function hudFlush(){for(const [id,v] of hudPending){const el=$(id);if(el&&el.textContent!==v)el.textContent=v;}hudPending.clear();}
const SAVE_KEY='sham-mue.harbour.save.v1',OPT_KEY='sham-mue.harbour.options.v1';
const defaults={shadows:true,guides:true,relaxed:false,tank:false,voices:false,volume:.55,muted:false,weather:true};
let options={...defaults};try{options={...defaults,...JSON.parse(localStorage.getItem(OPT_KEY)||'{}')};}catch(e){}
let renderer=null,mode='title',started=false,G,player,forklift,crates,npcs=[],enemies=[],interactable=null;
let worldTime=0,hitStop=0,camYaw=0,camPitch=.1,camManual=0,camEye=[4,3.5,38],camTarget=[0,1,25],camZoom=5.5,screenShake=0,damageAlpha=0;
let dialogue=null,modalState=null,bookPrev='title',currentTab='leads',transition=null,qte=null,darts=null,sideShift=false,battleWinDelay=0,battleCount=0;
let toastUntil=0,areaUntil=0,saveUntil=0,lastAutoSave=0,lastAction=0,stepAccum=0;
// The game's own control vocabulary (keys.Space, keys.KeyQ…), filled every frame from kit.input actions in pumpInput().
const keys={};
const actors={
 mori:{id:'mori',name:'Mori',x:2,z:26.4,yaw:PI,coat:'#426071',pants:'#344e5c',cap:'#344951',hair:'#3b3830',role:'Gate guard'},
 hana:{id:'hana',name:'Hana',x:-19.7,z:28.3,yaw:PI,coat:'#728077',pants:'#535a51',hair:'#3f302b',role:'Tea shop owner'},
 daichi:{id:'daichi',name:'Daichi',x:-8.5,z:2,yaw:-.5,coat:'#647a76',pants:'#475960',cap:'#c7ab66',vest:true,hair:'#383d36',role:'Yard foreman'},
 sailor:{id:'sailor',name:'Nobu',x:-26.7,z:12,yaw:.85,coat:'#b2b8a4',pants:'#476374',cap:'#d8d4bb',hair:'#473b31',role:'Off-duty sailor'}
};
const crateOrigins=[{x:-9,z:-18},{x:-5,z:-19},{x:-1,z:-18}];
const toyNames=['Forklift No. 05','Blue freighter','Harbour gull','Lucky kettle','Tiny crane','The night cat'];
const toyIcons=['forklift','ship','gull','kettle','crane','cat'];
const leads=[
 ['The east gate','Ask the gate guard about the marked crate.'],
 ['Breakwater Tea','Speak to Hana at the tea shop.'],
 ['The afternoon shift','Find Daichi near the orange forklift.'],
 ['A favour for Daichi','Move three crates to the marked bay at Warehouse 03.'],
 ['The freight manifest','Read the notice board on Warehouse 03.'],
 ['The loading yard','Recover the stolen cargo pass.'],
 ['Warehouse 08','Take the cargo pass to Warehouse 08.'],
 ['A quiet harbour','The ledger is safe. Stay a little longer.']
];
function freshState(){G={v:1,stage:0,cash:500,clock:940,elapsed:0,toys:{},catFed:false,drinks:0,dartsPlayed:0,bestDarts:0,battleWon:false,qteWins:0,sideShifts:0};player={x:0,z:31.5,y:0,yaw:0,hero:true,health:100,walk:0,phase:0,attackTime:0,attackKind:'punch',attackHit:false,cool:0,invuln:0,evadeCool:0,hit:0,combo:0,comboTime:0,coat:'#735039',pants:'#486777'};forklift={x:-5,z:1.2,yaw:0,speed:0,carry:null};crates=crateOrigins.map((o,i)=>({...o,id:i,delivered:false}));npcs=Object.values(actors).map(a=>({...a,walk:0,phase:0}));npcs.push({id:'walker1',name:'Eiji',role:'Dock worker',x:-3,z:11,yaw:0,coat:'#688a8a',pants:'#3b565d',cap:'#b7b5a0',path:[[-3,11],[-3,-11],[8,-17],[8,14]],wp:1,walk:0,phase:2},{id:'walker2',name:'Ken',role:'Delivery driver',x:6,z:9,yaw:PI,coat:'#877865',pants:'#495a5c',path:[[6,9],[5,24],[-5,24],[-5,9]],wp:1,walk:0,phase:0},{id:'walker3',name:'Aoi',role:'Port clerk',x:-17,z:13,yaw:0,coat:'#698078',pants:'#58564d',hair:'#3c3530',path:[[-17,13],[-17,-1],[-14,-1],[-14,13]],wp:1,walk:0,phase:4});enemies=[];sideShift=false;camYaw=0;camManual=0;camPitch=.1;camZoom=5.5;camEye=[1,3.2,37];camTarget=[0,1.15,31];}
function readSave(){try{let s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!s||s.v!==1||!Number.isInteger(s.stage)||s.stage<0||s.stage>7)return null;return s;}catch(e){return null;}}
function persistOptions(){try{localStorage.setItem(OPT_KEY,JSON.stringify(options));}catch(e){}if(renderer)renderer.settings.shadows=!!options.shadows;sound.voice=!!options.voices;sound.setVolume(clamp(Number(options.volume)||0,0,1));sound.setMute(!!options.muted);}
function saveGame(silent=false){if(!started||!G)return;try{let state={...G,position:{x:player.x,z:player.z,yaw:player.yaw,health:player.health},forklift:{...forklift,speed:0},crates:crates.map(c=>({...c})),sideShift};localStorage.setItem(SAVE_KEY,JSON.stringify(state));if(!silent){saveUntil=worldTime+1.8;overlayOpacity('saveIcon',1);}}catch(e){if(!G.saveWarned){G.saveWarned=true;toast('BROWSER STORAGE','This session is not saved','Keep this tab open to keep your progress.');}}}
function loadState(s){freshState();for(let k of ['stage','cash','clock','elapsed','catFed','hasBun','drinks','dartsPlayed','bestDarts','battleWon','qteWins','sideShifts'])if(s[k]!==undefined)G[k]=s[k];G.cash=clamp(Number(G.cash)||0,0,99999);G.clock=clamp(Number(G.clock)||940,940,1135);G.elapsed=Math.max(0,Number(G.elapsed)||0);G.toys=s.toys&&typeof s.toys==='object'?s.toys:{};if(s.position&&Number.isFinite(s.position.x)&&Number.isFinite(s.position.z)){player.x=clamp(s.position.x,-30,14.5);player.z=clamp(s.position.z,-39,34);player.yaw=Number(s.position.yaw)||0;player.health=clamp(Number(s.position.health)||100,1,100);}if(s.forklift&&Number.isFinite(s.forklift.x)&&Number.isFinite(s.forklift.z)){forklift={...forklift,...s.forklift};forklift.x=clamp(forklift.x,-29,14);forklift.z=clamp(forklift.z,-39,33);forklift.carry=Number.isInteger(forklift.carry)&&forklift.carry>=0&&forklift.carry<3?forklift.carry:null;forklift.speed=0;}if(Array.isArray(s.crates)&&s.crates.length===3)crates=s.crates.map((c,i)=>({id:i,x:clamp(Number(c.x)||crateOrigins[i].x,-29,14),z:clamp(Number(c.z)||crateOrigins[i].z,-39,33),delivered:!!c.delivered}));sideShift=!!s.sideShift;if(collides(player.x,player.z,.30)||dist(player,forklift)<1.2)moveToSafe();camYaw=player.yaw;camEye=[player.x+Math.sin(camYaw)*5.5,3.2,player.z+Math.cos(camYaw)*5.5];camTarget=[player.x,1.2,player.z];}
function startGame(resume=false){sound.init();sound.stopSpeech();if(resume&&readSave())loadState(readSave());else freshState();started=true;clearKeys();setMode('roam');show('titleScreen',false);show('ending',false);show('bookOverlay',false);show('modal',false);$('areaCard').classList.add('show');areaUntil=worldTime+4.8;persistOptions();updateHUD();if(resume&&(G.stage===3||sideShift)&&crates.every(c=>c.delivered)){fadeTo(finishShift);}else if(G.stage===5){fadeTo(()=>battleIntro(true));}else if(!resume){talk([{n:'Jun',t:'Father left one address in his letter. Nagamatsu Harbour.'},{n:'Jun',t:'A red ledger. A crate marked with a blue crane. Someone here must know.'}],()=>{areaUntil=worldTime+3;$('areaCard').classList.add('show');toast('THE LAST SHIPMENT','Start at the east gate','Walk to the guard. Press '+prompts.use+' to speak.');saveGame();},null);}else toast('AFTERNOON RESUMED','Back at the harbour',leads[G.stage][1]);}
function goTitle(){saveGame(true);started=false;setMode('title');show('modal',false);show('bookOverlay',false);show('ending',false);show('dartsOverlay',false);show('titleScreen');sound.stopSpeech();clearKeys();$('areaCard').classList.remove('show');show('continueBtn',!!readSave());$('startBtn').textContent=readSave()?'START A NEW AFTERNOON →':'BEGIN THE AFTERNOON →';}
function requestNew(){if(readSave()){openModal('A new afternoon','NEW GAME','<p>This starts a new story. It replaces the saved afternoon in this browser.</p>',[{text:'Start a new afternoon',fn:()=>startGame(false)},{text:'Keep my saved game',fn:()=>{}}]);}else startGame(false);}
function setMode(m){mode=m;show('hud',started&&!['title','ending','darts'].includes(m));show('dialogue',m==='dialogue');show('taskHUD',m==='forklift');show('fightHUD',m==='combat');show('battleHints',m==='combat');show('qteHUD',m==='qte');if(m!=='combat'){$('enemyWarnings').innerHTML='';warningHTML='';}show('interaction',false);show('waypoint',false);document.body.classList.toggle('playing',['roam','forklift','combat'].includes(m));document.body.classList.toggle('forklift',m==='forklift');document.body.classList.toggle('combat',m==='combat');document.body.classList.toggle('title-mode',m==='title');document.body.classList.toggle('cinematic',['dialogue','qte','transition'].includes(m));$('modeLabel').textContent=m==='forklift'?'AFTERNOON SHIFT':m==='combat'?'FREE BATTLE':'FREE EXPLORATION';if(!['roam','forklift','combat','qte'].includes(m)){player&&(player.walk=0);clearKeys();}if(m!=='dialogue')sound.stopSpeech();}
function clearKeys(){for(let k in keys)keys[k]=false;}
function toast(tag,title,text=''){if(mode==='title')return;$('toastTag').textContent=tag;$('toastTitle').textContent=title;$('toastText').textContent=text;$('toast').classList.add('show');toastUntil=worldTime+4.7;}
function stageTo(n){if(n<=G.stage)return;G.stage=n;updateHUD();sound.sfx('note');toast('NOTEBOOK UPDATED',leads[n][0],leads[n][1]);saveGame();}
function fadeTo(fn){transition={time:0,fn,done:false};setMode('transition');}
function talk(lines,onend=null,focus=null,choices=null){dialogue={lines,index:0,typed:0,onend,focus,choices,choiceBuilt:false};setMode('dialogue');showLine();}
function showLine(){let l=dialogue.lines[dialogue.index];dialogue.typed=0;dialogue.choiceBuilt=false;$('speaker').textContent=l.n.toUpperCase();$('speech').textContent='';$('choices').innerHTML='';show('dialogueNext');sound.speak(l.t,l.n);if(dialogue.focus){let f=dialogue.focus;f.yaw=Math.atan2(f.x-player.x,f.z-player.z);player.yaw=Math.atan2(player.x-f.x,player.z-f.z);}sound.sfx('click');}
function updateDialogue(dt){if(!dialogue)return;let l=dialogue.lines[dialogue.index];dialogue.typed=Math.min(l.t.length,dialogue.typed+dt*42);$('speech').textContent=l.t.slice(0,Math.floor(dialogue.typed));if(dialogue.typed>=l.t.length&&dialogue.index===dialogue.lines.length-1&&dialogue.choices&&!dialogue.choiceBuilt){dialogue.choiceBuilt=true;show('dialogueNext',false);dialogue.choices.forEach((c,i)=>{let b=document.createElement('button');b.innerHTML='<small>'+(i+1)+'</small>';let span=document.createElement('span');span.textContent=c.text;b.appendChild(span);b.onclick=()=>chooseDialogue(i);$('choices').appendChild(b);});dialogue.choiceAt=worldTime;}}
function advanceTalk(){if(!dialogue)return;let l=dialogue.lines[dialogue.index];if(dialogue.typed<l.t.length){dialogue.typed=l.t.length;updateDialogue(0);return;}if(dialogue.index<dialogue.lines.length-1){dialogue.index++;showLine();}else if(!dialogue.choices)finishTalk();}
function finishTalk(){let cb=dialogue?.onend;dialogue=null;setMode('roam');if(cb)cb();}
function chooseDialogue(i){if(!dialogue||!dialogue.choiceBuilt||!dialogue.choices[i])return;let c=dialogue.choices[i],cb=dialogue.onend;dialogue=null;setMode('roam');sound.sfx('click');if(cb)cb();if(c.fn)c.fn();}
function openModal(title,kicker,body,buttons,esc=true){const prev=mode;modalState={prev,esc,buttons};setMode('modal');$('modalTitle').textContent=title;$('modalKicker').textContent=kicker;$('modalBody').innerHTML=body;$('modalActions').innerHTML='';buttons.forEach((obj,i)=>{let b=document.createElement('button');b.className=i===0?'primary':'secondary';b.textContent=obj.text;b.onclick=()=>{let restore=modalState?.prev||'roam';modalState=null;show('modal',false);setMode(restore);sound.sfx('click');obj.fn?.();};$('modalActions').appendChild(b);});show('modal');}
function pauseGame(){if(mode==='title'||mode==='modal'||mode==='book'||mode==='ending')return;saveGame(true);openModal('Take a moment.','PAUSED','<p>The harbour can wait.</p>',[{text:'Return to the harbour',fn:()=>{}},{text:'Notebook & options',fn:()=>openBook('options')},{text:'Save and return to title',fn:()=>goTitle()}]);}
function npc(id){return npcs.find(n=>n.id===id);}
function choosePerson(a){
 if(a.id==='mori'){
 if(G.stage===0)talk([{n:'Jun',t:'Excuse me. I am looking for a crate marked with a blue crane.'},{n:'Mori',t:'A blue crane? Ask Hana at Breakwater Tea. The green awning, by the water.'},{n:'Jun',t:'Hana. I see.'}],()=>stageTo(1),a);
 else talk([{n:'Mori',t:G.stage===7?'You found what you came for. That is more than most people can say.':'No trouble in the yard, all right? What do you need?'}],null,a,[{text:'Where should I go?',fn:()=>talk([{n:'Mori',t:leads[G.stage][1]}],null,a)},{text:'Tell me about the harbour.',fn:()=>talk([{n:'Mori',t:'Thirty years at this gate. I know every ship by its horn.'},{n:'Jun',t:'Does that one have a name?'},{n:'Mori',t:'They all have names, son.'}],null,a)},{text:'That is all. Thank you.',fn:()=>{}}]);
 }else if(a.id==='hana'){
 if(G.stage<2)talk([{n:'Jun',t:'Do you know about a shipment with a blue crane on the crate?'},{n:'Hana',t:'Kita Shipping. Daichi moved their cargo this morning. He is beside the orange forklift.'},{n:'Hana',t:'Your father used to drink his tea here. Always let it go cold.'},{n:'Jun',t:'You knew him?'},{n:'Hana',t:'A little. Ask Daichi about the red ledger.'}],()=>stageTo(2),a);
 else talk([{n:'Hana',t:G.stage===7?'One more cup before you go? Your father would have stayed.':'A warm drink helps on a day like this.'}],null,a,[{text:'Tea — ¥80',fn:()=>purchase(80,()=>{player.health=100;talk([{n:'Hana',t:'Here. Take your time.'},{n:'Jun',t:'It is good. Thank you.'}],()=>{sound.sfx('soda');G.drinks++;saveGame();},a);})},{text:'A fish bun for the cat — ¥80',fn:()=>purchase(80,()=>{G.hasBun=true;talk([{n:'Hana',t:'For the little cat by the bench? Leave half for him. He has had a long day too.'}],()=>{saveGame();toast('POCKET','A warm fish bun','Find the cat near the bench by the water.');},a);})},{text:'The man with the ledger?',fn:()=>talk([{n:'Hana',t:G.stage<4?'Daichi is the foreman. Help him with the crates. People talk when the work is done.':G.stage<7?'The freight office is on Warehouse 03. The big numbers are hard to miss.':'The morning ferry goes to Kobe. You still have some time.'}],null,a)},{text:'I should go.',fn:()=>{}}]);
 }else if(a.id==='daichi'){
 if(G.stage<2)talk([{n:'Daichi',t:'Looking for cargo? Hana knows who owns what. Ask her at the tea shop.'}],null,a);
 else if(G.stage===2)talk([{n:'Jun',t:'Hana sent me. Did you see my father\'s red ledger?'},{n:'Daichi',t:'Kita cargo. I remember. Give me a hand, and I will find the manifest.'},{n:'Daichi',t:'Three crates from the yellow pickup area. Put them in the marked bay at Warehouse 03.'}],null,a,[{text:'Take the shift.',fn:()=>{stageTo(3);shiftIntro();}},{text:'I will come back.',fn:()=>{}}]);
 else if(G.stage===3)talk([{n:'Daichi',t:'Use the orange forklift. E lifts a crate. E again sets it down in the yellow bay at Warehouse 03.'},{n:'Daichi',t:'No rush. If the truck gets stuck, press R to put it back here.'}],null,a,[{text:'Get to work.',fn:()=>enterForklift()},{text:'Keep walking.',fn:()=>{}}]);
 else talk([{n:'Daichi',t:G.stage===7?'Good work today. There is always another shipment.':'Your manifest is on the board at Warehouse 03. You earned that look.'}],null,a,[{text:'Work another shift.',fn:()=>{sideShift=true;crates=crateOrigins.map((o,i)=>({...o,id:i,delivered:false}));forklift={x:-5,z:1.2,yaw:0,speed:0,carry:null};shiftIntro();}},{text:'Any advice?',fn:()=>talk([{n:'Daichi',t:'Keep your feet under you. Block their first strike, then step in.'},{n:'Jun',t:'You mean the forklift?'},{n:'Daichi',t:'No.'}],null,a)},{text:'Thanks for the work.',fn:()=>{}}]);
 }else if(a.id==='sailor')talk([{n:'Jun',t:'Do you work on the ships?'},{n:'Nobu',t:'Not while I am on my break.'},{n:'Jun',t:'I see.'},{n:'Nobu',t:'The blue ship leaves tomorrow. The ledger goes through Warehouse 08. You did not hear that from me.'}],null,a);
 else {let lines=a.id==='walker1'?['The north yard is open. Follow the main road past Warehouse 08.','Watch the forks. They are lower than they look.']:a.id==='walker2'?['A red ledger? Ask the foreman. I only drive.','I have been waiting for the same cup of tea since lunch.']:['Read the warehouse numbers, not the shipping company names.','The sea is quiet today. That is usually a good sign.'];talk([{n:a.name,t:lines[Math.floor(G.elapsed/90)%lines.length]}],null,a);}
}
function purchase(cost,fn){if(G.cash<cost){sound.sfx('fail');talk([{n:'Jun',t:'I do not have enough money. I can earn more by moving cargo for Daichi.'}]);return;}G.cash-=cost;updateHUD();sound.sfx('coin');fn();saveGame(true);}
function shiftIntro(){openModal('An honest afternoon.','FORKLIFT SHIFT','<p>Move the <strong>three marked crates</strong> to the yellow bay at <strong>Warehouse 03</strong>.</p><p>Use <strong>W / S</strong> to drive and <strong>A / D</strong> to steer. Stop near a crate. Press <strong>E</strong> to lift it. Press <strong>E</strong> inside the bay to deliver it.</p><div class="modalHint">SPACE / BRAKE &nbsp; · &nbsp; X / GET OUT &nbsp; · &nbsp; R / RECOVER<br>No time limit. Take your time.</div>',[{text:'Get in the forklift',fn:()=>enterForklift()},{text:'Look around first',fn:()=>{}}]);}
function enterForklift(){if(G.stage!==3&&!sideShift){talk([{n:'Jun',t:'I should speak to Daichi before I use his forklift.'}]);return;}player.walk=0;player.y=0;forklift.speed=0;setMode('forklift');camYaw=forklift.yaw;camManual=0;camZoom=7;camEye=[forklift.x+Math.sin(camYaw)*7,4.1,forklift.z+Math.cos(camYaw)*7];camTarget=[forklift.x,1.25,forklift.z];updateHUD();toast('AFTERNOON SHIFT','Slow and steady','Three crates. One yellow bay. '+prompts.use+' lifts and lowers.');}
function exitForklift(){player.x=forklift.x+Math.cos(forklift.yaw)*1.65;player.z=forklift.z-Math.sin(forklift.yaw)*1.65;player.yaw=forklift.yaw;player.y=0;forklift.speed=0;if(collides(player.x,player.z,.3))moveToSafe();setMode('roam');camZoom=5.5;saveGame(true);}
function recoverForklift(){if(forklift.carry!==null){let c=crates[forklift.carry];c.x=crateOrigins[c.id].x;c.z=crateOrigins[c.id].z;forklift.carry=null;}forklift.x=-5;forklift.z=1.2;forklift.yaw=0;forklift.speed=0;camYaw=0;toast('VEHICLE RECOVERED','Back beside the foreman','Delivered cargo stays delivered.');sound.sfx('load');saveGame(true);}
function frontOfFork(){return {x:forklift.x-Math.sin(forklift.yaw)*2,z:forklift.z-Math.cos(forklift.yaw)*2};}
function bestCrate(){let p=frontOfFork(),best=null,dd=2.25;for(let c of crates)if(!c.delivered&&c.id!==forklift.carry){let d=dist(p,c);if(d<dd){dd=d;best=c;}}return best;}
function inBay(p){return p.x>5.7&&p.x<12.4&&p.z>-14&&p.z<-6;}
function forkAction(){if(Math.abs(forklift.speed)>.85){toast('EASY NOW','Stop the forklift first','Hold '+prompts.brake+' to brake.');return;}let front=frontOfFork();if(forklift.carry===null){let c=bestCrate();if(c){forklift.carry=c.id;sound.sfx('load');toast('CARGO LOADED','Crate '+(c.id+1)+' / 3','Drive to the yellow bay at Warehouse 03.');}else{sound.sfx('click');toast('NO CARGO IN REACH','Move the forks closer','Line up the front of the truck with a marked crate.');}}else{let c=crates[forklift.carry];if(inBay(front)||inBay(forklift)){c.delivered=true;c.x=8+(crates.filter(c=>c.delivered).length-1)*1.5;c.z=-11.2;forklift.carry=null;sound.sfx('success');let total=crates.filter(c=>c.delivered).length;toast('CARGO DELIVERED',total+' / 3 crates','Good work. Keep the bay clear.');if(total===3){saveGame(true);fadeTo(finishShift);return;}}else{if(!collides(front.x,front.z,.75)){c.x=front.x;c.z=front.z;forklift.carry=null;sound.sfx('load');toast('CARGO SET DOWN','Crate left in the yard','You can lift it again.');}else{toast('NOT ENOUGH ROOM','Move clear of the wall','The forks need open ground.');}}}saveGame(true);updateHUD();}
function finishShift(){forklift.carry=null;forklift.speed=0;forklift.x=-5;forklift.z=1.2;forklift.yaw=0;player.x=-6.8;player.z=4;player.y=0;player.yaw=.55;camYaw=.5;camZoom=5.5;let side=sideShift;sideShift=false;G.cash+=side?250:500;if(side)G.sideShifts++;if(!side)stageTo(4);setMode('roam');talk(side?[{n:'Daichi',t:'Three crates. Not a scratch. Here is ¥250.'},{n:'Jun',t:'Thank you.'}]:[{n:'Daichi',t:'Not bad for a first shift. Here is ¥500.'},{n:'Jun',t:'The red ledger?'},{n:'Daichi',t:'Kita Shipping. Warehouse 08. The freight board on Warehouse 03 has the cargo pass.'},{n:'Daichi',t:'Watch yourself. Someone else asked about that ledger.'}],()=>{saveGame();updateHUD();},npc('daichi'));}
function inspectManifest(){if(G.stage<4){talk([{n:'Jun',t:'Cargo codes. No names. Daichi should know which one I need.'}],null,{x:14,z:-5.4,yaw:0});}else if(G.stage===4){talk([{n:'Jun',t:'Kita Shipping. Red ledger. Warehouse 08.'},{n:'Jun',t:'The cargo pass is still here.'},{n:'Courier',t:'Looking for this?'}],()=>startChase(),{x:14,z:-5.4,yaw:0});}else talk([{n:'Jun',t:'Warehouse 08. I have the right address.'}],null,{x:14,z:-5.4,yaw:0});}
function inspectDoor(){if(G.stage<6){talk([{n:'Jun',t:G.stage===5?'Those men have the cargo pass. I need it before I can go inside.':'The door is locked. I need the cargo pass from the freight office.'}],null,{x:15.7,z:-28});if(G.stage===5&&!enemies.length)battleIntro();}else if(G.stage===6){const keeper={x:14.8,z:-28,yaw:PI/2,coat:'#4a6266',pants:'#3c4d50',hair:'#bcb9a0',name:'Enomoto'};talk([{n:'Enomoto',t:'Kisaragi. I knew you would come.'},{n:'Jun',t:'Where is my father?'},{n:'Enomoto',t:'He left this ledger with me. He said you would know what to do.'},{n:'Jun',t:'A ferry ticket. Kobe. Tomorrow at six.'},{n:'Enomoto',t:'His last shipment was not cargo. It was someone who needed to leave.'},{n:'Jun',t:'Then he is alive.'},{n:'Enomoto',t:'Read his letter on the ship. Tonight, go home. You have done enough.'},{n:'Jun',t:'Thank you. I will.'}],()=>completeChapter(),keeper);}else talk([{n:'Jun',t:'The ledger is safe. The ferry leaves tomorrow. There is still time for tea.'}]);}
function interact(){if(mode==='forklift'){forkAction();return;}if(mode!=='roam')return;let a=interactable;if(!a)return;sound.sfx('click');if(a.kind==='person')choosePerson(a.ref);else if(a.id==='forklift')enterForklift();else if(a.id==='board')inspectManifest();else if(a.id==='door')inspectDoor();else if(a.id==='vending')talk([{n:'Jun',t:'A cold drink. Which one?'}],null,{x:-14.2,z:24},[{text:'Sun Pop orange — ¥100',fn:()=>buyDrink('The orange soda is cold. That helps.')},{text:'Black coffee — ¥100',fn:()=>buyDrink('It is bitter. Father liked it this way.')},{text:'Barley tea — ¥100',fn:()=>buyDrink('A quiet moment by the water.')},{text:'Keep my money.',fn:()=>{}}]);else if(a.id==='capsule')talk([{n:'Jun',t:'Pocket Port. A capsule toy costs ¥100.'}],null,{x:-11.3,z:24},[{text:'Turn the handle — ¥100',fn:()=>buyToy()},{text:'Not today.',fn:()=>{}}]);else if(a.id==='cat'){
 sound.sfx('meow');if(G.catFed)talk([{n:'Jun',t:'You look better. Stay out of the rain, all right?'}]);else if(G.hasBun)talk([{n:'Jun',t:'Here. Hana said to share.'}],()=>{G.catFed=true;G.hasBun=false;saveGame();sound.sfx('meow');toast('A SMALL MOMENT','A friend at the harbour','The little cat will remember you.');});else talk([{n:'Jun',t:'You are hungry. Hana might have something for you.'}]);
 }else if(a.id==='darts')talk([{n:'Jun',t:'Three darts for ¥50. A score of 60 earns ¥150. A score of 100 earns ¥250.'}],null,{x:-27,z:20.2},[{text:'Play — ¥50',fn:()=>purchase(50,()=>startDarts())},{text:'Not now.',fn:()=>{}}]);else if(a.id==='bus')talk([{n:'Jun',t:'The next bus is in fifteen minutes. I could rest here.'}],null,null,[{text:'Wait fifteen minutes.',fn:()=>{G.clock=Math.min(G.clock+15,1125);player.health=100;toast('A QUIET MOMENT','The sea breeze is cold','Fifteen minutes pass.');saveGame();}},{text:'Keep looking.',fn:()=>{}}]);}
function buyDrink(text){purchase(100,()=>{player.health=100;G.drinks++;sound.sfx('soda');talk([{n:'Jun',t:text}],()=>{toast('A SMALL MOMENT','Health restored','Some things are worth slowing down for.');saveGame();updateHUD();});});}
function toySVG(id,size=38){const common='width="'+size+'" height="'+size+'" viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';const shapes=[`<path d="M8 39V29h19v12H8zm12-10V15h17v25m0-25h5v29h9M22 16v12h14"/><circle cx="14" cy="43" r="5"/><circle cx="31" cy="43" r="5"/>`,`<path d="M5 36h50l-8 12H16zM17 34V21h23v14m-13-14V11h8v10M7 52q6-6 12 0t12 0t12 0t12 0"/><path d="M21 26h4m6 0h4"/>`,`<path d="M5 26q17-22 25 1q13-22 26-1q-18-8-23 10l9 11-13-5-10 5 5-12Q16 23 5 26z"/>`,`<path d="M16 27q-8 22 13 22t13-22H16zm9-3h10M17 33L7 25l3 15 7 2m26-10q16-8 10 6l-9 7M22 20q-9-14 7-13t11 13"/>`,`<path d="M12 50h17M16 50l3-37h7l2 37m-8-35L53 7v8H9l11-8v6m30 3v20h-5m-25-7 7 8-9 8m3-26 5 8-7 7"/>`,`<path d="M17 33q-4-14 4-19l7 7h6l8-7q10 12 2 22l-5 13H19zm26 7q20 12 11-7"/><path d="M23 29h1m12 0h1m-8 5h4M23 47v-8m12 8v-8"/>`];return '<svg '+common+'>'+shapes[id]+'</svg>';}
function buyToy(){purchase(100,()=>{let id=Math.floor(Math.random()*6),isNew=!G.toys[id];G.toys[id]=(G.toys[id]||0)+1;saveGame();sound.sfx('success');openModal(toyNames[id],isNew?'A NEW POCKET PORT TOY':'ANOTHER LITTLE TREASURE','<div style="text-align:center;color:#d9b978;padding:10px">'+toySVG(id,100)+'</div><p style="text-align:center">'+(isNew?'A small piece of the harbour.':'You have '+G.toys[id]+' of this toy now.')+'</p>',[{text:'Put it in my pocket',fn:()=>{}}]);});}
function completeChapter(){G.clock=Math.max(G.clock,1048);stageTo(7);saveGame();showEnding();}
function showEnding(){setMode('ending');show('ending');sound.sfx('success');$('endTime').textContent=formatDuration(G.elapsed);$('endExtras').textContent=[G.catFed,G.drinks>0,G.dartsPlayed>0].filter(Boolean).length+' / 3';clearKeys();}
function formatDuration(s){s=Math.floor(s);return Math.floor(s/60).toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0');}
const chaseSteps=[{code:'KeyW',key:'W',action:'VAULT',lead:'OVER THE PALLET'},{code:'KeyD',key:'D',action:'TURN',lead:'TAKE THE RIGHT TURN'},{code:'Space',key:'SPACE',action:'DUCK',lead:'UNDER THE LOADING BOOM'}];
const chasePath=[[10,-8],[6,-15],[10,-21],[3,-29]];
function startChase(){sound.stopSpeech();clearKeys();qte={step:0,time:0,phase:'ready',travel:0,phaseTime:0};player.x=10;player.z=-8;player.y=0;player.walk=1;player.phase=0;camYaw=.2;setMode('qte');paintQTE();}
function paintQTE(){if(!qte)return;let s=chaseSteps[Math.min(qte.step,2)];const label=qteLabel(s);$('qteKey').textContent=qte.phase==='ready'?'…':qte.phase==='pass'?'✓':label;$('qteKey').style.fontSize=label.length>2&&qte.phase==='prompt'?'25px':'57px';$('qteAction').textContent=qte.phase==='ready'?'GET READY':qte.phase==='pass'?'GOOD':s.action;$('qteLead').textContent=s.lead;$('qteCount').textContent=(qte.step+1).toString().padStart(2,'0')+' / 03  ·  '+(kit.input.source==='gamepad'?'PRESS THE SHOWN BUTTON':kit.input.source==='touch'?'TAP THE CIRCLE':'PRESS THE SHOWN KEY');$('qteCircle').style.borderColor=qte.phase==='pass'?'#a9c49a':'#ded6b7';}
function qtePress(code){if(!qte||mode!=='qte'||qte.phase!=='prompt')return;const eq={ArrowUp:'KeyW',ArrowRight:'KeyD',ArrowDown:'KeyS',ArrowLeft:'KeyA'};code=eq[code]||code;if(!['KeyW','KeyA','KeyS','KeyD','Space'].includes(code))return;if(code===chaseSteps[qte.step].code){qte.phase='pass';qte.phaseTime=0;sound.sfx('qte');kit.input.rumble(.25,70);paintQTE();}else failChase('That was the wrong turn.');}
function qteLabel(s){const src=kit.input.source;if(src==='gamepad')return {KeyW:'↑',KeyD:'→',Space:'A'}[s.code]||s.key;if(src==='touch')return 'TAP';return s.key;}
function failChase(why){player.y=0;player.walk=0;qte=null;sound.sfx('fail');kit.input.rumble(.6,220);setMode('roam');const pad=kit.input.source==='gamepad';openModal('He slipped away.','QUICK TIME EVENT',`<p>${why}</p><p>${pad?'Press each button when it appears. The sequence is <strong>up, right, A</strong>.':'Press each key when it appears. The sequence is <strong>W, D, Space</strong>. You can also click or tap the large key.'}</p><div class="modalHint">Options → Relaxed timing gives you more time.</div>`,[{text:'Try the chase again',fn:()=>startChase()},{text:'Return to the freight board',fn:()=>{player.x=12.6;player.z=-5.4;camYaw=-PI/2;}}],false);}
function updateChase(dt){if(!qte)return;qte.time+=dt;qte.phaseTime+=dt;const max=options.relaxed?4.7:2.8;if(qte.phase==='ready'&&qte.phaseTime>.65){qte.phase='prompt';qte.phaseTime=0;sound.sfx('qte');paintQTE();}
 if(qte.phase==='prompt'){$('qteCircle').style.setProperty('--progress',(100*(1-qte.phaseTime/max))+'%');if(qte.phaseTime>max){failChase('The courier reached the next alley.');return;}}
 if(qte.phase==='pass'){$('qteCircle').style.setProperty('--progress','100%');if(qte.phaseTime>.65){qte.step++;if(qte.step>=3){qte=null;player.y=0;G.qteWins++;stageTo(5);fadeTo(()=>battleIntro());return;}qte.phase='ready';qte.phaseTime=0;paintQTE();}}
 let fraction=qte.phase==='pass'?.72+qte.phaseTime*.43:qte.phase==='ready'?.12:qte.phaseTime/max*.5+.2;let goal=(qte.step+clamp(fraction,0,1))/3;qte.travel=mix(qte.travel,goal,Math.min(1,dt*5));let seg=Math.min(2,Math.floor(qte.travel*3)),r=qte.travel*3-seg,a=chasePath[seg],b=chasePath[seg+1];player.x=mix(a[0],b[0],r);player.z=mix(a[1],b[1],r);player.yaw=Math.atan2(a[0]-b[0],a[1]-b[1]);player.walk=1;player.phase+=dt*11;player.y=qte.step===0&&qte.phase==='pass'?Math.sin(qte.phaseTime/.65*PI)*.78:0;
}
function makeEnemies(){return [{id:0,name:'Dock hand',x:-2,z:-32.2,yaw:PI,health:74,maxHealth:74,coat:'#826e5c',pants:'#4c595b',hair:'#363730',walk:0,phase:0,cool:.9,wind:0,attackTime:0,attackKind:'punch',attackHit:false,hit:0,dead:false},{id:1,name:'Lookout',x:5.2,z:-33,yaw:PI,health:82,maxHealth:82,coat:'#536773',pants:'#454e51',hair:'#3d3027',walk:0,phase:2,cool:1.8,wind:0,attackTime:0,attackKind:'punch',attackHit:false,hit:0,dead:false}];}
function battleIntro(resume=false){setMode('roam');player.x=1.5;player.z=-27.3;player.y=0;player.yaw=.1;enemies=makeEnemies();camYaw=.08;camZoom=6.5;talk(resume?[{n:'Jun',t:'They still have the cargo pass. I have to get it back.'}]:[{n:'Courier',t:'You want that pass? Talk to them.'},{n:'Dock hand',t:'The ledger is not yours to take.'},{n:'Jun',t:'It belongs to my father. Step aside.'}],()=>openModal('Stand your ground.','FREE BATTLE','<p><strong>J</strong> punches. <strong>K</strong> kicks. Hold <strong>Space</strong> to guard. Use <strong>L</strong> to step back and evade.</p><p>A red warning marks an incoming strike. Guard, then answer with a kick. Three quick punches make a combo.</p><div class="modalHint">W A S D / MOVE &nbsp; · &nbsp; ATTACKS FACE THE NEAREST OPPONENT<br>A loss restarts this fight. Your story progress stays safe.</div>',[{text:'Ready',fn:()=>beginBattle()}],false),enemies[0]);}
function beginBattle(){clearKeys();enemies=makeEnemies();player.health=100;player.x=1.5;player.z=-27.3;player.y=0;player.walk=0;player.attackTime=0;player.cool=0;player.invuln=.4;player.hit=0;player.evadeCool=0;player.dead=false;player.combo=0;player.comboTime=0;camYaw=.08;camZoom=7.5;camManual=0;battleWinDelay=0;battleCount++;setMode('combat');updateHUD();}
function nearestEnemy(){let best=null,d=Infinity;for(let e of enemies)if(e.health>0){let dd=dist(e,player);if(dd<d){best=e;d=dd;}}return best;}
function playerAttack(kind){if(mode!=='combat'||player.cool>0||player.attackTime>0||player.dead)return;let e=nearestEnemy();if(!e)return;player.yaw=Math.atan2(player.x-e.x,player.z-e.z);player.attackKind=kind;player.attackTime=kind==='kick'?.56:.42;player.cool=kind==='kick'?.8:.44;player.attackHit=false;player.block=false;if(kind==='punch'){player.combo=player.comboTime>0?(player.combo%3)+1:1;player.comboTime=1.45;}else player.combo=0;sound.sfx('swing');}
function evade(){if(mode!=='combat'||player.evadeCool>0||player.dead)return;player.evadeCool=1.0;player.invuln=.65;player.attackTime=0;player.walk=0;let e=nearestEnemy();if(e){let dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz)||1;tryMove(player,dx/d*1.35,dz/d*1.35,.34,true);}sound.sfx('swing');toast('FREE BATTLE','A step out of reach','');toastUntil=worldTime+.7;}
function damageEnemy(e,amount,kick=false){e.health=Math.max(0,e.health-amount);e.hit=.28;e.wind=0;e.attackTime=0;e.cool=.55;let dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz)||1;tryMove(e,dx/d*(kick?.68:.28),dz/d*(kick?.68:.28),.33,true);sound.sfx(kick?'kick':'punch');screenShake=kick?.15:.08;kit.input.rumble(kick?.45:.25,kick?110:70);if(kick)hitStop=Math.max(hitStop,.05);if(e.health<=0){e.dead=true;e.walk=0;hitStop=Math.max(hitStop,.09);}}
function damagePlayer(amount,e){if(player.invuln>0||player.dead)return;const block=player.block;let actual=block?Math.ceil(amount*.15):amount;player.health=Math.max(0,player.health-actual);player.hit=block?.10:.32;player.invuln=block?.12:.4;damageAlpha=block?.15:.55;screenShake=block?.04:.18;sound.sfx(block?'block':'punch');kit.input.rumble(block?.2:.7,block?60:180);if(!block){let dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz)||1;tryMove(player,dx/d*.3,dz/d*.3,.34,true);player.attackTime=0;}if(player.health<=0){player.dead=true;player.walk=0;if(spar){sparKnockdown();return;}openModal('Back on your feet.','FREE BATTLE / RETRY','<p>Guard while the red warning is visible. Then use a kick to make room.</p><p>Your story progress is safe. This restarts only the fight.</p>',[{text:'Try the fight again',fn:()=>beginBattle()},{text:'Save and return to title',fn:()=>goTitle()}],false);}}
function updateBattle(dt){player.cool=Math.max(0,player.cool-dt);player.invuln=Math.max(0,player.invuln-dt);player.evadeCool=Math.max(0,player.evadeCool-dt);player.hit=Math.max(0,player.hit-dt);player.comboTime=Math.max(0,player.comboTime-dt);player.block=!!keys.Space&&player.attackTime<=0;if(keys.KeyJ)playerAttack('punch');else if(keys.KeyK)playerAttack('kick');
 updatePlayer(dt,true);if(player.attackTime>0){player.attackTime=Math.max(0,player.attackTime-dt);if(!player.attackHit&&player.attackTime<.27){player.attackHit=true;let e=nearestEnemy(),range=player.attackKind==='kick'?2.7:2.12;if(e&&dist(e,player)<range){if(spar&&player.attackKind==='punch'&&player.combo===3)spar.combos++;damageEnemy(e,player.attackKind==='kick'?23:player.combo===3?23:14,player.attackKind==='kick'||player.combo===3);}}}
 for(let e of enemies){if(e.health<=0)continue;e.hit=Math.max(0,e.hit-dt);e.cool=Math.max(0,e.cool-dt);let dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz)||.01;e.yaw+=angdiff(e.yaw,Math.atan2(-dx,-dz))*Math.min(1,dt*7);e.walk=0;
 if(e.attackTime>0){e.attackTime=Math.max(0,e.attackTime-dt);if(e.attackTime<.24&&!e.attackHit){e.attackHit=true;if(d<(e.attackKind==='kick'?2.7:2.3)){damagePlayer(e.power?(options.relaxed?Math.round(e.power*.7):e.power):(options.relaxed?10:(e.id?16:13)),e);if(mode!=='combat')return;}}}
 else if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.attackTime=.42;e.attackHit=false;e.cool=1.3+e.id*.6;}}
 else if(d>1.65){let speed=e.heavy?1.15:1.35,side=e.id===0?-.12:e.id===1?.12:.02,nx=(dx/d+dz/d*side)*speed*dt,nz=(dz/d-dx/d*side)*speed*dt;for(const other of enemies)if(other!==e&&other.health>0&&Math.hypot(e.x+nx-other.x,e.z+nz-other.z)<.75){nx+=(e.x-other.x)*dt;nz+=(e.z-other.z)*dt;}tryMove(e,nx,nz,.34,true);e.walk=.7;e.phase+=dt*6;}
 else if(e.cool<=0&&player.health>0){if(enemies.length>2&&enemies.filter(a=>a.health>0&&(a.wind>0||a.attackTime>0)).length>=2)e.cool=.35;else{e.wind=(options.relaxed?1.05:.72)+(e.heavy?.25:0);e.attackKind=e.heavy&&Math.random()<.5?'kick':'punch';e.attackHit=false;}}
 }
 if(enemies.every(e=>e.health<=0)){battleWinDelay+=dt;if(battleWinDelay>1.3){finishBattle();return;}}updateFightBars();
}
function finishBattle(){player.attackTime=0;player.walk=0;player.block=false;G.battleWon=true;stageTo(6);setMode('roam');camZoom=5.5;talk([{n:'Dock hand',t:'All right. Take the pass.'},{n:'Jun',t:'Warehouse 08?'},{n:'Dock hand',t:'The old man is waiting. Just leave us alone.'},{n:'Jun',t:'I see.'}],()=>{saveGame();toast('POCKET','Stamped cargo pass','The door to Warehouse 08 is open to you.');},enemies[0]);}
/* Yard sparring: an after-story side activity on the same fight system. Nobu sets it up
   once the loading-yard fight is won (or in practice): three rounds against the dock crew,
   the last one with Goro, a foreman who telegraphs heavy kicks. Health carries between
   rounds; a knockdown retries the round and costs the clean bonus. Best time is saved. */
let spar=null;
const SPAR_WAVES=[
 {title:'WARM-UP',crew:[['Dock hand',60,11,'#826e5c','#4c595b',-2,-32.4],['Dock hand',60,11,'#6f7a63','#48524f',5,-33]]},
 {title:'THE LOOKOUTS',crew:[['Lookout',66,12,'#536773','#454e51',-4,-33],['Lookout',66,12,'#5d6f67','#3f4a4c',1.8,-34.6],['Lookout',66,12,'#6d6475','#44444e',7,-32.2]]},
 {title:'GORO, THE YARD FOREMAN',crew:[['Goro',150,18,'#7a5a44','#3b4648',1.5,-34.6,{cap:'#c7ab66',vest:true,heavy:true,hair:'#2b2a26'}],['Dock hand',64,12,'#826e5c','#4c595b',-4.5,-31.6]]}
];
function makeSparWave(i){return SPAR_WAVES[i].crew.map((c,id)=>({id,name:c[0],x:c[5],z:c[6],yaw:PI,health:c[1],maxHealth:c[1],power:c[2],coat:c[3],pants:c[4],hair:'#363730',walk:0,phase:id*2,cool:1+id*.7,wind:0,attackTime:0,attackKind:'punch',attackHit:false,hit:0,dead:false,...(c[7]||{})}));}
function sparControls(){const src=kit.input.source;return src==='gamepad'?'X PUNCH · Y KICK · LT GUARD · B EVADE':src==='touch'?'PUNCH · KICK · GUARD · EVADE BUTTONS':'J PUNCH · K KICK · SPACE GUARD · L EVADE';}
function startSpar(){if(G.work){talk([{n:'Nobu',t:'Finish your shift first. The crew will still be there.'}],null,npc('sailor'));return;}
 openModal('Yard sparring.','THE LOADING YARD / THREE ROUNDS','<p>The dock crew spars after the shift. Three rounds, one after another. Your health carries over, with a short breather between rounds.</p><p><strong>Round 1</strong> · two dock hands.<br><strong>Round 2</strong> · three lookouts.<br><strong>Round 3</strong> · Goro, the yard foreman. Watch for his kick.</p><div class="modalHint">'+sparControls()+'<br>A win pays ¥400, and ¥200 more without a knockdown. Your best time is kept.</div>',[{text:'Start the first round',fn:()=>fadeTo(()=>{(G.sparStats||(G.sparStats={wins:0,best:0,runs:0})).runs++;spar={wave:0,time:0,combos:0,knockdowns:0};beginSparWave(0,false);})},{text:'Not now',fn:()=>{}}]);}
function beginSparWave(i,retry){clearKeys();spar.wave=i;enemies=makeSparWave(i);if(i===0||retry)player.health=100;player.x=1.5;player.z=-27.3;player.y=0;player.yaw=0;player.walk=0;player.attackTime=0;player.cool=0;player.invuln=.8;player.hit=0;player.evadeCool=0;player.dead=false;player.combo=0;player.comboTime=0;player.block=false;camYaw=.08;camZoom=7.5;camManual=0;battleWinDelay=0;setMode('combat');$('fightTitle').textContent='YARD SPARRING / ROUND '+(i+1)+' OF 3 · '+SPAR_WAVES[i].title;updateFightBars();sound.sfx('note');}
function sparKnockdown(){spar.knockdowns++;kit.input.rumble(.8,260);openModal('Back on your feet.','YARD SPARRING / ROUND '+(spar.wave+1),'<p>Guard while the red warning is up, then answer with a kick. Goro winds up longer before his kick: step out of reach, then close in.</p><p>Retry this round with full health. A knockdown costs the ¥200 clean bonus.</p>',[{text:'Retry the round',fn:()=>beginBattle()},{text:'Leave the sparring',fn:()=>leaveSpar()}],false);}
function leaveSpar(){spar=null;enemies=[];player.dead=false;player.health=100;player.attackTime=0;player.walk=0;player.block=false;setMode('roam');camZoom=options.cameraDistance;$('fightTitle').textContent='FREE BATTLE / THE LOADING YARD';saveGame(true);}
function finishSpar(){const s=spar;spar=null;const clean=!s.knockdowns,pay=400+(clean?200:0),rec=G.sparStats||(G.sparStats={wins:0,best:0,runs:0}),best=!rec.best||s.time<rec.best;rec.wins++;if(best)rec.best=Math.round(s.time*10)/10;G.cash+=pay;enemies=[];player.attackTime=0;player.walk=0;player.block=false;player.health=100;setMode('roam');camZoom=options.cameraDistance;$('fightTitle').textContent='FREE BATTLE / THE LOADING YARD';updateHUD();saveGame();sound.sfx('success');kit.input.rumble(.4,160);
 openModal(formatDuration(s.time),'YARD SPARRING / COMPLETE'+(best?' / PERSONAL BEST':''),'<p>Three rounds. Goro offers his hand. The crew goes back to work.</p><div class="payRows"><div><span>Sparring purse</span><b>¥400</b></div><div><span>No knockdowns</span><b>¥'+(clean?200:0)+'</b></div><div class="payTotal"><span>PAID</span><b>¥'+pay+'</b></div></div><p class="payFine">Best time '+formatDuration(rec.best)+' · '+rec.wins+(rec.wins===1?' win':' wins')+' · '+s.combos+' three-punch combos · '+s.knockdowns+' knockdowns</p>',[{text:'Back to the harbour',fn:()=>{}},{text:'Spar again',fn:()=>startSpar()}],false);}
const sparBaseBeginBattle=beginBattle;
beginBattle=function(){if(spar){beginSparWave(spar.wave,true);return;}sparBaseBeginBattle();$('fightTitle').textContent='FREE BATTLE / THE LOADING YARD';updateFightBars();};
const sparBaseFinishBattle=finishBattle;
finishBattle=function(){if(!spar){sparBaseFinishBattle();return;}player.attackTime=0;player.block=false;const next=spar.wave+1;if(next>=SPAR_WAVES.length){finishSpar();return;}player.health=Math.min(100,player.health+30);sound.sfx('note');fadeTo(()=>{if(spar)beginSparWave(next,false);});};
const sparBaseUpdateBattle=updateBattle;
updateBattle=function(dt){if(spar)spar.time+=dt;sparBaseUpdateBattle(dt);};
const fightBars=new Map();
function setBar(id,pct){const v=Math.round(clamp(pct,0,100)*10)/10;if(fightBars.get(id)!==v){fightBars.set(id,v);const el=$(id);if(el)el.style.width=v+'%';}}
function ensureEnemyBars(n){const box=$('enemyBars');if(box.children.length===n)return;box.innerHTML=Array.from({length:n},(_,i)=>'<div class="health"><i id="enemyHP'+i+'"></i></div>').join('');for(let i=0;i<n;i++)fightBars.delete('enemyHP'+i);}
function updateFightBars(){setBar('playerHP',player.health);ensureEnemyBars(enemies.length);for(let i=0;i<enemies.length;i++)setBar('enemyHP'+i,enemies[i].health/enemies[i].maxHealth*100);let alive=0;for(const e of enemies)if(e.health>0)alive++;const label=spar?(alive===1?'ONE LEFT':alive+' LEFT')+' · ROUND '+(spar.wave+1)+' / 3':alive===1?'ONE LEFT':'TWO DOCK HANDS';if($('enemyNames').textContent!==label)$('enemyNames').textContent=label;}
const dartOrder=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
function startDarts(){darts={aimX:310,aimY:310,sightX:310,sightY:310,throws:[],scores:[],cool:0,doneWait:0};setMode('darts');show('dartsOverlay');$('dartScore').textContent='000';$('dartStat').textContent='THROW 1 OF 3';$('dartMessage').textContent='A steady hand. A little luck.';for(let i=0;i<3;i++)$('throw'+i).textContent='—';drawDarts();}
function dartValue(x,y){let dx=x-310,dy=y-310,r=Math.hypot(dx,dy);if(r>225)return {value:0,name:'Miss'};if(r<10)return{value:50,name:'Bullseye'};if(r<23)return{value:25,name:'Outer bull'};let a=(Math.atan2(dx,-dy)+PI/20+TAU)%TAU,i=Math.floor(a/(TAU/20))%20,n=dartOrder[i],m=r>209?2:r>=128&&r<=143?3:1;return{value:n*m,name:(m===3?'Triple ':m===2?'Double ':'')+n};}
function throwDart(){if(mode!=='darts'||!darts||darts.cool>0||darts.throws.length>=3)return;let v=dartValue(darts.sightX,darts.sightY);darts.throws.push({x:darts.sightX,y:darts.sightY});darts.scores.push(v.value);darts.cool=.72;sound.sfx('dart');kit.input.rumble(.15,40);$('throw'+(darts.throws.length-1)).textContent=v.value;$('dartMessage').textContent=v.name.toUpperCase();let total=darts.scores.reduce((a,b)=>a+b,0);$('dartScore').textContent=String(total).padStart(3,'0');$('dartStat').textContent=darts.throws.length<3?'THROW '+(darts.throws.length+1)+' OF 3':'THREE DARTS THROWN';}
function leaveDarts(){show('dartsOverlay',false);darts=null;setMode('roam');saveGame(true);}
function finishDarts(){let total=darts.scores.reduce((a,b)=>a+b,0),reward=total>=100?250:total>=60?150:0;G.dartsPlayed++;G.bestDarts=Math.max(G.bestDarts,total);G.cash+=reward;leaveDarts();saveGame();sound.sfx(reward?'success':'note');openModal(total+' points.',reward?'A STEADY HAND':'LUCKY DARTS','<p>'+(reward?'Hana puts ¥'+reward+' on the counter. A good set of throws.':'A quiet game. The next one might go better.')+'</p><p>Your best score: <strong>'+G.bestDarts+'</strong>.</p>',[{text:'Return to the harbour',fn:()=>{}},{text:'Play again — ¥50',fn:()=>purchase(50,()=>startDarts())}]);}
function updateDarts(dt){if(!darts)return;darts.cool=Math.max(0,darts.cool-dt);let axis=moveAxis();darts.aimX=clamp(darts.aimX+axis.x*dt*180,45,575);darts.aimY=clamp(darts.aimY-axis.y*dt*180,45,575);darts.sightX=darts.aimX+Math.sin(worldTime*2.7)*9+Math.sin(worldTime*5.3)*3;darts.sightY=darts.aimY+Math.cos(worldTime*2.1)*9+Math.sin(worldTime*4.2)*3;if(darts.throws.length>=3){darts.doneWait+=dt;if(darts.doneWait>1.35){finishDarts();return;}}drawDarts();}
function drawDarts(){if(!darts)return;let c=$('dartCanvas').getContext('2d');c.clearRect(0,0,620,620);c.fillStyle='#172e30';c.beginPath();c.arc(310,310,286,0,TAU);c.fill();c.strokeStyle='#b7a77b';c.lineWidth=1;c.stroke();c.beginPath();c.arc(310,310,265,0,TAU);c.stroke();
 function segment(a,b,r1,r2,color){c.fillStyle=color;c.beginPath();c.arc(310,310,r2,a,b);c.arc(310,310,r1,b,a,true);c.closePath();c.fill();c.strokeStyle='#ddd5ad66';c.lineWidth=.6;c.stroke();}
 for(let i=0;i<20;i++){let a=-PI/2-PI/20+i*TAU/20,b=a+TAU/20;segment(a,b,23,225,i%2?'#d6d2b5':'#2b4240');segment(a,b,209,225,i%2?'#63856e':'#b65d46');segment(a,b,128,143,i%2?'#63856e':'#b65d46');let ang=-PI/2+i*TAU/20;c.fillStyle='#e3d9b6';c.font='22px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(dartOrder[i],310+Math.cos(ang)*250,310+Math.sin(ang)*250);}
 for(let [r,col] of [[23,'#5a8169'],[10,'#b3634d']]){c.beginPath();c.arc(310,310,r,0,TAU);c.fillStyle=col;c.fill();c.strokeStyle='#d7ccaa';c.lineWidth=1;c.stroke();}
 c.fillStyle='#a6bda9';c.font='9px Arial';c.fillText('BREAKWATER TEA · NAGAMATSU',310,606);
 darts.throws.forEach((d,i)=>{c.strokeStyle='#0c2529';c.lineWidth=4;c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x+17,d.y-30);c.stroke();c.strokeStyle='#d2c6a1';c.lineWidth=2;c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x+20,d.y-35);c.stroke();c.fillStyle=['#c98054','#8bacad','#d0b776'][i];c.beginPath();c.moveTo(d.x+12,d.y-30);c.lineTo(d.x+19,d.y-45);c.lineTo(d.x+28,d.y-30);c.lineTo(d.x+21,d.y-26);c.fill();});
 if(darts.throws.length<3){let x=darts.sightX,y=darts.sightY;c.strokeStyle='#f1e6b8';c.lineWidth=1.5;c.beginPath();c.arc(x,y,9,0,TAU);c.moveTo(x-16,y);c.lineTo(x-5,y);c.moveTo(x+5,y);c.lineTo(x+16,y);c.moveTo(x,y-16);c.lineTo(x,y-5);c.moveTo(x,y+5);c.lineTo(x,y+16);c.stroke();}
}
function openBook(tab='leads'){if(mode==='book'){renderBook(tab);return;}bookPrev=mode;sound.sfx('click');setMode('book');show('bookOverlay');renderBook(tab);}
function closeBook(){show('bookOverlay',false);setMode(bookPrev);sound.sfx('click');}
function renderBook(tab){currentTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));let h='';
 if(tab==='leads'){
 let history=[['Father\'s letter','A red ledger. A crate marked with a blue crane.'],['The gate guard','Hana at Breakwater Tea knows the shipping companies.'],['Hana\'s lead','Daichi moved the Kita shipment. Find the orange forklift.'],['The foreman','Help Daichi move three crates to Warehouse 03.'],['A day\'s work','The cargo pass is on the freight board at Warehouse 03.'],['The courier','He took the pass. The loading yard is guarded.'],['The cargo pass','Warehouse 08. An old man is waiting.'],['The last shipment','Father is alive. The ferry to Kobe leaves at six.']];
 let list=history.slice(0,G.stage+1).map((a,i)=>'<li class="'+(i===G.stage?'current':'done')+'">'+a[1]+'</li>').join('');h='<div class="bookColumns"><div><h4>The last shipment</h4><h3>What I know.</h3><ul class="notes">'+list+'</ul></div><div><h4>My next step</h4><h3>'+leads[G.stage][0]+'</h3><p>'+leads[G.stage][1]+'</p><p>'+(['The guard stands just inside the east gate.','The tea shop is by the water. Look for its green awning.','The work yard is north of the tea shop.','The pickup crates have yellow marks. The drop bay is in front of the building marked 03.','The board is fixed to the west wall of Warehouse 03, below the blue freight sign.','Guard the first strike. Answer with a kick.','Follow the road north to the building marked 08.','Nothing else is urgent. Have a drink, feed the cat, or try a game of darts. Nobu, by the water, knows where the dock crew spars.'][G.stage])+'</p><button class="secondary" id="bookMapBtn">OPEN THE HARBOUR MAP</button><div style="margin-top:35px"><h4>Small moments</h4><p>'+(G.catFed?'✓ The cat has eaten.':'The cat by the bench looks hungry.')+'<br>'+(G.drinks?'✓ A drink by the water.':'I could stop for a drink.')+'<br>'+(G.dartsPlayed?'✓ A game of darts.':'Hana has a dartboard by the shop.')+'</p></div></div></div>';
 }else if(tab==='map')h='<div class="bookColumns"><div><h4>Nagamatsu / east quay</h4><canvas id="mapCanvas" width="460" height="460" aria-label="Map of the harbour. Your position is red. Your next lead is gold."></canvas><div class="mapLegend">● YOU &nbsp; ◇ NEXT LEAD &nbsp; ↑ NORTH</div></div><div><h4>My next step</h4><h3>'+leads[G.stage][0]+'</h3><p>'+leads[G.stage][1]+'</p><ul class="notes"><li>01 — East gate and tea shop</li><li>03 — Freight board and loading bay</li><li>08 — Old warehouse district</li></ul><p style="margin-top:22px">Keep the sea on your left to go north. The road links all three warehouses.</p><p>There is no time limit. The next lead will still be there.</p></div></div>';
 else if(tab==='pocket'){
 const item=(icon,title,desc)=>'<div class="item"><div class="itemIcon">'+icon+'</div><div><strong>'+title+'</strong><small>'+desc+'</small></div></div>';
 h='<div class="bookColumns"><div><h4>Things worth keeping</h4><h3>In my pocket.</h3>'+item('¥','¥'+G.cash.toLocaleString(),'Daily allowance and work pay.')+item('✉','Father\'s letter','A harbour address. The ink is faint.')+(G.stage>=4?item('▤','Kita cargo record','Warehouse 08. One red ledger.'):'')+(G.stage>=6?item('▣','Stamped cargo pass','Permission to enter Warehouse 08.'):'')+(G.stage>=7?item('▥','The red ledger','A ferry ticket rests between its pages.'):'')+(G.hasBun?item('◒','A warm fish bun','For the cat by the bench.'):'')+'</div><div><h4>Pocket Port / capsule toys</h4><h3>A little collection.</h3><p>'+Object.keys(G.toys).filter(k=>G.toys[k]>0).length+' of 6 figures found. The machine is next to the red vending machine.</p><div class="toyGrid">'+toyNames.map((n,i)=>'<div class="toy '+(!G.toys[i]?'missing':'')+'"><div class="toyArt">'+toySVG(i)+'</div><span>'+(G.toys[i]?n+' ×'+G.toys[i]:'No. 0'+(i+1))+'</span></div>').join('')+'</div><p style="margin-top:22px">Best darts score: '+G.bestDarts+'<br>Extra shifts worked: '+G.sideShifts+'</p></div></div>';
 }else if(tab==='controls')h='<div class="bookColumns"><div><h4>Take your time</h4><h3>Walking the harbour.</h3><div class="controlsGrid"><div><span class="key">W A S D</span></div><div>Move. Arrow keys also work.</div><div><span class="key">SHIFT</span></div><div>Run.</div><div><span class="key">E</span></div><div>Talk, examine, or use an object.</div><div><span class="key">N</span></div><div>Open this notebook.</div><div><span class="key">C</span></div><div>Put the camera behind Jun.</div><div>DRAG MOUSE</div><div>Turn the camera. Use the wheel to zoom.</div><div><span class="key">Z</span></div><div>Hold to look closely.</div><div><span class="key">ESC</span></div><div>Pause or close a page.</div><div><span class="key">M</span> <span class="key">F</span></div><div>Mute sound / full screen.</div></div><p style="margin-top:24px">Classic controls are in Options. In that mode, A and D turn Jun, and W and S move him forward and back.</p></div><div><h4>A little more action</h4><h3>Work and free battle.</h3><div class="controlsGrid"><div><span class="key">W / S</span></div><div>Drive / reverse the forklift.</div><div><span class="key">A / D</span></div><div>Steer the forklift.</div><div><span class="key">E</span></div><div>Lift a crate. Lower it in the yellow bay.</div><div><span class="key">SPACE</span></div><div>Brake. In battle, hold to guard.</div><div><span class="key">X</span> <span class="key">R</span></div><div>Leave / recover the forklift.</div><div><span class="key">J</span> <span class="key">K</span></div><div>Punch / kick. Hold to repeat.</div><div><span class="key">L</span></div><div>Step back and evade.</div></div><p style="margin-top:24px">Quick-time events show the key to press. You can click the key instead. Relaxed timing is in Options.</p><h4>Gamepad and touch</h4><p>Left stick: move. Right stick: camera.<br>A: use. B: run / evade. X: punch. Y: kick.<br>Left trigger: guard. Start: pause.<br>Touch controls appear on touch screens.</p></div></div>';
 else if(tab==='options'){
 const setting=(name,detail,id,label)=>'<div class="setting"><div>'+name+'<small>'+detail+'</small></div><button id="'+id+'">'+label+'</button></div>';
 h='<div class="bookColumns"><div><h4>Make yourself at home</h4><h3>Play your way.</h3>'+setting('Movement','Camera-relative or classic turning.','optTank',options.tank?'CLASSIC':'CAMERA')+setting('Lead markers','Show the next lead in the world.','optGuides',options.guides?'ON':'OFF')+setting('Relaxed timing','More time for chase keys and enemy warnings.','optRelaxed',options.relaxed?'ON':'OFF')+setting('Graphics','Quality, resolution, frame rate and touch layout. Also F9.','optGraphics','OPEN')+setting('Shadows','Turn off on slower devices.','optShadows',options.shadows?'ON':'OFF')+setting('Changing weather','Light rain during the afternoon.','optWeather',options.weather?'ON':'CLEAR')+'</div><div><h4>The sound of the port</h4><h3>Listen a little.</h3>'+setting('Sound','Music, waves, gulls, and work.','optMute',options.muted?'MUTED':'ON')+'<div class="setting"><div>Volume<small>Original, generated music and sound effects.</small></div><input type="range" id="optVolume" min="0" max="1" step=".05" aria-label="Volume" value="'+options.volume+'"></div>'+setting('Device voices','Use an installed English voice, when available.','optVoices',options.voices?'ON':'OFF')+'<div style="margin:20px 0"><button id="optFull" class="secondary">FULL SCREEN</button></div><h4>Sham-mue / credits</h4><p style="font-size:13px">An original harbour adventure inspired by Shenmue on Dreamcast. This is a tribute, not a port. It is not affiliated with SEGA.</p><p style="font-size:13px">Models, textures, story, music, and sound effects are made for this game. It draws with the shared three.js kit (WebGPU, or WebGL 2) and needs no network.</p><p style="font-size:12px">Progress saves in this browser. Private browsing or cleared site data can remove that save. Device voices are optional and depend on your system.</p></div></div>';
 }
 $('bookBody').innerHTML=h;$('bookBody').scrollTop=0;$('bookFooterText').textContent=tab==='pocket'?'KEEP THE SMALL THINGS.':tab==='options'?'SHAM-MUE / THE LAST SHIPMENT':'LOOK CAREFULLY. ASK AGAIN.';
 if(tab==='leads')$('bookMapBtn').onclick=()=>renderBook('map');if(tab==='map')drawMap();if(tab==='options'){const bind=(id,key,fn)=>{$(id).onclick=()=>{options[key]=fn?fn(options[key]):!options[key];sound.init();persistOptions();renderBook('options');sound.sfx('click');};};bind('optTank','tank');bind('optGuides','guides');bind('optRelaxed','relaxed');$('optGraphics').onclick=()=>{sound.sfx('click');kit.menu.open();};bind('optShadows','shadows');bind('optWeather','weather');bind('optMute','muted');bind('optVoices','voices');$('optVolume').oninput=e=>{options.volume=Number(e.target.value);sound.init();persistOptions();};$('optFull').onclick=toggleFullscreen;}
}
function drawMap(){const c=$('mapCanvas').getContext('2d'),w=460,h=460;const sx=x=>(x+43)/81*410+25,sz=z=>(z+44)/83*410+25;c.clearRect(0,0,w,h);c.fillStyle='#bcc6b3';c.fillRect(0,0,w,h);c.fillStyle='#dfd8bb';c.fillRect(sx(-33),sz(-43),sx(35)-sx(-33),sz(37)-sz(-43));c.strokeStyle='#879983';c.lineWidth=1;for(let i=25;i<460;i+=25){c.beginPath();c.moveTo(i,0);c.lineTo(i,460);c.moveTo(0,i);c.lineTo(460,i);c.strokeStyle='#85958018';c.stroke();}
 const rect=(x,z,w,d,col)=>{c.fillStyle=col;c.fillRect(sx(x-w/2),sz(z-d/2),w/81*410,d/83*410);};rect(1,-2,24,76,'#cbcbb0');c.setLineDash([4,4]);c.strokeStyle='#8f9b84';c.beginPath();c.moveTo(sx(1),sz(-41));c.lineTo(sx(1),sz(35));c.stroke();c.setLineDash([]);c.font='bold 19px Georgia';c.textAlign='center';c.textBaseline='middle';
 for(let [x,z,num,d] of [[25,24,'01',20],[25,0,'03',22],[25,-28,'08',24]]){rect(x,z,18,d,'#8fa391');c.fillStyle='#3d6157';c.fillText(num,sx(x),sz(z));}rect(-22,22,9,6,'#829986');rect(6.5,30.6,3.4,3.2,'#94a58e');for(let z of [-18,-30,-7])rect(-24,z,8,3,'#9da788');
 rect(9,-10,6,7,'#baac74');c.strokeStyle='#596f5c';c.strokeRect(sx(6),sz(-13.5),6/81*410,7/83*410);
 c.fillStyle='#395b52';c.font='10px Arial';c.fillText('TEA',sx(-22),sz(22));c.fillText('EAST GATE',sx(0),sz(37)+14);c.fillText('FREIGHT',sx(8),sz(-2.7));c.save();c.translate(sx(-37),sz(-3));c.rotate(-PI/2);c.font='9px Arial';c.fillStyle='#638775';c.fillText('NAGAMATSU BAY',0,0);c.restore();c.fillStyle='#536f5e';c.fillText('N',432,18);c.beginPath();c.moveTo(432,24);c.lineTo(427,37);c.lineTo(437,37);c.closePath();c.fill();
 for(let a of npcs.filter(a=>['mori','hana','daichi'].includes(a.id))){c.fillStyle='#426c61';c.beginPath();c.arc(sx(a.x),sz(a.z),3,0,TAU);c.fill();}
 let tar=currentGoal();if(tar&&G.stage<7){c.save();c.translate(sx(tar.x),sz(tar.z));c.rotate(PI/4);c.fillStyle='#b78045';c.fillRect(-4,-4,8,8);c.strokeStyle='#734f35';c.strokeRect(-4,-4,8,8);c.restore();}
 c.fillStyle='#a0523f';c.beginPath();c.arc(sx(player.x),sz(player.z),5,0,TAU);c.fill();c.strokeStyle='#f5ead0';c.lineWidth=1.5;c.stroke();c.strokeStyle='#a0523f';c.beginPath();c.moveTo(sx(player.x),sz(player.z));c.lineTo(sx(player.x-Math.sin(player.yaw)*2.4),sz(player.z-Math.cos(player.yaw)*2.4));c.stroke();
 c.strokeStyle='#6e826a66';c.lineWidth=1;c.strokeRect(4,4,452,452);
}
// Keys, left stick, D-pad and the touch stick, clamped to unit length by the kit.
function moveAxis(){return kit.input.vector('move');}
function collides(x,z,r=.34,includeCrates=false){if(x-r< -31||x+r>33||z-r< -40.6||z+r>34.7)return true;for(let o of obstacles){let dx=Math.max(Math.abs(x-o.x)-o.w/2,0),dz=Math.max(Math.abs(z-o.z)-o.d/2,0);if(dx*dx+dz*dz<r*r)return true;}if(includeCrates){for(let c of crates)if(!c.delivered&&c.id!==forklift.carry){let dx=Math.max(Math.abs(x-c.x)-.68,0),dz=Math.max(Math.abs(z-c.z)-.68,0);if(dx*dx+dz*dz<r*r)return true;}}return false;}
function tryMove(a,dx,dz,r=.34,battle=false,vehicle=false){let ox=a.x,oz=a.z;if(!collides(a.x+dx,a.z,r,!battle))a.x+=dx;if(!collides(a.x,a.z+dz,r,!battle))a.z+=dz;if(battle){a.x=clamp(a.x,-9.5,12.5);a.z=clamp(a.z,-38.5,-21.5);}if(a===player&&!battle){for(let n of npcs){if(dist(a,n)<.48){a.x=ox;a.z=oz;break;}}if(dist(a,forklift)<1.07){a.x=ox;a.z=oz;}}return Math.hypot(a.x-ox,a.z-oz);}
function moveToSafe(){for(let r=.5;r<5;r+=.5)for(let j=0;j<12;j++){let x=player.x+Math.sin(j/12*TAU)*r,z=player.z+Math.cos(j/12*TAU)*r;if(!collides(x,z,.35,true)&&Math.hypot(x-forklift.x,z-forklift.z)>1.3){player.x=x;player.z=z;return;}}player.x=0;player.z=31;}
function updatePlayer(dt,battle=false){let a=moveAxis(),mag=Math.hypot(a.x,a.y);let running=!!keys.ShiftLeft;let speed=battle?(player.block?.7:2.1):running?3.8:1.7;let desired=player.yaw,dx=0,dz=0;
 if(options.tank&&!battle){player.yaw-=a.x*dt*1.95;dx=-Math.sin(player.yaw)*a.y;dz=-Math.cos(player.yaw)*a.y;mag=Math.abs(a.y);}else{dx=a.x*Math.cos(camYaw)-a.y*Math.sin(camYaw);dz=-a.x*Math.sin(camYaw)-a.y*Math.cos(camYaw);if(mag>.05){desired=Math.atan2(-dx,-dz);let diff=angdiff(player.yaw,desired);player.yaw+=clamp(diff,-dt*4.2,dt*4.2);if(Math.abs(diff)>1.1)speed*=.57;}}
 if(player.attackTime>0)speed*=.15;if(player.dead)speed=0;let moved=tryMove(player,dx*speed*dt,dz*speed*dt,.32,battle);player.walk=mix(player.walk,moved>.003?running&&!battle?1:.65:0,Math.min(1,dt*10));if(moved>.003){player.phase+=dt*(running&&!battle?10:6.3);stepAccum+=moved;if(stepAccum>(running?.95:.68)){stepAccum=0;sound.sfx('step');}lastAction=worldTime;}player.y=0;
 if(keys.KeyQ){camYaw+=dt*1.4;camManual=worldTime+3;}if(worldTime>camManual){let shouldFollow=options.tank||(worldTime-lastAction>1.3);if(shouldFollow)camYaw+=angdiff(camYaw,player.yaw)*Math.min(1,dt*.8);}
}
function updateForklift(dt){let a=moveAxis(),acc=a.y*3.8;if(keys.Space)forklift.speed*=Math.exp(-dt*12);else if(Math.abs(a.y)>.05)forklift.speed=clamp(forklift.speed+acc*dt,-1.95,3.8);else forklift.speed*=Math.exp(-dt*2.1);if(Math.abs(forklift.speed)<.02)forklift.speed=0;forklift.yaw-=a.x*dt*(.65+Math.min(1,Math.abs(forklift.speed)/2)*.7)*(forklift.speed<-.1?-1:1);let moved=tryMove(forklift,-Math.sin(forklift.yaw)*forklift.speed*dt,-Math.cos(forklift.yaw)*forklift.speed*dt,1.0,false,true);if(moved<.004&&Math.abs(forklift.speed)>.6)forklift.speed*=.4;player.x=forklift.x;player.z=forklift.z;player.yaw=forklift.yaw;camYaw+=angdiff(camYaw,forklift.yaw)*Math.min(1,dt*2.2);if(forklift.carry!==null){let c=crates[forklift.carry],p=frontOfFork();c.x=p.x;c.z=p.z;}}
function updateNPCs(dt){for(let n of npcs){if(n.path){let p=n.path[n.wp],dx=p[0]-n.x,dz=p[1]-n.z,d=Math.hypot(dx,dz);if(d<.15){n.wp=(n.wp+1)%n.path.length;n.walk=0;continue;}if(dist(n,player)<1.5){n.walk=0;continue;}n.x+=dx/d*dt*.65;n.z+=dz/d*dt*.65;n.yaw+=angdiff(n.yaw,Math.atan2(-dx,-dz))*Math.min(1,dt*3);n.walk=.52;n.phase+=dt*5.0;}else n.walk=0;}}
function getInteractions(){const arr=npcs.map(n=>({id:n.id,x:n.x,z:n.z,kind:'person',name:n.name,verb:'SPEAK · '+n.role.toUpperCase(),ref:n,r:2.5}));arr.push({id:'forklift',x:forklift.x,z:forklift.z,name:'Forklift No. 05',verb:'DRIVE',r:2.5},{id:'vending',x:-14.2,z:25.3,name:'Sun Pop',verb:'COLD DRINKS · ¥100',r:2.05},{id:'capsule',x:-11.3,z:25.1,name:'Pocket Port',verb:'CAPSULE TOYS · ¥100',r:1.8},{id:'cat',x:-28.4,z:27.1,name:'A little cat',verb:G.catFed?'SAY HELLO':G.hasBun?'GIVE THE FISH BUN':'LOOK CLOSER',r:2},{id:'darts',x:-28.6,z:20.2,name:'Lucky Darts',verb:'PLAY · ¥50',r:2.2},{id:'board',x:14.3,z:-5.4,name:'Freight manifest',verb:'EXAMINE',r:2.5},{id:'door',x:14.3,z:-28,name:'Warehouse 08',verb:G.stage>=6?'KNOCK':'EXAMINE',r:2.8},{id:'bus',x:-6,z:33,name:'Bus stop',verb:'READ THE TIMETABLE',r:1.8});return arr;}
function updateInteract(){interactable=null;if(mode==='roam'){let dd=Infinity;for(let a of getInteractions()){let d=dist(a,player);if(d<a.r&&d<dd){interactable=a;dd=d;}}if(interactable){$('interactVerb').textContent=interactable.verb;$('interactName').textContent=interactable.name;show('interaction');}else show('interaction',false);}else if(mode==='forklift'){let c=bestCrate();let valid=forklift.carry!==null||c;show('interaction',!!valid);if(valid){$('interactVerb').textContent='STOP, THEN PRESS '+prompts.use;$('interactName').textContent=forklift.carry!==null?(inBay(frontOfFork())||inBay(forklift)?'Deliver cargo':'Lower cargo'):'Lift crate '+(c.id+1);}}else show('interaction',false);}
function currentGoal(){if(G.stage===3||sideShift){if(mode==='forklift'){if(forklift.carry!==null)return{x:9,z:-10,y:1,name:'Delivery bay 03'};let a=crates.filter(c=>!c.delivered&&c.id!==forklift.carry).sort((a,b)=>dist(a,forklift)-dist(b,forklift))[0];return a?{x:a.x,z:a.z,y:2,name:'Crate '+(a.id+1)}:null;}return{x:forklift.x,z:forklift.z,y:3,name:'Forklift 05'};}
 const goals=[{x:2,z:26.4,name:'Mori'},{x:-19.7,z:28.3,name:'Hana'},{x:-8.5,z:2,name:'Daichi'},null,{x:14.3,z:-5.4,name:'Freight board'},{x:2,z:-30,name:'Loading yard'},{x:14.3,z:-28,name:'Warehouse 08'},null];return goals[G.stage];}
function updateHUD(){if(!G)return;let mins=Math.floor(G.clock),hh=Math.floor(mins/60)%24,mm=mins%60;hudText('digital',String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'));hudStyle('hourHand','transform','rotate('+((hh%12)*30+mm*.5)+'deg)');hudStyle('minuteHand','transform','rotate('+(mm*6)+'deg)');hudText('cash','¥ '+G.cash.toLocaleString());hudText('objective',leads[G.stage][1]);hudText('leadNumber',G.stage===7?'CHAPTER COMPLETE':'CURRENT LEAD / '+String(G.stage+1).padStart(2,'0'));hudText('weatherText','DEC 09 · '+(rainAmount>.2?'LIGHT RAIN':G.clock>1050?'EVENING AIR':'SEA BREEZE'));hudText('locationName',player.z<-22?'Old Warehouse District':player.x<-16&&player.z>15?'Breakwater Tea':'Nagamatsu Harbour');hudStyle('compassArrow','transform','rotate('+(-player.yaw*180/PI)+'deg)');
 if(mode==='forklift'){let done=crates.filter(c=>c.delivered).length;hudText('taskTitle',done+' / 3 crates delivered');hudText('taskHint',forklift.carry!==null?'Cargo loaded · E lower · Space brake · X get out':'W / S drive · A / D steer · E lift · R recover');[...$('deliveryPips').children].forEach((el,i)=>el.classList.toggle('done',i<done));}
 if(mode==='combat')updateFightBars();
}
// Runs every frame: the marker and the guard warnings touch the DOM only when they move or change.
const wpPoint=[0,0,0];let warningHTML='';
function updateWaypoints(){if(!renderer)return;let t=currentGoal();if(options.guides&&t&&['roam','forklift'].includes(mode)){wpPoint[0]=t.x;wpPoint[1]=t.y||2.65;wpPoint[2]=t.z;let d=dist(player,t),p=renderer.project(wpPoint);if(p&&d>2.6&&p[0]>.03&&p[0]<.97&&p[1]>.12&&p[1]<.8){show('waypoint');hudStyle('waypoint','left',(p[0]*100).toFixed(2)+'%');hudStyle('waypoint','top',(p[1]*100).toFixed(2)+'%');const label=t.name+' · '+Math.round(d)+' m',el=$('waypointText');if(el.textContent!==label)el.textContent=label;}else show('waypoint',false);}else show('waypoint',false);
 if(mode==='combat'){let h='';for(let e of enemies)if(e.wind>0&&e.health>0){wpPoint[0]=e.x;wpPoint[1]=2.35;wpPoint[2]=e.z;let p=renderer.project(wpPoint);if(p)h+='<div class="warning" style="left:'+(p[0]*100).toFixed(1)+'%;top:'+(p[1]*100).toFixed(1)+'%">GUARD</div>';}if(h!==warningHTML){warningHTML=h;$('enemyWarnings').innerHTML=h;}}
}
let rainAmount=0,hudTick=0,gameRunning=false;
function effectiveMode(){if(mode==='book')return bookPrev;if(mode==='modal')return modalState?.prev||'roam';return mode;}
function cameraCollision(eye,target){for(let j=1;j<=24;j++){let t=j/24,p=add(target,mul(sub(eye,target),t));for(let o of obstacles){let h=o.id==='warehouse'?10:o.id==='tea'?3.8:o.id==='guard'?3.4:o.id==='container'?5.4:0;if(h&&p[1]<h&&p[0]>o.x-o.w/2-.15&&p[0]<o.x+o.w/2+.15&&p[2]>o.z-o.d/2-.15&&p[2]<o.z+o.d/2+.15)return add(target,mul(sub(eye,target),Math.max(.12,(j-1)/24)));}}return eye;}
function updateCamera(dt){let eye,target,em=effectiveMode();if(mode==='title'||!started){eye=[-13+Math.sin(worldTime*.045)*1.5,4.9,32.3];target=[2,2.2,-8];}
 else if(mode==='ending'){eye=[-20+Math.sin(worldTime*.04)*1.3,5.2,7.5];target=[-53,4,-26];}
 else if(mode==='dialogue'&&dialogue){let focus=dialogue.focus,l=dialogue.lines[dialogue.index];if(focus?.name){let speaker=l.n==='Jun'?player:focus,other=l.n==='Jun'?focus:player,dir=norm([other.x-speaker.x,0,other.z-speaker.z]);eye=[speaker.x+dir[0]*2.75+dir[2]*.7,1.9,speaker.z+dir[2]*2.75-dir[0]*.7];target=[speaker.x,1.45,speaker.z];}else if(focus){eye=[focus.x-3.6,2.05,focus.z+1.45];target=[focus.x,1.65,focus.z];}else{eye=[player.x-2.5,2.15,player.z-3.2];target=[player.x,1.38,player.z];}}
 else if(em==='qte'&&qte){camYaw+=angdiff(camYaw,player.yaw)*Math.min(1,dt*3);eye=[player.x+Math.sin(camYaw)*5+.8,3.1,player.z+Math.cos(camYaw)*5];target=[player.x-Math.sin(camYaw)*1.5,1.1,player.z-Math.cos(camYaw)*1.5];}
 else if(em==='combat'){let e=nearestEnemy(),x=e?mix(player.x,e.x,.4):player.x,z=e?mix(player.z,e.z,.4):player.z;eye=[x+Math.sin(camYaw)*7.4,4.8,z+Math.cos(camYaw)*7.4];target=[x,1.05,z];}
 else if(em==='forklift'){eye=[forklift.x+Math.sin(camYaw)*7,4.2+camPitch*1.7,forklift.z+Math.cos(camYaw)*7];target=[forklift.x-Math.sin(camYaw)*.8,1.25,forklift.z-Math.cos(camYaw)*.8];}
 else if(keys.KeyZ&&mode==='roam'){eye=[player.x-Math.sin(camYaw)*.2,1.74,player.z-Math.cos(camYaw)*.2];target=[player.x-Math.sin(camYaw)*5,1.6-camPitch*3,player.z-Math.cos(camYaw)*5];}
 else{eye=[player.x+Math.sin(camYaw)*camZoom+Math.cos(camYaw)*.5,3.15+camPitch*2.3,player.z+Math.cos(camYaw)*camZoom-Math.sin(camYaw)*.5];target=[player.x-Math.sin(camYaw)*.35,1.12,player.z-Math.cos(camYaw)*.35];}
 if(started&&!['title','ending'].includes(mode)&&!(keys.KeyZ&&mode==='roam'))eye=cameraCollision(eye,target);let speed=mode==='dialogue'?4.4:mode==='title'?1.3:7;camEye=camEye.map((v,i)=>mix(v,eye[i],Math.min(1,dt*speed)));camTarget=camTarget.map((v,i)=>mix(v,target[i],Math.min(1,dt*(speed+1))));if(screenShake>0){camEye[0]+=Math.sin(worldTime*71)*screenShake;camEye[1]+=Math.cos(worldTime*67)*screenShake*.4;screenShake=Math.max(0,screenShake-dt*.7);}
}
// One builder is refilled every frame; render.js streams its array into a single dynamic GPU buffer.
const DYN=new MeshBuilder(1<<17);
// Far figures and trucks use fewer sphere and cylinder segments (the silhouette is the same at that range).
function lodAt(x,z){const d=Math.hypot(x-camEye[0],z-camEye[2])/Math.max(.5,kit.tier.detail);return d>42?.45:d>24?.7:1;}
function dynamicWorld(){let b=DYN.reset(),em=effectiveMode();if(em==='capsule'||em==='collection')return buildCollectionScene(b,em);shipMesh(b,worldTime);for(let c of crates)if(c.id!==forklift.carry)cargoMesh(b,c,c.x,0,c.z);
 forkliftMesh(b,forklift,worldTime,em==='forklift'?player:null);
 for(let n of npcs)if(dist(n,player)<70||mode==='title'){b.lod=lodAt(n.x,n.z);character(b,n,worldTime);}b.lod=1;
 if(mode==='title'){character(b,{...player,x:.5,z:23,yaw:.04,walk:0,y:0},worldTime);}else if(em!=='forklift'&&!(keys.KeyZ&&mode==='roam'))character(b,player,worldTime);
 for(let e of enemies)if(dist(e,player)<30||mode==='combat'){b.lod=lodAt(e.x,e.z);character(b,e,worldTime);}b.lod=1;
 if(mode==='dialogue'&&dialogue?.focus?.name==='Enomoto')character(b,dialogue.focus,worldTime);
 catMesh(b,-28.4,27.1,worldTime);if(G.catFed){b.cylinder(-28.05,.07,26.9,.17,.20,.12,T.white,'#b9b7a0',10);b.cylinder(-28.05,.135,26.9,.15,.15,.01,T.white,'#786e51',10);}
 if(em==='qte'&&qte){let yaw=player.yaw,runner={x:player.x-Math.sin(yaw)*3,z:player.z-Math.cos(yaw)*3,yaw,walk:1,phase:player.phase+.5,coat:'#965340',pants:'#43545e',hair:'#3b3028'};character(b,runner,worldTime);b.push(runner.x,0,runner.z,runner.yaw);b.box(.36,.9,-.18,.13,.25,.24,T.paint,'#ded4a2');b.pop();b.box(7.2,.26,-12.8,3,.52,1,T.wood,'#aa9568');if(qte.step===2){b.beam([3,1.7,-25.7],[11,1.7,-25.7],.24,T.hazard,'#d3b572');b.box(11,.8,-25.7,.16,1.6,.16,T.paint,'#6f8679');}}
 if(G.stage===3||sideShift){for(let c of crates)if(!c.delivered&&c.id!==forklift.carry){let s=.86;for(let a of [-1,1]){b.box(c.x+a*s,.035,c.z,.055,.015,1.8,T.white,'#d5bd7e',0,1);b.box(c.x,.035,c.z+a*s,1.8,.015,.055,T.white,'#d5bd7e',0,1);}}}
 if(mode==='combat'){for(let e of enemies)if(e.wind>0&&e.health>0){let pulse=.65+Math.sin(worldTime*15)*.1;b.push(e.x,.025,e.z);for(let i=0;i<24;i++){let a=i/24*TAU,d=(i+1)/24*TAU;b.quad([Math.sin(a)*pulse,0,Math.cos(a)*pulse],[Math.sin(d)*pulse,0,Math.cos(d)*pulse],[Math.sin(d)*(pulse+.07),0,Math.cos(d)*(pulse+.07)],[Math.sin(a)*(pulse+.07),0,Math.cos(a)*(pulse+.07)],T.white,'#c38b58',1,1,1);}b.pop();}}
 for(let i=0;i<9;i++){let tt=worldTime*.11+i*.85,x=-38+Math.sin(tt)*18,z=-29+Math.cos(tt*.8+i)*27,y=11+i*.6+Math.sin(tt*3)*1.3,flap=Math.sin(worldTime*3+i)*.25;b.push(x,y,z,-tt);b.tri([0,0,.16],[-.85,flap,-.03],[-.1,0,-.18],T.white,'#d9dece');b.tri([.1,0,-.18],[.85,flap,-.03],[0,0,.16],T.white,'#d9dece');b.pop();}
 let wave=Math.sin(worldTime*2)*.16;for(let [x,y,z] of [[-12.5,8.4,12],[-28,17.2,-39]]){b.quad([x,y,z],[x+1.5,y+.03,z+wave],[x+1.5,y-.65,z+wave],[x,y-.68,z],T.cloth,'#bd8c68');}
 extraWorldDynamics(b);return b.a;
}
function onPress(code){if(code==='KeyF'){toggleFullscreen();return;}if(code==='KeyM'){sound.init();options.muted=!options.muted;persistOptions();if(started)toast('SOUND',options.muted?'Muted':'Sound on','Press M to change.');return;}
 if(mode==='title'){if(code==='Enter')readSave()?startGame(true):requestNew();return;}
 if(mode==='book'){if(['Escape','KeyN','Tab'].includes(code))closeBook();return;}
 if(mode==='modal'){if(code==='Escape'&&modalState?.esc){let p=modalState.prev;modalState=null;show('modal',false);setMode(p);}else if(code==='Enter')$('modalActions').querySelector('button')?.click();return;}
 if(mode==='ending'){if(code==='Enter'){$('stayBtn').click();}return;}
 if(mode==='dialogue'){if(['KeyE','Space','Enter','Escape'].includes(code))advanceTalk();else if(code.startsWith('Digit'))chooseDialogue(Number(code.slice(5))-1);return;}
 if(mode==='transition')return;
 if(mode==='qte'){if(code==='Escape'){pauseGame();return;}qtePress(code);return;}
 if(mode==='darts'){if(code==='Space'||code==='Enter')throwDart();if(code==='Escape')leaveDarts();return;}
 if(code==='Escape'||code==='KeyP'){pauseGame();return;}
 if(code==='KeyN'||code==='Tab'){openBook();return;}
 if(code==='KeyH'){openBook('controls');return;}
 if(code==='KeyC'){camYaw=player.yaw;camManual=0;camPitch=.1;return;}
 if(mode==='forklift'){if(code==='KeyE'||code==='Enter')forkAction();if(code==='KeyX')exitForklift();if(code==='KeyR')recoverForklift();return;}
 if(mode==='combat'){if(code==='KeyJ')playerAttack('punch');if(code==='KeyK')playerAttack('kick');if(code==='KeyL')evade();return;}
 if(code==='KeyE'||code==='Enter')interact();
}
function toggleFullscreen(){try{let p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();p?.catch(()=>{if(started)toast('DISPLAY','Full screen is not available','The game still works in this window.');});}catch(e){}}
function bindInputs(){
 $('startBtn').onclick=requestNew;$('continueBtn').onclick=()=>startGame(true);$('titleControls').onclick=()=>openBook('controls');$('titleSettings').onclick=()=>openBook('options');$('notebookButton').onclick=()=>openBook();$('bookClose').onclick=closeBook;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{sound.sfx('click');renderBook(b.dataset.tab);});$('interaction').onclick=interact;$('dialogueNext').onclick=advanceTalk;$('speech').onclick=advanceTalk;$('qteCircle').onclick=()=>{if(qte)qtePress(chaseSteps[qte.step].code);};
 $('stayBtn').onclick=()=>{show('ending',false);setMode('roam');player.x=11.5;player.z=-28;player.yaw=PI/2;camYaw=PI/2;camZoom=5.5;saveGame();toast('THE AFTERNOON IS YOURS','No need to hurry','Tea, darts, toys, and one small cat.');};$('endTitleBtn').onclick=goTitle;$('leaveDarts').onclick=leaveDarts;
 $('dartCanvas').addEventListener('pointermove',e=>{if(!darts)return;let r=$('dartCanvas').getBoundingClientRect();darts.aimX=clamp((e.clientX-r.left)/r.width*620,30,590);darts.aimY=clamp((e.clientY-r.top)/r.height*620,30,590);});$('dartCanvas').addEventListener('pointerdown',e=>{if(!darts)return;e.preventDefault();let r=$('dartCanvas').getBoundingClientRect();darts.aimX=(e.clientX-r.left)/r.width*620;darts.aimY=(e.clientY-r.top)/r.height*620;darts.sightX=darts.aimX+Math.sin(worldTime*2.7)*9;darts.sightY=darts.aimY+Math.cos(worldTime*2.1)*9;throwDart();});
 window.addEventListener('blur',()=>{clearKeys();if(started&&['roam','forklift','combat','qte'].includes(mode))pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden){saveGame(true);clearKeys();if(started&&['roam','forklift','combat','qte'].includes(mode))pauseGame();sound.ctx?.suspend();}else sound.ctx?.resume().catch(()=>{});});window.addEventListener('beforeunload',()=>saveGame(true));
 // Sound may only start after a gesture: the first key, click or tap unlocks it (menus call sound.init too).
 const unlock=()=>{sound.init();if(sound.ctx&&sound.ctx.state==='running')for(const t of ['pointerdown','keydown'])removeEventListener(t,unlock,true);};
 for(const t of ['pointerdown','keydown'])addEventListener(t,unlock,true);
}
const overlayState={};
function overlayOpacity(id,v){if(overlayState[id]!==v){overlayState[id]=v;$(id).style.opacity=v;}}
function update(dt){worldTime+=dt;let active=['roam','forklift','combat','qte'].includes(mode);if(active){G.elapsed+=dt;G.clock=Math.min(1125,G.clock+dt*.15);if(worldTime-lastAutoSave>25&&['roam','forklift'].includes(mode)){lastAutoSave=worldTime;saveGame(true);}}
 const desiredRain=options.weather&&started&&G.elapsed>160&&G.elapsed<390?.7:0;rainAmount=mix(rainAmount,desiredRain,Math.min(1,dt*.1));damageAlpha=Math.max(0,damageAlpha-dt*1.4);overlayOpacity('rainFx',Math.round(rainAmount*52)/100);overlayOpacity('damageFlash',Math.round(damageAlpha*100)/100);
 if(mode==='roam'){updatePlayer(dt);updateNPCs(dt);if(G.stage===5&&player.z< -22&&enemies.length===0)battleIntro(true);}
 else if(mode==='forklift'){updateForklift(dt);updateNPCs(dt);}
 else if(mode==='dialogue')updateDialogue(dt);else if(mode==='combat')updateBattle(dt);else if(mode==='qte')updateChase(dt);else if(mode==='darts')updateDarts(dt);
 if(transition){transition.time+=dt;$('fade').style.opacity=transition.time<.5?transition.time*2:Math.max(0,2-transition.time*2);if(transition.time>=.5&&!transition.done){transition.done=true;transition.fn();}if(transition.time>1){transition=null;$('fade').style.opacity=0;}}
 if(worldTime>toastUntil)$('toast').classList.remove('show');if(worldTime>areaUntil)$('areaCard').classList.remove('show');if(worldTime>saveUntil)overlayOpacity('saveIcon',0);hudTick+=dt;if(hudTick>.12){hudTick=0;updateHUD();updateInteract();}
 sound.update(effectiveMode(),mode==='forklift'?forklift.speed:0,rainAmount);updateCamera(dt);
}
const shamStats={fps:0,backend:kit.backend,staticVertices:0,backdrop:null,dynamicVertices:0,drawSize:[0,0]};window.__shamStats=shamStats;
function frame(dt){
 pumpInput(dt);syncTouch();
 // A few hundredths of a second of hit-stop sell the heavier blows.
 if(hitStop>0){hitStop=Math.max(0,hitStop-dt);dt*=.2;}
 const steps=Math.max(1,Math.ceil(dt/.045));for(let i=0;i<steps;i++)update(dt/steps);
 const geometry=dynamicWorld();
 renderer.render(camEye,camTarget,geometry,worldTime,G.clock/60,rainAmount,['capsule','collection'].includes(effectiveMode()));
 updateWaypoints();drawWorkMap();
 shamStats.fps=window.__kit?.fps||0;shamStats.staticVertices=renderer.static.count;shamStats.backdrop=renderer.surroundings;shamStats.dynamicVertices=renderer.dynamicCount;shamStats.drawSize[0]=renderer.canvas.width;shamStats.drawSize[1]=renderer.canvas.height;
}
function boot(){freshState();renderer=createRenderEngine(kit,atlas.canvas,DYN);renderer.setStatic(S.a);S=new MeshBuilder(64);persistOptions();bindInputs();let ticks='';for(let i=0;i<60;i++){if(i%5===0)continue;let a=i/60*TAU,x1=45+Math.sin(a)*35,y1=45-Math.cos(a)*35,x2=45+Math.sin(a)*37,y2=45-Math.cos(a)*37;ticks+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#bbc8b3" stroke-width=".6"/>';}$('watchTicks').innerHTML=ticks;show('titleScreen');show('continueBtn',!!readSave());if(readSave())$('startBtn').className='secondary';gameRunning=true;window.ShamMue={version:'1.0',getState:()=>({mode,stage:G.stage,cash:G.cash,position:{x:player.x,z:player.z,yaw:player.yaw},health:player.health,clock:G.clock,elapsed:G.elapsed,crates:crates.map(c=>({...c})),forklift:{...forklift},toys:{...G.toys},catFed:G.catFed,dartsPlayed:G.dartsPlayed,stats:window.__shamStats})};}
/* -------------------------------------------------------------------------
   HARBOUR DAYS / 2.0
   No remote assets. New state is stored beside the original story save.
   Capsule purchases commit cash and ownership together before the first shot.
   ------------------------------------------------------------------------- */
const WORLD={minX:-31,maxX:115.5,minZ:-142,maxZ:34.7};
const BAYS={
 A:{id:'A',number:'03',name:'East quay',x:9,z:-10,w:6,d:7,color:'#d6b665',tx:'wh3'},
 B:{id:'B',number:'06',name:'North store',x:13,z:-110,w:12,d:9,color:'#d5a65e',tx:'wh6'},
 C:{id:'C',number:'09',name:'Cold storage',x:95,z:-109,w:12,d:10,color:'#83babb',tx:'wh9'},
 D:{id:'D',number:'12',name:'Ferry freight',x:53,z:-121,w:12,d:10,color:'#8bad91',tx:'wh12'},
 E:{id:'E',number:'14',name:'Rail freight',x:98,z:-59,w:12,d:10,color:'#c78d72',tx:'wh14'},
 F:{id:'F',number:'16',name:'Market store',x:64,z:9,w:10,d:9,color:'#c6b180',tx:'wh16'}
};
const CARGO_TYPES={general:{name:'General cargo',color:'#d3ba87',tag:'tagGeneral',damage:1},fragile:{name:'Radio equipment',color:'#7ba5ab',tag:'tagFragile',damage:1.6},cold:{name:'Chilled fish',color:'#c7d5c2',tag:'tagCold',damage:1.2},machine:{name:'Machine parts',color:'#a38a6b',tag:'tagParts',damage:.8}};
const SERIES=[
 {id:0,name:'Pocket Port',sub:'THE ORIGINAL HARBOUR COLLECTION',color:'#b87643',cost:100,location:'Breakwater Tea',x:-11.3,z:24,ids:[0,1,2,3,4,5]},
 {id:1,name:'Working Wheels',sub:'SMALL TRUCKS. AN HONEST DAY.',color:'#ae4b3b',cost:100,location:'North dispatch',x:43,z:-54.5,ids:[6,7,8,9,10,11]},
 {id:2,name:'Harbour Days',sub:'LITTLE THINGS FROM AN ORDINARY DAY',color:'#588886',cost:100,location:'Market street',x:95,z:12.4,ids:[12,13,14,15,16,17]},
 {id:3,name:'Night Crossing',sub:'AFTER THE LAST SHIP LEAVES',color:'#575b7e',cost:100,location:'Ferry terminal',x:69,z:-128,ids:[18,19,20,21,22,23]}
];
const TOYS=[
 ['Forklift No. 05','forklift','#c38c3d','The truck that keeps this harbour moving. Even the forks are painted.','The same one I drive.'],
 ['Blue freighter','freighter','#497e98','A blue cargo ship, with a red funnel and a very small deck.','A ship. Not bad.'],
 ['Harbour gull','gull','#e4dfc6','One gull on a mooring post. This one will not steal your lunch.','At least this one is quiet.'],
 ['Lucky kettle','kettle','#759a83','A green kettle with a curved spout. The lid does not come off.','Hana has one like this.'],
 ['Tiny crane','crane','#c8a052','A small dock crane. Its hook hangs above a painted wooden base.','They even made the hook.'],
 ['The night cat','cat','#303b42','A black cat with gold eyes. The rare figure in the first collection.','Oh. The black cat.'],
 ['Forklift No. 02','forklift','#b74335','A red yard truck. Its number plate is almost too small to read.','Another forklift. Good.'],
 ['Delivery van','van','#d6c49a','A cream delivery van with blue windows and a sliding side door.','A delivery van.'],
 ['Flatbed No. 07','flatbed','#597e8f','An empty flatbed truck. A tiny spare wheel sits behind the cab.','It needs some cargo.'],
 ['Harbour tug','tug','#c29148','A squat tow tractor with a heavy rear coupling. Built to pull.','That is a strong little truck.'],
 ['Pallet jack','jack','#b34634','A red hand pallet truck. Each roller is the size of a grain of rice.','A pallet jack. I know this one.'],
 ['Silver forklift','forklift','#b5c6c9','The rare silver finish. The mast and wheel hubs catch the light.','Silver. I have not seen this one.'],
 ['Fish bun','bun','#d1a361','A steamed bun in a paper tray. A little fish is pressed into the top.','Now I am hungry.'],
 ['Breakwater cup','cup','#729d8d','A green tea cup and saucer. There is a painted ripple on the tea.','A cup of tea.'],
 ['Pay phone','phone','#70896e','A green public phone. It has a coin slot and a coiled cord.','Father used to call from these.'],
 ['Sun Pop machine','vending','#ae4739','A red drink machine. There are six cans behind the little window.','A machine from a machine.'],
 ['Last bus stop','busstop','#7da3a1','The harbour bus sign, a bench, and a timetable no one can read.','The bus still is not here.'],
 ['The white cat','cat','#e8dfc4','The rare white cat. A dark patch covers one ear.','A friend for the black one.'],
 ['Breakwater light','lighthouse','#d4c49d','A striped harbour light on a small stone base. The lens is amber.','The light at the end of the pier.'],
 ['Yard locomotive','train','#637f73','A green shunting engine. Red buffers sit just above the rails.','It has all its little wheels.'],
 ['Evening ferry','ferry','#d9d3b4','A passenger ferry with blue trim. The top deck has six windows.','The morning ferry.'],
 ['Copper diver','diver','#b48658','An old diving helmet. The round front window is dark blue.','That looks heavy.'],
 ['The gantry','gantry','#78958d','A tall cargo gantry over two tiny containers. The frame is pale green.','The big crane, made small.'],
 ['Father\'s watch','watch','#d0b783','A rare gold watch on a dark stand. Both hands point to six.','Six o\u2019clock. Time to go.'],
 ['Golden No. 05','forklift','#e1ba54','A special finish for a clean forklift circuit. This figure is earned, not bought.','A good day\u2019s driving.']
].map((a,id)=>({id,name:a[0],kind:a[1],color:a[2],description:a[3],line:a[4],series:id<24?Math.floor(id/6):4,rarity:id===24?'CIRCUIT AWARD':id%6===5?'RARE':id%6===4?'UNCOMMON':'STANDARD',weight:[24,23,20,18,10,5][id%6]}));
const routeCargo=(points)=>points.map((p,id)=>({id,x:p[0],z:p[1],originX:p[0],originZ:p[1],bay:p[2],type:p[3]||'general',delivered:false,integrity:100}));
const JOBS=[
 {id:'quay',name:'The quay rounds',tag:'01 / LOCAL FREIGHT',rank:0,pay:720,target:420,start:[-5,1.2],detail:'Four pallets. A first run from the old quay to the north store.',cargo:[[-9,-18,'A'],[-5,-19,'A'],[-8,-64,'B'],[-5,-72,'B','machine']]},
 {id:'north',name:'The north yard',tag:'02 / CONTAINER TRANSFER',rank:0,pay:980,target:540,start:[0,-49],detail:'Five pallets from the container lanes. Read each bay number.',cargo:[[-11,-65,'B'],[-6,-73,'C','fragile'],[6,-84,'E','machine'],[24,-92,'B'],[31,-92,'C','general']]},
 {id:'ferry',name:'Before the ferry',tag:'03 / SHIP STORES',rank:0,pay:1200,target:600,start:[49,-101],detail:'Six loads for the ferry. The blue cases need careful handling.',cargo:[[39,-86,'D'],[46,-86,'D','cold'],[61,-87,'D','general'],[68,-87,'D','fragile'],[37,-111,'D','machine'],[38,-116,'D']]},
 {id:'cold',name:'The cold chain',tag:'04 / FISH AND PROVISIONS',rank:1,pay:1380,target:660,start:[79,-97],detail:'Six chilled loads. Cold storage first, then the market store.',cargo:[[70,-110,'C','cold'],[71,-117,'C','cold'],[61,-110,'C','cold'],[86,-86,'F','cold'],[91,-92,'F','cold'],[99,-92,'F','fragile']]},
 {id:'rail',name:'The rail transfer',tag:'05 / HEAVY CARGO',rank:1,pay:1680,target:720,start:[79,-47],detail:'Seven loads from both sides of the port. Heavy parts turn slowly.',cargo:[[36,-68,'E','machine'],[41,-70,'E','machine'],[61,-75,'B','machine'],[66,-76,'E','general'],[-8,-83,'B','fragile'],[-6,-91,'E','general'],[89,-43,'E','machine']]},
 {id:'full',name:'One whole harbour',tag:'06 / SENIOR DRIVER',rank:2,pay:2040,target:840,start:[49,-48],detail:'Eight loads. Six different bays. A full shift across the harbour.',cargo:[[-9,-18,'D'],[-9,-65,'C','fragile'],[6,-87,'E','machine'],[37,-113,'F','cold'],[86,-90,'A','fragile'],[89,-40,'B'],[68,19,'D'],[56,18,'C','cold']]}
];
const CIRCUIT=[[0,-48],[0,-79],[0,-100],[28,-100],[50,-99],[79,-99],[79,-74],[79,-48],[53,-48],[27,-48]];
let capsuleScene=null,collectionScene=null,boardPrev='roam',forkCamera=0,navRoute=[],navStamp='',navTick=0,workMapTick=0,lastHydraulic=0,lastReverse=0,lastHorn=0,lastRegion='',lastMachine=0;
let ambientTrucks=[{x:0,z:-56,yaw:0,speed:1.45,carry:null,lift:.18,paint:'#608d8d',path:[[0,-56],[0,-95],[51,-99],[79,-99],[79,-48],[0,-48]],wp:1},{x:51,z:16,yaw:0,speed:1.2,carry:null,lift:.14,paint:'#b09558',path:[[51,16],[51,-43],[79,-48],[79,23],[51,23]],wp:1}];
function initExpansionTextures(){
 for(const n of [6,9,12,14,16])T['wh'+n]=board('WH '+n,String(n).padStart(2,'0'),1,'#c3c5af','#274a48','DELIVERY BAY');
 T.two=board('truck02','02',1,'#274847','#e8dfbc');
 T.dispatch=board('dispatch','DISPATCH',4,'#274d4d','#e2d6b3','DAILY WORK / DRIVERS REPORT HERE');
 T.market=board('market','NAGAMATSU MARKET',5,'#78816a','#e5d7aa','TEA · TOYS · PROVISIONS');
 T.ferryPort=board('ferryPort','FERRY TERMINAL',5,'#426879','#e9daba','KOBE / PASSENGERS & FREIGHT');
 T.north=board('north','NORTH YARD',4,'#355555','#e2cc98','06  /  09  /  12  /  14');
 T.cold=board('cold','COLD STORAGE',4,'#597e81','#e2e0c9','09 / KEEP DOORS CLOSED');
 T.coin=atlas.tile('yenCoin',c=>{c.fillStyle='#cfbea1';c.fillRect(0,0,256,256);c.strokeStyle='#6e7364';c.lineWidth=6;c.beginPath();c.arc(128,128,113,0,TAU);c.stroke();c.lineWidth=2;c.beginPath();c.arc(128,128,100,0,TAU);c.stroke();c.fillStyle='#667465';c.textAlign='center';c.font='bold 92px Georgia';c.fillText('100',128,157);c.font='23px serif';c.fillText('日 本 国',128,65);c.fillText('昭和 六十二年',128,209);});
 for(let s of SERIES)T['series'+s.id]=board('series'+s.id,s.name.toUpperCase().replace(' ','\n'),1.8,s.color,'#f0e2b8','CAPSULE TOYS / ¥100');
 T.tagGeneral=board('tagGeneral','PORT FREIGHT',2,'#d3c29c','#41584b','THIS WAY UP  ↑');
 T.tagFragile=board('tagFragile','FRAGILE',2,'#a6c6c5','#2f5359','RADIO EQUIPMENT  /  ↑');
 T.tagCold=board('tagCold','KEEP COLD',2,'#cfdbca','#386875','FRESH FISH / NAGAMATSU');
 T.tagParts=board('tagParts','MACHINE PARTS',2,'#b9a889','#544e3b','HEAVY LOAD  /  ↑');
}
function roundPart(b,x,y,z,r,d,col,sides=16){b.push(x,y,z).rotateX(PI/2);b.cylinder(0,0,0,r,r,d,T.white,col,sides);b.pop();}
function capsuleMachineMesh(b,s,time=0,turn=0,flap=0){
 const paint=s.color; b.push(s.x||0,0,s.z||0,s.yaw||0);
 b.box(0,.1,0,1.08,.2,.9,T.paint,'#bcb7a0');b.box(0,.67,0,.92,1.06,.87,T.paint,paint);b.box(0,.2,.07,.96,.09,.96,T.white,'#344a46');
 b.box(0,1.35,-.37,.94,1.14,.1,T.paint,'#3c5b58');b.box(0,1.87,0,.98,.09,.92,T.white,'#d2d0b7');b.box(0,1.21,0,.94,.08,.90,T.white,'#c2c6b1');
 // The hopper is an open mesh with a glass-colour back and specular strips.
 b.plane(0,1.53,-.307,.78,.54,T.glass);for(const x of [-.46,.46])b.box(x,1.55,.05,.04,.60,.82,T.white,'#adc3ba');
 for(let i=0;i<20;i++){const x=((i*7)%9-4)*.092,y=1.29+Math.floor(i/7)*.15,z=-.10+(i%3)*.13;const wob=turn?Math.sin(time*17+i)*.016:0;capsuleBall(b,x+wob,y,z,.102,['#cc6b48','#c2af62','#64999c','#758369'][i%4],0);}
 b.box(-.30,1.55,.46,.025,.56,.007,T.white,'#c9dbce');b.box(-.265,1.55,.462,.009,.56,.008,T.white,'#f0e1ba');
 b.box(0,2.04,0,1.10,.28,.99,T.paint,paint);b.plane(0,2.05,.505,.97,.23,T['series'+s.id]);
 b.box(0,1.04,.47,.83,.32,.035,T.white,'#d1c8ae');b.plane(-.19,1.048,.493,.37,.25,T['series'+s.id]);
 b.box(.275,1.13,.508,.2,.24,.035,T.white,'#aebcb0');b.box(.275,1.15,.53,.085,.014,.01,T.white,'#213b3b');b.plane(.276,1.235,.53,.15,.05,T.white,'#344b43');
 roundPart(b,.20,.83,.484,.161,.055,'#d2d8ca',20);roundPart(b,.20,.83,.524,.124,.025,'#718781',20);b.push(.20,.83,.551).rotateZ(-turn);b.box(0,0,0,.248,.058,.078,T.white,'#d6d9cb');b.box(0,0,.043,.085,.09,.02,T.white,'#a6b7ae');b.pop();
 b.box(-.19,.43,.454,.52,.34,.036,T.white,'#243b3a');b.box(-.19,.27,.55,.58,.04,.25,T.paint,'#69796d');b.push(-.19,.585,.472).rotateX(-flap*.9);b.box(0,-.13,0,.50,.26,.035,T.paint,'#7c8980');b.box(0,-.238,.025,.29,.022,.025,T.white,'#b8c0ab');b.pop();
 b.box(.26,.34,.47,.13,.09,.035,T.paint,'#9a9b81');b.box(0,.15,.468,.80,.08,.025,T.white,'#4e6157');b.pop();
}
function capsuleBall(b,x,y,z,r,col,opening=0,spin=0){
 b.push(x,y,z,spin); // Two separate hemispheres, with a visible equator.
 const hemi=(upper,dy,c)=>{b.push(0,dy,0);const rings=6,sides=20;for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){let a=(upper?0:PI/2)+j/rings*PI/2,d=(upper?0:PI/2)+(j+1)/rings*PI/2,u=i/sides*TAU,v=(i+1)/sides*TAU,p=(a,t)=>[Math.sin(a)*Math.cos(t)*r,Math.cos(a)*r,Math.sin(a)*Math.sin(t)*r];b.quad(p(d,v),p(d,u),p(a,u),p(a,v),T.white,c);}b.cylinder(0,0,0,r,r,.007,T.white,upper?'#d5d9c3':'#9eaa90',20);b.pop();};
 hemi(false,-opening*.35,col);b.push(opening*.65,0,0).rotateZ(-opening*1.3);hemi(true,opening,'#d8dfc9');b.pop();if(opening<.01)b.cylinder(0,0,0,r*1.01,r*1.01,.008,T.white,'#6d8c81',20);b.pop();
}
function deliveryShed(x,z,w,d,num,col='#a8b5a0'){
 // Open south side. Walls have separate collision boxes, so the player can enter.
 for(const sign of [-1,1]){box(x+sign*w/2,3.35,z,.25,6.7,d,T.metal,col,4);obstacle(x+sign*w/2,z,.28,d,'warehouse');}
 box(x,3.35,z-d/2,w,6.7,.25,T.metal,col,4);obstacle(x,z-d/2,w,.3,'warehouse');
 box(x,7.0,z,w+1.4,.26,d+1.2,T.roof,'#81988c',4);box(x,6.2,z+d/2,w,.9,.27,T.metal,col,3);
 for(let a of [-1,1]){box(x+a*w*.25,3.2,z+d/2,.22,6.4,.22,T.paint,'#556f64');obstacle(x+a*w*.25,z+d/2,.3,.3,'post');}
 label(x,6.23,z+d/2+.16,w*.45,.71,T['wh'+num]);
 groundRect(x,z,w,d,'#b2b7a1',.025,T.concrete);for(let a of [-1,1]){box(x+a*w*.4,.16,z+d/2,.55,.3,1.3,T.hazard);}
 for(let xx=-w*.3;xx<w*.4;xx+=w*.3){box(x+xx,5.9,z,2.4,.08,.32,T.white,'#e5dfb5');for(let zi=0;zi<2;zi++)crate(S,x+xx,zi*1.35,z-d*.34,1.3);}
}
function streetShop(x,z,w,d,textTx,color){
 obstacle(x,z,w,d,'tea');box(x,2.05,z,w,4.1,d,T.brick,color,2);box(x,4.24,z,w+.7,.23,d+.6,T.roof,'#5d7669',3);label(x,3.25,z+d/2+.03,w-.5,.80,textTx);
 for(let xx=x-w/2+2;xx<x+w/2-1;xx+=3){label(xx,1.91,z+d/2+.035,2.1,1.7,T.windows);box(xx,1.01,z+d/2+.12,2.22,.13,.27,T.wood,'#ac9e74');}
 S.quad([x-w/2-.2,2.88,z+d/2],[x+w/2+.2,2.88,z+d/2],[x+w/2+.2,2.45,z+d/2+1.8],[x-w/2-.2,2.45,z+d/2+1.8],T.cloth,'#729187',4,1);
 for(let xx of [x-w/2-.1,x+w/2+.1])box(xx,1.24,z+d/2+1.75,.075,2.5,.075,T.paint,'#49645c');
}
function workBoardModel(x,z){box(x,1.32,z,2.5,1.85,.16,T.wood,'#778775');label(x,1.5,z+.10,2.25,1.32,T.notice);label(x,2.1,z+.11,2.22,.38,T.dispatch);for(let a of [-1,1])box(x+a*.98,.63,z,.11,1.25,.14,T.wood,'#657b65');obstacle(x,z,2.5,.18,'board');}
function bayMark(bay){for(let x of [-1,1])groundRect(bay.x+x*bay.w/2,bay.z,.12,bay.d,bay.color,.045);for(let z of [-1,1])groundRect(bay.x,bay.z+z*bay.d/2,bay.w,.12,bay.color,.045);S.push(bay.x,.047,bay.z).rotateX(-PI/2);S.plane(0,0,0,2.5,2.5,T[bay.tx]);S.pop();}
function road(x,z,w,d){groundRect(x,z,w,d,'#acb5a7',.009,T.asphalt);if(d>w){for(let zz=z-d/2+2;zz<z+d/2;zz+=5)groundRect(x,zz,.09,2.5,'#d1c392');for(let side of [-1,1])groundRect(x+side*(w/2-.7),z,.09,d,'#c5b789');}else{for(let xx=x-w/2+2;xx<x+w/2;xx+=5)groundRect(xx,z,2.5,.09,'#d1c392');for(let side of [-1,1])groundRect(x,z+side*(d/2-.7),w,.09,'#c5b789');}}
function extendHarbour(){
 initExpansionTextures();road(1,-93,23,104);road(55,-48,111,15);road(50,-99,96,15);road(79,-74,16,130);road(51,-16,16,66);road(79,23,66,13);
 // The north quay continues past working container lanes.
 for(let z=-43;z>-143;z-=5){box(-32.65,.08,z,.55,.16,4.8,T.hazard,'#c8bb92');S.cylinder(-31.5,.38,z,.17,.18,.75,T.paint,'#4b645c',8);S.beam([-31.5,.69,z],[-31.5,.69,z-5],.05,T.paint,'#829283');}
 for(let z of [-59,-72,-85,-104,-118,-134]){containerCargo(-24,0,z,['#617f85','#ad765b','#71897a'][Math.abs(z)%3]);if(z!==-104)containerCargo(-24,2.65,z,'#aa9873');}
 for(let [x,z] of [[27,-64],[27,-77],[49,-77],[64,-65],[25,-129]])containerCargo(x,0,z,['#847c62','#5d8287','#af7c58'][Math.abs(z)%3]);
 containerCargo(27,2.65,-64,'#8a9e91');containerCargo(49,2.65,-77,'#ba9167');containerCargo(25,2.65,-129,'#688b88');
 deliveryShed(20,-128,28,22,6,'#b7b9a0');deliveryShed(100,-127,26,24,9,'#a6bfc0');deliveryShed(102,-76,26,20,14,'#c4aa88');deliveryShed(63,-6,18,18,16,'#b4b49a');
 streetShop(52,-138,29,10,T.ferryPort,'#bab5a1');streetShop(70,-136,12,9,T.ferryPort,'#b2bcb0');streetShop(95,5,28,11,T.market,'#b5a58a');streetShop(46,-60,10,6,T.dispatch,'#b7bda5');
 label(85.95,4.9,-124,9,1.05,T.cold,-PI/2);label(80.3,3.4,-133,9.2,1.05,T.ferryPort,PI/2);
 for(let bay of Object.values(BAYS))if(bay.id!=='A')bayMark(bay);
 workBoardModel(-8,5);workBoardModel(39,-53);workBoardModel(54,20);
 for(const s of SERIES){capsuleMachineMesh(S,s);obstacle(s.x,s.z,1.1,.95,'capsule');}
 // Landmarks and working clutter are kept clear of the marked roads.
 for(let [x,z,k] of [[-28,-68,.9],[-28,-117,1.05],[109,-134,.86]])crane(x,z,k);
 for(let [x,z] of [[-13,-58],[-13,-88],[13,-98],[40,-47],[79,-38],[79,10],[77,-132],[106,-40]]){pole(x,z);box(x+.9,8.8,z,1.7,.13,.12,T.paint,'#687f6d');box(x+1.7,8.69,z,.65,.13,.32,T.white,'#c1c3a2');}
 cable([-13,10.5,-58],[-13,10.5,-88],.8);cable([79,10.5,-38],[79,10.5,10],1.8);
 for(let [x,z] of [[35,-62],[34,-83],[69,-62],[88,-94],[109,-92],[41,12],[104,17]]){barrel(x,z);barrel(x+.75,z+.5,'#8d8f70');crate(S,x+2,0,z,1.25);obstacle(x+2,z,1.3,1.3,'cargo');}
 for(let z=-130;z<-45;z+=4){for(let x of [112,114])box(x,.06,z,.06,.04,4,T.white,'#7b8a82');box(113,.015,z,3.4,.09,.27,T.wood,'#687466');}
 for(let z of [-90,-104]){box(112.8,1.2,z,3.1,1.3,7.2,T.metal,'#b0936b',2);box(112.8,.44,z,3.3,.3,7.5,T.paint,'#455a54');for(let zz of [-2,2])for(let xx of [-1.4,1.4]){S.push(112.8+xx,.37,z+zz).rotateZ(PI/2);S.cylinder(0,0,0,.38,.38,.24,T.white,'#354b49',10);S.pop();}obstacle(112.8,z,3.4,7.5,'container');}
 // Direction boards, a ferry queue, benches, and the market canopy.
 for(let [x,z,tx] of [[1,-44,T.north],[52,-48,T.market],[79,-103,T.cold],[53,-114,T.ferryPort]]){box(x+5,2.15,z,.11,4.3,.11,T.paint,'#637e6b');label(x+5,3.7,z+.08,4.8,.82,tx);}
 for(let [x,z] of [[85,24],[100,24],[61,-128],[83,-133]]){box(x,.60,z,3.1,.15,.72,T.wood,'#b4ab88');box(x,.94,z-.29,3.1,.56,.12,T.wood,'#acaa88');for(let a of [-1,1])box(x+a*1.1,.28,z,.10,.56,.6,T.paint,'#4c675d');obstacle(x,z,3.1,.8,'bench');}
 for(let x=37;x<116;x+=4){box(x,1.0,-144,.07,2,.07,T.white,'#7c9486');S.beam([x,1.2,-144],[x+4,1.2,-144],.04,T.white,'#8a9c8c');}
 for(let z=-139;z<34;z+=5){box(116.6,1,z,.075,2,.075,T.white,'#7b9586');S.beam([116.6,1.6,z],[116.6,1.6,z+5],.025,T.white,'#8b9e8e');}
 for(let [x,z] of [[52,31],[104,31],[39,-139]]){box(x,.30,z,4,.6,2,T.concrete,'#b0b29a');for(let i=0;i<5;i++)S.sphere(x-1.5+i*.75,.85,z,.65,.7,.60,T.cloth,'#718872',4,7);obstacle(x,z,4,2,'planter');}
 // Mooring bollards and a second vessel give the far quay its own silhouette.
 S.push(-61,0,-117,PI*.13);S.taper(0,1.3,0,7,10,3.3,27,37,T.paint,'#617f83');S.box(0,3.7,6,8,2.4,11,T.paint,'#d1d0b5');S.plane(0,4.1,11.55,7.4,.8,T.windows);S.box(0,5.16,6,8.5,.22,11.7,T.paint,'#497587');S.cylinder(0,6.2,8,.85,.85,2,T.paint,'#bc714d',12);S.box(0,3.5,-9,7,.3,13,T.paint,'#9eaa95');S.pop();
 for(let i=0;i<32;i++){let x=-12+(i*19)%118,z=-57-(i*11)%78;if(!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+1&&Math.abs(z-o.z)<o.d/2+1)){S.push(x,.02,z,i);S.sphere(0,0,0,.4+(i%3)*.4,.006,.2+(i%2)*.3,T.water,'#99aca1',2,9);S.pop();}}
}

const originalFreshState=freshState;
freshState=function(){originalFreshState();G.expansion=2;G.work=null;G.workStats={shifts:0,delivered:0,earnings:0,bests:{},raceBest:0,races:0};G.pendingCapsule=null;G.purchases=0;G.visited=['quay'];G.trades=0;forklift.lift=.12;forklift.targetLift=.12;forklift.operation=null;crates=routeCargo(crateOrigins.map(o=>[o.x,o.z,'A']));capsuleScene=null;collectionScene=null;forkCamera=0;navStamp='';lastRegion='';
 npcs.push({id:'sumi',name:'Sumi',role:'Dispatch clerk',x:47,z:-52.6,yaw:.2,coat:'#778d7e',pants:'#4b5f5a',hair:'#473831',walk:0},
 {id:'natsumi',name:'Natsumi',role:'Toy collector',x:91,z:17.4,yaw:-.4,coat:'#a48765',pants:'#4c6466',hair:'#39322c',walk:0},
 {id:'ferryclerk',name:'Ishida',role:'Ferry clerk',x:60,z:-129,yaw:0,coat:'#577987',pants:'#3d5660',cap:'#d2c8a7',hair:'#434239',walk:0},
 {id:'coldhand',name:'Toru',role:'Cold-store worker',x:86,z:-101,yaw:1,coat:'#93a59b',pants:'#50666b',cap:'#8b9c88',walk:0},
 {id:'northwalker',name:'Yasuo',role:'North yard driver',x:5,z:-64,yaw:0,coat:'#9b8e74',pants:'#4f6767',cap:'#b4aa85',vest:true,walk:0,path:[[5,-64],[5,-89],[18,-96],[18,-65]],wp:1,phase:0});};
function safeNumber(v,def,min,max){return Number.isFinite(Number(v))?clamp(Number(v),min,max):def;}
function sanitizeCargo(list){return list.slice(0,10).map((c,i)=>({id:i,x:safeNumber(c.x,0,WORLD.minX+1,WORLD.maxX-1),z:safeNumber(c.z,-20,WORLD.minZ+1,WORLD.maxZ-1),originX:safeNumber(c.originX,c.x||0,WORLD.minX+1,WORLD.maxX-1),originZ:safeNumber(c.originZ,c.z||-20,WORLD.minZ+1,WORLD.maxZ-1),bay:BAYS[c.bay]?c.bay:'A',type:CARGO_TYPES[c.type]?c.type:'general',integrity:safeNumber(c.integrity,100,0,100),delivered:!!c.delivered}));}
const originalLoadState=loadState;
loadState=function(s){originalLoadState(s);if(s.expansion===2){
 G.workStats={...G.workStats,...(s.workStats||{})};for(const k of ['shifts','delivered','earnings','races'])G.workStats[k]=Math.floor(safeNumber(G.workStats[k],0,0,999999));G.workStats.bests=G.workStats.bests&&typeof G.workStats.bests==='object'?G.workStats.bests:{};
 G.work=s.work&&typeof s.work==='object'&&(s.work.tutorial||s.work.race||JOBS.some(j=>j.id===s.work.id))?{...s.work}:null;
 G.purchases=safeNumber(s.purchases,0,0,99999);G.trades=safeNumber(s.trades,0,0,99999);G.visited=Array.isArray(s.visited)?s.visited.slice(0,8):['quay'];
 if(Array.isArray(s.crates)&&s.crates.length<=10)crates=sanitizeCargo(s.crates);
 if(s.position){player.x=safeNumber(s.position.x,0,WORLD.minX+1,WORLD.maxX-1);player.z=safeNumber(s.position.z,31,WORLD.minZ+1,WORLD.maxZ-1);}
 if(s.forklift){forklift={...forklift,...s.forklift};forklift.x=safeNumber(forklift.x,-5,WORLD.minX+2,WORLD.maxX-2);forklift.z=safeNumber(forklift.z,1.2,WORLD.minZ+2,WORLD.maxZ-2);forklift.carry=Number.isInteger(forklift.carry)&&crates[forklift.carry]&&!crates[forklift.carry].delivered?forklift.carry:null;forklift.lift=safeNumber(forklift.lift,.12,.1,1.6);forklift.targetLift=forklift.lift;forklift.operation=null;forklift.speed=0;}
 G.pendingCapsule=s.pendingCapsule&&TOYS[s.pendingCapsule.id]&&SERIES[s.pendingCapsule.machine]?{...s.pendingCapsule}:null;
 }else{crates=crates.map((c,i)=>({...c,bay:'A',type:'general',integrity:100,originX:crateOrigins[i]?.x||c.x,originZ:crateOrigins[i]?.z||c.z}));if(G.stage===3||sideShift){G.work={id:'tutorial',name:'A favour for Daichi',tutorial:G.stage===3,pay:G.stage===3?500:250,target:360,seconds:0,bumps:0,recoveries:0};}}
 G.toys=Object.fromEntries(Object.entries(G.toys).filter(([id,n])=>TOYS[id]&&Number.isInteger(n)&&n>0).map(([id,n])=>[id,Math.min(n,9999)]));sideShift=!!G.work&&!G.work.tutorial;
 if(collides(forklift.x,forklift.z,1.0)){forklift.x=-5;forklift.z=1.2;forklift.yaw=0;}
 if(collides(player.x,player.z,.35)||dist(player,forklift)<1.4)moveToSafe();camYaw=player.yaw;camEye=[player.x+Math.sin(camYaw)*5.5,3.2,player.z+Math.cos(camYaw)*5.5];camTarget=[player.x,1.2,player.z];};
const originalStartGame=startGame;
startGame=function(resume=false){originalStartGame(resume);if(resume&&G.pendingCapsule){dialogue=null;transition=null;$('fade').style.opacity='0';beginCapsuleScene(G.pendingCapsule);}else if(resume&&G.work?.race){transition=null;dialogue=null;$('fade').style.opacity='0';setMode('roam');G.work.race=false;G.work=null;sideShift=false;crates=[];toast('CIRCUIT RESET','Your best time is saved','Start a new circuit at a work board.');saveGame(true);}updateHUD();};
const originalSetMode=setMode;
setMode=function(m){originalSetMode(m);show('workBoard',m==='workboard');show('capsuleOverlay',m==='capsule');show('collectionOverlay',m==='collection');show('workDash',m==='forklift');show('workNav',m==='forklift');document.body.classList.toggle('capsule-mode',m==='capsule');document.body.classList.toggle('collection-mode',m==='collection');if(['capsule','collection'].includes(m)){document.body.classList.add('cinematic');show('hud',false);}if(m==='workboard')show('hud',false);};
collides=function(x,z,r=.34,includeCrates=false){if(x-r<WORLD.minX||x+r>WORLD.maxX||z-r<WORLD.minZ||z+r>WORLD.maxZ)return true;for(const o of obstacles){let dx=Math.max(Math.abs(x-o.x)-o.w/2,0),dz=Math.max(Math.abs(z-o.z)-o.d/2,0);if(dx*dx+dz*dz<r*r)return true;}if(includeCrates)for(const c of crates)if(c.id!==forklift.carry){let dx=Math.max(Math.abs(x-c.x)-.68,0),dz=Math.max(Math.abs(z-c.z)-.68,0);if(dx*dx+dz*dz<r*r)return true;}return false;};
function driverRank(){return Math.min(2,Math.floor(G.workStats.shifts/2));}
function driverTitle(){return ['RELIEF DRIVER','REGULAR DRIVER','SENIOR DRIVER'][driverRank()];}
function tutorialWork(){G.work={id:'tutorial',name:'A favour for Daichi',tag:'FIRST SHIFT / WAREHOUSE 03',tutorial:true,pay:500,target:360,seconds:0,bumps:0,recoveries:0};crates=routeCargo(crateOrigins.map(o=>[o.x,o.z,'A']));forklift={x:-5,z:1.2,yaw:0,speed:0,carry:null,lift:.12,targetLift:.12,operation:null};sideShift=false;}
shiftIntro=function(){if(!G.work)tutorialWork();openModal('Slow and steady.','FIRST FORKLIFT SHIFT','<p>Move three crates to <strong>bay 03</strong>. The number on each crate is the delivery address.</p><p>Stop with the forks in front of a crate. Press <strong>E</strong> to lift it. Drive to the marked bay. Stop, then press <strong>E</strong> to lower it.</p><div class="modalHint">W / S · DRIVE &nbsp; A / D · STEER &nbsp; SPACE · BRAKE<br>Q / Z · FORK HEIGHT &nbsp; C · CAB VIEW &nbsp; J · MANIFEST<br>There is no failure timer. Keep the cargo safe.</div>',[{text:'Get in the forklift',fn:()=>enterForklift()},{text:'Look around first',fn:()=>saveGame(true)}]);};
function showWorkBoard(){if(mode==='combat'||mode==='qte')return;boardPrev=mode==='forklift'?'forklift':'roam';forklift.speed=0;clearKeys();setMode('workboard');const rank=driverRank();$('workLicense').innerHTML='<strong>'+driverTitle()+'</strong>¥ '+G.cash.toLocaleString()+' · '+G.workStats.shifts+' shifts · '+G.workStats.delivered+' loads';
 $('contracts').innerHTML=JOBS.map(j=>{const locked=j.rank>rank;const bays=[...new Set(j.cargo.map(c=>BAYS[c[2]].number))].join(' / ');return '<button class="contract" data-job="'+j.id+'" '+(locked||G.work?'disabled':'')+'><span class="contractNum">'+j.tag+'<span>'+(locked?'LOCKED':'OPEN')+'</span></span><strong>'+j.name+'</strong><small>'+j.detail+'<br>Delivery bays: '+bays+'</small><span class="contractPay"><span>'+j.cargo.length+' LOADS · '+(locked?(j.rank*2)+' SHIFTS NEEDED':'PLUS BONUSES')+'</span><b>¥'+j.pay+'</b></span></button>';}).join('');
 document.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>startWork(b.dataset.job));show('workResume',!!G.work);$('workRace').disabled=!!G.work;$('workBoardNote').textContent=G.work?'Your current load sheet is still open. Finish or cancel that shift before you take another.':'Good condition and a prompt finish earn extra pay. The time target is optional. Finish two shifts to reach each new driver grade. Work is available before and after the story.';}
function closeWorkBoard(){setMode(boardPrev);}
function startWork(id){const def=JOBS.find(j=>j.id===id);if(!def||def.rank>driverRank()||G.work)return;G.work={id:def.id,name:def.name,tag:def.tag,tutorial:false,pay:def.pay,target:def.target,seconds:0,bumps:0,recoveries:0};crates=routeCargo(def.cargo);sideShift=true;navStamp='';setMode('roam');fadeTo(()=>{forklift={x:def.start[0],z:def.start[1],yaw:0,speed:0,carry:null,lift:.12,targetLift:.12,operation:null};player.x=forklift.x+2;player.z=forklift.z+1;player.y=0;enterForklift();saveGame();toast('LOAD SHEET ISSUED',def.name,def.cargo.length+' loads. Follow the numbers, not the nearest warehouse.');});}
enterForklift=function(){if(!G.work&&G.stage===3)tutorialWork();if(!G.work){showWorkBoard();return;}player.walk=0;player.y=0;forklift.speed=0;forklift.operation=null;forklift.targetLift=forklift.lift||.12;player.x=forklift.x;player.z=forklift.z;player.yaw=forklift.yaw;setMode('forklift');camYaw=forklift.yaw;camManual=0;camZoom=7;forkCamera=0;camEye=[forklift.x+Math.sin(camYaw)*7,4.2,forklift.z+Math.cos(camYaw)*7];camTarget=[forklift.x,1.25,forklift.z];updateHUD();saveGame(true);};
exitForklift=function(){if(forklift.operation){toast('HYDRAULICS MOVING','Let the forks stop first');return;}if(Math.abs(forklift.speed)>.5){toast('PARK FIRST','Hold '+prompts.brake+' to brake');return;}player.x=forklift.x+Math.cos(forklift.yaw)*1.85;player.z=forklift.z-Math.sin(forklift.yaw)*1.85;player.yaw=forklift.yaw;player.y=0;forklift.speed=0;if(collides(player.x,player.z,.35,true))moveToSafe();setMode('roam');camZoom=5.5;forkCamera=0;saveGame(true);};
recoverForklift=function(){if(G.work?.race){forklift.x=CIRCUIT[(G.work.checkpoint+CIRCUIT.length-1)%CIRCUIT.length][0];forklift.z=CIRCUIT[(G.work.checkpoint+CIRCUIT.length-1)%CIRCUIT.length][1];G.work.seconds+=8;toast('BACK ON COURSE','Eight-second recovery penalty');}else{if(forklift.carry!==null){const c=crates[forklift.carry];c.x=c.originX;c.z=c.originZ;c.integrity=Math.max(0,c.integrity-5);forklift.carry=null;}const def=JOBS.find(j=>j.id===G.work?.id);[forklift.x,forklift.z]=def?.start||[-5,1.2];if(G.work)G.work.recoveries=(G.work.recoveries||0)+1;toast('VEHICLE RECOVERED','Back at the shift start','Your delivered cargo stays delivered.');}forklift.speed=0;forklift.yaw=0;forklift.lift=.12;forklift.targetLift=.12;forklift.operation=null;player.x=forklift.x;player.z=forklift.z;camYaw=0;navStamp='';sound.sfx('load');saveGame(true);};
bestCrate=function(){if(!G.work||G.work.race)return null;const p=frontOfFork();let best=null,dd=1.65;for(const c of crates)if(!c.delivered&&c.id!==forklift.carry){const d=dist(p,c),facing=((c.x-forklift.x)*-Math.sin(forklift.yaw)+(c.z-forklift.z)*-Math.cos(forklift.yaw))/(dist(c,forklift)||1);if(d<dd&&facing>.64){dd=d;best=c;}}return best;};
function bayAt(p){return Object.values(BAYS).find(b=>Math.abs(p.x-b.x)<b.w/2-.3&&Math.abs(p.z-b.z)<b.d/2-.3)||null;}
inBay=function(p){const b=bayAt(p);return !!b&&(!G.work||forklift.carry===null||crates[forklift.carry]?.bay===b.id);};
forkAction=function(){if(!G.work||G.work.race)return;if(forklift.operation)return;if(Math.abs(forklift.speed)>.45){toast('BRAKE FIRST','Stop before you move the load','Hold '+prompts.brake+'. Watch the speed display.');return;}
 const front=frontOfFork();if(forklift.carry===null){const c=bestCrate();if(!c){toast('LINE UP THE FORKS','Face the front of a marked pallet','Move closer, stop, then press '+prompts.use+'.');return;}forklift.operation={kind:'pickup',id:c.id,t:0,attached:false};forklift.targetLift=.12;sound.sfx('load');}
 else{const c=crates[forklift.carry],bay=bayAt(front);if(bay&&bay.id!==c.bay){sound.sfx('fail');toast('CHECK THE LOAD SHEET','Wrong bay: this cargo goes to '+BAYS[c.bay].number,'This is bay '+bay.number+'. Your load is still on the forks.');return;}
 if(!bay&&collides(front.x,front.z,.77,true)){toast('KEEP THE GROUND CLEAR','There is not enough room here');return;}forklift.operation={kind:bay?'deliver':'setdown',id:c.id,t:0,x:front.x,z:front.z};forklift.targetLift=.10;sound.sfx('load');}
 forklift.speed=0;};
function deliverCargo(c){c.delivered=true;const b=BAYS[c.bay],others=crates.filter(v=>v.delivered&&v.bay===c.bay).length-1,cols=b.w<8?3:4;c.x=b.x-(cols-1)*.83+(others%cols)*1.66;c.z=b.z-b.d/2+1.08+Math.floor(others/cols)*1.7;forklift.carry=null;navStamp='';const done=crates.filter(v=>v.delivered).length;sound.sfx('success');toast('DELIVERY SIGNED',done+' / '+crates.length+' loads · bay '+b.number,Math.round(c.integrity)+'% condition. '+(done<crates.length?'The next pallet is on the map.':'Your shift is complete.'));saveGame(true);if(done===crates.length){fadeTo(finishShift);}}
function cargoMesh(b,c,x,y,z){const type=CARGO_TYPES[c.type]||CARGO_TYPES.general,sz=1.35;b.push(x,y,z);if(c.type==='cold'){b.box(0,.73,0,sz,1.15,sz,T.paint,type.color);for(let a of [-1,1])b.box(a*.44,.76,0,.05,1.22,sz+.03,T.white,'#7eaaa7');b.box(0,.16,0,1.43,.16,1.43,T.wood,'#968863');b.box(0,1.34,0,1.41,.09,1.41,T.white,'#dae0cb');}else{crate(b,0,0,0,sz,false);if(c.type==='fragile'){for(let a of [-1,1])b.box(a*.34,.74,0,.08,1.41,1.39,T.paint,type.color);}if(c.type==='machine'){b.box(0,.76,0,1.37,.10,1.38,T.paint,'#8b9282');b.box(0,1.1,0,1.37,.06,1.38,T.paint,'#899c96');}}
 for(const side of [-1,1]){b.plane(0,.82,side*.699,1.0,.46,T[type.tag],'#ffffff',side<0?PI:0);b.plane(0,1.16,side*.701,.35,.24,T[BAYS[c.bay||'A'].tx],'#ffffff',side<0?PI:0);}if(c.integrity<70)b.box(0,.59,.706,.8,.035,.006,T.paint,'#937e5b');b.pop();}
updateForklift=function(dt){if(!G.work){forklift.speed=0;return;}const op=forklift.operation;let a=moveAxis();if(op){op.t+=dt;forklift.speed=0;if(op.kind==='pickup'){if(op.t>.4&&!op.attached){forklift.carry=op.id;op.attached=true;forklift.targetLift=.52;navStamp='';}if(op.t>1.15){forklift.operation=null;const c=crates[op.id];toast('LOAD ON THE FORKS',CARGO_TYPES[c.type].name+' → bay '+BAYS[c.bay].number,'Keep the load low. '+prompts.sheet+' opens your load sheet.');saveGame(true);}}else if(op.t>Math.max(.8,forklift.lift*1.1)){const c=crates[op.id];forklift.operation=null;forklift.carry=null;forklift.lift=.10;if(op.kind==='deliver')deliverCargo(c);else{c.x=op.x;c.z=op.z;toast('PALLET SET DOWN','The label stays on your load sheet');saveGame(true);}}}
 else{if(keys.KeyQ)forklift.targetLift=clamp(forklift.targetLift+dt*.7,.10,1.6);if(keys.KeyZ)forklift.targetLift=clamp(forklift.targetLift-dt*.7,.10,1.6);const loaded=forklift.carry!==null,heavy=loaded&&crates[forklift.carry].type==='machine';let maxSpeed=loaded?(heavy?3.35:3.9):5.15;if(forklift.lift>1.0&&loaded)maxSpeed=2.4;
 if(keys.Space)forklift.speed*=Math.exp(-dt*11);else if(Math.abs(a.y)>.05)forklift.speed=clamp(forklift.speed+a.y*(loaded?2.5:3.5)*dt,-2.0,maxSpeed);else forklift.speed*=Math.exp(-dt*1.65);if(Math.abs(forklift.speed)<.025)forklift.speed=0;
 const oldYaw=forklift.yaw,oldX=forklift.x,oldZ=forklift.z,speed=Math.abs(forklift.speed),turn=a.x*dt*(.35+Math.min(1,speed/2)*.78)*(forklift.speed<-.1?-1:1);forklift.yaw-=turn;
 const dx=-Math.sin(forklift.yaw)*forklift.speed*dt,dz=-Math.cos(forklift.yaw)*forklift.speed*dt;let blocked=collides(forklift.x+dx,forklift.z+dz,.98,true);if(loaded){const front=frontOfFork();blocked=blocked||collides(front.x+dx,front.z+dz,.69,true);}if(blocked){forklift.yaw=oldYaw;if(speed>.9&&worldTime-(G.work.lastBump||-10)>1.2){G.work.lastBump=worldTime;G.work.bumps=(G.work.bumps||0)+1;screenShake=.07;sound.sfx('block');kit.input.rumble(.5,140);if(loaded){const c=crates[forklift.carry];c.integrity=Math.max(0,c.integrity-(speed*3+3)*CARGO_TYPES[c.type].damage);toast('EASY ON THE LOAD',Math.round(c.integrity)+'% cargo condition','Brake before you turn. Keep the forks low.');}}forklift.speed*=.25;}
 else{forklift.x+=dx;forklift.z+=dz;}if(loaded&&forklift.lift>.95&&Math.abs(a.x)>.65&&speed>1.8){const c=crates[forklift.carry];c.integrity=Math.max(0,c.integrity-dt*2.2);}
 }
 const delta=forklift.targetLift-forklift.lift;forklift.lift+=clamp(delta,-dt*.9,dt*.7);if(Math.abs(delta)>.04&&worldTime-lastHydraulic>.2){lastHydraulic=worldTime;if(sound.ctx){sound.tone(118+forklift.lift*30,sound.ctx.currentTime,.22,.027,'sawtooth');sound.noise(.1,.018,500);}}
 if(forklift.speed<-.3&&worldTime-lastReverse>.9){lastReverse=worldTime;if(sound.ctx)sound.tone(630,sound.ctx.currentTime,.13,.036,'sine');}
 player.x=forklift.x;player.z=forklift.z;player.yaw=forklift.yaw;player.y=0;if(worldTime>camManual)camYaw+=angdiff(camYaw,forklift.yaw)*Math.min(1,dt*2.2);if(forklift.carry!==null){const c=crates[forklift.carry],f=frontOfFork();c.x=f.x;c.z=f.z;}if(G.work?.race)updateCircuit(dt);
};
function workManifest(){if(!G.work)return;forklift.speed=0;const w=G.work;if(w.race){openModal('The forklift circuit.','TWO LAPS / ALL CHECKPOINTS','<p>Drive through each marked gate in order.</p><p>Lap '+(Math.floor(w.checkpoint/CIRCUIT.length)+1)+' of 2. Elapsed: '+formatDuration(w.seconds)+'.</p><p>The blue truck is a reference driver. Finish under three minutes to earn the golden forklift.</p>',[{text:'Back to the circuit',fn:()=>{}},{text:'Leave the circuit',fn:()=>cancelWork()}]);return;}
 const body='<div class="manifestList">'+crates.map(c=>'<div><span>'+(c.delivered?'✓':'□')+' '+String(c.id+1).padStart(2,'0')+' · '+CARGO_TYPES[c.type].name+'</span><b>'+BAYS[c.bay].number+' / '+Math.round(c.integrity)+'%</b></div>').join('')+'</div><p>Base pay: ¥'+w.pay+'. Time target: '+formatDuration(w.target)+'. Current time: '+formatDuration(w.seconds)+'.</p><p class="payFine">The time target gives a bonus. It does not end your shift. Wrong bays do not accept your cargo.</p>';
 const buttons=[{text:'Back to work',fn:()=>{}}];if(!w.tutorial)buttons.push({text:'Cancel this shift',fn:()=>confirmCancelWork()});openModal(w.name,'YOUR LOAD SHEET',body,buttons);}
function confirmCancelWork(){openModal('Cancel this load sheet?','UNFINISHED SHIFT','<p>You will not receive pay for an unfinished shift. Your story and collection will not change.</p>',[{text:'Keep the shift',fn:()=>{}},{text:'Cancel the shift',fn:()=>cancelWork()}]);}
function cancelWork(){G.work=null;sideShift=false;forklift.carry=null;forklift.operation=null;forklift.speed=0;crates=[];player.x=forklift.x+2;player.z=forklift.z;moveToSafe();setMode('roam');camZoom=5.5;saveGame();}
finishShift=function(){const w=G.work;if(!w){setMode('roam');return;}if(w.race){finishCircuit();return;}const cond=crates.reduce((sum,c)=>sum+c.integrity,0)/Math.max(1,crates.length),care=Math.round(w.pay*.25*cond/100),time=w.seconds<=w.target?Math.round(w.pay*.15):0,bonus=cond>=99.9&&!(w.recoveries||0)?100:0,pay=w.pay+care+time+bonus,grade=cond>=96?'A':cond>=80?'B':cond>=60?'C':'D',oldRank=driverRank(),tutorial=!!w.tutorial;
 G.cash+=pay;G.workStats.shifts++;G.workStats.delivered+=crates.length;G.workStats.earnings+=pay;G.workStats.bests[w.id]=Math.min(G.workStats.bests[w.id]||Infinity,w.seconds);if(!tutorial)G.sideShifts++;G.work=null;sideShift=false;forklift.operation=null;forklift.carry=null;forklift.speed=0;forklift.lift=.12;forklift.targetLift=.12;
 if(tutorial){forklift.x=-5;forklift.z=1.2;forklift.yaw=0;player.x=-6.8;player.z=4;player.yaw=.55;stageTo(4);}else{player.x=forklift.x+1.9;player.z=forklift.z+1;moveToSafe();}camZoom=5.5;camYaw=player.yaw;setMode('roam');saveGame();
 const receipt='<div class="payGrade">'+grade+'</div><p>'+crates.length+' loads signed for. Average condition: '+Math.round(cond)+'%.</p><div class="payRows"><div><span>Shift pay</span><b>¥'+w.pay+'</b></div><div><span>Cargo care</span><b>¥'+care+'</b></div><div><span>Time bonus</span><b>¥'+time+'</b></div><div><span>Clean shift</span><b>¥'+bonus+'</b></div><div class="payTotal"><span>PAID</span><b>¥'+pay+'</b></div></div><p class="payFine">Elapsed '+formatDuration(w.seconds)+' · target '+formatDuration(w.target)+' · '+w.bumps+' bumps<br>'+(driverRank()>oldRank?'PROMOTED: '+driverTitle()+'. More routes are open.':'Account balance: ¥'+G.cash.toLocaleString()+'. Each capsule costs ¥100.')+'</p>';
 openModal('An honest day\u2019s work.','NAGAMATSU / PAY SLIP',receipt,tutorial?[{text:'Speak to Daichi',fn:()=>talk([{n:'Daichi',t:'Good work. Your pay is in the envelope.'},{n:'Jun',t:'The red ledger?'},{n:'Daichi',t:'Kita Shipping. Warehouse 08. Look at the freight board on Warehouse 03.'},{n:'Daichi',t:'There are more shifts on the work board. Keep the load low.'}],()=>saveGame(),npc('daichi'))}]:[{text:'Back to the harbour',fn:()=>{}},{text:'Read the next load sheet',fn:()=>showWorkBoard()}],false);
};
function startCircuit(){if(G.work)return;setMode('roam');openModal('One truck. Two laps.','THE MORNING COURSE / PRACTICE AT ANY TIME','<p>Drive through all ten gates, twice. The blue truck is a reference driver.</p><p>Finish in under <strong>3:00</strong> to earn the <strong>Golden No. 05</strong> figure. You also receive circuit pay. There is no fuel fee.</p><div class="modalHint">SPACE · BRAKE &nbsp; C · CAB VIEW &nbsp; R · RECOVER (+8 SEC)<br>No cargo on this run. Take the corners wide.</div>',[{text:'Start the circuit',fn:()=>{G.work={id:'circuit',name:'The forklift circuit',tag:'TWO LAPS / NORTH YARD',race:true,seconds:0,checkpoint:0,bumps:0,recoveries:0};sideShift=true;crates=[];forklift={x:0,z:-42.5,yaw:0,speed:0,carry:null,lift:.15,targetLift:.15,operation:null};enterForklift();saveGame();}},{text:'Not now',fn:()=>{}}]);}
function updateCircuit(dt){const w=G.work;if(!w?.race)return;const target=CIRCUIT[w.checkpoint%CIRCUIT.length];if(Math.hypot(forklift.x-target[0],forklift.z-target[1])<4.6){w.checkpoint++;sound.sfx('coin');navStamp='';if(w.checkpoint>=CIRCUIT.length*2){fadeTo(finishCircuit);}else toast(w.checkpoint===CIRCUIT.length?'FINAL LAP':'GATE PASSED','Gate '+((w.checkpoint%CIRCUIT.length)+1)+' / '+CIRCUIT.length,'Follow the next gold gate.');}}
function finishCircuit(){const w=G.work;if(!w?.race){setMode('roam');return;}const seconds=w.seconds,best=!G.workStats.raceBest||seconds<G.workStats.raceBest,award=seconds<=180,pay=seconds<140?800:award?600:350;G.cash+=pay;G.workStats.earnings+=pay;G.workStats.races++;if(best)G.workStats.raceBest=seconds;const newToy=award&&!G.toys[24];if(newToy)G.toys[24]=1;G.work=null;sideShift=false;forklift.speed=0;forklift.x=0;forklift.z=-43;forklift.yaw=0;player.x=2;player.z=-43;setMode('roam');saveGame();sound.sfx('success');openModal(formatDuration(seconds),'CIRCUIT COMPLETE'+(best?' / PERSONAL BEST':''),'<p>Two laps. All gates passed.</p><div class="payRows"><div><span>Circuit pay</span><b>¥'+pay+'</b></div><div><span>Best time</span><b>'+formatDuration(G.workStats.raceBest)+'</b></div></div><p>'+(newToy?'The Golden No. 05 is now in your collection.':award?'A clean route through the north yard.':'Finish under 3:00 to earn the Golden No. 05.')+'</p>',[{text:newToy?'Inspect the golden forklift':'Back to the harbour',fn:()=>{if(newToy)openCollection(24,'roam');}},{text:'Run the course again',fn:()=>startCircuit()}],false);}

/* Tiny physical models. The same mesh is used in the purchase and the notebook. */
function toyWheel(b,x,y,z,r=.13){b.push(x,y,z).rotateZ(PI/2);b.cylinder(0,0,0,r,r,.095,T.white,'#2a3b3d',12);b.cylinder(0,x>0?-.055:.055,0,r*.45,r*.45,.015,T.white,'#b6bbaa',10);b.pop();}
function toyModel(b,id){const t=TOYS[id]||TOYS[0],col=t.color;
 if(t.kind==='forklift'){b.push(0,0,.08,PI*.95).scale(.33);forkliftMesh(b,{x:0,z:0,yaw:0,carry:null,lift:.24,paint:col,plate:id===6?T.two:T.five},0,null);b.pop();return;}
 if(['van','flatbed','tug'].includes(t.kind)){const van=t.kind==='van',tug=t.kind==='tug';b.box(0,.28,0,.69,.17,1.26,T.white,col);b.box(0,.53,.31,.64,.46,.55,T.white,col);b.plane(0,.59,.592,.50,.23,T.glass);for(let x of [-.327,.327])b.plane(x,.60,.31,.42,.21,T.glass,'#e0e6ca',x<0?-PI/2:PI/2);for(let side of [-1,1]){b.box(side*.23,.39,.625,.105,.10,.025,T.white,'#e3d9a8');b.box(side*.22,.35,-.642,.085,.055,.02,T.white,'#bf5742');for(let z of [-.40,.38])toyWheel(b,side*.37,.17,z,.16);}b.box(0,.32,.66,.70,.07,.08,T.white,'#a8b8aa');if(van){b.box(0,.56,-.30,.66,.61,.63,T.white,col);b.plane(.339,.62,-.25,.29,.26,T.glass,'#dfe5cf',PI/2);b.box(.341,.40,-.3,.012,.025,.28,T.white,'#506b63');}else if(tug){b.box(0,.46,-.33,.65,.24,.47,T.paint,col);b.box(0,.31,-.77,.11,.10,.26,T.white,'#59736e');b.box(0,.86,.15,.055,.37,.035,T.white,'#45665e');}else{b.box(0,.36,-.31,.72,.08,.69,T.wood,'#b9a173');for(let side of [-1,1])b.box(side*.34,.46,-.3,.045,.17,.67,T.white,col);}return;}
 if(t.kind==='freighter'||t.kind==='ferry'){const ferry=t.kind==='ferry';b.taper(0,.19,0,.35,.62,.34,.92,1.47,T.white,col);b.box(0,.36,0,.63,.04,1.4,T.white,'#b8b9a0');b.box(0,.56,ferry?0:.40,.53,ferry?.38:.30,ferry?1.05:.42,T.white,'#e1debd');b.box(0,.78,ferry?.02:.4,.57,.055,ferry?1.08:.48,T.white,'#4e7b8a');b.cylinder(0,.88,.34,.082,.082,.22,T.white,'#b5664a',12);for(const side of [-1,1]){for(let i=0;i<(ferry?6:2);i++)b.plane(side*.270,.59,(ferry?-.44:.24)+i*.15,.088,.12,T.glass,'#fff',side<0?-PI/2:PI/2);for(let i=0;i<6;i++)b.box(side*.27,.44,-.56+i*.21,.012,.14,.014,T.white,'#d3ddc7');b.beam([side*.27,.51,-.62],[side*.27,.51,.64],.012,T.white,'#e0e2c5');}if(!ferry){for(let z of [-.47,-.13])b.box(0,.49,z,.48,.24,.29,T.metal,z<-.2?'#a5835d':'#658f82');b.beam([0,.38,-.4],[0,.98,-.4],.02,T.white,'#c6c9b0');}return;}
 if(t.kind==='cat'){b.cylinder(0,.055,0,.38,.38,.09,T.white,'#778c7e',20);b.sphere(0,.32,0,.23,.3,.23,T.white,col,8,14);b.sphere(0,.68,-.025,.24,.23,.21,T.white,col,8,14);for(const side of [-1,1]){b.tri([side*.23,.78,-.06],[side*.07,.82,-.06],[side*.20,1.00,-.055],T.white,id===17&&side===1?'#4e5b51':col);b.tri([side*.19,.81,-.071],[side*.105,.83,-.071],[side*.18,.93,-.071],T.white,'#b79682');b.sphere(side*.10,.70,.164,.035,.044,.018,T.white,'#cdb779',5,8);b.box(side*.10,.702,.18,.012,.046,.012,T.white,'#243c39');b.sphere(side*.12,.12,.16,.085,.085,.16,T.white,col,5,8);}b.sphere(0,.61,.196,.037,.023,.025,T.white,'#a07d69',4,8);b.beam([.16,.20,-.11],[.37,.29,-.24],.083,T.white,col);b.beam([.37,.29,-.24],[.38,.50,-.18],.075,T.white,col);return;}
 if(t.kind==='kettle'||t.kind==='cup'){const kettle=t.kind==='kettle';b.cylinder(0,.045,0,.37,.37,.07,T.white,'#c9cbae',24);b.sphere(0,.33,0,kettle?.29:.26,kettle?.27:.22,.26,T.white,col,10,18);if(kettle){b.cylinder(0,.60,0,.20,.24,.045,T.white,col,20);b.sphere(0,.65,0,.06,.07,.06,T.white,'#405e54',5,10);b.beam([-.23,.35,0],[-.47,.58,0],.095,T.white,col);b.cylinder(-.48,.58,0,.062,.069,.06,T.white,'#afc3ab',10);}else{b.cylinder(0,.51,0,.25,.25,.016,T.white,'#d1d9be',22);b.cylinder(0,.514,0,.217,.217,.018,T.white,'#5c6147',22);}for(let i=0;i<12;i++){let a=-1.7+i/12*3.4,d=-1.7+(i+1)/12*3.4;b.beam([.28+Math.cos(a)*.20,.34+Math.sin(a)*.19,0],[.28+Math.cos(d)*.20,.34+Math.sin(d)*.19,0],.056,T.white,col);}return;}
 if(t.kind==='gull'){b.cylinder(0,.045,0,.37,.39,.08,T.white,'#7b9a92',18);b.cylinder(0,.21,0,.14,.15,.3,T.wood,'#aaa085',12);b.sphere(0,.55,0,.18,.17,.29,T.white,'#e4e4ce',7,12);b.sphere(0,.74,.17,.12,.13,.13,T.white,'#eee5cc',6,10);b.taper(0,.715,.325,.055,.06,.06,.18,.04,T.white,'#d5ac55');for(let side of [-1,1]){b.tri([side*.10,.58,-.10],[side*.75,.71,-.24],[side*.23,.52,.16],T.white,'#becbca');b.tri([side*.52,.66,-.18],[side*.77,.71,-.24],[side*.64,.56,-.15],T.white,'#4a6161');b.sphere(side*.097,.76,.237,.018,.018,.015,T.white,'#2b4242',4,6);b.beam([side*.07,.39,.01],[side*.09,.31,.01],.025,T.white,'#b49860');}return;}
 if(t.kind==='crane'||t.kind==='gantry'){const gantry=t.kind==='gantry';b.box(0,.055,0,1.02,.10,.76,T.white,'#748f80');if(gantry){for(let side of [-1,1]){b.beam([side*.40,.10,-.25],[side*.32,1.08,-.20],.065,T.white,col);b.beam([side*.40,.10,.25],[side*.32,1.08,.20],.065,T.white,col);b.beam([side*.40,.25,-.24],[side*.34,.85,.22],.025,T.white,'#b8c9ae');}b.box(0,1.08,0,.90,.15,.5,T.white,col);b.box(0,.21,0,.47,.21,.44,T.metal,'#b57d56');b.beam([.15,1.02,0],[.15,.57,0],.014,T.white,'#344d46');b.box(.15,.56,0,.09,.08,.06,T.white,'#d8bd78');}else{for(let side of [-1,1]){b.beam([side*.18,.10,0],[side*.10,.90,0],.060,T.white,col);for(let i=0;i<3;i++)b.beam([-.15,.15+i*.23,0],[.15,.38+i*.23,0],.022,T.white,col);}b.box(.04,.9,0,.35,.23,.30,T.white,col);b.plane(.05,.94,.155,.18,.12,T.glass);b.beam([0,1.02,0],[.67,1.15,0],.045,T.white,col);b.beam([0,1.18,0],[.67,1.15,0],.023,T.white,col);b.beam([.63,1.15,0],[.63,.56,0],.011,T.white,'#3b544f');b.box(.63,.52,0,.068,.08,.044,T.white,'#677f72');}return;}
 if(t.kind==='jack'){b.box(0,.1,0,.56,.12,.29,T.white,col);for(let x of [-.20,.20]){b.box(x,.065,.37,.12,.065,.90,T.white,col);toyWheel(b,x,.065,.71,.057);}b.beam([0,.18,-.10],[0,.71,-.31],.044,T.white,'#62796e');for(let side of [-1,1]){b.beam([side*.16,.68,-.30],[side*.16,.87,-.35],.036,T.white,'#3f5952');}b.beam([-.16,.87,-.35],[.16,.87,-.35],.036,T.white,'#3f5952');roundPart(b,0,.12,-.11,.10,.12,'#2b423c');return;}
 if(t.kind==='bun'){b.box(0,.045,0,.85,.08,.74,T.white,'#e1d4b2');b.sphere(0,.23,0,.35,.22,.29,T.white,col,10,18);b.sphere(0,.392,0,.14,.024,.071,T.white,'#a17b4d',5,10);b.tri([.10,.404,0],[.24,.404,-.06],[.24,.404,.06],T.white,'#a17b4d');b.sphere(-.07,.416,.02,.012,.009,.010,T.white,'#554f38',4,6);for(let i=-2;i<3;i++)b.box(i*.047,.419,0,.009,.006,.09,T.white,'#d7b278');return;}
 if(t.kind==='phone'){b.box(0,.10,0,.50,.20,.45,T.white,'#597263');b.taper(0,.43,0,.48,.43,.57,.38,.28,T.white,col);b.plane(0,.49,.196,.24,.32,T.white,'#c1c8ab');for(let j=0;j<4;j++)for(let i=0;i<3;i++)b.box(-.065+i*.065,.54-j*.06,.207,.043,.041,.025,T.white,'#4b6259');b.box(.125,.70,.158,.14,.045,.03,T.white,'#2a483f');b.box(-.265,.50,0,.10,.38,.13,T.white,'#38584c');for(let a of [-1,1])b.sphere(-.25,.50+a*.22,0,.10,.07,.11,T.white,'#426653',5,10);for(let i=0;i<12;i++)b.beam([-.24+Math.sin(i)*.025,.25-i*.012,.02],[-.24+Math.sin(i+1)*.025,.25-(i+1)*.012,.02],.012,T.white,'#344f49');return;}
 if(t.kind==='vending'){b.box(0,.46,0,.59,.92,.46,T.white,col);b.plane(0,.79,.239,.52,.15,T.drink);b.box(-.055,.51,.24,.41,.36,.025,T.white,'#2a4c4f');for(let i=0;i<6;i++){b.cylinder(-.185+(i%3)*.128,.43+Math.floor(i/3)*.16,.273,.036,.036,.11,T.white,['#c6ac60','#84a9a2','#c6cab1'][i%3],8);}b.box(0,.15,.241,.36,.095,.02,T.white,'#294b47');b.box(.22,.44,.249,.053,.048,.02,T.white,'#dacb99');return;}
 if(t.kind==='busstop'){b.box(0,.035,0,1,.06,.62,T.white,'#9ca78d');b.beam([-.27,.07,0],[-.27,.99,0],.034,T.white,'#9fb5a5');b.plane(-.27,.86,.015,.34,.27,T.bus);b.plane(-.27,.57,.016,.18,.23,T.notice);b.box(.20,.24,.05,.62,.08,.27,T.wood,'#ae9a72');b.box(.20,.39,-.06,.62,.24,.044,T.wood,'#ae9a72');for(let side of [-1,1])b.box(.20+side*.23,.13,.03,.042,.23,.20,T.white,'#4f6b5c');return;}
 if(t.kind==='lighthouse'){b.cylinder(0,.06,0,.36,.36,.12,T.white,'#80978b',16);b.cylinder(0,.47,0,.24,.16,.74,T.white,col,16);for(let y of [.32,.57])b.cylinder(0,y,0,.226-(y-.32)*.10,.205-(y-.32)*.10,.09,T.white,'#a7604b',16);b.cylinder(0,.9,0,.18,.18,.17,T.white,'#dcbe71',12);b.cylinder(0,.81,0,.23,.23,.055,T.white,'#566f69',16);b.cylinder(0,1.04,0,.25,0,.13,T.white,'#4c6d68',16);for(let i=0;i<6;i++){let a=i/6*TAU;b.box(Math.sin(a)*.165,.9,Math.cos(a)*.165,.022,.19,.022,T.white,'#3c5955');}return;}
 if(t.kind==='train'){b.box(0,.14,0,.62,.18,1.3,T.white,'#3d514b');b.box(0,.46,-.23,.53,.52,.40,T.white,col);b.box(0,.37,.30,.47,.34,.64,T.white,col);b.box(0,.75,-.23,.64,.08,.50,T.white,'#879c85');b.plane(0,.54,-.443,.37,.20,T.glass,'#fff',PI);b.box(0,.19,.68,.62,.08,.06,T.white,'#ae654b');b.cylinder(0,.61,.48,.073,.073,.19,T.white,'#334b46',10);for(let side of [-1,1]){for(let z of [-.41,.0,.41])toyWheel(b,side*.32,.13,z,.12);b.beam([side*.382,.13,-.41],[side*.382,.13,.41],.026,T.white,'#aaad91');}return;}
 if(t.kind==='diver'){b.cylinder(0,.06,0,.37,.37,.12,T.white,'#627e72',18);b.sphere(0,.46,0,.33,.34,.29,T.white,col,12,20);b.taper(0,.18,0,.51,.41,.15,.40,.37,T.white,col);roundPart(b,0,.46,.271,.18,.05,'#d3b781',20);roundPart(b,0,.46,.307,.134,.045,'#41646f',20);for(let i=0;i<8;i++){let a=i/8*TAU;b.sphere(Math.sin(a)*.154,.46+Math.cos(a)*.154,.334,.015,.015,.013,T.white,'#806548',4,6);}b.box(0,.46,.338,.02,.24,.012,T.white,'#b99c68');b.box(0,.46,.34,.24,.02,.012,T.white,'#b99c68');return;}
 if(t.kind==='watch'){b.box(0,.055,0,.65,.11,.53,T.white,'#5c6a61');b.beam([0,.1,-.12],[0,.63,-.1],.10,T.white,'#566c61');roundPart(b,0,.63,0,.30,.13,col,28);roundPart(b,0,.63,.073,.254,.019,'#e2dbc0',28);for(let i=0;i<12;i++){const a=i/12*TAU;b.beam([Math.sin(a)*.207,.63+Math.cos(a)*.207,.09],[Math.sin(a)*.232,.63+Math.cos(a)*.232,.09],.013,T.white,'#4c6157');}b.beam([0,.63,.108],[0,.83,.108],.013,T.white,'#40584f');b.beam([0,.63,.113],[0,.48,.113],.026,T.white,'#40584f');b.sphere(0,.63,.12,.022,.022,.015,T.white,'#b29b65',5,10);b.cylinder(0,.964,0,.061,.061,.08,T.white,col,12);return;}
}
function drawToy(b,id,x,y,z,scale=1,yaw=0){b.push(x,y,z,yaw).scale(scale);toyModel(b,id);b.pop();}
function handMesh(b,x,y,z,scale=.7,curl=.4,rz=0,rx=0){b.push(x,y,z).rotateZ(rz).rotateX(rx).scale(scale);const skin='#dbb08b';b.box(0,-.21,.01,.23,.25,.20,T.cloth,'#735039');b.box(0,-.094,.01,.19,.07,.15,T.cloth,'#4d5748');b.sphere(0,.045,0,.123,.142,.065,T.skin,skin,7,12);
 for(let i=0;i<4;i++){const xx=-.085+i*.057,len=[.17,.205,.195,.145][i],a=[xx,.13,0],m=[xx,.13+len*.53,-curl*.05],end=[xx,.13+len*(1-curl*.43),-curl*.13];b.beam(a,m,.047,T.skin,skin);b.sphere(...m,.025,.025,.024,T.skin,skin,4,7);b.beam(m,end,.042,T.skin,skin);b.sphere(...end,.024,.029,.022,T.skin,skin,4,7);b.plane(xx,end[1],end[2]+.023,.029,.040,T.white,'#d7b79a');}
 b.beam([.09,.025,0],[.17,.08,-.03],.068,T.skin,skin);b.beam([.17,.08,-.03],[.145,.16,-curl*.10],.06,T.skin,skin);b.sphere(.145,.16,-curl*.1,.03,.035,.025,T.skin,skin,5,8);b.pop();}
function coatArm(b,shoulder,elbow,wrist){b.beam(shoulder,elbow,.18,T.cloth,'#78563c');b.beam(elbow,wrist,.145,T.cloth,'#78563c');b.sphere(...elbow,.084,.085,.08,T.cloth,'#78563c',5,8);}
function openPalm(b,x,y,z,side=1){const skin='#ddb78f';b.push(x,y,z);b.beam([side*.10,-.045,-.03],[side*.045,0,0],.085,T.skin,skin);b.sphere(0,.015,0,.125,.043,.135,T.skin,skin,7,14);for(let i=0;i<4;i++){let xx=-.083+i*.051;b.beam([xx,.02,-.07],[xx,.038,-.19],.042,T.skin,skin);b.sphere(xx,.043,-.19,.025,.027,.024,T.skin,skin,4,8);}b.beam([side*.09,.018,.02],[side*.16,.051,-.06],.056,T.skin,skin);b.pop();}
function coinMesh(b,x,y,z,spin=0,tilt=0){b.push(x,y,z,spin).rotateX(tilt);roundPart(b,0,0,0,.057,.012,'#c4c5b0',32);for(const side of [-1,1])for(let i=0;i<40;i++){const a=i/40*TAU,c=(i+1)/40*TAU,r=.055,z=side*.0075,p=[Math.cos(a)*r,Math.sin(a)*r,z],q=[Math.cos(c)*r,Math.sin(c)*r,z],u=[.5+Math.cos(a)*.5,.5-Math.sin(a)*.5],v=[.5+Math.cos(c)*.5,.5-Math.sin(c)*.5];if(side>0)b.tri([0,0,z],p,q,T.coin,'#fff',[[.5,.5],u,v]);else b.tri([0,0,z],q,p,T.coin,'#fff',[[.5,.5],v,u]);}b.pop();}
const originalToySVG=toySVG;
toySVG=function(id,size=38){const t=TOYS[id];if(!t)return originalToySVG(0,size);const known={forklift:0,freighter:1,ferry:1,gull:2,kettle:3,cup:3,crane:4,gantry:4,cat:5};if(known[t.kind]!==undefined)return originalToySVG(known[t.kind],size);
 const paths={van:'<path d="M7 40V20h32l13 13v12H7zm32-20v15h13M12 25h19v10H12"/><circle cx="17" cy="44" r="5"/><circle cx="43" cy="44" r="5"/>',flatbed:'<path d="M5 39h31V21h11l8 10v13H5zm32-13h8l6 9H37"/><circle cx="15" cy="45" r="5"/><circle cx="44" cy="45" r="5"/>',tug:'<path d="M9 42V27h27V15h14v27M36 28h14M50 42h7"/><circle cx="16" cy="44" r="5"/><circle cx="43" cy="44" r="5"/>',jack:'<path d="M13 40h36l6 6H15L6 39m10 1V13h12v9H15m8 20h26"/><circle cx="13" cy="46" r="4"/>',bun:'<path d="M8 43q-4-27 22-27t22 27zM4 45h52l-5 8H9zM20 30q10-9 19 0q-10 9-19 0zm17 0 8-5v10z"/>',phone:'<path d="M18 11h28v42H18zm6 19h15m-15 6h15m-15 6h15M10 14v24q4 8 6 2V16q-2-8-6-2M28 18h10"/>',vending:'<path d="M13 6h35v49H13zm5 5h25v7H18zm0 12h25v17H18zm7 23h14M24 25v12m10-12v12"/>',busstop:'<path d="M18 53V9h21v15H18m1-10h15M5 43h30v5H5zm4 5v6m21-6v6M43 10h10v38H43"/>',lighthouse:'<path d="M9 54h43M19 54l5-31h14l5 31M19 23h24V11H19zm-3-12L31 4l15 7M23 35h16M22 44h19m-9-31v9"/>',train:'<path d="M6 41h47V26H27V12H8v29m0-23h12v11H8m30-3v-9h6v9M4 44h52"/><circle cx="15" cy="47" r="5"/><circle cx="31" cy="47" r="5"/><circle cx="47" cy="47" r="5"/>',diver:'<circle cx="30" cy="27" r="19"/><circle cx="30" cy="28" r="12"/><path d="M30 16v24M18 28h24M17 43l-5 10h36l-5-10"/>',watch:'<circle cx="30" cy="33" r="20"/><path d="M25 11V5h10v6M30 17v16l8 9M13 33h3m28 0h3M30 48v-3"/>'};return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+(paths[t.kind]||'')+'</svg>';};
function inspectMachine(id=0){const s=SERIES[id];if(!s)return;lastMachine=id;player.walk=0;const owned=s.ids.filter(id=>G.toys[id]).length;openModal(s.name,s.location.toUpperCase()+' / CAPSULE TOYS',
 '<p>One hundred yen. Turn the handle. See what comes out.</p><div class="capsulePreviewRow">'+s.ids.map(id=>'<div>'+toySVG(id,36)+'<small>'+String(id+1).padStart(2,'0')+(G.toys[id]?' · OWNED':'')+'</small></div>').join('')+'</div><p>'+owned+' / 6 figures found in this set. Your money: ¥'+G.cash.toLocaleString()+'.</p><p class="payFine">Each draw is independent. Duplicates are possible.<br>Figure chances, left to right: 24%, 23%, 20%, 18%, 10%, 5%.<br>Only money earned inside this game is used.</p>',[{text:'Insert ¥100',fn:()=>buyToy(id)},{text:'Not this time',fn:()=>{}}]);}
buyToy=function(machine=lastMachine){const s=SERIES[machine];if(!s||capsuleScene)return;if(G.cash<s.cost){talk([{n:'Jun',t:'Not enough money. I should take another shift.'}],null,{x:s.x,z:s.z});return;}
 let roll=Math.random()*100,id=s.ids[s.ids.length-1];for(const candidate of s.ids){roll-=TOYS[candidate].weight;if(roll<0){id=candidate;break;}}
 const isNew=!G.toys[id];G.cash-=s.cost;G.toys[id]=(G.toys[id]||0)+1;G.purchases++;G.pendingCapsule={id,machine,isNew,count:G.toys[id],paid:true,position:{x:player.x,z:player.z,yaw:player.yaw}};saveGame();beginCapsuleScene(G.pendingCapsule);};
const CAPSULE_DURATIONS=[1.7,2.6,3.0,1.85,2.15,3.2,Infinity,1.45];
const CAPSULE_SHOTS=['A SMALL DETOUR','THE HUNDRED-YEN COIN','TURN THE HANDLE','SOMETHING DROPPED','REACH INTO THE TRAY','TWIST. PULL.','LOOK AT IT CLOSELY','ONE MORE THING TO KEEP'];
function beginCapsuleScene(record){capsuleScene={...record,shot:0,t:0,total:0,turn:.55,manual:0,cut:true,cues:{}};collectionScene=null;setMode('capsule');sound.stopSpeech();paintCapsule();capsuleCue('cloth');}
function capsuleCue(name){if(!sound.ctx||sound.muted)return;const t=sound.ctx.currentTime;if(name==='coin'){sound.tone(1970,t,.19,.065,'sine');sound.tone(1320,t+.12,.12,.035,'triangle');sound.noise(.07,.07,3100);}else if(name==='ratchet'){sound.noise(.06,.075,2300);sound.tone(325,t,.065,.037,'square');}else if(name==='drop'){sound.noise(.10,.09,760);sound.tone(425,t,.08,.042,'triangle');sound.tone(640,t+.13,.06,.032,'sine');}else if(name==='pop'){sound.noise(.075,.12,1900);sound.tone(790,t,.085,.045,'triangle');}else if(name==='cloth')sound.noise(.35,.026,1750);else if(name==='reveal'){let id=capsuleScene?.id??0;const notes=TOYS[id].rarity==='RARE'?[69,74,78,81]:[69,76];notes.forEach((n,i)=>sound.pluck(n,t+i*.19,.085));}}
function setCapsuleShot(n){if(!capsuleScene)return;capsuleScene.shot=n;capsuleScene.t=0;capsuleScene.cut=true;capsuleScene.cues={};if(n===6){capsuleCue('reveal');sound.speak(TOYS[capsuleScene.id].line,'Jun');}if(n===7)capsuleCue('cloth');paintCapsule();}
function paintCapsule(){const cs=capsuleScene;if(!cs)return;const toy=TOYS[cs.id],s=SERIES[cs.machine],reveal=cs.shot===6;$('capsuleBrand').textContent=s.name.toUpperCase()+' / '+String(cs.id+1).padStart(3,'0');$('capsuleCash').textContent='¥ '+G.cash.toLocaleString();$('capsuleShot').textContent=CAPSULE_SHOTS[cs.shot];$('capsuleSubtitle').textContent=cs.shot===0?'Just one.':cs.shot===1?'One hundred yen.':cs.shot===2?'Come on.':cs.shot===4?'There it is.':cs.shot===5?'Let\u2019s see.':reveal?toy.line:cs.shot===7?'I will keep it.':'';
 show('capsuleItem',reveal);show('capsuleConfirm',reveal);show('capsuleInspect',reveal);show('capsuleSkip',cs.shot<6);$('capsuleRarity').textContent=(cs.isNew?'NEW TO THE COLLECTION':'ALREADY IN THE COLLECTION')+' / '+toy.rarity;$('capsuleName').textContent=toy.name;$('capsuleDescription').textContent=toy.description;$('capsuleCount').textContent=(cs.isNew?'The first one.':cs.count+' copies in your pocket.')+' '+s.ids.filter(id=>G.toys[id]).length+' of 6 in this set.';$('capsuleStatus').textContent=reveal?prompts.turn:'A SMALL MOMENT AT THE HARBOUR';[...$('capsuleSteps').children].forEach((e,i)=>e.classList.toggle('done',i<=cs.shot));}
function updateCapsule(dt){const cs=capsuleScene;if(!cs)return;cs.t+=dt;cs.total+=dt;const cues=cs.shot===1?[[.4,'cloth'],[1.78,'coin']]:cs.shot===2?[[.45,'ratchet'],[.82,'ratchet'],[1.22,'ratchet'],[1.65,'ratchet'],[2.05,'ratchet'],[2.49,'ratchet']]:cs.shot===3?[[.53,'drop'],[.95,'drop'],[1.32,'drop']]:cs.shot===4?[[.25,'ratchet'],[.75,'cloth']]:cs.shot===5?[[.61,'cloth'],[1.2,'ratchet'],[1.73,'pop']]:[];for(let i=0;i<cues.length;i++)if(cs.t>=cues[i][0]&&!cs.cues[i]){cs.cues[i]=true;capsuleCue(cues[i][1]);}
 if(cs.shot===6){if(keys.KeyA||keys.ArrowLeft){cs.turn+=dt*1.8;cs.manual=3;}else if(keys.KeyD||keys.ArrowRight){cs.turn-=dt*1.8;cs.manual=3;}cs.manual=Math.max(0,cs.manual-dt);if(!cs.manual)cs.turn+=dt*.27;}
 if(cs.t>CAPSULE_DURATIONS[cs.shot]){if(cs.shot===7)finishCapsule();else setCapsuleShot(cs.shot+1);}}
function capsuleConfirm(){if(capsuleScene?.shot===6)setCapsuleShot(7);}
function skipCapsule(){if(capsuleScene&&capsuleScene.shot<6)setCapsuleShot(6);}
function finishCapsule(){const cs=capsuleScene;if(!cs)return;const s=SERIES[cs.machine];capsuleScene=null;G.pendingCapsule=null;player.x=cs.position?.x??s.x;player.z=cs.position?.z??s.z+1.8;player.yaw=cs.position?.yaw??0;player.y=0;player.walk=0;setMode('roam');camYaw=player.yaw;camEye=[player.x+Math.sin(camYaw)*5,3.1,player.z+Math.cos(camYaw)*5];camTarget=[player.x,1.2,player.z];saveGame();openModal('One more? ',s.name.toUpperCase(),'<p>'+TOYS[cs.id].name+' is in your pocket.</p><p>Money left: <strong>¥'+G.cash.toLocaleString()+'</strong>. You have '+s.ids.filter(id=>G.toys[id]).length+' of this set\u2019s six figures.</p>',[{text:'One more — ¥100',fn:()=>buyToy(cs.machine)},{text:'That is enough for now',fn:()=>{}},{text:'Open my collection',fn:()=>openBook('pocket')}]);}
function openCollection(id,returnMode='book'){if(!G.toys[id]||!TOYS[id])return;collectionScene={id,turn:.35,zoom:1,pitch:0,manual:0,returnMode};show('bookOverlay',false);setMode('collection');paintCollection();}
function paintCollection(){const c=collectionScene;if(!c)return;const t=TOYS[c.id];$('collectionNumber').textContent='NO. '+String(c.id+1).padStart(3,'0')+' / 025';$('collectionSeries').textContent=t.series<4?SERIES[t.series].name.toUpperCase():'DRIVER AWARDS';$('collectionName').textContent=t.name;$('collectionDescription').textContent=t.description;$('collectionCount').textContent=t.rarity+' · '+G.toys[c.id]+' IN YOUR POCKET';}
function cycleCollection(dir){if(!collectionScene)return;const ids=TOYS.filter(t=>G.toys[t.id]).map(t=>t.id),at=ids.indexOf(collectionScene.id);collectionScene.id=ids[(at+dir+ids.length)%ids.length];collectionScene.turn=.35;paintCollection();sound.sfx('click');}
function closeCollection(){const c=collectionScene;if(!c)return;collectionScene=null;if(c.returnMode==='book'){setMode('book');show('bookOverlay');renderBook('pocket');}else setMode('roam');}
function collectionBackdrop(b){b.box(0,-.12,0,25,.20,25,T.concrete,'#526d6a',4);b.box(0,4,-3,25,8,.2,T.paint,'#304f51',4);for(let x of [-5,5])b.box(x,3,-2.8,.08,6,.12,T.white,'#4b6968');}
function purchaseSet(b,cs){collectionBackdrop(b);b.box(0,1.9,-.61,9,4,.22,T.brick,'#9a9278',2);b.plane(-2.8,1.8,-.477,2.9,1.8,T.windows);b.plane(2.75,2.0,-.477,2.8,1.1,T['series'+cs.machine]);b.box(-2.8,.84,-.37,3.2,.13,.25,T.wood,'#aaa078');b.box(1.6,.14,0,.5,.28,.72,T.paint,'#8c977b');const turn=cs.shot===2?ease(clamp((cs.t-.25)/2.35,0,1))*PI:cs.shot>2?PI:0;const flap=cs.shot===4?Math.sin(clamp(cs.t/2.15,0,1)*PI):cs.shot===3?.3:0;capsuleMachineMesh(b,{...SERIES[cs.machine],x:0,z:0},cs.t,turn,flap);return turn;}
function ease(t){return t*t*(3-2*t);}
function buildCollectionScene(b,em){
 if(em==='collection'){const c=collectionScene;if(!c)return b.a;collectionBackdrop(b);b.cylinder(.55,.035,0,1.05,1.05,.10,T.paint,'#b2b097',48);b.cylinder(.55,.093,0,.98,.98,.025,T.white,'#5b7067',48);drawToy(b,c.id,.55,.115,0,1.3,c.turn);return b.a;}
 const cs=capsuleScene;if(!cs)return b.a;const shot=cs.shot,p=clamp(cs.t/(CAPSULE_DURATIONS[shot]||1),0,1),col=SERIES[cs.machine].color;
 if(shot<5||shot===7){const turn=purchaseSet(b,cs);if(shot===0||shot===7){character(b,{...player,x:-.67,z:1.52,yaw:.12,y:0,walk:0},worldTime,{rightArm:shot===0?.55:.3});if(shot===0)coinMesh(b,-.39,1.08,1.19,.4);if(shot===7&&p<.65)drawToy(b,cs.id,-.37,1.13-p*.15,1.27+p*.12,.22,.6);}
 if(shot===1){const t=ease(clamp((cs.t-.35)/1.6,0,1)),x=mix(.57,.277,t),z=mix(1.12,.548,t);handMesh(b,x,.932,z+.015,.59,.56,-.14,0);if(cs.t<1.87)coinMesh(b,x,1.153,z-.018,mix(-.35,0,t),ease(clamp((t-.45)/.4,0,1))*PI/2);}
 if(shot===2){b.push(.2,.83,.60).rotateZ(-turn);handMesh(b,0,-.11,.035,.64,.93,.08,.10);b.pop();}
 if(shot===3){const t=clamp((cs.t-.30)/.75,0,1),y=t<1?mix(.93,.385,t*t):.385+Math.abs(Math.sin((cs.t-1.05)*16))*Math.max(0,1.5-cs.t)*.16;capsuleBall(b,-.19,y,.62,.121,col);}
 if(shot===4){const t=ease(clamp((cs.t-.35)/1.55,0,1)),x=mix(-.19,0,t),y=mix(.385,1.24,t),z=mix(.62,1.37,t);capsuleBall(b,x,y,z,.121,col);handMesh(b,x-.03,y-.155,z+.04,.66,.66,0,.2);}
 }else{collectionBackdrop(b);b.box(0,2.2,-1.4,10,4.5,.18,T.brick,'#8a8b78',3);character(b,{...player,x:0,z:-.38,yaw:PI,y:0,walk:0},0,{hideArms:true});
 if(shot===5){const opening=ease(clamp((cs.t-1.50)/1.25,0,1))*.30;capsuleBall(b,0,1.23,.23,.125,col,opening,Math.sin(cs.t*6)*.12*(1-p));coatArm(b,[-.32,1.44,-.38],[-.44,1.0,-.01],[-.10,1.06-opening*.35,.24]);coatArm(b,[.32,1.44,-.38],[.53,1.55,.01],[.13+opening*.4,1.56+opening*.9,.24]);openPalm(b,-.015,1.095-opening*.35,.27,-1);handMesh(b,.13+opening*.4,1.405+opening*.9,.245,.67,.6,PI,-.15);if(opening>.035)drawToy(b,cs.id,.018,1.19-opening*.35,.245,.225,.5);}
 if(shot===6){coatArm(b,[.32,1.44,-.38],[.43,1.12,-.03],[.15,1.13,.23]);coatArm(b,[-.32,1.44,-.38],[-.51,.98,-.04],[-.35,1.02,.32]);openPalm(b,.065,1.16,.245,1);drawToy(b,cs.id,.065,1.202,.245,.255,cs.turn);openPalm(b,-.26,1.045,.35,-1);capsuleBall(b,-.24,1.15,.34,.09,col,.035);}
 }
 return b.a;
}
function cinematicCamera(em){const mobile=innerWidth<650;if(em==='collection'){const c=collectionScene||{zoom:1};return {eye:mobile?[2.0*c.zoom,1.8*c.zoom,4.5*c.zoom]:[2.1*c.zoom,1.7*c.zoom,4.6*c.zoom],target:mobile?[.50,1.22,0]:[-.37,.82,0],fov:mobile?43:39};}
 const cs=capsuleScene||{shot:0,t:0},s=cs.shot,t=cs.t;const shots=[
 {eye:[-2.1,1.90,3.5],target:[-.02,1.12,.35],fov:45},
 {eye:[.70,1.31,1.48],target:[.27,1.09,.51],fov:43},
 {eye:[.66,1.01,1.56],target:[.19,.80,.53],fov:42},
 {eye:[-.68,.68,1.47],target:[-.15,.48,.51],fov:43},
 {eye:[-.65,1.50,2.70],target:[-.02,mix(.75,1.20,ease(clamp(t/2.15,0,1))),1.04],fov:39},
 {eye:[.43,1.56,1.52],target:[.01,1.29,.22],fov:42},
 {eye:mobile?[.34,1.44,1.13]:[.42,1.43,1.13],target:mobile?[.06,1.31,.23]:[.03,1.25,.23],fov:mobile?48:36},
 {eye:[-1.95,1.77,3.70],target:[-.27,1.18,.53],fov:44}
 ];return shots[s];}

/* World use, route finding, records, and input. */
const originalGetInteractions=getInteractions;
getInteractions=function(){const arr=originalGetInteractions();const old=arr.find(a=>a.id==='capsule');if(old){old.kind='machine';old.series=0;old.name=SERIES[0].name;}for(const s of SERIES.slice(1))arr.push({id:'capsule'+s.id,x:s.x,z:s.z+1.25,kind:'machine',series:s.id,name:s.name,verb:'CAPSULE TOYS · ¥100',r:2.0});for(const [i,x,z] of [[0,-8,6.1],[1,39,-51.8],[2,54,21.1]])arr.push({id:'dispatch'+i,x,z,kind:'work',name:'Harbour shift board',verb:G.work?'YOUR CURRENT SHIFT':'FORKLIFT WORK',r:2.4});return arr;};
const originalInteract=interact;
interact=function(){if(mode==='roam'&&interactable?.kind==='machine'){inspectMachine(interactable.series);return;}if(mode==='roam'&&interactable?.kind==='work'){showWorkBoard();return;}originalInteract();};
const originalChoosePerson=choosePerson;
choosePerson=function(a){if(a.id==='daichi'&&G.stage===2&&G.work&&!G.work.tutorial){talk([{n:'Daichi',t:'Finish your current load sheet first. Then we can deal with the three Kita crates.'}],null,a);return;}if(a.id==='sumi'){talk([{n:'Sumi',t:'Six load sheets. Pick a route that suits you. Your pay depends on how the cargo arrives.'}],null,a,[{text:'Show me the shift board.',fn:()=>showWorkBoard()},{text:'Where are the new bays?',fn:()=>talk([{n:'Sumi',t:'Bay 06 is in the north yard. Bay 09 is cold storage. Bay 12 serves the ferry. Bay 14 is beside the rail tracks.'},{n:'Sumi',t:'The small market store is bay 16. Read the number on the case.'}],null,a)},{text:'Thank you.',fn:()=>{}}]);return;}
 if(a.id==='natsumi'){talk([{n:'Natsumi',t:'You collect the little figures too? I keep finding the same van.'},{n:'Jun',t:'There are four machines now.'},{n:'Natsumi',t:'Bring me three spare figures. I will trade for one you do not have.'}],null,a,[{text:'Trade duplicate figures.',fn:()=>tradeDuplicates()},{text:'Where are the machines?',fn:()=>talk([{n:'Natsumi',t:'One at the tea shop. One at north dispatch. This one at the market. The last one is at the ferry terminal.'}],null,a)},{text:'I will check my pocket.',fn:()=>openBook('pocket')},{text:'See you.',fn:()=>{}}]);return;}
 if(a.id==='ferryclerk'){talk([{n:'Ishida',t:'Passenger tickets at the window. Ship stores go to bay 12. Not through the waiting room.'},{n:'Jun',t:'I see.'},{n:'Ishida',t:'The toy machine is beside the kiosk. Please collect the empty capsule.'}],null,a);return;}
 if(a.id==='coldhand'){talk([{n:'Toru',t:'Cold cases go to 09. A sudden turn can ruin the load.'},{n:'Toru',t:'Keep the forks low. Give the truck room to turn. That goes for the fish too.'}],null,a);return;}
 if(a.id==='northwalker'){talk([{n:'Yasuo',t:'Take the circuit when you need a break. Two laps around the north yard.'},{n:'Yasuo',t:'A finish under three minutes earns a gold forklift. A small one, of course.'}],null,a);return;}
 if(a.id==='daichi'&&G.work){talk([{n:'Daichi',t:'Your load sheet is still open. The truck is where you left it.'}],null,a,[{text:'Get back to work.',fn:()=>enterForklift()},{text:'Read my load sheet.',fn:()=>workManifest()},{text:'Take a short break.',fn:()=>{}}]);return;}
 if(a.id==='daichi'&&G.stage>=4){talk([{n:'Daichi',t:'There is always another shipment. You know the truck now.'}],null,a,[{text:'Find another shift.',fn:()=>showWorkBoard()},{text:'What about the ledger?',fn:()=>talk([{n:'Daichi',t:leads[G.stage][1]}],null,a)},{text:'Try the forklift circuit.',fn:()=>startCircuit()},{text:'I will come back.',fn:()=>{}}]);return;}
 originalChoosePerson(a);};
function duplicateCount(){return Object.entries(G.toys).filter(([id])=>Number(id)<24).reduce((sum,[id,n])=>sum+Math.max(0,n-1),0);}
function tradeDuplicates(){const dup=duplicateCount(),missing=TOYS.filter(t=>t.id<24&&!G.toys[t.id]);if(dup<3){talk([{n:'Natsumi',t:'You have '+dup+' spare figures. I need three. Keep one copy of each for yourself.'}],null,npc('natsumi'));return;}if(!missing.length){talk([{n:'Natsumi',t:'You have the full set. All four sets, in fact. Keep those spares.'}],null,npc('natsumi'));return;}
 openModal('A fair exchange.','NATSUMI / THREE SPARES FOR ONE FIGURE','<p>Choose one missing figure. You keep at least one copy of every figure you already own.</p><div class="toyGrid expanded">'+missing.map(t=>'<button class="toy" data-trade="'+t.id+'"><div class="toyArt">'+toySVG(t.id,40)+'</div><span>'+t.name+'</span></button>').join('')+'</div>',[{text:'Keep my spare figures',fn:()=>{}}]);
 document.querySelectorAll('[data-trade]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.trade);if(duplicateCount()<3||G.toys[id])return;let count=3;for(let i=0;i<24&&count;i++){const take=Math.min(Math.max(0,(G.toys[i]||0)-1),count);if(take){G.toys[i]-=take;count-=take;}}G.toys[id]=1;G.trades++;show('modal',false);modalState=null;setMode('roam');saveGame();sound.sfx('success');openCollection(id,'roam');});}
const originalCurrentGoal=currentGoal;
currentGoal=function(){if(G.work?.race){const [x,z]=CIRCUIT[G.work.checkpoint%CIRCUIT.length];return{x,z,y:3.9,name:'Gate '+((G.work.checkpoint%CIRCUIT.length)+1)};}if(G.work){if(mode==='forklift'||effectiveMode()==='forklift'){if(forklift.carry!==null){const c=crates[forklift.carry],b=BAYS[c.bay];return{x:b.x,z:b.z,y:2.2,name:'Bay '+b.number+' / '+b.name};}const c=crates.filter(v=>!v.delivered).sort((a,b)=>dist(a,forklift)-dist(b,forklift))[0];return c?{x:c.x,z:c.z,y:2.2,name:'Load '+(c.id+1)+' → '+BAYS[c.bay].number}:null;}return{x:forklift.x,z:forklift.z,y:3.1,name:'Your forklift'};}if(G.routeTarget)return G.routeTarget;return originalCurrentGoal();};
const originalUpdateInteract=updateInteract;
updateInteract=function(){originalUpdateInteract();if(mode==='forklift'){if(G.work?.race||forklift.operation){show('interaction',false);return;}const c=bestCrate(),load=forklift.carry!==null?crates[forklift.carry]:null;show('interaction',!!(c||load));if(load){const b=bayAt(frontOfFork());$('interactVerb').textContent=b&&b.id!==load.bay?'WRONG BAY · KEEP THE LOAD':'STOP · '+prompts.use+' TO LOWER';$('interactName').textContent=b?(b.id===load.bay?'Deliver to bay '+b.number:'Needs bay '+BAYS[load.bay].number):'Set down the pallet';}else if(c){$('interactVerb').textContent='STOP · '+prompts.use+' TO LOAD';$('interactName').textContent='Load '+(c.id+1)+' → bay '+BAYS[c.bay].number;}}};
function regionAt(x,z){if(x>84&&z<-93)return{id:'cold',name:'Cold Storage District'};if(x>34&&z<-110)return{id:'ferry',name:'Nagamatsu Ferry Terminal'};if(x>85&&z<-40)return{id:'rail',name:'Rail Freight Yard'};if(x>36&&z>-40)return{id:'market',name:'Nagamatsu Market'};if(z<-42)return{id:'north',name:'North Container Yard'};if(z<-22)return{id:'old',name:'Old Warehouse District'};if(x<-16&&z>15)return{id:'tea',name:'Breakwater Tea'};return{id:'quay',name:'Nagamatsu Harbour'};}
const originalUpdateHUD=updateHUD;
updateHUD=function(){originalUpdateHUD();if(!G?.workStats)return;hudText('locationName',regionAt(player.x,player.z).name);
 if(G.work){hudText('leadNumber','OPEN LOAD SHEET');hudText('objective',G.work.race?'Drive two laps through the marked gates.':G.work.name+' · '+crates.filter(c=>c.delivered).length+' / '+crates.length+' loads delivered.');}else if(G.routeTarget){hudText('leadNumber','MARKED ON MY MAP');hudText('objective',G.routeTarget.name);}
 if(mode==='forklift'){const w=G.work,load=forklift.carry!==null?crates[forklift.carry]:null;if(!w)return;const done=crates.filter(c=>c.delivered).length;$('taskHUD').querySelector('.eyebrow').textContent=w.tag||w.name.toUpperCase();hudText('taskTitle',w.race?'LAP '+Math.min(2,Math.floor(w.checkpoint/CIRCUIT.length)+1)+' / 2 · '+formatDuration(w.seconds):done+' / '+crates.length+' loads delivered');hudText('taskHint',w.race?'Gate '+((w.checkpoint%CIRCUIT.length)+1)+' / 10 · under 3:00 earns the gold figure':forklift.operation?(forklift.operation.kind==='pickup'?'The forks are lifting the pallet…':'Lowering the load…'):load?'DELIVER TO '+BAYS[load.bay].number+' · '+BAYS[load.bay].name.toUpperCase():'Follow the route to your next marked pallet.');
 const total=w.race?10:crates.length,filled=w.race?w.checkpoint%10:done;if($('deliveryPips').children.length!==total)$('deliveryPips').innerHTML='<i></i>'.repeat(total);[...$('deliveryPips').children].forEach((el,i)=>el.classList.toggle('done',i<filled));hudText('speedValue',(Math.abs(forklift.speed)*3.6).toFixed(1));hudText('workGear',(forklift.speed>.1?'D':forklift.speed<-.1?'R':'N')+' · '+(keys.Space?'BRAKE':forklift.lift>.95?'HIGH LOAD':'LOW FORKS'));hudText('cargoName',load?CARGO_TYPES[load.type].name:'No cargo on the forks');hudText('cargoDetail',load?'Bay '+BAYS[load.bay].number+' · '+Math.round(load.integrity)+'% condition · '+forklift.lift.toFixed(1)+' m lift':w.race?'Reference lap: 1:30 · R recovery: +8 sec':'Shift '+formatDuration(w.seconds)+' · target '+formatDuration(w.target));$('cargoHealth').firstElementChild.style.width=(load?load.integrity:100)+'%';}
};
let navGrid=null;
function makeNavGrid(){const step=2.4,nx=Math.ceil((WORLD.maxX-WORLD.minX)/step)+1,nz=Math.ceil((WORLD.maxZ-WORLD.minZ)/step)+1,blocked=new Uint8Array(nx*nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)blocked[j*nx+i]=collides(WORLD.minX+i*step,WORLD.minZ+j*step,1.1,false)?1:0;navGrid={step,nx,nz,blocked};}
function findRoute(start,end){if(!navGrid)makeNavGrid();const {step,nx,nz,blocked}=navGrid,toCell=p=>[clamp(Math.round((p.x-WORLD.minX)/step),0,nx-1),clamp(Math.round((p.z-WORLD.minZ)/step),0,nz-1)],near=p=>{const [x,z]=toCell(p);if(!blocked[z*nx+x])return z*nx+x;for(let r=1;r<5;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,zz=z+dz;if(xx>=0&&xx<nx&&zz>=0&&zz<nz&&!blocked[zz*nx+xx])return zz*nx+xx;}return -1;};const a=near(start),goal=near(end);if(a<0||goal<0)return[];const cost=new Float32Array(nx*nz).fill(Infinity),parent=new Int32Array(nx*nz).fill(-1),closed=new Uint8Array(nx*nz),heap=[];let order=0;
 const push=(id,score)=>{heap.push({id,score});let i=heap.length-1;while(i>0){let p=(i-1)>>1;if(heap[p].score<=score)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let l=i*2+1,r=l+1,k=i;if(l<heap.length&&heap[l].score<heap[k].score)k=l;if(r<heap.length&&heap[r].score<heap[k].score)k=r;if(k===i)break;[heap[i],heap[k]]=[heap[k],heap[i]];i=k;}}return first.id;};
 cost[a]=0;push(a,0);let found=false;while(heap.length&&order++<12000){const c=pop();if(closed[c])continue;if(c===goal){found=true;break;}closed[c]=1;const x=c%nx,z=Math.floor(c/nx);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const id=zz*nx+xx;if(blocked[id]||closed[id]||(dx&&dz&&(blocked[z*nx+xx]||blocked[zz*nx+x])))continue;const n=cost[c]+(dx&&dz?1.4142:1);if(n<cost[id]){cost[id]=n;parent[id]=c;push(id,n+Math.hypot(xx-goal%nx,zz-Math.floor(goal/nx)));}}}
 if(!found)return[];const path=[];let c=goal;while(c!==a&&c>=0){path.push({x:WORLD.minX+(c%nx)*step,z:WORLD.minZ+Math.floor(c/nx)*step});c=parent[c];}path.push({x:start.x,z:start.z});path.reverse();path.push({x:end.x,z:end.z});return path;
}
function mapProjection(w,h){const scale=Math.min((w-30)/161,(h-27)/190),left=(w-161*scale)/2,top=(h-190*scale)/2;return {sx:x=>left+(x+39)*scale,sz:z=>top+(z+148)*scale,scale};}
function paintHarbourMap(c,w,h,mini=false){const {sx,sz,scale}=mapProjection(w,h),rect=(x,z,ww,dd,col)=>{c.fillStyle=col;c.fillRect(sx(x-ww/2),sz(z-dd/2),ww*scale,dd*scale);};c.clearRect(0,0,w,h);c.fillStyle=mini?'#294b4e':'#afc2b4';c.fillRect(0,0,w,h);rect(42,-54,150,182,mini?'#526c61':'#d8d4b7');const roads=mini?'#789080':'#c1c5a8';for(const a of [[1,-2,24,76],[1,-93,23,104],[55,-48,111,15],[50,-99,96,15],[79,-74,16,130],[51,-16,16,66],[79,23,66,13]])rect(...a,roads);
 for(let x=-20;x<117;x+=20){c.strokeStyle=mini?'#9aab8c10':'#576d5010';c.beginPath();c.moveTo(sx(x),sz(-144));c.lineTo(sx(x),sz(37));c.stroke();}for(let z=-140;z<38;z+=20){c.beginPath();c.moveTo(sx(-33),sz(z));c.lineTo(sx(117),sz(z));c.stroke();}
 for(const o of obstacles.filter(o=>['warehouse','tea','container','guard','cargo'].includes(o.id)))rect(o.x,o.z,Math.max(.5,o.w),Math.max(.5,o.d),mini?'#334f49':'#8ba18c');for(const a of [[25,24,18,20,'01'],[25,0,18,22,'03'],[25,-28,18,24,'08'],[20,-128,28,22,'06'],[100,-127,26,24,'09'],[102,-76,26,20,'14'],[63,-6,18,18,'16'],[52,-138,29,10,'12']]){rect(a[0],a[1],a[2],a[3],mini?'#3a5850':'#91a38d');c.fillStyle=mini?'#d5d5b6':'#35574f';c.font=(mini?'bold 11px':'bold 15px')+' Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(a[4],sx(a[0]),sz(a[1]));}
 for(const b of Object.values(BAYS)){rect(b.x,b.z,b.w,b.d,mini?'#b4a578':'#baa779');}
 if(mini&&options.guides&&navRoute.length){c.strokeStyle='#ead095';c.lineWidth=2.8;c.setLineDash([5,4]);c.beginPath();navRoute.forEach((p,i)=>i?c.lineTo(sx(p.x),sz(p.z)):c.moveTo(sx(p.x),sz(p.z)));c.stroke();c.setLineDash([]);}
 for(const s of SERIES){c.fillStyle=mini?'#dfa984':'#a85e42';c.beginPath();c.arc(sx(s.x),sz(s.z),mini?3.8:4.3,0,TAU);c.fill();c.strokeStyle=mini?'#eee0b9':'#f6edcf';c.lineWidth=1;c.stroke();}
 if(G.work&&!G.work.race)for(const box of crates)if(!box.delivered&&box.id!==forklift.carry){c.fillStyle='#f1e8c8';c.fillRect(sx(box.x)-2.4,sz(box.z)-2.4,4.8,4.8);}
 const target=currentGoal();if(target){c.save();c.translate(sx(target.x),sz(target.z));c.rotate(PI/4);c.fillStyle=mini?'#e8cc83':'#9c763d';c.fillRect(-4,-4,8,8);c.strokeStyle=mini?'#fff1c1':'#f5edcf';c.lineWidth=1;c.strokeRect(-4,-4,8,8);c.restore();}
 c.save();c.translate(sx(player.x),sz(player.z));c.rotate(-player.yaw);c.fillStyle=mini?'#fff0b7':'#a24f3b';c.strokeStyle=mini?'#3e5147':'#ede2c3';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-7);c.lineTo(5,5);c.lineTo(0,2);c.lineTo(-5,5);c.closePath();c.fill();c.stroke();c.restore();c.textAlign='left';c.font='10px Arial';c.fillStyle=mini?'#d6d2ac':'#58705a';c.fillText('N ↑',w-35,17);if(!mini){c.save();c.translate(sx(-37),sz(-53));c.rotate(-PI/2);c.textAlign='center';c.font='11px Georgia';c.fillText('NAGAMATSU BAY',0,0);c.restore();}c.strokeStyle=mini?'#ddd0a044':'#63775977';c.lineWidth=1;c.strokeRect(3,3,w-6,h-6);return{sx,sz};}
drawMap=function(){const el=$('mapCanvas');if(el)paintHarbourMap(el.getContext('2d'),el.width,el.height,false);};
function drawWorkMap(){if(mode!=='forklift'||worldTime-workMapTick<.18)return;workMapTick=worldTime;const goal=currentGoal();if(goal&&options.guides){const stamp=Math.round(forklift.x/5)+','+Math.round(forklift.z/5)+'>'+goal.x+','+goal.z;if(stamp!==navStamp&&worldTime-navTick>.6){navStamp=stamp;navTick=worldTime;navRoute=findRoute(forklift,goal);}}else navRoute=[];paintHarbourMap($('workMini').getContext('2d'),384,374,true);$('workNavLabel').textContent=goal?goal.name.toUpperCase()+' · '+Math.round(dist(forklift,goal))+' M':'NORTH ↑ / HARBOUR ROUTES';}
const originalRenderBook=renderBook;
renderBook=function(tab){if(!['pocket','map','work'].includes(tab)){originalRenderBook(tab);if(tab==='controls')$('bookBody').insertAdjacentHTML('beforeend','<h4 style="margin-top:28px">Harbour Days / more controls</h4><p>Forklift: Q raises the forks. Z lowers them. C changes the camera. H sounds the horn. J opens the load sheet. E loads or unloads.</p><p>Capsule scene: Space skips to the figure. A and D turn it. E puts it in your pocket. You can also drag the figure or use the on-screen buttons.</p>');return;}currentTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));let h='';
 if(tab==='pocket'){const count=TOYS.filter(t=>G.toys[t.id]).length;const group=s=>'<section class="collectionSeries"><h4>'+s.name+' <span>'+s.ids.filter(id=>G.toys[id]).length+' / 6</span></h4><div class="toyGrid expanded">'+s.ids.map(id=>'<button class="toy '+(!G.toys[id]?'missing':'')+'" data-toy="'+id+'" '+(!G.toys[id]?'disabled':'')+'><div class="toyArt">'+toySVG(id,44)+'</div><span>'+(G.toys[id]?TOYS[id].name+'<br>×'+G.toys[id]:'No. '+String(id+1).padStart(3,'0'))+'</span></button>').join('')+'</div></section>';
 h='<div class="bookColumns"><div><h4>Things worth keeping</h4><h3>In my pocket.</h3><p><strong>¥ '+G.cash.toLocaleString()+'</strong> · '+duplicateCount()+' spare figures<br>'+count+' / 25 figures · '+G.purchases+' capsules opened</p><p>Father\u2019s letter'+(G.stage>=4?'<br>Kita cargo record':'')+(G.stage>=6?'<br>Stamped cargo pass':'')+(G.stage>=7?'<br>The red ledger and ferry ticket':'')+(G.hasBun?'<br>A warm fish bun':'')+'</p></div><div><h4>Four sets. One shelf.</h4><h3>The small things.</h3><p>Select an owned figure to inspect its 3D model. Drag to turn it. Use the wheel to zoom.</p><p>Natsumi at the market trades three spare figures for one missing figure. The golden forklift is a circuit award.</p></div></div><div class="bookColumns"><div>'+group(SERIES[0])+group(SERIES[2])+'</div><div>'+group(SERIES[1])+group(SERIES[3])+'</div></div><section class="collectionSeries"><h4>Driver awards</h4><button class="toy tinyButton" data-toy="24" '+(!G.toys[24]?'disabled':'')+'>'+toySVG(24,38)+' '+(G.toys[24]?'Golden No. 05 · inspect':'Golden No. 05 · finish the circuit under 3:00')+'</button></section>';
 }else if(tab==='map'){h='<div class="bookColumns"><div><h4>Nagamatsu / the full harbour</h4><canvas id="mapCanvas" width="460" height="520" aria-label="Expanded harbour map"></canvas><div class="mapLegend">▲ YOU · ◇ YOUR NEXT STOP · ○ CAPSULE MACHINE</div></div><div><h4>A longer afternoon</h4><h3>Six delivery bays.</h3><ul class="routeList">'+Object.values(BAYS).map(b=>'<li><b>'+b.number+'</b>'+b.name+'</li>').join('')+'</ul><p>The north gate is open. Go north past Warehouse 08, then turn east to reach the rest of the harbour.</p><h4>Mark a capsule machine</h4>'+SERIES.map(s=>'<p style="margin:9px 0"><button class="tinyButton" data-mark="'+s.id+'">'+s.name.toUpperCase()+' →</button><br><small>'+s.location+'</small></p>').join('')+'<button id="clearMapMark" class="tinyButton">FOLLOW THE STORY AGAIN</button></div></div>';
 }else{h='<div class="bookColumns"><div><h4>Nagamatsu / driver record</h4><h3>'+driverTitle().toLowerCase().replace(/^./,a=>a.toUpperCase())+'.</h3>'+[['Shifts complete',G.workStats.shifts],['Loads delivered',G.workStats.delivered],['Total work pay','¥'+G.workStats.earnings.toLocaleString()],['Circuit runs',G.workStats.races],['Best circuit',G.workStats.raceBest?formatDuration(G.workStats.raceBest):'Not set']].map(a=>'<div class="workRecord"><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('')+'<p>Two finished shifts earn each new driver grade. Higher grades open longer routes.</p><h4>Today\u2019s load sheet</h4><p>'+(G.work?G.work.name+'<br>'+formatDuration(G.work.seconds)+' elapsed. Your truck and cargo remain in the yard.':'No active shift. Read a work board near Daichi, north dispatch, or the market.')+'</p></div><div><h4>Best times</h4><h3>Know the route.</h3>'+JOBS.map(j=>'<div class="workRecord"><span>'+j.name+'</span><b>'+(G.workStats.bests[j.id]?formatDuration(G.workStats.bests[j.id]):'—')+'</b></div>').join('')+'<h4 style="margin-top:22px">Yard sparring</h4>'+[['Sparring wins',G.sparStats?.wins||0],['Best three rounds',G.sparStats?.best?formatDuration(G.sparStats.best):'—']].map(r=>'<div class="workRecord"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('')+'<p>Time pauses while a menu is open. Time targets add a bonus. They do not stop you from finishing.</p><p>Keep the forks low. Stop before you load. The case number must match the bay number.</p></div></div>';}
 $('bookBody').innerHTML=h;$('bookBody').scrollTop=0;$('bookFooterText').textContent=tab==='pocket'?'EVERY LITTLE FIGURE HAS ITS PLACE.':tab==='work'?'READ THE LABEL. TAKE YOUR TIME.':'THE NORTH GATE IS OPEN.';
 if(tab==='pocket')document.querySelectorAll('[data-toy]').forEach(el=>el.onclick=()=>openCollection(Number(el.dataset.toy),'book'));if(tab==='map'){drawMap();document.querySelectorAll('[data-mark]').forEach(el=>el.onclick=()=>{const s=SERIES[Number(el.dataset.mark)];G.routeTarget={x:s.x,z:s.z+1.5,y:2.3,name:s.name+' / '+s.location};closeBook();updateHUD();toast('MARKED ON YOUR MAP',s.name,s.location);});$('clearMapMark').onclick=()=>{delete G.routeTarget;closeBook();updateHUD();};}
};
function extraWorldDynamics(b){for(let f of ambientTrucks)if(dist(f,player)<72&&mode!=='title'){b.lod=lodAt(f.x,f.z);forkliftMesh(b,f,worldTime,{...player,hero:false,coat:'#658884',pants:'#445f63',cap:'#bba574'});}b.lod=1;
 if(G.work?.race){const w=G.work,target=CIRCUIT[w.checkpoint%CIRCUIT.length],prev=CIRCUIT[(w.checkpoint+CIRCUIT.length-1)%CIRCUIT.length],dx=target[0]-prev[0],dz=target[1]-prev[1],len=Math.hypot(dx,dz)||1,rx=-dz/len,rz=dx/len;for(const side of [-1,1]){const x=target[0]+rx*4.8*side,z=target[1]+rz*4.8*side;b.box(x,1.6,z,.15,3.2,.15,T.paint,'#d2b475');b.cylinder(x,.18,z,.36,.13,.36,T.paint,'#b77845',8);}b.beam([target[0]-rx*4.8,3.6,target[1]-rz*4.8],[target[0]+rx*4.8,3.6,target[1]+rz*4.8],.12,T.white,'#dfc688');
 let lengths=CIRCUIT.map((p,i)=>Math.hypot(p[0]-CIRCUIT[(i+1)%10][0],p[1]-CIRCUIT[(i+1)%10][1])),total=lengths.reduce((a,b)=>a+b,0),travel=(w.seconds/90*total)%total,index=0;while(travel>lengths[index]&&index<9){travel-=lengths[index++];}const p=CIRCUIT[index],q=CIRCUIT[(index+1)%10],t=travel/lengths[index],rival={x:mix(p[0],q[0],t)+1.65,z:mix(p[1],q[1],t),yaw:Math.atan2(p[0]-q[0],p[1]-q[1]),carry:null,lift:.15,paint:'#6e9d9c'};if(dist(rival,player)<85){b.lod=lodAt(rival.x,rival.z);forkliftMesh(b,rival,worldTime,{...player,hero:false,coat:'#648c82',pants:'#485c61',cap:'#bdc5ac'});b.lod=1;}
 }else if(G.work&&forklift.carry!==null){const bay=BAYS[crates[forklift.carry].bay],pulse=1+Math.sin(worldTime*3)*.035;for(let side of [-1,1]){b.box(bay.x+side*bay.w/2,.055,bay.z,.10,.03,bay.d,T.white,'#e6d29a',0,1);b.box(bay.x,.055,bay.z+side*bay.d/2,bay.w,.03,.10,T.white,'#e6d29a',0,1);}b.plane(bay.x,2.6+Math.sin(worldTime*2)*.12,bay.z,1.15*pulse,1.15*pulse,T[bay.tx],'#e9dfb8',camYaw,1);}
}
const originalUpdateCamera=updateCamera;
updateCamera=function(dt){const em=effectiveMode();if(['capsule','collection'].includes(em)){const shot=cinematicCamera(em),cut=capsuleScene?.cut;renderer&&(renderer.fov=shot.fov);const amount=cut||em==='collection'?1:Math.min(1,dt*9);camEye=camEye.map((v,i)=>mix(v,shot.eye[i],amount));camTarget=camTarget.map((v,i)=>mix(v,shot.target[i],amount));if(capsuleScene)capsuleScene.cut=false;return;}
 if(renderer)renderer.fov=53;if(em==='forklift'&&forkCamera===1){const f=forklift,fx=-Math.sin(f.yaw),fz=-Math.cos(f.yaw),right=[Math.cos(f.yaw),-Math.sin(f.yaw)];camEye=[f.x+fx*.50+right[0]*.20,2.26,f.z+fz*.50+right[1]*.20];camTarget=[f.x+fx*9,1.25,f.z+fz*9];if(renderer)renderer.fov=66;return;}originalUpdateCamera(dt);};
const originalOnPress=onPress;
onPress=function(code){if(mode==='workboard'){if(['Escape','KeyN'].includes(code))closeWorkBoard();return;}if(mode==='capsule'){if(['Space','Escape'].includes(code)&&capsuleScene?.shot<6)skipCapsule();else if(['KeyE','Enter','Escape'].includes(code))capsuleConfirm();else if(code==='KeyJ'){capsuleScene.turn+=.5;capsuleScene.manual=4;}else if(code==='KeyK'){capsuleScene.turn-=.5;capsuleScene.manual=4;}else if(code==='KeyP')pauseGame();else if(code==='KeyM'||code==='KeyF')originalOnPress(code);return;}
 if(mode==='collection'){if(['Escape','KeyN','Enter'].includes(code))closeCollection();else if(code==='ArrowLeft'||code==='KeyJ')cycleCollection(-1);else if(code==='ArrowRight'||code==='KeyK')cycleCollection(1);else if(code==='KeyM'||code==='KeyF')originalOnPress(code);return;}
 if(mode==='forklift'){if(code==='KeyC'){forkCamera=(forkCamera+1)%2;camManual=0;return;}if(code==='KeyH'){if(worldTime-lastHorn>.4&&sound.ctx){lastHorn=worldTime;const t=sound.ctx.currentTime;sound.tone(190,t,.42,.08,'sawtooth');sound.tone(285,t,.38,.035,'sawtooth');}return;}if(code==='KeyJ'){workManifest();return;}if(code==='KeyX'&&G.work?.race){workManifest();return;}}
 originalOnPress(code);};
const originalUpdate=update;
update=function(dt){const active=['roam','forklift'].includes(mode);if(active&&G.work)G.work.seconds=(G.work.seconds||0)+dt;
 if(mode==='capsule')updateCapsule(dt);if(mode==='collection'&&collectionScene){const c=collectionScene;const spin=(keys.KeyA?1:0)-(keys.KeyD?1:0);if(spin){c.turn+=spin*dt*1.7;c.manual=3;}c.manual=Math.max(0,c.manual-dt);if(!c.manual)c.turn+=dt*.23;}
 if(active){for(const f of ambientTrucks){const p=f.path[f.wp],dx=p[0]-f.x,dz=p[1]-f.z,d=Math.hypot(dx,dz);if(d<.6){f.wp=(f.wp+1)%f.path.length;continue;}if(dist(f,player)<5.0)continue;const x=f.x+dx/d*dt*f.speed,z=f.z+dz/d*dt*f.speed;if(!collides(x,z,1.05)){f.x=x;f.z=z;f.yaw+=angdiff(f.yaw,Math.atan2(-dx,-dz))*Math.min(1,dt*2.4);}else f.wp=(f.wp+1)%f.path.length;}
 const region=regionAt(player.x,player.z);if(!G.visited.includes(region.id)){G.visited.push(region.id);if(mode==='roam'){$('areaCard').querySelector('h2').textContent=region.name;$('areaCard').classList.add('show');areaUntil=worldTime+2.5;}}if(G.routeTarget&&dist(player,G.routeTarget)<2.4){delete G.routeTarget;updateHUD();}}
 originalUpdate(dt);
};
function bindExpansion(){
 $('workClose').onclick=closeWorkBoard;$('workLeave').onclick=closeWorkBoard;$('workResume').onclick=()=>{setMode('roam');enterForklift();};$('workRace').onclick=startCircuit;
 $('capsuleConfirm').onclick=capsuleConfirm;$('capsuleSkip').onclick=skipCapsule;$('capsuleLeft').onclick=()=>{if(capsuleScene){capsuleScene.turn+=.55;capsuleScene.manual=4;}};$('capsuleRight').onclick=()=>{if(capsuleScene){capsuleScene.turn-=.55;capsuleScene.manual=4;}};
 $('collectionBack').onclick=closeCollection;$('collectionPrev').onclick=()=>cycleCollection(-1);$('collectionNext').onclick=()=>cycleCollection(1);
 // Turning and zooming the figures uses the kit's look and zoom (drag, right stick, wheel, pinch); see pumpInput().
 window.addEventListener('blur',()=>{if(mode==='capsule')pauseGame();});
}
const originalBoot=boot;
boot=function(){originalBoot();if(!renderer||!gameRunning)return;bindExpansion();window.ShamMue.version='2.0 / Harbour Days';const base=window.ShamMue.getState;window.ShamMue.getState=()=>({...base(),work:G.work?{...G.work}:null,workStats:JSON.parse(JSON.stringify(G.workStats)),purchases:G.purchases,capsule:capsuleScene?{id:capsuleScene.id,shot:capsuleScene.shot,time:capsuleScene.t}:null,collection:collectionScene?.id??null,world:{...WORLD},areas:[...G.visited]});};
document.querySelector('[data-tab="controls"]').insertAdjacentHTML('beforebegin','<button data-tab="work">WORK</button>');
// Main-world geometry is built once. Cutscene props remain animated meshes.
extendHarbour();

/* -------------------------------------------------------------------------
   HARBOUR DAYS / 2.2 — interactive start menu and pause menu.
   Practice never writes the story save. Manual slots are separate snapshots.
   All controls below use the existing game systems. No network is used.
   ------------------------------------------------------------------------- */
const MENU_VERSION='2.2 / Harbour surroundings';
const MENU_SLOT_KEY='sham-mue.harbour.manual.v1.';
const menuDefaults={musicVolume:.8,effectsVolume:1,ambientVolume:1,cameraSpeed:1,invertLook:false,cameraDistance:5.5,textScale:1,scanlines:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
options={...menuDefaults,...options};
let menuSession='story',menuStorageOK=true;
const menuState={open:false,origin:'title',previous:'roam',page:'play',settingsTab:'display',controlsTab:'walk',series:0,view:0,confirm:null,restoreFocus:null,collectionReturn:null};
const MENU_PAGES=[
 ['play','Play','Your afternoon.','CHAPTER 01 / THE LAST SHIPMENT'],
 ['activities','Harbour activities','A day at the docks.','SEPARATE PRACTICE / STORY SAVE STAYS SAFE'],
 ['collection','Capsule collection','The small things.','FOUR COLLECTIONS / ONE SPECIAL AWARD'],
 ['settings','Settings','Make yourself at home.','DISPLAY / SOUND / PLAY'],
 ['controls','Controls','Take your time.','KEYBOARD / MOUSE / GAMEPAD / TOUCH'],
 ['saves','Save data','Keep your afternoon.','AUTOMATIC SAVE / THREE MANUAL SLOTS'],
 ['about','About this game','A small harbour story.','SHAM-MUE / HARBOUR DAYS 2.2']
];
const MENU_VIEWS=[
 {name:'East quay',eye:[-13,5.8,32.3],target:[2,2.2,-8]},
 {name:'North yard',eye:[29,12,-49],target:[0,2.5,-93]},
 {name:'Market street',eye:[99,8,29],target:[53,2,-5]},
 {name:'Ferry terminal',eye:[79,9,-100],target:[49,3,-131]}
];
const menuEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const menuNum=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
const menuCount=s=>TOYS.filter(t=>s?.toys?.[t.id]>0).length;
const menuClock=s=>{const n=Math.floor(menuNum(s?.clock,940));return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
const menuMoney=s=>'¥ '+Math.floor(menuNum(s?.cash)).toLocaleString();
const menuTime=s=>{const n=Math.floor(menuNum(s?.elapsed)/60);return n>=60?Math.floor(n/60)+'h '+(n%60)+'m':n+' min';};
const menuDate=s=>s?.savedAt?new Date(s.savedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Earlier save';
function menuSnapshot(){return JSON.parse(JSON.stringify({...G,savedAt:Date.now(),position:{x:player.x,z:player.z,yaw:player.yaw,health:player.health},forklift:{...forklift,speed:0,operation:null},crates:crates.map(c=>({...c})),sideShift}));}
function menuSource(){return menuState.origin==='pause'&&started?menuSnapshot():readSave();}
function menuStorySource(){return started&&menuSession==='story'?menuSnapshot():readSave();}
function menuSlot(i){try{return JSON.parse(localStorage.getItem(MENU_SLOT_KEY+i)||'null');}catch(e){return null;}}
function menuNotice(text,error=false){$('menuStatus').textContent=text;$('menuStatus').dataset.error=String(error);}
function menuAudio(){sound.init();persistOptions();sound.sfx('click');}
function menuDefaultStatus(){menuNotice(menuState.origin==='pause'&&menuSession==='practice'?'Practice only. Story saves do not change.':menuStorageOK?'Settings save automatically in this browser.':'Browser storage is blocked. Use Export to keep a save.',!menuStorageOK);}
function menuButton(action,text,primary=false,extra=''){return '<button class="menuButton'+(primary?' primaryAction':'')+'" data-menu-action="'+action+'" '+extra+'>'+text+'</button>';}
function menuStatBlock(s){return '<div class="menuStats"><div><small>Money in pocket</small><b>'+menuMoney(s)+'</b></div><div><small>Figures collected</small><b>'+menuCount(s)+' <span style="font-size:13px;color:#9fb5a7">/ 25</span></b></div><div><small>Time at the port</small><b>'+menuTime(s)+'</b></div></div>';}
function menuSceneControls(){return menuState.origin==='title'?'<div class="menuSceneViews"><span>HARBOUR VIEW</span>'+MENU_VIEWS.map((v,i)=>'<button class="menuSceneDot" data-menu-view="'+i+'" aria-pressed="'+(menuState.view===i)+'" aria-label="View '+v.name+'" title="'+v.name+'">'+String(i+1).padStart(2,'0')+'</button>').join('')+'</div>':'';}
function menuRenderPlay(){const s=menuSource(),pause=menuState.origin==='pause';
 if(pause){const practice=menuSession==='practice',w=G.work;return '<div class="menuHero"><span class="menuChip"><i></i>'+(practice?'PRACTICE / NOT SAVED':'PAUSED / '+menuClock(s))+'</span><h3>The harbour<br>can wait.</h3><p class="menuIntro">'+(w?'Your '+(w.race?'circuit':'shift')+' is paused. The clock will not move while this menu is open.':menuState.previous==='capsule'?'Your capsule scene is paused. Return to open it at your own pace.':'Return when you are ready. Your place in the afternoon is held.')+'</p><div class="menuHeroActions">'+menuButton('resume','Return to the harbour &nbsp; →',true)+menuButton('notebook','Open notebook')+'</div><div class="menuHeroActions" style="margin-top:0">'+menuButton('map','Harbour map')+(['roam','forklift','combat'].includes(menuState.previous)?menuButton('reset-camera','Reset camera'):'')+menuButton('to-title',practice?'Leave practice':'Save & return to start')+'</div>'+(w?'<div class="menuCallout"><strong>'+menuEsc(w.name)+'</strong><br>'+formatDuration(w.seconds)+' elapsed'+(w.race?' · Two-lap circuit':' · '+crates.filter(c=>c.delivered).length+' / '+crates.length+' loads delivered')+'</div>':'')+menuStatBlock(s)+'<p class="menuFootnote">'+(practice?'Practice progress ends when you return to the start menu. Your story save and manual slots stay unchanged.':'Automatic saves and manual slots are available under <strong>Save data</strong>.')+'</p></div>';}
 return '<div class="menuHero"><span class="menuChip"><i></i>'+(s?'SAVED AFTERNOON / '+menuClock(s):'THE EAST GATE / 15:40')+'</span><h3>One letter.<br>A whole harbour.</h3><p class="menuIntro">A lead to follow. A shift to work. A small figure to keep. Spend the afternoon at your own pace.</p><div class="menuHeroActions">'+(s?menuButton('continue','Continue the afternoon &nbsp; →',true)+menuButton('new','New story'):menuButton('new','Begin the afternoon &nbsp; →',true)+menuButton('activities-page','Try a harbour activity'))+'</div>'+(s?'<div class="menuCallout"><strong>'+menuEsc(leads[s.stage][0])+'</strong><br>'+menuEsc(leads[s.stage][1])+'</div>'+menuStatBlock(s)+'<p class="menuFootnote">Saved '+menuEsc(menuDate(s))+'. Continue loads the story save from this browser.</p>':'<div class="menuStats"><div><small>Work routes</small><b>06</b></div><div><small>Capsule figures</small><b>25</b></div><div><small>One afternoon</small><b>No rush.</b></div></div><p class="menuFootnote">New here? Open <strong>Controls</strong> before you begin. Practice activities do not replace a story save.</p>')+menuSceneControls()+'</div>';
}
function menuRenderActivities(){const cards=[
 ['work','Forklift shifts','Choose any of six load sheets. Lift, steer, deliver, and collect your pay.','ALL SIX ROUTES',0,'Choose a shift'],
 ['circuit','Forklift circuit','Two laps of the north yard. Pass every gate and work on your best line.','TWO LAPS',6,'Drive the circuit'],
 ['capsules','Capsule afternoon','Start beside Pocket Port with ¥2,000. Buy, open, and inspect each figure.','THE FULL PURCHASE SCENE',15,'Visit the machine'],
 ['explore','Free exploration','Walk the full harbour. Meet the workers, visit the market, or stop for tea.','NO STORY OBJECTIVE',1,'Take a walk'],
 ['spar','Yard sparring','Three rounds against the dock crew, ending with Goro the foreman. Guard, answer, keep your feet.','THREE ROUNDS',9,'Start sparring']
 ];return '<p class="menuIntro">Choose a separate practice session. Your story save and manual slots stay unchanged.</p><div class="menuGrid">'+cards.map(([id,title,desc,tag,toy,button])=>'<article class="activityCard"><span class="activityTag">'+tag+'</span><div class="activityArt" aria-hidden="true">'+toySVG(toy,58)+'</div><h3>'+title+'</h3><p>'+desc+'</p>'+menuButton('practice:'+id,button+' &nbsp; →')+'</article>').join('')+'</div><div class="menuCallout">Practice starts with ¥2,000 and all work routes open. Practice money, figures, and records are not saved. Choose <strong>Play</strong> to continue the saved story.</div>';}
const MENU_SETTINGS={
 display:[
  {key:'shadows',title:'Shadows',detail:'Turn off to reduce graphics work.',type:'toggle'},
  {key:'weather',title:'Changing weather',detail:'Allow light rain during the afternoon.',type:'toggle'},
  {key:'scanlines',title:'Screen texture',detail:'Show the fine lines and soft screen edge.',type:'toggle'},
  {key:'textScale',title:'Dialogue text size',detail:'Changes dialogue, capsule subtitles, and the current lead.',type:'select',values:[[1,'Standard'],[1.15,'Large'],[1.3,'Extra large']]},
  {key:'reducedMotion',title:'Reduced motion',detail:'Stops screen shake, rain movement, and menu camera drift.',type:'toggle'}
 ],
 audio:[
  {key:'muted',title:'Mute all sound',detail:'Music, effects, and device voices.',type:'toggle'},
  {key:'volume',title:'Master volume',detail:'The level for all sound.',type:'range',min:0,max:1,step:.05},
  {key:'musicVolume',title:'Music volume',detail:'The harbour theme and scene music.',type:'range',min:0,max:1,step:.05},
  {key:'effectsVolume',title:'Effects volume',detail:'Coins, footsteps, engines, and menu clicks.',type:'range',min:0,max:1,step:.05},
  {key:'ambientVolume',title:'Wind and rain volume',detail:'The continuous sound of the harbour.',type:'range',min:0,max:1,step:.05},
  {key:'voices',title:'Device voices',detail:'Uses an installed English voice, when available.',type:'toggle'}
 ],
 play:[
  {key:'tank',title:'Classic movement',detail:'A / D turn Jun. W / S move forward and back.',type:'toggle'},
  {key:'guides',title:'Route markers',detail:'Show the next lead and the delivery route.',type:'toggle'},
  {key:'relaxed',title:'Relaxed action timing',detail:'More time for chase keys and enemy warnings.',type:'toggle'},
  {key:'cameraSpeed',title:'Camera speed',detail:'Changes mouse and right-stick movement.',type:'range',min:.4,max:2,step:.1},
  {key:'invertLook',title:'Invert vertical look',detail:'Reverse the up and down camera control.',type:'toggle'},
  {key:'cameraDistance',title:'Walking camera distance',detail:'Default distance behind Jun. The wheel can still change it.',type:'range',min:3.5,max:8,step:.5}
 ]
};
function menuSettingValue(key,value){if(key==='cameraSpeed')return Number(value).toFixed(1)+' ×';if(key==='cameraDistance')return Number(value).toFixed(1)+' m';return Math.round(value*100)+'%';}
function menuSettingHTML(d){const id='menu-option-'+d.key,label='<div><label id="'+id+'-label" '+(d.type==='toggle'?'':'for="'+id+'"')+'>'+d.title+'</label><small>'+d.detail+'</small></div>';let control='';
 if(d.type==='toggle')control='<button class="menuSwitch" id="'+id+'" data-menu-setting="'+d.key+'" role="switch" aria-labelledby="'+id+'-label" aria-checked="'+!!options[d.key]+'">'+(options[d.key]?'ON':'OFF')+'</button>';
 if(d.type==='select')control='<select id="'+id+'" data-menu-setting="'+d.key+'">'+d.values.map(([v,n])=>'<option value="'+v+'" '+(Number(options[d.key])===v?'selected':'')+'>'+n+'</option>').join('')+'</select>';
 if(d.type==='range')control='<div class="menuRangeWrap"><output for="'+id+'" id="'+id+'-out">'+menuSettingValue(d.key,options[d.key])+'</output><input type="range" id="'+id+'" data-menu-setting="'+d.key+'" min="'+d.min+'" max="'+d.max+'" step="'+d.step+'" value="'+options[d.key]+'" aria-labelledby="'+id+'-label"></div>';
 return '<div class="menuSetting">'+label+control+'</div>';}
function menuRenderSettings(){return '<div class="menuTabs" role="group" aria-label="Setting categories">'+[['display','Display'],['audio','Sound'],['play','Play & camera']].map(([id,name])=>'<button class="menuTab" data-settings-tab="'+id+'" aria-pressed="'+(menuState.settingsTab===id)+'">'+name+'</button>').join('')+'</div>'+MENU_SETTINGS[menuState.settingsTab].map(menuSettingHTML).join('')+'<div class="menuHeroActions">'+(menuState.settingsTab==='display'?menuButton('kit-settings','Graphics & input (F9)',true)+menuButton('fullscreen','Full screen'):menuState.settingsTab==='audio'?menuButton('test-audio','Test sound'):'')+menuButton('reset-settings','Reset all settings')+'</div><p class="menuFootnote">Changes apply now. Settings are kept in this browser when storage is available. Graphics quality, resolution, frame rate, look sensitivity, vibration and the touch layout live in <strong>Graphics &amp; input</strong> (F9). Full screen depends on the browser.</p>';}
const MENU_CONTROLS={
 walk:{label:'Walking',intro:'Move through the harbour. Stop near a person or object to use it.',rows:[['W A S D / ARROWS','Walk.'],['SHIFT','Hold to run.'],['E / ENTER','Talk, inspect, or use an object.'],['MOUSE DRAG','Turn the camera.'],['MOUSE WHEEL','Move the camera closer or farther away.'],['C','Put the camera behind Jun.'],['Z','Hold to look closely.'],['N / TAB','Open the notebook.'],['ESC / P','Open the pause menu, also during dialogue, a chase or a capsule scene.'],['M / F','Mute sound / full screen.']]},
 work:{label:'Forklift',intro:'Stop before you move a load. Match the number on the case to the delivery bay.',rows:[['W / S','Drive forward / reverse.'],['A / D','Steer the forklift.'],['SPACE','Hold to brake.'],['E','Lift, lower, or deliver the load.'],['Q / Z','Raise / lower the forks.'],['C','Switch between the chase and cab cameras.'],['J','Read the load sheet.'],['H','Sound the horn.'],['X','Get out after you stop.'],['R','Recover the truck. Cargo or time penalties apply.']]},
 toys:{label:'Capsules',intro:'Watch the coin, handle, tray, and opening scene. Then inspect the figure.',rows:[['E','Use a nearby capsule machine.'],['SPACE','Skip the purchase scene to the figure.'],['A / D / DRAG','Turn the figure during inspection.'],['E / ENTER','Put the new figure in your pocket.'],['N → POCKET','Open the collection from the notebook.'],['J / K','Select the previous / next owned figure in the collection viewer.'],['WHEEL / PINCH','Zoom in the collection viewer.'],['ESC','Close the collection viewer.'],['P','Pause a capsule purchase scene.']]},
 battle:{label:'Action',intro:'Watch the enemy warning. Guard the first strike, then answer.',rows:[['W A S D','Move around the yard.'],['J','Punch.'],['K','Kick.'],['SPACE','Hold to guard.'],['L / SHIFT','Step back to evade.'],['SHOWN KEY','Press the key shown during the courier chase.'],['NOBU','After the story fight, Nobu by the water sets up yard sparring: three rounds against the dock crew.'],['CLICK THE KEY','Click or tap the chase prompt instead.'],['SETTINGS → PLAY','Turn on Relaxed action timing for longer warnings.'],['ESC','Pause the fight or chase.']]},
 pad:{label:'Gamepad',intro:'Connect a standard browser-compatible gamepad. Press a button to make it active. Prompts switch to gamepad buttons.',rows:[['D-PAD / LEFT STICK','Select menu controls and dialogue answers. Left / right turn notebook pages.'],['A / SOUTH','Confirm. Use, talk, lift or lower. Punch in a fight. Throw a dart.'],['B / EAST','Back in menus. Hold to run. Evade in a fight.'],['LEFT STICK','Walk, steer, or aim a dart.'],['RIGHT STICK','Turn the camera. Scroll long pages.'],['LEFT TRIGGER','Guard in a fight. Brake the forklift.'],['X / WEST','Punch. Get out of the forklift. Previous figure.'],['Y / NORTH','Kick. Recover the forklift. Next figure.'],['RB / LB','Raise / lower the forks. On foot: turn the camera / look closely.'],['R-STICK CLICK','Camera behind Jun. Cab view in the forklift.'],['L-STICK CLICK','Horn in the forklift. Controls help on foot.'],['BACK / VIEW','Notebook. In the forklift, the load sheet.'],['START / MENU','Pause or resume.']]},
 touch:{label:'Touch',intro:'Tap a menu option to open it. Swipe the menu row to see more pages on a small screen.',rows:[['LEFT HALF','Walk or drive. The stick appears under your thumb.'],['DRAG THE SCENE','Turn the camera. Pinch to zoom.'],['E BUTTON','Talk, inspect, lift, or lower. Punch in a fight.'],['RUN / EVADE','Hold to run. Evade in a fight.'],['GUARD / BRAKE','Guard in a fight. Brake the forklift.'],['FORKLIFT BUTTONS','Raise, lower, cab view, load sheet, get out, recover.'],['II / NOTES','Open the pause menu / the notebook.'],['FIGURE ARROWS','Turn a new capsule figure.'],['TAP AN OWNED FIGURE','Open its 3D model in the collection.']]}
};
function menuRenderControls(){const tab=MENU_CONTROLS[menuState.controlsTab];return '<div class="menuTabs" role="group" aria-label="Control categories">'+Object.entries(MENU_CONTROLS).map(([id,d])=>'<button class="menuTab" data-controls-tab="'+id+'" aria-pressed="'+(id===menuState.controlsTab)+'">'+d.label+'</button>').join('')+'</div><p class="menuIntro" style="margin-top:18px">'+tab.intro+'</p><div class="menuControlRows">'+tab.rows.map(([key,description])=>'<div class="menuControlRow"><kbd>'+key+'</kbd><span>'+description+'</span></div>').join('')+'</div>';}
function menuRenderCollection(){const s=menuSource(),series=menuState.series,ids=series<4?SERIES[series].ids:[24],count=menuCount(s);return '<p class="menuIntro">Select an owned figure to open its 3D model. Turn it, zoom in, and check the details.</p><div class="menuTabs" role="group" aria-label="Capsule series">'+[...SERIES.map(s=>s.name),'Driver award'].map((name,i)=>'<button class="menuTab" data-menu-series="'+i+'" aria-pressed="'+(series===i)+'">'+name+'</button>').join('')+'</div><div class="menuProgress" role="progressbar" aria-label="Collection progress" aria-valuemin="0" aria-valuemax="25" aria-valuenow="'+count+'"><i style="width:'+(count/25*100)+'%"></i></div><p class="menuFootnote" style="margin:8px 0">'+count+' / 25 figures owned'+(menuState.origin==='pause'&&menuSession==='practice'?' · Practice collection':' · Story collection')+'</p><div class="menuShelf">'+ids.map(id=>{const t=TOYS[id],owned=s?.toys?.[id];return '<button class="menuToy" data-menu-toy="'+id+'" '+(!owned?'disabled':'')+' aria-label="'+(owned?'Inspect '+menuEsc(t.name):'Uncollected figure '+(id+1))+'">'+toySVG(id,52)+'<span>'+(owned?menuEsc(t.name):'No. '+String(id+1).padStart(3,'0'))+'</span><small>'+(owned?t.rarity+' · ×'+owned:'NOT COLLECTED')+'</small></button>';}).join('')+'</div><div class="menuCallout">'+(series<4?'<strong>'+SERIES[series].name+'</strong> is at '+SERIES[series].location+'. Each capsule costs ¥100 of game money. Duplicate figures are possible.':'The Golden No. 05 is a driving award. Finish the two-lap circuit in 3:00 or less to earn it.')+'</div>'+(!s?'<p class="menuFootnote">There is no saved story collection yet. Start a story to keep the figures you find.</p>':'');}
function menuRenderSaves(){const s=menuStorySource(),practice=menuSession==='practice'&&started;return '<p class="menuIntro">Keep up to three manual copies of your story. Export a save to move it to another browser.</p>'+(practice?'<div class="menuCallout">This is a practice session. The slots below use your saved <strong>story</strong>, not practice progress.</div>':'')+'<article class="menuSaveCard"><div><div class="menuEyebrow" style="margin-bottom:8px">STORY / AUTOMATIC SAVE</div><h3>'+(s?menuEsc(leads[s.stage][0]):'No story save yet.')+'</h3><p>'+(s?menuMoney(s)+' · '+menuClock(s)+' · '+menuCount(s)+' figures<br>'+menuEsc(menuDate(s)):'Begin a story from Play. Practice does not create a story save.')+'</p></div><div class="menuSaveActions">'+(started&&menuSession==='story'?menuButton('save-now','Save now',false,!menuStorageOK?'disabled':''):'')+menuButton('export','Export save',false,!s?'disabled':'')+menuButton('import','Import save',false,!menuStorageOK?'disabled':'')+'</div></article><h3 class="menuMinorTitle">Manual save slots</h3>'+[1,2,3].map(i=>{const v=menuSlot(i);return '<article class="menuSaveCard"><div><h3>'+String(i).padStart(2,'0')+' &nbsp; '+(v?menuEsc(leads[v.stage]?.[0]||'Saved afternoon'):'Empty slot')+'</h3><p>'+(v?menuMoney(v)+' · '+menuCount(v)+' figures · '+menuEsc(menuDate(v)):'Store a copy of the current story save.')+'</p></div><div class="menuSaveActions">'+menuButton('slot-save:'+i,v?'Replace':'Save here',false,!s||!menuStorageOK?'disabled':'')+(v?menuButton('slot-load:'+i,'Load',false,!menuStorageOK?'disabled':'')+menuButton('slot-export:'+i,'Export'):'')+'</div></article>';}).join('')+'<div class="menuHeroActions">'+menuButton('delete-auto','Delete automatic save',false,!s||!menuStorageOK?'disabled':'')+'</div><p class="menuFootnote">Loading or importing replaces the automatic story save after confirmation. Manual slots stay unchanged. A loaded circuit restarts at a safe point. Save data is held in this browser, not inside the HTML file.</p>';}
function menuRenderAbout(){return '<div class="menuHero"><span class="menuChip">ONE FILE / A WHOLE AFTERNOON</span><h3>An ordinary day.<br>A few small things.</h3><p class="menuIntro">Jun follows a letter from his missing father to Nagamatsu Harbour. A shift in the yard may be the first step toward an answer.</p><div class="menuCallout">Walk the docks. Ask questions. Work a forklift shift. Stop for a capsule figure. The full harbour remains open after the story.</div><div class="menuStats"><div><small>Story</small><b>01 chapter</b></div><div><small>Delivery bays</small><b>06</b></div><div><small>Collections</small><b>04 sets</b></div></div><p class="menuFootnote">Original characters, models, textures, music, and sound effects. Drawn with three.js (WebGPU, or WebGL 2 as a fallback) and browser audio. This is an independent game, not an official Shenmue or SEGA release.</p><p class="menuFootnote">Use a browser with WebGPU or WebGL 2 and hardware acceleration. No network connection is needed. Sound starts after your first key, click, or tap. Device voices and full screen depend on your browser.</p><div class="menuHeroActions">'+menuButton('controls-page','View controls')+menuButton('settings-page','Adjust settings')+'</div></div>';}
function menuPaint(page=menuState.page){if(!MENU_PAGES.some(p=>p[0]===page))page='play';menuState.page=page;const index=MENU_PAGES.findIndex(p=>p[0]===page),def=MENU_PAGES[index],paused=menuState.origin==='pause';
 $('menuNav').innerHTML=MENU_PAGES.map(([id,name],i)=>'<button class="menuNavButton" data-menu-page="'+id+'" aria-current="'+(id===page?'page':'false')+'"><span class="mnNumber">'+String(i+1).padStart(2,'0')+'</span><span>'+(id==='play'&&paused?'Resume game':name)+'</span><span class="mnArrow" aria-hidden="true">→</span></button>').join('');
 $('menuPanelTitle').textContent=page==='play'&&paused?'Take a moment.':def[2];$('menuPanelKicker').textContent=page==='play'&&paused?(menuSession==='practice'?'PRACTICE SESSION / NOT SAVED':'YOUR AFTERNOON / PAUSED'):def[3];$('menuPageNo').textContent=String(index+1).padStart(2,'0');
 const render={play:menuRenderPlay,activities:menuRenderActivities,collection:menuRenderCollection,settings:menuRenderSettings,controls:menuRenderControls,saves:menuRenderSaves,about:menuRenderAbout};$('menuContent').innerHTML=render[page]();$('menuContent').scrollTop=0;
 $('menuMute').setAttribute('aria-label',options.muted?'Turn sound on':'Mute sound');$('menuMute').setAttribute('aria-pressed',String(options.muted));$('menuMute').style.opacity=options.muted?'.45':'1';$('titleScreen').setAttribute('aria-label',paused?'Pause menu':'Start menu');menuDefaultStatus();
}
function menuOpen(page='play',origin='title'){menuState.open=true;menuState.origin=origin;menuState.confirm=null;show('menuConfirm',false);show('titleScreen');document.body.classList.add('menu-open');menuPaint(page);requestAnimationFrame(()=>{$('menuNav').querySelector('[aria-current="page"]')?.focus({preventScroll:true});});}
function menuHide(){menuState.open=false;menuState.confirm=null;show('menuConfirm',false);show('titleScreen',false);document.body.classList.remove('menu-open');}
function menuSelectPage(page,focusNav=true){menuAudio();menuPaint(page);if(focusNav){const button=$('menuNav').querySelector('[aria-current="page"]');button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',inline:'nearest'});}}
function menuAsk(title,text,accept,callback){menuState.restoreFocus=document.activeElement;menuState.confirm=callback;$('menuConfirmTitle').textContent=title;$('menuConfirmText').textContent=text;$('menuAccept').textContent=accept;show('menuConfirm');$('menuCancel').focus();}
function menuCancelAsk(){show('menuConfirm',false);menuState.confirm=null;const focus=menuState.restoreFocus;menuState.restoreFocus=null;if(focus?.isConnected)focus.focus({preventScroll:true});else $('menuNav').querySelector('[aria-current="page"]')?.focus();}
function menuResume(){if(menuState.origin!=='pause')return;const previous=menuState.previous;menuHide();setMode(previous);clearKeys();kit.input.settle();}
function menuNewStory(){if(readSave())menuAsk('Begin a new story?','The automatic story save will be replaced. Manual save slots will not change.','Start a new story',()=>startGame(false));else startGame(false);}
function menuBack(){if(menuState.confirm){menuCancelAsk();return;}if(menuState.page!=='play'){menuSelectPage('play');return;}if(menuState.origin==='pause')menuResume();}
function menuResetCamera(){const em=menuState.previous;camYaw=em==='forklift'?forklift.yaw:player.yaw;camPitch=.1;camZoom=options.cameraDistance;camManual=0;forkCamera=0;screenShake=0;const p=em==='forklift'?forklift:player,d=em==='forklift'?7:camZoom;camEye=[p.x+Math.sin(camYaw)*d,em==='forklift'?4.2:3.38,p.z+Math.cos(camYaw)*d];camTarget=[p.x,1.2,p.z];menuResume();toast('CAMERA RESET','Back behind Jun','Drag the scene to look around.');}
function menuPractice(kind){if(menuState.origin==='pause')menuAsk('Start a practice session?',menuSession==='practice'?'This ends the current practice session. Your story save stays unchanged.':'Your story will be saved first. Practice starts separately and will not change that save.','Start practice',()=>{saveGame(true);menuLaunchPractice(kind);});else menuLaunchPractice(kind);}
function menuClearTransient(){dialogue=null;modalState=null;transition=null;qte=null;darts=null;capsuleScene=null;collectionScene=null;spar=null;enemies=[];screenShake=0;damageAlpha=0;battleWinDelay=0;['modal','ending','bookOverlay','dartsOverlay'].forEach(id=>show(id,false));$('fade').style.opacity='0';$('toast').classList.remove('show');$('areaCard').classList.remove('show');}
function menuLaunchPractice(kind){menuSession='practice';menuHide();menuClearTransient();started=false;freshState();G.stage=7;G.cash=2000;started=true;sound.init();persistOptions();const spawn=kind==='capsules'?[-11.3,26.4]:kind==='circuit'?[2,-43]:kind==='work'?[-6,6.7]:kind==='spar'?[1.5,-24]:[0,31.5];player.x=spawn[0];player.z=spawn[1];player.yaw=0;player.walk=0;player.y=0;if(collides(player.x,player.z,.35,true))moveToSafe();camYaw=0;camPitch=.1;camZoom=options.cameraDistance;camEye=[player.x,3.4,player.z+camZoom];camTarget=[player.x,1.2,player.z];clearKeys();setMode('roam');updateHUD();
 if(kind==='work')showWorkBoard();else if(kind==='circuit')startCircuit();else if(kind==='capsules')inspectMachine(0);else if(kind==='spar')startSpar();else toast('PRACTICE / NOT SAVED','The harbour is open','Your story save stays unchanged. '+prompts.menu);}
function menuInspectToy(id){const s=menuSource();if(!s?.toys?.[id])return;menuState.collectionReturn={origin:menuState.origin,page:'collection'};if(menuState.origin==='title'){loadState(s);started=false;}menuHide();openCollection(id,'frontmenu');$('collectionBack').textContent=backPrefix()+'BACK TO THE MENU';}
function menuStoreSlot(i){const state=menuStorySource();if(!state)return;const save=()=>{try{localStorage.setItem(MENU_SLOT_KEY+i,JSON.stringify(state));menuPaint('saves');menuNotice('Story copied to manual slot '+i+'.');}catch(e){menuNotice('The slot could not be saved. Use Export instead.',true);}};if(menuSlot(i))menuAsk('Replace manual slot '+i+'?','This replaces only the selected manual slot. The other slots stay unchanged.','Replace slot',save);else save();}
function menuApplySave(state){try{const clean=menuValidateSave(state);localStorage.setItem(SAVE_KEY,JSON.stringify(clean));menuSession='story';menuClearTransient();started=false;startGame(true);}catch(e){menuNotice('The save could not be loaded: '+e.message,true);}}
function menuLoadSlot(i){const state=menuSlot(i);if(!state)return;menuAsk('Load manual slot '+i+'?','This replaces the automatic story save and starts the saved afternoon. The manual slot is kept.','Load this afternoon',()=>menuApplySave(state));}
function menuDownload(state){if(!state){menuNotice('No story save is available.',true);return;}try{const data=JSON.stringify({format:'sham-mue-save',version:1,exportedAt:new Date().toISOString(),state},null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Sham-mue-save-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);menuNotice('Save export requested. Check your browser downloads.');}catch(e){menuNotice('The browser could not export this save.',true);}}
function menuValidateSave(value){
 const raw=value?.format==='sham-mue-save'?value.state:value;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.v!==1||!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>7)throw Error('Not a supported Sham-mue save.');
 const safe=(v,d,min,max)=>safeNumber(v,d,min,max),s={v:1,stage:raw.stage,expansion:raw.expansion===2?2:undefined,savedAt:Date.now(),toys:{}};
 for(const [key,def,min,max] of [['cash',500,0,99999],['clock',940,940,1135],['elapsed',0,0,1e8],['drinks',0,0,99999],['dartsPlayed',0,0,99999],['bestDarts',0,0,1000],['qteWins',0,0,99999],['sideShifts',0,0,99999],['purchases',0,0,99999],['trades',0,0,99999]])s[key]=safe(raw[key],def,min,max);
 for(const k of ['catFed','hasBun','battleWon','sideShift'])s[k]=!!raw[k];
 {const sp=raw.sparStats&&typeof raw.sparStats==='object'?raw.sparStats:{};s.sparStats={wins:Math.floor(safe(sp.wins,0,0,99999)),best:safe(sp.best,0,0,1e7),runs:Math.floor(safe(sp.runs,0,0,99999))};}
 if(raw.toys&&typeof raw.toys==='object')for(const t of TOYS){const n=raw.toys[t.id];if(Number.isInteger(n)&&n>0)s.toys[t.id]=Math.min(n,9999);}
 if(raw.position){if(typeof raw.position!=='object'||!Number.isFinite(raw.position.x)||!Number.isFinite(raw.position.z))throw Error('The saved position is not valid.');s.position={x:safe(raw.position.x,0,WORLD.minX+1,WORLD.maxX-1),z:safe(raw.position.z,31,WORLD.minZ+1,WORLD.maxZ-1),yaw:safe(raw.position.yaw,0,-10000,10000),health:safe(raw.position.health,100,1,100)};}
 if(raw.crates!==undefined){if(!Array.isArray(raw.crates)||raw.crates.length>10||raw.crates.some(c=>!c||typeof c!=='object'||!Number.isFinite(c.x)||!Number.isFinite(c.z)))throw Error('The cargo list is not valid.');s.crates=sanitizeCargo(raw.crates);}
 if(raw.forklift){const f=raw.forklift;if(typeof f!=='object')throw Error('The forklift record is not valid.');s.forklift={x:safe(f.x,-5,WORLD.minX+2,WORLD.maxX-2),z:safe(f.z,1.2,WORLD.minZ+2,WORLD.maxZ-2),yaw:safe(f.yaw,0,-10000,10000),speed:0,carry:Number.isInteger(f.carry)&&s.crates?.[f.carry]&&!s.crates[f.carry].delivered?f.carry:null,lift:safe(f.lift,.12,.1,1.6),targetLift:safe(f.lift,.12,.1,1.6),operation:null};}
 if(s.expansion===2){const st=raw.workStats||{};s.workStats={shifts:safe(st.shifts,0,0,999999),delivered:safe(st.delivered,0,0,999999),earnings:safe(st.earnings,0,0,999999),races:safe(st.races,0,0,999999),raceBest:safe(st.raceBest,0,0,1e7),bests:{}};for(const j of [...JOBS,{id:'tutorial'}])if(Number.isFinite(st.bests?.[j.id])&&st.bests[j.id]>0)s.workStats.bests[j.id]=Math.min(1e7,st.bests[j.id]);
 s.visited=Array.isArray(raw.visited)?raw.visited.filter(v=>['quay','north','old','ferry','cold','rail','market','tea'].includes(v)):['quay'];s.work=null;
 if(raw.work){const w=raw.work,def=JOBS.find(j=>j.id===w.id);if(!w.race&&!w.tutorial&&!def)throw Error('The work route is not supported.');if(!w.race&&(!s.crates?.length||s.crates.length!==(w.tutorial?3:def.cargo.length)))throw Error('The work route and cargo list do not match.');s.work={id:w.race?'circuit':w.tutorial?'tutorial':def.id,name:w.race?'The forklift circuit':w.tutorial?'A favour for Daichi':def.name,tag:w.race?'TWO LAPS / NORTH YARD':w.tutorial?'FIRST SHIFT / WAREHOUSE 03':def.tag,tutorial:!!w.tutorial,race:!!w.race,pay:w.tutorial?500:def?.pay||0,target:w.tutorial?360:def?.target||180,seconds:safe(w.seconds,0,0,1e8),bumps:safe(w.bumps,0,0,99999),recoveries:safe(w.recoveries,0,0,99999),checkpoint:Math.floor(safe(w.checkpoint,0,0,CIRCUIT.length*2-1))};}
 s.pendingCapsule=null;if(raw.pendingCapsule){const c=raw.pendingCapsule;if(!Number.isInteger(c.id)||c.id<0||c.id>=24||!Number.isInteger(c.machine)||!SERIES[c.machine]?.ids.includes(c.id)||!s.toys[c.id])throw Error('The capsule record is not valid.');s.pendingCapsule={id:c.id,machine:c.machine,isNew:!!c.isNew,count:s.toys[c.id],paid:true,position:s.position||{x:SERIES[c.machine].x,z:SERIES[c.machine].z+2,yaw:0}};}}
 return s;
}
async function menuReadImport(file){if(!file)return;try{if(file.size>1024*1024)throw Error('This file is too large. Choose a game-save JSON file.');const clean=menuValidateSave(JSON.parse(await file.text()));menuAsk('Import this afternoon?',menuMoney(clean)+' · '+menuCount(clean)+' figures · '+leads[clean.stage][0]+'.\nThis replaces the automatic story save. Manual slots stay unchanged.','Import & play',()=>menuApplySave(clean));}catch(e){menuNotice('Import failed. '+(e instanceof SyntaxError?'Choose a valid JSON game-save file.':e.message),true);}finally{$('menuImportInput').value='';}}
function menuDeleteAuto(){menuAsk('Delete the automatic save?','The story automatic save will be removed from this browser. Manual slots stay unchanged. You will return to the start menu.','Delete automatic save',()=>{try{localStorage.removeItem(SAVE_KEY);started=false;menuSession='story';menuClearTransient();freshState();setMode('title');menuOpen('saves','title');menuNotice('Automatic save deleted. Manual slots are unchanged.');}catch(e){menuNotice('The automatic save could not be removed.',true);}});}
function menuSetOption(key,value){const def=Object.values(MENU_SETTINGS).flat().find(v=>v.key===key);if(!def)return;if(def.type==='toggle')options[key]=!!value;else if(def.type==='select'){if(!def.values.some(([v])=>v===Number(value)))return;options[key]=Number(value);}else options[key]=clamp(Number(value),def.min,def.max);if(key==='cameraDistance')camZoom=options.cameraDistance;sound.init();persistOptions();const output=$('menu-option-'+key+'-out');if(output)output.textContent=menuSettingValue(key,options[key]);const btn=$('menu-option-'+key);if(def.type==='toggle'&&btn){btn.textContent=options[key]?'ON':'OFF';btn.setAttribute('aria-checked',String(options[key]));}if(key==='muted'){ $('menuMute').setAttribute('aria-pressed',String(options.muted));$('menuMute').style.opacity=options.muted?'.45':'1';$('menuMute').setAttribute('aria-label',options.muted?'Turn sound on':'Mute sound');}menuNotice(menuStorageOK?'Setting applied and saved.':'Setting applied for this session. Storage is blocked.',!menuStorageOK);}
function menuFullScreen(){try{if(!document.fullscreenElement&&!document.fullscreenEnabled){menuNotice('Full screen is blocked here. Open the HTML file in its own browser tab.',true);return;}const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();Promise.resolve(p).then(()=>menuNotice(document.fullscreenElement?'Full screen is on. Press F to leave.':'Window view is on.')).catch(()=>menuNotice('The browser blocked full screen. The game still works in this window.',true));}catch(e){menuNotice('Full screen is not available in this view.',true);}}
function menuDo(action){menuAudio();const [name,arg]=action.split(':');switch(name){
 case 'continue':startGame(true);break;case 'new':menuNewStory();break;case 'resume':menuResume();break;
 case 'activities-page':menuSelectPage('activities');break;case 'settings-page':menuSelectPage('settings');break;case 'controls-page':menuSelectPage('controls');break;
 case 'practice':menuPractice(arg);break;case 'reset-camera':menuResetCamera();break;
 case 'notebook':menuResume();openBook('leads');break;case 'map':menuResume();openBook('map');break;
 case 'to-title':if(menuSession==='practice')menuAsk('Leave practice?','Practice progress is not saved. Your story save and manual slots stay unchanged.','Return to start',()=>goTitle());else goTitle();break;
 case 'mute':menuSetOption('muted',!options.muted);break;case 'fullscreen':menuFullScreen();break;
 case 'kit-settings':kit.menu.open();break;
 case 'test-audio':if(options.muted)menuNotice('All sound is muted. Turn Mute all sound off to test.');else{sound.sfx('coin');menuNotice('Playing a coin sound.');}break;
 case 'reset-settings':menuAsk('Reset all settings?','Display, sound, and play settings will return to their default values. Your story and manual slots will not change.','Reset settings',()=>{options={...defaults,...menuDefaults};camZoom=options.cameraDistance;persistOptions();menuPaint('settings');menuNotice('All settings reset.');});break;
 case 'save-now':saveGame(true);menuPaint('saves');menuNotice(menuStorageOK?'The current story has been saved.':'Saving is blocked. Export a copy instead.',!menuStorageOK);break;
 case 'export':menuDownload(menuStorySource());break;case 'slot-export':menuDownload(menuSlot(Number(arg)));break;
 case 'import':$('menuImportInput').click();break;case 'slot-save':menuStoreSlot(Number(arg));break;case 'slot-load':menuLoadSlot(Number(arg));break;case 'delete-auto':menuDeleteAuto();break;
 case 'confirm-cancel':menuCancelAsk();break;case 'confirm-yes':{const fn=menuState.confirm;menuState.confirm=null;show('menuConfirm',false);fn?.();break;}
}}
function menuIsOpen(){return menuState.open&&['title','menu'].includes(mode)&&!$('titleScreen').classList.contains('hidden');}
function menuFocusable(root=menuState.confirm?$('menuConfirm'):$('titleScreen')){return [...root.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type="file"])')].filter(e=>e.getClientRects().length&&!e.closest('.hidden')&&getComputedStyle(e).visibility!=='hidden');}
function menuFocus(e){e?.focus({preventScroll:true});e?.scrollIntoView({block:'nearest',inline:'nearest'});}
function menuNavigate(direction,horizontal=false){const active=document.activeElement;if(menuState.confirm){const list=menuFocusable(),at=list.indexOf(active);menuFocus(list[at<0?(direction>0?0:list.length-1):(at+direction+list.length)%list.length]);return;}
 const nav=[...$('menuNav').querySelectorAll('button')],inNav=nav.includes(active);
 if(horizontal){if(direction>0&&inNav){menuFocus(menuFocusable($('menuContent'))[0]);return;}if(direction<0&&!inNav){menuFocus(nav.find(e=>e.getAttribute('aria-current')==='page'));return;}if(inNav){menuFocus(nav[(nav.indexOf(active)+direction+nav.length)%nav.length]);return;}}
 const list=inNav?nav:menuFocusable($('menuContent'));if(!list.length){menuFocus(nav.find(e=>e.getAttribute('aria-current')==='page'));return;}const at=list.indexOf(active);menuFocus(list[at<0?(direction>0?0:list.length-1):(at+direction+list.length)%list.length]);}
function menuAuxRoot(){return mode==='modal'?$('modal'):mode==='workboard'?$('workBoard'):null;}
function menuAuxNavigate(direction){const root=menuAuxRoot();if(root)stepFocus(root,direction);}
function menuBind(){
 $('titleScreen').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.menuPage){menuSelectPage(b.dataset.menuPage);return;}
 if(b.dataset.menuAction){menuDo(b.dataset.menuAction);return;}
 if(b.dataset.settingsTab){menuState.settingsTab=b.dataset.settingsTab;menuAudio();menuPaint('settings');$('menuContent').querySelector('[data-settings-tab="'+menuState.settingsTab+'"]')?.focus({preventScroll:true});return;}
 if(b.dataset.controlsTab){menuState.controlsTab=b.dataset.controlsTab;menuAudio();menuPaint('controls');$('menuContent').querySelector('[data-controls-tab="'+menuState.controlsTab+'"]')?.focus({preventScroll:true});return;}
 if(b.dataset.menuSeries!==undefined){menuState.series=Number(b.dataset.menuSeries);menuAudio();menuPaint('collection');$('menuContent').querySelector('[data-menu-series="'+menuState.series+'"]')?.focus({preventScroll:true});return;}
 if(b.dataset.menuToy!==undefined){menuAudio();menuInspectToy(Number(b.dataset.menuToy));return;}
 if(b.dataset.menuView!==undefined){menuState.view=Number(b.dataset.menuView);menuAudio();document.querySelectorAll('[data-menu-view]').forEach(v=>v.setAttribute('aria-pressed',String(Number(v.dataset.menuView)===menuState.view)));menuNotice('Harbour view: '+MENU_VIEWS[menuState.view].name+'.');return;}
 if(b.dataset.menuSetting){menuSetOption(b.dataset.menuSetting,!options[b.dataset.menuSetting]);sound.sfx('click');}
 });
 $('titleScreen').addEventListener('input',e=>{if(e.target.matches('input[type="range"][data-menu-setting]'))menuSetOption(e.target.dataset.menuSetting,e.target.value);});
 $('titleScreen').addEventListener('change',e=>{if(e.target.matches('select[data-menu-setting]')){menuSetOption(e.target.dataset.menuSetting,e.target.value);sound.sfx('click');}});
 $('menuImportInput').addEventListener('change',e=>menuReadImport(e.target.files?.[0]));
 const b=document.createElement('button');b.id='desktopMenuButton';b.className='hidden';b.setAttribute('aria-label','Open the pause menu');b.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M8 3v10"/></svg> ESC &nbsp; MENU';b.onclick=()=>pauseGame();document.body.appendChild(b);
 const tag=document.createElement('div');tag.id='practiceTag';tag.className='hidden';tag.textContent='PRACTICE / STORY SAVE UNCHANGED';document.body.appendChild(tag);
 try{const probe='sham-mue.storage-check.'+Date.now();localStorage.setItem(probe,'1');localStorage.removeItem(probe);}catch(e){menuStorageOK=false;}
}
// Integrate with the original state machine. Menus stop game time, not the renderer.
const menuBasePersist=persistOptions;
persistOptions=function(){menuBasePersist();if(sound.ctx){sound.music?.gain.setTargetAtTime(.65*options.musicVolume,sound.ctx.currentTime,.08);sound.fx?.gain.setTargetAtTime(.8*options.effectsVolume,sound.ctx.currentTime,.08);}document.documentElement.style.setProperty('--text-scale',String(options.textScale));$('grain').style.opacity=options.scanlines?'1':'0';document.body.classList.toggle('reduce-motion',!!options.reducedMotion);};
const menuBaseSoundInit=sound.init.bind(sound);
sound.init=function(){menuBaseSoundInit();if(this.ctx){this.music.gain.setTargetAtTime(.65*options.musicVolume,this.ctx.currentTime,.08);this.fx.gain.setTargetAtTime(.8*options.effectsVolume,this.ctx.currentTime,.08);this.master.gain.setTargetAtTime(options.muted?0:options.volume,this.ctx.currentTime,.08);}};
saveGame=function(silent=false){if(!started||!G||menuSession==='practice')return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(menuSnapshot()));menuStorageOK=true;if(!silent){saveUntil=worldTime+1.8;overlayOpacity('saveIcon',1);}}catch(e){menuStorageOK=false;if(!G.saveWarned){G.saveWarned=true;toast('BROWSER STORAGE','This session is not saved','Open Menu → Save data → Export to keep a copy.');}}};
const menuBaseSetMode=setMode;
setMode=function(m){menuBaseSetMode(m);if(m!=='title'&&m!=='menu')menuHide();if($('desktopMenuButton'))show('desktopMenuButton',started&&['roam','forklift','combat','dialogue','qte','capsule'].includes(m));if($('practiceTag'))show('practiceTag',started&&menuSession==='practice'&&['roam','forklift'].includes(m));if(!['collection','capsule'].includes(m))$('collectionBack').textContent=backPrefix()+'BACK TO THE NOTEBOOK';};
const menuBaseStart=startGame;
startGame=function(resume=false){menuSession='story';menuHide();menuClearTransient();menuBaseStart(resume);camZoom=options.cameraDistance;};
requestNew=menuNewStory;
const menuBaseGoTitle=goTitle;
goTitle=function(){menuBaseGoTitle();menuClearTransient();menuSession='story';menuOpen('play','title');};
pauseGame=function(){if(!started||['title','menu','modal','book','ending','transition','workboard'].includes(mode))return;menuState.previous=mode;saveGame(true);clearKeys();setMode('menu');menuOpen('play','pause');};
const menuBaseEffective=effectiveMode;
effectiveMode=function(){return mode==='menu'?menuState.previous:menuBaseEffective();};
const menuBaseCamera=updateCamera;
updateCamera=function(dt){if(options.reducedMotion)screenShake=0;if(mode==='menu')return;if(mode==='title'){const v=MENU_VIEWS[menuState.view],drift=options.reducedMotion?0:Math.sin(worldTime*.045)*.8,eye=[v.eye[0]+drift,v.eye[1],v.eye[2]];if(renderer)renderer.fov=53;camEye=camEye.map((x,i)=>mix(x,eye[i],Math.min(1,dt*2.2)));camTarget=camTarget.map((x,i)=>mix(x,v.target[i],Math.min(1,dt*2.2)));return;}menuBaseCamera(dt);};
const menuBaseRank=driverRank;
driverRank=function(){return menuSession==='practice'?2:menuBaseRank();};
const menuBaseFresh=freshState;
freshState=function(){menuBaseFresh();camZoom=options.cameraDistance;};
const menuBaseCloseCollection=closeCollection;
closeCollection=function(){if(collectionScene?.returnMode==='frontmenu'){const ret=menuState.collectionReturn||{origin:'title',page:'collection'};collectionScene=null;setMode(ret.origin==='pause'?'menu':'title');menuOpen(ret.page,ret.origin);return;}menuBaseCloseCollection();};
const menuBasePress=onPress;
onPress=function(code){if(menuIsOpen()){if(code==='Escape')menuBack();else if(code==='Enter'||code==='KeyE')document.activeElement?.click?.();return;}if(code==='KeyP'&&started&&['roam','forklift','combat','dialogue','qte','capsule'].includes(mode)){pauseGame();return;}menuBasePress(code);};
const menuBaseHUD=updateHUD;
let hudPractice=null;
updateHUD=function(){menuBaseHUD();const practice=started&&menuSession==='practice';if(practice!==hudPractice){hudPractice=practice;const eyebrow=document.querySelector('.locationHud>.eyebrow');if(practice)eyebrow.textContent='PRACTICE / HARBOUR DAYS';else eyebrow.innerHTML='CHAPTER 01 &nbsp; / &nbsp; THE LAST SHIPMENT';}if(practice&&!G.work){hudText('leadNumber','THE AFTERNOON IS YOURS');hudText('objective','Explore, work, or collect. Story saves stay unchanged.');}};
// Keep the work board and purchase prompts usable without a mouse.
const menuBaseModal=openModal;
openModal=function(...args){menuBaseModal(...args);requestAnimationFrame(()=>{if(mode==='modal')menuFocus(menuFocusable($('modal'))[0]);});};
const menuBaseWorkBoard=showWorkBoard;
showWorkBoard=function(...args){menuBaseWorkBoard(...args);requestAnimationFrame(()=>{if(mode==='workboard')menuFocus($('contracts').querySelector('button:not(:disabled)')||menuFocusable($('workBoard'))[0]);});};
const menuBaseBoot=boot;
boot=function(){menuBaseBoot();if(!renderer||!gameRunning)return;menuBind();persistOptions();menuOpen('play','title');window.ShamMue.version=MENU_VERSION;const previous=window.ShamMue.getState;window.ShamMue.getState=()=>({...previous(),session:menuSession,menu:menuState.open?{page:menuState.page,origin:menuState.origin}:null,settings:{...options},storage:menuStorageOK});};

/* -------------------------------------------------------------------------
   HARBOUR DAYS / 2.2 — a complete coastal setting.
   Background meshes are built once and never enter the cargo or save state.
   The original playable boundary and all job routes remain unchanged.
   ------------------------------------------------------------------------- */
const PORT_SCENERY={chunks:[],occluders:[],vertices:0,version:'2.2 / Harbour surroundings'};
let sceneryClock=0;
function sceneryChunk(name,fn){
 const old=S,n=obstacles.length;S=new MeshBuilder(1<<15);fn();const a=S.a.slice();S=old;obstacles.length=n;
 let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<a.length;i+=13)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[i+k]);hi[k]=Math.max(hi[k],a[i+k]);}
 const center=lo.map((v,k)=>(v+hi[k])*.5),radius=Math.hypot(...sub(hi,lo))*.5;
 PORT_SCENERY.chunks.push({name,a,center,radius});PORT_SCENERY.vertices+=a.length/13;
}
function sceneryTextures(){
 T.town=atlas.tile('town plaster',c=>{
  c.fillStyle='#c9c8b3';c.fillRect(0,0,256,256);
  for(let i=0;i<1100;i++){c.fillStyle=i%2?'#77847818':'#fff7d916';c.fillRect(rand()*256,rand()*256,rand()*9+1,rand()*3+1);}
  c.fillStyle='#b1b29e';c.fillRect(0,231,256,25);c.fillStyle='#717f75';c.fillRect(0,11,256,3);
  for(let x of [25,146]){c.fillStyle='#777e6d';c.fillRect(x-4,51,91,132);c.fillStyle='#496c70';c.fillRect(x,55,83,122);
   c.fillStyle='#8eaaa3';c.fillRect(x+4,59,34,114);c.fillStyle='#c4c9ae';c.fillRect(x+39,55,4,122);c.fillRect(x,114,83,4);
   c.fillStyle='#e4dbc333';c.fillRect(x+6,65,11,108);c.fillStyle='#788777';c.fillRect(x-9,182,100,8);}
 });
 T.city=atlas.tile('city windows',c=>{
  c.fillStyle='#aeb9af';c.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=64)for(let x=0;x<256;x+=64){c.fillStyle='#7c8e85';c.fillRect(x+6,y+9,52,45);c.fillStyle=(x+y)%128?'#658389':'#859c99';c.fillRect(x+9,y+12,46,38);c.fillStyle='#a7b8ab';c.fillRect(x+30,y+12,3,38);c.fillStyle='#d3d2b944';c.fillRect(x+11,y+13,6,35);c.fillStyle='#687a7133';c.fillRect(x,y+61,64,3);}
 });
 T.fence=atlas.tile('chain link',c=>{
  c.clearRect(0,0,256,256);c.lineWidth=1.9;c.strokeStyle='#8f9f96';
  for(let i=-256;i<=512;i+=32){c.beginPath();c.moveTo(i,0);c.lineTo(i+256,256);c.stroke();c.beginPath();c.moveTo(i,0);c.lineTo(i-256,256);c.stroke();}
 });
 T.land=atlas.texture('winter ground','#9da58b','concrete');
 T.stone=atlas.tile('harbour stone',c=>{
  c.fillStyle='#7a8880';c.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=32)for(let x=-64;x<256;x+=64){const dx=x+(y%64?32:0);c.fillStyle=['#939b87','#a1a68f','#7d8c83','#a9ac96'][Math.floor(rand()*4)];c.fillRect(dx+2,y+2,60,27);c.fillStyle='#546c672e';c.fillRect(dx+2,y+23,60,5);}
 });
 T.cityRoad=board('city road','NAGAMATSU CITY',4,'#41665f','#e4dbb9','PORT ROAD / BUS 06');
 T.shipName=board('ship name','KITA MARU',4,'#435e63','#d9d8bd','NAGAMATSU');
}
function terrainGrid(x0,z0,w,d,nx,nz,height,col){
 const p=(i,j)=>{const x=x0+i*w/nx,z=z0+j*d/nz;return [x,height(x,z),z];};
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),e=p(i,j+1),v=.94+Math.sin(i*1.31+j*.93)*.035;
  const color=hex(col).map(n=>n*v);S.tri(a,e,b,T.land,color,[[0,0],[0,2],[2,0]]);S.tri(b,e,c,T.land,color,[[2,0],[0,2],[2,2]]);
 }
}
function pine(x,y,z,h=7,col='#637967'){
 S.cylinder(x,y+h*.26,z,h*.045,h*.024,h*.52,T.wood,'#75836c',5);
 S.cylinder(x,y+h*.53,z,h*.33,0,h*.72,T.cloth,col,7);
 S.cylinder(x,y+h*.76,z,h*.24,0,h*.65,T.cloth,col,7);
}
function townTree(x,z,h=5,y=0){
 S.cylinder(x,y+h*.32,z,.12,.08,h*.64,T.wood,'#8d8c6f',6);
 for(let i=0;i<3;i++){const a=i*2.1;S.beam([x,y+h*.46,z],[x+Math.sin(a)*h*.22,y+h*.75,z+Math.cos(a)*h*.22],.07,T.wood,'#8d8c6f');}
 S.sphere(x,y+h*.77,z,h*.32,h*.30,h*.30,T.cloth,'#a7a17b',3,7);
}
function roofHouse(x,z,w=10,d=9,h=7,col='#d2c4a5',yaw=0,y=0){
 S.push(x,y,z,yaw);S.box(0,h/2,0,w,h,d,T.paint,col,4);S.box(0,.18,0,w+.12,.36,d+.12,T.stone,'#b9bd9f',3);
 const facade=(width,depth,angle,color)=>{S.push(0,0,0,angle);S.quad([-width/2+.1,.35,depth/2+.018],[width/2-.1,.35,depth/2+.018],[width/2-.1,h-.22,depth/2+.018],[-width/2+.1,h-.22,depth/2+.018],T.town,color,width/5.5,(h-.57)/3.2);S.pop();};
 for(let side of [-1,1]){facade(w,d,side<0?PI:0,'#e4dbc0');facade(d,w,side<0?-PI/2:PI/2,'#d2cfb6');}
 S.plane(w*.18,1.42,d/2+.05,1.1,2.15,T.shutter,'#c6c9b1');S.box(w*.18,.20,d/2+.36,1.6,.25,.8,T.concrete,'#b4bfa7');
 S.box(w*.18,2.59,d/2+.38,1.8,.11,.85,T.roof,'#8ea494');S.box(-w*.4,1.3,d/2+.21,.55,.62,.4,T.paint,'#afbca7');
 S.box(w/2-.18,h/2,d/2+.055,.055,h,.065,T.paint,'#94a78f');
 const r=h+Math.min(w*.28,2.7);S.quad([-w/2-.45,h,d/2+.4],[0,r,d/2+.4],[0,r,-d/2-.4],[-w/2-.45,h,-d/2-.4],T.roof,'#80988c',w/2,3);
 S.quad([0,r,d/2+.4],[w/2+.45,h,d/2+.4],[w/2+.45,h,-d/2-.4],[0,r,-d/2-.4],T.roof,'#a5aaa0',w/2,3);
 S.tri([-w/2,h,d/2],[w/2,h,d/2],[0,r,d/2],T.wood,'#b0b397');S.tri([w/2,h,-d/2],[-w/2,h,-d/2],[0,r,-d/2],T.wood,'#b0b397');
 S.box(0,r+.025,0,.15,.12,d+.9,T.paint,'#768b80');
 S.box(w*.31,h+.6,-d*.15,.6,1.8,.6,T.paint,'#bdc0a5');
 S.box(-w*.2,h+.9,0,.035,2.2,.035,T.white,'#8b9d91');S.box(-w*.2,h+1.5,0,1.8,.032,.025,T.white,'#8b9d91');
 if(h>5){for(const xx of [-w*.25,w*.25]){S.box(xx,h*.53,d/2+.21,w*.32,.1,.53,T.concrete,'#bdc3ae');S.box(xx,h*.61,d/2+.42,w*.32,.055,.03,T.paint,'#7f9689');}}
 S.pop();
 if(x>-42&&x<172&&z>-166&&z<95)PORT_SCENERY.occluders.push({x,z,w:yaw?d:w,d:yaw?w:d,h:y+r});
}
function apartment(x,z,w,d,h,col='#c2c4b2'){
 S.box(x,h/2,z,w,h,d,T.paint,col,5);S.box(x,.4,z,w+.4,.8,d+.4,T.stone,'#a3af9f',4);
 S.box(x,h+.14,z,w+.45,.28,d+.45,T.concrete,'#b6c1ac',4);
 for(let side of [-1,1]){
  S.push(x,0,z,side===-1?PI:0);S.quad([-w/2+.3,1.3,d/2+.02],[w/2-.3,1.3,d/2+.02],[w/2-.3,h-.4,d/2+.02],[-w/2+.3,h-.4,d/2+.02],T.city,'#e2dfca',Math.max(1,w/12),(h-1.7)/12);S.pop();
  S.push(x,0,z,side===-1?-PI/2:PI/2);S.quad([-d/2+.3,1.3,w/2+.02],[d/2-.3,1.3,w/2+.02],[d/2-.3,h-.4,w/2+.02],[-d/2+.3,h-.4,w/2+.02],T.city,'#d2d9c6',Math.max(1,d/12),(h-1.7)/12);S.pop();
 }
 S.box(x-w*.22,h+.7,z,3,1.25,2.6,T.metal,'#9daa98');S.cylinder(x+w*.24,h+1.2,z-d*.2,1.25,1.25,2.3,T.paint,'#a3b1a2',8);
}
function fenceLine(x1,z1,x2,z2,height=2.2){
 const len=Math.hypot(x2-x1,z2-z1),count=Math.ceil(len/5),yaw=Math.atan2(-(z2-z1),x2-x1);
 S.push((x1+x2)/2,0,(z1+z2)/2,yaw);
 S.quad([-len/2,.16,0],[len/2,.16,0],[len/2,height,0],[-len/2,height,0],T.fence,'#cad3be',len/2,(height-.16)/2);
 for(let i=0;i<=count;i++)S.box(-len/2+i*len/count,height/2,0,.055,height,.055,T.paint,'#849b89');
 S.box(0,height,0,len,.048,.048,T.paint,'#a2ae98');S.box(0,.24,0,len,.035,.035,T.paint,'#92a18d');S.pop();
}
function quayEdge(x,z1,z2){
 S.box(x,-1.05,(z1+z2)/2,.8,2.0,Math.abs(z2-z1),T.stone,'#97a396',4);
 S.box(x,.06,(z1+z2)/2,1.1,.12,Math.abs(z2-z1),T.concrete,'#c0c3a8',4);
 for(let z=Math.min(z1,z2)+4;z<Math.max(z1,z2);z+=14){S.cylinder(x-.36,-.34,z,.46,.46,.28,T.cloth,'#3d5350',8);S.box(x+.7,.4,z,.27,.8,.25,T.paint,'#718b7a');}
}
function harbourLamp(x,z,y=0){
 S.box(x,y+3.65,z,.1,7.3,.1,T.paint,'#71867a');S.beam([x,y+7.1,z],[x+1.3,y+7.1,z],.075,T.paint,'#889881');S.box(x+1.25,y+7.06,z,.63,.13,.32,T.paint,'#738c7b');
 S.box(x+1.25,y+6.98,z,.51,.02,.27,T.white,'#e8d6a0',0,1);
}
function backgroundGantry(x,z,w=18,h=29){
 S.push(x,0,z);for(let a of [-1,1])for(let b of [-1,1]){S.beam([a*w/2,0,b*3],[a*w*.38,h,b*2.3],.43,T.paint,'#7d9c90');for(let k=2;k<h-5;k+=7)S.beam([a*w*.48,k,-2.8],[a*w*.4,k+7,2.3],.13,T.paint,'#91a89b');}
 S.box(0,h,0,w+.6,1.3,6,T.metal,'#91afa0');S.box(-w/2-11,h+1,0,26,.65,3,T.paint,'#a1b29f');S.box(-w/2-11,h+3,0,26,.35,3,T.paint,'#a1b29f');
 for(let i=0;i<9;i++)S.beam([-w/2+1-i*3,h+1,1.4],[-w/2-2-i*3,h+3,1.4],.14,T.paint,'#97aa98');
 S.beam([-w/2-19,h+1,0],[-w/2-19,8,0],.04,T.white,'#5d7772');S.box(-w/2-19,7.8,0,2.1,.4,1.2,T.paint,'#ae9870');
 S.box(-w*.35,h-1.3,3,3,2.1,2,T.paint,'#acbfab');S.plane(-w*.35,h-1.1,4.02,2.5,1.1,T.windows);S.pop();
}
function lighthouseModel(x,y,z,scale=1){
 S.push(x,y,z).scale(scale);S.cylinder(0,.5,0,3.2,3,.8,T.stone,'#b6b39a',12);S.cylinder(0,5,0,1.7,1.25,9,T.paint,'#dcd5b6',12);S.cylinder(0,6.7,0,1.42,1.32,2.1,T.paint,'#a05d48',12);
 S.cylinder(0,9.55,0,2.05,2.05,.32,T.paint,'#91a698',12);S.cylinder(0,10.8,0,1.17,1.17,2.2,T.glass,'#c4ccba',12);S.cylinder(0,12.05,0,1.62,0,1.0,T.paint,'#5d827d',12);
 for(let i=0;i<12;i++){const a=i*TAU/12;S.box(Math.cos(a)*1.88,10.15,Math.sin(a)*1.88,.045,1,.045,T.paint,'#b3c1a8');const j=(i+1)*TAU/12;S.beam([Math.cos(a)*1.88,10.62,Math.sin(a)*1.88],[Math.cos(j)*1.88,10.62,Math.sin(j)*1.88],.04,T.paint,'#b3c1a8');}
 S.plane(0,1.7,1.62,1.1,2.2,T.shutter);S.pop();
}
function makeSurroundings(){
 const savedSeed=seed;seed=621810;sceneryTextures();
 sceneryChunk('Open sea and connected mainland',()=>{
  S.quad([-3000,-.76,3000],[3000,-.76,3000],[3000,-.76,-3000],[-3000,-.76,-3000],T.water,'#b1c1b6',200,200,2);
  // These ground skirts overlap the quay below its walking surface.
  S.box(229,-.42,-42,524,.52,510,T.land,'#b7b6a0',14);
  S.box(90,-.44,76,246,.62,81,T.concrete,'#babfa8',5);
  S.box(85,-.43,-185,236,.6,83,T.concrete,'#aeb9a6',6);
  quayEdge(-33.15,-297,205);
  S.box(265,-.45,362,592,.5,512,T.land,'#a5b39a',20);
  S.box(162,-.43,-283,174,.62,103,T.land,'#a5b39a',12);
 });
 sceneryChunk('Eastern wooded hills',()=>{
  const h=(x,z)=>{const u=clamp((x-210)/160,0,1),e=Math.exp(-Math.pow((x-520)/360,2));return -.14+u*(17+e*(57+32*Math.sin(z*.006+.6)+22*Math.cos(z*.013)) + Math.sin(x*.024+z*.015)*5);};
  terrainGrid(206,-1050,920,1720,41,64,h,'#93a48b');
  for(let i=0;i<190;i++){let x=235+rand()*390,z=-630+rand()*1000;pine(x,h(x,z),z,5+rand()*11,['#788e79','#809581','#6c8779'][i%3]);}
 });
 sceneryChunk('Southern headland',()=>{
  const h=(x,z)=>{const u=clamp((z-163)/135,0,1),coast=clamp((x+33)/70,0,1);return -.13+coast*u*(23+Math.sin(x*.015+z*.005)*20+Math.exp(-Math.pow((z-410)/235,2))*62+Math.cos(z*.026+x*.015)*5);};
  terrainGrid(-33,163,720,1000,35,43,h,'#94a38c');
  for(let i=0;i<100;i++){let x=-10+rand()*420,z=195+rand()*245;pine(x,h(x,z),z,5+rand()*10,'#728b79');}
 });
 const westCoast=z=>-460-25*Math.sin(z*.006)-21*Math.cos(z*.013);
 sceneryChunk('Opposite shore and wooded ridge',()=>{
  const nz=65,nx=25;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
   const p=(a,b)=>{let z=-910+b*1730/nz,u=a/nx,x=westCoast(z)-u*630,y=-.08+Math.pow(u,.64)*(16+Math.sin(z*.006)*11+Math.sin(u*3.6)*105)+Math.sin(z*.023+u*20)*u*6;return[x,y,z];};
   const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);S.tri(a,d,b,T.land,'#8fa291');S.tri(b,d,c,T.land,'#93a18c');
  }
  for(let i=0;i<115;i++){const z=-530+rand()*850,x=westCoast(z)-20-rand()*90,u=(westCoast(z)-x)/630,y=-.08+Math.pow(u,.64)*(16+Math.sin(z*.006)*11+Math.sin(u*3.6)*105)+Math.sin(z*.023+u*20)*u*6;pine(x,y,z,7+rand()*9,'#7e9584');}
 });
 sceneryChunk('Northern mountain ridge',()=>{
  const h=(x,z)=>{const u=clamp((-z-365)/180,0,1);return -1+u*(26+Math.sin(x*.006)*27+Math.exp(-Math.pow((z+660)/360,2))*(72+Math.cos(x*.014)*22)+Math.sin(z*.025+x*.012)*5);};
  terrainGrid(-1130,-1320,2220,960,75,31,h,'#8caaa0');
 });
 sceneryChunk('Port road and the old town',()=>{
  road(1,72,16,71);road(94,103,205,13);road(137,-47,12,310);
  // Sidewalks, stone walls, and gardens continue away from the gate.
  for(let x of [-8.5,10.5])S.box(x,.07,73,2.4,.15,65,T.concrete,'#c7c4a8',4);
  for(let x of [-18,23,44,68,92,112,159]){
   const z=x<35?62:59+(x%3)*2,w=x===159?16:13,d=x<35?18:14,h=x===44?10:6+(x%5)*.6;
   roofHouse(x,z,w,d,h,['#d6ccaf','#b6bdaf','#c4b69e'][Math.abs(x)%3]);
   S.box(x,.48,z-d/2-3,w+2,.96,.6,T.stone,'#aebb9e',3);
  }
  for(const [x,z,w,d,h] of [[-21,87,13,12,8],[24,85,15,14,11],[53,87,14,12,7],[86,87,17,15,8],[112,83,15,12,6],[15,128,17,18,10],[48,128,17,14,7],[80,136,19,19,12],[117,138,15,14,7]])roofHouse(x,z,w,d,h,'#c4c4aa');
  apartment(162,102,23,18,24,'#bcbcac');apartment(194,130,22,21,32,'#c2c2ac');apartment(134,179,29,21,23,'#c8c4ac');apartment(205,62,22,18,20,'#adbcaf');
  // Low shop fronts face the road. The street remains scenery, not a false exit.
  label(23,4,52.97,10,1.0,T.cityRoad,PI);label(44,4,51.96,10,.8,T.market,PI);
  for(let z of [46,77,106,138]){harbourLamp(-9.9,z);pole(11,z);if(z<138)cable([11,10.5,z],[11,10.5,z+31],.9);}
  label(-9.8,4.8,41.1,4.4,1.1,T.cityRoad,PI);box(-9.8,2.4,41,.07,4.8,.07,T.paint,'#869a85');
  for(let [x,z] of [[39,43],[74,42],[99,43],[32,106],[64,109],[101,111],[124,67],[-23,110]])townTree(x,z,5.2+(x%3));
  S.box(1,1.04,35.8,18,.15,.14,T.hazard,'#e5cc86');for(let x of [-8,10])S.box(x,.62,35.8,.25,1.24,.25,T.paint,'#9aa58e');
  fenceLine(-31.7,35.9,-9.1,35.9,1.55);fenceLine(34.8,35.9,116.7,35.9,1.8);
 });
 sceneryChunk('Railway and eastern neighbourhood',()=>{
  S.box(124,-.05,-64,14,.12,286,T.stone,'#9aa18c',4);
  for(let x of [119.5,125])for(let a of [-.78,.78])S.box(x+a,.13,-64,.09,.09,282,T.white,'#8b9c92');
  for(let z=-204;z<77;z+=2.2)for(let x of [119.5,125])S.box(x,.045,z,2.35,.09,.18,T.wood,'#7c8570');
  S.box(133.4,.52,-58,.64,1.04,302,T.stone,'#adb7a0',3);
  for(let z of [-133,-102,-69,-35,1,33]){
   roofHouse(154,z,15,20,7+(Math.abs(z)%4),'#c6c6ac',PI/2);
   if(z!==33)roofHouse(179,z+8,13,17,6+(Math.abs(z)%3),'#c4bfa2',PI/2);
   townTree(134.8,z+12,5.4);pole(132,z);if(z<1)cable([132,10.5,z],[132,10.5,z+34],1.05);
  }
  apartment(212,-94,23,26,22);apartment(201,-41,25,18,28,'#aebead');apartment(229,5,24,21,34,'#bdc9b4');
  fenceLine(116.65,-142,116.65,35.6,2.15);
  for(let z of [-32,-75,-119])label(116.58,1.2,z,2.4,.48,T.safety,-PI/2);
 });
 sceneryChunk('North freight district',()=>{
  road(75,-153,210,13);warehouse(24,-188,6,38,29,10);warehouse(82,-188,14,35,32,11);
  for(let x of [-21,-8,12,26,47,62,92])for(let z of [-216,-229]){containerCargo(x,0,z,['#719397','#aa8d69','#927b64','#859c83'][Math.floor(rand()*4)]);if(rand()>.4)containerCargo(x,2.65,z,'#879c8d');}
  backgroundGantry(-13,-220,18,29);backgroundGantry(47,-235,20,31);
  for(let x of [145,168,192])for(let z of [-170,-204]){S.cylinder(x,5.5,z,9,9,11,T.paint,'#b9c3b0',16);S.cylinder(x,11.1,z,9.1,8.6,.4,T.paint,'#cdd0b5',16);S.cylinder(x,6.8,z,9.03,9.03,.28,T.paint,'#6e9290',16);S.box(x+9.2,5.5,z,.07,11,.08,T.white,'#92a99a');for(let y=1;y<11;y++)S.box(x+9.2,y,z,.06,.045,1,T.white,'#92a99a');}
  S.box(229,6,-200,28,12,42,T.metal,'#a4b5a6',5);S.box(217,15,-204,15,10,21,T.paint,'#a6b4a3');
  for(let [x,z,h] of [[229,-214,50],[245,-193,40]]){S.cylinder(x,h/2,z,1.65,1.15,h,T.concrete,'#b6baa4',12);for(let y=h-14;y<h-3;y+=6)S.cylinder(x,y,z,1.28,1.25,3,T.paint,'#a47662',12);}
  for(let x of [143,167,193]){S.beam([x,2.4,-185],[x,2.4,-216],.35,T.paint,'#8da899');S.beam([x,2.4,-216],[215,2.4,-216],.35,T.paint,'#8da899');}
  fenceLine(-31.5,-143.8,116.6,-143.8,2.1);
  for(let x of [1,47,80,115])harbourLamp(x,-147);
 });
 sceneryChunk('Fishing village across the bay',()=>{
  for(let i=0;i<33;i++){
   const z=-380+i*18,x=westCoast(z)-19-(i%3)*7,y=3+(i%3)*2;
   S.box(x-10,y*.5-.3,z,37,y+.6,19,T.stone,'#a9b29a',4);roofHouse(x,z,10+(i%3)*2,10,5+(i%2)*2,['#c6c3a5','#bac4b1','#c3b59e'][i%3],PI/2,y);
   if(i%3===0){S.box(x+25,-.1,z,32,.6,4,T.wood,'#a3ad91',3);S.box(x+25,.4,z+1.7,32,.06,.05,T.paint,'#a4b99f');}
  }
  for(let i=0;i<8;i++){const z=-305+i*64;roofHouse(westCoast(z)-73,z,14,14,8,'#bdc4ae',PI/2,22);}
  apartment(-537,-227,25,25,29,'#b5c1af');apartment(-525,95,20,20,24,'#b4c0ab');
 });
 sceneryChunk('North crossing bridge',()=>{
  const z=-319,left=-510,right=110,deck=24;S.box((left+right)/2,deck,z,right-left,1.1,12,T.concrete,'#afbaa9',7);
  S.box(-527,24,z,36,1.1,12,T.concrete,'#afbaa9',7);S.box(-516,11.5,z,9,23,17,T.stone,'#9cab97',4);
  S.quad([110,24.55,z+6],[245,.03,z+6],[245,.03,z-6],[110,24.55,z-6],T.asphalt,'#a8b4a3',15,2);
  for(let side of [-1,1]){S.tri([110,-.2,z+side*6],[245,-.2,z+side*6],[110,24.55,z+side*6],T.stone,'#a7b39d',[[0,4],[18,4],[0,0]]);S.beam([110,25.4,z+side*6],[245,.9,z+side*6],.14,T.paint,'#9eb5a3');}
  S.box(245,.03,z,24,.12,12,T.asphalt,'#a8b4a3',4);
  for(let x=left+5;x<right;x+=40){S.box(x,11.7,z,2.3,24,5.5,T.concrete,'#abb5a5',4);S.box(x,deck+.9,z+5.7,.055,1.5,.055,T.paint,'#a9bbaa');S.beam([x,deck+1.7,z+5.7],[x+40,deck+1.7,z+5.7],.07,T.paint,'#b6c4af');}
  const towers=[-352,-143];for(let x of towers){for(let s of [-1,1]){S.box(x,34,z+s*7,2.4,68,2.2,T.paint,'#779890');S.box(x,1.5,z+s*7,7,4,8,T.stone,'#a9b39f');}for(let y of [29,55,66])S.box(x,y,z,2,1.3,16,T.paint,'#97b1a1');}
  const spans=[[-510,25,-352,67],[-352,67,-143,67],[-143,67,110,25]];
  for(let side of [-1,1])for(let [a,ha,b,hb] of spans){const steps=25,pts=[];for(let i=0;i<=steps;i++){let t=i/steps,y=mix(ha,hb,t)-Math.sin(t*PI)*(ha===hb?34:13);pts.push([mix(a,b,t),y,z+side*7]);if(i%2===0&&y>deck)S.beam([mix(a,b,t),deck,z+side*5.7],[mix(a,b,t),y,z+side*7],.045,T.white,'#b4c4b4');}for(let i=0;i<steps;i++)S.beam(pts[i],pts[i+1],.16,T.paint,'#a5bdae');}
 });
 sceneryChunk('Breakwater island and harbour lights',()=>{
  const x=-185,z=91;const h=(px,pz)=>{const u=Math.hypot((px-x)/42,(pz-z)/27);return -.9+Math.max(0,1-u*u)*(5.1+Math.sin(px*.22)*.5);};
  terrainGrid(x-43,z-29,86,58,15,10,h,'#a1aa8e');lighthouseModel(x,4.3,z,1.3);
  for(let i=0;i<35;i++){let a=i*TAU/35;S.sphere(x+Math.cos(a)*37,-.15,z+Math.sin(a)*24,2.7,1.5,2,T.stone,'#a7ae97',3,6);}
  S.box(-114,-.13,153,167,1.2,5,T.stone,'#96a692',5);S.box(-114,.56,153,167,.18,5.4,T.concrete,'#bdc3a8',4);
  for(let x=-196;x<-35;x+=9){S.cylinder(x,.89,153,.21,.22,.62,T.paint,'#678b79',8);S.box(x,-.1,149.8,2,1.7,1.6,T.stone,'#95a795');}
  lighthouseModel(-39,.65,153,.58);
 });
 // Physical map edges share the foreground shadow map. They do not close any road inside the map.
 const keep=S;S=new MeshBuilder();
 for(let z=-139;z<35;z+=10){S.box(-33.2,-.62,z,.42,1.24,10.1,T.stone,'#8fa18f',3);}
 const near=S.a;S=keep;S.append(near);seed=savedSeed;
}
function sceneryCar(b,x,y,z,yaw,color='#b6c4ae',bus=false){
 b.push(x,y,z,yaw);const len=bus?8.7:3.8,w=bus?2.45:1.6;
 b.box(0,.8,0,w,bus?1.25:.7,len,T.paint,color);b.box(0,bus?1.85:1.3,bus?0:.08,w*.94,bus?1.08:.62,len*.72,T.paint,bus?'#d0d5bd':color);
 b.plane(0,bus?1.9:1.38,-len*.361,w*.84,bus?.70:.42,T.glass,'#c7d6cd',PI);
 for(let side of [-1,1])b.plane(side*(w*.471+.01),bus?1.9:1.38,0,len*.68,bus?.7:.42,T.windows,'#cad6c9',side>0?PI/2:-PI/2);
 for(let side of [-1,1])for(let dz of [-len*.31,len*.31]){b.push(side*w*.48,.40,dz).rotateZ(PI/2);b.cylinder(0,0,0,bus?.47:.31,bus?.47:.31,.17,T.white,'#3f5451',8);b.pop();}
 b.box(0,.41,0,w+.08,.14,len+.10,T.paint,'#99aea0');if(bus)b.box(0,.8,0,w+.015,.22,len+.012,T.paint,'#5f8580');b.pop();
}
function sceneryShip(b,x,z,yaw,kind=0,t=0){
 b.push(x,-.48+Math.sin(t*.37)*.07,z,yaw);
 const ferry=kind===1,small=kind===2,w=small?3.3:ferry?8:9.5,d=small?10:ferry?32:47;
 b.taper(0,1.2,0,w*.75,w,2.6,d*.83,d,T.paint,ferry?'#c4cbb6':small?'#9c8160':'#556f77');b.box(0,2.58,0,w,.22,d,T.paint,'#a3b5a1');
 if(ferry){for(let j=0;j<2;j++){b.box(0,3.5+j*1.7,2,w*.85,1.6,d*.78,T.paint,'#dce0c6');for(let side of [-1,1])b.plane(side*(w*.426+.018),3.7+j*1.7,2,d*.73,.85,T.windows,'#e1e8d2',side<0?-PI/2:PI/2);}b.box(0,6.1,2,w*.91,.19,d*.80,T.paint,'#779790');b.cylinder(0,7.1,7,.8,.8,2.1,T.paint,'#aa6f54',10);}
 else if(small){b.box(0,3,1,2.5,1.5,3,T.paint,'#d4d5b7');b.plane(0,3.1,-.52,2,.7,T.windows,'#dbe3cd',PI);b.beam([0,3,-2],[0,7,-2],.075,T.white,'#a6bba5');}
 else{b.box(0,4.2,15,w*.82,3.1,9,T.paint,'#d2d6bd');b.box(0,6.4,16,w*.76,1.2,7,T.paint,'#d5dac3');b.plane(0,6.5,12.48,w*.7,.75,T.windows,'#e0e8d4',PI);b.cylinder(0,8,17,.9,.9,2,T.paint,'#a06b50',10);
  for(let j=0;j<4;j++)for(let side of [-1,1])b.box(side*2.2,3.85,-16+j*7,4,2.4,6,T.metal,['#a79270','#6c9091','#8f9c7f','#ab826c'][j],2);
  for(let side of [-1,1])b.plane(side*(w*.5+.03),1.8,10,8,1,T.shipName,'#e1debf',side<0?-PI/2:PI/2);
 }
 // A low-contrast wake lies on the sea, not on the sky.
 for(let i=0;i<5;i++){const yy=-.225-i*.002,zz=d/2+i*3.7,ww=w/2+i*1.7,c=['#829f9c','#789995','#70938f','#6c8f8b','#658b88'][i];b.beam([-ww,yy,zz],[0,yy,zz+3],.08,T.white,c,.32);b.beam([ww,yy,zz],[0,yy,zz+3],.08,T.white,c,.32);}
 b.pop();
}
function distantLife(b){
 const t=sceneryClock;
 const a=t*.0027;
 sceneryShip(b,-285+Math.sin(a)*45,-69+Math.cos(a)*170,Math.atan2(-Math.cos(a)*45,Math.sin(a)*170),0,t);
 const f=t*.0035+1.6;
 sceneryShip(b,-327+Math.cos(f)*38,20+Math.sin(f)*245,Math.atan2(Math.sin(f)*38,-Math.cos(f)*245),1,t+2);
 sceneryShip(b,-89,85,-.6,2,t);
 sceneryCar(b,3,.08,70+Math.sin(t*.021)*22,Math.cos(t*.021)>0?PI:0,'#cdc4a7',true);
 sceneryCar(b,137,.04,-59+Math.sin(t*.019)*112,Math.cos(t*.019)>0?PI:0,'#b58568');
 sceneryCar(b,-205+Math.sin(t*.013+1)*290,24.56,-321,Math.cos(t*.013+1)>0?-PI/2:PI/2,'#bbbcab');
 sceneryCar(b,-240+Math.sin(t*.021)*180,24.56,-317,Math.cos(t*.021)>0?-PI/2:PI/2,'#9ea994',true);
 // Mooring buoys and light lenses have gentle movement. No new network audio.
 for(let i=0;i<7;i++){const x=-91-i*43,z=175-i*30,y=-.22+Math.sin(t*.7+i)*.10;b.cylinder(x,y,z,.9,.43,1.1,T.paint,i%2?'#668f7d':'#aa7761',8);b.box(x,y+1.03,z,.09,1.5,.09,T.paint,'#c2c9aa');b.box(x,y+1.86,z,.24,.2,.24,T.white,i%2?'#aaceb1':'#e1ac77',0,1);}
 const pulse=.68+Math.pow(Math.max(0,Math.cos(t*.6)),9)*.32;
 b.sphere(-185,18.38,91,.55,.73,.55,T.white,[.92*pulse,.82*pulse,.53*pulse],4,8);
}
makeSurroundings();
// Background chunks are uploaded once as separate meshes (three.js culls each one); they skip the shadow pass.
const sceneryCameraCollision=cameraCollision;
cameraCollision=function(eye,target){
 const ray=sub(eye,target);let fraction=1;
 for(const o of PORT_SCENERY.occluders){
  let near=0,far=1;const lo=[o.x-o.w/2-.24,-.3,o.z-o.d/2-.24],hi=[o.x+o.w/2+.24,o.h+.25,o.z+o.d/2+.24];
  for(let i=0;i<3;i++){if(Math.abs(ray[i])<.00001){if(target[i]<lo[i]||target[i]>hi[i]){far=-1;break;}}else{let a=(lo[i]-target[i])/ray[i],b=(hi[i]-target[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}}
  if(near<=far&&near>=0&&near<1)fraction=Math.min(fraction,Math.max(.12,near-.045));
 }
 let out=sceneryCameraCollision(add(target,mul(ray,fraction)),target);out[1]=Math.max(.40,out[1]);return out;
};
const sceneryExtraWorld=extraWorldDynamics;
extraWorldDynamics=function(b){sceneryExtraWorld(b);distantLife(b);};
const sceneryUpdate=update;
update=function(dt){if(!['menu','book','modal','workboard','collection','capsule'].includes(mode)&&!options.reducedMotion)sceneryClock+=dt;sceneryUpdate(dt);};
const sceneryBoot=boot;
boot=function(){sceneryBoot();if(!renderer||!gameRunning)return;renderer.setSurroundings(PORT_SCENERY.chunks);window.ShamMue.version=PORT_SCENERY.version;
 const base=window.ShamMue.getState;window.ShamMue.getState=()=>({...base(),scenery:{version:PORT_SCENERY.version,chunks:PORT_SCENERY.chunks.length,vertices:PORT_SCENERY.vertices,coverage:'360-degree coast, town, hills, and open sea'}});
};
// The title views show both the playable docks and the coast beyond them.
MENU_VIEWS[0]={name:'East quay',eye:[-13,5.8,32.3],target:[-5,3,-55]};
MENU_VIEWS[1]={name:'North yard',eye:[31,12,-48],target:[-20,6,-144]};
MENU_VIEWS[2]={name:'Market and town',eye:[66,6,27],target:[144,9,42]};
MENU_VIEWS[3]={name:'Bay and lighthouse',eye:[-22,5.4,18],target:[-193,6.4,49]};

/* -------------------------------------------------------------------------
   HARBOUR DAYS / 3.0 — the sparring record, and Nobu, who sets it up.
   ------------------------------------------------------------------------- */
const sparBaseFresh=freshState;
freshState=function(){sparBaseFresh();G.sparStats={wins:0,best:0,runs:0};spar=null;};
const sparBaseLoad=loadState;
loadState=function(s){sparBaseLoad(s);const sp=s&&s.sparStats&&typeof s.sparStats==='object'?s.sparStats:{};G.sparStats={wins:Math.floor(safeNumber(sp.wins,0,0,99999)),best:safeNumber(sp.best,0,0,1e7),runs:Math.floor(safeNumber(sp.runs,0,0,99999))};};
const sparBaseChoosePerson=choosePerson;
choosePerson=function(a){if(a.id==='sailor'&&(G.battleWon||G.stage>=6||menuSession==='practice')){talk([{n:'Nobu',t:G.sparStats?.wins?'Back for more? Goro says you still drop your guard after a kick.':'You handled those two in the loading yard. The crew spars there after the shift, if you want the practice.'}],null,a,[{text:'Spar with the dock crew.',fn:()=>startSpar()},{text:'About the blue ship?',fn:()=>talk([{n:'Nobu',t:'The blue ship leaves tomorrow. Whatever went through Warehouse 08 is already on its way.'},{n:'Jun',t:'I see.'}],null,a)},{text:'Not today.',fn:()=>{}}]);return;}sparBaseChoosePerson(a);};

/* -------------------------------------------------------------------------
   Input. Every control is a kit.input action (keyboard and mouse, gamepad and
   touch; see the action list at the top). Gameplay keeps its own vocabulary:
   held actions become keys.Space, keys.KeyQ… and presses become onPress(code)
   in the mode that needs them. The game's DOM menus, the notebook, dialogue
   answers, the work board, pop-ups and the ending are driven by the same
   actions, so a gamepad or keyboard reaches everything a mouse can.
   ------------------------------------------------------------------------- */
const input=kit.input;
let navDir='',navHold=0,dirPrev='';
function navDirection(){const v=input.vector('move');if(Math.abs(v.y)>=Math.abs(v.x)){if(v.y>.55)return 'up';if(v.y<-.55)return 'down';}if(v.x>.55)return 'right';if(v.x<-.55)return 'left';return '';}
// A menu step on a new direction, then repeats while it is held.
function navStep(dt){const d=navDirection();let fire='';if(d&&d!==navDir){fire=d;navHold=.36;}else if(d){navHold-=dt;if(navHold<=0){fire=d;navHold=.14;}}navDir=d;return fire;}
function stepFocus(root,dir,start=null){const list=menuFocusable(root);if(!list.length)return null;const at=list.indexOf(document.activeElement);const el=at<0?(start&&list.includes(start)?start:list[dir>0?0:list.length-1]):list[(at+dir+list.length)%list.length];menuFocus(el);return el;}
// Confirm the focused control; a focused slider or list is left alone (left / right change it).
function clickFocus(root,fallback){const el=document.activeElement;if(el&&el!==document.body&&root.contains(el)){if(el instanceof HTMLSelectElement||(el instanceof HTMLInputElement&&el.type==='range'))return true;if(typeof el.click==='function'){el.click();return true;}}const f=typeof fallback==='function'?fallback():fallback;if(f){f.click();return true;}return false;}
// Left / right on a focused slider or list changes it (a gamepad has no other way to).
function adjustField(el,inc){if(el instanceof HTMLInputElement&&el.type==='range'){el.value=String(clamp(Number(el.value)+inc*Number(el.step||.05),Number(el.min),Number(el.max)));el.dispatchEvent(new Event('input',{bubbles:true}));return true;}if(el instanceof HTMLSelectElement){el.selectedIndex=clamp(el.selectedIndex+inc,0,el.options.length-1);el.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;}
function cycleBookTab(dir){const tabs=[...document.querySelectorAll('.bookTabs [data-tab]')].map(b=>b.dataset.tab);if(!tabs.length)return;const at=Math.max(0,tabs.indexOf(currentTab));sound.sfx('click');renderBook(tabs[(at+dir+tabs.length)%tabs.length]);document.querySelector('.bookTabs button.active')?.focus({preventScroll:true});}
function scrollWith(el,lk){if(el&&lk.y)el.scrollTop+=lk.y*260;}
// The kit reports look in radians (mouse 0.0024 and touch 0.0055 per pixel, the stick 2.6 rad/s).
// These gains restore the original feel: 0.0055 rad per dragged pixel for mouse and touch alike,
// about 2 rad/s on the stick, and 0.013 rad per pixel when turning a figure.
function lookGain(){const s=input.source;return s==='touch'?1:s==='gamepad'?.78:2.3;}
function turnGain(){const s=input.source;return s==='touch'?2.36:s==='gamepad'?1.1:5.4;}
function toggleMute(){sound.init();options.muted=!options.muted;persistOptions();if(started)toast('SOUND',options.muted?'Muted':'Sound on',(prompts.mute||'')+'');}
function menuInput(nav){const P=n=>input.pressed(n);
 if(P('pause')){if(menuState.origin==='pause'&&!menuState.confirm)menuResume();else menuBack();return;}
 if(P('back')){menuBack();return;}
 if(P('notebook')){const all=menuFocusable(),at=all.indexOf(document.activeElement);if(all.length)menuFocus(all[at<0?0:(at+(input.down('run')?-1:1)+all.length)%all.length]);return;}
 if(nav){const el=document.activeElement,side=nav==='left'||nav==='right';if(side&&adjustField(el,nav==='right'?1:-1))return;menuNavigate(nav==='up'||nav==='left'?-1:1,side);return;}
 if(P('use')||P('guard')){if(!clickFocus($('titleScreen')))(menuState.confirm?$('menuCancel'):$('menuContent').querySelector('.primaryAction,button'))?.click();return;}
 scrollWith($('menuContent'),input.look('look'));}
function pumpInput(dt){
 const P=n=>input.pressed(n),D=n=>input.down(n),combat=mode==='combat';
 // Held controls, in the game's own words.
 keys.Space=D('guard');keys.ShiftLeft=D('run')&&!combat;keys.KeyQ=D('forkUp');keys.KeyZ=D('forkDown');
 keys.KeyJ=combat&&(D('punch')||D('padX')||D('use'));keys.KeyK=combat&&(D('kick')||D('padY'));
 const mv=input.vector('move');keys.KeyA=mv.x<-.5;keys.KeyD=mv.x>.5;
 const dir=navDirection(),fresh=dir&&dir!==dirPrev?dir:'';dirPrev=dir;const nav=navStep(dt);
 if(P('full')){if(menuIsOpen())menuDo('fullscreen');else toggleFullscreen();}
 if(P('mute')){if(menuIsOpen())menuDo('mute');else toggleMute();}
 if(menuIsOpen()){menuInput(nav);return;}
 // The walking, driving and fighting cameras turn with drag, the right stick or a touch drag; wheel and pinch zoom.
 if(mode==='roam'||mode==='forklift'||combat){const lk=input.look('look');if(lk.x||lk.y){const g=lookGain()*options.cameraSpeed;camYaw-=lk.x*g;camPitch=clamp(camPitch+lk.y*g*.64*(options.invertLook?-1:1),-.4,.8);camManual=worldTime+4;}const z=input.zoom();if(z&&mode!=='forklift')camZoom=clamp(camZoom-z*.4,3.1,8.7);}
 switch(mode){
  case 'roam':
   if(P('pause'))pauseGame();else if(P('use'))onPress('KeyE');else if(P('notebook')||P('sheet'))openBook();else if(P('camera'))onPress('KeyC');else if(P('horn'))openBook('controls');
   break;
  case 'forklift':
   if(P('pause'))pauseGame();else if(P('use'))onPress('KeyE');else if(P('exit')||P('padX'))onPress('KeyX');else if(P('recover')||P('padY'))onPress('KeyR');else if(P('punch')||P('sheet'))onPress('KeyJ');else if(P('camera'))onPress('KeyC');else if(P('horn'))onPress('KeyH');else if(P('notebook'))openBook();
   break;
  case 'combat':
   if(P('pause'))pauseGame();else if(P('evade')||P('run'))evade();else if(P('camera'))onPress('KeyC');else if(P('notebook')||P('sheet'))openBook();
   break;
  case 'dialogue':
   if(P('pause')){pauseGame();break;}
   for(let i=1;i<=4;i++)if(P('choice'+i)){chooseDialogue(i-1);return;}
   if(dialogue?.choiceBuilt){const box=$('choices');if(nav)stepFocus(box,nav==='up'||nav==='left'?-1:1);else if((P('use')||P('guard'))&&worldTime-(dialogue.choiceAt||0)>.3){if(box.contains(document.activeElement))document.activeElement.click();else stepFocus(box,1);}}
   else if(P('use')||P('guard'))advanceTalk();
   break;
  case 'qte':
   if(P('pause'))pauseGame();else if(fresh==='up')qtePress('KeyW');else if(fresh==='right')qtePress('KeyD');else if(P('guard')||(P('use')&&input.source==='gamepad'))qtePress('Space');
   break;
  case 'darts':
   if(P('pause')||P('back'))leaveDarts();else if(P('use')||P('guard'))throwDart();
   break;
  case 'book':{
   const book=$('bookOverlay'),active=document.querySelector('.bookTabs button.active');
   if(P('pause')||P('back')||P('notebook')||P('sheet'))closeBook();
   else if(nav==='left'||nav==='right'){if(!adjustField(document.activeElement,nav==='right'?1:-1))cycleBookTab(nav==='right'?1:-1);}
   else if(nav){if(!book.contains(document.activeElement)||document.activeElement===book)menuFocus(active);else stepFocus(book,nav==='up'?-1:1,active);}
   else if(P('use'))clickFocus(book);
   scrollWith($('bookBody'),input.look('look'));
   break;}
  case 'modal':
   if(nav)menuAuxNavigate(nav==='up'||nav==='left'?-1:1);else if(P('notebook'))menuAuxNavigate(input.down('run')?-1:1);else if(P('use')||P('guard'))clickFocus($('modal'),()=>$('modalActions').querySelector('button'));else if(P('pause')||P('back'))onPress('Escape');
   scrollWith($('modal').querySelector('.panel'),input.look('look'));
   break;
  case 'workboard':
   if(nav)menuAuxNavigate(nav==='up'||nav==='left'?-1:1);else if(P('use')||P('guard'))clickFocus($('workBoard'),()=>menuFocusable($('workBoard'))[0]);else if(P('pause')||P('back')||P('notebook'))closeWorkBoard();
   scrollWith($('workBoard').querySelector('.workSheet'),input.look('look'));
   break;
  case 'ending':
   if(nav)stepFocus($('ending'),nav==='up'||nav==='left'?-1:1,$('stayBtn'));else if(P('use')||P('guard'))clickFocus($('ending'),$('stayBtn'));
   break;
  case 'capsule':{
   const cs=capsuleScene;if(!cs)break;
   if(P('pause'))pauseGame();else if(cs.shot<6&&(P('use')||P('guard')||P('back')))skipCapsule();else if(cs.shot===6&&P('use'))capsuleConfirm();else if(P('punch')||P('padX')){cs.turn+=.5;cs.manual=4;}else if(P('kick')||P('padY')){cs.turn-=.5;cs.manual=4;}
   if(cs.shot===6){const lk=input.look('look');if(lk.x){cs.turn+=lk.x*turnGain();cs.manual=4;}}
   break;}
  case 'collection':{
   const c=collectionScene;if(!c)break;
   if(P('pause')||P('back')||P('notebook')||P('use')){closeCollection();break;}
   if(P('punch')||P('padX'))cycleCollection(-1);else if(P('kick')||P('padY'))cycleCollection(1);
   const lk=input.look('look');if(lk.x){c.turn+=lk.x*turnGain();c.manual=4;}const z=input.zoom();if(z)c.zoom=clamp(c.zoom-z*.08,.65,1.35);
   break;}
 }
}
// On-screen touch controls: only in the harbour, the forklift and fights; labels follow the mode.
// The top row sits on the right under the watch (on phones, lower during a shift or a fight, under their cards).
function touchTopOffset(){return innerWidth<760?(mode==='roam'?104:140):136;}
let touchKey='';
function syncTouch(){const t=kit.touch;if(!t)return;const active=started&&(mode==='roam'||mode==='forklift'||mode==='combat');const key=active?mode:'off';if(key===touchKey)return;touchKey=key;t.suspend(!active,'game');if(!active)return;
 const f=mode==='forklift',c=mode==='combat';t.placeTop('right',touchTopOffset());
 t.setLabel('use',c?'Punch':'E');t.setLabel('run',c?'Evade':'Run');t.setLabel('guard',f?'Brake':'Guard');
 t.setShown('run',!f);t.setShown('guard',f||c);t.setShown('kick',c);t.setShown('forkUp',f);t.setShown('forkDown',f);
 for(const n of ['exit','recover','camera','sheet'])t.setShown(n,f);t.setShown('notebook',!f);}
// Button prompts follow the last device used.
const PROMPTS={
 keyboard:{use:'E',continue:'E',foot:'W A S D &nbsp; WALK &nbsp; · &nbsp; SHIFT &nbsp; RUN &nbsp; · &nbsp; DRAG &nbsp; LOOK',battle:'<span class="key">J</span> PUNCH <span class="key">K</span> KICK <span class="key">L</span> EVADE <span class="key">SPACE</span> GUARD',work:'Q / Z · RAISE / LOWER &nbsp; C · CAMERA<br>H · HORN &nbsp; X · GET OUT &nbsp; R · RECOVER &nbsp; J · SHEET',keep:'E · PUT IT IN MY POCKET',skip:'SPACE · SKIP TO THE TOY',back:'ESC',mute:'Press M to change.',brake:'Space',sheet:'J',menu:'Press Escape for the menu.',turn:'A / D OR DRAG · TURN THE FIGURE',rotate:'DRAG OR A / D TO TURN · WHEEL TO ZOOM · J / K OTHER FIGURES'},
 gamepad:{use:'A',continue:'A',foot:'L-STICK &nbsp; WALK &nbsp; · &nbsp; B &nbsp; RUN &nbsp; · &nbsp; R-STICK &nbsp; LOOK',battle:'<span class="key">X</span> PUNCH <span class="key">Y</span> KICK <span class="key">B</span> EVADE <span class="key">LT</span> GUARD',work:'RB / LB · RAISE / LOWER &nbsp; R-STICK · CAB<br>L-STICK · HORN &nbsp; X · GET OUT &nbsp; Y · RECOVER &nbsp; BACK · SHEET',keep:'A · PUT IT IN MY POCKET',skip:'A · SKIP TO THE TOY',back:'B',mute:'',brake:'LT',sheet:'Back',menu:'Press Start for the menu.',turn:'RIGHT STICK OR X / Y · TURN THE FIGURE',rotate:'RIGHT STICK TO TURN · X / Y OTHER FIGURES · B BACK'},
 touch:{use:'E',continue:'TAP',foot:'',battle:'',work:'',keep:'TAP · PUT IT IN MY POCKET',skip:'TAP · SKIP TO THE TOY',back:'',mute:'',brake:'Brake',sheet:'Sheet',menu:'Tap II for the menu.',turn:'DRAG OR ↶ ↷ · TURN THE FIGURE',rotate:'DRAG TO TURN · PINCH TO ZOOM'}
};
let prompts=PROMPTS.keyboard;
function backPrefix(){return prompts.back?prompts.back+' · ':'';}
function applyPrompts(src){prompts=PROMPTS[src]||PROMPTS.keyboard;const root=document.documentElement;root.dataset.input=src;root.classList.toggle('pad-nav',src==='gamepad');
 $('interactKey').textContent=prompts.use;$('dialogueNext').innerHTML='<span class="key">'+prompts.continue+'</span> CONTINUE';$('footHelp').innerHTML=prompts.foot;$('battleHints').innerHTML=prompts.battle;$('workControlHint').innerHTML=prompts.work;$('capsuleConfirm').textContent=prompts.keep;$('capsuleSkip').textContent=prompts.skip;$('collectionRotate').textContent=prompts.rotate;if(capsuleScene)paintCapsule();
 const back=$('collectionBack');back.textContent=backPrefix()+back.textContent.replace(/^[A-Z]+ · /,'');if(qte)paintQTE();}

// Outermost HUD layer: every updateHUD() above only queues its text; this writes what changed.
const hudQueue=updateHUD;
updateHUD=function(){hudQueue();hudFlush();};

/* -------------------------------------------------------------------------
   Start: build the renderer from the finished world, compile, then run.
   ------------------------------------------------------------------------- */
boot();
kit.loading.progress(.9,'Opening the east gate…');
input.onSourceChange(applyPrompts);applyPrompts(input.source);
kit.onResize(()=>kit.touch?.placeTop('right',touchTopOffset()));
kit.onPause(p=>{if(!sound.ctx)return;if(p)sound.ctx.suspend().catch(()=>{});else if(!document.hidden)sound.ctx.resume().catch(()=>{});});
try{await renderer.compile();}catch(e){console.warn('[sham-mue] shader warm-up skipped:',e?.message||e);}
let firstFrame=true;
kit.start(dt=>{frame(dt);if(firstFrame){firstFrame=false;kit.loading.done();}});

