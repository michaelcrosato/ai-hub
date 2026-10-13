import {W,H,TILE,MAP,SITES,GOODS,ENGINES,elevation,riverY,clamp} from './sim.js';
const E=globalThis.My3D2dge;
const mix=(a,b,t)=>E.mix(a,b,t);
const rand=(x,y)=>{let n=Math.sin(x*43.112+y*13.67)*9143.46;return n-Math.floor(n)};
export class ValleyWorld {
 constructor(game,getState){this.game=game;this.getState=getState;this.camera={x:W*TILE/2,y:H*TILE/2,zoom:1};this.zoom=1;this.hover=null;this.selected=null;this.quote=null;this.mode='inspect';this.overlay='normal';this.follow=null;this.time=0;this.reduced=false;this.hitSites=[];this.smoke=[];this.bursts=[];this.staticKey='';this.terrainCache=null;this.sceneCache=null;this.lastSmoke=0;this.detail=1;this.labelRects=[];this.screenScale=1;this.lastSize='';
 this.treeCache=new Map();this.trainApproaches=new WeakMap();this.objects=[];this.makeObjects();this.resize();
 }
 makeObjects(){
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=MAP[y][x],near=SITES.some(s=>Math.hypot(s.x-x,s.y-y)<2.15);if(t.water||near)continue;
  const n=rand(x,y);if((y<13&&n>.48)||(y>=13&&n>.88)){for(let k=0;k<(y<11?2:1);k++)this.objects.push({type:'tree',x:(x+.18+rand(x+k+70,y)*.63)*TILE,y:(y+.18+rand(x,y+k+40)*.63)*TILE,size:.75+rand(x+7,y+k)*.6,variant:Math.floor(n*5)});}
  else if(t.h>14&&n>.44)this.objects.push({type:'rock',x:(x+.4)*TILE,y:(y+.4)*TILE,size:.7+n});
 }
 for(const s of SITES){
  if(s.pop){const n=s.type==='port'?18:12;for(let i=0;i<n;i++){const angle=i*2.39996,rad=(.6+Math.sqrt(i)*.43)*TILE;let x=(s.x+.5)*TILE+Math.cos(angle)*rad,y=(s.y+.5)*TILE+Math.sin(angle)*rad;if(Math.abs(y/TILE-riverY(x/TILE))<1.3)continue;this.objects.push({type:'house',x,y,size:.75+rand(i,s.x)*.6,color:['#d7ceb3','#bdcab3','#c2c4ad','#cebd9a'][i%4],roof:['#945e49','#5c6d68','#aa7960','#52646a'][i%4],variant:i%5});}}
  if(s.type==='farm')for(let k=0;k<3;k++)this.objects.push({type:'field',x:(s.x-1.8+k*1.1)*TILE,y:(s.y-1.9)*TILE,size:1});
 }
 }
 resize(){const g=this.game,w=g.screen.W,h=g.screen.H,dpr=g.screen.dpr;this.screenScale=dpr;
 this.baseScale=Math.min(w/(TILE*(W+H)*.707+50),h/(TILE*(W+H)*.36+100))*.94;
 this.setView();this.staticKey='';
 }
 setView(){this.game.setView(new E.View('copperline','Valley view',45,32,this.baseScale*this.zoom,1));this.game.cam.smooth=.15;}
 setZoom(v){this.camera.zoom=clamp(v,.65,2.7);}
 reset(){this.camera={x:W*TILE/2,y:H*TILE/2,zoom:1};this.follow=null;}
 moveScreen(dx,dy){const v=this.game.view.toGround(dx*this.screenScale,dy*this.screenScale);if(v){this.camera.x-=v[0];this.camera.y-=v[1];this.follow=null;}}
 update(dt){this.time+=dt;const size=this.game.W+':'+this.game.H;if(size!==this.lastSize){this.lastSize=size;this.resize();}
 const target=this.camera.zoom,old=this.zoom;this.zoom=this.reduced?target:old+(target-old)*(1-Math.exp(-dt*9));if(Math.abs(this.zoom-old)>.00005)this.setView();
 const sim=this.getState();const moving=sim.month!==this.lastSimMonth;this.lastSimMonth=sim.month;if(this.follow){const t=sim.trains.find(t=>t.id===this.follow);if(t){const p=sim.position(t);this.camera.x=(p.x+.5)*TILE;this.camera.y=(p.y+.5)*TILE;}}
 this.camera.x=clamp(this.camera.x,0,W*TILE);this.camera.y=clamp(this.camera.y,0,H*TILE);this.game.focus(this.camera.x,this.camera.y,7);
 this.smoke=this.smoke.filter(p=>(p.life-=dt)>0);for(const p of this.smoke){p.z+=dt*7;p.x-=dt*3;p.y+=dt*1.3;p.r+=dt*2.1;}
 this.bursts=this.bursts.filter(p=>(p.life-=dt)>0);
 if(!this.reduced&&moving&&(this.lastSmoke+=dt)>.13){this.lastSmoke=0;for(const t of sim.trains){if(t.state==='running'&&!t.hold){const p=sim.position(t);this.smoke.push({x:(p.x+.5)*TILE,y:(p.y+.5)*TILE,z:p.z+14,r:1.5,life:2.3,full:2.3});}}}
 }
 pickup(clientX,clientY){const rc=this.game.screen.canvas.getBoundingClientRect(),px=(clientX-rc.left)*this.screenScale,py=(clientY-rc.top)*this.screenScale;
 for(const b of [...this.labelRects].reverse())if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h)return {type:'site',id:b.id};
 let closest=null,bd=28*this.screenScale;for(const s of this.getState().sites){const p=this.game.r.w((s.x+.5)*TILE,(s.y+.5)*TILE,MAP[s.y][s.x].h+5),d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){closest={type:'site',id:s.id};bd=d;}}
 for(const t of this.getState().trains){const pos=this.getState().position(t),p=this.game.r.w((pos.x+.5)*TILE,(pos.y+.5)*TILE,pos.z+6);if(Math.hypot(p[0]-px,p[1]-py)<18*this.screenScale)closest={type:'train',id:t.id};}
 return closest;
 }
 delivery(site,amount){const s=this.getState().site(site);if(s)this.bursts.push({x:(s.x+.5)*TILE,y:(s.y+.5)*TILE,z:MAP[s.y][s.x].h+20,life:2.8,amount});}
 poly(g,points,color,stroke=null,width=.5){if(!points.length)return;g.beginPath();g.moveTo(...points[0]);for(let i=1;i<points.length;i++)g.lineTo(...points[i]);g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
 path(g,points,color,width,dash=[]){if(points.length<2)return;g.beginPath();g.moveTo(...points[0]);for(let i=1;i<points.length;i++)g.lineTo(...points[i]);g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.setLineDash(dash);g.stroke();g.setLineDash([]);}
 box(g,r,x,y,z,wx,wy,h,top,side,light=null){const p=(a,b,c)=>r.w(a,b,c);const a=p(x-wx/2,y-wy/2,z),b=p(x+wx/2,y-wy/2,z),c=p(x+wx/2,y+wy/2,z),d=p(x-wx/2,y+wy/2,z),A=p(x-wx/2,y-wy/2,z+h),B=p(x+wx/2,y-wy/2,z+h),C=p(x+wx/2,y+wy/2,z+h),D=p(x-wx/2,y+wy/2,z+h);
 this.poly(g,[d,c,C,D],side);this.poly(g,[b,c,C,B],light||E.shade(side,-.17));this.poly(g,[A,B,C,D],top);
 }
 roof(g,r,x,y,z,wx,wy,h,color){const p=(a,b,c)=>r.w(a,b,c);this.poly(g,[p(x-wx/2,y-wy/2,z),p(x-wx/2,y+wy/2,z),p(x,y+wy/2,z+h),p(x,y-wy/2,z+h)],color);this.poly(g,[p(x+wx/2,y-wy/2,z),p(x+wx/2,y+wy/2,z),p(x,y+wy/2,z+h),p(x,y-wy/2,z+h)],E.shade(color,-.22));this.poly(g,[p(x-wx/2,y+wy/2,z),p(x+wx/2,y+wy/2,z),p(x,y+wy/2,z+h)],E.shade(color,.13));}
 shadow(g,r,x,y,z,wx=9,wy=5,alpha=.13){const p=r.w(x+5,y+5,z),sx=(r.view||this.game.view).scale;g.save();g.globalAlpha=alpha;g.fillStyle='#132e2c';g.beginPath();g.ellipse(p[0],p[1],wx*sx,wy*sx,0,0,Math.PI*2);g.fill();g.restore();}
 tree(g,r,o){const {x,y,size:s}=o,z=elevation(x/TILE,y/TILE),sc=(r.view||this.game.view).scale;this.shadow(g,r,x,y,z,6*s,2.3*s,.15);
 const pos=r.w(x,y,z),top=r.w(x,y,z+22*s);this.path(g,[pos,top],'#755c42',1.9*s*sc);
 for(let layer=0;layer<3;layer++){const zz=z+(5+layer*6)*s,rad=(8-layer*1.55)*s,tip=zz+(12-layer)*s;const a=r.w(x-rad,y,zz),b=r.w(x,y+rad,zz),c=r.w(x+rad,y,zz),d=r.w(x,y-rad,zz),t=r.w(x,y,tip);const col=['#3f725c','#487c60','#527f5f','#477969','#67896a'][o.variant||0];this.poly(g,[a,b,t],col);this.poly(g,[b,c,t],E.shade(col,-.2));this.poly(g,[c,d,t],E.shade(col,-.32));}
 }
 cachedTree(g,r,o){
 const size=Math.round(o.size*5)/5,key=size+':'+o.variant;let cached=this.treeCache.get(key);
 if(!cached){const scale=2.2,cv=document.createElement('canvas');cv.width=100;cv.height=135;const ctx=cv.getContext('2d'),view=new E.View('tree','Tree',45,32,scale,1),base=elevation(0,0);
  const local={view,w:(x,y,z)=>{const p=view.p(x,y,z-base);return[p[0]+50,p[1]+115]}};this.tree(ctx,local,{...o,x:0,y:0,size});cached={cv,scale};this.treeCache.set(key,cached);
 }
 const p=r.w(o.x,o.y,elevation(o.x/TILE,o.y/TILE)),ratio=this.game.view.scale/cached.scale;g.drawImage(cached.cv,p[0]-50*ratio,p[1]-115*ratio,100*ratio,135*ratio);
 }
 rock(g,r,o){const z=elevation(o.x/TILE,o.y/TILE),h=o.size*5,p=(dx,dy,dz)=>r.w(o.x+dx,o.y+dy,z+dz);this.poly(g,[p(-6,-3,0),p(1,-5,h),p(7,0,1),p(3,5,0),p(-5,5,0)],'#8c9990');this.poly(g,[p(1,-5,h),p(7,0,1),p(3,5,0),p(0,2,h*.8)],'#6c807a');}
 house(g,r,o){const x=o.x,y=o.y,z=elevation(x/TILE,y/TILE),s=o.size,wx=9*s,wy=11*s,h=(o.variant===0?12:7)*s;this.shadow(g,r,x,y,z,8*s,3*s);this.box(g,r,x,y,z,wx,wy,h,E.shade(o.color,.1),o.color);this.roof(g,r,x,y,z+h,wx+2,wy+2,5*s,o.roof);
 const p=(a,b,c)=>r.w(a,b,c),ss=this.game.view.scale;for(let i=-1;i<=1;i+=2){this.path(g,[p(x+i*wx*.26,y+wy/2+.1,z+h*.48),p(x+i*wx*.26,y+wy/2+.1,z+h*.75)],'#fff0be',1.6*s*ss);}this.box(g,r,x+wx*.22,y-wy*.15,z+h,1.8*s,2*s,5*s,'#bdab8e','#6d6760');
 }
 industrial(g,r,s){const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE,z=MAP[s.y][s.x].h;
 if(s.type==='forest'){
  this.house(g,r,{x:x-13,y:y-8,size:1.1,color:'#927550',roof:'#4d6256',variant:1});
  for(let row=0;row<3;row++)for(let k=0;k<4;k++){this.box(g,r,x+7+k*2,y-7+row*3,z+2,2.3,10,2,'#c18b50','#805b39');}
  this.box(g,r,x+8,y+9,z,3,3,10,'#a2a899','#8e7b5d');
 }else if(s.type==='sawmill'){
  this.box(g,r,x,y,z,25,16,10,'#d5bd8e','#ba9b73');this.roof(g,r,x,y,z+10,29,19,7,'#54756c');
  for(let k=0;k<5;k++)this.box(g,r,x-8+k*3.6,y+12,z,3,11,3,'#d7b683','#a98555');
  this.box(g,r,x+12,y-7,z,4,4,25,'#c3b393','#8a6b56');
 }else if(s.type==='farm'){
  this.house(g,r,{x:x-6,y:y,size:1.55,color:'#ad6250',roof:'#6e6a5f',variant:1});this.box(g,r,x+12,y-1,z,8,8,19,'#b8b9a2','#a5ad9a');this.roof(g,r,x+12,y-1,z+19,10,10,6,'#70847c');
 }else if(s.type==='mill'){
  this.box(g,r,x-10,y-8,z,13,17,19,'#d4c6a5','#c1b594');this.roof(g,r,x-10,y-8,z+19,16,20,7,'#897052');
  const center=r.w(x-16,y-1,z+14),rad=7*this.game.view.scale;g.strokeStyle='#5d6250';g.lineWidth=2*this.game.view.scale;g.beginPath();g.ellipse(center[0],center[1],rad*.7,rad,0,0,Math.PI*2);g.stroke();for(let i=0;i<8;i++){let a=i*Math.PI/4+(this.reduced?0:this.time*.4);this.path(g,[center,[center[0]+Math.cos(a)*rad*.7,center[1]+Math.sin(a)*rad]],'#796f50',this.game.view.scale);}
 }else if(s.type==='mine'){
  this.box(g,r,x,y,z,20,13,6,'#9e8d76','#6d7369');this.roof(g,r,x,y,z+6,23,15,6,'#716d58');this.box(g,r,x-12,y+3,z,3,3,23,'#b1a079','#8c7a5a');this.box(g,r,x-4,y+3,z,3,3,23,'#b1a079','#8c7a5a');this.box(g,r,x-8,y+3,z+22,14,5,3,'#bcaa7f','#8c7a5a');
  for(let k=0;k<6;k++)this.rock(g,r,{x:x+8+(k%3)*4,y:y+8+Math.floor(k/3)*4,size:1});
 }else if(s.type==='foundry'){
  this.box(g,r,x,y,z,24,17,13,'#c79c73','#9b725b');this.roof(g,r,x,y,z+13,27,19,6,'#567774');for(let k=0;k<2;k++){this.box(g,r,x-7+k*14,y-7,z,5,5,34,'#b99a75','#8a6754');this.box(g,r,x-7+k*14,y-7,z+33,6,6,2,'#826c56','#a38663');}
  const p=r.w(x+3,y+9,z+6);g.fillStyle='#edb566';g.beginPath();g.arc(p[0],p[1],3*this.game.view.scale,0,7);g.fill();
 }else if(s.type==='port'){
  this.box(g,r,x+12,y+7,z,33,16,2,'#bda982','#9b8a6c');this.house(g,r,{x:x+18,y:y+3,size:1.5,color:'#b3b9a6',roof:'#8a6651',variant:1});
  this.box(g,r,x+24,y+16,z,3,3,28,'#b7a777','#8f8c63');this.box(g,r,x+15,y+16,z+26,26,3,3,'#c4b078','#a39366');const p=(a,b,c)=>r.w(a,b,c);this.path(g,[p(x+4,y+16,z+28),p(x+4,y+16,z+10)],'#4c635c',this.game.view.scale);
 }
 }
 station(g,r,s){const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE,z=MAP[s.y][s.x].h+1.5;
 this.box(g,r,x,y+4,z,26,10,1.8,'#d8c8a8','#a39171');
 this.house(g,r,{x:x-7,y:y+9,size:.9,color:'#e3d4b2',roof:s.id==='cedar'?'#ae754e':'#456f6b',variant:1});
 this.box(g,r,x+6,y+5,z+6,13,7,1.2,'#486e67','#36554f');
 const p=(a,b,c)=>r.w(a,b,c);for(const dx of [1,11])this.path(g,[p(x+dx,y+5,z),p(x+dx,y+5,z+6)],'#ccb995',1.1*this.game.view.scale);
 const signal=p(x+13,y-2,z+7);this.path(g,[p(x+13,y-2,z),signal],'#425b54',1*this.game.view.scale);g.fillStyle='#e8ba65';g.beginPath();g.arc(...signal,1.7*this.game.view.scale,0,Math.PI*2);g.fill();
 if(s.service){this.box(g,r,x-15,y+12,z,4,4,11,'#829b8e','#638074');this.box(g,r,x-15,y+12,z+9,7,7,5,'#a4b09a','#7e9a8a');}
 }
 cacheTerrain(){const scale=1.8,v=new E.View('cache','Cache',45,32,scale,1),corners=[[0,0],[W*TILE,0],[W*TILE,H*TILE],[0,H*TILE]].map(p=>v.p(...p)),minX=Math.min(...corners.map(p=>p[0]))-50,maxX=Math.max(...corners.map(p=>p[0]))+50,minY=-140,maxY=Math.max(...corners.map(p=>p[1]))+70;
 const cv=document.createElement('canvas');cv.width=Math.ceil(maxX-minX);cv.height=Math.ceil(maxY-minY);const g=cv.getContext('2d');const r={w:(x,y,z=0)=>{const p=v.p(x,y,z);return[p[0]-minX,p[1]-minY]}};
 // The cut earth makes the map read as a physical miniature.
 for(let x=0;x<W;x++){const y=H,a=r.w(x*TILE,y*TILE,elevation(x,y)),b=r.w((x+1)*TILE,y*TILE,elevation(x+1,y)),c=r.w((x+1)*TILE,y*TILE,-17),d=r.w(x*TILE,y*TILE,-17);this.poly(g,[a,b,c,d],x%4===0?'#5f6953':'#697458');}
 for(let y=0;y<H;y++){const x=W,a=r.w(x*TILE,y*TILE,elevation(x,y)),b=r.w(x*TILE,(y+1)*TILE,elevation(x,y+1)),c=r.w(x*TILE,(y+1)*TILE,-17),d=r.w(x*TILE,y*TILE,-17);this.poly(g,[a,b,c,d],y%4===0?'#455e54':'#4e6658');}
 for(let sum=0;sum<W+H;sum++)for(let y=0;y<H;y++){const x=sum-y;if(x<0||x>=W)continue;const t=MAP[y][x];const h=(a,b)=>{const v=elevation(a,b);return Math.abs(b-riverY(a))<.9?0:v};const p=[r.w(x*TILE,y*TILE,h(x,y)),r.w((x+1)*TILE,y*TILE,h(x+1,y)),r.w((x+1)*TILE,(y+1)*TILE,h(x+1,y+1)),r.w(x*TILE,(y+1)*TILE,h(x,y+1))];
  let color=t.water?mix('#3b8680','#57a397',t.noise*.6):t.h>18?mix('#9ea99a','#b4b7a2',t.noise):mix('#7f9d70','#9bb17b',t.noise*.7);if(!t.water&&y>19)color=mix('#9caa73','#b4b784',t.noise*.6);
  this.poly(g,p,color,color,.5);
  if(t.water){for(let k=0;k<2;k++){const xx=(x+.15+rand(k+x,y)*.7)*TILE,yy=(y+.2+rand(x,k+y)*.6)*TILE;this.path(g,[r.w(xx,yy,.2),r.w(xx+4,yy,.2)],'#72b5a6',.7);}}
  if(!t.water&&t.h>15&&t.noise>.5)this.path(g,[p[1],p[2]],'#8c9d8a',.6);
 }
 // Farm parcels and dirt roads are part of the terrain, not floating UI.
 for(const s of SITES){const z=MAP[s.y][s.x].h+.15;
  if(s.type==='farm'){for(let k=0;k<3;k++){const x=(s.x-2+k*1.5)*TILE,y=(s.y-2)*TILE;const poly=[r.w(x,y,z),r.w(x+19,y,z),r.w(x+19,y+22,z),r.w(x,y+22,z)];this.poly(g,poly,k%2?'#bfab66':'#c9b779');for(let j=1;j<8;j++)this.path(g,[r.w(x+j*2.3,y,z+.1),r.w(x+j*2.3,y+22,z+.1)],'#ad995c',1);}}
  if(s.pop){const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE;this.path(g,[r.w(x-34,y,z),r.w(x+30,y,z)],'#b9b38e',4*scale);this.path(g,[r.w(x,y-30,z),r.w(x,y+29,z)],'#b9b38e',4*scale);}
 }
 this.terrainCache={cv,scale,minX,minY};
 }
 drawRail(g,r,route,ghost=false){const s=this.game.view.scale,pts=route.path.map(p=>r.w((p.x+.5)*TILE,(p.y+.5)*TILE,p.z+1.8));
 if(ghost){this.path(g,pts,'#fbd596',3*s,[5*s,3*s]);this.path(g,pts,'rgba(255,218,153,.18)',10*s);return;}
 this.path(g,pts,'#777c67',(route.double?15:7)*s);this.path(g,pts,'#acaa91',(route.double?13:5.2)*s);
 for(let i=1;i<route.path.length;i++){const a=route.path[i-1],b=route.path[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),nx=-dy/d,ny=dx/d;
  for(let k=0;k<4;k++){let f=k/4,x=(a.x+.5+dx*f)*TILE,y=(a.y+.5+dy*f)*TILE,z=a.z+(b.z-a.z)*f+2;for(const offset of (route.double?[-4.5,4.5]:[0]))this.path(g,[r.w(x+nx*(offset+4),y+ny*(offset+4),z),r.w(x+nx*(offset-4),y+ny*(offset-4),z)],'#766952',1.2*s);}
 }
 for(const off of (route.double?[-6.8,-2.2,2.2,6.8]:[-2.3,2.3])){const rail=route.path.map((p,i)=>{const a=route.path[Math.max(0,i-1)],b=route.path[Math.min(route.path.length-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;return r.w((p.x+.5)*TILE-(b.y-a.y)/d*off,(p.y+.5)*TILE+(b.x-a.x)/d*off,p.z+2.4)});this.path(g,rail,'#41554f',1.5*s);this.path(g,rail.map(p=>[p[0],p[1]-.55*s]),'#dbd8bd',.65*s);}
 
 for(const p of route.path.filter(p=>p.water)){r.queue((p.x+.5)*TILE,(p.y+.5)*TILE,p.z,g=>this.bridge(g,r,p));}
 }
 bridge(g,r,p){const x=(p.x+.5)*TILE,y=(p.y+.5)*TILE,z=p.z+1.3,s=this.game.view.scale;for(const d of [-4,4]){this.box(g,r,x+d,y,0,2.3,2.3,z+1,'#b4a279','#8a8062');}this.path(g,[r.w(x-6,y,z+2),r.w(x-6,y,z+8)],'#bdaf87',s);this.path(g,[r.w(x+6,y,z+2),r.w(x+6,y,z+8)],'#bdaf87',s);}
 trainBody(g,r,t,pos,car=0){const e=ENGINES[t.engine],angle=pos.angle,x=(pos.x+.5)*TILE,y=(pos.y+.5)*TILE,z=pos.z+3,co=Math.cos(angle),si=Math.sin(angle),p=(f,side,up)=>r.w(x+co*f-si*side,y+si*f+co*side,z+up),s=this.game.view.scale;
 const box=(f0,f1,w,h,col)=>{const A=p(f0,-w,1),B=p(f1,-w,1),C=p(f1,w,1),D=p(f0,w,1),a=p(f0,-w,h),b=p(f1,-w,h),c=p(f1,w,h),d=p(f0,w,h);this.poly(g,[D,C,c,d],E.shade(col,-.18));this.poly(g,[B,C,c,b],E.shade(col,-.32));this.poly(g,[A,B,b,a],E.shade(col,-.08));this.poly(g,[a,b,c,d],E.shade(col,.16));};
 this.shadow(g,r,x,y,z-2,6,2,.22);
 for(const f of [-4,0,4])for(const side of [-3.5,3.5]){const q=p(f,side,1.4);g.fillStyle='#263d38';g.beginPath();g.ellipse(q[0],q[1],1.7*s,2*s,0,0,7);g.fill();if(!car){g.strokeStyle='#b3b4a0';g.lineWidth=.55*s;g.stroke();const a=this.reduced?0:t.progress*20;this.path(g,[q,[q[0]+Math.cos(a)*1.2*s,q[1]+Math.sin(a)*1.2*s]],'#d2bd89',.45*s);}}
 box(-6,6,3.3,3,'#344d47');
 if(car){const cargo=t.load.flatMap(l=>Array(l.amount).fill(l.cargo))[car-1]||'empty';
  if(cargo==='passengers'||cargo==='mail'){box(-5.5,5.5,3.1,7.7,cargo==='passengers'?'#ad8050':'#607f82');for(const f of [-3,0,3])for(const side of [-3.2,3.2]){this.path(g,[p(f,side,4.8),p(f,side,6.6)],'#ffedb6',1.5*s);}box(-5.8,5.8,3.5,8.3,'#405a53');}
  else if(cargo==='logs'){box(-5.5,5.5,3.1,4,'#996d47');for(const side of [-2,0,2]){this.path(g,[p(-5,side,5),p(5,side,5)],'#d1a16b',1.7*s);}}
  else{box(-5.5,5.5,3.1,5.5,cargo==='empty'?'#8c8265':(GOODS[cargo]?.color||'#ac8960'));if(cargo!=='empty')box(-4.8,4.8,2.4,6.2,E.shade(GOODS[cargo]?.color||'#ab8560',-.15));}
 }else{
  box(-5,-.8,3.3,9,e.color);box(-5.5,-.4,3.7,9.8,'#365149');
  for(const side of [-3.4,3.4])this.path(g,[p(-3,side,5.3),p(-3,side,7.8)],'#ffe7ab',1.8*s);
  box(-.5,5.8,2.9,7.2,'#36534c');this.path(g,[p(.3,-3,7.4),p(5,-3,7.4)],'#d9a764',s);
  box(3,4.7,1.3,11,'#455c51');box(.1,1.9,1.3,8.8,'#cf9a55');
  const head=p(6,0,5);g.fillStyle='#ffe7aa';g.beginPath();g.arc(...head,1.7*s,0,7);g.fill();this.poly(g,[p(6,-4,1),p(9,0,.7),p(6,4,1)],'#6e7358');
 }
 }
 sampleTrain(t,d){
 const sim=this.getState(),progress=t.progress-d;
 if(progress>=0)return sim.position({...t,progress});
 const origin=sim.position({...t,progress:0}),journey=t.journey;
 let approach=journey&&this.trainApproaches.get(journey);
 if(journey&&!approach){
  const previous=t.stops[(t.stopIndex+t.stops.length-1)%t.stops.length],current=t.stops[t.stopIndex],path=sim.networkPath(previous,current);
  const incoming=path&&sim.position({...t,journey:path,progress:Math.max(0,path.length-.01)});
  // Keep the incoming track for through service. A reversing consist needs a
  // separate approach behind the departing engine, or its cars fold together.
  approach={path:incoming&&Math.cos(incoming.angle-origin.angle)>=-.05?path:null};
  this.trainApproaches.set(journey,approach);
 }
 if(approach?.path&&-progress<=approach.path.length)return sim.position({...t,journey:approach.path,progress:approach.path.length+progress});
 // A short virtual station approach also gives a newly bought train full length.
 const x=origin.x+Math.cos(origin.angle)*progress,y=origin.y+Math.sin(origin.angle)*progress;
 return {...origin,x,y,z:Math.max(1.2,elevation(x+.5,y+.5))};
 }
 draw(r){const g=r.ctx;g.imageSmoothingEnabled=true;const sim=this.getState(),dpr=this.screenScale,v=r.view;
 g.fillStyle='#c4d6cd';g.fillRect(0,0,r.W,r.H);
 // A soft contact shadow under the miniature.
 const mid=r.w(W*TILE/2,H*TILE/2,-20);g.save();g.globalAlpha=.18;g.fillStyle='#39534c';g.beginPath();g.ellipse(mid[0]+8*dpr,mid[1]+15*dpr,250*this.zoom*dpr,106*this.zoom*dpr,0,0,7);g.fill();g.restore();
 if(!this.terrainCache)this.cacheTerrain();const c=this.terrainCache,ratio=v.scale/c.scale;g.drawImage(c.cv,c.minX*ratio-r.ix,c.minY*ratio-r.iy,c.cv.width*ratio,c.cv.height*ratio);
 if(this.overlay==='terrain'){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=MAP[y][x],p=r.w((x+.5)*TILE,(y+.5)*TILE,t.h+.2);g.fillStyle=t.water?'rgba(130,216,239,.38)':t.h>12?'rgba(220,99,69,.24)':'rgba(200,224,165,.08)';g.beginPath();g.ellipse(p[0],p[1],6*v.scale,3*v.scale,0,0,7);g.fill();}}
 const railCells=sim.routeCells();for(const route of sim.routes)this.drawRail(g,r,route);
 for(const o of this.objects){if(o.type==='field'||railCells.has(Math.floor(o.x/TILE)+','+Math.floor(o.y/TILE)))continue;const p=r.w(o.x,o.y,elevation(o.x/TILE,o.y/TILE));if(p[0]<-60*dpr||p[0]>r.W+60*dpr||p[1]<-60*dpr||p[1]>r.H+80*dpr)continue;r.queue(o.x,o.y,0,g=>{if(o.type==='tree')this.cachedTree(g,r,o);else if(o.type==='house')this.house(g,r,o);else this.rock(g,r,o);});}
 for(const s of sim.sites){const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE,z=MAP[s.y][s.x].h;
  if(this.selected===s.id||this.hover===s.id||this.mode==='build'){const col=this.selected===s.id?'#f3c37a':this.hover===s.id?'#fff2cc':'#c3dac1';g.save();g.globalAlpha=this.selected===s.id?.65:.25;this.path(g,Array.from({length:41},(_,i)=>{const a=i/40*Math.PI*2;return r.w(x+Math.cos(a)*24,y+Math.sin(a)*24,z+.6)}),col,1.5*dpr);g.restore();}
  r.queue(x,y-5,z,g=>this.industrial(g,r,s));if(s.station)r.queue(x,y+9,z,g=>this.station(g,r,s));
 }
 if(this.quote)this.drawRail(g,r,this.quote,true);
 for(const t of sim.trains){const p=sim.position(t),cars=t.cars;for(let i=cars;i>=0;i--){const pos=i?this.sampleTrain(t,i*.9):{...p};const route=sim.routes.find(r=>r.id===pos.routeId);if(route?.double){pos.x-=Math.sin(pos.angle)*.28;pos.y+=Math.cos(pos.angle)*.28;}r.queue((pos.x+.5)*TILE,(pos.y+.5)*TILE,pos.z,g=>this.trainBody(g,r,t,pos,i),{bias:2});}}
 for(const s of this.smoke)r.queue(s.x,s.y,s.z,g=>{const p=r.w(s.x,s.y,s.z);g.save();g.globalAlpha=clamp(s.life/s.full,0,1)*.35;g.fillStyle='#eff0db';g.beginPath();g.ellipse(p[0],p[1],s.r*v.scale,s.r*.8*v.scale,0,0,7);g.fill();g.restore();},{bias:5});
 if(!this.externalLabels)r.overlay(g=>this.drawLabels(g,r,sim));
 r.overlay(g=>{for(const b of this.bursts){const p=r.w(b.x,b.y,b.z+(2.8-b.life)*8);g.save();g.globalAlpha=Math.min(1,b.life);g.font='600 '+14*dpr+'px Arial';g.textAlign='center';g.fillStyle='#184d3d';g.fillText('+$'+b.amount.toFixed(1)+'k',p[0],p[1]);g.restore();}});
 if(!this.reduced){const a=this.time*.12;g.save();g.globalAlpha=.06;g.fillStyle='#fff9e5';for(let i=0;i<3;i++){const x=((a*25+i*r.W*.42)%(r.W+300*dpr))-150*dpr,y=r.H*(.15+i*.24);g.beginPath();g.ellipse(x,y,90*dpr,26*dpr,-.25,0,7);g.fill();}g.restore();}
 }
 drawLabels(g,r,sim){const dpr=this.screenScale;this.labelRects=[];g.textAlign='center';
 for(const s of sim.sites){const p=r.w((s.x+.5)*TILE,(s.y+.5)*TILE,MAP[s.y][s.x].h),selected=this.selected===s.id,hover=this.hover===s.id;
 const font=(selected?600:500)+' '+12*dpr+'px Arial';g.font=font;const name=s.name,width=g.measureText(name).width+24*dpr,x=p[0]-width/2,y=p[1]+23*dpr,h=24*dpr;
 if(x<-width||x>r.W||y<-h||y>r.H)continue;
 g.save();g.fillStyle=selected?'#eec98b':hover?'#355b50':'rgba(25,55,47,.88)';g.beginPath();g.roundRect(x,y,width,h,4*dpr);g.fill();g.fillStyle=selected?'#294438':'#f6f2db';g.fillText(name,p[0],y+16*dpr);
 const dotX=x+7*dpr,dotY=y+12*dpr;g.fillStyle=s.station?'#97bf88':'#b3bda7';g.beginPath();g.arc(dotX,dotY,2*dpr,0,7);g.fill();
 if(this.overlay==='cargo'||this.mode==='build'){const goods=Object.keys(s.produces).filter(k=>s.produces[k]>0);if(s.process)goods.push(s.process.output);const text=goods.map(k=>GOODS[k].short+' '+Math.floor(s.stock[k])).join(' · ');if(text){g.font='600 '+10*dpr+'px Arial';g.fillStyle='#284f43';g.fillText(text,p[0],y+h+12*dpr);}}
 g.restore();this.labelRects.push({id:s.id,x,y,w:width,h});
 }
 }
 drawMinimap(canvas){const ctx=canvas.getContext('2d'),cw=canvas.width,ch=canvas.height,sx=cw/W,sy=ch/H;ctx.fillStyle='#72937a';ctx.fillRect(0,0,cw,ch);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=MAP[y][x];ctx.fillStyle=t.water?'#74b9ae':t.h>16?'#bcc3a5':t.forest?'#4a7661':'#91a77b';ctx.fillRect(x*sx,y*sy,sx+.5,sy+.5);}
 for(const r of this.getState().routes){ctx.strokeStyle='#e3c895';ctx.lineWidth=1.5;ctx.beginPath();r.path.forEach((p,i)=>i?ctx.lineTo(p.x*sx,p.y*sy):ctx.moveTo(p.x*sx,p.y*sy));ctx.stroke();}for(const s of this.getState().sites){ctx.fillStyle=s.station?'#ffe3a9':'#294d40';ctx.fillRect(s.x*sx-2,s.y*sy-2,4,4);}ctx.strokeStyle='#fff7d8';ctx.lineWidth=1;ctx.strokeRect(this.camera.x/TILE*sx-17,this.camera.y/TILE*sy-12,34,24);
 }
}
