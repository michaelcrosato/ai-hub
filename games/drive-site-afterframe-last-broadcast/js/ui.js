/* Semantic HTML controls, device-local preferences, and game status. */
(() => {
'use strict';
const F=AFGame,$=id=>document.getElementById(id);let lastUI=0,lastScene='',lastHealth='',wasPaused=false,dialogReturn=new Map(),lastPad=[],padSelection=0,padNavAt=0;
function setText(id,text){const el=$(id);if(el&&el.textContent!==String(text))el.textContent=String(text);}
function hidden(id,on){const el=$(id);if(el&&el.hidden!==on)el.hidden=on;}
function focusCanvas(){$('screen').focus({preventScroll:true});}
function openDialog(id){const d=$(id);if(d.open)return;dialogReturn.set(id,F.game.paused);if(F.scene==='play')F.pause(true);F.game.modalPaused=true;F.game.input.clear();d.showModal();if(id==='settingsDialog')syncSettings();}
function closeDialog(id){const d=$(id);if(d.open)d.close();}
function bind(id,fn){$(id).addEventListener('click',fn);}
bind('startButton',()=>{F.start(false);focusCanvas();});bind('continueButton',()=>{F.start(true);focusCanvas();});bind('replayButton',()=>{F.start(false);focusCanvas();});
for(const id of['retryButton','retryDeathButton'])bind(id,()=>{F.retry();focusCanvas();});
for(const id of['quitButton','deathTitleButton','finishTitleButton'])bind(id,()=>{F.title();});
bind('resumeButton',()=>{F.pause(false);focusCanvas();});bind('pauseButton',()=>F.pause(true));
bind('homeLink',e=>{e.preventDefault();if(F.scene==='play'){F.pause(true);}else F.title();});
for(const id of['settingsButton','pauseSettings'])bind(id,()=>openDialog('settingsDialog'));
for(const id of['guideButton','titleGuide'])bind(id,()=>openDialog('guideDialog'));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>closeDialog(el.dataset.close)));
for(const id of['settingsDialog','guideDialog']){
 const d=$(id);d.addEventListener('close',()=>{F.game.modalPaused=false;F.game.input.clear();F.game.paused=!!(F.state?.upgradePending||(F.scene==='play'&&dialogReturn.get(id)));focusCanvas();syncUI(true);});
 d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
}
bind('soundButton',()=>{const muted=F.game.audio.mute();$('soundButton').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');$('soundButton').style.opacity=muted?'.45':'1';focusCanvas();});
bind('fullButton',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{if(F.state)F.notify('Full screen is unavailable','You can keep playing in this window.','DISPLAY',3);}finally{focusCanvas();}});
document.addEventListener('fullscreenchange',()=>F.game.screen.resize());
new ResizeObserver(()=>F.game.screen.resize()).observe($('stage'));
document.querySelectorAll('[data-upgrade]').forEach(el=>el.addEventListener('click',()=>{F.chooseUpgrade(el.dataset.upgrade);focusCanvas();}));
const controls={filterMode:['mode','value'],useGPU:['gpu','checked'],colourLevels:['levels','number'],edgeStrength:['edge','number'],pixelSize:['pixel','number'],filterMix:['mix','number'],volume:['volume','number'],difficulty:['difficulty','value'],reducedMotion:['reducedMotion','checked'],reducedFlashes:['reducedFlashes','checked'],showTouch:['touch','checked'],holdAttack:['holdAttack','checked']};
for(const [id,[key,type]]of Object.entries(controls))$(id).addEventListener('input',()=>{F.applySettings({[key]:type==='checked'?$(id).checked:type==='number'?Number($(id).value):$(id).value});syncSettings(false);syncUI(true);});
bind('resetSettings',()=>{F.applySettings(F.defaultSettings);syncSettings();});
function syncSettings(values=true){const s=F.settings;if(values)for(const [id,[key,type]]of Object.entries(controls)){if(type==='checked')$(id).checked=!!s[key];else $(id).value=s[key];}
 setText('levelsOutput',s.levels);setText('edgeOutput',s.edge.toFixed(2));setText('pixelOutput',s.pixel);setText('mixOutput',Math.round(s.mix*100)+'%');setText('volumeOutput',Math.round(s.volume*100)+'%');setText('gpuStatus',F.picture.status);
 $('edgeStrength').disabled=s.mode==='pixel'||s.mode==='none';$('pixelSize').disabled=s.mode==='cel'||s.mode==='none';$('colourLevels').disabled=s.mode==='none';$('filterMix').disabled=s.mode==='none';
 document.body.classList.toggle('reduce-motion',s.reducedMotion);document.body.classList.toggle('touch',s.touch);
}
document.querySelectorAll('[data-code]').forEach(button=>{
 const release=()=>{F.game.input.release(button.dataset.code);button.classList.remove('held');};
 button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);F.game.input.press(button.dataset.code);button.classList.add('held');});
 button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
window.addEventListener('blur',()=>document.querySelectorAll('[data-code].held').forEach(el=>el.classList.remove('held')));
function padMenus(){
 let p;try{p=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch{return;}if(!p){lastPad=[];return;}
 const buttons=p.buttons.map(b=>b.pressed),fresh=i=>buttons[i]&&!lastPad[i];const dialog=document.querySelector('dialog[open]');
 let menu=dialog||(F.state?.upgradePending?$('upgradeScreen'):F.scene==='title'?$('titleScreen'):F.scene==='dead'?$('deathScreen'):F.scene==='win'?$('finishScreen'):F.game.paused?$('pauseScreen'):null);
 if(menu){
  const choices=Array.from(menu.querySelectorAll('button:not([hidden]):not(:disabled)')).filter(el=>!el.closest('[hidden]'));
  const now=performance.now(),vertical=p.axes[1]||0,horizontal=p.axes[0]||0;
  const direction=buttons[13]||buttons[15]||vertical>.5||horizontal>.5?1:buttons[12]||buttons[14]||vertical<-.5||horizontal<-.5?-1:0;
  if(direction&&now-padNavAt>200&&choices.length){padSelection=(padSelection+direction+choices.length)%choices.length;choices[padSelection].focus();padNavAt=now;}
  if(fresh(0)&&choices.length){const target=choices.includes(document.activeElement)?document.activeElement:choices[Math.min(padSelection,choices.length-1)];target.click();}
  if(fresh(1)){if(dialog)dialog.close();else if(F.game.paused&&!F.state?.upgradePending)F.pause(false);}
 }
 lastPad=buttons;
}
function syncUI(force=false){
 padMenus();const now=performance.now();if(!force&&now-lastUI<55)return;lastUI=now; $('stage').dataset.frameMs=F.game.stats.frameMs.toFixed(2); $('stage').dataset.renderMs=F.game.stats.renderMs.toFixed(2); $('stage').dataset.gameClock=F.state?.clock.toFixed(2)||'0';
 const scene=F.scene,s=F.state,h=F.hero,play=scene==='play';
 if(play&&wasPaused&&!F.game.paused&&!document.querySelector('dialog[open]'))focusCanvas();wasPaused=F.game.paused;
 if(scene!==lastScene){lastScene=scene;padSelection=0;hidden('titleScreen',scene!=='title');hidden('hud',!play);hidden('powerRail',!play);hidden('deathScreen',scene!=='dead');hidden('finishScreen',scene!=='win');hidden('continueButton',!F.hasSave());}
 hidden('pauseScreen',!(play&&F.game.paused&&!s?.upgradePending&&!document.querySelector('dialog[open]')));
 hidden('upgradeScreen',!(play&&s?.upgradePending));hidden('touchControls',!(play&&F.settings.touch&&!F.game.paused));
 if(!s||!h){setText('footerStatus','READY TO TRANSMIT');return;}
 setText('footerStatus',scene==='win'?'TRANSMISSION RESTORED':scene==='dead'?'SIGNAL INTERRUPTED':F.game.paused?'TRANSMISSION ON HOLD':s.power==='none'?'SIGNAL STABLE':s.power.toUpperCase()+' ACTIVE');
 if(play){
  const healthKey=h.hp+'/'+h.maxHp;if(healthKey!==lastHealth){lastHealth=healthKey;$('healthCells').replaceChildren(...Array.from({length:h.maxHp},(_,i)=>{const cell=document.createElement('i');if(i>=h.hp)cell.className='empty';return cell;}));setText('healthText',h.hp+' / '+h.maxHp);}
  setText('tempoValue',Math.floor(s.tempo));$('tempoFill').style.width=(s.tempo/s.maxTempo*100)+'%';$('tempoFill').style.background=s.powerLock>0?'#ff656b':s.power==='focus'?'#d4abff':s.power==='rush'?'#ff823d':'#66efcf';
  setText('scoreValue',Math.round(s.score).toString().padStart(6,'0'));setText('reelCount',s.collectibles.filter(c=>c.kind==='signal'&&c.collected).length+' / 3');
  setText('chapterNumber',s.sectionNumber);setText('chapterLabel',s.section);setText('objective',s.objective);
  hidden('comboPanel',s.combo<2);setText('comboCount',s.combo+' HITS');setText('comboRank',s.combo>=45?'SSS':s.combo>=30?'SS':s.combo>=18?'S':s.combo>=10?'A':s.combo>=5?'B':'C');setText('comboNote',s.variety.length>=4?'MIXED FREQUENCIES':s.combo>=10?'KEEP IT ALIVE':'KEEP THE SIGNAL');$('comboFill').style.width=clamp(s.comboLeft/3.25,0,1)*100+'%';
  document.querySelectorAll('[data-power]').forEach(el=>{el.classList.toggle('active',el.dataset.power===s.power);el.classList.toggle('empty',s.powerLock>0);});
  hidden('powerBadge',s.power==='none');setText('powerBadge',s.power.toUpperCase());$('powerBadge').style.color=s.power==='focus'?'#d4abff':s.power==='rush'?'#ffb43b':'#66efcf';
  const toast=s.toast&&s.clock<s.toast.until;$('toast').classList.toggle('visible',!!toast);if(toast){setText('toastTag',s.toast.tag);setText('toastTitle',s.toast.title);setText('toastText',s.toast.text);}
  const dialogue=s.dialogue&&s.clock<s.dialogue.until;hidden('dialogue',!dialogue);if(dialogue){setText('dialogueSpeaker',s.dialogue.speaker);setText('dialogueText',s.dialogue.text);}
  hidden('bossHud',!s.boss||s.boss.dead);if(s.boss){$('bossFill').style.width=Math.max(0,s.boss.hp/s.boss.maxHp*100)+'%';setText('bossPhase','PHASE 0'+s.boss.phase);}
 }
 if(scene==='win'&&s.summary){const r=s.summary;setText('finalRank',r.rank);setText('finalScore',r.score.toLocaleString());setText('finalTime',String(Math.floor(r.time/60)).padStart(2,'0')+':'+String(Math.floor(r.time%60)).padStart(2,'0'));setText('finalCombo',r.bestCombo+' hits');setText('finalCounters',r.counters);setText('finalSecrets',r.signals+' / 3');setText('personalBest',s.newBest?'NEW PERSONAL BEST / '+r.difficulty.toUpperCase():r.difficulty.toUpperCase()+' / TRANSMISSION COMPLETE');}
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
F.onFrame=syncUI;syncSettings();syncUI(true);
// Optional browser-agent tools. Only user-facing actions and a read-only status
// are registered. No completion, score, health, or position cheats are exposed.
const modelContext=document.modelContext||navigator.modelContext;
if(modelContext?.registerTool){
 const tools=[{name:'afterframe_status',description:'Read AFTERFRAME scene, health, checkpoint, objective, and active picture filter.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>({content:[{type:'text',text:JSON.stringify({scene:F.scene,health:F.hero?.hp,objective:F.state?.objective,checkpoint:F.state?.checkpoint,filter:F.picture.backend})}]})},{name:'afterframe_pause',description:'Pause the current AFTERFRAME game.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>{F.pause(true);return{content:[{type:'text',text:'Game paused.'}]};}}];
 for(const tool of tools){try{Promise.resolve(modelContext.registerTool(tool)).catch(()=>{});}catch{/* The optional browser API does not affect play. */}}
}
})();
