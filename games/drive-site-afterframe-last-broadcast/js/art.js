/* Original ink renderer. Motion comes from my-3D2dge's articulated Humanoid.
 * These vector bodies, machines, world props, and effects are game assets. */
(() => {
'use strict';
const E=My3D2dge,TAU=Math.PI*2;
const C={ink:'#07141d',paper:'#f4ecd5',amber:'#ffb43b',orange:'#ff823d',teal:'#68f0cb',red:'#fb6470',purple:'#d4acff'};
const city=new Image();city.src='assets/city.webp';
function path(g,pts,fill,stroke=C.ink,width=1){g.beginPath();for(let i=0;i<pts.length;i++)g[i?'lineTo':'moveTo'](pts[i][0],pts[i][1]);g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function line(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function ellipse(g,x,y,rx,ry,fill,stroke=null,width=1){g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function limb(g,a,b,wa,wb,colour,light,tint){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;path(g,[[a[0]+nx*wa,a[1]+ny*wa],[b[0]+nx*wb,b[1]+ny*wb],[b[0]-nx*wb,b[1]-ny*wb],[a[0]-nx*wa,a[1]-ny*wa]],tint||colour,tint||C.ink,1.1);ellipse(g,a[0],a[1],wa*.86,wa*.86,tint||colour);ellipse(g,b[0],b[1],wb*.8,wb*.8,tint||colour);if(light&&!tint)line(g,a[0]-nx*wa*.45,a[1]-ny*wa*.45,b[0]-nx*wb*.45,b[1]-ny*wb*.45,light,.65);}
function text(g,word,x,y,size=12,colour=C.paper,align='left',font='Arial'){g.font=`700 ${size}px ${font}`;g.fillStyle=colour;g.textAlign=align;g.fillText(word,x,y);}
function glow(g,x,y,r,colour,alpha=.25){g.save();g.globalAlpha*=alpha;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,colour);gr.addColorStop(1,colour+'00');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);g.restore();}
function withWorld(g,r,x,z,fn){const p=r.w(x,0,z);g.save();g.translate(p[0],p[1]);g.scale(r.view.scale,r.view.scale);fn(g);g.restore();E.px.reset(g);}
function makeRig(type='hero'){
 const bulky=type==='shield';return new E.Humanoid({build:bulky?'bulky':'heroic',size:type==='hero'?1.25:bulky?1.42:type==='skater'?1.16:1.25,weapon:null,cheat:0,headR:type==='hero'?3.5:3.8,torsoW:type==='hero'?3.1:3.9,speedRef:115,stride:8.2,footSpread:2.5,swing:5.2});
}
function drawRig(g,actor,tint){
 const rig=actor.rig;if(!rig)return;const hero=actor.kind==='hero',shield=actor.kind==='shield',gunner=actor.kind==='gunner',skater=actor.kind==='skater';
 const sz=rig.o.size,face=actor.facing||1,p={};
 for(const [key,value]of Object.entries(rig.J)){if(key==='bladeDir')continue;const q=rig._w(value);p[key]=[q[0]+q[1]*.23,-q[2]];}
 const hip=p.hipC,sh=p.shC,head=p.head;
 const fill=hero?'#eeebd8':shield?'#648485':gunner?'#446571':skater?'#527e84':'#d67563';
 const highlight=hero?'#fff8dc':shield?'#b1c8b7':gunner?'#8cafac':skater?'#8ed2bd':'#f0a183';
 const skin=hero?'#ebc7a1':'#182d39',accent=hero?C.amber:skater?C.teal:gunner?'#ff7981':C.amber;
 const back=hero?'#152d3e':'#203b47',front=hero?'#254757':'#30505b';
 if(hero){
  const t=rig.t,wind=Math.min(1,Math.abs(actor.vx||0)/130),x=sh[0]-face*3,y=sh[1]-1;
  const points=[[x,y-2],[x-face*11,y-2+Math.sin(t*8)*2],[x-face*(20+wind*11),y+Math.sin(t*10-1)*3-2],[x-face*(32+wind*13),y+Math.sin(t*8-2)*5-4],[x-face*(26+wind*9),y+Math.sin(t*8-2)*4+2],[x-face*18,y+4+Math.sin(t*10-1)*3],[x-face*8,y+4],[x,y+2]];
  path(g,points,tint||'#e77a35',tint||C.ink,1);if(!tint)line(g,x-face*8,y,x-face*(23+wind*7),y+Math.sin(t*8)*2,'#ffcb55',1.1);
 }
 const order=face>0?['L','R']:['R','L'];
 for(let i=0;i<2;i++){
  const s=order[i],a=p['hip'+s],b=p['knee'+s],f=p['foot'+s];
  limb(g,a,b,hero?2.1:2.8,hero?1.65:2.15,i?front:back,i?'#69939a':null,tint);
  limb(g,b,f,hero?1.75:2.3,hero?1.5:2,i?'#162e3d':'#102331',i?'#567a83':null,tint);
  const toe=[f[0]+face*(hero?4.3:5.3),f[1]+.2];
  path(g,[[f[0]-face*2.3,f[1]-2.5],[toe[0],toe[1]-2.2],[toe[0]+face*1,toe[1]+.7],[f[0]-face*2.5,f[1]+.7]],tint||(i?'#e1dfc8':'#889c9b'),tint||C.ink,1);
  if(!tint)line(g,f[0],f[1]-.1,toe[0],toe[1]-.1,accent,.8);
 }
 const far=order[0];limb(g,p['sh'+far],p['elbow'+far],2.4,1.9,hero?'#939f9b':back,null,tint);limb(g,p['elbow'+far],p['hand'+far],2,2.6,hero?'#c96a32':fill,null,tint);
 const tx=sh[0],ty=sh[1];
 path(g,[[tx-face*4.8,ty-1.7],[tx+face*4.6,ty-.8],[hip[0]+face*3.8,hip[1]-1],[hip[0]-face*3.5,hip[1]+.2],[tx-face*5.1,ty+4]],tint||fill,tint||C.ink,1.35);
 if(!tint){path(g,[[tx-face*4.2,ty-.9],[tx-face*.4,ty-1.1],[hip[0]-face*.3,hip[1]-1],[hip[0]-face*3.5,hip[1]]],hero?'#adb9b0':E.shade(fill,-.23),null);line(g,tx+face*2,ty+2,hip[0]+face*1.5,hip[1]-1,hero?'#fffce3':highlight,.85);line(g,hip[0]-4,hip[1]-.1,hip[0]+4,hip[1]-.1,accent,1.9);}
 // Short jacket tails retain a clear waist and leg silhouette.
 if(hero){path(g,[[hip[0]-face*3,hip[1]-3],[hip[0]-face*5.2,hip[1]+3],[hip[0]-face*.8,hip[1]+1],[hip[0]+face*2.1,hip[1]-2]],tint||'#e4e0cb',tint||C.ink,.7);}
 const near=order[1];limb(g,p['sh'+near],p['elbow'+near],hero?2.9:3.2,2.1,fill,highlight,tint);
 limb(g,p['elbow'+near],p['hand'+near],hero?2.65:2.5,hero?3.5:2.9,hero?'#e99540':fill,hero?'#ffcb6b':highlight,tint);
 const hand=p['hand'+near];ellipse(g,hand[0]+face*.3,hand[1],hero?3.45:3.1,hero?2.7:2.7,tint||(hero?C.orange:back),tint||C.ink,.9);
 if(!tint)line(g,hand[0]-face*1,hand[1]-1.4,hand[0]+face*2,hand[1]-1.1,hero?'#ffe79f':accent,.9);
 if(gunner){const h=p.handR;path(g,[[h[0]-face*1,h[1]-3],[h[0]+face*14,h[1]-3],[h[0]+face*14,h[1]+1],[h[0]+face*3,h[1]+2]],tint||'#1a303a',tint||C.ink,1);if(!tint){line(g,h[0]+face*6,h[1]-1.8,h[0]+face*12,h[1]-1.8,C.red,1.2);}}
 const hr=rig.o.headR*sz;
 if(hero){
  path(g,[[head[0]-face*hr*.7,head[1]-hr*.8],[head[0]+face*hr*.6,head[1]-hr*.8],[head[0]+face*hr*1.03,head[1]+hr*.15],[head[0]+face*hr*.55,head[1]+hr*.8],[head[0]-face*hr*.6,head[1]+hr*.55]],tint||skin,tint||C.ink,1);
  path(g,[[head[0]-face*hr*.8,head[1]+hr*.5],[head[0]-face*hr*1.17,head[1]-hr*.15],[head[0]-face*hr*.8,head[1]-hr*.95],[head[0]+face*hr*.55,head[1]-hr*1.07],[head[0]+face*hr*1.2,head[1]-hr*.3],[head[0]+face*hr*.12,head[1]-hr*.54],[head[0]-face*hr*.26,head[1]+hr*.15]],tint||'#fff1d5',tint||C.ink,1);
  path(g,[[head[0]-face*hr*.05,head[1]-hr*.35],[head[0]+face*hr*1.05,head[1]-hr*.21],[head[0]+face*hr*.9,head[1]+hr*.23],[head[0]-face*hr*.08,head[1]+hr*.07]],tint||'#d9973c',tint||'#4b3c27',.65);
  if(!tint)line(g,head[0]+face*hr*.21,head[1]-hr*.2,head[0]+face*hr*.86,head[1]-hr*.13,'#fff3b2',.65);
  limb(g,[sh[0]-2,sh[1]-1.8],[sh[0]+3,sh[1]-1.8],1.5,1.3,'#f4af45',null,tint);
 }else{
  path(g,[[head[0]-hr,head[1]-hr*.9],[head[0]+hr*.7,head[1]-hr],[head[0]+hr*1.08,head[1]+hr*.5],[head[0]+hr*.3,head[1]+hr*.8],[head[0]-hr*.85,head[1]+hr*.6]],tint||fill,tint||C.ink,1.3);
  if(!tint){path(g,[[head[0]-hr*.7,head[1]-hr*.05],[head[0]+hr*.9,head[1]-hr*.2],[head[0]+hr*.92,head[1]+hr*.3],[head[0]-hr*.65,head[1]+hr*.38]],'#152b32',null);line(g,head[0]-hr*.45,head[1]+hr*.1,head[0]+hr*.68,head[1]+hr*.07,accent,1.2);line(g,head[0]-hr*.6,head[1]-hr*.6,head[0]+hr*.25,head[1]-hr*.72,highlight,.9);}
  if(shield&&!tint&&actor.guard>0){
   const x=sh[0]+face*12;g.save();g.globalAlpha=.84;path(g,[[x,sh[1]-8],[x+face*7,sh[1]-2],[x+face*7,hip[1]+8],[x,hip[1]+13],[x-face*3,hip[1]+6],[x-face*3,sh[1]-3]],'#2e7981',C.teal,.7);line(g,x+face*2,sh[1]-3,x+face*2,hip[1]+8,'#9af1d6',.6);g.restore();}
 }
}
function drawDrone(g,e,tint){const t=e.anim||0;const color=tint||'#527b86';ellipse(g,0,-14,10,9,color,tint||C.ink,1.6);path(g,[[-14,-16],[-24,-20],[-28,-17],[-16,-12]],tint||'#253f4b',tint||C.ink,1);path(g,[[14,-16],[24,-20],[28,-17],[16,-12]],tint||'#253f4b',tint||C.ink,1);for(let side of[-1,1]){ellipse(g,side*22,-22,12,2,tint||'#79a398');line(g,side*22-10*Math.cos(t*30),-22,side*22+10*Math.cos(t*30),-22,tint||'#c0dfcc',.8);}ellipse(g,0,-14,5,5,tint||'#142834');ellipse(g,0,-14,2.3,2.3,tint||C.red);path(g,[[-4,-6],[0,-1],[4,-6]],tint||C.amber,tint||C.ink,.5);}
function drawBoss(g,e,tint){
 const t=e.anim||0,walk=Math.sin(t*7)*Math.min(1,Math.abs(e.vx||0)/80),open=e.exposed>0,phase=e.hp<e.maxHp*.5,core=open?C.amber:phase?C.red:C.teal;
 const raising=e.action==='slam'&&e.state==='wind',dash=e.state==='dash';
 const bodyY=-51+Math.sin(t*2)*1.1,lean=dash?(e.facing||-1)*6:0;
 for(const side of[-1,1]){
  const hip=[side*12,bodyY+13],knee=[side*(18+walk*5),-18-side*walk*5],foot=[side*(27+walk*7),0];limb(g,hip,knee,6,5,tint||'#254450','#66888e',tint);limb(g,knee,foot,5,4.2,tint||'#486774','#85a393',tint);path(g,[[foot[0]-8,0],[foot[0]-6,-5],[foot[0]+7,-5],[foot[0]+12,0],[foot[0]+11,3],[foot[0]-9,3]],tint||'#abc1b0',tint||C.ink,1.6);
  const sh=[side*24+lean,bodyY-4],elbow=[side*35+lean,raising?bodyY-24:bodyY+11],hand=[side*43+lean,raising?bodyY-37:bodyY+23];limb(g,sh,elbow,7.4,5.4,'#527684','#a1b9af',tint);limb(g,elbow,hand,6.5,8.7,'#739388','#c5d1bb',tint);path(g,[[hand[0]-9,hand[1]-7],[hand[0]+9,hand[1]-7],[hand[0]+11,hand[1]+7],[hand[0]-8,hand[1]+9]],tint||'#203b48',tint||C.ink,1.5);if(!tint)line(g,hand[0]-6,hand[1]-3,hand[0]+6,hand[1]-3,core,1.8);
 }
 path(g,[[lean-29,bodyY-12],[lean-17,bodyY-21],[lean+20,bodyY-21],[lean+30,bodyY-11],[lean+22,bodyY+18],[lean,bodyY+27],[lean-23,bodyY+15]],tint||'#496974',tint||C.ink,2);
 path(g,[[lean-26,bodyY-10],[lean-13,bodyY-17],[lean-7,bodyY+18],[lean-20,bodyY+12]],tint||'#719286',null);
 if(!tint){line(g,lean-18,bodyY-17,lean+19,bodyY-17,'#b5c9b3',1.7);glow(g,lean,bodyY+2,23,core,.27);}
 ellipse(g,lean,bodyY+2,15,15,tint||'#152d3d',tint||'#91aa9d',2.7);ellipse(g,lean,bodyY+2,11.5,11.5,tint||(open?'#bc682b':'#10252d'),tint||core,1.3);
 g.save();g.translate(lean,bodyY+2);g.rotate(t*(open?2:.3));for(let i=0;i<6;i++){g.rotate(TAU/6);path(g,[[0,-2],[8,-8],[10,-1],[3,4]],tint||(open?C.amber:'#3d6570'),null);}g.restore();ellipse(g,lean,bodyY+2,4.8,4.8,tint||core);if(!tint)ellipse(g,lean-1,bodyY,1.9,1.9,'#fff9d9');
 const hY=bodyY-33;path(g,[[lean-11,hY-8],[lean+11,hY-8],[lean+14,hY+7],[lean+8,hY+12],[lean-10,hY+10],[lean-14,hY+3]],tint||'#adbda6',tint||C.ink,1.5);path(g,[[lean-10,hY-2],[lean+11,hY-2],[lean+10,hY+5],[lean-9,hY+5]],tint||'#172a34',null);if(!tint)line(g,lean-7,hY+1,lean+8,hY+1,core,1.7);
 for(let side of[-1,1]){line(g,lean+side*8,hY-8,lean+side*12,hY-21,tint||'#bdd2bc',1.6);ellipse(g,lean+side*12,hY-21,1.9,1.9,tint||core);}
}
function actor(r,e,options={}){
 if(e.dead&&e.deathAge>.6)return;const scale=r.view.scale;if(!r.visible(e.x,0,e.z+e.h*.5))return;
 r.queue(e.x,.1,e.z,g=>{
  const [x,y]=r.w(e.x,0,e.z);g.save();g.translate(x,y);g.scale(scale,scale);g.lineJoin='round';g.lineCap='round';
  if(options.alpha!==undefined)g.globalAlpha=options.alpha;
  if(e.dead){g.globalAlpha*=Math.max(0,1-e.deathAge/.6);g.translate(0,e.deathAge*8);g.rotate(e.deathAge*e.facing*2);}
  if(e.kind==='boss')drawBoss(g,e,options.tint);else if(e.kind==='drone')drawDrone(g,e,options.tint);else drawRig(g,e,options.tint);
  if(e.hit>0&&!options.tint){g.globalAlpha*=Math.min(.35,e.hit*2);if(e.kind==='boss')drawBoss(g,e,'#fff2c2');else if(e.kind==='drone')drawDrone(g,e,'#fff2c2');else drawRig(g,e,'#fff2c2');}
  g.restore();E.px.reset(g);
 },{bias:options.bias||0});
}
function shadow(r,e){const floor=e.floor??48;const p=r.w(e.x,0,floor);const h=Math.max(0,e.z-floor);const g=r.ctx;g.save();g.globalAlpha=.35/(1+h*.03);ellipse(g,p[0],p[1]+2,(e.kind==='boss'?38:13)*r.view.scale,3.5*r.view.scale,'#020d16');g.restore();E.px.reset(g);}
function background(r,s){
 const g=r.ctx,w=r.W,h=r.H,cam=r.game.cam.x/r.view.scale;
 g.save();g.imageSmoothingEnabled=true;
 if(city.complete&&city.naturalWidth){const off=-((cam*.06)%110);g.drawImage(city,off-20,-35,w+140,h+60);}else{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#164b55');gr.addColorStop(1,'#091d2b');g.fillStyle=gr;g.fillRect(0,0,w,h);}
 // Depth haze between the painted skyline and the playable roof.
 const mist=g.createLinearGradient(0,h*.35,0,h);mist.addColorStop(0,'#14363c00');mist.addColorStop(.7,'#102b3977');mist.addColorStop(1,'#091c2bef');g.fillStyle=mist;g.fillRect(0,0,w,h);
 // Distant rain and radio beams. Seeded positions keep the image calm.
 if(!s.settings?.reducedMotion){g.globalAlpha=.15;for(let i=0;i<38;i++){const x=(i*91.71-(s.clock||0)*32-cam*.16)%(w+60),y=(i*53.9+(s.clock||0)*93)%(h*.7);line(g,x,y,x-5,y+16,'#a9d4c4',.65);}g.globalAlpha=1;}
 const beamX=w*.67-cam*.045;g.save();g.globalAlpha=.045;path(g,[[beamX,h*.69],[beamX-190,0],[beamX-15,0]],'#a4e4d3',null);g.restore();
 g.restore();E.px.reset(g);
}
function platform(r,p){
 const g=r.ctx,[x,y]=r.w(p.x,0,p.z),sc=r.view.scale,w=p.w*sc,depth=(p.depth||58)*sc;if(x+w<-20||x>r.W+20)return;
 g.save();g.fillStyle=p.upper?'#1b3543':'#102431';g.fillRect(x,y,w,depth);
 path(g,[[x,y],[x+7*sc,y-4*sc],[x+w+7*sc,y-4*sc],[x+w,y]],p.upper?'#47656c':'#3b5c62','#071823',.8*sc);
 line(g,x,y+.5*sc,x+w,y+.5*sc,p.upper?'#9cc2b4':'#87b3a5',.65*sc);
 g.fillStyle='#071b29';g.fillRect(x,y+3*sc,w,5*sc);g.fillStyle='#31515e';g.fillRect(x,y+8*sc,w,1.3*sc);
 const step=p.upper?32:48;
 for(let i=0;i<p.w;i+=step){const xx=x+i*sc;line(g,xx,y+10*sc,xx,y+depth,'#36515c',.45*sc);if(!p.upper){path(g,[[xx+3*sc,y+17*sc],[xx+(step-4)*sc,y+17*sc],[xx+(step-4)*sc,y+28*sc],[xx+3*sc,y+28*sc]],'#0d202e','#213c4a',.6*sc);line(g,xx+7*sc,y+21*sc,xx+(step-8)*sc,y+21*sc,'#32515c',.7*sc);}}
 if(p.upper){for(let i=6;i<p.w-5;i+=19){g.fillStyle='#081c28';g.fillRect(x+i*sc,y+10*sc,12*sc,4*sc);}line(g,x+2*sc,y+18*sc,x+(p.w-2)*sc,y+18*sc,'#5e7d7e',.5*sc);}
 if(!p.upper){for(let i=12;i<p.w-10;i+=64){const xx=x+i*sc;line(g,xx,y+35*sc,xx+24*sc,y+55*sc,'#243e4c',2*sc);}}
 g.restore();E.px.reset(g);
}
function scenery(r,s){
 const g=r.ctx;
 for(const p of s.platforms)platform(r,p);
 // Interactive-space details: rails, tower markings, roof ducts and power lines.
 for(const item of s.props||[]){if(!r.visible(item.x,0,item.z||48))continue;withWorld(g,r,item.x,item.z||48,()=>{
  if(item.kind==='rail'){
   for(let i=0;i<=item.w;i+=32){line(g,i,-3,i,-25,'#223f48',2);ellipse(g,i,-25,1.6,1.6,'#4f7b79');}line(g,0,-25,item.w,-25,'#456969',1.5);line(g,0,-13,item.w,-13,'#284951',.8);
  }else if(item.kind==='vent'){
   path(g,[[-18,0],[-18,-20],[-10,-27],[19,-27],[19,0]],'#284652',C.ink,1.1);path(g,[[-18,-20],[-10,-27],[19,-27],[12,-20]],'#658078',C.ink,.7);for(let i=0;i<4;i++)line(g,-13,-16+i*4,10,-16+i*4,'#0a2633',1.3);line(g,14,-18,14,-2,'#6d8c84',.6);
  }else if(item.kind==='sign'){
   line(g,-12,0,-12,-73,'#375662',2);line(g,58,0,58,-73,'#375662',2);g.fillStyle='#122d39';g.fillRect(-25,-75,100,41);g.strokeStyle='#648c81';g.lineWidth=.5;g.strokeRect(-25,-75,100,41);text(g,item.text,-17,-58,10,'#c5d9c6');text(g,item.sub||'RELAY NETWORK',-17,-44,4.5,C.amber);line(g,-18,-37,15,-37,C.amber,.8);
  }else if(item.kind==='antenna'){
   line(g,0,0,0,-145,'#3e6470',2);line(g,-19,-82,19,-82,'#426b74',1.4);line(g,-26,-111,26,-111,'#4f787b',1.2);line(g,-17,-124,17,-124,'#4f787b',1.2);ellipse(g,0,-145,2,2,(Math.sin(s.clock*2)>0)?C.red:'#7a424c');line(g,0,-55,-32,0,'#294958',1);line(g,0,-55,32,0,'#294958',1);
  }
 });}
}
function gate(r,x,open,color=C.red,label='LOCKED'){
 const g=r.ctx;if(Math.abs(x-r.game.cam.tx)>r.W/r.view.scale)return;
 withWorld(g,r,x,48,()=>{for(let side of[-1,1]){g.fillStyle='#1c3945';g.fillRect(side*8-3,-114,6,114);line(g,side*8,-113,side*8,0,'#82a499',.8);}path(g,[[-13,-115],[13,-115],[16,-105],[-16,-105]],'#36545b',C.ink,1);
  if(!open){g.save();g.globalAlpha=.18;g.fillStyle=color;g.fillRect(-5,-103,10,104);g.restore();for(let i=0;i<11;i++)line(g,-5,-99+i*9,5,-103+i*9,color,1);glow(g,0,-50,30,color,.15);text(g,label,0,-121,5,color,'center');}else{text(g,'OPEN',0,-121,5,C.teal,'center');line(g,-8,-98,-8,-91,C.teal,2);line(g,8,-98,8,-91,C.teal,2);}
 });
}
function coil(r,obj,s){
 const g=r.ctx;withWorld(g,r,obj.x,48,()=>{
  path(g,[[-22,0],[-19,-26],[-11,-33],[15,-33],[23,-25],[24,0]],'#355865',C.ink,1.2);g.fillStyle='#0c2534';g.fillRect(-13,-25,26,18);
  const on=obj.charge>=100;glow(g,0,-18,23,on?C.teal:C.orange,.3);
  for(let i=0;i<7;i++){g.save();g.translate(0,-18);g.rotate(i*.18+(s.power==='rush'?s.clock*8:s.clock));g.strokeStyle=on?C.teal:C.amber;g.lineWidth=1.2;g.beginPath();g.ellipse(0,0,4+i*.8,10,0,0,TAU);g.stroke();g.restore();}
  g.fillStyle='#071722';g.fillRect(-25,6,50,4);g.fillStyle=on?C.teal:C.orange;g.fillRect(-25,6,50*obj.charge/100,4);
  text(g,on?'RELAY CHARGED':'HOLD E / RUSH',0,-42,5.3,on?C.teal:C.amber,'center');text(g,Math.round(obj.charge)+'%',0,18,5,C.paper,'center');
 });
}
function turbine(r,t,s){
 const g=r.ctx;withWorld(g,r,t.x,t.z,()=>{
  const safe=s.power==='slow';const radius=t.r;
  g.fillStyle='#172f3c';g.fillRect(-radius-5,-radius-6,(radius+5)*2,(radius+6)*2);
  ellipse(g,0,0,radius+3,radius+3,'#0b202e','#4f737a',2);ellipse(g,0,0,radius-1,radius-1,'#102e3c','#365b65',1);
  g.save();g.rotate(t.angle);for(let i=0;i<5;i++){g.rotate(TAU/5);path(g,[[3,-3],[radius-5,-12],[radius-2,2],[9,8]],safe?'#408579':'#5f7578',safe?'#8be4c1':'#8a9d90',.6);}g.restore();ellipse(g,0,0,9,9,'#213e4b','#81998e',1);ellipse(g,0,0,3,3,safe?C.teal:C.red);
  if(safe)glow(g,0,0,radius+10,C.teal,.18);text(g,safe?'SAFE / SLOW':'Q / SLOW BLADES',0,-radius-12,5,safe?C.teal:C.amber,'center');
 });
}
function wall(r,wall){
 if(wall.broken)return;const g=r.ctx;withWorld(g,r,wall.x,48,()=>{const w=wall.w||22,h=wall.h||120;path(g,[[-w/2,0],[-w/2,-h],[w/2,-h],[w/2,0]],'#3d515c',C.ink,1.5);for(let y=0;y<h;y+=13)line(g,-w/2,-y,w/2,-y,'#203b48',.7);path(g,[[-5,-h+3],[2,-h+21],[-3,-h+37],[6,-h+55],[-3,-h+78],[3,-h+103]],null,'#d4abff',1.4);text(g,'R / FOCUS',0,-h-10,5,'#dfbfff','center');text(g,'BREAK',0,-h-3,3.6,'#bbc5c4','center');});
}
function collectible(r,o,s){if(o.collected)return;const g=r.ctx;withWorld(g,r,o.x,o.z,()=>{
 const bob=Math.sin(s.clock*2.5+o.x)*2,secret=o.kind==='signal',rad=secret?8:4;glow(g,0,-bob,rad*3,secret?C.amber:C.teal,.28);g.save();g.translate(0,-bob);g.scale(.8+.2*Math.cos(s.clock*2),1);path(g,[[0,-rad],[rad*.8,0],[0,rad],[-rad*.8,0]],secret?'#ba7d30':'#368b7b',secret?C.amber:C.teal,.8);path(g,[[0,-rad*.6],[rad*.45,0],[0,rad*.6],[-rad*.45,0]],secret?'#ffdb83':'#aff0cb',null);g.restore();if(secret)text(g,'LOST SIGNAL',0,-18,3.8,C.amber,'center');
 });}
function warning(r,e){
 if(e.dead||e.kind==='boss')return;const g=r.ctx,p=r.w(e.x,0,e.z+e.h+10),sc=r.view.scale;
 g.save();g.translate(p[0],p[1]);g.scale(sc,sc);
 if(e.exposed>0){g.save();g.rotate(Math.PI/4);g.fillStyle=C.amber;g.fillRect(-3.2,-3.2,6.4,6.4);g.restore();text(g,'OPEN',0,-9,4,C.amber,'center');}
 else if(e.state==='wind'){const ready=e.timer<.22;g.save();g.rotate(Math.PI/4);g.fillStyle=ready?'#ffd5b0':C.red;g.fillRect(-4,-4,8,8);g.restore();text(g,'!',0,2.7,7,C.ink,'center');if(ready)ellipse(g,0,0,7,7,null,C.amber,.7);}
 if(e.hp<e.maxHp){g.fillStyle='#071722';g.fillRect(-10,5,20,2);g.fillStyle=e.exposed>0?C.amber:C.red;g.fillRect(-10,5,20*Math.max(0,e.hp/e.maxHp),2);}
 g.restore();E.px.reset(g);
}
function projectile(r,b){const g=r.ctx;withWorld(g,r,b.x,b.z,()=>{const color=b.team==='hero'?C.teal:C.amber;const dir=Math.sign(b.vx);glow(g,0,0,13,color,.34);path(g,[[-dir*11,-1.5],[dir*3,-2],[dir*6,0],[dir*3,2],[-dir*11,1.5]],color,C.ink,.5);ellipse(g,dir*2,0,1.6,1.2,'#fff8cd');});}
function effect(r,e){const g=r.ctx,sc=r.view.scale,[x,y]=r.w(e.x,0,e.z);g.save();g.translate(x,y);g.scale(sc,sc);g.globalAlpha=Math.max(0,1-e.age/e.life);
 if(e.kind==='ring'){g.strokeStyle=e.color;g.lineWidth=(1-e.age/e.life)*2;g.beginPath();g.ellipse(0,0,e.radius*(.2+e.age/e.life),e.radius*(.2+e.age/e.life)*(e.flat?.25:1),0,0,TAU);g.stroke();}
 else if(e.kind==='slash'){g.scale(e.face||1,1);g.strokeStyle=e.color;g.lineWidth=(1-e.age/e.life)*4;g.beginPath();g.arc(0,0,e.radius,-1.2+.6*e.age/e.life,1.3+.6*e.age/e.life);g.stroke();g.strokeStyle='#fff6d5';g.lineWidth=.7;g.beginPath();g.arc(0,0,e.radius-2,-.8,1.15);g.stroke();}
 else if(e.kind==='text'){g.translate(0,-e.age*22);text(g,e.text,0,0,e.size||9,e.color,'center','Arial');}
 else if(e.kind==='spark'){line(g,0,0,-(e.vx||0)*.025,(e.vz||0)*.025,e.color,1.1);}
 else if(e.kind==='diamond'){g.rotate(e.age*10);path(g,[[0,-3],[2,0],[0,3],[-2,0]],e.color,null);}
 g.restore();E.px.reset(g);}
function bossTelegraph(r,b,s){
 if(!b||b.dead)return;const g=r.ctx;
 if(b.state==='wind'){
  const p=r.w(b.targetX||b.x,0,48),sc=r.view.scale;g.save();
  if(b.action==='slam'){g.globalAlpha=.2+.12*Math.sin(s.clock*18);g.fillStyle=C.red;g.fillRect(p[0]-58*sc,p[1]-3,116*sc,7);g.globalAlpha=.6;for(let i=-55;i<56;i+=13)line(g,p[0]+i*sc,p[1],p[0]+(i+7)*sc,p[1]-5*sc,C.red,1);}
  else if(b.action==='dash'){const a=r.w(3216,0,59),c=r.w(3840,0,59);g.globalAlpha=.45;line(g,a[0],a[1],c[0],c[1],C.red,3);}
  const bp=r.w(b.x,0,b.z+110);g.globalAlpha=1;text(g,{slam:'GROUND SLAM · JUMP',volley:'BOLT VOLLEY · SLOW + HIT',dash:'SWEEP · DODGE'}[b.action]||'READ THE SIGNAL',bp[0],bp[1],11,C.amber,'center');g.restore();E.px.reset(g);
 }
 if(b.exposed>0){const bp=r.w(b.x,0,b.z+110);g.save();text(g,'CORE OPEN',bp[0],bp[1],12,C.amber,'center');g.restore();E.px.reset(g);}
}
window.AFArt={C,makeRig,actor,shadow,background,scenery,gate,coil,turbine,wall,collectible,warning,projectile,effect,bossTelegraph,withWorld,line,ellipse,text,path,glow};
})();
