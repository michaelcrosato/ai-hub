/* Hearthbound panels use the existing keyboard, controller, and touch panel shell. */
(() => {
'use strict';
const D=globalThis.Dawn,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statNames={maxHp:'HP',maxMp:'MP',atk:'Attack',mag:'Magic',def:'Defence',speed:'Speed'};
const statTags=s=>Object.entries(s).map(([k,v])=>`<span class="tag">${esc(statNames[k]||k)} +${v}</span>`).join('');
const refresh=(ui,type,arg)=>{const focus=ui.dom?document.activeElement?.dataset?.action:null;ui.open(type,arg);if(focus&&ui.dom)ui.el('panel')?.querySelector(`[data-action="${focus}"]`)?.focus({preventScroll:true});};
const needs=(a,r)=>r?.flags?.map(f=>{const p=a.content.projects.find(p=>f.startsWith('project_'+p.id));return p?p.name+' stage 1':f==='hearthbound_complete'?'The Hearthbound Roads finale':'the listed story step';}).join(' and ')||'Chapter '+(r?.chapterAtLeast||2);
D.hearthPanel=(ui,type,arg)=>{
 if(!['camp','projects','cookbook','loadouts','gathering'].includes(type))return null;
 const a=ui.app,C=a.content,S=a.state;if(!S)return null;
 const button=(...v)=>ui.action(...v),out={title:'',kicker:'THE HEARTHBOUND ROADS',html:'',footer:''};let h='';
 const goHaven=()=>{a.markDestination(C.hearth.startZone);ui.open('map',{era:'bell642'});};
 if(type==='camp'){
   out.title='The journey kit';out.kicker='STORY · THE TOWN · THE NEXT ROAD';
   const built=C.projects.reduce((n,p)=>n+a.projectLevel(p.id),0),done=C.missions.filter(m=>m.campaign==='hearth'&&S.flags[m.completeFlag]).length,meal=S.hearth.meal;
   h=`<p>A place to prepare, then a road to follow. Find Wayfarer Haven in the Age of Bells from Chapter 2.</p><div class="journey-summary"><span><b>${done} / 22</b>Hearthbound missions</span><span><b>${built} / 12</b>Town stages</span><span><b>${Object.values(S.expeditions?.records||{}).filter(v=>v.clears>0||v.wins>0).length} / 6</b>Expedition routes cleared</span></div>`;
   if(meal)h+=`<div class="hearth-meal"><span class="eyebrow">SHARED MEAL</span><h3>${esc(C.items[meal.id].name)}</h3><p>${meal.remaining} ${meal.remaining===1?'victory':'victories'} left · ${statTags(C.meals.find(m=>m.id===meal.id).stats)}</p></div>`;
   if(a.expeditionActive?.())h+='<div class="mission-next"><p>An expedition is in progress. Resume at its checkpoint, or bank what you have earned before changing equipment or cooking.</p>'+button('Resume expedition',()=>ui.open('expedition'),{primary:true})+'</div>';
   h+='<div class="panel-grid kit-grid">';
   for(const [name,copy,go]of [
     ['The Small Hours','Eighteen side stories return to people you met along the main road.',()=>ui.open('journal',{tab:'small',era:a.world.zone.era})],
     ['Nearby work','Find open side missions, useful places, and the next route.',()=>ui.open('nearby')],
     ['Field notes','Keep clues and small stories found across the ages.',()=>ui.open('field-notes')],
     ['Trial medals','Meet eighteen tactical goals in the six mastery trials.',()=>ui.open('trial-medals')],
     ['The Hearthbound Roads','Six personal stories, a changing town, and one debt that binds them.',()=>ui.open('journal',{tab:'hearth',era:'bell642'})],
     ['Wayfarer Haven','Build six projects in two stages. Their benefits follow the party.',()=>ui.open('projects')],
     ['Expeditions','Six repeatable five-stage routes. Choose boons, take risks, and bank rewards.',()=>ui.open(a.expeditionActive?.()?'expedition':'expeditions')],
     ['Cookbook','Gather ingredients and share a party bonus for the next three victories.',()=>ui.open('cookbook')],
     ['Party loadouts','Keep three complete party and equipment sets, then switch between them.',()=>ui.open('loadouts')],
     ['Gathering paths','Find grain, fruit, and herbs. Patches grow again after victories.',()=>ui.open('gathering')],
     ['The Far Shore','Five connected dungeons, room puzzles, and field work for all six travellers.',()=>ui.open('journal',{tab:'depths',era:'bell642'})],
     ['Workshop','Make weapons, armour, and supplies from recovered materials.',()=>ui.open('craft')],
     ['Mastery trials','Six trials teach new techniques and record your best result.',()=>ui.open('trials')],
     ['Learned techniques','Review field abilities, mastery skills, and team moves.',()=>ui.open('mastery')],
     ['Bestiary','Review known enemy weaknesses, guards, and attack patterns.',()=>ui.open('bestiary')],
     ['Dungeon charts','View connected rooms and the next door on a tracked route.',()=>ui.open('dungeon')]
   ])h+=`<article class="panel-card"><h3>${name}</h3><p>${copy}</p>${button('Open '+name.toLowerCase(),go,{primary:name==='The Hearthbound Roads'})}</article>`;
   h+='</div><p class="footer-note">K opens the kit outside battle. A camp or shrine restores HP and MP. Opening the kit on the road does not rest the party.</p>';
 }else if(type==='projects'){
   out.title='A town worth returning to';out.kicker=`WAYFARER HAVEN · ${S.inventory.haven_supplies||0} SUPPLIES · ${S.gold} CROWNS`;
   h='<p>Build with the supplies found in Hearthbound missions and expeditions. The first stages also help complete the six character stories. Each second stage opens after that traveller’s story and Chapter 4.</p>';
   h+=button('Show Haven on the atlas',goHaven)+`<div class="panel-grid project-grid">`;
   const projects=arg?.id?[...C.projects].sort((x,y)=>Number(y.id===arg.id)-Number(x.id===arg.id)):C.projects;
   for(const p of projects){const q=a.projectStatus(p.id),lv=q.level;
     h+=`<article class="panel-card project-card ${lv===2?'complete':''}"><div class="hero-header">${ui.portraitHTML(p.hero)}<div><span class="eyebrow">${esc(C.heroes[p.hero].name)} · ${lv} / 2 STAGES</span><h3>${esc(p.name)}</h3></div></div><p>${esc(p.description)}</p><div class="project-stages">${p.benefits.map((b,i)=>`<p class="${lv>i?'built':''}"><b>${lv>i?'✓':'◇'} Stage ${i+1}</b><br>${esc(b)}</p>`).join('')}</div>`;
     h+=lv===2?`<p class="mission-reward">${esc(p.finished)}</p>`:`<p class="recipe-cost">${q.supplies} Haven Supplies · ${q.cost} crowns</p>${q.ok?'':`<p class="footer-note">${esc(q.reason)}</p>`}${button('Build stage '+q.next,()=>{a.buildProject(p.id);refresh(ui,'projects',arg);},{primary:q.ok,disabled:!q.ok})}`;
     h+='</article>';
   }h+='</div>';
   out.footer=button('Character stories',()=>ui.open('journal',{tab:'hearth',era:'bell642'}))+button('Expeditions',()=>ui.open('expeditions'))+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='cookbook'){
   out.title='The travelling table';out.kicker=`COOKBOOK · ${S.gold} CROWNS`;
   h='<p>Cook a meal, then eat it to give the whole party its bonus for three victories. One meal can be active. A new meal replaces the current one. Battle losses do not spend its duration. Meals cannot be eaten during an expedition.</p>';
   const active=S.hearth.meal;if(active)h+=`<div class="hearth-meal"><span class="eyebrow">AT THE TABLE</span><h3>${esc(C.items[active.id].name)}</h3><p>${active.remaining} victories remain.</p>${statTags(C.meals.find(m=>m.id===active.id).stats)}</div>`;
   h+='<div class="ingredient-shelf">'+['ingredient_grain','ingredient_fruit','ingredient_herb'].map(id=>`<span>${esc(C.items[id].name)}<b>${S.inventory[id]||0}</b></span>`).join('')+'</div><div class="panel-grid">';
   for(const m of C.meals){const q=a.mealStatus(m.id),known=a.meets(m.requires),owned=S.inventory[m.id]||0;
     h+=`<article class="panel-card ${known?'':'locked'}"><span class="eyebrow">${known?'RECIPE KNOWN':'LEARN AT '+esc(needs(a,m.requires))} · ${owned} READY</span><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p><div>${statTags(m.stats)}</div><div class="recipe-cost">${Object.entries(m.ingredients).map(([id,n])=>`<span class="${(S.inventory[id]||0)>=n?'ready':'missing'}">${esc(C.items[id].name)} ${S.inventory[id]||0}/${n}</span>`).join('')}<span>${m.cost} crowns</span></div><div class="buttons">${button('Cook',()=>{a.cookMeal(m.id);refresh(ui,'cookbook');},{disabled:!q.ok,primary:q.ok})}${button('Share meal',()=>{a.eatMeal(m.id);refresh(ui,'cookbook');},{disabled:!owned||a.hearthBusy()})}</div></article>`;
   }h+='</div>';out.footer=button('Find ingredients',()=>ui.open('gathering'))+button('Town projects',()=>ui.open('projects'))+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='loadouts'){
   out.title='Three ways to travel';out.kicker='PARTY AND EQUIPMENT LOADOUTS';
   h='<p>A loadout keeps the active party and all equipped items. Saving a slot replaces its previous set. Applying a set moves only equipment you still own. If an item is missing, the whole set stays as it is.</p><div class="panel-grid loadout-grid">';
   for(let i=0;i<3;i++){const v=S.hearth.loadouts[i],q=a.loadoutStatus(i);
     h+=`<article class="panel-card"><span class="eyebrow">SLOT ${i+1}</span><h3>${v?v.active.map(id=>esc(C.heroes[id].name)).join(' · '):'An open road'}</h3>`;
     if(v){h+='<div class="loadout-faces">'+v.active.map(id=>ui.portraitHTML(id)).join('')+'</div><details><summary>Equipment in this set</summary>'+Object.entries(v.equipment).map(([id,e])=>`<p><b>${esc(C.heroes[id].name)}</b><br>${Object.values(e).filter(Boolean).map(item=>esc(C.items[item].name)).join(' · ')||'No equipment'}</p>`).join('')+'</details>';if(!q.ok)h+=`<p class="footer-note">${esc(q.reason)}</p>`;}else h+='<p>Save the current party and equipment here.</p>';
     h+=`<div class="buttons">${button(v?'Replace with current party':'Save current party',()=>{a.saveLoadout(i);refresh(ui,'loadouts');},{disabled:a.hearthBusy()})}${button('Apply set',()=>{a.applyLoadout(i);refresh(ui,'loadouts');},{disabled:!q.ok,primary:q.ok})}</div></article>`;
   }h+='</div>';out.footer=button('Change party and gear',()=>ui.open('party'))+button('Cook before departure',()=>ui.open('cookbook'))+button('Journey kit',()=>ui.open('camp'));
 }else if(type==='gathering'){
   out.title='Food along the road';out.kicker='GRAIN · FRUIT · HERBS';
   h='<p>Walk to a patch and interact to gather. Each patch grows again after two victories, or one with the completed garden. Saving and loading does not regrow a patch. Town missions supply building materials; gathering supplies food.</p>';
   const era=arg?.era||a.world.zone.era;h+='<div class="panel-tabs">'+C.eras.map(e=>button(e.name,()=>ui.open('gathering',{era:e.id}),{cls:'era-tab'+(e.id===era?' active':'')})).join('')+'</div>';
   for(const z of C.zones.filter(z=>z.era===era))for(const e of (z.entities||[]).filter(e=>e.type==='forage')){
     const q=a.harvestStatus(e.id),open=a.meets(z.worldRequires||z.requires)&&a.meets(e.requires),here=z.id===S.zone;
     h+=`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">${esc(z.name)}</span><h3>${esc(e.name)}</h3><p>${q.count} ${esc(C.items[e.ingredient]?.name)} · ${!open?'Follow the story to reach this patch.':q.ready?'Ready to gather':q.remaining+' victories until regrowth'}</p></div>${button(here?'Show the patch':'Show on atlas',()=>{a.markDestination(z.id);if(here){a.walkToEntity(e.id);}else ui.open('map',{era:z.era});},{disabled:!open})}</div>`;
   }
   out.footer=button('Cookbook',()=>ui.open('cookbook'))+button('Garden project',()=>ui.open('projects',{id:'garden'}))+button('Journey kit',()=>ui.open('camp'));
 }
 out.html=h;if(!out.footer)out.footer=button('Back to the journey',()=>ui.close(),{primary:true});return out;
};
})();
