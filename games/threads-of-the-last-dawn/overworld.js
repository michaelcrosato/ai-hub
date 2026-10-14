/* Original five-age overworld. TileMap supplies collision; only visible terrain is drawn. */
(() => {
'use strict';
const D=globalThis.Dawn=globalThis.Dawn||{},E=globalThis.My3D2dge,C=D.Content;
if(!E||!C)throw new Error('Load engine.js and campaign content before overworld.js.');
const W=96,H=72,T=16;
const px=Object.assign({},E.px,{rect(g,x,y,w,h,c){E.px.rect(g,x,y,Math.round(w),Math.round(h),c);},line(g,x,y,xx,yy,c,w=1){E.px.line(g,x,y,xx,yy,c,Math.max(1,Math.round(w)));}});
const K={sea:0,shallows:1,grass:2,forest:3,mountain:4,road:5,bridge:6,field:7,ruins:8,snow:9,crystal:10,marsh:11,livingBridge:12};
const TYPES=['Deep water','Coastal water','Grassland','Forest','Mountain','Road','Bridge','Fields','Old foundations','Snow ridge','Crystal ground','Wet meadow','Living bridge'];
const COLORS={
  bell642:['#285870','#4b8fa1','#7a9564','#37674c','#857e76','#c3aa79','#b18b5d','#98a56a','#8e907f','#ced4c5','#84b7b5','#668d75','#8aaa71'],
  seed112:['#296c80','#58a4ab','#6b9b62','#2e684c','#7d8d79','#ad9967','#9d845b','#a5b879','#8e997a','#d0dec6','#79b7a3','#5d9274','#79aa69'],
  glass1186:['#355f81','#71aab8','#789c91','#487867','#889cac','#c2c1ab','#ada68e','#a1b9a1','#96a4ac','#dce6db','#9ac6d1','#6b9d9c','#83b79b'],
  ash2310:['#354e60','#607e87','#99917a','#5e715e','#787b85','#bba589','#9b8a72','#ad9c76','#727783','#bcc3c5','#8da9b4','#7a897a','#80a974'],
  fold:['#17314b','#375b78','#658b82','#3c716b','#627589','#a7b6a2','#94b4ae','#89aa94','#6d829a','#b7d0d0','#91cbd3','#5f9293','#a8d5b3']
};
const PLANS={
  bell642:{name:'The Larkspur Coast',subtitle:'Year 642 · Bells and open roads',spawn:[22,44]},
  seed112:{name:'The First Green',subtitle:'Year 112 · A watershed taking root',spawn:[22,44]},
  glass1186:{name:'The Prism Republic',subtitle:'Year 1186 · A coast made of records',spawn:[58,48]},
  ash2310:{name:'The Returning Coast',subtitle:'Year 2310 · Routes through the ash',spawn:[22,44]},
  fold:{name:'The Sea of Unspent Hours',subtitle:'The Fold · Roads between possible lives',spawn:[22,44]}
};
// The same landmarks, river bends and mountain spine can be read across the ages.
const POS={
  bell_quay:[22,42],bell_orchard:[40,37],bell_kiln:[27,23],bell_tower:[47,17],
  bell_mooring:[17,49],bell_shipyard:[26,55],bell_tidecaves:[11,59],bell_beacon:[76,58],bell_breakwater:[84,42],
  seed_camp:[22,42],seed_wilds:[35,44],seed_falls:[48,37],seed_vault:[64,24],
  seed_canopy:[18,25],seed_stoneweir:[47,45],seed_ambermine:[74,24],seed_seedhouse:[31,52],seed_crownmeadow:[62,55],
  glass_steps:[58,46],glass_archive:[61,30],glass_cistern:[72,38],glass_observatory:[73,18],
  glass_market:[51,50],glass_canalworks:[47,37],glass_mirrorgarden:[67,54],glass_signalhall:[79,24],glass_civicspire:[61,16],
  ash_relay:[22,42],ash_dunes:[40,45],ash_foundry:[64,24],ash_skybridge:[75,45],
  ash_saltroad:[32,53],ash_understation:[35,27],ash_cloudhangar:[58,51],ash_rainworks:[84,8],ash_homefield:[24,59],
  fold_shore:[22,42],fold_gallery:[42,32],fold_heart:[63,25],fold_crown:[76,15],fold_waystation:[32,53],fold_loom:[64,54],
  depth_bell_dock:[22,30],depth_seed_gate:[57,34],depth_glass_foyer:[83,34],depth_ash_camp:[44,60],depth_fold_quay:[25,22],
  hearth_haven:[34,28],hearth_mira_lane:[16,18],hearth_soren_bank:[38,53],hearth_ilex_path:[40,57],hearth_nyx_steps:[44,24],hearth_brann_yard:[48,30],hearth_vale_mast:[79,56],hearth_final_crossing:[53,61]
};
const ISLANDS=new Set(['bell_tidecaves','ash_rainworks']);
const MAIN_LAND=[[7,19],[15,11],[26,9],[36,13],[46,7],[58,10],[65,17],[78,16],[88,27],[89,41],[82,51],[77,62],[61,67],[48,62],[34,66],[22,59],[19,49],[8,42],[5,30]];
const ROADS=[
  [[22,42],[30,42],[36,39],[40,37],[47,37],[55,39],[62,45],[75,45],[84,42]],
  [[26,42],[27,33],[27,23],[36,21],[47,17],[57,17],[64,24],[73,18],[80,24],[84,42]],
  [[30,42],[31,52],[40,56],[51,54],[62,55],[76,58]],
  [[22,42],[15,37],[12,30],[18,25],[27,23]],
  [[64,24],[61,31],[60,39],[62,45],[62,55]]
];
const FLAG_KEYS=['bridge_seed','future_bridge','watershed_open','amber_safe','seedbank_living','forest_covenant','coast_pier_open','coast_tide_clear','coast_beacon_lit','coast_shared_harbor','records_public','clean_canal','names_returned','signal_public','civic_assembly','courier_road','relay_power','rain_clean','homes_shared'];
const BASE=new Map(),VARIANTS=new Map();
const flagSig=flags=>FLAG_KEYS.map(k=>flags[k]?'1':'0').join('');
const inside=(x,y,p)=>{let on=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])on=!on;}return on;};
const idx=(x,y)=>y*W+x;
const at=(a,x,y)=>x<0||y<0||x>=W||y>=H?K.sea:a[idx(x,y)];
const water=n=>n===K.sea||n===K.shallows;
const mountain=n=>n===K.mountain||n===K.snow;
const dry=n=>!water(n)&&!mountain(n);
function ellipse(a,cx,cy,rx,ry,kind,onlyLand=false){for(let y=Math.max(1,Math.floor(cy-ry));y<Math.min(H-1,Math.ceil(cy+ry+1));y++)for(let x=Math.max(1,Math.floor(cx-rx));x<Math.min(W-1,Math.ceil(cx+rx+1));x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1&&(!onlyLand||!water(a[idx(x,y)])))a[idx(x,y)]=kind;}
function line(a,points,kind,radius=0){
  const put=(x,y)=>{for(let yy=y-radius;yy<=y+radius;yy++)for(let xx=x-radius;xx<=x+radius;xx++)if(xx>0&&yy>0&&xx<W-1&&yy<H-1){const k=idx(xx,yy);a[k]=kind==='route'?(water(a[k])?K.bridge:K.road):kind;}};
  for(let i=1;i<points.length;i++){
    const A=points[i-1],B=points[i],steps=Math.max(1,Math.max(Math.abs(B[0]-A[0]),Math.abs(B[1]-A[1]))*2);let last=A;
    for(let j=0;j<=steps;j++){const x=Math.round(E.lerp(A[0],B[0],j/steps)),y=Math.round(E.lerp(A[1],B[1],j/steps));if(kind==='route'&&last[0]!==x&&last[1]!==y)put(last[0],y);put(x,y);last=[x,y];}
  }
}
function coast(a){const source=a.slice();for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(source[idx(x,y)]===K.sea){let shore=false;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]])if(!water(at(source,x+dx,y+dy)))shore=true;if(shore)a[idx(x,y)]=K.shallows;}}
function reqFor(z){
  const era={bell642:null,seed112:{chapterAtLeast:2},ash2310:{chapterAtLeast:3},glass1186:{chapterAtLeast:4},fold:{flags:['fold_open']}}[z.era];
  const special={bell_tower:{flags:['orchard_seen']},ash_skybridge:{flags:['bridge_seed']},fold_heart:{flags:['crown_open']},fold_crown:{flags:['engine_stopped']},bell_tidecaves:{flags:['transport_skiff']},ash_rainworks:{flags:['transport_airship']}}[z.id];
  if(!Object.hasOwn(z,'authoredOverworldRequires'))z.authoredOverworldRequires=z.overworldRequires||null;
  const entries=[era,z.authoredOverworldRequires,special].flat(Infinity).filter(Boolean),out={},extra=[];
  for(let item of entries){if(typeof item==='string')item={flags:[item]};for(const [key,value]of Object.entries(item)){if(key==='flags'||key==='notFlags')out[key]=[...new Set([...(out[key]||[]),...value])];else if(key==='chapterAtLeast')out[key]=Math.max(out[key]||1,value);else if(key==='chapterAtMost')out[key]=Math.min(out[key]||Infinity,value);else if(out[key]&&out[key]!==value)extra.push({[key]:value});else out[key]=value;}}
  return extra.length?[out,...extra]:Object.keys(out).length?out:null;
}
function iconFor(z){if(z.hearthTheme)return({haven:'town',clock:'works',tide:'waterworks',forge:'works',roots:'grove',ink:'tower',signal:'tower',hearth:'citadel'})[z.hearthTheme]||'town';if(z.dungeonId)return({tide:'harbor',roots:'grove',mirrors:'tower',storm:'works',hollow:'citadel'})[z.dungeonTheme]||'citadel';if(/harbor|moor|quay|shipyard|market/.test(z.style+' '+z.id))return'harbor';if(/town|camp|homefield|station/.test(z.style+' '+z.id))return'town';if(/garden|orchard|grove|meadow|canopy|wilds|seedhouse/.test(z.style+' '+z.id))return'grove';if(/mine|cave|vault|cistern/.test(z.style+' '+z.id))return'cave';if(/canal|weir|rainworks|falls/.test(z.style+' '+z.id))return'waterworks';if(/tower|beacon|spire|observatory/.test(z.id))return'tower';if(/workshop|kiln|foundry|hangar|signal/.test(z.style+' '+z.id))return'works';return'citadel';}
function regions(era){const names={bell642:['Westwake Coast','Seventh Ridge','Orchard Vale','Common Fields','Lantern Reach'],seed112:['The First Shore','Sleeping Stone','The Root Basin','Seedkeeper Plain','Youngwater Reach'],glass1186:['The Old Coast','The Civic Heights','Clear Channel','The Garden District','Eastern Mirrors'],ash2310:['The Tide Line','Broken Spine','The Living Basin','Homeward Fields','The Returning Sea'],fold:['The Shore Remembered','The Unchosen Heights','Where Rivers Meet','The Possible Fields','The Last Horizon']}[era];return names.map((name,i)=>({name,x:[15,49,43,44,78][i],y:[34,12,era==='fold'?37:34,58,era==='ash2310'?51:48][i]}));}
function generate(zone){
  const era=zone.era,a=new Array(W*H).fill(K.sea);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(inside(x+.5,y+.5,MAIN_LAND))a[idx(x,y)]=K.grass;
  ellipse(a,11,59,6,4,K.grass);ellipse(a,84,8,6,4,K.grass);ellipse(a,85,64,6,3,K.grass);
  line(a,[[27,13],[37,16],[47,11],[57,15],[69,18],[75,24]],K.mountain,2);
  ellipse(a,43,12,4,2,K.snow,true);ellipse(a,67,19,3,2,K.snow,true);
  for(const v of [[20,24,9,8],[32,44,7,8],[55,24,7,6],[65,53,8,7],[79,33,4,6]])ellipse(a,...v,K.forest,true);
  for(const v of [[27,51,7,5],[54,52,8,5]])ellipse(a,...v,K.field,true);
  line(a,[[50,11],[49,23],[43,32],[47,39],[43,51],[37,64]],K.sea,1);
  ellipse(a,70,38,9,6,K.sea);
  if(era==='seed112'){for(const v of [[27,33,9,9],[39,54,8,5],[58,41,7,5],[72,26,7,7]])ellipse(a,...v,K.forest,true);ellipse(a,45,47,6,6,K.marsh,true);}
  if(era==='glass1186'){ellipse(a,60,42,12,13,K.crystal,true);ellipse(a,73,20,8,7,K.crystal,true);ellipse(a,29,54,7,5,K.field,true);}
  if(era==='ash2310'){for(let i=0;i<a.length;i++)if(a[i]===K.forest||a[i]===K.field)a[i]=K.ruins;ellipse(a,71,40,13,10,K.sea);ellipse(a,17,51,5,8,K.sea);ellipse(a,84,8,6,4,K.mountain);ellipse(a,84,8,2,1,K.grass);}
  if(era==='fold'){for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=idx(x,y);if(!water(a[k])&&(Math.sin(x*.18)+Math.cos(y*.22)<-.35))a[k]=K.sea;else if(a[k]===K.grass&&E.hash2(x,y)>.68)a[k]=K.crystal;}}
  // These authored roads cross water on visible bridges. Side islands have no land road.
  for(const road of ROADS)line(a,road,'route');
  const nodes=ROADS.flat();
  for(const e of zone.landmarks){const x=e.x,y=e.y;ellipse(a,x,y,2,2,K.grass);if(ISLANDS.has(e.to))continue;let near=nodes[0];for(const p of nodes)if(Math.hypot(x-p[0],y-p[1])<Math.hypot(x-near[0],y-near[1]))near=p;line(a,[near,[Math.round((near[0]+x)/2),near[1]],[x,y]],'route');}
  for(const e of POIS[era])if(!e.requires){let near=nodes[0];for(const p of nodes)if(Math.hypot(e.x-p[0],e.y-p[1])<Math.hypot(e.x-near[0],e.y-near[1]))near=p;line(a,[near,[e.x,e.y]],'route');}
  line(a,[[40,37],[39,34]],'route');
  coast(a);
  // Offshore landing pads are dry. The Rain Works ring blocks skiffs; airships can cross it.
  if(era==='ash2310'){ellipse(a,84,8,6,4,K.mountain);ellipse(a,84,8,2,1,K.grass);}
  return a;
}
function changedTerrain(base,era,f){
  const a=base.slice();
  if(f.watershed_open&&era!=='seed112')line(a,[[48,28],[48,35],[48,43],[45,49]],K.shallows);
  if(f.forest_covenant||f.seedbank_living){for(const v of [[30,57,5,3],[56,53,5,4]])ellipse(a,...v,era==='ash2310'?K.field:K.forest,true);}
  if(f.amber_safe&&era==='ash2310')ellipse(a,71,25,4,3,K.field,true);
  if(f.rain_clean&&era==='ash2310'){ellipse(a,25,56,6,4,K.field,true);ellipse(a,50,49,5,4,K.marsh,true);ellipse(a,64,53,7,5,K.forest,true);}
  if(f.homes_shared&&era==='ash2310')ellipse(a,24,58,5,3,K.field,true);
  if(f.relay_power&&era==='ash2310')ellipse(a,35,27,3,2,K.crystal,true);
  if(f.records_public&&era==='glass1186')ellipse(a,54,47,4,3,K.field,true);
  if(f.civic_assembly&&era==='glass1186')ellipse(a,59,39,5,4,K.field,true);
  if(f.signal_public&&era==='glass1186')line(a,[[61,16],[69,20],[79,24]],'route');
  if(f.names_returned&&era==='glass1186')ellipse(a,67,54,5,4,K.field,true);
  if(f.clean_canal&&era==='glass1186')line(a,[[48,29],[48,37],[49,44]],K.shallows);
  if(f.coast_tide_clear)ellipse(a,15,56,3,3,K.shallows);
  if(f.coast_pier_open&&era==='bell642')line(a,[[17,49],[15,49],[15,53]],K.bridge);
  if(f.coast_beacon_lit&&era!=='seed112')ellipse(a,76,57,3,2,K.field,true);
  if(f.coast_shared_harbor&&era!=='seed112')line(a,[[19,46],[17,49],[22,53],[26,55]],'route');
  // Road and arrival pads always remain safe when later events change a biome.
  for(let i=0;i<a.length;i++)if(base[i]===K.road||base[i]===K.bridge)a[i]=base[i];
  if(era==='ash2310'&&(f.bridge_seed||f.future_bridge))line(a,[[63,45],[77,45]],K.livingBridge);
  if(era==='ash2310'&&f.courier_road)line(a,[[22,42],[25,48],[32,53],[42,54],[58,51]],'route');
  return a;
}
function note(id,era,name,x,y,lines,reward,requires=null){return{id:'discovery_'+id,type:'discovery',name,x,y,flag:'discovered_'+id,discoveryFlag:'discovered_'+id,requires,lines,foundLines:[name+' remains on your chart.','The road continues. You have kept what this place gave you.'],effects:[{type:'flag',id:'discovered_'+id},...(reward||[])]};}
const POIS={
  bell642:[
    note('bell_post','bell642','The Mile That Waited',30,48,['A road marker gives two distances to the quay. One is carved. The other was scratched in by a child.','Someone chose to count the walk home with a friend. Mira keeps the longer number.'],[{type:'gold',amount:45}]),
    note('bell_chime','bell642','Tide Chime',14,34,['Small shells hang from an abandoned tide gauge. The water plays three clear notes.','Soren copies the rhythm. It is a song that needs no bell tower.'],[{type:'item',id:'ether',count:1}]),
    note('bell_bottle','bell642','An Undelivered Map',85,64,['A sealed bottle holds a map of a harbour that has not been built.','The note says: Leave room for boats that have no flag. You return a clean copy to the sea.'],[{type:'gold',amount:90}],{flags:['transport_skiff']})
  ],
  seed112:[
    note('seed_stone','seed112','First Name Stone',28,30,['Five handprints circle a river stone. A sixth place remains empty.','Ilex sets her hand beside them. A place can welcome someone without knowing their name.'],[{type:'item',id:'tonic',count:2}]),
    note('seed_den','seed112','The Winter Den',71,48,['A small animal stores dry leaves beneath a root. The forest has never known frost.','Something in it still makes room for a season it has not seen.'],[{type:'item',id:'phoenix',count:1}]),
    note('seed_shore','seed112','A Seed Beyond the River',85,64,['On the little island, one tree leans toward the mainland. Its seeds fall into open water.','None can know which shore will keep them. You keep one for the journey.'],[{type:'item',id:'elixir',count:1}],{flags:['transport_skiff']})
  ],
  glass1186:[
    note('glass_cup','glass1186','The Unsold Morning',53,58,['A cup stands on a low wall beside a price card. The card has been crossed out.','Someone kept a difficult morning because a friend had shared it.'],[{type:'gold',amount:110}]),
    note('glass_pier','glass1186','The Old Waterline',20,45,['A brass line on a stone step marks the old sea level. The city record calls it an error.','Below the line, shells still cling to the wall. Nyx writes down what she can touch.'],[{type:'item',id:'ether',count:2}]),
    note('glass_bells','glass1186','The Silent Roof',83,62,['Broken bells lie beneath a tree. Each carries the name of a public square.','Soren hangs one low branch with a ribbon. Even a silent bell can show where people met.'],[{type:'item',id:'elixir',count:1}],{flags:['transport_skiff']})
  ],
  ash2310:[
    note('ash_flower','ash2310','The First Small Colour',35,58,['One yellow flower grows inside a road sign. Its roots hold the old word: OPEN.','Vale leaves a stone beside it so the next traveller will look down.'],[{type:'item',id:'panacea',count:2}]),
    note('ash_names','ash2310','A Map With New Names',70,56,['Someone has repaired the route board with a cooking pan. The towns have new names.','The old roads were wrong. The people who walk them were still able to draw new ones.'],[{type:'gold',amount:150}]),
    note('ash_cloud','ash2310','The Cloud Listener',83,11,['A weather recorder ticks on the far side of the peaks. Its last written forecast is: Not yet.','Vale turns the page. There is space for rain.'],[{type:'item',id:'elixir',count:2}],{flags:['transport_airship']})
  ],
  fold:[
    note('fold_letter','fold','A Letter Never Sent',28,56,['A letter addresses a traveller who chose to stay home. The page is warm.','Mira reads only its first line: I hope you found a good life. She folds it closed.'],[{type:'item',id:'phoenix',count:2}]),
    note('fold_boat','fold','The Boat Without a Shore',55,47,['A half-built boat rests beside an empty frame. Its maker had planned to see the sea.','You cannot finish every journey. You place the missing oar beside the boat.'],[{type:'item',id:'elixir',count:1}]),
    note('fold_note','fold','One More Measure',76,56,['Four notes drift above the water. A fifth would end the song.','Soren waits. For once, leaving a song open feels like a promise.'],[{type:'gold',amount:220}])
  ]
};

D.worldEntrance=function(zoneOrId){
  let zone=typeof zoneOrId==='string'?(C.zoneById?.[zoneOrId]||C.zones.find(z=>z.id===zoneOrId)):zoneOrId;const seen=new Set();
  while(zone?.overworldParent&&zone.overworldParent!==zone.id&&!seen.has(zone.id)){seen.add(zone.id);const parent=C.zoneById?.[zone.overworldParent]||C.zones.find(z=>z.id===zone.overworldParent);if(!parent)break;zone=parent;}
  return zone||null;
};
D.registerOverworlds=function(){
  C.overworldByEra={};C.overworlds=[];
  const locals=C.zones.filter(z=>z.kind!=='overworld');
  for(const [era,plan]of Object.entries(PLANS)){
    const id='world_'+era,landmarks=locals.filter(z=>z.era===era&&!z.overworldParent).map((z,i)=>{
      const p=z.worldMapPosition||POS[z.id]||[28+i*5,50];z.worldPosition={zone:id,x:p[0],y:p[1]};z.overworldRequires=reqFor(z);
      return{id:'landmark_'+z.id,type:'exit',to:z.id,name:z.name,x:p[0],y:p[1],tx0:p[0],ty0:p[1],icon:iconFor(z),requires:z.overworldRequires,lockedText:ISLANDS.has(z.id)?(z.id==='ash_rainworks'?'Repair the Cloudglass airship before entering the Rain Works.':'Complete the work at the Open Keel Yard to earn an amphibious skiff.'):'Follow the current story task to open this place.'};
    });
    let z=C.zones.find(v=>v.id===id);if(!z){z={id};C.zones.push(z);}
    const palette=Object.fromEntries(COLORS[era].map((c,i)=>[i,c]));
    const legend=TYPES.map((name,i)=>({id:i,name,color:palette[i],water:water(i),mountain:mountain(i),foot:dry(i),skiff:!mountain(i),airship:true}));
    Object.assign(z,{name:plan.name,description:plan.subtitle,era,kind:'overworld',isOverworld:true,style:'overworld',width:W,height:H,spawn:{x:plan.spawn[0],y:plan.spawn[1]},landmarks,entities:[],exits:[],palette,legend,regions:regions(era)});
    const base=generate(z);BASE.set(id,base);z.terrain=base;
    z.atlas={w:W,h:H,tileSize:T,terrain:base,landmarks,regions:z.regions,palette,legend};
    C.overworlds.push(z);C.overworldByEra[era]=id;
  }
  C.zoneById=Object.fromEntries(C.zones.map(z=>[z.id,z]));
  for(const z of locals)if(z.overworldParent){const parent=D.worldEntrance(z);if(parent?.worldPosition)z.worldPosition={...parent.worldPosition};}
  C.overworldDiscoveries=Object.values(POIS).flat();
  C.counts=Object.assign(C.counts||{},{zones:C.zones.length,localZones:locals.length,overworlds:C.overworlds.length,discoveries:C.overworldDiscoveries.length,overworldLandmarks:C.overworlds.reduce((n,z)=>n+z.landmarks.length,0),dungeonRooms:locals.filter(z=>z.dungeonId).length,dungeons:new Set(locals.filter(z=>z.dungeonId).map(z=>z.dungeonId)).size,hearthRooms:locals.filter(z=>z.hearthTheme).length});
  VARIANTS.clear();
};
D.getOverworldData=function(id,flags={}){
  const z=C.zoneById[id]||C.overworlds.find(v=>v.id===id);if(!z||z.kind!=='overworld')return null;
  const key=id+':'+flagSig(flags);if(VARIANTS.has(key))return VARIANTS.get(key);
  const terrain=changedTerrain(BASE.get(id),z.era,flags),data={id,w:W,h:H,tileSize:T,terrain,landmarks:z.landmarks,regions:z.regions,palette:z.palette,legend:z.legend};
  for(const e of z.landmarks)ellipse(terrain,e.x,e.y,1,1,K.grass);
  for(const e of POIS[z.era])ellipse(terrain,e.x,e.y,1,1,K.grass);
  if(VARIANTS.size>40)VARIANTS.clear();VARIANTS.set(key,data);return data;
};

function labelLines(text){const words=text.toUpperCase().split(' '),lines=[''];for(const word of words){const i=lines.length-1;if(lines[i]&&lines[i].length+word.length>20)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines.slice(0,2).join('\n');}
function miniTree(g,x,y,s,color,round=false){const t=typeof color==='string'?E.tones(color):color;px.rect(g,x-s,y,2*s,4*s,t.deep);if(round){px.ell(g,x,y-4*s,5*s,5*s,t.deep);px.ell(g,x-s,y-6*s,4*s,3*s,t.base);px.ell(g,x-2*s,y-7*s,3*s,2*s,t.lt);}else{px.poly(g,[[x-5*s,y],[x,y-10*s],[x+5*s,y]],t.deep);px.poly(g,[[x-4*s,y-s],[x,y-9*s],[x+3*s,y-s]],t.base);px.poly(g,[[x-3*s,y-4*s],[x,y-9*s],[x,y-4*s]],t.lt);}}
function landmarkArt(g,x,y,s,icon,p,lit){
  const ink='#193443',wall=p[9],roof=p[4],gold=lit?'#e5c17e':'#87948c';
  px.ell(g,x,y+2*s,13*s,4*s,'#294f52');
  const house=(xx,yy,w=10,h=8)=>{px.rect(g,xx-w*s/2,yy-h*s,w*s,h*s,ink);px.rect(g,xx-(w-2)*s/2,yy-(h-1)*s,(w-2)*s,(h-1)*s,wall);px.poly(g,[[xx-(w/2+2)*s,yy-h*s],[xx,yy-(h+6)*s],[xx+(w/2+2)*s,yy-h*s]],roof);px.line(g,xx-(w/2+1)*s,yy-h*s,xx,yy-(h+5)*s,gold,s);px.rect(g,xx-s,yy-5*s,3*s,5*s,ink);};
  if(icon==='grove'){miniTree(g,x-7*s,y,s,p[3]);miniTree(g,x+7*s,y-2*s,s,p[3]);miniTree(g,x,y-3*s,s*1.6,p[3]);for(const dx of [-8,7])px.rect(g,x+dx*s,y,2*s,2*s,gold);}
  else if(icon==='cave'){px.poly(g,[[x-13*s,y],[x-10*s,y-13*s],[x-2*s,y-20*s],[x+8*s,y-14*s],[x+13*s,y]],roof);px.poly(g,[[x-11*s,y],[x-7*s,y-13*s],[x-1*s,y-18*s],[x+2*s,y-2*s]],wall);px.ell(g,x+3*s,y-5*s,5*s,7*s,ink);px.rect(g,x+2*s,y-5*s,2*s,3*s,lit?'#78d1c4':'#789594');}
  else if(icon==='tower'){px.rect(g,x-5*s,y-23*s,10*s,23*s,ink);px.rect(g,x-4*s,y-22*s,7*s,22*s,wall);px.rect(g,x-8*s,y-25*s,16*s,5*s,roof);px.poly(g,[[x-9*s,y-25*s],[x,y-32*s],[x+9*s,y-25*s]],roof);for(let i=0;i<3;i++)px.rect(g,x-s,y-(7+i*6)*s,3*s,3*s,gold);px.rect(g,x-2*s,y-5*s,4*s,5*s,ink);}
  else if(icon==='citadel'){house(x,y,15,13);house(x-10*s,y-2*s,7,17);house(x+10*s,y-2*s,7,17);px.rect(g,x-3*s,y-10*s,6*s,10*s,ink);px.rect(g,x-s,y-8*s,2*s,8*s,gold);}
  else if(icon==='waterworks'){px.rect(g,x-15*s,y-4*s,30*s,4*s,p[1]);for(const side of [-1,1]){px.rect(g,x+side*10*s-2*s,y-10*s,4*s,12*s,wall);px.rect(g,x+side*10*s-3*s,y-11*s,6*s,2*s,roof);}px.rect(g,x-13*s,y-10*s,26*s,3*s,wall);house(x,y-11*s,10,6);}
  else if(icon==='works'){house(x,y,19,11);px.rect(g,x+7*s,y-23*s,5*s,16*s,roof);px.rect(g,x+6*s,y-24*s,7*s,3*s,wall);px.rect(g,x-7*s,y-6*s,5*s,3*s,gold);}
  else if(icon==='harbor'){px.rect(g,x-17*s,y,34*s,3*s,gold);for(const dx of [-13,12])px.rect(g,x+dx*s,y,2*s,7*s,roof);house(x-4*s,y,15,10);px.poly(g,[[x+5*s,y+4*s],[x+17*s,y+4*s],[x+14*s,y+8*s],[x+8*s,y+8*s]],roof);px.line(g,x+11*s,y+4*s,x+11*s,y-7*s,gold,s);px.poly(g,[[x+11*s,y-7*s],[x+16*s,y+2*s],[x+11*s,y+2*s]],wall);}
  else{house(x-6*s,y,11,8);house(x+6*s,y-5*s,12,10);}
}

class Overworld{
  constructor(zone,flags={},travelMode='foot'){
    this.isOverworld=true;this.flags=flags;this.data=D.getOverworldData(zone.id,flags);if(!this.data)throw new Error('Unknown overworld: '+zone.id);
    this.zone=Object.assign({},zone,{terrain:this.data.terrain,atlas:this.data});this.terrain=this.data.terrain;this.landmarks=this.data.landmarks;this.signature=flagSig(flags);this.time=0;
    this.map=new E.TileMap({w:W,h:H,tile:T,floor:this.terrain.map(n=>TYPES[n]),blocked:new Uint8Array(W*H),ao:0,shimmer:false});
    this.flow=new E.FlowField(this.map);this.entities=this.landmarks.map(e=>Object.assign({},e,{worldX:e.x,worldY:e.y,x:(e.x+.5)*T,y:(e.y+.5)*T,z:0,r:9}));
    for(const p of POIS[zone.era])this.entities.push(Object.assign({},p,{worldX:p.x,worldY:p.y,tx0:p.x,ty0:p.y,x:(p.x+.5)*T,y:(p.y+.5)*T,z:0,r:7}));
    this.entities.push({id:zone.id+'_orchard_gate',type:'gate',name:'Orchard Time Gate',to:'bell_orchard',x:39.5*T,y:34.5*T,tx0:39,ty0:34,z:0,r:9,lines:['This road returns to the Orchard of Hours. Its gates connect the ages.']});
    this.exits=[];this.travelMode=null;this.setTravelMode(travelMode);
  }
  terrainAt(x,y){return at(this.terrain,Math.floor(x/T),Math.floor(y/T));}
  canUseMode(mode,x=(this.zone.spawn.x+.5)*T,y=(this.zone.spawn.y+.5)*T){const tx=Math.floor(x/T),ty=Math.floor(y/T);if(tx<1||ty<1||tx>=W-1||ty>=H-1)return false;const n=this.terrain[idx(tx,ty)];return mode==='airship'||mode==='skiff'&&!mountain(n)||mode==='foot'&&dry(n);}
  setTravelMode(mode,force=false){if(!['foot','skiff','airship'].includes(mode))return false;if(this.travelMode===mode&&!force)return true;this.travelMode=mode;for(let y=0;y<H;y++)for(let x=0;x<W;x++)this.map.block(x,y,!this.canUseMode(mode,(x+.5)*T,(y+.5)*T));return true;}
  update(dt,app){this.time=app?.game?.time??this.time+dt;const flags=app?.state?.flags||this.flags,sig=flagSig(flags);if(sig!==this.signature){this.flags=flags;this.signature=sig;this.data=D.getOverworldData(this.zone.id,flags);this.terrain=this.data.terrain;this.zone.terrain=this.terrain;this.zone.atlas=this.data;this.map.floorTags=this.terrain.map(n=>TYPES[n]);this.setTravelMode(this.travelMode,true);}}
  interactables(app){return this.entities.filter(e=>!e.hideIf||!app.meets(e.hideIf));}
  draw(r,app){
    const t=app?.game?.time??this.time,p=this.data.palette,g=r.ctx,v=r.view,s=v.scale/1.5,forestT=E.tones(E.shade(p[3],.25)),grassDark=E.mix(p[2],p[3],.25),grassLight=E.mix(p[2],p[7],.45);
    px.rect(g,0,0,r.bw,r.bh,p[K.sea]);
    const corners=[[r.ix-40,r.iy-50],[r.ix+r.W+40,r.iy-50],[r.ix-40,r.iy+r.H+50],[r.ix+r.W+40,r.iy+r.H+50]].map(q=>v.toGround(...q));
    const x0=E.clamp(Math.floor(Math.min(...corners.map(q=>q[0]))/T),0,W-1),x1=E.clamp(Math.ceil(Math.max(...corners.map(q=>q[0]))/T),0,W-1),y0=E.clamp(Math.floor(Math.min(...corners.map(q=>q[1]))/T),0,H-1),y1=E.clamp(Math.ceil(Math.max(...corners.map(q=>q[1]))/T),0,H-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const n=this.terrain[idx(x,y)],a=r.w(x*T,y*T,0),b=r.w((x+1)*T,(y+1)*T,0),sx=Math.round(a[0]),sy=Math.round(a[1]),w=Math.round(b[0])-sx,h=Math.round(b[1])-sy,hash=E.hash2(x,y);
      const shore=n===K.grass&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>water(at(this.terrain,x+dx,y+dy))),c=shore?E.mix(p[2],p[5],.65):p[n];
      if(Math.abs(v.ay)<.001&&Math.abs(v.bx)<.001)px.rect(g,sx,sy,w+1,h+1,c);else px.poly(g,[r.w(x*T,y*T,0),r.w((x+1)*T,y*T,0),r.w((x+1)*T,(y+1)*T,0),r.w(x*T,(y+1)*T,0)],c);
      if(water(n)){
        if(hash>.55){const wave=(t*.28+hash*8)%1,xx=sx+2+hash*(w-8),yy=sy+h*(.22+wave*.55);px.rect(g,xx,yy,Math.max(2,w*.25),1,n===K.sea?p[1]:E.mix(p[1],'#d3e4ca',.25));}
        for(const [dx,dy]of [[-1,0],[0,-1]])if(!water(at(this.terrain,x+dx,y+dy))){if(dx)px.rect(g,sx,sy+2,2,h-4,p[9]);else px.rect(g,sx+2,sy,w-4,2,p[9]);}
      }else if(n===K.forest){miniTree(g,sx+w*.28,sy+h*.48,s*.8,forestT,hash>.55);miniTree(g,sx+w*.74,sy+h*.8,s,forestT,hash<.55);}
      else if(mountain(n)){const mx=sx+w*.5,my=sy+h*.83;px.poly(g,[[sx,my],[mx,sy-5*s],[sx+w,my]],E.shade(c,-.28));px.poly(g,[[sx,my],[mx,sy-5*s],[mx+2*s,my]],E.shade(c,.14));px.poly(g,[[mx-4*s,sy+4*s],[mx,sy-5*s],[mx+5*s,sy+5*s],[mx,sy+2*s]],p[9]);}
      else if(n===K.bridge||n===K.livingBridge){for(let yy=sy+2;yy<sy+h;yy+=4)px.rect(g,sx+2,yy,w-4,1,n===K.livingBridge?p[3]:p[4]);px.rect(g,sx+1,sy,2,h,p[9]);px.rect(g,sx+w-3,sy,2,h,p[9]);}
      else if(n===K.field){for(let yy=sy+3;yy<sy+h;yy+=5)px.rect(g,sx+3,yy,w-6,1,p[3]);}
      else if(n===K.ruins&&hash>.5){px.rect(g,sx+w*.25,sy+h*.3,6*s,3*s,p[4]);px.rect(g,sx+w*.65,sy+h*.64,3*s,5*s,p[9]);}
      else if(n===K.crystal&&hash>.6){px.poly(g,[[sx+w*.6,sy+h*.3],[sx+w*.73,sy+h*.65],[sx+w*.6,sy+h*.8],[sx+w*.45,sy+h*.62]],p[9]);}
      else if(n!==K.road){for(let j=0;j<3;j++){const q=E.hash2(x*3+j,y);px.rect(g,sx+2+q*(w-6),sy+3+((q*7)%1)*(h-6),(j%2?2:3)*s,1,j%2?grassDark:grassLight);if(q>.78)px.rect(g,sx+3+q*(w-6),sy+2+((q*7)%1)*(h-6),1,2,grassLight);}}
      if(n===K.road&&hash>.82)px.rect(g,sx+w*.6,sy+h*.5,2*s,1,p[4]);
    }
    for(const e of this.entities){
      if(!r.visible(e.x,e.y,0,80,80,60))continue;
      const active=app?.nearest?.id===e.id,ok=app?.meets?app.meets(e.requires):true,found=e.flag&&app?.state?.flags?.[e.flag];
      if(e.type==='exit'){
        r.queue(e.x,e.y,0,ctx=>{const [x,y]=r.w(e.x,e.y,0);landmarkArt(ctx,x,y,Math.max(.55,s),e.icon,p,ok);},{solid:true});
        r.textAt(e.x,e.y,110,labelLines(e.name),ok?'#efe2ba':'#adb3a4',{outline:'#163444'});
      }else if(e.type==='gate'){
        r.queue(e.x,e.y,0,ctx=>{const [x,y]=r.w(e.x,e.y,0),sc=Math.max(.55,s);px.ell(ctx,x,y-7*sc,8*sc,10*sc,'#c6a769');px.ell(ctx,x,y-7*sc,5*sc,8*sc,'#367d8e');px.line(ctx,x-3*sc,y-7*sc+Math.sin(t*2)*4*sc,x+3*sc,y-7*sc+Math.sin(t*2)*4*sc,'#b7edd5',sc);},{emissive:true});
        r.textAt(e.x,e.y,85,'TIME GATE','#bde7ce',{outline:'#17334a'});
      }else{
        r.queue(e.x,e.y,0,ctx=>{const [x,y]=r.w(e.x,e.y,0);px.poly(ctx,[[x,y-9*s],[x+5*s,y-4*s],[x,y+s],[x-5*s,y-4*s]],found?'#6f9e95':'#ecd392');px.rect(ctx,x-1,y-7*s,2,4*s,found?'#bad1bd':'#fff0c4');if(!found&&Math.sin(t*2+e.x)>.3)px.line(ctx,x-7*s,y-4*s,x+7*s,y-4*s,'#e8ddb0');});
        if(active)r.textAt(e.x,e.y,60,labelLines(e.name),'#eaddb8',{outline:'#163444'});
      }
      if(active)r.decal(()=>r.groundRing(e.x,e.y,12,ok?'#e6d299':'#899fa0',.65));
    }
  }
}
D.Overworld=Overworld;
D.TRAVEL_MODES={foot:{name:'On foot',speed:114,description:'Walk on land, roads and bridges.'},skiff:{name:'Amphibious skiff',speed:180,flag:'transport_skiff',description:'Sail on water. The skiff folds its runners out on land. Mountains block it.'},airship:{name:'Cloudglass airship',speed:250,flag:'transport_airship',description:'Fly above land, water and mountains. Change to walking only on clear land.'}};
D.drawOverworldTraveler=function(r,x,y,mode='foot',hero='mira',time=0,facing=0,moving=false){
  const s=Math.max(.6,r.view.scale/1.5),bob=moving?Math.sin(time*11):Math.sin(time*2)*.3;
  r.shadow(x,y,mode==='airship'?16:mode==='skiff'?11:5,.35);
  r.actor(x,y,0,(g,ox,oy)=>{
    const rect=(xx,yy,w,h,c)=>px.rect(g,ox+xx*s,oy+yy*s,Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)),c),poly=(p,c)=>px.poly(g,p.map(([xx,yy])=>[ox+xx*s,oy+yy*s]),c);
    if(mode==='airship'){
      const by=-21+Math.sin(time*2)*1.5;
      poly([[-11,-6],[-8,0],[8,0],[12,-6]],'#8b5c49');rect(-9,-7,18,3,'#cfaa75');
      for(const sd of [-1,1])px.line(g,ox+sd*7*s,oy-6*s,ox+sd*9*s,oy+(by+3)*s,'#d2bb8f',s);
      px.ell(g,ox,oy+by*s,20*s,9*s,'#31485d');px.ell(g,ox,oy+(by-1)*s,19*s,8*s,'#b8d5ca');px.ell(g,ox-5*s,oy+(by-3)*s,10*s,5*s,'#e5dfb9');
      rect(-1,by-8,2,15,'#8faeb5');poly([[16,by],[25,by-5],[23,by+4]],'#a2785d');
      for(const sd of [-1,1]){px.line(g,ox+sd*14*s,oy-6*s,ox+sd*21*s,oy-6*s,'#c4a474',2*s);px.line(g,ox+sd*19*s,oy-10*s+(Math.sin(time*22)*2)*s,ox+sd*19*s,oy-2*s-(Math.sin(time*22)*2)*s,'#aacfc7',s);}
    }else if(mode==='skiff'){
      poly([[-13,-5+bob],[-9,3+bob],[8,3+bob],[15,-5+bob]],'#254456');poly([[-10,-5+bob],[-7,1+bob],[7,1+bob],[11,-5+bob]],'#c29465');
      rect(-2,-14+bob,2,13,'#e4cf9c');poly([[0,-14+bob],[9,-5+bob],[0,-5+bob]],'#d8dbc0');rect(-6,-5+bob,4,2,'#966148');
      if(moving){px.line(g,ox-16*s,oy+4*s,ox-9*s,oy+4*s,'#a4d3ca');px.line(g,ox+7*s,oy+5*s,ox+15*s,oy+5*s,'#a4d3ca');}
    }else{
      const coat={mira:'#b86e53',soren:'#719bb0',brann:'#ba8755',ilex:'#8ea66b',nyx:'#a28abd',vale:'#79ada7'}[hero]||'#b86e53';
      rect(-3,-6,3,6+(moving?bob:0),'#233e49');rect(1,-6,3,6-(moving?bob:0),'#233e49');rect(-4,-11,8,7,coat);rect(-3,-11,3,5,E.shade(coat,.2));
      rect(-3,-16,6,6,'#d3b18b');rect(-4,-17,8,3,hero==='soren'||hero==='vale'?'#c7c0a3':'#725342');rect(facing>Math.PI/2||facing<-Math.PI/2?-3:2,-13,1,1,'#273b43');
      rect(-5,-10+bob,2,5,'#d3b18b');rect(4,-10-bob,2,5,'#d3b18b');
    }
  },{outline:true,rim:false});
};
D.registerOverworlds();
})();
