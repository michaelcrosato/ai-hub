/* Animated crowd drawing from the existing character rigs and CMU motions.
 * Close residents use live rigs. Far residents reuse small, bounded canvases. */
(function(root){
'use strict';
const E=root.My3D2dge;
class Painter{
 constructor({maxPixels=6000000,maxEntries=224}={}){this.maxPixels=maxPixels;this.maxEntries=maxEntries;this.cache=new Map();this.pixels=0;this.key='';this.live=0;this.cached=0;this.baked=0;}
 clear(){this.cache.clear();this.pixels=0;}
 begin(view){const key=[view.yawDeg,view.pitchDeg,view.scale,view.zBoost].join(':');if(key!==this.key){this.clear();this.key=key;}this.live=this.cached=this.baked=0;}
 draw(r,a,state,dt,{live=false,clock=0,bias=0}={}){
  if(live){this.live++;if(a._crowdCached)a.rig.motionController?.seek(a.rig.motionName,a.rig.motionTime);a.rig.update(dt,state);a._crowdClock=clock;a._crowdCached=false;r.actor(a.x,a.y,a.z,(g,x,y)=>a.rig.draw(g,x,y,r.view),{outline:false,rim:false,bias});return;}
  this.cached++;let sprite=this.cache.get(a.id);
  const tick=Math.floor(clock*10+(a.seed%17)/17),motion=state.motion||((Math.hypot(a.vx,a.vy)>1)?'SlowWalk':'Still');
  if(!sprite||!a._crowdCached||sprite.tick!==tick||sprite.motion!==motion){
   const side=Math.ceil(Math.max(96,128*r.view.scale)),ax=Math.floor(side/2),ay=Math.floor(side*.76);
   if(!sprite){sprite={canvas:E.mkCanvas(side,side),ax,ay,pixels:side*side};sprite.g=E.ctx2d(sprite.canvas);this.pixels+=sprite.pixels;}
   const controller=a.rig.motionController,clip=controller?.lib?.clip(motion),moving=Math.hypot(a.vx,a.vy)>1;
   const elapsed=Math.max(0,Math.min(.25,clock-(a._crowdClock??clock)));
   const previous=clip?(a.rig.motionName===motion?a.rig.motionTime:(a.seed%997)/997*clip.dur):0;
   const motionTime=clip?(previous+elapsed*(moving?Math.hypot(a.vx,a.vy)/(controller?.nativeSpeed||25):1))%clip.dur:undefined;
   if(controller)controller.lastPosition=null;
   a.rig.update(dt===0?0:.05,{...state,motion,motionTime});
   sprite.g.clearRect(0,0,side,side);sprite.g._c=null;a.rig.draw(sprite.g,ax,ay,r.view);
   sprite.tick=tick;sprite.motion=motion;a._crowdClock=clock;a._crowdCached=true;this.baked++;
  }
  this.cache.delete(a.id);this.cache.set(a.id,sprite);
  while(this.pixels>this.maxPixels||this.cache.size>this.maxEntries){const id=this.cache.keys().next().value;this.pixels-=this.cache.get(id).pixels;this.cache.delete(id);}
  r.actor(a.x,a.y,a.z,(g,x,y)=>{g.drawImage(sprite.canvas,Math.round(x)-sprite.ax,Math.round(y)-sprite.ay);g._c=null;},{outline:false,rim:false,bias});
 }
 stats(){return{liveRigs:this.live,cachedActors:this.cached,bakes:this.baked,entries:this.cache.size,pixels:this.pixels,maxPixels:this.maxPixels};}
}
root.NacreCityCrowd={Painter};
})(typeof window!=='undefined'?window:globalThis);
