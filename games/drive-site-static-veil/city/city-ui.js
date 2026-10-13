/* Meridian City Kit. Atlas, editor, persistence, and exploration shell. */
(function(root){
 'use strict';
 const M=root.Meridian,$=id=>document.getElementById(id);
 const STORE='static-veil-meridian-config-v1',MAX_IMPORT=2*1024*1024;
 const fmt=new Intl.NumberFormat('en'),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=o=>JSON.parse(JSON.stringify(o));
 const atlas=$('atlas'),preview=$('floor-preview'),g=atlas.getContext('2d'),pg=preview.getContext('2d');
 let city,summary=null,selectedDistrict='tideward',selectedBlock=null,selectedBuilding=null,selectedFloor=0;
 let mode='plan',worker=null,workerUnavailable=false,jobId=0,activeJob=null,busy=false,lastPlayer=null,lastPlayerCity=null;
 let notificationTimer=0,drawQueued=false,dialogFocus=null,dialogOpen=false;
 const history=[],detailCache=new Map(),pointers=new Map();
 const cam={x:4000,y:4000,scale:.06,fit:.06},size={w:600,h:600,dpr:1};
 let pointer=null,hover=null,pinch=null,paintStroke=null;
 const inspectorBack=document.createElement('button');
 inspectorBack.textContent='← BACK TO MAP';inspectorBack.className='text-button';
 inspectorBack.style.cssText='width:100%;text-align:left;margin-bottom:16px';
 inspectorBack.addEventListener('click',()=>{$('inspector').classList.remove('mobile-open');atlas.focus();});
 $('inspector').prepend(inspectorBack);

 function notify(message){
  const el=$('notification');el.textContent=String(message);el.classList.add('on');
  clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>el.classList.remove('on'),4200);
 }
 function play(){return root.MeridianPlay;}
 function closeDialog(resume=true){
  const wasOpen=dialogOpen;dialogOpen=false;$('dialog-wrap').hidden=true;
  if(wasOpen&&resume&&mode==='walk')play()?.pause?.(false);
  if(wasOpen&&dialogFocus?.isConnected)dialogFocus.focus({preventScroll:true});
 }
 function dialog({kicker='MERIDIAN',title='',html='',buttons=[]}={}){
  if(!dialogOpen)dialogFocus=document.activeElement;
  dialogOpen=true;if(mode==='walk')play()?.pause?.(true);
  $('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;
  $('dialog-content').innerHTML=html;$('dialog-actions').replaceChildren();
  const actions=buttons.length?buttons:[{label:mode==='walk'?'RESUME EXPLORATION':'BACK TO CITY',primary:true}];
  for(const spec of actions){const b=document.createElement('button');b.textContent=spec.label||'CONTINUE';if(spec.primary)b.className='primary';
   b.addEventListener('click',()=>{closeDialog();if(typeof spec.action==='function')spec.action();});$('dialog-actions').append(b);
  }
  $('dialog-wrap').hidden=false;
  const focus=$('dialog-content').querySelector('select,input,button,a[href]')||$('dialog-actions').querySelector('button');
  if(focus)requestAnimationFrame(()=>focus.focus());
 }
 const dialogClose=document.createElement('button');dialogClose.textContent='×';dialogClose.setAttribute('aria-label','Close dialog');
 dialogClose.style.cssText='float:right;padding:1px 9px;font-size:22px;margin:-7px -7px 5px 12px';
 dialogClose.addEventListener('click',()=>closeDialog());$('dialog-title').parentElement.prepend(dialogClose);
 $('dialog-wrap').addEventListener('pointerdown',e=>{if(e.target===$('dialog-wrap'))closeDialog();});

 function updateMode(next){
  mode=next;const walking=next==='walk';
  $('workspace').hidden=walking;$('app-footer').hidden=walking;$('play-stage').hidden=!walking;
  document.body.classList.toggle('world-playing',walking);
  $('plan-mode').classList.toggle('active',!walking);$('walk-mode').classList.toggle('active',walking);
  $('plan-mode').setAttribute('aria-pressed',String(!walking));$('walk-mode').setAttribute('aria-pressed',String(walking));
 }
 function showPlan(){
  if(mode==='walk'){try{lastPlayer=play()?.snapshot?.()||lastPlayer;lastPlayerCity=city;}catch(_){}play()?.stop?.();}
  closeDialog(false);updateMode('plan');
  if(lastPlayer&&lastPlayerCity===city)syncPlayerSelection(lastPlayer);
  requestAnimationFrame(()=>{resize();drawAtlas();atlas.focus({preventScroll:true});});
 }
 function showWalk(opts){
  if(!city)return;
  if(!play()?.start){notify('The city explorer is still loading. Try again in a moment.');return;}
  let destination=opts?{...opts}:null;
  if(!destination){
   if(lastPlayer&&lastPlayerCity===city){destination={block:lastPlayer.block||selectedBlock,buildingId:lastPlayer.buildingId||undefined,floor:Number.isInteger(lastPlayer.floor)?lastPlayer.floor:-1,position:{x:lastPlayer.x,y:lastPlayer.y,z:lastPlayer.z},exterior:lastPlayer.kind==='exterior'};}
   else destination={block:selectedBlock||city.anchor(selectedDistrict),floor:-1};
  }
  if(!destination.block&&destination.buildingId){const b=city.building(destination.buildingId);if(b)destination.block={bx:b.bx,by:b.by};}
  destination.block=destination.block||selectedBlock||city.anchor(selectedDistrict);
  const block=city.block(destination.block.bx,destination.block.by);
  if(block.terrain==='water'||block.terrain==='outside'){notify('Choose a land block or a river crossing to explore.');return;}
  closeDialog(false);updateMode('walk');$('inspector').classList.remove('mobile-open');
  try{play().start(city,destination);requestAnimationFrame(()=>$('city-screen').focus({preventScroll:true}));}
  catch(error){play()?.stop?.();updateMode('plan');notify('Could not start exploration: '+error.message);resize();}
 }
 function syncPlayerSelection(s){
  let block=s.block;
  if(!block&&Number.isFinite(s.x)&&Number.isFinite(s.y))block={bx:Math.floor(s.x/M.BLOCK),by:Math.floor(s.y/M.BLOCK)};
  if(block&&block.bx>=0&&block.by>=0&&block.bx<city.n&&block.by<city.n){selectedBlock={bx:block.bx,by:block.by};
   const b=s.buildingId&&city.building(s.buildingId);if(b){selectedBuilding=b.id;selectedFloor=clamp(Number.isInteger(s.floor)?s.floor:0,0,b.floors);}else selectedBuilding=null;
   if(mode==='plan')refreshInspector();
  }
 }
 function onPlayerUpdate(snapshot){
  // MeridianPlay owns its live HUD. Snapshot coordinates are metres.
  // Store updates while exploring; render the atlas only when it becomes visible.
  if(!snapshot)return;lastPlayer=snapshot;lastPlayerCity=city;
 }

 function saveConfig(){
  try{localStorage.setItem(STORE,JSON.stringify(city.export()));$('save-state').textContent='Saved on this browser';$('save-state').title='The city seed, rules, district paint, and building changes are saved automatically.';}
  catch(_){$('save-state').textContent='Export to keep this city';$('save-state').title='Browser storage is unavailable. Export the city configuration to keep your changes.';}
 }
 function remember(config){history.push(copy(config));if(history.length>16)history.shift();$('undo-button').disabled=false;}
 function setBusy(on){busy=on;$('map-loading').hidden=!on;$('generate-button').disabled=on;$('apply-district').disabled=on;$('apply-building').disabled=on;atlas.setAttribute('aria-busy',String(on));}
 function readControls(){const c=city?city.export():M.defaultConfig();c.seed=$('city-seed').value;c.sizeKm=+$('city-size').value;c.density=+$('city-density').value;c.height=+$('city-height').value;c.bridges=$('city-bridges').checked;return c;}
 function syncControls(){
  const c=city.config;$('city-seed').value=c.seed;$('city-size').value=String(c.sizeKm);
  const density=$('city-density');for(const option of Array.from(density.options))if(option.dataset.custom)option.remove();
  if(!Array.from(density.options).some(o=>+o.value===c.density)){const o=document.createElement('option');o.value=String(c.density);o.textContent=Math.round(c.density*100)+'% custom';o.dataset.custom='true';density.append(o);}density.value=String(c.density);
  $('city-height').value=String(c.height);$('height-value').textContent=c.height.toFixed(2)+'×';$('city-bridges').checked=c.bridges;syncDistrictRules();
 }
 function applyConfig(config,{record=true,fit=false,message='',before=null}={}){
  let normalized;try{normalized=M.normalize(config);}catch(error){notify(error.message);return;}
  const previous=city?.export(),sizeChanged=city&&city.config.sizeKm!==normalized.sizeKm;
  if(record&&previous&&JSON.stringify(previous)!==JSON.stringify(normalized))remember(before||previous);
  if(mode==='walk')showPlan();city=new M.City(normalized);lastPlayer=null;lastPlayerCity=null;summary=null;detailCache.clear();
  if(!selectedBlock||selectedBlock.bx>=city.n||selectedBlock.by>=city.n){const a=city.anchor(selectedDistrict);selectedBlock={bx:a.bx,by:a.by};selectedBuilding=null;}
  syncControls();saveConfig();requestSummary({fit:fit||!!sizeChanged,message});
 }
 function requestSummary(meta){
  const id=++jobId;activeJob={id,...meta};setBusy(true);$('map-subtitle').textContent='Resolving districts and building schedules…';
  if(!worker&&!workerUnavailable){try{worker=new Worker('city-worker.js');worker.onmessage=e=>{if(e.data.id!==jobId)return;if(e.data.ok)finishSummary(e.data.summary,e.data.id);else summaryFailure(e.data.error,e.data.id);};worker.onerror=()=>{worker?.terminate();worker=null;workerUnavailable=true;fallbackSummary(jobId);};}catch(_){workerUnavailable=true;}}
  if(worker){try{worker.postMessage({id,config:city.export()});}catch(_){worker.terminate();worker=null;workerUnavailable=true;fallbackSummary(id);}}
  else fallbackSummary(id);
 }
 function fallbackSummary(id){setTimeout(()=>{if(id!==jobId)return;try{finishSummary(city.summary(),id);}catch(error){summaryFailure(error.message,id);}},30);}
 function summaryFailure(message,id){if(id!==jobId)return;setBusy(false);$('map-subtitle').textContent='City generation could not finish.';notify('City generation failed: '+message);}
 function finishSummary(data,id){
  if(id!==jobId)return;summary=data;detailCache.clear();setBusy(false);
  const t=data.totals;$('stat-envelope').textContent=(t.envelopeM2/1e6).toFixed(1);$('stat-envelope').parentElement.title='The full city envelope includes land and water.';
  $('stat-buildings').textContent=fmt.format(t.buildings);$('stat-floors').textContent=fmt.format(t.floors);$('stat-height').textContent=fmt.format(t.highestM);$('stat-bridges').textContent=fmt.format(t.bridges);
  $('map-title').textContent=city.seed==='MERIDIAN-09'?'A city of six districts.':city.seed;
  $('map-subtitle').textContent=`${city.config.sizeKm} × ${city.config.sizeKm} km envelope · ${(t.landM2/1e6).toFixed(1)} km² land · ${fmt.format(t.buildings)} buildings`;
  renderDistricts();refreshInspector();if(activeJob?.fit)fitMap();else requestDraw();
  if(activeJob?.message)notify(activeJob.message);activeJob=null;
 }

 function district(){return city.district(selectedDistrict);}
 function syncDistrictRules(){
  if(!city)return;const r=city.config.rules[selectedDistrict],d=district();
  $('district-density').value=String(r.density);$('district-density').setAttribute('aria-label',d.name+' occupied plots');$('district-density').title=Math.round(r.density*100)+'% of plots';
  $('district-min').value=r.min;$('district-max').value=r.max;$('district-rules').querySelector('summary').textContent='Edit '+d.name;
 }
 function renderDistricts(){
  $('district-list').replaceChildren();
  for(const d of M.DISTRICTS){const b=document.createElement('button');b.className='district-row'+(selectedDistrict===d.id?' active':'');b.setAttribute('aria-pressed',String(selectedDistrict===d.id));
   b.innerHTML=`<i style="background:${d.color}"></i><span>${esc(d.name)}<small>${esc(d.use)}</small></span><b>${summary?fmt.format(summary.districts[d.id].buildings):'—'}</b>`;
   b.title=d.name+' · '+(summary?fmt.format(summary.districts[d.id].buildings)+' buildings':d.use);
   b.addEventListener('click',()=>{selectedDistrict=d.id;renderDistricts();syncDistrictRules();if(!$('paint-toggle').checked){const a=city.anchor(d.id);selectBlock(a.bx,a.by,{open:false});if(cam.scale>cam.fit*1.4){cam.x=a.x;cam.y=a.y;}}requestDraw();});$('district-list').append(b);
  }
 }
 function selectBlock(bx,by,{x,y,open=true}={}){
  if(!city||bx<0||by<0||bx>=city.n||by>=city.n)return;
  selectedBlock={bx,by};const b=city.block(bx,by);selectedDistrict=b.district;
  const hit=Number.isFinite(x)?b.buildings.find(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.d):null;
  selectedBuilding=hit?.id||b.buildings[0]?.id||null;selectedFloor=0;
  renderDistricts();syncDistrictRules();refreshInspector();if(open&&innerWidth<=830)$('inspector').classList.add('mobile-open');requestDraw();
 }
 function infoCell(value,label){return `<div><strong>${esc(value)}</strong><small>${esc(label)}</small></div>`;}
 function refreshInspector(){
  if(!city||!selectedBlock)return;
  const block=city.block(selectedBlock.bx,selectedBlock.by),d=city.district(block.district),water=block.terrain==='water';
  $('area-title').textContent=water?'Open water':block.terrain==='bridge'?'River crossing':block.park?'Garden reserve':block.subdistrict;
  $('area-description').textContent=`${d.name} · ${d.use}. ${water?'Water is part of the city envelope and is not a walkable surface.':block.terrain==='bridge'?'A crossing joins the street grid across the channel.':'A 125 × 125 m block with public streets and alleys.'}`;
  const area=block.buildings.reduce((n,b)=>n+b.w*b.d,0),height=Math.max(0,...block.buildings.map(b=>b.height));
  $('block-info').innerHTML=infoCell(String(block.bx).padStart(2,'0')+' / '+String(block.by).padStart(2,'0'),'BLOCK EAST / SOUTH')+infoCell(block.buildings.length,'BUILDINGS')+infoCell(Math.round(area/(125*125)*100)+'%','BUILDING COVERAGE')+infoCell(height+' m','HIGHEST ROOF');
  $('visit-block').disabled=water||block.terrain==='outside';$('visit-block').textContent=water?'WATER / NO STREET ACCESS':'WALK THIS BLOCK';
  $('building-count').textContent=String(block.buildings.length).padStart(2,'0');$('building-list').replaceChildren();
  if(!block.buildings.some(b=>b.id===selectedBuilding)){selectedBuilding=block.buildings[0]?.id||null;selectedFloor=0;}
  for(const b of block.buildings){const el=document.createElement('button');el.className='building-row'+(b.id===selectedBuilding?' active':'');el.setAttribute('aria-pressed',String(b.id===selectedBuilding));
   const h=clamp(9+b.floors/4,10,24);el.innerHTML=`<span class="building-icon" aria-hidden="true"><i style="height:${h-5}px"></i><i style="height:${h}px;background:${b.accent}"></i><i style="height:${h-2}px"></i></span><span>${esc(b.name)}<small>${b.floors} floors · ${esc(b.type)}${b.links.length?' · roof link':''}</small></span><b>${b.height}m</b>`;
   el.addEventListener('click',()=>{selectedBuilding=b.id;selectedFloor=0;refreshInspector();requestDraw();});$('building-list').append(el);
  }
  if(!block.buildings.length){const p=document.createElement('p');p.className='small-note';p.textContent=water?'Select a land block to inspect a building.':block.park?'This block is reserved for open garden space.':'No buildings occupy this block. Change the district density or select a nearby block.';$('building-list').append(p);}
  renderBuilding();
 }
 function renderBuilding(){
  const b=selectedBuilding&&city.building(selectedBuilding);$('building-detail').hidden=!b;if(!b)return;
  selectedFloor=clamp(selectedFloor,0,b.floors);$('building-title').textContent=b.name;$('building-use').textContent=b.type.toUpperCase()+' / '+b.w+' × '+b.d+' M';$('building-height').textContent=b.height+' m';
  $('building-floors').value=b.floors;$('building-type').value=b.type;const select=$('inspect-floor');select.replaceChildren();
  for(let i=0;i<=b.floors;i++){const o=document.createElement('option');o.value=String(i);o.textContent=(i===b.floors?'Roof':i===0?'Ground floor':'Floor '+(i+1))+' · '+i*M.FLOOR_H+' m';select.append(o);}select.value=String(selectedFloor);renderFloor();
 }
 function renderFloor(){
  const b=selectedBuilding&&city.building(selectedBuilding);if(!b)return;const p=city.floor(b,selectedFloor);
  $('floor-description').textContent=`${p.use}. ${fmt.format(b.w*b.d)} m² gross area. ${p.roof?(b.links.length?b.links.length+' roof link'+(b.links.length===1?'':'s')+' at this height.':'An enclosed roof with stair and lift access.'):'Stairs and a lift connect every level.'}`;
  $('visit-floor').textContent=p.roof?'ENTER ROOF':'ENTER FLOOR';preview.setAttribute('aria-label',`${b.name}, ${p.label}, ${p.z} metres. Public spine, rooms, stairs, and lift.`);
  const width=Math.max(160,preview.getBoundingClientRect().width||240),height=width*.75,dpr=Math.min(devicePixelRatio||1,2);
  preview.width=Math.round(width*dpr);preview.height=Math.round(height*dpr);pg.setTransform(dpr,0,0,dpr,0,0);pg.fillStyle='#071821';pg.fillRect(0,0,width,height);
  const unit=Math.min((width-28)/p.w,(height-46)/p.h),ox=(width-p.w*unit)/2,oy=20+(height-44-p.h*unit)/2;
  pg.fillStyle=b.accent;pg.font='9px ui-monospace, monospace';pg.textAlign='left';pg.fillText(p.label.toUpperCase(),12,13);pg.textAlign='right';pg.fillText('+'+p.z+' M',width-12,13);
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){pg.fillStyle=p.cells[y*p.w+x]?'#66878f':p.roof?'#283d42':(Math.floor(y/5)+Math.floor(x/5))%2?'#172f3b':'#1d3742';pg.fillRect(ox+x*unit,oy+y*unit,Math.ceil(unit),Math.ceil(unit));}
  for(const prop of p.props){pg.fillStyle=prop.type==='planter'?'#78a783':prop.type==='bed'?'#9093a5':'#56727b';pg.fillRect(ox+(prop.x/p.tile-.3)*unit,oy+(prop.y/p.tile-.3)*unit,Math.max(2,unit*.6),Math.max(2,unit*.6));}
  const ports=[['lift','L','#dfff6e'],...(selectedFloor===0?[['entry','E','#f2b969']]:[]),...(selectedFloor<b.floors?[['up','↑','#68ddc5']]:[]),...(selectedFloor>0?[['down','↓','#9ac6ff']]:[])];
  pg.font='bold '+Math.max(7,Math.min(10,unit))+'px Arial';pg.textAlign='center';pg.textBaseline='middle';
  for(const[name,label,color]of ports){const q=p.ports[name],x=ox+(q.x+.5)*unit,y=oy+(q.y+.5)*unit;pg.fillStyle='#07131e';pg.fillRect(x-5,y-5,10,10);pg.fillStyle=color;pg.fillText(label,x,y+.5);}
  pg.textBaseline='alphabetic';pg.textAlign='center';pg.font='8px ui-monospace, monospace';pg.fillStyle='#90adb6';pg.fillText('E ENTRY   ↑ UP   ↓ DOWN   L LIFT',width/2,height-9);
 }

 function requestDraw(){if(drawQueued||mode!=='plan')return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;drawAtlas();});}
 function resize(){
  if(mode==='plan'){const rect=atlas.getBoundingClientRect();if(rect.width&&rect.height){size.w=rect.width;size.h=rect.height;size.dpr=Math.min(devicePixelRatio||1,2);atlas.width=Math.round(size.w*size.dpr);atlas.height=Math.round(size.h*size.dpr);if(!cam.fit)fitMap();requestDraw();}}
  inspectorBack.hidden=innerWidth>830;if(selectedBuilding)renderFloor();
 }
 function fitMap(){
  if(!city)return;const rect=atlas.getBoundingClientRect();if(rect.width){size.w=rect.width;size.h=rect.height;}
  const availableW=Math.max(90,size.w-62),availableH=Math.max(100,size.h-235);
  cam.fit=Math.min(availableW/city.size,availableH/city.size);cam.scale=cam.fit;cam.x=city.size/2;cam.y=city.size/2-45/cam.scale;requestDraw();
 }
 const toScreen=(x,y)=>({x:size.w/2+(x-cam.x)*cam.scale,y:size.h/2+(y-cam.y)*cam.scale});
 const toWorld=(x,y)=>({x:cam.x+(x-size.w/2)/cam.scale,y:cam.y+(y-size.h/2)/cam.scale});
 function eventPoint(e){const r=atlas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function zoomAt(factor,sx=size.w/2,sy=size.h/2){
  const p=toWorld(sx,sy),next=clamp(cam.scale*factor,cam.fit*.65,Math.min(10,cam.fit*100));cam.scale=next;cam.x=p.x-(sx-size.w/2)/next;cam.y=p.y-(sy-size.h/2)/next;requestDraw();
 }
 function detail(bx,by){
  const key=bx+','+by;if(detailCache.has(key)){const a=detailCache.get(key);detailCache.delete(key);detailCache.set(key,a);return a;}
  const block=city.block(bx,by),a={buildings:block.buildings.map(b=>({id:b.id,x:b.x,y:b.y,w:b.w,d:b.d,height:b.height,accent:b.accent,landmark:b.landmark})),links:block.links.map(l=>({x:l.x,y:l.y,w:l.w,d:l.d}))};
  detailCache.set(key,a);while(detailCache.size>72)detailCache.delete(detailCache.keys().next().value);return a;
 }
 function heightColor(h,alpha=1){const t=clamp(h/384,0,1);return `rgba(${Math.round(54+195*t)},${Math.round(126+80*t)},${Math.round(143-64*t)},${alpha})`;}
 function atlasCell(x,y){return x<0||y<0||x>=city.n||y>=city.n?null:summary?.atlas[y*city.n+x];}
 function cellDistrict(a){return paintStroke?.zones[a.x+','+a.y]??M.DISTRICTS[a.d].id;}
 function drawAtlas(){
  if(mode!=='plan'||!city)return;g.setTransform(size.dpr,0,0,size.dpr,0,0);g.clearRect(0,0,size.w,size.h);g.fillStyle='#071722';g.fillRect(0,0,size.w,size.h);
  g.strokeStyle='#18303d';g.lineWidth=.5;
  for(let x=0;x<size.w;x+=36){g.beginPath();g.moveTo(x,0);g.lineTo(x,size.h);g.stroke();}for(let y=0;y<size.h;y+=36){g.beginPath();g.moveTo(0,y);g.lineTo(size.w,y);g.stroke();}
  if(!summary)return;
  const layer=$('map-layer').value,bs=M.BLOCK*cam.scale,a=toWorld(0,0),b=toWorld(size.w,size.h);
  const x0=clamp(Math.floor(a.x/M.BLOCK),0,city.n-1),y0=clamp(Math.floor(a.y/M.BLOCK),0,city.n-1),x1=clamp(Math.floor(b.x/M.BLOCK),0,city.n-1),y1=clamp(Math.floor(b.y/M.BLOCK),0,city.n-1);
  const detailed=bs>=22&&(x1-x0+1)*(y1-y0+1)<=72;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const cell=atlasCell(x,y);if(!cell||!cell.t)continue;const p=toScreen(x*M.BLOCK,y*M.BLOCK),d=city.district(cellDistrict(cell));
   g.fillStyle=cell.t===2?'#36515c':'#213744';g.fillRect(p.x,p.y,bs+.5,bs+.5);
   const road=(x%8===0||y%8===0?18:12)*cam.scale,inset=Math.max(.45,road/2);
   g.fillStyle=cell.p?'#28493e':layer==='heights'?heightColor(cell.h,.53):layer==='buildings'?'#182d38':d.color+'52';
   if(cell.t===1)g.fillRect(p.x+inset,p.y+inset,Math.max(.5,bs-inset*2),Math.max(.5,bs-inset*2));
   if(detailed){const q=detail(x,y);
    for(const l of q.links){const u=toScreen(l.x,l.y);g.fillStyle='#9ab8a5';g.fillRect(u.x,u.y,Math.max(1,l.w*cam.scale),Math.max(1,l.d*cam.scale));}
    for(const building of q.buildings){const u=toScreen(building.x,building.y),w=building.w*cam.scale,h=building.d*cam.scale;
     g.fillStyle='#06101988';g.fillRect(u.x+1.5,u.y+2,w,h);g.fillStyle=layer==='heights'?heightColor(building.height):layer==='buildings'?'#8eafa9':building.accent+'ab';g.fillRect(u.x,u.y,w,h);
     if(bs>56){g.strokeStyle='#d2e2d338';g.strokeRect(u.x+.5,u.y+.5,w-1,h-1);}
     if(building.id===selectedBuilding){g.strokeStyle='#efffb0';g.lineWidth=2;g.strokeRect(u.x-2,u.y-2,w+4,h+4);}
     if(bs>170){g.fillStyle='#061821';g.textAlign='center';g.font='10px ui-monospace, monospace';g.fillText(building.height+' m',u.x+w/2,u.y+h/2+3);}
    }
   }else if(cell.n&&bs>5){g.fillStyle=layer==='heights'?heightColor(cell.h):d.color+'b8';const n=cell.n,dot=Math.max(1,bs*.13);for(let j=0;j<n;j++)g.fillRect(p.x+bs*(.28+(j%2)*.3),p.y+bs*(.27+Math.floor(j/2)*.3),dot,dot);}
   // The coastline is generated from real land/water edges, not a background image.
   g.strokeStyle='#608392';g.lineWidth=.75;g.beginPath();
   if(!atlasCell(x-1,y)?.t){g.moveTo(p.x,p.y);g.lineTo(p.x,p.y+bs);}if(!atlasCell(x+1,y)?.t){g.moveTo(p.x+bs,p.y);g.lineTo(p.x+bs,p.y+bs);}
   if(!atlasCell(x,y-1)?.t){g.moveTo(p.x,p.y);g.lineTo(p.x+bs,p.y);}if(!atlasCell(x,y+1)?.t){g.moveTo(p.x,p.y+bs);g.lineTo(p.x+bs,p.y+bs);}g.stroke();
   if(layer==='districts'){g.strokeStyle=d.color+'65';g.lineWidth=1;g.beginPath();const east=atlasCell(x+1,y),south=atlasCell(x,y+1);if(east?.t&&cellDistrict(east)!==d.id){g.moveTo(p.x+bs,p.y);g.lineTo(p.x+bs,p.y+bs);}if(south?.t&&cellDistrict(south)!==d.id){g.moveTo(p.x,p.y+bs);g.lineTo(p.x+bs,p.y+bs);}g.stroke();}
  }
  const origin=toScreen(0,0);g.strokeStyle='#43616c';g.lineWidth=1;g.setLineDash([4,5]);g.strokeRect(origin.x,origin.y,city.size*cam.scale,city.size*cam.scale);g.setLineDash([]);
  if(cam.scale<cam.fit*5){
   for(const d of M.DISTRICTS){const an=city.anchor(d.id),p=toScreen(an.x,an.y);if(p.x<35||p.y<20||p.x>size.w-35||p.y>size.h-25)continue;
    g.font='bold '+(size.w<300?9:11)+'px ui-monospace, monospace';g.textAlign='center';const label=d.name.toUpperCase(),tw=g.measureText(label).width;
    g.fillStyle='#071722ec';g.fillRect(p.x-tw/2-8,p.y-10,tw+16,22);g.fillStyle=d.color;g.fillText(label,p.x,p.y+4);
    if(size.w>420&&cam.scale<cam.fit*2.2){g.font='9px ui-monospace, monospace';g.fillStyle='#b1c7c9';g.fillText(fmt.format(summary.districts[d.id].buildings)+' BUILDINGS',p.x,p.y+17);}
   }
  }
  if(selectedBlock){const p=toScreen(selectedBlock.bx*M.BLOCK,selectedBlock.by*M.BLOCK);g.strokeStyle='#e5ff88';g.lineWidth=2;g.strokeRect(p.x-1,p.y-1,bs+2,bs+2);if(bs<14){g.beginPath();g.moveTo(p.x-5,p.y+bs/2);g.lineTo(p.x+bs+5,p.y+bs/2);g.moveTo(p.x+bs/2,p.y-5);g.lineTo(p.x+bs/2,p.y+bs+5);g.stroke();}}
  if(hover&&$('paint-toggle').checked){const r=+$('brush-size').value,p=toScreen((hover.bx-r)*M.BLOCK,(hover.by-r)*M.BLOCK);g.fillStyle=district().color+'25';g.strokeStyle=district().color;g.lineWidth=2;g.fillRect(p.x,p.y,bs*(2*r+1),bs*(2*r+1));g.strokeRect(p.x,p.y,bs*(2*r+1),bs*(2*r+1));}
  g.fillStyle='#91aeb9';g.textAlign='center';g.font='10px ui-monospace, monospace';g.fillText('N',size.w-27,35);g.strokeStyle='#91aeb9';g.lineWidth=1;g.beginPath();g.moveTo(size.w-27,43);g.lineTo(size.w-27,66);g.moveTo(size.w-31,49);g.lineTo(size.w-27,42);g.lineTo(size.w-23,49);g.stroke();
  if(layer==='heights'){const h=Math.min(150,size.w-40),x=size.w-h-20,y=size.h-102;for(let i=0;i<h;i++){g.fillStyle=heightColor(i/h*384);g.fillRect(x+i,y,1,5);}g.fillStyle='#adc1c7';g.font='9px ui-monospace, monospace';g.textAlign='left';g.fillText('LOW',x,y+18);g.textAlign='right';g.fillText('384 M',x+h,y+18);}
  const desired=90/cam.scale,power=10**Math.floor(Math.log10(desired)),v=desired/power,n=v>=5?5:v>=2?2:1,metres=n*power;
  $('scale-bar').querySelector('i').style.width=Math.round(metres*cam.scale)+'px';$('scale-bar').querySelector('span').textContent=metres>=1000?(metres/1000)+' km':Math.round(metres)+' m';
  $('map-tip').textContent=$('paint-toggle').checked?'Paint '+district().name+'. Drag to paint; right-drag to pan.':layer==='buildings'&&!detailed?'Zoom in to inspect exact building footprints.':'Click a block to inspect it. Double-click to zoom in.';
 }

 function paintAt(bx,by){
  if(!paintStroke)return;const radius=+$('brush-size').value;
  const dab=(cx,cy)=>{for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=city.n||y>=city.n||city.terrain(x,y)==='water')continue;const key=x+','+y;if(paintStroke.zones[key]!==selectedDistrict){paintStroke.zones[key]=selectedDistrict;paintStroke.changed=true;}}};
  const last=paintStroke.last;if(last){const steps=Math.max(Math.abs(bx-last.bx),Math.abs(by-last.by),1);for(let i=1;i<=steps;i++)dab(Math.round(last.bx+(bx-last.bx)*i/steps),Math.round(last.by+(by-last.by)*i/steps));}else dab(bx,by);
  paintStroke.last={bx,by};requestDraw();
 }
 function finishPaint(){
  if(!paintStroke)return;const stroke=paintStroke;paintStroke=null;
  if(stroke.changed){const config=copy(stroke.before);config.zones=stroke.zones;applyConfig(config,{before:stroke.before,message:'District areas updated. One stroke can be undone.'});}else requestDraw();
 }
 atlas.addEventListener('contextmenu',e=>e.preventDefault());
 atlas.addEventListener('pointerdown',e=>{
  if(busy||!summary)return;e.preventDefault();atlas.focus({preventScroll:true});const p=eventPoint(e);pointers.set(e.pointerId,p);atlas.setPointerCapture(e.pointerId);
  if(pointers.size===2){finishPaint();const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};pinch={distance:Math.hypot(b.x-a.x,b.y-a.y),scale:cam.scale,world:toWorld(mid.x,mid.y)};pointer=null;return;}
  pointer={id:e.pointerId,start:p,last:p,moved:false,paint:$('paint-toggle').checked&&e.button!==2};
  if(pointer.paint){paintStroke={before:city.export(),zones:{...city.config.zones},changed:false,last:null};const w=toWorld(p.x,p.y);paintAt(Math.floor(w.x/M.BLOCK),Math.floor(w.y/M.BLOCK));}else atlas.style.cursor='grabbing';
 });
 atlas.addEventListener('pointermove',e=>{
  const p=eventPoint(e),w=toWorld(p.x,p.y);hover={bx:Math.floor(w.x/M.BLOCK),by:Math.floor(w.y/M.BLOCK)};
  $('map-coordinate').textContent=`${fmt.format(Math.round(w.x))} E / ${fmt.format(Math.round(city.size-w.y))} N`;
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
  if(pinch&&pointers.size>=2){const[a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance=Math.hypot(b.x-a.x,b.y-a.y);cam.scale=clamp(pinch.scale*distance/Math.max(1,pinch.distance),cam.fit*.65,Math.min(10,cam.fit*100));cam.x=pinch.world.x-(mid.x-size.w/2)/cam.scale;cam.y=pinch.world.y-(mid.y-size.h/2)/cam.scale;requestDraw();return;}
  if(pointer&&pointer.id===e.pointerId){if(Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>4)pointer.moved=true;
   if(pointer.paint)paintAt(hover.bx,hover.by);else if(pointer.moved){cam.x-=(p.x-pointer.last.x)/cam.scale;cam.y-=(p.y-pointer.last.y)/cam.scale;requestDraw();}pointer.last=p;
  }else if($('paint-toggle').checked)requestDraw();
 });
 function endPointer(e){
  const p=eventPoint(e);pointers.delete(e.pointerId);
  if(pinch){pinch=null;pointer=null;atlas.style.cursor='crosshair';return;}
  if(pointer?.id===e.pointerId){if(pointer.paint)finishPaint();else if(!pointer.moved&&e.type!=='pointercancel'){const w=toWorld(p.x,p.y);selectBlock(Math.floor(w.x/M.BLOCK),Math.floor(w.y/M.BLOCK),{x:w.x,y:w.y});}pointer=null;}
  atlas.style.cursor='crosshair';
 }
 atlas.addEventListener('pointerup',endPointer);atlas.addEventListener('pointercancel',endPointer);
 atlas.addEventListener('pointerleave',()=>{if(!pointer){hover=null;requestDraw();}});
 atlas.addEventListener('wheel',e=>{e.preventDefault();const p=eventPoint(e);zoomAt(Math.exp(-clamp(e.deltaY,-100,100)*.0035),p.x,p.y);},{passive:false});
 atlas.addEventListener('dblclick',e=>{if($('paint-toggle').checked)return;const p=eventPoint(e);zoomAt(2,p.x,p.y);});
 atlas.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.code],b=selectedBlock||{bx:0,by:0};selectBlock(clamp(b.bx+d[0],0,city.n-1),clamp(b.by+d[1],0,city.n-1),{open:false});const p=toScreen((selectedBlock.bx+.5)*M.BLOCK,(selectedBlock.by+.5)*M.BLOCK);if(p.x<25||p.y<175||p.x>size.w-25||p.y>size.h-70){cam.x=(selectedBlock.bx+.5)*M.BLOCK;cam.y=(selectedBlock.by+.5)*M.BLOCK;requestDraw();}}
  if(e.code==='Enter'){e.preventDefault();showWalk({block:selectedBlock,floor:-1});}if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1.5);}if(e.key==='-'){e.preventDefault();zoomAt(1/1.5);}if(e.code==='Home'){e.preventDefault();fitMap();}
 });

 $('generate-button').addEventListener('click',()=>applyConfig(readControls(),{message:'City generated. Every building and floor uses the saved seed.'}));
 for(const id of ['city-seed','city-size','city-density','city-height','city-bridges'])$(id).addEventListener('input',()=>{$('save-state').textContent='Generate to apply changes';$('height-value').textContent=(+$('city-height').value).toFixed(2)+'×';});
 $('city-seed').addEventListener('keydown',e=>{if(e.key==='Enter'&&!busy){e.preventDefault();$('generate-button').click();}});
 $('district-density').addEventListener('input',()=>{$('district-density').title=Math.round(+$('district-density').value*100)+'% of plots';});
 $('apply-district').addEventListener('click',()=>{const min=+$('district-min').value,max=+$('district-max').value;if(!Number.isInteger(min)||!Number.isInteger(max)||min<2||min>90||max<min||max>96){notify('Use a minimum of 2–90 floors and a maximum between that minimum and 96.');return;}const c=city.export();c.rules[selectedDistrict]={density:+$('district-density').value,min,max};applyConfig(c,{message:district().name+' rules updated.'});});
 $('apply-building').addEventListener('click',()=>{if(!selectedBuilding)return;const floors=+$('building-floors').value;if(!Number.isInteger(floors)||floors<2||floors>100){notify('Choose a whole number from 2 to 100 floors.');$('building-floors').focus();return;}const c=city.export();c.buildings[selectedBuilding]={...(c.buildings[selectedBuilding]||{}),floors,type:$('building-type').value};applyConfig(c,{message:'Building rebuilt. Roof links remain where the two roof heights match.'});});
 $('undo-button').addEventListener('click',()=>{if(busy||!history.length)return;const c=history.pop();$('undo-button').disabled=!history.length;applyConfig(c,{record:false,message:'The last city edit was undone.'});});
 $('paint-toggle').addEventListener('change',()=>{hover=null;requestDraw();notify($('paint-toggle').checked?'Select a district, then paint the city. Right-drag pans the map.':'District painting is off. Drag the map to pan.');});
 $('brush-size').addEventListener('change',requestDraw);$('map-layer').addEventListener('change',requestDraw);$('map-fit').addEventListener('click',fitMap);$('zoom-in').addEventListener('click',()=>zoomAt(1.65));$('zoom-out').addEventListener('click',()=>zoomAt(1/1.65));
 $('inspect-floor').addEventListener('change',()=>{selectedFloor=+$('inspect-floor').value;renderFloor();});
 $('visit-block').addEventListener('click',()=>showWalk({block:selectedBlock,floor:-1}));
 $('visit-floor').addEventListener('click',()=>{if(selectedBuilding)showWalk({block:selectedBlock,buildingId:selectedBuilding,floor:selectedFloor});});
 $('visit-roof').addEventListener('click',()=>{const b=city.building(selectedBuilding);if(b)showWalk({block:selectedBlock,buildingId:b.id,floor:b.floors});});
 $('visit-exterior').addEventListener('click',()=>{const b=city.building(selectedBuilding);if(b)showWalk({block:selectedBlock,buildingId:b.id,floor:selectedFloor,exterior:true});});
 $('plan-mode').addEventListener('click',showPlan);$('return-plan').addEventListener('click',showPlan);$('walk-mode').addEventListener('click',()=>showWalk());
 $('export-button').addEventListener('click',()=>{const data=JSON.stringify(city.export(),null,2)+'\n',url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='meridian-'+city.seed.replace(/[^a-z0-9_-]+/gi,'-').slice(0,48)+'-'+city.config.sizeKm+'km.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('City configuration exported. It recreates every block and floor.');});
 $('import-button').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',async()=>{const file=$('import-file').files?.[0];if(!file)return;try{if(file.size>MAX_IMPORT)throw new Error('Choose a city JSON file smaller than 2 MB.');const raw=JSON.parse(await file.text());if(!raw||Array.isArray(raw)||typeof raw!=='object'||raw.version!==M.VERSION)throw new Error('This file must be a Meridian city configuration, version '+M.VERSION+'.');const c=M.normalize(raw);applyConfig(c,{fit:true,message:'City imported. Its seed, rules, and edits are now saved in this browser.'});}catch(error){notify(error instanceof SyntaxError?'That file is not valid JSON.':error.message);}finally{$('import-file').value='';}});

 function help(){
  const t=summary?.totals,envelope=city.config.sizeKm**2,land=t?(t.landM2/1e6).toFixed(1):'—',open=t?(t.openGroundM2/1e6).toFixed(1):'—';
  dialog({kicker:'CITY KIT / FIELD GUIDE',title:'A city has more than one level.',html:`<p>Meridian is a seeded city generator and a walkable city model. The <strong>${city.config.sizeKm} × ${city.config.sizeKm} km envelope</strong> covers ${envelope} km², including water. This city contains <strong>${land} km² of land</strong> and ${open} km² of ground outside building footprints. Those measures are different from interior floor area.</p><p>Perspective view makes distant objects smaller. Right-drag to look, or use Q and R to turn. Eye level places the camera at head height. Classic retains the original isometric view.</p><p>Use RIDE EXTERIOR LIFT in the building inspector to travel outside its wall. You can set a building to 100 floors for a 400-metre ascent.</p><p>Each occupied plot contains a building. Its full schedule of floors is generated from the seed. Stairs, lifts, and roofs use real height. Suitable roofs share bridges only when their heights match.</p><div class="guide-grid"><kbd>DRAG / WHEEL</kbd><span>Pan and zoom the city plan.</span><kbd>CLICK A BLOCK</kbd><span>Inspect its buildings. Choose a level or roof, then enter it.</span><kbd>PAINT DISTRICTS</kbd><span>Select a district and paint land blocks. One stroke is one Undo step.</span><kbd>WASD / ARROWS</kbd><span>Move on the active street, floor, or roof.</span><kbd>SHIFT</kbd><span>Run while moving.</span><kbd>CLICK</kbd><span>Walk toward a point on the current surface.</span><kbd>E / USE</kbd><span>Enter a building, use stairs, or select a lift destination.</span><kbd>M</kbd><span>Switch between exploration and the city plan.</span></div><p>Editor changes save on this browser after you apply them. Export a small JSON configuration to share or keep the city. Import restores the same seed and edits. Buildings contain generated room layouts and equipment; city exploration is separate from <a href="../game/index.html">The Ninth Relay mission</a>.</p>`,buttons:[{label:mode==='walk'?'RESUME EXPLORATION':'BACK TO CITY',primary:true}]});
 }
 $('help-button').addEventListener('click',help);
 document.addEventListener('keydown',e=>{
  if(dialogOpen){if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeDialog();return;}if(e.code==='Tab'){const all=Array.from($('dialog-wrap').querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(el=>!el.disabled&&el.getClientRects().length),first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.target?.isContentEditable;
  if(!typing&&e.code==='KeyM'){e.preventDefault();e.stopImmediatePropagation();if(mode==='walk')showPlan();else showWalk();}
  else if(!typing&&e.code==='F1'){e.preventDefault();help();}
  else if(mode==='plan'&&!typing&&(e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();$('undo-button').click();}
 },true);
 root.addEventListener('resize',resize);
 if(typeof ResizeObserver!=='undefined'){const ro=new ResizeObserver(()=>resize());ro.observe($('plan-stage'));}
 root.MeridianUI={get city(){return city;},notify,dialog,closeDialog,showPlan,showWalk,onPlayerUpdate};
 let initial=M.defaultConfig(),loadNotice='';
 try{const saved=localStorage.getItem(STORE);if(saved){initial=M.normalize(JSON.parse(saved));loadNotice='Your saved city is ready.';}}catch(_){loadNotice='The saved configuration could not be read. The default city is ready.';}
 city=new M.City(initial);try{const saved=JSON.parse(localStorage.getItem('static-veil-city-position-v1')||'null');if(saved&&saved.version===1&&saved.seed===city.seed&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.x>=0&&saved.y>=0&&saved.x<=city.size&&saved.y<=city.size){lastPlayer=saved;lastPlayerCity=city;}}catch(_){}const anchor=city.anchor('tideward');selectedBlock={bx:anchor.bx,by:anchor.by};selectedBuilding=city.block(anchor.bx,anchor.by).buildings[0]?.id||null;
 updateMode('plan');syncControls();renderDistricts();refreshInspector();resize();saveConfig();requestSummary({fit:true,message:loadNotice});
})(window);
