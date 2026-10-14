/* Expedition ledger and camp panels. The shared panel shell owns focus/input. */
(() => {
'use strict';
const D=globalThis.Dawn;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds=n=>Math.floor(n/60)+'m '+Math.round(n%60)+'s';
const pct=(n,d)=>Math.max(0,Math.min(100,100*n/d));
const palette={bell642:'#8fc8bd',seed112:'#b4cf8c',glass1186:'#c7aedc',ash2310:'#e2b581',fold:'#bbc6e0'};
function rewardText(C,reward){
  const list=[];if(reward?.gold)list.push(reward.gold+' crowns');if(reward?.xp)list.push(reward.xp+' XP');
  for(const [id,n]of Object.entries(reward?.items||{}))if(n)list.push(n+' × '+(C.items[id]?.name||id));
  return list.join(' · ')||'No haul yet';
}
function roadChart(route,stage){
  const color=palette[route.era],points=route.stages.map((s,i)=>[49+i*111,50+(i%2?17:0)]);
  let paths='';for(let i=0;i<4;i++){const p=points[i],q=points[i+1];paths+=`<path d="M${p[0]} ${p[1]} Q${(p[0]+q[0])/2} ${15+i%2*70} ${q[0]} ${q[1]}" fill="none" stroke="${i<stage?color:'#435b62'}" stroke-width="4" ${i<stage?'':'stroke-dasharray="6 5"'}/>`;}
  const nodes=points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===Math.min(stage,4)?21:16}" fill="${i<stage?color:'#19363e'}" stroke="${i===stage?'#f4d49a':color}" stroke-width="${i===stage?3:1.5}"/><text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" fill="${i<stage?'#153239':'#ede6cc'}" font-size="15" font-weight="bold">${i<stage?'✓':i===4?'◆':i+1}</text>`).join('');
  return `<svg class="expedition-road" viewBox="0 0 550 108" role="img" aria-label="${esc(route.name)}: ${stage} of five stages cleared" xmlns="http://www.w3.org/2000/svg"><rect width="550" height="108" rx="14" fill="#102a35"/>${paths}${nodes}</svg>`;
}
D.expeditionPanel=(ui,type,arg={})=>{
  if(!['expeditions','expedition'].includes(type))return null;
  const a=ui.app,C=a.content,S=a.state;if(!S||!C.expeditions)return null;
  const b=(...args)=>ui.action(...args),run=S.expeditions?.run;
  const out={title:'The expedition ledger',kicker:'THE HEARTHBOUND ROADS',html:'',footer:''};let h='';
  if(type==='expeditions'){
    if(run){out.title='A road is already open';h='<p>Your party is waiting at a saved expedition checkpoint. Finish that journey before setting out again.</p>';out.footer=b('Resume expedition',()=>a.resumeExpedition(),{primary:true})+b('Journey kit',()=>ui.open('camp'));}
    else if(arg?.route&&C.expeditions[arg.route]){
      const route=C.expeditions[arg.route],rec=S.expeditions.records[route.id],maxTier=Math.min(6,(rec?.bestTier??-1)+1),tier=Math.max(0,Math.min(maxTier,Number(arg.tier)||0)),q=a.expeditionStatus(route.id,tier);
      out.title=route.name;out.kicker=`FIVE STAGES · CHAPTER ${route.chapter} · LEVEL ${route.minLevel}+`;
      h=`<p class="expedition-lead">${esc(route.description)}</p>${roadChart(route,0)}<div class="mission-next"><b>Route rule</b><p>${esc(route.rule)}</p></div>`;
      h+=`<div class="expedition-tier"><span class="eyebrow">CHALLENGE TIER ${tier} / ${maxTier} OPEN</span><p>${tier===0?'The original route. Enemies also grow with your entry level.':`Enemies have ${tier*20}% more HP and ${tier*8}% more attack and magic than tier zero. Stage crowns increase by ${tier*15}%.`} Clear a tier to open the next, up to tier six.</p><div class="buttons">${b('Lower tier',()=>ui.open('expeditions',{route:route.id,tier:tier-1}),{disabled:tier===0})}${b('Higher tier',()=>ui.open('expeditions',{route:route.id,tier:tier+1}),{disabled:tier===maxTier})}</div></div>`;
      h+='<div class="expedition-stage-list">'+route.stages.map((s,i)=>`<article class="inventory-row"><span class="expedition-number">${i+1}</span><div class="item-copy"><span class="eyebrow">${i===4?'GUARDIAN':'ROAD ENCOUNTER'} · ${esc(C.zoneById[s.zone]?.name||s.zone)}</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><small>${s.enemies.map(id=>esc(C.enemies[id].name)).join(' · ')}</small></div></article>`).join('')+'</div>';
      h+=`<div class="expedition-rewards"><h3>${rec?.clears?'First delivery already claimed':'First complete delivery'}</h3><p>${esc(rewardText(C,route.firstReward))}</p><h3>Every run can bank</h3><p>Stage crowns, Haven Supplies, and ${esc(C.items[route.material]?.name||route.material)}. Pressing on increases the next stages’ danger and haul.</p><p class="footer-note">Repeat reward cap: ${esc(rewardText(C,{gold:route.rewardCaps.gold,items:route.rewardCaps.items}))}. Dock bonuses fit inside this cap. The first delivery is added once.</p></div>`;
      if(rec?.clears)h+=`<p class="footer-note">${rec.clears} complete ${rec.clears===1?'delivery':'deliveries'} · Best tier ${rec.bestTier} · Fastest ${seconds(rec.bestSeconds)} · Fewest commands ${rec.bestTurns}</p>`;
      h+='<div class="mission-next"><b>Before you set out</b><p>Choose three travelers and their equipment. The party receives one full preparation heal, then carries HP, MP, Bond, and finite supplies through all five stages. Choose one boon at the start and after each of the first four victories. Resting, crafting, and changing the party wait until you return.</p><p>Each camp saves your progress. Bank after any victory, or risk the next stage. A defeat or abandonment loses the unbanked haul; spent supplies stay spent. Reloading returns to the saved camp before a fight.</p></div>';
      if(!q.ok)h+=`<p class="footer-note">${esc(q.reason)}</p>`;
      out.footer=b('All routes',()=>ui.open('expeditions'))+b('Prepare party',()=>ui.open('party'))+b('Set out · Tier '+tier,()=>a.startExpedition(route.id,tier),{primary:true,disabled:!q.ok});
    }else{
      h='<p class="expedition-lead">Five fights, a changing party of boons, and a haul you must bring home. Choose a route, pack supplies, and decide how far to trust the road.</p><div class="panel-grid expedition-routes">';
      for(const route of Object.values(C.expeditions)){
        const q=a.expeditionStatus(route.id),rec=S.expeditions.records[route.id];
        h+=`<article class="panel-card expedition-route ${q.ok?'':'locked'}" style="--route-color:${palette[route.era]}"><span class="eyebrow">CHAPTER ${route.chapter} · LEVEL ${route.minLevel} · ${rec?.clears?'DELIVERED '+rec.clears+' TIMES':'FIRST DELIVERY OPEN'}</span><h3>${esc(route.name)}</h3><p>${esc(route.description)}</p><small>${esc(q.ok?'Five stages · '+C.items[route.material]?.name:q.reason)}</small><div class="buttons">${b('Read the route',()=>ui.open('expeditions',{route:route.id}),{primary:q.ok})}</div></article>`;
      }
      h+='</div><p class="footer-note">No entry fee. The six routes are repeatable, but each first-delivery bonus can be claimed once per journey. Higher challenge tiers open through completed deliveries.</p>';
      out.footer=b('Journey kit',()=>ui.open('camp'))+b('Back to the journey',()=>ui.close());
    }
  }else if(!run){
    const last=S.expeditions?.last;
    if(!last){h='<p>No expedition is underway. Read the ledger to choose your first route.</p>';out.footer=b('Open the ledger',()=>ui.open('expeditions'),{primary:true});}
    else{
      const route=C.expeditions[last.route],paid=['cleared','banked'].includes(last.outcome);
      out.title={cleared:'The delivery reaches home',banked:'The haul is safely banked',abandoned:'The party returns',defeat:'The road asks too much'}[last.outcome];
      out.kicker=`${route.name.toUpperCase()} · ${last.stage} / 5 STAGES · TIER ${last.tier}`;
      h=roadChart(route,last.stage)+`<p class="expedition-lead">${paid?'The crowns and supplies are now in your bag. This receipt cannot be claimed again.':'The unbanked haul was left on the road. Your earlier possessions remain, and the supplies used in battle stay spent.'}</p>`;
      if(paid)h+=`<div class="expedition-rewards"><span class="eyebrow">${last.first?'FIRST DELIVERY INCLUDED':'BANKED REWARD'}</span><h3>${esc(rewardText(C,last.reward))}</h3></div>`;
      if(last.outcome==='cleared')h+=`<p>Best cleared tier: ${S.expeditions.records[last.route].bestTier}. ${last.tier<6?'The next challenge tier is now available.':'The highest challenge tier is open for another journey.'}</p>`;
      if(last.outcome==='defeat')h+='<p>There is no free mid-route retry. The autosave records your return. Prepare a new run, or load a manual save or exported camp if you kept one before this fight.</p>';
      out.footer=b('Read another route',()=>ui.open('expeditions'))+b('Return to the journey',()=>ui.close(),{primary:true});
    }
  }else{
    const route=C.expeditions[run.route],next=route.stages[Math.min(run.stage,4)],haul=a.expeditionRewardPreview(),risk=D.Expeditions.riskOf(run),safe=a.expeditionCheckpoint();
    out.title=run.stage===5?'The last load is ready':route.name;
    out.kicker=`SAVED CAMP · ${run.stage} / 5 STAGES CLEARED · TIER ${run.tier} · RISK ${risk}`;
    h=roadChart(route,run.stage)+`<p class="expedition-lead">${run.stage===5?'All five stages are complete. Bank the delivery to collect its reward and return to your starting place.':esc(next.description)}</p>`;
    h+=`<div class="mission-next"><b>${run.stage===5?'Delivery complete':'Next: '+esc(next.name)}</b><p>${esc(route.rule)}</p><small>${risk?`Pressed danger: +${risk*10}% enemy HP and +${Math.round(risk*4.5)}% enemy attack and magic.`:'The route carries no extra pressure from risk choices yet.'}</small></div>`;
    h+='<div class="panel-grid expedition-party">'+run.party.map(id=>{const s=a.stats(id);return`<article class="panel-card"><div class="hero-header">${ui.portraitHTML(id)}<div><h3>${esc(s.name)}</h3><small>Level ${s.level}</small></div></div><div class="meter"><i style="width:${pct(s.hp,s.maxHp)}%"></i></div><div class="meter-numbers"><span>${s.hp} / ${s.maxHp} HP</span><span>${s.mp} / ${s.maxMp} MP</span></div></article>`;}).join('')+'</div>';
    h+=`<div class="expedition-rewards"><span class="eyebrow">${run.stage?'BANK NOW':'NOTHING BANKED YET'}${haul.bonus?' · DOCK +'+Math.round(haul.bonus*100)+'%':''}</span><h3>${esc(rewardText(C,haul))}</h3><small>${run.stage===5&&haul.first?'The first-delivery bonus is included.':'This haul stays at risk until you bank it.'}</small></div>`;
    if(arg?.confirmAbandon){
      h+='<div class="mission-next"><h3>Leave the entire haul behind?</h3><p>You will return to the place where this run began. Used supplies stay spent. Banking is available after a victory if you want to keep the haul instead.</p></div>';
      out.footer=b('Keep the camp open',()=>ui.open('expedition'),{primary:true})+b('Abandon this run',()=>a.abandonExpedition())+(run.stage?b('Bank and return',()=>a.bankExpedition()):'');
    }else{
      if(run.boons.length)h+='<div class="expedition-tokens">'+run.boons.map(id=>`<span class="tag" title="${esc(C.expeditionBoons[id].description)}">${esc(C.expeditionBoons[id].name)}</span>`).join('')+'</div>';
      if(run.phase==='boon'){
        h+='<h3>Choose one road boon</h3><p>Keep it for the rest of this run. A camp grants one choice, and the same boon cannot be taken twice.</p><div class="panel-grid expedition-boons">';
        for(const boon of Object.values(C.expeditionBoons).filter(v=>!run.boons.includes(v.id)))h+=`<article class="panel-card"><span class="eyebrow">${esc(boon.kind)}</span><h3>${esc(boon.name)}</h3><p>${esc(boon.description)}</p>${b('Take this boon',()=>a.chooseExpeditionBoon(boon.id),{disabled:!safe})}</article>`;
        h+='</div>';
      }else if(run.phase==='choice'){
        h+='<h3>How will you take the next road?</h3><div class="panel-grid expedition-choices">';
        for(const [id,name,copy]of [
          ['steady','Keep a steady pace','Carry the current haul onward. Add no new danger and spend no crowns.'],
          ['press','Take the exposed road','All remaining enemies gain +10% HP and +4.5% attack and magic. Future stage crowns gain +25%; winning the next stage adds one crafting material to the haul.'],
          ['recover','Make a careful camp','Trade 30 unbanked crowns for 15% maximum HP and 12% maximum MP for each active ally. This camp can recover the party once.']
        ])h+=`<article class="panel-card"><h3>${name}</h3><p>${copy}</p>${b(name,()=>a.chooseExpeditionRisk(id),{primary:id==='steady',disabled:!safe})}</article>`;
        h+='</div>';
      }
      out.footer=(run.phase==='ready'?b('Continue · Stage '+(run.stage+1),()=>a.continueExpedition(),{primary:true,disabled:!safe}):'')+
        (run.stage?b(run.stage===5?'Bank the complete delivery':'Bank and return',()=>a.bankExpedition(),{primary:run.stage===5,disabled:!safe}):'')+
        b('Use packed supplies',()=>ui.open('bag'),{disabled:!safe})+b('Save journey',()=>ui.open('save'),{disabled:!safe})+
        b('Save and return to title',()=>{if(a.save('auto',true)){ui.close();a.game.go('title');}},{disabled:!safe})+
        b('Abandon route',()=>ui.open('expedition',{confirmAbandon:true}),{disabled:!safe});
      h+='<p class="footer-note">The camp autosaves after each decision. HP and MP carry forward. You can use packed supplies here. Escape closes this panel; the saved camp reopens before the party can wander off the route.</p>';
    }
  }
  out.html=h;return out;
};
})();
