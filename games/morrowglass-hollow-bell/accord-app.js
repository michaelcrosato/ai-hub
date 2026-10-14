/* The Lantern Accord. Story interactions and a shared roadbook for every campaign. */
(function(root){
'use strict';
const C=root.MorrowCampaign,A=C.accord,J=root.MorrowJourney,B=root.MorrowCampaignApp,base={...B};
const $=id=>document.getElementById(id),copy=v=>JSON.parse(JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quests=[...A.main,...A.side],places=()=>root.MorrowOverworld.locations;
const place=id=>places().find(p=>p.id===id)?.name||C.root.rooms[id]?.name||id;
const site=id=>id==='quay'?'morrowglass':C.root.rooms[id]?.site||id;
const rewardText=q=>Object.entries(q.rewardData||{}).map(([k,v])=>k==='gear'?C.gear[v]?.name:k==='crest'?root.MorrowBattle.crests[v]?.name:k==='materials'?Object.entries(v).map(([m,n])=>n+' '+C.root.materials[m].name).join(' · '):v+' '+({crowns:'crowns',tonic:'Tonics',ether:'Ethers',feather:'Feathers'}[k]||k)).filter(Boolean).join(' · ');
const oldSideGate={ wreck:'ferry',stars:'airship', 'root-map':'root_arrival','root-pip':'root_arrival','root-debt':'root_aqueduct','root-name':'root_archive','root-orchard':'root_stair','root-star':'root_finished','gentle-giant':'tide_water','unfinished-lesson':'tide_messages','far-lantern':'tide_finished' };
function stepsFor(q){return q.steps||A.legacySteps?.[q.id]||[{where:q.where,text:q.text,complete:{flag:q.flag}}];}
function nextStep(app,q,seen=new Set()){const step=stepsFor(q).find(s=>!J.test(app.state,s.complete))||stepsFor(q).at(-1);const linked=[...C.main,...C.side].find(task=>task!==q&&task.flag===step.complete?.flag);if(linked&&!seen.has(linked.id)){seen.add(linked.id);return nextStep(app,linked,seen);}return step;}
function questStatus(app,q){
 const c=app.state.campaign;if(c.flags[q.flag])return 'complete';
 if(C.main.includes(q))return C.active(q,c)?'active':'locked';
 if(q.start&&c.flags[q.start])return 'active';
 const unlocked=A.side.includes(q)?J.test(app.state,q.available||{flag:q.id.includes('afterglow')?'accord_finished':'accord_commission'}):(!oldSideGate[q.id]||c.flags[oldSideGate[q.id]])&&!C.gate(site(q.where),c);
 return unlocked?'available':'locked';
}
const methods={
 newAccord(){
  base.newRoot.call(this);const s=this.state,c=s.campaign,r=c.root;
  for(const q of C.root.main)c.flags[q.flag]=true;
  for(const f of ['root_briefed','root_met','root_plan','root_choice_made','root_festival'])c.flags[f]=true;
  for(const id of C.root.encounters.filter(id=>!C.root.hunts.some(h=>h.id===id)&&!['furnace-debt','orchard-hunger','unbound-star'].includes(id)))c.defeated[id]=true;
  r.pending=[];r.claimed=C.root.main.map(q=>q.flag);r.choice='open';r.seen=[...C.root.roomIds];r.anchors=[...C.root.anchors];
  r.puzzles={weights:[2,1,3],sequence:['seed','shelter','road'],mirrors:[1,0,3]};
  r.materials={copper:12,fiber:12,glass:12,pollen:8,star:8};r.crests=['vigor','shelter','current'];r.crafted=['crest-vigor','crest-shelter','crest-current','atlas-thread','atlas-prism','atlas-oath'];
  c.accord=A.fresh();for(const id of ['thorns','sentry','boss'])c.accord.book[id]={seen:true,wins:1};c.visited=places().map(p=>p.id);c.tracked=A.main[0].id;
  this.growParty(18);for(const [i,h] of s.party.entries()){
   const id=['atlas-thread','atlas-prism','atlas-oath'][i];this.giveGear(id);h.gear=id;h.atk=h.baseAtk+C.gear[id].atk;h.def=h.baseDef+(C.gear[id].def||0);h.crests=[['current'],[],['shelter','vigor']][i];h.hp=h.maxHp;h.mp=h.maxMp;h.statuses={};
  }
  s.inventory={crowns:1800,tonic:18,ether:18,feather:8};s.battles=33;s.room='hearthcross';s.flags.ate1=true;s.flags.ate2=true;
  const p=places().find(p=>p.id===s.room);s.overworld={x:p.x,y:p.y,mode:'foot',lastLocation:p.id,discovered:[...c.visited]};
  this.accordJournalFilter='active';this.world.setRoom(s.room);this.sync();this.musicForRoom();this.save(false);this.toast('The Lantern Accord · Speak with Anwen in Hearthcross.');
 },
 campaignChapter(){const f=this.state.campaign.flags;return f.accord_commission?(A.main[1]&&f[A.main[1].flag]?15:14):base.campaignChapter.call(this);},
 campaignLabel(){const f=this.state.campaign.flags;return f.accord_finished?'THE LANTERN ACCORD · OPEN ROADS':f.accord_commission?'CHAPTER '+this.campaignChapter()+' · THE LANTERN ACCORD':base.campaignLabel.call(this);},
 campaignObjective(){
  const c=this.state.campaign,q=[...C.main,...C.side].find(q=>q.id===c.tracked);
  if(q&&!c.flags[q.flag]&&(questStatus(this,q)==='active'||questStatus(this,q)==='available'))return nextStep(this,q).text;
  if(c.flags.root_finished&&!c.flags.accord_commission)return 'Speak with Anwen at Hearthcross to start The Lantern Accord.';
  if(c.flags.accord_finished)return 'The roads stay open. Finish local stories or take an advanced contract from the Roadbook.';
  return base.campaignObjective.call(this);
 },
 accordCheck(){
  const done=J.advance(this.state,[...A.side,...A.main],{scope:'accord'});
  if(done.length){const c=this.state.campaign,tracked=quests.find(q=>q.id===c.tracked);if(!tracked||c.flags[tracked.flag])c.tracked=C.next(c).id;this.campaignChanged();this.game.audio.sfx('key');}return done;
 },
 accordPlayPending(){
  if(this.battle||this.mode!=='field'||this.modal)return false;
  const state=this.state,a=state.campaign.accord,id=a.pending[0],q=quests.find(q=>q.id===id);
  if(!q){if(id){a.pending.shift();this.save(false);}return false;}
  this.talk(q.scene,()=>{if(this.state!==state)return;if(a.pending[0]===id)a.pending.shift();this.save(false);this.toast(q.title+' · Complete');if(!this.accordPlayPending()&&q===A.main.at(-1)){this.tideRestore();this.accordEnding();}});return true;
 },
 accordFinishFlag(flag){if(!A.flags.includes(flag))return;this.state.campaign.flags[flag]=true;this.accordCheck();this.campaignChanged();this.accordPlayPending();},
 campaignResume(){
  const c=this.state.campaign;if(c.root.pending.length){base.campaignResume.call(this);return;}
  const interrupted=Object.values(A.choices||{}).find(q=>c.accord.choices[q.id]&&!c.flags[q.flag]);
  if(interrupted){this.accordChoiceScene(interrupted,c.accord.choices[interrupted.id]);return;}
  if(c.flags.root_finished){this.accordCheck();if(!this.accordPlayPending())this.toast(this.campaignObjective());return;}
  base.campaignResume.call(this);
 },
 accordNodes(nodes){
  if(this.mode==='title')return nodes;
  const extra=A.hotspots.filter(n=>n.room===this.state.room&&J.test(this.state,n.requires)&&(!n.hide||!J.test(this.state,n.hide))).map(n=>({...n,p:[...n.p],accord:true,...(['fight','contract'].includes(n.action.type)?{battle:n.action.id}:{} )}));
  return [...nodes,...extra];
 },
 accordSpot(id){return A.hotspots.find(n=>n.id===id&&n.room===this.state.room&&J.test(this.state,n.requires)&&(!n.hide||!J.test(this.state,n.hide)));},
 campaignInteract(id){
  let n=this.accordSpot(id);
  if(id==='anwen'&&this.state.campaign.flags.root_finished&&!this.state.campaign.flags.accord_commission)n=A.hotspots.find(n=>n.action.flag==='accord_briefed');
  if(!n)return base.campaignInteract.call(this,id);
  const a=n.action,state=this.state;
  if(a.type==='scene'){const lines=A.scenes[a.id];if(!lines)return false;this.talk(lines,()=>{if(this.state!==state)return;if(a.flag)this.accordFinishFlag(a.flag);});}
  else if(a.type==='puzzle'){this.accordPuzzleId=a.id;this.accordPuzzle();}
  else if(a.type==='choice')this.accordChoice(a.id);
  else if(a.type==='fight')this.startCampaignBattle(a.id);
  else if(a.type==='contract')this.accordContract(a.id);
  else if(a.type==='moment')this.accordReadMoment(a.id);
  else return false;
  return true;
 },
 accordPuzzle(){
  const p=A.puzzles[this.accordPuzzleId];if(!p||this.mode!=='field'||p.room!==this.state.room||this.state.campaign.flags[p.flag])return;
  const a=this.state.campaign.accord,v=a.puzzles[p.id]??(a.puzzles[p.id]=copy(p.initial));let body='';
  if(p.kind==='order')body=`<div class="puzzle-slots">${p.solution.map((_,i)=>`<span>${esc(p.options.find(o=>o.id===v[i])?.label||'·')}</span>`).join('')}</div><div class="rune-buttons">${p.options.map(o=>`<button data-modal-action="accord-tile" data-tile="${o.id}" ${v.includes(o.id)?'disabled':''}>${esc(o.label)}</button>`).join('')}</div>`;
  if(p.kind==='dials')body=`<div class="tide-dials">${p.labels.map((label,i)=>`<button data-modal-action="accord-dial" data-dial="${i}"><small>${esc(label)}</small><b>${esc(p.valueLabels?.[v[i]]??v[i])}</b><span>Turn</span></button>`).join('')}</div>`;
  if(p.kind==='match')body=`<div class="accord-grid">${p.labels.map(label=>`<article class="accord-card"><h3>${esc(label.label)}</h3>${p.options.map(o=>`<button class="button slim ${v[label.id]===o.id?'primary':''}" data-modal-action="accord-match" data-slot="${label.id}" data-value="${o.id}" aria-pressed="${v[label.id]===o.id}">${esc(o.label)}</button>`).join('')}</article>`).join('')}</div>`;
  const hints=this.accordHints?.[p.id]||0;
  this.showModal(p.title,'An answer you can change',`<p class="puzzle-verse">${esc(p.prompt)}</p><div class="accord-puzzle">${body}</div><div class="accord-hint"><div class="accord-hint-actions"><b>Need a clue?</b><button class="button slim" data-modal-action="accord-hint" ${hints>=(p.hints||[]).length?'disabled':''}>${hints?'Show the next hint':'Show a hint'}</button></div>${(p.hints||[]).slice(0,hints).map(h=>`<p>${esc(h)}</p>`).join('')}</div><p class="modal-note">Each change saves. A wrong answer uses no supplies.</p>`,[{text:'Leave',action:'close'},{text:'Clear',action:'accord-puzzle-reset'},{text:'Check answer',action:'accord-puzzle-check',primary:true}],p.kind==='match'?'wide':'small');this.modal='accord-puzzle';
 },
 accordPuzzleAction(action,d){
  const p=A.puzzles[this.accordPuzzleId];if(this.modal!=='accord-puzzle'||!p||p.room!==this.state.room||this.state.campaign.flags[p.flag])return;
  const a=this.state.campaign.accord,v=a.puzzles[p.id];
  if(action==='accord-tile'&&p.kind==='order'&&p.options.some(o=>o.id===d.tile)&&!v.includes(d.tile)&&v.length<p.solution.length)v.push(d.tile);
  else if(action==='accord-dial'&&p.kind==='dials'&&Number.isInteger(+d.dial)&&+d.dial>=0&&+d.dial<p.labels.length)v[+d.dial]=(v[+d.dial]+1)%(p.max+1);
  else if(action==='accord-match'&&p.kind==='match'&&p.labels.some(o=>o.id===d.slot)&&p.options.some(o=>o.id===d.value))v[d.slot]=d.value;
  else if(action==='accord-puzzle-reset')a.puzzles[p.id]=copy(p.initial);
  else if(action==='accord-hint'){this.accordHints??={};this.accordHints[p.id]=Math.min((this.accordHints[p.id]||0)+1,p.hints.length);}
  else if(action==='accord-puzzle-check'){
   const correct=p.kind==='match'?Object.keys(p.solution).every(k=>v[k]===p.solution[k]):JSON.stringify(v)===JSON.stringify(p.solution);
   if(!correct){this.toast('The setting does not fit the clue. You can change it or ask for a hint.');return;}
   this.closeModal();const state=this.state,finish=()=>{if(this.state===state)this.accordFinishFlag(p.flag);};
   if(p.scene)this.talk(typeof p.scene==='string'?A.scenes[p.scene]:p.scene,finish);else finish();return;
  }
  this.save(false);this.accordPuzzle();
 },
 accordChoice(id){
  const q=A.choices[id];if(!q||this.mode!=='field'||this.state.campaign.flags[q.flag])return;
  if(this.state.campaign.accord.choices[id]){this.accordChoiceScene(q,this.state.campaign.accord.choices[id]);return;}
  this.accordChoiceId=id;this.showModal(q.title,'A choice for this journey',`<p class="lead">${esc(q.prompt)}</p><div class="story-choices">${q.options.map(o=>`<button data-modal-action="accord-choice" data-choice="${o.id}"><b>${esc(o.label)}</b>${o.text?`<span>${esc(o.text)}</span>`:''}</button>`).join('')}</div><p class="modal-note">Both choices keep the same missions and rewards available. Your answer changes the scene.</p>`,[{text:'Think a little longer',action:'close'}],'small');this.modal='accord-choice';
 },
 accordChoiceScene(q,id){
  const option=q.options.find(o=>o.id===id);if(!option)return;const state=this.state;state.campaign.accord.choices[q.id]=id;this.save(false);
  this.talk(typeof option.scene==='string'?A.scenes[option.scene]:option.scene,()=>{if(this.state===state)this.accordFinishFlag(q.flag);});
 },
 accordSync(){
  const here=site(this.state.room),available=A.moments.filter(m=>m.where===here&&J.test(this.state,m.requires)&&!this.state.campaign.accord.viewed.includes(m.id));
  const button=$('accord-moment');button.hidden=this.mode!=='field'||!!this.modal||!available.length||!$('elsewhere').hidden;
  $('accord-moment-title').textContent=available.length===1?available[0].title:available.length+' stories nearby';
  if(this.state.campaign.flags.accord_commission)$('quest-dots').innerHTML=A.main.map(q=>`<i class="${this.state.campaign.flags[q.flag]?'done':''}"></i>`).join('');
 },
 accordMoments(){
  if(this.mode!=='field'||this.battle)return;const a=this.state.campaign.accord,here=site(this.state.room);
  this.showModal('Roadside moments','A little time with the travellers',`<p class="lead">Twelve small stories unfold along the roads. Read a new scene at its town. Replay a scene from here after you have read it. Scenes stay available.</p><div class="accord-moments">${A.moments.map(m=>{const read=a.viewed.includes(m.id),ready=J.test(this.state,m.requires),local=here===m.where;return `<article class="accord-moment" data-status="${read?'complete':ready?'available':'locked'}"><small>${read?'READ · REPLAY ANYTIME':ready?'READY':'STORY REQUIRED'} · ${esc(place(m.where))}</small><h3>${esc(m.title)}</h3><div class="accord-actions">${read||ready&&local?`<button class="button slim" data-modal-action="accord-read-moment" data-moment="${m.id}">${read?'Replay':'Read scene'}</button>`:`<button class="button slim" data-modal-action="route" data-place="${m.where}" ${ready?'':'disabled'}>Route to scene</button>`}</div></article>`;}).join('')}</div><p class="modal-note">${a.viewed.length} / ${A.moments.length} scenes read. Replays do not repeat rewards.</p>`,[{text:'Roadbook',action:'accord-kit'},{text:'Return',action:'close',primary:true}],'wide');this.modal='accord-moments';
 },
 accordReadMoment(id){
  const m=A.moments.find(m=>m.id===id),s=this.state;if(!m||this.mode!=='field'||this.battle)return;
  const read=s.campaign.accord.viewed.includes(id);if(!read&&(!J.test(s,m.requires)||site(s.room)!==m.where))return;
  this.talk(typeof m.scene==='string'?A.scenes[m.scene]:m.scene,()=>{if(this.state!==s)return;if(!s.campaign.accord.viewed.includes(id))s.campaign.accord.viewed.push(id);this.save(false);this.sync();this.toast(m.title+' · Added to Roadside moments.');});
 },
 campaignJournal(){
  if(this.mode!=='field'||this.battle)return;const c=this.state.campaign,f=c.flags,filter=this.accordJournalFilter||'active';
  const rows=[...C.main,...C.side],counts={active:0,available:0,complete:0,all:rows.length};for(const q of rows){const status=questStatus(this,q);if(Object.hasOwn(counts,status))counts[status]++;}
  const row=q=>{const status=questStatus(this,q),done=status==='complete',next=nextStep(this,q),steps=stepsFor(q),where=site(next.where||q.where),side=C.side.includes(q);
   if(filter!=='all'&&status!==filter)return '';
   return `<article class="mission-row accord-quest ${done?'complete':''} ${c.tracked===q.id?'tracked':''}" data-status="${status}" data-quest="${q.id}"><div class="mission-state">${done?'✓':status==='active'?'◇':'·'}</div><div><small>${side?'SIDE MISSION':'CHAPTER '+q.chapter} · ${status.toUpperCase()} · ${esc(place(where))}</small><h3>${esc(q.title)}</h3><p>${esc(q.text)}</p>${steps.length>1?`<ol class="accord-steps">${steps.map(s=>{const checked=done||J.test(this.state,s.complete);return `<li class="${checked?'done':s===next?'current':''}">${checked?'✓ ':''}${esc(s.text)} <small>${esc(place(site(s.where||q.where)))}</small></li>`;}).join('')}</ol>`:''}${!done?`<p class="accord-next"><b>Next:</b> ${esc(next.text)}</p>`:''}${q.reward||q.rewardData?`<p class="mission-reward">Reward: ${esc(q.reward||rewardText(q))}</p>`:''}</div><div class="mission-buttons accord-actions">${!done&&status!=='locked'?`<button class="button slim" data-modal-action="track" data-mission="${q.id}">${c.tracked===q.id?'Tracked':'Track'}</button><button class="button slim" data-modal-action="accord-route-step" data-mission="${q.id}">Route to next step</button>`:done?'<span>Complete</span>':'<span>Continue the story</span>'}</div></article>`;
  };
  this.showModal('Journal · '+(1+C.main.filter(q=>f[q.flag]).length)+' / '+(C.main.length+1)+' main missions','The Lantern Roads',`<p class="lead">${esc(this.campaignObjective())}</p><div class="campaign-summary"><span><b>${c.visited.length} / ${places().length}</b>Places visited</span><span><b>${C.side.filter(q=>f[q.flag]).length} / ${C.side.length}</b>Side missions</span><span><b>${c.accord.viewed.length} / ${A.moments.length}</b>Roadside moments</span></div><div class="accord-toolbar"><button class="button slim" data-modal-action="accord-kit">Roadbook & contracts</button><button class="button slim" data-modal-action="atlas">World atlas</button><button class="button slim" data-modal-action="codex">People & records</button>${f.root_arrival?'<button class="button slim" data-modal-action="root-kit">Tools & expeditions</button>':''}</div><div class="accord-tabs" role="tablist" aria-label="Mission filter">${['active','available','complete','all'].map(k=>`<button class="accord-tab" role="tab" aria-selected="${filter===k}" data-modal-action="accord-journal-filter" data-filter="${k}">${{active:'In progress',available:'Available',complete:'Complete',all:'All missions'}[k]} <span>${counts[k]}</span></button>`).join('')}</div><div class="accord-list">${rows.map(row).join('')||'<p class="accord-empty">No missions in this view. Select Available or All missions to find another story.</p>'}</div><p class="modal-note">The first Hollow Bell mission is complete. Side stories stay available after every ending. Routes follow the next unfinished step.</p>`,[{text:'Return to the road',action:'close',primary:true}],'wide');this.modal='journal';
 },
 accordRouteStep(id){
  const q=[...C.main,...C.side].find(q=>q.id===id);if(!q||!['active','available'].includes(questStatus(this,q)))return;const step=nextStep(this,q),where=site(step.where||q.where);
  this.state.campaign.tracked=id;this.save(false);
  if(site(this.state.room)===where){this.closeModal();const n=A.hotspots.find(n=>this.accordSpot(n.id)&&(n.action.flag===step.complete?.flag||n.action.id===step.complete?.defeated||A.puzzles[n.action.id]?.flag===step.complete?.flag||A.choices[n.action.id]?.flag===step.complete?.flag));if(n)this.world.goTo(n.id);else this.toast(step.text);return;}
  this.routeTo(where);
 },
 accordKit(){
  if(this.mode!=='field'||this.battle)return;
  this.showModal('The Roadbook','Stories, encounters, and work still to do',`<p class="lead">${esc(this.campaignObjective())}</p><div class="accord-grid"><button class="accord-card" data-modal-action="campaign-journal"><b>Mission journal</b><p>Current steps, completed tasks, and routes to the next place.</p></button><button class="accord-card" data-modal-action="accord-moments"><b>Roadside moments</b><p>Twelve town scenes. Read them nearby, then replay them here.</p></button><button class="accord-card" data-modal-action="accord-book"><b>Field guide</b><p>Encounters you have seen, known weaknesses, and battle advice.</p></button><button class="accord-card" data-modal-action="accord-contracts"><b>Advanced contracts</b><p>Three repeatable Level 18 trials. Practice new skills and earn salvage.</p></button></div>`,[{text:'Return to the road',action:'close',primary:true}],'wide');this.modal='accord-kit';
 },
 accordObserveBattle(id){const book=this.state.campaign.accord.book;book[id]??={seen:true,wins:0};book[id].seen=true;},
 accordRecordWin(result){
  if(result.fled||!this.battle||this.battle.encounterId!==result.encounterId||this.battle.outcome!=='win'||this.accordRecordedBattle===this.battle)return;
  this.accordRecordedBattle=this.battle;this.accordObserveBattle(result.encounterId);const record=this.state.campaign.accord.book[result.encounterId];record.wins=Math.min(9999,record.wins+1);
 },
 accordBook(){
  if(this.mode!=='field'||this.battle)return;const c=this.state.campaign,book=c.accord.book,entries=Object.entries(root.MorrowBattle.encounters).filter(([id])=>book[id]?.seen||c.defeated[id]);
  this.showModal('Field guide','Read the pattern, then choose',`<p class="lead">Every seen encounter adds an entry. During a battle, Inspect shows the current phase, status timers, and charge counters. Inspect pauses time.</p><div class="accord-bestiary">${entries.map(([id,e])=>`<article class="accord-entry"><small>${e.boss?'BOSS':'ENCOUNTER'} · ${(book[id]?.wins||c.defeated[id])?Math.max(book[id]?.wins||0,c.defeated[id]?1:0)+' WINS':'SEEN'}</small><h3>${esc(e.name)}</h3><p>${esc(e.hint)}</p><div class="accord-stats">${e.enemies.map(foe=>`<span><b>${esc(foe.name)}</b> Opening weakness: ${esc(foe.phases?.[0]?.weakness||foe.weakness||'none')}${foe.shell?' · Armored shell':''}</span>`).join('')}</div></article>`).join('')||'<p class="accord-empty">Your first encounter will add an entry. Battle inspection is available from the battle header.</p>'}</div><p class="modal-note">Earlier cleared encounters are included from your save. Old saves do not contain repeat-win totals, so those entries show at least one win.</p>`,[{text:'Roadbook',action:'accord-kit'},{text:'Return',action:'close',primary:true}],'wide');this.modal='accord-book';
 },
 accordInspect(){
  const b=this.battle;if(!b||this.mode!=='battle'||b.outcome||this.modal&&this.modal!=='accord-inspect')return;
  const units=[...b.enemies,...b.heroes].map(u=>b.inspectUnit(u.id));
  this.showModal('Battle inspection','Time is paused',`<p class="lead">Read the current state. Close this panel to continue from the same moment.</p><div class="accord-bestiary">${units.map(u=>`<article class="accord-entry"><small>${u.side==='enemy'?'OPPONENT':'TRAVELLER'}${u.phaseName?' · '+esc(u.phaseName):''}</small><h3>${esc(u.name)}</h3><div class="accord-stats"><span><b>HP</b> ${u.hp} / ${u.maxHp}</span>${u.side!=='enemy'?`<span><b>MP</b> ${u.mp} / ${u.maxMp}</span>`:''}<span><b>Weakness</b> ${esc(u.weakness||'None')}</span><span><b>Defense</b> ${[u.shell?'Armored shell':'',u.ward?'Ward':''].filter(Boolean).join(' · ')||'No shell or ward'}</span></div>${u.intent?`<p class="accord-next"><b>${esc(u.intent.name)}</b> · ${u.intent.remaining.toFixed(1)} seconds left<br>${esc(u.intent.counterHint||'Prepare to heal or defend.')}${u.intent.required?`<br>Counter: ${u.intent.interrupts} / ${u.intent.required} · ${esc(u.intent.actions.map(id=>root.MorrowBattle.ACTIONS[id]?.name||id).join(' / '))}`:''}</p>`:`<p>Next: ${esc(u.nextIntent||'Waiting for a command')}</p>`}${u.observedMoves.length?`<p><b>Observed moves:</b> ${esc(u.observedMoves.join(' · '))}</p>`:''}<ul class="accord-status-list">${u.statuses.map(s=>`<li><b>${esc(s.name)}</b>${Number.isFinite(s.remaining)?' · '+s.remaining.toFixed(1)+' sec':''}${Number.isFinite(s.charges)?' · '+s.charges+' charges':''}<br>${esc(s.description)}</li>`).join('')||'<li>No active status effects.</li>'}</ul></article>`).join('')}</div>`,[{text:'Resume battle',action:'close',primary:true}],'wide');this.modal='accord-inspect';
 },
 accordContracts(){
  if(this.mode!=='field'||this.battle)return;const ready=this.state.campaign.flags.accord_party,trialData=A.trials||[];
  const entries=trialData;
  this.showModal('Advanced contracts','Three trials for the open roads',`<p class="lead">Repeat each contract as often as you want. Current HP, MP, and supplies carry into battle. Rest before a trial.</p><div class="accord-grid">${entries.map(t=>`<article class="accord-card"><small>LEVEL 18 · ${this.state.campaign.accord.trialWins[t.id]||0} WINS</small><h3>${esc(root.MorrowBattle.encounters[t.id].name)}</h3><p>${esc(root.MorrowBattle.encounters[t.id].hint)}</p><p>${esc(place(t.where))} · ${esc(Object.entries(t.materials).map(([k,n])=>n+' '+C.root.materials[k].name).join(' · '))} · Crowns and AP</p><button class="button slim" data-modal-action="route" data-place="${t.where}" ${ready?'':'disabled'}>${ready?'Route to trial':'Finish the three companion stories first'}</button></article>`).join('')}</div>`,[{text:'Roadbook',action:'accord-kit'},{text:'Return',action:'close',primary:true}],'wide');this.modal='accord-contracts';
 },
 accordContract(id){
  const n=A.hotspots.find(n=>n.action.type==='contract'&&n.action.id===id&&this.accordSpot(n.id));if(!n)return;
  this.accordContractId=id;this.showModal('Advanced contract',root.MorrowBattle.encounters[id].name,`<p class="lead">${esc(root.MorrowBattle.encounters[id].hint)}</p><p>Level 18 trial. This fight can be repeated. It awards crowns, AP, and salvage. Your current party condition and supplies carry into the fight.</p>`,[{text:'Prepare first',action:'close'},{text:'Begin contract',action:'accord-contract-start',primary:true}],'small');this.modal='accord-contract';
 },
 startCampaignBattle(id){
  if(!A.encounters.includes(id)){base.startCampaignBattle.call(this,id);return;}
  const n=A.hotspots.find(n=>n.action.id===id&&['fight','contract'].includes(n.action.type)&&this.accordSpot(n.id));if(!n||this.mode!=='field')return;
  if(n.action.type==='contract'){this.accordContract(id);return;}
  const state=this.state;this.talk([['narrator','Before the first move',root.MorrowBattle.encounters[id].hint]],()=>{if(this.state===state&&this.accordSpot(n.id))this.startBattle(id);});
 },
 campaignBattleWon(result){
  const id=result.encounterId;if(!A.encounters.includes(id)){base.campaignBattleWon.call(this,result);return;}
  if(result.fled){this.leaveBattle();return;}
  if(!this.battle||this.battle.encounterId!==id||this.battle.outcome!=='win'||this.accordRewardedBattle===this.battle)return;
  const c=this.state.campaign,trial=root.MorrowAccordBattles.trials.includes(id);if(!trial&&c.defeated[id])return;this.accordRewardedBattle=this.battle;
  if(trial)c.accord.trialWins[id]=Math.min(9999,(c.accord.trialWins[id]||0)+1);else c.defeated[id]=true;this.state.battles++;
  const salvage=trial?A.trials.find(t=>t.id===id).materials:{glass:2,star:1};
  J.transact(this.state,{reward:{crowns:result.rewards.crowns,materials:salvage}},{scope:'accord'});const learned=[];
  for(const h of this.state.party){const g=root.MorrowglassData.GEAR[h.gear];if(g?.ability&&!h.learned.includes(g.ability)){h.ap[g.ability]=(h.ap[g.ability]||0)+result.rewards.ap;if(h.ap[g.ability]>=g.need){h.learned.push(g.ability);learned.push(h.name+' mastered '+g.skill+'.');}}h.statuses={};}
  this.accordCheck();this.save(false);this.game.audio.music('victory',{loop:false});
  this.showModal(trial?'Contract complete':'Victory',root.MorrowBattle.encounters[id].name,`<p class="lead">${esc(this.campaignObjective())}</p><div class="rewards"><div class="reward"><b>+${result.rewards.crowns}</b><span>CROWNS</span></div><div class="reward"><b>+${result.rewards.ap}</b><span>ABILITY POINTS</span></div><div class="reward"><b>${result.turns}</b><span>PARTY ACTIONS</span></div></div>${learned.map(t=>`<p class="learned">✦ ${esc(t)} It remains available after an equipment change.</p>`).join('')}<p class="root-cost">${esc(Object.entries(salvage).map(([k,n])=>n+' '+C.root.materials[k].name).join(' · '))}</p>`,[{text:trial?'Return to the road':'Continue story',action:'campaign-continue',primary:true}],'small');this.modal='victory';
 },
 continueCampaignBattle(){if(!A.encounters.includes(this.battle?.encounterId)){base.continueCampaignBattle.call(this);return;}this.leaveBattle();if(!this.accordPlayPending())this.toast(this.campaignObjective());},
 accordEnding(){
  if(!this.state.campaign.flags[A.main.at(-1).flag])return;const c=this.state.campaign;
  this.showModal('The Lantern Accord · Complete','Room at the common table',`<div class="ending-art root-ending-art"></div><p class="lead">The lanterns keep different times. The towns keep different stories. Each road still has a place for the next traveller.</p><div class="campaign-summary"><span><b>4 / 4</b>Accord main missions</span><span><b>${A.side.filter(q=>c.flags[q.flag]).length} / 7</b>Accord side stories</span><span><b>${c.accord.viewed.length} / 12</b>Roadside moments</span></div><p>The Afterglow waits at Dusk Observatory. Read the remaining moments, master the three new skills, and take advanced contracts. All earlier side missions remain available.</p>`,[{text:'Roadbook',action:'accord-kit'},{text:'Keep travelling',action:'close',primary:true}],'wide');this.modal='accord-ending';
 },
 rootPuzzle(){
  base.rootPuzzle.call(this);if(this.modal!=='root-puzzle')return;const id=this.rootPuzzleId,verses={weights:'Two workers share the left seat. A lone keeper takes the middle. The right holds all three lanterns.',sequence:'A seed cannot grow without shelter. A shelter needs a road to welcome its next keeper.',mirrors:'The first mirror greets the sunrise. The second finds the fixed star. The last follows the setting sun.'};
  const verse=document.querySelector('.puzzle-verse');if(verse)verse.textContent=verses[id];
 },
 campaignModalAction(action,button){
  const d=button?.dataset||{};
  if(action==='new-accord'){this.newAccord();return true;}
  if(action==='accord-kit'){this.accordKit();return true;}if(action==='accord-book'){this.accordBook();return true;}if(action==='accord-moments'){this.accordMoments();return true;}if(action==='accord-contracts'){this.accordContracts();return true;}
  if(action==='accord-read-moment'){if(this.modal==='accord-moments')this.accordReadMoment(d.moment);return true;}
  if(action==='accord-journal-filter'){if(this.modal==='journal'&&['active','available','complete','all'].includes(d.filter)){this.accordJournalFilter=d.filter;this.campaignJournal();}return true;}
  if(action==='accord-route-step'){if(this.modal==='journal')this.accordRouteStep(d.mission);return true;}
  if(['accord-tile','accord-dial','accord-match','accord-puzzle-reset','accord-puzzle-check','accord-hint'].includes(action)){this.accordPuzzleAction(action,d);return true;}
  if(action==='accord-choice'){if(this.modal==='accord-choice'){const q=A.choices[this.accordChoiceId];if(q&&!this.state.campaign.flags[q.flag])this.accordChoiceScene(q,d.choice);}return true;}
  if(action==='accord-contract-start'){const id=this.accordContractId;if(this.modal==='accord-contract'&&A.hotspots.some(n=>n.action.id===id&&n.action.type==='contract'&&this.accordSpot(n.id)))this.startBattle(id);return true;}
  if(action==='accord-ending'){this.accordEnding();return true;}
  return base.campaignModalAction.call(this,action,button);
 }
};
Object.assign(B,methods);
})(typeof window!=='undefined'?window:globalThis);
