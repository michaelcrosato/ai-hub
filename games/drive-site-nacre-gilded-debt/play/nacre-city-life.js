/* Nacre city life. Deterministic metre-space population and prop planning.
 * No engine, rendering, DOM, storage, network, timers, or city mutation.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NacreCityLife=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.1.0',CELL=80,BODY=.32,PATH_LIMIT=32,EPS=.000001;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),point=(x,y)=>({x,y,z:0});
const copy=v=>JSON.parse(JSON.stringify(v));
function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function number(n,a,b,label){if(!Number.isFinite(n)||n<a||n>b)throw new RangeError(label+' is outside its supported range');return n;}
function integer(n,a,b,label){number(n,a,b,label);if(!Number.isInteger(n))throw new TypeError(label+' must be an integer');return n;}
function validCity(c){if(!c||!Array.isArray(c.districts)||!c.bounds||!['query','route','isWalkable','districtAt'].every(k=>typeof c[k]==='function'))throw new TypeError('A Nacre city with walkability and routing is required');}
function rect(x,y,w,d){return{x,y,w,d};}
function grow(r,p){return rect(r.x-p,r.y-p,r.w+2*p,r.d+2*p);}
function inside(r,p){return p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.d;}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.d&&a.y+a.d>b.y;}
function circleRect(p,r,b){const x=clamp(p.x,b.x,b.x+b.w),y=clamp(p.y,b.y,b.y+b.d);return Math.hypot(p.x-x,p.y-y)<r+EPS;}
function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1),0,1);return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);}
function segmentRect(a,b,r){let lo=0,hi=1;for(const[p,d,min,max]of[[a.x,b.x-a.x,r.x,r.x+r.w],[a.y,b.y-a.y,r.y,r.y+r.d]]){if(Math.abs(d)<EPS){if(p<min||p>max)return false;continue;}let t0=(min-p)/d,t1=(max-p)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;}return true;}
function pathLength(path){return path.slice(1).reduce((n,p,i)=>n+distance(path[i],p),0);}
function atDistance(path,metres,dir){let rest=metres;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=distance(a,b);if(rest<=d||i===path.length-1){const t=d?clamp(rest/d,0,1):0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:0,facing:Math.atan2((b.y-a.y)*dir,(b.x-a.x)*dir),dx:d?(b.x-a.x)/d*dir:0,dy:d?(b.y-a.y)/d*dir:0};}rest-=d;}return{...path[0],facing:0,dx:0,dy:0};}
function sample(actor,clock=0){
 number(clock,0,1e12,'clock');if(!actor||!Array.isArray(actor.path)||!actor.path.length)throw new TypeError('A planned actor is required');
 if(actor.path.length<2||!(actor.speed>0))return{x:actor.anchor.x,y:actor.anchor.y,z:0,vx:0,vy:0,facing:actor.facing,moving:false,motion:actor.preferredMotion};
 const length=actor.pathLengthM,duration=length/actor.speed,wait=actor.wait||0,cycle=2*(duration+wait),t=(clock+actor.phase)%cycle;
 let along,dir,moving;if(t<duration){along=t*actor.speed;dir=1;moving=true;}else if(t<duration+wait){along=length;dir=1;moving=false;}else if(t<duration*2+wait){along=length-(t-duration-wait)*actor.speed;dir=-1;moving=true;}else{along=0;dir=-1;moving=false;}
 const p=atDistance(actor.path,along,dir);return{x:p.x,y:p.y,z:0,vx:moving?p.dx*actor.speed:0,vy:moving?p.dy*actor.speed:0,facing:p.facing,moving,motion:moving?'SlowWalk':'Wait'};
}
const DIMENSIONS=freeze({stall:{w:3.0,d:2.1,h:2.7},crate:{w:.85,d:.85,h:.7},barrels:{w:.78,d:.78,h:.95},baskets:{w:.7,d:.7,h:.5},bench:{w:2.4,d:.8,h:.75},planter:{w:1.1,d:1.1,h:1.4},lantern:{w:.55,d:.55,h:2.5},fountain:{w:3,d:3,h:1.7},'forum-stage':{w:4,d:2.8,h:1.6},noticeboard:{w:1.6,d:.7,h:2},'hanging-sign':{w:.75,d:.45,h:2.5},streetwear:{w:2.2,d:1.3,h:.015},handcart:{w:2.4,d:1.3,h:1.5},'water-pump':{w:1,d:1,h:1.8},workbench:{w:2.4,d:1.2,h:1.2},sacks:{w:1.2,d:1,h:.85},'laundry-rack':{w:2.4,d:1,h:2}});
class Planner{
 constructor(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['seed','maxChunks'].includes(k)))throw new TypeError('Unknown city life option');
  if(options.seed!==undefined&&typeof options.seed!=='string'&&!(typeof options.seed==='number'&&Number.isFinite(options.seed)))throw new TypeError('Life seed must be text or a finite number');
  this.seed=options.seed===undefined?'nacre-life-1':String(options.seed);if(!this.seed.trim()||this.seed.length>160)throw new TypeError('A short life seed is required');
  this.maxChunks=integer(options.maxChunks===undefined?64:options.maxChunks,8,256,'maxChunks');this.city=null;this.cache=new Map();this.hits=0;this.misses=0;this.routes=0;this.corridors=[];
 }
 clear(){this.cache.clear();this.hits=this.misses=this.routes=0;}
 cacheStats(){return{size:this.cache.size,limit:this.maxChunks,hits:this.hits,misses:this.misses,routeFallbacks:this.routes};}
 _city(city){validCity(city);if(this.city===city)return;this.city=city;this.clear();this.tag=hash(this.seed+'|'+(city.spec?.seed||'city')+'|'+(city.spec?.layout||'original')).toString(16);
  this.corridors=city.districts.map(d=>{const end=d.bounds.y+d.bounds.d/2+3.5;return rect(d.arrival.x-2.7,Math.min(d.arrival.y-2.5,end),5.4,Math.abs(end-(d.arrival.y-2.5)));});
 }
 _get(key,build){if(this.cache.has(key)){const v=this.cache.get(key);this.cache.delete(key);this.cache.set(key,v);this.hits++;return v;}const value=freeze(build());this.cache.set(key,value);this.misses++;while(this.cache.size>this.maxChunks)this.cache.delete(this.cache.keys().next().value);return value;}
 _context(box){
  const city=this.city,data=city.query(grow(box,PATH_LIMIT+5)),lifeProps=[],anchors=[];
  const existing=(data.props||[]).filter(p=>p.w>0&&p.d>0&&p.h>.4&&p.kind!=='wayfinding');
  const fixed=[...data.buildings,...existing],reserved=this.corridors.filter(r=>overlap(r,grow(box,PATH_LIMIT+5)));
  const blocked=p=>fixed.some(b=>circleRect(p,BODY,b))||lifeProps.some(b=>circleRect(p,BODY+.12,b))||reserved.some(b=>circleRect(p,BODY,b));
  const safe=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&!blocked(p)&&city.isWalkable(p.x,p.y,BODY,0);
  const clearRect=b=>!fixed.some(r=>overlap(grow(b,.2),r))&&!reserved.some(r=>overlap(grow(b,.25),r))&&!lifeProps.some(r=>overlap(grow(b,.4),r))&&
    [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.d],[b.x+b.w,b.y+b.d],[b.x+b.w/2,b.y+b.d/2]].every(([x,y])=>city.isWalkable(x,y,.25,0));
  const direct=(a,b)=>{
   if(!safe(a)||!safe(b))return false;
   if([...fixed,...lifeProps,...reserved].some(r=>segmentRect(a,b,grow(r,BODY+.05))))return false;
   if(anchors.some(p=>segmentDistance(p,a,b)<.7))return false;
   const count=Math.max(1,Math.ceil(distance(a,b)/.8));for(let i=1;i<count;i++){const t=i/count;if(!city.isWalkable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,BODY,0))return false;}return true;
  };
  const path=(a,b,allowRoute=false)=>{if(direct(a,b))return[a,b];if(!allowRoute||!safe(a)||!safe(b))return null;this.routes++;const route=city.route(a,b,{radius:BODY+.05});if(!route.ok||route.lengthM>PATH_LIMIT||route.points.length>10)return null;const p=route.points.map(q=>point(q.x,q.y));return p.slice(1).every((v,i)=>direct(p[i],v))?p:null;};
  return{data,lifeProps,anchors,safe,clearRect,path};
 }
 _actor(id,p,activity,groupId,context,extra={}){
  if(!context.safe(p)||context.anchors.some(a=>distance(a,p)<.7))return null;const seed=hash(id),r=random(seed),actor={id,seed,role:activity==='watch'?'guard':'civilian',activity,groupId,districtId:this.city.districtAt(p.x,p.y)?.id||'perimeter',anchor:point(p.x,p.y),path:[point(p.x,p.y)],pathLengthM:0,speed:0,phase:r()*60,wait:1.4+r()*2,facing:r()*Math.PI*2,preferredMotion:activity==='talk'||activity==='vendor'||activity==='browse'?'Conversation':'Wait',...extra};
  context.anchors.push(p);return actor;
 }
 _walker(id,path,groupId){const seed=hash(id),r=random(seed);return{id,seed,role:'civilian',activity:'walk',groupId,districtId:this.city.districtAt(path[0].x,path[0].y)?.id||'perimeter',anchor:path[0],path,pathLengthM:pathLength(path),speed:.85+r()*.55,phase:r()*120,wait:.6+r()*1.5,facing:0,preferredMotion:'SlowWalk'};}
 _prop(id,kind,cx,cy,context,extra={}){const size=DIMENSIONS[kind]||DIMENSIONS.crate,p={id,kind:kind==='crate'?'crates':kind,x:cx-size.w/2,y:cy-size.d/2,z:0,...size,districtId:this.city.districtAt(cx,cy)?.id||'perimeter',seed:hash(id),yaw:0,solid:false,...extra};if(!context.clearRect(p))return null;if(!p.walkThrough)context.lifeProps.push(p);return p;}
 _group(out,context,id,p,kind,busy=false){
  const r=random(hash(id)),specs=[],props=[],activity={id,kind,x:p.x,y:p.y,z:0,districtId:this.city.districtAt(p.x,p.y)?.id||'perimeter',actorIds:[],propIds:[]};
  const decorate=(suffix,propKind,x,y,extra)=>{const v=this._prop(id+':'+suffix,propKind,x,y,context,extra);if(v)props.push(v);};
  if(kind==='market'){
   const goods=['produce','textiles','fish'][hash(id+'goods')%3],stall=this._prop(id+':stall','stall',p.x,p.y,context,{kind:goods==='textiles'?'textile-stall':goods+'-stall',goods});if(!stall)return;
   props.push(stall);
   decorate('barrel','barrels',p.x+2.4,p.y+.55);decorate('basket','baskets',p.x-2.35,p.y+.55);decorate('lamp','lantern',p.x-2.35,p.y-1.65);decorate('sign','hanging-sign',p.x+2.4,p.y-1.65);
   for(const [i,dx,dy,activityName]of[[0,0,-1.8,'vendor'],[1,-.85,1.8,'browse'],[2,.85,1.8,'browse'],[3,2.3,2.05,'talk']])specs.push({id:id+':person:'+i,p:point(p.x+dx,p.y+dy),activity:activityName,groupId:id,extra:{facing:Math.atan2(-dy,-dx)}});
  }else{
   const count=kind==='social'?3:4,angle=r()*Math.PI*2;
   for(let i=0;i<count;i++){const a0=angle+i*Math.PI*2/count;specs.push({id:id+':person:'+i,p:point(p.x+Math.cos(a0)*1.05,p.y+Math.sin(a0)*1.05),activity:i===3?'wait':'talk',groupId:id,extra:{facing:a0+Math.PI}});}
   if(kind==='work'){decorate('goods','crate',p.x+2.6,p.y);decorate('basket','baskets',p.x+2.6,p.y+1.45);}else{decorate('bench','bench',p.x+2.85,p.y+.4);decorate('planter','planter',p.x+2.65,p.y-1.7);}
   if(hash(id)%3===0)decorate('lamp','lantern',p.x-2.55,p.y-1.9);
  }
  // Extra customers and companions belong to existing civic activities. The
  // frontage side and group shape vary; street groups keep their old count.
  if(busy){
   const additions=kind==='market'
    ?[[-1.9,2.7,'browse'],[0,3.05,'browse'],[1.05,-2.0,'vendor'],[1.7,3.05,'talk']]
    :kind==='work'
     ?[[-2.15,.55,'talk'],[-1.95,1.65,'talk'],[-.5,2.8,'wait'],[.6,2.7,'browse']]
     :[[-2.15,.45,'talk'],[-2.0,1.65,'talk'],[-.65,2.85,'talk'],[.65,2.8,'wait']];
   const count=2+(hash(id+':busy')%3===0?1:0);
   for(let i=0;i<count;i++){const[dx,dy,activityName]=additions[i],jitter=(r()-.5)*.18;specs.push({id:id+':guest:'+i,p:point(p.x+dx+jitter,p.y+dy),activity:activityName,groupId:id,extra:{facing:Math.atan2(-dy,-dx)}});}
  }
  decorate('wear','streetwear',p.x-.4,p.y+2.7,{walkThrough:true});
  out.pending.push(...specs);out.props.push(...props);activity.propIds=props.map(p=>p.id);out.activities.push(activity);
 }
 _finishActors(out,context){for(const s of out.pending){const a=this._actor(s.id,s.p,s.activity,s.groupId,context,s.extra);if(a)out.actors.push(a);}for(const a of out.activities)a.actorIds=out.actors.filter(p=>p.groupId===a.id).map(p=>p.id);delete out.pending;}
 _civic(district){
  const data=this.city.query(rect(district.arrival.x-115,district.arrival.y-115,230,230)),plaza=data.plazas.find(p=>p.id==='plaza:'+district.id)||data.plazas.find(p=>inside(p,district.arrival));
  if(!plaza)return{actors:[],props:[],activities:[]};
  const out={actors:[],props:[],activities:[],pending:[]},context=this._context(plaza),prefix='life:'+this.tag+':civic:'+district.id;
  for(const[kind,dx,dy]of[['fountain',8,12],['forum-stage',-9,12],['noticeboard',8,3]]){const p=this._prop(prefix+':feature:'+kind,kind,district.arrival.x+dx,district.arrival.y+dy,context);if(p)out.props.push(p);}
  // Seven-metre cells put small groups in the visible forecourt rather than
  // using the whole kilometre district as the population budget.
  for(let y=plaza.y+4,row=0;y<=plaza.y+plaza.d-4;y+=7,row++)for(let x=plaza.x+4,col=0;x<=plaza.x+plaza.w-4;x+=7,col++){
   const id=prefix+':'+col+':'+row,r=random(hash(id)),p=point(x+(r()-.5)*.35,y+(r()-.5)*.35);if(!context.safe(p))continue;
   const kind=(col+row)%3===0?'market':(col+row)%5===0?'work':'social';this._group(out,context,id,p,kind,distance(p,district.arrival)<32);
  }
  // All fixtures precede anchored people, and all people precede short paths.
  this._finishActors(out,context);
  // Dedicated short walkers use the remaining lanes between activity cells.
  for(let y=plaza.y+7.5,row=0;y<plaza.y+plaza.d-5;y+=7,row++)for(let x=plaza.x+5,col=0;x<plaza.x+plaza.w-10;x+=14,col++){
   const id=prefix+':walk:'+col+':'+row,a=point(x,y),b=point(x+8,y),path=context.path(a,b)||context.path(a,point(x+3.4,y));if(path)out.actors.push(this._walker(id,path,prefix));
  }
  return out;
 }
 _streetPocket(out,context,id,p,dx,dy,width,side,fallback=false){
  const kinds=['handcart','water-pump','workbench','sacks','laundry-rack'],kind=fallback?'water-pump':kinds[hash(id)%kinds.length],size=DIMENSIONS[kind],normalHalf=(Math.abs(dy)*size.w+Math.abs(dx)*size.d)/2;
  // Keep a two-metre centre lane through every intersecting road. The first
  // attempts use the pavement; a narrow-road fallback fits only if it clears.
  const laneClear=b=>!context.data.plazas.some(p=>overlap(grow(p,3),b))&&context.data.roads.every(r=>!r.points?.slice(1).some((v,i)=>segmentRect(r.points[i],v,grow(b,1.05))));
  let prop=null,chosen=null;
  for(const along of[0,-2.2,2.2,-4,4]){
   for(const edge of[width/2+normalHalf+.3,width/2+.15,Math.max(1.15+normalHalf,width/2-normalHalf-.2)]){
    const x=p.x+dx*along-dy*edge*side,y=p.y+dy*along+dx*edge*side,b=rect(x-size.w/2,y-size.d/2,size.w,size.d);
    if(!laneClear(b))continue;
    prop=this._prop(id+':fixture',kind,x,y,context);if(prop){chosen={x,y,edge,along};break;}
   }if(prop)break;
  }
  if(!prop){if(!fallback)this._streetPocket(out,context,id,p,dx,dy,width,side,true);return;}
  out.props.push(prop);const activity={id,kind:'street-work',x:chosen.x,y:chosen.y,z:0,districtId:prop.districtId,actorIds:[],propIds:[prop.id]};
  const alongHalf=(Math.abs(dx)*size.w+Math.abs(dy)*size.d)/2;
  // Workers stand at the ends of the object. A companion faces the worker.
  for(const[i,along,normal]of[[0,alongHalf+.8,0],[1,alongHalf+.9,-1.0],[2,-alongHalf-.8,0]]){
   if(i===2&&hash(id+':third')%2)continue;
   const x=chosen.x+dx*along-dy*normal*side,y=chosen.y+dy*along+dx*normal*side;
   out.pending.push({id:id+':person:'+i,p:point(x,y),activity:i===0?'work':i===1?'talk':'browse',groupId:id,extra:{facing:Math.atan2(chosen.y-y,chosen.x-x),preferredMotion:i===0&&kind==='workbench'?'Idle':'Conversation'}});
  }
  const smallKind=hash(id+':cargo')%2?'sacks':'baskets',cargoAlong=-alongHalf-1.15,cargoSize=DIMENSIONS[smallKind],bx=chosen.x+dx*cargoAlong,by=chosen.y+dy*cargoAlong;
  if(laneClear(rect(bx-cargoSize.w/2,by-cargoSize.d/2,cargoSize.w,cargoSize.d))){const cargo=this._prop(id+':cargo',smallKind,bx,by,context);if(cargo){out.props.push(cargo);activity.propIds.push(cargo.id);}}
  out.activities.push(activity);
 }
 _street(cx,cy){
  const box=rect(cx*CELL,cy*CELL,CELL,CELL),context=this._context(box),out={actors:[],props:[],activities:[],pending:[]},walks=[];
  for(const road of context.data.roads){
   if(!road.points||road.points.length<2)continue;const a=road.points[0],b=road.points.at(-1),len=distance(a,b);if(len<4)continue;
   const dx=(b.x-a.x)/len,dy=(b.y-a.y)/len,steps=Math.max(1,Math.ceil(len/9)),offset=Math.max(.42,Math.min(2.5,(road.width||4)/2-.55));
   for(let i=0;i<steps;i++){
    const mid=(i+.5)/steps,p=point(a.x+(b.x-a.x)*mid,a.y+(b.y-a.y)*mid);if(Math.floor(p.x/CELL)!==cx||Math.floor(p.y/CELL)!==cy)continue;
    for(const side of[-1,1]){const lo=(i+.13)/steps,hi=(i+.87)/steps,A=point(a.x+(b.x-a.x)*lo-dy*offset*side,a.y+(b.y-a.y)*lo+dx*offset*side),B=point(a.x+(b.x-a.x)*hi-dy*offset*side,a.y+(b.y-a.y)*hi+dx*offset*side);walks.push({id:'life:'+this.tag+':street:'+road.id+':'+i+':'+side,A,B,group:'road:'+road.id});}
   }
   for(let i=0,n=Math.max(1,Math.floor(len/24));i<n;i++){
    const t=(i+.5)/n,p=point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),side=hash(road.id+':fixture:'+i)%2?1:-1;if(!inside(box,p))continue;
    const edge=(road.width||4)/2+.65,x=p.x-dy*edge*side,y=p.y+dx*edge*side,id='life:'+this.tag+':frontage:'+road.id+':'+i;
    for(const[kind,along]of[['lantern',0],[hash(id)%2?'barrels':'baskets',1.5]]){const f=this._prop(id+':'+kind,kind,x+dx*along,y+dy*along,context);if(f)out.props.push(f);}
    const wear=this._prop(id+':wear','streetwear',p.x,p.y,context,{walkThrough:true});if(wear)out.props.push(wear);
   }
   // Local work pockets repeat along ordinary blocks, not just civic squares.
   if(!road.bridge)for(let i=0,n=Math.max(1,Math.floor(len/16));i<n;i++){
    const t=(i+.5)/n,p=point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
    if(Math.floor(p.x/CELL)!==cx||Math.floor(p.y/CELL)!==cy||context.data.plazas.some(plaza=>inside(grow(plaza,3),p)))continue;
    const id='life:'+this.tag+':blockwork:'+road.id+':'+i,side=hash(id+':side')%2?1:-1;
    this._streetPocket(out,context,id,p,dx,dy,road.width||4,side);
   }
   // Wider avenues support small pavement conversations and market work.
   if((road.width||0)>=7)for(let i=0,n=Math.max(1,Math.floor(len/28));i<n;i++){
    const t=(i+.5)/n,p=point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),side=hash(road.id+':'+i)%2?1:-1;
    p.x-=dy*((road.width||8)/2-1.4)*side;p.y+=dx*((road.width||8)/2-1.4)*side;if(!inside(box,p))continue;
    if(this.city.districts.some(d=>Math.hypot(p.x-d.arrival.x,p.y-d.arrival.y)<75))continue;
    this._group(out,context,'life:'+this.tag+':pavement:'+road.id+':'+i,p,'social');
   }
  }
  this._finishActors(out,context);
  for(const w of walks){const mid=point((w.A.x+w.B.x)/2,(w.A.y+w.B.y)/2),path=context.path(w.A,w.B)||context.path(w.A,mid)||context.path(mid,w.B)||context.path(w.A,w.B,true);if(path)out.actors.push(this._walker(w.id,path,w.group));}
  return out;
 }
 _exclusions(input){if(input===undefined)return[];if(!Array.isArray(input)||input.length>128)throw new TypeError('exclusions must be a bounded array');return input.map(v=>{
  if(!v||typeof v!=='object')throw new TypeError('Invalid exclusion');number(v.x,-1e7,1e7,'exclusion x');number(v.y,-1e7,1e7,'exclusion y');
  if(v.r!==undefined){number(v.r,0,1000,'exclusion radius');return{x:v.x,y:v.y,r:v.r};}number(v.w,0,2000,'exclusion width');number(v.d,0,2000,'exclusion depth');return rect(v.x,v.y,v.w,v.d);
 });}
 plan(city,position,radius=60,clock=0,options={}){
  this._city(city);if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new TypeError('A finite metre position is required');number(radius,0,160,'radius');number(clock,0,1e12,'clock');
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['maxActors','maxProps','exclusions'].includes(k)))throw new TypeError('Unknown population query option');
  const maxActors=integer(options.maxActors===undefined?192:options.maxActors,0,512,'maxActors'),maxProps=integer(options.maxProps===undefined?128:options.maxProps,0,256,'maxProps'),exclusions=this._exclusions(options.exclusions),chunks=[],reach=radius+PATH_LIMIT+5;
  for(const d of city.districts){const near=rect(d.arrival.x-110,d.arrival.y-110,220,220);if(circleRect(position,reach,near))chunks.push(this._get('civic:'+d.id,()=>this._civic(d)));}
  const loX=Math.max(city.bounds.x,position.x-reach),loY=Math.max(city.bounds.y,position.y-reach),hiX=Math.min(city.bounds.x+city.bounds.w,position.x+reach),hiY=Math.min(city.bounds.y+city.bounds.d,position.y+reach);
  if(hiX>=loX&&hiY>=loY)for(let cy=Math.floor(loY/CELL);cy<=Math.floor(hiY/CELL);cy++)for(let cx=Math.floor(loX/CELL);cx<=Math.floor(hiX/CELL);cx++)chunks.push(this._get('street:'+cx+':'+cy,()=>this._street(cx,cy)));
  const excludedPoint=p=>exclusions.some(e=>e.r!==undefined?distance(p,e)<e.r+BODY:circleRect(p,BODY,e));
  const excludedPath=path=>path.some(excludedPoint)||path.slice(1).some((p,i)=>exclusions.some(e=>e.r!==undefined?segmentDistance(e,path[i],p)<e.r+BODY:segmentRect(path[i],p,grow(e,BODY))));
  // Reconcile the complete local prop set before any actor is returned. This
  // catches paths crossing fixtures owned by another cell or the civic plan.
  const allProps=[...new Map(chunks.flatMap(c=>c.props).filter(p=>!p.walkThrough).map(p=>[p.id,p])).values()];
  const propGrid=new Map(),gridStep=8;
  for(const p of allProps){const b=grow(p,BODY+.1);for(let y=Math.floor(b.y/gridStep);y<=Math.floor((b.y+b.d)/gridStep);y++)for(let x=Math.floor(b.x/gridStep);x<=Math.floor((b.x+b.w)/gridStep);x++){const key=x+':'+y;if(!propGrid.has(key))propGrid.set(key,[]);propGrid.get(key).push(p);}}
  const propBlocks=path=>{const xs=path.map(p=>p.x),ys=path.map(p=>p.y),seen=new Set();for(let y=Math.floor(Math.min(...ys)/gridStep);y<=Math.floor(Math.max(...ys)/gridStep);y++)for(let x=Math.floor(Math.min(...xs)/gridStep);x<=Math.floor(Math.max(...xs)/gridStep);x++)for(const p of propGrid.get(x+':'+y)||[]){if(seen.has(p.id))continue;seen.add(p.id);if(path.some(a=>circleRect(a,BODY+.1,p))||path.slice(1).some((a,i)=>segmentRect(path[i],a,grow(p,BODY+.1))))return true;}return false;};
  const actors=[],props=[],activities=[],seen=new Set();let propRejectedActors=0;
  for(const chunk of chunks){for(const a of chunk.actors){if(seen.has(a.id))continue;seen.add(a.id);const pose=sample(a,clock);if(distance(pose,position)>radius||excludedPath(a.path))continue;if(propBlocks(a.path)){propRejectedActors++;continue;}actors.push({...a,...pose});}
   for(const p of chunk.props){if(seen.has(p.id))continue;seen.add(p.id);const center=point(p.x+p.w/2,p.y+p.d/2);if(distance(center,position)>radius+Math.hypot(p.w,p.d)/2||exclusions.some(e=>e.r!==undefined?circleRect(e,e.r,p):overlap(p,e)))continue;props.push(p);}
   for(const a of chunk.activities){if(seen.has(a.id))continue;seen.add(a.id);if(distance(a,position)<=radius&&!excludedPoint(a))activities.push(a);}
  }
  const rank=(a,b)=>distance(a,position)-distance(b,position)||a.id.localeCompare(b.id);actors.sort(rank);props.sort((a,b)=>rank({x:a.x+a.w/2,y:a.y+a.d/2,id:a.id},{x:b.x+b.w/2,y:b.y+b.d/2,id:b.id}));activities.sort(rank);
  const candidateActors=actors.length,candidateProps=props.length;actors.length=Math.min(actors.length,maxActors);props.length=Math.min(props.length,maxProps);
  const actorIds=new Set(actors.map(a=>a.id)),propIds=new Set(props.map(p=>p.id));
  const selectedActivities=activities.map(a=>({...a,actorIds:a.actorIds.filter(id=>actorIds.has(id)),propIds:a.propIds.filter(id=>propIds.has(id))})).filter(a=>a.actorIds.length||a.propIds.length);
  return{actors,props,activities:selectedActivities,stats:{candidateActors,candidateProps,actors:actors.length,moving:actors.filter(a=>a.moving).length,anchored:actors.filter(a=>a.path.length===1).length,props:props.length,activities:selectedActivities.length,propRejectedActors,...this.cacheStats()}};
 }
 query(...args){return this.plan(...args);}
 sample(actor,clock){return sample(actor,clock);}
}
const defaultPlanner=new Planner();
return{version:VERSION,units:'metres',bodyRadiusM:BODY,dimensions:DIMENSIONS,Planner,create:options=>new Planner(options),plan:(...args)=>defaultPlanner.plan(...args),query:(...args)=>defaultPlanner.plan(...args),sample};
});
