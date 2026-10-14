/* Readable quest, record, inventory, and equipment panels for the existing UI shell. */
(() => {
'use strict';
const D=globalThis.Dawn;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleCase=s=>String(s).replace(/(^|[_-])([a-z])/g,(_,space,letter)=>(space?' ':'')+letter.toUpperCase());
const campaignName=m=>({small:'The Small Hours',hearth:'Hearthbound',depths:'The Far Shore'}[m.campaign]||'The Open Roads');
const refresh=(ui,type,arg)=>ui.open(type,arg);
const statTags=changes=>changes.filter(s=>s.delta).map(s=>'<span class="stat-change '+(s.delta>0?'gain':'loss')+'">'+esc(s.label)+' '+(s.delta>0?'+':'')+s.delta+'</span>').join('')||'<span class="stat-change">No stat change</span>';

D.smallHoursPanel=(ui,type,arg)=>{
  if(!['nearby','field-notes','delivery','equip','use','bag'].includes(type))return null;
  const a=ui.app,C=a.content,S=a.state;if(!S)return null;
  const button=(...v)=>ui.action(...v),out={title:'',kicker:'THE SMALL HOURS',html:'',footer:''};let h='';
  if(type==='nearby'){
    out.title='Work along the road';out.kicker=a.world.zone.name.toUpperCase();
    const scope=arg?.scope||'here',rows=a.nearbyTasks(scope),step=a.objective(),route=a.routePlan(a.destination()),target=a.objectiveEntity(),marked=S.atlasDestination&&S.atlasDestination!==step.zone;
    h='<div class="route-guide"><span class="eyebrow">'+(marked?'MARKED ROUTE':'CURRENT TASK')+'</span><h3>'+esc(marked?C.zoneById[a.destination()].name:step.text)+'</h3><p>'+esc(marked?'Story task: '+step.text:C.zoneById[step.zone]?.name||'Follow the journal')+'</p>';
    if(a.destination()!==S.zone&&route?.length)h+='<p>Next: '+esc(route[0].name)+' · '+route.length+' '+(route.length===1?'crossing':'crossings')+' to '+esc(C.zoneById[a.destination()].name)+'.</p>';
    h+=button(a.destination()===S.zone?marked?'You have arrived':'Walk to the next task':'Walk to the next exit',()=>a.walkToObjective(),{primary:true,disabled:!!a.expeditionActive?.()||(a.destination()===S.zone?marked||!target:!route?.length)})+button('Open atlas',()=>ui.open('map',{era:C.zoneById[a.destination()]?.era}));
    if(marked)h+=button('Follow the story task',()=>{a.trackMission(S.trackedMission||null);refresh(ui,'nearby',{scope});});h+='</div>';
    h+='<div class="panel-tabs">';
    for(const [id,name]of [['here','This place'],['age','This age'],['all','All open ages']])h+=button(name,()=>refresh(ui,'nearby',{scope:id}),{cls:'era-tab'+(scope===id?' active':'')});
    h+='</div><p>'+rows.length+' open '+(rows.length===1?'side mission':'side missions')+'. Active work comes first. Completed and locked missions remain in the Journal.</p>';
    if(!rows.length)h+='<div class="empty-state"><h3>No open side work here</h3><p>Check this age, follow the main story, or read a note along the path.</p></div>';
    for(const {mission:m,status,step:s}of rows){
      const tracked=S.trackedMission===m.id,here=s.zone===S.zone;
      h+='<article class="mission-row '+(tracked?'tracked':'')+'"><div class="mission-heading"><span class="eyebrow">'+esc(campaignName(m))+'</span><span>'+esc(tracked?'TRACKED':status.toUpperCase())+'</span></div><h3>'+esc(m.name)+'</h3><p>'+esc(s.text)+'</p><p class="footer-note">'+esc(C.zoneById[s.zone].name)+'</p><div class="mission-actions">';
      h+=button(tracked?'Following this mission':'Track mission',()=>{a.trackMission(m.id);refresh(ui,'nearby',{scope});},{primary:!tracked,disabled:tracked});
      h+=button(here?'Walk to task':'Show on atlas',()=>{a.trackMission(m.id);if(here)a.walkToObjective();else ui.open('map',{era:C.zoneById[s.zone].era});},{disabled:!!a.expeditionActive?.()});
      h+='</div></article>';
    }
    const services=a.world.interactables(a).filter(e=>['note','delivery','shop','shrine','camp','craft','cook','forage','project'].includes(e.type)&&a.meets(e.requires));
    if(services.length){h+='<h3>Useful places nearby</h3><div class="nearby-services">';for(const e of services){const state=a.entityObjectiveState(e);h+='<div class="service-row"><div><strong>'+esc(e.name||titleCase(e.type))+'</strong><small>'+esc(state.label||titleCase(e.type))+'</small></div>'+button('Walk there',()=>a.walkToEntity(e.id),{disabled:!!a.expeditionActive?.()})+'</div>';}h+='</div>';}
    out.footer=button('Small Hours stories',()=>ui.open('journal',{tab:'small',era:a.world.zone.era}))+button('Field notes',()=>ui.open('field-notes'))+button('Journey kit',()=>ui.open('camp'));
  }else if(type==='field-notes'){
    const notes=C.fieldNotes||[],read=notes.filter(n=>S.flags[n.flag]).length,era=arg?.era||a.world.zone.era;
    out.title='Notes from ordinary lives';out.kicker=read+' / '+notes.length+' NOTES RECORDED';
    h='<p>Read a note in the world to keep it here. Recorded notes can be read again at any time outside a battle or expedition. Some hold clues for side missions.</p><div class="panel-tabs">';
    for(const e of C.eras)h+=button(e.name,()=>refresh(ui,'field-notes',{era:e.id}),{cls:'era-tab'+(e.id===era?' active':'')});h+='</div><div class="panel-grid note-grid">';
    for(const n of notes.filter(n=>C.zoneById[n.zone].era===era)){
      const known=!!S.flags[n.flag],found=S.visited.includes(n.zone),here=n.zone===S.zone,e=D.SmallHours.index().rows.find(e=>e.type==='note'&&e.record===n.id),available=e&&a.meets(n.requires)&&a.meets(e.requires)&&!(e.hideIf&&a.meets(e.hideIf));
      h+='<article class="panel-card field-note '+(known?'recorded':'')+'"><span class="eyebrow">'+(known?'RECORDED':'UNREAD')+'</span><h3>'+esc(known?n.name:'A note in '+C.zoneById[n.zone].name)+'</h3><p>'+esc(known?n.lines[0]:!available?'This page appears during its Small Hours story. Check the journal for the earlier steps.':found?'You have visited this place. Look for a small book marker.':'Follow the story to this place, then look for a small book marker.')+'</p>';
      if(known)h+=button('Read the note',()=>a.readFieldNote(n.id),{disabled:!!a.expeditionActive?.()});
      else if(!available)h+=button('Find the story step',()=>ui.open('journal',{tab:'small',era}));
      else h+=button(here?'Walk to the note':'Show on atlas',()=>{if(here&&e)a.walkToEntity(e.id);else{a.markDestination(n.zone);ui.open('map',{era});}},{disabled:!a.mapAccess(era)||!!a.expeditionActive?.()});
      h+='</article>';
    }
    h+='</div>';out.footer=button('Nearby work',()=>ui.open('nearby'))+button('Journey kit',()=>ui.open('camp'));
  }else if(type==='delivery'){
    const q=a.deliveryStatus(arg?.id||arg),e=q.entity;
    out.title=e?.name||'A delivery';out.kicker='CHECK THE WHOLE DELIVERY';
    h='<p>'+esc(e?.description||'Hand over the listed items to complete this story step. All costs are checked before anything leaves your bag.')+'</p><div class="delivery-list">';
    for(const it of q.items)h+='<div class="delivery-row '+(it.owned>=it.amount?'ready':'missing')+'"><span>'+esc(it.name)+'</span><b>'+it.owned+' / '+it.amount+'</b></div>';
    if(q.gold)h+='<div class="delivery-row '+(S.gold>=q.gold?'ready':'missing')+'"><span>Crowns</span><b>'+S.gold+' / '+q.gold+'</b></div>';
    h+='</div><p class="footer-note">'+esc(q.reason||'Everything is ready. The listed items will be used.')+'</p>';
    if(e?.rewardText)h+='<p class="mission-reward">'+esc(e.rewardText)+'</p>';
    out.footer=button('Hand over the delivery',()=>a.completeDelivery(e.id),{primary:true,disabled:!q.ok})+button('Keep the items for now',()=>ui.close());
  }else if(type==='equip'){
    const hero=arg?.hero,slot=arg?.slot,s=a.stats(hero);if(!s)return null;
    out.title='Choose '+slot;out.kicker=C.heroes[hero].name.toUpperCase()+' · COMPARE BEFORE EQUIPPING';
    const current=s.equipment[slot],items=Object.values(C.items).filter(it=>(it.slot||it.kind)===slot&&(!it.hero||it.hero===hero)&&(S.inventory[it.id]>0||it.id===current)).sort((x,y)=>Number(y.id===current)-Number(x.id===current)||x.name.localeCompare(y.name));
    h='<div class="equipment-current"><span class="eyebrow">CURRENT ITEM</span><h3>'+esc(C.items[current]?.name||'No item equipped')+'</h3><p>Changes below include your current level, town, and meal bonuses. Equipping does not heal the party.</p></div>';
    if(!items.length)h+='<p>No suitable item is in the bag. Visit a shop or search for treasure.</p>';
    for(const item of items){const q=a.equipmentPreview(hero,item.id),equipped=item.id===current;
      h+='<article class="equipment-option '+(equipped?'current':'')+'"><div><span class="eyebrow">'+(equipped?'EQUIPPED':'IN BAG · '+S.inventory[item.id])+'</span><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="stat-changes">'+statTags(q.changes)+'</div><details><summary>Full stat comparison</summary><table class="compare-table"><thead><tr><th>Stat</th><th>Now</th><th>With item</th></tr></thead><tbody>'+q.changes.map(v=>'<tr><th>'+esc(v.label)+'</th><td>'+v.before+'</td><td>'+v.after+'</td></tr>').join('')+'</tbody></table></details></div>'+button(equipped?'Equipped':'Equip',()=>{a.equip(hero,item.id);ui.open('hero',hero);},{primary:!equipped,disabled:!q.ok})+'</article>';
    }
    const empty=a.equipmentPreview(hero,null,slot);
    if(current)h+='<div class="unequip-preview"><b>If removed:</b> '+statTags(empty.changes)+'</div>';
    out.footer=button('Back to traveller',()=>ui.open('hero',hero))+button('Unequip',()=>{a.equip(hero,null,slot);ui.open('hero',hero);},{disabled:!empty.ok});
  }else if(type==='use'){
    const item=C.items[arg?.item];if(!item)return null;out.title='Use '+item.name;out.kicker='RECOVERY PREVIEW';
    h='<p>Choose a traveller. A supply stays in the bag if it would restore nothing.</p><div class="panel-grid">';
    for(const id of Object.keys(S.roster)){const s=a.stats(id),q=a.fieldItemStatus(item.id,id);
      h+='<article class="panel-card"><div class="hero-header">'+ui.portraitHTML(id)+'<h3>'+esc(s.name)+'</h3></div><p>'+s.hp+' / '+s.maxHp+' HP<br>'+s.mp+' / '+s.maxMp+' MP</p><p>'+esc(q.ok?[q.hp?'Restore '+q.hp+' HP':'',q.mp?'Restore '+q.mp+' MP':''].filter(Boolean).join(' · '):q.reason)+'</p>'+button('Use on '+s.name,()=>{a.useFieldItem(item.id,id);ui.open('bag',{filter:'supplies'});},{disabled:!q.ok,primary:q.ok})+'</article>';
    }
    h+='</div>';out.footer=button('Back to the bag',()=>ui.open('bag',{filter:'supplies'}));
  }else if(type==='bag'){
    const category=it=>it.kind==='consumable'?'supplies':it.kind==='meal'?'meals':['weapon','armor','accessory'].includes(it.slot||it.kind)?'gear':it.kind==='material'?'materials':'story';
    const filter=arg?.filter||ui.bagFilter||'all';ui.bagFilter=filter;
    const owned=Object.values(C.items).filter(it=>S.inventory[it.id]>0),items=owned.filter(it=>filter==='all'||category(it)===filter).sort((a,b)=>a.name.localeCompare(b.name));
    out.title='Everything we carry';out.kicker=S.gold+' CROWNS · '+owned.length+' ITEM TYPES';h='<div class="panel-tabs inventory-tabs">';
    for(const [id,name]of [['all','All'],['supplies','Supplies'],['meals','Meals'],['gear','Equipment'],['materials','Materials'],['story','Story items']])h+=button(name,()=>ui.open('bag',{filter:id}),{cls:'era-tab'+(id===filter?' active':'')});h+='</div>';
    if(!items.length)h+='<div class="empty-state"><p>No items in this group.</p></div>';
    for(const it of items){h+='<div class="inventory-row"><div class="item-copy"><span class="eyebrow">'+esc(titleCase(category(it)))+'</span><h3>'+esc(it.name)+' <small>× '+S.inventory[it.id]+'</small></h3><p>'+esc(it.description)+'</p></div>';
      if(it.kind==='meal')h+=button('Share meal',()=>{a.eatMeal(it.id);ui.open('bag',{filter});},{disabled:a.hearthBusy()});
      else if(it.kind==='consumable')h+=button('Use',()=>ui.open('use',{item:it.id}),{disabled:!Object.keys(S.roster).some(id=>a.fieldItemStatus(it.id,id).ok)});
      h+='</div>';
    }
    out.footer=button('Party and equipment',()=>ui.open('party'))+button('Cookbook',()=>ui.open('cookbook'))+button('Journey kit',()=>ui.open('camp'));
  }
  out.html=h;if(!out.footer)out.footer=button('Return to the road',()=>ui.close(),{primary:true});return out;
};
})();
