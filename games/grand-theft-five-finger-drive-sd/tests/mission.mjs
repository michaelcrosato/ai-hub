import {boot} from './harness.mjs';
import {writeFileSync} from 'node:fs';
const count=Number(process.argv[2]||20),report={runs:[],errors:[],started:new Date().toISOString()},start=performance.now();
for(let i=0;i<=count;i++){
 const {app,game,logs}=boot();app.start({demo:true,seed:i===count?552:700+i});const s=app.session;s.approach=i===count?'quiet':i%2?'forceful':'quiet';s.route=i===count?'canal':i%4<2?'canal':'market';const intended={approach:s.approach,route:s.route};
 for(let n=0;n<1200&&!s.outcome&&app.session===s&&!game.errors.length;n++)game.advance(.5);
 const run={seed:s.seed,...intended,actualApproach:s.approach,actualRoute:s.route,outcome:s.outcome||'stalled',time:s.time,stage:s.stage?.id,trace:s.trace,metrics:s.metrics,hp:s.crew.map(a=>a.hp),errors:game.errors,logs};report.runs.push(run);console.log(JSON.stringify(run));game.dispose();
}
report.seconds=(performance.now()-start)/1000;report.passed=report.runs.every(r=>r.outcome==='success'&&!r.errors.length&&r.route===r.actualRoute);writeFileSync(process.env.SD_REPORT||'/tmp/sd-missions.json',JSON.stringify(report,null,2));console.log('RESULT '+JSON.stringify({passed:report.passed,runs:report.runs.length,seconds:report.seconds}));process.exitCode=report.passed?0:1;
