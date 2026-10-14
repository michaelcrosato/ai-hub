/* The Lantern Roads, the Unwritten Coast, and the Rootbound Reach. Original terrain and travel. */
(function(root){
'use strict';
const E=root.My3D2dge, W=5200,H=3600,T=20,C=W/T,R=H/T,SW=960,SH=540;
const WATER=0,GRASS=1,FOREST=2,MOUNTAIN=3,SAND=4,SNOW=5,MARSH=6,BRIDGE=7,CLIFF=8;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const point=n=>[n.x,n.y], hash=(x,y)=>{let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const LOCATIONS=[
 ['morrowglass','Morrowglass',420,1420,'village','foot','The Lantern Coast'],
 ['waycamp','Wayfarer Camp',640,1140,'camp','foot','The Lantern Coast'],
 ['bracken','Bracken Post',1040,1170,'forest','foot','Glassroot Country'],
 ['reedfen','Reedfen Crossing',1180,1500,'marsh','foot','The Reedwater Fens'],
 ['cinderbridge','Cinderbridge',1670,1070,'bridge','foot','The Ember March'],
 ['foundry','Ember Foundry',1660,750,'foundry','foot','The Ember March'],
 ['saltmere','Saltmere Harbor',2290,1490,'port','foot','The Saltwater Reach'],
 ['tideglass','Tideglass Shrine',2910,1760,'ruins','ferry','The Summer Isles'],
 ['frostpass','Frostpass',2460,800,'pass','foot','The Northlight Range'],
 ['whitewake','Whitewake Abbey',2810,510,'city','foot','The Northlight Range'],
 ['observatory','Starfall Observatory',2100,450,'tower','foot','The Northlight Range'],
 ['orchard','The Old Orchard',590,600,'orchard','foot','The Amber Uplands'],
 ['moonwell','Moonwell Grove',1050,640,'well','foot','The Amber Uplands'],
 ['driftmarket','Driftmarket',3270,1040,'market','ferry','The Summer Isles'],
 ['quietvault','The Quiet Vault',3310,390,'vault','airship','The Crownless Cliffs'],
 ['dawnspire','Dawn Spire',3110,160,'spire','airship','The Crownless Cliffs'],
 ['gullwake','Gullwake Port',3820,1740,'port','airship','The Unwritten Coast'],
 ['rainweald','Rainweald Shelter',4020,1460,'forest','airship','The Unwritten Coast'],
 ['glasswater','Glasswater Locks',4360,1660,'ruins','airship','The Unwritten Coast'],
 ['palewind','Palewind Village',4320,1130,'village','airship','The Unwritten Coast'],
 ['stormloom','The Stormloom',4630,760,'tower','airship','The Unwritten Coast'],
 ['lastlight','Lastlight Isle',4840,2050,'spire','airship','The Far Lanterns'],
 ['hearthcross','Hearthcross',900,2900,'village','airship','The Rootbound Reach'],
 ['copperwood','Copperwood Aqueduct',1510,2680,'ruins','airship','The Copperwood'],
 ['mothlight','Mothlight Archive',2130,2940,'archive','airship','The Mothlight Woods'],
 ['sunkenstair','The Sunken Stair',2550,3300,'ruins','airship','The Stillwater Basin'],
 ['crownroot','Crownroot',3200,2850,'tree','airship','The Crownroot Highlands'],
 ['stillwater','Stillwater Camp',1830,3340,'village','airship','The Stillwater Basin'],
 ['duskobservatory','Dusk Observatory',4200,3210,'tower','airship','The Evening Isles']
].map(([id,name,x,y,kind,requires,region])=>({id,name,label:name,x,y,p:[x,y],kind,requires,region}));
const BY_ID=Object.fromEntries(LOCATIONS.map(n=>[n.id,n]));
const MAIN=[[155,1510],[195,1210],[260,1040],[205,870],[395,665],[445,465],[725,330],[930,275],[1130,350],[1450,275],[1780,320],[1940,245],[2220,260],[2570,335],[2800,360],[2940,530],[2900,770],[2750,995],[2730,1270],[2490,1500],[2570,1670],[2310,1780],[2090,1635],[1790,1680],[1550,1810],[1320,1730],[1090,1865],[835,1680],[575,1770],[345,1655]];
const EAST=[[3690,1840],[3620,1660],[3680,1490],[3710,1290],[3840,1150],[3860,980],[4050,820],[4250,900],[4410,720],[4480,550],[4640,480],[4810,580],[4930,850],[4880,1080],[4760,1240],[4820,1400],[4720,1610],[4550,1760],[4300,1870],[4100,1800],[3940,1930],[3790,1900]];
const SOUTH=[[540,2750],[650,2500],[920,2380],[1190,2460],[1450,2350],[1730,2430],[1960,2540],[2280,2530],[2490,2640],[2740,2540],[3060,2500],[3310,2610],[3490,2820],[3410,3050],[3210,3230],[2920,3230],[2740,3470],[2460,3525],[2260,3430],[2020,3510],[1780,3545],[1510,3430],[1270,3330],[1010,3240],[890,3070],[630,2970]];
const ISLANDS=[
 {id:'tideglass',poly:[[2700,1780],[2770,1625],[2925,1580],[3090,1690],[3150,1810],[3080,1925],[2915,1980],[2760,1900]]},
 {id:'driftmarket',poly:[[3045,1050],[3120,900],[3270,830],[3435,900],[3500,1050],[3405,1215],[3200,1230],[3070,1150]]},
 {id:'quietvault',cliff:true,poly:[[3120,435],[3185,295],[3340,260],[3470,350],[3500,465],[3350,595],[3190,555]]},
 {id:'dawnspire',cliff:true,poly:[[2985,145],[3020,70],[3115,35],[3230,100],[3270,205],[3170,270],[3020,235]]},
 {id:'lastlight',cliff:true,poly:[[4690,2070],[4730,1930],[4860,1900],[4980,1980],[5030,2090],[4920,2200],[4760,2190]]},
 {id:'duskobservatory',cliff:true,poly:[[3940,3260],[3970,3070],[4110,2940],[4300,2980],[4430,3140],[4410,3310],[4260,3420],[4060,3410]]}
];
const ROAD_ROUTES=[
 ['morrowglass',[480,1290],'waycamp'],['waycamp',[820,1160],'bracken'],['waycamp',[520,920],'orchard'],
 ['orchard',[790,610],'moonwell'],['moonwell',[1070,920],'bracken'],['bracken',[1170,1320],'reedfen'],
 ['bracken',[1340,1200],[1500,1140],'cinderbridge'],['cinderbridge',[1690,910],'foundry'],
 ['foundry',[1870,650],'observatory'],['observatory',[2290,555],'frostpass'],
 ['frostpass',[2630,650],'whitewake'],['cinderbridge',[1940,1190],[2070,1320],'saltmere'],
 ['saltmere',[2540,1300],[2550,1050],'frostpass'],['moonwell',[1350,705],'foundry'],
 ['gullwake',[3850,1620],'rainweald'],['rainweald',[4170,1530],'glasswater'],
 ['rainweald',[4170,1330],'palewind'],['glasswater',[4460,1500],[4480,1290],'palewind'],
 ['palewind',[4440,1050],[4550,940],'stormloom'],
 ['hearthcross',[1150,2830],'copperwood'],['copperwood',[1770,2760],[1950,2830],'mothlight'],
 ['hearthcross',[1170,3120],[1510,3250],'stillwater'],['mothlight',[2040,3140],'stillwater'],
 ['mothlight',[2360,3130],'sunkenstair'],['stillwater',[2180,3390],'sunkenstair'],
 ['mothlight',[2460,2830],[2800,2870],'crownroot'],['crownroot',[2990,3100],[2750,3240],'sunkenstair']
].map(route=>route.map(p=>typeof p==='string'?point(BY_ID[p]):p));
const RIVERS=[
 {width:31,points:[[1550,420],[1520,620],[1615,850],[1750,1010],[1630,1230],[1740,1510],[1860,1770]]},
 {width:22,points:[[1630,1230],[1450,1440],[1220,1590],[1100,1880]]},
 {width:26,points:[[80,1450],[210,1460],[365,1460],[435,1470]]},
 {width:27,points:[[2300,1560],[2510,1580],[2820,1500]]},
 {width:24,points:[[4210,980],[4240,1230],[4340,1440],[4310,1660],[4440,1890]]},
 {width:18,points:[[4340,1440],[4140,1590],[4050,1820]]},
 {width:25,points:[[1430,2380],[1450,2530],[1510,2750],[1780,2900],[1900,3100],[1840,3560]]},
 {width:18,points:[[1780,2900],[1570,3100],[1490,3480]]},
 {width:30,points:[[3300,2500],[3300,2660],[3100,2800],[2880,3090],[2750,3510]]}
];
const RIDGES=[[[1220,345],[1360,490],[1480,620],[1730,690],[1850,990]],[[2050,600],[2250,695],[2410,935],[2630,990]],[[4440,620],[4590,770],[4750,1080]],[[2440,2640],[2700,2740],[2910,2820],[3080,3000]],[[860,2500],[1050,2590],[1260,2530]]];
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c;}
function lineDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy);}
function routeDistance(x,y,points){let best=Infinity;for(let i=1;i<points.length;i++)best=Math.min(best,lineDistance(x,y,points[i-1],points[i]));return best;}
function ellipse(x,y,cx,cy,rx,ry){return ((x-cx)/rx)**2+((y-cy)/ry)**2<1;}
function index(x,y){return Math.floor(y/T)*C+Math.floor(x/T);}
function cellPoint(i){return [(i%C+.5)*T,(Math.floor(i/C)+.5)*T];}
function footType(t){return t!==WATER&&t!==MOUNTAIN&&t!==CLIFF;}
function components(terrain,predicate){
 const out=new Int16Array(C*R),sizes=[0],queue=new Int32Array(C*R);let count=0;
 for(let i=0;i<out.length;i++){if(out[i]||!predicate(terrain[i]))continue;let head=0,tail=0;count++;queue[tail++]=i;out[i]=count;
  while(head<tail){const k=queue[head++],x=k%C,y=Math.floor(k/C);for(const n of [x? k-1:-1,x<C-1?k+1:-1,y?k-C:-1,y<R-1?k+C:-1])if(n>=0&&!out[n]&&predicate(terrain[n])){out[n]=count;queue[tail++]=n;}}
  sizes[count]=tail;
 }return {ids:out,sizes};
}
function makeMap(){
 const terrain=new Uint8Array(C*R),roads=new Uint8Array(C*R),land=new Uint8Array(C*R),coast=new Uint8Array(C*R),biome=new Uint8Array(C*R);
 for(let cy=0;cy<R;cy++)for(let cx=0;cx<C;cx++){
  const i=cy*C+cx,x=(cx+.5)*T,y=(cy+.5)*T,main=inside(x,y,MAIN),east=!main&&inside(x,y,EAST),south=!main&&!east&&inside(x,y,SOUTH),isle=!main&&!east&&!south?ISLANDS.find(s=>inside(x,y,s.poly)):null;if(!main&&!east&&!south&&!isle)continue;
  land[i]=1;let t=GRASS;biome[i]=south?7:east?4:y<750&&x>1950?2:x<1130?1:3;
  if(isle?.cliff){t=CLIFF;const n=BY_ID[isle.id];if(Math.hypot(x-n.x,y-n.y)<(isle.id==='dawnspire'?78:105))t=GRASS;}
  else if(main){
   if(y<700&&x>2040)t=SNOW;
   if(ellipse(x,y,900,820,300,290)||ellipse(x,y,1000,1170,350,200)||ellipse(x,y,455,1010,150,210))t=FOREST;
   if(ellipse(x,y,1190,1480,285,205))t=MARSH;
   if(RIDGES.some(p=>routeDistance(x,y,p)<67+hash(cx,cy)*42))t=MOUNTAIN;
   if(RIVERS.some(r=>routeDistance(x,y,r.points)<r.width))t=WATER;
   if(t===MARSH&&hash(Math.floor(cx/3),Math.floor(cy/3))>.87)t=WATER;
  }else if(east){
   if(y<830&&x>4470){t=SNOW;biome[i]=6;}
   if(ellipse(x,y,3955,1480,305,220)||ellipse(x,y,4095,1170,210,190)){t=FOREST;biome[i]=5;}
   if(ellipse(x,y,4260,1695,220,155))t=MARSH;
   if(RIDGES.some(p=>routeDistance(x,y,p)<67+hash(cx,cy)*42))t=MOUNTAIN;
   if(RIVERS.some(r=>routeDistance(x,y,r.points)<r.width))t=WATER;
  }else if(south){
   if(ellipse(x,y,1420,2730,425,235)){t=FOREST;biome[i]=8;}
   if(ellipse(x,y,2160,2920,345,240)){t=FOREST;biome[i]=9;}
   if(ellipse(x,y,3180,2830,265,220)){t=FOREST;biome[i]=10;}
   if(ellipse(x,y,2550,3310,295,155)||ellipse(x,y,1830,3370,200,115))t=MARSH;
   if(RIDGES.some(p=>routeDistance(x,y,p)<61+hash(cx,cy)*36))t=MOUNTAIN;
   if(RIVERS.some(r=>routeDistance(x,y,r.points)<r.width))t=WATER;
  }else if(isle.id==='tideglass'&&ellipse(x,y,3010,1820,105,105))t=FOREST;
  terrain[i]=t;
 }
 // Roads are also the navigation mask: their bridges cross the generated rivers, never open ocean.
 for(let i=0;i<terrain.length;i++){if(!land[i])continue;const [x,y]=cellPoint(i);if(ROAD_ROUTES.some(p=>routeDistance(x,y,p)<25)){roads[i]=terrain[i]===WATER?2:1;terrain[i]=roads[i]===2?BRIDGE:GRASS;}}
 for(const n of LOCATIONS)for(let y=Math.floor((n.y-52)/T);y<=Math.floor((n.y+52)/T);y++)for(let x=Math.floor((n.x-52)/T);x<=Math.floor((n.x+52)/T);x++){
  if(x<0||y<0||x>=C||y>=R)continue;const i=y*C+x;if(Math.hypot((x+.5)*T-n.x,(y+.5)*T-n.y)<52){terrain[i]=n.kind==='city'||n.kind==='pass'?SNOW:GRASS;land[i]=1;}}
 for(let i=0;i<terrain.length;i++){if(!land[i]||terrain[i]===WATER||terrain[i]===CLIFF)continue;const x=i%C,y=Math.floor(i/C);if([x?i-1:-1,x<C-1?i+1:-1,y?i-C:-1,y<R-1?i+C:-1].some(n=>n<0||terrain[n]===WATER)){coast[i]=1;if(!roads[i]&&terrain[i]!==MOUNTAIN)terrain[i]=SAND;}}
 const foot=components(terrain,footType),sea=components(terrain,t=>t===WATER);let ocean=1;for(let i=2;i<sea.sizes.length;i++)if(sea.sizes[i]>sea.sizes[ocean])ocean=i;
 const docks=[];
 for(const id of ['morrowglass','saltmere','tideglass','driftmarket']){
  const n=BY_ID[id],region=foot.ids[index(n.x,n.y)],direction=id==='morrowglass'||id==='saltmere'?[0,1]:[-1,0];let best=null,score=Infinity;
  for(let i=0;i<terrain.length;i++){if(foot.ids[i]!==region||!coast[i])continue;const p=cellPoint(i),d=distance(p,point(n));if(d>390)continue;
   const cx=i%C,cy=Math.floor(i/C);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=C||yy>=R)continue;const j=yy*C+xx;if(sea.ids[j]!==ocean)continue;
    const value=d-(dx*direction[0]+dy*direction[1])*23;if(value<score){score=value;best={id,location:id,label:n.name+(n.name.endsWith(' Harbor')?'':' Harbor'),land:p,water:cellPoint(j),region};}}
  }if(!best)throw Error('No navigable harbor for '+id);docks.push(best);
 }
 return {width:W,height:H,tile:T,cols:C,rows:R,terrain,roads,coast,biome,land,foot:foot.ids,sea:sea.ids,ocean,docks};
}
const COLORS={water:'#254f68',deep:'#1f425d',foam:'#739d9c',grass:['#8b9a68','#929f6c','#98a372','#869766'],coastgrass:['#93a38c','#9aaa93','#a0ac98','#8d9e87'],southgrass:['#a2a174','#a8a77a','#b0ab80','#989b71'],forest:['#577f64','#64866a','#6e8b68'],rainforest:['#577e77','#608881','#6b8d7d'],copperforest:['#978453','#a18d59','#918359'],mothforest:['#667c77','#738780','#647b70'],sand:['#bfad78','#c7b783'],snow:['#bbccca','#c9d6d0','#afc2c1'],marsh:['#708d79','#7b9580','#6b8779'],mountain:['#697e83','#71888d','#61757f'],cliff:['#6b7179','#7a7b83','#616976']};
function poly(g,pts,color){g.fillStyle=color;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();}
function line(g,pts,color,width=1){g.strokeStyle=color;g.lineWidth=width;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}
function oval(g,x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
function tree(g,x,y,s=1,autumn=false,snow=false){
 oval(g,x+3*s,y+2*s,9*s,4*s,'#456554');g.fillStyle='#665642';g.fillRect(x-1.6*s,y-12*s,3*s,13*s);
 poly(g,[[x-12*s,y-5*s],[x-8*s,y-17*s],[x-3*s,y-21*s],[x,y-29*s],[x+8*s,y-20*s],[x+13*s,y-6*s],[x+5*s,y-1*s]],autumn?'#a18448':snow?'#64868a':'#416c58');
 poly(g,[[x-11*s,y-8*s],[x-6*s,y-18*s],[x,y-28*s],[x+4*s,y-17*s],[x+1*s,y-7*s]],autumn?'#d1a55a':snow?'#c7d6c9':'#739369');
 if(autumn)oval(g,x+5*s,y-11*s,5*s,5*s,'#b78642');
}
function roof(g,x,y,w,h,color='#aa7356'){
 g.fillStyle='#d9c29a';g.fillRect(x-w/2,y-h,w,h);g.fillStyle='#9a8870';g.fillRect(x+w*.16,y-h,w*.34,h);
 poly(g,[[x-w*.64,y-h],[x,y-h-18],[x+w*.65,y-h],[x+w*.38,y-h+8],[x-w*.37,y-h+8]],color);
 line(g,[[x-w*.62,y-h],[x,y-h-18],[x+w*.63,y-h]],'#e6bb79',2);g.fillStyle='#4f5b56';g.fillRect(x-4,y-13,8,13);g.fillStyle='#f2d995';g.fillRect(x-w*.31,y-h+11,5,7);
}
function landmark(g,n){
 const x=n.x,y=n.y;oval(g,x,y+6,46,15,'#647b60');oval(g,x,y+4,39,11,'#b6ab77');
 switch(n.kind){
  case 'village':roof(g,x-22,y,27,23);roof(g,x+17,y-9,32,33,'#4d8182');roof(g,x+37,y+8,21,21);g.fillStyle='#f3d890';g.fillRect(x+13,y-55,3,18);oval(g,x+14,y-55,4,5,'#f5d185');break;
  case 'camp':for(const [dx,dy,c] of [[-24,0,'#cc9b67'],[16,-10,'#709c95'],[28,14,'#cfb483']]){poly(g,[[x+dx-15,y+dy],[x+dx,y+dy-28],[x+dx+17,y+dy]],c);poly(g,[[x+dx-4,y+dy],[x+dx,y+dy-18],[x+dx+7,y+dy]],'#57665b');}oval(g,x-2,y+6,7,4,'#686150');poly(g,[[x-5,y+3],[x+1,y-12],[x+6,y+4]],'#f4c773');break;
  case 'forest':tree(g,x-30,y-1,1.45);tree(g,x+26,y-5,1.7);roof(g,x,y+8,31,21,'#567763');oval(g,x-22,y+8,6,6,'#dda865');oval(g,x+26,y+12,6,6,'#c68155');break;
  case 'marsh':g.fillStyle='#766849';g.fillRect(x-45,y-1,90,6);for(let i=-3;i<=3;i++){g.fillStyle='#b2a073';g.fillRect(x+i*13,y-2,8,7);}roof(g,x-17,y-8,30,25,'#557f70');roof(g,x+24,y+9,25,22,'#8a8060');for(const dx of [-35,37])line(g,[[x+dx,y+16],[x+dx+4,y-10]],'#91af85',3);break;
  case 'bridge':g.fillStyle='#655d4f';g.fillRect(x-48,y-5,96,16);g.fillStyle='#c0ac80';g.fillRect(x-48,y-10,96,10);for(let i=-3;i<=3;i++){g.fillStyle='#ecd19a';g.fillRect(x+i*14,y-14,6,8);}roof(g,x-29,y-12,25,20,'#8c6450');roof(g,x+33,y-12,25,20,'#8c6450');break;
  case 'foundry':roof(g,x-7,y+4,66,35,'#718285');for(const [dx,h] of [[-23,75],[21,61],[37,45]]){g.fillStyle='#6e7169';g.fillRect(x+dx-5,y-h,11,h-21);g.fillStyle='#a59679';g.fillRect(x+dx-6,y-h,13,7);}oval(g,x+4,y-14,13,11,'#615544');oval(g,x+4,y-13,8,7,'#ddb66d');line(g,[[x-38,y+14],[x+43,y+14]],'#aa9a70',5);break;
  case 'port':case 'market':roof(g,x-22,y+2,30,30,n.kind==='market'?'#ae736e':'#5a7f86');roof(g,x+14,y-7,37,40,n.kind==='market'?'#a59360':'#567781');roof(g,x+34,y+13,25,19,'#ceac70');g.fillStyle='#e6c387';g.fillRect(x-42,y+14,83,6);for(let i=-2;i<=2;i++){g.fillStyle=i%2?'#cfb775':'#619b91';g.fillRect(x+i*16-6,y-1,13,5);}break;
  case 'ruins':for(const dx of [-29,-10,12,32]){g.fillStyle='#809692';g.fillRect(x+dx-5,y-40+(dx%3)*4,10,42-(dx%3)*4);g.fillStyle='#c2d0b3';g.fillRect(x+dx-7,y-42+(dx%3)*4,14,6);}line(g,[[x-31,y-39],[x+9,y-46],[x+32,y-36]],'#d2d3b3',7);oval(g,x,y+3,16,6,'#5f9798');break;
  case 'pass':poly(g,[[x-44,y+7],[x-26,y-40],[x-7,y+4]],'#6d8790');poly(g,[[x+2,y+6],[x+27,y-51],[x+48,y+8]],'#667d8a');poly(g,[[x-36,y-15],[x-26,y-40],[x-16,y-14],[x-27,y-19]],'#d4dfd4');poly(g,[[x+15,y-28],[x+27,y-51],[x+39,y-23],[x+28,y-30]],'#e4e8d9');line(g,[[x-7,y+11],[x+6,y-15]],'#cfb279',5);break;
  case 'city':roof(g,x-24,y+5,27,31,'#63818e');roof(g,x+25,y+5,27,31,'#63818e');roof(g,x,y-9,35,54,'#56778b');poly(g,[[x-25,y-62],[x,y-78],[x+26,y-62]],'#d3e2dc');line(g,[[x-43,y+14],[x-43,y-8],[x+44,y-8],[x+44,y+14]],'#c9d5cd',7);break;
  case 'tower':g.fillStyle='#aaa98d';g.fillRect(x-22,y-44,44,44);g.fillStyle='#718b86';g.fillRect(x+4,y-44,18,44);oval(g,x,y-44,28,21,'#7b9d9a');poly(g,[[x-27,y-44],[x-17,y-60],[x,y-68],[x+17,y-60],[x+27,y-44]],'#9ac1b7');line(g,[[x+3,y-57],[x+24,y-81]],'#e6c88c',6);oval(g,x+24,y-81,7,3,'#789194');break;
  case 'archive':roof(g,x,y+3,72,40,'#667e78');for(const dx of [-31,31]){g.fillStyle='#bdbe9c';g.fillRect(x+dx-5,y-57,10,61);poly(g,[[x+dx-9,y-57],[x+dx,y-74],[x+dx+9,y-57]],'#8fa99b');}oval(g,x,y-18,11,18,'#3c6263');line(g,[[x-42,y+10],[x+42,y+10]],'#d4c391',5);for(const dx of [-16,16])oval(g,x+dx,y-30,3,5,'#f4db9b');break;
  case 'tree':for(const dx of [-36,-19,21,37])line(g,[[x,y-12],[x+dx,y+14]],'#746447',8);tree(g,x,y,3.5,true);for(const dx of [-30,-10,12,30]){line(g,[[x+dx,y-65],[x+dx,y-42]],'#d4b570',1.5);oval(g,x+dx,y-40,4,6,'#f2d99b');}line(g,[[x-42,y+7],[x+42,y+7]],'#d4c18c',4);break;
  case 'orchard':for(const [dx,dy] of [[-31,-4],[0,-23],[30,-1]])tree(g,x+dx,y+dy,1.1,true);roof(g,x,y+11,27,21,'#b5844d');for(let i=0;i<3;i++)oval(g,x-33+i*33,y-18-(i===1?21:0),3,3,'#efd27b');break;
  case 'well':for(const [dx,dy] of [[-31,-7],[32,-3]])tree(g,x+dx,y+dy,1.05);oval(g,x,y+4,27,11,'#7e9589');oval(g,x,y+1,24,10,'#ccceb0');oval(g,x,y,18,7,'#4b929b');oval(g,x-2,y-1,10,4,'#a9d8c4');g.fillStyle='#a8ac8d';g.fillRect(x-5,y-50,10,34);oval(g,x,y-54,13,13,'#dcd8ae');oval(g,x+5,y-57,11,11,'#739080');break;
  case 'vault':poly(g,[[x-42,y+4],[x-36,y-35],[x,y-67],[x+39,y-32],[x+44,y+4]],'#687986');poly(g,[[x-33,y-26],[x,y-58],[x+31,y-26]],'#9eaca3');g.fillStyle='#344e61';g.fillRect(x-17,y-29,34,33);line(g,[[x-18,y+3],[x-18,y-29],[x,y-41],[x+18,y-29],[x+18,y+3]],'#d2b982',4);oval(g,x,y-17,6,9,'#b5d7c9');break;
  case 'spire':for(const [dx,h] of [[-22,53],[22,61],[0,91]]){g.fillStyle=dx===0?'#c4cbb6':'#9aaea8';g.fillRect(x+dx-7,y-h,14,h);poly(g,[[x+dx-12,y-h],[x+dx,y-h-23],[x+dx+12,y-h]],'#d9c180');}oval(g,x,y-116,7,7,'#f3dea3');line(g,[[x-38,y+10],[x+39,y+10]],'#d8c799',5);break;
 }
 if(n.id==='gullwake'){line(g,[[x+47,y+15],[x+47,y-65]],'#d9c398',3);poly(g,[[x+48,y-61],[x+74,y-54],[x+49,y-45]],'#cf806d');line(g,[[x-40,y+21],[x-58,y+36],[x-7,y+36]],'#d6b780',5);}
 if(n.id==='rainweald'){line(g,[[x-35,y-26],[x,y-13],[x+34,y-28]],'#d5c89a',2);for(const dx of [-23,0,23])oval(g,x+dx,y-16-Math.abs(dx)*.25,3,4,'#f5da94');}
 if(n.id==='glasswater'){oval(g,x,y+15,39,9,'#456e76');for(const dx of [-20,0,20]){line(g,[[x+dx,y+7],[x+dx,y+20]],'#b4c6ad',4);line(g,[[x+dx-7,y+12],[x+dx+7,y+12]],'#e3cd9c',2);}}
 if(n.id==='palewind'){line(g,[[x-43,y+7],[x-43,y-42]],'#8c8164',6);line(g,[[x-59,y-58],[x-27,y-26]],'#e2d7b1',5);line(g,[[x-27,y-58],[x-59,y-26]],'#e2d7b1',5);oval(g,x-43,y-42,4,4,'#ad9065');}
 if(n.id==='stormloom'){for(const dx of [-32,32])line(g,[[x+dx,y+4],[x+dx,y-71],[x,y-89]],'#adad98',4);g.strokeStyle='#d8bf86';g.lineWidth=3;g.beginPath();g.ellipse(x,y-55,38,18,-.25,0,Math.PI*2);g.stroke();oval(g,x,y-54,10,13,'#b9d6d0');line(g,[[x-5,y-60],[x+3,y-54],[x-3,y-47]],'#f3e6b4',2);}
 if(n.id==='lastlight'){oval(g,x,y-111,20,20,'#7b9b9a');oval(g,x,y-112,13,14,'#e6d296');oval(g,x-2,y-115,7,9,'#fff2c0');line(g,[[x-16,y-99],[x+16,y-99]],'#d7c38e',4);}
 if(n.id==='hearthcross'){oval(g,x-4,y+9,9,5,'#5d6152');poly(g,[[x-9,y+8],[x-2,y-9],[x+5,y+8]],'#f0c87a');line(g,[[x-46,y-13],[x-46,y-47],[x-25,y-47]],'#c7af7a',3);oval(g,x-25,y-43,4,6,'#f8dfa2');}
 if(n.id==='copperwood'){for(const dx of [-42,-14,14,42]){g.fillStyle='#b7ad84';g.fillRect(x+dx-5,y-60,10,61);oval(g,x+dx,y-62,8,3,'#d7c79c');}line(g,[[x-48,y-61],[x+48,y-61]],'#dad1a9',7);line(g,[[x-45,y-60],[x+45,y-60]],'#79b5ad',3);tree(g,x-58,y+2,.85,true);}
 if(n.id==='sunkenstair'){oval(g,x,y+8,46,15,'#426f74');for(let i=0;i<5;i++)line(g,[[x-27+i*5,y-8+i*4],[x+28-i*5,y-8+i*4]],'#cbc9aa',3);g.strokeStyle='#a4c5b8';g.lineWidth=2;g.beginPath();g.ellipse(x,y+13,31,8,0,0,Math.PI);g.stroke();}
 if(n.id==='stillwater'){line(g,[[x-43,y+15],[x+46,y+15]],'#dac196',5);for(const dx of [-36,37])line(g,[[x+dx,y+13],[x+dx,y+27]],'#827459',4);oval(g,x-12,y+29,26,6,'#648f8c');}
 if(n.id==='duskobservatory'){line(g,[[x-10,y-44],[x-31,y-89]],'#cab391',10);oval(g,x-32,y-91,12,5,'#3d6875');line(g,[[x-32,y-91],[x-39,y-92]],'#e4d4a8',3);g.strokeStyle='#d2c299';g.lineWidth=2;g.beginPath();g.ellipse(x,y-55,43,24,-.2,0,Math.PI*2);g.stroke();}
 if(n.requires==='airship'){g.strokeStyle='#e3cd94';g.lineWidth=2;g.beginPath();g.ellipse(x,y+14,28,10,0,0,Math.PI*2);g.stroke();}
}
function makeArt(map,bounds={x:0,y:0,width:W,height:H},scale=1){
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width*scale);canvas.height=Math.ceil(bounds.height*scale);const g=canvas.getContext('2d');g.scale(scale,scale);g.translate(-bounds.x,-bounds.y);
 // Keep the old sea gradient in world coordinates. Chunks use the same brushes and geometry.
 const sea=g.createLinearGradient(0,0,5200,2400);sea.addColorStop(0,'#2e566b');sea.addColorStop(.52,'#285367');sea.addColorStop(1,'#173f59');g.fillStyle=sea;g.fillRect(0,0,W,H);
 const left=clamp(Math.floor((bounds.x-120)/T),0,C),right=clamp(Math.ceil((bounds.x+bounds.width+120)/T),0,C),top=clamp(Math.floor((bounds.y-120)/T),0,R),bottom=clamp(Math.ceil((bounds.y+bounds.height+120)/T),0,R);
 for(let row=top;row<bottom;row++)for(let col=left;col<right;col++){const i=row*C+col;
  const t=map.terrain[i],cx=i%C,cy=Math.floor(i/C),x=cx*T,y=cy*T,v=hash(cx,cy);if(t===WATER){if(v>.88)line(g,[[x+2,y+8],[x+7,y+6],[x+14,y+8]],v>.97?'#597f89':'#345f72',1);continue;}
  let colors=t===FOREST?(map.biome[i]===8?COLORS.copperforest:map.biome[i]===9?COLORS.mothforest:map.biome[i]===5?COLORS.rainforest:COLORS.forest):t===MOUNTAIN?COLORS.mountain:t===SNOW?COLORS.snow:t===MARSH?COLORS.marsh:t===SAND?COLORS.sand:t===CLIFF?COLORS.cliff:map.biome[i]>=7?COLORS.southgrass:map.biome[i]>=4?COLORS.coastgrass:COLORS.grass;
  g.fillStyle=colors[Math.floor(v*colors.length)];g.fillRect(x,y,T,T);
  if(map.coast[i]){g.fillStyle='#d1bc83';g.fillRect(x+2,y+2,T-4,T-4);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=cx+dx,yy=cy+dy;if(xx>=0&&yy>=0&&xx<C&&yy<R&&map.terrain[yy*C+xx]===WATER)line(g,[[x+(dx===1?T:dx===-1?0:1),y+(dy===1?T:dy===-1?0:1)],[x+(dx===1?T:dx===-1?0:T-1),y+(dy===1?T:dy===-1?0:T-1)]],'#8fbbb2',3);}}
  if(t===GRASS&&!map.roads[i]&&v>.53){for(let j=0;j<3;j++){const xx=x+3+hash(cx+j,cy+31)*14,yy=y+3+hash(cx+13,cy+j)*14;line(g,[[xx-2,yy],[xx,yy-3],[xx+2,yy]],map.biome[i]===1?'#b3b37a':'#a4ad75',1);}}
  if(t===MARSH){line(g,[[x+3,y+12],[x+12,y+12]],'#9ab1a1',1);for(let j=0;j<2;j++){const xx=x+5+j*7;line(g,[[xx,y+18],[xx-2,y+5]],'#a3b68b',1);}}
  if(t===CLIFF){line(g,[[x+4,y],[x+4,y+15],[x+8,y+19]],'#899294',2);}
 }
 g.lineJoin='round';g.lineCap='round';
 for(const route of ROAD_ROUTES){line(g,route,'#687f5f',14);line(g,route,'#cab581',10);line(g,route,'#dfca93',3);}
 // Break up the tile mask with trees and layered peaks, without adding new collision geometry.
 for(let cy=Math.max(1,top);cy<Math.min(R-1,bottom);cy++)for(let cx=Math.max(1,left);cx<Math.min(C-1,right);cx++){
  const i=cy*C+cx,t=map.terrain[i],x=cx*T+10,y=cy*T+15,v=hash(cx+71,cy+19);if(map.roads[i]||LOCATIONS.some(n=>Math.hypot(n.x-x,n.y-y)<68))continue;
  if(t===FOREST&&v>.23){tree(g,x+(v-.5)*9,y,.6+v*.32,map.biome[i]===8);if(map.biome[i]===9&&v>.72){oval(g,x-3,y+2,4,2,'#accbc0');oval(g,x+4,y-5,2,2,'#ebd59d');}}
  if(t===MOUNTAIN&&v>.37){const h=24+v*23;oval(g,x,y,18,6,'#5c7175');poly(g,[[x-22,y],[x-4,y-h],[x+6,y-h+7],[x+23,y]],'#536c79');poly(g,[[x-22,y],[x-4,y-h],[x+1,y-h+13],[x-5,y-8]],'#94a5a1');if(y<900)poly(g,[[x-12,y-h+17],[x-4,y-h],[x+6,y-h+7],[x+11,y-h+21],[x+2,y-h+15],[x-3,y-h+21]],'#d5ded0');}
  if(t===GRASS&&v>.986)tree(g,x,y,.58,map.biome[i]===1);
 }
 for(let i=0;i<map.roads.length;i++)if(map.roads[i]===2){const [x,y]=cellPoint(i);g.fillStyle='#6b6251';g.fillRect(x-12,y-11,24,22);g.fillStyle='#c4a671';g.fillRect(x-11,y-8,22,16);for(let dy=-6;dy<=6;dy+=5)line(g,[[x-10,y+dy],[x+10,y+dy]],'#e0bf82',1);}
 for(const d of map.docks){const a=d.land,b=d.water;line(g,[a,b],'#695e4b',14);line(g,[a,b],'#c6a879',9);for(const p of [a,b]){oval(g,p[0],p[1]+3,5,3,'#536e69');g.fillStyle='#e0c384';g.fillRect(p[0]-2,p[1]-12,4,13);oval(g,p[0],p[1]-15,4,5,'#f8df99');}}
 for(const n of [...LOCATIONS].sort((a,b)=>a.y-b.y))landmark(g,n);
 g.textAlign='center';g.font='italic 24px Georgia, serif';g.fillStyle='#75939b';g.fillText('The Blue Quiet',1750,2040);g.fillText('Crownwater',3310,1480);g.fillText('The Far Lanterns',4510,2235);g.font='italic 19px Georgia, serif';g.fillStyle='#b6b57e';g.fillText('Amber Uplands',805,440);g.fillStyle='#9cac9f';g.fillText('Northlight Range',2470,475);g.fillStyle='#bed0b2';g.font='italic 23px Georgia, serif';g.fillText('The Unwritten Coast',4180,1975);g.font='italic 18px Georgia, serif';g.fillStyle='#a9c3b0';g.fillText('Rainweald',3900,1260);g.fillStyle='#cad6cd';g.fillText('Stormglass Heights',4630,575);
 g.font='italic 24px Georgia, serif';g.fillStyle='#d6cf9d';g.fillText('The Rootbound Reach',2040,2590);g.font='italic 18px Georgia, serif';g.fillStyle='#d6bd86';g.fillText('Copperwood',1340,2865);g.fillStyle='#a9c3b0';g.fillText('Mothlight Woods',2170,3090);g.fillStyle='#c0cba9';g.fillText('Crownroot Highlands',2980,2625);g.font='italic 23px Georgia, serif';g.fillStyle='#8eafb0';g.fillText('The Evening Isles',4210,3505);
 return canvas;
}
class TerrainArt{
 constructor(map){this.map=map;this.chunkSize=512;this.padding=8;this.maxChunks=12;this.cache=new Map();this.overview=makeArt(map,undefined,.25);this.created=0;}
 chunk(cx,cy){const key=cx+','+cy;let canvas=this.cache.get(key);if(canvas){this.cache.delete(key);this.cache.set(key,canvas);return canvas;}if(this.cache.size>=this.maxChunks)this.cache.delete(this.cache.keys().next().value);const x=cx*this.chunkSize,y=cy*this.chunkSize,p=this.padding;canvas=makeArt(this.map,{x:x-p,y:y-p,width:Math.min(this.chunkSize,W-x)+p*2,height:Math.min(this.chunkSize,H-y)+p*2});this.cache.set(key,canvas);this.created++;return canvas;}
 draw(g,x,y,width,height){const s=this.chunkSize,p=this.padding;for(let cy=Math.max(0,Math.floor(y/s));cy<Math.min(Math.ceil(H/s),Math.ceil((y+height)/s));cy++)for(let cx=Math.max(0,Math.floor(x/s));cx<Math.min(Math.ceil(W/s),Math.ceil((x+width)/s));cx++){const canvas=this.chunk(cx,cy),left=Math.max(x,cx*s),top=Math.max(y,cy*s),right=Math.min(x+width,cx*s+canvas.width-p*2),bottom=Math.min(y+height,cy*s+canvas.height-p*2);if(right>left&&bottom>top)g.drawImage(canvas,left-cx*s+p,top-cy*s+p,right-left,bottom-top,left-x,top-y,right-left,bottom-top);}}
 stats(){let pixels=this.overview.width*this.overview.height;for(const c of this.cache.values())pixels+=c.width*c.height;return {chunkSize:this.chunkSize,padding:this.padding,maxChunks:this.maxChunks,cachedChunks:this.cache.size,createdChunks:this.created,overviewWidth:this.overview.width,overviewHeight:this.overview.height,pixelBytes:pixels*4,maxPixelBytes:(this.overview.width*this.overview.height+this.maxChunks*(this.chunkSize+this.padding*2)**2)*4};}
}
class Heap{
 constructor(){this.a=[];}push(i,f){const a=this.a;let k=a.length;a.push({i,f});while(k){const p=(k-1)>>1;if(a[p].f<=f)break;a[k]=a[p];k=p;}a[k]={i,f};}
 pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let k=0;while(true){let c=k*2+1;if(c>=a.length)break;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[k]=a[c];k=c;}a[k]=last;}return first.i;}get length(){return this.a.length;}
}
class MorrowOverworld{
 constructor(app){
  this.app=app;this.game=app.game;this.map=makeMap();this.terrain=this.map.terrain;this.docks=this.map.docks;this.art=new TerrainArt(this.map);this.canvas=this.art.overview;this.camera={x:0,y:0};this.minimap={x:759,y:388,width:184,height:112,visible:true};
  this.route=[];this.pending=null;this.active=false;this.facing=0;this.time=0;this.dirty=false;this.saveClock=0;this.discoveryClock=0;this.transition=0;this.walkTrail=[];this.wake=[];this.lastError='';
  const configs=[['ivo','#e2c394','#77482f','#3c9290'],['mina','#a16c4c','#dedccd','#c58b43'],['orrin','#d6ac84','#b9bab1','#756279']];this.rigs={};this.followers={};
  for(const [id,skin,hair,cloth] of configs)this.rigs[id]=new E.Humanoid({build:id==='orrin'?'bulky':'chibi',size:id==='orrin'?1.12:1.03,headR:4.1,hair:id==='mina'?'curly':'short',outfit:id==='mina'?'robe':'coat',sleeves:'long',cape:{len:5,width:4,seg:2},colors:{skin,hair,cloth,pants:'#40565d',boot:'#62503b',cape:cloth,capeIn:'#3b5e62',belt:'#d1b579'}});
  this._state();
 }
 get state(){return this.app.state.overworld;}
 get size(){return MorrowOverworld.size;}
 get path(){return this.route[0]?.points||[];}
 get moveTarget(){return this.path[0]||null;}
 set moveTarget(value){if(value===null)this.stop();else if(Array.isArray(value))this.click(this.toScreen(value));}
 get region(){const s=this.state;return LOCATIONS.reduce((best,n)=>distance(point(n),[s.x,s.y])<distance(point(best),[s.x,s.y])?n:best,LOCATIONS[0]).region;}
 _state(){const a=this.app.state;if(!a.overworld||typeof a.overworld!=='object')a.overworld={x:484,y:1420,mode:'foot',discovered:[]};const s=a.overworld;s.x=clamp(Number.isFinite(s.x)?s.x:484,8,W-8);s.y=clamp(Number.isFinite(s.y)?s.y:1420,8,H-8);if(!['foot','ferry','airship'].includes(s.mode)||!this._unlocked(s.mode))s.mode='foot';s.discovered=Array.isArray(s.discovered)?[...new Set(s.discovered.filter(id=>BY_ID[id]))]:[];if(!this.canTraverse(s.x,s.y,s.mode)){const p=this._nearest([s.x,s.y],s.mode);s.x=p[0];s.y=p[1];}return s;}
 _unlocked(mode){return mode==='foot'||this.app.state.campaign?.flags?.[mode]===true;}
 _location(id){return BY_ID[String(id||'').replace(/^travel:/,'')]||(['quay','garden','belfry'].includes(id)?BY_ID.morrowglass:null);}
 _notify(text){this.lastError=text;if(this.app.toast)this.app.toast(text);}
 _save(force=false){if(!this.dirty&&!force)return;if(this.app.save)this.app.save(false);this.dirty=false;this.saveClock=0;}
 _seedTrail(){const s=this.state;this.walkTrail=[[s.x,s.y]];if(s.mode!=='foot')return;for(let d=2;d<=72;d+=2){const p=[s.x-Math.cos(this.facing)*d,s.y-Math.sin(this.facing)*d];if(!this.canTraverse(...p,'foot'))break;this.walkTrail.push(p);}}
 enter(fromLocationId){
  const s=this._state(),n=this._location(fromLocationId);this.stop(false);this.active=true;
  if(n){const options=[[n.x,n.y+66],[n.x+64,n.y],[n.x-64,n.y],[n.x,n.y-64],point(n)],region=this.map.foot[index(n.x,n.y)];const p=options.find(p=>this.canTraverse(...p,'foot')&&this.map.foot[index(...p)]===region)||point(n);s.x=p[0];s.y=p[1];s.mode='foot';if(!s.discovered.includes(n.id))s.discovered.push(n.id);}
  this._seedTrail();for(const id of ['ivo','mina','orrin'])this.followers[id]={x:s.x,y:s.y,facing:this.facing};this._camera(1,true);this._discover();this.dirty=true;this._save();return this;
 }
 terrainAt(x,y){return x<0||y<0||x>=W||y>=H?-1:this.terrain[index(x,y)];}
 _pass(i,mode){return i>=0&&i<this.terrain.length&&(mode==='airship'||(mode==='ferry'?this.terrain[i]===WATER:footType(this.terrain[i])));}
 canTraverse(x,y,mode=this.state?.mode||'foot'){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<8||y<8||x>W-8||y>H-8)return false;if(mode==='airship')return true;const r=mode==='ferry'?6:5;
  return [[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].every(([dx,dy])=>this._pass(index(x+dx,y+dy),mode));
 }
 canLand(x,y){const t=this.terrainAt(x,y);return this.canTraverse(x,y,'foot')&&[GRASS,SAND,SNOW,BRIDGE].includes(t);}
 _nearest(p,mode,limit=Infinity,region=0){let best=null,d=limit;for(let i=0;i<this.terrain.length;i++){if(!this._pass(i,mode)||region&&this.map.foot[i]!==region)continue;const q=cellPoint(i),dd=distance(p,q);if(dd<d&&this.canTraverse(...q,mode)){d=dd;best=q;}}return best;}
 _clear(a,b,mode){
  if(!this.canTraverse(...a,mode)||!this.canTraverse(...b,mode))return false;if(mode==='airship')return true;
  // Inspect every grid crossing of the body footprint. Sampling at fixed distances can miss a clipped corner.
  const radius=mode==='ferry'?6:5,dx=b[0]-a[0],dy=b[1]-a[1];
  for(const [ox,oy] of [[0,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){
   const x=a[0]+ox,y=a[1]+oy,ts=[0,1];
   if(dx)for(let edge=(Math.floor(Math.min(x,x+dx)/T)+1)*T;edge<Math.max(x,x+dx);edge+=T)ts.push((edge-x)/dx);
   if(dy)for(let edge=(Math.floor(Math.min(y,y+dy)/T)+1)*T;edge<Math.max(y,y+dy);edge+=T)ts.push((edge-y)/dy);
   ts.sort((u,v)=>u-v);for(let i=0;i<ts.length;i++){const u=ts[i];if(!this._pass(index(x+dx*u,y+dy*u),mode))return false;if(i){const mid=(ts[i-1]+u)/2;if(!this._pass(index(x+dx*mid,y+dy*mid),mode))return false;}}
  }return true;
 }
 findPath(from,to,mode=this.state.mode){
  if(!this.canTraverse(...from,mode)||!this.canTraverse(...to,mode))return null;if(mode==='airship'||this._clear(from,to,mode))return [from.slice(),to.slice()];
  const start=index(...from),goal=index(...to),cost=new Float64Array(C*R),came=new Int32Array(C*R),closed=new Uint8Array(C*R),heap=new Heap();cost.fill(Infinity);came.fill(-1);cost[start]=0;heap.push(start,0);let reached=false;
  const gx=goal%C,gy=Math.floor(goal/C),heuristic=i=>{const dx=Math.abs(i%C-gx),dy=Math.abs(Math.floor(i/C)-gy);return (Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy))*.72;};
  while(heap.length){const i=heap.pop();if(closed[i])continue;if(i===goal){reached=true;break;}closed[i]=1;const x=i%C,y=Math.floor(i/C);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=C||yy>=R)continue;const j=yy*C+xx;if(closed[j]||!this._pass(j,mode)||dx&&dy&&(!this._pass(y*C+xx,mode)||!this._pass(yy*C+x,mode)))continue;
    const type=this.terrain[j],weight=mode==='ferry'?1:this.map.roads[j]?.72:type===FOREST?1.38:type===MARSH?1.7:type===SNOW?1.15:1,next=cost[i]+(dx&&dy?Math.SQRT2:1)*weight;
    if(next<cost[j]){cost[j]=next;came[j]=i;heap.push(j,next+heuristic(j));}}
  }if(!reached)return null;const reversed=[to.slice()];for(let k=goal;k!==start;k=came[k]){if(k<0)return null;reversed.push(cellPoint(k));}reversed.push(cellPoint(start),from.slice());reversed.reverse();
  const path=[reversed[0]];let anchor=reversed[0];for(let i=2;i<reversed.length;i++)if(!this._clear(anchor,reversed[i],mode)){path.push(reversed[i-1]);anchor=reversed[i-1];}path.push(to.slice());
  return path.every((p,i)=>!i||this._clear(path[i-1],p,mode))?path:null;
 }
 _phase(mode,points){return {mode,points:points.map(p=>p.slice())};}
 _route(phases,pending=null){this.route=phases.filter(p=>p.points?.length);this.pending=pending;this.lastError='';this._startPhase();return {ok:true,reason:''};}
 _startPhase(){const phase=this.route[0];if(!phase)return;const s=this.state;if(s.mode!==phase.mode){if(phase.points.length&&distance([s.x,s.y],phase.points[0])<=35){const p=phase.points.shift();s.x=p[0];s.y=p[1];}s.mode=phase.mode;this.transition=.45;this._seedTrail();this.dirty=true;this._save();this.game.audio?.sfx('whoosh',{vol:.3});}}
 _flight(n){
  const s=this.state,target=point(n),phases=[];let from=[s.x,s.y];
  if(s.mode==='ferry'){let best=null;for(const d of this.docks){const p=this.findPath(from,d.water,'ferry');if(p&&(!best||this._length(p)<this._length(best.path)))best={dock:d,path:p};}if(!best)return null;phases.push(this._phase('ferry',best.path),this._phase('foot',[best.dock.land]));from=best.dock.land;}
  phases.push(this._phase('airship',[from,target]),this._phase('foot',[target]));return phases;
 }
 _length(path){return path.reduce((sum,p,i)=>sum+(i?distance(path[i-1],p):0),0);}
 _seaRoute(n){
  const s=this.state,from=[s.x,s.y],target=point(n),destRegion=this.map.foot[index(...target)],startRegion=s.mode==='foot'?this.map.foot[index(...from)]:0;let best=null;
  const sources=s.mode==='ferry'?[null]:this.docks.filter(d=>d.region===startRegion),destinations=this.docks.filter(d=>d.region===destRegion);
  for(const a of sources)for(const b of destinations){const landA=a?this.findPath(from,a.land,'foot'):null;if(a&&!landA)continue;const water=this.findPath(a?a.water:from,b.water,'ferry'),landB=this.findPath(b.land,target,'foot');if(!water||!landB)continue;const score=(landA?this._length(landA):0)/185+this._length(water)/290+this._length(landB)/185;
   if(!best||score<best.score)best={score,phases:[...(a?[this._phase('foot',landA)]:[]),this._phase('ferry',water),this._phase('foot',landB)]};}
  return best?.phases||null;
 }
 goTo(id){
  const n=this._location(id);if(!n){this._notify('That destination is not on this chart.');return {ok:false,reason:this.lastError};}const s=this.state,from=[s.x,s.y],target=point(n);let phases=null;
  if(s.mode==='airship')phases=this._flight(n);
  else if(s.mode==='foot'&&this.map.foot[index(...from)]===this.map.foot[index(...target)]){const path=this.findPath(from,target,'foot');if(path)phases=[this._phase('foot',path)];}
  if(!phases&&n.requires==='airship'){if(!this._unlocked('airship')){this._notify('This shore needs an airship. The landing circles are marked on your atlas.');return {ok:false,reason:this.lastError};}phases=this._flight(n);}
  if(!phases&&(s.mode==='ferry'||this._unlocked('ferry')))phases=this._seaRoute(n);
  if(!phases&&this._unlocked('airship'))phases=this._flight(n);
  if(!phases){this._notify(this._unlocked('ferry')?'No safe route starts here. Return to a harbor or use an airship.':'The sea separates that shore. Restore a ferry route to travel there.');return {ok:false,reason:this.lastError};}
  return this._route(phases,n.id);
 }
 click(p){
  let target;const mini=this.minimap;if(mini.visible&&p[0]>=mini.x&&p[0]<=mini.x+mini.width&&p[1]>=mini.y&&p[1]<=mini.y+mini.height){const m=this.minimapLayout(mini);if(p[0]<m.x||p[0]>m.x+m.width||p[1]<m.y||p[1]>m.y+m.height)return {ok:false,reason:'Choose a point inside the map.'};target=[(p[0]-m.x)/m.scale,(p[1]-m.y)/m.scale];}else target=[p[0]+this.camera.x,p[1]+this.camera.y];
  target=[clamp(target[0],8,W-8),clamp(target[1],8,H-8)];const s=this.state,from=[s.x,s.y],region=s.mode==='foot'?this.map.foot[index(...from)]:0;
  if(!this.canTraverse(...target,s.mode))target=this._nearest(target,s.mode,130,region);const path=target&&this.findPath(from,target,s.mode);
  if(!path){this._notify(s.mode==='foot'?'Water and mountain faces block the path. Choose a road or a destination.':'There is no clear passage to that point.');return {ok:false,reason:this.lastError};}
  return this._route([this._phase(s.mode,path)]);
 }
 stop(save=true){const moving=this.route.length>0;this.route=[];this.pending=null;if(save&&moving){this.dirty=true;this._save();}}
 setMode(mode){
  if(!['foot','ferry','airship'].includes(mode))return {ok:false,reason:'Choose Foot, Ferry, or Airship.'};if(!this._unlocked(mode))return {ok:false,reason:mode==='ferry'?'Restore a ferry route before setting sail.':'Earn the airship before taking to the sky.'};
  const s=this.state,from=[s.x,s.y];if(s.mode===mode)return {ok:true,reason:''};
  if(mode==='airship'){if(s.mode==='ferry')return {ok:false,reason:'Dock the ferry before boarding the airship.'};this.stop(false);s.mode=mode;this.transition=.5;this.dirty=true;this._save();return {ok:true,reason:'The windship answers your lantern.'};}
  if(mode==='ferry'){
   if(s.mode==='airship')return {ok:false,reason:'Land beside a harbor before boarding the ferry.'};const region=this.map.foot[index(...from)];let best=null;
   for(const d of this.docks){if(d.region!==region||distance(from,point(BY_ID[d.id]))>320&&distance(from,d.land)>145)continue;const path=this.findPath(from,d.land,'foot');if(path&&(!best||this._length(path)<this._length(best.path)))best={dock:d,path};}
   if(!best)return {ok:false,reason:'Board at Morrowglass, Saltmere, Tideglass, or Driftmarket harbor.'};return this._route([this._phase('foot',best.path),this._phase('ferry',[best.dock.water])]);
  }
  if(s.mode==='airship'){if(!this.canLand(...from))return {ok:false,reason:'Land in an open clearing, on a road, or on a marked sky landing.'};this.stop(false);s.mode='foot';this._seedTrail();this.transition=.4;this.dirty=true;this._save();return {ok:true,reason:'Safely landed.'};}
  const d=this.docks.filter(d=>distance(from,d.water)<95).sort((a,b)=>distance(from,a.water)-distance(from,b.water))[0];const path=d&&this.findPath(from,d.water,'ferry');if(!d||!path)return {ok:false,reason:'Approach a marked harbor to disembark safely.'};return this._route([this._phase('ferry',path),this._phase('foot',[d.land])]);
 }
 toScreen(p){return [p[0]-this.camera.x,p[1]-this.camera.y];}
 nodes(){return LOCATIONS.map(n=>({...n,id:'travel:'+n.id,location:n.id,kind:'exit',p:this.toScreen(point(n)),discovered:this.state.discovered.includes(n.id)})).filter(n=>n.p[0]>-70&&n.p[0]<SW+70&&n.p[1]>40&&n.p[1]<SH+85);}
 near(){if(this.state.mode!=='foot')return null;const s=this.state;let best=null,d=79;for(const n of LOCATIONS){const dd=Math.hypot(s.x-n.x,s.y-n.y);if(dd<d&&this._clear([s.x,s.y],point(n),'foot')){d=dd;best={...n,id:'travel:'+n.id,location:n.id,kind:'exit',p:this.toScreen(point(n)),distance:dd};}}return best;}
 _discover(){let changed=false;const s=this.state;for(const n of LOCATIONS)if(Math.hypot(s.x-n.x,s.y-n.y)<185&&!s.discovered.includes(n.id)){s.discovered.push(n.id);changed=true;}if(changed){this.dirty=true;this._save();}}
 _camera(dt,snap=false){const s=this.state,tx=clamp(s.x-SW/2,0,W-SW),ty=clamp(s.y-300,0,H-SH),u=snap?1:1-Math.exp(-dt*7);this.camera.x=Math.round(this.camera.x+(tx-this.camera.x)*u);this.camera.y=Math.round(this.camera.y+(ty-this.camera.y)*u);}
 _move(dx,dy){const s=this.state,n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));let moved=false;for(let i=0;i<n;i++){const x=s.x+dx/n,y=s.y+dy/n;if(this.canTraverse(x,y,s.mode)){s.x=x;s.y=y;moved=true;}else{if(this.canTraverse(x,s.y,s.mode)){s.x=x;moved=true;}if(this.canTraverse(s.x,y,s.mode)){s.y=y;moved=true;}}}return moved;}
 _finishRoute(){const id=this.pending;this.pending=null;this.dirty=true;if(id){const n=BY_ID[id];if(!this.state.discovered.includes(id))this.state.discovered.push(id);this.state.x=n.x;this.state.y=n.y;this.state.mode='foot';this._save();this.active=false;if(this.app.enterLocation&&this.app.enterLocation(id)===false)this.active=true;}else this._save();}
 update(dt){
  this.time+=dt;this.transition=Math.max(0,this.transition-dt);this.saveClock+=dt;this.discoveryClock+=dt;let vx=0,vy=0;
  if(this.active&&!this.app.modal){
   const s=this.state,before=[s.x,s.y],input=this.game.input.move(),speed=s.mode==='airship'?395:s.mode==='ferry'?290:this.terrainAt(s.x,s.y)===FOREST?155:this.terrainAt(s.x,s.y)===MARSH?140:185;
   if(input[0]||input[1]){if(this.route.length)this.stop(false);const len=Math.hypot(...input),gait=s.mode==='foot'&&this.game.input.map?.run&&this.game.input.down('run')?1.55:1;this._move(input[0]/len*speed*gait*dt,input[1]/len*speed*gait*dt);}
   else if(this.route.length){const phase=this.route[0],p=phase.points[0];if(!p){this.route.shift();if(this.route.length)this._startPhase();else this._finishRoute();}
    else {const dx=p[0]-s.x,dy=p[1]-s.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);if(d<.8){s.x=p[0];s.y=p[1];phase.points.shift();}else if(!this._move(dx/d*step,dy/d*step)){this.stop(false);this._notify('The route is blocked. Choose another point.');}}}
   vx=(s.x-before[0])/(dt||1);vy=(s.y-before[1])/(dt||1);if(Math.hypot(vx,vy)>2){this.facing=Math.atan2(vy,vx);this.dirty=true;if(s.mode==='foot'){if(!this.walkTrail.length||distance([s.x,s.y],this.walkTrail[0])>2)this.walkTrail.unshift([s.x,s.y]);this.walkTrail.length=Math.min(this.walkTrail.length,100);}else{if(!this.wake.length||distance([s.x,s.y],this.wake[0])>9)this.wake.unshift([s.x,s.y,this.time]);this.wake.length=Math.min(this.wake.length,24);}}
   if(this.discoveryClock>.45){this.discoveryClock=0;this._discover();}if(this.dirty&&this.saveClock>6)this._save();
  }
  const s=this.state;for(const [id,behind] of [['ivo',0],['mina',27],['orrin',53]]){let p=[s.x,s.y],remain=behind;for(let i=1;i<this.walkTrail.length&&remain>0;i++){const a=this.walkTrail[i-1],b=this.walkTrail[i],d=distance(a,b);if(d>=remain){p=[a[0]+(b[0]-a[0])*remain/d,a[1]+(b[1]-a[1])*remain/d];remain=0;}else{remain-=d;p=b;}}this.followers[id]={x:p[0],y:p[1],facing:this.facing};this.rigs[id].update(dt,{x:p[0],y:p[1],z:0,facing:this.facing,vx,vy});}
  this._camera(dt);
 }
 _transport(g,sx,sy){
  const s=this.state,t=this.time;if(s.mode==='ferry'){
   g.save();g.translate(sx,sy);g.rotate(this.facing);oval(g,0,5,31,13,'#183c4a');poly(g,[[-29,-12],[18,-11],[35,0],[18,12],[-29,12],[-23,0]],'#584f3d');poly(g,[[-23,-8],[17,-7],[29,0],[17,8],[-23,8]],'#c3a273');line(g,[[-20,0],[26,0]],'#eed198',2);g.restore();
   line(g,[[sx-3,sy+3],[sx-3,sy-36]],'#d3b782',3);poly(g,[[sx,sy-33],[sx+23,sy-9],[sx,sy-4]],'#eedcb7');poly(g,[[sx-7,sy-29],[sx-24,sy-10],[sx-7,sy-8]],'#639d98');oval(g,sx-3,sy-38,3,3,'#ffe4a5');
  }else{
   oval(g,sx+9,sy+26,43,13,'#254d54');g.save();g.translate(sx,sy-22+Math.sin(t*2.1)*2);if(Math.cos(this.facing)<0)g.scale(-1,1);
   line(g,[[-22,9],[-15,27],[22,27],[28,8]],'#d6be86',2);poly(g,[[-28,25],[29,25],[22,35],[-18,35]],'#765840');line(g,[[-26,25],[29,25]],'#e6bf78',4);
   poly(g,[[-37,-9],[-59,-25],[-53,-3],[-38,7]],'#64928b');oval(g,0,0,48,23,'#bda269');oval(g,-2,-4,45,18,'#e2c288');oval(g,-5,-7,40,10,'#efdbac');
   for(const x of [-24,0,24])line(g,[[x,-19],[x-3,17]],'#9d875c',2);line(g,[[-41,6],[43,6]],'#7c9d90',5);oval(g,38,5,8,9,'#a9bcb0');
   const a=t*19;line(g,[[-36-Math.cos(a)*12,29-Math.sin(a)*7],[-36+Math.cos(a)*12,29+Math.sin(a)*7]],'#d8d4ae',3);oval(g,-36,29,3,3,'#715c45');g.restore();
  }
 }
 minimapLayout(rect=this.minimap){const scale=Math.min(rect.width/W,rect.height/H),width=W*scale,height=H*scale;return {x:rect.x+(rect.width-width)/2,y:rect.y+(rect.height-height)/2,width,height,scale};}
 drawMinimap(g,rect=this.minimap){
  if(rect.visible===false)return;const box=this.minimapLayout(rect),{x,y,width:w,height:h,scale}=box;g.save();g.fillStyle='rgba(13,34,45,.88)';g.fillRect(rect.x-7,rect.y-21,rect.width+14,rect.height+28);g.strokeStyle='#bcab79';g.lineWidth=1;g.strokeRect(rect.x-7.5,rect.y-21.5,rect.width+15,rect.height+29);g.drawImage(this.canvas,x,y,w,h);
  g.strokeStyle='#e8d795';g.lineWidth=1;g.strokeRect(x+this.camera.x*scale,y+this.camera.y*scale,SW*scale,SH*scale);
  for(const n of LOCATIONS){g.globalAlpha=this.state.discovered.includes(n.id)?1:.5;oval(g,x+n.x*scale,y+n.y*scale,2,2,n.requires==='airship'?'#d3c0ed':n.requires==='ferry'?'#bfe4df':'#efd49a');}g.globalAlpha=1;
  const s=this.state;oval(g,x+s.x*scale,y+s.y*scale,3.2,3.2,'#fff3c0');g.font='600 10px sans-serif';g.fillStyle='#eadcae';g.textAlign='left';g.fillText('THE LANTERN ROADS',rect.x,rect.y-8);g.textAlign='right';g.fillText(s.discovered.length+' / '+LOCATIONS.length,rect.x+rect.width,rect.y-8);g.restore();return box;
 }
 drawAtlas(g,width,height){
  const scale=Math.min((width-28)/W,(height-46)/H),w=W*scale,h=H*scale,x=(width-w)/2,y=(height-h)/2-4;g.save();g.fillStyle='#172f3f';g.fillRect(0,0,width,height);g.drawImage(this.canvas,x,y,w,h);g.strokeStyle='#c2b282';g.lineWidth=1;g.strokeRect(x-1,y-1,w+2,h+2);
  const labels=[],font=width<760?10:11,lineHeight=font+3,markers=LOCATIONS.map(n=>({x:x+n.x*scale-5,y:y+n.y*scale-5,width:10,height:10}));g.font='600 '+font+'px sans-serif';
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width+3,b.x+b.width+3)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height+2,b.y+b.height+2)-Math.max(a.y,b.y));
  for(const n of LOCATIONS){
   const xx=x+n.x*scale,yy=y+n.y*scale,seen=this.state.discovered.includes(n.id),lines=[];let current='';
   for(const word of n.name.split(' ')){const next=current?current+' '+word:word;if(current&&g.measureText(next).width>(width<760?88:112)){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);
   const lw=Math.max(...lines.map(t=>g.measureText(t).width)),lh=lines.length*lineHeight;let best=null,bestScore=Infinity;
   for(const gap of [10,24,40,58,78,104])for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const bx=clamp(dx===0?xx-lw/2:dx>0?xx+gap:xx-gap-lw,7,width-lw-7),by=clamp(dy===0?yy-lh/2:dy>0?yy+gap:yy-gap-lh,6,height-lh-31),box={x:bx,y:by,width:lw,height:lh};
    const collision=[...labels,...markers].reduce((sum,b)=>sum+overlap(box,b),0),separation=Math.hypot(bx+lw/2-xx,by+lh/2-yy),score=collision*1000+separation;if(score<bestScore){best=box;bestScore=score;}
   }
   labels.push({...best,id:n.id});const cx=clamp(xx,best.x,best.x+best.width),cy=clamp(yy,best.y,best.y+best.height);
   if(Math.hypot(cx-xx,cy-yy)>13)line(g,[[xx,yy],[cx,cy]],'#91a69a',.75);
   oval(g,xx,yy,seen?4:3,seen?4:3,seen?'#f8dfa0':'#b2c8bc');g.textAlign='left';g.lineWidth=3;g.strokeStyle='#1c3a47';g.fillStyle=seen?'#f8e8bd':'#d4ddcc';
   lines.forEach((text,i)=>{const ty=best.y+font+i*lineHeight;g.strokeText(text,best.x,ty);g.fillText(text,best.x,ty);});
  }
  const s=this.state;oval(g,x+s.x*scale,y+s.y*scale,5,5,'#ffffff');oval(g,x+s.x*scale,y+s.y*scale,2.5,2.5,'#4f9694');g.textAlign='center';g.font='12px sans-serif';g.fillStyle='#d2c79c';g.fillText('Gold roads · Lantern harbors · High-cliff landing circles',width/2,height-9);g.restore();return {x,y,width:w,height:h,scale,labels};
 }
 terrainArtStats(){return this.art.stats();}
 drawTerrain(g,x=this.camera.x,y=this.camera.y,width=SW,height=SH){this.art.draw(g,x,y,width,height);}
 draw(r){
  const g=r.ctx,c=this.camera,s=this.state;g.save();g.imageSmoothingEnabled=false;this.drawTerrain(g,c.x,c.y,SW,SH);
  for(let i=0;i<13;i++){const x=(hash(i,97)*W+this.time*5)%W,y=hash(i,111)*H;if(this.terrainAt(x,y)!==WATER)continue;const p=this.toScreen([x,y]);if(p[0]>-20&&p[0]<SW+20&&p[1]>0&&p[1]<SH){g.globalAlpha=.25+Math.sin(this.time+i)*.12;line(g,[[p[0]-12,p[1]],[p[0],p[1]+2],[p[0]+14,p[1]]],'#b6d2c0',1);}}g.globalAlpha=1;
  if(this.route.length){g.save();g.setLineDash([5,7]);g.lineDashOffset=-this.time*12;const pts=[[s.x,s.y],...this.route[0].points].map(p=>this.toScreen(p));line(g,pts,'rgba(252,229,160,.78)',2);g.restore();const end=this.route[this.route.length-1]?.points.at(-1);if(end){const p=this.toScreen(end);g.strokeStyle='#f5dea1';g.lineWidth=2;g.beginPath();g.ellipse(p[0],p[1],10+Math.sin(this.time*4)*2,5,0,0,Math.PI*2);g.stroke();}}
  for(const d of this.docks){const p=this.toScreen(d.land);if(p[0]<-20||p[0]>SW+20||p[1]<0||p[1]>SH)continue;g.globalAlpha=.18+Math.sin(this.time*2)*.06;oval(g,p[0],p[1]-13,12,12,'#ffe6a3');g.globalAlpha=1;}
  if(s.mode==='ferry')for(const p of this.wake){const age=this.time-p[2];if(age>1.8)continue;const q=this.toScreen(p);g.globalAlpha=(1-age/1.8)*.35;g.strokeStyle='#c1d9c3';g.lineWidth=1;g.beginPath();g.ellipse(q[0],q[1],10+age*9,3+age*4,0,0,Math.PI*2);g.stroke();}g.globalAlpha=1;g.restore();
  if(s.mode==='foot')for(const id of ['orrin','mina','ivo']){
   const a=this.followers[id]||s,p=this.toScreen([a.x,a.y]),wp=this.game.view.toGround(p[0]+r.ix,p[1]+r.iy);r.shadow(wp[0],wp[1],8,.32);r.actor(wp[0],wp[1],0,(ctx,ox,oy)=>this.rigs[id].draw(ctx,ox,oy,r.view),{outline:true,rim:true});
  }else r.overlay(ctx=>{const p=this.toScreen([s.x,s.y]);this._transport(ctx,...p);});
  r.overlay(ctx=>{this.drawMinimap(ctx);if(this.transition>0){ctx.save();ctx.globalAlpha=this.transition*.12;ctx.fillStyle='#fbe1aa';ctx.fillRect(0,0,SW,SH);ctx.restore();}});
 }
}
MorrowOverworld.locations=LOCATIONS;MorrowOverworld.size=Object.assign([W,H],{width:W,height:H});MorrowOverworld.TERRAIN={WATER,GRASS,FOREST,MOUNTAIN,SAND,SNOW,MARSH,BRIDGE,CLIFF};
root.MorrowOverworld=MorrowOverworld;if(typeof module!=='undefined'&&module.exports)module.exports=MorrowOverworld;
})(typeof window!=='undefined'?window:globalThis);
