/* Wayfarer: The Glass Tide — authored Chapter II locations.
 * Windward Reach generation remains in overworld.js. All positions are world units.
 */
(function (root) {
  'use strict';
  const D = root.WayfarerData;
  if (!D || !D.zones) throw new Error('Chapter data needs WayfarerData.');
  const T = 16;

  function zone(id, name, subtitle, w, h, base = '.') {
    return {id, name, subtitle, w, h, tile:T, chapter:2,
      grid:Array.from({length:h}, () => Array(w).fill(base)),
      props:[], objects:[], groups:[], exits:[], blockers:[], spawn:{x:w*T/2,y:(h-6)*T}};
  }
  function rect(z, x, y, w, h, material) {
    for (let yy=Math.max(0,y); yy<Math.min(z.h,y+h); yy++)
      for (let xx=Math.max(0,x); xx<Math.min(z.w,x+w); xx++) z.grid[yy][xx]=material;
  }
  function disc(z, cx, cy, radius, material) {
    for (let y=0;y<z.h;y++) for (let x=0;x<z.w;x++)
      if (Math.hypot(x-cx,y-cy)<radius) z.grid[y][x]=material;
  }
  function path(z, points, width=4, material=':') {
    for (let i=1;i<points.length;i++) {
      const a=points[i-1], b=points[i], count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*3));
      for (let n=0;n<=count;n++) rect(z,Math.round(a[0]+(b[0]-a[0])*n/count)-(width>>1),Math.round(a[1]+(b[1]-a[1])*n/count)-(width>>1),width,width,material);
    }
  }
  function prop(z,type,x,y,extra={}) {
    const p={type,x:x*T,y:y*T,...extra}; z.props.push(p);
    if (type==='house'||type==='workshop') z.blockers.push({x:p.x-37,y:p.y-49,w:74,h:51});
    else if (type==='tree'||type==='pine') z.blockers.push({x:p.x-5,y:p.y-4,w:10,h:10});
    else if (type==='rock') z.blockers.push({x:p.x-7,y:p.y-5,w:14,h:10});
    else if (type==='windmill') z.blockers.push({x:p.x-12,y:p.y-8,w:24,h:18});
    return p;
  }
  function object(z,id,type,x,y,label,extra={}) {z.objects.push({id,type,x,y,label,...extra});}
  function group(z,id,x,y,enemies,extra={}) {z.groups.push({id,x,y,enemies,level:2,...extra});}
  function finish(z) {
    for(let y=0;y<z.h;y++)for(let x=0;x<z.w;x++)if(x===0||y===0||x===z.w-1||y===z.h-1)z.grid[y][x]='~';
    z.tiles=z.grid.map(row=>row.join('')); delete z.grid; return z;
  }

  // Save validation needs the world's dimensions before the seeded instance exists.
  // The host replaces this record with WayfarerWorld.create(state.world.seed).
  if (!D.zones.overworld) D.zones.overworld={
    id:'overworld',name:'The Windward Reach',subtitle:'Old roads beneath a restless sky',
    w:128,h:96,tile:T,chapter:2,generationVersion:1,placeholder:true,
    spawn:{x:224,y:1328},tiles:Array.from({length:96},()=>'.'.repeat(128)),
    props:[],objects:[],groups:[],exits:[],blockers:[],landmarks:[]
  };

  const refuge=zone('refuge','Windfall Refuge','Warm windows on a road through the wind',64,46);
  refuge.spawn={x:480,y:650};
  rect(refuge,1,1,62,4,'~'); rect(refuge,1,5,4,39,'~'); rect(refuge,59,5,4,39,'~');
  rect(refuge,5,5,54,3,','); rect(refuge,5,40,54,5,',');
  path(refuge,[[30,44],[30,33],[29,24],[30,16]],5);
  path(refuge,[[15,30],[29,30],[46,30],[48,34]],4);
  path(refuge,[[30,24],[18,20]],4); path(refuge,[[30,24],[43,18]],4);
  path(refuge,[[30,33],[18,35],[18,37],[15,39]],4);
  path(refuge,[[30,36],[37,37],[45,33]],4);
  path(refuge,[[30,21],[35,19]],3);
  disc(refuge,29.5,24,5.5,':'); disc(refuge,37,37,4,':');
  [[17,25,0],[46,25,1],[22,13,1],[43,13,0]].forEach(([x,y,variant])=>prop(refuge,'house',x,y,{variant}));
  prop(refuge,'workshop',18,34,{variant:1});
  prop(refuge,'windmill',11,16,{variant:0}); prop(refuge,'windmill',53,21,{variant:1});
  prop(refuge,'waystone',35,17,{variant:2}); prop(refuge,'bench',37,35);
  prop(refuge,'crate',14,38); prop(refuge,'crate',21,35); prop(refuge,'sign',32,39);
  [[27,39],[33,33],[25,25],[34,25],[19,30],[44,30],[15,36],[40,37],[32,17]].forEach(p=>prop(refuge,'lantern',...p));
  [[8,8],[9,28],[8,37],[14,9],[29,8],[52,8],[55,30],[55,38],[41,41],[22,41],[39,9]].forEach((p,i)=>prop(refuge,i%3?'tree':'pine',...p,{variant:i%3}));
  [[14,27],[20,27],[43,27],[49,27],[23,22],[37,22],[27,15],[38,14],[21,38],[45,37],[34,40],[12,33],[51,33]].forEach(p=>prop(refuge,'flower',...p));
  [[7,11],[7,22],[57,16],[57,34]].forEach(p=>prop(refuge,'reeds',...p));
  object(refuge,'mara','npc',480,370,'Talk to Mara',{name:'Mara',portrait:'mara'});
  object(refuge,'refugeCamp','camp',592,592,'Rest at the refuge lantern');
  object(refuge,'refugeWorkshop','workshop',288,584,'Use the refuge workshop');
  object(refuge,'refugeCache','chest',240,624,'Open the traveller’s supply chest',{loot:{ore:3,herb:3,shard:2}});
  object(refuge,'refugeHerb','gather',768,544,'Gather sheltered sunleaf',{material:'herb',amount:3});
  object(refuge,'refugeLore','lore',560,304,'Read the wind-road charter',{
    title:'A road for everyone',text:'Two beacons chart the Reach. The western light reads the sea. The eastern light reads the sky. Align both before you approach Stormglass Spire. These roads belong to everyone who travels them.'
  });
  refuge.exits.push({id:'refugeBack',type:'exit',x:480,y:704,label:'Return to the Windward Reach',target:'overworld',targetLandmark:'refuge',tx:224,ty:1328});
  D.zones.refuge=finish(refuge);

  // A long approach leaves room for two encounters, a final rest, and the arena.
  const spire=zone('spire','Stormglass Spire','Where the sky roads meet',64,66,'~');
  spire.spawn={x:512,y:960};
  rect(spire,25,56,15,9,'s');
  path(spire,[[32,64],[32,60],[25,58],[25,54],[24,47],[40,47],[40,41],[40,36],[32,33],[32,29]],5,'s');
  disc(spire,25,54,5.8,'s'); disc(spire,40,41,5.8,'s');
  path(spire,[[25,51],[22,49]],4,'s'); disc(spire,22,49,3.3,'s');
  path(spire,[[32,34],[25,35]],4,'s'); disc(spire,25,35,3.7,'s');
  path(spire,[[40,37],[37,37]],4,'s');
  // The arena's ground radius exceeds 190 + a 7-unit actor by a safe margin.
  disc(spire,32,20,15.8,'s');
  prop(spire,'engine',32,18); prop(spire,'spire',32,6); prop(spire,'arch',32,33);
  [[18,9],[46,9],[18,28],[46,28]].forEach(p=>prop(spire,'crystal',...p));
  [[17,22],[47,22],[20,40],[46,42],[20,54],[41,60],[21,48]].forEach(p=>prop(spire,'ruin',...p));
  [[29,59],[27,54],[26,47],[36,47],[42,41],[37,36],[27,35],[29,30],[35,30],[25,14],[39,14]].forEach(p=>prop(spire,'lantern',...p));
  prop(spire,'waystone',37,35,{variant:1}); prop(spire,'bench',24,34);
  object(spire,'spireCamp','camp',400,560,'Rest before the Tempest Loom');
  object(spire,'spireLore','lore',592,592,'Read the loom keeper’s record',{
    title:'An open current',text:'The Tempest Loom binds each wind to a single road. Its outer coils protect the central lens. Break their rhythm, then let the wind choose its own path.'
  });
  object(spire,'spireCache','chest',352,784,'Open the keeper’s supply chest',{loot:{ore:2,shard:2,herb:2,tonic:1}});
  group(spire,'spireApproach',400,864,['gustling','gustling']);
  group(spire,'spireBridge',640,656,['coilkeeper','gustling']);
  group(spire,'loom',512,320,['loom'],{boss:true,manual:true});
  object(spire,'loomConsole','boss',512,485,'Wake the Tempest Loom',{bossId:'loom'});
  object(spire,'skyheart','heart',512,200,'Restore the Skyheart',{bossId:'loom'});
  spire.exits.push({id:'spireBack',type:'exit',x:512,y:1024,label:'Return to the Windward Reach',target:'overworld',targetLandmark:'spire',tx:224,ty:1328});
  D.zones.spire=finish(spire);

  Object.assign(D.enemyStats,{
    gustling:{name:'Wind prowler',hp:130,atk:16,speed:64,r:10,range:28,xp:36,color:'#afc98f',wind:.65,cool:1.5},
    coilkeeper:{name:'Coil keeper',hp:180,atk:20,speed:35,r:12,range:150,xp:48,color:'#d8ad85',wind:.95,cool:2.15},
    loom:{name:'The Tempest Loom',hp:4800,atk:29,speed:18,r:30,range:65,xp:320,color:'#a3d8ee',wind:1.15,cool:2.55}
  });
  if(!D.recipes.some(r=>r.id==='focus'))D.recipes.push({
    id:'focus',name:'Stormglass focus',tag:'SKY SMITHING',chapter:2,unique:true,
    description:'Add 3 attack and 15 maximum energy to every companion. Refill the extra energy now.',cost:{ore:3,shard:4}
  });
  if(!D.zones.quay.exits.some(e=>e.id==='toReach'))D.zones.quay.exits.push({
    id:'toReach',type:'exit',x:512,y:656,label:'Sail to the Windward Reach',target:'overworld',tx:224,ty:1328,requiresChapterOne:true
  });
  D.chapterTwo={title:'A Sky Worth Sharing',world:'overworld',refuge:'refuge',spire:'spire',beacons:['windWest','windEast']};
})(typeof window!=='undefined'?window:globalThis);
