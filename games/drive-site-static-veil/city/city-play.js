/* Meridian exploration. Uses the supplied engine for input, projection, bodies,
 * collision, animation, audio, and the render queue. One physical level is active.
 * A city floor has a real world height. It is never flattened to the street. */
(function(root){
 'use strict';
 const E=root.My3D2dge,M=root.Meridian,ME=root.MeridianEngine,A=root.CityArt;
 const U=M.UNIT,T=M.PLAN_TILE*U,$=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const SAVE='static-veil-city-position-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let game,body,rig,city,layer,building=null,plan=null,floor=-1,active=false,fullHeight=false;
 let goal=null,near=null,travel=null,time=0,facing=.75,blocks=[],blockKey='',hudTime=0,saveTime=0,stepTime=0,toastTimer;
 let roofPlans=new Map(),npcs=[],npcBlock='',perfFrames=0,perfStart=0,perfRender=0,perfUpdate=0,perfVisible=false;
 let perspective=null,cameraMode='orbit',orbitYaw=52,eyeYaw=225,orbitBias=0,eyePitch=7,viewDistance=1,eyeFov=76,cameraDrag=null;
 let exterior=null,lastCameraKey='';
 function toast(text){$('play-toast').textContent=text;$('play-toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('play-toast').classList.remove('on'),5500);}
 function ensureGame(){
  if(game)return;
  game=new E.Game({canvas:$('city-screen'),view:'iso',minW:960,minH:540,maxW:1920,maxH:1080,bg:'#07141e',input:{...E.Input.DEFAULT,click:['Mouse0'],run:['ShiftLeft','ShiftRight','Pad1'],interact:['KeyE','Pad0'],map:['KeyM'],pause:['Escape']}});
  game.pauseOverlay=false;game.lights.enabled=false;game.input.touchEnabled=false;game.reduceMotion=reduced;game.setZoom(.72);
  game.audio.setVolume(.25);game.audio.define('door',[{wave:'noise',freq:90,dur:.25,vol:.04},{wave:'sine',freq:480,to:650,dur:.15,vol:.04}]);
  game.audio.define('arrive',[{wave:'sine',freq:660,dur:.14,vol:.055},{wave:'sine',freq:990,dur:.2,vol:.025}]);
  game.audio.define('step',{wave:'noise',freq:110,dur:.035,vol:.014});
  body=new E.Body({r:5,step:2});
  rig=new E.Humanoid({build:'heroic',size:1,weapon:null,outfit:'coat',sleeves:'long',hair:{style:'ponytail',color:'#c8d7d2',length:8},colors:{skin:'#bd9c8e',hair:'#c8d7d2',cloth:'#365e70',coat:'#365e70',pants:'#173045',boot:'#13232e',glove:'#2d4b56',trim:'#72f5cf',metal:'#b5d9db'},eyeGlow:'#72f5cf'});
  setupCamera();
  game.follow(body,{z:20,lead:0});game.cam.smooth=.13;game.cam.offset=[-45,25];
  game.onError=(err,where)=>{toast('City error in '+where+': '+err.message);$('stream-status').textContent='ERROR / '+err.message;};
  game.start({update,draw,pausable:false});game.paused=true;
  $('use-button').addEventListener('click',()=>interact());
  $('cutaway-button').addEventListener('click',()=>{fullHeight=!fullHeight;$('cutaway-button').textContent=fullHeight?'FULL HEIGHT':'CUTAWAY ON';toast(fullHeight?'Full building height. Use CUTAWAY to see through upper floors.':'Upper floors are cut away. Physical floor heights stay the same.');});
  $('city-screen').addEventListener('wheel',e=>{if(!active||game.paused)return;e.preventDefault();if(cameraMode==='classic')game.setZoom(clamp(Math.round((game.zoom+(e.deltaY<0?.08:-.08))*100)/100,.5,1.2));else if(cameraMode==='eye')eyeFov=clamp(eyeFov+(e.deltaY>0?3:-3),50,90);else viewDistance=clamp(viewDistance*(e.deltaY>0?1.12:.89),.45,3);},{passive:false});
  document.querySelectorAll('[data-key]').forEach(el=>{const code=el.dataset.key;el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);game.input.press(code);});for(const ev of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>game.input.release(code));});
  addEventListener('keydown',e=>{if(active&&e.code==='F3'){e.preventDefault();perfVisible=!perfVisible;}});
  addEventListener('pagehide',save);
 }
 function setupCamera(){
  try{perspective=new root.MeridianPerspective.Renderer();}catch(error){cameraMode='classic';$('city-screen').dataset.perspectiveError=error.message;}
  try{const saved=localStorage.getItem('static-veil-city-camera-v1');if(perspective&&['orbit','eye','classic'].includes(saved))cameraMode=saved;}catch(_){}
  $('camera-mode').value=cameraMode;
  $('camera-mode').addEventListener('change',()=>setCameraMode($('camera-mode').value));
  $('camera-left').addEventListener('click',()=>turnCamera(-30));$('camera-right').addEventListener('click',()=>turnCamera(30));
  $('camera-reset').addEventListener('click',()=>{orbitYaw=exterior?90:52;eyeYaw=exterior?270:225;orbitBias=0;eyePitch=7;viewDistance=1;eyeFov=76;game.setZoom(.72);goal=null;updateCamera();});
  const screen=$('city-screen');screen.addEventListener('contextmenu',e=>e.preventDefault());
  screen.addEventListener('pointerdown',e=>{if(!active||game.paused||cameraMode==='classic'||e.button!==2)return;e.preventDefault();cameraDrag={id:e.pointerId,x:e.clientX,y:e.clientY};screen.setPointerCapture(e.pointerId);});
  screen.addEventListener('pointermove',e=>{if(!cameraDrag||cameraDrag.id!==e.pointerId||game.paused)return;const dx=e.clientX-cameraDrag.x,dy=e.clientY-cameraDrag.y;cameraDrag.x=e.clientX;cameraDrag.y=e.clientY;if(cameraMode==='eye'){eyeYaw-=dx*.28;eyePitch=clamp(eyePitch+dy*.22,-75,78);}else{orbitYaw-=dx*.28;orbitBias=clamp(orbitBias+dy*.18,-25,30);}goal=null;updateCamera();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])screen.addEventListener(ev,e=>{if(cameraDrag?.id===e.pointerId)cameraDrag=null;});
  document.addEventListener('keydown',e=>{if(!active||game.paused||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName))return;if(e.code==='KeyQ'||e.code==='KeyR'){e.preventDefault();turnCamera(e.code==='KeyQ'?-15:15);}});
  $('exterior-level').addEventListener('input',()=>{$('exterior-destination').textContent=+$('exterior-level').value*M.FLOOR_H+' m';});
  $('exterior-go').addEventListener('click',()=>rideExterior(+$('exterior-level').value));
  $('exterior-ground').addEventListener('click',()=>rideExterior(0));
  $('exterior-roof').addEventListener('click',()=>{if(exterior)rideExterior(exterior.b.floors);});
  $('exterior-hold').addEventListener('click',()=>{if(exterior){exterior.ride=null;updateExteriorPanel();save();}});
  $('exterior-exit').addEventListener('click',exitExterior);
  root.MeridianGraphicsUI?.bind({renderer:perspective,game,onResize:configureDisplay});
 }
 function configureDisplay(){if(!game)return;const classic=cameraMode==='classic',quality=root.MeridianGraphicsUI?.getSettings()?.quality;game.screen.setOptions(classic?{minW:540,minH:330,maxW:840,maxH:530}:quality==='high'?{minW:1280,minH:720,maxW:1920,maxH:1080}:{minW:960,minH:540,maxW:1920,maxH:1080});}
 function setCameraMode(mode){
  if(mode!=='classic'&&!perspective){toast('Perspective is not available on this device. Classic view is active.');mode='classic';}
  cameraMode=mode;goal=null;$('camera-mode').value=mode;cameraDrag=null;
  try{localStorage.setItem('static-veil-city-camera-v1',mode);}catch(_){}
  configureDisplay();updateCamera();updateHud();$('city-screen').focus();
 }
 function turnCamera(deg){if(cameraMode==='classic'){game.rotateView(deg);return;}if(cameraMode==='eye')eyeYaw+=deg;else orbitYaw+=deg;goal=null;updateCamera();}
 function updateCamera(){
  if(!body||!city)return;
  $('camera-tools').hidden=cameraMode==='classic';
  if(cameraMode==='classic'||!perspective)return;
  const c=perspective.camera,p=[body.x/U,body.y/U,body.z/U],target=[p[0],p[1],p[2]+1.25];
  if(cameraMode==='eye')c.look([p[0],p[1],p[2]+1.7],eyeYaw,eyePitch,{fov:eyeFov});
  else{
   const pitch=clamp(35+25*(1-Math.exp(-p[2]/140))+orbitBias,18,78),distance=(27+p[2]*.11)*viewDistance;
   c.orbit(target,orbitYaw,pitch,distance,{fov:62});
   const ignored=plan?.roof&&!exterior?layer.buildings.map(b=>b.id):building&&!exterior?[building.id]:[];
   const safe=root.MeridianCamera.math.avoidBuildings(c.eye,target,blocks.flatMap(b=>b.buildings),ignored);
   if(root.MeridianCamera.math.length(root.MeridianCamera.math.sub(safe,target))<.15)c.look(target,orbitYaw,8,{fov:62});else c.pose(safe,target,{fov:62});
  }
  $('camera-readout').textContent=(cameraMode==='eye'?'EYE LEVEL':'HEIGHT VIEW')+' · RIGHT-DRAG TO LOOK';
 }
 function perspectivePoint(z){const m=game.input.mouseScreen();if(!m||!perspective)return null;const c=perspective.camera,p=c.groundPoint((m[0]-game.screen.ix)*c.width/game.screen.buf.width,(m[1]-game.screen.iy)*c.height/game.screen.buf.height,z);return p?[p[0]*U,p[1]*U]:null;}
 function boardExterior(b,z=0){
  z=clamp(z,0,b.height);exterior={b,ride:null};building=b;floor=Math.round(z/M.FLOOR_H);plan=city.floor(b,floor);layer=new ME.FloorLayer(b,plan);
  ME.place(body,{x:b.door.x*U,y:(b.y+b.d+2.4)*U,z:z*U});goal=null;near=null;travel=null;orbitYaw=90;eyeYaw=270;eyePitch=8;orbitBias=0;viewDistance=1;
  $('exterior-panel').hidden=false;$('exterior-level').max=b.floors;$('exterior-level').value=floor;refreshBlocks();updateExteriorPanel();updateHud();save();
 }
 function rideExterior(index){
  if(!exterior||game.paused)return;index=clamp(Math.round(index),0,exterior.b.floors);const from=body.z/U,to=index*M.FLOOR_H;
  $('exterior-level').value=index;$('exterior-destination').textContent=to+' m';
  if(Math.abs(from-to)<.005){toast('The lift is already at this level.');return;}
  exterior.ride={from,to,time:0,duration:reduced?.15:Math.max(1.1,Math.abs(to-from)/16)};game.audio.sfx('door');updateExteriorPanel();
 }
 function updateExterior(dt){
  if(game.input.pressed('interact')){exitExterior();if(!exterior)return;}
  const ride=exterior.ride;
  if(ride){ride.time+=dt;const t=Math.min(1,ride.time/ride.duration),s=t*t*(3-2*t);body.z=(ride.from+(ride.to-ride.from)*s)*U;body.groundZ=body.z;if(t===1){body.z=body.groundZ=ride.to*U;floor=Math.round(ride.to/M.FLOOR_H);exterior.ride=null;game.audio.sfx('arrive');save();}}
  body.vx=body.vy=body.vz=0;rig.update(dt,{...body,facing});hudTime-=dt;if(hudTime<=0){hudTime=.1;updateExteriorPanel();updateHud();}saveTime-=dt;if(saveTime<=0){saveTime=3;save();}
 }
 function updateExteriorPanel(){
  if(!exterior)return;const z=body.z/U,level=Math.round(z/M.FLOOR_H),aligned=Math.abs(z-level*M.FLOOR_H)<.025;
  $('exterior-height').textContent=z.toFixed(1)+' M';$('exterior-floor').textContent=exterior.ride?'IN TRANSIT':aligned?(level===0?'GROUND':level===building.floors?'ROOF':'FLOOR '+(level+1)):'HELD BETWEEN FLOORS';
  $('exterior-destination').textContent=+$('exterior-level').value*M.FLOOR_H+' m';$('exterior-exit').disabled=!!exterior.ride||!aligned;
  $('exterior-hold').disabled=!exterior.ride;$('exterior-note').textContent=exterior.ride?'The city remains visible for the full journey.':aligned?'Exit at this level, or choose another destination.':'Select a level and travel before you exit.';
 }
 function exitExterior(){
  if(!exterior||game.paused)return;const z=body.z/U,idx=Math.round(z/M.FLOOR_H);
  if(exterior.ride||Math.abs(z-idx*M.FLOOR_H)>.025){toast('Stop at a floor before you exit the lift.');return;}
  const b=exterior.b,s=makeLayer(b,idx);exterior=null;$('exterior-panel').hidden=true;install(s,pointFor(s,idx===0?'entry':'lift'));updateCamera();toast('Entered '+(s.plan.roof?'the roof':s.plan.label)+'.');
 }
 function makeLayer(b,index){const p=city.floor(b,index);return{building:b,plan:p,floor:index,layer:p.roof?new ME.RoofLayer(city,b):new ME.FloorLayer(b,p)};}
 function pointFor(s,name='lift'){const p=s.plan.ports[name]||s.plan.ports.lift;return{x:(s.building.x+(p.x+.5)*M.PLAN_TILE)*U,y:(s.building.y+(p.y+.5)*M.PLAN_TILE)*U,z:s.plan.z*U};}
 function safeStreet(x,y){
  const sl=new ME.StreetLayer(city),cx=Math.floor(x/T),cy=Math.floor(y/T);
  for(let rad=0;rad<22;rad++)for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){if(rad&&Math.abs(dx)!==rad&&Math.abs(dy)!==rad)continue;const px=(cx+dx+.5)*T,py=(cy+dy+.5)*T;if([[0,0],[6,0],[-6,0],[0,6],[0,-6]].every(([a,b])=>sl.walkable(px+a,py+b)))return{x:px,y:py,z:0};}
  const a=city.anchor('tideward');return{x:(a.bx*M.BLOCK+8)*U,y:(a.by*M.BLOCK+8)*U,z:0};
 }
 function install(s,point){building=s.building;plan=s.plan;floor=s.floor;layer=s.layer;goal=null;near=null;roofPlans.clear();ME.place(body,point);blockKey='';npcBlock='';refreshBlocks();rig.update(.001,{...body,facing});game.cam.snap=true;updateHud();save();}
 function start(nextCity,opts={}){
  ensureGame();city=nextCity;active=true;travel=null;exterior=null;game.paused=false;game.input.clear();time=0;perfStart=performance.now();
  $('exterior-panel').hidden=true;
  $('vertical-status').hidden=true;
  const b=opts.buildingId?city.building(opts.buildingId):null;
  if(b&&Number.isInteger(opts.floor)&&opts.floor>=0){const s=makeLayer(b,Math.min(b.floors,opts.floor)),saved=opts.position&&Number.isFinite(opts.position.x)&&Number.isFinite(opts.position.y)?{x:opts.position.x*U,y:opts.position.y*U,z:s.plan.z*U}:null;const point=saved&&s.layer.walkable(saved.x,saved.y)?saved:pointFor(s,opts.port||'lift');install(s,point);}
  else{
   const a=opts.block||city.anchor('tideward'),bl=city.block(a.bx,a.by),first=bl.buildings[0];
   const p=opts.position&&Number.isFinite(opts.position.x)&&Number.isFinite(opts.position.y)?safeStreet(opts.position.x*U,opts.position.y*U):first?safeStreet(first.door.x*U,(first.door.y+1)*U):safeStreet((bl.x+7)*U,(bl.y+7)*U);
   install({building:null,plan:null,floor:-1,layer:new ME.StreetLayer(city)},p);
  }
  if(b&&opts.exterior)boardExterior(b,Number.isFinite(opts.position?.z)?opts.position.z:Math.max(0,opts.floor||0)*M.FLOOR_H);
  game.screen.resize();game.focus(body.x,body.y,body.z+20);game.cam.snap=true;game.audio.sfx('arrive');$('city-screen').focus();
  updateCamera();toast(exterior?'Select a level and travel outside the building. Right-drag to look.':floor<0?'Walk to a cyan door marker. Press E to enter.':'Use the lift or the stairs. The local map marks both.');
 }
 function stop(){if(!game)return;root.MeridianGraphicsUI?.close();save();active=false;game.paused=true;game.input.clear();near=null;$('play-prompt').hidden=true;}
 function pause(value){if(game){game.paused=!!value||!active;game.input.clear();}}
 function snapshot(){if(!city||!body)return null;return{version:1,seed:city.seed,kind:exterior?'exterior':floor<0?'street':plan.roof?'roof':'interior',buildingId:building?.id||null,floor,x:body.x/U,y:body.y/U,z:body.z/U,groundZ:body.groundZ/U,block:{bx:Math.floor(body.x/U/M.BLOCK),by:Math.floor(body.y/U/M.BLOCK)},streamedBlocks:blocks.length,activeFloorPlans:exterior||floor<0?0:plan.roof?layer.buildings.length:1,metadataCache:city.cache.size,transition:exterior?.ride?{kind:'exterior',to:exterior.ride.to/M.FLOOR_H}:travel?{kind:travel.kind,to:travel.target.floor}:null,camera:cameraMode,perspective:perspective&&cameraMode!=='classic'?{...perspective.camera.state(),...perspective.stats}:null,errors:game?.errors.length||0};}
 function save(){const s=snapshot();if(!s)return;try{localStorage.setItem(SAVE,JSON.stringify(s));}catch(_){}root.MeridianUI?.onPlayerUpdate?.(s);}
 function refreshBlocks(){const k=Math.floor(body.x/U/M.BLOCK)+','+Math.floor(body.y/U/M.BLOCK);if(k===blockKey)return;blocks=city.nearby(body.x/U,body.y/U,1);blockKey=k;refreshNpcs();}
 function refreshNpcs(){
  if(npcBlock===blockKey)return;npcBlock=blockKey;npcs=[];if(floor>=0)return;
  const center=city.block(Math.floor(body.x/U/M.BLOCK),Math.floor(body.y/U/M.BLOCK));if(center.terrain!=='land')return;
  const colors=['#58686b','#957665','#456171','#638073','#756d8c'];
  for(let i=0;i<6;i++){const lane=i%2===0,origin=(lane?center.x:center.y)+18+i*13;
   const p={x:(lane?origin:center.x+9)*U,y:(lane?center.y+9:origin)*U,z:0,vx:0,vy:0,facing:lane?0:Math.PI/2,base:origin,offset:i*1.4,lane,block:center};
   if(!layer.walkable(p.x,p.y))continue;p.rig=new E.Humanoid({build:'heroic',size:.85,weapon:null,outfit:i%2?'coat':'jacket',hair:'short',colors:{cloth:colors[i%5],coat:colors[i%5],pants:'#243344',skin:i%2?'#ab8c77':'#846e60',hair:'#202f39',trim:'#9daeb0'}});npcs.push(p);
  }
 }
 function nearestPortal(){
  if(exterior)return null;
  const all=[];
  if(floor<0){for(const bl of blocks)for(const b of bl.buildings){const p={x:b.door.x*U,y:b.door.y*U,z:0};all.push({...p,type:'door',b,title:b.name,text:`Enter ground floor · ${b.floors} floors · roof at ${b.height} m`});}}
  else{
   const s={building,plan};
   all.push({...pointFor(s,'lift'),type:'lift',title:'Passenger lift',text:`Choose a floor · Ground to roof / ${building.height} m`});
   if(floor<building.floors)all.push({...pointFor(s,'up'),type:'up',title:'Stairs up',text:floor+1===building.floors?'Climb to the roof':`Climb to floor ${floor+2} / ${(floor+1)*M.FLOOR_H} m`});
   if(floor>0)all.push({...pointFor(s,'down'),type:'down',title:'Stairs down',text:floor===1?'Descend to ground floor':`Descend to floor ${floor} / ${(floor-1)*M.FLOOR_H} m`});
   if(floor===0)all.push({...pointFor(s,'entry'),type:'exit',title:'Street exit',text:'Return to '+city.district(building.district).name});
  }
  let found=null,d=U*3.2;for(const a of all){const n=Math.hypot(body.x-a.x,body.y-a.y);if(n<d){d=n;found=a;}}return found;
 }
 function interact(){
  if(!active||game.paused||travel)return;if(exterior){exitExterior();return;}near=nearestPortal();if(!near){toast('Move close to a door, stair marker, or lift.');return;}
  if(near.type==='door'){const s=makeLayer(near.b,0);transition(s,pointFor(s,'entry'),'door');}
  else if(near.type==='exit'){const p=safeStreet(building.door.x*U,(building.door.y+1)*U);transition({building:null,plan:null,floor:-1,layer:new ME.StreetLayer(city)},p,'door');}
  else if(near.type==='up'||near.type==='down'){const up=near.type==='up',s=makeLayer(building,floor+(up?1:-1));transition(s,pointFor(s,up?'down':'up'),'stairs');}
  else if(near.type==='lift'){
   const b=building,current=floor;
   root.MeridianUI.dialog({kicker:'VERTICAL TRANSIT / '+b.name,title:'Choose your level.',html:`<p>Each level is a physical floor. The roof is at ${b.height} metres.</p><label for="lift-destination">Destination<select id="lift-destination">${Array.from({length:b.floors+1},(_,i)=>`<option value="${i}" ${i===current?'selected':''}>${i===b.floors?'ROOF':i===0?'GROUND FLOOR':'FLOOR '+(i+1)} · ${i*M.FLOOR_H} m</option>`).join('')}</select></label>`,buttons:[{label:'CANCEL'},{label:'TRAVEL',primary:true,action:()=>{const idx=Number($('lift-destination').value);if(idx===floor){toast('You are already on this level.');return;}if(!Number.isInteger(idx)||idx<0||idx>b.floors)return;const s=makeLayer(b,idx);transition(s,pointFor(s),'lift');}}]});
  }
 }
 function transition(target,to,kind){
  const from={x:body.x,y:body.y,z:body.z};travel={from,to,target,kind,t:0,dur:reduced?.12:kind==='door'?.45:kind==='stairs'?1.05:clamp(.75+Math.abs(to.z-from.z)/U/130,.85,2.4)};
  goal=null;body.vx=body.vy=body.vz=0;game.input.clear();$('play-prompt').hidden=true;
  $('vertical-status').hidden=false;$('vertical-label').textContent=kind==='lift'?'LIFT IN TRANSIT':kind==='stairs'?'STAIR TRANSFER':'DOOR ACCESS';game.audio.sfx('door');
 }
 function update(dt){
  if(!active||!city)return;time+=dt;
  if(game.input.pressed('map')||game.input.pressed('pause')){root.MeridianUI.showPlan();return;}
  if(exterior){updateExterior(dt);return;}
  if(travel){const t=travel;t.t+=dt;const raw=Math.min(1,t.t/t.dur),s=raw*raw*(3-2*raw);body.x=t.from.x+(t.to.x-t.from.x)*s;body.y=t.from.y+(t.to.y-t.from.y)*s;body.z=t.from.z+(t.to.z-t.from.z)*s;body.groundZ=body.z;
   rig.update(dt,{...body,vx:t.kind==='stairs'?45:0,vy:0,facing,pose:t.kind==='lift'?'idle':null});$('vertical-height').textContent=(body.z/U).toFixed(1)+' M';$('vertical-progress').style.width=raw*100+'%';
   if(raw===1){const q=travel;travel=null;install(q.target,q.to);$('vertical-status').hidden=true;game.audio.sfx('arrive');toast(floor<0?'Street level':`${building.name} · ${plan.label} · ${plan.z} m`);}return;
  }
  if(game.input.pressed('interact')){interact();if(travel||game.paused)return;}
  if(game.input.pressed('click')&&!cameraDrag){const p=cameraMode==='classic'?ME.mouseOnFloor(game,layer.z):perspectivePoint(layer.z/U);if(p){const g={x:p[0],y:p[1]};if(layer.walkable(g.x,g.y)){goal=g;if(layer.path){layer.goal=null;layer.path=[];}}else toast('That point is outside the current walkable surface.');}}
  const [sx,sy]=game.input.move();let[dx,dy]=cameraMode==='classic'?game.view.screenDirToGround(sx,sy):perspective.camera.moveOnGround(sx,sy);
  if(dx||dy)goal=null;else if(goal){if(Math.hypot(goal.x-body.x,goal.y-body.y)<8)goal=null;else{[dx,dy]=layer.direction(body,goal);if(!dx&&!dy)goal=null;}}
  const sp=(game.input.down('run')?6.3:3.8)*U;body.vx=dx*sp;body.vy=dy*sp;body.update(dt,layer);if(dx||dy)facing=Math.atan2(dy,dx);
  rig.update(dt,{...body,facing,point:false});
  stepTime-=dt;if((dx||dy)&&stepTime<0){stepTime=game.input.down('run')?.22:.34;game.audio.sfx('step');}
  refreshBlocks();
  if(plan?.roof){const here=layer.buildings.find(b=>ME.inside(body.x/U,body.y/U,b));if(here&&here.id!==building.id){building=here;plan=city.floor(here,here.floors);floor=here.floors;updateHud();}}
  for(const p of npcs){const velocity=Math.cos(time*.12+p.offset)*13,off=Math.sin(time*.12+p.offset)*105;p.vx=p.lane?velocity:0;p.vy=p.lane?0:velocity;p.x=(p.lane?p.base:p.block.x+9)*U+(p.lane?off:0);p.y=(p.lane?p.block.y+9:p.base)*U+(p.lane?0:off);p.facing=Math.atan2(p.vy,p.vx);p.rig.update(dt,p);}
  hudTime-=dt;if(hudTime<=0){hudTime=.12;updateHud();}
  saveTime-=dt;if(saveTime<=0){saveTime=5;save();}
 }
 function updateHud(){
  if(!body||!city)return;const block=city.block(Math.floor(body.x/U/M.BLOCK),Math.floor(body.y/U/M.BLOCK)),d=city.district(building?.district||block.district);
  $('play-district').textContent=d.name.toUpperCase();$('play-location').textContent=building?building.name:block.subdistrict;
  $('play-level').textContent=exterior?`EXTERIOR LIFT / ${(body.z/U).toFixed(1)} M · ${building.floors} STOREYS`:floor<0?'STREET LEVEL / 0 M':`${plan.label.toUpperCase()} / ${plan.z} M · ${plan.use.toUpperCase()}`;
  $('play-altitude').textContent=(body.z/U).toFixed(0)+' M';$('play-position').textContent=`${Math.round(body.x/U)} E / ${Math.round(city.size-body.y/U)} N`;
  near=travel?null:nearestPortal();$('play-prompt').hidden=!near;if(near){$('prompt-title').textContent=near.title;$('prompt-text').textContent=near.text;}
  const plans=exterior||floor<0?0:plan.roof?layer.buildings.length:1;$('stream-status').textContent=cameraMode==='classic'?`${blocks.length} STREET BLOCKS / ${plans} ACTIVE ${plans===1?'FLOOR':'FLOORS'} · ${city.cache.size}/72 CACHE`:`${perspective?.stats.blocks||0} CITY BLOCKS / ${plans} ACTIVE ${plans===1?'FLOOR':'FLOORS'} · PERSPECTIVE`;
  const s=snapshot();$('city-screen').dataset.location=JSON.stringify(s);root.MeridianUI?.onPlayerUpdate?.(s);drawLocalMap();
 }
 // Canvas clips projected world polygons to its small target. This avoids a
 // full-map raster cache and avoids scanning tall off-screen pixel polygons.
 function poly(g,pts,color){g.fillStyle=color;g.beginPath();for(let i=0;i<pts.length;i++){const p=pts[i];if(i)g.lineTo(Math.round(p[0]),Math.round(p[1]));else g.moveTo(Math.round(p[0]),Math.round(p[1]));}g.closePath();g.fill();g._c=null;}
 function rect(r,g,x,y,w,d,z,color){poly(g,[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(p=>r.w(p[0],p[1],z)),color);}
 function line(r,g,x,y,a,b,z,color,width=1){const p=r.w(x,y,z),q=r.w(a,b,z);g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(Math.round(p[0])+.5,Math.round(p[1])+.5);g.lineTo(Math.round(q[0])+.5,Math.round(q[1])+.5);g.stroke();g._c=null;}
 function visible(r,x,y,z,w=60,h=60){const p=r.w(x,y,z);return p[0]>-w&&p[0]<r.W+w&&p[1]>-h&&p[1]<r.H+h;}
 function worldBuilding(b){return{...b,palette:{side:b.palette,top:E.shade(b.palette,.15)},x:b.x*U,y:b.y*U,w:b.w*U,d:b.d*U,floorH:M.FLOOR_H*U};}
 function drawStreets(r){r.decal(g=>{
  for(const b of blocks){const x=b.x*U,y=b.y*U,w=M.BLOCK*U,road=b.road/2*U;
   rect(r,g,x,y,w,w,0,b.terrain==='water'?'#102936':b.park?'#203734':'#263c43');
   if(b.terrain==='water'){for(let i=0;i<10;i++){const sy=y+i*w/10;line(r,g,x,sy,x+w,sy,0,'#173747');}continue;}
   rect(r,g,x,y,w,road,0,'#10232d');rect(r,g,x,y,road,w,0,'#10232d');rect(r,g,x+w-road,y,road,w,0,'#10232d');rect(r,g,x,y+w-road,w,road,0,'#10232d');
   for(let i=0;i<125;i+=8){rect(r,g,x+i*U,y+U*.7,3*U,.16*U,.1,'#a59764');rect(r,g,x+U*.7,y+i*U,.16*U,3*U,.1,'#a59764');}
   for(let i=0;i<6;i++){rect(r,g,x+(9+i)*U,y+1*U,.5*U,5*U,.1,'#6b8182');rect(r,g,x+1*U,y+(9+i)*U,5*U,.5*U,.1,'#6b8182');}
   for(let i=1;i<30;i++){const p=i*4*U;line(r,g,x+road,y+p,x+w-road,y+p,.05,'#294149');line(r,g,x+p,y+road,x+p,y+w-road,.05,'#294149');}
   for(const a of b.buildings){rect(r,g,(a.x-1)*U,(a.y-1)*U,(a.w+2)*U,(a.d+2)*U,.2,'#374b50');rect(r,g,(a.door.x-1.6)*U,(a.door.y-1)*U,3.2*U,2.7*U,.3,a.accent);}
  }
 });
 for(const b of blocks){if(b.terrain!=='land')continue;const spots=[[b.x+10,b.y+10,'lamp'],[b.x+115,b.y+10,'lamp'],[b.x+10,b.y+112,'kiosk'],[b.x+8,b.y+64,'bench'],[b.x+64,b.y+8,b.park?'tree':'bollard']];
  if(b.park)for(let i=0;i<12;i++)spots.push([b.x+20+(i%4)*24,b.y+24+Math.floor(i/4)*32,'tree']);
  for(const[x,y,type]of spots)if(visible(r,x*U,y*U,0,80,110))A.streetProp(r,{type,x:x*U,y:y*U,z:0,variant:M.hash(b.id+type+x),accent:city.district(b.district).color,reducedMotion:reduced},time);
 }
 }
 function raisedRenderer(r){const q=Object.create(r);q.queue=(x,y,z,fn,o={})=>r.queue(x,y,z,fn,{...o,bias:(o.bias||0)+1e7});return q;}
 function roofPlan(b){if(!roofPlans.has(b.id))roofPlans.set(b.id,city.floor(b,b.floors));return roofPlans.get(b.id);}
 function drawFloor(r,b,p){
  const x=b.x*U,y=b.y*U,w=b.w*U,d=b.d*U,z=p.z*U,base=p.roof?'#2e4651':b.type==='industrial'?'#354345':b.type==='garden'?'#2e4845':'#2b414e';
  r.queue(x,y,z,g=>{rect(r,g,x,y,w,d,z,base);for(let i=1;i<p.w;i++)line(r,g,x+i*T,y,x+i*T,y+d,z,'#38535d');for(let j=1;j<p.h;j++)line(r,g,x,y+j*T,x+w,y+j*T,z,'#38535d');
   if(!p.roof){const mid=Math.floor(p.w/2);rect(r,g,x+(mid-1)*T,y+T,3*T,d-2*T,z+.1,'#354f59');line(r,g,x+mid*T,y+T,x+mid*T,y+d-T,z+.3,b.accent);}
  },{bias:-1e5});
  if(!p.roof){for(let cy=0;cy<p.h;cy++)for(let cx=0;cx<p.w;cx++){if(!p.cells[cy*p.w+cx])continue;const wx=x+cx*T,wy=y+cy*T;if(!visible(r,wx+T/2,wy+T/2,z,55,90))continue;const h=fullHeight?44:13;
    r.queue(wx+T/2,wy+T/2,z,g=>r.box(g,wx,wy,z,wx+T,wy+T,z+h,'#56747c','#293f4d'),{occluder:true});
   }}else{
   // Short perimeter rails retain the exact walkable roof outline. Skybridge
   // openings remain clear at both ends. Decorative rail height is 0.8 metre.
   const links=layer.links.filter(l=>l.a===b.id||l.b===b.id);
   for(let side=0;side<4;side++)for(let i=0;i<(side%2?b.d:b.w);i+=2){const len=Math.min(2,(side%2?b.d:b.w)-i);let rx=b.x,ry=b.y,rw=.25,rd=.25;
    if(side===0){rx+=i;rw=len;}if(side===1){rx+=b.w-.25;ry+=i;rd=len;}if(side===2){rx+=i;ry+=b.d-.25;rw=len;}if(side===3){ry+=i;rd=len;}
    if(links.some(l=>ME.inside(rx+rw/2,ry+rd/2,l,.35)))continue;const wx=rx*U,wy=ry*U;if(!visible(r,wx,wy,z,30,40))continue;
    r.queue(wx+rw*U/2,wy+rd*U/2,z,g=>r.box(g,wx,wy,z,wx+rw*U,wy+rd*U,z+13,'#84a2a5','#3c5965'));
   }
  }
  for(const o of p.props)A.floorProp(r,{...o,x:x+o.x*U,y:y+o.y*U,z,scale:1.15,accent:b.accent,reducedMotion:reduced},time);
  const portals=[['lift','LIFT','#dfff6e'],['up','UP','#74ddea'],['down','DOWN','#74ddea']];if(p.index===0)portals.push(['entry','EXIT','#c6dfd9']);
  for(const[key,label,color]of portals){if(key==='up'&&p.roof||key==='down'&&p.index===0)continue;const q=p.ports[key],wx=x+(q.x+.5)*T,wy=y+(q.y+.5)*T;if(!visible(r,wx,wy,z,60,90))continue;
   r.queue(wx,wy,z,g=>{rect(r,g,wx-13,wy-13,26,26,z+.25,'#17333f');line(r,g,wx-13,wy-13,wx+13,wy-13,z+.5,color);line(r,g,wx-13,wy+13,wx+13,wy+13,z+.5,color);}, {bias:-20});
   if(key==='lift')A.floorProp(r,{type:'lifthead',x:wx,y:wy-22,z,scale:.75,accent:color},time);
   else if(key!=='entry')A.floorProp(r,{type:'stairhead',x:wx-18,y:wy,z,scale:.72,orientation:key==='up'?0:2,accent:color},time);
   r.overlay(g=>{const pt=r.w(wx,wy,z+39);E.font.text(g,label,pt[0],pt[1],color,{align:'center',outline:'#10232c',font:'tiny'});});
  }
 }
 function draw(r){
  if(!active||!city||!body)return;
  if(cameraMode!=='classic'&&perspective){
   try{updateCamera();const state={city,body:{x:body.x/U,y:body.y/U,z:body.z/U,vx:body.vx/U,vy:body.vy/U},building,plan,layer,exterior:!!exterior,mode:cameraMode,fullHeight,facing,time,npcs:floor<0?npcs.map(p=>({x:p.x/U,y:p.y/U,z:0,vx:p.vx/U,vy:p.vy/U,facing:p.facing})):[],goal:goal?{x:goal.x/U,y:goal.y/U,z:layer.z/U}:null};const image=perspective.render(state,r.bw,r.bh);root.MeridianGraphicsUI?.refresh();r.tgt.drawImage(image,0,0,r.bw,r.bh);r.tgt._c=null;if(cameraMode==='eye')r.overlay(g=>{E.font.text(g,'+',r.W/2,r.H/2,'#b3dfd7',{align:'center',font:'tiny'});});measure(r);return;}catch(error){$('city-screen').dataset.perspectiveError=error.message;setCameraMode('classic');toast('Perspective display unavailable. Classic view is active.');}
  }
  r.sky(['#08131f','#132b38']);drawStreets(r);
  const roofIds=plan?.roof&&!exterior?new Set(layer.buildings.map(b=>b.id)):new Set();
  for(const bl of blocks)for(const b of bl.buildings){let c=fullHeight||exterior?{fullHeight:true,time,reduced}:{cutHeight:(layer.z||0)+96,time,reduced};
   if(!exterior&&(b.id===building?.id||roofIds.has(b.id))){if(floor===0)continue;c={cutHeight:layer.z,selected:true,time,reduced};}A.building(r,worldBuilding(b),c);
   if(floor<0&&visible(r,b.door.x*U,b.door.y*U,0,60,80)){const x=b.door.x*U,y=b.door.y*U;r.queue(x,y,0,g=>{const pt=r.w(x,y,14);E.font.text(g,'ENTRY',pt[0],pt[1],b.accent,{align:'center',outline:'#0b1925',font:'tiny'});});}
  }
  let actorR=r;
  if(plan&&!exterior){actorR=raisedRenderer(r);const floors=plan.roof?layer.buildings.map(b=>[b,roofPlan(b)]):[[building,plan]];for(const[b,p]of floors)drawFloor(actorR,b,p);
   if(plan.roof)for(const l of layer.links){const x=l.x*U,y=l.y*U,w=l.w*U,d=l.d*U,z=l.z*U;
    actorR.queue(x,y,z,g=>{rect(actorR,g,x,y,w,d,z,'#4b626b');for(let i=0;i<w;i+=20)line(actorR,g,x+i,y,x+i,y+d,z+.1,'#668184');line(actorR,g,x,y,x+w,y,z+13,'#8ab9b8',2);line(actorR,g,x,y+d,x+w,y+d,z+13,'#8ab9b8',2);},{bias:-1e5});
   }
  }
  if(floor<0)for(const p of npcs){if(!visible(r,p.x,p.y,0,40,70))continue;r.shadow(p.x,p.y,6,.3);r.actor(p.x,p.y,0,(g,x,y)=>p.rig.draw(g,x,y,r.view),{outline:false,rim:false});}
  if(exterior){actorR=raisedRenderer(r);actorR.queue(body.x,body.y,body.z,g=>{rect(actorR,g,body.x-25.6,body.y-25.6,51.2,51.2,body.z,'#294b59');line(actorR,g,body.x-25.6,body.y+25.6,body.x+25.6,body.y+25.6,body.z+18,'#74eacb',2);},{bias:-1e5});}
  actorR.shadow(body.x,body.y,7,.45,'#08131c',body.z);
  actorR.actor(body.x,body.y,body.z,(g,x,y)=>rig.draw(g,x,y,actorR.view),{outline:true,outlineColor:'#0b2a30',rim:false,xray:floor<0?{color:'#7ff8d3',outline:'#07131e'}:null});
  actorR.overlay(g=>{const p=actorR.w(body.x,body.y,body.z);g.strokeStyle='#8cffe1';g.globalAlpha=.45;g.lineWidth=1;g.beginPath();g.ellipse(p[0],p[1]+1,8,4,0,0,Math.PI*2);g.stroke();g.globalAlpha=1;g._c=null;});
  if(goal)actorR.overlay(g=>{const p=actorR.w(goal.x,goal.y,layer.z);E.font.text(g,'+',p[0],p[1]-3,'#dfff6e',{align:'center',outline:'#08131e'});});
  if(root.VeilArt&&!reduced&&floor<0)root.VeilArt.rain(r,time,false);
  measure(r);
 }
 function measure(r){
  // A measured diagnostic. Frame delivery uses wall-clock time, not the
  // engine's capped simulation delta. F3 toggles the display.
  perfFrames++;perfRender+=game.stats.renderMs;perfUpdate+=game.stats.updateMs;const now=performance.now();if(now-perfStart>1500){$('city-screen').dataset.performance=JSON.stringify({fps:+(perfFrames*1000/(now-perfStart)).toFixed(1),drawMs:+(perfRender/perfFrames).toFixed(1),updateMs:+(perfUpdate/perfFrames).toFixed(1)});perfFrames=perfRender=perfUpdate=0;perfStart=now;}
  if(perfVisible)r.overlay(g=>{const p=JSON.parse($('city-screen').dataset.performance||'{}');E.font.text(g,`F3  ${p.fps||0} FPS / ${p.drawMs||0} MS DRAW / ${p.updateMs||0} MS UPDATE`,12,r.H-10,'#dfff6e',{outline:'#08131e',font:'tiny'});});
 }
 function drawLocalMap(){
  const c=$('local-map'),g=c.getContext('2d'),W=c.width,H=c.height;g.fillStyle='#091b27';g.fillRect(0,0,W,H);
  let transform;
  if(plan&&!exterior){const bs=plan.roof?layer.buildings:[building],ls=plan.roof?layer.links:[],x0=Math.min(...bs.map(b=>b.x))-3,y0=Math.min(...bs.map(b=>b.y))-3,x1=Math.max(...bs.map(b=>b.x+b.w))+3,y1=Math.max(...bs.map(b=>b.y+b.d))+3,s=Math.min((W-12)/(x1-x0),(H-12)/(y1-y0));transform=(x,y)=>[(x-x0)*s+6,(y-y0)*s+6];
   for(const b of bs){const p=b.id===building.id?plan:roofPlan(b),[x,y]=transform(b.x,b.y);g.fillStyle='#2b4753';g.fillRect(x,y,b.w*s,b.d*s);g.fillStyle='#66868c';if(!p.roof)for(let cy=0;cy<p.h;cy++)for(let cx=0;cx<p.w;cx++)if(p.cells[cy*p.w+cx])g.fillRect(x+cx*M.PLAN_TILE*s,y+cy*M.PLAN_TILE*s,M.PLAN_TILE*s,M.PLAN_TILE*s);
    for(const[k,pt]of Object.entries(p.ports)){if(k==='entry'&&p.index!==0||k==='up'&&p.roof||k==='down'&&p.index===0)continue;const q=transform(b.x+(pt.x+.5)*M.PLAN_TILE,b.y+(pt.y+.5)*M.PLAN_TILE);g.fillStyle=k==='lift'?'#dfff6e':k==='entry'?'#edf4df':'#68ccec';g.fillRect(q[0]-2,q[1]-2,4,4);}}
   g.fillStyle='#7da3a3';for(const l of ls){const p=transform(l.x,l.y);g.fillRect(p[0],p[1],l.w*s,l.d*s);}
  }else{const s=.76;transform=(x,y)=>[(x-body.x/U)*s+W/2,(y-body.y/U)*s+H/2];for(const b of blocks){const p=transform(b.x,b.y);g.fillStyle=b.terrain==='water'?'#173a4b':'#162d36';g.fillRect(p[0],p[1],M.BLOCK*s-1,M.BLOCK*s-1);for(const a of b.buildings){const q=transform(a.x,a.y);g.fillStyle=a.accent+'77';g.fillRect(q[0],q[1],a.w*s,a.d*s);const d=transform(a.door.x,a.door.y);g.fillStyle='#70e5c8';g.fillRect(d[0]-1,d[1]-1,3,3);}}}
  const p=transform(body.x/U,body.y/U);g.fillStyle='#dfff6e';g.beginPath();g.arc(p[0],p[1],3,0,Math.PI*2);g.fill();g.strokeStyle='#f2ffd6';g.lineWidth=1;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0]+Math.cos(facing)*8,p[1]+Math.sin(facing)*8);g.stroke();
  g.font='8px monospace';g.fillStyle='#8aadb7';g.fillText(plan&&!exterior?'CYAN STAIRS / LIME LIFT':'CYAN DOORS / LIME YOU',7,H-5);
 }
 root.MeridianPlay={start,stop,pause,snapshot};
})(window);
