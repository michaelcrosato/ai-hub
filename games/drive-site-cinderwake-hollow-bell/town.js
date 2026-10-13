/* HEARTHSTEAD — town expansion for Cinderwake. Original citizens, work cycles, services and requests. */
(() => {
'use strict';
const E=window.My3D2dge,C=window.Cinder;
const citizenData=[
 {id:'mora',name:'Sister Mora',role:'Keeper of the hearth',place:'The Ember Chapel',cx:17,cy:61,row:0,color:'#c2b38c',loop:1.8,bark:['The fire is still ours.','A name is more than an echo.'],story:'I left the abbey when the bell began to answer itself. These people gave me a place by their fire. Bring its last ember here. Let us remember the dead without waking them.'},
 {id:'brann',name:'Brann Ashhand',role:'Smith',place:'Ashhand Forge',cx:28,cy:60,row:1,color:'#c89769',loop:.95,bark:['Steel remembers the hammer.','Give the edge time to cool.'],story:'I forged hinges for the abbey before I forged swords. A hinge should keep a door open. The things I make now must help people come home.'},
 {id:'iona',name:'Iona Reed',role:'Herbalist',place:'The Green Bottle',cx:15,cy:69,row:2,color:'#aabd8c',loop:1.4,bark:['Fresh water. Steady hands.','Cinderbloom grows where ash settles.'],story:'The soil beyond the walls has gone cold. Cinderbloom still grows near the three bindings. Bring one from each path. I can make a draught that helps you carry more spirit.'},
 {id:'oren',name:'Oren Mallow',role:'Innkeeper',place:'The Lantern & Loaf',cx:29,cy:70,row:3,color:'#cbb591',loop:1.7,bark:['There is a warm bowl waiting.','No one eats alone tonight.'],story:'There used to be a queue at this door. There will be again. Until then, I keep six places laid. Yours makes seven.'},
 {id:'tamsin',name:'Tamsin Vell',role:'Cartographer',place:'The Wayfarer’s Desk',cx:26,cy:76,row:4,color:'#a3b1ca',loop:1.3,bark:['A road is a promise on paper.','Someone must draw the way back.'],story:'My last map ends at the abbey steps. The keeper kept a record in the Silent Archive. Read it, then tell me what you found. I will mark a better road for the next traveller.'},
 {id:'vale',name:'Captain Vale',role:'Town watch',place:'Northwatch Gate',cx:12,cy:51,row:5,color:'#91b7b1',loop:2.1,bark:['Keep the north road clear.','Light on the walls. Hope in the square.'],story:'Three watch lamps went dark in the ash storm. Their oil is sound. Take a spark from our hearth and light them. I can spare thirty-five crowns for the work.'}
];
const buildings=[
 {type:'chapel',col:1,row:1,cx:15,cy:59,w:216,h:196,foot:[12,55,5,4]},
 {type:'forge',col:0,row:0,cx:31,cy:59,w:235,h:204,foot:[29,55,5,4]},
 {type:'apothecary',col:1,row:0,cx:12,cy:69,w:218,h:195,foot:[9,65,5,4]},
 {type:'inn',col:2,row:0,cx:34,cy:70,w:255,h:218,foot:[31,65,6,5]},
 {type:'study',col:0,row:1,cx:23,cy:76,w:211,h:183,foot:[20,73,5,3]},
 {type:'gate',col:2,row:1,cx:8,cy:49,w:158,h:149,foot:null}
];
const lamps=[{id:'north',cx:21,cy:50,name:'North watch lamp'},{id:'well',cx:39,cy:60,name:'Market watch lamp'},{id:'south',cx:13,cy:75,name:'South watch lamp'}];
const herbs=[{id:'bone',cx:4,cy:13,name:'Pale cinderbloom',path:'Bone'},{id:'names',cx:29,cy:14,name:'Blue cinderbloom',path:'Names'},{id:'flame',cx:36,cy:33,name:'Red cinderbloom',path:'Flame'}];
const T=window.Hearthstead={
 VERSION:1,HEIGHT:82,LEGACY_HEIGHT:48,SPAWN:[24,64],ROOM:{id:'town',name:'Hearthstead',sub:'A light beyond the abbey',x:3,y:47,w:43,h:32,safe:true,tag:'town'},citizens:citizenData,buildings,lamps,herbs,
 newState:()=>({version:1,forge:0,lining:0,meal:false,lamps:[],lampReward:false,herbs:[],herbReward:false,surveyReward:false,seen:[],stash:[]}),
 valid(v){return !!(v&&v.version===1&&Number.isInteger(v.forge)&&v.forge>=0&&v.forge<=2&&Number.isInteger(v.lining)&&v.lining>=0&&v.lining<=2&&['meal','lampReward','herbReward','surveyReward'].every(k=>typeof v[k]==='boolean')&&Array.isArray(v.lamps)&&v.lamps.length<=3&&new Set(v.lamps).size===v.lamps.length&&v.lamps.every(id=>lamps.some(x=>x.id===id))&&Array.isArray(v.herbs)&&v.herbs.length<=3&&new Set(v.herbs).size===v.herbs.length&&v.herbs.every(id=>herbs.some(x=>x.id===id))&&Array.isArray(v.seen)&&v.seen.length<=6&&new Set(v.seen).size===v.seen.length&&v.seen.every(id=>citizenData.some(x=>x.id===id))&&Array.isArray(v.stash)&&v.stash.length<=24);},
 carve(cells,floor,W){
  const fill=(x,y,w,h,tag='town',cell=0)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){cells[yy*W+xx]=cell;floor[yy*W+xx]=tag;}};
  fill(7,44,3,7,'road');fill(7,49,20,3,'road');fill(22,49,5,28,'road');fill(5,59,39,5,'road');fill(11,66,25,4,'road');fill(17,56,17,15,'plaza');fill(12,73,18,3,'road');
  for(const b of buildings)if(b.foot)fill(...b.foot,'town',0);
  // Garden water and low fences read as exterior space, without tall dungeon walls.
  fill(40,73,4,4,'water',5);fill(5,72,3,5,'garden',5);
 },
 floor(x,y,tag){const v=Math.imul(Math.floor(x),374761393)^Math.imul(Math.floor(y),668265263),n=((v^(v>>>13))>>>0)/4294967295;if(tag==='town')return[36+n*9,49+n*10,42+n*8];if(tag==='water')return[28+n*5,58+n*9,60+n*10];if(tag==='garden')return[41+n*9,57+n*8,38+n*8];const p=tag==='plaza'?{mortar:[56,60,51],stones:[[102,105,83],[97,101,84],[113,109,86]],hi:[122,123,99],lo:[64,73,62],speck:[139,134,107]}:{mortar:[47,53,47],stones:[[82,91,77],[93,99,81],[89,94,78]],hi:[108,115,96],lo:[51,63,55],speck:[121,124,101]};return E.tex.flagstone(x,y,p,24);},
 create(api){
  const a=api,atlas=C.loadImage('assets/town-buildings.png'),sprites=C.loadImage('assets/town-citizens.png');let citizens=[],decor=[],clock=0,barkClock=5,bubble=null;
  const data=()=>a.get();const isTown=(p=data().hero)=>p&&p.y>=47*24&&p.y<79*24;const st=()=>data().state.town;
  const bounds={buildings:{forge:[40,17,430,459],apothecary:[555,35,431,456],inn:[1063,19,454,479],study:[36,517,466,473],chapel:[555,493,432,503],gate:[1077,507,445,477]},sprites:[[{"rect":[110,58,127,197],"anchor":[71.93,197],"ms":700},{"rect":[349,57,113,198],"anchor":[56,198],"ms":800},{"rect":[568,71,125,184],"anchor":[70.11,184],"ms":900},{"rect":[814,55,126,200],"anchor":[71.02,200],"ms":700}],[{"rect":[87,305,154,200],"anchor":[82.43,200],"ms":400},{"rect":[320,273,164,236],"anchor":[77.4,236],"ms":360},{"rect":[575,345,163,165],"anchor":[81.89,165],"ms":130},{"rect":[797,305,173,200],"anchor":[97.01,200],"ms":380}],[{"rect":[119,536,113,219],"anchor":[55.9,219],"ms":400},{"rect":[341,538,128,218],"anchor":[68.88,218],"ms":300},{"rect":[590,541,126,215],"anchor":[67.79,215],"ms":300},{"rect":[832,535,124,221],"anchor":[66.68,221],"ms":450}],[{"rect":[97,788,134,228],"anchor":[82.8,228],"ms":550},{"rect":[334,795,141,222],"anchor":[91.99,222],"ms":450},{"rect":[577,796,142,221],"anchor":[88.49,221],"ms":450},{"rect":[831,787,137,227],"anchor":[63.09,227],"ms":700}],[{"rect":[101,1040,124,225],"anchor":[78.33,225],"ms":650},{"rect":[348,1041,120,223],"anchor":[70.34,223],"ms":400},{"rect":[575,1046,138,220],"anchor":[82.07,220],"ms":400},{"rect":[826,1044,129,222],"anchor":[77.79,222],"ms":650}],[{"rect":[91,1266,150,241],"anchor":[88.72,241],"ms":700},{"rect":[334,1273,165,234],"anchor":[103.2,234],"ms":650},{"rect":[575,1273,158,234],"anchor":[94.22,234],"ms":700},{"rect":[819,1267,162,240],"anchor":[94.2,240],"ms":650}]]};
  const rows={mora:0,brann:1,iona:2,oren:3,tamsin:4,vale:5};
  const status=()=>{const s=data().state,t=s.town;return t.lampReward+t.herbReward+t.surveyReward;};
  const portrait=id=>`<div class="citizen-portrait portrait-${id}" role="img" aria-label="Portrait of ${citizenData.find(n=>n.id===id)?.name||id}"></div>`;
  const head=(n,text)=>`<div class="citizen-heading">${portrait(n.id)}<div><p class="eyebrow">${n.place}</p><h2 id="modal-title">${n.name}</h2><p class="citizen-role">${n.role}</p><p class="citizen-quote">${text}</p></div></div>`;
  const btn=a.button;
  const service=(title,desc,label,action,disabled=false)=>`<div class="shop-row"><div>${title}<small>${desc}</small></div>${btn(label,action,'small-button',disabled)}</div>`;
  const quote=n=>data().state.complete?{mora:'The ember is home. Now we build a morning.',brann:'For once, I can forge a hinge again.',iona:'The soil is warming. I can feel it.',oren:'Seven places laid. Seven people home.',tamsin:'I have drawn a road beyond the abbey.',vale:'The watch heard birds this morning.'}[n.id]:n.bark[Math.floor(data().state.elapsed/17)%n.bark.length];
  function build(){
   clock=0;bubble=null;citizens=[];decor=[];const s=data().state;if(!s.town)s.town=T.newState();
   const old=a.get().objects.find(o=>o.id==='mora');const gate=data().objects.find(o=>o.id==='return');if(gate)Object.assign(gate,a.pos(27,63));const portalProp=data().props.find(p=>p.type==='portal');if(portalProp)Object.assign(portalProp,a.pos(27,63));
   for(const n of citizenData){const o=n.id==='mora'&&old?Object.assign(old,a.pos(n.cx,n.cy),{citizen:n.id}):a.addObject('citizen',n.id,n.cx,n.cy,{name:n.name,citizen:n.id});citizens.push({...n,object:o,phase:n.row*.41});}
   a.addObject('hearth','town-hearth',24,62,{name:'Hearthstead’s common fire'});a.addProp('brazier',24,62,50,99,{light:180,safe:true});
   a.addObject('notice','town-board',20,63,{name:'Hearthstead notice board'});
   a.addObject('stash','town-stash',26,65,{name:'The Warden’s chest'});
   a.addObject('travel','abbey-road',9,50,{name:'North road · enter the abbey',destination:'abbey'});
   a.addObject('travel','town-road',8,43,{name:'South road · visit Hearthstead',destination:'town'});
   for(const l of lamps)a.addObject('watchlamp',l.id,l.cx,l.cy,{name:l.name});
   for(const h of herbs)a.addObject('herb','bloom-'+h.id,h.cx,h.cy,{name:h.name,herbId:h.id});
   for(const [x,y]of [[16,55],[29,55],[16,71],[32,72],[5,57],[43,56],[23,78]])a.addProp('brazier',x,y,27,62,{light:100});
   for(const [x,y]of [[7,62],[11,63],[34,62],[39,71],[19,74],[27,75]])decor.push({type:'planter',...a.pos(x,y)});
   for(const [x,y]of [[15,61],[30,65],[19,70]])decor.push({type:'bench',...a.pos(x,y)});
   decor.push({type:'anvil',...a.pos(28,61)});decor.push({type:'well',...a.pos(29,61)});decor.push({type:'sign',...a.pos(23,53)});
  }
  function update(dt){
   clock+=dt;if(!isTown())return;barkClock-=dt;if(bubble){bubble.life-=dt;if(bubble.life<=0)bubble=null;}
   if(barkClock<0){barkClock=9;const near=citizens.filter(n=>Math.hypot(n.object.x-data().hero.x,n.object.y-data().hero.y)<145);if(near.length){const n=near[Math.floor(clock/9)%near.length];bubble={n,text:quote(n),life:3.8};}}
   // Ambient particles belong to visible work places. Citizens do not interrupt menus.
   if(Math.floor(clock*7)!==Math.floor((clock-dt)*7)&&Math.sin(clock*6)> .93){const n=citizens[1];if(Math.hypot(n.object.x-data().hero.x,n.object.y-data().hero.y)<200){a.game.particles.sparks(n.object.x+7,n.object.y+4,13,3);}}
  }
  function frame(n){const frames=bounds.sprites[n.row],total=frames.reduce((sum,f)=>sum+f.ms,0);let at=((clock+n.phase)*1000)%total;for(let i=0;i<frames.length;i++){at-=frames[i].ms;if(at<0)return i;}return 3;}
  function drawCitizen(r,o){
   const n=citizens.find(v=>v.id===(o.citizen||o.id));if(!n)return false;
   const f=frame(n),cw=sprites.naturalWidth/4,ch=sprites.naturalHeight/6;
   r.shadow(o.x,o.y,8,.34);
   if(sprites.complete&&sprites.naturalWidth){const asset=bounds.sprites[n.row][f],rect=asset.rect,scale=.30;r.queue(o.x,o.y,0,g=>{const p=r.w(o.x,o.y,0);g.save();g.imageSmoothingEnabled=false;g.drawImage(sprites,...rect,Math.round(p[0]-asset.anchor[0]*scale),Math.round(p[1]-asset.anchor[1]*scale),Math.round(rect[2]*scale),Math.round(rect[3]*scale));g.restore();g._c=null;});}
   if(isTown()&&Math.hypot(o.x-data().hero.x,o.y-data().hero.y)<138)r.textAt(o.x,o.y,47,n.name,n.color);
   return true;
  }
  function draw(r){
   if(!data().state)return;const h=data().hero;
   for(const b of buildings){const p=a.pos(b.cx,b.cy);if(Math.hypot(p.x-h.x,p.y-h.y)>420)continue;const cw=atlas.naturalWidth/3,ch=atlas.naturalHeight/2,rect=bounds.buildings?.[b.type]||[b.col*cw,b.row*ch,cw,ch];const close=h.x>p.x-65&&h.x<p.x+65&&h.y<p.y+15&&h.y>p.y-85;C.image(r,{img:atlas,rect},p.x,p.y,0,b.w,b.h,close?.48:1,-25);}
   for(const d of decor){if(Math.hypot(d.x-h.x,d.y-h.y)>275)continue;r.queue(d.x,d.y,0,g=>{const p=r.w(d.x,d.y,0),x=p[0],y=p[1];
    if(d.type==='anvil'){E.px.poly(g,[[x-15,y-8],[x+12,y-8],[x+18,y-2],[x-12,y+5]],'#665847');E.px.rect(g,x-9,y-26,14,21,'#505957');E.px.poly(g,[[x-23,y-32],[x+14,y-32],[x+23,y-27],[x+3,y-20],[x-17,y-23]],'#939d91');E.px.line(g,x-18,y-31,x+12,y-31,'#c1c1a6',2);}
    if(d.type==='bench'){E.px.poly(g,[[x-23,y-11],[x+8,y-22],[x+29,y-11],[x-3,y+1]],'#76664b');E.px.line(g,x-14,y-2,x-14,y+8,'#403e31',4);E.px.line(g,x+20,y-6,x+20,y+4,'#403e31',4);}
    if(d.type==='planter'){E.px.ell(g,x,y,13,7,'#4b4d38');E.px.rect(g,x-10,y-12,20,11,'#665443');E.px.ell(g,x,y-12,11,6,'#2d463a');for(let i=0;i<6;i++)E.px.line(g,x+(i-3)*3,y-12,x+(i-3)*4,y-23-Math.sin(i)*5,'#6d855b',3);}
    if(d.type==='well'){E.px.ell(g,x,y,26,14,'#444e47');E.px.ell(g,x,y-12,25,13,'#91a08a');E.px.ell(g,x,y-14,16,8,'#244847');E.px.line(g,x-18,y-9,x-18,y-45,'#68523b',4);E.px.line(g,x+18,y-10,x+18,y-46,'#68523b',4);E.px.line(g,x-20,y-45,x+20,y-45,'#927e56',5);E.px.line(g,x,y-43,x,y-20,'#c3b58a',1);}
    if(d.type==='sign'){E.px.rect(g,x-2,y-43,4,42,'#776649');E.px.poly(g,[[x-19,y-40],[x+21,y-40],[x+28,y-34],[x+21,y-28],[x-19,y-28]],'#8b784e');E.font.text(g,'ABBEY',x+2,y-37,'#e2d7b6',{align:'center',scale:1});}
   });}
   for(const o of data().objects){if(Math.hypot(o.x-h.x,o.y-h.y)>230)continue;
    if(o.type==='watchlamp'){const lit=st().lamps.includes(o.id);r.queue(o.x,o.y,0,g=>{const p=r.w(o.x,o.y);E.px.rect(g,p[0]-2,p[1]-48,4,48,'#776343');E.px.rect(g,p[0]-8,p[1]-51,16,18,'#514b37');E.px.rect(g,p[0]-5,p[1]-47,10,11,lit?'#ffcd7a':'#242f2c');if(lit)r.glowDisc(g,p[0],p[1]-42,19,'#edb361',.25+Math.sin(clock*4)*.035);});}
    if(o.type==='notice'){r.queue(o.x,o.y,0,g=>{const p=r.w(o.x,o.y);E.px.rect(g,p[0]-21,p[1]-44,42,29,'#6a583e');E.px.rect(g,p[0]-18,p[1]-17,4,18,'#564a36');E.px.rect(g,p[0]+13,p[1]-17,4,18,'#564a36');for(let i=0;i<3;i++){E.px.rect(g,p[0]-15+i*11,p[1]-39,8,17,'#b7ae8c');E.px.line(g,p[0]-13+i*11,p[1]-33,p[0]-9+i*11,p[1]-33,'#6c725c',1);}});}
    if(o.type==='stash')C.image(r,a.arts.chest,o.x,o.y,0,51,44);
    if(o.type==='herb'&&!st().herbs.includes(o.herbId)){r.queue(o.x,o.y,0,g=>{const p=r.w(o.x,o.y);for(let i=0;i<5;i++){const dx=(i-2)*3;E.px.line(g,p[0],p[1],p[0]+dx,p[1]-15+Math.sin(clock+i)*2,'#849364',2);E.px.disc(g,p[0]+dx,p[1]-15+Math.sin(clock+i)*2,3,o.herbId==='flame'?'#d6976b':o.herbId==='names'?'#8bbac9':'#d0cfaa');}});}
   }
   if(bubble&&isTown()){const {n,text}=bubble;r.overlay(g=>{const p=r.w(n.object.x,n.object.y,64);const w=Math.min(260,text.length*4.8+18);E.px.rect(g,p[0]-w/2,p[1]-19,w,20,'#142623');E.font.text(g,text,p[0],p[1]-14,'#d4c9a8',{align:'center',scale:1});});}
  }
  function lightEntries(){return lamps.filter(l=>st().lamps.includes(l.id)).map(l=>({...a.pos(l.cx,l.cy),light:105}));}
  function interact(o){
   if(o.type==='citizen'){meet(o.id);return true;}
   if(o.type==='notice'){a.showPanel('town');return true;}
   if(o.type==='stash'){a.showPanel('stash');return true;}
   if(o.type==='travel'){travel(o.destination);return true;}
   if(o.type==='watchlamp'){if(st().lamps.includes(o.id)){a.toast('This watch lamp burns steadily.');return true;}st().lamps.push(o.id);a.sound('heal');a.game.particles.glints(o.x,o.y,30,14,'#ffcd7a');a.toast(`Watch lamps lit: ${st().lamps.length} / 3.`, 'legendary');a.saveGame();a.updateHUD();return true;}
   if(o.type==='herb'){if(st().herbs.includes(o.herbId)){a.toast('This cinderbloom has been gathered.');return true;}st().herbs.push(o.herbId);a.sound('loot');a.toast(`Cinderbloom gathered: ${st().herbs.length} / 3. Bring them to Iona.`);a.saveGame();return true;}
   return false;
  }
  function meet(id){if(!st().seen.includes(id))st().seen.push(id);a.showPanel(id==='mora'?'mora':'citizen-'+id);a.saveGame();}
  function travel(dest){const s=data();if(!a.roomAt(s.hero.x,s.hero.y)?.safe){a.toast('Reach a safe place before taking the road.','error');return;}a.closePanel();const p=a.pos(...(dest==='town'?T.SPAWN:[8,40]));Object.assign(s.hero,p,{vx:0,vy:0,kx:0,ky:0});a.game.cam.snap=true;a.resetTravel();a.updateVision();a.updateHUD();a.saveGame();a.announce(dest==='town'?'Hearthstead':'The Abbey Waystation',dest==='town'?'A PLACE TO RETURN':'THE NORTH ROAD');}
  function panel(name){if(!name||!data().state)return null;const s=data().state,t=st();
   if(name==='town')return a.panelHead('HEARTHSTEAD · '+status()+' / 3 REQUESTS COMPLETE','People, places, and promises')+`<p>A small town at the abbey’s edge. Its six citizens are keeping a light for you.</p><div class="town-directory">`+citizenData.map(n=>`<button class="citizen-card" data-action="town-walk-${n.id}">${portrait(n.id)}<span><strong>${n.name}</strong><small>${n.role}<br>${n.place}</small></span></button>`).join('')+`</div>${requests()}<div class="panel-actions">${btn(isTown()?'Take the north road':'Recall to Hearthstead',isTown()?'town-road':'town-recall','gold-button')}${btn('Map','map')}${btn('Close','close')}</div><p class="muted">Choose a citizen to walk to them while you are in town. The abbey route is also open on foot.</p>`;
   if(name==='stash')return a.panelHead('THE WARDEN’S CHEST','Keep what matters')+`<p>Store up to 24 items. This chest stays with your saved descent.</p><div class="stash-columns"><section><h3>Satchel · ${s.inventory.length} / 24</h3>`+s.inventory.map(it=>btn(a.escape(it.name),'town-store-'+it.id,'stash-item',t.stash.length>=24)).join('')+(s.inventory.length?'':'<p class="muted">No carried items.</p>')+`</section><section><h3>Chest · ${t.stash.length} / 24</h3>`+t.stash.map(it=>btn(a.escape(it.name),'town-take-'+it.id,'stash-item',s.inventory.length>=24)).join('')+(t.stash.length?'':'<p class="muted">The chest is empty.</p>')+`</section></div><div class="panel-actions">${btn('Close chest','close')}</div>`;
   if(!name.startsWith('citizen-'))return null;const n=citizenData.find(n=>n.id===name.slice(8));if(!n)return null;
   let html=head(n,quote(n))+`<p>${n.story}</p><div class="rule"></div>`;
   if(n.id==='brann'){const cost=t.forge?90:45,coat=t.lining?85:40;html+=service('Temper the Warden’s edge',`+3 blade damage with any weapon. ${t.forge} / 2 upgrades.`,t.forge>=2?'Fully tempered':cost+' crowns','town-forge',s.coins<cost||t.forge>=2)+service('Reinforce your lining',`+1 armour with any coat. ${t.lining} / 2 upgrades.`,t.lining>=2?'Fully lined':coat+' crowns','town-lining',s.coins<coat||t.lining>=2)+service('Trade equipment','Inspect, equip, or sell carried items.','Open satchel','inventory');}
   if(n.id==='iona')html+=service('A remedy for the weary',`Cinderbloom: ${t.herbs.length} / 3. Reward: +12 maximum spirit for this descent.`,t.herbReward?'Remedy received':'Give cinderbloom','town-herb-reward',t.herbs.length<3||t.herbReward)+service('Tend wounds','Restore health and spirit freely.','Receive care','town-care')+service('Flask supplies','Mora keeps spare flask fittings at the chapel.','Find Mora','town-walk-mora');
   if(n.id==='oren')html+=service('A place by the fire','Restore health, spirit, and all flask charges.','Rest at the inn','town-rest')+service('Fortifying supper','+12 maximum health for this descent. One meal per descent.',t.meal?'Well fed':'25 crowns','town-meal',s.coins<25||t.meal)+service('Your room and chest','Store equipment for later. No charge.','Open storage','stash');
   if(n.id==='tamsin')html+=service('A road through the dark',`${s.read.includes('book')?'The keeper’s record has been read.':'Read the keeper’s record in the Silent Archive.'} Reward: Surveyor’s Knot (+8 health, +8 spirit, +3 spell).`,t.surveyReward?'Record copied':'Share the record','town-survey-reward',!s.read.includes('book')||t.surveyReward||s.inventory.length>=24)+service('Routes and landmarks','The town map shows its citizens and the abbey road.','Read map','map');
   if(n.id==='vale')html+=service('Light on the walls',`${t.lamps.length} / 3 watch lamps lit. Reward: 35 crowns.`,t.lampReward?'Watch restored':'Report the lamps','town-lamp-reward',t.lamps.length<3||t.lampReward)+service('The north road','Travel to the abbey waystation.','Enter the abbey','town-road');
   html+=`<div class="panel-actions">${btn('Town requests','town')}${btn('Leave conversation','close')}</div><p class="muted">${s.coins} crowns · ${s.complete?'The bell is silent. Hearthstead has a future.':'The town changes as your descent progresses.'}</p>`;return html;
  }
  function requests(){const s=data().state,t=st();return `<div class="town-requests"><h3>Town requests</h3><div class="request ${t.lampReward?'done':''}"><strong>${t.lampReward?'◆':'◇'} Light on the walls</strong><p>Light the three watch lamps in Hearthstead. Report to Vale. ${t.lamps.length} / 3 lit.</p></div><div class="request ${t.herbReward?'done':''}"><strong>${t.herbReward?'◆':'◇'} A remedy for the weary</strong><p>Gather cinderbloom on the Bone, Names, and Flame paths. Bring all three to Iona. ${t.herbs.length} / 3 gathered.</p></div><div class="request ${t.surveyReward?'done':''}"><strong>${t.surveyReward?'◆':'◇'} A road through the dark</strong><p>Read the keeper’s record in the Silent Archive. Share it with Tamsin. ${s.read.includes('book')?'Record found.':'Record missing.'}</p></div></div>`;}
  function action(action){
   if(!action.startsWith('town-'))return false;const {state:s,hero:h}=data(),t=st();
   if(action==='town-recall'){if(a.roomAt(h.x,h.y)?.safe)travel('town');else{a.closePanel();a.beginRecall();}return true;}
   if(action==='town-road'){travel('abbey');return true;}
   if(action.startsWith('town-walk-')){if(!isTown()){a.toast('Recall to Hearthstead to meet its citizens.');return true;}const n=citizens.find(n=>n.id===action.slice(10));if(n){a.closePanel();a.setDestination(n.object.x,n.object.y,n.object);}return true;}
   if(!isTown()){a.toast('This service is available in Hearthstead.','error');return true;}
   if(action==='town-forge'||action==='town-lining'){const k=action==='town-forge'?'forge':'lining',cost=k==='forge'?(t[k]?90:45):(t[k]?85:40);if(t[k]>=2||s.coins<cost)return true;s.coins-=cost;t[k]++;a.sound('seal');a.toast(k==='forge'?'Tempered edge: +3 blade damage.':'Reinforced lining: +1 armour.','rare');}
   else if(action==='town-meal'){if(t.meal||s.coins<25)return true;s.coins-=25;t.meal=true;h.hp=Math.min(a.totalStats().maxHp,h.hp+12);a.sound('heal');a.toast('Fortifying supper: +12 maximum health.','rare');}
   else if(action==='town-care'||action==='town-rest'){const stats=a.totalStats();h.hp=stats.maxHp;h.mp=stats.maxMp;if(action==='town-rest')s.potions=s.maxPotions;a.sound('heal');a.toast(action==='town-rest'?'You rest at the Lantern & Loaf. All resources restored.':'Iona restores your health and spirit.');}
   else if(action==='town-lamp-reward'){if(t.lampReward||t.lamps.length<3)return true;t.lampReward=true;s.coins+=35;a.sound('level');a.toast('The watch is restored. Received 35 crowns.','legendary');}
   else if(action==='town-herb-reward'){if(t.herbReward||t.herbs.length<3)return true;t.herbReward=true;h.mp=Math.min(a.totalStats().maxMp,h.mp+12);a.sound('level');a.toast('Iona’s remedy: +12 maximum spirit.','legendary');}
   else if(action==='town-survey-reward'){if(t.surveyReward||!s.read.includes('book')||s.inventory.length>=24)return true;const it=a.item('shopcharm',{key:'surveyors-knot',name:'Surveyor’s Knot',hp:8,mp:8,spell:3,value:35,desc:'A road can be folded. A promise cannot.'});if(a.addInventory(it)){t.surveyReward=true;a.sound('level');}}
   else if(action.startsWith('town-store-')){if(t.stash.length>=24)return true;const i=s.inventory.findIndex(it=>it.id===action.slice(11));if(i<0)return true;t.stash.push(s.inventory.splice(i,1)[0]);a.sound('loot');}
   else if(action.startsWith('town-take-')){if(s.inventory.length>=24)return true;const i=t.stash.findIndex(it=>it.id===action.slice(10));if(i<0)return true;s.inventory.push(t.stash.splice(i,1)[0]);a.sound('loot');}
   else return true;
   a.updateHUD();a.saveGame();a.renderPanel();return true;
  }
  function mapMarkers(marker,large){for(const n of citizenData){const p=a.pos(n.cx,n.cy);marker(p.x,p.y,n.color,large?5:2);}for(const l of lamps)if(!st().lamps.includes(l.id)){const p=a.pos(l.cx,l.cy);marker(p.x,p.y,'#e6ae5f',large?5:2);}}
  return {build,update,draw,drawCitizen,interact,panel,action,requests,portrait,head,meet,isTown,travel,lightEntries,mapMarkers,status,frame,citizens:()=>citizens,bounds};
 }
};
})();
