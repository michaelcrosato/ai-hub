/* Original Hearthbound places, settlement structures, and wax-bound creatures. */
(() => {
'use strict';
const D=globalThis.Dawn,E=globalThis.My3D2dge,px=E.px;
const THEMES={
  haven:{grass:'#6c875f',deep:'#294f49',light:'#c7cf9a',path:'#b8a381',water:'#427b8a',wall:'#b7ac8e',roof:'#af7056',flora:'#6c9464',edge:'#3f6351',sky:['#527e89','#d4b998'],accent:'#e0ba76',glow:'#a4d7b2',floor:'grass',wallFace:'hedge',wallRoof:'leaves',wallHeight:18},
  clock:{grass:'#777969',deep:'#453f45',light:'#d2c6a4',path:'#af9c80',water:'#526d81',wall:'#b1a38d',roof:'#a16f55',flora:'#859a72',edge:'#66675a',sky:['#56677a','#d9b79b'],accent:'#d5a55f',glow:'#b8d6c2',floor:'clockstone',wallFace:'timber'},
  tide:{grass:'#6e9380',deep:'#28505d',light:'#ccddbb',path:'#a5b7a0',water:'#327b91',wall:'#8faeaa',roof:'#86755c',flora:'#659785',edge:'#3f706f',sky:['#315c78','#a9c4be'],accent:'#d7bd7f',glow:'#b0e3d4',floor:'sandstone',wallFace:'stone'},
  forge:{grass:'#737073',deep:'#383e4b',light:'#d0bba4',path:'#8f8982',water:'#964f38',wall:'#9c8c7a',roof:'#7f584e',flora:'#758879',edge:'#51525a',sky:['#323f57','#b37c62'],accent:'#e8af68',glow:'#ffd09b',floor:'iron',wallFace:'stone'},
  roots:{grass:'#5d8259',deep:'#294f43',light:'#b8d296',path:'#9e9c6c',water:'#438a7d',wall:'#8f9f77',roof:'#637652',flora:'#629659',edge:'#3c6747',sky:['#38656b','#c1d29f'],accent:'#dbbf70',glow:'#d1e4a5',floor:'moss',wallFace:'hedge',wallRoof:'leaves'},
  ink:{grass:'#62767c',deep:'#2b3e57',light:'#e3d9bc',path:'#c1b79e',water:'#4b607d',wall:'#b5b4ac',roof:'#827496',flora:'#819d96',edge:'#576780',sky:['#303a5a','#b8afc4'],accent:'#d0ab7e',glow:'#b8d7df',floor:'paper',wallFace:'plaster'},
  signal:{grass:'#5c7d79',deep:'#1d424a',light:'#c2d6b9',path:'#88a09a',water:'#44798c',wall:'#93aaa4',roof:'#516c70',flora:'#6ba08b',edge:'#3c656a',sky:['#284c69','#9cbeb9'],accent:'#d8b884',glow:'#9ae6ce',floor:'circuit',wallFace:'stone'},
  hearth:{grass:'#876f76',deep:'#393a4d',light:'#e4cfad',path:'#c0a991',water:'#4a526c',wall:'#b4a5a3',roof:'#9b6864',flora:'#9e8b7c',edge:'#676075',sky:['#2b3351','#bc938e'],accent:'#e7b276',glow:'#f5d2ac',floor:'waxstone',wallFace:'plaster'}
};
const palette=z=>THEMES[z.hearthTheme]||THEMES.haven;
const meets=(c,f)=>!c?true:typeof c==='string'?!!f[c]:Array.isArray(c)?c.every(v=>meets(v,f)):(!c.flags||c.flags.every(id=>f[id]))&&(!c.notFlags||c.notFlags.every(id=>!f[id]));
const rectSpec=(a,tag)=>Array.isArray(a)?{x:a[0],y:a[1],w:a[2]||1,h:a[3]||1,tag:a[4]||tag}:a;
const projectLevel=(id,flags)=>flags['project_'+id+'_2']?2:flags['project_'+id+'_1']?1:0;
const PROJECT_CHOICES={
  workshop:[['hb_mira_open_plans','openBook',-1],['hb_mira_clear_plans','paperStack',-1],['hb_mira_common_clock','clock',1],['hb_mira_travel_clock','parcelCart',1]],
  inn:[['hb_soren_quiet_room','bedroll',-1],['hb_soren_song_table','songTable',-1],['hb_kett_quiet','flowerbed',1],['hb_kett_supper','kitchen',1]],
  observatory:[['hb_brann_wide_stair','steps',-1],['hb_brann_low_deck','deck',-1],['hb_brann_starbook','starBook',1],['hb_brann_weatherbook','weatherBook',1]],
  garden:[['hb_ilex_old_names','oldNames',-1],['hb_ilex_new_names','newNames',-1],['hb_ilex_shared_fruit','fruitBasket',1],['hb_ilex_seed_store','seedCrate',1]],
  archive:[['hb_nyx_writing_desks','writingDesk',-1],['hb_nyx_listening_table','songTable',-1],['hb_nyx_corrected_file','paperStack',1],['hb_nyx_new_volume','openBook',1]],
  dock:[['hb_vale_long_calls','signalMast',-1],['hb_vale_call_schedule','clock',-1],['hb_vale_quiet_departures','signalLamp',1],['hb_vale_shared_departures','bench',1]]
};
function floorPainter(z,P){
  const p=palette(z),colors={grass:E.hex(p.grass),moss:E.hex(p.grass),soil:E.hex(E.mix(p.deep,p.path,.4)),path:E.hex(p.path),bridge:E.hex(E.mix(p.path,p.accent,.25)),planks:E.hex(E.mix(p.path,p.roof,.16)),clockstone:E.hex(p.path),sandstone:E.hex(p.path),iron:E.hex(p.path),paper:E.hex(p.path),circuit:E.hex(p.path),waxstone:E.hex(p.path),water:E.hex(p.water),void:E.hex(p.deep),wax:E.hex(E.mix(p.light,p.accent,.28)),ember:E.hex('#b35f3e')};
  return(x,y,tag)=>{const c=colors[tag]||colors[p.floor],xx=Math.floor(x),yy=Math.floor(y),mx=(xx%16+16)%16,my=(yy%16+16)%16,n=E.hash2(xx,yy);let q=n>.94?7:n<.08?-7:0,glow=0;
    if(tag==='grass'||tag==='moss')q+=E.hash2(Math.floor(xx/5),Math.floor(yy/4))>.6?4:-3;
    else if(tag==='water'){q+=Math.sin(xx*.08+yy*.19)>.8?11:-2;}
    else if(tag==='ember'){q+=Math.sin(xx*.18+Math.cos(yy*.16))>.4?17:-10;glow=.18;}
    else if(tag==='void')q=n>.995?20:0;
    else if(tag==='planks'||tag==='bridge')q+=my===0?-22:mx===0&&Math.floor(yy/16)%2===0?-14:my%5===0?-4:0;
    else if(tag==='iron'||tag==='circuit'){q+=mx===0||my===0?-21:mx===2&&my===2?20:0;if(tag==='circuit'&&((mx===6&&my>4)||(my===5&&mx>5))){q+=12;glow=.035;}}
    else if(tag==='paper')q+=my===0||mx===0?-16:my===3&&mx>3&&mx<12?7:my%4===0&&mx>4&&mx<11?-7:0;
    else if(tag==='waxstone')q+=mx===0||my===0?-17:Math.abs(mx-7)+Math.abs(my-7)<4?9:0;
    else if(tag==='soil')q+=my%5===0?-8:1;
    else if(tag==='wax')q+=Math.sin(xx*.08+Math.sin(yy*.13)*2)>0?8:-2;
    else q+=yy%10===0||(xx+Math.floor(yy/10)*8)%20===0?-18:0;
    return[...c.map(v=>E.clamp(v+q,0,255)),glow];};
}
function build(w,rect){
  const z=w.zone,m=w.map,p=palette(z),key=z.hearthTheme,L=z.hearthLayout||{},preset=L.preset||'approach',prop=(name,x,y,o={})=>w.addProp('hb_'+name,(x+.5)*16,(y+.5)*16,{...o,hearth:true});
  const area=(x,y,ww,hh,tag=p.floor,blocked=false)=>rect(x,y,ww,hh,tag,blocked),open=(x,y,ww,hh,tag=p.floor)=>{m.fill(x,y,ww,hh,0);area(x,y,ww,hh,tag,false);};
  area(1,1,30,22,p.floor);
  if(key==='haven'){
    area(1,1,30,22,'grass');area(2,2,28,6,'path');area(4,10,24,3,'path');area(14,7,4,15,'path');area(5,15,20,5,'path');area(25,8,3,11,'planks');area(28,8,3,12,'water',true);
    for(const x of [5,10,15,20,25])area(x,4,3,8,'path');
    for(const [x,y]of [[3,3],[29,3],[3,19],[28,21]])prop('tree',x,y,{size:1.1});
    prop('hearth',17.5,15.5,{size:.8});prop('banner',4,10,{color:'#ca8f6c'});prop('banner',28,8,{color:'#91b9b4'});prop('bench',9.5,20.5);prop('bench',21,20.5);prop('well',4,16,{size:.7});
    for(const [x,y]of [[4,21],[12,21],[22,21]])prop('flowerbed',x,y,{size:.85});
    if(w.flags.hearth_feast_square)prop('feastTable',16.5,20.5,{consequence:'hearth_feast_square'});
    if(w.flags.hearth_feast_doors)for(const [x,y]of [[6,7],[11,7],[21,7],[26,7]])prop('guideLamp',x,y,{size:.7,consequence:'hearth_feast_doors'});
  }else{
    if(key==='clock'){
      area(12,2,2,20,'water',true);area(19,10,3,6,'planks');m.fill(3,2,7,3,2);m.fill(23,2,6,3,2);m.fill(3,20,8,2,3);m.fill(23,20,6,2,3);
      for(const [x,y]of [[4,6],[27,6]])prop('clock',x,y,{size:preset==='heart'?1.3:1});prop('gearBench',11,5);prop('gearBench',21,19);if(preset==='heart')prop('greatClock',16,5,{size:1.15});else prop('awning',21,5);
    }else if(key==='tide'){
      area(1,1,30,22,'water',true);open(5,3,22,18,'sandstone');area(10,10,4,5,'water',true);area(20,4,2,16,'water',true);m.fill(3,3,2,6,3);m.fill(27,3,2,6,3);
      prop('well',16,5,{size:preset==='heart'?1.45:1});for(const [x,y]of [[3,8],[28,8],[3,19],[28,19]])prop('reedBell',x,y);prop('boat',21,19);if(preset==='heart'){prop('echoShell',11,5);prop('echoShell',24,5);}else prop('awning',8,5);
    }else if(key==='forge'){
      area(2,2,28,20,'iron');area(10,10,4,5,'ember',true);area(20,10,3,5,'ember',true);m.fill(3,3,8,2,3);m.fill(22,3,7,2,3);m.fill(3,20,8,2,3);m.fill(22,20,7,2,3);
      for(const [x,y]of [[4,7],[28,7],[4,18],[28,18]])prop('furnace',x,y,{size:preset==='heart'?1.2:.85});prop('starAnvil',16,5,{size:preset==='heart'?1.3:1});prop('beamStack',21,19);prop('telescope',11,5,{size:.75});
    }else if(key==='roots'){
      area(9,3,5,17,'soil');area(19,3,4,17,'soil');area(2,13,3,7,'water',true);m.fill(3,2,9,3,1);m.fill(22,2,7,3,1);m.fill(3,20,8,2,1);m.fill(23,20,6,2,1);
      for(const [x,y]of [[4,7],[28,7],[4,18],[28,18]])prop('tree',x,y,{size:preset==='heart'?1.3:1});for(const [x,y]of [[11,5],[21,5],[12,19],[21,19]])prop('flowerbed',x,y);if(preset==='heart')prop('fruitTree',16,5,{size:1.3});else prop('rootGate',16,5);
    }else if(key==='ink'){
      area(1,1,30,22,'paper');area(11,3,3,18,'water',true);area(21,3,2,18,'water',true);m.fill(3,3,7,2,3);m.fill(24,3,5,2,3);m.fill(3,20,8,2,3);m.fill(23,20,6,2,3);
      for(const [x,y]of [[4,7],[28,7],[4,18],[28,18]])prop('bookcase',x,y,{size:preset==='heart'?1.2:.85});prop('openBook',16,5,{size:preset==='heart'?1.35:1});prop('paperStack',11,19);prop('paperStack',22,19);prop('inkQuill',11,5,{size:.8});
    }else if(key==='signal'){
      area(1,1,30,22,'void',true);open(4,4,25,17,'circuit');area(10,10,4,5,'void',true);area(20,10,3,5,'void',true);m.fill(3,3,8,2,3);m.fill(23,3,6,2,3);m.fill(3,20,8,2,3);m.fill(23,20,6,2,3);
      for(const [x,y]of [[4,7],[28,7]])prop('signalMast',x,y,{size:preset==='heart'?1.3:1});prop('relay',16,5,{size:preset==='heart'?1.45:1});prop('parcelCart',11,19);prop('parcelCart',22,19);prop('signalLamp',11,5);
    }else{
      area(1,1,30,22,'void',true);open(4,3,25,18,'waxstone');area(10,10,4,5,'wax',true);area(20,10,3,5,'wax',true);m.fill(3,3,8,2,3);m.fill(23,3,6,2,3);m.fill(3,20,8,2,3);m.fill(23,20,6,2,3);
      for(const [x,y]of [[4,7],[28,7],[4,18],[28,18]])prop('waxPillar',x,y,{size:preset==='heart'?1.3:1});prop(preset==='heart'?'deedTable':'deedGate',16,5,{size:1.2});prop('paperStack',11,19);prop('paperStack',22,19);
    }
    // Authored shared lanes keep the declared A–F slots and door arrivals clear.
    for(const [x,y,ww,hh]of [[2,11,28,3],[15,2,3,20],[6,7,20,3],[6,15,20,4],[6,7,3,12],[23,7,3,12]]){
      for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+ww;xx++){const old=m.floorAt(xx*16+8,yy*16+8);m.set(xx,yy,0);m.setFloor(xx,yy,['water','void','ember'].includes(old)?'bridge':p.floor,false);}
    }
    if(preset==='heart')for(const [x,y]of [[3,10],[28,10]])prop('banner',x,y,{color:p.accent});
  }
  const arc={clock:'mira',tide:'soren',forge:'brann',roots:'ilex',ink:'nyx',signal:'vale'}[key];
  if(arc&&w.flags['hearth_'+arc+'_complete']){prop('guideLamp',12,17,{consequence:'hearth_'+arc+'_complete'});prop(key==='roots'?'flowerbed':'bench',20,17,{consequence:'hearth_'+arc+'_complete'});}
  if(key==='hearth'&&w.flags.hearthbound_complete){prop('hearth',12,17,{consequence:'hearthbound_complete'});prop('flowerbed',20,17,{consequence:'hearthbound_complete'});}
  const apply=s=>{for(const v of s.clear||[]){const a=rectSpec(v,p.floor);open(a.x,a.y,a.w||1,a.h||1,a.tag||p.floor);}for(const v of s.areas||[]){const a=rectSpec(v,p.floor);if(meets(a.requires,w.flags))area(a.x,a.y,a.w||1,a.h||1,a.tag||p.floor,!!a.blocked);}for(const v of s.walls||[]){const a=rectSpec(v);if(meets(a.requires,w.flags))m.fill(a.x,a.y,a.w||1,a.h||1,a.type??1);}for(const a of s.props||[])if(meets(a.requires,w.flags))prop(a.kind||a.name,a.x,a.y,a);};
  apply(L);for(const change of L.changes||[])if(meets(change.requires,w.flags))apply(change);w.hearthPreset=preset;
}
function painter(g,x,y,p,t,o={}){
  const s=o.size||1,ink=p.deep,gold=o.color||p.accent,lit=o.ready===false?E.mix(p.glow,p.deep,.65):p.glow;
  return{s,ink,gold,lit,R:(a,b,w,h,c)=>px.rect(g,x+a*s,y+b*s,Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)),c),L:(a,b,c,d,k,w=1)=>px.line(g,x+a*s,y+b*s,x+c*s,y+d*s,k,Math.max(1,Math.round(w*s))),P:(points,c)=>px.poly(g,points.map(([a,b])=>[x+a*s,y+b*s]),c),O:(a,b,rx,ry,c)=>px.ell(g,x+a*s,y+b*s,rx*s,ry*s,c)};
}
function object(g,x,y,name,p,t,o={}){
  const {R,L,P,O,ink,gold,lit}=painter(g,x,y,p,t,o),leaf=p.flora;
  const lamp=(xx,yy=0)=>{R(xx-2,yy-32,4,33,gold);R(xx-7,yy-32,14,14,ink);R(xx-5,yy-30,10,10,lit);P([[xx-10,yy-34],[xx,yy-41],[xx+10,yy-34]],p.roof);};
  const book=(xx,yy,sz=1)=>{P([[xx-11*sz,yy],[xx-11*sz,yy-13*sz],[xx,yy-10*sz],[xx,yy+2*sz]],p.light);P([[xx,yy+2*sz],[xx,yy-10*sz],[xx+11*sz,yy-13*sz],[xx+11*sz,yy]],'#d8c59f');for(let i=0;i<3;i++){L(xx-8*sz,yy-9*sz+i*3,xx-2*sz,yy-7*sz+i*2,ink);L(xx+2*sz,yy-7*sz+i*2,xx+8*sz,yy-9*sz+i*3,ink);}};
  const flower=(xx,yy,fruit=false)=>{const sway=Math.sin(t*.8+xx)*.8;L(xx,yy,xx+sway,yy-14,leaf,2);P([[xx,yy-5],[xx-8,yy-10],[xx-4,yy-13],[xx,yy-8]],leaf);P([[xx,yy-8],[xx+6,yy-16],[xx+8,yy-11],[xx,yy-5]],p.light);O(xx+sway,yy-15,fruit?4:2,fruit?4:2,gold);};
  if(name==='tree'||name==='fruitTree'||name==='rootGate'){
    L(-9,1,0,-31,ink,9);L(9,1,0,-31,ink,8);L(0,-13,-17,-43,gold,4);L(0,-19,17,-46,gold,4);L(0,0,0,-42,p.wall,5);
    for(const [xx,yy,rx]of [[-16,-39,17],[16,-40,18],[0,-57,21]]){O(xx,yy,rx,14,ink);O(xx-1,yy-3,rx-2,11,leaf);O(xx-5,yy-6,rx*.6,6,p.light);}
    if(name==='fruitTree')for(const [xx,yy]of [[-20,-43],[12,-44],[3,-61],[23,-35],[-4,-29]])O(xx,yy,3,4,gold);
    if(name==='rootGate'){L(-18,3,-12,-26,gold,4);L(18,3,12,-26,gold,4);L(-14,-27,14,-27,leaf,4);}
  }else if(name==='flowerbed'||name==='forage'){
    O(0,0,23,5,ink);if(name==='flowerbed'){P([[-25,-2],[-19,-14],[23,-14],[27,-2]],p.roof);L(-23,-2,25,-2,gold,3);}
    if(o.ready===false){for(const xx of [-14,-6,3,12])L(xx,-2,xx+1,-8,leaf,2);O(1,-5,3,2,p.path);}
    else if(o.ingredient?.includes('grain')){for(const xx of [-15,-7,1,9,16]){const yy=-2-Math.abs(xx)*.1;L(xx,yy,xx+Math.sin(t+xx),yy-22,leaf);for(let j=0;j<4;j++){L(xx,yy-10-j*3,xx-4,yy-14-j*3,gold,2);L(xx,yy-10-j*3,xx+4,yy-14-j*3,p.light,2);}}}
    else for(const xx of [-16,-8,0,8,16])flower(xx,-4-(xx%3),o.ingredient?.includes('fruit'));
  }else if(name==='clock'||name==='greatClock'){
    R(-15,-49,30,50,ink);R(-12,-47,24,47,p.roof);R(-17,-52,34,6,gold);R(-10,-28,20,27,p.wall);O(0,-40,12,12,ink);O(0,-40,9,9,p.light);L(0,-40,Math.sin(t*.35)*6,-40-Math.cos(t*.35)*6,ink,2);L(0,-40,-5,-43,ink);L(0,-27,Math.sin(t*1.3)*5,-6,gold,2);O(Math.sin(t*1.3)*5,-7,5,5,gold);R(-17,-2,34,4,ink);
    if(name==='greatClock'){for(const sd of [-1,1]){O(sd*22,-26,12,12,ink);O(sd*22,-26,9,9,gold);for(let i=0;i<8;i++){const a=t*.2+i*Math.PI/4;L(sd*22+Math.cos(a)*5,-26+Math.sin(a)*5,sd*22+Math.cos(a)*11,-26+Math.sin(a)*11,p.light,2);}}}
  }else if(name==='gearBench'||name==='craft'){
    R(-20,-20,40,6,gold);R(-17,-14,5,16,ink);R(12,-14,5,16,ink);O(-7,-26,9,9,ink);O(-7,-26,6,6,p.wall);for(let i=0;i<6;i++){const a=t*.16+i*Math.PI/3;L(-7,-26,-7+Math.cos(a)*8,-26+Math.sin(a)*8,gold,2);}R(6,-31,10,11,p.wall);L(12,-28,19,-36,p.light,3);
  }else if(name==='well'||name==='echoShell'){
    O(0,0,23,8,ink);O(0,-3,22,8,p.wall);O(0,-5,16,5,p.water);L(-20,-4,-20,-38,gold,3);L(20,-4,20,-38,gold,3);L(-22,-38,22,-38,gold,4);
    if(name==='well'){P([[-28,-40],[0,-58],[28,-40]],p.roof);L(-24,-42,0,-56,p.light,2);L(0,-36,0,-13,gold);R(-5,-13,10,8,ink);R(-4,-13,8,6,p.path);}
    else{for(let i=0;i<5;i++){const a=i*.4-2.35;L(0,-8,Math.cos(a)*26,-8+Math.sin(a)*32,p.light,3);}O(0,-9,12,9,gold);O(0,-9,7,5,p.water);}
  }else if(name==='reedBell'||name==='tuningFork'){
    L(-15,0,-14,-32,leaf,2);L(15,0,13,-40,leaf,2);L(-14,-31,0,-44,gold,2);L(13,-39,0,-44,gold,2);P([[-10,-19],[-7,-36],[0,-42],[7,-36],[10,-19]],gold);L(-12,-19,12,-19,ink,3);O(Math.sin(t*2)*2,-16,3,4,lit);
  }else if(name==='furnace'){
    R(-18,-37,36,38,ink);R(-16,-35,32,34,p.wall);R(-13,-26,26,23,ink);P([[-9,-4],[-7,-20],[-2,-12],[3,-24],[7,-13],[10,-4]],Math.sin(t*6)>.1?gold:p.water);R(-20,-39,40,5,p.roof);R(9,-59,9,22,ink);R(10,-58,7,19,p.roof);for(let i=0;i<3;i++)O(13+Math.sin(t+i)*3,-67-((t*8+i*13)%30),3+i,2+i,p.edge);
  }else if(name==='starAnvil'){
    R(-9,-17,18,19,ink);R(-15,-5,30,7,gold);P([[-23,-30],[-20,-20],[-6,-16],[12,-18],[19,-25],[31,-29]],p.wall);L(-22,-30,30,-30,p.light,3);P([[-1,-37],[3,-48],[7,-37],[19,-34],[7,-30],[3,-19],[-1,-30],[-13,-34]],gold);O(3,-34,4,4,lit);
  }else if(name==='beamStack'){
    for(let i=0;i<3;i++){R(-25+i*3,-7-i*8,47,6,ink);R(-23+i*3,-7-i*8,43,2,p.wall);R(-18,-26,4,27,gold);R(16,-26,4,27,gold);}
  }else if(name==='telescope'){
    L(0,-21,-14,1,gold,3);L(0,-21,14,1,gold,3);L(0,-21,0,2,ink,3);P([[-19,-30],[-13,-40],[21,-20],[15,-11]],ink);P([[-16,-30],[-13,-36],[19,-19],[16,-14]],p.wall);L(-18,-32,-14,-39,gold,4);L(17,-13,21,-20,lit,3);O(0,-23,5,5,gold);
  }else if(name==='bookcase'){
    R(-20,-49,40,50,ink);R(-17,-46,34,43,p.roof);for(let j=0;j<3;j++){for(let i=0;i<6;i++){R(-14+i*5,-43+j*14,4,10,[p.light,p.wall,gold,p.flora][(i+j)%4]);R(-13+i*5,-40+j*14,2,1,ink);}R(-18,-31+j*14,36,3,gold);}R(-22,-2,44,4,ink);
  }else if(name==='openBook'||name==='fileStand'){
    R(-3,-24,6,25,ink);L(-12,0,12,0,gold,3);P([[-20,-24],[-16,-39],[17,-39],[21,-24]],p.roof);book(0,-30,1.3);
  }else if(name==='paperStack'){
    for(let i=0;i<5;i++){const xx=(i%2)*3;R(-20+xx,-4-i*5,35,4,i%2?p.light:p.path);L(-18+xx,-2-i*5,12+xx,-2-i*5,gold);}
    R(-7,-28,4,27,p.roof);O(-5,-13,6,6,gold);O(-5,-13,3,3,ink);
  }else if(name==='inkQuill'){
    O(0,-1,15,5,ink);R(-10,-19,20,18,ink);R(-8,-17,16,14,p.water);L(0,-18,17,-49,gold,2);P([[10,-33],[9,-46],[25,-59],[24,-42],[15,-31]],p.light);L(12,-34,23,-55,p.roof);
  }else if(name==='signalMast'){
    L(-11,2,0,-61,ink,5);L(11,2,0,-61,ink,5);for(let i=0;i<4;i++)L(-8+i*2,-10-i*12,8-i*2,-10-i*12,p.wall,2);L(-22,-43,22,-43,gold,3);L(-18,-48,-18,-38,p.wall,2);L(18,-48,18,-38,p.wall,2);O(0,-63,6,6,gold);O(0,-63,3,3,Math.sin(t*3)>0?lit:p.water);L(0,-60,0,-72,p.light,2);
  }else if(name==='relay'){
    R(-21,-37,42,38,ink);R(-18,-34,36,31,p.wall);R(-14,-28,28,14,ink);for(let i=0;i<4;i++){R(-11+i*7,-25,4,7,Math.sin(t*3+i)>0?lit:gold);L(-11+i*7,-10,-11+i*7,-3,ink,2);}L(-22,-5,22,-5,gold,2);L(-12,-38,-12,-49,p.wall,2);L(12,-38,12,-46,p.wall,2);
  }else if(name==='parcelCart'){
    L(-22,-5,23,-5,gold,4);O(-13,0,7,7,ink);O(13,0,7,7,ink);O(-13,0,3,3,p.wall);O(13,0,3,3,p.wall);for(const [xx,yy,ww]of [[-18,-21,17],[0,-25,19],[-11,-40,19]]){R(xx,yy,ww,16,p.path);L(xx+ww/2,yy,xx+ww/2,yy+15,gold,2);L(xx,yy+7,xx+ww,yy+7,p.roof);}L(22,-5,29,-19,p.wall,3);
  }else if(name==='waxPillar'){
    O(0,1,19,6,ink);R(-11,-47,22,47,p.path);R(-8,-45,7,40,p.light);O(0,-48,11,4,p.light);for(const [xx,yy]of [[-8,-31],[3,-20],[7,-39]]){R(xx,yy-12,3,12,p.light);O(xx+1,yy,2,4,p.light);}L(0,-48,0,-57,ink,2);P([[-4,-57],[0,-72+Math.sin(t*3)*2],[5,-57]],gold);O(0,-59,2,5,lit);
  }else if(name==='deedGate'){
    for(const sd of [-1,1]){R(sd*22-5,-56,10,57,ink);R(sd*22-3,-55,6,53,p.wall);}P([[-30,-57],[0,-73],[30,-57]],p.roof);L(-25,-55,25,-55,gold,4);R(-13,-52,26,40,p.light);for(let i=0;i<5;i++)L(-9,-45+i*5,8,-45+i*5,p.roof);O(0,-10,11,11,p.roof);O(0,-10,8,8,gold);L(-4,-11,4,-11,ink,2);
  }else if(name==='deedTable'){
    R(-35,-28,70,7,gold);R(-30,-21,6,24,ink);R(24,-21,6,24,ink);P([[-27,-31],[-23,-43],[19,-43],[28,-31]],p.light);for(let i=0;i<3;i++)L(-18,-39+i*3,15,-39+i*3,p.roof);O(17,-34,7,5,p.roof);R(-34,-52,6,21,p.light);P([[-35,-53],[-31,-65+Math.sin(t*4)],[-27,-53]],gold);L(-25,-13,25,-13,p.wall,3);
  }else if(name==='cutRope'){
    for(const sd of [-1,1])R(sd*16-2,-32,4,34,ink);for(let i=0;i<4;i++){L(-14,-27+i*7,14,-5-i*7,gold,2);L(-14,-6-i*6,14,-25+i*6,p.light);}O(0,-16,5,7,gold);
  }else if(name==='supportJack'){
    R(-23,-32,46,6,p.wall);R(-3,-26,6,25,ink);for(let yy=-8;yy>-27;yy-=5)L(-6,yy,6,yy,gold,2);R(-17,-2,34,4,ink);L(0,-14,17,-19,p.light,2);O(17,-19,3,3,gold);
  }else if(name==='seedpot'){
    P([[-14,-17],[-9,1],[9,1],[14,-17]],p.roof);R(-15,-19,30,5,gold);flower(0,-20,true);L(0,-28,Math.sin(t)*6,-46,leaf,3);O(Math.sin(t)*6,-47,5,7,lit);
  }else if(name==='hearth'||name==='camp'){
    O(0,0,23,8,ink);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;O(Math.cos(a)*17,Math.sin(a)*5,6,4,p.wall);}L(-12,-5,12,-1,gold,3);L(-12,-1,12,-5,gold,3);P([[-9,-7],[-7,-22],[-2,-15],[2,-31+Math.sin(t*4)*3],[9,-8]],gold);P([[-4,-8],[0,-22],[5,-7]],lit);if(name==='camp'){R(-37,-14,19,16,p.roof);R(-36,-13,5,14,p.light);}
  }else if(name==='bench'){
    R(-22,-17,44,5,gold);R(-22,-30,44,5,p.wall);R(-19,-25,4,27,ink);R(15,-25,4,27,ink);L(-21,-18,21,-18,p.light);
  }else if(name==='awning'){
    L(-25,1,-25,-34,ink,3);L(25,1,25,-34,ink,3);P([[-31,-35],[-20,-53],[21,-53],[31,-35]],p.roof);for(let i=0;i<5;i++)P([[-27+i*12,-35],[-20+i*10,-51],[-15+i*10,-51],[-21+i*12,-35]],i%2?gold:p.light);L(-31,-34,31,-34,ink,3);
  }else if(name==='boat'){
    P([[-28,-8],[27,-8],[17,5],[-17,5]],ink);P([[-23,-8],[22,-8],[14,1],[-13,1]],p.roof);L(0,-9,0,-44,gold,2);P([[2,-42],[20,-14],[2,-14]],p.light);L(-14,-5,22,-19,p.wall,2);
  }else if(name==='banner'){
    L(-1,2,-1,-48,gold,3);P([[1,-47],[21,-42+Math.sin(t)*2],[17,-20],[1,-24]],o.color||p.roof);L(4,-43,15,-40,p.light,2);L(4,-37,12,-34,p.light);
  }else if(name==='bedroll'){
    P([[-25,0],[-20,-18],[20,-18],[25,0]],ink);R(-18,-15,35,13,p.roof);R(-18,-15,9,12,p.light);L(-5,-13,15,-13,gold,2);
  }else if(name==='kitchen'){
    L(-19,0,19,0,p.wall,4);P([[-13,-2],[-8,-17],[0,-8],[7,-17],[14,-2]],gold);O(0,-18,19,10,ink);O(0,-20,16,7,p.water);O(0,-22,14,5,p.path);L(-20,-18,-25,-23,gold,3);L(20,-18,25,-23,gold,3);L(7,-20,17,-43,p.light,3);for(let i=0;i<3;i++)O(-6+i*6+Math.sin(t+i)*2,-35-((t*6+i*8)%22),2,3,p.light);
  }else if(name==='songTable'||name==='writingDesk'||name==='feastTable'){
    const wide=name==='feastTable'?1.7:1;R(-25*wide,-23,50*wide,6,gold);R(-20*wide,-17,5,20,ink);R(15*wide,-17,5,20,ink);L(-25*wide,-24,25*wide,-24,p.light,2);
    if(name==='writingDesk')book(0,-28,1.2);else{for(const xx of [-15,0,15]){O(xx*wide,-26,7,3,p.light);O(xx*wide,-27,4,2,p.roof);}R(-2,-42,4,14,p.light);P([[-4,-42],[0,-53+Math.sin(t*4)], [4,-42]],gold);if(name==='feastTable'){for(const xx of [-27,27]){R(xx-7,-5,14,5,p.wall);R(xx-5,0,3,7,ink);R(xx+2,0,3,7,ink);}}}
  }else if(name==='steps'||name==='deck'){
    const n=name==='steps'?3:1;for(let i=0;i<n;i++){R(-28+i*4,-5-i*7,56-i*8,8,p.wall);L(-27+i*4,-5-i*7,27-i*4,-5-i*7,gold,2);}if(name==='deck'){L(-26,-5,-26,-23,gold,3);L(26,-5,26,-23,gold,3);L(-28,-23,28,-23,p.wall,2);}
  }else if(name==='starBook'||name==='weatherBook'){
    R(-19,-13,38,14,ink);book(0,-15,1.5);if(name==='starBook'){P([[-3,-40],[0,-48],[3,-40],[11,-37],[3,-34],[0,-26],[-3,-34],[-11,-37]],gold);}else{O(-3,-39,10,5,p.water);O(6,-38,8,5,lit);for(const xx of [-7,0,7])L(xx,-31,xx-2,-24,p.water,2);}
  }else if(name==='oldNames'||name==='newNames'){
    for(const xx of [-13,13]){R(xx-2,-18,4,20,ink);R(xx-9,-27,18,11,name==='oldNames'?p.roof:p.light);for(let i=0;i<2;i++)L(xx-5,-23+i*3,xx+5,-23+i*3,name==='oldNames'?gold:p.deep);}flower(0,-3,true);
  }else if(name==='fruitBasket'||name==='seedCrate'){
    P([[-23,-20],[-18,0],[18,0],[23,-20]],p.roof);L(-23,-20,23,-20,gold,3);for(let yy=-14;yy<0;yy+=5)L(-20,yy,20,yy,gold);for(const xx of [-12,0,12]){if(name==='fruitBasket'){O(xx,-23,7,6,gold);L(xx,-29,xx+3,-33,leaf,2);}else{R(xx-4,-33,8,20,p.wall);R(xx-4,-34,8,4,gold);R(xx-2,-28,4,10,lit);}}
  }else if(name==='guideLamp'||name==='signalLamp')lamp(0);
}
function project(g,x,y,id,level,p,t){
  const {R,L,P,O,ink,gold,lit}=painter(g,x,y,p,t),wall=p.wall,roof=id==='inn'?'#ae6d59':id==='archive'?'#7d83a3':id==='dock'?'#669d9c':p.roof;
  O(0,2,33,9,ink);P([[-34,-2],[-28,-14],[28,-14],[34,-2]],p.path);L(-34,-2,34,-2,gold,2);
  if(!level){
    for(const xx of [-27,27]){R(xx-2,-17,4,20,p.roof);R(xx-3,-18,6,3,gold);}R(-15,-35,30,25,ink);R(-12,-32,24,18,p.water);L(-14,-13,14,-13,gold,2);
    const letters={workshop:'W',inn:'I',observatory:'O',garden:'G',archive:'A',dock:'D'};E.font.text(g,letters[id]||'?',x,y-21,p.light,{align:'center',outline:false});L(-20,-28,-15,-28,gold);L(15,-28,22,-28,gold);return;
  }
  if(id==='garden'){
    object(g,x-14,y-3,'flowerbed',p,t,{size:.9});object(g,x+16,y-12,'flowerbed',p,t+.8,{size:.75});if(level===2){object(g,x+2,y-24,'fruitTree',p,t,{size:.8});L(-32,-3,-32,-26,gold,2);L(32,-3,32,-26,gold,2);L(-33,-22,33,-22,p.wall,2);}return;
  }
  if(id==='dock'){
    for(let yy=-18;yy<=2;yy+=5)L(-35,yy,35,yy,p.roof,3);for(const xx of [-30,30])R(xx-2,-23,4,28,gold);object(g,x+1,y+7,'boat',p,t,{size:.68});if(level===2){object(g,x-26,y-14,'guideLamp',p,t,{size:.75});P([[-29,-41],[0,-56],[29,-41],[21,-24],[-21,-24]],roof);L(-26,-41,-26,-12,gold,2);L(26,-41,26,-12,gold,2);P([[1,-56],[11,-62],[11,-49],[1,-49]],p.light);}return;
  }
  if(id==='observatory'){
    R(-27,-12,54,12,wall);L(-29,-13,29,-13,gold,3);if(level===1)object(g,x,y-13,'telescope',p,t,{size:1.1});else{R(-24,-40,48,28,ink);R(-21,-38,42,26,wall);O(0,-41,26,24,ink);O(0,-43,23,21,p.water);O(-6,-48,14,13,p.light);R(-4,-65,8,44,ink);L(-2,-64,-2,-22,gold,2);object(g,x+11,y-29,'telescope',p,t,{size:.65});R(-5,-12,10,12,ink);}return;
  }
  if(level===1){
    object(g,x,y-3,'awning',{...p,roof},t,{size:1.08});if(id==='workshop')object(g,x,y-2,'gearBench',p,t,{size:.75});else if(id==='archive')object(g,x,y-4,'bookcase',p,t,{size:.67});else{object(g,x-7,y-3,'bench',p,t,{size:.7});R(12,-25,10,22,p.light);R(14,-24,6,14,roof);}return;
  }
  R(-27,-46,54,46,ink);R(-24,-44,48,44,wall);P([[-35,-46],[0,-71],[35,-46]],ink);P([[-31,-47],[0,-67],[31,-47]],roof);L(-28,-47,0,-65,gold,2);R(-6,-23,12,23,ink);R(-3,-20,6,19,p.roof);
  for(const xx of [-17,16]){R(xx-5,-35,10,13,ink);R(xx-3,-33,6,9,lit);L(xx,-33,xx,-24,wall);}
  if(id==='workshop'){R(17,-69,8,24,ink);R(19,-68,4,22,p.roof);O(-1,-52,8,8,gold);O(-1,-52,5,5,ink);L(-1,-58,-1,-46,p.light,2);L(-7,-52,5,-52,p.light,2);for(let i=0;i<2;i++)O(21+Math.sin(t+i)*2,-76-((t*7+i*16)%24),3+i,2+i,p.edge);}
  if(id==='inn'){R(-31,-18,62,6,roof);for(let i=0;i<8;i++)R(-30+i*8,-18,4,7,p.light);R(29,-45,3,29,gold);R(27,-38,18,13,roof);O(36,-31,4,4,gold);}
  if(id==='archive'){bookMark(g,x,y-52,p);R(-30,-7,60,7,p.path);L(-30,-4,30,-4,gold);}
}
function bookMark(g,x,y,p){px.poly(g,[[x-9,y+5],[x-9,y-8],[x,y-5],[x+9,y-8],[x+9,y+5],[x,y+7]],p.light);px.line(g,x,y-4,x,y+5,p.deep,1);}
function prop(r,p,w,app){if(!p.name.startsWith('hb_'))return false;const name=p.name.slice(3);r.shadow(p.x,p.y,Math.max(8,16*(p.o.size||1)),.24);r.actor(p.x,p.y,p.z||0,(g,x,y)=>object(g,x,y,name,palette(w.zone),app.game.time,p.o),{outline:true,rim:false,hides:true});return true;}
function entity(r,e,w,app){
  const p=palette(w.zone),t=app.game.time,active=app.nearest?.id===e.id;
  if(e.type==='project'){
    const level=app.projectLevel?.(e.project)??projectLevel(e.project,app.state.flags);r.shadow(e.x,e.y,29,.26);r.actor(e.x,e.y,0,(g,x,y)=>{project(g,x,y,e.project,level,p,t);for(const [flag,kind,side]of PROJECT_CHOICES[e.project]||[])if(app.state.flags[flag])object(g,x+side*31,y+5,kind,p,t,{size:.48});},{outline:true,rim:false,hides:true});
    r.decal(()=>r.groundRing(e.x,e.y,18,level===2?p.glow:p.accent,.25));if(active)r.textAt(e.x,e.y,90,(D.Content.projects?.find(v=>v.id===e.project)?.name||e.name)+' '+level+'/2',p.light,{outline:p.deep});return true;
  }
  if(e.type==='forage'){
    const q=app.harvestStatus?.(e.id)||{ready:true,count:e.count||2};prop(r,{name:'hb_forage',x:e.x,y:e.y,z:0,o:{ready:q.ready,ingredient:e.ingredient,size:.85}},w,app);
    if(q.ready){r.decal(()=>r.groundRing(e.x,e.y,13,p.glow,.24));if(Math.sin(t*2+e.x)>.25)r.textAt(e.x,e.y,38,'+',p.light);}
    if(active)r.textAt(e.x,e.y,55,q.ready?e.name+' x'+q.count:'Regrows after '+q.remaining+' '+(q.remaining===1?'victory':'victories'),p.light,{outline:p.deep});return true;
  }
  if(!['field','mechanism','camp','craft','cook','trial','trials'].includes(e.type))return false;
  const kind=e.type==='camp'?'camp':e.type==='craft'?'craft':e.type==='cook'?'kitchen':e.type==='trial'||e.type==='trials'?'starAnvil':e.type==='mechanism'?({sluice:'well',mirror:'openBook',circuit:'relay'}[e.puzzle?.kind]||'clock'):({cut:'cutRope',resonate:'tuningFork',brace:'supportJack',grow:'seedpot',reveal:'fileStand',power:'relay'}[e.ability]||'clock'),used=!!app.state.flags[e.flag||e.completeFlag];
  prop(r,{name:'hb_'+kind,x:e.x,y:e.y,z:0,o:{size:.85,ready:!used}},w,app);r.decal(()=>r.groundRing(e.x,e.y,11,used?p.edge:p.glow,.3));if(active)r.textAt(e.x,e.y,60,e.name,p.light,{outline:p.deep});return true;
}
function backdrop(r,w){r.sky(palette(w.zone).sky);}
function ground(r,w,app){
  const key=w.zone.hearthTheme,p=palette(w.zone),cx=16*16,cy=(key==='haven'?13:12)*16;
  r.decal(g=>{g.save();g.globalAlpha=.35;const L=(x,y,xx,yy,c=p.accent,width=1)=>px.line(g,...r.w(cx+x,cy+y,0),...r.w(cx+xx,cy+yy,0),c,width);
    if(key==='clock'){r.groundRing(cx,cy,80,p.accent,.4);for(let i=0;i<12;i++){const a=i*Math.PI/6;L(Math.cos(a)*68,Math.sin(a)*68,Math.cos(a)*80,Math.sin(a)*80,p.light,2);}L(0,0,0,-55,p.glow,2);L(0,0,43,26,p.glow,2);}
    else if(key==='forge'){for(let i=0;i<8;i++){const a=i*Math.PI/4,b=a+Math.PI/8;L(Math.cos(a)*76,Math.sin(a)*76,Math.cos(b)*30,Math.sin(b)*30,p.accent,2);L(Math.cos(b)*30,Math.sin(b)*30,Math.cos(a+Math.PI/4)*76,Math.sin(a+Math.PI/4)*76,p.accent,2);}}
    else if(key==='signal'){for(const yy of [-38,38]){L(-90,yy,-28,yy,p.glow,2);L(-28,yy,0,0,p.glow,2);L(0,0,28,-yy,p.glow,2);L(28,-yy,90,-yy,p.glow,2);}}
    else if(key==='ink'){for(const xx of [-1,1]){L(0,18,xx*70,31,p.accent,2);L(xx*70,31,xx*70,-50,p.accent,2);L(xx*70,-50,0,-33,p.accent,2);for(let i=0;i<4;i++)L(xx*12,-20+i*10,xx*59,-29+i*11,p.glow);}L(0,-32,0,17,p.accent,2);}
    else if(key==='hearth'){r.groundRing(cx,cy,73,p.accent,.38);for(const sd of [-1,1]){L(sd*48,-35,sd*48,35,p.light,2);L(sd*48,35,0,55,p.light,2);}L(-48,-35,48,-35,p.light,2);}
    else if(key==='roots'){for(let i=0;i<8;i++){const a=i*Math.PI/4;L(0,0,Math.cos(a)*50,Math.sin(a)*50,p.glow,2);L(Math.cos(a)*50,Math.sin(a)*50,Math.cos(a+.3)*72,Math.sin(a+.3)*72,p.accent);}}
    else if(key==='tide'){for(const rr of [38,57,78])r.groundRing(cx,cy,rr,p.glow,.25);}
    else{r.groundRing(cx,cy,53,p.accent,.35);for(let i=0;i<6;i++){const a=i*Math.PI/3;L(Math.cos(a)*40,Math.sin(a)*40,Math.cos(a)*58,Math.sin(a)*58,p.light,2);}}
    g.restore();});
}
function ambient(r,w,app){const p=palette(w.zone),t=app.game.time,key=w.zone.hearthTheme;r.overlay(g=>{for(let i=0;i<16;i++){const x=(E.hash2(i,181)*r.W+t*(key==='signal'?13:3))%r.W,y=(E.hash2(i,98)*r.H+t*(key==='forge'?-5:2)+r.H*8)%r.H;if(y>r.H-40)continue;if(key==='ink'||key==='hearth'){if(i%3===0)px.poly(g,[[x,y],[x+3,y-1],[x+4,y+2],[x+1,y+3]],E.mix(p.light,p.deep,.4));}else if(key==='tide')px.ell(g,x,y,1,2,p.glow);else px.rect(g,x,y,i%3===0?2:1,1,i%2?p.accent:p.glow);}});}
class HearthRig{
  constructor(def){this.def=def;this.id=def.id;this.t=0;this.hurt=0;this.height=(def.id==='hb_tallow'?84:38)*(def.size||1);}
  update(dt,state={}){this.t+=dt;this.hurt=state.hurt?1:Math.max(0,this.hurt-dt*5);}
  draw(g,x,y,view){
    const p=THEMES.hearth,t=this.t,s=(view.scale||1.5)/1.5*(this.def.size||1),f=painter(g,x,y,p,t,{size:s}),{R,L,P,O,ink,gold,lit}=f;
    if(this.id==='hb_ownership_seal'){const bob=Math.sin(t*2)*2;P([[-18,-5+bob],[-14,-32+bob],[17,-29+bob],[19,-3+bob]],ink);P([[-15,-7+bob],[-12,-29+bob],[14,-27+bob],[16,-5+bob]],p.light);for(let i=0;i<3;i++)L(-8,-24+bob+i*4,10,-23+bob+i*4,p.roof);O(0,-8+bob,9,9,p.roof);O(0,-8+bob,6,6,gold);L(-3,-8+bob,3,-8+bob,ink,2);return;}
    const bob=Math.sin(t*1.7),wax='#dec5a1',shade='#ac866c',coat='#656077';O(0,1,26,7,ink);P([[-16,-6],[-22,-44],[-13,-56],[12,-57],[22,-41],[18,-6],[6,0],[-5,-5]],ink);P([[-13,-9],[-17,-42],[-11,-52],[11,-53],[18,-40],[15,-10],[5,-3]],coat);P([[-7,-51],[-8,-16],[1,-7],[9,-18],[7,-52]],p.light);L(0,-48,0,-11,gold,2);
    for(const sd of [-1,1]){P([[sd*13,-50],[sd*22,-42],[sd*30,-22],[sd*25,-17],[sd*13,-33]],shade);L(sd*15,-48,sd*26,-25,wax,4);O(sd*27,-20,6,7,wax);}
    P([[-14,-57+bob],[-15,-76+bob],[-7,-84+bob],[7,-83+bob],[14,-74+bob],[11,-56+bob],[0,-51+bob]],ink);P([[-11,-59+bob],[-12,-75+bob],[-6,-81+bob],[6,-80+bob],[11,-73+bob],[8,-58+bob],[0,-55+bob]],wax);P([[-10,-74+bob],[-3,-78+bob],[-3,-62+bob],[-9,-58+bob]],p.light);L(-8,-69+bob,-3,-68+bob,ink,2);L(3,-68+bob,8,-69+bob,ink,2);L(-4,-60+bob,4,-61+bob,shade);R(5,-58+bob,3,12,wax);O(6,-45+bob,2,3,wax);R(-8,-78+bob,3,9,p.light);L(0,-82+bob,0,-91+bob,ink,2);P([[-4,-91+bob],[1,-106+Math.sin(t*5)*3],[6,-91+bob]],gold);O(1,-93+bob,2,5,lit);
    P([[-36,-18],[-39,-40],[-21,-42],[-19,-20]],p.light);for(let i=0;i<4;i++)L(-35,-36+i*4,-24,-37+i*4,shade);O(-28,-20,6,6,p.roof);O(-28,-20,3,3,gold);L(26,-21,34,-38,gold,3);O(35,-41,5,5,ink);O(35,-42,3,3,gold);
    for(let i=0;i<3;i++){const yy=-6+((t*7+i*7)%22),xx=-11+i*10;O(xx,yy,2,3,wax);}
  }
}
D.makeHearthRig=def=>['hb_tallow','hb_ownership_seal'].includes(def.id)?new HearthRig(def):null;
D.HearthArt={palette,floorPainter,build,prop,entity,backdrop,ground,ambient,projectLevel,projectChoices:PROJECT_CHOICES};
})();
