/* Cinder Choir: the continuous overworld.
 * Original terrain, routes, landmarks, and pixel art. No source-game assets.
 * Public my-3D2dge APIs only. TileMap supplies collision; visible ground tiles
 * are drawn directly so a large world does not bake a world-sized floor image.
 */
(() => {
'use strict';
const CC = globalThis.CC = globalThis.CC || {}, E = My3D2dge, px = E.px;
const O = {}, WIDTH = 176, HEIGHT = 144, BASE_WIDTH = 128, BASE_HEIGHT = 112, TILE = 16;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const WATER = new Set(['~', ',']), SAIL = new Set(['~', ',', '=']);
const BLOCK = new Set(['~', ',', 'm', 'n']);
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
const hash = (x,y,s=0) => {
  let n = Math.imul(x+17,374761393) ^ Math.imul(y+31,668265263) ^ Math.imul(s+7,1442695041);
  n = Math.imul(n ^ n>>>13,1274126177); return (n ^ n>>>16)>>>0;
};
const unit = (x,y,s=0) => hash(x,y,s)/4294967296;
// Keep the original chart coordinate basis. Growing east or south must not
// move a saved traveler, destination, or collected object from versions1–4.
const cell = (x,y) => ({cx:clamp(Math.round(x/100*(BASE_WIDTH-1)),2,WIDTH-3),cy:clamp(Math.round(y/100*(BASE_HEIGHT-1)),2,HEIGHT-3)});
const percent = (cx,cy) => [cx/(BASE_WIDTH-1)*100,cy/(BASE_HEIGHT-1)*100];
const point = (cx,cy) => ({x:(cx+.5)*TILE,y:(cy+.5)*TILE,z:0});
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const PALETTES = {
  1: {'~':'#173848',',':'#356373','.':'#6b8060',f:'#416553',v:'#577a70',s:'#c2ac7f',d:'#aa976c',a:'#777069',g:'#7c8990',m:'#6d7d79',n:'#b2c4bd',':':'#ab9977','=':'#977554'},
  2: {'~':'#263849',',':'#446476','.':'#768273',f:'#526b64',v:'#688884',s:'#b3a38d',d:'#9c8979',a:'#82706f',g:'#839ca8',m:'#6b747c',n:'#c2cbd0',':':'#b1a18b','=':'#967969'}
};
O.palette = act => ({...PALETTES[act===2?2:1]});

const MAIN_ROUTE = ['lowquay','glassmine','wirewood','westrelay','lanternward','brassline','hushtheatre','civicvault','academy','witnessarchive','spireyard','highchoir','crownbridge','heartengine'];
const ROAD_BRANCHES = [['saltmill','lowquay'],['reedlock','wirewood'],['pilgrimpost','brassline'],['inkhaven','hushtheatre'],['shardroad','wirewood'],['emberpost','lanternward'],['morrowkiln','pilgrimpost'],['tideward','cinderstrand']];
const FRONTIER_ROADS = [['farharbor','tideglass'],['tideglass','mosswake'],['redspan','mirrorbay'],['redspan','stormloom']];
// These raised service walks join pairs of surface launches. Boats can pass
// under their bridge cells. Entering a launch leads to the station below.
const UNDERTIDE_ROADS = [['bellhaven','kelpvault'],['copperlung','palewreck'],['lumenreef','driftcourt'],['nightcable','firstharbor']];
// The city was built across a wide mainland. The outer settlements stand on
// separate islands. Curved coastlines and rivers are the same in chart and play.
const LAND = [[34,64,22,15],[48,47,29,24],[76,32,18,21],[48,24,22,13],[26,44,14,20],[67,69,14,12],
  [12,88,7,6],[23,84,8,5],[48,86,9,5],[79,80,10,8],[89,92,7,6],[61,94,6,4],
  [8,10,6,6],[47,9,6,4],[14,27,6,8],[6,44,4,7],[10,61,7,8],[88,48,7,7],[70,12,7,5]];
// The Far Reach uses explicit world cells, outside the former east boundary.
// The sea channel between the two regions remains a real boat/airship route.
const FRONTIER_LAND = [[140,81,10,10],[150,88,7,6],[159,75,10,10],[146,62,10,10],
 [157,49,9,9],[166,65,7,10],[139,34,9,13],[164,22,8,10]];
// Leave an open sea band below the old chart. Every old terrain cell remains
// exact; the new land begins at least four rows beyond its former boundary.
const UNDERTIDE_LAND = [[45,123,10,6],[64,132,10,7],[80,121,11,6],[95,136,11,5],
 [113,123,11,6],[129,136,10,5],[149,123,11,6],[163,137,9,4]];
const RANGES = [[[19,23],[23,31],[19,41],[16,48]],[[36,19],[46,17],[58,18],[67,24]],[[65,34],[72,40],[76,50]],[[38,67],[43,72],[43,79]],[[82,71],[84,79],[78,87]]];
const RIVERS = [[[28,28],[31,35],[28,43],[24,52],[18,62],[17,71],[11,76]],[[56,23],[54,32],[54,41],[54,51],[54,64],[57,73],[63,81]]];
const RIFTS = [[[17,80],[25,71],[32,65],[32,55],[35,45]],[[40,89],[42,79],[49,72],[59,69],[64,60]],[[73,90],[74,81],[84,73],[91,62]]];

const LANDMARKS = [
  ['saltwatch',14,66,'The Tide Names','harbor','Dema cut the harbor tide marks into this stone. Beside each mark is the name of someone who taught her to read it.','New marks stand above the old ones. Dema has left room for the next keeper.'],
  ['rootclock',29,56,'The Root Clock','forest','A copper pendulum counts the sap rising through a tree. A child has written: the tree did this before the clock.','The clock has stopped. New leaves move through its open face.'],
  ['crossing',36,58,'The Unlisted Crossing','forest','A small bridge carries no city seal. A plank lists the families who built it, including people absent from the tax rolls.','A repaired plank lists three new families. No one has removed the old names.'],
  ['freightgarden',49,64,'The Freight Garden','rail','Beans grow inside a goods wagon. The porter has crossed out its delivery order and written supper.','The wagon rests where the track ends. Its seeds have reached every nearby roof.'],
  ['milezero',43,28,'The First Mile','archive','Three rulers are carved into this stone. Each is longer than the last. The road did not change when its owner changed the price.','Someone has fixed a plain measuring cord beside the old rulers. Anyone may use it.'],
  ['witnesswall',57,25,'The Witness Wall','archive','People pressed their hands into soft lime here. The wall has no ranks, dates, or approved signatures.','The wall has cracked between the hand prints. Cloth ties hold the pieces in their original order.'],
  ['quietbell',70,38,'The Quiet Bell','citadel','A bell hangs above an open lift shaft. Its clapper lies beside a note: ring only after every worker returns.','The workers have returned. They have left the bell silent for those who cannot.'],
  ['hearthline',82,20,'The Hearth Line','citadel','A warm pipe runs from the engine to a distant row of huts. Someone added this branch after the plans were signed.','The pipe is cold. A cooking fire now stands at each end.'],
  ['saltletters',17,86,'Letters above the Tide','shore','Messages wait inside sealed jars. The oldest asks its reader to send word when the water is safe.','One jar holds a reply. The writer has drawn the new shoreline instead of promising that the old one will return.'],
  ['glassorchard',26,34,'The Glass Orchard','ruins','Clear fruit hangs from dead branches. Each fruit holds a different day of rain.','A green shoot has grown under the glass fruit. It casts a shadow that changes with the sun.'],
  ['stormsteps',10,32,'The Storm Steps','mountain','The stair rises toward a school built to study the wind. Every seventh step is wider, so a tired student can rest.','Fresh rope joins the broken flights. A note says that returning is part of every lesson.'],
  ['windsupper',68,82,'The Long Supper Table','opera','A stage carpenter built this table from a discarded theater door. There are no seats at its head.','Painted stones mark the places of travelers who could not stay. New seats fill the other side.'],
  ['northsignal',68,8,'The Last Weather Flag','sky','A small flag sends the day’s wind to ships beyond the city. The attendant changes it even when no ships answer.','Three distant flags answer this one. A new route is being learned one safe journey at a time.'],
  ['dawnlistening',63,97,'The Listening Shore','shore','The surf leaves a clear note between each pair of waves. Nothing here records it.','A stone bench faces the open sea. Someone has left a cup, a blanket, and no instructions.'],
  ['reachpilot',...percent(137,84),'The Unanswered Light','harbor','A lens faces west across the water. Its keeper turned it every night after the capital stopped answering.','Fresh oil waits beside the lens. Far Harbor has received an answer, but the keeper still watches for a smaller boat.'],
  ['reachglass',...percent(151,91),'The Seventh Tide Mark','shore','Six tidy tide marks end below a rough seventh line. The rough line was cut by a traveler who arrived during a storm.','The seventh mark has been checked and dated. Its rough edge remains beside the six formal ones.'],
  ['reachreed',...percent(162,78),'The Floating Seed Bed','forest','A wooden seed bed rises and falls on four sealed barrels. Its roots reach water that the old canal schedule never counted.','Young beds have been copied along the sheltered shore. Each has a ladder for checking its barrels.'],
  ['reachfreight',...percent(143,65),'The Waiting Freight Bell','rail','A low bell stands beside a high freight line. A painted palm tells the driver to stop when the ground crew rings it.','The bell has a new rope. The palm sign now appears in the cab as well as on the ground.'],
  ['reachsnow',...percent(137,40),'The Snow Measure','mountain','A measuring pole leans beside a straight one. The leaning pole marks where snow slid before the shelter was built.','Both poles remain. The path follows the stable ground between them, with a rest seat above the drift.'],
  ['reachsail',...percent(162,46),'The Torn Test Sail','sky','A split sail hangs on a testing frame. Four neat patches failed before one broad seam allowed the cloth to move.','The test sail hangs beside the new canopy cloth. Its failed patches are labeled with the winds that tore them.'],
  ['reachmirror',...percent(168,69),'The Name Left Blank','archive','A polished marker holds an empty name plate. A note says its owner chose to be remembered here without being named.','Someone has placed flowers below the empty plate. No new letters have been added.'],
  ['reachhorizon',...percent(167,25),'The Farther Shore','citadel','The last survey marker faces water without a measured end. The chart behind it calls this an edge.','A new sheet is clipped beside the chart. At its top: Start with what the next traveler can confirm.'],
  ['depthbell',...percent(43,125),'The Bell above Water','harbor','A signal bell rests on three stones. Its cord descends through the landing deck to people who work below.','The bell has a second cord. A traveler below can hear that someone above has accepted the return watch.'],
  ['depthkelp',...percent(65,133),'The Root Floats','forest','Four sealed floats carry a bed of young kelp. Their different colors mark different planting dates.','A new bed waits beside the four older ones. The gardener can compare roots of the same age.'],
  ['depthlung',...percent(81,124),'The Empty Pressure Bottle','mine','A heavy bottle stands with its valve open. It was kept here to show what an empty vessel feels like.','The bottle remains open. A learner can check it before they lift a charged bottle from the store.'],
  ['depthwreck',...percent(97,137),'The Mast without a Flag','ruins','A broken mast marks the wreck entrance. No flag says who owns the names in the cabin below.','A clear route sign hangs from the mast. The names below are available to the people who seek them.'],
  ['depthreef',...percent(116,124),'A Light Left Dark','shore','One lamp is covered with a dark cloth. A small sign asks visitors to let the reef have its night.','The cloth hangs beside a marked dark interval. The path remains safe with a lower light facing away from the water.'],
  ['depthcourt',...percent(131,136),'The Door above the Court','harbor','The court landing has no crest. Small marks beside its door show the heights of children who grew up below.','New marks stand above the old ones. Each has a date and a name chosen by the child.'],
  ['depthcable',...percent(151,126),'The Wire that Answers','rail','A thin return wire runs beside the thick main cable. Its support has been repaired more often than the cable tower.','The thin wire has its own protected support. An answer no longer depends on the condition of the command line.'],
  ['depthfirst',...percent(165,137),'The First Landing Stone','archive','The worn stone predates the harbor wall. Its wide steps face several coasts, not one approved route.','The stone is clear of the old barrier. Each step remains open to a different coast.']
];
// The codex can read collected records from either act without constructing
// terrain, collision maps, encounters, or render assets for the previous world.
O.landmarkRecords=(act=1)=>{
  act=act===2?2:1;
  return LANDMARKS.map(([shortId,x,y,title,theme,before,after])=>{
    const key=`ow:act${act}:landmark:${shortId}`;
    return {key,id:key,title,text:act===2?after:before,act};
  });
};
const CHESTS = [[22,69],[24,60],[37,48],[39,64],[50,77],[62,52],[45,32],[35,23],[65,18],[76,33],[86,37],[91,18],[8,88],[28,84],[52,90],[70,75],[85,85],[58,96],
 ...[[134,78],[147,92],[163,72],[141,60],[134,31],[154,44],[169,61],[161,17],
 [48,120],[60,133],[84,119],[91,138],[110,120],[126,139],[145,120],[168,139]].map(([x,y])=>percent(x,y))];
const CAMPS = [[22,68,'Soot Coast Camp'],[31,48,'Root Camp'],[51,55,'Lantern Camp'],[52,23,'Archive Camp'],[76,28,'High Road Camp'],[17,89,'Strand Camp'],[64,79,'Wind Camp'],[79,79,'East Camp'],
 [...percent(141,84),'Far Reach Mooring'],[...percent(156,75),'Reedbank Camp'],[...percent(140,38),'Pale Shelf Camp'],[...percent(157,52),'Sail Yard Camp'],
 [...percent(47,125),'Bell Watch Camp'],[...percent(80,125),'Copper Vent Camp'],[...percent(114,127),'Reef Night Camp'],[...percent(150,127),'Return Wire Camp']];
const ENCOUNTERS = {
  harbor:[['brassmite','ashling'],['hound','brassmite']], shore:[['miretoad','marshwisp'],['drowned','miretoad']],
  forest:[['briarling','moth'],['marshwisp','briarling']], rail:[['raildrone','sentry'],['ironhound','brassmite']],
  opera:[['chorister','moth'],['nullsinger','shade']], archive:[['pageswarm','glassling'],['archivist','mirrorling']],
  citadel:[['sentry','clockwork'],['cinderknight','choirguard']], mountain:[['frostbat','stormkite'],['thunderhead','frostbat']],
  ruins:[['duneprowler','ashbeetle'],['mirrorling','revenant']], mine:[['ashbeetle','brassmite'],['drowned','clockwork']],
  sky:[['stormkite','raildrone'],['thunderhead','nullsinger']], void:[['starspawn','remnant'],['nullsinger','starspawn']]
};

O.build = (act=1,places=CC.DATA?.places||[]) => {
  act = act===2?2:1;
  const rows = Array.from({length:HEIGHT},()=>Array(WIDTH).fill('~'));
  const inside = (x,y) => x>0&&y>0&&x<WIDTH-1&&y<HEIGHT-1;
  const get = (x,y) => inside(x,y)?rows[y][x]:'~';
  const set = (x,y,ch) => {if(inside(x,y))rows[y][x]=ch;};
  const disk = (cx,cy,rx,ry,ch) => {for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)set(x,y,ch);};
  const stroke = (vertices,radius,ch) => {
    const pts=vertices.map(v=>cell(v[0],v[1]));
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],steps=Math.ceil(Math.hypot(b.cx-a.cx,b.cy-a.cy)*2);
      for(let j=0;j<=steps;j++){const f=j/Math.max(1,steps);disk(Math.round(a.cx+(b.cx-a.cx)*f),Math.round(a.cy+(b.cy-a.cy)*f),radius,radius,ch);}
    }
  };
  for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++){
    const nx=x/(BASE_WIDTH-1)*100,ny=y/(BASE_HEIGHT-1)*100;
    const rough=Math.sin(nx*.61+ny*.28)*.05+Math.sin(nx*.23-ny*.55)*.05+Math.cos(nx*.91+ny*.37)*.027;
    const land=LAND.some(([cx,cy,rx,ry])=>((nx-cx)/rx)**2+((ny-cy)/ry)**2<1+rough)||FRONTIER_LAND.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1+rough)||(y>=BASE_HEIGHT+4&&UNDERTIDE_LAND.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1+rough));
    if(!land)continue;
    let ch='.';
    if(nx<42&&ny>38&&ny<65)ch='f';
    if(nx>38&&nx<56&&ny>40&&ny<58)ch='v';
    if(nx>21&&nx<43&&ny<41&&ny>22)ch=act===2?'g':'d';
    if(ny<19&&nx>23)ch='n';
    if(ny>78)ch=act===2?'a':'s';
    if(nx>75&&ny<34)ch=act===2?'a':'.';
    if(act===2&&ny>60&&ny<76&&Math.sin(nx*.11+ny*.2)>.35)ch='a';
    if(x>=BASE_WIDTH)ch=y<43?'n':y<65?'g':y>83?'s':y>68?'v':'.';
    if(y>=BASE_HEIGHT)ch=(x>54&&x<73)||(x>104&&x<123)?'v':(x>73&&x<90)||(x>139&&x<157)?'g':x>121&&x<139?'.':'s';
    set(x,y,ch);
  }
  for(const range of RANGES)stroke(range,2,'m');
  for(const range of [[[133,28],[138,23],[144,28],[146,38]],[[159,18],[165,16],[170,25]]])stroke(range.map(([x,y])=>percent(x,y)),1.6,'m');
  for(const river of RIVERS)stroke(river,1.3,'~');
  // Copper Fen is an inland island. Its lake connects to the eastern river.
  const copper=cell(46,47);disk(copper.cx,copper.cy,7.5,5.2,'~');
  stroke([[46,47],[54,49]],1.3,'~');disk(copper.cx,copper.cy,2.2,2.2,'v');
  if(act===2)for(const rift of RIFTS)stroke(rift,1.5,'~');

  const locations=places.map(place=>{
    const c=Array.isArray(place.worldCell)?{cx:clamp(Math.round(place.worldCell[0]),2,WIDTH-3),cy:clamp(Math.round(place.worldCell[1]),2,HEIGHT-3)}:cell(place.mapX,place.mapY),p=point(c.cx,c.cy);
    // A place always has a safe landing and a small clearing, in either act.
    disk(c.cx,c.cy,2.2,2.2,place.theme==='shore'?'s':place.theme==='ruins'&&act===2?'g':'.');
    return {id:place.id,name:place.name,region:place.region,theme:place.theme,kind:place.kind,level:place.level||1,place,...c,...p,mapX:p.x/(WIDTH*TILE)*100,mapY:p.y/(HEIGHT*TILE)*100};
  });
  const byId=Object.fromEntries(locations.map(l=>[l.id,l]));
  const roadCells=new Set(), roads=[];
  const carve = (x,y,bridge=true) => {
    if(!inside(x,y))return;
    const ch=get(x,y);if(!bridge&&WATER.has(ch))return;
    set(x,y,WATER.has(ch)||ch==='='?'=':':');roadCells.add(y*WIDTH+x);
  };
  const road = (a,b,wiggle=true,bridge=true) => {
    if(!a||!b)return;
    let x=a.cx,y=a.cy;carve(x,y,bridge);
    // Staircase diagonals keep a four-direction path continuous, including
    // at bridge ends. A slight bend avoids a chart made from ruler lines.
    const dx=b.cx-a.cx,dy=b.cy-a.cy,len=Math.hypot(dx,dy)||1;
    const bend=wiggle?((hash(a.cx,b.cy,act)%5)-2):0;
    const mid={cx:clamp(Math.round((a.cx+b.cx)/2-dy/len*bend),2,WIDTH-3),cy:clamp(Math.round((a.cy+b.cy)/2+dx/len*bend),2,HEIGHT-3)};
    for(const end of [mid,b]){
      const sx=x,sy=y,n=Math.max(Math.abs(end.cx-x),Math.abs(end.cy-y));
      for(let i=1;i<=n;i++){
        const tx=Math.round(sx+(end.cx-sx)*i/n),ty=Math.round(sy+(end.cy-sy)*i/n);
        while(x!==tx){x+=Math.sign(tx-x);carve(x,y,bridge);}while(y!==ty){y+=Math.sign(ty-y);carve(x,y,bridge);}
      }
    }
    roads.push({from:a.id||null,to:b.id||null});
  };
  for(let i=1;i<MAIN_ROUTE.length;i++)road(byId[MAIN_ROUTE[i-1]],byId[MAIN_ROUTE[i]]);
  for(const [a,b] of ROAD_BRANCHES)road(byId[a],byId[b]);
  for(const [a,b] of FRONTIER_ROADS)road(byId[a],byId[b]);
  for(const [a,b] of UNDERTIDE_ROADS)road(byId[a],byId[b]);
  // New numeric-unlock places join the nearest story road unless they are the
  // ferry island. This also keeps later content additions integrated.
  for(const l of locations)if(typeof l.place.unlock==='number'&&!MAIN_ROUTE.includes(l.id)&&l.id!=='copperfen'&&!ROAD_BRANCHES.some(a=>a[0]===l.id)){
    const target=locations.filter(p=>MAIN_ROUTE.includes(p.id)).sort((a,b)=>dist(a,l)-dist(b,l))[0];road(l,target);
  }
  // Add a shallow shelf along every coast. It remains navigable water.
  const shelves=[];
  for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)if(get(x,y)==='~'&&DIRS.some(([dx,dy])=>!WATER.has(get(x+dx,y+dy))))shelves.push([x,y]);
  for(const [x,y] of shelves)set(x,y,',');

  const footCell=(x,y)=>inside(x,y)&&!BLOCK.has(get(x,y));
  const waterCell=(x,y)=>inside(x,y)&&SAIL.has(get(x,y));
  const objects=[],docks=[],occupied=new Set(locations.flatMap(l=>{const a=[];for(let y=l.cy-2;y<=l.cy+2;y++)for(let x=l.cx-2;x<=l.cx+2;x++)a.push(y*WIDTH+x);return a;}));
  const nearestGround=(cx,cy,free=false,maxRadius=18)=>{
    let best=null,d=Infinity;
    for(let y=Math.max(2,cy-maxRadius);y<=Math.min(HEIGHT-3,cy+maxRadius);y++)for(let x=Math.max(2,cx-maxRadius);x<=Math.min(WIDTH-3,cx+maxRadius);x++){
      if(!footCell(x,y)||(free&&occupied.has(y*WIDTH+x)))continue;
      const q=(x-cx)**2+(y-cy)**2+(get(x,y)==='='?6:0);if(q<d){best={cx:x,cy:y};d=q;}
    }
    return best;
  };
  // Every destination has a shore landing on its own connected land area.
  // This lets the boat reach outer islands without turning sea travel into a menu.
  for(const l of locations){
    const candidates=[];
    for(let y=2;y<HEIGHT-2;y++)for(let x=2;x<WIDTH-2;x++)if(footCell(x,y)&&get(x,y)!=='=')for(const [dx,dy]of DIRS)if(waterCell(x+dx,y+dy)&&get(x+dx,y+dy)!=='='){
      candidates.push({cx:x,cy:y,wx:x+dx,wy:y+dy,d:(x-l.cx)**2+(y-l.cy)**2});break;
    }
    candidates.sort((a,b)=>a.d-b.d);
    const c=candidates[0];if(!c)continue;
    road(l,c,false);
    const found=docks.find(d=>Math.hypot(d.cx-c.cx,d.cy-c.cy)<3);
    if(found){found.places.push(l.id);l.dock=found.id;continue;}
    const land=point(c.cx,c.cy),water=point(c.wx,c.wy),id=`ow:act${act}:dock:${l.id}`;
    const dock={id,key:id,type:'dock',name:l.name+' landing',label:'Board boat',cx:c.cx,cy:c.cy,...land,land,water,places:[l.id],theme:l.theme,level:l.level,region:l.region};
    docks.push(dock);objects.push(dock);l.dock=id;occupied.add(c.cy*WIDTH+c.cx);
  }

  const nearestPlace=(x,y)=>locations.reduce((best,l)=>!best||dist(l,{x,y})<dist(best,{x,y})?l:best,null);
  const addObject=(type,shortId,nx,ny,data={})=>{
    const goal=cell(nx,ny),c=nearestGround(goal.cx,goal.cy,true);if(!c)return null;
    occupied.add(c.cy*WIDTH+c.cx);
    const p=point(c.cx,c.cy),l=nearestPlace(p.x,p.y),id=`ow:act${act}:${type}:${shortId}`;
    const o={id,key:id,shortId,type,...c,...p,name:data.title||data.name||type,label:data.title||data.name||type,region:l?.region||'The Open Reaches',level:Math.max(1,l?.level||1),theme:l?.theme||'forest',...data};
    // A short spur makes each rest point and secret a real reachable place.
    if(l&&dist(l,p)<TILE*15)road(l,c,false,false);
    objects.push(o);return o;
  };
  LANDMARKS.forEach(([id,x,y,title,theme,before,after])=>addObject('landmark',id,x,y,{title,label:'Read '+title,theme,text:act===2?after:before,reward:{gold:act===2?130:55}}));
  CHESTS.forEach(([x,y],i)=>addObject('chest','cache-'+(i+1),x,y,{label:'Supply cache',reward:i%4===0?{item:'revive',count:act===2?2:1}:i%4===1?{item:'ether',count:act===2?3:2}:i%4===2?{item:'remedy',count:3}:{gold:(act===2?160:70)+i*13}}));
  CAMPS.forEach(([x,y,name],i)=>addObject('camp','camp-'+(i+1),x,y,{name,label:name}));
  const roamingPlaces=locations.filter(l=>l.kind!=='town'||['lowquay','lanternward','academy','tideward','emberpost'].includes(l.id));
  roamingPlaces.forEach((l,i)=>{
    const angle=unit(i,act,99)*Math.PI*2,offset=4+i%3;
    const p=point(l.cx+Math.cos(angle)*offset,l.cy+Math.sin(angle)*offset);
    const formations=l.place.worldEncounters||ENCOUNTERS[l.theme]||ENCOUNTERS.forest;
    const o=addObject('enemy',l.id,p.x/(BASE_WIDTH*TILE)*100,p.y/(BASE_HEIGHT*TILE)*100,{label:'Roaming enemy',formation:formations[(act===2?1:0)%formations.length].slice(),level:act===2?Math.max(10,l.level):l.level,theme:l.theme,phase:unit(i,act)*Math.PI*2,home:l.id});
    if(o)o.base={x:o.x,y:o.y,z:0};
  });

  // River channels must meet the sea, including after the fall. A short lock
  // under an existing path is a bridge tile: boats pass beneath and walkers
  // keep their route. This repairs channels cut by a settlement clearing.
  const waterFlood=()=>{
    const seen=new Uint8Array(WIDTH*HEIGHT),queue=[WIDTH+1];seen[WIDTH+1]=1;
    for(let h=0;h<queue.length;h++){const n=queue[h],x=n%WIDTH,y=Math.floor(n/WIDTH);for(const [dx,dy]of DIRS){const xx=x+dx,yy=y+dy,k=yy*WIDTH+xx;if(!inside(xx,yy)||seen[k]||!waterCell(xx,yy))continue;seen[k]=1;queue.push(k);}}
    return seen;
  };
  let ocean=waterFlood();
  for(const dock of docks){
    const sx=Math.floor(dock.water.x/TILE),sy=Math.floor(dock.water.y/TILE),start=sy*WIDTH+sx;if(ocean[start])continue;
    // Multi-source breadth first search from this water component to the sea
    // finds the shortest missing link. Ground is only changed on that link.
    const prev=new Int32Array(WIDTH*HEIGHT);prev.fill(-1);prev[start]=start;const queue=[start];let goal=-1;
    for(let h=0;h<queue.length&&goal<0;h++){
      const n=queue[h],x=n%WIDTH,y=Math.floor(n/WIDTH);
      for(const [dx,dy]of DIRS){const xx=x+dx,yy=y+dy,k=yy*WIDTH+xx;if(!inside(xx,yy)||prev[k]!==-1)continue;
        // Keep the central landing tile of each destination intact.
        if(locations.some(l=>l.cx===xx&&l.cy===yy))continue;
        prev[k]=n;queue.push(k);if(ocean[k]){goal=k;break;}
      }
    }
    for(let n=goal;n>=0&&n!==start;n=prev[n]){const x=n%WIDTH,y=Math.floor(n/WIDTH);if(!waterCell(x,y))set(x,y,'=');}
    ocean=waterFlood();
  }

  const strings=rows.map(r=>r.join('')),palette=O.palette(act);
  const legend=Object.fromEntries(Object.keys(palette).map(ch=>[ch,{floor:ch,block:BLOCK.has(ch)}]));
  const map=new E.TileMap({rows:strings,legend,tile:TILE,ao:0,shimmer:false,floorTex:(x,y,tag)=>E.hex(palette[tag]||palette['.'])});
  const rowAt=(x,y)=>get(Math.floor(x/TILE),Math.floor(y/TILE));
  const canStand=(x,y,vehicle='foot',radius=0)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<radius+TILE||y<radius+TILE||x>=(WIDTH-1)*TILE-radius||y>=(HEIGHT-1)*TILE-radius)return false;
    if(vehicle==='airship')return true;
    const valid=(xx,yy)=>vehicle==='boat'?SAIL.has(rowAt(xx,yy)):!BLOCK.has(rowAt(xx,yy));
    return valid(x,y)&&(!radius||[[radius,0],[-radius,0],[0,radius],[0,-radius],[radius*.7,radius*.7],[-radius*.7,radius*.7],[radius*.7,-radius*.7],[-radius*.7,-radius*.7]].every(([dx,dy])=>valid(x+dx,y+dy)));
  };
  const at=(from)=>typeof from==='string'?byId[from]:from;
  const path=(from,to,vehicle='foot')=>{
    const a=at(from),b=at(to);if(!a||!b||!canStand(a.x,a.y,vehicle)||!canStand(b.x,b.y,vehicle))return null;
    const ax=Math.floor(a.x/TILE),ay=Math.floor(a.y/TILE),bx=Math.floor(b.x/TILE),by=Math.floor(b.y/TILE),start=ay*WIDTH+ax,goal=by*WIDTH+bx;
    const prev=new Int32Array(WIDTH*HEIGHT);prev.fill(-1);prev[start]=start;
    const queue=new Int32Array(WIDTH*HEIGHT);queue[0]=start;let head=0,tail=1;
    while(head<tail){const n=queue[head++];if(n===goal)break;const x=n%WIDTH,y=Math.floor(n/WIDTH);
      for(const [dx,dy]of DIRS){const xx=x+dx,yy=y+dy,k=yy*WIDTH+xx;if(!inside(xx,yy)||prev[k]!==-1||!canStand((xx+.5)*TILE,(yy+.5)*TILE,vehicle))continue;prev[k]=n;queue[tail++]=k;}
    }
    if(prev[goal]===-1)return null;const result=[];let n=goal;
    while(true){result.push(point(n%WIDTH,Math.floor(n/WIDTH)));if(n===start)break;n=prev[n];}
    return result.reverse();
  };
  const nearestDock=(x,y)=>docks.reduce((best,d)=>!best||dist(d,{x,y})<dist(best,{x,y})?d:best,null);
  const boardAt=(x,y)=>{
    const d=nearestDock(x,y);if(d&&dist(d.land,{x,y})<=TILE*2&&canStand(d.water.x,d.water.y,'boat',4))return {...d.water,vehicle:'boat',dock:d.id};
    return null;
  };
  const disembarkAt=(x,y)=>{
    const close=docks.filter(d=>dist(d.water,{x,y})<=TILE*2).sort((a,b)=>dist(a.water,{x,y})-dist(b.water,{x,y}));
    if(close.length)return {...close[0].land,vehicle:'foot',dock:close[0].id};
    const cx=Math.floor(x/TILE),cy=Math.floor(y/TILE),candidates=[];
    for(const [dx,dy]of DIRS){const p=point(cx+dx,cy+dy);if(canStand(p.x,p.y,'foot',4))candidates.push(p);}
    candidates.sort((a,b)=>dist(a,{x,y})-dist(b,{x,y}));return candidates.length?{...candidates[0],vehicle:'foot',dock:null}:null;
  };
  const landingAt=(x,y)=>canStand(x,y,'foot',5)&&rowAt(x,y)!=='='?{x,y,z:0,vehicle:'foot'}:null;
  const regionAt=(x,y)=>{
    if(WATER.has(rowAt(x,y)))return {id:'sea',name:act===2?'The Broken Sea':'The Open Sea',level:act===2?12:5,theme:'shore'};
    const p=nearestPlace(x,y);return {id:p?.region?.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'reaches',name:p?.region||'The Open Reaches',level:act===2?Math.max(10,p?.level||1):p?.level||1,theme:p?.theme||'forest'};
  };
  return {act,width:WIDTH,height:HEIGHT,tileSize:TILE,worldWidth:WIDTH*TILE,worldHeight:HEIGHT*TILE,rows:strings,palette,map,locations,byId,objects,docks,roads,spawnFor:id=>{const p=byId[id]||byId.lowquay||locations[0];return p?{x:p.x,y:p.y,z:0}:point(8,8);},canStand,regionAt,path,nearestDock,boardAt,disembarkAt,landingAt,tileAt:rowAt};
};

function bounds(r,world,padding=8){
  const points=[[-padding,-padding*1.5],[r.W+padding,-padding*1.5],[-padding,r.H+padding],[r.W+padding,r.H+padding]].map(([x,y])=>r.view.toGround(x+r.ix,y+r.iy)).filter(Boolean);
  if(!points.length)return {x0:0,y0:0,x1:world.width-1,y1:world.height-1};
  return {x0:clamp(Math.floor(Math.min(...points.map(p=>p[0]))/TILE)-1,0,world.width-1),x1:clamp(Math.ceil(Math.max(...points.map(p=>p[0]))/TILE)+1,0,world.width-1),y0:clamp(Math.floor(Math.min(...points.map(p=>p[1]))/TILE)-1,0,world.height-1),y1:clamp(Math.ceil(Math.max(...points.map(p=>p[1]))/TILE)+1,0,world.height-1)};
}
O.visibleBounds=bounds;
function polyTile(r,g,x,y,color){
  // The game's fixed north-up quarter view projects a tile to a rectangle.
  // One fill replaces a scanline polygon; other public views retain the quad.
  if(Math.abs(r.view.ay)<1e-8&&Math.abs(r.view.bx)<1e-8){
    const a=r.w(x,y),b=r.w(x+TILE,y+TILE),x0=Math.round(Math.min(a[0],b[0])),y0=Math.round(Math.min(a[1],b[1]));
    px.rect(g,x0,y0,Math.round(Math.max(a[0],b[0]))-x0+1,Math.round(Math.max(a[1],b[1]))-y0+1,color);
  }else px.poly(g,[r.w(x,y),r.w(x+TILE,y),r.w(x+TILE,y+TILE),r.w(x,y+TILE)],color);
}
function segment(r,g,x0,y0,x1,y1,color,z=0,width=1){const a=r.w(x0,y0,z),b=r.w(x1,y1,z);px.line(g,a[0],a[1],b[0],b[1],color,width);}
function drawMountain(r,cx,cy,ch,act){
  const x=(cx+.5)*TILE,y=(cy+.8)*TILE,n=unit(cx,cy),snow=ch==='n'||(cy<29&&n>.32),h=15+n*13;
  r.queue(x,y,0,g=>{
    const p=r.w(x,y,0),top=r.w(x-2,y-4,h),left=r.w(x-9,y,0),right=r.w(x+10,y+2,0);
    px.poly(g,[left,top,right],act===2?'#465763':'#475c57');
    px.poly(g,[top,[p[0]+1,p[1]-3],right],act===2?'#8b969d':'#92a194');
    px.poly(g,[left,top,[p[0]-1,p[1]-3]],act===2?'#687681':'#6e8379');
    if(snow)px.poly(g,[top,[top[0]+6,top[1]+11],[top[0]+1,top[1]+8],[top[0]-3,top[1]+12],[top[0]-6,top[1]+10]],act===2?'#d0d8d9':'#cbd7cc');
    px.line(g,left[0]+1,left[1],right[0]-1,right[1],act===2?'#53616d':'#52665c');
  });
}
function drawLocation(r,l,state,time){
  const act=state.act||1,seen=state.visited?.includes(l.id)||state.overworld?.discovered?.includes(l.id),accent=seen?'#c6d8b7':'#c7b98d';
  if(!r.visible(l.x,l.y,0,60,60,75))return;
  r.groundDisc(l.x,l.y,17,act===2?'#667168':'#819276',.65);
  r.queue(l.x,l.y,0,g=>{
    const [x,y]=r.w(l.x,l.y),k=r.view.zoom||1;
    const P=arr=>arr.map(([a,b])=>[x+a*k,y+b*k]),rect=(a,b,w,h,c)=>px.rect(g,x+a*k,y+b*k,Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)),c),line=(a,b,c,d,col)=>px.line(g,x+a*k,y+b*k,x+c*k,y+d*k,col);
    const house=(a,b,w=11,roof='#7f6263')=>{rect(a,b-9,w,10,'#c5b78d');rect(a+w-3,b-8,3,9,'#8f927f');px.poly(g,P([[a-2,b-9],[a+w/2,b-15],[a+w+2,b-9]]),roof);rect(a+3,b-4,3,5,'#354d52');rect(a+2,b-8,2,2,'#efcc82');};
    if(l.place.undertide){
      // A surface launch marks a station below the water. The wide deck is a
      // safe landing; the copper bell is an entrance, not a new vehicle.
      px.ell(g,x,y+5*k,21*k,8*k,'#314b58');px.ell(g,x,y+3*k,20*k,7*k,'#9c9479');
      for(const a of[-16,14]){rect(a,-1,3,10,'#b6bc9b');rect(a,6,3,3,'#64868a');}
      px.ell(g,x,y-9*k,11*k,11*k,'#be9a70');rect(-11,-10,22,15,'#ac855e');
      px.ell(g,x,y+4*k,13*k,4*k,'#d9b987');px.ell(g,x,y-9*k,8*k,7*k,'#d8b77b');
      rect(-5,-13,10,8,'#355e6b');rect(-3,-12,5,5,'#93d5cd');rect(-1,-25,2,8,'#d9c395');
      line(-16,-2,16,-2,'#756a5d');rect(-18,-8,2,6,'#d1bf91');rect(-19,-10,4,3,'#90daca');
      if(l.kind==='town'){rect(15,-9,2,8,'#d1bf91');px.poly(g,P([[17,-9],[23,-6],[17,-4]]),'#bd929c');}
    }else if(l.kind==='town'){
      house(-15,-3,12,l.theme==='shore'?'#69677b':'#6a8180');house(3,-7,13,l.theme==='ruins'?'#86736e':'#8b6863');house(-5,7,12,'#9d795b');
      if(l.theme==='harbor'||l.theme==='shore'){rect(16,-3,3,15,'#907154');line(17,-9,17,10,'#e6ce94');px.poly(g,P([[18,-9],[25,-3],[18,-3]]),'#7fa1a1');}
      if(l.theme==='sky'){rect(-2,-23,6,11,'#d2c89e');px.poly(g,P([[-4,-23],[1,-29],[6,-23]]),'#779397');}
    }else if(l.theme==='mountain'||l.theme==='mine'){
      px.poly(g,P([[-17,4],[-3,-24],[17,4]]),'#6f8581');px.poly(g,P([[-3,-24],[3,-4],[17,4]]),'#99a79c');
      px.ell(g,x,y-2*k,7*k,8*k,'#253e46');rect(-7,-2,15,7,'#263d43');rect(-9,2,3,5,'#c0b794');rect(7,2,3,5,'#c0b794');
    }else if(l.theme==='forest'){
      rect(-11,-8,23,14,'#a6a681');px.poly(g,P([[-15,-8],[0,-20],[15,-8]]),'#4f7762');rect(-4,-4,8,10,'#334f46');
      line(-12,-8,0,-18,'#7fa188');line(0,-18,13,-8,'#9fb49a');
    }else if(l.theme==='archive'||l.theme==='opera'){
      rect(-16,-10,32,17,'#bcb39b');px.poly(g,P([[-18,-11],[0,-22],[18,-11]]),l.theme==='opera'?'#8d6d88':'#8d9793');
      for(let i=-12;i<=12;i+=8){rect(i,-8,3,13,'#d8ccb1');rect(i+3,-8,2,13,'#7a8985');}rect(-17,5,35,3,'#e0d2a9');rect(-3,-4,6,11,'#384953');
    }else{
      rect(-13,-5,27,13,'#8e9b99');for(const a of [-14,7]){rect(a,-18,8,24,'#bdc1aa');rect(a+6,-18,2,24,'#667d81');px.poly(g,P([[a-2,-18],[a+4,-26],[a+10,-18]]),l.theme==='void'?'#797496':'#587f82');}
      rect(-4,-8,8,16,'#344b56');line(-9,-3,8,-3,'#e1c18a');
      if(l.id==='heartengine'||l.theme==='void'){px.disc(g,x,y-17*k,5*k,l.theme==='void'?'#c8b5e5':'#e3b489');rect(-1,-34,2,12,'#b6bca7');}
    }
    px.dot(g,x,y+10*k,accent);
  });
  if(state.overworld?.waypoint===l.id||state.waypoint===l.id)r.marker(l.x,l.y,36,{color:'#e7cb8c',offscreen:false});
}

// Position a tiny world label in logical Canvas pixels. UI exclusions include
// their borders. Returning null hides a label only when no clear space fits.
O.labelBounds=(r,x,y,z,text,exclusions=[])=>{
  const[sx,sy]=r.w(x,y,z),w=E.font.width(text,{font:'tiny'})+4,h=E.font.height(1,{font:'tiny'})+4,pad=2;
  if(w>r.W-pad*2||h>r.H-pad*2)return null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),base={x:clamp(Math.round(sx-w/2),pad,r.W-w-pad),y:clamp(Math.round(sy)-2,pad,r.H-h-pad),w,h};
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const clear=b=>b.x>=pad&&b.y>=pad&&b.x+w<=r.W-pad&&b.y+h<=r.H-pad&&!exclusions.some(e=>overlaps(b,e));
  if(clear(base))return base;
  const candidates=exclusions.flatMap(e=>[
    {...base,x:e.x-w-3},{...base,x:e.x+e.w+3},
    {...base,y:e.y-h-3},{...base,y:e.y+e.h+3}
  ]).filter(clear);
  return candidates.sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y))[0]||null;
};
O.draw = (r,world,state={},time=0,traveller=null,options={}) => {
  const act=world.act,pal=world.palette,b=bounds(r,world),scenery=bounds(r,world,64),rows=world.rows;
  r.sky([pal['~']]);
  r.decal(g=>{
    for(let cy=b.y0;cy<=b.y1;cy++)for(let cx=b.x0;cx<=b.x1;cx++){
      const ch=rows[cy][cx],x=cx*TILE,y=cy*TILE,n=hash(cx,cy,31),base=pal[ch]||pal['.'];
      polyTile(r,g,x,y,base);
      const p=r.w(x+3+n%8,y+3+(n>>>4)%9);
      if(WATER.has(ch)){
        if(n%3===0){const wave=(Math.floor(time*2)+n)%4,color=ch===','?(act===2?'#5e8290':'#648b8e'):(act===2?'#3d5161':'#275466');px.line(g,p[0]-3+wave,p[1],p[0]+3+wave,p[1],color);}
        if(ch===',')for(const [dx,dy]of DIRS){const near=rows[cy+dy]?.[cx+dx];if(near&&(!SAIL.has(near))) {
          const ax=x+(dx===1?TILE:0),ay=y+(dy===1?TILE:0);segment(r,g,ax,ay,ax+(dx?0:TILE),ay+(dy?0:TILE),act===2?'#8d9e9b':'#a9b4a0');
        }}
      }else if(ch==='='){
        const horizontal=rows[cy]?.[cx-1]==='='||rows[cy]?.[cx+1]==='=';
        for(let j=3;j<TILE;j+=4)segment(r,g,x+(horizontal?j:0),y+(horizontal?0:j),x+(horizontal?j:TILE),y+(horizontal?TILE:j),'#c3a47a');
        if(horizontal){segment(r,g,x,y+1,x+TILE,y+1,'#5c5b54');segment(r,g,x,y+15,x+TILE,y+15,'#5c5b54');}
        else{segment(r,g,x+1,y,x+1,y+TILE,'#5c5b54');segment(r,g,x+15,y,x+15,y+TILE,'#5c5b54');}
      }else if(ch===':'){
        px.line(g,p[0]-2,p[1],p[0]+1,p[1],act===2?'#c5b6a0':'#c8b68e');
        if(n%3===0)px.dot(g,p[0]+5,p[1]+3,act===2?'#938575':'#968462');
      }else if(ch==='s'||ch==='d'||ch==='a'||ch==='g'){
        const light=ch==='g'?'#b0c6c5':act===2?'#a18e85':'#c6b58b';
        px.line(g,p[0]-2,p[1],p[0]+3,p[1],light);
        if(n%4===0){const q=r.w(x+8,y+12);px.dot(g,q[0],q[1],act===2?'#6b6770':'#817b65');}
      }else if(ch!=='m'&&ch!=='n'){
        const color=ch==='v'?'#8ba48f':act===2?'#9ca697':'#93a779';
        px.line(g,p[0],p[1],p[0]-1,p[1]-2,color);px.line(g,p[0]+1,p[1],p[0]+2,p[1]-1,color);
        if(n%19===0)px.dot(g,p[0]+3,p[1]-1,act===2?'#d0bcc2':'#dbca91');
      }
    }
  });
  for(let cy=scenery.y0;cy<=scenery.y1;cy++)for(let cx=scenery.x0;cx<=scenery.x1;cx++){
    const ch=rows[cy][cx],n=hash(cx,cy,31),x=(cx+.5)*TILE,y=(cy+.6)*TILE;
    if(ch==='m'||ch==='n')drawMountain(r,cx,cy,ch,act);
    else if(ch==='f'&&n%3!==0)r.prop(n%4?'pine':'tree',x+(n%5)-2,y,0,{size:.42+(n%7)*.025,color:act===2?'#4e6a65':'#3d6652'});
    else if(ch==='v'&&n%5===0)r.prop('grass',x,y,0,{size:.7,color:act===2?'#95aaa0':'#829d7b'});
    else if(ch==='g'&&n%11===0)r.prop('crystal',x,y,0,{size:.33,color:'#a2c3cf'});
    else if((ch==='a'||ch==='d')&&n%13===0)r.prop('rock',x,y,0,{size:.5,color:act===2?'#85757e':'#a29478'});
  }
  for(const l of world.locations)drawLocation(r,l,state,time);
  const opened=state.overworld?.opened||[],read=state.overworld?.landmarks||[];
  for(const o of world.objects){
    if(o.type==='enemy'||!r.visible(o.x,o.y,0,40,40,50))continue;
    if(o.type==='chest')r.prop('chest',o.x,o.y,0,{size:.48,open:opened.includes(o.id)||opened.includes(o.key),color:'#c3a573'});
    if(o.type==='camp'){
      r.prop('brazier',o.x-4,o.y,0,{size:.48,light:true,lightRadius:28,lightIntensity:.4});
      r.queue(o.x+9,o.y-4,0,g=>{const p=r.w(o.x+9,o.y-4),k=r.view.zoom||1;px.poly(g,[[p[0]-10*k,p[1]+2*k],[p[0]-2*k,p[1]-11*k],[p[0]+11*k,p[1]+2*k]],'#b1ad87');px.poly(g,[[p[0]-2*k,p[1]-11*k],[p[0]+1*k,p[1]+2*k],[p[0]+11*k,p[1]+2*k]],'#7b8d7c');px.poly(g,[[p[0]-8*k,p[1]+2*k],[p[0]-2*k,p[1]-7*k],[p[0],p[1]+2*k]],'#3c5553');});
      r.groundRing(o.x,o.y,11,'#b5cba5',.5);
    }
    if(o.type==='landmark'){
      r.prop('pillar',o.x,o.y,0,{size:.38,broken:true,color:act===2?'#b0ada5':'#bbbd9d'});
      if(!read.includes(o.id)&&!read.includes(o.key))r.queue(o.x,o.y,22,g=>{const p=r.w(o.x,o.y,19+Math.sin(time*2)*2);px.poly(g,[[p[0],p[1]-3],[p[0]+2,p[1]],[p[0],p[1]+3],[p[0]-2,p[1]]],'#dfca8c');},{emissive:true});
    }
    if(o.type==='dock'){
      const p=o.land,q=o.water;r.decal(g=>{segment(r,g,p.x-5,p.y,p.x+5,p.y,'#aa9169',0,3);segment(r,g,p.x,p.y,q.x,q.y,'#aa9169',0,3);});
      r.prop('sign',o.x-6,o.y,0,{size:.47});
      if(!traveller||traveller.vehicle!=='boat')r.queue(q.x,q.y,0,g=>{const [x,y]=r.w(q.x,q.y);px.poly(g,[[x-7,y-2],[x+7,y-2],[x+3,y+3],[x-4,y+3]],'#8b7561');px.line(g,x-3,y-1,x+3,y-1,'#d2b483');});
    }
  }
  if(traveller){
    const near=world.locations.filter(l=>dist(l,traveller)<TILE*6).sort((a,b)=>dist(a,traveller)-dist(b,traveller))[0];
    if(near){
      const text=near.name.toUpperCase(),b=O.labelBounds(r,near.x,near.y,traveller.vehicle==='airship'?66:42,text,options.labelExclusions||[]);
      if(b)r.overlay(g=>E.font.text(g,text,b.x+2,b.y+2,'#eee3c2',{font:'tiny',shadow:'#1c303c'}));
    }
    O.drawVehicle(r,world,traveller,time);
  }
  // Light drifting cloud shadows give the moving world depth. They never mask
  // markers or controls, and no overlay is tied to a fixed screen aspect.
  if(traveller?.vehicle==='airship')r.overlay(g=>{
    for(let i=0;i<3;i++){const x=((time*8+i*173)% (r.W+110))-55,y=(i*83+29)%Math.max(1,r.H);px.blend(g,.07,'normal',()=>px.ell(g,x,y,42,9,act===2?'#bfc0d1':'#ecdfbd'));}
  });
};

O.drawVehicle=(r,world,traveller,time=0)=>{
  const vehicle=traveller?.vehicle;if(vehicle!=='boat'&&vehicle!=='airship')return;
  const x=traveller.x,y=traveller.y,a=Number.isFinite(traveller.facing)?traveller.facing:-Math.PI/2,c=Math.cos(a),s=Math.sin(a);
  if(vehicle==='boat'){
    const rel=(u,v,z=0)=>r.w(x+c*u-s*v,y+s*u+c*v,z);
    r.shadow(x,y,9,.22);
    r.queue(x,y,0,g=>{
      px.poly(g,[rel(15,0),rel(5,-7),rel(-12,-6),rel(-15,0),rel(-12,6),rel(5,7)],'#514b44');
      px.poly(g,[rel(12,0,2),rel(4,-6,2),rel(-11,-5,2),rel(-13,0,2),rel(-11,5,2),rel(4,6,2)],'#bc9970');
      px.poly(g,[rel(7,0,3),rel(3,-3,3),rel(-8,-3,3),rel(-10,0,3),rel(-8,3,3),rel(3,3,3)],'#6a7f7c');
      const base=rel(0,0,3),top=rel(0,0,20);px.line(g,base[0],base[1],top[0],top[1],'#e1cc9a');
      px.poly(g,[top,rel(0,0,8),rel(-11,0,8)],'#dfcba1');px.poly(g,[top,rel(0,0,8),rel(7,0,8)],'#9eb7b0');
      if(traveller.moving||Math.hypot(traveller.vx||0,traveller.vy||0)>1){for(const v of [-6,6]){const p=rel(-17,v),q=rel(-21-(Math.floor(time*5)%4),v*1.7);px.line(g,p[0],p[1],q[0],q[1],'#9eccc2');}}
    });
  }else{
    const z=28+Math.sin(time*2)*1.2,k=r.view.zoom||1;r.shadow(x,y,18,.27);
    r.queue(x,y,z,g=>{
      const [sx,sy]=r.w(x,y,z),flip=c<0?-1:1,P=pts=>pts.map(([u,v])=>[sx+u*k*flip,sy+v*k]);
      px.poly(g,P([[-24,-2],[-35,-7],[-29,1],[-34,7],[-23,4]]),'#9f6d69');
      px.poly(g,P([[-12,10],[10,10],[7,17],[-8,17]]),'#bd9161');
      px.line(g,sx-10*k,sy+1*k,sx-8*k,sy+14*k,'#d6bb84');px.line(g,sx+11*k,sy+1*k,sx+8*k,sy+14*k,'#d6bb84');
      px.ell(g,sx,sy,26*k,11*k,'#344d5d');px.ell(g,sx,sy-2*k,25*k,10*k,'#ad746c');px.ell(g,sx+2*k,sy-4*k,21*k,6*k,'#cf9b7b');
      for(const u of [-13,-3,8])px.line(g,sx+u*k,sy-10*k,sx+(u-2)*k,sy+7*k,'#e3bd8b');
      px.poly(g,P([[15,-6],[29,-1],[18,6]]),'#657e82');px.line(g,sx-18*k,sy+3*k,sx+18*k,sy+3*k,'#795862');
      px.rect(g,sx-4*k,sy+12*k,3*k,3*k,'#89c9bf');px.rect(g,sx+2*k,sy+12*k,3*k,3*k,'#efce91');
      const spin=Math.floor(time*16)%2?6:2;px.line(g,sx-11*k,sy+14*k-spin*k,sx-11*k,sy+14*k+spin*k,'#e3ce9c');
    });
  }
};
CC.OVERWORLD=O;
})();
