const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.186.0/three.webgpu.min.js';
const $ = (s) => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const rand = (a,b) => a+Math.random()*(b-a);

const ui = Object.fromEntries([
  'stage','hud','foeHp','playerHp','playerStamina','playerRush','roundText','timerText','rendererBadge','playerLevel','playerKD','foeKD',
  'announce','telegraph','intro','tutorial','corner','cornerChoices','cornerEyebrow','cornerTitle','cornerCopy','result','resultEyebrow','resultTitle','resultCopy','resultStats',
  'controls','startBtn','fightBtn','rematchBtn','gearBtn','labBtn','lab','labWallet','labItems','labBackBtn','gearRow','introLevel',
  'stick','stickKnob','guardBtn','leftPunchBtn','rightPunchBtn','rushBtn','flash','getup','getupFill','getupBtn','getupCount'
].map(k=>[k,$('#'+k)]));

const DEFAULT_META = { xp:0, level:1, credits:0, wins:0, gear:{gloves:'balanced',boots:'quick',guard:'classic'}, owned:['balanced','quick','classic'] };
function loadMeta(){ try{return {...DEFAULT_META,...JSON.parse(localStorage.getItem('ropeburn-meta')||'{}')};}catch{return structuredClone(DEFAULT_META);} }
let meta = loadMeta();
function saveMeta(){ localStorage.setItem('ropeburn-meta',JSON.stringify(meta)); }

const GEAR = {
  balanced:{slot:'gloves',name:'Circuit Reds',desc:'+4% punch power',cost:0,power:1.04},
  hammers:{slot:'gloves',name:'Brick Hammers',desc:'+10% power, -6% stamina recovery',cost:120,power:1.10,stamRegen:.94},
  quick:{slot:'boots',name:'Slip Soles',desc:'+8% dodge window',cost:0,dodge:1.08},
  anchors:{slot:'boots',name:'Anchor High-Tops',desc:'+8% guard, -4% dodge window',cost:100,guard:1.08,dodge:.96},
  classic:{slot:'guard',name:'Blue Mouthguard',desc:'+5 max stamina',cost:0,maxStamina:5},
  focus:{slot:'guard',name:'Focus Guard',desc:'+12% momentum gain',cost:140,momentum:1.12}
};

function gearMods(){
  const out={power:1,dodge:1,guard:1,maxStamina:0,stamRegen:1,momentum:1};
  Object.values(meta.gear).forEach(id=>{const g=GEAR[id]; if(!g)return; for(const k in out) if(g[k]!=null) out[k]*=g[k];});
  out.maxStamina = Object.values(meta.gear).reduce((n,id)=>n+(GEAR[id]?.maxStamina||0),0);
  return out;
}

const state = {
  mode:'menu', round:1, time:60, playerHp:100, foeHp:100, stamina:100, rush:0,
  playerKD:0, foeKD:0, score:0, landed:0, dodges:0, counters:0,
  actionCd:0, dodgeT:0, duckT:0, guard:false, playerHitT:0, foeHitT:0, foeStun:0,
  cornerPower:1, cornerStam:1, cornerGuard:1, cameraZoom:1,
  foe:{mode:'idle',t:0,next:1.1,attack:null,side:0,blockT:0,phase:1},
  getupT:0,getupNeed:7,getupCount:0,lastWin:null,
};
let mods = gearMods();

let rendererAPI = null;
let gameStartedAt = performance.now();
let last = performance.now();
let rafId = 0;

class AudioBank{
  constructor(){this.ctx=null;this.master=null;}
  ensure(){if(this.ctx)return; const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ctx=new A();this.master=this.ctx.createGain();this.master.gain.value=.28;this.master.connect(this.ctx.destination);}
  tone(freq=220,dur=.08,type='square',gain=.2,slide=0){this.ensure();if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,this.ctx.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),this.ctx.currentTime+dur);g.gain.setValueAtTime(gain,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+dur);o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+dur);}
  noise(dur=.06,gain=.2){this.ensure();if(!this.ctx)return;const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=b;g.gain.value=gain;s.connect(g);g.connect(this.master);s.start();}
  punch(heavy=false){this.noise(heavy?.12:.07,heavy?.42:.28);this.tone(heavy?82:116,heavy?.13:.07,'square',heavy?.25:.14,-35);}
  bell(){this.tone(940,.65,'sine',.16,-180);this.tone(1410,.42,'sine',.09,-220);}
  dodge(){this.noise(.05,.07);}
  ko(){this.tone(180,.12,'sawtooth',.16,-80);setTimeout(()=>this.tone(120,.32,'square',.16,-50),110);}
}
const audio = new AudioBank();

function show(el,yes=true){el.classList.toggle('hidden',!yes);}
function announce(text,ms=750){ui.announce.querySelector('span').textContent=text;show(ui.announce,true);clearTimeout(announce.t);announce.t=setTimeout(()=>show(ui.announce,false),ms);}
function flash(strength=.65){ui.flash.style.transition='none';ui.flash.style.opacity=strength;requestAnimationFrame(()=>{ui.flash.style.transition='opacity .1s';ui.flash.style.opacity=0;});}
function haptic(pattern){try{navigator.vibrate?.(pattern)}catch{}}

function refreshMetaUI(){
  ui.introLevel.textContent=`Rookie Lv.${meta.level}`;ui.playerLevel.textContent=`ROOKIE LV.${meta.level}`;
  ui.gearRow.innerHTML=Object.values(meta.gear).map(id=>`<span class="gear-chip">${GEAR[id].name}</span>`).join('');
}
refreshMetaUI();

function resetBout(){
  mods=gearMods();Object.assign(state,{mode:'ready',round:1,time:60,playerHp:100,foeHp:100,stamina:100+mods.maxStamina,rush:0,playerKD:0,foeKD:0,score:0,landed:0,dodges:0,counters:0,actionCd:0,dodgeT:0,duckT:0,guard:false,playerHitT:0,foeHitT:0,foeStun:0,cornerPower:1,cornerStam:1,cornerGuard:1,lastWin:null});
  Object.assign(state.foe,{mode:'idle',t:0,next:1.15,attack:null,side:0,blockT:0,phase:1});
  rendererAPI?.reset?.();updateHUD();
}

function beginFight(){
  show(ui.tutorial,false);show(ui.intro,false);show(ui.result,false);show(ui.corner,false);show(ui.lab,false);show(ui.getup,false);show(ui.hud,true);show(ui.controls,true);
  state.mode='fight';gameStartedAt=performance.now();state.time=60;state.foe.next=1.15;audio.bell();announce('ROUND 1',1000);
}

function startSequence(){audio.ensure();resetBout();show(ui.intro,false);show(ui.tutorial,true);}
ui.startBtn.addEventListener('click',startSequence);ui.fightBtn.addEventListener('click',beginFight);ui.rematchBtn.addEventListener('click',()=>{resetBout();beginFight();});
ui.gearBtn.addEventListener('click',openLab);ui.labBtn.addEventListener('click',openLab);ui.labBackBtn.addEventListener('click',()=>{show(ui.lab,false); if(state.mode==='menu'||state.mode==='result')show(state.mode==='result'?ui.result:ui.intro,true);});

function openLab(){
  const fromResult=!ui.result.classList.contains('hidden');show(ui.intro,false);show(ui.result,false);show(ui.lab,true);state.mode=fromResult?'result':'menu';renderLab();
}
function renderLab(){
  ui.labWallet.textContent=`Credits ${meta.credits} · XP ${meta.xp} · Level ${meta.level}. Gear changes are modest so skill remains the main path to a win.`;
  ui.labItems.innerHTML=Object.entries(GEAR).map(([id,g])=>{
    const owned=meta.owned.includes(id),equipped=meta.gear[g.slot]===id;
    const label=equipped?'EQUIPPED':owned?'EQUIP':`BUY ${g.cost}`;
    return `<div class="lab-item"><div><b>${g.name}</b><small>${g.desc}</small></div><button data-gear="${id}" class="${equipped?'equipped':''}" ${(!owned&&meta.credits<g.cost)?'disabled':''}>${label}</button></div>`;
  }).join('');
  ui.labItems.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.gear,g=GEAR[id];if(!meta.owned.includes(id)){if(meta.credits<g.cost)return;meta.credits-=g.cost;meta.owned.push(id);}meta.gear[g.slot]=id;saveMeta();refreshMetaUI();renderLab();
  }));
}

function updateHUD(){
  ui.foeHp.style.transform=`scaleX(${clamp(state.foeHp/100,0,1)})`;ui.playerHp.style.transform=`scaleX(${clamp(state.playerHp/100,0,1)})`;
  ui.playerStamina.style.transform=`scaleX(${clamp(state.stamina/(100+mods.maxStamina),0,1)})`;ui.playerRush.style.transform=`scaleX(${clamp(state.rush/100,0,1)})`;
  ui.roundText.textContent=`R${state.round}`;const t=Math.max(0,Math.ceil(state.time));ui.timerText.textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;ui.playerKD.textContent=`KD ${state.playerKD}`;ui.foeKD.textContent=`KD ${state.foeKD}`;
  ui.rushBtn.style.filter=state.rush>=100?'brightness(1.5) drop-shadow(0 0 12px #49e5ff)':'';
}

const ATTACKS={
  jab:{tell:.48,active:.12,recover:.42,damage:10,kind:'straight',side:1},
  cross:{tell:.66,active:.13,recover:.54,damage:15,kind:'straight',side:-1},
  hook:{tell:.76,active:.15,recover:.64,damage:20,kind:'hook',side:0},
  upper:{tell:.92,active:.14,recover:.72,damage:25,kind:'upper',side:0},
};
function chooseAttack(){
  const phase=state.foe.phase;const r=Math.random();let key='jab';
  if(phase===1)key=r<.58?'jab':r<.82?'cross':'hook';
  else if(phase===2)key=r<.3?'jab':r<.57?'cross':r<.84?'hook':'upper';
  else key=r<.18?'jab':r<.42?'cross':r<.72?'hook':'upper';
  const base=ATTACKS[key]; const speed=1-(phase-1)*.085;
  return {...base,key,tell:base.tell*speed,recover:base.recover*speed,side:base.side|| (Math.random()<.5?-1:1)};
}
function startEnemyAttack(){
  if(state.foeStun>0)return;const a=chooseAttack();state.foe.attack=a;state.foe.mode='tell';state.foe.t=a.tell;state.foe.side=a.side;ui.telegraph.textContent=a.kind==='upper'?'↑':a.kind==='hook'?'⌄':'!';ui.telegraph.style.marginLeft=`${a.side*42}px`;show(ui.telegraph,true);rendererAPI?.foeTell?.(a);
}
function resolveEnemyHit(a){
  let avoided=false;
  if(a.kind==='hook') avoided=state.duckT>.05 || state.dodgeT>.05;
  else if(a.kind==='upper') avoided=state.dodgeT>.05;
  else avoided=state.dodgeT>.05;
  if(avoided){state.dodges++;state.score+=90;state.rush=clamp(state.rush+12*mods.momentum,0,100);audio.dodge();rendererAPI?.miss?.(a);return;}
  let dmg=a.damage*(1+.08*(state.foe.phase-1));
  if(state.guard){dmg*=.3/(mods.guard*state.cornerGuard);state.stamina=Math.max(0,state.stamina-a.damage*.72);if(state.stamina<=0){state.guard=false;announce('GUARD BREAK!',700);dmg*=1.6;}}
  state.playerHp=Math.max(0,state.playerHp-dmg);state.playerHitT=.26;state.rush=Math.max(0,state.rush-9);audio.punch(a.damage>=20);haptic(a.damage>=20?[24,20,35]:18);flash(.35);rendererAPI?.playerHit?.(a,dmg);if(state.playerHp<=0)playerKnockdown();
}

function playerPunch(hand,body=false){
  if(state.mode!=='fight'||state.actionCd>0||state.stamina<7)return;audio.ensure();state.guard=false;ui.guardBtn.classList.remove('pressed');
  const cost=body?9:7;state.stamina=Math.max(0,state.stamina-cost);state.actionCd=body?.38:.29;
  const inCounter=state.foe.mode==='tell' && state.foe.t<Math.max(.20,state.foe.attack.tell*.48);
  const open=state.foe.mode==='recover'||inCounter||state.foeStun>0;
  let landed=open && state.foe.blockT<=0;
  rendererAPI?.punch?.(hand,body,landed);
  if(landed){
    const levelBonus=1+Math.min(.12,(meta.level-1)*.012);let dmg=(body?7.2:6.0)*mods.power*state.cornerPower*levelBonus;
    if(inCounter){dmg*=1.9;state.counters++;state.foeStun=.52;state.rush=clamp(state.rush+22*mods.momentum,0,100);announce('COUNTER!',420);}else state.rush=clamp(state.rush+(body?7:6)*mods.momentum,0,100);
    if(body && state.foe.mode==='recover')dmg*=1.16;
    state.foeHp=Math.max(0,state.foeHp-dmg);state.landed++;state.score+=Math.round(dmg*24)+(inCounter?250:0);state.foeHitT=.18;audio.punch(inCounter);haptic(inCounter?[18,18,28]:12);flash(inCounter?.55:.23);rendererAPI?.foeHit?.(hand,body,dmg,inCounter);
    if(state.foeHp<=0)foeKnockdown(); else if(!inCounter){state.foe.blockT=.52;}
  }else{audio.tone(135,.035,'square',.05,-20);}
}
function specialRush(){
  if(state.mode!=='fight'||state.rush<100||state.actionCd>0)return;state.rush=0;state.actionCd=.75;announce('ROPEBURN RUSH!',650);audio.punch(true);rendererAPI?.special?.();
  setTimeout(()=>{if(state.mode!=='fight')return;let dmg=24*mods.power*state.cornerPower;state.foeHp=Math.max(0,state.foeHp-dmg);state.foeStun=.9;state.score+=900;state.landed+=3;audio.punch(true);flash(.85);rendererAPI?.foeHit?.(1,false,dmg,true);if(state.foeHp<=0)foeKnockdown();},240);
}
function dodge(dir){
  if(state.mode!=='fight'||state.dodgeT>0)return;state.guard=false;ui.guardBtn.classList.remove('pressed');state.dodgeT=.30*mods.dodge;state.actionCd=Math.max(state.actionCd,.08);state.rush=clamp(state.rush+1,0,100);rendererAPI?.dodge?.(dir);audio.dodge();
}
function duck(){if(state.mode!=='fight'||state.duckT>0)return;state.guard=false;ui.guardBtn.classList.remove('pressed');state.duckT=.34*mods.dodge;rendererAPI?.duck?.();audio.dodge();}

function foeKnockdown(){
  if(state.mode!=='fight')return;state.foeKD++;state.mode='foeDown';state.foe.mode='down';show(ui.telegraph,false);audio.ko();rendererAPI?.foeDown?.();announce('DOWN!',1000);state.score+=1200;
  setTimeout(()=>{if(state.foeKD>=3){finishBout(true,'TKO — THREE KNOCKDOWNS');return;}state.foeHp=state.foeKD===1?58:42;state.foe.phase=Math.min(3,state.foeKD+1);state.foe.mode='idle';state.foe.next=.8;state.mode='fight';announce('FIGHT!',650);rendererAPI?.foeRise?.();},2100);
}
function playerKnockdown(){
  if(state.mode!=='fight')return;state.playerKD++;state.mode='playerDown';state.guard=false;show(ui.telegraph,false);show(ui.controls,false);audio.ko();rendererAPI?.playerDown?.();announce('DOWN!',900);
  if(state.playerKD>=2){setTimeout(()=>finishBout(false,'REFEREE STOPPAGE'),900);return;}
  state.getupT=5;state.getupNeed=7;state.getupCount=0;ui.getupFill.style.width='0%';ui.getupCount.textContent='0 / 7';setTimeout(()=>show(ui.getup,true),650);
}
ui.getupBtn.addEventListener('pointerdown',()=>{if(state.mode!=='playerDown')return;state.getupCount++;ui.getupCount.textContent=`${state.getupCount} / ${state.getupNeed}`;ui.getupFill.style.width=`${Math.min(100,state.getupCount/state.getupNeed*100)}%`;audio.tone(180+state.getupCount*30,.035,'square',.07);if(state.getupCount>=state.getupNeed){show(ui.getup,false);show(ui.controls,true);state.playerHp=47;state.stamina=72;state.mode='fight';state.foe.next=1.1;announce('BACK UP!',650);rendererAPI?.playerRise?.();}});

function roundEnd(){
  if(state.mode!=='fight')return;audio.bell();state.mode='corner';show(ui.controls,false);show(ui.telegraph,false);if(state.round>=3){finishBout(state.foeHp<state.playerHp,'JUDGES DECISION');return;}
  const nextRound=state.round+1;ui.cornerEyebrow.textContent=`ROUND ${state.round} COMPLETE`;ui.cornerTitle.textContent='PICK ONE CORNER BOOST';ui.cornerCopy.textContent='Temporary for this bout. Pick a small edge; timing still matters more than stats.';
  const choices=[
    ['SNAP JABS','+8% punch power for the rest of the bout','power'],['DEEP BREATHS','+18% stamina recovery','stam'],['TIGHT SHELL','+12% guard efficiency','guard']
  ];
  ui.cornerChoices.innerHTML=choices.map(c=>`<button class="choice" data-boost="${c[2]}"><b>${c[0]}</b><span>${c[1]}</span><small>TAKE IT →</small></button>`).join('');show(ui.corner,true);
  ui.cornerChoices.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.boost==='power')state.cornerPower*=1.08;if(b.dataset.boost==='stam')state.cornerStam*=1.18;if(b.dataset.boost==='guard')state.cornerGuard*=1.12;show(ui.corner,false);show(ui.controls,true);state.playerHp=Math.min(100,state.playerHp+18);state.foeHp=Math.min(100,state.foeHp+10);state.stamina=100+mods.maxStamina;state.round=nextRound;state.time=60;state.foe.phase=Math.max(state.foe.phase,nextRound);state.mode='fight';state.foe.next=.9;audio.bell();announce(`ROUND ${state.round}`,850);}));
}

function finishBout(win,reason){
  state.lastWin=!!win;state.mode='result';show(ui.controls,false);show(ui.hud,false);show(ui.telegraph,false);show(ui.getup,false);show(ui.result,true);
  const elapsed=Math.max(1,(performance.now()-gameStartedAt)/1000);const xpGain=win?55+state.foeKD*15+state.counters*3:20+state.landed;const creditGain=win?85+state.counters*4:20;
  if(win){meta.wins++;meta.xp+=xpGain;meta.credits+=creditGain;}else{meta.xp+=Math.floor(xpGain*.65);meta.credits+=creditGain;}
  const old=meta.level;meta.level=1+Math.floor(meta.xp/180);if(meta.level>old)announce(`LEVEL ${meta.level}!`,1200);saveMeta();refreshMetaUI();
  ui.resultEyebrow.textContent=win?'BOUT COMPLETE':'BOUT OVER';ui.resultTitle.textContent=win?'YOU TAKE THE CIRCUIT':'GUS HOLDS THE RING';ui.resultCopy.textContent=`${reason}. ${win?`+${xpGain} XP and +${creditGain} credits.`:'You still bank training XP. Learn the attack tells and counter late in the windup.'}`;
  ui.resultStats.innerHTML=`<div><b>${state.landed}</b><small>LANDED</small></div><div><b>${state.counters}</b><small>COUNTERS</small></div><div><b>${state.dodges}</b><small>DODGES</small></div>`;
}

function update(dt){
  rendererAPI?.update?.(dt,state);
  if(state.mode==='playerDown'){state.getupT-=dt;if(state.getupT<=0&&state.getupCount<state.getupNeed){show(ui.getup,false);finishBout(false,'TEN COUNT');}return;}
  if(state.mode!=='fight'){updateHUD();return;}
  state.time-=dt;if(state.time<=0){state.time=0;roundEnd();return;}
  state.actionCd=Math.max(0,state.actionCd-dt);state.dodgeT=Math.max(0,state.dodgeT-dt);state.duckT=Math.max(0,state.duckT-dt);state.playerHitT=Math.max(0,state.playerHitT-dt);state.foeHitT=Math.max(0,state.foeHitT-dt);state.foeStun=Math.max(0,state.foeStun-dt);state.foe.blockT=Math.max(0,state.foe.blockT-dt);
  const regen=(state.guard?8:20)*mods.stamRegen*state.cornerStam;state.stamina=Math.min(100+mods.maxStamina,state.stamina+regen*dt);
  const f=state.foe;
  if(state.foeStun>0){f.mode='stun';show(ui.telegraph,false);}
  else if(f.mode==='stun'){f.mode='idle';f.next=.7;}
  else if(f.mode==='idle'){f.next-=dt;if(f.next<=0)startEnemyAttack();}
  else if(f.mode==='tell'){f.t-=dt;if(f.t<=0){show(ui.telegraph,false);f.mode='active';f.t=f.attack.active;resolveEnemyHit(f.attack);rendererAPI?.foeAttack?.(f.attack);}}
  else if(f.mode==='active'){f.t-=dt;if(f.t<=0){f.mode='recover';f.t=f.attack.recover;}}
  else if(f.mode==='recover'){f.t-=dt;if(f.t<=0){f.mode='idle';const pressure=Math.max(.52,1.25-.13*state.round-.12*(f.phase-1));f.next=rand(pressure,pressure+.55);}}
  updateHUD();
}

function loop(now){const dt=Math.min(.033,(now-last)/1000||.016);last=now;update(dt);rafId=requestAnimationFrame(loop);}rafId=requestAnimationFrame(loop);

// Input: keyboard
const down=new Set();window.addEventListener('keydown',e=>{if(e.repeat)return;down.add(e.code);audio.ensure();if(e.code==='KeyA'||e.code==='ArrowLeft')dodge(-1);if(e.code==='KeyD'||e.code==='ArrowRight')dodge(1);if(e.code==='KeyS'||e.code==='ArrowDown')duck();if(e.code==='KeyJ')playerPunch(-1,down.has('KeyS'));if(e.code==='KeyK')playerPunch(1,down.has('KeyS'));if(e.code==='KeyL')state.guard=true;if(e.code==='Space'){e.preventDefault();specialRush();}});window.addEventListener('keyup',e=>{down.delete(e.code);if(e.code==='KeyL')state.guard=false;});

function bindPress(el,fn,hold=false){
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);el.classList.add('pressed');audio.ensure();fn(true,e);});
  const up=e=>{el.classList.remove('pressed');if(hold)fn(false,e)};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
}
bindPress(ui.leftPunchBtn,()=>playerPunch(-1,stickVector.y>.42));bindPress(ui.rightPunchBtn,()=>playerPunch(1,stickVector.y>.42));bindPress(ui.guardBtn,v=>{state.guard=v;},true);bindPress(ui.rushBtn,()=>specialRush());

let stickPointer=null,stickVector={x:0,y:0},stickLatch={x:0,y:0};
function stickMove(e){if(e.pointerId!==stickPointer)return;const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(e.clientX-cx)/(r.width*.34),y=(e.clientY-cy)/(r.height*.34);const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}stickVector={x,y};ui.stickKnob.style.transform=`translate(${x*40}px,${y*40}px)`;
  if(Math.abs(x)>.58&&Math.abs(stickLatch.x)<.5){dodge(Math.sign(x));stickLatch.x=x;}if(Math.abs(x)<.25)stickLatch.x=0;
  if(y>.58&&stickLatch.y<.5){duck();stickLatch.y=y;}if(y<.25)stickLatch.y=0;
}
ui.stick.addEventListener('pointerdown',e=>{e.preventDefault();if(stickPointer!=null)return;stickPointer=e.pointerId;ui.stick.setPointerCapture(e.pointerId);stickMove(e);});ui.stick.addEventListener('pointermove',stickMove);function endStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;stickVector={x:0,y:0};stickLatch={x:0,y:0};ui.stickKnob.style.transform='translate(0,0)';}ui.stick.addEventListener('pointerup',endStick);ui.stick.addEventListener('pointercancel',endStick);

// Two-finger pinch on the render surface.
const pinch=new Map();let pinchStart=0,zoomStart=1;
ui.stage.addEventListener('pointerdown',e=>{pinch.set(e.pointerId,[e.clientX,e.clientY]);if(pinch.size===2){const p=[...pinch.values()];pinchStart=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);zoomStart=state.cameraZoom;}});
ui.stage.addEventListener('pointermove',e=>{if(!pinch.has(e.pointerId))return;pinch.set(e.pointerId,[e.clientX,e.clientY]);if(pinch.size===2&&pinchStart){const p=[...pinch.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);state.cameraZoom=clamp(zoomStart*(pinchStart/d),.82,1.22);rendererAPI?.setZoom?.(state.cameraZoom);}});
['pointerup','pointercancel'].forEach(ev=>ui.stage.addEventListener(ev,e=>{pinch.delete(e.pointerId);if(pinch.size<2)pinchStart=0;}));

// Renderers -----------------------------------------------------------------
async function bootRenderer(){
  if(new URLSearchParams(location.search).has('legacy')){rendererAPI=createWebGL1Renderer();ui.rendererBadge.textContent=rendererAPI.label;return;}
  try{
    const THREE=await Promise.race([import(THREE_CDN),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Three.js load timeout')),6000))]);rendererAPI=await createThreeRenderer(THREE);ui.rendererBadge.textContent=rendererAPI.label;
  }catch(err){console.warn('Modern renderer unavailable; starting WebGL1 compatibility renderer.',err);rendererAPI=createWebGL1Renderer();ui.rendererBadge.textContent=rendererAPI.label;}
}

async function createThreeRenderer(THREE){
  const renderer=new THREE.WebGPURenderer({antialias:true,alpha:false});renderer.setClearColor(0x080610,1);renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.55:2));renderer.setSize(innerWidth,innerHeight);ui.stage.appendChild(renderer.domElement);await renderer.init();
  renderer.shadowMap.enabled=true;if(THREE.PCFShadowMap)renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x080610);scene.fog=new THREE.FogExp2(0x0d0818,.032);
  const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,80);camera.position.set(0,3.2,7.45);camera.lookAt(0,2.15,-1.2);
  const coarse=matchMedia('(pointer:coarse)').matches;const pixelCap=Math.min(devicePixelRatio,coarse?1.55:2);let pixelRatio=pixelCap,perfFrames=0,perfStart=performance.now();
  const hemi=new THREE.HemisphereLight(0x7faaff,0x321828,1.3);scene.add(hemi);const key=new THREE.SpotLight(0xfff1d4,120,28,Math.PI/4,.5,1.3);key.position.set(-4,10,5);key.target.position.set(0,1,-1);key.castShadow=true;key.shadow.mapSize.set(matchMedia('(pointer:coarse)').matches?1024:2048,matchMedia('(pointer:coarse)').matches?1024:2048);key.shadow.radius=2;key.shadow.bias=-0.00025;scene.add(key,key.target);const rim=new THREE.SpotLight(0x8b4cff,90,25,Math.PI/3,.65,1.4);rim.position.set(5,7,-5);rim.target.position.set(0,1.6,-1);scene.add(rim,rim.target);
  const mat=(color,rough=.68,metal=.03)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
  const ring=new THREE.Group();scene.add(ring);const platform=new THREE.Mesh(new THREE.BoxGeometry(8.6,.48,7.2),mat(0x17121e,.83));platform.position.y=.2;platform.receiveShadow=true;ring.add(platform);const canvasMat=mat(0x2a3152,.9);const canvas=new THREE.Mesh(new THREE.BoxGeometry(7.8,.10,6.4),canvasMat);canvas.position.y=.5;canvas.receiveShadow=true;ring.add(canvas);
  const postGeo=new THREE.BoxGeometry(.24,2.6,.24);for(const x of [-3.7,3.7])for(const z of [-2.95,2.95]){const p=new THREE.Mesh(postGeo,mat(0x20202a,.55,.25));p.position.set(x,1.65,z);p.castShadow=true;ring.add(p);}const ropeMat=mat(0xff3e59,.55,.1);
  function rope(x1,z1,x2,z2,y){const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);const m=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,len,8),ropeMat);m.position.set((x1+x2)/2,y,(z1+z2)/2);m.rotation.z=Math.PI/2;m.rotation.y=-Math.atan2(dz,dx);ring.add(m);}for(const y of [1.15,1.65,2.15]){rope(-3.7,-2.95,3.7,-2.95,y);rope(-3.7,2.95,3.7,2.95,y);rope(-3.7,-2.95,-3.7,2.95,y);rope(3.7,-2.95,3.7,2.95,y);}
  // arena walls and low-poly audience
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(13,13,6,16,1,true),new THREE.MeshStandardMaterial({color:0x0c0914,roughness:1,side:THREE.BackSide}));wall.position.y=3.2;scene.add(wall);
  const crowd=new THREE.Group();const crowdGeo=new THREE.BoxGeometry(.22,.42,.22);const crowdMats=[mat(0x452458),mat(0x174e66),mat(0x653247),mat(0x494118),mat(0x253e37)];for(let i=0;i<150;i++){const a=i/150*Math.PI*2+rand(-.03,.03),r=rand(7.2,10.8);const person=new THREE.Mesh(crowdGeo,crowdMats[i%crowdMats.length]);person.position.set(Math.cos(a)*r,rand(1.15,3.4),Math.sin(a)*r-1);person.rotation.y=-a+Math.PI/2;person.userData.phase=Math.random()*6.28;crowd.add(person);}scene.add(crowd);
  const signMat=new THREE.MeshStandardMaterial({color:0x164c55,emissive:0x49e5ff,emissiveIntensity:3.2,roughness:.38,metalness:.18});for(let i=0;i<10;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(rand(.3,.75),rand(.04,.08),.03),signMat);const a=i/10*Math.PI*2;s.position.set(Math.cos(a)*8,rand(2.8,4.7),Math.sin(a)*8-1);s.lookAt(0,2,-1);scene.add(s);}
  function makeFighter(colors,scale=1){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);const skin=mat(colors.skin,.78),kit=mat(colors.kit,.62,.05),trim=mat(colors.trim,.56,.1),glove=mat(colors.glove,.43,.12),shoe=mat(colors.shoe,.5,.08);
    const torso=new THREE.Mesh(new THREE.BoxGeometry(1.05*scale,1.2*scale,.56*scale),kit);torso.position.y=2.1*scale;body.add(torso);const belly=new THREE.Mesh(new THREE.BoxGeometry(.95*scale,.48*scale,.58*scale),trim);belly.position.y=1.52*scale;body.add(belly);const head=new THREE.Mesh(new THREE.SphereGeometry(.42*scale,8,6),skin);head.scale.set(1,.95,.86);head.position.y=3.05*scale;body.add(head);
    const nose=new THREE.Mesh(new THREE.BoxGeometry(.13*scale,.13*scale,.18*scale),skin);nose.position.set(0,3.03*scale,.40*scale);body.add(nose);
    const arms=[];for(const side of [-1,1]){const shoulder=new THREE.Group();shoulder.position.set(side*.65*scale,2.55*scale,0);body.add(shoulder);const upper=new THREE.Mesh(new THREE.BoxGeometry(.34*scale,.78*scale,.34*scale),skin);upper.position.y=-.34*scale;shoulder.add(upper);const elbow=new THREE.Group();elbow.position.y=-.7*scale;shoulder.add(elbow);const fore=new THREE.Mesh(new THREE.BoxGeometry(.32*scale,.62*scale,.32*scale),skin);fore.position.y=-.28*scale;elbow.add(fore);const g=new THREE.Mesh(new THREE.SphereGeometry(.30*scale,7,5),glove);g.scale.set(1.15,.9,1.15);g.position.set(0,-.62*scale,.05*scale);elbow.add(g);arms.push({shoulder,elbow,glove:g});}
    const legs=[];for(const side of [-1,1]){const hip=new THREE.Group();hip.position.set(side*.28*scale,1.28*scale,0);body.add(hip);const leg=new THREE.Mesh(new THREE.BoxGeometry(.38*scale,.95*scale,.4*scale),skin);leg.position.y=-.45*scale;hip.add(leg);const foot=new THREE.Mesh(new THREE.BoxGeometry(.42*scale,.25*scale,.64*scale),shoe);foot.position.set(0,-.98*scale,.10*scale);hip.add(foot);legs.push(hip);}
    [torso,belly,head,nose,...arms.flatMap(a=>[a.shoulder.children[0],a.elbow.children[0],a.glove]),...legs.flatMap(l=>l.children)].forEach(o=>{if(o?.isMesh){o.castShadow=true;o.receiveShadow=true;}});return {root,body,head,arms,legs,torso};
  }
  const player=makeFighter({skin:0xbf734e,kit:0x1369a0,trim:0xe8e7dc,glove:0xe02f47,shoe:0xf0ede5},.86);player.root.position.set(0,.5,2.08);player.root.rotation.y=Math.PI;scene.add(player.root);const foe=makeFighter({skin:0x8c573f,kit:0x4b2439,trim:0xffcb3f,glove:0x7428c4,shoe:0x18131d},1.12);foe.root.position.set(0,.5,-1.14);scene.add(foe.root);
  const impactGeo=new THREE.RingGeometry(.14,.22,12);const impacts=[];for(let i=0;i<8;i++){const m=new THREE.Mesh(impactGeo,new THREE.MeshBasicMaterial({color:i%2?0xffe269:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-.25;scene.add(m);impacts.push({m,t:0});}
  let shake=0,pPunch=0,pSide=0,pBody=false,special=0,playerDown=false,foeDown=false,baseZoom=1;
  function burst(pos,strong=1){const q=impacts.find(x=>x.t<=0);if(!q)return;q.t=.2;q.m.position.copy(pos);q.m.position.z+=.36;q.m.scale.setScalar(.5);q.m.material.opacity=.95*strong;}
  function resize(){renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);
  renderer.setAnimationLoop(()=>{const t=performance.now()/1000;crowd.children.forEach((p,i)=>p.position.y+=Math.sin(t*2.6+p.userData.phase)*.0009);for(const q of impacts){if(q.t>0){q.t-=.016;q.m.scale.multiplyScalar(1.12);q.m.material.opacity=Math.max(0,q.t*4.2);}}
    const sx=shake>0?rand(-shake,shake):0,sy=shake>0?rand(-shake,shake):0;shake*=.82;const z=7.45*baseZoom;camera.position.set(sx,3.2+sy,z);camera.lookAt(0,2.12,-1.05);
    // player pose
    const dodgeX=(state.dodgeT>0?Math.sign(stickVector.x||pSide)*.7:0);player.root.position.x=lerp(player.root.position.x,dodgeX,.22);player.body.rotation.z=lerp(player.body.rotation.z,state.dodgeT>0?-dodgeX*.28:0,.2);player.body.position.y=lerp(player.body.position.y,state.duckT>0?-.64:playerDown?-1.2:0,.22);
    player.arms[0].shoulder.rotation.x=lerp(player.arms[0].shoulder.rotation.x,state.guard?-1.15:pPunch>0&&pSide<0?-2.05:-.35,.22);player.arms[1].shoulder.rotation.x=lerp(player.arms[1].shoulder.rotation.x,state.guard?-1.15:pPunch>0&&pSide>0?-2.05:-.35,.22);player.arms[0].shoulder.rotation.z=lerp(player.arms[0].shoulder.rotation.z,state.guard?.35:.12,.2);player.arms[1].shoulder.rotation.z=lerp(player.arms[1].shoulder.rotation.z,state.guard?-.35:-.12,.2);pPunch=Math.max(0,pPunch-.018);special=Math.max(0,special-.016);
    // foe pose based on AI
    foe.body.position.y=lerp(foe.body.position.y,foeDown?-1.45:state.foe.mode==='stun'?.12:0,.16);foe.body.rotation.z=lerp(foe.body.rotation.z,foeDown?1.25:state.foe.mode==='stun'?Math.sin(t*34)*.12:0,.2);let attackArm=state.foe.side<0?0:1,other=1-attackArm;let punchRot=-1.08,otherRot=-1.02;if(state.foe.mode==='tell'){punchRot=-.58;otherRot=-1.18;}else if(state.foe.mode==='active'){punchRot=-2.05;otherRot=-1.12;}else if(state.foe.mode==='recover'){punchRot=state.foe.blockT>0?-1.18:-.38;otherRot=state.foe.blockT>0?-1.18:-.44;}else if(state.foe.mode==='stun'){punchRot=otherRot=-.22;}foe.arms[attackArm].shoulder.rotation.x=lerp(foe.arms[attackArm].shoulder.rotation.x,punchRot,.23);foe.arms[other].shoulder.rotation.x=lerp(foe.arms[other].shoulder.rotation.x,otherRot,.18);foe.body.rotation.y=lerp(foe.body.rotation.y,state.foe.mode==='tell'?state.foe.side*.18:0,.16);
    perfFrames++;const pn=performance.now();if(pn-perfStart>2200){const fps=perfFrames*1000/(pn-perfStart);let next=pixelRatio;if(fps<48)next=Math.max(1,pixelRatio*.88);else if(fps>58)next=Math.min(pixelCap,pixelRatio*1.05);if(Math.abs(next-pixelRatio)>.04){pixelRatio=next;renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight,false);}perfFrames=0;perfStart=pn;}
    renderer.render(scene,camera);
  });
  const backend=renderer.backend?.isWebGPUBackend?'WEBGPU':'WEBGL2';
  return {label:`THREE r186 · ${backend}`,setZoom:z=>baseZoom=z,reset(){playerDown=false;foeDown=false;player.root.position.x=0;foe.body.position.y=0;},update(){},foeTell(a){},foeAttack(a){shake=.018;},miss(){shake=.008;},punch(hand,body){pPunch=.24;pSide=hand;pBody=body;},dodge(dir){pSide=dir;},duck(){},playerHit(){shake=.055;burst(new THREE.Vector3(0,2.5,2.1),.8);},foeHit(hand,body,dmg,counter){shake=counter?.08:.035;burst(new THREE.Vector3(hand*.27,body?1.75:2.9,-.72),counter?1:.8);},special(){special=.7;shake=.03;},foeDown(){foeDown=true;},foeRise(){foeDown=false;},playerDown(){playerDown=true;},playerRise(){playerDown=false;}};
}

function createWebGL1Renderer(){
  const canvas=document.createElement('canvas');ui.stage.appendChild(canvas);const gl=canvas.getContext('webgl',{antialias:true,alpha:false})||canvas.getContext('experimental-webgl');if(!gl){canvas.remove();const safe=document.createElement('canvas');ui.stage.appendChild(safe);return createCanvasFallback(safe,safe.getContext('2d'));}
  const vs=`attribute vec2 p;uniform vec2 r;void main(){vec2 z=p/r*2.0-1.0;gl_Position=vec4(z.x,-z.y,0.0,1.0);}`;const fs=`precision mediump float;uniform vec4 c;void main(){gl_FragColor=c;}`;const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);gl.useProgram(prog);const locP=gl.getAttribLocation(prog,'p'),locR=gl.getUniformLocation(prog,'r'),locC=gl.getUniformLocation(prog,'c'),buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locP,2,gl.FLOAT,false,0,0);
  const rgba=h=>[((h>>16)&255)/255,((h>>8)&255)/255,(h&255)/255,1];
  function poly(points,color){gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.DYNAMIC_DRAW);gl.uniform4fv(locC,rgba(color));gl.drawArrays(gl.TRIANGLE_FAN,0,points.length);}function rect(x,y,w,h,c){poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],c)}
  function resize(){canvas.width=innerWidth;canvas.height=innerHeight;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(locR,canvas.width,canvas.height);}resize();addEventListener('resize',resize);
  let zoom=1,shake=0,foeDown=false,playerDown=false;function render(){const w=canvas.width,h=canvas.height,s=Math.min(w,h)/zoom,cx=w/2;gl.clearColor(.03,.02,.06,1);gl.clear(gl.COLOR_BUFFER_BIT);let sy=shake?rand(-shake,shake)*s:0;shake*=.85;poly([[w*.12,h*.24+sy],[w*.88,h*.24+sy],[w*.96,h*.86+sy],[w*.04,h*.86+sy]],0x252b4b);for(const y of [.37,.46,.55]){rect(w*.07,h*y+sy,w*.86,3,0xe33955)}
    // crowd blocks
    for(let i=0;i<26;i++){const x=(i%13)/12*w*.9+w*.05,y=Math.floor(i/13)*h*.09+h*.08;rect(x,y,Math.max(5,w*.018),Math.max(9,h*.045),[0x402250,0x164e63,0x5b2f42][i%3]);}
    const fx=cx,fy=foeDown?h*.52:h*.28;rect(fx-s*.075,fy+sy,s*.15,s*.18,0x4b2439);rect(fx-s*.05,fy-s*.09+sy,s*.1,s*.09,0x8c573f);rect(fx-s*.13,fy+s*.03+sy,s*.05,s*.13,0x8c573f);rect(fx+s*.08,fy+s*.03+sy,s*.05,s*.13,0x8c573f);rect(fx-s*.145,fy+s*.13+sy,s*.065,s*.065,0x7428c4);rect(fx+s*.08,fy+s*.13+sy,s*.065,s*.065,0x7428c4);
    const px=cx+stickVector.x*s*.08,py=playerDown?h*.75:h*.64+(state.duckT>0?s*.055:0);rect(px-s*.1,py+sy,s*.2,s*.19,0x1369a0);rect(px-s*.06,py-s*.08+sy,s*.12,s*.09,0xbf734e);rect(px-s*.16,py+s*.01+sy,s*.06,s*.13,0xbf734e);rect(px+s*.1,py+s*.01+sy,s*.06,s*.13,0xbf734e);rect(px-s*.18,py+s*.10+sy,s*.08,s*.07,0xe02f47);rect(px+s*.1,py+s*.10+sy,s*.08,s*.07,0xe02f47);requestAnimationFrame(render);}requestAnimationFrame(render);
  return {label:'WEBGL1 COMPAT · GLSL',setZoom:z=>zoom=z,reset(){foeDown=playerDown=false;},update(){},foeAttack(){shake=.012;},miss(){},punch(){},dodge(){},duck(){},playerHit(){shake=.035;},foeHit(){shake=.045;},special(){shake=.06;},foeDown(){foeDown=true;},foeRise(){foeDown=false;},playerDown(){playerDown=true;},playerRise(){playerDown=false;}};
}
function createCanvasFallback(canvas,ctx){let zoom=1;function resize(){canvas.width=innerWidth;canvas.height=innerHeight;}resize();addEventListener('resize',resize);function draw(){ctx.fillStyle='#080610';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#232a48';ctx.fillRect(0,canvas.height*.28,canvas.width,canvas.height*.6);ctx.fillStyle='#e43d59';for(const y of [.38,.47,.56])ctx.fillRect(0,canvas.height*y,canvas.width,3);const sc=1/zoom;ctx.fillStyle='#4b2439';ctx.fillRect(canvas.width*(.5-.07*sc),canvas.height*.3,canvas.width*.14*sc,canvas.height*.22*sc);ctx.fillStyle='#176b9e';ctx.fillRect(canvas.width*(.5-.12*sc),canvas.height*.63,canvas.width*.24*sc,canvas.height*.23*sc);requestAnimationFrame(draw)}draw();return {label:'CANVAS SAFE MODE',setZoom:z=>zoom=z,reset(){},update(){}};}

bootRenderer();
