/* Frontier Atlas application. All simulation distance uses metres.
   The ride clock uses performance.now(), independent of the engine's clamped dt.
   A hidden tab or a >1 second interruption pauses the ride. There is no fast travel. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),A=WorldAtlas,T=AtlasTravel,U=A.unitsPerMetre,E=My3D2dge;
const STORAGE='dust-mercy:frontier-atlas-project-v1',RESULT='dust-mercy:frontier-atlas-last-ride-v1';
const defaults={walk:6,trot:12,canter:20,gallop:40},gaits=Object.keys(defaults);
const MOVE_INPUT={up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],pause:[]},NO_INPUT={up:[],down:[],left:[],right:[],pause:[]};
let speeds={...defaults},world=null,terrainRenderer=null,baseMap=null,mapRect=null,route=[],routeType='road',spawn=null,drawing=false,generationId=0,generating=false,mapRevision=0;
let game=null,horse=null,rig=null,ride=null,lastTick=0,lastUI=0,rideVisible=false,paused=false,rideTime=0,keys={},touch={},toastTimer=0,lastResult=null;
let preferences={gait:'canter',terrain:true},exportFileName='frontier-world.json';
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metres=m=>m>=1000?(m/1000).toFixed(2)+' km':m.toFixed(1)+' m';
const timeText=s=>{s=Math.round(Math.max(0,s||0)*10)/10;const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=(s%60).toFixed(1).padStart(4,'0');return(h?h+':':'')+String(m).padStart(2,'0')+':'+sec;};
const etaText=s=>{if(!Number.isFinite(s))return'—';if(s<60)return Math.ceil(s)+' sec';if(s<3600)return(s/60).toFixed(1)+' min';return Math.floor(s/3600)+' hr '+Math.round(s%3600/60)+' min';};
const copyPoints=p=>p.map(q=>({x:q.x,y:q.y}));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3800);}
function configFromForm(){return{areaKm2:Number($('area').value),aspect:Number($('aspect').value),seed:$('seed').value,ruggedness:Number($('ruggedness').value)/100,vegetation:Number($('vegetation').value)/100,settlements:Number($('settlements').value)};}
function fillForm(config){if(!Array.from($('aspect').options).some(o=>Number(o.value)===config.aspect))$('aspect').add(new Option('Custom · '+config.aspect+':1',String(config.aspect)));for(const key of['areaKm2','aspect','seed','settlements'])$(key==='areaKm2'?'area':key).value=config[key];for(const key of['ruggedness','vegetation'])$(key).value=config[key]*100;updateFormPreview();}
function updateFormPreview(){const c=configFromForm();if(c.areaKm2>0&&c.aspect>0)$('dimension-preview').textContent=Math.sqrt(c.areaKm2*c.aspect).toFixed(2)+' km × '+Math.sqrt(c.areaKm2/c.aspect).toFixed(2)+' km';for(const key of['ruggedness','vegetation'])$(key+'-value').textContent=parseFloat(Number($(key).value).toFixed(3))+'%';}
function project(){return{schema:'dust-and-mercy/frontier-atlas-project',version:1,world:A.exportConfig(world),horseSpeedsKmh:{...speeds},selectedGait:preferences.gait,terrainSlowdowns:preferences.terrain,route:{type:routeType,points:copyPoints(route)},freeRideStart:{...spawn}};}
function readProject(value){
 if(typeof value==='string'){if(value.length>160000)throw Error('The world file exceeds 160 KB.');value=JSON.parse(value);}
 if(value?.schema===A.schema)return{config:A.importConfig(value),speeds:{...defaults},gait:'canter',terrain:true,route:null,spawn:null};
 if(!value||value.schema!=='dust-and-mercy/frontier-atlas-project'||value.version!==1)throw Error('Use a Frontier Atlas version 1 world file.');
 const expected=['schema','version','world','horseSpeedsKmh','selectedGait','terrainSlowdowns','route','freeRideStart'];if(Object.keys(value).length!==expected.length||Object.keys(value).some(k=>!expected.includes(k)))throw Error('The world file has missing or unknown fields.');
 const config=A.importConfig(value.world),width=Math.sqrt(config.areaKm2*1e6*config.aspect),height=Math.sqrt(config.areaKm2*1e6/config.aspect);
 if(!value.horseSpeedsKmh||Object.keys(value.horseSpeedsKmh).length!==4||gaits.some(g=>typeof value.horseSpeedsKmh[g]!=='number'||!Number.isFinite(value.horseSpeedsKmh[g])||value.horseSpeedsKmh[g]<1||value.horseSpeedsKmh[g]>80))throw Error('Each horse speed must be from 1 to 80 km/h.');
 if(!gaits.includes(value.selectedGait)||typeof value.terrainSlowdowns!=='boolean')throw Error('The pace settings are invalid.');
 const validPoint=p=>p&&Object.keys(p).length===2&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=width&&p.y<=height;
 if(!value.route||!['road','direct','custom'].includes(value.route.type)||!Array.isArray(value.route.points)||value.route.points.length<2||value.route.points.length>256||!value.route.points.every(validPoint)||A.routeLength(value.route.points)<=0)throw Error('The route needs 2 to 256 valid points inside the world.');
 if(!validPoint(value.freeRideStart))throw Error('The free-ride start is outside the world.');
 return{config,speeds:{...value.horseSpeedsKmh},gait:value.selectedGait,terrain:value.terrainSlowdowns,route:value.route,spawn:value.freeRideStart};
}
function persist(){if(!world||route.length<2)return;try{localStorage.setItem(STORAGE,JSON.stringify(project()));}catch(_){}}
async function generate(config,restore=null){
 let next;try{next=A.create(A.validateConfig(config));}catch(error){$('form-status').textContent=error.message;$('form-status').classList.add('error');return false;}
 if(rideVisible)endRide();
 const ticket=++generationId;generating=true;world=next;terrainRenderer=new AtlasRenderer(world);baseMap=null;drawing=false;
 route=copyPoints(restore?.route?.points||world.roads[0].points);routeType=restore?.route?.type||'road';spawn={...(restore?.spawn||world.landmarks[0])};spawn={x:spawn.x,y:spawn.y};
 if(restore){speeds={...restore.speeds};preferences={gait:restore.gait,terrain:restore.terrain};}
 $('gait').value=preferences.gait;$('speed').value=speeds[preferences.gait];$('terrain-penalty').checked=preferences.terrain;
 fillForm(world.config);$('generate').disabled=true;$('form-status').classList.remove('error');$('form-status').textContent='Building the map from the world seed…';$('generation-progress').classList.remove('hidden');
 for(const id of['ride-route','free-ride','calibrate','export-project','save-map'])$(id).disabled=true;
 $('stat-area').innerHTML=world.areaKm2.toLocaleString()+' <em>km²</em>';$('stat-size').innerHTML=(world.widthM/1000).toFixed(world.widthM%1000?2:0)+' × '+(world.heightM/1000).toFixed(world.heightM%1000?2:0)+' <em>km</em>';$('stat-places').textContent=world.landmarks.length;
 $('survey-number').textContent=A.hash(world.seed).toString(16).slice(0,6).toUpperCase();$('territory-title').textContent=world.seed==='bitter-creek-1887'?'Bitter Creek Territory':'Calder Territory';
 const cv=document.createElement('canvas'),max=640;cv.width=Math.max(160,Math.round(max*Math.min(1,world.config.aspect)) );cv.height=Math.max(160,Math.round(max*Math.min(1,1/world.config.aspect)) );
 const g=cv.getContext('2d'),pixels=g.createImageData(cv.width,cv.height),previous=new Float32Array(cv.width);let left=0;
 const start=performance.now();
 for(let y=0;y<cv.height;y++){
  for(let x=0;x<cv.width;x++){
   const p=world.sample((x+.5)/cv.width*world.widthM,(y+.5)/cv.height*world.heightM),rgb=parseInt(p.color.slice(1),16),dx=x?p.heightM-left:0,dy=y?p.heightM-previous[x]:0;left=p.heightM;previous[x]=p.heightM;
   const relief=p.water||p.road?0:Math.max(-34,Math.min(28,(-dx*.62-dy*.82)*.7)),i=(y*cv.width+x)*4;
   pixels.data[i]=Math.max(0,Math.min(255,(rgb>>16)+relief));pixels.data[i+1]=Math.max(0,Math.min(255,(rgb>>8&255)+relief));pixels.data[i+2]=Math.max(0,Math.min(255,(rgb&255)+relief));pixels.data[i+3]=255;
  }
  if(y%32===0){$('generation-percent').textContent=Math.round(y/cv.height*100)+'%';await new Promise(resolve=>setTimeout(resolve,0));if(ticket!==generationId)return false;}
 }
 g.putImageData(pixels,0,0);baseMap=cv;mapRevision++;generating=false;
 $('generation-progress').classList.add('hidden');$('generate').disabled=false;for(const id of['ride-route','free-ride','calibrate','export-project','save-map'])$(id).disabled=false;
 $('form-status').textContent='Survey ready · '+world.landmarks.length+' places · '+(performance.now()-start).toFixed(0)+' ms map build';
 $('map-hint').textContent='Click the map to choose a free-ride start.';updateRoute();resizeMap();persist();return true;
}
function resizeMap(){const cv=$('atlas-map'),r=cv.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);cv.width=Math.max(1,Math.round(r.width*d));cv.height=Math.max(1,Math.round(r.height*d));drawMap();}
function mapLayout(W,H){const pad=H<280?15:34,scale=Math.min((W-pad*2)/world.widthM,(H-pad*2)/world.heightM);return{x:(W-world.widthM*scale)/2,y:(H-world.heightM*scale)/2,w:world.widthM*scale,h:world.heightM*scale,scale};}
function paintMap(g,W,H,small=false,rider=null,displayRoute=route){
 if(!world||!baseMap)return null;
 g.clearRect(0,0,W,H);g.fillStyle=small?'#7e8f6b':'#647959';g.fillRect(0,0,W,H);
 const box=mapLayout(W,H),p=q=>[box.x+q.x*box.scale,box.y+q.y*box.scale],scale=small?1:Math.max(1,W/$('atlas-map').getBoundingClientRect().width);
 // Survey paper outside the actual world boundary preserves the map's aspect ratio.
 if(!small){g.strokeStyle='#e3e8c012';g.lineWidth=1;for(let x=0;x<W;x+=24*scale){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=24*scale){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}}
 g.drawImage(baseMap,box.x,box.y,box.w,box.h);
 g.save();g.beginPath();g.rect(box.x,box.y,box.w,box.h);g.clip();
 if(!small){g.lineWidth=1;g.strokeStyle='#e8e7c729';for(let x=1000;x<world.widthM;x+=1000){g.beginPath();g.moveTo(...p({x,y:0}));g.lineTo(...p({x,y:world.heightM}));g.stroke();}for(let y=1000;y<world.heightM;y+=1000){g.beginPath();g.moveTo(...p({x:0,y}));g.lineTo(...p({x:world.widthM,y}));g.stroke();}}
 const path=(points,color,width)=>{g.beginPath();points.forEach((q,i)=>{const v=p(q);i?g.lineTo(...v):g.moveTo(...v);});g.strokeStyle=color;g.lineWidth=width;g.lineJoin='round';g.lineCap='round';g.stroke();};
 for(const river of world.rivers){path(river.points,'#3c7372',Math.max((small?.8:1.5)*scale,river.widthM*box.scale+scale));path(river.points,'#97b6a0',Math.max(.7*scale,river.widthM*box.scale));}
 for(const road of world.roads)path(road.points,'#e0c79e',Math.max((small?.6:1.1)*scale,road.widthM*box.scale));
 if(displayRoute.length>1){path(displayRoute,'#5e5936b3',(small?2.5:4.5)*scale);path(displayRoute,'#fae1a0',(small?1.2:2.3)*scale);}
 g.restore();
 g.strokeStyle='#e9e1b2aa';g.lineWidth=scale;g.strokeRect(box.x,box.y,box.w,box.h);
 if(!small){
  g.fillStyle='#dfe5c6';g.font=(9*scale)+'px Narrow';g.textAlign='center';
  const interval=world.widthM>20000?5000:1000;for(let x=0;x<=world.widthM;x+=interval){const q=p({x,y:world.heightM});g.fillText((x/1000).toFixed(0),q[0],q[1]+14*scale);}
  g.textAlign='right';for(let y=0;y<=world.heightM;y+=interval){const q=p({x:0,y});g.fillText(((world.heightM-y)/1000).toFixed(0),q[0]-7*scale,q[1]+3*scale);}
  const length=Math.min(1000,world.widthM/4)*box.scale,sx=box.x+12*scale,sy=box.y+box.h-17*scale;g.strokeStyle='#eef0cb';g.lineWidth=2*scale;g.beginPath();g.moveTo(sx,sy-4*scale);g.lineTo(sx,sy);g.lineTo(sx+length,sy);g.lineTo(sx+length,sy-4*scale);g.stroke();g.fillStyle='#f1edce';g.textAlign='center';g.font=(8*scale)+'px Narrow';g.fillText((Math.min(1000,world.widthM/4)/1000).toFixed(2)+' km',sx+length/2,sy-7*scale);
 }
 const occupied=[];
 for(const l of world.landmarks){
  const q=p(l),rad=(small?1.6:l.type==='settlement'?3:2.4)*scale;g.beginPath();if(l.type==='settlement')g.rect(q[0]-rad,q[1]-rad,rad*2,rad*2);else g.arc(...q,rad,0,Math.PI*2);g.fillStyle='#f2deb2';g.fill();g.strokeStyle='#46593c';g.lineWidth=scale;g.stroke();
  if(!small){const fontSize=(l.type==='settlement'?11:9)*scale;g.font=fontSize+'px '+(l.type==='settlement'?'Serif':'Narrow');let labelX=q[0]+7*scale,labelY=q[1]-6*scale,width=g.measureText(l.name).width;if(labelX+width>box.x+box.w+20*scale)labelX=q[0]-width-7*scale;const candidate={x:labelX,y:labelY,w:width,h:fontSize};if(occupied.some(o=>Math.abs(o.y-candidate.y)<fontSize+2*scale&&candidate.x<o.x+o.w+6*scale&&candidate.x+width>o.x-6*scale))labelY=q[1]+15*scale;occupied.push({...candidate,y:labelY});g.textAlign='left';g.lineWidth=3*scale;g.strokeStyle='#536544c7';g.strokeText(l.name,labelX,labelY);g.fillStyle='#fff0cc';g.fillText(l.name,labelX,labelY);}
 }
 const marker=(point,text,color)=>{const q=p(point);g.beginPath();g.arc(...q,5*scale,0,Math.PI*2);g.fillStyle=color;g.fill();g.strokeStyle='#fcf0c9';g.lineWidth=1.5*scale;g.stroke();if(!small){g.font='bold '+9*scale+'px Narrow';g.fillStyle='#283d29';g.textAlign='center';g.fillText(text,q[0],q[1]+3*scale);}};
 if(displayRoute.length){marker(displayRoute[0],'A','#f0d491');if(displayRoute.length>1)marker(displayRoute[displayRoute.length-1],'B','#e1c47e');if(drawing&&!small)displayRoute.slice(1,-1).forEach(q=>marker(q,'','#e1c47e'));}
 if(spawn&&!small){const q=p(spawn);g.strokeStyle='#d9eff0';g.lineWidth=1.5*scale;g.beginPath();g.arc(...q,7*scale,0,Math.PI*2);g.stroke();}
 if(rider){const q=p(rider);g.fillStyle='#fff8d5';g.strokeStyle='#273f32';g.lineWidth=2;g.beginPath();g.arc(...q,4.5,0,Math.PI*2);g.fill();g.stroke();}
 return box;
}
function drawMap(){if(!baseMap)return;const cv=$('atlas-map');mapRect=paintMap(cv.getContext('2d'),cv.width,cv.height);}
function terrainETA(points,speed,penalty){
 if(points.length<2)return NaN;
 let seconds=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b),steps=Math.max(1,Math.ceil(length/10));for(let j=0;j<steps;j++){const t=(j+.5)/steps,factor=penalty?world.sample(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t).speedFactor:1;seconds+=length/steps/(speed/3.6*factor);}}return seconds;
}
function updateRoute(){
 const length=route.length>1?A.routeLength(route):0;
 $('route-distance').innerHTML=(length/1000).toFixed(2)+' <em>km</em>';
 $('route-detail').textContent=drawing?route.length+' points · Click to add a point':routeType==='road'?'West gate to east gate · Calder Road':routeType==='direct'?'West to east · Straight survey line':route.length+' waypoints · Custom survey line';
 $('route-eta').textContent=etaText(terrainETA(route,speeds[preferences.gait],preferences.terrain));
 $('eta-detail').textContent=preferences.terrain?'Terrain estimate, excluding stops.':'At selected pace, excluding stops.';
 $('ride-route').disabled=length<=0||generating;$('export-project').disabled=length<=0||generating;
 for(const type of['road','direct','draw'])$(type+'-route').classList.toggle('selected',type==='draw'?drawing:type===routeType);
 $('undo-route').classList.toggle('hidden',!drawing);drawMap();persist();
}
function chooseRoute(type){drawing=type==='custom';routeType=type;route=type==='road'?copyPoints(world.roads[0].points):type==='direct'?[{...world.metadata.westEntrance},{...world.metadata.eastEntrance}]:[];$('map-hint').textContent=drawing?'Click to add route points. Use Undo point to remove the last point.':'Click the map to choose a free-ride start.';updateRoute();}
function mapPoint(event){if(!mapRect)return null;const cv=$('atlas-map'),r=cv.getBoundingClientRect(),sx=(event.clientX-r.left)*cv.width/r.width,sy=(event.clientY-r.top)*cv.height/r.height,x=(sx-mapRect.x)/mapRect.scale,y=(sy-mapRect.y)/mapRect.scale;return x<0||x>world.widthM||y<0||y>world.heightM?null:{x,y};}
function setupGame(){
 if(game)return;
 FrontierArt.install(E);game=new E.Game({canvas:$('ride-canvas'),view:new E.View('atlas','Frontier',25,48,1.55,1.25),minW:640,minH:360,maxW:1600,maxH:1100,bg:'#6d7f58',input:NO_INPUT});
 game.pauseOverlay=false;game.fadeTime=0;game.timeScale=1;game.cam.smooth=0;
 horse=new E.Body({x:0,y:0,r:10});horse.mounted=true;horse.facing=0;horse.speed=0;horse.color='#935836';
 rig=new E.Humanoid({build:'heroic',size:.98,weapon:null,hat:{style:'cowboy',color:'#796449'},hair:'long',sleeves:'long',cape:{len:5,seg:2.1,width:5},colors:{cloth:'#576355',pants:'#484b3f',boot:'#382e25',skin:'#c59268',hair:'#3b2c21',belt:'#65472e',cape:'#485344',capeIn:'#343e34'}});
 game.follow(horse,{z:27,lead:12});game.start({update(){},draw:drawRide,pausable:false});
 // Keep metre travel on its own monotonic clock. Rendering can be throttled
 // without slowing the horse. Hidden pages still pause through visibilitychange.
 setInterval(updateRide,16);
}
function startRide(mode){
 if(!world||generating)return;
 if(!Number.isFinite(speeds[preferences.gait])||speeds[preferences.gait]<1){toast('Set a valid horse speed first.');return;}
 let points=copyPoints(route);if(mode==='calibration')points=[{x:10,y:world.heightM/2},{x:110,y:world.heightM/2}];if(mode==='route'&&points.length<2){toast('Add at least two route points.');return;}
 rideVisible=true;paused=false;keys={};touch={};rideTime=0;$('editor').inert=true;document.body.classList.add('riding');$('ride-screen').classList.remove('hidden');$('ride-message').classList.add('hidden');$('export-ride').classList.add('hidden');$('resume-ride').classList.remove('hidden');
 setupGame();game.screen.resize();game.input.use(mode==='free'?MOVE_INPUT:NO_INPUT);
 const gait=mode==='calibration'?'gallop':preferences.gait,speed=mode==='calibration'?40:speeds[gait],start=mode==='free'?spawn:points[0];
 ride={mode,points,gait,speed,start:{x:start.x,y:start.y},terrain:mode==='calibration'?false:preferences.terrain,startedAt:new Date().toISOString(),startedMs:performance.now(),finishedMs:null,pauses:0,pauseSeconds:0,pauseStarted:null,recorded:false,record:null,run:null,manual:{x:start.x,y:start.y,facing:0,distanceM:0,activeSeconds:0,actualSpeedKmh:0,complete:false,remainingM:null}};
 if(mode!=='free')ride.run=new T.RouteRun({points,speedKmh:speed,terrainFactor:ride.terrain?(x,y)=>world.sample(x,y).speedFactor:undefined});
 horse.x=start.x*U;horse.y=start.y*U;horse.z=0;horse.facing=0;horse.speed=0;horse.vx=horse.vy=0;if(mode==='free'){for(let i=0;i<6;i++)terrainRenderer.collide(horse);ride.start={x:horse.x/U,y:horse.y/U};Object.assign(ride.manual,ride.start);}game.follow(horse,{z:27,lead:12});game.cam.snap=true;
 $('ride-location').textContent=mode==='calibration'?'One hundred metres.':nearestPlace(start).name;
 $('ride-mode').textContent=mode==='calibration'?'100 metre check · 40 km/h · No terrain slowdown':mode==='free'?'Free ride · Steer through the territory':'Route survey · Following the line at horse speed';
 $('ride-help').textContent=mode==='free'?'W A S D · Steer     SPACE · Pause':mode==='calibration'?'40 km/h fixed · SPACE Pause':'Auto steer · 1–4 Change pace · SPACE Pause';
 $('touch-steer').classList.toggle('hidden',mode!=='free'||!matchMedia('(pointer:coarse)').matches);
 updateGaits();updateRideUI();ride.startedMs=performance.now();ride.startedAt=new Date().toISOString();lastTick=ride.startedMs;lastUI=0;$('ride-canvas').focus({preventScroll:true});
}
function nearestPlace(point){let best=world.landmarks[0],bestD=Infinity;for(const l of world.landmarks){const d=distance(point,l);if(d<bestD){best=l;bestD=d;}}return{...best,distance:bestD};}
function getRideState(){return ride.run?ride.run.state():{...ride.manual};}
function setRideGait(gait){if(!ride||paused||ride.mode==='calibration')return;ride.gait=gait;ride.speed=speeds[gait];if(ride.run)ride.run.speedKmh=ride.speed;updateGaits();}
function updateGaits(){document.querySelectorAll('#ride-gaits button').forEach(b=>{const gait=b.dataset.gait;b.classList.toggle('selected',ride.gait===gait);b.querySelector('span').textContent=ride.mode==='calibration'&&gait==='gallop'?40:speeds[gait];b.disabled=ride.mode==='calibration';});$('pause-ride').textContent=paused?'Resume':'Pause';}
function pauseRide(message){if(!rideVisible||getRideState().complete||paused)return;paused=true;ride.pauses++;ride.pauseStarted=Math.max(ride.startedMs,Math.min(performance.now(),lastTick));ride.run?.pause();horse.speed=0;horse.vx=horse.vy=0;game.input.use(NO_INPUT);keys={};touch={};$('ride-message-kicker').textContent='RIDE PAUSED';$('ride-message-title').textContent='Take your time.';$('ride-message-detail').textContent=message||'The active ride clock has stopped. Total elapsed time continues.';$('resume-ride').classList.remove('hidden');$('export-ride').classList.add('hidden');$('ride-message').classList.remove('hidden');updateGaits();updateRideUI();$('resume-ride').focus({preventScroll:true});}
function resumeRide(){if(!rideVisible||getRideState().complete||!paused)return;if(document.hidden)return;paused=false;if(ride.pauseStarted!==null){ride.pauseSeconds+=(performance.now()-ride.pauseStarted)/1000;ride.pauseStarted=null;}ride.run?.resume();game.input.use(ride.mode==='free'?MOVE_INPUT:NO_INPUT);$('ride-message').classList.add('hidden');lastTick=performance.now();updateGaits();$('ride-canvas').focus({preventScroll:true});}
function updateRide(){
 const now=performance.now(),dt=(now-lastTick)/1000;lastTick=now;
 if(!rideVisible||!ride)return;
 if(document.hidden){pauseRide('The ride paused because the page is hidden. Return here to resume.');return;}
 const before=getRideState();
 if(!paused&&!before.complete){
  if(dt>1){ride.pauseSeconds+=dt;pauseRide('The ride paused after a long frame interruption. Resume to keep the travel clock accurate.');return;}
  if(dt>0){
   if(ride.run){const state=ride.run.update(dt);horse.vx=(state.x-horse.x/U)*U/dt;horse.vy=(state.y-horse.y/U)*U/dt;horse.x=state.x*U;horse.y=state.y*U;horse.facing=state.facing;horse.speed=state.actualSpeedKmh/3.6*U;}
   else{
    let [mx,my]=game.input.move();mx+=(touch.right?1:0)-(touch.left?1:0);my+=(touch.down?1:0)-(touch.up?1:0);const norm=Math.hypot(mx,my);if(norm>1){mx/=norm;my/=norm;}const [dx,dy]=game.view.screenDirToGround(mx,my);let moved=0;const steps=Math.max(1,Math.ceil(dt/.025)),h=dt/steps;
    for(let n=0;n<steps;n++){const x=horse.x,y=horse.y,factor=ride.terrain?world.sample(x/U,y/U).speedFactor:1,speed=ride.speed/3.6*U*factor;horse.vx=dx*speed;horse.vy=dy*speed;if(dx||dy)horse.facing=Math.atan2(dy,dx);horse.update(h,terrainRenderer);moved+=Math.hypot(horse.x-x,horse.y-y)/U;}
    Object.assign(ride.manual,{x:horse.x/U,y:horse.y/U,facing:horse.facing,distanceM:ride.manual.distanceM+moved,activeSeconds:ride.manual.activeSeconds+dt,actualSpeedKmh:moved/dt*3.6});horse.speed=moved/dt*U;
   }
   rideTime+=dt;horse.gait=ride.gait;rig.update(Math.min(dt,.1),{x:horse.x,y:horse.y,z:15,facing:horse.facing,vx:0,vy:0,pose:'crouch'});
   if(getRideState().complete)completeRide(now);
  }
 }else{horse.speed=0;horse.vx=horse.vy=0;}
 if(now-lastUI>100){lastUI=now;updateRideUI();}
}
function drawRide(r){if(!rideVisible||!horse||!terrainRenderer)return;terrainRenderer.draw(r,rideTime,horse,ride.mode==='free'?null:ride.points,ride.mode==='calibration'?ride.points[0]:null);r.actor(horse.x,horse.y,15,(g,ox,oy)=>rig.draw(g,ox,oy,r.view),{outline:false,rim:false,xray:true});}
function makeRideRecord(completed){
 const s=getRideState(),now=ride.finishedMs||performance.now(),pauseSeconds=ride.pauseSeconds+(ride.pauseStarted!==null?(now-ride.pauseStarted)/1000:0);
 return{schema:'dust-and-mercy/frontier-atlas-ride',version:1,generatorVersion:A.generatorVersion,seed:world.seed,areaKm2:world.areaKm2,widthM:world.widthM,heightM:world.heightM,unitsPerMetre:U,mode:ride.mode,completed,startedAt:ride.startedAt,endedAt:new Date().toISOString(),distanceM:s.distanceM,activeSeconds:s.activeSeconds,totalElapsedSeconds:(now-ride.startedMs)/1000,pausedSeconds:pauseSeconds,pauseCount:ride.pauses,averageSpeedKmh:s.activeSeconds?s.distanceM/s.activeSeconds*3.6:0,selectedSpeedKmh:ride.speed,terrainSlowdowns:ride.terrain,start:{...ride.start},end:{x:s.x,y:s.y},routeM:ride.run?.totalDistanceM??null,clock:'performance.now; 1x wall time; paused while hidden; no time scaling',movement:ride.mode==='free'?'Native Body movement after collision resolution':'Piecewise linear route survey; surface factors; decorative obstacles ignored'};
}
function saveRideRecord(completed){if(ride.recorded)return ride.record;ride.record=makeRideRecord(completed);ride.recorded=true;lastResult=ride.record;try{localStorage.setItem(RESULT,JSON.stringify(lastResult));}catch(_){}showLastResult();return ride.record;}
function completeRide(now){
 ride.finishedMs=now;horse.speed=0;const result=saveRideRecord(true);$('ride-message-kicker').textContent=ride.mode==='calibration'?'100 METRE CHECK COMPLETE':'ROUTE COMPLETE';$('ride-message-title').textContent=metres(result.distanceM)+' in '+result.activeSeconds.toFixed(1)+' seconds.';
 $('ride-message-detail').textContent='Average '+result.averageSpeedKmh.toFixed(2)+' km/h. Total elapsed '+result.totalElapsedSeconds.toFixed(2)+' seconds'+(result.pauseCount?' with '+result.pauseCount+' pause'+(result.pauseCount===1?'':'s'):' without pauses')+'. Distance uses metre coordinates. The ride clock ran at 1×.';
 $('resume-ride').classList.add('hidden');$('export-ride').classList.remove('hidden');$('ride-message').classList.remove('hidden');$('pause-ride').disabled=true;updateRideUI();
}
function showLastResult(){if(!lastResult)return;const s=lastResult;$('last-result').textContent=(s.mode==='calibration'?'Last 100 m check':s.mode==='free'?'Last free ride':'Last route survey')+(s.completed?' completed:':s.mode==='free'?' recorded:':' stopped:')+' '+metres(s.distanceM)+' in '+timeText(s.activeSeconds)+' active time · '+s.averageSpeedKmh.toFixed(2)+' km/h average · '+s.totalElapsedSeconds.toFixed(2)+' s total elapsed'+(s.pauseCount?' · '+s.pauseCount+(s.pauseCount===1?' pause':' pauses'):' · No pauses');$('last-result').classList.remove('hidden');$('export-last-ride').classList.remove('hidden');}
function updateRideUI(){
 if(!ride)return;const s=getRideState();$('live-speed').innerHTML=(paused||s.complete?0:s.actualSpeedKmh).toFixed(1)+' <em>km/h</em>';$('live-distance').innerHTML=s.distanceM<1000?s.distanceM.toFixed(1)+' <em>m</em>':(s.distanceM/1000).toFixed(3)+' <em>km</em>';$('live-time').textContent=timeText(s.activeSeconds);$('live-remaining').textContent=ride.mode==='free'?'Open ride':metres(s.remainingM);
 $('ride-position').textContent=Math.round(s.x).toLocaleString()+' m E · '+Math.round(world.heightM-s.y).toLocaleString()+' m N';$('total-time').textContent='Total elapsed '+timeText(((ride.finishedMs||performance.now())-ride.startedMs)/1000);
 const place=nearestPlace(s);if(ride.mode!=='calibration')$('ride-location').textContent=place.distance<100?place.name:world.sample(s.x,s.y).biome.replace(/\b[a-z]/g,c=>c.toUpperCase())+' · '+(place.distance/1000).toFixed(1)+' km from '+place.name;
 const stats=world.chunkStats();$('stream-status').textContent=stats.cachedChunks+' / 48 cached sections · '+terrainRenderer.visibleProps.length+' visible props · '+game.stats.renderMs.toFixed(0)+' ms draw';
 paintMap($('ride-minimap').getContext('2d'),240,240,true,s,ride.mode==='free'?[]:ride.points);
 const scaleLength=5*U*Math.hypot(game.view.ax,game.view.bx)*game.screen.S/game.screen.dpr;$('ride-screen').querySelector('.ride-scale span').style.width=scaleLength+'px';
}
function endRide(){
 if(!rideVisible)return;saveRideRecord(getRideState().complete);rideVisible=false;paused=false;keys={};touch={};horse.speed=0;horse.vx=horse.vy=0;game.input.use(NO_INPUT);$('ride-screen').classList.add('hidden');$('editor').inert=false;document.body.classList.remove('riding');$('pause-ride').disabled=false;$('ride-route').focus({preventScroll:true});drawMap();
}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function safeName(){return world.seed.toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,60)||'frontier';}
function openProject(importing){exportFileName=safeName()+'-world.json';$('copy-project').classList.toggle('hidden',importing);$('project-dialog-title').textContent=importing?'Import world':'Export world';$('project-dialog-help').textContent=importing?'Paste a Frontier Atlas world file, or choose a JSON file. Import rebuilds the territory and starts a new survey.':'This file stores the seed, settings, pace values, and route. Import it to rebuild the same territory.';$('project-json').value=importing?'':JSON.stringify(project(),null,2);$('project-json').readOnly=!importing;$('project-error').style.color='';$('project-error').textContent='';$('apply-import').classList.toggle('hidden',!importing);$('file-import-label').classList.toggle('hidden',!importing);$('download-project').classList.toggle('hidden',importing);$('project-dialog').showModal();}
$('world-form').onsubmit=e=>{e.preventDefault();generate(configFromForm());};
for(const id of['area','aspect','ruggedness','vegetation'])$(id).addEventListener('input',updateFormPreview);
$('new-seed').onclick=()=>{$('seed').value='calder-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36);$('form-status').textContent='Select Generate territory to use this seed.';};
$('road-route').onclick=()=>chooseRoute('road');$('direct-route').onclick=()=>chooseRoute('direct');$('draw-route').onclick=()=>chooseRoute('custom');$('undo-route').onclick=()=>{route.pop();updateRoute();};
$('atlas-map').addEventListener('pointermove',e=>{const p=mapPoint(e);if(p)$('map-coordinates').textContent='N '+((world.heightM-p.y)/1000).toFixed(3)+' km · E '+(p.x/1000).toFixed(3)+' km';});
$('atlas-map').addEventListener('click',e=>{if(generating)return;const p=mapPoint(e);if(!p)return;if(drawing){if(route.length>=256){toast('A route can have up to 256 points.');return;}if(route.length&&distance(route[route.length-1],p)<.1)return;route.push(p);updateRoute();}else{const near=nearestPlace(p);spawn=near.distance<world.widthM*.025?{x:near.x,y:near.y}:p;$('map-hint').textContent='Free ride starts '+(near.distance<world.widthM*.025?'at '+near.name:'at this marker')+'. Select Ride freely.';drawMap();persist();}});
$('gait').onchange=()=>{preferences.gait=$('gait').value;$('speed').value=speeds[preferences.gait];updateRoute();};
$('speed').onchange=()=>{const v=Number($('speed').value);if(!Number.isFinite(v)||v<1||v>80){$('speed').value=speeds[preferences.gait];toast('Set a speed from 1 to 80 km/h.');return;}speeds[preferences.gait]=v;updateRoute();};
$('terrain-penalty').onchange=()=>{preferences.terrain=$('terrain-penalty').checked;updateRoute();};
$('ride-route').onclick=()=>startRide('route');$('free-ride').onclick=()=>startRide('free');$('calibrate').onclick=()=>startRide('calibration');
$('pause-ride').onclick=()=>paused?resumeRide():pauseRide();$('resume-ride').onclick=resumeRide;$('end-ride').onclick=endRide;$('finish-map').onclick=endRide;
document.querySelectorAll('#ride-gaits button').forEach(b=>b.onclick=()=>setRideGait(b.dataset.gait));
document.querySelectorAll('[data-steer]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch[b.dataset.steer]=true;};b.onpointerup=b.onpointercancel=()=>{touch[b.dataset.steer]=false;};});
window.addEventListener('keydown',e=>{if(!rideVisible||e.repeat)return;if((e.code==='Space'||e.code==='Enter')&&e.target.closest?.('button,input,select,textarea,summary'))return;if(e.code==='Escape'){e.preventDefault();endRide();}else if(e.code==='Space'){e.preventDefault();paused?resumeRide():pauseRide();}else if(/^Digit[1-4]$/.test(e.code)){e.preventDefault();setRideGait(gaits[Number(e.code.slice(-1))-1]);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&rideVisible)pauseRide('The ride paused because the page is hidden. Return here to resume.');lastTick=performance.now();});
window.addEventListener('blur',()=>{if(rideVisible)pauseRide('The ride paused because the window lost focus. Resume when you are ready.');});
window.addEventListener('resize',()=>{resizeMap();if(game&&rideVisible)game.screen.resize();});
$('export-project').onclick=()=>openProject(false);$('import-project').onclick=()=>openProject(true);
$('download-project').onclick=()=>download($('project-json').value,exportFileName,'application/json');
$('apply-import').onclick=async()=>{try{const restore=readProject($('project-json').value);$('project-dialog').close();await generate(restore.config,restore);toast('World imported. The seed, settings, and route are restored.');}catch(error){$('project-error').textContent=error.message;}};
$('import-file').onchange=async()=>{const file=$('import-file').files[0];if(!file)return;if(file.size>160000){$('project-error').textContent='The world file exceeds 160 KB.';return;}$('project-json').value=await file.text();$('project-error').textContent='File loaded. Select Build this world to import it.';};
$('save-map').onclick=()=>{const cv=document.createElement('canvas');cv.width=Math.round(1800*Math.min(1,world.config.aspect));cv.height=Math.round(1800*Math.min(1,1/world.config.aspect));paintMap(cv.getContext('2d'),cv.width,cv.height);cv.toBlob(blob=>{if(blob)download(blob,safeName()+'-survey.png','image/png');});};
function openRideRecord(record){if(!record)return;openProject(false);exportFileName='frontier-atlas-ride.json';$('project-dialog-title').textContent='Export ride record';$('project-dialog-help').textContent='Measured distance, active time, total elapsed time, pauses, and world scale. Download the record or copy its JSON.';$('project-json').value=JSON.stringify(record,null,2);}
$('export-last-ride').onclick=()=>openRideRecord(lastResult);
$('export-ride').onclick=()=>openRideRecord(ride.record||makeRideRecord(getRideState().complete));
$('copy-project').onclick=async()=>{try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText($('project-json').value);else{$('project-json').select();if(!document.execCommand('copy'))throw Error('Copy unavailable');}$('project-error').style.color='#4f7046';$('project-error').textContent='JSON copied.';}catch(_){$('project-json').select();$('project-error').textContent='Select the text and use Copy on your device.';}};
// Read-only diagnostics for the in-page test harness. Normal UI owns all mutations.
root.FrontierAtlasApp=Object.freeze({snapshot:()=>({ready:!!baseMap&&!generating,config:world?.config,widthM:world?.widthM,heightM:world?.heightM,routeLengthM:route.length>1?A.routeLength(route):0,routeType,routePoints:copyPoints(route),spawn:spawn&&{...spawn},speeds:{...speeds},gait:preferences.gait,terrain:preferences.terrain,ride:ride&&{visible:rideVisible,paused,mode:ride.mode,...getRideState(),record:ride.record},lastResult,cache:world?.chunkStats(),terrainCache:terrainRenderer?.ground.size,engineErrors:game?.errors.slice()||[],engineTimeScale:game?.timeScale||1,mapRevision}),exportProject:()=>JSON.stringify(project(),null,2),readProject});
let restore=null;try{const saved=localStorage.getItem(STORAGE);if(saved)restore=readProject(saved);const savedResult=JSON.parse(localStorage.getItem(RESULT)||'null');if(savedResult?.schema==='dust-and-mercy/frontier-atlas-ride'&&Number.isFinite(savedResult.distanceM)&&Number.isFinite(savedResult.activeSeconds))lastResult=savedResult;}catch(_){}
showLastResult();generate(restore?.config||A.defaults,restore);
})(globalThis);
