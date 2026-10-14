/* The Hearthbound Roads: town projects, gathering, meals, loadouts, and save v4. */
(() => {
'use strict';
const D=globalThis.Dawn,C=D.Content,clone=v=>JSON.parse(JSON.stringify(v));
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const owns=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const integer=(v,max=1e7)=>Number.isInteger(v)&&v>=0&&v<=max;
const slots=['weapon','armor','accessory'];
const ingredients=[
 ['haven_supplies','Haven Supplies','Timber, cloth, and parts set aside for the people of Wayfarer Haven.'],
 ['ingredient_grain','Road Grain','Hardy grain gathered along old footpaths.'],
 ['ingredient_fruit','Sun Fruit','Sweet fruit from trees that have survived a change of age.'],
 ['ingredient_herb','Green Herbs','Fresh leaves for a warm meal after a long road.']
];
for(const [id,name,description]of ingredients)C.items[id]={id,name,description,kind:'material',price:0};
C.projects=[
 {id:'workshop',hero:'mira',name:'The Open Workshop',description:'Mira makes a place where a broken thing can find a second use.',benefits:['Crafting costs 10% fewer crowns.','Crafting costs 20% fewer crowns.'],finished:'Workbenches fill with repaired watches and tools.'},
 {id:'inn',hero:'soren',name:'The Returning Inn',description:'Soren gives every traveller a place at the table.',benefits:['Every traveller gains 20 maximum HP.','Every traveller gains 40 maximum HP and recovers 10 HP after a victory.'],finished:'Warm windows and a long table welcome the road home.'},
 {id:'garden',hero:'ilex',name:'The Living Garden',description:'Ilex grows food in soil carried here from several ages.',benefits:['Gather one extra ingredient from every patch.','Gather two extra ingredients. Patches regrow after one victory.'],finished:'The garden feeds the town without closing its paths.'},
 {id:'observatory',hero:'brann',name:'The Open Sky',description:'Brann raises a safe platform for watching the changing stars.',benefits:['Every traveller gains 1 speed.','Every traveller gains 2 speed.'],finished:'A steady light guides people through the moving roads.'},
 {id:'archive',hero:'nyx',name:'The Public Archive',description:'Nyx keeps records that their owners can read and change.',benefits:['Every traveller gains 2 magic.','Every traveller gains 4 magic.'],finished:'Names and stories return to the people who lived them.'},
 {id:'dock',hero:'vale',name:'The Common Dock',description:'Vale joins the town to roads and shores that move with the hours.',benefits:['Banked expedition rewards increase by 10%.','Banked expedition rewards increase by 20%.'],finished:'Boats bring new neighbours, supplies, and news.'}
];
C.hearthRuntimeFlags=['hearth_meal_cooked',...C.projects.flatMap(p=>[1,2].map(tier=>'project_'+p.id+'_'+tier))];
const meal=(id,name,cost,ingredients,stats,requires,description)=>({id,name,cost,ingredients,stats,requires,description,duration:3});
C.meals=[
 meal('meal_road','Roadside Supper',10,{ingredient_grain:2,ingredient_herb:1},{maxHp:45,def:3},{chapterAtLeast:2},'A simple, filling meal for a hard road.'),
 meal('meal_orchard','Orchard Bowl',10,{ingredient_fruit:2,ingredient_grain:1},{maxMp:12,mag:4},{chapterAtLeast:2},'Fruit and toasted grain keep the mind clear.'),
 meal('meal_forge','Forge Pot',16,{ingredient_grain:2,ingredient_herb:2},{atk:6,def:4},{flags:['project_workshop_1']},'A thick stew shared at the end of a long shift.'),
 meal('meal_tide','Tide Broth',16,{ingredient_herb:2,ingredient_fruit:1},{speed:2,maxMp:10},{flags:['project_dock_1']},'A light broth for a quick start on the water.'),
 meal('meal_roots','Rootkeeper Soup',18,{ingredient_grain:1,ingredient_herb:3},{maxHp:70,def:2},{flags:['project_garden_1']},'A warm bowl made from the first garden harvest.'),
 meal('meal_stars','Starlight Tea',18,{ingredient_fruit:3,ingredient_herb:1},{mag:7,maxMp:8},{flags:['project_archive_1']},'A fragrant tea served when the reading lamps come on.'),
 meal('meal_keeper','Keeper Bread',20,{ingredient_grain:4,ingredient_fruit:1},{atk:7,maxHp:35},{flags:['project_inn_1']},'Bread with a crisp crust and a sweet centre.'),
 meal('meal_feast','Hearth Feast',28,{ingredient_grain:2,ingredient_fruit:2,ingredient_herb:2},{maxHp:50,maxMp:12,atk:4,mag:4},{flags:['hearthbound_complete']},'A meal that leaves room for the next arrival.')
];
for(const m of C.meals)C.items[m.id]={id:m.id,name:m.name,description:m.description+' Party bonus for three victories.',kind:'meal',price:0};
const forage=id=>C.zones.flatMap(z=>(z.entities||[]).filter(e=>e.type==='forage').map(e=>({...e,zone:z.id}))).find(e=>e.id===id);
const blank=()=>({harvests:{},cooked:{},meal:null,loadouts:[null,null,null]});
function validLoadout(v,state){
 if(v===null)return true;
 if(!record(v)||!Array.isArray(v.active)||v.active.length<1||v.active.length>3||new Set(v.active).size!==v.active.length||!v.active.every(id=>owns(state.roster,id))||!record(v.equipment))return false;
 return v.active.every(id=>owns(v.equipment,id))&&Object.entries(v.equipment).every(([id,e])=>owns(state.roster,id)&&record(e)&&Object.keys(e).length===3&&slots.every(slot=>{const item=e[slot];return item===null||typeof item==='string'&&owns(C.items,item)&&(C.items[item].slot||C.items[item].kind)===slot&&(!C.items[item].hero||C.items[item].hero===id);}));
}
function valid(state){
 const h=state.hearth;if(!record(h)||!record(h.harvests)||!record(h.cooked)||!Array.isArray(h.loadouts)||h.loadouts.length!==3)return false;
 if(!Object.entries(h.harvests).every(([id,n])=>forage(id)&&integer(n)&&n<=state.battles))return false;
 if(!Object.entries(h.cooked).every(([id,n])=>C.meals.some(m=>m.id===id)&&integer(n,1e6)))return false;
 if(h.meal!==null&&(!record(h.meal)||!C.meals.some(m=>m.id===h.meal.id)||!Number.isInteger(h.meal.remaining)||h.meal.remaining<1||h.meal.remaining>3))return false;
 if(!h.loadouts.every(v=>validLoadout(v,state)))return false;
 return C.projects.every(p=>!state.flags['project_'+p.id+'_2']||state.flags['project_'+p.id+'_1']);
}
D.Hearth={blank,valid,validLoadout,forage};
D.extendHearth=App=>{
 const P=App.prototype,base={journeyDefaults:P.journeyDefaults,validateSave:P.validateSave,load:P.load,stats:P.stats,interact:P.interact,canCraft:P.canCraft,useFieldItem:P.useFieldItem,noteVictory:P.noteVictory};
 P.journeyDefaults=function(){base.journeyDefaults.call(this);this.state.version=4;if(!owns(this.state,'hearth'))this.state.hearth=blank();D.Expeditions?.defaults(this.state);};
 P.validateSave=function(v){
   if(!record(v)||![1,2,3,4].includes(v.version))return false;
   if(v.version<4)return base.validateSave.call(this,v);
   return base.validateSave.call(this,{...v,version:3})&&valid(v)&&(!D.Expeditions||D.Expeditions.valid(v));
 };
 P.load=function(value){
   const raw=typeof value==='string'?this.readSave(value):value;if(!this.validateSave(raw)){this.toast('This save is not valid for this game.',4);return false;}
   const clean=clone(raw);if(clean.version<4){delete clean.hearth;delete clean.expeditions;}
   const ok=base.load.call(this,clean);if(ok){this.journeyDefaults();this.clampHearthHealth();this.save('auto',true);}return ok;
 };
 P.hearthBusy=function(){return !this.state||!!this.battle||!!this.expeditionActive?.();};
 P.projectLevel=function(id){return this.state?.flags['project_'+id+'_2']?2:this.state?.flags['project_'+id+'_1']?1:0;};
 P.projectStatus=function(id){
   const p=C.projects.find(p=>p.id===id);if(!p||!this.state)return{ok:false,reason:'This project is not available.'};
   const level=this.projectLevel(id),next=level+1,cost=next===1?120:220,supplies=next===1?3:5;
   const out={project:p,level,next,cost,supplies,ok:false};
   if(level===2)return{...out,reason:'Both stages are complete.'};
   if(this.hearthBusy())return{...out,reason:'Finish or bank the expedition before you build.'};
   if(this.state.chapter<(next===1?2:4))return{...out,reason:'This stage opens in Chapter '+(next===1?2:4)+'.'};
   if(!this.state.roster[p.hero])return{...out,reason:'Recruit '+C.heroes[p.hero].name+' on the main story route.'};
   if(next===2&&!this.state.flags['hearth_'+p.hero+'_complete'])return{...out,reason:'Finish '+C.heroes[p.hero].name+'’s Hearthbound story first.'};
   if((this.state.inventory.haven_supplies||0)<supplies)return{...out,reason:'You need '+supplies+' Haven Supplies. Find them in Hearthbound missions or expeditions.'};
   if(this.state.gold<cost)return{...out,reason:'You need '+cost+' crowns.'};
   return{...out,ok:true};
 };
 P.buildProject=function(id){
   const q=this.projectStatus(id);if(!q.ok){this.toast(q.reason,4);return false;}
   this.state.inventory.haven_supplies-=q.supplies;this.state.gold-=q.cost;this.state.flags['project_'+id+'_'+q.next]=true;
   this.rebuildWorld();this.clampHearthHealth();this.game.audio.sfx('pickup');this.toast(q.project.name+' · Stage '+q.next+' complete.',4);this.save('auto',true);this.ui.dirty=true;return true;
 };
 P.stats=function(id){
   const s=base.stats.call(this,id);if(!s)return s;
   s.maxHp+=20*this.projectLevel('inn');s.speed+=this.projectLevel('observatory');s.mag+=2*this.projectLevel('archive');
   const meal=C.meals.find(m=>m.id===this.state.hearth?.meal?.id);if(meal)for(const [k,n]of Object.entries(meal.stats))s[k]+=n;
   const raw=this.state.roster[id];s.hp=Math.max(0,Math.min(raw.hp??s.maxHp,s.maxHp));s.mp=Math.max(0,Math.min(raw.mp??s.maxMp,s.maxMp));return s;
 };
 P.clampHearthHealth=function(){for(const [id,h]of Object.entries(this.state.roster)){const s=this.stats(id);h.hp=Math.min(h.hp,s.maxHp);h.mp=Math.min(h.mp,s.maxMp);}};
 P.harvestStatus=function(id){
   const e=forage(id);if(!e||!this.state)return{ready:false,reason:'There is no gathering patch here.'};
   const last=this.state.hearth?.harvests[id],regrow=this.projectLevel('garden')===2?1:(e.regrow||2),remaining=last===undefined?0:Math.max(0,regrow-(this.state.battles-last));
   return{ready:!remaining&&this.meets(e.requires),remaining,count:(e.count||2)+this.projectLevel('garden'),ingredient:e.ingredient,entity:e};
 };
 P.harvest=function(id){
   const e=this.world?.interactables(this).find(e=>e.id===id),q=this.harvestStatus(id);
   if(this.hearthBusy()||e?.type!=='forage'||!q.ready||e.hideIf&&this.meets(e.hideIf)){if(q.remaining)this.toast('This patch regrows after '+q.remaining+' more '+(q.remaining===1?'victory.':'victories.'),4);return false;}
   this.state.hearth.harvests[id]=this.state.battles;this.give(q.ingredient,q.count);this.game.audio.sfx('pickup');this.toast('Gathered '+q.count+' × '+C.items[q.ingredient].name,3);this.save('auto',true);this.ui.dirty=true;return true;
 };
 P.craftCost=function(recipe){return Math.floor(recipe.cost*(1-.1*this.projectLevel('workshop')));};
 P.canCraft=function(id){
   if(!this.projectLevel('workshop'))return this.hearthBusy()?{ok:false,reason:'Return from the expedition before you craft.'}:base.canCraft.call(this,id);
   const original=C.recipes.find(r=>r.id===id);if(!original||this.hearthBusy())return{ok:false,reason:'Return to the journey before you craft.'};
   const r={...original,cost:this.craftCost(original)};if(!this.meets(r.requires))return{ok:false,reason:'Complete the listed story step to learn this recipe.'};
   if(this.state.gold<r.cost)return{ok:false,reason:'You need more crowns.'};
   for(const [item,n]of Object.entries(r.ingredients))if((this.state.inventory[item]||0)<n)return{ok:false,reason:'You need more '+C.items[item].name+'.'};
   return{ok:true,recipe:r};
 };
 P.mealStatus=function(id){
   const m=C.meals.find(m=>m.id===id);if(!m||this.hearthBusy())return{ok:false,reason:'Cook between journeys or at an expedition checkpoint after banking.'};
   if(!this.meets(m.requires))return{ok:false,reason:'Complete the listed town project to learn this meal.'};
   if(this.state.gold<m.cost)return{ok:false,reason:'You need '+m.cost+' crowns.'};
   for(const [item,n]of Object.entries(m.ingredients))if((this.state.inventory[item]||0)<n)return{ok:false,reason:'Gather more '+C.items[item].name+'.'};
   return{ok:true,meal:m};
 };
 P.cookMeal=function(id){
   const q=this.mealStatus(id);if(!q.ok){this.toast(q.reason,4);return false;}const m=q.meal;
   for(const [item,n]of Object.entries(m.ingredients))this.state.inventory[item]-=n;
   this.state.gold-=m.cost;this.give(id);this.state.hearth.cooked[id]=(this.state.hearth.cooked[id]||0)+1;
   if(!this.state.flags.hearth_meal_cooked)this.apply([{type:'flag',id:'hearth_meal_cooked'}]);
   this.game.audio.sfx('pickup');this.toast(m.name+' is ready. Eat it to share its bonus.',4);this.save('auto',true);return true;
 };
 P.eatMeal=function(id){
   const m=C.meals.find(m=>m.id===id);if(!m||this.hearthBusy()||!(this.state.inventory[id]>0))return false;
   const before=Object.fromEntries(Object.keys(this.state.roster).map(hero=>[hero,this.stats(hero)]));
   this.state.inventory[id]--;this.state.hearth.meal={id,remaining:3};
   for(const [hero,h]of Object.entries(this.state.roster)){const after=this.stats(hero);h.hp=Math.min(after.maxHp,h.hp+Math.max(0,after.maxHp-before[hero].maxHp));h.mp=Math.min(after.maxMp,h.mp+Math.max(0,after.maxMp-before[hero].maxMp));}
   this.game.audio.sfx('heal');this.toast('The party shares '+m.name+'. Bonus lasts three victories.',4);this.save('auto',true);this.ui.dirty=true;return true;
 };
 P.useFieldItem=function(id,target){if(C.items[id]?.kind==='meal')return this.eatMeal(id);return base.useFieldItem.call(this,id,target);};
 P.noteVictory=function(enc,b){
   base.noteVictory?.call(this,enc,b);const h=this.state.hearth;
   if(h.meal&&--h.meal.remaining===0){h.meal=null;this.clampHearthHealth();}
   if(this.projectLevel('inn')===2)for(const [id,hero]of Object.entries(this.state.roster))hero.hp=Math.min(this.stats(id).maxHp,hero.hp+10);
 };
 P.saveLoadout=function(index){
   if(this.hearthBusy()||!Number.isInteger(index)||index<0||index>2)return false;
   this.state.hearth.loadouts[index]={active:[...this.state.active],equipment:Object.fromEntries(Object.entries(this.state.roster).map(([id,h])=>[id,clone(h.equipment)]))};
   this.save('auto',true);this.toast('Party loadout '+(index+1)+' saved.',3);return true;
 };
 P.loadoutStatus=function(index){
   const v=this.state?.hearth?.loadouts[index];if(!v)return{ok:false,reason:'Save a party in this slot first.'};
   if(this.hearthBusy())return{ok:false,reason:'Finish or bank the expedition before you change the party.'};
   if(!validLoadout(v,this.state))return{ok:false,reason:'This party loadout is no longer valid.'};
   const inventory=clone(this.state.inventory),equipment=Object.fromEntries(Object.entries(this.state.roster).map(([id,h])=>[id,clone(h.equipment)]));
   for(const [id,desired]of Object.entries(v.equipment)){
     for(const item of Object.values(equipment[id]))if(item)inventory[item]=(inventory[item]||0)+1;
     equipment[id]=clone(desired);
   }
   for(const desired of Object.values(v.equipment))for(const item of Object.values(desired))if(item){if(!(inventory[item]>0))return{ok:false,reason:'Missing '+C.items[item].name+'. No equipment was moved.'};inventory[item]--;}
   return{ok:true,loadout:v,inventory,equipment};
 };
 P.applyLoadout=function(index){
   const q=this.loadoutStatus(index);if(!q.ok){this.toast(q.reason,4);return false;}
   this.state.inventory=q.inventory;for(const [id,equipment]of Object.entries(q.equipment))this.state.roster[id].equipment=equipment;this.state.active=[...q.loadout.active];
   this.clampHearthHealth();this.followers=this.state.active.slice(1).map((id,i)=>({id,x:this.hero.x-i*12,y:this.hero.y+14,z:0,vx:0,vy:0,facing:Math.PI/2}));
   this.save('auto',true);this.ui.dirty=true;this.toast('Party loadout '+(index+1)+' ready.',3);return true;
 };
 P.interact=function(entity=this.nearest){
   if(!entity||this.battle||this.talk.open||this.panel)return false;
   if(entity.type==='project'&&this.meets(entity.requires)){this.ui.open('projects',{id:entity.project});return true;}
   if(entity.type==='cook'&&this.meets(entity.requires)){this.ui.open('cookbook');return true;}
   if(entity.type==='forage')return this.harvest(entity.id);
   return base.interact.call(this,entity);
 };
};
C.refreshCounts?.();
})();
