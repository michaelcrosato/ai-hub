/* Nacre jobs. Pure metre data; no engine, UI, clock, network or storage calls.
 * Save profile rewards and exportSave() together in one caller-owned transaction.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NacreJobs=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=1,MAX_ACTIVE=3,CELL=200,MAX_RECORDS=20000;
const WORK_DEADLINE_MULTIPLIER={2:1.5,3:1.2,4:1,5:.8};
const clone=v=>JSON.parse(JSON.stringify(v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(x,y)=>({x,y,z:0});
const empty=()=>({updates:[],completed:[],failed:[],rewards:[]});
const merge=(a,b)=>{for(const key of ['updates','completed','failed','rewards'])a[key].push(...b[key]);return a;};
function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function stable(v){if(Array.isArray(v))return'['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function integer(n,min,max,label){if(!Number.isSafeInteger(n)||n<min||n>max)throw new RangeError(label+' is outside its supported range');return n;}
function string(v,label,max=180){if(typeof v!=='string'||!v.length||v.length>max)throw new TypeError(label+' must be a short non-empty string');return v;}
function object(v,keys,label){if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError(label+' must be an object');for(const k of Object.keys(v))if(!keys.includes(k))throw new TypeError(label+' has unknown field '+k);return v;}
function position(v){return !!v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z===undefined?0:v.z);}
function atAlong(route,metres){let rest=metres;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],len=distance(a,b);if(rest<=len){const t=len?rest/len:0;return point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);}rest-=len;}const p=route.points.at(-1);return point(p.x,p.y);}
const S=(type,kind,label,prompt,action,holdSeconds,text,pointIndex,extra={})=>({type,kind,label,prompt,action,holdSeconds,text,pointIndex,...extra});
const TEMPLATES={
 'first-delivery':{title:'First delivery',description:'Collect a sealed dispatch beside the Exchange. Take it to the clerk on the nearby avenue.',xp:120,gold:25,intro:true,stages:[S('interact','courier','Dispatch steward','Collect the dispatch','pickup',.6,'Collect the sealed dispatch.',0),S('interact','recipient','Avenue clerk','Deliver the dispatch','deliver',.6,'Give the dispatch to the avenue clerk.',1)]},
 delivery:{title:'A letter under blue wax',description:'Carry a merchant letter through the local streets. The recipient is waiting at a public meeting point.',xp:100,gold:28,timed:true,stages:[S('interact','courier','Letter keeper','Collect the letter','pickup',.7,'Collect the letter under blue wax.',0),S('interact','recipient','Waiting recipient','Deliver the letter','deliver',.7,'Deliver the sealed letter.',1)]},
 cache:{title:'The misplaced strongbox',description:'Recover a small cache left by a frightened porter. Its marker is on a public street.',xp:90,gold:32,stages:[S('interact','cache','Porter’s strongbox','Recover the cache','recover',1,'Recover the porter’s strongbox.',0)]},
 sabotage:{title:'Spoil the contraband',description:'Ruin two marked contraband stores before their handlers return. Keep the streets clear for the residents.',xp:145,gold:38,stages:[S('interact','contraband','First contraband store','Spoil the store','sabotage',1.3,'Spoil the first contraband store.',0),S('interact','contraband','Second contraband store','Spoil the store','sabotage',1.3,'Spoil the second contraband store.',1)]},
 extortion:{title:'Break the collection',description:'Stop a gang of street collectors. Speak with the merchant after the threat is gone.',xp:180,gold:48,stages:[S('kill','enemy-group','Street collectors','Stop the collectors','fight',0,'Defeat the extortion crew.',0,{enemyKind:'enforcer',baseEnemies:2}),S('interact','merchant','Relieved merchant','Speak with the merchant','talk',.7,'Speak with the merchant.',0)]},
 rescue:{title:'Open the iron cord',description:'Defeat a captor, then release the detained resident at the same street post.',xp:170,gold:42,stages:[S('kill','enemy-group','Captive’s escort','Defeat the captor','fight',0,'Defeat the captive’s escort.',0,{enemyKind:'captor',baseEnemies:1}),S('interact','captive','Detained resident','Release the captive','rescue',1,'Release the captive.',0)]},
 survey:{title:'Three marks for the road guild',description:'Check three public route markers in order. The guild needs a clear account of the local streets.',xp:130,gold:30,timed:true,stages:[S('visit','survey','First route mark','Reach the first mark','visit',0,'Reach the first route mark.',0),S('visit','survey','Second route mark','Reach the second mark','visit',0,'Reach the second route mark.',1),S('visit','survey','Third route mark','Reach the third mark','visit',0,'Reach the third route mark.',2)]},
 theft:{title:'A ledger without a seal',description:'Take a smuggler’s ledger from its street cache. Carry it to a separate safe lane.',xp:160,gold:45,stages:[S('interact','ledger','Unsealed ledger','Take the ledger','steal',1,'Take the unsealed ledger.',0),S('escape','safe-lane','Safe meeting lane','Reach safety','escape',0,'Reach the safe lane with the ledger.',1)]}
};
const OPPORTUNITIES={
 purse:{title:'A lost purse',description:'Recover a purse before it disappears into the crowd.',xp:45,gold:15,stages:[S('interact','purse','Lost purse','Recover the purse','recover',.55,'Recover the lost purse.',0)]},
 lookout:{title:'A smuggler lookout',description:'A lookout is threatening passers-by. Stop the threat.',xp:75,gold:20,stages:[S('kill','enemy-group','Smuggler lookout','Stop the lookout','fight',0,'Defeat the lookout.',0,{enemyKind:'lookout',baseEnemies:1})]},
 supplies:{title:'Supply work',description:'Secure a street supply bundle for the local workers.',xp:50,gold:12,stages:[S('interact','supplies','Loose supply bundle','Secure the supplies','work',.9,'Secure the workers’ supplies.',0)]},
 rescue:{title:'A resident in trouble',description:'Stop the captor and help the resident. No contract is needed.',xp:100,gold:26,stages:[S('kill','enemy-group','Street captor','Defeat the captor','fight',0,'Defeat the street captor.',0,{enemyKind:'captor',baseEnemies:1}),S('interact','captive','Frightened resident','Help the resident','rescue',.8,'Help the resident.',0)]}
};
const BOARD_KEYS=Object.keys(TEMPLATES).filter(k=>k!=='first-delivery'),OP_KEYS=Object.keys(OPPORTUNITIES);
function closest(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return point(a.x+dx*t,a.y+dy*t);}
class Jobs{
 constructor({city,seed,state}={}){
  if(!city||typeof city.isWalkable!=='function'||typeof city.route!=='function'||!Array.isArray(city.roads)||!Array.isArray(city.districts))throw new TypeError('A Nacre city with roads and routing is required');
  const chosenSeed=seed===undefined?city.spec?.seed??'nacre':seed;if(!['string','number'].includes(typeof chosenSeed)||typeof chosenSeed==='number'&&!Number.isFinite(chosenSeed))throw new TypeError('Seed must be a finite number or string');
  this.city=city;this.seed=String(chosenSeed);string(this.seed,'seed',160);
  this.cityKey=hash(stable(typeof city.missionSpec==='function'?city.missionSpec():typeof city.exportSpec==='function'?city.exportSpec():{roads:city.roads,districts:city.districts})).toString(16);
  this.tag=hash(this.seed+'|'+this.cityKey).toString(16);this.districts=new Map(city.districts.map(d=>[d.id,d]));
  this.cycle=0;this.trackedId=null;this.active=new Map();this.closed=new Map();this.opportunities=new Map();this.paid=new Set();this.definitions=new Map();this.geometry=new Map();this.cellGeometry=new Map();
  if(state!==undefined)this._load(state);
 }
 _id(prefix,cycle,district,template,level,danger){return[prefix,this.tag,cycle,district,template,level,danger].join(':');}
 _parseJob(id,prefix='j'){
  string(id,'job id',260);const p=id.split(':');if(p.length!==7||p[0]!==prefix||p[1]!==this.tag||!this.districts.has(p[3])||!Object.prototype.hasOwnProperty.call(TEMPLATES,p[4]))throw new TypeError('Unknown job id');
  const cycle=Number(p[2]),level=Number(p[5]),danger=Number(p[6]);integer(cycle,0,MAX_RECORDS,'offer cycle');integer(level,1,1000,'level');integer(danger,1,5,'danger');
  if(String(cycle)!==p[2]||String(level)!==p[5]||String(danger)!==p[6])throw new TypeError('Non-canonical job id');
  if(p[4]==='first-delivery'&&(p[3]!=='grand-exchange'||level!==1||danger!==1))throw new TypeError('Invalid first delivery id');
  return{id:this._id('j',cycle,p[3],p[4],level,danger),cycle,districtId:p[3],templateId:p[4],level,danger};
 }
 _safe(p){return this.city.isWalkable(p.x,p.y,.45,0);}
 _roadCandidates(origin,radius,inside){
  const out=[],seen=new Set();
  for(const road of this.city.roads){const a=road.points?.[0],b=road.points?.at(-1);if(!a||!b||distance(closest(a,b,origin),origin)>radius)continue;
   const values=[closest(a,b,origin),...[.15,.35,.55,.75,.9].map(t=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))];
   for(const p of values){if(distance(p,origin)>radius||inside&&!inside(p))continue;const key=p.x.toFixed(5)+','+p.y.toFixed(5);if(seen.has(key))continue;seen.add(key);if(this._safe(p))out.push({...p,roadId:road.id});}
  }
  return out;
 }
 _districtGeometry(districtId){
  if(this.geometry.has(districtId))return this.geometry.get(districtId);
  const d=this.districts.get(districtId),origin=d.arrival;
  let points=this._roadCandidates(origin,205,p=>distance(p,origin)>=60&&distance(p,origin)<=200);
  if(points.length<8)points=this._roadCandidates(origin,350,p=>distance(p,origin)>=50&&distance(p,origin)<=350);
  if(!points.length)throw new Error('No walkable local road targets in '+districtId);
  this.geometry.set(districtId,points);return points;
 }
 _missionPoints(meta,count){
  const district=this.districts.get(meta.districtId),arrival=district.arrival;
  if(meta.templateId==='first-delivery'){
   const pickup=point(arrival.x,arrival.y);if(!this._safe(pickup))throw new Error('The first delivery arrival is not walkable');
   const candidates=this._roadCandidates(pickup,65).sort((a,b)=>Math.abs(distance(a,pickup)-29)-Math.abs(distance(b,pickup)-29));
   for(const p of candidates){const r=this.city.route(pickup,p,{radius:.45});if(r.ok&&r.lengthM>=20&&r.lengthM<=35)return{points:[pickup,point(p.x,p.y)],lengthM:r.lengthM,routes:[r.points]};}
   throw new Error('No20–35m first delivery route from the arrival');
  }
  const available=this._districtGeometry(meta.districtId),points=[],routes=[];let previous=arrival,lengthM=0;
  for(let index=0;index<count;index++){
   const ranked=available.map(p=>({p,score:hash(meta.id+'|'+index+'|'+p.roadId+'|'+p.x.toFixed(5)+'|'+p.y.toFixed(5))})).sort((a,b)=>a.score-b.score);
   let selected=null;
   for(const {p} of ranked){const gap=distance(previous,p);if(index&&gap<(meta.templateId==='theft'?60:25)||points.some(q=>distance(p,q)<22))continue;if(index&&gap>155)continue;
    const r=this.city.route(previous,p,{radius:.45});if(!r.ok||r.lengthM>(index?230:350))continue;selected={p,r};break;
   }
   if(!selected)for(const {p}of ranked){if(points.some(q=>distance(p,q)<15))continue;const r=this.city.route(previous,p,{radius:.45});if(r.ok&&r.lengthM<=500){selected={p,r};break;}}
   if(!selected)throw new Error('No connected local route for '+meta.id);
   const p=point(selected.p.x,selected.p.y);points.push(p);routes.push(selected.r.points);lengthM+=selected.r.lengthM;previous=p;
  }
  return{points,lengthM,routes};
 }
 _definition(meta,ambient=false,location){
  if(this.definitions.has(meta.id))return this.definitions.get(meta.id);
  const template=(ambient?OPPORTUNITIES:TEMPLATES)[meta.templateId];if(!template)throw new TypeError('Unknown mission template');
  const combat=template.stages.some(s=>s.type==='kill');
  // Compare risk on the same route. Danger one retains its original geometry.
  const routeMeta=!ambient&&!combat&&meta.danger>1?{...meta,id:this._id('j',meta.cycle,meta.districtId,meta.templateId,meta.level,1),danger:1}:meta;
  const count=Math.max(...template.stages.map(s=>s.pointIndex))+1,geo=ambient?{points:[location],lengthM:0,routes:[]}:this._missionPoints(routeMeta,count),source=(ambient?'opportunity:':'job:')+meta.id;
  const reward={xp:template.intro?120:template.xp+(meta.level-1)*8+(meta.danger-1)*(ambient?12:25),gold:template.intro?25:template.gold+Math.floor((meta.level-1)*2)+(meta.danger-1)*8,danger:meta.danger,source};
  const stages=template.stages.map((s,index)=>{
   const enemies=s.type==='kill'?s.baseEnemies+(meta.danger>=3?1:0)+(meta.danger>=5?1:0):0;
   const target={id:meta.id+':t'+index,...(ambient?{opportunityId:meta.id}:{jobId:meta.id}),...geo.points[s.pointIndex],z:0,kind:s.kind,label:s.label,prompt:s.prompt,action:s.action,type:s.type,holdSeconds:s.holdSeconds,radius:3,danger:meta.danger};
   if(enemies)Object.assign(target,{enemyCount:enemies,enemyTotal:enemies,enemyKind:s.enemyKind,enemyLevel:Math.max(1,meta.level+Math.floor((meta.danger-1)/2)),enemyIds:Array.from({length:enemies},(_,i)=>target.id+':e'+i)});
   return{type:s.type,count:enemies||1,progress:0,text:s.text,target};
  });
  const job={id:meta.id,templateId:meta.templateId,title:template.title,description:template.description,districtId:meta.districtId,level:meta.level,danger:meta.danger,recommendedLevel:1+(meta.danger-1)*2,stages,stageIndex:0,status:ambient?'available':'offered',reward,lengthM:geo.lengthM,routes:geo.routes};
  if(!ambient&&!template.intro&&!combat&&meta.danger>1){
   const workSeconds=template.stages.reduce((sum,s)=>sum+s.holdSeconds,0);
   job.timeLimit=Math.ceil((geo.lengthM/2.7+workSeconds)*WORK_DEADLINE_MULTIPLIER[meta.danger]+20);
  }else if(template.timed)job.timeLimit=Math.ceil(Math.max(180,geo.lengthM/2.7*2.5+60));
  this.definitions.set(meta.id,job);return job;
 }
 _record(def){return{id:def.id,stageIndex:0,stages:def.stages.map(()=>({progress:0,killedIds:[]})),remaining:def.timeLimit??null};}
 _snapshot(def,record,status){const out=clone(def);out.status=status;out.stageIndex=record.stageIndex;out.stages.forEach((s,i)=>{s.progress=record.stages[i].progress;s.target=this._target(def,record,i);});if(def.timeLimit!==undefined)out.remaining=record.remaining;return out;}
 _target(def,record,index=record.stageIndex){const s=def.stages[index],progress=record.stages[index];if(!s)return null;const target=clone(s.target);target.progress=progress.progress;target.count=s.count;if(s.type==='kill'){target.clearedEnemyIds=[...progress.killedIds];target.enemyIds=target.enemyIds.filter(id=>!progress.killedIds.includes(id));target.enemyCount=target.enemyIds.length;}return target;}
 _introDone(){return[...this.closed].some(([id,record])=>record.status==='completed'&&this._parseJob(id).templateId==='first-delivery');}
 _introActive(){return[...this.active.keys()].some(id=>this._parseJob(id).templateId==='first-delivery');}
 offers(districtId,{level=1,danger=1}={}){
  if(!this.districts.has(districtId))throw new RangeError('Unknown district');integer(level,1,1000,'level');integer(danger,1,5,'danger');
  const keys=districtId==='grand-exchange'&&!this._introDone()&&!this._introActive()?['first-delivery',...BOARD_KEYS]:BOARD_KEYS;
  return keys.map(templateId=>{
   const intro=templateId==='first-delivery',id=this._id('j',this.cycle,districtId,templateId,intro?1:level,intro?1:danger);if(this.active.has(id)||this.closed.has(id))return null;
   const def=this._definition(this._parseJob(id)),out=clone(def);out.offerId=id.replace(/^j:/,'offer:');out.status='offered';return out;
  }).filter(Boolean);
 }
 accept(offerId){
  let meta;try{meta=this._parseJob(offerId,'offer');}catch(e){return{ok:false,reason:e.message};}
  if(meta.cycle!==this.cycle)return{ok:false,reason:'This board has refreshed. Choose a current offer.'};
  if(this.active.size>=MAX_ACTIVE)return{ok:false,reason:'You can carry up to three active jobs.'};
  if(this.active.has(meta.id)||this.closed.has(meta.id))return{ok:false,reason:'This offer has already been used.'};
  if(meta.templateId==='first-delivery'&&(this._introDone()||this._introActive()))return{ok:false,reason:'The first delivery is already active or complete.'};
  const def=this._definition(meta),record=this._record(def);this.active.set(meta.id,record);if(!this.trackedId)this.trackedId=meta.id;
  return{ok:true,job:this._snapshot(def,record,'active')};
 }
 activeJobs(){return[...this.active].map(([id,record])=>this._snapshot(this._definition(this._parseJob(id)),record,'active'));}
 track(jobId){if(jobId===null){this.trackedId=null;return true;}if(!this.active.has(jobId))return false;this.trackedId=jobId;return true;}
 _close(id,status,reason,result){const record=this.active.get(id);if(!record)return;const def=this._definition(this._parseJob(id));this.active.delete(id);this.closed.set(id,{status,...(reason?{reason:String(reason).slice(0,160)}:{})});this.cycle++;if(this.trackedId===id)this.trackedId=this.active.keys().next().value||null;
  const item={id,jobId:id,source:'job:'+id,title:def.title,status,...(reason?{reason:String(reason).slice(0,160)}:{})};result.updates.push({type:status,...item});if(status==='failed')result.failed.push(item);
 }
 abandon(jobId){const result=empty();this._close(jobId,'abandoned','Abandoned by the player.',result);return result;}
 failActive(reason='The job could not be finished.'){const result=empty();for(const id of [...this.active.keys()])this._close(id,'failed',reason,result);return result;}
 _cellPoints(cx,cy){
  const key=cx+','+cy;if(this.cellGeometry.has(key))return this.cellGeometry.get(key);const x=cx*CELL,y=cy*CELL,center=point(x+100,y+100);
  const points=this._roadCandidates(center,155,p=>p.x>=x&&p.x<x+CELL&&p.y>=y&&p.y<y+CELL).sort((a,b)=>hash(this.tag+'|'+key+'|'+a.roadId+'|'+a.x+'|'+a.y)-hash(this.tag+'|'+key+'|'+b.roadId+'|'+b.x+'|'+b.y));
  const selected=[];for(const p of points)if(!selected.some(q=>distance(p,q)<18)){selected.push(point(p.x,p.y));if(selected.length===2)break;}
  this.cellGeometry.set(key,selected);return selected;
 }
 _parseOpportunity(id){string(id,'opportunity id',160);const p=id.split(':');if(p.length!==6||p[0]!=='o'||p[1]!==this.tag||p[2]!=='0')throw new TypeError('Unknown opportunity id');const cx=Number(p[3]),cy=Number(p[4]),slot=Number(p[5]);integer(cx,-1,15,'cell x');integer(cy,-1,15,'cell y');integer(slot,0,1,'cell slot');if(String(cx)!==p[3]||String(cy)!==p[4]||String(slot)!==p[5])throw new TypeError('Non-canonical opportunity id');const p0=this._cellPoints(cx,cy)[slot];if(!p0)throw new TypeError('Opportunity has no walkable road point');return{id,cx,cy,slot,location:p0};}
 _opDefinition(id,level,danger){const meta=this._parseOpportunity(id),templateId=OP_KEYS[hash(id+'|template')%OP_KEYS.length],district=this.city.districtAt(meta.location.x,meta.location.y),effectiveDanger=OPPORTUNITIES[templateId].stages.some(s=>s.type==='kill')?danger:1;return this._definition({id,templateId,districtId:district?.id||'perimeter',level,danger:effectiveDanger},true,meta.location);}
 getTargets(pos,radius=100,level=1,danger=1){
  if(!position(pos))throw new TypeError('A finite metre position is required');if(!Number.isFinite(radius)||radius<0||radius>500)throw new RangeError('Target radius must be from zero to500m');integer(level,1,1000,'level');integer(danger,1,5,'danger');
  const out=[];for(const[id,record]of this.active){const def=this._definition(this._parseJob(id)),target=this._target(def,record);if(distance(target,pos)<=radius)out.push(target);}
  const x0=Math.max(-1,Math.floor((pos.x-radius)/CELL)),x1=Math.min(15,Math.floor((pos.x+radius)/CELL)),y0=Math.max(-1,Math.floor((pos.y-radius)/CELL)),y1=Math.min(15,Math.floor((pos.y+radius)/CELL));
  for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++)for(let slot=0;slot<2;slot++){
   const p=this._cellPoints(cx,cy)[slot];if(!p||distance(p,pos)>radius)continue;const id=['o',this.tag,0,cx,cy,slot].join(':');let record=this.opportunities.get(id);
   if(record?.status==='completed')continue;if(!record){const def=this._opDefinition(id,level,danger);record={...this._record(def),level:def.level,danger:def.danger,status:'available'};this.opportunities.set(id,record);}
   const def=this._opDefinition(id,record.level,record.danger);out.push(this._target(def,record));
  }
  return out;
 }
 _find(targetId){
  for(const[id,record]of this.active){const def=this._definition(this._parseJob(id));if(def.stages[record.stageIndex]?.target.id===targetId)return{def,record,ambient:false};}
  for(const[id,record]of this.opportunities){if(record.status==='completed')continue;const def=this._opDefinition(id,record.level,record.danger);if(def.stages[record.stageIndex]?.target.id===targetId)return{def,record,ambient:true};}
  return null;
 }
 _pay(def,result){const source=def.reward.source,id='reward:'+source;if(this.paid.has(id))return;this.paid.add(id);result.rewards.push({id,...clone(def.reward),loot:true});}
 _advance(found,event,result){
  const{def,record,ambient}=found,index=record.stageIndex,stage=def.stages[index],progress=record.stages[index],source=def.reward.source;
  if(stage.type==='kill'){
   const ids=stage.target.enemyIds;if(typeof event.enemyId!=='string'||!ids.includes(event.enemyId)||progress.killedIds.includes(event.enemyId))return;
   progress.killedIds.push(event.enemyId);progress.killedIds.sort();progress.progress=progress.killedIds.length;
  }else progress.progress=Math.min(stage.count,progress.progress+1);
  result.updates.push({type:'progress',id:def.id,source,stageIndex:index,progress:progress.progress,count:stage.count,...(ambient?{opportunityId:def.id}:{jobId:def.id})});
  if(progress.progress<stage.count)return;record.stageIndex++;
  if(record.stageIndex<def.stages.length){result.updates.push({type:'stage',id:def.id,source,stageIndex:record.stageIndex,target:this._target(def,record)});return;}
  const done={id:def.id,source,title:def.title,status:'completed',...(ambient?{opportunityId:def.id}:{jobId:def.id})};
  if(ambient)record.status='completed';else this._close(def.id,'completed',null,result);
  result.completed.push(done);this._pay(def,result);
 }
 handle(event){
  const result=empty();if(!event||!['interact','kill','visit','escape'].includes(event.type)||typeof event.targetId!=='string'||!position(event.position))return result;
  const found=this._find(event.targetId);if(!found)return result;const stage=found.def.stages[found.record.stageIndex],target=stage.target;
  if(event.type!==stage.type||Math.abs((event.position.z||0)-target.z)>.75)return result;
  if(event.type!=='kill'&&distance(event.position,target)>target.radius)return result;
  if(event.type==='escape'&&event.safe!==true)return result;
  this._advance(found,event,result);return result;
 }
 tick(dt,pos){
  const result=empty();if(!Number.isFinite(dt)||dt<0||dt>86400)throw new RangeError('Tick duration must be finite seconds from zero to86400');
  for(const[id,record]of [...this.active]){const def=this._definition(this._parseJob(id));if(def.timeLimit!==undefined){record.remaining=Math.max(0,record.remaining-dt);if(record.remaining<=0){this._close(id,'failed','Time ran out.',result);continue;}}}
  if(position(pos))for(const[id,record]of [...this.active]){const def=this._definition(this._parseJob(id)),stage=def.stages[record.stageIndex];if(stage.type==='visit')merge(result,this.handle({type:'visit',targetId:stage.target.id,position:pos}));}
  return result;
 }
 exportSave(){return{schema:'nacre-jobs',version:VERSION,seed:this.seed,cityKey:this.cityKey,cycle:this.cycle,trackedId:this.trackedId,
  active:[...this.active.values()].map(clone),closed:[...this.closed].map(([id,r])=>({id,...clone(r)})),opportunities:[...this.opportunities.values()].map(clone),paid:[...this.paid].sort()};}
 _validateProgress(input,def,ambient=false){
  object(input,ambient?['id','stageIndex','stages','remaining','level','danger','status']:['id','stageIndex','stages','remaining'],'progress');
  if(ambient&&(input.level!==def.level||input.danger!==def.danger))throw new TypeError('Opportunity difficulty does not match its risk');
  const complete=ambient&&input.status==='completed',last=complete?def.stages.length:def.stages.length-1;integer(input.stageIndex,0,last,'stage index');if(complete&&input.stageIndex!==def.stages.length)throw new RangeError('Completed opportunity has unfinished stages');
  if(!Array.isArray(input.stages)||input.stages.length!==def.stages.length)throw new TypeError('Invalid stage progress array');
  input.stages.forEach((p,i)=>{object(p,['progress','killedIds'],'stage progress');integer(p.progress,0,def.stages[i].count,'stage progress');if(!Array.isArray(p.killedIds)||new Set(p.killedIds).size!==p.killedIds.length)throw new TypeError('Invalid cleared enemy ids');
   const expected=i<input.stageIndex?def.stages[i].count:i>input.stageIndex?0:null;if(expected!==null&&p.progress!==expected)throw new RangeError('Stage progress is out of order');if(!complete&&i===input.stageIndex&&p.progress===def.stages[i].count)throw new RangeError('Current stage was already completed');
   if(def.stages[i].type==='kill'){if(p.killedIds.some(id=>!def.stages[i].target.enemyIds.includes(id))||p.killedIds.length!==p.progress)throw new TypeError('Enemy clears do not match stage progress');}else if(p.killedIds.length)throw new TypeError('Only combat stages have enemy clears');
  });
  if(def.timeLimit===undefined){if(input.remaining!==null)throw new TypeError('Untimed job has a timer');}else if(!Number.isFinite(input.remaining)||input.remaining<=0||input.remaining>def.timeLimit)throw new RangeError('Invalid remaining job time');
  return clone(input);
 }
 _load(state){
  object(state,['schema','version','seed','cityKey','cycle','trackedId','active','closed','opportunities','paid'],'save');
  if(state.schema!=='nacre-jobs'||state.version!==VERSION||state.seed!==this.seed||state.cityKey!==this.cityKey)throw new TypeError('Save version, seed or city does not match');integer(state.cycle,0,MAX_RECORDS,'cycle');
  for(const key of ['active','closed','opportunities','paid'])if(!Array.isArray(state[key])||state[key].length>(key==='active'?MAX_ACTIVE:MAX_RECORDS))throw new TypeError('Invalid save list '+key);
  if(state.cycle!==state.closed.length)throw new RangeError('Board cycle does not match the job history');const expectedPaid=new Set();let introCompleted=0,introActive=0;
  for(const item of state.closed){object(item,['id','status','reason'],'closed job');const meta=this._parseJob(item.id);if(meta.cycle>=state.cycle||!['completed','failed','abandoned'].includes(item.status)||this.closed.has(item.id))throw new TypeError('Invalid closed job');if(item.reason!==undefined)string(item.reason,'close reason',160);this.closed.set(item.id,{status:item.status,...(item.reason?{reason:item.reason}:{})});if(item.status==='completed'){expectedPaid.add('reward:job:'+item.id);if(meta.templateId==='first-delivery')introCompleted++;}}
  for(const item of state.active){const meta=this._parseJob(item.id);if(meta.cycle>state.cycle||this.closed.has(item.id)||this.active.has(item.id))throw new TypeError('Invalid active job');const def=this._definition(meta);this.active.set(item.id,this._validateProgress(item,def));if(meta.templateId==='first-delivery')introActive++;}
  if(introCompleted>1||introActive>1||introCompleted&&introActive)throw new RangeError('First delivery may complete only once');
  for(const item of state.opportunities){if(!item||this.opportunities.has(item.id))throw new TypeError('Duplicate opportunity');integer(item.level,1,1000,'opportunity level');integer(item.danger,1,5,'opportunity danger');if(!['available','completed'].includes(item.status))throw new TypeError('Unknown opportunity status');const def=this._opDefinition(item.id,item.level,item.danger);this.opportunities.set(item.id,this._validateProgress(item,def,true));if(item.status==='completed')expectedPaid.add('reward:opportunity:'+item.id);}
  if(new Set(state.paid).size!==state.paid.length||state.paid.length!==expectedPaid.size||state.paid.some(id=>!expectedPaid.has(id)))throw new TypeError('Reward ledger does not match completed work');
  if(state.trackedId!==null&&!this.active.has(state.trackedId))throw new TypeError('Tracked job is not active');this.paid=new Set(state.paid);this.cycle=state.cycle;this.trackedId=state.trackedId;
 }
}
return{version:VERSION,create:options=>new Jobs(options),fromSave:options=>{if(!options||options.state===undefined)throw new TypeError('A saved mission state is required');return new Jobs(options);},Jobs,templates:clone(TEMPLATES),opportunityTemplates:clone(OPPORTUNITIES),maxActive:MAX_ACTIVE,cellSizeM:CELL};
});
