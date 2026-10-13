/* Graphics drawer. Saved separately from city layout and player state. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),G=root.MeridianGraphics,KEY='static-veil-graphics-v1';
 const fields={backend:'driver',quality:'quality',cel:'cel',pixel:'pixel',pixelSize:'pixel-size',celBands:'bands',exposure:'exposure',bloom:'bloom',ao:'ao',shadows:'shadows',fog:'fog',wet:'wet',rain:'rain',embers:'embers',compute:'compute',motion:'motion'};
 let settings,renderer,game,onResize,open=false,wasPaused=false,lastStatus='',lastRefresh=0;
 function fill(){for(const [key,suffix]of Object.entries(fields)){const el=$('graphics-'+suffix);if(el.type==='checkbox')el.checked=settings[key];else el.value=String(settings[key]);}$('graphics-pixel-value').value=settings.pixelSize;$('graphics-bands-value').value=settings.celBands;$('graphics-exposure-value').value=Number(settings.exposure).toFixed(2);}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}renderer.configure(settings);onResize?.();}
 function close(){if(!open)return;open=false;$('graphics-panel').hidden=true;$('graphics-button').setAttribute('aria-expanded','false');$('play-stage').classList.remove('graphics-open');game.paused=wasPaused;$('city-screen').focus();}
 function bind(options){
  renderer=options.renderer;game=options.game;onResize=options.onResize;let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(_){}
  settings=G.normalize({...G.DEFAULTS,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,...stored});renderer.configure(settings);fill();onResize?.();
  for(const [key,suffix]of Object.entries(fields)){
   const el=$('graphics-'+suffix),event=el.type==='range'?'input':'change';el.addEventListener(event,()=>{settings=G.normalize({...settings,[key]:el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value});fill();save();refresh(true);});
  }
  $('graphics-button').addEventListener('click',()=>{if(open){close();return;}wasPaused=game.paused;game.paused=true;game.input.clear();open=true;$('graphics-panel').hidden=false;$('graphics-button').setAttribute('aria-expanded','true');$('play-stage').classList.add('graphics-open');refresh(true);$('graphics-close').focus();});
  $('graphics-close').addEventListener('click',close);
  $('graphics-reset').addEventListener('click',()=>{settings=G.normalize({...G.DEFAULTS,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches});fill();save();refresh(true);});
  document.addEventListener('keydown',event=>{if(open&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},true);
 }
 function refresh(force=false){
  if(!renderer)return;const now=performance.now();if(!force&&now-lastRefresh<300)return;lastRefresh=now;
  const backend=renderer.backend,status=renderer.status,key=backend+':'+status+':'+renderer.error+':'+renderer.stats.compute;
  $('city-screen').dataset.graphics=JSON.stringify({backend,status,revision:'181',settings,error:renderer.error||null,effects:renderer.stats.particles||null});
  if(!force&&key===lastStatus)return;lastStatus=key;
  const label=status==='starting'?'Starting display…':backend==='webgpu'?'WebGPU · Three.js r181':backend==='webgl2'?'WebGL2 · Three.js r181':'Compatibility display';
  $('graphics-backend').textContent=label;
  $('graphics-status').textContent=status==='starting'?'You can keep playing while the display starts.':backend==='software'?'This browser could not start WebGPU or WebGL2. A reduced-resolution display is active.':backend==='webgpu'?'WebGPU is active. Visual compute is optional.':'WebGL2 is active. Game rules and city scale are the same.';
  for(const key of ['ao','shadows','wet','rain','embers'])$('graphics-'+key).disabled=backend==='software';
  $('graphics-compute').disabled=backend!=='webgpu';
  $('graphics-compute-note').textContent=backend==='webgpu'?'Compute rain and embers use visual state only. Turn this off to use the smaller particle effect.':backend==='webgl2'?'WebGL2 uses shader-driven rain and embers. No WebGPU compute is dispatched.':'Particle, shadow, and wet-surface effects need WebGPU or WebGL2.';
 }
 root.MeridianGraphicsUI={bind,refresh,close,isOpen:()=>open,getSettings:()=>({...settings})};
})(window);
