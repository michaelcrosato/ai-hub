import { LIFE_MEMORIES, FILMS } from './life-spec.js';
const $=id=>document.getElementById(id);
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
const setHidden=(el,hidden)=>{if(el.hidden!==hidden)el.hidden=hidden;};
/** Optional controls stay hidden until the player reaches an encounter. */
class LifeUI{
 constructor(actions){this.last='';this.actions=actions;$('life-album').addEventListener('click',e=>{const b=e.target.closest('[data-life-track]');if(b)actions('life-track:'+b.dataset.lifeTrack);});}
 update(life,state,mode,nearest,craft,talkKey='T'){
  // Called every frame: write to the DOM only when something changed.
  const talk=mode==='play'&&nearest?.type==='neighbor';setHidden($('smalltalk'),!talk);
  if(talk){const html='Just talk to '+nearest.name+' <kbd>'+talkKey+'</kbd>';if(this.talkHtml!==html){this.talkHtml=html;$('smalltalk').innerHTML=html;}}
  const music=mode==='play'?life.music:null;setHidden($('music-panel'),!music);if(document.body.classList.contains('music-view')!==!!music)document.body.classList.toggle('music-view',!!music);
  if(music){setText($('music-name'),music.name);setText($('music-caption'),life.soundCaption+' · '+(life.api.audio.enabled?'Make any tune.':'Sound is off. Use ♫ to listen.'));for(let i=0;i<5;i++){const on=life.time-music.notes[i]<.30,b=$('note-'+i);if(b.classList.contains('pressed')!==on)b.classList.toggle('pressed',on);}}
  const wait=life.wait,walk=life.walk;setHidden($('moment-note'),mode!=='play'||(!wait&&!walk));
  if(wait)setText($('moment-note'),(wait.kind==='cloud'?'Listen to the soft rain':'Wait quietly by the burrow')+' · '+Math.max(1,Math.ceil(wait.seconds-wait.elapsed))+' s');
  else if(walk)setText($('moment-note'),life.distance(walk.actor,life.api.player)<5.5?'A walk at their pace. Stay nearby.':'The family will wait. Return when you are ready.');
  setHidden($('craft-panel'),!craft.active||!['play','machine'].includes(mode));if(craft.active){setText($('craft-stage'),craft.label);const w=craft.progress*100+'%';if($('craft-fill').style.width!==w)$('craft-fill').style.width=w;setText($('craft-steps'),'GRIND  ·  PRESS  ·  POUR  ·  FOAM  ·  PACK');}
  const key=JSON.stringify(state.life.snapshot());if(this.last!==key){this.last=key;this.album(state.life);}
 }
 album(s){$('life-count').textContent=s.memories.size+' small moments';$('life-album').innerHTML=LIFE_MEMORIES.map((m,i)=>`<article class="life-memory ${s.memories.has(m.id)?'found':''}"><span>${s.memories.has(m.id)?'✷':String(i+1).padStart(2,'0')}</span><div><h3>${m.title}</h3><p>${m.hint}</p><button data-life-track="${m.site}">${s.track===m.site?'Direction is shown':'Show direction'} ↗</button></div></article>`).join('');}
 film(film,state){$('film-title').textContent=FILMS.find(f=>f.id===film?.id)?.title||'The Pocket Picturehouse';for(const f of FILMS){const b=$('film-'+f.id);b.disabled=!f.free&&!state.explore.reel;b.classList.toggle('selected',film?.id===f.id);b.setAttribute('aria-pressed',String(film?.id===f.id));} $('film-hint').textContent=state.explore.reel?'All three films are ready. Select a title to replay it.':'Two films are free. Find the third reel in the Canopy Archive.';}
}

export { LifeUI };
