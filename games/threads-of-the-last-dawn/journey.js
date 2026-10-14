/* The Far Shore: persistent exploration, crafting, field work, and journey records. */
(() => {
'use strict';
const D=globalThis.Dawn,C=D.Content,E=globalThis.My3D2dge;
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const ABILITIES={
  cut:{hero:'mira',name:'Cut the thread',description:'Mira cuts ropes, roots, and loose threads of time.'},
  resonate:{hero:'soren',name:'Sound the echo',description:'Soren gives a lost sound a clear note to follow.'},
  brace:{hero:'brann',name:'Brace and lift',description:'Brann moves heavy parts and holds damaged structures.'},
  grow:{hero:'ilex',name:'Wake the roots',description:'Ilex joins living roots into paths and supports.'},
  reveal:{hero:'nyx',name:'Read the hidden',description:'Nyx reveals the memory beneath a false surface.'},
  power:{hero:'vale',name:'Restore power',description:'Vale repairs a circuit and gives it a safe current.'}
};
const materials=[
 ['memory_ore','Memory Ore','Metal that remembers the shape of a repaired vessel.',80,null],
 ['living_fiber','Living Fibre','A strong fibre that grows around damaged wood.',90,'depth_roots_complete'],
 ['prism_dust','Prism Dust','Clean fragments left when a false image breaks.',100,'depth_mirrors_complete'],
 ['storm_coil','Storm Coil','A small conductor that holds a stable charge.',110,'depth_storm_complete'],
 ['echo_glass','Echo Glass','Glass formed where two possible shores meet.',140,'far_shore_complete']
];
for(const [id,name,description,price,flag]of materials)C.items[id]={id,name,description,kind:'material',price};
C.materialSources=materials.map(([id,, ,price,flag])=>({id,price,requires:flag?{flags:[flag]}:{chapterAtLeast:2}}));
const gear=[
 ['shore_mira','Sounding Edge','weapon','mira',{atk:21,speed:2},'A balanced blade made from the rescued sounding line.'],
 ['shore_soren','Harbour Song','weapon','soren',{mag:23,maxMp:18},'A bell that keeps its clear note in a storm.'],
 ['shore_brann','Keel Keeper','weapon','brann',{atk:25,def:6},'A heavy hammer with a living fibre grip.'],
 ['shore_ilex','Spiral Bough','weapon','ilex',{mag:23,maxHp:55},'A branch grown with space for a hand to rest.'],
 ['shore_nyx','True Reflection','weapon','nyx',{atk:11,mag:24,speed:2},'A ribbon that reflects the person who holds it.'],
 ['shore_vale','Storm Lantern','weapon','vale',{atk:24,mag:11,speed:2},'A compact launcher with a safe return circuit.'],
 ['shore_lifecoat','Lifeline Coat','armor',null,{def:17,maxHp:65},'Layered cloth and old rescue lines spread the force of a blow.'],
 ['shore_mirrorcoat','Mirror Mantle','armor',null,{def:14,mag:10,maxMp:20},'Soft glass threads carry light without hiding the wearer.'],
 ['shore_stormplate','Stormguard Plate','armor',null,{def:23,maxHp:90,speed:-1},'A strong plate with a grounded outer rim.'],
 ['shore_anchor','Anchor Knot','accessory',null,{def:8,maxHp:100},'A rescue knot that opens when its wearer needs to move.'],
 ['shore_focus','Clear Focus','accessory',null,{mag:13,maxMp:25},'A small lens made from a truth freely given.'],
 ['shore_compass','Far Shore Compass','accessory',null,{atk:11,mag:11,speed:4},'Its needle finds a route without deciding where you must go.']
];
for(const [id,name,slot,hero,stats,description]of gear)C.items[id]={id,name,kind:slot,slot,...(hero?{hero}:{}),stats,description,price:700};
const recipe=(id,item,cost,ingredients,flag=null,count=1)=>({id,name:C.items[item].name,item,count,cost,ingredients,requires:flag?{flags:[flag]}:{chapterAtLeast:2}});
C.recipes=[
 recipe('forge_mira','shore_mira',260,{memory_ore:4,living_fiber:1},'depth_tide_complete'),
 recipe('forge_soren','shore_soren',260,{memory_ore:3,prism_dust:2},'depth_tide_complete'),
 recipe('forge_brann','shore_brann',300,{memory_ore:3,living_fiber:3},'depth_roots_complete'),
 recipe('forge_ilex','shore_ilex',300,{living_fiber:4,prism_dust:1},'depth_roots_complete'),
 recipe('forge_nyx','shore_nyx',340,{prism_dust:4,memory_ore:2},'depth_mirrors_complete'),
 recipe('forge_vale','shore_vale',340,{storm_coil:4,memory_ore:2},'depth_storm_complete'),
 recipe('weave_lifecoat','shore_lifecoat',180,{living_fiber:2,memory_ore:2}),
 recipe('weave_mirrorcoat','shore_mirrorcoat',240,{prism_dust:3,living_fiber:2},'depth_mirrors_complete'),
 recipe('forge_stormplate','shore_stormplate',320,{storm_coil:3,memory_ore:3},'depth_storm_complete'),
 recipe('tie_anchor','shore_anchor',190,{living_fiber:3,memory_ore:1},'depth_roots_complete'),
 recipe('polish_focus','shore_focus',260,{prism_dust:3,echo_glass:1},'depth_mirrors_complete'),
 recipe('make_compass','shore_compass',400,{echo_glass:4,storm_coil:2,prism_dust:2},'far_shore_complete'),
 recipe('brew_tonics','tonic',25,{living_fiber:1},null,3),
 recipe('brew_ether','ether',35,{prism_dust:1},null,2),
 recipe('make_phoenix','phoenix',65,{living_fiber:1,storm_coil:1},'depth_storm_complete')
];
const entities=()=>C.zones.flatMap(z=>(z.entities||[]).map(e=>({...e,zone:z.id})));
const mechanism=id=>entities().find(e=>e.id===id&&e.type==='mechanism');
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const Puzzle={
 initial(spec){
   if(spec.kind==='circuit'){
     const size=spec.size||3,out=spec.initial?[...spec.initial]:[...(spec.goal||new Array(size*size).fill(0))];
     if(!spec.initial)for(const i of spec.scramble||[0,4,8])this.change(spec,out,i);
     return out;
   }
   return [...(spec.initial||(spec.kind==='sluice'?[0,0,0]:[0,0,0,0]))];
 },
 change(spec,values,index,delta=1){
   if(!Number.isInteger(index)||index<0||index>=values.length)return false;
   if(spec.kind==='circuit'){
     const size=spec.size||3,x=index%size,y=Math.floor(index/size);
     for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size){const n=(y+dy)*size+x+dx;values[n]=values[n]?0:1;}
   }else if(spec.kind==='mirror')values[index]=(values[index]+1)%4;
   else if(spec.kind==='sluice'){
     if(![-1,1].includes(delta))return false;
     const next=values[index]+delta,total=values.reduce((s,n)=>s+n,0)+delta;
     if(next<0||next>(spec.capacity||6)||total>(spec.total||6))return false;values[index]=next;
   }else return false;
   return true;
 },
 solved(spec,values){return same(values,spec.kind==='circuit'?(spec.goal||new Array((spec.size||3)**2).fill(0)):spec.target||[]);},
 valid(spec,values){
   if(!Array.isArray(values)||values.length!==this.initial(spec).length)return false;
   const max=spec.kind==='circuit'?1:spec.kind==='mirror'?3:spec.capacity||6;
   return values.every(n=>Number.isInteger(n)&&n>=0&&n<=max)&&(spec.kind!=='sluice'||values.reduce((s,n)=>s+n,0)<=(spec.total||6));
 }
};
D.Journey={abilities:ABILITIES,Puzzle,mechanism};
D.extendJourney=App=>{
 const P=App.prototype,base={fresh:P.fresh,load:P.load,validateSave:P.validateSave,stats:P.stats,interact:P.interact};
 P.journeyDefaults=function(){this.state.version=3;for(const k of ['puzzles','crafts','bestiary','trials'])this.state[k]||={};};
 P.fresh=function(plus=false,difficulty='standard'){
   const prior=(this.state?.ending||this.state?.flags.engine_stopped)?this.state:E.store.get('threads-last-dawn-v1-completed',null);
   const s=base.fresh.call(this,plus,difficulty);this.journeyDefaults();
   if(plus&&prior)for(const m of C.masteries||[])if(prior.flags[m.flag])s.flags[m.flag]=true;
   return s;
 };
 P.validateSave=function(value){
   if(!record(value)||![1,2,3].includes(value.version))return false;
   const legacy=value.version===3?{...value,version:2}:value;if(!base.validateSave.call(this,legacy))return false;
   if(value.version!==3)return true;
   if(!['puzzles','crafts','bestiary','trials'].every(k=>record(value[k])))return false;
   if(!Object.entries(value.puzzles).every(([id,v])=>{const e=mechanism(id);return e&&Puzzle.valid(e.puzzle,v);} ))return false;
   if(!Object.entries(value.crafts).every(([id,n])=>C.recipes.some(r=>r.id===id)&&Number.isInteger(n)&&n>=0&&n<=1e6))return false;
   if(!Object.entries(value.bestiary).every(([id,v])=>own(C.enemies,id)&&record(v)&&['seen','defeated'].every(k=>Number.isInteger(v[k])&&v[k]>=0&&v[k]<=1e7)))return false;
   return Object.entries(value.trials).every(([id,v])=>(C.eliteTrials||[]).some(t=>t.id===id)&&record(v)&&Number.isInteger(v.wins)&&v.wins>=1&&v.wins<=1e7&&Number.isInteger(v.bestTurns)&&v.bestTurns>=0&&v.bestTurns<=1e7&&Number.isFinite(v.bestSeconds)&&v.bestSeconds>=0&&v.bestSeconds<=1e7);
 };
 P.load=function(value){
   const raw=typeof value==='string'?this.readSave(value):value;if(!this.validateSave(raw)){this.toast('This save is not valid for this game.',4);return false;}
   const legacy=raw.version<3,clean=clone(raw);if(legacy)for(const k of ['puzzles','crafts','bestiary','trials'])delete clean[k];
   const ok=base.load.call(this,clean);if(ok){this.journeyDefaults();if(legacy)for(const [id,done]of Object.entries(this.state.cleared)){const enc=C.encounters[id];if(!done||!enc)continue;for(const enemy of enc.enemies){const v=this.state.bestiary[enemy]||={seen:0,defeated:0};v.seen++;v.defeated++;}}this.save('auto',true);}return ok;
 };
 P.stats=function(id){const s=base.stats.call(this,id);if(s)for(const m of C.masteries||[])if(m.hero===id&&this.state.flags[m.flag]&&!s.skills.includes(m.skill))s.skills.push(m.skill);return s;};
 P.knownSkills=function(){return Object.fromEntries(Object.entries(C.skills).filter(([id,s])=>(!s.unlockFlag||this.state.flags[s.unlockFlag])&&(!s.unlockFlags||s.unlockFlags.every(f=>this.state.flags[f]))));};
 P.dungeon=function(zone=this.world?.zone){return (C.dungeons||[]).find(d=>d.id===zone?.dungeonId)||null;};
 P.routeExitTo=function(id){
   if(!id||id===this.state.zone)return null;const queue=[[this.state.zone,null]],seen=new Set();
   for(let i=0;i<queue.length;i++){const [at,first]=queue[i];if(at===id)return this.world.interactables(this).find(e=>e.id===first)||null;if(seen.has(at))continue;seen.add(at);
     const z=C.zoneById[at];for(const e of [...(z?.exits||[]),...(z?.entities||[]).filter(e=>['exit','gate'].includes(e.type))])if(e.to&&this.meets(e.requires)&&!(e.hideIf&&this.meets(e.hideIf)))queue.push([e.to,first||e.id]);
   }return null;
 };
 P.canCraft=function(id){
   const r=C.recipes.find(r=>r.id===id);if(!this.state||!r||this.battle)return{ok:false,reason:'Return to the journey before you craft.'};
   if(!this.meets(r.requires))return{ok:false,reason:'Complete the listed story step to learn this recipe.'};
   if(this.state.gold<r.cost)return{ok:false,reason:'You need more crowns.'};
   for(const [item,n]of Object.entries(r.ingredients))if((this.state.inventory[item]||0)<n)return{ok:false,reason:'You need more '+C.items[item].name+'.'};
   return{ok:true,recipe:r};
 };
 P.craft=function(id){const check=this.canCraft(id);if(!check.ok){this.toast(check.reason,3);return false;}const r=check.recipe;for(const [item,n]of Object.entries(r.ingredients))this.state.inventory[item]-=n;this.state.gold-=r.cost;this.give(r.item,r.count);this.state.crafts[id]=(this.state.crafts[id]||0)+1;this.game.audio.sfx('pickup');this.toast('Made '+r.count+' × '+C.items[r.item].name,4);this.save('auto',true);this.ui.dirty=true;return true;};
 P.buyMaterial=function(id){const m=C.materialSources.find(m=>m.id===id);if(!this.state||this.battle||!m||!this.meets(m.requires)||this.state.gold<m.price)return false;this.state.gold-=m.price;this.give(id);this.save('auto',true);this.toast(C.items[id].name+' added to the bag.',3);this.ui.dirty=true;return true;};
 P.fieldAbility=function(entity){
   const e=this.world?.interactables(this).find(e=>e.id===(typeof entity==='string'?entity:entity?.id)),ability=ABILITIES[e?.ability];
   if(!e||e.type!=='field'||!ability||this.battle||!this.meets(e.requires)||e.hideIf&&this.meets(e.hideIf))return false;
   if(this.state.flags[e.flag]){this.say(e.repeatLines||['The work is complete. The way remains open.'],{name:e.name});return true;}
   if(!this.state.roster[ability.hero]){this.say(e.recruitHint||('Find '+C.heroes[ability.hero].name+' on the main story route, then return.'),{name:e.name});return false;}
   this.ui.close();this.say(e.lines||[ability.description],{name:C.heroes[ability.hero].name,hero:ability.hero,onDone:()=>{if(this.state.flags[e.flag])return;this.apply([{type:'flag',id:e.flag},...(e.effects||[])]);this.game.particles.glints(this.hero.x,this.hero.y,20,16,'#b1dac3');}});return true;
 };
 P.mechanismValues=function(entity){const e=typeof entity==='string'?mechanism(entity):entity;if(!e?.puzzle)return null;this.state.puzzles[e.id]||=Puzzle.initial(e.puzzle);return this.state.puzzles[e.id];};
 P.changeMechanism=function(id,index,delta=1){
   const e=this.world?.interactables(this).find(e=>e.id===id);if(!e||e.type!=='mechanism'||this.battle||!this.meets(e.requires)||this.state.flags[e.flag])return false;
   const values=this.mechanismValues(e);if(!Puzzle.change(e.puzzle,values,index,delta))return false;this.save('auto',true);this.ui.dirty=true;return true;
 };
 P.resetMechanism=function(id){const e=mechanism(id);if(!e||e.zone!==this.state.zone||this.battle||this.state.flags[e.flag]||!this.meets(e.requires))return false;this.state.puzzles[id]=Puzzle.initial(e.puzzle);this.save('auto',true);return true;};
 P.solveMechanism=function(id){
   const e=this.world?.interactables(this).find(e=>e.id===id);if(!e||e.type!=='mechanism'||this.battle||!this.meets(e.requires)||this.state.flags[e.flag])return false;
   if(!Puzzle.solved(e.puzzle,this.mechanismValues(e))){this.toast('The parts do not agree yet. Check the clue and try again.',4);return false;}
   this.ui.close();this.apply([{type:'flag',id:e.flag},...(e.effects||[])]);this.game.audio.sfx('warp');this.say(e.solvedLines||['The mechanism settles. A route through the room opens.'],{name:e.name});return true;
 };
 P.trialStatus=function(id){const t=(C.eliteTrials||[]).find(t=>t.id===id);if(!t||!this.state)return{ok:false,reason:'This trial is not available.'};if(!this.meets(t.requires))return{ok:false,reason:'Advance the main story to open this trial.'};const m=(C.masteries||[]).find(m=>m.flag===t.completeFlag||C.encounters[t.encounter]?.effects?.some(e=>e.id===m.flag));if(m&&!this.state.roster[m.hero])return{ok:false,reason:'Recruit '+C.heroes[m.hero].name+' first.'};if(this.stats(this.state.active[0]).level<t.minLevel)return{ok:false,reason:'Reach level '+t.minLevel+' first.'};return{ok:!this.battle,trial:t};};
 P.startTrial=function(id){const result=this.trialStatus(id);if(!result.ok){this.toast(result.reason||'Finish the current battle.',4);return false;}this.ui.close();this.heal();this.state.bond=0;return this.startBattle(result.trial.encounter);};
 P.noteEnemies=function(enc){this.journeyDefaults();for(const id of new Set(enc.enemies)){const v=this.state.bestiary[id]||={seen:0,defeated:0};v.seen++;}};
 P.noteVictory=function(enc,b){this.journeyDefaults();for(const id of enc.enemies){const v=this.state.bestiary[id]||={seen:1,defeated:0};v.defeated++;}const t=(C.eliteTrials||[]).find(t=>t.encounter===enc.id);if(t){const v=this.state.trials[t.id];this.state.trials[t.id]={wins:(v?.wins||0)+1,bestTurns:Math.min(v?.bestTurns??Infinity,b.turn),bestSeconds:Math.min(v?.bestSeconds??Infinity,b.time)};}};
 P.interact=function(entity=this.nearest){
   if(!entity||this.battle||this.talk.open||this.panel)return false;
   if(!this.meets(entity.requires))return base.interact.call(this,entity);
   if(entity.type==='field')return this.fieldAbility(entity);
   if(entity.type==='mechanism'){
     if(this.state.flags[entity.flag]){this.say(entity.repeatLines||['The mechanism is stable. The route remains open.'],{name:entity.name});return true;}
     this.mechanismValues(entity);this.ui.open('mechanism',entity);return true;
   }
   if(['camp','craft','trials'].includes(entity.type)){if(entity.type==='camp'){this.heal();this.save('auto',true);}this.ui.open(entity.type==='craft'?'craft':entity.type,entity);return true;}
   return base.interact.call(this,entity);
 };
};
C.refreshCounts?.();
})();
