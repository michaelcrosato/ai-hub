/* Layout upgrades preserve character records and reward receipts. Call only
 * after the complete source snapshot has passed its normal save validation. */
(function(root){
'use strict';
const LAYOUT='lived-in',BUILD='0.3.0',copy=v=>JSON.parse(JSON.stringify(v));
function layoutOf(snapshot){
 const value=snapshot?.cityLayout;
 if(value!==undefined&&value!=='legacy'&&value!==LAYOUT)throw Error('This city layout is not supported.');
 return value===LAYOUT?LAYOUT:'legacy';
}
function cityFor(snapshot){return root.NacreCity.create({seed:snapshot.citySeed,density:1,...(layoutOf(snapshot)===LAYOUT?{layout:LAYOUT}:{})});}
function upgrade(snapshot){
 if(layoutOf(snapshot)===LAYOUT)return{snapshot,city:cityFor(snapshot),changed:false,relocated:false};
 const next=copy(snapshot),city=root.NacreCity.create({seed:next.citySeed,density:1,layout:LAYOUT});
 const original=root.NacreJobs.fromSave({city:cityFor(snapshot),seed:next.citySeed,state:snapshot.jobs});
 const definitions=root.NacreJobs.create({city,seed:next.citySeed});
 for(const record of next.jobs.active){
  const def=definitions._definition(definitions._parseJob(record.id));
  if(def.timeLimit!==undefined)record.remaining=Math.min(record.remaining,def.timeLimit);
 }
 // Validate all progress, clears, and paid receipts against the new geometry.
 const rebuilt=root.NacreJobs.fromSave({city,seed:next.citySeed,state:next.jobs});next.jobs=rebuilt.exportSave();
 const targets=jobs=>new Map(jobs.activeJobs().flatMap(j=>j.stages.map(s=>[s.target.id,s.target])));
 const beforeTargets=targets(original),afterTargets=targets(rebuilt);
 const safe=city.safePoint(next.world.position,.275);
 if(safe.relocated)next.world.position={x:safe.x,y:safe.y,z:safe.z};
 for(const enemy of next.world.enemies){
  const before=beforeTargets.get(enemy.targetId),after=afterTargets.get(enemy.targetId);
  if(before&&after){enemy.x+=after.x-before.x;enemy.y+=after.y-before.y;}
  const p=city.safePoint({x:enemy.x,y:enemy.y,z:0},.275);
  if(p.relocated){enemy.x=p.x;enemy.y=p.y;}
 }
 next.cityLayout=LAYOUT;next.build=BUILD;
 return{snapshot:next,city,changed:true,relocated:safe.relocated};
}
root.NacreFreeplayLayout={layout:LAYOUT,build:BUILD,layoutOf,cityFor,upgrade};
})(typeof window!=='undefined'?window:globalThis);
