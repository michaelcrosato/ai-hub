/* Reedbound world. Original geometry and art; projected and sorted by my-3D2dge. */
(function(root){
'use strict';
const E=root.My3D2dge,TAU=Math.PI*2,rand=E.rng(8174);
const C={ink:'#234347',edge:'#3a5550',grass:'#aeb89b',light:'#dde0ba',water:'#759b99',paper:'#e9e2c9',red:'#b46045',gold:'#c59a57'};
const islands=[
 [[62,558],[104,464],[230,392],[373,385],[503,363],[650,418],[789,443],[850,516],[857,694],[783,812],[657,880],[438,908],[256,860],[117,774],[72,672]],
 [[1066,515],[1146,423],[1280,396],[1458,410],[1582,469],[1610,590],[1598,720],[1496,812],[1344,872],[1196,826],[1070,704]],
 [[1651,552],[1719,437],[1862,349],[2064,375],[2203,468],[2302,584],[2280,749],[2145,842],[1926,873],[1788,805],[1670,704]]
];
const paths=[[[180,668],[375,639],[530,655],[770,618],[900,619],[1098,619],[1300,623],[1460,591],[1590,610],[1762,623],[2010,669],[2195,648]],[[482,637],[506,535]],[[1380,624],[1425,468]],[[1250,638],[1245,771]],[[2030,658],[2033,465]]];
function inPoly(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!==(p[j][1]>y))&&(x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0]))c=!c;}return c;}
function baseLand(x,y){return islands.some(p=>inPoly(x,y,p))||(x>830&&x<1095&&y>571&&y<670)||(x>1540&&x<1730&&y>549&&y<690);}
const groves=[{x:493,y:522,z:84,name:'Bank Willow',radius:340},{x:1410,y:470,z:84,name:'Reed Willow',radius:355},{x:2040,y:460,z:84,name:'Bell Willow',radius:470}];
const bridge={a:{x:846,y:620,z:6},b:{x:1085,y:620,z:6}};
const thorns=[{x:778,y:620,r:47,id:'passage'},{x:1250,y:763,r:30,id:'rescue'}];
const seeds=[{x:565,y:815,z:10},{x:1500,y:775,z:10},{x:1920,y:795,z:10}];
const props=[],texture=[],waterMarks=[];
for(let i=0;i<450;i++){const x=70+rand()*2200,y=350+rand()*550;if(baseLand(x,y)){texture.push({x,y,s:3+rand()*19,a:rand(),v:rand()});if(rand()<.65&&!paths.some(p=>p.some(q=>Math.hypot(q[0]-x,q[1]-y)<55))&&groves.every(t=>Math.hypot(t.x-x,t.y-y)>80))props.push({type:rand()<.2?'rock':'reeds',x,y,s:8+rand()*25,seed:i});}}
for(let i=0;i<115;i++)waterMarks.push({x:-200+rand()*2800,y:240+rand()*820,len:10+rand()*75,v:rand()});
const scenery=[{x:176,y:455,s:1.15},{x:663,y:455,s:.84},{x:393,y:853,s:.78},{x:1131,y:480,s:.8},{x:1553,y:504,s:.92},{x:2070,y:851,s:.68},{x:1842,y:423,s:.88},{x:2186,y:524,s:.7}];
function poly(g,pts,fill,stroke,width=1){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}g._c=null;}
function line(g,pts,color,width=1){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.stroke();g._c=null;}
function ellipse(g,x,y,rx,ry,fill,stroke,width=1){g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}g._c=null;}
function pathWorld(g,r,pts,fill,stroke,width=1,z=0){poly(g,pts.map(p=>r.w(p[0],p[1],z)),fill,stroke,width);}
function visible(r,x,y,pad=150){const [sx,sy]=r.w(x,y,0);return sx>-pad&&sx<r.W+pad&&sy>-pad&&sy<r.H+pad;}
function isRestored(x,y,s){return groves.some((t,i)=>s.groves[i]&&Math.hypot(x-t.x,y-t.y)<t.radius);}
function shadow(r,x,y,rx,ry,a=.12){const [sx,sy]=r.w(x,y,0);r.ctx.save();r.ctx.globalAlpha=a;ellipse(r.ctx,sx,sy,rx*r.view.scale,ry*r.view.scale,'#244447');r.ctx.restore();}
function drawTree(r,t,alive,tick,small=false){
 if(!visible(r,t.x,t.y,200))return;
 const k=t.s||1;shadow(r,t.x,t.y,small?33:58,small?10:19,.14);
 r.queue(t.x,t.y,0,g=>{
  const s=r.view.scale*k,[sx,sy]=r.w(t.x,t.y,0),local=(x,y)=>[sx+x*s,sy+y*s];
  const trunk=small?[[0,0],[-9,-23],[-5,-47],[-17,-78],[-11,-99],[1,-80],[7,-58],[5,-35],[10,-13],[13,0]]:[[-10,0],[-15,-24],[-5,-52],[-17,-75],[-15,-100],[-3,-87],[9,-65],[7,-39],[15,-17],[19,0]];
  poly(g,trunk.map(p=>local(p[0],p[1])),alive?'#6c7259':'#606462','#263e40',2.8);
  line(g,[local(1,-4),local(-2,-30),local(2,-49),local(-8,-73)],alive?'#a79c70':'#979780',2.3*s);
  const branches=[[[-5,-49],[-31,-72],[-47,-73],[-60,-95]],[[-8,-74],[17,-103],[40,-112],[49,-128]],[[4,-52],[36,-69],[49,-62],[66,-84]],[[-12,-83],[-26,-107],[-20,-126]]];
  for(let i=0;i<branches.length;i++){const p=branches[i].map(p=>local(p[0],p[1]));line(g,p,'#294245',5.4*s);line(g,p,'#717360',2.2*s);}
  if(alive){
   const rr=E.rng((t.x*29+t.y)|0);g.save();
   for(let j=0;j<(small?62:145);j++){
    const a=rr()*TAU,rad=Math.sqrt(rr()),x=Math.cos(a)*67*rad,y=-98+Math.sin(a)*38*rad;
    const p=local(x+Math.sin(tick*.8+j)*1.6,y);
    ellipse(g,p[0],p[1],(7+rr()*9)*s,(3+rr()*6)*s,['#7ca08c','#9bb39a','#bcc7a1','#c9c995','#72978a'][j%5]);
   }
   for(let j=0;j<14;j++){const x=(rr()-.5)*115,y=-80-rr()*32;g.beginPath();g.moveTo(...local(x,y));g.quadraticCurveTo(...local(x-8,y+35),...local(x+Math.sin(tick+j)*3,y+60));g.strokeStyle=j%2?'#6c947eaa':'#aac19baa';g.lineWidth=1.2*s;g.stroke();}
   for(let j=0;j<18;j++){const p=local((rr()-.5)*106,-88+(rr()-.5)*50);ellipse(g,p[0],p[1],2.7*s,1.7*s,j%3?'#e7d6ae':'#c77752');}
   g.restore();
  }else if(!small){const p=local(3,-63);ellipse(g,p[0],p[1],13*s,11*s,'#445659','#cfb075',1.5*s);ellipse(g,p[0],p[1],6*s,6*s,'#c5a768');line(g,[local(-7,-63),local(12,-63)],'#e1c590',1.2*s);}
  if(!small){for(const d of[-1,1])line(g,[local(d*7,-2),local(d*23,4),local(d*37,2)],alive?'#597760':'#535f5a',3*s);}
  g._c=null;
 });
}
function drawReeds(r,p,s){if(!visible(r,p.x,p.y,60))return;const alive=isRestored(p.x,p.y,s);r.queue(p.x,p.y,0,g=>{const [x,y]=r.w(p.x,p.y,0),k=r.view.scale;for(let j=0;j<5;j++){const sway=Math.sin(s.time*.9+p.seed+j)*2.5,dx=(j-2)*4,hh=p.s*(.6+.1*j);g.beginPath();g.moveTo(x+dx*k,y);g.quadraticCurveTo(x+(dx-2+sway)*k,y-hh*k*.6,x+(dx-7+sway)*k,y-hh*k);g.strokeStyle=alive?(j%2?'#799780':'#496f63'):(j%2?'#879185':'#616f69');g.lineWidth=j%2?1:1.5;g.stroke();if(j%2===0){line(g,[[x+(dx-7+sway)*k,y-hh*k],[x+(dx-2+sway)*k,y-(hh+5)*k]],alive?'#b79e6a':'#a19b80',3.2*k);}}g._c=null;});}
function drawRock(r,p){if(!visible(r,p.x,p.y,80))return;r.queue(p.x,p.y,0,g=>{const[x,y]=r.w(p.x,p.y),k=r.view.scale*.6,ss=p.s;poly(g,[[x-ss*k,y],[x-ss*k*.85,y-ss*k*.6],[x-ss*k*.1,y-ss*k],[x+ss*k*.7,y-ss*k*.6],[x+ss*k,y],[x,y+ss*k*.25]],'#84938a','#405955',1.2);poly(g,[[x-ss*k*.85,y-ss*k*.6],[x-ss*k*.1,y-ss*k],[x+ss*k*.7,y-ss*k*.6],[x-ss*k*.1,y-ss*k*.4]],'#b4bb9f');line(g,[[x-ss*k*.1,y-ss*k*.4],[x,y]],'#65796e',1);});}
function drawLantern(r,x,y,tick,active=true){if(!visible(r,x,y,90))return;shadow(r,x,y,10,4);r.queue(x,y,0,g=>{const [sx,sy]=r.w(x,y,0),s=r.view.scale;line(g,[[sx,sy],[sx,sy-43*s]],'#3f554e',5*s);poly(g,[[sx-13*s,sy-29*s],[sx-10*s,sy-50*s],[sx+10*s,sy-50*s],[sx+13*s,sy-29*s]],active?'#e7c68b':'#acb09b','#3f554e',2*s);line(g,[[sx-15*s,sy-51*s],[sx,sy-60*s],[sx+15*s,sy-51*s]],'#334e48',5*s);line(g,[[sx,sy-47*s],[sx,sy-33*s]],'#9a7146',1.3*s);if(active){g.save();g.globalAlpha=.15+Math.sin(tick*2)*.03;ellipse(g,sx,sy-39*s,25*s,28*s,'#f4d691');g.restore();}g._c=null;});}
function drawBridge(r,s){
 const g=r.ctx,a=bridge.a,b=bridge.b;
 const planks=s.bridge?18:4;
 for(let i=0;i<planks;i++){let x;if(s.bridge)x=a.x+i*13.4;else x=i<2?a.x+i*13.4:b.x-(i-2)*13.4;
  pathWorld(g,r,[[x,584],[x+11.8,584],[x+11.8,656],[x,656]],'#baa47a','#665e4e',1,5);
  line(g,[r.w(x+4,591,5),r.w(x+4,649,5)],'#d5c091',1.1);
 }
 for(const yy of [582,660]){
  if(s.bridge){line(g,[r.w(a.x,yy,22),r.w(b.x,yy,22)],'#4d6456',3.5);line(g,[r.w(a.x,yy,23),r.w(b.x,yy,23)],'#b6b190',1);}
  for(const x of [a.x,b.x]){line(g,[r.w(x,yy,0),r.w(x,yy,33)],'#4d6456',5);ellipse(g,...r.w(x,yy,35),3,3,'#c4b687');}
 }
 if(!s.bridge){g.save();g.setLineDash([6,12]);line(g,[r.w(a.x+15,620,5),r.w(b.x-15,620,5)],'#cba465',1.5);g.restore();for(const p of[a,b]){const[x,y]=r.w(p.x,p.y,6);ellipse(g,x,y,12,10,'#d9ba7960','#c49956',1.6);ellipse(g,x,y,4,4,'#e0be72');}}
}
function drawThorns(r,t,s){if(s.thorns[t.id]||!visible(r,t.x,t.y,100))return;shadow(r,t.x,t.y,t.r,12,.2);r.queue(t.x,t.y,0,g=>{const rr=E.rng(t.x),[x,y]=r.w(t.x,t.y,0),k=r.view.scale;for(let j=0;j<8;j++){const start=-t.r+j*t.r*.28;const pts=[[x+start*k,y+rr()*8],[x+(start-7)*k,y-14*k],[x+(start+13)*k,y-(25+rr()*12)*k],[x+(start+2)*k,y-55*rr()*k]];line(g,pts,'#35434b',5*k);poly(g,[[pts[2][0]-8*k,pts[2][1]+4*k],[pts[2][0]+4*k,pts[2][1]-13*k],[pts[2][0]+5*k,pts[2][1]+3*k]],'#35434b');}const p=r.w(t.x,t.y,28);ellipse(g,...p,13*k,10*k,'#a34c42','#e6b988',1.5);line(g,[[p[0]-6*k,p[1]+5*k],[p[0]+6*k,p[1]-5*k]],'#ecd6a9',2*k);});}
function drawOrrin(r,tick){const x=275,y=692;if(!visible(r,x,y,100))return;shadow(r,x,y,16,7);r.queue(x,y,0,g=>{const[sx,sy]=r.w(x,y,0),s=r.view.scale,bob=Math.sin(tick*1.5)*.7;const P=(x,y)=>[sx+x*s,sy+(y+bob)*s];poly(g,[P(-13,-8),P(-9,-39),P(4,-45),P(15,-36),P(16,-9),P(6,0),P(-6,0)],'#789b88','#2c4a47',2);poly(g,[P(-4,-38),P(4,-39),P(8,-5),P(-5,-9)],'#b9b898');ellipse(g,...P(2,-46),8*s,10*s,'#d6b98a','#475b4e',1.5);poly(g,[P(-24,-47),P(2,-65),P(28,-47),P(2,-40)],'#c2b580','#496058',1.7);line(g,[P(2,-65),P(2,-43)],'#a0986c',1);line(g,[P(22,0),P(22,-60)],'#576554',3*s);ellipse(g,...P(23,-62),4*s,4*s,'#b48553');});}
function drawBird(r,s){if(!visible(r,1250,775,70))return;r.queue(1250,775,0,g=>{const[x,y]=r.w(1250,775,s.rescued?Math.sin(s.time*2)*3+7:0),k=r.view.scale;ellipse(g,x,y-12*k,11*k,8*k,'#e6dfc6','#395651',1.4);ellipse(g,x+9*k,y-20*k,6*k,6*k,'#eadcc0','#395651',1.3);line(g,[[x+13*k,y-20*k],[x+22*k,y-18*k]],'#a67645',2);ellipse(g,x+11*k,y-22*k,1.1*k,1.1*k,'#253e3e');line(g,[[x-3*k,y-4*k],[x-5*k,y+3*k]],'#927450',1.5);line(g,[[x+4*k,y-4*k],[x+5*k,y+3*k]],'#927450',1.5);line(g,[[x-8*k,y-13*k],[x+1*k,y-6*k],[x+8*k,y-13*k]],'#768e7e',1.3);});}
function drawBell(r,s){const x=2205,y=648;if(!visible(r,x,y,170))return;shadow(r,x,y,40,15);r.queue(x,y,0,g=>{const [sx,sy]=r.w(x,y,0),k=r.view.scale,P=(x,y)=>[sx+x*k,sy+y*k];poly(g,[P(-31,3),P(-31,-93),P(-24,-98),P(-23,3)],'#657962','#2d4d47',2);poly(g,[P(28,3),P(28,-93),P(35,-98),P(36,3)],'#657962','#2d4d47',2);line(g,[P(-43,-93),P(44,-93)],'#31524b',8*k);line(g,[P(-36,-96),P(38,-96)],'#adc09c',2*k);line(g,[P(3,-94),P(3,-76)],'#786e47',2*k);const swing=s.complete?Math.sin(s.time*2.5)*.07:0;g.save();g.translate(...P(3,-76));g.rotate(swing);poly(g,[[-11*k,0],[-18*k,28*k],[-24*k,33*k],[-24*k,40*k],[24*k,40*k],[24*k,33*k],[18*k,28*k],[11*k,0]],s.groves[2]?'#c9a76b':'#879282','#344e47',2*k);ellipse(g,0,40*k,24*k,5*k,'#526452','#364a41',1);ellipse(g,0,12*k,7*k,7*k,s.groves[2]?'#f0d58b':'#657d6c');line(g,[[-16*k,30*k],[16*k,30*k]],'#e1c088',1.5*k);g.restore();poly(g,[P(-45,5),P(-39,-2),P(45,-2),P(48,5)],'#b8b58f','#5d715d',1);});}
function drawTargets(r,s){if(!s.brush)return;const g=r.ctx;g.save();g.lineWidth=1.5;
 const rings=[];groves.forEach((p,i)=>{if(!s.groves[i])rings.push({...p,label:'BLOOM',color:'#668d70',rad:42});});
 thorns.forEach(p=>{if(!s.thorns[p.id])rings.push({...p,z:28,label:'SEVER',color:'#af614b',rad:24});});
 seeds.forEach((p,i)=>{if(!s.seeds[i])rings.push({...p,label:'BLOOM',color:'#b58d50',rad:20});});
 if(!s.bridge){for(const p of [bridge.a,bridge.b])rings.push({...p,label:'MEND',color:'#b08b4f',rad:22});}
 if(s.boss&&s.boss.active&&s.boss.hp>0)rings.push({...s.boss,z:48,label:s.boss.seal==='guarded'?'DODGE':s.boss.seal==='sealed'?'SEVER':s.boss.seal==='cracked'?'BLOOM':'STRIKE',color:'#b26447',rad:38});
 for(const e of s.enemies){if(e.hp>0&&e.armored)rings.push({...e,z:43,label:'SEVER',color:'#b26447',rad:22});}
 rings.forEach(p=>{const[x,y]=r.w(p.x,p.y,p.z);if(x<0||x>r.W||y<80||y>r.H-90)return;g.setLineDash([3,5]);ellipse(g,x,y,p.rad,p.rad,null,p.color,1.2);g.setLineDash([]);g.font='10px system-ui';g.textAlign='center';g.fillStyle=p.color;g.fillText(p.label,x,y+p.rad+17);});g.restore();g._c=null;
}
function draw(r,s){
 const g=r.ctx;g.imageSmoothingEnabled=true;g.fillStyle=C.paper;g.fillRect(0,0,r.W+2,r.H+2);
 if(W.background.complete&&W.background.naturalWidth){g.save();g.globalAlpha=.37;const w=W.background.width,h=W.background.height,scale=Math.max(r.W/w,r.H/h);g.drawImage(W.background,(r.W-w*scale)/2,(r.H-h*scale)/2,w*scale,h*scale);g.restore();}
 const amount=s.groves.filter(Boolean).length/3;
 g.save();g.globalAlpha=.28;g.fillStyle=amount?'#84aba1':'#829b9d';g.fillRect(0,0,r.W+2,r.H+2);g.restore();
 for(const m of waterMarks){if(!visible(r,m.x,m.y,80))continue;const[x,y]=r.w(m.x,m.y,0),len=m.len*(.8+Math.sin(s.time*.4+m.v*9)*.05);line(g,[[x-len/2,y],[x+len/2,y]],m.v>.5?'#e7e3cb77':'#648e8b44',m.v> .65?1.5:1);}
 islands.forEach((p,i)=>{const lift=p.map(v=>[v[0],v[1]+14]);pathWorld(g,r,lift,'#527770','#62867a',1);pathWorld(g,r,p,s.groves[i]?'#c4c9a0':'#b7bcaa','#667d6f',2.2);const edge=p.map(v=>[v[0]+5,v[1]-3]);g.save();g.globalAlpha=.4;pathWorld(g,r,edge,null,'#e4e0bd',3);g.restore();});
 pathWorld(g,r,[[1538,573],[1735,566],[1734,672],[1554,674]],s.groves[1]?'#c2c69d':'#b6bbaa','#60796c',1);
 for(const p of paths){g.save();g.lineCap='round';g.lineJoin='round';line(g,p.map(v=>r.w(...v)), '#d2cdb2',48*r.view.scale);line(g,p.map(v=>r.w(...v)), '#e1d7b935',24*r.view.scale);g.restore();}
 for(const q of texture){if(!visible(r,q.x,q.y,40))continue;const[x,y]=r.w(q.x,q.y,0),alive=isRestored(q.x,q.y,s);g.save();g.globalAlpha=.16+q.a*.1;ellipse(g,x,y,q.s*r.view.scale,q.s*.32*r.view.scale,alive?(q.v>.5?'#6e9166':'#e8e8bb'):(q.v>.5?'#687d73':'#e4dfc4'));g.restore();if(alive&&q.v>.7){for(let k=0;k<3;k++)ellipse(g,x+k*5,y-k%2*4,2.1,1.4,k%2?'#d58c66':'#f1deaf');}}
 // Ink stains retreat as each grove wakes.
 groves.forEach((p,i)=>{if(!s.groves[i]){const[x,y]=r.w(p.x,p.y,0);g.save();g.globalAlpha=.17;ellipse(g,x,y,148*r.view.scale,81*r.view.scale,'#3b4650');g.restore();for(let k=0;k<5;k++){const a=k*1.3;line(g,[r.w(p.x+Math.cos(a)*40,p.y+Math.sin(a)*20,0),r.w(p.x+Math.cos(a)*140,p.y+Math.sin(a)*85,0)],'#3b46504d',3);}}});
 drawBridge(r,s);
 if(s.boss&&s.boss.active&&s.boss.hp>0){g.save();g.setLineDash([6,8]);const[x,y]=r.w(1940,633,0);ellipse(g,x,y,286*r.view.scale,192*r.view.scale*.76,null,'#a8675266',2);g.restore();}
 scenery.forEach(t=>drawTree(r,t,isRestored(t.x,t.y,s),s.time,true));
 props.forEach(p=>p.type==='rock'?drawRock(r,p):drawReeds(r,p,s));
 groves.forEach((t,i)=>drawTree(r,t,s.groves[i],s.time));
 for(const t of thorns)drawThorns(r,t,s);
 for(const[x,y]of [[194,705],[724,711],[1134,636],[1550,686],[1729,596],[2140,700]])drawLantern(r,x,y,s.time,isRestored(x,y,s));
 drawOrrin(r,s.time);drawBird(r,s);drawBell(r,s);
 seeds.forEach((p,i)=>{if(s.seeds[i]||!visible(r,p.x,p.y,40))return;r.queue(p.x,p.y,0,g=>{const[x,y]=r.w(p.x,p.y,5+Math.sin(s.time*2+i)*2);line(g,[[x,y+8],[x,y-6]],'#63805f',2);ellipse(g,x-5,y-2,6,3,'#769974','#3e6659',1);ellipse(g,x+4,y-5,6,3,'#aab587','#3e6659',1);ellipse(g,x,y-11,4,5,'#c8a161');});});
 if(s.brush){r.overlay(gg=>{gg.save();gg.globalAlpha=.20;gg.fillStyle='#f1e6cb';gg.fillRect(0,0,r.W+2,r.H+2);gg.restore();drawTargets(r,s);gg._c=null;});}
 g._c=null;
}
function walkable(x,y,s){
 if(!baseLand(x,y))return false;
 if(x>866&&x<1068&&(!s.bridge||y<581||y>656))return false;
 if(x>844&&x<1090&&(y<573||y>666))return false;
 if(!s.thorns.passage&&Math.hypot(x-778,y-620)<48)return false;
 if(!s.groves[0]&&x>694)return false;
 if(!s.groves[1]&&x>1630)return false;
 if(s.boss&&s.boss.active&&s.boss.hp>0&&x<1694)return false;
 if(!s.thorns.rescue&&Math.hypot(x-1250,y-763)<31)return false;
 return true;
}
const W={groves,bridge,thorns,seeds,islands,paths,draw,walkable,inPoly,baseLand,drawTree,drawLantern,poly,line,ellipse,shadow,visible,background:new Image()};W.background.src='assets/marsh.png';root.ReedWorld=W;
})(window);
