/* Original Nacre level, architecture, and environment art. */
(function(E){
 'use strict';
 const {px,hash2,shade,lerp}=E;
 const palette={stone:'#b9ac8d',light:'#e7d5ad',shadow:'#788589',roof:'#ad6447',sea:'#24545d',gold:'#e8c584',ink:'#162932'};
 const B=(id,x,y,w,d,h,style='stone',extra={})=>({id,x,y,w,d,h,style,climb:true,...extra});
 function makeLevel(){
  const buildings=[
   B('harbor-store',104,544,72,78,42,'stone'),B('customs',220,569,96,108,60,'copper'),B('print-house',344,574,82,111,68,'stone'),B('dye-house',442,555,76,124,64,'copper'),
   B('west-tenement',100,329,87,154,66,'stone'),B('cloth-house',213,354,64,62,48,'copper'),B('spice-house',320,330,86,63,57,'stone'),B('exchange',435,348,78,79,60,'copper'),
   B('north-tenement',100,95,88,173,87,'copper'),B('bell-house',213,98,68,96,62,'stone'),B('bell-tower',213,233,70,72,112,'tower'),B('roof-garden',308,114,100,184,84,'garden'),B('canal-house',438,114,84,180,88,'copper'),
   B('levy-hall',624,108,292,96,94,'palace'),B('court-west',624,204,60,233,70,'stone'),B('court-east',858,204,63,233,78,'stone'),
   B('gate-west',684,417,60,20,28,'wall',{climb:false}),B('gate-east',788,417,70,20,28,'wall',{climb:false}),B('seal-gate',744,417,44,20,32,'gate',{climb:false}),
   B('east-workshop',611,489,88,93,70,'copper'),B('weavers',717,492,85,85,52,'stone'),B('glass-house',844,471,77,111,72,'copper'),B('east-granary',613,617,119,86,64,'stone'),B('canal-office',793,617,123,82,56,'copper')
  ];
  const bridges=[B('roof-crossing',518,220,110,15,88,'bridge',{climb:false}),B('roof-step',397,224,48,14,84,'bridge',{climb:false})];
  const stalls=[{x:295,y:443,w:31,d:22,color:'#b26b48'},{x:340,y:422,w:32,d:21,color:'#314e59'},{x:403,y:471,w:29,d:21,color:'#c3a159'},{x:371,y:536,w:34,d:20,color:'#355d60'},{x:476,y:548,w:27,d:18,color:'#aa6b56'}];
  for(let i=0;i<stalls.length;i++){const a=stalls[i];buildings.push(B('stall-'+i,a.x,a.y,a.w,a.d,18,'stall',{climb:false,color:a.color}));}
  const world=new E.CityWorld({width:1000,height:810,buildings,bridges});
  const crowds=[{x:347,y:483,r:37},{x:462,y:519,r:27},{x:193,y:507,r:24},{x:778,y:469,r:29}];
  const hides=[{id:'linen',x:197,y:545,r:17,kind:'linen',name:'Linen shelter'},{id:'garden',x:339,y:268,z:84,r:17,kind:'garden',name:'Roof garden'},{id:'cart',x:610,y:443,r:19,kind:'cart',name:'Covered cart'},{id:'screen',x:826,y:599,r:19,kind:'linen',name:'Cloth shelter'}];
  const props=[];
  for(const b of buildings.filter(b=>!['stall','gate','wall','tower'].includes(b.style))){props.push({type:'chimney',x:b.x+15,y:b.y+13,z:b.h});if(hash2(b.x,b.y)>.4)props.push({type:'pot',x:b.x+b.w-12,y:b.y+b.d-13,z:b.h});}
  for(const p of [[118,653],[203,681],[318,546],[418,450],[523,311],[605,276],[709,457],[925,440],[580,676],[285,315],[189,302]])props.push({type:'lamp',x:p[0],y:p[1],z:0});
  for(const p of [[120,629],[126,639],[313,543],[416,506],[931,598],[914,607],[150,725],[211,701],[600,602]])props.push({type:'crate',x:p[0],y:p[1],z:0});
  const notes=[{id:'dock',x:146,y:386,z:66,name:'A dock worker’s account'},{id:'roof',x:485,y:149,z:88,name:'A list of seized homes'},{id:'east',x:880,y:665,z:56,name:'The false levy order'}];
  return{world,crowds,hides,props,notes,lookout:{x:248,y:281,z:112},listen:{x:347,y:483,z:0},exit:{x:178,y:751,z:0},gate:{x:766,y:450,z:0},start:{x:182,y:671,z:0},stalls};
 }
 function poly(g,p,c){px.poly(g,p,c);}
 function prism(g,P,x,y,z,w,d,h,top,face=palette.stone){const a=P(x,y,z+h),b=P(x+w,y,z+h),c=P(x+w,y+d,z+h),d0=P(x,y+d,z+h),aa=P(x,y,z),bb=P(x+w,y,z),cc=P(x+w,y+d,z),dd=P(x,y+d,z);poly(g,[b,c,cc,bb],shade(face,-.19));poly(g,[d0,c,cc,dd],face);poly(g,[a,b,c,d0],top);px.line(g,...d0,...c,shade(top,.19));px.line(g,...b,...c,shade(top,-.07));}
 class CityArt{
  constructor(level){this.level=level;this.bakes=new Map();this.floor=null;this.viewKey='';this.rand=E.rng(2189);this.birds=Array.from({length:10},(_,i)=>({x:170+i*83,y:160+(i%3)*170,z:150+i%4*20,phase:i*1.7}));}
  key(v){return[v.yawDeg,v.pitchDeg,v.scale].join(':');}
  clear(){this.floor=null;this.bakes.clear();}
  bakeFloor(v){
   const corners=[[50,25],[985,25],[985,820],[50,820]].map(p=>v.p(...p,0)),minX=Math.floor(Math.min(...corners.map(p=>p[0])))-30,minY=Math.floor(Math.min(...corners.map(p=>p[1])))-35,maxX=Math.max(...corners.map(p=>p[0]))+30,maxY=Math.max(...corners.map(p=>p[1]))+40;
   const c=E.mkCanvas(Math.ceil(maxX-minX),Math.ceil(maxY-minY)),g=E.ctx2d(c),P=(x,y,z=0)=>{const a=v.p(x,y,z);return[a[0]-minX,a[1]-minY];},w=this.level.world;
   const q=(x,y,ww,dd,col,z=0)=>poly(g,[P(x,y,z),P(x+ww,y,z),P(x+ww,y+dd,z),P(x,y+dd,z)],col);
   prism(g,P,88,60,-15,864,654,15,'#a59e86','#767c72');
   q(542,60,46,654,palette.sea,1);
   for(let y=64;y<713;y+=17)for(let x=90;x<951;x+=23){if(!w.land(x+11,y+8))continue;const n=hash2(x,y);q(x,y,21,15,E.mix('#a49b81','#c4b89a',n*.7));if(n>.88)px.line(g,...P(x+3,y+7),...P(x+12,y+8),'#a29b85');}
   for(const yy of [239,495,627]){prism(g,P,532,yy,-7,66,yy===239?46:42,7,'#cbb994','#8d9989');for(let x=535;x<598;x+=8)px.line(g,...P(x,yy),...P(x,yy+39),'#afaa90');}
   for(const x of[538,588])for(let y=61;y<714;y+=11){if((y>238&&y<286)||(y>494&&y<538)||(y>626&&y<668))continue;prism(g,P,x,y,0,4,10,4,'#d2c2a3','#8e9d95');}
   q(138,710,80,74,'#756854');for(let y=711;y<784;y+=7)px.line(g,...P(139,y),...P(217,y),'#a7916c');for(const x of[140,211])for(let y=711;y<786;y+=33)prism(g,P,x,y,0,6,6,10,'#c1a57b','#655a4a');
   q(689,217,165,195,'#bab299');
   for(let y=222;y<413;y+=17)for(let x=693;x<852;x+=18)q(x,y,16,15,(Math.floor(x/18)+Math.floor(y/17))%2?'#c4bda3':'#b3ad94');
   for(const cc of this.level.crowds){const pts=[];for(let i=0;i<40;i++){let a=i/40*Math.PI*2;pts.push(P(cc.x+Math.cos(a)*(cc.r+10),cc.y+Math.sin(a)*(cc.r+10)));}poly(g,pts,'#b8a88c');}
   for(const[y1,y2]of[[62,714]])for(let y=y1;y<y2;y+=32)px.line(g,...P(89,y),...P(89,y+29),'#d6c7a7');
   this.floor={c,x:minX,y:minY};
  }
  bakeBuilding(b,v){
   const extra=b.style==='tower'?38:12,points=[];for(const x of[b.x-6,b.x+b.w+6])for(const y of[b.y-6,b.y+b.d+6])for(const z of[0,b.h+extra])points.push(v.p(x,y,z));
   const ox=Math.floor(Math.min(...points.map(p=>p[0])))-8,oy=Math.floor(Math.min(...points.map(p=>p[1])))-8,c=E.mkCanvas(Math.ceil(Math.max(...points.map(p=>p[0]))-ox)+10,Math.ceil(Math.max(...points.map(p=>p[1]))-oy)+10),g=E.ctx2d(c),P=(x,y,z=0)=>{const a=v.p(x,y,z);return[a[0]-ox,a[1]-oy];};
   let face=b.style==='palace'?'#cbbca0':b.style==='copper'?'#bfa98a':b.style==='wall'?'#b3ad93':'#b7ad91',top=b.style==='copper'?'#a7654e':b.style==='garden'?'#b7aa87':b.style==='palace'?'#baa98b':'#bfaf91';
   if(b.style==='stall'){
    prism(g,P,b.x,b.y,0,b.w,b.d,11,'#957550','#756047');for(let x=b.x;x<b.x+b.w;x+=6)prism(g,P,x,b.y+3,11,4,5,3,hash2(x,b.y)>.5?'#cfa04d':'#71835b','#916541');
    for(const x of[b.x,b.x+b.w-2])for(const y of[b.y,b.y+b.d-2])prism(g,P,x,y,0,2,2,29,'#ceb98b','#695945');
    for(let x=b.x-3;x<b.x+b.w+3;x+=6){const ww=Math.min(6,b.x+b.w+3-x);poly(g,[P(x,b.y-3,30),P(x+ww,b.y-3,30),P(x+ww,b.y+b.d+5,24),P(x,b.y+b.d+5,24)],Math.round((x-b.x)/6)%2?b.color:'#d5c5a0');px.line(g,...P(x,b.y+b.d+5,24),...P(x+ww,b.y+b.d+5,24),shade(b.color,-.15),2);}return{c,x:ox,y:oy};
   }
   if(b.style==='gate'){
    prism(g,P,b.x,b.y,0,b.w,b.d,b.h,'#ad9267','#475858');for(let x=b.x+4;x<b.x+b.w;x+=7){px.line(g,...P(x,b.y+b.d+.2,2),...P(x,b.y+b.d+.2,b.h-3),'#d2b87a',2);}px.line(g,...P(b.x+2,b.y+b.d+.2,12),...P(b.x+b.w-2,b.y+b.d+.2,12),'#a89265',2);return{c,x:ox,y:oy};
   }
   prism(g,P,b.x,b.y,0,b.w,b.d,b.h,top,face);
   for(let z=8;z<b.h-4;z+=9){const a=shade(face,-.1);px.line(g,...P(b.x,b.y+b.d+.1,z),...P(b.x+b.w,b.y+b.d+.1,z),a);px.line(g,...P(b.x+b.w+.1,b.y,z),...P(b.x+b.w+.1,b.y+b.d,z),shade(face,-.26));for(let x=b.x+((z/9|0)%2?9:0);x<b.x+b.w;x+=21)px.line(g,...P(x,b.y+b.d+.2,z),...P(x,b.y+b.d+.2,z+8),shade(face,-.08));}
   const windowFront=(x,z,width=10,height=17)=>{const y=b.y+b.d+.3;poly(g,[P(x,y,z),P(x+width,y,z),P(x+width,y,z+height-4),P(x+width*.7,y,z+height),P(x+width*.3,y,z+height),P(x,y,z+height-4)],'#394a4a');px.line(g,...P(x+width/2,y+.1,z),...P(x+width/2,y+.1,z+height-3),'#8f9787');px.line(g,...P(x-2,y+.1,z-1),...P(x+width+2,y+.1,z-1),'#dbc9a2',2);};
   if(!['wall'].includes(b.style)){
    for(let z=23;z<b.h-17;z+=30)for(let x=b.x+13;x<b.x+b.w-14;x+=26)windowFront(x,z,b.style==='palace'?13:9,b.style==='palace'?24:17);
    for(let z=24;z<b.h-16;z+=30)for(let y=b.y+14;y<b.y+b.d-15;y+=27){const x=b.x+b.w+.3;poly(g,[P(x,y,z),P(x,y+10,z),P(x,y+10,z+15),P(x,y+7,z+19),P(x,y+3,z+19),P(x,y,z+15)],'#304548');px.line(g,...P(x+.1,y-2,z-1),...P(x+.1,y+12,z-1),'#a8b49d');}
    windowFront(b.x+b.w*.48-6,0,15,25);
   }
   for(let z of[b.h-4,b.h-1]){px.line(g,...P(b.x-2,b.y+b.d+1,z),...P(b.x+b.w+2,b.y+b.d+1,z),'#e0cfaa',2);px.line(g,...P(b.x+b.w+1,b.y-1,z),...P(b.x+b.w+1,b.y+b.d+1,z),'#a7b1a1',2);}
   for(let yy=b.y+3;yy<b.y+b.d;yy+=7){px.line(g,...P(b.x+2,yy,b.h+.1),...P(b.x+b.w-2,yy,b.h+.1),shade(top,-.12));for(let xx=b.x+(((yy-b.y)/7|0)%2?4:0);xx<b.x+b.w-3;xx+=14)px.line(g,...P(xx,yy,b.h+.2),...P(xx,Math.min(yy+6,b.y+b.d-1),b.h+.2),shade(top,.12));}
   for(const[x,y,w,d]of[[b.x-1,b.y-1,b.w+2,3],[b.x-1,b.y,3,b.d],[b.x+b.w-2,b.y,3,b.d]])prism(g,P,x,y,b.h,w,d,3,'#d6c5a2','#9eab9a');
   if(b.climb){const xx=b.x+b.w*.3,yy=b.y+b.d+1;for(let z=4;z<b.h;z+=10){px.line(g,...P(xx-4,yy,z),...P(xx+4,yy,z),'#e5c783',2);px.line(g,...P(xx-4,yy,z+1),...P(xx+4,yy,z+1),'#b18b55');}}
   if(b.style==='palace'){for(let x=b.x+12;x<b.x+b.w-5;x+=28){prism(g,P,x,b.y+b.d-7,0,7,10,b.h-5,'#e1d0aa','#cdbb98');}prism(g,P,b.x+68,b.y+15,b.h,157,54,6,'#ccbc99','#a3a58e');}
   if(b.style==='tower'){const x=b.x+20,y=b.y+7;prism(g,P,x,y,b.h,30,30,31,'#c6a272','#b8b18f');for(let i=0;i<3;i++)windowFront(b.x+10+i*21,b.h-31,10,22);poly(g,[P(x-4,y-4,b.h+31),P(x+34,y-4,b.h+31),P(x+34,y+34,b.h+31),P(x-4,y+34,b.h+31),P(x+15,y+15,b.h+45)],'#6b958b');prism(g,P,x+14,y+14,b.h+33,2,2,15,'#f0d190','#b79a61');}
   return{c,x:ox,y:oy};
  }
  drawProp(r,p){const z=p.z||0;if(!r.visible(p.x,p.y,z,80,140,130))return;r.queue(p.x,p.y,z,g=>{const P=(x,y,zz)=>r.w(x,y,zz);if(p.type==='chimney'){prism(g,P,p.x,p.y,z,9,11,17,'#c9b798','#9e9985');prism(g,P,p.x-2,p.y-2,z+17,13,15,3,'#d2c3a2','#9ea28c');}else if(p.type==='crate'){prism(g,P,p.x,p.y,z,12,12,12,'#ac8a58','#806949');px.line(g,...P(p.x,p.y+12,z),...P(p.x+12,p.y+12,z+12),'#cab183');px.line(g,...P(p.x+12,p.y+12,z),...P(p.x,p.y+12,z+12),'#cab183');}else if(p.type==='pot'){const[sx,sy]=P(p.x,p.y,z);px.ell(g,sx,sy-6,5,7,'#a06c4f');for(let i=0;i<5;i++){const a=i*1.2;px.line(g,sx,sy-13,sx+Math.sin(a)*9,sy-18-Math.cos(a)*5,'#557968',2);}}else{const[sx,sy]=P(p.x,p.y,z);px.line(g,sx,sy,sx,sy-35,'#5a5748',2);px.rect(g,sx-4,sy-37,9,10,'#b08d50');px.rect(g,sx-2,sy-35,5,6,'#eed49a');px.line(g,sx-5,sy-38,sx+5,sy-38,'#4c4f43',2);r.glowDisc(g,sx,sy-32,12,'#ffc96c',.07);}});}
  draw(r,time,player){
   const key=this.key(r.view);if(this.viewKey!==key){this.viewKey=key;this.clear();}if(!this.floor)this.bakeFloor(r.view);
   r.sky(['#284954','#285862','#315e62']);
   for(let i=0;i<190;i++){const x=hash2(i,13)*1240-90,y=hash2(i,39)*1000-80;if(this.level.world.land(x,y)&&x>88&&x<952&&y<714)continue;const[sx,sy]=r.w(x+Math.sin(time*.4+i)*4,y,0);if(sx<0||sy<0||sx>r.W||sy>r.H)continue;const width=5+hash2(i,11)*17;px.line(r.ctx,sx,sy,sx+width,sy-2,i%4?'#45797a':'#74998c');}
   r.ctx.drawImage(this.floor.c,Math.round(this.floor.x-r.ix),Math.round(this.floor.y-r.iy));
   r._map=this.level.world;
   for(const b of this.level.world.buildings){if(b.enabled===false||!r.visible(b.x+b.w/2,b.y+b.d/2,b.h/2,280,260,300))continue;let st=this.bakes.get(b.id);if(!st){st=this.bakeBuilding(b,r.view);this.bakes.set(b.id,st);}const x=b.x+b.w,y=b.y+b.d;r.shadow(x-8,y-9,Math.max(b.w,b.d)*.49,.16,'#253f44');r.queue(x,y,0,g=>g.drawImage(st.c,Math.round(st.x-r.ix),Math.round(st.y-r.iy)),{occluder:true,box:[st.x-r.ix,st.y-r.iy,st.x-r.ix+st.c.width,st.y-r.iy+st.c.height]});}
   for(const b of this.level.world.bridges){r.queue(b.x+b.w,b.y+b.d,b.h,g=>{const P=(x,y,z)=>r.w(x,y,z);prism(g,P,b.x,b.y,b.h-3,b.w,b.d,3,'#a08a61','#766953');for(let x=b.x;x<b.x+b.w;x+=7)px.line(g,...P(x,b.y,b.h+.1),...P(x,b.y+b.d,b.h+.1),'#c1ac7b');for(const yy of[b.y,b.y+b.d])px.line(g,...P(b.x,yy,b.h+3),...P(b.x+b.w,yy,b.h+3),'#4a6864');},{bias:.05});}
   for(const p of this.level.props)this.drawProp(r,p);
   for(const h of this.level.hides){r.queue(h.x,h.y,h.z||0,g=>{const P=(x,y,z)=>r.w(x,y,z),z=h.z||0;if(h.kind==='garden'){for(let i=0;i<9;i++){const a=i*.8,pt=P(h.x+Math.cos(a)*10,h.y+Math.sin(a)*10,z+6);px.disc(g,...pt,7,i%2?'#597766':'#799270');}}else{prism(g,P,h.x-13,h.y-9,z,26,18,12,'#c6ad75','#8f7856');const a=P(h.x-16,h.y-10,z+27),b=P(h.x+16,h.y-10,z+27),c=P(h.x+17,h.y+12,z+16),d=P(h.x-17,h.y+12,z+16);poly(g,[a,b,c,d],h.kind==='cart'?'#a09978':'#d6c4a0');for(let i=1;i<5;i++)px.line(g,...[lerp(a[0],b[0],i/5),lerp(a[1],b[1],i/5)],...[lerp(d[0],c[0],i/5),lerp(d[1],c[1],i/5)],'#a79e7f');}}, {hides:true});}
   const P=(x,y,z)=>r.w(x,y,z);
   r.queue(779,315,0,g=>{prism(g,P,757,294,0,35,30,6,'#ded0ae','#9da796');prism(g,P,762,299,6,25,20,5,'#719c97','#a5b3a1');prism(g,P,772,306,10,6,6,24,'#dccba3','#a5aa91');const a=P(775,309,35);px.disc(g,...a,4,'#d6c296');});
   r.queue(179,766,-2,g=>{const pts=[[151,754,-1],[154,779,-1],[177,797,-1],[202,779,-1],[204,754,-1],[177,740,-1]].map(p=>P(...p));poly(g,pts,'#584d40');poly(g,[[159,756,0],[162,776,0],[178,787,0],[196,775,0],[197,755,0],[178,747,0]].map(p=>P(...p)),'#978361');px.line(g,...P(162,768,2),...P(196,768,2),'#bea57a',4);});
   for(const[x1,y1,z1,x2,y2,z2]of[[277,390,41,318,382,52],[316,647,55,344,631,59],[699,541,56,717,544,48]]){r.queue(x2,y2,z2,g=>{const a=P(x1,y1,z1),b=P(x2,y2,z2);px.line(g,...a,...b,'#626451');for(let i=1;i<5;i++){const u=i/5,x=lerp(x1,x2,u),y=lerp(y1,y2,u),z=lerp(z1,z2,u);poly(g,[P(x-3,y,z),P(x+4,y,z),P(x+5,y,z-10+Math.sin(time+i)),P(x-3,y,z-12)],i%2?'#d8ceaa':'#809790');}});}
   for(const b of this.birds){const x=b.x+Math.cos(time*.12+b.phase)*70,y=b.y+Math.sin(time*.12+b.phase)*40;const[sx,sy]=r.w(x,y,b.z);r.overlay(g=>{const flap=Math.sin(time*5+b.phase)*3;px.line(g,sx-5,sy+flap,sx,sy,'#20343c');px.line(g,sx,sy,sx+5,sy+flap,'#20343c');});}
  }
 }
 window.NacreWorld={makeLevel,CityArt,palette,prism};
})(window.My3D2dge);
