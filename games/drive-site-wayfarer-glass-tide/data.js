/* Wayfarer: The Glass Tide — original level, story and balance data. */
(function (root) {
  'use strict';
  const T = 16;
  function zone(id, name, subtitle, w, h, base) {
    return { id, name, subtitle, w, h, tile: T, grid: Array.from({ length: h }, () => Array(w).fill(base || '.')), props: [], objects: [], groups: [], exits: [], blockers: [], spawn: { x: w * 8, y: h * 16 - 100 } };
  }
  function rect(z, x, y, w, h, c) {
    for (let j = Math.max(0, y); j < Math.min(z.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(z.w, x + w); i++) z.grid[j][i] = c;
  }
  function disc(z, cx, cy, rad, c) {
    for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (Math.hypot(x - cx, (y - cy) * .92) < rad) z.grid[y][x] = c;
  }
  function path(z, pts, width = 3, c = ':') {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2;
      for (let j = 0; j <= n; j++) {
        const x = Math.round(a[0] + (b[0] - a[0]) * j / (n || 1)), y = Math.round(a[1] + (b[1] - a[1]) * j / (n || 1));
        rect(z, x - (width >> 1), y - (width >> 1), width, width, c);
      }
    }
  }
  function prop(z, type, x, y, o = {}) {
    const p = { type, x: x * T, y: y * T, ...o }; z.props.push(p);
    if (type === 'house') z.blockers.push({ x: p.x - 37, y: p.y - 49, w: 74, h: 51 });
    else if (type === 'tree' || type === 'pine') z.blockers.push({ x: p.x - 5, y: p.y - 4, w: 10, h: 10 });
    else if (type === 'rock') z.blockers.push({ x: p.x - 7, y: p.y - 5, w: 14, h: 10 });
    return p;
  }
  function obj(z, id, type, x, y, label, extra = {}) {
    z.objects.push({ id, type, x: x * T, y: y * T, label, ...extra });
  }
  function group(z, id, x, y, enemies, extra = {}) {
    z.groups.push({ id, x: x * T, y: y * T, enemies, ...extra });
  }
  function woods(z, positions, type = 'tree') { positions.forEach((p, i) => prop(z, type, p[0], p[1], { variant: i % 3 })); }
  function exits(z, id, x, y, label, target, tx, ty, extra = {}) {
    const e = { id, type: 'exit', x: x * T, y: y * T, label, target, tx: tx * T, ty: ty * T, ...extra }; z.exits.push(e);
  }
  const quay = zone('quay', 'Larkspur Quay', 'A harbour at the edge of the known world', 64, 46);
  rect(quay, 0, 33, 64, 13, '~'); rect(quay, 1, 30, 62, 4, ',');
  rect(quay, 29, 29, 7, 16, '='); rect(quay, 20, 39, 25, 4, '=');
  path(quay, [[32, 36], [32, 25], [31, 16], [33, 5]], 5);
  path(quay, [[12, 23], [31, 25], [49, 23]], 4); path(quay, [[31, 15], [17, 13]], 3);
  disc(quay, 31, 24, 5, ':');
  prop(quay, 'house', 17, 21, { variant: 0 }); prop(quay, 'house', 46, 20, { variant: 1 });
  prop(quay, 'house', 20, 9, { variant: 1 }); prop(quay, 'house', 49, 8, { variant: 0 });
  prop(quay, 'workshop', 13, 25); prop(quay, 'bench', 46, 27); prop(quay, 'sign', 35, 9);
  prop(quay, 'crate', 25, 40); prop(quay, 'crate', 40, 40); prop(quay, 'crate', 37, 34);
  [[28,29],[36,29],[27,19],[37,15],[11,26],[50,25]].forEach(p => prop(quay,'lantern',...p));
  woods(quay, [[5,5],[8,11],[6,20],[7,29],[12,6],[25,5],[28,7],[38,6],[56,8],[59,16],[55,26],[58,30],[7,35],[3,27],[41,11],[10,16]]);
  [[12,29],[16,28],[22,25],[43,27],[53,22],[39,7],[26,11]].forEach(p => prop(quay,'flower',...p));
  [[8,33],[12,33],[51,33],[54,32]].forEach(p => prop(quay,'reeds',...p));
  obj(quay, 'ada', 'npc', 30, 22, 'Talk to Keeper Ada', { name: 'Keeper Ada', portrait: 'ada' });
  obj(quay, 'quayCamp', 'camp', 25, 26, 'Rest at the lantern');
  obj(quay, 'workshop', 'workshop', 13, 27, 'Use the field workshop');
  obj(quay, 'seraBond', 'bond', 46, 28, 'A quiet moment with Sera', { hero: 'sera' });
  obj(quay, 'quayCache', 'chest', 42, 40, 'Open the dock chest', { loot: { herb: 2, ore: 2 }, note: 'A traveller’s supply chest. Take what the tide leaves.' });
  obj(quay, 'quayLore', 'lore', 35, 10, 'Read the weathered sign', { title: 'The old road', text: 'Follow the brass lamps through Glassfen. The tide relays mark the route to the observatory.' });
  exits(quay, 'toFen', 33, 5, 'Follow the road to Glassfen', 'fen', 29, 48);
  quay.spawn = { x: 32 * T, y: 35 * T };

  const fen = zone('fen', 'Glassfen', 'Where the reeds remember the stars', 68, 54);
  for (let y = 0; y < fen.h; y++) { const bx = Math.round(44 + Math.sin(y / 9) * 3); rect(fen, bx, y, 5, 1, '~'); }
  disc(fen, 11, 21, 7, '~'); disc(fen, 56, 44, 5, '~');
  path(fen, [[29,50],[29,39],[22,32],[24,21],[34,15],[38,5]], 4);
  path(fen, [[26,39],[39,35],[53,35],[57,23]], 3);
  path(fen, [[24,27],[33,28],[40,25],[47,24],[58,24]], 3);
  rect(fen, 42, 23, 10, 4, '='); rect(fen, 42, 34, 10, 4, '=');
  disc(fen, 22, 32, 5, ':'); disc(fen, 58, 24, 5, ':');
  woods(fen, [[6,6],[11,8],[19,6],[27,7],[32,3],[49,7],[56,9],[61,5],[63,16],[61,32],[63,45],[6,39],[9,48],[16,44],[19,51],[37,48],[37,42],[6,30],[17,29],[18,17],[29,19],[35,23],[34,35],[54,17],[53,29],[34,11],[4,49],[62,51]]);
  [[10,14],[15,16],[15,22],[16,25],[39,19],[43,30],[41,43],[50,41],[57,39],[53,49]].forEach(p=>prop(fen,'reeds',...p));
  [[24,35],[27,29],[30,22],[55,25],[59,27],[36,15],[19,39]].forEach(p=>prop(fen,'flower',...p));
  [[25,44],[26,21],[36,11],[52,24],[39,35]].forEach(p=>prop(fen,'lantern',...p));
  [[14,38],[34,43],[55,13],[59,39],[21,11]].forEach(p=>prop(fen,'rock',...p));
  prop(fen,'ruin',57,20); prop(fen,'ruin',20,30); prop(fen,'bench',35,15);
  obj(fen,'reedRelay','relay',21,31,'Restore the Reed Relay',{group:'reedGuard',order:0});
  obj(fen,'fenCamp','camp',35,16,'Rest at the road lantern');
  obj(fen,'fenHerb1','gather',25,41,'Gather sunleaf',{material:'herb',amount:2});
  obj(fen,'fenHerb2','gather',32,26,'Gather sunleaf',{material:'herb',amount:2});
  obj(fen,'fenOre','gather',55,15,'Collect copper',{material:'ore',amount:2});
  obj(fen,'fenCache','chest',58,23,'Open the reedwalker’s cache',{loot:{shard:2,tonic:1},secret:true});
  obj(fen,'fenLore','lore',58,21,'Read the broken survey plate',{title:'A sky under the earth',text:'SURVEY 04. The tide network still carries a signal. Its source lies beyond the upper atmosphere. The villagers call it a bell.'});
  group(fen,'firstReeds',29,40,['reedling','reedling'],{tutorial:true});
  group(fen,'reedGuard',22,32,['reedling','spitter','reedling']);
  group(fen,'eastCache',56,27,['spitter','mite'],{optional:true});
  exits(fen,'fenBack',29,50,'Return to Larkspur Quay','quay',33,8);
  exits(fen,'toAqueduct',38,5,'Enter the Sunken Aqueduct','aqueduct',31,48);

  const aqueduct = zone('aqueduct','Sunken Aqueduct','Old stone. A signal that should be silent.',66,54,'d');
  rect(aqueduct,0,0,66,54,'.'); rect(aqueduct,7,7,52,41,'s');
  rect(aqueduct,7,25,52,5,'~'); rect(aqueduct,25,7,5,42,'~');
  rect(aqueduct,27,25,9,5,'='); rect(aqueduct,25,15,5,5,'='); rect(aqueduct,25,37,5,5,'=');
  path(aqueduct,[[31,51],[31,41],[17,40],[17,33]],4,'s');
  path(aqueduct,[[32,40],[45,39],[49,34],[49,19],[39,16],[37,5]],4,'s');
  path(aqueduct,[[33,25],[33,18],[15,17]],4,'s');
  rect(aqueduct,7,25,20,5,'~'); rect(aqueduct,36,25,23,5,'~');
  rect(aqueduct,47,25,5,5,'=');
  [[9,11],[20,11],[36,10],[54,11],[11,34],[23,34],[40,34],[56,35],[12,46],[54,46],[35,22]].forEach(p=>prop(aqueduct,'ruin',...p));
  [[10,8],[22,8],[55,8],[10,48],[23,48],[56,48],[60,26],[4,19],[5,43]].forEach(p=>prop(aqueduct,'pine',...p));
  [[13,24],[21,24],[38,30],[45,30],[56,23],[25,12],[30,33]].forEach(p=>prop(aqueduct,'reeds',...p));
  [[31,43],[15,34],[31,20],[45,17],[37,7]].forEach(p=>prop(aqueduct,'lantern',...p));
  prop(aqueduct,'arch',37,7); prop(aqueduct,'bench',43,40); prop(aqueduct,'workshop',41,43);
  obj(aqueduct,'stoneRelay','relay',16,16,'Restore the Stone Relay',{group:'stoneGuard',order:1});
  obj(aqueduct,'skyRelay','relay',50,17,'Tune the Sky Relay',{group:'skyGuard',order:2,puzzle:true});
  obj(aqueduct,'aqueductCamp','camp',43,41,'Rest at the survey camp');
  obj(aqueduct,'orrenBond','bond',44,39,'A quiet moment with Orren',{hero:'orren'});
  obj(aqueduct,'aquaWorkshop','workshop',41,45,'Use the survey workshop');
  obj(aqueduct,'aquaCache','chest',14,42,'Open the survey chest',{loot:{ore:2,shard:2,tonic:1}});
  obj(aqueduct,'aquaHerb','gather',54,36,'Gather sunleaf',{material:'herb',amount:2});
  obj(aqueduct,'aquaOre','gather',21,20,'Collect copper',{material:'ore',amount:2});
  obj(aqueduct,'aquaLore','lore',35,23,'Read the tuning instructions',{title:'Three notes for a sleeping sea',text:'The surveyors wrote the order in light: LEAF, SUN, STAR. Restore the Sky Relay in that order. A wrong note resets the sequence.'});
  group(aqueduct,'aquaWelcome',32,39,['mite','spitter']);
  group(aqueduct,'stoneGuard',16,18,['mite','mite','spitter']);
  group(aqueduct,'skyGuard',49,21,['sentinel','spitter']);
  exits(aqueduct,'aquaBack',31,50,'Return to Glassfen','fen',38,8);
  exits(aqueduct,'toObservatory',37,5,'Open the Observatory Gate','observatory',31,42,{requiresRelays:true});

  const observatory=zone('observatory','The Tide Observatory','The sea was never the only thing listening.',64,48,'d');
  rect(observatory,7,5,50,40,'s');
  rect(observatory,7,5,6,40,'~');rect(observatory,51,5,6,40,'~');
  disc(observatory,32,19,15,'s');
  path(observatory,[[31,45],[31,37],[32,29]],6,'s');
  [[15,10],[49,10],[15,20],[49,20],[15,31],[49,31],[23,38],[41,38]].forEach(p=>prop(observatory,'ruin',...p));
  [[15,39],[49,39],[17,6],[47,6]].forEach(p=>prop(observatory,'crystal',...p));
  prop(observatory,'engine',32,16);prop(observatory,'arch',32,35);
  [[25,34],[39,34],[26,8],[38,8]].forEach(p=>prop(observatory,'lantern',...p));
  obj(observatory,'finalCamp','camp',24,39,'Rest before the Warden');
  obj(observatory,'wardenConsole','boss','32','29','Wake the Glass Warden');
  obj(observatory,'heart','heart',32,14,'Restore the Heart of the Tide');
  exits(observatory,'observatoryBack',31,45,'Return to the Aqueduct','aqueduct',37,8);
  group(observatory,'warden',32,19,['warden'],{boss:true,manual:true});

  const zones={quay,fen,aqueduct,observatory};
  Object.values(zones).forEach(z=>{z.tiles=z.grid.map(r=>r.join(''));delete z.grid;});
  const heroes=[
    {id:'iona',name:'Iona',role:'Wayfinder',color:'#75d9cf',hp:160,mp:70,attack:16,speed:90,range:31,weapon:'sword',art:'Tidecut',artLong:'Arc wave',cost:14,desc:'A quick blade. Tidecut cleaves nearby foes. At range, it sends an arc of light.',skill:'Bladecraft',perk:'Sharper tools, stronger strikes.',rig:{build:'chibi',size:1.22,weapon:'sword',bladeLen:15,outfit:'coat',sleeves:'long',hair:'short',cape:'#b95748',colors:{skin:'#ebbd93',hair:'#e4e4d0',cloth:'#388e91',coat:'#388e91',pants:'#343b56',boot:'#263d4b',metal:'#e5dab1',eye:'#2c4c5a'}}},
    {id:'sera',name:'Sera',role:'Field healer',color:'#e7bd75',hp:130,mp:95,attack:12,speed:87,range:145,weapon:'staff',art:'Sunmend',artLong:'Sunmend',cost:20,desc:'Sunmend restores the whole party. Her seed darts reach distant targets.',skill:'Herblore',perk:'Better recovery and stronger remedies.',rig:{build:'chibi',size:1.13,weapon:'staff',outfit:'tunic',sleeves:'long',hair:{style:'long'},cape:'#617b48',colors:{skin:'#aa7359',hair:'#c18b46',cloth:'#b48c4b',coat:'#718354',pants:'#3e4e42',boot:'#594734',wood:'#684e40',gem:'#ffd47a',eye:'#223d3d'}}},
    {id:'orren',name:'Orren',role:'Skyborn surveyor',color:'#afa3ef',hp:180,mp:80,attack:14,speed:82,range:120,weapon:'gun',art:'Prism pulse',artLong:'Prism pulse',cost:18,desc:'Prism pulse breaks armour and briefly stops enemies. His survey tool fires light.',skill:'Resonance',perk:'More energy and a stronger party link.',rig:{build:'chibi',size:1.27,weapon:'gun',outfit:'coat',sleeves:'long',hood:true,hair:'none',eyeGlow:'#9af8df',cape:'#55517a',armor:true,colors:{skin:'#bd9560',hair:'#bd9560',cloth:'#5c6388',coat:'#5c6388',pants:'#3d4159',boot:'#30374b',metal:'#be9a6c',gem:'#9ff1e3',eye:'#afffe8'}}}
  ];
  const recipes=[
    {id:'tonic',name:'Sunleaf tonic',tag:'COMPOUNDING',description:'Restore 70 HP to every active ally. Revive a fallen ally with 35 HP.',cost:{herb:2},output:{tonic:1},unique:false},
    {id:'edge',name:'Prism edge',tag:'SMITHING',description:'All party attacks deal 4 more damage. Bladecraft adds 2 more.',cost:{ore:2,shard:2},unique:true},
    {id:'ward',name:'Tideward charm',tag:'CRAFTING',description:'Add 25 maximum HP to each ally. Refill that extra health now.',cost:{ore:2,herb:2},unique:true},
    {id:'tea',name:'Starlight tea',tag:'COOKING',description:'Restore 40 energy to each ally. Use it from the Party menu.',cost:{herb:1,shard:1},output:{tea:1},unique:false}
  ];
  const enemyStats={
    reedling:{name:'Reed prowler',hp:62,atk:12,speed:48,r:10,range:24,xp:18,color:'#9bab65',wind:.7,cool:1.55},
    spitter:{name:'Glass spitter',hp:54,atk:13,speed:28,r:9,range:130,xp:22,color:'#a58bd0',wind:.85,cool:2.2},
    mite:{name:'Copper mite',hp:90,atk:16,speed:53,r:11,range:29,xp:25,color:'#d9a071',wind:.8,cool:1.8},
    sentinel:{name:'Survey sentinel',hp:150,atk:19,speed:38,r:14,range:150,xp:40,color:'#72c2bd',wind:1.0,cool:2.2},
    warden:{name:'The Glass Warden',hp:3600,atk:25,speed:22,r:31,range:65,xp:200,color:'#8ae7db',wind:1.2,cool:2.8}
  };
  root.WayfarerData={T,zones,heroes,recipes,enemyStats,version:1,materialNames:{herb:'Sunleaf',ore:'Copper',shard:'Glass shard',tonic:'Sunleaf tonic',tea:'Starlight tea'}};
})(typeof window !== 'undefined' ? window : globalThis);
