/* Original BREAKWATER render extensions for my-3D2dge v0.8.1. MIT. */
(function(root){
'use strict';
const E=root.My3D2dge, C=root.BWCore, px=E.px, TAU=Math.PI*2;
const COLORS={sea:'#102e3b',foam:'#608984',land:'#49625b',edge:'#92a390',dark:'#182e37',cream:'#d4d3b2',amber:'#f2b854',teal:'#8ddbd0',red:'#ef735c'};
function poly(r,g,pts,c){px.poly(g,pts.map(p=>r.w(p[0],p[1],p[2]||0)),c);}
function line(r,g,a,b,c,w=1){const p=r.w(...a),q=r.w(...b);px.line(g,...p,...q,c,w);}
function flat(r,g,x,y,w,h,c,z=0){poly(r,g,[[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]],c);}
function circle(r,g,x,y,rad,c,z=0,segments=42){let prev;for(let i=0;i<=segments;i++){const a=i/segments*TAU,p=r.w(x+Math.cos(a)*rad,y+Math.sin(a)*rad,z);if(prev)px.line(g,...prev,...p,c);prev=p;}}
function road(r,g,a,b,width,color){const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),nx=-dy/d*width/2,ny=dx/d*width/2;poly(r,g,[[a[0]+nx,a[1]+ny,0],[b[0]+nx,b[1]+ny,0],[b[0]-nx,b[1]-ny,0],[a[0]-nx,a[1]-ny,0]],color);}
function meshBox(faces,x,y,z,w,h,d,top,side){const a=[x-w/2,y-h/2,z],b=[x+w/2,y-h/2,z],c=[x+w/2,y+h/2,z],e=[x-w/2,y+h/2,z];const up=p=>[p[0],p[1],z+d];faces.push({p:[a,b,up(b),up(a)],c:E.shade(side,-.14)},{p:[b,c,up(c),up(b)],c:side},{p:[c,e,up(e),up(c)],c:E.shade(side,.13)},{p:[e,a,up(a),up(e)],c:side},{p:[up(a),up(b),up(c),up(e)],c:top});}
class AircraftRig{
 draw(r,p,time){
  const a=p.face,ca=Math.cos(a),sa=Math.sin(a),bank=E.clamp((p.vx*sa-p.vy*ca)*.026,-2.8,2.8),bob=p.landed?0:Math.sin(time*3)*.8;
  const transform=v=>[p.x+v[0]*ca-v[1]*sa,p.y+v[0]*sa+v[1]*ca,p.z+v[2]+bob+v[1]/12*bank];
  const faces=[],main=p.hit>0?'#dce5cd':'#497c76',light=p.hit>0?'#fff8dd':'#87b2a0';
  meshBox(faces,-3,0,-4,30,15,11,light,main);
  faces.push({p:[[12,-7,-4],[29,-4,-1],[30,4,-1],[12,7,-4]],c:'#305658'}, {p:[[12,-7,-4],[12,-7,7],[24,-4,4],[29,-4,-1]],c:main}, {p:[[12,7,-4],[29,4,-1],[24,4,4],[12,7,7]],c:'#598f85'}, {p:[[12,-7,7],[24,-4,4],[24,4,4],[12,7,7]],c:'#e1c374'}, {p:[[13,-6,7.2],[24,-3.3,4.2],[24,-.5,4.2],[13,-.5,7.2]],c:'#eeb54c'}, {p:[[13,.7,7.2],[24,.7,4.2],[24,3.3,4.2],[13,6,7.2]],c:'#ffdb82'}, {p:[[24,-4,4],[29,-4,-1],[29,4,-1],[24,4,4]],c:'#284f55'});
  meshBox(faces,-3,0,7,15,11,5,'#6b9b8e','#24494e');
  meshBox(faces,-8,0,-4.1,4,15.6,11.4,'#e5dcc0','#c9d4b6');
  meshBox(faces,-27,0,-.5,28,4,4,'#73a08e','#365b60');
  faces.push({p:[[-42,0,0],[-36,0,1],[-35,0,17],[-40,0,18]],c:'#507f76'},{p:[[-42,0,0],[-35,0,17],[-35,2,17],[-42,2,0]],c:'#a2b6a0'},{p:[[-38,-12,1],[-30,-12,1],[-34,12,1],[-40,12,1]],c:'#a9bfac'});
  meshBox(faces,0,-13,-3,16,8,3,'#b1c2a9','#355a5e');meshBox(faces,0,13,-3,16,8,3,'#b1c2a9','#355a5e');
  meshBox(faces,2,-16,-6,12,4,4,'#4b6567','#1c363d');meshBox(faces,2,16,-6,12,4,4,'#4b6567','#1c363d');
  const transformed=faces.map(f=>({p:f.p.map(transform),c:f.c}));transformed.sort((a,b)=>a.p.reduce((s,p)=>s+r.view.depth(...p),0)/a.p.length-b.p.reduce((s,p)=>s+r.view.depth(...p),0)/b.p.length);
  r.shadow(p.x+5,p.y+8,29,.38,'#0b202a',0);
  if(!p.landed)r.decal(g=>{for(let j=0;j<2;j++)r.groundRing(p.x,p.y,24+((time*21+j*17)%32),'#8cac9d',.1,0);});
  r.queue(p.x,p.y,p.z,g=>{
   for(const f of transformed)poly(r,g,f.p,f.c);
   for(const y of [-8,8]){line(r,g,transform([-10,y,-5]),transform([-10,y,-10]),'#b6c7b4',2);line(r,g,transform([13,y,-5]),transform([13,y,-10]),'#b6c7b4',2);line(r,g,transform([-15,y,-10]),transform([19,y,-10]),'#19363e',3);}
   line(r,g,transform([-3,0,11]),transform([-3,0,16]),'#c6cbb6',2);
   const rotor=time*(p.landed?4:38);for(let j=0;j<4;j++){const ang=rotor+j*TAU/4,cs=Math.cos(ang),sn=Math.sin(ang),pts=[[-3+cs*4-sn*1.5,sn*4+cs*1.5,16],[-3+cs*46-sn*2,sn*46+cs*2,16],[-3+cs*46+sn*1,sn*46-cs*1,16],[-3+cs*4+sn*1.5,sn*4-cs*1.5,16]].map(transform);px.blend(g,j%2?.65:.92,'normal',()=>poly(r,g,pts,j%2?'#b8c2b1':'#293f43'));line(r,g,transform([-3+cs*40,sn*40,16]),transform([-3+cs*46,sn*46,16]),'#dda658',2);}
   const hub=r.w(...transform([-3,0,17]));px.disc(g,...hub,3,'#e2d1a4');
   const tl=r.w(...transform([-39,-2,7]));px.line(g,tl[0]-Math.cos(rotor)*7,tl[1]-Math.sin(rotor)*7,tl[0]+Math.cos(rotor)*7,tl[1]+Math.sin(rotor)*7,'#becbbc',2);
   const lamp=r.w(...transform([29,0,0]));px.disc(g,...lamp,2,'#ffedb0');r.glowDisc(g,...lamp,7,'#ffcc6e',.22);
   const nav=r.w(...transform([-6,-8,8]));px.disc(g,...nav,1,Math.sin(time*7)>0?'#ff9862':'#963a32');
  },{bias:30});
  if(p.module||p.winch>0){const item=p.module?{x:p.x+Math.sin(time*2)*3,y:p.y+Math.cos(time*2)*2}:p.winchPoint||p;const z=p.module?15:Math.max(1,p.z*(1-p.winch));r.queue(p.x,p.y,p.z,g=>{line(r,g,[p.x,p.y,p.z-4],[item.x,item.y,z],'#d5d3ab');if(p.module)r.box(g,item.x-7,item.y-6,z-6,item.x+7,item.y+6,z+3,'#f0c36a','#a77841');else{const q=r.w(item.x,item.y,z);px.rect(g,q[0]-2,q[1]-1,4,3,'#e0d3a6');}},{bias:31});}
 }
}
E.AircraftRig=AircraftRig;
function building(r,g,b){
 const x=b.x,y=b.y,w=b.w,h=b.h,z=b.z||24,roof=b.color||'#7b8c85';
 r.box(g,x-w/2,y-h/2,0,x+w/2,y+h/2,z,roof,'#526b6b');
 r.box(g,x-w/2-2,y-h/2-2,z,x+w/2+2,y+h/2+2,z+2,E.shade(roof,.18),'#344d55');
 for(let xx=x-w/2+9;xx<x+w/2-5;xx+=13){poly(r,g,[[xx,y+h/2+.1,9],[xx+7,y+h/2+.1,9],[xx+7,y+h/2+.1,17],[xx,y+h/2+.1,17]],'#d8ae67');line(r,g,[xx+3,y+h/2+.3,9],[xx+3,y+h/2+.3,17],'#405c61');}
 for(let yy=y-h/2+7;yy<y+h/2-5;yy+=13)poly(r,g,[[x+w/2+.1,yy,9],[x+w/2+.1,yy+6,9],[x+w/2+.1,yy+6,16],[x+w/2+.1,yy,16]],'#2b4650');
 r.box(g,x-10,y-9,z+2,x+7,y+7,z+7,'#425e63','#304a52');for(let i=0;i<5;i++)line(r,g,[x-8+i*3,y-8,z+7.2],[x-8+i*3,y+6,z+7.2],'#8c9e90');
 line(r,g,[x-w/2,y-h/2,z+3],[x+w/2,y-h/2,z+3],'#bec3a8');
}
function container(r,g,b){const x=b.x,y=b.y,w=b.w||36,h=b.h||16,z=b.z||13,c=b.color||'#ac674c';r.box(g,x-w/2,y-h/2,0,x+w/2,y+h/2,z,E.shade(c,.15),c);for(let i=-w/2+4;i<w/2;i+=5){line(r,g,[x+i,y-h/2,z+.2],[x+i,y+h/2,z+.2],E.shade(c,-.15));line(r,g,[x+i,y+h/2,.4],[x+i,y+h/2,z],E.shade(c,-.15));}line(r,g,[x-w/2,y+h/2,z],[x+w/2,y+h/2,z],E.shade(c,.4));}
function crane(r,g,b){const x=b.x,y=b.y;r.box(g,x-7,y-7,0,x+7,y+7,5,'#afb6a0','#53696a');for(const dx of [-4,4])for(const dy of [-4,4])line(r,g,[x+dx,y+dy,5],[x+dx,y+dy,58],'#c38b4c',2);for(let z=9;z<53;z+=9){line(r,g,[x-4,y+4,z],[x+4,y+4,z+8],'#e3b976');line(r,g,[x+4,y-4,z],[x+4,y+4,z+8],'#946c44');}r.box(g,x-10,y-9,47,x+11,y+10,57,'#d7a45c','#9c774c');line(r,g,[x,y,60],[x-54,y,62],'#ddb477',3);line(r,g,[x,y,74],[x-52,y,62],'#7f968d');line(r,g,[x-52,y,62],[x-52,y,14],'#b6c2ad');}
function tree(r,g,b){r.box(g,b.x-1,b.y-1,0,b.x+2,b.y+2,b.s*.9,'#53655c','#344a46');for(let j=0;j<3;j++){const w=b.s*(1-j*.2),z=b.s*.35+j*b.s*.48;poly(r,g,[[b.x-w,b.y-w,z],[b.x+w,b.y-w,z],[b.x,b.y,z+b.s*1.5]],'#3e6051');poly(r,g,[[b.x+w,b.y-w,z],[b.x+w,b.y+w,z],[b.x,b.y,z+b.s*1.5]],'#294c46');poly(r,g,[[b.x+w,b.y+w,z],[b.x-w,b.y+w,z],[b.x,b.y,z+b.s*1.5]],'#31554a');}}
function rock(r,g,b){const s=b.s;poly(r,g,[[b.x-s,b.y-s,0],[b.x+s,b.y-s,0],[b.x+s*.7,b.y-s*.3,s],[b.x-s*.3,b.y-s*.6,s*1.4]],'#819084');poly(r,g,[[b.x+s,b.y-s,0],[b.x+s,b.y+s,0],[b.x+s*.3,b.y+s*.6,s*.8],[b.x+s*.7,b.y-s*.3,s]],'#4b6664');poly(r,g,[[b.x-s,b.y+s,0],[b.x+s,b.y+s,0],[b.x+s*.3,b.y+s*.6,s*.8],[b.x-s*.3,b.y-s*.6,s*1.4],[b.x-s,b.y-s,0]],'#5e7970');}
class IslandWorld{
 constructor(game){this.game=game;this.rig=new AircraftRig();this.props=[];this.ocean=[];this.cache=null;this.makeProps();}
 makeProps(){
  const buildings=[{x:159,y:867,w:72,h:42,z:27,color:'#bdc2a7'},{x:299,y:1020,w:87,h:47,z:32,color:'#728c83'},{x:331,y:839,w:46,h:35,z:21,color:'#b4bda5'},{x:485,y:350,w:60,h:35,z:24,color:'#839b8b'},{x:678,y:815,w:42,h:63,z:27,color:'#a2aa93'},{x:827,y:846,w:72,h:35,z:30,color:'#8e9e8b'},{x:778,y:267,w:75,h:36,z:28,color:'#b4b7a0'},{x:877,y:568,w:55,h:42,z:27,color:'#929e8e'},{x:171,y:393,w:51,h:32,z:22,color:'#adb29a'},{x:1161,y:179,w:65,h:42,z:27,color:'#8a9a8a'},{x:1112,y:926,w:65,h:40,z:25,color:'#a2ac95'}];
  buildings.forEach(b=>this.props.push({...b,type:'building'}));
  [{x:315,y:981,color:'#a66c4c'},{x:339,y:981,color:'#6a9390'},{x:765,y:859,color:'#b78155'},{x:768,y:880,color:'#789a8c'},{x:711,y:860,color:'#a76449'},{x:559,y:606,color:'#688b86'},{x:926,y:655,color:'#aa754d'},{x:1139,y:365,color:'#897a56'}].forEach(b=>this.props.push({...b,type:'container'}));
  this.props.push({type:'crane',x:818,y:893},{type:'crane',x:375,y:1020});
  const rand=E.rng(7753),avoid=[...buildings,...C.STAGES,C.BASE,C.MODULE,...new C.Mission().enemies,...new C.Mission().crew];
  for(let i=0;i<540;i++){const x=rand()*1280+20,y=rand()*1120+20;if(!C.landAt(x,y)){if(i%2===0)this.ocean.push({x,y,t:rand()*TAU,w:8+rand()*16});continue;}if(avoid.some(p=>Math.hypot(x-p.x,y-p.y)<(p.w?Math.max(p.w,p.h)*.7+16:57)))continue;let onRoad=false;for(const path of C.ROADS)for(let j=1;j<path.length;j++)if(C.segmentCircle(...path[j-1],...path[j],x,y,26))onRoad=true;if(onRoad)continue;this.props.push({type:rand()>.22?'tree':'rock',x,y,s:6+rand()*8});}
 }
 bake(){
  const v=this.game.view,cs=[[0,0],[C.LIMITS.width,0],[0,C.LIMITS.height],[C.LIMITS.width,C.LIMITS.height]].map(p=>v.p(...p));
  const minX=Math.floor(Math.min(...cs.map(p=>p[0]))-110),minY=-120,w=Math.ceil(Math.max(...cs.map(p=>p[0]))-minX+110),h=Math.ceil(Math.max(...cs.map(p=>p[1]))-minY+150),canvas=E.mkCanvas(w,h),g=E.ctx2d(canvas),r=Object.create(this.game.r);r.w=(x,y,z=0)=>{const p=v.p(x,y,z);return [p[0]-minX,p[1]-minY];};
  px.rect(g,0,0,w,h,COLORS.sea);const rand=E.rng(3131);
  for(let i=0;i<9500;i++){const x=rand()*w,y=rand()*h;px.rect(g,x,y,Math.ceil(2+rand()*15),1,i%3===0?'#183b47':'#143440');}
  for(const island of C.ISLANDS){
   for(let i=0;i<island.length;i++){const a=island[i],b=island[(i+1)%island.length];poly(r,g,[[...a,-20],[...b,-20],[...b,0],[...a,0]],i%2?'#2b454b':'#355157');line(r,g,[...a,-21],[...b,-21],'#547b78',3);line(r,g,[...a,-18],[...b,-18],'#9eafa0');}
   poly(r,g,island.map(p=>[...p,0]),COLORS.land);
   for(let i=0;i<island.length;i++)line(r,g,[...island[i],.1],[...island[(i+1)%island.length],.1],'#829581',2);
  }
  for(let x=40;x<1300;x+=12)for(let y=50;y<1150;y+=12){if(!C.landAt(x,y))continue;const a=E.hash2(x,y),col=a>.65?'#597162':a>.32?'#415d55':'#4d675b',s=2+a*7;poly(r,g,[[x-s,y,0],[x,y-s*.7,0],[x+s,y,0],[x,y+s*.7,0]],col);if(a>.78)line(r,g,[x,y,0],[x+6,y+3,0],'#718370');}
  for(const path of C.ROADS)for(let i=1;i<path.length;i++){road(r,g,path[i-1],path[i],39,'#697c70');road(r,g,path[i-1],path[i],30,'#2e464c');const a=path[i-1],b=path[i],d=Math.hypot(a[0]-b[0],a[1]-b[1]);for(let t=8;t<d;t+=27){const u=t/d,z=Math.min(d,t+9)/d;line(r,g,[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,.1],[a[0]+(b[0]-a[0])*z,a[1]+(b[1]-a[1])*z,.1],'#a9ad8c');}}
  for(const [x,y,w,h]of[[C.BASE.x,C.BASE.y,111,102],[753,824,118,133],[C.RELAY.x,C.RELAY.y,109,86],[1070,280,170,152],[158,477,83,81]]){r.box(g,x-w/2,y-h/2,-3,x+w/2,y+h/2,0,'#839082','#506664');for(let a=x-w/2;a<x+w/2;a+=18)line(r,g,[a,y-h/2,.1],[a,y+h/2,.1],'#738276');for(let b=y-h/2;b<y+h/2;b+=18)line(r,g,[x-w/2,b,.1],[x+w/2,b,.1],'#758478');}
  flat(r,g,240,940,87,78,'#354f54',.2);circle(r,g,240,940,32,'#c7d1b7',.3,60);flat(r,g,227,940,6,28,'#d4d6b6',.4);flat(r,g,253,940,6,28,'#d4d6b6',.4);flat(r,g,240,940,26,6,'#d4d6b6',.4);
  for(let i=0;i<10;i++){flat(r,g,190+i*10,894,5,3,'#d9ba70',.4);flat(r,g,190+i*10,986,5,3,'#d9ba70',.4);}
  flat(r,g,C.RELAY.x,C.RELAY.y,34,30,'#314e55',.2);flat(r,g,C.RELAY.x,C.RELAY.y,20,18,'#dabf77',.4);
  // Two breakwater arms, pier piles, and the flood barrier.
  for(const [x,y,w,h]of[[832,913,160,18],[686,923,18,108],[387,1070,150,20],[978,431,145,16]]){r.box(g,x-w/2,y-h/2,-24,x+w/2,y+h/2,0,'#9b9e8b','#3e5a5d');for(let k=-w/2+10;k<w/2;k+=18){line(r,g,[x+k,y-h/2,1],[x+k,y+h/2,1],'#657b70');}}
  this.cache={canvas,minX,minY,view:v};
 }
 stamp(b,r){
  if(b._stamp?.view===r.view)return b._stamp;
  const extent=b.type==='building'?[b.w/2+4,b.h/2+4,(b.z||24)+10]:b.type==='container'?[(b.w||36)/2+3,(b.h||16)/2+3,(b.z||13)+3]:b.type==='crane'?[58,15,80]:[b.s+4,b.s+4,b.s*3.4];
  const corners=[];for(const x of [-extent[0],extent[0]])for(const y of [-extent[1],extent[1]])for(const z of [0,extent[2]])corners.push(r.view.p(x,y,z));
  const minX=Math.floor(Math.min(...corners.map(p=>p[0])))-3,minY=Math.floor(Math.min(...corners.map(p=>p[1])))-3;
  const w=Math.ceil(Math.max(...corners.map(p=>p[0])))-minX+4,h=Math.ceil(Math.max(...corners.map(p=>p[1])))-minY+4,canvas=E.mkCanvas(w,h),g=E.ctx2d(canvas),local=Object.create(r);
  local.w=(x,y,z=0)=>{const p=r.view.p(x-b.x,y-b.y,z);return[p[0]-minX,p[1]-minY];};
  ({building,container,crane,tree,rock}[b.type])(local,g,b);
  return b._stamp={canvas,minX,minY,view:r.view};
 }
 draw(r,m){
  if(!this.cache||this.cache.view!==r.view)this.bake();const {canvas,minX,minY}=this.cache;r.ctx.drawImage(canvas,Math.round(minX-r.ix),Math.round(minY-r.iy));
  const t=this.game.time;
  for(const w of this.ocean)if(r.visible(w.x,w.y,-20,30,20,20)){const a=(Math.sin(t*1.5+w.t)+1)*.13+.08;r.decal(g=>px.blend(g,a,'normal',()=>line(r,g,[w.x,w.y,-21],[w.x+w.w,w.y,-21],'#adc6b7')));}
  for(const b of this.props){if(!r.visible(b.x,b.y,0,100,100,45))continue;const stamp=this.stamp(b,r);r.queue(b.x,b.y,0,g=>{const p=r.w(b.x,b.y,0);g.drawImage(stamp.canvas,Math.round(p[0]+stamp.minX),Math.round(p[1]+stamp.minY));});}
  // The station changes from amber to teal after the module is installed.
  r.queue(C.RELAY.x,C.RELAY.y,1,g=>{const x=C.RELAY.x,y=C.RELAY.y;r.box(g,x-9,y-7,0,x+9,y+7,m.relayOnline?13:5,m.relayOnline?'#9ee1c1':'#e3b35c','#416865');const p=r.w(x,y,m.relayOnline?15:6);px.disc(g,...p,3,m.relayOnline?COLORS.teal:COLORS.amber);r.glowDisc(g,...p,14,m.relayOnline?COLORS.teal:COLORS.amber,.23);});
  this.drawBarrier(r,m);
  for(const e of m.enemies)this.drawEnemy(r,e,m,t);
  for(const s of m.supplies)if(!s.used&&r.visible(s.x,s.y,0,30,30,20)){r.decal(g=>r.groundRing(s.x,s.y,14,'#8fd9c6',.65));r.queue(s.x,s.y,0,g=>{r.box(g,s.x-6,s.y-6,0,s.x+6,s.y+6,9,s.type==='fuel'?'#d2b96a':'#8dbfac','#466b69');const p=r.w(s.x,s.y,12);E.font.text(g,s.type==='fuel'?'F':s.type==='ammo'?'A':'+',p[0],p[1]-4,'#e2eed0',{align:'center',outline:'#1b3e45'});});}
  if(m.stage===2&&!m.player.module)r.queue(C.MODULE.x,C.MODULE.y,0,g=>{r.box(g,C.MODULE.x-8,C.MODULE.y-6,0,C.MODULE.x+8,C.MODULE.y+6,11,'#efc779','#947248');const p=r.w(C.MODULE.x,C.MODULE.y,15);E.font.text(g,'MODULE',p[0],p[1]-8,'#ffe1a2',{align:'center',outline:'#1c3740'});});
  for(const c of m.crew){if(c.state!=='waiting'||c.role==='final'&&m.stage<4||!r.visible(c.x,c.y,0,30,30,20))continue;const visible=c.role==='optional'||m.stage>=1;if(visible)r.decal(g=>r.groundRing(c.x,c.y,10,'#a0e5cc',.45+.25*Math.sin(t*3)));r.queue(c.x,c.y,0,g=>{const p=r.w(c.x,c.y,0),z=p[1],x=p[0];px.rect(g,x-3,z-8,6,5,'#d8b065');px.rect(g,x-2,z-3,2,4,'#243d44');px.rect(g,x+1,z-3,2,4,'#243d44');px.rect(g,x-2,z-13,5,5,'#d8c7a0');px.rect(g,x-3,z-14,7,3,'#ffcf6b');px.line(g,x+3,z-7,x+6,z-10-Math.round(Math.sin(t*5+c.x)*2),'#cfb58c',2);});}
  const target=m.target();if(m.status==='playing'&&target){r.decal(g=>{r.groundRing(target.x,target.y,32,'#e9bb66',.55);r.groundRing(target.x,target.y,36+Math.sin(t*2)*2,'#e9bb66',.18);});}
  r.decal(g=>r.groundRing(C.BASE.x,C.BASE.y,44,'#99d9c6',.45));
  for(const b of m.projectiles){if(!r.visible(b.x,b.y,b.z,25,25,25))continue;r.queue(b.x,b.y,b.z,g=>{const p=r.w(b.x,b.y,b.z),q=r.w(b.x-b.vx*.035,b.y-b.vy*.035,b.z-b.vz*.035),c=b.team==='player'?b.kind==='cannon'?'#ffebae':'#ffcf6e':'#ff7d61';px.line(g,...q,...p,c,b.kind==='cannon'?1:2);if(b.kind!=='cannon'){px.disc(g,...p,2,'#fff2c5');r.glowDisc(g,...p,6,c,.16);}},{bias:20,emissive:true});}
  const item=m.interaction();this.rig.draw(r,{...m.player,winchPoint:item||null},t);
  if(m.player.hp/m.player.maxHp<.3&&!m.player.landed){const p=r.w(m.player.x,m.player.y,m.player.z+10);r.overlay(g=>{if(Math.sin(t*5)>0)E.font.text(g,'ARMOR LOW',p[0],p[1]-45,'#ffb795',{align:'center',outline:'#102b35'});});}
 }
 drawBarrier(r,m){r.queue(937,386,0,g=>{r.box(g,903,372,-21,983,394,0,'#a4a995','#4c6766');for(let x=905;x<982;x+=15)r.box(g,x,375,0,x+5,390,m.relayOnline?3:21,m.relayOnline?'#85baa5':'#c39251','#3d585d');line(r,g,[905,376,m.relayOnline?3:22],[980,376,m.relayOnline?3:22],m.relayOnline?'#8bddc6':'#ecc981',2);});}
 drawEnemy(r,e,m,t){
  if(!r.visible(e.x,e.y,0,80,100,40))return;
  const boss=e.kind.startsWith('boss'),x=e.x,y=e.y;
  if(e.dead){r.queue(x,y,0,g=>{r.box(g,x-e.r*.7,y-e.r*.5,0,x+e.r*.7,y+e.r*.5,5,'#354b4e','#233b44');for(let k=0;k<4;k++){const xx=x-8+k*5,yy=y+Math.sin(k)*8;r.box(g,xx-2,yy-2,0,xx+3,yy+3,7,'#696c59','#2b4348');}const p=r.w(x,y,6);px.disc(g,...p,3,'#9c6442');});return;}
  if(e.kind==='bossCore'){this.drawBossBody(r,e,m);return;}
  r.shadow(x,y,e.r*.9,.25,'#152f37',0);
  r.queue(x,y,0,g=>{
   const top=e.flash>0?'#fff0cc':e.kind==='tank'?'#bc794d':boss?'#899083':'#8b9580',side=e.flash>0?'#ffe4b1':'#465e5c';
   if(e.kind==='radar'){
    r.box(g,x-19,y-15,0,x+19,y+15,12,'#889b89','#4d6866');for(const d of [-7,7])line(r,g,[x+d,y,12],[x+d*.35,y,43],'#c5cbb0',2);line(r,g,[x-7,y,20],[x+6,y,33],'#607d77');
    const a=t*.85,pts=[];for(let i=0;i<10;i++){const u=i/10*TAU;pts.push([x+Math.cos(a)*Math.cos(u)*19,y+Math.sin(a)*Math.cos(u)*19,41+Math.sin(u)*12]);}poly(r,g,pts,'#b1bd9f');for(let i=0;i<5;i++)line(r,g,pts[i],pts[i+5],'#5e7a72');const p=r.w(x,y,56);px.disc(g,...p,2,Math.sin(t*4)>0?'#ffa95e':'#704537');
   }else if(e.kind==='tank'){r.box(g,x-9,y-8,0,x+9,y+8,18,'#dba573','#8d5944');for(let z of [3,13])line(r,g,[x+9,y-8,z],[x+9,y+8,z],'#d3b585');}
   else{
    const a=e.kind==='patrol'||e.kind==='boat'?Math.sin(e.moveTime*.2):e.face,cs=Math.cos(a),sn=Math.sin(a),P=(f,l,z)=>[x+cs*f-sn*l,y+sn*f+cs*l,z];
    if(e.kind==='boat'){poly(r,g,[P(-25,-12,1),P(20,-10,1),P(31,0,1),P(20,10,1),P(-25,12,1)],'#b1b7a0');poly(r,g,[P(-25,-12,-5),P(20,-10,-5),P(31,0,-5),P(20,10,-5),P(-25,12,-5)],'#314b53');}
    else r.box(g,x-16,y-13,0,x+16,y+13,boss?17:6,top,side);
    if(e.kind==='patrol')for(const dy of [-14,14])for(const dx of [-10,10]){const p=r.w(x+dx,y+dy,4);px.disc(g,...p,4,'#1d363e');px.disc(g,...p,2,'#73887d');}
    r.box(g,x-10,y-8,boss?17:6,x+10,y+8,boss?24:14,top,side);
    if(e.kind==='sam'||boss){for(const off of [-5,5]){poly(r,g,[P(-11,off-2,15+(boss?9:0)),P(16,off-2,23+(boss?9:0)),P(16,off+2,23+(boss?9:0)),P(-11,off+2,15+(boss?9:0))],e.wind?'#eac785':'#a3aa8b');line(r,g,P(-11,off,17+(boss?9:0)),P(16,off,25+(boss?9:0)),'#304a52',2);}}
    else{line(r,g,P(0,0,16),P(25,0,19),'#203c44',5);line(r,g,P(3,-1,18),P(25,-1,21),'#b2baa0',2);}
    if(e.wind>0){const p=r.w(x,y,boss?30:19);px.disc(g,...p,3,'#ffc067');r.glowDisc(g,...p,10,'#fa9c55',.25);}
   }
  },{bias:boss?10:0});
  if(e.wind>0)r.decal(g=>{const a=e.aimA,rr=e.kind.startsWith('boss')?130:90;r.groundArc(x,y,rr-2,rr,a-.12,a+.12,'#ed9365',.45);});
  if((e.hp<e.maxHp||e.id===root.BWGame?.aimTarget)&&e.active)r.overlay(g=>{const p=r.w(x,y,boss?42:e.kind==='radar'?61:31);px.rect(g,p[0]-17,p[1]-3,34,3,'#192f39');px.rect(g,p[0]-17,p[1]-3,Math.ceil(34*e.hp/e.maxHp),3,COLORS.red);});
 }
 drawBossBody(r,e,m){const x=e.x,y=e.y;r.shadow(x,y,47,.3);r.queue(x,y,0,g=>{for(const dy of [-28,28])r.box(g,x-43,y+dy-6,0,x+43,y+dy+6,13,'#5c7370','#203b43');r.box(g,x-42,y-25,7,x+42,y+25,22,'#788b7d','#425d61');r.box(g,x-20,y-19,22,x+20,y+19,32,m.bossPhase===2?'#d59b56':'#abb397','#4d6665');for(let k=-30;k<=30;k+=10){line(r,g,[x+k,y+35,3],[x+k,y+35,12],'#809180',2);line(r,g,[x+k,y-35,3],[x+k,y-35,12],'#809180',2);}const p=r.w(x,y,34);px.disc(g,...p,9,m.bossPhase===2?'#ffd079':'#304d56');px.disc(g,...p,5,m.bossPhase===2?'#fff2bc':'#62998f');if(m.bossPhase===2)r.glowDisc(g,...p,21,'#ffbe61',.3);line(r,g,[x+32,y-9,25],[x+32,y-9,49],'#bfc0a1');const q=r.w(x+32,y-9,49);px.disc(g,...q,2,'#fd9362');},{bias:3});}
}
root.BWVisual={IslandWorld,AircraftRig,COLORS,poly,line,flat,circle};
})(globalThis);
