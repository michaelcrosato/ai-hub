/* The Far Shore — original dungeon campaign. Geometry and systems are separate. */
(function(global){
  'use strict';
  const D=global.Dawn,C=D&&D.Content;
  if(!C)throw new Error('Load content.js and expansion.js before depths-content.js.');
  if(C.depths&&C.depths.id==='far-shore')return;
  const flag=id=>({type:'flag',id,value:true}),item=(id,count=1)=>({type:'item',id,count}),gold=amount=>({type:'gold',amount});
  const req=(...flags)=>({flags}),branch=(requires,dialogue)=>({requires,dialogue});
  const rooms={},missionIds=[],enemyIds=[],encounterIds=[];
  const P={A:[7,8],B:[16,7],C:[24,8],D:[8,15],E:[17,13],F:[24,16]};
  const PORT={W:[3,12],E:[28,12],N:[16,3],S:[16,20]};
  const ARRIVE={W:[5,12],E:[26,12],N:[16,5],S:[16,18]};
  const materials=new Set(['memory_ore','living_fiber','prism_dust','storm_coil','echo_glass']);
  C.depths={id:'far-shore',name:'The Far Shore',version:'1.2.0',startZone:'depth_bell_dock',startEntity:'depth_tide_signal_start',completeFlag:'far_shore_complete',
    description:'A lost navigator opens a sea between possible worlds. Find the broken vessel, rescue its passengers, and stop the widening passage before it tears four ages apart.',
    antagonist:'Neris',antagonistMotive:'Neris wants a road from every stranded place. He opens all routes at once and refuses to accept the damage that an unlimited passage can cause.'};
  C.dungeons=C.dungeons||[];C.missions=C.missions||[];

  const plans=[
    {id:'sunken_chart_house',name:'The Sunken Chart House',era:'bell642',theme:'tide',level:5,requires:{chapterAtLeast:2},pos:[22,30],done:'depth_tide_complete',
      description:'A drowned navigation school holds one part of a ship that was never launched in this age.',
      rooms:[['depth_bell_dock','The Answering Dock'],['depth_bell_locks','The Three Locks'],['depth_bell_ballast','Ballast Walk'],['depth_bell_choir','The Listening Chamber'],['depth_bell_keel','The Borrowed Keel']]},
    {id:'spiral_nursery',name:'The Spiral Nursery',era:'seed112',theme:'roots',level:7,requires:{chapterAtLeast:3},pos:[57,34],done:'depth_roots_complete',
      description:'A root-grown observatory shelters a creature from a season that this world has never known.',
      rooms:[['depth_seed_gate','The Leaf Gate'],['depth_seed_canopy','The Turning Canopy'],['depth_seed_channels','The Root Channels'],['depth_seed_nursery','The Skyless Nursery'],['depth_seed_heart','The Deep Flower']]},
    {id:'mirror_theatre',name:'The Mirror Theatre',era:'glass1186',theme:'mirrors',level:9,requires:{chapterAtLeast:4},pos:[83,34],done:'depth_mirrors_complete',
      description:'A theatre performs the wreck each night. Its reflections know which part of the account was changed.',
      rooms:[['depth_glass_foyer','The Empty Foyer'],['depth_glass_gallery','The Two Accounts'],['depth_glass_prisms','The Prism Walk'],['depth_glass_wings','The Unused Wings'],['depth_glass_stage','The Last Performance']]},
    {id:'stormfound_ark',name:'The Stormfound Ark',era:'ash2310',theme:'storm',level:9,requires:{chapterAtLeast:4},pos:[44,60],done:'depth_storm_complete',
      description:'The upper deck of a lost vessel rests above the dust. A few passengers remain behind its locked storm doors.',
      rooms:[['depth_ash_camp','The Hull Camp'],['depth_ash_conduit','The Live Conduit'],['depth_ash_skywalk','The Broken Skywalk'],['depth_ash_berths','The Sealed Berths'],['depth_ash_bridge','The Weather Bridge']]},
    {id:'far_shore',name:'The Far Shore',era:'fold',theme:'hollow',level:14,
      requires:{chapterAtLeast:7,flags:['fold_open','depth_tide_complete','depth_roots_complete','depth_mirrors_complete','depth_storm_complete']},pos:[25,22],done:'far_shore_complete',
      description:'The lost vessel meets its own wake. Neris opens the last passage while a living undertow gathers below it.',
      rooms:[['depth_fold_quay','The Unmoored Quay'],['depth_fold_echoes','The Echo Berths'],['depth_fold_garden','The Possible Garden'],['depth_fold_hold','The Navigator\'s Hold'],['depth_fold_horizon','The Far Horizon']]}
  ];
  for(const p of plans){
    C.dungeons.push({id:p.id,name:p.name,era:p.era,entrance:p.rooms[0][0],rooms:p.rooms.map(r=>r[0]),requires:p.requires,description:p.description,completeFlag:p.done,recommendedLevel:p.level});
    p.rooms.forEach(([id,name],i)=>{
      const z={id,name,era:p.era,width:32,height:24,spawn:{x:16,y:18},style:'dungeon',description:p.description,
        dungeonId:p.id,dungeonRoom:i+1,dungeonTheme:p.theme,dungeonLayout:{preset:['entry','passage','crossing','vault','heart'][i]},
        features:[],entities:[],exits:[],overworldRequires:p.requires,...(i===0?{worldMapPosition:p.pos}:{overworldParent:p.rooms[0][0]})};
      rooms[id]=z;C.zones.push(z);
    });
    const entry=rooms[p.rooms[0][0]];
    entry.exits.push({id:entry.id+'_world',to:'world_'+p.era,name:'Leave the dungeon',x:16,y:20});
    entry.entities.push({id:entry.id+'_camp',type:'camp',name:'Expedition Camp',x:7,y:16},{id:entry.id+'_craft',type:'craft',name:'Field Workbench',x:10,y:16});
  }
  function link(a,side,b,arrival,requires,lockedText){const [x,y]=PORT[side],[tx,ty]=ARRIVE[arrival];rooms[a].exits.push({id:a+'_'+side+'_'+b,name:rooms[b].name,to:b,x,y,tx,ty,...(requires?{requires,lockedText:lockedText||'Complete the work marked in the Journal to open this passage.'}:{})});}
  function twoWay(a,side,b,arrival,requires,lockedText,lockBoth=false){link(a,side,b,arrival,requires,lockedText);link(b,arrival,a,side,lockBoth?requires:undefined,lockedText);}
  function entity(z,id,type,name,slot,extra={}){const [x,y]=Array.isArray(slot)?slot:P[slot];const e={id,type,name,x,y,...extra};rooms[z].entities.push(e);return e;}
  function dialogue(z,id,name,slot,lines,{requires,effects=[],choices=[],after,once=true,extra={}}={}){
    const read=id+'_talk',repeat=id+'_after';
    C.dialogues[read]={speaker:name,lines,choices,effects,...(once?{onceFlag:id+'_seen',onRepeat:repeat}:{}),...extra};
    C.dialogues[repeat]={speaker:name,lines:after||['The work here is complete. Its result remains in place.']};
    if(choices.length)C.dialogues[repeat].variants=choices.filter(c=>(c.effects||[]).some(e=>e.type==='flag')).map(c=>({requires:req(c.effects.find(e=>e.type==='flag').id),lines:[...C.dialogues[repeat].lines,'The next step we chose: '+c.label]}));
    entity(z,id,'npc',name,slot,{dialogue:read,requires});return {entity:id,dialogue:read,zone:z};
  }
  function choose(label,id,next,effects=[]){return {label,effects:[flag(id),...effects],...(next?{next}:{})};}
  function done(id,rewards=[],extra=[]){return [flag(id+'_done'),...extra,...rewards];}
  function step(text,flagId,z,id,extra={}){return {text,flag:flagId,zone:z,entity:id,...extra};}
  function mission(o){
    const startId=o.id+'_start',started=o.id+'_started',completed=o.id+'_done';
    const intro=o.id+'_intro',wait=o.id+'_wait',after=o.id+'_after',locked=o.id+'_locked';
    C.dialogues[intro]={speaker:o.npc,lines:o.intro,onceFlag:o.id+'_intro_seen',onRepeat:wait,effects:[flag(started)]};
    C.dialogues[wait]={speaker:o.npc,lines:o.hint||[o.summary]};
    C.dialogues[after]={speaker:o.npc,lines:o.after||['Follow the next part of the route. The work here is complete.']};
    C.dialogues[locked]={speaker:o.npc,lines:[o.locked||'Complete the previous task in this dungeon. The Journal names the next place.']};
    entity(o.zone,startId,'npc',o.npc,o.slot||'A',{dialogue:locked,variants:[branch(req(completed),after),branch(req(started),wait),branch(o.requires||{},intro)],...(o.hideIf?{hideIf:o.hideIf}:{})});
    const m={id:o.id,name:o.name,campaign:'depths',arc:o.arc,order:o.order,era:rooms[o.zone].era,dungeonId:rooms[o.zone].dungeonId,requires:o.requires||{},summary:o.summary,
      startNpc:o.npc,startEntity:startId,startZone:o.zone,recommendedLevel:o.level,
      steps:[step('Speak to '+o.npc+'.',started,o.zone,startId),...o.steps],completeFlag:completed,reward:o.reward,
      ...(o.completionDialogue?{completionDialogue:o.completionDialogue}:{})};
    C.missions.push(m);missionIds.push(o.id);return m;
  }
  function field(z,id,name,slot,ability,text,requires,effects=[]){
    const hints={cut:'Mira is in the starting party.',resonate:'Soren is in the starting party.',brace:'Find Brann in the Copper Kiln, in the Age of Bells.',grow:'Find Ilex at Mosswake Camp, in the Seed Age.',reveal:'Find Nyx at Prism Steps, in the Glass Republic.',power:'Find Vale at Cinder Relay, in Ash Tomorrow.'};
    entity(z,id,'field',name,slot,{ability,flag:id,lines:text,requires,recruitHint:hints[ability],effects:[flag(id),...effects]});return step('Use '+name+'.',id,z,id,{ability});
  }
  function mechanism(z,id,name,slot,puzzle,hint,requires,effects=[]){entity(z,id,'mechanism',name,slot,{puzzle,flag:id,hint,requires,effects:[flag(id),...effects]});return step('Set '+name+'.',id,z,id,{puzzle:puzzle.kind});}
  function read(z,id,name,slot,lines,requires,effects=[],extra={}){const d=dialogue(z,id,name,slot,lines,{requires,effects:[flag(id),...effects],...extra});return step('Read '+name+'.',id,z,d.entity,{dialogue:d.dialogue});}
  function finishScene(z,id,name,slot,lines,requires,missionId,rewards=[],choices=[],extraEffects=[],after){const d=dialogue(z,id,name,slot,lines,{requires,effects:done(missionId,rewards,[flag(id),...extraEffects]),choices,after});return step('Speak to '+name+'.',missionId+'_done',z,id,{dialogue:d.dialogue});}
  function chest(z,id,slot,loot,g=0,requires){entity(z,id,'chest','Expedition Cache',slot,{loot,gold:g,...(requires?{requires}:{})});}
  function attack(name,power=1,target='enemy',element='physical',type='physical',extra={}){return {name,power,target,element,type,telegraph:target==='allEnemies'||power>=1.5?1.8:.6,charge:target==='allEnemies'||power>=1.5,...extra};}
  function enemy(id,name,hp,atk,mag,def,speed,weak,pattern,extra={}){C.enemies[id]={id,name,maxHp:hp,atk,mag,def,speed,weak,resist:[],pattern,boss:false,staggerMax:75,staggerDuration:3.5,staggerRecovery:2,...extra};enemyIds.push(id);}
  function battle(z,id,name,slot,foes,clearFlag,requires,xp,g,level,{intro,victory,loot=[],effects=[],...extra}={}){
    C.encounters[id]={id,name,enemies:foes,boss:foes.some(id=>C.enemies[id].boss),repeat:false,requires,recommendedLevel:level,xp,gold:g,
      intro:intro||[name+' blocks the passage. Break its charge or guard before it strikes.'],victory:victory||['The passage is safe. The expedition can continue.'],loot,effects:[flag(clearFlag),...effects],...extra};
    const eid=id+'_body';entity(z,eid,'encounter',name,slot,{encounter:id,requires,hideIf:req(clearFlag)});encounterIds.push(id);return step('Resolve '+name+'.',clearFlag,z,eid,{encounter:id});
  }

  // Linked rooms. Return passages never require a consumed object.
  twoWay('depth_bell_dock','N','depth_bell_locks','S',req('dp_bell_sounding'),'Use the sounding bell with Soren to find the submerged stair.');
  twoWay('depth_bell_locks','E','depth_bell_ballast','W',req('dp_bell_sluice'),'Set the three locks to lower the water beside Ballast Walk.');
  twoWay('depth_bell_ballast','N','depth_bell_choir','S',req('depth_tide_level_done'),'Secure Ballast Walk before you climb to the listening chamber.');
  twoWay('depth_bell_choir','E','depth_bell_keel','W',req('depth_tide_passengers_done'),'Help the stranded lookout and restore the lamp circuit.');
  twoWay('depth_bell_ballast','S','depth_bell_dock','E',req('dp_bell_brace'),'Brace the return stair from Ballast Walk.',true);
  link('depth_bell_keel','S','depth_bell_dock','W',req('depth_tide_complete'),'Release the tide anchor before you use the lower return passage.');
  twoWay('depth_seed_gate','N','depth_seed_canopy','S',req('dp_seed_gate'),'Ask Ilex to grow a path through the leaf gate.');
  twoWay('depth_seed_canopy','E','depth_seed_channels','W',req('depth_roots_arrival_done'),'Find what is drawing the seasons into the nursery.');
  twoWay('depth_seed_channels','N','depth_seed_nursery','S',req('depth_roots_water_done'),'Balance the root channels before the nursery opens.');
  twoWay('depth_seed_nursery','E','depth_seed_heart','W',req('depth_roots_hatchling_done'),'Give the hatchling a safe route before you approach the deep flower.');
  twoWay('depth_seed_channels','S','depth_seed_gate','E',req('dp_seed_bank_cut'),'Cut the dead vine from the return path.',true);
  link('depth_seed_heart','S','depth_seed_gate','W',req('depth_roots_complete'),'Release the root anchor to open the old garden road.');
  twoWay('depth_glass_foyer','N','depth_glass_gallery','S',req('depth_mirrors_listen_started'),'Speak to Setha before you enter the performance gallery.');
  twoWay('depth_glass_gallery','E','depth_glass_prisms','W',req('dp_glass_curtain'),'Cut the fallen curtain to reach the prism walk.');
  twoWay('depth_glass_prisms','N','depth_glass_wings','S',req('dp_glass_prism'),'Align the prism walk to open the unused wings.');
  twoWay('depth_glass_wings','E','depth_glass_stage','W',req('depth_mirrors_passenger_done'),'Find the changed account and align the second set of mirrors.');
  twoWay('depth_glass_wings','W','depth_glass_gallery','N',req('dp_glass_backlight'),'Restore the backstage light to use the short route.',true);
  link('depth_glass_stage','S','depth_glass_foyer','W',req('depth_mirrors_complete'),'Release the reflection anchor to open the audience passage.');
  twoWay('depth_ash_camp','N','depth_ash_conduit','S',req('depth_storm_signal_started'),'Speak to Odo before you enter the live conduit.');
  twoWay('depth_ash_conduit','E','depth_ash_skywalk','W',req('dp_ash_grid'),'Restore the power grid to open the storm door.');
  twoWay('depth_ash_skywalk','N','depth_ash_berths','S',req('depth_storm_cable_done'),'Secure the cable and the broken span before you enter the berths.');
  twoWay('depth_ash_berths','E','depth_ash_bridge','W',req('depth_storm_passengers_done'),'Release the passengers from the sealed berths.');
  twoWay('depth_ash_skywalk','S','depth_ash_camp','E',req('dp_ash_brace'),'Brace the lift support to open the return route.',true);
  link('depth_ash_bridge','S','depth_ash_camp','W',req('depth_storm_complete'),'Release the storm anchor before you lower the bridge lift.');
  twoWay('depth_fold_quay','W','depth_fold_echoes','E',req('depth_hollow_arrival_started'),'Speak to Neris before you step onto the echo route.');
  twoWay('depth_fold_quay','E','depth_fold_garden','W',req('depth_hollow_arrival_started'),'Speak to Neris before you enter the possible garden.');
  twoWay('depth_fold_echoes','N','depth_fold_hold','W',req('depth_hollow_passage_done'),'Open both return channels before you approach the navigator.');
  twoWay('depth_fold_garden','N','depth_fold_hold','E',req('depth_hollow_passage_done'),'Open both return channels before you approach the navigator.');
  twoWay('depth_fold_hold','N','depth_fold_horizon','S',req('depth_hollow_captain_done'),'Resolve the dispute with Neris and release the horizon wheel.');
  link('depth_fold_horizon','E','depth_fold_quay','N',req('far_shore_complete'),'Free the vessel from the undertow to lower the last gangway.');

  // New enemies opt into the Break system. Living anchor parts protect guardians.
  enemy('dp_brine_skitter','Brine Skitter',310,24,19,11,12,['wind','spark'],[attack('Salt Claw',1.1),attack('Brine Spray',1.1,'allEnemies','water','magic')],{color:'#879fa7'});
  enemy('dp_chain_eel','Chain Eel',390,26,25,13,11,['earth'],[attack('Linked Bite',1.3),attack('Tighten',1,'enemy','water','magic',{status:{slow:6}})],{resist:['water'],color:'#85a5a0'});
  enemy('dp_lamp_wisp','Drowned Lamp Wisp',285,19,28,10,14,['fire'],[attack('Lost Signal',1.3,'enemy','spark','magic'),attack('Fading Note',1.2,'allEnemies','water','magic')],{color:'#b9d0ac'});
  enemy('dp_hull_pin','Living Hull Pin',360,17,20,9,8,['wind','spark'],[attack('Anchor Pulse',.9,'enemy','earth','magic')],{staggerMax:55,color:'#b9a27a'});
  enemy('dp_keel_guardian','The Hullbound Mariner',1950,30,29,16,10,['water','spark'],[attack('Bow Weight',1.75),attack('Wreck Tide',1.35,'allEnemies','water','magic')],{
    boss:true,rigId:'horizon_crab',size:.9,color:'#7fabb0',guardedBy:'dp_hull_pin',staggerMax:130,staggerDuration:4,
    phases:[{at:.5,name:'The hull opens',weak:['wind','earth'],pattern:[attack('Broken Spar',1.9),attack('Wake without a Sea',1.5,'allEnemies','wind','magic')],speedMult:1.08}]});
  enemy('dp_seed_crawler','Pale Seed Crawler',440,29,24,15,11,['fire'],[attack('Root Jaw',1.2),attack('Seed Drag',1,'enemy','earth','magic',{status:{slow:5}})],{color:'#b5b78b'});
  enemy('dp_pollen_wisp','Blue Pollen Wisp',370,23,33,13,13,['wind','fire'],[attack('Out of Season',1.2,'allEnemies','earth','magic',{status:{poison:6}}),attack('Pollen Flash',1.5,'enemy','spark','magic')],{color:'#9ab9d0'});
  enemy('dp_thirst_hart','Thirst Hart',520,30,29,16,13,['water','fire'],[attack('Dry Antler',1.5),attack('Roots for Rain',1.25,'allEnemies','earth','magic')],{rigId:'glass_hart',size:.65,color:'#b7ba8d',staggerMax:90});
  enemy('dp_root_knot','Season Knot',460,21,27,13,9,['fire','wind'],[attack('Hold the Season',1,'enemy','earth','magic',{status:{slow:5}})],{color:'#a2ac81',staggerMax:60});
  enemy('dp_deep_flower','The Season Eater',2550,35,35,19,10,['fire'],[attack('Borrowed Bloom',1.35,'allEnemies','earth','magic'),attack('Winter Jaw',1.85,'enemy','water','magic')],{
    boss:true,rigId:'root_crown',size:1.05,color:'#acb77d',guardedBy:'dp_root_knot',staggerMax:140,staggerDuration:4,
    phases:[{at:.55,name:'A season turns',weak:['water','wind'],pattern:[attack('Summer Weight',1.85,'enemy','fire','magic'),attack('Wild Pollen',1.35,'allEnemies','earth','magic',{status:{poison:7}})]},{at:.25,name:'Roots exposed',weak:['fire','spark'],pattern:[attack('Last Bloom',1.6,'allEnemies','earth','magic')],speedMult:1.1}]});
  enemy('dp_stage_mask','Uncast Mask',570,34,39,18,14,['water','spark'],[attack('Borrowed Gesture',1.4,'enemy','void','magic'),attack('Empty Applause',1.2,'allEnemies','void','magic')],{resist:['void'],color:'#b5a3c2'});
  enemy('dp_lens_drone','Backlight Drone',605,38,35,18,12,['earth'],[attack('Sharp Reflection',1.5,'enemy','spark','magic'),attack('Stage Sweep',1.2,'allEnemies','wind','magic')],{resist:['spark'],color:'#a2c6c8'});
  enemy('dp_paper_dancer','Paper Understudy',515,36,40,16,15,['fire','water'],[attack('Folded Edge',1.6),attack('Missing Line',1.1,'allEnemies','void','magic',{status:{slow:6}})],{rig:'humanoid',color:'#c1a4b5'});
  enemy('dp_stage_lantern','Binding Stage Lantern',570,23,33,14,9,['water','earth'],[attack('Fixed Spotlight',1.1,'enemy','spark','magic')],{color:'#d1c296',staggerMax:65});
  enemy('dp_cast_guardian','The Cast of One',3250,40,41,22,12,['earth','fire'],[attack('Perfect Entrance',1.8),attack('Everyone in Place',1.35,'allEnemies','void','magic',{status:{slow:5}})],{
    boss:true,rigId:'fourfold_witness',size:1,color:'#b7a6c8',guardedBy:'dp_stage_lantern',staggerMax:150,staggerDuration:4,
    phases:[{at:.6,name:'The script breaks',weak:['water','spark'],pattern:[attack('Unrehearsed Light',1.55,'allEnemies','spark','magic'),attack('A Stolen Exit',1.9)]},{at:.25,name:'No assigned part',weak:['wind','void'],pattern:[attack('Curtain Fall',1.75,'allEnemies','wind','magic')],speedMult:1.1}]});
  enemy('dp_wire_hound','Cable Hound',610,39,31,19,13,['water'],[attack('Steel Tooth',1.4),attack('Live Trail',1.15,'allEnemies','spark','magic')],{color:'#b3a298'});
  enemy('dp_arc_ray','Storm Ray',525,33,41,17,14,['earth','void'],[attack('Arc Wing',1.5,'enemy','spark','magic'),attack('Cloud Shear',1.25,'allEnemies','wind','magic')],{resist:['spark'],color:'#8fb9cb'});
  enemy('dp_ash_scraper','Hull Scraper',680,41,27,24,8,['water','spark'],[attack('Scrape',1.8),attack('Dust Release',1.1,'allEnemies','earth','magic',{status:{slow:5}})],{color:'#bb977e',staggerMax:90});
  enemy('dp_storm_cell','Storm Holding Cell',625,25,35,15,9,['earth','water'],[attack('Stored Lightning',1.2,'enemy','spark','magic')],{resist:['spark'],color:'#d0bc85',staggerMax:65});
  enemy('dp_weather_guardian','The Weather Furnace',3350,41,41,22,11,['water','earth'],[attack('Compressed Front',1.9,'enemy','wind','magic'),attack('All Skies at Once',1.4,'allEnemies','spark','magic')],{
    boss:true,rigId:'still_engine',size:.85,color:'#ac9d86',guardedBy:'dp_storm_cell',staggerMax:150,staggerDuration:4,
    phases:[{at:.55,name:'Pressure wall opens',weak:['wind','void'],pattern:[attack('Hot Rain',1.6,'allEnemies','fire','magic'),attack('Falling Pressure',1.9,'enemy','earth','magic')]},{at:.25,name:'An empty forecast',weak:['spark','water'],pattern:[attack('Last Front',1.8,'allEnemies','wind','magic')],speedMult:1.1}]});
  enemy('dp_unspent_moth','Unspent Moth',755,37,44,21,14,['fire','water'],[attack('Unlived Wing',1.4,'enemy','void','magic'),attack('Possible Dust',1.25,'allEnemies','earth','magic',{status:{poison:6}})],{color:'#c7b7cc',staggerMax:85});
  enemy('dp_hollow_mariner','Hollow Mariner',830,45,40,24,12,['spark','earth'],[attack('Empty Oar',1.65),attack('No Shore',1.3,'allEnemies','water','magic')],{rig:'humanoid',color:'#8eacb3',staggerMax:90});
  enemy('dp_tide_image','Tide Image',790,36,46,22,13,['wind','fire'],[attack('Other Weather',1.5,'enemy','water','magic'),attack('False Horizon',1.2,'allEnemies','void','magic',{status:{slow:6}})],{resist:['water'],color:'#9abfc1',staggerMax:85});
  enemy('dp_compass_echo','Compass Echo',855,36,37,20,10,['earth','spark'],[attack('Return to Course',1.2,'enemy','void','magic')],{color:'#d3bd8a',staggerMax:65});
  enemy('dp_neris','Neris, the Unmoored Navigator',4300,47,47,25,13,['water','earth'],[attack('Crossing Cut',1.9),attack('No One Left Outside',1.45,'allEnemies','void','magic')],{
    boss:true,rig:'humanoid',color:'#82a6b5',guardedBy:'dp_compass_echo',staggerMax:155,staggerDuration:4,
    phases:[{at:.6,name:'Every road at once',weak:['wind','spark'],pattern:[attack('Fourfold Wake',1.6,'allEnemies','water','magic'),attack('Hold the Passage',2.05)]},{at:.28,name:'A navigator without a shore',weak:['void','earth'],pattern:[attack('I Can Still Reach Them',1.75,'allEnemies','wind','magic')],speedMult:1.1}]});
  enemy('dp_anchor_bud','Unmoored Anchor Bud',1000,37,39,22,10,['fire','wind'],[attack('Drag Below',1.25,'enemy','earth','magic',{status:{slow:5}})],{color:'#b5bfa6',staggerMax:70});
  enemy('dp_white_undertow','The White Undertow',6800,50,51,27,12,['fire','earth'],[attack('A Sea without Edges',1.55,'allEnemies','water','magic'),attack('Draw the Horizon',2.15,'enemy','void','magic')],{
    boss:true,rigId:'root_crown',size:1.3,color:'#bdd1bc',guardedBy:'dp_anchor_bud',staggerMax:165,staggerDuration:4.5,
    phases:[{at:.65,name:'Four currents separate',weak:['water','spark'],pattern:[attack('Unchosen Storm',1.75,'allEnemies','spark','magic'),attack('Close Every Shore',2.1)]},{at:.3,name:'One clear return',weak:['wind','void'],pattern:[attack('The Last Pull',1.95,'allEnemies','earth','magic'),attack('Pale Wake',1.8,'enemy','water','magic')],speedMult:1.1}]});

  for(const row of [
    {id:'dp_tide_chart',name:'Tide Chart Fragment',kind:'key',description:'A lost vessel crossed this coast without leaving its own year.'},
    {id:'dp_root_chart',name:'Root Chart Fragment',kind:'key',description:'A route passes through a season that never reached the forest.'},
    {id:'dp_mirror_chart',name:'Reflection Chart Fragment',kind:'key',description:'The true last course of Neris\'s vessel, recovered from a changed account.'},
    {id:'dp_storm_chart',name:'Storm Chart Fragment',kind:'key',description:'A safe line through the broken weather above the Fold.'},
    {id:'dp_passage_compass',name:'Returning Compass',kind:'key',description:'It points to a road back as well as a road onward.'},
    {id:'dp_moth_shell',name:'Skyless Shell',kind:'accessory',slot:'accessory',price:460,stats:{mag:8,def:4,speed:2},description:'A shed shell from a creature that found a place to live.'},
    {id:'dp_stage_pass',name:'Unwritten Pass',kind:'accessory',slot:'accessory',price:490,stats:{mag:10,maxHp:40,maxMp:8},description:'Its owner may leave before the final act.'},
    {id:'dp_navigator_clasp',name:'Navigator\'s Clasp',kind:'accessory',slot:'accessory',price:690,stats:{atk:9,mag:9,maxMp:15},description:'Neris removed the lock before he gave it away.'},
    {id:'dp_quietwake_coat',name:'Quietwake Coat',kind:'armor',slot:'armor',price:760,stats:{def:19,speed:3,maxHp:65,maxMp:12},description:'A warm coat made for a journey with a planned return.'}
  ])C.items[row.id]=row;
  // The tide dungeon teaches field work, room gates, water allocation, and Break.
  const tideSound=field('depth_bell_dock','dp_bell_sounding','The Submerged Sounding Bell','B','resonate',
    ['Soren sends one clear note through the water. A second bell answers below the dock.','Its rhythm marks a stair. Keva finds the first handhold and fixes a line to it.'],req('depth_tide_signal_started'));
  const tideEntryFight=battle('depth_bell_locks','dp_e_tide_locks','Salt in the Stairwell','E',['dp_brine_skitter','dp_lamp_wisp'],'dp_bell_locks_clear',req('depth_tide_signal_started'),60,35,5,
    {intro:['A light moves below the stair. It belongs to no lamp.','Keva: When one starts a long call, strike its weak point. Break the call before it gathers force.']});
  const tidePlate=read('depth_bell_locks','dp_bell_hull_plate','The Keel Plate','B',[
    'The plate names a vessel: Far Shore. Its launch date is missing. Its navigator is Neris.',
    'Keva finds the same plate on a sketch from two centuries before her birth. The hull has arrived here without passing through the years between.',
    'A fresh mark on the back points toward the three water locks. Someone aboard still knows this place.'
  ],req('dp_bell_locks_clear'),done('depth_tide_signal',[gold(60),item('tonic',2)]));
  mission({id:'depth_tide_signal',name:'The Bell beneath the Water',arc:'tide',order:1,zone:'depth_bell_dock',npc:'Keva the Diver',level:5,requires:{chapterAtLeast:2},
    summary:'Sound the submerged bell, enter the locks, and read the hull plate after clearing the stairwell.',
    intro:['I lowered a bell to measure the water. Something answered from a room that has been sealed for a hundred years.','Its last note was a call for help. Bring Soren to the sounding bell. I will hold the line while you find the stair.'],
    steps:[tideSound,tideEntryFight,{...tidePlate,flag:'depth_tide_signal_done'}],reward:'60 crowns; 2 Orchard Tonics; the first trace of Neris.',
    after:['The name Far Shore is real. The date is the part we still need to understand.','Meet me beside the three water locks.']});

  const tideSluice=mechanism('depth_bell_locks','dp_bell_sluice','The Three Water Locks','C',
    {kind:'sluice',initial:[0,0,0],target:[2,3,1],capacity:6,total:6,labels:['Dock','Ballast','Listening chamber']},
    'Use all six units. The dock needs two. Ballast needs one more than the dock. The listening chamber takes what remains.',req('depth_tide_level_started'));
  const tideBrace=field('depth_bell_ballast','dp_bell_brace','The Loose Ballast Support','D','brace',
    ['Brann sets a brace below the cracked support. The beam takes the load before the old bolt turns.','The dry return stair now links Ballast Walk to the dock. It can be used from either end.'],req('depth_tide_level_started','dp_bell_sluice'));
  const tideBallastFight=battle('depth_bell_ballast','dp_e_tide_ballast','The Linked Undertow','E',['dp_chain_eel','dp_brine_skitter'],'dp_bell_ballast_clear',req('dp_bell_brace'),80,40,5,
    {intro:['Two shapes circle the ballast chains. Their pull makes the whole room lean.'],victory:['The room settles. A dry stair opens toward the listening chamber.'],effects:done('depth_tide_level',[gold(70),item('ether',2)])});
  mission({id:'depth_tide_level',name:'Three Locks, One Passage',arc:'tide',order:2,zone:'depth_bell_locks',npc:'Keva at the Locks',level:5,requires:req('depth_tide_signal_done'),
    summary:'Balance the three locks. Brace Ballast Walk with Brann, then clear the linked undertow.',
    intro:['The stair is safe. The next room hangs between three bodies of water.','The marks state how much each lock can carry. Set all six units, then ask Brann to secure the ballast support. A second route back will keep us from being trapped.'],
    steps:[tideSluice,tideBrace,{...tideBallastFight,flag:'depth_tide_level_done'}],reward:'70 crowns; 2 Blue Nectar; a return shortcut.',
    after:['The support holds under the new water load. The return stair is clear.','I heard a person call from the listening chamber.']});

  const tideNet=field('depth_bell_ballast','dp_bell_net','The Living Mooring Net','C','cut',
    ['Mira cuts the dead upper lines. The living strands pull away from the passage instead of tightening around it.','A small brass token falls from the net. It bears the name Paz.'],req('depth_tide_passengers_started'));
  const tideCircuit=mechanism('depth_bell_choir','dp_bell_lamps','The Listening Lamp Circuit','B',
    {kind:'circuit',size:3,scramble:[0,4,8],goal:[0,0,0,0,0,0,0,0,0]},
    'Dark lamps carry the return signal. Touch a lamp to switch it and its north, south, east, and west neighbours. Turn all nine lamps off.',req('depth_tide_passengers_started','dp_bell_net'));
  const tidePaz=finishScene('depth_bell_choir','dp_paz_rescue','Paz the Lookout','F',[
    'I kept this lamp lit because Neris said every lost traveller deserved a road home. Then he opened every road at once.',
    'The sea came from places with no coast. It split our vessel and carried this room into the old chart house.',
    'I can walk now. Let me help, but give me a task that ends where I can still find my way back.'
  ],req('dp_bell_lamps'),'depth_tide_passengers',[gold(90),item('phoenix',2)],
    [choose('Send Paz to the dock with a safe route.','dp_paz_at_dock'),choose('Ask Paz to read the recovered charts.','dp_paz_chart_reader')],[flag('dp_paz_saved')],
    ['Paz can leave the chamber. The return lamp is now a guide, not a reason to remain trapped.']);
  mission({id:'depth_tide_passengers',name:'The Lookout Who Stayed',arc:'tide',order:3,zone:'depth_bell_ballast',npc:'Keva beside the Net',level:5,requires:req('depth_tide_level_done'),
    summary:'Cut the mooring net with Mira. Set the lamp circuit and release Paz in the listening chamber.',
    intro:['A person is holding the light ahead. The net has sealed his return path.','Mira can separate its dead ropes from its living strands. Then quiet the lamp circuit. We must make a safe exit before asking him to leave.'],
    steps:[tideNet,tideCircuit,tidePaz],reward:'90 crowns; 2 Dawn Salt; Paz rescued.',completionDialogue:'dp_paz_rescue_talk',
    after:['Paz has left the trapped watch. His account points to Neris and an unfinished passage through the Fold.']});
  battle('depth_bell_choir','dp_e_tide_side','The Forgotten Side Watch','D',['dp_lamp_wisp','dp_lamp_wisp'],'dp_bell_side_clear',req('depth_tide_passengers_started'),80,45,5,{loot:[{id:'ether',count:1}]});
  battle('depth_bell_ballast','dp_e_tide_salvage','The Unclaimed Beacon','F',['dp_chain_eel','dp_lamp_wisp'],'dp_bell_salvage_clear',req('dp_bell_brace'),65,40,5,
    {intro:['A spare beacon still calls through the lower ballast. A chain eel and a lost lamp circle its signal.'],victory:['The spare beacon falls quiet. Its dry rescue supplies can be carried to the listening chamber.'],loot:[{id:'ether',count:1},{id:'phoenix',count:1}]});

  const tideCourse=read('depth_bell_keel','dp_bell_last_course','Neris\'s Last Course','B',[
    'The final order reads: keep every passage open until no one is outside.',
    'Paz marked a second line below it: Captain, the water is coming through faster than the people.',
    'The order was never changed. Four anchors are still pulling the same vessel into four different ages.'
  ],req('depth_tide_keel_started'));
  const tideGuardian=battle('depth_bell_keel','dp_e_tide_guardian','The Hullbound Mariner','E',['dp_keel_guardian','dp_hull_pin','dp_hull_pin'],'dp_bell_guardian_clear',req('dp_bell_last_course'),230,100,5,
    {intro:['Two living hull pins hold the mariner\'s armour closed. Remove both pins to expose it.','Paz: It follows the last course. It cannot see that the vessel has already broken.'],victory:['The pins fall away. The mariner releases the keel instead of dragging it deeper.'],loot:[{id:'memory_ore',count:2}]});
  const tideEnd=finishScene('depth_bell_keel','dp_bell_anchor','Keva at the Tide Anchor','C',[
    'The anchor holds one chart fragment. When Keva lifts it, the room stops pulling at the coast.',
    'This part of the vessel can remain here. It no longer needs to take the harbour with it.',
    'We can turn its spare lamps toward other lost rooms, or make the quiet hull a shelter for people brought in by the tide.'
  ],req('dp_bell_guardian_clear'),'depth_tide_keel',[gold(180),item('dp_tide_chart'),item('elixir')],
    [choose('Light a route for other search crews.','dp_tide_lanterns'),choose('Keep the quiet hull as a refuge.','dp_tide_refuge')],[flag('depth_tide_complete')],
    ['The chart house is safe. A marked route leads back to the dock.','The other chart fragments lie in the Spiral Nursery, the Mirror Theatre, and the Stormfound Ark.']);
  mission({id:'depth_tide_keel',name:'A Keel without a Coast',arc:'tide',order:4,zone:'depth_bell_keel',npc:'Paz\'s Course Record',level:5,requires:req('depth_tide_passengers_done'),
    summary:'Read Neris\'s last course. Release the hull pins and guardian, then choose a use for the quiet wreck.',
    intro:['Paz copied the last order before the water reached his desk. The copy still points toward an open horizon.','Read it beside the keel. Then free the guardian from the course it cannot complete. The tide anchor holds our first real chart.'],
    steps:[tideCourse,tideGuardian,tideEnd],reward:'180 crowns; Tide Chart Fragment; 1 Last Fruit; the Sunken Chart House complete.',completionDialogue:'dp_bell_anchor_talk',
    after:['The tide anchor has released this coast. Its chart can guide us toward the Far Shore.']});
  // The nursery loops back through earlier rooms after its first gates open.
  const rootGate=field('depth_seed_gate','dp_seed_gate','The Closed Leaf Gate','B','grow',
    ['Ilex touches the dry seam. New roots form a path without forcing the old gate apart.','Beyond it, leaves from four different seasons turn in the same wind.'],req('depth_roots_arrival_started'));
  const rootRings=read('depth_seed_canopy','dp_seed_rings','The Impossible Growth Rings','B',[
    'A cut branch has a spring ring, a winter ring, then another spring ring with no summer between them.',
    'Umo finds a navigator\'s mark inside the youngest layer. Neris used the nursery to hold a living route through seasons that did not happen here.',
    'The route still feeds. Each turn of its roots takes water and warmth from the real forest.'
  ],req('depth_roots_arrival_started','dp_seed_gate'));
  const rootArrivalFight=battle('depth_seed_canopy','dp_e_roots_canopy','The Untimely Feeding','E',['dp_seed_crawler','dp_pollen_wisp'],'dp_seed_canopy_clear',req('dp_seed_rings'),80,45,7,
    {victory:['The creatures retreat from the young roots. Umo can reach the water marks below the canopy.'],effects:done('depth_roots_arrival',[gold(80),item('panacea',2)])});
  mission({id:'depth_roots_arrival',name:'A Garden without a Sky',arc:'roots',order:1,zone:'depth_seed_gate',npc:'Umo the Nursery Keeper',level:7,requires:{chapterAtLeast:3},
    summary:'Open the leaf gate with Ilex. Read the growth rings and protect the young roots in the turning canopy.',
    intro:['A flower opened yesterday with frost on one side and summer pollen on the other. Neither season belongs here yet.','I have kept the gate closed so the young trees outside are safe. Ask Ilex to grow a careful path through it. We need to find what the nursery is feeding.'],
    steps:[rootGate,rootRings,{...rootArrivalFight,flag:'depth_roots_arrival_done'}],reward:'80 crowns; 2 Clear Dew; the nursery route open.',
    after:['The growth rings show where Neris tied his route to the forest. The water channels can still be separated from it.']});

  const rootCut=field('depth_seed_channels','dp_seed_bank_cut','The Dead Bank Vine','D','cut',
    ['Mira removes the dead vine above the bank. Ilex holds the living roots out of the blade\'s path.','Water enters the side channel. A dry route back to the leaf gate appears beside it.'],req('depth_roots_water_started'));
  const rootSluice=mechanism('depth_seed_channels','dp_seed_water','The Nursery Water Share','C',
    {kind:'sluice',initial:[0,0,0],target:[1,4,1],capacity:6,total:6,labels:['Outer roots','Nursery','Return bank']},
    'Six units can pass safely. Give one to the outer roots and the same amount to the return bank. The nursery takes the remaining four.',req('depth_roots_water_started'));
  const rootWaterFight=battle('depth_seed_channels','dp_e_roots_channels','The Thirst below the Bank','E',['dp_thirst_hart','dp_seed_crawler'],'dp_seed_channels_clear',req('depth_roots_water_started'),90,50,7,
    {intro:['A pale hart drinks from a channel that never empties. Its thirst belongs to more than one possible summer.'],victory:['The hart withdraws to a quiet pool. The measured channels can now carry their intended flow.']});
  const rootWaterEnd=finishScene('depth_seed_channels','dp_seed_water_read','Umo at the Water Marks','F',[
    'The outer roots hold. The nursery receives what it needs. The return channel carries water back to the forest.',
    'We cannot feed every possible season from one real river. We can keep a small living place for what has already arrived.',
    'The first spare bed can shelter fragile arrivals or teach young keepers how to tend unfamiliar plants.'
  ],req('dp_seed_bank_cut','dp_seed_water','dp_seed_channels_clear'),'depth_roots_water',[gold(100),item('ether',2)],
    [choose('Keep a quiet shelter bed.','dp_roots_shelter_bed'),choose('Open a teaching bed beside the path.','dp_roots_teaching_bed')]);
  mission({id:'depth_roots_water',name:'Enough Water for a Living Place',arc:'roots',order:2,zone:'depth_seed_canopy',npc:'Umo at the Lower Path',level:7,requires:req('depth_roots_arrival_done'),
    summary:'Cut the dead return vine, balance the root channels, and move the thirsty creatures from the water marks.',
    intro:['The deep route draws from every open channel. Closing all of them would save the forest and kill everything inside.','Mira can free the return bank. Set a measured share at the water control and clear the creatures from its marks. We can choose a limit without abandoning the nursery.'],
    steps:[rootCut,rootSluice,rootWaterFight,rootWaterEnd],reward:'100 crowns; 2 Blue Nectar; a measured nursery supply and a shortcut.',completionDialogue:'dp_seed_water_read_talk',
    after:['The forest can carry this small nursery. The return channel lets us check what the nursery gives back.']});

  const rootNest=field('depth_seed_canopy','dp_seed_nest_path','The High Nest Branch','C','grow',
    ['Ilex grows a low branch beneath the empty nest. Its leaves form a line toward the nursery lamps.','A pale hatchling follows the light for a few steps, then waits. The next part of its route must be ready.'],req('depth_roots_hatchling_started'));
  const rootCircuit=mechanism('depth_seed_nursery','dp_seed_lamps','The Nursery Night Lamps','B',
    {kind:'circuit',size:3,scramble:[1,3,5,7],goal:[0,0,0,0,0,0,0,0,0]},
    'The hatchling follows the dark gaps between the lamps. Each touch switches one lamp and its four edge neighbours. Make the whole grid dark.',req('depth_roots_hatchling_started','dp_seed_nest_path'));
  const rootNestFight=battle('depth_seed_nursery','dp_e_roots_nursery','The Hungry False Spring','E',['dp_pollen_wisp','dp_pollen_wisp'],'dp_seed_nursery_clear',req('dp_seed_lamps'),100,55,7,
    {intro:['Pollen wisps gather where the night lamps were. Their light would lead the hatchling back toward the deep route.'],victory:['The false light fades. The dark branch now leads all the way to a safe bed.']});
  const rootHatchEnd=finishScene('depth_seed_nursery','dp_seed_hatchling','Melo the Hatchling Keeper','F',[
    'The sky moth reaches the bed. It leaves its first shell on a leaf and opens two clear wings.',
    'It came from a season that no one here remembers. That does not make its hunger or its fear less real.',
    'We can keep a sheltered bed for it, or open the river side once it is strong enough to leave.'
  ],req('dp_seed_nursery_clear'),'depth_roots_hatchling',[gold(110),item('dp_moth_shell')],
    [choose('Keep a sheltered bed and watch its health.','dp_hatchling_shelter'),choose('Let it leave by the river when it is ready.','dp_hatchling_wild')],[flag('dp_hatchling_saved')],
    ['The first shell remains as proof that the hatchling has grown. It no longer needs the deep route to keep it alive.']);
  mission({id:'depth_roots_hatchling',name:'The Smallest Passenger',arc:'roots',order:3,zone:'depth_seed_nursery',npc:'Melo at the Nest Door',level:7,requires:req('depth_roots_water_done'),
    summary:'Grow a nest path in the earlier canopy room. Set the night lamps, clear the false spring, and choose a home for the hatchling.',
    intro:['A sky moth hatched in a room with no sky. It follows any bright thing, including the route that is draining the forest.','Return to the turning canopy. Ask Ilex to grow the high nest branch, then make a clear dark path through the nursery lamps. I will wait at the safe bed.'],
    steps:[rootNest,rootCircuit,rootNestFight,rootHatchEnd],reward:'110 crowns; Skyless Shell; the hatchling safe.',completionDialogue:'dp_seed_hatchling_talk',
    after:['The moth has a place to rest and a way to leave. It does not need every possible season to remain open.']});
  battle('depth_seed_canopy','dp_e_roots_side','The Unwatered Crown','D',['dp_thirst_hart','dp_pollen_wisp'],'dp_seed_side_clear',req('depth_roots_hatchling_started'),90,55,7,{loot:[{id:'panacea',count:2}]});

  const rootAnchorLog=read('depth_seed_heart','dp_seed_anchor_log','The Root Anchor Memory','B',[
    'Neris planted the route here because living roots could adapt when maps could not. He meant to give every stranded creature a place to grow.',
    'The root record shows each new passage drawing on the same river. The last entries hold no count of how much the forest could bear.',
    'The deep flower formed where all those needs met. It is hungry because the route has given it more seasons than one body can hold.'
  ],req('depth_roots_anchor_started'));
  const rootGraft=field('depth_seed_heart','dp_seed_graft','The Returning Root Graft','C','grow',
    ['Ilex grows a return root around the open anchor. It joins the forest without passing through the deep flower.','The nursery can now live if the flower releases the stolen seasons.'],req('dp_seed_anchor_log'));
  const rootGuardian=battle('depth_seed_heart','dp_e_roots_guardian','The Season Eater','E',['dp_deep_flower','dp_root_knot','dp_root_knot'],'dp_seed_guardian_clear',req('dp_seed_graft'),260,115,7,
    {intro:['Two season knots hold the flower closed. Break them before you strike its heart.','Umo: We have given the nursery a return root. It is safe to stop this hunger now.'],victory:['The flower opens once, without drawing another season into itself. Then its roots rest.'],loot:[{id:'living_fiber',count:2}]});
  const rootAnchorEnd=finishScene('depth_seed_heart','dp_seed_anchor','Umo beside the Resting Flower','F',[
    'The second chart fragment unfolds along a dry root. The forest returns to one season at a time.',
    'A living root still follows the vessel toward Ash Tomorrow. It can carry a small graft there without feeding the old hunger.',
    'We can let that root support a future path, or keep its strength here for the next nursery.'
  ],req('dp_seed_guardian_clear'),'depth_roots_anchor',[gold(210),item('dp_root_chart'),item('elixir')],
    [choose('Grow a support along the future wreck.','dp_roots_bridge'),choose('Keep a new garden here in the first forest.','dp_roots_garden')],[flag('depth_roots_complete')],
    ['The flower sleeps. The nursery has a measured supply, a return root, and keepers who can watch both.']);
  mission({id:'depth_roots_anchor',name:'A Season That Can End',arc:'roots',order:4,zone:'depth_seed_heart',npc:'Umo at the Deep Flower',level:7,requires:req('depth_roots_hatchling_done'),
    summary:'Read the root memory, grow a return graft, and release the Season Eater before taking the second chart.',
    intro:['The hatchling is safe. The nursery can survive without the old route. That gives us a way to face the flower without destroying what it holds.','Read the anchor memory. Ask Ilex to form a return graft, then release the season knots around the heart.'],
    steps:[rootAnchorLog,rootGraft,rootGuardian,rootAnchorEnd],reward:'210 crowns; Root Chart Fragment; 1 Last Fruit; the Spiral Nursery complete.',completionDialogue:'dp_seed_anchor_talk',
    after:['The root chart is yours. Leave the flower resting. Its next season can begin in its own time.']});
  // The theatre uses paired evidence, a return investigation, and two light routes.
  const glassMarks=field('depth_glass_gallery','dp_glass_role_marks','The Hidden Role Marks','D','reveal',
    ['Nyx moves through the steps marked on the floor. The painted account stops covering the first one.','Two records appear. One describes a storm. The other records the order that held the passage open.'],req('depth_mirrors_listen_started'));
  const glassPublic=read('depth_glass_gallery','dp_glass_public_account','The Printed Account','B',[
    'The official play says an unexpected storm broke the Far Shore. It gives the crew no choice before the wreck.',
    'Every copy uses the same phrase: no warning could have reached the bridge. Someone printed the answer before the witnesses spoke.'
  ],req('dp_glass_role_marks'));
  const glassMargin=read('depth_glass_gallery','dp_glass_margin_account','The Margin Account','C',[
    'A stage hand copied a passenger log into the margin. It lists three warnings, each received at the bridge.',
    'The last reply is in Neris\'s hand: keep the passage open. There are still people beyond the light.',
    'The warnings did arrive. The crew did not fail to send them.'
  ],req('dp_glass_role_marks'));
  const glassGalleryFight=battle('depth_glass_gallery','dp_e_mirror_gallery','The Fixed Account','E',['dp_stage_mask','dp_paper_dancer'],'dp_glass_gallery_clear',req('dp_glass_public_account','dp_glass_margin_account'),100,55,9,
    {intro:['The masks repeat the printed account. A paper understudy tries to cover the margin before Setha can copy it.'],victory:['The margin remains open. Setha can now compare an order with the result it caused.'],effects:done('depth_mirrors_listen',[gold(100),item('ether',2)])});
  mission({id:'depth_mirrors_listen',name:'Two Accounts of One Night',arc:'mirrors',order:1,zone:'depth_glass_foyer',npc:'Setha the Theatre Keeper',level:9,requires:{chapterAtLeast:4},
    summary:'Reveal the role marks with Nyx, read both accounts in the gallery, and keep the hidden record from being erased.',
    intro:['The theatre stages the same wreck every night. Last night an actor asked to leave. The stage put her back in her first position.','The records in the gallery do not agree. Nyx can read the steps beneath the paint. Find both accounts before this place decides which one we are allowed to keep.'],
    steps:[glassMarks,glassPublic,glassMargin,{...glassGalleryFight,flag:'depth_mirrors_listen_done'}],reward:'100 crowns; 2 Blue Nectar; the uncensored margin account.',
    after:['We have a received warning and a written reply. Now we need the light that reaches the unused part of the stage.']});

  const glassCurtain=field('depth_glass_gallery','dp_glass_curtain','The Fallen Safety Curtain','F','cut',
    ['Mira cuts the ruined counterweight ropes. The curtain lowers into its own recess without taking the gallery floor with it.','A narrow passage leads to four turning prisms.'],req('depth_mirrors_light_started'));
  const glassPrism=mechanism('depth_glass_prisms','dp_glass_prism','The Four Arrival Mirrors','B',
    {kind:'mirror',initial:[0,0,0,0],target:[1,0,3,2],labels:['First arrival','Lookout','Last warning','Return road']},
    'The first arrival faces sunrise (East). The lookout faces the pole star (North). The last warning faces sunset (West). The return road faces the warm sea (South).',req('depth_mirrors_light_started','dp_glass_curtain'));
  const glassWingsFight=battle('depth_glass_wings','dp_e_mirror_wings','The Unused Exit','E',['dp_lens_drone','dp_stage_mask'],'dp_glass_wings_clear',req('dp_glass_prism'),115,60,9,
    {intro:['A backlight drone holds the exit in its beam. The mask beside it repeats that every actor must stay for the last scene.'],victory:['The backlight turns away. A service note is visible beside the exit.']});
  const glassService=read('depth_glass_wings','dp_glass_service_note','The Stage Hand\'s Service Note','C',[
    'The service note names a missing passenger: Lio. The theatre borrowed her voice for every warning in the play.',
    'Her own part has no exit. The unused wings have a second mirror set that can give her voice a route out.',
    'Setha marks the service door. A person can stop performing and still have something true to say.'
  ],req('dp_glass_wings_clear'),done('depth_mirrors_light',[gold(110),item('panacea',2)]));
  mission({id:'depth_mirrors_light',name:'An Exit from the Script',arc:'mirrors',order:2,zone:'depth_glass_gallery',npc:'Setha beside the Accounts',level:9,requires:req('depth_mirrors_listen_done'),
    summary:'Cut the fallen curtain, align the four arrival mirrors, and read the service note beyond the guarded exit.',
    intro:['The official scene ends before the passengers could answer Neris. The unused wings may hold the missing part.','Mira can lower the broken curtain. Follow the mirror clue through the prism walk. Keep the exit open once the light reaches it.'],
    steps:[glassCurtain,glassPrism,glassWingsFight,{...glassService,flag:'depth_mirrors_light_done'}],reward:'110 crowns; 2 Clear Dew; Lio\'s missing part found.',
    after:['Lio\'s voice was kept in the prism walk. The second set of mirrors can make a return route for it.']});

  const glassVoice=field('depth_glass_prisms','dp_glass_voice','The Unassigned Reflection','C','reveal',
    ['Nyx steps out of the marked part. A reflection remains in the light and speaks with its own voice.','Lio: I sent the last warning. I was not the storm. I want to stop saying the line that makes me one.'],req('depth_mirrors_passenger_started'));
  const glassVoiceFight=battle('depth_glass_prisms','dp_e_mirror_voice','The Borrowed Voice','E',['dp_paper_dancer','dp_lens_drone'],'dp_glass_voice_clear',req('dp_glass_voice'),120,65,9,
    {intro:['The understudy tries to draw Lio back into the fixed scene. Its lamp gives her no place to stand outside it.'],victory:['Lio leaves the assigned position. The backlight can now guide her toward the unused wings.']});
  const glassBacklight=mechanism('depth_glass_wings','dp_glass_backlight','The Four Return Mirrors','B',
    {kind:'mirror',initial:[0,0,0,0],target:[2,1,0,3],labels:['Voice','Footstep','Witness','Open door']},
    'Send the voice South, the footstep East, the witness North, and the open door West. The stage hand wrote the four directions in that order.',req('depth_mirrors_passenger_started','dp_glass_voice_clear'));
  const glassLio=finishScene('depth_glass_wings','dp_lio_rescue','Lio the Uncast Witness','F',[
    'Lio follows the return light. For the first time, she finishes a sentence that is not in the printed play.',
    'I warned Neris that the passage was taking the hull apart. He heard me. He said closing it would leave someone outside.',
    'Keep the warning. Give me a choice about my name. I want people to know what happened, but I do not owe the theatre another performance.'
  ],req('dp_glass_backlight'),'depth_mirrors_passenger',[gold(130),item('phoenix',2)],
    [choose('Keep Lio\'s name with her testimony.','dp_lio_named'),choose('Preserve the testimony without her name.','dp_lio_private')],[flag('dp_lio_saved')],
    ['Lio has a place outside the play. The record preserves her warning and the choice she made about her name.']);
  mission({id:'depth_mirrors_passenger',name:'A Voice beyond Its Part',arc:'mirrors',order:3,zone:'depth_glass_wings',npc:'Setha at the Service Door',level:9,requires:req('depth_mirrors_light_done'),
    summary:'Return to the prism walk. Reveal Lio, free her voice, then align the return mirrors and hear her testimony.',
    intro:['We found a service route, but it is useless to a voice still held in a reflection.','Return to the prism walk with Nyx. Let Lio stand outside her assigned part. Then set the return mirrors here. The route should bring a person out, not pull another person in.'],
    steps:[glassVoice,glassVoiceFight,glassBacklight,glassLio],reward:'130 crowns; 2 Dawn Salt; Lio free and her testimony preserved.',completionDialogue:'dp_lio_rescue_talk',
    after:['The return light now opens a shortcut to the gallery. Lio is safe to leave the stage behind.']});
  battle('depth_glass_prisms','dp_e_mirror_side','The Spare Performance','D',['dp_stage_mask','dp_paper_dancer'],'dp_glass_side_clear',req('depth_mirrors_light_started'),110,65,9,{loot:[{id:'ether',count:2}]});

  const glassScript=read('depth_glass_stage','dp_glass_last_script','The Unrevised Final Page','B',[
    'The last page was never performed. It gives Neris a chance to answer the people he kept on the vessel.',
    'Below the empty reply, the writer left an instruction: a captain may change the course. A passenger may leave.',
    'The guardian on the stage has taken every role for itself. It cannot finish the play because it cannot allow a different answer.'
  ],req('depth_mirrors_anchor_started'));
  const glassNote=field('depth_glass_stage','dp_glass_open_note','The Note without a Cue','C','resonate',
    ['Soren rings a note outside the marked rhythm. The stage leaves a clear interval after it.','The actors no longer need to fill every silence. The guardian turns toward the sound.'],req('dp_glass_last_script'));
  const glassGuardian=battle('depth_glass_stage','dp_e_mirror_guardian','The Cast of One','E',['dp_cast_guardian','dp_stage_lantern','dp_stage_lantern'],'dp_glass_guardian_clear',req('dp_glass_open_note'),300,135,9,
    {intro:['Two binding lanterns hold the Cast inside its fixed roles. Extinguish both before you attack the centre.','Setha: The warning changed nothing because the answer was already written. Give this scene a real ending.'],victory:['The lanterns dim. The stage remains open and empty after the last movement.'],loot:[{id:'prism_dust',count:2}]});
  const glassEnd=finishScene('depth_glass_stage','dp_glass_anchor','Setha at the Open Stage','F',[
    'The reflection anchor releases its chart. The play can now end after one performance.',
    'Setha keeps both accounts. The record shows that a warning reached Neris and that he chose to keep the passage open.',
    'We can make this a public place to examine difficult records, or a small archive where each witness can choose when to speak.'
  ],req('dp_glass_guardian_clear'),'depth_mirrors_anchor',[gold(240),item('dp_mirror_chart'),item('dp_stage_pass')],
    [choose('Open a public room for the two accounts.','dp_glass_public'),choose('Keep a quiet archive with witness control.','dp_glass_private')],[flag('depth_mirrors_complete')],
    ['The theatre has an exit. Its record now keeps the warning, the received reply, and the witness\'s own choice.']);
  mission({id:'depth_mirrors_anchor',name:'The Last Unwritten Answer',arc:'mirrors',order:4,zone:'depth_glass_stage',npc:'Setha at the Last Page',level:9,requires:req('depth_mirrors_passenger_done'),
    summary:'Read the final page, ring a note outside the script, and release the Cast before choosing how the accounts will be kept.',
    intro:['The last page leaves Neris a space to answer. The stage has filled it with the same guardian each night.','Read the page. Ask Soren to sound a note outside its cue. Then remove the binding lanterns so this performance can end.'],
    steps:[glassScript,glassNote,glassGuardian,glassEnd],reward:'240 crowns; Reflection Chart Fragment; Unwritten Pass; the Mirror Theatre complete.',completionDialogue:'dp_glass_anchor_talk',
    after:['The chart records a route through the Fold. It also records the people who asked Neris to change it.']});
  // The ark opens a safe return first, then moves two passengers out of danger.
  const ashBeacon=field('depth_ash_conduit','dp_ash_beacon','The Silent Hull Relay','B','power',
    ['Vale charges the return side of the relay before he touches the old transmitter. A reply light stays on.','Two voices answer from the sealed berths. They can hear the camp now.'],req('depth_storm_signal_started'));
  const ashConduitFight=battle('depth_ash_conduit','dp_e_storm_conduit','The Live Cable Watch','E',['dp_wire_hound','dp_arc_ray'],'dp_ash_conduit_clear',req('dp_ash_beacon'),110,60,9,
    {intro:['A cable hound follows the new current. A storm ray coils around the only safe return line.'],victory:['The return line stays lit. Odo hears both passengers give their names: Yali and Anik.'],effects:done('depth_storm_signal',[gold(110),item('ether',2)])});
  mission({id:'depth_storm_signal',name:'Two Voices in the Hull',arc:'storm',order:1,zone:'depth_ash_camp',npc:'Odo the Hull Engineer',level:9,requires:{chapterAtLeast:4},
    summary:'Power the return relay with Vale, then protect the line until the two trapped passengers can answer.',
    intro:['This deck arrived above the dust with no vessel below it. The sealed berths still draw power.','A rescue signal that only speaks will not tell us who is alive. Ask Vale to power the return relay in the conduit. We will listen before we send anyone inside.'],
    steps:[ashBeacon,{...ashConduitFight,flag:'depth_storm_signal_done'}],reward:'110 crowns; 2 Blue Nectar; contact with Yali and Anik.',
    after:['Two people answered. They have water and air for now. Our next task is a route that can carry them back.']});

  const ashGrid=mechanism('depth_ash_conduit','dp_ash_grid','The Isolated Storm Grid','C',
    {kind:'circuit',size:3,scramble:[0,2,4,7],goal:[0,0,0,0,0,0,0,0,0]},
    'A dark square is isolated from the storm furnace. Touch a square to switch it and its four edge neighbours. Make all nine squares dark before opening the door.',req('depth_storm_cable_started'));
  const ashBrace=field('depth_ash_skywalk','dp_ash_brace','The Broken Lift Support','D','brace',
    ['Brann sets the support against the intact lower beam. The lift takes the weight without shifting the broken skywalk.','A return lift opens between the skywalk and the hull camp. It stays open from both ends.'],req('depth_storm_cable_started','dp_ash_grid'));
  const ashSkyFight=battle('depth_ash_skywalk','dp_e_storm_skywalk','The Weight on the Span','E',['dp_ash_scraper','dp_arc_ray'],'dp_ash_skywalk_clear',req('dp_ash_brace'),125,65,9,
    {intro:['A hull scraper pulls at the last loose cable. The storm ray above it turns each pull into a live arc.'],victory:['The last cable is free. Odo can test the span under a steady load.']});
  const ashLoadRead=read('depth_ash_skywalk','dp_ash_load_test','Odo\'s Load Marks','B',[
    'The support holds a full rescue load. Odo marks the limit on both ends of the lift.',
    'The bridge log calls its power source a weather furnace. It has drawn storms from other possible skies to keep the upper deck aloft.',
    'The load can be carried by the repaired hull. The furnace can be stopped once the passengers are out.'
  ],req('dp_ash_skywalk_clear'),done('depth_storm_cable',[gold(120),item('phoenix',2)]));
  mission({id:'depth_storm_cable',name:'A Road That Can Carry Us',arc:'storm',order:2,zone:'depth_ash_conduit',npc:'Odo at the Storm Door',level:9,requires:req('depth_storm_signal_done'),
    summary:'Isolate the storm grid, brace the lift support with Brann, and test the span after clearing its loose cable.',
    intro:['The berths are beyond a span that was made to carry air, not people. We can repair it without asking the furnace for another storm.','Isolate its grid. Ask Brann to brace the old lift support, then clear the weight from the loose cable. The return route must carry the rescue, not just the rescuers.'],
    steps:[ashGrid,ashBrace,ashSkyFight,{...ashLoadRead,flag:'depth_storm_cable_done'}],reward:'120 crowns; 2 Dawn Salt; the load-tested return lift.',
    after:['The lift will carry both passengers. Follow the marked span into the sealed berths.']});

  const ashDoor=field('depth_ash_berths','dp_ash_bunk_lines','The Sealed Berth Lashings','B','cut',
    ['Mira cuts the lashings that hold the outer storm panels. The inner doors remain supported by their own frames.','Fresh camp air reaches the berths. Anik calls from behind the last warm partition.'],req('depth_storm_passengers_started'));
  const ashBerthFight=battle('depth_ash_berths','dp_e_storm_berths','The Last Door Watch','E',['dp_wire_hound','dp_ash_scraper'],'dp_ash_berths_clear',req('dp_ash_bunk_lines'),130,70,9,
    {intro:['The old watch has read the open door as a loss of pressure. It closes around the passengers\' way out.'],victory:['The outer doors stay open. The coolant control can now be set for a safe exit.']});
  const ashCoolant=mechanism('depth_ash_berths','dp_ash_coolant','The Berth Coolant Share','C',
    {kind:'sluice',initial:[0,0,0],target:[3,1,2],capacity:6,total:6,labels:['Hot partition','Empty berth','Exit pipe']},
    'Use six units. Send three to the hot partition, one to the empty berth, and two through the exit pipe. These values keep the doors cool while both passengers leave.',req('dp_ash_berths_clear'));
  const ashYali=read('depth_ash_berths','dp_yali_ready','Yali the Passenger','D',[
    'I can carry my bag. Anik needs time near the cool pipe before she can walk the span.',
    'Neris said the vessel would be a road for people like us. When it broke, he kept opening roads. I needed him to notice the room we were already in.',
    'The return light is steady. Tell Odo I will follow the marked lift once Anik is ready.'
  ],req('dp_ash_coolant'));
  const ashAnik=read('depth_ash_berths','dp_anik_ready','Anik the Passenger','F',[
    'The pipe is cool enough to touch. I can stand now. Let me take the slow side of the span.',
    'I kept the last cup of water because I thought leaving it would mean we were never coming back. I can see another cup at the camp light.',
    'I am ready. Meet us at the hull camp. We will use the lift you tested.'
  ],req('dp_ash_coolant','dp_yali_ready'));
  const ashRescueEnd=finishScene('depth_ash_camp','dp_ash_passengers_safe','Odo with Yali and Anik','F',[
    'Both passengers reach the camp. Odo sets down the rescue log and offers them a choice before he writes the next page.',
    'The old berths can become safe homes after the furnace stops. The camp also has room for people who want to stay near open ground.',
    'Yali and Anik choose together. The work crew will prepare the place they select.'
  ],req('dp_yali_ready','dp_anik_ready'),'depth_storm_passengers',[gold(160),item('elixir')],
    [choose('Prepare a shared home beside the camp.','dp_passengers_camp'),choose('Repair two rooms in the quiet berths.','dp_passengers_berths')],[flag('dp_ash_passengers_saved')],
    ['Yali and Anik have water, a tested route, and a place they helped choose. They no longer depend on the weather furnace.']);
  mission({id:'depth_storm_passengers',name:'The Slow Side of the Span',arc:'storm',order:3,zone:'depth_ash_berths',npc:'Odo at the Berth Door',level:9,requires:req('depth_storm_cable_done'),
    summary:'Open the berths, clear the watch, and share the coolant. Speak to both passengers, then meet them at the hull camp.',
    intro:['The lift is ready. The passengers can walk if we first lower the heat around their doors.','Ask Mira to remove the outer lashings. Clear the old watch, then set the coolant to its marked share. Speak to Yali and Anik before you return to the camp.'],
    steps:[ashDoor,ashBerthFight,ashCoolant,ashYali,ashAnik,ashRescueEnd],reward:'160 crowns; 1 Last Fruit; Yali and Anik safely evacuated.',completionDialogue:'dp_ash_passengers_safe_talk',
    after:['The rescue is complete. Their rooms will be prepared when the furnace can no longer call another storm into the hull.']});
  battle('depth_ash_skywalk','dp_e_storm_side','The Stray Forecast','F',['dp_arc_ray','dp_arc_ray'],'dp_ash_side_clear',req('depth_storm_cable_started'),120,65,9,{loot:[{id:'panacea',count:2}]});

  const ashForecast=read('depth_ash_bridge','dp_ash_forecast','The Furnace Forecast','B',[
    'The furnace does not predict the weather. It selects a storm from a sky that might have existed and brings that storm into this one.',
    'Neris used its output to keep a passage above the broken coast. The deck survived, but the same heat sealed the people inside it.',
    'Vale finds a small local supply below the storm intake. It can keep the safety lamps lit while the main furnace is released.'
  ],req('depth_storm_anchor_started'));
  const ashLocalPower=field('depth_ash_bridge','dp_ash_local_supply','The Local Safety Supply','C','power',
    ['Vale moves the safety lamps onto the local supply. Every return lamp stays lit when the first storm contact opens.','Odo confirms the load at the camp. The people and the repaired hull can live without the borrowed skies.'],req('dp_ash_forecast'));
  const ashGuardian=battle('depth_ash_bridge','dp_e_storm_guardian','The Weather Furnace','E',['dp_weather_guardian','dp_storm_cell','dp_storm_cell'],'dp_ash_guardian_clear',req('dp_ash_local_supply'),310,140,9,
    {intro:['Two storm holding cells keep the furnace under pressure. Drain both before striking the furnace core.','Odo: The lamps are on local power. Do not let the furnace call another sky down on us.'],victory:['The holding cells empty. The deck rests on its repaired supports under one real sky.'],loot:[{id:'storm_coil',count:2}]});
  const ashEnd=finishScene('depth_ash_bridge','dp_ash_anchor','Odo at the Clear Window','F',[
    'The storm chart comes free. A straight line through calm air points toward the Fold.',
    'The local supply has a small margin. It cannot lift a whole vessel, but it can keep one useful service running.',
    'We can warm a sheltered food bed now, or hold the charge for the next emergency. Either choice stays within what the repaired hull can carry.'
  ],req('dp_ash_guardian_clear'),'depth_storm_anchor',[gold(250),item('dp_storm_chart'),item('elixir')],
    [choose('Warm a food bed. Receive 4 Orchard Tonics.','dp_storm_garden',undefined,[item('tonic',4)]),choose('Store emergency power. Receive 3 Blue Nectar.','dp_storm_reserve',undefined,[item('ether',3)])],[flag('depth_storm_complete')],
    ['The storm intake is closed. The local supply serves a measured need. The hull camp can see the real weather again.']);
  mission({id:'depth_storm_anchor',name:'One Real Sky',arc:'storm',order:4,zone:'depth_ash_bridge',npc:'Odo below the Forecast',level:9,requires:req('depth_storm_passengers_done'),
    summary:'Read the forecast, power the safety lamps locally, and release the furnace before choosing a use for the spare supply.',
    intro:['Yali and Anik are safe. The return lift holds. There is no rescue left that needs another borrowed storm.','Read the forecast. Ask Vale to keep the lamps on local power, then release the storm cells around the furnace. We can finally let this deck settle.'],
    steps:[ashForecast,ashLocalPower,ashGuardian,ashEnd],reward:'250 crowns; Storm Chart Fragment; 1 Last Fruit; food or emergency supplies; the Stormfound Ark complete.',completionDialogue:'dp_ash_anchor_talk',
    after:['The fourth chart has a calm route through the Fold. Neris cannot claim that the people here still need the open storm intake.']});
  // The last dungeon branches into two rescue routes before the confrontation.
  const foldEcho=field('depth_fold_echoes','dp_fold_echo_names','The Unread Passenger Names','C','reveal',
    ['Nyx separates names from the reflections that repeat them. The same three people have been counted as hundreds of possible arrivals.','A true name stays on the glass when its other images fade. There are people to rescue here. Their number can be known.'],req('depth_hollow_arrival_started'));
  const foldBerthRecord=read('depth_fold_echoes','dp_fold_berth_record','The Repeating Passenger List','B',[
    'Neris counted each possible road as a person waiting at its end. Some roads lead to the same person. Some end at a place no longer there.',
    'The people in these berths need one safe destination each. Opening another hundred roads has not given them one.',
    'Keva marks the names Nyx recovered. The rescue list is now small enough to check.'
  ],req('dp_fold_echo_names'));
  const foldGardenRecord=read('depth_fold_garden','dp_fold_garden_record','The Garden without a Return','B',[
    'Each plant points toward a possible shore. Its roots have no path back to the soil that feeds it.',
    'The four repaired regions now have return lines. Their charts agree on a single small place where this vessel can rest.',
    'A route can have an end, a return, and a known load. None of those limits make the people on it less welcome.'
  ],req('depth_hollow_arrival_started'));
  const foldCompass=finishScene('depth_fold_quay','dp_fold_compass','Keva at the Chart Table','B',[
    'The four charts overlap at one quiet shore. Keva fits them around a compass with two needles: onward and home.',
    'The passenger list has names. The shore has room. The return line can carry a measured number of people.',
    'We can label the rescue route by the people waiting at each stop, or by the fixed landmarks that guide the next crew. Both belong on the final chart.'
  ],req('dp_fold_berth_record','dp_fold_garden_record'),'depth_hollow_arrival',[gold(170),item('dp_passage_compass'),item('ether',3)],
    [choose('Mark the waiting passengers first.','dp_compass_names'),choose('Mark the fixed landmarks first.','dp_compass_landmarks')],[],
    ['The Returning Compass points toward the Far Shore and back toward the four safe regions. Neither needle asks for every road at once.']);
  mission({id:'depth_hollow_arrival',name:'A Chart with a Way Back',arc:'hollow',order:1,zone:'depth_fold_quay',npc:'Neris\'s Return Image',level:14,requires:plans[4].requires,
    summary:'Survey both branches of the lost vessel. Reveal the true passenger names, then join all four charts at the quay.',
    intro:['You closed four anchors. I can feel the passage narrowing. Do you know how many people may be waiting beyond it?','I was stranded once. A captain shut a gate because the sea was rough. I waited where no later chart admitted there had been land.','I built the Far Shore so no one would wait there again. Walk the berths. Look at the garden. Then tell me which road you can bear to close.'],
    steps:[foldEcho,foldBerthRecord,foldGardenRecord,foldCompass],reward:'170 crowns; Returning Compass; 3 Blue Nectar; a measured rescue route.',completionDialogue:'dp_fold_compass_talk',
    after:['The image waits at the edge of the quay. Neris is still holding the main wheel in the navigator\'s hold.']});

  const foldReturnMirrors=mechanism('depth_fold_echoes','dp_fold_return_mirrors','The Four Homeward Mirrors','D',
    {kind:'mirror',initial:[0,0,0,0],target:[3,0,1,2],labels:['First berth','Upper shore','Garden light','Lower return']},
    'The first berth faces West, the upper shore North, the garden light East, and the lower return South. The Returning Compass marks the same order.',req('depth_hollow_passage_started'));
  const foldReturnBell=field('depth_fold_echoes','dp_fold_return_bell','The Bell between Two Shores','F','resonate',
    ['Soren rings once toward the berths and once toward the quay. The notes meet at the same beat.','The passengers hear a real return signal. They no longer need to follow every echo of their own names.'],req('dp_fold_return_mirrors'));
  const foldBerthFight=battle('depth_fold_echoes','dp_e_hollow_berths','The Repeated Crossing','E',['dp_hollow_mariner','dp_tide_image'],'dp_fold_echo_safe',req('dp_fold_return_bell'),165,90,14,
    {intro:['An empty mariner rows the same passenger image from one berth to another. It mistakes motion for rescue.'],victory:['The repeated crossing ends. The people named on the true list can walk toward the quay.']});
  const foldGardenCircuit=mechanism('depth_fold_garden','dp_fold_garden_grid','The Measured Garden Circuit','C',
    {kind:'circuit',size:3,scramble:[1,3,4,5,7],goal:[0,0,0,0,0,0,0,0,0]},
    'Dark lamps close unused routes. Each touch switches the chosen lamp and its edge neighbours. Darken all nine so the garden uses only the route on the new chart.',req('depth_hollow_passage_started'));
  const foldGardenRoot=field('depth_fold_garden','dp_fold_return_root','The Garden Return Root','D','grow',
    ['Ilex gives the garden one return root. Water reaches its own soil again before any branch asks for more.','The living passengers can leave the crossing plants in place. They will not starve when the wide passage closes.'],req('dp_fold_garden_grid'));
  const foldGardenFight=battle('depth_fold_garden','dp_e_hollow_garden','The Unspent Seasons','E',['dp_unspent_moth','dp_tide_image'],'dp_fold_garden_safe',req('dp_fold_return_root'),175,95,14,
    {intro:['Unspent seasons gather around the last open branch. Their hunger pulls against the new return root.'],victory:['The garden settles around one stream. Its plants can grow in a place instead of between every place at once.']});
  const foldPassengers=finishScene('depth_fold_garden','dp_fold_passengers','The Passengers at the Return Root','F',[
    'The people from the echo berths reach the garden. Each name on Keva\'s list has answered once. No name is missing.',
    'Paz closes the last unused lamp. Melo sets a growing bed beside the safe route. Lio writes the arrival count in an open hand.',
    'The passengers are safe. Neris no longer holds a rescue open. He holds a possibility open, and it is pulling at every place we have repaired.'
  ],req('dp_fold_echo_safe','dp_fold_garden_safe'),'depth_hollow_passage',[gold(210),item('phoenix',3)],[],[flag('dp_fold_all_passengers_safe')],
    ['Every person on the checked list has a place on the return route. The hold can be reached from either branch.']);
  mission({id:'depth_hollow_passage',name:'One Arrival for Each Name',arc:'hollow',order:2,zone:'depth_fold_echoes',npc:'Paz at the First Berth',level:14,requires:req('depth_hollow_arrival_done'),
    summary:'Open the return route through the echo berths and the possible garden. Clear both crossings, then check every passenger at the return root.',
    intro:['Keva\'s list has twelve names. We have twelve places on the marked route. I can count them instead of watching an endless horizon.','Set the homeward mirrors and sound the return bell here. In the garden, close the unused lamp routes and grow a return root. Clear both crossings before we move the people.'],
    steps:[foldReturnMirrors,foldReturnBell,foldBerthFight,foldGardenCircuit,foldGardenRoot,foldGardenFight,foldPassengers],reward:'210 crowns; 3 Dawn Salt; all twelve passengers checked and safe.',completionDialogue:'dp_fold_passengers_talk',
    after:['Twelve names. Twelve replies. The count is complete. The navigator\'s hold can be reached from either branch.']});
  battle('depth_fold_quay','dp_e_hollow_side','The Wake that Waited','D',['dp_hollow_mariner','dp_unspent_moth'],'dp_fold_side_clear',req('depth_hollow_arrival_done'),170,95,14,{loot:[{id:'ether',count:2}]});

  const foldNerisRecord=read('depth_fold_hold','dp_fold_captain_record','Neris\'s First Shore','B',[
    'The oldest page is a map made by a child. It shows a dock, a closed gate, and a light on the other side.',
    'Beside it, Neris wrote: I will make a vessel that can return for anyone. Years later he crossed out can return and wrote never leaves.',
    'His first promise gave people a way home. The second made a home that no one could leave without abandoning everyone else.'
  ],req('depth_hollow_captain_started'));
  const foldHoldBrace=field('depth_fold_hold','dp_fold_hold_brace','The Open Return Wheel','D','brace',
    ['Brann braces the return wheel in its open position. The checked rescue route stays clear even if Neris turns the main helm.','Keva leads the passengers onto the quiet shore. No one remains behind the coming confrontation.'],req('dp_fold_captain_record'));
  const foldNerisFight=battle('depth_fold_hold','dp_e_hollow_neris','Neris, the Unmoored Navigator','E',['dp_neris','dp_compass_echo','dp_compass_echo'],'dp_fold_neris_clear',req('dp_fold_hold_brace'),390,170,14,
    {intro:['Two compass echoes turn every strike away from the navigator. Break their hold before you challenge the helm.','Neris: I can still reach the next light. If I stop now, someone will call and no one will come.','Mira: The people here have called. We came. You can come with us.'],victory:['Neris releases the wheel. Brann catches him before the broken rail gives way.','The wide passage stays open below the vessel. Something in its wake is now pulling for itself.'],loot:[{id:'echo_glass',count:2}]});
  const foldNerisEnd=finishScene('depth_fold_hold','dp_fold_neris_answer','Neris beside the Quiet Helm','F',[
    'I kept the gate open because I remembered being outside it. I stopped asking whether the people inside could still breathe.',
    'You gave them a return route before asking me to close mine. I can see the difference now. I could have asked for help before the vessel broke.',
    'The White Undertow has grown under the open passage. It feeds on roads with no return. Let me help you read its pull, then decide what work you can trust me to do.'
  ],req('dp_fold_neris_clear'),'depth_hollow_captain',[gold(250),item('dp_navigator_clasp')],
    [choose('Ask Neris to chart safe routes with a crew.','dp_neris_charts'),choose('Ask Neris to help people settle ashore.','dp_neris_shore')],[flag('dp_neris_listened')],
    ['Neris leaves the main wheel unlocked. He has a task with other people and a limit they can check.']);
  mission({id:'depth_hollow_captain',name:'The Promise That Would Not End',arc:'hollow',order:3,zone:'depth_fold_hold',npc:'Neris at the Main Wheel',level:14,requires:req('depth_hollow_passage_done'),
    summary:'Read Neris\'s first promise, brace the return wheel, and confront the navigator after all passengers have reached safety.',
    intro:['I know you counted the people. I know the shore has room. Beyond it there may be a person no list has found.',
      'My first map is still on the desk. Read it before you ask me to stop. Then show me a return route that will not close when we disagree.'],
    steps:[foldNerisRecord,foldHoldBrace,foldNerisFight,foldNerisEnd],reward:'250 crowns; Navigator\'s Clasp; Neris survives and releases the helm.',completionDialogue:'dp_fold_neris_answer_talk',
    after:['The passengers are safe and the return wheel is open. The White Undertow is the last force holding the passage apart.']});

  const foldFinalBell=field('depth_fold_horizon','dp_fold_final_note','The Last Return Signal','B','resonate',
    ['Soren sends the return note to all four quiet anchors. Each answers once, in its own age.','The crew can hear a complete route. No anchor calls for more water, light, weather, or time.'],req('depth_hollow_horizon_started'));
  const foldFinalPower=field('depth_fold_horizon','dp_fold_final_power','The Shared Horizon Relay','C','power',
    ['Vale joins the four small supplies through their return contacts. He keeps each load below the mark its keepers set.','The relay lights one horizon. It draws no storm from an unlived sky.'],req('dp_fold_final_note'));
  const foldFinalFight=battle('depth_fold_horizon','dp_e_hollow_undertow','The White Undertow','E',['dp_white_undertow','dp_anchor_bud','dp_anchor_bud'],'dp_fold_undertow_clear',req('dp_fold_final_power'),650,250,14,
    {intro:['Two unmoored anchor buds feed the Undertow from the empty routes. Cut their hold before you face the current itself.','Neris: It pulls hardest when we call every direction a destination. Hold the one route we checked.','Keva: The shore is clear. Every passenger is accounted for. We can close this crossing.'],victory:['The empty routes close. A pale wake passes under the vessel and breaks against a shore that stays where it is.','The return lamps remain lit. No voice is lost when the water becomes quiet.'],loot:[{id:'memory_ore',count:2}]});
  C.dialogues.dp_far_refuge_close={speaker:'The Far Shore',lines:[
    'The vessel rests at the quiet shore. Its doors open toward a garden, a workshop, and twelve rooms with names beside them.',
    'Keva keeps the rescue list at the dock. A new arrival can add a name without becoming a reason to open every sea.',
    'Paz teaches the return signal. Melo tends plants that once grew between seasons. Lio writes accounts that their speakers can correct.',
    'Yali and Anik send a letter from the repaired hull. The first line says they slept through a whole night without waiting for the doors to open.',
    'The four regions keep their own anchors and their own limits. When the refuge needs help, it asks the people who can answer.',
    'Neris visits the child\'s map one last time. He draws a second light on the near side of its closed gate. There is room to wait here, with company.',
    'The Far Shore has become a place to arrive. Its road home stays marked. The crew can return to the orchard and finish the story that brought them through the ages.'
  ]};
  C.dialogues.dp_far_voyage_close={speaker:'The Far Shore',lines:[
    'The crew sets a short course. Three landmarks, one spare day, and a return before the garden lamps need tending.',
    'Keva keeps the passenger list on the bridge. People may join the voyage, remain ashore, or leave it at the next marked stop.',
    'Paz checks the return signal before each departure. Melo leaves a keeper at the garden. Lio writes the agreed course beside the account of the wreck.',
    'Yali and Anik send supplies from the repaired hull. They choose a calm-weather visit after the first survey returns.',
    'The four regions supply only what their keepers agreed to share. A route that asks for more waits for another day and another answer.',
    'Neris looks beyond the chart, then writes the return time where everyone can see it. Finding a new shore will matter more if the crew can tell someone about it.',
    'The Far Shore leaves a clear wake. Its first small voyage has an end. The orchard remains on the map, ready for the crew to return and finish their journey through the ages.'
  ]};
  const foldFinalEnd=finishScene('depth_fold_horizon','dp_fold_final_choice','The Crew at the Far Horizon','F',[
    'The vessel is free. The shore is real. Its people have a home and a road back to the ages they choose.',
    'Neris lays the compass on the table. No one person will hold its key. The crew will record each route, its load, and its return.',
    'We can keep the Far Shore here as a refuge for future arrivals, or use it for small survey voyages with a fixed return. The passengers can choose whether to travel.'
  ],req('dp_fold_undertow_clear'),'depth_hollow_horizon',[gold(420),item('dp_quietwake_coat',3),item('elixir',3)],
    [choose('Make the Far Shore a refuge.','far_shore_refuge','dp_far_refuge_close'),choose('Plan short voyages with a fixed return.','far_shore_voyage','dp_far_voyage_close')],[flag('far_shore_complete')],
    ['The Far Shore has a place, a checked route, and a crew that can choose when to return.','The orchard still holds its paths through the ages. The roads we kept remain open to us.']);
  mission({id:'depth_hollow_horizon',name:'A Shore We Can Return From',arc:'hollow',order:4,zone:'depth_fold_horizon',npc:'Keva and the Assembled Crew',level:14,requires:req('depth_hollow_captain_done'),
    summary:'Sound the four return anchors, power one checked route, release the White Undertow, and decide the vessel\'s future with its crew.',
    intro:['Every person has reached the shore. Every region has answered its return signal. The last crossing can close without trapping anyone.','Soren will sound the route. Vale will share the measured power. Release the anchor buds feeding the White Undertow, then meet us at the horizon table.'],
    steps:[foldFinalBell,foldFinalPower,foldFinalFight,foldFinalEnd],reward:'420 crowns; 3 Quietwake Coats; 3 Last Fruit; The Far Shore resolved.',completionDialogue:'dp_fold_final_choice_talk',
    after:['The rescue is complete. The crew\'s choice remains in force. The return gangway leads to the quay.']});
  // Finite caches fund choices at the camp workbench. No material gates a mission.
  const cachePlans={
    tide:[[{id:'memory_ore',count:2},{id:'living_fiber',count:2}], [{id:'living_fiber',count:1}], [{id:'memory_ore',count:1}], [{id:'prism_dust',count:2}], [{id:'memory_ore',count:1}]],
    roots:[[{id:'living_fiber',count:2}], [{id:'memory_ore',count:1}], [{id:'living_fiber',count:1}], [{id:'prism_dust',count:2}], [{id:'living_fiber',count:1}]],
    mirrors:[[{id:'prism_dust',count:2}], [{id:'echo_glass',count:1}], [{id:'prism_dust',count:1}], [{id:'echo_glass',count:2}], [{id:'memory_ore',count:1}]],
    storm:[[{id:'storm_coil',count:2}], [{id:'memory_ore',count:1}], [{id:'storm_coil',count:1}], [{id:'living_fiber',count:2}], [{id:'storm_coil',count:1}]],
    hollow:[[{id:'echo_glass',count:2}], [{id:'prism_dust',count:1}], [{id:'living_fiber',count:1}], [{id:'storm_coil',count:2}], [{id:'memory_ore',count:1}]]
  };
  const cacheSupplies=[{id:'tonic',count:2},{id:'ether',count:1},{id:'phoenix',count:1},{id:'panacea',count:2},{id:'elixir',count:1}];
  for(const p of plans)p.rooms.forEach(([z],i)=>chest(z,z+'_cache',[25,18],[...cachePlans[p.theme][i],cacheSupplies[i]],i===4?70:25,i===4?req(p.done):undefined));
  chest('depth_ash_skywalk','dp_root_future_cache',[7,18],[{id:'ether',count:2}],35,req('dp_roots_bridge'));
  chest('depth_seed_canopy','dp_root_garden_cache',[7,18],[{id:'ether',count:2}],35,req('dp_roots_garden'));

  // People move when their rescue has a safe destination. Repeat scenes pay nothing.
  rooms.depth_bell_choir.entities.find(e=>e.id==='dp_paz_rescue').hideIf=req('dp_paz_saved');
  for(const id of ['dp_yali_ready','dp_anik_ready'])rooms.depth_ash_berths.entities.find(e=>e.id===id).hideIf=req('dp_ash_passengers_saved');
  function witness(z,id,name,slot,lines,requires,variants=[]){
    C.dialogues[id+'_talk']={speaker:name,lines,variants};entity(z,id,'npc',name,slot,{dialogue:id+'_talk',requires});
  }
  witness('depth_bell_dock','dp_paz_dock','Paz at the Return Rope','D',[
    'I can leave the dock whenever I need to. That is why I can keep a useful watch here.','Keva checks the route after each high tide. A lamp is a promise to maintain a road, not a command to stay beside it.'
  ],req('dp_paz_at_dock'));
  witness('depth_bell_choir','dp_paz_reader','Paz at the Chart Shelf','C',[
    'Each chart now has a date, a return mark, and the name of the person who checked it.','I work while the tide is low. When the water rises, I take the dry stair back to the dock.'
  ],req('dp_paz_chart_reader'));
  witness('depth_bell_dock','dp_tide_watch','Rema the Dock Keeper','C',[
    'The hull below us has held its shape through the last tide. We are waiting to learn which rooms are safe to use.'
  ],undefined,[
    {requires:req('dp_tide_lanterns'),lines:['Keva placed the spare lamps along the search line. A later chart carries the same three-note return mark.','Search crews can follow that mark toward lost rooms without opening the old anchor.']},
    {requires:req('dp_tide_refuge'),lines:['We made beds inside the quiet hull. The first guest slept through the tide with the door open.','A refuge can be small. It needs water, a dry place, and a person who notices when someone arrives.']}
  ]);
  witness('depth_seed_canopy','dp_nursery_after','Umo at the New Bed','F',[
    'The young bed has no roots yet. I have left enough room beside the path for a keeper to watch it.'
  ],undefined,[
    {requires:req('dp_roots_garden'),lines:['We kept the spare root here. This bed will grow one season at a time, with space for another keeper.','The cache beside the lower path holds the supplies we no longer need for the deep flower.']},
    {requires:req('dp_roots_bridge'),lines:['The spare root follows a part of the vessel toward a future sky. It carries a small graft and returns its water here.','Look for it on the Broken Skywalk in Ash Tomorrow. The future crew can use its support without feeding the old hunger.']},
    {requires:req('dp_roots_teaching_bed'),lines:['Young keepers can now study the measured water share from this bed. They can see the return channel as well as the inlet.']},
    {requires:req('dp_roots_shelter_bed'),lines:['The quiet bed is ready for fragile arrivals. We check each plant before we decide where it can live.']}
  ]);
  witness('depth_glass_foyer','dp_theatre_record_keeper','Setha\'s Record Keeper','C',[
    'The gallery lamps follow an old pattern. I have not found the person who first marked it.'
  ],undefined,[
    {requires:req('dp_glass_public'),lines:['The two accounts stand beside each other. Visitors can see the warning, the reply, and the later correction.','Lio keeps the choice about her name. A public record does not cancel the witness\'s own decision.']},
    {requires:req('dp_glass_private'),lines:['The quiet archive holds the accounts. Each witness can choose when to add a statement or correct one.','The evidence remains available. The room does not require anyone to perform their memory for a crowd.']},
    {requires:req('dp_tide_lanterns'),lines:['The gallery lamps carry Keva\'s return mark from the old coast. Three clear notes, with a space to answer.','Her search lamps left a pattern this theatre could use centuries later.']}
  ]);
  C.dialogues.dp_glass_public_account_after.variants=[
    {requires:req('dp_tide_lanterns'),lines:['The printed account remains beside its correction. The lamps above it carry Keva\'s old coastal return mark.','A choice made at the chart house left light in a room its maker could never visit.']}
  ];
  witness('depth_ash_skywalk','dp_future_root_reader','Odo at the Living Joint','C',[
    'The metal support is sound. There is a small gap beside it where the hull once pulled away from its own past.'
  ],undefined,[{requires:req('dp_roots_bridge'),lines:['A living graft now crosses that gap. Its root mark matches the one Ilex left in the first forest.','It carries a small part of the load and returns its water. We left spare Blue Nectar in the cache by its foot.']}]);
  witness('depth_ash_camp','dp_passenger_home','Yali and Anik at the Camp','D',[
    'We reached the open ground. For now, we will rest near Odo until the weather furnace is quiet.'
  ],req('dp_ash_passengers_saved'),[
    {requires:req('depth_storm_complete','dp_passengers_camp'),lines:['Our home is beside the camp. Yali tends the lamp. Anik keeps the window open when the weather is calm.','We chose a place where we can see the road before we decide to use it.']},
    {requires:req('depth_storm_complete','dp_passengers_berths'),lines:['The repaired berths have ordinary doors now. We can close them for sleep and open them ourselves in the morning.','We came to the camp for supplies. It is good to make a short trip because we want to.']}
  ]);
  witness('depth_ash_camp','dp_hull_supply_keeper','Tavi the Hull Supply Keeper','C',[
    'The local supply can serve a few lamps. We will decide about another load after the furnace stops.'
  ],undefined,[
    {requires:req('dp_storm_garden'),lines:['The warm bed has its first food plants. Its meter stays below the mark Vale left.','We made the first harvest into Orchard Tonics. The rest stays here for the people who tend it.']},
    {requires:req('dp_storm_reserve'),lines:['The spare cells are charged and dated. We test one at a time so an emergency does not become our first check.','The Blue Nectar we gave the crew is part of the same small reserve.']}
  ]);
  witness('depth_fold_quay','dp_far_shore_record','The Far Shore Return Book','C',[
    'The return book waits for a destination and the names of the people who checked its route.'
  ],undefined,[
    {requires:req('far_shore_refuge'),lines:['The first page names a refuge. Twelve passengers have a room, and the arrival list has space for the next name.','The onward road remains marked. No one must leave this place to prove that the rescue mattered.']},
    {requires:req('far_shore_voyage'),lines:['The first page names a short survey. Its return time is written beside its outward course.','The shore remains staffed. Each passenger can choose a voyage or a quiet room, and can change that choice later.']},
    {requires:req('dp_compass_names'),lines:['The compass chart starts with the names of people waiting at each stop. The landmarks appear in the next column.']},
    {requires:req('dp_compass_landmarks'),lines:['The compass chart starts with the fixed landmarks. The people waiting at each stop appear in the next column.']}
  ]);
  witness('depth_fold_quay','dp_neris_after','Neris at the Open Gangway','F',[
    'I can help without holding the only key. It is a lesson I should have learned before I built this vessel.'
  ],req('far_shore_complete'),[
    {requires:req('dp_neris_charts'),lines:['I check each new chart with another navigator. We record a return and ask the crew before adding a stop.','The next distant light can wait while we bring this crew home.']},
    {requires:req('dp_neris_shore'),lines:['I am helping the new arrivals find their rooms. When someone asks for a road, I first ask where they want it to end.','There is useful work at the shore. I no longer need a limitless sea to have a reason to stay.']}
  ]);
  C.temporalChanges=(C.temporalChanges||[]).concat([
    {flag:'dp_tide_lanterns',mission:'depth_tide_keel',source:'depth_bell_keel',targets:['depth_bell_dock','depth_glass_gallery'],text:'The rescued search lamps leave a return-light pattern in the later theatre.'},
    {flag:'dp_tide_refuge',mission:'depth_tide_keel',source:'depth_bell_keel',targets:['depth_bell_dock'],text:'The quiet hull becomes a small coastal refuge.'},
    {flag:'dp_roots_bridge',mission:'depth_roots_anchor',source:'depth_seed_heart',targets:['depth_ash_skywalk'],text:'A measured living graft reaches the future wreck; its keepers leave a finite supply cache.'},
    {flag:'dp_roots_garden',mission:'depth_roots_anchor',source:'depth_seed_heart',targets:['depth_seed_canopy'],text:'The spare root becomes a new garden and a cache remains for its keepers.'},
    {flag:'dp_glass_public',mission:'depth_mirrors_anchor',source:'depth_glass_stage',targets:['depth_glass_foyer'],text:'Both accounts enter a public record room with the witness\'s chosen attribution.'},
    {flag:'dp_glass_private',mission:'depth_mirrors_anchor',source:'depth_glass_stage',targets:['depth_glass_foyer'],text:'The witnesses keep control of their statements in a quiet archive.'},
    {flag:'dp_storm_garden',mission:'depth_storm_anchor',source:'depth_ash_bridge',targets:['depth_ash_camp'],text:'Spare local power supports a food bed and its first harvest.'},
    {flag:'dp_storm_reserve',mission:'depth_storm_anchor',source:'depth_ash_bridge',targets:['depth_ash_camp'],text:'Spare power becomes a tested emergency reserve.'},
    {flag:'far_shore_refuge',mission:'depth_hollow_horizon',source:'depth_fold_horizon',targets:['depth_fold_quay'],text:'The vessel becomes a staffed refuge with a checked road home.'},
    {flag:'far_shore_voyage',mission:'depth_hollow_horizon',source:'depth_fold_horizon',targets:['depth_fold_quay'],text:'The vessel takes short survey routes with fixed return dates and a staffed shore.'}
  ]);

  // Ordinary fights leave time for a reply without raising enemy damage.
  const ordinaryEnemyIds=new Set(encounterIds.filter(id=>!C.encounters[id].boss).flatMap(id=>C.encounters[id].enemies));
  for(const id of ordinaryEnemyIds){
    const e=C.enemies[id];e.maxHp=Math.round(e.maxHp*2.5);e.atb=70;
  }
  // Guardians recover long enough to resume their authored attack cycles.
  for(const id of enemyIds)if(C.enemies[id].boss)C.enemies[id].staggerRecovery=4;

  C.depths.zoneIds=Object.keys(rooms);C.depths.missionIds=missionIds;C.depths.enemyIds=enemyIds;C.depths.encounterIds=encounterIds;
  C.depths.materialIds=[...materials];
  C.depths.counts={dungeons:plans.length,zones:Object.keys(rooms).length,missions:missionIds.length,encounters:encounterIds.length,enemies:enemyIds.length,
    guardians:enemyIds.filter(id=>C.enemies[id].boss).length,mechanisms:Object.values(rooms).flatMap(z=>z.entities).filter(e=>e.type==='mechanism').length,
    fieldActions:Object.values(rooms).flatMap(z=>z.entities).filter(e=>e.type==='field').length,chests:Object.values(rooms).flatMap(z=>z.entities).filter(e=>e.type==='chest').length,
    materialPieces:Object.values(rooms).flatMap(z=>z.entities).filter(e=>e.type==='chest').flatMap(e=>e.loot||[]).concat(encounterIds.flatMap(id=>C.encounters[id].loot||[])).filter(row=>materials.has(row.id)).reduce((n,row)=>n+(row.count||1),0)};
  C.zoneById=Object.fromEntries(C.zones.map(z=>[z.id,z]));
  if(C.refreshCounts)C.refreshCounts();
})(globalThis);
