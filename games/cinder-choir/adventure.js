/* Cinder Choir: saved, mission-scoped field work and local navigation.
 * This module has no DOM, rendering, combat, or storage dependencies. */
(() => {
'use strict';
const CC=globalThis.CC=globalThis.CC||{}, A={};
const all=()=>[...CC.DATA.chapters,...CC.DATA.quests,...(CC.DATA.missions||[])];
const idOf=q=>typeof q==='string'?q:q?.id;
A.quest=q=>typeof q==='string'?all().find(x=>x.id===q):q;
A.definition=q=>CC.Scenarios?.byId[idOf(q)]||null;
const blank=()=>({started:false,index:0,targets:[],escort:null});
A.ensure=s=>{
 s.adventure ||= {version:1,missions:{},outcomes:{},discoveries:[]};
 const a=s.adventure;a.version=1;a.missions ||= {};a.outcomes ||= {};a.discoveries ||= [];a.recordTexts ||= {};a.plans ||= {};a.drafts ||= {};
 for(const q of all()){
  const def=A.definition(q);if(!def)continue;
  const p=a.missions[q.id] ||= blank();
  if(s.flags[q.id]){p.started=true;p.index=def.steps.length;p.targets=[];p.escort=null;for(const key of Object.keys(a.drafts))if(key.startsWith(q.id+':'))delete a.drafts[key];}
  for(const step of def.steps.slice(0,p.index))if(step.opensGate)a.outcomes['gate:'+q.place]=true;
 }
 return a;
};
A.validate=s=>{
 if(s.adventure===undefined)return true;
 const a=s.adventure,record=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const recordLimit=CC.DATA.places.length*8;
 if(!record(a)||a.version!==1||!record(a.missions)||!record(a.outcomes)||!Array.isArray(a.discoveries)||a.discoveries.length>recordLimit||a.discoveries.some(x=>typeof x!=='string'||x.length>180))return false;
 if(Object.keys(a.missions).length>all().length||Object.keys(a.outcomes).length>150||Object.values(a.outcomes).some(v=>v!==true))return false;
 if(a.recordTexts!==undefined&&(!record(a.recordTexts)||Object.keys(a.recordTexts).length>recordLimit||Object.entries(a.recordTexts).some(([k,v])=>!a.discoveries.includes(k)||typeof v!=='string'||v.length>6000)))return false;
 if(a.plans!==undefined){
  if(!record(a.plans)||Object.keys(a.plans).length>all().length*3)return false;
  for(const [key,answer] of Object.entries(a.plans)){
   const [id,stage]=key.split(':'),def=A.definition(id),step=def?.steps.find(s=>s.id===stage);
   if(!step||step.kind!=='allocate'||!A.checkAnswer(step,answer)||!a.missions[id]?.started||a.missions[id].index<def.steps.indexOf(step))return false;
  }
 }
 if(a.drafts!==undefined){
  if(!record(a.drafts)||Object.keys(a.drafts).length>all().length)return false;
  for(const [key,answer]of Object.entries(a.drafts)){
   const [id,stage]=key.split(':'),def=A.definition(id),p=a.missions[id],step=def?.steps[p?.index];
   if(key!==id+':'+stage||!p?.started||!step||step.id!==stage||!A.validDraft(step,answer))return false;
  }
 }
 for(const [id,p]of Object.entries(a.missions)){
  const def=A.definition(id);if(!def||!record(p)||typeof p.started!=='boolean'||!Number.isInteger(p.index)||p.index<0||p.index>def.steps.length||(!p.started&&p.index!==0))return false;
  const step=def.steps[p.index],count=step?.targets?.length||1;
  if(!Array.isArray(p.targets)||p.targets.length>=count||new Set(p.targets).size!==p.targets.length||Array.from(p.targets).some(i=>!Number.isInteger(i)||i<0||i>=count))return false;
  if((!p.started||!step?.targets)&&p.targets.length)return false;
  if(step?.kind==='trail'&&p.targets.some((n,i)=>n!==i))return false;
  if((!p.started||!step)&&p.escort!==null)return false;
  const size=CC.Atlas?.layouts[A.quest(id)?.place]?.size||[96,96];
  if(p.escort!==null&&(!record(p.escort)||step?.kind!=='escort'||!p.started||!Number.isFinite(p.escort.x)||!Number.isFinite(p.escort.y)||p.escort.x<0||p.escort.y<0||p.escort.x>=size[0]*16||p.escort.y>=size[1]*16))return false;
 }
 return true;
};
A.progress=(s,q)=>s.adventure?.missions[idOf(q)]||A.ensure(s).missions[idOf(q)]||blank();
A.status=(s,q)=>{
 q=A.quest(q);const def=A.definition(q);
 if(!q||!def)return {started:false,complete:false,index:0,step:null,objectives:[],evidence:[]};
 const p=A.progress(s,q),complete=!!s.flags[q.id];
 return {id:q.id,definition:def,started:p.started,complete,index:p.index,step:def.steps[p.index]||null,finished:p.index>=def.steps.length,
  total:def.steps.length,escort:p.escort,targetsDone:p.targets.slice(),
  objectives:def.steps.map((step,i)=>({label:step.title,description:step.description,at:step.at,kind:step.kind,count:step.targets?.length||1,current:i<p.index?(step.targets?.length||1):i===p.index?p.targets.length:0,done:i<p.index,active:p.started&&i===p.index})),
  evidence:def.steps.flatMap((step,i)=>i<p.index&&step.evidence?[{...step.evidence,stage:step.id}]:[])
 };
};
A.start=(s,q)=>{const p=A.progress(s,q);const first=!p.started;p.started=true;return first;};
A.completeStep=(s,q)=>{
 q=A.quest(q);const p=A.progress(s,q),def=A.definition(q),step=def?.steps[p.index];
 if(!step||s.flags[q.id])return false;
 if(step.opensGate)s.adventure.outcomes['gate:'+q.place]=true;
 delete s.adventure.drafts?.[q.id+':'+step.id];
 p.index++;p.targets=[];p.escort=null;return true;
};
A.finish=(s,q)=>{
 const p=A.progress(s,q),def=A.definition(q);if(!def)return;
 p.started=true;p.index=def.steps.length;p.targets=[];p.escort=null;
 for(const key of Object.keys(s.adventure?.drafts||{}))if(key.startsWith(idOf(q)+':'))delete s.adventure.drafts[key];
 for(const step of def.steps)if(step.opensGate)s.adventure.outcomes['gate:'+A.quest(q).place]=true;
};
A.targets=(s,q,world)=>{
 q=A.quest(q);if(!q||!world||q.place!==world.place?.id)return [];
 const p=A.progress(s,q),def=A.definition(q),step=def?.steps[p.index];if(!p.started||!step||s.flags[q.id])return [];
 const list=p.escort?[{at:step.to,label:step.destinationLabel||'Bring the group to '+(world.anchorLabels?.[step.to]||step.to)}]:step.targets||[{at:step.at,label:step.title}];
 return list.flatMap((target,i)=>{
  if(!p.escort&&p.targets.includes(i))return [];
  if(step.kind==='trail'&&i!==p.targets.length)return [];
  const point=world.anchors?.[target.at];if(!point)return [];
  return [{...point,...target,type:'mission',id:'mission:'+q.id+':'+step.id+':'+i,missionId:q.id,stageId:step.id,targetIndex:i,kind:step.kind,label:target.label||step.title,prop:step.prop||'sign',speaker:(target.lines||step.lines)?.[0]?.speaker,to:step.to,escorting:!!p.escort}];
 });
};
A.checkAnswer=(step,answer)=>{
 const c=step?.challenge;if(!c)return false;
 if(step.kind==='puzzle')return Number.isInteger(answer)&&answer===c.answer;
 if(!Array.isArray(answer)||Array.from(answer).some(n=>!Number.isInteger(n)))return false;
 if(step.kind==='circuit')return !!CC.UndertidePuzzles?.inspect(c.board,answer).success;
 if(step.kind==='allocate')return Array.isArray(answer)&&answer.length===c.labels.length&&answer.every((n,i)=>Number.isInteger(n)&&n>=0&&n>=(c.min?.[i]||0)&&n<=(c.max?.[i]??c.total))&&answer.reduce((sum,n)=>sum+n,0)===c.total;
 const expected=step.kind==='sequence'?c.order:step.kind==='tune'?c.target:step.kind==='sort'?c.answers:null;
 return !!expected&&Array.isArray(answer)&&answer.length===expected.length&&answer.every((n,i)=>Number.isInteger(n)&&n===expected[i]);
};
A.validDraft=(step,answer)=>{
 const c=step?.challenge;if(!c||!Array.isArray(answer)||Array.from(answer).some(n=>!Number.isInteger(n)))return false;
 if(step.kind==='circuit')return !!CC.UndertidePuzzles?.validDraft(CC.UndertidePuzzles.get(c.board),answer);
 if(step.kind==='sequence')return answer.length<=c.order.length&&answer.every(n=>n>=0&&n<c.labels.length);
 if(step.kind==='tune')return answer.length===c.labels.length&&answer.every(n=>n>=0&&n<=3);
 if(step.kind==='sort')return answer.length===c.items.length&&answer.every(n=>n>=-1&&n<c.bins.length);
 if(step.kind==='allocate')return answer.length===c.labels.length&&answer.every((n,i)=>n>=0&&n<=(c.max?.[i]??c.total));
 return false;
};
A.initialDraft=step=>{
 const c=step?.challenge;if(!c)return null;
 if(step.kind==='circuit')return CC.UndertidePuzzles.get(c.board)?.initial.slice()||null;
 if(step.kind==='sequence')return [];
 if(step.kind==='sort')return c.items.map(()=>-1);
 if(['tune','allocate'].includes(step.kind))return c.labels.map(()=>0);
 return null;
};
A.draft=(s,q)=>{
 const step=A.status(s,q).step;if(!step)return null;
 return (s.adventure?.drafts?.[idOf(q)+':'+step.id]||A.initialDraft(step))?.slice()||null;
};
A.setDraft=(s,q,answer)=>{
 const status=A.status(s,q),step=status.step;
 if(!status.started||status.complete||!A.validDraft(step,answer))return false;
 A.ensure(s).drafts[idOf(q)+':'+step.id]=answer.slice();return true;
};
A.recordPlan=(s,q,answer)=>{
 const step=A.status(s,q).step;if(step?.kind!=='allocate'||!A.checkAnswer(step,answer))return false;
 A.ensure(s).plans[idOf(q)+':'+step.id]=answer.slice();return true;
};
A.plans=(s,q)=>{
 const id=idOf(q),def=A.definition(q);if(!def)return [];
 return def.steps.filter(step=>step.kind==='allocate'&&s.adventure?.plans?.[id+':'+step.id]).map(step=>({title:step.title,labels:step.challenge.labels,values:s.adventure.plans[id+':'+step.id].slice()}));
};
A.effects=(s,place)=>{
 const effects=new Map();
 for(const q of all().filter(q=>q.place===place)){
  const p=A.progress(s,q),def=A.definition(q);if(!def)continue;
  for(const step of def.steps.slice(0,p.index))if(step.visual)effects.set(step.at,{at:step.at,quest:q.id,stage:step.id,...step.visual});
 }
 for(const effect of CC.DATA.living?.choiceEffects||[])if(effect.place===place&&s.flags[effect.flag]&&(effect.requires||[]).every(flag=>s.flags[flag]))effects.set(effect.at,{...effect,quest:effect.flag});
 return [...effects.values()];
};
// A route is a list of tile centers. The same collision grid drives E.Body.
A.path=(world,start,target)=>{
 if(!world||!start||!target)return [];
 const w=world.width,h=world.height,sx=Math.floor(start.x/16),sy=Math.floor(start.y/16),tx=Math.floor(target.x/16),ty=Math.floor(target.y/16);
 if(sx<0||sy<0||tx<0||ty<0||sx>=w||tx>=w||sy>=h||ty>=h||!world.map.walkable(tx,ty))return [];
 const first=sy*w+sx,last=ty*w+tx,prev=new Int32Array(w*h).fill(-1),queue=[first];prev[first]=first;
 for(let k=0;k<queue.length&&prev[last]<0;k++){
  const n=queue[k],x=n%w,y=Math.floor(n/w);
  for(const [xx,yy]of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
   if(xx<0||yy<0||xx>=w||yy>=h)continue;const next=yy*w+xx;
   if(prev[next]>=0||!world.map.walkable(xx,yy))continue;prev[next]=n;queue.push(next);
  }
 }
 if(prev[last]<0)return [];
 const route=[];for(let n=last;;n=prev[n]){route.push({x:(n%w)*16+8,y:Math.floor(n/w)*16+8});if(n===first)break;}
 return route.reverse();
};
A.roomAt=(world,p)=>world?.rooms?.find(room=>p.x/16>=room.x&&p.x/16<room.x+room.w&&p.y/16>=room.y&&p.y/16<room.y+room.h)||null;
CC.Adventure=A;
})();
