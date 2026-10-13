/* Original procedural art and animation for Breakwater. All world drawing uses my-3D2dge. */
(function(root){
'use strict';
const E=root.My3D2dge,{N,hash,ZONES}=root.BreakwaterSim,T=16;
const C={water:'#285767',deep:'#1c414f',foam:'#80a9a1',grass:['#718565','#758c69','#7a8d69','#6b8262'],sand:'#b0aa7a',dirt:'#485e4a',road:'#526069',edge:'#85918a',home:'#b8c8a7',shop:'#7facbc',industry:'#b9a883'};
const P=(r,x,y,z)=>r.w(x,y,z);
function poly(g,r,pts,c){E.px.poly(g,pts.map(p=>P(r,...p)),c);}
function line(g,r,a,b,c,w=1){const A=P(r,...a),B=P(r,...b);E.px.line(g,...A,...B,c,w);}
function slab(g,r,x,y,z,w,d,h,top,side){r.box(g,x,y,z,x+w,y+d,z+h,top,side);}
function tree(g,r,x,y,z,k=0,size=1){
 slab(g,r,x-.8,y-.8,z,1.6,1.6,6*size,'#705740','#5b5140');
 const [a,b]=P(r,x,y,z+9*size),s=r.view.scale*size;
 E.px.ell(g,a,b+2*s,5.8*s,5*s,'#274836');E.px.ell(g,a-1*s,b-1.1*s,5*s,4.8*s,k%2?'#436b43':'#3c6240');E.px.ell(g,a-1.8*s,b-2.1*s,2.7*s,3.3*s,k%2?'#6c8b51':'#5b7d48');
}
function pine(g,r,x,y,z,size=1){slab(g,r,x-.6,y-.6,z,1.2,1.2,6*size,'#735d44','#524932');const [a,b]=P(r,x,y,z),s=r.view.scale*size;for(let k=0;k<3;k++){const yy=b-(6+k*3)*s,rr=(5-k)*s;E.px.poly(g,[[a,yy-8*s],[a+rr,yy+2*s],[a-rr,yy+2*s]],k===2?'#5d8151':'#355d42');E.px.poly(g,[[a,yy-8*s],[a,yy+2*s],[a-rr,yy+2*s]],'#416c45');}}
function windows(g,r,x,y,z,w,d,h,kind=0){
 const dark=kind?'#315469':'#4b686a',light=kind?'#a7d0d6':'#c8cd9b';
 for(let zz=4;zz<h-1;zz+=5.2){
  for(let xx=2;xx<w-1;xx+=3.8)poly(g,r,[[x+xx,y+d+.04,z+zz],[x+xx+1.8,y+d+.04,z+zz],[x+xx+1.8,y+d+.04,z+zz+2.4],[x+xx,y+d+.04,z+zz+2.4]],hash(xx,zz,kind)>.8?light:dark);
  for(let yy=2;yy<d-1;yy+=4)poly(g,r,[[x+w+.04,y+yy,z+zz],[x+w+.04,y+yy+1.7,z+zz],[x+w+.04,y+yy+1.7,z+zz+2.4],[x+w+.04,y+yy,z+zz+2.4]],dark);
 }
}
class CityRenderer{
 constructor(game,getCity){this.game=game;this.getCity=getCity;this.layer='city';this.grid=false;this.hover=null;this.selected=null;this.preview=[];this.validPreview=true;this.tool='inspect';this.cars=[];this.carRevision=-1;this.weather=0;this.animate=true;this.lowDetail=false;this.tileCache=new Map();this._staticPass=false;}
 get city(){return this.getCity();}
 groundZ(t){return t.water?-3:t.h*3;}
 pick(clientX,clientY){
  const r=this.game.r,sc=this.game.screen,[wx,wy]=sc.clientToScreen(clientX,clientY),mx=wx-sc.ix,my=wy-sc.iy;
  // Test top faces in depth order, so elevation does not move the selected cell.
  let found=null,best=-Infinity;
  for(const t of this.city.tiles){const z=this.groundZ(t),a=r.w(t.x*T,t.y*T,z),b=r.w((t.x+1)*T,t.y*T,z),c=r.w((t.x+1)*T,(t.y+1)*T,z),d=r.w(t.x*T,(t.y+1)*T,z);let inside=true,sign=0;
   const pts=[a,b,c,d];for(let j=0;j<4;j++){const u=pts[j],v=pts[(j+1)%4],q=(v[0]-u[0])*(my-u[1])-(v[1]-u[1])*(mx-u[0]);if(q){if(!sign)sign=Math.sign(q);else if(Math.sign(q)!==sign){inside=false;break;}}}
   if(!inside&&this.tool==='inspect'&&t.type&&t.type!=='road'&&(t.level>0||!ZONES.includes(t.type))){
    let h=ZONES.includes(t.type)?(t.type==='home'?8:t.type==='shop'?9:6)+t.level*(t.type==='industry'?3:5)+(t.density===2?t.level*5:0)+4:t.type==='wind'?33:t.type==='hall'?34:t.type==='park'?13:18;
    if(this.layer!=='city'&&ZONES.includes(t.type))h=4;const cloud=[];for(const zz of [z,z+h])for(const xx of [t.x*T+2,t.x*T+14])for(const yy of [t.y*T+2,t.y*T+14])cloud.push(r.w(xx,yy,zz));
    cloud.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
    for(const p of cloud){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}for(const p of [...cloud].reverse()){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
    const hull=lower.slice(0,-1).concat(upper.slice(0,-1));inside=hull.every((p,i)=>cross(p,hull[(i+1)%hull.length],[mx,my])>=0);
   }
   const depth=r.view.order(t.x*T+8,t.y*T+8,z);if(inside&&depth>best){found=t;best=depth;}
  }
  return found;
 }
 update(dt){
  if(!this.animate)return;
  const city=this.city,roads=city.tiles.filter(t=>t.type==='road'&&t.connected);
  const count=Math.min(30,Math.floor(city.stats.population/35));
  if(city.changes!==this.carRevision||this.cars.length!==count){this.carRevision=city.changes;this.cars=[];for(let i=0;i<count&&roads.length;i++){const tile=roads[Math.floor(hash(i,23)*roads.length)];this.cars.push({tile,next:null,f:hash(i,7),variant:i,prev:null});}}
  for(const car of this.cars){if(!car.next){let ns=city.adjacent(car.tile).filter(t=>t.type==='road'&&t.connected&&t!==car.prev);if(!ns.length)ns=city.adjacent(car.tile).filter(t=>t.type==='road'&&t.connected);car.next=ns[(car.variant+Math.floor(this.game.real*.7))%Math.max(1,ns.length)];if(!car.next)continue;}
   car.f+=dt*(.24+(car.variant%4)*.04);if(car.f>=1){car.prev=car.tile;car.tile=car.next;car.next=null;car.f=0;}
  }
  this.weather=Math.max(0,this.weather-dt);
 }
 draw(r){
  const city=this.city,time=this.animate?this.game.real:0,g=r.ctx;
  E.px.rect(g,0,0,r.bw,r.bh,'#173540');
  // A subtle ocean field continues beyond the map.
  for(let i=0;i<65;i++){const x=hash(i,49)*r.W,y=hash(i,21)*r.H,len=4+hash(i,7)*18;E.px.line(g,x+Math.sin(time*.3+i)*3,y,x+len+Math.sin(time*.3+i)*3,y,'#20434e');}
  for(const t of city.tiles){const x=t.x*T,y=t.y*T,z=this.groundZ(t);if(!r.visible(x+8,y+8,z,70,160,100))continue;
   r.queue(x+8,y+8,z,ctx=>{this.drawCachedTile(ctx,r,t);this.drawDynamicTile(ctx,r,t,time);});
  }
  if(this.layer==='city'){
   for(const car of this.cars){if(!car.next)continue;const a=car.tile,b=car.next,u=car.f,dx=b.x-a.x,dy=b.y-a.y,x=(a.x+.5+dx*u)*T-dy*2,y=(a.y+.5+dy*u)*T+dx*2,z=this.groundZ(a)*(1-u)+this.groundZ(b)*u+1;
    r.queue(x,y,z,ctx=>{const palette=['#d7b563','#cad9d3','#6b99ae','#bd6a51','#729f78'],col=palette[car.variant%5],w=dx?5:2.8,d=dx?2.8:5;slab(ctx,r,x-w/2,y-d/2,z,w,d,2.5,E.shade(col,.12),col);slab(ctx,r,x-w*.22,y-d*.22,z+2.5,w*.44,d*.44,.9,'#c1d4d3','#506b76');});
   }
   for(let i=0;i<3;i++){const x=25*16+Math.sin(time*.035+i*2)*35,y=(22+i*2)*16+Math.cos(time*.028+i)*18;const t=city.tile(Math.floor(x/T),Math.floor(y/T));if(t?.water)r.queue(x,y,-2,ctx=>{poly(ctx,r,[[x-7,y-2,-2],[x+6,y-2,-2],[x+8,y,-2],[x+6,y+3,-2],[x-7,y+3,-2]],'#d7d1af');slab(ctx,r,x-3,y-1,-2,4,3,3,'#dbdece','#6d949c');line(ctx,r,[x-13,y,-3],[x-9,y,-3],'#96b8ad');});}
  }
  this.drawHighlights(r);
  if(this.layer!=='city')this.drawNetwork(r);
  r.overlay(ctx=>{
   if(this.layer==='city'&&this.animate){for(let i=0;i<5;i++){const a=(time*9+i*137)%(r.W+120)-60,b=65+Math.sin(time*.2+i)*35+i*13;const wing=Math.sin(time*5+i)*2;E.px.line(ctx,a-3,b+wing,a,b,'#b9cbc0');E.px.line(ctx,a,b,a+3,b+wing,'#b9cbc0');}}
   if(this.weather>0&&!this.game.reduceMotion){E.px.blend(ctx,.14,'normal',()=>E.px.rect(ctx,0,0,r.W,r.H,'#153949'));for(let i=0;i<110;i++){let a=(hash(i,50)*r.W+time*130)%r.W,b=(hash(i,90)*r.H+time*240)%r.H;E.px.line(ctx,a,b,a-4,b+8,'#86abae');}}
  });
 }
 drawCachedTile(g,r,t){
  const v=r.view,z=this.groundZ(t),x=t.x*T+8,y=t.y*T+8;
  const neighbors=t.type==='road'?this.city.adjacent(t).map(n=>n.type==='road'?'1':'0').join(''):'';
  const key=[v.scale,v.yawDeg,this.layer,this.grid||ZONES.includes(this.tool),this.lowDetail,t.type,t.h,t.variant,t.trees,t.level,t.density,t.damage>0,t.fire>0,t.connected,t.power,t.watered,t.risk,t.protected,t.shelter,t.clinic,t.school,t.fireCover,t.value,t.builtAt===this.city.month,neighbors].join('|');
  const id=t.y*N+t.x;let cached=this.tileCache.get(id);
  if(!cached||cached.key!==key){
   let height=t.trees?25:2;if(t.type==='road')height=12;else if(ZONES.includes(t.type))height=20+t.level*10+(t.density===2?t.level*5:0);else if(t.type)height=t.type==='wind'?48:t.type==='hall'?42:t.type==='park'?26:28;
   const projected=v.p(x,y,z),originX=Math.round(projected[0]),originY=Math.round(projected[1]);
   const w=Math.ceil((Math.abs(v.ax)+Math.abs(v.ay))*T+22),top=Math.ceil(Math.abs(v.bz)*height+(Math.abs(v.bx)+Math.abs(v.by))*T/2+14),bottom=Math.ceil((Math.abs(v.bx)+Math.abs(v.by))*T/2+Math.abs(v.bz)*(z+9)+15),padX=Math.ceil(w/2);
   const cv=document.createElement('canvas');cv.width=w;cv.height=top+bottom;const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
   const local=Object.create(r);local.w=(a,b,c=0)=>[v.ax*a+v.ay*b-originX+padX,v.bx*a+v.by*b+v.bz*c-originY+top];
   this._staticPass=true;try{this.drawTile(ctx,local,t,0);}finally{this._staticPass=false;}
   cached={key,cv,padX,top,originX,originY};this.tileCache.set(id,cached);
  }
  g.drawImage(cached.cv,cached.originX-r.ix-cached.padX,cached.originY-r.iy-cached.top);g._c=null;
 }
 drawDynamicTile(g,r,t,time){
  if(this.layer!=='city')return;const x=t.x*T,y=t.y*T,z=this.groundZ(t);
  if(t.water&&t.variant%3===0&&this.animate){const u=(time*.1+t.variant*.01)%1;line(g,r,[x+2+u*6,y+7,-2.9],[x+7+u*6,y+7,-2.9],'#497681');}
  if(t.type==='wind'){
   const [sx,sy]=r.w(x+10,y+7,z+30),rad=13*r.view.scale;for(let i=0;i<3;i++){const a=time*.85+i*Math.PI*2/3,tx=sx+Math.cos(a)*rad,ty=sy+Math.sin(a)*rad;E.px.poly(g,[[sx-1,sy-1],[tx,ty],[tx-Math.sin(a)*1.5*r.view.scale,ty+Math.cos(a)*1.5*r.view.scale],[sx+1,sy+1]],'#d4ddcd');}E.px.disc(g,sx,sy,1.8*r.view.scale,'#709597');
  }
  if(ZONES.includes(t.type)&&t.level){
   const h=(t.type==='home'?8:t.type==='shop'?9:6)+t.level*(t.type==='industry'?3:5)+(t.density===2?t.level*5:0);
   if(t.type==='industry'&&this.animate&&!t.damage&&!t.fire&&!this.lowDetail){for(let i=0;i<3;i++){const phase=(time*.22+i*.33)%1,[sx,sy]=r.w(x+12+phase*5,y+4,z+h+9+phase*12);E.px.blend(g,(1-phase)*.35,'normal',()=>E.px.ell(g,sx,sy,(1.5+phase*3)*r.view.scale,(1+phase*2)*r.view.scale,'#c6cabc'));}}
   if((!t.power||!t.watered)&&!t.damage&&Math.floor(time)%3!==2){const [sx,sy]=r.w(x+8,y+8,z+h+8);E.px.disc(g,sx,sy,5,'#e4bb64');E.font.text(g,'!',sx,sy-3,'#2b4149',{align:'center',outline:false});}
  }
  if(t.fire)this.drawDamage(g,r,t,z,time);
 }
 drawTile(g,r,t,time){
  const x=t.x*T,y=t.y*T,z=this.groundZ(t),city=this.city,variant=t.variant;
  if(t.water){
   poly(g,r,[[x,y,-3],[x+T,y,-3],[x+T,y+T,-3],[x,y+T,-3]],variant%4===0?'#2b5966':'#285462');
   if(variant%3===0&&!this._staticPass){const u=(time*.1+variant*.01)%1;line(g,r,[x+2+u*6,y+7,-2.9],[x+7+u*6,y+7,-2.9],variant%2?'#42717a':'#3b6672');}
   if(t.type==='road')this.drawRoad(g,r,t,0);return;
  }
  let grass=t.shore<=1?C.sand:C.grass[variant%4];if(t.h>=3)grass='#829078';
  // Terrain slabs keep hills visible from all zoom levels.
  r.box(g,x,y,-8,x+T,y+T,z,grass,t.shore<=1?'#7d8663':'#4f6952');
  if(this.grid||ZONES.includes(this.tool)){const corners=[[x,y,z+.05],[x+T,y,z+.05],[x+T,y+T,z+.05],[x,y+T,z+.05]];for(let i=0;i<4;i++)line(g,r,corners[i],corners[(i+1)%4],E.shade(grass,-.12));}
  if(t.shore===1){for(const n of city.adjacent(t))if(n.water){const ex=n.x>t.x?x+16:n.x<t.x?x:x,ey=n.y>t.y?y+16:n.y<t.y?y:y;const a=n.x!==t.x?[ex,y,Math.max(0,z)]:[x,ey,Math.max(0,z)],b=n.x!==t.x?[ex,y+16,Math.max(0,z)]:[x+16,ey,Math.max(0,z)];line(g,r,a,b,'#b9c4a2',1);}}
  if(this.layer!=='city'){
   let col=null;
   if(this.layer==='power')col=t.type?(t.power||t.connected?'#dfbd55':'#b66b55'):null;
   if(this.layer==='water')col=t.type?(t.watered||t.connected?'#60b6c8':'#b66b55'):null;
   if(this.layer==='value')col=E.mix('#885b4b','#8dcc98',t.value/100);
   if(this.layer==='risk')col=t.risk?(t.shelter?'#c4a563':'#c56c57'):t.protected?'#71a48d':'#8a9273';
   if(this.layer==='services')col=t.clinic&&t.school?'#78bda6':t.clinic||t.school||t.fireCover?'#97a674':'#987f60';
   if(col)poly(g,r,[[x+.5,y+.5,z+.2],[x+15.5,y+.5,z+.2],[x+15.5,y+15.5,z+.2],[x+.5,y+15.5,z+.2]],col);
   if(t.type==='road'){this.drawRoad(g,r,t,z);return;}
   if(ZONES.includes(t.type)){slab(g,r,x+5,y+5,z+1,6,6,3,C[t.type],E.shade(C[t.type],-.15));return;}
   if(t.type)this.drawStructure(g,r,t,z,time);return;
  }
  if(t.type==='road'){this.drawRoad(g,r,t,z);return;}
  if(ZONES.includes(t.type))this.drawZone(g,r,t,z,time);
  else if(t.type)this.drawStructure(g,r,t,z,time);
  else if(t.trees){if(t.h>=3){pine(g,r,x+8,y+8,z,.8+(variant%3)*.13);}else{tree(g,r,x+8,y+8,z,variant,.85+(variant%3)*.1);if(t.trees>1&&!this.lowDetail)tree(g,r,x+4,y+11,z,variant+1,.55);}}
  else if(variant%5===0){line(g,r,[x+3,y+6,z+.1],[x+5,y+6,z+.1],E.shade(grass,.12));line(g,r,[x+9,y+11,z+.1],[x+11,y+11,z+.1],E.shade(grass,-.12));}
  if(t.damage||t.fire)this.drawDamage(g,r,t,z,time);
 }
 drawRoad(g,r,t,z){
  const x=t.x*T,y=t.y*T,city=this.city;
  if(t.water){slab(g,r,x+1,y+1,-9,3,3,9,'#7c8584','#586b70');slab(g,r,x+12,y+12,-9,3,3,9,'#7c8584','#586b70');}
  const has=(dx,dy)=>city.tile(t.x+dx,t.y+dy)?.type==='road';
  slab(g,r,x,y,z+.05,16,16,.35,'#929a8b','#596563');
  poly(g,r,[[x+2,y+2,z+.5],[x+14,y+2,z+.5],[x+14,y+14,z+.5],[x+2,y+14,z+.5]],C.road);
  const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
  for(const [dx,dy]of dirs)if(has(dx,dy)){
   if(dx)poly(g,r,[[x+(dx<0?0:8),y+2,z+.5],[x+(dx<0?8:16),y+2,z+.5],[x+(dx<0?8:16),y+14,z+.5],[x+(dx<0?0:8),y+14,z+.5]],C.road);
   else poly(g,r,[[x+2,y+(dy<0?0:8),z+.5],[x+14,y+(dy<0?0:8),z+.5],[x+14,y+(dy<0?8:16),z+.5],[x+2,y+(dy<0?8:16),z+.5]],C.road);
   line(g,r,[x+8+dx*4,y+8+dy*4,z+.65],[x+8+dx*7,y+8+dy*7,z+.65],'#d1cbb0');
  }
  if(t.x===0&&t.y===14){line(g,r,[x+3,y+1,z+1],[x+3,y+15,z+1],'#b7bfaa',2);}
  if(!t.connected&&this.layer==='city'){const [sx,sy]=r.w(x+8,y+8,z+1);E.px.rect(g,sx-2,sy-2,4,4,'#d58662');}
  if((t.x+t.y)%10===0&&this.layer==='city'&&!this.lowDetail){line(g,r,[x+1,y+1,z],[x+1,y+1,z+9],'#bec1a3');line(g,r,[x+1,y+1,z+9],[x+4,y+1,z+9],'#cbd1b1');}
 }
 drawZone(g,r,t,z,time){
  const x=t.x*T,y=t.y*T,k=t.variant,kind=t.type;
  const lots={home:['#cbd0af','#c4c6a3'],shop:['#acbab2','#8da6a6'],industry:['#afa88d','#9d9f87']};
  poly(g,r,[[x+1,y+1,z+.1],[x+15,y+1,z+.1],[x+15,y+15,z+.1],[x+1,y+15,z+.1]],lots[kind][k%2]);
  if(!t.level){
   const col={home:'#bce29f',shop:'#9acee1',industry:'#e8cf80'}[kind];
   for(const a of [[x+2,y+2],[x+14,y+2],[x+14,y+14],[x+2,y+14]])slab(g,r,a[0],a[1],z,1,1,2,col,col);
   line(g,r,[x+2,y+2,z+.2],[x+14,y+14,z+.2],col);line(g,r,[x+14,y+2,z+.2],[x+2,y+14,z+.2],col);return;
  }
  const buildAge=this.city.month-t.builtAt,underConstruction=buildAge===0;
  let h=(kind==='home'?8:kind==='shop'?9:6)+t.level*(kind==='industry'?3:5)+(t.density===2?t.level*5:0);
  // Construction uses scaffolding and particles. Static geometry can be cached between city changes.
  if(kind==='home'&&t.level===1&&t.density===1){
   const wall=['#d2c5a3','#c9d1b0','#e0ccb2','#bfcbb6'][k%4],roof=['#657e84','#916657','#55797c','#8c8160'][k%4];
   slab(g,r,x+3,y+3,z+.6,10,10,8,wall,wall);windows(g,r,x+3,y+3,z+.6,10,10,8);
   poly(g,r,[[x+2,y+2,z+9],[x+14,y+2,z+9],[x+14,y+8,z+14],[x+2,y+8,z+14]],E.shade(roof,.18));
   poly(g,r,[[x+2,y+8,z+14],[x+14,y+8,z+14],[x+14,y+14,z+9],[x+2,y+14,z+9]],roof);
   poly(g,r,[[x+14,y+2,z+9],[x+14,y+8,z+14],[x+14,y+14,z+9]],E.shade(wall,-.12));
   slab(g,r,x+4,y+5,z+10,2,2,4,'#a89172','#8b7e66');
   if(k%3===0)tree(g,r,x+1.8,y+12,z,k,.45);
  }else if(kind==='home'){
   const body=['#ddd3b0','#c5c8b2','#d3bc9d','#baccc2'][k%4],roof=['#739a9b','#839c94','#8a8c7b'][k%3];
   slab(g,r,x+2,y+2,z+.5,12,12,h,body,body);windows(g,r,x+2,y+2,z+.5,12,12,h);
   slab(g,r,x+1.5,y+1.5,z+h+.5,13,13,1.3,E.shade(roof,.25),roof);
   if(t.density===2){slab(g,r,x+4,y+4,z+h+1.8,7,6,3,roof,body);for(let zz=10;zz<h;zz+=9)slab(g,r,x+2,y+13,z+zz,12,2,1.1,'#b7bca3','#819890');}
   slab(g,r,x+6,y+14,z+.5,3,1,4,'#82958d','#526b65');
   if(k%3===1)slab(g,r,x+5,y+4,z+h+1.8,4,4,2,'#aec3bb','#7d9894');
  }else if(kind==='shop'){
   const wall=['#b0cac9','#a6babc','#d1cdb4'][k%3],roof='#628795';
   slab(g,r,x+2,y+2,z+.5,12,12,h,wall,wall);windows(g,r,x+2,y+2,z+.5,12,12,h,1);
   slab(g,r,x+1.5,y+1.5,z+h+.5,13,13,1.2,'#89a5a8',roof);
   const awning=k%2?'#dfb467':'#65a9ac';slab(g,r,x+2,y+13,z+4.5,12,2.8,1.4,awning,E.shade(awning,-.2));
   slab(g,r,x+4,y+4,z+h+1.7,5,4,2.3,'#bbcbc4','#7b9399');
   if(t.density===2){line(g,r,[x+9,y+7,z+h],[x+9,y+7,z+h+7],'#a8b8b0');}
  }else{
   const wall=k%2?'#b6b69c':'#c4b597';
   slab(g,r,x+1,y+2,z+.3,14,12,h*.6,wall,wall);windows(g,r,x+1,y+2,z+.3,14,12,h*.6,1);
   for(let i=0;i<3;i++){const xx=x+1+i*4.6;poly(g,r,[[xx,y+2,z+h*.6+.4],[xx+4.5,y+2,z+h*.6+.4],[xx+4.5,y+8,z+h*.6+3],[xx,y+8,z+h*.6+3]],'#8d9e9b');poly(g,r,[[xx,y+8,z+h*.6+3],[xx+4.5,y+8,z+h*.6+3],[xx+4.5,y+14,z+h*.6+.4],[xx,y+14,z+h*.6+.4]],'#6b8387');}
   slab(g,r,x+11,y+3,z+1,2.5,2.5,h+6,'#baaf8d','#8b8c7c');slab(g,r,x+10.7,y+2.7,z+h+7,3.1,3.1,1.4,'#6c7b74','#53685d');
   if(!this._staticPass&&this.animate&&!t.damage&&!t.fire&&!this.lowDetail){for(let i=0;i<3;i++){const phase=(time*.22+i*.33)%1,[sx,sy]=r.w(x+12+phase*5,y+4,z+h+9+phase*12);E.px.blend(g,(1-phase)*.35,'normal',()=>E.px.ell(g,sx,sy,(1.5+phase*3)*r.view.scale,(1+phase*2)*r.view.scale,'#c6cabc'));}}
  }
  if(underConstruction&&t.builtAt>=0){line(g,r,[x+1,y+15,z+1],[x+1,y+15,z+h+4],'#c4a765');line(g,r,[x+15,y+15,z+1],[x+15,y+15,z+h+4],'#c4a765');line(g,r,[x+1,y+15,z+h],[x+15,y+15,z+h],'#d2ba77');}
  if(!this._staticPass&&(!t.power||!t.watered)&&!t.damage&&Math.floor(time)%3!==2){const [sx,sy]=r.w(x+8,y+8,z+h+8);E.px.disc(g,sx,sy,5,'#e4bb64');E.font.text(g,'!',sx,sy-3,'#2b4149',{align:'center',outline:false});}
 }
 drawStructure(g,r,t,z,time){
  const x=t.x*T,y=t.y*T,kind=t.type;
  if(kind==='park'){
   slab(g,r,x+1,y+1,z+.3,14,14,.3,'#9eac83','#607b63');poly(g,r,[[x+6,y+1,z+.7],[x+9,y+1,z+.7],[x+9,y+15,z+.7],[x+6,y+15,z+.7]],'#c6bc93');
   tree(g,r,x+4,y+5,z,t.variant,.8);tree(g,r,x+12,y+11,z,t.variant+1,.7);slab(g,r,x+2,y+11,z+1,4,1.5,1.2,'#a3946c','#737654');return;
  }
  slab(g,r,x+1,y+1,z+.3,14,14,.4,'#b2b59d','#71857d');
  if(kind==='wind'){
   slab(g,r,x+2,y+9,z+.7,6,5,4,'#a0b8af','#76938b');
   const cx=x+10,cy=y+7;slab(g,r,cx-.8,cy-.8,z+1,1.6,1.6,29,'#c6d5c9','#96b2ad');slab(g,r,cx-2,cy-1.5,z+29,4,3,2,'#d4dbc9','#aac2b8');
   if(!this._staticPass){const [sx,sy]=r.w(cx,cy,z+30),rad=13*r.view.scale;for(let i=0;i<3;i++){const a=time*.85+i*Math.PI*2/3,tx=sx+Math.cos(a)*rad,ty=sy+Math.sin(a)*rad;E.px.poly(g,[[sx-1,sy-1],[tx,ty],[tx-Math.sin(a)*1.5*r.view.scale,ty+Math.cos(a)*1.5*r.view.scale],[sx+1,sy+1]],'#d4ddcd');}E.px.disc(g,sx,sy,1.8*r.view.scale,'#709597');}
  }else if(kind==='pump'){
   slab(g,r,x+2,y+3,z+.7,11,10,6,'#9dbdc0','#789fa9');
   slab(g,r,x+1.5,y+2.5,z+6.7,12,11,1.5,'#b4d0c9','#6d979e');
   for(let i=0;i<2;i++){const [a,b]=r.w(x+5+i*5,y+8,z+11);E.px.ell(g,a,b,3*r.view.scale,2*r.view.scale,'#94b7b6');slab(g,r,x+3+i*5,y+6,z+7,4,4,4,'#b7d6c9','#719ea7');}
   line(g,r,[x+9,y+14,z+3],[x+9,y+16,z+3],'#638e9f',3);
  }else if(kind==='levee'){
   slab(g,r,x+1,y+1,z+.5,14,14,3.5,'#bac1a5','#7e9286');slab(g,r,x+1,y+7,z+4,14,3,2,'#c7c8af','#95a899');
   for(let i=0;i<3;i++)line(g,r,[x+2+i*5,y+1,z+4.1],[x+2+i*5,y+15,z+4.1],'#9ba98f');
  }else{
   const roof={hall:'#7b9c8d',clinic:'#79aaa5',school:'#be9f71',fire:'#a66c57',shelter:'#6c90a1'}[kind]||'#7b9c8d';
   const h=kind==='hall'?15:kind==='school'?11:9;
   slab(g,r,x+2,y+2,z+.7,12,12,h,'#d1d1b1','#bfcaad');windows(g,r,x+2,y+2,z+.7,12,12,h,kind==='clinic');
   slab(g,r,x+1.5,y+1.5,z+h+.7,13,13,2,E.shade(roof,.12),roof);
   if(kind==='hall'){
    slab(g,r,x+6,y+6,z+h+2.7,5,5,7,'#d9d8b8','#c8cfac');slab(g,r,x+5.5,y+5.5,z+h+9.7,6,6,2,'#76968b','#527a75');line(g,r,[x+9,y+8,z+h+11],[x+9,y+8,z+h+18],'#d8d9ba');poly(g,r,[[x+9,y+8,z+h+18],[x+14,y+8,z+h+17],[x+14,y+8,z+h+14],[x+9,y+8,z+h+15]],'#e0ba68');
   }else if(kind==='clinic'){
    slab(g,r,x+7,y+4,z+h+2.8,2,8,.3,'#d8e3d0','#d8e3d0');slab(g,r,x+4,y+7,z+h+2.8,8,2,.3,'#d8e3d0','#d8e3d0');
   }else if(kind==='fire'){
    for(let i=0;i<3;i++)poly(g,r,[[x+3+i*3.7,y+14.1,z+1],[x+6+i*3.7,y+14.1,z+1],[x+6+i*3.7,y+14.1,z+5],[x+3+i*3.7,y+14.1,z+5]],'#806b57');
    slab(g,r,x+3,y+12,z+1,3,3,2,'#cc8263','#a46550');
   }else if(kind==='school'){
    slab(g,r,x+4,y+4,z+h+2.8,7,7,3,'#d0bd91','#a69e76');line(g,r,[x+1,y+12,z],[x+1,y+12,z+14],'#d4d8b8');
   }else if(kind==='shelter'){
    slab(g,r,x+5,y+4,z+h+2.8,6,6,2,'#b7ced0','#88b0b2');poly(g,r,[[x+6,y+14.1,z+4],[x+10,y+14.1,z+4],[x+8,y+14.1,z+7]],'#d0e0bd');
   }
  }
  if(t.damage)this.drawDamage(g,r,t,z,time);
 }
 drawDamage(g,r,t,z,time){
  const x=t.x*T,y=t.y*T;
  if(t.damage){poly(g,r,[[x+1,y+1,z+.9],[x+15,y+1,z+.9],[x+15,y+15,z+.9],[x+1,y+15,z+.9]],'#638e94');for(let i=0;i<3;i++)line(g,r,[x+2+i*3,y+5+i*3,z+1],[x+6+i*3,y+5+i*3,z+1],'#b2c9bc');}
  const [sx,sy]=r.w(x+8,y+8,z+25);E.px.disc(g,sx,sy,6,'#d79262');E.font.text(g,t.fire?'!':'~',sx,sy-3,'#fff2bf',{align:'center',outline:false});
  if(t.fire&&!this._staticPass){for(let i=0;i<4;i++){const [a,b]=r.w(x+4+i*2,y+12,z+8+(Math.sin(time*9+i)+1)*3);E.px.poly(g,[[a-3,b+4],[a+2,b+3],[a+1,b-8-(i%2)*3]],i%2?'#e3b55b':'#da8050');}}
 }
 outline(r,t,color,width=1){const x=t.x*T,y=t.y*T,z=this.groundZ(t)+.8;const a=[[x,y,z],[x+16,y,z],[x+16,y+16,z],[x,y+16,z]];r.overlay(g=>{for(let i=0;i<4;i++)line(g,r,a[i],a[(i+1)%4],color,width);});}
 drawHighlights(r){
  if(this.selected)this.outline(r,this.selected,'#f1d290',2);
  for(const p of this.preview){const t=this.city.tile(p.x,p.y);if(t)this.outline(r,t,this.validPreview?'#c3e8a6':'#ee9c7d',2);}
  if(this.hover&&!this.preview.length){this.outline(r,this.hover,this.validPreview?'#e7dfba':'#ec9576',2);const t=this.hover,b=root.BreakwaterSim.BUILD[this.tool];if(b?.range&&this.tool!=='inspect'){
    const range=b.range;for(const a of this.city.tiles)if(!a.water&&this.city.distance(a,t)<=range){const x=a.x*T,y=a.y*T,z=this.groundZ(a)+.6;r.overlay(g=>E.px.blend(g,.1,'normal',()=>poly(g,r,[[x,y,z],[x+16,y,z],[x+16,y+16,z],[x,y+16,z]],'#cef0a7')));}
   }}
 }
 drawNetwork(r){
  if(!['power','water'].includes(this.layer))return;
  const color=this.layer==='power'?'#f0d781':'#9bd4e1';
  for(const t of this.city.tiles)if(t.type==='road'&&t.connected){const x=t.x*T+8,y=t.y*T+8,z=this.groundZ(t)+1;for(const n of this.city.adjacent(t))if(n.type==='road'&&n.connected&&n.x+n.y>t.x+t.y)r.overlay(g=>line(g,r,[x,y,z],[n.x*T+8,n.y*T+8,this.groundZ(n)+1],color,2));}
 }
}
root.BreakwaterRender={CityRenderer,T};
})(typeof window!=='undefined'?window:globalThis);
