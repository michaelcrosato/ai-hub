/* The Hearthbound Roads — six personal journeys and one displaced town. */
(function(global){
  'use strict';
  const D=global.Dawn,C=D&&D.Content;if(!C)throw new Error('Load content.js before hearth-content.js.');
  if(C.hearth&&C.hearth.id==='hearthbound-roads')return;
  const F=id=>({type:'flag',id,value:true}),I=(id,count=1)=>({type:'item',id,count}),G=amount=>({type:'gold',amount}),R=(...flags)=>({flags});
  const maps={},missionIds=[],enemyIds=[],encounterIds=[],choiceIds=[];
  const S={A:[7,8],B:[16,7],C:[24,8],D:[8,15],E:[17,13],F:[24,16]};
  const contacts={mira:[6,11],soren:[11,11],brann:[16,11],ilex:[21,11],nyx:[10,16],vale:[21,16]};
  const projects={mira:'workshop',soren:'inn',brann:'observatory',ilex:'garden',nyx:'archive',vale:'dock'};
  const plans=[
    {id:'mira',name:'The Work of Our Own Hands',era:'bell642',theme:'clock',chapter:2,level:5,first:'hearth_mira_lane',second:'hearth_mira_loft',names:['The Split Minute','The Unfinished Workshop'],start:'hb_mira_measure',done:'hearth_mira_complete',description:'A clockmaker\'s street repeats its last unpaid minute. Mira must decide what her skill can give another maker.'},
    {id:'soren',name:'A Room for Every Voice',era:'bell642',theme:'tide',chapter:2,level:5,first:'hearth_soren_bank',second:'hearth_soren_well',names:['Quietwater Steps','The Listening Well'],start:'hb_soren_listen',done:'hearth_soren_complete',description:'An inn\'s guests have lost their voices to the water. Soren follows the answers that his own bell cannot supply.'},
    {id:'brann',name:'Strength That Leaves a Window',era:'ash2310',theme:'forge',chapter:3,level:7,first:'hearth_brann_yard',second:'hearth_brann_furnace',names:['Cinderframe Yard','The Empty Star Forge'],start:'hb_brann_frame',done:'hearth_brann_complete',description:'A dismantled star tower is being remade into a wall. Brann must build something that lets people see beyond danger.'},
    {id:'ilex',name:'The Seed We Do Not Own',era:'seed112',theme:'roots',chapter:3,level:7,first:'hearth_ilex_path',second:'hearth_ilex_orchard',names:['The Borrowed Hedge','The Orchard of New Names'],start:'hb_ilex_graft',done:'hearth_ilex_complete',description:'A collector has claimed the fruit of trees not yet grown. Ilex helps a young keeper choose what their own garden will become.'},
    {id:'nyx',name:'The Name beyond the Margin',era:'glass1186',theme:'ink',chapter:4,level:9,first:'hearth_nyx_steps',second:'hearth_nyx_vault',names:['The Paper Stair','The Unclaimed Archive'],start:'hb_nyx_margin',done:'hearth_nyx_complete',description:'An archive prices people by the stories written about them. Nyx follows a witness who has refused the part on her file.'},
    {id:'vale',name:'The Answer Worth Waiting For',era:'ash2310',theme:'signal',chapter:4,level:9,first:'hearth_vale_mast',second:'hearth_vale_station',names:['Last-Call Mast','The Patient Station'],start:'hb_vale_reply',done:'hearth_vale_complete',description:'A delivery network charges for every unanswered call. Vale must carry a passenger\'s answer, even if it means missing a deadline.'}
  ];
  C.hearth={id:'hearthbound-roads',name:'The Hearthbound Roads',version:'1.3.0',startZone:'hearth_haven',startEntity:'hb_haven_welcome',completeFlag:'hearthbound_complete',
    description:'Six travellers restore a town caught between ages. Reclaim its people and hearthmarks from Tallow, the Deed Collector, then give the town back its stolen years.',
    antagonist:'Tallow, the Deed Collector',antagonistMotive:'Tallow profits from the town\'s displacement. Each arrival creates another debt, so he prevents its people from finishing a home or giving a final answer.',arcIds:[...plans.map(p=>p.id),'finale']};
  C.hearthArcs=[];C.missions=C.missions||[];
  function zone(id,name,era,theme,preset,requires,extra={}){const z={id,name,era,width:32,height:24,spawn:{x:16,y:18},style:theme==='haven'?'town':'ruin',hearthTheme:theme,hearthLayout:{preset},description:name+' is one of the roads that lead to Wayfarer Haven.',features:[],entities:[],exits:[],overworldRequires:requires,...extra};maps[id]=z;C.zones.push(z);return z;}
  zone('hearth_haven','Wayfarer Haven','bell642','haven','haven',{chapterAtLeast:2},{description:'A town with doors in several ages. Its residents are building a place where arrival does not create a debt.'});
  for(const p of plans){
    zone(p.first,p.names[0],p.era,p.theme,'approach',{chapterAtLeast:p.chapter},{description:p.description});
    zone(p.second,p.names[1],p.era,p.theme,'heart',{chapterAtLeast:p.chapter},{overworldParent:p.first,description:p.description});
    maps[p.first].exits.push({id:p.first+'_inside',name:p.names[1],x:16,y:3,to:p.second,tx:16,ty:18,requires:R('hb_'+p.id+'_path'),lockedText:'Begin this traveller\'s first task and open the marked field route.'});
    maps[p.second].exits.push({id:p.second+'_return',name:p.names[0],x:16,y:20,to:p.first,tx:16,ty:5});
    C.hearthArcs.push({id:p.id,name:p.name,hero:p.id,project:projects[p.id],era:p.era,zoneIds:[p.first,p.second],start:p.start,startZone:p.first,startEntity:p.start+'_start',requires:{chapterAtLeast:p.chapter},completeFlag:p.done,recommendedLevel:p.level});
  }
  const finalRequires={chapterAtLeast:7,flags:['fold_open',...plans.map(p=>p.done),...Object.values(projects).map(id=>'project_'+id+'_1')]};
  zone('hearth_final_crossing','The Road under the Deeds','fold','hearth','approach',finalRequires);
  zone('hearth_final_hearth','The Collector\'s Table','fold','hearth','heart',finalRequires,{overworldParent:'hearth_final_crossing'});
  maps.hearth_final_crossing.exits.push({id:'hb_claim_door',name:'The Collector\'s Table',x:16,y:3,to:'hearth_final_hearth',tx:16,ty:18,requires:R('hb_final_survey_done'),lockedText:'Read the six hearthmarks and bring the town\'s reply to the claim door.'});
  maps.hearth_final_hearth.exits.push({id:'hb_claim_return',name:'The Road under the Deeds',x:16,y:20,to:'hearth_final_crossing',tx:16,ty:5});
  C.hearthArcs.push({id:'finale',name:'A Town beyond the Deed',era:'fold',zoneIds:['hearth_haven','hearth_final_crossing','hearth_final_hearth'],start:'hb_final_survey',startZone:'hearth_haven',startEntity:'hb_final_survey_start',requires:finalRequires,completeFlag:'hearthbound_complete',recommendedLevel:14});
  for(const z of Object.values(maps))if(!z.overworldParent)z.exits.push({id:z.id+'_world',name:'Return to the world road',x:16,y:20,to:'world_'+z.era});
  function ent(z,id,type,name,slot,extra={}){const [x,y]=Array.isArray(slot)?slot:S[slot],e={id,type,name,x,y,...extra};maps[z].entities.push(e);return e;}
  function branch(label,flag,next,effects=[]){choiceIds.push(flag);return {label,effects:[F(flag),...effects],...(next?{next}:{})};}
  function scene(z,id,name,slot,lines,{requires,effects=[],choices=[],after,hero,hideIf,once=true}={}){
    C.dialogues[id+'_talk']={speaker:name,hero,lines,effects,choices,...(once?{onceFlag:id+'_seen',onRepeat:id+'_after'}:{})};
    C.dialogues[id+'_after']={speaker:name,hero,lines:after||['The work is done. Its result remains with the people who chose it.']};
    if(choices.length)C.dialogues[id+'_after'].variants=choices.map(c=>({requires:R(c.effects.find(e=>e.type==='flag').id),lines:[...(after||['The work here is complete.']),'Our choice remains: '+c.label]}));
    ent(z,id,'npc',name,slot,{dialogue:id+'_talk',requires,hideIf});return {text:'Speak to '+name+'.',flag:id,zone:z,entity:id,dialogue:id+'_talk'};
  }
  function step(text,flag,zone,entity,extra={}){return {text,flag,zone,entity,...extra};}
  function read(z,id,name,slot,lines,requires,effects=[],extra={}){return {...scene(z,id,name,slot,lines,{requires,effects:[F(id),...effects],...extra}),text:'Read '+name+'.'};}
  function close(z,id,name,slot,lines,requires,mission,rewards=[],choices=[],extra=[],hero){return {...scene(z,id,name,slot,lines,{requires,effects:[F(id),F(mission+'_done'),...extra,...rewards],choices,hero}),flag:mission+'_done'};}
  function mission(o){
    const start=o.id+'_start',intro=o.id+'_intro',wait=o.id+'_wait',after=o.id+'_after',locked=o.id+'_locked';
    C.dialogues[intro]={speaker:o.npc,hero:o.hero,lines:o.intro,onceFlag:o.id+'_intro_seen',onRepeat:wait,effects:[F(o.id+'_started'),...(o.startEffects||[])]};
    C.dialogues[wait]={speaker:o.npc,hero:o.hero,lines:o.hint||[o.summary]};C.dialogues[after]={speaker:o.npc,hero:o.hero,lines:o.after||['The next road is open. Our work here is complete.']};
    C.dialogues[locked]={speaker:o.npc,hero:o.hero,lines:[o.locked||'Finish this traveller\'s earlier task. The Journal names the next place.']};
    const variants=[{requires:R(o.id+'_done'),dialogue:after},...(o.finishRequires?[{requires:o.finishRequires,dialogue:o.id+'_finish'}]:[]),{requires:R(o.id+'_started'),dialogue:wait},{requires:o.requires||{},dialogue:intro}];
    ent(o.zone,start,'npc',o.npc,o.slot||'A',{dialogue:locked,variants,...(o.zone==='hearth_haven'&&o.hero?{hero:o.hero}:{}),...(o.hideIf?{hideIf:o.hideIf}:{})});
    if(o.finishLines)C.dialogues[o.id+'_finish']={speaker:o.npc,hero:o.hero,lines:o.finishLines,onceFlag:o.id+'_finish_seen',onRepeat:after,effects:[F(o.id+'_done'),...(o.finishEffects||[])],choices:o.finishChoices||[]};
    const m={id:o.id,name:o.name,campaign:'hearth',arc:o.arc,order:o.order,era:maps[o.zone].era,hero:o.hero,requires:o.requires||{},summary:o.summary,startNpc:o.npc,startEntity:start,startZone:o.zone,recommendedLevel:o.level,
      steps:[step('Speak to '+o.npc+'.',o.id+'_started',o.zone,start),...o.steps],completeFlag:o.id+'_done',reward:o.reward,...(o.completionDialogue?{completionDialogue:o.completionDialogue}:o.finishLines?{completionDialogue:o.id+'_finish'}:{})};
    C.missions.push(m);missionIds.push(o.id);return m;
  }
  const heroAbility={mira:'cut',soren:'resonate',brann:'brace',ilex:'grow',nyx:'reveal',vale:'power'};
  const recruitHints={mira:'Mira is in the starting party.',soren:'Soren is in the starting party.',brann:'Recruit Brann at Copper Kiln in the Age of Bells.',ilex:'Recruit Ilex at Mosswake Camp in the Seed Age.',nyx:'Recruit Nyx at Prism Steps in the Glass Republic.',vale:'Recruit Vale at Cinder Relay in Ash Tomorrow.'};
  function field(z,id,name,slot,hero,lines,requires,effects=[],hideIf){ent(z,id,'field',name,slot,{ability:heroAbility[hero],flag:id,lines,requires,hideIf,recruitHint:recruitHints[hero],effects:[F(id),...effects]});return step('Ask '+C.heroes[hero].name+' to use '+name+'.',id,z,id,{ability:heroAbility[hero]});}
  function mechanism(z,id,name,slot,puzzle,hint,requires,effects=[]){ent(z,id,'mechanism',name,slot,{puzzle,flag:id,hint,requires,effects:[F(id),...effects]});return step('Set '+name+'.',id,z,id,{puzzle:puzzle.kind});}
  function attack(name,power=1.2,target='enemy',element='physical',extra={}){return {name,power,target,element,type:element==='physical'?'physical':'magic',telegraph:target==='allEnemies'||power>=1.6?1.8:.6,charge:target==='allEnemies'||power>=1.6,...extra};}
  function enemy(id,name,hp,atk,mag,def,speed,weak,pattern,extra={}){C.enemies[id]={id,name,maxHp:hp,atk,mag,def,speed,weak,resist:[],boss:false,atb:65,staggerMax:80,staggerDuration:3.5,staggerRecovery:3,pattern,...extra};enemyIds.push(id);}
  function battle(z,id,name,slot,foes,clear,requires,level,xp,gold,extra={}){C.encounters[id]={id,name,enemies:foes,boss:foes.some(id=>C.enemies[id].boss),repeat:false,recommendedLevel:level,requires,xp,gold,loot:extra.loot||[],intro:extra.intro||[name+' blocks the road. Watch its charge and use a weakness to build pressure.'],victory:extra.victory||['The way is clear. The travellers can continue.'],effects:[F(clear),...(extra.effects||[])]};
    const entity=id+'_body';ent(z,entity,'encounter',name,slot,{encounter:id,requires,hideIf:R(clear)});encounterIds.push(id);return step('Resolve '+name+'.',clear,z,entity,{encounter:id});}
  function supplies(n,crowns){return [I('haven_supplies',n),G(crowns)];}
  function projectStep(hero){const id=projects[hero];return step('Build the first tier of Haven\'s '+id+'.','project_'+id+'_1','hearth_haven','hb_project_'+id,{project:id});}
  const projectPads={workshop:[6,5],inn:[11,5],observatory:[16,5],garden:[21,5],archive:[26,5],dock:[26,12]};
  for(const [id,point]of Object.entries(projectPads))ent('hearth_haven','hb_project_'+id,'project','Haven '+id,point,{project:id});
  ent('hearth_haven','hb_haven_camp','camp','The Shared Hearth',[7,18]);ent('hearth_haven','hb_haven_craft','craft','The Travellers\' Workbench',[10,18]);
  ent('hearth_haven','hb_haven_kitchen','cook','The Shared Cooking Table',[13,18]);
  scene('hearth_haven','hb_haven_welcome','Dessa the Door Keeper','A',[
    'This is Wayfarer Haven. My kitchen wakes in one age and my front door opens in another. The people are still here. That is the part I count first.',
    'Tallow calls himself our deed collector. Each time a door arrives, he adds another debt. We cannot finish a home while he keeps moving its address.',
    'Six roads still carry our tools, our guests, and our names. Mira and Soren can follow the first two in this age. The others will open as your journey reaches them.',
    'Build what the people need at the marked project boards. Keep enough for the next household. I will keep a warm hearth here while you are away.'
  ],{effects:[F('hearth_welcomed'),...supplies(4,120)],after:['The six project boards remain open. A first tier needs 3 Haven Supplies and 120 crowns.','The Journal keeps each traveller\'s road separate. Their earlier companion stories can be followed in their own time.']});

  const positions={hearth_haven:[34,28],hearth_mira_lane:[16,18],hearth_soren_bank:[38,53],hearth_brann_yard:[48,30],hearth_ilex_path:[40,57],hearth_nyx_steps:[44,24],hearth_vale_mast:[79,56],hearth_final_crossing:[53,61]};
  for(const [id,pos]of Object.entries(positions))maps[id].worldMapPosition=pos;
  // Original opponents use existing rigs. Each guardian has its own combat problem.
  enemy('hb_tick_mite','Unpaid Tick Mite',780,24,20,11,12,['wind','water'],[attack('Pinch a Second',1.2),attack('Late Again',1.1,'enemy','spark',{status:{slow:5}})],{color:'#b1a084'});
  enemy('hb_brass_debt','Brass Debt Wisp',860,20,26,10,13,['earth','fire'],[attack('Accruing Light',1.35,'enemy','spark'),attack('Count the Waiting',1.15,'allEnemies','void')],{color:'#c6b57d'});
  enemy('hb_minute_bailiff','The Minute Bailiff',2350,29,28,17,11,['wind','water'],[attack('Time Is Due',1.8),{name:'The Same Perfect Minute',type:'support',target:'self',status:{guard:5},telegraph:1.1},attack('Interest in Seconds',1.35,'allEnemies','spark')],
    {boss:true,rigId:'bell_warden',atb:30,staggerMax:140,staggerRecovery:4,color:'#bd9d71',phases:[{at:.5,name:'An unfinished minute',weak:['earth','fire'],pattern:[attack('A Clock with No Owner',1.9,'enemy','void'),attack('Loose Brass Rain',1.4,'allEnemies','physical')]}]});
  enemy('hb_silt_mouth','Silt Mouth',820,25,22,12,10,['fire','wind'],[attack('Swallow a Name',1.3),attack('Muddy Reply',1.15,'allEnemies','water')],{color:'#8ea7a0'});
  enemy('hb_echo_rent','Rent Echo',875,19,28,11,14,['earth','spark'],[attack('Borrowed Breath',1.4,'enemy','water'),attack('Hold Your Answer',1,'enemy','void',{status:{slow:6}})],{color:'#adc8bb'});
  enemy('hb_silent_guest','Silent Guest Seal',390,18,22,10,9,['fire','earth'],[attack('Keep the Room',1,'enemy','void')],{color:'#c0bd9e',staggerMax:55,atb:35});
  enemy('hb_borrowed_choir','The Borrowed Choir',2200,27,29,16,10,['fire','earth'],[{name:'Rent in Breath',type:'heal',target:'allAllies',power:.85,telegraph:2.6,charge:true},attack('All Voices Due',1.35,'allEnemies','water'),attack('The Unanswered Guest',1.7,'enemy','void')],
    {boss:true,rigId:'fourfold_witness',guardedBy:'hb_silent_guest',atb:25,staggerMax:140,staggerRecovery:4,color:'#a8c7bc',phases:[{at:.45,name:'A voice of its own',weak:['wind','spark'],pattern:[attack('Empty Refrain',1.5,'allEnemies','wind'),attack('Last Due Note',1.8,'enemy','water')]}]});
  enemy('hb_scrap_due','Due-Marked Scraper',1080,29,22,16,10,['water','spark'],[attack('Take the Beam',1.4),attack('Ash Receipt',1.1,'allEnemies','earth')],{color:'#ba9877'});
  enemy('hb_cinder_stamp','Cinder Stamp',970,25,31,14,13,['water','wind'],[attack('Brand the Frame',1.45,'enemy','fire',{status:{burn:5}}),attack('Hot Claim',1.2,'allEnemies','fire')],{color:'#c18b64'});
  enemy('hb_rivet_keeper','Claim Rivet',520,23,25,13,8,['water','fire'],[attack('Fasten Shut',1.1)],{color:'#b8a98c',staggerMax:60,atb:30});
  enemy('hb_windowless_wall','The Windowless Palisade',2850,35,31,20,9,['water','fire'],[attack('No Way through',1.9),attack('Keep the Sky Out',1.35,'allEnemies','earth')],
    {boss:true,rigId:'glass_guard',guardedBy:'hb_rivet_keeper',atb:30,staggerMax:150,staggerRecovery:4,color:'#b8a38c',phases:[{at:.5,name:'A window in the wall',weak:['wind','spark'],pattern:[attack('Falling Shutter',1.95),attack('Unframed Light',1.5,'allEnemies','spark')]}]});
  enemy('hb_claim_seed','Claim Seed',1020,26,31,14,12,['fire','wind'],[attack('Fruit Already Sold',1.3,'enemy','earth'),attack('Growing Debt',1.15,'allEnemies','earth',{status:{poison:5}})],{color:'#9cac70'});
  enemy('hb_pale_grazer','Pale Orchard Grazer',1130,31,25,16,11,['water','fire'],[attack('Borrowed Antler',1.5),attack('Winter before Spring',1.15,'allEnemies','water')],{rigId:'glass_hart',size:.6,color:'#b9b78c'});
  enemy('hb_early_harvest','The Harvest before Spring',3300,34,36,18,10,['fire','wind'],[attack('Unripe Claim',1.45,'allEnemies','earth',{status:{poison:5}}),attack('Take Tomorrow\'s Fruit',1.8,'enemy','void')],
    {boss:true,rigId:'root_crown',atb:30,staggerMax:150,staggerRecovery:4,color:'#aeb982',phases:[{at:.6,name:'A season without a price',weak:['water','spark'],pattern:[{name:'Gather the Future Crop',type:'heal',target:'self',power:1.4,telegraph:2.6,charge:true},attack('Unclaimed Root',1.6,'allEnemies','earth')]},{at:.25,name:'The last closed seed',weak:['fire','wind'],pattern:[attack('Open the Season',1.75,'allEnemies','wind')]}]});
  enemy('hb_ink_price','Ink Price',1370,34,38,18,12,['water','spark'],[attack('Name Your Worth',1.45,'enemy','void'),attack('Spread the Charge',1.25,'allEnemies','void')],{color:'#9b87ad'});
  enemy('hb_margin_blade','Margin Blade',1420,37,33,19,14,['fire','earth'],[attack('Cut to Fit',1.6),attack('Small Print',1.15,'allEnemies','spark',{status:{slow:5}})],{rig:'humanoid',color:'#aaa6b2'});
  enemy('hb_final_version','The Final Version',3900,40,42,23,12,['water','earth'],[{name:'Approved Description',type:'support',target:'self',status:{guard:5,haste:5},telegraph:1.2},attack('No Further Changes',1.5,'allEnemies','void'),attack('Your Assigned Part',1.9)],
    {boss:true,rig:'humanoid',atb:25,staggerMax:160,staggerRecovery:4,color:'#b7a3c7',phases:[{at:.55,name:'A living correction',weak:['fire','spark'],pattern:[attack('Cross Out the Witness',2,'enemy','void'),attack('Margins on Every Side',1.6,'allEnemies','wind')]},{at:.25,name:'The page is still open',weak:['water','void'],pattern:[attack('The Last Fixed Line',1.8,'allEnemies','spark')]}]});
  enemy('hb_deadline_hound','Deadline Hound',1430,38,31,19,14,['water','earth'],[attack('No Time to Stop',1.6),attack('Charge for Delay',1.2,'allEnemies','spark')],{color:'#91aca6'});
  enemy('hb_return_static','Unreturned Static',1290,31,42,17,13,['earth','void'],[attack('Delivery without Reply',1.5,'enemy','spark'),attack('Signal Fee',1.25,'allEnemies','wind',{status:{slow:5}})],{color:'#a8c5c6'});
  enemy('hb_address_cell','Address Cell',650,25,31,15,9,['water','earth'],[attack('Lock the Destination',1.15,'enemy','spark')],{color:'#c3b48c',staggerMax:65,atb:35});
  enemy('hb_last_call','The Last Call',3700,40,43,23,11,['earth','water'],[attack('Final Notice',1.9,'allEnemies','spark',{telegraph:2.7}),attack('Arrival Penalty',1.8),{name:'Faster Than an Answer',type:'support',target:'self',status:{haste:6},telegraph:1}],
    {boss:true,rigId:'still_engine',size:.8,guardedBy:'hb_address_cell',atb:25,staggerMax:160,staggerRecovery:4,color:'#95b8be',phases:[{at:.5,name:'A reply reaches the line',weak:['wind','void'],pattern:[attack('Every Unread Letter',1.6,'allEnemies','void',{telegraph:2.5}),attack('No Address Left',2,'enemy','spark')]}]});
  enemy('hb_wax_marshal','Wax Marshal',1850,43,42,23,12,['fire','water'],[attack('A Claim on Your Step',1.7),attack('The Road Is Owed',1.35,'allEnemies','earth')],{rig:'humanoid',color:'#cab691',staggerMax:95});
  enemy('hb_receipt_swarm','Receipt Swarm',1680,35,46,21,15,['fire','wind'],[attack('Every Arrival Charged',1.4,'allEnemies','void'),attack('A Debt without an End',1.65,'enemy','spark',{status:{slow:5}})],{color:'#d2c8a3',staggerMax:90});
  enemy('hb_ownership_seal','Ownership Seal',850,32,37,19,9,['fire','water'],[attack('Press the Claim',1.2,'enemy','earth')],{color:'#c9a777',atb:30,staggerMax:70});
  enemy('hb_tallow','Tallow, Holder of Every Door',7400,49,50,27,12,['fire','water'],[attack('All Your Years Are Due',1.55,'allEnemies','void'),attack('A Hearth Is a Debt',2.1,'enemy','earth')],
    {boss:true,rigId:'fourfold_witness',guardedBy:'hb_ownership_seal',atb:20,staggerMax:175,staggerRecovery:4,color:'#dec18c',phases:[{at:.65,name:'The town answers together',weak:['wind','spark'],pattern:[{name:'Rewrite the Debt',type:'support',target:'self',status:{guard:6},telegraph:1.1},attack('Claim the Living Name',1.75,'allEnemies','void'),attack('The Collector\'s Hand',2.15)]},{at:.28,name:'A seal with no authority',weak:['fire','water','earth'],pattern:[attack('The Last False Title',1.95,'allEnemies','fire',{telegraph:2.6}),attack('A Door No Longer His',2,'enemy','void')]}]});
  for(const p of plans)C.items['hb_mark_'+p.id]={id:'hb_mark_'+p.id,name:C.heroes[p.id].name+'\'s Hearthmark',kind:'key',description:'A recovered claim on work, memory, and a place to belong. It cannot be spent or sold.'};
  for(const row of [
    ['hb_mira_rule','Maker\'s Rule','accessory',{atk:7,speed:3},'A measuring rule with room to mark another maker\'s answer.'],
    ['hb_soren_key','Guest\'s Key','accessory',{mag:9,maxMp:15},'A key given freely, with no bill tied to its return.'],
    ['hb_brann_window','Starframe Clasp','accessory',{def:9,maxHp:70},'A piece of the first frame Brann built to hold a view.'],
    ['hb_ilex_seedcase','Unclaimed Seedcase','accessory',{mag:11,maxHp:55},'It holds seeds for a keeper who will choose what to grow.'],
    ['hb_nyx_margin','Living Margin','accessory',{atk:6,mag:13,speed:2},'Its owner can add a line or leave a space.'],
    ['hb_vale_reply','Answered Signal','accessory',{atk:12,mag:6,speed:3},'A small receiver that waits for the whole reply.'],
    ['hb_hearth_coat','Hearthbound Coat','armor',{def:22,maxHp:80,maxMp:15},'A warm coat made by a town that has its own tomorrow.']
  ]){const [id,name,slot,stats,description]=row;C.items[id]={id,name,kind:slot,slot,stats,description,price:680};}
  function hearthEnd(p,o){
    const id='hb_'+p.id+'_hearth',clear='hb_'+p.id+'_guardian_clear',project=projects[p.id];
    const guard=battle(p.second,'hb_e_'+p.id+'_guardian',o.guardian,'E',o.foes,clear,R(id+'_started'),p.level,o.xp||260,o.gold||100,
      {intro:o.battleIntro,victory:o.victory,loot:[{id:'haven_supplies',count:2}],effects:[F('hb_'+p.id+'_mark'),I('hb_mark_'+p.id)]});
    const finish=step('Return to '+C.heroes[p.id].name+' at Wayfarer Haven.',id+'_done','hearth_haven',id+'_start',{dialogue:id+'_finish'});
    mission({id,name:o.name,arc:p.id,order:3,zone:'hearth_haven',slot:contacts[p.id],npc:C.heroes[p.id].name,hero:p.id,level:p.level,requires:R(o.previous),
      summary:o.summary,intro:o.intro,steps:[guard,projectStep(p.id),finish],reward:'2 Haven Supplies from the guardian; '+(o.gold||100)+' battle crowns; 150 closing crowns; '+C.items[o.gear].name+'; '+p.name+' complete.',
      finishRequires:R(id+'_started',clear,'project_'+project+'_1'),finishLines:o.lines,finishEffects:[F(p.done),I(o.gear),G(150)],finishChoices:o.choices||[],
      after:o.after||['The '+project+' is open. The hearthmark belongs to the people whose work made it.','Tallow cannot take that work merely by writing a price beside it.']});
  }
  // Mira learns to leave room for another maker's imperfect first attempt.
  const miraPath=field('hearth_mira_lane','hb_mira_path','The Tangled Return Spring','B','mira',[
    'Mira cuts the wire that holds the street clock to its last minute. The hands move without pulling the lane behind them.','An upper door opens. Someone has been trying to finish a clock inside it.'
  ],R('hb_mira_measure_started'));
  const miraTickets=read('hearth_mira_lane','hb_mira_tickets','The Two Repair Tickets','C',[
    'One ticket charges Teren for a failed first attempt. The other charges her for the time spent correcting it.','Both bear Tallow\'s seal. The charge renews each time the street clock returns to the same minute.'
  ],R('hb_mira_path'));
  const miraMark=read('hearth_mira_loft','hb_mira_first_mark','The Unfinished Maker\'s Mark','D',[
    'Teren has scratched her name beside a gear that runs a little slow. Below it is a much cleaner mark in Mira\'s old hand.','Mira remembers leaving that sample for a travelling repair class. She did not mean it to become a measure that every later maker had to equal.'
  ],R('hb_mira_path'));
  const miraFight=battle('hearth_mira_lane','hb_e_mira_minute','The Minute That Bills Twice','E',['hb_tick_mite','hb_brass_debt'],'hb_mira_minute_clear',R('hb_mira_tickets','hb_mira_first_mark'),5,65,35);
  const miraFirstEnd=close('hearth_mira_lane','hb_mira_bench','Teren at the Open Bench','F',[
    'Teren sets her slow gear beside Mira\'s old sample. It turns. The clock will need another adjustment, but the work is hers.',
    'Mira: My first gear was worse. I left the sample and forgot to leave the attempts that made it possible.',
    'They prepare teaching notes for Haven. The notes can show each mistake beside its correction, or put the corrections into a clear guide with the old attempts described.'
  ],R('hb_mira_minute_clear'),'hb_mira_measure',supplies(2,120),[
    branch('Show the mistakes beside the plans.','hb_mira_open_plans'),branch('Make a clear guide with repair notes.','hb_mira_clear_plans')]);
  mission({id:'hb_mira_measure',name:'A Minute of Her Own',arc:'mira',order:1,zone:'hearth_mira_lane',npc:'Teren the Menders\' Apprentice',level:5,requires:{chapterAtLeast:2},
    summary:'Free the street clock, compare the two repair tickets with the mark in the loft, and stop the repeating charge.',
    intro:['I can mend a clock, but I cannot finish paying for learning how. This street keeps giving me the same unpaid minute.','There is an old sample upstairs with Mira\'s name on it. Tallow says I must match it before I may call myself a maker. Ask her to free the return spring and look at what he is charging.'],
    steps:[miraPath,miraTickets,miraMark,miraFight,miraFirstEnd],reward:'2 Haven Supplies; 120 crowns; Teren\'s work recognised.',completionDialogue:'hb_mira_bench_talk',
    after:['The old sample is a lesson, not a price. Tovin keeps the unfinished workshop above the lane.']});
  const miraCircuit=mechanism('hearth_mira_loft','hb_mira_circuit','The Shared Work Circuit','B',
    {kind:'circuit',size:3,scramble:[0,1,4,8],goal:[0,0,0,0,0,0,0,0,0]},
    'Each lit lamp charges for a minute of work. Touch a lamp to switch it and its four edge neighbours. Turn all nine off so the bench can use a normal clock.',R('hb_mira_maker_started'));
  const miraTools=field('hearth_mira_loft','hb_mira_tools','The Bound Tool Roll','C','mira',[
    'Mira cuts the collector\'s strings from the tool roll. She leaves each tool where Teren can choose it.','Mira: Show me the part you want to try. I will hold the light.'
  ],R('hb_mira_maker_started','hb_mira_circuit'));
  const miraMakerFight=battle('hearth_mira_loft','hb_e_mira_workshop','The Seized Workshop','E',['hb_brass_debt','hb_tick_mite'],'hb_mira_workshop_clear',R('hb_mira_tools'),5,80,45);
  const miraMakerEnd=close('hearth_mira_loft','hb_mira_clock','Teren with Her First Clock','F',[
    'The clock keeps one full minute without borrowing the next. Teren asks Mira to leave the final screw for her.',
    'Mira waits while she fits it. The small pause is harder than doing the work herself.',
    'Teren can install this first clock over Haven\'s common bench or keep it in a travelling repair kit. Either way, she will write her own mark on it.'
  ],R('hb_mira_workshop_clear'),'hb_mira_maker',[...supplies(3,180),I('tonic',2)],
    [branch('Hang the first clock over the common bench.','hb_mira_common_clock'),branch('Pack the first clock in a travelling kit.','hb_mira_travel_clock')]);
  mission({id:'hb_mira_maker',name:'Leave the Last Screw',arc:'mira',order:2,zone:'hearth_mira_loft',npc:'Tovin the Bench Keeper',level:5,requires:R('hb_mira_measure_done'),
    summary:'Quiet the billing circuit, free the tools, and help Teren complete her first clock without taking the work from her.',
    intro:['The upper bench can keep its own time if we remove Tallow\'s meter. He has tied the tools to it as well.','Set the work circuit. Ask Mira to free the roll, then give Teren room to finish what she began.'],steps:[miraCircuit,miraTools,miraMakerFight,miraMakerEnd],reward:'3 Haven Supplies; 180 crowns; 2 Orchard Tonics; Teren\'s first completed clock.',completionDialogue:'hb_mira_clock_talk'});
  hearthEnd(plans[0],{name:'The Right to Begin Again',previous:'hb_mira_maker_done',guardian:'The Minute Bailiff',foes:['hb_minute_bailiff'],gear:'hb_mira_rule',
    summary:'Recover Mira\'s hearthmark from the Minute Bailiff. Build Haven\'s first workshop tier, then return to Mira.',
    intro:['Teren finished her clock. Tallow still holds the mark that says who may open the next bench. His bailiff is waiting in the loft.','I used to think a good repair left no sign of the maker\'s uncertainty. I want to build a workshop where people can ask for help before they hide a mistake.'],
    battleIntro:['The Minute Bailiff seals itself inside a perfect interval. Its guard lasts only a few seconds. Watch the opening and strike a weakness.','Mira: A finished sample does not own the hands that learn from it.'],victory:['The bailiff\'s clock ticks past its stamped minute. Mira\'s hearthmark drops onto the open bench.'],
    lines:['Teren hangs a new work rule beside Haven\'s bench: you may begin before you know how to finish.','Mira: I cannot fix a person\'s whole future. I can leave tools, honest notes, and room to try. That is work I know how to do.','The first workshop is open. Mira gives you the measuring rule she used to hold against every new attempt.']});
  battle('hearth_mira_lane','hb_e_mira_spare','A Clock Left Waiting','D',['hb_tick_mite','hb_tick_mite'],'hb_mira_spare_clear',R('hb_mira_measure_done'),5,65,45,{loot:[{id:'ether',count:1}]});
  // Soren hears a silence that his own answer must not replace.
  const sorenPath=field('hearth_soren_bank','hb_soren_path','The Muffled Well Rope','B','soren',[
    'Soren sounds the rope without striking the great bell above it. A small note answers from below the steps.','He leaves a full breath before the next note. The water lowers around a stair.'
  ],R('hb_soren_listen_started'));
  const sorenLedger=read('hearth_soren_bank','hb_soren_ledger','The Guest Ledger','C',[
    'The old inn charged for a room and a meal. Tallow has added a fee for every answer the guests gave while they stayed.','A guest called Kett stopped speaking. The collector then charged for the unanswered questions.'
  ],R('hb_soren_path'));
  const sorenGlass=read('hearth_soren_well','hb_soren_glass','The Glass of Held Breath','D',[
    'A breath moves inside the glass. It belongs to Kett. The label calls it a deposit on a voice that has not been returned.','Soren reaches for a clear note, then lowers his bell. The breath is not asking him to sing over it.'
  ],R('hb_soren_path'));
  const sorenFirstFight=battle('hearth_soren_bank','hb_e_soren_steps','The Unpaid Answer','E',['hb_silt_mouth','hb_echo_rent'],'hb_soren_steps_clear',R('hb_soren_ledger','hb_soren_glass'),5,65,35);
  const sorenFirstEnd=close('hearth_soren_bank','hb_soren_room_plan','Hessa at the Inn Sign','F',[
    'Hessa takes the new fees out of the guest book. A page remains for what a traveller needs, with no price beside a reply.',
    'Soren: I thought a silent room meant my bell had failed. Sometimes it means a person needs a quiet place before they can answer.',
    'Haven\'s inn can begin with a quiet sitting room or a table where guests share a song when they choose.'
  ],R('hb_soren_steps_clear'),'hb_soren_listen',supplies(2,120),[
    branch('Prepare a quiet sitting room.','hb_soren_quiet_room'),branch('Prepare a table for shared songs.','hb_soren_song_table')]);
  mission({id:'hb_soren_listen',name:'The Note after the Bell',arc:'soren',order:1,zone:'hearth_soren_bank',npc:'Hessa the Inn Keeper',level:5,requires:{chapterAtLeast:2},
    summary:'Sound the well rope, read the guest ledger and the held breath below, then stop the collector\'s charge for an answer.',
    intro:['Our old inn crossed into this bank during the night. Tallow met the guests before we could open the doors.','Kett lost his voice trying to explain where he belonged. Soren may hear what is held in the well. Please ask him to leave time for an answer.'],
    steps:[sorenPath,sorenLedger,sorenGlass,sorenFirstFight,sorenFirstEnd],reward:'2 Haven Supplies; 120 crowns; the guests\' false fees removed.',completionDialogue:'hb_soren_room_plan_talk'});
  const sorenWater=mechanism('hearth_soren_well','hb_soren_water','The Three Listening Basins','B',
    {kind:'sluice',initial:[0,0,0],target:[2,1,3],capacity:6,total:6,labels:['Guest basin','Well return','Song channel']},
    'Give two units to the guest basin and one to the well return. The song channel takes the remaining three. All six must move without drawing breath from the glass.',R('hb_soren_guest_started'));
  const sorenGuestBell=field('hearth_soren_well','hb_soren_guest_bell','The Unanswered Guest Bell','C','soren',[
    'Soren sounds one note, then keeps his hand away from the bell. The held breath returns through the guest basin.','Kett takes it slowly. His first word is wait. Soren waits.'
  ],R('hb_soren_water'));
  const sorenGuestFight=battle('hearth_soren_well','hb_e_soren_voice','The Voice Held as Deposit','E',['hb_echo_rent','hb_echo_rent'],'hb_soren_voice_clear',R('hb_soren_guest_bell'),5,80,45,
    {victory:['The last deposit seal breaks. Kett keeps his voice even when he chooses not to speak.']});
  const sorenGuestEnd=close('hearth_soren_well','hb_soren_kett','Kett with His Own Voice','F',[
    'Kett: I will tell you what happened. I would like to eat first. I have been making every answer do the work of a meal.',
    'Soren puts the bell in its case. Hessa asks where Kett would like to spend the evening at Haven.',
    'He can have a quiet room to himself or a place at the supper table. Neither choice needs another explanation.'
  ],R('hb_soren_voice_clear'),'hb_soren_guest',[...supplies(3,180),I('panacea',2)],[
    branch('Offer Kett a quiet room first.','hb_kett_quiet'),branch('Offer Kett a seat at supper first.','hb_kett_supper')]);
  mission({id:'hb_soren_guest',name:'A Guest Who Can Say No',arc:'soren',order:2,zone:'hearth_soren_well',npc:'Hessa at the Listening Basins',level:5,requires:R('hb_soren_listen_done'),
    summary:'Set the listening basins, let Kett answer the guest bell, and break the deposit seals around his voice.',
    intro:['The glass can open without losing the breath inside it. The three basins need a measured flow.','Set their shares. Ask Soren to ring the guest bell once. The next sound must belong to Kett.'],steps:[sorenWater,sorenGuestBell,sorenGuestFight,sorenGuestEnd],reward:'3 Haven Supplies; 180 crowns; 2 Clear Dew; Kett\'s voice returned.',completionDialogue:'hb_soren_kett_talk'});
  hearthEnd(plans[1],{name:'The Door That Asks No Answer',previous:'hb_soren_guest_done',guardian:'The Borrowed Choir',foes:['hb_borrowed_choir','hb_silent_guest','hb_silent_guest'],gear:'hb_soren_key',
    summary:'Free Soren\'s hearthmark from the Borrowed Choir. Build Haven\'s first inn tier, then speak to Soren at the hearth.',
    intro:['Kett\'s voice is his again. The collector still holds the inn\'s guest mark in a choir at the well.','I have spent years thinking a keeper must always know what to say. I want our inn to welcome the person who does not have an answer yet.'],
    battleIntro:['Two Silent Guest Seals protect the Borrowed Choir. Remove them, then interrupt its long healing refrain.','Soren: A guest may stay quiet. You do not own the breath between their words.'],victory:['The choir stops charging for its own echoes. The guest hearthmark rises from the well.'],
    lines:['Hessa opens the first inn room. Kett turns its key once, only to test that it works from the inside.','Soren: A bell can call people here. It cannot tell them what being here should mean. I will listen for that part.','Soren gives you a spare guest key. No ledger records the gift as a debt.']});
  battle('hearth_soren_bank','hb_e_soren_pool','The Last Unasked Question','D',['hb_silt_mouth','hb_silt_mouth'],'hb_soren_pool_clear',R('hb_soren_listen_done'),5,65,45,{loot:[{id:'phoenix',count:1}]});
  // Brann turns a guard's strength toward a view that has no enemy in it.
  const brannPath=field('hearth_brann_yard','hb_brann_path','The Leaning Tower Foot','B','brann',[
    'Brann takes the tower\'s weight while Edda sets the lower pin. The frame settles on its own foot.','A workshop door opens behind it. Brann steps away before the new support has to depend on him.'
  ],R('hb_brann_frame_started'));
  const brannOrder=read('hearth_brann_yard','hb_brann_order','The Wall Order','C',[
    'The frame was made for an observatory. Tallow has ordered it broken into a wall, with a charge for each opening left in it.','Brann knows every joint on the plan. The same strong frame can carry a roof, a weapon, or a clear view. The plan does not choose for its maker.'
  ],R('hb_brann_path'));
  const brannStars=read('hearth_brann_furnace','hb_brann_stars','The Child\'s Star Sheet','D',[
    'Nemi drew the sky above Haven on six different nights. The town changed ages between each drawing.','At the bottom she asks: when the house moves again, which star will still be there? No one has answered her with a view she can check.'
  ],R('hb_brann_path'));
  const brannFrameFight=battle('hearth_brann_yard','hb_e_brann_frame','The Frame under Claim','E',['hb_scrap_due','hb_cinder_stamp'],'hb_brann_frame_clear',R('hb_brann_order','hb_brann_stars'),7,85,45);
  const brannFrameEnd=close('hearth_brann_yard','hb_brann_view_plan','Edda beside the Open Frame','F',[
    'Edda removes the wall order. Brann sets Nemi\'s star sheet where the builders will see it before they cut a beam.',
    'Brann: I have spent a long time making places hard to enter. I would like this one to be easy to look out of.',
    'The Haven observatory can begin with a wide public stair or a low viewing deck for people who need an easier approach.'
  ],R('hb_brann_frame_clear'),'hb_brann_frame',supplies(2,120),[
    branch('Build a wide stair with resting places.','hb_brann_wide_stair'),branch('Build a low deck with a clear horizon.','hb_brann_low_deck')]);
  mission({id:'hb_brann_frame',name:'A Frame for the Sky',arc:'brann',order:1,zone:'hearth_brann_yard',npc:'Edda the Tower Mender',level:7,requires:{chapterAtLeast:3},
    summary:'Brace the leaning tower, compare the wall order with Nemi\'s star sheet, and stop the frame from being seized.',
    intro:['This frame belonged above Haven. Tallow carried it into the ash and ordered a wall built from its beams.','Brann can hold the tower foot while we set a proper support. Ask him to read the wall order, then look at what the child left in the forge.'],
    steps:[brannPath,brannOrder,brannStars,brannFrameFight,brannFrameEnd],reward:'2 Haven Supplies; 120 crowns; an observatory plan chosen.',completionDialogue:'hb_brann_view_plan_talk'});
  const brannMirrors=mechanism('hearth_brann_furnace','hb_brann_alignment','The Starframe Alignment Mirrors','B',
    {kind:'mirror',initial:[0,0,0,0],target:[0,1,2,3],labels:['North post','Morning shade','South brace','Evening weight']},
    'The north post faces North. The morning shade faces sunrise, East. The south brace faces South. The evening weight faces sunset, West.',R('hb_brann_star_started'));
  const brannLens=field('hearth_brann_furnace','hb_brann_lens','The Cooling Lens Frame','C','brann',[
    'Brann holds the frame still while the new metal cools. He eases his grip when the glass begins to settle.','Nemi: I thought you would need a heavier hammer. Brann: This part needs me to stop using one.'
  ],R('hb_brann_alignment'));
  const brannForgeFight=battle('hearth_brann_furnace','hb_e_brann_forge','The Tower Made into a Wall','E',['hb_scrap_due','hb_scrap_due'],'hb_brann_forge_clear',R('hb_brann_lens'),7,95,50);
  const brannStarEnd=close('hearth_brann_furnace','hb_brann_first_view','Nemi at the First Lens','F',[
    'Nemi looks through the finished lens. The first thing she names is a star, not a threat beyond the ridge.',
    'Brann stands beside her until she finds the next one herself. His hands have made something useful that no one has to fear.',
    'Haven can keep a book of night drawings or a daily weather chart beside the telescope. Both will leave room for a new observer.'
  ],R('hb_brann_forge_clear'),'hb_brann_star',[...supplies(3,180),I('phoenix',2)],[
    branch('Start a book of night drawings.','hb_brann_starbook'),branch('Start a public weather chart.','hb_brann_weatherbook')]);
  mission({id:'hb_brann_star',name:'The Tool That Does Not Strike',arc:'brann',order:2,zone:'hearth_brann_furnace',npc:'Nemi the Sky Watcher',level:7,requires:R('hb_brann_frame_done'),
    summary:'Align the starframe mirrors, hold the lens while it cools, and free the telescope\'s last beams.',
    intro:['Edda says the frame can hold a telescope if its four sides share the same sky. The mirrors have the directions on them.','After that, Brann can hold the new lens frame. I want to be the first to look through something he made.'],steps:[brannMirrors,brannLens,brannForgeFight,brannStarEnd],reward:'3 Haven Supplies; 180 crowns; 2 Dawn Salt; Nemi\'s first clear view.',completionDialogue:'hb_brann_first_view_talk'});
  hearthEnd(plans[2],{name:'A Window Left Open',previous:'hb_brann_star_done',guardian:'The Windowless Palisade',foes:['hb_windowless_wall','hb_rivet_keeper'],gear:'hb_brann_window',xp:290,gold:110,
    summary:'Take Brann\'s hearthmark from the Windowless Palisade. Build Haven\'s first observatory tier, then return to Brann.',
    intro:['Nemi has a lens. Tallow has placed a wall around the mark that lets us raise it over Haven.','I know how to bring a wall down. This time I want to keep the useful beams standing when the fight is over.'],
    battleIntro:['One Claim Rivet protects the palisade. Remove it before striking the main frame.','Brann: Strength is not a reason to close every opening.'],victory:['The claim rivet falls. Brann catches the lower beam so the open frame remains standing.'],
    lines:['The observatory opens over Haven. Nemi takes her first watch with Edda beside her, and Brann below checking a joint that already holds.','Brann: I can leave this place in other hands. A good support should not make people need the builder forever.','He gives you the Starframe Clasp. The town keeps the window.']});
  battle('hearth_brann_yard','hb_e_brann_spare','The Last Unused Beam','D',['hb_cinder_stamp','hb_scrap_due'],'hb_brann_spare_clear',R('hb_brann_frame_done'),7,85,55,{loot:[{id:'ether',count:2}]});
  // Ilex protects the right of the next keeper to grow a different garden.
  const ilexPath=field('hearth_ilex_path','hb_ilex_path','The Mortgaged Hedge','B','ilex',[
    'Ilex grows a new shoot around the collector\'s wire. The old hedge keeps its roots while a path opens beside it.','Suri touches the leaves on both sides. The new path did not require the old hedge to disappear.'
  ],R('hb_ilex_graft_started'));
  const ilexList=read('hearth_ilex_path','hb_ilex_list','The Seed Debt List','C',[
    'The list charges Suri for fruit from trees she has not planted. Tallow calls each seed a promise of a crop that already belongs to him.','Ilex finds no limit on the claim. A young keeper could work her whole life and still be billed for another spring.'
  ],R('hb_ilex_path'));
  const ilexTree=read('hearth_ilex_orchard','hb_ilex_tree','The Tree without a Label','D',[
    'One young tree has leaves that Ilex does not know. Suri grew it from a seed that came through Haven\'s moving door.','The old plant book has no place for it. Suri kept it anyway and wrote down what it needed each day.'
  ],R('hb_ilex_path'));
  const ilexFirstFight=battle('hearth_ilex_path','hb_e_ilex_hedge','The Hedge Already Sold','E',['hb_claim_seed','hb_pale_grazer'],'hb_ilex_hedge_clear',R('hb_ilex_list','hb_ilex_tree'),7,85,45);
  const ilexFirstEnd=close('hearth_ilex_path','hb_ilex_bed_names','Suri at the Young Bed','F',[
    'Ilex leaves the unknown tree in its bed. The notes show that Suri has cared for it well without finding an older name to make that care valid.',
    'Ilex: I remember many gardens. That does not give me the right to choose every garden that comes after them.',
    'Haven\'s new beds can carry the old keepers\' names or names chosen by the people who will tend them now.'
  ],R('hb_ilex_hedge_clear'),'hb_ilex_graft',supplies(2,120),[
    branch('Keep the old keepers\' names on the beds.','hb_ilex_old_names'),branch('Let the new keepers name their beds.','hb_ilex_new_names')]);
  mission({id:'hb_ilex_graft',name:'A Garden Not Yet Written',arc:'ilex',order:1,zone:'hearth_ilex_path',npc:'Suri the Young Keeper',level:7,requires:{chapterAtLeast:3},
    summary:'Open the mortgaged hedge, read the seed debts, and inspect the unknown tree before clearing the sold path.',
    intro:['I planted one seed from Haven. Tallow says I owe him every fruit it might bear. I do not even know what its fruit will be.','Ask Ilex to open the hedge gently. I want her to see the tree before anyone decides what kind of garden this must become.'],steps:[ilexPath,ilexList,ilexTree,ilexFirstFight,ilexFirstEnd],reward:'2 Haven Supplies; 120 crowns; Suri\'s garden recognised.',completionDialogue:'hb_ilex_bed_names_talk'});
  const ilexWater=mechanism('hearth_ilex_orchard','hb_ilex_water','The Young Orchard Water Share','B',
    {kind:'sluice',initial:[0,0,0],target:[3,2,1],capacity:6,total:6,labels:['Old root bed','Young graft','Open runoff']},
    'The old roots need three units. The young graft needs two. The open runoff takes the final one. Keep a return flow instead of drawing the whole river into the orchard.',R('hb_ilex_seed_started'));
  const ilexGraft=field('hearth_ilex_orchard','hb_ilex_graft','The Joining Graft','C','ilex',[
    'Ilex joins the new tree to a healthy root. She leaves its own upper branches untouched.','The graft shares water without changing the new leaves into the old kind. Suri marks the join so the next keeper can inspect it.'
  ],R('hb_ilex_water'));
  const ilexSecondFight=battle('hearth_ilex_orchard','hb_e_ilex_fruit','The Crop Collected in Advance','E',['hb_claim_seed','hb_pale_grazer'],'hb_ilex_fruit_clear',R('hb_ilex_graft'),7,95,50);
  const ilexSecondEnd=close('hearth_ilex_orchard','hb_ilex_first_fruit','Suri with the First Fruit','F',[
    'The young tree opens one bright fruit. It is smaller than the debt list promised and large enough for the people beside it to share.',
    'Suri asks what Ilex would choose. Ilex asks what Suri wants to learn from this first season.',
    'They can take fruit to Haven\'s cooking table or prepare a seed store for the next keeper.'
  ],R('hb_ilex_fruit_clear'),'hb_ilex_seed',supplies(3,180),[
    branch('Share the fruit. Receive 4 Sun Fruit.','hb_ilex_shared_fruit',undefined,[I('ingredient_fruit',4)]),branch('Keep a seed store. Receive 1 Haven Supply.','hb_ilex_seed_store',undefined,[I('haven_supplies',1)])]);
  mission({id:'hb_ilex_seed',name:'A Fruit in Its Own Season',arc:'ilex',order:2,zone:'hearth_ilex_orchard',npc:'Juna the Root Tender',level:7,requires:R('hb_ilex_graft_done'),
    summary:'Give the orchard a measured water share, join the young tree to a healthy root, and protect its first fruit.',
    intro:['The old root bed has room to help Suri\'s tree. It must keep a return flow to the forest as well.','Set the water share. Ask Ilex to make a careful graft. We need to support the young tree without making it a copy of the old one.'],steps:[ilexWater,ilexGraft,ilexSecondFight,ilexSecondEnd],reward:'3 Haven Supplies; 180 crowns; a first harvest or an extra seed-store supply.',completionDialogue:'hb_ilex_first_fruit_talk'});
  hearthEnd(plans[3],{name:'The Keeper after Me',previous:'hb_ilex_seed_done',guardian:'The Harvest before Spring',foes:['hb_early_harvest'],gear:'hb_ilex_seedcase',xp:290,gold:110,
    summary:'Release Ilex\'s hearthmark from the Harvest before Spring. Build Haven\'s first garden tier, then speak to Ilex.',
    intro:['Suri\'s first season belongs to her. The collector has gathered every later claim into a thing growing at the orchard\'s heart.','I want to leave a healthy garden, not an order that every future keeper must obey. Help me free the mark, then give Haven a bed its own people can tend.'],
    battleIntro:['The Harvest tries to heal by taking fruit from a future season. Interrupt that long call or prepare for a longer fight.','Ilex: A seed is not a debt to the person who planted it.'],victory:['The future crop falls from the claim. One ordinary seed remains beside Ilex\'s hearthmark.'],
    lines:['The Haven garden has its first tended beds. Suri leaves a blank page after the notes for the tree Ilex did not know.','Ilex: I can remember where a root began without deciding where every branch must end. The next keeper will have work of their own.','She gives you the Unclaimed Seedcase. The garden keeps the seed and the open page.']});
  battle('hearth_ilex_path','hb_e_ilex_spare','The Fence around Tomorrow','D',['hb_claim_seed','hb_claim_seed'],'hb_ilex_spare_clear',R('hb_ilex_graft_done'),7,85,55,{loot:[{id:'panacea',count:2}]});
  // Nyx gives a living witness the last word about the record that describes her.
  const nyxPath=field('hearth_nyx_steps','hb_nyx_path','The Inked Stair','B','nyx',[
    'Nyx follows the steps that the ink tried to hide. A second stair appears beside the approved one.','The new stair leads to files that Tallow could not make fit a single price.'
  ],R('hb_nyx_margin_started'));
  const nyxPrices=read('hearth_nyx_steps','hb_nyx_prices','The Price List for Names','C',[
    'The list puts a price on a person\'s birthplace, trade, and last known address. A change in any entry creates a new debt.','Nyx finds an empty line where a person could explain why they changed. Tallow has marked the empty line as an error.'
  ],R('hb_nyx_path'),[],{hideIf:R('hb_nyx_name_started')});
  const nyxTwoHands=read('hearth_nyx_vault','hb_nyx_two_hands','The File Written in Two Hands','D',[
    'An old clerk wrote a complete life for Yela before meeting her. Yela has added a different account between its lines.','Neither hand has vanished. The living account is the one Tallow refuses to read.'
  ],R('hb_nyx_path'));
  const nyxFirstFight=battle('hearth_nyx_steps','hb_e_nyx_record','An Unapproved Name','E',['hb_ink_price','hb_margin_blade'],'hb_nyx_record_clear',R('hb_nyx_prices','hb_nyx_two_hands'),9,105,55);
  const nyxFirstEnd=close('hearth_nyx_steps','hb_nyx_first_page','Amri at the Open Page','F',[
    'Amri leaves the empty line in the register. It has become a place for an answer rather than a reason to reject the record.',
    'Nyx: I know how to play a part someone else wrote. I would like a room where people can say when that part is wrong.',
    'Haven\'s archive can begin with writing desks for its witnesses or a listening table where a keeper records the words they choose.'
  ],R('hb_nyx_record_clear'),'hb_nyx_margin',supplies(2,120),[
    branch('Give witnesses their own writing desks.','hb_nyx_writing_desks'),branch('Set a listening table with a keeper.','hb_nyx_listening_table')]);
  mission({id:'hb_nyx_margin',name:'Room beside the Written Life',arc:'nyx',order:1,zone:'hearth_nyx_steps',npc:'Amri the Page Binder',level:9,requires:{chapterAtLeast:4},
    summary:'Reveal the second stair, compare the price list with Yela\'s two-handed file, and keep the correction from being erased.',
    intro:['Tallow keeps a price list where our resident book should be. Yela tried to correct it and was filed as an unpaid change.','Ask Nyx to read the hidden stair. The old file and the living reply are both inside. We need to preserve enough of each to show what happened.'],steps:[nyxPath,nyxPrices,nyxTwoHands,nyxFirstFight,nyxFirstEnd],reward:'2 Haven Supplies; 120 crowns; a place for witnesses to answer.',completionDialogue:'hb_nyx_first_page_talk'});
  const nyxMirrors=mechanism('hearth_nyx_vault','hb_nyx_register','The Four-Sided Register','B',
    {kind:'mirror',initial:[0,0,0,0],target:[3,1,0,2],labels:['Old account','Living reply','Witness','Open margin']},
    'Place the old account toward sunset, West. The living reply faces sunrise, East. The witness faces North. Leave the open margin toward South.',R('hb_nyx_name_started'));
  const nyxFace=field('hearth_nyx_vault','hb_nyx_face','The Borrowed Description','C','nyx',[
    'Nyx lifts the description from the reflection. Yela remains when the approved outline disappears.','Yela: I thought I would have to lose the old record to stop living inside it. Nyx: You can keep a record and still be the person who corrects it.'
  ],R('hb_nyx_register'));
  const nyxSecondFight=battle('hearth_nyx_vault','hb_e_nyx_file','The File That Will Not Close','E',['hb_margin_blade','hb_ink_price'],'hb_nyx_file_clear',R('hb_nyx_face'),9,120,65);
  const nyxSecondEnd=close('hearth_nyx_steps','hb_nyx_correction','Yela at the Correction Table','C',[
    'Yela returns to the public stair with both versions of her file. She reads her own account all the way through.',
    'Nyx waits beside the table. She does not change a word to make the story easier for the people listening.',
    'Yela chooses how to keep the result: the old file with her correction visible, or a fresh volume with the old account preserved in its appendix.'
  ],R('hb_nyx_file_clear'),'hb_nyx_name',[...supplies(3,180),I('ether',2)],[
    branch('Keep the correction beside the old file.','hb_nyx_corrected_file'),branch('Open a fresh volume with an appendix.','hb_nyx_new_volume')]);
  mission({id:'hb_nyx_name',name:'The Name She Carries',arc:'nyx',order:2,zone:'hearth_nyx_vault',npc:'Yela beside the Unclaimed Files',level:9,requires:R('hb_nyx_margin_done'),
    summary:'Align the register, free Yela from the borrowed description, then return to the Paper Stair to enter her correction.',
    intro:['I know which parts of the old file happened. I also know where it stopped listening to me.','Turn the register so both accounts can be seen. Ask Nyx to remove the borrowed description. I want to walk back to the stair and write the next line myself.'],steps:[nyxMirrors,nyxFace,nyxSecondFight,nyxSecondEnd],reward:'3 Haven Supplies; 180 crowns; 2 Blue Nectar; Yela\'s living correction.',completionDialogue:'hb_nyx_correction_talk'});
  hearthEnd(plans[4],{name:'No Last Word on a Life',previous:'hb_nyx_name_done',guardian:'The Final Version',foes:['hb_final_version'],gear:'hb_nyx_margin',xp:320,gold:130,
    summary:'Recover Nyx\'s hearthmark from the Final Version. Build Haven\'s first archive tier, then return to Nyx.',
    intro:['Yela made her correction. Tallow\'s final seal is still trying to close every file at the same last page.','I want Haven to keep its memory without turning it into another part that the living must perform. Help me bring back the mark for its archive.'],
    battleIntro:['The Final Version borrows brief guard and haste effects. Wait for a gap or use a learned dispel. Follow its new weakness when the page turns.','Nyx: You can finish a page. You cannot finish a person.'],victory:['The final seal breaks. The book remains open, with Nyx\'s hearthmark beside its next blank page.'],
    lines:['Yela places her chosen record on the Haven shelf. The archive leaves space beside every file for a correction made later.','Nyx: I once thought an empty margin meant I had been left out. It can also mean the next line belongs to me.','She gives you the Living Margin. Its first line is yours to write.']});
  battle('hearth_nyx_steps','hb_e_nyx_spare','The Price of a Second Draft','D',['hb_ink_price','hb_ink_price'],'hb_nyx_spare_clear',R('hb_nyx_margin_done'),9,105,65,{loot:[{id:'phoenix',count:1}]});
  // Vale carries a person's answer, with enough time for the person to give it.
  const valePath=field('hearth_vale_mast','hb_vale_path','The Dead Return Mast','B','vale',[
    'Vale restores the receiver before the main beacon. A faint reply comes back from the patient station.','The mast opens its service road. The arrival meter can no longer pretend a sent signal is the same as an answer.'
  ],R('hb_vale_reply_started'),[],R('hb_vale_passenger_started'));
  const valeReceipt=read('hearth_vale_mast','hb_vale_receipt','The Receipt without an Answer','C',[
    'Every delivery is marked complete at the moment it leaves the mast. The return column is blank.','Tallow charges the receivers for not answering, even when the network gives them no way to do it.'
  ],R('hb_vale_path'));
  const valeLetter=read('hearth_vale_station','hb_vale_unsent','The Last Unsent Reply','D',[
    'Avi wrote: I can reach the dock if someone walks the slow part with me. Please tell the boat not to leave yet.','The letter has passed its deadline. Vale turns it over and finds no place where the receiver was allowed to change that deadline.'
  ],R('hb_vale_path'));
  const valeFirstFight=battle('hearth_vale_mast','hb_e_vale_notice','The Notice Nobody Received','E',['hb_deadline_hound','hb_return_static'],'hb_vale_notice_clear',R('hb_vale_receipt','hb_vale_unsent'),9,105,55);
  const valeFirstEnd=close('hearth_vale_mast','hb_vale_call_plan','Pem at the Reply Board','F',[
    'Pem opens the return column. The first message is Avi\'s request for enough time to reach the dock.',
    'Vale: I counted the things I delivered because the count kept moving. I should have asked whether anyone could answer.',
    'Haven\'s dock can use long pauses between calls or a public call schedule that lets people choose when to be there.'
  ],R('hb_vale_notice_clear'),'hb_vale_reply',supplies(2,120),[
    branch('Leave long pauses between dock calls.','hb_vale_long_calls'),branch('Post a public schedule for dock calls.','hb_vale_call_schedule')]);
  maps.hearth_vale_mast.entities.find(e=>e.id==='hb_vale_call_plan').hideIf=R('hb_vale_passenger_started');
  mission({id:'hb_vale_reply',name:'Delivery Is Not Arrival',arc:'vale',order:1,zone:'hearth_vale_mast',npc:'Pem the Waiting Receiver',level:9,requires:{chapterAtLeast:4},
    summary:'Restore the return mast, compare its receipts with Avi\'s unsent reply, and open a line that the station can answer.',
    intro:['The mast sends messages all day. It calls every one a success before anyone can answer.','Avi is waiting at the patient station. Ask Vale to restore the return side. Then read her letter before you decide what the next delivery needs.'],steps:[valePath,valeReceipt,valeLetter,valeFirstFight,valeFirstEnd],reward:'2 Haven Supplies; 120 crowns; a working reply channel.',completionDialogue:'hb_vale_call_plan_talk'});
  const valeCircuit=mechanism('hearth_vale_station','hb_vale_deadlines','The Waiting-Time Circuit','B',
    {kind:'circuit',size:3,scramble:[2,3,4,6],goal:[0,0,0,0,0,0,0,0,0]},
    'Each lit square adds a charge while a passenger waits. A press changes itself and its four edge neighbours. Darken all nine before opening the station door.',R('hb_vale_passenger_started'));
  const valeContact=field('hearth_vale_station','hb_vale_contact','The Passenger Return Contact','C','vale',[
    'Vale connects the contact beside Avi\'s bench. The mast hears her whole reply before it prints a receipt.','Avi asks to use the slow service road. Vale marks it as the route, not a delay from the route.'
  ],R('hb_vale_deadlines'));
  const valeSecondFight=battle('hearth_vale_station','hb_e_vale_station','The Deadline at the Door','E',['hb_deadline_hound','hb_return_static'],'hb_vale_station_clear',R('hb_vale_contact'),9,120,65);
  const valeArrival=field('hearth_vale_mast','hb_vale_arrival','The Arrival Beacon','B','vale',[
    'Vale sets the beacon to wait for Avi at the end of the slow road. It remains steady through the old departure time.','Avi reaches the mast, sits down, and answers the final call herself. The receipt prints only after her answer.'
  ],R('hb_vale_station_clear'));
  const valeSecondEnd=close('hearth_vale_mast','hb_vale_avi','Avi at the Arrival Bench','F',[
    'Avi rests at the bench. The trip took longer than the old schedule allowed and exactly as long as this passenger needed.',
    'Vale: I can be fast when speed helps. I do not need to make every person prove they can keep up.',
    'Haven can begin with quiet passenger departures or a shared cargo-and-passenger day with extra hands at the dock.'
  ],R('hb_vale_arrival'),'hb_vale_passenger',[...supplies(3,180),I('panacea',2)],[
    branch('Keep quiet passenger departures.','hb_vale_quiet_departures'),branch('Share a cargo-and-passenger workday.','hb_vale_shared_departures')]);
  mission({id:'hb_vale_passenger',name:'A Passenger Is Not a Parcel',arc:'vale',order:2,zone:'hearth_vale_station',npc:'Avi at the Shelter Bench',level:9,requires:R('hb_vale_reply_done'),
    summary:'Clear the station\'s waiting charges, power Avi\'s return contact, then return to the mast and hold the arrival beacon for her.',
    intro:['I do not need someone to carry me like freight. I need the boat to wait while I walk the road I can manage.','Set the waiting circuit and the return contact. Then meet me at the arrival beacon. I want the last reply on that receipt to be mine.'],steps:[valeCircuit,valeContact,valeSecondFight,valeArrival,valeSecondEnd],reward:'3 Haven Supplies; 180 crowns; 2 Clear Dew; Avi\'s completed journey.',completionDialogue:'hb_vale_avi_talk'});
  hearthEnd(plans[5],{name:'Until the Answer Comes',previous:'hb_vale_passenger_done',guardian:'The Last Call',foes:['hb_last_call','hb_address_cell'],gear:'hb_vale_reply',xp:320,gold:130,
    summary:'Recover Vale\'s hearthmark from the Last Call. Build Haven\'s first dock tier, then speak to Vale beside the new route.',
    intro:['Avi reached the mast. Tallow has answered by sending one last deadline against the dock mark.','I will help Haven make a schedule that can hear an answer. First we need to take the mark out of the machine that keeps calling over it.'],
    battleIntro:['The Address Cell protects the Last Call. Remove it, then watch the long Final Notice charge. A weakness hit during casting builds extra pressure.','Vale: You sent the notice. That does not mean we agreed to its terms.'],victory:['The Last Call runs out of notices. Vale waits until its return light is dark before lifting the hearthmark.'],
    lines:['The Haven dock opens. Its first receipt carries a departure time, an arrival time, and an answer from the person who travelled.','Vale: The road does not become useful because I can finish it quickly. It becomes useful when someone can get where they meant to go.','He gives you the Answered Signal. It has a place for the reply.']});
  battle('hearth_vale_mast','hb_e_vale_spare','The Reply Sold Twice','D',['hb_return_static','hb_return_static'],'hb_vale_spare_clear',R('hb_vale_reply_done'),9,105,65,{loot:[{id:'ether',count:2}]});
  // The town assembles its own evidence. The final reply uses all six finished arcs.
  const statements={
    mira:['The tools were given. The plans were shared. No one agreed to owe Tallow for the time it took to learn.','Mira puts Teren\'s first maker\'s mark beside her own. Two makers can name their work without one owning the other.'],
    soren:['The guests paid for a room and a meal. Their voices were never part of the bill.','Soren opens Hessa\'s old guest book. Kett adds one sentence in his own hand: I am here because I chose to stay.'],
    brann:['The observatory was made to hold a view. A wall order written later does not change the reason people gave it their work.','Brann adds Nemi\'s star sheet to the notice. The person who uses a thing can say what its repair was for.'],
    ilex:['No keeper can promise fruit from every spring that follows them. The collector priced a future no one had agreed to sell.','Ilex adds Suri\'s notes about the unknown tree. Living care leaves room for a season it cannot predict.'],
    nyx:['A file can record an agreement. It cannot create one by refusing to hear the person it describes.','Nyx places Yela\'s correction over the price list. She leaves both dates visible so no one has to take the conclusion on trust.'],
    vale:['Sending a notice is not receiving an answer. The return column proves that Tallow charged people he would not let reply.','Vale adds Avi\'s completed receipt. Its last mark belongs to the traveller who actually arrived.']
  };
  const statementSteps=[];
  for(const p of plans){const id='hb_statement_'+p.id,after='hb_'+p.id+'_hearth_after';
    C.dialogues[id]={speaker:C.heroes[p.id].name,hero:p.id,lines:statements[p.id],onceFlag:id+'_seen',onRepeat:after,effects:[F(id)]};
    C.dialogues[after].variants=[{requires:{flags:['hb_final_survey_started'],notFlags:[id]},dialogue:id}];
    statementSteps.push(step('Hear '+C.heroes[p.id].name+'\'s statement for the common notice.',id,'hearth_haven','hb_'+p.id+'_hearth_start',{dialogue:id}));
  }
  const finalNotice=close('hearth_haven','hb_final_notice','Dessa at the Common Notice','B',[
    'Six hearthmarks lie beside six statements. They describe gifts, paid work, care, and a right to answer. None grants Tallow ownership of the town.',
    'Dessa copies every source beside its conclusion. The town can show how it reached its answer.',
    'The notice can begin with the residents\' own words or with the copied records that prove the charges false. Both will travel with it.'
  ],R(...plans.map(p=>'hb_statement_'+p.id)),'hb_final_survey',supplies(4,200),[
    branch('Put the residents\' words on the first page.','hb_final_testimony'),branch('Put the checked records on the first page.','hb_final_records')]);
  maps.hearth_haven.entities.find(e=>e.id==='hb_final_notice').hideIf=R('hb_final_release_done');
  mission({id:'hb_final_survey',name:'Where the Doors Really Lead',arc:'finale',order:1,zone:'hearth_haven',slot:'C',npc:'Dessa at the Six Hearthmarks',level:14,requires:finalRequires,
    summary:'Hear all six travellers at Haven, then assemble the common notice from their statements and the recovered records.',
    intro:['The six first buildings are open. The town can feed a guest, keep a record, mend a tool, grow a seed, watch a sky, and receive an answer.','Tallow still holds the years he collected from every arrival. Before we face him, I want a notice that says what our work actually means. Speak to each traveller here. Bring their statements to the common board.'],
    steps:[...statementSteps,finalNotice],reward:'4 Haven Supplies; 200 crowns; the common notice and the claim door open.',completionDialogue:'hb_final_notice_talk',
    after:['The notice is complete. The Road under the Deeds lies in the Fold. We can now open the collector\'s inner door.']});
  const finalCircuit=mechanism('hearth_final_crossing','hb_final_return_grid','The Returning Claim Circuit','B',
    {kind:'circuit',size:3,scramble:[0,2,5,6,8],goal:[0,0,0,0,0,0,0,0,0]},
    'Each light sends the same fee around the road again. Touch a square to change it and its edge neighbours. Turn all nine off so each account can return to its own end.',R('hb_final_claim_started'));
  const finalSeam=field('hearth_final_crossing','hb_final_contract_seam','The Folded Contract Seam','C','mira',[
    'Mira cuts the binding thread along the seam. The records stay intact as the road stops feeding them back into the circuit.','Separate bundles appear. One holds signed agreements. The others carry only Tallow\'s repeated stamp.'
  ],R('hb_final_return_grid'));
  const finalFirstClaim=read('hearth_final_crossing','hb_final_first_claim','The First False Claim','D',[
    'Tallow was made to copy a town\'s deeds after a flood. The first page told him to record who had agreed to share each room.',
    'He added his own line: every room that passes through my hands belongs to me. No resident signed it.',
    'The collector kept Haven moving so the same doors would pass through his hands again. The debt grew because he would not let an arrival end.'
  ],R('hb_final_contract_seam'));
  const finalRoadFight=battle('hearth_final_crossing','hb_e_final_road','The Toll on the Last Step','E',['hb_wax_marshal','hb_receipt_swarm'],'hb_final_road_clear',R('hb_final_first_claim'),14,180,95,
    {intro:['A wax marshal bars the road while a swarm of receipts stamps the same step again.','Dessa: We brought the first page. We know whose line changed the account.'],victory:['The last step stays in place. The drawer of collected years is no longer moving out of reach.']});
  const finalClaimEnd=close('hearth_final_crossing','hb_final_recovered_packs','The Recovered Household Stores','F',[
    'The crew opens the store below the claim road. It holds food, medicine, and tools taken in place of fees the households never agreed to pay.',
    'Behind the stores, a drawer holds the stolen years as warm rings of wax. They can return to the town when the collector\'s last seal breaks.',
    'Send the first recovered packs equally to all six buildings, or send medicine and food to the inn\'s care room before dividing the rest.'
  ],R('hb_final_road_clear'),'hb_final_claim',supplies(6,250),[
    branch('Send the first packs to all six buildings.','hb_final_shared_packs',undefined,[I('ingredient_grain',4)]),branch('Send the first packs to the care room.','hb_final_care_packs',undefined,[I('ingredient_herb',4)])],[F('hb_false_claim_proved')]);
  mission({id:'hb_final_claim',name:'The Road Made of Receipts',arc:'finale',order:2,zone:'hearth_final_crossing',npc:'Tallow\'s Public Image',level:14,requires:R('hb_final_survey_done'),
    summary:'Stop the repeating fee circuit, separate the contract bundles, and read the first false claim before opening the household stores.',
    intro:['You have arrived at my road. Arrival creates a fee. You may dispute the fee after paying the cost of the dispute.',
      'Dessa: We will read the first page. A rule you wrote for yourself does not become our agreement because you repeat it.'],
    steps:[finalCircuit,finalSeam,finalFirstClaim,finalRoadFight,finalClaimEnd],reward:'6 Haven Supplies; 250 crowns; recovered food or medicine; the first false claim proved.',completionDialogue:'hb_final_recovered_packs_talk'});
  const finalAddresses=mechanism('hearth_final_hearth','hb_final_addresses','The Table of Open Addresses','B',
    {kind:'mirror',initial:[0,0,0,0],target:[1,2,3,0],labels:['Hearth','Guest','Road','Return']},
    'The hearth faces sunrise, East. The guest faces the southern sea. The road faces sunset, West. The return faces the northern star. No mirror faces the collector\'s chair.',R('hb_final_release_started'));
  const finalExit=field('hearth_final_hearth','hb_final_unwritten_exit','The Unwritten Exit','C','nyx',[
    'Nyx reveals the clause beneath the collector\'s seal: a resident may leave an agreement that the other party has broken.','She reads it aloud without adding a word. Tallow\'s own copy has preserved the way out.'
  ],R('hb_final_addresses'));
  const finalThreshold=field('hearth_final_hearth','hb_final_threshold','The Held Threshold','D','brann',[
    'Brann holds the threshold while the town\'s notice passes through it. The collector cannot move the door to turn the answer into another arrival.','Behind the frame, all six hearthmarks settle into their own places.'
  ],R('hb_final_unwritten_exit'));
  const finalGuardian=battle('hearth_final_hearth','hb_e_tallow','Tallow, Holder of Every Door','E',['hb_tallow','hb_ownership_seal','hb_ownership_seal'],'hb_tallow_clear',R('hb_final_threshold'),14,700,300,
    {intro:['Two Ownership Seals protect Tallow. Break them, then follow the weakness shown when the collector changes his claim.','Tallow: If the town owes me nothing, what am I meant to collect?','Dessa: Nothing from us.'],victory:['The last seal melts into blank wax. The stolen years rise from the drawer and follow the six hearthmarks home.','Tallow\'s name remains on the first false claim. It no longer grants him authority over a single door.'],loot:[{id:'haven_supplies',count:2}],effects:[F('hb_final_release_done'),F('hb_years_returned')]});
  mission({id:'hb_final_release',name:'No One Holds Every Door',arc:'finale',order:3,zone:'hearth_final_hearth',npc:'Dessa beside the Claim Table',level:14,requires:R('hb_final_claim_done'),
    summary:'Set the open addresses, reveal the exit clause, hold the threshold, and break Tallow\'s last claim on the town.',
    intro:['We have the records and the first false line. The stolen years are here. Tallow will try to move the door before our answer reaches him.','Set the table\'s addresses. Ask Nyx to read the clause under the seal, then ask Brann to hold the threshold. We will finish this arrival together.'],
    steps:[finalAddresses,finalExit,finalThreshold,{...finalGuardian,flag:'hb_final_release_done'}],reward:'2 Haven Supplies; 300 battle crowns; Haven\'s stolen years returned.',
    after:['The wax is blank. The doors have returned to their homes. There is one task left: go back and live the evening we recovered.']});
  const homecoming=field('hearth_haven','hb_homecoming_bell','The Homecoming Bell','B','soren',[
    'Soren rings the bell after the meal is ready. It carries through six open buildings and returns as six different answers.','For the first time in years, every door in Haven reaches the same evening. The town can keep its roads without losing its own tomorrow.'
  ],R('hb_final_feast_started','hearth_meal_cooked'));
  C.dialogues.hb_feast_square_close={speaker:'Wayfarer Haven',lines:[
    'The tables meet in the square. No one checks a deed before offering a place. People who prefer a quiet room can take a bowl home.',
    'Teren brings the clock she made. Mira asks her to explain its last adjustment, then listens without reaching for the tools.',
    'Kett speaks when he wants to. Soren leaves the next note to the guests around him.',
    'Nemi carries a star drawing from the observatory. Brann clears a place for it where the steam from supper will not reach the paper.',
    'Suri brings fruit from the tree that had no old name. Ilex saves one seed without deciding who must plant it.',
    'Yela reads a line from her corrected account. Nyx keeps the page open after the words end.',
    'Avi arrives at her own pace. Vale moves a chair closer to the path and waits for her to tell him whether it is the right place.',
    'Dessa closes the common notice in a plain folder. The town keeps the proof, but it has better things to do this evening than repeat the argument.',
    'The hearth stays warm after the feast. Wayfarer Haven has its own tomorrow, and six roads that its people can choose to use. The travellers can continue the orchard journey with a home to return to.'
  ]};
  C.dialogues.hb_feast_doors_close={speaker:'Wayfarer Haven',lines:[
    'Small tables appear beside the open doors. Bowls pass between neighbours. People can cross the square, stay in a quiet room, or invite someone in.',
    'Mira finds Teren adjusting her clock by the workshop lamp. She holds the light and lets Teren keep the last screw.',
    'Kett leaves a note of thanks at the inn. Soren does not ask him to read it aloud.',
    'Brann carries supper to the observatory. Nemi shows him a star that did not appear on the first sheet. He takes her word long enough to look for himself.',
    'Suri leaves a basket outside the garden gate. Ilex adds an empty pot for a plant that a later keeper may bring.',
    'Yela asks Nyx to keep a page safe until morning. Nyx places it in the archive without trying to finish its unfinished sentence.',
    'Vale walks beside Avi on the last short path to the dock. The call waits until she has finished her meal.',
    'Dessa carries the final bowl to a door that used to open into another year. This time a neighbour answers from the same evening.',
    'The small lights remain after supper. Wayfarer Haven has its own tomorrow, and six roads that its people can choose to use. The travellers can continue the orchard journey with a home to return to.'
  ]};
  const feastEnd=close('hearth_haven','hb_final_table','Dessa at the Evening Table','D',[
    'The meal is ready. The stolen years have returned to the town as ordinary time: a night of sleep, a visit that can be kept, work that may wait until morning.',
    'Dessa sets down the last unsigned bill. She uses its clean back to write the names of everyone helping with supper.',
    'The celebration can fill the square with a shared feast or spread into small suppers beside each open door. The town will keep a place for people who choose a quieter evening.'
  ],R('hb_homecoming_bell'),'hb_final_feast',[...supplies(4,300),I('hb_hearth_coat',3),I('elixir',3)],[
    branch('Hold a shared feast in the square.','hearth_feast_square','hb_feast_square_close'),branch('Share small suppers beside each door.','hearth_feast_doors','hb_feast_doors_close')],[F('hearthbound_complete')]);
  mission({id:'hb_final_feast',name:'A Place at the Evening Table',arc:'finale',order:4,zone:'hearth_final_hearth',slot:'F',npc:'Dessa at the Unclaimed Hearth',level:14,requires:R('hb_final_release_done'),
    summary:'Return to Haven, cook a meal if you have not cooked one before, sound the homecoming bell, and choose the town\'s closing celebration.',
    intro:['The town has its years back. I want to spend the first evening on something no collector can turn into another argument.','Take this grain, these herbs, and the cooking money to Haven\'s shared table. Make a Roadside Supper if the kitchen has not served a meal yet. Then ask Soren to call everyone home.'],
    startEffects:[I('ingredient_grain',2),I('ingredient_herb'),G(10)],
    steps:[step('Cook a meal at the shared table. Roadside Supper uses the supplied ingredients.','hearth_meal_cooked','hearth_haven','hb_haven_kitchen',{cook:true}),homecoming,feastEnd],reward:'4 Haven Supplies; 300 crowns; 3 Hearthbound Coats; 3 Last Fruit; The Hearthbound Roads resolved.',completionDialogue:'hb_final_table_talk',
    after:['The town\'s first free evening is complete. The hearth remains open when the travellers return.']});
  // Safe returns, finite caches, and renewable cooking ingredients are available.
  const ingredients=['ingredient_grain','ingredient_fruit','ingredient_herb'];
  for(const [index,z]of Object.values(maps).entries()){
    if(z.id!=='hearth_haven')ent(z.id,z.id+'_cache','chest','A Returned Household Cache',[7,18],{loot:[{id:'haven_supplies',count:1},{id:index%2?'ether':'tonic',count:2}],gold:25});
    if(z.hearthLayout.preset==='approach')ent(z.id,z.id+'_camp','camp','A Quiet Roadside Camp',[26,19]);
  }
  for(const [index,p]of plans.entries())for(const [room,z]of [p.first,p.second].entries()){
    const ingredient=ingredients[(index+room)%ingredients.length],names={ingredient_grain:'Roadside Grain Patch',ingredient_fruit:'Sun Fruit Planter',ingredient_herb:'Green Herb Bed'};
    ent(z,z+'_forage','forage',names[ingredient],[25,5],{ingredient,count:2,regrow:2});
  }
  ent('hearth_haven','hb_haven_cache','chest','Dessa\'s Starting Stores',[27,18],{loot:[{id:'haven_supplies',count:1},{id:'ingredient_grain',count:2},{id:'tonic',count:2}],gold:40});
  ent('hearth_haven','hb_haven_forage','forage','The Hearth Herb Patch',[24,18],{ingredient:'ingredient_herb',count:2,regrow:2});

  function observe(z,id,name,slot,lines,variants=[],requires){C.dialogues[id+'_talk']={speaker:name,lines,variants};ent(z,id,'npc',name,slot,{dialogue:id+'_talk',requires});}
  const guests=[
    ['mira','Teren',[5,14],['The bench is open. I am teaching someone who keeps asking the questions I was afraid to ask.'],[
      {requires:R('hb_mira_common_clock'),lines:['My first clock hangs over the common bench. It is a little slower than the tower clock. We mark the difference and keep working.','Mira asks what I changed before she offers a correction. I do the same for the next apprentice.']},
      {requires:R('hb_mira_travel_clock'),lines:['My first clock travels in the repair kit. A maker on the next road can copy its plan and write a different name on the result.','The Haven bench stays open while I travel. I do not have to keep every useful thing beside me.']}
    ]],
    ['soren','Kett',[11,14],['I slept through the bell this morning. Hessa left a warm bowl and did not put a fee beside it.'],[
      {requires:R('hb_kett_quiet'),lines:['The quiet room was what I needed first. This evening I may join the table. No one has turned my first choice into a permanent rule.']},
      {requires:R('hb_kett_supper'),lines:['I took the first supper at the common table. I have a quiet room for the nights when that feels like enough company.']}
    ]],
    ['brann','Nemi',[16,14],['Brann built a frame that lets me see farther. He asks what I found when he was not looking through it.'],[
      {requires:R('hb_brann_starbook'),lines:['The star book has six different kinds of drawing. A picture does not need to look like mine before it can show me something.']},
      {requires:R('hb_brann_weatherbook'),lines:['The weather chart records what we saw and what happened afterward. When the forecast is wrong, we leave the correction where people can read it.']}
    ]],
    ['ilex','Suri',[21,14],['The unknown tree has new leaves. I left a page for the next person who knows something about them.'],[
      {requires:R('hb_ilex_shared_fruit'),lines:['The first fruit went to the cooking table. Someone saved its seeds after supper. A shared meal can leave a next season behind.']},
      {requires:R('hb_ilex_seed_store'),lines:['The first seed store has dates and space for more notes. Ilex helped with the first label, then left the next one for me.']}
    ]],
    ['nyx','Yela',[25,17],['The archive keeps my account where I can reach it. If I remember something differently, I can add the date and explain why.'],[
      {requires:R('hb_nyx_corrected_file'),lines:['My correction remains beside the old file. The person who reads it can see which words belonged to the clerk and which belonged to me.']},
      {requires:R('hb_nyx_new_volume'),lines:['My new volume begins with my own account. The old file is in its appendix. I did not have to erase a page to stop living inside it.']}
    ]],
    ['vale','Avi',[27,10],['The dock has a bench at the end of the slow path. Vale waits for my answer before moving it somewhere he thinks is better.'],[
      {requires:R('hb_vale_quiet_departures'),lines:['The passenger call leaves a quiet interval. I can hear whether the answer beside me is finished before the next one begins.']},
      {requires:R('hb_vale_shared_departures'),lines:['The shared workday has extra hands by the cargo and a clear path for people. A passenger does not become another package because both use the same dock.']}
    ]]
  ];
  for(const [hero,name,pos,lines,variants]of guests)observe('hearth_haven','hb_guest_'+hero,name+' at Haven',pos,lines,variants,R('hearth_'+hero+'_complete'));
  const departures={
    hearth_mira_lane:['hb_mira_measure_start','hb_mira_bench'],hearth_mira_loft:['hb_mira_clock'],
    hearth_soren_well:['hb_soren_kett'],hearth_brann_furnace:['hb_brann_star_start','hb_brann_first_view'],
    hearth_ilex_path:['hb_ilex_graft_start','hb_ilex_bed_names'],hearth_ilex_orchard:['hb_ilex_first_fruit'],
    hearth_nyx_vault:['hb_nyx_name_start'],hearth_nyx_steps:['hb_nyx_correction'],
    hearth_vale_station:['hb_vale_passenger_start'],hearth_vale_mast:['hb_vale_avi']
  };
  for(const [z,ids]of Object.entries(departures)){const p=plans.find(p=>[p.first,p.second].includes(z));for(const id of ids)maps[z].entities.find(e=>e.id===id).hideIf=R(p.done);}
  for(const [z,id,flag]of [
    ['hearth_haven','hb_haven_welcome','hb_final_survey_started'],['hearth_haven','hb_final_survey_start','hb_final_survey_done'],
    ['hearth_final_crossing','hb_final_claim_start','hb_tallow_clear'],['hearth_final_hearth','hb_final_release_start','hb_final_release_done'],
    ['hearth_final_hearth','hb_final_feast_start','hearthbound_complete']
  ])maps[z].entities.find(e=>e.id===id).hideIf=R(flag);
  // The earlier decision is visible in a later-age record as well as at Haven.
  C.dialogues.hb_brann_stars_after.variants=[
    {requires:R('hb_mira_open_plans'),lines:['Nemi\'s star sheet lies beside a much older repair guide. It keeps the maker\'s mistakes next to their corrections.','Teren\'s choice at the old workshop survived in the forge copy. The young tower menders can see how a difficult piece was learned.']},
    {requires:R('hb_mira_clear_plans'),lines:['The old repair guide has a clean plan and a dated account of its earlier mistakes.','Teren\'s clear notes survived in the forge copy. The tower menders can follow the plan without losing the reason each correction was made.']}
  ];
  C.dialogues.hb_vale_receipt_after.variants=[
    {requires:R('hb_nyx_corrected_file'),lines:['The receipt book now keeps the first wrong entry beside the corrected return time. Its filing mark comes from Yela\'s archive in the Glass Republic.','The receiver can see what changed and who changed it.']},
    {requires:R('hb_nyx_new_volume'),lines:['The new receipt volume begins with the traveller\'s reply. Its appendix keeps the old sent-only records.','Yela\'s archive format survived into the future station. The new page begins with the person who arrived.']}
  ];
  C.temporalChanges=(C.temporalChanges||[]).concat([
    {flag:'hb_mira_open_plans',mission:'hb_mira_measure',source:'hearth_mira_lane',targets:['hearth_haven','hearth_brann_furnace'],text:'The workshop preserves visible attempts and corrections; its guide survives in the future star forge.'},
    {flag:'hb_mira_clear_plans',mission:'hb_mira_measure',source:'hearth_mira_lane',targets:['hearth_haven','hearth_brann_furnace'],text:'The workshop preserves a clear plan with dated repair notes; its guide survives in the future star forge.'},
    {flag:'hb_soren_quiet_room',mission:'hb_soren_listen',source:'hearth_soren_bank',targets:['hearth_haven'],text:'The inn makes a quiet sitting room for guests.'},
    {flag:'hb_soren_song_table',mission:'hb_soren_listen',source:'hearth_soren_bank',targets:['hearth_haven'],text:'The inn makes a table where guests may share a song.'},
    {flag:'hb_brann_wide_stair',mission:'hb_brann_frame',source:'hearth_brann_yard',targets:['hearth_haven'],text:'The observatory begins with a wide stair and resting places.'},
    {flag:'hb_brann_low_deck',mission:'hb_brann_frame',source:'hearth_brann_yard',targets:['hearth_haven'],text:'The observatory begins with a low deck and a clear horizon.'},
    {flag:'hb_ilex_old_names',mission:'hb_ilex_graft',source:'hearth_ilex_path',targets:['hearth_haven'],text:'The young garden carries the earlier keepers\' names into a later age.'},
    {flag:'hb_ilex_new_names',mission:'hb_ilex_graft',source:'hearth_ilex_path',targets:['hearth_haven'],text:'The young garden carries names chosen by its new keepers into a later age.'},
    {flag:'hb_nyx_corrected_file',mission:'hb_nyx_name',source:'hearth_nyx_steps',targets:['hearth_haven','hearth_vale_mast'],text:'Corrections stay beside old files; the future mast retains the first and corrected receipt.'},
    {flag:'hb_nyx_new_volume',mission:'hb_nyx_name',source:'hearth_nyx_steps',targets:['hearth_haven','hearth_vale_mast'],text:'Living replies begin new volumes; the future mast preserves earlier entries in an appendix.'},
    {flag:'hb_vale_quiet_departures',mission:'hb_vale_passenger',source:'hearth_vale_mast',targets:['hearth_haven'],text:'The dock keeps a quiet interval for each passenger reply.'},
    {flag:'hb_vale_shared_departures',mission:'hb_vale_passenger',source:'hearth_vale_mast',targets:['hearth_haven'],text:'The dock shares a workday while keeping a clear path for passengers.'},
    {flag:'hearth_feast_square',mission:'hb_final_feast',source:'hearth_haven',targets:['hearth_haven'],text:'A shared table fills the square after the town regains its own tomorrow.'},
    {flag:'hearth_feast_doors',mission:'hb_final_feast',source:'hearth_haven',targets:['hearth_haven'],text:'Small tables and door lamps mark the town\'s first free evening.'}
  ]);
  C.hearth.zoneIds=Object.keys(maps);C.hearth.missionIds=missionIds;C.hearth.enemyIds=enemyIds;C.hearth.encounterIds=encounterIds;C.hearth.choiceFlags=choiceIds;
  const es=Object.values(maps).flatMap(z=>z.entities),ms=C.missions.filter(m=>m.campaign==='hearth');
  C.hearth.counts={zones:15,heroArcs:6,missions:ms.length,journalSteps:ms.reduce((n,m)=>n+m.steps.length,0),encounters:encounterIds.length,enemyTypes:enemyIds.length,guardians:enemyIds.filter(id=>C.enemies[id].boss).length,
    decisions:choiceIds.length/2,choiceFlags:choiceIds.length,mechanisms:es.filter(e=>e.type==='mechanism').length,fieldActions:es.filter(e=>e.type==='field').length,chests:es.filter(e=>e.type==='chest').length,camps:es.filter(e=>e.type==='camp').length,foragePatches:es.filter(e=>e.type==='forage').length,projects:6,
    guaranteedSupplies:77,extraSuppliesFromChoice:1};
  C.zoneById=Object.fromEntries(C.zones.map(z=>[z.id,z]));if(C.refreshCounts)C.refreshCounts();
})(globalThis);
