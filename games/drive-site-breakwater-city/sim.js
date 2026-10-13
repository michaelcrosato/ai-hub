/* Breakwater city simulation. Original game code. The browser and tests use this same model. */
(function(root){
'use strict';
const N=30, SAVE_VERSION=1, DEADLINE=60, STORM_MONTH=30;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,s=0)=>{let h=Math.imul(x+13+s,374761393)^Math.imul(y+71,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const ZONES=['home','shop','industry'];
const BUILD={
 inspect:{name:'Inspect',cost:0,group:'inspect',key:'Q',description:'Select a tile to see its services and growth needs.'},
 road:{name:'Road',cost:40,upkeep:.4,group:'network',key:'R',description:'Drag a road. Roads carry power and water. Water tiles become bridges for $160.'},
 home:{name:'Homes',cost:80,group:'zones',key:'H',color:'#8ad789',description:'Zone homes within 3 tiles of a connected road. Residents build when jobs and services are available.'},
 shop:{name:'Commerce',cost:100,group:'zones',key:'C',color:'#65bef5',description:'Zone shops and offices. Demand rises with the number of residents.'},
 industry:{name:'Industry',cost:100,group:'zones',key:'I',color:'#e5bd6a',description:'Zone workshops for jobs and tax income. Keep their pollution away from homes.'},
 wind:{name:'Wind station',cost:1800,upkeep:35,capacity:900,group:'utilities',description:'Supplies 900 units of clean power through connected roads. Needs road access.'},
 pump:{name:'Water pump',cost:1500,upkeep:30,capacity:1000,group:'utilities',description:'Supplies 1,000 units of water. Build within 3 tiles of the shore and a connected road.'},
 park:{name:'Park',cost:160,upkeep:3,range:4,group:'services',description:'Raises local land value and approval within 4 tiles.'},
 clinic:{name:'Clinic',cost:1200,upkeep:38,range:7,group:'services',description:'Improves health and approval within 7 tiles. Needs all utilities.'},
 school:{name:'School',cost:1100,upkeep:32,range:7,group:'services',description:'Supports education and denser growth within 7 tiles. Needs all utilities.'},
 fire:{name:'Fire station',cost:1000,upkeep:28,range:7,group:'services',description:'Stops fires within 7 tiles. Needs all utilities and full funding.'},
 shelter:{name:'Storm shelter',cost:1400,upkeep:22,range:8,group:'resilience',description:'Protects nearby residents and halves recovery time. Reduces flood damage within 8 tiles.'},
 levee:{name:'Flood barrier',cost:220,upkeep:1,range:4,group:'resilience',description:'Protects low ground within 4 tiles. Build on vacant land within 4 tiles of the shore.'},
 raise:{name:'Raise ground',cost:160,group:'terrain',description:'Raises vacant land by one level. Land at height 2 or more is safe from the storm.'},
 trees:{name:'Plant trees',cost:45,group:'terrain',description:'Adds trees on vacant land. Trees reduce local pollution and improve land value.'},
 repair:{name:'Repair / respond',cost:160,group:'resilience',key:'F',description:'Repairs one damaged site or extinguishes a fire. Costs $160 per tile.'},
 bulldoze:{name:'Bulldoze',cost:20,group:'terrain',key:'B',description:'Clears one road, zone, or building for $20. Trees cost $5 to clear.'}
};
const SERVICES=['clinic','school','fire','shelter'];
class City{
 constructor(){
  this.version=SAVE_VERSION;this.size=N;this.month=0;this.funds=24500;this.tax=9;this.funding=100;this.bonds=0;
  this.rngState=73013;this.milestones=[];this.stormDone=false;this.stormDamage=0;this.stormProtected=0;this.result=null;this.sandbox=false;this.stableMonths=0;
  this.events=[];this.pendingEvent=null;this.history=[];this.stats={};this.changes=0;this.spent=0;this.repaired=0;this.lastNet=0;
  this.tiles=Array.from({length:N*N},(_,i)=>{
   const x=i%N,y=Math.floor(i/N),coast=44+Math.sin(x*.48)*2;
   const water=x+y>coast||x>27+Math.sin(y*.45)||y>27+Math.cos(x*.4);
   const h=water?-1:x+y>35?0:x<9&&y<10?3:x+y<23?2:1;
   return {x,y,water,h,type:null,density:1,level:0,progress:0,damage:0,fire:0,trees:!water&&hash(x,y)>.56?1+Math.floor(hash(y,x)*3):0,variant:Math.floor(hash(x,y,7)*100),builtAt:-10};
  });
  const put=(x,y,type,level=1)=>{let t=this.tile(x,y);Object.assign(t,{type,level:ZONES.includes(type)?level:0,trees:0});};
  for(let x=0;x<=22;x++) put(x,14,'road');
  for(let y=7;y<=23;y++) put(11,y,'road');
  for(let x=11;x<=22;x++) put(x,20,'road');
  for(let y=14;y<20;y++) put(20,y,'road');
  for(const x of [8,9,10,12,13,14])for(const y of [12,13,15,16])put(x,y,'home',1+(hash(x,y,5)>.55?1:0));
  for(let x=15;x<=17;x++)for(let y=12;y<=13;y++)put(x,y,'shop',2);
  for(let x=18;x<=19;x++)for(let y=16;y<=19;y++)put(x,y,'industry',2);
  put(6,13,'wind');put(21,21,'pump');put(18,15,'fire');put(9,18,'park');put(12,19,'hall');
  this.recalculate();this.log('Welcome to Alder Bay','The regional road, wind station, and water pump are ready. Build a city that can weather the coast.','info');
  this.history.push(this.sample());
 }
 tile(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<N&&y>=0&&y<N?this.tiles[y*N+x]:null;}
 adjacent(t){return [[t.x-1,t.y],[t.x+1,t.y],[t.x,t.y-1],[t.x,t.y+1]].map(p=>this.tile(...p)).filter(Boolean);}
 distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
 random(){let t=this.rngState+=0x6D2B79F5;this.rngState|=0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 sample(){return {month:this.month,population:this.stats.population,approval:this.stats.approval,funds:Math.round(this.funds),net:this.stats.net,jobs:this.stats.jobs};}
 log(title,text,kind='info'){this.events.unshift({month:this.month,title,text,kind});this.events=this.events.slice(0,60);}
 roadReach(t,max=3){for(let y=Math.max(0,t.y-max);y<=Math.min(N-1,t.y+max);y++)for(let x=Math.max(0,t.x-max);x<=Math.min(N-1,t.x+max);x++){const r=this.tile(x,y);if(r.connected&&this.distance(t,r)<=max)return true;}return false;}
 shoreDistance(t){let d=99;for(let y=Math.max(0,t.y-6);y<=Math.min(N-1,t.y+6);y++)for(let x=Math.max(0,t.x-6);x<=Math.min(N-1,t.x+6);x++){const w=this.tile(x,y);if(w.water)d=Math.min(d,this.distance(t,w));}return d;}
 units(t){if(!ZONES.includes(t.type)||t.damage||t.fire)return 0;const m=t.density===2?1.8:1;return Math.round(t.level*(t.type==='home'?12:t.type==='shop'?8:14)*m);}
 recalculate(){
  const ts=this.tiles,roads=ts.filter(t=>t.type==='road'&&!t.damage);
  for(const t of ts){t.connected=false;t.access=false;t.power=false;t.watered=false;t.active=false;t.pollution=0;t.park=0;t.clinic=0;t.school=0;t.fireCover=0;t.shelter=0;t.protected=t.h>=2;t.shore=this.shoreDistance(t);}
  const gate=this.tile(0,14),queue=[];
  if(gate.type==='road'&&!gate.damage){gate.connected=true;queue.push(gate);}
  for(let i=0;i<queue.length;i++)for(const n of this.adjacent(queue[i]))if(n.type==='road'&&!n.damage&&!n.connected){n.connected=true;queue.push(n);}
  for(const t of ts)if(!t.water&&t.type)t.access=t.type==='road'?t.connected:this.roadReach(t);
  let powerCapacity=0,waterCapacity=0,population=0,commerce=0,industry=0,powerDemand=0,waterDemand=0;
  for(const t of ts){
   if(t.type==='wind'&&t.access&&!t.damage){t.active=true;powerCapacity+=BUILD.wind.capacity;}
   if(t.type==='pump'&&t.access&&!t.damage&&t.shore<=3){t.active=true;waterCapacity+=BUILD.pump.capacity;}
   let u=this.units(t);if(t.type==='home')population+=u;if(t.type==='shop')commerce+=u;if(t.type==='industry')industry+=u;
   t.powerNeed=t.waterNeed=0;
   if(t.access&&!t.damage&&ZONES.includes(t.type)){t.powerNeed=Math.max(8,u*(t.type==='home'?1:.65));t.waterNeed=Math.max(8,u*(t.type==='home'?.8:.55));}
   else if(t.access&&!t.damage&&(SERVICES.includes(t.type)||t.type==='hall')){t.powerNeed=20;t.waterNeed=12;}
   powerDemand+=t.powerNeed;waterDemand+=t.waterNeed;
  }
  // A single connected road grid is a shared utility corridor. Capacity is separate from local access.
  let powerLeft=powerCapacity,waterLeft=waterCapacity;
  const supplyOrder=[...ts.filter(t=>!ZONES.includes(t.type)),...ts.filter(t=>ZONES.includes(t.type))];
  for(const t of supplyOrder){
   t.power=t.access&&powerCapacity>0&&powerLeft+.001>=t.powerNeed;t.watered=t.access&&waterCapacity>0&&waterLeft+.001>=t.waterNeed;
   if(t.power)powerLeft-=t.powerNeed;if(t.watered)waterLeft-=t.waterNeed;
   if(t.type&&!['road','wind','pump'].includes(t.type))t.active=t.access&&t.power&&t.watered&&!t.damage&&!t.fire;
  }
  const polluters=ts.filter(t=>t.type==='industry'&&t.level>0&&!t.damage);
  const parks=ts.filter(t=>t.type==='park'&&!t.damage);
  const trees=ts.filter(t=>t.trees>0);
  const levees=ts.filter(t=>t.type==='levee'&&!t.damage);
  const serviceSites=ts.filter(t=>SERVICES.includes(t.type)&&t.active);
  const coverage=clamp(this.funding/100,0,1);
  for(const t of ts){if(t.water)continue;
   for(const p of polluters){const d=this.distance(t,p);if(d<6)t.pollution+=Math.max(0,(6-d)*p.level*1.5);}
   for(const p of parks){const d=this.distance(t,p);if(d<=4)t.park+=Math.max(0,5-d)*.28;}
   if(t.pollution>0)for(const p of trees)if(this.distance(t,p)<=2)t.pollution-=p.trees*.8;
   t.pollution=clamp(t.pollution,0,100);
   for(const b of serviceSites){const range=BUILD[b.type].range*coverage;if(this.distance(t,b)<=range){const k=b.type==='fire'?'fireCover':b.type;t[k]=1;}}
   t.protected=t.h>=2||levees.some(b=>this.distance(t,b)<=4);
   t.risk=t.h<2&&t.shore<=6&&!t.protected;
   t.value=clamp(Math.round(32+t.park*15+t.clinic*12+t.school*10+(t.shore<5?12:0)+t.h*3-t.pollution*.6),5,100);
  }
  const homes=ts.filter(t=>t.type==='home'&&this.units(t)>0),zones=ts.filter(t=>ZONES.includes(t.type)),weighted=k=>population?homes.reduce((a,t)=>a+this.units(t)*Number(t[k]),0)/population:0;
  const jobs=commerce+industry,employment=population?clamp(jobs/(population*.48),0,1):1;
  const roadCoverage=zones.length?zones.filter(t=>t.access).length/zones.length:1;
  const powerCoverage=zones.length?zones.filter(t=>t.power).length/zones.length:1,waterCoverage=zones.length?zones.filter(t=>t.watered).length/zones.length:1;
  const pollution=weighted('pollution'),parksAvg=weighted('park');
  const approval=clamp(Math.round(48+employment*11+Math.min(powerCoverage,waterCoverage)*12+Math.min(1,parksAvg)*9+weighted('clinic')*7+weighted('school')*6+weighted('fireCover')*3+weighted('shelter')*2-pollution*.38-(this.tax-9)*3.8-(100-this.funding)*.08-(zones.some(t=>t.damage)?4:0)),5,98);
  const residentialDemand=clamp(Math.round(48+(jobs-population*.44)*.5+(approval-65)*1.1-(this.tax-9)*5),0,100);
  const commercialDemand=clamp(Math.round(40+(population*.19-commerce)*.9-(this.tax-9)*4),0,100);
  const industryDemand=clamp(Math.round(44+(population*.35-industry)*.6-(this.tax-9)*3),0,100);
  // Land value has a small economic effect. Services and pollution therefore affect both trust and the tax base.
  const income=Math.round(zones.reduce((sum,t)=>sum+this.units(t)*(t.type==='home'?.38:t.type==='shop'?.22:.19)*(.85+t.value*.003),0)*(this.tax/9));
  let utilityUpkeep=0,serviceUpkeep=0,roadsUpkeep=0;
  for(const t of ts)if(t.type==='road')roadsUpkeep+=(t.water?.9:.4);else if(BUILD[t.type]?.upkeep){const cost=BUILD[t.type].upkeep;if(['wind','pump'].includes(t.type))utilityUpkeep+=cost;else serviceUpkeep+=cost*(SERVICES.includes(t.type)?this.funding/100:1);}
  const debtService=this.bonds*50,admin=35,upkeep=Math.round(utilityUpkeep+serviceUpkeep+roadsUpkeep+debtService+admin),net=income-upkeep;
  const occupied=ts.filter(t=>(ZONES.includes(t.type)&&t.level>0)||SERVICES.includes(t.type)||t.type==='park'),intact=occupied.length?occupied.filter(t=>!t.damage&&!t.fire).length/occupied.length:1;
  const safe=population?homes.reduce((a,t)=>a+this.units(t)*(t.protected||!t.risk?1:t.shelter?.65:0),0)/population:1;
  this.stats={population,commerce,industry,jobs,employment:Math.round(employment*100),approval,income,upkeep,net,utilityUpkeep:Math.round(utilityUpkeep),serviceUpkeep:Math.round(serviceUpkeep),roadsUpkeep:Math.round(roadsUpkeep),debtService,admin,powerCapacity,waterCapacity,powerDemand:Math.ceil(powerDemand),waterDemand:Math.ceil(waterDemand),power:Math.round(powerCoverage*100),water:Math.round(waterCoverage*100),roadCoverage:Math.round(roadCoverage*100),pollution:Math.round(pollution),health:Math.round(weighted('clinic')*100),education:Math.round(weighted('school')*100),fireCoverage:Math.round(weighted('fireCover')*100),resilience:Math.round(safe*100),intact:Math.round(intact*100),demand:{home:residentialDemand,shop:commercialDemand,industry:industryDemand},damaged:ts.filter(t=>t.damage||t.fire).length,roads:roads.length,zones:zones.length};
 }
 canBuild(tool,x,y,density=1){
  const t=this.tile(x,y),b=BUILD[tool];if(!b||!t)return {ok:false,reason:'Select a tile inside the city.'};
  if(this.result&&!this.sandbox)return {ok:false,reason:'Continue the city or start again.'};
  if(tool==='inspect')return {ok:true,cost:0};
  let cost=b.cost;
  if(tool==='road'&&t.water)cost=160;
  if(ZONES.includes(tool)&&density===2)cost*=1.75;
  if(tool==='bulldoze'&&!t.type&&t.trees)cost=5;
  if(tool==='bulldoze'&&!t.type&&!t.trees)return {ok:false,reason:'This tile is already clear.'};
  if(t.type==='hall')return {ok:false,reason:'The town hall is a protected civic site.'};
  if(tool==='repair'){if(!t.damage&&!t.fire)return {ok:false,reason:'This tile needs no repair.'};}
  else if(tool==='bulldoze'){}
  else if(tool==='raise'){if(t.water||t.type)return {ok:false,reason:'Raise vacant land. Clear this tile first.'};if(t.h>=4)return {ok:false,reason:'This land is already at the maximum height.'};}
  else if(tool==='trees'){if(t.water||t.type)return {ok:false,reason:'Plant trees on vacant land.'};if(t.trees>=3)return {ok:false,reason:'This tile already has a full tree canopy.'};}
  else{
   if(t.water&&tool!=='road')return {ok:false,reason:'Build on land. Roads can cross water as bridges.'};
   if(t.type){
    if(t.type===tool&&ZONES.includes(tool)&&density===2&&t.density===1)cost=b.cost*.75;
    else return {ok:false,reason:t.type===tool?'This tile already has this use.':'Clear this tile before you build.'};
   }
   if(ZONES.includes(tool)&&density===2&&!this.milestones.includes('town'))return {ok:false,reason:'Dense zones unlock when the town reaches 600 residents.'};
   if(tool==='pump'&&t.shore>3)return {ok:false,reason:'Place a water pump within 3 tiles of the shore.'};
   if(tool==='levee'&&t.shore>4)return {ok:false,reason:'Place a flood barrier within 4 tiles of the shore.'};
  }
  cost=Math.round(cost);if(this.funds<cost)return {ok:false,reason:'Insufficient funds. Open the budget to review income or issue a bond.',cost};
  return {ok:true,cost};
 }
 build(tool,x,y,density=1,defer=false){
  const check=this.canBuild(tool,x,y,density);if(!check.ok||tool==='inspect')return check;
  const t=this.tile(x,y);this.funds-=check.cost;this.spent+=check.cost;
  if(tool==='bulldoze'){Object.assign(t,{type:null,level:0,progress:0,damage:0,fire:0,trees:0,density:1});}
  else if(tool==='raise'){t.h++;}
  else if(tool==='trees'){t.trees=3;}
  else if(tool==='repair'){t.damage=0;t.fire=0;t.builtAt=this.month;this.repaired++;}
  else{const upgrade=t.type===tool&&t.density===1&&density===2;Object.assign(t,{type:tool,density:ZONES.includes(tool)?density:1,level:upgrade?t.level:0,progress:0,trees:0,damage:0,fire:0,builtAt:this.month});}
  this.changes++;if(!defer)this.recalculate();return {ok:true,cost:check.cost,x,y,tool};
 }
 buildMany(tool,cells,density=1){
  const seen=new Set(),results=[];for(const c of cells){const k=c.x+','+c.y;if(seen.has(k))continue;seen.add(k);results.push(this.build(tool,c.x,c.y,density,true));}
  this.recalculate();return {ok:results.some(r=>r.ok),count:results.filter(r=>r.ok).length,cost:results.reduce((a,r)=>a+(r.ok?r.cost:0),0),reason:results.find(r=>!r.ok)?.reason};
 }
 setTax(rate){if(!Number.isInteger(rate)||rate<5||rate>15)return {ok:false,reason:'Tax must be from 5% to 15%.'};this.tax=rate;this.recalculate();return {ok:true};}
 setFunding(value){if(!Number.isInteger(value)||value<50||value>100||value%10)return {ok:false,reason:'Funding must be from 50% to 100%, in steps of 10.'};this.funding=value;this.recalculate();return {ok:true};}
 bond(repay=false){if(repay){if(!this.bonds||this.funds<5000)return {ok:false,reason:'You need an outstanding bond and $5,000 to repay it.'};this.funds-=5000;this.bonds--;}
  else{if(this.bonds>=3)return {ok:false,reason:'The city can have at most three bonds.'};this.funds+=5000;this.bonds++;}
  this.recalculate();return {ok:true};
 }
 growthBlockers(t){
  const a=[];if(!ZONES.includes(t.type))return a;
  if(t.damage)a.push('Repair storm damage');if(t.fire)a.push('Extinguish the fire');if(!t.access)a.push('Connect a road within 3 tiles');if(!t.power)a.push(this.stats.powerCapacity<this.stats.powerDemand?'Add power capacity':'Connect to the power grid');if(!t.watered)a.push(this.stats.waterCapacity<this.stats.waterDemand?'Add water capacity':'Connect to the water grid');
  if(this.stats.demand[t.type]<20)a.push(t.type==='home'?'Add jobs to increase housing demand':'Add residents to increase job demand');
  if(t.type==='home'&&t.pollution>48)a.push('Reduce nearby industrial pollution');
  if(t.type==='home'&&t.density===2&&t.level>=2&&!t.school)a.push('Add school coverage for upper floors');
  if(t.level>=(t.density===2?4:3))a.push('Fully developed');return a;
 }
 tick(){
  if((this.result&&!this.sandbox)||this.pendingEvent)return false;
  this.month++;this.recalculate();
  // Growth is deterministic. Buildings respond to demand, services, and capacity once per city month.
  let grow=0,shrink=0;
  const candidates=this.tiles.filter(t=>ZONES.includes(t.type));
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  for(const t of this.tiles)if(t.damage&&!ZONES.includes(t.type))t.damage=Math.max(0,t.damage-(t.shelter?2:1));
  for(const t of candidates){
   if(t.fire){if(t.fireCover){t.fire=0;this.log('Fire contained','The fire crew protected the district.','good');}else{t.fire++;if(t.fire>=4){t.fire=0;t.damage=4;this.log('Workshop fire','A workshop was damaged. Use Repair / respond to restore it.','warning');}}continue;}
   if(t.damage){t.damage-=t.shelter?2:1;t.damage=Math.max(0,t.damage);continue;}
   const utility=t.access&&t.power&&t.watered,needs=this.growthBlockers(t).filter(s=>s!=='Fully developed'),max=t.density===2?4:3;
   if(!needs.length&&t.level<max&&grow<10){t.progress+=(.25+this.stats.demand[t.type]/115)*(.8+t.value*.004)*(t.type==='home'?clamp(this.stats.approval/70,.3,1.3):1);if(t.progress>=1){t.progress=0;t.level++;t.builtAt=this.month;grow++;}}
   else if((!utility||this.tax>=14||this.stats.approval<25)&&t.level>0&&this.month%3===0&&shrink<4){t.level--;t.progress=0;shrink++;}
  }
  this.recalculate();this.lastNet=this.stats.net;this.funds+=this.stats.net;
  if(!this.milestones.includes('town')&&this.stats.population>=600){this.milestones.push('town');this.funds+=3000;this.log('Town grant: $3,000','600 residents reached. Dense zoning is now available.','good');}
  if(!this.milestones.includes('civic')&&this.stats.population>=900&&this.stats.approval>=70){this.milestones.push('civic');this.funds+=2500;this.log('Civic grant: $2,500','900 residents and 70% approval. Keep the budget and utilities stable.','good');}
  if(this.month===12){this.pendingEvent='grant';this.log('A choice for the coast','The council has a regional grant to allocate.','event');}
  if(this.month===24){this.pendingEvent='forecast';this.log('Storm forecast','A major coastal storm will arrive in six months. Inspect flood risk now.','warning');}
  if(this.month===STORM_MONTH&&!this.stormDone){this.storm();}
  if(this.month===42&&!this.sandbox){const target=this.tiles.find(t=>t.type==='industry'&&t.level>0&&!t.damage&&!t.fireCover);if(target){target.fire=1;this.log('Fire at the works','An unprotected workshop is burning. Send a response crew or connect a fire station.','warning');}}
  this.recalculate();
  const g=this.goals();if(g.every(v=>v.done))this.stableMonths++;else this.stableMonths=0;
  if(!this.sandbox&&!this.result){
   if(this.funds<=-5000){this.result='lost';this.log('Emergency administration','The treasury fell to -$5,000. The city needs a new financial plan.','warning');}
   else if(this.stableMonths>=3){this.result='won';this.log('The charter is yours','Alder Bay has earned its city charter. You built a place ready for the coast.','good');}
   else if(this.month>=DEADLINE){this.result='lost';this.log('Charter review closed','The deadline passed before all goals were held for three months.','warning');}
  }
  this.history.push(this.sample());this.history=this.history.slice(-240);return true;
 }
 resolveEvent(choice){
  if(this.pendingEvent==='grant'){
   if(choice==='growth'){this.funds+=3000;this.log('Growth grant accepted','$3,000 is available for roads, homes, and jobs.','good');}
   else if(choice==='coast'){this.funds+=2000;this.milestones.push('coastGrant');this.log('Coastal grant accepted','$2,000 received. The regional crew will protect three exposed sites during the storm.','good');}
   else return {ok:false,reason:'Choose a grant.'};
  }else if(this.pendingEvent==='forecast'){
   if(choice==='crews'){if(this.funds<1000)return {ok:false,reason:'The reserve crew needs $1,000.'};this.funds-=1000;this.milestones.push('reserveCrew');this.log('Reserve crew assigned','The reserve crew will protect four exposed sites during the storm.','good');}
   else if(choice!=='prepare')return {ok:false,reason:'Choose a storm plan.'};
  }else if(this.pendingEvent==='storm'){if(choice!=='recover')return {ok:false,reason:'Open the city to begin recovery.'};}
  else return {ok:false,reason:'There is no council decision to make.'};
  this.pendingEvent=null;this.recalculate();return {ok:true};
 }
 storm(){
  this.stormDone=true;let damage=0,protectedCount=0;
  let reserves=(this.milestones.includes('reserveCrew')?4:0)+(this.milestones.includes('coastGrant')?3:0);
  for(const t of this.tiles){
   if(!t.type||t.type==='hall'||t.type==='road'||t.type==='levee'||t.type==='wind'||t.type==='pump'||t.h>=2||t.shore>6)continue;
   if(t.protected||(t.shelter&&hash(t.x,t.y,12)>.35)||reserves>0){if(!t.protected&&!t.shelter)reserves--;protectedCount++;continue;}
   if(hash(t.x,t.y,34)>.22){t.damage=t.shelter?3:6;damage++;}
  }
  this.stormDamage=damage;this.stormProtected=protectedCount;this.pendingEvent='storm';
  this.log('The coastal squall',damage?`${damage} sites need repair. Crews and barriers protected ${protectedCount} sites. Repairs cost $160 each; local crews also restore sites over time.`:`The storm passed. All occupied sites are intact. Your city was ready.`,damage?'warning':'good');
 }
 goals(){return [
  {id:'population',label:'1,200 residents',value:this.stats.population,target:1200,done:this.stats.population>=1200},
  {id:'approval',label:'70% city approval',value:this.stats.approval,target:70,done:this.stats.approval>=70},
  {id:'utilities',label:'95% power and water',value:Math.min(this.stats.power,this.stats.water),target:95,done:Math.min(this.stats.power,this.stats.water)>=95},
  {id:'budget',label:'Cover monthly costs',value:this.stats.net,target:0,done:this.stats.net>=0&&this.funds>=0},
  {id:'storm',label:'Recover from the storm',value:this.stormDone?this.stats.intact:0,target:95,done:this.stormDone&&this.stats.intact>=95}
 ];}
 snapshot(){return JSON.parse(JSON.stringify({version:this.version,size:N,month:this.month,funds:this.funds,tax:this.tax,funding:this.funding,bonds:this.bonds,rngState:this.rngState,milestones:this.milestones,stormDone:this.stormDone,stormDamage:this.stormDamage,stormProtected:this.stormProtected,result:this.result,sandbox:this.sandbox,stableMonths:this.stableMonths,events:this.events,pendingEvent:this.pendingEvent,history:this.history,changes:this.changes,spent:this.spent,repaired:this.repaired,lastNet:this.lastNet,tiles:this.tiles.map(t=>({x:t.x,y:t.y,water:t.water,h:t.h,type:t.type,density:t.density,level:t.level,progress:t.progress,damage:t.damage,fire:t.fire,trees:t.trees,variant:t.variant,builtAt:t.builtAt}))}));}
 static fromSave(s){
  if(!s||s.version!==SAVE_VERSION||s.size!==N||!Array.isArray(s.tiles)||s.tiles.length!==N*N)throw new Error('This is not a supported Breakwater save.');
  const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  if(!Number.isInteger(s.month)||!finite(s.month,0,100000)||!finite(s.funds,-1e8,1e10)||!Number.isInteger(s.tax)||!finite(s.tax,5,15)||!finite(s.funding,50,100)||s.funding%10||!Number.isInteger(s.bonds)||!finite(s.bonds,0,3)||!Number.isInteger(s.rngState))throw new Error('The save has invalid city values.');
  const types=[null,'hall',...Object.keys(BUILD).filter(k=>!['inspect','raise','repair','trees','bulldoze'].includes(k))];
  for(let i=0;i<s.tiles.length;i++){const t=s.tiles[i];if(!t||t.x!==i%N||t.y!==Math.floor(i/N)||typeof t.water!=='boolean'||!Number.isInteger(t.h)||!finite(t.h,-1,4)||!types.includes(t.type)||![1,2].includes(t.density)||!Number.isInteger(t.level)||!finite(t.level,0,4)||!finite(t.progress,0,10)||!finite(t.damage,0,12)||!finite(t.fire,0,10)||!finite(t.trees,0,3)||!finite(t.variant,0,100)||!finite(t.builtAt,-100,100000))throw new Error('The save has an invalid map tile.');}
  for(const t of s.tiles)if((t.water&&t.type&&t.type!=='road')||(t.water&&t.h!==-1)||(!t.water&&t.h<0)||(t.density===1&&t.level>3)||(!ZONES.includes(t.type)&&t.level!==0)||!Number.isInteger(t.damage)||!Number.isInteger(t.fire)||!Number.isInteger(t.trees))throw new Error('The save has inconsistent terrain or buildings.');
  if(![null,'won','lost'].includes(s.result)||![null,'grant','forecast','storm'].includes(s.pendingEvent)||!Array.isArray(s.milestones)||s.milestones.some(m=>!['town','civic','coastGrant','reserveCrew'].includes(m))||typeof s.stormDone!=='boolean'||typeof s.sandbox!=='boolean'||!Number.isInteger(s.stableMonths)||!finite(s.stableMonths,0,100000)||(s.month>=STORM_MONTH&&!s.stormDone)||(s.month<STORM_MONTH&&s.stormDone))throw new Error('The save has invalid scenario values.');
  const c=Object.create(City.prototype),keys=['version','size','month','funds','tax','funding','bonds','rngState','milestones','stormDone','stormDamage','stormProtected','result','sandbox','stableMonths','pendingEvent','changes','spent','repaired','lastNet'];
  for(const k of keys)c[k]=s[k];
  const tileKeys=['x','y','water','h','type','density','level','progress','damage','fire','trees','variant','builtAt'];
  Object.assign(c,{events:Array.isArray(s.events)?s.events.slice(0,60).filter(e=>e&&typeof e.title==='string'&&typeof e.text==='string').map(e=>({title:e.title.slice(0,120),text:e.text.slice(0,600),kind:['info','good','warning','event'].includes(e.kind)?e.kind:'info',month:finite(e.month,0,100000)?e.month:0})):[],history:Array.isArray(s.history)?s.history.slice(-240).filter(v=>v&&['month','population','approval','funds','net','jobs'].every(k=>finite(v[k],-1e10,1e10))):[],tiles:s.tiles.map(t=>Object.fromEntries(tileKeys.map(k=>[k,t[k]])))});
  for(const k of ['stormDamage','stormProtected','changes','repaired'])if(!Number.isInteger(c[k])||!finite(c[k],0,1e10))throw new Error('The save has invalid city counters.');
  if(!finite(c.spent,0,1e10)||!finite(c.lastNet,-1e10,1e10))throw new Error('The save has invalid financial records.');
  c.recalculate();return c;
 }
}
const api={City,BUILD,ZONES,SERVICES,N,SAVE_VERSION,DEADLINE,STORM_MONTH,clamp,hash};root.BreakwaterSim=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
