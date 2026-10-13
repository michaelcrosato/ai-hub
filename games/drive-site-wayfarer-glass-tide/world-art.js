/* Wayfarer: The Glass Tide — original pixel environments and portraits.
 * Uses my-3D2dge's pixel primitives and sorted renderer. No remote assets.
 * Positions are world units. Prop positions are their ground foot, bottom center.
 */
(function (root) {
'use strict';
const E = root.My3D2dge, px = E.px, TAU = Math.PI * 2;
const palette = Object.freeze({ink:'#122c35',deep:'#173c42',teal:'#3d9d92',mint:'#97d5b0',gold:'#e5bc70',cream:'#fff1c8',red:'#c96558',water:'#216471',grass:'#527c58'});
const sprites = new Map(), floors = new WeakMap(), portraitCache = new Map();
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function context(c){const g=c.getContext('2d');g.imageSmoothingEnabled=false;return g;}
function hash(x,y){let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function random(seed){let a=seed|0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function R(g,x,y,w,h,c){px.rect(g,x,y,Math.ceil(w),Math.ceil(h),c);}
function L(g,x,y,xx,yy,c,w=1){px.line(g,x,y,xx,yy,c,w);}
function D(g,x,y,r,c){px.disc(g,x,y,r,c);}
function O(g,x,y,rx,ry,c){px.ell(g,x,y,rx,ry,c);}
function P(g,pts,c){px.poly(g,pts,c);}
function visible(r,x,y,m=100){const p=r.w(x,y,0);return p[0]>-m&&p[0]<r.W+m&&p[1]>-m&&p[1]<r.H+m*1.7;}
function tileAt(z,x,y){const row=z.tiles[y];return row&&row[x]||'~';}
function getFloor(zone){
 if(floors.has(zone))return floors.get(zone);
 const n=zone.tile||16, rows=zone.tiles, mw=Math.max(...rows.map(a=>a.length)),mh=rows.length,c=canvas(mw*n,mh*n),g=context(c);
 const wind=['overworld','refuge','spire'].includes(zone.id),ruin=/observ|tide|engine|arena|spire|vault/i.test(zone.id+' '+zone.name),marsh=/marsh|fen|reed/i.test(zone.id+' '+zone.name);
 const grass=ruin?['#49675c','#4f7060','#557762','#3f5f56']:marsh?['#497953','#4e8057','#55885c','#426f52']:['#5a8359','#608a5f','#658e61','#527b53'];
 const waters=[];
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
  const ch=tileAt(zone,x,y),xx=x*n,yy=y*n,rnd=random(x*1777+y*93563+317),h=hash(x,y);
  if(ch==='~'){
   R(g,xx,yy,n,n,(wind?['#365b73','#395f77','#3d657b','#33596f']:['#246672','#23626f','#286b73','#236573'])[Math.floor(h*4)]);
   for(let k=0;k<3;k++){const a=xx+Math.floor(rnd()*n),b=yy+Math.floor(rnd()*n);R(g,a,b,3+rnd()*5,1,wind?(k===0?'#638591':'#466f83'):(k===0?'#337c82':'#286f78'));}
   if(h>.53)waters.push([xx+2+rnd()*11,yy+2+rnd()*11,h]);
  }else if(ch===':'){
   R(g,xx,yy,n,n,(wind?['#adab7e','#b2ae82','#b6b285','#a9a578']:['#b5a071','#baa576','#b9a273','#b09a6e'])[Math.floor(h*4)]);
   for(let k=0;k<9;k++){const a=xx+rnd()*n,b=yy+rnd()*n;R(g,a,b,1+rnd()*2,1,rnd()>.5?'#c9b888':'#a99265');}
   if(h>.88){O(g,xx+8,yy+8,3,2,'#9d8c68');R(g,xx+6,yy+7,3,1,'#d2c194');}
  }else if(ch==='='){
   R(g,xx,yy,n,n,'#463f35');
   for(let by=0;by<n;by+=4){R(g,xx,yy+by,n,3,['#ad8957','#b89661','#a78252'][Math.floor(rnd()*3)]);R(g,xx+1,yy+by,n-2,1,'#c6a773');R(g,xx+2,yy+by+2,4+rnd()*8,1,'#916d48');R(g,xx+1,yy+by+1,1,1,'#585146');R(g,xx+n-2,yy+by+1,1,1,'#585146');}
  }else if(ch==='s'){
   R(g,xx,yy,n,n,wind?'#4e6066':'#425b59');
   for(let by=0;by<n;by+=8)for(let bx=0;bx<n;bx+=8){const cc=(wind?['#82908a','#929b91','#798b88','#89998f']:['#70857a','#7e9080','#6b8379','#758b7e'])[Math.floor(rnd()*4)];R(g,xx+bx+1,yy+by+1,7,7,cc);R(g,xx+bx+2,yy+by+1,6,1,wind?'#b7bda8':'#96a48c');R(g,xx+bx+7,yy+by+3,1,5,wind?'#637779':'#556f67');if(rnd()>.55)L(g,xx+bx+2,yy+by+6,xx+bx+4,yy+by+4,'#61786b');}
   if(h>.7){R(g,xx+1,yy+2,2,3,'#567d5b');R(g,xx+2,yy+2,2,1,'#809855');}
  }else if(ch===','){
   R(g,xx,yy,n,n,['#c4b57e','#cbbb85','#c7b681','#c2af78'][Math.floor(h*4)]);
   for(let k=0;k<10;k++){const a=xx+rnd()*n,b=yy+rnd()*n;R(g,a,b,rnd()>.8?2:1,1,rnd()>.45?'#d6c995':'#ac9b6a');}
   if(h>.93){O(g,xx+8,yy+8,2,1,'#f3d7ad');R(g,xx+7,yy+7,2,1,'#fff0c6');}
  }else if(ch==='^'){
   R(g,xx,yy,n,n,['#52646b','#5d7073','#61777a','#506770'][Math.floor(h*4)]);
   P(g,[[xx,yy+15],[xx+6,yy+3],[xx+13,yy+15]],'#83928a');P(g,[[xx+6,yy+3],[xx+13,yy+15],[xx+7,yy+12]],'#3e5663');L(g,xx+2,yy+12,xx+5,yy+6,'#bbc0a6');
   for(let k=0;k<6;k++)R(g,xx+rnd()*n,yy+rnd()*n,2+rnd()*3,1,k%2?'#71827f':'#495e68');
  }else if(ch==='d'){
   R(g,xx,yy,n,n,(wind?['#526970','#5a7175','#586c73','#4d646e']:['#344e4b','#395450','#3c5853','#304b49'])[Math.floor(h*4)]);
   for(let k=0;k<5;k++)R(g,xx+rnd()*n,yy+rnd()*n,2+rnd()*3,1,rnd()>.6?'#547365':'#294543');
  }else{
   const b=zone.biomes?.tiles?.[y]?.[x],windgrass=b==='w'?['#62866b','#6a8b70','#719273','#5f7f65']:b==='h'||zone.id==='spire'?['#7b8a77','#81917c','#899780','#74846e']:['#889969','#8e9e70','#95a477','#83966a'];
   R(g,xx,yy,n,n,(wind?windgrass:grass)[Math.floor(h*4)]);
   for(let k=0;k<7;k++){const a=xx+1+Math.floor(rnd()*(n-2)),b=yy+Math.floor(rnd()*n);if(k<3){R(g,a,b,2,1,wind?'#a8b47d':'#71945d');R(g,a+1,b-1,1,1,wind?'#c4c994':'#85a76b');}else R(g,a,b,1+rnd()*3,1,k%2?(wind?'#798963':'#48754f'):(wind?'#93a170':'#638c57'));}
   if(h>.97){R(g,xx+8,yy+7,1,2,'#b8bd78');R(g,xx+7,yy+8,3,1,'#e5d58e');}
  }
 }
 // The shore and path edge are drawn continuously across tile joins.
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
  const ch=tileAt(zone,x,y),xx=x*n,yy=y*n;if(ch==='~'){
   for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){const next=tileAt(zone,x+dx,y+dy);if(next==='~'||next==='=')continue;
    const horizontal=!!dy,bx=xx+(dx===1?n-2:0),by=yy+(dy===1?n-2:0);
    R(g,bx,by,horizontal?n:2,horizontal?2:n,'#6d9e8a');
    for(let k=0;k<n;k+=3){const a=hash(x*16+k,y*31);R(g,bx+(horizontal?k:dx===-1?2:-1),by+(horizontal?(dy===-1?2:-1):k),horizontal?2:1,horizontal?1:2,a>.5?'#8fb8a1':'#427f77');}
   }
  }else if(ch===':'||ch===','){
   for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])if(tileAt(zone,x+dx,y+dy)==='.'){
    for(let k=0;k<n;k+=3){const a=hash(x*17+k,y*13),bx=xx+(dx===1?n-1:dx===-1?0:k),by=yy+(dy===1?n-1:dy===-1?0:k);R(g,bx,by,dx?1:2,dy?1:2,'#71885a');if(a>.5)R(g,bx+(dx?-dx:1),by+(dy?-dy:1),1,1,'#7f9362');}
   }
  }
 }
 const st={canvas:c,waters,w:c.width,h:c.height};floors.set(zone,st);return st;
}
function drawFloor(r,zone,t,flags){
 const f=getFloor(zone),v=r.view,[x,y]=r.w(0,0,0),g=r.tgt;g.imageSmoothingEnabled=false;
 // A cached atlas is projected onto the yaw-zero ground plane.
 g.drawImage(f.canvas,Math.round(x),Math.round(y),Math.ceil(f.w*v.ax),Math.ceil(f.h*v.by));
 for(const q of f.waters){if(!visible(r,q[0],q[1],12))continue;const a=(t*.48+q[2]*3)%3;if(a>1.45)continue;const [sx,sy]=r.w(q[0]+a*2,q[1]);R(g,sx,sy,Math.max(1,Math.round((a<.7?4:2)*v.scale)),1,a<.65?'#70b4ad':'#468f94');if(a<.5)R(g,sx+2*v.scale,sy+2,2,1,'#3d8790');}
 // Draw the arena before the host draws combat warnings on the floor.
 for(const q of zone.props||[])if(q.type==='engine'&&!q.hidden)arena(r,q.x,q.y,t,['overworld','refuge','spire'].includes(zone.id)?{bossDefeated:!!flags?.chapterTwoComplete}:flags);
}
function travelSprite(type,variant){
 let c,ax,ay;
 if(type==='waystone'){
  c=canvas(58,82);ax=29;ay=76;const g=context(c);
  O(g,29,75,20,5,'#536958');P(g,[[12,67],[19,58],[42,61],[48,71],[39,78],[17,78]],'#667b72');L(g,17,68,40,66,'#b8bba0',2);
  P(g,[[20,63],[17,26],[21,13],[29,9],[38,16],[40,63],[31,68]],'#4c6670');P(g,[[20,60],[20,27],[24,15],[30,12],[33,60],[28,65]],'#8e9f91');R(g,22,29,3,28,'#b9c1a2');R(g,35,27,4,32,'#385862');
  R(g,17,49,24,4,'#ae9769');R(g,17,49,24,1,'#dec08b');R(g,19,59,22,3,'#9b986f');
  O(g,29,28,13,13,'#2a4954');O(g,29,27,11,11,'#ad9869');O(g,29,27,8,8,'#477773');O(g,29,27,6,6,variant===1?'#7aaebb':'#80b8a2');
  P(g,[[29,16],[32,25],[40,27],[32,29],[29,37],[26,29],[18,27],[26,25]],'#e4c999');P(g,[[29,19],[29,34],[25,27]],'#fbebbc');O(g,29,27,2,2,'#547b74');
  for(const yy of [39,43]){R(g,26,yy,5,1,'#4f7069');R(g,29,yy-1,1,3,'#c4c99e');}
  L(g,44,30,44,69,'#9b8b67',2);P(g,[[44,31],[57,32],[52,39],[55,45],[44,43]],variant===1?'#797995':'#be9767');L(g,46,33,52,34,'#ddd3a2');
  R(g,14,73,7,2,'#a3ac77');R(g,38,73,7,2,'#a3ac77');
 }else if(type==='windmill'){
  c=canvas(116,148);ax=58;ay=142;const g=context(c),rnd=random(631+variant*17);
  O(g,60,140,37,6,'#5f775f');P(g,[[36,127],[81,127],[88,140],[32,142]],'#65756c');R(g,34,136,53,4,'#adb397');
  P(g,[[44,69],[75,69],[84,130],[35,130]],'#879689');P(g,[[44,70],[53,70],[50,126],[37,128]],'#c4c5a2');P(g,[[68,71],[75,71],[83,127],[72,129]],'#4d6970');
  for(let y=76;y<128;y+=9){const left=43-(y-76)*.11,right=76+(y-76)*.13;L(g,left,y,right,y,'#5f7a72');L(g,left+1,y+1,right-2,y+1,'#aebba1');for(let x=47+(y%3)*4;x<right-2;x+=13)R(g,x,y-7,1,7,'#6f887a');}
  P(g,[[33,72],[41,53],[57,38],[78,57],[85,72]],'#304f5d');P(g,[[35,69],[43,54],[57,41],[60,69]],'#69897e');P(g,[[57,41],[75,58],[81,69],[60,69]],'#426676');
  for(let y=54;y<69;y+=5)L(g,43-(y-54)*.6,y,66+(y-54)*.8,y,'#96ad99');R(g,33,70,52,4,'#b49b6c');R(g,34,70,50,1,'#ecd39e');
  R(g,51,109,16,22,'#324b4b');O(g,59,109,8,7,'#324b4b');R(g,53,111,12,19,'#9a845c');R(g,55,111,1,19,'#c5ad7d');R(g,60,113,1,18,'#6b684f');R(g,61,120,2,2,'#edd4a0');R(g,48,132,24,4,'#c3bd98');R(g,45,137,30,4,'#92a08a');
  R(g,52,82,14,16,'#4b6664');R(g,54,83,10,12,'#adc7a7');R(g,55,83,3,10,'#e9e7bb');R(g,59,83,1,12,'#6c8374');R(g,54,89,10,1,'#6c8374');R(g,50,97,18,2,'#b5a47c');
  for(let k=0;k<14;k++){const x=37+rnd()*46,y=131+rnd()*9;R(g,x,y,2,2,k%3?'#a0af79':'#c2c78e');}
  L(g,89,104,90,140,'#657663',2);P(g,[[90,105],[107,105],[102,112],[107,118],[90,116]],variant===1?'#a997ad':'#c3ad7c');L(g,93,107,104,107,'#e2d7b2');
 }else if(type==='spire'){
  c=canvas(108,137);ax=54;ay=131;const g=context(c);
  O(g,54,129,44,7,'#465f66');P(g,[[19,115],[35,105],[76,105],[93,116],[82,132],[26,132]],'#728588');P(g,[[24,115],[37,109],[72,109],[86,116],[78,121],[30,121]],'#b7bca3');R(g,28,125,54,5,'#8b9b8e');R(g,24,132,62,3,'#c6c5a2');
  P(g,[[32,115],[38,44],[45,29],[64,29],[70,44],[76,115]],'#345968');P(g,[[35,112],[41,46],[47,34],[52,36],[48,115]],'#729b93');P(g,[[56,35],[63,33],[68,47],[73,113],[58,115]],'#527b87');
  for(let i=0;i<4;i++){const y=49+i*17;R(g,37-i,y,34+i*2,3,'#a49671');R(g,37-i,y,34+i*2,1,'#e0cda0');R(g,47,y+5,3,10,'#a6cfbb');R(g,59,y+4,3,11,'#759fb0');}
  P(g,[[26,47],[33,34],[43,27],[64,27],[74,34],[82,47],[70,52],[37,52]],'#4b6870');L(g,29,45,43,32,'#d4c393',3);L(g,43,30,65,30,'#e9d5a0',3);L(g,66,31,78,45,'#a89975',3);R(g,38,49,32,3,'#c4ae7e');
  P(g,[[45,26],[50,10],[54,2],[58,10],[64,26]],'#c9c6a0');P(g,[[54,3],[58,12],[61,24],[54,27]],'#6b9d9a');R(g,51,13,2,12,'#e3e7bd');
  L(g,26,52,20,106,'#7a8f86',3);L(g,82,52,88,106,'#617d80',3);for(const x of [20,88]){O(g,x,93,7,5,'#bcaa7d');R(g,x-3,81,6,12,'#708f87');P(g,[[x-3,80],[x,70],[x+3,80]],'#ced9b3');}
  O(g,54,77,11,13,'#263f51');O(g,54,76,9,11,'#bba775');O(g,54,76,6,8,'#79bdb6');L(g,52,71,52,77,'#e5f0c7',2);L(g,48,77,60,76,'#91a67d');
  R(g,46,104,17,17,'#263f4b');O(g,54,104,8,7,'#263f4b');R(g,49,108,10,13,'#668b85');R(g,52,109,2,12,'#cae0b6');R(g,43,123,23,2,'#ecdbb3');
 }else{
  c=canvas(98,86);ax=49;ay=81;const g=context(c),top=variant===1?9:3;
  O(g,48,79,46,6,'#435c61');P(g,[[2,79],[15,57],[26,26],[43,top],[54,25],[64,16],[76,44],[95,80]],'#405b68');
  P(g,[[6,77],[20,56],[28,27],[43,top+2],[45,42],[31,58],[30,79]],'#8c9d98');P(g,[[44,6],[54,29],[48,50],[44,77],[31,79],[40,45]],'#617c80');P(g,[[49,79],[56,46],[64,18],[70,47],[87,79]],'#6c8388');
  P(g,[[28,27],[43,top+2],[45,24],[40,21],[36,32],[34,24]],'#d0d2b6');P(g,[[57,39],[64,18],[69,34],[64,30],[61,40]],'#bcc6b0');
  L(g,15,65,29,36,'#b6c1ae',2);L(g,48,52,41,69,'#354f5e');L(g,71,50,81,72,'#9cae9f',2);P(g,[[9,74],[21,66],[28,76],[30,81],[7,81]],'#738c83');P(g,[[64,74],[77,63],[89,77],[94,81],[63,81]],'#496773');
  for(let i=0;i<10;i++){const x=10+hash(i,variant)*77,y=72+hash(i,21+variant)*8;R(g,x,y,3,1,i%2?'#a9b294':'#556d6b');}
 }
 return{canvas:c,ax,ay};
}
function drawWindRotor(g,t){
 const cy=-77,a=t*.3;
 for(let i=0;i<4;i++){
  const angle=a+i*TAU/4,ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux;
  const pt=(d,w)=>[ux*d+vx*w,cy+uy*d+vy*w];
  L(g,...pt(4,0),...pt(46,0),'#465b60',4);L(g,...pt(7,-1),...pt(45,-1),'#d7c393',2);
  P(g,[pt(15,2),pt(42,2),pt(45,12),pt(17,11)],'#526d72');P(g,[pt(16,3),pt(41,3),pt(43,10),pt(18,9)],'#d3d0ab');L(g,...pt(17,4),...pt(42,4),'#f4e3b5');
  for(const d of [21,28,35])L(g,...pt(d,3),...pt(d+1,10),'#8b9883');
 }
 O(g,0,cy,8,8,'#344e59');O(g,0,cy-1,6,6,'#c9b584');O(g,0,cy-1,3,3,'#759b8c');R(g,-2,cy-3,2,2,'#f8eac1');
}
function sprite(type,variant=0){
 const key=type+':'+variant;if(sprites.has(key))return sprites.get(key);
 if(['waystone','windmill','spire','peak'].includes(type)){const result=travelSprite(type,variant);sprites.set(key,result);return result;}
 let c,ax,ay;
 if(type==='tree'||type==='pine'){
  c=canvas(type==='pine'?64:82,92);ax=c.width/2;ay=88;const g=context(c),rnd=random(variant*517+782),cx=ax;
  O(g,cx,86,20,5,'#365d4d');O(g,cx-1,85,13,3,'#426f51');
  P(g,[[cx-6,88],[cx-3,64],[cx-7,47],[cx+5,44],[cx+4,72],[cx+9,88]],'#493f35');
  R(g,cx-2,49,4,36,'#785b3d');R(g,cx-2,62,1,20,'#af8754');L(g,cx+2,54,cx+1,82,'#4f4938');L(g,cx-1,72,cx-13,55,'#6b573a',3);L(g,cx+1,64,cx+13,49,'#514937',4);
  L(g,cx-3,84,cx-11,88,'#8c7747');L(g,cx+3,83,cx+10,87,'#726544');R(g,cx-8,85,4,2,'#6e894f');
  if(type==='pine'){
   for(let k=4;k>=0;k--){const yy=9+k*11,ww=10+k*4;P(g,[[cx,yy-7],[cx+ww,yy+18],[cx+ww-6,yy+18],[cx+ww-1,yy+24],[cx-ww,yy+24],[cx-ww+4,yy+16]],'#234e43');P(g,[[cx-1,yy-5],[cx+ww-4,yy+17],[cx-ww+3,yy+17]],'#3c7957');P(g,[[cx-2,yy-3],[cx-4,yy+13],[cx-ww+5,yy+14]],'#65915c');for(let a=0;a<9;a++){const xx=cx-ww+7+rnd()*(ww*2-14),yyy=yy+9+rnd()*12;R(g,xx,yyy,2+rnd()*3,1,'#71a26a');}}
  }else{
   const lobes=[[-20,44,17,18],[-25,35,14,15],[20,43,17,20],[27,32,11,14],[-10,21,18,18],[11,20,18,18],[0,44,26,22],[-10,43,18,18],[10,38,19,18]];
   for(const [dx,yy,rx,ry] of lobes)O(g,cx+dx,yy,rx,ry,'#234d40');
   for(const [dx,yy,rx,ry] of lobes){O(g,cx+dx-2,yy-3,rx-2,ry-3,variant%3===1?'#4a8052':'#397751');O(g,cx+dx-4,yy-7,rx-5,ry-7,variant%3===1?'#80a65c':'#66955a');}
   for(let k=0;k<195;k++){const xx=5+rnd()*(c.width-10),yy=3+rnd()*64;let inside=false;for(const [dx,cy,rx,ry] of lobes)if(((xx-cx-dx)/(rx-2))**2+((yy-cy)/(ry-2))**2<1){inside=true;break;}if(!inside)continue;const col=['#2d6448','#488755','#699c60','#82b16d','#9dbb75'][Math.floor(rnd()*5)];const s=1+Math.floor(rnd()*3);R(g,xx,yy,s+1,1,col);R(g,xx+1,yy+1,s,1,col);if(k%9===0)R(g,xx,yy-1,1,1,'#b1cb85');}
   for(let k=0;k<12;k++){const xx=cx-22+rnd()*44,yy=18+rnd()*37;if(variant%3===2){R(g,xx,yy,2,2,'#dca963');R(g,xx,yy,1,1,'#f7d18d');}}
  }
 }else if(type==='house'||type==='workshop'){
  c=canvas(108,119);ax=54;ay=112;const g=context(c),rnd=random(variant*113+589),warm=variant%2;
  O(g,56,111,45,6,'#375f50');
  R(g,13,92,79,17,'#647367');R(g,13,92,78,2,'#adb08b');
  for(let yy=95;yy<110;yy+=6)for(let xx=14+(yy%2)*5;xx<92;xx+=12){R(g,xx,yy,10,4,'#89937b');R(g,xx+1,yy,8,1,'#b0b095');}
  R(g,17,60,72,43,warm?'#d2bb83':'#c4ad7d');R(g,84,63,8,38,'#907657');R(g,18,62,4,40,'#7f6146');R(g,84,62,4,40,'#6e5841');
  for(let y=66;y<101;y+=7){R(g,22,y,61,1,'#ac946c');R(g,25,y+1,53,1,'#dbc494');}
  R(g,17,82,70,3,'#866345');R(g,17,84,70,1,'#b48f5e');R(g,48,66,4,37,'#916c4c');
  // Recessed door with iron strap hinges and a brass latch.
  R(g,45,77,21,29,'#674d38');R(g,47,78,17,25,'#876040');R(g,48,79,2,23,'#b48c58');R(g,55,80,1,23,'#664e39');R(g,61,78,2,25,'#543f34');
  R(g,48,84,15,2,'#39494a');R(g,48,98,15,2,'#39494a');R(g,59,91,2,2,'#f0d18b');R(g,58,92,1,2,'#aa813d');
  R(g,43,105,25,3,'#b9b694');R(g,41,109,29,3,'#7f8c75');R(g,42,109,27,1,'#d4cba7');
  for(const xx of [24,70]){R(g,xx-1,71,15,18,'#826546');R(g,xx,72,13,15,'#243c3e');R(g,xx+1,73,11,12,'#d7b363');R(g,xx+2,73,8,6,'#f9e6a4');R(g,xx+1,73,2,11,'#f8cf90');R(g,xx+6,72,1,15,'#6a5741');R(g,xx,79,13,1,'#6a5741');R(g,xx-2,87,18,3,'#8b6d49');R(g,xx-2,87,17,1,'#c5a574');}
  // A deep tiled roof, with a complete staggered shingle pattern.
  P(g,[[18,21],[83,21],[104,65],[1,65]],'#193c3d');
  P(g,[[19,22],[82,22],[100,60],[5,60]],warm?'#407c71':'#39796f');
  for(let row=0;row<7;row++){const yy=23+row*5,left=18-row*1.9,right=83+row*2.3;R(g,left,yy,right-left,1,'#75a58a');R(g,left,yy+4,right-left+3,1,'#285b55');for(let xx=left+(row%2)*6;xx<right;xx+=11){L(g,xx,yy,xx+1,yy+4,'#254c49');R(g,xx+2,yy+1,6,1,(row+Math.floor(xx))%3?'#538c79':'#8fb195');R(g,xx+3,yy+2,3,1,'#4d8875');}}
  R(g,1,64,103,4,'#263c37');R(g,3,63,99,2,'#bb9a66');R(g,7,67,94,2,'#745c42');
  L(g,18,21,3,61,'#a1b694',2);L(g,82,21,101,61,'#285549',2);R(g,17,18,68,4,'#234d48');R(g,17,18,67,1,'#afd2b1');R(g,16,22,70,1,'#6d9a81');
  // Dormer, chimney, weather vane, hanging flowers.
  R(g,68,8,12,25,'#818576');R(g,68,8,4,24,'#b4ae90');for(let yy=12;yy<32;yy+=6)R(g,68,yy,12,1,'#627266');R(g,66,7,16,4,'#c0b69a');R(g,67,7,14,1,'#e2d4ae');R(g,69,6,10,2,'#4c6157');
  R(g,30,38,22,18,'#ccba88');P(g,[[26,39],[41,25],[56,39]],'#203e3c');P(g,[[29,37],[41,28],[52,37]],'#689780');R(g,31,39,21,2,'#92724b');R(g,36,41,10,13,'#2c4946');R(g,37,42,8,10,'#cbb775');R(g,38,43,3,8,'#fcdf9d');R(g,41,42,1,11,'#736547');R(g,37,47,8,1,'#736547');R(g,33,54,16,2,'#8d7150');
  L(g,24,17,24,6,'#715c3e');L(g,20,9,30,9,'#d8b873');P(g,[[31,9],[27,6],[27,12]],'#e9d08c');R(g,23,4,3,2,'#e9cd8a');
  for(let k=0;k<20;k++){const xx=8+rnd()*12,yy=69+rnd()*27;R(g,xx,yy,2,2,k%3?'#5b8c52':'#87a865');if(k%4===0){R(g,xx,yy-1,2,1,'#ebae8c');R(g,xx+1,yy,1,1,'#ffdab1');}}
  if(type==='workshop'){
   R(g,71,90,31,13,'#78563c');R(g,71,90,31,2,'#d0a971');R(g,74,100,3,12,'#4c4939');R(g,98,100,3,12,'#4c4939');
   P(g,[[66,78],[96,78],[105,88],[69,88]],'#1d4041');for(let k=0;k<5;k++)P(g,[[67+k*6,79],[72+k*6,79],[75+k*6,86],[70+k*6,86]],k%2?'#dbc086':'#628a73');
   P(g,[[79,94],[94,94],[91,98],[84,98],[85,102],[80,102],[82,98]],'#3c5050');R(g,79,94,16,1,'#a5b1a1');L(g,93,92,99,98,'#c6a570',2);R(g,91,90,5,3,'#617d76');
  }
 }else if(type==='ruin'||type==='arch'){
  c=canvas(type==='arch'?96:36,type==='arch'?80:66);ax=c.width/2;ay=c.height-3;const g=context(c);
  const column=(x,y,h)=>{O(g,x+8,y+2,13,4,'#31574d');R(g,x-4,y-5,24,6,'#567466');R(g,x-4,y-5,24,1,'#a6ad86');R(g,x,y-h,17,h-5,'#8b9b82');R(g,x+12,y-h,5,h-5,'#58756a');R(g,x+1,y-h+1,3,h-7,'#bec3a0');for(let i=0;i<3;i++)R(g,x+5+i*4,y-h+3,1,h-12,'#6a8371');for(let yy=y-h+13;yy<y-5;yy+=14){R(g,x,yy,16,1,'#506f65');R(g,x+1,yy+1,14,1,'#b0b69a');}P(g,[[x-1,y-h],[x+2,y-h-5],[x+7,y-h-2],[x+11,y-h-6],[x+18,y-h-3],[x+17,y-h+3],[x,y-h+3]],'#c0c3a0');L(g,x+8,y-h+4,x+5,y-h+12,'#516f61');};
  if(type==='arch'){column(9,75,52);column(71,75,51);P(g,[[6,23],[11,10],[23,3],[47,0],[71,5],[88,15],[93,24],[75,26],[68,19],[49,14],[30,16],[23,25]],'#728c77');L(g,12,13,27,7,'#b9c3a0',3);L(g,28,6,46,3,'#cfcea6',3);L(g,48,3,68,8,'#b8b895',3);L(g,70,9,84,18,'#9aac8d',3);R(g,46,2,2,11,'#496c5d');R(g,24,7,1,10,'#496c5d');for(let i=0;i<12;i++)R(g,10+i*2,21+(i%4)*2,3,2,'#5b8155');}
  else {column(10,60,variant%2?39:53);O(g,27,62,6,2,'#5a7561');P(g,[[23,61],[24,56],[28,55],[32,60]],'#9ba98b');}
  for(let i=0;i<15;i++){const xx=5+hash(i,variant)*22,yy=c.height-13+hash(i+4,variant)*9;R(g,xx,yy,2,2,i%3?'#658855':'#96a464');}
 }else{
  c=canvas(48,62);ax=24;ay=57;const g=context(c),rnd=random(variant*222+915);
  if(type==='rock'){
   O(g,24,55,17,4,'#355c4e');P(g,[[6,50],[12,39],[20,34],[34,39],[41,52],[33,57],[13,57]],'#506a61');P(g,[[8,49],[14,39],[22,36],[33,40],[28,49],[16,52]],'#8b9c7f');P(g,[[16,41],[23,38],[31,41],[27,44]],'#b0b494');P(g,[[28,49],[33,41],[38,51],[31,54]],'#697e6a');L(g,16,52,20,45,'#627b66');for(let k=0;k<8;k++)R(g,12+rnd()*18,51+rnd()*5,2,1,k%2?'#67915b':'#99ad6a');
  }else if(type==='flower'||type==='reeds'){
   for(let k=0;k<(type==='reeds'?14:10);k++){const x=10+rnd()*28,y=48+rnd()*9,h=type==='reeds'?9+rnd()*16:4+rnd()*8;L(g,x,y,x-2,y-h,k%3?'#5d904f':'#9ab469');L(g,x-1,y-2,x+3,y-h*.5,'#77a45f');if(type==='flower'){const c=['#e6ce83','#e99f8e','#d6d8b6'][k%3];R(g,x-3,y-h,3,1,c);R(g,x-2,y-h-1,1,3,c);R(g,x-2,y-h,1,1,'#fff0b1');}else{R(g,x-3,y-h-3,2,6,'#ac9460');R(g,x-3,y-h-4,1,4,'#dbc17b');}}
  }else if(type==='lantern'){
   O(g,24,57,7,2,'#365c4b');R(g,21,25,4,31,'#455149');R(g,21,26,1,28,'#9b9e72');R(g,18,55,10,3,'#5e6954');L(g,23,26,29,20,'#9b9263',2);R(g,28,15,1,8,'#b9a36b');P(g,[[23,24],[35,24],[33,38],[25,38]],'#2e4946');R(g,26,25,6,11,'#d7a859');R(g,27,26,4,7,'#fff0b7');R(g,28,26,2,9,'#ffe0a0');R(g,24,24,11,2,'#8d794c');R(g,25,37,9,2,'#bca36c');R(g,29,24,1,13,'#836b43');R(g,22,22,14,2,'#526357');R(g,24,21,10,1,'#c1b885');
  }else if(type==='crystal'){
   O(g,24,56,15,3,'#345f58');for(const [x,h,w] of [[15,16,5],[32,14,5],[24,27,7]]){P(g,[[x-w,54],[x-w+1,54-h+5],[x,54-h],[x+w,54-h+6],[x+w-1,54],[x,57]],'#377d83');P(g,[[x-w+1,53],[x-w+2,54-h+5],[x,55-h],[x,56]],'#9cd0b5');P(g,[[x,55-h],[x+w-1,54-h+6],[x+2,54]],'#58aca0');L(g,x-w+2,54-h+6,x-1,55-h,'#d8ecd0');R(g,x-2,51-h,2,2,'#e8f3ce');}
  }else if(type==='bench'){
   R(g,5,40,38,4,'#c7a06b');R(g,5,45,38,4,'#a88151');R(g,5,40,38,1,'#ead09a');R(g,7,40,3,17,'#69583f');R(g,38,40,3,17,'#66583f');R(g,4,49,40,5,'#bd965f');R(g,4,49,40,1,'#e6c389');R(g,4,53,40,2,'#765d42');
  }else if(type==='crate'){
   R(g,10,34,27,23,'#99764c');P(g,[[10,34],[16,29],[40,29],[37,34]],'#c3a16c');P(g,[[37,34],[40,29],[40,51],[37,57]],'#674f38');for(let k=0;k<3;k++)R(g,12+k*8,35,1,20,'#765d3f');R(g,10,34,27,3,'#d1ad72');R(g,10,54,27,3,'#75583c');R(g,10,36,3,18,'#c8a06c');R(g,34,36,3,18,'#b58954');L(g,13,36,33,54,'#735b3d',3);L(g,13,35,33,53,'#d5b47a',2);for(const [x,y]of[[11,35],[35,35],[11,54],[35,54]])R(g,x,y,1,1,'#384844');
  }else if(type==='sign'){
   R(g,22,37,4,21,'#795c3c');R(g,22,37,1,20,'#b79864');P(g,[[7,26],[35,26],[42,33],[36,39],[7,39]],'#80603c');P(g,[[8,27],[35,27],[40,33],[35,36],[8,36]],'#caab76');R(g,9,28,25,1,'#edd2a0');R(g,15,31,13,1,'#6a6449');R(g,15,33,9,1,'#6a6449');P(g,[[31,30],[34,32],[31,34]],'#586c56');
  }
 }
 const out={canvas:c,ax,ay};sprites.set(key,out);return out;
}
function stamp(r,x,y,sp,o={}){
 if(!visible(r,x,y,Math.max(sp.canvas.width,sp.canvas.height)*r.view.scale))return;
 r.queue(x,y,0,g=>{const [sx,sy]=r.w(x,y,0),s=r.view.scale;g.imageSmoothingEnabled=false;g.drawImage(sp.canvas,Math.round(sx-sp.ax*s),Math.round(sy-sp.ay*s),Math.round(sp.canvas.width*s),Math.round(sp.canvas.height*s));},{hides:o.hides!==false,solid:true,...o});
}
function arena(r,x,y,t,flags){
 if(!visible(r,x,y,320))return;
 {
  const g=r.tgt,p=(xx,yy)=>r.w(xx,yy,0);r.groundDisc(x,y,121,'#263f40',1);r.groundDisc(x,y,116,'#a69768',1);r.groundDisc(x,y,111,'#445f58',1);r.groundDisc(x,y,104,'#738473',1);r.groundDisc(x,y,95,'#3a5753',1);r.groundDisc(x,y,90,'#627a6e',1);r.groundDisc(x,y,67,'#536e64',1);r.groundDisc(x,y,38,'#365552',1);
  for(const rad of [113,108,98,94,89,68,65,39,35])r.groundRing(x,y,rad,rad%2?'#bfb38a':'#294a47',1);
  for(let k=0;k<32;k++){const a=k/32*TAU,ca=Math.cos(a),sa=Math.sin(a),v=p(x+ca*103,y+sa*103),v2=p(x+ca*109,y+sa*109);L(g,v[0],v[1],v2[0],v2[1],k%4?'#c2b581':'#233f3f',k%4?1:3);if(k%4===0){const q=p(x+ca*83,y+sa*83);D(g,q[0],q[1],2*r.view.scale,'#244745');D(g,q[0],q[1],r.view.scale,'#add1a4');}}
  for(let k=0;k<8;k++){const a=k/8*TAU+.196,ca=Math.cos(a),sa=Math.sin(a),v=p(x+ca*43,y+sa*43),v2=p(x+ca*87,y+sa*87);L(g,v[0],v[1],v2[0],v2[1],'#36584f',3);L(g,v[0]-1,v[1]-1,v2[0]-1,v2[1]-1,'#8e9b7d');}
  r.groundRing(x,y,31,'#81b3a0',.8);r.groundRing(x,y,23,'#88b6a0',.55);r.groundDisc(x,y,8,'#a0c7aa',.75);
  for(let k=0;k<12;k++){const a=k/12*TAU+t*.07,v=p(x+Math.cos(a)*28,y+Math.sin(a)*28),v2=p(x+Math.cos(a+.12)*28,y+Math.sin(a+.12)*28);L(g,v[0],v[1],v2[0],v2[1],flags&&flags.bossDefeated?'#e8d6a1':'#95d7bf',2);}
 }
}
function queueProps(r,zone,t,flags={}){
 for(const q of zone.props||[]){if(q.hidden||q.type==='engine')continue;const variant=q.variant===undefined?Math.floor(hash(q.x,q.y)*3):q.variant;stamp(r,q.x,q.y,sprite(q.type,variant),{hides:!['flower','reeds','bench','sign'].includes(q.type)});
  if(q.type==='windmill')local(r,q.x,q.y,g=>drawWindRotor(g,r.game?.reduceMotion?0:t*(flags.chapterTwoComplete ? .55 : 1)),{bias:.1});
  if(q.type==='lantern'&&visible(r,q.x,q.y,90))r.queue(q.x,q.y,1,g=>{const s=r.view.scale,[x,y]=r.w(q.x,q.y),cy=y-28*s;px.blend(g,.12,'add',()=>{O(g,x+4*s,cy,9*s,10*s,'#efb86d');});},{emissive:true,bias:.01});
 }
}
function local(r,x,y,fn,opts={}){if(!visible(r,x,y,180))return;r.queue(x,y,0,g=>{const [sx,sy]=r.w(x,y,0);g.save();g.translate(Math.round(sx),Math.round(sy));g.scale(r.view.scale,r.view.scale);g.imageSmoothingEnabled=false;g._c=null;fn(g);g.restore();g._c=null;},{hides:true,solid:true,...opts});}
function drawRelay(r,x,y,active,t){
 r.shadow(x,y,15,.2,'#183f3c');local(r,x,y,g=>{
  O(g,0,-2,17,7,'#334e46');O(g,0,-5,17,7,'#9a946a');O(g,0,-6,13,5,'#c4b384');O(g,0,-8,10,4,'#4c7467');
  R(g,-6,-28,12,20,'#5d755f');R(g,-6,-28,3,19,'#c2ab6e');R(g,4,-27,3,18,'#375d51');R(g,-5,-14,11,2,'#c6ac70');R(g,-8,-29,16,4,'#b9a576');R(g,-8,-29,16,1,'#f1d69a');
  for(const yy of [-25,-20]){R(g,-2,yy,4,2,active?'#a5e1b5':'#637e6c');R(g,-1,yy,2,1,active?'#e9f3c1':'#9ba979');}
  const yy=-40+Math.round(Math.sin(t*2)*1.5);O(g,0,yy+7,10,3,'#274c49');P(g,[[0,yy-9],[6,yy],[0,yy+9],[-6,yy]],active?'#69bea9':'#4f7d77');P(g,[[0,yy-9],[0,yy+9],[-6,yy]],active?'#b4e3bb':'#91ac97');L(g,-4,yy-1,0,yy-7,active?'#f4f3c7':'#c3c8a0');
  for(let k=0;k<3;k++){const a=t*.8+k*TAU/3,cx=Math.cos(a)*10,cy=yy+Math.sin(a)*3;R(g,cx,cy,2,1,active?'#f7dc94':'#ac9f6c');}
 },{emissive:active});
}
function drawChest(r,x,y,opened,t){
 local(r,x,y,g=>{
  O(g,0,0,15,4,'#304d43');R(g,-13,-15,26,15,'#745538');R(g,-12,-14,24,11,'#ad8351');R(g,-10,-13,20,1,'#c49e65');R(g,-13,-2,26,3,'#4b4635');
  if(opened){R(g,-13,-26,26,10,'#b6935c');R(g,-11,-24,22,7,'#3d4333');R(g,-10,-23,20,1,'#7c6c42');O(g,0,-15,11,3,'#303e34');R(g,-9,-15,18,1,'#836d45');}
  else{O(g,0,-15,13,7,'#755538');O(g,-1,-17,12,5,'#b88c55');R(g,-11,-18,22,2,'#d5af72');R(g,-13,-14,26,2,'#614d35');}
  for(const xx of [-10,7]){R(g,xx,opened?-25:-21,3,opened?9:20,'#a99761');R(g,xx,opened?-25:-21,1,opened?9:20,'#f0d08e');R(g,xx,-12,3,11,'#ab9357');R(g,xx,-11,1,9,'#dec186');}
  R(g,-3,-13,6,6,'#d8b775');R(g,-2,-12,4,3,'#ebd093');R(g,-1,-11,2,2,'#4c5744');
 });
}
function drawGate(r,x,y,open,t){
 r.shadow(x,y,48,.22,'#294b47');local(r,x,y,g=>{
  for(const sx of [-42,32]){R(g,sx-4,-8,22,9,'#567064');R(g,sx-4,-8,22,2,'#adad84');R(g,sx,-60,13,52,'#78937c');R(g,sx,-59,3,49,'#c5c4a1');R(g,sx+9,-59,4,49,'#3f645c');R(g,sx-3,-64,19,5,'#b4b693');R(g,sx-4,-65,20,2,'#e1cea0');for(let yy=-51;yy<-10;yy+=13){R(g,sx,yy,13,2,'#3b655b');R(g,sx+2,yy+2,10,1,'#91a588');}R(g,sx+5,-46,3,13,open?'#a1dfb8':'#67897a');R(g,sx+5,-46,1,12,open?'#e4f1ba':'#c3c697');}
  P(g,[[-44,-63],[-32,-77],[31,-77],[48,-63],[32,-59],[-31,-59]],'#456a60');L(g,-37,-66,-29,-73,'#d2bd84',3);L(g,-27,-74,27,-74,'#e2c68b',3);L(g,30,-73,40,-65,'#a79766',3);R(g,-31,-62,64,2,'#243f40');
  O(g,0,-71,10,8,'#274e4b');O(g,0,-71,8,6,'#bca66e');O(g,0,-71,5,4,open?'#b5e7bd':'#427b73');R(g,-2,-74,3,2,'#fff0b7');
  if(!open){for(let xx=-28;xx<=28;xx+=7){R(g,xx,-60,3,57,'#3b645a');R(g,xx,-60,1,57,'#9dad80');P(g,[[xx-1,-7],[xx+4,-7],[xx+1,0]],'#c2b384');}R(g,-31,-37,64,4,'#ae9665');R(g,-31,-37,64,1,'#dec991');R(g,-31,-15,64,4,'#45695b');R(g,-31,-15,64,1,'#afae7e');O(g,0,-36,8,8,'#344e48');O(g,0,-36,6,6,'#b5a06d');R(g,-1,-39,3,5,'#396158');}
 },{hides:true});
}
function drawWarden(r,e,t){
 const x=e.x,y=e.y;if(!visible(r,x,y,220))return;r.shadow(x,y,43,.34,'#152f33');
 local(r,x,y,g=>{
  const hurt=!!(e.flash>0||e.hitFlash>0),stunned=!!(e.stun>0||e.stagger>0||e.state==='stagger'||e.state==='exposed'),hot=!!(e.windup>0||e.state==='windup'||e.state==='charge');
  const brass=hurt?'#efd7ac':'#ac8c57',lit=hurt?'#fff1cf':'#e0c18b',dark='#48574d';
  // Six independently animated legs, each with a hydraulic knee and foot.
  for(const s of [-1,1])for(let i=0;i<3;i++){
   const walk=Math.sin(t*(e.moving?9:3)+i*1.8+s)*3,oy=-17+i*16,tx=s*(44+i%2*9),ty=oy+13+walk;
   L(g,s*24,oy-17,s*43,oy-9+walk,dark,8);L(g,s*25,oy-19,s*43,oy-11+walk,brass,5);L(g,s*25,oy-20,s*42,oy-12+walk,lit,1);
   O(g,s*43,oy-9+walk,5,4,'#384d47');O(g,s*43-1,oy-10+walk,3,3,lit);
   L(g,s*43,oy-9+walk,tx,ty,dark,5);L(g,s*43-1,oy-10+walk,tx-1,ty-1,'#809786',2);
   P(g,[[tx-6,ty+2],[tx-3,ty-4],[tx+4,ty-4],[tx+7,ty+2]],'#3b5550');R(g,tx-4,ty-4,7,2,'#c0ad78');
  }
  // Tapered tail, overlapping layered carapace, riveted metal rim.
  P(g,[[-15,-47],[-11,-61],[0,-69],[12,-60],[16,-44]],'#3c5c54');P(g,[[-11,-49],[-8,-60],[0,-65],[7,-58],[9,-48]],'#93aa89');L(g,0,-62,0,-48,lit,3);
  O(g,0,-28,36,31,'#203c3e');O(g,0,-30,34,28,brass);O(g,-2,-34,31,25,lit);O(g,0,-29,28,24,'#3b6e65');
  P(g,[[-26,-39],[-19,-50],[-5,-56],[8,-54],[25,-44],[29,-26],[20,-15],[-23,-19],[-29,-30]],'#4c9789');
  P(g,[[-24,-39],[-17,-49],[-6,-53],[2,-50],[-3,-38],[-19,-27],[-25,-29]],'#93c4a6');
  P(g,[[2,-50],[12,-49],[23,-40],[25,-28],[14,-24],[-3,-34]],'#65ac99');
  P(g,[[15,-23],[25,-30],[23,-19],[16,-12],[-14,-12],[-24,-21],[-13,-28]],'#2b665f');
  L(g,-22,-40,-16,-48,'#d2e1b8',2);L(g,-12,-50,-5,-53,'#dce7be');L(g,-17,-32,-5,-42,'#b0d5b4',2);
  L(g,-2,-53,-3,-35,'#2b5c58');L(g,-3,-35,16,-22,'#2b5c58');L(g,-3,-35,-25,-24,'#2b5c58');
  for(let i=0;i<13;i++){const a=i/13*TAU;D(g,Math.cos(a)*31,-29+Math.sin(a)*27,1.5,'#695e40');R(g,Math.cos(a)*31-1,-30+Math.sin(a)*27,1,1,'#f1d297');}
  // Glass core changes color while exposed; this is the visible target.
  O(g,0,-33,12,13,'#254747');O(g,0,-34,10,11,brass);O(g,0,-34,7,8,stunned?'#f0c06d':hot?'#d27054':'#a0d6b2');O(g,-1,-36,5,5,stunned?'#fff0b2':hot?'#ffc181':'#d9edd0');R(g,-4,-39,3,2,'#fbf3d2');R(g,3,-34,2,4,hot?'#ad4945':'#53a394');
  L(g,-8,-42,8,-26,'#93844d');L(g,8,-42,-8,-26,'#cab67a');
  // Head, paired lenses and serrated pincers.
  P(g,[[-20,-9],[-15,-18],[14,-18],[21,-8],[15,1],[-15,1]],'#5a7260');R(g,-15,-13,30,5,brass);R(g,-13,-13,26,1,lit);O(g,-10,-7,6,5,'#234243');O(g,10,-7,6,5,'#234243');O(g,-10,-7,4,3,hot?'#f5a16c':'#a8ddbb');O(g,10,-7,4,3,hot?'#f5a16c':'#a8ddbb');R(g,-12,-9,2,2,'#fff2c8');R(g,8,-9,2,2,'#fff2c8');R(g,-5,-3,10,5,'#2c4844');for(let k=0;k<4;k++)R(g,-4+k*3,-2,1,4,'#c0b382');
  for(const s of [-1,1]){const yy=7+Math.round(Math.sin(t*3+s)*2);L(g,s*23,-9,s*35,yy,'#554f3e',8);L(g,s*23,-11,s*35,yy-2,brass,5);O(g,s*37,yy+2,9,8,'#324e46');P(g,[[s*34,yy-6],[s*46,yy-4],[s*49,yy+8],[s*40,yy+14],[s*42,yy+5],[s*36,yy+2]],brass);P(g,[[s*30,yy-4],[s*28,yy+5],[s*33,yy+12],[s*36,yy+10],[s*34,yy+4],[s*38,yy]],lit);L(g,s*41,yy-3,s*45,yy+6,lit,2);}
 },{hides:false,bias:.1});
}
function drawTempestLoom(r,e,t){
 if(!e||e.dead||!visible(r,e.x,e.y,240))return;
 const clock=r.game?.reduceMotion?0:t,exposed=e.exposed>0||e.state==='exposed'||e.stun>0||e.state==='stagger';
 const danger=e.windup>0||e.state==='windup'||e.state==='charge',phase=e.phase>=2;
 r.shadow(e.x,e.y,37,.23,'#2a354b');
 local(r,e.x,e.y,g=>{
  const bob=Math.round(Math.sin(clock*1.8)*2),cy=-61+bob,a=clock*(phase ? .42 : .27),hurt=e.flash>0||e.hitFlash>0||e.hurt>0;
  const gold=hurt?'#ffe7bc':'#bda175',highlight=hurt?'#fff4d2':'#ead19a',shade='#52616a';
  const energy=exposed?'#ffe8a2':danger?'#efac88':phase?'#c3b5ef':'#a8e0d2';
  // The long arms turn in the plane of the loom. Floating bobbins carry its thread.
  const limbs=[];for(let i=0;i<4;i++){const angle=a+i*TAU/4;limbs.push({angle,depth:Math.sin(angle),x:Math.cos(angle)*57,y:Math.sin(angle)*43});}limbs.sort((a,b)=>a.depth-b.depth);
  for(const arm of limbs){const ux=Math.cos(arm.angle),uy=Math.sin(arm.angle)*.76,ex=arm.x,ey=cy+arm.y;
   L(g,ux*18,cy+uy*18,ex,ey,'#2c4855',8);L(g,ux*19-1,cy+uy*19-1,ex-1,ey-1,gold,5);L(g,ux*21-2,cy+uy*21-2,ex-2,ey-2,highlight,1);
   O(g,ux*38,cy+uy*38,5,4,'#395866');O(g,ux*38-1,cy+uy*38-1,3,3,'#a4b29d');R(g,ux*38-2,cy+uy*38-2,2,1,highlight);
   O(g,ex,ey,8,10,'#354957');R(g,ex-5,ey-9,10,18,'#9b937b');R(g,ex-4,ey-8,3,15,'#d0cba6');R(g,ex+2,ey-7,3,15,'#4e797f');
   for(const yy of [-7,-3,1,5])L(g,ex-4,ey+yy,ex+3,ey+yy+1,energy);O(g,ex,ey-10,8,3,gold);O(g,ex-1,ey-11,6,2,highlight);O(g,ex,ey+10,8,3,'#746d63');O(g,ex,ey+9,7,2,gold);
   L(g,ex,ey,ux*9,cy+uy*9,energy);R(g,ex-1,ey-1,2,2,'#e5f0d0');
  }
  // Two combs hold the warp. Cross threads brighten when the core opens.
  P(g,[[-27,cy-24],[-18,cy-34],[18,cy-34],[28,cy-24],[29,cy+24],[18,cy+33],[-18,cy+33],[-29,cy+24]],'#273f52');
  P(g,[[-22,cy-22],[-14,cy-28],[15,cy-28],[23,cy-21],[23,cy+21],[15,cy+28],[-15,cy+28],[-23,cy+21]],'#426c79');
  for(let i=-4;i<=4;i++){const x=i*4;L(g,x,cy-25,x+Math.sin(clock*2+i)*1.5,cy+25,i%2?'#8cbfb2':'#587f87');}
  for(const dy of [-29,26]){R(g,-22,cy+dy,45,5,gold);R(g,-22,cy+dy,45,1,highlight);for(let x=-20;x<=20;x+=5)R(g,x,cy+dy+(dy<0?4:-3),2,5,'#d5bb83');}
  for(const side of [-1,1]){const xx=side*26;L(g,xx,cy-22,xx,cy+23,shade,6);L(g,xx-1,cy-22,xx-1,cy+21,gold,3);for(const yy of [-18,-7,6,19]){O(g,xx,cy+yy,3,3,'#617e81');R(g,xx-1,cy+yy-1,2,1,highlight);}}
  for(const dy of [-18,-9,0,9,18])L(g,-18,cy+dy+Math.sin(clock+dy)*2,18,cy+dy-Math.sin(clock+dy)*2,phase?'#928daf':'#719d96');
  // A bright, suspended weather crystal replaces the crab's heavy glass shell.
  const radius=exposed?20:16;
  P(g,[[0,cy-radius-6],[radius+5,cy],[0,cy+radius+6],[-radius-5,cy]],'#c0a576');
  P(g,[[0,cy-radius-3],[radius+2,cy],[0,cy+radius+3],[-radius-2,cy]],'#345964');
  P(g,[[0,cy-radius],[radius-2,cy],[0,cy+radius],[-radius+2,cy]],energy);
  P(g,[[0,cy-radius],[-radius+2,cy],[0,cy+radius],[0,cy]],exposed?'#fff3c4':danger?'#ffd3a4':phase?'#e0daf6':'#d5f0d5');
  P(g,[[0,cy-radius],[radius-2,cy],[0,cy]],exposed?'#fff9dc':'#ecf6e4');L(g,-radius+4,cy-1,-2,cy-radius+4,'#ffffff');
  if(!exposed){L(g,-13,cy-17,13,cy+17,gold,3);L(g,13,cy-17,-13,cy+17,gold,3);R(g,-2,cy-2,4,4,highlight);}
  else{for(const side of [-1,1]){P(g,[[side*18,cy-21],[side*25,cy-18],[side*27,cy+17],[side*19,cy+20]],gold);L(g,side*20,cy-18,side*21,cy+15,highlight);}}
  // The shuttle hangs clear of the ground and moves through three guide eyes.
  for(const dx of [-14,0,14]){const yy=cy+40+Math.sin(clock*2+dx)*3;L(g,dx,cy+31,dx+Math.sin(clock+dx)*2,yy,'#89b6b4');O(g,dx,yy,4,3,'#bca777');O(g,dx,yy,2,1,'#dbedc6');}
  const shuttle=Math.sin(clock*2)*13;P(g,[[shuttle,cy+37],[shuttle+5,cy+44],[shuttle,cy+55],[shuttle-5,cy+44]],'#91bdb9');L(g,shuttle,cy+39,shuttle,cy+51,highlight,2);
  P(g,[[0,cy-45],[4,cy-38],[0,cy-32],[-4,cy-38]],energy);R(g,-1,cy-43,2,3,'#fff1c7');
 },{hides:false,bias:.15});
}
function makePortrait(id){
 const c=canvas(48,48),g=context(c);
 R(g,0,0,48,48,'#203b43');R(g,1,1,46,46,'#304f52');for(let y=2;y<46;y++)R(g,2,y,44,1,y<20?'#375d5d':y<34?'#315751':'#25484b');
 O(g,35,11,13,14,'#496d63');for(let k=0;k<22;k++)R(g,hash(k,11)*47,hash(k,18)*46,1,1,'#6d8b72');
 if(id==='mara'){
  P(g,[[11,32],[9,20],[11,12],[16,7],[24,4],[32,7],[37,15],[35,32],[29,37],[14,36]],'#223c43');
  P(g,[[14,17],[18,12],[27,11],[33,16],[34,25],[30,32],[22,34],[16,29]],'#aa8264');P(g,[[15,18],[20,13],[27,13],[31,17],[32,24],[28,30],[23,32],[18,28]],'#d8b38a');R(g,16,19,3,6,'#edcda5');R(g,29,26,2,3,'#b98c6a');R(g,24,24,2,3,'#a57f61');R(g,24,29,6,1,'#795c50');R(g,25,28,4,1,'#e6bb98');
  R(g,17,20,6,1,'#3d4842');R(g,27,20,5,1,'#3d4842');R(g,18,21,4,1,'#ece3ba');R(g,28,21,3,1,'#ece3ba');R(g,20,21,2,2,'#4b6250');R(g,28,21,2,2,'#4b6250');R(g,18,18,5,1,'#45504a');R(g,27,18,4,1,'#45504a');
  P(g,[[10,20],[10,14],[15,8],[23,5],[31,8],[35,13],[34,20],[31,14],[26,11],[22,17],[20,13],[16,19],[15,26],[12,28],[10,25]],'#2d454c');P(g,[[12,14],[17,9],[24,7],[29,9],[24,10],[20,13],[16,15]],'#58706a');L(g,14,12,21,8,'#7e8b78');L(g,30,10,33,14,'#566960',2);R(g,12,22,2,7,'#46655f');
  P(g,[[2,47],[7,39],[17,33],[26,33],[39,38],[46,47]],'#6f7965');P(g,[[6,39],[16,33],[21,37],[17,47],[2,47]],'#b8b493');P(g,[[31,34],[39,39],[45,47],[32,47],[27,39]],'#92977b');L(g,9,40,16,44,'#e1d6ad',2);L(g,37,40,32,45,'#596e60',2);
  P(g,[[15,31],[21,33],[30,31],[35,34],[31,39],[20,39],[13,35]],'#3d745b');P(g,[[16,32],[22,34],[31,32],[32,34],[27,36],[19,36]],'#8cb081');P(g,[[28,37],[34,35],[39,43],[34,47],[28,46]],'#528b66');L(g,31,39,34,45,'#a5c196',2);
  R(g,16,26,2,3,'#d6bd82');R(g,16,26,1,1,'#fff0bb');O(g,13,40,3,3,'#a18b60');O(g,13,40,2,2,'#ecd598');L(g,12,39,14,41,'#5b7763');R(g,36,43,5,2,'#d7cfaa');R(g,37,42,1,5,'#70856e');
 }else if(id==='ada'){
  // Ada's silver braid, lined face, and worn violet shawl are distinct from the party.
  P(g,[[10,30],[10,15],[13,8],[21,4],[29,5],[35,10],[38,19],[35,35],[13,36]],'#697e7a');
  O(g,22,8,9,5,'#b5bbae');O(g,20,6,6,3,'#d9d8bf');R(g,17,5,7,1,'#f0e4c6');
  P(g,[[14,17],[17,12],[25,10],[31,13],[34,19],[32,29],[28,34],[20,34],[14,27]],'#835a49');
  P(g,[[15,18],[19,13],[25,12],[31,16],[32,23],[29,29],[26,32],[20,31],[16,27]],'#b28565');
  P(g,[[16,18],[19,15],[22,15],[20,23],[18,27],[16,25]],'#caa080');R(g,28,24,3,4,'#997057');R(g,23,24,2,3,'#d1a17b');
  R(g,16,20,6,1,'#644e45');R(g,26,20,6,1,'#644e45');R(g,18,21,4,1,'#ddd1aa');R(g,27,21,4,1,'#ddd1aa');R(g,20,21,2,2,'#374e45');R(g,28,21,2,2,'#374e45');
  R(g,16,18,6,1,'#bfc1ab');R(g,26,18,6,1,'#bfc1ab');R(g,18,16,4,1,'#976f56');R(g,25,16,5,1,'#976f56');
  R(g,16,23,4,1,'#98705a');R(g,28,23,4,1,'#98705a');R(g,14,21,2,1,'#d2a88a');R(g,32,21,2,1,'#c19975');R(g,15,24,1,2,'#7c5d4c');R(g,31,24,1,2,'#7c5d4c');
  R(g,22,29,7,1,'#795344');R(g,23,30,5,1,'#d2a282');R(g,20,27,1,2,'#93634d');R(g,29,27,1,2,'#93634d');R(g,22,32,5,1,'#bd9575');
  P(g,[[11,18],[11,13],[15,8],[22,7],[30,8],[35,13],[36,21],[33,23],[32,16],[27,12],[23,11],[18,13],[15,20],[14,26],[11,24]],'#a2b0a5');
  L(g,12,16,16,10,'#d2d4bb',2);L(g,16,10,22,8,'#e7e2c4',2);L(g,25,9,32,13,'#d4d7bc',2);L(g,12,20,13,26,'#d1d5bf',2);L(g,33,16,35,22,'#7f9890',2);
  P(g,[[3,47],[7,39],[16,33],[23,36],[31,33],[40,38],[46,47]],'#493f60');
  P(g,[[6,39],[16,32],[22,36],[16,47],[2,47]],'#786985');P(g,[[24,36],[31,33],[41,39],[46,47],[28,47]],'#625a78');
  P(g,[[17,33],[22,35],[28,33],[31,36],[25,40],[20,39]],'#ab9585');L(g,8,39,19,45,'#b1a58f',2);L(g,33,36,29,43,'#92909b',2);
  for(const [xx,yy]of[[8,42],[11,44],[14,46],[37,42],[39,44],[41,46]])R(g,xx,yy,2,1,'#b8aa94');
  // A practical braid lies over her shoulder, fastened with a brass cord.
  for(let k=0;k<6;k++){const xx=33+(k%2),yy=23+k*3;R(g,xx,yy,5,3,'#879f95');R(g,xx,yy,3,1,'#d8dcc0');R(g,xx+1,yy+1,3,1,'#bcc9ae');R(g,xx+3,yy+2,2,1,'#637f78');}
  R(g,34,40,4,2,'#c2a56c');R(g,34,40,3,1,'#f1cf8c');P(g,[[34,42],[37,42],[38,46],[33,45]],'#a3bbae');
  O(g,17,40,4,4,'#766343');O(g,17,39,3,3,'#d8b774');O(g,17,39,1,1,'#567c6c');L(g,17,36,17,42,'#f2dba1');R(g,15,39,5,1,'#edd092');R(g,14,27,2,3,'#cfb278');R(g,14,27,1,1,'#ffe0a0');
 }else if(id==='orren'){
  P(g,[[8,47],[8,23],[13,9],[23,3],[34,7],[40,19],[39,47]],'#242d45');P(g,[[11,26],[13,12],[23,6],[32,9],[37,21],[31,31],[17,32]],'#515174');P(g,[[15,16],[18,11],[28,10],[34,16],[33,29],[28,35],[18,32],[14,26]],'#6f6756');
  P(g,[[16,17],[20,13],[28,13],[32,17],[32,27],[27,33],[20,31],[16,26]],'#c2a976');P(g,[[16,17],[20,13],[23,13],[21,26],[25,31],[19,30],[16,25]],'#e5c68c');R(g,16,20,17,6,'#3c5f5c');R(g,18,21,4,2,'#bcf0d1');R(g,27,21,4,2,'#bcf0d1');R(g,22,18,3,10,'#c8b480');R(g,23,27,6,2,'#6d705a');R(g,25,27,3,1,'#fcdd99');
  R(g,14,19,2,8,'#9b8965');R(g,33,19,2,8,'#786954');R(g,17,16,2,1,'#fff0b5');R(g,30,17,1,2,'#ffeab0');
  P(g,[[4,47],[7,37],[17,31],[23,36],[31,31],[40,36],[44,47]],'#30354f');P(g,[[7,39],[16,32],[23,36],[18,47],[3,47]],'#5b5b7c');P(g,[[23,36],[31,32],[40,36],[43,47],[26,47]],'#3e4667');L(g,9,37,19,44,'#8c8a98',2);L(g,34,35,27,43,'#706e8a',2);O(g,24,39,5,5,'#bca16d');O(g,24,39,3,3,'#418477');R(g,23,37,2,2,'#e4e9bd');
 }else if(id==='sera'){
  P(g,[[12,33],[10,20],[13,11],[19,6],[30,5],[36,11],[38,23],[35,38]],'#694831');
  P(g,[[14,17],[19,11],[28,10],[34,15],[34,27],[29,34],[22,35],[16,29]],'#8f573b');P(g,[[15,18],[20,12],[28,13],[32,18],[31,28],[26,32],[21,31],[17,27]],'#b57650');R(g,16,21,3,5,'#cd9163');R(g,24,30,5,1,'#693f35');R(g,25,29,4,1,'#dc9b75');R(g,24,24,2,3,'#de9c6b');
  R(g,17,20,5,2,'#4f3730');R(g,27,20,5,2,'#4f3730');R(g,18,21,4,1,'#f0d6a4');R(g,28,21,3,1,'#f0d6a4');R(g,20,21,2,2,'#37453e');R(g,28,21,2,2,'#37453e');R(g,18,18,4,1,'#6a4530');R(g,27,18,4,1,'#6a4530');
  P(g,[[13,19],[11,14],[16,7],[23,5],[31,6],[36,13],[35,21],[31,15],[27,14],[24,9],[21,14],[16,16]],'#b17c40');P(g,[[13,14],[17,8],[24,6],[28,8],[20,10],[19,13]],'#e0ae5b');L(g,28,7,34,13,'#e0b666',2);L(g,13,17,14,29,'#b18543',3);L(g,34,18,34,34,'#9d6b34',4);for(let y=24;y<39;y+=4){R(g,13,y,4,2,'#d7a758');R(g,33,y,4,2,'#cc9b4b');R(g,14,y+2,3,1,'#6f512e');R(g,33,y+2,3,1,'#6f512e');}
  P(g,[[3,47],[8,38],[18,33],[24,36],[31,33],[40,38],[46,47]],'#446346');P(g,[[6,39],[17,32],[25,37],[18,47],[2,47]],'#82925a');P(g,[[27,36],[32,33],[42,39],[44,47],[30,47]],'#6e8554');L(g,9,38,19,42,'#b4b57b',2);L(g,35,36,31,43,'#9bad6a',2);O(g,25,39,3,4,'#d8b470');O(g,25,38,1,2,'#ffdca3');
  L(g,34,12,39,7,'#d3c187',2);P(g,[[35,11],[36,5],[40,4],[39,8]],'#8eb787');R(g,37,5,1,3,'#d5d69b');R(g,34,27,2,2,'#e5c284');
 }else{
  P(g,[[11,33],[10,20],[12,11],[20,5],[29,4],[35,10],[37,22],[32,36],[15,37]],'#758c8a');
  P(g,[[15,15],[20,10],[28,11],[33,16],[33,27],[28,33],[21,33],[15,27]],'#c09176');P(g,[[16,16],[21,12],[28,13],[31,17],[30,27],[26,31],[20,29],[16,25]],'#ecc3a0');R(g,16,18,3,8,'#f4d7b6');R(g,29,25,2,3,'#ce987c');R(g,23,24,2,3,'#d3a184');R(g,24,30,5,1,'#996a62');R(g,25,29,4,1,'#f6c3a6');
  R(g,17,20,5,2,'#5d615d');R(g,27,20,5,2,'#5d615d');R(g,18,21,4,1,'#fff0ce');R(g,28,21,3,1,'#fff0ce');R(g,20,21,2,2,'#31776f');R(g,28,21,2,2,'#31776f');R(g,17,18,5,1,'#9b9586');R(g,27,18,4,1,'#9b9586');
  P(g,[[11,20],[11,13],[16,7],[22,5],[30,5],[35,11],[35,18],[31,17],[27,12],[24,17],[23,12],[18,17],[17,24],[14,27],[12,24]],'#b9c8bc');P(g,[[13,14],[17,8],[23,6],[30,7],[32,10],[24,9],[20,12],[17,18],[16,15]],'#e3e4cd');L(g,14,13,19,8,'#fff1d5',2);L(g,28,7,33,12,'#f4edce');P(g,[[13,22],[14,27],[18,30],[16,35],[12,32],[10,27]],'#91aaa1');R(g,14,24,2,8,'#d9ddc6');
  P(g,[[3,47],[8,39],[18,33],[29,33],[39,39],[45,47]],'#255e5d');P(g,[[7,39],[17,33],[21,37],[17,47],[2,47]],'#438f82');P(g,[[30,34],[39,39],[45,47],[32,47],[27,39]],'#33746f');L(g,9,39,16,44,'#7db09b',2);R(g,9,41,3,4,'#ceb078');R(g,36,41,3,4,'#9e925f');
  P(g,[[15,32],[20,34],[29,32],[34,35],[30,39],[19,38],[14,35]],'#a9534d');P(g,[[16,32],[20,34],[30,32],[32,34],[28,36],[20,36]],'#e18066');P(g,[[27,37],[33,36],[38,43],[34,48],[27,46]],'#c76757');L(g,30,38,33,45,'#ef9b7c',2);R(g,16,26,2,3,'#e6be74');R(g,16,26,1,1,'#fff0b6');
 }
 R(g,0,0,48,1,'#c6b788');R(g,0,47,48,1,'#b29f75');R(g,0,0,1,48,'#a4b18b');R(g,47,0,1,48,'#7b8b72');return c;
}
function portrait(destination,id){let p=portraitCache.get(id);if(!p){p=makePortrait(id);portraitCache.set(id,p);}if(!destination)return p;const g=destination.getContext?destination.getContext('2d'):destination;g.imageSmoothingEnabled=false;g.clearRect(0,0,g.canvas.width,g.canvas.height);g.drawImage(p,0,0,g.canvas.width,g.canvas.height);return destination;}
root.WayfarerArt={drawFloor,queueProps,drawRelay,drawChest,drawGate,drawWarden,drawTempestLoom,portrait,palette};
})(window);
