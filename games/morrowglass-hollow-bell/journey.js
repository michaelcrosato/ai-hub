/* Shared quest, cost, reward, and room-link rules. No rendering or authored dialogue. */
(function(root){
'use strict';
const unique=a=>[...new Set(a)], whole=n=>Number.isFinite(+n)?Math.max(0,Math.floor(+n)):0;
function test(state,rule){
 if(!rule)return true;const c=state.campaign,r=c.root;
 if(Array.isArray(rule))return rule.every(x=>test(state,x));
 if(rule.all)return rule.all.every(x=>test(state,x));
 if(rule.any)return rule.any.some(x=>test(state,x));
 if(rule.not)return !test(state,rule.not);
 if(rule.flag)return c.flags[rule.flag]===true;
 if(rule.defeated)return c.defeated[rule.defeated]===true;
 if(rule.anchor)return r.anchors.includes(rule.anchor);
 if(rule.seen)return r.seen.includes(rule.seen);
 if(rule.crafted)return r.crafted.length>0;
 if(rule.puzzle)return JSON.stringify(r.puzzles[rule.puzzle.id])===JSON.stringify(rule.puzzle.value);
 return false;
}
function validAmounts(value){if(!value||typeof value!=='object'||Array.isArray(value))return false;for(const k of ['crowns','tonic','ether','feather'])if(Object.hasOwn(value,k)&&(!Number.isSafeInteger(value[k])||value[k]<0))return false;if(value.materials!==undefined){if(!value.materials||typeof value.materials!=='object'||Array.isArray(value.materials))return false;for(const n of Object.values(value.materials))if(!Number.isSafeInteger(n)||n<0)return false;}return true;}
function canPay(state,cost={}){
 if(!validAmounts(cost))return false;
 for(const k of ['crowns','tonic','ether','feather'])if(whole(cost[k])>(state.inventory[k]||0))return false;
 for(const [k,n] of Object.entries(cost.materials||{}))if(whole(n)>(state.campaign.root.materials[k]||0))return false;
 return true;
}
function ledger(state,scope='root'){const c=state.campaign;return typeof scope==='string'&&Object.hasOwn(c,scope)&&Array.isArray(c[scope]?.claimed)&&Array.isArray(c[scope]?.pending)?c[scope]:null;}
function transact(state,{key=null,cost={},reward={}}={},options={}){
 const c=state.campaign,r=c.root,record=ledger(state,options.scope);if(!record)return {ok:false,reason:'Unknown progress scope.'};if(!validAmounts(cost)||!validAmounts(reward))return {ok:false,reason:'Invalid transaction amount.'};if(key&&record.claimed.includes(key))return {ok:false,reason:'Already received.'};
 if(!canPay(state,cost))return {ok:false,reason:'You need the listed materials and crowns.'};
 // Validate every material before changing anything. Costs and rewards commit together.
 const known=Object.keys(r.materials);
 if([...Object.keys(cost.materials||{}),...Object.keys(reward.materials||{})].some(k=>!known.includes(k)))return {ok:false,reason:'Unknown material.'};
 for(const k of ['crowns','tonic','ether','feather'])state.inventory[k]=Math.max(0,(state.inventory[k]||0)-whole(cost[k])+whole(reward[k]));
 for(const k of known)r.materials[k]=Math.min(9999,r.materials[k]-whole(cost.materials?.[k])+whole(reward.materials?.[k]));
 if(reward.gear&&!state.ownedGear.includes(reward.gear))state.ownedGear.push(reward.gear);
 if(reward.crest&&!r.crests.includes(reward.crest))r.crests.push(reward.crest);
 for(const f of reward.flags||[])c.flags[f]=true;
 if(key)record.claimed.push(key);
 return {ok:true,reward};
}
function advance(state,quests,options={}){
 const completed=[],record=ledger(state,options.scope);if(!record)return completed;
 for(const q of quests){if(state.campaign.flags[q.flag]||!test(state,q.requires)||!test(state,q.complete))continue;
  const result=transact(state,{key:q.flag,reward:{...q.rewardData,flags:[q.flag]}},options);
  if(result.ok){completed.push(q);if(q.scene&&!record.pending.includes(q.id))record.pending.push(q.id);}
 }
 return completed;
}
function craft(state,recipe){
 if(!recipe||!test(state,recipe.requires))return {ok:false,reason:'This recipe is not ready.'};
 const r=state.campaign.root,once=recipe.unique!==false;
 if(once&&(r.crafted.includes(recipe.id)||recipe.reward.crest&&r.crests.includes(recipe.reward.crest)||recipe.reward.gear&&state.ownedGear.includes(recipe.reward.gear)))return {ok:false,reason:'You already have this item.'};
 const result=transact(state,{key:once?'craft:'+recipe.id:null,cost:recipe.cost,reward:recipe.reward});
 if(result.ok)r.crafted=unique([...r.crafted,recipe.id]);return result;
}
function link(state,definition){if(!definition)return {ok:false,reason:'This room is not connected.'};return test(state,definition.requires)?{ok:true,to:definition.to,spawn:definition.spawn||[130,445]}:{ok:false,reason:definition.reason||'The route is not ready.'};}
root.MorrowJourney={version:'1.1.0',test,canPay,transact,advance,craft,link};
})(typeof window!=='undefined'?window:globalThis);
