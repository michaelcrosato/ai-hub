/* Original procedural scenery and articulated puppets for The Lantern Seam. */
(() => {
 'use strict';
 const A=window.StageArt={};
 const TAU=Math.PI*2;
 A.background=new Image();A.background.src='assets/woodland.webp';
 const ellipse=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);g.fill();};
 const line=(g,pts,c,w=1)=>{g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.stroke();};
 const poly=(g,pts,c)=>{g.fillStyle=c;g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.closePath();g.fill();};
 const glow=(g,x,y,r,c)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,c);gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);};
 const star=(g,x,y,r,c,angle=0)=>{g.save();g.translate(x,y);g.rotate(angle);const p=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;const rr=i%2?r*.28:r;p.push([Math.sin(a)*rr,Math.cos(a)*rr]);}poly(g,p,c);g.restore();};
 A.glow=glow;A.star=star;A.line=line;A.ellipse=ellipse;
 A.stage=function(g,t,camera,section,victory=false){
  const W=1280,H=720;g.fillStyle='#0b2030';g.fillRect(0,0,W,H);
  if(A.background.complete&&A.background.naturalWidth){const dx=-48-(camera*.018)%34;g.drawImage(A.background,dx,-58,1400,933);}
  const veil=g.createLinearGradient(0,0,0,720);veil.addColorStop(0,'#06141b24');veil.addColorStop(.5,section===2?'#18213218':'#092e3420');veil.addColorStop(1,'#071319e8');g.fillStyle=veil;g.fillRect(0,0,W,H);
  if(section===1){g.fillStyle='#03363825';g.fillRect(0,0,W,H);}if(section===2){g.fillStyle= victory?'#705c2020':'#27172c35';g.fillRect(0,0,W,H);}
  // Scenery flats pass at a slower rate than the stage floor.
  for(let i=0;i<5;i++){
   let x=((i*347-camera*.27)%1600+1600)%1600-170;const y=627+Math.sin(i*5)*22;
   g.save();g.globalAlpha=.2;g.translate(x,y);g.scale(.65+(i%3)*.12,1.15);A.tree(g,0,0,200+(i%4)*58,'#071a29',i);g.restore();
  }
  // Dust is deterministic; no per-frame random flicker.
  for(let i=0;i<62;i++){const x=((i*103.31+Math.sin(t*.23+i)*30-camera*.07)%1320+1320)%1320;const y=90+(i*73.7)%500+Math.sin(t*.6+i*2.7)*16;const alpha=.2+(Math.sin(t*1.3+i)+1)*.23;g.globalAlpha=alpha;ellipse(g,x,y,i%7===0?2:1,i%7===0?2:1,i%4===0?'#f4d9a2':'#92cfd1');}g.globalAlpha=1;
  if(victory){glow(g,650,240,540,'#f9d47936');for(let i=0;i<18;i++)star(g,((i*193+t*12)%1380)-50,80+(i*89)%470,3+(i%3),'#f8d382',t*.2+i);}
 };
 A.tree=function(g,x,y,h,c,seed=1){
  g.save();g.translate(x,y);g.fillStyle=c;g.beginPath();g.moveTo(-28,0);g.bezierCurveTo(-11,-h*.3,-41,-h*.48,-14,-h*.72);g.lineTo(-3,-h);g.lineTo(4,-h*.73);g.bezierCurveTo(15,-h*.45,3,-h*.28,35,0);g.fill();
  for(let j=0;j<6;j++){const sy=-h*(.2+j*.1),s=j%2?1:-1;line(g,[[s*3,sy+22],[s*(48+(j%2)*22),sy-28],[s*(75+j*3),sy-84]],c,Math.max(4,12-j));for(let k=0;k<3;k++){g.save();g.translate(s*(53+k*13),sy-40-k*17);g.rotate(s*.6);ellipse(g,0,0,12,25,c);g.restore();}}
  g.restore();
 };
 A.platform=function(g,p,camera,t){
  const x=p.x-camera,y=620-p.top,w=p.w,h=p.deep||120;
  if(x+w<0||x>1280)return;
  g.save();g.translate(x,y);
  if(p.moving){line(g,[[18,-500],[18,0]],'#b69a6766',2);line(g,[[w-18,-500],[w-18,0]],'#b69a6766',2);}
  poly(g,[[0,2],[w,2],[w,Math.min(h,80)],[w-20,Math.min(h,80)+18],[0,h]],'#10282d');
  const wood=g.createLinearGradient(0,0,0,h);wood.addColorStop(0,'#795c3c');wood.addColorStop(.17,'#493c2a');wood.addColorStop(1,'#0a1c24');g.fillStyle=wood;g.fillRect(0,6,w,h);
  poly(g,[[w,5],[w+18,18],[w+18,h+8],[w,h]],'#18272a');
  for(let k=0;k<Math.ceil(w/80);k++){line(g,[[k*80+3,12],[k*80+8,h]],'#091c2566',2);line(g,[[k*80+18,24],[k*80+20,Math.min(h,92)]],'#b48a4035',1);ellipse(g,k*80+38,24,3,2,'#d5a45a55');}
  poly(g,[[-3,0],[w,-1],[w+17,10],[12,11]],'#b09b64');line(g,[[-2,1],[w-1,1]],'#dac485',2);
  // Layered felt moss and stitched binding.
  for(let i=0;i<w;i+=19){ellipse(g,i+7,-2,14,5,i%3===0?'#6c896a':'#3f685a');ellipse(g,i+10,-5,8,3,'#a6ac7360');}
  for(let i=14;i<w-10;i+=23)line(g,[[i,10],[i+3,15]],'#ceb57765',1);
  for(let i=27;i<w-20;i+=61){const lean=Math.sin(t*.7+i)*2;line(g,[[i,-4],[i+lean,-22]],'#809666',1.5);ellipse(g,i+lean+4,-17,6,3,'#8da57a');ellipse(g,i+lean-4,-11,6,3,'#5b8266');}
  if(!p.moving&&w>150){for(let j=0;j<3;j++){const xx=w*(j+1)/4,hh=19+((p.x+j*47)%34);line(g,[[xx,25],[xx+7,hh+45],[xx-3,hh+80]],'#163b37',3);for(let k=0;k<3;k++)ellipse(g,xx+5+(k%2?-7:4),hh+22+k*15,5,9,'#345649');}}
  g.restore();
 };
 A.mask=function(g,x,y,kind=0,scale=1,t=0){
  g.save();g.translate(x,y);g.scale(scale,scale);g.rotate(Math.sin(t*2)*.035);
  const c=kind===1?'#b6d8bd':kind===2?'#d6a1a0':'#edd29b';
  glow(g,0,0,35,'#f2bc5420');ellipse(g,0,0,20,21,'#634b35');ellipse(g,-2,-2,18,20,c);line(g,[[-16,4],[-10,13],[0,16],[10,12]],'#95734a90',1.2);
  if(kind===1){poly(g,[[-18,-10],[-26,-29],[-5,-19]],'#accfb6');poly(g,[[9,-18],[25,-27],[18,-4]],'#83ae9d');}else if(kind===2){poly(g,[[-17,-14],[-12,-31],[-1,-18],[11,-31],[17,-13]],'#b98380');}
  ellipse(g,-8,-3,3.1,5.3,'#162a2b');ellipse(g,7,-3,3.1,5.3,'#162a2b');ellipse(g,-8,-5,1,1.5,'#fff2c6');ellipse(g,7,-5,1,1.5,'#fff2c6');line(g,[[-4,8],[1,10],[6,7]],'#715a3a',1.3);
  if(kind===0){poly(g,[[-20,-13],[-9,-29],[10,-28],[22,-12]],'#c3964c');poly(g,[[-10,-26],[9,-26],[12,-14],[-14,-14]],'#f5d17b');line(g,[[-20,-13],[23,-13]],'#eed5a0',3);ellipse(g,1,-32,5,4,'#b98742');}
  g.restore();
 };
 A.puppet=function(g,x,y,hero,t,scale=1){
  g.save();g.translate(x,y);g.scale(scale,scale);const dir=hero.facing||1;g.scale(dir,1);
  const run=Math.min(1,Math.abs(hero.vx||0)/230),phase=hero.gait??t*12,air=hero.air||hero.riding,cut=hero.cut||0;
  const bob=air?-3:Math.sin(phase*2)*1.5*run+Math.sin(t*2)*.8;
  const stretch=hero.landSquash||0;g.scale(1+stretch*.12,1-stretch*.1);g.rotate(Math.max(-.09,Math.min(.09,(hero.vx||0)/5000)));
  // Thin suspension strings make the rig a visible stage object.
  g.globalAlpha=.18;line(g,[[-12,-43],[-20,-145]],'#c5c5a3',.7);line(g,[[10,-40],[15,-145]],'#c5c5a3',.7);g.globalAlpha=1;
  const feet=[{x:-9+Math.sin(phase)*run*14,y:air?-9:Math.min(0,Math.cos(phase))*run*8},{x:9-Math.sin(phase)*run*14,y:air?-4:Math.min(0,-Math.cos(phase))*run*8}];
  // Cape carries motion through a delayed cloth curve.
  g.fillStyle='#0e4955';g.beginPath();g.moveTo(-8,-55+bob);g.bezierCurveTo(-34-run*14,-43+bob,-19+Math.sin(t*8)*4-run*26,-15,-33-run*12,-14);g.quadraticCurveTo(-3,-3,11,-24);g.lineTo(14,-54+bob);g.fill();line(g,[[-17,-37],[-26-run*15,-17],[-5,-13]],'#48958d',1.3);
  for(let i=0;i<2;i++){const f=feet[i],hip=i?9:-8;line(g,[[hip,-27+bob],[hip+(f.x-hip)*.5,-14+bob],[f.x,f.y-4]],'#423d32',8);line(g,[[hip,-27+bob],[hip+(f.x-hip)*.5,-14+bob],[f.x,f.y-4]],'#aa8c60',5);ellipse(g,hip+(f.x-hip)*.5,-14+bob,3.6,3.6,'#d0ab76');ellipse(g,f.x+3,f.y-2,8,4,'#172d32');line(g,[[f.x-3,f.y+1],[f.x+9,f.y+1]],'#74958a',1);}
  const armFront=cut>0?[[11,-46+bob],[28,-61+bob],[40,-55+bob]]:air?[[11,-46],[26,-55],[32,-65]]:[[12,-46+bob],[22,-33+bob],[18+Math.sin(phase)*run*7,-28+bob]];
  const armBack=[[-11,-46+bob],[-22,-33+bob],[-22-Math.sin(phase)*run*10,-26+bob]];
  line(g,armBack,'#685337',6);ellipse(g,...armBack[2],4.5,4.5,'#d2b183');
  const coat=g.createLinearGradient(-16,-45,19,-25);coat.addColorStop(0,'#297576');coat.addColorStop(.65,'#184d58');coat.addColorStop(1,'#0e343f');poly(g,[[-13,-52+bob],[12,-52+bob],[18,-23+bob],[-18,-23+bob]],coat);
  line(g,[[-10,-50+bob],[-5,-36+bob],[11,-45+bob]],'#8cb2a0',2);line(g,[[1,-39+bob],[4,-26+bob]],'#c8ab71',1);ellipse(g,3,-34+bob,2,2,'#e8c076');line(g,[[-15,-25+bob],[16,-25+bob]],'#d2b27a',3);
  line(g,armFront,'#aa8860',6);ellipse(g,...armFront[1],3.5,3.5,'#d9b581');ellipse(g,...armFront[2],4.7,4.7,'#e3c392');
  const hand=armFront[2];g.save();g.translate(...hand);g.rotate(cut>0?-.5:-1.1);line(g,[[0,0],[32,0]],'#fae3ad',2);poly(g,[[23,-2],[41,0],[23,2]],'#fff6d5');ellipse(g,-2,0,4,2.8,'#c29142');g.restore();
  A.mask(g,0,-67+bob,hero.maskKind||0,1,t);
  if(hero.hurt>0){g.globalCompositeOperation='screen';g.globalAlpha=.25+.2*Math.sin(t*35);glow(g,0,-42,60,'#ffcfaaa0');}
  g.restore();
 };
 A.moth=function(g,x,y,t,active=false,scale=1){
  g.save();g.translate(x,y);g.scale(scale,scale);glow(g,0,0,active?65:34,active?'#ffe89b75':'#ffd7773a');
  const flap=.35+Math.abs(Math.sin(t*16))*.65;g.save();g.scale(flap,1);g.rotate(-.2);ellipse(g,-10,-5,12,7,'#f8e7b6');ellipse(g,10,-5,12,7,'#f8e7b6');ellipse(g,-7,3,7,5,'#d0b16a');ellipse(g,7,3,7,5,'#d0b16a');g.restore();ellipse(g,0,0,3,7,'#fff0b1');line(g,[[-1,-5],[-5,-11]],'#d6b779',.8);line(g,[[1,-5],[5,-11]],'#d6b779',.8);g.restore();
 };
 A.lantern=function(g,x,y,t,lit=true,scale=1){
  g.save();g.translate(x,y);g.scale(scale,scale);const swing=Math.sin(t*1.2+x)*.025;g.rotate(swing);
  line(g,[[0,-110],[0,-48]],'#8c846966',1);ellipse(g,0,-44,8,7,'#8a6c3c');ellipse(g,0,-44,5,4,'#14313a');
  if(lit)glow(g,0,-21,68,'#ffce6847');poly(g,[[-13,-34],[13,-34],[17,-5],[-17,-5]],'#58452e');
  poly(g,[[-9,-31],[9,-31],[12,-8],[-12,-8]],lit?'#eac370':'#14353c');line(g,[[0,-31],[0,-7]],'#6e532e',2);poly(g,[[-18,-34],[0,-42],[18,-34]],'#b79451');poly(g,[[-19,-5],[19,-5],[15,0],[-15,0]],'#b79451');if(lit)ellipse(g,-5,-24,3,8,'#ffe8a6');g.restore();
 };
 A.thread=function(g,r,camera,t,selected=false){
  g.save();const startX=r.a.x-camera,startY=620-r.a.z,endX=r.b.x-camera,endY=620-r.b.z;
  const cy=620-r.mid;g.beginPath();g.moveTo(startX,startY);g.quadraticCurveTo((startX+endX)/2,cy,endX,endY);
  g.strokeStyle=selected?'#fce6a9':'#cbb373';g.lineWidth=selected?12:9;g.globalAlpha=.10;g.stroke();
  g.globalAlpha=1;g.lineWidth=selected?3:2.2;g.strokeStyle=selected?'#fff0b4':'#e4bf76';g.stroke();
  g.setLineDash([3,12]);g.lineDashOffset=-t*22;g.strokeStyle='#fff9db';g.lineWidth=1;g.stroke();g.setLineDash([]);
  for(let i=0;i<=7;i++){const u=i/7,pt=A.threadPoint(r,u);star(g,pt.x-camera,620-pt.z,2.5+(i%2),'#edcf8e',Math.PI/4);}
  glow(g,startX,startY,25,'#eace7440');ellipse(g,startX,startY,6,6,'#e8c475');ellipse(g,startX,startY,3,3,'#17323b');g.restore();
 };
 A.threadPoint=(r,u)=>({x:r.a.x+(r.b.x-r.a.x)*u,z:(1-u)*(1-u)*r.a.z+2*(1-u)*u*r.mid+u*u*r.b.z});
 A.enemy=function(g,e,camera,t){
  const x=e.x-camera,y=620-e.z;g.save();g.translate(x,y);g.scale(e.dir||1,1);const bob=Math.sin(t*8+e.x)*2;ellipse(g,0,3,24,5,'#0005');
  for(let i=0;i<3;i++){const s=Math.sin(t*12+i*2)*4;line(g,[[-14+i*13,-12],[(-20+i*16)+s,-5],[(-26+i*20)+s,1]],'#7c7060',3);}
  ellipse(g,0,-17+bob,24,16,e.hit>0?'#e4cbbb':'#243347');poly(g,[[-25,-18+bob],[0,-39+bob],[23,-18+bob]],e.hit>0?'#f6d29b':'#3e5263');line(g,[[0,-35+bob],[0,-7+bob]],'#d29b78',2);for(let j=0;j<4;j++)line(g,[[-3,-29+j*5+bob],[3,-27+j*5+bob]],'#f4bd8966',1);
  ellipse(g,17,-19+bob,9,8,'#13222c');ellipse(g,20,-21+bob,2.5,3.5,e.alert?'#ffb97a':'#f8d5a5');line(g,[[16,-25+bob],[24,-38+bob]],'#aa9776',1);ellipse(g,25,-38+bob,2.5,2.5,'#dbaa76');g.restore();
 };
 A.boss=function(g,b,camera,t){
  const x=b.x-camera,y=620-b.z;g.save();g.translate(x,y);const bob=Math.sin(t*.8)*8;g.translate(0,bob);const phase=b.phase||'sleep';const anger=phase==='telegraph'?Math.sin(t*28)*2:0;g.rotate(anger*.004);
  line(g,[[-78,-147],[-118,-510]],'#9d8c7150',2);line(g,[[70,-148],[124,-510]],'#9d8c7150',2);
  glow(g,0,-110,180,b.hp===0?'#ffd99250':'#c2815630');
  const armDrop=phase==='slam'?80:phase==='telegraph'?-70:0;
  for(const side of [-1,1]){const armY=-100+armDrop;line(g,[[side*60,-170],[side*115,-113],[side*144,armY]],'#34323b',20);line(g,[[side*60,-174],[side*115,-117],[side*144,armY-4]],'#7c6856',7);ellipse(g,side*114,-113,12,12,'#b79b64');ellipse(g,side*114,-113,6,6,'#3b4342');ellipse(g,side*148,armY+8,28,22,'#5c4d42');line(g,[[side*132,armY-5],[side*159,armY-5]],'#bfa272',2);}
  const robe=g.createLinearGradient(-80,-150,80,-30);robe.addColorStop(0,'#29454b');robe.addColorStop(.45,'#45545a');robe.addColorStop(1,'#192e38');poly(g,[[-55,-185],[56,-185],[95,-40],[65,-23],[40,-40],[18,-20],[-8,-40],[-30,-20],[-59,-36],[-94,-22]],robe);
  line(g,[[-43,-165],[-58,-59]],'#8b927071',2);line(g,[[40,-165],[62,-50]],'#8b927071',2);line(g,[[-27,-161],[-17,-51]],'#8b927071',1);
  ellipse(g,0,-212,58,56,'#504b43');ellipse(g,-4,-217,53,51,'#bca675');ellipse(g,-6,-217,43,41,'#444b49');
  for(let i=0;i<12;i++){const a=i*TAU/12;line(g,[[Math.sin(a)*35-6,-217+Math.cos(a)*35],[Math.sin(a)*39-6,-217+Math.cos(a)*39]],'#cbb677',2);}
  line(g,[[-6,-217],[-6+Math.sin(t*.3)*27,-217-Math.cos(t*.3)*27]],'#e5d091',3);line(g,[[-6,-217],[-30,-228]],'#e5d091',2);
  ellipse(g,-22,-211,6,7,b.hp===0?'#ffeabd':'#e79467');ellipse(g,16,-211,6,7,b.hp===0?'#ffeabd':'#e79467');
  poly(g,[[-65,-247],[-38,-267],[-14,-282],[10,-267],[37,-277],[61,-249]],'#665b4b');line(g,[[-65,-247],[61,-249]],'#c7af79',4);
  const sealY=-95;ellipse(g,0,sealY,25,31,phase==='exposed'?'#c8a96c':'#35444b');ellipse(g,0,sealY,17,23,phase==='exposed'?'#ffe1a0':'#7e715e');
  if(phase==='exposed'){glow(g,0,sealY,72,'#ffd37560');star(g,0,sealY,15,'#fff1b7',t*.5);}
  for(let i=0;i<3;i++){const xx=(i-1)*38,broken=i>=b.hp;g.save();g.globalAlpha=broken?.25:1;line(g,[[xx,-165],[xx,-144]],'#bd9d62',2);poly(g,[[xx-9,-145],[xx+9,-145],[xx+14,-123],[xx-14,-123]],broken?'#3b4240':'#c2a463');ellipse(g,xx,-121,14,4,broken?'#303c3d':'#e0c98b');g.restore();}
  if(b.hit>0){g.globalCompositeOperation='screen';glow(g,0,-110,145,'#ffdc9490');}g.restore();
 };
 A.gate=function(g,gate,camera,t){
  const x=gate.x-camera,y=620-gate.z;if(x<-150||x>1430)return;g.save();g.translate(x,y);g.globalAlpha=gate.open?Math.max(0,1-gate.fade):1;
  line(g,[[-20,2],[-20,-145],[20,-145],[20,2]],'#8f7248',7);
  for(let i=0;i<4;i++){const y0=-i*34;line(g,[[-20,y0],[20,y0-28]],'#be9163',3);line(g,[[20,y0],[-20,y0-28]],'#476867',2);}
  glow(g,0,-72,35,'#d7993c30');ellipse(g,0,-72,12,12,'#e2bf79');star(g,0,-72,8,'#fbedc2',Math.PI/4);g.restore();
 };
 A.frame=function(g,t,open=1){
  // Velvet folds and a gilt proscenium frame stay fixed as scenery moves.
  for(const side of [-1,1]){g.save();if(side===1){g.translate(1280,0);g.scale(-1,1);}const width=28+(1-open)*190;const grad=g.createLinearGradient(0,0,width,0);grad.addColorStop(0,'#190f20');grad.addColorStop(.34,'#542535');grad.addColorStop(.54,'#2f1729');grad.addColorStop(.72,'#663141');grad.addColorStop(1,'#1c1527');g.fillStyle=grad;g.beginPath();g.moveTo(0,0);g.lineTo(width+20,0);g.bezierCurveTo(width+14,120,width-6,225,width*.5,310);g.quadraticCurveTo(width*.55,480,width+14,720);g.lineTo(0,720);g.fill();line(g,[[width+16,0],[width+8,120],[width-8,230],[width*.5,310]],'#b99a6266',2);ellipse(g,width*.5+1,315,5,15,'#c3a568');g.restore();}
  const valance=g.createLinearGradient(0,0,0,64);valance.addColorStop(0,'#19151f');valance.addColorStop(1,'#3d243080');g.fillStyle=valance;g.beginPath();g.moveTo(0,0);g.lineTo(1280,0);g.lineTo(1280,39);for(let x=1280;x>0;x-=160)g.quadraticCurveTo(x-80,70,x-160,36);g.closePath();g.fill();
  line(g,[[0,5],[1280,5]],'#d1ae6360',1);line(g,[[8,0],[8,720]],'#bd9b5240',1);line(g,[[1272,0],[1272,720]],'#bd9b5240',1);line(g,[[0,715],[1280,715]],'#bd9b5240',1);
  g.save();g.translate(640,26);poly(g,[[-29,-15],[-18,4],[0,16],[18,4],[29,-15]],'#8b704550');star(g,0,0,10,'#caab68',Math.PI/4);g.restore();
 };
 A.checkpoint=function(g,c,camera,t,active){
  const x=c.x-camera,y=620-c.z;line(g,[[x,y],[x,y-80]],'#8d734f',5);poly(g,[[x-18,y],[x+19,y],[x+12,y-7],[x-11,y-7]],'#7e7158');A.lantern(g,x,y-80,t,active,.85);if(active)glow(g,x,y-104,90,'#f9ce5625');
 };
 A.scenery=function(g,section,camera,t,victory=false){
  g.save();
  if(section===1){
   // A raised set of hanging wooden hoops replaces the grove's low scenery.
   for(let i=0;i<5;i++){
    const x=2300+i*485-camera*.88,y=250+(i%3)*35;if(x<-220||x>1500)continue;
    g.save();g.translate(x,y);g.rotate(Math.sin(t*.4+i)*.016);g.globalAlpha=.35;
    line(g,[[-70,-350],[-70,-70]],'#dac38b',1.5);line(g,[[70,-350],[70,-70]],'#dac38b',1.5);
    g.strokeStyle='#b5a06d';g.lineWidth=9;g.beginPath();g.ellipse(0,0,99,99,0,0,TAU);g.stroke();g.strokeStyle='#e1c68b';g.lineWidth=1;g.beginPath();g.ellipse(0,0,92,92,0,0,TAU);g.stroke();
    for(let j=0;j<9;j++){const a=j*.42+.4;ellipse(g,Math.cos(a)*99,Math.sin(a)*99,8,18,j%2?'#9daa76':'#639181');}
    g.globalAlpha=.6;A.lantern(g,0,60,t,true,.65);g.restore();
   }
  }else if(section===2){
   // Brass organ pipes form a distinct final set, with warm light after victory.
   for(let i=0;i<11;i++){
    const x=4870+i*215-camera*.88,y=590,h=215+(i%4)*75;if(x<-100||x>1390)continue;
    const grad=g.createLinearGradient(x-20,0,x+20,0);grad.addColorStop(0,'#4a4838');grad.addColorStop(.3,'#9e9863');grad.addColorStop(.55,'#555d4e');grad.addColorStop(1,'#182f36');
    g.globalAlpha=.31;g.fillStyle=grad;g.fillRect(x-20,y-h,40,h);ellipse(g,x,y-h,20,8,'#c1ac76');ellipse(g,x,y-h+1,13,5,'#102530');
    line(g,[[x-22,y-h+30],[x+22,y-h+30]],'#d7b776',5);line(g,[[x-22,y-55],[x+22,y-55]],'#a39367',4);
    g.globalAlpha=victory?.6:.18;glow(g,x,y-h+25,80,victory?'#f5c66566':'#9bc9ad3a');
   }
  }
  g.restore();
 };
})();
