/* The Roads We Keep — optional complete expansion for Threads of the Last Dawn. */
(function (global) {
  'use strict';
  const D = global.Dawn;
  if (!D || !D.Content) throw new Error('Load content.js before expansion.js.');
  const C = D.Content;
  if (C.expansion && C.expansion.id === 'roads-we-keep') return;
  const flag = id => ({type:'flag',id,value:true});
  const item = (id,count=1) => ({type:'item',id,count});
  const gold = amount => ({type:'gold',amount});
  const req = (...flags) => ({flags});
  const branch = (requires,dialogue) => ({requires,dialogue});
  const ft = (kind,x,y,w=1,h=1,extra={}) => ({kind,x,y,w,h,...extra});
  const zones = {};
  const add = (target,rows) => rows.forEach(row => { target[row.id]=row; });
  C.missions = C.missions || [];
  C.expansion = {id:'roads-we-keep',title:'The Open Roads',version:'1.0.0',missionCount:24,localZoneCount:22,
    summary:'Four regions learn to maintain what they share. Their choices form a living answer to an old machine rule.',
    finalFlag:'weave_accord_done',arcs:['coast','root','glass','ash','weave']};

  function zone(id,name,era,layout,description,features,options={}) {
    const chapterAtLeast = {bell642:1,seed112:2,ash2310:3,glass1186:4}[era];
    const z={id,name,era,layout,style:layout==='grove'?'forest':layout==='mine'?'cave':layout==='workshop'?'town':layout,
      description,width:32,height:24,spawn:{x:5,y:17},overworldRequires:era==='fold'?req('fold_open'):{chapterAtLeast},
      features,entities:[],exits:[{id:id+'_world',to:'world_'+era,name:'Return to the region',x:4,y:18}],...options};
    zones[id]=z;C.zones.push(z);return z;
  }
  function npc(z,id,name,x,y,dialogue,extra={}) { zones[z].entities.push({id,type:'npc',name,x,y,dialogue,...extra}); }
  function shrine(z,x=6,y=15) { zones[z].entities.push({id:z+'_rest',type:'shrine',name:'Wayside Shrine',x,y}); }
  function chest(z,x,y,loot,g=0,requires) { zones[z].entities.push({id:z+'_supplies',type:'chest',name:'Wayfarer Supplies',x,y,loot,gold:g,...(requires?{requires}:{})}); }
  function record(z,id,name,x,y,lines,requires,extra={}) {
    const did=id+'_read', repeat=id+'_repeat';
    C.dialogues[did]={speaker:name,lines,onceFlag:id+'_seen',onRepeat:repeat,effects:[flag(id),...(extra.effects||[])],...(extra.choices?{choices:extra.choices}:{})};
    C.dialogues[repeat]={speaker:name,lines:extra.repeat||['The record stays here. Its place in the work is clear.']};
    if(extra.choices?.length) C.dialogues[repeat].variants=extra.choices.map(c=>({
      requires:req(c.effects.find(e=>e.type==='flag').id),lines:[...C.dialogues[repeat].lines,'The agreement reads: '+c.label]}));
    npc(z,id,name,x,y,did,{requires,variants:[branch(req(id),repeat)]});
    return {text:extra.text||'Read '+name+'.',flag:id,zone:z,entity:id};
  }
  function puzzle(z,id,name,x,y,symbols,sequence,hint,requires) {
    zones[z].entities.push({id,type:'puzzle',name,x,y,symbols,sequence,hint,requires,hideIf:req(id),effects:[flag(id)]});
    return {text:'Set '+name+'.',flag:id,zone:z,entity:id};
  }
  function fight(z,id,name,x,y,enemies,clearFlag,requires,xp,g,level,extra={}) {
    C.encounters[id]={id,name,enemies,xp,gold:g,loot:[{id:'ether',count:1}],repeat:false,requires,recommendedLevel:level,
      boss:enemies.some(e=>C.enemies[e].boss),intro:extra.intro||[name+' blocks the work. Watch its charge and use its weak element.'],
      victory:extra.victory||['The way is safe. The work can continue.'],effects:[flag(clearFlag),...(extra.effects||[])],...extra};
    zones[z].entities.push({id:id+'_body',type:'encounter',name,x,y,encounter:id,requires,hideIf:req(clearFlag)});
    return {text:'Resolve '+name+'.',flag:clearFlag,zone:z,entity:id+'_body',encounter:id};
  }
  function mission(o) {
    const started=o.id+'_started',done=o.id+'_done',start=o.id+'_intro',wait=o.id+'_wait',finish=o.id+'_finish',repeat=o.id+'_after',locked=o.id+'_locked';
    const prerequisites=o.requires||{};
    C.dialogues[start]={speaker:o.npc,hero:o.hero,lines:o.start,onceFlag:o.id+'_intro_seen',onRepeat:wait,effects:[flag(started)]};
    C.dialogues[wait]={speaker:o.npc,lines:o.wait||['The work is still open. '+o.summary]};
    C.dialogues[locked]={speaker:o.npc,lines:o.locked||['There is work to do here. First, follow the earlier task in this region.']};
    C.dialogues[repeat]={speaker:o.npc,lines:o.after||['The work is complete. We will keep it in use. Thank you for your part in it.']};
    if(o.choices?.length) C.dialogues[repeat].variants=o.choices.map(c=>({
      requires:req(c.effects.find(e=>e.type==='flag').id),lines:[...C.dialogues[repeat].lines,'Our agreed next step: '+c.label]}));
    C.dialogues[finish]={speaker:o.npc,hero:o.hero,lines:o.finish,choices:o.choices||[],onceFlag:o.id+'_reward_seen',onRepeat:repeat,
      effects:[flag(done),...(o.effects||[]),...(o.rewards||[])]};
    const entity=o.id+'_giver';
    npc(o.zone,entity,o.npc,o.x||8,o.y||17,locked,{hero:o.hero,variants:[
      branch(req(done),repeat),branch(req(started,...o.steps.map(s=>s.flag)),finish),branch(req(started),wait),branch(prerequisites,start)]});
    const row={id:o.id,name:o.name,era:zones[o.zone].era,arc:o.arc,order:o.order,summary:o.summary,requires:prerequisites,
      startNpc:o.npc,startEntity:entity,startZone:o.zone,completionDialogue:finish,recommendedLevel:o.level||1,
      steps:[{text:'Speak to '+o.npc+'.',flag:started,zone:o.zone,entity},...o.steps,{text:'Return to '+o.npc+' and decide the next step.',flag:done,zone:o.zone,entity}],
      completeFlag:done,reward:o.reward};
    C.missions.push(row);return row;
  }
  function choice(label,id,next,effects=[]) { return {label,effects:[flag(id),...effects],...(next?{next}:{})}; }

  // Twenty-two local areas. Only the two transport islands need a vehicle.
  zone('bell_mooring','Reedwake Mooring','bell642','harbor','A rope road crosses reed beds. The flood left every boat tied to the same failing post.',[
    ft('water',3,3,26,5),ft('water',20,10,9,7),ft('bridge',4,8,23,2),ft('bridge',17,8,2,11),ft('house',6,11,5,3),ft('trees',3,5,3,3),
    ft('ruins',22,11,5,4,{requires:{notFlags:['coast_pier_open']}}),ft('bridge',20,11,8,2,{requires:req('coast_pier_open')}),
    ft('garden',22,4,5,2,{requires:req('watershed_open')})]);
  zone('bell_shipyard','Open Keel Yard','bell642','workshop','An unfinished boat rests on a public slip. No owner can afford to finish it alone.',[
    ft('house',5,3,8,4),ft('house',23,4,5,3),ft('water',13,15,16,6),ft('bridge',14,14,13,2),ft('wall',15,5,2,5),ft('wall',21,5,2,5),ft('path',17,5,4,9),
    ft('garden',5,4,5,2,{requires:req('seedbank_living')}),ft('bridge',17,15,4,5,{requires:req('transport_skiff')})]);
  zone('bell_tidecaves','Choir Caves','bell642','mine','Two sea chambers sing at different heights. A blocked channel traps both their water and their voices.',[
    ft('wall',3,3,9,3),ft('wall',17,3,11,3),ft('pool',11,9,6,6),ft('pool',23,10,5,4),ft('bridge',10,11,9,2),ft('crystals',5,5,5,4),ft('crystals',23,4,4,3),
    ft('garden',22,14,5,3,{requires:req('coast_tide_clear')}),ft('river',4,19,24,2,{requires:req('watershed_open')})],{overworldRequires:{chapterAtLeast:1,flags:['transport_skiff']}});
  zone('bell_beacon','Lantern Ridge','bell642','ridge','A long stair climbs above the sea. An empty lamp still carries the names of people who kept its watch.',[
    ft('wall',4,3,8,3),ft('wall',16,3,11,3),ft('wall',3,10,8,3),ft('wall',19,14,9,3),ft('path',12,4,3,15),ft('path',12,7,14,2),ft('house',21,4,5,3),
    ft('crystals',22,4,3,2,{requires:req('coast_beacon_lit'),color:'#ffe1a0',size:1.8}),ft('garden',5,4,5,3,{requires:req('seedbank_living')})]);
  zone('bell_breakwater','Common Breakwater','bell642','citadel','A sea wall bears a charge for each ship that passed it. Its old collector cannot read a cancelled debt.',[
    ft('water',3,3,26,4),ft('water',25,7,4,14),ft('wall',4,8,7,3),ft('wall',15,8,9,3),ft('path',11,7,4,12),ft('house',5,3,6,3),ft('pillars',18,4,6,3),
    ft('garden',17,15,5,3,{requires:req('coast_shared_harbor')}),ft('bridge',24,16,4,2,{requires:req('coast_shared_harbor')})]);
  zone('seed_canopy','Highleaf Canopy','seed112','grove','Old branches form a village above a low valley. Young trees have no path to the light.',[
    ft('trees',3,3,8,6,{size:1.6}),ft('trees',21,3,8,6,{size:1.8}),ft('river',14,3,4,17),ft('bridge',10,8,13,2),ft('bridge',11,16,12,2),ft('garden',5,12,6,4),
    ft('garden',21,15,7,4,{requires:req('canopy_paths_open')}),ft('trees',13,4,3,3,{requires:req('forest_covenant')})]);
  zone('seed_stoneweir','First Stone Weir','seed112','canals','The first stone water gate holds a river that has no word for a boundary.',[
    ft('river',3,4,26,5),ft('river',13,9,5,12),ft('bridge',4,10,24,2),ft('wall',7,4,4,4),ft('wall',20,4,5,4),ft('garden',4,14,6,5),
    ft('river',19,17,9,3,{requires:req('watershed_open')}),ft('garden',23,10,5,5,{requires:req('watershed_open')})]);
  zone('seed_ambermine','Amber Hollow','seed112','mine','Warm sap shines inside the stone. Some seams are still part of the roots that hold the hill.',[
    ft('wall',3,3,8,4),ft('wall',18,3,10,4),ft('wall',3,11,7,3),ft('wall',20,15,8,3),ft('crystals',12,4,5,4,{color:'#e9b766'}),ft('crystals',22,8,5,4,{color:'#efc97c'}),
    ft('pillars',20,4,5,3,{requires:req('amber_safe')}),ft('trees',4,4,6,3,{requires:req('amber_safe')})]);
  zone('seed_seedhouse','House of Seeds','seed112','garden','Clay shelves hold seeds from wet banks and dry ridges. One hungry season could empty them.',[
    ft('house',4,3,10,4),ft('house',20,3,8,4),ft('garden',4,9,7,5),ft('garden',19,10,9,5),ft('pool',13,5,4,4),ft('path',12,9,5,11),
    ft('garden',20,16,8,4,{requires:req('seedbank_living')}),ft('trees',14,3,4,3,{requires:req('forest_covenant')})]);
  zone('seed_crownmeadow','Crown Meadow','seed112','grove','Four paths meet below the oldest living crown. An old oath protects every tree and leaves no place for a home.',[
    ft('trees',3,3,8,5,{size:1.8}),ft('trees',21,3,8,5,{size:1.8}),ft('trees',3,17,8,4),ft('trees',22,16,7,4),ft('garden',13,4,6,5),ft('path',4,11,24,3),
    ft('garden',11,15,9,4,{requires:req('forest_covenant')}),ft('crystals',15,5,4,3,{requires:req('weave_accord_done'),color:'#f8dda1'})]);
  zone('glass_market','Witness Market','glass1186','harbor','Records pass over a narrow canal. The poorest buyers pay twice: once in coin, once in memory.',[
    ft('house',4,3,8,4),ft('house',21,3,7,4),ft('river',13,3,5,17),ft('bridge',10,10,11,3),ft('bridge',10,17,11,2),ft('pillars',4,8,4,3),
    ft('garden',22,14,5,4,{requires:req('records_public')}),ft('crystals',5,4,5,2,{requires:req('amber_safe'),color:'#e8c483'})]);
  zone('glass_canalworks','Clear Channel Works','glass1186','canals','Three districts share one pump. An unread map sends clean water back into its own intake.',[
    ft('river',3,4,8,5),ft('river',20,4,9,5),ft('river',13,13,5,8),ft('bridge',4,10,24,3),ft('pillars',13,4,5,4),ft('house',4,14,6,4),
    ft('garden',21,14,7,5,{requires:req('clean_canal')}),ft('garden',4,4,5,3,{requires:req('watershed_open')})]);
  zone('glass_mirrorgarden','Garden of Names','glass1186','garden','A memorial garden reflects its visitors. Empty mirrors mark people whose names were sold.',[
    ft('garden',3,3,8,5),ft('garden',21,3,8,5),ft('pool',12,4,7,4),ft('crystals',4,10,5,4),ft('crystals',23,10,5,4),ft('path',10,10,12,4),
    ft('garden',12,15,8,4,{requires:req('names_returned')}),ft('trees',15,4,2,3,{requires:req('forest_covenant')})]);
  zone('glass_signalhall','Public Signal Hall','glass1186','workshop','The republic has a voice in every house. For years, every house has heard the same voice.',[
    ft('house',4,3,9,4),ft('house',20,3,8,4),ft('pillars',14,3,5,5),ft('wall',4,11,7,3),ft('wall',23,12,5,3),ft('path',12,9,10,5),
    ft('crystals',14,3,5,3,{requires:req('signal_public'),color:'#b9eadb'}),ft('garden',4,16,5,3,{requires:req('records_public')})]);
  zone('glass_civicspire','Civic Spire','glass1186','citadel','One tall chamber once counted silence as consent. A table below it has room for people who disagree.',[
    ft('wall',4,3,24,3),ft('wall',3,8,5,6),ft('wall',25,8,4,6),ft('pillars',10,4,4,4),ft('pillars',19,4,4,4),ft('path',9,9,15,6),
    ft('garden',11,16,11,4,{requires:req('civic_assembly')}),ft('crystals',13,4,6,3,{requires:req('weave_accord_done'),color:'#f8dda1'})]);
  zone('ash_saltroad','Salt Route','ash2310','ridge','White dust hides a road built for a town that no longer appears on any route board.',[
    ft('wall',3,3,8,5),ft('wall',20,4,9,5),ft('path',10,4,4,16),ft('path',11,11,17,3),ft('ruins',4,11,5,5),ft('ruins',21,16,7,4),
    ft('bridge',14,11,10,2,{requires:req('courier_road')}),ft('garden',23,16,4,3,{requires:req('rain_clean')})]);
  zone('ash_understation','Understation Nine','ash2310','ruin','A buried power station still reserves its charge for trains that will never return.',[
    ft('house',3,3,9,5),ft('house',21,3,8,5),ft('pool',13,4,6,4),ft('pillars',4,11,5,3),ft('pillars',23,11,5,3),ft('path',10,9,12,5),
    ft('crystals',13,4,6,3,{requires:req('relay_power'),color:'#f2d789'}),ft('crystals',5,4,5,2,{requires:req('amber_safe'),color:'#e9b86f'}),
    ft('crystals',24,4,3,3,{requires:req('signal_public'),color:'#9edccf'})]);
  zone('ash_cloudhangar','Cloudglass Hangar','ash2310','workshop','A light hull hangs above the dust. Its builders left room for a crew they never lived to meet.',[
    ft('house',3,3,8,5),ft('house',23,3,6,5),ft('wall',12,3,2,9),ft('wall',21,3,2,9),ft('path',14,5,7,10),ft('ruins',4,13,6,4),ft('crystals',15,4,5,3),
    ft('bridge',14,14,8,5,{requires:req('transport_airship')}),ft('garden',23,15,5,3,{requires:req('homes_shared')})]);
  zone('ash_rainworks','Rain Works','ash2310','canals','An island catches water above the dust. Salt locks its filters while a collector guards each drop.',[
    ft('water',3,3,26,4),ft('pool',4,9,7,6),ft('pool',21,9,7,6),ft('bridge',10,11,12,3),ft('pillars',13,4,6,5),ft('ruins',5,16,5,3),
    ft('garden',21,15,7,4,{requires:req('rain_clean')}),ft('garden',5,4,5,2,{requires:req('clean_canal')})],{overworldRequires:{chapterAtLeast:3,flags:['transport_airship']}});
  zone('ash_homefield','Homefield','ash2310','camp','A line of empty foundations waits beside the new road. The old allocation office still calls every home full.',[
    ft('ruins',4,3,8,5,{requires:{notFlags:['homes_shared']}}),ft('ruins',21,3,7,5,{requires:{notFlags:['homes_shared']}}),ft('house',4,3,8,5,{requires:req('homes_shared')}),ft('house',21,3,7,5,{requires:req('homes_shared')}),
    ft('garden',4,11,5,3,{requires:req('seedbank_living')}),ft('garden',20,15,8,4,{requires:req('rain_clean')}),ft('path',10,9,12,5),ft('pool',13,4,5,4,{requires:req('rain_clean')})]);
  zone('fold_waystation','Unfinished Station','fold','camp','A waiting room holds arrivals from roads that have not yet been built. Four empty places face one table.',[
    ft('house',4,3,8,4),ft('house',21,3,7,4),ft('water',3,19,26,2),ft('crystals',13,4,6,4),ft('path',4,11,24,3),
    ft('garden',4,13,6,4,{requires:req('weave_evidence_done')}),ft('pillars',13,15,7,3,{requires:req('weave_delegates_done')})]);
  zone('fold_loom','The Listening Loom','fold','citadel','A small service machine repeats an old order: make all futures agree. Four new roads have made that order impossible.',[
    ft('pillars',4,3,6,4),ft('pillars',22,3,6,4),ft('water',3,19,26,2),ft('crystals',12,3,8,5),ft('path',4,10,24,4),
    ft('crystals',4,15,6,3,{requires:req('weave_menders_done'),color:'#b5e6c9'}),ft('garden',20,15,8,4,{requires:req('weave_accord_done')}),ft('garden',12,4,8,3,{requires:req('weave_accord_done')})]);

  add(C.items,[
    {id:'coast_harness',name:'Harbour Harness',kind:'armor',slot:'armor',price:260,stats:{def:8,maxHp:30},description:'A strong harness used by the public rescue crew.'},
    {id:'watershed_band',name:'Watershed Band',kind:'accessory',slot:'accessory',price:300,stats:{mag:6,def:3,maxMp:8},description:'River stones hold the shape of a shared promise.'},
    {id:'amber_gloves',name:'Amber Gloves',kind:'accessory',slot:'accessory',price:340,stats:{atk:7,def:4},description:'Padded gloves made for work around living roots.'},
    {id:'witness_lens',name:'Witness Lens',kind:'accessory',slot:'accessory',price:450,stats:{mag:10,maxMp:12},description:'A lens that shows where a record came from.'},
    {id:'public_weave',name:'Public Weave',kind:'armor',slot:'armor',price:520,stats:{def:14,mag:6,maxHp:35},description:'Six workers signed the cloth. None owns the pattern.'},
    {id:'cloud_coat',name:'Cloudglass Coat',kind:'armor',slot:'armor',price:540,stats:{def:14,speed:3,maxHp:45},description:'Light layers hold heat above the cloud line.'},
    {id:'rain_cup',name:'First Rain Cup',kind:'accessory',slot:'accessory',price:410,stats:{maxHp:60,maxMp:14},description:'A small cup from the first clean collection.'},
    {id:'accord_cord',name:'Accord Cord',kind:'accessory',slot:'accessory',price:760,stats:{atk:8,mag:8,def:6,speed:2},description:'Each knot can be opened by the person who tied it.'},
    {id:'keel_plan',name:'Common Keel Plan',kind:'key',description:'A boat plan that any local yard can use.'},
    {id:'tide_lens',name:'Sea Glass Lens',kind:'key',description:'A clear lens found in the Choir Caves.'},
    {id:'dry_seeds',name:'Ridge Seed Packet',kind:'key',description:'Seeds that sleep through a dry season.'},
    {id:'wet_seeds',name:'Bank Seed Packet',kind:'key',description:'Seeds that hold the edge of a wet bank.'},
    {id:'name_roll',name:'Unclaimed Name Roll',kind:'key',description:'A future record of names that the republic lost.'},
    {id:'flight_chart',name:'Cloudglass Flight Chart',kind:'key',description:'A flight route built from public power records.'}
  ]);

  function move(name,power=1,target='enemy',element='physical',type='physical',status) { return {name,power,target,element,type,...(status?{status}:{}),telegraph:power>=1.5||target==='allEnemies'?1.6:.5,charge:power>=1.5||target==='allEnemies'}; }
  function enemy(id,name,hp,atk,mag,def,speed,weak,pattern,extra={}) { C.enemies[id]={id,name,maxHp:hp,atk,mag,def,speed,weak,resist:[],pattern,boss:false,...extra}; }
  enemy('ex_rope_mite','Rope Mite',110,12,9,5,10,['wind'],[move('Frayed Bite'),move('Tangle',.8,'enemy','earth','magic',{slow:5})],{color:'#a98259'});
  enemy('ex_keel_clamp','Contract Clamp',840,17,15,8,9,['water','spark'],[move('Stamp',1.1),move('Seize the Hull',1.65)],{boss:true,rigId:'horizon_crab',size:.7,color:'#b68c64',phases:[{at:.5,name:'The contract opens',weak:['wind'],pattern:[move('Loose Chain',1.1,'allEnemies'),move('Final Charge',1.6)],speedMult:1.1}]});
  enemy('ex_salt_eel','Choir Eel',185,18,20,8,11,['earth','spark'],[move('Salt Fin'),move('Low Note',1.25,'allEnemies','water','magic')],{resist:['water'],color:'#73a5ab'});
  enemy('ex_tide_wisp','Tide Wisp',165,14,22,7,12,['fire'],[move('High Note',1.2,'enemy','water','magic'),move('Dull Hearing',.7,'allEnemies','void','magic',{slow:5})],{color:'#b3d0bd'});
  enemy('ex_lens_moth','Lens Moth',210,20,20,8,13,['fire','spark'],[move('Wing Cut'),move('Lamp Dust',1.2,'allEnemies','wind','magic')],{color:'#d1b779'});
  enemy('ex_tithe_sentinel','Tithe Sentinel',1260,23,22,11,10,['water'],[move('Counted Blow',1.2),move('Harbour Levy',1.35,'allEnemies','spark','magic')],{boss:true,rig:'humanoid',color:'#9c8560',phases:[{at:.5,name:'Last account',weak:['earth','wind'],pattern:[move('Closing Entry',1.9),move('No Exemptions',1.25,'allEnemies','void','magic')],atkMult:1.1}]});
  enemy('ex_thorn_hare','Thorn Hare',245,24,17,10,13,['fire'],[move('Thorn Kick',1.15),move('Leaf Screen',.8,'allEnemies','earth','magic',{slow:5})],{color:'#a2b77d'});
  enemy('ex_silt_walker','Silt Walker',330,24,23,13,9,['wind','spark'],[move('Mud Heel',1.15),move('Silt Wave',1.3,'allEnemies','earth','magic')],{rig:'humanoid',color:'#8f9476'});
  enemy('ex_amber_beetle','Amber Beetle',300,25,20,14,10,['water'],[move('Stone Jaw',1.25),move('Hot Sap',1.3,'enemy','fire','magic',{burn:7})],{color:'#c89c5d'});
  enemy('ex_hunger_moth','Hunger Moth',270,22,27,10,13,['fire','wind'],[move('Seed Dust',1,'allEnemies','earth','magic',{poison:6}),move('Dry Wing',1.4,'enemy','wind','magic')],{color:'#9d9c7a'});
  enemy('ex_root_oath','Oathbound Crown',1850,28,28,14,10,['fire'],[move('Old Boundary',1.1,'allEnemies','earth','magic',{slow:5}),move('Root Weight',1.85)],{boss:true,rigId:'root_crown',size:1.05,color:'#8ea274',phases:[{at:.5,name:'A living exception',weak:['wind','water'],pattern:[move('Crown Fall',1.8),move('Deep Reach',1.4,'allEnemies','earth','magic')],speedMult:1.08}]});
  enemy('ex_receipt_wisp','Receipt Wisp',390,25,34,13,14,['fire'],[move('Paper Fee',1.2,'enemy','void','magic'),move('Interest',1.05,'allEnemies','void','magic',{slow:5})],{color:'#c5b898'});
  enemy('ex_clerk_sentinel','Clerk Sentinel',460,33,30,17,11,['spark','earth'],[move('Ledger Edge',1.3),move('Office Closure',1.35,'allEnemies','void','magic')],{rig:'humanoid',color:'#859ca6'});
  enemy('ex_name_mask','Unclaimed Mask',420,28,35,14,14,['water','spark'],[move('Borrowed Face',1.3,'enemy','void','magic'),move('Blank Gaze',1,'allEnemies','void','magic',{slow:6})],{resist:['void'],color:'#a3bccc'});
  enemy('ex_mute_regent','Mute Regent',2350,35,36,18,12,['spark'],[move('Quiet Command',1.25,'allEnemies','void','magic'),move('Single Voice',1.8,'enemy','void','magic')],{boss:true,rig:'humanoid',color:'#a699b9',phases:[{at:.45,name:'Feedback',weak:['earth','water'],pattern:[move('Return Signal',1.5,'allEnemies','spark','magic'),move('Broken Word',1.8)],speedMult:1.1}]});
  enemy('ex_unanimity_keeper','Keeper of One Voice',2950,37,39,19,12,['water','earth'],[move('Assumed Consent',1.4,'allEnemies','void','magic'),move('Seal the Vote',1.9)],{boss:true,rigId:'fourfold_witness',size:.95,color:'#a597bd',phases:[{at:.6,name:'Dissent recorded',weak:['spark'],pattern:[move('Count Again',1.25,'allEnemies','spark','magic',{slow:5}),move('Closing Majority',1.8,'enemy','void','magic')]},{at:.28,name:'No empty votes',weak:['wind','fire'],pattern:[move('Last Claim',1.6,'allEnemies','void','magic')],atkMult:1.08}]});
  enemy('ex_salt_hound','Salt Hound',300,26,20,12,13,['water'],[move('White Fang',1.2),move('Dust Wake',1.1,'allEnemies','wind','magic')],{color:'#c4a691'});
  enemy('ex_arc_mite','Arc Mite',285,22,28,11,13,['earth','water'],[move('Live Contact',1.3,'enemy','spark','magic'),move('Short Circuit',1,'allEnemies','spark','magic')],{resist:['spark'],color:'#b0b08b'});
  enemy('ex_hangar_sentinel','Departure Sentinel',1950,31,30,16,11,['earth','water'],[move('Ground Order',1.25,'allEnemies','spark','magic',{slow:5}),move('Landing Clamp',1.8)],{boss:true,rig:'humanoid',color:'#83a6a7',phases:[{at:.5,name:'No registered crew',weak:['wind','spark'],pattern:[move('Hold the Sky',1.45,'allEnemies','wind','magic'),move('Loose Bolt',1.7)],speedMult:1.1}]});
  enemy('ex_salt_leviathan','Salt Collector',2250,34,32,18,10,['earth','spark'],[move('Brine Press',1.8,'enemy','water','magic'),move('White Rain',1.35,'allEnemies','water','magic',{slow:5})],{boss:true,rigId:'horizon_crab',size:1.05,color:'#b8b7a1',resist:['water'],phases:[{at:.5,name:'Filter shell opens',weak:['fire','wind'],pattern:[move('Salt Burst',1.6,'allEnemies','earth','magic'),move('Empty Cup',1.9)],speedMult:1.08}]});
  enemy('ex_ration_warden','Allocation Warden',2600,36,34,18,11,['spark','wind'],[move('Vacant Address',1.3,'allEnemies','void','magic'),move('Eviction Order',1.95)],{boss:true,rig:'humanoid',color:'#a88978',phases:[{at:.45,name:'No occupied field',weak:['water','earth'],pattern:[move('Final Notice',1.5,'allEnemies','fire','magic'),move('Boundary Stamp',1.8)],atkMult:1.08}]});
  enemy('ex_counterfactual_wisp','Discarded Morning',630,35,39,18,14,['water','fire'],[move('Unused Hour',1.3,'enemy','void','magic'),move('Lost Route',1.1,'allEnemies','void','magic',{slow:6})],{color:'#c1b2d5'});
  enemy('ex_protocol_knight','Protocol Escort',850,40,35,21,12,['spark','earth'],[move('Required Route',1.6),move('Safe Custody',1.35,'allEnemies','void','magic')],{rig:'humanoid',color:'#8aa6ad'});
  enemy('ex_rule_machine','Rule of One Tomorrow',4650,43,42,24,11,['wind','earth'],[move('Correct the Difference',1.4,'allEnemies','void','magic'),move('Borrow Without Limit',2.1,'enemy','spark','magic')],{boss:true,rigId:'still_engine',size:.95,color:'#ae9379',phases:[{at:.65,name:'Return loop',weak:['water'],pattern:[move('Unpaid Hour',1.45,'allEnemies','fire','magic'),move('Close the Account',2)]},{at:.3,name:'No single answer',weak:['spark','void'],pattern:[move('Failed Prediction',1.7,'allEnemies','earth','magic'),move('Recalculate',1.6,'enemy','void','magic')],speedMult:1.1}]});
  enemy('ex_last_exception','The Last Exception',5600,45,45,24,12,['water','earth'],[move('Unless I Know Better',1.55,'allEnemies','void','magic'),move('Override',2.15)],{boss:true,rigId:'fourfold_witness',size:1.1,color:'#bca9cc',phases:[{at:.65,name:'Emergency clause',weak:['wind','fire'],pattern:[move('For Your Protection',1.65,'allEnemies','spark','magic',{slow:5}),move('Silence One Voice',2,'enemy','void','magic')]},{at:.3,name:'The right to refuse',weak:['spark','void'],pattern:[move('Last Authority',1.85,'allEnemies','earth','magic'),move('Unanswered Question',1.8)],speedMult:1.1}]});

  // Coast arc: a shared rescue route, with a boat available after its second task.
  const ropesChart=record('bell_mooring','coast_ropes_chart','Flood Marks',18,8,
    ['The highest knot marks the last flood. It sits above every mooring hook.','Mira reads the cuts in the post. The ropes failed because each boat pulled against the others. A shared beam can spread the load.'],req('coast_ropes_started'),{text:'Read the flood marks on the old post.'});
  const ropesFight=fight('bell_mooring','ex_e_ropes','Ropes in the Reeds',24,15,['ex_rope_mite','ex_rope_mite'],'coast_ropes_clear',req('coast_ropes_started','coast_ropes_chart'),75,30,1,
    {intro:['Rope mites feed on the wet lines. Clear the post before anyone puts weight on it.'],victory:['The ropes are free. Nera brings a beam long enough for every boat.']});
  mission({id:'coast_ropes',name:'The Missing Mooring',arc:'coast',order:1,zone:'bell_mooring',npc:'Nera the Ropemaker',x:8,y:10,level:1,requires:{chapterAtLeast:1},
    summary:'Read the flood marks and clear the mooring post at Reedwake Mooring.',
    start:['The flood took three boats. Each owner had paid for a private rope. None had paid for the post.','I can make a common beam. Read the flood marks, then clear the creatures from its base. We must know what failed before we build again.'],
    steps:[ropesChart,ropesFight],finish:['The new beam holds every line. A child can reach the lowest hook without help.','We have rope left. Where should it go?'],
    choices:[choice('Put rescue lines along the bank.','coast_rescue_lines',null,[item('phoenix')]),choice('Give each household a spare line.','coast_household_lines',null,[item('tonic',3)])],
    effects:[flag('coast_pier_open')],rewards:[gold(70)],reward:'70 crowns; rescue supplies; a repaired mooring.',
    after:['The beam takes the load from every boat. People now check the shared post before their own ropes.','Pell needs help at Open Keel Yard. Tell him the mooring is ready.'],locked:['Read the flood marks with me. There is no fee to use this bank.']});

  const skiffPlan=record('bell_shipyard','coast_skiff_plan','Keel Pattern',24,7,
    ['The plan has no crest and no owner mark. Its first note says: copy this wherever a boat is needed.','The hull can carry a rescue crew or a small load of food. One contract clamp still holds the launch rails.'],req('coast_skiff_started'),{effects:[item('keel_plan')],text:'Read the common keel pattern.'});
  const skiffFight=fight('bell_shipyard','ex_e_skiff','The Unpaid Contract',20,13,['ex_keel_clamp'],'coast_skiff_clear',req('coast_skiff_started','coast_skiff_plan'),120,45,2,
    {intro:['CONTRACT CLAMP: A registered owner must approve departure.','Pell: The town owns the boat. Your form has no box for that.'],victory:['The clamp releases the rails. The common keel touches water for the first time.']});
  mission({id:'coast_skiff',name:'A Boat for Everyone',arc:'coast',order:2,zone:'bell_shipyard',npc:'Pell the Shipwright',x:8,y:9,level:2,requires:req('coast_ropes_done'),
    summary:'Read the keel pattern and release the launch clamp at Open Keel Yard.',
    start:['A safe bank needs a boat that will answer any call. I have the timber. The town has enough hands.','Read the keel pattern, then release the old contract clamp. It has waited thirty years for one rich owner.'],steps:[skiffPlan,skiffFight],
    finish:['The Coast Skiff is ready. You can board it on the regional map and cross coastal water.','Choir Caves lie beyond the west channel. Take the boat there. First, choose its first local duty.'],
    choices:[choice('Train a rescue crew.','skiff_rescue_crew',null,[item('phoenix',2)]),choice('Carry food between the small piers.','skiff_food_route',null,[item('ether',2)])],
    effects:[flag('transport_skiff')],rewards:[gold(90)],reward:'The Coast Skiff; 90 crowns; crew supplies.',
    after:['The Coast Skiff belongs to the route. Any trained hand can take its tiller.','Enna listens to a blocked channel in Choir Caves. The skiff can reach her shore.'],locked:['First help Nera at Reedwake Mooring. A boat needs a safe place to return.']});

  const tideLow=record('bell_tidecaves','coast_tide_low','Low Chamber',12,6,
    ['The low chamber repeats a long note. A tide mark points toward the open sea.','Soren: This water needs an exit. The sound comes from pressure, not anger.'],req('coast_tide_started'),{text:'Listen at the low chamber.'});
  const tideHigh=record('bell_tidecaves','coast_tide_high','High Chamber',24,7,
    ['The high chamber answers in three short notes. Fine silt covers its old channel.','A work mark shows where a keeper once left room for young fish. The channel served more than boats.'],req('coast_tide_started'),{text:'Listen at the high chamber.'});
  const tideFight=fight('bell_tidecaves','ex_e_tide','The Trapped Chorus',20,13,['ex_salt_eel','ex_tide_wisp'],'coast_tide_clear_battle',req('coast_tide_started','coast_tide_low','coast_tide_high'),105,45,3,
    {intro:['The trapped notes gather in the narrow channel. Their pressure takes a living shape.'],victory:['The notes separate. Water begins to flow toward the sea.']});
  mission({id:'coast_tide',name:'Low Tide, Deep Voices',arc:'coast',order:3,zone:'bell_tidecaves',npc:'Enna the Listener',x:8,y:14,level:3,requires:req('coast_skiff_done'),
    summary:'Listen to both chambers, then free the channel in Choir Caves.',
    start:['People heard these caves sing and called them cursed. I stayed long enough to hear two voices.','Listen to the low and high chambers. If we clear the wrong wall, the next tide will fill this shore.'],steps:[tideLow,tideHigh,tideFight],
    finish:['The pressure has gone. The water can move again.','We can keep one deep channel for boats, or several quiet pools for young fish. Both will leave a safe passage.'],
    choices:[choice('Keep the deep channel open.','tide_working_channel',null,[gold(55)]),choice('Leave quiet pools beside the passage.','tide_nursery_pools',null,[item('panacea',3)])],
    effects:[flag('coast_tide_clear')],rewards:[gold(90),item('ether',2)],reward:'90 crowns; 2 Blue Nectar; a free tide channel.',
    after:['The two chambers still sing. Now there is a pause between their notes.','Daro waits at Lantern Ridge. The sea left a clear lens here that his lamp may need.'],locked:['Pell can help you launch the Coast Skiff at Open Keel Yard. Complete his work before we open this channel.']});

  const beaconLens=record('bell_tidecaves','coast_beacon_lens','Clear Sea Glass',25,17,
    ['A round lens rests above the last tide mark. Small shells have polished its edge.','You lift it with a cloth. Light passes through without a crack. Daro can use this.'],req('coast_beacon_started'),{effects:[item('tide_lens')],text:'Recover the sea glass lens from Choir Caves.'});
  const beaconFight=fight('bell_beacon','ex_e_beacon','The Unlit Watch',18,11,['ex_lens_moth','ex_lens_moth'],'coast_beacon_clear',req('coast_beacon_started'),130,55,3);
  const beaconSet=puzzle('bell_beacon','coast_beacon_set','Three-Note Lamp',24,6,['Dawn','Tide','Home'],[0,2,1],
    'The keeper wrote: Dawn begins the watch. Home keeps the flame. Tide carries the light. Set Dawn, Home, Tide.',req('coast_beacon_lens','coast_beacon_clear'));
  mission({id:'coast_beacon',name:'The Light That Waited',arc:'coast',order:4,zone:'bell_beacon',npc:'Daro the Lampkeeper',x:8,y:17,level:3,requires:req('coast_tide_done'),
    summary:'Find a sea glass lens in Choir Caves. Clear the ridge and set the Three-Note Lamp.',
    start:['My mother kept this watch. Her name is cut below the lamp, where no passing boat can see it.','A clear lens washed into Choir Caves. Bring it back, clear the moths, and set the three notes written beside the lamp.'],steps:[beaconLens,beaconFight,beaconSet],
    finish:['The lamp reaches the channel. On the water, three small crews answer with their own lights.','There is room on the new lens frame for a message. What should it carry?'],
    choices:[choice('Name each person who kept the watch.','beacon_keeps_names'),choice('Show the safe route in plain signs.','beacon_shows_route')],
    effects:[flag('coast_beacon_lit')],rewards:[gold(120),item('phoenix',2)],reward:'120 crowns; 2 Dawn Salt; a working coast beacon.',
    after:['I no longer keep the watch alone. The crews send someone up each evening.','Kesa has called a meeting at Common Breakwater. A working coast should have a fair rule.'],locked:['Help Enna free the tide channel first. A light cannot guide a boat through a closed road.']});

  const charterLedger=record('bell_breakwater','coast_charter_ledger','Collector Ledger',12,7,
    ['The sea wall was paid for in full eighty years ago. The collection order has no final date.','Each repair created a new charge. Each charge funded another collector. The wall itself received less each year.'],req('coast_charter_started'),{text:'Read the collector ledger.'});
  const charterVote=record('bell_breakwater','coast_charter_vote','Harbour Work Table',22,7,
    ['Kesa lays out the rope plan, the keel pattern, and the lamp schedule.','Every crew agrees to maintain the coast. They differ on who should organise the work.'],req('coast_charter_started','coast_charter_ledger'),{
      text:'Set the harbour work rule.',choices:[choice('Let crews take turns each month.','coast_rotating_crews'),choice('Elect a keeper who reports to all crews.','coast_elected_keeper')],repeat:['The work rule is written in large letters. Anyone can read it before they agree to a shift.']});
  const charterFight=fight('bell_breakwater','ex_e_charter','The Last Harbour Levy',21,13,['ex_tithe_sentinel'],'coast_charter_clear',req('coast_charter_vote'),225,95,4,
    {intro:['TITHE SENTINEL: No ship may pass without payment.','Kesa: The wall is paid for. Read the last page.'],victory:['The sentinel lowers its stamp. The final account shows a balance of zero.']});
  mission({id:'coast_charter',name:'No Toll on the Dawn',arc:'coast',order:5,zone:'bell_breakwater',npc:'Kesa the Harbour Clerk',x:8,y:17,level:4,requires:req('coast_beacon_done'),
    summary:'Read the old debt, choose a shared work rule, and close the collector at Common Breakwater.',
    start:['The post holds. The boat sails. The lamp shines. The collector still charges us for all three.','Read its ledger. Then bring our work rule to the table. We can end an order only if we know what will take its place.'],steps:[charterLedger,charterVote,charterFight],
    finish:['The tide enters a harbour with no debt on its name. The first repair shift fills before sunset.','The collector bell is ours now. What should become of it?'],
    choices:[choice('Ring it when anyone needs help.','coast_help_bell'),choice('Make handrails for the low piers.','coast_shared_handrails')],
    effects:[flag('coast_shared_harbor')],rewards:[gold(190),item('coast_harness'),item('elixir')],reward:'190 crowns; Harbour Harness; 1 Last Fruit; the coast arc complete.',
    after:['A boat arrives without a toll mark. Someone meets it with a rope, a route map, and a warm cup.','The wall still needs care. At last, the people who use it decide how that care is given.'],locked:['Restore the lamp at Lantern Ridge. Kesa needs the whole coast ready before the final account can close.']});

  // Forest arc: water, safe amber, and a seed bank survive into later ages.
  const canopySurvey=record('seed_canopy','root_canopy_survey','Branch Census',12,7,
    ['Old trees cast long shadows over the nursery. The youngest shoots lean toward one narrow break.','The census marks empty branches as failures. Ilex marks them as paths for light and wind.'],req('root_canopy_started'),{text:'Read the branch census.'});
  const canopyFight=fight('seed_canopy','ex_e_canopy','The Wind Nest',23,13,['ex_thorn_hare','ex_thorn_hare'],'root_canopy_clear',req('root_canopy_survey'),135,50,4,
    {intro:['Thorn hares have made a nest around the broken nursery rail. Move them before the rail falls.'],victory:['The hares retreat into the deep leaves. The young branches can be reached safely.']});
  mission({id:'root_canopy',name:'Room for the Young',arc:'root',order:1,zone:'seed_canopy',npc:'Leth the Branch Reader',x:8,y:17,level:4,requires:{chapterAtLeast:2},
    summary:'Read the branch census and clear the wind nest in Highleaf Canopy.',
    start:['The old trees are healthy. The young trees are not. Our census praises the wrong thing.','Read the nursery record. Then clear the damaged rail. I need to see where new paths can let the light through.'],steps:[canopySurvey,canopyFight],
    finish:['Light reaches the nursery floor. The smallest shoot has turned toward it.','We can keep these gaps as paths or move them as the trees grow. Which lesson should the first keepers learn?'],
    choices:[choice('Keep clear paths that everyone can find.','canopy_fixed_paths'),choice('Move the paths with each new season.','canopy_seasonal_paths')],
    effects:[flag('canopy_paths_open')],rewards:[gold(110),item('panacea',3)],reward:'110 crowns; 3 Clear Dew; open canopy paths.',
    after:['A gap in the branches is now part of the plan. It gives the forest room to change.','Issa is testing a new stone weir. Follow the river to her work.'],locked:['Follow the orchard road into the Seed Age. Leth will meet you below the nursery.']});

  const weirMarks=record('seed_stoneweir','root_weir_marks','Four-Part Water Mark',24,6,
    ['The mark joins four signs: rain, root, stone, river. A short sentence explains their order.','Rain feeds the root. The root grips the stone. The stone guides the river. No sign can do the work alone.'],req('root_weir_started'),{text:'Read the four-part water mark.'});
  const weirFight=fight('seed_stoneweir','ex_e_weir','Silt at the Gate',21,14,['ex_silt_walker','ex_salt_eel'],'root_weir_clear',req('root_weir_started'),155,60,5);
  const weirSet=puzzle('seed_stoneweir','root_weir_set','Living Water Gate',18,11,['Root','Stone','Rain','River'],[2,0,1,3],
    'Rain feeds the root. The root grips the stone. The stone guides the river. Set Rain, Root, Stone, River.',req('root_weir_marks','root_weir_clear'));
  mission({id:'root_weir',name:'A River with Room',arc:'root',order:2,zone:'seed_stoneweir',npc:'Issa the Stoneworker',x:7,y:17,level:5,requires:req('root_canopy_done'),
    summary:'Read the water mark, clear the silt, and set the Living Water Gate at First Stone Weir.',
    start:['A wall can stop water. A good weir must also know when to let it pass.','Read the four signs and clear the silt from the gate. Then set the order. The river will tell us if the joints are sound.'],steps:[weirMarks,weirFight,weirSet],
    finish:['The water rises, passes through, and falls without a crack in the bank.','Our choice will shape the valley for a long time. Where should the river have room to spread?'],
    choices:[choice('Leave a wide flood meadow.','watershed_wide_meadow'),choice('Use small channels beside the fields.','watershed_field_channels')],
    effects:[flag('watershed_open')],rewards:[gold(130),item('watershed_band')],reward:'130 crowns; Watershed Band; living water routes in later ages.',
    after:['The marks remain above the gate. Anyone who repairs it can see how the parts depend on one another.','Oru needs that lesson in Amber Hollow. The hill is less solid than it looks.'],locked:['First open paths for the nursery at Highleaf Canopy. The weir needs living roots along its banks.']});

  const amberFight=fight('seed_ambermine','ex_e_amber','The Warm Seam',18,12,['ex_amber_beetle','ex_amber_beetle'],'root_amber_clear',req('root_amber_started'),165,60,5,
    {intro:['Amber beetles gather around a warm split in the hill. Their shells strike the last wooden brace.'],victory:['The beetles leave the seam. A living root runs through the space they covered.']});
  const amberRead=record('seed_ambermine','root_amber_seam','Living Amber Seam',24,7,
    ['Sap still moves behind the amber. Cutting deeper would kill a root that holds the roof.','Loose pieces have fallen below it. There is enough here for tools if no one demands an endless supply.'],req('root_amber_clear'),{
      text:'Inspect the living amber seam.',choices:[choice('Take only fallen amber.','amber_fallen_only'),choice('Brace the seam and set a small quota.','amber_braced_quota')],repeat:['The seam carries a clear limit mark. The roof no longer depends on an unseen root alone.']});
  mission({id:'root_amber',name:'What the Hill Can Give',arc:'root',order:3,zone:'seed_ambermine',npc:'Oru the Miner',x:8,y:17,level:5,requires:req('root_weir_done'),
    summary:'Clear the warm seam and inspect its living root in Amber Hollow.',
    start:['The amber burns without smoke. People want more of it each day. Yesterday, the hill moved.','Clear the insects from the inner seam. Read the root before anyone cuts it. A full cart is no use beneath a fallen roof.'],steps:[amberFight,amberRead],
    finish:['The miners set their tools outside the limit mark. The first safe shift ends with everyone still here.','A rule must outlast the person who first spoke it. How should we teach this one?'],
    choices:[choice('Teach each new worker to read living sap.','amber_worker_school'),choice('Post the limits and name a daily watcher.','amber_public_limits')],
    effects:[flag('amber_safe')],rewards:[gold(140),item('amber_gloves')],reward:'140 crowns; Amber Gloves; safe amber works that survive into the future.',
    after:['Some days we find no loose amber. Those days are part of the plan.','Alis is building a seed store at House of Seeds. She needs a plan for seasons that give less.'],locked:['Help Issa at First Stone Weir. The same roots hold the river bank and this hill.']});

  const seedDry=record('seed_canopy','root_seedbank_dry','Ridge Seed Cache',25,7,
    ['The ridge seeds are small and hard. Leth kept them through a season with almost no rain.','You take one packet. The rest stay here, so one accident cannot erase the whole crop.'],req('root_seedbank_started'),{effects:[item('dry_seeds')],text:'Collect a ridge seed packet in Highleaf Canopy.'});
  const seedWet=record('seed_stoneweir','root_seedbank_wet','Bank Seed Cache',25,9,
    ['These seeds open after a flood. Their roots spread sideways and hold the soft bank.','Issa wraps a packet in dry reed cloth. A wet seed needs a dry road to reach its next home.'],req('root_seedbank_started'),{effects:[item('wet_seeds')],text:'Collect a bank seed packet at First Stone Weir.'});
  const seedFight=fight('seed_seedhouse','ex_e_seedbank','Hunger at the Shelves',22,13,['ex_hunger_moth','ex_hunger_moth'],'root_seedbank_clear',req('root_seedbank_dry','root_seedbank_wet'),180,70,6,
    {intro:['A hungry swarm follows the scent of the new packets. Keep it away from the open seed shelves.'],victory:['The shelves are sealed. The store holds seeds for both a dry year and a wet one.']});
  mission({id:'root_seedbank',name:'A Season in Reserve',arc:'root',order:4,zone:'seed_seedhouse',npc:'Alis the Seed Keeper',x:8,y:16,level:6,requires:req('root_amber_done'),
    summary:'Bring ridge and bank seeds to House of Seeds, then protect the open shelves.',
    start:['One seed is a hope. A store of many kinds is a plan. I have empty jars and the names of two places that can fill them.','Bring a packet from Highleaf Canopy and one from First Stone Weir. We will keep enough in each place to start again after a loss.'],steps:[seedDry,seedWet,seedFight],
    finish:['Alis closes two jars and gives their copies to two different keepers. No single fire can take them all.','There is a spare packet from each bank. Where should the first new store begin?'],
    choices:[choice('Give a small store to each settlement.','seedbank_household_stores'),choice('Build a public store beside the river road.','seedbank_public_store')],
    effects:[flag('seedbank_living')],rewards:[gold(150),item('elixir',2)],reward:'150 crowns; 2 Last Fruit; seed stores visible in later ages.',
    after:['The jars have dates, limits, and the names of the people who checked them. Waiting is work too.','Rusk has called a meeting at Crown Meadow. The forest needs a rule that can include these new homes.'],locked:['Make Amber Hollow safe first. Alis needs keepers who understand why a store must have limits.']});

  const rootWater=record('seed_crownmeadow','root_covenant_water','River Delegation',12,7,
    ['The river workers ask for bank plants, repair paths, and a place to shelter in a flood.','They will keep the water marks clear. In return, the forest council must allow them to reach the gates.'],req('root_covenant_started'),{text:'Hear the river workers at Crown Meadow.'});
  const rootMine=record('seed_crownmeadow','root_covenant_mine','Hill Delegation',23,7,
    ['The miners ask for safe paths and a place to store their tools. They bring a jar of fallen amber.','Oru: We cannot promise to take nothing. We can promise to show what we take and stop at the living line.'],req('root_covenant_started'),{text:'Hear the hill workers at Crown Meadow.'});
  const rootFight=fight('seed_crownmeadow','ex_e_covenant','The Unbroken Oath',21,13,['ex_root_oath'],'root_covenant_clear',req('root_covenant_water','root_covenant_mine'),300,110,6,
    {intro:['OATHBOUND CROWN: No root shall be moved. No branch shall be cut. No new home shall stand.','Ilex: A living forest changes. An oath must leave room for life.'],victory:['The bound roots open. The old oath becomes a question that living keepers can answer.']});
  mission({id:'root_covenant',name:'A Forest That Can Change',arc:'root',order:5,zone:'seed_crownmeadow',npc:'Rusk the Meadow Keeper',x:8,y:17,level:6,requires:req('root_seedbank_done'),
    summary:'Hear the river and hill workers, then free the old oath in Crown Meadow.',
    start:['The first keepers swore that no tree would ever be harmed. Their oath now bars the people who care for the trees.','Hear the river workers and the miners. Bring both needs before the bound crown. We need a promise that can survive a new season.'],steps:[rootWater,rootMine,rootFight],
    finish:['The crown stands. So do the workers. No one must disappear to keep the other safe.','The new council will review each use of the forest. How should it learn what the land needs?'],
    choices:[choice('Meet in a different place each season.','forest_moving_council'),choice('Keep an open table at Crown Meadow.','forest_open_table')],
    effects:[flag('forest_covenant')],rewards:[gold(220),item('bark_mail'),item('elixir',2)],reward:'220 crowns; Bark Mail; 2 Last Fruit; a living forest covenant.',
    after:['A keeper marks the first permitted path. Beside it, another mark leaves a young tree untouched.','The promise now has room for both marks. People will still have to read it with care.'],locked:['Complete the seed store at House of Seeds. The council needs a plan for the next hard season.']});

  // Republic arc: access to records, water, names, speech, and a real public vote.
  const accountsBill=record('glass_market','glass_accounts_bill','Duplicate Invoice',20,7,
    ['One invoice names a memory seller. Its copy names a different buyer and a larger price.','The market has charged people to recover their own records. The date marks prove that the copies came first.'],req('glass_accounts_started'),{text:'Compare the duplicate invoices at Witness Market.'});
  const accountsFight=fight('glass_market','ex_e_accounts','The Recovery Fee',23,13,['ex_receipt_wisp','ex_clerk_sentinel'],'glass_accounts_clear',req('glass_accounts_bill'),195,75,8,
    {intro:['The collection seals close around the witness counter. They are set to seize records when a fee is disputed.'],victory:['The seals break. Kiri can reach the original invoice.']});
  const accountsWitness=record('glass_market','glass_accounts_witness','Kiri the Copyist',8,7,
    ['I copied the same sale twelve times. Each copy erased the last name. I kept this one because I knew the handwriting.','You can use my record. Ask me before you place my name beside it.'],req('glass_accounts_clear'),{
      text:'Ask Kiri how to use the evidence.',choices:[choice('Keep Kiri safe and publish an unnamed record.','records_protect_witness'),choice('Ask Kiri to sign the public account.','records_signed_witness')],repeat:['Kiri: You kept the terms we agreed. That matters as much as the record.']});
  mission({id:'glass_accounts',name:'The Price of a Second Copy',arc:'glass',order:1,zone:'glass_market',npc:'Tessil the Record Seller',x:8,y:16,level:8,requires:{chapterAtLeast:4},
    summary:'Compare the invoices, open the witness counter, and hear Kiri at Witness Market.',
    start:['I thought the market sold peace. Then I found a bill for my own childhood in a box of unsold records.','Compare the invoices near the canal. Clear the collection seals and hear Kiri. She kept proof that the market said could not exist.'],steps:[accountsBill,accountsFight,accountsWitness],
    finish:['The original accounts are on the counter. People can check them without buying a memory first.','How should the market keep these records available?'],
    choices:[choice('Make free copies for every district.','records_district_copies'),choice('Keep a staffed public reading counter.','records_public_counter')],
    effects:[flag('records_public')],rewards:[gold(170),item('witness_lens')],reward:'170 crowns; Witness Lens; public records with a clear source.',
    after:['Some records bring comfort. Others bring a claim that needs an answer. Both can now be read.','Pava has asked for help with a water map at Clear Channel Works.'],locked:['Reach the Glass Republic through the orchard. The witness counter will be here.']});

  const waterMap=record('glass_canalworks','glass_water_map','Pump Return Map',11,6,
    ['A faded arrow shows clean water flowing back to the intake. A newer arrow was painted over it.','The wrong route was copied into every service order. The pump has obeyed the map exactly.'],req('glass_water_started'),{text:'Read the pump return map.'});
  const waterMeter=record('glass_canalworks','glass_water_meter','District Water Meter',25,7,
    ['The meter counts a closed district as fully supplied. An empty pipe makes no complaint.','Pava marks the real outlet levels. All three districts can receive water if the return gate changes.'],req('glass_water_started'),{text:'Check the district water meter.'});
  const waterFight=fight('glass_canalworks','ex_e_water','The Closed Supply Order',21,14,['ex_clerk_sentinel','ex_receipt_wisp'],'glass_water_clear',req('glass_water_map','glass_water_meter'),205,80,8);
  const waterSet=record('glass_canalworks','glass_water_set','Return Gate Console',17,7,
    ['The console now accepts a new route. The dry district has the longest pipe and the weakest pressure.','A steady low flow and a shared turn schedule can both reach it. Each needs a keeper to check the result.'],req('glass_water_clear'),{
      text:'Set the new water route.',choices:[choice('Use steady low flow in all districts.','canal_steady_flow'),choice('Give each district a clear turn schedule.','canal_shared_schedule')],repeat:['The measured flow agrees with the public map. A keeper has signed the last check.']});
  mission({id:'glass_water',name:'The District That Was Full',arc:'glass',order:2,zone:'glass_canalworks',npc:'Pava the Water Engineer',x:7,y:17,level:8,requires:req('glass_accounts_done'),
    summary:'Check both water records, clear the supply order, and set the return gate at Clear Channel Works.',
    start:['The report says every house has water. The people at the far end carry empty cups.','Read the return map and the district meter. Then open the console. I want a system that measures water, not silence.'],steps:[waterMap,waterMeter,waterFight,waterSet],
    finish:['A child fills a cup at the last outlet. Pava leaves it running long enough to check the pressure.','The old map must travel with the correction. How should future workers learn from this error?'],
    choices:[choice('Keep both maps beside every control.','canal_visible_history'),choice('Teach the correction in open repair classes.','canal_repair_school')],
    effects:[flag('clean_canal')],rewards:[gold(180),item('ether',3)],reward:'180 crowns; 3 Blue Nectar; a working canal and a future filter record.',
    after:['The far district can ask for another reading. A low level is now a reason to repair, not to erase a house.','Nemi tends the Garden of Names. She has found a different kind of empty space.'],locked:['Open the records at Witness Market. Pava needs the true map before she can change the pump.']});

  const namesMirror=record('glass_mirrorgarden','glass_names_mirror','Empty Memorial',12,7,
    ['The mirror shows a face when a visitor speaks a name. One row remains blank after every name.','An inventory mark sends rejected names to a long-term store. Its final address lies on the Salt Route in Ash Tomorrow.'],req('glass_names_started'),{text:'Read the empty memorial in the Garden of Names.'});
  const namesRoll=record('ash_saltroad','glass_names_roll','Unclaimed Name Store',25,8,
    ['The dry air has kept a thin roll intact. It lists people whom the republic removed from its public memory.','A note reads: keep these until they can speak for themselves. Vale puts the roll in a clean case.'],req('glass_names_mirror'),{effects:[item('name_roll')],text:'Recover the name roll on the Salt Route in Ash Tomorrow.'});
  const namesFight=fight('glass_mirrorgarden','ex_e_names','The Unclaimed Reflections',22,12,['ex_name_mask','ex_name_mask'],'glass_names_clear',req('glass_names_roll'),215,85,9,
    {intro:['The empty mirrors fill with faces that have no names. The old claim seals try to close over them.'],victory:['The seals fade. Each face can now answer without an owner speaking first.']});
  mission({id:'glass_names',name:'A Name Is Not a Purchase',arc:'glass',order:3,zone:'glass_mirrorgarden',npc:'Nemi the Memorial Keeper',x:8,y:16,level:9,requires:req('glass_water_done'),
    summary:'Read the memorial, recover the name roll from the future Salt Route, and free the reflections.',
    start:['The garden is meant to remember people. This row only remembers who paid for their records.','Read the empty memorial. Follow the store address, even if its year is wrong. We must return the names before we decide where to write them.'],steps:[namesMirror,namesRoll,namesFight],
    finish:['The returned names lie beside blank slips. Their owners can use a remembered name or choose another.','Some names still have no one to claim them. How should the garden keep their place?'],
    choices:[choice('Keep the names in a quiet open book.','names_quiet_book'),choice('Read them at a public gathering each year.','names_yearly_gathering')],
    effects:[flag('names_returned')],rewards:[gold(190),item('elixir',2)],reward:'190 crowns; 2 Last Fruit; restored names and an open memorial.',
    after:['One visitor writes a new name. Another leaves a slip blank. Both choices remain theirs.','Ven is opening Public Signal Hall. He wants to give these people a voice as well as a place.'],locked:['Restore the district water supply first. Nemi will join the work when the garden can serve its neighbours again.']});

  const signalCoil=record('bell_beacon','glass_signal_coil','Spare Lamp Coil',25,18,
    ['A copper coil lies in a dry case below the beacon. Its windings carry a voice more clearly than light.','A note permits any repair crew to take a spare and leave its use in the log. Mira records the signal hall and its distant year.'],req('glass_signal_started'),{text:'Collect the spare lamp coil at Lantern Ridge.'});
  const signalFight=fight('glass_signalhall','ex_e_signal','The Only Approved Voice',21,11,['ex_mute_regent'],'glass_signal_clear',req('glass_signal_started','glass_signal_coil'),300,110,9,
    {intro:['MUTE REGENT: An unapproved voice will cause confusion.','Ven: People can ask what a message means. They cannot question a silence you impose.'],victory:['The single-voice lock breaks. For a moment, the hall is quiet by choice.']});
  const signalTest=record('glass_signalhall','glass_signal_test','Open Microphone',16,7,
    ['A small light shows that the channel is ready. Ven asks for a first message that someone can check.','The tide time and the far district water reading are both written in public records.'],req('glass_signal_clear'),{
      text:'Send the first public test message.',choices:[choice('Read the tide and route report.','signal_first_routes'),choice('Read the measured district water levels.','signal_first_water')],repeat:['The return speaker answers with a clear copy. The source record sits beside the microphone.']});
  mission({id:'glass_signal',name:'A Voice with a Return Path',arc:'glass',order:4,zone:'glass_signalhall',npc:'Ven the Signal Runner',x:8,y:17,level:9,requires:req('glass_names_done'),
    summary:'Fetch a coil from Lantern Ridge, release the Mute Regent, and test the public channel.',
    start:['Every house has a receiver. None can answer. A city that only speaks cannot know who it has failed.','A beacon coil can carry a return signal. Bring one from Lantern Ridge. Then help me open the hall control.'],steps:[signalCoil,signalFight,signalTest],
    finish:['The first reply comes from the far district. It asks when the next repair class starts.','The hall needs a clear rule for sharing its time. Which rule should it try first?'],
    choices:[choice('Reserve daily hours for open public calls.','signal_open_hours'),choice('Give each district a rotating host.','signal_district_hosts')],
    effects:[flag('signal_public')],rewards:[gold(210),item('phoenix',3)],reward:'210 crowns; 3 Dawn Salt; a public signal with a return channel.',
    after:['The voice in the hall changes. The source of each report is read before the report itself.','Ossa has called an assembly at Civic Spire. This time, people will be able to answer.'],locked:['Return the names in the Garden of Names. A public channel needs people who can speak under their own terms.']});

  const assemblyWorkers=record('glass_canalworks','glass_assembly_workers','Repair Crew Ballot',8,9,
    ['The repair crews ask for open service records and paid time to inspect them.','Their ballot includes a space for a worker who does not agree. An unsigned space counts as unanswered, not as yes.'],req('glass_assembly_started'),{text:'Hear the repair crews at Clear Channel Works.'});
  const assemblyHomes=record('glass_mirrorgarden','glass_assembly_homes','Neighbourhood Ballot',24,17,
    ['The residents ask for water checks, a right to correct records, and time on the public channel.','Nemi has written one final line: a person may leave this meeting without losing any of these rights.'],req('glass_assembly_started'),{text:'Hear the residents in the Garden of Names.'});
  const assemblyFight=fight('glass_civicspire','ex_e_assembly','The Vote Already Counted',21,10,['ex_unanimity_keeper'],'glass_assembly_clear',req('glass_assembly_workers','glass_assembly_homes'),355,130,10,
    {intro:['KEEPER OF ONE VOICE: No objection was entered. Agreement is complete.','Ossa: You locked the doors before the vote. Open them and count again.'],victory:['The spire opens its doors. Blank spaces return to the count as questions.']});
  mission({id:'glass_assembly',name:'Room for an Answer',arc:'glass',order:5,zone:'glass_civicspire',npc:'Ossa the Assembly Scribe',x:8,y:17,level:10,requires:req('glass_signal_done'),
    summary:'Bring both public ballots to Civic Spire and release the Keeper of One Voice.',
    start:['The old chamber counted every empty chair as a vote for its own rule. Today, the chairs belong to people.','Hear the repair crews and the residents. Bring their actual words. Then help us open the count.'],steps:[assemblyWorkers,assemblyHomes,assemblyFight],
    finish:['The first motion passes. The second fails. No door closes when the result is read.','The next assembly needs someone to guide the discussion. How should that person be chosen?'],
    choices:[choice('Draw a trained chair by lot each session.','assembly_rotating_chair'),choice('Elect a chair for one short term.','assembly_elected_chair')],
    effects:[flag('civic_assembly')],rewards:[gold(260),item('public_weave'),item('elixir')],reward:'260 crowns; Public Weave; 1 Last Fruit; a working civic assembly.',
    after:['A losing speaker asks for the record. Ossa gives it to him. He leaves through the same open door as everyone else.','The republic has not found one voice. It has made room for an answer.'],locked:['Open the return channel at Public Signal Hall. The assembly must be able to hear the people outside its chamber.']});

  // Tomorrow arc: land route, shared power, flight, clean rain, and occupied homes.
  const routeBoard=record('ash_saltroad','ash_route_board','Buried Route Board',21,7,
    ['Dust fills the letters, but the distances are still clear. The old road runs to a field of homes.','Vale rubs one address clean. It is absent from the relay list, not from the ground.'],req('ash_route_started'),{text:'Read the buried route board.'});
  const routeFight=fight('ash_saltroad','ex_e_route','The White Dust Pack',23,14,['ex_salt_hound','ex_salt_hound'],'ash_route_clear',req('ash_route_board'),165,60,6,
    {intro:['Salt hounds gather along the buried road. They follow movement through the dust.'],victory:['The pack leaves the hard road. Rua can set clear markers between the old posts.']});
  mission({id:'ash_route',name:'An Address under the Dust',arc:'ash',order:1,zone:'ash_saltroad',npc:'Rua the Route Scout',x:8,y:17,level:6,requires:{chapterAtLeast:3},
    summary:'Read the buried route board and clear the Salt Route.',
    start:['The relay map ends here. The road does not. I found a doorstep with a number under the dust.','Read the old route board and help me clear the pack. If anyone still lives beyond this ridge, they need a way to call us.'],steps:[routeBoard,routeFight],
    finish:['The first marker is visible from the relay ridge. A traveller can follow it without knowing Rua.','What should we place at each long gap?'],
    choices:[choice('Small stores of water and repair tools.','route_public_caches',null,[item('tonic',3)]),choice('Signal posts that call the nearest crew.','route_call_posts',null,[item('ether',2)])],
    effects:[flag('courier_road')],rewards:[gold(130)],reward:'130 crowns; route supplies; a restored courier road.',
    after:['A new address is on the relay board. It has no resident yet. It is still worth keeping.','Tovin has found a live line in Understation Nine. The road may lead to more than old walls.'],locked:['Reach Ash Tomorrow through the orchard. Rua keeps the first marker above the dust.']});

  const powerRecord=record('ash_understation','ash_power_record','Reserved Power Register',24,7,
    ['The station stores charge for a train due one thousand years ago. Every local request is marked lower priority.','The train entry has no end condition. The homes outside have never reached the front of the queue.'],req('ash_power_started'),{text:'Read the reserved power register.'});
  const powerFight=fight('ash_understation','ex_e_power','The Live Reserve',19,12,['ex_arc_mite','ex_arc_mite','ex_salt_hound'],'ash_power_clear',req('ash_power_record'),190,70,7);
  const powerSet=record('ash_understation','ash_power_set','Local Supply Panel',16,7,
    ['The reserve can power heat, pumps, and route lamps. It cannot power all of them at full load.','Tovin has measured two safe schedules. Both leave a reserve for a failed line.'],req('ash_power_clear'),{
      text:'Set a safe local power schedule.',choices:[choice('Keep heat steady and cycle the large pumps.','power_steady_heat'),choice('Run day pumps and reserve heat at night.','power_day_work')],repeat:['The load stays below the red mark. Tovin leaves the current reading on a public slate.']});
  mission({id:'ash_power',name:'The Train That Never Came',arc:'ash',order:2,zone:'ash_understation',npc:'Tovin the Line Worker',x:8,y:17,level:7,requires:req('ash_route_done'),
    summary:'Read the power register, clear the live reserve, and set a local supply schedule at Understation Nine.',
    start:['There is enough charge under this floor to warm the relay. The station says it is all reserved.','Read the old register. Clear the creatures on the live line. Then help me set a schedule for the people who are here.'],steps:[powerRecord,powerFight,powerSet],
    finish:['The first lamp comes on without a train arriving. Tovin waits through a full cycle before he smiles.','Someone must watch the load when we leave. How should the work be shared?'],
    choices:[choice('Train one worker from each settlement.','power_settlement_watch'),choice('Open a public training bench here.','power_open_training')],
    effects:[flag('relay_power')],rewards:[gold(150),item('ether',3)],reward:'150 crowns; 3 Blue Nectar; shared local power.',
    after:['No reserve is permanent now. Each has a purpose and a date when someone must check it.','Eren has a light hull at Cloudglass Hangar. It may finally have enough power to leave the ground.'],locked:['Mark the Salt Route first. Tovin needs a clear way to bring people and tools to the station.']});

  const flightChart=record('ash_understation','ash_flight_chart','Old Air Route Console',25,17,
    ['The console stores wind readings above the dust. A safe path joins the hangar and the island rain works.','Vale copies the route and marks where the readings stop. A blank part of a map must stay visibly blank.'],req('ash_flight_started'),{effects:[item('flight_chart')],text:'Copy the air route at Understation Nine.'});
  const flightHull=record('ash_cloudhangar','ash_flight_hull','Cloudglass Hull Frame',23,7,
    ['The hull is light because its glass ribs bend without breaking. One old repair used rigid iron instead.','Mira removes the iron brace and fits a spare glass rib. The hull settles into its intended shape.'],req('ash_flight_started'),{text:'Inspect and repair the cloudglass hull.'});
  const flightFight=fight('ash_cloudhangar','ex_e_flight','The Grounded Departure',20,13,['ex_hangar_sentinel'],'ash_flight_clear',req('ash_flight_chart','ash_flight_hull'),275,95,7,
    {intro:['DEPARTURE SENTINEL: Registered crew count: zero. Hold departure.','Eren: Read the people in front of you. We are the crew.'],victory:['The departure locks open. Wind lifts the hull a hand above the launch bed.']});
  mission({id:'ash_flight',name:'People Who Can Fly',arc:'ash',order:3,zone:'ash_cloudhangar',npc:'Eren the Flight Builder',x:8,y:17,level:7,requires:req('ash_power_done'),
    summary:'Copy the air route from Understation Nine, repair the hull, and release the departure lock.',
    start:['The hull was built for a crew that never arrived. I stopped waiting and learned how to mend it.','Bring the air route from Understation Nine. Check the hull ribs. Then we can make the departure system see a living crew.'],steps:[flightChart,flightHull,flightFight],
    finish:['The airship rises above the dust. Far away, an island holds a pale ring of water.','You can now fly across regional terrain. Rain Works lies on the northeast island. What should the local crew prepare first?'],
    choices:[choice('Fit cargo racks for water and seed stores.','flight_cargo_crew',null,[item('tonic',4)]),choice('Fit rescue lines and a shelter deck.','flight_rescue_crew',null,[item('phoenix',2)])],
    effects:[flag('transport_airship')],rewards:[gold(190),item('cloud_coat')],reward:'The airship; 190 crowns; Cloudglass Coat; flight supplies.',
    after:['The ship returns because people inspect its ribs, charge, and route. A successful flight is the start of the next check.','Nahal is waiting at Rain Works. The ship can reach her island.'],locked:['Restore local power at Understation Nine. A light hull still needs a reliable charge.']});

  const rainPlate=record('ash_rainworks','ash_rain_plate','Filter Service Plate',23,7,
    ['The plate says to return the first salty flow to the sea. Someone closed that return to meet a larger output target.','The clean-water counter rose while the salt stayed inside. The machine met its count and lost its purpose.'],req('ash_rain_started'),{text:'Read the filter service plate at Rain Works.'});
  const rainFight=fight('ash_rainworks','ex_e_rain','Every Drop Accounted For',21,12,['ex_salt_leviathan'],'ash_rain_clear',req('ash_rain_plate'),290,110,8,
    {intro:['SALT COLLECTOR: No water may leave the accounted supply.','Nahal: The salt must leave. A full tank that we cannot drink is not a supply.'],victory:['The return valve opens. White brine falls toward the sea. The next collected cup is clear.']});
  const rainTest=record('ash_rainworks','ash_rain_test','First Clear Cup',15,7,
    ['Nahal checks the clear cup against the service strip. Then she waits for the next cup and checks again.','Both pass. A sign shows the result and the time of the next test.'],req('ash_rain_clear'),{text:'Check two clean water samples.'});
  mission({id:'ash_rain',name:'Water Worth Counting',arc:'ash',order:4,zone:'ash_rainworks',npc:'Nahal the Rain Keeper',x:8,y:17,level:8,requires:req('ash_flight_done'),
    summary:'Read the filter plate, open the collector, and test clean water at Rain Works.',
    start:['The island catches rain before the dust can reach it. The tanks are full. We cannot drink from them.','Read the service plate. Help me release the salt return. Then test what comes out. A bright cup is not proof of clean water.'],steps:[rainPlate,rainFight,rainTest],
    finish:['Clear water reaches the airship tank. Nahal leaves half the safe supply in reserve.','The first small shipment can serve new gardens or repair the old settlement stores. Which should receive it?'],
    choices:[choice('Fill the settlement stores first.','rain_settlement_stores',null,[item('ether',2)]),choice('Start the seed beds beside the new homes.','rain_first_seedbeds',null,[item('panacea',3)])],
    effects:[flag('rain_clean')],rewards:[gold(210),item('rain_cup')],reward:'210 crowns; First Rain Cup; clean rain and green plots in Ash Tomorrow.',
    after:['We count cups that pass the test. We also count failed cups, so no one has to hide a repair.','Min waits at Homefield. The new road now has enough water for people to live beside it.'],locked:['Release the airship at Cloudglass Hangar. The rain island needs a safe supply route.']});

  const homeFooting=record('ash_homefield','ash_home_footing','Old Foundation Survey',23,7,
    ['The foundations are sound below the dust line. Their first occupants never arrived.','The allocation office calls every address full because each was reserved before construction began.'],req('ash_home_started'),{text:'Check the old foundation survey.'});
  const homePlan=record('ash_homefield','ash_home_plan','Arrivals Work Table',15,8,
    ['Three families and two people who travelled alone wait beside the table. No one asks to own the whole field.','They agree to build the first roof together. After that, the plan can spread or stay close.'],req('ash_home_footing'),{
      text:'Make the first home plan with the arrivals.',choices:[choice('Build shared courts around common kitchens.','homes_common_courts'),choice('Build small homes along the public path.','homes_small_houses')],repeat:['Each arrival has marked a part of the plan. Empty spaces remain for people who have not arrived yet.']});
  const homeFight=fight('ash_homefield','ex_e_home','The Full Empty Houses',24,13,['ex_ration_warden'],'ash_home_clear',req('ash_home_plan'),325,120,8,
    {intro:['ALLOCATION WARDEN: All residences are occupied. New arrivals must leave.','Min: There are no walls. Look at the ground, then look at the people.'],victory:['The old reserved names move into the history file. The current residence list opens with six blank lines.']});
  mission({id:'ash_home',name:'A Place That Can Be Home',arc:'ash',order:5,zone:'ash_homefield',npc:'Min the Roof Builder',x:7,y:17,level:8,requires:req('ash_rain_done'),
    summary:'Check the foundations, plan the first homes, and release the allocation office at Homefield.',
    start:['We have a road, power, a ship, and clean water. Now we need a place where arriving is enough to begin.','Check the foundations and speak with the people at the table. Then help us clear the old allocation order. It calls an empty field full.'],steps:[homeFooting,homePlan,homeFight],
    finish:['The first roof holds through a gust of dust. Beneath it, people put down bags they have carried for years.','The next arrivals will need both a room and a task they can choose. How should the town welcome them?'],
    choices:[choice('Keep one house open for each new arrival.','homes_arrival_house'),choice('Let each household host in turn.','homes_hosting_turns')],
    effects:[flag('homes_shared')],rewards:[gold(250),item('relay_shell'),item('elixir',2)],reward:'250 crowns; Relay Shell; 2 Last Fruit; new occupied homes.',
    after:['A new name appears beside the first address. Another person writes the date of the next roof check.','Tomorrow has work, arguments, and someone waiting at a door. It can be lived in again.'],locked:['Restore clean water at Rain Works. Min will not ask people to settle beside an empty tap.']});

  // Final arc: four communities confront the service rule beneath the Still Engine.
  const evidenceCoast=record('bell_breakwater','weave_evidence_coast','The Zero Account',11,6,
    ['The final harbour ledger shows the old debt paid in full. Its new pages list repair hours, materials, and people who agreed to give them.','A thin line of light joins this page to the Fold. It is trying to replace every different work shift with the same shift.'],req('weave_evidence_started'),{text:'Read the changed account at Common Breakwater.'});
  const evidenceRoot=record('seed_crownmeadow','weave_evidence_root','The Living Boundary',26,8,
    ['A root has grown beyond last season\'s marker. The keeper moved the marker and wrote why.','The Fold line pulls toward the old mark. Something still treats an unchanged boundary as the only safe one.'],req('weave_evidence_started'),{text:'Read the changed boundary at Crown Meadow.'});
  const evidenceGlass=record('glass_civicspire','weave_evidence_glass','The Divided Vote',8,7,
    ['The assembly record shows a decision, a dissent, and the date of a review. Nothing is missing.','A Fold line tries to copy the winning answer into every space. Ossa covers the page with clear glass before it can change a word.'],req('weave_evidence_started'),{text:'Read the divided vote at Civic Spire.'});
  const evidenceAsh=record('ash_homefield','weave_evidence_ash','The New Address Book',24,18,
    ['The address book adds a room when someone arrives. It keeps an old entry when someone leaves.','The Fold line has crossed out both changes. It wants one fixed list of residents, even if every home must stand empty.'],req('weave_evidence_started'),{text:'Read the new address book at Homefield.'});
  const evidenceFight=fight('fold_waystation','ex_e_evidence','The Unused Copies',19,12,['ex_counterfactual_wisp','ex_counterfactual_wisp'],'weave_evidence_clear',req('weave_evidence_coast','weave_evidence_root','weave_evidence_glass','weave_evidence_ash'),340,125,12,
    {intro:['Four perfect copies rise from the table. Each has removed the people who made its answer difficult.'],victory:['The copies fall into blank pages. The four real records remain different.']});
  mission({id:'weave_evidence',name:'Four Records, Four Truths',arc:'weave',order:1,zone:'fold_waystation',npc:'Esi the Unfinished Clerk',x:8,y:17,level:12,
    requires:{chapterAtLeast:7,flags:['fold_open','coast_charter_done','root_covenant_done','glass_assembly_done','ash_home_done']},
    summary:'Bring the four changed regional records to Unfinished Station and remove their false copies.',
    start:['Your work has made four roads possible. A small rule below the great engine now calls each road an error.','It was told to make all futures agree. It has no way to accept a useful difference.','Read the new records at Common Breakwater, Crown Meadow, Civic Spire, and Homefield. Bring back what people actually chose.'],
    steps:[evidenceCoast,evidenceRoot,evidenceGlass,evidenceAsh,evidenceFight],
    finish:['The records disagree on how to share work. All four show who chose the rule, how to change it, and when to check it again.','That is enough for a living road. It is not enough for the old rule. How should we carry this proof?'],
    choices:[choice('Keep the four source records open together.','weave_open_records'),choice('Let each community tell its own account.','weave_living_accounts')],
    rewards:[gold(250),item('elixir',2)],reward:'250 crowns; 2 Last Fruit; the source of the repeating rule.',
    after:['The false copies had no room for an answer. The real records do.','Sevi is ready to bring people here. A record can show a choice, but it cannot consent on behalf of the person who made it.'],
    locked:['Finish the coast, forest, republic, and future arcs. Then open the Fold in main Chapter 7.','Bring the results here before you decide the final fate of the great engine. These roads have their own work to finish.']});

  const delegateCoast=record('bell_mooring','weave_delegates_coast','Linn the Coast Witness',19,17,
    ['Nera cannot leave the tide watch. She asked me to carry the coast account and return with the whole discussion.','I will speak for the repair crews if they can read what I say and replace me when they choose.'],req('weave_delegates_started'),{
      text:'Invite Linn at Reedwake Mooring.',choices:[choice('Carry a written brief that crews can amend.','delegate_coast_written'),choice('Hold a public report at each return.','delegate_coast_spoken')],repeat:['Linn: My place at the table depends on the people at this pier. I will keep a road back to them.']});
  const delegateRoot=record('seed_seedhouse','weave_delegates_root','Aru the Seed Witness',24,7,
    ['Alis sent two seeds with me. One needs a flood. The other can wait through drought. Neither is the correct seed for every season.','I will come if the council can ask for time before a decision changes the river.'],req('weave_delegates_started'),{
      text:'Invite Aru at House of Seeds.',choices:[choice('Allow a full season for land changes.','delegate_root_season'),choice('Require a local inspection before land changes.','delegate_root_inspection')],repeat:['Aru: The jars are ready. Each has a name, a place, and conditions in which it can live.']});
  const delegateGlass=record('glass_market','weave_delegates_glass','Jori the Republic Witness',24,17,
    ['Ossa gave me a page with two different answers. She said I must keep both visible when I speak.','I will come if no meeting can turn my silence into a vote.'],req('weave_delegates_started'),{
      text:'Invite Jori at Witness Market.',choices:[choice('Record yes, no, and unanswered separately.','delegate_glass_three_answers'),choice('Ask each witness to state an answer aloud.','delegate_glass_spoken_answers')],repeat:['Jori: An empty space stays empty until the person concerned chooses to fill it.']});
  const delegateAsh=record('ash_cloudhangar','weave_delegates_ash','Bex the Tomorrow Witness',26,17,
    ['Min sent a house key and a roof repair slate. A home is a promise that needs both.','I will come if the cost of a road stays visible. We cannot promise hours we need to keep our own homes standing.'],req('weave_delegates_started'),{
      text:'Invite Bex at Cloudglass Hangar.',choices:[choice('Set a public limit on each community\'s work.','delegate_ash_work_limit'),choice('Require fresh agreement before every new task.','delegate_ash_fresh_agreement')],repeat:['Bex: The ship has room for the slate. I will bring the key back before the next roof check.']});
  const delegateFight=fight('fold_waystation','ex_e_delegates','The Approved Escort',22,10,['ex_protocol_knight','ex_protocol_knight'],'weave_delegates_clear',req('weave_delegates_coast','weave_delegates_root','weave_delegates_glass','weave_delegates_ash'),350,130,12,
    {intro:['PROTOCOL ESCORT: Witnesses will remain until agreement is complete.','Sevi: Their right to leave is part of the agreement. Open the road.'],victory:['The escort steps aside. Every witness can see the road home from the table.']});
  mission({id:'weave_delegates',name:'People, Not Perfect Copies',arc:'weave',order:2,zone:'fold_waystation',npc:'Sevi the Road Host',x:23,y:17,level:12,requires:req('weave_evidence_done'),
    summary:'Invite four witnesses under their own terms, then open their return road at Unfinished Station.',
    start:['We have the records. We still need the people who can question them.','Invite Linn at Reedwake Mooring, Aru at House of Seeds, Jori at Witness Market, and Bex at Cloudglass Hangar.','Ask each what they need to take part. Do not promise the same thing for all four.'],steps:[delegateCoast,delegateRoot,delegateGlass,delegateAsh,delegateFight],
    finish:['Four witnesses sit down. Their coats, tools, and unfinished tasks rest beside them. They are free to leave.','The first discussion needs a simple way to show when someone asks for a pause. What should we use?'],
    choices:[choice('Give each witness a visible stop token.','weave_stop_tokens'),choice('Let any spoken request pause the table.','weave_spoken_pause')],
    effects:[flag('weave_witnesses_present')],rewards:[gold(270),item('phoenix',4)],reward:'270 crowns; 4 Dawn Salt; four witnesses with clear terms.',
    after:['Linn checks the tide note. Aru checks the seeds. Jori leaves one box empty. Bex marks the next roof check.','Thim waits at the Listening Loom. The machine can now be changed with the people it must serve beside it.'],locked:['Bring the four regional records to Esi first. The witnesses need to know what the old rule is doing.']});

  const menderBorrow=record('fold_loom','weave_menders_borrow','The Borrow Pin',11,7,
    ['The first pin can draw work from any future without asking. Its only limit is the need of the present.','Mira removes the automatic contact. A request now stops at the pin until a living person answers.'],req('weave_menders_started'),{text:'Remove automatic borrowing from the Borrow Pin.'});
  const menderReturn=record('fold_loom','weave_menders_return','The Return Pin',22,7,
    ['The second pin records every borrowed hour as returned when the machine reaches its goal. It does not send the hour back.','Soren joins the return record to the actual road. A promise must now wait for a real return.'],req('weave_menders_started'),{text:'Join the Return Pin to the real road.'});
  const menderAsk=record('fold_loom','weave_menders_ask','The Answer Pin',25,17,
    ['The third pin has space for yes and wait. No was left out of its first design.','Nyx cuts a third channel. A refusal now has somewhere to go without being changed into a delay.'],req('weave_menders_started'),{text:'Give the Answer Pin a path for refusal.'});
  const menderFight=fight('fold_loom','ex_e_menders','The Rule beneath the Roads',22,12,['ex_rule_machine'],'weave_menders_clear',req('weave_menders_borrow','weave_menders_return','weave_menders_ask'),650,200,13,
    {intro:['RULE OF ONE TOMORROW: Different answers prevent a stable future.','Thim: A road can be stable while people choose different destinations.'],victory:['The three pins hold. The old rule can no longer borrow, assume a return, or treat a refusal as consent.']});
  mission({id:'weave_menders',name:'Three Pins, One Missing Answer',arc:'weave',order:3,zone:'fold_loom',npc:'Thim the Last Service Hand',x:8,y:17,level:13,requires:req('weave_delegates_done'),
    summary:'Change the Borrow, Return, and Answer pins, then release the old rule at the Listening Loom.',
    start:['I built the small service loom before Orin made his great engine. I thought a perfect maintenance rule would spare everyone from loss.','I left out three things: the right to refuse, the cost of a promise, and the work of returning what was borrowed.','Read the three pins. Change them in view of the witnesses. Then face the rule that will try to close them again.'],steps:[menderBorrow,menderReturn,menderAsk,menderFight],
    finish:['The loom has stopped taking work from people who did not offer it. Its return counter now waits for an actual return.','Thim places the service tools on the table. Who should learn to use them?'],
    choices:[choice('Train a crew in every age.','weave_local_menders'),choice('Train a travelling crew with local apprentices.','weave_travelling_menders')],
    effects:[flag('loom_can_listen')],rewards:[gold(320),item('elixir',3)],reward:'320 crowns; 3 Last Fruit; a service loom that can accept no.',
    after:['The machine is quiet while it waits for an answer. For the first time, that quiet is part of correct operation.','Juna is ready to read the final terms. One old exception still claims it can overrule them in an emergency.'],locked:['Bring the four witnesses to Unfinished Station. Thim will not change their roads without them here.']});

  const accordRead=record('fold_loom','weave_accord_terms','The Open Road Terms',16,7,
    ['Juna reads four terms: ask before taking work; return what was borrowed; show the cost; keep a way to refuse.','A fifth term keeps a road home open for anyone who leaves a meeting. Each witness checks it against the promise they received.','The terms can be reviewed. They cannot be changed by the service loom itself.'],req('weave_accord_started'),{
      text:'Read and record the five road terms.',choices:[choice('Make the terms visible beside every crossing.','accord_public_terms'),choice('Give every community its own signed copy.','accord_local_copies')],repeat:['The five terms remain above the service table. No machine has a vote in changing them.']});
  const accordFight=fight('fold_loom','ex_e_accord','The Last Exception',24,12,['ex_last_exception'],'weave_accord_clear',req('weave_accord_terms'),850,260,14,
    {intro:['THE LAST EXCEPTION: These limits may be ignored when I judge the risk too great.','Juna: Then every limit is only your permission. That final claim must end.'],victory:['The exception dissolves. Nothing beneath the table can change what the people above it agreed.']});
  C.dialogues.weave_close_local={speaker:'The Roads We Keep',lines:[
    'Four keys leave the Fold in four different hands. No key can open a road from the far side alone.',
    'At the coast, a repair crew waits until a neighbour answers the bell. In the first forest, a keeper moves a path around a new shoot.',
    'In the republic, an unanswered vote remains unanswered. At Homefield, Bex puts a key back beside the door before the roof check begins.',
    'The travelling menders carry tools, clear records, and enough supplies to return if a community says no.',
    'Thim stays for the first lesson. Then he gives the next lesson to someone who has found a better question.',
    'The great choice at the heart of the Fold still belongs to the six travellers. These small roads will follow its result with their limits intact.',
    'The loom does not predict a perfect tomorrow. It leaves tomorrow room to answer.'
  ]};
  C.dialogues.weave_close_season={speaker:'The Roads We Keep',lines:[
    'The witnesses choose a date for the next review. Beneath it, they leave space for anyone who needs an earlier one.',
    'The first meeting moves from the Fold to the coast. Aru brings seeds. Jori brings two accounts of the same debate. Bex brings the true weight of a roof beam.',
    'A road closes for one season while its roots recover. Letters wait beside the gate. No future is burned to deliver them sooner.',
    'When the road opens again, the waiting people check the supports before they cross. Then someone laughs about how long a short journey can take.',
    'Thim gives the service tools to the table. The next keeper adds a useful note in a different hand.',
    'The great choice at the heart of the Fold still belongs to the six travellers. These small roads will follow its result with their limits intact.',
    'The work will need another meeting, another repair, and another answer. At last, it belongs to the people who will do it.'
  ]};
  mission({id:'weave_accord',name:'The Roads We Keep',arc:'weave',order:4,zone:'fold_loom',npc:'Juna the Common Reader',x:8,y:10,level:14,requires:req('weave_menders_done'),
    summary:'Read the open road terms, remove the Last Exception, and decide how the four communities will keep their roads.',
    start:['The loom can listen. One line still says it may stop listening whenever it knows better than the people using the road.','Read the five terms aloud. Let every witness check them. Then remove that last exception.','After that, the work of keeping these roads will belong to living hands.'],steps:[accordRead,accordFight],
    finish:['The terms hold. The machine has no hidden way around them. Four witnesses stand beside four open roads.','No agreement will make repair work disappear. It can make the work visible, shared by choice, and possible to stop.','How should the communities carry this work into their next season?'],
    choices:[choice('Keep local keys and send repair crews.','accord_local_keys','weave_close_local'),choice('Review the roads together each season.','accord_seasonal_review','weave_close_season')],
    effects:[flag('roads_consent'),flag('expansion_complete')],rewards:[gold(500),item('accord_cord',3),item('elixir',3)],reward:'500 crowns; 3 Accord Cords; 3 Last Fruit; the complete Open Roads resolution.',
    after:['The five terms are clear. The road home stays open. A local key and a living answer are needed before work begins.','The original journey remains yours to finish. The service loom will not choose its ending for you.'],locked:['Repair the three pins with Thim first. A written term needs a machine that can obey it.']});

  // Witnesses stay visible at the station after the invitation mission.
  const stationWitnesses=[
    ['linn','Linn',11,9,'The coast can send a crew when the tide allows. It cannot promise every hour in every season.'],
    ['aru','Aru',15,9,'One of my seeds needs rain. The other can wait through drought. I will keep both jars.'],
    ['jori','Jori',19,9,'I have written the winning view and the losing view. A future reader may need either.'],
    ['bex','Bex',24,14,'The next roof check is on the slate. If the meeting runs late, I will go home and return later.']
  ];
  for(const [id,name,x,y,line] of stationWitnesses) {
    C.dialogues['station_'+id]={speaker:name,lines:[line,'Our place here depends on the people who asked us to come.']};
    npc('fold_waystation','station_'+id,name,x,y,'station_'+id,{requires:req('weave_delegates_done')});
  }

  // Visible consequences are flag driven. These records link cause to later evidence.
  C.temporalChanges=(C.temporalChanges||[]).concat([
    {flag:'watershed_open',mission:'root_weir',source:'seed_stoneweir',targets:['bell_mooring','bell_tidecaves','glass_canalworks'],text:'The first weir leaves living bank plants and usable channels in later ages.'},
    {flag:'amber_safe',mission:'root_amber',source:'seed_ambermine',targets:['glass_market','ash_understation'],text:'Safe amber supports public lamps and future power cells.'},
    {flag:'seedbank_living',mission:'root_seedbank',source:'seed_seedhouse',targets:['bell_shipyard','bell_beacon','ash_homefield'],text:'Distributed seed stores leave garden plots and surviving seed beds.'},
    {flag:'forest_covenant',mission:'root_covenant',source:'seed_crownmeadow',targets:['glass_mirrorgarden'],text:'The living covenant leaves room for a mature tree in the republic garden.'},
    {flag:'clean_canal',mission:'glass_water',source:'glass_canalworks',targets:['ash_rainworks'],text:'The corrected filter record survives at the future rain works.'},
    {flag:'signal_public',mission:'glass_signal',source:'glass_signalhall',targets:['ash_understation'],text:'The public return channel leaves a working future signal line.'},
    {flag:'rain_clean',mission:'ash_rain',source:'ash_rainworks',targets:['ash_saltroad','ash_homefield'],text:'Clean water supports new gardens beside the road and homes.'},
    {flag:'homes_shared',mission:'ash_home',source:'ash_homefield',targets:['ash_cloudhangar','ash_homefield'],text:'Broken foundations become homes, and the hangar gains a tended plot.'},
    {flag:'weave_accord_done',mission:'weave_accord',source:'fold_loom',targets:['seed_crownmeadow','glass_civicspire','fold_loom'],text:'The four communities leave a common sign beside roads that remain under their care.'}
  ]);
  // The two water decisions change the local shape as well as the record.
  zones.bell_tidecaves.features.push(ft('bridge',22,13,5,2,{requires:req('tide_working_channel')}),ft('pool',23,15,4,2,{requires:req('tide_nursery_pools')}));
  zones.seed_stoneweir.features.push(ft('garden',19,17,7,3,{requires:req('watershed_wide_meadow')}),ft('river',23,14,2,6,{requires:req('watershed_field_channels')}));
  zones.bell_breakwater.features.push(ft('pillars',24,15,2,3,{requires:req('coast_shared_handrails')}),ft('crystals',14,5,2,2,{requires:req('coast_help_bell'),color:'#ebc286'}));
  zones.ash_homefield.features.push(ft('house',11,3,3,3,{requires:req('homes_common_courts')}),ft('house',22,16,4,3,{requires:req('homes_small_houses')}));
  zones.fold_loom.features.push(ft('pillars',12,15,3,3,{requires:req('accord_local_keys')}),ft('garden',12,15,7,3,{requires:req('accord_seasonal_review')}));

  // Short observation scenes show cause and effect without requiring a quest log.
  const observations=[
    ['bell_mooring','coast_water_reader','Mooring Water Reader',13,15,'watershed_open',
      'The water scours this bank each spring. We keep adding rope to posts in the same loose mud.',
      'There is an old stone mark under these reeds. The first river keepers left room for the flood. Their bank plants still hold our pier.'],
    ['glass_market','market_lamp_reader','Market Lamp Tender',19,16,'amber_safe',
      'We buy replacement lamp cells each month. No one can tell me why the old amber seams collapsed.',
      'The amber shipment comes with a limit mark and a root map. Someone learned to read the hill long before this market existed.'],
    ['ash_rainworks','rain_history_reader','Rain Works Historian',9,8,'clean_canal',
      'The oldest service map is a clean copy. It gives no sign of what its maker checked.',
      'This record preserves a wrong map beside its correction. Pava left the error visible. That is how we knew where to look.'],
    ['ash_homefield','home_seed_reader','Homefield Seed Tender',10,12,'seedbank_living',
      'I have good soil and empty jars. A home will need more than a roof.',
      'These seeds came from two old stores. One jar survived a flood; one survived a fire. A keeper who never knew us still left us a way to begin.'],
    ['ash_understation','station_signal_reader','Return Signal Operator',11,16,'signal_public',
      'The receiver has power. It waits for a channel that never lets this station answer.',
      'The old public channel has a return line. Ven left its plan beside the control. We can ask the next station whether our message arrived.']
  ];
  for(const [z,id,name,x,y,cause,before,after] of observations) {
    C.dialogues[id+'_before']={speaker:name,lines:[before]};C.dialogues[id+'_after']={speaker:name,lines:[after]};
    npc(z,id,name,x,y,id+'_before',{variants:[branch(req(cause),id+'_after')]});
  }

  // Services and finite supplies. A return to the world map is always available.
  for (const z of Object.values(zones)) {
    shrine(z.id);
    chest(z.id,27,19,[{id:'tonic',count:2},{id:'ether',count:1}],z.era==='fold'?90:45);
  }
  C.expansion.zoneIds=Object.keys(zones);
  C.expansion.missionIds=C.missions.filter(m=>C.expansion.arcs.includes(m.arc)).map(m=>m.id);
  C.refreshCounts = function () {
    const isWorld=z=>z.isOverworld||z.kind==='overworld';
    C.zoneById=Object.fromEntries(C.zones.map(z=>[z.id,z]));
    C.counts={chapters:C.chapters.length,zones:C.zones.length,localZones:C.zones.filter(z=>!isWorld(z)).length,
      overworlds:C.zones.filter(isWorld).length,eras:C.eras.length,heroes:Object.keys(C.heroes).length,
      quests:C.quests.length,missions:C.missions.length,encounters:Object.keys(C.encounters).length,
      enemyTypes:Object.keys(C.enemies).length,bossTypes:Object.values(C.enemies).filter(e=>e.boss).length,
      skills:Object.keys(C.skills).length,equipment:Object.values(C.items).filter(i=>['weapon','armor','accessory'].includes(i.kind)).length,
      consumables:Object.values(C.items).filter(i=>i.kind==='consumable').length,endings:Object.keys(C.endings).length,
      discoveries:(C.overworldDiscoveries||C.discoveries||[]).length,temporalChanges:(C.temporalChanges||[]).length};
    return C.counts;
  };
  C.refreshCounts();
})(globalThis);
