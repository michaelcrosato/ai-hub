(() => {
const G=Drive,E=G.E;
G.App=class {
 constructor(){
  G.validateContent();
  this.mode='title';this.clock=0;this.idle=0;this.guard=false;this.lastPhysical=0;this.demoIndex=0;this.demoCycles=0;this.demoRecoveries=[];this.crewOpen=false;this.crewChoice=0;this.audioUnlocked=false;this.soundTimes=[];this.musicState=null;
  this.mobile=typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches;
  try{this.storage=typeof localStorage!=='undefined'?localStorage:new G.MemoryStore();}catch{this.storage=new G.MemoryStore();}
  this.game=new E.Game({id:'grand-theft-five-finger-drive-sd',canvas:'screen',res:[320,180],expand:true,view:'iso',views:['iso'],input:G.bindings,step:G.STEP,fullscreen:this.mobile?false:'button',menu:{controls:{north:'Walk north / throttle',south:'Walk south / brake',west:'Walk west / steer',east:'Walk east / steer',jump:'Jump / handbrake',interact:'Hold: interact / enter / exit',crew:'Hold: crew selector',cover:'Cover',ability:'Crew skill',previous:'Previous weapon',next:'Next weapon',crouch:'Crouch',map:'District map',sprint:'Sprint toggle'},items:[['Retry checkpoint',()=>this.retry()],['Return to title',()=>this.title()]],quit:()=>this.title()},autoPause:true});
  this.game.input.touchEnabled=false;this.game.input.touchButtons([]);this.game.input.glyphs='playstation';
  this.game.settings.define({key:'sdAssist',label:'Aim and damage assist',type:'toggle',value:true,group:'Game'});
  this.game.settings.define({key:'sdCaptions',label:'Dialogue captions',type:'toggle',value:true,group:'Game'});
  this.game.settings.define({key:'sdFlash',label:'Reduced flashes',type:'toggle',value:false,group:'Game'});
  this.game.settings.define({key:'sdShake',label:'Screen shake',type:'slider',value:1,min:0,max:1,step:.25,group:'Game'});
  this.game.settings.define({key:'sdContrast',label:'High-contrast targets',type:'toggle',value:false,group:'Game'});
  this.game.settings.define({key:'sdSubtitle',label:'Subtitle size',type:'select',value:'standard',options:[['standard','Standard'],['large','Large']],group:'Display'});
  this.game.settings.define({key:'sdDemoAudio',label:'Demo sound',type:'toggle',value:true,group:'Game'});
  this.game.settings.define({key:'sdAimStrength',label:'Aim assist strength',type:'slider',value:.7,min:0,max:1,step:.1,group:'Game'});
  this.game.settings.define({key:'sdTrigger',label:'Trigger activity threshold',type:'slider',value:.08,min:.04,max:.3,step:.01,group:'Controller'});
  this.game.settings.define({key:'sdSprintToggle',label:'Toggle sprint',type:'toggle',value:true,group:'Controls'});
  this.game.settings.define({key:'sdCrouchToggle',label:'Toggle crouch',type:'toggle',value:true,group:'Controls'});
  this.physical=new G.Physical(this);
  this.shell=new E.Shell(this.game,{theme:{ink:'#f5ead3',paper:'#15333ded',accent:'#f2b960',muted:'#adc7c3',line:'#527779',danger:'#ec8b72',font:'system-ui, sans-serif',titleFont:'Impact, Haettenschweiler, sans-serif'}});
  this.installMenus();
  G.installArt();this.installAudio();
  const app=this;
  this.game.onFrameTime=seconds=>{if(this.physical.visible&&this.physical.focused){this.clock+=seconds;if(this.mode==='title'&&!this.physical.active)this.idle+=seconds;}this.game.input.touchEnabled=false;if(!this.game.headless){if(this.mode==='title')this.updateCamera();this.game.audio.duck(!!this.session?.dialogue&&this.mode!=='title');this.updateMusic();if(this.session?.outcome==='success')for(const a of this.session.crew)G.animateActor(this.session,a,Math.min(seconds,.1));}};
  this.game.onInputFrame=()=>this.beforeInput();
  this.game.debug={snapshot:()=>this.snapshot(),start:o=>this.start(o),title:()=>this.title(),step:n=>this.game.advance(n),action:a=>{this.testAction=a;},physical:e=>this.physical.inject(e),checkpoint:()=>this.session.checkpoint(),load:()=>this.retry(),seed:()=>this.session.seed,hash:()=>G.stateHash(this.session.serialize()),events:()=>G.copy(this.session.events.log),trace:()=>G.copy(this.session.trace),playReplay:r=>this.playReplay(r),replay:()=>({schema:1,seed:this.session.seed,mission:this.session.definition.id,initial:this.replayStart,frames:this.replayFrames||[]}),yard:()=>this.start({yard:true}),spare:()=>this.start({mission:'spare'}),caps:()=>G.content.caps};
  this.game.start({scene:'title',boot:false,scenes:{
   title:{enter(){app.mode='title';app.game.timeScale=1;app.showTitle();},update(){},draw:r=>G.drawWorld(app,r)},
   play:{pausable:true,enter(){app.zoneChanged();},update:dt=>app.update(dt),draw:r=>G.drawWorld(app,r)}
  }});
  this.session=new G.Session(this,{demo:true,free:true});this.zoneChanged();this.game.advance(0);
  if(typeof document!=='undefined'){document.body.classList.toggle('mobile-demo',this.mobile);window.addEventListener('keydown',()=>this.unlockAudio(),{once:true,signal:this.game._abort.signal});window.addEventListener('pointerdown',()=>this.unlockAudio(),{once:true,signal:this.game._abort.signal});}
 }
 get assist(){return this.game.settings.sdAssist!==false;}
 installMenus(){
  const sh=this.shell,base=sh.show.bind(sh);this.showMenu=base;
  sh.show=(name,spec={})=>name==='settings'?this.settingsMenu():name==='controls'?this.controlsMenu():base(name,spec);
  sh._pauseActs=acts=>acts.push(['Settings',()=>this.settingsMenu()],['Controls',()=>this.controlsMenu()]);
 }
 settingsMenu(){return this.showMenu('preferences',{title:'Settings',actions:[['Game',()=>this.settingPage('Game',['sdAssist','sdAimStrength','sdSprintToggle','sdCrouchToggle'])],['Display',()=>this.settingPage('Display',['fullscreen','frameRate','scale','showFps','sdSubtitle'])],['Sound',()=>this.settingPage('Sound',['sound','volume','music','effects','sdDemoAudio'])],['Comfort',()=>this.settingPage('Comfort',['motion','sdFlash','sdShake','sdContrast','sdCaptions'])],['Controls',()=>this.controlsMenu()],['Back',()=>this.shell.back()]]});}
 settingPage(title,keys){return this.showMenu('options-'+title,{title,settingKeys:keys.filter(k=>k!=='fullscreen'||!this.mobile),actions:[['Back',()=>this.shell.back()]]});}
 controlsMenu(){return this.showMenu('controlPages',{title:'Controls',text:'Choose a control, then press its new key or button.',actions:[['Controller buttons',()=>this.bindingPage('pad')],['Keyboard & mouse',()=>this.bindingPage('keys')],['Controller calibration',()=>this.settingPage('Controller',['deadzone','sdTrigger','invertY','glyphs','rumble'])],['Reset controls',()=>{this.game.input.resetBindings();this.game.settings.reset('Controller');this.shell.toast('Default controls restored');}],['Back',()=>this.shell.back()]]});}
 bindingPage(device,page=0){const I=this.game.input,actions=Object.keys(I.map).filter(a=>!['up','down','left','right','confirm','cancel','pause'].includes(a)&&I.rebindable(a)&&(device==='keys'||G.bindings[a]?.some(c=>c.startsWith('Pad')))),label=a=>I.names[a]||a.replace(/([A-Z])/g,' $1');return this.showMenu('bindings-'+device+'-'+page,{title:device==='pad'?'Controller buttons':'Keyboard & mouse',kicker:'PAGE '+(page+1)+' / '+Math.ceil(actions.length/3),text:()=>this.shell._status||'Select a binding. Escape or Options cancels capture.',actions:()=>{const out=actions.slice(page*3,page*3+3).map(a=>[label(a)+': '+I.map[a].filter(c=>!c.startsWith('Act:')&&!c.startsWith('PadAxis')&&c.startsWith('Pad')===(device==='pad')).map(c=>I.codeLabel(c)).join(' / '),()=>this.shell._capStart(a,device,label(a))]);if(page>0)out.push(['Previous page',()=>{this.shell.back();this.bindingPage(device,page-1);}]);if((page+1)*3<actions.length)out.push(['Next page',()=>{this.shell.back();this.bindingPage(device,page+1);}]);out.push(['Back',()=>this.shell.back()]);return out;}});}
 unlockAudio(){this.audioUnlocked=true;this.musicState=null;this.updateMusic();}
 beforeInput(){
  const p=this.physical.poll(),changed=p.seq!==this.lastPhysical;this.lastPhysical=p.seq;
  if(changed&&p.device==='gamepad'&&!this.audioUnlocked)this.unlockAudio();
  if(changed&&this.mobile&&['keyboard','gamepad'].includes(p.device)){this.mobile=false;if(typeof document!=='undefined')document.body.classList.remove('mobile-demo');if(this.mode==='title')this.showTitle();}
  if(!p.visible){this.game.input.consumeAll();return false;}
  if(this.mode==='demo'&&changed){this.interrupt();return false;}
  if(this.demoRequested){if(!p.active){this.demoRequested=false;this.start({demo:true});}return false;}
  if(this.guard){this.game.input.clear();if(!p.active&&!changed)this.guard=false;return false;}
  if(this.mode==='title'){if(changed||p.active)this.idle=0;if(this.idle+1e-8>=10){this.start({demo:true});return false;}}
  if(this.mode==='demo')this.game.input.padLost=false;
  return true;
 }
 showTitle(){
  this.shell.hide();if(this.mobile){this.shell.show('title',{name:'',subtitle:'',meta:[],footer:'',actions:[['Settings',()=>this.game.menu('settings')]]});return;}this.shell.show('title',{name:'GRAND THEFT\nFIVE-FINGER\nDRIVE',subtitle:'Palm Quay. One crew. One very bad invoice.',meta:['SD / SUNSPOKE BAY','AN ISOMETRIC CRIME CAPER'],footer:'Live demo starts after 10 seconds without input.',actions:[{label:'Play',primary:true,fn:()=>this.playMenu()},['Watch the crew',()=>this.requestDemo()],['Settings',()=>this.game.menu('settings')],['Credits & source',()=>this.credits()]]});
 }
 confirmNew(){const save=new G.Save(this.storage).load();if(!save){this.start();return;}this.shell.show('newRun',{title:'Start a new job?',text:'The next checkpoint will replace your saved run.',actions:[['Start new run',()=>this.start()],['Keep saved run',()=>this.shell.back()]]});}
 playMenu(){const saved=new G.Save(this.storage).load();this.shell.show('playMenu',{kicker:'CHOOSE A RUN',title:'Your next move',actions:[{label:'Continue checkpoint',disabled:!saved,fn:()=>this.start({mission:saved?.mission,restore:saved})},['New run · The Meter Job',()=>this.confirmNew()],['Free roam',()=>this.start({free:true})],['More jobs & test yard',()=>this.moreMenu()]]});}
 moreMenu(page=0){const jobs=Object.values(G.content.missions).filter(d=>d.id!=='meter'),actions=jobs.slice(page*3,page*3+3).map(d=>[d.name,()=>this.start({mission:d.id})]);actions.push(['Developer test yard',()=>this.start({yard:true})]);if((page+1)*3<jobs.length)actions.push(['More jobs',()=>this.moreMenu(page+1)]);actions.push(['Back',()=>this.shell.back()]);this.shell.show('jobs'+page,{kicker:'PALM QUAY',title:'More ways to play',actions});}
 requestDemo(){this.demoRequested=true;this.shell.hide();this.game.input.consumeAll();}
 title(){this.demoRequested=false;this.session?.dispose();this.mode='title';this.guard=false;this.idle=0;this.crewOpen=false;this.pendingRecovery=null;this.game.input.clear();this.game.timeScale=1;this.game.audio.stopMusic();this.musicState=null;if(!this.session)this.session=new G.Session(this,{demo:true,free:true});this.session.demo=true;this.session.free=true;this.session.metrics.botActions=0;this.showTitle();this.game.go('title',null,{fade:0});this.zoneChanged();}
 interrupt(){this.title();this.guard=true;this.game.input.clear();this.physical.active=this.physical.keys.size>0||this.physical.pointers.size>0;}
 start(o={}){
  this.session?.dispose();this.demoRequested=false;if(o.demo)this.lastPhysical=this.physical.seq;this.mode=o.demo?'demo':'play';this.idle=0;this.guard=false;this.crewOpen=false;this.shell.hide();this.game.resume();this.game.input.clear();this.game.timeScale=1;
  this.session=new G.Session(this,{...o,seed:o.seed??516+this.demoCycles});this.replayStart=this.session.serialize();this.replayFrames=[];this.replayQueue=null;this.pendingRecovery=null;
  if(o.demo&&!o.restore){this.session.approach=this.session.definition.choices?.[this.demoIndex%2]?.id||(this.demoIndex%2?'forceful':'quiet');this.session.route=this.demoIndex%3===2?'market':'canal';this.session.flags.approachChosen=true;this.game.input.stopRumble();}
  this.replayStart=this.session.serialize();
  this.game.go('play',null,{fade:0});this.game.scenes.play.pausable=!o.demo;this.zoneChanged();this.musicState=null;this.updateMusic();
 }
 playReplay(r){if(r?.schema!==1||!Array.isArray(r.frames))throw Error('Unsupported replay');this.start({demo:true,mission:r.mission,seed:r.seed,restore:r.initial});this.replayQueue=G.copy(r.frames);this.replayIndex=0;this.replayMode=true;}
 nextDemo(){this.demoCycles++;this.demoIndex=(this.demoIndex+1)%3;this.start({demo:true});}
 recoverDemo(reason){if(this.mode!=='demo')return;this.demoRecoveries.push({reason,seed:this.session.seed,stage:this.session.stage?.id});if(this.demoRecoveries.length>40)this.demoRecoveries.shift();this.demoCycles++;this.start({demo:true});}
 retry(){const payload=this.session.lastCheckpoint||new G.Save(this.storage).load();this.start(payload?{mission:payload.mission,restore:payload}:{mission:this.session.definition.id});}
 chooseApproach(){this.game.pause();const d=this.session.definition;this.shell.show('approach',{kicker:d.name,title:d.choiceTitle||'How do we go in?',text:d.choiceText||'The service gate buys time. The barrier brings the patrols.',actions:d.choices?d.choices.map(c=>[c.label,()=>this.setApproach(c.id)]):[['Quiet · service gate',()=>this.setApproach('quiet')],['Forceful · front barrier',()=>this.setApproach('forceful')]],back:()=>{this.shell.hide();this.game.resume();}});}
 setApproach(which){this.session.approach=which;this.session.flags.approachChosen=true;this.session.flags.brief=true;this.shell.hide();this.game.resume();this.game.input.consumeAll();this.session.checkpoint();}
 shop(){
  if(this.mode==='demo')return;this.game.pause();const buy=(price,fn,carRequired=false)=>{const s=this.session;if(carRequired&&!s.cars.some(v=>G.dist(v,s.controlled)<160)){this.shell.toast('Park a car beside the garage first');return;}if(s.money<price){this.shell.toast('Not enough cash');return;}s.money-=price;fn();s.checkpoint();this.shell.hide();this.game.resume();};
  this.shell.show('shop',{kicker:'MARIGOLD GARAGE',title:'Keep the crew moving',text:()=>'$'+this.session.money+' available',actions:[['Repair car · $100',()=>buy(100,()=>{const v=this.session.cars.filter(v=>G.dist(v,this.session.controlled)<160).sort((a,b)=>G.dist(a,this.session.controlled)-G.dist(b,this.session.controlled))[0];if(v)v.hp=v.maxHP;},true)],['Crew ammunition · $80',()=>buy(80,()=>{for(const a of this.session.crew)for(const [k,w]of Object.entries(G.content.weapons))a.reserve[k]=w.reserve;})],['Crew armor · $120',()=>buy(120,()=>{for(const a of this.session.crew)a.armor=40;})],['Fresh paint · $60',()=>buy(60,()=>{const v=this.session.cars.find(v=>G.dist(v,this.session.controlled)<160);if(v){v.color='#6ab9b0';if(this.session.alert.evidence?.vehicle===v.id)this.session.alert.evidence={vehicle:v.id,color:'unrecognized'};}} ,true)],['Leave',()=>{this.shell.hide();this.game.resume();}]]});
 }
 showMap(){if(this.mode==='demo')return;this.game.pause();const s=this.session;this.shell.show('map',{title:'Palm Quay',map:s.maps.city,at:s.controlled,markers:G.content.places.map(p=>({x:p.x,y:p.y,label:p.name,color:'#f0bd65'})),labels:G.content.places.map(p=>[p.name,p.x,p.y]),actions:[['Canal Road escape',()=>{s.route='canal';this.shell.hide();this.game.resume();}],['Market Loop escape',()=>{s.route='market';this.shell.hide();this.game.resume();}],['Back',()=>{this.shell.hide();this.game.resume();}]]});}
 credits(){this.shell.show('credits',{kicker:'ORIGINAL GAME / ENGINE CREDIT',title:'Made for the arcade',text:'An original Sunspoke Bay story inspired by Grand Theft Auto V.\nBuilt with my-3D2dge 0.46.1 by Michael Crosato (MIT).\nOriginal level, characters, pixel shapes and synthesized score.\nOpenAI / Codex. Exact model and active effort are not exposed.\nFirst prompt: 16 October 2026, America/Vancouver.\nImplementation: Linux, Bash, Node.js and browser Canvas.',actions:[['Controls',()=>this.game.menu('controls')],['Back',()=>this.shell.back()]]});}
 result(won,reason){this.updateMusic();if(this.mode==='demo')return;this.game.pause();const s=this.session;this.shell.show('results',{kicker:won?'THE CITY HEARD YOU':'THE JOB CAN WAIT',title:won?'Invoice disputed.':reason?.split(' — ')[0]||'Crew down',emblem:won?'$':'!',text:won?'The ledger is on air. The crew is together. Palm Quay is still open.':'Your last checkpoint is ready. Try a different route.',stats:[[String(Math.round(s.time/60))+' min','RUN TIME'],['$'+s.money,'CASH'],[s.metrics.crashes,'IMPACTS'],[s.rewards.filter(r=>['lunch','tow'].includes(r)).length+'/2','SIDE JOBS']],actions:won?[['Explore Palm Quay',()=>{s.outcome=null;s.free=true;this.shell.hide();this.game.resume();}],['Replay the job',()=>this.confirmNew()],['Title',()=>this.title()]]:[['Retry checkpoint',()=>this.retry()],['Restart job',()=>this.start({mission:s.definition.id})],['Title',()=>this.title()]]});}
 update(dt){
  if(!this.session)return;const s=this.session;
  let replay=null;if(this.replayQueue){replay=this.replayQueue[this.replayIndex++];if(!replay){this.game.pause();return;}if(s.control!==replay.control)s.switchTo(replay.control);if(replay.tasks)for(const c of s.crew)c.task=replay.tasks[c.id];s.approach=replay.approach;s.route=replay.route;if(replay.action.source==='demo')s.metrics.botActions++;}
  let a=replay?.action||this.testAction|| (this.mode==='demo'?s.bot.action():G.playerAction(this));this.testAction=null;
  if(this.mode==='play'&&!replay){
   if(a.held.crew){if(!this.crewOpen){this.crewOpen=true;this.crewCancelled=false;this.crewChoice=s.crew.indexOf(s.controlled);}if(a.pressed.dodge||a.pressed.cancel)this.crewCancelled=true;const mx=this.game.input.padMove[0]||((this.game.input.down('east')?1:0)-(this.game.input.down('west')?1:0));if(mx<-.3)this.crewChoice=0;else if(mx>.3)this.crewChoice=2;else if(this.game.input.padMove[1]<-.3||this.game.input.down('north'))this.crewChoice=1;if(a.pressed.interact&&!this.crewCancelled){const actor=s.crew[this.crewChoice],tasks=['follow','hold','defend','drive','operate'];actor.task=tasks[(tasks.indexOf(actor.task)+1)%tasks.length];s.note(actor.data.name+': '+actor.task);}a=G.emptyAction('physical');}
   else if(this.crewOpen){this.crewOpen=false;if(!this.crewCancelled)s.switchTo(s.crew[this.crewChoice].id);a=G.emptyAction('physical');this.game.input.consumeAll();}
  }
  this.game.timeScale=this.crewOpen?.35:s.crew.some(a=>a.id==='mara'&&a.abilityTime>0)?.72:1;
  if(this.replayFrames.length<120*1800)this.replayFrames.push({action:G.copy(a),control:s.control,approach:s.approach,route:s.route,tasks:Object.fromEntries(s.crew.map(c=>[c.id,c.task]))});
  s.step(dt,a);if(this.pendingRecovery){const reason=this.pendingRecovery;this.pendingRecovery=null;this.recoverDemo(reason);return;}if(s.tick%24===0){const v=s.cars.find(v=>v.id===s.controlled.vehicle);if(v&&Math.abs(v.speed)>10)this.sound('engine',{pitch:.5+Math.abs(v.speed)/180,vol:.2});else if(Math.hypot(s.controlled.vx,s.controlled.vy)>15)this.sound('step');}if(s.tick%120===0)this.updateMusic();
 }
 zoneChanged(){if(!this.session)return;const c=this.session.controlled;this.game.setView(c.zone==='city'?'iso':c.zone==='records'?'topdown':'side');this.game.cam.bounds=null;this.game.cam.snap=true;this.updateCamera();}
 updateCamera(){const c=this.session?.controlled;if(!c)return;let x=c.x,y=c.y,z=c.z-12;if(c.vehicle){const v=this.session.cars.find(v=>v.id===c.vehicle);if(v){x=v.x+v.vx*.25;y=v.y+v.vy*.25;}}if(this.mode==='title'&&c.zone==='city'){x=620+(this.game.reduceMotion?0:Math.sin(this.clock*.2)*35);y=430;z=12;}this.game.focus(x,y,z);if(this.mode==='title'){const p=this.game.view.p(x,y,z);this.game.cam.x=p[0]-this.game.screen.W*.7;this.game.cam.y=p[1]-this.game.screen.H*.5;this.game.cam.snap=false;}}
 installAudio(){
  const A=this.game.audio;A.maxVoices=24;for(const [name,freq,to,dur,wave]of [['shot',780,170,.1,'noise'],['crash',170,40,.22,'noise'],['door',160,80,.08,'triangle'],['radio',1100,1400,.07,'triangle'],['skill',520,1200,.3,'triangle'],['reload',1200,450,.12,'noise'],['gate',240,120,.2,'saw'],['ledger',660,1320,.22,'triangle'],['switch',440,660,.1,'triangle'],['horn',220,220,.25,'square'],['siren',600,1000,.4,'triangle'],['clear',620,1240,.25,'triangle'],['objective',740,1480,.3,'triangle'],['success',523,1046,.5,'triangle'],['melee',180,70,.1,'noise'],['engine',80,100,.16,'triangle'],['tire',1700,700,.13,'noise'],['cover',180,210,.08,'triangle']])A.define('sd-'+name,{wave,freq,to,dur,vol:.16});
  this.songs={calm:{bpm:96,steps:4,tracks:[{wave:'triangle',vol:.12,notes:'D3 . . A3 . . F3 . C3 . . G3 . . E3 .'}, {wave:'square',vol:.035,notes:'A4 - . . F4 - E4 . D4 - . . C4 - E4 .'}, {wave:'drums',vol:.07,notes:'k . h . . . h . s . h . . . h .'}]},chase:{bpm:132,steps:4,tracks:[{wave:'triangle',vol:.13,notes:'D3 D3 . A2 D3 . F3 . C3 C3 . G2 C3 . E3 .'}, {wave:'square',vol:.05,notes:'A4 . F4 . E4 . D4 . G4 . E4 . D4 . C4 .'}, {wave:'drums',vol:.1,notes:'k . h h s . h . k k h h s . h .'}]}};
  this.songs.title={bpm:88,steps:4,tracks:[{wave:'triangle',vol:.12,notes:'D3 - . A3 . . F3 . C3 - . G3 . . E3 .'}, {wave:'square',vol:.035,notes:'D5 - A4 - F4 - E4 . C5 - G4 - E4 - D4 .'}]};
  this.songs.tension={bpm:108,steps:4,tracks:[{wave:'triangle',vol:.11,notes:'D2 . A2 . D2 . F2 . C2 . G2 . C2 . E2 .'}, {wave:'square',vol:.025,notes:'A4 - . . . . F4 . E4 - . . . . D4 .'}, {wave:'drums',vol:.05,notes:'k . . h . . . h k . . h . . . h'}]};
  this.songs.success={bpm:116,steps:4,tracks:[{wave:'triangle',vol:.13,notes:'D3 . F3 . A3 . D4 . C3 . E3 . G3 . C4 .'}, {wave:'square',vol:.04,notes:'D5 - F5 - A5 - F5 - E5 - G5 - C6 - G5 -'}, {wave:'drums',vol:.07,notes:'k . h . s . h . k . h . s . h .'}]};
 }
 sound(id,options={}){if(this.game.headless||!this.audioUnlocked||this.mode==='demo'&&this.game.settings.sdDemoAudio===false)return;const t=this.clock;this.soundTimes=this.soundTimes.filter(t0=>t-t0<.5);if(this.soundTimes.length>=14)return;this.soundTimes.push(t);const name=['hurt','heal','jump','step'].includes(id)?id:'sd-'+id;if(id==='step'){const c=this.session?.controlled;options={pitch:c?.zone==='gantry'?1.4:c?.zone==='records'?1.05:.8,vol:.5,...options};}this.game.audio.sfx(name,{...options,vol:(this.mode==='demo'?.3:1)*(options.vol??1),vary:0});}
 updateMusic(){if(this.game.headless||!this.audioUnlocked||this.mode==='demo'&&this.game.settings.sdDemoAudio===false){this.game.audio.stopMusic();this.musicState=null;return;}const s=this.session,state=this.mode==='title'?'title':s?.outcome==='success'?'success':s?.alert.heat?'chase':s?.controlled.zone!=='city'||['entry','relay','ledger'].includes(s?.stage?.id)?'tension':'calm';if(state!==this.musicState){this.musicState=state;this.game.audio.music(this.songs[state]);}}
 snapshot(){return {mode:this.mode,idle:+this.idle.toFixed(4),guard:this.guard,cycles:this.demoCycles,errors:this.game.errors,session:this.session?.snapshot()};}
};
G.app=new G.App();
})();
