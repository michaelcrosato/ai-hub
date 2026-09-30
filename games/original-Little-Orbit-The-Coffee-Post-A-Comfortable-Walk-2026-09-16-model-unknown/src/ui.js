import { STAMPS, WALKING_ROUTES } from './expansion-spec.js';
import { NEIGHBORS, REGIONS } from './config.js';
import { POST_BUNDLES } from './post.js';
const cupIcon=`<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M7 12h19l-3 19H10L7 12Z" fill="currentColor"/><path d="M6 10h21M10 20h14M13 2c-4 3 3 4 0 7M20 1c-4 3 3 4 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M26 15h2a4 4 0 0 1-3 8" stroke="currentColor" stroke-width="2"/></svg>`;
const $=id=>document.getElementById(id);
const portraits={pip:'#d69765',miso:'#8f9ea4',mochi:'#e8cdb9',pebble:'#94b990'};
// HUD writes happen every frame. Touch the DOM only when a value really changes.
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
const setHidden=(el,hidden)=>{if(el&&el.hidden!==hidden)el.hidden=hidden;};
const setTransform=(el,value)=>{if(el&&el.style.transform!==value)el.style.transform=value;};
/** Minutes and seconds for the round card: 6:05. */
const clock=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const metres=m=>m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';
/** Button glyphs for each input device, so prompts match what the player holds. */
const KEYS={keyboard:{use:'E',talk:'T'},gamepad:{use:'X',talk:'RT'},touch:{use:'Tap',talk:'Talk'}};
class UI{
 constructor(actions){this.actions=actions;this.toastUntil=0;this.placeUntil=0;this.dialogUntil=0;this.nearest=null;this.journalOpen=false;this.helpOpen=false;this.mode='title';this.lastKey='';this.nextKeyCheck=0;this.source='keyboard';this.promptKey='';
 document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;e.preventDefault();actions(el.dataset.action);});
 document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const panel=!$('help').hidden?$('help'):!$('complete').hidden?$('complete'):!$('pause').hidden?$('pause'):this.journalOpen?$('journal'):null;if(!panel)return;const controls=[...panel.querySelectorAll('button:not(:disabled),a[href],summary,input')].filter(x=>x.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first.focus();}});
 $('cups').innerHTML=Array.from({length:4},(_,i)=>`<span class="cup-slot" id="cup-${i}">${cupIcon}</span>`).join('');
 $('neighbor-dots').innerHTML=NEIGHBORS.map(n=>`<span class="pet-dot" id="dot-${n.id}" style="--pet:${portraits[n.id]}" title="Find this neighbor"><i></i><i></i><b>✓</b></span>`).join('');
 this.el={toast:$('toast'),discovery:$('discovery'),dialogue:$('dialogue'),location:$('location'),homeDistance:$('home-distance'),homeArrow:$('home-arrow'),prompt:$('prompt'),promptKey:$('prompt-key'),promptText:$('prompt-text'),fieldCount:$('field-count'),fieldFill:$('field-fill'),trailTarget:$('trail-target'),untrack:$('untrack'),trailName:$('trail-name'),trailArrow:$('trail-arrow'),postHud:$('post-hud-count'),filmTime:$('film-time'),filmFill:$('film-fill'),complete:$('complete')};
 }
 loaded(hasSave){$('loading').hidden=true;$('start').disabled=false;$('start').textContent=hasSave?'Continue your round  ↗':'Start a little walk  ↗';}
 /** Keyboard, gamepad or touch: prompts and the control strip follow the last device used. */
 setSource(source){this.source=KEYS[source]?source:'keyboard';document.body.dataset.input=this.source;document.body.classList.toggle('touch-mode',this.source==='touch');this.promptKey='';}
 setMode(mode){this.mode=mode;document.body.dataset.mode=mode;$('title').hidden=mode!=='title';$('hud').hidden=mode==='title';$('title').classList.toggle('hidden',mode!=='title');$('hud').classList.toggle('hidden',mode==='title');$('overview-note').hidden=mode!=='overview';$('pause').hidden=mode!=='paused';$('globe-btn').classList.toggle('active',mode==='overview');$('courier-btn').classList.toggle('active',mode==='courier');$('courier-btn').setAttribute('aria-pressed',String(mode==='courier'));$('courier-panel').hidden=mode!=='courier';document.body.classList.toggle('courier-view',mode==='courier');document.body.classList.toggle('cinema-view',mode==='cinema');$('film-panel').hidden=mode!=='cinema';}
 toast(text,t,duration=3.5){this.el.discovery.classList.remove('show');this.placeUntil=0;this.el.toast.textContent=text;this.el.toast.classList.add('show');this.toastUntil=t+duration;}
 dialogue(name,text,t){if($('dialog-voice'))$('dialog-voice').textContent='';$('dialog-name').textContent=name;$('dialog-text').textContent=text;this.el.dialogue.classList.add('show');this.dialogUntil=t+7;}
 place(region,t){this.el.toast.classList.remove('show');this.toastUntil=0;$('place-kicker').textContent='A NEW LITTLE PLACE';$('place-title').textContent=region.name;$('place-sub').textContent=region.sub;this.el.discovery.classList.add('show');this.placeUntil=t+4.5;}
 /**
  * The use prompt above the walk. Returns the label for the touch Use button
  * and whether there is anything to use right now.
  */
 prompt(target,state,brew,busy){
 this.nearest=target;const e=this.el,keys=KEYS[this.source];
 const label=brew?'Brewing':busy?'Wait':!target?'Use':target.type==='neighbor'?(state.coffees&&!state.served.has(target.id)?'Give':state.post.letterFor(target.id)?'Letter':'Talk'):target.type==='local'&&state.post.letterFor(target.id)?'Letter':target.type==='machine'?(state.coffees?'Ready':'Brew'):target.type==='mural'?'Look':target.type==='post'?'Post':'Use';
 const idle=!target||!!brew||!!busy||this.mode!=='play'||this.modal||this.journalOpen;
 setHidden(e.prompt,(!target&&!brew&&!busy)||this.modal||this.journalOpen||this.mode!=='play');
 if(busy||brew){if(this.promptKey!=='spin'){this.promptKey='spin';e.promptKey.innerHTML='<span class="spinner"></span>';}
  setText(e.promptText,busy?(busy.kind==='rest'?'Rest by the warm water':'Shape and fire your cup')+' · '+Math.max(1,Math.ceil(busy.duration-busy.elapsed))+' s':'Brewing '+brew.count+' warm coffees');return {label,idle};}
 if(this.promptKey!==keys.use){this.promptKey=keys.use;e.promptKey.textContent=keys.use;}
 if(!target)return {label,idle};
 let text=target.prompt;
 if(target.type==='activity'){const x=state.explore;if(target.kind==='tap')text=x.warm?'Close the warm tap':'Open the warm tap';if(target.kind==='read')text=x.pages<3?'Read travel book · '+(x.pages+1)+' / 3':'Read the travel book again';if(target.kind==='film')text='Watch a miniature film';if(target.kind==='plant'&&x.has('fields'))text='Visit your flower patch';if(target.kind==='clay'&&x.clay)text='Look at the ridge clay';if(target.kind==='pottery'&&x.has('kiln'))text='Admire your glazed cup';}
 const letter=(target.type==='neighbor'||target.type==='local')?state.post.letterFor(target.id):null;
 if(target.type==='neighbor'){const coffee=state.coffees&&!state.served.has(target.id);text=coffee&&letter?'Give '+target.name+' a coffee and a letter':coffee?'Give '+target.name+' a coffee':letter?'Give '+target.name+' a letter':'Say hello to '+target.name;}
 if(target.type==='local'&&letter)text='Give '+target.name+' a letter';
 if(target.type==='machine')text=state.complete?'Start the next round':state.coffees?'Your tray is ready':'Brew '+(4-state.served.size)+' coffees';
 if(target.type==='post'){const p=state.post;text=p.complete?'The post box rests · all letters delivered':p.carrying?'Letters in your bag · '+p.remaining().length+' to deliver':p.bundle?'Collect the replies':'Collect the morning post';}
 setText(e.promptText,text);return {label,idle};
 }

 update(t,state,area,homeDistance,bearing){
  const e=this.el;
  if(t>this.toastUntil)e.toast.classList.remove('show');if(t>this.placeUntil)e.discovery.classList.remove('show');if(t>this.dialogUntil)e.dialogue.classList.remove('show');
  document.body.classList.toggle('has-dialogue',t<this.dialogUntil&&e.dialogue.classList.contains('show'));
  setText(e.location,area);
  // The saved state only changes on events. Compare it a few times a second, not every frame,
  // and without the round clock, which ticks all the time.
  if(t>=this.nextKeyCheck||t<this.nextKeyCheck-1){this.nextKeyCheck=t+.25;const snap=state.snapshot();snap.roundTime=0;snap.roundDistance=0;const key=JSON.stringify(snap);
   if(key!==this.lastKey){this.lastKey=key;$('round').textContent=String(state.round).padStart(2,'0');$('cup-count').textContent=`${state.coffees} / 4`;$('delivered-count').textContent=`${state.served.size} of 4`;$('objective').textContent=state.complete?'A little kindness, all around.':state.coffees?'Find a neighbor. Share a warm cup.':'Brew a coffee. Or take a little walk.';$('task-label').textContent=state.complete?'ROUND COMPLETE':'YOUR LITTLE DELIVERY';for(let i=0;i<4;i++)$(`cup-${i}`).classList.toggle('filled',i<state.coffees);for(const n of NEIGHBORS){$(`dot-${n.id}`).classList.toggle('done',state.served.has(n.id));$(`dot-${n.id}`).classList.toggle('known',state.met.has(n.id));$(`dot-${n.id}`).title=state.met.has(n.id)?n.name:'A neighbor to find';}this.journal(state);}}
  setText(e.homeDistance,homeDistance<5?'You are home':`${Math.round(homeDistance)} m to café`);setTransform(e.homeArrow,`rotate(${bearing.toFixed(2)}rad)`);
 }
 journal(state){
  // Rebuilding the lists would drop a controller's focus inside the journal: remember it by action.
  const focused=this.journalOpen&&$('journal').contains(document.activeElement)?document.activeElement.dataset.action||document.activeElement.dataset.lifeTrack||document.activeElement.dataset.detourTrack||null:null;
  $('journal-count').textContent=`${state.places.size} / ${REGIONS.length} places found`;$('journal-people').innerHTML=NEIGHBORS.map(n=>`<article class="neighbor-card ${state.served.has(n.id)?'served':''}"><div class="journal-avatar" style="--pet:${portraits[n.id]}">${state.met.has(n.id)?'<i></i><i></i>':'?'}</div><div><h3>${state.met.has(n.id)?n.name:'A neighbor to find'} <span>${state.served.has(n.id)?'DELIVERED':state.met.has(n.id)?'MET':'UNKNOWN'}</span></h3><p>${state.met.has(n.id)?n.place+'. ':''}${n.hint}</p></div></article>`).join('');const ws=[['tree','An apricot surprise','Shake an old fruit tree.'],['boat','A little voyage','Send a paper boat across the pond.'],['mushroom','A song underfoot','Find a mushroom with a voice.'],['bell','Hello, other side','Ring the bell beyond the orchard.']];$('journal-wonders').innerHTML=ws.map(([id,title,hint])=>`<div class="wonder"><span>${state.wonders.has(id)?'✷':'○'}</span><p><b>${title}</b><small>${state.wonders.has(id)?'FOUND — '+hint:hint}</small></p></div>`).join('');$('journal-places').innerHTML=REGIONS.map(r=>`<span class="place-chip ${state.places.has(r.id)?'found':''}">${state.places.has(r.id)?r.name:'? Undiscovered'}</span>`).join('');
  const e=state.explore;
  $('passport-count').textContent=e.count+' / 8 field notes';
  $('passport-grid').innerHTML=STAMPS.map(s=>`<span class="passport-stamp ${e.has(s.id)?'stamped':''}" title="${s.title}"><b>${e.has(s.id)?'✷':s.mark}</b><small>${s.place.replace('The ','').replace('Thread & Crumb Lane','Town shops').replace('The Canopy Archive','Archive').replace('Pocket Picturehouse','Cinema').replace('Cloudwater Baths','Baths').replace('Pebbleback Ridge','Ridge').replace('Sunpatch Fields','Fields')}</small></span>`).join('');
  $('explore-tasks').innerHTML=STAMPS.map(s=>`<article class="field-task ${e.has(s.id)?'done':''}"><span class="task-mark">${e.has(s.id)?'✓':s.mark}</span><div><h3>${s.title}</h3><p>${s.hint}</p><button data-action="track:${s.id}" class="route-link">${e.track===s.id?'Following this direction':'Show direction'} <span>↗</span></button></div></article>`).join('');
  $('bag-items').textContent=[...e.inventory,...(state.post.carrying?[state.post.remaining().length+' letters']:[])].join(' · ')||'Your bag is empty. Shops and paths hold useful things.';
  $('reward-note').textContent=e.complete?'All eight notes. The path lanterns are lit.':e.pin?'Your leaf pin is on your backpack. Find all eight notes to light the path lanterns.':'Find four notes for a leaf pin. Find all eight to light the path lanterns.';
  $('walking-routes').innerHTML=WALKING_ROUTES.map(r=>`<article class="walking-route"><h3>${r.name}</h3><p>${r.text}</p></article>`).join('');
  this.postJournal(state);
  $('best-round').textContent=state.bestTime?`Your quickest round: ${clock(state.bestTime)} on the walk. There is never a need to hurry.`:'Your round times appear here. There is never a need to hurry.';
  if(focused){const el=[...$('journal').querySelectorAll('button,summary')].find(b=>(b.dataset.action||b.dataset.lifeTrack||b.dataset.detourTrack)===focused);el?.focus({preventScroll:true});}
 }
 /** The Morning Post: who the letters in the bag are for, and where to find them. */
 postJournal(state){
  const p=state.post;
  $('post-count').textContent=p.count+' / '+p.total+' letters';
  let intro,list='';
  if(p.complete)intro='Every letter found its reader. The post box flag rests.';
  else if(!p.carrying){intro=p.bundle?'The town wrote back. The replies wait in the post box beside the café.':'The flag is up on the post box beside the café. Four letters wait for the town.';
   list=`<button class="route-link" data-action="post-track:box">${p.track==='box'?'Direction is shown':'Show the post box'} <span>↗</span></button>`;}
  else{const b=p.current();intro=b.title+'. Give each one by hand. Letters never use coffee.';
   list=b.letters.map(l=>{const done=p.delivered.has(l.id);return `<article class="detour-note ${done?'found':''}"><div class="detour-note-top"><span>${done?'✓':'✉'}</span><small>${l.where}</small></div><h4>For ${l.name}</h4><p>From ${l.from}.${done?' Delivered.':''}</p>${done?'':`<button data-action="post-track:${l.id}">${p.track===l.id?'Direction shown':'Show direction'} <span>↗</span></button>`}</article>`;}).join('');}
  $('post-intro').textContent=intro;$('post-letters').innerHTML=list;
  $('post-bundles').textContent=POST_BUNDLES.map((b,i)=>(i<p.bundle?'✓ ':i===p.bundle&&p.carrying?'✉ ':'○ ')+b.title).join('  ·  ');
 }
 trail(state,target,distance,bearing){const e=this.el;setText(e.fieldCount,state.explore.count+' / 8');const w=(state.explore.count/8*100)+'%';if(e.fieldFill.style.width!==w)e.fieldFill.style.width=w;setText(e.postHud,state.post.count+' / '+state.post.total);setHidden(e.trailTarget,!target);setHidden(e.untrack,!target);if(target){setText(e.trailName,target.name+' · '+Math.round(distance)+' m');setTransform(e.trailArrow,'rotate('+bearing.toFixed(2)+'rad)');}}
 film(elapsed,duration,ended){setText(this.el.filmTime,ended?'THE END · SELECT A FILM TO REPLAY':'NOW SHOWING · '+Math.min(Math.round(elapsed),duration)+' / '+duration+' s');this.el.filmFill.style.width=Math.min(100,elapsed/duration*100)+'%';}

 toggleJournal(){this.journalOpen=!this.journalOpen;$('journal').inert=!this.journalOpen;$('journal').setAttribute('aria-hidden',String(!this.journalOpen));$('journal').classList.toggle('open',this.journalOpen);$('journal-btn').classList.toggle('active',this.journalOpen);$('journal-btn').setAttribute('aria-expanded',String(this.journalOpen));if(this.journalOpen)$('journal').querySelector('button').focus({preventScroll:true});else $('game').focus({preventScroll:true});}
 toggleHelp(){this.helpOpen=!this.helpOpen;$('help').hidden=!this.helpOpen;if(this.helpOpen)$('help').querySelector('button').focus({preventScroll:true});else if(this.mode==='play')$('game').focus({preventScroll:true});else if(this.mode==='paused')$('pause').querySelector('button').focus({preventScroll:true});else $('start').focus({preventScroll:true});}
 /** The round card: who was served, how long the walk took, and the best round so far. */
 complete(state){const r=state.lastRound;$('complete-sub').textContent=`Round ${state.round} complete. All four coffees are delivered. Your field notes and open-door activities remain available.`;$('complete-list').innerHTML=NEIGHBORS.map(n=>`<span>✓ ${n.name}</span>`).join('');
  $('complete-stats').innerHTML=r&&r.round===state.round?`<span><b>${clock(r.time)}</b><small>ON THE WALK</small></span><span><b>${metres(r.distance)}</b><small>WALKED</small></span><span><b>${clock(state.bestTime)}</b><small>${r.best?'A NEW BEST':'YOUR BEST'}</small></span>`:'';
  this.el.complete.hidden=false;this.el.complete.querySelector('button').focus({preventScroll:true});}
 closeComplete(){this.el.complete.hidden=true;if(this.mode==='play')$('game').focus({preventScroll:true});}
 clearTransient(){for(const id of ['toast','discovery','dialogue'])$(id).classList.remove('show');this.toastUntil=0;this.placeUntil=0;this.dialogUntil=0;}
 get modal(){return !this.el.complete.hidden||this.helpOpen;}
}

export { cupIcon, UI, clock };
