/* Dust & Volt — complete single-player level. Built on my-3D2dge Agent Edition. */
(() => {
  'use strict';
  const E=My3D2dge,A=DustArt,p=E.px,W=640,H=360;
  const $=id=>document.getElementById(id), clamp=E.clamp, mix=E.lerp;
  const input={...E.Input.DEFAULT,
    left:['KeyA','Pad14'],right:['KeyD','Pad15'],up:['KeyW','Pad12'],down:['KeyS','Pad13'],
    fire:['Mouse0','KeyJ','KeyZ','Pad7'],roll:['Space','Pad0'],jump:['ShiftLeft','ShiftRight','Pad1'],
    tether:['KeyQ','Mouse2','Pad2'],pulse:['KeyE','Pad3'],surge:['KeyF','Pad5'],
    aimLeft:['ArrowLeft'],aimRight:['ArrowRight'],aimUp:['ArrowUp'],aimDown:['ArrowDown'],mute:['KeyM']};
  const game=new E.Game({canvas:'screen',res:[W,H],fitCanvas:true,view:'overhead',views:['overhead'],input,bg:'#10232b'});
  game.cam.smooth=0;game.focus(W/2,H/2);game.pauseOverlay=false;
  const saved=E.store.get('dust-volt-settings',{});
  let difficulty=saved.difficulty==='trail'?'trail':'arcade',reduced=saved.reduced??game.reduceMotion;
  let muted=!!saved.muted,aimMode='mouse',state=null,titleTime=0,modal='',manualBack='',lastFocus=null;
  let lastPause=false,uiClock=0,uid=0,checkpoint=null,continueCount=0,pendingContinue=false;
  const touch=matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch-device',touch);
  game.reduceMotion=reduced;$('motion-toggle').checked=reduced;
  document.body.classList.toggle('motion-reduced',reduced);
  game.audio.setVolume(.6);game.audio.musicVolume=.42;game.audio.sfxVolume=.72;game.audio.mute(muted);
  function settings(){E.store.set('dust-volt-settings',{difficulty,reduced,muted});}
  function soundUI(){$('sound-button').innerHTML='SOUND <span>'+(muted?'OFF':'ON')+'</span>';$('sound-button').setAttribute('aria-label',muted?'Enable sound':'Mute sound');}
  function setDifficulty(d){difficulty=d;document.querySelectorAll('[data-difficulty]').forEach(b=>{const on=b.dataset.difficulty===d;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});$('difficulty-note').textContent=d==='trail'?'More health. Slower threats.':'The full challenge.';bestUI();settings();}
  function bestUI(){const score=E.store.get('dust-volt-best-'+difficulty,0);$('best-score').textContent='LOCAL BEST — '+String(score).padStart(6,'0');}
  function announce(s){$('live-status').textContent=s;}
  const SFX={
    coil:[{wave:'pulse12',freq:970,to:240,dur:.095,vol:.2},{wave:'noise',freq:4400,to:1200,dur:.045,vol:.08}],
    intercept:[{wave:'triangle',freq:1450,to:2450,dur:.13,vol:.25},{wave:'noise',freq:6500,dur:.045,vol:.1}],
    tether:{wave:'saw',freq:240,to:1200,dur:.24,vol:.17},
    warning:{wave:'triangle',freq:510,arp:[0,7],step:.10,dur:.22,vol:.22},
    heavy:{wave:'noise',freq:800,to:130,dur:.22,vol:.28},
    shield:{wave:'triangle',freq:220,to:130,dur:.09,vol:.21},
    ready:{wave:'pulse',freq:740,arp:[0,4,7,12],step:.08,dur:.4,vol:.21},
    pulse:[{wave:'noise',freq:1200,to:60,dur:.7,vol:.3},{wave:'sine',freq:120,to:30,dur:.6,vol:.4}],
    engine:{wave:'noise',freq:150,to:70,dur:.7,vol:.20},
    ricochet:{wave:'triangle',freq:820,to:400,dur:.06,vol:.09}
  };
  for(const [n,v]of Object.entries(SFX))game.audio.define(n,v);
  function sfx(name,vol=1){game.audio.sfx(name,{vol});}
  function pop(x,y,text,color='#f4d498'){if(state)state.floats.push({x,y,text,color,life:1,age:0});}
  function burst(x,y,size=1,major=false){
    game.particles.explosion(x,y,0,size,{freeze:major,flash:major&&!reduced,sound:false});
    if(major){game.shake(reduced?0:4);sfx('explode',.75);}else sfx('hit',.32);
  }
  function message(title,line='',duration=3.5){if(!state)return;state.message={title,line,time:duration,total:duration};announce(title+'. '+line);}
  function radio(text,duration=5){if(!state)return;state.radio={text,time:duration};announce(text);}
  const places=[{x:89,y:175,s:1.08},{x:174,y:211,s:1.37},{x:275,y:180,s:1.14},{x:394,y:186,s:1.18},{x:486,y:215,s:1.4},{x:558,y:177,s:1.1},{x:318,y:231,s:1.42},{x:78,y:235,s:1.45},{x:565,y:242,s:1.45}];
  const events=(rows)=>rows.map(([at,kind,place])=>({at,kind,place}));
  const STAGES=[
    {name:'DEPOT APPROACH',label:'Clear the depot approach',events:events([[1,'gunner',2],[3.3,'gunner',3],[7,'gunner',0],[7,'gunner',5],[7,'gunner',1],[12,'drone',3],[12,'gunner',4],[16,'gunner',2],[16,'gunner',7],[16,'gunner',8],[16,'gunner',0],[22,'turret',6],[22,'gunner',1],[22,'gunner',5],[27,'drone',3],[27,'gunner',7],[32,'gunner',0],[32,'gunner',5],[32,'gunner',4]])},
    {name:'SWITCHYARD CROSSFIRE',label:'Break the switchyard defense',events:events([[.6,'heavy',6],[.6,'gunner',0],[.6,'sniper',5],[7,'drone',2],[7,'gunner',4],[7,'sniper',0],[13,'gunner',7],[13,'heavy',3],[13,'drone',5],[13,'gunner',1],[20,'gunner',8],[20,'turret',2],[20,'sniper',3],[20,'gunner',4],[27,'drone',1],[27,'heavy',6],[27,'gunner',0],[27,'drone',5],[35,'sniper',0],[35,'sniper',5],[35,'gunner',7]])},
    {name:'THE GATEBREAKER',label:'Disable the gate defense',boss:true,mini:true},
    {name:'THE LAST TRAIN',label:'Keep the water train moving',events:events([[1,'gunner',0],[1,'gunner',5],[1,'drone',3],[7,'heavy',1],[7,'sniper',5],[7,'gunner',7],[13,'turret',4],[13,'drone',2],[13,'heavy',6],[13,'gunner',0],[20,'sniper',3],[20,'drone',5],[20,'gunner',4],[20,'heavy',8],[27,'gunner',2],[27,'gunner',5],[27,'drone',1],[27,'turret',6],[34,'heavy',1],[34,'drone',5],[34,'sniper',3],[38,'gunner',7],[38,'gunner',8]])},
    {name:'THE IRON TITHE',label:'Break the collection engine',boss:true,mini:false}
  ];
  function newState(startStage=0,keep=null){
    uid=0;
    return {mode:'play',age:0,totalTime:keep?keep.totalTime:0,stage:startStage,stageAge:0,eventIndex:0,clearTimer:0,transition:2.8,
      enemies:[],bullets:[],hazards:[],props:[],pickups:[],traces:[],floats:[],tethers:[],rings:[],boss:null,
      score:keep?Math.max(0,keep.score-500):0,chain:0,chainTime:0,multiplier:1,charge:keep?35:0,
      stats:keep?{...keep.stats,continues:continueCount}:{kills:0,shots:0,hits:0,intercepts:0,damage:0,maxChain:0,pulses:0,surges:0,continues:0,props:0},
      player:{x:320,y:332,z:0,vz:0,jumps:0,hp:difficulty==='trail'?9:6,maxHp:difficulty==='trail'?9:6,roll:0,rollCool:0,rollDir:1,hurt:1.5,tether:0,pulseCool:0,pulses:2,surge:0,recoil:0,gun:'coil',gunTime:0,shotCool:0,face:1,moving:false},
      aim:{x:320,y:175},random:E.rng(0xD057+startStage*91),message:null,radio:null,endAge:0,finish:false,
      usedTether:false,usedJump:false,usedIntercept:false,shieldTip:false,surgeTip:false,phaseLog:[],stageLog:[],checkSaved:false};
  }
  function setupStage(index){
    const s=state,stage=STAGES[index];s.stage=index;s.stageAge=0;s.eventIndex=0;s.clearTimer=0;s.transition=2.6;
    s.enemies=[];s.bullets=[];s.hazards=[];s.boss=null;s.pickups=[];s.props=[];
    s.stageLog.push({stage:index,at:Math.round(s.totalTime*100)/100});
    const propData=index===0?[[102,252,'supply'],[226,234,'barrel'],[455,251,'crate'],[549,240,'barrel']]:index===1?[[108,248,'barrel'],[245,253,'supply'],[416,246,'barrel'],[546,267,'crate']]:index===3?[[80,255,'barrel'],[203,246,'supply'],[455,243,'barrel'],[560,270,'crate']]:[[111,252,'supply'],[532,253,'barrel']];
    for(const [x,y,kind]of propData)s.props.push({x,y,kind,hp:kind==='barrel'?5:4,max:kind==='barrel'?5:4,dead:false,hit:0});
    if(stage.boss){
      const hp=stage.mini?155:430;
      s.boss={id:++uid,x:320,y:stage.mini?187:181,targetY:stage.mini?204:211,mini:stage.mini,max:hp,hp,phase:0,age:0,cycle:0,action:'arrival',actionTime:2.7,wind:0,expose:0,stun:0,hit:0,phaseShield:0,patternStep:0,attackClock:0,spawnClock:9};
      game.audio.music(A.music.boss);sfx('engine');
      message(stage.mini?'GATEBREAKER':'THE IRON TITHE',stage.mini?'A moving wall of bad intentions.':'COLLECTION ENGINE  /  THREAT CLASS 03',3.6);
      radio(stage.mini?'MARA: That machine guards the gate. Tether it, then fire into the bright core.':'MARA: The collector is here. Read the ground. Take the shot when its core opens.',7);
    }else{
      game.audio.music(A.music.level);message(String(index+1).padStart(2,'0')+' / '+stage.name,stage.label.toUpperCase(),2.9);
      if(index===0)radio('MARA: Keep the line open, Rook. Amber rounds can be shot. Space rolls through danger.',8);
      if(index===1)radio('ROOK: Armor in the yard. Q sends the arc tether. A stunned target cannot return fire.',7);
      if(index===3)radio('MARA: The train is moving. Supplies restored. This is our last stand.',6);
    }
    announce(stage.name);
  }
  function startRun(useCheckpoint=false){
    game.audio.sfx('confirm');
    if(useCheckpoint&&checkpoint){pendingContinue=true;continueCount++;}else{pendingContinue=false;checkpoint=null;continueCount=0;}
    closeModal();game.input.clear();game.go('play',null,{fade:.18});
  }
  function spawnEnemy(kind,place){
    const s=state,l=places[place%places.length];
    const health={gunner:4,sniper:5,heavy:12,drone:5,turret:10};
    const e={id:++uid,kind,x:l.x+(s.random()-.5)*12,y:l.y,homeY:l.y,targetX:l.x,scale:l.s,hp:health[kind],max:health[kind],age:0,hit:0,stun:0,wind:0,fire:1.8+s.random()*.7,vx:kind==='drone'?(place%2?-28:28):0,moving:true,flip:place%2===1,dead:false,entry:.65,tx:0,ty:0};
    if(kind==='drone'){e.y-=24;e.homeY=e.y;e.scale=1;}
    s.enemies.push(e);game.particles.dust(e.x,e.y+15,0,5);
  }
  function charge(n){const old=state.charge;state.charge=clamp(state.charge+n,0,100);if(old<100&&state.charge===100){sfx('ready');radio('SURGE READY: Press F for six seconds of charged fire and a shield.',5);state.surgeTip=true;}}
  function addScore(n,x,y){const s=state;s.score+=Math.round(n*s.multiplier);if(x!==undefined)pop(x,y,'+'+Math.round(n*s.multiplier));}
  function spawnPickup(x,y,kind){state.pickups.push({id:++uid,x:clamp(x,38,602),y:clamp(y,112,260),kind,age:0,life:15});}
  function collect(o){
    const s=state,h=s.player;o.dead=true;sfx('pickup');
    if(o.kind==='heal'){h.hp=Math.min(h.maxHp,h.hp+2);pop(o.x,o.y,'REPAIR +2','#a4f3d3');sfx('heal');}
    else if(o.kind==='charge'){charge(25);pop(o.x,o.y,'CHARGE +25','#ffe1a1');}
    else{h.gun=o.kind;h.gunTime=16;pop(o.x,o.y,o.kind.toUpperCase()+' ONLINE','#a6edda');sfx('powerup',.6);}
    addScore(100);
  }
  function killEnemy(e,via='shot'){
    if(e.dead)return;e.dead=true;const s=state;
    s.stats.kills++;s.chain++;s.chainTime=4.5;s.multiplier=1+Math.min(3,Math.floor(s.chain/6));s.stats.maxChain=Math.max(s.stats.maxChain,s.chain);
    addScore(e.kind==='heavy'||e.kind==='turret'?250:e.kind==='drone'?175:100,e.x,e.y-24);charge(via==='barrel'?4:1.8);
    burst(e.x,e.y,e.kind==='heavy'?.8:.5);game.particles.bits(e.x,e.y,2,8,['#a8b4a0','#bb7845','#1d3946']);
    if(s.stats.kills%7===0)spawnPickup(e.x,e.y,s.stats.kills%14===0?'scatter':'rapid');
    if(s.stats.kills%13===0)spawnPickup(e.x+20,e.y,'heal');
  }
  function enemyDamage(e,n,via='shot'){
    if(e.dead)return;
    if(e.kind==='heavy'&&e.stun<=0&&via==='shot'){n*=.42;sfx('shield',.5);if(!state.shieldTip){state.shieldTip=true;radio('ARMOR: Use Q to stun a heavy guard. Its front plate blocks part of your fire.',5);}}
    e.hp-=n;e.hit=.09;game.particles.sparks(e.x,e.y-9,0,3,0);
    if(e.hp<=0)killEnemy(e,via);
  }
  function breakProp(o){
    if(o.dead)return;o.dead=true;state.stats.props++;addScore(75,o.x,o.y-20);
    game.particles.bits(o.x,o.y,1,16,['#996739','#ce9a56','#4f4033']);
    if(o.kind==='barrel'){
      burst(o.x,o.y,1,true);state.rings.push({x:o.x,y:o.y,r:0,max:78,life:.4,color:'#f5b960'});
      state.enemies.forEach(e=>{if(Math.hypot(e.x-o.x,e.y-o.y)<100)enemyDamage(e,15,'barrel');});
      state.bullets.forEach(b=>{const q=bulletPoint(b);if(Math.hypot(q.x-o.x,q.y-o.y)<105)b.dead=true;});
      if(state.boss&&Math.abs(state.boss.x-o.x)<180)bossDamage(9,false,'barrel');
      spawnPickup(o.x,o.y,'charge');
    }else{burst(o.x,o.y,.45);spawnPickup(o.x,o.y,o.kind==='supply'?'heal':(state.stage%2?'rapid':'scatter'));}
  }
  function bulletPoint(b){
    const u=clamp(b.age/b.dur,0,1),v=u*u*.25+u*.75;
    return{x:mix(b.sx,b.tx,v),y:mix(b.sy,b.ty-37,v)-(b.kind==='mortar'?Math.sin(u*Math.PI)*55:0),r:b.kind==='mortar'?4:2.5+u*4.5,u};
  }
  function enemyShot(sx,sy,tx,ty,kind='round',dur=1.7){
    const s=state;s.bullets.push({id:++uid,sx,sy,tx:clamp(tx,20,620),ty:clamp(ty,286,338),kind,dur:dur*(difficulty==='trail'?1.22:1),age:0,dead:false});
    sfx(kind==='mortar'?'heavy':'shoot',.28);
  }
  function hurtPlayer(n=1){
    const s=state,h=s.player;if(s.mode!=='play'||h.hurt>0||h.roll>0||h.surge>0)return false;
    h.hp-=n;h.hurt=1.65;s.stats.damage+=n;s.chain=0;s.multiplier=1;s.chainTime=0;
    if(!reduced)game.flash('#b83f36',.13);game.shake(reduced?0:4);game.freeze(.055);sfx('hurt');
    game.particles.sparks(h.x,h.y-28-h.z,0,10,0);
    if(h.hp<=0){s.mode='dying';s.endAge=0;h.hp=0;h.roll=0;game.audio.music(null);sfx('die');announce('Rook is down. You can retry.');}
    return true;
  }
  function tryRoll(){
    const h=state.player;if(h.rollCool>0||h.roll>0)return;
    const m=game.input.move();h.rollDir=Math.abs(m[0])>.1?Math.sign(m[0]):(h.x>320?-1:1);h.face=h.rollDir;h.roll=.43;h.rollCool=.82;
    h.z=0;h.vz=0;h.jumps=0;h.recoil=0;game.particles.dust(h.x,h.y,0,10);sfx('whoosh');
  }
  function tryJump(){
    const h=state.player;if(h.roll>0||h.jumps>=2)return;h.vz=h.jumps===0?216:194;h.jumps++;state.usedJump=true;
    sfx(h.jumps===1?'jump':'jump2',.75);game.particles.dust(h.x,h.y,0,6);
  }
  function tryTether(){
    const s=state,h=s.player;if(h.tether>0||h.roll>0)return;
    h.tether=4.4;s.usedTether=true;let tx=s.aim.x,ty=s.aim.y,hit=false;
    const candidates=s.enemies.filter(e=>!e.dead&&Math.hypot(e.x-tx,e.y-ty)<42).sort((a,b)=>Math.hypot(a.x-tx,a.y-ty)-Math.hypot(b.x-tx,b.y-ty));
    if(candidates.length){const e=candidates[0];e.stun=3;e.wind=0;e.fire=2;tx=e.x;ty=e.y;hit=true;pop(tx,ty-26,'BOUND','#90eee0');charge(3);}
    else if(s.boss&&bossContains(tx,ty)){s.boss.stun=1.35;s.boss.expose=2.4;s.boss.wind=0;tx=s.boss.x;ty=s.boss.y-34*(s.boss.mini?.68:1);hit=true;pop(tx,ty-26,'CORE OPEN','#91f1e1');}
    s.tethers.push({sx:h.x+16*h.face,sy:h.y-71-h.z,tx,ty,age:0,life:hit?.65:.3,hit});sfx('tether');
    if(!hit)pop(tx,ty,'NO LOCK','#8faeac');
  }
  function tryPulse(){
    const s=state,h=s.player;if(h.pulses<=0||h.pulseCool>0)return;h.pulses--;h.pulseCool=1;h.hurt=Math.max(h.hurt,1.1);s.stats.pulses++;
    let intercepted=0;s.bullets.forEach(b=>{if(!b.dead){b.dead=true;intercepted++;}});s.hazards=[];
    s.enemies.forEach(e=>enemyDamage(e,18,'pulse'));if(s.boss)bossDamage(s.boss.mini?22:28,false,'pulse');
    s.rings.push({x:h.x,y:h.y-25,r:0,max:700,life:.85,color:'#aff6dc'});
    game.particles.ring(h.x,h.y,15,290,'#90f2d2');game.shake(reduced?0:5);sfx('pulse');
    message('PULSE DISCHARGED',intercepted+' INCOMING ROUNDS CLEARED',1.6);
  }
  function trySurge(){
    const s=state,h=s.player;if(s.charge<100||h.surge>0)return;s.charge=0;h.surge=6;h.shotCool=0;s.stats.surges++;
    sfx('powerup');s.rings.push({x:h.x,y:h.y-40,r:0,max:110,life:.55,color:'#fbe7aa'});message('SURGE ONLINE','CHARGED FIRE / SHIELD ACTIVE',2);
  }
  function bossContains(x,y){const b=state.boss;if(!b||b.hp<=0)return false;const z=b.mini?.68:1;return Math.abs(x-b.x)<113*z&&y>b.y-108*z&&y<b.y+59*z;}
  function bossDamage(n,core=false,via='shot'){
    const s=state,b=s.boss;if(!b||b.hp<=0||b.action==='arrival'||b.phaseShield>0)return;
    const open=b.expose>0||b.stun>0||b.phase>=2;
    if(via==='shot')n*=core&&open?2.4:.45;
    b.hp-=n;b.hit=.09;
    if(via==='shot'){game.particles.sparks(b.x+(s.random()-.5)*24,b.y-34,0,4,0);if(core&&open)sfx('hit',.22);else sfx('shield',.2);}
    if(b.hp<=0){
      b.hp=0;s.phaseLog.push({boss:b.mini?'gatebreaker':'iron-tithe',event:'destroyed',at:s.totalTime});
      s.bullets=[];s.hazards=[];s.enemies.forEach(e=>{if(!e.dead)killEnemy(e,'boss');});
      s.mode=b.mini?'mini-down':'victory';s.endAge=0;addScore(b.mini?2500:6000);s.player.hurt=5;
      game.audio.music(null);burst(b.x,b.y-20,2,true);sfx('boom');message(b.mini?'GATEBREAKER DOWN':'COLLECTION CANCELLED',b.mini?'THE TRACK IS CLEAR':'COPPERLINE JUNCTION IS FREE',3.8);
      announce(b.mini?'Gatebreaker defeated. Checkpoint reached.':'Iron Tithe defeated. Level complete.');return;
    }
    if(!b.mini){const next=b.hp/b.max<=.33?2:b.hp/b.max<=.67?1:0;
      if(next>b.phase){b.phase=next;b.phaseShield=1.35;b.action='recover';b.actionTime=2;b.expose=2;b.patternStep=0;s.bullets=[];s.hazards=[];
        burst(b.x+(next===1?-65:65),b.y-48,1.2,true);sfx('heavy');
        message(next===1?'ARMOR FRACTURED':'CORE UNSTABLE',next===1?'PHASE 02 / MORTAR BATTERIES ACTIVE':'PHASE 03 / FINISH THE FIGHT',2.4);
        s.phaseLog.push({boss:'iron-tithe',phase:next,at:s.totalTime});
      }
    }
  }
  function shoot(){
    const s=state,h=s.player;if(h.roll>0||h.z>5||h.shotCool>0)return;
    const surge=h.surge>0,rapid=h.gun==='rapid',scatter=h.gun==='scatter';
    h.shotCool=surge?.055:rapid?.068:scatter?.22:.115;h.recoil=.075;h.face=s.aim.x<h.x?-1:1;
    const radius=surge?14:scatter?25:10,damage=surge?2.1:scatter?2.8:1;let hit=false;
    s.stats.shots++;s.traces.push({sx:h.x+h.face*23,sy:h.y-80-h.z,tx:s.aim.x,ty:s.aim.y,age:0,life:.10,surge,scatter});
    sfx(surge?'laser':'coil',surge?.5:.55);
    for(const b of s.bullets){if(b.dead||b.kind!=='round')continue;const q=bulletPoint(b);
      if(Math.hypot(q.x-s.aim.x,q.y-s.aim.y)<radius+q.r+4){b.dead=true;s.stats.intercepts++;charge(surge?0:9);addScore(25);game.particles.sparks(q.x,q.y,0,9,0);sfx('intercept');pop(q.x,q.y-10,'+9V','#b7ffe4');hit=true;
        if(!s.usedIntercept){s.usedIntercept=true;radio('GOOD INTERCEPT: Enemy fire builds your charge. Fill the meter, then press F.',5);}
        if(!surge&&!scatter)break;
      }
    }
    if(!hit||surge||scatter){
      for(const o of s.pickups){if(!o.dead&&Math.hypot(o.x-s.aim.x,o.y-s.aim.y)<radius+16){collect(o);hit=true;if(!surge&&!scatter)break;}}
    }
    if(!hit||surge||scatter){
      if(bossContains(s.aim.x,s.aim.y)){const b=s.boss,z=b.mini?.68:1,core=Math.hypot(s.aim.x-b.x,s.aim.y-(b.y-34*z))<21*z+radius*.4;bossDamage(damage,core);hit=true;}
      else{
        const target=s.enemies.filter(e=>!e.dead&&e.entry<=0&&Math.abs(e.x-s.aim.x)<(e.kind==='drone'?26:16*e.scale)+radius&&Math.abs(e.y-s.aim.y)<(e.kind==='turret'?23:19*e.scale)+radius).sort((a,b)=>b.y-a.y);
        if(target.length){for(const e of target){enemyDamage(e,damage);hit=true;if(!scatter&&!surge)break;}}
      }
    }
    if(!hit||scatter){
      const target=s.props.find(o=>!o.dead&&Math.abs(o.x-s.aim.x)<19+radius&&Math.abs(o.y-s.aim.y)<21+radius);
      if(target){target.hp-=damage;target.hit=.1;game.particles.bits(target.x,target.y,0,3,['#b88958','#4c5750']);if(target.hp<=0)breakProp(target);hit=true;}
    }
    if(hit)s.stats.hits++;else if(s.random()<.17){game.particles.dust(s.aim.x,s.aim.y,0,2);sfx('ricochet',.25);}
  }
  function updatePlayer(dt){
    const s=state,h=s.player,inp=game.input;
    for(const k of ['rollCool','hurt','tether','pulseCool','recoil','shotCool'])h[k]=Math.max(0,h[k]-dt);
    if(h.surge>0)h.surge=Math.max(0,h.surge-dt);
    if(h.gunTime>0){h.gunTime-=dt;if(h.gunTime<=0){h.gun='coil';pop(h.x,h.y-94,'COIL READY','#aecfc7');}}
    if(inp.buffered('roll')){inp.consume('roll');tryRoll();}
    if(inp.buffered('jump')){inp.consume('jump');tryJump();}
    if(inp.pressed('tether'))tryTether();if(inp.pressed('pulse'))tryPulse();if(inp.pressed('surge'))trySurge();
    const m=inp.move(),firing=inp.down('fire'),speed=firing&&h.z<=0?51:146;
    h.moving=Math.abs(m[0])+Math.abs(m[1])>.05;
    if(h.roll>0){h.roll=Math.max(0,h.roll-dt);h.x+=h.rollDir*315*dt;h.y+=m[1]*70*dt;if(Math.floor(s.age*40)%4===0)game.particles.dust(h.x,h.y,0,1);}
    else{h.x+=m[0]*speed*dt;h.y+=m[1]*speed*.56*dt;if(Math.abs(m[0])>.1&&!firing)h.face=Math.sign(m[0]);}
    h.x=clamp(h.x,28,W-28);h.y=clamp(h.y,291,335);
    if(h.z>0||h.vz>0){h.vz-=650*dt;h.z+=h.vz*dt;if(h.z<=0){h.z=0;h.vz=0;h.jumps=0;sfx('land',.55);game.particles.dust(h.x,h.y,0,5);}}
    if(firing)shoot();
  }
  function updateAim(dt){
    const inp=game.input,s=state;let ax=(inp.down('aimRight')?1:0)-(inp.down('aimLeft')?1:0),ay=(inp.down('aimDown')?1:0)-(inp.down('aimUp')?1:0);
    if(ax||ay){aimMode='keys';s.aim.x+=ax*235*dt;s.aim.y+=ay*235*dt;}
    const pa=inp.padAim||[0,0];if(Math.hypot(...pa)>.1){aimMode='pad';s.aim.x+=pa[0]*310*dt;s.aim.y+=pa[1]*260*dt;}
    if(aimMode==='mouse'){const mp=game.mouseGround();if(mp){s.aim.x=mp[0];s.aim.y=mp[1];}}
    s.aim.x=clamp(s.aim.x,10,630);s.aim.y=clamp(s.aim.y,50,317);
  }
  function updateEnemies(dt){
    const s=state,h=s.player;
    for(const e of s.enemies){
      if(e.dead)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.entry=Math.max(0,e.entry-dt);
      e.moving=e.entry>0;e.stun=Math.max(0,e.stun-dt);if(e.entry>0)continue;if(e.stun>0)continue;
      if(e.kind==='drone'){e.x+=e.vx*dt;if(e.x<45||e.x>595)e.vx=-e.vx;e.y=e.homeY+Math.sin(e.age*1.3)*12;e.moving=true;}
      if(e.wind>0){e.wind-=dt;if(e.wind<=0){
        if(e.kind==='turret'||e.kind==='heavy')for(let i=-1;i<=1;i++)enemyShot(e.x,e.y-4,e.tx+i*30,e.ty,'round',1.7+Math.abs(i)*.12);
        else if(e.kind==='drone')enemyShot(e.x,e.y,e.tx,e.ty,'mortar',2.0);
        else enemyShot(e.x,e.y-10,e.tx,e.ty,e.kind==='sniper'?'piercer':'round',e.kind==='sniper'?1.15:1.9);
        e.fire=(e.kind==='sniper'?3.3:e.kind==='drone'?3.6:e.kind==='heavy'?3:2.8)+s.random()*.7;
      }}else {e.fire-=dt;if(e.fire<=0){e.wind=e.kind==='sniper'?.85:.55;e.tx=h.x+(s.random()-.5)*35;e.ty=h.y;if(e.kind==='sniper')sfx('warning',.25);}}
    }
    E.prune(s.enemies,e=>e.dead);
  }
  function startBossPattern(b){
    const patterns=b.mini?['fan','sweep','mortar']:b.phase===0?['fan','sweep','fan','mortar']:b.phase===1?['mortar','fan','sweep','cross']:['cross','sweep','mortar','fan'];
    b.action=patterns[b.cycle++%patterns.length];b.actionTime=b.action==='fan'?3.4:b.action==='sweep'?3.6:b.action==='mortar'?3.5:3.8;
    b.patternStep=0;b.attackClock=.7;b.wind=.7;b.expose=0;
    if(b.action==='sweep')radio('LOW SWEEP: Shift jumps over the shockwave. A second press keeps you in the air.',3.2);
    else if(b.action==='mortar')radio('MORTAR LOCK: Leave the red impact marks.',2.7);
    else if(b.action==='cross')radio('CROSSFIRE: Shoot amber rounds. Move out of red lanes.',2.7);
  }
  function updateBoss(dt){
    const s=state,b=s.boss,h=s.player;if(!b||b.hp<=0)return;
    b.age+=dt;b.hit=Math.max(0,b.hit-dt);b.phaseShield=Math.max(0,b.phaseShield-dt);b.expose=Math.max(0,b.expose-dt);
    b.y=E.approach(b.y,b.targetY,dt*9);
    if(b.stun>0){b.stun=Math.max(0,b.stun-dt);b.expose=Math.max(b.expose,1.5);return;}
    b.x=320+Math.sin(b.age*.48)*(b.mini?50:34);
    b.actionTime-=dt;b.wind=Math.max(0,b.wind-dt);
    if(b.action==='arrival'){if(b.actionTime<=0){b.action='recover';b.actionTime=2;b.expose=2;}return;}
    if(b.action==='recover'){b.expose=Math.max(b.expose,b.actionTime);if(b.actionTime<=0)startBossPattern(b);return;}
    if(b.actionTime<=0){b.action='recover';b.actionTime=b.mini?2.1:1.65;b.expose=b.actionTime;b.wind=0;return;}
    b.attackClock-=dt;
    if(b.attackClock<=0){
      const z=b.mini?.68:1;
      if(b.action==='fan'&&b.patternStep<(b.phase>=2?4:3)){
        for(let i=-2;i<=2;i++)enemyShot(b.x+i*12,b.y-42*z,clamp(h.x+i*57,30,610),h.y,'round',1.65+Math.abs(i)*.07);
        b.patternStep++;b.attackClock=.78;
      }else if(b.action==='sweep'&&b.patternStep<2){
        const dir=b.patternStep%2===0?1:-1;s.hazards.push({kind:'sweep',x:dir===1?-30:670,dir,age:0,life:4,speed:b.mini?165:188,dead:false});
        b.patternStep++;b.attackClock=1.4;sfx('heavy');
      }else if(b.action==='mortar'&&b.patternStep<3){
        const offset=b.patternStep===0?0:(b.patternStep===1?-72:72);enemyShot(b.x+(b.patternStep-1)*38,b.y-71*z,h.x+offset,h.y,'mortar',1.55);
        if(!b.mini&&b.phase>=1)enemyShot(b.x-40,b.y-71*z,h.x-offset+38,h.y-9,'mortar',1.8);
        b.patternStep++;b.attackClock=.72;
      }else if(b.action==='cross'&&b.patternStep<3){
        s.hazards.push({kind:'laser',x:clamp(h.x+(b.patternStep%2?44:-22),40,600),y:h.y,age:0,life:1.7,delay:1.18,width:24,dead:false});
        for(let i=-1;i<=1;i++)enemyShot(b.x,b.y-48,h.x+i*64,h.y,'round',1.9);
        b.patternStep++;b.attackClock=.9;
      }
    }
    b.spawnClock-=dt;
    if(b.spawnClock<=0&&s.enemies.length<2){b.spawnClock=b.mini?12:10;spawnEnemy(b.phase>=1?'drone':'gunner',b.cycle%2?0:5);}
    if(!reduced&&Math.floor(b.age*10)%9===0)game.particles.smoke(b.x-43*(b.mini?.68:1),b.y-110*(b.mini?.68:1),8,1);
  }
  function updateThreats(dt){
    const s=state,h=s.player;
    for(const b of s.bullets){if(b.dead)continue;b.age+=dt;if(b.age>=b.dur){
      b.dead=true;const blast=b.kind==='mortar',r=blast?31:b.kind==='piercer'?17:18;
      const canHit=Math.abs(h.x-b.tx)<r&&Math.abs(h.y-b.ty)<(blast?37:28)&&(blast||h.z<24);
      if(canHit)hurtPlayer();
      if(blast){burst(b.tx,b.ty-6,.55);s.rings.push({x:b.tx,y:b.ty,r:0,max:33,life:.25,color:'#ed8c57'});}
      else game.particles.dust(b.tx,b.ty,0,4);
    }}
    for(const o of s.hazards){o.age+=dt;
      if(o.kind==='sweep'){o.x+=o.dir*o.speed*dt;if(Math.abs(h.x-o.x)<17&&h.z<26)hurtPlayer();if(o.x<-50||o.x>690)o.dead=true;}
      else if(o.kind==='laser'&&o.age>=o.delay){if(Math.abs(h.x-o.x)<o.width)hurtPlayer();}
      if(o.age>=o.life)o.dead=true;
    }
    E.prune(s.bullets,b=>b.dead);E.prune(s.hazards,o=>o.dead);
  }
  function updateEffects(dt){
    const s=state;
    for(const list of [s.traces,s.floats,s.tethers,s.rings]){for(const o of list){o.age=(o.age||0)+dt;o.life-=dt;}E.prune(list,o=>o.life<=0);}
    for(const o of s.pickups){o.age+=dt;o.life-=dt;}E.prune(s.pickups,o=>o.dead||o.life<=0);
    for(const o of s.props)o.hit=Math.max(0,o.hit-dt);
    if(s.message){s.message.time-=dt;if(s.message.time<=0)s.message=null;}
    if(s.radio){s.radio.time-=dt;if(s.radio.time<=0)s.radio=null;}
  }
  function updateDirector(dt){
    const s=state,stage=STAGES[s.stage];
    if(s.transition>0){s.transition-=dt;return;}
    s.stageAge+=dt;
    if(!stage.boss){
      while(s.eventIndex<stage.events.length&&stage.events[s.eventIndex].at<=s.stageAge){const e=stage.events[s.eventIndex++];spawnEnemy(e.kind,e.place);}
      if(s.eventIndex===stage.events.length&&s.enemies.length===0){const before=s.clearTimer;s.clearTimer+=dt;
        if(before<=.5&&s.clearTimer>.5){message('AREA SECURED','REPAIR +1 / NEXT POSITION',2);s.player.hp=Math.min(s.player.maxHp,s.player.hp+1);sfx('heal',.8);addScore(750);}
        if(s.clearTimer>=2.6){setupStage(s.stage+1);}
      }
    }
  }
  function completeVictory(){
    const s=state;if(s.finish)return;s.finish=true;
    const clearBonus=1500+s.player.hp*250;addScore(clearBonus);s.stats.continues=continueCount;
    const old=E.store.get('dust-volt-best-'+difficulty,0);if(s.score>old)E.store.set('dust-volt-best-'+difficulty,s.score);
    game.go('result',{win:true,newBest:s.score>old},{fade:.3});
  }
  function update(dt){
    if(!state)return;const s=state;s.age+=dt;game.focus(W/2,H/2);updateEffects(dt);
    if(s.mode==='dying'){s.endAge+=dt;if(s.endAge>1.2&&!s.finish){s.finish=true;game.go('result',{win:false},{fade:.25});}return;}
    if(s.mode==='mini-down'||s.mode==='victory'){
      s.endAge+=dt;const b=s.boss;if(b&&s.endAge<2.9&&Math.floor(s.endAge*8)!==Math.floor((s.endAge-dt)*8))burst(b.x+(s.random()-.5)*145,b.y-70+s.random()*100,.6,s.endAge<.4);
      if(s.mode==='mini-down'&&s.endAge>3.6){
        s.mode='play';s.player.hp=s.player.maxHp;s.player.pulses=2;s.player.hurt=2;
        checkpoint={stage:3,totalTime:s.totalTime,score:s.score,stats:{...s.stats}};s.checkSaved=true;setupStage(3);message('CHECKPOINT REACHED','HEALTH AND PULSES RESTORED',3.1);
      }else if(s.mode==='victory'){s.player.moving=false;if(s.endAge-dt<=3&&s.endAge>3){game.audio.music(A.music.victory);radio('MARA: The water is through. You did it, Rook. Come home.',6);}if(s.endAge>7)completeVictory();}
      return;
    }
    s.totalTime+=dt;
    updateAim(dt);updatePlayer(dt);if(s.mode!=='play')return;
    updateEnemies(dt);updateBoss(dt);updateThreats(dt);if(s.mode!=='play')return;
    updateDirector(dt);s.chainTime=Math.max(0,s.chainTime-dt);if(s.chainTime===0){s.chain=0;s.multiplier=1;}
  }
  function drawThreats(g){
    const s=state,t=s.age;
    for(const o of s.hazards){
      if(o.kind==='sweep'){
        p.blend(g,.22,'normal',()=>p.rect(g,o.x-12,279,24,61,'#62c9d2'));
        for(let j=0;j<4;j++){const xx=o.x-10+j*6+Math.sin(t*32+j)*3;p.line(g,xx,286,xx+7,300,'#d5f4bd',2);p.line(g,xx+7,300,xx-3,319,'#76e1d5',2);p.line(g,xx-3,319,xx+5,335,'#d5f4bd',2);}
        p.line(g,o.x-16,337,o.x+17,337,'#f3e9b1',2);
      }else{
        const active=o.age>=o.delay,c=active?'#ffe7b0':'#f5926a';
        p.blend(g,active?.5:.16,'normal',()=>p.rect(g,o.x-o.width,276,o.width*2,65,c));
        p.line(g,o.x-o.width,277,o.x-o.width,337,c);p.line(g,o.x+o.width,277,o.x+o.width,337,c);
        if(active){p.line(g,s.boss?s.boss.x:320,150,o.x,322,'#fbd196',6);p.line(g,s.boss?s.boss.x:320,150,o.x,322,'#fffae1',2);}else E.font.text(g,'MOVE',o.x,272,c,{align:'center',outline:'#162a31'});
      }
    }
    for(const b of s.bullets){
      const q=bulletPoint(b),red=b.kind!=='round',c=red?'#fa8761':'#f8c66f';
      if(b.kind==='mortar'){
        const rx=30*(1-q.u*.3);p.blend(g,.22,'normal',()=>p.ell(g,b.tx,b.ty,30,11,'#e6563e'));
        A.ring(g,b.tx,b.ty,rx,rx*.37,c,1,22);p.line(g,b.tx-8,b.ty,b.tx+8,b.ty,c);p.line(g,b.tx,b.ty-4,b.tx,b.ty+4,c);
      }else if(q.u>.45){
        const xx=b.tx,yy=b.ty;p.line(g,xx-9,yy-2,xx-5,yy+2,c);p.line(g,xx+9,yy-2,xx+5,yy+2,c);
        if(q.u>.74)A.ring(g,xx,yy,15,5,c,1,16);
      }
      p.line(g,q.x-(q.x-b.sx)*.045,q.y-(q.y-b.sy)*.06,q.x,q.y,red?'#a55140':'#b88545',Math.max(1,q.r-2));
      p.disc(g,q.x,q.y,q.r+2,'#122735');
      if(red)p.poly(g,[[q.x,q.y-q.r-1],[q.x+q.r+1,q.y],[q.x,q.y+q.r+1],[q.x-q.r-1,q.y]],c);else p.disc(g,q.x,q.y,q.r,c);
      p.disc(g,q.x-1,q.y-1,Math.max(1,q.r-3),red?'#ffdcc0':'#fff6cc');
      if(!red)A.ring(g,q.x,q.y,q.r+4,q.r+4,'#f2c979',1,12);
    }
  }
  function drawTrain(g,t,won=false){
    const start=won?Math.min(1,t/4):.62,xx=660-start*310,yy=173;
    g.save();g.translate(xx,yy);g.scale(.53,.53);g._c=null;
    for(let k=0;k<3;k++){const x=k*99;p.rect(g,x-46,-33,92,48,'#122c38');p.rect(g,x-42,-29,84,37,'#426c72');p.rect(g,x-41,-26,81,5,'#82aaa0');p.rect(g,x-37,-17,74,21,'#375761');p.rect(g,x-10,-18,18,22,'#a9b5a0');p.rect(g,x-6,-14,10,14,'#244754');p.line(g,x-47,17,x+46,17,'#142936',5);p.disc(g,x-27,19,9,'#0a202a');p.disc(g,x+27,19,9,'#0a202a');p.disc(g,x-27,19,4,'#9b9f89');p.disc(g,x+27,19,4,'#9b9f89');}
    g.restore();g._c=null;
  }
  function drawWorld(r,title=false){
    const g=r.ctx,s=state,t=title?titleTime:s.age,shx=title?0:-r.ix,shy=title?0:-r.iy;
    g.save();g.translate(Math.round(shx),Math.round(shy));A.background(g,t,title?0:s.stage);
    if(title){
      A.prop(g,{x:440,y:233,kind:'barrel',hp:5,max:5},t);
      A.enemy(g,{id:1,kind:'gunner',x:370,y:203,scale:1.2,hit:0,stun:0,moving:false,wind:0},t);
      A.enemy(g,{id:2,kind:'drone',x:556,y:167,scale:1,hit:0,stun:0,wind:0},t);
      A.hero(g,{x:488,y:353,z:0,face:-1,roll:0,hurt:0,surge:0,recoil:0},t,true);
      g.restore();g._c=null;return;
    }
    if(s.stage>=3)drawTrain(g,s.mode==='victory'?s.endAge:s.stageAge,s.mode==='victory');
    // Render targets from back to front, then foreground threats and player.
    const drawList=[];
    for(const o of s.props)drawList.push({y:o.y+15,draw:()=>A.prop(g,o,t)});
    for(const e of s.enemies){if(!e.dead)drawList.push({y:e.y,draw:()=>{
      if(e.entry>0){g.globalAlpha=clamp(1-e.entry/.65,.15,1);g.save();g.translate(0,e.entry*18);}
      A.enemy(g,e,t);if(e.entry>0){g.restore();g.globalAlpha=1;g._c=null;}
      if(e.stun>0){A.ring(g,e.x,e.y-5,24,12,'#8eeee0',1,18);for(let i=0;i<3;i++)p.rect(g,e.x-13+i*12,e.y-34+Math.sin(t*8+i)*4,3,3,'#c7ffe8');}
      if((e.hp<e.max||e.stun>0)&&e.entry===0){p.rect(g,e.x-15,e.y+27,30,3,'#10232c');p.rect(g,e.x-15,e.y+27,Math.ceil(30*e.hp/e.max),2,e.stun>0?'#9cf8df':'#e6b677');}
      if(e.kind==='sniper'&&e.wind>0){p.blend(g,.5,'normal',()=>p.line(g,e.x,e.y,e.tx,e.ty-35,'#dc8467'));}
    }});}
    if(s.boss)drawList.push({y:s.boss.y+25,draw:()=>{g.globalAlpha=s.boss.hp<=0?.62:1;A.boss(g,s.boss,t);g.globalAlpha=1;}});
    for(const o of s.pickups)if(o.life>2||Math.floor(o.life*8)%2===0)drawList.push({y:o.y+23,draw:()=>A.pickup(g,o,t)});
    drawList.sort((a,b)=>a.y-b.y);for(const o of drawList)o.draw();
    drawThreats(g);
    if(s.player.roll>0&&s.player.hurt<=0)p.blend(g,.25,'normal',()=>{const ghost={...s.player,x:s.player.x-s.player.rollDir*20};A.hero(g,ghost,t);});
    A.hero(g,s.player,t);
    if(s.player.surge>0){p.blend(g,.12,'normal',()=>p.rect(g,0,344,W,16,'#acf2d0'));}
    g.restore();g._c=null;
    r.overlay(g=>drawOverlay(g,r));
  }
  function text(g,t,x,y,c='#e7d7b7',o={}){E.font.text(g,t,x,y,c,{outline:false,...o});}
  function drawOverlay(g,r){
    const s=state,h=s.player,t=s.age;
    g.save();g.translate(-r.ix,-r.iy);
    for(const tr of s.traces){const a=clamp(tr.life/.1,0,1);p.blend(g,a*.75,'normal',()=>{
      p.line(g,tr.sx,tr.sy,tr.tx,tr.ty,tr.surge?'#c4fff0':'#f1ddaa',tr.surge?2:1);
      if(tr.scatter){p.line(g,tr.sx,tr.sy,tr.tx-10,tr.ty+4,'#e9bb71');p.line(g,tr.sx,tr.sy,tr.tx+10,tr.ty-4,'#e9bb71');}
      A.ring(g,tr.tx,tr.ty,4+tr.age*70,4+tr.age*70,tr.surge?'#bffff0':'#ffe3a0',1,8);
    });}
    for(const o of s.tethers){const u=clamp(o.age/.14,0,1),tx=mix(o.sx,o.tx,u),ty=mix(o.sy,o.ty,u);
      p.blend(g,Math.min(1,o.life*3),'normal',()=>{let ax=o.sx,ay=o.sy;for(let i=1;i<=12;i++){const x=mix(o.sx,tx,i/12),y=mix(o.sy,ty,i/12)+Math.sin(i*3+t*42)*4;p.line(g,ax,ay,x,y,'#91f1e2',2);ax=x;ay=y;}if(o.hit)A.ring(g,o.tx,o.ty,24,15,'#d2ffcf',1,20);});
    }
    for(const o of s.rings){const k=clamp(o.age/(o.age+o.life),0,1);p.blend(g,(1-k)*.8,'normal',()=>{A.ring(g,o.x,o.y,o.max*k,o.max*k*.7,o.color,k<.4?3:1,64);});}
    for(const f of s.floats){p.blend(g,Math.min(1,f.life*2),'normal',()=>text(g,f.text,f.x,f.y-f.age*23,f.color,{align:'center',outline:'#0b202b'}));}
    g.restore();g._c=null;
    // In-game HUD. Thin panels retain a wide view of the playfield.
    p.blend(g,.88,'normal',()=>p.rect(g,0,0,640,38,'#0a1c24'));p.rect(g,0,37,640,1,'#577274');
    text(g,'ROOK',14,8,'#8ec8c0');
    for(let i=0;i<h.maxHp;i++){const x=14+i*12;p.rect(g,x,22,9,6,i<h.hp?'#f1c779':'#30464c');if(i<h.hp)p.rect(g,x,21,9,1,'#ffe9b2');}
    text(g,String(s.score).padStart(6,'0'),178,10,'#f5e6c7',{scale:2,align:'center'});
    text(g,'SCORE',178,29,'#7caaa8',{align:'center'});
    const stage=STAGES[s.stage],progress=stage.boss?(s.boss?1-s.boss.hp/s.boss.max:0):s.eventIndex/stage.events.length;
    text(g,String(s.stage+1).padStart(2,'0')+' / '+stage.name,330,8,'#d2d7be',{align:'center'});
    for(let i=0;i<5;i++){p.rect(g,264+i*28,24,23,3,i<s.stage?'#99d6bf':i===s.stage?'#eabc75':'#2e484e');}
    p.rect(g,264+s.stage*28,28,Math.max(1,23*progress),1,'#fce4aa');
    text(g,'SURGE',454,8,h.surge>0?'#fcdf9b':'#85bcb5');
    p.rect(g,454,22,105,6,'#2a4349');p.rect(g,454,22,Math.round(105*(h.surge>0?h.surge/6:s.charge/100)),6,h.surge>0?'#fbe2a8':'#84d9c9');
    if(s.charge>=100&&h.surge<=0&&Math.floor(t*4)%2===0)text(g,'F READY',507,9,'#ffe0a0');
    text(g,Math.ceil(h.surge>0?h.surge:s.charge)+(h.surge>0?'S':'%'),565,23,'#dfd9b7');
    text(g,'PULSE',601,8,'#8ec5be',{align:'center'});for(let i=0;i<2;i++){const x=588+i*15;p.poly(g,[[x+4,21],[x+8,25],[x+4,29],[x,25]],i<h.pulses?'#efc87e':'#304b51');}
    if(s.boss&&s.boss.hp>0){const b=s.boss;p.blend(g,.9,'normal',()=>p.rect(g,172,43,296,24,'#0b2029'));text(g,b.mini?'GATEBREAKER':'THE IRON TITHE',181,48,'#d3d8c0');text(g,b.mini?'GUARD UNIT':'PHASE 0'+(b.phase+1),459,48,'#ddaa77',{align:'right'});p.rect(g,181,59,278,3,'#3b3733');p.rect(g,181,59,Math.round(278*b.hp/b.max),3,'#e99458');
      if((b.expose>0||b.stun>0||b.phase>=2)&&s.mode==='play')text(g,'CORE OPEN',b.x,b.y-67*(b.mini?.68:1),'#c2ffe0',{align:'center',outline:'#102c38'});
    }
    if(s.chain>1){text(g,s.chain+' CHAIN',13,49,'#f7d798');text(g,'x'+s.multiplier,13,60,'#e8f5cb',{scale:2});p.rect(g,13,80,42*s.chainTime/4.5,2,'#baba87');}
    if(h.gun!=='coil'){text(g,h.gun.toUpperCase(),13,93,'#9cdbd1');p.rect(g,13,104,42*Math.max(0,h.gunTime)/16,2,'#9cdbd1');}
    // A compact tool status row near the player's feet.
    if(!touch){p.blend(g,.75,'normal',()=>p.rect(g,0,345,640,15,'#0c222b'));text(g,'COIL '+(h.gun==='coil'?'RIFLE':h.gun.toUpperCase()),12,349,'#a4c5bd');
      text(g,'ROLL '+(h.rollCool>0?h.rollCool.toFixed(1)+'S':'READY'),193,349,h.rollCool>0?'#6e9596':'#c9d6b7');
      text(g,'TETHER '+(h.tether>0?h.tether.toFixed(1)+'S':'READY'),318,349,h.tether>0?'#6e9596':'#a0e6d4');
      text(g,formatTime(s.totalTime),628,349,'#aaa98d',{align:'right'});}
    if(s.radio&&s.mode!=='dying'){
      const lines=E.font.wrap(s.radio.text,480);const height=lines.length*10+12;
      p.blend(g,.88,'normal',()=>p.rect(g,80,Math.max(74,s.boss?73:49),480,height,'#0d2630'));
      p.rect(g,80,Math.max(74,s.boss?73:49),2,height,'#8dd0c1');
      text(g,s.radio.text,91,Math.max(74,s.boss?73:49)+6,'#c1dfcf',{wrap:460});
    }
    if(s.message){
      const m=s.message,fade=Math.min(1,m.time*2,(m.total-m.time)*3);
      p.blend(g,fade*.85,'normal',()=>p.rect(g,100,122,440,50,'#0b222b'));
      p.blend(g,fade,'normal',()=>{p.rect(g,100,122,3,50,'#e9b66c');text(g,m.title,320,131,'#f1d89f',{scale:2,align:'center'});if(m.line)text(g,m.line,320,155,'#aacec3',{align:'center'});});
    }
    if(s.mode==='play'){
      const hot=s.enemies.some(e=>!e.dead&&Math.hypot(s.aim.x-e.x,s.aim.y-e.y)<30)||bossContains(s.aim.x,s.aim.y),x=s.aim.x-r.ix,y=s.aim.y-r.iy,c=h.surge>0?'#dbfff1':hot?'#ffdf8d':'#b8fff0';
      A.ring(g,x,y,10,10,'#0a2632',3,20);A.ring(g,x,y,9,9,c,1,20);
      p.line(g,x-15,y,x-6,y,c,2);p.line(g,x+6,y,x+15,y,c,2);p.line(g,x,y-15,x,y-6,c,2);p.line(g,x,y+6,x,y+15,c,2);p.rect(g,x-1,y-1,2,2,'#fff7d3');
      // Real player collision point. Small and stable, even when the art moves.
      if(h.roll>0||h.z>12||h.surge>0)A.ring(g,h.x-r.ix,h.y-r.iy,6,3,'#b8f0d3',1,16);
    }
  }
  function formatTime(n){return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');}
  function syncPause(){
    if(game.sceneName==='play'&&game.paused!==lastPause){lastPause=game.paused;if(game.paused&&!modal)openModal('pause');else if(!game.paused&&modal==='pause')closeModal();}
  }
  const scenes={
    title:{enter(){state=null;game.audio.music(null);game.shakeAmt=0;game._flash=null;game.input.clear();game.focus(320,180);$('title-panel').hidden=false;document.body.classList.remove('playing');$('touch-controls').hidden=true;$('pause-button').disabled=true;bestUI();},update(dt){titleTime+=dt;game.focus(320,180);if(game.input.pressed('start')&&!modal)startRun();if(game.input.pressed('mute'))toggleSound();},draw(r){drawWorld(r,true);}},
    play:{pausable:true,enter(){const cp=pendingContinue&&checkpoint?checkpoint:null;state=newState(cp?3:0,cp);pendingContinue=false;game.timeScale=1;game.shakeAmt=0;game._flash=null;game.input.clear();game.focus(320,180);$('title-panel').hidden=true;document.body.classList.add('playing');$('touch-controls').hidden=!touch;$('pause-button').disabled=false;lastPause=false;setupStage(state.stage);},update(dt){if(game.input.pressed('mute'))toggleSound();update(dt);},draw(r){drawWorld(r);syncPause();}},
    result:{enter(data){game.paused=false;lastPause=false;document.body.classList.remove('playing');$('touch-controls').hidden=true;$('pause-button').disabled=true;game.input.clear();showResults(data);if(data.win)game.audio.music(A.music.victory);},update(){if(game.input.pressed('start'))startRun(!state.finishWin&&!!checkpoint);},draw(r){drawWorld(r);}}
  };
  function openModal(name){
    if(!modal)lastFocus=document.activeElement;modal=name;scenes.play.pausable=name!=='help';$('modal-backdrop').hidden=false;
    for(const n of ['pause','help','result'])$(n+'-panel').hidden=n!==name;
    const focusId=name==='pause'?'resume-button':name==='help'?'close-help':'retry-button';queueMicrotask(()=>$(focusId).focus({preventScroll:true}));
  }
  function closeModal(){modal='';scenes.play.pausable=true;$('modal-backdrop').hidden=true;for(const n of ['pause','help','result'])$(n+'-panel').hidden=true;if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
  function pause(){if(game.sceneName!=='play'||state.mode!=='play')return;game.paused=true;game.input.clear();lastPause=true;openModal('pause');sfx('pause');}
  function resume(){closeModal();game.paused=false;lastPause=false;game.input.clear();$('screen').focus({preventScroll:true});}
  function showHelp(){if(modal==='help')return;manualBack=modal|| (game.sceneName==='play'?'play':'title');if(game.sceneName==='play'){game.paused=true;lastPause=true;game.input.clear();}openModal('help');}
  function hideHelp(){if(manualBack==='pause')openModal('pause');else if(manualBack==='result')openModal('result');else if(manualBack==='play')resume();else closeModal();}
  function showResults({win,newBest=false}){
    const s=state;s.finishWin=win;
    $('result-eyebrow').textContent=win?(newBest?'NEW LOCAL BEST / DISPATCH COMPLETE':'DISPATCH COMPLETE'):'SIGNAL LOST';
    $('result-heading').textContent=win?'THE LINE IS OPEN.':'ROOK IS DOWN.';
    $('result-story').textContent=win?'The water train has a clear path. Copperline lives another day.':checkpoint?'Your checkpoint is saved. Return to the last train with full supplies.':'The depot is still under siege. Take a breath, then try again.';
    let rank=continueCount>0?'B':s.stats.damage<=2&&s.stats.intercepts>=12?'S':s.stats.damage<=6?'A':s.stats.damage<=12?'B':'C';
    if(difficulty==='trail'&&rank==='S')rank='A';$('rank').textContent=win?rank:'×';$('rank').style.color=win?'':'#e58e6d';
    const accuracy=Math.round(s.stats.hits/Math.max(1,s.stats.shots)*100);
    const metrics=win?[['FINAL SCORE',String(s.score).padStart(6,'0')],['CLEAR TIME',formatTime(s.totalTime)],['INTERCEPTS',s.stats.intercepts],['BEST CHAIN',s.stats.maxChain],['ACCURACY',accuracy+'%'],['CONTINUES',continueCount]]:[['SCORE',String(s.score).padStart(6,'0')],['AREA',String(s.stage+1).padStart(2,'0')+' / 05'],['INTERCEPTS',s.stats.intercepts],['BEST CHAIN',s.stats.maxChain]];
    $('result-stats').replaceChildren(...metrics.map(([label,value])=>{const el=document.createElement('div');el.className='result-stat';const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;el.append(small,strong);return el;}));
    $('retry-button').textContent=win?'PLAY AGAIN':checkpoint?'RETRY CHECKPOINT':'RETRY LEVEL';
    openModal('result');announce((win?'Level complete. Rank '+rank+'. Final score ':'Run ended. Score ')+s.score+'.');
  }
  function toTitle(){closeModal();game.paused=false;game.go('title',null,{fade:.2});}
  function toggleSound(){muted=!muted;game.audio.mute(muted);if(!muted)sfx('select');soundUI();settings();}
  $('start-button').addEventListener('click',()=>startRun());
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{setDifficulty(b.dataset.difficulty);sfx('select');}));
  $('title-help').addEventListener('click',showHelp);$('help-button').addEventListener('click',showHelp);$('pause-help').addEventListener('click',showHelp);
  $('close-help').addEventListener('click',hideHelp);$('manual-done').addEventListener('click',hideHelp);
  $('pause-button').addEventListener('click',()=>game.paused?resume():pause());$('resume-button').addEventListener('click',resume);
  $('restart-button').addEventListener('click',()=>startRun());$('quit-button').addEventListener('click',toTitle);
  $('retry-button').addEventListener('click',()=>startRun(!state.finishWin&&!!checkpoint));$('result-title').addEventListener('click',toTitle);
  $('sound-button').addEventListener('click',toggleSound);
  $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-shell').requestFullscreen();game.screen.resize();}catch(e){announce('Full screen is not available in this browser.');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');game.screen.resize();});
  $('motion-toggle').addEventListener('change',e=>{reduced=e.target.checked;game.reduceMotion=reduced;document.body.classList.toggle('motion-reduced',reduced);settings();});
  $('screen').addEventListener('pointermove',()=>{aimMode='mouse';});$('screen').addEventListener('pointerdown',()=>{aimMode='mouse';$('screen').focus({preventScroll:true});});
  window.addEventListener('blur',()=>{if(game.sceneName==='play'&&state.mode==='play'&&!game.paused)pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.sceneName==='play'&&state.mode==='play'&&!game.paused)pause();});
  // Preserve native button keys; the engine reads gameplay keys at window scope.
  for(const root of [$('title-panel'),$('modal-backdrop'),document.querySelector('.masthead')])root.addEventListener('keydown',e=>{
    if((e.code==='Enter'||e.code==='Space')&&(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'))e.stopPropagation();
    if(e.code==='Escape'&&modal){e.preventDefault();e.stopPropagation();if(modal==='help')hideHelp();else if(modal==='pause')resume();}
    if(e.code==='Tab'&&modal){const nodes=[...$(modal+'-panel').querySelectorAll('button,input')].filter(n=>!n.disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  for(const b of document.querySelectorAll('[data-code]')){
    const code=b.dataset.code;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);game.input.press(code);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();game.input.release(code);});
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>game.screen.resize()).observe($('stage'));
  setDifficulty(difficulty);soundUI();game.start({scene:'title',scenes});
  A.loaded.then(ok=>{if(!ok)announce('Some art could not load. Reload the page to restore the complete scene.');});
  // One public inspection surface. It reports state; it does not grant combat advantages.
  const inspect=()=>({scene:game.sceneName,paused:game.paused,difficulty,mode:state?.mode||'title',stage:state?state.stage+1:0,stageName:state?STAGES[state.stage].name:null,hp:state?.player.hp??null,score:state?.score||0,charge:state?Math.round(state.charge):0,enemies:state?.enemies.length||0,boss:state?.boss?{name:state.boss.mini?'Gatebreaker':'Iron Tithe',hp:Math.ceil(state.boss.hp),phase:state.boss.phase+1}:null,complete:state?.finishWin||false});
  window.DustVolt={inspect,version:'1.0.0'};
  if(document.modelContext?.registerTool){
    const controller=new AbortController();
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch(e){}};
    register({name:'read_game_state',description:'Read the current Dust & Volt run, health, score, and encounter.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(args){if(args&&Object.keys(args).length)throw new Error('No fields are accepted.');return inspect();}});
    register({name:'pause_game',description:'Pause an active Dust & Volt run and open its pause menu.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(args){if(args&&Object.keys(args).length)throw new Error('No fields are accepted.');if(game.sceneName!=='play'||state.mode!=='play')throw new Error('There is no active run to pause.');pause();return inspect();}});
    addEventListener('pagehide',()=>controller.abort(),{once:true});
  }
  // Explicit development harness, unavailable without the local QA query flag.
  if(location.protocol==='file:'&&new URLSearchParams(location.search).get('qa')==='1')window.DustVoltQA={
    game,get state(){return state;},stage(i){if(!state)throw new Error('Start a run first.');if(!Number.isInteger(i)||i<0||i>=STAGES.length)throw new Error('Invalid stage');state.mode='play';state.finish=false;setupStage(i);},
    step(dt,n=1){for(let i=0;i<n;i++){game._step(dt);}},shoot,tryTether,tryPulse,trySurge,hurtPlayer,enemyShot,spawnPickup,spawnEnemy,inspect,
    render(){game._frame();},pause,resume,scenes,STAGES,
    aim(x,y){aimMode='qa';state.aim={x,y};},start(){game._enter('play');}
  };
})();
