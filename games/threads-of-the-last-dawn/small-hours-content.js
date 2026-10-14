/* The Small Hours — stories that were waiting in the original world. */
(function(global){
  'use strict';
  const D=global.Dawn,C=D&&D.Content;if(!C)throw new Error('Load content.js before small-hours-content.js.');
  if(C.smallHours)return;
  const F=id=>({type:'flag',id,value:true}),I=(id,count=1)=>({type:'item',id,count}),G=amount=>({type:'gold',amount}),R=(...flags)=>({flags});
  const missionIds=[],noteIds=[],encounterIds=[],enemyIds=[],choiceFlags=[],entityIds=[],hooks=new Map(),usedZones=new Set();
  const zone=id=>C.zones.find(z=>z.id===id),find=id=>C.zones.flatMap(z=>z.entities||[]).find(e=>e.id===id);
  const merge=(...values)=>{const out={};for(const v of values.filter(Boolean))for(const [k,a]of Object.entries(v))out[k]=Array.isArray(a)?[...(out[k]||[]),...a]:a;return out;};
  C.smallHours={id:'small-hours',name:'The Small Hours',version:'1.4.0',startZone:'bell_quay',startEntity:'quay_fisher',completeFlag:'sh_small_hours_complete',
    description:'Return to the people whose lives continued beside the larger journey. Repair a small promise, follow an old clue, and let the result remain in the world.'};
  C.fieldNotes=C.fieldNotes||[];C.missions=C.missions||[];
  function ent(z,id,type,name,point,extra={}){const e={id,type,name,x:point[0],y:point[1],preserveLayout:true,...extra};zone(z).entities.push(e);entityIds.push(id);usedZones.add(z);return e;}
  function hook(id,rank,requires,dialogue){if(!find(id))throw new Error('Missing Small Hours contact '+id);if(!hooks.has(id))hooks.set(id,[]);hooks.get(id).push({rank,requires,dialogue});}
  function step(text,flag,z,entity,extra={}){usedZones.add(z);return{text,flag,zone:z,entity,...extra};}
  function branch(label,flag,lines,effects=[]){choiceFlags.push(flag);return{label,effects:[F(flag),...effects],after:lines};}
  function mission(o){
    const id=o.id,started=id+'_started',done=id+'_done',intro=id+'_intro',finish=id+'_finish',wait=id+'_wait',after=id+'_after';
    const choices=(o.choices||[]).map(({after,...b})=>b),conditions=merge(o.requires,R(started,...o.steps.map(s=>s.flag)),{notFlags:[done]});
    C.dialogues[intro]={speaker:o.speaker,hero:o.hero,lines:o.intro,onceFlag:id+'_accepted',onRepeat:wait,effects:[F(started),...(o.startEffects||[])]};
    C.dialogues[wait]={speaker:o.speaker,hero:o.hero,lines:o.hint||[o.summary]};
    C.dialogues[finish]={speaker:o.finishSpeaker||o.speaker,hero:o.hero,lines:o.finish,onceFlag:id+'_finished',onRepeat:after,effects:[F(done),...(o.effects||[]),...(o.rewards||[])],choices};
    C.dialogues[after]={speaker:o.finishSpeaker||o.speaker,hero:o.hero,lines:o.after||['The work remains in the world. There is time to come back and see it.'],variants:(o.choices||[]).map(b=>({requires:R(b.effects[0].id),lines:b.after||[b.label]}))};
    hook(o.giver,2,merge(o.requires,{notFlags:[started,done]}),intro);
    hook(o.giver,1,merge(R(started),{notFlags:[done]}),wait);
    hook(o.finishEntity||o.giver,0,conditions,finish);
    hook(o.finishEntity||o.giver,3,R(done),after);
    const m={id,name:o.name,campaign:'small',era:zone(o.startZone).era,requires:o.requires||{},summary:o.summary,startNpc:o.speaker,startZone:o.startZone,startEntity:o.giver,
      steps:[step('Speak to '+o.speaker+'.',started,o.startZone,o.giver),...o.steps,step('Return to '+(o.finishSpeaker||o.speaker)+'.',done,o.finishZone||o.startZone,o.finishEntity||o.giver)],completeFlag:done,reward:o.reward,completionDialogue:finish};
    if(m.steps.length<3||m.steps.length>5)throw new Error('Small Hours mission must have 3–5 steps: '+id);
    C.missions.push(m);missionIds.push(id);return m;
  }
  function note(id,name,z,point,lines,requires){const flag=id+'_read';C.fieldNotes.push({id,name,zone:z,flag,lines,requires});noteIds.push(id);ent(z,id+'_page','note',name,point,{record:id,requires});return step('Read '+name+'.',flag,z,id+'_page',{record:id});}
  function field(id,name,z,point,ability,lines,requires,effects=[]){const flag=id+'_done';ent(z,id,'field',name,point,{ability,flag,lines,requires,effects});return step('Use '+name+'.',flag,z,id,{ability});}
  function mechanism(id,name,z,point,puzzle,hint,requires){const flag=id+'_done';ent(z,id,'mechanism',name,point,{flag,puzzle,hint,requires,solvedLines:['The parts settle into place. The work can continue.']});return step('Set '+name+'.',flag,z,id,{puzzle:puzzle.kind});}
  function delivery(id,name,z,point,items,lines,requires,effects=[]){const flag=id+'_done';ent(z,id,'delivery',name,point,{items,gold:0,flag,lines,requires,effects,repeatLines:['The whole delivery is recorded. Nothing more is owed here.']});return step('Deliver the listed items to '+name+'.',flag,z,id,{delivery:true});}
  function scene(id,name,z,point,lines,requires){const flag=id+'_heard';C.dialogues[id+'_talk']={speaker:name,lines,onceFlag:id+'_seen',onRepeat:id+'_after',effects:[F(flag)]};C.dialogues[id+'_after']={speaker:name,lines:['You have heard my account. Please keep the parts that were difficult to hear as well.']};ent(z,id,'npc',name,point,{dialogue:id+'_talk',requires});return step('Hear '+name+'\'s account.',flag,z,id);}
  function board(id,name,z,point,lines){C.dialogues[id+'_idle']={speaker:name,lines};ent(z,id,'npc',name,point,{dialogue:id+'_idle'});}
  function key(id,name,description){C.items[id]={id,name,kind:'key',price:0,description};}
  for(const [id,name,description]of [
    ['sh_copper_key_item','The Returned Copper Key','The fisher has asked you to find which lock this key still fits.'],
    ['sh_supper_tray','Covered Supper Tray','A prepared meal for the workers and harbour watch. Keep it covered until delivery.'],
    ['sh_season_seed','Marked Season Packet','One of four packets from the old keeper\'s store. The marks say when each seed needs rest.'],
    ['sh_shade_seed','Neri\'s Later Seed','A seed kept beside the marker that once looked like an ordinary stick.'],
    ['sh_lesson_pages','Correctable Lesson Pages','Three pages with room to name a mistake and show its repair.'],
    ['sh_memory_case','Sealed Return Case','A memory whose owner has asked to receive it. Only its owner will open the case.'],
    ['sh_route_tag','Checked Route Tag','One of three durable signs for the homeward road.'],
    ['sh_breakfast_box','Four-Person Breakfast Box','A covered box for four people at Cinder Relay.'],
    ['sh_elia_seed','Elia\'s Seed Envelope','Seeds stored with the garden record. One envelope is for Orin and one for the next grower.'],
    ['sh_kept_lamp','A Kept Watch','A small lamp token. Someone stayed until another person could rest.'],
    ['sh_kept_seed','A Kept Season','A seed token. Someone left room for a season they would not control.'],
    ['sh_kept_word','A Kept Answer','A folded page. Someone listened without making forgiveness part of the price.'],
    ['sh_kept_shift','A Finished Shift','A stopped brass dial. A useful task was allowed to end.']
  ])key(id,name,description);
  for(const [id,name,stats,description]of [
    ['sh_river_hook','Riverkeeper\'s Hook',{atk:2,speed:1},'A small hook used to lift a rope without cutting it.'],
    ['sh_pollen_clasp','Pollen Clasp',{mag:3,maxMp:4},'A flower clasp that leaves its seeds loose enough to travel.'],
    ['sh_stage_ribbon','Open Stage Ribbon',{speed:2,def:2},'A ribbon tied where a performer can find the edge of a safe step.'],
    ['sh_shift_badge','Last Shift Badge',{def:4,maxHp:18},'Its reverse has space for the name of the next keeper.'],
    ['sh_small_album','Small Hours Album',{maxHp:25,maxMp:6},'There are blank pages after the accounts already kept here.']
  ])C.items[id]={id,name,kind:'accessory',slot:'accessory',stats,description,price:100};
  const atk=(name,power,element='physical',target='enemy',extra={})=>({name,type:element==='physical'?'physical':'magic',power,element,target,telegraph:target==='allEnemies'?2:1,charge:target==='allEnemies',...extra});
  function enemy(id,name,maxHp,attack,magic,def,speed,weak,pattern,extra={}){C.enemies[id]={id,name,maxHp,atk:attack,mag:magic,def,speed,weak,resist:[],boss:false,atb:60,staggerMax:95,staggerDuration:3.5,staggerRecovery:3,pattern,...extra};enemyIds.push(id);}
  enemy('sh_roof_spark','Roof Spark',720,25,29,13,12,['water','earth'],[atk('Loose Current',1.2,'spark'),atk('Across the Gutter',1,'spark','allEnemies')],{rigId:'spark_wisp',color:'#d8b371'});
  enemy('sh_thorn_knot','Restless Thorn Knot',1150,29,26,15,10,['fire','wind'],[atk('A Hold on the Path',1.45),atk('Catch the Pollen',1.1,'earth','allEnemies',{status:{slow:4}})],{rigId:'root_crown',size:.48,color:'#9ca76a'});
  enemy('sh_errata_moth','Errata Moth',1180,30,37,17,13,['fire','spark'],[atk('Copied Error',1.3,'void'),atk('Loose Page',1.15,'wind','allEnemies')],{color:'#b5adb5'});
  enemy('sh_closed_index','Closed Index',1650,35,36,20,10,['water','earth'],[atk('No Corrections',1.65),{name:'Keep the First Copy',type:'support',target:'self',status:{guard:4},telegraph:1}],{rig:'humanoid',color:'#9fabb8'});
  enemy('sh_shift_foreman','The Unfinished Foreman',2350,34,32,19,10,['water','spark'],[atk('Another Empty Shift',1.3,'fire','allEnemies'),atk('Clock In Again',1.75)],{boss:true,rigId:'furnace_regent',atb:25,staggerMax:155,staggerRecovery:4,phases:[{at:.5,name:'The final clock-out',weak:['earth','wind'],pattern:[atk('Work with No Worker',1.5,'earth','allEnemies'),atk('The Last Stamp',1.9)]}]});
  enemy('sh_route_gale','Route Gale',1350,30,37,17,13,['earth','void'],[atk('Remove the Footprints',1.3,'wind'),atk('White Horizon',1.1,'spark','allEnemies')],{rigId:'storm_ray',color:'#aabcc5'});
  enemy('sh_unspent_frame','The Unspent Frame',4900,43,44,25,11,['wind','water'],[atk('Only the Great Hour',1.45,'void','allEnemies'),atk('Crop the Small Life',1.9)],{boss:true,rigId:'fourfold_witness',atb:25,staggerMax:170,staggerRecovery:4,phases:[{at:.55,name:'Lives beyond the frame',weak:['fire','earth'],pattern:[atk('An Hour Left Open',1.6,'wind','allEnemies'),atk('The Ordinary Answer',2,'spark')]},{at:.25,name:'Room for a blank page',weak:['water','spark','void'],pattern:[atk('What Cannot Be Counted',1.75,'void','allEnemies')]}]});
  function battle(id,name,z,point,foes,requires,level,xp,gold,extra={}){const flag=id+'_won';C.encounters[id]={id,name,enemies:foes,boss:foes.some(v=>C.enemies[v].boss),repeat:false,recommendedLevel:level,requires,xp,gold,loot:extra.loot||[],effects:[F(flag),...(extra.effects||[])],intro:extra.intro||['Read the enemy\'s weakness and watch its charge. A break can stop its current action.'],victory:extra.victory||['The disturbance settles. The old route remains open.']};ent(z,id+'_body','encounter',name,point,{encounter:id,requires,hideIf:R(flag)});encounterIds.push(id);return step('Resolve '+name+'.',flag,z,id+'_body',{encounter:id});}

  // Bells: an old key, a meal, a rehearsal, and a watch that can be shared.
  const keyNote=note('sh_note_key','The Copper Key\'s Tide Marks','bell_quay',[6,9],[
    'A fish scale covers four shallow marks on the key: sunrise, the south pier, the north rope, sunset. They point East, South, North, West.',
    'The same marks appear on an old communal locker at the Copper Kiln. A loose ring on the key let it fall into the harbour more than once.'
  ],R('sh_copper_key_started'));
  const keyLock=mechanism('sh_key_lock','The Tide-Marked Locker','bell_kiln',[11,11],{kind:'mirror',initial:[0,0,0,0],target:[1,2,0,3],labels:['Sunrise','South pier','North rope','Sunset']},'Follow the key\'s marks: East, South, North, West.',R('sh_note_key_read'));
  const keyHand=delivery('sh_key_hand','The Old Locker Keeper','bell_kiln',[14,14],{sh_copper_key_item:1},[
    'The keeper checks the key, opens the locker, and fits a new ring. Inside are rope hooks and a weathered account of the first harbour tools.',
    'The fisher\'s father used this locker too. A worn ring, a tide, and a fish made its story look like a closed circle.'
  ],R('sh_key_lock_done'));
  mission({id:'sh_copper_key',name:'The Key That Came Back',startZone:'bell_quay',giver:'quay_fisher',speaker:'Old Fisher',requires:{chapterAtLeast:2},
    summary:'Read the copper key\'s marks, open its old locker at the Copper Kiln, and return the answer to the fisher.',
    intro:['The fish came back to my line. This time I kept the key long enough to look at it. There are four marks under the scales.','Would you find the lock? I would like one true part to put beside my father\'s story.'],startEffects:[I('sh_copper_key_item')],steps:[keyNote,keyLock,keyHand],
    finish:['The fisher laughs at the new ring. His father had promised to mend that ring every spring.','The tools still work. We can put the key beside them for daily use, or display the old key with its account and cut a sound new copy.'],
    choices:[branch('Keep the old key with the working tools.','sh_key_working',['The old key hangs beside the rope hooks. People borrow it and bring it back. The fisher checks its ring every spring.']),branch('Display its history and make a new working copy.','sh_key_history',['The old key has a small label. A new copy opens the locker. The fisher tells the whole story, including the loose ring.'])],
    rewards:[I('sh_river_hook'),G(45)],reward:'Riverkeeper\'s Hook; 45 crowns; the fisher\'s old clue resolved.'});
  const supperRack=field('sh_supper_rack','The Warming Rack','bell_kiln',[11,19],'brace',['Brann steadies the rack and leaves a clear space for the covered trays. The workers can take a meal without stopping the whole furnace.'],R('sh_shared_supper_started'));
  const supperHand=delivery('sh_supper_hand','The Harbour Meal Handoff','bell_quay',[24,8],{sh_supper_tray:2},['Both covered trays reach the harbour watch. One goes to the workers whose turn ends now. The other stays warm for the watch that takes their place.'],R('sh_supper_rack_done'));
  mission({id:'sh_shared_supper',name:'Before the Supper Cools',startZone:'bell_kiln',giver:'kiln_worker',speaker:'The Kiln Worker',requires:{chapterAtLeast:2,flags:['brann_joined']},
    summary:'Steady the warming rack, deliver both covered trays to the harbour watch, and choose where the next shared supper will be held.',
    intro:['We counted every home and forgot to count the people carrying the coal. Here are two trays for the watch.','Ask Brann to steady the rack before you lift them. Then take both to the marked handoff at the quay.'],startEffects:[I('sh_supper_tray',2)],steps:[supperRack,supperHand],
    finish:['The next crew arrives fed. A small job has stopped being nobody\'s job.','For the next supper, we can meet under the orchard trees or keep covered trays beside the dock for people who cannot leave their watch.'],
    choices:[branch('Meet beneath the orchard trees.','sh_supper_garden',['The orchard has a meal table after the shift. A covered portion still goes to anyone who must stay at work.']),branch('Keep the shared supper beside the dock.','sh_supper_dock',['Covered trays wait beside the dock. People join the table when their watch ends.'])],
    rewards:[I('meal_road'),I('haven_supplies'),G(35)],reward:'1 Roadside Supper; 1 Haven Supply; 35 crowns; a visible supper place.'});
  const refrainNote=note('sh_note_refrain','The Watchers\' Refrain','bell_tower',[26,19],['The rehearsal page names four notes in order: MID, LOW, CLEAR, HIGH.','The written names are enough to learn it. A player does not need to hear the bells to take part.'],R('sh_seventh_refrain_started'));
  ent('bell_quay','sh_refrain_bells','minigame','The Watchers\' Rehearsal',[19,17],{pattern:[1,0,3,2],flag:'sh_refrain_played',effects:[F('sh_refrain_played')],hint:'MID · LOW · CLEAR · HIGH',rewardText:'The watchers have a refrain they can answer.',requires:R('sh_note_refrain_read')});
  mission({id:'sh_seventh_refrain',name:'A Refrain for the Living',startZone:'bell_quay',giver:'quay_steward',speaker:'The Harbour Steward',requires:{chapterAtLeast:2},
    summary:'Read the rehearsal page in the Seventh Tower, play its four notes at the new quay bells, and choose the public arrangement.',
    intro:['The east road still leads to the orchard and the north road to the kiln. Now both roads have people coming home along them.','We need a short refrain the living can answer. The watchers left its four notes in the tower.'],steps:[refrainNote,step('Play MID, LOW, CLEAR, HIGH at the watchers\' bells.','sh_refrain_played','bell_quay','sh_refrain_bells')],
    finish:['The answer comes from a window above the pier. Someone has learned the tune before the rehearsal is over.','Keep the public version soft enough for the nearby rooms, or let all four bells lead a short chorus before the night watch.'],
    choices:[branch('Use a soft arrangement near the homes.','sh_refrain_soft',['Small chimes carry the refrain along the quay. The full bells remain quiet beside the sleeping rooms.']),branch('Let all four bells lead the short chorus.','sh_refrain_full',['Four pennants mark the rehearsal place. The chorus ends on time, before the night watch begins.'])],
    rewards:[G(40),I('ether')],reward:'40 crowns; 1 Blue Nectar; a new public refrain.'});
  const watchNote=note('sh_note_watch','The Windward Watch Sheet','bell_tower',[21,17],['The exposed ring pulls the orchard lamp sideways. The tower receives its current through the same wet wire.','Cut the frayed binding at the orchard lamp first. The loose sparks in the tower can then be grounded without pulling the whole line down.'],R('sh_lantern_watch_started'));
  const watchField=field('sh_watch_binding','The Frayed Lamp Binding','bell_orchard',[17,19],'cut',['Mira removes the frayed binding and fits the lamp to a sound loop. The current no longer runs through wet bark.'],R('sh_note_watch_read'));
  const roofFight=battle('sh_e_roof_sparks','The Sparks above the Watch','bell_tower',[7,6],['sh_roof_spark','sh_roof_spark'],R('sh_watch_binding_done'),4,45,30);
  mission({id:'sh_lantern_watch',name:'When the Watch Can Rest',startZone:'bell_tower',giver:'tower_plate',speaker:'The Tower Watch Keeper',requires:{chapterAtLeast:3},
    summary:'Read the windward watch sheet, repair the orchard lamp binding, and ground the sparks before setting the new watch lights.',
    intro:['The service plate now has a paper watch sheet beside it. A keeper has been staying awake to hold the lamp line by hand.','Read where the wet wire goes. Repair it at the orchard, then return to the loose sparks above the tower watch.'],steps:[watchNote,watchField,roofFight],
    finish:['The keeper lets go of the line. It holds. Someone else can now take a turn while she sleeps.','Keep tall steady lamps where the road is clear, or fit low hooded lamps that shelter their light from the wind. The pattern can be copied by later road keepers.'],
    choices:[branch('Keep a line of tall steady lamps.','sh_watch_steady',['The watch uses tall steady lamps. A later copy of the plan marks the road across the Rust Dunes.']),branch('Use low lamps with wind hoods.','sh_watch_sheltered',['Low hooded lamps lead past the tower. Their design survives beside the future dune road.'])],
    rewards:[I('sh_kept_lamp'),I('storm_coil'),G(50)],reward:'A Kept Watch; 1 Storm Coil; 50 crowns; a safer watch in two ages.'});

  // Seeds: observation matters as much as the power to make something grow.
  const growthNote=note('sh_note_growth','The Deadwood and the New Root','seed_wilds',[11,19],['A dry branch cannot grow new roots. It can hold a vine or give a bird a safe place above the water.','Beside it, a young seedling has taken root in the damp soil. The two plants do not have to be the same plant for Neri\'s care to matter.'],R('sh_neri_stick_started'));
  const stickField=field('sh_stick_test','Neri\'s Watered Stick','seed_camp',[14,6],'grow',['Ilex tests the soil without forcing the dead branch to live. A small seedling opens beside it.','Neri: I was wrong about the stick. I was not wrong to come back with water.'],R('sh_note_growth_read'));
  mission({id:'sh_neri_stick',name:'The Stick That Stayed',startZone:'seed_camp',giver:'camp_neri',speaker:'Neri',requires:{chapterAtLeast:2,flags:['ilex_joined']},
    summary:'Read the deadwood note in the First Wilds, ask Ilex to test the planted stick, and help Neri choose its next use.',
    intro:['Elder Fen was right. The stick has no roots. Something small is growing beside it, though.','Will you look before anyone pulls it out? I would like to know which part I have been watering.'],steps:[growthNote,stickField],
    finish:['Neri leaves the seedling in the damp soil. She asks for a use for the dry branch that will not pretend it is a new tree.','It can hold a growing vine, or stand as a bird perch beside the young plant.'],
    choices:[branch('Use it as a light vine trellis.','sh_stick_trellis',['A vine climbs the dead branch. Neri writes which part is old wood and which part is new growth.']),branch('Keep it as a bird perch.','sh_stick_perch',['A bird lands on the dry branch above the seedling. Neri leaves both enough room.'])],
    rewards:[I('living_fiber'),G(30)],reward:'1 Living Fiber; 30 crowns; Neri\'s planted stick gains a real use.'});
  const pollenNote=note('sh_note_pollinators','The Two Stops of the Pale Moth','seed_falls',[14,11],['Pale moths feed beside the falls, then rest under the low leaves in the First Wilds. Cutting either place off breaks their whole route.','A short low note draws them away from the fast water. Leave a sheltered patch and an open flowering patch before sounding it.'],R('sh_pollinator_route_started'));
  const pollenField=field('sh_pollen_path','The Flowering Rest Patch','seed_wilds',[17,19],'grow',['Ilex opens a small patch of flowers beside the sheltered leaves. The route remains wide enough for feet and wings.'],R('sh_note_pollinators_read'));
  const pollenSong=field('sh_pollen_song','The Low River Note','seed_falls',[14,19],'resonate',['Soren sounds a low note beside the bank. The moths rise away from the falling water and settle along the flowering route.','Their path will need quiet places, not a keeper standing here all night.'],R('sh_pollen_path_done'));
  mission({id:'sh_pollinator_route',name:'A Road for Smaller Wings',startZone:'seed_wilds',giver:'wilds_marker',speaker:'The Root-Marker Keeper',requires:{chapterAtLeast:3,flags:['ilex_joined']},
    summary:'Study the moth route at the falls, grow its resting flowers, and sound a low note to guide the first crossing.',
    intro:['Many feet made this path. Smaller travellers used it before we put a marker here.','The pale moths are gathering over the fast water. Read their two resting places before changing the bank.'],steps:[pollenNote,pollenField,pollenSong],
    finish:['The first moth reaches the low leaves. The keeper marks a walking route beside its feeding ground.','The permanent edge can be a loose hedge with gaps or a sunny strip of low flowers. Both keep the two resting places joined.'],
    choices:[branch('Keep a loose sheltered hedge.','sh_pollinator_hedge',['The hedge has gaps for wings and feet. Pale moths rest on its inner leaves.']),branch('Keep a sunny strip of low flowers.','sh_pollinator_sunstrip',['The low flowers leave the bank open to light. The resting leaves remain beside them.'])],
    rewards:[I('sh_pollen_clasp'),G(40)],reward:'Pollen Clasp; 40 crowns; a living route through the First Wilds.'});
  battle('sh_e_thorn_knot','The Knot beside the Flower Path','seed_wilds',[26,19],['sh_thorn_knot'],R('sh_pollinator_route_done'),4,35,25,{loot:[{id:'living_fiber',count:1}]});
  const seasonsNote=note('sh_note_seasons','The Four Resting Seeds','seed_vault',[15,19],['The spring seed faces the warm south wall. The summer seed rests beside the cool north stone.','The autumn seed faces sunset in the west. The winter seed waits for sunrise in the east. Each season needs a place to stop as well as a place to begin.'],R('sh_four_seasons_started'));
  const seasonsLock=mechanism('sh_season_trays','The Four Resting Trays','seed_vault',[26,11],{kind:'mirror',initial:[0,0,0,0],target:[2,0,3,1],labels:['Spring','Summer','Autumn','Winter']},'Spring South; Summer North; Autumn West; Winter East.',R('sh_note_seasons_read'));
  const seasonsHand=delivery('sh_season_hand','The Keeper\'s Four Trays','seed_vault',[15,6],{sh_season_seed:4},['All four marked packets reach the correct trays. None has been forced to grow merely to prove it is alive.'],R('sh_season_trays_done'));
  mission({id:'sh_four_seasons',name:'A Place for Every Season',startZone:'seed_vault',giver:'vault_memory',speaker:'The Root Memory',requires:{chapterAtLeast:3},
    summary:'Read the four seeds\' resting needs, align their trays, and return all four packets to a store with room for change.',
    intro:['Four seeds were planted here. The memory kept their beginnings and almost forgot their rests.','Four marked packets remain in the dry store. Take them to the trays after you have read the keeper\'s directions.'],startEffects:[I('sh_season_seed',4)],steps:[seasonsNote,seasonsLock,seasonsHand],
    finish:['The four trays stand open. Their marks describe a season without ordering every plant to follow it at once.','A later garden can mix small seasonal beds, or rotate four larger beds and write down what each season changes.'],
    choices:[branch('Keep a mix of small seasonal beds.','sh_seasons_mixed',['Small beds carry different stages of growth beside one another. A later skyway garden keeps a copy of the plan.']),branch('Rotate four clearly marked beds.','sh_seasons_rotating',['Four marked beds change in turn. Their dated labels survive in a garden above the future skyway.'])],
    rewards:[I('sh_kept_seed'),I('living_fiber'),G(45)],reward:'A Kept Season; 1 Living Fiber; 45 crowns; a garden plan that reaches the future.'});
  const shadeNote=note('sh_note_shade','The Later Mark on the Orchard Root','bell_orchard',[12,13],['A small mark on the root matches Neri\'s planting place. Keepers have copied the mark when the root moved.','The oldest dry branch is gone. The young plant beside it left descendants. One reaches the garden above the Drowned Skyway.'],R('sh_shade_to_come_started'));
  const shadeField=field('sh_later_root','The Later Root Marker','ash_skybridge',[26,11],'grow',['Ilex clears the hard soil around the descendant root. The original stick did not need to live forever for Neri\'s visit to matter.'],R('sh_note_shade_read'));
  const shadeHand=delivery('sh_shade_hand','The Skyway Planting Pocket','ash_skybridge',[17,11],{sh_shade_seed:1},['Neri\'s later seed reaches a pocket of open soil. A new plant begins beside the old root.'],R('sh_later_root_done'));
  mission({id:'sh_shade_to_come',name:'The Shade She Will Not See',startZone:'seed_camp',giver:'camp_neri',speaker:'Neri',requires:R('sh_neri_stick_done','future_bridge'),
    summary:'Follow Neri\'s root mark through the Orchard of Hours to the Drowned Skyway, then plant the next seed and bring her the account.',
    intro:['The little plant has made a seed. You can see farther along its road than I can.','Please take this one to the later root. Tell me what was there. You do not have to promise it will stay the same.'],startEffects:[I('sh_shade_seed')],steps:[shadeNote,shadeField,shadeHand],
    finish:['Neri listens to the account of the later root. She cannot picture the skyway, so she draws a small patch of shade beside a long road.','Leave a resting bench under that shade, or keep the young branches clear for the birds that carry its next seeds.'],
    choices:[branch('Leave a small resting bench.','sh_shade_bench',['A bench stands beside the later root. Its label names the child who watered the first small patch.']),branch('Keep the branches clear for birds.','sh_shade_birds',['Birds settle above the skyway and carry seeds beyond it. A small root mark keeps Neri\'s part of the account.'])],
    rewards:[I('haven_supplies'),I('ingredient_fruit',2),G(55)],reward:'1 Haven Supply; 2 Sun Fruit; 55 crowns; a new skyway resting place.'});

  // Glass: a reply belongs to a person, not to the record that describes them.
  const sisterScene=scene('sh_sister_account','Mara, the Citizen\'s Sister','glass_steps',[20,19],[
    'Iven remembers paying to forget the argument. I remember the argument and the way she left me to clear the broken cups.',
    'I do not need her to pretend she remembers. I need her to hear what I say, take her part of the repair, and let me decide when I am ready to visit.'
  ],R('sh_unsaid_apology_started'));
  const apologyNote=note('sh_note_apology','The Unsold Part of the Account','glass_cistern',[8,6],[
    'Iven\'s return slip names two broken cups and a repair that was never paid. It does not contain the argument she sold.',
    'At the bottom, in her own hand: Mara stayed to put the room right. I left. A person can acknowledge that act without buying every lost word back.'
  ],R('sh_sister_account_heard'));
  mission({id:'sh_unsaid_apology',name:'The Words She Can Mean',startZone:'glass_steps',giver:'steps_citizen',speaker:'Iven, the Glass Citizen',requires:{chapterAtLeast:4},
    summary:'Hear Mara\'s account, read the unsold return slip in the Ink Cistern, and help Iven offer an apology that asks for no promised forgiveness.',
    intro:['My name is Iven. I told you I did not know how to apologise for an argument I could not remember.','Mara says I have been making that the end of every conversation. Will you hear what she has asked me to do? My old return slip is still in the cistern.'],steps:[sisterScene,apologyNote],
    finish:['Iven sets two new cups beside the slip. She does not say that forgetting made the room less broken.','She can send a plain letter that names her part and offers the repair, or ask for a quiet visit at a time Mara chooses. Neither offer requires Mara to forgive her.'],
    choices:[branch('Send the letter and leave the time of reply to Mara.','sh_apology_letter',['Mara has read the letter. The new cups remain beside it. She has not promised a visit, and Iven no longer calls that an unfinished payment.']),branch('Ask Mara to choose a time for a quiet visit.','sh_apology_visit',['Two chairs stand near the square. Mara chose a short visit. Iven listened when she said it was time to go.'])],
    rewards:[I('sh_kept_word'),I('panacea'),G(35)],reward:'A Kept Answer; 1 Clear Dew; 35 crowns; the sisters\' first honest reply.'});
  C.dialogues.sh_sister_account_after.variants=[
    {requires:R('sh_apology_letter'),lines:['I read her letter. It names the work I did and does not ask me to thank her for noticing.','I will decide when to answer. She has left me that time.']},
    {requires:R('sh_apology_visit'),lines:['We had a short visit. I asked her to leave when I was tired, and she went without turning it into another argument.','I do not know what the next visit will be. That is a better answer than pretending we finished everything.']}
  ];
  const lessonNote=note('sh_note_lesson','A Lesson with a Wrong Date','glass_archive',[13,6],[
    'The approved lesson puts the flood before the river wall was built. A dated repair list shows that the wall was already standing.',
    'The repair list proves the order of these two events. It does not prove that every other line in either record is correct. Keep the source and the correction together.'
  ],R('sh_open_lesson_started'));
  const errataFight=battle('sh_e_errata','The Lesson That Refuses a Correction','glass_cistern',[18,14],['sh_errata_moth','sh_closed_index'],R('sh_note_lesson_read'),8,55,35,
    {intro:['An Errata Moth keeps copying the wrong date while a Closed Index seals each copy.','The index can guard itself. Use its water or earth weakness, then follow the moth\'s fire or spark weakness.']});
  const lessonHand=delivery('sh_lesson_hand','The Junior Archivist\'s Revision Desk','glass_archive',[6,13],{sh_lesson_pages:3},[
    'The three lesson pages reach the revision desk. Each names its source, the claim that source supports, and a space for the next correction.'
  ],R('sh_e_errata_won'));
  mission({id:'sh_open_lesson',name:'The Lesson with Room to Change',startZone:'glass_archive',giver:'archive_junior',speaker:'The Junior Archivist',requires:{chapterAtLeast:4},
    summary:'Check the lesson\'s date, stop the copying error in the cistern, and return three pages that show how their answer was checked.',
    intro:['The guide still says a record can tell us what must happen next. I would like to teach the sentence I told you instead.','These three pages need a checked example. Read the flood date, stop the old copier, and bring the pages to my revision desk.'],startEffects:[I('sh_lesson_pages',3)],steps:[lessonNote,errataFight,lessonHand],
    finish:['The junior archivist writes her own name below the correction. The next reader will know whom to ask about it.','The first lessons can stay at a public checking desk, or travel as short sheets with a return address for corrections.'],
    choices:[branch('Open a public checking desk.','sh_lesson_desk',['The checking desk has the old date, the source, and the correction. A visitor can ask how the archivist reached the answer.']),branch('Send lesson sheets with a return address.','sh_lesson_leaflets',['Lesson sheets travel beyond the archive. Their margins name the source and an address where a reader can send a correction.'])],
    rewards:[I('prism_dust'),G(50)],reward:'1 Prism Dust; 50 crowns; a public lesson that can be corrected.'});
  const claimantNote=note('sh_note_claimants','The Three Return Requests','glass_steps',[11,6],[
    'The first owner asks for a quiet room facing East. The second asks for the West counter after work. The third asks for a North window with a South return shelf.',
    'The cases remain sealed. A name and a request can be matched without reading the memory inside. Set the archive mirrors East, West, North, South.'
  ],R('sh_returned_memories_started'));
  const memoryMirrors=mechanism('sh_memory_mirrors','The Return-Desk Mirrors','glass_archive',[11,11],{kind:'mirror',initial:[0,0,0,0],target:[1,3,0,2],labels:['Quiet room','After-work counter','Window','Return shelf']},'The owners\' requests set the order: East, West, North, South.',R('sh_note_claimants_read'));
  const memoryHand=delivery('sh_memory_hand','The Sealed Memory Return Desk','glass_archive',[26,11],{sh_memory_case:3},[
    'All three cases reach the matching return places. Each owner checks the seal before taking a case. No traveller opens one for them.',
    'The desk keeps a receipt that the case arrived. It does not keep another copy of the memory.'
  ],R('sh_memory_mirrors_done'));
  mission({id:'sh_returned_memories',name:'The Work Orin Promised',startZone:'glass_observatory',giver:'observatory_orin',speaker:'Orin',requires:R('orin_yields'),
    summary:'Read three owners\' requests, prepare the archive return places, and hand over all three sealed memory cases.',
    intro:['I said I would stay and return the memories. These three owners have answered my first notice.','The cases are sealed. Take them only to the places their owners requested. I need to learn how to return something without keeping a hand on it.'],startEffects:[I('sh_memory_case',3)],steps:[claimantNote,memoryMirrors,memoryHand],
    finish:['Orin puts the three return receipts in a small file. He leaves the next page blank until another owner answers.','The work can continue through private appointments, or through an open counter with screened return places. In either case, an owner can refuse or ask for more time.'],
    choices:[branch('Keep private return appointments.','sh_memories_appointments',['Orin keeps a small appointment book. Empty times remain empty when an owner asks him to wait.']),branch('Open a counter with screened return places.','sh_memories_counter',['The archive has an open return counter and screened rooms. The public notice describes the process, never the memories.'])],
    rewards:[I('echo_glass'),I('haven_supplies'),G(60)],reward:'1 Echo Glass; 1 Haven Supply; 60 crowns; Orin\'s promised work begins.'});
  board('sh_performance_board','The Square Rehearsal Board','glass_steps',[20,14],['The board asks for Nyx and a few people who remember dancing here. Reach the square with Nyx, then read the new page.']);
  const stageNote=note('sh_note_stage','The Square\'s Old Step Marks','glass_steps',[9,19],[
    'The dance circle used four edge lamps. A later order wired them into one repeating signal that says the square is closed.',
    'The public score was moved to the Ink Cistern. Return its visible steps to the square, then quiet the closure circuit. From a reset board, squares 2, 4, and 6 undo the old setting.'
  ],R('sh_square_performance_started'));
  const scoreField=field('sh_public_score','The Public Dance Score','glass_cistern',[19,19],'reveal',['Nyx reveals the public dance beneath the closure stamp. The score belongs to the people who used the square, not to a memory she must buy back.','She copies the steps and leaves a dated copy where another performer can find it.'],R('sh_note_stage_read'));
  const stageCircuit=mechanism('sh_stage_lamps','The Square\'s Edge Lamps','glass_steps',[12,13],{kind:'circuit',size:3,scramble:[1,3,5],goal:[0,0,0,0,0,0,0,0,0]},'Turn all nine closure lights off. The old step marks give a solution from reset: squares 2, 4, and 6, counted across the rows.',R('sh_public_score_done'));
  mission({id:'sh_square_performance',name:'The Square Was Never Quiet',startZone:'glass_steps',giver:'sh_performance_board',speaker:'The Square Rehearsal Group',requires:{chapterAtLeast:4,flags:['nyx_joined']},
    summary:'Read the old step marks, reveal the public score in the cistern, and reset the edge lamps for an open performance.',
    intro:['The archive called this a quiet square. People remember a place to dance, watch, rest, and meet after work.','Read the old marks. Nyx can recover the public score without asking anyone to sell another memory.'],steps:[stageNote,scoreField,stageCircuit],
    finish:['A first pair crosses the square. Others watch from the edge and can join when they choose.','Keep a circle with clear places to sit, or make a short procession that carries the dance past the nearby doors.'],
    choices:[branch('Keep an open circle with places to sit.','sh_performance_circle',['The circle has marked edges and seats. Watching is a full way to take part.']),branch('Carry a short procession past the doors.','sh_performance_procession',['A short line of ribbons marks the procession. It leaves the doorways clear and returns to the square before night.'])],
    rewards:[I('sh_stage_ribbon'),G(45)],reward:'Open Stage Ribbon; 45 crowns; the square gains a visible public performance.'});

  // Ash: machines can finish, routes can admit uncertainty, and mornings need care.
  const shiftNote=note('sh_note_shift','The First Empty Clock-In','ash_foundry',[9,13],[
    'On the first empty day, the foreman asked whether the last worker had arrived. The answer line was left blank.',
    'Every later shift copied that blank as a reason to keep working. Brace the manual brake before telling the foreman that no one remains on its roll.'
  ],R('sh_empty_shift_started'));
  const shiftBrake=field('sh_shift_brake','The Manual Clock-Out Brake','ash_foundry',[21,16],'brace',['Brann holds the manual brake. The drive slows enough for its register to accept a final answer.','The machine does not need another fuel supply. It needs a shift that is allowed to end.'],R('sh_note_shift_read'));
  const shiftFight=battle('sh_e_empty_shift','The Foreman\'s Last Shift','ash_foundry',[11,18],['sh_shift_foreman'],R('sh_shift_brake_done'),6,70,40,
    {intro:['The Unfinished Foreman treats the clock-out order as another fault to repair.','Use water or spark first. Its second phase opens to earth and wind.'],victory:['The drive stops. The register records every worker as safely absent, not late.']});
  mission({id:'sh_empty_shift',name:'Day Four Thousand and Nineteen',startZone:'ash_foundry',giver:'foundry_log',speaker:'The Foundry Shift Recorder',requires:R('ash_key'),
    summary:'Read the first empty clock-in, hold the manual brake, and stop the foreman from beginning another ownerless shift.',
    intro:['The Furnace Regent is down, but a small drive still stamps the attendance sheet. It has reached another day with no workers.','A manual record can end its roll. Read the first blank answer before you touch the brake.'],steps:[shiftNote,shiftBrake,shiftFight],
    finish:['The sheet receives one final line: the work has ended; all workers are accounted for. The new page stays still.','The quiet floor can hold a memorial to the people who worked here, or a small teaching forge that runs only while its keeper is present.'],
    choices:[branch('Make a memorial beside the stopped drive.','sh_shift_memorial',['The stopped drive has a memorial beside it. The empty roll is kept as a warning, not as the only account of the workers.']),branch('Open a small forge with a present keeper.','sh_shift_school',['A teaching forge stands clear of the old drive. Its first lesson is how to stop it and check that everyone has gone home.'])],
    rewards:[I('sh_kept_shift'),I('sh_shift_badge'),G(55)],reward:'A Finished Shift; Last Shift Badge; 55 crowns; the endless shift ends.'});
  const routeNote=note('sh_note_routes','The Homeward Survey','ash_dunes',[16,19],[
    'Three old markers point toward the brightest surface. Wind has exposed different metal, so brightness no longer tells a traveller where home lies.',
    'The buried relay pulse keeps its bearing. Check the pulse, then fasten all three route tags. A sign should name the shelter and the exposed ground, not promise that the weather cannot change.'
  ],R('sh_homeward_map_started'));
  const routeField=field('sh_route_pulse','The Buried Relay Bearing','ash_dunes',[8,19],'power',['Vale powers the buried marker long enough to compare its bearing with the relay. He writes down the direction and the limit of the check.'],R('sh_note_routes_read'));
  const routeHand=delivery('sh_route_hand','The Three-Marker Route Frame','ash_dunes',[26,6],{sh_route_tag:3},['All three checked tags are fastened to the frame. Travellers can read the route before committing to the open dunes.'],R('sh_route_pulse_done'));
  mission({id:'sh_homeward_map',name:'A Map That Admits the Wind',startZone:'ash_dunes',giver:'dunes_map',speaker:'The Route-Board Keeper',requires:{chapterAtLeast:3,flags:['vale_joined']},
    summary:'Read the homeward survey, check the buried relay bearing with Vale, and fasten three durable route tags.',
    intro:['The old board names the foundry and the skyway. It assumes the road home is obvious.','Three people have followed the wrong bright seam this month. Take these tags. Check the buried pulse before you mark the way back.'],startEffects:[I('sh_route_tag',3)],steps:[routeNote,routeField,routeHand],
    finish:['The new board names the relay and the last safe resting point. It leaves room to date the next weather report.','Mark the sheltered longer course as the first suggestion, or mark the direct course with a clear warning about its exposed stretch. The traveller will see both.'],
    choices:[branch('Lead with the sheltered course.','sh_route_sheltered',['The first arrow follows the shelters. A second line names the shorter exposed road and its limits.']),branch('Lead with the direct course and its warning.','sh_route_direct',['The direct arrow names its exposed stretch. The shelter route remains beside it for a traveller who wants more cover.'])],
    rewards:[I('storm_coil'),G(45)],reward:'1 Storm Coil; 45 crowns; a useful homeward route board.'});
  battle('sh_e_courier_gale','The Gale beside the New Markers','ash_dunes',[18,14],['sh_route_gale'],R('sh_homeward_map_done'),6,35,25,{loot:[{id:'ether',count:1}]});
  board('sh_morning_board','Ada\'s Breakfast Roster','ash_relay',[19,19],['Ada has left a page for the people who take turns greeting the morning. Read it after reaching this relay with the travellers.']);
  const morningPlate=field('sh_morning_plate','The Shared Hotplate','ash_relay',[14,6],'brace',['Brann sets the hotplate on a steady base. The three boxes will stay warm without someone holding the lid down.'],R('sh_morning_table_started'));
  const morningHand=delivery('sh_morning_hand','The Twelve-Place Breakfast Shelf','ash_relay',[21,15],{sh_breakfast_box:3},['Three four-person boxes fill all twelve places. The person who greeted the morning sits down before taking on another task.'],R('sh_morning_plate_done'));
  mission({id:'sh_morning_table',name:'Someone Has to Say Good Morning',startZone:'ash_relay',giver:'sh_morning_board',speaker:'Ada at the Breakfast Roster',requires:{chapterAtLeast:3,flags:['brann_joined']},
    summary:'Steady the shared hotplate and deliver three four-person breakfast boxes before choosing how the relay shares its morning work.',
    intro:['There are still twelve of us. We still take turns saying good morning. The person whose turn it is has been missing breakfast.','Here are three boxes, four places in each. Ask Brann to steady the hotplate, then bring the whole breakfast to the marked shelf.'],startEffects:[I('sh_breakfast_box',3)],steps:[morningPlate,morningHand],
    finish:['The greeter gets a warm meal. Ada writes a second name beside the next morning: someone who will notice if the first person needs a rest.','Keep a rotating pair who carry breakfast to the rooms, or set one common table with covered places for people who cannot join it.'],
    choices:[branch('Keep a rotating breakfast round.','sh_morning_round',['Two names share each breakfast round. A small cart carries the covered places to people who are resting.']),branch('Keep a common table with covered places.','sh_morning_table',['The common table has twelve places. Covered bowls can go to a room without taking that person off the roster.'])],
    rewards:[I('meal_road'),I('haven_supplies'),G(35)],reward:'1 Roadside Supper; 1 Haven Supply; 35 crowns; a morning with room for its keeper.'});
  const eliaNote=note('sh_note_elia','The Garden\'s Later Seasons','ash_skybridge',[7,19],[
    'Elia kept a dated count beside each planting. Some seeds did not grow. She changed the soil, tried another place, and left the earlier result in the book.',
    'Two dry envelopes remain in a sealed jar. One is marked for her father. The other is marked for whoever wants to try the next small bed.'
  ],R('sh_elias_garden_started'));
  const eliaField=field('sh_elia_bed','Elia\'s Open Seed Bed','ash_skybridge',[9,11],'grow',['Ilex loosens the soil around the old bed. New shoots have space to grow without hiding the stumps of plants that did not last.','The garden was never a single perfect morning. It was someone returning to the soil.'],R('sh_note_elia_read'));
  const eliaHand=delivery('sh_elia_hand','Orin\'s Open Window','glass_observatory',[16,19],{sh_elia_seed:2},[
    'Orin receives both envelopes. He opens the one Elia marked for him and leaves the other sealed for the next grower.',
    'He sets the first seed by the window she asked him to open. Then he opens the window.'
  ],R('sh_elia_bed_done'));
  mission({id:'sh_elias_garden',name:'The Next Good Morning',startZone:'ash_skybridge',giver:'skyway_record',speaker:'Elia\'s Garden Record',requires:R('future_bridge','orin_yields'),
    summary:'Read Elia\'s later planting notes, restore the open bed, and bring her two seed envelopes to Orin\'s window.',
    intro:['If you found this, I am older than my father thought I would ever be.','I grew these flowers in bad soil. Some did not grow. Most did.','Tell him that one good morning was never all I wanted. I wanted the next one, too.','Behind the first record is a later page and a sealed jar. Elia left two seed envelopes with the page. They can be carried back without asking the garden to become the same morning again.'],startEffects:[F('daughter_record_read'),I('sh_elia_seed',2)],steps:[eliaNote,eliaField,eliaHand],finishEntity:'observatory_orin',finishZone:'glass_observatory',finishSpeaker:'Orin',
    finish:['Orin leaves the planting book open at a page where a seed failed. He can keep trying without turning the failure into a reason to close the window.','He will keep Elia\'s marked envelope. The next-grower seeds can begin a public window box, or a quiet test bed whose dated results remain available to anyone who asks.'],
    choices:[branch('Plant a public window box.','sh_elia_shared',['The window box faces the square. A label names Elia and the later season that sent its seeds home.']),branch('Keep a quiet test bed and share its dated record.','sh_elia_private',['The small test bed is quiet. Its record can be read without turning the plants into a public performance.'])],
    rewards:[I('living_fiber'),I('ingredient_fruit',2),G(55)],reward:'1 Living Fiber; 2 Sun Fruit; 55 crowns; Elia\'s seeds reach the open window.'});

  // The Fold holds room for the ordinary lives that its grand echoes left out.
  const riverNote=note('sh_note_river','The Boatman\'s Unflooded Banks','fold_shore',[19,6],[
    'The boatman\'s river never flooded in his own unchosen road. That does not mean every possible river must stay closed.',
    'Six measures of water can make a modest channel: two along the first bank, three through the open middle, one beside the return reeds. The water must have a way home.'
  ],R('sh_unchosen_river_started'));
  const riverSluice=mechanism('sh_river_sluice','The Small River Sluice','fold_shore',[12,6],{kind:'sluice',initial:[0,0,0],target:[2,3,1],capacity:6,total:6,labels:['First bank','Open middle','Return reeds']},'Six measures: First bank 2; Open middle 3; Return reeds 1.',R('sh_note_river_read'));
  const riverReeds=field('sh_return_reeds','The River\'s Return Reeds','fold_gallery',[6,17],'grow',['Ilex grows a small return root beside the gallery. The water can move without asking a whole lost road to become real.','A reed floats back to the boatman\'s bank. The small river has somewhere to return.'],R('sh_river_sluice_done'));
  mission({id:'sh_unchosen_river',name:'A Chance for the River',startZone:'fold_shore',giver:'shore_boatman',speaker:'The Unchosen Boatman',requires:R('fold_open'),
    summary:'Read the boatman\'s banks, open a small balanced channel, and grow its return reeds before choosing how he will tend it.',
    intro:['I told you I did not need to become real. That is still true. I would like the river to have a chance.','There may be room for a small channel here. Read its banks and leave a way for the water to return.'],steps:[riverNote,riverSluice,riverReeds],
    finish:['The boat touches moving water. The boatman does not claim to remember a voyage he never made.','He can keep a modest mooring for the echoes who want to sit near the water, or tend a reed bank that lets seeds find their own way through.'],
    choices:[branch('Keep a small mooring beside the channel.','sh_river_mooring',['The boat rests beside a small mooring. Echoes can sit near the moving water without pretending they took the same journey.']),branch('Tend a reed bank for travelling seeds.','sh_river_reeds',['Seeds pass through a loose bank of reeds. The boatman keeps their return channel open.'])],
    rewards:[I('echo_glass'),G(60)],reward:'1 Echo Glass; 60 crowns; a small returning river in the Fold.'});
  board('sh_hours_board','The Small Hours Album','fold_gallery',[16,19],['The album has places for a kept watch, a resting season, an honest answer, and a shift allowed to end. The boatman\'s small river must also be open.']);
  const hoursNote=note('sh_note_hours','What the Great Echoes Omitted','fold_gallery',[21,6],[
    'The gallery shows a clockmaker who stayed, a bellkeeper who counted every name, and a guardian who kept every leaf. Each great picture leaves out the people beside it.',
    'A watch someone can leave, a seed someone need not hurry, an answer that asks for no debt, and a shift that may finish: these small acts are also parts of a life.'
  ],R('sh_unfinished_hour_started'));
  const hoursHand=delivery('sh_hours_hand','The Four Open Album Places','fold_gallery',[18,11],{sh_kept_lamp:1,sh_kept_seed:1,sh_kept_word:1,sh_kept_shift:1},[
    'All four tokens reach the album. Their accounts name the people who acted and the limits of what each act repaired.',
    'The pages do not claim that these few acts saved every life. They show why a life contains more than its greatest turning point.'
  ],R('sh_note_hours_read'));
  const hoursFight=battle('sh_e_unfinished_hour','The Frame around the Great Hour','fold_gallery',[11,6],['sh_unspent_frame'],R('sh_hours_hand_done'),12,100,60,
    {intro:['The Unspent Frame tries to fit four ordinary accounts into one grand moment.','It begins weak to wind and water. Read each new weakness as its borders open.'],victory:['The frame opens without breaking the pages. There is room beside the great echoes for the lives that continued around them.']});
  mission({id:'sh_unfinished_hour',name:'The Hours That Make a Life',startZone:'fold_gallery',giver:'sh_hours_board',speaker:'The Keeper of the Small Hours Album',requires:R('fold_open','sh_lantern_watch_done','sh_four_seasons_done','sh_unsaid_apology_done','sh_empty_shift_done','sh_unchosen_river_done'),
    summary:'Read what the great echoes left out, place the four kept-hour tokens in the album, and open the frame around the gallery\'s single grand moment.',
    intro:['The gallery remembers the choice that changed a life. It has not kept enough room for the mornings that came before and after.','Bring the watch, the season, the answer, and the finished shift to these four places. Keep their accounts small enough to remain true.'],steps:[hoursNote,hoursHand,hoursFight],
    finish:['The clockmaker\'s echo has a neighbour at her window. The bellkeeper hears someone still able to answer. A new shoot stands beside the guardian\'s fallen leaf.','The album can stay open in the gallery, or its copies can travel back to the people who made each hour. In either case, blank pages remain.'],
    choices:[branch('Keep an open album in the gallery.','sh_hours_album',['The album rests beside the great echoes. Visitors can add a small account without having to call it the most important hour in the world.']),branch('Send copies home and keep an open return page.','sh_hours_carried',['Copies leave the Fold in simple cases. The return page remains open for a correction, a new account, or an ordinary morning no one has written down yet.'])],
    rewards:[I('sh_small_album'),I('haven_supplies',2),G(75)],effects:[F('sh_small_hours_complete')],reward:'Small Hours Album; 2 Haven Supplies; 75 crowns; The Small Hours resolved.'});

  // Small Hours follow-ups extend existing end scenes without replacing their facts or effects.
  const followupIds=[];
  function followup(id,flag,lines){const d=C.dialogues[id];if(!d)return;d.variants=[{requires:R(flag),lines:[...(d.lines||[]),...lines]},...(d.variants||[])];followupIds.push(id);}
  followup('mira_watch_done','sh_shared_supper_done',['Fenn leaves his own tools for the shared supper. The minute spent outside has people in it.']);
  followup('soren_bell_done','sh_seventh_refrain_done',['After the names are spoken, the watchers answer with their short new refrain. The living have a turn beside the memory.']);
  followup('brann_hearth_done','sh_morning_table_done',['The breakfast roster gives the room\'s keeper a second pair of hands. A lasting home still needs someone who notices when another person is tired.']);
  followup('ilex_winter_done','sh_four_seasons_done',['The four resting trays have taught the young keepers to date their observations. They no longer call an unopened seed a failed one.']);
  followup('nyx_name_done','sh_square_performance_done',['The two painted dancers now overlook a living performance. The new steps need not match the picture to belong in the same square.']);
  followup('vale_letter_done','sh_homeward_map_done',['The route tags name the way back to those shoots. A traveller can read the exposed stretch before deciding to cross it.']);
  followup('kiln_apprentice','sh_shared_supper_done',['The supper trays have a place beside the tools. Fenn is learning to put his own work down before the food goes cold.']);
  followup('ash_ada','sh_morning_table_done',['The morning roster now names the helper as well as the greeter. Neither has to ask whether there will be a place left at breakfast.']);
  followup(find('relay_renn').dialogue,'sh_homeward_map_done',['The new signs admit where the dunes are exposed. Renn trusts a board that names its limits more than one that promises an easy road.']);
  followup('archive_orin_hint','sh_returned_memories_done',['Orin\'s assistant now keeps sealed return cases beside the old cup. The owners\' requests decide when the cases leave.']);
  for(const id of ['orchard_gates','orchard_after_bridge','orchard_before_end'])followup(id,'sh_shade_to_come_done',['Tessa has copied Neri\'s little root mark beside the orchard record. Its later shade is another reason to leave a next season open.']);
  followup('fold_mira','sh_small_hours_complete',['There is someone at the neighbour\'s window now. The clockmaker\'s echo has stopped counting the empty quay as the whole of her life.']);
  followup('fold_soren','sh_small_hours_complete',['The bellkeeper\'s echo pauses. From the small river comes an answer he did not put on a list.']);
  followup('fold_ilex','sh_small_hours_complete',['A new shoot stands beside the fallen leaf. The guardian\'s echo leaves room for both.']);

  const consequences=[
    ['sh_copper_key','bell_quay',['bell_quay'],['sh_key_working','The key returns to a working tool chest.'],['sh_key_history','A key display keeps the old account beside a new working copy.']],
    ['sh_shared_supper','bell_kiln',['bell_orchard','bell_quay'],['sh_supper_garden','A meal table stands under the orchard trees.'],['sh_supper_dock','Covered meal trays wait beside the harbour watch.']],
    ['sh_seventh_refrain','bell_quay',['bell_quay'],['sh_refrain_soft','Small chimes mark the quiet arrangement.'],['sh_refrain_full','Four pennants mark the full short chorus.']],
    ['sh_lantern_watch','bell_tower',['bell_tower','ash_dunes'],['sh_watch_steady','Tall steady lamps lead the watch and survive in a later dune-road plan.'],['sh_watch_sheltered','Low hooded lamps shelter the watch and survive beside the future dune road.']],
    ['sh_neri_stick','seed_camp',['seed_camp'],['sh_stick_trellis','The dead branch supports a new vine.'],['sh_stick_perch','The dead branch gives birds a place beside the seedling.']],
    ['sh_pollinator_route','seed_wilds',['seed_wilds','seed_falls'],['sh_pollinator_hedge','A loose hedge shelters the moth route.'],['sh_pollinator_sunstrip','A low flowering strip keeps the moth route in the light.']],
    ['sh_four_seasons','seed_vault',['seed_vault','ash_skybridge'],['sh_seasons_mixed','Mixed small seasonal beds leave a plan for the future garden.'],['sh_seasons_rotating','Four rotating beds leave dated marks for the future garden.']],
    ['sh_shade_to_come','seed_camp',['ash_skybridge'],['sh_shade_bench','A bench rests beside the later root.'],['sh_shade_birds','Birds carry the later root\'s seeds beyond the skyway.']],
    ['sh_unsaid_apology','glass_steps',['glass_steps'],['sh_apology_letter','Mara receives a letter that does not ask her to promise forgiveness.'],['sh_apology_visit','Two chairs mark a short visit at a time Mara chose.']],
    ['sh_open_lesson','glass_archive',['glass_archive'],['sh_lesson_desk','A public desk keeps the source and correction together.'],['sh_lesson_leaflets','Lesson sheets carry a return address for corrections.']],
    ['sh_returned_memories','glass_observatory',['glass_archive'],['sh_memories_appointments','A small appointment book follows the owners\' requests.'],['sh_memories_counter','A public counter has screened return places.']],
    ['sh_square_performance','glass_steps',['glass_steps'],['sh_performance_circle','An open dance circle leaves places to sit.'],['sh_performance_procession','A short procession leaves the doorways clear.']],
    ['sh_empty_shift','ash_foundry',['ash_foundry'],['sh_shift_memorial','A memorial stands beside the stopped drive.'],['sh_shift_school','A teaching forge runs only while its keeper is present.']],
    ['sh_homeward_map','ash_dunes',['ash_dunes'],['sh_route_sheltered','The first route suggestion follows the shelters.'],['sh_route_direct','The direct route names its exposed stretch.']],
    ['sh_morning_table','ash_relay',['ash_relay'],['sh_morning_round','A small cart serves the rotating breakfast round.'],['sh_morning_table','A twelve-place table keeps covered portions for resting people.']],
    ['sh_elias_garden','ash_skybridge',['ash_skybridge','glass_observatory'],['sh_elia_shared','Elia\'s later seeds grow in a public window box.'],['sh_elia_private','A quiet test bed has a dated record that others can read.']],
    ['sh_unchosen_river','fold_shore',['fold_shore'],['sh_river_mooring','A small mooring rests beside the returning channel.'],['sh_river_reeds','Seeds travel through a loose bank of return reeds.']],
    ['sh_unfinished_hour','fold_gallery',['fold_gallery','fold_shore'],['sh_hours_album','The album remains open beside the great echoes.'],['sh_hours_carried','Copies travel home while the return page stays open.']]
  ].flatMap(([mission,source,targets,...choices])=>choices.map(([flag,text])=>({flag,mission,source,targets,text})));
  C.temporalChanges=(C.temporalChanges||[]).concat(consequences);C.smallHours.consequences=consequences;C.smallHours.followupIds=followupIds;
  // Later complete scenes take precedence at a shared contact. Original routes remain fallbacks.
  for(const [id,entries]of hooks){const e=find(id),ordered=[...entries.filter(v=>v.rank===0),...entries.filter(v=>v.rank===1),...entries.filter(v=>v.rank===2),...entries.filter(v=>v.rank===3).reverse()];e.variants=[...ordered.map(({rank,...v})=>v),...(e.variants||[])];}
  C.smallHours.missionIds=missionIds;C.smallHours.noteIds=noteIds;C.smallHours.zoneIds=[...usedZones];C.smallHours.encounterIds=encounterIds;C.smallHours.enemyIds=enemyIds;C.smallHours.choiceFlags=choiceFlags;C.smallHours.entityIds=entityIds;
  const additions=C.zones.flatMap(z=>z.entities||[]).filter(e=>entityIds.includes(e.id));
  C.smallHours.counts={missions:missionIds.length,notes:noteIds.length,zones:usedZones.size,newMaps:0,encounters:encounterIds.length,enemyTypes:enemyIds.length,decisions:choiceFlags.length/2,choiceFlags:choiceFlags.length,steps:C.missions.filter(m=>m.campaign==='small').reduce((n,m)=>n+m.steps.length,0),deliveries:additions.filter(e=>e.type==='delivery').length,mechanisms:additions.filter(e=>e.type==='mechanism').length,fieldActions:additions.filter(e=>e.type==='field').length,performances:additions.filter(e=>e.type==='minigame').length,legacyFollowups:followupIds.length};
  C.zoneById=Object.fromEntries(C.zones.map(z=>[z.id,z]));C.refreshCounts?.();
})(globalThis);
