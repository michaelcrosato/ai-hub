/* Interface for The Far Shore. Uses the game's existing accessible panel shell. */
(() => {
'use strict';
const D=globalThis.Dawn,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statNames={atk:'Attack',mag:'Magic',def:'Defence',speed:'Speed',maxHp:'HP',maxMp:'MP'};
const stats=s=>Object.entries(s||{}).map(([k,v])=>`<span class="tag">${esc(statNames[k]||k)} ${v>0?'+':''}${v}</span>`).join('');
const refresh=(ui,type,arg)=>{const key=ui.dom?document.activeElement?.dataset?.action:null;ui.open(type,arg);if(key&&ui.dom)ui.el('panel')?.querySelector(`[data-action="${key}"]`)?.focus({preventScroll:true});};
function requirement(a,r){
 const names=(r?.flags||[]).map(f=>a.content.dungeons?.find(d=>d.completeFlag===f)?.name||a.content.missions?.find(m=>m.completeFlag===f)?.name).filter(Boolean);
 return names.length?'Finish '+names.join(' and ')+'.':r?.chapterAtLeast?'Opens in Chapter '+r.chapterAtLeast+'.':'Available during the journey.';
}
function dungeonSVG(a,d){
 const C=a.content,rooms=d.rooms.map(id=>C.zoneById[id]),points=[[82,70],[275,70],[468,70],[178,225],[372,225]],seen=new Set();let lines='',nodes='';
 rooms.forEach((z,i)=>{for(const e of z.exits||[]){const j=d.rooms.indexOf(e.to);if(j<0)continue;const key=[i,j].sort().join(':');if(seen.has(key))continue;seen.add(key);const open=a.meets(e.requires),p=points[i],q=points[j];lines+=`<path d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}" stroke="${open?'#8aa98d':'#886f5d'}" stroke-width="4" ${open?'':'stroke-dasharray="7 6"'}/>`;}});
 rooms.forEach((z,i)=>{const p=points[i],current=z.id===a.state.zone,visited=a.state.visited.includes(z.id),target=z.id===a.destination(),words=z.name.split(' '),nameLines=[''];for(const word of words){const n=nameLines.length-1;if(nameLines[n].length+word.length>21)nameLines.push(word);else nameLines[n]+=(nameLines[n]?' ':'')+word;}
  nodes+=`<circle cx="${p[0]}" cy="${p[1]}" r="${target?27:23}" fill="${current?'#d9c38b':visited?'#406b66':'#253e48'}" stroke="${target?'#f4d58c':'#9fb6a4'}" stroke-width="${target?3:1.5}"/><text x="${p[0]}" y="${p[1]+6}" text-anchor="middle" fill="${current?'#17353d':'#e3e4ce'}" font-size="18" font-weight="bold">${i+1}</text><rect x="${p[0]-78}" y="${p[1]+30}" width="156" height="${nameLines.length*15+5}" rx="5" fill="#102a35"/><text x="${p[0]}" y="${p[1]+42}" fill="#e1dfc4" text-anchor="middle" font-size="12">${nameLines.map((t,n)=>`<tspan x="${p[0]}" dy="${n?15:0}">${esc(t)}</tspan>`).join('')}</text>`;
 });
 return `<svg class="dungeon-map" viewBox="0 0 550 290" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" role="img" aria-label="${esc(d.name)} room connections. Dotted lines are locked doors."><rect width="550" height="290" rx="14" fill="#102a35"/>${lines}${nodes}</svg>`;
}
D.dungeonSVG=dungeonSVG;
D.journeyPanel=(ui,type,arg)=>{
 if(!['camp','craft','materials','bestiary','mastery','trials','dungeon','mechanism'].includes(type))return null;
 const a=ui.app,C=a.content,S=a.state;if(!S)return null;
 const button=(...args)=>ui.action(...args),out={title:'',kicker:'THE FAR SHORE',html:'',footer:''};let h='';
 if(type==='camp'){
  out.title='The journey kit';out.kicker='FIELD WORK · EQUIPMENT · PRACTICE';
  const completed=(C.missions||[]).filter(m=>m.campaign==='depths'&&S.flags[m.completeFlag]).length;
  h=`<p>Keep the party ready. Follow a new thread, make equipment, or practise a battle.</p><div class="journey-summary"><span><b>${completed} / 20</b>Far Shore missions</span><span><b>${(C.masteries||[]).filter(m=>S.flags[m.flag]).length} / 6</b>Mastery skills</span><span><b>${Object.keys(S.bestiary||{}).length}</b>Enemies recorded</span></div><div class="panel-grid kit-grid">`;
  for(const [name,copy,go]of [
   ['The Far Shore','Find Keva at the Sunken Chart House in the Age of Bells. The first descent opens in Chapter 2.',()=>ui.open('journal',{tab:'depths',era:S.flags.depth_tide_complete?a.world.zone.era:'bell642'})],
   ['Workshop','Use recovered materials to make weapons, armour, and supplies.',()=>ui.open('craft')],
   ['Mastery trials','Six trials teach new techniques. Repeat a trial to improve your result.',()=>ui.open('trials')],
   ['Learned techniques','Review field abilities, mastery skills, and new team moves.',()=>ui.open('mastery')],
   ['Bestiary','Review enemy weaknesses, guards, and attack patterns.',()=>ui.open('bestiary')],
   ['Dungeon charts','See rooms, locked routes, and your next destination.',()=>ui.open('dungeon')]
  ])h+=`<article class="panel-card"><h3>${name}</h3><p>${copy}</p>${button('Open '+name.toLowerCase(),go,{primary:name==='The Far Shore'})}</article>`;
  h+='</div><p class="footer-note">Rest at a camp or shrine to restore all HP and MP. The kit is available with K outside battle. Field work uses any recruited traveller and costs no MP.</p>';
 }else if(type==='craft'){
  out.title='The shared workshop';out.kicker=`CRAFTING · ${S.gold} CROWNS`;const tab=arg?.tab||'gear';
  h='<div class="panel-tabs">'+['gear','supplies'].map(id=>button(id==='gear'?'Weapons and equipment':'Travel supplies',()=>ui.open('craft',{tab:id}),{cls:'era-tab'+(tab===id?' active':'')})).join('')+'</div><p>Choose a recipe. Materials and crowns are spent only when the item is made. Weapons must then be equipped from the Party panel.</p>';
  for(const r of C.recipes.filter(r=>tab==='supplies'?C.items[r.item].kind==='consumable':C.items[r.item].kind!=='consumable')){
   const item=C.items[r.item],check=a.canCraft(r.id),known=a.meets(r.requires);
   h+=`<article class="recipe-card ${known?'':'locked'}"><div class="recipe-copy"><span class="eyebrow">${item.hero?esc(C.heroes[item.hero].name)+' · ':''}${esc(item.kind)}${S.crafts[r.id]?' · MADE '+S.crafts[r.id]:''}</span><h3>${esc(item.name)}${r.count>1?' × '+r.count:''}</h3><p>${esc(item.description)}</p><div>${stats(item.stats)}</div><div class="recipe-cost">${Object.entries(r.ingredients).map(([id,n])=>`<span class="${(S.inventory[id]||0)>=n?'ready':'missing'}">${esc(C.items[id].name)} ${S.inventory[id]||0}/${n}</span>`).join('')}<span class="${S.gold>=(a.craftCost?.(r)??r.cost)?'ready':'missing'}">${a.craftCost?.(r)??r.cost} crowns</span></div>${known?'':'<small>'+esc(requirement(a,r.requires))+'</small>'}</div>${button('Make',()=>{a.craft(r.id);refresh(ui,'craft',{tab});},{disabled:!check.ok,primary:check.ok})}</article>`;
  }
  out.footer=button('Buy materials',()=>ui.open('materials'))+button('Equip items',()=>ui.open('party'))+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='materials'){
  out.title='The common stores';out.kicker=`MATERIALS · ${S.gold} CROWNS`;h='<p>Dungeons contain materials. After you secure a regional anchor, its workers can also sell stock here.</p>';
  for(const m of C.materialSources){const it=C.items[m.id],open=a.meets(m.requires);h+=`<div class="inventory-row"><div class="item-copy"><h3>${esc(it.name)} <small>× ${S.inventory[m.id]||0}</small></h3><p>${esc(it.description)}</p><small>${open?m.price+' crowns each':esc(requirement(a,m.requires))}</small></div>${button('Buy one',()=>{a.buyMaterial(m.id);refresh(ui,'materials');},{disabled:!open||S.gold<m.price})}</div>`;}
  out.footer=button('Back to workshop',()=>ui.open('craft'),{primary:true});
 }else if(type==='bestiary'){
  out.title='A record of our opponents';out.kicker='BESTIARY';const boss=arg?.boss||false,known=Object.entries(S.bestiary||{}).filter(([id])=>C.enemies[id]&&(!boss||C.enemies[id].boss));
  h='<div class="panel-tabs">'+button('All seen enemies',()=>ui.open('bestiary'),{cls:'era-tab'+(!boss?' active':'')})+button('Guardians',()=>ui.open('bestiary',{boss:true}),{cls:'era-tab'+(boss?' active':'')})+'</div><p>Enemies enter this record when a battle begins. Trial strength adjusts to the party. The weaknesses and patterns below describe each enemy before a phase change.</p>';
  if(!known.length)h+='<p>No opponents are recorded in this view. Enter a battle to begin the record.</p>';
  for(const [id,entry]of known.sort((a,b)=>C.enemies[a[0]].name.localeCompare(C.enemies[b[0]].name))){const e=C.enemies[id],pattern=e.pattern?.map(s=>typeof s==='string'?(C.skills[s]?.name||s):s.name||s.id||'Attack').filter(Boolean)||[];h+=`<article class="codex-card"><div><span class="eyebrow">${e.boss?'GUARDIAN':'OPPONENT'} · SEEN ${entry.seen} · DEFEATED ${entry.defeated}</span><h3>${esc(e.name)}</h3></div>${e.description||e.lore?'<p>'+esc(e.description||e.lore)+'</p>':''}<div class="codex-facts"><span><b>Weakness</b>${esc(e.weak?.join(', ')||'None')}</span><span><b>Resistance</b>${esc(e.resist?.join(', ')||'None')}</span><span><b>Pressure limit</b>${e.staggerMax||'No break meter'}</span></div>${pattern.length?'<p><strong>Attack cycle:</strong> '+esc(pattern.join(' → '))+'</p>':''}${e.guardedBy?'<p>Remove its protecting ally to stop the ward.</p>':''}${e.phases?.length?'<p>Its pattern changes as its HP falls. Check the live battle notice.</p>':''}</article>`;}
 }else if(type==='mastery'){
  out.title='What the travellers have learned';out.kicker='FIELD ABILITIES · MASTERY · TEAM MOVES';h='<h3>Field abilities</h3><p>At a marked object, press E. The traveller can help if they have joined the party. You do not need to change the active battle team.</p><div class="panel-grid">';
  for(const [id,v]of Object.entries(D.Journey.abilities))h+=`<div class="panel-card"><span class="eyebrow">${esc(C.heroes[v.hero].name)} · ${S.roster[v.hero]?'READY':'NOT RECRUITED'}</span><h3>${esc(v.name)}</h3><p>${esc(v.description)}</p></div>`;
  h+='</div><h3>Mastery techniques</h3>';
  for(const m of C.masteries||[]){const skill=C.skills[m.skill],learned=!!S.flags[m.flag];h+=`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">${esc(C.heroes[m.hero].name)} · ${learned?'LEARNED':'TRIAL REWARD'}</span><h3>${esc(skill?.name||m.name)}</h3><p>${esc(skill?.description||m.description)}</p><small>${skill?.cost||0} MP${skill?.stagger?' · '+skill.stagger+' pressure':''}</small></div></div>`;}
  h+='<h3>New team moves</h3>';for(const skill of Object.values(C.skills).filter(s=>s.unlockFlags?.length)){const learned=skill.unlockFlags.every(f=>S.flags[f]);h+=`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">${learned?'LEARNED':'COMPLETE BOTH MASTERY TRIALS'}</span><h3>${esc(skill.name)}</h3><p>${esc(skill.description)}</p><small>${esc(skill.combo.map(id=>C.heroes[id].name).join(' + '))}</small></div></div>`;}
  out.footer=button('Open mastery trials',()=>ui.open('trials'),{primary:true})+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='trials'){
  out.title='The travellers’ trials';out.kicker='SIX CHALLENGES · GROWING OPPONENTS';
  h='<p>These memory battles match the party level. The party starts each trial with full HP and MP and no Bond. First victory teaches a mastery skill and grants its listed rewards. Later victories record your best time and turns.</p><details class="battle-guide"><summary>How to break an enemy attack</summary><p>Weakness hits and pressure techniques fill the gold meter. A full meter stops the enemy attack and opens a short damage window. The enemy then recovers its balance. Remove a ward ally first. Use a dispel technique against guard, haste, or regeneration.</p></details><div class="trial-list">';
  for(const t of C.eliteTrials||[]){const status=a.trialStatus(t.id),v=S.trials[t.id],known=!!S.flags[t.completeFlag],m=(C.masteries||[]).find(m=>m.hero===t.hero);h+=`<article class="trial-card"><span class="eyebrow">${known?'CLEARED':'FIRST VICTORY'} · LEVEL ${t.minLevel}+</span><h3>${esc(t.name)}</h3><p>${esc(t.rule)}</p><p class="mission-reward">${esc(typeof t.reward==='string'?t.reward:m?C.heroes[m.hero].name+' learns '+C.skills[m.skill].name:'Mastery reward')}</p>${t.suggestedParty?'<small>Suggested party: '+esc(t.suggestedParty.map(id=>C.heroes[id]?.name||id).join(', '))+'</small>':''}${v?`<div class="trial-result">${v.wins} wins · Best time ${v.bestSeconds.toFixed(1)} s · Best turns ${v.bestTurns}</div>`:''}${!status.ok?'<p class="footer-note">'+esc(status.reason)+'</p>':''}${button(known?'Repeat trial':'Begin trial',()=>a.startTrial(t.id),{disabled:!status.ok,primary:status.ok})}</article>`;}
  h+='</div>';out.footer=button('Mastery techniques',()=>ui.open('mastery'))+button('Party and equipment',()=>ui.open('party'))+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='dungeon'){
  const d=C.dungeons?.find(d=>d.id===arg?.id)||a.dungeon()||C.dungeons?.[0];out.title=d?.name||'Dungeon charts';out.kicker='THE FAR SHORE · ROOM ROUTES';
  if(!d)h='<p>No dungeon charts are available.</p>';else{
   h='<div class="panel-tabs">'+C.dungeons.map(v=>button(v.name,()=>ui.open('dungeon',{id:v.id}),{cls:'era-tab'+(v.id===d.id?' active':'')})).join('')+'</div><p>'+esc(d.description||'Follow the rooms to the anchor.')+'</p>'+dungeonSVG(a,d)+`<p class="footer-note">Gold fill: your room. Gold ring: destination. Dotted line: locked route. ${d.rooms.filter(id=>S.visited.includes(id)).length} / ${d.rooms.length} rooms visited.</p>`;
   for(const [i,id]of d.rooms.entries()){const z=C.zoneById[id];h+=`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">ROOM ${i+1} · ${S.visited.includes(id)?'VISITED':'UNEXPLORED'}</span><h3>${esc(z.name)}</h3><small>${esc(z.description||'')}</small></div>${button(id===a.destination()?'Marked':'Mark route',()=>{a.markDestination(id);ui.open('dungeon',{id:d.id});},{disabled:id===a.destination(),primary:id!==a.destination()})}</div>`;}
   out.footer=button('Story missions',()=>ui.open('journal',{tab:'depths',era:d.era}))+button('World atlas',()=>ui.open('map',{era:d.era}));
   if(a.dungeon())out.footer+=button('Leave dungeon',()=>a.enterOverworld());
  }
 }else if(type==='mechanism'){
  const e=arg,p=e?.puzzle;if(!e||!p)return null;out.title=e.name||'A mechanism';out.kicker={circuit:'CIRCUIT · LINKED SWITCHES',sluice:'SLUICE · SHARED WATER',mirror:'MIRRORS · FOUR DIRECTIONS'}[p.kind];
  const values=a.mechanismValues(e),solved=D.Journey.Puzzle.solved(p,values);h='<p class="mechanism-clue">'+esc(e.hint||e.description||'Read the marks beside the mechanism.')+'</p>';
  if(p.kind==='circuit'){
   h+='<p>Each switch changes itself and its four neighbours. Turn all lights off, then test the circuit.</p><div class="circuit-board" style="--grid-size:'+(p.size||3)+'">';
   values.forEach((v,i)=>h+=button((i+1)+' · '+(v?'On':'Off'),()=>{a.changeMechanism(e.id,i);refresh(ui,'mechanism',e);},{cls:'circuit-cell'+(v?' lit':'')}));h+='</div>';
  }else if(p.kind==='sluice'){
   h+=`<p>Divide ${p.total||6} water units between the three channels. You can change one channel without resetting the others.</p><p class="sluice-total">${values.reduce((s,n)=>s+n,0)} / ${p.total||6} units assigned</p><div class="sluice-board">`;
   values.forEach((v,i)=>h+=`<div class="sluice-channel"><h3>${esc(p.labels?.[i]||'Channel '+(i+1))}</h3><div class="water-column"><i style="height:${100*v/(p.capacity||6)}%"></i><b>${v}</b></div><div class="buttons">${button('−',()=>{a.changeMechanism(e.id,i,-1);refresh(ui,'mechanism',e);},{disabled:v===0})}${button('+',()=>{a.changeMechanism(e.id,i,1);refresh(ui,'mechanism',e);},{disabled:values.reduce((s,n)=>s+n,0)>=(p.total||6)})}</div></div>`);h+='</div>';
  }else{
   h+='<p>Turn each mirror toward the direction in the clue. The top of the chart is north.</p><div class="mirror-board">';values.forEach((v,i)=>h+=`<div class="mirror-cell"><h3>${esc(p.labels?.[i]||'Mirror '+(i+1))}</h3>${button(['↑ North','→ East','↓ South','← West'][v],()=>{a.changeMechanism(e.id,i);refresh(ui,'mechanism',e);},{cls:'mirror-turn'})}</div>`);h+='</div>';
  }
  h+=`<p class="mechanism-status" role="status">${solved?'The parts are aligned. Test the mechanism to open the route.':'The mechanism is not aligned yet.'}</p><p class="footer-note">Your settings are saved. You can leave and return.</p>`;
  out.footer=button('Test mechanism',()=>{a.solveMechanism(e.id);if(a.panel)refresh(ui,'mechanism',e);},{primary:true})+button('Reset puzzle',()=>{a.resetMechanism(e.id);refresh(ui,'mechanism',e);})+button('Leave for now',()=>ui.close());
 }
 out.html=h;if(!out.footer)out.footer=button('Journey kit',()=>ui.open('camp'))+button('Back to the journey',()=>ui.close(),{primary:true});return out;
};
})();
