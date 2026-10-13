import { Mission, LEVEL } from './simulation.js';
import { WorldRenderer } from './renderer.js';
import { WebGPUFilter } from './postfx.js';
const SAVE='hushline.checkpoint.v1',PREFS='hushline.settings.v1';
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Game art could not load. Reload the page.'));i.src=src;});
export async function createHushline(canvas,gpuCanvas,callbacks={}){
  const E=window.My3D2dge;if(!E)throw new Error('The supplied game engine did not load.');
  const [cavern,ship]=await Promise.all([loadImage('/games/drive-site-hushline-listening-vault/art/cavern.png'),loadImage('/games/drive-site-hushline-listening-vault/art/ship.png')]);
  const game=new E.Game({canvas,view:'overhead',smooth:true,logicalHeight:720,bg:'#06141d',step:1/120,input:{
    up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],
    quiet:['Digit1'],thermal:['Digit2'],off:['Digit3','Pad1'],scan:['Space','Pad0'],interact:['KeyE','Pad2'],vent:['KeyV','Pad5'],lamp:['KeyL','KeyF','Pad3'],precision:['ShiftLeft','ShiftRight','Pad6'],cycle:['KeyC','Pad4'],pause:['Escape','KeyP','Pad9'],start:['Enter'],retry:['KeyR']
  }});
  game.pauseOverlay=false;game.cam.smooth=.45;game.cam.bounds=()=>({x0:0,y0:60,x1:LEVEL.width,y1:800});
  const held={scan:false,interact:false,vent:false,precision:false};let stick=[0,0],crew='solo',tick=0,exhaust=0,destroyed=false,audioStarted=false,hum=null;
  const settings={volume:45,reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false,assist:false,crew:'solo',filter:'none',pixelSize:4,bands:7,edge:.65,mix:.9,saturation:1.08,levels:16,dither:.3,...E.store.get(PREFS,{})};
  const filter=new WebGPUFilter(gpuCanvas,s=>callbacks.onGPU?.(s));
  const emit=(kind,data)=>{
    if(kind==='save')E.store.set(SAVE,data);
    if(['scan','echo','checkpoint','archive'].includes(kind)){game.audio.sfx(kind==='echo'?'secret':kind==='archive'?'powerup':'heal',{vol:.3});game.particles.glints(mission.ship.x,mission.ship.y,0,12,'#b6ffda');}
    if(kind==='mode')game.audio.sfx({wave:'sine',freq:data.mode==='thermal'?110:data.mode==='off'?70:220,to:data.mode==='off'?40:330,dur:.15,vol:.13});
    if(kind==='damage'){game.shake(4);game.audio.sfx('hit',{vol:.4});game.particles.sparks(data.x,data.y,0,12);game.flash('#ed8864',.15,.25);}
    if(kind==='dead'){game.audio.sfx('explode',{vol:.45});game.particles.explosion(mission.ship.x,mission.ship.y,0,.8);game.go('failed',{}, {fade:.25});}
    if(kind==='gate'){game.audio.sfx('door',{vol:.35});game.shake(1.2);}
    if(kind==='tow')game.audio.sfx('confirm',{vol:.25});
    if(kind==='laser')game.audio.sfx('laser',{vol:.35});
    if(kind==='archive'){game.shake(4);game.flash('#a8e6c5',.5,.24);}
    if(kind==='complete'){E.store.set(SAVE,null);E.store.set('hushline.last-result.v1',data);game.go('complete',{}, {fade:.6});game.audio.music({bpm:56,steps:2,tracks:[{wave:'sine',vol:.18,notes:'D4 - A4 - | F4 - C5 - | A4 - D5 -'}]});}
    callbacks.onEvent?.(kind,data);
  };
  const mission=new Mission(E,emit);const renderer=new WorldRenderer(game,mission,{cavern,ship});
  const applySettings=(next,persist=true)=>{
    Object.assign(settings,next);mission.assist=!!settings.assist;game.reduceMotion=!!settings.reducedMotion;game.audio.setVolume(settings.volume/100);crew=settings.crew;
    if(crew==='duo')game.input.use({...game.input.map,up:['ArrowUp','Pad12'],down:['ArrowDown','Pad13'],left:['ArrowLeft','Pad14'],right:['ArrowRight','Pad15']});
    else game.input.use({...game.input.map,up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15']});
    filter.set({mode:settings.filter,pixelSize:settings.pixelSize,bands:settings.bands,edge:settings.edge,mix:settings.mix,saturation:settings.saturation,levels:settings.levels,dither:settings.dither});
    if(persist)E.store.set(PREFS,settings);
  };
  function startAudio(){
    if(audioStarted)return;audioStarted=true;game.audio.sfx('confirm',{vol:.18});
    game.audio.music({bpm:38,steps:2,tracks:[{wave:'sine',vol:.12,notes:'D3 - - . | . . A3 - | . . F3 - | - . . . | C4 - . . | A3 - - . | . . . . | . . . .'}]});
    const c=game.audio.ctx;if(c){const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.value=52;gain.gain.value=0;osc.connect(gain);gain.connect(game.audio.sfxBus);osc.start();hum={osc,gain,c};}
  }
  function begin(resume=false){game.paused=false;startAudio();mission.start(resume?E.store.get(SAVE,null):null);mission.assist=!!settings.assist;renderer.gateTween={};game.cam.snap=true;game.input.clear();game.go('flight',{}, {fade:.65});callbacks.onState?.(mission.state());}
  function inputStep(){const i=game.input;
    for(const mode of ['quiet','thermal','off'])if(i.pressed(mode))mission.setMode(mode);
    if(i.pressed('cycle'))mission.setMode({quiet:'thermal',thermal:'off',off:'quiet'}[mission.mode]);
    if(i.pressed('lamp'))mission.lamp=!mission.lamp;
    if(i.pressed('pause'))callbacks.onPause?.();
    if(i.pressed('retry')){mission.retry();game.cam.snap=true;}
    const move=i.move();return {x:Math.abs(stick[0])>.05?stick[0]:move[0],y:Math.abs(stick[1])>.05?stick[1]:move[1],scan:i.down('scan')||held.scan,interact:i.down('interact')||held.interact,vent:i.down('vent')||held.vent,precision:i.down('precision')||held.precision};
  }
  function flight(dt){const inputs=inputStep();if(game.paused)return;mission.update(dt,inputs);const s=mission.ship;game.focus(s.x+120,s.y*.25+420*.75,0);
    exhaust+=dt;if(exhaust>.035){exhaust=0;if(mission.mode!=='off'&&mission.status==='playing'){const face=s.vx<-20?-1:1;game.particles.add({x:s.x-face*57,y:s.y+6,z:1,vx:-face*(20+mission.thrust*90),vy:(Math.random()-.5)*9,kind:'spark',size:.6,max:.35+mission.thrust*.3,color:mission.mode==='thermal'?'#f6bf80':'#83d9cb',hot:'#cef3cf'});}if(mission.venting)game.particles.add({x:s.x-10,y:s.y-20,z:1,vx:(Math.random()-.5)*20,vy:-30,kind:'smoke',size:5,max:.7,color:'#82b7bc'});}
    if(hum){hum.osc.frequency.setTargetAtTime(mission.mode==='thermal'?64+mission.thrust*40:46+mission.thrust*22,hum.c.currentTime,.2);hum.gain.gain.setTargetAtTime(mission.mode==='off'?0:.05+mission.thrust*.06,hum.c.currentTime,.15);}
    tick+=dt;if(tick>.09){tick=0;canvas.dataset.fps=String(game.fps);canvas.dataset.scene=game.sceneName;canvas.dataset.x=String(Math.round(s.x));canvas.dataset.y=String(Math.round(s.y));canvas.dataset.time=String(mission.time.toFixed(2));callbacks.onState?.(mission.state());}
  }
  const present=game.screen.present.bind(game.screen);game.screen.present=()=>{present();filter.render(canvas,game.H);};
  game.start({scene:'title',scenes:{
    title:{update(dt){game.focus(game.W/2,420,0);if(game.input.pressed('start'))begin(false);},draw:r=>renderer.draw(r,true)},
    flight:{update:flight,draw:r=>renderer.draw(r)},
    failed:{update(){if(hum)hum.gain.gain.setTargetAtTime(0,hum.c.currentTime,.2);if(game.input.pressed('retry')||game.input.pressed('start'))retry();},draw:r=>renderer.draw(r)},
    complete:{update(){if(hum)hum.gain.gain.setTargetAtTime(0,hum.c.currentTime,.2);},draw:r=>renderer.draw(r)}
  }});
  function retry(){game.paused=false;mission.retry();renderer.gateTween={};game.cam.snap=true;game.input.clear();game.go('flight',{}, {fade:.35});callbacks.onState?.(mission.state());}
  function pause(p){game.paused=p;game.input.clear();for(const k of Object.keys(held))held[k]=false;stick=[0,0];if(hum)hum.gain.gain.setTargetAtTime(p?0:.04,hum.c.currentTime,.15);}
  const resize=new ResizeObserver(()=>game.screen.resize());resize.observe(canvas);
  const visibility=()=>{if(document.hidden&&mission.status==='playing'&&!game.paused)callbacks.onPause?.();};document.addEventListener('visibilitychange',visibility);
  const api={start:begin,retry,pause,setMode:m=>{mission.setMode(m);callbacks.onState?.(mission.state());},setPower:p=>{mission.power=E.clamp(p,35,100);callbacks.onState?.(mission.state());},toggleLamp:()=>{mission.lamp=!mission.lamp;callbacks.onState?.(mission.state());},hold:(key,on)=>{if(key in held)held[key]=on;},setStick:(x,y)=>{stick=[x,y];},settings:applySettings,getSettings:()=>({...settings}),getRecoveredSignals:()=>LEVEL.echoes.filter(e=>mission.echoes.includes(e.id)).map(e=>({id:e.id,speaker:e.title,text:e.text})),hasSave:()=>!!E.store.get(SAVE,null),getState:()=>mission.state(),getDiagnostics:()=>({engine:E.version,errors:[...game.errors],fps:game.fps,frameMs:game.stats.frameMs,filter:filter.status,scene:game.sceneName,paused:game.paused}),destroy:()=>{destroyed=true;resize.disconnect();document.removeEventListener('visibilitychange',visibility);game._running=false;cancelAnimationFrame(game._raf);game.input.abort?.abort();game.screen._resizeHandler&&removeEventListener('resize',game.screen._resizeHandler);filter.destroy();game.audio.music(null);hum?.osc.stop();game.audio.ctx?.close();}};
  const webAbort=new AbortController();
  const destroyBase=api.destroy;api.destroy=()=>{webAbort.abort();destroyBase();};
  const context=document.modelContext;
  if(context?.registerTool){
    const register=tool=>{try{Promise.resolve(context.registerTool({...tool,annotations:{readOnlyHint:tool.name==='read_ship_state',untrustedContentHint:false}},{signal:webAbort.signal})).catch(()=>{});}catch{}};
    const schema=properties=>({type:'object',properties,additionalProperties:false});
    register({name:'read_ship_state',title:'Read ship state',description:'Read the current mission, ship signals, nearby keeper limits, controls, and engine diagnostics. This does not change the game.',inputSchema:schema({}),execute:()=>({...api.getState(),diagnostics:api.getDiagnostics()})});
    register({name:'configure_ship',title:'Configure ship systems',description:'Use the same drive, thrust, and lamp controls as the engineering console. Does not move the ship.',inputSchema:schema({mode:{type:'string',enum:['quiet','thermal','off']},power:{type:'number',minimum:35,maximum:100},lamp:{type:'boolean'}}),execute:async input=>{if(input.mode!==undefined&&!['quiet','thermal','off'].includes(input.mode))throw new Error('Unknown drive.');if(input.power!==undefined&&(!Number.isFinite(input.power)||input.power<35||input.power>100))throw new Error('Thrust must be between 35 and 100.');if(input.lamp!==undefined&&typeof input.lamp!=='boolean')throw new Error('Lamp must be true or false.');if(input.mode)api.setMode(input.mode);if(input.power!==undefined)api.setPower(input.power);if(input.lamp!==undefined&&input.lamp!==mission.lamp)api.toggleLamp();await new Promise(resolve=>requestAnimationFrame(resolve));return api.getState();}});
    register({name:'pilot_ship',title:'Pilot the ship',description:'Hold normal flight and auxiliary controls for up to five real seconds, then release them. Uses the same simulation as keyboard and touch controls. The mission must be running and unpaused.',inputSchema:schema({x:{type:'number',minimum:-1,maximum:1},y:{type:'number',minimum:-1,maximum:1},seconds:{type:'number',minimum:.05,maximum:5},scan:{type:'boolean'},vent:{type:'boolean'},interact:{type:'boolean'},precision:{type:'boolean'}}),execute:async input=>{if(game.paused||mission.status!=='playing')throw new Error('Start or resume the mission first.');for(const k of ['x','y'])if(input[k]!==undefined&&(!Number.isFinite(input[k])||Math.abs(input[k])>1))throw new Error('Movement must be between -1 and 1.');const seconds=input.seconds??.25;if(!Number.isFinite(seconds)||seconds<.05||seconds>5)throw new Error('Duration must be between 0.05 and 5 seconds.');for(const k of ['scan','vent','interact','precision'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw new Error(k+' must be true or false.');api.setStick(input.x||0,input.y||0);for(const k of Object.keys(held))api.hold(k,!!input[k]);try{await new Promise(resolve=>setTimeout(resolve,seconds*1000));}finally{api.setStick(0,0);for(const k of Object.keys(held))api.hold(k,false);}callbacks.onState?.(mission.state());await new Promise(resolve=>requestAnimationFrame(resolve));return api.getState();}});
  }
  applySettings({},false);callbacks.onState?.(mission.state());callbacks.onReady?.({saved:api.hasSave(),settings:{...settings}});
  // Read-only state for support and browser verification. No bypass or teleport controls.
  window.__hushline={state:api.getState,diagnostics:api.getDiagnostics};
  return api;
}

window.createHushline = createHushline;
