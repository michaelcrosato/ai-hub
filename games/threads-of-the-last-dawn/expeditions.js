/* The Hearthbound Roads — authored expeditions and safe checkpoint runtime.
 * Load after journey.js, before battle.js. No DOM or engine modifications.
 */
(() => {
'use strict';
const D=globalThis.Dawn,C=D?.Content;
if(!C)throw new Error('Load content.js before expeditions.js.');
if(C.expeditions)return;
const clone=v=>JSON.parse(JSON.stringify(v)),own=(o,k)=>!!o&&Object.hasOwn(o,k);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v,min=0,max=1e7)=>Number.isInteger(v)&&v>=min&&v<=max;
const finite=(v,min=0,max=1e7)=>Number.isFinite(v)&&v>=min&&v<=max;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const materials=['memory_ore','living_fiber','prism_dust','storm_coil','echo_glass'];
const hit=(name,power=1,element='physical',target='enemy',extra={})=>
  ({name,power,element,type:element==='physical'?'physical':'magic',target,telegraph:.65,...extra});
const charge=(name,power,element,target='allEnemies',extra={})=>
  hit(name,power,element,target,{charge:true,telegraph:2.3,...extra});
const support=(name,status)=>({name,type:'support',target:'self',status,telegraph:1});
const enemy=(id,name,rigId,maxHp,atk,mag,def,speed,weak,pattern,extra={})=>{
  C.enemies[id]={id,name,rigId,maxHp,atk,mag,def,speed,weak,resist:[],pattern,
    staggerMax:85,staggerDuration:3.5,staggerRecovery:2,atb:65,boss:false,...extra};
};

// Five road creatures and six guardians retain the existing animation rigs.
enemy('hr_salt_runner','Salt-Rope Runner','rivet_hound',540,24,24,12,13,['wind','water'],
  [hit('Loose Mooring',1.15),hit('Salt in the Thread',.9,'water','enemy',{status:{slow:5}})]);
enemy('hr_thorn_porter','Thornpack Porter','rootling',760,32,28,18,10,['fire','water'],
  [support('Pack of Green Wood',{guard:4}),hit('Careful Burden',1.3,'earth'),
    charge('Spilled Pollen',.95,'earth','allEnemies',{status:{poison:5}})]);
enemy('hr_margin_courier','Margin Courier','mirror_mask',1000,37,42,20,15,['water','spark'],
  [hit('A Letter Too Late',1.2,'void'),support('Borrowed Hurry',{haste:6}),
    charge('Address Unknown',1.05,'wind','line')],{resist:['void']});
enemy('hr_copper_swallow','Copper Swallow','memory_moth',1020,40,43,21,14,['earth','water'],
  [hit('Live Feather',1.2,'spark'),charge('Low Wire',1.1,'spark','line'),
    hit('Hot Return',.95,'fire','enemy',{status:{burn:5}})],{resist:['spark']});
enemy('hr_way_echo','Road Not Taken','hollow_mariner',1350,48,50,26,13,['fire','wind'],
  [hit('Almost Home',1.25,'void'),charge('The Other Turning',1.1,'water','allEnemies'),
    hit('Old Footsteps',1.1,'earth','enemy',{status:{slow:5}})],{staggerMax:95});

enemy('hr_tide_warden','The Ferryman of Closed Roads','bell_warden',3200,29,30,16,10,['wind','water'],
  [charge('One More Crossing',1.45,'water'),hit('Oar Across the Road',1.4),
    charge('Borrowed Weather',1.2,'wind','line')],
  {boss:true,staggerMax:130,staggerRecovery:4,guardedBy:'hr_salt_runner',
    description:'The runner ties a ward around its ferryman. Cut the rope, then use the long casting windows.',
    phases:[{at:.5,name:'An Open Landing',weak:['wind','spark'],resist:['water'],magMult:1.08,
      pattern:[charge('Room for the Last Boat',1.6,'water'),hit('The Returning Oar',1.4),
        charge('A Clear Horizon',1.25,'wind','line')]}]});
enemy('hr_seed_caravan','The Walking Seedhouse','root_crown',4200,35,35,20,10,['fire','wind'],
  [charge('A Season in Each Crate',1.15,'earth','allEnemies',{status:{poison:5}}),
    hit('Root Axle',1.5),{name:'What the Cargo Remembers',type:'heal',target:'allAllies',power:1.3,charge:true,telegraph:2.5}],
  {boss:true,staggerMax:145,staggerRecovery:4,
    description:'Break its healing chant, or the seedhouse will keep its porter on the road.',
    phases:[{at:.45,name:'The Cargo Opens',weak:['water','fire'],magMult:1.08,
      pattern:[charge('Every Seed a Shelter',1.35,'earth'),hit('Rainwood Wheel',1.6,'water'),
        {name:'Leave Some for the Journey',type:'heal',target:'allAllies',power:1.5,charge:true,telegraph:2.7}]}]});
enemy('hr_many_masks','The Keeper of Unsent Names','index_keeper',5300,40,43,23,12,['earth','water'],
  [support('A Face for Every Letter',{guard:4,haste:5}),hit('Signed in Silver',1.35,'void'),
    charge('Return to Sender',1.3,'spark')],
  {boss:true,staggerMax:150,staggerRecovery:4,
    description:'Its borrowed guard and haste vanish when it breaks. Its weaknesses change with each mask.',
    phases:[{at:.6,name:'The Name We Kept',weak:['fire','wind'],resist:['water'],
      pattern:[charge('Fold the Address',1.4,'void'),support('Another Signature',{guard:5}),hit('Silver Seal',1.4)]},
      {at:.28,name:'The Name We Share',weak:['spark','water'],resist:[],magMult:1.1,
      pattern:[charge('Everyone May Answer',1.5,'wind','allEnemies',{telegraph:2.6}),hit('An Open Envelope',1.5,'void')]}]});
enemy('hr_weather_cart','The Storm on Wheels','horizon_crab',5900,44,44,24,12,['earth','water'],
  [charge('Rain for the Next Town',1.4,'spark'),hit('Iron Wheel',1.5),
    support('Store the Thunder',{haste:6})],
  {boss:true,staggerMax:155,staggerRecovery:4,
    description:'Its early gauge fills quickly. Defending restores extra MP on this route.',
    phases:[{at:.48,name:'The Roof Comes Off',weak:['earth','wind'],resist:['spark'],magMult:1.1,
      pattern:[charge('The Whole Sky Delivered',1.6,'spark','allEnemies',{telegraph:2.8}),
        hit('Rain on Hot Steel',1.2,'water','line'),support('One Last Charge',{haste:5})]}]});
enemy('hr_horizon_taker','The Collector of Almosts','fourfold_witness',7100,50,51,29,12,['fire','wind'],
  [charge('All the Places We Missed',1.3,'void'),hit('A Road Removed',1.5,'water')],
  {boss:true,staggerMax:165,staggerRecovery:4,guardedBy:'hr_way_echo',
    description:'Its road echo forms a ward. The collector can call that echo back through a long chant.',
    phases:[{at:.55,name:'One More Possible Road',weak:['water','earth'],resist:['fire'],
      pattern:[{name:'A Footstep Remembered',type:'revive',target:'ally',power:.4,charge:true,telegraph:3},
        charge('The Fare for Tomorrow',1.4,'void'),hit('Unspent Distance',1.5)]},
      {at:.25,name:'A Place to Arrive',weak:['fire','water','wind'],resist:[],magMult:1.1,
      pattern:[charge('The End of Almost',1.55,'water','allEnemies',{telegraph:2.8}),hit('A Real Horizon',1.65,'wind')]}]});
enemy('hr_hearth_guard','The House That Would Not Open','still_engine',8200,55,56,31,12,['fire','wind'],
  [hit('Keep the Road Outside',1.5),charge('A Safe and Empty Room',1.3,'earth')],
  {boss:true,staggerMax:175,staggerRecovery:4,guardedBy:['hr_way_echo','hr_margin_courier'],
    description:'Two couriers form its ward. Linked techniques grant short protection to the whole party on this route.',
    phases:[{at:.67,name:'The Door We Forgot',weak:['water','earth'],resist:['fire'],
      pattern:[{name:'Invite the Old Fear',type:'revive',target:'ally',power:.35,charge:true,telegraph:3},
        charge('Nothing Can Hurt Us Here',1.45,'void'),hit('A Closed Latch',1.6)]},
      {at:.3,name:'A Hearth for the Road',weak:['fire','wind','spark'],resist:[],magMult:1.08,
      pattern:[charge('Let the Weather In',1.65,'water','allEnemies',{telegraph:3}),
        hit('The First Open Window',1.5,'wind','line')]}]});

C.expeditionBoons=Object.fromEntries([
  ['trail_vigor','A Wider Breath','Maximum HP +24%. Gain the added capacity once when chosen.','vigor'],
  ['deep_flask','The Deep Flask','Maximum MP +16. Fill that extra space once when chosen.','flask'],
  ['keen_edge','Honed on the Road','Physical attack +18% for the rest of this run.','attack'],
  ['bright_ink','A Living Annotation','Magic +18% for the rest of this run.','magic'],
  ['light_feet','The Unburdened Step','Speed +3. Every gauge fills faster.','speed'],
  ['camp_broth','The Pot We Share','After each victory, recover 12% of maximum HP.','healing'],
  ['dew_collector','Dew in the Morning','After each victory, every active ally recovers 6 MP.','recovery'],
  ['unbroken_oath','A Promise at the Gate','Begin every remaining stage with six seconds of Guard.','guard'],
  ['clear_air','Windows Open','Poison, Burn, and Slow cannot be applied during the remaining stages.','cleanse'],
  ['fracture_lens','The Useful Fault','All pressure you inflict increases by 40%.','pressure'],
  ['shared_spark','An Ember Carried','Gain 25 Bond at the start of every remaining stage.','bond'],
  ['thrift_knot','One Thread Further','Technique MP costs fall by 20%, rounded down, with a minimum cost of 1.','economy']
].map(([id,name,description,kind])=>[id,{id,name,description,kind}]));

const stage=(name,zone,enemies,description,scale=1)=>({name,zone,enemies,description,scale});
const routeRows=[
 {id:'hr_coast',name:'The Salt-Rope Circuit',era:'bell642',chapter:2,minLevel:5,material:'memory_ore',ruleId:'tidal_window',
  description:'Carry tools and letters along a coast whose harbours no longer agree on the tide.',
  rule:'Tidal windows: enemy charges last 0.6 seconds longer. Your hits deal 20% more damage while an enemy is casting.',
  stages:[
   stage('Untie the Morning','bell_mooring',['hr_salt_runner','dp_brine_skitter'],'Ropes have grown teeth around the reed boats. Wind and water loosen the runners.'),
   stage('A Lamp in the Wake','bell_quay',['dp_chain_eel','dp_lamp_wisp'],'The lamp carries the wrong tide. Follow each weakness instead of striking the same element twice.'),
   stage('Three Ways Ashore','bell_shipyard',['hr_salt_runner','dp_brine_skitter','dp_lamp_wisp'],'The yard fills with close targets. A circle or all-enemy technique can clear room for healing.'),
   stage('The Last Dry Rope','bell_beacon',['dp_chain_eel','hr_salt_runner'],'The ridge catches every storm. Keep an action ready for the longer casting windows.',1.12),
   stage('The Landing We Share','bell_breakwater',['hr_tide_warden','hr_salt_runner'],'Defeat the runner that wards the ferryman, then answer the changing tide.') ]},
 {id:'hr_canopy',name:'The Living Cargo',era:'seed112',chapter:3,minLevel:7,material:'living_fiber',ruleId:'living_cargo',
  description:'Escort seed crates that remember rain, drought, and every person who carried them.',
  rule:'Living cargo: enemies begin with six seconds of Regeneration. Your healing restores 20% more HP.',
  stages:[
   stage('A Load of Spring','seed_canopy',['dp_seed_crawler','hr_thorn_porter'],'The porter hides behind green wood. Fire opens the pack; water reaches what is beneath it.'),
   stage('Water for a Stranger','seed_stoneweir',['dp_pollen_wisp','dp_thirst_hart'],'Pollen and thirst pull the party in different directions. Cleanse poison or shorten the fight.'),
   stage('The Crates Take Root','seed_ambermine',['hr_thorn_porter','dp_seed_crawler','dp_pollen_wisp'],'Three living loads share the road. Team attacks beat their brief opening regeneration.'),
   stage('What We Owe the Rain','seed_seedhouse',['dp_thirst_hart','hr_thorn_porter'],'The hart keeps the dry season in its antlers. Water and fire can release it.',1.1),
   stage('A Door in the Seedhouse','seed_crownmeadow',['hr_seed_caravan','hr_thorn_porter'],'Break the seedhouse healing chant before it fills the porter again.') ]},
 {id:'hr_prism',name:'The Unsent Post',era:'glass1186',chapter:4,minLevel:9,material:'prism_dust',ruleId:'borrowed_masks',
  description:'Deliver the letters a city was too frightened to send. Some addresses have learned to defend themselves.',
  rule:'Borrowed masks: enemies begin Guarded for four seconds. Breaking an enemy removes its Guard, Haste, and Regeneration.',
  stages:[
   stage('The First Address','glass_market',['hr_margin_courier','dp_stage_mask'],'Both faces begin behind guard. Build pressure while their protection fades.'),
   stage('A Letter Across Water','glass_canalworks',['dp_lens_drone','dp_paper_dancer'],'Earth reaches the drone. Fire or water reaches the dancer. Split the work between allies.'),
   stage('The Names We Kept','glass_mirrorgarden',['hr_margin_courier','dp_stage_mask','dp_paper_dancer'],'The couriers crowd the garden. Break one to open an unguarded target for a link.'),
   stage('Everyone May Answer','glass_signalhall',['dp_lens_drone','hr_margin_courier'],'Haste is another borrowed mask. A break removes it along with the current action.',1.12),
   stage('Return to Sender','glass_civicspire',['hr_many_masks','hr_margin_courier'],'The keeper changes its weakness twice. Read each new mask before you spend the party gauges.') ]},
 {id:'hr_cinder',name:'Weather on Wheels',era:'ash2310',chapter:4,minLevel:10,material:'storm_coil',ruleId:'stormfront',
  description:'Bring a moving rain engine through the ash roads before it decides that every town is a storm drain.',
  rule:'Stormfront: enemies start at 90% ATB. Defend restores an additional 4 MP on this route.',
  stages:[
   stage('Under a Copper Sky','ash_relay',['dp_wire_hound','hr_copper_swallow'],'Early attacks arrive quickly. Water reaches both travelers of the wire.'),
   stage('Where the Salt Burns','ash_saltroad',['dp_arc_ray','dp_ash_scraper'],'The ray fears earth; the scraper fears water and spark. Keep enough MP for both.'),
   stage('An Unquiet Return','ash_understation',['hr_copper_swallow','dp_wire_hound','dp_arc_ray'],'Three live circuits fill the lane. Defending makes space and refills a spent spell.'),
   stage('A Roof for the Weather','ash_cloudhangar',['dp_ash_scraper','hr_copper_swallow'],'The machine wants to lift off with its load. Break the long sweep or guard through it.',1.1),
   stage('Rain at the Door','ash_homefield',['hr_weather_cart','hr_copper_swallow'],'The cart stores thunder, then opens its roof. Follow the charge and the new weakness.') ]},
 {id:'hr_unspent',name:'The Almost Road',era:'fold',chapter:7,minLevel:13,material:'echo_glass',ruleId:'unspent_toll',
  description:'Carry a real destination through the Fold. The road offers a hundred other places you could have reached.',
  rule:'Unspent toll: lose 25 Bond at each stage entrance. Every weakness hit earns 4 additional Bond.',
  stages:[
   stage('A Road with No Departure','fold_waystation',['dp_unspent_moth','hr_way_echo'],'The Fold takes part of the party Bond. Earn it back by using the moth and echo weaknesses.'),
   stage('The Other Weather','fold_gallery',['dp_hollow_mariner','dp_tide_image'],'The mariner fears spark and earth. The image fears wind and fire.'),
   stage('Someone Else Arrives','fold_loom',['hr_way_echo','dp_unspent_moth','dp_hollow_mariner'],'The possible roads meet. Strike several weaknesses with a link and rebuild the toll.'),
   stage('A Place Worth Choosing','fold_gallery',['dp_tide_image','hr_way_echo'],'The images want you to keep walking forever. Save enough healing for the collector.',1.12),
   stage('The End of Almost','fold_loom',['hr_horizon_taker','hr_way_echo'],'Cut the echo ward. Interrupt the long revival chant when the collector calls it back.') ]},
 {id:'hr_common',name:'The Hearthbound Relay',era:'fold',chapter:7,minLevel:15,material:'echo_glass',ruleId:'common_cause',
  description:'Bring one shared ember through five ages. Every load reaches home only because someone else carries it next.',
  rule:'Common cause: every dual or triple technique grants the whole party 2.5 seconds of Guard after it resolves.',
  stages:[
   stage('The Ember Leaves the Coast','bell_breakwater',['dp_unspent_moth','hr_margin_courier'],'The relay begins with a letter from an age that has not happened yet.'),
   stage('A Seed for the Next Carrier','seed_crownmeadow',['dp_hollow_mariner','hr_thorn_porter'],'The second carrier brings green wood. Linked techniques protect the whole party as the ember passes.'),
   stage('A Name for Every Hand','glass_civicspire',['dp_tide_image','hr_copper_swallow','hr_way_echo'],'Three ages crowd one road. Pair allies whose elements cover more than one weakness.'),
   stage('A Roof for the Last Mile','ash_homefield',['hr_way_echo','dp_unspent_moth','dp_tide_image'],'Spend gauges together for short protection, but leave a route back to healing.'),
   stage('The House Opens','fold_loom',['hr_hearth_guard','hr_way_echo','hr_margin_courier'],'Two carriers hold the ward. Open the house by defeating them, then stop its revival chant.') ]}
];

C.expeditions=Object.fromEntries(routeRows.map((route,index)=>{
  route.maxTier=6;route.completeFlag=route.id+'_cleared';
  route.firstReward={gold:140+index*45,xp:150+index*70,items:{haven_supplies:6+index,[route.material]:2}};
  route.rewardCaps={gold:420+index*90,items:{haven_supplies:9,[route.material]:7}};
  route.stages=route.stages.map((s,i)=>{
    const id='hr_e_'+route.id.slice(3)+'_'+(i+1);
    const reward={gold:32+index*10+i*9,items:{haven_supplies:1,...(i===1||i===3?{[route.material]:1}:i===4?{[route.material]:2}:{})}};
    C.encounters[id]={id,name:route.name+' · '+(i+1)+'/5 · '+s.name,
      enemies:[...s.enemies],boss:i===4,repeatable:true,repeat:false,scaleToParty:true,
      minLevel:route.minLevel,recommendedLevel:route.minLevel,requires:{chapterAtLeast:route.chapter},
      expeditionRoute:route.id,expeditionStage:i,xp:0,gold:0,loot:[],effects:[],intro:[],victory:[]};
    return {...s,encounter:id,reward};
  });
  return [route.id,route];
}));

const blank=()=>({serial:0,records:{},run:null,last:null});
const freshRecord=()=>({runs:0,clears:0,banks:0,bestTier:-1,bestTurns:null,bestSeconds:null,furthest:0});
const riskOf=run=>run.decisions.filter(v=>v==='press').length;
const checkpointPhase=run=>run.stage===5?'complete':run.boons.length===run.stage?'boon':
  run.stage>0&&run.decisions.length<run.stage?'choice':'ready';
function rawReward(run){
  const route=C.expeditions[run.route],out={gold:0,xp:0,items:{}};
  for(let i=0;i<run.stage;i++){
    const risk=run.decisions.slice(0,i).filter(v=>v==='press').length,r=route.stages[i].reward;
    out.gold+=Math.floor(r.gold*(1+.25*risk+.15*run.tier));
    for(const [id,n]of Object.entries(r.items))out.items[id]=(out.items[id]||0)+n;
  }
  const earnedRisk=run.decisions.slice(0,Math.max(0,run.stage-1)).filter(v=>v==='press').length;
  if(run.stage){
    out.items[route.material]=(out.items[route.material]||0)+earnedRisk+(run.stage===5?Math.floor(run.tier/2):0);
    out.items.haven_supplies+=Math.floor(earnedRisk/2)+(run.stage===5?Math.floor(run.tier/3):0);
    out.gold=Math.max(0,out.gold-run.decisions.filter(v=>v==='recover').length*30);
  }
  return out;
}
function rewardPreview(state,run=state?.expeditions?.run){
  if(!run)return{gold:0,xp:0,items:{},repeat:{gold:0,items:{}},first:null,bonus:0};
  const route=C.expeditions[run.route],raw=rawReward(run),bonus=state.flags.project_dock_2?0.2:state.flags.project_dock_1?0.1:0;
  const repeat={gold:Math.min(route.rewardCaps.gold,Math.floor(raw.gold*(1+bonus))),items:{}};
  for(const [id,n]of Object.entries(raw.items))repeat.items[id]=Math.min(route.rewardCaps.items[id]||0,Math.floor(n*(1+bonus)));
  const first=run.stage===5&&!(state.expeditions.records[run.route]?.clears>0)?clone(route.firstReward):null;
  const out={gold:repeat.gold+(first?.gold||0),xp:first?.xp||0,items:{...repeat.items},repeat,first,bonus};
  if(first)for(const [id,n]of Object.entries(first.items))out.items[id]=(out.items[id]||0)+n;
  return out;
}

function valid(state){
  const x=state?.expeditions;if(!record(x)||!int(x.serial)||!record(x.records))return false;
  const reward=r=>record(r)&&int(r.gold,0,1e5)&&int(r.xp,0,1e5)&&record(r.items)&&
    Object.entries(r.items).every(([id,n])=>['haven_supplies',...materials].includes(id)&&int(n,0,100));
  let totalRuns=0;
  for(const [id,v]of Object.entries(x.records)){
    if(!own(C.expeditions,id)||!record(v)||!['runs','clears','banks'].every(k=>int(v[k]))||
      v.runs<1||v.clears>v.banks||v.banks>v.runs||!int(v.bestTier,-1,6)||!int(v.furthest,0,5)||
      (v.clears===0?(v.bestTier!==-1||v.bestTurns!==null||v.bestSeconds!==null):
        (!int(v.bestTurns)||!finite(v.bestSeconds)||v.bestTier<0||v.furthest!==5))||
      (v.banks>0&&v.furthest<1)||(v.clears>0&&!state.flags[C.expeditions[id].completeFlag]))return false;
    totalRuns+=v.runs;
  }
  if(totalRuns!==x.serial)return false;
  if(x.last!==null){
    const v=x.last;if(!record(v)||!int(v.id,1,x.serial)||!own(C.expeditions,v.route)||
      !['cleared','banked','abandoned','defeat'].includes(v.outcome)||!int(v.stage,0,5)||
      !int(v.tier,0,6)||!int(v.risk,0,4)||typeof v.first!=='boolean'||!reward(v.reward)||
      (v.outcome==='cleared'&&v.stage!==5)||(v.first&&v.outcome!=='cleared')||!x.records[v.route])return false;
    const paid=['cleared','banked'].includes(v.outcome),route=C.expeditions[v.route];
    if(paid&&(!v.stage||!x.records[v.route].banks)||!paid&&(v.reward.gold||v.reward.xp||Object.values(v.reward.items).some(n=>n)))return false;
    if(v.reward.gold>route.rewardCaps.gold+(v.first?route.firstReward.gold:0)||v.reward.xp>(v.first?route.firstReward.xp:0))return false;
    for(const [id,n]of Object.entries(v.reward.items))if(n>(route.rewardCaps.items[id]||0)+(v.first?route.firstReward.items[id]||0:0))return false;
  }
  if(x.run===null)return true;
  const r=x.run,route=record(r)&&C.expeditions[r.route];
  if(!route||!int(r.id,1,x.serial)||r.id!==x.serial||!int(r.stage,0,5)||!int(r.tier,0,route.maxTier)||
    !int(r.level,route.minLevel,2000)||r.level!==1+Math.floor(Math.sqrt(state.xp/45))||!finite(r.seconds)||!int(r.turns)||
    !Array.isArray(r.party)||r.party.length!==3||new Set(r.party).size!==3||
    r.party.some(id=>!own(C.heroes,id)||!own(state.roster,id))||JSON.stringify(r.party)!==JSON.stringify(state.active)||
    !Array.isArray(r.boons)||r.boons.length>5||new Set(r.boons).size!==r.boons.length||r.boons.some(id=>!own(C.expeditionBoons,id))||
    !Array.isArray(r.decisions)||r.decisions.length>4||r.decisions.some(v=>!['steady','press','recover'].includes(v)))return false;
  const count=Math.min(r.stage,4),phase=checkpointPhase(r);
  if(r.boons.length<Math.min(r.stage,5)||r.boons.length>Math.min(r.stage+1,5)||
    r.decisions.length>count||r.decisions.length<Math.max(0,count-(phase==='boon'||phase==='choice'?1:0))||
    (r.stage===5&&(r.boons.length!==5||r.decisions.length!==4))||r.phase!==phase)return false;
  const rec=x.records[r.route],o=r.origin,z=record(o)&&C.zoneById[o.zone];
  if(!rec||rec.runs<1||r.tier>Math.min(6,rec.bestTier+1)||state.chapter<route.chapter||
    !z||!finite(o.x,0,z.width*16)||!finite(o.y,0,z.height*16)||!['foot','skiff','airship'].includes(o.travelMode)||
    (o.travelMode==='skiff'&&!state.flags.transport_skiff)||(o.travelMode==='airship'&&!state.flags.transport_airship)||
    !record(o.health)||r.party.some(id=>!record(o.health[id])||!finite(o.health[id].hp,0,1e7)||!finite(o.health[id].mp,0,1e7)))return false;
  if(o.worldReturn!==null){const p=o.worldReturn,w=record(p)&&C.zoneById[p.zone];if(!w||w.kind!=='overworld'||!finite(p.x,0,w.width-1)||!finite(p.y,0,w.height-1))return false;}
  return state.zone===route.stages[Math.min(r.stage,4)].zone&&state.travelMode==='foot';
}
D.Expeditions={version:1,defaults(state){if(state&&!own(state,'expeditions'))state.expeditions=blank();return state?.expeditions;},valid,
  riskOf,rawReward,rewardPreview,checkpointPhase};

// Only these authored encounters read expedition modifiers. Templates and all
// ordinary/trial RNG paths are left intact.
const ordinaryEnemies=D.encounterEnemies;
D.expeditionEnemies=function(value,level,run=null){
  const enc=typeof value==='string'?C.encounters[value]:value;
  if(!enc?.expeditionRoute)throw new Error('Choose an expedition encounter.');
  const route=C.expeditions[enc.expeditionRoute],s=route.stages[enc.expeditionStage];
  const tier=run?.tier||0,risk=run?riskOf(run):0;
  const enemies=ordinaryEnemies(enc,run?.level||level);
  for(const e of enemies){
    e.maxHp=Math.round(e.maxHp*s.scale*(1+.2*tier+.1*risk));
    e.atk=Math.round(e.atk*(1+.08*tier+.045*risk));e.mag=Math.round(e.mag*(1+.08*tier+.045*risk));
    e.def=Math.round(e.def+tier*1.5);e.atb=route.ruleId==='stormfront'?90:Math.max(60,e.atb||0);
    if(route.ruleId==='borrowed_masks')e.status={...e.status,guard:4};
    if(route.ruleId==='living_cargo')e.status={...e.status,regen:6};
    if(route.ruleId==='tidal_window')for(const p of [e,...(e.phases||[])])for(const a of p.pattern||[])if(a.charge)a.telegraph=(a.telegraph||2)+.6;
  }
  return enemies;
};
D.encounterEnemies=function(value,level){
  const enc=typeof value==='string'?C.encounters[value]:value;
  if(!enc?.expeditionRoute)return ordinaryEnemies(value,level);
  const r=D.app?.state?.expeditions?.run;
  return D.expeditionEnemies(enc,level,r?.route===enc.expeditionRoute&&r.stage===enc.expeditionStage?r:null);
};

function configureBattle(app){
  const b=app.battle,run=app.state?.expeditions?.run,enc=C.encounters[app.encounterId];
  if(!b||!run||b.expedition||enc?.expeditionRoute!==run.route||enc.expeditionStage!==run.stage)return;
  const route=C.expeditions[run.route],has=id=>run.boons.includes(id);
  b.expedition={run:run.id,route:run.route,stage:run.stage};
  if(route.ruleId==='living_cargo')for(const u of b.enemies)u.statusPower.regen=3;
  if(has('thrift_knot'))for(const [id,s]of Object.entries(b.skills)){
    const q={...s};if(q.cost>0)q.cost=Math.max(1,Math.floor(q.cost*.8));
    if(q.costs)q.costs=Object.fromEntries(Object.entries(q.costs).map(([id,n])=>[id,n>0?Math.max(1,Math.floor(n*.8)):0]));
    b.skills[id]=q;
  }
  const damage=b.damage,heal=b.heal,pressure=b.addStagger,apply=b.applySkill,status=b.applyStatus,defend=b.defend;
  b.damage=function(actor,target,n,details={}){
    const partyHit=actor?.team==='party'&&target.team==='enemy';
    if(partyHit&&route.ruleId==='tidal_window'&&target.intent?.stage==='casting')n*=1.2;
    const amount=damage.call(this,actor,target,n,details);
    if(partyHit&&amount&&details.weak&&route.ruleId==='unspent_toll')this.bond=Math.min(100,this.bond+4);
    return amount;
  };
  b.heal=function(actor,target,n,id){return heal.call(this,actor,target,n*(target.team==='party'&&route.ruleId==='living_cargo'?1.2:1),id);};
  b.addStagger=function(actor,target,n,details){
    const before=target.breakRemaining,result=pressure.call(this,actor,target,n*(has('fracture_lens')?1.4:1),details);
    if(!before&&target.breakRemaining>0&&route.ruleId==='borrowed_masks')this.dispel(target,actor);
    return result;
  };
  b.applyStatus=function(actor,target,s){
    if(has('clear_air')&&target.team==='party')s=Object.fromEntries(Object.entries(s).filter(([id])=>!['poison','burn','slow'].includes(id)));
    return status.call(this,actor,target,s);
  };
  b.applySkill=function(actor,s,targets,members=[actor]){
    const result=apply.call(this,actor,s,targets,members);
    if(actor.team==='party'&&members.length>1&&route.ruleId==='common_cause')for(const u of this.party)if(u.hp>0)this.applyStatus(actor,u,{guard:2.5});
    return result;
  };
  b.defend=function(id){const result=defend.call(this,id);if(result.ok&&route.ruleId==='stormfront'){const u=this.unit(id);u.mp=Math.min(u.maxMp,u.mp+4);}return result;};
  if(route.ruleId==='unspent_toll')b.bond=Math.max(0,b.bond-25);
  if(has('shared_spark'))b.bond=Math.min(100,b.bond+25);
  if(has('unbroken_oath'))for(const u of b.party)if(u.hp>0)b.applyStatus(u,u,{guard:6});
  b.record(route.rule);app.ui.dirty=true;
}

D.extendExpeditions=App=>{
  const P=App.prototype;if(P.expeditionActive)return;
  const base=Object.fromEntries(['stats','startBattle','battleDone','travel','loadWorld','interact','heal','swap','equip','save','update','knownSkills','flee',
    'fieldAbility','solveMechanism','changeMechanism','resetMechanism','startTrial','buyMaterial','canCraft','finish','setTravelMode','useFieldItem'].map(k=>[k,P[k]]));
  const current=a=>a.state?.expeditions?.run||null;
  const pending=a=>a.expeditionLaunch?.ref===current(a)?a.expeditionLaunch:null;
  const locked=a=>{if(!current(a))return false;a.toast('Bank the expedition or abandon it before you leave the route.',4);return true;};
  P.expeditionActive=function(){return!!current(this);};
  P.expeditionCheckpoint=function(){return!current(this)||(!this.battle&&!pending(this));};
  P.expeditionRewardPreview=function(){return rewardPreview(this.state);};
  P.expeditionStatus=function(id,tier=0){
    const route=C.expeditions[id],rec=this.state?.expeditions?.records?.[id],maxTier=Math.min(6,(rec?.bestTier??-1)+1);
    const no=reason=>({ok:false,reason,route,maxTier});
    if(!route||!this.state)return no('Choose a route from the expedition ledger.');
    if(current(this))return no('Bank or abandon the active expedition first.');
    if(this.battle||this.talk.open||this.eventQueue.length||this.mode!=='field')return no('Finish the current scene before you set out.');
    if(this.state.chapter<route.chapter)return no('This route opens in Chapter '+route.chapter+'.');
    if(this.stats(this.state.active[0]).level<route.minLevel)return no('Reach party level '+route.minLevel+' before this route.');
    if(this.state.active.length!==3)return no('Choose three active travelers before you set out.');
    if(!int(tier,0,maxTier))return no('Clear the previous challenge tier to open this one.');
    return{ok:true,route,maxTier,tier};
  };
  P.stats=function(id){
    const s=base.stats.call(this,id),r=current(this);if(!s||!r||!r.party.includes(id))return s;
    const has=k=>r.boons.includes(k);
    if(has('trail_vigor'))s.maxHp=Math.round(s.maxHp*1.24);
    if(has('deep_flask'))s.maxMp+=16;if(has('keen_edge'))s.atk=Math.round(s.atk*1.18);
    if(has('bright_ink'))s.mag=Math.round(s.mag*1.18);if(has('light_feet'))s.speed+=3;
    s.hp=clamp(this.state.roster[id].hp,0,s.maxHp);s.mp=clamp(this.state.roster[id].mp,0,s.maxMp);return s;
  };
  // Temporary backdrops do not mark new story places as visited or trigger the
  // unrelated exits/entities. All thirty backgrounds have no onEnter effects.
  P.placeExpedition=function(){
    const r=current(this);if(!r)return false;const stage=C.expeditions[r.route].stages[Math.min(r.stage,4)],visited=[...this.state.visited];
    this.ui.close();this.talk.close();this.state.travelMode='foot';this.state.x=0;this.state.y=0;
    base.loadWorld.call(this,stage.zone,15,12);this.state.visited=visited;this.walkTarget=null;return true;
  };
  P.startExpedition=function(id,tier=0){
    const q=this.expeditionStatus(id,tier);if(!q.ok){this.toast(q.reason,4);return false;}
    const x=D.Expeditions.defaults(this.state),party=[...this.state.active];
    const origin={zone:this.state.zone,x:this.hero.x,y:this.hero.y,travelMode:this.state.travelMode,worldReturn:clone(this.state.worldReturn),
      health:Object.fromEntries(party.map(id=>[id,{hp:this.state.roster[id].hp,mp:this.state.roster[id].mp}]))};
    const rec=x.records[id]||freshRecord();rec.runs++;x.records[id]=rec;
    x.run={id:++x.serial,route:id,stage:0,phase:'boon',tier,level:this.stats(party[0]).level,party,boons:[],decisions:[],origin,turns:0,seconds:0};
    x.last=null;this.expeditionLaunch=null;this.state.bond=0;
    for(const hero of party){const s=this.stats(hero);this.state.roster[hero].hp=s.maxHp;this.state.roster[hero].mp=s.maxMp;}
    this.placeExpedition();this.save('auto',true);this.ui.open('expedition');return true;
  };
  P.chooseExpeditionBoon=function(id){
    const r=current(this);if(!r||!this.expeditionCheckpoint()||r.phase!=='boon'||!own(C.expeditionBoons,id)||r.boons.includes(id))return false;
    const before=Object.fromEntries(r.party.map(id=>[id,this.stats(id)]));r.boons.push(id);r.phase=checkpointPhase(r);
    for(const hero of r.party){const s=this.stats(hero),h=this.state.roster[hero];h.hp=Math.min(s.maxHp,h.hp+Math.max(0,s.maxHp-before[hero].maxHp));h.mp=Math.min(s.maxMp,h.mp+Math.max(0,s.maxMp-before[hero].maxMp));}
    this.save('auto',true);this.ui.open('expedition');return true;
  };
  P.chooseExpeditionRisk=function(choice){
    const r=current(this);if(!r||!this.expeditionCheckpoint()||r.phase!=='choice'||!['steady','press','recover'].includes(choice))return false;
    r.decisions.push(choice);r.phase=checkpointPhase(r);
    if(choice==='recover')for(const id of r.party){const h=this.state.roster[id],s=this.stats(id);h.hp=Math.min(s.maxHp,h.hp+Math.ceil(s.maxHp*.15));h.mp=Math.min(s.maxMp,h.mp+Math.ceil(s.maxMp*.12));}
    this.save('auto',true);this.ui.open('expedition');return true;
  };
  P.continueExpedition=function(){
    const r=current(this);if(!r||!this.expeditionCheckpoint()||r.phase!=='ready'||r.stage>=5)return false;
    const id=C.expeditions[r.route].stages[r.stage].encounter;
    this.save('auto',true);this.expeditionLaunch={ref:r,encounter:id};this.ui.close();
    const ok=this.startBattle(id);if(!ok){this.expeditionLaunch=null;this.ui.open('expedition');}return ok;
  };
  P.resumeExpedition=function(){if(!current(this)||!this.expeditionCheckpoint())return false;this.ui.open('expedition');return true;};
  P.startBattle=function(id){
    const enc=C.encounters[id],r=current(this);
    if(enc?.expeditionRoute&&(!r||pending(this)?.encounter!==id))return false;
    if(r&&(!enc?.expeditionRoute||pending(this)?.encounter!==id))return false;
    const ok=base.startBattle.call(this,id);configureBattle(this);return ok;
  };
  P.save=function(slot='auto',quiet=false){
    if(current(this)&&!this.expeditionCheckpoint()){if(!quiet)this.toast('The checkpoint before this stage is saved. Finish the fight to save again.',4);return false;}
    return base.save.call(this,slot,quiet);
  };
  P.finishExpedition=function(outcome){
    const r=current(this);if(!r)return false;
    const complete=outcome==='cleared',paid=complete||outcome==='banked';
    if(!['cleared','banked','abandoned','defeat'].includes(outcome)||complete&&r.stage!==5||paid&&(!this.expeditionCheckpoint()||r.stage<1))return false;
    const preview=paid?rewardPreview(this.state):{gold:0,xp:0,items:{},first:null};
    const x=this.state.expeditions,rec=x.records[r.route],origin=clone(r.origin);
    const reward={gold:Math.min(preview.gold,1e9-this.state.gold),xp:Math.min(preview.xp,1e8-this.state.xp),items:{}};
    for(const [id,n]of Object.entries(preview.items))if(n>0)reward.items[id]=Math.min(n,1e6-(this.state.inventory[id]||0));
    // Remove the claimable run before any reward mutation or autosave. Repeated
    // callbacks can only open the immutable last-result receipt.
    x.run=null;this.expeditionLaunch=null;this.battle=null;this.encounterId=null;this.anim={};this.eventQueue=[];this.talk.close();this.ui.close();
    if(paid){rec.banks++;this.state.gold+=reward.gold;this.state.xp+=reward.xp;for(const [id,n]of Object.entries(reward.items))this.give(id,n);}
    if(complete){rec.clears++;rec.bestTier=Math.max(rec.bestTier,r.tier);rec.bestTurns=Math.min(rec.bestTurns??Infinity,r.turns);rec.bestSeconds=Math.min(rec.bestSeconds??Infinity,r.seconds);this.state.flags[C.expeditions[r.route].completeFlag]=true;}
    rec.furthest=Math.max(rec.furthest,r.stage);
    x.last={id:r.id,route:r.route,outcome,stage:r.stage,tier:r.tier,risk:riskOf(r),first:!!preview.first,reward};
    for(const id of r.party){const h=this.state.roster[id],s=this.stats(id);
      // Leaving before winning anything cannot turn the entry heal into a free
      // shrine. Spent supplies remain spent; later stages preserve actual HP/MP.
      if(!r.stage){h.hp=Math.min(h.hp,origin.health[id].hp);h.mp=Math.min(h.mp,origin.health[id].mp);}
      h.hp=clamp(h.hp,1,s.maxHp);h.mp=clamp(h.mp,0,s.maxMp);
    }
    this.state.travelMode=origin.travelMode;this.state.worldReturn=origin.worldReturn;
    this.state.x=origin.x;this.state.y=origin.y;this.loadWorld(origin.zone,origin.x/16-.5,origin.y/16-.5);
    this.game.cam.bounds=v=>this.world.map.bounds(v);this.game.cam.offset=[0,this.world.isOverworld?-14:-24];
    this.game.focus(this.hero.x,this.hero.y,this.world.isOverworld?0:12);this.save('auto',true);this.ui.open('expedition',{result:true});return true;
  };
  P.bankExpedition=function(){const r=current(this);if(!r||!this.expeditionCheckpoint()||r.stage<1)return false;return this.finishExpedition(r.stage===5?'cleared':'banked');};
  P.abandonExpedition=function(){
    if(!current(this))return false;
    if(this.battle){this.battle.result='fled';this.resultTimer=1;return true;}
    return this.finishExpedition('abandoned');
  };
  P.flee=function(){if(current(this)){this.abandonExpedition();return{ok:true,reason:''};}return base.flee.call(this);};
  P.battleDone=function(){
    const b=this.battle,r=current(this),enc=C.encounters[this.encounterId];
    if(!r||!b||enc?.expeditionRoute!==r.route)return base.battleDone.call(this);
    if(!b.result||enc.expeditionStage!==r.stage)return;
    this.state.bond=b.bond;for(const u of b.party){this.state.roster[u.id].hp=Math.max(1,u.hp);this.state.roster[u.id].mp=u.mp;}
    r.turns+=b.turn;r.seconds=Math.round((r.seconds+b.time)*1000)/1000;
    this.battle=null;this.encounterId=null;this.expeditionLaunch=null;this.anim={};
    if(b.result!=='victory'){this.finishExpedition(b.result==='defeat'?'defeat':'abandoned');return;}
    this.state.battles++;this.state.cleared[enc.id]=true;this.noteVictory?.(enc,b);
    for(const id of r.party){const h=this.state.roster[id],s=this.stats(id);
      if(r.boons.includes('camp_broth'))h.hp=Math.min(s.maxHp,h.hp+Math.ceil(s.maxHp*.12));
      if(r.boons.includes('dew_collector'))h.mp=Math.min(s.maxMp,h.mp+6);
    }
    r.stage++;r.phase=checkpointPhase(r);this.state.expeditions.records[r.route].furthest=Math.max(this.state.expeditions.records[r.route].furthest,r.stage);
    this.placeExpedition();this.save('auto',true);this.ui.open('expedition');
  };
  P.update=function(dt){
    configureBattle(this);
    if(current(this)&&this.expeditionCheckpoint()&&!this.panel&&!this.talk.open&&!this.eventQueue.length&&this.mode==='field')this.ui.open('expedition');
    return base.update.call(this,dt);
  };
  for(const method of ['travel','interact','heal','swap','equip','fieldAbility','solveMechanism','changeMechanism','resetMechanism','startTrial','buyMaterial','finish','setTravelMode'])if(base[method])P[method]=function(...args){if(locked(this))return false;return base[method].apply(this,args);};
  P.canCraft=function(id){if(current(this))return{ok:false,reason:'Bank the expedition before you craft.'};return base.canCraft.call(this,id);};
  P.useFieldItem=function(id,target){if(current(this)&&(!this.expeditionCheckpoint()||!current(this).party.includes(target)))return false;return base.useFieldItem.call(this,id,target);};
};

if(C.refreshCounts){const refresh=C.refreshCounts;C.refreshCounts=function(){const n=refresh();n.expeditions=6;n.expeditionStages=30;n.expeditionBoons=12;n.expeditionEnemies=11;return n;};C.refreshCounts();}
})();
