import {boot} from './harness.mjs';
import {writeFileSync} from 'node:fs';
const seconds=Number(process.argv[2]||14400),{app,game,logs}=boot({native:true}),runs=[],heap=[],start=performance.now(),simStart=game.time;let previous=null,tick=0;app.start({demo:true});
while(game.time-simStart<seconds){
 tick+=60;
 game.advance(.5);const s=app.session;
 if(previous&&previous!==s){runs.push({seed:previous.seed,outcome:previous.outcome,time:previous.time,stage:previous.stage?.id,actors:previous.actors.length,cars:previous.cars.length,trace:previous.trace});if(runs.length%10===0){global.gc?.();heap.push({cycles:runs.length,heap:process.memoryUsage().heapUsed});console.log(JSON.stringify({simulated:tick/120,cycles:runs.length,last:runs.at(-1),heap:heap.at(-1)}));}}
 previous=s;if(game.errors.length)break;
}
const report={runner:'native Node.js context, identical game scripts',simulatedSeconds:game.time-simStart,inputSeconds:tick/120,wallSeconds:(performance.now()-start)/1000,cycles:runs.length,wins:runs.filter(r=>r.outcome==='success').length,failures:runs.filter(r=>r.outcome==='failed').length,recoveries:app.demoRecoveries,heap,errors:game.errors,logs,runs};report.passed=report.simulatedSeconds>=seconds&&report.wins===runs.length&&runs.length>0&&!report.errors.length&&!report.recoveries.length&&runs.every(r=>r.actors===41&&r.cars===14);writeFileSync(process.env.SD_REPORT||'/tmp/sd-soak.json',JSON.stringify(report,null,2));console.log('SOAK '+JSON.stringify({...report,runs:undefined,logs:undefined}));game.dispose();process.exitCode=report.passed?0:1;
