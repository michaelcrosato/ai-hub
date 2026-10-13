/* The Lantern Seam — one complete level, built on my-3D2dge Agent Edition. */
(() => {
 'use strict';
 const E=window.My3D2dge,A=window.StageArt,$=id=>document.getElementById(id),TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
 const SAVE='lantern-seam-progress-v1',PREF='lantern-seam-settings-v1',BEST='lantern-seam-best-v1';
 function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
 function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
 const defaults={look:'original',levels:6,edge:45,pixel:4,palette:12,volume:60,music:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,assist:false,touch:matchMedia('(pointer: coarse)').matches};
 const settings={...defaults,...read(PREF,{})};
 const game=new E.Game({canvas:'screen',res:[1280,720],view:'side',views:['side'],input:{...E.Input.PLATFORMER,attack:['KeyJ','KeyX','Pad2'],skill:['KeyE','KeyV','Pad3']},smooth:true,bg:'#0a1e2a'});
 game.pauseOverlay=false;game.cam.smooth=0;game.focus(640,0,360);
 const filters=new window.StageFilters($('gpu'),s=>{$('gpuStatus').textContent=s;});
 const present=game.screen.present.bind(game.screen);game.screen.present=function(){present();filters.render(this.buf,this);};
 const music={bpm:82,steps:2,tracks:[{wave:'sine',vol:.2,notes:'D5 . A4 . F5 . E5 . D5 . A4 . C5 . A4 . | Bb4 . F4 . D5 . C5 . Bb4 . F4 . A4 . . . | G4 . D5 . F5 . E5 . D5 . C5 . A4 . . . | F4 . A4 . C5 . E5 . D5 - - - . . . .'},{wave:'triangle',vol:.12,notes:'D3 - - - A3 - - - D3 - - - A3 - - - | Bb2 - - - F3 - - - Bb2 - - - F3 - - - | G2 - - - D3 - - - G2 - - - D3 - - - | A2 - - - E3 - - - D3 - - - - - - -'}]};
 const bossMusic={bpm:115,steps:2,tracks:[{wave:'triangle',vol:.13,notes:'D3 . D3 . A2 . C3 . D3 . D3 . F3 . E3 . | Bb2 . Bb2 . F3 . A2 . D3 . D3 . A3 . . .'},{wave:'sine',vol:.12,notes:'D5 - . A4 D5 . F5 . E5 - . C5 A4 . . . | Bb4 - . F4 Bb4 . D5 . C5 - . A4 D5 - . .'},{wave:'drums',vol:.06,notes:'k . . . t . . . k . . . t . h .'}]};
 game.audio.define('thread',{wave:'sine',freq:610,to:1200,dur:.19,vol:.12});
 game.audio.define('light',{wave:'sine',freq:880,dur:.32,vol:.18,arp:[0,7,12],step:.08});
 game.audio.define('bell',[{wave:'sine',freq:146,to:130,dur:1.2,vol:.22},{wave:'sine',freq:435,to:400,dur:.8,vol:.13}]);
 game.audio.define('cloth',{wave:'noise',freq:1600,to:600,dur:.13,vol:.2});
 let mode='title',paused=false,hero,cut,world,cam=0,age=0,playTime=0,section=0,cardTime=0,cueTime=0,cueId='',tutorialId='',hp=3,lights=0,secrets=0,deaths=0,cuts=0,checkpoint=0,riding=null,rideLock=0,particles=[],trails=[],dropMasks=[],reveal=0,companion={x:0,z:0},boss,projectiles=[],bossStarted=false,endingTimer=0,shake=0,hudClock=0,sceneLock=0,saveAvailable=!!read(SAVE,null),lastSong=null;
 const sections=[['The Waking Grove','Find the first light thread.'],['The Hanging Garden','Let the threads carry you.'],['The Clockwork Choir','Wake the Bellkeeper.']];
 const CP=[{x:160,z:32},{x:1915,z:32},{x:3820,z:96},{x:5875,z:32}];
 const platformDefs=[
  [0,768,32,160],[1088,512,96,210],[1728,512,32,150],[2240,352,64,180],
  [2816,256,128,250],[3232,320,224,310],[3680,640,96,220],
  [4448,512,32,170],[5184,320,160,270],[5728,1632,32,175],
  [1280,160,256,22],[2080,128,160,22],[3968,192,256,22],[4704,160,192,22]
 ];
 function makeWorld(){
  const level=new E.PlatformMap({tile:32,rows:Array.from({length:25},()=>'.'.repeat(232)),legend:{'#':1,'=':2},types:{1:{kind:'solid'},2:{kind:'oneway'}},edges:'solid'});
  const platforms=platformDefs.map(([x,w,top,deep],i)=>({x,w,top,deep,oneway:i>9}));
  for(const p of platforms)for(let x=p.x/32;x<(p.x+p.w)/32;x++)if(p.oneway)level.set(x,p.top/32-1,2);else for(let z=0;z<p.top/32;z++)level.set(x,z,1);
  const threads=[
   [660,150,1160,205,360],[1500,220,1800,150,330],[2450,180,2890,240,395],
   [2990,245,3310,340,460],[3460,340,3780,215,440],[4200,215,4520,150,345],
   [4820,150,5290,280,465],[5400,285,5830,150,425],
   [1255,210,1390,360,400,1],[3910,220,4055,365,380,2]
  ].map((r,i)=>({id:i,a:{x:r[0],z:r[1]},b:{x:r[2],z:r[3]},mid:r[4],hidden:r[5]||0,revealed:!r[5],used:false}));
  const enemies=[[1310,96,1160,1460],[1990,32,1830,2170],[2370,64,2260,2500],[3345,224,3260,3500],[4040,96,3870,4240],[4620,32,4480,4860],[6000,32,5940,6180]].map((e,i)=>({id:i,x:e[0],z:e[1],min:e[2],max:e[3],dir:i%2?-1:1,hp:2,hit:0,alert:false,w:45,h:38,dead:false}));
  const gates=[{x:1560,z:96,open:false,fade:0},{x:4270,z:96,open:false,fade:0}];
  const coins=[];let cid=0;
  for(const p of platforms.slice(0,10))for(let x=p.x+90;x<p.x+p.w-45;x+=140)coins.push({id:cid++,x,z:p.top+55,got:false});
  for(const r of threads.filter(r=>!r.hidden))for(let i=1;i<5;i++){const p=A.threadPoint(r,i/5);coins.push({id:cid++,...p,got:false});}
  const keepsakes=[{id:0,x:1370,z:295,found:false,revealed:false,name:'The fox mask',kind:1},{id:1,x:4080,z:295,found:false,revealed:false,name:'The crown mask',kind:2},{id:2,x:5410,z:198,found:false,revealed:false,name:'The first song',kind:0}];
  const moving=[{x:2670,z:94,w:100,h:16,vx:0,vz:0,oneway:true,baseX:2670,baseZ:94,phase:0},{x:3580,z:136,w:90,h:16,vx:0,vz:0,oneway:true,baseX:3580,baseZ:136,phase:2}];
  return {level,platforms,threads,enemies,gates,coins,keepsakes,moving};
 }
 function reset(continued=false){
  world=makeWorld();hero=new E.Platformer({x:160,z:32,w:28,h:78,run:235,accel:1450,decel:1800,airAccel:1150,jump:535,gravity:1260,fallGravity:1750,maxFall:660,coyote:.12,buffer:.15,dash:460,dashTime:.14});
  hero.hurt=0;hero.gait=0;hero.maskKind=0;hero.landSquash=0;hero.dashUsed=false;
  cut=new E.Attack({name:'needle',wind:.035,active:.14,recover:.17,hitAt:0});hp=3;lights=0;secrets=0;deaths=0;cuts=0;checkpoint=0;playTime=0;section=0;cam=0;riding=null;rideLock=0;particles=[];trails=[];dropMasks=[];projectiles=[];reveal=0;endingTimer=0;bossStarted=false;
  boss={x:6720,z:60,hp:3,phase:'sleep',timer:0,hit:0,cycle:0,thread:null,everHit:false};
  if(continued){const s=read(SAVE,null);if(s&&s.version===1){checkpoint=clamp(Number(s.checkpoint)||0,0,3);lights=0;secrets=0;deaths=s.deaths||0;cuts=s.cuts||0;playTime=s.time||0;for(const c of world.coins)if((s.coins||[]).includes(c.id)){c.got=true;lights++;}for(const k of world.keepsakes)if((s.keepsakes||[]).includes(k.id)){k.found=true;k.revealed=true;secrets++;hero.maskKind=k.kind;}for(const g of world.gates)if(g.x<CP[checkpoint].x){g.open=true;g.fade=1;}for(const e of world.enemies)if(e.x<CP[checkpoint].x-90)e.dead=true;Object.assign(hero,{x:CP[checkpoint].x,z:CP[checkpoint].z});cam=clamp(hero.x-400,0,6080);section=hero.x>=4448?2:hero.x>=2240?1:0;}}
  companion={x:hero.x+52,z:hero.z+125};age=0;cueTime=0;cueId='';tutorialId='';cardTime=0;sceneLock=0;paused=false;mode='play';
  $('titleScreen').hidden=true;$('ending').hidden=true;$('hud').hidden=false;$('pauseFooter').hidden=false;$('bossHud').hidden=true;$('sceneCard').hidden=true;
  game.input.clear();updateHud();applySettings();setSong('explore');cue(continued?'The light remembers where you left it.':'Wick, the wood has gone quiet. Find the song inside the clock.','PIP',6);showCard(section);save();
 }
 function title(){mode='title';paused=false;section=0;$('titleScreen').hidden=false;$('ending').hidden=true;$('hud').hidden=true;$('bossHud').hidden=true;$('cue').hidden=true;$('tutorial').hidden=true;$('sceneCard').hidden=true;$('pauseFooter').hidden=true;$('continueButton').hidden=!read(SAVE,null);$('touchControls').hidden=true;game.input.clear();setSong('none');$('beginButton').focus();}
 function setSong(which){if(!settings.music||settings.volume===0)which='none';if(lastSong===which)return;lastSong=which;game.audio.music(which==='explore'?music:which==='boss'?bossMusic:which==='victory'?'victory':null);}
 function save(){if(mode!=='play')return;write(SAVE,{version:1,checkpoint,time:playTime,deaths,cuts,coins:world.coins.filter(c=>c.got).map(c=>c.id),keepsakes:world.keepsakes.filter(k=>k.found).map(k=>k.id)});}
 function cue(text,speaker='PIP',duration=4,id=''){if(id&&id===cueId)return;cueId=id||text;$('cueText').textContent=text;$('cueSpeaker').textContent=speaker;$('cue').hidden=false;cueTime=duration;$('liveStatus').textContent=text;}
 function showCard(i){$('cardNumber').textContent=`ACT I · SCENE ${['ONE','TWO','THREE'][i]}`;$('cardTitle').textContent=sections[i][0];$('sceneCard').hidden=false;cardTime=2.1;sceneLock=.7;game.audio.sfx('door',{vol:.25});}
 function emit(x,z,count=14,color='#f0c572',power=1){for(let i=0;i<count;i++){const a=Math.random()*TAU,v=(30+Math.random()*140)*power;particles.push({x,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v+60,life:.5+Math.random()*.5,max:1,color,size:1+Math.random()*3});}}
 function hurt(fromX,pit=false){if(settings.assist){if(pit)respawn(false);return;}if(hero.hurt>0&&!pit)return;hp--;hero.hurt=1.7;riding=null;rideLock=.3;shake=settings.reduced?0:7;game.audio.sfx('hurt',{vol:.45});emit(hero.x,hero.z+45,18,'#e8af8c');if(!pit){dropMasks.push({x:hero.x-(hero.facing*48),z:hero.z+90,vx:-hero.facing*100,vz:200,time:6,kind:hero.maskKind});hero.knock(hero.x>=fromX?1:-1,150,230,.2);cue('Catch your fallen mask before its light fades.','PIP',3,'mask');}if(hp<=0||pit)respawn(true);updateHud();}
 function respawn(count=true){if(count)deaths++;const c=CP[checkpoint];section=c.x>=4448?2:c.x>=2240?1:0;for(const r of world.threads)r.locked=false;Object.assign(hero,{x:c.x,z:c.z,vx:0,vz:0,hurt:2,onGround:false,climbing:false,dashing:0,stun:0,drop:0,_coy:0,_airJ:0,_cut:true,_dashCD:0,dashUsed:false});hp=3;riding=null;rideLock=.35;dropMasks=[];trails=[];projectiles=[];cut.cancel();cam=clamp(c.x-400,0,6080);if(checkpoint===3){boss.hp=3;boss.phase='sleep';boss.timer=0;boss.thread=null;bossStarted=false;$('bossHud').hidden=true;setSong('explore');}cue('A new stitch. Try again.','PIP',2.5);save();updateHud();}
 function nearestThread(){let best=null,dist=settings.assist?145:95;for(const r of [...world.threads,...(boss.thread?[boss.thread]:[])]){if(!r.revealed||r.locked)continue;for(let n=0;n<=28;n++){const u=n/28,p=A.threadPoint(r,u);const d=Math.hypot(p.x-hero.x,p.z-(hero.z+42));if(d<dist){dist=d;best={r,u};}}}return best;}
 function startRide(){const pick=nearestThread();if(!pick)return false;riding={...pick,speed:pick.r.boss?390:350,distance:Math.hypot(pick.r.b.x-pick.r.a.x,pick.r.b.z-pick.r.a.z)*1.15};hero.stun=0;hero.dashing=0;hero.onGround=false;hero.air=true;hero.dashUsed=false;game.audio.sfx('thread');pick.r.used=true;return true;}
 function updateRide(dt){if(!riding)return;const ride=riding;ride.u+=dt*ride.speed/ride.distance;const p=A.threadPoint(ride.r,Math.min(1,ride.u));hero.x=p.x;hero.z=p.z-42;hero.vx=ride.speed;hero.vz=0;hero.air=true;hero.facing=1;hero.riding=true;trails.push({x:hero.x,z:hero.z+42,life:.38});if(trails.length>65)trails.shift();if(Math.random()<dt*50)emit(hero.x,hero.z+42,1,'#ffe3a0',.4);
  if(ride.u>=1||!game.input.down('attack')){ride.r.locked=game.input.down('attack');if(ride.r.boss)hero.sealReady=.8;hero.vx=235;hero.vz=ride.r.boss?140:170;hero._cut=true;hero.riding=false;riding=null;rideLock=.22;game.audio.sfx('whoosh',{vol:.18});}
 }
 function scan(){reveal=3;game.audio.sfx('secret',{vol:.25});let found=false;for(const r of world.threads)if(r.hidden&&Math.abs(hero.x-r.a.x)<260){r.revealed=true;found=true;}for(const k of world.keepsakes)if(!k.found&&Math.abs(hero.x-k.x)<300){k.revealed=true;found=true;emit(k.x,k.z,12,'#a7e1ce');}if(found)cue('A hidden seam. Some things need a little light.','PIP',3);else cue('Look for the small moth mark. I can find what it hides.','PIP',3);}
 function updateBoss(dt){
  boss.hit=Math.max(0,boss.hit-dt);if(boss.hp<=0)return;
  if(!bossStarted){if(hero.x>6210){bossStarted=true;boss.phase='intro';boss.timer=3;$('bossHud').hidden=false;cue('No song. No sound. This wood belongs to silence.','THE BELLKEEPER',4);setSong('boss');}return;}
  hero.x=clamp(hero.x,6140,7190);boss.timer-=dt;
  if(boss.phase==='intro'&&boss.timer<=0){boss.phase='telegraph';boss.timer=1.55;cue('Watch his hands. Jump when they fall.','PIP',3);}
  else if(boss.phase==='telegraph'&&boss.timer<=0){boss.phase='slam';boss.timer=.5;shake=settings.reduced?0:9;game.audio.sfx('bell');for(const dir of [-1,1])projectiles.push({x:boss.x,z:34,vx:dir*(235+(3-boss.hp)*38),kind:'wave',life:6});emit(boss.x,32,25,'#bfa17a');}
  else if(boss.phase==='slam'&&boss.timer<=0){boss.phase='volley';boss.timer=2.4;boss.cycle=0;}
  else if(boss.phase==='volley'){
   if(boss.timer<2.2-boss.cycle*.65&&boss.cycle<4-boss.hp){const vx=(hero.x-boss.x)/1.7;projectiles.push({x:boss.x,z:220,vx,vz:140,kind:'note',life:4});boss.cycle++;game.audio.sfx('shoot',{vol:.15,pitch:.6});}
   if(boss.timer<=0){boss.phase='exposed';boss.timer=7.5;boss.thread={id:'boss',a:{x:boss.x-370,z:120},b:{x:boss.x-18,z:198},mid:315,revealed:true,boss:true};cue('Ride his loose thread. Cut the golden seal!','PIP',3);}
  }else if(boss.phase==='exposed'&&boss.timer<=0){boss.thread=null;if(riding?.r.boss){riding=null;hero.vz=100;}boss.phase='telegraph';boss.timer=1.35;}
  else if(boss.phase==='stagger'&&boss.timer<=0){boss.phase='telegraph';boss.timer=1.7;}
  const labels={intro:'The clock has taken the song.',telegraph:'Hands up. Prepare to jump.',slam:'Jump over the sound wave.',volley:'Keep moving. Avoid the falling notes.',exposed:'Hold Cut on the thread. Cut the gold seal.',stagger:'One seal is free.'};$('bossHint').textContent=labels[boss.phase]||'';
 }
 function hitBoss(){if(boss.phase!=='exposed')return;boss.hp--;boss.hit=.6;boss.everHit=true;boss.thread=null;riding=null;hero.riding=false;hero.vx=-180;hero.vz=210;rideLock=.8;cuts++;emit(boss.x,boss.z+95,65,'#ffdaa0',1.7);shake=settings.reduced?0:9;game.audio.sfx('explode',{vol:.25});game.freeze(.07);projectiles=[];
  if(boss.hp<=0){boss.phase='defeated';endingTimer=5;game.audio.sfx('powerup',{vol:.6});setSong('victory');cue('Listen, Wick. The quiet things are singing.','PIP',5);$('bossHint').textContent='The final seal is free.';}
  else{boss.phase='stagger';boss.timer=2.4;cue(boss.hp===2?'One voice returns. Two seals remain.':'One seal remains. Keep the thread alive.','PIP',3);}updateHud();
 }
 function finish(){mode='ending';paused=false;$('ending').hidden=false;$('hud').hidden=true;$('bossHud').hidden=true;$('cue').hidden=true;$('tutorial').hidden=true;$('touchControls').hidden=true;$('pauseFooter').hidden=true;const time=formatTime(playTime);$('endStats').innerHTML=`<div><strong>${lights}/${world.coins.length}</strong><span>LIGHTS FOUND</span></div><div><strong>${secrets}/3</strong><span>KEEPSAKES</span></div><div><strong>${time}</strong><span>YOUR TIME</span></div>`;$('endRank').textContent=settings.assist?'A gentle performance. Every story deserves an ending.':secrets===3?'A standing ovation. You found every hidden story.':deaths===0?'A graceful performance. The curtain rose without a fall.':'A brave performance. Every new stitch brought you home.';const best=read(BEST,{});write(BEST,{completions:(best.completions||0)+1,bestTime:Math.min(best.bestTime||Infinity,playTime),mostLights:Math.max(best.mostLights||0,lights),mostKeepsakes:Math.max(best.mostKeepsakes||0,secrets),assist:settings.assist});try{localStorage.removeItem(SAVE);}catch{}$('replayButton').focus();$('liveStatus').textContent='Level complete. The wood sings again.';}
 function formatTime(s){return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
 function updateHud(){if(!world)return;$('theatre').dataset.gameState=JSON.stringify(status());let mask='';for(let i=0;i<3;i++)mask+=`<span style="opacity:${i<hp?1:.23}">◈</span>${i<2?' ':''}`;$('masks').innerHTML=mask;$('masks').setAttribute('aria-label',`${hp} masks`);$('lightCount').textContent=lights;$('totalLights').textContent=world.coins.length;$('secretCount').textContent=secrets;$('sceneIndex').textContent=`SCENE 0${section+1}`;$('sceneName').textContent=sections[section][0];$('pauseLocation').textContent=sections[section][0];document.querySelectorAll('.bell-health i').forEach((e,i)=>e.classList.toggle('broken',i>=boss.hp));$('footerHint').textContent=settings.assist?'Assist mode · Your story, at your pace':riding?'Hold Cut to follow the light':bossStarted&&boss.hp>0?'Cut the three seals to free the song':'A / D  Move     Space  Jump     J  Cut     E  Pip';}
 function tutorials(){let id='',text='';if(hero.x<500){id='move';text='<kbd>A</kbd><kbd>D</kbd> Move <span> · </span> <kbd>Space</kbd> Jump';}else if(hero.x<1250){id='ride';text='Jump near a golden thread. Hold <kbd>J</kbd> or <kbd>X</kbd> to ride it.';}else if(hero.x<1640){id='gate';text='Hold <kbd>J</kbd> to cut enemies and stitched gates.';}else if(hero.x>1860&&hero.x<2210){id='dash';text='<kbd>Shift</kbd> Dash <span> · </span> <kbd>E</kbd> Ask Pip to find hidden seams';}else if(reveal>0){id='pip';text='Pip reveals hidden routes near moth marks.';}else if(boss.phase==='exposed'){id='boss';text='Hold <kbd>J</kbd> on the loose thread. Ride toward the gold seal.';}if(id!==tutorialId){tutorialId=id;$('tutorial').innerHTML=text;$('tutorial').hidden=!text;}}
 function update(dt){
  if(mode==='title'){age+=dt;if(game.input.pressed('start'))reset(false);return;}
  if(mode==='ending'){age+=dt;return;}
  if(game.input.pressed('pause')){if($('settingsDialog').open){$('settingsDialog').close();return;}if($('helpDialog').open){$('helpDialog').close();return;}togglePause();return;}
  if(paused)return;
  age+=dt;playTime+=dt;hero.sealReady=Math.max(0,(hero.sealReady||0)-dt);if(game.input.released('attack')){for(const r of world.threads)r.locked=false;if(boss.thread)boss.thread.locked=false;}hero.hurt=Math.max(0,hero.hurt-dt);rideLock-=dt;reveal=Math.max(0,reveal-dt);shake*=Math.exp(-dt*12);sceneLock-=dt;
  if(cardTime>0){cardTime-=dt;if(cardTime<=0)$('sceneCard').hidden=true;else $('sceneCard').style.opacity=String(clamp(cardTime/.6,0,1));}
  if(cueTime>0){cueTime-=dt;if(cueTime<=0)$('cue').hidden=true;}
  if(game.input.pressed('skill'))scan();
  for(const p of world.moving){const oldX=p.x,oldZ=p.z;p.x=p.baseX+Math.sin(age*.9+p.phase)*45;p.z=p.baseZ+Math.sin(age*1.3+p.phase)*35;p.vx=(p.x-oldX)/dt;p.vz=(p.z-oldZ)/dt;}
  const blockers=world.gates.filter(g=>!g.open).map(g=>({x:g.x,z:g.z,w:26,h:144,oneway:false,vx:0,vz:0}));
  if(riding)updateRide(dt);else if(endingTimer<=0&&sceneLock<=0){hero.riding=false;const wasDash=hero.dashing;hero.dash=(hero.dashing>0||!hero.dashUsed)?460:0;hero.update(dt,world.level,game.input,[...world.moving,...blockers]);if(!wasDash&&hero.dashing>0){hero.dashUsed=true;game.audio.sfx('whoosh',{vol:.3});}if(hero.onGround)hero.dashUsed=false;if(game.input.down('attack')&&rideLock<=0&&hero.stun<=0)startRide();}
  if(hero.jumped){game.audio.sfx('jump',{vol:.2,pitch:.7});emit(hero.x,hero.z+3,5,'#a6c0a5',.35);hero.jumped=false;}
  if(hero.landed){hero.landSquash=1;game.audio.sfx('land',{vol:.15});emit(hero.x,hero.z+3,8,'#b6b894',.4);hero.landed=false;}hero.landSquash=Math.max(0,hero.landSquash-dt*5);hero.gait+=dt*(3+Math.abs(hero.vx)*.05);
  if(game.input.down('attack')&&cut.start()){cuts++;game.audio.sfx('cloth',{vol:.5});}
  cut.update(dt);hero.cut=cut.active?1:0;
  const strike={x:hero.x+hero.facing*44,z:hero.z+8,w:108,h:94};
  cut.hits(world.enemies,e=>!e.dead&&E.overlapBox(strike,e),e=>{e.hp--;e.hit=.18;emit(e.x,e.z+22,15,'#dfb98a');game.audio.sfx('hit',{vol:.25});shake=settings.reduced?0:2;if(e.hp<=0){e.dead=true;emit(e.x,e.z+20,20,'#99d7be');game.audio.sfx('light',{vol:.4});}});
  if(cut.active||riding){for(const g of world.gates)if(!g.open&&Math.abs(g.x-hero.x)<115&&Math.abs(g.z-hero.z)<100){g.open=true;g.fade=0;emit(g.x,g.z+65,28,'#e5c78c');game.audio.sfx('cloth',{vol:1});cue('A neat cut. The stage opens.','PIP',2);}
   if(boss.phase==='exposed'&&(riding?.r.boss||hero.sealReady>0)&&Math.abs(hero.x-boss.x)<115&&Math.abs(hero.z+36-(boss.z+95))<80)hitBoss();}
  for(const g of world.gates)if(g.open)g.fade=Math.min(1,g.fade+dt*2);
  for(const e of world.enemies){if(e.dead)continue;e.hit=Math.max(0,e.hit-dt);e.alert=Math.abs(hero.x-e.x)<200;e.x+=e.dir*(e.alert?65:35)*dt;if(e.x>e.max){e.x=e.max;e.dir=-1;}if(e.x<e.min){e.x=e.min;e.dir=1;}if(hero.hurt<=0&&hero.dashing<=0&&E.overlapBox(hero,e)){if(hero.vz<0&&hero.z>e.z+24){e.hp=0;e.dead=true;hero.vz=280;emit(e.x,e.z+25,20,'#eed4a2');game.audio.sfx('stomp',{vol:.3});}else hurt(e.x);}}
  for(const c of world.coins)if(!c.got&&Math.hypot(c.x-hero.x,c.z-(hero.z+40))<48){c.got=true;lights++;game.audio.sfx('light',{pitch:1+(lights%6)*.08,vol:.45});emit(c.x,c.z,7,'#f3d59b',.5);}
  for(const k of world.keepsakes)if(k.revealed&&!k.found&&Math.hypot(k.x-hero.x,k.z-hero.z-42)<55){k.found=true;secrets++;hp=3;hero.maskKind=k.kind;emit(k.x,k.z,40,'#b4ddc5');game.audio.sfx('secret',{vol:.5});cue(`${k.name}. A small story, saved from the dark.`,'PIP',4);save();}
  for(const m of dropMasks){m.time-=dt;m.vz-=640*dt;m.x+=m.vx*dt;m.z+=m.vz*dt;const ground=world.level.groundBelow(m.x,m.z+20);if(ground!==null&&m.z<ground+22){m.z=ground+22;m.vz=Math.abs(m.vz)*.25;m.vx*=.6;}if(m.time<5.65&&Math.hypot(hero.x-m.x,hero.z+45-m.z)<46){m.time=0;hp=Math.min(3,hp+1);game.audio.sfx('heal',{vol:.3});emit(m.x,m.z,12,'#bedeb0');}}
  dropMasks=dropMasks.filter(m=>m.time>0&&m.z>-200);
  if(hero.z<-150)hurt(hero.x,true);
  for(let i=checkpoint+1;i<CP.length;i++)if(hero.x>CP[i].x-30&&hero.x<CP[i].x+110&&hero.z<CP[i].z+90){checkpoint=i;hp=3;hero.hurt=1;dropMasks=[];emit(CP[i].x,CP[i].z+70,30,'#ffdd90');game.audio.sfx('powerup',{vol:.3});cue('A light to return to. Your progress is saved.','PIP',3);save();}
  const nextSection=hero.x>=4448?2:hero.x>=2240?1:0;if(nextSection>section){section=nextSection;showCard(section);cue(section===1?'The garden hangs by a thread. So will we.':'That great clock swallowed every song. We must open it.','PIP',4);}
  updateBoss(dt);
  for(const p of projectiles){p.life-=dt;p.x+=p.vx*dt;if(p.kind==='note'){p.vz-=400*dt;p.z+=p.vz*dt;}if(p.z<20&&p.kind==='note'){p.life=0;emit(p.x,32,7,'#d8a489',.6);}if(hero.hurt<=0&&Math.abs(p.x-hero.x)<(p.kind==='wave'?29:25)&&Math.abs((hero.z+25)-p.z)<(p.kind==='wave'?34:43)){hurt(p.x);p.life=0;}}
  projectiles=projectiles.filter(p=>p.life>0);
  if(endingTimer>0){endingTimer-=dt;hero.vx*=Math.exp(-dt*5);hero.z=Math.max(32,hero.z-90*dt);if(endingTimer<=0)finish();}
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.vz-=220*dt;}particles=particles.filter(p=>p.life>0);for(const tr of trails)tr.life-=dt;trails=trails.filter(tr=>tr.life>0);
  const wanted=clamp(bossStarted?boss.x-780:hero.x-430+clamp(hero.vx*.16,-25,45),0,6080);cam=lerp(cam,wanted,1-Math.exp(-dt*(settings.reduced?12:4.3)));
  companion.x=lerp(companion.x,hero.x+hero.facing*58,1-Math.exp(-dt*4));companion.z=lerp(companion.z,hero.z+125+Math.sin(age*2)*12,1-Math.exp(-dt*4));
  hudClock+=dt;if(hudClock>.1){hudClock=0;updateHud();tutorials();}
 }
 function draw(g){
  g.save();const t=age,offset=mode==='title'?0:cam;A.stage(g,t,offset,section,boss?.hp===0);const sx=shake*Math.sin(t*97),sy=shake*.35*Math.cos(t*81);g.translate(sx,sy);
  if(mode==='title'){
   A.platform(g,{x:695,w:630,top:27,deep:170},0,t);A.platform(g,{x:1050,w:150,top:168,deep:120},0,t);
   A.thread(g,{a:{x:757,z:218},b:{x:1130,z:310},mid:412},0,t);
   A.lantern(g,1030,358,t,true,1.2);A.puppet(g,886,586,{facing:-1,vx:0,gait:0,maskKind:0},t,1.6);A.moth(g,810+Math.sin(t)*14,444+Math.cos(t*1.5)*14,t,false,1.45);
   for(let i=0;i<4;i++)A.star(g,849+i*76,326-Math.sin(i*.9)*58+Math.sin(t+i)*4,5,'#edd397',t*.2);
  }else{
   const worldTo=(x,z)=>[x-cam,620-z];
   A.scenery(g,section,cam,t,boss.hp===0);
   // Suspended props use stage depth, while physics stays on the x/z plane.
   for(const x of [445,1470,2040,3090,3980,4750,5540,6150,7100]){const q=x-cam;if(q>-70&&q<1350)A.lantern(g,q,210+(x%97),t,x<CP[checkpoint].x+500||boss.hp===0,.7);}
   if(section===2){g.save();g.globalAlpha=.18;for(let i=0;i<5;i++){const x=4970+i*520-cam;if(x>-150&&x<1500){A.line(g,[[x,180],[x+80,590]],'#a18b5b',17);A.line(g,[[x+15,240],[x+120,245]],'#c4af6a',6);}}g.restore();}
   for(const p of world.platforms)A.platform(g,p,cam,t);
   for(const p of world.moving)A.platform(g,{x:p.x-p.w/2,w:p.w,top:p.z+p.h,deep:22,moving:true},cam,t);
   for(const r of world.threads){if(r.b.x<cam-100||r.a.x>cam+1380)continue;if(r.revealed)A.thread(g,r,cam,t,riding?.r===r);else if(Math.abs(hero.x-r.a.x)<340){A.moth(g,r.a.x-cam,620-r.a.z,t,false,.65);}}
   if(boss.thread)A.thread(g,boss.thread,cam,t,riding?.r===boss.thread);
   for(const c of world.coins){if(c.got||c.x<cam-20||c.x>cam+1300)continue;const [x,y]=worldTo(c.x,c.z+Math.sin(t*2+c.id)*4);A.glow(g,x,y,19,'#f6d47528');A.star(g,x,y,6,'#f6d68f',t*.35+c.id);A.star(g,x,y,2,'#fff4c5',0);}
   for(const k of world.keepsakes){if(k.found)continue;if(k.revealed){const[x,y]=worldTo(k.x,k.z+Math.sin(t*2)*5);A.glow(g,x,y,45,'#b1dfb438');A.mask(g,x,y,k.kind,.75,t);}else{const[x,y]=worldTo(k.x,k.z+10);if(x>-60&&x<1340){g.globalAlpha=.5;A.moth(g,x,y,t,false,.6);g.globalAlpha=1;}}}
   CP.forEach((c,i)=>{if(c.x>cam-100&&c.x<cam+1400)A.checkpoint(g,c,cam,t,i<=checkpoint);});
   for(const gate of world.gates)A.gate(g,gate,cam,t);
   for(const e of world.enemies)if(!e.dead&&e.x>cam-60&&e.x<cam+1340)A.enemy(g,e,cam,t);
   if(boss.x>cam-200&&boss.x<cam+1500)A.boss(g,boss,cam,t);
   for(const p of projectiles){const[x,y]=worldTo(p.x,p.z);if(p.kind==='wave'){g.save();g.globalAlpha=.85;g.strokeStyle='#efc493';g.lineWidth=5;g.beginPath();g.ellipse(x,y,17,27,0,Math.PI,TAU);g.stroke();A.glow(g,x,y-10,40,'#ff9d6150');g.restore();}else{A.glow(g,x,y,30,'#f3ba8550');A.star(g,x,y,12,'#e6bd90',t*3);}}
   for(let i=1;i<trails.length;i++){const a=trails[i-1],b=trails[i];g.globalAlpha=b.life/.38;A.line(g,[worldTo(a.x,a.z),worldTo(b.x,b.z)],'#ffe4a5',4);}g.globalAlpha=1;
   const ground=world.level.groundBelow(hero.x,hero.z+2);if(ground!==null){const[x,y]=worldTo(hero.x,ground);A.ellipse(g,x,y+5,24,5,'#02121e70');}
   const[x,y]=worldTo(hero.x,hero.z);if(hero.hurt<=0||Math.sin(t*40)>-.35)A.puppet(g,x,y,hero,t);
   A.moth(g,...worldTo(companion.x,companion.z),t,reveal>0);
   if(reveal>0){g.save();g.globalAlpha=Math.min(.5,reveal/3);g.strokeStyle='#dce9b588';g.lineWidth=2;g.beginPath();g.ellipse(x,y-60,(3-reveal)*160+40,(3-reveal)*110+30,0,0,TAU);g.stroke();g.restore();}
   for(const m of dropMasks){const[x,y]=worldTo(m.x,m.z);g.globalAlpha=m.time<2?.45+Math.abs(Math.sin(t*9))*.55:1;A.mask(g,x,y,m.kind,.65,t*2);g.strokeStyle='#f3d28a';g.lineWidth=2;g.beginPath();g.arc(x,y,24,-Math.PI/2,-Math.PI/2+TAU*m.time/6);g.stroke();g.globalAlpha=1;}
   for(const p of particles){g.globalAlpha=clamp(p.life*1.4,0,1);const[x,y]=worldTo(p.x,p.z);A.star(g,x,y,p.size,p.color,t*3);}g.globalAlpha=1;
   if(boss.hp<=0){for(let i=0;i<26;i++){const xx=boss.x-cam+(i-13)*40,yy=620-((t*65+i*71)%640);A.star(g,xx,yy,2+i%3,'#f5d798',t+i);}}
  }
  g.restore();A.frame(g,t,mode==='title'?.65:cardTime>0&&!settings.reduced?1-Math.sin(Math.PI*clamp(cardTime/2.1,0,1))*.72:1);g._c=null;
 }
 function setPaused(value){paused=value;game.input.clear();game.audio._duck(value);if(!value&&mode==='play')$('screen').focus({preventScroll:true});}
 function togglePause(){if(mode!=='play')return;if($('pauseDialog').open){$('pauseDialog').close();setPaused(false);}else{setPaused(true);$('pauseDialog').showModal();$('resumeButton').focus();}}
 function openModal(id){if($(id).open)return;setPaused(mode==='play');$(id).showModal();}
 function applySettings(){
  filters.levels=settings.levels;filters.edge=settings.edge/100;filters.pixel=settings.pixel;filters.palette=settings.palette;filters.setMode(settings.look);game.reduceMotion=settings.reduced;
  document.body.classList.toggle('motion-reduced',settings.reduced);$('theatre').classList.toggle('touch-visible',settings.touch);$('touchControls').hidden=!(settings.touch&&mode==='play');
  game.audio.setVolume(settings.volume/100);game.audio.muted=settings.volume===0;game.audio._levels();$('audioButton').setAttribute('aria-label',settings.volume===0?'Unmute sound':'Mute sound');$('audioButton').style.opacity=settings.volume===0?'.4':'1';
  $('celLevelsRow').hidden=settings.look!=='cel';$('edgeRow').hidden=settings.look!=='cel';$('pixelSizeRow').hidden=settings.look!=='pixel';$('paletteRow').hidden=settings.look!=='pixel';
  write(PREF,settings);if(mode==='play'&&!paused&&!document.querySelector('dialog[open]'))$('screen').focus({preventScroll:true});if(mode==='play'&&!paused)setSong(bossStarted&&boss.hp>0?'boss':boss.hp<=0?'victory':'explore');
 }
 function syncSettings(){for(const [id,key]of [['celLevels','levels'],['edgeStrength','edge'],['pixelSize','pixel'],['palette','palette'],['volume','volume']]){$(id).value=settings[key];$(id).previousElementSibling.textContent=settings[key]+(['edge','volume'].includes(key)?'%':'');}for(const[id,key]of [['musicToggle','music'],['motionToggle','reduced'],['assistToggle','assist'],['touchToggle','touch']])$(id).checked=settings[key];document.querySelectorAll('input[name="look"]').forEach(n=>n.checked=n.value===settings.look);applySettings();}
 $('beginButton').onclick=()=>reset(false);$('continueButton').onclick=()=>reset(true);$('replayButton').onclick=()=>reset(false);$('endTitleButton').onclick=title;
 $('settingsButton').onclick=()=>openModal('settingsDialog');$('helpButton').onclick=()=>openModal('helpDialog');$('helpDone').onclick=()=>$('helpDialog').close();$('pauseButton').onclick=togglePause;$('pauseFooter').onclick=togglePause;
 $('resumeButton').onclick=()=>{$('pauseDialog').close();setPaused(false);};$('retryButton').onclick=()=>{$('pauseDialog').close();setPaused(false);respawn(false);};$('titleButton').onclick=()=>{save();$('pauseDialog').close();title();};$('pauseSettings').onclick=()=>openModal('settingsDialog');
 $('audioButton').onclick=()=>{settings.volume=settings.volume===0?60:0;syncSettings();};
 $('fullButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('theatre').requestFullscreen();game.screen.resize();}catch{cue('Full screen is not available here.','STAGE NOTE',3);}};
 for(const id of ['helpDialog','settingsDialog'])$(id).addEventListener('close',()=>{setPaused($('pauseDialog').open);applySettings();});
 $('pauseDialog').addEventListener('cancel',()=>setPaused(false));
 for(const[id,key]of [['celLevels','levels'],['edgeStrength','edge'],['pixelSize','pixel'],['palette','palette'],['volume','volume']])$(id).addEventListener('input',e=>{settings[key]=Number(e.target.value);e.target.previousElementSibling.textContent=settings[key]+(['edge','volume'].includes(key)?'%':'');applySettings();});
 for(const[id,key]of [['musicToggle','music'],['motionToggle','reduced'],['assistToggle','assist'],['touchToggle','touch']])$(id).addEventListener('change',e=>{settings[key]=e.target.checked;if(key==='music')lastSong=null;applySettings();});
 document.querySelectorAll('input[name="look"]').forEach(n=>n.addEventListener('change',()=>{settings.look=n.value;applySettings();}));
 document.querySelectorAll('[data-key]').forEach(b=>{const code=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('held');game.input.press(code);});const up=()=>{b.classList.remove('held');game.input.release(code);};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play'&&!paused){save();togglePause();}});
 window.addEventListener('blur',()=>{if(mode==='play'&&!paused)togglePause();});window.addEventListener('beforeunload',()=>save());
 window.addEventListener('resize',()=>game.screen.resize());
 // Diagnostic state is read-only. It is also used by automated integration checks.
 const status=()=>({title:'The Lantern Seam',mode,paused,scene:sections[section][0],player:hero?{x:hero.x,z:hero.z,vx:hero.vx,vz:hero.vz,onGround:hero.onGround,hurt:hero.hurt}:null,checkpoint,hp,lights,totalLights:world?.coins.length||0,keepsakes:secrets,deaths,time:playTime,riding:riding?{thread:riding.r.id,u:riding.u}:null,boss:boss?{hp:boss.hp,phase:boss.phase,timer:boss.timer}:null,filter:{mode:filters.mode,backend:filters.backend,state:filters.state,error:filters.error||null},settings:{...settings},errors:game.errors,renderMs:game.stats.renderMs});
 window.LanternSeam=Object.freeze({status,start:()=>reset(false),continue:()=>reset(true),pause:()=>{if(!paused)togglePause();},resume:()=>{if($('pauseDialog').open)$('pauseDialog').close();setPaused(false);},restartCheckpoint:()=>respawn(false),setVisualStyle:style=>{if(!['original','cel','pixel'].includes(style))throw new Error('Use original, cel, or pixel.');settings.look=style;syncSettings();},controls:{press:code=>game.input.press(code),release:code=>game.input.release(code)}});
 if(document.modelContext?.registerTool){const tools=[{name:'read_game_state',title:'Read game state',description:'Read the level, health, collectibles, boss phase, and current visual style.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>status()},{name:'set_game_visual_style',title:'Set game visual style',description:'Change the stage visual style and save the preference on this device.',inputSchema:{type:'object',properties:{style:{type:'string',enum:['original','cel','pixel']}},required:['style'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input.style!=='string'||Object.keys(input).some(k=>k!=='style'))throw new Error('A valid style is required.');window.LanternSeam.setVisualStyle(input.style);return status().filter;}}];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}
 world=makeWorld();boss={x:6720,z:60,hp:3,phase:'sleep',timer:0};syncSettings();$('continueButton').hidden=!saveAvailable;game.start({update,draw:r=>r.overlay(draw)});
})();
