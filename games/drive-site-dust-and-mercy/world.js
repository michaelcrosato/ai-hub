/* Dust & Mercy: authored level and cached, world-space terrain. Original game art. */
(function(root){
'use strict';
const E=My3D2dge, px=E.px;
const W=2400,H=1800;
const P={camp:{x:330,y:1440},doctor:{x:310,y:1402},horse:{x:399,y:1460},worker:{x:803,y:1175},depot:{x:1840,y:755},clerk:{x:1840,y:807},medicine:{x:1890,y:537},rear:{x:1650,y:470},broker:{x:1370,y:1055},bell:{x:2040,y:430}};
const ROAD=[[150,1540],[330,1480],[555,1410],[720,1270],[925,1100],[1200,990],[1460,900],[1695,845],[1840,768],[1850,630],[2100,640],[2300,660]];
const CREEK=[[300,-90],[495,250],[680,465],[870,690],[950,920],[1050,1130],[1090,1350],[1280,1580],[1440,1890]];
const REAR_PATH=[[1195,990],[1300,800],[1480,710],[1560,535],[1650,470],[1780,510],[1890,537]];
const RIDGE_PATH=[[1460,900],[1590,1060],[1980,955],[2160,800],[2140,550]];
function segdist(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=E.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
function pathDist(x,y,path){let d=1e9;for(let i=1;i<path.length;i++)d=Math.min(d,segdist(x,y,path[i-1],path[i]));return d;}
function pointIn(x,y,b,pad=0){return x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad;}
function segmentRect(ax,ay,bx,by,box,pad=0){let t0=0,t1=1;const dx=bx-ax,dy=by-ay;const p=[-dx,dx,-dy,dy],q=[ax-box.x+pad,box.x+box.w+pad-ax,ay-box.y+pad,box.y+box.h+pad-ay];for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-9){if(q[i]<0)return null;}else{const t=q[i]/p[i];if(p[i]<0){if(t>t1)return null;t0=Math.max(t0,t);}else{if(t<t0)return null;t1=Math.min(t1,t);}}}return t0;}
class FrontierWorld{
constructor(view){
 this.view=view;this.props=[];this.solids=[];this.buildings=[];this.groundCache=null;this.rearOpen=false;
 this.grassZones=[{x:1550,y:380,w:130,h:310},{x:1710,y:405,w:88,h:118},{x:1295,y:725,w:150,h:115},{x:1940,y:860,w:160,h:100}];
 this.regions=[{name:"CALDER'S REST",sub:'THE RELIEF CAMP',x:330,y:1440,r:270},{name:'THE BROKEN CROSSING',sub:'BITTER CREEK',x:890,y:1135,r:260},{name:'COTTONWOOD RIDGE',sub:'THE OLD PACK TRAIL',x:1340,y:835,r:270},{name:'CINDER SPUR',sub:'CONSOLIDATED FREIGHT COMPANY',x:1860,y:630,r:355}];
 this.makeLevel();this.makeNature();
}
prop(type,x,y,o={}){const p={type,x,y,seed:Math.floor(E.hash2(x,y)*99999),...o};this.props.push(p);if(o.solid){const rad=o.radius||10;this.solids.push({x:x-rad,y:y-rad,w:rad*2,h:rad*2,z:o.solid===true?26:o.solid,type});}return p;}
solid(x,y,w,h,z=40,type='wall',id){this.solids.push({x,y,w,h,z,type,id});}
building(x,y,w,h,z,name,o={}){this.buildings.push({x,y,w,h,z,name,...o});this.solid(x,y,w,h,z,'building');}
makeLevel(){
 // Calder's Rest: a crescent of canvas, timber, and a shared fire.
 this.prop('tent',248,1380,{size:1.55,color:'#d3c09b',solid:true,radius:25});
 this.prop('tent',373,1348,{size:1.4,color:'#bdaf8e',solid:true,radius:24});
 this.prop('tent',225,1508,{size:1.3,color:'#9c9d87',solid:true,radius:22});
 this.prop('tent',442,1386,{size:1.2,color:'#b9a478',solid:true,radius:20});
 this.prop('wagon',485,1505,{size:1.4,solid:19,radius:23,facing:0});
 this.prop('campfire',327,1475,{size:1.4});
 this.prop('crate',274,1410,{size:1.3,solid:12,radius:9});
 this.prop('crate',286,1370,{size:1.15,solid:12,radius:8});
 this.prop('sign',524,1395,{label:'CINDER SPUR',size:1.15});
 for(let i=0;i<5;i++)this.prop('fence',380+i*25,1535,{size:1});
 this.prop('pole',480,1415,{size:.85});
 // Trail rescue, abandoned pumping station, and a single useful supply stop.
 this.prop('wagon',786,1137,{size:1.3,facing:.8,broken:true,solid:20,radius:22});
 this.prop('crate',830,1148,{size:1.2});
 this.prop('sign',1135,1027,{label:'SPUR / CREEK',size:1.1});
 this.building(1160,1085,62,44,40,'OLD PUMP',{color:'#827353',ruin:true});
 this.prop('wagon',1402,1060,{size:1.1,solid:19,radius:20});
 this.prop('campfire',1348,1077,{size:.7});
 // The depot has a public forecourt, low cover, a freight platform, and a rear cut.
 this.building(1770,362,224,120,62,'CINDER SPUR',{color:'#9f8259',roof:'#69513b',depot:true});
 this.building(2008,540,112,82,45,'FREIGHT OFFICE',{color:'#9e8c64',roof:'#674e3c'});
 this.building(1728,658,63,68,37,'STORES',{color:'#918366',roof:'#776348'});
 this.prop('waterTower',2070,290,{size:1.7,solid:60,radius:25});
 this.prop('train',1840,246,{size:1.8});
 this.prop('train',2028,246,{size:1.4,wagon:true});
 this.prop('wagon',1970,710,{size:1.35,solid:20,radius:24});
 this.prop('wagon',2150,417,{size:1.2,solid:20,radius:22});
 for(const [x,y,size] of [[1773,592,1.7],[1840,650,1.55],[1940,611,1.7],[2022,713,1.5],[1740,506,1.35],[1710,611,1.4],[1968,520,1.3],[1890,570,1.15],[2008,399,1.4]])this.prop('crate',x,y,{size,solid:15,radius:10*size});
 this.prop('sign',1839,842,{label:'CINDER SPUR',size:1.3});
 this.prop('pole',2040,430,{size:1.2,bell:true});
 // Fences are physical. Both authored entrance gaps remain accessible.
 for(let x=1660;x<2120;x+=26){if(x>1790&&x<1885)continue;this.prop('fence',x,770);this.solid(x-12,768,24,4,15,'fence');}
 for(let y=325;y<770;y+=26){if(y>423&&y<515)continue;this.prop('fence',1650,y,{facing:Math.PI/2});this.solid(1648,y-12,4,24,18,'fence');}
 for(let y=340;y<765;y+=26){if(y>627&&y<699)continue;this.prop('fence',2138,y,{facing:Math.PI/2});this.solid(2136,y-12,4,24,18,'fence');}
 for(let x=1700;x<2300;x+=115)this.prop('pole',x,297,{size:1.1});
 for(let i=0;i<11;i++)this.prop('pole',575+i*128,1420-i*76,{size:1});
 // Planted trees act as landmarks and shade the main approach.
 for(const [x,y,s] of [[185,1370,1.7],[429,1266,1.4],[527,1510,1.55],[640,1240,1.2],[1080,1020,1.55],[1320,890,1.8],[1560,700,1.4],[2090,884,1.5],[1608,414,1.65]])this.prop('tree',x,y,{size:s,color:'#647048',solid:35,radius:7*s});
}
makeNature(){
 const rand=E.rng(18871017);
 for(let i=0;i<2050;i++){
  const x=55+rand()*(W-110),y=55+rand()*(H-110),n=E.noise2(x/190,y/190),road=pathDist(x,y,ROAD),creek=pathDist(x,y,CREEK);
  if(road<37||creek<35||Math.hypot(x-330,y-1440)<175||pointIn(x,y,{x:1635,y:230,w:545,h:555},22)||this.buildings.some(b=>pointIn(x,y,b,20)))continue;
  const v=rand();
  if(v<.065){const s=.7+rand()*1.0;this.prop('boulder',x,y,{size:s,solid:20,radius:10*s,color:'#a68056'});}
  else if(v<.098&&n>.4){const s=.9+rand()*.8;this.prop('tree',x,y,{size:s,color:creek<145?'#68774c':'#6c6e43',solid:35,radius:7*s});}
  else if(v<.137){this.prop('cactus',x,y,{size:.65+rand()*.75});}
  else this.prop('grass',x,y,{size:.6+rand()*.9,color:n>.48?'#919360':'#b6a366'});
 }
 // Ridge edges use groups of warm rock, with navigable channels between them.
 for(let i=0;i<36;i++){const y=100+i*43,x=2220+Math.sin(i*.5)*62;this.prop('boulder',x,y,{size:2.3+rand()*1.7,solid:40,radius:25});}
 for(let i=0;i<30;i++){const x=100+i*62,y=170+Math.sin(i*.7)*60;this.prop('boulder',x,y,{size:2+rand()*2,solid:38,radius:28});}
 for(const z of this.grassZones){for(let i=0;i<80;i++)this.prop('tallgrass',z.x+rand()*z.w,z.y+rand()*z.h,{size:.8+rand()*.7,color:'#85936b'});}
}
get width(){return W;}get height(){return H;}
isGrass(x,y){return this.grassZones.some(b=>pointIn(x,y,b));}
isWater(x,y){return pathDist(x,y,CREEK)<25&&pathDist(x,y,ROAD)>35;}
collide(body){
 let hit=false;const rr=body.r||6;body.x=E.clamp(body.x,40,W-40);body.y=E.clamp(body.y,70,H-50);
 for(const b of this.solids){if(body.x<b.x-rr||body.x>b.x+b.w+rr||body.y<b.y-rr||body.y>b.y+b.h+rr)continue;
  const qx=E.clamp(body.x,b.x,b.x+b.w),qy=E.clamp(body.y,b.y,b.y+b.h),dx=body.x-qx,dy=body.y-qy,d=Math.hypot(dx,dy);
  if(d>=rr)continue;hit=true;
  if(d>.0001){body.x+=dx/d*(rr-d);body.y+=dy/d*(rr-d);}
  else{const ds=[body.x-b.x,b.x+b.w-body.x,body.y-b.y,b.y+b.h-body.y],m=Math.min(...ds);if(ds[0]===m)body.x=b.x-rr;else if(ds[1]===m)body.x=b.x+b.w+rr;else if(ds[2]===m)body.y=b.y-rr;else body.y=b.y+b.h+rr;}
 }
 if(!this.rearOpen){const b={x:1645,y:425,w:10,h:91};if(pointIn(body.x,body.y,b,rr)){body.x=body.x<1650?1645-rr:1655+rr;hit=true;}}
 return hit;
}
groundAt(){return 0;}
ray(ax,ay,bx,by,height=20){let nearest=null;const boxes=this.rearOpen?this.solids:[...this.solids,{x:1645,y:425,w:10,h:91,z:23}];for(const b of boxes){if(b.z<height)continue;const t=segmentRect(ax,ay,bx,by,b,1);if(t!==null&&t>.015&&(nearest===null||t<nearest))nearest=t;}return nearest;}
cover(x,y){return this.solids.some(b=>b.z>=10&&b.z<25&&x>b.x-22&&x<b.x+b.w+22&&y>b.y-22&&y<b.y+b.h+22);}
bake(){
 const v=this.view, corners=[[0,0],[W,0],[0,H],[W,H]].map(p=>v.p(...p));
 const ox=Math.floor(Math.min(...corners.map(p=>p[0])))-90,oy=Math.floor(Math.min(...corners.map(p=>p[1])))-90,cw=Math.ceil(Math.max(...corners.map(p=>p[0]))-ox+90),ch=Math.ceil(Math.max(...corners.map(p=>p[1]))-oy+90);
 const cv=E.mkCanvas(cw,ch),g=E.ctx2d(cv),pp=(x,y,z=0)=>{const p=v.p(x,y,z);return[p[0]-ox,p[1]-oy];};
 px.rect(g,0,0,cw,ch,'#93845a');
 const tile=12;
 for(let y=-tile;y<H+tile;y+=tile)for(let x=-tile;x<W+tile;x+=tile){const n=E.noise2(x/140,y/140),fine=E.hash2(x,y),cr=pathDist(x,y,CREEK);let color=E.mix('#a88e60','#c4ad79',Math.round(n*30)/30);if(cr<95)color=E.mix('#7f8b61','#afb17b',Math.round(n*25)/25);px.poly(g,[pp(x,y),pp(x+tile+1,y),pp(x+tile+1,y+tile+1),pp(x,y+tile+1)],color);for(let j=0;j<8;j++){const xx=x+E.hash2(x+j*33,y)*tile,yy=y+E.hash2(y+j*15,x)*tile,p=pp(xx,yy);px.rect(g,p[0],p[1],1+(j%2),1,fine>.5?'#c4b181':'#978659');}}
 const polyPath=(path,width,col)=>{for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*width,ny=dx/l*width;px.poly(g,[pp(a[0]+nx,a[1]+ny),pp(b[0]+nx,b[1]+ny),pp(b[0]-nx,b[1]-ny),pp(a[0]-nx,a[1]-ny)],col);const p=pp(...a);px.ell(g,p[0],p[1],width*v.scale,width*v.scale*.78,col);}};
 polyPath(CREEK,39,'#a7986b');polyPath(CREEK,30,'#6b8979');polyPath(CREEK,22,'#78978a');polyPath(CREEK,10,'#8fa99a');
 polyPath(ROAD,35,'#b4a078');polyPath(ROAD,28,'#c3a97c');polyPath(ROAD,21,'#cdb183');
 polyPath(REAR_PATH,13,'#ad9a70');polyPath(RIDGE_PATH,12,'#b6a073');
 // Water ripples and worn wheel marks are fixed world marks, not screen noise.
 const rand=E.rng(83838);for(let i=0;i<1600;i++){const x=rand()*W,y=rand()*H,rd=pathDist(x,y,ROAD),cd=pathDist(x,y,CREEK),p=pp(x,y);if(cd<23&&rd>37)px.line(g,p[0],p[1],p[0]+3+rand()*7,p[1]-1,'#aec0a2');else if(rd<25){const c=rand()>.5?'#b0966a':'#d3b989';px.line(g,p[0],p[1],p[0]+4,p[1]-1,c);}}
 // Ground pads for camp and depot.
 const pad=(x,y,w,h,c)=>px.poly(g,[pp(x,y),pp(x+w,y),pp(x+w,y+h),pp(x,y+h)],c);
 pad(1662,327,468,420,'#ae956a');
 for(let i=0;i<480;i++){const x=1665+rand()*460,y=333+rand()*406,p=pp(x,y);px.rect(g,p[0],p[1],2,1,rand()>.5?'#bba47a':'#a08a61');}
 // Rail bed, sleepers and twin steel lines.
 pad(1550,226,830,44,'#857b61');for(let x=1550;x<2380;x+=13){const a=pp(x,226),b=pp(x,270);px.line(g,a[0],a[1],b[0],b[1],'#695f4b',3);}
 for(const y of[236,259]){const a=pp(1530,y),b=pp(2399,y);px.line(g,a[0],a[1],b[0],b[1],'#c2b8a0',2);const c=pp(1530,y+2),d=pp(2399,y+2);px.line(g,c[0],c[1],d[0],d[1],'#514f46');}
 // Timber loading apron in front of the depot.
 pad(1756,477,251,72,'#7c694b');for(let x=1756;x<2007;x+=8){const a=pp(x,477),b=pp(x,549);px.line(g,...a,...b,'#a18a61',5);}
 // A broad timber bridge crosses the ford on the marked road.
 pad(958,1058,136,63,'#826b4c');for(let x=958;x<1094;x+=7){const a=pp(x,1058),b=pp(x,1121);px.line(g,...a,...b,'#c0a16d',5);}
 this.groundCache={cv,ox,oy};
}
drawTerrain(r){if(!this.groundCache)this.bake();const {cv,ox,oy}=this.groundCache;r.ctx.drawImage(cv,Math.round(ox-r.ix),Math.round(oy-r.iy));px.reset(r.ctx);}
visible(r,x,y,pad=130){const s=r.w(x,y);return s[0]>-pad&&s[0]<r.W+pad&&s[1]>-pad&&s[1]<r.H+pad;}
draw(r,time){
 this.drawTerrain(r);
 for(const b of this.buildings)if(this.visible(r,b.x+b.w/2,b.y+b.h,250))this.drawBuilding(r,b);
 for(const p of this.props){if(!this.visible(r,p.x,p.y,140))continue;
  if(p.type==='grass'||p.type==='tallgrass')this.drawGrass(r,p,time);else if(root.FrontierArt)root.FrontierArt.drawProp(r,p,time);
 }
 if(!this.rearOpen&&this.visible(r,1650,470))r.queue(1650,470,0,g=>{for(let y=430;y<515;y+=18){const a=r.w(1650,y,0),b=r.w(1650,y,23);px.line(g,...a,...b,'#62563f',2);}for(const z of[6,14,22]){const a=r.w(1650,425,z),b=r.w(1650,515,z);px.line(g,...a,...b,'#b9b39b');}});
 // Slight moving highlights keep the creek alive without re-baking its bed.
 for(let i=0;i<12;i++){const k=i/(12-1)*(CREEK.length-1),j=Math.min(CREEK.length-2,Math.floor(k)),f=k-j,x=E.lerp(CREEK[j][0],CREEK[j+1][0],f),y=E.lerp(CREEK[j][1],CREEK[j+1][1],f);if(!this.visible(r,x,y,10)||pathDist(x,y,ROAD)<45)continue;const [sx,sy]=r.w(x+Math.sin(time*.5+i)*8,y);px.line(r.ctx,sx,sy,sx+9,sy,'#bdcbb066');}
}
drawGrass(r,p,time){const tall=p.type==='tallgrass',s=p.size||1,height=(tall?15:4)*s;const [sx,sy]=r.w(p.x,p.y),g=r.ctx;const draw=gg=>{const wind=Math.sin(time*1.35+p.x*.013+p.y*.006)*(tall?2:.7);for(let i=0;i<(tall?6:3);i++){const dx=(i-2)*2*s,hh=height*(.5+E.hash2(p.seed,i)*.5);px.line(gg,sx+dx,sy,sx+dx+wind+(i-2)*.9,sy-hh,p.color||'#879567');if(tall&&i%2===0)px.dot(gg,sx+dx+wind+(i-2)*.9,sy-hh,'#b9b381');}};if(tall)r.queue(p.x,p.y,0,draw);else draw(g);}
drawBuilding(r,b){
 const {x,y,w,h,z}=b,c=b.color||'#9e835a',roof=b.roof||'#685640';
 const p=(xx,yy,zz=0)=>r.w(xx,yy,zz);
 r.decal(g=>px.polyDither(g,[p(x,y+h),p(x+w,y+h),p(x+w+45,y+h+45),p(x+25,y+h+45)],'#393e2c',.25));
 r.queue(x+w/2,y+h,0,g=>{
  r.box(g,x,y,0,x+w,y+h,z,E.shade(c,.12),c);
  // Individual plank faces and uneven wood grain.
  for(let xx=x+8;xx<x+w;xx+=9){px.line(g,...p(xx,y+h,2),...p(xx,y+h,z-1),E.shade(c,-.17));for(let k=0;k<3;k++){const zz=7+E.hash2(xx,k)*Math.max(8,z-16),a=p(xx+3,y+h+.2,zz);px.line(g,a[0],a[1],a[0],a[1]+4,E.shade(c,-.11));}}
  for(let yy=y+8;yy<y+h;yy+=10)px.line(g,...p(x+w,yy,1),...p(x+w,yy,z-2),E.shade(c,-.3));
  // Raised base, cornice, and long front porch.
  r.box(g,x-3,y+h-2,0,x+w+3,y+h+17,4,'#97815b','#5e533d');
  for(let xx=x;xx<x+w;xx+=10)px.line(g,...p(xx,y+h+1,4.2),...p(xx,y+h+16,4.2),'#c0a879');
  const doorX=x+w*.49;
  px.poly(g,[p(doorX-12,y+h+.1,4),p(doorX+12,y+h+.1,4),p(doorX+12,y+h+.1,36),p(doorX-12,y+h+.1,36)],'#343c33');
  px.line(g,...p(doorX-12,y+h+.2,4),...p(doorX-12,y+h+.2,37),'#dec294',2);px.line(g,...p(doorX+12,y+h+.2,4),...p(doorX+12,y+h+.2,37),'#dec294',2);
  const d=p(doorX+7,y+h+.5,19);px.dot(g,...d,'#d0b473');
  for(const f of b.ruin?[.2]:[.16,.79]){const wx=x+w*f;px.poly(g,[p(wx-10,y+h+.5,18),p(wx+10,y+h+.5,18),p(wx+10,y+h+.5,36),p(wx-10,y+h+.5,36)],'#344d48');px.line(g,...p(wx-11,y+h+.8,18),...p(wx+11,y+h+.8,18),'#d6bf8e',2);px.line(g,...p(wx-11,y+h+.8,37),...p(wx+11,y+h+.8,37),'#d6bf8e',2);px.line(g,...p(wx,y+h+.8,18),...p(wx,y+h+.8,37),'#aa9571');px.line(g,...p(wx-10,y+h+.8,27),...p(wx+10,y+h+.8,27),'#aa9571');}
  // Gabled roof in three dimensions, dark pitched face and sunlit edge.
  const peak=z+24;
  px.poly(g,[p(x-7,y-7,z),p(x+w+7,y-7,z),p(x+w+7,y+h/2,peak),p(x-7,y+h/2,peak)],E.shade(roof,.12));
  px.poly(g,[p(x-7,y+h/2,peak),p(x+w+7,y+h/2,peak),p(x+w+7,y+h+7,z),p(x-7,y+h+7,z)],roof);
  px.poly(g,[p(x+w+7,y-7,z),p(x+w+7,y+h/2,peak),p(x+w+7,y+h+7,z)],E.shade(c,-.23));
  for(let xx=x-6;xx<x+w+6;xx+=11)px.line(g,...p(xx,y+h/2,peak+.5),...p(xx,y+h+7,z+.5),E.shade(roof,.12));
  for(let yy=y+h/2;yy<y+h+7;yy+=14){const t=(yy-y-h/2)/(h/2+7);px.line(g,...p(x-7,yy,E.lerp(peak,z,t)+.7),...p(x+w+7,yy,E.lerp(peak,z,t)+.7),E.shade(roof,-.15));}
  px.line(g,...p(x-7,y+h+7,z),...p(x+w+7,y+h+7,z),'#b8a174',2);
  if(!b.ruin){
   const aw=z-13;px.poly(g,[p(x-5,y+h+1,aw+7),p(x+w+5,y+h+1,aw+7),p(x+w+5,y+h+24,aw),p(x-5,y+h+24,aw)],'#7a7152');
   for(const xx of[x+3,x+w-3])px.line(g,...p(xx,y+h+21,4),...p(xx,y+h+21,aw),'#746041',3);
   const sc=b.depot?1:1,pt=p(x+w/2,y+h+3,z-7);E.font.text(g,b.name,pt[0],pt[1],b.depot?'#f0ddb0':'#dbc395',{align:'center',outline:'#524834',scale:sc});
  }
 },{occluder:true,hides:true,box:(()=>{const q=[[x-8,y-8,0],[x+w+8,y-8,0],[x-8,y+h+25,0],[x+w+8,y+h+25,0],[x-8,y+h/2,z+25],[x+w+8,y+h/2,z+25]].map(v=>r.w(...v));return[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];})()});
}
drawMap(g,width,height,state,mini=false){
 const scale=mini?.19:Math.min((width-50)/W,(height-65)/H);const px0=mini?width/2-state.player.x*scale:(width-W*scale)/2,py0=mini?height/2-state.player.y*scale:(height-H*scale)/2;
 const pt=(x,y)=>[x*scale+px0,y*scale+py0];g.clearRect(0,0,width,height);g.fillStyle=mini?'#b4b18c':'#c5bc91';g.fillRect(0,0,width,height);
 const line=(path,color,thick)=>{g.strokeStyle=color;g.lineWidth=thick;g.lineCap='round';g.lineJoin='round';g.beginPath();path.forEach((p,i)=>{const s=pt(...p);if(i)g.lineTo(...s);else g.moveTo(...s);});g.stroke();};
 // Contours are map data, not terrain collision.
 g.strokeStyle=mini?'#979d7970':'#aca67d';g.lineWidth=1;for(let i=0;i<9;i++){g.beginPath();for(let y=90;y<H;y+=35){const x=2100+i*30+Math.sin(y*.01+i)*58,p=pt(x,y);if(y===90)g.moveTo(...p);else g.lineTo(...p);}g.stroke();}
 line(CREEK,mini?'#6f9489':'#7d9c8c',mini?8:10);line(ROAD,mini?'#806f4d':'#9c815a',mini?6:5);line(ROAD,mini?'#d7c494':'#e2ce9e',mini?3:3);
 if(!mini){g.setLineDash([5,6]);line(REAR_PATH,'#8c8660',2);line(RIDGE_PATH,'#9f8961',2);g.setLineDash([]);}
 line([[1510,247],[2380,247]],'#615f4c',mini?3:3);
 for(const b of this.buildings){const p=pt(b.x,b.y);g.fillStyle='#706d50';g.fillRect(p[0],p[1],Math.max(3,b.w*scale),Math.max(3,b.h*scale));}
 const symbol=(x,y,c,r)=>{const p=pt(x,y);g.fillStyle=c;g.beginPath();g.arc(...p,r,0,Math.PI*2);g.fill();g.strokeStyle=mini?'#484e37':'#d6c79b';g.lineWidth=1.5;g.stroke();};
 for(const prop of this.props)if(prop.type==='tent'){const p=pt(prop.x,prop.y);g.fillStyle='#777759';g.fillRect(p[0]-3,p[1]-2,6,5);}
 if(!state.flags.aided)symbol(P.worker.x,P.worker.y,'#ece0b7',mini?4:5);
 if(state.horse&&!state.horse.mounted)symbol(state.horse.x,state.horse.y,'#6f553c',mini?4:4);
 if(state.enemies)for(const en of state.enemies){if(en.hp>0&&!en.surrendered&&(mini||state.flags.reachedDepot))symbol(en.x,en.y,en.alert>.75?'#a84632':'#9c7050',mini?3:3);}
 if(state.witness&&state.witness.state==='running')symbol(state.witness.x,state.witness.y,'#fff4cb',mini?5:5);
 const goal=state.goal||P.doctor,p=pt(goal.x,goal.y);g.save();g.translate(...p);g.rotate(Math.PI/4);g.fillStyle='#edd378';g.fillRect(-5,-5,10,10);g.strokeStyle='#735d36';g.lineWidth=1.5;g.strokeRect(-5,-5,10,10);g.restore();
 const me=pt(state.player.x,state.player.y);g.save();g.translate(...me);g.rotate(state.player.facing||0);g.beginPath();g.moveTo(8,0);g.lineTo(-5,-5);g.lineTo(-3,0);g.lineTo(-5,5);g.closePath();g.fillStyle='#fbf4d3';g.fill();g.strokeStyle='#323d31';g.lineWidth=1.6;g.stroke();g.restore();
 if(!mini){g.textAlign='center';g.fillStyle='#595c43';g.font='600 18px Georgia';for(const [name,x,y]of[["CALDER'S REST",330,1570],['CINDER SPUR',1880,150],['COTTONWOOD RIDGE',1290,670],['BITTER CREEK',730,550]]){const p=pt(x,y);g.fillText(name,...p);}g.font='italic 15px Georgia';for(const [name,x,y]of[['Public gate',1870,890],['Creek path',1520,340],['Eli Reed',790,1260]]){const p=pt(x,y);g.fillText(name,...p);}g.fillStyle='#3c4938';g.font='22px Georgia';g.fillText('N',width-31,35);g.beginPath();g.moveTo(width-31,44);g.lineTo(width-31,69);g.strokeStyle='#555c41';g.stroke();}
}
}
root.FrontierWorld=FrontierWorld;root.FrontierLevel={W,H,P,ROAD,CREEK,REAR_PATH,RIDGE_PATH,pathDist,segmentRect,pointIn};
})(window);
