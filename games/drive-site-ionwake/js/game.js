/* IONWAKE — complete game integration and presentation. */
(() => {
  'use strict';
  const E=My3D2dge,$=id=>document.getElementById(id),TAU=Math.PI*2;
  const defaults={difficulty:'pilot',steering:'keyboard',aimAssist:true,autoFire:false,invertY:false,sensitivity:1,filter:'off',levels:6,edge:.7,pixel:3,dither:.2,saturation:1,reduceMotion:!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,volume:60,music:true};
  const stored=E.store.get('ionwake-settings-v1',{});const settings={...defaults};
  for(const key in defaults)if(typeof stored?.[key]===typeof defaults[key])settings[key]=stored[key];
  settings.difficulty=['cadet','pilot','ace'].includes(settings.difficulty)?settings.difficulty:'pilot';settings.filter=['off','cel','pixel','hybrid'].includes(settings.filter)?settings.filter:'off';
  const game=new E.Game({canvas:'screen',res:[1280,720],view:'overhead',views:['overhead'],bg:'#16323b',input:{...E.Input.SHMUP,fire:['Space','KeyJ','KeyZ','Mouse0','Pad0','Pad7'],bomb:['KeyX','Mouse2','Pad1'],rollL:['KeyQ','Pad4'],rollR:['KeyE','Pad5'],boost:['ShiftLeft','ShiftRight','Pad3'],brake:['KeyC','ControlLeft','ControlRight','Pad6']}});
  game.cam.smooth=0;game.pauseOverlay=false;game.reduceMotion=settings.reduceMotion;
  const renderer=new IonRenderer();let mission=null,titleTime=0,record=E.store.get('ionwake-record-v1',null),lastResult=null,dialogReturnPaused=false;
  let toastUntil=0,radioUntil=0,messageUntil=0,warningUntil=0,uiTime=0,activeMusic='',lastHudTick=-1;
  const touch={active:false,x:0,y:0};const coarse=window.matchMedia?.('(pointer: coarse)').matches||false;
  const sc=game.screen;
  const fx=new IonPostFX({sourceCanvas:sc.buf,outputCanvas:$('gpu-screen'),onStatus:s=>{ $('gpu-status').textContent=s.message;if(s.state!=='ready')$('gpu-screen').style.visibility='hidden'; }});
  // Fractional presentation fixes the engine's integer-only fit on small screens.
  sc.resize=function(){const rect=this.canvas.getBoundingClientRect(),scale=Math.min(1280/Math.max(1,rect.width),720/Math.max(1,rect.height)),dpr=Math.min(window.devicePixelRatio||1,1.5);this.W=Math.max(240,Math.round(rect.width*scale));this.H=Math.max(180,Math.round(rect.height*scale));this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);this.dpr=dpr;this.S=this.canvas.width/this.W;this.OX=0;this.OY=0;this.buf.width=this.W;this.buf.height=this.H;this.ctx=this.buf.getContext('2d');this.ctx.imageSmoothingEnabled=true;this.ctx._c=null;this.portrait=rect.height>rect.width;};
  sc.present=function(){this.sctx.imageSmoothingEnabled=true;this.sctx.drawImage(this.buf,0,0,this.W,this.H,0,0,this.canvas.width,this.canvas.height);$('gpu-screen').style.visibility=fx.render()?'visible':'hidden';};
  sc.resize();
  const MUSIC={
    flight:{bpm:122,steps:4,tracks:[
      {wave:'triangle',vol:.12,notes:'D3 . D4 . D3 . A3 . D3 . D4 . D3 . A3 . | Bb2 . Bb3 . Bb2 . F3 . Bb2 . Bb3 . Bb2 . F3 . | F3 . F4 . F3 . C4 . F3 . F4 . F3 . C4 . | C3 . C4 . C3 . G3 . A2 . A3 . A2 . E3 .'},
      {wave:'pulse',vol:.045,notes:'D5 - A4 . F5 - E5 . D5 - - . A4 . C5 . | D5 - F5 . A5 - G5 . F5 - - . D5 . C5 . | A4 - C5 . F5 - G5 . A5 - - . G5 . F5 . | E5 - D5 . C5 - A4 . D5 - - - - - . .'},
      {wave:'sine',vol:.06,notes:'D4 . F4 . A4 . F4 . D4 . A4 . F4 . A4 . | Bb3 . D4 . F4 . D4 . Bb3 . F4 . D4 . F4 . | F4 . A4 . C5 . A4 . F4 . C5 . A4 . C5 . | C4 . E4 . G4 . E4 . A3 . C#4 . E4 . C#4 .'},
      {wave:'drums',vol:.067,notes:'k . h . s . h . k h . h s . h o'}]},
    boss:{bpm:146,steps:4,tracks:[
      {wave:'triangle',vol:.14,notes:'D3 D3 . A3 D3 . F3 . D3 D3 . A3 D3 . C4 . | Bb2 Bb2 . F3 Bb2 . D3 . C3 C3 . G3 A2 . E3 .'},
      {wave:'pulse',vol:.048,notes:'D5 . F5 . E5 . D5 . A4 - C5 . D5 . . . | G5 . F5 . E5 . C5 . A4 - C#5 . D5 - . .'},
      {wave:'saw',vol:.022,notes:'D4 . A4 . D5 . A4 . D4 . A4 . F5 . E5 . | Bb3 . F4 . Bb4 . A4 . C4 . G4 . A4 . C#5 .'},
      {wave:'drums',vol:.09,notes:'k h h . s h h . k . k h s h h o'}]},
    victory:{bpm:104,steps:4,tracks:[
      {wave:'triangle',vol:.09,notes:'F3 - C4 - F3 - A3 - | Bb2 - F3 - Bb3 - D4 - | C3 - G3 - E4 - G4 - | F3 - - - - - - -'},
      {wave:'sine',vol:.1,notes:'F5 - - A5 C6 - A5 - | Bb5 - A5 - F5 - D5 - | E5 - G5 - C6 - Bb5 - | A5 - F5 - - - - -'}]}
  };
  const sounds={
    ionlaser:{wave:'triangle',freq:1300,to:230,dur:.105,vol:.14},overlaser:[{wave:'triangle',freq:1600,to:390,dur:.12,vol:.15},{wave:'sine',freq:700,to:1400,dur:.11,vol:.04}],
    ionroll:[{wave:'noise',freq:500,to:3700,dur:.42,vol:.13},{wave:'sine',freq:150,to:760,dur:.4,vol:.1}],
    ionexplode:[{wave:'noise',freq:900,to:100,dur:.43,vol:.24},{wave:'triangle',freq:150,to:40,dur:.3,vol:.25}],
    ionpulse:[{wave:'noise',freq:1600,to:90,dur:.9,vol:.31},{wave:'sine',freq:240,to:32,dur:.9,vol:.34},{wave:'triangle',freq:100,to:340,dur:.25,vol:.12}],
    ionhurt:[{wave:'noise',freq:620,to:110,dur:.2,vol:.21},{wave:'saw',freq:135,to:75,dur:.19,vol:.13}],
    return:{wave:'sine',freq:500,to:1500,dur:.18,vol:.2,arp:[0,7,12],step:.05},
    enemyfire:{wave:'sine',freq:380,to:170,dur:.19,vol:.1},warning:{wave:'triangle',freq:650,arp:[0,0,-5,-5,0,0],step:.085,dur:.5,vol:.12}
  };
  for(const[name,voice]of Object.entries(sounds))game.audio.define(name,voice);
  function setMusic(name){activeMusic=name;if(settings.music&&MUSIC[name])game.audio.music(MUSIC[name]);else game.audio.music(null);}
  game.audio.setVolume(settings.volume/100);
  function text(id,value){const el=$(id),s=String(value);if(el.textContent!==s)el.textContent=s;}
  function visible(id,on){$(id).hidden=!on;}
  function announce(value){text('live-status',value);}
  function toast(value,duration=2.5){text('toast',value);toastUntil=uiTime+duration;visible('toast',true);}
  function radio(name,value){text('radio-name',name);text('radio-callsign',name);text('radio-text',value);radioUntil=uiTime+6;visible('radio',true);drawPortrait(name);announce(`${name}: ${value}`);game.audio.sfx('blip',{vol:.45});}
  function message(kicker,title,value,duration=4.2){text('message-kicker',kicker);text('message-title',title);text('message-body',value);messageUntil=uiTime+duration;visible('center-message',true);announce(title+'. '+value);}
  function drawPortrait(name){const c=$('portrait'),g=c.getContext('2d');g.clearRect(0,0,80,80);g.fillStyle='#234d56';g.fillRect(0,0,80,80);for(let y=0;y<80;y+=4){g.fillStyle=y%8?'#285661':'#204851';g.fillRect(0,y,80,2);}g.fillStyle='#132e3e';g.beginPath();g.moveTo(12,80);g.lineTo(20,51);g.lineTo(30,44);g.lineTo(49,44);g.lineTo(61,51);g.lineTo(70,80);g.fill();g.fillStyle=name==='MICA'?'#d78765':'#a2bdaf';g.fillRect(30,41,19,15);g.fillStyle=name==='MICA'?'#ecb18a':'#89d8c7';g.beginPath();g.moveTo(25,20);g.lineTo(53,17);g.lineTo(57,38);g.lineTo(48,52);g.lineTo(34,51);g.lineTo(23,35);g.fill();g.fillStyle='#172e3b';g.beginPath();g.moveTo(19,29);g.lineTo(25,10);g.lineTo(46,8);g.lineTo(57,15);g.lineTo(57,29);g.lineTo(47,21);g.lineTo(30,22);g.lineTo(25,40);g.lineTo(19,39);g.fill();g.fillStyle=name==='MICA'?'#94f5d2':'#f4be7d';g.fillRect(28,29,26,8);g.fillStyle='#41766d';g.fillRect(30,33,23,3);g.fillStyle='#e8e6c9';g.fillRect(22,30,4,13);g.fillRect(54,26,4,15);g.fillStyle='#b8d5c5';g.fillRect(36,53,8,20);g.fillStyle='#f49163';g.fillRect(17,63,8,4);g.fillStyle='#7ee5bf';g.fillRect(60,50,2,12);}
  function onEvent(e){switch(e.type){
    case'sfx':game.audio.sfx(e.name);break;case'toast':toast(e.text);break;case'radio':radio(e.name,e.text);break;case'message':message(e.kicker,e.title,e.text);break;
    case'warning':toast(e.text,1.4);warningUntil=uiTime+1.4;break;case'damage':if(!settings.reduceMotion)game.shake(2);break;
    case'boss':setMusic('boss');break;case'victory':setMusic('victory');break;
    case'complete':game.go('result',{success:true},{fade:.5});break;case'failure':game.go('result',{success:false},{fade:.35});break;
  }}
  function resetMessages(){toastUntil=radioUntil=messageUntil=warningUntil=0;uiTime=0;for(const id of ['toast','radio','center-message','boss-hud','route-choice','target-label'])visible(id,false);}
  function launch(snapshot=null,retries=0){if(document.querySelector('dialog[open]'))return;game.input.clear();game.audio.sfx('confirm');game.go('mission',{snapshot,retries},{fade:.35});$('screen').focus();}
  function returnTitle(){game.input.clear();game.paused=false;game.go('title',null,{fade:.25});}
  function retry(){if(lastResult?.success)launch();else launch(mission?.checkpoint||null,(mission?.retries||0)+1);}
  function pause(){if(game.sceneName!=='mission'||mission?.status!=='flight')return;game.paused=true;game.input.clear();visible('pause-screen',true);$('resume').focus();}
  function resume(){game.paused=false;game.input.clear();visible('pause-screen',false);$('screen').focus();}
  function openDialog(id){dialogReturnPaused=game.paused;if(game.sceneName==='mission')game.paused=true;game.input.clear();$(id).showModal();}
  for(const d of document.querySelectorAll('dialog')){d.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>d.close()));d.addEventListener('close',()=>{game.paused=dialogReturnPaused;game.input.clear();if(game.sceneName==='mission'&&!game.paused)$('screen').focus();});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});}
  // Let native dialog controls receive their own keys, including range arrows.
  window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopImmediatePropagation();},{capture:true});
  $('launch').onclick=()=>launch();$('open-settings').onclick=()=>openDialog('settings-dialog');$('open-controls').onclick=()=>openDialog('controls-dialog');$('open-credits').onclick=()=>openDialog('credits-dialog');$('pause-button').onclick=pause;$('resume').onclick=resume;$('pause-settings').onclick=()=>openDialog('settings-dialog');$('pause-controls').onclick=()=>openDialog('controls-dialog');$('restart-checkpoint').onclick=()=>launch(mission?.checkpoint||null,(mission?.retries||0)+1);$('quit').onclick=returnTitle;$('retry').onclick=retry;$('result-title-button').onclick=returnTitle;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
  const fields={'difficulty':'difficulty','steering':'steering','aim-assist':'aimAssist','auto-fire':'autoFire','invert-y':'invertY','sensitivity':'sensitivity','filter':'filter','levels':'levels','edge':'edge','pixel':'pixel','dither':'dither','saturation':'saturation','reduce-motion':'reduceMotion','volume':'volume','music':'music'};
  async function applySettings(checkGPU=false){
    E.store.set('ionwake-settings-v1',settings);game.reduceMotion=settings.reduceMotion;game.audio.setVolume(E.clamp(settings.volume,0,100)/100);
    if(mission)mission.aimAssist=settings.aimAssist;
    fx.setOptions({mode:settings.filter,levels:settings.levels,edgeStrength:settings.edge,pixelSize:settings.pixel,dither:settings.dither,saturation:settings.saturation});
    if(settings.filter==='off')text('gpu-status','Original display active. Select a filter to check WebGPU.');
    else if(checkGPU&&!fx.ready){text('gpu-status','Checking WebGPU support…');await fx.init();}
    for(const id of ['sensitivity','levels','edge','pixel','dither','saturation','volume'])text(id+'-value',id==='volume'?`${settings.volume}%`:['levels','pixel'].includes(id)?settings[id]:Number(settings[id]).toFixed(1));
    $('filter-parameters').style.opacity=settings.filter==='off'?'.5':'1';
  }
  const labels={difficulty:'Difficulty',steering:'Steering','aim-assist':'Aim assist','auto-fire':'Auto fire','invert-y':'Invert vertical control',sensitivity:'Sensitivity',filter:'Display filter',levels:'Colour levels',edge:'Edge strength',pixel:'Pixel size',dither:'Dither',saturation:'Saturation','reduce-motion':'Reduce motion',volume:'Master volume',music:'Music'};
  for(const[id,key]of Object.entries(fields)){const el=$(id);el.setAttribute('aria-label',labels[id]);if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];el.addEventListener('input',()=>{settings[key]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;if(key==='music')setMusic(activeMusic);void applySettings(key==='filter');});}
  void applySettings(settings.filter!=='off');
  // Touch controls use the same engine actions as keys and controller buttons.
  for(const button of document.querySelectorAll('[data-touch]')){const action=button.dataset.touch,code='Touch_'+action;game.input.map[action].push(code);game.input.codes[code]=[action];button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);game.input.press(code);game.audio._init();});for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>game.input.release(code));}
  const stick=$('stick');let stickId=null;
  function moveStick(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.4),dy=(e.clientY-r.top-r.height/2)/(r.height*.4),len=Math.max(1,Math.hypot(dx,dy));touch.x=dx/len;touch.y=dy/len;stick.querySelector('i').style.transform=`translate(${touch.x*30}px,${touch.y*30}px)`;}
  stick.addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(stickId);touch.active=true;moveStick(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,()=>{touch.active=false;touch.x=touch.y=0;stickId=null;stick.querySelector('i').style.transform='';});
  function frameInput(){const i=game.input;let pointer=null;if(settings.steering==='pointer'&&i.mouse.active&&!touch.active){const r=$('screen').getBoundingClientRect();pointer={x:E.clamp(((i.mouse.cx-r.left)/r.width-.5)*77,-31,31),y:E.clamp(22-((i.mouse.cy-r.top)/r.height-.45)*65,5,39)};if(settings.invertY)pointer.y=44-pointer.y;}
    return{move:touch.active?[touch.x,touch.y]:i.move(),pointer,fire:i.down('fire'),rollL:i.pressed('rollL'),rollR:i.pressed('rollR'),bomb:i.pressed('bomb'),boost:i.down('boost'),brake:i.down('brake'),autoFire:settings.autoFire,invert:settings.invertY,sensitivity:settings.sensitivity};}
  function craft(x,y,z,o={},power=1){renderer.mesh(IonMeshes.player,x,y,z,o);const s=o.scale||1,cy=Math.cos(o.yaw||0),sy=Math.sin(o.yaw||0),cp=Math.cos(o.pitch||0),sp=Math.sin(o.pitch||0),cr=Math.cos(o.roll||0),sr=Math.sin(o.roll||0);const tr=a=>{let xx=a[0]*s,yy=a[1]*s,zz=a[2]*s;[yy,zz]=[yy*cp-zz*sp,yy*sp+zz*cp];[xx,zz]=[xx*cy+zz*sy,-xx*sy+zz*cy];return[xx*cr-yy*sr+x,xx*sr+yy*cr+y,zz+z];};for(const side of[-1,1]){const xx=side*1.28,start=tr([xx,-.17,-4.52]);renderer.glow(...start,.75*s,'#73ffdb',.65);renderer.face([tr([xx-.25,-.17,-4.52]),tr([xx+.25,-.17,-4.52]),tr([xx,-.17,-4.52-4.5*power])],'#aaffdf',{alpha:.67,noFog:true});renderer.face([tr([xx,-.4,-4.52]),tr([xx,.06,-4.52]),tr([xx,-.17,-4.52-4.5*power])],'#bbffe8',{alpha:.6,noFog:true});}}
  function drawWorld(r,title=false,result=false){const m=mission,p=m?.player,t=title?titleTime:m?.elapsed||titleTime,dist=title?720+t*42:m?.distance||700;
    const mobile=r.W/r.H<.8;
    let camera=title?{x:-3,y:34,z:dist-36,bank:Math.sin(t*.11)*.008}:{x:(p?.x||0)*.24,y:33+(p?.y||20)*.075,z:dist-38,bank:settings.reduceMotion?0:-(p?.vx||0)*.00055};
    if(!settings.reduceMotion&&m&&m.damageFlash>0){camera.x+=Math.sin(game.real*71)*m.damageFlash*.7;camera.y+=Math.sin(game.real*83)*m.damageFlash*.5;}
    renderer.begin(r.ctx,r.W,r.H,camera,t,title?'approach':m?.phase||'approach');renderer.f=Math.min(r.H*.92,r.W*.79);renderer.scenery(dist,title?'approach':m?.phase,m?.route);
    if(title){
      const x=mobile?7:22,y=21+Math.sin(t*.9)*.7,z=dist+26,scale=mobile?2.15:2.65;
      craft(x,y,z,{scale,yaw:-.32+Math.sin(t*.18)*.12,pitch:.08,roll:.11+Math.sin(t*.43)*.07},1.2);
      craft(-26,33,dist+130,{scale:.8,roll:-.14},1.4);
      renderer.ring(-10,24,dist+450,14,'#92e8c0',t*.1,1);renderer.finish();return;
    }
    if(!m){renderer.finish();return;}
    for(const o of m.obstacles){if(o.type==='pylon'){renderer.mesh(IonMeshes.pylon,o.x,o.y,o.z,{scale:[o.w/6,o.h/30,o.d/7]});renderer.glow(o.x,o.y+o.h*.5,o.z,1,'#ff9967',.9);}else{
      const x=o.x,y=o.y,z=o.z,w=o.w,h=o.h;renderer.box(x-w*.5-3,y,z,6,h+12,8,'#536862','#cec9a4');renderer.box(x+w*.5+3,y,z,6,h+12,8,'#536862','#cec9a4');renderer.box(x,y+h*.5+3,z,w,6,8,'#587368','#cdc7a1');renderer.box(x,y-h*.5-3,z,w,6,8,'#587368','#cdc7a1');renderer.line([x-w*.5,y-h*.5,z-4.1],[x-w*.5,y+h*.5,z-4.1],'#a6f4ce',2,.85);renderer.line([x+w*.5,y-h*.5,z-4.1],[x+w*.5,y+h*.5,z-4.1],'#a6f4ce',2,.85);}}
    for(const q of m.pickups){const c=q.type==='repair'?'#9afcd6':q.type==='upgrade'?'#ffcf78':q.type==='pulse'?'#cfb8ff':'#a0f8ef';renderer.ring(q.x,q.y,q.z,q.r,c,q.age*.5,.8);renderer.ring(q.x,q.y,q.z,q.r+1.2,c,-q.age*.5,.16);if(q.type!=='repair')renderer.mesh(IonMeshes.bossCore,q.x,q.y,q.z,{scale:.4,yaw:q.age*1.3,roll:q.age*.6,tint:c});renderer.glow(q.x,q.y,q.z,.9,c,.65);}
    for(const e of m.enemies){const turret=e.type==='turret';if(turret)renderer.box(e.x,-1,e.z,9,6,10,'#2b464c','#627b70');renderer.mesh(turret?IonMeshes.turret:e.type==='interceptor'?IonMeshes.interceptor:IonMeshes.drone,e.x,e.y,e.z,{yaw:turret?0:Math.PI,roll:turret?0:Math.cos(e.age*1.5+e.phase)*.24,scale:e.type==='pursuer'?1.3:1,flash:e.flash>0});renderer.glow(e.x,e.y+.2,e.z-1.8,.6,e.type==='pursuer'?'#ffb374':'#ff7d96',.8);if(e.type==='pursuer')renderer.ring(e.x,e.y,e.z,7,'#ffb87d',e.age,.15);}
    const a=m.ally;if(a.state!=='lost')craft(a.x,a.y,a.z,{scale:.8,roll:Math.sin(t*.9)*.12,tint:'#b1ded1'},1.3);
    // The carrier enters the view before its combat phase.
    if(!m.boss&&m.elapsed>145){const z=dist+Math.max(270,1400-(m.elapsed-145)*43);renderer.mesh(IonMeshes.bossHull,0,44,z,{scale:2,yaw:Math.PI});renderer.mesh(IonMeshes.bossArm,-30,43,z,{scale:1.5,yaw:Math.PI});renderer.mesh(IonMeshes.bossArm,30,43,z,{scale:1.5,yaw:Math.PI});}
    if(m.boss){const b=m.boss,dead=b.stage==='dead',fall=dead?b.death*b.death*6:0;renderer.mesh(IonMeshes.bossHull,b.x,b.y-fall,b.z,{scale:1.65,yaw:Math.PI,roll:dead?b.death*.1:Math.sin(b.t*.35)*.025,flash:b.flash>0});
      for(const[part,side]of[['left',-1],['right',1]]){if(b[part]>0)renderer.mesh(IonMeshes.bossArm,b.x+side*22,b.y+1,b.z-3,{scale:1.3,yaw:Math.PI,roll:Math.sin(b.t*1.2)*.07,flash:b.flash>0});else if(!dead)renderer.glow(b.x+side*22,b.y,b.z,2.3,'#ee7654',.55);if(b[part]>0)renderer.ring(b.x+side*22,b.y+1,b.z-14,5,'#ffb46d',b.t*.55,.55);}
      if(!dead){renderer.mesh(IonMeshes.bossCore,b.x,b.y,b.z-19,{scale:b.stage==='core'?1.55:1.1,roll:b.t*.4,yaw:b.t*.7,tint:b.coreOpen?'#ffc680':'#466377'});renderer.ring(b.x,b.y,b.z-20,10.5,b.coreOpen?'#ffe0a2':'#e39363',b.t*.6,.8);if(b.coreOpen)renderer.glow(b.x,b.y,b.z-20,6,'#ffb965',.6);if(b.warning>0){renderer.line([-44,b.beamY,b.z-20],[44,b.beamY,b.z-20],'#ffad71',2,.3+Math.sin(t*20)*.2);}}
    }
    for(const s of m.shots){if(s.ally){renderer.line([s.x,s.y,s.z],[s.target.x,s.target.y,s.target.z],'#f4e6bb',1.8,s.life*3);continue;}const c=s.returned?'#ffe2a4':p.overdrive>0?'#fff4aa':'#a0ffdc';renderer.line([s.x,s.y,s.z],[s.x-s.vx*.025,s.y-s.vy*.025,s.z-s.vz*.025],c,2.6);renderer.glow(s.x,s.y,s.z,.52,c,.8);}
    for(const s of m.hostile){const c=s.type==='missile'?'#ffa167':'#ff6388';renderer.glow(s.x,s.y,s.z,s.type==='missile'?2.3:2.1,c,.85);renderer.line([s.x,s.y,s.z],[s.x-s.vx*.04,s.y-s.vy*.04,s.z-s.vz*.04],c,s.type==='missile'?3:2,.9);if(s.type==='missile')renderer.mesh(IonMeshes.bossCore,s.x,s.y,s.z,{scale:.25,tint:'#fff0ae',roll:s.age*5});}
    for(const e of m.effects){const k=1-e.t/e.life;if(e.type==='pulse'){renderer.ring(e.x,e.y,e.z+e.t*100,e.size,'#c9ffe5',0,1.3);renderer.glow(e.x,e.y,e.z,e.size*.8,'#78fccc',k*.35);}else if(e.type==='hit')renderer.glow(e.x,e.y,e.z,1+e.t*13,'#ffeab4',k);else{renderer.glow(e.x,e.y,e.z,(2+e.t*18)*e.size,e.c||'#ffc88b',k);renderer.ring(e.x,e.y,e.z,(1+e.t*19)*e.size,'#f7bd7a',.1,.6*k);}}
    for(const q of m.particles){renderer.mesh(IonMeshes.debris,q.x,q.y,q.z,{scale:q.size,roll:q.life*4,yaw:q.life*3,tint:q.c,alpha:Math.min(1,q.life*3)});}
    for(const q of m.rings)renderer.ring(q.x,q.y,q.z,q.r,q.type==='route'?'#b6ffe1':'#cfffe3',t*.2,q.type==='route'?.5:.2);
    if(!['dead','failure'].includes(m.status)){
      const alpha=p.invincible>0&&Math.sin(t*35)>0?.55:1;renderer.face([[p.x-7,-5.8,p.z-4],[p.x+7,-5.8,p.z-4],[p.x+5,-5.8,p.z+7],[p.x-5,-5.8,p.z+7]],'#16374c',{alpha:.18});
      craft(p.x,p.y,p.z,{roll:p.roll,pitch:p.vy*.008,yaw:-p.vx*.002,alpha},p.boost?2.8:p.brake?.55:1.2);
      if(p.rollTime>0)renderer.ring(p.x,p.y,p.z-2,7,'#b6ffe7',p.roll,.23);if(p.overdrive>0)renderer.glow(p.x,p.y,p.z-3,4,'#ffde9e',.28);
    }
    renderer.finish();
    if(p.boost&&!settings.reduceMotion){const g=r.ctx;g.save();g.strokeStyle='#deffe754';g.lineWidth=1;for(let i=0;i<16;i++){const a=i/16*TAU,rr=.65+(Math.sin(t*4+i*5)+1)*.12,x=r.W/2+Math.cos(a)*r.W*.5*rr,y=r.H*.47+Math.sin(a)*r.H*.48*rr;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*34,y+Math.sin(a)*24);g.stroke();}g.restore();}
    if(m.pulseFlash>0&&!settings.reduceMotion){r.ctx.fillStyle=`rgba(199,255,228,${m.pulseFlash*.4})`;r.ctx.fillRect(0,0,r.W,r.H);}
    if(!result)drawHud(r);
  }
  function drawHud(r){const m=mission,p=m.player,aim=m.getAim(),a=renderer.project(aim.x,aim.y,aim.z),near=renderer.project(p.x+(aim.x-p.x)*.32,p.y+(aim.y-p.y)*.32,p.z+54);
    if(a){$('reticle').style.left=a.x/r.W*100+'%';$('reticle').style.top=a.y/r.H*100+'%';}if(near){$('near-reticle').style.left=near.x/r.W*100+'%';$('near-reticle').style.top=near.y/r.H*100+'%';}
    const locked=m.targets().some(e=>{const pt=renderer.project(e.x,e.y,e.z);return pt&&a&&e.open!==false&&Math.hypot(pt.x-a.x,pt.y-a.y)<26;});$('reticle').classList.toggle('locked',locked);
    $('damage-flash').style.opacity=settings.reduceMotion?'0':m.damageFlash*.65;
    if(lastHudTick!==Math.floor(m.elapsed*12)){lastHudTick=Math.floor(m.elapsed*12);$('app').dataset.flight=JSON.stringify({elapsed:+m.elapsed.toFixed(2),frameMs:+game.stats.frameMs.toFixed(2),renderMs:+game.stats.renderMs.toFixed(2),faces:renderer.renderStats.faces,shots:m.shotCount,returns:m.returns,errors:game.errors.length,playerX:+p.x.toFixed(1),playerY:+p.y.toFixed(1)});text('score',String(m.score).padStart(6,'0'));text('combo','×'+m.multiplier);text('hull-value',Math.ceil(p.hp));$('hull-fill').style.width=p.hp+'%';$('hull-fill').style.background=p.hp<30?'#ff9b70':'#96f5cf';$('energy-fill').style.width=p.energy+'%';$('charge-fill').style.width=(p.overdrive>0?p.overdrive/8*100:p.charge)+'%';text('charge-label',p.overdrive>0?'ON':Math.round(p.charge)+'%');text('ship-state',p.hp<30?'HULL LOW':'KITE 01');text('speed-label',p.boost?'BOOST':p.brake?'BRAKE':'CRUISE');text('bombs',Array.from({length:p.bombs},()=> '●').join(' ')||'EMPTY');text('weapon-label',p.overdrive>0?'OVERDRIVE':p.weapon>=2?'TWIN CANNON':'ION CANNON');text('rescue-status',m.ally.saved?'MICA / SAFE':m.ally.state==='pursued'?`PURSUERS / ${3-m.rescueKills}`:m.ally.state==='lost'?'MICA / WITHDRAWN':'MICA / IN FORMATION');$('roll-status').querySelector('b').textContent=p.rollCooldown>0?p.rollCooldown.toFixed(1)+'s':p.energy<12?'LOW':'READY';
      const phase={approach:['01 / APPROACH','Reach the solar array'],rescue:['01 / PARTNER RESCUE',m.ally.saved?'Partner safe. Hold formation.':m.ally.state==='lost'?'Continue to the array':`Clear Mica’s pursuers · ${m.rescueKills}/3`],choice:['02 / CHANNEL SPLIT','Choose left or right'],route:['02 / '+(m.route==='cut'?'SERVICE CUT':'OPEN WATER'),'Cross the broken channel'],array:['03 / SUNKEN ARRAY','Clear the final patrol'],boss:['04 / RELAY CARRIER',m.status==='extraction'?'Signal restored. Return home.':'Disable the carrier']};const ph=phase[m.phase]||phase.approach;text('sector-number',ph[0]);text('objective',ph[1]);$('mission-progress').style.width=Math.min(100,m.elapsed/170*90+(m.status==='extraction'?10:0))+'%';
      visible('boss-hud',!!m.boss&&m.status==='flight');if(m.boss){const b=m.boss;text('boss-phase',b.stage==='core'?(b.coreOpen?'CORE OPEN · FIRE':'CORE CLOSED · EVADE'):'BREAK BOTH RELAYS');$('boss-health').style.width=(b.left+b.right+b.core)/b.max*100+'%';}
    }
    visible('toast',uiTime<toastUntil);visible('radio',uiTime<radioUntil);visible('center-message',uiTime<messageUntil);visible('route-choice',m.phase==='choice');visible('flight-hint',m.elapsed<28&&!coarse);visible('reticle',m.status==='flight');visible('near-reticle',m.status==='flight');
    const tt=m.boss?m.targets().find(t=>t.boss&&t.open!==false):null;visible('target-label',!!tt&&m.status==='flight');if(tt){const pt=renderer.project(tt.x,tt.y,tt.z);if(pt){$('target-label').style.left=pt.x/r.W*100+'%';$('target-label').style.top=(pt.y-43)/r.H*100+'%';text('target-label',tt.id==='core'?'CORE OPEN':'RELAY');}}
  }
  function results(success){const s=mission.summary();lastResult={...s,success};visible('title-screen',false);visible('hud',false);visible('touch-controls',false);visible('pause-screen',false);visible('result-screen',true);text('result-kicker',success?'SIGNAL RESTORED':'SIGNAL LOST');text('result-title',success?'The Reach is open.':'Your flight is not over.');text('result-subtitle',success?(s.rescued?'Two ships made it home. Every light is a way forward.':'The evacuation channel is clear. Your signal brought them home.'):'Return to your last checkpoint and take another line.');text('result-rank',s.rank);text('result-score',String(s.score).padStart(6,'0'));text('retry',success?'Fly again':'Retry '+(mission.checkpoint?'checkpoint':'mission'));
    const newBest=success&&(!record||s.score>record.score);if(newBest){record={score:s.score,rank:s.rank,mode:s.mode,route:s.route,date:new Date().toISOString()};E.store.set('ionwake-record-v1',record);}visible('new-record',newBest);
    const stats=[['Targets cleared',`${s.kills} / ${s.targets}`],['Shot accuracy',s.accuracy+'%'],['Energy returns',String(s.returns)],['Best chain',String(s.chain)],['Hull bonus','+'+s.hullBonus],['Partner',s.rescued?'SAFE':mission.ally.state==='lost'?'WITHDRAWN':'IN FLIGHT'],['Route',s.route],['Flight time',`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')}`],['Difficulty',s.mode.toUpperCase()],['Retries',String(s.retries)]];
    $('result-stats').replaceChildren(...stats.map(([key,value])=>{const d=document.createElement('div');d.className='result-stat';const l=document.createElement('span');l.textContent=key;const v=document.createElement('strong');v.textContent=value;d.append(l,v);return d;}));text('result-foot',success?'Ranks: C below 10,500 · B 10,500 · A 17,500 · S 25,000. Records save on this device.':`Checkpoint: ${mission.checkpoint?.name||'Mission start'}. Retry restores supplies and clears nearby threats.`);$('retry').focus();announce(success?'Mission complete. Rank '+s.rank:'Flight lost. Retry is ready.');if(!success)game.audio.music(null);
  }
  game.start({scene:'title',scenes:{
    title:{enter(){visible('title-screen',true);visible('hud',false);visible('result-screen',false);visible('pause-screen',false);visible('touch-controls',false);resetMessages();setMusic('');text('title-record',record?`BEST / ${String(record.score).padStart(6,'0')} · RANK ${record.rank}`:'THE REACH IS WAITING');},update(dt){titleTime+=dt;game.focus(game.W/2,game.H/2);if(game.input.pressed('start')&&!document.querySelector('dialog[open]'))launch();},draw(r){drawWorld(r,true);}},
    mission:{pausable:true,enter(data={}){resetMessages();lastHudTick=-1;mission=new IonMission({difficulty:settings.difficulty,aimAssist:settings.aimAssist,onEvent,snapshot:data.snapshot||null,retries:data.retries||0});uiTime=mission.elapsed;visible('title-screen',false);visible('result-screen',false);visible('pause-screen',false);visible('hud',true);visible('touch-controls',coarse);setMusic('flight');game.input.clear();game.focus(game.W/2,game.H/2);},update(dt){uiTime=mission.elapsed;mission.update(dt,frameInput());game.focus(game.W/2,game.H/2);},draw(r){drawWorld(r);const modal=!!document.querySelector('dialog[open]');visible('pause-screen',game.paused&&!modal);visible('touch-controls',coarse&&!game.paused&&mission.status==='flight');}},
    result:{enter(data){results(!!data?.success);},update(dt){titleTime+=dt;game.focus(game.W/2,game.H/2);if(game.input.pressed('start')&&!document.querySelector('dialog[open]'))retry();},draw(r){drawWorld(r,false,true);}}
  }});
  // Read-only diagnostics support repeatable checks without hidden play controls.
  window.ionwake={getState:()=>({scene:game.sceneName,paused:game.paused,status:mission?.status,elapsed:mission?.elapsed,phase:mission?.phase,route:mission?.route,player:mission?{...mission.player}:null,boss:mission?.boss?{...mission.boss}:null,summary:mission?.summary(),enemies:mission?.enemies.length||0,shots:mission?.shots.length||0,errors:game.errors.map(e=>e.message),filter:{mode:settings.filter,ready:fx.ready},render:{...renderer.renderStats},frame:{...game.stats},version:'1.0.0'}),getSettings:()=>({...settings})};
  const context=document.modelContext;
  if(context?.registerTool){const lifecycle=new AbortController();const specs=[
    {name:'read_flight_status',description:'Read the current IONWAKE mission status, score, health, and display settings.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('This tool takes an empty object.');return window.ionwake.getState();}},
    {name:'pause_flight',description:'Pause an active IONWAKE mission. The visible pause menu opens.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('This tool takes an empty object.');if(game.sceneName!=='mission')throw new Error('No mission is active.');pause();return{paused:game.paused};}}
  ];for(const spec of specs)try{Promise.resolve(context.registerTool(spec,{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
})();
