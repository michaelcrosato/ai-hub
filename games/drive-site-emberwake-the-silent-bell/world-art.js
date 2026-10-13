/* Emberwake world art and mechanical rigs. Original game assets. */
(function(root) {
'use strict';
const E = My3D2dge, px = E.px;
const A = root.EW = root.EW || {};
const C = A.palette = {ink:'#102632',stone:'#9d9984',light:'#c9bda1',edge:'#e4cc9c',dark:'#57666a',water:'#367a80',waterLight:'#76bfb3',gold:'#d7a75f',rust:'#98583f',cloth:'#294d61'};
const poly=(g,p,c)=>px.poly(g,p,c);
const line=(g,p,q,c,w)=>px.line(g,p[0],p[1],q[0],q[1],c,w||1);
const worldPoly=(r,g,p,c)=>poly(g,p.map(v=>r.w(v[0],v[1],v[2]||0)),c);
const nearRect=(x,y,b,pad=0)=>x>=b[0]-pad&&x<=b[2]+pad&&y>=b[1]-pad&&y<=b[3]+pad;
A.rooms = {
 quay:{name:'Pilgrim Quay',subtitle:'THE LAST WATER ROAD',w:480,h:370,start:[92,278],focus:[235,180],floor:[[32,65,462,336]],gaps:[[225,65,246,336]],blocks:[[125,89,149,111],[360,73,391,99],[120,219,142,237],[358,233,387,254]],water:[[158,84,194,142],[286,232,338,301]],pillars:[[65,72,46],[137,97,73],[215,74,34],[285,70,52],[377,84,81],[447,86,50],[369,242,42],[127,226,36]],props:[['crate',325,281],['crate',346,286],['barrel',332,303],['torch',172,161],['torch',273,161],['flag',403,126],['flag',86,149]],exits:[{x:427,y:107,id:'hall',label:'Enter the Relay Hall'}]},
 hall:{name:'Relay Hall',subtitle:'A CHOIR WITHOUT A VOICE',w:530,h:400,start:[82,322],focus:[270,195],floor:[[32,55,503,362]],gaps:[],blocks:[[108,105,130,127],[108,260,130,282],[421,105,443,127],[421,260,443,282],[245,103,289,167],[245,229,289,296]],water:[[229,69,306,169],[229,226,306,337]],pillars:[[116,112,105],[116,272,86],[435,114,105],[433,270,74],[50,63,46],[492,61,54]],props:[['torch',163,119],['torch',385,119],['torch',164,279],['torch',385,279],['crate',70,196],['barrel',79,217]],exits:[{x:472,y:203,id:'hangar',label:'Enter the Morrow Dock'},{x:55,y:335,id:'quay',label:'Return to Pilgrim Quay'}]},
 hangar:{name:'Morrow Dock',subtitle:'THE MACHINE REMEMBERS',w:590,h:420,start:[90,319],focus:[295,205],floor:[[26,60,554,371]],gaps:[],blocks:[[58,88,82,114],[246,91,268,111],[476,301,514,333]],water:[[303,76,509,141]],pillars:[[70,96,107],[257,97,99],[540,74,88],[489,321,61],[30,329,47]],props:[['crate',192,305],['crate',218,310],['barrel',207,333],['torch',158,111],['torch',317,306],['flag',446,286]],exits:[{x:47,y:341,id:'hall',label:'Return to the Relay Hall'}]},
 causeway:{name:'Crown Causeway',subtitle:'LET THE BELL SPEAK',w:660,h:450,start:[105,300],focus:[325,213],floor:[[12,120,633,370]],gaps:[],blocks:[],water:[[10,80,635,113]],pillars:[[30,130,28],[162,132,30],[290,131,24],[412,130,32],[578,130,28],[614,349,35],[25,347,26]],props:[['flag',196,147],['flag',557,149]],exits:[]}
};
A.floorAt=function(room,x,y){return room.floor.some(b=>nearRect(x,y,b))&&!room.gaps.some(b=>nearRect(x,y,b));};
A.blocked=function(room,x,y,r=7){return room.blocks.some(b=>nearRect(x,y,b,r))||room.water.some(b=>nearRect(x,y,b,r));};
A.makeHuman=function(who) {
 const config={
  mira:{build:'heroic',size:1.02,weapon:null,outfit:'coat',hair:{style:'ponytail',len:5},cape:'#c16943',sleeves:'long',colors:{cape:'#c16943',capeIn:'#79493e',skin:'#d7ac8c',cloth:'#31546c',pants:'#273d51',boot:'#3d3435',hair:'#222e3b',glove:'#ba855f',belt:'#8c6548'}},
  oren:{build:'heroic',size:1.04,weapon:'staff',outfit:'coat',hair:'short',cape:'#a9a78f',sleeves:'long',colors:{cape:'#a9a78f',capeIn:'#656f6d',skin:'#b88767',cloth:'#738181',pants:'#3e555c',boot:'#4c3e35',hair:'#d4c7ad',glove:'#837966',belt:'#795c43',blade:'#75c7be'}},
  tala:{build:'chibi',size:.94,weapon:null,outfit:'coat',hair:'bob',sleeves:'long',colors:{skin:'#be926e',cloth:'#a08057',pants:'#4d6166',boot:'#483c32',hair:'#3e393a'}},
  warden:{build:'bulky',size:1.1,weapon:null,outfit:'shirt',armor:true,hair:'bald',eyeGlow:'#ecc47c',colors:{skin:'#78908c',cloth:'#5e7071',pants:'#334f59',boot:'#344c55',hair:'#4e6868',glove:'#718281',armor:'#859992',trim:'#c7a570'}},
  cantor:{build:'heroic',size:1.1,weapon:'staff',outfit:'robe',hood:true,eyeGlow:'#ffe3ad',colors:{skin:'#a4a4a0',cloth:'#686172',pants:'#4c4a5a',boot:'#3a3944',hair:'#bcb8a6',glove:'#aca995'}}
 };
 return new E.Humanoid(config[who]||config.mira);
};
A.makeUnit=function(id,x,y){return {id,x,y,z:0,vx:0,vy:0,facing:0,rig:A.makeHuman(id),hurt:0,pose:null,attack:null};};
A.drawHuman=function(r,u,scale=1){
 r.shadow(u.x,u.y,7.5*scale,.29,'#162732',0);
 r.actor(u.x,u.y,u.z,(g,x,y)=>u.rig.draw(g,x,y,r.view),{xray:{color:'#dbb77d',outline:'#eee0b6'},rimColor:'#f9d6a1',flash:u.hurt>0?'#ffdfab':false});
};
function stroke3(r,g,a,b,c,w){line(g,r.w(a[0],a[1],a[2]),r.w(b[0],b[1],b[2]),c,w);}
function gearCircle(r,g,x,y,z,rad,col,n=24,thick=1,phase=0){
 let last=null;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2+phase,p=r.w(x+Math.cos(a)*rad,y+Math.sin(a)*rad,z);if(last)line(g,last,p,col,thick);last=p;}
}
function platform(r,g,b,room){
 const [x0,y0,x1,y1]=b;
 r.box(g,x0,y0,-32,x1,y1,-2,'#b8ab8b','#52676c');
 r.box(g,x0-2,y0-2,-7,x1+2,y1+2,-3,'#d5bc8d','#8d8d7a');
 for(let x=x0;x<x1;x+=16)for(let y=y0;y<y1;y+=16){
  if(room.gaps.some(v=>nearRect(x+8,y+8,v)))continue;
  const x2=Math.min(x+16,x1),y2=Math.min(y+16,y1),v=E.hash2(x*13,y*7),col=E.mix('#7b8580','#b4ac93',v*.69+.2);
  worldPoly(r,g,[[x,y,0],[x2,y,0],[x2,y2,0],[x,y2,0]],col);
  const p=r.w(x,y,0),q=r.w(x2,y,0),s=r.w(x,y2,0);line(g,p,q,'#687c79');line(g,p,s,'#7d8880');
  if(v>.7){const t=r.w(x+4,y+8,.3);px.rect(g,t[0],t[1],2,1,'#c1b795');}
  if(v<.17){const p1=r.w(x+3,y+2,.2),p2=r.w(x+6,y+8,.2),p3=r.w(x+4,y+13,.2);line(g,p1,p2,'#6a7975');line(g,p2,p3,'#6a7975');}
 }
 for(let x=x0+12;x<x1-8;x+=24){
  r.box(g,x,y1-3,-25,x+3,y1+1,-10,'#b5a88a','#778174');
 }
}
// Stone floors do not change. Cache their pixels per projection and keep water,
// actors, lights, and props live. The small LRU bound also covers camera turns.
const floorCache=new Map();
function cachedPlatform(r,g,b,room){
 const v=r.view,key=[...b,v.yawDeg,v.pitchDeg,v.scale,v.zBoost,JSON.stringify(room.gaps)].join(':');
 let c=floorCache.get(key);
 if(!c){
  const pts=[];for(const x of [b[0]-4,b[2]+4])for(const y of [b[1]-4,b[3]+4])for(const z of [-34,2])pts.push(v.p(x,y,z));
  const x=Math.floor(Math.min(...pts.map(p=>p[0])))-3,y=Math.floor(Math.min(...pts.map(p=>p[1])))-3;
  const cv=document.createElement('canvas');cv.width=Math.ceil(Math.max(...pts.map(p=>p[0]))-x)+4;cv.height=Math.ceil(Math.max(...pts.map(p=>p[1]))-y)+4;
  const cg=cv.getContext('2d');cg.imageSmoothingEnabled=false;
  const cr=Object.create(r);cr.w=(wx,wy,wz=0)=>{const p=v.p(wx,wy,wz);return[p[0]-x,p[1]-y];};
  platform(cr,cg,b,room);c={cv,x,y};floorCache.set(key,c);if(floorCache.size>8)floorCache.delete(floorCache.keys().next().value);
 }else{floorCache.delete(key);floorCache.set(key,c);}
 const o=r.w(0,0,0);g.drawImage(c.cv,Math.round(o[0]+c.x),Math.round(o[1]+c.y));g._c=null;
}
function water(r,g,b,t,glow=false){
 const [x0,y0,x1,y1]=b;
 r.box(g,x0-3,y0-3,0,x1+3,y1+3,1,'#b9ae90','#657d7b');
 worldPoly(r,g,[[x0,y0,1.3],[x1,y0,1.3],[x1,y1,1.3],[x0,y1,1.3]],glow?'#478f8c':'#31696f');
 for(let y=y0+2;y<y1;y+=5){
  let x=x0+3+(Math.sin(y*.21+t*.7)*3+3);
  while(x<x1-4){const L=Math.min(x1-x-2,4+E.hash2(x,y)*12);stroke3(r,g,[x,y,1.4],[x+L,y,1.4],y%3?'#60978d':'#b0c8ad',1);x+=L+9;}
 }
}
function column(r,x,y,h,ruined=false){
 r.queue(x,y,0,g=>{
  r.box(g,x-11,y-11,0,x+11,y+11,5,'#b4a98b','#667571');
  r.box(g,x-8,y-8,5,x+8,y+8,11,'#c2b28e','#7d8576');
  r.box(g,x-6,y-6,11,x+6,y+6,h,'#b5a788','#79847c');
  for(let z=18;z<h;z+=14){r.box(g,x-6.6,y-6.6,z,x+6.6,y+6.6,z+2,'#b2a487','#647773');}
  if(!ruined){
   r.box(g,x-10,y-10,h-6,x+10,y+10,h,'#d1bb8e','#959680');
   r.box(g,x-12,y-12,h,x+12,y+12,h+3,'#dbbf91','#888f7a');
  }else worldPoly(r,g,[[x-6,y-6,h],[x+6,y-6,h],[x+1,y+3,h+7],[x-6,y+6,h]],'#c7b592');
  stroke3(r,g,[x-6.5,y,12],[x-6.5,y,h-7],'#d3bd90');
 },{hides:true});
}
function arch(r,x0,x1,y,z=75){
 r.queue((x0+x1)/2,y,0,g=>{
  const steps=16,R=(x1-x0)/2,cx=(x0+x1)/2;
  for(let i=0;i<steps;i++){
   const a=Math.PI-i/steps*Math.PI,b=Math.PI-(i+1)/steps*Math.PI;
   const p=[cx+Math.cos(a)*R,y,z+Math.sin(a)*R*.48],q=[cx+Math.cos(b)*R,y,z+Math.sin(b)*R*.48];
   worldPoly(r,g,[[p[0],y,p[2]],[q[0],y,q[2]],[q[0],y,q[2]+10],[p[0],y,p[2]+10]],i%2?'#a49e80':'#b4a78a');
   stroke3(r,g,[p[0],y,p[2]+10],[q[0],y,q[2]+10],'#dac198',1);
  }
 },{hides:true});
}
function flag(r,x,y,t){
 r.queue(x,y,0,g=>{
  stroke3(r,g,[x,y,0],[x,y,51],'#6c6d58',2);
  stroke3(r,g,[x,y,51],[x+24,y,51],'#b1a17d',1);
  let points=[[x+3,y,50],[x+24,y,50]];
  for(let i=5;i>=0;i--)points.push([x+3+i*4,y+Math.sin(t*1.6+i*.9+x)*2,28+Math.sin(i*.7)*2]);
  worldPoly(r,g,points,'#a66b48');
  stroke3(r,g,[x+14,y,47],[x+14,y+Math.sin(t*1.6+x)*2,32],'#d6a269',2);
 },{hides:false});
}
function crate(r,x,y){
 r.queue(x,y,0,g=>{
  r.box(g,x-8,y-8,0,x+8,y+8,12,'#a9986b','#716f57');
  for(const s of [-5,5])stroke3(r,g,[x+s,y+8,0],[x+s,y+8,12],'#434f47',2);
  stroke3(r,g,[x-8,y+8,2],[x+8,y+8,10],'#c4ab76',2);
 });
}
function lamp(r,x,y,t){
 r.queue(x,y,0,g=>{
  r.box(g,x-3,y-3,0,x+3,y+3,4,'#c9ae7c','#657572');
  stroke3(r,g,[x,y,3],[x,y,22],'#ac9b71',2);
  const p=r.w(x,y,25);px.disc(g,p[0],p[1],3,'#f4d899');r.glowDisc(g,p[0],p[1],13+Math.sin(t*2+x), '#f2c478',.19);
 });
}
function pipe(r,x0,y0,x1,y1,z){
 r.queue((x0+x1)/2,(y0+y1)/2,0,g=>{
  stroke3(r,g,[x0,y0,z],[x1,y1,z],'#374f54',7);stroke3(r,g,[x0,y0,z+1],[x1,y1,z+1],'#a89b6a',4);stroke3(r,g,[x0,y0,z+2],[x1,y1,z+2],'#d2b87f',1);
  const d=Math.hypot(x1-x0,y1-y0);for(let k=12;k<d;k+=26){const u=k/d,x=x0+(x1-x0)*u,y=y0+(y1-y0)*u;const p=r.w(x,y,z);px.disc(g,p[0],p[1],3,'#77806a');px.disc(g,p[0],p[1],1,'#d8b775');}
 },{hides:false});
}
function consoleArt(r,x,y,on,t){
 r.queue(x,y,0,g=>{
  r.box(g,x-12,y-7,0,x+12,y+7,15,'#9e977a','#506f72');
  worldPoly(r,g,[[x-10,y-8,15],[x+10,y-8,15],[x+10,y+5,20],[x-10,y+5,20]],'#294b56');
  worldPoly(r,g,[[x-7,y-6,15.8],[x+7,y-6,15.8],[x+7,y+2,19],[x-7,y+2,19]],on?'#8bccb7':'#c8a168');
  const p=r.w(x,y,23);r.glowDisc(g,p[0],p[1],18,on?'#91d4ba':'#e3b36c',.13);
 });
}
function memoryArt(r,x,y,t){
 const z=17+Math.sin(t*2)*2;
 r.shadow(x,y,5,.16);
 r.queue(x,y,z,g=>{
  const p=r.w(x,y,z);const s=r.view.scale*3;
  poly(g,[[p[0],p[1]-s*2],[p[0]+s,p[1]],[p[0],p[1]+s*2],[p[0]-s,p[1]]],'#b9e9d4');
  line(g,[p[0],p[1]-s*2],[p[0],p[1]+s*2],'#fff0bd');r.glowDisc(g,p[0],p[1],s*4,'#69d3c7',.15);
 });
 r.groundRing(x,y,8+Math.sin(t*2), '#87c6b7',.6);
}
A.drawMarker=function(r,x,y,color=C.gold,label){
 const t=r.game.time,z=38+Math.sin(t*3)*2;
 r.overlay(g=>{
  const p=r.w(x,y,z);poly(g,[[p[0]-4,p[1]-3],[p[0]+4,p[1]-3],[p[0],p[1]+2]],color);
  if(label)E.font.text(g,label,p[0],p[1]-14,color,{align:'center',outline:'#102632'});
 });
};
A.drawBackdrop=function(r,room,t,boss=false){
 const g=r.ctx,W=r.bw,H=r.bh;
 r.sky(boss?['#243441','#52686d','#b58e6b','#796c61']:['#304952','#86948d','#c0a481','#92725c'],{bands:64});
 const horizon=H*.40;
 for(let layer=0;layer<4;layer++){
  const pts=[[0,H]],c=['#b8aa89','#9c9b83','#7c8880','#4b6c70'][layer];
  for(let x=-40;x<W+50;x+=35){const y=horizon+layer*23+Math.sin(x*.005+layer*5)*18+Math.sin(x*.014+layer)*12;pts.push([x,y]);}pts.push([W,H]);poly(g,pts,c);
 }
 const sunX=W*.77,sunY=H*.17;r.glowDisc(g,sunX,sunY,58,'#e7c592',.15);px.disc(g,sunX,sunY,15,'#dec59b');
 for(let i=0;i<22;i++){
  const x=i*(W/20)-20+(Math.sin(i*2.7)*13),h=22+E.hash2(i,8)*80,base=horizon+25,ww=6+E.hash2(i,2)*13;
  px.rect(g,x,base-h,ww,h,'#60787a');
  poly(g,[[x-2,base-h],[x+ww/2,base-h-7],[x+ww+2,base-h]],'#667c7c');
  if(i%4===0){px.rect(g,x+ww*.4,base-h-31,2,31,'#708681');px.rect(g,x-3,base-h+9,ww+6,3,'#809184');}
 }
 for(let i=0;i<6;i++){
  const x=(i*173+t*1.5)%(W+230)-120,y=H*.08+i%3*17;
  px.blend(g,.10,'source-over',()=>{px.ell(g,x,y,70,3,'#e3d1ad');px.ell(g,x+49,y+5,100,2,'#e3d1ad');});
 }
 if(room==='hall'){
  px.blend(g,.25,'source-over',()=>px.rect(g,0,0,W,H,'#1c3b49'));
 }
};
A.drawRoom=function(r,id,state){
 const room=A.rooms[id],g=r.ctx,t=r.game.time;
 A.drawBackdrop(r,id,t,id==='causeway'&&!state.ending);
 for(const b of room.floor)cachedPlatform(r,g,b,room);
 // The channel crosses the full quay. Narrow ledges make the jump readable.
 if(id==='quay')for(const b of room.gaps){worldPoly(r,g,[[b[0],b[1],-1],[b[2],b[1],-1],[b[2],b[3],-1],[b[0],b[3],-1]],'#203e48');}
 for(const b of room.water)water(r,g,b,t,state.flags.relay);
 // Inlaid route lines are part of the station, and also guide the player.
 const routes=id==='quay'?[[75,176,425,176],[275,176,275,109]]:id==='hall'?[[60,203,475,203],[351,203,351,130]]:id==='hangar'?[[80,279,409,279],[409,279,409,191]]:[[72,262,560,262]];
 for(const q of routes){stroke3(r,g,[q[0],q[1],.4],[q[2],q[3],.4],'#c7ae78',2);stroke3(r,g,[q[0],q[1]+3,.4],[q[2],q[3]+3,.4],'#737e71',1);}
 for(const [x,y,h]of room.pillars)column(r,x,y,h,h<60);
 for(const [name,x,y]of room.props){if(name==='flag')flag(r,x,y,t);else if(name==='torch')lamp(r,x,y,t);else if(name==='barrel')r.prop('barrel',x,y,0,{size:1.2});else crate(r,x,y);}
 if(id==='quay'){
  arch(r,137,377,84,74);pipe(r,65,314,427,314,4);pipe(r,65,318,427,318,4);
  // Arch remnants, stone stair at the gate, and a dry water tower.
  for(let s=0;s<4;s++)r.queue(420,100+s*5,0,g=>r.box(g,399,94+s*5,0,445,99+s*5,(4-s)*2,'#d4bd96','#7c8c7f'));
  consoleArt(r,74,255,true,t);
  if(!state.memories.includes('quay'))memoryArt(r,83,98,t);
  if(!state.flags.quayCache)A.drawMarker(r,331,281,'#86c8ba');
  A.drawMarker(r,427,108,state.flags.quayBattle?C.gold:'#95a69b');
 }
 if(id==='hall'){
  arch(r,117,435,113,105);
  gearCircle(r,g,267,200,.8,45,'#b69b67',48);gearCircle(r,g,267,200,.8,38,'#718a82',48);
  consoleArt(r,357,132,state.flags.relay,t);consoleArt(r,92,117,false,t);
  for(let i=0;i<3;i++){
   r.queue(317+i*28,93,0,g=>{
    r.box(g,309+i*28,85,0,325+i*28,101,22,'#beb38e','#567573');
    const p=r.w(317+i*28,93,28);px.disc(g,p[0],p[1],6,state.flags.relay?'#80c7ba':'#c39c65');
    px.disc(g,p[0],p[1],2,'#e8d7a9');r.glowDisc(g,p[0],p[1],17,state.flags.relay?'#5ac3b4':'#b4986f',.1);
   });
  }
  pipe(r,168,342,383,342,5);
  if(!state.memories.includes('hall'))memoryArt(r,461,83,t);
  if(!state.flags.hallCache)A.drawMarker(r,75,201,'#86c8ba');
  A.drawMarker(r,357,130,state.flags.relay?'#83c8ba':C.gold);
  A.drawMarker(r,471,203,state.flags.relay?C.gold:'#a3a99a');
 }
 if(id==='hangar'){
  arch(r,72,259,96,106);pipe(r,65,355,481,355,6);consoleArt(r,147,156,true,t);
  for(let z=8;z<100;z+=12)stroke3(r,g,[461,96,z],[461,108,z],'#ad9570',2);
  r.queue(420,126,0,g=>{
   r.box(g,330,147,0,495,159,8,'#9a9d83','#465f64');
   r.box(g,345,179,0,460,192,4,'#b5a77f','#526567');
   gearCircle(r,g,400,227,.3,48,'#d3b981',48);gearCircle(r,g,400,227,.3,41,'#5e837e',48);
  });
  if(!state.memories.includes('hangar'))memoryArt(r,284,111,t);
  A.drawMarker(r,147,156,'#82c2b4');
  A.drawMarker(r,371,264,C.gold);
  if(!state.flags.hangarCache)A.drawMarker(r,199,310,'#86c8ba');
 }
 if(id==='causeway'){
  for(const y of [137,349])pipe(r,45,y,607,y,4);
  gearCircle(r,g,495,248,.4,75,'#b39167',64);gearCircle(r,g,495,248,.4,66,'#677f7b',64);
  consoleArt(r,146,180,true,t);
  if(!state.flags.boss)A.drawMarker(r,468,249,C.gold);
 }
 // Loose grass, masonry chips, and moving dust.
 for(let i=0;i<38;i++){
  const x=45+E.hash2(i,91)*(room.w-90),y=68+E.hash2(i,37)*(room.h-116);
  if(!A.floorAt(room,x,y)||A.blocked(room,x,y,1))continue;
  const p=r.w(x,y,.6);
  if(i%4===0){line(g,p,[p[0]-2,p[1]-5],'#666f56');line(g,p,[p[0]+1,p[1]-7],'#8a8b64');}
  else px.rect(g,p[0],p[1],1+E.hash2(i,32)*2,1,'#c7b98f');
 }
 r.overlay(g=>{
  for(let i=0;i<16;i++){
   const x=(E.hash2(i,78)*r.bw+t*(4+i%3))%r.bw,y=(E.hash2(i,63)*r.bh+Math.sin(t*.7+i)*9)%r.bh;
   px.blend(g,.3,'source-over',()=>px.dot(g,x,y,'#ead3a5'));
  }
 });
};
class Mech {
 constructor(kind='morrow'){this.kind=kind;this.t=0;this.walk=0;this.pose='idle';this.action=0;this.hit=0;this.facing=0;}
 update(dt,s={}){this.t+=dt;this.walk=E.approach(this.walk,s.walk?1:0,dt*3);this.pose=s.pose||'idle';this.action=s.action||0;this.hit=s.hit||0;this.facing=s.facing||0;}
 draw(r,x,y,z=0,size=1){
  const cantor=this.kind==='cantor',t=this.t,pose=this.pose,u=this.action;
  r.shadow(x,y,24*size,.34,'#102c34',0);
  r.queue(x,y,z,g=>{
   const theta=this.facing,ca=Math.cos(theta),sa=Math.sin(theta),bob=Math.sin(t*1.7)*.7+Math.abs(Math.sin(t*3.7))*this.walk;
   let lunge=pose==='attack'?Math.sin(Math.PI*u)*9:0,tilt=pose==='hurt'?-Math.sin(Math.PI*u)*4:0;
   const S=(f,s,h)=>r.w(x+(f*ca-s*sa)*size,y+(f*sa+s*ca)*size,z+(h+bob)*size);
   const parts=[],armor=this.hit>0?'#e4d9bc':cantor?'#978892':'#c5c2a1',shade=cantor?'#665d76':'#6e8e8b',dark=cantor?'#423f55':'#33555e',trim=cantor?'#d39b6e':'#cfb47b',glow=cantor?'#ee986c':'#ffd09b';
   const Q=(pts,c)=>parts.push({d:pts.reduce((n,p)=>n+r.view.depth((p[0]*ca-p[1]*sa)*size,(p[0]*sa+p[1]*ca)*size,p[2]*size),0)/pts.length,p:pts.map(p=>S(p[0],p[1],p[2])),c});
   const block=(f,s,h,w,d,hh,c=armor)=>{
    Q([[f-w/2,s-d/2,h],[f+w/2,s-d/2,h],[f+w/2,s+d/2,h],[f-w/2,s+d/2,h]],E.shade(c,.11));
    Q([[f-w/2,s-d/2,h],[f-w/2,s+d/2,h],[f-w/2,s+d/2,h+hh],[f-w/2,s-d/2,h+hh]],shade);
    Q([[f-w/2,s+d/2,h],[f+w/2,s+d/2,h],[f+w/2,s+d/2,h+hh],[f-w/2,s+d/2,h+hh]],E.shade(c,-.2));
    Q([[f+w/2,s-d/2,h],[f+w/2,s+d/2,h],[f+w/2,s+d/2,h+hh],[f+w/2,s-d/2,h+hh]],c);
    Q([[f-w/2,s-d/2,h+hh],[f+w/2,s-d/2,h+hh],[f+w/2,s+d/2,h+hh],[f-w/2,s+d/2,h+hh]],E.shade(c,.15));
   };
   const limb=(a,b,w,c)=>{
    const A=S(...a),B=S(...b);parts.push({d:(r.view.depth((a[0]*ca-a[1]*sa)*size,(a[0]*sa+a[1]*ca)*size,a[2]*size)+r.view.depth((b[0]*ca-b[1]*sa)*size,(b[0]*sa+b[1]*ca)*size,b[2]*size))/2,line:[A,B,w*r.view.scale*size,c]});
   };
   for(const s of [-1,1]){
    const phase=t*3.7+(s===1?Math.PI:0),stride=Math.sin(phase)*7*this.walk,lift=Math.max(0,Math.cos(phase))*4*this.walk;
    const hip=[tilt+lunge*.3,s*8,45],knee=[3+stride*.5,s*11,23+lift],foot=[6+stride,s*12,5+lift];
    limb(hip,knee,8,dark);limb(knee,foot,7,dark);block(knee[0],knee[1],knee[2]-6,10,9,13,armor);block(foot[0],foot[1],foot[2],15,10,9,armor);
    Q([[hip[0]-5,s*7,43],[hip[0]+7,s*7,43],[hip[0]+10,s*12,34],[hip[0]-7,s*12,34]],armor);
    limb([knee[0]+3,knee[1],knee[2]+3],[foot[0]+5,foot[1],foot[2]+7],2,trim);
   }
   block(tilt+lunge*.3,0,40,14,17,8,dark);
   block(tilt+lunge*.5,0,48,20,25,19,armor);
   Q([[14+lunge*.5,-13,66],[15+lunge*.5,13,66],[9+lunge*.5,10,47],[9+lunge*.5,-10,47]],dark);
   for(const s of [-1,1]){
    let sh=[lunge*.5,s*18,64],el=[lunge*.5+2,s*23,49],hand=[7,s*24,36];
    if(pose==='attack'&&s===1){const hit=Math.sin(Math.PI*u);el=[8+hit*17,s*(22-hit*5),52+hit*8];hand=[12+hit*38,s*(24-hit*16),40+hit*23];}
    if(pose==='guard'||pose==='charge'){el=[13,s*18,50];hand=[21,s*8,64];}
    if(pose==='cast'){el=[18,s*20,56];hand=[29,s*13,63];}
    limb(sh,el,7,dark);limb(el,hand,7,armor);
    block(sh[0],sh[1],sh[2]-4,19,13,12,armor);
    block(hand[0],hand[1],hand[2]-4,10,9,9,dark);
    Q([[sh[0]-8,sh[1]-s*3,68],[sh[0]+9,sh[1]-s*3,68],[sh[0]+5,sh[1]+s*12,59],[sh[0]-10,sh[1]+s*12,61]],shade);
    limb([el[0]+2,el[1],el[2]],[hand[0]+2,hand[1],hand[2]],2,trim);
    if(cantor)Q([[-7,s*17,62],[-14,s*27,88],[-19,s*35,53],[-10,s*18,37]],shade);
   }
   block(lunge*.4+3,0,68,7,9,5,dark);block(lunge*.4+5,0,73,11,11,12,armor);
   Q([[12+lunge*.4,-5,79],[12+lunge*.4,5,79],[13+lunge*.4,4,76],[13+lunge*.4,-4,76]],glow);
   Q([[7,-5,85],[11,0,97],[7,5,85]],trim);
   if(cantor){Q([[-8,-16,52],[-21,-36,20],[-10,-18,11],[4,-7,48]],'#776b7c');Q([[-8,16,52],[-21,36,20],[-10,18,11],[4,7,48]],'#625e72');}
   parts.sort((a,b)=>a.d-b.d);
   for(const p of parts){if(p.line)line(g,p.line[0],p.line[1],p.line[3],p.line[2]);else poly(g,p.p,p.c);}
   // A split mechanical halo and an exposed light core are the two machine motifs.
   for(let i=0;i<29;i++){if(i===7||i===8||i===20)continue;let a=i/28*Math.PI*2,b=(i+1)/28*Math.PI*2;line(g,S(-7,Math.cos(a)*19,80+Math.sin(a)*19),S(-7,Math.cos(b)*19,80+Math.sin(b)*19),trim,Math.max(1,2*r.view.scale*size));}
   const core=S(15+lunge*.5,0,58),R=r.view.scale*size*4.8;
   px.disc(g,core[0],core[1],R+2,dark);px.disc(g,core[0],core[1],R,glow);px.disc(g,core[0]-1,core[1]-1,R*.42,'#fff1c7');r.glowDisc(g,core[0],core[1],R*4,glow,.14+(pose==='cast'?.14:0));
   const eye=S(13+lunge*.4,0,78);r.glowDisc(g,eye[0],eye[1],R*2,glow,.09);
  },{hides:true});
 }
}
A.Mech=Mech;
A.drawDrone=function(r,u){
 r.shadow(u.x,u.y,9,.3);
 r.queue(u.x,u.y,22,g=>{
  const p=r.w(u.x,u.y,27+Math.sin(r.game.time*3)*2),sc=r.view.scale;
  px.ell(g,p[0],p[1],11*sc,5*sc,u.hurt>0?'#f4dac0':'#91a6a1');
  poly(g,[[p[0]-14*sc,p[1]],[p[0]-23*sc,p[1]-9*sc],[p[0]-18*sc,p[1]+7*sc]],'#64858a');
  poly(g,[[p[0]+14*sc,p[1]],[p[0]+23*sc,p[1]-9*sc],[p[0]+18*sc,p[1]+7*sc]],'#9ead9c');
  px.disc(g,p[0],p[1],3*sc,'#f2b17c');r.glowDisc(g,p[0],p[1],13*sc,'#e8a376',.12);
  px.rect(g,p[0]-7*sc,p[1]+2*sc,14*sc,2*sc,'#425e68');
 });
};
A.drawBattleFloor=function(r,kind,t){
 A.drawBackdrop(r,kind==='gear'?'causeway':'hall',t,kind==='gear');
 const room={gaps:[]};cachedPlatform(r,r.ctx,[-130,-90,190,125],room);
 for(let z=0;z<2;z++)gearCircle(r,r.ctx,25,17,.4,60+z*15,z?'#66817d':'#c0a372',64);
 for(const s of [-1,1]){column(r,-119,s*88,40,true);column(r,173,s*88,48,true);}
 pipe(r,-115,-81,170,-81,5);
 if(kind==='gear'){
  r.overlay(g=>{for(let i=0;i<18;i++){const x=(i*53+t*5)%r.bw,y=(i*29+t*2)%r.bh;px.blend(g,.25,'source-over',()=>px.dot(g,x,y,'#eed6b1'));}});
 }
};
})(window);
