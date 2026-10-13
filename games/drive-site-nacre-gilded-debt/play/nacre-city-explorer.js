/* Nacre city exploration. Metre data is converted once at the physics/render boundary.
 * The existing my-3d2dge Body, View, Parkour, character rig, and CMU adapter own play.
 */
(function(root){
'use strict';
const E=root.My3D2dge,U=root.NacreCity.unitsPerMetre,PACE=root.NacreCity.movement,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rectHas=(b,x,y,p=0)=>x>=b.x-p&&x<=b.x+b.w+p&&y>=b.y-p&&y<=b.y+b.d+p;
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const metre=b=>({x:b.x/U,y:b.y/U,z:b.z/U});
class EngineWorld{
 constructor(city){this.lifeBlockers=[];this.city=city;this.unitsPerMetre=U;this.memo=null;this.memoKey='';this.nearCache=new Map();this.width=city.bounds.w*U;this.height=city.bounds.d*U;}
 near(x,y,r=2){const mx=x/U,my=y/U,k=Math.floor(mx/8)+':'+Math.floor(my/8);if(k!==this.memoKey){this.memoKey=k;this.memo=this.nearCache.get(k);if(!this.memo){this.memo=this.city.query({x:Math.floor(mx/8)*8-6,y:Math.floor(my/8)*8-6,w:20,d:20});this.nearCache.set(k,this.memo);while(this.nearCache.size>192)this.nearCache.delete(this.nearCache.keys().next().value);}else{this.nearCache.delete(k);this.nearCache.set(k,this.memo);}}return this.memo;}
 buildingsAt(x,y,r=2){return this.near(x,y,r).buildings;}
 groundAt(x,y,r,z,step=2){let floor=0;for(const b of this.buildingsAt(x,y))if(rectHas(b,x/U,y/U)&&b.h*U<=z+step)floor=Math.max(floor,b.h*U);return floor;}
 roofAt(x,y,z=Infinity){let found=null;for(const b of this.buildingsAt(x,y))if(rectHas(b,x/U,y/U)&&b.h*U<=z+3&&(!found||b.h>found.h))found=b;return found;}
 heightAt(x,y){let h=0;for(const b of this.buildingsAt(x,y))if(rectHas(b,x/U,y/U))h=Math.max(h,b.h*U);return h;}
 collide(body){
  const B=this.city.bounds,r=body.r/U+.00002,loX=(B.x+r)*U,hiX=(B.x+B.w-r)*U,loY=(B.y+r)*U,hiY=(B.y+B.d-r)*U;
  let hit=false;const beforeX=body.x,beforeY=body.y;body.x=clamp(body.x,loX,hiX);body.y=clamp(body.y,loY,hiY);if(body.x!==beforeX||body.y!==beforeY)hit=true;
  for(const b of [...this.buildingsAt(body.x,body.y),...this.lifeBlockers]){
   if(body.z>=b.h*U-body.step-.1)continue;const x=body.x/U,y=body.y/U;if(!rectHas(b,x,y,r))continue;
   const nx=clamp(x,b.x,b.x+b.w),ny=clamp(y,b.y,b.y+b.d),dx=x-nx,dy=y-ny,d=Math.hypot(dx,dy);if(d>=r)continue;
   if(d>.00001){body.x+=(dx/d*(r-d))*U;body.y+=(dy/d*(r-d))*U;}else{const a=[x-b.x,b.x+b.w-x,y-b.y,b.y+b.d-y],i=a.indexOf(Math.min(...a));if(i===0)body.x=(b.x-r)*U;else if(i===1)body.x=(b.x+b.w+r)*U;else if(i===2)body.y=(b.y-r)*U;else body.y=(b.y+b.d+r)*U;}hit=true;
  }
  if(body.z<1&&!this.city.isWalkable(body.x/U,body.y/U,body.r/U,0)){
   if(Number.isFinite(body._safeX)){body.x=body._safeX;body.y=body._safeY;body.vx=body.vy=0;}hit=true;
  }
  return hit;
 }
 land(x,y){return this.city.isWalkable(x/U,y/U,.275,0)&&!this.lifeBlockers.some(b=>Math.hypot(x/U-clamp(x/U,b.x,b.x+b.w),y/U-clamp(y/U,b.y,b.y+b.d))<.275-1e-7);}
 nearClimb(body,facing){let best=null;for(const b of this.buildingsAt(body.x,body.y)){
  if(b.isLandmark||b.climb===false||b.climbable===false||b.h*U<body.z+10||b.h>30)continue;
  const x=clamp(body.x,(b.x+.45)*U,(b.x+b.w-.45)*U),y=clamp(body.y,(b.y+.45)*U,(b.y+b.d-.45)*U),d=Math.hypot(x-body.x,y-body.y);if(d>27)continue;
  const angle=Math.atan2(y-body.y,x-body.x);if(Math.abs(E.angDiff(facing,angle))>1.6)continue;if(!best||d<best.dist)best={building:b,x,y,z:b.h*U,dist:d,angle};
 }return best;}
 _liftOrder(view,x,y,z,k){const b=this.roofAt(x,y,z);if(!b)return k;const frontX=(view.fx>=0?b.x+b.w:b.x)*U,frontY=(view.fy>=0?b.y+b.d:b.y)*U;return Math.max(k,view.order(frontX,frontY,0)+.1+(z-b.h*U)*.001);}
 actorBias(view,body,buildings=this.buildingsAt(body.x,body.y)){let out=view.order(body.x,body.y,body.z);const base=out;for(const b of buildings){
  const x=b.x*U,y=b.y*U,w=b.w*U,d=b.d*U,fx=view.fx>=0?x+w:x,fy=view.fy>=0?y+d:y;
  if(body.x>=x-3&&body.x<=x+w+3&&Math.abs(body.y-fy)<40&&(body.y-fy)*view.fy>0||body.y>=y-3&&body.y<=y+d+3&&Math.abs(body.x-fx)<40&&(body.x-fx)*view.fx>0)out=Math.max(out,view.order(fx,fy,0)+.2);
 }return out-base;}
}
class Explorer{
 constructor(canvas,city,hooks={}){
  this.hooks=hooks;this.city=city;this.active=false;this.paused=false;this.loaded=false;this.worldClock=0;this.lastRender=0;this.uiClock=0;this.rosterClock=0;this.distanceM=0;this.movingTime=0;this.elapsed=0;this.started=false;this.auto=false;this.route=null;this.npcs=new Map();this.stepDistance=0;this.currentDistrict=null;this.queryKey='';
  this.game=new E.Game({canvas,view:new E.View('nacre-city','Nacre city',35,40,1.4,1),minW:580,minH:325,maxW:1920,maxH:1080,bg:'#829486',input:{up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],sprint:['ShiftLeft','ShiftRight','Pad6'],jump:['Space','Pad0'],crouch:['KeyC','Pad1'],pause:['Escape','Pad9'],map:['KeyM','Pad8']}});
  this.game.setZoom(.7);this.game.pauseOverlay=false;this.game.cam.smooth=.14;this.game.r.outline='#21373a';this.game.r.rim='#eed8ad';this.game.r.rimAlpha=.14;
  this.art=new E.NacreCityArt.Painter({metersToUnits:U,maxCachePixels:12000000,maxCacheEntries:160,profiles:city.districts.map(d=>d.profile)});
  this.world=new EngineWorld(city);this.player=new E.Body({x:0,y:0,z:0,r:5.5,gravity:450,step:5,onGround:true});this.player.facing=.7;this.player.crouch=false;this.player.rig=new E.NacreRig(E.NacreCharacters.options('player','mara','#314a5c'));E.NacreMotion.attach(this.player.rig,{role:'player',id:'mara'});this.parkour=new E.Parkour(this.player,this.world);
  this.setupLife();this.audio=new NacreAudio(this.game);const settings=E.store.get('nacre:settings:v1',{});this.audio.setVolume(settings.volume??.4);this.audio.setMuted(settings.muted??false);
  this.game.onError=(error,where)=>{if(this.hooks.onError)this.hooks.onError(where+': '+error.message);};
  this.vfx=typeof NacreVFX!=='undefined'?NacreVFX.attachExplorer(this):null;
  this.game.start({update:dt=>this.update(dt),draw:r=>this.draw(r)});
  addEventListener('blur',()=>{if(this.active&&!this.paused)this.pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active)this.pause(true);});
 }
 setCity(city){this.city=city;this.world=new EngineWorld(city);this.parkour=new E.Parkour(this.player,this.world);this.art.setProfiles(city.districts.map(d=>d.profile));this.art.clear();this.npcs.clear();this.queryKey='';this.loaded=false;this.currentDistrict=null;this.route=null;this.setupLife();}
 enter(district,route){this.active=true;this.paused=false;this.game.input.clear();if(district||!this.loaded||route){const start=route?route.points[0]:(district||this.city.districts[4]).arrival;this.place(start);this.route=route?{...route,points:route.points.map(p=>({...p})),index:1,complete:false,progress:0}:null;this.resetDistance();}this.loaded=true;this.game.screen.resize();this.game.cam.snap=true;this.game.focus(this.player.x,this.player.y,this.player.z+20);this.audio.start();this.notifyState();}
 place(point){const p=this.player;Object.assign(p,{x:point.x*U,y:point.y*U,z:(point.z||0)*U,vx:0,vy:0,vz:0,onGround:true,groundZ:0,crouch:false,_safeX:point.x*U,_safeY:point.y*U});this.parkour.cancel();this.auto=false;this.player.rig.motionController.reset();this.player.rig.update(1/60,this.rigState(p,0));this.queryKey='';this.npcs.clear();this.rosterClock=0;this.world.memoKey='';this.lifeProps=[];this.lifePlan=null;this.world.lifeBlockers=[];this.lastNpcClock=this.worldClock;this.lifeEntryClearance=(point.z||0)<.1?{x:point.x,y:point.y,r:.75}:null;}
 leave(){this.active=false;this.auto=false;this.paused=false;this.player.vx=this.player.vy=0;this.game.input.clear();this.audio.update(0,{mode:'paused',danger:0});}
 pause(value){this.paused=!!value;this.game.input.clear();this.audio.update(0,{mode:value?'paused':'play',danger:0});if(this.hooks.onPause)this.hooks.onPause(this.paused);this.notifyState();}
 resetDistance(){this.distanceM=0;this.movingTime=0;this.elapsed=0;this.started=false;this.auto=false;if(this.route){this.route.complete=false;this.route.index=1;this.route.progress=0;}this.notifyState();}
 zoom(factor){this.game.setZoom(clamp(this.game.zoom*factor,.5,1.5));this.art.clear();this.queryKey='';this.notifyState();}
 toggleSound(){this.audio.setMuted(!this.audio.muted);const settings=E.store.get('nacre:settings:v1',{});E.store.set('nacre:settings:v1',{...settings,muted:this.audio.muted});this.notifyState();}
 toggleAuto(){if(!this.route||this.route.complete)return;this.auto=!this.auto;this.player.crouch=false;if(this.auto){this.started=true;this.route.index=this.routeIndex();}this.game.input.clear();this.notifyState();return this.auto;}
 routeIndex(){if(!this.route)return 1;const p=metre(this.player);let best=Infinity,index=1;for(let i=1;i<this.route.points.length;i++){const a=this.route.points[i-1],b=this.route.points[i],vx=b.x-a.x,vy=b.y-a.y,t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy||1),0,1),d=Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t);if(d<best){best=d;index=i;}}return index;}
 update(dt){
  if(!this.active)return;const inp=this.game.input;if(inp.pressed('map')){if(this.hooks.onAtlas)this.hooks.onAtlas();return;}if(inp.pressed('pause')){this.pause(!this.paused);return;}if(this.paused)return;
  this.worldClock+=dt;this.uiClock-=dt;this.rosterClock-=dt;const p=this.player,oldX=p.x,oldY=p.y;let [ax,ay]=inp.move();let [dx,dy]=this.game.view.screenDirToGround(ax,ay);const manual=Math.hypot(dx,dy)>.05;
  if(manual&&this.auto){this.auto=false;if(this.hooks.onNotice)this.hooks.onNotice('Route following stopped. You have control.');}
  if(inp.pressed('crouch')){p.crouch=!p.crouch;this.auto=false;}
  if(inp.pressed('jump')&&!this.parkour.state){this.auto=false;const climb=this.world.nearClimb(p,p.facing);if(climb){this.parkour.climb(climb);p.facing=climb.angle;p.crouch=false;this.audio.event('climb');}else if(p.onGround){p.jump(185);this.audio.event('jump');}}
  let speed=p.crouch?PACE.crouchUnitsPerSecond:inp.down('sprint')?PACE.sprintUnitsPerSecond:PACE.walkUnitsPerSecond;
  if(this.auto&&this.route){const t=this.route.points[this.route.index];if(t){const tx=t.x*U-p.x,ty=t.y*U-p.y,l=Math.hypot(tx,ty);if(l<.000001*U&&this.route.index<this.route.points.length-1){this.route.index++;}const target=this.route.points[this.route.index],vx=target.x*U-p.x,vy=target.y*U-p.y,len=Math.hypot(vx,vy);dx=len?vx/len:0;dy=len?vy/len:0;speed=Math.min(PACE.walkUnitsPerSecond,len/dt);}else this.auto=false;}
  if(this.parkour.state)this.parkour.update(dt);else{
   if(this.auto){p.vx=dx*speed;p.vy=dy*speed;}else{p.vx=E.approach(p.vx,dx*speed,dt*680);p.vy=E.approach(p.vy,dy*speed,dt*680);}
   if(Math.hypot(dx,dy)>.05)p.facing=E.approachAng(p.facing,Math.atan2(dy,dx),dt*12);
   if(p.onGround&&p.z<1&&this.world.land(p.x,p.y)){p._safeX=p.x;p._safeY=p.y;}
   p.update(dt,this.world);if(p.landed){this.audio.event('land');p.rig.kick(-1.5);}
   if(p.z<1&&!this.world.land(p.x,p.y)){p.x=p._safeX;p.y=p._safeY;p.vx=p.vy=p.vz=0;p.onGround=true;}
  }
  const moved=Math.hypot(p.x-oldX,p.y-oldY)/U;this.instantSpeed=moved/dt;
  if(moved>.00001){this.started=true;this.distanceM+=moved;this.movingTime+=dt;this.stepDistance+=moved;if(p.onGround&&this.stepDistance>.75){this.stepDistance=0;this.audio.event('step');}}
  if(this.started&&(!this.route||!this.route.complete))this.elapsed+=dt;
  this.updateRoute();this.game.focus(p.x,p.y,p.z+20);const district=this.city.districtAt(p.x/U,p.y/U);if(district?.id!==this.currentDistrict?.id){this.currentDistrict=district;if(this.hooks.onDistrict)this.hooks.onDistrict(district);}
  if(this.rosterClock<=0){this.rosterClock=.8;this.updateRoster();}this.moveNpcs();
  if(this.uiClock<=0){this.uiClock=.12;this.notifyState();}
 }
 updateRoute(){const route=this.route;if(!route||route.complete)return;const p=metre(this.player);let walked=0,bestDist=Infinity,along=0;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy),t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/(len*len||1),0,1),d=Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t);if(d<bestDist){bestDist=d;along=walked+t*len;}walked+=len;}route.progress=clamp(along,0,route.lengthM);const end=route.points.at(-1);const tolerance=this.auto?.000001:.03;if(this.started&&route.progress>route.lengthM-tolerance&&Math.hypot(p.x-end.x,p.y-end.y)<tolerance){route.complete=true;this.auto=false;this.player.vx=this.player.vy=0;if(this.hooks.onNotice)this.hooks.onNotice('Route complete. The distance and time below are measured in play.');this.notifyState();}}
 setupLife(){
  this.life=root.NacreCityLife?root.NacreCityLife.create({maxChunks:64}):null;
  this.lifeArt=root.NacreCityLifeArt?new root.NacreCityLifeArt.Painter({profiles:this.city.districts.map(d=>d.profile)}):null;
  this.crowdArt=root.NacreCityCrowd?new root.NacreCityCrowd.Painter():null;
  this.streetArt=root.NacreCityStreets?new root.NacreCityStreets.Painter({profiles:this.city.districts.map(d=>d.profile)}):null;
  this.lifeProps=[];this.lifePlan=null;this.lastNpcClock=this.worldClock;
 }
 updateLifeRoster(){
  const started=performance.now(),p=metre(this.player),exclusions=(this.targets||[]).map(t=>({x:t.x,y:t.y,r:2.8}));
  if(this.lifeEntryClearance)exclusions.unshift(this.lifeEntryClearance);
  if(this.jobs)for(const job of this.jobs.activeJobs())for(const stage of job.stages)exclusions.push({x:stage.target.x,y:stage.target.y,r:2.8});
  const plan=this.life.plan(this.city,p,Math.min(90,60*.7/this.game.zoom),this.worldClock,{maxActors:192,maxProps:128,exclusions:exclusions.slice(0,128)}),next=new Map();
  for(const descriptor of plan.actors){let actor=this.npcs.get(descriptor.id);
   if(!actor){const rig=new E.NacreRig(E.NacreCharacters.options(descriptor.role,descriptor.id));E.NacreMotion.attach(rig,{role:descriptor.role,id:descriptor.id,variant:rig.o.nacreProfile});actor={id:descriptor.id,role:descriptor.role,rig,seed:descriptor.seed,onGround:true,offsetX:0,offsetY:0,x:descriptor.x*U,y:descriptor.y*U,z:0,vx:descriptor.vx*U,vy:descriptor.vy*U,facing:descriptor.facing,motion:descriptor.motion};}
   actor.plan=descriptor;actor.activity=descriptor.activity;next.set(actor.id,actor);
  }
  this.npcs=next;this.lifePlan=plan;this.lifeProps=plan.props;
  this.world.lifeBlockers=plan.props.filter(p=>!p.walkThrough&&!['streetwear','clothline','hanging-sign'].includes(p.kind)).map(p=>({...((root.NacreCityLifeArt?.bounds(p))||p),climb:false,climbable:false}));
  this.lifePlannerMs=+(performance.now()-started).toFixed(2);
 }
 moveLifeNpcs(){
  const dt=Math.min(.05,Math.max(0,this.worldClock-this.lastNpcClock));this.lastNpcClock=this.worldClock;
  const p=metre(this.player),danger=!!this.player.attack?.busy||this.heat>60;
  for(const n of this.npcs.values()){
   const a=this.life.sample(n.plan,this.worldClock),dx=a.x-p.x,dy=a.y-p.y,d=Math.hypot(dx,dy);let ox=0,oy=0;
   if(p.z<1&&d<(danger?2.8:1.15)){const distance=d||1,amount=danger?1.4:1.15-d;ox=dx/distance*amount;oy=dy/distance*amount;if(!this.city.isWalkable(a.x+ox,a.y+oy,.32,0)||this.world.lifeBlockers.some(b=>rectHas(b,a.x+ox,a.y+oy,.35)))ox=oy=0;}
   n.offsetX=E.approach(n.offsetX,ox,dt*2.2);n.offsetY=E.approach(n.offsetY,oy,dt*2.2);
   const previousX=n.x,previousY=n.y;n.x=(a.x+n.offsetX)*U;n.y=(a.y+n.offsetY)*U;n.z=0;
   n.vx=Number.isFinite(previousX)&&dt?(n.x-previousX)/dt:a.vx*U;n.vy=Number.isFinite(previousY)&&dt?(n.y-previousY)/dt:a.vy*U;n.facing=a.facing;
   n.motion=Math.hypot(n.vx,n.vy)>2?'SlowWalk':a.motion;
   if(danger&&d<3.2){n.motion=Math.hypot(n.vx,n.vy)>6?'Run':'Look';n.facing=Math.atan2(dy,dx);}
  }
 }
 updateRoster(){if(this.life)return this.updateLifeRoster();const p=metre(this.player),data=this.city.query({x:p.x-55,y:p.y-55,w:110,d:110}),next=new Set();let count=0;for(const road of data.roads){if(count>=16)break;if(!road.points||road.points.length<2)continue;const a=road.points[0],b=road.points.at(-1),len=Math.hypot(b.x-a.x,b.y-a.y);if(len<8)continue;const id='city-'+road.id,h=hash(id);if(h%3===0)continue;next.add(id);count++;if(!this.npcs.has(id)){const role=h%7===0?'guard':'civilian',rig=new E.NacreRig(E.NacreCharacters.options(role,id));E.NacreMotion.attach(rig,{role,id,variant:rig.o.nacreProfile});this.npcs.set(id,{id,role,rig,road,a,b,len,seed:h,speed:role==='guard'?1.35:.72+(h%30)/50,wait:3+h%4,x:a.x*U,y:a.y*U,z:0,vx:0,vy:0,facing:0,onGround:true});}}for(const id of this.npcs.keys())if(!next.has(id))this.npcs.delete(id);}
 moveNpcs(){if(this.life)return this.moveLifeNpcs();for(const n of this.npcs.values()){const duration=n.len/n.speed,phase=(this.worldClock+n.seed%1000)%(duration*2+n.wait*2);let t,dir,moving;if(phase<duration){t=phase/duration;dir=1;moving=true;}else if(phase<duration+n.wait){t=1;dir=1;moving=false;}else if(phase<duration*2+n.wait){t=1-(phase-duration-n.wait)/duration;dir=-1;moving=true;}else{t=0;dir=-1;moving=false;}const vx=(n.b.x-n.a.x)/n.len,vy=(n.b.y-n.a.y)/n.len,offset=n.seed%2?.65:-.65;n.x=(n.a.x+(n.b.x-n.a.x)*t-vy*offset)*U;n.y=(n.a.y+(n.b.y-n.a.y)*t+vx*offset)*U;n.vx=moving?vx*n.speed*U*dir:0;n.vy=moving?vy*n.speed*U*dir:0;n.facing=Math.atan2(vy*dir,vx*dir);}}
 rigState(a,dt){const player=a===this.player,st=player?this.parkour.state:null;return {mode:this.active&&!this.paused?'play':'paused',role:player?'player':a.role,x:a.x,y:a.y,z:a.z,vx:a.vx,vy:a.vy,vz:a.vz||0,facing:a.facing,air:!a.onGround,climb:!!st,mantle:st?clamp((st.t/st.dur-.65)/.35,0,1):0,vault:!a.onGround&&!st?.7:0,crouch:player&&a.crouch,pose:player&&a.crouch?'crouch':null,dead:false,alert:false,motion:player?undefined:a.motion,motionMask:!player&&['Conversation','Drink'].includes(a.motion)?'upper':null};}
 viewBounds(r){const P=[];for(const x of[-110,r.W+110])for(const y of[-100,r.H+100])for(const z of[0,56*U]){const p=r.view.toGround(x+r.ix,y+r.iy-r.view.bz*z);if(p)P.push(p);}const xs=P.map(p=>p[0]/U),ys=P.map(p=>p[1]/U),x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(...xs)-x,d:Math.max(...ys)-y};}
 cameraBuildings(data,view,dt){
  // A ray from the play area toward the camera identifies foreground walls.
  // Fade their art only; collision, roofs, and climb targets keep full height.
  const p=metre(this.player),ray=[view.dx,view.dy,view.dz/view.zBoost],next=new Map(),old=this.wallOpacity||new Map();
  const hits=(b,x,y)=>{let lo=0,hi=Infinity;for(const[o,d,a,z]of[[x,ray[0],b.x,b.x+b.w],[y,ray[1],b.y,b.y+b.d],[p.z+1,ray[2],0,b.h]]){if(Math.abs(d)<1e-9){if(o<a||o>z)return false;continue;}let t0=(a-o)/d,t1=(z-o)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;}return hi>0&&lo<100;};
  const shown=data.buildings.map(b=>{const covered=p.z+1<b.h&&[[0,0],[-3,-3],[3,-3],[-3,3],[3,3]].some(([x,y])=>hits(b,p.x+x,p.y+y));const target=covered?.14:1,previous=old.get(b.id)??target,alpha=E.approach(previous,target,dt*5);next.set(b.id,alpha);return alpha<.999?{...b,renderOpacity:alpha}:b;});
  this.wallOpacity=next;this.fadedBuildings=shown.filter(b=>b.renderOpacity<.95).length;return shown;
 }
 draw(r){
  const dt=Math.min(.05,Math.max(0,this.game.real-this.lastRender));this.lastRender=this.game.real;if(!this.active){r.sky(['#10272e']);return;}const motionDt=this.paused?0:dt;this.audio.update(motionDt,{mode:this.paused?'paused':'play',danger:0});
  const b=this.viewBounds(r),key=[Math.floor(b.x/10),Math.floor(b.y/10),Math.ceil(b.w/10),Math.ceil(b.d/10)].join(':');if(key!==this.queryKey){this.queryKey=key;this.drawData=this.city.query({x:Math.floor(b.x/10)*10-10,y:Math.floor(b.y/10)*10-10,w:Math.ceil(b.w/10)*10+30,d:Math.ceil(b.d/10)*10+30});}
  const data=this.drawData;this.art.setBounds(b);r.sky(['#35565b','#3b6263']);this.art.ground(r,{...b,kind:'perimeter',color:'#8c9988'});
  for(const d of this.city.districts){const x=Math.max(b.x,d.bounds.x),y=Math.max(b.y,d.bounds.y),x1=Math.min(b.x+b.w,d.bounds.x+d.bounds.w),y1=Math.min(b.y+b.d,d.bounds.y+d.bounds.d);if(x1>x&&y1>y)this.art.ground(r,{x,y,w:x1-x,d:y1-y,districtId:d.id,kind:'district'});}
  for(const patch of data.water)this.art.water(r,patch);for(const patch of data.plazas)this.art.ground(r,{...patch,kind:patch.kind||'plaza'});for(const road of data.roads)if(!this.streetArt||road.bridge||(road.bridgeSpans||[]).length)this.art.road(r,road);this.streetArt?.ground(r,data,this.worldClock,{bounds:b});this.drawRoute(r,b);
  r._map=this.world;const shownBuildings=this.cameraBuildings(data,r.view,motionDt);this.streetArt?.boundaries(r,shownBuildings,this.worldClock);for(const building of shownBuildings){this.art.building(r,building);this.lifeArt?.frontage(r,building,this.worldClock);}for(const landmark of data.landmarks)if(!data.buildings.some(x=>x.id===landmark.id))this.art.landmark(r,landmark);for(const prop of data.props)this.art.prop(r,prop);for(const prop of this.lifeProps||[])this.lifeArt?.prop(r,prop,this.worldClock);
  this.crowdArt?.begin(r.view);let liveCount=0;this.visibleResidents=0;for(const a of [...this.npcs.values(),this.player]){const player=a===this.player;if(!r.visible(a.x,a.y,a.z,65,65,70))continue;const state=this.rigState(a,motionDt),bias=this.world.actorBias(r.view,a,data.buildings);r.shadow(a.x,a.y,player?7:6,.28,'#213e42',a.z);if(!player){this.visibleResidents++;if(this.crowdArt){this.crowdArt.draw(r,a,state,motionDt,{live:liveCount++<12&&Math.hypot(a.x-this.player.x,a.y-this.player.y)<18*U,clock:this.worldClock,bias});continue;}}a.rig.update(motionDt,state);r.actor(a.x,a.y,a.z,(g,ox,oy)=>a.rig.draw(g,ox,oy,r.view),{outline:player,rim:player,bias,xray:player?{color:'#e7cd8b',outline:'#fff0bc',actors:true}:false});}
  const step=5,px=this.player.x/U,py=this.player.y/U,x0=Math.floor(px/step)*step,y0=Math.floor(py/step)*step;r.overlay(g=>{const A=r.w((x0-2.5)*U,(y0+3.5)*U,this.player.z+.2),B=r.w((x0+2.5)*U,(y0+3.5)*U,this.player.z+.2);if(!this.route&&this.showScaleRuler!==false){E.px.line(g,...A,...B,'#d7c18e');E.font.text(g,'5 M',B[0]+4,B[1]-2,'#e6d4a5',{font:'tiny',outline:'#2d4443'});}});
 }
 drawRoute(r,bounds){const route=this.route;if(!route)return;const g=r.ctx;g.save();g.lineWidth=2;g.strokeStyle='#e7c57e';g.setLineDash([6,5]);g.globalAlpha=.8;g.beginPath();for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(Math.max(a.x,b.x)<bounds.x||Math.min(a.x,b.x)>bounds.x+bounds.w||Math.max(a.y,b.y)<bounds.y||Math.min(a.y,b.y)>bounds.y+bounds.d)continue;const A=r.w(a.x*U,a.y*U,.3),B=r.w(b.x*U,b.y*U,.3);g.moveTo(...A);g.lineTo(...B);}g.stroke();g.restore();g._c=null;
  const marks=route.marks||[route.points[0],route.points.at(-1)];for(let i=0;i<marks.length;i++){const mark=marks[i];if(!rectHas(bounds,mark.x,mark.y,3))continue;const [x,y]=r.w(mark.x*U,mark.y*U,.5);E.px.poly(g,[[x,y-4],[x+4,y],[x,y+4],[x-4,y]],'#edcf8c');E.font.text(g,(mark.distanceM??mark.distance??(i===0?0:route.lengthM))+' M',x+8,y-7,'#fae5b4',{font:'tiny',outline:'#354942'});}}
 notifyState(){if(this.hooks.onState)this.hooks.onState(this.state());}
 state(){const p=this.player,speed=this.paused?0:(this.instantSpeed||0),route=this.route;return {active:this.active,paused:this.paused,position:metre(p),enginePosition:{x:p.x,y:p.y,z:p.z},speedMps:speed,distanceM:this.distanceM,movingTime:this.movingTime,elapsed:this.elapsed,started:this.started,auto:this.auto,stance:this.parkour.state?'CLIMB':!p.onGround?'AIRBORNE':p.crouch?'CROUCH':speed>4?'SPRINT':'WALK',districtId:this.currentDistrict?.id,canClimb:!!this.world.nearClimb(p,p.facing),animation:p.rig.motionName,route:route?{lengthM:route.lengthM,progress:route.progress,complete:route.complete,calibration:!!route.calibration}:null,actors:this.npcs.size+1,cityLayout:this.city.spec.layout||'legacy',life:this.life?{...this.lifePlan?.stats,visibleResidents:this.visibleResidents||0,fadedBuildings:this.fadedBuildings||0,nearby25m:[...this.npcs.values()].filter(a=>Math.hypot(a.x-p.x,a.y-p.y)<25*U).length,props:this.lifeProps.length,plannerMs:this.lifePlannerMs||0,crowd:this.crowdArt?.stats(),art:this.lifeArt?.stats(),streets:this.streetArt?.stats?.()}:null,visibleBuildings:this.drawData?.buildings.length||0,art:this.art.stats(),cache:this.city.stats,fps:this.game.fps,frameStats:this.game.stats,zoom:this.game.zoom,muted:this.audio.muted,errors:this.game.errors};}
}
root.NacreCityExplorer={Explorer,EngineWorld,unitsPerMetre:U};
})(typeof window!=='undefined'?window:globalThis);
