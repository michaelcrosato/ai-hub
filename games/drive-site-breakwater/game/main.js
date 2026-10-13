/* BREAKWATER — Browser input, presentation, and game integration. MIT. */
(function(root){
'use strict';
const E=root.My3D2dge,C=root.BWCore,V=root.BWVisual,$=id=>document.getElementById(id);
if(!E||!C||!V){$('load-error').hidden=false;return;}
const inputMap={up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],fire:['Mouse0','KeyJ','Pad7'],interact:['KeyE','Pad0'],flare:['Space','KeyF','Pad1'],boost:['ShiftLeft','ShiftRight','Pad10'],weapon0:['Digit1'],weapon1:['Digit2'],weapon2:['Digit3'],nextWeapon:['KeyQ','Pad5'],prevWeapon:['Pad4'],pause:['Escape','KeyP','Pad9'],map:['KeyM','Tab','Pad8'],start:['Enter'],manual:['KeyH']};
const game=new E.Game({canvas:$('screen'),view:new E.View('breakwater','Greywater',45,35,1.16,1),minW:600,minH:340,maxW:1200,maxH:720,portrait:{minW:330,minH:350,maxW:700,maxH:1200},bg:'#102e3b',input:inputMap});
game.pauseOverlay=false;game.cam.smooth=.2;game.particles.max=330;E.style.trans='alpha';
const world=new V.IslandWorld(game),sound=new root.BWSound(game);
let mission=new C.Mission(),assist=false,overlay=null,priorOverlay=null,lastFocus=null,uiClock=0,mapClock=0,radioEnd=0,noticeEnd=0,smokeClock=0,briefAngle=0,aimTarget=null,lastPadButtons=[];
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('breakwater:'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('breakwater:'+key,JSON.stringify(value));return true;}catch{return false;}}};
const prefs=storage.get('preferences',{});game.reduceMotion=prefs.reduceMotion??game.reduceMotion;sound.musicOn=prefs.music!==false;sound.audio.mute(prefs.muted===true);
$('motion-setting').checked=game.reduceMotion;$('music-setting').checked=sound.musicOn;document.body.classList.toggle('reduced-motion',game.reduceMotion);
const clock=t=>Math.floor(Math.max(0,t)/60).toString().padStart(2,'0')+':'+Math.floor(Math.max(0,t)%60).toString().padStart(2,'0');
function savePrefs(){storage.set('preferences',{reduceMotion:game.reduceMotion,music:sound.musicOn,muted:sound.audio.muted});}
function updateSoundButton(){$('sound-button').setAttribute('aria-label',sound.audio.muted?'Enable sound':'Mute sound');$('sound-button').style.opacity=sound.audio.muted?'.4':'1';}
updateSoundButton();
function notice(text,duration=3){$('notice').textContent=text;$('notice').hidden=false;noticeEnd=performance.now()+duration*1000;}
function setMode(on){assist=on;$('standard-mode').classList.toggle('active',!on);$('assist-mode').classList.toggle('active',on);$('standard-mode').setAttribute('aria-pressed',String(!on));$('assist-mode').setAttribute('aria-pressed',String(on));$('mode-copy').textContent=on?'More armor. Lower damage and fuel use. Faster winch. The same complete mission.':'Limited supplies. Full enemy damage. Checkpoints at mission milestones.';}
function closeOverlays(){for(const id of ['pause-menu','manual','map-overlay','result-overlay'])$(id).hidden=true;overlay=null;game.paused=false;game.input.clear();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
function menuControls(){const panel=overlay?$(overlay):mission.status==='ready'?$('briefing'):null;return panel?[...panel.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.offsetParent!==null):[];}
function showOverlay(name){if(mission.status==='success'||mission.status==='failed'){if(name!=='result-overlay'&&name!=='manual')return;}lastFocus=document.activeElement;for(const id of ['pause-menu','manual','map-overlay','result-overlay'])$(id).hidden=id!==name;overlay=name;game.paused=true;game.input.clear();if(name==='map-overlay')drawMap($('tactical-map'),true);menuControls()[0]?.focus({preventScroll:true});}
function openManual(){if(overlay==='manual')return;priorOverlay=overlay;showOverlay('manual');}
function closeManual(){const previous=priorOverlay;priorOverlay=null;if(mission.status==='success'||mission.status==='failed')showOverlay('result-overlay');else if(previous&&previous!=='manual')showOverlay(previous);else closeOverlays();}
function openMap(){if(mission.status!=='playing')return;showOverlay('map-overlay');}
function togglePause(){if(mission.status!=='playing')return;if(overlay==='manual'){closeManual();return;}if(overlay)closeOverlays();else showOverlay('pause-menu');}
function launch(saved){
 closeOverlays();if(saved)setMode(!!saved.assist);mission=new C.Mission({assist});if(saved){mission.restore(saved,{countLoss:false});}else{mission.start();storage.set('checkpoint',null);}
 $('briefing').hidden=true;$('hud').hidden=false;$('radio-panel').classList.remove('faded');$('pause-button').disabled=false;game.cam.snap=true;game.focus(mission.player.x,mission.player.y,18);game.particles.list.length=0;world.rig=new E.AircraftRig();sound.start();$('screen').focus?.({preventScroll:true});processEvents();updateHUD();
}
function restart(){launch();}
function refreshContinue(){const saved=storage.get('checkpoint',null);$('continue-button').hidden=!(saved&&saved.version===1);$('continue-button').onclick=()=>launch(storage.get('checkpoint',null));}
function showBriefing(){closeOverlays();priorOverlay=null;mission=new C.Mission({assist});$('briefing').hidden=false;$('hud').hidden=true;$('mission-clock').textContent='00:00';game.particles.list.length=0;game.cam.snap=true;game.focus(C.BASE.x,C.BASE.y,18);sound.audio.stopMusic();sound.mode='';refreshContinue();$('launch-button').focus({preventScroll:true});}
function retry(){if(mission.checkpoint){const snap=mission.checkpoint;closeOverlays();mission.restore(snap);game.particles.list.length=0;game.cam.snap=true;game.focus(mission.player.x,mission.player.y,18);sound.start();processEvents();updateHUD();}else restart();}
function result(){
 const success=mission.status==='success',r=mission.result();$('result-eyebrow').textContent='OPERATION LANTERN / '+(success?'DEBRIEF':'AIRCRAFT LOST');$('result-rank').textContent=success?r.rank:'×';$('result-rank').style.color=success?'#ecc276':'#ea9275';$('result-title').textContent=success?'HARBOR SECURED':'MISSION ABORTED';$('result-copy').textContent=success?'The flood barrier is online. Your crew is safe.':mission.reason;
 const stats=success?[['MISSION SCORE',r.score.toLocaleString()],['CREW SAFE',r.rescued+' / 7'],['FLIGHT TIME',clock(r.time)],['AIRCRAFT LOSSES',r.losses]]:[['OBJECTIVE',String(mission.stage+1).padStart(2,'0')+' / 05'],['FLIGHT TIME',clock(mission.time)],['CREW SAFE',mission.delivered+' / 7'],['CHECKPOINT',mission.checkpoint?'AVAILABLE':'AT START']];
 $('result-stats').replaceChildren(...stats.map(([label,value])=>{const d=document.createElement('div'),s=document.createElement('small'),b=document.createElement('strong');s.textContent=label;b.textContent=String(value);d.append(s,b);return d;}));
 if(success){const key=r.assist?'best-assist':'best-standard',best=storage.get(key,0);if(r.score>best)storage.set(key,r.score);$('best-score').textContent=(r.assist?'ASSIST':'STANDARD')+' · '+(r.score>best?'NEW PERSONAL BEST':'BEST '+best.toLocaleString());storage.set('checkpoint',null);}else $('best-score').textContent=mission.checkpoint?'Retry keeps completed mission work.':'Start a new flight. Your aircraft will have full supplies.';
 $('retry-button').hidden=success;$('retry-button').textContent=mission.checkpoint?'RETRY CHECKPOINT':'RETRY OPERATION';$('replay-button').className=success?'primary-button':'secondary-button';showOverlay('result-overlay');
}
function processEvents(){
 const events=mission.events.splice(0);for(const e of events){sound.event(e);const P=game.particles;
  if(e.type==='radio'){$('radio-who').textContent=e.who;$('radio-text').textContent=e.text;$('radio-panel').classList.remove('faded');radioEnd=performance.now()+9000;}
  if(e.type==='explosion'){P.explosion(e.x,e.y,e.z,e.size,{freeze:false,flash:false,shake:Math.min(4,e.size*2),debris:['#638076','#b6b294','#bf794a']});}
  if(e.type==='impact'){P.impact(e.x,e.y,e.z,e.large?6:3,'#ffc46e');P.sparks(e.x,e.y,e.z,e.large?7:2,null,{color:'#e0a36b'});}
  if(e.type==='shot'){P.sparks(e.x+Math.cos(e.a)*27,e.y+Math.sin(e.a)*27,e.z,2,e.a,{color:'#fbd082'});if(e.weapon>0)game.shake(.45);}
  if(e.type==='hit'){game.shake(2);game.flash('#ec8e5a',.08,.14);P.sparks(e.x,e.y,e.z,6,null,{color:'#ffa96f'});}
  if(e.type==='pickup'){P.ring(e.x,e.y,8,23,'#abdfb5',.5,0);if(e.kind==='crew')notice('CREW ABOARD · '+mission.player.passengers.length+' / 6',1.9);}
  if(e.type==='flare'){for(let k=0;k<22;k++){const a=k/22*Math.PI*2;P.add({kind:'ember',x:e.x,y:e.y,z:e.z,vx:Math.cos(a)*(25+k),vy:Math.sin(a)*(25+k),vz:-12,max:1.5,size:2,color:'#ffc375'});}notice('FLARES RELEASED',1.4);}
  if(e.type==='objective')notice('OBJECTIVE COMPLETE',3);
  if(e.type==='checkpoint'){storage.set('checkpoint',mission.checkpoint);notice('CHECKPOINT SAVED',3);}
  if(e.type==='restored')storage.set('checkpoint',mission.checkpoint);
  if(e.type==='supply')notice(e.kind.toUpperCase()+' SUPPLIES RECEIVED',2);
  if(e.type==='delivered')notice(e.count+' CREW SAFE · RESUPPLY IN PROGRESS',3);
  if(e.type==='shield')notice('CORE ARMORED · DESTROY THE WEAPON MOUNTS',1.8);
  if(e.type==='phase')notice('POWER UNIT EXPOSED',2.4);
  if(e.type==='empty')notice('EMPTY · CHANGE WEAPON OR RETURN TO BASE',2);
  if(e.type==='failure'){P.explosion(mission.player.x,mission.player.y,mission.player.z,2,{freeze:false,flash:false,shake:4});result();}
  if(e.type==='success')result();
 }
}
function aim(){
 const p=mission.player,i=game.input,mouse=i.mouseScreen();let target=null,aimX,aimY;
 const valid=mission.enemies.filter(e=>!e.dead&&e.active&&C.distance(e,p)<360&&!(e.kind==='bossCore'&&mission.bossPhase===1));
 const mouseMode=i.aimSource==='mouse'&&!i.held.has('KeyJ')&&i.lastDevice!=='touch';
 if(mouseMode&&mouse){const q=game.view.toGround(mouse[0],mouse[1]-game.view.bz*7);aimX=q[0];aimY=q[1];let best=34;for(const e of valid){const ep=game.view.p(e.x,e.y,e.z),d=Math.hypot(mouse[0]-ep[0],mouse[1]-ep[1]);if(d<best){target=e;best=d;}}}
 else if(i.padAim){const d=game.view.screenDirToGround(...i.padAim);aimX=p.x+d[0]*300;aimY=p.y+d[1]*300;const angle=Math.atan2(d[1],d[0]);target=valid.filter(e=>Math.abs(Math.atan2(Math.sin(Math.atan2(e.y-p.y,e.x-p.x)-angle),Math.cos(Math.atan2(e.y-p.y,e.x-p.x)-angle)))<.22).sort((a,b)=>C.distance(a,p)-C.distance(b,p))[0];}
 else if(i.down('fire'))target=valid.filter(e=>game.r.visible(e.x,e.y,e.z,0,0,0)).sort((a,b)=>C.distance(a,p)-C.distance(b,p))[0];
 if(target){aimX=target.x;aimY=target.y;}aimTarget=target?.id||null;return {aimX,aimY,targetId:aimTarget};
}
function update(dt){
 if(mission.status==='ready'){briefAngle+=dt*.17;game.focus(248+Math.sin(briefAngle)*35,925+Math.cos(briefAngle)*24,14);return;}
 if(mission.status!=='playing')return;
 const i=game.input,[mx,my]=i.move(),[moveX,moveY]=game.view.screenDirToGround(mx,my),a=aim();let weapon;
 for(let k=0;k<3;k++)if(i.pressed('weapon'+k))weapon=k;
 if(i.pressed('nextWeapon'))weapon=(mission.player.weapon+1)%3;if(i.pressed('prevWeapon'))weapon=(mission.player.weapon+2)%3;
 mission.update(dt,{moveX,moveY,...a,weapon,fire:i.down('fire'),interact:i.down('interact'),flare:i.pressed('flare'),boost:i.down('boost')});
 const p=mission.player;game.focus(p.x+p.vx*.13,p.y+p.vy*.13,18);sound.update(dt,mission);processEvents();
 smokeClock-=dt;if(smokeClock<=0){smokeClock=.2;for(const e of mission.enemies)if(e.dead&&game.r.visible(e.x,e.y,0,45,90,30)&&E.hash2(Math.floor(mission.time*5),e.x)>.4)game.particles.add({kind:'smoke',x:e.x,y:e.y,z:7,vx:5,vy:-3,vz:16,max:1.7,size:3,color:'#76807b'});if(p.hp/p.maxHp<.45)game.particles.add({kind:'smoke',x:p.x-10,y:p.y,z:p.z,vx:-4,vy:-2,vz:5,max:1.2,size:2.5,color:'#73817c'});}
}
function drawNavigation(r){
 if(mission.status!=='playing')return;const target=mission.waypoint?{...mission.waypoint,short:'WAYPOINT'}:mission.target(),p=r.w(target.x,target.y,10),cx=r.W/2,cy=r.H/2;
 const left=30,right=r.W-30,top=75,bottom=r.H-82;
 if(p[0]<left||p[0]>right||p[1]<top||p[1]>bottom){const dx=p[0]-cx,dy=p[1]-cy,k=Math.min(dx>0?(right-cx)/dx:(left-cx)/dx,dy>0?(bottom-cy)/dy:(top-cy)/dy),x=cx+dx*k,y=cy+dy*k,a=Math.atan2(dy,dx);r.overlay(g=>{const pts=[[x+Math.cos(a)*7,y+Math.sin(a)*7],[x+Math.cos(a+2.45)*6,y+Math.sin(a+2.45)*6],[x+Math.cos(a-2.45)*6,y+Math.sin(a-2.45)*6]];E.px.poly(g,pts,'#f0c071');E.font.text(g,Math.round(C.distance(mission.player,target))+' M',x,y+11,'#e5d6ac',{align:'center',outline:'#0b2a34',font:'tiny'});});}
 else if(C.distance(mission.player,target)>60)r.textAt(target.x,target.y,45,target.short,'#ecd499',{font:'tiny',outline:'#112d36'});
 const e=aimTarget&&mission.enemies.find(e=>e.id===aimTarget);if(e){const q=r.w(e.x,e.y,e.z);r.overlay(g=>{const n=e.r*r.view.scale+7,col='#f3c075';for(const [a,b]of[[-1,-1],[-1,1],[1,-1],[1,1]]){E.px.line(g,q[0]+a*n,q[1]+b*n*.65,q[0]+a*(n-6),q[1]+b*n*.65,col);E.px.line(g,q[0]+a*n,q[1]+b*n*.65,q[0]+a*n,q[1]+b*(n*.65-5),col);}if(mission.player.weapon===2)E.font.text(g,'LOCK',q[0],q[1]+n*.65+6,col,{align:'center',font:'tiny',outline:'#172f38'});});}
 const item=mission.interaction();if(item&&mission.player.winch>0){const q=r.w(mission.player.x,mission.player.y,mission.player.z+20);r.overlay(g=>{E.px.rect(g,q[0]-22,q[1]-9,44,4,'#1f3f47');E.px.rect(g,q[0]-22,q[1]-9,Math.ceil(mission.player.winch*44),4,'#d9d29a');});}
}
function draw(r){
 world.draw(r,mission);drawNavigation(r);
 const now=performance.now();if(noticeEnd&&now>noticeEnd){$('notice').hidden=true;noticeEnd=0;}if(radioEnd&&now>radioEnd)$('radio-panel').classList.add('faded');
 const padButtons=Array.from({length:16},(_,k)=>game.input.held.has('Pad'+k)),edge=k=>padButtons[k]&&!lastPadButtons[k];
 if(overlay||mission.status==='ready'){
  const nodes=menuControls();if((edge(12)||edge(13))&&nodes.length){const index=nodes.indexOf(document.activeElement),step=edge(12)?-1:1;nodes[(index+step+nodes.length)%nodes.length].focus({preventScroll:true});}
  if(edge(0)){const active=nodes.includes(document.activeElement)?document.activeElement:mission.status==='ready'?$('launch-button'):nodes[0];active?.click();game.input.clear();}
  else if(edge(1)&&overlay&&overlay!=='result-overlay'){overlay==='manual'?closeManual():closeOverlays();}
  else if(edge(9)){mission.status==='ready'&&!overlay?launch():togglePause();}
 }else if(edge(9))togglePause();
 if(edge(8))overlay==='map-overlay'?closeOverlays():openMap();lastPadButtons=padButtons;
 uiClock+=game.stats.frameMs;if(uiClock>90){uiClock=0;updateHUD();}mapClock+=game.stats.frameMs;if(mapClock>140){mapClock=0;drawMap($('minimap'),false);if(overlay==='map-overlay')drawMap($('tactical-map'),true);}
}
function updateHUD(){
 $('game-shell').dataset.diagnostics=JSON.stringify({status:mission.status,stage:mission.stage,paused:game.paused,position:[mission.player.x,mission.player.y],fps:game.fps,renderMs:game.stats.renderMs,updateMs:game.stats.updateMs,items:game.stats.items,particles:game.particles.list.length,buffer:[game.W,game.H],errors:game.errors});
 if(mission.status==='ready')return;const p=mission.player,stage=C.STAGES[mission.stage],tar=mission.target(),hp=Math.max(0,p.hp/p.maxHp*100);
 $('mission-clock').textContent=clock(mission.time);$('stage-number').textContent=String(Math.min(5,mission.stage+1)).padStart(2,'0')+' / 05';$('objective-title').textContent=stage.title;$('objective-detail').textContent=stage.detail;$('objective-range').textContent=tar.short+' · '+Math.round(C.distance(p,tar))+' M';
 $('hp-value').textContent=Math.ceil(hp)+'%';$('hp-bar').style.width=hp+'%';$('hp-bar').style.background=hp<30?'#ec8d69':'#8bceb0';$('fuel-value').textContent=Math.ceil(p.fuel)+'%';$('fuel-bar').style.width=p.fuel+'%';$('cargo-label').textContent=p.module?'SLING: CONTROL MODULE':'CABIN '+p.passengers.length+' / 6';$('flight-state').textContent=p.landed?mission.serviceTime>0?'RESUPPLY IN PROGRESS':'READY FOR TAKEOFF':p.module?'CARGO SECURE':'IN FLIGHT';
 for(let k=0;k<3;k++){$('ammo-'+k).textContent=Math.floor(p.ammo[k]);const b=document.querySelector('[data-weapon="'+k+'"]');b.classList.toggle('selected',p.weapon===k);b.setAttribute('aria-pressed',String(p.weapon===k));}
 $('flare-value').textContent=p.flare>0?'RELOAD '+p.flare.toFixed(1)+' S':'READY';$('flare-bar').style.width=(1-p.flare/7)*100+'%';$('radar-status').textContent=mission.radar?'RADAR ACTIVE':'RADAR OFFLINE';$('radar-status').style.color=mission.radar?'#e8b275':'#9bcca9';
 const item=mission.interaction();$('interaction').hidden=!item||p.landed||!!overlay;if(item){$('interaction-label').textContent=item.label;$('winch-bar').style.width=Math.min(100,p.winch*100)+'%';}
 $('boss-hud').hidden=mission.stage!==3;if(mission.stage===3){const parts=mission.enemies.filter(e=>e.id.startsWith('boss')),$bar=$('boss-bar');$bar.style.width=parts.reduce((s,e)=>s+e.hp,0)/parts.reduce((s,e)=>s+e.maxHp,0)*100+'%';$('boss-phase').textContent='COMMAND CRAWLER · '+(mission.bossPhase===1?'WEAPON MOUNTS':'EXPOSED CORE');$('boss-timer').textContent=clock(mission.bossTime);}
}
function drawMap(canvas,large){
 const g=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pad=large?35:10,s=Math.min((W-pad*2)/C.LIMITS.width,(H-pad*2)/C.LIMITS.height),ox=(W-C.LIMITS.width*s)/2,oy=(H-C.LIMITS.height*s)/2,P=(x,y)=>[ox+x*s,oy+y*s];
 g.clearRect(0,0,W,H);g.fillStyle='#0a2632';g.fillRect(0,0,W,H);g.strokeStyle='#608c8416';g.lineWidth=1;for(let i=0;i<W;i+=large?50:24){g.beginPath();g.moveTo(i,0);g.lineTo(i,H);g.stroke();}for(let i=0;i<H;i+=large?50:24){g.beginPath();g.moveTo(0,i);g.lineTo(W,i);g.stroke();}
 for(const island of C.ISLANDS){g.beginPath();island.forEach((p,i)=>{const q=P(...p);i?g.lineTo(...q):g.moveTo(...q);});g.closePath();g.fillStyle='#35554f';g.fill();g.strokeStyle='#678477';g.lineWidth=1;g.stroke();}
 for(const path of C.ROADS){g.beginPath();path.forEach((p,i)=>{i?g.lineTo(...P(...p)):g.moveTo(...P(...p));});g.strokeStyle='#8e9e7755';g.lineWidth=large?3:1;g.stroke();}
 const mark=(x,y,c,r,shape='circle')=>{const p=P(x,y);g.fillStyle=c;g.strokeStyle=c;if(shape==='square')g.strokeRect(p[0]-r,p[1]-r,r*2,r*2);else{g.beginPath();g.arc(...p,r,0,Math.PI*2);g.fill();}};
 if(mission.radar){const q=P(460,490);g.beginPath();g.arc(...q,260*s,0,Math.PI*2);g.strokeStyle='#d8975540';g.setLineDash([4,5]);g.stroke();g.setLineDash([]);}
 for(const e of mission.enemies)if(!e.dead&&e.active)mark(e.x,e.y,'#e78164',large?3.5:1.8);
 for(const c of mission.crew)if(c.state==='waiting'&&(c.role==='optional'||c.role==='engineer'&&mission.stage>=1||c.role==='final'&&mission.stage>=4))mark(c.x,c.y,'#9fdfb8',large?3.5:1.8);
 for(const q of mission.supplies)if(!q.used)mark(q.x,q.y,'#aad4b5',large?4:2,'square');mark(C.BASE.x,C.BASE.y,'#b4e0c6',large?7:3,'square');
 const target=mission.target(),t=P(target.x,target.y);g.strokeStyle='#e5ba68';g.lineWidth=large?2:1;g.beginPath();g.arc(...t,large?12:5,0,Math.PI*2);g.stroke();mark(target.x,target.y,'#f4cc7b',large?3:2);
 if(mission.waypoint){const q=P(mission.waypoint.x,mission.waypoint.y);g.strokeStyle='#a5d9e2';g.lineWidth=1;g.beginPath();g.moveTo(q[0]-7,q[1]);g.lineTo(q[0]+7,q[1]);g.moveTo(q[0],q[1]-7);g.lineTo(q[0],q[1]+7);g.stroke();}
 const p=mission.player,q=P(p.x,p.y),a=p.face;g.beginPath();g.moveTo(q[0]+Math.cos(a)*(large?10:5),q[1]+Math.sin(a)*(large?10:5));g.lineTo(q[0]+Math.cos(a+2.5)*(large?7:4),q[1]+Math.sin(a+2.5)*(large?7:4));g.lineTo(q[0]+Math.cos(a-2.5)*(large?7:4),q[1]+Math.sin(a-2.5)*(large?7:4));g.closePath();g.fillStyle='#fff1c3';g.fill();
 if(large){g.font='10px monospace';g.textAlign='center';g.fillStyle='#b4cab5';for(const [x,y,label]of[[240,1060,'RESCUE PAD'],[460,405,'RADAR RELAY'],[752,925,'ENGINEER DOCK'],[786,217,'CONTROL STATION'],[1080,135,'COMMAND CRAWLER'],[138,340,'OPTIONAL RESCUE']]){const p=P(x,y);g.fillText(label,...p);}const list=$('map-objectives');if(list.dataset.stage!==String(mission.stage)){list.dataset.stage=String(mission.stage);list.replaceChildren(...C.STAGES.slice(0,5).map((s,k)=>{const li=document.createElement('li');li.textContent=s.title;li.className=k<mission.stage?'done':k===mission.stage?'current':'';return li;}));}}
 canvas._mapTransform={s,ox,oy};
}
game.input.bindButtons($('touch-controls'));
$('launch-button').onclick=()=>launch();$('standard-mode').onclick=()=>setMode(false);$('assist-mode').onclick=()=>setMode(true);
$('pause-button').onclick=togglePause;$('resume-button').onclick=closeOverlays;$('restart-button').onclick=restart;$('map-button').onclick=openMap;$('minimap-button').onclick=openMap;$('pause-map').onclick=openMap;$('close-map').onclick=closeOverlays;$('map-resume').onclick=closeOverlays;
for(const id of ['manual-button','brief-manual','pause-manual'])$(id).onclick=openManual;$('close-manual').onclick=closeManual;$('manual-done').onclick=closeManual;
$('retry-button').onclick=retry;$('replay-button').onclick=showBriefing;$('briefing-button').onclick=showBriefing;
document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{mission.player.weapon=+b.dataset.weapon;game.input.clear();updateHUD();});
$('flare-button').onclick=()=>{if(mission.status==='playing'&&!game.paused){game.input.press('Act:flare');setTimeout(()=>game.input.release('Act:flare'),100);}};
$('sound-button').onclick=()=>{sound.audio.mute();updateSoundButton();savePrefs();};$('music-setting').onchange=e=>{sound.setMusicEnabled(e.target.checked);savePrefs();};$('motion-setting').onchange=e=>{game.reduceMotion=e.target.checked;document.body.classList.toggle('reduced-motion',game.reduceMotion);savePrefs();};
$('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-shell').requestFullscreen();}catch{notice('FULL SCREEN IS NOT AVAILABLE IN THIS VIEW');}};
$('tactical-map').onclick=e=>{const el=e.currentTarget,rc=el.getBoundingClientRect(),tx=(e.clientX-rc.left)*el.width/rc.width,ty=(e.clientY-rc.top)*el.height/rc.height,{s,ox,oy}=el._mapTransform;mission.waypoint={x:C.clamp((tx-ox)/s,0,C.LIMITS.width),y:C.clamp((ty-oy)/s,0,C.LIMITS.height)};drawMap(el,true);};$('clear-waypoint').onclick=()=>{mission.waypoint=null;drawMap($('tactical-map'),true);};
refreshContinue();
// Menus own their navigation keys before the engine's global input listener.
document.addEventListener('keydown',e=>{
 if(!(overlay||mission.status==='ready')||!['Tab','Enter','Space'].includes(e.code))return;
 e.stopPropagation();
 if(e.code==='Tab'){e.preventDefault();const nodes=menuControls();if(nodes.length){const index=nodes.indexOf(document.activeElement),step=e.shiftKey?-1:1;nodes[(index+step+nodes.length)%nodes.length].focus({preventScroll:true});}}
 else if(e.code==='Enter'&&mission.status==='ready'&&!overlay&&!['BUTTON','INPUT'].includes(e.target.tagName)){e.preventDefault();launch();}
},true);
document.addEventListener('keydown',e=>{
 if(e.repeat)return;
 if(e.code==='Enter'&&mission.status==='ready'&&!overlay){e.preventDefault();launch();}
 else if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(overlay==='manual')closeManual();else togglePause();}
 else if(e.code==='KeyM'||e.code==='Tab'&&!overlay&&mission.status==='playing'){e.preventDefault();if(overlay==='map-overlay')closeOverlays();else openMap();}
 else if(e.code==='KeyH'){e.preventDefault();overlay==='manual'?closeManual():openManual();}
});
function focusPause(){if(mission.status==='playing'&&!overlay)showOverlay('pause-menu');}
window.addEventListener('blur',focusPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)focusPause();});
game.onError=()=>{$('load-error').hidden=false;};game.start({update,draw});game.focus(C.BASE.x,C.BASE.y,18);drawMap($('minimap'),false);
// Read-only game state for integration tools and acceptance checks. No hidden win action.
root.BWGame={get game(){return game;},get mission(){return mission;},get aimTarget(){return aimTarget;},get overlay(){return overlay;},getState(){return {status:mission.status,stage:mission.stage,objective:C.STAGES[mission.stage].title,aircraft:{x:mission.player.x,y:mission.player.y,armor:mission.player.hp,fuel:mission.player.fuel,ammunition:mission.player.ammo.map(Math.floor),passengers:mission.player.passengers.length},crewSafe:mission.delivered,paused:game.paused,checkpoint:!!mission.checkpoint,time:mission.time,errors:game.errors};}};
// These tools mirror visible controls. Unsupported browsers retain the full game.
const modelContext=document.modelContext;
if(modelContext?.registerTool){const lifetime=new AbortController();const empty={type:'object',properties:{},additionalProperties:false};const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}};
 register({name:'read_flight_status',title:'Read flight status',description:'Read the current objective, aircraft resources, pause state, and crew count.',inputSchema:empty,annotations:{readOnlyHint:true},execute:()=>root.BWGame.getState()});
 register({name:'set_flight_pause',title:'Pause or resume flight',description:'Pause or resume the current operation. Uses the visible pause menu.',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input.paused!=='boolean'||Object.keys(input).length!==1)throw new Error('paused must be a boolean.');if(mission.status!=='playing')throw new Error('Start an operation first.');input.paused?showOverlay('pause-menu'):closeOverlays();return root.BWGame.getState();}});
 window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});}
})(globalThis);
