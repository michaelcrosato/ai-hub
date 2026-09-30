import { DetourState } from './detour-state.js';
import { LifeState } from './life-state.js';
import { ExplorationState } from './exploration.js';
import { CONFIG, NEIGHBORS, REGIONS } from './config.js';
import { PostState } from './post.js';
const KEY='little-orbit-save-v1';
class RoundState {
 constructor(){this.detours=new DetourState();this.life=new LifeState();this.explore=new ExplorationState();this.round=1;this.coffees=0;this.served=new Set();this.met=new Set();this.places=new Set();this.wonders=new Set();this.total=0;this.active=false;this.onboarded=false;this.acknowledgedRound=0;this.post=new PostState();this.roundTime=0;this.roundDistance=0;this.lastRound=null;this.bestTime=0;}
 brew(){const need=CONFIG.capacity-this.served.size;if(this.coffees>=need)return false;this.coffees=need;return true;}
 deliver(id){if(!NEIGHBORS.some(n=>n.id===id))return {ok:false,reason:'unknown'};this.met.add(id);if(this.served.has(id))return {ok:false,reason:'served'};if(this.coffees===0)return {ok:false,reason:'empty'};this.coffees--;this.served.add(id);this.total++;if(this.complete)this.finishRound();return {ok:true,complete:this.complete};}
 /** Keep a quiet record of the round: time on the walk and distance, and the best time. */
 finishRound(){const best=!this.bestTime||this.roundTime<this.bestTime;this.lastRound={round:this.round,time:this.roundTime,distance:this.roundDistance,best};if(best)this.bestTime=this.roundTime;}
 get complete(){return this.served.size===NEIGHBORS.length;}
 nextRound(){if(!this.complete)return false;this.round++;this.coffees=0;this.served.clear();this.roundTime=0;this.roundDistance=0;return true;}
 snapshot(){return {v:CONFIG.saveVersion,round:this.round,coffees:this.coffees,served:[...this.served],met:[...this.met],places:[...this.places],wonders:[...this.wonders],total:this.total,active:this.active,onboarded:this.onboarded,acknowledgedRound:this.acknowledgedRound,life:this.life.snapshot(),detours:this.detours.snapshot(),explore:this.explore.snapshot(),post:this.post.snapshot(),roundTime:this.roundTime,roundDistance:this.roundDistance,lastRound:this.lastRound,bestTime:this.bestTime};}
 restore(d){if(!d||d.v!==CONFIG.saveVersion||!Number.isInteger(d.coffees)||d.coffees<0||d.coffees>CONFIG.capacity||['served','met','places','wonders'].some(k=>d[k]!=null&&!Array.isArray(d[k])))return false;const ids=NEIGHBORS.map(p=>p.id);this.round=Math.max(1,Math.floor(d.round)||1);this.coffees=d.coffees;this.served=new Set((d.served||[]).filter(x=>ids.includes(x)));this.met=new Set((d.met||[]).filter(x=>ids.includes(x)));this.places=new Set((d.places||[]).filter(x=>REGIONS.some(r=>r.id===x)));this.wonders=new Set((d.wonders||[]).filter(x=>['tree','boat','mushroom','bell'].includes(x)));this.total=Math.max(this.served.size,Math.floor(d.total)||0);this.active=!!d.active;this.onboarded=d.onboarded===true;this.acknowledgedRound=Math.max(0,Math.min(this.round,Number(d.acknowledgedRound)||0));this.coffees=Math.min(this.coffees,CONFIG.capacity-this.served.size);this.explore=new ExplorationState();this.explore.restore(d.explore);this.life=new LifeState();this.life.restore(d.life);this.detours=new DetourState();this.detours.restore(d.detours);this.post=new PostState();this.post.restore(d.post);const num=v=>Number.isFinite(v)&&v>=0?v:0;this.roundTime=num(d.roundTime);this.roundDistance=num(d.roundDistance);this.bestTime=num(d.bestTime);const r=d.lastRound;this.lastRound=r&&typeof r==='object'&&Number.isFinite(r.time)?{round:Math.max(1,Math.floor(r.round)||1),time:num(r.time),distance:num(r.distance),best:r.best===true}:null;return true;}
 save(player,forward){try{localStorage.setItem(KEY,JSON.stringify({...this.snapshot(),n:player.n,h:player.h,forward}));return true;}catch{return false;}}
 load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(this.restore(d))return d;}catch{}return null;}
 clear(){try{localStorage.removeItem(KEY);}catch{}}
}

export { RoundState };
