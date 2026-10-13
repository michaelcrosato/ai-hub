/* Synchronous engine facade. Three.js starts asynchronously; gameplay never waits. */
(function(root){
 'use strict';
 const G=root.MeridianGraphics;
 class Renderer{
  constructor(options={}){
   this.settings=G.normalize(options.settings);this.camera=new root.MeridianCamera.Camera();
   this.fallback=new root.MeridianLegacyPerspective.Renderer({forceSoftware:true});this.fallback.camera=this.camera;
   this.filters=new G.CompatibilityFilters();this.gpu=null;this.backend='software';this.status='starting';this.error=null;this.stats={};this.generation=0;this.disposed=false;
   this.loader=options.loadModule||(()=>import('./vendor/meridian-three-r181.js'));
   this.ready=this._start();
  }
  _release(value){try{value?.dispose();}catch(error){this.cleanupError=String(error?.message||error);}}
  async _start(){
   const generation=++this.generation;this.status='starting';this.error=null;let candidate,candidateLoss=null;
   try{
    const module=await this.loader();if(this.disposed||generation!==this.generation)return false;
    candidate=new module.CityThreeRenderer({settings:this.settings,camera:this.camera,onLost:reason=>{
     if(this.disposed)return;
     // An old backend may deliver its loss callback after its replacement exists.
     if(this.gpu===candidate)this._lost(reason);
     else if(generation===this.generation)candidateLoss=reason||'Graphics device lost during initialization';
    }});
    await candidate.init();
    if(this.disposed||generation!==this.generation){this._release(candidate);return false;}
    if(candidateLoss)throw new Error(String(candidateLoss?.message||candidateLoss));
    candidate.configure(this.settings);if(candidateLoss)throw new Error(String(candidateLoss?.message||candidateLoss));const previous=this.gpu;this.gpu=candidate;this._release(previous);
    this.backend=candidate.backend;this.status='ready';return true;
   }catch(error){
    this._release(candidate);if(this.disposed||generation!==this.generation)return false;
    this.error=String(error?.message||error);this.status=this.gpu?'ready':'limited';this.backend=this.gpu?.backend||'software';return false;
   }
  }
  _lost(reason){
   if(this.disposed)return;
   this.error=String(reason?.message||reason||'Graphics device lost');const wasWebGPU=this.backend==='webgpu';
   const failed=this.gpu;this.gpu=null;this.backend='software';this.status='limited';this._release(failed);
   if(wasWebGPU){this.settings=G.normalize({...this.settings,backend:'webgl2'});this.ready=this._start();}
  }
  configure(value){
   if(this.disposed)return;
   const next=G.normalize({...this.settings,...value}),restart=next.backend!==this.settings.backend;this.settings=next;
   const generation=this.generation;
   try{this.gpu?.configure(next);}catch(error){this._lost(error);}
   if(restart&&generation===this.generation)this.ready=this._start();
  }
  setFilter(name,scope){if(name==='cel'||name==='pixel')this.configure({[name]:scope});}
  render(state,width,height){
   if(this.disposed)throw new Error('City renderer has been disposed.');
   this.camera.resize(width,height);
   if(this.gpu){
    try{const canvas=this.gpu.render(state,width,height);this.backend=this.gpu.backend;this.stats={...this.gpu.stats,status:this.status,revision:'181',filters:{cel:this.settings.cel,pixel:this.settings.pixel}};return canvas;}
    catch(error){this._lost(error);}
   }
   this.fallback.fogEnabled=this.settings.fog;
   const canvas=this.fallback.render(state,width,height);
   this.filters.apply(this.fallback.surface,this.settings);this.fallback.surface.present(this.fallback.ctx);
   this.stats={...this.fallback.stats,backend:'software',status:this.status,revision:'181',compute:false,filters:{cel:this.settings.cel,pixel:this.settings.pixel},limited:true};return canvas;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this._release(this.gpu);this.gpu=null;this._release(this.fallback);this.status='disposed';}
 }
 root.MeridianPerspective={Renderer};
})(window);
