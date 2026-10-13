/* Emberwake frontier progression. Pure rules; no DOM, timers, or chapter save access. */
(function(root,factory){
 'use strict'; const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EWExpedition=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,FORMAT='emberwake-forge-project',STORAGE_KEY='emberwake:world-forge-v1';
 const MAX_PROJECT_BYTES=5*1024*1024,MAX_VISITS=4096;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),copy=v=>JSON.parse(JSON.stringify(v));
 const signature=world=>JSON.stringify(world.config);
 function obj(value,keys,name){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(name+' must be an object.');
  for(const key of Reflect.ownKeys(value)){
   const d=Object.getOwnPropertyDescriptor(value,key);
   if(typeof key!=='string'||!keys.includes(key)||!d||!Object.hasOwn(d,'value'))throw Error('Invalid '+name+' field: '+String(key));
  }return value;
 }
 function num(v,a,b,name,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b||(integer&&!Number.isInteger(v)))throw Error('Invalid '+name+'.');return v;}
 function str(v,max,name){if(typeof v!=='string'||!v.length||v.length>max)throw Error('Invalid '+name+'.');return v;}
 function bool(v,name){if(typeof v!=='boolean')throw Error('Invalid '+name+'.');return v;}
 function point(v,size,name,fraction=false){obj(v,['x','y'],name);return {x:num(v.x,0,size-(fraction?0.00001:1),name+' x',!fraction),y:num(v.y,0,size-(fraction?0.00001:1),name+' y',!fraction)};}
 function partyMember(v,max,name){obj(v,['hp','max','ep','maxEp'],name);return {hp:num(v.hp,0,max,name+' health',true),max:num(v.max,max,max,name+' maximum',true),ep:num(v.ep,0,name==='Mira'?32:38,name+' ether',true),maxEp:num(v.maxEp,name==='Mira'?32:38,name==='Mira'?32:38,name+' maximum ether',true)};}
 const nodeSpecs=[
  {id:'relay-0',name:'The Amber Relay',x:18,y:-15,scenario:'quay',description:'An old sentry holds the first signal. Restore this relay on foot.'},
  {id:'relay-1',name:'The Glass Relay',x:-20,y:-18,scenario:'hall',description:'Two guardians answer the second signal. Select targets and break their guard.'},
  {id:'relay-2',name:'The Dawn Relay',x:6,y:26,scenario:'gear',description:'A buried machine wakes at the last relay. Morrow must carry the signal.'}
 ];
 function nodesAt(camp){return nodeSpecs.map(n=>({...n,x:camp.x+n.x,y:camp.y+n.y,completed:false}));}
 function makePaths(camp,nodes){
  const cells=new Map(),put=(x,y)=>cells.set(x+','+y,{x,y,biome:'grassland',road:true});
  const disk=(x,y,r)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r)put(x+dx,y+dy);};
  const line=(a,b)=>{let x=a.x,y=a.y,dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1,err=dx+dy;
   for(;;){disk(x,y,1);if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
  };
  disk(camp.x,camp.y,4);
  nodes.forEach((n,i)=>{const bend={x:camp.x+Math.round((n.x-camp.x)*.5)+(i===1?-3:3),y:camp.y+Math.round((n.y-camp.y)*.5)};line(camp,bend);line(bend,n);disk(n.x,n.y,3);});
  return [...cells.values()];
 }
 function validateState(world,v){
  obj(v,['version','worldSignature','camp','nodes','position','party','inventory','gear','module','difficulty','mounted','visits','stats','completed'],'expedition');
  if(v.version!==VERSION||v.worldSignature!==signature(world))throw Error('This expedition belongs to a different world or version.');
  const size=world.config.size,camp=point(v.camp,size,'camp');
  if(camp.x<40||camp.y<40||camp.x>=size-40||camp.y>=size-40)throw Error('The expedition camp is too close to the world edge.');
  if(!Array.isArray(v.nodes)||v.nodes.length!==3)throw Error('An expedition needs three relays.');
  const expected=nodesAt(camp),nodes=v.nodes.map((n,i)=>{
   obj(n,['id','name','x','y','scenario','description','completed'],'relay');
   for(const k of ['id','name','x','y','scenario','description'])if(n[k]!==expected[i][k])throw Error('Invalid relay route.');
   return {...expected[i],completed:bool(n.completed,'relay status')};
  });
  if((nodes[1].completed&&!nodes[0].completed)||(nodes[2].completed&&!nodes[1].completed))throw Error('Relay order is invalid.');
  obj(v.party,['mira','oren'],'party');obj(v.inventory,['kits'],'inventory');obj(v.gear,['hp','fuel'],'machine');
  if(!['balanced','aegis','coil'].includes(v.module)||!['standard','story'].includes(v.difficulty))throw Error('Invalid expedition configuration.');
  if(!Array.isArray(v.visits)||v.visits.length>MAX_VISITS||new Set(v.visits).size!==v.visits.length)throw Error('Invalid survey record.');
  const visits=v.visits.map(x=>str(x,120,'survey id'));
  obj(v.stats,['distance','surveys','battles','renown'],'statistics');
  const stats={distance:num(v.stats.distance,0,1e10,'distance'),surveys:num(v.stats.surveys,0,MAX_VISITS,'surveys',true),battles:num(v.stats.battles,0,3,'battles',true),renown:num(v.stats.renown,0,1e6,'renown',true)};
  if(stats.battles!==nodes.filter(n=>n.completed).length||stats.surveys!==visits.length)throw Error('The expedition totals do not match its record.');
  const completed=bool(v.completed,'completion');if(completed&&!nodes.every(n=>n.completed))throw Error('The expedition is not ready for extraction.');
  return {version:VERSION,worldSignature:signature(world),camp,nodes,position:point(v.position,size,'position',true),party:{mira:partyMember(v.party.mira,222,'Mira'),oren:partyMember(v.party.oren,202,'Oren')},inventory:{kits:num(v.inventory.kits,0,99,'field kits',true)},gear:{hp:num(v.gear.hp,0,v.module==='aegis'?680:600,'machine health',true),fuel:num(v.gear.fuel,0,100,'fuel')},module:v.module,difficulty:v.difficulty,mounted:bool(v.mounted,'mounted'),visits,stats,completed};
 }
 class Expedition{
  constructor(world,state){this.world=world;this.state=validateState(world,state);this.pending=null;}
  static create(world,preferred,options={}){
   const found=world.findSpawn(preferred),size=world.config.size,camp={x:clamp(Math.floor(found.x),40,size-41),y:clamp(Math.floor(found.y),40,size-41)};
   const nodes=nodesAt(camp),paths=makePaths(camp,nodes),existing=world.exportRecipe().overrides,keys=new Set(existing.map(p=>p.x+','+p.y));
   paths.forEach(p=>keys.add(p.x+','+p.y));if(keys.size>20000)throw Error('This expedition would exceed the 20,000 edited tile limit. Erase some edits or use a new world.');
   const old=paths.map(p=>({x:p.x,y:p.y,value:world.getOverride(p.x,p.y)}));
   try{paths.forEach(p=>world.setOverride(p.x,p.y,{biome:p.biome,road:p.road}));}
   catch(error){old.forEach(p=>world.setOverride(p.x,p.y,p.value||{}));throw error;}
   const module=['balanced','aegis','coil'].includes(options.module)?options.module:'balanced',difficulty=options.difficulty==='story'?'story':'standard';
   return new Expedition(world,{version:VERSION,worldSignature:signature(world),camp,nodes,position:{x:camp.x+.5,y:camp.y+.5},party:{mira:{hp:222,max:222,ep:32,maxEp:32},oren:{hp:202,max:202,ep:38,maxEp:38}},inventory:{kits:3},gear:{hp:module==='aegis'?680:600,fuel:100},module,difficulty,mounted:false,visits:[],stats:{distance:0,surveys:0,battles:0,renown:0},completed:false});
  }
  get nextNode(){return this.state.nodes.find(n=>!n.completed)||null;}
  get restored(){return this.state.nodes.filter(n=>n.completed).length;}
  get atCamp(){return Math.hypot(this.state.position.x-this.state.camp.x-.5,this.state.position.y-this.state.camp.y-.5)<4;}
  serialize(){return copy(this.pending?this.pending.snapshot:this.state);}
  battleState(){return {party:copy(this.state.party),inventory:copy(this.state.inventory),gear:copy(this.state.gear),module:this.state.module,settings:{difficulty:this.state.difficulty},flags:{quayBattle:true}};}
  setPosition(x,y){
   if(this.pending||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=this.world.config.size||y>=this.world.config.size||!this.world.tile(x,y).passable)return false;
   this.state.stats.distance+=Math.hypot(x-this.state.position.x,y-this.state.position.y);this.state.position={x,y};return true;
  }
  toggleMount(){if(this.pending)return false;this.state.mounted=!this.state.mounted;return this.state.mounted;}
  beginEncounter(id){
   if(this.pending)throw Error('Finish the current encounter first.');
   const n=this.state.nodes.find(n=>n.id===id);if(!n||n.completed)throw Error('This relay is already restored.');
   if(this.nextNode.id!==id)throw Error('Restore '+this.nextNode.name+' first.');
   if(Math.hypot(this.state.position.x-n.x-.5,this.state.position.y-n.y-.5)>4)throw Error('Move closer to the relay.');
   this.pending={id,snapshot:copy(this.state)};return {node:copy(n),scenario:n.scenario,state:this.battleState()};
  }
  retryEncounter(){if(!this.pending)throw Error('There is no encounter to retry.');const id=this.pending.id;this.state=copy(this.pending.snapshot);const n=this.state.nodes.find(n=>n.id===id);return {node:copy(n),scenario:n.scenario,state:this.battleState()};}
  resolveBattle(battle){
   if(!this.pending)return {ok:false,reason:'This encounter has already been resolved.'};
   const n=this.state.nodes.find(n=>n.id===this.pending.id);
   if(!battle||battle.result!=='victory')return {ok:false,reason:'The relay is still guarded.'};
   if(battle.scenario!==n.scenario)return {ok:false,reason:'The encounter does not match this relay.'};
   if(battle.kind==='gear'){this.state.gear.hp=clamp(battle.party[0].hp,1,this.state.module==='aegis'?680:600);this.state.gear.fuel=battle.fuel;}
   else for(const p of battle.party){if(!this.state.party[p.id])continue;const target=this.state.party[p.id];target.hp=clamp(p.hp+32,1,target.max);target.ep=clamp(p.ep+6,0,target.maxEp);}
   this.state.inventory.kits=clamp(battle.inventory.kits+1,0,99);n.completed=true;this.state.stats.battles++;
   const reward=n.scenario==='gear'?160:n.scenario==='hall'?80:50;this.state.stats.renown+=reward;this.pending=null;
   return {ok:true,node:copy(n),reward,allRestored:this.restored===3};
  }
  returnToCamp(){
   if(this.pending){this.state=copy(this.pending.snapshot);this.pending=null;}
   this.state.position={x:this.state.camp.x+.5,y:this.state.camp.y+.5};this.state.mounted=false;return this.rest();
  }
  rest(){
   if(this.pending||!this.atCamp)return false;
   for(const p of Object.values(this.state.party)){p.hp=p.max;p.ep=p.maxEp;}
   this.state.gear={hp:this.state.module==='aegis'?680:600,fuel:100};this.state.inventory.kits=Math.max(3,this.state.inventory.kits);return true;
  }
  setModule(module){if(this.pending||!this.atCamp||!['balanced','aegis','coil'].includes(module))return false;this.state.module=module;this.rest();return true;}
  visit(feature){
   if(this.pending||!feature||typeof feature.id!=='string'||!feature.id.length||feature.id.length>120||!Number.isFinite(feature.x)||!Number.isFinite(feature.y)||Math.hypot(this.state.position.x-feature.x-.5,this.state.position.y-feature.y-.5)>4)return {ok:false,reason:'Move closer to this location.'};
   if(this.state.visits.includes(feature.id))return {ok:false,reason:'This location is already in your survey record.'};
   if(this.state.visits.length>=MAX_VISITS)return {ok:false,reason:'This expedition has reached its 4,096-location survey limit. Start a new expedition to keep surveying.'};
   this.state.visits.push(feature.id);this.state.stats.surveys++;const reward=feature.kind==='vault'?25:12;this.state.stats.renown+=reward;
   let benefit='The location is added to your survey record.';
   if(['settlement','sanctuary'].includes(feature.kind)){for(const p of Object.values(this.state.party)){p.hp=p.max;p.ep=p.maxEp;}this.state.gear.fuel=100;benefit='The travelers here restore the party and refuel Morrow.';}
   if(feature.kind==='vault'){this.state.inventory.kits=Math.min(99,this.state.inventory.kits+2);benefit='The cache holds two field kits.';}
   return {ok:true,reward,benefit};
  }
  extract(){if(this.pending||!this.atCamp||this.restored!==3||this.state.completed)return false;this.state.completed=true;this.state.stats.renown+=100;return true;}
  ensurePosition(){if(!this.world.tile(this.state.position.x,this.state.position.y).passable){this.returnToCamp();return false;}return true;}
 }
 function exportProject(world,expedition,view){
  const project={format:FORMAT,version:VERSION,recipe:world.exportRecipe(),expedition:expedition?expedition.serialize():null};
  if(view)project.view={x:view.x,y:view.y,span:view.span};return project;
 }
 function importProject(input,World){
  if(typeof input==='string'){if(input.length>MAX_PROJECT_BYTES)throw Error('The project is larger than 5 MB.');input=JSON.parse(input);}
  if(input&&input.format==='emberwake-world'){const world=World.fromRecipe(input);return {world,expedition:null,view:null};}
  obj(input,['format','version','recipe','expedition','view'],'project');
  if(input.format!==FORMAT||input.version!==VERSION)throw Error('This is not a supported Emberwake world project.');
  const world=World.fromRecipe(input.recipe);const expedition=input.expedition===null?null:new Expedition(world,input.expedition);
  let view=null;if(input.view!==undefined){obj(input.view,['x','y','span'],'atlas view');view={x:num(input.view.x,0,world.config.size,'view x'),y:num(input.view.y,0,world.config.size,'view y'),span:num(input.view.span,16,world.config.size*2,'view span')};}
  if(expedition){for(const p of makePaths(expedition.state.camp,expedition.state.nodes))if(!world.sample(p.x,p.y).passable)throw Error('An expedition route is blocked by an edit. Restore its camp and relay routes before importing.');expedition.ensurePosition();}
  return {world,expedition,view};
 }
 return Object.freeze({Expedition,exportProject,importProject,FORMAT,VERSION,STORAGE_KEY,MAX_PROJECT_BYTES,MAX_VISITS,makePaths});
});
