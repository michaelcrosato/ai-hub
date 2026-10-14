/* Authored room geometry and original animated dungeon apparatus. Public engine API only. */
(() => {
'use strict';
const D=globalThis.Dawn=globalThis.Dawn||{},E=globalThis.My3D2dge,px=E.px;
const THEMES={
  tide:{floor:'planks',field:'water',wall:'#6c9e98',deep:'#183f4e',light:'#b7cfb2',path:'#9b9c78',water:'#285e70',edge:'#294d59',roof:'#8c775b',flora:'#5f9582',sky:['#102936','#2c5861'],accent:'#d4b16c',glow:'#8ed7d2',prop:'tideWheel'},
  roots:{floor:'soil',field:'roots',wall:'#879870',deep:'#293d38',light:'#afc786',path:'#92976b',water:'#39877d',edge:'#3d5341',roof:'#6b6248',flora:'#658d52',sky:['#162b2b','#4b6750'],accent:'#cbbb72',glow:'#c1df97',prop:'rootArch'},
  mirrors:{floor:'glass',field:'void',wall:'#a7afb6',deep:'#263649',light:'#c7e0db',path:'#90a4ae',water:'#579aab',edge:'#495874',roof:'#786886',flora:'#9cabb0',sky:['#15233b','#4b4e70'],accent:'#d5b899',glow:'#c3e6ef',prop:'mirrorPanel'},
  storm:{floor:'metal',field:'void',wall:'#8199a4',deep:'#263647',light:'#bbc4b2',path:'#738b93',water:'#3e6c82',edge:'#40586b',roof:'#776953',flora:'#6b8586',sky:['#101e33','#475971'],accent:'#d1aa70',glow:'#8dceeb',prop:'stormCoil'},
  hollow:{floor:'mosaic',field:'mist',wall:'#758eab',deep:'#26324c',light:'#c5caba',path:'#7f99a7',water:'#486b8c',edge:'#455676',roof:'#887696',flora:'#729e97',sky:['#141c37','#45516d'],accent:'#dab98a',glow:'#b0ded7',prop:'hourRing'}
};
const theme=z=>THEMES[z.dungeonTheme]||THEMES[{bell642:'tide',seed112:'roots',glass1186:'mirrors',ash2310:'storm',fold:'hollow'}[z.era]]||THEMES.tide;
const meets=(c,f)=>!c||typeof c==='string'?(!c||!!f[c]):Array.isArray(c)?c.every(v=>meets(v,f)):(!c.flags||c.flags.every(k=>f[k]))&&(!c.notFlags||c.notFlags.every(k=>!f[k]));
const normalized=(v,tag)=>Array.isArray(v)?{x:v[0],y:v[1],w:v[2]||1,h:v[3]||1,tag:v[4]||tag}:v;
const FLOOR_CACHE=new Map();
function cacheFloor(world){
  const m=world.map,key=[world.zone.id,JSON.stringify(world.palette),m.w,m.h,m.T,m.ao,m.cells.join(','),m.floorTags.join(','),Array.from(m.blocked).join('')].join('|');
  world.floorCacheKey=key;world.floorCacheHit=FLOOR_CACHE.has(key);
  if(world.floorCacheHit){m.floors=FLOOR_CACHE.get(key);FLOOR_CACHE.delete(key);}
  FLOOR_CACHE.set(key,m.floors);while(FLOOR_CACHE.size>8)FLOOR_CACHE.delete(FLOOR_CACHE.keys().next().value);
}

function floorPainter(z,P){
  const p=theme(z),colors={planks:E.hex(p.path),stone:E.hex(p.path),soil:E.hex(E.mix(p.path,p.deep,.24)),roots:E.hex(p.deep),metal:E.hex(p.path),glass:E.hex(p.path),mosaic:E.hex(p.path),void:E.hex(p.sky[0]),mist:E.hex(E.mix(p.deep,p.water,.4)),water:E.hex(p.water),bridge:E.hex(E.mix(p.path,p.accent,.2)),path:E.hex(p.path)};
  return(x,y,tag)=>{
    const base=colors[tag]||colors[p.floor],n=E.hash2(x,y),mx=((Math.floor(x)%16)+16)%16,my=((Math.floor(y)%16)+16)%16;let light=n>.93?7:n<.08?-7:0;
    if(tag==='water'||tag==='mist'){const ripple=Math.sin(x*.15+y*.09)+Math.cos(y*.3);light+=(ripple>1.3?12:ripple<-.9?-8:0);}
    else if(tag==='void')light=n>.998?24:0;
    else if(tag==='planks'||tag==='bridge')light+=(my===0||my===1?-19:mx===0&&Math.floor(y/16)%2===0?-12:Math.floor(y)%5===0?-3:0);
    else if(tag==='metal')light+=(mx===0||my===0?-22:mx===2&&my===2?22:mx>4&&mx<11&&my%4===0?-7:0);
    else if(tag==='glass')light+=(mx===0||my===0?-17:mx===my||mx+my===15?12:0);
    else if(tag==='mosaic')light+=(mx===0||my===0?-17:(Math.abs(mx-7.5)+Math.abs(my-7.5)<3)?16:mx===7||my===7?5:0);
    else if(tag==='soil'||tag==='roots')light+=(Math.sin(x*.19+Math.sin(y*.07)*3)>.83?-11:Math.sin(y*.13+x*.035)>.92?7:0);
    else light+=(my%12===0||(mx===0&&Math.floor(y/12)%2===0)?-15:0);
    return[...base.map(v=>E.clamp(v+light,0,255)),tag==='glass'&&mx===my?.12:0];
  };
}

function build(world,rect){
  const z=world.zone,m=world.map,p=theme(z),L=typeof z.dungeonLayout==='string'?{preset:z.dungeonLayout}:z.dungeonLayout||{},preset=L.preset||['entry','passage','crossing','vault','heart'][(z.dungeonRoom||1)-1]||'entry';
  const floor=L.floor||p.floor,area=(x,y,w,h,tag=floor,blocked=false)=>rect(x,y,w,h,tag,blocked);
  const open=(x,y,w,h,tag=floor)=>{m.fill(x,y,w,h,0);area(x,y,w,h,tag,false);};
  const prop=(kind,x,y,o={})=>world.addProp(kind,(x+.5)*16,(y+.5)*16,{dungeon:true,...o});
  area(1,1,m.w-2,m.h-2,p.field,true);
  const rooms={entry:[[4,5,24,15],[12,2,8,7]],passage:[[4,6,7,14],[13,3,7,18],[22,6,7,14]],crossing:[[4,5,7,15],[14,3,6,18],[22,5,7,15]],vault:[[4,5,9,5],[20,5,9,5],[4,14,9,6],[20,14,9,6],[12,4,8,17]],heart:[[5,5,22,15],[11,3,11,18]]};
  for(const r of rooms[preset]||rooms.entry)open(...r);
  if(preset!=='heart'){
    if(z.dungeonTheme==='tide'){area(10,10,4,1,'water',true);area(19,14,4,1,'water',true);if(preset==='vault')area(12,5,2,2,'water',true);}
    else if(z.dungeonTheme==='roots'){area(10,10,4,1,'roots',true);area(19,14,4,1,'roots',true);area(10,5,4,2,'soil');}
    else if(z.dungeonTheme==='mirrors'){area(10,10,4,1,'glass');area(19,14,4,1,'glass');if(preset==='vault'){m.fill(11,5,2,2,3);m.fill(20,19,2,1,3);}}
    else if(z.dungeonTheme==='storm'){area(10,10,4,1,'void',true);area(19,14,4,1,'void',true);if(preset==='entry')area(19,5,2,2,'metal');}
    else{area(10,10,4,1,'mist',true);area(19,14,4,1,'mist',true);if(preset==='vault')area(11,5,2,2,'mist',true);}
  }
  // These corridors are part of each authored room. They are not cut to entities.
  // Content slots: A7,8 B16,7 C24,8 D8,15 E17,13 F24,16; W3,12 E28,12 N16,3 S16,20.
  const lanes=[[2,11,28,3],[15,2,3,20],[6,7,20,3],[6,15,20,4],[6,7,3,12],[23,7,3,12]];
  for(const [x,y,w,h]of lanes)open(x,y,w,h,preset==='crossing'?'bridge':floor);
  const blocks=preset==='entry'?[[3,3,7,2],[23,3,6,2],[3,20,8,2],[23,20,6,2]]:preset==='passage'?[[10,3,3,3],[19,4,3,3],[10,19,4,3],[19,19,3,3]]:preset==='crossing'?[[2,3,3,6],[27,3,3,6],[2,16,3,6],[27,16,3,6]]:preset==='vault'?[[3,3,10,2],[20,3,10,2],[3,20,10,2],[20,20,10,2]]:[[3,4,2,6],[27,4,2,6],[3,15,2,6],[27,15,2,6]];
  for(const [x,y,w,h]of blocks)m.fill(x,y,w,h,z.dungeonTheme==='roots'?1:3);
  if(z.dungeonTheme==='tide'){
    for(const [x,y]of [[3,6],[28,6],[3,18],[28,18]])prop('pressurePipe',x,y,{size:preset==='heart'?1.2:1});
    prop('tideWheel',preset==='passage'?19:12,5,{size:preset==='heart'?1.3:.9});
    if(preset==='crossing')for(const x of [11,20])prop('waterGate',x,10,{size:1.2});
    if(preset==='heart')prop('tideBell',16,5,{size:1.2});
  }else if(z.dungeonTheme==='roots'){
    for(const [x,y]of [[3,6],[28,6],[4,20],[27,20]])prop('rootArch',x,y,{size:preset==='heart'?1.4:1});
    for(const [x,y]of [[11,5],[20,5],[12,19],[20,19]])prop('seedPod',x,y,{size:.7});
    if(preset==='heart')prop('seedHeart',16,5,{size:1.4});
  }else if(z.dungeonTheme==='mirrors'){
    for(const [x,y]of [[4,5],[27,5],[4,19],[27,19]])prop('mirrorPanel',x,y,{size:preset==='vault'?1.2:1});
    for(const [x,y]of [[11,5],[20,5],[11,19],[20,19]])prop('prism',x,y,{size:.7});
    if(preset==='heart')prop('mirrorCrown',16,5,{size:1.25});
  }else if(z.dungeonTheme==='storm'){
    for(const [x,y]of [[3,6],[28,6],[3,19],[28,19]])prop('stormCoil',x,y,{size:preset==='heart'?1.3:1});
    prop('relayBank',12,5,{size:1.2});prop('relayBank',21,19,{size:.85});
    if(preset==='crossing')for(const x of [11,20])prop('cablePost',x,10,{size:.9});
    if(preset==='heart')prop('stormHeart',16,5,{size:1.35});
  }else{
    for(const [x,y]of [[4,5],[27,5],[4,20],[27,20]])prop('hourRing',x,y,{size:preset==='heart'?1.3:.9});
    for(const [x,y]of [[11,5],[21,5],[11,19],[21,19]])prop('memorySail',x,y,{size:.9});
    if(preset==='heart')prop('horizonLoom',16,5,{size:1.35});
  }
  // Choice results are visible props. They never change collision or cut a path.
  const consequence={
    depth_bell_dock:[['dp_tide_lanterns','guideLamp',11,9],['dp_tide_lanterns','guideLamp',21,9],['dp_tide_refuge','shelterBed',12,17],['dp_tide_refuge','shelterBed',20,17]],
    depth_glass_gallery:[['dp_tide_lanterns','guideLamp',11,9],['dp_tide_lanterns','guideLamp',21,9]],
    depth_ash_skywalk:[['dp_roots_bridge','livingBrace',11,10],['dp_roots_bridge','livingBrace',20,10]],
    depth_seed_canopy:[['dp_roots_garden','gardenBed',12,17],['dp_roots_garden','gardenBed',20,17]],
    depth_glass_foyer:[['dp_glass_public','recordDisplay',12,17],['dp_glass_private','quietAlcove',20,17]],
    depth_ash_camp:[['dp_storm_garden','gardenBed',12,17],['dp_storm_reserve','storedCells',20,17]],
    depth_fold_quay:[['far_shore_refuge','gardenBed',12,17],['far_shore_refuge','shelterBed',20,17],['far_shore_voyage','guideLamp',11,9],['far_shore_voyage','guideLamp',21,9]]
  };
  for(const [flag,kind,x,y]of consequence[z.id]||[])if(world.flags[flag])prop(kind,x,y,{size:.9,consequence:flag});
  const apply=spec=>{
    for(const v of spec.clear||[]){const a=normalized(v,floor);open(a.x,a.y,a.w||1,a.h||1,a.tag||floor);}
    for(const v of spec.areas||[]){const a=normalized(v,floor);if(meets(a.requires,world.flags))area(a.x,a.y,a.w||1,a.h||1,a.tag||floor,!!a.blocked);}
    for(const v of spec.walls||[]){const a=normalized(v,floor);if(meets(a.requires,world.flags))m.fill(a.x,a.y,a.w||1,a.h||1,a.type??1);}
    for(const a of spec.props||[])if(meets(a.requires,world.flags))prop(a.kind||a.name,a.x,a.y,a);
  };
  apply(L);for(const change of L.changes||[])if(meets(change.requires,world.flags))apply(change);
  world.dungeonPreset=preset;
}

const KNOWN=new Set(['pressurePipe','tideWheel','waterGate','tideBell','rootArch','seedPod','seedHeart','mirrorPanel','prism','mirrorCrown','stormCoil','relayBank','cablePost','stormHeart','hourRing','memorySail','horizonLoom','campKit','craftBench','trialSeal','echoPlate','rootSocket','relay','valve','knottedRope','braceStrut','guideLamp','shelterBed','livingBrace','gardenBed','recordDisplay','quietAlcove','storedCells']);
function apparatus(g,x,y,kind,p,t,o={}){
  const s=o.size||1,ink=p.deep,gold=o.color||p.accent,shine=o.active===false?E.mix(p.glow,p.deep,.5):p.glow;
  const rect=(xx,yy,w,h,c)=>px.rect(g,x+xx*s,y+yy*s,Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)),c);
  const line=(a,b,c,d,color,w=1)=>px.line(g,x+a*s,y+b*s,x+c*s,y+d*s,color,Math.max(1,Math.round(w*s)));
  const poly=(points,color)=>px.poly(g,points.map(([xx,yy])=>[x+xx*s,y+yy*s]),color);
  const ell=(xx,yy,rx,ry,color)=>px.ell(g,x+xx*s,y+yy*s,rx*s,ry*s,color);
  const diamond=(xx,yy,k=1)=>{poly([[xx,yy-14*k],[xx+9*k,yy-3*k],[xx,yy+9*k],[xx-9*k,yy-3*k]],ink);poly([[xx,yy-12*k],[xx+6*k,yy-3*k],[xx,yy+6*k],[xx-6*k,yy-3*k]],shine);line(xx,yy-10*k,xx,yy+4*k,'#e5edd5');};
  if(kind==='pressurePipe'||kind==='waterGate'){
    rect(-13,-29,7,29,ink);rect(6,-29,7,29,ink);rect(-11,-28,4,28,p.wall);rect(7,-28,4,28,p.wall);rect(-15,-30,30,6,gold);
    for(const yy of [-7,-20]){rect(-14,yy,10,3,gold);rect(4,yy,10,3,gold);}if(kind==='waterGate')for(let i=0;i<4;i++)rect(-4+i*3,-24,1,24,E.mix(shine,p.water,.5));
    else{ell(0,-28,9,7,ink);ell(0,-28,6,4,shine);for(let i=0;i<3;i++){const yy=-37-((t*8+i*10)%26);ell(-4+Math.sin(t+i)*6,yy,2,2,p.light);}}
  }else if(kind==='tideWheel'||kind==='valve'||kind==='tideBell'){
    rect(-4,-31,8,31,ink);rect(-2,-30,4,30,p.wall);ell(0,1,14,4,ink);rect(-11,-2,22,3,gold);
    if(kind==='tideBell'){poly([[-11,-10],[-8,-31],[0,-39],[8,-31],[11,-10]],gold);poly([[-6,-13],[-4,-30],[0,-34],[1,-13]],p.light);line(-14,-10,14,-10,ink,3);ell(0,-8+Math.sin(t*2),3,3,shine);}
    else{ell(0,-24,14,14,ink);ell(0,-24,11,11,gold);ell(0,-24,8,8,p.deep);for(let i=0;i<6;i++){const a=t*.27+i*Math.PI/3;line(0,-24,Math.cos(a)*10,-24+Math.sin(a)*10,p.light,2);}ell(0,-24,3,3,shine);}
  }else if(kind==='rootArch'){
    for(const side of [-1,1]){poly([[side*17,3],[side*12,-8],[side*16,-24],[side*10,-38],[side*4,-48],[side*1,-43],[side*7,-30],[side*6,-8]],ink);line(side*15,0,side*9,-30,gold,2);line(side*9,-30,side*2,-44,p.wall,2);}
    for(const [xx,yy,rx]of [[-13,-27,7],[11,-29,8],[-7,-40,8],[5,-45,9]]){ell(xx,yy,rx,6,p.flora);ell(xx-2,yy-2,rx*.65,3,p.light);}ell(1,-42+Math.sin(t)*1.5,3,4,shine);
  }else if(kind==='seedPod'||kind==='rootSocket'||kind==='seedHeart'){
    ell(0,0,17,5,ink);for(const sd of [-1,1]){poly([[0,0],[sd*16,-6],[sd*20,-22],[sd*9,-16]],p.flora);line(sd*3,-2,sd*15,-15,p.light);}
    const yy=-22+Math.sin(t*1.5)*1.5;ell(0,yy,11,18,ink);ell(0,yy-1,8,15,gold);ell(-2,yy-2,4,11,shine);line(0,-9,1,-34,p.light);
    if(kind==='seedHeart')for(let i=0;i<5;i++){const a=t*.3+i*1.25;ell(Math.cos(a)*24,-22+Math.sin(a)*10,2,2,shine);}
  }else if(kind==='mirrorPanel'||kind==='mirrorCrown'){
    rect(-15,-3,30,4,ink);rect(-12,-5,24,3,gold);poly([[-11,-6],[-13,-44],[0,-53],[13,-44],[11,-6]],ink);poly([[-8,-8],[-10,-42],[0,-49],[10,-42],[8,-8]],gold);poly([[-6,-10],[-7,-40],[0,-45],[7,-40],[6,-10]],p.water);
    poly([[-6,-38],[5,-42],[5,-34],[-5,-19]],shine);line(-5,-14,5,-26,p.light);if(kind==='mirrorCrown')for(let i=0;i<3;i++)diamond((i-1)*21,-38-Math.abs(i-1)*7,.55);
  }else if(kind==='prism'){
    ell(0,0,12,4,ink);rect(-7,-5,14,4,gold);diamond(0,-21+Math.sin(t*1.7)*2,1.2);line(-19,-14,19,-14,p.glow);
  }else if(kind==='stormCoil'||kind==='cablePost'||kind==='stormHeart'){
    rect(-13,-5,26,7,ink);rect(-10,-8,20,5,p.wall);rect(-4,-39,8,33,ink);rect(-2,-40,4,32,p.wall);
    for(let yy=-16;yy>=-35;yy-=6){ell(0,yy,10,4,ink);ell(0,yy-2,9,3,gold);}ell(0,-43,8,6,p.wall);ell(-2,-45,4,3,shine);
    if(Math.sin(t*8)>-.35){const n=Math.sin(t*21)*3;line(-16,-46,-9,-53,shine);line(-9,-53,-2+n,-48,shine);line(-2+n,-48,6,-56,shine);line(6,-56,17,-48,shine);}
    if(kind==='stormHeart'){line(-25,-29,-18,-35,p.glow,2);line(-18,-35,-11,-28,p.glow,2);line(11,-28,18,-37,p.glow,2);line(18,-37,25,-31,p.glow,2);}
  }else if(kind==='relayBank'||kind==='relay'){
    rect(-18,-31,36,32,ink);rect(-15,-29,30,28,p.wall);rect(-12,-25,24,11,p.deep);
    for(let i=0;i<4;i++){rect(-10+i*6,-22,3,6,Math.sin(t*3+i)>.2?shine:gold);line(-10+i*6,-11,-10+i*6,-2,ink);}line(-19,-6,19,-6,gold,2);rect(-3,-28,6,3,p.light);
  }else if(kind==='hourRing'||kind==='echoPlate'||kind==='horizonLoom'){
    const yy=-26+Math.sin(t*1.5)*2;ell(0,1,18,5,ink);ell(0,yy,18,23,ink);ell(0,yy,15,20,gold);ell(0,yy,12,17,p.deep);ell(0,yy,9,14,p.water);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*13,yy+Math.sin(a)*18,Math.cos(a)*16,yy+Math.sin(a)*21,p.light);}
    line(0,yy,Math.sin(t*.5)*8,yy-Math.cos(t*.5)*12,shine,2);ell(0,yy,2,2,shine);
    if(kind==='horizonLoom')for(const side of [-1,1]){rect(side*26-2,-42,4,42,gold);for(let i=0;i<5;i++)line(side*24,-37+i*6,side*7,yy-9+i*5,p.glow);}
  }else if(kind==='memorySail'){
    rect(-1,-42,3,42,gold);poly([[1,-40],[18,-34+Math.sin(t)*2],[12,-22],[19,-10],[2,-13]],p.wall);poly([[3,-35],[12,-30],[7,-22],[13,-15],[3,-17]],shine);line(-10,1,10,1,ink,3);
  }else if(kind==='knottedRope'){
    rect(-15,-30,5,31,ink);rect(10,-30,5,31,ink);rect(-13,-28,2,28,p.wall);rect(11,-28,2,28,p.wall);
    for(let i=0;i<5;i++){line(-12,-25+i*5,12,-7-i*3,gold,2);line(-12,-6-i*3,12,-25+i*5,p.light);}ell(0,-16,5,7,gold);line(-3,-20,4,-12,ink,2);
  }else if(kind==='braceStrut'){
    rect(-20,-31,40,6,p.wall);rect(-20,-31,40,2,gold);rect(-17,-25,5,27,ink);rect(12,-25,5,27,ink);line(-14,0,14,-25,gold,4);line(14,0,-14,-25,gold,4);rect(-4,-19,8,10,p.wall);ell(0,-15,2,2,shine);
  }else if(kind==='campKit'){
    poly([[-19,1],[-17,-12],[6,-12],[8,1]],ink);rect(-15,-11,20,10,p.wall);rect(-15,-10,4,8,p.light);line(7,0,19,0,gold,3);poly([[10,-2],[11,-13],[15,-7],[17,-16],[20,-3]],Math.sin(t*7)>.1?gold:shine);rect(11,-2,9,3,ink);
  }else if(kind==='craftBench'){
    rect(-17,-21,34,6,gold);rect(-14,-15,4,16,ink);rect(10,-15,4,16,ink);rect(-12,-33,5,12,p.wall);rect(3,-27,11,6,ink);line(8,-26,12,-35,p.light,3);ell(-3,-25,4,5,shine);line(-13,-10,13,-10,p.wall,2);
  }else if(kind==='trialSeal'){
    ell(0,0,16,5,ink);rect(-10,-5,20,4,gold);rect(-3,-19,6,14,p.wall);poly([[-12,-35],[-9,-23],[0,-17],[9,-23],[12,-35]],gold);ell(0,-35,12,4,p.light);diamond(0,-42+Math.sin(t*2),.6);
  }else if(kind==='guideLamp'){
    ell(0,1,10,3,ink);rect(-2,-32,4,33,gold);rect(-8,-34,16,4,ink);rect(-6,-31,12,15,gold);rect(-4,-29,8,11,shine);rect(-1,-29,2,11,p.light);poly([[-10,-35],[0,-41],[10,-35]],p.wall);line(0,-31,0,-18,ink);ell(0,-24,2+Math.sin(t*3)*.5,3,p.light);
  }else if(kind==='shelterBed'){
    poly([[-20,0],[-15,-15],[17,-15],[21,0]],ink);rect(-15,-13,31,11,p.wall);rect(-15,-13,8,10,p.light);rect(-4,-12,19,9,p.flora);line(-2,-11,13,-11,gold);rect(-18,-1,3,5,gold);rect(16,-1,3,5,gold);rect(23,-9,7,10,ink);rect(24,-8,5,5,gold);
  }else if(kind==='gardenBed'){
    poly([[-25,-4],[-19,-16],[23,-16],[27,-4]],ink);poly([[-22,-5],[-17,-13],[21,-13],[23,-5]],p.deep);line(-25,-3,27,-3,gold,3);line(-23,-4,-18,-15,p.wall,2);line(24,-4,21,-15,p.wall,2);
    for(let i=0;i<5;i++){const xx=-16+i*8,yy=-9-(i%2)*3,sway=Math.sin(t*1.1+i)*.8;line(xx,yy,xx+sway,yy-12,p.flora,2);poly([[xx,yy-6],[xx-7,yy-12],[xx-3,yy-14],[xx+sway,yy-9]],p.flora);poly([[xx,yy-8],[xx+6,yy-17],[xx+8,yy-13],[xx+sway,yy-7]],p.light);if(i%2===0)ell(xx+sway,yy-14,3,3,gold);}
  }else if(kind==='livingBrace'){
    line(-17,1,-10,-24,ink,8);line(17,1,10,-24,ink,8);line(-17,1,12,-27,p.flora,5);line(17,1,-12,-27,p.flora,5);line(-16,-27,16,-27,gold,5);for(const [xx,yy]of [[-12,-16],[12,-20],[-5,-8],[7,-12]]){ell(xx,yy,7,4,p.flora);line(xx-4,yy,xx+4,yy-1,p.light);}
  }else if(kind==='recordDisplay'||kind==='quietAlcove'){
    if(kind==='quietAlcove'){rect(-23,-31,5,33,ink);rect(18,-31,5,33,ink);rect(-23,-33,46,4,p.wall);poly([[-18,-29],[-12,-29],[-9,-5],[-18,0]],p.roof);poly([[18,-29],[12,-29],[9,-5],[18,0]],p.roof);}
    rect(-17,-20,34,5,gold);rect(-14,-15,4,17,ink);rect(10,-15,4,17,ink);poly([[-12,-22],[-12,-33],[-1,-30],[-1,-21]],p.light);poly([[1,-21],[1,-30],[12,-33],[12,-22]],'#e1d2ac');for(let i=0;i<3;i++){line(-10,-29+i*3,-3,-27+i*2,p.deep);line(3,-27+i*2,10,-29+i*3,p.deep);}if(kind==='recordDisplay'){rect(20,-21,3,22,gold);rect(17,-29,9,9,shine);}
  }else if(kind==='storedCells'){
    rect(-23,-5,46,6,ink);rect(-20,-24,40,19,p.wall);for(let i=0;i<4;i++){const xx=-15+i*10;rect(xx-4,-32,8,24,ink);rect(xx-3,-29,6,18,p.water);rect(xx-2,-27,3,14,shine);rect(xx-4,-32,8,3,gold);rect(xx-4,-10,8,3,gold);}line(-22,-6,22,-6,gold,2);
  }
}
function prop(r,p,world,app){
  if(!KNOWN.has(p.name))return false;const themeData=theme(world.zone),time=app.game.time;
  r.shadow(p.x,p.y,Math.max(10,15*(p.o.size||1)),.25);
  r.actor(p.x,p.y,p.z||0,(g,x,y)=>apparatus(g,x,y,p.name,themeData,time,p.o),{outline:true,rim:false,hides:true});return true;
}
function entity(r,e,world,app){
  if(!['field','mechanism','camp','craft','trials','trial'].includes(e.type))return false;
  const p=theme(world.zone),appearance=e.appearance||e.visual||e.mechanism?.appearance,abilityArt={cut:'knottedRope',resonate:'tideBell',brace:'braceStrut',grow:'rootSocket',reveal:'mirrorPanel',power:'relayBank'}[e.ability],puzzleArt={sluice:'tideWheel',mirror:'prism',circuit:'relayBank'}[e.puzzle?.kind];
  const kind=KNOWN.has(appearance)?appearance:e.type==='camp'?'campKit':e.type==='craft'?'craftBench':e.type==='trials'||e.type==='trial'?'trialSeal':abilityArt||puzzleArt||p.prop;
  const active=app.meets(e.requires),used=!!app.state.flags[e.completeFlag||e.flag||e.onceFlag];
  prop(r,{name:kind,x:e.x,y:e.y,z:0,o:{size:.82,active:active&&!used}},world,app);
  r.decal(()=>r.groundRing(e.x,e.y,11,used?p.wall:active?p.glow:p.deep,.42));
  if(app.nearest?.id===e.id&&e.name)r.textAt(e.x,e.y,54,e.name.toUpperCase(),p.light,{outline:p.deep});
  return true;
}
function backdrop(r,world){r.sky(theme(world.zone).sky);}
function ground(r,world,app){
  const p=theme(world.zone),key=world.zone.dungeonTheme,preset=world.dungeonPreset,cx=16*16,cy=12*16,large=preset==='heart',radius=large?92:38;
  r.decal(g=>{
    g.save();g.globalAlpha=large?.45:.25;
    const line=(x1,y1,x2,y2,color=p.accent,width=1)=>{const a=r.w(cx+x1,cy+y1,0),b=r.w(cx+x2,cy+y2,0);px.line(g,...a,...b,color,width);};
    if(key==='mirrors'){
      const corners=[[0,-radius],[radius,0],[0,radius],[-radius,0]];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];line(...a,...b,p.glow,2);line(a[0]*.6,a[1]*.6,b[0]*.6,b[1]*.6,p.accent);}
      line(-radius,-radius*.4,radius,radius*.4,p.light);line(-radius,radius*.4,radius,-radius*.4,p.light);
    }else if(key==='storm'){
      for(const y of [-1,1]){line(-radius,y*radius*.5,-radius*.35,y*radius*.5,p.glow,2);line(-radius*.35,y*radius*.5,-radius*.15,y*radius*.25,p.glow,2);line(-radius*.15,y*radius*.25,radius,y*radius*.25,p.glow,2);}
      for(const x of [-radius,0,radius]){line(x,-radius*.6,x,radius*.6,p.accent);line(x-3,-radius*.6,x+3,-radius*.6,p.light,2);}
    }else{
      r.groundRing(cx,cy,radius,p.accent,.6);r.groundRing(cx,cy,radius*.7,p.glow,.35);
      const points=key==='roots'?12:key==='tide'?8:6;
      for(let i=0;i<points;i++){const a=i*Math.PI*2/points,x=Math.cos(a)*radius,y=Math.sin(a)*radius;line(x*.8,y*.8,x*1.04,y*1.04,p.light,2);if(key==='roots'){const b=a+.23;line(x*.72,y*.72,Math.cos(b)*radius*.92,Math.sin(b)*radius*.92,p.glow);}}
      if(key==='hollow'){line(-radius*.7,0,radius*.7,0,p.glow);line(0,-radius*.7,0,radius*.7,p.glow);}
    }
    g.restore();
  });
}
function ambient(r,world,app){const p=theme(world.zone),t=app.game.time,key=world.zone.dungeonTheme;
  r.overlay(g=>{for(let i=0;i<16;i++){const x=(E.hash2(i,44)*r.W+t*(key==='storm'?12:2))%r.W,y=(E.hash2(i,72)*r.H+t*(key==='tide'?-5:key==='hollow'?-2:2)+r.H*12)%r.H;if(y>r.H-44)continue;
    if(key==='tide')px.ell(g,x,y,i%3===0?2:1,i%3===0?2:1,E.mix(p.glow,p.deep,.45));else if(key==='storm')px.line(g,x,y,x-2,y+4,p.water);else px.rect(g,x,y,i%4===0?2:1,1,i%3?p.accent:p.glow);
  }});
}
D.DungeonArt={palette:z=>theme(z),floorPainter,cacheFloor,build,prop,entity,backdrop,ground,ambient,theme};
})();
