import { LIFE_MEMORIES, FILMS } from './life-spec.js';
/** Save only lasting discoveries. Timers and movement belong to LifeWorld. */
class LifeState{
 constructor(){this.memories=new Set();this.seen=new Set();this.films=new Set();this.notes={marimba:new Set(),bottles:new Set()};this.cloudStage=0;this.chats={};this.track='';}
 remember(id){if(!LIFE_MEMORIES.some(m=>m.id===id))return false;const fresh=!this.memories.has(id);this.memories.add(id);return fresh;}
 note(id,index){if(!this.notes[id]||!Number.isInteger(index)||index<0||index>4)return false;this.notes[id].add(index);return this.notes[id].size===5?this.remember(id):false;}
 watch(id){const f=FILMS.find(f=>f.id===id);if(!f)return false;this.films.add(id);return f.memory?this.remember(f.memory):false;}
 chat(id,length){if(!Number.isInteger(length)||length<1)return 0;const i=this.chats[id]||0;this.chats[id]=(i+1)%length;return i%length;}
 snapshot(){return {memories:[...this.memories],seen:[...this.seen],films:[...this.films],notes:Object.fromEntries(Object.entries(this.notes).map(([k,v])=>[k,[...v]])),cloudStage:this.cloudStage,chats:{...this.chats},track:this.track};}
 restore(d){if(!d||typeof d!=='object')return;const set=(a,ok)=>new Set((Array.isArray(a)?a:[]).filter(ok));this.memories=set(d.memories,x=>LIFE_MEMORIES.some(m=>m.id===x));this.seen=set(d.seen,x=>typeof x==='string'&&['brume','nibs','tilly','moss','fern','pipkin','marimba','bottles'].includes(x));this.films=set(d.films,x=>FILMS.some(f=>f.id===x));for(const id of ['marimba','bottles'])this.notes[id]=set(d.notes?.[id],n=>Number.isInteger(n)&&n>=0&&n<=4);this.cloudStage=Number.isInteger(d.cloudStage)?Math.max(0,Math.min(2,d.cloudStage)):0;this.track=LIFE_MEMORIES.some(m=>m.site===d.track)?d.track:'';for(const id of ['pip','miso','mochi','pebble','brume','moss','fern','pipkin','local_bramble','local_baths','local_kiln','local_usher'])if(Number.isInteger(d.chats?.[id])&&d.chats[id]>=0)this.chats[id]=d.chats[id]%10;}
}

export { LifeState };
