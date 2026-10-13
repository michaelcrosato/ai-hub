/* World Forge: atlas, sparse edits, project files, and expedition handoff. */
(function(root){
 'use strict';
 const W=root.EWWorld,X=root.EWExpedition,$=id=>document.getElementById(id);
 const show=(id,on=true)=>$(id).classList.toggle('hidden',!on),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canvas=$('atlas-canvas'),ctx=canvas.getContext('2d'),stage=$('map-stage');
 let world=null,expedition=null,frontier=null,view={x:4096,y:4096,span:8192},selection=null,mode='atlas',tool='inspect',layer='terrain',showSites=true,showGrid=false;
 let mapImage=null,mapBounds=null,sites=[],worker=null,requestId=0,pending=null,workerSupported=typeof Worker!=='undefined',redrawTimer=0,toastTimer=0,saveTimer=0,dirty=false,dialogCallback=null,dialogReturn=null;
 let width=640,height=480,dpr=1,drag=null,stroke=null,undo=[],redo=[],protectedTiles=new Set(),savedView=null;
 const counts=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
 const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'world';
 function notify(message){$('forge-toast').textContent=message;show('forge-toast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('forge-toast',false),4500);}
 function title(seed){return seed.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
 function configFromControls(){return W.normalizeConfig({seed:$('world-seed').value.trim()||'the-long-morning',size:Number($('world-size').value),seaLevel:Number($('sea-level').value)/100,ruggedness:Number($('ruggedness').value)/100,moisture:Number($('moisture').value)/100,siteDensity:Number($('site-density').value)/100});}
 function updateRanges(){for(const [id,out] of [['sea-level','sea-value'],['ruggedness','rugged-value'],['moisture','moisture-value'],['site-density','density-value']])$(out).textContent=$(id).value+'%';}
 function fillControls(config){$('world-seed').value=config.seed;$('world-size').value=String(config.size);$('sea-level').value=Math.round(config.seaLevel*100);$('ruggedness').value=Math.round(config.ruggedness*100);$('moisture').value=Math.round(config.moisture*100);$('site-density').value=Math.round(config.siteDensity*100);updateRanges();}
 function fitView(w=world){const size=w.config.size;return {x:size/2,y:size/2,span:Math.min(size*2,size*Math.max(1,width/height))};}
 function bounds(v=view){return {x:v.x-v.span/2,y:v.y-v.span*height/width/2,width:v.span,height:v.span*height/width};}
 function screenPoint(x,y,b=bounds()){return [(x-b.x)/b.width*width,(y-b.y)/b.height*height];}
 function worldPoint(px,py,b=bounds()){return {x:b.x+px/width*b.width,y:b.y+py/height*b.height};}
 function localPoint(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*width/rect.width,y:(event.clientY-rect.top)*height/rect.height};}
 function constrainView(){if(!world)return;view.x=clamp(view.x,0,world.config.size);view.y=clamp(view.y,0,world.config.size);view.span=clamp(view.span,16,world.config.size*2);}
 function isGenerating(){return !!pending?.replace;}
 function setBusy(on,replace=false){show('map-busy',on);show('cancel-generation',on);$('generate-world').disabled=replace;$('map-busy-label').textContent=replace?'Charting a new world…':'Surveying this view…';$('generation-status').textContent=on?(replace?'Generating terrain, rivers, roads, and locations.':'Updating the atlas. Your world remains editable.'):world?'Same seed and settings. Same world.':'';}
 function cancelRender(notice=false){requestId++;if(worker){worker.terminate();worker=null;}pending=null;clearTimeout(redrawTimer);setBusy(false);if(notice)notify(world?'Generation canceled. Your current world is intact.':'Generation canceled. Choose Generate world to begin.');}
 function requestMap(options={}){
  const target=options.world||world;if(!target)return;
  if(isGenerating()&&!options.replace)return;
  if(worker){worker.terminate();worker=null;}
  const v=options.view||view,id=++requestId,b=bounds(v),pw=clamp(Math.round(width),160,640),ph=clamp(Math.round(pw*height/width),120,640);
  const q={id,recipe:target.exportRecipe(),width:pw,height:ph,bounds:b,layer};
  pending={id,world:target,view:{...v},layer,replace:!!options.replace,expedition:options.expedition||null,restore:!!options.restore};setBusy(true,!!options.replace);
  const success=data=>{if(!pending||data.id!==requestId)return;if(data.error){fail(data.error);return;}
   const job=pending;pending=null;if(worker){worker.terminate();worker=null;}
   if(job.replace){world=job.world;expedition=job.expedition;view=job.view;undo=[];redo=[];selection=expedition?{x:Math.floor(expedition.state.position.x),y:Math.floor(expedition.state.position.y)}:world.findSpawn();fillControls(world.config);updateProtected();if(frontier)frontier.setExpedition(world,expedition);}
   mapImage=document.createElement('canvas');mapImage.width=data.width;mapImage.height=data.height;const g=mapImage.getContext('2d');g.putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);mapBounds=data.bounds;sites=data.sites||[];
   $('stat-land').textContent=Math.round(data.land*100)+'%';$('stat-land').title='Land among the sampled points in the current view; not a whole-world census.';
   $('stat-sites').textContent=sites.length>=400?'400+':String(sites.length);$('atlas-title').textContent=title(world.config.seed);$('stat-tiles').textContent=counts(world.config.size**2);$('stat-tiles').title=(world.config.size**2).toLocaleString()+' possible tiles';
   setBusy(false);render();renderInspector();renderLocations();renderRecord();updateEditControls();updateStats();
   if(job.replace){markDirty();$('generation-status').textContent=job.restore?'Saved world restored.':'World ready. Select land, paint terrain, or start an expedition.';if(job.restore)notify('World and expedition checkpoint restored.');}
   if(job.layer!==layer)requestMap();
  };
  const fail=message=>{if(id!==requestId)return;if(worker){worker.terminate();worker=null;}pending=null;setBusy(false);$('generation-status').textContent='Could not generate the atlas. '+message;notify('Atlas generation failed. '+message);};
  if(workerSupported){try{worker=new Worker('world-worker.js');worker.onmessage=e=>success(e.data);worker.onerror=e=>{e.preventDefault?.();if(id!==requestId)return;worker?.terminate();worker=null;workerSupported=false;fallbackPreview(q,target).then(success).catch(e=>fail(e.message));};worker.postMessage(q);}catch(error){workerSupported=false;fallbackPreview(q,target).then(success).catch(e=>fail(e.message));}}
  else fallbackPreview(q,target).then(success).catch(e=>fail(e.message));
 }
 // Compatibility path: small batches yield to input. Normal browsers use the worker.
 async function fallbackPreview(q,target){
  const w=Math.min(360,q.width),h=Math.max(64,Math.round(q.height*w/q.width)),pixels=new Uint8ClampedArray(w*h*4),b=q.bounds;let land=0,inside=0;
  const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)],mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  for(let y=0;y<h;y++){
   if(q.id!==requestId)throw Error('Canceled');
   for(let x=0;x<w;x++){
    const t=target.sample(b.x+(x+.5)/w*b.width,b.y+(y+.5)/h*b.height);let c=[12,28,36];
    if(!t.outside){inside++;if(t.biome!=='ocean')land++;if(q.layer==='height')c=mix([20,42,64],[236,226,196],t.height);else if(q.layer==='moisture')c=mix([181,137,77],[48,125,154],t.moisture);else if(q.layer==='danger')c=mix([62,127,111],[204,89,68],clamp(t.danger/5,0,1));else{c=rgb(W.BIOMES[t.biome].color);if(t.river)c=mix(c,[57,125,152],.8);if(t.road&&b.width/w<5)c=mix(c,[218,177,113],.88);}}
    const i=(y*w+x)*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255;
   }if(y%12===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  const bins=[];for(let y=0;y<10;y++)for(let x=0;x<10;x++)bins.push(target.sitesInRect(Math.floor(b.x+b.width*x/10),Math.floor(b.y+b.height*y/10),Math.floor(b.x+b.width*(x+1)/10)-1,Math.floor(b.y+b.height*(y+1)/10)-1,4));
  const locations=[...new Map(bins.flat().map(s=>[s.id,s])).values()].slice(0,400);
  return {id:q.id,width:w,height:h,pixels:pixels.buffer,bounds:b,land:inside?land/inside:0,sites:locations};
 }
 function scheduleMap(){if(isGenerating())return;render();clearTimeout(redrawTimer);redrawTimer=setTimeout(()=>requestMap(),100);}
 function resize(){const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;width=Math.max(1,Math.round(r.width));height=Math.max(1,Math.round(r.height));dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(world){constrainView();scheduleMap();}else render();}
 function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c1c24';ctx.fillRect(0,0,width,height);const b=bounds();
  if(mapImage&&mapBounds){ctx.imageSmoothingEnabled=false;const p=screenPoint(mapBounds.x,mapBounds.y,b);ctx.drawImage(mapImage,p[0],p[1],mapBounds.width/b.width*width,mapBounds.height/b.height*height);}
  if(!world){ctx.fillStyle='#bdcdbf';ctx.font='18px Georgia';ctx.textAlign='center';ctx.fillText('A world waits for its seed.',width/2,height/2);return;}
  if(showGrid&&b.width/width<=1){const step=b.width/width<.14?1:b.width/width<.5?8:32;ctx.strokeStyle='#122a3280';ctx.lineWidth=1;ctx.beginPath();for(let x=Math.ceil(b.x/step)*step;x<b.x+b.width;x+=step){const p=screenPoint(x,0,b);ctx.moveTo(Math.round(p[0])+.5,0);ctx.lineTo(Math.round(p[0])+.5,height);}for(let y=Math.ceil(b.y/step)*step;y<b.y+b.height;y+=step){const p=screenPoint(0,y,b);ctx.moveTo(0,Math.round(p[1])+.5);ctx.lineTo(width,Math.round(p[1])+.5);}ctx.stroke();}
  if(showSites){for(const f of sites){const p=screenPoint(f.x+.5,f.y+.5,b);if(p[0]<-8||p[1]<-8||p[0]>width+8||p[1]>height+8)continue;ctx.fillStyle=f.kind==='settlement'?'#f2d495':f.kind==='relay'?'#99dec7':'#d1d8c6';ctx.strokeStyle='#142d37';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p[0],p[1]-4);ctx.lineTo(p[0]+4,p[1]);ctx.lineTo(p[0],p[1]+4);ctx.lineTo(p[0]-4,p[1]);ctx.closePath();ctx.stroke();ctx.fill();if(view.span<900){ctx.font='11px Georgia';ctx.textAlign='left';ctx.strokeStyle='#122a33';ctx.lineWidth=3;ctx.strokeText(f.name,p[0]+8,p[1]+4);ctx.fillText(f.name,p[0]+8,p[1]+4);}}}
  if(expedition){
   const s=expedition.state;for(const f of [{...s.camp,name:'Camp',camp:true},...s.nodes]){const p=screenPoint(f.x+.5,f.y+.5,b);ctx.fillStyle=f.completed?'#9fe6c3':f.camp?'#fff2c7':'#efb85e';ctx.strokeStyle='#0b2630';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],f.camp?6:5,0,Math.PI*2);ctx.stroke();ctx.fill();if(view.span<500){ctx.font='12px Georgia';ctx.textAlign='left';ctx.lineWidth=4;ctx.strokeText(f.name,p[0]+10,p[1]+4);ctx.fillText(f.name,p[0]+10,p[1]+4);}}
   const p=screenPoint(s.position.x,s.position.y,b);ctx.strokeStyle='#fdf3d1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],9,0,Math.PI*2);ctx.stroke();
  }
  if(selection){const p=screenPoint(selection.x+.5,selection.y+.5,b),r=Math.max(7,width/b.width*.55);ctx.strokeStyle='#ffdda0';ctx.lineWidth=1.5;ctx.strokeRect(p[0]-r,p[1]-r,r*2,r*2);ctx.beginPath();ctx.moveTo(p[0]-r-5,p[1]);ctx.lineTo(p[0]-r+2,p[1]);ctx.moveTo(p[0]+r-2,p[1]);ctx.lineTo(p[0]+r+5,p[1]);ctx.stroke();}
  const scale=10**Math.floor(Math.log10(Math.max(1,b.width/6))),scalePixels=scale/b.width*width;ctx.fillStyle='#e5dfc6';ctx.strokeStyle='#e5dfc6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(18,height-45);ctx.lineTo(18+scalePixels,height-45);ctx.stroke();ctx.font='9px system-ui';ctx.textAlign='left';ctx.fillText(scale.toLocaleString()+' tiles',18,height-52);
  $('map-scale').textContent=Math.round(view.span).toLocaleString()+' tiles across · '+(world.config.size/Math.max(1,view.span)).toFixed(1)+'×';
 }
 function inspect(x,y){if(!world)return;const tx=Math.floor(x),ty=Math.floor(y);if(tx<0||ty<0||tx>=world.config.size||ty>=world.config.size){notify('That point is outside this world.');return;}selection={x:tx,y:ty};renderInspector();render();}
 function renderInspector(){
  if(!world||!selection)return;const t=world.tile(selection.x,selection.y),biome=W.BIOMES[t.biome],edit=world.getOverride(t.x,t.y),f=t.feature;
  $('selection-tag').textContent=t.x.toLocaleString()+' · '+t.y.toLocaleString();
  $('tile-inspector').innerHTML='<h2>'+esc(f?.name||biome.label)+'</h2><p class="small muted">'+esc(f?.description||biome.description)+'</p><div class="tile-meta"><div><span>Elevation</span><strong>'+Math.round(t.height*100)+' / 100</strong></div><div><span>Moisture</span><strong>'+Math.round(t.moisture*100)+'%</strong></div><div><span>Temperature</span><strong>'+Math.round(t.temperature*100)+' / 100</strong></div><div><span>Danger</span><strong>'+t.danger+' / 5</strong></div><div><span>Travel</span><strong>'+(t.passable?'Passable':'Blocked')+'</strong></div><div><span>Chunk</span><strong>'+Math.floor(t.x/32)+', '+Math.floor(t.y/32)+'</strong></div></div><div>'+(t.road?'<span class="terrain-tag">'+(t.biome==='ocean'||t.river?'Bridge':'Road')+'</span>':'')+(t.river?'<span class="terrain-tag">River</span>':'')+(edit?'<span class="terrain-tag">Edited</span>':'')+(protectedTiles.has(t.x+','+t.y)?'<span class="terrain-tag">Expedition route</span>':'')+'</div>';
  $('deploy-selected').disabled=!t.passable||isGenerating();$('deploy-selected').textContent=t.passable?'Explore this region ↗':'Choose a passable tile';$('export-chunk').disabled=false;
  $('map-coordinate').textContent=t.x.toLocaleString()+', '+t.y.toLocaleString()+' · '+biome.label;
 }
 function renderLocations(){
  $('location-count').textContent=sites.length>=400?'400+':String(sites.length);
  $('location-list').innerHTML=(sites.length?sites.slice(0,50).map(f=>'<button class="location-card" data-site-x="'+f.x+'" data-site-y="'+f.y+'"><strong>'+esc(f.name)+'</strong><small>'+esc(f.kind)+' · '+f.x+', '+f.y+'</small></button>').join(''):'<p class="muted small">No named locations in this view. Pan or zoom out to search another region.</p>')+(sites.length>50?'<p class="muted small">Showing 50 of '+sites.length+' atlas markers. Zoom in for local detail.</p>':'');
 }
 function updateProtected(){protectedTiles=new Set(expedition?X.makePaths(expedition.state.camp,expedition.state.nodes).map(p=>p.x+','+p.y):[]);}
 function renderRecord(){
  show('resume-expedition',!!expedition);$('explore-mode').disabled=!expedition;show('expedition-record',!!expedition);if(!expedition)return;
  const s=expedition.state;$('expedition-record').innerHTML='<h3>'+(s.completed?'Expedition complete':'Your expedition')+'</h3><p>'+s.stats.renown+' renown · '+s.stats.surveys+' locations surveyed</p><ol>'+s.nodes.map(n=>'<li style="color:'+(n.completed?'#a9dfc2':'inherit')+'">'+esc(n.name)+(n.completed?' · online':'')+'</li>').join('')+'</ol><p>Camp: '+s.camp.x+', '+s.camp.y+'. Its route tiles are protected while this expedition is current.</p><button class="quiet" data-clear-expedition>Close expedition</button>';
 }
 function updateStats(){if(world){const s=world.stats();$('stat-chunks').textContent=s.chunks+' / 64';$('stat-chunks').title=s.tiles.toLocaleString()+' cached terrain tiles · '+s.macroCells+' cached region cells';}}
 function markDirty(){dirty=true;$('save-status').textContent='Unsaved changes';clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProject(false),1100);renderRecord();}
 function saveProject(notice=true){
  if(!world){if(notice)notify('Generate a world first.');return false;}
  try{localStorage.setItem(X.STORAGE_KEY,JSON.stringify(X.exportProject(world,expedition,view)));dirty=false;$('save-status').textContent=frontier?.isInBattle?'Encounter checkpoint saved':'Saved on this device';if(notice)notify(frontier?.isInBattle?'Saved the start of this encounter.':'World, edits, and expedition saved on this device.');return true;}
  catch(e){$('save-status').textContent='Save unavailable · export JSON';if(notice||dirty)notify('This device could not save the world. Export JSON to keep a copy.');return false;}
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
 function exportProject(){if(!world)return;download(new Blob([JSON.stringify(X.exportProject(world,expedition,view),null,2)],{type:'application/json'}),'emberwake-'+slug(world.config.seed)+'.json');notify(frontier?.isInBattle?'Exported the world and encounter checkpoint.':'Exported the world recipe, edits, and expedition.');}
 function exportChunk(){if(!world||!selection)return;const x=Math.floor(selection.x/32)*32,y=Math.floor(selection.y/32)*32,tiles=[];for(let ty=y;ty<y+32;ty++)for(let tx=x;tx<x+32;tx++)tiles.push(world.tile(tx,ty));download(new Blob([JSON.stringify({format:'emberwake-chunk',version:1,config:world.config,origin:{x,y},width:32,height:32,tiles},null,2)],{type:'application/json'}),'emberwake-chunk-'+x+'-'+y+'.json');updateStats();notify('Exported the selected 32 × 32 terrain chunk.');}
 function exportMap(){
  if(!world||!mapImage||pending){notify('Wait for the atlas to finish drawing.');return;}
  const out=document.createElement('canvas'),scale=Math.min(2,1600/width);out.width=Math.round(width*scale);out.height=Math.round(height*scale+90);const g=out.getContext('2d');g.fillStyle='#10262d';g.fillRect(0,0,out.width,out.height);g.imageSmoothingEnabled=false;g.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,out.width,Math.round(height*scale));g.fillStyle='#e9d5ab';g.font='24px Georgia';g.fillText('EMBERWAKE · '+title(world.config.seed).slice(0,60),24,out.height-51);g.fillStyle='#a8c5b7';g.font='12px system-ui';g.fillText(world.config.size.toLocaleString()+' × '+world.config.size.toLocaleString()+' tiles · '+layer+' layer · generator v1',24,out.height-25);out.toBlob(blob=>{if(blob)download(blob,'emberwake-'+slug(world.config.seed)+'-atlas.png');else notify('The map could not be exported.');},'image/png');
 }
 function openDialog(html,callback){dialogReturn=document.activeElement;dialogCallback=callback;$('forge-dialog').innerHTML='<div class="dialog-card">'+html+'</div>';const heading=$('forge-dialog').querySelector('h2');if(heading){heading.id='forge-dialog-title';$('forge-dialog').setAttribute('aria-labelledby',heading.id);}show('forge-dialog');$('forge-dialog').querySelector('button,select,input')?.focus({preventScroll:true});}
 function closeDialog(){show('forge-dialog',false);dialogCallback=null;dialogReturn?.focus?.({preventScroll:true});}
 function canReplace(){if(frontier?.isInBattle){notify('Finish the encounter, or retreat to camp, before replacing the world.');return false;}return true;}
 function generate(config){
  if(!canReplace())return false;
  try{const next=new W.World(config||configFromControls());setMode('atlas');requestMap({world:next,view:fitView(next),replace:true});return true;}catch(e){notify(e.message);return false;}
 }
 function askGenerate(){
  if(!canReplace())return;const config=configFromControls();
  if(world&&(world.exportRecipe().overrides.length||expedition)){openDialog('<div class="eyebrow">NEW WORLD</div><h2>Chart another world?</h2><p>Your current world has terrain edits or an expedition. Export JSON first if you want to keep it. The new world will use the settings shown in the left panel.</p><div class="dialog-buttons"><button data-dialog="export">Export current world</button><button class="primary" data-dialog="generate">Generate new world</button><button data-dialog="cancel">Keep current world</button></div>',action=>{if(action==='export'){exportProject();return;}if(action==='generate'){closeDialog();generate(config);}else closeDialog();});}
  else generate(config);
 }
 function importData(data){if(!canReplace())return false;const project=X.importProject(data,W.World);setMode('atlas');requestMap({world:project.world,expedition:project.expedition,view:project.view||fitView(project.world),replace:true,restore:true});return true;}
 async function importFile(file){if(!file)return;try{if(file.size>X.MAX_PROJECT_BYTES)throw Error('Choose a JSON project smaller than 5 MB.');const data=await file.text();importData(data);}catch(e){notify('Import rejected. '+e.message);}finally{$('import-file').value='';}}
 function setMode(next){
  if(next===mode&&(next==='atlas'||frontier?.expedition===expedition))return true;
  if(next==='atlas'){if(frontier&&!frontier.hide())return false;mode='atlas';show('atlas-workspace');show('explore-workspace',false);$('world-label').textContent='FRONTIER ATLAS';$('atlas-mode').classList.add('active');$('explore-mode').classList.remove('active');$('atlas-mode').setAttribute('aria-pressed','true');$('explore-mode').setAttribute('aria-pressed','false');resize();renderRecord();return true;}
  if(!expedition){notify('Choose a passable tile and deploy an expedition first.');return false;}
  cancelRender();mode='explore';show('atlas-workspace',false);show('explore-workspace');$('world-label').textContent='THE ROADS BEYOND THE BELL';$('atlas-mode').classList.remove('active');$('explore-mode').classList.add('active');$('atlas-mode').setAttribute('aria-pressed','false');$('explore-mode').setAttribute('aria-pressed','true');
  if(!frontier){frontier=new root.EWFrontierGame({notify,onChange:()=>{markDirty();updateStats();},onStats:updateStats,onAtlas:()=>centerExpedition()});frontier.setExpedition(world,expedition);}else if(frontier.expedition!==expedition)frontier.setExpedition(world,expedition);
  expedition.ensurePosition();frontier.show();return true;
 }
 function deploy(){
  if(!world||!selection||isGenerating()||!canReplace())return;
  const p={...selection};if(!world.tile(p.x,p.y).passable){notify('Choose passable land or a bridge.');return;}
  openDialog('<div class="eyebrow">FRONTIER EXPEDITION</div><h2>A camp beneath a new sky.</h2><p>Deploy near '+p.x.toLocaleString()+', '+p.y.toLocaleString()+'. The expedition builds a camp and three connected relay routes in this region.</p><p>'+(expedition?'This replaces the current expedition. Existing terrain edits and roads remain in the world.':'Restore the three relays, then return to camp. The last relay brings Morrow into battle.')+'</p><label for="deploy-difficulty">Combat difficulty</label><select id="deploy-difficulty"><option value="standard">Standard · read intent and manage resources</option><option value="story">Story · reduced incoming damage</option></select><label for="deploy-module">Morrow module</label><select id="deploy-module"><option value="balanced">Balanced · 600 integrity</option><option value="aegis">Aegis · 680 integrity</option><option value="coil">Coil · stronger attacks and faster refueling</option></select><div class="dialog-buttons"><button class="primary" data-dialog="deploy">Deploy expedition</button><button data-dialog="cancel">Keep charting</button></div>',action=>{
   if(action!=='deploy'){closeDialog();return;}const options={difficulty:$('deploy-difficulty').value,module:$('deploy-module').value};
   try{expedition=X.Expedition.create(world,p,options);updateProtected();undo=[];redo=[];selection={...expedition.state.camp};root.EWFrontierArt.clearCache(world);closeDialog();markDirty();renderRecord();updateEditControls();setMode('explore');frontier.help();}catch(e){notify(e.message);}
  });
 }
 function centerExpedition(){if(!expedition)return;if(!setMode('atlas'))return;const p=expedition.state.position;view={x:p.x,y:p.y,span:128};selection={x:Math.floor(p.x),y:Math.floor(p.y)};scheduleMap();renderInspector();}
 function setTool(next){if(isGenerating())return;tool=next;for(const name of ['inspect','paint','erase']){$('tool-'+name).classList.toggle('active',name===next);$('tool-'+name).setAttribute('aria-pressed',String(name===next));}show('paint-controls',next!=='inspect');if(next!=='inspect'&&world&&view.span>width/3){view={x:selection?selection.x+.5:view.x,y:selection?selection.y+.5:view.y,span:96};scheduleMap();notify('Zoomed to editing scale. Hold Shift and drag to pan.');}updateEditControls();}
 function updateEditControls(){$('undo-edit').disabled=!undo.length;$('redo-edit').disabled=!redo.length;$('paint-hint').textContent=view.span>width/3?'Zoom closer to paint individual tiles.':protectedTiles.size?'Expedition route tiles are protected.':'Drag to paint. Hold Shift to pan.';$('paint-controls').classList.toggle('hidden',tool==='inspect');}
 function applyBrush(x,y){
  if(!world||!stroke||view.span>width/3)return;const radius=(Number($('brush-size').value)-1)/2,biome=$('paint-biome').value,road=$('paint-road').checked;
  let protectedCount=0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const tx=Math.floor(x)+dx,ty=Math.floor(y)+dy,key=tx+','+ty;if(tx<0||ty<0||tx>=world.config.size||ty>=world.config.size)continue;
   if(protectedTiles.has(key)){protectedCount++;continue;}
   const before=world.getOverride(tx,ty);if(!stroke.has(key))stroke.set(key,{x:tx,y:ty,before,after:null});
   const patch=tool==='erase'?{}:{...(before||{}),...(biome?{biome}:{}),road};
   try{world.setOverride(tx,ty,patch);stroke.get(key).after=world.getOverride(tx,ty);}catch(e){if(!stroke.failed){stroke.failed=true;notify(e.message);}return;}
   const t=world.sample(tx,ty),p=screenPoint(tx,ty);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=W.BIOMES[t.biome].color;ctx.fillRect(p[0],p[1],Math.ceil(width/view.span),Math.ceil(width/view.span));
  }if(protectedCount&&!stroke.protectedNote){stroke.protectedNote=true;notify('Camp and relay routes are protected. Paint outside their footprint.');}
 }
 function endStroke(){if(!stroke)return;const edits=[...stroke.values()].filter(e=>JSON.stringify(e.before)!==JSON.stringify(e.after));stroke=null;if(edits.length){undo.push(edits);if(undo.length>30)undo.shift();redo=[];root.EWFrontierArt.clearCache(world);expedition?.ensurePosition();markDirty();scheduleMap();renderInspector();updateStats();}updateEditControls();}
 function changeHistory(direction){if(!world||isGenerating())return;endStroke();const source=direction==='undo'?undo:redo,dest=direction==='undo'?redo:undo,changes=source.pop();if(!changes)return;for(const p of changes)world.setOverride(p.x,p.y,(direction==='undo'?p.before:p.after)||{});dest.push(changes);root.EWFrontierArt.clearCache(world);expedition?.ensurePosition();markDirty();scheduleMap();renderInspector();updateEditControls();}
 function zoom(factor,point={x:width/2,y:height/2}){if(!world||isGenerating())return;const before=worldPoint(point.x,point.y);view.span=clamp(view.span*factor,16,world.config.size*2);const after=worldPoint(point.x,point.y);view.x+=before.x-after.x;view.y+=before.y-after.y;constrainView();scheduleMap();updateEditControls();}
 function choosePoint(px,py){const b=bounds();if(showSites){let closest=null,dist=10;for(const f of sites){const p=screenPoint(f.x+.5,f.y+.5,b),d=Math.hypot(px-p[0],py-p[1]);if(d<dist){closest=f;dist=d;}}if(closest){inspect(closest.x,closest.y);return;}}const p=worldPoint(px,py,b);inspect(p.x,p.y);}
 function bind(){
  $('generate-world').addEventListener('click',askGenerate);$('cancel-generation').addEventListener('click',()=>cancelRender(true));$('save-project').addEventListener('click',()=>saveProject());$('export-project').addEventListener('click',exportProject);$('export-map').addEventListener('click',exportMap);$('export-chunk').addEventListener('click',exportChunk);$('import-project').addEventListener('click',()=>{if(canReplace())$('import-file').click();});$('import-file').addEventListener('change',e=>importFile(e.target.files[0]));
  $('random-seed').addEventListener('click',()=>{const values=new Uint32Array(2);if(root.crypto?.getRandomValues)crypto.getRandomValues(values);else{values[0]=Date.now();values[1]=Math.floor(Math.random()*1e9);}$('world-seed').value='dawn-'+values[0].toString(36)+'-'+values[1].toString(36);});
  for(const el of document.querySelectorAll('input[type=range]'))el.addEventListener('input',updateRanges);
  for(const el of document.querySelectorAll('[data-preset]'))el.addEventListener('click',()=>{const p={continents:[43,55,55],islands:[59,40,68],highlands:[29,91,35]}[el.dataset.preset];$('sea-level').value=p[0];$('ruggedness').value=p[1];$('moisture').value=p[2];updateRanges();notify('Preset applied. Choose Generate world to use it.');});
  $('atlas-mode').addEventListener('click',()=>setMode('atlas'));$('explore-mode').addEventListener('click',()=>setMode('explore'));$('resume-expedition').addEventListener('click',()=>setMode('explore'));$('deploy-selected').addEventListener('click',deploy);$('center-expedition').addEventListener('click',centerExpedition);
  for(const name of ['inspect','paint','erase'])$('tool-'+name).addEventListener('click',()=>setTool(name));$('undo-edit').addEventListener('click',()=>changeHistory('undo'));$('redo-edit').addEventListener('click',()=>changeHistory('redo'));
  $('zoom-in').addEventListener('click',()=>zoom(.5));$('zoom-out').addEventListener('click',()=>zoom(2));$('fit-map').addEventListener('click',()=>{if(world&&!isGenerating()){view=fitView();scheduleMap();updateEditControls();}});
  $('map-layer').addEventListener('change',e=>{layer=e.target.value;requestMap();});$('toggle-sites').addEventListener('click',()=>{showSites=!showSites;$('toggle-sites').setAttribute('aria-pressed',String(showSites));render();});$('toggle-grid').addEventListener('click',()=>{showGrid=!showGrid;$('toggle-grid').setAttribute('aria-pressed',String(showGrid));render();});
  $('location-list').addEventListener('click',e=>{const el=e.target.closest('[data-site-x]');if(!el||isGenerating())return;const x=Number(el.dataset.siteX),y=Number(el.dataset.siteY);view={x:x+.5,y:y+.5,span:192};inspect(x,y);scheduleMap();});
  $('expedition-record').addEventListener('click',e=>{if(!e.target.closest('[data-clear-expedition]')||!expedition||!canReplace())return;openDialog('<div class="eyebrow">CLOSE EXPEDITION</div><h2>Keep the roads. Clear the record.</h2><p>The expedition checkpoint will be removed. Its roads remain in the world and become editable. Export JSON first to keep this expedition.</p><div class="dialog-buttons"><button data-dialog="export">Export project</button><button class="primary" data-dialog="clear">Close expedition</button><button data-dialog="cancel">Keep expedition</button></div>',action=>{if(action==='export'){exportProject();return;}if(action==='clear'){setMode('atlas');expedition=null;updateProtected();frontier?.setExpedition(world,null);renderRecord();renderInspector();markDirty();render();}closeDialog();});});
  $('forge-dialog').addEventListener('click',e=>{const el=e.target.closest('[data-dialog]');if(el&&!el.disabled)dialogCallback?.(el.dataset.dialog);});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.3:1/1.3,localPoint(e));},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(!world||isGenerating()||e.button!==0)return;const p=localPoint(e);canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});if(tool!=='inspect'&&!e.shiftKey){if(view.span>width/3){zoom(.5,p);return;}stroke=new Map();const q=worldPoint(p.x,p.y);drag={paint:true,last:q,id:e.pointerId};applyBrush(q.x,q.y);}else drag={x:p.x,y:p.y,lastX:p.x,lastY:p.y,moved:false,id:e.pointerId};});
  canvas.addEventListener('pointermove',e=>{if(!world)return;const p=localPoint(e),q=worldPoint(p.x,p.y);if(!drag){$('map-coordinate').textContent=Math.floor(q.x).toLocaleString()+', '+Math.floor(q.y).toLocaleString();return;}if(e.pointerId!==drag.id)return;if(drag.paint){const dx=q.x-drag.last.x,dy=q.y-drag.last.y,steps=Math.min(256,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));for(let i=1;i<=steps;i++)applyBrush(drag.last.x+dx*i/steps,drag.last.y+dy*i/steps);drag.last=q;}else{const dx=p.x-drag.lastX,dy=p.y-drag.lastY;view.x-=dx/width*view.span;view.y-=dy/width*view.span;drag.lastX=p.x;drag.lastY=p.y;if(Math.hypot(p.x-drag.x,p.y-drag.y)>4)drag.moved=true;constrainView();render();}});
  const pointerEnd=e=>{if(!drag||e.pointerId!==drag.id)return;const old=drag;drag=null;if(old.paint)endStroke();else if(old.moved)scheduleMap();else if(e.type==='pointerup')choosePoint(old.x,old.y);};for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,pointerEnd);
  document.addEventListener('keydown',e=>{
   if(!$('forge-dialog').classList.contains('hidden')){if(e.code==='Escape'){e.preventDefault();e.stopPropagation();closeDialog();}if(e.key==='Tab'){const els=[...$('forge-dialog').querySelectorAll('button:not([disabled]),select,input')],first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
   if(mode!=='atlas'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
   if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();changeHistory(e.shiftKey?'redo':'undo');return;}
   if(document.activeElement!==canvas||!world)return;
   if(e.code==='Space'&&tool!=='inspect'){e.preventDefault();if(isGenerating())return;if(view.span>width/3){notify('Zoom closer before applying the brush.');return;}const p=selection||{x:Math.floor(view.x),y:Math.floor(view.y)};stroke=new Map();applyBrush(p.x,p.y);endStroke();return;}
   const shift={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.code];if(shift){e.preventDefault();view.x+=shift[0]*view.span/10;view.y+=shift[1]*view.span/10;constrainView();scheduleMap();}
   if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.5);}if(e.key==='-'){e.preventDefault();zoom(2);}if(e.code==='Enter'){e.preventDefault();inspect(view.x,view.y);}if(e.code==='Escape')setTool('inspect');
  });
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>resize()).observe(stage);else root.addEventListener('resize',resize);
  root.addEventListener('pagehide',()=>{if(world)saveProject(false);});
 }
 function init(){
  $('biome-legend').innerHTML=Object.values(W.BIOMES).map(b=>'<span class="biome-key"><i class="swatch" style="background:'+b.color+'"></i>'+b.label+'</span>').join('');$('paint-biome').innerHTML='<option value="">Keep terrain</option>'+Object.values(W.BIOMES).map(b=>'<option value="'+b.id+'" '+(b.id==='grassland'?'selected':'')+'>'+b.label+'</option>').join('');
  if(root.matchMedia?.('(max-width:760px)').matches)$('settings-details').open=false;bind();updateRanges();resize();
  try{const saved=localStorage.getItem(X.STORAGE_KEY);if(saved){const p=X.importProject(saved,W.World);requestMap({world:p.world,expedition:p.expedition,view:p.view||fitView(p.world),replace:true,restore:true});return;}}catch(e){notify('The saved world could not be loaded. You can import a valid JSON copy.');}
  generate(configFromControls());
 }
 // Public, read-oriented integration surface for future authoring tools.
 root.EWForge=Object.freeze({get world(){return world;},get expedition(){return expedition;},get frontier(){return frontier;},status:()=>({mode,tool,working:!!pending,dirty,selection:selection?{...selection}:null,view:{...view},undo:undo.length,redo:redo.length}),getProject:()=>world?X.exportProject(world,expedition,view):null,generate,importProject:importData,inspect,centerExpedition});
 init();
})(window);
