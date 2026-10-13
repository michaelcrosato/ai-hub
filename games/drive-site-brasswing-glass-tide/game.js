/* BRASSWING: Operation Glass Tide — original game by OpenAI for Michael.
 * Uses my-3D2dge for timing, input, scenes, rendering, bullets, particles,
 * synthesized audio, camera effects, text, and device-local saved data.
 */
(() => {
  'use strict';
  const E=window.My3D2dge, A=window.BrasswingArt, D=window.BrasswingData, S=window.BrasswingAudio;
  const $=s=>document.querySelector(s), overlay=$('#overlay'), stage=$('#stage');
  const clamp=E.clamp, lerp=E.lerp, W=640,H=360;
  const initial=E.store.get('brasswing.v1',{});
  const settings={autoFire:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,hitPoint:false,volume:.55,muted:false,...initial.settings};
  settings.volume=clamp(Number(settings.volume)||0,0,1);
  let records=initial.records||{}, config={frame:0,pilot:0,weapon:0,armor:true,extraPulse:false,difficulty:'standard'};
  let M=null, ui='title', helpReturn='title', lastPause=false, touchVec=[0,0], isTouch=matchMedia('(pointer:coarse)').matches, uiTick=0;
  const input={...E.Input.SHMUP,fire:['KeyZ','Space','KeyJ','Pad0','Pad7','Mouse0'],special:['KeyX','KeyK','Pad2','Pad5','Mouse2'],pulse:['KeyC','KeyL','Pad1'],focus:['ShiftLeft','ShiftRight','Pad4'],pause:['Escape','KeyP','Pad9']};
  const game=new E.Game({canvas:'screen',res:[W,H],view:'overhead',views:['overhead'],input,bg:'#132734'});
  game.cam.smooth=0; game.focus(W/2,H/2); game.pauseOverlay=false; game.reduceMotion=!!settings.reducedMotion;
  game.audio.setVolume(settings.muted?0:settings.volume); S.install(game.audio);
  const bullets=new E.Bullets(game,{max:600,sparks:false});
  const enemyDot=E.sprite(['..rrr..','.rooor.','roWWWor','roWWWor','roWWWor','.rooor.','..rrr..'],{r:'#963d43',o:'#ff8460',W:'#ffebbc'});
  const enemyBlue=E.sprite(['..bb..','.bwwb.','bwwwwb','bwwwwb','.bwwb.','..bb..'],{b:'#d18c46',w:'#fff3cf'});
  function save(){E.store.set('brasswing.v1',{settings,records});}
  function sfx(name,o){if(!settings.muted)game.audio.sfx(name,o);}
  function announce(text){$('#announce').textContent=text;}
  function money(n){return Math.max(0,Math.floor(n)).toLocaleString('en-US');}
  function clock(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
  function cost(c=config){return D.frames[c.frame].price+D.weapons[c.weapon].price+(c.armor?600:0)+(c.extraPulse?500:0);}
  function affordable(c){return cost(c)<=D.budget;}
  function setOverlay(html,mode){ui=mode;overlay.innerHTML=html;stage.classList.toggle('playing',mode==='none'||mode==='pause'||(mode==='help'&&game.sceneName==='play'));}
  function selectButtonFocus(){const b=overlay.querySelector('[data-act="launch"], [data-act="prepare"], [data-act="resume"], .primary');if(b)b.focus({preventScroll:true});}
  function setTouch(){const active=isTouch&&game.sceneName==='play'&&!game.paused&&M&&!M.fail&&!M.win;$('#touch-controls').classList.toggle('active',!!active);$('#pause-touch').classList.toggle('active',!!active);}

  function titleUI(){
    const best=records.best||0;
    setOverlay(`<section class="title-screen" aria-label="Title screen"><div class="eyebrow">INDEPENDENT FLIGHT DIVISION</div><h1>BRASSWING</h1><p class="operation">OPERATION GLASS TIDE</p><p class="premise">Break the blockade.<br>Bring the coast home.</p><div class="action-row"><button class="primary" data-act="prepare">Prepare sortie</button><button class="secondary" data-act="manual">Flight manual</button></div><div class="flight-tag">CAPE SABLE AIRSPACE<br><strong>LAST LIGHT / 18:40</strong><br>SORTIE 01</div><div class="title-details"><div><strong>ONE COAST. ONE FLIGHT.</strong><br>KEYBOARD · GAMEPAD · TOUCH</div><div class="title-record">${best?`BEST SCORE <strong>${money(best)}</strong><br>PERSONAL FLIGHT RECORD`:'<strong class="blink">AWAITING PILOT</strong><br>PRESS ENTER TO PREPARE'}</div></div></section>`,'title');
    $('#footer-status').textContent='CAPE SABLE · 18:40 LOCAL';setTouch();
  }
  function hangarUI(){
    const f=D.frames[config.frame],p=D.pilots[config.pilot],w=D.weapons[config.weapon];
    const rest=D.budget-cost();
    const frameHTML=D.frames.map((f,i)=>`<button class="airframe ${i===config.frame?'selected':''}" data-act="frame" data-value="${i}" aria-pressed="${i===config.frame}"><canvas width="120" height="57" data-frame="${f.id}" aria-hidden="true"></canvas><h3>${f.name}</h3><small>${f.role}</small><small>${f.price?money(f.price)+' CR':'INCLUDED'}</small><div class="tiny-stats"><span>HULL ${f.hp}</span><span>SPD ${f.speed}</span></div></button>`).join('');
    const pilotHTML=D.pilots.map((p,i)=>`<button class="pilot ${i===config.pilot?'selected':''}" data-act="pilot" data-value="${i}" aria-pressed="${i===config.pilot}"><canvas width="32" height="38" data-pilot="${i}" aria-hidden="true"></canvas><span><strong>${p.name}</strong>${p.short}</span></button>`).join('');
    const weaponHTML=D.weapons.map((w,i)=>`<button class="weapon ${i===config.weapon?'selected':''}" data-act="weapon" data-value="${i}" aria-pressed="${i===config.weapon}"><span class="weapon-symbol" aria-hidden="true">${w.symbol}</span><span class="weapon-copy"><strong>${w.name} / ${w.ammo+p.ammo} ROUNDS</strong><small>${w.desc}</small></span><span class="weapon-cost">${money(w.price)}</span></button>`).join('');
    setOverlay(`<section class="hangar" aria-label="Prepare aircraft and weapons"><header class="panel-header"><div><div class="eyebrow">SORTIE 01 / OPERATION GLASS TIDE</div><h2>PREPARE FOR TAKEOFF</h2><p>Cross the Iron Channel. Disable the carrier <em>Breakwater</em>.</p></div><div class="budget">CREDITS AVAILABLE<strong id="balance">${money(rest)}</strong>OF ${money(D.budget)} CR</div></header><div class="mission-map"><span>01 COASTAL RUN</span><i></i><span>02 IRON CHANNEL</span><i></i><span>03 BREAKWATER</span></div><div class="hangar-main"><div><div class="section-label">01 / SELECT AIRFRAME <b>${f.code}</b></div><div class="airframes">${frameHTML}</div><div class="section-label pilot-title">02 / SELECT PILOT</div><div class="pilots">${pilotHTML}</div><p class="pilot-note">${p.note} ${f.desc}.</p></div><div><div class="section-label">03 / ARM YOUR AIRCRAFT <b>MAIN GUN INCLUDED</b></div><div class="weapons">${weaponHTML}</div><div class="upgrades"><button class="upgrade ${config.armor?'selected':''}" data-act="armor" aria-pressed="${config.armor}"><span class="box-check">${config.armor?'✓':''}</span><span>HULL PLATING<small>+25 hull · 600 CR</small></span></button><button class="upgrade ${config.extraPulse?'selected':''}" data-act="extraPulse" aria-pressed="${config.extraPulse}"><span class="box-check">${config.extraPulse?'✓':''}</span><span>EXTRA PULSE<small>+1 pulse · 500 CR</small></span></button></div><p class="pilot-note">Two emergency pulses are included. Unspent credits add to your score.</p></div></div><footer class="hangar-foot"><div><div class="difficulty"><label>FLIGHT RULES</label>${Object.entries(D.difficulty).map(([k,d])=>`<button class="diff ${k===config.difficulty?'selected':''}" data-act="difficulty" data-value="${k}" aria-pressed="${k===config.difficulty}">${d.name}</button>`).join('')}</div><div class="diff-note">${D.difficulty[config.difficulty].note}</div></div><div class="action-row"><button class="secondary" data-act="title">Back</button><button class="primary" data-act="launch">Launch sortie</button></div></footer></section>`,'hangar');
    for(const c of overlay.querySelectorAll('canvas[data-frame]')){const g=c.getContext('2d');g.imageSmoothingEnabled=false;A.player(g,66,28,{time:1,frame:c.dataset.frame,scale:1.45,thrust:false});}
    for(const c of overlay.querySelectorAll('canvas[data-pilot]')){const g=c.getContext('2d');A.portrait(g,16,20,{pilot:+c.dataset.pilot,scale:1});}
    announce(`Selected ${f.name}. ${money(rest)} credits remain.`);setTouch();
  }
  function settingsHTML(){return `<div class="settings"><label class="setting"><input type="checkbox" data-setting="autoFire" ${settings.autoFire?'checked':''}> Auto fire</label><label class="setting"><input type="checkbox" data-setting="hitPoint" ${settings.hitPoint?'checked':''}> Show hit point</label><label class="setting"><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion?'checked':''}> Reduced motion</label></div><label class="volume-row">VOLUME <input type="range" min="0" max="100" value="${Math.round(settings.volume*100)}" data-setting="volume" aria-label="Audio volume"></label>`;}
  function openHelp(){
    if(ui==='help')return;helpReturn=ui;
    if(game.sceneName==='play')game.paused=true;
    setOverlay(`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="Flight manual"><div class="eyebrow">PILOT FIELD MANUAL</div><h2>FLY. ADAPT. SURVIVE.</h2><div class="manual-grid"><div><span>Move</span><strong>WASD / ARROWS</strong></div><div><span>Main gun</span><strong>Z / SPACE</strong></div><div><span>Special weapon</span><strong>X</strong></div><div><span>Emergency pulse</span><strong>C</strong></div><div><span>Precise movement</span><strong>HOLD SHIFT</strong></div><div><span>Pause</span><strong>ESC / P</strong></div></div><div class="manual-note"><p><strong>After a hit, protect the aircraft until recovery ends.</strong> A second hit causes double damage in Standard mode. It is fatal in Ace mode. A pulse clears bullets and ends recovery.</p></div><p>Collect blue power cells to improve the main gun. Green crates repair the hull. Gold crates refill special ammunition. Destroy all three radar relays for a bonus.</p><p>Hold Shift to slow the aircraft and show its small hit point. Enemy bullets must touch this point to cause damage.</p><p><strong>Gamepad:</strong> left stick or D-pad to move; A to fire; X for special; B for pulse; LB for focus; Start to pause. Touch controls use auto fire.</p>${settingsHTML()}<button class="primary" data-act="closeHelp">Return to flight</button></section></div>`,'help');selectButtonFocus();setTouch();
  }
  function closeHelp(){
    if(helpReturn==='title'){titleUI();return;}if(helpReturn==='hangar'){hangarUI();return;}
    if(helpReturn==='debrief'){resultsUI(M.success);return;}
    if(helpReturn==='pause'){ui='pause';pauseUI();return;}
    game.paused=false;setOverlay('','none');setTouch();$('#screen').focus({preventScroll:true});
  }
  function pauseUI(){if(ui==='help')return;setOverlay(`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="Game paused"><div class="eyebrow">FLIGHT HOLD / ${M?clock(M.clock):'00:00'}</div><h2>PAUSED</h2><p>Your aircraft is safe. Resume when you are ready.</p>${settingsHTML()}<div class="pause-actions"><button class="primary" data-act="resume">Resume flight</button><button class="secondary" data-act="manual">Flight manual</button><button class="secondary" data-act="restart">Restart sortie</button><button class="text-button" data-act="hangar">Return to hangar</button></div></section></div>`,'pause');selectButtonFocus();setTouch();}
  function resultsUI(success){
    const p=M.player,stats=M.stats;
    const elapsed=M.clock-M.startAt;
    const accuracy=Math.min(100,Math.round(stats.shotsHit/Math.max(1,stats.shots)*100));
    const finalScore=M.finalScore??Math.round(M.score*D.difficulty[M.config.difficulty].score);
    let rank=success?(finalScore>=26000&&stats.hits<=2?'S':finalScore>=18000&&stats.hits<=6?'A':finalScore>=12000?'B':'C'):'—';
    if(M.retryCount>0&&['S','A'].includes(rank))rank='B';
    const record=success&&finalScore>(records.best||0);
    if(success&&!M.recordWritten){records.best=Math.max(records.best||0,finalScore);records.clears=(records.clears||0)+1;records.lastRank=rank;records.byDifficulty={...records.byDifficulty,[M.config.difficulty]:Math.max(records.byDifficulty?.[M.config.difficulty]||0,finalScore)};save();M.recordWritten=true;M.wasRecord=record;}
    M.rank=rank;M.success=success;M.finalScore=finalScore;
    const checkpoint=!success&&M.checkpoint;
    setOverlay(`<section class="result-screen ${success?'':'failed'}" aria-label="Mission ${success?'complete':'failed'}"><div class="result-copy"><div class="eyebrow">${success?'SORTIE COMPLETE / COAST SECURED':'FLIGHT LOST / PILOT RECOVERED'}</div><h2>${success?'THE SKY<br>IS OURS.':'AIRCRAFT<br>LOST.'}</h2><p>${success?'Breakwater is down. The coast is clear, and the relief convoy can reach Cape Sable. Good flying.':M.deathCause||'Your aircraft could not complete the sortie. Adjust the loadout, then take another run.'}</p><div class="result-stats"><div>FINAL SCORE<strong>${money(finalScore)}</strong></div><div>${success?'MISSION TIME':'FLIGHT TIME'}<strong>${clock(M.clock)}${M.retryCount?' / CHECKPOINT':''}</strong></div><div>TARGETS / ACCURACY<strong>${stats.kills} / ${accuracy}%</strong></div><div>RADAR RELAYS<strong>${stats.relays} / 3 ${stats.relays===3?'COMPLETE':''}</strong></div><div>HITS TAKEN<strong>${stats.hits}</strong></div><div>${success?'HULL REMAINING':'FLIGHT RULES'}<strong>${success?Math.max(0,Math.ceil(p.hp))+' / '+p.maxHp:D.difficulty[M.config.difficulty].name}</strong></div></div>${success?`<p class="new-record">${M.wasRecord?'NEW PERSONAL RECORD · ':''}${D.difficulty[M.config.difficulty].name}${M.retryCount?' · CHECKPOINT RETRY · RANK CAPPED AT B':''}</p>`:checkpoint?`<p>Checkpoint ready: <strong>${checkpoint.label}</strong>. Retry costs 1,500 score and limits the final rank to B.</p>`:''}<div class="result-actions">${checkpoint?'<button class="primary" data-act="checkpoint">Retry checkpoint</button>':''}<button class="${checkpoint?'secondary':'primary'}" data-act="hangar">${success?'Fly another sortie':'Change loadout'}</button><button class="secondary" data-act="restart">${success?'Replay loadout':'Restart mission'}</button></div></div><div class="result-grade"><div class="grade">${rank}</div><div class="grade-label">${success?'FLIGHT RANK':'SIGNAL LOST'}</div></div></section>`,'debrief');
    $('#footer-status').textContent=success?'MISSION COMPLETE · CAPE SABLE IS CLEAR':'FLIGHT RECORDER RECOVERED';announce(success?`Mission complete. Rank ${rank}. Score ${finalScore}.`:'Mission failed. Retry or change your loadout.');setTouch();
  }

  // Mission simulation. Every moving projectile uses the supplied bullet system.
  const enemySpec={scout:{hp:4,r:13,speed:122,score:100},interceptor:{hp:8,r:15,speed:90,score:180},bomber:{hp:26,r:23,speed:52,score:420},turret:{hp:17,r:17,speed:48,score:230},missileBoat:{hp:23,r:24,speed:47,score:320},mine:{hp:5,r:11,speed:54,score:120},relay:{hp:27,r:20,speed:48,score:450},miniboss:{hp:176,r:48,speed:35,score:2400}};
  function newMission(checkpoint=null){
    const c={...config},f=D.frames[c.frame],pilot=D.pilots[c.pilot],d=D.difficulty[c.difficulty],w=D.weapons[c.weapon];
    const maxHp=f.hp+(c.armor?25:0),maxAmmo=w.ammo+pilot.ammo;
    const old=M;
    M={config:c,clock:checkpoint?checkpoint.clock:0,startAt:checkpoint?checkpoint.clock:0,scroll:checkpoint?checkpoint.clock*54:0,sector:checkpoint?(checkpoint.clock>=115?2:1):0,eventIndex:0,seed:E.rng(260917),enemies:[],pickups:[],scheduled:[],groups:{},nextId:1,score:checkpoint?Math.max(0,checkpoint.score-1500):0,credits:0,combo:0,comboTime:0,boss:null,radio:null,hint:null,banner:null,pulseFX:0,beamFX:[],win:0,fail:0,checkpoint:checkpoint||null,retryCount:checkpoint?(old?.retryCount||0)+1:0,stats:checkpoint?{...checkpoint.stats}:{kills:0,shots:0,shotsHit:0,hits:0,relays:0,grazes:0,specials:0,pulses:0},player:{x:checkpoint?104:-40,y:185,r:5,z:0,vx:0,vy:0,bank:0,hp:checkpoint?Math.max(maxHp*.7,checkpoint.hp):maxHp,maxHp,ammo:checkpoint?Math.max(Math.floor(maxAmmo*.6),checkpoint.ammo):maxAmmo,maxAmmo,pulses:checkpoint?Math.max(1,checkpoint.pulses):2+(c.extraPulse?1:0)+(c.difficulty==='cadet'?1:0),level:checkpoint?checkpoint.level:1,cells:checkpoint?checkpoint.cells:0,invul:checkpoint?2:3,recovery:0,fireCd:0,specialCd:0,focus:false,trail:[],grazeCd:0}};
    bullets.clear();game.particles.list.length=0;game.timeScale=1;game.shakeAmt=0;game._flash=null;
    if(checkpoint){M.eventIndex=D.events.findIndex(e=>e.t>checkpoint.clock);if(M.eventIndex<0)M.eventIndex=D.events.length;showBanner('FLIGHT RESUMED',checkpoint.label,2.5);radio('CONTROL','Aircraft restored. Continue the sortie.');}
    else showBanner('OPERATION GLASS TIDE','01 / THE COASTAL RUN',3.4);
    game.audio.music(S.mission);game.paused=false;lastPause=false;setOverlay('','none');setTouch();$('#screen').focus({preventScroll:true});
  }
  function radio(speaker,text,seconds=5){M.radio={speaker,text,t:seconds,total:seconds};sfx('comm');announce(`${speaker}: ${text}`);}
  function showBanner(title,subtitle,seconds=3){M.banner={title,subtitle,t:seconds,total:seconds};}
  function pickup(kind,x,y){M.pickups.push({kind,x,y,baseY:y,r:11,t:0,dead:false});}
  function spawn(type,x=684,y=170,extra={}){
    const spec=enemySpec[type];if(!spec)return null;
    const hp=spec.hp*D.difficulty[M.config.difficulty].hp;
    const e={id:M.nextId++,type,x,y,baseY:y,z:0,r:spec.r,hp,maxHp:hp,t:0,fire:1.4,flash:0,dead:false,warn:0,speed:spec.speed,score:spec.score,...extra};
    M.enemies.push(e);return e;
  }
  function dispatch(e){
    switch(e.type){
      case 'flight':{const gid=M.nextId++;M.groups[gid]={remaining:e.n,total:e.n,killed:0};for(let i=0;i<e.n;i++)M.scheduled.push({at:M.clock+i*e.gap,fn:()=>spawn(e.enemy,680,clamp(e.y+i*e.dy,76,272),{group:gid,drop:i===e.n-1?'power':null,phase:i*.55})});break;}
      case 'radio':radio(e.speaker,e.text);break;
      case 'hint':M.hint={text:e.text,t:e.seconds};break;
      case 'sector':M.sector=e.sector;showBanner(e.title,e.subtitle,2.8);break;
      case 'pickup':pickup(e.kind,658,e.y);break;
      case 'mines':for(let i=0;i<e.n;i++)spawn('mine',675+i*45,94+i*57,{phase:i});break;
      case 'checkpoint':M.checkpoint={clock:e.t,label:e.label,hp:M.player.hp,ammo:M.player.ammo,pulses:M.player.pulses,level:M.player.level,cells:M.player.cells,score:M.score,stats:{...M.stats}};M.hint={text:'CHECKPOINT SAVED / '+e.label,t:3};break;
      case 'boss':createBoss();break;
      default:spawn(e.type,684,e.y||178);break;
    }
  }
  function targets(){const b=M.boss;return M.enemies.filter(e=>!e.dead).concat(b&&b.t>=4?[b.top,b.bottom,...(b.coreOpen?[b.core]:[])].filter(p=>!p.dead):[]);}
  function enemyFire(e,vels,{damage=1,blue=false,missile=false}={}){
    const ds=D.difficulty[M.config.difficulty].speed;
    for(const v of vels){bullets.fire({x:e.x,y:e.y,z:0,vx:v[0]*ds,vy:v[1]*ds,r:missile?4:3,team:'enemy',dmg:damage,life:9,color:blue?'#fff3cb':'#ff9567',sprite:missile?null:blue?enemyBlue:enemyDot,homing:missile?.8:0});}
  }
  function aimed(e,n=1,arc=.3,speed=116){const angle=Math.atan2(M.player.y-e.y,M.player.x-e.x);enemyFire(e,E.pattern.spread(angle,n,arc,speed));}
  function hitEnemy(e,damage,b){
    if(e.dead)return;
    if(b&&!b.counted){M.stats.shotsHit++;b.counted=true;}
    e.hp-=damage;e.flash=.075;
    if((e.id+Math.floor(M.clock*30))%4===0)game.particles.sparks(b?.x||e.x,b?.y||e.y,0,2,Math.PI,{color:'#ffe6ac'});
    if(e.hp<=0){
      e.dead=true;
      if(e.part){if(e.part==='core')winMission();else{killScore(850,e.x,e.y);explode(e.x,e.y,1.1);radio('CONTROL',e.part==='top'?'Upper weapon pod destroyed.':'Lower weapon pod destroyed.',2.8);}}
      else killEnemy(e);
    }
  }
  function explode(x,y,size=.65){game.particles.explosion(x,y,0,size,{freeze:false,flash:false,shake:size>1?1.2:0,sound:false});sfx(size>1?'boom':'explode',{vol:size>1?.6:.3,pitch:1.1});}
  function killScore(base,x,y){M.combo++;M.comboTime=3.8;const mul=1+Math.min(2,Math.floor(M.combo/4)*.5);const val=Math.round(base*mul);M.score+=val;if(base>=180)game.particles.text(x,y,3,`+${val}`,'#ffe4a0',{bounce:false});}
  function killEnemy(e){
    M.stats.kills++;M.credits+=Math.floor(e.score/8);killScore(e.score,e.x,e.y);explode(e.x,e.y,e.type==='miniboss'?1.7:e.type==='bomber'?1:.6);
    if(e.type==='relay'){M.stats.relays++;pickup('power',e.x,e.y-28);radio('CONTROL',`Radar relay ${M.stats.relays} of 3 disabled.`,2.8);}
    else if(e.type==='miniboss'){pickup('repair',e.x-15,e.y-30);pickup('pulse',e.x+18,e.y+23);M.hint={text:'ESCORT GUNSHIP DESTROYED / SUPPLY DROP',t:4};}
    else if(e.drop)pickup(e.drop,e.x,e.y);
    else if(e.type==='bomber')pickup('ammo',e.x,e.y);
    if(e.group){const group=M.groups[e.group];group.killed++;if(group.killed===group.total){M.score+=300;game.particles.text(e.x,e.y-15,0,'FORMATION +300','#8feddf',{bounce:false});}}
  }
  function fireMain(){
    const p=M.player,f=D.frames[M.config.frame];let ys=[-3,3];
    if(f.id==='needle')ys=[0];
    if(f.id==='manta')ys=[-6,0,6];
    const level=p.level,damage=(f.id==='needle'?2.1:1.15)*f.power*(1+(level-1)*.22);
    for(let i=0;i<ys.length;i++){
      const vy=f.id==='manta'?(i-1)*(24+level*5):0;
      bullets.fire({x:p.x+25,y:p.y+ys[i],vx:490,vy,r:2,life:1.4,team:'player',dmg:damage,color:'#bbf3df',core:'#fff8d8'});M.stats.shots++;
    }
    if(level>=3){for(const s of [-1,1]){bullets.fire({x:p.x+19,y:p.y+s*7,vx:460,vy:s*18,r:1.7,life:1.5,team:'player',dmg:.7,color:'#6fceb6'});M.stats.shots++;}}
    p.fireCd=f.id==='needle'?.095:level>=2?.105:.13;
    sfx('cannon',{pitch:f.id==='needle'?1.12:.92});
  }
  function fireSpecial(){
    const p=M.player;if(p.specialCd>0||p.ammo<=0){if(p.ammo<=0&&p.specialCd<=0){M.hint={text:'SPECIAL AMMUNITION EMPTY',t:1.4};p.specialCd=.35;sfx('cancel',{vol:.15});}return;}
    p.ammo--;M.stats.specials++;p.specialCd=.42;sfx('missile');
    const w=D.weapons[M.config.weapon].id;
    if(w==='tracker'){
      for(const dir of [-1,1]){bullets.fire({x:p.x+8,y:p.y+dir*9,vx:225,vy:dir*64,r:3.2,team:'player',life:3.5,dmg:10,color:'#ffca75',homing:3.5,tracker:true});M.stats.shots++;}
    }else if(w==='lance'){
      bullets.fire({x:p.x+25,y:p.y,vx:670,vy:0,r:7,team:'player',life:1,dmg:26,pierce:true,color:'#ffeac1',lance:true});M.stats.shots++;M.beamFX.push({x:p.x+25,y:p.y,t:.14});sfx('laser',{vol:.35});
    }else{
      for(const i of [-1,0,1]){bullets.fire({x:p.x+10,y:p.y+8,vx:255+i*27,vy:108+i*45,r:5,team:'player',life:2.5,dmg:14,color:'#f5b36c',dive:true});M.stats.shots++;}
    }
  }
  function pulse(){
    const p=M.player;if(p.pulses<=0){M.hint={text:'NO PULSES REMAIN',t:1.3};sfx('cancel',{vol:.15});return;}
    p.pulses--;M.stats.pulses++;p.recovery=0;p.invul=2;M.pulseFX=.72;bullets.clear('enemy');
    for(const e of targets())hitEnemy(e,e.part?38:34,null);
    if(M.boss)M.boss.laser=null;
    game.particles.ring(p.x,p.y,8,550,'#b7fae7',.7,0);game.shake(4);sfx('pulse');M.hint={text:'PULSE RELEASED / SYSTEMS STABLE',t:1.8};
  }
  function hurt(kind='bullet'){
    const p=M.player;if(p.invul>0||M.win||M.fail)return false;
    const d=D.difficulty[M.config.difficulty],danger=p.recovery>0;
    let damage=d.damage*(kind==='collision'?1.35:1)*(danger?2:1);
    if(M.config.difficulty==='ace'&&danger)damage=p.hp+1;
    p.hp=Math.max(0,p.hp-damage);p.invul=d.grace;p.recovery=D.pilots[M.config.pilot].recovery;M.stats.hits++;M.combo=0;M.comboTime=0;
    game.hitFx(p.x,p.y,0,{power:.85,freeze:.055,shake:3.2,sound:'hurt'});sfx('warning');
    if(p.hp<=0){M.fail=.01;M.deathCause=danger?'A second hit struck during system recovery. Use a pulse or move into clear air after the first hit.':'The hull failed under enemy fire. Use precise movement and save a pulse for difficult patterns.';explode(p.x,p.y,2.2);bullets.clear('enemy');game.audio.music(null);announce('Aircraft lost.');setTouch();}
    else M.hint={text:danger?'HEAVY DAMAGE / FIND CLEAR AIR':'SYSTEM RECOVERY / AVOID A SECOND HIT',t:2.3};
    return true;
  }
  function collect(q){
    const p=M.player;q.dead=true;
    if(q.kind==='power'){
      if(p.level>=4){M.score+=500;game.particles.text(p.x,p.y-18,0,'+500','#abf3e0',{bounce:false});}
      else {p.cells++;if(p.cells>=D.pilots[M.config.pilot].cells){p.cells=0;p.level++;M.hint={text:'CANNON UPGRADED / LEVEL '+p.level,t:2.5};sfx('powerup');game.particles.ring(p.x,p.y,4,48,'#86dfcf',.6,0);}else sfx('pickupCell');}
      M.score+=100;
    }else if(q.kind==='repair'){const gain=Math.min(32,p.maxHp-p.hp);p.hp=Math.min(p.maxHp,p.hp+32);p.recovery=0;M.hint={text:'HULL REPAIRED +'+Math.ceil(gain),t:2};sfx('heal');}
    else if(q.kind==='ammo'){p.ammo=Math.min(p.maxAmmo,p.ammo+5);M.hint={text:'SPECIAL AMMUNITION +5',t:1.8};sfx('pickupCell');}
    else if(q.kind==='pulse'){p.pulses=Math.min(5,p.pulses+1);M.hint={text:'EMERGENCY PULSE +1',t:1.8};sfx('powerup');}
    game.particles.glints(q.x,q.y,0,8,q.kind==='repair'?'#a9eaa1':'#90ebd6');
  }

  function createBoss(){
    const d=D.difficulty[M.config.difficulty];
    M.enemies=M.enemies.filter(e=>e.type==='miniboss'&&!e.dead);for(const e of M.enemies)e.retreat=true;
    bullets.clear('enemy');
    const part=(id,hp,r)=>({id:M.nextId++,part:id,x:0,y:0,r,hp:hp*d.hp,maxHp:hp*d.hp,dead:false,flash:0});
    M.boss={x:770,y:181,t:0,phase:1,phaseTime:0,coreOpen:false,top:part('top',105,19),bottom:part('bottom',105,19),core:part('core',330,24),fireTop:1.2,fireBottom:2.2,fireCore:2.7,nextLaser:5.5,nextAdd:7,addCount:0,scoredGrazes:0,laser:null,flash:0};
    showBanner('WARNING / BREAKWATER','AIRBORNE SIEGE CARRIER',4);sfx('warning');game.audio.music(S.boss);announce('Breakwater has arrived. Destroy both weapon pods.');
  }
  function updateBoss(dt){
    const b=M.boss;if(!b||M.win)return;
    b.t+=dt;b.phaseTime+=dt;b.x=E.approach(b.x,530,57*dt);
    b.y=181+Math.sin(b.t*(b.phase===3?.86:.49))*(b.phase===3?39:13);
    Object.assign(b.top,{x:b.x-40,y:b.y-42});Object.assign(b.bottom,{x:b.x-30,y:b.y+46});Object.assign(b.core,{x:b.x-22,y:b.y+2});
    for(const part of [b.top,b.bottom,b.core])part.flash=Math.max(0,part.flash-dt);
    if(b.t<4)return;
    if(b.phase===1&&b.top.dead&&b.bottom.dead){b.phase=2;b.phaseTime=0;b.nextLaser=4;b.fireCore=2;radio('CONTROL','Armor is down. Hit the reactor when the iris opens.');showBanner('ARMOR ARRAY DESTROYED','REACTOR ACCESS OPEN',2);sfx('powerup');pickup('power',b.x-120,b.y);}
    if(b.phase===2&&b.core.hp<b.core.maxHp*.42){b.phase=3;b.phaseTime=0;b.nextLaser=2.5;b.fireCore=1.4;radio('CONTROL','Reactor unstable. Finish the carrier and get clear.');showBanner('REACTOR CRITICAL','FINAL ATTACK',2);}
    b.coreOpen=b.phase===3||(b.phase===2&&b.phaseTime%6>1.65);
    if(b.phase===1){
      b.fireTop-=dt;b.fireBottom-=dt;
      if(!b.top.dead&&b.fireTop<=0){enemyFire(b.top,E.pattern.spread(Math.PI+.10,5,1,102));b.fireTop=2.3;}
      if(!b.bottom.dead&&b.fireBottom<=0){aimed(b.bottom,3,.42,119);b.fireBottom=2.7;}
    }else{
      b.fireCore-=dt;b.nextLaser-=dt;
      if(b.fireCore<=0){aimed(b.core,b.phase===3?7:5,b.phase===3?1.15:.86,b.phase===3?133:111);b.fireCore=b.phase===3?1.75:2.7;}
      if(b.nextLaser<=0){b.laser={y:clamp(M.player.y,85,285),t:0,warm:1.05,duration:1};b.nextLaser=b.phase===3?6.2:7.8;sfx('lock');}
      if(b.phase===3&&b.addCount<3){b.nextAdd-=dt;if(b.nextAdd<=0){spawn('interceptor',668,90,{drop:'power'});b.nextAdd=9;b.addCount++;}}
    }
    if(b.laser){b.laser.t+=dt;if(b.laser.t>b.laser.warm&&b.laser.t<b.laser.warm+b.laser.duration&&Math.abs(M.player.y-b.laser.y)<12&&M.player.x<b.x-20)hurt('laser');if(b.laser.t>b.laser.warm+b.laser.duration)b.laser=null;}
  }
  function winMission(){
    if(M.win||M.fail)return;M.win=.01;M.boss.core.dead=true;bullets.clear();M.enemies=[];M.score+=6500;M.combo=0;M.player.invul=99;
    if(M.stats.relays===3)M.score+=1500;
    M.score+=Math.ceil(M.player.hp)*20+(D.budget-cost(M.config))*2;
    M.banner=null;M.hint=null;M.pulseFX=0;M.beamFX=[];setTouch();
    game.freeze(.13);game.shake(6);sfx('boom');game.audio.music(S.victory);radio('CONTROL','Breakwater is down. The coast is clear. Come home, Brasswing.',6);announce('Carrier destroyed. Mission complete.');
  }
  function updateEnemies(dt){
    const p=M.player;
    for(const e of M.enemies){
      if(e.dead)continue;e.t+=dt;e.flash=Math.max(0,e.flash-dt);e.fire-=dt;
      if(e.type==='miniboss'){
        if(M.clock>104||e.retreat){e.x+=100*dt;if(e.x>760)e.dead=true;continue;}
        e.x=E.approach(e.x,488,75*dt);e.y=180+Math.sin(e.t*.75)*41;
        if(e.x<570&&e.fire<=0){aimed({x:e.x-64,y:e.y},e.hp<e.maxHp*.5?5:3,.6,112);if(e.hp<e.maxHp*.5)enemyFire({x:e.x-30,y:e.y+29},E.pattern.spread(Math.PI,3,.9,95));e.fire=1.85;}
      }else{
        e.x-=e.speed*dt;
        if(e.type==='scout'){e.y=e.baseY+Math.sin(e.t*2.7+(e.phase||0))*13;if(e.fire<=0&&e.x>p.x+110&&e.x<525){aimed(e,1,0,104);e.fire=3.3;}}
        else if(e.type==='interceptor'){e.y=clamp(e.baseY+Math.sin(e.t*1.75+(e.phase||0))*30,70,287);if(e.fire<=0&&e.x>p.x+100&&e.x<560){aimed(e,3,.36,114);e.fire=2.7;}}
        else if(e.type==='bomber'){e.y=e.baseY+Math.sin(e.t*.7)*10;if(e.fire<=0&&e.x>100&&e.x<570){enemyFire(e,E.pattern.spread(Math.PI*.7,5,1.7,82));e.fire=2.8;}}
        else if(e.type==='mine'){e.y=e.baseY+Math.sin(e.t*1.4+(e.phase||0))*10;if(e.x<100)e.dead=true;if(e.x<510&&Math.hypot(e.x-p.x,e.y-p.y)<110&&!e.armed){e.armed=true;e.fire=.85;}if(e.armed&&e.fire<=0){enemyFire(e,E.pattern.ring(8,80,.15));explode(e.x,e.y,.5);e.dead=true;}}
        else if(e.x>p.x+55&&e.x<560&&e.fire<=0){if(e.type==='missileBoat'){const vs=E.pattern.spread(-Math.PI/2,2,.4,86);enemyFire({x:e.x-7,y:e.y-12},vs,{missile:true});e.fire=3.1;}else{aimed({x:e.x-5,y:e.y-14},e.type==='relay'?3:2,.28,116);e.fire=e.type==='relay'?2.5:2.2;}}
      }
      if(e.x<-90||e.y>400){e.dead=true;continue;}
      const hitR=e.type==='miniboss'?42:e.r*.82;
      if(!e.dead&&Math.hypot(p.x-e.x,p.y-e.y)<p.r+hitR){if(hurt('collision')&&e.type!=='miniboss'){e.hp-=15;if(e.hp<=0){e.dead=true;killEnemy(e);}}}
    }
    E.prune(M.enemies,e=>e.dead);
  }
  function updateBullets(dt){
    const ts=targets();
    for(const b of bullets.list){
      if(b.homing>0){
        b.homing-=dt;
        if(b.team==='enemy'){
          const a=Math.atan2(M.player.y-b.y,M.player.x-b.x),cur=Math.atan2(b.vy,b.vx),next=E.approachAng(cur,a,1.6*dt);b.vx=Math.cos(next)*124*D.difficulty[M.config.difficulty].speed;b.vy=Math.sin(next)*124*D.difficulty[M.config.difficulty].speed;
        }else{
          let target=b.target;if(!target||target.dead){target=ts.filter(t=>t.x>b.x-30).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];b.target=target;}
          if(target){const a=Math.atan2(target.y-b.y,target.x-b.x),cur=Math.atan2(b.vy,b.vx),next=E.approachAng(cur,a,4.5*dt);b.vx=Math.cos(next)*285;b.vy=Math.sin(next)*285;}
        }
      }
      if(b.x<-30||b.x>750||b.y<43||b.y>319)b.dead=true;
    }
    bullets.update(dt);
    bullets.hit(ts,(b,t)=>hitEnemy(t,b.dmg,b),'player');
    if(M.boss&&!M.boss.coreOpen&&!M.boss.core.dead){bullets.hit([M.boss.core],(b,t)=>{game.particles.sparks(b.x,b.y,0,2,null,{color:'#85cfd2'});},'player');}
    if(!M.fail&&!M.win){
      bullets.hit([M.player],()=>hurt('bullet'),'enemy');
      for(const b of bullets.list){if(b.team!=='enemy'||b.grazed)continue;const d=Math.hypot(b.x-M.player.x,b.y-M.player.y);if(d<19&&d>9&&M.player.invul<=0){b.grazed=true;M.stats.grazes++;if(!M.boss||M.boss.scoredGrazes<120){M.score+=15;if(M.boss)M.boss.scoredGrazes++;}}}
    }
  }
  function updateFlight(dt){
    if(!M)return;
    if(M.fail){M.fail+=dt;if(M.fail>1.7)game.go('debrief',{success:false});return;}
    if(M.win){
      M.win+=dt;M.scroll+=35*dt;M.player.x+=M.win>3?95*dt:0;M.player.y=E.approach(M.player.y,158,35*dt);if(M.radio)M.radio.t=Math.max(0,M.radio.t-dt);
      if(M.win<3.5&&Math.floor(M.win*8)!==Math.floor((M.win-dt)*8)){const b=M.boss;explode(b.x-75+M.seed()*140,b.y-48+M.seed()*95,1.1+M.seed()*.6);}
      if(M.win>6)game.go('debrief',{success:true});return;
    }
    M.clock+=dt;M.scroll+=(M.boss?16:54)*dt;M.comboTime-=dt;if(M.comboTime<=0)M.combo=0;
    if(M.radio){M.radio.t-=dt;if(M.radio.t<=0)M.radio=null;}
    if(M.hint){M.hint.t-=dt;if(M.hint.t<=0)M.hint=null;}
    if(M.banner){M.banner.t-=dt;if(M.banner.t<=0)M.banner=null;}
    M.pulseFX=Math.max(0,M.pulseFX-dt);for(const fx of M.beamFX)fx.t-=dt;E.prune(M.beamFX,fx=>fx.t<=0);
    while(M.eventIndex<D.events.length&&D.events[M.eventIndex].t<=M.clock)dispatch(D.events[M.eventIndex++]);
    for(const e of M.scheduled)if(!e.done&&e.at<=M.clock){e.done=true;e.fn();}E.prune(M.scheduled,e=>e.done);
    const p=M.player,inp=game.input,f=D.frames[M.config.frame];
    p.invul=Math.max(0,p.invul-dt);p.recovery=Math.max(0,p.recovery-dt);p.fireCd-=dt;p.specialCd-=dt;
    p.focus=inp.down('focus');const move=touchVec.some(v=>Math.abs(v)>.03)?touchVec:inp.move();
    const speed=f.speed*(p.focus?.44:1);
    p.vx=E.approach(p.vx,move[0]*speed,1800*dt);p.vy=E.approach(p.vy,move[1]*speed,1800*dt);
    p.bank=E.approach(p.bank,p.vy/speed,6*dt);
    if(M.clock<2.6&&!M.startAt){p.x=lerp(-40,108,E.ease.outCubic(clamp(M.clock/2.6,0,1)));p.y=185;}
    else{p.x=clamp(p.x+p.vx*dt,28,M.boss?Math.min(600,M.boss.x-116):600);p.y=clamp(p.y+p.vy*dt,M.boss?76:59,305);}
    if(M.clock>2.4){if((settings.autoFire||isTouch||inp.down('fire'))&&p.fireCd<=0)fireMain();if(inp.pressed('special'))fireSpecial();if(inp.pressed('pulse'))pulse();}
    updateEnemies(dt);if(M.fail)return;updateBoss(dt);if(M.fail)return;updateBullets(dt);
    for(const q of M.pickups){q.t+=dt;q.x-=48*dt;q.y=q.baseY+Math.sin(q.t*3)*4;
      const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<56){q.x+=(p.x-q.x)*dt*3.3;q.baseY+=(p.y-q.baseY)*dt*3.3;}
      if(d<22)collect(q);if(q.x<-25)q.dead=true;
    }E.prune(M.pickups,q=>q.dead);
    if(p.recovery>0&&Math.floor(M.clock*13)!==Math.floor((M.clock-dt)*13))game.particles.smoke(p.x-19,p.y,0,1,{size:3,speed:12});
  }

  function drawPickup(g,q){
    const x=Math.round(q.x),y=Math.round(q.y),pulse=Math.floor(q.t*5)%2;
    const colors={power:'#71e4d5',repair:'#b3ec9a',ammo:'#f7c775',pulse:'#f899a3'},c=colors[q.kind];
    E.px.poly(g,[[x,y-12],[x+12,y],[x,y+12],[x-12,y]],'#132f3b');
    E.px.poly(g,[[x,y-10],[x+10,y],[x,y+10],[x-10,y]],c);
    E.px.poly(g,[[x,y-7],[x+7,y],[x,y+7],[x-7,y]],pulse?'#295762':'#20414d');
    if(q.kind==='power'){E.px.poly(g,[[x,y-4],[x+3,y],[x,y+4],[x-3,y]],'#dcfff3');}
    if(q.kind==='repair'){E.px.rect(g,x-1,y-5,3,11,c);E.px.rect(g,x-5,y-1,11,3,c);}
    if(q.kind==='ammo'){E.px.rect(g,x-4,y-3,3,7,c);E.px.rect(g,x+1,y-3,3,7,c);}
    if(q.kind==='pulse'){E.px.disc(g,x,y,4,c);E.px.disc(g,x,y,2,'#274450');}
  }
  function drawHUD(g){
    const p=M.player,c=M.config,f=D.frames[c.frame],w=D.weapons[c.weapon],boss=M.boss;
    const px=E.px,F=E.font;
    px.rect(g,0,0,W,44,'#102633');px.rect(g,0,43,W,1,'#628078');
    F.text(g,`${f.code} / ${D.pilots[c.pilot].name.split(' ')[0]}`,13,7,'#f1cc88',{outline:false});
    F.text(g,'HULL',13,23,'#9cbdbd',{outline:false});
    px.rect(g,45,22,104,9,'#30424b');px.rect(g,46,23,102*clamp(p.hp/p.maxHp,0,1),7,p.hp<35?'#ed856b':p.recovery>0?'#ecc47a':'#80d7be');
    for(let i=1;i<10;i++)px.rect(g,46+i*10.2,23,1,7,'#132b35');
    F.text(g,`${Math.ceil(p.hp)}`,155,23,'#f6ebce',{outline:false});
    F.text(g,`GUN ${p.level}`,193,7,'#e9dcbc',{outline:false});
    for(let i=0;i<D.pilots[c.pilot].cells;i++){px.rect(g,194+i*9,24,6,6,i<p.cells?'#8bf0d9':'#375665');}
    F.text(g,'SCORE',320,5,'#9db4b2',{outline:false,align:'center'});F.text(g,Math.floor(M.score*D.difficulty[c.difficulty].score).toString().padStart(7,'0'),320,18,'#fff0cb',{outline:false,scale:2,align:'center'});
    if(M.combo>=4)F.text(g,`x${(1+Math.min(2,Math.floor(M.combo/4)*.5)).toFixed(1)}`,390,26,'#eed092',{outline:false});
    F.text(g,`${w.name} ${p.ammo.toString().padStart(2,'0')}`,456,7,'#efcc88',{outline:false});
    F.text(g,'PULSE',456,24,'#a3b7b5',{outline:false});
    for(let i=0;i<Math.min(5,p.pulses);i++)px.poly(g,[[494+i*10,22],[498+i*10,26],[494+i*10,30],[490+i*10,26]],'#8be0c7');
    F.text(g,clock(M.clock),626,7,'#d3deca',{outline:false,align:'right'});F.text(g,D.difficulty[c.difficulty].name,626,25,'#88aeb7',{outline:false,align:'right'});
    if(boss&&!M.win){
      const hp=(Math.max(0,boss.top.hp)+Math.max(0,boss.bottom.hp)+Math.max(0,boss.core.hp))/(boss.top.maxHp+boss.bottom.maxHp+boss.core.maxHp);
      px.rect(g,162,47,316,19,'#132b34');F.text(g,'BREAKWATER',170,50,'#e4bca0',{outline:false});
      px.rect(g,252,50,217,5,'#43515a');px.rect(g,253,51,215*hp,3,boss.phase===3?'#f39377':'#d8b076');
      F.text(g,boss.phase===1?'DESTROY BOTH PODS':boss.coreOpen?'REACTOR EXPOSED':'IRIS CLOSED',469,58,boss.coreOpen?'#9de6cd':'#bcac91',{outline:false,align:'right'});
    }
    px.rect(g,0,327,W,33,'#102633');px.rect(g,0,326,W,1,'#628078');
    px.rect(g,13,320,614,2,'#203e4a');px.rect(g,13,320,614*clamp(M.clock/D.bossTime,0,1),2,'#caa567');
    for(const n of [53,115,169])px.rect(g,12+614*n/169,318,2,6,'#abc4bd');
    if(M.radio){
      F.text(g,M.radio.speaker,13,333,'#a5e2d5',{outline:false});
      const n=Math.min(M.radio.text.length,Math.floor((M.radio.total-M.radio.t)*45));F.text(g,M.radio.text.slice(0,n),87,333,'#e4e4ce',{outline:false,wrap:537});
    }else if(M.hint){F.text(g,M.hint.text,320,338,'#efd49b',{outline:false,align:'center'});}
    else{F.text(g,`${['COASTAL RUN','IRON CHANNEL','BREAKWATER APPROACH'][M.sector]} / RADAR ${M.stats.relays}/3`,13,338,'#8bb2b9',{outline:false});F.text(g,`${settings.autoFire?'AUTO FIRE ON':'Z / FIRE'}   X / SPECIAL   C / PULSE`,626,338,'#a7bcb8',{outline:false,align:'right'});}
    if(p.recovery>0&&!M.fail&&!M.win){
      const xx=clamp(p.x-62,8,500),yy=clamp(p.y+24,76,298);px.rect(g,xx-3,yy-3,130,17,'#192e38');
      F.text(g,`RECOVERY ${p.recovery.toFixed(1)}s`,xx,yy,'#ffc580',{outline:false});px.rect(g,xx,yy+10,122*p.recovery/D.pilots[c.pilot].recovery,2,'#efb36c');
    }
    if(M.banner){
      if(M.clock<4||(boss&&boss.t<4)){
        const alpha=Math.min(1,M.banner.t/.4,(M.banner.total-M.banner.t)/.25);g.save();g.globalAlpha=alpha*.92;px.rect(g,0,132,W,66,'#142b37');g.restore();
        if(alpha>.15){F.text(g,M.banner.title,320,147,'#f3ddaf',{align:'center',scale:M.banner.title.length>31?1:2,outline:false});F.text(g,M.banner.subtitle,320,175,'#acd8cc',{align:'center',outline:false});}
      }else{
        px.rect(g,0,328,W,32,'#16303b');F.text(g,M.banner.title,320,332,'#f3ddaf',{align:'center',outline:false});F.text(g,M.banner.subtitle,320,346,'#acd8cc',{align:'center',outline:false});
      }
    }
  }
  function drawFlight(r){
    if(!M)return;
    const p=M.player,g=r.ctx,visualTime=M.clock+(M.win||0);A.background(g,{W,H,time:visualTime,scroll:M.scroll,sector:M.sector,reduced:settings.reducedMotion});
    for(const q of M.pickups)r.queue(q.x,q.y,0,gg=>drawPickup(gg,q),{bias:500});
    for(const e of M.enemies){r.queue(e.x,e.y,0,gg=>{const [x,y]=r.w(e.x,e.y,0);if(e.type==='miniboss')A.miniboss(gg,x,y,{time:visualTime,hit:e.flash>0,hp:e.hp/e.maxHp});else{A.enemy(gg,e.type==='relay'?'turret':e.type,x,y,{time:visualTime,flash:e.flash>0});if(e.type==='relay'){E.px.line(gg,x,y-11,x,y-34,'#b4dad2',1);E.px.line(gg,x-12,y-29,x+12,y-29,'#f2c781',2);E.px.disc(gg,x,y-34,3,'#8febdb');E.font.text(gg,'R',x,y+18,'#b1eee1',{align:'center',outline:'#142837'});}if(e.fire<.48&&e.x>p.x+55){E.px.disc(gg,x-12,y,3+Math.floor(e.fire*8),'#eab879');E.px.dot(gg,x-12,y,'#fff0c8');}}},{bias:10});}
    if(M.boss){const b=M.boss;r.queue(b.x,b.y,0,gg=>{const [x,y]=r.w(b.x,b.y);A.boss(gg,x,y,{time:visualTime,phase:b.phase,hit:false,upper:Math.max(0,b.top.hp/b.top.maxHp),lower:Math.max(0,b.bottom.hp/b.bottom.maxHp),coreOpen:b.coreOpen||!!M.win});for(const part of [b.top,b.bottom,b.core])if(part.flash>0){const [hx,hy]=r.w(part.x,part.y);E.px.line(gg,hx-8,hy,hx+8,hy,'#fff4d2',2);E.px.line(gg,hx,hy-8,hx,hy+8,'#fff4d2',2);}
      if(b.t>4&&!M.win){for(const part of [b.top,b.bottom])if(!part.dead){const [xx,yy]=r.w(part.x,part.y);E.px.rect(gg,xx-18,yy-27,36,3,'#29444b');E.px.rect(gg,xx-18,yy-27,36*part.hp/part.maxHp,3,'#e9b578');}}
    },{bias:15});
      if(b.laser&&!M.win){const L=b.laser;const active=L.t>L.warm;r.overlay(gg=>{const y=Math.round(L.y);if(active){E.px.rect(gg,0,y-11,b.x-18,22,'#ad4f4b');E.px.rect(gg,0,y-6,b.x-16,12,'#ffb67f');E.px.rect(gg,0,y-2,b.x-13,4,'#fff5d2');}else{for(let x=0;x<b.x-25;x+=14)E.px.rect(gg,x,y-1,7,2,Math.floor(L.t*8)%2?'#f39573':'#ead6ac');E.font.text(gg,'BEAM LOCK',25,y-13,'#ffe4b4',{outline:'#18343f'});}});}
    }
    if(!M.fail){r.queue(p.x,p.y,0,gg=>{const [x,y]=r.w(p.x,p.y);const flicker=p.invul>0&&Math.floor(M.clock*14)%2===0;
      if(!flicker||M.clock<2.5||M.win){A.player(gg,x,y,{time:visualTime,bank:p.bank,frame:D.frames[M.config.frame].id,thrust:true,hit:p.invul>.85&&p.recovery>0});}
      if(p.focus||settings.hitPoint){E.px.disc(gg,x,y,5,'#102c36');E.px.disc(gg,x,y,3,'#e4ffed');E.px.dot(gg,x,y,'#4bbcae');}
    },{bias:700});}
    bullets.draw(r);
    for(const fx of M.beamFX)r.overlay(gg=>{gg.save();gg.globalAlpha=fx.t/.14*.45;E.px.rect(gg,fx.x,fx.y-2,W-fx.x,4,'#ffdd9f');gg.restore();});
    if(M.pulseFX>0)r.overlay(gg=>{const size=(.72-M.pulseFX)*750;E.px.blend(gg,.38,'add',()=>{E.px.ell(gg,p.x,p.y,size,size*.75,'#b0edcf');});});
    r.overlay(drawHUD);
    if(game.paused!==lastPause){lastPause=game.paused;if(game.paused)pauseUI();else if(ui==='pause'){setOverlay('','none');setTouch();}}
  }
  function drawTitle(r){
    A.background(r.ctx,{W,H,time:game.time,scroll:game.time*14,sector:0,reduced:settings.reducedMotion});
    r.overlay(g=>{A.player(g,456+Math.sin(game.time*.55)*6,161+Math.sin(game.time*.9)*7,{time:game.time,bank:Math.sin(game.time*.6)*.25,frame:D.frames[config.frame].id,scale:2.45});A.player(g,584,122+Math.sin(game.time*.7)*3,{time:game.time,bank:0,frame:'needle',scale:.65});E.px.line(g,382,212,546,212,'#50727c',1);E.px.line(g,382,213,382,216,'#50727c',1);E.px.line(g,546,213,546,216,'#50727c',1);E.font.text(g,'K-17 / BRASSWING FLIGHT',464,222,'#173948',{align:'center',outline:false});});
  }
  function menuPad(){
    const inp=game.input;
    const btns=[...overlay.querySelectorAll('button:not([disabled])')];
    if(inp.repeat('down')||inp.repeat('right')){const i=btns.indexOf(document.activeElement);btns[(i+1)%btns.length]?.focus();}
    if(inp.repeat('up')||inp.repeat('left')){const i=btns.indexOf(document.activeElement);btns[(i-1+btns.length)%btns.length]?.focus();}
    if(inp.pressed('confirm')||inp.pressed('start')){const active=document.activeElement;if(btns.includes(active))active.click();else overlay.querySelector('.primary')?.click();inp.consumeAll();}
  }
  game.start({scene:'title',scenes:{
    title:{enter(){titleUI();game.audio.music(S.title);game.focus(W/2,H/2);},update(){},draw:drawTitle},
    hangar:{enter(){hangarUI();game.audio.music(S.title);game.focus(W/2,H/2);},update(){},draw:drawTitle},
    play:{pausable:true,enter(data){newMission(data?.checkpoint||null);game.focus(W/2,H/2);},update:updateFlight,draw:drawFlight},
    debrief:{enter(data){resultsUI(!!data.success);if(!data.success)sfx('die',{vol:.45});},update(){},draw(r){A.background(r.ctx,{W,H,time:M.clock,scroll:M.scroll,sector:M.sector,reduced:true});}}
  }});

  const nativeInputTick=game.input.tick.bind(game.input);
  game.input.tick=dt=>{
    nativeInputTick(dt);
    if(ui==='help'&&(game.input.pressed('cancel')||game.input.pressed('pause'))){game.input.consumeAll();closeHelp();return;}
    if(ui!=='none')menuPad();
    if(ui==='help')game.input.now.delete('pause');
  };

  // Semantic menus and input adapters. Touch input shares the engine's action map.
  overlay.addEventListener('click',ev=>{const b=ev.target.closest('button[data-act]');if(!b||b.disabled)return;act(b.dataset.act,b.dataset.value);});
  function act(action,value){
    sfx('select',{vol:.23});game.input.consumeAll();
    switch(action){
      case 'prepare':case 'hangar':game.go('hangar');break;
      case 'title':game.go('title');break;
      case 'launch':if(affordable())game.go('play');break;
      case 'frame':case 'pilot':case 'weapon':{const candidate={...config,[action]:+value};if(affordable(candidate)){config=candidate;hangarUI();}else{announce('Not enough credits. Remove an upgrade first.');const el=$('#balance');el.textContent='NEED '+money(cost(candidate)-D.budget)+' CR';el.style.color='#f4977b';sfx('cancel');}break;}
      case 'armor':case 'extraPulse':{const candidate={...config,[action]:!config[action]};if(affordable(candidate)){config=candidate;hangarUI();}else{const el=$('#balance');el.textContent='NEED '+money(cost(candidate)-D.budget)+' CR';el.style.color='#f4977b';sfx('cancel');}break;}
      case 'difficulty':if(D.difficulty[value]){config.difficulty=value;hangarUI();}break;
      case 'manual':openHelp();break;
      case 'closeHelp':closeHelp();break;
      case 'resume':game.paused=false;lastPause=false;setOverlay('','none');setTouch();$('#screen').focus({preventScroll:true});break;
      case 'restart':config={...M.config};game.go('play');break;
      case 'checkpoint':config={...M.config};game.go('play',{checkpoint:M.checkpoint});break;
    }
  }
  overlay.addEventListener('change',ev=>{const k=ev.target.dataset.setting;if(!k)return;settings[k]=k==='volume'?+ev.target.value/100:ev.target.checked;game.reduceMotion=settings.reducedMotion;game.audio.setVolume(settings.muted?0:settings.volume);save();});
  overlay.addEventListener('input',ev=>{if(ev.target.dataset.setting==='volume'){settings.volume=+ev.target.value/100;game.audio.setVolume(settings.muted?0:settings.volume);save();}});
  function mute(){settings.muted=!settings.muted;game.audio.setVolume(settings.muted?0:settings.volume);$('#sound-btn').innerHTML=`SOUND <span>${settings.muted?'OFF':'ON'}</span>`;$('#sound-btn').setAttribute('aria-label',settings.muted?'Turn sound on':'Turn sound off');save();}
  $('#sound-btn').addEventListener('click',mute);$('#help-btn').addEventListener('click',openHelp);$('#pause-touch').addEventListener('click',()=>{game.paused=true;pauseUI();});
  $('#fullscreen-btn').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else stage.requestFullscreen?.().catch(()=>{});});
  $('#home-link').addEventListener('click',e=>{e.preventDefault();if(game.sceneName==='play'){game.paused=true;pauseUI();}else game.go('title');});
  document.addEventListener('fullscreenchange',()=>{game.screen.resize();});
  document.addEventListener('keydown',ev=>{
    if(ev.repeat)return;
    if(ui!=='none'&&['INPUT','SELECT'].includes(ev.target?.tagName)){ev.stopPropagation();return;}
    if(ev.code==='KeyM'){mute();return;}if(ev.code==='KeyF'&&ui!=='hangar'){$('#fullscreen-btn').click();return;}
    if(ui==='help'&&ev.code==='Escape'){ev.preventDefault();ev.stopPropagation();game.input.consumeAll();closeHelp();return;}
    if(ui==='pause'&&(ev.code==='Enter'||ev.code==='Space')){ev.preventDefault();ev.stopPropagation();if(document.activeElement?.tagName==='BUTTON')document.activeElement.click();else act('resume');game.input.consumeAll();return;}
    if(ui!=='none'&&ev.code==='Enter'){ev.preventDefault();ev.stopPropagation();if(document.activeElement?.tagName==='BUTTON')document.activeElement.click();else overlay.querySelector('.primary')?.click();game.input.consumeAll();}
    else if(ui!=='none'&&ev.code==='Space'&&document.activeElement?.tagName==='BUTTON'){ev.preventDefault();ev.stopPropagation();document.activeElement.click();game.input.consumeAll();}
  });
  function lostFocus(){touchVec=[0,0];if(game.sceneName==='play'&&M&&!M.win&&!M.fail){game.paused=true;if(ui!=='help')pauseUI();}}
  window.addEventListener('blur',lostFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)lostFocus();});
  for(const b of document.querySelectorAll('[data-touch]')){const code={focus:'ShiftLeft',special:'KeyX',pulse:'KeyC'}[b.dataset.touch];b.addEventListener('pointerdown',ev=>{ev.preventDefault();b.setPointerCapture(ev.pointerId);game.input.press(code);});const end=()=>game.input.release(code);for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,end);}
  const joy=$('#joystick'),knob=joy.querySelector('span');let joyPointer=null;
  const joyMove=ev=>{if(ev.pointerId!==joyPointer)return;const rc=joy.getBoundingClientRect(),max=rc.width*.34;let dx=(ev.clientX-rc.left-rc.width/2)/max,dy=(ev.clientY-rc.top-rc.height/2)/max;const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}touchVec=[dx,dy];knob.style.transform=`translate(${dx*max*.68}px,${dy*max*.68}px)`;};
  joy.addEventListener('pointerdown',ev=>{ev.preventDefault();joyPointer=ev.pointerId;joy.setPointerCapture(ev.pointerId);joyMove(ev);});joy.addEventListener('pointermove',joyMove);
  const joyEnd=ev=>{if(ev.pointerId!==joyPointer)return;joyPointer=null;touchVec=[0,0];knob.style.transform='';};for(const event of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(event,joyEnd);
  window.addEventListener('resize',()=>{isTouch=matchMedia('(pointer:coarse)').matches;setTouch();});
  if(settings.muted)$('#sound-btn').innerHTML='SOUND <span>OFF</span>';
  // A narrow inspection surface for offline checks. No debug buttons enter the game UI.
  window.Brasswing={version:'1.0.0',getState:()=>({scene:game.sceneName,paused:game.paused,time:M?.clock||0,score:M?.score||0,errors:game.errors.length})};
  if(document.modelContext?.registerTool){
    const lifetime=new AbortController();
    const readFlight={name:'read_flight_state',title:'Read flight state',description:'Read the current BRASSWING screen, selected equipment, visible flight statistics, and controls. This does not change the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');
      return {screen:ui==='none'?'flight':ui,paused:game.paused,aircraft:D.frames[config.frame].name,pilot:D.pilots[config.pilot].name,weapon:D.weapons[config.weapon].name,difficulty:D.difficulty[config.difficulty].name,creditsAvailable:D.budget-cost(),flight:M?{time:clock(M.clock),hull:Math.ceil(M.player.hp),maxHull:M.player.maxHp,gunLevel:M.player.level,specialAmmo:M.player.ammo,pulses:M.player.pulses,score:Math.floor(M.score*D.difficulty[M.config.difficulty].score),radarRelays:M.stats.relays,bossPhase:M.boss?.phase||null}:null,controls:{move:'WASD or arrows',fire:'Z or Space',special:'X',pulse:'C',focus:'Shift',pause:'Escape or P'}};
    }};
    try{Promise.resolve(document.modelContext.registerTool(readFlight,{signal:lifetime.signal})).catch(()=>{});}catch{}
    addEventListener('pagehide',()=>lifetime.abort(),{once:true});
  }
  if(new URLSearchParams(location.search).has('qa')){
    window.Brasswing.qa={game,bullets,get mission(){return M;},get config(){return config;},settings,act,hurt,collect,pickup,spawn,hitEnemy,createBoss,updateFlight,drawFlight,
      launch(c={}){config={...config,...c};game.go('play',null,{fade:0});game._step(1/120);game.paused=false;game._fade=null;},
      step(seconds){for(let i=0;i<Math.ceil(seconds*120);i++)game._step(1/120);game._frame();},
      seek(t){if(!M)this.launch();M.clock=t;M.scroll=t*54;M.eventIndex=D.events.findIndex(e=>e.t>t);if(M.eventIndex<0)M.eventIndex=D.events.length;M.enemies=[];M.scheduled=[];M.pickups=[];bullets.clear();M.banner=null;M.radio=null;M.sector=t<53?0:t<115?1:2;M.player.invul=2;},
      snapshot(){return {scene:game.sceneName,clock:M?.clock,score:M?.score,hp:M?.player.hp,ammo:M?.player.ammo,pulses:M?.player.pulses,level:M?.player.level,entities:M?.enemies.length,bullets:bullets.list.length,boss:M?.boss?{phase:M.boss.phase,top:M.boss.top.hp,bottom:M.boss.bottom.hp,core:M.boss.core.hp,open:M.boss.coreOpen}:null,errors:game.errors};}
    };
  }
})();
