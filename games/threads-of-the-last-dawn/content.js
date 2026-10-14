/* Threads of the Last Dawn — original campaign data. No DOM or engine internals. */
(function (global) {
  'use strict';
  const C = {};
  const flag = id => ({type:'flag',id,value:true});
  const chapter = value => ({type:'chapter',value});
  const item = (id,count=1) => ({type:'item',id,count});
  const gold = amount => ({type:'gold',amount});
  const quest = (id,status='active') => ({type:'quest',id,status});
  const recruit = id => ({type:'recruit',id});
  const req = (...flags) => ({flags});
  const keyed = rows => Object.fromEntries(rows.map(row => [row.id,row]));

  C.meta = {
    title:'Threads of the Last Dawn', subtitle:'A journey through the hours we leave behind',
    initialDate:'2026-10-11', source:'Chrono Trigger (SNES)',
    gameEngine:'my-3D2dge 0.24.0 (handoff commit 240dc2fe39b14fc5cc1ebbed796c29dd827d8ab6)',
    engineUrl:'https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff',
    environment:'ChatGPT cloud workspace; Linux; Bash CLI; browser game',
    model:'GPT-6 Astra Pro', effort:'Not independently confirmed',
    originality:'All story, characters, places, dialogue, encounter designs, and item names in this file are original.',
    startZone:'bell_quay', startParty:['mira','soren'], startChapter:1,
    startInventory:{tonic:6,ether:3,phoenix:2,panacea:2}, startGold:100,
    overview:'An orchard joins four ages. Its fruit begins to lose its colour. Six travellers must stop an engine that burns possible futures to keep one day alive.',
    controls:'Move with WASD or arrow keys. Press E or Enter to interact. Touch controls are available. Save at a shrine or from the menu.',
    completion:'Eight story chapters, four historical ages, one region outside time, six optional companion quests, nine bosses, four endings, and New Game Plus.',
    accessibility:'Gauges run on the base command menu. Wait mode pauses technique, item, and target lists. Enemy charge warnings stay visible. Shrines restore the full party.'
  };

  C.eras = [
    {id:'bell642',name:'Age of Bells',year:'642',colour:'#edbb63',description:'A harbour lives by the sound of seven bells. The orchard above it has missed a season.'},
    {id:'seed112',name:'Seed Age',year:'112',colour:'#76bb79',description:'The first orchard grows beside a deep river. People still ask the forest before they build.'},
    {id:'glass1186',name:'Glass Republic',year:'1186',colour:'#ababe9',description:'A city stores its past in glass. Its citizens can sell a memory and buy a quieter life.'},
    {id:'ash2310',name:'Ash Tomorrow',year:'2310',colour:'#e69b78',description:'Dust covers the last roads. A small relay still carries letters that have no address.'},
    {id:'fold',name:'The Fold',year:'Outside time',colour:'#f0d7a2',description:'Unused hours collect here. The Still Engine waits at the centre of a dawn that cannot end.'}
  ];

  C.heroes = keyed([
    {id:'mira',name:'Mira',title:'Clockmaker',role:'Fast wind and blade attacks',age:'642',colour:'#74d9ce',maxHp:172,maxMp:34,atk:18,mag:15,def:9,speed:15,weapon:'blade',skills:['arc_cut','crosswind','second_step','skywheel'],bio:'Mira repairs clocks in Larkspur Quay. She can repair any spring except the one in her late father\'s watch.',join:'Start'},
    {id:'soren',name:'Soren',title:'Bellkeeper',role:'Water, healing, and revival',age:'642',colour:'#86bcf2',maxHp:184,maxMp:42,atk:12,mag:20,def:10,speed:11,weapon:'staff',skills:['tide_lance','mend','full_chime','wake'],bio:'Soren rings the harbour bells. He remembers every person whose ship did not return.',join:'Start'},
    {id:'brann',name:'Brann',title:'Kiln Guard',role:'Fire damage and party defence',age:'642',colour:'#ef9766',maxHp:232,maxMp:30,atk:23,mag:13,def:15,speed:9,weapon:'hammer',skills:['cinder_hammer','furnace_wave','iron_oath','meteor_anvil'],bio:'Brann guards the public kiln. He believes a town is only safe when its smallest home is warm.',join:'Chapter 1, Copper Kiln'},
    {id:'ilex',name:'Ilex',title:'Root Guardian',role:'Earth, poison, and recovery',age:'112',colour:'#9bd776',maxHp:205,maxMp:40,atk:16,mag:19,def:12,speed:10,weapon:'branch',skills:['thornbind','green_pulse','spore_circle','oldwood'],bio:'Ilex grew from the first orchard\'s roots. They have never seen a winter and want to learn what comes after one.',join:'Chapter 2, Mosswake Camp'},
    {id:'nyx',name:'Nyx',title:'Archive Dancer',role:'Void damage and control',age:'1186',colour:'#c69aee',maxHp:166,maxMp:46,atk:17,mag:23,def:8,speed:16,weapon:'ribbon',skills:['paperblade','quiet_hour','mirror_dance','night_archive'],bio:'Nyx performs forbidden memories in public squares. She knows that a story can survive after its records are gone.',join:'Chapter 4, Prism Steps'},
    {id:'vale',name:'Vale',title:'Last Courier',role:'Spark damage and speed',age:'2310',colour:'#f3cf68',maxHp:190,maxMp:36,atk:22,mag:18,def:10,speed:14,weapon:'caster',skills:['sparkshot','rail_flash','pulse_cache','redline'],bio:'Vale keeps the last delivery route open. He has carried the same sealed letter for eleven years.',join:'Chapter 3, Cinder Relay'}
  ]);

  C.skills = keyed([
    {id:'arc_cut',name:'Arc Cut',cost:2,power:1.65,type:'physical',target:'enemy',element:'physical',description:'A strong blade strike against one enemy.'},
    {id:'crosswind',name:'Crosswind',cost:4,power:1.30,type:'magic',target:'line',element:'wind',description:'Wind passes through enemies in a line.'},
    {id:'second_step',name:'Second Step',cost:4,power:0,type:'support',target:'self',element:'wind',status:{haste:12},description:'Mira acts faster for a short time.'},
    {id:'skywheel',name:'Skywheel',cost:8,power:1.65,type:'magic',target:'circle',element:'wind',description:'A wide wind spiral strikes nearby enemies.'},
    {id:'tide_lance',name:'Tide Lance',cost:4,power:1.35,type:'magic',target:'line',element:'water',description:'Water strikes enemies along a narrow line.'},
    {id:'mend',name:'Mend',cost:4,power:1.90,type:'heal',target:'ally',element:'water',description:'Restore a large amount of one ally\'s health.'},
    {id:'full_chime',name:'Full Chime',cost:9,power:1.15,type:'heal',target:'allAllies',element:'water',description:'Restore health to every active ally.'},
    {id:'wake',name:'Wake',cost:9,power:0.50,type:'revive',target:'ally',element:'water',description:'Revive one fallen ally with half health.'},
    {id:'cinder_hammer',name:'Cinder Hammer',cost:3,power:1.70,type:'physical',target:'enemy',element:'fire',status:{burn:7},description:'A heavy strike also burns its target.'},
    {id:'furnace_wave',name:'Furnace Wave',cost:7,power:1.25,type:'magic',target:'allEnemies',element:'fire',description:'Fire sweeps across the enemy group.'},
    {id:'iron_oath',name:'Iron Oath',cost:5,power:0,type:'support',target:'allAllies',element:'earth',status:{guard:10},description:'Reduce damage to the full party.'},
    {id:'meteor_anvil',name:'Meteor Anvil',cost:8,power:1.75,type:'physical',target:'circle',element:'physical',description:'A falling hammer strikes a close group.'},
    {id:'thornbind',name:'Thornbind',cost:3,power:1.30,type:'magic',target:'enemy',element:'earth',status:{slow:8},description:'Roots damage and slow one enemy.'},
    {id:'green_pulse',name:'Green Pulse',cost:7,power:0.95,type:'heal',target:'allAllies',element:'earth',cleanse:true,description:'Restore party health and remove harmful conditions.'},
    {id:'spore_circle',name:'Spore Circle',cost:6,power:1.10,type:'magic',target:'circle',element:'earth',status:{poison:12},description:'Poison enemies in a small area.'},
    {id:'oldwood',name:'Oldwood',cost:6,power:0,type:'support',target:'allAllies',element:'earth',status:{guard:14},description:'Thick bark protects the party for a longer time.'},
    {id:'paperblade',name:'Paperblade',cost:4,power:1.35,type:'magic',target:'line',element:'void',description:'A sharp ribbon of lost words cuts through a line.'},
    {id:'quiet_hour',name:'Quiet Hour',cost:6,power:0.45,type:'magic',target:'allEnemies',element:'void',status:{slow:10},description:'Slow every enemy and deal light void damage.'},
    {id:'mirror_dance',name:'Mirror Dance',cost:4,power:0,type:'support',target:'self',element:'void',status:{haste:14},description:'Nyx moves between reflections and acts faster.'},
    {id:'night_archive',name:'Night Archive',cost:9,power:1.55,type:'magic',target:'allEnemies',element:'void',description:'Lost memories strike every enemy.'},
    {id:'sparkshot',name:'Sparkshot',cost:3,power:1.60,type:'magic',target:'enemy',element:'spark',description:'A focused spark strikes one target.'},
    {id:'rail_flash',name:'Rail Flash',cost:5,power:1.45,type:'magic',target:'line',element:'spark',description:'A bright rail cuts through enemies in a line.'},
    {id:'pulse_cache',name:'Pulse Cache',cost:7,power:0,type:'support',target:'allAllies',element:'spark',status:{haste:9},description:'Stored power makes the party act faster.'},
    {id:'redline',name:'Redline',cost:9,power:2.70,type:'magic',target:'enemy',element:'spark',description:'Spend more power for a very strong single shot.'},
    {id:'rainwheel',name:'Rainwheel',combo:['mira','soren'],costs:{mira:4,soren:4},power:1.50,type:'magic',target:'allEnemies',element:'water',description:'Wind carries Soren\'s tide across the field.'},
    {id:'forge_gale',name:'Forge Gale',combo:['mira','brann'],costs:{mira:4,brann:4},power:1.70,type:'magic',target:'circle',element:'fire',status:{burn:7},description:'A hot wind gathers enemies in a ring of fire.'},
    {id:'leafstorm',name:'Leafstorm',combo:['mira','ilex'],costs:{mira:4,ilex:4},power:1.50,type:'magic',target:'allEnemies',element:'earth',status:{poison:8},description:'Wind fills the field with sharp leaves.'},
    {id:'shadow_waltz',name:'Shadow Waltz',combo:['mira','nyx'],costs:{mira:5,nyx:5},power:2.10,type:'physical',target:'enemy',element:'void',description:'Two dancers strike one target from both sides.'},
    {id:'stormline',name:'Stormline',combo:['mira','vale'],costs:{mira:4,vale:5},power:1.70,type:'magic',target:'line',element:'spark',description:'Wind holds a bright rail in place.'},
    {id:'tempered_tide',name:'Tempered Tide',combo:['soren','brann'],costs:{soren:5,brann:4},power:1.10,type:'heal',target:'allAllies',element:'water',status:{guard:9},description:'Warm water heals the party and adds protection.'},
    {id:'spring_return',name:'Spring Return',combo:['soren','ilex'],costs:{soren:5,ilex:5},power:1.40,type:'heal',target:'allAllies',element:'earth',cleanse:true,description:'Clean water and roots restore every active ally.'},
    {id:'moon_tide',name:'Moon Tide',combo:['soren','nyx'],costs:{soren:4,nyx:5},power:1.45,type:'magic',target:'allEnemies',element:'water',status:{slow:7},description:'Reflected water damages and slows every enemy.'},
    {id:'live_current',name:'Live Current',combo:['soren','vale'],costs:{soren:5,vale:5},power:1.80,type:'magic',target:'allEnemies',element:'spark',description:'Vale sends a spark through Soren\'s rain.'},
    {id:'root_furnace',name:'Root Furnace',combo:['brann','ilex'],costs:{brann:5,ilex:4},power:1.70,type:'magic',target:'circle',element:'fire',status:{burn:9},description:'Roots hold a fire below a close enemy group.'},
    {id:'black_anvil',name:'Black Anvil',combo:['brann','nyx'],costs:{brann:5,nyx:5},power:2.00,type:'physical',target:'enemy',element:'void',description:'A reflected hammer hits where armour is thin.'},
    {id:'copper_bloom',name:'Copper Bloom',combo:['ilex','vale'],costs:{ilex:5,vale:5},power:1.60,type:'magic',target:'allEnemies',element:'spark',status:{slow:6},description:'Metal flowers spread a spark across the field.'},
    {id:'first_light',name:'First Light',combo:['mira','soren','brann'],costs:{mira:6,soren:6,brann:6},bondCost:100,power:2.00,type:'magic',target:'allEnemies',element:'fire',description:'Wind, water, and heat create a new sun. Uses a full Bond gauge.'},
    {id:'evergreen',name:'Evergreen',combo:['soren','ilex','nyx'],costs:{soren:6,ilex:6,nyx:6},bondCost:100,power:2.30,type:'heal',target:'allAllies',element:'earth',cleanse:true,status:{guard:12},description:'Every remembered spring returns. Heal, cleanse, and protect the party.'},
    {id:'borrowed_dawn',name:'Borrowed Dawn',combo:['mira','nyx','vale'],costs:{mira:7,nyx:7,vale:7},bondCost:100,power:2.30,type:'magic',target:'allEnemies',element:'void',description:'Three travellers strike through a missing hour. Uses full Bond.'},
    {id:'worldseed',name:'Worldseed',combo:['brann','ilex','vale'],costs:{brann:7,ilex:7,vale:7},bondCost:100,power:2.35,type:'magic',target:'allEnemies',element:'earth',description:'Fire, roots, and power form a seed of a new world. Uses full Bond.'}
  ]);

  C.items = keyed([
    {id:'tonic',name:'Orchard Tonic',kind:'consumable',price:20,effect:{type:'heal',amount:80},description:'Restore 80 health to one ally.'},
    {id:'ether',name:'Blue Nectar',kind:'consumable',price:45,effect:{type:'mp',amount:30},description:'Restore 30 skill points to one ally.'},
    {id:'phoenix',name:'Dawn Salt',kind:'consumable',price:65,effect:{type:'revive',amount:0.5},description:'Revive one fallen ally with half health.'},
    {id:'panacea',name:'Clear Dew',kind:'consumable',price:30,effect:{type:'cleanse'},description:'Remove harmful conditions from one ally.'},
    {id:'elixir',name:'Last Fruit',kind:'consumable',price:250,effect:{type:'elixir'},description:'Fully restore one ally\'s health and skill points.'},
    {id:'mira_blade',name:'Minute Hand',kind:'weapon',slot:'weapon',hero:'mira',price:130,stats:{atk:6,speed:1},description:'A blade made from a large clock hand.'},
    {id:'mira_relic',name:'Tomorrow\'s Edge',kind:'weapon',slot:'weapon',hero:'mira',price:620,stats:{atk:14,mag:5,speed:2},description:'Its shadow arrives a moment before the blade.'},
    {id:'soren_staff',name:'Tide Bell',kind:'weapon',slot:'weapon',hero:'soren',price:130,stats:{mag:7,maxMp:5},description:'A small bell keeps the sound of the sea.'},
    {id:'soren_relic',name:'Seventh Chime',kind:'weapon',slot:'weapon',hero:'soren',price:620,stats:{mag:16,maxMp:14},description:'A clear note that can reach an empty harbour.'},
    {id:'brann_hammer',name:'Copper Oath',kind:'weapon',slot:'weapon',hero:'brann',price:150,stats:{atk:8,def:2},description:'Every kiln worker has left a mark on its head.'},
    {id:'brann_relic',name:'Hearthkeeper',kind:'weapon',slot:'weapon',hero:'brann',price:650,stats:{atk:17,def:5},description:'A hammer made to build a home after the fire.'},
    {id:'ilex_branch',name:'River Crook',kind:'weapon',slot:'weapon',hero:'ilex',price:160,stats:{mag:7,def:2},description:'A branch that still draws water from the air.'},
    {id:'ilex_relic',name:'Winter Seed',kind:'weapon',slot:'weapon',hero:'ilex',price:640,stats:{mag:15,maxHp:35},description:'A seed that can wait through any winter.'},
    {id:'nyx_ribbon',name:'Silver Margin',kind:'weapon',slot:'weapon',hero:'nyx',price:180,stats:{atk:5,mag:8},description:'A ribbon cut from a discarded memory sheet.'},
    {id:'nyx_relic',name:'Unwritten Name',kind:'weapon',slot:'weapon',hero:'nyx',price:650,stats:{atk:8,mag:16,speed:2},description:'A blank page that refuses to forget its owner.'},
    {id:'vale_caster',name:'Relay Caster',kind:'weapon',slot:'weapon',hero:'vale',price:180,stats:{atk:7,mag:6},description:'A courier tool rebuilt for a rough route.'},
    {id:'vale_relic',name:'Return Address',kind:'weapon',slot:'weapon',hero:'vale',price:650,stats:{atk:14,mag:12,speed:2},description:'A bright signal always finds its way home.'},
    {id:'quilted_coat',name:'Quilted Coat',kind:'armor',slot:'armor',price:85,stats:{def:4,maxHp:15},description:'A warm coat from Larkspur Quay.'},
    {id:'bark_mail',name:'Bark Mail',kind:'armor',slot:'armor',price:170,stats:{def:7,maxHp:25},description:'Living bark spreads the force of a blow.'},
    {id:'kiln_apron',name:'Kiln Apron',kind:'armor',slot:'armor',price:210,stats:{def:9,maxHp:20},description:'Heavy cloth with a thin copper lining.'},
    {id:'glassweave',name:'Glassweave',kind:'armor',slot:'armor',price:290,stats:{def:10,mag:4,maxMp:8},description:'Fine glass threads carry a soft glow.'},
    {id:'relay_shell',name:'Relay Shell',kind:'armor',slot:'armor',price:330,stats:{def:12,speed:2,maxHp:25},description:'A light shell made for long roads.'},
    {id:'dawn_mantle',name:'Dawn Mantle',kind:'armor',slot:'armor',price:650,stats:{def:17,maxHp:50,maxMp:10},description:'Woven from hours that people chose to share.'},
    {id:'copper_ring',name:'Copper Ring',kind:'accessory',slot:'accessory',price:100,stats:{atk:4},description:'A plain ring with a strong grip.'},
    {id:'dew_pendant',name:'Dew Pendant',kind:'accessory',slot:'accessory',price:120,stats:{mag:4,maxMp:8},description:'A drop of clean water never leaves its glass.'},
    {id:'swift_spool',name:'Swift Spool',kind:'accessory',slot:'accessory',price:180,stats:{speed:4},description:'The thread unwinds faster than a falling leaf.'},
    {id:'root_charm',name:'Root Charm',kind:'accessory',slot:'accessory',price:200,stats:{maxHp:45,def:3},description:'A carved root remembers the strength of a tree.'},
    {id:'memory_lens',name:'Memory Lens',kind:'accessory',slot:'accessory',price:240,stats:{mag:7,maxMp:10},description:'Read a lost word through the small glass.'},
    {id:'dawn_knot',name:'Dawn Knot',kind:'accessory',slot:'accessory',price:420,stats:{atk:5,mag:5,def:4,speed:2},description:'Six threads hold without a single centre.'},
    {id:'root_compass',name:'Root Compass',kind:'key',description:'It points to roots that grow through time.'},
    {id:'seed_key',name:'First Seed',kind:'key',description:'One of the four living seals of the orchard.'},
    {id:'ash_key',name:'Warm Coal',kind:'key',description:'A coal from a furnace that refused to go cold.'},
    {id:'glass_key',name:'Clear Memory',kind:'key',description:'A record of the day the Still Engine began.'},
    {id:'dawn_seed',name:'Bridge Seed',kind:'key',description:'Plant it at the marked bed beside the First Falls.'},
    {id:'small_bell',name:'Unrung Bell',kind:'key',description:'A child\'s bell, returned by the roots.'},
    {id:'blueprint',name:'Warm Hearth Plan',kind:'key',description:'A safe kiln vent that can outlast its builder.'},
    {id:'name_shard',name:'Name Shard',kind:'key',description:'A fragment of a life that the archive removed.'},
    {id:'old_letter',name:'Sealed Letter',kind:'key',description:'A letter addressed to anyone who still waits.'}
  ]);

  C.chapters = [
    {id:1,title:'The Silent Fruit',entryZone:'bell_quay',summary:'A black fruit falls before its time. Follow the stopped bells to their source.',goal:'Speak to Tessa in the Orchard of Hours. Find Brann in the Copper Kiln. Defeat the Bell Warden in the Seventh Tower.',objectives:[{text:'Inspect the silent fruit with Tessa.',zone:'bell_orchard',flag:'orchard_seen'},{text:'Ask Brann to join the journey.',zone:'bell_kiln',flag:'brann_joined'},{text:'Defeat the Bell Warden.',zone:'bell_tower',flag:'bell_key'}]},
    {id:2,title:'The First Root',entryZone:'seed_camp',summary:'The Root Compass opens a road to the orchard\'s first spring.',goal:'Use the green gate in the Orchard of Hours. Meet Ilex at Mosswake Camp. Defeat the Root Crown in the Root Vault.',objectives:[{text:'Meet Ilex at Mosswake Camp.',zone:'seed_camp',flag:'ilex_joined'},{text:'Cross the First Falls to the Root Vault.',zone:'seed_vault',flag:'seed_key'}]},
    {id:3,title:'A Road of Ash',entryZone:'ash_relay',summary:'The future has no sunrise. Its last courier still keeps his route.',goal:'Use the amber gate in the Orchard of Hours. Meet Vale at Cinder Relay. Defeat the Furnace Regent in the Last Foundry.',objectives:[{text:'Meet Vale at Cinder Relay.',zone:'ash_relay',flag:'vale_joined'},{text:'Recover the Warm Coal from the Last Foundry.',zone:'ash_foundry',flag:'ash_key'}]},
    {id:4,title:'A Memory for Sale',entryZone:'glass_steps',summary:'The Glass Republic sold its fear. It also sold the truth about the Still Engine.',goal:'Use the violet gate in the Orchard of Hours. Meet Nyx at Prism Steps. Follow the archive route to the High Observatory. Defeat the Index Keeper.',objectives:[{text:'Meet Nyx at Prism Steps.',zone:'glass_steps',flag:'nyx_joined'},{text:'Read the sealed record in the High Observatory.',zone:'glass_observatory',flag:'glass_key'}]},
    {id:5,title:'The Living Bridge',entryZone:'seed_falls',summary:'A path across the future can start with one seed in the past.',goal:'Plant the Bridge Seed in the marked bed at the First Falls. Travel to the Drowned Skyway in Ash Tomorrow. Defeat the Horizon Crab.',objectives:[{text:'Plant the Bridge Seed beside the First Falls.',zone:'seed_falls',flag:'bridge_seed'},{text:'Cross the grown bridge and defeat its guardian.',zone:'ash_skybridge',flag:'future_bridge'}]},
    {id:6,title:'What We Keep',entryZone:'glass_observatory',summary:'Orin built the engine to save one person. He has made every age pay for that choice.',goal:'Return to the High Observatory and face Archivist Orin. Companion quests can be completed before or after this battle.',objectives:[{text:'Defeat Orin and learn how to reach the Still Engine.',zone:'glass_observatory',flag:'orin_yields'}]},
    {id:7,title:'The Hours Between',entryZone:'fold_shore',summary:'Four living seals open the Fold. The travellers must pass the hours they almost became.',goal:'Use the white gate in the Orchard of Hours. Cross the Unspent Shore and the Gallery of Hours. Defeat the Fourfold Witness.',objectives:[{text:'Enter the Fold through the white orchard gate.',zone:'fold_shore',flag:'fold_entered'},{text:'Defeat the Fourfold Witness in the Gallery of Hours.',zone:'fold_gallery',flag:'crown_open'}]},
    {id:8,title:'Last Dawn',entryZone:'fold_heart',summary:'The future is a choice. Reach the heart of the engine and decide what the world will keep.',goal:'Defeat the Still Engine in the Heart of the Machine. Enter the Dawn Garden. Speak to the Dawn Seed and choose an ending.',objectives:[{text:'Stop the Still Engine.',zone:'fold_heart',flag:'engine_stopped'},{text:'Choose the shape of the next dawn.',zone:'fold_crown',flag:'ending_seen'}]}
  ];

  C.quests = [
    {id:'mira_watch',name:'The Minute We Missed',hero:'mira',description:'Mira\'s father left one watch unfinished. Its last part is a memory of an ordinary day.',startChapter:4,completeFlag:'mira_quest_done',rewardText:'Tomorrow\'s Edge and Mira\'s ending scene.',steps:[{text:'Speak to the apprentice at the Copper Kiln.',zone:'bell_kiln',flag:'mira_quest_started'},{text:'Find the watchmaker\'s record in the Glass Archive.',zone:'glass_archive',flag:'mira_memory_found'},{text:'Return to the apprentice and finish the watch.',zone:'bell_kiln',flag:'mira_quest_done'}]},
    {id:'soren_bell',name:'A Bell for the Missing',hero:'soren',description:'A name has disappeared from the harbour memorial. Follow its sound to the first river.',startChapter:4,completeFlag:'soren_quest_done',rewardText:'Seventh Chime and Soren\'s ending scene.',steps:[{text:'Read the empty name at Larkspur Quay.',zone:'bell_quay',flag:'soren_quest_started'},{text:'Recover the Unrung Bell at the First Falls.',zone:'seed_falls',flag:'soren_bell_found'},{text:'Ring the bell at the harbour memorial.',zone:'bell_quay',flag:'soren_quest_done'}]},
    {id:'brann_hearth',name:'A Home That Lasts',hero:'brann',description:'Brann can save a future shelter if he changes the kiln\'s vent before the first crack forms.',startChapter:4,completeFlag:'brann_quest_done',rewardText:'Hearthkeeper and Brann\'s ending scene.',steps:[{text:'Speak to Ada at Cinder Relay.',zone:'ash_relay',flag:'brann_quest_started'},{text:'Repair the old kiln vent in the Copper Kiln.',zone:'bell_kiln',flag:'brann_vent_fixed'},{text:'Return to Ada and see the shelter.',zone:'ash_relay',flag:'brann_quest_done'}]},
    {id:'ilex_winter',name:'The Shape of Winter',hero:'ilex',description:'A glass beast preserves a perfect spring. Ilex must let the grove change.',startChapter:4,completeFlag:'ilex_quest_done',rewardText:'Winter Seed and Ilex\'s ending scene.',steps:[{text:'Speak to Elder Fen at Mosswake Camp.',zone:'seed_camp',flag:'ilex_quest_started'},{text:'Defeat the Glass Hart in the Root Vault.',zone:'seed_vault',flag:'glass_hart_down'},{text:'Return to Elder Fen and plant a winter seed.',zone:'seed_camp',flag:'ilex_quest_done'}]},
    {id:'nyx_name',name:'The Name Below the Glass',hero:'nyx',description:'Nyx sold the memory of her sister. A damaged record still holds its edge.',startChapter:4,completeFlag:'nyx_quest_done',rewardText:'Unwritten Name and Nyx\'s ending scene.',steps:[{text:'Speak to the mask seller at Prism Steps.',zone:'glass_steps',flag:'nyx_quest_started'},{text:'Recover the Name Shard from the Ink Cistern.',zone:'glass_cistern',flag:'nyx_name_found'},{text:'Perform the recovered memory at Prism Steps.',zone:'glass_steps',flag:'nyx_quest_done'}]},
    {id:'vale_letter',name:'Return to Sender',hero:'vale',description:'Vale has carried a sealed letter for eleven years. Its address points to a home before it was lost.',startChapter:4,completeFlag:'vale_quest_done',rewardText:'Return Address and Vale\'s ending scene.',steps:[{text:'Speak to Postmaster Renn at Cinder Relay.',zone:'ash_relay',flag:'vale_quest_started'},{text:'Deliver the letter to the old address at Prism Steps.',zone:'glass_steps',flag:'vale_letter_delivered'},{text:'Return to Renn and collect the reply.',zone:'ash_relay',flag:'vale_quest_done'}]}
  ];

  const hit = (name,power=1,element='physical',target='enemy',extra={}) => ({name,power,type:element==='physical'?'physical':'magic',target,element,...extra});
  const charge = (name,power,element,target='allEnemies',extra={}) => hit(name,power,element,target,{charge:true,telegraph:1.4,...extra});
  C.enemies = keyed([
    {id:'brass_mite',name:'Brass Mite',maxHp:66,atk:12,mag:8,def:4,speed:10,weak:['water'],resist:['spark'],pattern:[hit('Copper Bite'),hit('Coil Shake',0.7,'spark')]},
    {id:'rivet_hound',name:'Rivet Hound',maxHp:108,atk:16,mag:9,def:7,speed:12,weak:['water'],resist:['physical'],pattern:[hit('Rivet Rush',1.15),charge('Straight Charge',1.3,'physical','line')]},
    {id:'bell_mote',name:'Bell Mote',maxHp:72,atk:10,mag:15,def:4,speed:10,weak:['wind'],resist:['void'],pattern:[hit('Small Chime',1,'spark'),charge('Lost Note',0.8,'void','allEnemies')]},
    {id:'ember_wisp',name:'Ember Wisp',maxHp:78,atk:10,mag:15,def:3,speed:11,weak:['water'],resist:['fire'],pattern:[hit('Cinder',1,'fire'),hit('Clinging Flame',0.7,'fire','enemy',{status:{burn:7}})]},
    {id:'moss_moth',name:'Moss Moth',maxHp:96,atk:14,mag:16,def:5,speed:13,weak:['fire'],resist:['earth'],pattern:[hit('Wing Cut',1,'wind'),hit('Sleep Pollen',0.6,'earth','enemy',{status:{slow:7}})]},
    {id:'rootling',name:'Rootling',maxHp:138,atk:18,mag:13,def:9,speed:8,weak:['fire'],resist:['earth','water'],pattern:[hit('Root Fist',1.15),charge('Ground Grasp',1.0,'earth','allEnemies',{status:{slow:5}})]},
    {id:'river_eel',name:'River Eel',maxHp:108,atk:15,mag:19,def:6,speed:12,weak:['spark'],resist:['water'],pattern:[hit('Wet Fang',1.05,'water'),charge('River Line',1.2,'water','line')]},
    {id:'seed_pod',name:'Seed Pod',maxHp:130,atk:12,mag:21,def:9,speed:8,weak:['fire','wind'],resist:['earth'],pattern:[hit('Spore Dart',0.8,'earth','enemy',{status:{poison:8}}),charge('Seed Burst',1.0,'earth')]},
    {id:'scrap_crab',name:'Scrap Crab',maxHp:155,atk:20,mag:12,def:12,speed:8,weak:['spark'],resist:['physical'],pattern:[hit('Scrap Claw',1.15),charge('Shell Sweep',1.05,'physical','circle')]},
    {id:'ash_hound',name:'Ash Hound',maxHp:138,atk:22,mag:14,def:8,speed:15,weak:['water'],resist:['fire'],pattern:[hit('Dust Bite',1.1),hit('Hot Breath',1.0,'fire','line',{status:{burn:6}})]},
    {id:'kiln_walker',name:'Kiln Walker',maxHp:210,atk:24,mag:18,def:14,speed:8,weak:['water'],resist:['fire','physical'],pattern:[hit('Iron Step',1.1),charge('Open Furnace',1.2,'fire')]},
    {id:'seeker_drone',name:'Seeker Drone',maxHp:155,atk:18,mag:24,def:9,speed:14,weak:['wind','spark'],resist:['earth'],pattern:[hit('Seek Beam',1.0,'spark'),charge('Marked Line',1.35,'spark','line')]},
    {id:'paper_wisp',name:'Paper Wisp',maxHp:140,atk:14,mag:25,def:7,speed:13,weak:['fire'],resist:['void'],pattern:[hit('Paper Edge',1.0,'void'),hit('Redaction',0.6,'void','enemy',{status:{slow:8}})]},
    {id:'archive_guard',name:'Archive Guard',maxHp:240,atk:27,mag:19,def:15,speed:10,weak:['spark'],resist:['physical','void'],pattern:[hit('Seal Strike',1.1),charge('Sealed Corridor',1.25,'void','line')]},
    {id:'ink_eel',name:'Ink Eel',maxHp:170,atk:20,mag:27,def:9,speed:13,weak:['water','spark'],resist:['void'],pattern:[hit('Ink Fang',1.0,'void','enemy',{status:{poison:8}}),charge('Black Current',1.1,'void','line')]},
    {id:'mirror_mask',name:'Mirror Mask',maxHp:180,atk:23,mag:27,def:11,speed:12,weak:['earth'],resist:['void','wind'],pattern:[hit('Reflected Blade',1.2),charge('Broken Face',1.15,'void','circle')]},
    {id:'memory_moth',name:'Memory Moth',maxHp:190,atk:21,mag:31,def:10,speed:15,weak:['fire','spark'],resist:['void'],pattern:[hit('Old Wing',1.1,'wind'),charge('Dust of Hours',1.05,'void','allEnemies',{status:{slow:6}})]},
    {id:'glass_guard',name:'Glass Sentinel',maxHp:295,atk:31,mag:26,def:18,speed:11,weak:['earth'],resist:['spark','void'],pattern:[hit('Glass Pike',1.2),charge('Prism Line',1.3,'spark','line')]},
    {id:'echo_knight',name:'Echo Knight',maxHp:285,atk:33,mag:27,def:17,speed:14,weak:['water','earth'],resist:['physical'],pattern:[hit('Borrowed Cut',1.2),charge('Unlived Charge',1.3,'wind','line')]},
    {id:'engine_eye',name:'Engine Eye',maxHp:255,atk:25,mag:35,def:13,speed:13,weak:['wind'],resist:['void','spark'],pattern:[hit('Measure',1.15,'void'),charge('Consume Hour',1.2,'void','allEnemies',{status:{slow:7}})]},
    {id:'bell_warden',name:'Bell Warden',boss:true,maxHp:570,atk:19,mag:20,def:9,speed:10,weak:['water'],resist:['spark'],description:'A guard built from seven bells. Its cracked shell conducts water.',pattern:[hit('Bell Arm',1.1),charge('Third Chime',1.1,'spark'),hit('Falling Clapper',1.3)],phases:[{at:0.48,name:'Seven Bells',atkMult:1.12,speedMult:1.08,weak:['water','wind'],pattern:[charge('Seventh Chime',1.35,'spark'),hit('Cracked Bell',1.3),charge('Resonance',1.15,'void','line')]}]},
    {id:'root_crown',name:'Root Crown',boss:true,maxHp:780,atk:23,mag:24,def:11,speed:10,weak:['fire'],resist:['earth'],description:'The oldest root has trapped itself in a perfect spring. Fire opens its shell.',pattern:[hit('Heavy Root',1.1),charge('Root Ring',1.1,'earth','allEnemies',{status:{slow:6}}),hit('Spore Pod',0.85,'earth','enemy',{status:{poison:8}})],phases:[{at:0.5,name:'Seedfall',atkMult:1.12,speedMult:1.1,weak:['fire','wind'],pattern:[charge('Falling Seeds',1.3,'earth'),hit('Thorn Sweep',1.3,'physical','line'),hit('Deep Root',1.1)]}]},
    {id:'furnace_regent',name:'Furnace Regent',boss:true,maxHp:980,atk:27,mag:27,def:13,speed:10,weak:['water'],resist:['fire'],description:'The city\'s last furnace still follows a command from a dead council.',pattern:[hit('Forged Fist',1.15),charge('Exhaust Line',1.3,'fire','line'),hit('Hot Iron',0.9,'fire','enemy',{status:{burn:8}})],phases:[{at:0.5,name:'Vent Failure',atkMult:1.12,speedMult:1.1,weak:['water','spark'],pattern:[charge('Core Flare',1.4,'fire'),hit('Broken Piston',1.3),charge('Ash Spiral',1.15,'fire','circle',{status:{burn:6}})]}]},
    {id:'index_keeper',name:'Index Keeper',boss:true,maxHp:1150,atk:27,mag:32,def:14,speed:12,weak:['earth'],resist:['void'],description:'A record machine that removes any fact that can cause pain.',pattern:[hit('Red Ink',1.0,'void'),charge('Delete Line',1.4,'void','line'),hit('Closed File',0.7,'void','enemy',{status:{slow:8}})],phases:[{at:0.5,name:'Unsealed Record',atkMult:1.1,speedMult:1.12,weak:['fire','earth'],pattern:[charge('Mass Redaction',1.25,'void'),hit('Shattered Page',1.3),charge('Prism Fault',1.3,'spark','circle')]}]},
    {id:'horizon_crab',name:'Horizon Crab',boss:true,maxHp:1300,atk:32,mag:26,def:18,speed:10,weak:['spark'],resist:['physical','water'],description:'A road builder has mistaken the new bridge for a fault. Its feet draw power from the river.',pattern:[hit('Pylon Claw',1.2),charge('Deck Sweep',1.25,'physical','allEnemies'),charge('Survey Beam',1.4,'spark','line')],phases:[{at:0.48,name:'Broken Horizon',atkMult:1.1,speedMult:1.14,weak:['spark','wind'],pattern:[charge('Bridge Drop',1.4,'earth'),hit('Exposed Joint',1.2),charge('Survey Storm',1.3,'spark','circle')]}]},
    {id:'orin',name:'Archivist Orin',boss:true,maxHp:1460,atk:30,mag:36,def:15,speed:14,weak:['wind'],resist:['void'],description:'Orin holds the day his daughter died. Each attack is a memory he cannot release.',pattern:[hit('Glass Word',1.1,'void'),charge('Still Hour',1.15,'void','allEnemies',{status:{slow:6}}),charge('Remembered Storm',1.45,'water','line')],phases:[{at:0.62,name:'The Day Held Still',atkMult:1.1,speedMult:1.08,weak:['wind','earth'],pattern:[charge('Broken Promise',1.25,'void'),hit('Memory Edge',1.35),charge('Last Rain',1.35,'water','circle')]},{at:0.25,name:'Let Her Go',atkMult:1.05,speedMult:1.1,weak:['wind','earth','fire'],pattern:[charge('One More Morning',1.45,'void'),hit('Unsteady Hand',1.1)]}]},
    {id:'fourfold_witness',name:'Fourfold Witness',boss:true,maxHp:1690,atk:34,mag:38,def:17,speed:12,weak:['water'],resist:['void'],description:'Four lost ages speak through one mask. Its weakness changes when the hour changes.',pattern:[hit('Old Bell',1.1,'spark'),charge('Seed Hour',1.25,'earth'),hit('Glass Fang',1.2)],phases:[{at:0.7,name:'The Glass Hour',atkMult:1.08,speedMult:1.05,weak:['earth'],pattern:[charge('Unchosen City',1.35,'void'),hit('Glass Rain',1.2,'spark','line')]},{at:0.38,name:'The Ash Hour',atkMult:1.12,speedMult:1.08,weak:['water','wind'],pattern:[charge('Unlit Tomorrow',1.45,'fire'),hit('Ash Memory',1.2,'void','circle')]}]},
    {id:'still_engine',name:'Still Engine',boss:true,maxHp:2190,atk:38,mag:41,def:18,speed:12,weak:['wind'],resist:['void'],description:'It consumes all possible futures to keep one present intact. Break its three commands.',pattern:[hit('Take Tomorrow',1.1,'void'),charge('Hold the Present',1.3,'earth','allEnemies',{status:{slow:7}}),charge('Measure the Past',1.5,'spark','line')],phases:[{at:0.68,name:'Command Two: Preserve',atkMult:1.08,speedMult:1.06,weak:['water','earth'],pattern:[charge('Stillness Field',1.35,'void','allEnemies',{status:{slow:7}}),hit('Fracture',1.4),charge('Four Ages Burn',1.4,'fire','circle')]},{at:0.34,name:'Command Three: Repeat',atkMult:1.12,speedMult:1.08,weak:['wind','spark','fire'],pattern:[charge('The Last Borrowed Dawn',1.55,'void'),hit('Broken Command',1.2),charge('Hour Collapse',1.45,'spark','line')]}]},
    {id:'glass_hart',name:'Glass Hart',boss:true,maxHp:1420,atk:31,mag:34,def:17,speed:15,weak:['earth','fire'],resist:['water','void'],description:'An optional guardian that holds the grove in a spring without change.',pattern:[hit('Crystal Antler',1.2),charge('Perfect Spring',1.15,'earth','allEnemies',{status:{poison:7}}),hit('Clear Hoof',1.1)],phases:[{at:0.5,name:'First Frost',atkMult:1.1,speedMult:1.1,weak:['fire'],pattern:[charge('Frozen Blossom',1.4,'water'),hit('Shattered Antler',1.35),charge('Winter Circle',1.3,'water','circle')]}]}
  ]);

  const enc = (id,name,enemies,xp,goldAmount,extra={}) => ({id,name,enemies,xp,gold:goldAmount,boss:false,repeat:false,loot:[],effects:[],...extra});
  C.encounters = keyed([
    enc('e_orchard_mites','Trouble in the Orchard',['brass_mite','brass_mite'],28,20,{intro:['Small brass insects eat the colour from the fallen fruit.']}),
    enc('e_kiln_embers','Loose Embers',['ember_wisp','brass_mite'],32,24),
    enc('e_tower_steps','The Tower Watch',['rivet_hound','bell_mote'],46,34),
    enc('e_tower_bells','Two Wrong Notes',['bell_mote','bell_mote','brass_mite'],50,36),
    enc('e_bell_warden','The Bell Warden',['bell_warden'],160,110,{boss:true,repeat:false,intro:['Soren: These bells are ringing an hour that has not happened.','Brann: Then we stop the mechanism. Together.'],victory:['The seventh bell splits. A root shines inside its hollow core.','Mira: This compass points beneath the ground. No... beneath the years.','A green gate opens in the Orchard of Hours.'],loot:[{id:'root_compass',count:1},{id:'ether',count:2}],effects:[flag('bell_key'),flag('brann_joined'),recruit('brann'),chapter(2),{type:'unlock',id:'seed_camp'}]}),
    enc('e_wilds_moths','Leaves in Flight',['moss_moth','moss_moth'],64,40),
    enc('e_wilds_roots','A Root Out of Place',['rootling','moss_moth'],75,46),
    enc('e_falls_eels','A River That Resists',['river_eel','river_eel'],78,48),
    enc('e_vault_pods','The Sleeping Seeds',['seed_pod','rootling','seed_pod'],98,64),
    enc('e_root_crown','The Root Crown',['root_crown'],230,150,{boss:true,repeat:false,intro:['Ilex: The Crown is afraid of winter. It drinks all the seasons to keep this one.','Mira: A spring without an autumn has no next spring.'],victory:['The roots loosen. One clear seed falls into Ilex\'s hand.','Ilex: It is small. I thought the future would be larger.','An amber gate opens in the Orchard of Hours.'],loot:[{id:'seed_key',count:1},{id:'bark_mail',count:1}],effects:[flag('seed_key'),flag('ilex_joined'),recruit('ilex'),chapter(3),{type:'unlock',id:'ash_relay'}]}),
    enc('e_glass_hart','The Shape of Winter',['glass_hart'],460,280,{boss:true,repeat:false,intro:['Ilex: Every leaf is perfect. None can fall.','The Glass Hart lowers its bright antlers. A hundred trapped seasons move inside them.'],victory:['The glass breaks into rain. For the first time, one leaf turns gold.','Ilex: I will be here when spring comes back.'],loot:[{id:'elixir',count:2}],effects:[flag('glass_hart_down')]}),
    enc('e_dunes_scrap','Roadside Salvage',['scrap_crab','seeker_drone'],110,68),
    enc('e_dunes_hounds','Ash on the Wind',['ash_hound','ash_hound'],112,70),
    enc('e_foundry_embers','Heat Without a Hearth',['ember_wisp','kiln_walker','ember_wisp'],140,88),
    enc('e_foundry_walkers','The Last Shift',['kiln_walker','seeker_drone'],148,92),
    enc('e_furnace_regent','The Furnace Regent',['furnace_regent'],310,210,{boss:true,repeat:false,intro:['Vale: The furnace keeps working. There is no one left to stop it.','Brann: I know that sound. A kiln should never burn this hot.'],victory:['The great furnace cools. One coal stays warm without a flame.','Vale: A whole city gave its light to this machine. Where did the light go?','A violet gate opens in the Orchard of Hours.'],loot:[{id:'ash_key',count:1},{id:'relay_shell',count:1}],effects:[flag('ash_key'),flag('vale_joined'),recruit('vale'),chapter(4),{type:'unlock',id:'glass_steps'}]}),
    enc('e_bridge_drones','A New Route',['seeker_drone','scrap_crab','seeker_drone'],195,115),
    enc('e_horizon_crab','The Horizon Crab',['horizon_crab'],420,280,{boss:true,repeat:false,intro:['A vast machine grips the living bridge.','Vale: Its map says this road cannot exist. Let us show it a new map.'],victory:['The builder releases the bridge. Beyond it, a small garden grows in the ash.','Nyx: Orin\'s daughter planted these flowers. He told us she had no future.','Mira: Then the engine did not save her. It erased every chance she had.'],loot:[{id:'dawn_knot',count:1},{id:'elixir',count:1}],effects:[flag('future_bridge'),flag('daughter_future'),chapter(6)]}),
    enc('e_archive_paper','Loose Pages',['paper_wisp','paper_wisp'],150,94),
    enc('e_archive_guards','A Closed Record',['archive_guard','paper_wisp'],172,106),
    enc('e_cistern_ink','The Ink Remembers',['ink_eel','ink_eel'],177,108),
    enc('e_cistern_masks','Faces Below the Water',['mirror_mask','ink_eel'],184,114),
    enc('e_index_keeper','The Index Keeper',['index_keeper'],370,250,{boss:true,repeat:false,intro:['Index Keeper: Harmful memory found. Removal required.','Nyx: You do not get to call a life an error.'],victory:['A sealed record opens. Orin built the Still Engine after his daughter, Elia, became ill.','He ordered it to keep her last good morning alive. The engine took all future hours as fuel.','Soren: There may still be a future it failed to reach.','The record holds a seed and a map: plant it beside the First Falls.'],loot:[{id:'glass_key',count:1},{id:'dawn_seed',count:1},{id:'glassweave',count:1}],effects:[flag('glass_key'),flag('nyx_joined'),recruit('nyx'),chapter(5)]}),
    enc('e_orin','What We Keep',['orin'],500,320,{boss:true,repeat:false,intro:['Orin: If the engine stops, that morning ends. I will lose her again.','Mira: We found her garden in the future. She lived beyond the day you kept.','Orin: No. The record was certain.','Nyx: You paid it to be certain.'],victory:['Orin drops the glass record. It does not break.','Orin: I remember her telling me to open the window. I kept it closed. I wanted nothing to change.','Soren: Open it now.','Orin gives you the route to the Fold. The white orchard gate opens.'],loot:[{id:'dawn_mantle',count:1},{id:'elixir',count:2}],effects:[flag('orin_yields'),flag('fold_open'),chapter(7),{type:'unlock',id:'fold_shore'}]}),
    enc('e_shore_moths','Unspent Wings',['memory_moth','memory_moth'],220,130),
    enc('e_gallery_guards','The Glass Hour',['glass_guard','memory_moth'],244,145),
    enc('e_gallery_echoes','Lives Not Lived',['echo_knight','echo_knight'],255,150),
    enc('e_fourfold_witness','The Fourfold Witness',['fourfold_witness'],610,390,{boss:true,repeat:false,intro:['Witness: Four ages. Four losses. Which one do you refuse?','Ilex: None. We carry them.','Vale: And we keep moving.'],victory:['The mask splits into four small lights. They settle in the living seals.','The travellers see lives they could have lived. For a moment, each is enough.','Mira: We cannot live every life. We can choose this one.'],loot:[{id:'elixir',count:3}],effects:[flag('crown_open'),chapter(8),{type:'unlock',id:'fold_heart'}]}),
    enc('e_heart_eyes','The Last Command',['engine_eye','glass_guard','engine_eye'],285,170),
    enc('e_still_engine','The Last Borrowed Dawn',['still_engine'],900,600,{boss:true,repeat:false,intro:['Still Engine: Present preserved. Future cost: all.','Mira: The present belongs to the people who live in it.','The engine draws one last dawn into its heart.'],victory:['For the first time, the engine has no next command.','The living seals open a path into the Dawn Garden.','Soren: The hours are free. We still have to decide where they will go.'],loot:[],effects:[flag('engine_stopped'),{type:'unlock',id:'fold_crown'}]})
  ]);

  C.encounters.e_early_engine = enc('e_early_engine','Before the First Bell',['still_engine'],900,600,{boss:true,repeat:false,intro:['The watch opens before the first bell. The engine has not learned to hide.','Mira: We know the road this time. Let us give everyone their morning back.'],victory:['The engine stops before it can take its first hour.','Somewhere, a window opens. Elia asks her father to come outside.'],effects:[flag('early_engine_stopped'),flag('ending_seen'),{type:'ending',id:'early'}]});

  C.dialogues = {
    intro:{speaker:'Mira',lines:['The harbour clock has stopped at dawn. Every small clock in my shop stopped with it.','Soren heard a bell below the orchard. There is no bell below the orchard.','We should speak to Tessa, the orchard keeper. She is through the east road.'],effects:[flag('intro_seen')],onceFlag:'intro_seen'},
    quay_guide:{speaker:'Harbour Steward',lines:['The east road climbs to the Orchard of Hours. The north road leads to the Copper Kiln.','A shrine restores health and skill points. Use one whenever you need it.','Open the journal if you need your next destination.']},
    quay_fisher:{speaker:'Old Fisher',lines:['I caught a fish with a copper key inside it. My father said he caught the same fish.','He kept the key. I threw mine back. Someone else may need a way in.']},
    orchard_tessa:{speaker:'Tessa',hero:'mira',lines:['The fruit fell without a sound. Look at its centre. There are no seeds.','Something below the Seventh Tower is taking the orchard\'s next spring.','Brann can open the tower path. Find him at the Copper Kiln, north of the quay.'],effects:[flag('orchard_seen')],onceFlag:'orchard_seen',onRepeat:'orchard_tessa_repeat'},
    orchard_tessa_repeat:{speaker:'Tessa',lines:['Follow the north path to the Seventh Tower. Brann knows its old locks.','The orchard remembers every hand that helped it. It will remember yours.']},
    orchard_gates:{speaker:'Tessa',lines:['The gates have roots instead of hinges. Each living seal opens another age.','Green leads to the first spring. Amber leads to the last road. Violet leads to a city of glass.','When all four seals are whole, the white gate can reach the Fold.']},
    orchard_after_bridge:{speaker:'Tessa',lines:['A new branch grew this morning. It casts its shadow toward a sun I cannot see.','You planted something, did you not? Good. The orchard was tired of only losing things.']},
    orchard_before_end:{speaker:'Tessa',lines:['The fruit has seeds again. They are still too pale to plant.','Go to the Fold. Whatever you choose there, leave the world room to grow.']},
    kiln_brann:{speaker:'Brann',hero:'brann',lines:['The tower guard locked itself inside. It keeps asking the kiln for more fuel.','I gave it our winter coal. It asked for the next winter\'s coal.','That is where I stopped listening. Take my hammer. I am coming with you.'],effects:[flag('brann_joined'),recruit('brann')],onceFlag:'brann_joined',onRepeat:'kiln_brann_repeat'},
    kiln_brann_repeat:{speaker:'Brann',lines:['The tower is east of the kiln. Stay clear of a guard when its warning light grows.','A charged attack gives us time to heal or guard.']},
    kiln_worker:{speaker:'Kiln Worker',lines:['Brann counts every home before he counts the coal.','He says a cold house is a number we can change.']},
    kiln_apprentice:{speaker:'Apprentice Fenn',lines:['Your father taught me to repair clocks, Mira. He always left one spring loose.','He said a machine needs enough room to be wrong. I still do not know if that was a joke.']},
    tower_note:{speaker:'Tower Service Plate',lines:['SEVEN BELLS. ONE SHARED SHAFT.','If the guard draws more current, cool the outer shell with water.','Do not stand in front of a charged clapper.']},
    tower_echo:{speaker:'A Faint Voice',lines:['Keep this morning. Take the next one.','Keep this morning. Take the next one.','The words repeat. A child laughs once between them.']},
    seed_ilex:{speaker:'Ilex',hero:'ilex',lines:['You smell of rain that has not fallen. Are you the next season?','The Root Crown has shut the deep river. It says nothing should change.','I want to see what comes after this forest. I will walk with you.'],effects:[flag('ilex_joined'),recruit('ilex')],onceFlag:'ilex_joined',onRepeat:'seed_ilex_repeat'},
    seed_ilex_repeat:{speaker:'Ilex',lines:['The Root Vault lies beyond the First Falls. The eastern trail reaches both.','Fire can open the Crown\'s hard shell. Please use only what you need.']},
    seed_fen:{speaker:'Elder Fen',lines:['A tree can live through many storms. It cannot live through a spring that never ends.','We kept the paths open. Follow the river east to the vault.']},
    seed_child:{speaker:'Neri',lines:['I planted a stick. Elder Fen said it would not grow.','I water it anyway. Being right is no reason to leave a stick thirsty.']},
    wilds_marker:{speaker:'Root Marker',lines:['A path is a promise made by many feet.','Take the east trail to the First Falls. Leave one seed when you pass.']},
    falls_reader:{speaker:'River Listener',lines:['The river carries four sounds today. Birds. Bells. Glass. An empty road.','The roots join places that have never stood beside each other.']},
    plant_bridge:{speaker:'Ilex',hero:'ilex',lines:['The archive map marks this bed. Its roots will reach the broken road in the far future.','We will not see it grow from here. We have to trust the soil.'],choices:[{label:'Plant the Bridge Seed.',effects:[flag('bridge_seed')],next:'plant_bridge_done'},{label:'Leave the bed for now.'}]},
    plant_bridge_done:{speaker:'Mira',lines:['A small green shoot pushes through the earth.','Mira: No grand sound. No flash of light. Just a beginning.','Travel to the Drowned Skyway in Ash Tomorrow. Its entrance is east of the Rust Dunes.']},
    bridge_bed_wait:{speaker:'A Marked Planting Bed',lines:['Four river stones mark a small square of dark soil.','A map from another age could explain its purpose.']},
    bridge_bed_grown:{speaker:'Ilex',lines:['The shoot is still small here. Elsewhere, it has had two thousand years.','One world. More than one kind of patience.']},
    vault_record:{speaker:'Root Memory',lines:['The first keeper planted four seeds. One for each season.','The orchard grew a fifth root. It reached a season no one had named.']},
    ash_vale:{speaker:'Vale',hero:'vale',lines:['You came through the gate. I thought the relay light was making things up.','The Last Foundry has drawn power for eleven years. It sends none back.','I know the road. You look as if you can do something when we get there.'],effects:[flag('vale_joined'),recruit('vale')],onceFlag:'vale_joined',onRepeat:'ash_vale_repeat'},
    ash_vale_repeat:{speaker:'Vale',lines:['Go east through the Rust Dunes. The foundry stands at the end of the north road.','The east road reaches a broken skyway. We will need a bridge.']},
    ash_ada:{speaker:'Ada',lines:['There are twelve of us at the relay. We take turns saying good morning.','It is a small job. It still needs someone to do it.']},
    ash_renn:{speaker:'Postmaster Renn',lines:['A letter is a small promise that someone expects you to arrive.','Vale keeps the route open. The rest of us keep the kettle warm.']},
    ash_map:{speaker:'Broken Route Board',lines:['LAST FOUNDRY: north. DROWNED SKYWAY: east.','A thin root has reached through the cracked board. It points toward the water.']},
    foundry_log:{speaker:'Shift Record',lines:['DAY 4,018. WORKERS PRESENT: 0.','OUTPUT DESTINATION: THE SAME MORNING.','FUEL RESERVE: TOMORROW.']},
    foundry_coal:{speaker:'Brann',lines:['A good fire gives heat to the people beside it. This one sends everything away.','Keep water ready. The outer vents will fail before the heart.']},
    skyway_garden:{speaker:'Elia\'s Garden Record',lines:['If you found this, I am older than my father thought I would ever be.','I grew these flowers in bad soil. Some did not grow. Most did.','Tell him that one good morning was never all I wanted. I wanted the next one, too.'],effects:[flag('daughter_record_read')],onceFlag:'daughter_record_read'},
    glass_nyx:{speaker:'Nyx',hero:'nyx',lines:['The archive says this square has always been quiet. Last week we danced here until dawn.','Orin is buying every memory that could make someone afraid. He calls it peace.','I know a way below his records. Let me show you what a clean page hides.'],effects:[flag('nyx_joined'),recruit('nyx')],onceFlag:'nyx_joined',onRepeat:'glass_nyx_repeat'},
    glass_nyx_repeat:{speaker:'Nyx',lines:['The archive is north of the steps. Its lower door leads through the Ink Cistern.','The cistern stairs reach the High Observatory. That is where Orin stores his first record.']},
    glass_citizen:{speaker:'A Glass Citizen',lines:['I sold the memory of a terrible argument. My sister still remembers it.','She says I should say sorry. I believe her. I do not know what words to use.']},
    glass_archivist:{speaker:'Junior Archivist',lines:['A record can hold what happened. It cannot tell you what must happen next.','Please do not quote me. That sentence is no longer in the approved guide.']},
    archive_public:{speaker:'Public Archive',lines:['The Republic accepts memories freely given. All sales are final.','Small print: the buyer may alter later records to preserve public calm.','Someone has scratched two words beneath the notice: WHO DECIDES?']},
    archive_orin_hint:{speaker:'Orin\'s Assistant',lines:['He kept a child\'s cup on his desk. No one was allowed to move it.','At first I thought it was love. Later, I could not tell where love ended and fear began.']},
    cistern_note:{speaker:'A Rejected Record',lines:['ELIA ORIN. Recovery possible. Later outcomes uncertain.','The final line has been cut away. Its edges are still sharp.']},
    observatory_before:{speaker:'Sealed Observatory',lines:['The Index Keeper blocks the sealed record. Its glass joints are weak against earth.','The record will show why the orchard is losing its future.']},
    observatory_orin_wait:{speaker:'Orin',lines:['There is no future beyond the engine. I checked every record I could bear to read.','Do not ask me to trade certainty for hope.']},
    observatory_orin_after:{speaker:'Orin',lines:['She asked me to open a window. I built a machine to close the world.','The white gate in the orchard leads to the Fold. Take the four living seals through it.','I will stay here. There are people whose memories I must return.']},
    fold_welcome:{speaker:'Soren',lines:['There is no wind here, but I can hear every bell at once.','These are the hours the engine never used. We can still give them a place to go.'],effects:[flag('fold_entered')],onceFlag:'fold_welcome_seen'},
    fold_boatman:{speaker:'The Unchosen Boatman',lines:['I was a choice someone did not make. I carried no one across a river that never flooded.','I do not need to become real. I would like the river to have a chance.']},
    fold_mira:{speaker:'A Clockmaker\'s Echo',lines:['I stayed home. I repaired the harbour clock. The bells rang on time.','There was no one at the quay to hear them.']},
    fold_soren:{speaker:'A Bellkeeper\'s Echo',lines:['I remembered every name. I forgot to speak to the people who still had names to give.','Carry the living with you. The missing can walk beside them.']},
    fold_ilex:{speaker:'A Guardian\'s Echo',lines:['I kept every leaf. The forest grew too heavy to stand.','When the first leaf fell, I thought it was the end. It was room.']},
    fold_terminal:{speaker:'Still Engine Record',lines:['PRIMARY ORDER: preserve the present.','MISSING LIMIT: the cost to other lives.','No machine supplied the missing limit. No operator asked it to.']},
    fold_last_shrine:{speaker:'Soren',lines:['Rest here. The road ahead leads to the heart of the engine.','We have enough time for one clear breath. This hour belongs to us.']},
    final_choice:{speaker:'The Dawn Seed',lines:['The engine is silent. The stolen hours gather around one living seed.','You can let each age follow its own road. You can open the ages to each other.','Or you can keep one crossing, supported by hours that people choose to share.','No record can promise the result. The next dawn needs a choice.'],choices:[
      {label:'Let time flow. Return each age to its own road.',effects:[flag('ending_seen'),{type:'ending',id:'renew'}]},
      {label:'Open the ages. Let all four worlds meet.',effects:[flag('ending_seen'),{type:'ending',id:'release'}]},
      {label:'Share the hours. Keep one crossing open.',effects:[flag('ending_seen'),{type:'ending',id:'preserve'}]},
      {label:'I need more time before I choose.'}
    ]},
    early_gate:{speaker:'Mira\'s Watch',lines:['The loose spring turns in the wrong direction. You remember this morning.','The engine is exposed before the first bell. A strong party can reach it now.','If you win, this journey will end before it begins.'],choices:[{label:'Reach the engine before the first bell.',effects:[{type:'battle',id:'e_early_engine'}]},{label:'Take the long road again.'}]},
    mira_watch_start:{speaker:'Apprentice Fenn',hero:'mira',lines:['Your father left this watch unfinished. I found a small note inside.','He wrote about one minute he missed. The Glass Archive may have a record of it.','Will you find that record? I think it was meant for you.'],effects:[flag('mira_quest_started'),quest('mira_watch')],onceFlag:'mira_quest_started'},
    mira_watch_wait:{speaker:'Apprentice Fenn',lines:['The Glass Archive may hold your father\'s record. Look for the small workbench near its west wall.','I will keep the watch safe.']},
    mira_memory:{speaker:'A Watchmaker\'s Record',hero:'mira',lines:['Mira sees her father at his bench. A small child asks him to come outside.','He puts down the unfinished watch. He takes her hand. The record ends.','Mira: I thought he missed his last minute of work. He kept our first minute in the rain.'],effects:[flag('mira_memory_found')],onceFlag:'mira_memory_found'},
    mira_watch_finish:{speaker:'Mira',hero:'mira',lines:['We do not need to put that minute back. It was never missing.','Mira leaves the watch with one loose spring. Fenn fits its spare steel into a new blade.','Fenn: Take this. Come home with a story I cannot fit in a clock.'],effects:[flag('mira_quest_done'),quest('mira_watch','complete'),item('mira_relic'),gold(180)],onceFlag:'mira_quest_done'},
    mira_watch_done:{speaker:'Apprentice Fenn',lines:['The watch loses one minute each day. We spend it outside.','I think your father would accept that repair.']},
    soren_bell_start:{speaker:'Soren',hero:'soren',lines:['There is a blank space in the harbour memorial. I know a name belonged there.','When I touch the stone, I hear the First Falls.','We should look beside the river in the Seed Age.'],effects:[flag('soren_quest_started'),quest('soren_bell')],onceFlag:'soren_quest_started'},
    soren_bell_wait:{speaker:'Harbour Memorial',lines:['One space in the stone is smooth. The sound of running water comes from it.','Search the west bank at the First Falls in the Seed Age.']},
    soren_bell_find:{speaker:'Soren',hero:'soren',lines:['A small bell hangs inside an old root. It has never been rung.','The name on its handle is Lio. My brother had the same name.','Soren: Perhaps the world forgot the sound before it forgot him. We can return one of them.'],effects:[flag('soren_bell_found'),item('small_bell')],onceFlag:'soren_bell_found'},
    soren_bell_finish:{speaker:'Soren',hero:'soren',lines:['Soren rings the small bell. The blank stone keeps its smooth face.','Soren: Lio. You were here. I do not need the stone to agree.','People at the quay stop to listen. One begins to tell a story.'],effects:[flag('soren_quest_done'),quest('soren_bell','complete'),item('soren_relic'),gold(180)],onceFlag:'soren_quest_done'},
    soren_bell_done:{speaker:'Harbour Memorial',lines:['Fresh flowers rest beneath the blank stone. Someone has left a small wooden boat.','The name is spoken each evening, before the seventh bell.']},
    brann_hearth_start:{speaker:'Ada',hero:'brann',lines:['Our old shelter failed when the kiln vent split. The fire took the roof.','This plan shows a better vent. We found it a few centuries too late.','Brann: Give it here. I know the kiln that this plan began with.'],effects:[flag('brann_quest_started'),quest('brann_hearth'),item('blueprint')],onceFlag:'brann_quest_started'},
    brann_hearth_wait:{speaker:'Ada',lines:['The old kiln stood where Larkspur Quay once met the sea.','If you can reach it before the crack forms, fit the vent from our plan.']},
    brann_vent_fix:{speaker:'Brann',hero:'brann',lines:['The first crack is smaller than a fingernail. A new copper sleeve fits around it.','Brann: No one will remember who fixed this. That is how a good repair should work.','Return to Ada at Cinder Relay and see what changed.'],effects:[flag('brann_vent_fixed')],onceFlag:'brann_vent_fixed'},
    brann_hearth_finish:{speaker:'Ada',hero:'brann',lines:['The shelter wall is warm. A neat copper sleeve surrounds its oldest pipe.','Ada: My grandmother said this vent was made before the city had a name.','Brann rests his hand on the wall. Twelve cups wait beside the kettle.'],effects:[flag('brann_quest_done'),quest('brann_hearth','complete'),item('brann_relic'),gold(180)],onceFlag:'brann_quest_done'},
    brann_hearth_done:{speaker:'Ada',lines:['The new room is ready. Well... it has always been ready, has it not?','We set a place for you. Whatever the years decide, that will stay.']},
    ilex_winter_start:{speaker:'Elder Fen',hero:'ilex',lines:['A glass beast has sealed the small grove in the Root Vault. No leaf can fall there.','Ilex: I thought keeping something safe meant keeping it the same.','Fen: Go and see what that costs. Then come back. We will plant something that can wait.'],effects:[flag('ilex_quest_started'),quest('ilex_winter')],onceFlag:'ilex_quest_started'},
    ilex_winter_wait:{speaker:'Elder Fen',lines:['The Glass Hart waits in the south grove of the Root Vault. It is strong.','Fire and earth can break its shell. Its first frost is more dangerous than its spring.']},
    ilex_winter_finish:{speaker:'Ilex',hero:'ilex',lines:['Ilex places a small seed beneath the fallen leaves.','Ilex: I will not pull you up to check that you are growing. I can wait.','Fen: That is the first useful thing a guardian learns.'],effects:[flag('ilex_quest_done'),quest('ilex_winter','complete'),item('ilex_relic'),gold(180)],onceFlag:'ilex_quest_done'},
    ilex_winter_done:{speaker:'Elder Fen',lines:['The seed has not grown yet. Ilex no longer asks it to hurry.','The grove has room for its next season.']},
    nyx_name_start:{speaker:'Mask Seller',hero:'nyx',lines:['You sold a memory here, Nyx. You asked me never to tell you what it was.','I kept the receipt. It names your sister, Eda. The archive moved her record below the cistern.','Nyx: I remember asking not to hurt. I did not ask to stop loving her.'],effects:[flag('nyx_quest_started'),quest('nyx_name')],onceFlag:'nyx_quest_started'},
    nyx_name_wait:{speaker:'Mask Seller',lines:['The Name Shard lies beside the lower shelves in the Ink Cistern.','A damaged record can still be read. Take your time with it.']},
    nyx_name_find:{speaker:'Nyx',hero:'nyx',lines:['Two sisters dance on a roof. One misses a step. Both fall into a heap of wet washing.','The next memory is a quiet room and one empty chair. Nyx lets it play to the end.','Nyx: Eda. I can carry both days. I want both days.'],effects:[flag('nyx_name_found'),item('name_shard')],onceFlag:'nyx_name_found'},
    nyx_name_finish:{speaker:'Nyx',hero:'nyx',lines:['Nyx dances in the square. She misses the same step. This time, she stays on her feet.','A few people laugh. Then she tells them her sister\'s name.','The mask seller removes the price from one ribbon and gives it to her.'],effects:[flag('nyx_quest_done'),quest('nyx_name','complete'),item('nyx_relic'),gold(180)],onceFlag:'nyx_quest_done'},
    nyx_name_done:{speaker:'Mask Seller',lines:['Someone painted two dancers on the archive wall. The council has left them there.','I removed the price labels from the memory masks. A name should not need a buyer.']},
    vale_letter_start:{speaker:'Postmaster Renn',hero:'vale',lines:['That letter has an old city address. The house was gone before you were born.','You have a road to the glass city now. Find the blue door at Prism Steps.','Vale: Eleven years late is still a delivery.'],effects:[flag('vale_quest_started'),quest('vale_letter'),item('old_letter')],onceFlag:'vale_quest_started'},
    vale_letter_wait:{speaker:'Postmaster Renn',lines:['The letter names the blue door at Prism Steps in the Glass Republic.','A long route can still have a correct address.']},
    vale_letter_deliver:{speaker:'Tarin',hero:'vale',lines:['A letter from my family in the far future? They ask if our family ever had a garden.','We have a small one. I will put seeds in my reply.','Vale: Please write your name clearly. Some of us have waited a long time to learn it.'],effects:[flag('vale_letter_delivered')],onceFlag:'vale_letter_delivered'},
    vale_letter_finish:{speaker:'Postmaster Renn',hero:'vale',lines:['A letter waits on the relay desk. Its envelope is dry. A packet of seeds rests inside.','Renn: You delivered a reply before I had time to miss you.','Vale: Keep the route on the board. There may be more letters.'],effects:[flag('vale_quest_done'),quest('vale_letter','complete'),item('vale_relic'),gold(180)],onceFlag:'vale_quest_done'},
    vale_letter_done:{speaker:'Postmaster Renn',lines:['The seed tray has three green shoots. Vale checks them before each delivery.','The route board has a new line: HOME.']}
  };

  const npc = (id,name,x,y,dialogue,extra={}) => ({id,type:'npc',name,x,y,dialogue,...extra});
  const shrine = (id,x,y) => ({id,type:'shrine',name:'Dawn Shrine',x,y,description:'Restore the full party. Save the journey.'});
  const chest = (id,x,y,loot=[],goldAmount=0,extra={}) => ({id,type:'chest',name:'Travel Chest',x,y,loot,gold:goldAmount,...extra});
  const fight = (id,x,y,encounter,extra={}) => ({id,type:'encounter',x,y,encounter,name:C.encounters[encounter].name,...extra});
  const gate = (id,name,x,y,to,requires={},extra={}) => ({id,type:'gate',name,x,y,to,requires,lockedText:'The roots have not opened this road yet.',...extra});
  const shop = (id,name,x,y,stock) => ({id,type:'shop',name,x,y,stock,items:stock});
  const exit = (id,to,x,y,tx=6,ty=12,requires={},lockedText='The road is not open yet.') => ({id,to,x,y,tx,ty,requires,lockedText});
  const feature = (kind,x,y,w,h,extra={}) => ({kind,x,y,w,h,...extra});
  const done = f => ({hideIf:req(f)});
  const after = n => ({chapterAtLeast:n});
  const branch = (requires,dialogue) => ({requires,dialogue});
  C.zones = [
    {
      id:'bell_quay',name:'Larkspur Quay',era:'bell642',style:'town',description:'Warm stone steps descend to a quiet harbour. The morning bell has not rung.',spawn:{x:9,y:14},
      features:[feature('house',5,4,5,4),feature('house',21,4,6,4),feature('water',4,18,24,3),feature('path',4,11,24,3),feature('path',14,4,3,15),feature('garden',5,9,4,2)],
      exits:[exit('quay_orchard','bell_orchard',27,12,5,12),exit('quay_kiln','bell_kiln',16,4,16,18)],
      entities:[
        npc('quay_intro','The Stopped Clock',10,13,'intro',{requires:{notFlags:['intro_seen']}}),
        npc('quay_steward','Harbour Steward',18,10,'quay_guide'),npc('quay_fisher','Old Fisher',7,16,'quay_fisher'),
        {id:'quay_bells',type:'minigame',name:'Four-Bell Refrain',x:14,y:16,pattern:[0,2,1,3]},
        shrine('quay_shrine',11,7),gate('quay_gate','Orchard Gate',26,15,'bell_orchard'),
        shop('quay_shop','The Copper Cup',19,7,['tonic','ether','phoenix','panacea','mira_blade','soren_staff','quilted_coat','copper_ring']),
        chest('quay_chest',24,16,[{id:'tonic',count:3},{id:'ether',count:1}],35),
        npc('quay_memorial','Harbour Memorial',23,13,'soren_bell_start',{requires:after(4),variants:[branch(req('soren_quest_done'),'soren_bell_done'),branch(req('soren_bell_found'),'soren_bell_finish'),branch(req('soren_quest_started'),'soren_bell_wait')]})
      ]
    },
    {
      id:'bell_orchard',name:'Orchard of Hours',era:'bell642',style:'garden',description:'Pale fruit hangs above roots that reach four ages. The tower rises to the north.',spawn:{x:7,y:12},
      features:[feature('garden',5,4,9,4),feature('garden',20,4,7,5),feature('garden',5,16,9,4),feature('garden',20,16,7,4),feature('tree',15,8,3,3),feature('path',4,11,24,3),feature('path',15,4,3,16)],
      exits:[exit('orchard_quay','bell_quay',4,12,26,12),exit('orchard_tower','bell_tower',16,4,16,18,req('orchard_seen'),'Speak to Tessa beside the central tree first.')],
      entities:[
        npc('orchard_keeper','Tessa',16,10,'orchard_tessa',{variants:[branch(req('fold_open'),'orchard_before_end'),branch(req('future_bridge'),'orchard_after_bridge'),branch(req('bell_key'),'orchard_gates')]}),
        shrine('orchard_shrine',7,8),fight('orchard_mites',21,12,'e_orchard_mites'),
        chest('orchard_chest',25,9,[{id:'panacea',count:2}],30),
        gate('orchard_seed','Green Gate · Year 112',10,6,'seed_camp',after(2)),
        gate('orchard_ash','Amber Gate · Year 2310',23,6,'ash_relay',after(3)),
        gate('orchard_glass','Violet Gate · Year 1186',23,17,'glass_steps',after(4)),
        gate('orchard_fold','White Gate · The Fold',10,18,'fold_shore',req('fold_open')),
        npc('orchard_first_dawn','First Dawn',7,15,'early_gate',{requires:{flags:['ng_plus'],notFlags:['bell_key']}})
      ]
    },
    {
      id:'bell_kiln',name:'Copper Kiln',era:'bell642',style:'town',description:'A public furnace warms the harbour homes. Its oldest pipe carries a small crack.',spawn:{x:16,y:18},
      features:[feature('house',11,5,9,4),feature('house',4,4,5,3),feature('ruins',24,5,3,4),feature('path',4,11,24,3),feature('path',15,9,3,11),feature('garden',4,17,5,3)],
      exits:[exit('kiln_quay','bell_quay',16,19,16,5),exit('kiln_tower','bell_tower',27,12,5,12,req('orchard_seen'),'Speak to Tessa in the Orchard of Hours to learn what stopped the tower.')],
      entities:[
        npc('kiln_brann','Brann',16,10,'kiln_brann',{requires:{notFlags:['brann_joined']}}),
        npc('kiln_worker','Kiln Worker',20,16,'kiln_worker'),
        npc('kiln_fenn','Apprentice Fenn',8,16,'kiln_apprentice',{variants:[branch(req('mira_quest_done'),'mira_watch_done'),branch(req('mira_memory_found'),'mira_watch_finish'),branch(req('mira_quest_started'),'mira_watch_wait'),branch(after(4),'mira_watch_start')]}),
        npc('kiln_vent','Old Kiln Vent',23,8,'brann_vent_fix',{requires:{flags:['brann_quest_started'],notFlags:['brann_vent_fixed']}}),
        shop('kiln_shop','Kiln Supply',7,8,['tonic','ether','panacea','brann_hammer','kiln_apron','copper_ring']),
        shrine('kiln_shrine',24,17),fight('kiln_embers',22,12,'e_kiln_embers'),chest('kiln_chest',5,13,[{id:'phoenix',count:1},{id:'tonic',count:2}],45)
      ]
    },
    {
      id:'bell_tower',name:'Seventh Tower',era:'bell642',style:'ruin',description:'Seven huge bells share one cracked shaft. A root grows through its centre.',spawn:{x:16,y:18},
      features:[feature('pillars',7,5,3,3),feature('pillars',23,5,3,3),feature('pillars',7,15,3,3),feature('pillars',23,15,3,3),feature('path',4,11,24,3),feature('path',15,5,3,15),feature('crystals',14,4,5,2)],
      exits:[exit('tower_kiln','bell_kiln',4,12,26,12),exit('tower_orchard','bell_orchard',16,19,16,5)],
      entities:[
        shrine('tower_shrine',6,17),npc('tower_plate','Service Plate',10,10,'tower_note'),npc('tower_echo','A Faint Voice',24,10,'tower_echo'),
        fight('tower_watch',13,15,'e_tower_steps'),fight('tower_notes',22,12,'e_tower_bells'),fight('tower_warden',16,7,'e_bell_warden',done('bell_key')),
        {id:'tower_register',type:'puzzle',name:'The Four-Age Register',x:17,y:10,symbols:['Seed','Bell','Glass','Ash'],sequence:[0,1,2,3],hint:'Set the ages from earliest to latest: Seed 112; Bell 642; Glass 1186; Ash 2310.',effects:[flag('tower_aligned'),gold(30)],hideIf:req('tower_aligned')},
        chest('tower_chest',26,6,[{id:'ether',count:2},{id:'dew_pendant',count:1}],60,{requires:req('tower_aligned')})
      ]
    },
    {
      id:'seed_camp',name:'Mosswake Camp',era:'seed112',style:'town',description:'Small homes stand between the first orchard roots. Seeds dry on warm river stones.',spawn:{x:7,y:12},
      features:[feature('house',4,4,6,3),feature('house',21,4,6,3),feature('tree',13,5,4,4),feature('garden',21,16,6,4),feature('path',4,11,24,3),feature('path',6,7,3,11)],
      exits:[exit('camp_wilds','seed_wilds',27,12,5,12)],
      entities:[
        npc('camp_ilex','Ilex',17,11,'seed_ilex',{requires:{notFlags:['ilex_joined']}}),
        npc('camp_fen','Elder Fen',9,9,'seed_fen',{variants:[branch(req('ilex_quest_done'),'ilex_winter_done'),branch(req('glass_hart_down'),'ilex_winter_finish'),branch(req('ilex_quest_started'),'ilex_winter_wait'),branch(after(4),'ilex_winter_start')]}),
        npc('camp_neri','Neri',16,17,'seed_child'),shrine('camp_shrine',7,16),gate('camp_gate','Orchard Gate',26,17,'bell_orchard'),
        shop('camp_shop','River Seed Store',22,8,['tonic','ether','phoenix','panacea','ilex_branch','bark_mail','dew_pendant','root_charm']),
        chest('camp_chest',5,9,[{id:'panacea',count:3}],65)
      ]
    },
    {
      id:'seed_wilds',name:'The First Wilds',era:'seed112',style:'forest',description:'Sunlight falls through leaves that have never known a winter.',spawn:{x:5,y:12},
      features:[feature('trees',5,4,7,4),feature('trees',20,4,7,4),feature('trees',5,16,7,4),feature('trees',21,17,6,3),feature('pool',14,15,5,4),feature('path',4,11,24,3)],
      exits:[exit('wilds_camp','seed_camp',4,12,26,12),exit('wilds_falls','seed_falls',27,12,5,12)],
      entities:[npc('wilds_marker','Root Marker',16,7,'wilds_marker'),fight('wilds_moths',12,10,'e_wilds_moths'),fight('wilds_roots',22,15,'e_wilds_roots'),chest('wilds_chest_a',9,5,[{id:'ether',count:2}],50),chest('wilds_chest_b',25,6,[{id:'swift_spool',count:1}],45)]
    },
    {
      id:'seed_falls',name:'The First Falls',era:'seed112',style:'forest',description:'The river cuts between old roots. Four small stones mark an empty bed on its east bank.',spawn:{x:5,y:12},
      features:[feature('river',15,4,4,16),feature('bridge',12,11,10,3),feature('trees',5,4,6,3),feature('trees',22,4,5,3),feature('garden',22,15,4,3),feature('tree',23,16,1,1,{requires:req('bridge_seed')})],
      exits:[exit('falls_wilds','seed_wilds',4,12,26,12),exit('falls_vault','seed_vault',27,12,5,12)],
      entities:[
        npc('falls_listener','River Listener',9,15,'falls_reader'),fight('falls_eels',21,12,'e_falls_eels'),chest('falls_chest',26,6,[{id:'root_charm',count:1},{id:'tonic',count:2}],70),
        npc('falls_bed','Marked Planting Bed',23,17,'bridge_bed_wait',{variants:[branch(req('bridge_seed'),'bridge_bed_grown'),branch(after(5),'plant_bridge')]}),
        npc('falls_small_bell','Unrung Bell',9,7,'soren_bell_find',{requires:{flags:['soren_quest_started'],notFlags:['soren_bell_found']}})
      ]
    },
    {
      id:'seed_vault',name:'Root Vault',era:'seed112',style:'cave',description:'The oldest roots hold four seasons in the dark. One grove shines with an unnatural spring.',spawn:{x:5,y:12},
      features:[feature('pillars',5,4,5,3),feature('crystals',22,4,5,3),feature('tree',17,5,3,4),feature('garden',18,15,9,5),feature('path',4,11,24,3),feature('path',20,7,3,12)],
      exits:[exit('vault_falls','seed_falls',4,12,26,12)],
      entities:[
        shrine('vault_shrine',7,14),npc('vault_memory','Root Memory',8,17,'vault_record'),fight('vault_pods',13,11,'e_vault_pods'),fight('vault_crown',21,7,'e_root_crown',done('seed_key')),
        fight('vault_hart',22,17,'e_glass_hart',{requires:req('ilex_quest_started'),...done('glass_hart_down')}),chest('vault_chest',9,6,[{id:'phoenix',count:2},{id:'ether',count:2}],95)
      ]
    },
    {
      id:'ash_relay',name:'Cinder Relay',era:'ash2310',style:'town',description:'A warm signal lamp stands above the last occupied shelter. Its route board still has space for new names.',spawn:{x:7,y:12},
      features:[feature('house',5,4,7,4),feature('house',21,4,6,4),feature('ruins',4,16,6,4),feature('path',4,11,24,3),feature('crystals',14,5,3,3),feature('garden',19,16,5,3,{requires:req('brann_vent_fixed')})],
      exits:[exit('relay_dunes','ash_dunes',27,12,5,12)],
      entities:[
        npc('relay_vale','Vale',16,11,'ash_vale',{requires:{notFlags:['vale_joined']}}),
        npc('relay_ada','Ada',10,10,'ash_ada',{variants:[branch(req('brann_quest_done'),'brann_hearth_done'),branch(req('brann_vent_fixed'),'brann_hearth_finish'),branch(req('brann_quest_started'),'brann_hearth_wait'),branch(after(4),'brann_hearth_start')]}),
        npc('relay_renn','Postmaster Renn',22,10,'ash_renn',{variants:[branch(req('vale_quest_done'),'vale_letter_done'),branch(req('vale_letter_delivered'),'vale_letter_finish'),branch(req('vale_quest_started'),'vale_letter_wait'),branch(after(4),'vale_letter_start')]}),
        shrine('relay_shrine',7,15),gate('relay_gate','Orchard Gate',26,17,'bell_orchard'),
        shop('relay_shop','Last Route Supply',19,7,['tonic','ether','phoenix','panacea','elixir','vale_caster','relay_shell','swift_spool']),
        chest('relay_chest',13,17,[{id:'ether',count:3}],90)
      ]
    },
    {
      id:'ash_dunes',name:'Rust Dunes',era:'ash2310',style:'ruin',description:'Road signs emerge from warm red dust. A broken skyway crosses the distant water.',spawn:{x:5,y:12},
      features:[feature('ruins',5,4,5,4),feature('ruins',22,4,5,4),feature('ruins',6,16,5,4),feature('crystals',22,16,5,3),feature('path',4,11,24,3),feature('path',15,4,3,8)],
      exits:[exit('dunes_relay','ash_relay',4,12,26,12),exit('dunes_foundry','ash_foundry',16,4,16,18),exit('dunes_skyway','ash_skybridge',27,12,5,12,req('bridge_seed'),'The skyway has no bridge. Plant the Bridge Seed at the First Falls in Year 112.')],
      entities:[npc('dunes_map','Route Board',16,9,'ash_map'),fight('dunes_scrap',11,12,'e_dunes_scrap'),fight('dunes_hounds',22,10,'e_dunes_hounds'),chest('dunes_chest_a',25,17,[{id:'phoenix',count:2}],85),chest('dunes_chest_b',8,6,[{id:'copper_ring',count:1},{id:'ether',count:2}],70)]
    },
    {
      id:'ash_foundry',name:'The Last Foundry',era:'ash2310',style:'ruin',description:'Empty machines keep the last shift running. Heat flows through a pipe that ends in another age.',spawn:{x:16,y:18},
      features:[feature('house',6,4,5,4),feature('house',22,4,5,4),feature('pool',6,10,4,5),feature('pool',23,11,4,4),feature('pillars',12,5,3,3),feature('path',15,5,3,15),feature('path',4,16,24,3)],
      exits:[exit('foundry_dunes','ash_dunes',16,19,16,5)],
      entities:[shrine('foundry_shrine',6,17),npc('foundry_log','Shift Record',10,8,'foundry_log'),npc('foundry_brann_hint','Open Vent',23,9,'foundry_coal'),fight('foundry_embers',14,13,'e_foundry_embers'),fight('foundry_walkers',21,11,'e_foundry_walkers'),fight('foundry_regent',17,7,'e_furnace_regent',done('ash_key')),chest('foundry_chest',26,17,[{id:'kiln_apron',count:1},{id:'panacea',count:3}],130)]
    },
    {
      id:'ash_skybridge',name:'Drowned Skyway',era:'ash2310',style:'ruin',description:'A living root spans the broken road. It has waited two thousand years for these footsteps.',spawn:{x:5,y:12},
      features:[feature('water',8,4,16,16),feature('bridge',4,11,24,3),feature('tree',8,10,2,4),feature('garden',24,5,4,5),feature('ruins',4,16,4,3)],
      exits:[exit('skyway_dunes','ash_dunes',4,12,26,12)],
      entities:[shrine('skyway_shrine',5,8),fight('skyway_drones',13,12,'e_bridge_drones'),fight('skyway_crab',22,12,'e_horizon_crab',done('future_bridge')),npc('skyway_record','Elia\'s Garden',26,7,'skyway_garden',{requires:req('future_bridge')}),chest('skyway_chest',26,16,[{id:'elixir',count:2},{id:'memory_lens',count:1}],180)]
    },
    {
      id:'glass_steps',name:'Prism Steps',era:'glass1186',style:'town',description:'Glass roofs reflect a city that has sold its difficult days. A dancer waits beside an empty stage.',spawn:{x:7,y:12},
      features:[feature('house',5,4,6,4),feature('house',21,4,6,4),feature('garden',5,16,6,4),feature('pillars',21,16,6,3),feature('path',4,11,24,3),feature('path',15,4,3,16)],
      exits:[exit('steps_archive','glass_archive',16,4,16,18)],
      entities:[
        npc('steps_nyx','Nyx',16,11,'glass_nyx',{requires:{notFlags:['nyx_joined']}}),npc('steps_citizen','Glass Citizen',9,10,'glass_citizen'),
        npc('steps_mask_seller','Mask Seller',22,10,'nyx_name_start',{variants:[branch(req('nyx_quest_done'),'nyx_name_done'),branch(req('nyx_name_found'),'nyx_name_finish'),branch(req('nyx_quest_started'),'nyx_name_wait')]}),
        npc('steps_blue_door','Tarin · Blue Door',25,8,'vale_letter_deliver',{requires:{flags:['vale_quest_started'],notFlags:['vale_letter_delivered']}}),
        shrine('steps_shrine',7,15),gate('steps_gate','Orchard Gate',26,17,'bell_orchard'),
        shop('steps_shop','The Clear Counter',19,7,['tonic','ether','phoenix','panacea','elixir','nyx_ribbon','glassweave','memory_lens','mira_relic','soren_relic']),
        chest('steps_chest',14,17,[{id:'panacea',count:3}],110)
      ]
    },
    {
      id:'glass_archive',name:'The Glass Archive',era:'glass1186',style:'archive',description:'Clear shelves hold lives in thin sheets. The rejected records fall into the cistern below.',spawn:{x:16,y:18},
      features:[feature('house',5,4,6,3),feature('house',22,4,5,3),feature('pillars',5,10,4,4),feature('pillars',22,10,5,4),feature('crystals',11,5,3,3),feature('path',15,4,3,16),feature('path',4,15,24,3)],
      exits:[exit('archive_steps','glass_steps',16,19,16,5),exit('archive_cistern','glass_cistern',27,16,5,12)],
      entities:[
        npc('archive_junior','Junior Archivist',19,10,'glass_archivist'),npc('archive_notice','Public Archive Notice',12,16,'archive_public'),npc('archive_assistant','Orin\'s Assistant',22,8,'archive_orin_hint'),
        npc('archive_watch','Watchmaker\'s Workbench',7,8,'mira_memory',{requires:{flags:['mira_quest_started'],notFlags:['mira_memory_found']}}),
        fight('archive_paper',16,12,'e_archive_paper'),fight('archive_guards',23,16,'e_archive_guards'),chest('archive_chest',9,18,[{id:'nyx_ribbon',count:1},{id:'ether',count:2}],120)
      ]
    },
    {
      id:'glass_cistern',name:'Ink Cistern',era:'glass1186',style:'cave',description:'Dark water carries the records that the city refused to keep. Their words still give off light.',spawn:{x:5,y:12},
      features:[feature('water',12,4,7,6),feature('water',12,15,7,5),feature('crystals',5,5,4,3),feature('crystals',23,16,4,3),feature('path',4,11,24,3),feature('bridge',13,10,4,5)],
      exits:[exit('cistern_archive','glass_archive',4,12,26,16),exit('cistern_observatory','glass_observatory',27,12,5,12)],
      entities:[npc('cistern_rejected','Rejected Record',8,16,'cistern_note'),npc('cistern_name','Name Shard',24,17,'nyx_name_find',{requires:{flags:['nyx_quest_started'],notFlags:['nyx_name_found']}}),fight('cistern_ink',12,12,'e_cistern_ink'),fight('cistern_masks',22,10,'e_cistern_masks'),chest('cistern_chest',25,5,[{id:'elixir',count:1},{id:'dew_pendant',count:1}],145)]
    },
    {
      id:'glass_observatory',name:'High Observatory',era:'glass1186',style:'archive',description:'A glass lens watches one fixed morning. Beyond it, the sky has begun to move.',spawn:{x:5,y:12},
      features:[feature('pillars',5,4,4,4),feature('pillars',23,4,4,4),feature('crystals',14,4,5,4),feature('garden',23,16,5,4),feature('path',4,11,24,3),feature('path',15,7,3,12)],
      exits:[exit('observatory_cistern','glass_cistern',4,12,26,12)],
      entities:[
        shrine('observatory_shrine',7,17),npc('observatory_seal','Sealed Record',12,9,'observatory_before',{requires:{notFlags:['glass_key']}}),
        fight('observatory_keeper',19,8,'e_index_keeper',done('glass_key')),
        npc('observatory_orin','Archivist Orin',23,13,'observatory_orin_wait',{requires:req('glass_key'),variants:[branch(req('orin_yields'),'observatory_orin_after')],hideIf:{chapterAtLeast:6,notFlags:['orin_yields']}}),
        fight('observatory_orin_battle',22,8,'e_orin',{requires:after(6),...done('orin_yields')}),
        chest('observatory_chest',25,17,[{id:'phoenix',count:3},{id:'ether',count:3}],160)
      ]
    },
    {
      id:'fold_shore',name:'Unspent Shore',era:'fold',style:'garden',description:'A dark sea holds the light of unused mornings. Small paths lead away from lives that never began.',spawn:{x:7,y:12},onEnter:[flag('fold_entered')],
      features:[feature('water',4,18,24,3),feature('crystals',5,4,5,4),feature('garden',21,4,6,4),feature('tree',14,5,4,4),feature('path',4,11,24,3)],
      exits:[exit('shore_gallery','fold_gallery',27,12,5,12)],
      entities:[npc('shore_welcome','A Clear Chime',15,11,'fold_welcome'),npc('shore_boatman','Unchosen Boatman',22,16,'fold_boatman'),shrine('shore_shrine',7,8),gate('shore_gate','Orchard Gate',5,16,'bell_orchard'),fight('shore_moths',21,12,'e_shore_moths'),shop('shore_shop','The Unspent Hour',13,16,['tonic','ether','phoenix','panacea','elixir','dawn_mantle','dawn_knot','mira_relic','soren_relic','brann_relic','ilex_relic','nyx_relic','vale_relic']),chest('shore_chest',26,7,[{id:'elixir',count:2}],220)]
    },
    {
      id:'fold_gallery',name:'Gallery of Hours',era:'fold',style:'archive',description:'Four ages hang in empty frames. A masked witness waits where their shadows meet.',spawn:{x:5,y:12},
      features:[feature('pillars',5,4,4,4),feature('pillars',12,4,4,4),feature('pillars',21,4,6,4),feature('crystals',5,16,5,4),feature('crystals',20,16,7,4),feature('path',4,11,24,3)],
      exits:[exit('gallery_shore','fold_shore',4,12,26,12),exit('gallery_heart','fold_heart',27,12,5,12,req('crown_open'),'The Fourfold Witness still guards the path.')],
      entities:[npc('gallery_mira','Clockmaker\'s Echo',8,9,'fold_mira'),npc('gallery_soren','Bellkeeper\'s Echo',16,7,'fold_soren'),npc('gallery_ilex','Guardian\'s Echo',11,17,'fold_ilex'),fight('gallery_guards',12,12,'e_gallery_guards'),fight('gallery_echoes',20,15,'e_gallery_echoes'),fight('gallery_witness',24,10,'e_fourfold_witness',done('crown_open')),chest('gallery_chest',25,18,[{id:'elixir',count:2},{id:'dawn_mantle',count:1}],230)]
    },
    {
      id:'fold_heart',name:'Heart of the Machine',era:'fold',style:'ruin',description:'Four streams of stolen time feed one motionless wheel. It has waited an eternity for one more morning.',spawn:{x:5,y:12},
      features:[feature('crystals',5,4,5,4),feature('crystals',22,4,5,4),feature('pillars',12,4,7,5),feature('water',10,16,12,4),feature('path',4,11,24,3),feature('path',16,8,3,9)],
      exits:[exit('heart_gallery','fold_gallery',4,12,26,12),exit('heart_garden','fold_crown',27,12,5,12,req('engine_stopped'),'The Still Engine holds the last dawn. Stop it to open this road.')],
      entities:[shrine('heart_shrine',7,16),npc('heart_terminal','Last Command Record',9,8,'fold_terminal'),npc('heart_rest','A Clear Breath',10,15,'fold_last_shrine'),fight('heart_eyes',15,12,'e_heart_eyes'),fight('heart_engine',23,11,'e_still_engine',done('engine_stopped')),chest('heart_chest',25,17,[{id:'elixir',count:3},{id:'phoenix',count:3}],0)]
    },
    {
      id:'fold_crown',name:'Dawn Garden',era:'fold',style:'garden',description:'The first free dawn rests on an unopened seed. Six shadows fall toward the same sunrise.',spawn:{x:5,y:12},
      features:[feature('garden',5,4,8,5),feature('garden',20,4,7,5),feature('garden',5,16,8,4),feature('garden',20,16,7,4),feature('tree',15,6,4,4),feature('path',4,11,24,3),feature('crystals',15,17,4,3)],
      exits:[exit('garden_heart','fold_heart',4,12,26,12)],
      entities:[shrine('garden_shrine',8,9),gate('garden_gate','One Last Orchard Road',25,17,'bell_orchard'),npc('garden_seed','The Dawn Seed',17,11,'final_choice')]
    }
  ];

  const epilogue = (hero,base,complete) => ({hero,base,complete,requires:req(`${hero}_quest_done`)});
  C.endings = {
    renew:{id:'renew',title:'A Dawn of Their Own',subtitle:'Each age follows its own road.',lines:[
      'Mira opens her hand. The stolen hours return to the lives that made them.',
      'The roads between ages begin to close. There is time for six names, six promises, and one long goodbye.',
      'Ilex returns to a forest where one leaf has turned gold. Nyx finds a city that must learn to remember.',
      'Vale sees the first thin line of sunrise above the relay. Brann goes home before the public kiln grows cold.',
      'Soren rings the morning bell. Mira lets her father\'s watch run one minute slow.',
      'Orin returns the records he bought. He places his daughter\'s cup beside an open window.',
      'The orchard grows in four separate ages. Its roots no longer take the future from one to feed another.',
      'No one can promise what the next season will bring. At last, there will be a next season.'
    ],epilogues:{
      mira:epilogue('mira','Mira repairs the harbour clock. At noon, she leaves her bench and walks outside.','Mira and Fenn leave every clock one minute slow. The town spends that minute in the sun.'),
      soren:epilogue('soren','Soren keeps the names of the missing. He also learns the names of each new arrival.','The seventh bell rings for Lio. Each evening, someone adds a new story to the harbour memorial.'),
      brann:epilogue('brann','Brann teaches young workers to listen before a pipe begins to fail.','The copper vent lasts two thousand years. At Cinder Relay, twelve warm cups rest above it.'),
      ilex:epilogue('ilex','Ilex watches the first leaf fall. They leave it where it lands.','Ilex waits through winter beside a buried seed. In spring, the first shoot needs no help to rise.'),
      nyx:epilogue('nyx','Nyx opens a public stage beside the archive. No story needs permission to be told.','Nyx dances with an empty space beside her. Every child at Prism Steps learns Eda\'s name.'),
      vale:epilogue('vale','Vale adds three new houses to his route. The road is longer. He is glad.','The relay garden grows from Tarin\'s seeds. Vale carries its first fruit to every occupied home.')
    }},
    release:{id:'release',title:'The Open Road',subtitle:'Four ages meet beneath one sky.',lines:[
      'The Dawn Seed opens. Roads of light connect the forest, the harbour, the glass city, and the relay.',
      'The world does not become simple. Old maps fail. New neighbours bring difficult questions.',
      'A river boat from the Seed Age delivers fresh soil to Ash Tomorrow. A relay lamp lights Mosswake Camp.',
      'Glass workers teach the kiln to use less fuel. Harbour children dance beside people whose stories they once read in books.',
      'The six travellers make no new machine to govern these roads. They leave the gates in the care of the towns.',
      'Orin walks the road to his daughter\'s garden. He takes no record glass with him.',
      'The orchard stands where four mornings meet. People argue beneath its branches, share food, and change their minds.',
      'For the first time, the future can answer when the past calls its name.'
    ],epilogues:{
      mira:epilogue('mira','Mira makes clocks that show four local times. She is still late for dinner.','Fenn opens a second workshop at the relay. Their signs reserve one minute each day for rain.'),
      soren:epilogue('soren','Soren builds small bells beside each gate. The notes travel farther than the sound.','People from four ages bring names to the harbour memorial. Soren rings a small bell for each one.'),
      brann:epilogue('brann','Brann takes his hammer through every gate. Each town has something that needs a safe repair.','Brann and Ada build a public hearth beside the orchard. No traveller needs to prove they belong there.'),
      ilex:epilogue('ilex','Ilex asks the relay children to show them snow. The lesson takes a whole afternoon.','Ilex carries winter seeds through the gates. Some grow in places where the old records said nothing could.'),
      nyx:epilogue('nyx','Nyx starts a travelling stage. The cast changes each time a gate opens.','Nyx teaches Eda\'s dance in four ages. Every town adds one step of its own.'),
      vale:epilogue('vale','Vale becomes the first courier whose route board needs a year beside each address.','Vale visits Tarin with a basket from the relay garden. The reply arrives in person this time.')
    }},
    preserve:{id:'preserve',title:'The Hours We Share',subtitle:'One crossing stays open by choice.',lines:[
      'The travellers remove the engine\'s command to preserve. They place the living seed where the command once stood.',
      'The seed can hold one crossing. It asks for hours freely given, and takes none when the answer is no.',
      'The gates open at the orchard on the first morning of each season. People arrive with news, tools, and enough time to listen.',
      'Some years the crossing stays open for days. Some years it opens only long enough to carry one letter.',
      'The six travellers become its first keepers. Each can leave. Each returns for reasons of their own.',
      'Orin helps return the stolen hours. When the work is done, he closes his record book and joins the people outside.',
      'No one owns the orchard. No one can order another person to stay.',
      'The next dawn begins with a small question: how much time can we give each other today?'
    ],epilogues:{
      mira:epilogue('mira','Mira builds the crossing clock without a lock. Any keeper can stop it.','Mira places her father\'s watch beside the crossing. Its missing minute belongs to no one but the person who needs it.'),
      soren:epilogue('soren','Soren rings the bell when the crossing opens. He waits beside the gate until the last person leaves.','Soren rings Lio\'s small bell at each opening. Its note reminds the keepers that a name is more than a record.'),
      brann:epilogue('brann','Brann checks the crossing\'s supports each season. He writes instructions that any worker can follow.','Brann brings Ada to see the original copper vent. They sign the new repair plan with both their names.'),
      ilex:epilogue('ilex','Ilex tends the roots. They let the orchard rest when its leaves grow thin.','Ilex plants a winter seed beside the gate. The keepers learn that a closed road can also be a promise.'),
      nyx:epilogue('nyx','Nyx keeps the crossing\'s records in stories that everyone can hear. No one can buy a page.','Nyx leaves one part of Eda\'s dance unfinished. A new traveller completes it each season.'),
      vale:epilogue('vale','Vale carries letters between openings. The postmark shows a season as well as a year.','Tarin\'s seeds grow around the relay lamp. Vale carries a fresh packet to the orchard each spring.')
    }},
    early:{id:'early',title:'Before the First Bell',subtitle:'A second journey finds the first chance.',lines:[
      'The engine stops before it takes a single future hour.',
      'The harbour clock starts. Its first bell sounds almost surprised.',
      'In the glass city, Orin opens a window. Elia asks him to come outside. This time, he does.',
      'No gate opens in the orchard. No tower falls. The travellers have saved a world that will never know it needed them.',
      'Mira finds six cups on her workbench. She is certain that she set out only two.',
      'A green leaf, a bright ribbon, and an old route ticket lie beneath the cups.',
      'Soren pours the tea. No one explains why the chairs are already warm.',
      'For once, there is nothing urgent to repair.'
    ],epilogues:{}}
  };

  C.help = {
    battle:['Choose an active party of three from the party menu. All six travellers share experience.','Attack to save skill points. Use an enemy\'s weak element for more damage.','Line and circle skills can strike more than one enemy. A bright charge warns of a strong attack.','Guard before a large attack. Soren can heal and revive; Ilex can remove harmful conditions.','Dual skills need both named heroes to be ready. Triple skills also need a full Bond gauge.','Use shrines to restore the party. A defeat keeps the story available so you can try again.'],
    travel:['All enemies are visible in the world. You can avoid ordinary patrols.','Return to the Orchard of Hours through a town gate to change ages.','The journal states the next required place. Optional companion quests unlock after the third living seal.','Each chest can be opened once per journey. Cleared encounters stay clear for the rest of that journey.'],
    endings:['All three final choices finish the main story. No companion quest is required for an ending.','Each completed companion quest changes that hero\'s ending scene.','New Game Plus keeps earned growth and opens an early route at the Orchard of Hours.']
  };

  // HP only: allow bosses to show their authored phases at normal route levels.
  for (const enemy of Object.values(C.enemies)) if (enemy.boss) enemy.maxHp = Math.round(enemy.maxHp * 1.4);
  for (const zone of C.zones) { zone.width=32; zone.height=24; }
  C.zoneById = Object.fromEntries(C.zones.map(z => [z.id,z]));
  C.counts = {chapters:C.chapters.length,zones:C.zones.length,eras:C.eras.length,heroes:Object.keys(C.heroes).length,quests:C.quests.length,encounters:Object.keys(C.encounters).length,enemyTypes:Object.keys(C.enemies).length,bossTypes:Object.values(C.enemies).filter(e=>e.boss).length,skills:Object.keys(C.skills).length,equipment:Object.values(C.items).filter(i=>['weapon','armor','accessory'].includes(i.kind)).length,consumables:Object.values(C.items).filter(i=>i.kind==='consumable').length,endings:Object.keys(C.endings).length};
  global.Dawn = global.Dawn || {};
  global.Dawn.Content = C;
})(globalThis);
