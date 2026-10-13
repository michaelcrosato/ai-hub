/* Nacre visual effects. Presentation only. No simulation, world, or save writes. */
(function (root) {
'use strict';
const VERSION='0.4.0', KEY='nacre:visuals:v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const EFFECTS=Object.freeze([
 {id:'bloom',group:'Light',name:'Bloom',detail:'Soft light around bright stone and lamps.'},
 {id:'shafts',group:'Light',name:'Sun shafts',detail:'Warm bands of light across the city.'},
 {id:'lamps',group:'Light',name:'Lantern glow',detail:'Light from the lamps in the street.'},
 {id:'flare',group:'Light',name:'Sun flare',detail:'A soft lens glow near the edge of the view.'},
 {id:'mist',group:'Air and weather',name:'Drifting mist',detail:'Thin layers of mist, clear near Mara.',motion:true},
 {id:'dust',group:'Air and weather',name:'Dust motes',detail:'Small specks of dust in the light.',motion:true},
 {id:'embers',group:'Air and weather',name:'Embers',detail:'Warm sparks that rise through the air.',motion:true},
 {id:'rain',group:'Air and weather',name:'Rain',detail:'Fine rain across the view.',motion:true},
 {id:'snow',group:'Air and weather',name:'Snow',detail:'Slow flakes carried by the wind.',motion:true},
 {id:'leaves',group:'Air and weather',name:'Windblown leaves',detail:'Loose leaves that turn as they fall.',motion:true},
 {id:'water',group:'Surfaces',name:'Water glints',detail:'Moving light on exposed water only.',motion:true},
 {id:'heat',group:'Surfaces',name:'Heat shimmer',detail:'Small waves near hot furnaces.',motion:true},
 {id:'grade',group:'Image',name:'Warm light and cool shade',detail:'Richer stone, cloth, and shadow colours.'},
 {id:'sharpen',group:'Image',name:'Fine detail',detail:'A small increase in edge contrast.'},
 {id:'vignette',group:'Image',name:'Soft edge shade',detail:'A light shade at the outer edge of the view.'},
 {id:'grain',group:'Image',name:'Film grain',detail:'A fine texture across the image.',motion:true},
 {id:'aberration',group:'Image',name:'Lens colour fringe',detail:'A small colour split at the outer edges.',motion:true}
]);
const PRESETS=Object.freeze({
 golden:{name:'Golden city',detail:'Warm sun, dust, and light on stone.',on:['bloom','shafts','lamps','flare','dust','water','grade','sharpen','vignette']},
 rain:{name:'Harbour rain',detail:'Rain, mist, and warm lamps.',on:['bloom','lamps','mist','rain','water','grade','sharpen','vignette']},
 winter:{name:'Winter light',detail:'Soft snow and cool air.',on:['bloom','lamps','mist','snow','water','grade','sharpen','vignette']},
 embers:{name:'Furnace air',detail:'Dust, sparks, and heat near furnaces.',on:['bloom','shafts','lamps','mist','dust','embers','heat','water','grade','sharpen','vignette']},
 clear:{name:'Clear detail',detail:'Colour and edges, with no weather.',on:['grade','sharpen']},
 all:{name:'All effects',detail:'Every effect, within the same limits.',on:EFFECTS.map(x=>x.id)}
});
function defaults(){return {version:1,enabled:true,backend:'auto',quality:'balanced',strength:.85,reduceMotion:!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches,preset:'golden',effects:Object.fromEntries(EFFECTS.map(x=>[x.id,PRESETS.golden.on.includes(x.id)]))};}
function normalise(value){
 const d=defaults(),v=value&&typeof value==='object'?value:{};
 for(const k of ['enabled','reduceMotion'])if(typeof v[k]==='boolean')d[k]=v[k];
 if(['auto','webgpu','webgl2','canvas'].includes(v.backend))d.backend=v.backend;
 if(['low','balanced','high'].includes(v.quality))d.quality=v.quality;
 if(Number.isFinite(v.strength))d.strength=clamp(v.strength,0,1.5);
 if(Object.hasOwn(PRESETS,v.preset)||v.preset==='custom')d.preset=v.preset;
 for(const e of EFFECTS)if(typeof v.effects?.[e.id]==='boolean')d.effects[e.id]=v.effects[e.id];
 return d;
}
function readSettings(){try{return normalise(JSON.parse(root.localStorage.getItem(KEY)||'null'));}catch{return defaults();}}
function copy(v){return JSON.parse(JSON.stringify(v));}
function errorText(e){return String(e?.message||e||'The effects could not start.').replace(/[\r\n]+/g,' ').slice(0,220);}
class Controller {
 constructor(engine,{sample=()=>({paused:true,clock:0})}={}){
  this.engine=engine;this.sample=sample;this.settings=readSettings();this.backend=null;this.canvas=null;this.backendName='canvas';this.phase='off';this.message='';this.failures=[];this.blocked=new Set();this.listeners=new Set();this.generation=0;this.disposed=false;this.compareBase=false;this.time=0;this.lastClock=null;this.cpuMs=0;this.lastNotify=0;this.frameCount=0;this.initCount=0;
  this.pendingCanvases=new Set();this.previousPresentation=engine.presentation||null;engine.presentation=this;
  this.onPageHide=event=>{if(event?.persisted){this.generation++;this.release();this.phase='off';this.lastClock=null;}else this.dispose();};root.addEventListener?.('pagehide',this.onPageHide);
  this.onPageShow=event=>{if(event?.persisted&&!this.disposed){this.lastClock=null;this.restart();}};root.addEventListener?.('pageshow',this.onPageShow);
  this.onStorage=e=>{if(e.key===KEY){this.settings=readSettings();this.restart();}};root.addEventListener?.('storage',this.onStorage);
  this.restart();
 }
 config(){return copy(this.settings);}
 effective(){const v=this.config();if(v.reduceMotion)for(const e of EFFECTS)if(e.motion)v.effects[e.id]=false;return v;}
 hasEffects(){return this.settings.enabled&&this.settings.backend!=='canvas'&&this.settings.strength>0&&Object.values(this.effective().effects).some(Boolean);}
 configure(patch){
  const old=this.settings;this.settings=normalise({...old,...patch,effects:{...old.effects,...patch.effects}});
  if(patch.effects&&!patch.preset)this.settings.preset='custom';
  try{root.localStorage.setItem(KEY,JSON.stringify(this.settings));this.storageError=false;}catch{this.storageError=true;}
  if(old.backend!==this.settings.backend||!this.hasEffects()||!this.backend&&this.phase!=='loading')this.restart();
  else this.notify(true);
  return this.config();
 }
 preset(id){const p=PRESETS[id];if(!p)return;this.configure({enabled:true,preset:id,effects:Object.fromEntries(EFFECTS.map(e=>[e.id,p.on.includes(e.id)]))});}
 reset(){this.settings=defaults();try{root.localStorage.removeItem(KEY);}catch{}this.blocked.clear();this.compareBase=false;this.restart();}
 compare(value){this.compareBase=!!value;if(value)this.show(false);this.notify(true);}
 subscribe(fn){this.listeners.add(fn);fn(this.status());return()=>this.listeners.delete(fn);}
 notify(force=false){const now=root.performance?.now?.()||Date.now();if(!force&&now-this.lastNotify<500)return;this.lastNotify=now;const s=this.status();for(const fn of this.listeners)try{fn(s);}catch{}if(root.location?.hostname==='terminal.local'){let q=document.getElementById('nacre-vfx-qa-state');if(!q){q=document.createElement('script');q.id='nacre-vfx-qa-state';q.type='application/json';document.body.appendChild(q);}q.textContent=JSON.stringify(s);}}
 status(){const stats=this.backend?.stats?.()||{};return {version:VERSION,state:this.phase,backend:this.backendName,requestedBackend:this.settings.backend,enabled:this.settings.enabled,quality:this.settings.quality,preset:this.settings.preset,strength:this.settings.strength,reduceMotion:this.settings.reduceMotion,compareBase:this.compareBase,message:this.message,effects:{...this.settings.effects},activeEffects:Object.entries(this.effective().effects).filter(([,v])=>v).map(([k])=>k),cpuSubmitMs:+this.cpuMs.toFixed(2),visualTime:+this.time.toFixed(3),frames:this.frameCount,stats:{...stats},storageError:!!this.storageError,failures:this.failures.slice(-4)};}
 show(on){if(this.canvas)this.canvas.style.display=on?'block':'none';}
 release(){this.show(false);this.lastPresentedAt=0;try{this.backend?.dispose();}catch{}this.backend=null;this.canvas?.remove();this.canvas=null;for(const c of this.pendingCanvases)c.remove();this.pendingCanvases.clear();this.backendName='canvas';}
 restart(){
  const ticket=++this.generation;this.release();if(this.disposed)return;
  if(!this.hasEffects()){this.phase='off';this.message=this.settings.enabled?'No visual effects are active.':'Visual effects are off.';this.notify(true);return;}
  this.phase='loading';this.message='Starting visual effects…';this.notify(true);this.initCount++;
  const candidates=this.settings.backend==='webgl2'?['webgl2']:['webgpu','webgl2'];
  this.initialising=this.startCandidates(candidates,ticket).catch(e=>{if(ticket===this.generation&&!this.disposed){this.release();this.phase='unavailable';this.message=errorText(e);this.notify(true);}});
 }
 async startCandidates(names,ticket){
  let reason='';
  for(const name of names){
   if(ticket!==this.generation||this.disposed)return;
   if(this.blocked.has(name))continue;
   if(name==='webgpu'&&(!root.isSecureContext||!root.navigator?.gpu)){reason=!root.isSecureContext?'WebGPU needs a secure page.':'WebGPU is not available in this browser.';continue;}
   const api=root.NacreVFXBackends?.[name];if(!api){reason='The '+name+' effects module is not available.';continue;}
   const c=document.createElement('canvas');c.className='nacre-vfx-surface';c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;image-rendering:pixelated;z-index:0';
   const source=this.engine.screen.canvas;source.insertAdjacentElement('afterend',c);this.pendingCanvases.add(c);
   let backend;
   try{
    backend=await api.create(c,{onLoss:e=>{if(ticket===this.generation&&!this.disposed)this.fail(e,name);}});this.pendingCanvases.delete(c);
    if(ticket!==this.generation||this.disposed){backend?.dispose();c.remove();return;}
    this.canvas=c;this.backend=backend;this.backendName=name;this.phase='ready';this.message=reason?(reason+' '+(name==='webgl2'?'WebGL2 is active.':'')).trim():'';this.notify(true);return;
   }catch(e){try{backend?.dispose();}catch{}c.remove();this.pendingCanvases.delete(c);if(ticket!==this.generation||this.disposed)return;reason=errorText(e);this.failures.push({backend:name,reason});this.blocked.add(name);}
  }
  if(ticket===this.generation&&!this.disposed){this.phase='unavailable';this.message=(reason||'No effects backend is available.')+' The base game image is active.';this.notify(true);}
 }
 fail(error,name=this.backendName){
  if(this.disposed)return;const reason=errorText(error);this.failures.push({backend:name,reason});this.blocked.add(name);this.message=reason;this.restart();
 }
 retry(){this.blocked.clear();this.restart();}
 suspend(message){this.show(false);this.message=message;this.notify();}
 render(source){
  if(this.disposed)return;const start=root.performance?.now?.()||0;
  // Sampling is read-only. The visual clock has no timer, RNG, or callback into update().
  const cfg=this.effective(),willDraw=this.backend&&this.hasEffects()&&!this.compareBase,sample=this.sample(willDraw?cfg:{...cfg,effects:{}})||{},clock=Number.isFinite(sample.clock)?sample.clock:0;
  const delta=sample.paused||sample.active===false||this.lastClock===null?0:clamp(clock-this.lastClock,0,.05);this.lastClock=clock;this.time+=delta;
  if(!this.backend||!this.hasEffects()||this.compareBase||sample.active===false||document.hidden){this.show(false);this.notify();return;}
  if(!source.width||!source.height){this.show(false);return;}
  const limits={low:[1280,720],balanced:[1600,900],high:[1920,1080]}[cfg.quality],scale=Math.min(1,limits[0]/source.width,limits[1]/source.height);
  const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  const frame={...sample,time:this.time,delta,player:sample.player||[.5,.57],sun:sample.sun||[.14,.1],lights:(sample.lights||[]).slice(0,16)};
  try{const drawn=this.backend.render(source,frame,cfg);if(drawn===true){this.show(true);this.frameCount++;this.lastPresentedAt=start;}else if(this.canvas?.style.display==='block'&&start-(this.lastPresentedAt||0)>120){this.fail(new Error('The effects could not keep up with the game view.'));}}catch(e){this.fail(e);}
  this.cpuMs=this.cpuMs*.92+Math.max(0,(root.performance?.now?.()||start)-start)*.08;this.notify();
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.release();if(this.engine.presentation===this)this.engine.presentation=this.previousPresentation;root.removeEventListener?.('pagehide',this.onPageHide);root.removeEventListener?.('pageshow',this.onPageShow);root.removeEventListener?.('storage',this.onStorage);this.listeners.clear();}
}

// Projection is the same as Screen.present(). Work from render data already in memory.
function project(engine,x,y,z=0){const s=engine.screen,p=engine.r.w(x,y,z);return[(s.OX-Math.round(s.fx*s.S)+p[0]*s.S)/s.canvas.width,(s.OY-Math.round(s.fy*s.S)+p[1]*s.S)/s.canvas.height];}
function hull(points){const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],hi=[];for(const a of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),a)<=0)lo.pop();lo.push(a);}for(const a of p.slice().reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),a)<=0)hi.pop();hi.push(a);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
function citySampler(explorer){
 let mask=null,groundMask=null,lastKey='',lastData=null;
 return settings=>{
  const engine=explorer.game,p=explorer.player,s=engine.screen,U=20;
  const base={active:explorer.active,paused:explorer.paused,clock:explorer.worldClock,player:project(engine,p.x,p.y,p.z+19),camera:[engine.r.ix,engine.r.iy],lights:[],maskCanvas:null};
  if(!explorer.active)return base;const data=explorer.drawData;if(!data)return base;
  const props=[...(data.props||[]),...(explorer.lifeProps||[])];
  if(settings.effects.lamps||settings.effects.heat){
   for(const b of [...props,...(data.landmarks||[])]){
    const hot=['kiln','glass-furnace','brazier','furnace'].includes(b.kind),lamp=['lantern','lamp','lighthouse'].includes(b.kind);if(!hot&&!lamp)continue;
    const q=project(engine,(b.x+(b.w||0)*.5)*U,(b.y+(b.d||0)*(hot?1:.5)+(hot?.2:0))*U,((b.z||0)+(hot?Math.min(3.2,(b.h||4)*.18):(b.h||2.5)*.86))*U);if(q[0]<-.15||q[0]>1.15||q[1]<-.15||q[1]>1.15)continue;
    base.lights.push({x:q[0],y:q[1],radius:clamp((hot?8:4)*U*engine.r.view.scale*s.S/s.canvas.height,.015,.22),color:hot?[1,.45,.15]:[1,.76,.36],heat:hot?1:0});
   }
   base.lights.sort((a,b)=>Math.hypot(a.x-base.player[0],a.y-base.player[1])-Math.hypot(b.x-base.player[0],b.y-base.player[1]));base.lights.length=Math.min(16,base.lights.length);
  }
  if(!settings.effects.water)return base;
  if(!mask){mask=document.createElement('canvas');groundMask=document.createElement('canvas');}const w=320,h=Math.max(90,Math.round(w*s.canvas.height/s.canvas.width));
  const key=[engine.r.ix,engine.r.iy,s.fx,s.fy,s.S,s.OX,s.OY,s.canvas.width,s.canvas.height,engine.r.view.id,engine.r.view.scale].join(':');
  // Cache static water and building silhouettes; remove moving bodies from a small copy below.
  if(key!==lastKey||data!==lastData){
   groundMask.width=w;groundMask.height=h;const g=groundMask.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,w,h);
   const poly=(points,color)=>{if(points.length<3)return;g.fillStyle=color;g.beginPath();points.forEach((v,i)=>i?g.lineTo(v[0]*w,v[1]*h):g.moveTo(v[0]*w,v[1]*h));g.closePath();g.fill();};
   const rect=(b,z,color)=>poly([[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]].map(v=>project(engine,v[0]*U,v[1]*U,z*U)),color);
   for(const b of data.water||[])rect(b,b.z||-.1,'#f00');
   for(const b of data.plazas||[])rect(b,.02,'#000');
   for(const b of data.roads||[]){const points=b.points||[],half=(b.width||b.w||3)*.55;for(let i=1;i<points.length;i++){const a=points[i-1],c=points[i],dx=c.x-a.x,dy=c.y-a.y,n=Math.hypot(dx,dy)||1;poly([[a.x-dy/n*half,a.y+dx/n*half],[c.x-dy/n*half,c.y+dx/n*half],[c.x+dy/n*half,c.y-dx/n*half],[a.x+dy/n*half,a.y-dx/n*half]].map(v=>project(engine,v[0]*U,v[1]*U,.05*U)), '#000');}}
   for(const b of props)if(b.kind==='fountain'){const cx=b.x+b.w*.5,cy=b.y+b.d*.5;poly(Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return project(engine,(cx+Math.cos(a)*b.w*.32)*U,(cy+Math.sin(a)*b.d*.32)*U,.47*U);}), '#f00');}
   for(const b of [...(data.buildings||[]),...(data.landmarks||[])]){const pts=[];for(const x of[b.x,b.x+b.w])for(const y of[b.y,b.y+b.d])for(const z of[0,b.h||0])pts.push(project(engine,x*U,y*U,z*U));poly(hull(pts),'#000');}
   lastKey=key;lastData=data;
  }
  if(mask.width!==w||mask.height!==h){mask.width=w;mask.height=h;}const mg=mask.getContext('2d');mg.drawImage(groundMask,0,0);mg.fillStyle='#000';
  for(const a of [...explorer.npcs.values(),...(explorer.enemies?.values()||[]),...(explorer.targetActors?.values()||[]),p]){const feet=project(engine,a.x,a.y,a.z),head=project(engine,a.x,a.y,a.z+35),radius=Math.max(2,9*engine.r.view.scale*s.S/s.canvas.width*w);mg.fillRect(feet[0]*w-radius,head[1]*h-radius,radius*2,(feet[1]-head[1])*h+radius*2);}
  base.maskCanvas=mask;return base;
 };
}
function attachExplorer(explorer){return new Controller(explorer.game,{sample:citySampler(explorer)});}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mounted=new WeakMap();
function mountPanel(host,controller){
 unmountPanel(host);if(!controller){host.innerHTML='<p>Visual effects are not available in this view.</p>';return;}
 const c=controller.config();
 host.innerHTML='<div class="vfx-controls"><p class="vfx-intro">Change the city image. These controls do not change game rules. The city is paused while this panel is open.</p><div class="vfx-status" role="status" aria-live="polite"><strong data-vfx-status></strong><span data-vfx-note></span></div><div class="vfx-topline"><label class="vfx-toggle"><input type="checkbox" data-vfx="enabled" '+(c.enabled?'checked':'')+'><span>Visual effects</span></label><button type="button" data-vfx-action="compare" aria-pressed="'+controller.compareBase+'">'+(controller.compareBase?'Show effects':'Show base image')+'</button></div><div class="vfx-selects"><label>Render method<select data-vfx="backend">'+Object.entries({auto:'Auto · WebGPU first',webgpu:'WebGPU · use fallback if needed',webgl2:'WebGL2',canvas:'Base image · no GPU effects'}).map(([v,n])=>'<option value="'+v+'" '+(c.backend===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Effect quality<select data-vfx="quality">'+Object.entries({low:'Low',balanced:'Balanced',high:'High'}).map(([v,n])=>'<option value="'+v+'" '+(c.quality===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><label class="vfx-preset-label">City look<select data-vfx="preset">'+Object.entries(PRESETS).map(([v,p])=>'<option value="'+v+'" '+(c.preset===v?'selected':'')+'>'+p.name+'</option>').join('')+'<option value="custom" '+(c.preset==='custom'?'selected':'')+'>Custom</option></select></label><p class="vfx-preset-note">'+esc(PRESETS[c.preset]?.detail||'Your own mix of effects.')+'</p><label class="vfx-strength">Effect strength <output data-vfx-strength>'+Math.round(c.strength*100)+'%</output><input type="range" data-vfx="strength" min="0" max="150" step="5" value="'+Math.round(c.strength*100)+'"></label><label class="vfx-toggle vfx-motion"><input type="checkbox" data-vfx="reduceMotion" '+(c.reduceMotion?'checked':'')+'><span>Reduce effect motion<small>Stops weather, mist, water glints, grain, and distortion.</small></span></label>'+['Light','Air and weather','Surfaces','Image'].map(group=>'<fieldset class="vfx-group"><legend>'+group+'</legend>'+EFFECTS.filter(e=>e.group===group).map(e=>'<label class="vfx-effect"><span><strong>'+e.name+'</strong><small>'+e.detail+'</small></span><input type="checkbox" data-vfx-effect="'+e.id+'" '+(c.effects[e.id]?'checked':'')+(e.motion&&c.reduceMotion?' disabled':'')+'></label>').join('')+'</fieldset>').join('')+'<div class="vfx-foot"><p data-vfx-stats></p><p>Settings save on this device. Quality changes only the effects. Menus stay clear.</p><div><button type="button" data-vfx-action="retry">Retry graphics</button><button type="button" data-vfx-action="reset">Reset effects</button></div></div></div>';
 const update=s=>{const status=host.querySelector('[data-vfx-status]');if(!status)return;status.textContent=s.compareBase?'Base image comparison':s.state==='loading'?'Starting effects…':s.state==='ready'?(s.backend==='webgpu'?'WebGPU · compute effects':'WebGL2 · shader effects'):s.state==='off'?'Effects off · base image':'Base image · effects unavailable';host.querySelector('[data-vfx-note]').textContent=s.storageError?'These settings could not save on this device.':s.message;const stats=s.stats;host.querySelector('[data-vfx-stats]').textContent=s.state==='ready'?(stats.width||controller.canvas?.width||0)+' × '+(stats.height||controller.canvas?.height||0)+' · '+(s.backend==='webgpu'?(stats.computePasses||0)+' compute passes':'Fragment and particle passes')+' · '+s.cpuSubmitMs.toFixed(1)+' ms CPU submit':'';};
 const unsubscribe=controller.subscribe(update);
 const onChange=e=>{const el=e.target;if(el.dataset.vfxEffect){controller.configure({effects:{[el.dataset.vfxEffect]:el.checked}});host.querySelector('[data-vfx="preset"]').value='custom';host.querySelector('.vfx-preset-note').textContent='Your own mix of effects.';return;}const k=el.dataset.vfx;if(!k||k==='strength')return;if(k==='preset'){controller.preset(el.value);mountPanel(host,controller);return;}controller.configure({[k]:['enabled','reduceMotion'].includes(k)?el.checked:el.value});if(k==='reduceMotion')for(const effect of EFFECTS){const input=host.querySelector('[data-vfx-effect="'+effect.id+'"]');if(input&&effect.motion)input.disabled=el.checked;}};
 const onInput=e=>{if(e.target.dataset.vfx==='strength'){const n=Number(e.target.value);controller.configure({strength:n/100});host.querySelector('[data-vfx-strength]').textContent=n+'%';}};
 const onClick=e=>{const action=e.target.closest('[data-vfx-action]')?.dataset.vfxAction;if(!action)return;if(action==='compare'){controller.compare(!controller.compareBase);const b=host.querySelector('[data-vfx-action="compare"]');b.textContent=controller.compareBase?'Show effects':'Show base image';b.setAttribute('aria-pressed',String(controller.compareBase));}else if(action==='retry')controller.retry();else if(action==='reset'){controller.reset();mountPanel(host,controller);}};
 host.addEventListener('change',onChange);host.addEventListener('input',onInput);host.addEventListener('click',onClick);mounted.set(host,()=>{unsubscribe();host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.removeEventListener('click',onClick);});
}
function unmountPanel(host){mounted.get(host)?.();mounted.delete(host);}
function openPanel(controller,{onClose=()=>{}}={}){
 const dialog=document.createElement('dialog');dialog.className='nacre-vfx-dialog';dialog.setAttribute('aria-labelledby','nacre-vfx-title');dialog.innerHTML='<header><div><p>THE FREE CITY</p><h2 id="nacre-vfx-title">Visual effects</h2></div><button type="button" aria-label="Close visual effects">Close</button></header><div class="nacre-vfx-body"></div>';document.body.appendChild(dialog);const body=dialog.querySelector('.nacre-vfx-body');mountPanel(body,controller);const close=()=>{unmountPanel(body);controller.compare(false);dialog.close();dialog.remove();onClose();};dialog.querySelector('header button').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();return dialog;
}
root.NacreVFX={VERSION,KEY,EFFECTS,PRESETS,defaults,normalise,Controller,project,citySampler,attachExplorer,mountPanel,unmountPanel,openPanel};
})(typeof window!=='undefined'?window:globalThis);
