/* Cinder Choir: accessible HTML panels for the campaign model.
 * Engine standard settings, pause, controls, and full screen remain in use. */
(() => {
'use strict';
const CC=globalThis.CC,A=CC.app,E=My3D2dge,R=CC.RPG,D=CC.DATA,F=CC.Frontier,U=CC.Undertide,P=CC.UndertidePuzzles;
if(A.game.headless)return;
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=E.clamp, elCache=new Map();let currentPanel=null,panelData={},toastTimer=null,lastFocus=null,partyDraft=null,teamDraft=null,hudKey='',commandKey='';
let challengeKey='',challengeDraft=[],challengeFeedback='';
let localMapZoom=1,localMapPlace='';
let workOptions={search:'',filter:'available',arc:''},loadoutReview=null,recoveryReview=null,recoveryOptions={mp:false};
const iconButton=(text,action,attrs='',primary=false)=>`<button class="${primary?'primary-button':'small-button'}" data-action="${action}" ${attrs}>${text}</button>`;
const badge=(text,kind='')=>`<span class="badge ${kind}">${esc(text)}</span>`;
const html=(id,value)=>{if(elCache.get(id)!==value){$(id).innerHTML=value;elCache.set(id,value);return true;}return false;};
const txt=(id,value)=>{value=String(value??'');if($(id).textContent!==value)$(id).textContent=value;};
function toast(text){clearTimeout(toastTimer);$('toast').hidden=false;$('toast').textContent=text;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function portraits(root=document){for(const cv of root.querySelectorAll('canvas[data-portrait]')){const id=cv.dataset.portrait,rig=A.portraitRigs[id];if(!rig)continue;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,cv.width,cv.height);rig.update(0,{x:0,y:0,z:0,facing:Math.PI/2});rig.drawPortrait(g,0,0,cv.width,{zoom:3,bg:'#243e4b',frame:false,weapon:false,cape:false});}}
function portrait(id,large=false){return `<canvas class="portrait" data-portrait="${id}" width="${large?102:80}" height="${large?110:88}" aria-label="${esc(R.heroes[id].name)} portrait"></canvas>`;}
function bar(label,value,max,kind=''){return `<div class="mini-stat ${kind}"><label>${label}</label><span class="bar"><i style="width:${clamp(value/max*100,0,100).toFixed(1)}%"></i></span><output>${Math.ceil(value)}/${max}</output></div>`;}
function partyCards(){
 if(!A.started)return;
 const s=A.state,b=A.battle,ids=b?b.heroes.map(a=>a.id):s.party;
 const str=ids.map(id=>{const h=b?.heroes.find(a=>a.id===id)||s.roster[id],st=b?h:R.getStats(s,id),stat=h.status?Object.keys(h.status).filter(k=>h.status[k]>0).map(k=>R.statuses[k]?.name||k):[];
  return `<article class="party-card ${b?.ready===id?'active':''} ${h.hp<=0?'ko':''}">${portrait(id)}<div><div class="party-name">${esc(R.heroes[id].name)}<span>Lv ${h.level}</span></div>${bar('HP',h.hp,st.maxHp)}${bar('MP',h.mp,st.maxMp,'mp')}${b?`<div class="mini-stat atb"><label>ATB</label><span class="bar"><i style="width:${h.atb}%"></i></span><output>${h.atb>=100?'READY':Math.floor(h.atb)+'%'}</output></div>`:''}${stat.length?`<div class="party-status">${esc(stat.join(' · '))}</div>`:''}</div></article>`;
 }).join('');if(html('party-cards',str))portraits($('party-cards'));
 txt('party-count',ids.length+' / 4');
}
const media=query=>!!window.matchMedia?.(query).matches;
let layoutFrame=null,lastInsets='',dialoguePortrait=null,touchVisible=false;
function releaseTouch(){A.game.input.hold('dash',false);}
function syncFullscreen(){
 const full=A.game.fullscreen,button=$('fullscreen-button');
 button.hidden=!full?.supported||!!full.standalone;
 const label=full?.on?'Exit full screen':'Enter full screen';
 button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(!!full?.on));
 txt('fullscreen-label',full?.on?'Exit full screen':'Full screen');
}
function syncTouch(){
 const scene=A.game.sceneName,settings=A.game.settings;
 const touch=settings.touch==='on'||(settings.touch!=='off'&&(media('(any-pointer: coarse)')||A.game.input.lastDevice==='touch'));
 const visible=touch&&['field','overworld'].includes(scene)&&!A.talk.open&&!currentPanel;
 if(touchVisible&&!visible)releaseTouch();touchVisible=visible;
 $('touch-controls').hidden=!visible;
 $('touch-controls').style.setProperty('--touch-size',clamp(Number(settings.touchSize)||62,44,88)+'px');
 $('touch-controls').style.setProperty('--touch-opacity',clamp(Number(settings.touchOpacity)||.8,.2,1));
 $('game-layout').classList.toggle('has-touch',touch);
 $('game-layout').classList.toggle('left-handed',settings.hand==='left');
 $('touch-interact').disabled=!A.near;
 const label=A.near?.type==='goal'?'Story':A.near?.type==='exit'?'Travel':A.near?.type==='camp'?'Rest':'Interact';
 txt('touch-interact-label',label);$('touch-interact').setAttribute('aria-label',label);
}
function syncViewport(){
 layoutFrame=null;
 const view=$('viewport').getBoundingClientRect();if(!(view.width>0&&view.height>0))return;
 const scene=A.game.sceneName,battle=['battle','result','defeat'].includes(scene),dialog=A.talk.open;
 if(['field','overworld'].includes(scene)&&!dialog){const objective=$('objective-hud').getBoundingClientRect();if(objective.height>0)$('journey-controls').style.top=Math.ceil(objective.bottom-view.top+7)+'px';}
 let top=0,bottom=0,left=0,right=0;
 const rect=id=>{const el=$(id);if(el.hidden)return null;const r=el.getBoundingClientRect();return r.width>0&&r.height>0?r:null;};
 const reserveTop=id=>{const r=rect(id);if(r)top=Math.max(top,r.bottom-view.top+8);};
 const reserveBottom=id=>{const r=rect(id);if(r)bottom=Math.max(bottom,view.bottom-r.top+10);};
 if(['field','overworld'].includes(scene)||battle||dialog){
  reserveTop('hud-top');
  if(dialog)reserveBottom('dialogue-card');
  else if(battle){
   const dock=rect('battle-dock');
   if(dock){if(media('(max-height:540px) and (min-aspect-ratio:6/5)'))right=view.right-dock.left+10;else reserveBottom('battle-dock');}
  }else{
   reserveTop('objective-hud');reserveTop('journey-controls');reserveBottom('travel-nav');
   const party=rect('battle-dock');if(party&&party.width>view.width*.65)reserveBottom('battle-dock');
   reserveBottom('context-strip');
  }
 }
 const insets={top:Math.ceil(top),bottom:Math.ceil(bottom),left:Math.ceil(left),right:Math.ceil(right)},key=JSON.stringify(insets);
 if(key!==lastInsets){lastInsets=key;A.setViewportInsets(insets);}
}
function scheduleViewport(){if(layoutFrame===null)layoutFrame=requestAnimationFrame(syncViewport);}
function refreshDialogue(){
 const talk=A.talk;$('dialogue-card').hidden=!talk.open;
 if(!talk.open){dialoguePortrait=null;return;}
 txt('dialogue-name',talk.name||'A voice in the world');
 txt('dialogue-page',(talk.i+1)+' / '+talk.pages.length);
 let remaining=Math.floor(talk.shown);
 const text=talk.page.map(line=>{const part=line.slice(0,Math.max(0,remaining));remaining-=line.length;return part;}).filter(Boolean).join(' ');
 txt('dialogue-text',text);
 const asking=!talk.typing&&talk.i>=talk.pages.length-1&&talk.choices?.length;
 $('dialogue-choices').hidden=!asking;
 if(asking)html('dialogue-choices',talk.choices.map((choice,i)=>`<button data-dialogue-choice="${i}" class="${talk.choice===i?'selected':''}" aria-pressed="${talk.choice===i}">${esc(choice)}</button>`).join(''));
 $('dialog-next').hidden=!!asking;txt('dialog-next',talk.typing?'Show line →':'Continue →');
 txt('dialogue-hint',asking?'Choose a response.':`${A.game.input.label('interact')} / Enter to continue`);
 const canvas=$('dialogue-portrait');canvas.hidden=!talk.portrait;
 if(talk.portrait&&dialoguePortrait!==talk.portrait){
  const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,canvas.width,canvas.height);
  if(typeof talk.portrait==='function')talk.portrait(g,0,0,canvas.width);
  else talk.portrait.drawPortrait(g,0,0,canvas.width,{...(talk.pOpts||{}),frame:false});
  dialoguePortrait=talk.portrait;
 }
}
function refresh(){
 const scene=A.game.sceneName||'title',s=A.state,isTitle=scene==='title',isBattle=['battle','result','defeat'].includes(scene),isDialog=A.talk.open,isField=['field','overworld'].includes(scene);
 const layout=$('game-layout');layout.dataset.scene=scene;
 layout.classList.toggle('title-mode',isTitle);layout.classList.toggle('in-battle',isBattle);layout.classList.toggle('has-dialogue',isDialog);layout.classList.toggle('has-panel',!!currentPanel);
 $('title-overlay').hidden=!isTitle;$('scene-name').hidden=isTitle||scene==='collapse'||scene==='ending';$('scene-mode').hidden=!isBattle;
 $('objective-hud').hidden=!isField||isDialog;$('field-controls').hidden=!isField||isDialog;$('journey-controls').hidden=!isField||isDialog;
 $('battle-dock').hidden=(!isField&&!isBattle)||isDialog;$('battle-controls').hidden=!isBattle;
 $('scene-continue').hidden=scene!=='collapse'&&!(scene==='ending'&&!isDialog&&s.flags.credits);
 txt('scene-continue',scene==='ending'?'Read the epilogue →':'Continue →');
 $('continue-game').hidden=!A.latest();
 $('new-game').classList.toggle('keyboard-selected',isTitle&&A.titleIndex===0);$('continue-game').classList.toggle('keyboard-selected',isTitle&&A.titleIndex===1);
 for(const b of document.querySelectorAll('[data-panel]'))b.disabled=!A.started||isTitle||(!isField&&scene!=='ending');
 if(A.started&&!isTitle){
  const p=A.places[s.location],q=A.activeTask(),ow=scene==='overworld'?A.overworldInfo():null;
  txt('region-name',isBattle?'ACTIVE TIME BATTLE':ow?'THE OVERWORLD · '+(ow.vehicle==='airship'?'AIRSHIP':ow.vehicle==='boat'?'SAILING':'ON FOOT'):p.region.toUpperCase());txt('place-name',isBattle?(A.battle?.boss?'An imposing voice':'A meeting on the road'):ow?ow.name:p.name);txt('scene-mode',A.game.settings.battleMode==='Wait'?'WAIT MODE':'ACTIVE MODE');
  txt('objective-kicker',q?.arc?(D.arcs.find(arc=>arc.id===q.arc)?.title||'THE ROADS BETWEEN').toUpperCase():s.flags.victory?'AFTER THE LAST NOTE':s.act===1?'CURRENT CHAPTER':'A THREAD TO FOLLOW');
  txt('objective-title',q?.title||(s.flags.victory?'The world is yours again.':'The roads are open.'));
  const mission=q?A.missionStatus(q):null,next=mission?.step;
  const regroup=mission?.escort&&A.localMapInfo().target?.regroup;
  const guidance=q?.place!==s.location?'Travel to '+(A.places[q?.place]?.name||'a new place')+'.':!mission?.started?'Read the field briefing. Open the mission map for its location.':regroup?'Rejoin the group at the escort marker.':mission.escort?'Guide the group to the escort marker. Stay close.':next?next.title+' · Step '+(mission.index+1)+'/'+mission.total:'Conclude this mission at the field desk.';
  txt('objective-text',ow?.target?'Course: '+ow.target.name+' · '+ow.distance+' tiles':q?guidance:'Open the world chart to find another voice.');
  $('journey-controls').hidden=!isField||isDialog;
  html('journey-controls',ow?`<div class="transport-buttons" aria-label="World transport">${A.transportOptions().map(v=>`<button data-action="vehicle" data-id="${v.id}" ${v.enabled?'':'disabled'} aria-pressed="${s.overworld.vehicle===v.id}" title="${esc(v.enabled?v.label:v.reason)}">${v.id==='foot'?'♧':v.id==='boat'?'≈':'✧'} ${esc(v.label)}</button>`).join('')}</div><span class="journey-status">${ow.discovered} / ${ow.total} places found <kbd>${esc(A.game.input.label('vehicle'))}</kbd></span>`:`<button class="explore-button" data-action="localmap"><span aria-hidden="true">◇</span> Mission map <kbd>L</kbd></button><button class="explore-button world-link" data-action="explore"><span aria-hidden="true">⌖</span> Overworld <span aria-hidden="true">→</span></button>`);
  const near=A.near;
  txt('context-text',near?.label||(near?.type==='goal'?'Follow this voice.':''));
  $('context-strip').hidden=!isField||isDialog||!near;
  $('interact-button').hidden=!isField||isDialog||!near;
  $('interact-button').innerHTML=`<kbd>${esc(A.game.input.label('interact'))}</kbd> ${near?.type==='goal'?'Story':near?.type==='exit'?'Travel':'Interact'}`;
  $('resonance-card').hidden=!isBattle;const meter=A.battle?.resonance??s.resonance;txt('resonance-value',Math.floor(meter)+' / 100');$('resonance-fill').style.width=clamp(meter,0,100)+'%';
  partyCards();
 }
 $('enemy-intent').hidden=!isBattle||!!A.battle?.result;
 if(isBattle){
  refreshCommands();
  const foes=A.battle.enemies.filter(e=>e.alive);
  const trial=A.battle.trialId&&U.trials[A.battle.trialId],metrics=A.battle.metrics;
  const trialGoals=trial?`<section class="intent-card trial-live"><strong>${esc(trial.name)} · ${esc(A.battle.practice?(A.battle.levelModeLabel||'Current level'):'Story trial')} · Goals</strong>${trial.goals.map(g=>`<small>${esc(g.label)} ${metrics[g.key]} ${g.min!=null?'/ '+g.min:' / max '+g.max}</small>`).join('')}</section>`:'';
  html('enemy-intent',foes.map(e=>`<section class="intent-card ${e.broken?'broken':''}"><strong>${esc(e.name)}${e.phaseLabel?` <small>${esc(e.phaseLabel)}</small>`:''}</strong><span>Next: ${esc(e.intent?.label||e.intent?.name||'Attack')}</span>${e.breakMax?`<div class="break-line"><span>${e.broken?'BROKEN':`BREAK ${e.break}/${e.breakMax}`}</span><meter min="0" max="${e.breakMax}" value="${e.broken?e.breakMax:e.break}" aria-label="Break pressure on ${esc(e.name)}"></meter></div>`:''}${e.intent?.hint?`<small>${esc(e.intent.hint)}</small>`:''}</section>`).join('')+trialGoals);
  $('enemy-intent').title=foes.map(e=>e.name+': '+(e.intent?.hint||e.intent?.label||'Attack')).join(' · ');
 }
 txt('control-hint',`${A.game.input.label('up')} ${A.game.input.label('left')} ${A.game.input.label('down')} ${A.game.input.label('right')} Move · ${A.game.input.label('interact')} Interact · Esc Pause`);
 refreshDialogue();syncTouch();syncFullscreen();scheduleViewport();
}
function availableRecovered(){return A.available().length;}
function battleRewardText(){
 const r=A.rewards||{},trial=r.trial;
 const base=A.battle?.practice?'Practice complete. Your supplies, HP, MP, and experience are kept.':`${r.xp||0} XP · ${r.gold||0} gold · ${r.ap||0} AP. Reserves gain experience.${r.materials?.length?' Materials: '+r.materials.map(m=>m.count+' '+F.materials[m.id].name).join(', ')+'.':''}`;
 return base+(trial?.ok?' '+trial.medal+' · '+(trial.levelModeLabel||'Current level')+' · '+trial.met+'/'+trial.total+' goals. '+trial.goals.map(g=>(g.achieved?'✓ ':'○ ')+g.label+' Actual: '+g.actual+'.').join(' ')+(trial.firstPrize?' First medal: '+trial.gold+' gold and '+trial.materials.map(m=>m.count+' '+F.materials[m.id].name).join(', ')+'.':''):'');
}
function refreshCommands(){
 const b=A.battle;if(!b)return;
 $('commands').hidden=!!A.selectedCommand&&!b.result;
 const actor=b.ready&&R.heroes[b.ready],scene=A.game.sceneName;
 txt('actor-role',b.result?'BATTLE COMPLETE':actor?R.heroes[b.ready].role.toUpperCase():A.animation?'ACTION IN PROGRESS':'WAITING FOR A VOICE');txt('actor-name',b.result?b.result==='victory'?'Victory':b.result==='defeat'?'The company falls':'Safe passage':actor?actor.name:'The gauges are filling');
 txt('auto-button','Auto: '+(A.auto?'on':'off'));$('auto-button').disabled=scene!=='battle';
 html('battle-tabs',A.commandGroups().map(g=>`<button class="${A.commandGroup===g?'selected':''}" data-group="${g}" ${b.result?'disabled':''}>${({actions:'Actions',spells:'Magic',summons:'Echo',bonds:'Pairs',support:'Reserve',items:'Items'})[g]}</button>`).join(''));
 if(b.result){
  html('commands',b.practice?iconButton('Retry this practice','retry','',true)+iconButton('Return from practice','result'):b.result==='defeat'?iconButton('Retry battle','retry','',true)+iconButton('Return to waystone','camp'):iconButton('Continue the journey','result','',true));$('target-select').hidden=true;txt('command-hint',b.result==='victory'||b.practice?battleRewardText():'Your checkpoint keeps the company safe.');return;
 }
 const cmds=A.groupCommands();
 html('commands',cmds.length?cmds.map((c,i)=>`<button class="command-button ${A.commandIndex===i&&!A.selectedCommand?'selected':''} ${c.id==='chorus'?'chorus':''}" data-command="${esc(c.id)}" ${!c.enabled||A.animation?'disabled':''} title="${esc(c.disabledReason||c.reason||c.description)}">${esc(c.label||c.name)}<span>${c.supportCost?'1 CALL':c.bond?c.chorusCost+' CH · '+c.cost+' MP×2':c.cost?c.cost+' MP':c.group==='items'?'×'+(b.bag?.[c.id.slice(5)]??A.state.bag[c.id.slice(5)]??0):c.kind==='chorus'?'100 CH':'—'}</span></button>`).join(''):`<p class="muted" style="grid-column:1/-1;font-size:11px;padding:8px 0">${actor?A.commandGroup==='support'?'A living reserve must be outside the active company. Each battle permits one call.':A.commandGroup==='bonds'?'Complete a companion bond story to learn a pair technique. Open Companion bonds from the menu.':'No commands in this group. Equip an Echo to learn its spells.':'The next voice is almost ready.'}</p>`);
 $('target-select').hidden=!A.selectedCommand;
 if(A.selectedCommand){const c=A.selectedCommand,targets=A.targetsFor(c);html('target-select',`<p>${esc(c.label||c.name)} · Choose a target</p>`+targets.map((t,i)=>`<button data-target="${esc(t.id)}" class="${A.targetIndex===i?'selected':''}">${esc(t.name)} <small>${Math.ceil(t.hp)}/${t.maxHp} HP</small></button>`).join('')+'<button class="cancel-target" data-action="cancel-target">Back</button>');txt('command-hint',c.description);}
 else txt('command-hint',cmds[A.commandIndex]?.disabledReason||cmds[A.commandIndex]?.reason||cmds[A.commandIndex]?.description||(A.game.settings.battleMode==='Wait'?'Time stops while you choose a command.':'Time continues while you choose a command.'));
}
function open(name,data={}){
 if(['battle','result','defeat'].includes(A.game.sceneName)&&!['menu','help','about','save'].includes(name)){toast('Finish this battle before you open that panel.');return;}
 if(!currentPanel)lastFocus=document.activeElement;releaseTouch();currentPanel=name;panelData=data;A.setModal(name);$('modal-layer').hidden=false;
 if(name==='party')partyDraft=A.state.party.slice();
 if(name==='preparation')loadoutReview=null;
 if(name==='teams'){const ids=A.available();teamDraft=A.state.teams?A.state.teams.map(a=>a.slice()):[ids.filter((_,i)=>i%3===0),ids.filter((_,i)=>i%3===1),ids.filter((_,i)=>i%3===2)];}
 renderPanel();$('modal-window').focus();
}
function close(){if(currentPanel==='challenge')A.cancelChallenge();currentPanel=null;panelData={};A.setModal(null);$('modal-layer').hidden=true;lastFocus?.focus?.();refresh();}
function panel(title,kicker,body){$('modal-body').style.touchAction=currentPanel==='localmap'?'pan-x pan-y':'pan-y';txt('modal-title',title);txt('modal-kicker',kicker);$('modal-body').innerHTML=body;portraits($('modal-body'));}
function renderPanel(){
 switch(currentPanel){
  case'menu':renderMenu();break;
  case'difficulty':panel('Begin your journey','CHOOSE YOUR PACE',`<p class="panel-intro">Follow the full story in any mode. You can rest at waystones at no cost. All modes use the same quests and endings.</p><div class="panel-grid">${Object.entries(R.difficulties).map(([id,d])=>`<article class="info-card"><h3>${d.name}</h3><p>${id==='story'?'Gentle battles. More room to follow the story.':id==='normal'?'A balanced journey. Use weaknesses, healing, and each companion’s skills.':'Stronger enemies. Plan your equipment and use protective skills.'}</p>${iconButton('Begin in '+d.name,'begin',`data-difficulty="${id}"`,id==='normal')}</article>`).join('')}</div><p style="margin-top:20px">The game keeps three manual save slots and an automatic save. It also keeps the previous journey as a recovery save.</p>`);break;
  case'chart':renderChart();break;
  case'localmap':if(A.game.sceneName==='field')renderLocalMap();else renderChart();break;
  case'challenge':renderChallenge();break;
  case'party':renderParty();break;
  case'preparation':renderPreparation();break;
  case'recovery':renderRecovery();break;
  case'work':renderWorkboard();break;
  case'pack':renderPack();break;
  case'workshop':renderWorkshop();break;
  case'bonds':renderBonds();break;
  case'trials':renderTrials();break;
  case'shop':renderShop();break;
  case'journal':renderJournal();break;
  case'codex':renderCodex();break;
  case'save':renderSaves();break;
  case'help':renderHelp();break;
  case'about':renderAbout();break;
  case'teams':renderTeams();break;
  case'objectives':panel('Voices at this place','FIELD BRIEFINGS',`<p>Begin a mission to hear its briefing. Its next field target will appear on the mission map.</p><div>${panelData.tasks.map(q=>`<article class="quest-row"><h3>${esc(q.title)}</h3><p>${esc(q.objective)}</p>${objectiveList(q)}<div class="panel-actions">${iconButton(A.missionStatus(q).started?'Resume this mission':'Read the briefing','activate',`data-id="${q.id}"`,true)}${iconButton('Track the steps','track',`data-id="${q.id}"`)}</div></article>`).join('')}</div>`);break;
  case'ending':renderEnding();break;
 }
}
const chartTerrain=new Map();
function terrainSVG(w){
 const key=w.act||A.state.act;if(chartTerrain.has(key))return chartTerrain.get(key);
 const paths={};
 for(let y=0;y<w.height;y++)for(let x=0;x<w.width;){const tag=w.rows[y][x],start=x;while(x<w.width&&w.rows[y][x]===tag)x++;(paths[tag] ||= []).push(`M${start} ${y}h${x-start}v1H${start}z`);}
 const svg=`<svg viewBox="0 0 ${w.width} ${w.height}" preserveAspectRatio="none" aria-hidden="true" shape-rendering="crispEdges">${Object.entries(paths).map(([tag,lines])=>`<path d="${lines.join('')}" fill="${w.palette[tag]}"/>`).join('')}</svg>`;
 chartTerrain.set(key,svg);return svg;
}
function renderChart(){
 const s=A.state,q=A.activeTask(),w=A.overworld,o=s.overworld,info=A.overworldInfo(),target=o.waypoint||q?.place;
 const current=o.active?{x:o.x,y:o.y}:w.byId[s.location],seen=new Set(o.discovered),visited=new Set(s.visited||[]);
 const markers=w.locations.map(p=>`<button class="map-location ${p.id===s.location&&!o.active?'current':''} ${p.id===target?'target':''} ${!seen.has(p.id)?'uncharted':''}" style="left:${p.x/w.worldWidth*100}%;top:${p.y/w.worldHeight*100}%" title="${esc(p.name)}${A.unlocked(p.place)?'':' · Route closed'}" aria-label="Set course for ${esc(p.name)}" data-action="navigate" data-id="${p.id}" ${A.unlocked(p.place)?'':'disabled'}></button>`).join('');
 const dot=current?`<span class="traveller-dot" style="left:${current.x/w.worldWidth*100}%;top:${current.y/w.worldHeight*100}%" title="Your position" aria-label="Your position"></span>`:'';
 const sorted=[...D.places].sort((a,b)=>Number(b.id===target)-Number(a.id===target)||Number(A.unlocked(b))-Number(A.unlocked(a))||a.name.localeCompare(b.name));
 panel('The roads between',s.act===1?'WORLD CHART · THE BORROWED VOICES':'WORLD CHART · THE UNWRITTEN WORLD',`<nav class="map-tabs" aria-label="Map view"><button data-action="localmap" ${A.game.sceneName==='field'?'':'disabled'}>Local mission map</button><button class="selected" data-action="chart" aria-current="page">World chart</button></nav><div class="chart-heading"><p>Set a course, then walk, sail, or fly to the marker. Visit a place once to unlock fast travel.</p>${iconButton(o.active?'Return to exploration':'Explore the overworld','explore','',true)}</div><div class="chart-layout"><div><div class="world-chart" style="aspect-ratio:${w.width}/${w.height}">${terrainSVG(w)}${markers}${dot}<span class="chart-compass" aria-hidden="true">✧</span></div><p class="map-legend"><span>● Your position</span><span>◆ Gold: your course</span><span>○ Faint: unexplored</span></p><div class="chart-counters">${badge(seen.size+' / '+D.places.length+' places found','green')}${badge(o.landmarks.length+' landmarks read')}${badge(o.opened.length+' caches opened')}</div><p>${esc(info.name)} · ${o.vehicle==='airship'?'The Wren is aloft.':o.vehicle==='boat'?'The boat is at sea.':'The company is on foot.'} ${info.target?'Course: '+esc(info.target.name)+' · '+info.distance+' tiles.':''}</p><details><summary>How to cross the world</summary><p>Roads and bridges link the first journey. The ferry pass lets you board at docks after The Missing Verse in Lantern Ward. In Act II, restore The Wren to fly over mountains and sea. Land on open ground to enter a place. Press V to board, fly, or land.</p><p>Read stone landmarks, collect supply caches, and rest at camps. Red enemies can be avoided. The world changes after the Great Silence, with new supplies and new records at its landmarks.</p></details>${s.flags.airship?`<div class="panel-actions">${iconButton('Divide the company','teams')}</div>`:''}</div><div class="location-list">${sorted.map(p=>{const ok=A.unlocked(p),was=visited.has(p.id),threads=[...D.chapters,...D.quests,...A.missions()].filter(q=>q.place===p.id),done=threads.filter(q=>s.flags[q.id]).length;return `<article class="location-entry ${!ok?'locked':''} ${p.id===target?'tracked':''}"><div><h3>${esc(p.name)}</h3>${badge(!ok?'ROUTE CLOSED':was?'VISITED':seen.has(p.id)?'FOUND':'UNEXPLORED',was?'green':'')}<p>${esc(p.region)} · Level ${p.level}${threads.length?' · '+done+'/'+threads.length+' stories':''}</p></div><div class="location-actions">${iconButton('Set course','navigate',`data-id="${p.id}" ${!ok?'disabled':''}`,p.id===target)}${iconButton('Fast travel','fast-travel',`data-id="${p.id}" ${!A.canFastTravel(p.id)?'disabled':''}`)}</div></article>`;}).join('')}</div></div>`);
}
function preparationNote(q){
 if(!q?.battle||!D.frontier?.missionIds.includes(q.id)&&!D.undertide?.missionIds.includes(q.id)&&!D.living?.missionIds.includes(q.id))return '';
 return `<p class="preparation-note"><strong>Encounter level ${q.battle.level}</strong> · Bring a full company of four. Rest at the waystone, review enemy clues, and carry healing supplies.</p>`;
}
function objectiveList(q){
 return `<ol class="objective-steps">${A.missionStatus(q).objectives.map((o,i)=>`<li class="${o.done?'done':o.active?'current':''}"><span aria-hidden="true">${o.done?'✓':i+1}</span><span>${esc(o.label)}${o.active?`<small>${esc(o.description)}</small>`:''}</span><strong>${o.count>1?o.current+'/'+o.count:o.done?'DONE':o.active?'NOW':''}</strong></li>`).join('')}</ol>`;
}

const localColors={'#':'#263c47',H:'#43565e',b:'#9a7964','~':'#244a5b',G:'#d8a079','.':'#879289',':':'#b6ac8d','=':'#ad9270',S:'#ba9073'};
function localTerrainSVG(info){
 const w=info.world,paths={};
 for(let y=0;y<w.height;y++)for(let x=0;x<w.width;){const c=w.rows[y][x],start=x;while(x<w.width&&w.rows[y][x]===c)x++;(paths[c] ||= []).push(`M${start} ${y}h${x-start}v1H${start}z`);}
 const route=info.route.map(p=>(p.x/16)+','+(p.y/16)).join(' ');
 const names=w.rooms.map((room,i)=>{
  const words=room.name.split(' '),lines=[''];for(const word of words){if(lines.at(-1).length+word.length>15)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  return `<text x="${room.x+room.w/2}" y="${room.y+1.3}" text-anchor="middle">${lines.slice(0,3).map((line,j)=>`<tspan x="${room.x+room.w/2}" dy="${j?1.25:0}">${esc(line)}</tspan>`).join('')}</text>`;
 }).join('');
 const gates=w.gates.map(g=>{const p=g.tiles[Math.floor(g.tiles.length/2)];return `<rect x="${p[0]-.3}" y="${p[1]-.3}" width="1.6" height="1.6" fill="${g.open?'#71b49e':'#edb371'}" stroke="#152e3c" stroke-width=".24"/>`;}).join('');
 return `<svg class="local-terrain" viewBox="0 0 ${w.width} ${w.height}" role="img" aria-label="${esc(w.place.name)}. Named rooms, paths, gates, and a route from your position to the selected field target."><title>${esc(w.place.name)} mission map</title><g shape-rendering="crispEdges">${Object.entries(paths).map(([c,path])=>`<path d="${path.join('')}" fill="${localColors[c]||'#879289'}"/>`).join('')}</g><g class="local-room-names">${names}</g>${route?`<polyline class="local-route" points="${route}"/>`:''}${gates}</svg>`;
}
function renderLocalMap(){
 const info=A.localMapInfo(),w=info.world;if(!w){renderChart();return;}
 if(localMapPlace!==w.place.id){localMapPlace=w.place.id;localMapZoom=1;}
 const q=info.task,st=info.status,def=st?.definition;
 const pos=p=>`left:${p.x/(w.width*16)*100}%;top:${p.y/(w.height*16)*100}%`;
 const targets=info.targets.map((o,i)=>`<button class="local-pin target ${o.id===info.target?.id?'selected':''}" data-action="local-focus" data-index="${i}" style="${pos(o)}" aria-label="Show route to ${esc(o.label)}" title="${esc(o.label)}">${info.targets.length>1?i+1:'◆'}</button>`).join('');
 const fixed=w.objects.filter(o=>['camp','exit','chest','local-lore'].includes(o.type)).map(o=>`<span class="local-pin ${o.type}" style="${pos(o)}" title="${esc(o.label)}" aria-label="${esc(o.label)}">${o.type==='camp'?'✧':o.type==='exit'?'↗':o.type==='chest'?(A.state.chests.includes(o.key)?'·':'□'):'·'}</span>`).join('');
 const mission=q?`<span class="eyebrow">${st.started?'STEP '+Math.min(st.index+1,st.total)+' OF '+st.total:'FIELD BRIEFING'}</span><h3>${esc(q.title)}</h3>${preparationNote(q)}<p>${esc(st.started?st.step?.description||'Return to the field desk to conclude this mission.':def.briefing[0]?.text||q.objective)}</p>${info.targets.length>1?`<div class="target-list">${info.targets.map((o,i)=>iconButton(o.label,'local-focus',`data-index="${i}"`,info.target?.id===o.id)).join('')}</div>`:''}<p class="route-note">${info.route.length?'The marked route is '+Math.max(0,info.route.length-1)+' tiles.':info.target?'This route is closed. Check the current gate and mission step.':'This field work is complete.'}</p>${!st.started?iconButton('Read the briefing','begin-field',`data-id="${q.id}"`,true):iconButton('Return to the field','resume','',true)}${objectiveList(q)}`:'<h3>A place to explore</h3><p>Read its records, find the side paths, and return to the world when you are ready.</p>'+iconButton('Return to the field','resume','',true);
 const history=info.evidence.length?`<details class="field-records"><summary>Evidence collected · ${info.evidence.length}</summary>${info.evidence.map(e=>`<h4>${esc(e.title)}</h4><p>${esc(e.text)}</p>`).join('')}</details>`:'';
 panel(w.place.name,'MISSION MAP · '+(info.room?.name||'LOCAL AREA').toUpperCase(),`<nav class="map-tabs" aria-label="Map view"><button class="selected" data-action="localmap" aria-current="page">Local mission map</button><button data-action="chart">World chart</button></nav><p class="area-description">${esc(w.place.description)}</p><div class="local-map-layout"><section><div class="map-zoom" role="group" aria-label="Map zoom">${iconButton('−','map-zoom',`data-delta="-1" aria-label="Zoom out" ${localMapZoom===1?'disabled':''}`)}<output>${localMapZoom}×</output>${iconButton('+','map-zoom',`data-delta="1" aria-label="Zoom in" ${localMapZoom===3?'disabled':''}`)}${iconButton('Fit map','map-fit')}${iconButton('Center target','map-center')}</div><div class="local-map-scroll" tabindex="0" aria-label="Scrollable mission map"><div class="local-map" style="width:${localMapZoom*100}%;aspect-ratio:${w.width}/${w.height}">${localTerrainSVG(info)}${fixed}${targets}<span class="local-pin player" style="${pos(info.hero)}" aria-label="Your position" title="You are here">●</span></div></div><p class="map-legend"><span>● You</span><span>◆ Current target</span><span>✧ Waystone</span><span>□ Treasure</span><span>↗ Exit</span></p><details class="field-marker-legend"><summary>Field marker guide</summary><p>Speech bubble: talk · Magnifying glass: inspect · Box: collect · Box with arrow: deliver · Question mark: answer a clue · Signal waves: send a signal · Crossed swords: battle · Music note: tune · Three arrows: set an order · Tool: repair · Cross: rescue · Two people: escort · Two groups of rows: sort · Linked points: follow a trail · Balance: divide supplies · Lightning bolt: connect wires · Flag: briefing · Page: unread record.</p></details><div class="gate-list">${w.gates.map(g=>`<div class="gate-state ${g.open?'open':''}"><span aria-hidden="true">${g.open?'◇':'▣'}</span><div><strong>${esc(g.label)}</strong><small>${g.open?'OPEN · Route restored':'CLOSED · Follow the mission steps to open it'}</small></div></div>`).join('')}</div>${info.outcomes.length?`<details class="field-records"><summary>Changes at this place · ${info.outcomes.length}</summary>${info.outcomes.map(e=>`<h4>${esc(e.label)}</h4><p>${esc(e.text||'The completed work remains in the field.')}</p>`).join('')}</details>`:''}</section><aside class="local-mission">${mission}${history}</aside></div>`);
}
function centerLocalMap(){
 const pane=$('modal-body').querySelectorAll('.local-map-scroll')[0],info=A.localMapInfo(),p=info.target||info.hero;
 if(pane&&p&&pane.clientWidth>0){pane.scrollLeft=Math.max(0,p.x/(info.world.width*16)*pane.scrollWidth-pane.clientWidth/2);pane.scrollTop=Math.max(0,p.y/(info.world.height*16)*pane.scrollHeight-pane.clientHeight/2);}
}
function circuitControls(c){
 const b=c.layout,status=P.inspect(b,challengeDraft),powered=new Set(status.powered);
 const tiles=b.masks.map((_,i)=>{
  const role=i===b.source?'source':b.receivers.includes(i)?'receiver':b.alarms.includes(i)?'alarm':'wire',mask=status.masks[i];
  const ends=[[1,24,0,'north'],[2,48,24,'east'],[4,24,48,'south'],[8,0,24,'west']].filter(e=>mask&e[0]);
  const label=`Row ${Math.floor(i/b.w)+1}, column ${i%b.w+1}. ${role}. Wires ${ends.map(e=>e[3]).join(', ')}. ${powered.has(i)?'Powered.':'Dark.'} Rotate clockwise.`;
  return `<button class="circuit-tile ${role} ${powered.has(i)?'powered':''}" data-action="field-circuit" data-index="${i}" aria-label="${esc(label)}"><svg viewBox="0 0 48 48" aria-hidden="true">${ends.map(e=>`<path d="M24 24L${e[1]} ${e[2]}"/>`).join('')}<circle cx="24" cy="24" r="${role==='wire'?3:8}"/>${role==='source'?'<path class="terminal" d="M22 18L18 25H24L22 31L30 22H24L26 18"/>':role==='receiver'?'<rect class="terminal" x="21" y="21" width="6" height="6"/>':role==='alarm'?'<path class="terminal" d="M21 20L27 28M27 20L21 28"/>':''}</svg><small>${Math.floor(i/b.w)+1}.${i%b.w+1}</small></button>`;
 }).join('');
 return `<div class="circuit-layout"><div class="circuit-grid" style="--circuit-cols:${b.w}" role="group" aria-label="Wire circuit. Select a tile to rotate it clockwise.">${tiles}</div><aside class="circuit-key"><p><strong>◆ Gold source</strong><br>Power starts here.</p><p><strong>□ Blue receivers</strong><br>Connect all of them.</p><p><strong>× Red alarms</strong><br>Keep these tiles dark.</p><p>Select a tile to turn it clockwise. Wires join only when their ends meet.</p><p class="circuit-status ${status.alarms.length?'alarm':''}" role="status" aria-live="polite">${status.receivers.length} / ${b.receivers.length} receivers powered.<br>${status.alarms.length?status.alarms.length+' alarms powered.':'All alarms are dark.'}</p></aside></div><p class="muted">Each turn is saved. Use Tab to choose a tile, then Enter or Space to turn it.</p><div class="panel-actions">${iconButton('Test the circuit','field-check','',true)}${iconButton('Reset this board','field-circuit-reset')}</div>`;
}
function renderChallenge(){
 const c=A.currentChallenge();if(!c){close();return;}
 const key=c.missionId+':'+c.stageId;
 if(key!==challengeKey){challengeKey=key;challengeFeedback='';challengeDraft=['tune','allocate'].includes(c.kind)?c.labels.map(()=>0):c.kind==='sort'?c.items.map(()=>-1):[];}
 if(Array.isArray(c.draft))challengeDraft=c.draft.slice();
 let controls='';
 if(c.kind==='circuit')controls=circuitControls(c);
 if(c.kind==='puzzle')controls=`<div class="field-answers">${c.options.map((option,i)=>`<button data-action="field-answer" data-index="${i}"><span>${i+1}</span>${esc(option)}</button>`).join('')}</div>`;
 if(c.kind==='sequence')controls=`<div class="sequence-slots" aria-label="Your sequence">${c.order.map((_,i)=>`<span class="${challengeDraft[i]!==undefined?'filled':''}">${challengeDraft[i]!==undefined?esc(c.labels[challengeDraft[i]]):i+1}</span>`).join('')}</div><div class="field-answers compact">${c.labels.map((label,i)=>`<button data-action="field-note" data-index="${i}" ${challengeDraft.length>=c.order.length?'disabled':''}>${esc(label)}</button>`).join('')}</div><div class="panel-actions">${iconButton('Check sequence','field-check',challengeDraft.length!==c.order.length?'disabled':'',true)}${iconButton('Clear sequence','field-clear')}</div>`;
 if(c.kind==='tune')controls=`<div class="field-dials">${c.labels.map((label,i)=>`<section><h3>${esc(label)}</h3><output aria-live="polite">${challengeDraft[i]}</output><div><button data-action="field-dial" data-index="${i}" data-delta="-1" aria-label="Lower ${esc(label)}">−</button><button data-action="field-dial" data-index="${i}" data-delta="1" aria-label="Raise ${esc(label)}">+</button></div></section>`).join('')}</div><p class="dial-hint">Each dial has four positions: 0, 1, 2, and 3.</p><div class="panel-actions">${iconButton('Test the settings','field-check','',true)}</div>`;
 if(c.kind==='sort')controls=`<div class="field-sort">${c.items.map((item,i)=>`<label><span>${esc(item)}</span><select data-field-sort="${i}" aria-label="Place ${esc(item)}"><option value="-1">Choose a place…</option>${c.bins.map((bin,j)=>`<option value="${j}" ${challengeDraft[i]===j?'selected':''}>${esc(bin)}</option>`).join('')}</select></label>`).join('')}</div><div class="panel-actions">${iconButton('Check the work','field-check','',true)}</div>`;
 if(c.kind==='allocate'){
  const used=challengeDraft.reduce((n,x)=>n+x,0),remaining=c.total-used;
  controls=`<div class="allocation-budget ${remaining<0?'over-budget':''}" role="status" aria-live="polite"><strong>${remaining}</strong><span>supplies left · ${used} of ${c.total} assigned</span></div><div class="field-dials allocation-dials">${c.labels.map((label,i)=>`<section><h3>${esc(label)}</h3><output>${challengeDraft[i]}</output><p>Needs ${c.min?.[i]||0}–${c.max?.[i]??c.total}</p><div><button data-action="field-allocate" data-index="${i}" data-delta="-1" ${challengeDraft[i]===0?'disabled':''} aria-label="Give one less to ${esc(label)}">−</button><button data-action="field-allocate" data-index="${i}" data-delta="1" ${challengeDraft[i]>=(c.max?.[i]??c.total)?'disabled':''} aria-label="Give one more to ${esc(label)}">+</button></div></section>`).join('')}</div><p class="dial-hint">Use every supply. Meet each crew's minimum and capacity. Your chosen plan will stay in the journal.</p><div class="panel-actions">${iconButton('Send the supplies','field-check','',true)}</div>`;
 }
 panel(c.title,'FIELD WORK · '+({puzzle:'READ THE EVIDENCE',sequence:'SET THE ORDER',tune:'BALANCE THE READINGS',sort:'MATCH EACH RECORD',allocate:'DIVIDE THE SUPPLIES',circuit:'CONNECT THE SIGNAL'})[c.kind],`<div class="field-challenge"><p class="panel-intro">${esc(c.description)}</p><div class="challenge-clue"><span class="eyebrow">LOCAL CLUE</span><p>${esc(c.clue)}</p></div><h3>${esc(c.prompt)}</h3>${controls}<p class="challenge-feedback" role="status" aria-live="polite">${esc(challengeFeedback)}</p><p class="muted">${c.kind==='puzzle'?'You can leave and return to this field step.':'Each change is saved. You can leave and return to your unfinished work.'} A wrong answer keeps the current work safe.</p></div>`);
}
function saveChallengeDraft(){const result=A.setChallengeDraft(challengeDraft);if(!result.ok)challengeFeedback=result.reason;}
function renderWorkboard(){
 const info=CC.Workboard.query(A,workOptions),labels={available:'Available',nearby:'At this place',started:'In progress',complete:'Complete',all:'All stories'};
 const cards=info.rows.map(({q,status:st,place,available,here})=>{
  const ready=available&&!st.complete,next=st.started?st.step?.title:q.objective,arc=info.arcs.find(a=>a.id===(D.chapters.includes(q)?'main1':D.quests.includes(q)?'main2':q.arc));
  return `<article class="work-card ${ready?'ready':''} ${st.complete?'complete':''}"><header><span class="eyebrow">${esc(arc?.title||'FIELD STORY')}</span>${badge(st.complete?'COMPLETE':available?st.started?'IN PROGRESS':'AVAILABLE':'LOCKED',st.complete?'green':available?'gold':'')}</header><h3>${esc(q.title)}</h3><p class="work-place">${esc(place.name)} · Level ${place.level}${here?' · You are here':''}</p><p>${esc(next||q.objective)}</p><div class="work-progress"><span>${st.index} / ${st.total} stages</span><progress value="${st.index}" max="${st.total}" aria-label="${esc(q.title)} progress"></progress></div>${ready?`<div class="panel-actions">${here?iconButton(st.started?'Resume on mission map':'Read briefing',st.started?'show-mission-map':'begin-field',`data-id="${q.id}"`,true):iconButton('Track and set course','work-course',`data-id="${q.id}"`,true)}${iconButton('Read journal entry','work-record',`data-id="${q.id}"`)}</div>`:st.complete?iconButton('Read outcome','work-record',`data-id="${q.id}"`):`<p class="locked-hint">${esc(lockedMissionHint(q))}</p>`}</article>`;
 }).join('');
 panel('Available work','SIDE ROADS · SHARED WORK · STORIES',`<p class="panel-intro">Find work by place, story name, or current task. Available work includes its finished prerequisites. Stories at your present location come first.</p><div class="work-search"><label for="work-search">Find a story<input id="work-search" type="search" maxlength="120" value="${esc(info.search)}" placeholder="Try Low Quay, cargo, or a story name" autocomplete="off"></label><label for="work-arc">Story thread<select id="work-arc"><option value="">Every thread</option>${info.arcs.map(a=>`<option value="${a.id}" ${info.arc===a.id?'selected':''}>${esc(a.title)}</option>`).join('')}</select></label></div><nav class="work-filters" aria-label="Filter stories">${Object.entries(labels).map(([id,label])=>`<button data-action="work-filter" data-id="${id}" aria-pressed="${info.filter===id}" class="${info.filter===id?'selected':''}">${label} <span>${info.counts[id]}</span></button>`).join('')}</nav><div class="panel-actions">${iconButton('Clear search and filters','work-reset')}</div><p class="work-count" role="status" aria-live="polite">${info.rows.length} matching stories · ${info.total} in the journey</p><div class="work-list">${cards||'<div class="info-card"><h3>No work matches these filters.</h3><p>Try another search, choose Every thread, or show All stories to see their prerequisites.</p>'+iconButton('Clear filters','work-reset')+'</div>'}</div><div class="panel-actions">${iconButton('Full field journal','journal')}${iconButton('World chart','chart')}</div>`);
}
function heroChanges(rows){
 return `<div class="preparation-table"><table><caption>Company after this change</caption><thead><tr><th>Companion</th><th>HP</th><th>MP</th></tr></thead><tbody>${(rows||[]).map(h=>`<tr><th>${esc(h.name)}</th><td>${Math.ceil(h.hp.before)} → ${Math.ceil(h.hp.after)} <small>/ ${h.hp.max}</small></td><td>${Math.ceil(h.mp.before)} → ${Math.ceil(h.mp.after)} <small>/ ${h.mp.max}</small></td></tr>`).join('')}</tbody></table></div>`;
}
function renderPreparation(){
 const rows=A.loadoutInfo(),review=loadoutReview,gearName=id=>esc(R.equipment[id]?.name||R.echoes[id]?.name||'None');
 const preview=review?`<section class="preparation-review" aria-label="Formation preview"><span class="eyebrow">REVIEW FORMATION</span><h3>${esc(review.name||'Saved company')}</h3>${review.ok?`<p>Active company: ${review.party.map(id=>esc(R.heroes[id].name)).join(', ')}.</p>${heroChanges(review.heroes)}<div class="loadout-gear">${review.heroes.filter(h=>review.party.includes(h.id)).map(h=>`<p><strong>${esc(h.name)}</strong><br>${['weapon','armor','relic','echo'].map(slot=>gearName(h.gear[slot])).join(' · ')}</p>`).join('')}</div>${review.moves.length?`<h4>Equipment to move</h4><ul>${review.moves.map(m=>`<li>${esc(m.name)}: ${esc(R.heroes[m.from].name)} → ${esc(R.heroes[m.to].name)}</li>`).join('')}</ul>`:'<p>No equipment is needed from a reserve companion.</p>'}${review.bagChanges.length?`<details><summary>Changes to loose equipment</summary>${review.bagChanges.map(item=>`<p>${esc(item.name)}: ${item.before} → ${item.after}</p>`).join('')}</details>`:''}<div class="panel-actions">${iconButton('Apply this formation','loadout-apply',`data-slot="${review.slot}"`,true)}${iconButton('Close preview','loadout-cancel')}</div>`:`<p role="status">${esc(review.reason)}</p>${(review.reasons||[]).slice(1).map(reason=>`<p>${esc(reason)}</p>`).join('')}`}</section>`:'';
 panel('Prepare the company','THREE SAVED FORMATIONS',`<p class="panel-intro">Keep three named party and equipment setups. Review a setup before you apply it. The preview shows any items needed from reserves and any change to HP or MP limits.</p><div class="panel-actions">${iconButton('Edit the current company','party')}${iconButton('Recover with items','recovery')}${iconButton('Drift Court trials','trials')}</div>${preview}<div class="loadout-slots">${rows.map(({slot,saved})=>`<article class="info-card"><span class="eyebrow">FORMATION ${slot+1}</span><h3>${esc(saved?.name||'Empty slot')}</h3><p>${saved?saved.party.map(id=>esc(R.heroes[id].name)).join(' · '):'Save the current party, equipment, and Echoes here.'}</p><label class="loadout-name" for="loadout-name-${slot}">Formation name<input id="loadout-name-${slot}" maxlength="32" value="${esc(saved?.name||'Formation '+(slot+1))}" autocomplete="off"></label><div class="panel-actions">${iconButton(saved?'Replace with current company':'Save current company','loadout-save',`data-slot="${slot}"`)}${saved?iconButton('Review formation','loadout-preview',`data-slot="${slot}"`,true):''}</div>${saved?iconButton('Remove this saved slot','loadout-remove',`data-slot="${slot}"`):''}</article>`).join('')}</div><p class="muted">A setup can use only items you still own. Missing companions and equipment assigned to other final teams stay protected. Leave a final team path before you restore a formation.</p>`);
}
function renderRecovery(){
 recoveryReview=A.recoveryPreview(recoveryOptions);const r=recoveryReview;
 panel('Recover the company','USE THE ITEMS IN YOUR PACK',`<p class="panel-intro">Revive fallen allies first, then help the ally with the lowest HP percentage. You can also include Ether for MP. Review the exact cost below. A waystone gives a free full rest when you return to it.</p><label class="team-pick"><input type="checkbox" id="recovery-mp" ${recoveryOptions.mp?'checked':''}> Include Ether for MP</label>${r.ok?`${heroChanges(r.heroes)}<h3>Items to use</h3>${r.costs.length?`<div class="recovery-costs">${r.costs.map(item=>`<div class="info-card"><strong>${esc(item.name)} × ${item.count}</strong><p>${item.owned} in pack → ${item.remaining} left</p></div>`).join('')}</div>`:`<p>${esc(r.reason||'No items needed.')}</p>`}${r.unmet.length?`<div class="recovery-unmet"><h4>Still needed after recovery</h4><ul>${r.unmet.map(line=>`<li>${esc(line)}</li>`).join('')}</ul></div>`:''}${r.steps.length?`<details><summary>Item order · ${r.steps.length} uses</summary><ol>${r.steps.map(step=>`<li>${esc(step.name)} → ${esc(R.heroes[step.target].name)}</li>`).join('')}</ol></details>`:''}<div class="panel-actions">${iconButton(r.complete?'Use these items':'Use items for partial recovery','recovery-apply',r.canApply?'':'disabled',r.canApply)}${iconButton('Return to pack','pack')}${iconButton('Saved formations','preparation')}</div>`:`<p role="status">${esc(r.reason)}</p>`}`);
}
function renderParty(){
 const s=A.state,ids=A.available();partyDraft ||=s.party.slice();
 panel('The company','EQUIPMENT · ECHOES · FORMATION',`<p class="panel-intro">Choose up to four companions. Reserves gain full experience. Equip an Echo to learn its spells after battles. Each Echo can have one keeper.</p><div class="panel-actions" style="margin:0 0 22px">${iconButton('Apply formation','formation','',true)}${iconButton('Companion bonds','bonds')}${iconButton('Workshop','workshop')}${iconButton('Saved formations','preparation')}${iconButton('Recover with items','recovery')}<span class="muted" style="font-size:11px">${partyDraft.length} / 4 selected</span>${s.act===2?badge(ids.length+' / '+Object.keys(R.heroes).length+' found','gold'):''}</div><div class="panel-grid">${ids.map(id=>{const h=s.roster[id],st=R.getStats(s,id),hero=R.heroes[id];return `<article class="info-card"><div class="character-detail">${portrait(id,true)}<div><h3>${esc(hero.name)} ${badge('Lv '+h.level)}</h3><p>${esc(hero.role)}${st.awakened?' · Voice restored':''}</p><p>${esc(hero.description)}</p><label class="team-pick"><input type="checkbox" data-party="${id}" ${partyDraft.includes(id)?'checked':''}> Active company</label></div></div>${bar('HP',h.hp,st.maxHp)}${bar('MP',h.mp,st.maxMp,'mp')}<div class="stats-row"><span>ATK <strong>${st.atk}</strong></span><span>MAG <strong>${st.mag}</strong></span><span>DEF <strong>${st.def}</strong></span><span>SPD <strong>${st.spd}</strong></span></div>${['weapon','armor','relic','echo'].map(slot=>{
 const pool=slot==='echo'?s.echoes.map(x=>R.echoes[x]):Object.values(R.equipment).filter(e=>e.slot===slot&&((s.bag[e.id]||0)>0||h[slot]===e.id));
 return `<label class="equip-row"><span>${slot[0].toUpperCase()+slot.slice(1)}</span><select data-equip="${id}" data-slot="${slot}"><option value="">None</option>${pool.map(item=>{const key=item.id||Object.keys(R.echoes).find(k=>R.echoes[k]===item),owner=slot==='echo'?Object.keys(s.roster).find(k=>s.roster[k].echo===key):null;return `<option value="${key}" ${h[slot]===key?'selected':''}>${esc(item.name)}${owner&&owner!==id?' · '+R.heroes[owner].name:''}</option>`;}).join('')}</select></label>`;
 }).join('')}<div class="spell-list">${h.echo?`<p>${esc(R.echoes[h.echo].name)}: ${R.echoes[h.echo].learn.map(l=>`${esc(R.skills[l.skill].name)} ${Math.min(h.ap[l.skill]||0,l.ap)}/${l.ap} AP`).join(' · ')}</p>`:''}<strong>Skills:</strong> ${hero.unique.map(id=>esc(R.skills[id].name)).join(', ')}<br><strong>Magic:</strong> ${R.knownSpells(s,id).map(x=>esc(R.skills[typeof x==='string'?x:x.id]?.name||x)).join(', ')||'No learned spells yet.'}${st.awakened?`<p>${esc(st.questBonus)}</p>`:''}</div></article>`;}).join('')}</div>${ids.length<8&&s.act===2?'<p style="margin-top:20px">The journal holds clues to the missing companions.</p>':''}`);
}
function renderPack(){
 const s=A.state;
 panel('The travel pack','SUPPLIES & EQUIPMENT',`<p class="panel-intro">Use supplies between battles. A green waystone restores all HP and MP at no cost.</p>${Object.values(R.items).map(item=>`<article class="item-row"><div><strong>${esc(item.name)} ${badge('× '+(s.bag[item.id]||0))}</strong><p>${esc(item.description)}</p></div><div class="item-controls"><select id="target-${item.id}" aria-label="Target for ${esc(item.name)}">${s.party.map(id=>`<option value="${id}">${esc(R.heroes[id].name)} · ${Math.ceil(s.roster[id].hp)} HP</option>`).join('')}</select>${iconButton('Use','use',`data-id="${item.id}" ${(s.bag[item.id]||0)<1?'disabled':''}`)}</div></article>`).join('')}<div class="panel-actions">${iconButton('Recover with items','recovery','',true)}${iconButton('Saved formations','preparation')}${iconButton('Open workshop','workshop')}${iconButton('Companion bonds','bonds')}</div><h3 style="margin-top:25px">Loose equipment</h3><p>Open Company to equip these items. Equipped items remain with their keeper.</p>${Object.entries(s.bag).filter(([id,n])=>R.equipment[id]&&n>0).map(([id,n])=>`<article class="item-row"><div><strong>${esc(R.equipment[id].name)} ${badge('× '+n)}</strong><p>${esc(R.equipment[id].description)}</p></div><span class="muted">${R.equipment[id].slot}</span></article>`).join('')||'<p>No loose equipment.</p>'}`);
}
function renderShop(){
 const tier=panelData.tier||0,s=A.state;
 const gear=Object.values(R.equipment).filter(e=>!e.craftOnly&&e.price<=([350,750,1600,2500][tier]||2500));
 panel('The supply counter',s.gold+' GOLD',`<p class="panel-intro">Buy supplies and equipment. Sell loose items for half their price. All weapons can be used by all companions.</p><div class="panel-grid"><div><h3>For sale</h3>${[...Object.values(R.items),...gear].map(item=>`<article class="item-row"><div><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p></div><div class="item-controls"><span class="price">${item.price}g</span>${iconButton('Buy','buy',`data-id="${item.id}" ${s.gold<item.price?'disabled':''}`)}</div></article>`).join('')}</div><div><h3>Your loose items</h3>${Object.entries(s.bag).filter(([id,n])=>n>0&&(R.items[id]||R.equipment[id])).map(([id,n])=>{const item=R.items[id]||R.equipment[id];return `<article class="item-row"><div><strong>${esc(item.name)}</strong><p>In the pack: ${n}</p></div><div class="item-controls"><span class="price">${Math.floor(item.price/2)}g</span>${iconButton('Sell one','sell',`data-id="${id}"`)}</div></article>`;}).join('')}</div></div>`);
}
function renderWorkshop(){
 const s=A.state,info=A.workshopInfo(),ready=F.workshopUnlocked(s);
 const materialText=costs=>Object.entries(costs||{}).map(([id,n])=>n+' '+(F.materials[id]?.name||id)).join(' · ');
 const recipes=info.recipes.map(recipe=>{
  const gear=R.equipment[recipe.gear],status=F.recipeStatus(s,recipe.id),keepers=Object.values(s.roster).filter(h=>h[gear.slot]===gear.id).length;
  return `<article class="recipe-card ${status.unlocked?'':'locked'}"><header><span class="eyebrow">${esc(gear.slot)}</span>${badge(status.unlocked?'PATTERN LEARNED':'PATTERN LOCKED',status.unlocked?'green':'')}</header><h3>${esc(gear.name)}</h3><p>${esc(gear.description||recipe.description)}</p><div class="recipe-costs">${Object.entries(recipe.costs).map(([id,n])=>badge((s.frontier.materials[id]||0)+' / '+n+' '+F.materials[id].name,(s.frontier.materials[id]||0)>=n?'green':'')).join('')}${badge(recipe.gold+' gold',s.gold>=recipe.gold?'green':'')}</div><p class="recipe-owned">In pack: ${s.bag[gear.id]||0} · Equipped: ${keepers}</p><p class="recipe-status">${esc(status.unlocked?(status.canCraft?'Ready to make.':status.reason||status.reasons.join(' ')):recipe.unlockText)}</p>${iconButton('Craft '+esc(gear.name),'craft',`data-id="${recipe.id}" ${status.canCraft?'':'disabled'}`,status.canCraft)}</article>`;
 }).join('');
 const salvage=Object.entries(s.bag).filter(([id,n])=>R.equipment[id]&&n>0).map(([id,n])=>{const result=A.salvageYield(id,1);return result.ok?`<article class="item-row"><div><strong>${esc(R.equipment[id].name)} ${badge('× '+n)}</strong><p>Salvage one for ${esc(materialText(result.materials))}.</p></div>${iconButton('Salvage one','salvage',`data-id="${id}" ${ready?'':'disabled'}`)}</article>`:'';}).join('');
 panel('The Wren workshop','PATTERNS · MATERIALS · SALVAGE',`<p class="panel-intro">${ready?'The workbench travels with the company. Craft between battles, then equip the item in Company.':'Restore The Wren in Act II, then finish A Harbor beyond the Storm to open the workbench.'} Missions teach patterns and supply materials. You can buy extra materials or salvage loose gear.</p><div class="workshop-heading"><span class="collection-number">${s.gold.toLocaleString()}<small> gold</small></span>${iconButton('Equip the company','party')}${iconButton('Companion bonds','bonds')}</div><details class="workshop-stock" open><summary>Material stores · ${info.materials.reduce((n,m)=>n+m.owned,0)} pieces</summary><div class="material-grid">${info.materials.map(m=>`<article><h3>${esc(m.name)} ${badge('× '+m.owned,'gold')}</h3><p>${esc(m.source)}</p><div>${badge(m.price+' gold')}${iconButton('Buy one','buy-material',`data-id="${m.id}" ${ready&&s.gold>=m.price?'':'disabled'}`)}</div></article>`).join('')}</div></details><h3>Equipment patterns</h3><p>All weapons fit every companion. A signature pattern supports its companion's style, but you choose who carries it.</p><div class="recipe-grid">${recipes}</div><details class="workshop-salvage"><summary>Salvage loose equipment</summary><p>Each action consumes one loose item and gives the materials shown. Equipped items stay with their keeper.</p>${salvage||'<p>No loose equipment can be salvaged yet.</p>'}</details>`);
}
function renderBonds(){
 const s=A.state,info=A.workshopInfo();
 panel('The ties that hold','COMPANION STORIES · PAIR TECHNIQUES',`<p class="panel-intro">The Far Reach opens a personal story for each companion. The cards show where to meet. Finish a story to learn a pair technique, then bring both companions into the active company to use it.</p><div class="bond-rules"><p>A pair attack needs both allies alive, 6 MP from each, 40 Chorus, and at least 50 ATB on the partner. Some crafted equipment reduces the Chorus cost. Choose the technique from Pairs when either member is ready.</p><p>Both voices act together. The partner spends 50 ATB, so time the attack around enemy intent and Break openings.</p></div><div class="panel-grid">${info.bonds.map(b=>{const q=A.allTasks().find(q=>q.id===b.flag),active=b.members.every(id=>s.party.includes(id));return `<article class="bond-card ${b.unlocked?'learned':''}"><div class="bond-portraits">${b.members.map(id=>portrait(id)).join('')}</div><span class="eyebrow">${b.members.map(id=>esc(R.heroes[id].name)).join(' + ')}</span><h3>${esc(R.skills[b.skill].name)}</h3><p>${esc(b.description)}</p>${badge(b.unlocked?'TECHNIQUE LEARNED':'STORY TO COMPLETE',b.unlocked?'green':'')}${b.unlocked?badge(active?'BOTH IN COMPANY':'CHANGE FORMATION',active?'gold':''):''}<p>${q?esc(q.title)+' · '+esc(A.places[q.place].name):''}</p><div class="panel-actions">${b.unlocked?iconButton('Choose formation','party'):q&&A.taskAvailable(q)?iconButton('Track this story','track',`data-id="${q.id}"`,true):''}${iconButton('Read the journal','journal')}</div>${!b.unlocked&&q?`<small>${esc(lockedMissionHint(q))}</small>`:''}</article>`;}).join('')}</div>`);
}
function lockedMissionHint(q){
 if(q.postgame&&!A.state.flags.victory)return 'Complete the main story to begin this arc.';
 if(q.act===2&&A.state.act===1)return 'This story begins after the world changes.';
 const requirements=Array.isArray(q.requires)?q.requires:q.requires?[q.requires]:[];
 const p=A.places[q.place],missing=[...requirements,...(p&&!A.unlocked(p)?[p.unlock]:[])].filter(r=>!A.allow(r));
 const all=[...D.chapters,...D.quests,...A.missions()];
 const titles=missing.map(r=>typeof r==='number'?D.chapters[r-1]?.title:r==='act2'?'Reach the second act':all.find(t=>t.id===r||t.reward?.flag===r)?.title).filter(Boolean);
 return titles.length?'Complete: '+[...new Set(titles)].join('; ')+'.':'Open this route through the central story.';
}
function missionRecord(q){
 const s=A.state,st=A.missionStatus(q),def=st.definition,answer=q.decision?.options[s.missionProgress.choices[q.id]],isHere=q.place===s.location&&A.game.sceneName==='field';
 const active=A.activeTask()?.id===q.id;
 return `<details class="mission-record ${st.complete?'complete':active?'active':''}" ${active?'open':''}><summary><span><small>${esc(A.places[q.place].name)}</small><strong>${esc(q.title)}</strong></span><span class="mission-count">${st.complete?'✓':st.available?st.index+'/'+st.total:'—'}</span></summary><p>${esc(def.objective)}</p>${preparationNote(q)}<div>${badge(st.complete?'COMPLETE':st.available?st.started?'IN PROGRESS':'BRIEFING AVAILABLE':'LOCKED',st.complete?'green':st.available?'gold':'')}${q.finalBranch?badge('TEAM PATH','gold'):''}${q.optional?badge('OPTIONAL'):''}</div>${st.started||st.complete?`<details class="field-records"><summary>Briefing</summary>${def.briefing.map(line=>`<p><strong>${esc(R.heroes[line.speaker]?.name||line.speaker)}:</strong> ${esc(line.text)}</p>`).join('')}</details>${objectiveList(q)}${st.evidence.length?`<details class="field-records"><summary>Evidence collected · ${st.evidence.length}</summary>${st.evidence.map(e=>`<h4>${esc(e.title)}</h4><p>${esc(e.text)}</p>`).join('')}</details>`:''}`:''}${(A.missionPlans?.(q)||[]).map(plan=>`<div class="saved-plan"><strong>${esc(plan.title)}</strong><p>${plan.labels.map((label,i)=>esc(label)+': '+plan.values[i]).join(' · ')}</p></div>`).join('')}${answer?`<p class="saved-choice">Your choice: ${esc(answer.label)}</p>`:''}${st.complete?`<div class="mission-outcome"><h4>${esc(def.outcome.title)}</h4><p>${esc(def.outcome.text)}</p></div>`:st.available?`<div class="panel-actions">${isHere&&!st.started?iconButton('Read briefing','begin-field',`data-id="${q.id}"`,true):iconButton('Track mission','track',`data-id="${q.id}"`,true)}${isHere?iconButton('Mission map','show-mission-map',`data-id="${q.id}"`):iconButton('Set course','navigate',`data-id="${q.place}"`)}</div>`:`<p class="locked-hint">${esc(lockedMissionHint(q))}</p>`}</details>`;
}
function renderJournal(){
 const s=A.state,all=A.allTasks(),completed=all.filter(q=>s.flags[q.id]).length,doneStages=all.reduce((n,q)=>n+A.missionStatus(q).index,0),totalStages=all.reduce((n,q)=>n+A.missionStatus(q).total,0);
 const group=(title,kicker,list,description='')=>{
  const active=list.some(q=>q.id===A.activeTask()?.id),done=list.filter(q=>s.flags[q.id]).length;
  return `<details class="story-arc" ${active?'open':''}><summary><span><small>${esc(kicker)}</small><strong>${esc(title)}</strong></span><span class="arc-count">${done}/${list.length}</span></summary>${description?`<p>${esc(description)}</p>`:''}${list.map(missionRecord).join('')}</details>`;
 };
 panel('The field journal','BRIEFINGS · EVIDENCE · OUTCOMES',`<div class="journal-summary"><div><span class="eyebrow">THE WORK THAT REMAINS</span><h3>Every road has a story.</h3><p>Begin with a field briefing. Use the mission map to follow each step. Your notes, choices, and finished work remain here.</p><p>${doneStages} of ${totalStages} field stages complete.</p></div><span class="journal-total">${completed}<small>/ ${all.length} stories</small></span></div><div class="panel-actions">${iconButton('Search available work','work','',true)}</div>${group('The Borrowed Voices','ACT I · THE CENTRAL STORY',D.chapters)}${group('The Unwritten World','ACT II · RECOVERY AND THE FINAL PATHS',D.quests)}${(D.arcs||[]).map(arc=>group(arc.title,arc.postgame?'AFTER THE ENDING':arc.act===1?'THE FIRST JOURNEY':'AFTER THE FALL',A.missions().filter(q=>q.arc===arc.id),arc.description)).join('')}`);
}
function renderCodex(){
 const s=A.state,bestiary=s.bestiary||{};
 panel('Echoes & field lore','THE VOICES YOU CARRY',`<div class="panel-grid"><div class="info-card"><span class="collection-number">${s.echoes.length} / ${Object.keys(R.echoes).length}</span><p>Echoes found</p></div><div class="info-card"><span class="collection-number">${Object.keys(bestiary).length} / ${Object.keys(R.enemies).length}</span><p>Enemy types met</p></div></div><h3 style="margin-top:25px">The Echo collection</h3><p>Equip an Echo in Company. Battles grant AP. Learned spells remain when you change Echoes. Each equipped Echo can answer once per battle.</p><div class="panel-grid">${s.echoes.map(id=>{const e=R.echoes[id];return `<article class="info-card"><h3>${esc(e.name)}</h3><p>${esc(e.description||e.lore||'A stored voice with a living choice.')}</p>${badge(e.element)}<p>Teaches ${e.learn.map(l=>esc(R.skills[l.skill].name)+' ('+l.ap+' AP)').join(' and ')}.</p><p>${esc(e.summonDescription||e.summon?.description||'Call this Echo once in each battle from the Echo command group.')}</p></article>`;}).join('')}</div><h3 style="margin-top:28px">Field guide</h3>${Object.keys(bestiary).length?`<div class="panel-grid">${Object.keys(bestiary).filter(id=>R.enemies[id]).map(id=>{const e=R.enemies[id];return `<article class="info-card"><h3>${esc(e.name)}</h3><p>${e.boss?'Major encounter.':'A voice met on the road.'}</p>${badge('Weak: '+(e.weak?.join(', ')||'none'))}${e.resist?.length?badge('Resists: '+e.resist.join(', ')):''}${e.hint?`<p>${esc(e.hint)}</p>`:''}${e.phases?.length?`<details><summary>Changes during this encounter</summary>${e.phases.map(phase=>`<h4>${esc(phase.name)} · ${Math.round(phase.at*100)}% HP</h4><p>${esc(phase.hint||'Watch the next intent.')}</p>${badge('Weak: '+(phase.weak?.join(', ')||'none'))}`).join('')}</details>`:''}</article>`;}).join('')}</div>`:'<p>The field guide grows after each new encounter.</p>'}<h3 style="margin-top:28px">Local records you have read</h3>${A.localRecords().map(o=>`<details><summary>${esc(o.label)} · ${esc(o.place)} · Act ${o.act}</summary><p>${esc(o.text)}</p></details>`).join('')||'<p>Read signs and explore side rooms to keep their records here.</p>'}<h3 style="margin-top:28px">World landmarks you have read</h3>${A.landmarkRecords().map(o=>`<details><summary>${esc(o.title)} · Act ${o.act}</summary><p>${esc(o.text)}</p></details>`).join('')||'<p>Read the stone markers beside the world roads to keep their stories here.</p>'}<h3 style="margin-top:28px">What the world remembers</h3>${D.lore.filter((_,i)=>s.act===2||i<=s.chapter).map(e=>`<details><summary>${esc(e.title)}</summary><p>${esc(e.text)}</p></details>`).join('')}`);
}
function renderSaves(){
 const scene=A.game.sceneName,canSave=A.started&&['field','overworld'].includes(scene);
 panel('Keep this journey','SAVE & RESTORE',`<p class="panel-intro">The game saves after each field stage, story event, treasure, rest, and journey. It keeps partial collections, escort positions, field puzzle inputs, and three saved formations. It also saves your position as you cross the overworld. Manual slots let you keep separate points in the journey.</p>${['auto','1','2','3','recovery'].map(slot=>{const s=A.readSlot(slot),name=slot==='auto'?'Automatic save':slot==='recovery'?'Previous journey':'Save slot '+slot;return `<article class="save-row"><div><h3>${name}</h3><p>${s?`Act ${s.act} · ${esc(s.overworld?.active?'Overworld · '+s.overworld.vehicle:A.places[s.location].name)} · ${Math.floor(s.playTime/60)} min<br>${new Date(s.savedAt).toLocaleString()}`:'Empty slot'}</p></div><div class="panel-actions">${slot!=='auto'&&slot!=='recovery'?iconButton('Save here','save-slot',`data-slot="${slot}" ${!canSave?'disabled':''}`):''}${iconButton('Load','load-slot',`data-slot="${slot}" ${!s?'disabled':''}`)}</div></article>`;}).join('')}<div class="panel-actions">${iconButton('Export save','export',''+(!canSave?'disabled':''))}${iconButton('Import save','import')}${A.started?iconButton('Return to title','title'):''}</div><p style="font-size:10px;margin-top:14px">Export makes a JSON file. Keep it if this browser blocks storage or if you want to move your journey to another browser.</p>`);
}
function renderTeams(){
 const names=['Root team','Name team','Bell team'];
 panel('Three paths, one company','THE FINAL ASSAULT',`<p class="panel-intro">Choose two to four different companions for each team. Each path keeps its own party. Activate its relays to send power to another path.</p><p>Root opens Name. Name opens Bell. Bell opens Root. You can change paths from the world chart at any time.</p><div class="team-columns">${names.map((name,i)=>`<section class="team-column"><h3>${name}</h3>${A.available().map(id=>`<label class="team-pick"><input type="checkbox" data-team="${i}" data-id="${id}" ${teamDraft[i].includes(id)?'checked':''}>${esc(R.heroes[id].name)}</label>`).join('')}</section>`).join('')}</div><div class="panel-actions">${iconButton('Set the teams','set-teams','',true)}${iconButton('Spread evenly','auto-teams')}</div><p style="font-size:10px;margin-top:15px">Make sure each team has a healing spell or enough items. Echoes can move between companions from the Company panel.</p>`);
}
function renderTrials(){
 const rows=A.trialInfo();
 panel('Drift Court trials','FIXED FOES · TWO PRACTICE MODES',`<p class="panel-intro">Complete each trial story in Drift Court to open repeat practice. Win for Bronze. Meet some goals for Silver, or all goals for Gold. Each mode keeps its own best result.</p><div class="trial-mode-rules"><p><strong>Current level:</strong> use your company at its campaign levels.</p><p><strong>Matched level:</strong> cap active and reserve levels at the trial level. A lower level stays lower. Gear and learned spells stay equipped. The campaign keeps its levels, HP, MP, items, and experience.</p></div><p>The first victory gives the listed prize once across both modes.</p><div class="panel-actions">${iconButton('Saved formations','preparation')}${iconButton('Visit the trial court','navigate','data-id="driftcourt"')}${iconButton('Available work','work')}</div><div class="panel-grid">${rows.map(t=>{
  const q=A.allTasks().find(q=>q.id===t.id);
  const modes=['current','matched'].map(mode=>{
   const record=t.modeRecords?.[mode],best=record?.best,label=mode==='current'?'Current level':'Matched level';
   return `<section class="trial-mode"><h4>${label} ${badge(record?.medal||'No medal',record?.grade===3?'gold':'')}</h4>${best?`<p>Best on ${esc(R.difficulties[record.difficulty]?.name||'Normal')}: ${best.actions} actions · ${best.weaknessHits} weakness hits · ${best.breaks} Breaks.</p>`:'<p>No victory in this mode.</p>'}<small>${record?.attempts||0} attempts</small>${t.practiceReady?`<div class="panel-actions">${iconButton('Practice · '+label.toLowerCase(),'practice-trial',`data-id="${t.id}" data-mode="${mode}"`,mode==='matched')}</div>`:''}</section>`;
  }).join('');
  return `<article class="info-card trial-card"><span class="eyebrow">LEVEL ${t.encounter.level} · ${t.encounter.boss?'BOSS TRIAL':'FIELD TRIAL'}</span><h3>${esc(t.name)}</h3><p>${t.encounter.enemies.map(id=>esc(R.enemies[id].name)).join(' + ')}</p><ul class="trial-goals">${t.goals.map(g=>`<li>${esc(g.label)}</li>`).join('')}</ul><div class="trial-record"><span class="trial-medal" aria-hidden="true">${'◆'.repeat(t.grade)}${'◇'.repeat(3-t.grade)}</span><strong>${esc(t.medal)}</strong></div>${modes}<p>${t.claimed?'First medal prize received.':'First victory: '+t.reward.gold+' gold; '+Object.entries(t.reward.materials).map(([id,n])=>n+' '+esc(F.materials[id].name)).join(', ')+'.'}</p>${!t.practiceReady&&q&&A.taskAvailable(q)?iconButton('Track trial story','track',`data-id="${q.id}"`,true):''}${!t.practiceReady?`<p class="locked-hint">${esc(t.reason||'Complete this trial story in Drift Court to open practice.')}</p>`:''}</article>`;
 }).join('')}</div>`);
}
function renderEnding(){
 const s=A.state;
 panel('A world with a tomorrow','EPILOGUE',`<div class="ending-title"><span class="collection-number">✧</span><h3>${s.ending==='release'?'Every voice goes home.':'A choir with open doors.'}</h3><p>${s.ending==='release'?'The old network falls quiet. People begin to make a different world, one choice at a time.':'The new choir has no owner. Its keepers can listen, answer, and leave.'}</p></div><div class="panel-grid">${A.available().map(id=>`<article class="info-card"><div class="character-detail">${portrait(id,true)}<div><h3>${esc(R.heroes[id].name)}</h3><p>${esc(D.ending.characters[id])}</p></div></div></article>`).join('')}</div><div class="rewards-list" style="margin:25px 0"><div><strong>${A.available().length}/${Object.keys(R.heroes).length}</strong>Companions found</div><div><strong>${s.echoes.length}/${Object.keys(R.echoes).length}</strong>Echoes kept</div><div><strong>${s.quests.length}</strong>Stories completed</div></div><h3>Credits</h3>${D.credits.map(x=>`<p>${esc(x)}</p>`).join('')}<div class="panel-actions">${iconButton('Return to the world','postgame','',true)}${iconButton('Read the journal','journal')}${iconButton('Return to title','title')}</div>`);
}
function renderMenu(){
 const scene=A.game.sceneName,s=A.state,playing=A.started&&scene!=='title',canManage=playing&&!A.talk.open&&(['field','overworld'].includes(scene)||scene==='ending');
 const mins=Math.floor(s.playTime/60),time=Math.floor(mins/60)+':'+String(mins%60).padStart(2,'0');
 const item=(label,icon,action,hint='',disabled=false)=>`<button data-action="${action}" ${disabled?'disabled':''}><span aria-hidden="true">${icon}</span><div>${label}${hint?`<small>${esc(hint)}</small>`:''}</div></button>`;
 const q=playing?A.activeTask():null;
 const summary=playing?`<div class="menu-summary"><div><strong>${esc(scene==='overworld'?A.overworldInfo().name:A.places[s.location].name)}</strong><p>${s.act===1?'ACT I · THE BORROWED VOICES':'ACT II · THE UNWRITTEN WORLD'}</p></div><div class="menu-stats">${s.gold.toLocaleString()} gold<br>${time} played</div></div>`:'<p class="panel-intro">Every city has a voice. One of them is yours.</p>';
 const journey=playing?item('Mission map','◇','localmap','Rooms, gates, and your next field step',!canManage||scene!=='field')+item('Explore world','↗','explore','Walk the roads and cross the sea',!canManage)+item('World chart','⌖','chart','Routes and destinations',!canManage)+item('Company','♧','party','Formation and equipment',!canManage)+item('Travel pack','◇','pack','Items and supplies',!canManage)+item('Workshop','⚒','workshop','Craft, buy materials, and salvage gear',!canManage)+item('Companion bonds','♧','bonds','Personal stories and pair attacks',!canManage)+item('Drift Court trials','◇','trials','Medals, goals, and repeat practice',!canManage)+item('Available work','▤','work','Search stories and see what is ready',!canManage)+item('Saved formations','♧','preparation','Review and restore three party setups',!canManage)+item('Recover with items','✧','recovery','Preview the exact item cost',!canManage)+item('Journal','▤','journal','Stories and objectives',!canManage)+item('Echoes & lore','✧','codex','Magic and discoveries',!canManage)+item('Save game','↓','save','Save, load, import, export',!['field','overworld'].includes(scene)):item('Begin your journey','✦','new-journey','Start a new story');
 const notes=playing&&A.logs.length?`<section class="menu-notes"><span class="eyebrow">RECENT NOTES</span>${A.logs.slice(-4).map(line=>`<p>${esc(line)}</p>`).join('')}</section>`:'';
 panel('The journey','CINDER CHOIR',summary+(q?`<p class="panel-intro"><strong>${esc(q.title)}</strong><br>${esc(q.objective)}</p>`:'')+`<div class="menu-grid">${journey}${item('Settings','⚙','settings','Sound, display, battle, touch')}${item('How to play','?','help','Controls and game rules')}${item('About','✧','about','Credits and source code')}</div><div class="panel-actions">${iconButton(playing?'Return to the game':'Return to title','resume','',true)}${playing?iconButton('Title screen','title'):''}</div>`+notes);
}
function renderHelp(){
 panel('How to play','A PLACE FOR EVERY VOICE',`<div class="help-grid"><section><h3>Explore</h3><dl><dt>WASD / arrows</dt><dd>Move through a place.</dd><dt>E / Space</dt><dd>Talk, open, use, or continue dialogue.</dd><dt>Shift</dt><dd>Run or travel faster.</dd><dt>V</dt><dd>Board the boat, call the airship, or land.</dd><dt>L</dt><dd>Open the local mission map.</dd><dt>M</dt><dd>Open the world chart.</dd><dt>C</dt><dd>Manage the company and equipment.</dd><dt>I</dt><dd>Use items from the pack.</dd><dt>J</dt><dd>Read the journal.</dd><dt>Esc / P</dt><dd>Pause. Open settings and controls.</dd></dl><p>On touch screens, drag on the side opposite the action buttons to move. Hold Run to move faster. Tap the round action button to interact. The Touch settings can swap hands or hide these controls. A gamepad uses its directional controls and the confirm button.</p><p>Controls can be changed in the engine’s Controls screen. In-game prompts use the current binding.</p></section><section><h3>Use the screen</h3><p>The game fills the browser window in portrait and landscape. The Full screen button hides browser controls where supported. On iPhone, use Safari’s Share menu, choose Add to Home Screen, and turn on Open as Web App. Then open the game from its Home Screen icon.</p><h3>Explore the overworld</h3><p>Choose Explore the overworld below your objective, or use the exit sign. The world chart shows the same roads and terrain that you walk across. Set course marks a destination. Fast travel opens after your first visit.</p><p>Complete The Missing Verse in Lantern Ward to use boats at docks. Restore The Wren in Act II to fly. Use Walk, Sail, and Fly on the world screen. Sail close to shore to leave the boat. Land the airship on open ground.</p><p>Camps restore the company and save your position. Supply caches can be collected once per world state. Stone landmarks add records to Echoes & lore.</p><h3>Follow the field missions</h3><p>All ${A.allTasks().length} story events have field stages. Begin at the flag for the field briefing. Then use the task markers to read evidence, operate controls, deliver supplies, or guide people. Press L for the local mission map. It shows named rooms, the current target, a walkable route, and gate states.</p><p>Every control has a local clue. Use its buttons to set a sequence, tune dials, match records, or answer from the evidence. Wrong answers keep the current step open. During an escort, walk with the guide and wait at the destination. The group stops if you go too far ahead.</p><p>Each stage saves your work. The journal keeps evidence, decisions, and outcomes. Finished missions change the local scene. Earlier side stories remain open after the fall. The final arc begins after the ending.</p><h3>Explore the Far Reach</h3><p>Restore The Wren in Act II, then set course for Far Harbor on the east side of the world chart. Open the journal for The Far Reach expedition. Its coastal, rail, and weather routes can be explored before or after the main ending. The first harbor mission has no battle. Later expeditions are level 18–25; recover a full company of four before those battles. Companion stories open after their recovery quests and the first Far Reach mission.</p><p>Trail missions show one marker at a time. Visit each marker in order. Supply plans let you choose a valid split within each crew's limits; the journal keeps that plan.</p><h3>Use the workshop and pair attacks</h3><p>Open Workshop from Menu, Company, or Pack. Mission work supplies materials and teaches equipment patterns. Buy extra materials or salvage loose gear when you need more. Crafting consumes the materials and gold shown.</p><p>Complete companion bond stories to learn pair techniques. Both allies must be active and alive, with 6 MP each. The partner needs at least 50 ATB. A pair uses 40 Chorus before equipment discounts. Use the Pairs battle tab.</p><p>Far Reach foes have Break meters. Damaging hits build pressure. Weakness hits and crafted weapons build it faster. Break cancels the shown intent and creates a short damage opening. A broken foe skips its next action while it recovers. Major foes change their weaknesses and attack patterns at half health. Read the phase and intent below the commands.</p><h3>Enter the Undertide</h3><p>Finish the Far Reach expedition, then set course for Bellhaven on the south side of the chart. Twelve main stories open routes to First Harbor. Nera joins after the second story. Pax joins after the fifth. Their bond stories teach two new pair skills. Four optional Echo stories teach eight spells.</p><p>In a circuit, turn each tile to join its wire ends. Connect the gold source to all blue receivers. Keep red alarms dark. Each turn is saved. A valid circuit can have more than one solution.</p><h3>Find side quests</h3><p>Open Menu → Available work. Search by story or place, then filter by work that is available, at this place, in progress, or complete. Track and set course links a mission to the world chart. A Place at the Table and The Open Stage begin in familiar towns. Useful Cargo and Things Carried Home follow the Far Reach and Undertide routes. Each thread has four stories, one saved decision, and a return visit that shows its result.</p><h3>Prepare the company</h3><p>Menu → Saved formations keeps three named party and equipment setups. Review a setup to see gear transfers and HP or MP limits, then apply it. Menu → Recover with items shows the cost before it spends Revive and Tonic. Check Include Ether to restore MP too. A free waystone rest is still available.</p><h3>Call a reserve</h3><p>Choose Reserve in battle. A living companion outside the active party can help. The company shares one call per battle. It uses the ready hero turn and costs no reserve MP. Each companion has a different effect.</p><h3>Enter a trial</h3><p>Drift Court has six trial stories. Win a trial for Bronze. Meet some goals for Silver, or all goals for Gold. The board shows the fixed foes, level, goals, and your best medal. Complete each story to open repeat practice from Menu. Choose Current level or Matched level practice. Matched level caps active and reserve levels at the trial level; lower levels stay lower. It keeps your learned spells and gear. Each mode has its own personal best. Practice restores the campaign state when you return. Only the first victory can give its listed medal prize.</p><h3>Read the map</h3><p><strong>Gold beacon:</strong> the next story event.<br><strong>Green crystal:</strong> a waystone. Restore all HP and MP and save at no cost.<br><strong>Red marker:</strong> a visible enemy.<br><strong>Chest:</strong> treasure. Each chest can be opened once.</p><p>Read the field briefing before you begin. Task markers use distinct symbols: a speech bubble to talk, crossed swords for combat, a tool for repairs, and a lightning bolt for circuits. The legend in the mission map names each kind. An arrow points to an offscreen target. Closed gates have amber lights; restored routes have green lights. Page badges show unread local records.</p><h3>Choose a battle command</h3><p>Each character has an ATB gauge. When it fills, choose an action, magic, an Echo, or an item. In Wait mode, time stops while you choose.</p><p>Use Left and Right to choose a group. Use Up and Down to choose a command or target, then Enter to confirm. You can also click a command and target. X cancels a target choice. Enemy intent appears in the battle dock. Their weaknesses appear below their names.</p><p>Defend halves damage until the next action and restores MP. Flee leaves a normal encounter. Boss encounters must be resolved.</p></section><section><h3>Learn a voice</h3><p>Equip an Echo from Company. Victories grant AP. Once you learn a spell, you keep it. An equipped Echo can be called once per battle.</p><p>Different character actions and weakness hits fill the shared Chorus gauge. At 100, Chorus strikes all enemies and heals the company.</p><p>Every companion has two personal skills. Their second-act quest also improves HP, attack, and magic.</p></section><section><h3>Keep moving</h3><p>All reserve companions gain full experience. All weapons fit all companions. Free rests and shared experience remove the need for repeated training.</p><p>Auto uses available attacks and healing. It does not solve map puzzles or make story choices.</p><p>The second act opens after the world changes. Recover companions in your own order. The final assault needs at least six companions split into three separate teams.</p><p>Defeat gives you a retry or a return to the waystone. Manual saves and JSON export are available from Menu → Save game.</p></section></div><div class="panel-actions">${iconButton('Open settings','settings')}${iconButton('Open controls','controls')}</div>`);
}
function renderAbout(){
 panel('Cinder Choir','AN ORIGINAL ROLE-PLAYING GAME',`<p>Cinder Choir follows ten companions through a city built on stored voices and the world that grows from its ruins. It has ${D.places.length} places, a connected overworld in both world states, 14 first-act chapters, 16 second-act quests, and ${A.missions().length} additional missions. Walk the roads, sail between islands, or fly The Wren. The Living Roads update is version 6.0.0. It adds 16 side quests in familiar places, four choices with visible results, saved party setups, recovery previews, and matched-level trial practice. The work board helps you find available stories. All field puzzle inputs are saved. The Far Reach, Undertide, workshop, pair attacks, reserve calls, and Break rules are included. Every story has a playable field sequence. Each place has a named local map, gates, and records. Both main endings remain available.</p><p>The story, characters, maps, pixel scenes, and music are original. Final Fantasy VI for SNES supplied the design reference. No source-game graphics, music, names, or dialogue are included.</p><h3>Credits</h3>${D.credits.map(x=>`<p>${esc(x)}</p>`).join('')}<div class="panel-actions"><a class="small-button" href="cinder-choir-source.zip" download>Download source code</a><a class="small-button" href="README.md">Read the source notes</a><a class="small-button" href="ENGINE-NOTES.md">Engine evaluation</a><a class="small-button" href="CAMPAIGN-GUIDE.md" download>Campaign guide (spoilers)</a></div><section class="source-info"><h3>Source information</h3><dl><dt>Initial Date</dt><dd>2026-10-11</dd><dt>SOURCE</dt><dd>Final Fantasy VI for SNES. It was called Final Fantasy III in North America.</dd><dt>GAME ENGINE</dt><dd>my-3D2dge v0.24.0 · dev-build. Commit 240dc2fe39b14fc5cc1ebbed796c29dd827d8ab6.<br><a href="https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff" target="_blank" rel="noreferrer">Engine handoff</a></dd><dt>Environment</dt><dd>ChatGPT through an API. Bash CLI in a managed Linux cloud container. Browser execution was unavailable. Tests used Node v24.19.0 and direct canvas raster rendering.</dd><dt>Model and Effort Level</dt><dd>GPT-6 Astra Pro. The reasoning effort level was not confirmed.</dd></dl><h3>Research references</h3>${D.research.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)}</a><br>${esc(s.scope||'')}</p>`).join('')}</section>`);
}
function handle(action,el){
 const id=el.dataset.id,slot=el.dataset.slot;
 switch(action){
  case'begin':close();A.startNew(el.dataset.difficulty);break;
  case'travel':case'navigate':{const p=A.places[id];if(!A.unlocked(p))return;close();A.navigate(id);break;}
  case'explore':close();A.enterOverworld();break;
  case'fast-travel':if(A.canFastTravel(id)){close();A.fastTravel(id);}break;
  case'vehicle':{const res=A.setVehicle(id);if(res?.ok===false)toast(res.reason);break;}
  case'localmap':case'chart':case'journal':case'work':case'party':case'preparation':case'recovery':case'pack':case'workshop':case'bonds':case'trials':case'codex':case'help':case'about':case'save':open(action);break;
  case'local-focus':A.focusLocalTarget(Number(el.dataset.index));renderLocalMap();centerLocalMap();break;
  case'map-zoom':localMapZoom=clamp(localMapZoom+Number(el.dataset.delta),1,3);renderLocalMap();centerLocalMap();break;
  case'map-fit':localMapZoom=1;renderLocalMap();break;
  case'map-center':centerLocalMap();break;
  case'show-mission-map':A.setTrack(id);open('localmap');break;
  case'begin-field':close();A.beginMission(id);break;
  case'work-filter':workOptions.filter=id;renderWorkboard();break;
  case'work-reset':workOptions={search:'',filter:'available',arc:''};renderWorkboard();break;
  case'work-course':{const q=A.allTasks().find(q=>q.id===id);if(q&&A.taskAvailable(q)){A.setTrack(id);close();A.navigate(q.place);}break;}
  case'work-record':{const q=A.allTasks().find(q=>q.id===id);if(q){currentPanel='work-record';A.setModal(currentPanel);panel(q.title,'FIELD JOURNAL',missionRecord(q).replace('<details class=', '<details open class=')+`<div class="panel-actions">${iconButton('Back to available work','work')}</div>`);}break;}
  case'loadout-save':{const result=A.saveLoadout(Number(slot),$('loadout-name-'+slot).value);toast(result.ok?result.message:result.reason);loadoutReview=null;renderPreparation();break;}
  case'loadout-remove':{const result=A.removeLoadout(Number(slot));toast(result.ok?result.message:result.reason);loadoutReview=null;renderPreparation();break;}
  case'loadout-preview':loadoutReview=A.previewLoadout(Number(slot));renderPreparation();break;
  case'loadout-cancel':loadoutReview=null;renderPreparation();break;
  case'loadout-apply':{const result=A.applyLoadout(Number(slot),loadoutReview?.token);toast(result.ok?result.message:result.reason);loadoutReview=result.ok?null:A.previewLoadout(Number(slot));renderPreparation();break;}
  case'recovery-apply':{const result=A.recover(recoveryOptions,recoveryReview?.token);toast(result.ok?result.message:result.reason);renderRecovery();break;}
  case'practice-trial':{close();const result=A.startTrial(id,{matchedLevel:el.dataset.mode==='matched'});if(!result.ok){toast(result.reason);open('trials');}break;}
  case'field-answer':{const res=A.submitChallenge(Number(el.dataset.index));if(!res.ok){challengeFeedback=res.reason;renderChallenge();}break;}
  case'field-note':{const c=A.currentChallenge();if(c&&challengeDraft.length<c.order.length){const i=Number(el.dataset.index);challengeDraft.push(i);saveChallengeDraft();A.game.audio.sfx({wave:'sine',freq:220*Math.pow(1.25,i),dur:.22,vol:.12});renderChallenge();}break;}
  case'field-dial':{const i=Number(el.dataset.index);challengeDraft[i]=(challengeDraft[i]+Number(el.dataset.delta)+4)%4;saveChallengeDraft();renderChallenge();break;}
  case'field-allocate':{const c=A.currentChallenge(),i=Number(el.dataset.index);if(c?.kind==='allocate'){challengeDraft[i]=clamp((challengeDraft[i]||0)+Number(el.dataset.delta),0,c.max?.[i]??c.total);challengeFeedback='';saveChallengeDraft();renderChallenge();}break;}
  case'field-circuit':{const c=A.currentChallenge(),i=Number(el.dataset.index);if(c?.kind==='circuit'&&Number.isInteger(i)&&i>=0&&i<challengeDraft.length){challengeDraft[i]=(challengeDraft[i]+1)%4;const result=A.setChallengeDraft(challengeDraft);challengeFeedback=result.ok?'':result.reason;renderChallenge();$('modal-body').querySelector?.(`[data-action="field-circuit"][data-index="${i}"]`)?.focus?.();}break;}
  case'field-circuit-reset':{const c=A.currentChallenge();if(c?.kind==='circuit'){A.setChallengeDraft(c.layout.initial);challengeFeedback='The board is reset.';renderChallenge();}break;}
  case'field-clear':challengeDraft=[];challengeFeedback='';saveChallengeDraft();renderChallenge();break;
  case'field-check':{const res=A.submitChallenge(challengeDraft);if(!res.ok){challengeFeedback=res.reason;renderChallenge();}break;}
  case'new-journey':open('difficulty');break;case'resume':close();break;
  case'fullscreen':A.game.fullscreen.toggle().then(()=>{syncFullscreen();scheduleViewport();});break;
  case'track':A.setTrack(id);toast('Thread tracked.');close();break;
  case'activate':{const q=panelData.tasks?.find(q=>q.id===id)||A.allTasks().find(q=>q.id===id);close();A.activateTask(q);break;}
  case'formation':{if(!partyDraft.length||partyDraft.length>4){toast('Choose one to four companions.');return;}const res=A.setParty(partyDraft);if(!res.ok){toast(res.reason);return;}A.setModal('party');toast('Formation changed.');renderParty();break;}
  case'use':{const res=A.useItem(id,$('target-'+id).value);toast(res.ok?'Item used.':res.reason);renderPack();break;}
  case'buy':{const res=A.buy(id,1);toast(res.ok?'Bought '+(R.items[id]||R.equipment[id]).name+'.':res.reason);renderShop();break;}
  case'sell':{const res=A.sell(id,1);toast(res.ok?'Item sold.':res.reason);renderShop();break;}
  case'craft':{const res=A.craft(id);toast(res.ok?'Made '+R.equipment[F.recipes[id].gear].name+'.':res.reason);renderWorkshop();break;}
  case'buy-material':{const res=A.buyMaterial(id,1);toast(res.ok?'Bought '+F.materials[id].name+'.':res.reason);renderWorkshop();break;}
  case'salvage':{const res=A.salvage(id,1);toast(res.ok?'Equipment salvaged. The materials are in your workshop.':res.reason);renderWorkshop();break;}
  case'save-slot':A.save(slot);renderSaves();break;
  case'load-slot':{const s=A.readSlot(slot);close();if(s)A.load(s);break;}
  case'export':{
   const s=A.snapshotSave();if(!A.validate(s)){toast('The save could not be checked.');return;}const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cinder-choir-act-'+s.act+'-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Save exported.');break;
  }
  case'import':$('save-import').click();break;
  case'title':close();A.toTitle();break;
  case'settings':close();A.game.menu('settings');break;
  case'controls':close();A.game.menu('controls');break;
  case'teams':if(A.available().length<6){toast('Find at least six companions first.');return;}open('teams');break;
  case'auto-teams':{const ids=A.available();teamDraft=[ids.filter((_,i)=>i%3===0),ids.filter((_,i)=>i%3===1),ids.filter((_,i)=>i%3===2)];renderTeams();break;}
  case'set-teams':{const res=A.setTeams(teamDraft);if(!res.ok){toast(res.reason);return;}const destination=panelData.destination;close();toast('The three teams are ready.');if(destination)A.travel(destination);else open('chart');break;}
  case'result':A.continueResult();break;case'retry':A.retryBattle();break;case'camp':A.returnToCamp();break;case'cancel-target':A.cancelTarget();break;
  case'postgame':close();A.returnAfterEnding();break;
 }
 refresh();
}
document.addEventListener('click',event=>{
 const node=event.target.closest('button');if(!node||node.disabled)return;
 if(node.dataset.dialogueChoice!==undefined){A.chooseDialogue(Number(node.dataset.dialogueChoice));refresh();return;}
 if(node.dataset.action){handle(node.dataset.action,node);return;}
 if(node.dataset.panel){open(node.dataset.panel);return;}
 if(node.dataset.command){A.chooseCommand(node.dataset.command);return;}
 if(node.dataset.target){if(A.selectedCommand)A.perform(A.selectedCommand.id,node.dataset.target);return;}
 if(node.dataset.group){A.setCommandGroup(node.dataset.group);return;}
});
document.addEventListener('change',event=>{
 const node=event.target;
 if(node.dataset.party){const id=node.dataset.party;if(node.checked){if(partyDraft.length>=4){node.checked=false;toast('The active company can have four companions.');return;}partyDraft.push(id);}else partyDraft=partyDraft.filter(x=>x!==id);renderParty();}
 if(node.dataset.equip){const res=A.equip(node.dataset.equip,node.dataset.slot,node.value||null);if(!res.ok)toast(res.reason);renderParty();}
 if(node.dataset.team){const i=Number(node.dataset.team),id=node.dataset.id;if(node.checked){teamDraft=teamDraft.map(a=>a.filter(h=>h!==id));teamDraft[i].push(id);}else teamDraft[i]=teamDraft[i].filter(h=>h!==id);renderTeams();}
 if(node.id==='work-arc'){workOptions.arc=node.value;renderWorkboard();$('work-arc')?.focus();}
 if(node.id==='recovery-mp'){recoveryOptions.mp=!!node.checked;renderRecovery();$('recovery-mp')?.focus();}
});
document.addEventListener('input',event=>{
 const node=event.target;if(node.id!=='work-search')return;
 const cursor=node.selectionStart;workOptions.search=node.value;renderWorkboard();const input=$('work-search');input.focus();
 // Search inputs do not support setSelectionRange in every browser.
 if(cursor!==null&&cursor!==undefined)try{input.setSelectionRange?.(cursor,cursor);}catch{}
});
$('new-game').onclick=()=>open('difficulty');$('continue-game').onclick=()=>A.loadLatest();$('settings-button').onclick=()=>A.game.menu('settings');$('help-button').onclick=()=>open('help');$('about-button').onclick=()=>open('about');$('interact-button').onclick=()=>A.interact();$('track-button').onclick=()=>open(A.game.sceneName==='field'&&A.activeTask()?.place===A.state.location?'localmap':'chart');$('modal-close').onclick=close;$('auto-button').onclick=()=>A.toggleAuto();
$('dialog-next').onclick=()=>A.nextDialogue();$('scene-continue').onclick=()=>{if(A.game.sceneName==='ending')open('ending');else A.nextDialogue();};
$('menu-button').onclick=()=>open('menu');$('brand').onclick=event=>{event.preventDefault();open('menu');};
$('fullscreen-button').onclick=()=>{A.game.fullscreen.toggle().then(()=>{syncFullscreen();scheduleViewport();});};
$('touch-interact').onclick=()=>{if(A.near)A.interact();};
A.game.input.bindButtons($('touch-controls'));
window.addEventListener('blur',releaseTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTouch();});
document.addEventListener('change',event=>{const i=event.target.dataset.fieldSort;if(i!==undefined){challengeDraft[Number(i)]=Number(event.target.value);saveChallengeDraft();}});
$('modal-layer').addEventListener('click',event=>{if(event.target===$('modal-layer'))close();});
$('save-import').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>1e6)throw new Error('This save file is too large.');const data=JSON.parse(await file.text());if(!A.validate(data))throw new Error('This is not a valid Cinder Choir save.');close();A.load(data);toast('Journey imported.');}catch(e){toast(e.message||'The save could not be read.');}event.target.value='';});
document.addEventListener('keydown',event=>{
 if(!currentPanel){
  const tag=event.target.tagName;
  if(['BUTTON','A','INPUT','SELECT'].includes(tag)&&(['Enter',' '].includes(event.key)||tag==='SELECT'))event.stopPropagation();
  return;
 }
 // Leave native button, select, and checkbox key actions intact; keep them out of E.Input.
 event.stopPropagation();
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
 // Keep keyboard focus inside the open campaign panel.
 if(event.key==='Tab'){const nodes=[...$('modal-window').querySelectorAll('button:not(:disabled),a[href],select,input:not(:disabled)')].filter(n=>!n.hidden);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===$('modal-window'))){event.preventDefault();first.focus();}}
},true);
CC.UI={open,close,toast,refresh,syncViewport,dialogue:true,enemyIntent:true};A.subscribe(refresh);
window.addEventListener('resize',()=>{syncTouch();scheduleViewport();});
window.visualViewport?.addEventListener('resize',scheduleViewport);
document.addEventListener('fullscreenchange',()=>{syncFullscreen();scheduleViewport();});
document.addEventListener('webkitfullscreenchange',()=>{syncFullscreen();scheduleViewport();});
if(typeof ResizeObserver!=='undefined'){
 const observer=new ResizeObserver(scheduleViewport);
 for(const id of ['viewport','hud-top','objective-hud','battle-dock','dialogue-card','travel-nav','context-strip','journey-controls'])observer.observe($(id));
}
A.game.booted.then(()=>{$('loading-cover').hidden=true;refresh();});
window.addEventListener('error',event=>{if($('loading-cover')&&!$('loading-cover').hidden)$('loading-cover').innerHTML='<p>The game could not start.</p><p>'+esc(event.message)+'</p>';});
refresh();
})();
