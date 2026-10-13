/* Original, articulated cut-paper puppets. All coordinates use a 1280 × 720 stage. */
(function(root){
'use strict';
const TAU=Math.PI*2;
function poly(g,p,c,stroke='#f2dbaf',width=1.8){g.beginPath();p.forEach((v,i)=>i?g.lineTo(...v):g.moveTo(...v));g.closePath();g.fillStyle=c;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.lineJoin='round';g.stroke();}}
function ell(g,x,y,rx,ry,c,stroke=null,w=1){g.beginPath();g.ellipse(x,y,Math.abs(rx),Math.abs(ry),0,0,TAU);g.fillStyle=c;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}}
function line(g,p,c,w=2){g.beginPath();p.forEach((v,i)=>i?g.lineTo(...v):g.moveTo(...v));g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.stroke();}
function glow(g,x,y,r,c='#f8cb72',a=.4){g.save();g.globalAlpha*=a;const d=g.createRadialGradient(x,y,1,x,y,r);d.addColorStop(0,c);d.addColorStop(.3,c+'88');d.addColorStop(1,c+'00');g.fillStyle=d;g.fillRect(x-r,y-r,r*2,r*2);g.restore();}
function grain(g,x,y,w,h,a=.13){g.save();g.globalAlpha*=a;g.strokeStyle='#fff4c9';g.lineWidth=.6;for(let i=0;i<18;i++){const px=x+((i*73.91)%w),py=y+((i*37.29)%h);g.beginPath();g.moveTo(px,py);g.lineTo(px+3,py-2);g.stroke();}g.restore();}
function shadow(g,x,y,s=1){ell(g,x,y+2,38*s,8*s,'#06192365');}
function fox(g,x,y,t,o={}){
 const sc=o.scale||1,run=o.run||0,jump=o.jump||0,face=o.face===undefined?1:o.face,flip=Math.abs(face)<.12?.12:face,bob=Math.sin(t*5)*1.4+Math.abs(Math.sin(t*14))*run*3;
 g.save();g.translate(x,y);g.scale(sc,sc);if(o.shadow!==false)shadow(g,0,0,.85);g.translate(0,-jump-bob);g.scale(flip,1);g.rotate((o.lean||0)+Math.sin(t*7)*.025*run);if(o.hurt)g.globalAlpha=.58+.35*Math.sin(t*45);
 // Tail folds behind the jacket.
 g.save();g.translate(-15,-31);g.rotate(Math.sin(t*4)*.09+run*.12);poly(g,[[0,4],[-31,0],[-54,-19],[-63,-40],[-51,-35],[-29,-35],[-13,-19]],'#d1874f');poly(g,[[-31,0],[-54,-19],[-63,-40],[-51,-35],[-40,-35],[-42,-21]],'#fff0c6');line(g,[[-13,-19],[-37,-17],[-51,-35]],'#ba713b',1);g.restore();
 // Boots swing independently.
 const gait=Math.sin(t*14)*run;
 for(const side of [-1,1]){g.save();g.translate(side*11,-23);g.rotate(gait*.48*side);poly(g,[[-7,0],[6,0],[6,17],[12,20],[12,25],[-8,25]],side===-1?'#263d47':'#365360');line(g,[[-5,18],[6,18]],'#e2bf7f',2);g.restore();}
 // Jacket, hem and seam.
 poly(g,[[-20,-67],[15,-66],[26,-23],[7,-17],[-23,-23]],'#4c8f87');poly(g,[[0,-65],[15,-66],[26,-23],[7,-17]],'#31706f','#6faaa0',1);poly(g,[[-23,-29],[24,-29],[26,-23],[7,-17],[-23,-23]],'#d7ad68');line(g,[[0,-60],[3,-31]],'#d1d7b2',1.4);ell(g,3,-43,2,2,'#edcf94');
 // Back arm.
 g.save();g.translate(-18,-57);g.rotate(-gait*.5);poly(g,[[-4,-3],[6,-2],[3,24],[-7,24]],'#337577');ell(g,-2,24,7,7,'#f5d79d','#f5e6bd',1.5);g.restore();
 // Paper head, ears, muzzle and creases.
 g.save();g.translate(1,-75);g.rotate(Math.sin(t*3)*.025+(o.look||0));
 poly(g,[[-27,-18],[-28,-51],[-7,-37],[12,-42],[29,-52],[28,-16],[34,-4],[16,11],[-8,12],[-29,-1]],'#e7a05e');
 poly(g,[[-23,-44],[-23,-23],[-10,-31]],'#6b5660',null);poly(g,[[24,-45],[14,-33],[25,-24]],'#83535c',null);
 poly(g,[[-27,-12],[-11,-7],[1,5],[16,-11],[31,-11],[34,-4],[16,11],[-8,12],[-29,-1]],'#ffefcb');
 poly(g,[[0,-36],[12,-42],[28,-16],[16,-11],[1,5]],'#d4874c',null);
 line(g,[[-27,-18],[-9,-25],[0,-36]],'#f3c58a',1.2);line(g,[[1,5],[4,-14]],'#cfa576',1);
 const blink=Math.sin(t*.83)> .994;
 if(blink){line(g,[[-18,-13],[-10,-13]],'#253945',2);line(g,[[13,-15],[20,-15]],'#253945',2);}else{ell(g,-14,-14,3,4.5,'#1c3542');ell(g,17,-16,3.3,4.6,'#1c3542');ell(g,18,-17.5,1,1.4,'#fff5de');ell(g,-13,-15,1,1.2,'#fff5de');}
 poly(g,[[0,2],[6,1],[4,5]],'#20313b',null);line(g,[[4,5],[7,8],[12,6]],'#78534b',1);ell(g,-22,-5,4,2,'#e8a07f');grain(g,-23,-29,43,25,.25);g.restore();
 // Scarf and its separate wind-driven strip.
 poly(g,[[-24,-70],[22,-72],[21,-62],[-17,-58],[-25,-62]],'#d46c4e');poly(g,[[-16,-60],[-28,-51],[-53+Math.sin(t*6)*5,-58-run*7],[-64,-49],[-57,-64],[-28,-68]],'#bf563f');line(g,[[-52,-59],[-31,-58],[-20,-64]],'#efab79',1);
 // Satchel strap, letter flap and one front hand.
 line(g,[[-18,-65],[19,-24]],'#3e4d42',7);line(g,[[-19,-65],[18,-24]],'#e3be7f',3);poly(g,[[4,-44],[30,-42],[34,-18],[8,-16]],'#b5834c');poly(g,[[4,-44],[30,-42],[19,-30]],'#e5be7c');ell(g,19,-29,2.3,2.3,'#34524b');line(g,[[10,-18],[29,-20]],'#754f3b',1.2);
 g.save();g.translate(17,-57);g.rotate(-gait*.44-(o.attack||0)*1.4);poly(g,[[-5,-4],[7,-1],[10,18],[-1,21]],'#448980');ell(g,7,21,7,7,'#f0d398','#ffe7b5',1.5);if(o.attack){poly(g,[[6,21],[13,19],[22,-3],[16,-6]],'#edc181');poly(g,[[12,-7],[23,-11],[36,-1],[32,12],[16,7]],'#b4774c');line(g,[[18,-5],[29,1],[25,7]],'#f5d696',2);}g.restore();
 if(o.flash){g.globalCompositeOperation='screen';glow(g,0,-58,66,'#ffe6b0',o.flash);}g.restore();
}
function moth(g,x,y,t,o={}){
 const sc=o.scale||1;g.save();g.translate(x,y+Math.sin(t*3.3)*5);g.scale(sc,sc);glow(g,0,0,58,'#ffd586',.28+(o.cast||0)*.4);const flap=.53+Math.sin(t*17)*.21;
 for(const side of[-1,1]){g.save();g.scale(side,1);g.rotate(-.15);g.scale(flap,1);poly(g,[[2,-4],[18,-30],[42,-24],[33,-3],[13,7]],'#fff0bf','#dfbd73',1.5);poly(g,[[4,4],[28,6],[34,23],[14,20],[2,11]],'#e5bd7c','#fae3ac',1.5);poly(g,[[7,-5],[18,-23],[29,-21],[19,-8]],'#89b8a1',null);line(g,[[4,0],[19,-9],[37,-22]],'#cc995c',1);g.restore();}
 ell(g,0,2,7,14,'#e5aa55','#fff0b7',1.5);ell(g,0,-9,9,8,'#fff0b7','#edc980',1.5);ell(g,-3,-10,1.5,2.2,'#35484a');ell(g,3,-10,1.5,2.2,'#35484a');line(g,[[-3,-15],[-8,-23],[-11,-22]],'#e7c996',1.6);line(g,[[3,-15],[8,-23],[11,-22]],'#e7c996',1.6);glow(g,0,8,17,'#fff2ba',.8);g.restore();
}
function npc(g,x,y,t,o={}){
 const sc=o.scale||1;g.save();g.translate(x,y+Math.sin(t*3)*1.7);g.scale(sc,sc);shadow(g,0,0,1);
 // Orrin, a small paper badger with a coat and a postal cap.
 poly(g,[[-32,-32],[-20,-79],[24,-77],[36,-31]],'#727774');ell(g,-21,-94,12,16,'#c1baa0','#f1dfb4',2);ell(g,22,-94,12,16,'#c1baa0','#f1dfb4',2);poly(g,[[-31,-85],[-23,-107],[22,-107],[34,-85],[24,-63],[-22,-65]],'#ece0bf');poly(g,[[-25,-104],[-10,-101],[-5,-67],[-19,-70]],'#405962',null);poly(g,[[10,-103],[24,-100],[26,-71],[13,-65]],'#405962',null);ell(g,-13,-86,3,3,'#152f3c');ell(g,17,-86,3,3,'#152f3c');ell(g,2,-75,6,4,'#283f49');
 poly(g,[[-29,-110],[-17,-122],[24,-120],[31,-108]],'#49787b');poly(g,[[-31,-109],[35,-107],[30,-100],[-33,-103]],'#36656c');ell(g,1,-114,4,4,'#e8c688');
 poly(g,[[-24,-63],[26,-62],[38,-11],[-37,-11]],'#587c75');poly(g,[[-12,-62],[2,-45],[16,-61],[7,-24],[-9,-26]],'#e4bd7d');line(g,[[2,-46],[2,-15]],'#d4c39e',1.5);ell(g,3,-24,2.2,2.2,'#eaca8f');
 poly(g,[[-29,-16],[-8,-16],[-8,1],[-34,1]],'#3d424a');poly(g,[[12,-16],[31,-16],[36,1],[11,1]],'#3d424a');poly(g,[[-32,-56],[-41,-25],[-30,-22],[-19,-52]],'#46686b');ell(g,-36,-23,7,7,'#dcc9a2');poly(g,[[25,-56],[40,-29],[31,-23],[13,-50]],'#46686b');ell(g,35,-24,7,7,'#dcc9a2');poly(g,[[22,-32],[46,-40],[55,-21],[31,-13]],'#efdeb7');line(g,[[23,-31],[39,-26],[46,-40]],'#b17e55',1.5);g.restore();
}
function enemy(g,kind,x,y,t,o={}){
 const s=o.scale||1;g.save();g.translate(x,y);g.scale(s,s);g.rotate(o.lean||0);if(o.shadow!==false)shadow(g,0,0,kind==='bell'?1.8:.85);if(o.hurt)g.globalAlpha=.65+Math.sin(t*40)*.25;
 const bob=Math.sin(t*4)*3;g.translate(0,bob-(o.jump||0));
 if(kind==='bell'){
  const rot=Math.sin(t*2)*.035+(o.attack||0)*.1+(o.swing||0); g.rotate(rot);glow(g,0,-73,115,o.ward?'#a887d0':'#efc77a',.24);for(const side of [-1,1]){g.save();g.scale(side,1);g.rotate(Math.sin(t*3)*.025);poly(g,[[28,-105],[78,-142],[98,-122],[105,-60],[75,-77],[85,-39],[49,-63],[35,-31]],'#3c5767','#b6b4a5',2);poly(g,[[41,-92],[78,-121],[81,-91],[66,-93],[68,-66]],'#54717a','#99b2ac',1);g.restore();}
  poly(g,[[-50,-121],[-31,-148],[25,-149],[48,-123],[43,-43],[64,-22],[63,-10],[-64,-10],[-65,-25],[-43,-48]],'#bb905c','#f6d59a',2.7);poly(g,[[1,-145],[25,-149],[48,-123],[43,-43],[64,-22],[63,-10],[1,-10]],'#8e6747',null);poly(g,[[-49,-123],[-31,-148],[25,-149],[48,-123],[31,-111],[-32,-111]],'#e2bd76','#f5d899',2);line(g,[[-41,-45],[42,-45]],'#f1d294',4);line(g,[[-62,-20],[59,-20]],'#edc982',3);ell(g,0,-4,13,12,'#d8b065','#edd296',2);
  poly(g,[[-38,-106],[-10,-101],[-13,-73],[-32,-78]],'#16383f','#b4ac8e',1);poly(g,[[9,-101],[37,-106],[31,-78],[12,-73]],'#16383f','#b4ac8e',1);glow(g,-22,-89,20,'#f9d786',.45);glow(g,22,-89,20,'#f9d786',.45);ell(g,-22,-89,4,7,'#fff0b4');ell(g,22,-89,4,7,'#fff0b4');poly(g,[[-7,-85],[7,-85],[0,-65]],'#e4bd79');
  line(g,[[-24,-57],[0,-53],[24,-57]],'#5c5545',2);if(o.phase===2){line(g,[[-30,-122],[-18,-109],[-22,-93],[-11,-77],[-16,-61]],'#ffe0a0',2.3);line(g,[[25,-115],[16,-102],[21,-86]],'#f5d087',1.8);glow(g,-18,-89,33,'#f2c676',.16);}if(o.calm){line(g,[[-28,-92],[-22,-95],[-16,-92]],'#fff0b4',2);line(g,[[16,-92],[22,-95],[28,-92]],'#fff0b4',2);}grain(g,-38,-125,76,96,.22);
  if(o.ward){g.save();g.globalAlpha=.45+Math.sin(t*4)*.15;g.setLineDash([12,9]);g.beginPath();g.ellipse(0,-80,86,102,0,0,TAU);g.strokeStyle='#c7a9f3';g.lineWidth=3;g.stroke();g.setLineDash([]);for(let i=0;i<5;i++){const a=t+i*TAU/5;glow(g,Math.cos(a)*85,-80+Math.sin(a)*101,12,'#d2b6ff',.8);}g.restore();}
 }else if(kind==='wing'){
  g.translate(0,-39+Math.sin(t*6)*5);for(const side of[-1,1]){g.save();g.scale(side,1);g.rotate(Math.sin(t*14)*.25);poly(g,[[1,-24],[22,-51],[58,-40],[45,-21],[30,-12],[22,6]],'#778899','#d5c9b1',2);poly(g,[[11,-20],[27,-39],[49,-39],[30,-27]],'#adbdac',null);line(g,[[14,-19],[28,-27],[45,-21]],'#455a70',1);g.restore();}poly(g,[[-21,-27],[-16,-43],[-2,-34],[16,-43],[23,-27],[17,1],[0,14],[-17,1]],'#556a78');poly(g,[[-14,-27],[0,-21],[14,-27],[10,-3],[-10,-3]],'#e0c695');ell(g,-8,-20,3,4,'#b45256');ell(g,8,-20,3,4,'#b45256');poly(g,[[-4,-8],[4,-8],[0,-3]],'#274348',null);
 }else if(kind==='ink'){
  ell(g,0,-22,30,30,'#c1baa3','#f2ddb0',2);poly(g,[[-27,-19],[-15,-21],[-18,0],[-32,0]],'#254b59');poly(g,[[16,-22],[28,-17],[32,0],[18,0]],'#254b59');ell(g,0,-40,48,27,'#365668','#8ca9a6',2.5);poly(g,[[-44,-38],[-35,-68],[-10,-83],[21,-77],[44,-52],[48,-36]],'#48697d','#bac7b0',2);poly(g,[[-10,-83],[20,-76],[43,-52],[46,-40],[1,-47]],'#2d4b63',null);ell(g,-19,-59,6,5,'#9cb7b0');ell(g,16,-63,5,4,'#b3c0a5');line(g,[[-43,-36],[43,-36]],'#7ca2a2',3);ell(g,-10,-22,3,5,'#243f49');ell(g,10,-22,3,5,'#243f49');line(g,[[-6,-10],[6,-10]],'#70585b',2);
 }else{
  const thorn=kind==='thorn';const c=thorn?'#61777b':'#859b70';for(let i=0;i<9;i++){const a=(i/9)*TAU;const rr=thorn?48:43;poly(g,[[Math.cos(a)*25,-31+Math.sin(a)*24],[Math.cos(a+.1)*rr,-31+Math.sin(a+.1)*rr],[Math.cos(a+.4)*26,-31+Math.sin(a+.4)*24]],c,'#c6c9a0',1.4);}
  ell(g,0,-28,31,29,thorn?'#48636b':'#7b8e63','#e8d2a0',2);poly(g,[[-17,-3],[-21,4],[-5,4],[0,-7]],'#44524f');poly(g,[[17,-3],[21,4],[5,4],[0,-7]],'#44524f');poly(g,[[-23,-35],[-7,-29],[-14,-20],[-27,-23]],'#f0dfb5',null);poly(g,[[7,-29],[23,-35],[27,-23],[14,-20]],'#f0dfb5',null);ell(g,-16,-27,3,4,'#223d46');ell(g,16,-27,3,4,'#223d46');line(g,[[-9,-13],[0,-16],[9,-13]],'#263f48',2);line(g,[[0,-53],[0,-63],[12,-70]],'#b2be8b',3);poly(g,[[1,-60],[5,-77],[23,-76],[13,-65]],'#93b785');
 }g.restore();
}
function lantern(g,x,y,t,o={}){
 const s=o.scale||1,lit=o.lit!==false;g.save();g.translate(x,y);g.scale(s,s);if(lit)glow(g,0,-48,100,o.color||'#f5cf81',.3+Math.sin(t*3)*.03);poly(g,[[-15,0],[-12,-8],[12,-8],[15,0]],'#507077');line(g,[[0,-8],[0,-104]],'#678d88',6);line(g,[[0,-8],[0,-104]],'#afbe9b',1.5);line(g,[[0,-104],[20,-111],[34,-102],[34,-88]],'#b9b995',3);
 g.save();g.translate(34,-75);g.rotate(Math.sin(t*2)*.04);line(g,[[0,-13],[0,-20]],'#dbcb9f',2);poly(g,[[-14,-12],[13,-12],[18,16],[0,25],[-18,16]],lit?'#e4b567':'#365967');poly(g,[[-10,-7],[10,-7],[13,13],[0,19],[-13,13]],lit?'#ffdf92':'#5c8181','#b0a57e',1);line(g,[[0,-12],[0,25]],'#917452',2);poly(g,[[-19,-13],[0,-22],[19,-13]],'#446966');if(lit)glow(g,0,5,32,'#ffe7a3',.65);g.restore();g.restore();
}
function seal(g,x,y,t,index,lit=false){
 g.save();g.translate(x,y);if(lit)glow(g,0,-82,93,'#f8cd7d',.4);poly(g,[[-37,0],[-26,-14],[25,-14],[39,0]],'#3e6970','#7d9f94',2);poly(g,[[-24,-10],[-19,-68],[20,-68],[24,-10]],'#48777c','#8cafa0',2);poly(g,[[-29,-65],[-20,-105],[19,-105],[30,-65]],lit?'#d4b76e':'#2f535f','#bfbea0',2);poly(g,[[-19,-100],[0,-112],[19,-100],[21,-72],[-21,-72]],lit?'#f9d990':'#4d7278','#c4c09f',1.5);
 const c=lit?'#fff5bd':'#dbd4a9';if(index===1){ell(g,0,-85,8,8,c);for(let i=0;i<8;i++){let a=i*TAU/8;line(g,[[Math.cos(a)*11,-85+Math.sin(a)*11],[Math.cos(a)*15,-85+Math.sin(a)*15]],c,1.5);}}else if(index===2){poly(g,[[0,-100],[12,-94],[8,-79],[-8,-73],[-11,-88]],c,null);line(g,[[-8,-74],[5,-94]],'#4c7575',1.3);}else{ell(g,0,-85,12,13,c);ell(g,6,-90,10,11,lit?'#e5bd71':'#4d7278');}
 g.font='10px Trebuchet MS';g.textAlign='center';g.fillStyle='#c8d3b8';g.fillText(['MOON','SUN','LEAF'][index],0,-39);g.restore();
}
function mail(g,x,y,t,o={}){g.save();g.translate(x,y+Math.sin(t*3)*4);g.rotate(Math.sin(t*2)*.07);glow(g,0,0,45,'#f5d189',.28);poly(g,[[-19,-12],[19,-12],[19,12],[-19,12]],'#eeddb4','#fbefcc',1.5);line(g,[[-18,-11],[0,2],[18,-11]],'#ba875b',1.8);poly(g,[[9,-8],[15,-8],[15,-2],[9,-2]],'#8cab9c',null);g.restore();}
function rune(g,x,y,t,active){g.save();g.translate(x,y);g.globalAlpha=active?.9:.7;glow(g,0,-4,55,'#a1d9cc',.25);g.strokeStyle=active?'#e6cb86':'#8cc0b4';g.lineWidth=2;g.beginPath();g.ellipse(0,0,28,10,0,0,TAU);g.stroke();for(const a of[0,TAU/3,2*TAU/3]){const px=Math.cos(a+t*.4)*24,py=Math.sin(a+t*.4)*7;ell(g,px,py,2,2,'#e8d795');}poly(g,[[-7,-2],[0,-10],[7,-2],[0,4]],'#adcaba',null);g.restore();}
function chest(g,x,y,t,open,amount=open?1:0){g.save();g.translate(x,y);shadow(g,0,0,.9);poly(g,[[-30,-31],[27,-31],[29,0],[-29,0]],'#987b54');poly(g,[[-30,-31],[-22,-44],[23,-44],[28,-31]],'#cbad72');if(open){g.save();g.translate(-25,-30);g.rotate(-.7*amount);poly(g,[[0,0],[0,-24],[53,-24],[53,0]],'#ac8f60');g.restore();}line(g,[[-20,-37],[-20,-1]],'#e4c88c',4);line(g,[[20,-37],[20,-1]],'#e4c88c',4);poly(g,[[-6,-24],[6,-24],[6,-13],[-6,-13]],'#eacc90');ell(g,0,-18,2,3,'#445956');if(!open)glow(g,0,-25,55,'#eed194',.16);g.restore();}
function sign(g,x,y,label){g.save();g.translate(x,y);line(g,[[0,0],[0,-61]],'#b19466',5);poly(g,[[-48,-70],[31,-70],[46,-57],[30,-45],[-48,-45]],'#5a7970','#afbea0',1.5);g.fillStyle='#f4e0ae';g.textAlign='center';g.font='10px Trebuchet MS';g.fillText(label,-5,-53);g.restore();}
function bridge(g,x0,x1,y,fold,t){const len=x1-x0;for(let i=0;i<9;i++){const progress=Math.max(0,Math.min(1,fold*1.8-i*.09));if(progress<=0)continue;const w=len/9;g.save();g.translate(x0+i*w,y);g.scale(1,Math.max(.025,progress));poly(g,[[0,-24],[w+2,-24],[w+2,33],[0,33]],i%2?'#b9aa74':'#d4bf81','#ece0ad',1);line(g,[[2,24],[w-2,24]],'#9b926b',1);g.restore();}if(fold>.95){line(g,[[x0,y-24],[x1,y-24]],'#ded7a1',2);line(g,[[x0,y+33],[x1,y+33]],'#ded7a1',2);}}
function foliage(g,x,y,t,s=1,c='#214b59'){g.save();g.translate(x,y);g.scale(s,s);g.rotate(Math.sin(t+x)*.015);for(let i=0;i<6;i++){const a=-Math.PI*.8+i*.23,len=35+(i%3)*8;const ex=Math.cos(a)*len,ey=Math.sin(a)*len;poly(g,[[0,0],[ex-10,ey+6],[ex,ey],[ex+9,ey+7]],c,null);line(g,[[0,0],[ex,ey]],'#76978a50',.8);}g.restore();}
function coin(g,x,y,t){g.save();g.translate(x,y+Math.sin(t*4)*3);g.scale(.8+.2*Math.sin(t*3),1);poly(g,[[0,-8],[8,0],[0,8],[-8,0]],'#f5cf84','#fff0bf',1.5);g.restore();}
function audience(g,t,ovation){for(let i=0;i<15;i++){const x=78+i*80,base=697+(i%2)*15,y=base-(ovation?Math.max(0,Math.sin(t*(5+ovation*.5)+i))*ovation*.7:0);g.save();g.globalAlpha=.65;const color=['#345563','#395e61','#486d63'][i%3];ell(g,x,y,23,24,color);if(i%3===0){poly(g,[[x-18,y-12],[x-20,y-43],[x-2,y-20]],color,null);poly(g,[[x+18,y-12],[x+20,y-43],[x+2,y-20]],color,null);}else if(i%3===1){ell(g,x-16,y-20,9,11,color);ell(g,x+16,y-20,9,11,color);}g.restore();}}
root.FoldlightArt={poly,ell,line,glow,grain,shadow,fox,moth,npc,enemy,lantern,seal,mail,rune,chest,sign,bridge,foliage,coin,audience};
})(window);
