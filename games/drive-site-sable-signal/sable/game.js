/* SABLE SIGNAL — The Relay. Original game built on my-3D2dge.
 * Simulation, presentation, and menus share one E.Game instance.
 */
(function () {
  'use strict';
  const E = My3D2dge;
  const $ = id => document.getElementById(id), TAU = Math.PI * 2;
  const defaults = {filter:'off',bands:8,pixel:2,edge:45,glow:20,exposure:100,scanline:8,music:45,sfx:75,shake:45,flashes:false,aim:true,contrast:false};
  const limits = {bands:[3,16],pixel:[1,6],edge:[0,100],glow:[0,50],exposure:[75,150],scanline:[0,35],music:[0,100],sfx:[0,100],shake:[0,100]};
  function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem('sable-signal:'+key))??fallback;}catch{return fallback;}}
  function writeLocal(key,value){try{localStorage.setItem('sable-signal:'+key,JSON.stringify(value));}catch{/* The game remains playable when storage is blocked. */}}
  function validSettings(value){const s={...defaults};if(value&&typeof value==='object'){for(const k of Object.keys(limits))if(Number.isFinite(value[k]))s[k]=E.clamp(value[k],...limits[k]);for(const k of ['flashes','aim','contrast'])if(typeof value[k]==='boolean')s[k]=value[k];if(['off','cel','pixel'].includes(value.filter))s.filter=value.filter;}return s;}
  let settings=validSettings(readLocal('settings',{}));
  if(!localStorageAvailable())settings={...settings};
  function localStorageAvailable(){try{return !!window.localStorage;}catch{return false;}}
  E.style.charPitch=false;
  const game=new E.Game({canvas:$('screen'),view:new E.View('sable-overhead','Station view',0,80,1.6,.8),minW:520,minH:310,maxW:1000,maxH:640,fixedStep:true,bg:'#09141f',input:{
    ...E.Input.DEFAULT,up:['KeyW','ArrowUp','Pad12','PadAxisUp'],down:['KeyS','ArrowDown','Pad13','PadAxisDown'],left:['KeyA','ArrowLeft','Pad14','PadAxisLeft'],right:['KeyD','ArrowRight','Pad15','PadAxisRight'],
    attack:['Mouse0','KeyJ','Pad7'],interact:['KeyE','Pad2'],throw:['Mouse2','KeyQ','Pad4'],execute:['Space','Pad0'],focus:['ShiftLeft','ShiftRight','Pad6'],
    restart:['KeyR','Pad3'],pause:['Escape','Pad9'],map:['Tab','Pad8'],confirm:['Enter','Pad0'],cancel:['Escape','Pad1']
  }});
  game.pauseOverlay=false;game.cam.smooth=.11;game.r.outline='#07131c';game.r.rim='#bee3df';
  game.lights.enabled=true;game.lights.ambient=.67;game.lights.dark=[5,15,25];game.lights._build();
  SableAudio.setup(game.audio);
  const input=game.input;
  const touch={id:null,x:0,y:0,dx:0,dy:0,fire:false};
  let level=SableLevel.build(),mode='title',stack=[],state=null,attempts=0,sessionDifficulty='standard',hudClock=0,uiLast={},muted=false;
  const random=E.rng(7216);
  const specs={baton:{name:'FOLDING BATON',cap:0,range:27,cooldown:.23,type:'QUIET / MELEE'},pistol:{name:'SERVICE PISTOL',cap:8,speed:760,cooldown:.18,type:'LOUD / SEMI-AUTO'},shotgun:{name:'SCATTERGUN',cap:4,speed:660,cooldown:.64,type:'LOUD / WIDE SPREAD'}};
  const weapon=(kind,ammo)=>({kind,ammo:ammo===undefined?specs[kind].cap:ammo});
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function visible(a,pad=22){const p=game.view.p(a.x,a.y,0);return p[0]-game.cam.x>pad&&p[0]-game.cam.x<game.W-pad&&p[1]-game.cam.y>60&&p[1]-game.cam.y<game.H-48;}
  function clearLine(a,b,rad=0){return E.Sweep.rayMap(level.map,a.x,a.y,b.x,b.y,rad)>1;}
  function setText(id,text){if(uiLast[id]!==text){$(id).textContent=text;uiLast[id]=text;}}
  function setHTML(id,html){if(uiLast[id]!==html){$(id).innerHTML=html;uiLast[id]=html;}}
  function fmtTime(t,decimal=true){const m=Math.floor(t/60),s=Math.floor(t%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(decimal?'.'+Math.floor(t*10)%10:'');}
  function scoreText(n){return String(Math.round(n)).padStart(6,'0');}
  function show(name){
    mode=name;for(const el of document.querySelectorAll('.screen'))el.classList.toggle('hidden',el.id!==name);
    const inMission=!!state&&!['title','briefing'].includes(name);
    $('hud').classList.toggle('hidden',!inMission||name==='results');
    game.paused=!['play','death'].includes(name);input.clear();touch.fire=false;touch.id=null;
    $('screen').style.cursor=name==='play'?'none':'default';
    if(name==='play')$('screen').focus({preventScroll:true});else{const el=$(name);const first=el?.querySelector('.primary')||el?.querySelector('button,input,select');if(first)first.focus({preventScroll:true});}
  }
  function openModal(name){stack.push(mode);show(name);if(name==='tactical')SableLevel.drawMap($('tactical-map'),level,state);if(name==='settings')syncSettings();}
  function closeModal(){show(stack.pop()||'title');}
  function beginBrief(){attempts=0;stack=[];show('briefing');SableLevel.drawMap($('brief-map'),level,null,true);game.audio.music(SableAudio.quiet);}
  function toTitle(){stack=[];show('title');game.audio.music(SableAudio.quiet);refreshRecord();}
  function refreshRecord(){const records=readLocal('records',{}),s=records?.standard;setText('title-best',s&&Number.isFinite(s.score)?'BEST STANDARD / '+s.rank+'  ·  '+s.score.toLocaleString()+'  ·  '+fmtTime(s.time,false):'ONE LEVEL. EVERY SECOND COUNTS.');}
  function makeActor(spawn,player=false){
    const a=new E.Body({x:spawn.x,y:spawn.y,z:0,r:player?5.8:6,gravity:0,friction:0});
    a.team=player?'player':'enemy';a.alive=true;a.facing=spawn.angle??-Math.PI/2;a.weapon=weapon(player?'baton':spawn.weapon,player?0:spawn.weapon==='shotgun'?3:spawn.weapon==='pistol'?6:0);
    a.label=spawn.label||'Courier';a.cool=0;a.stun=0;a.hitFlash=0;a.recoil=0;a.deadT=0;a.knockX=0;a.knockY=0;a.elite=!!spawn.elite;a.runner=!!spawn.runner;
    a.attack=new E.Attack(player?'bash':'hook',{wind:player?.045:.32,active:player?.11:.08,recover:player?.15:.45,reach:player?11:9,blade:player?11:0});
    const cloth=player?'#d7d8c8':a.elite?'#b89668':a.runner?'#8297a2':spawn.weapon==='shotgun'?'#87677b':'#65868d';
    a.rig=new E.Humanoid({build:'heroic',size:player?1.12:a.elite?1.14:1.08,charView:false,headR:3.35,weapon:a.weapon.kind==='baton'?'sword':'gun',bladeLen:10,hair:player?'short':'bald',hood:player,outfit:player?'coat':'jacket',sleeves:'long',armor:a.elite,colors:{skin:player?'#363e47':'#cbb29b',hair:player?'#c4c9ba':'#333c47',cloth,pants:player?'#354651':'#35404c',boot:'#192a37',belt:'#3b4e56',metal:'#9baeb0',metalDk:'#455d68',hilt:player?'#efbc6c':'#7e939a',eye:player?'#ffc774':'#172838'}});
    if(!player){a.home={x:spawn.x,y:spawn.y};a.patrol=spawn.path||[];a.pathIndex=0;a.state='patrol';a.target={x:spawn.x,y:spawn.y};a.flow=new E.FlowField(level.navigation);a.memory=0;a.aim=0;a.lock=null;a.alert=0;}
    return a;
  }
  function startMission(retry=false){
    if(!retry){sessionDifficulty=document.querySelector('input[name=difficulty]:checked')?.value||'standard';if(attempts===0)attempts=1;else attempts++;}else attempts++;
    level=SableLevel.build();const player=makeActor(level.spawn,true);
    player.hp=sessionDifficulty==='assist'?2:1;player.invuln=0;player.finishTarget=null;player.finishT=0;
    state={t:0,elapsed:0,clearTime:null,player,enemies:level.enemySpawns.map(s=>makeActor(s)),pickups:[],shots:new E.SweptBullets(game,{plane:'ground',sparks:false}),decals:[],ripples:[],pops:[],kills:0,score:0,combo:0,maxCombo:0,comboTime:0,styles:new Set(),tape:false,broadcast:false,cleared:false,charges:2,chargeKills:0,focus:0,focusUsed:0,shotsFired:0,shotsHit:0,damageTaken:0,radioT:0,footT:0,tutorial:new Set(),difficulty:sessionDifficulty,deathT:0,finishCount:0};
    drop(weapon('pistol',7),320,611);drop(weapon('shotgun',4),276,245);drop(weapon('baton'),540,586);
    game.hitstop=0;game.shakeAmt=0;game._flash=null;game.particles.list.length=0;game.timers.length=0;
    game.cam.bounds=v=>{const b=level.map.bounds(v);return{x0:b.x0-80,y0:b.y0-100,x1:b.x1+80,y1:b.y1+140};};game.focus(player.x,player.y-28,0);game.cam.snap=true;game._camStep(0);
    if(game.gpu)game.gpu.map=level.map;
    stack=[];show('play');hudClock=1;uiLast={};
    game.audio.music(SableAudio.combat);say('Dock entry ahead. Take the tape. Cut their signal.',5);
    updateRig(player,1/60);for(const e of state.enemies)updateRig(e,1/60);updateHUD();
  }
  function say(message,seconds=4){if(!state)return;state.radioT=seconds;setText('radio-message',message);$('radio').classList.remove('hidden');}
  function pop(x,y,text,color='#f9d18a'){state.pops.push({x,y,text,color,t:0});}
  function impulse(x,y,angle,power=1){game.freeze(.022*power);game.shake(2.6*power*settings.shake/100);game.particles.sparks(x,y,8,Math.round(6*power),angle,{color:'#ecc690'});}
  function drop(item,x,y,vx=0,vy=0){if(!item)return;const p=new E.Body({x,y,z:0,r:3,vx,vy,friction:8,gravity:0});level.map.collide(p);state.pickups.push(Object.assign(p,{item:{...item},angle:random()*TAU,t:0}));}
  function blood(x,y,angle,amount=1){for(let i=0;i<5*amount;i++){const f=random()*12;state.decals.push({x:x+Math.cos(angle)*f+(random()-.5)*12,y:y+Math.sin(angle)*f+(random()-.5)*12,r:2+random()*4,c:i%3===0?'#974954':'#633446'});}if(state.decals.length>150)state.decals.splice(0,state.decals.length-150);}
  function kill(enemy,method,angle=0){
    if(!enemy.alive)return;enemy.alive=false;enemy.dead=true;enemy.deadT=0;enemy.state='dead';enemy.stun=0;enemy.attack.cancel();enemy.knockX=Math.cos(angle)*44;enemy.knockY=Math.sin(angle)*44;enemy.hitFlash=.1;
    drop(enemy.weapon,enemy.x,enemy.y,Math.cos(angle)*28,Math.sin(angle)*28);enemy.weapon=null;
    state.kills++;state.combo=state.comboTime>0?state.combo+1:1;state.comboTime=4;state.maxCombo=Math.max(state.maxCombo,state.combo);state.styles.add(method);
    const base=method==='finish'?650:method==='melee'?550:450,points=Math.round(base*(1+Math.min(state.combo-1,9)*.25));state.score+=points;
    if(method==='finish')state.finishCount++;if(++state.chargeKills>=3){state.chargeKills=0;if(state.charges<2){state.charges++;pop(state.player.x,state.player.y-8,'CHARGE +1','#7ae0db');}}
    blood(enemy.x,enemy.y,angle);impulse(enemy.x,enemy.y,angle,method==='finish'?1.6:1);pop(enemy.x,enemy.y,'+'+points);game.audio.sfx(method==='finish'?'finish':'baton',{vol:method==='gun'?.45:.8});
    if(state.kills===state.enemies.length){state.cleared=true;state.clearTime=state.elapsed;state.focus=0;state.shots.clear('enemy');game.audio.music(SableAudio.quiet);say(state.tape?'Station clear. Stop the broadcast in the control room.':'Station clear. Find the tape in the archive.',6);}
  }
  function stun(enemy,method,angle){
    if(!enemy.alive)return;enemy.stun=4.2;enemy.state='stunned';enemy.attack.cancel();enemy.aim=0;enemy.lock=null;enemy.knockX=Math.cos(angle)*62;enemy.knockY=Math.sin(angle)*62;
    if(enemy.weapon){drop(enemy.weapon,enemy.x,enemy.y,Math.cos(angle)*45,Math.sin(angle)*45);enemy.weapon=null;}
    state.styles.add(method);impulse(enemy.x,enemy.y,angle,.65);game.audio.sfx('baton',{vol:.5});pop(enemy.x,enemy.y,'DOWN','#7ee1dc');
    if(!state.tutorial.has('finish')){state.tutorial.add('finish');say('Downed enemies recover. Get close and press SPACE to finish.',5);}
  }
  function hurt(source,method){
    const p=state.player;if(!p.alive||p.invuln>0)return;
    p.hp--;state.damageTaken++;p.hitFlash=.3;p.invuln=.9;blood(p.x,p.y,source?Math.atan2(p.y-source.y,p.x-source.x):0,.5);
    if(p.hp>0){game.audio.sfx('hurt');game.shake(4*settings.shake/100);say('Armour spent. The next hit is lethal.',3);return;}
    p.alive=false;p.dead=true;p.finishTarget=null;p.attack.cancel();state.focus=0;state.deathT=0;
    game.freeze(.055);game.shake(5*settings.shake/100);game.audio.sfx('failure');
    if(!settings.flashes)game.flash('#da6b64',.1,.22);
    setText('death-cause',(source?.label||'A guard')+(method==='gun'?' hit you with gunfire.':' caught you at close range.'));
    const tips=['A door strike or a thrown weapon can stop an attack.','Guns draw nearby guards. Plan your next move before you fire.','Use Signal Brake before you enter a crowded room.','Watch the red aim line. Move across it before the shot.'];
    setText('death-tip',tips[(attempts-1)%tips.length]);setText('death-attempt','ATTEMPT '+String(attempts).padStart(2,'0')+' / '+state.kills+' OF '+state.enemies.length+' CLEARED');
    stack=[];show('death');
  }
  function noise(x,y,radius){
    for(const e of state.enemies){if(!e.alive||e.stun>0)continue;const d=Math.hypot(e.x-x,e.y-y);if(d>radius)continue;const open=clearLine(e,{x,y});if(!open&&d>radius*.6)continue;if(e.state!=='aim'&&e.state!=='chase'){e.state='investigate';e.target={x,y};e.memory=4.5;e.alert=1;}}
    state.ripples.push({x,y,r:radius,t:0,color:'#e2b473'});
  }
  function openDoor(d,actor){
    if(d.open)return;d.open=true;d.swing=d.vertical?(actor.x<d.x?-1:1):(actor.y<d.y?1:-1);
    for(const [cx,cy]of d.points)level.map.block(cx,cy,false);
    game.audio.sfx('slam',{vol:actor.team==='player'?.8:.4});
    if(actor.team==='player'){
      noise(d.x,d.y,80);const nx=d.vertical?Math.sign(d.x-actor.x):0,ny=d.vertical?0:Math.sign(d.y-actor.y);
      for(const e of state.enemies)if(e.alive&&dist(e,d)<34&&(e.x-d.x)*nx+(e.y-d.y)*ny>-5)stun(e,'door',Math.atan2(ny,nx));
    }
  }
  function closeDoor(d){
    if([state.player,...state.enemies.filter(e=>e.alive)].some(a=>Math.abs(a.x-d.x)<(d.vertical?16:26)&&Math.abs(a.y-d.y)<(d.vertical?26:16))){say('The doorway is blocked.',1.5);return;}
    d.open=false;for(const [cx,cy]of d.points)level.map.block(cx,cy,true);game.audio.sfx('door',{vol:.4});
  }
  function pushDoors(actor,dx,dy){if(Math.hypot(dx,dy)<.1)return;for(const d of level.doors){if(d.open)continue;const tangent=d.vertical?Math.abs(actor.y-d.y):Math.abs(actor.x-d.x),normal=d.vertical?Math.abs(actor.x-d.x):Math.abs(actor.y-d.y);if(tangent<18&&normal<25&&(d.x-actor.x)*dx+(d.y-actor.y)*dy>0)openDoor(d,actor);}}
  function shoot(actor){
    const w=actor.weapon;if(!w||w.kind==='baton'||actor.cool>0)return;
    if(w.ammo<=0){if(actor.team==='player'){game.audio.sfx('empty');actor.cool=.22;say('Empty. Throw it with Q, or pick up another weapon.',2);}return;}
    w.ammo--;const shotgun=w.kind==='shotgun',player=actor.team==='player',count=shotgun?6:1;
    actor.cool=player?specs[w.kind].cooldown:shotgun?1.1:.83;actor.recoil=.12;
    game.audio.sfx(w.kind,{vol:player?1:.72});if(player){noise(actor.x,actor.y,260);state.shotsFired++;game.shake((shotgun?2.7:1.0)*settings.shake/100);}
    const spread=shotgun?.26:player?.008:.018;
    const shotToken={counted:false};
    for(let i=0;i<count;i++){
      const angle=actor.facing+(shotgun?((i/(count-1))-.5)*spread*2:(random()-.5)*spread),speed=player?specs[w.kind].speed:(shotgun?300:365);
      state.shots.fire({x:actor.x,y:actor.y,z:10,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:1,life:player?.85:1.1,color:player?'#ffe6a9':'#ff8174',team:actor.team,owner:actor,angle,kind:'bullet',shotToken,weapon:w.kind});
    }
    game.particles.sparks(actor.x+Math.cos(actor.facing)*10,actor.y+Math.sin(actor.facing)*10,12,shotgun?8:4,actor.facing,{color:'#fff0b4'});
  }
  function throwWeapon(){
    const p=state.player;if(!p.weapon||p.finishTarget)return;const item={...p.weapon};p.weapon=null;p.attack.cancel();p.cool=.17;
    state.shots.fire({x:p.x,y:p.y,z:9,vx:Math.cos(p.facing)*360,vy:Math.sin(p.facing)*360,r:3,life:.75,color:'#a8e9e0',team:'player',owner:p,kind:'throw',item,angle:p.facing,weapon:item.kind});
    game.audio.sfx('whoosh');
  }
  function projectileHit(b,a){
    if(b.kind==='throw'){stun(a,'throw',b.angle);drop(b.item,b.x,b.y,-Math.cos(b.angle)*32,-Math.sin(b.angle)*32);noise(b.x,b.y,105);return;}
    if(a.team==='enemy'){if(!b.shotToken.counted){state.shotsHit++;b.shotToken.counted=true;}kill(a,'gun',b.angle);}else hurt(b.owner,'gun');
  }
  function projectileWall(b){
    if(b.kind==='throw'){drop(b.item,b.x,b.y,-b.vx*.15,-b.vy*.15);game.audio.sfx('bump',{vol:.35});noise(b.x,b.y,70);}else game.particles.sparks(b.x,b.y,7,3,b.angle+Math.PI,{color:'#b0d0d5'});
  }
  function context(){
    if(!state)return null;const p=state.player;
    if(state.broadcast&&dist(p,level.exit)<38)return{kind:'exit',label:'EXTRACT WITH THE TAPE'};
    if(!state.tape&&dist(p,level.tape)<31&&clearLine(p,level.tape))return{kind:'tape',label:'TAKE THE EVIDENCE TAPE'};
    if(!state.broadcast&&dist(p,level.terminal)<35&&clearLine(p,level.terminal))return{kind:'terminal',label:!state.tape?'TAPE REQUIRED':!state.cleared?'CLEAR THE ARMED CREW FIRST':'STOP THE BROADCAST'};
    const pickup=state.pickups.filter(a=>dist(a,p)<27&&clearLine(p,a)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(pickup)return{kind:'pickup',item:pickup,label:(p.weapon?'SWAP FOR ':'PICK UP ')+specs[pickup.item.kind].name+(pickup.item.kind==='baton'?'':' / '+pickup.item.ammo)};
    const door=level.doors.filter(d=>dist(d,p)<33).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(door)return{kind:'door',item:door,label:door.open?'CLOSE DOOR':'KICK DOOR'};
    return null;
  }
  function interact(){
    const c=context(),p=state.player;if(!c||p.finishTarget)return;
    if(c.kind==='pickup'){const old=p.weapon;p.weapon={...c.item.item};state.pickups.splice(state.pickups.indexOf(c.item),1);if(old)drop(old,p.x,p.y);p.attack.cancel();p.cool=.1;game.audio.sfx('pickup',{vol:.5});}
    else if(c.kind==='door'){c.item.open?closeDoor(c.item):openDoor(c.item,p);}
    else if(c.kind==='tape'){state.tape=true;state.score+=1000;game.audio.sfx('tape');pop(level.tape.x,level.tape.y,'EVIDENCE +1000','#7ee2dc');say(state.cleared?'Tape secured. Stop the broadcast in the control room.':'Tape secured. Clear the crew before you stop the broadcast.',5);}
    else if(c.kind==='terminal'){
      if(!state.tape){say('Recover the tape from the archive first.',3);return;}if(!state.cleared){say('The armed crew still has control of the station.',3);return;}
      state.broadcast=true;state.score+=1500;game.audio.sfx('tape',{pitch:.65});game.audio.music(SableAudio.quiet);say('They are off the air. Bring the tape back to the van.',6);
      for(const d of level.doors)if(!d.open){d.open=true;for(const [cx,cy]of d.points)level.map.block(cx,cy,false);}
    }else if(c.kind==='exit')complete();
  }
  function finish(){
    const p=state.player;if(p.finishTarget||p.attack.busy)return;
    const e=state.enemies.filter(e=>e.alive&&e.stun>0&&dist(e,p)<30&&clearLine(p,e)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(!e)return;p.finishTarget=e;p.finishT=.34;p.facing=Math.atan2(e.y-p.y,e.x-p.x);p.vx=p.vy=0;game.audio.sfx('whoosh',{vol:.3});
  }
  function signal(){if(state.charges<=0||state.focus>0||state.player.finishTarget||state.cleared)return;state.charges--;state.focus=2.4;state.focusUsed++;game.audio.sfx('signal');state.ripples.push({x:state.player.x,y:state.player.y,r:260,t:0,color:'#6fe1e0'});}
  function complete(){
    if(!state.broadcast||!state.tape||!state.cleared)return;
    const time=state.clearTime??state.elapsed,timeBonus=Math.max(0,Math.round((210-time)*25)),styleBonus=state.styles.size*500,cleanBonus=state.damageTaken===0?2500:0;
    const total=state.score+timeBonus+styleBonus+cleanBonus,rank=total>=23500?'S':total>=19000?'A':total>=15000?'B':total>=11000?'C':'D';
    state.result={score:total,rank,time,attempts,difficulty:state.difficulty,combat:state.score-2500,objectives:2500,timeBonus,styleBonus,cleanBonus};
    setText('rank',rank);setText('result-score',scoreText(total));
    setHTML('result-grid',[[state.kills+'/'+state.enemies.length,'THREATS CLEARED'],[state.maxCombo+'×','BEST CHAIN'],[fmtTime(time,false),'COMBAT TIME'],[String(attempts),'ATTEMPTS']].map(a=>'<div><strong>'+a[0]+'</strong><span>'+a[1]+'</span></div>').join(''));
    setHTML('score-breakdown',[["Combat",state.result.combat],["Objectives",2500],["Time bonus",timeBonus],["Style bonus",styleBonus],["Clean run",cleanBonus],["Shots hit",state.shotsHit+'/'+state.shotsFired]].map(a=>'<div><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join(''));
    const saved=readLocal('records',{}),records=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{},old=records[state.difficulty],record=!old||!Number.isFinite(old.score)||total>old.score;
    if(record){records[state.difficulty]={score:total,rank,time,date:new Date().toISOString()};writeLocal('records',records);}
    setText('new-record',record?'NEW '+state.difficulty.toUpperCase()+' RECORD':'BEST '+state.difficulty.toUpperCase()+' / '+old.score.toLocaleString());
    setText('result-note',state.difficulty.toUpperCase()+' · '+state.styles.size+' of 5 styles used · '+state.focusUsed+' signal charges used. Time stops at the final threat.');
    stack=[];show('results');game.audio.sfx('tape',{pitch:.9});refreshRecord();
  }
  function updatePlayer(dt){
    const p=state.player;p.cool=Math.max(0,p.cool-dt);p.invuln=Math.max(0,p.invuln-dt);p.recoil=Math.max(0,p.recoil-dt);p.hitFlash=Math.max(0,p.hitFlash-dt);
    if(input.buffered('throw',.13)){input.consume('throw');throwWeapon();}
    if(input.buffered('interact',.13)){input.consume('interact');interact();if(mode!=='play')return;}
    if(input.buffered('execute',.13)){input.consume('execute');finish();}
    if(input.buffered('focus',.13)){input.consume('focus');signal();}
    const move=input.move(),dir=game.view.screenDirToGround(move[0],move[1]);
    let aim;
    if(touch.id!==null&&Math.hypot(touch.dx,touch.dy)>.15)aim=game.view.screenDirToGround(touch.dx,touch.dy);
    else if(input.aimSource==='pad'&&input.padAim)aim=game.view.screenDirToGround(...input.padAim);
    else if(input.aimSource==='mouse'){const m=game.mouseGround();if(m)aim=[m[0]-p.x,m[1]-p.y];}
    else if(Math.hypot(...dir)>.1)aim=dir;
    if(aim&&Math.hypot(...aim)>.05&&!p.finishTarget)p.facing=Math.atan2(aim[1],aim[0]);
    const speed=state.focus>0?112:128;
    if(p.finishTarget){p.vx=p.vy=0;p.finishT-=dt;if(!p.finishTarget.alive)p.finishTarget=null;else if(p.finishT<=0){const target=p.finishTarget;p.finishTarget=null;kill(target,'finish',p.facing);}}
    else{
      p.vx=E.approach(p.vx,dir[0]*speed,dt*1050);p.vy=E.approach(p.vy,dir[1]*speed,dt*1050);pushDoors(p,dir[0],dir[1]);p.update(dt,level.map);
      const wants=input.down('attack')||input.buffered('attack',.12)||touch.fire;
      if(wants&&p.cool<=0){
        if(p.weapon&&p.weapon.kind!=='baton'){shoot(p);input.consume('attack');}
        else if(p.attack.start()){input.consume('attack');p.attack.spec.blade=p.weapon?10:0;p.attack.spec.reach=p.weapon?11:8;game.audio.sfx('swing',{vol:.7});}
      }
      p.attack.update(dt);
      p.attack.hits(state.enemies,e=>e.alive&&E.inArc(p,p.facing,e,p.weapon?27:21,1.4)&&clearLine(p,e),e=>{p.weapon?kill(e,'melee',p.facing):stun(e,'melee',p.facing);noise(p.x,p.y,68);});
    }
    if(Math.hypot(p.vx,p.vy)>30){state.footT-=dt;if(state.footT<0){state.footT=.23;game.audio.sfx('step',{vol:.26,pitch:SableLevel.roomAt(p.x,p.y)?.id==='lounge'?.7:1});}}
    const lead=state.cleared?22:Math.min(42,game.W/18),lx=Math.cos(p.facing)*lead,ly=Math.sin(p.facing)*lead;
    game.focus(p.x+lx,p.y+ly,0);
    const room=SableLevel.roomAt(p.x,p.y);
    if(room&&!state.tutorial.has(room.id)){state.tutorial.add(room.id);if(room.id==='reception')say('Gunfire draws the crew. Doors and thrown weapons can stop them.',4);if(room.id==='spine')say('The archive is to the east. The control room is at the north end.',4);if(room.id==='studio'&&!state.cleared)say('Use cover. SHIFT gives you a short opening.',3);}
  }
  function walkEnemy(e,target,dt,speed){
    let dir;const d=dist(e,target);
    if(d<4){e.vx=e.vy=0;return;}
    if(clearLine(e,target,6))dir=[(target.x-e.x)/d,(target.y-e.y)/d];else{e.flow.update(target.x,target.y);dir=e.flow.dir(e.x,e.y,target.x,target.y);}
    pushDoors(e,...dir);e.vx=E.approach(e.vx,dir[0]*speed,dt*600);e.vy=E.approach(e.vy,dir[1]*speed,dt*600);e.update(dt,level.map);
    if(Math.hypot(e.vx,e.vy)>5)e.facing=E.approachAng(e.facing,Math.atan2(e.vy,e.vx),dt*5.5);
  }
  function updateEnemy(e,dt){
    e.cool=Math.max(0,e.cool-dt);e.recoil=Math.max(0,e.recoil-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);e.alert=Math.max(0,e.alert-dt);e.knockX*=Math.exp(-dt*8);e.knockY*=Math.exp(-dt*8);
    if(!e.alive){e.deadT+=dt;e.vx=e.knockX;e.vy=e.knockY;e.update(dt,level.map);updateRig(e,dt);return;}
    if(state.player.finishTarget===e){e.stun=Math.max(e.stun,.2);e.vx=e.vy=e.knockX=e.knockY=0;e.attack.cancel();updateRig(e,dt);return;}
    if(e.stun>0){e.stun-=dt;e.vx=e.knockX;e.vy=e.knockY;e.update(dt,level.map);if(e.stun<=0){e.state='investigate';e.memory=3;e.target={x:state.player.x,y:state.player.y};}updateRig(e,dt);return;}
    const p=state.player,d=dist(e,p),angle=Math.atan2(p.y-e.y,p.x-e.x),fov=Math.abs(E.angDiff(e.facing,angle));
    const sees=p.alive&&d<(e.state==='patrol'?190:230)&&(fov<1.38||d<40||e.state==='chase'||e.state==='aim')&&clearLine(e,p);
    if(sees){if(e.state==='patrol')e.alert=1;e.target={x:p.x,y:p.y};e.memory=3.2;}
    else e.memory=Math.max(0,e.memory-dt);
    const gun=e.weapon&&e.weapon.kind!=='baton'&&e.weapon.ammo>0;
    if(sees&&gun&&d>34&&visible(e)&&visible(p,8)){
      e.state='aim';e.vx=e.vy=0;
      const reaction=(e.elite?.58:e.weapon.kind==='shotgun'?.91:.76)*(state.difficulty==='assist'?1.4:1);
      if(e.cool<=0){e.aim+=dt;if(e.aim<reaction-.19)e.facing=E.approachAng(e.facing,angle,dt*10);else if(e.lock===null)e.lock=e.facing;
        if(e.lock!==null)e.facing=e.lock;if(e.aim>=reaction){shoot(e);e.aim=0;e.lock=null;}}
      else{e.aim=0;e.lock=null;e.facing=E.approachAng(e.facing,angle,dt*5);}
    }else if((sees||e.attack.busy)&&d<30){
      e.state='strike';e.aim=0;e.lock=null;e.vx=e.vy=0;
      if(!e.attack.busy){e.facing=angle;e.attack.spec.wind=state.difficulty==='assist'?.5:.32;e.attack.start();}
      e.attack.update(dt);e.attack.hits([p],a=>a.alive&&dist(a,e)<25&&E.inArc(e,e.facing,a,26,1.6)&&clearLine(e,a),()=>hurt(e,'melee'));
    }else if(sees||e.memory>0){
      e.state=sees?'chase':'investigate';e.aim=0;e.lock=null;e.attack.cancel();walkEnemy(e,e.target,dt,e.runner?110:gun?69:91);
    }else{
      e.state='patrol';e.aim=0;e.lock=null;e.attack.cancel();
      if(e.patrol.length){const pt=e.patrol[e.pathIndex],target={x:pt[0],y:pt[1]};if(dist(e,target)<6)e.pathIndex=(e.pathIndex+1)%e.patrol.length;walkEnemy(e,target,dt,34);}else if(dist(e,e.home)>6)walkEnemy(e,e.home,dt,36);else{e.vx=e.vy=0;e.facing=E.approachAng(e.facing,level.enemySpawns[state.enemies.indexOf(e)].angle,dt*1.5);}
    }
    updateRig(e,dt);
  }
  function updateRig(a,dt){
    a.rig.o.weapon=a.weapon?(a.weapon.kind==='baton'?'sword':'gun'):null;
    a.rig.update(dt,{x:a.x,y:a.y,z:0,vx:a.vx,vy:a.vy,facing:a.facing,point:!!a.weapon&&a.weapon.kind!=='baton',stance:a.weapon?'ready':'guard',attack:a.attack.state,pose:!a.alive?'die':a.stun>0?'down':a.finishTarget?'kneel':null,down:a.stun>0?1:undefined,hurt:a.hitFlash>0,dash:a.team==='player'&&state?.focus>0});
    if(a.recoil>0)a.rig.kick(-.12*dt);
  }
  function separate(){
    const actors=[state.player,...state.enemies].filter(a=>a.alive&&a.stun<=0);
    for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d>0&&d<min){const f=(min-d)*.5/d;a.x-=dx*f;a.y-=dy*f;b.x+=dx*f;b.y+=dy*f;level.map.collide(a);level.map.collide(b);}}
  }
  function update(dt){
    if(input.pressed('pause')){if(mode==='play')openModal('pause');else if(mode==='pause')closeModal();return;}
    if(input.pressed('map')){if(mode==='play')openModal('tactical');return;}
    if(mode==='death'){
      state.deathT+=dt;updateRig(state.player,dt);for(const e of state.enemies)if(!e.alive)updateEnemy(e,dt);
      if(input.pressed('restart')||input.pressed('confirm'))startMission(true);return;
    }
    if(mode!=='play'||!state)return;
    if(input.pressed('restart')){startMission(true);return;}
    state.t+=dt;if(!state.cleared)state.elapsed+=dt;
    state.focus=Math.max(0,state.focus-dt);state.comboTime=Math.max(0,state.comboTime-dt);state.radioT=Math.max(0,state.radioT-dt);
    const enemyDt=dt*(state.focus>0?.34:1);
    updatePlayer(dt);if(mode!=='play')return;
    for(const e of state.enemies)updateEnemy(e,enemyDt);
    if(mode==='play'){
      separate();state.shots.updateCombat(dt,level.map,[state.player,...state.enemies],projectileHit,projectileWall,state.focus>0?.34:1);
      updateRig(state.player,dt);
    }
    for(const d of level.doors)d.angle=E.approach(d.angle,d.open?Math.PI*.48:0,dt*7);
    for(const p of state.pickups){p.t+=dt;p.update(dt,level.map);}
    state.pops=state.pops.filter(p=>(p.t+=dt)<.85);state.ripples=state.ripples.filter(p=>(p.t+=dt)<.65);
    if(state.radioT<=0)$('radio').classList.add('hidden');
    hudClock+=dt;if(hudClock>.06){hudClock=0;updateHUD();}
  }
  function updateHUD(){
    if(!state)return;const p=state.player,w=p.weapon,c=context();
    setHTML('kill-count',String(state.kills).padStart(2,'0')+'<span>/'+state.enemies.length+'</span>');setText('score',scoreText(state.score));setText('timer',fmtTime(state.clearTime??state.elapsed));
    const obj=state.broadcast?'Return to the van · Press E to extract':!state.cleared?(state.tape?'Tape secured · Clear the armed crew':'Clear the armed crew · Find the tape'):!state.tape?'Recover the tape in the archive':'Stop the broadcast in the control room';
    setText('objective',obj);setText('location-label',SableLevel.roomAt(p.x,p.y)?.name||'SOUTH SERVICE ROAD');
    setText('weapon-name',w?specs[w.kind].name:'BARE HANDS');setText('weapon-type',w?specs[w.kind].type:'QUIET / KNOCKDOWN');
    setHTML('ammo',w&&w.kind!=='baton'?Array.from({length:specs[w.kind].cap},(_,i)=>'<i class="'+(i<w.ammo?'':'empty')+'"></i>').join('')+'<em>'+w.ammo+' / '+specs[w.kind].cap+'</em>':w?'NO AMMO NEEDED':'STRIKE · THEN FINISH');
    setText('armor-status',state.difficulty==='assist'?(p.hp>1?'ASSIST / ARMOUR READY':'ASSIST / ARMOUR SPENT'):'');
    const down=state.enemies.find(e=>e.alive&&e.stun>0&&dist(e,p)<30&&clearLine(e,p));
    setHTML('context-prompt',p.finishTarget?'FINISHING…':down?'<kbd>SPACE</kbd> FINISH DOWNED ENEMY':c?'<kbd>E</kbd> '+c.label:'');
    setHTML('focus-bars',Array.from({length:2},(_,i)=>'<i class="'+(i<state.charges?'charged':'')+'"></i>').join(''));
    setText('focus-description',state.focus>0?'ACTIVE / '+state.focus.toFixed(1)+'s':state.charges===2?'2 CHARGES / SLOW THREATS':state.charges+' CHARGE'+(state.charges===1?'':'S')+' / '+(3-state.chargeKills)+' TAKEDOWNS TO REFILL');
    $('focus-bars').style.opacity=state.focus>0?'.55':'1';$('combo').classList.toggle('hidden',state.comboTime<=0||state.combo<2);setText('combo-number',state.combo+'×');$('combo-fill').style.transform='scaleX('+(state.comboTime/4)+')';
  }
  function drawWeapon(r,g,p){
    const [x,y]=r.w(p.x,p.y,2),a=p.angle||0,s=r.view.scale,w=p.item?.kind||p.weapon;
    const ca=Math.cos(a),sa=Math.sin(a),point=(xx,yy)=>[x+(xx*ca-yy*sa)*s,y+(xx*sa+yy*ca)*s];
    const line=(a,b,c,d,col,n=2)=>{const p1=point(a,b),p2=point(c,d);E.px.line(g,...p1,...p2,col,n);};
    if(w==='baton'){line(-8,0,7,0,'#bad0ce',2);line(-7,0,-3,0,'#536b76',3);}else{line(-6,0,w==='shotgun'?10:6,0,'#b7c6c2',3);line(-4,0,-6,4,'#546d75',3);if(w==='shotgun')line(-1,0,4,0,'#b58e63',3);}
  }
  function drawActor(r,a){
    if(!r.visible(a.x,a.y,0,40,50,50))return;
    r.shadow(a.x,a.y,a.alive&&a.stun<=0?7:12,.3);
    const player=a.team==='player';
    if(a.alive&&a.stun<=0){
      r.decal(g=>{r.groundRing(a.x,a.y,player?8.4:7.4,player?'#efcc8d':settings.contrast?'#ff8179':'#8a5960',player?.7:.37);});
    }
    r.actor(a.x,a.y,0,(g,ox,oy)=>{
      a.rig.draw(g,ox,oy,r.view);
      if(player&&a.alive){const h=a.rig._w(a.rig.J.head),c=Math.cos(a.facing),s=Math.sin(a.facing),p1=r.view.p(h[0]+c*1.9-s*2.4,h[1]+s*1.9+c*2.4,h[2]+.1),p2=r.view.p(h[0]+c*1.9+s*2.4,h[1]+s*1.9-c*2.4,h[2]+.1);E.px.line(g,ox+p1[0],oy+p1[1],ox+p2[0],oy+p2[1],'#ffd188',2);}
    },{outline:true,outlineColor:player?'#091c28':settings.contrast&&a.alive?'#ff9b8c':'#11202c',rim:player,flash:a.hitFlash>0?'#f4e2c5':false,alpha:a.invuln>0&&Math.floor(state.t*16)%2?.65:1,bias:a.alive?0:-.3});
    if(a.alive&&!player){
      if(a.stun>0){r.overlay(g=>{const[x,y]=r.w(a.x,a.y,22);E.font.text(g,Math.ceil(a.stun)+'s',x,y,'#85e7e0',{align:'center',outline:true,font:'tiny'});});}
      else if(a.alert>0||a.state==='aim'||a.state==='strike')r.overlay(g=>{const[x,y]=r.w(a.x,a.y,31);E.font.text(g,a.state==='investigate'?'?':'!',x,y,a.state==='aim'?'#ff967f':'#edcb86',{align:'center',outline:true});});
    }
  }
  function objectiveMarker(r,point,label,color){
    const time=state?.t||0;
    r.decal(g=>{r.groundRing(point.x,point.y,18+Math.sin(time*2)*1.5,color,.8);r.groundRing(point.x,point.y,21,color,.3);});
    r.overlay(g=>{const[x,y]=r.w(point.x,point.y,16);if(x>-30&&x<r.W+30&&y>40&&y<r.H-50)E.font.text(g,label,x,y-6,color,{align:'center',outline:true,font:'tiny'});});
  }
  function draw(r){
    if(mode==='title'||mode==='briefing'||!state)return;
    SableLevel.draw(r,level,state);
    r.decal(g=>{
      for(const b of state.decals){const p=r.w(b.x,b.y,0);E.px.ell(g,p[0],p[1],b.r*r.view.scale,b.r*.58*r.view.scale,b.c);}
      for(const p of state.pickups){const near=dist(p,state.player)<40;if(near)r.groundRing(p.x,p.y,10,'#e6bd7c',.3);drawWeapon(r,g,p);}
      for(const ring of state.ripples){if(ring.t>.5)continue;r.groundRing(ring.x,ring.y,ring.r*(.12+ring.t),ring.color,(1-ring.t/.5)*.12);}
    });
    if(!state.tape)objectiveMarker(r,level.tape,'EVIDENCE','#80e0d5');
    if(state.tape&&!state.broadcast)objectiveMarker(r,level.terminal,state.cleared?'CUT SIGNAL':'CONTROL','#80e0d5');
    if(state.broadcast)objectiveMarker(r,level.exit,'EXTRACT','#ffd28b');
    for(const e of state.enemies)if(e.alive&&e.state==='aim'&&e.cool<=0){
      const distance=Math.min(240,dist(e,state.player)+30),end={x:e.x+Math.cos(e.facing)*distance,y:e.y+Math.sin(e.facing)*distance},t=Math.min(1,E.Sweep.rayMap(level.map,e.x,e.y,end.x,end.y));
      r.decal(g=>{const a=r.w(e.x,e.y,0),b=r.w(e.x+(end.x-e.x)*t,e.y+(end.y-e.y)*t,0);E.px.blend(g,e.lock!==null?.6:.22,'normal',()=>E.px.line(g,a[0],a[1],b[0],b[1],'#ff7e73',1));});
    }
    for(const e of state.enemies)drawActor(r,e);drawActor(r,state.player);
    for(const b of state.shots.list){if(b.kind==='throw')r.queue(b.x,b.y,1,g=>drawWeapon(r,g,{...b,angle:state.t*24,item:b.item}));}
    state.shots.draw(r);
    // Rain is confined to exterior tiles. The roof keeps the station clear.
    r.overlay(g=>{
      if(state.player.y>605||state.player.x<130||state.player.x>865){for(let i=0;i<75;i++){const wx=(E.hash2(i,12)*960+(state.t*13))%960,wy=(E.hash2(i,31)*736+state.t*310)%736;if(wx>66&&wx<895&&wy>63&&wy<674)continue;const p=r.w(wx,wy,20);E.px.blend(g,.22,'normal',()=>E.px.line(g,p[0],p[1],p[0]-3,p[1]+9,'#9bbdcc',1));}}
      for(const pop of state.pops){const p=r.w(pop.x,pop.y,22+pop.t*18);E.px.blend(g,Math.min(1,(.85-pop.t)*3),'normal',()=>E.font.text(g,pop.text,p[0],p[1],pop.color,{align:'center',font:'tiny'}));}
      if(state.focus>0){E.px.blend(g,.055,'normal',()=>E.px.rect(g,0,0,r.W,r.H,'#58ccda'));E.px.rect(g,0,0,r.W,2,'#74dbe0');E.px.rect(g,0,r.H-2,r.W,2,'#74dbe0');}
      if(mode==='play'){
        const p=state.player,a=p.facing,start=r.w(p.x,p.y,10),pointer=game.mouseGround();let tx,ty;
        if(input.aimSource==='mouse'&&pointer)[tx,ty]=r.w(pointer[0],pointer[1],0);else[tx,ty]=r.w(p.x+Math.cos(a)*80,p.y+Math.sin(a)*80,10);
        if(settings.aim&&p.weapon&&p.weapon.kind!=='baton'){
          const end={x:p.x+Math.cos(a)*180,y:p.y+Math.sin(a)*180},hit=Math.min(1,E.Sweep.rayMap(level.map,p.x,p.y,end.x,end.y)),last=r.w(p.x+(end.x-p.x)*hit,p.y+(end.y-p.y)*hit,10);
          E.px.blend(g,.14,'normal',()=>E.px.line(g,...start,...last,'#ffe0a2',1));
        }
        const col=p.weapon&&p.weapon.kind!=='baton'&&p.weapon.ammo===0?'#ed7f76':'#f2d69f';
        E.px.line(g,tx-7,ty,tx-3,ty,col);E.px.line(g,tx+3,ty,tx+7,ty,col);E.px.line(g,tx,ty-7,tx,ty-3,col);E.px.line(g,tx,ty+3,tx,ty+7,col);E.px.rect(g,tx,ty,1,1,col);
      }
    });
  }
  function gpuStatus(){
    const gpu=game.gpu;
    if(settings.filter==='off'){setText('gpu-status','Standard Canvas view is active.');return;}
    if(!gpu||gpu.failed){setText('gpu-status','WebGPU is unavailable here. Standard Canvas view remains active.');return;}
    if(gpu.loading){setText('gpu-status','Starting WebGPU…');return;}
    setText('gpu-status',gpu.ready?'WebGPU is active · '+(settings.filter==='cel'?'Cel shade':'Pixel art')+'. HUD text stays clear.':'Standard Canvas view remains active.');
  }
  function applySettings(persist=true){
    settings=validSettings(settings);document.documentElement.style.setProperty('--scan',settings.scanline/100);
    game.audio.sfxVolume=settings.sfx/100;game.audio.musicVolume=settings.music/100;game.audio.setVolume(.65);game.audio.mute(muted);
    game.reduceMotion=settings.shake===0;game.r.rimAlpha=.18;
    if(settings.filter!=='off'){
      if(!game.gpu){if(E.GPULighting.supported())game.enableGPU({map:level.map,ambient:[.65,.71,.76],bands:8,wrap:.55,spill:.5,glow:.2,shadows:true,onStatus:gpuStatus});else{gpuStatus();if(persist)writeLocal('settings',settings);return;}}
      const gpu=game.gpu;gpu.enabled=true;gpu.filterMode=settings.filter==='cel'?1:2;gpu.pixelSize=settings.filter==='pixel'?settings.pixel:1;gpu.colorBands=settings.bands;gpu.bands=settings.bands;gpu.edgeStrength=settings.edge/100;gpu.glow=settings.glow/100;gpu.exposure=settings.exposure/100;
    }else if(game.gpu){game.gpu.enabled=false;game.gpu.show(false);}
    gpuStatus();if(persist)writeLocal('settings',settings);
  }
  const settingFields={bands:'bands',pixel:'pixel-size',edge:'edge',glow:'glow',exposure:'exposure',scanline:'scanline',music:'music',sfx:'sfx',shake:'shake'};
  function syncSettings(){
    $('filter-mode').value=settings.filter;
    for(const[key,id]of Object.entries(settingFields)){$(id).value=settings[key];$(key+'-out').textContent=settings[key]+(['bands','pixel'].includes(key)?'':'%');}
    $('reduced-flashes').checked=settings.flashes;$('aim-guide').checked=settings.aim;$('high-contrast').checked=settings.contrast;gpuStatus();
  }
  function bind(id,fn){$(id).addEventListener('click',()=>{game.audio.sfx('select',{vol:.3});fn();});}
  bind('begin',beginBrief);bind('deploy',()=>startMission());bind('title-settings',()=>openModal('settings'));bind('title-controls',()=>openModal('controls'));
  bind('pause-button',()=>openModal('pause'));bind('resume',closeModal);bind('pause-settings',()=>openModal('settings'));bind('pause-controls',()=>openModal('controls'));
  bind('restart-pause',()=>startMission(true));bind('quit',toTitle);bind('retry',()=>startMission(true));bind('death-brief',()=>{stack=[];show('briefing');SableLevel.drawMap($('brief-map'),level,null,true);});
  bind('replay',()=>{attempts=0;startMission();});bind('results-title',toTitle);bind('settings-done',closeModal);bind('map-done',closeModal);
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  bind('reset-settings',()=>{settings={...defaults};syncSettings();applySettings();});
  $('filter-mode').addEventListener('change',()=>{settings.filter=$('filter-mode').value;applySettings();});
  for(const[key,id]of Object.entries(settingFields))$(id).addEventListener('input',()=>{settings[key]=Number($(id).value);syncSettings();applySettings();});
  for(const[key,id]of [['flashes','reduced-flashes'],['aim','aim-guide'],['contrast','high-contrast']])$(id).addEventListener('change',()=>{settings[key]=$(id).checked;applySettings();});
  bind('title-fullscreen',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{setText('title-best','Use your browser full-screen command for a larger view.');}});
  document.addEventListener('keydown',e=>{
    const isControl=/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName||'');
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();if(mode==='play')openModal('pause');else if(mode==='briefing')toTitle();else if(['pause','settings','controls','tactical'].includes(mode))closeModal();return;}
    if(isControl)return;
    if(e.code==='Tab'&&(mode==='play'||mode==='tactical')){e.preventDefault();e.stopPropagation();mode==='play'?openModal('tactical'):closeModal();return;}
    if(e.code==='Enter'&&['title','briefing'].includes(mode)&&e.target?.tagName!=='BUTTON'){e.preventDefault();e.stopPropagation();mode==='title'?beginBrief():startMission();return;}
    if(e.code==='KeyR'&&(mode==='death'||mode==='results')){e.preventDefault();e.stopPropagation();if(mode==='results')attempts=0;startMission(mode==='death');return;}
    if(e.code==='KeyM'){e.preventDefault();muted=!muted;game.audio.mute(muted);if(mode==='play')say(muted?'Sound muted. Press M to restore it.':'Sound restored.',1.5);}
    if(e.code==='KeyH'&&mode==='play'){e.preventDefault();openModal('controls');}
    if(e.code==='Tab'&&mode!=='play'){
      const panel=$(mode),els=[...panel.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.offsetParent!==null);
      if(els.length){const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }
  });
  addEventListener('blur',()=>{if(mode==='play')openModal('pause');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')openModal('pause');});
  input.touchFilter=e=>e.clientX<innerWidth*.5;input.bindButtons($('touch-controls'));
  const coarse=matchMedia('(pointer:coarse)').matches;
  function touchMode(){document.body.classList.add('touch-mode');$('touch-controls').classList.remove('hidden');}
  if(coarse)touchMode();
  $('screen').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||mode!=='play'||e.clientX<innerWidth*.5)return;touchMode();touch.id=e.pointerId;touch.x=e.clientX;touch.y=e.clientY;touch.dx=0;touch.dy=0;touch.fire=false;input.aimSource='touch';$('screen').setPointerCapture(e.pointerId);});
  $('screen').addEventListener('pointermove',e=>{if(e.pointerId!==touch.id)return;touch.dx=(e.clientX-touch.x)/45;touch.dy=(e.clientY-touch.y)/45;touch.fire=Math.hypot(touch.dx,touch.dy)>.2;});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('screen').addEventListener(name,e=>{if(e.pointerId===touch.id){touch.id=null;touch.fire=false;}});
  game.onPausedUpdate=()=>{
    if(input.lastDevice!=='gamepad')return;
    if(input.pressed('pause')&&mode==='pause'){closeModal();return;}
    if(input.pressed('map')&&mode==='tactical'){closeModal();return;}
    if(input.pressed('cancel')){if(mode==='briefing')toTitle();else if(stack.length)closeModal();return;}
    if(input.pressed('restart')&&mode==='results'){attempts=0;startMission();return;}
    const panel=$(mode),items=panel?[...panel.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.offsetParent!==null):[];
    if(items.length){let index=items.indexOf(document.activeElement);if(input.repeat('down'))items[(index+1)%items.length].focus();if(input.repeat('up'))items[(index-1+items.length)%items.length].focus();}
    const active=document.activeElement;
    if(items.includes(active)){
      const direction=(input.repeat('right')?1:0)-(input.repeat('left')?1:0);
      if(direction&&active.tagName==='SELECT'){active.selectedIndex=(active.selectedIndex+direction+active.options.length)%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(direction&&active.type==='range'){active.value=E.clamp(Number(active.value)+direction*Number(active.step||1),Number(active.min),Number(active.max));active.dispatchEvent(new Event('input',{bubbles:true}));}
      if(input.pressed('confirm')&&(active.tagName==='BUTTON'||['checkbox','radio'].includes(active.type)))active.click();
    }else if(input.pressed('confirm')){if(mode==='title')beginBrief();else if(mode==='briefing')startMission();}
  };
  game.onError=(e,where)=>{$('fatal').classList.remove('hidden');$('fatal').textContent='The game stopped in '+where+'. Reload the page to retry. '+e.message;};
  // A small public interface supports the same actions as the game menus.
  function snapshot(){return{title:'Sable Signal',level:'The Relay',mode,difficulty:state?.difficulty||sessionDifficulty,attempts,player:state?{x:state.player.x,y:state.player.y,alive:state.player.alive,weapon:state.player.weapon,hp:state.player.hp}:null,kills:state?.kills||0,total:level.enemySpawns.length,score:state?.score||0,tape:!!state?.tape,broadcast:!!state?.broadcast,cleared:!!state?.cleared,focus:state?.focus||0,charges:state?.charges??2,time:state?.clearTime??state?.elapsed??0,renderer:game.gpu?.active(game.view)?'WebGPU':'Canvas',filter:settings.filter,errors:game.errors.map(e=>e.message),result:state?.result||null,performance:{fps:game.fps,updateMs:game.stats.updateMs,renderMs:game.stats.renderMs},threats:state?.enemies.filter(e=>e.alive).map(e=>({label:e.label,x:e.x,y:e.y,stunned:e.stun>0,state:e.state,weapon:e.weapon?.kind||'hands'}))||[],doors:level.doors.map(d=>({name:d.name,x:d.x,y:d.y,open:d.open}))};}
  window.SableSignal=Object.freeze({getState:snapshot,start:()=>{if(mode==='title')beginBrief();else if(mode==='briefing')startMission();return snapshot();},pause:()=>{if(mode==='play')openModal('pause');return snapshot();},setFilter:value=>{if(!['off','cel','pixel'].includes(value))throw new Error('Choose off, cel, or pixel.');settings.filter=value;applySettings();syncSettings();return snapshot();}});
  let mc;try{mc=(window.parent!==window?window.parent.document:document).modelContext;}catch{mc=document.modelContext;}
  if(mc?.registerTool){const life=new AbortController();for(const tool of [
    {name:'read_mission_status',description:'Read the current Sable Signal mission status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>snapshot()},
    {name:'start_mission',description:'Open the mission brief from the title, or enter the station from the brief.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>SableSignal.start()},
    {name:'set_render_filter',description:'Set the same render filter as the Settings menu.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['off','cel','pixel']}},required:['mode'],additionalProperties:false},execute:v=>{if(!v||typeof v!=='object'||Object.keys(v).some(k=>k!=='mode'))throw new Error('Expected a filter mode.');return SableSignal.setFilter(v.mode);}}
  ])try{Promise.resolve(mc.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}addEventListener('pagehide',()=>life.abort(),{once:true});}
  applySettings(false);syncSettings();refreshRecord();show('title');game.start({update,draw});
})();
