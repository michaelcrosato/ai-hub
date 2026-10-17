import {boot} from './harness.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const runs=[];
for(const branch of ['compact','van']){
 const{app,game,G}=boot();
 // Register another ID after core scripts have loaded. No system or menu edit is allowed here.
 const mission=branch==='van'?'content-only-proof':'spare';
 if(branch==='van')G.registerMission({...G.copy(G.content.missions.spare),id:mission});G.validateMissionMap(G.content.missions[mission],app.session.maps.city);
 app.demoIndex=branch==='van'?1:0;app.start({demo:true,mission,seed:905});let s=app.session,restored=false;
 for(let i=0;i<1200&&!s.outcome;i++){game.advance(.25);if(s.progress===3&&!restored){const payload=s.serialize();app.start({demo:true,mission,restore:payload});s=app.session;restored=true;}if(app.session!==s)break;}
 const report={mission:s.definition.id,branch,actualChoice:s.approach,outcome:s.outcome,restored,time:s.time,money:s.money,trace:s.trace,errors:game.errors};runs.push(report);console.log(report);assert.equal(s.outcome,'success');assert.equal(s.money,1020);assert.ok(restored);assert.equal(s.approach,branch);assert.equal(game.errors.length,0);game.dispose();
}
writeFileSync(process.env.SD_REPORT||'/tmp/sd-expansion.json',JSON.stringify({passed:true,runs},null,2));
