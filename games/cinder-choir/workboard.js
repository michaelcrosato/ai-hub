/* A searchable view of the actual campaign state. No DOM or save writes. */
(() => {
'use strict';
const CC=globalThis.CC;
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const filters=['available','nearby','started','complete','all'];
function query(app,options={}){
 const D=CC.DATA,search=String(options.search||'').slice(0,120),words=normalize(search).trim().split(/\s+/).filter(Boolean),filter=filters.includes(options.filter)?options.filter:'available';
 const chapters=new Set(D.chapters.map(q=>q.id)),quests=new Set(D.quests.map(q=>q.id));
 const arcs=[{id:'main1',title:'The Borrowed Voices'},{id:'main2',title:'The Unwritten World'},...(D.arcs||[]).map(a=>({id:a.id,title:a.title}))];
 const arc=arcs.some(a=>a.id===options.arc)?options.arc:'';
 const entries=app.allTasks().map((q,index)=>{
  const status=app.missionStatus(q),place=app.places[q.place],available=app.taskAvailable(q),here=q.place===app.state.location;
  const arcId=chapters.has(q.id)?'main1':quests.has(q.id)?'main2':q.arc;
  const text=normalize([q.title,place?.name,place?.region,q.objective,status.started?status.step?.title:'',arcs.find(a=>a.id===arcId)?.title].join(' '));
  return {q,status,place,available,here,arcId,index,text};
 }).filter(row=>(!arc||row.arcId===arc)&&words.every(word=>row.text.includes(word)));
 const matches=(row,key)=>key==='all'||key==='complete'&&row.status.complete||key==='available'&&row.available||key==='nearby'&&row.available&&row.here||key==='started'&&row.available&&row.status.started;
 const counts=Object.fromEntries(filters.map(key=>[key,entries.filter(row=>matches(row,key)).length]));
 const priority=row=>row.status.complete?4:!row.available?3:row.here?0:row.status.started?1:2;
 const rows=entries.filter(row=>matches(row,filter)).sort((a,b)=>priority(a)-priority(b)||(a.place?.level||0)-(b.place?.level||0)||a.index-b.index);
 return {rows,counts,arcs,arc,search,filter,total:app.allTasks().length};
}
CC.Workboard={query};
})();
