import { DETOURS, DETOUR_WALKS } from './detour-spec.js';
const $=id=>document.getElementById(id);
/** Optional route hints. No activity is required for a coffee round. */
class DetourUI {
 constructor(action){this.last='';$('detour-notes').addEventListener('click',e=>{const b=e.target.closest('[data-detour-track]');if(b)action('detour-track:'+b.dataset.detourTrack);});}
 update(state){
  const d=state.detours,key=JSON.stringify(d.snapshot());if(key===this.last)return;this.last=key;
  $('detour-count').textContent=d.count+' / '+DETOURS.length+' notes';$('detour-hud-count').textContent=d.count+' / '+DETOURS.length;
  $('detour-notes').innerHTML=DETOURS.map((a,i)=>`<article class="detour-note ${d.memories.has(a.id)?'found':''}"><div class="detour-note-top"><span>${d.memories.has(a.id)?'✓':String(i+1).padStart(2,'0')}</span><small>${a.where}</small></div><h4>${a.name}</h4><p>${a.hint}</p><button data-detour-track="${a.id}" aria-label="Show direction to ${a.where}">${d.track===a.id?'Direction shown':'Show direction'} <span>↗</span></button></article>`).join('');
  $('detour-walks').innerHTML=DETOUR_WALKS.map(a=>`<article class="walking-route"><h3>${a.name}</h3><p>${a.text}</p></article>`).join('');
 }
}

export { DetourUI };
