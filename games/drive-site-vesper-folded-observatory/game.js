/* VESPER: The Folded Observatory — original game, art, animation and score. */
(() => {
  'use strict';
  const E=window.My3D2dge,C=window.VesperCore,P=E.px,$=id=>document.getElementById(id);
  const SAVE='vesper:journey:v1',SETTINGS='vesper:settings:v1';
  const defaults={volume:60,music:true,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,contrast:false,assist:false,guidance:true,touch:matchMedia('(pointer:coarse)').matches,filter:'none',bands:7,outline:45,pixels:3,saturation:100};
  const storedSettings=E.store.get(SETTINGS,{}),settings={...defaults,...(storedSettings&&typeof storedSettings==='object'?storedSettings:{})};
  for(const k of ['volume','bands','outline','pixels','saturation'])if(!Number.isFinite(settings[k]))settings[k]=defaults[k];
  settings.volume=C.clamp(settings.volume,0,100);settings.bands=C.clamp(settings.bands,3,16);settings.outline=C.clamp(settings.outline,0,100);settings.pixels=C.clamp(settings.pixels,1,10);settings.saturation=C.clamp(settings.saturation,30,160);
  if(!['none','cel','pixel','hybrid'].includes(settings.filter))settings.filter='none';
  const view=new E.View('vesper','Vesper',-24,13,1.05,1);
  const game=new E.Game({canvas:'screen',res:[768,432],portrait:{res:[432,640]},view,bg:'#071721',input:{left:['KeyA','ArrowLeft','Pad14','TouchLeft'],right:['KeyD','ArrowRight','Pad15','TouchRight'],up:['ArrowUp','KeyW'],down:['ArrowDown','KeyS'],jump:['Space','KeyZ','Pad0','TouchJump'],turnLeft:['KeyQ','Pad4','TouchQ'],turnRight:['KeyE','Pad5','TouchE'],interact:['KeyF','ArrowUp','KeyW','Pad2','TouchF'],pause:['Escape','Pad9'],map:['KeyM','Pad8'],hint:['KeyH','Pad3'],recover:['KeyR'],start:['Enter']}});
  game.pauseOverlay=false;game.cam.smooth=.21;
  let saved=E.store.get(SAVE),sim=new C.Simulation(E),mode='title',clock=0,zoom=1.05,transition=0,toastUntil=0,saveUntil=0,autosave=0,endingShown=false,activeDialog=null,returnFocus=null,hintStage=0,lastHintKey='',landSquash=0,lastStep=0,visPaused=false;
  let particles=[],rings=[],lastHud='',seenTips=new Set(),touchVisible=!!settings.touch;
  const sky=new Image();sky.src='assets/twilight.png';
  const filter=new VesperFilter($('gpu-screen'),(message,error)=>{$('gpu-status').textContent=message;$('gpu-status').classList.toggle('error',!!error);if(error){$('filter-mode').value='none';settings.filter='none';$('filter-controls').classList.add('inactive');}});
  // Keep the supplied low-resolution buffer. Present it at the actual available size.
  // A separate canvas owns WebGPU. DOM text is outside the image filter.
  game.screen.present=function(){
    const s=this.sctx,w=this.canvas.width,h=this.canvas.height;this.S=Math.min(w/this.W,h/this.H);this.OX=(w-this.W*this.S)/2;this.OY=(h-this.H*this.S)/2;
    s.imageSmoothingEnabled=false;s.fillStyle='#071721';s.fillRect(0,0,w,h);s.drawImage(this.buf,this.fx,this.fy,this.W,this.H,this.OX,this.OY,this.W*this.S,this.H*this.S);filter.render(this.canvas);
  };
  const baseMelody='D5 - . . A4 - . . | F5 - . E5 - . D5 . | A5 - . . F5 - . . | E5 - . . C5 - . .';
  function score(){
    if(mode==='title'||!settings.music){game.audio.music(null);return;}
    const n=sim.lit.size,tracks=[{wave:'sine',vol:.11,notes:'D3 - - - - - - - | Bb2 - - - - - - - | F3 - - - - - - - | C3 - - - - - - -'},{wave:'sine',vol:.055,notes:baseMelody}];
    if(n>=1)tracks.push({wave:'triangle',vol:.028,notes:'A4 . . . D5 . . . | F4 . . . Bb4 . . . | C5 . . . F5 . . . | G4 . . . C5 . . .'});
    if(n>=2)tracks.push({wave:'sine',vol:.025,notes:'D6 . . A5 . . F5 . | Bb5 . . F5 . . D5 . | F6 . . C6 . . A5 . | E6 . . G5 . . C6 .'});
    if(n>=3)tracks.push({wave:'sine',vol:.034,notes:'F4 - A4 - C5 - A4 - | D4 - F4 - A4 - F4 - | A4 - C5 - E5 - C5 - | G4 - B4 - D5 - B4 -'});
    game.audio.music({bpm:66,steps:2,tracks});
  }
  game.audio.define('vesper-jump',{wave:'sine',freq:250,to:490,dur:.14,vol:.17});
  game.audio.define('vesper-turn',{wave:'sine',freq:150,to:300,dur:.45,vol:.15,arp:[0,7,12],step:.11});
  game.audio.define('vesper-star',{wave:'sine',freq:740,dur:.5,vol:.21,arp:[0,7,12],step:.09});
  game.audio.define('vesper-lens',{wave:'sine',freq:294,dur:1.1,vol:.24,arp:[0,4,7,12,16,19],step:.14});
  game.audio.define('vesper-land',{wave:'noise',freq:160,to:70,dur:.055,vol:.10});
  function toast(title,body,symbol='◇',duration=5){$('toast-title').textContent=title;$('toast-body').textContent=body;$('toast-symbol').textContent=symbol;$('toast').classList.remove('hidden');toastUntil=clock+duration;}
  function save(show=true){
    if(mode==='title')return;const ok=E.store.set(SAVE,sim.snapshot());saved=sim.snapshot();
    if(show){$('save-status').textContent=ok?'◇  JOURNEY SAVED':'Progress cannot be saved in this browser.';$('save-status').classList.add('visible');saveUntil=clock+2.2;}return ok;
  }
  function applySettings(){
    game.audio.setVolume(settings.volume/100);game.reduceMotion=!!settings.reduceMotion;sim.reduceMotion=!!settings.reduceMotion;sim.assist=!!settings.assist;game.cam.smooth=settings.reduceMotion?.06:.21;touchVisible=!!settings.touch;$('touch-controls').classList.toggle('hidden',mode!=='play'||!touchVisible);$('touch-controls').classList.toggle('enabled',touchVisible);document.body.classList.toggle('reduced-motion',!!settings.reduceMotion);
    filter.params={bands:settings.bands,outline:settings.outline/100,pixels:settings.pixels,saturation:settings.saturation/100};
    for(const k of ['volume','bands','outline','pixels','saturation']){$(k).value=settings[k];$(k+'-value').textContent=settings[k]+(['volume','outline','saturation'].includes(k)?'%':'');}
    $('music').checked=!!settings.music;$('reduce-motion').checked=!!settings.reduceMotion;$('contrast').checked=!!settings.contrast;$('assist').checked=!!settings.assist;$('guidance').checked=!!settings.guidance;$('touch').checked=!!settings.touch;$('filter-mode').value=settings.filter;$('filter-controls').classList.toggle('inactive',settings.filter==='none');
    E.store.set(SETTINGS,settings);
  }
  function closeDialog(dialog=activeDialog){if(!dialog)return;dialog.close();activeDialog=null;game.input.clear();if(returnFocus?.isConnected)returnFocus.focus();else $('screen').focus({preventScroll:true});}
  function openDialog(dialog){
    if(activeDialog)activeDialog.close();returnFocus=document.activeElement;activeDialog=dialog;game.input.clear();dialog.showModal();
    if(dialog===$('settings-dialog')){$('resume-button').textContent=mode==='title'?'Return to title':'Return to game';$('respawn-button').classList.toggle('hidden',mode==='title');$('restart-button').classList.toggle('hidden',mode==='title');}
  }
  document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d);});d.addEventListener('keydown',e=>e.stopPropagation());d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);}});});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
  function enter(continuing=false){
    sim=new C.Simulation(E,continuing?saved:null);sim.reduceMotion=!!settings.reduceMotion;sim.assist=!!settings.assist;mode='play';transition=1;endingShown=sim.complete;hintStage=0;seenTips=new Set();particles=[];rings=[];activeDialog?.close();activeDialog=null;game.input.clear();
    $('title-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('play-footer').classList.remove('hidden');$('touch-controls').classList.toggle('hidden',!touchVisible);$('area-name').classList.remove('hidden');$('toast').classList.add('hidden');
    game.cam.snap=true;game.audio._init();game.audio.sfx('select',{vol:.35});score();save(false);updateHud(true);$('screen').focus({preventScroll:true});
    if(!continuing)toast('A small keeper. A long way up.','Move with A / D. Hold Space for a higher jump.','✧',5.5);
    else toast('Welcome back.','Your lenses and last safe platform are restored.','◇',3.5);
  }
  $('start-button').addEventListener('click',()=>{if(C.saveValid(saved))openDialog($('restart-dialog'));else enter(false);});$('continue-button').addEventListener('click',()=>enter(true));
  if(C.saveValid(saved)){$('continue-button').classList.remove('hidden');$('start-button').textContent='Start a new journey';}
  $('settings-button').addEventListener('click',()=>openDialog($('settings-dialog')));$('title-settings').addEventListener('click',()=>openDialog($('settings-dialog')));$('about-button').addEventListener('click',()=>openDialog($('about-dialog')));$('resume-button').addEventListener('click',()=>closeDialog());
  $('respawn-button').addEventListener('click',()=>{closeDialog();recover();});$('restart-button').addEventListener('click',()=>openDialog($('restart-dialog')));$('replay-button').addEventListener('click',()=>openDialog($('restart-dialog')));$('confirm-restart').addEventListener('click',()=>{closeDialog();enter(false);});
  $('explore-button').addEventListener('click',()=>{closeDialog();endingShown=true;toast('The light is home.','Keep exploring for lost stars. The back of the roof ring holds a quiet secret.','✧',7);});
  for(const k of ['volume','bands','outline','pixels','saturation'])$(k).addEventListener('input',()=>{settings[k]=Number($(k).value);applySettings();});
  for(const [id,k] of [['music','music'],['reduce-motion','reduceMotion'],['contrast','contrast'],['assist','assist'],['guidance','guidance'],['touch','touch']])$(id).addEventListener('change',()=>{settings[k]=$(id).checked;applySettings();if(k==='music')score();});
  $('filter-mode').addEventListener('change',async()=>{settings.filter=$('filter-mode').value;applySettings();await filter.setMode(settings.filter);if(filter.mode==='none'){settings.filter='none';applySettings();}});
  $('turn-left').addEventListener('click',()=>turn(-1));$('turn-right').addEventListener('click',()=>turn(1));$('hint-button').addEventListener('click',hint);
  document.querySelectorAll('[data-code]').forEach(b=>{const code=b.dataset.code;b.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='play'||activeDialog)return;b.setPointerCapture(e.pointerId);game.input.press(code);b.classList.add('pressed');});const up=e=>{e.preventDefault();game.input.release(code);b.classList.remove('pressed');};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',()=>{game.input.release(code);b.classList.remove('pressed');});});
  function turn(dir){if(mode==='play'&&!activeDialog)sim.requestTurn(dir);}
  function recover(){sim.restore();game.input.clear();toast('Back on safe ground.','All restored lenses and found stars are kept.','◇',3);}
  function hint(){
    if(mode!=='play')return;const p=C.at(sim.lastPlatform),missing=C.lenses.find(l=>!sim.lit.has(l.id));const key=(missing?.id??'roof')+':'+p.id;if(lastHintKey!==key){hintStage=0;lastHintKey=key;}
    let steps;
    if(sim.complete){steps=['Six small stars are hidden along the path. Check your map.','The roof has two faces. Look at the back of its ring.','At the roof, face SOUTH and press F to find the quiet secret.'];}
    else if(p.id==='roof'&&sim.lit.size===3){steps=['The three lenses have filled the roof with light.','The inscription says: “The sky looks north.”','Face NORTH at the roof, then press F.'];}
    else if(missing&&p.i>=C.at(missing.platform).i){steps=[missing.name+' lens still sleeps. Check the marked lens on your map.','Stand on the '+missing.name.toLowerCase()+' lens platform and join its broken ring.','At the '+missing.name.toLowerCase()+' lens, face '+C.faces[missing.face]+' and press F.'];}
    else{let target=p.i<2?'NORTH':p.i<4?'EAST':p.i<6?'SOUTH':p.i<8?'WEST':'NORTH';steps=['The next path may be behind this one. Try another view.','Separate ledges can join when the world turns. Watch their gold edges.','From here, face '+target+'. Jump toward the next higher ledge. Hold Space for the full jump.'];}
    toast('A little guidance · '+(Math.min(hintStage,2)+1)+' / 3',steps[Math.min(hintStage++,2)],'✧',8);
  }
  function showMap(){
    const current=sim.lastPlatform;let html='<p class="map-intro">Restore three lenses, then send their light from the roof. Gold marks show your progress.</p><div class="map-route">';
    for(const p of [...C.platforms].reverse()){
      const lens=C.lenses.find(l=>l.platform===p.id),star=C.stars.filter(s=>s.platform===p.id),done=lens?sim.lit.has(lens.id):sim.visited.has(p.id);
      const direction=p.i<=2?'North':p.i<=4?'East':p.i<=6?'South':p.i<=8?'West':'North';
      const status=p.id===current?'YOU ARE HERE':lens?(done?'LENS AWAKE':'LENS SLEEPING'):sim.visited.has(p.id)?'REACHED':'UNEXPLORED';
      html+='<div class="map-stop '+(done?'done ':'')+(p.id===current?'current':'')+'"><span class="stop-mark">'+(lens?lens.symbol:p.id==='roof'?'✳':'·')+'</span><span class="stop-name">'+p.name+'<small>'+direction+' view'+(star.length?' · '+star.filter(s=>sim.found.has(s.id)).length+' / '+star.length+' stars':'')+'</small></span><b>'+status+'</b>'+((p.id==='arrival'||(lens&&sim.lit.has(lens.id))||(p.id==='roof'&&sim.complete))&&p.id!==current?'<button class="map-travel" data-travel="'+p.id+'" aria-label="Return to '+p.name+'">Return</button>':'')+'</div>';
    }
    html+='</div><p class="section-note" style="margin-top:18px">Roof inscription: “The sky looks north. The keeper looks back.”</p>';$('map-content').innerHTML=html;document.querySelectorAll('[data-travel]').forEach(button=>button.addEventListener('click',()=>{if(sim.travel(button.dataset.travel)){closeDialog();events();save();toast('A path made of light.','Returned to '+C.at(button.dataset.travel).name+'.','◇',3);}}));openDialog($('map-dialog'));
  }
  $('map-button').addEventListener('click',showMap);
  function use(){const result=sim.interact();if(!result.ok)toast('The observatory listens.',result.message,'◇',3.5);}
  function addBurst(x,y,z,color,count=20,power=1){
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2;particles.push({x,y,z,vx:Math.cos(a)*(10+Math.random()*24)*power,vy:Math.sin(a)*(10+Math.random()*24)*power,vz:(12+Math.random()*28)*power,life:.6+Math.random()*.9,max:1.5,color,size:i%3===0?2:1,gravity:25});}
    if(particles.length>220)particles.splice(0,particles.length-220);
  }
  function events(){
    for(const e of sim.events.splice(0)){
      if(e.type==='turn')game.audio.sfx('vesper-turn',{pitch:e.dir>0?1:.9});
      if(e.type==='jump'){game.audio.sfx('vesper-jump');addBurst(sim.world.x,sim.world.y,sim.hero.z+1,'#c5d2b7',5,.35);}
      if(e.type==='land'){landSquash=.22;game.audio.sfx('vesper-land');addBurst(sim.world.x,sim.world.y,sim.hero.z+1,'#afd1c0',6,.3);}
      if(e.type==='star'){game.audio.sfx('vesper-star');addBurst(e.x,e.y,e.z,'#ffe1a0',18,.7);save();if(sim.found.size===6)toast('Every lost star is home.','Six small lights. One complete constellation.','✧',5);}
      if(e.type==='lens'){const p=C.at(e.lens.platform);addBurst(p.x,p.y,p.top+20,e.lens.color,48,1.2);rings.push({x:p.x,y:p.y,z:p.top+20,t:0,color:e.lens.color});game.audio.sfx('vesper-lens',{pitch:1+e.lens.id*.125});toast(e.lens.name+' lens restored.',sim.lit.size===3?'All three lenses are awake. Reach the roof and face NORTH.':(sim.lit.size+' of 3 lenses awake. The light has found another path.'),e.lens.symbol,6);score();save();}
      if(e.type==='checkpoint')save();
      if(e.type==='restore'){game.cam.snap=false;addBurst(sim.world.x,sim.world.y,sim.hero.z+8,'#b0e2d8',20,.6);game.audio.sfx('warp',{vol:.23,pitch:1.3});}
      if(e.type==='secret'){game.audio.sfx('vesper-lens',{pitch:1.6});addBurst(0,14,289,'#d2c4ff',44,1);toast('The keeper’s constellation.','Someone once stood here, looking back. You found their quiet light.','✳',8);save();}
      if(e.type==='complete'){save();score();game.audio.sfx('vesper-lens',{pitch:1.5});rings.push({x:0,y:14,z:290,t:0,color:'#fff0ba'});toast('The sky remembers.','Let there be a little more light.','✳',4);}
    }
  }
  function updateHud(force=false){
    const state=$('screen').dataset;state.playerX=sim.hero.x.toFixed(2);state.playerZ=sim.hero.z.toFixed(2);state.platform=sim.lastPlatform;state.face=String(sim.face);state.grounded=String(sim.hero.onGround);state.turning=String(!!sim.turn);state.worldX=sim.world.x.toFixed(2);state.worldY=sim.world.y.toFixed(2);state.errors=String(game.errors.length);state.fps=String(game.fps);
    const key=sim.lit.size+':'+sim.found.size+':'+sim.face+':'+sim.complete+':'+sim.lastPlatform;if(!force&&key===lastHud)return;lastHud=key;
    $('screen').setAttribute('aria-label','Game world. Keeper at '+C.at(sim.lastPlatform).name+'. '+C.faces[sim.face]+' view. '+sim.lit.size+' of 3 lenses restored. Use A and D to move, Space to jump, Q and E to turn, and F to interact.');
    $('lens-count').textContent=sim.lit.size+' / 3';$('lenses').setAttribute('aria-label',sim.lit.size+' of 3 lenses restored');document.querySelectorAll('[data-lens]').forEach(n=>n.classList.toggle('lit',sim.lit.has(Number(n.dataset.lens))));$('star-count').textContent=sim.found.size+' / 6';$('view-label').textContent=C.faces[sim.face];[...$('view-pips').children].forEach((p,i)=>p.classList.toggle('active',i===sim.face));
    if(sim.complete)document.querySelector('.progress-block .small-label').textContent='THE LIGHT IS HOME';else document.querySelector('.progress-block .small-label').textContent='RESTORE THE LIGHT';
  }
  function ending(){
    endingShown=true;$('end-stars').textContent=sim.found.size+' / 6';$('end-time').textContent=Math.floor(sim.elapsed/60)+':'+String(Math.floor(sim.elapsed%60)).padStart(2,'0');$('end-secret').textContent=sim.secret?'Found':'Unfound';$('end-note').textContent=sim.found.size===6&&sim.secret?'All stars and the keeper’s secret are found. Your journey is complete.':'The main journey is complete. You can stay to find the remaining stars and the keeper’s secret.';openDialog($('ending-dialog'));
  }
  function update(dt){
    clock+=dt;landSquash=Math.max(0,landSquash-dt);
    if(clock>toastUntil)$('toast').classList.add('hidden');if(clock>saveUntil)$('save-status').classList.remove('visible');
    if(mode==='title'){
      if(!activeDialog&&game.input.pressed('start'))enter(C.saveValid(saved));
      zoom+=(1.05-zoom)*Math.min(1,dt*3);view.set(settings.reduceMotion?-26:-26+Math.sin(clock*.08)*5,13,zoom,1);
      game.focus(game.W<500?0:-150,-22,game.W<500?170:145);return;
    }
    if(game.input.pressed('pause')){if(activeDialog)closeDialog();else openDialog($('settings-dialog'));}
    if(activeDialog||visPaused)return;
    if(game.input.pressed('map')){showMap();return;}
    if(game.input.pressed('hint'))hint();if(game.input.pressed('recover'))recover();
    if(game.input.pressed('turnLeft'))sim.requestTurn(-1);if(game.input.pressed('turnRight'))sim.requestTurn(1);
    if(game.input.pressed('interact'))use();
    sim.step(dt,game.input);events();updateHud();
    const running=Math.abs(sim.hero.vx)>15&&sim.hero.onGround;if(running&&clock-lastStep>.23){lastStep=clock;game.audio.sfx('vesper-land',{vol:.4,pitch:1.4});}
    transition=Math.max(0,transition-dt*.5);const targetZoom=game.W<500?2.05:2.2;zoom+=(targetZoom-zoom)*Math.min(1,dt*3);
    let pitch=0;if(sim.turn&&!settings.reduceMotion)pitch=Math.sin(C.clamp(sim.turn.t/sim.turn.duration,0,1)*Math.PI)*12;
    view.set(sim.yaw,pitch,zoom,1);game.focus(sim.world.x,sim.world.y,sim.hero.z+(game.W<500?38:44));
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=p.gravity*dt;}
    particles=particles.filter(p=>p.life>0);for(const r of rings)r.t+=dt;rings=rings.filter(r=>r.t<1.5);
    if(sim.endingTime>0&&!endingShown){if(sim.endingTime<4&&Math.random()<.4)addBurst((Math.random()-.5)*160,14,300+Math.random()*100,['#ffe3a2','#a1e9dd','#d0bfff'][Math.floor(Math.random()*3)],2,.4);if(sim.endingTime>4.4)ending();}
    if(settings.guidance&&sim.lastPlatform==='turn'&&!seenTips.has('turn')){seenTips.add('turn');toast('There is more than one way to see.','Press E to turn EAST. A hidden path waits behind this ledge.','↷',7);}
    if(settings.guidance&&sim.lastPlatform==='crossing'&&!seenTips.has('cross')){seenTips.add('cross');toast('A path around the corner.','Turn SOUTH, then follow the higher ledges to the left.','↷',5);}
    if(settings.guidance&&sim.lastPlatform==='tide'&&!seenTips.has('tide')){seenTips.add('tide');toast('The path folds again.','Wake the Tide lens. Then turn WEST and climb to the right.','◇',5);}
    if(settings.guidance&&sim.lastPlatform==='dusk'&&!seenTips.has('dusk')){seenTips.add('dusk');toast('The last lens.','Wake the Dusk lens. Turn NORTH and climb left to the roof.','✳',6);}
    autosave+=dt;if(autosave>10){autosave=0;save(false);}
  }
  function worldLine(r,g,a,b,color,width=1){const u=r.w(...a),v=r.w(...b);P.line(g,u[0],u[1],v[0],v[1],color,width);}
  function worldRing(r,g,x,y,z,radius,color,face=0,amount=1,phase=0){
    const b=C.basis(face),steps=64;for(let i=0;i<steps*amount;i++){const a=i/steps*Math.PI*2+phase,aa=(i+1)/steps*Math.PI*2+phase;worldLine(r,g,[x+Math.cos(a)*radius*b.c,y-Math.cos(a)*radius*b.s,z+Math.sin(a)*radius],[x+Math.cos(aa)*radius*b.c,y-Math.cos(aa)*radius*b.s,z+Math.sin(aa)*radius],color,1);}
  }
  function background(r){
    const g=r.ctx,w=r.bw,h=r.bh;
    if(sky.complete&&sky.naturalWidth){const scale=Math.max(w/sky.width,h/sky.height),iw=sky.width*scale,ih=sky.height*scale;g.imageSmoothingEnabled=false;g.drawImage(sky,(w-iw)/2,(h-ih)/2,iw,ih);g._c=null;}
    else r.sky(['#061525','#123957','#558887']);
    const mx=w*.81+Math.sin(clock*.025)*4,my=h*.19;
    P.blend(g,.025,'add',()=>P.disc(g,mx,my,32,'#b0d9d0'));
    for(let yy=-20;yy<=20;yy++)for(let xx=-20;xx<=20;xx++)if(xx*xx+yy*yy<=400&&(xx-7)*(xx-7)+(yy+5)*(yy+5)>361)P.dot(g,mx+xx,my+yy,'#d7e0bc');
    r.starfield({count:sim.complete?160:55,speed:settings.reduceMotion?0:.22,dir:'left',height:.78,colors:sim.complete?['#f4e8bc','#b7d8cf','#6da8b3']:['#91b6bd','#5f8c9f','#40687d'],seed:17});
    for(let i=0;i<7;i++){const drift=settings.reduceMotion?0:clock*(.6+(i%3)*.2),x=((i*193+drift)%(w+160))-80,y=h*.77+(i%3)*30;const a=.04+(i%3)*.015;P.blend(g,a,'normal',()=>{P.ell(g,x,y,65+(i%2)*45,7,'#b1d8cb');P.ell(g,x+55,y+6,95,6,'#b1d8cb');});}
    if(sim.complete){const a=C.clamp(sim.endingTime/4,0,.15);P.blend(g,a,'screen',()=>P.rect(g,0,0,w,h,'#bdb879'));}
  }
  function cap(r,g,p){
    const x0=p.x-p.w/2,x1=p.x+p.w/2,y0=p.y-p.d/2,y1=p.y+p.d/2,z=p.top;
    r.box(g,x0,y0,z-6,x1,y1,z,'#b6c8b8','#6e8c87');
    r.box(g,x0-.8,y0-.8,z-2,x1+.8,y1+.8,z-.6,'#e5d7a6','#a9a37e');
    r.box(g,x0+1,y0+1,z,x1-1,y1-1,z+.55,'#9bc4a1','#558b79');
    // A narrow gold edge marks every physical platform surface.
    for(const [nx,ny,A,B] of [[0,1,[x0,y1],[x1,y1]],[0,-1,[x0,y0],[x1,y0]],[1,0,[x1,y0],[x1,y1]],[-1,0,[x0,y0],[x0,y1]]]){
      if(nx*view.fx+ny*view.fy<.01)continue;worldLine(r,g,[...A,z],[...B,z],'#e3d69e',1);
      const length=Math.hypot(B[0]-A[0],B[1]-A[1]);for(let k=8;k<length;k+=12){const t=k/length;worldLine(r,g,[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,z-2],[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,z-6],'#486e70');}
    }
    // Grass, flowers and trailing ivy are non-solid scenery.
    for(let j=0;j<Math.floor(p.w/5);j++){
      const hash=E.hash2(j,p.i+31),x=x0+3+hash*(p.w-6),y=y0+3+E.hash2(j+33,p.i)*(p.d-6),height=2+hash*3,sway=settings.reduceMotion?0:Math.sin(clock*1.3+j+p.i)*.7;
      const a=r.w(x,y,z),b=r.w(x+sway,y,z+height);P.line(g,a[0],a[1],b[0],b[1],hash>.6?'#66b495':'#467f73');if(hash>.74){P.rect(g,b[0]-1,b[1]-1,2,2,sim.lit.size?'#e7dba9':'#adc8b3');}
    }
    const ivyCount=p.i===0?10:p.i%2===0?4:2;
    for(let j=0;j<ivyCount;j++){
      const x=x0+3+E.hash2(j+101,p.i)*(p.w-6),y=y1+.6,length=8+E.hash2(j,p.i+41)*22;
      for(let k=0;k<length;k+=3){const a=r.w(x+Math.sin(k*.3+j+clock*.5)*1.2,y,z-5-k);P.rect(g,a[0]-1,a[1],3,2,k%2?'#3b8877':'#447b6d');}
    }
  }
  function foundation(r,g,p){
    const x0=p.x-p.w/2,x1=p.x+p.w/2,y0=p.y-p.d/2,y1=p.y+p.d/2,z=p.top;
    if(p.i===0){
      r.box(g,x0+3,y0+3,z-24,x1-3,y1-3,z-6,'#5c8984','#3c646c');r.box(g,x0+10,y0+8,z-42,x1-10,y1-8,z-24,'#476f75','#294f60');
      for(let j=0;j<9;j++){let x=x0+12+j*11,h=8+E.hash2(j,91)*24;r.box(g,x,y0+15,z-42-h,x+7,y1-15,z-41,'#29465b','#223f52');}
      for(let i=0;i<5;i++)for(let j=0;j<3;j++){const x=x0+9+i*20,zz=z-7-j*11;worldLine(r,g,[x,y1-2,zz],[x+18,y1-2,zz],'#315560');worldLine(r,g,[x,y1-2,zz],[x,y1-2,zz-8],'#436f72');}
    }else if([3,6,8,10].includes(p.i)){
      const d=.64;P.blend(g,d,'normal',()=>{
        for(const dx of [-1,1])for(const dy of [-1,1]){const x=p.x+dx*(p.w/2-5),y=p.y+dy*(p.d/2-5);r.box(g,x-2,y-2,z-30,x+2,y+2,z-6,'#6a8c85','#365a65');r.box(g,x-3,y-3,z-12,x+3,y+3,z-8,'#65837c','#456a70');}
        r.box(g,x0+3,y0+3,z-31,x1-3,y1-3,z-28,'#3b626b','#264955');
      });
    }
    // Small loose stones make the building feel suspended, without adding false ledges.
    if(p.i%3===0){const bob=settings.reduceMotion?0:Math.sin(clock*.6+p.i)*2;r.box(g,p.x-7,p.y+12,z-42+bob,p.x-1,p.y+18,z-36+bob,'#537b79','#335761');}
  }
  function decor(r){
    const g=r.ctx;
    // Weathered orbital rails sit behind all walkable surfaces.
    P.blend(g,.25,'normal',()=>{worldRing(r,g,26,-35,135,135,'#5d9699',0,.84,.3);worldRing(r,g,26,-35,135,129,'#326c7e',1,.78,.8);});
    const p=C.at('arrival');
    r.queue(p.x,p.y-24,0,g=>{
      // A broken garden arch, with separate cut-stone supports.
      for(const [x,height] of [[p.x-39,43],[p.x-11,35]]){for(let z=0;z<height;z+=8)r.box(g,x-3,p.y-24,z,x+3,p.y-18,z+7,'#8eaaa0','#577c79');r.box(g,x-5,p.y-26,height,x+5,p.y-16,height+3,'#c2cdb3','#74968a');}
      for(let i=0;i<5;i++){const x=p.x-39+i*5;const z=43+Math.sin(i/5*Math.PI)*8;r.box(g,x-2,p.y-24,z,x+3,p.y-18,z+5,'#a5b9a7','#6d8e86');}
      const a=r.w(p.x-52,p.y-11,2);P.line(g,a[0],a[1],a[0]-2,a[1]-20,'#477677',2);P.poly(g,[[a[0]-2,a[1]-20],[a[0]+14,a[1]-18],[a[0]+11,a[1]-9],[a[0]-1,a[1]-11]],'#8b7f70');
    });
    for(const l of C.lenses)if(sim.lit.has(l.id)){
      const p=C.at(l.platform);P.blend(g,.3,'add',()=>{
        for(let i=0;i<50;i++){const t=i/50,x=p.x*(1-t),y=p.y*(1-t)+14*t,z=(p.top+20)*(1-t)+297*t+Math.sin(t*Math.PI)*30;const a=r.w(x,y,z);P.dot(g,a[0],a[1],l.color);if((i+Math.floor(clock*13))%18<3)P.rect(g,a[0],a[1],2,2,'#ffe8b0');}
      });
    }
  }
  function lens(r,l){
    const p=C.at(l.platform),active=sim.lit.has(l.id),b=C.basis(l.face),front=view.fx*b.s+view.fy*b.c>.6,bob=settings.reduceMotion?0:Math.sin(clock*1.5+l.id)*.8;
    r.queue(p.x,p.y,p.top+1,g=>{
      r.box(g,p.x-5,p.y-5,p.top+.5,p.x+5,p.y+5,p.top+3,'#a7bbb0','#577c78');r.box(g,p.x-2,p.y-2,p.top+3,p.x+2,p.y+2,p.top+8,'#cfbe89','#8b957c');
      const origin=r.w(p.x,p.y,p.top+19+bob);if(active)r.glowDisc(g,origin[0],origin[1],23*view.scale,l.color,.08);
      for(let i=0;i<48;i++){
        if(!active&&(i%12<2))continue;const a=i/48*Math.PI*2,aa=(i+1)/48*Math.PI*2,offset=active?0:(i<24?-5:5);const x=p.x+b.s*offset,y=p.y+b.c*offset;
        worldLine(r,g,[x+Math.cos(a)*9*b.c,y-Math.cos(a)*9*b.s,p.top+19+bob+Math.sin(a)*9],[x+Math.cos(aa)*9*b.c,y-Math.cos(aa)*9*b.s,p.top+19+bob+Math.sin(aa)*9],active?l.color:front?(i%5?'#baac80':'#e0d29c'):'#49737b',Math.max(1,Math.round(view.scale*.7)));
      }
      const q=r.w(p.x,p.y,p.top+19+bob);P.poly(g,[[q[0],q[1]-3*view.scale],[q[0]+2*view.scale,q[1]],[q[0],q[1]+3*view.scale],[q[0]-2*view.scale,q[1]]],active?'#fff0c3':front?'#d8bf7e':'#436773');
      if(front&&!active){const tag=r.w(p.x+b.s*(Math.abs(b.s)*p.w+Math.abs(b.c)*p.d)/2,p.y+b.c*(Math.abs(b.s)*p.w+Math.abs(b.c)*p.d)/2,p.top-2);P.poly(g,[[tag[0]-3,tag[1]-2],[tag[0]+3,tag[1]-2],[tag[0],tag[1]+2]],'#f0d8a2');}if(active){for(let i=0;i<3;i++){const a=clock*.7+i*2.094;const q=r.w(p.x+Math.cos(a)*15,p.y+Math.sin(a)*15,p.top+18+Math.sin(a*2)*4);P.dot(g,q[0],q[1],l.color);}}
    },{bias:100});
  }
  function observatory(r){
    const p=C.at('roof'),active=sim.lit.size===3;
    r.queue(p.x,p.y-8,p.top+5,g=>{
      for(const x of [-24,24]){
        for(let z=0;z<42;z+=7)r.box(g,x-3,4,p.top+z,x+3,10,p.top+z+6.5,'#a8bcb0','#618481');
        r.box(g,x-5,2,p.top+41,x+5,12,p.top+45,'#d1d3b0','#8d9f85');
      }
      r.box(g,-30,3,p.top+45,30,11,p.top+50,'#b9c5a9','#648c81');r.box(g,-26,4,p.top+50,26,10,p.top+53,'#e2d3a6','#aaa883');
      for(let i=0;i<9;i++){const x=-24+i*6;r.box(g,x-1,5,p.top+53,x+1,9,p.top+55+(i===4?5:0),'#b6c3a4','#64897d');}
      worldRing(r,g,0,7,p.top+26,19,active?'#ead9a0':'#819b8d',0);worldRing(r,g,0,7,p.top+26,23,'#5a8984',0,.91,clock*.02);
      if(active){const q=r.w(0,7,p.top+26);r.glowDisc(g,q[0],q[1],45,'#eddb9c',.13);P.disc(g,q[0],q[1],4*view.scale,'#f4e3b3');P.disc(g,q[0],q[1],2*view.scale,'#fff9d5');}
      if(sim.secret){worldRing(r,g,0,7,p.top+26,14,'#ccbeff',2,.75,clock*.18);}
      for(let i=0;i<3;i++){const x=-9+i*9;r.box(g,x-2,18,p.top,x+2,22,p.top+3,C.lenses[i].color,sim.lit.has(i)?C.lenses[i].color:'#395d66');}
    },{bias:70});
    if(sim.complete){
      r.overlay(g=>{const a=r.w(0,7,286),b=r.w(0,7,520);const width=settings.reduceMotion?5:5+Math.sin(clock*1.7);P.blend(g,.15,'add',()=>P.poly(g,[[a[0]-width,a[1]],[a[0]+width,a[1]],[b[0]+34,b[1]],[b[0]-34,b[1]]],'#e7e0a7'));P.line(g,a[0],a[1],b[0],b[1],'#e6e5b8',2);});
    }
  }
  function drawStars(r){
    for(const star of C.stars){if(sim.found.has(star.id))continue;const p=C.at(star.platform),bob=settings.reduceMotion?0:Math.sin(clock*2+star.id)*2,z=p.top+11+bob;
      r.queue(p.x+star.offset,p.y,z,g=>{const a=r.w(p.x+star.offset,p.y,z),s=view.scale; r.glowDisc(g,a[0],a[1],10*s,'#eace86',.09);P.poly(g,[[a[0],a[1]-4*s],[a[0]+1.2*s,a[1]-s],[a[0]+4*s,a[1]],[a[0]+s,a[1]+s],[a[0],a[1]+4*s],[a[0]-s,a[1]+s],[a[0]-4*s,a[1]],[a[0]-s,a[1]-s]],'#ebd592');P.rect(g,a[0]-1,a[1]-1,2,2,'#fff4c9');},{bias:200});
    }
  }
  function player(r){
    const h=sim.hero,v=sim.world,s=view.scale,speed=Math.min(1,Math.abs(h.vx)/83),walk=clock*13,air=h.air&&!sim.turn,breathe=settings.reduceMotion?0:Math.sin(clock*2)*.3,bob=air?0:Math.abs(Math.sin(walk))*speed*.75;const facing=h.facing;
    r.actor(v.x,v.y,h.z,(g,ox,oy)=>{
      const R=(x,y,w,hh,c)=>P.rect(g,ox+x*s,oy+(y-bob-breathe)*s,w*s,hh*s,c),poly=(pts,c)=>P.poly(g,pts.map(([x,y])=>[ox+x*s,oy+(y-bob-breathe)*s]),c);
      const squash=landSquash>0?Math.sin(landSquash/.22*Math.PI)*1.2:0;
      if(!air)P.ell(g,ox,oy+1,6*s,1.1*s,'#25444e');
      const cape=settings.contrast?'#f6d582':'#b8614f',capeHi=settings.contrast?'#fff0ac':'#e89a6b';
      const trail=2+speed*5+(settings.reduceMotion?0:Math.sin(clock*4)*1.1);
      poly([[-facing*2,-12+squash],[-facing*(4+trail),-9+Math.sin(clock*5)*.6],[-facing*(5+trail),-3],[-facing*1,-6]],'#874f50');
      const foot=air?1:Math.sin(walk)*2*speed;
      R(-3,-4+squash,2,3+foot,'#1b3544');R(1,-4+squash,2,3-foot,'#1b3544');R(-3.6,-1+foot,3.4,1.5,'#a3aea0');R(.6,-1-foot,3.4,1.5,'#a3aea0');
      poly([[-3,-12+squash],[3,-12+squash],[4.5,-4],[0,-2.8],[-4.5,-4]],cape);R(-2.3,-12+squash,1.3,7,capeHi);R(-2,-7,4,1,'#80554b');
      R(-3,-18+squash,6,7,'#d6c19a');R(-4,-16+squash,8,4,'#d6c19a');R(-3,-18+squash,5,1,'#f3dfb1');R(-2.5,-16+squash,6,3.2,'#24414b');R(-3,-12+squash,6,1,'#987e62');
      const blink=clock%4.7>4.54;if(!blink){R(facing>0?1.5:-2.5,-15.5+squash,1.6,1.5,settings.contrast?'#fffbe0':'#afe9d7');R(facing>0?-1:-.1,-15.5+squash,1,1.5,'#72bdb4');}
      R(facing*3,-10+squash,2,4,'#ce9a72');R(facing*3,-6,2,1.5,'#ecd3a0');
      // Brass lamp on the keeper's pack.
      R(-facing*4.5-1,-9,2.5,4,'#776f57');R(-facing*4.5-.5,-8,1.7,2,'#f9d38a');
      if(settings.contrast)P.line(g,ox-5*s,oy-19*s,ox+5*s,oy-19*s,'#fff5bd');
    },{outline:false,bias:10000});
    const orbX=v.x+Math.cos(view.yaw)*(-facing*14),orbY=v.y-Math.sin(view.yaw)*(-facing*14),orbZ=h.z+22+(settings.reduceMotion?0:Math.sin(clock*2.2)*3);
    r.queue(orbX,orbY,orbZ,g=>{const a=r.w(orbX,orbY,orbZ);r.glowDisc(g,a[0],a[1],11*s,'#edcf85',.09);P.poly(g,[[a[0],a[1]-3*s],[a[0]+2*s,a[1]],[a[0],a[1]+3*s],[a[0]-2*s,a[1]]],'#f1d89c');P.dot(g,a[0],a[1]-s,'#fff5cc');for(let i=1;i<4;i++)P.blend(g,.5/i,'normal',()=>P.dot(g,a[0]-facing*(4+i*3)*s,a[1]+Math.sin(clock*3-i)*2*s,'#d1d8aa'));},{bias:10001});
  }
  function effects(r){
    for(const p of particles){r.queue(p.x,p.y,p.z,g=>{const a=r.w(p.x,p.y,p.z);P.blend(g,C.clamp(p.life/.4,0,1),'normal',()=>P.rect(g,a[0],a[1],p.size,p.size,p.color));},{bias:500});}
    for(const ring of rings){r.overlay(g=>{const a=r.w(ring.x,ring.y,ring.z);const rad=ring.t*65;P.blend(g,Math.max(0,(1.5-ring.t)*.28),'add',()=>{for(let i=0;i<64;i++){const t=i/64*Math.PI*2;P.dot(g,a[0]+Math.cos(t)*rad,a[1]+Math.sin(t)*rad,ring.color);}});});}
    if(!settings.reduceMotion){for(let i=0;i<14;i++){const x=(E.hash2(i,11)*r.W+clock*(1+i%3))%(r.W+20)-10,y=(E.hash2(i,37)*r.H+Math.sin(clock*.4+i)*8);P.blend(r.ctx,.22,'add',()=>P.rect(r.ctx,x,y,1,1,i%3?'#a5d3c4':'#f1d2a2'));}}
  }
  function updatePrompt(r){
    const el=$('interact-prompt'),near=mode==='play'&&!activeDialog?sim.nearby():null;
    if(!near){el.classList.add('hidden');return;}
    let label;
    if(near.type==='lens'){const l=near.lens;if(sim.lit.has(l.id)){el.classList.add('hidden');return;}label=sim.face===l.face?'Wake the '+l.name.toLowerCase()+' lens':'Join the ring · face '+C.faces[l.face];}
    else label=sim.lit.size<3?'The roof needs three lenses':sim.face===2&&!sim.secret?'Listen to the old keeper':!sim.complete?(sim.face===0?'Return the light':'Face NORTH to send the light'):'The sky remembers';
    el.querySelector('span').textContent=label;const a=r.w(near.platform.x,near.platform.y,near.platform.top+34),sc=game.screen,rc=sc.canvas.getBoundingClientRect();const fit=Math.min(rc.width/r.W,rc.height/r.H),ox=(rc.width-r.W*fit)/2,oy=(rc.height-r.H*fit)/2;
    el.style.left=C.clamp(ox+a[0]*fit,110,rc.width-110)+'px';el.style.top=C.clamp(oy+a[1]*fit,122,rc.height-90)+'px';el.classList.remove('hidden');
  }
  function draw(r){
    background(r);decor(r);
    for(const p of C.platforms){r.queue(p.x,p.y,p.top,g=>{foundation(r,g,p);cap(r,g,p);});}
    for(const l of C.lenses)lens(r,l);observatory(r);drawStars(r);player(r);effects(r);updatePrompt(r);
    if(transition>0)r.overlay(g=>P.blend(g,transition*.15,'normal',()=>P.rect(g,0,0,r.bw,r.bh,'#d1e4cb')));
  }
  addEventListener('blur',()=>{if(mode==='play'&&!activeDialog){visPaused=true;openDialog($('settings-dialog'));}});addEventListener('focus',()=>{visPaused=false;});
  document.addEventListener('visibilitychange',()=>{visPaused=document.hidden;if(document.hidden){save(false);if(mode==='play'&&!activeDialog)openDialog($('settings-dialog'));}});addEventListener('pagehide',()=>save(false));
  applySettings();if(settings.filter!=='none')filter.setMode(settings.filter);
  game.start({update,draw});
  // Small public state API for inspection and assistive agents. No solve or teleport API.
  const api={getState:()=>({mode,paused:!!activeDialog,platform:sim.lastPlatform,view:C.faces[sim.face],lenses:[...sim.lit],stars:[...sim.found],complete:sim.complete,secret:sim.secret,position:{...sim.world,z:sim.hero.z},checkpoint:{...sim.checkpoint},elapsed:sim.elapsed,engine:{version:E.VERSION||'0.8.1',errors:game.errors.length,fps:game.fps},filter:{mode:filter.mode,ready:filter.ready,failed:filter.failed},assets:{skyLoaded:sky.complete&&sky.naturalWidth>0}})};
  window.Vesper=api;
  const context=document.modelContext;
  if(context?.registerTool){
    const abort=new AbortController();
    for(const tool of [{name:'read_vesper_progress',title:'Read Vesper progress',description:'Read the current view, checkpoint, lenses, stars, and game status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async input=>{if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');return api.getState();}},{name:'show_vesper_hint',title:'Show the next Vesper hint',description:'Show the next optional hint in the active game. This does not solve a puzzle.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');if(mode!=='play')throw new Error('Enter the observatory first.');hint();return {shown:true,text:$('toast-body').textContent};}}]){try{Promise.resolve(context.registerTool(tool,{signal:abort.signal})).catch(()=>{});}catch(e){/* Optional proposed browser API. */}}
    addEventListener('pagehide',()=>abort.abort(),{once:true});
  }
})();
