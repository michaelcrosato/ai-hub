/* Original landmarks and quest scenery for the existing towns. No collision edits. */
(() => {
'use strict';
const D=globalThis.Dawn,E=globalThis.My3D2dge,px=E.px;
const SCENES={
  bell_quay:{motif:'tide',props:[['netRack',5.5,14.7,.8],['harborBoat',21.5,19.7,1.15],['bollard',18.5,18,.8],['bollard',24,18,.8]]},
  bell_kiln:{motif:'heat',props:[['publicFurnace',15.7,7.4,1.2],['copperPipe',24.5,6.6,.8]]},
  seed_camp:{motif:'seed',props:[['seedCanopy',12,8.8,.8],['seedDrying',20,15.8,.9],['birdhouse',18.8,18.5,.85]]},
  seed_falls:{motif:'seed',props:[['riverGauge',20,8.5,1],['rootBasket',24.8,19.3,.75]]},
  glass_steps:{motif:'names',props:[['publicStage',17,7.2,1.05],['maskStand',23.6,12.1,.8]]},
  glass_archive:{motif:'names',props:[['recordLattice',11.3,7.8,1.2],['readingTable',20.6,18,.7]]},
  glass_cistern:{motif:'names',props:[['paperFloat',14,5.9,.9],['paperFloat',16.8,17.5,.75]]},
  glass_observatory:{motif:'lens',props:[['grandLens',15.8,5.8,1.4],['lensCase',26.5,14.8,.75]]},
  ash_relay:{motif:'route',props:[['routeMast',15.2,7.7,1.1],['letterRack',20.8,18.3,.8]]},
  ash_foundry:{motif:'heat',props:[['thermalArch',16,6,1.45],['copperPipe',25.2,15.8,.8]]},
  fold_shore:{motif:'ferry',props:[['hourFerry',18.4,19.5,1.4],['mooringLamp',26.8,18.8,1.05]]}
};
const OBJECTS={
  quay_intro:'harborClock',quay_memorial:'memorial',kiln_vent:'heatVent',tower_plate:'servicePlate',tower_echo:'windChime',
  dunes_map:'routeBoard',foundry_log:'shiftBook',foundry_brann_hint:'heatVent',skyway_record:'gardenPlaque',
  archive_notice:'noticeBoard',archive_watch:'workbench',cistern_rejected:'recordTray',cistern_name:'nameShard',
  observatory_seal:'lensSeal',shore_welcome:'windChime',heart_terminal:'routeBoard',heart_rest:'windChime',
  sh_performance_board:'noticeBoard',sh_morning_board:'noticeBoard',sh_hours_board:'hoursAlbum'
};
const HERO_PEOPLE={kiln_brann:'brann',camp_ilex:'ilex',relay_vale:'vale',steps_nyx:'nyx',gallery_mira:'mira',gallery_soren:'soren',gallery_ilex:'ilex'};
// Choices add scenery only. They never alter the TileMap or open a story route.
const CHOICES=[
  {flags:['sh_key_working','sh_key_history'],sites:[['bell_quay',14,11,'toolChest','keyDisplay',.8]]},
  {flags:['sh_supper_garden','sh_supper_dock'],sites:[['bell_orchard',16,15,'picnic','coveredTrays',.85],['bell_quay',17,14,'picnic','coveredTrays',.7]]},
  {flags:['sh_refrain_soft','sh_refrain_full'],sites:[['bell_quay',15,8,'softChimes','pennants',.85]]},
  {flags:['sh_watch_steady','sh_watch_sheltered'],sites:[['bell_tower',21,6,'watchLamp','hoodedLamp',.85],['ash_dunes',20,6,'watchLamp','hoodedLamp',.85]]},
  {flags:['sh_stick_trellis','sh_stick_perch'],sites:[['seed_camp',18,7,'trellis','birdPerch',.85]]},
  {flags:['sh_pollinator_hedge','sh_pollinator_sunstrip'],sites:[['seed_wilds',17,13,'hedge','sunstrip',.85],['seed_falls',19,6,'hedge','sunstrip',.75]]},
  {flags:['sh_seasons_mixed','sh_seasons_rotating'],sites:[['seed_vault',19,12,'mixedBed','rotatingBeds',.82],['ash_skybridge',24,19,'mixedBed','rotatingBeds',.82]]},
  {flags:['sh_shade_bench','sh_shade_birds'],sites:[['ash_skybridge',19,13,'shadeBench','birdShade',.82]]},
  {flags:['sh_apology_letter','sh_apology_visit'],sites:[['glass_steps',13.1,8.7,'letterTable','visitingChairs',.75]]},
  {flags:['sh_lesson_desk','sh_lesson_leaflets'],sites:[['glass_archive',18,6,'schoolDesk','leafletRack',.8]]},
  {flags:['sh_memories_appointments','sh_memories_counter'],sites:[['glass_archive',19,15,'appointmentClock','memoryCounter',.8]]},
  {flags:['sh_performance_circle','sh_performance_procession'],sites:[['glass_steps',17,15,'performanceCircle','procession',.9]]},
  {flags:['sh_shift_memorial','sh_shift_school'],sites:[['ash_foundry',18,14,'shiftMemorial','trainingBrake',.88]]},
  {flags:['sh_route_sheltered','sh_route_direct'],sites:[['ash_dunes',21,19,'routeShelter','directWaymark',.85]]},
  {flags:['sh_morning_round','sh_morning_table'],sites:[['ash_relay',17,15,'breakfastCart','breakfastTable',.82]]},
  {flags:['sh_elia_shared','sh_elia_private'],sites:[['glass_observatory',16,13,'eliaShared','eliaPrivate',.84],['ash_skybridge',24,9,'eliaShared','eliaPrivate',.84]]},
  {flags:['sh_river_mooring','sh_river_reeds'],sites:[['fold_shore',17,15,'riverMooring','riverReeds',.88]]},
  {flags:['sh_hours_album','sh_hours_carried'],sites:[['fold_gallery',15,15,'hoursAlbum','hoursSatchels',.9],['fold_shore',22,8,'hoursAlbum','hoursSatchels',.72]]}
];
const VARIANTS=CHOICES.flatMap(c=>c.sites.flatMap(([zone,x,y,a,b,size])=>c.flags.map((flag,i)=>({zone,flags:[flag],props:[[i?b:a,x,y,size]]}))));
const palette=w=>({...w.palette,paper:'#e7d9b6',gold:'#d9b576',ink:w.palette.deep,teal:'#97cabb',coral:'#c77f65'});
const objectKind=e=>OBJECTS[e.id]||(e.type==='npc'&&e.preserveLayout&&/board/i.test(e.name||'')?'noticeBoard':null);
const isObject=e=>!!objectKind(e);
const person=e=>HERO_PEOPLE[e.id]?{...e,hero:HERO_PEOPLE[e.id]}:e;
function affects(z){return!!SCENES[z.id]||VARIANTS.some(v=>v.zone===z.id)||(z.entities||[]).some(e=>isObject(e)||e.preserveLayout&&['note','fieldnote','delivery'].includes(e.type));}
function decorate(w){
  w.smallHoursDecorated=affects(w.zone);if(!w.smallHoursDecorated)return;
  const add=(kind,x,y,size=1,extra={})=>w.addProp('sh_'+kind,(x+.5)*16,(y+.5)*16,{size,smallHours:true,...extra});
  for(const [kind,x,y,size]of SCENES[w.zone.id]?.props||[])add(kind,x,y,size);
  for(const e of w.entities)if(isObject(e))add(objectKind(e),e.tx0,e.ty0,.88,{source:e.id,interactive:true});
  for(const v of VARIANTS)if(v.zone===w.zone.id&&v.flags.every(f=>w.flags[f]))for(const [kind,x,y,size]of v.props)add(kind,x,y,size,{consequence:v.flags.join('+')});
}
function pen(g,x,y,s,p){return{
  R:(a,b,w,h,c)=>px.rect(g,x+a*s,y+b*s,Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)),c),
  L:(a,b,c,d,k,w=1)=>px.line(g,x+a*s,y+b*s,x+c*s,y+d*s,k,Math.max(1,Math.round(w*s))),
  O:(a,b,rx,ry,c)=>px.ell(g,x+a*s,y+b*s,rx*s,ry*s,c),
  P:(pts,c)=>px.poly(g,pts.map(([a,b])=>[x+a*s,y+b*s]),c)
};}
function paint(g,x,y,kind,p,t,o={},flags={}){
  const s=o.size||1,{R,L,O,P}=pen(g,x,y,s,p),ink=p.ink,gold=p.gold,paper=p.paper,teal=p.teal;
  const post=(xx,yy=0,h=40)=>{R(xx-2,yy-h,4,h+2,ink);R(xx-1,yy-h,2,h,gold);};
  const page=(xx,yy,w=18,h=24)=>{P([[xx-w/2,yy],[xx-w/2+2,yy-h],[xx+w/2,yy-h+1],[xx+w/2+1,yy-1]],paper);for(let j=0;j<3;j++)L(xx-w/2+5,yy-h+6+j*4,xx+w/2-3,yy-h+6+j*4,p.roof);};
  const seal=(xx,yy)=>{O(xx,yy,5,5,p.coral);O(xx,yy,3,3,gold);};
  const lantern=(xx,yy=0)=>{post(xx,yy,42);R(xx-7,yy-39,14,16,ink);R(xx-5,yy-37,10,12,paper);R(xx-1,yy-39,2,16,gold);P([[xx-10,yy-39],[xx,yy-49],[xx+10,yy-39]],p.roof);};
  const sprout=(xx,yy)=>{L(xx,yy,xx,yy-13,teal,2);P([[xx,yy-7],[xx-9,yy-13],[xx-4,yy-18],[xx,yy-11]],p.flora);P([[xx,yy-10],[xx+8,yy-20],[xx+12,yy-13],[xx,yy-5]],teal);};
  const chair=(xx,yy=0)=>{R(xx-9,yy-29,18,15,ink);R(xx-7,yy-27,14,11,p.roof);R(xx-10,yy-13,20,5,gold);R(xx-8,yy-8,3,10,ink);R(xx+5,yy-8,3,10,ink);};
  const table=(xx=0,yy=0,w=46)=>{R(xx-w/2,yy-22,w,6,ink);R(xx-w/2+2,yy-21,w-4,3,gold);R(xx-w/2+4,yy-16,4,18,p.roof);R(xx+w/2-8,yy-16,4,18,p.roof);};
  const flower=(xx,yy,c=paper)=>{L(xx,yy,xx,yy-14,p.flora,2);for(const [dx,dy]of [[-3,0],[3,0],[0,-3],[0,3]])O(xx+dx,yy-14+dy,3,3,c);O(xx,yy-14,2,2,gold);};
  const bowl=(xx,yy)=>{O(xx,yy-2,7,3,paper);P([[xx-7,yy-2],[xx-4,yy+4],[xx+4,yy+4],[xx+7,yy-2]],p.wall);O(xx,yy-2,5,2,p.coral);};
  const bird=(xx,yy,c=teal)=>{O(xx,yy,6,4,c);O(xx+4,yy-3,3,3,c);P([[xx+6,yy-3],[xx+11,yy-2],[xx+6,yy-1]],gold);P([[xx-4,yy],[xx-11,yy-4],[xx-9,yy+2]],p.roof);O(xx+5,yy-4,1,1,ink);};
  const bed=(xx,yy,w=32,rows=1)=>{P([[xx-w/2,yy-11],[xx+w/2,yy-11],[xx+w/2+5,yy],[xx-w/2-5,yy]],ink);P([[xx-w/2+1,yy-9],[xx+w/2-1,yy-9],[xx+w/2+2,yy-2],[xx-w/2-2,yy-2]],p.roof);for(let j=0;j<rows;j++)for(let i=0;i<3;i++)flower(xx+(i-1)*9,yy-2-j*7,[teal,paper,p.coral][i]);};
  const lowBoat=(wide=1)=>{O(0,3,32*wide,6,ink);P([[-35*wide,-10],[34*wide,-10],[24*wide,3],[-22*wide,3]],p.roof);L(-31*wide,-9,30*wide,-9,gold,3);for(const xx of [-17,0,17])L(xx*wide,-8,xx*wide,0,p.wall,2);L(-27*wide,-7,-22*wide,1,paper);};
  if(kind==='harborClock'){
    O(0,1,27,8,ink);R(-20,-19,40,18,p.wall);R(-24,-20,48,5,gold);R(-16,-58,32,38,ink);R(-13,-57,26,35,p.roof);P([[-24,-57],[0,-76],[24,-57]],ink);P([[-19,-58],[0,-71],[19,-58]],gold);O(0,-44,18,18,ink);O(0,-44,15,15,paper);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;L(Math.cos(a)*11,-44+Math.sin(a)*11,Math.cos(a)*13,-44+Math.sin(a)*13,ink);}
    const a=flags.bell_key?t*.14:1.5;L(0,-44,Math.sin(a)*9,-44-Math.cos(a)*9,ink,2);L(0,-44,-6,-47,ink,2);O(0,-44,2,2,gold);R(-9,-21,18,5,teal);L(-15,-8,15,-8,gold,2);
  }else if(kind==='netRack'){
    post(-25,0,47);post(25,0,45);L(-28,-43,28,-43,gold,3);for(let i=0;i<7;i++){const xx=-23+i*8;L(xx,-40,xx+Math.sin(t*.9+i)*2,-8,p.light);L(-24,-37+i*5,24,-34+i*5,p.light);}for(const xx of [-13,7]){P([[xx,-26],[xx+12,-22],[xx+2,-17],[xx-4,-22]],teal);P([[xx+10,-22],[xx+17,-26],[xx+16,-18]],gold);}R(-31,-4,62,5,p.roof);
  }else if(kind==='harborBoat'||kind==='hourFerry'){
    const bob=Math.sin(t*1.3)*1.1;g.save();g.translate(0,bob*s);lowBoat(kind==='hourFerry'?1.25:1);post(-3,-4,kind==='hourFerry'?47:40);
    if(kind==='hourFerry'){P([[-28,-34],[0,-51],[29,-34],[22,-24],[-22,-24]],p.sky[1]);L(-27,-33,-27,-8,gold,2);L(27,-33,27,-8,gold,2);for(const xx of [-16,0,16]){L(xx,-35,xx,-18,teal);O(xx,-18,2,4,paper);}O(0,-39,6,6,gold);O(0,-39,3,3,ink);}
    else{P([[0,-43],[23,-15],[0,-16]],paper);L(0,-44,23,-16,gold);L(-22,-7,-30,8,ink,3);}g.restore();
  }else if(kind==='bollard'){O(0,1,8,4,ink);R(-5,-12,10,13,p.wall);O(0,-12,7,3,gold);L(-7,-5,9,-3,paper,2);}
  else if(kind==='memorial'){
    O(0,1,23,6,ink);P([[-18,0],[-15,-39],[0,-49],[15,-39],[18,0]],p.wall);P([[-10,-9],[-10,-35],[10,-35],[10,-9]],ink);for(let i=0;i<4;i++)L(-6,-30+i*5,6,-30+i*5,gold);O(0,-40,4,4,teal);for(const xx of [-22,22]){sprout(xx,0);O(xx,-15,3,3,paper);}
  }else if(kind==='seedCanopy'){
    post(-29,0,45);post(29,0,45);P([[-37,-42],[0,-67],[37,-42],[31,-28],[-31,-28]],p.roof);P([[-31,-42],[0,-62],[31,-42],[26,-30],[-26,-30]],p.flora);L(-34,-42,34,-42,gold,2);for(const xx of [-17,0,17]){L(xx,-37,xx,-13,paper);O(xx,-12,7,10,p.path);L(xx-5,-16,xx+5,-16,gold);sprout(xx,-18);}R(-29,-3,58,4,p.wall);
  }else if(kind==='seedDrying'||kind==='rootBasket'){
    O(0,0,25,6,ink);P([[-26,-14],[-21,0],[23,0],[28,-14]],p.roof);for(let i=0;i<4;i++)L(-23,-12+i*3,25,-12+i*3,gold);for(const xx of [-16,-6,5,15]){O(xx,-16,5,4,paper);L(xx,-20,xx+2,-25,teal);}if(kind==='rootBasket')sprout(0,-17);
  }else if(kind==='birdhouse'){
    post(0,0,29);R(-14,-51,28,24,p.wall);P([[-21,-52],[0,-70],[21,-52]],ink);P([[-17,-53],[0,-65],[17,-53]],p.roof);O(0,-40,6,7,ink);L(-10,-28,10,-28,gold,3);O(17+Math.sin(t*.9)*2,-29,5,3,teal);P([[20,-29],[26,-31],[24,-27]],gold);O(18,-30,1,1,ink);
  }else if(kind==='riverGauge'){
    post(-20,0,55);post(20,0,55);L(-24,-52,24,-52,p.wall,5);R(-5,-47,10,44,ink);R(-3,-45,6,41,paper);for(let i=0;i<8;i++)L(-3,-7-i*5,i%2?1:4,-7-i*5,p.roof);O(-19,-14,10,10,ink);O(-19,-14,7,7,gold);for(let i=0;i<6;i++){const a=t*.3+i*Math.PI/3;L(-19,-14,-19+Math.cos(a)*8,-14+Math.sin(a)*8,paper,2);}L(7,-23,15,-23,teal,3);
  }else if(kind==='publicStage'){
    P([[-47,0],[-38,-14],[38,-14],[47,0],[36,9],[-36,9]],ink);P([[-43,-1],[-36,-11],[36,-11],[43,-1],[34,5],[-34,5]],p.wall);for(let i=-30;i<40;i+=10)L(i,-9,i,3,p.light);post(-38,-7,39);post(38,-7,39);L(-40,-44,40,-44,gold,3);for(const xx of [-37,37]){P([[xx,-44],[xx+Math.sign(xx)*-18,-44],[xx+Math.sign(xx)*-12,-31],[xx,-20]],p.roof);L(xx,-43,xx,-19,teal,2);}O(0,-3,12,4,gold);O(0,-3,9,3,p.roof);
  }else if(kind==='maskStand'){
    post(-15,0,45);post(15,0,45);L(-18,-42,18,-42,gold,3);for(const [xx,yy]of [[-10,-28],[11,-17]]){P([[xx-9,yy-14],[xx+9,yy-14],[xx+7,yy],[xx,yy+5],[xx-7,yy]],paper);L(xx-5,yy-8,xx-1,yy-7,ink,2);L(xx+1,yy-7,xx+5,yy-8,ink,2);L(xx-3,yy-2,xx+3,yy-2,p.roof);}R(-22,-3,44,4,p.wall);
  }else if(kind==='recordLattice'){
    post(-32,0,67);post(32,0,67);for(const yy of [-63,-39,-15]){L(-35,yy,35,yy,gold,3);for(const xx of [-23,0,23]){P([[xx-7,yy+3],[xx+7,yy+3],[xx+7,yy+20],[xx-7,yy+20]],p.water);L(xx-4,yy+7,xx+4,yy+7,teal);L(xx-4,yy+11,xx+4,yy+11,paper);}}P([[-39,-66],[0,-82],[39,-66]],p.roof);O(0,-71,5,5,paper);
  }else if(kind==='grandLens'){
    L(-15,-28,-34,4,gold,5);L(15,-28,34,4,gold,5);L(0,-21,0,4,ink,5);O(0,-47,32,33,ink);O(0,-48,28,29,gold);O(0,-48,24,25,p.water);O(-6,-52,16,18,teal);O(-11,-58,8,10,paper);L(-28,-48,28,-48,p.wall,2);L(0,-74,0,-22,p.wall,2);for(let i=0;i<6;i++){const a=t*.06+i*Math.PI/3;O(Math.cos(a)*34,-48+Math.sin(a)*35,2,2,paper);}L(-38,-47,-27,-47,gold,4);L(27,-47,38,-47,gold,4);
  }else if(kind==='lensCase'||kind==='lensSeal'){
    R(-21,-18,42,20,ink);R(-18,-16,36,16,p.roof);O(0,-22,14,8,gold);O(0,-24,11,7,p.water);O(-3,-25,6,4,teal);if(kind==='lensSeal'){L(-18,-18,18,-4,paper,3);L(18,-18,-18,-4,paper,3);seal(0,-11);}L(-20,1,20,1,gold,2);
  }else if(kind==='publicFurnace'||kind==='thermalArch'){
    const large=kind==='thermalArch';R(-31,-48,62,48,ink);R(-28,-45,56,42,p.wall);P([[-21,-3],[-21,-26],[-11,-37],[11,-37],[21,-26],[21,-3]],ink);P([[-14,-4],[-12,-21],[-6,-15],[1,-30],[8,-16],[14,-4]],p.coral);P([[-6,-4],[-3,-18],[2,-12],[6,-4]],gold);R(-35,-50,70,7,p.roof);for(const xx of [-28,28]){R(xx-4,-71,8,21,ink);R(xx-2,-69,4,18,gold);}if(large){O(0,-53,15,15,ink);O(0,-54,11,11,gold);O(0,-54,7,7,p.roof);for(let i=0;i<6;i++){const a=t*.27+i*Math.PI/3;L(0,-54,Math.cos(a)*10,-54+Math.sin(a)*10,paper,2);}L(-43,-65,-43,-9,ink,6);L(-43,-65,-29,-65,gold,4);L(29,-65,43,-65,gold,4);L(43,-65,43,-9,ink,6);}else for(let i=0;i<3;i++)O(28+Math.sin(t+i)*3,-79-((t*8+i*11)%24),4+i,3+i,p.edge);
  }else if(kind==='heatVent'||kind==='copperPipe'){
    R(-20,-13,40,16,ink);R(-18,-11,36,11,p.wall);for(let xx=-13;xx<17;xx+=6)L(xx,-11,xx,-1,ink,2);L(-14,-15,-14,-40,gold,5);L(-14,-40,12,-40,gold,5);L(12,-40,12,-23,gold,5);O(12,-18,11,11,ink);O(12,-18,8,8,p.roof);for(let i=0;i<4;i++){const a=t*.15+i*Math.PI/2;L(12,-18,12+Math.cos(a)*8,-18+Math.sin(a)*8,gold,2);}if(!flags.brann_vent_fixed)for(let i=0;i<2;i++)O(-15+Math.sin(t+i)*3,-47-((t*9+i*9)%19),4+i,2+i,p.light);
  }else if(kind==='routeMast'){
    post(0,0,83);L(-24,-72,24,-72,gold,3);for(const sd of [-1,1]){L(sd*22,-72,sd*16,-43,teal,2);R(sd*18-5,-47,10,14,ink);R(sd*18-3,-45,6,10,paper);}O(0,-76,9,9,ink);O(0,-77,6,6,teal);R(-21,-36,42,27,p.roof);for(let j=0;j<3;j++){L(-16,-30+j*7,14,-30+j*7,paper);O(-11+j*8,-30+j*7,2,2,gold);}L(-21,-9,21,-9,gold,2);
  }else if(['routeBoard','noticeBoard','servicePlate','gardenPlaque','fieldnote'].includes(kind)){
    const wide=kind==='routeBoard'?1.25:1;post(-14*wide,0,39);post(14*wide,0,39);R(-22*wide,-45,44*wide,32,ink);R(-19*wide,-42,38*wide,26,p.roof);if(kind==='routeBoard'){for(let j=0;j<3;j++){L(-15,-36+j*8,14,-36+j*8,paper);L(-12+j*7,-39,-12+j*7,-17,teal);O(-12+j*7,-36+j*8,2,2,gold);}}else{page(-7,-19,17,20);page(10,-22,13,16);if(kind==='fieldnote'){seal(9,-23);if(o.complete){L(3,-26,7,-21,teal,2);L(7,-21,15,-31,teal,2);}}}P([[-26*wide,-45],[0,-53],[26*wide,-45]],p.wall);
  }else if(['shiftBook','readingTable','workbench','recordTray'].includes(kind)){
    R(-27,-20,54,6,gold);R(-23,-14,5,16,ink);R(18,-14,5,16,ink);page(-7,-22,24,18);L(-7,-38,-7,-24,p.roof);if(kind==='workbench'){O(14,-26,8,8,ink);O(14,-26,5,5,p.wall);L(11,-30,17,-22,gold,2);L(17,-30,11,-22,gold,2);}else{R(14,-36,5,14,p.wall);P([[11,-36],[16,-44],[19,-36]],gold);}if(kind==='recordTray')page(18,-23,15,13);
  }else if(kind==='letterRack'){
    R(-24,-44,48,45,ink);R(-21,-42,42,40,p.roof);for(let yy=-40;yy<-3;yy+=12)for(const xx of [-14,0,14]){R(xx-5,yy,10,10,p.wall);L(xx-5,yy+3,xx,yy+7,paper);L(xx,yy+7,xx+5,yy+3,paper);}L(-25,0,25,0,gold,3);
  }else if(kind==='paperFloat'){
    const bob=Math.sin(t+o.size)*1.5;for(const [xx,yy]of [[-17,-1],[1,-7],[17,2]]){P([[xx-10,yy+bob],[xx-3,yy-10+bob],[xx+9,yy-2+bob]],paper);L(xx-3,yy-9+bob,xx+1,yy-2+bob,p.roof);L(xx-11,yy+3+bob,xx+10,yy+3+bob,teal);}
  }else if(kind==='nameShard'){
    O(0,1,17,5,ink);P([[-9,-3],[-13,-27],[0,-42],[12,-28],[8,-3]],p.water);P([[0,-39],[8,-28],[5,-5],[0,-12]],teal);L(0,-39,0,-7,paper,2);L(-6,-23,7,-22,paper);
  }else if(kind==='windChime'||kind==='mooringLamp'){
    if(kind==='mooringLamp'){lantern(0);L(-18,-1,18,-1,gold,3);}
    else{post(-19,0,56);L(-21,-54,20,-54,gold,3);for(let i=0;i<4;i++){const xx=-9+i*8+Math.sin(t*1.7+i)*1.3;L(xx,-51,xx,-19+i*3,paper);R(xx-2,-34+i*3,4,17,[teal,gold,p.wall,paper][i]);}P([[-25,-56],[0,-65],[25,-56]],p.roof);}
  }else if(kind==='delivery'){
    O(0,1,23,5,ink);R(-22,-27,44,28,ink);R(-19,-25,38,24,p.roof);L(-19,-13,19,-13,p.wall,2);L(0,-25,0,-1,gold,3);L(-18,-24,17,-2,p.wall,2);page(8,-7,14,17);seal(8,-12);if(o.complete){L(-6,-31,-1,-25,teal,3);L(-1,-25,9,-38,teal,3);}else R(-22,-29,44,5,gold);
  }else if(kind==='toolChest'){
    R(-25,-19,50,21,ink);R(-22,-17,44,17,p.roof);P([[-26,-21],[-22,-40],[21,-40],[26,-21]],ink);P([[-22,-23],[-19,-37],[18,-37],[22,-23]],p.wall);R(-20,-21,40,7,gold);L(-12,-21,-16,-31,paper,3);L(0,-19,3,-33,teal,3);L(10,-22,17,-29,paper,3);O(18,-30,4,4,gold);O(18,-30,2,2,ink);R(-3,-10,6,5,gold);
  }else if(kind==='keyDisplay'){
    post(-22,0,48);post(22,0,48);R(-28,-51,56,38,ink);R(-25,-48,50,32,p.roof);O(-10,-33,9,9,gold);O(-10,-33,5,5,ink);L(-3,-33,19,-33,gold,5);L(12,-33,12,-27,gold,3);L(19,-33,19,-27,gold,3);page(0,-5,25,10);R(-30,-15,60,4,p.wall);
  }else if(kind==='picnic'||kind==='coveredTrays'){
    if(kind==='picnic'){P([[-36,-13],[26,-13],[38,7],[-29,7]],paper);for(let j=0;j<3;j++)L(-28,-10+j*7,28,-10+j*7,p.coral,2);for(const xx of [-17,4,20])bowl(xx,-7);O(-5,-3,5,4,gold);R(-25,-26,17,12,p.roof);L(-23,-27,-22,-33,gold,2);L(-22,-33,-12,-33,gold,2);L(-12,-33,-10,-27,gold,2);}
    else{table(0,0,60);for(const xx of [-19,0,19]){O(xx,-23,8,4,paper);P([[xx-8,-24],[xx-4,-32],[xx+4,-32],[xx+8,-24]],p.wall);O(xx,-34,2,2,gold);}post(-30,0,49);post(30,0,49);P([[-36,-48],[0,-62],[36,-48],[31,-42],[-31,-42]],p.roof);L(-32,-46,32,-46,teal,3);}
  }else if(kind==='rehearsalBells'){
    post(-35,0,47);post(35,0,47);L(-38,-44,38,-44,gold,4);for(let i=0;i<4;i++){const xx=-27+i*18,yy=-26+Math.sin(t*.8+i)*.7,c=[teal,p.coral,paper,gold][i];L(xx,-43,xx,yy-8,paper,2);P([[xx-7,yy-8],[xx+7,yy-8],[xx+8,yy+5],[xx+11,yy+9],[xx-11,yy+9],[xx-8,yy+5]],ink);P([[xx-5,yy-6],[xx+5,yy-6],[xx+6,yy+6],[xx-6,yy+6]],c);O(xx,yy+10,2,2,gold);R(xx-5,-4,10,5,p.wall);for(let n=0;n<=i;n++)R(xx-3+n*2,-3,1,3,ink);}
  }else if(kind==='softChimes'||kind==='pennants'){
    post(-28,0,50);post(28,0,50);L(-28,-48,28,-48,gold,2);for(let i=0;i<4;i++){const xx=-20+i*13,sw=Math.sin(t*1.4+i)*2;if(kind==='softChimes'){L(xx,-47,xx+sw,-25+i*3,paper);R(xx+sw-2,-31+i*3,4,13,teal);O(xx+sw,-17+i*3,2,2,gold);}else{P([[xx,-46],[xx+12,-46],[xx+10+sw,-25],[xx+5+sw,-31],[xx+sw,-25]],[p.coral,teal,paper,gold][i]);L(xx+2,-43,xx+8,-43,ink);}}
  }else if(kind==='watchLamp'||kind==='hoodedLamp'){
    if(kind==='watchLamp'){lantern(0,-11);L(-13,0,13,0,p.wall,5);R(-4,-14,8,13,p.wall);O(0,-62,5,5,paper);}
    else{R(-16,-6,32,8,ink);R(-4,-17,8,12,p.wall);R(-10,-35,20,19,ink);R(-7,-31,14,12,paper);P([[-18,-35],[0,-45],[18,-35],[16,-27],[-16,-27]],p.roof);L(-14,-35,14,-35,gold,3);R(-2,-30,4,13,gold);}
  }else if(kind==='trellis'||kind==='birdPerch'){
    post(-25,0,48);post(25,0,48);L(-28,-45,28,-45,gold,3);if(kind==='trellis'){for(let xx=-18;xx<=18;xx+=12)L(xx,-44,xx,-4,p.wall,2);for(const yy of [-33,-20,-7])L(-25,yy,25,yy,p.wall,2);for(let i=0;i<5;i++){const xx=-20+i*10,yy=-8-(i%3)*12;sprout(xx,yy);O(xx-4,yy-17,3,3,p.coral);}}
    else{L(-26,-21,26,-21,p.wall,3);bird(-15,-25);bird(12+Math.sin(t)*1.5,-49,paper);R(-8,-13,16,12,p.roof);L(-9,-14,9,-14,gold,3);}
  }else if(kind==='hedge'||kind==='sunstrip'){
    if(kind==='hedge'){for(let i=0;i<5;i++){const xx=-28+i*14;O(xx,-7,12,9,p.deep);O(xx,-11,11,11,p.flora);O(xx-2,-16,7,7,teal);flower(xx,-3,i%2?paper:p.coral);}L(-32,1,34,1,p.roof,3);}
    else{P([[-41,-12],[34,-12],[41,5],[-34,5]],gold);for(let i=0;i<7;i++)flower(-29+i*10,-2,[paper,p.coral,teal][i%3]);post(-37,0,22);O(-37,-25,7,7,gold);for(let i=0;i<8;i++){const a=i*Math.PI/4;L(-37+Math.cos(a)*9,-25+Math.sin(a)*9,-37+Math.cos(a)*13,-25+Math.sin(a)*13,paper);}}
  }else if(kind==='mixedBed'||kind==='rotatingBeds'){
    if(kind==='mixedBed'){bed(0,0,65,2);sprout(25,-9);R(-29,-33,13,10,paper);L(-23,-22,-23,-8,p.wall,2);L(-27,-29,-18,-29,p.roof);}
    else{for(const [i,[xx,yy]]of [[-20,-18],[19,-18],[-20,2],[19,2]].entries()){bed(xx,yy,25);post(xx+13,yy,20);R(xx+8,yy-24,11,8,paper);for(let n=0;n<=i;n++)R(xx+10+n*2,yy-22,1,4,p.roof);}}
  }else if(kind==='shadeBench'||kind==='birdShade'){
    post(-29,0,48);post(29,0,48);P([[-39,-44],[0,-62],[39,-44],[31,-33],[-31,-33]],p.flora);L(-31,-43,31,-43,teal,3);if(kind==='shadeBench'){R(-24,-17,48,5,gold);R(-20,-12,5,14,ink);R(15,-12,5,14,ink);R(-23,-31,46,10,p.roof);L(-21,-19,-21,-8,p.wall,3);L(21,-19,21,-8,p.wall,3);}
    else{post(0,0,30);O(0,-29,19,5,gold);O(0,-29,15,3,p.water);bird(-14,-34);bird(22,-46,paper);L(22,-44,26,-34,gold);}
  }else if(kind==='letterTable'||kind==='visitingChairs'){
    if(kind==='letterTable'){table();page(-6,-22,24,17);seal(-6,-28);R(15,-34,4,12,p.wall);flower(17,-35,p.coral);}
    else{chair(-22,0);chair(22,0);table(0,-5,22);bowl(0,-30);flower(0,-35,paper);}
  }else if(kind==='schoolDesk'||kind==='leafletRack'){
    if(kind==='schoolDesk'){table(0,0,59);page(-14,-22,24,19);L(-14,-39,-14,-24,p.roof);L(4,-26,16,-38,ink,2);R(17,-32,7,10,p.wall);post(-29,-8,49);post(29,-8,49);R(-29,-56,58,24,ink);for(let i=0;i<3;i++)L(-21,-49+i*6,18-i*5,-49+i*6,paper,2);}
    else{post(-19,0,49);post(19,0,49);for(const [i,yy]of [-40,-24,-8].entries()){R(-25,yy,50,6,p.roof);for(const xx of [-14,0,14]){page(xx,yy,12,13);R(xx-3,yy-10,6,2,[p.coral,teal,gold][i]);}}P([[-28,-49],[0,-58],[28,-49]],gold);}
  }else if(kind==='appointmentClock'||kind==='memoryCounter'){
    if(kind==='appointmentClock'){post(0,0,56);O(0,-43,17,17,ink);O(0,-43,13,13,paper);L(0,-43,0,-52,ink,2);L(0,-43,7,-40,ink,2);L(-23,-22,23,-22,gold,3);for(const xx of [-15,0,15]){page(xx,-3,12,17);R(xx-3,-16,6,2,p.coral);}}
    else{table(0,0,64);R(-31,-20,62,19,p.roof);R(-26,-16,52,10,p.wall);for(const xx of [-20,0,20]){R(xx-7,-41,14,19,ink);R(xx-5,-39,10,15,p.water);L(xx-3,-34,xx+3,-34,paper);}L(-33,-23,33,-23,gold,3);}
  }else if(kind==='performanceCircle'||kind==='procession'){
    if(kind==='performanceCircle'){O(0,-1,33,13,gold);O(0,-1,29,10,p.roof);for(let i=0;i<7;i++){const a=i*Math.PI/3.5,xx=Math.cos(a)*39,yy=Math.sin(a)*16;R(xx-5,yy-10,10,9,p.wall);R(xx-6,yy-12,12,3,paper);}O(0,-13,10,11,ink);O(0,-14,7,8,p.coral);L(-8,-17,8,-17,gold,2);}
    else{for(const [i,xx]of [-29,0,29].entries()){post(xx,0,37+i%2*11);P([[xx+2,-36-i%2*11],[xx+22,-30-i%2*11],[xx+2,-21-i%2*11]],[p.coral,paper,teal][i]);L(xx-7,2,xx+5,-3,gold,3);}L(-40,7,43,7,teal,2);}
  }else if(kind==='shiftMemorial'||kind==='trainingBrake'){
    if(kind==='shiftMemorial'){R(-25,-5,50,7,ink);P([[-20,-5],[-16,-42],[16,-42],[20,-5]],p.wall);R(-12,-37,24,26,ink);for(let i=0;i<5;i++)L(-8,-32+i*4,8,-32+i*4,paper);O(0,-50,10,10,gold);O(0,-50,6,6,ink);L(-8,-57,8,-43,p.wall,2);flower(-24,-2,p.coral);flower(24,-2,teal);}
    else{table(0,0,63);O(-13,-32,13,13,ink);O(-13,-32,9,9,gold);O(-13,-32,5,5,p.roof);L(-13,-32,4,-43,paper,3);R(8,-37,18,13,p.roof);L(13,-25,23,-44,gold,3);O(24,-45,3,3,p.coral);page(10,-6,21,11);L(-30,-6,-34,1,teal,3);}
  }else if(kind==='routeShelter'||kind==='directWaymark'){
    if(kind==='routeShelter'){post(-31,0,39);post(31,0,39);P([[-37,-40],[-5,-57],[38,-40],[31,-30],[-31,-30]],p.roof);L(-35,-40,35,-40,gold,3);P([[-30,-32],[-30,0],[-15,0],[-15,-34]],p.wall);R(-8,-14,32,4,paper);R(-5,-10,3,12,ink);R(19,-10,3,12,ink);lantern(28,14);}
    else{post(0,0,48);P([[-26,-43],[17,-43],[27,-35],[17,-27],[-26,-27]],gold);L(-17,-35,17,-35,ink,2);P([[10,-40],[19,-35],[10,-30]],ink);R(-13,-17,26,11,p.roof);for(const xx of [-6,0,6])R(xx,-14,2,5,paper);}
  }else if(kind==='breakfastCart'||kind==='breakfastTable'){
    if(kind==='breakfastCart'){R(-25,-29,50,28,ink);R(-22,-26,44,22,p.roof);L(-27,-30,27,-30,gold,3);for(const xx of [-17,17]){O(xx,1,8,8,ink);O(xx,1,5,5,p.wall);O(xx,1,2,2,gold);}for(const xx of [-15,3,17])bowl(xx,-34);L(24,-12,36,-17,gold,3);L(36,-17,41,-12,gold,3);R(-8,-47,14,11,p.wall);L(-5,-46,-5,-56,paper);}
    else{table(0,0,74);R(-33,-9,66,4,p.roof);for(const xx of [-26,-9,9,26]){bowl(xx,-25);R(xx-3,-42,6,10,paper);}L(-35,-21,35,-21,teal,2);R(-30,-6,4,8,ink);R(26,-6,4,8,ink);}
  }else if(kind==='eliaShared'||kind==='eliaPrivate'){
    if(kind==='eliaShared'){bed(0,0,66);chair(-38,4);chair(38,4);sprout(0,-16);L(-15,-3,-15,-35,paper,2);R(-22,-42,14,9,gold);L(-18,-38,-12,-38,p.roof);}
    else{P([[-28,2],[-28,-35],[0,-51],[28,-35],[28,2]],p.deep);L(-26,-34,0,-47,gold,3);L(0,-47,26,-34,gold,3);for(const xx of [-24,24])L(xx,-33,xx,0,teal,2);bed(0,-1,35);flower(0,-13,paper);L(-24,2,24,2,p.wall,3);}
  }else if(kind==='riverMooring'||kind==='riverReeds'){
    if(kind==='riverMooring'){for(const xx of [-26,26]){post(xx,0,29);O(xx,-27,6,3,gold);}for(const yy of [-8,-3,2])L(-31,yy,31,yy,p.wall,3);L(-26,-25,-13,-15,paper,2);L(-13,-15,0,-13,paper,2);L(0,-13,13,-15,paper,2);L(13,-15,26,-25,paper,2);lowBoat(.45);}
    else{for(let i=0;i<11;i++){const xx=-31+i*6,h=22+i%4*7,sw=Math.sin(t*1.5+i)*2;L(xx,1,xx+sw,-h,teal,2);L(xx,-9,xx-7,-18,p.flora,2);R(xx+sw-2,-h-9,4,10,i%3?gold:paper);}for(const xx of [-21,6,24])L(xx-6,4,xx+9,4,p.water,2);}
  }else if(kind==='hoursAlbum'||kind==='hoursSatchels'){
    if(kind==='hoursAlbum'){table(0,0,64);P([[-26,-22],[-25,-44],[0,-39],[25,-44],[26,-22],[0,-17]],paper);L(0,-38,0,-18,p.roof,2);for(let i=0;i<4;i++){const xx=i<2?-18:7,yy=-35+i%2*10;R(xx,yy,11,7,[p.coral,teal,gold,p.water][i]);}R(-27,-22,54,3,gold);L(-6,-18,-6,-4,p.coral,2);}
    else{post(-28,0,43);post(28,0,43);L(-30,-42,30,-42,gold,3);for(const [i,xx]of [-20,0,20].entries()){L(xx,-40,xx,-22,paper,2);R(xx-9,-28,18,23,ink);R(xx-7,-26,14,19,[p.coral,p.roof,p.flora][i]);P([[xx-8,-26],[xx,-17],[xx+8,-26]],gold);O(xx,-17,2,2,paper);page(xx,-7,9,9);}}
  }
}
function prop(r,p,w,app){
  if(!p.name.startsWith('sh_'))return false;
  const s=(p.o.size||1)*(r.view.zoom||1),opts={...p.o,size:s};r.shadow(p.x,p.y,Math.max(7,20*(p.o.size||1)),.26);
  r.actor(p.x,p.y,p.z||0,(g,x,y)=>paint(g,x,y,p.name.slice(3),palette(w),app.game.time,opts,app.state.flags),{outline:true,rim:false,hides:true,xray:p.o.interactive?{color:w.palette.light,outline:'#e1d5af'}:false});return true;
}
function entity(r,e,w,app){
  if(isObject(e))return true;
  if(e.type==='minigame'&&e.preserveLayout)return prop(r,{name:'sh_rehearsalBells',x:e.x,y:e.y,z:0,o:{size:.78,interactive:true}},w,app);
  if(!['note','fieldnote','delivery'].includes(e.type))return false;
  const noteFlag=e.type==='note'?app.content.fieldNotes?.find(n=>n.id===e.record)?.flag:null;
  const complete=!!app.state.flags[e.flag||e.completeFlag||noteFlag],kind=e.type==='delivery'?'delivery':'fieldnote';
  return prop(r,{name:'sh_'+kind,x:e.x,y:e.y,z:0,o:{size:.74,complete,interactive:true}},w,app);
}
function badge(r,e,height,kind,color,time){
  r.overlay(g=>{const [x,y0]=r.w(e.x,e.y,height),y=y0+Math.sin(time*2+e.x)*.8,ink='#173a42';
    if(kind==='boss'){px.poly(g,[[x,y-7],[x+6,y],[x,y+7],[x-6,y]],ink);px.poly(g,[[x,y-5],[x+4,y],[x,y+5],[x-4,y]],color);px.rect(g,x-1,y-2,2,4,ink);}
    else if(kind==='ready'||kind==='complete'){px.ell(g,x,y,7,7,ink);px.line(g,x-4,y,x-1,y+3,color,2);px.line(g,x-1,y+3,x+5,y-4,color,2);}
    else if(kind==='available'){px.rect(g,x-6,y-8,12,15,ink);px.rect(g,x-4,y-6,8,11,color);px.rect(g,x-1,y-5,2,6,ink);px.rect(g,x-1,y+3,2,2,ink);}
    else if(kind==='active'){px.ell(g,x,y,7,7,ink);px.ell(g,x,y,5,5,color);px.line(g,x,y,x,y-3,ink,1);px.line(g,x,y,x+3,y+1,ink,1);}
    else{px.rect(g,x-7,y-6,14,10,ink);px.rect(g,x-5,y-4,10,6,color);px.poly(g,[[x-3,y+3],[x-3,y+7],[x+2,y+3]],ink);for(const xx of [-3,0,3])px.rect(g,x+xx,y-2,1,1,ink);}
  });
}
function marker(r,e,w,app){
  if(app.battle)return;const status=app.entityObjectiveState?.(e,w.zone.id)||{kind:'none'},active=app.nearest?.id===e.id,kind=status.kind||'none';
  if(kind==='tracked'){r.decal(()=>r.groundRing(e.x,e.y,14,'#ebc478',.34));return;}
  const object=isObject(e)||['note','fieldnote','delivery'].includes(e.type),height=object?65:e.type==='encounter'?(w.rigs.get(e.id)?.height||54)+7:46;
  if(['available','active','ready'].includes(kind)){badge(r,e,height,kind,kind==='ready'?'#b9e0b5':kind==='active'?'#a6d6d2':'#ebc478',app.game.time);if(active)r.textAt(e.x,e.y,height+16,(status.label||'SIDE QUEST').toUpperCase().slice(0,28),'#eadfc3',{outline:'#173a42'});return;}
  if(e.type==='encounter'&&app.content.encounters[e.encounter||e.id]?.boss){badge(r,e,height,'boss','#e8ad76',app.game.time);return;}
  if(active&&e.type==='npc')badge(r,e,height,kind==='complete'?'complete':'talk',kind==='complete'?'#88ada1':'#dce4ca',app.game.time);
}
function ground(r,w,app){
  const scene=SCENES[w.zone.id];if(!scene)return;const p=palette(w),motif=scene.motif,cx=16*16,cy=12.5*16;
  r.decal(g=>{g.save();g.globalAlpha=.2;const L=(x,y,xx,yy,c=p.gold,width=1)=>px.line(g,...r.w(cx+x,cy+y,0),...r.w(cx+xx,cy+yy,0),c,width);
    if(motif==='tide'||motif==='ferry'){for(let k=0;k<3;k++)for(let i=0;i<6;i++)L(-64+i*22,-15+k*13+Math.sin(i)*4,-42+i*22,-15+k*13+Math.sin(i+1)*4,p.paper);}
    else if(motif==='seed'){for(const side of [-1,1])for(let i=0;i<4;i++){L(0,29-i*16,side*17,-7-i*7,p.teal,2);L(side*17,-7-i*7,side*30,-4-i*7,p.gold);}L(0,32,0,-45,p.teal,2);}
    else if(motif==='heat'){for(const rr of [35,45])r.groundRing(cx,cy,rr,p.gold,.2);for(const side of [-1,1])L(side*45,0,side*95,0,p.paper,2);}
    else if(motif==='names'){for(const side of [-1,1]){L(0,-24,side*49,-32,p.paper);L(side*49,-32,side*49,25,p.paper);L(side*49,25,0,15,p.paper);for(let i=0;i<3;i++)L(side*10,-13+i*11,side*39,-19+i*11,p.teal);}L(0,-24,0,15,p.gold);}
    else if(motif==='lens'){for(const rr of [26,57])r.groundRing(cx,cy,rr,p.teal,.2);L(-82,0,82,0,p.paper);L(0,-62,0,62,p.paper);}
    else if(motif==='route'){for(let i=0;i<4;i++){L(-70,-28+i*19,65,-28+i*19,p.paper);const xx=-50+i*30;r.groundRing(cx+xx,cy-28+i*19,5,p.gold,.5);}}
    g.restore();});
}
D.SmallHoursArt={decorate,affects,person,isObject,prop,entity,marker,ground,scenes:SCENES,variants:VARIANTS,choices:CHOICES,objects:OBJECTS};
})();
