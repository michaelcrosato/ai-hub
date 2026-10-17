import {boot} from './harness.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const{app,game,G}=boot();app.start({demo:true,seed:703});let s=app.session;s.approach='forceful';s.route='market';app.replayStart=s.serialize();
for(let i=0;i<120*300&&!s.outcome&&s===app.session;i++)game.advance(1/120);
assert.equal(s.outcome,'success');const expected=G.stateHash(s.serialize()),replay=game.debug.replay(),duration=s.time;app.playReplay(replay);
for(let i=0;i<replay.frames.length;i++)game.advance(1/120);
const actual=G.stateHash(app.session.serialize()),report={ticks:replay.frames.length,duration,expected,actual,outcome:app.session.outcome,passed:actual===expected,errors:game.errors};console.log(report);writeFileSync(process.env.SD_REPORT||'/tmp/sd-replay.json',JSON.stringify(report,null,2));assert.equal(actual,expected);game.dispose();
