/* CINDERWAKE: THE HOLLOW BELL — original complete chapter, built on my-3D2dge. */
(() => {
'use strict';
const E=window.My3D2dge,C=window.Cinder,T=window.Hearthstead,$=id=>document.getElementById(id);
const TILE=24,SAVE_KEY='cinderwake-save-v1',SETTINGS_KEY='cinderwake-settings-v1';
const settings=Object.assign({volume:.55,muted:false,difficulty:'standard',motion:true,labels:true,brightness:1},E.store.get(SETTINGS_KEY,{}));
const input={...E.Input.DEFAULT,attack:['KeyF','KeyX','Pad0','Pad7'],command:['Mouse0'],skill:['Mouse2','KeyR','Pad2','Pad5'],dash:['Space','ShiftLeft','ShiftRight','Pad1','Pad6'],interact:['KeyE','Pad3'],potion:['KeyQ'],ward:['Digit1'],inventory:['KeyI','KeyC'],journal:['KeyJ'],map:['Tab','KeyM'],recall:['KeyT'],help:['KeyH'],pause:['Escape','KeyP','Pad9'],town:['KeyB']};
const view=new E.View('cinderwake','Abbey',45,30,2.22,1),townView=new E.View('hearthstead','Hearthstead',45,30,1.5,1);
const game=new E.Game({canvas:'screen',res:[1000,600],view,views:['cinderwake'],input,bg:'#081014',step:1/120});
game.pauseOverlay=false;game.reduceMotion=!settings.motion;
C.resize(game);window.addEventListener('resize',()=>C.resize(game));
window.CinderAudio.install(game);game.audio.setVolume(settings.muted?0:settings.volume);
const atlas=C.loadImage('assets/props.png');
const artBounds={column:[126,7,176,341],brazier:[505,8,152,327],chest:[809,86,289,245],openChest:[1223,35,268,296],sarcophagus:[16,410,362,251],portal:[440,340,278,350],seal:[777,415,359,241],bell:[1183,345,336,336],statue:[100,675,193,343],candles:[433,699,286,310],book:[833,689,229,323],graves:[1176,693,327,315]};
const arts=Object.fromEntries(Object.entries(artBounds).map(([k,rect])=>[k,{img:atlas,rect}]));
const W=49,H=T.HEIGHT;
let town=null;
const ROOMS=[
 {id:'hearth',name:'Abbey Waystation',sub:'North road to Hearthstead',x:3,y:35,w:11,h:10,safe:true,tag:'hearth'},
 {id:'nave',name:'The Broken Nave',sub:'The abbey threshold',x:4,y:19,w:14,h:10,tag:'nave'},
 {id:'crypt',name:'The Mourning Crypt',sub:'Seal of Bone',x:3,y:3,w:12,h:12,tag:'crypt'},
 {id:'crossing',name:'The Ashen Crossing',sub:'Three paths. One bell.',x:20,y:20,w:11,h:11,tag:'nave'},
 {id:'scriptorium',name:'The Silent Archive',sub:'Seal of Names',x:19,y:4,w:12,h:12,tag:'archive'},
 {id:'furnace',name:'The Cinder Foundry',sub:'Seal of Flame',x:35,y:22,w:11,h:13,tag:'furnace'},
 {id:'ossuary',name:'The Unremembered',sub:'Optional: the lost keeper',x:19,y:36,w:12,h:10,tag:'crypt'},
 {id:'choir',name:'The Hollow Choir',sub:'The bell keeper waits',x:35,y:3,w:11,h:14,tag:'choir'},
 T.ROOM,{id:'town-road',name:'The South Road',sub:'Hearthstead lies ahead',x:7,y:44,w:3,h:8,safe:true,tag:'road'}
];
const SEAL_DATA=[{id:'bone',name:'Seal of Bone',room:'crypt',cx:9,cy:6,text:'Here they buried the bodies. The bell kept their grief.',reward:'graveglass'},{id:'names',name:'Seal of Names',room:'scriptorium',cx:25,cy:7,text:'Here they wrote the names. The bell learned to call them.',reward:'spellbook'},{id:'flame',name:'Seal of Flame',room:'furnace',cx:41,cy:29,text:'Here they fed the fire. The bell consumed its keepers.',reward:'coat'}];
const ENEMY_TYPES={
 hollow:{name:'Ashbound',hp:46,speed:31,damage:10,xp:12,range:23,wind:.58,recover:.85,size:1.04},
 skitter:{name:'Gutterling',hp:30,speed:58,damage:8,xp:10,range:18,wind:.38,recover:.83,size:.72},
 cantor:{name:'Choir Wraith',hp:43,speed:24,damage:12,xp:17,range:178,wind:.85,recover:1.75,size:1.12,ranged:true},
 guard:{name:'Bellguard',hp:138,speed:25,damage:22,xp:34,range:35,wind:.9,recover:1.3,size:1.33},
 revenant:{name:'The Lost Keeper',hp:210,speed:32,damage:19,xp:65,range:29,wind:.72,recover:1.1,size:1.32},
 boss:{name:'Prior Veyr, the Bellbound',hp:900,speed:26,damage:26,xp:140,range:45,wind:1.12,recover:1.3,size:1.8}
};
const UNIQUE_ITEMS={
 startblade:{name:'Warden’s Iron',slot:'weapon',rarity:'common',attack:0,armor:0,value:5,desc:'A plain blade. Its edge has survived the road.'},
 startcoat:{name:'Weathered Mantle',slot:'armor',rarity:'common',attack:0,armor:1,value:4,desc:'Ash lies deep in every fold.'},
 pilgrim:{name:'Pilgrim’s Edge',slot:'weapon',rarity:'rare',attack:6,spell:2,value:25,desc:'A sure edge, left for the next traveller.'},
 graveglass:{name:'Graveglass Pendant',slot:'charm',rarity:'rare',hp:14,armor:1,value:30,desc:'A pale light holds the cold at bay.'},
 coat:{name:'Forged Cindercoat',slot:'armor',rarity:'rare',armor:5,hp:10,value:34,desc:'The last work of the abbey’s forge.'},
 mercy:{name:'Morrow’s Mercy',slot:'weapon',rarity:'legendary',attack:10,leech:3,value:65,desc:'Recover 3 health with each kill. A keeper’s final gift.'},
 hearthkeeper:{name:'Hearthkeeper',slot:'weapon',rarity:'legendary',attack:16,spell:6,leech:5,value:100,desc:'The bell is silent. The blade remembers its fire.'},
 shopcharm:{name:'Copper Votive',slot:'charm',rarity:'rare',mp:16,spell:3,value:40,desc:'Carry a little more of the fire with you.'}
};
let map,enemyFlow,hero,rig,blade,enemies=[],props=[],objects=[],drops=[],hazards=[],shots=[],seals=[],explored=[],state=null;
let mode='title',panel=null,selectedItem=null,hoverEnemy=null,hoverObject=null,nearestObject=null,currentArea='',uiClock=0,visionClock=0,saveClock=0,particleClock=0;
let path=[],commandTarget=null,clickMark=null,attackIndex=0,attackWindow=0,activeAttack=0,castCd=0,castPose=0,dodgeT=0,dodgeCd=0,dodgeDir=[1,0],wardT=0,wardCd=0,hurtT=0,lastHit=-100,recallT=0,recallPoint=null,returnPoint=null,bossActive=false,modalOrigin=null;
let musicKind='title',lastFocus=null,saveAvailable=false,seenTutorials=new Set(),pendingLootNotice=false;
const flashlights=C.makeLight(),darkCanvas=document.createElement('canvas');
const rng=()=>{state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;};
const sound=(name,opt)=>game.audio.sfx(name,opt||{});
const playMusic=kind=>{if(musicKind===kind)return;musicKind=kind;window.CinderAudio.music(game,kind);};
const roomAt=(x,y)=>ROOMS.find(r=>x/TILE>=r.x&&x/TILE<r.x+r.w&&y/TILE>=r.y&&y/TILE<r.y+r.h);
const roomById=id=>ROOMS.find(r=>r.id===id);
const pos=(cx,cy)=>({x:(cx+.5)*TILE,y:(cy+.5)*TILE});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=E.clamp;
function makeMap(){
 const cells=new Array(W*H).fill(1),floor=new Array(W*H).fill('stone');
 function carve(x,y,w,h,tag='stone'){for(let cy=y;cy<y+h;cy++)for(let cx=x;cx<x+w;cx++){cells[cy*W+cx]=0;floor[cy*W+cx]=tag;}}
 for(const r of ROOMS)carve(r.x,r.y,r.w,r.h,r.tag);
 for(const r of [[7,29,3,6],[7,15,3,4],[18,23,2,3],[23,16,3,4],[31,25,4,3],[23,31,3,5],[38,17,3,5],[14,39,5,3]])carve(...r);
 // Cover pillars leave two-cell passages around each obstacle.
 for(const [x,y]of [[7,22],[14,22],[7,26],[14,26],[6,9],[11,9],[22,10],[28,10],[23,24],[28,27],[38,26],[43,26],[22,40],[28,40],[38,7],[43,7],[38,13],[43,13]])cells[y*W+x]=2;
 // Three iron bars seal the final approach. Clearing all seals removes them.
 for(let x=38;x<=40;x++)cells[19*W+x]=3;
 T.carve(cells,floor,W);
 const palettes={stone:{mortar:[29,35,35],stones:[[66,71,66],[61,67,66],[70,71,64],[53,61,61]],hi:[81,84,74],lo:[34,44,44],speck:[87,89,76]},hearth:{mortar:[37,36,30],stones:[[83,78,63],[75,75,64],[82,75,64]],hi:[100,94,77],lo:[45,47,43],speck:[110,100,78]},crypt:{mortar:[26,32,35],stones:[[62,70,72],[54,65,68],[67,76,75]],hi:[79,88,84],lo:[29,42,47],speck:[95,100,89]},furnace:{mortar:[38,32,28],stones:[[78,65,53],[71,59,49],[83,71,53]],hi:[99,85,64],lo:[41,39,32],speck:[116,95,62]},archive:{mortar:[30,33,30],stones:[[66,71,61],[73,76,63],[59,65,56]],hi:[86,93,75],lo:[38,45,38],speck:[110,111,88]},choir:{mortar:[23,31,35],stones:[[56,66,71],[64,73,76],[54,64,70]],hi:[78,87,90],lo:[28,39,45],speck:[94,100,95]}};
 const m=new E.TileMap({w:W,h:H,cells,tile:TILE,ao:7,types:{1:{h:43,top:'#404746',side:'#343e3d',sideLt:'#414b47',sideDk:'#273331',line:'#1d2929',edge:'#535b4f',cut:true,cutH:8,course:9},2:{h:58,top:'#586157',side:'#404c47',sideLt:'#505a50',line:'#28362f',cut:false,course:11},4:{h:0,top:'#37483d',side:'#37483d',cut:false},5:{h:8,top:'#475a48',side:'#364b40',cut:false},3:{h:56,top:'#7a6647',side:'#584c38',sideLt:'#7c6845',line:'#252b27',cut:false,course:11}},floorTex:(x,y,tag)=>{if(['town','road','plaza','water','garden'].includes(tag))return T.floor(x,y,tag);const p=palettes[tag]||palettes.stone;let col=E.tex.flagstone(x,y,p,24);const cx=x/TILE,cy=y/TILE;
   if((tag==='nave'&&cx>9&&cx<12)||(tag==='choir'&&cx>39.4&&cx<41.5)||(tag==='archive'&&cy>7.7&&cy<8.5)){const border=Math.abs(cx-9.1)<.06||Math.abs(cx-11.9)<.06;col=border?[101,88,53]:[col[0]*.66,col[1]*.51,col[2]*.42];}
   return col;
 }});m.floorTags=floor;for(const b of T.buildings)if(b.foot){const [x,y,w,h]=b.foot;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)m.block(xx,yy,true);}
 // Only exposed wall cells need to enter the depth queue.
 const queueWalls=m.queueWalls.bind(m);
 m.queueWalls=function(r){const v=r.view; r._map=this;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const id=this.cell(x,y);if(id<=0||id===4)continue;if(id===1&&![[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]].some(([dx,dy])=>this.cell(x+dx,y+dy)===0))continue;const t=y>=46&&id===1?{...this.types[1],h:9,cutH:9,top:'#5c6652',side:'#3e4b3d'}:this.types[id],h=this._isFront(x,y,v)?t.cutH||7:t.h;const p=r.w((x+.5)*TILE,(y+.5)*TILE);if(p[0]<-70||p[0]>r.W+70||p[1]<-40||p[1]>r.H+170)continue;r.queue((x+.5)*TILE,(y+.5)*TILE,0,g=>this._boxCached(g,r,x,y,t,h),{occluder:true});}};
 return m;
}
function item(key,extra={}){const base=UNIQUE_ITEMS[key];return Object.assign({id:`i${++state.itemSerial}`,key},base,extra);}
function totalStats(){
 const b=state.blessings,stats={maxHp:110+(state.level-1)*8+b.vigor*16,maxMp:60+(state.level-1)*4+b.will*8,attack:16+b.blade*3,spell:26+b.will*4+state.spellBonus,armor:b.vigor,leech:0};
 for(const it of Object.values(state.equipment)){if(!it)continue;stats.maxHp+=it.hp||0;stats.maxMp+=it.mp||0;stats.attack+=it.attack||0;stats.spell+=it.spell||0;stats.armor+=it.armor||0;stats.leech+=it.leech||0;}
 const ts=state.town;if(ts){stats.attack+=ts.forge*3;stats.armor+=ts.lining;stats.maxHp+=ts.meal?12:0;stats.maxMp+=ts.herbReward?12:0;}
 return stats;
}
function addProp(type,cx,cy,w,h,extra={}){if(type!=='column'&&!map.walkable(cx,cy)){let near=null;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]])if(map.walkable(cx+dx,cy+dy)){near=[cx+dx,cy+dy];break;}if(near)[cx,cy]=near;}const p={type,...pos(cx,cy),w,h,...extra};props.push(p);return p;}
function addObject(type,id,cx,cy,extra={}){const o={type,id,...pos(cx,cy),...extra};objects.push(o);return o;}
function spawnEnemy(type,cx,cy,extra={}){
 const spec=ENEMY_TYPES[type],p=pos(cx,cy),e={id:'e'+enemies.length,type,...spec,...extra,body:new E.Body({...p,r:type==='boss'?12:type==='skitter'?5:7}),hp:spec.hp,maxHp:spec.hp,home:p,active:false,dead:false,deathT:0,hit:0,stun:0,phase:'idle',t:0,cool:.3+enemies.length%4*.25,facing:Math.PI*.65,attackAngle:0,phaseTwo:false,pattern:0};
 if(type==='skitter')e.rig=new E.Blob({R:5.4,colors:{dk:'#272a26',base:'#615f4a',lt:'#9d9470'},horns:true,feet:true,tail:true,mouth:'fangs'});
 else{
  const cols=type==='cantor'?{skin:'#899b97',cloth:'#334e51',pants:'#1b2e33',trim:'#8b9e82',metal:'#84988a',orb:'#88d6d5',staff:'#64503a'}:type==='boss'?{skin:'#a59677',cloth:'#514039',coat:'#4b4339',pants:'#232b2a',trim:'#c3a269',metal:'#9a8062',cape:'#3d2527',capeIn:'#5b3631',boot:'#272b2b'}:type==='guard'||type==='revenant'?{skin:'#979180',cloth:'#635f4e',pants:'#313d3b',trim:'#9b8864',metal:'#878271',cape:'#3a4542',boot:'#33392f'}:{skin:'#9a9b87',cloth:'#4c5043',pants:'#3c4640',trim:'#807c60',metal:'#848677',boot:'#393d37'};
  e.rig=new E.Humanoid({size:spec.size,build:type==='boss'||type==='guard'?'bulky':'heroic',weapon:type==='cantor'?'staff':type==='hollow'?null:'sword',outfit:type==='cantor'?'robe':'coat',hair:'bald',hood:type==='cantor',hat:type==='boss'?{style:'crown',color:'#98805b'}:type==='guard'?{style:'helmet',color:'#73796a'}:null,eyeGlow:type==='cantor'?'#80d3d1':type==='boss'?'#ffc56b':'#d7b779',cape:type==='boss'?{len:12}:type==='revenant'?{len:8}:null,hunch:type==='hollow'?.16:0,colors:cols});
  if(type==='hollow'){e.rig.o.limbW*=.8;e.rig.o.torsoW*=.9;}if(type==='boss')e.rig.o.bladeLen*=1.35;
 }
 e.attack=new E.Attack(type==='boss'?'twohand':type==='guard'?'overhead':'claw',{wind:spec.wind,active:.13,recover:spec.recover});
 enemies.push(e);return e;
}
function buildContent(){
 props=[];objects=[];enemies=[];drops=[];hazards=[];shots=[];
 addObject('hearth','hearth',7,40,{name:'The Last Hearth'});addProp('brazier',7,40,51,111,{light:150,safe:true});
 addObject('npc','mora',10,40,{name:'Sister Mora'});addProp('statue',4,37,60,113,{light:60});addProp('candles',5,43,29,35,{light:75});addProp('graves',12,43,59,51);
 addObject('portal','return',11,37,{name:'Return gate'});addProp('portal',11,37,89,122,{light:80});
 addObject('chest','first',11,26,{name:'Traveller’s chest',reward:'pilgrim'});
 addObject('chest','cryptChest',5,5,{name:'Burial coffer',reward:'random'});
 addObject('chest','archiveChest',28,13,{name:'Scribe’s coffer',reward:'random'});
 addObject('chest','forgeChest',44,32,{name:'Forge coffer',reward:'random'});
 addObject('chest','ossuaryChest',25,43,{name:'The keeper’s chest',reward:'mercy',requires:'revenant'});
 addObject('lore','roadnote',5,24,{name:'A traveller’s note',title:'At the threshold',text:'The dead follow sound. Draw them through the narrow doors. When the bronze rises, step aside. A moment of patience is worth a sharpened blade.'});
 addObject('lore','book',21,7,{name:'The keeper’s record',title:'The price of a name',text:'Veyr promised that no one would be forgotten. He cast each name into the bell. Now the dead rise when it calls. We bound the bell with bone, names, and flame. Its keeper has the keys.'});
 addObject('lore','memorial',20,43,{name:'A lost letter',title:'For Morrow',text:'If I do not return, light a candle by the hearth. Tell Mora that I remembered the way home. Tell her the bell was never worth a single life.'});
 addObject('shrine','font',28,22,{name:'Stillwater font'});addProp('statue',28,22,52,100,{light:60});
 for(const s of SEAL_DATA){seals.push({...s,...pos(s.cx,s.cy),done:false});addObject('seal',s.id,s.cx,s.cy,{name:s.name,room:s.room});}
 addObject('gate','choirGate',39,19,{name:'The threefold gate'});
 addObject('ember','lastEmber',40,5,{name:'The last ember'});addProp('bell',40,5,147,147,{light:50});
 for(const [x,y]of [[7,22],[14,22],[7,26],[14,26],[6,9],[11,9],[22,10],[28,10],[23,24],[28,27],[38,26],[43,26],[22,40],[28,40],[38,7],[43,7],[38,13],[43,13]])addProp('column',x,y,47,91);
 for(const [x,y]of [[6,30],[10,29],[5,19],[16,20],[5,13],[13,5],[20,20],[29,29],[20,14],[29,5],[36,23],[44,28],[20,36],[29,44],[36,15],[44,4],[38,20],[40,20]])addProp('brazier',x,y,37,80,{light:105});
 for(const [x,y]of [[4,8],[13,12],[6,12],[21,38],[29,38],[21,44]])addProp('sarcophagus',x,y,72,49);
 for(const [x,y]of [[4,12],[12,5],[13,27],[17,24],[29,14],[36,31],[44,23],[27,38]])addProp('graves',x,y,44,42);
 for(const [x,y]of [[4,38],[10,43],[8,19],[12,19],[9,6],[24,7],[26,7],[41,28],[40,6],[20,5],[29,15]])addProp('candles',x,y,27,31,{light:44});
 addProp('book',21,7,36,49);addProp('book',5,24,32,44);addProp('book',20,43,32,44);
 // Encounters grow from single threats to mixed groups. Room IDs gate each seal.
 const roster={
  nave:[['hollow',9,27],['hollow',12,23],['skitter',15,24],['hollow',10,20],['skitter',6,21]],
  crypt:[['hollow',8,17],['hollow',8,13],['skitter',12,11],['hollow',5,10],['cantor',12,6],['hollow',7,7],['guard',9,8]],
  crossing:[['hollow',21,25],['skitter',26,28],['skitter',29,24],['cantor',27,21]],
  scriptorium:[['hollow',24,17],['cantor',21,11],['cantor',28,7],['hollow',25,12],['skitter',26,10],['guard',24,8]],
  furnace:[['skitter',33,26],['hollow',37,30],['cantor',44,24],['skitter',40,24],['skitter',41,32],['guard',40,28],['hollow',44,30]],
  ossuary:[['hollow',24,33],['hollow',24,38],['cantor',28,42],['skitter',21,41],['revenant',25,41]],
  choir:[['hollow',39,21],['cantor',37,15],['guard',43,14],['boss',40,9]]
 };
 for(const [room,list]of Object.entries(roster))for(const [type,x,y]of list)spawnEnemy(type,x,y,{room});
}
function newState(){
 state={version:1,seed:(Date.now()>>>0)||135791,level:1,xp:0,blessings:{blade:0,will:0,vigor:0},pendingBlessings:0,spellBonus:0,coins:0,potions:3,maxPotions:5,kills:0,deaths:0,elapsed:0,itemSerial:0,inventory:[],equipment:{},opened:[],read:[],fontUsed:false,sideQuest:false,ember:false,complete:false,intro:false,bossDefeated:false,shrineVisits:0,town:T.newState()};
 state.equipment.weapon=item('startblade');state.equipment.armor=item('startcoat');state.equipment.charm=null;
}
function initRun(saved=null){
 if(saved)saved=migrateSave(saved);
 if(saved)state=saved.state;else newState();
 seals=[];map=makeMap();buildContent();town.build();
 explored=saved?.explored?.length===W*H?saved.explored.slice():new Array(W*H).fill(0);
 const spawn=pos(...T.SPAWN);hero=new E.Body({...spawn,r:6.2});hero.facing=-Math.PI*.75;
 if(saved){
  for(const id of saved.seals||[]){const s=seals.find(s=>s.id===id);if(s)s.done=true;}
  if(seals.every(s=>s.done))openGate(false);
  for(const rec of saved.enemies||[]){const e=enemies.find(e=>e.id===rec.id);if(!e)continue;if(rec.dead){e.dead=true;e.hp=0;e.deathT=9;}else if(Number.isFinite(rec.hp)){e.hp=clamp(rec.hp,1,e.maxHp);}}
  drops=(saved.drops||[]).filter(d=>d&&Number.isFinite(d.x)&&Number.isFinite(d.y));
  if(saved.hero&&Number.isFinite(saved.hero.x)&&Number.isFinite(saved.hero.y)&&map.walkable(Math.floor(saved.hero.x/TILE),Math.floor(saved.hero.y/TILE)))Object.assign(hero,{x:saved.hero.x,y:saved.hero.y});
  returnPoint=saved.returnPoint||null;
 }else returnPoint=null;
 enemyFlow=new E.FlowField(map);
 const st=totalStats();hero.hp=saved?clamp(saved.hero?.hp||st.maxHp,1,st.maxHp):st.maxHp;hero.mp=saved?clamp(saved.hero?.mp??st.maxMp,0,st.maxMp):st.maxMp;
 rig=new E.Humanoid({size:1.17,build:'heroic',neck:.65,torsoW:3.8,shoulderHalf:4.1,limbW:2.2,weapon:'sword',outfit:'coat',hat:{style:'helmet',color:'#737c73'},hood:true,cape:{len:11,width:6},sleeves:'long',colors:{skin:'#9e9c86',hair:'#303633',cloth:'#465553',coat:'#495451',pants:'#293a3c',boot:'#252f30',belt:'#716348',trim:'#bca571',glove:'#666957',metal:'#aeb6a8',hilt:'#947748',cape:'#4c3935',capeIn:'#763f38'}});
 blade=new E.Attack('slash',{wind:.105,active:.13,recover:.21});
 path=[];commandTarget=null;castCd=0;castPose=0;dodgeT=0;dodgeCd=0;wardT=0;wardCd=0;hurtT=0;recallT=0;bossActive=false;hoverEnemy=null;nearestObject=null;lastHit=-100;currentArea='';uiClock=0;visionClock=0;saveClock=0;attackIndex=0;
 game.follow(hero,{z:26});game.cam.smooth=.13;game.cam.bounds=null;game.cam.snap=true;
 mode='play';panel=null;$('title-screen').hidden=true;$('hud').hidden=false;$('modal-layer').hidden=true;$('screen').focus();
 game.setView(town.isTown()?townView:view);playMusic(town.isTown()?'town':'dungeon');updateVision();updateHUD();
 if(!saved){toast('The last hearth still burns.','legendary');showHint('Welcome to Hearthstead. Press <kbd>B</kbd> for people and places. Press <kbd>E</kbd> to speak or interact.');showPanel('intro');}
 else{$('tutorial').hidden=true;toast('Your descent continues. Press B to explore Hearthstead.');if(state.complete)showPanel('victory');else if(state.pendingBlessings)showPanel('level');}
 saveGame();
}
function migrateSave(raw){
 if(!raw||typeof raw!=='object')return raw;
 const s=JSON.parse(JSON.stringify(raw));
 if(Array.isArray(s.explored)&&s.explored.length===W*T.LEGACY_HEIGHT)s.explored=s.explored.concat(new Array(W*(H-T.LEGACY_HEIGHT)).fill(0));
 if(s.state&&s.state.town===undefined)s.state.town=T.newState();
 return s;
}
function validSave(s){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const number=(v,min=0,max=1e7)=>Number.isFinite(v)&&v>=min&&v<=max;
 const integer=(v,min=0,max=1e7)=>Number.isSafeInteger(v)&&number(v,min,max);
 const point=p=>record(p)&&number(p.x,0,W*TILE)&&number(p.y,0,H*TILE);
 const strings=a=>Array.isArray(a)&&a.length<100&&a.every(v=>typeof v==='string'&&v.length<100);
 const validItem=it=>record(it)&&typeof it.id==='string'&&typeof it.key==='string'&&typeof it.name==='string'&&it.name.length<160&&typeof it.desc==='string'&&it.desc.length<1000&&['weapon','armor','charm'].includes(it.slot)&&['common','rare','legendary'].includes(it.rarity)&&integer(it.value)&&['attack','armor','spell','hp','mp','leech'].every(k=>it[k]===undefined||number(it[k],0,1000));
 if(!record(s)||s.version!==1||!record(s.state)||!point(s.hero)||!number(s.hero.hp,1,100000)||!number(s.hero.mp,0,100000))return false;
 const v=s.state;
 if(v.version!==1||!integer(v.level,1,29)||!integer(v.seed,0,4294967295)||!record(v.blessings)||!['blade','will','vigor'].every(k=>integer(v.blessings[k],0,29)))return false;
 if(!['xp','pendingBlessings','spellBonus','coins','kills','deaths','itemSerial','shrineVisits'].every(k=>integer(v[k]))||!number(v.elapsed)||!integer(v.maxPotions,5,7)||!integer(v.potions,0,v.maxPotions))return false;
 if(!['fontUsed','sideQuest','ember','complete','intro','bossDefeated'].every(k=>typeof v[k]==='boolean')||!['sideReward','boughtCharm'].every(k=>v[k]===undefined||typeof v[k]==='boolean'))return false;
 if(!T.valid(v.town)||!v.town.stash.every(validItem))return false;
 if(!strings(v.opened)||!strings(v.read)||!Array.isArray(v.inventory)||v.inventory.length>24||!v.inventory.every(validItem)||!record(v.equipment))return false;
 if(!['weapon','armor','charm'].every(k=>v.equipment[k]===null||(validItem(v.equipment[k])&&v.equipment[k].slot===k)))return false;
 if(!Array.isArray(s.enemies)||s.enemies.length>100||!s.enemies.every(e=>record(e)&&typeof e.id==='string'&&typeof e.dead==='boolean'&&number(e.hp,-100000,100000)))return false;
 if(!strings(s.seals)||!s.seals.every(id=>SEAL_DATA.some(v=>v.id===id))||!Array.isArray(s.explored)||s.explored.length!==W*H||!s.explored.every(v=>v===0||v===1))return false;
 if(!Array.isArray(s.drops)||s.drops.length>200||!s.drops.every(d=>point(d)&&typeof d.id==='string'&&(['gold','flask','item'].includes(d.type))&&(d.type!=='item'||validItem(d.item))&&(d.type!=='gold'||integer(d.value))))return false;
 const ownedItems=[...v.inventory,...v.town.stash,...Object.values(v.equipment).filter(Boolean),...s.drops.filter(d=>d.type==='item').map(d=>d.item)];if(new Set(ownedItems.map(it=>it.id)).size!==ownedItems.length)return false;
 return s.returnPoint===null||point(s.returnPoint);
}
function getSave(){try{const s=migrateSave(E.store.get(SAVE_KEY,null));return validSave(s)?s:null;}catch{return null;}}
function saveGame(){
 if(!state||!hero||hero.hp<=0||mode==='title')return false;
 const data={version:1,mapRevision:2,mapWidth:W,mapHeight:H,state:JSON.parse(JSON.stringify(state)),hero:{x:hero.x,y:hero.y,hp:hero.hp,mp:hero.mp},enemies:enemies.map(e=>({id:e.id,dead:e.dead,hp:e.hp})),seals:seals.filter(s=>s.done).map(s=>s.id),drops:JSON.parse(JSON.stringify(drops)),explored,returnPoint};
 const ok=E.store.set(SAVE_KEY,data);saveAvailable=ok;
 $('save-status').textContent=ok?'Progress saved on this device':'Save unavailable in this browser';$('save-status').classList.toggle('save-warning',!ok);
 return ok;
}
function toast(text,kind=''){const el=document.createElement('div');el.className='toast '+kind;el.textContent=text;$('toast-region').appendChild(el);while($('toast-region').children.length>4)$('toast-region').firstChild.remove();setTimeout(()=>el.remove(),4500);}
function showHint(html){$('tutorial-text').innerHTML=html;$('tutorial').hidden=false;}
function hintOnce(id,html){if(seenTutorials.has(id))return;seenTutorials.add(id);showHint(html);}
function announce(title,kicker='THE HOLLOW BELL'){$('location-title').textContent=title;$('location-kicker').textContent=kicker;$('location-banner').classList.add('visible');clearTimeout(announce.timer);announce.timer=setTimeout(()=>$('location-banner').classList.remove('visible'),3400);}
function openGate(notify=true){for(let x=38;x<=40;x++)map.set(x,19,0);if(notify){sound('bell');announce('The choir is open','THREE SEALS BROKEN');toast('The threefold gate is open. Seek the Hollow Choir.','legendary');}if(enemyFlow)enemyFlow.tx=-1;}
function gainXP(amount){state.xp+=amount;while(state.xp>=xpNeed()){state.xp-=xpNeed();state.level++;state.pendingBlessings++;const st=totalStats();hero.hp=st.maxHp;hero.mp=st.maxMp;sound('level');toast(`Level ${state.level}. A new blessing waits.`,'legendary');game.particles.glints(hero.x,hero.y,20,18,'#f2d08c');}}
function xpNeed(){return 55+(state.level-1)*45;}
function makeRandomItem(tier=1){
 const slots=['weapon','armor','charm'],slot=slots[Math.floor(rng()*3)],rare=rng()>.36,names={weapon:['Ashsteel Falchion','Keeper’s Knife','Bronze Longsword'],armor:['Sootbound Mail','Pilgrim’s Mantle','Gravewarden Coat'],charm:['Ember Locket','Quiet Ring','Worn Reliquary']};
 const it={id:`i${++state.itemSerial}`,key:'random',name:names[slot][Math.floor(rng()*3)],slot,rarity:rare?'rare':'common',value:12+tier*5+(rare?10:0),desc:'Recovered from the silence below the abbey.'};
 if(slot==='weapon'){it.attack=3+tier*2+Math.floor(rng()*3);if(rare)it.spell=2+tier;}
 if(slot==='armor'){it.armor=2+tier;if(rare)it.hp=6+tier*3;}
 if(slot==='charm'){it.mp=6+tier*3;if(rare)it.spell=2+tier;else it.hp=8;}
 return it;
}
function addInventory(it){if(state.inventory.length>=24){toast('The satchel is full. Sell an item at the hearth.','error');return false;}state.inventory.push(it);pendingLootNotice=true;$('new-loot-dot').hidden=false;toast(it.name+' added to your satchel.',it.rarity);sound('loot');saveGame();return true;}
function damageEnemy(e,amount,kind='blade'){
 if(e.dead)return;const damage=Math.max(1,Math.round(amount-(e.type==='boss'?2:e.type==='guard'?1:0)));e.hp-=damage;e.hit=.17;e.active=true;
 if(e.type!=='boss'&&e.type!=='guard'&&e.type!=='revenant'){e.stun=.18;e.phase='idle';e.t=0;e.cool=Math.max(e.cool,.28);}
 const a=Math.atan2(e.body.y-hero.y,e.body.x-hero.x);e.kx=Math.cos(a)*(e.type==='boss'?12:65);e.ky=Math.sin(a)*(e.type==='boss'?12:65);
 game.hitFx(e.body.x,e.body.y,17,{power:e.type==='boss'?.8:.65,damage,angle:a,color:kind==='spell'?'#efbb69':'#d3cab0',sound:'impact',textColor:kind==='spell'?'#f3be76':'#eee3c7'});
 if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
 if(e.dead)return;e.dead=true;e.hp=0;e.deathT=0;e.phase='idle';e.body.vx=e.body.vy=0;state.kills++;
 game.particles.bits(e.body.x,e.body.y,12,8,['#594e43','#776b51','#393b35']);
 // Echoes belong to one boss attempt. They grant no repeatable loot or experience.
 if(e.summoned){const heal=totalStats().leech;if(heal)hero.hp=Math.min(totalStats().maxHp,hero.hp+heal);return;}
 gainXP(e.xp);
 const gold=e.type==='boss'?85:e.type==='guard'?18:5+Math.floor(rng()*7);drops.push({id:'gold'+e.id,type:'gold',value:gold,x:e.body.x,y:e.body.y});
 if(e.type==='boss'){
  state.bossDefeated=true;bossActive=false;clearSummons();shots=[];hazards=[];sound('bell');game.shake(5);playMusic('dungeon');announce('The bell falls silent','PRIOR VEYR DEFEATED');toast('Take the last ember from the bell.','legendary');drops.push({id:'bossitem',type:'item',item:item('hearthkeeper'),x:e.body.x+14,y:e.body.y});saveGame();
 }else if(e.type==='revenant'){state.sideQuest=true;toast('The lost keeper is at rest. Return to Sister Mora.','legendary');}
 else if(rng()<.13){drops.push({id:'flask'+e.id,type:'flask',x:e.body.x+9,y:e.body.y});}
 else if(rng()<.12){drops.push({id:'item'+e.id,type:'item',item:makeRandomItem(Math.min(3,Math.ceil(state.level/2))),x:e.body.x+8,y:e.body.y});}
 const heal=totalStats().leech;if(heal)hero.hp=Math.min(totalStats().maxHp,hero.hp+heal);
}
function hurtPlayer(amount,source){
 if(mode!=='play'||panel||hero.hp<=0||hurtT>0||dodgeT>.035||roomAt(hero.x,hero.y)?.safe)return false;
 const factor=settings.difficulty==='story'?.7:settings.difficulty==='dread'?1.3:1;
 const damage=Math.max(1,Math.round((amount-totalStats().armor*.7)*factor*(wardT>0?.35:1)));
 hero.hp-=damage;hurtT=.38;lastHit=state.elapsed;recallT=0;
 sound('hurt',{vol:.7,pitch:.75});game.shake(2);game.particles.text(hero.x,hero.y,30,'−'+damage,'#ed947f',{bounce:false});
 if(source){const a=Math.atan2(hero.y-source.y,hero.x-source.x);hero.kx=Math.cos(a)*40;hero.ky=Math.sin(a)*40;}
 if(hero.hp<=0){hero.hp=0;mode='dead';sound('death');updateHUD();showPanel('death');}
 return true;
}
function nearestEnemy(range=80){return enemies.filter(e=>!e.dead&&e.type!=='boss'&&dist(hero,e.body)<range&&map.los(hero.x,hero.y,e.body.x,e.body.y)).sort((a,b)=>dist(hero,a.body)-dist(hero,b.body))[0]||enemies.find(e=>!e.dead&&e.type==='boss'&&dist(hero,e.body)<range&&bossActive);}
function startAttack(){
 if(mode!=='play'||panel||dodgeT>0||blade.busy||castPose>0)return false;
 const target=hoverEnemy&&!hoverEnemy.dead?hoverEnemy:commandTarget?.body&&!commandTarget.dead?commandTarget:nearestEnemy(55);
 if(target&&dist(hero,target.body)<75)hero.facing=Math.atan2(target.body.y-hero.y,target.body.x-hero.x);
 else if(game.mouseGround()){const m=game.mouseGround();hero.facing=Math.atan2(m[1]-hero.y,m[0]-hero.x);}
 if(attackWindow<=0)attackIndex=0;activeAttack=attackIndex;attackIndex=(attackIndex+1)%3;attackWindow=1.15;
 blade=new E.Attack(['slash','backslash','overhead'][activeAttack],{wind:activeAttack===2?.16:.085,active:.14,recover:activeAttack===2?.27:.19});blade.start();sound('blade',{pitch:activeAttack===2?.75:1});recallT=0;return true;
}
function castBolt(){
 if(mode!=='play'||panel||castCd>0||dodgeT>0||blade.busy||castPose>0)return false;
 if(hero.mp<12){if(game.input.pressed('skill'))toast('Not enough spirit. It restores over time.','error');return false;}
 hero.mp-=12;castCd=.58;castPose=.35;recallT=0;
 const target=hoverEnemy&&!hoverEnemy.dead?hoverEnemy:nearestEnemy(180);let angle=hero.facing;
 if(target)angle=Math.atan2(target.body.y-hero.y,target.body.x-hero.x);else{const m=game.mouseGround();if(m)angle=Math.atan2(m[1]-hero.y,m[0]-hero.x);}
 hero.facing=angle;sound('ember');shots.push({x:hero.x+Math.cos(angle)*10,y:hero.y+Math.sin(angle)*10,z:17,vx:Math.cos(angle)*240,vy:Math.sin(angle)*240,life:1.65,r:4,team:'hero',damage:totalStats().spell,color:'#efb45f'});return true;
}
function useWard(){if(mode!=='play'||panel||wardCd>0||blade.busy||castPose>0||dodgeT>0)return;if(hero.mp<25){toast('Ash ward needs 25 spirit.','error');return;}hero.mp-=25;wardT=4;wardCd=11;castPose=.45;sound('seal',{vol:.4,pitch:1.5});game.particles.ring(hero.x,hero.y,8,58,'#adcbc0');for(const e of enemies)if(!e.dead&&dist(hero,e.body)<56&&map.los(hero.x,hero.y,e.body.x,e.body.y))damageEnemy(e,18+state.blessings.will*3,'spell');toast('Ash ward: damage reduced for 4 seconds.');}
function dodge(){if(mode!=='play'||panel||dodgeCd>0)return;let m=game.input.move();let d=game.view.screenDirToGround(...m);if(Math.hypot(...d)<.1){const p=game.mouseGround();d=p?[p[0]-hero.x,p[1]-hero.y]:[Math.cos(hero.facing),Math.sin(hero.facing)];const l=Math.hypot(...d)||1;d=[d[0]/l,d[1]/l];}dodgeDir=d;dodgeT=.26;dodgeCd=1.25;blade.cancel();path=[];commandTarget=null;recallT=0;sound('whoosh',{pitch:.7,vol:.5});}
function usePotion(){if(mode!=='play'||panel)return;const max=totalStats().maxHp;if(state.potions<=0){toast('No flask charges. Refill at the hearth.','error');return;}if(hero.hp>=max){toast('Health is full.');return;}state.potions--;hero.hp=Math.min(max,hero.hp+Math.round(max*.55));sound('heal');game.particles.glints(hero.x,hero.y,16,12,'#da8a69');toast('Healing flask used.');updateHUD();saveGame();}
function beginRecall(){if(mode!=='play'||panel)return;if(roomAt(hero.x,hero.y)?.safe){if(returnPoint){const p=returnPoint;returnPoint=null;hero.x=p.x;hero.y=p.y;hero.vx=hero.vy=0;path=[];game.cam.snap=true;sound('portal');toast('Returned to the descent.');saveGame();}else if(!town.isTown())town.travel('town');else toast('No return point yet. Use the north road to enter the abbey.');return;}if(bossActive){toast('The bell seals this chamber. Defeat its keeper.','error');return;}if(state.elapsed-lastHit<4||enemies.some(e=>!e.dead&&e.active&&dist(hero,e.body)<90)){toast('Find a quiet place before you recall.','error');return;}recallT=1.6;recallPoint={x:hero.x,y:hero.y};path=[];commandTarget=null;sound('portal');toast('Hold still. The hearth is calling.');}
function completeRecall(){returnPoint={x:hero.x,y:hero.y};const p=pos(...T.SPAWN);hero.x=p.x;hero.y=p.y;hero.vx=hero.vy=0;recallT=0;game.cam.snap=true;for(const e of enemies)e.active=false;toast('The hearth welcomes you. Press T to return.');saveGame();}
function setDestination(x,y,target=null){
 const sx=Math.floor(hero.x/TILE),sy=Math.floor(hero.y/TILE);let tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
 if(!map.walkable(tx,ty)){let found=null;for(let r=1;r<=2&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r&&!found;dx++)if(map.walkable(tx+dx,ty+dy))found=[tx+dx,ty+dy];if(!found)return false;[tx,ty]=found;}
 const route=C.path(map,sx,sy,tx,ty);if(!route.length&&!(sx===tx&&sy===ty)){toast('No open path.','error');return false;}
 path=route;if(map.walkable(Math.floor(x/TILE),Math.floor(y/TILE)))path.push([x,y]);
 commandTarget=target;clickMark={x:(tx+.5)*TILE,y:(ty+.5)*TILE,t:.9};return true;
}
function clickWorld(){if(hoverEnemy){commandTarget=hoverEnemy;setDestination(hoverEnemy.body.x,hoverEnemy.body.y,hoverEnemy);if(dist(hero,hoverEnemy.body)<35)startAttack();return;}if(hoverObject){if(dist(hero,hoverObject)<43){interact(hoverObject);return;}setDestination(hoverObject.x,hoverObject.y,hoverObject);return;}const m=game.mouseGround();if(m)setDestination(m[0],m[1]);}
function interact(o=nearestObject){
 if(!o||mode!=='play'||panel||dist(hero,o)>52)return;
 if(town.interact(o))return;
 if(o.type==='npc'){town.meet('mora');return;}
 if(o.type==='hearth'){const st=totalStats();hero.hp=st.maxHp;hero.mp=st.maxMp;state.potions=state.maxPotions;state.shrineVisits++;sound('heal');showPanel('hearth');saveGame();return;}
 if(o.type==='portal'){beginRecall();return;}
 if(o.type==='gate'){if(seals.every(s=>s.done))toast('The way to the choir is open.');else toast(`${3-seals.filter(s=>s.done).length} seals still bind this gate.`,'error');return;}
 if(o.type==='chest'){
  if(state.opened.includes(o.id)){toast('The coffer is empty.');return;}
  if(o.requires&&enemies.some(e=>e.type===o.requires&&!e.dead)){toast('The lost keeper still guards this coffer.','error');return;}
  const it=o.reward==='random'?makeRandomItem(Math.min(3,Math.ceil(state.level/2))):item(o.reward);
  if(!addInventory(it))return;state.opened.push(o.id);state.coins+=8+Math.floor(rng()*10);sound('door',{pitch:.7,vol:.6});game.particles.glints(o.x,o.y,10,12,'#e6c475');saveGame();hintOnce('loot','Press <kbd>I</kbd> to inspect your loot. Equip an item to change your stats.');return;
 }
 if(o.type==='seal'){
  const s=seals.find(s=>s.id===o.id);if(s.done){toast('This seal is broken.');return;}
  const guards=enemies.filter(e=>e.room===s.room&&!e.dead);if(guards.length){for(const e of guards)e.markedGuardian=true;toast(`Defeat the ${guards.length} remaining ${guards.length===1?'guardian':'guardians'}. Red marks on the map show their positions.`,'error');return;}
  selectedItem=s;showPanel('seal');return;
 }
 if(o.type==='lore'){if(!state.read.includes(o.id))state.read.push(o.id);selectedItem=o;showPanel('lore');saveGame();return;}
 if(o.type==='shrine'){if(state.fontUsed){toast('The stillwater font is dry.');return;}const st=totalStats();hero.hp=st.maxHp;hero.mp=st.maxMp;state.potions=Math.min(state.maxPotions,state.potions+2);state.fontUsed=true;sound('heal');toast('The font restores health, spirit, and two flask charges.');saveGame();return;}
 if(o.type==='ember'){if(!state.bossDefeated){toast('The last ember is bound to the bell keeper.','error');return;}if(state.ember){toast('Bring the ember to Sister Mora.');return;}state.ember=true;sound('seal');game.particles.glints(o.x,o.y,24,25,'#ffd085');announce('Carry the fire home','THE LAST EMBER RECOVERED');toast('Return to Sister Mora. Recall is now available.','legendary');saveGame();return;}
 if(o.type==='itemdrop'){const d=drops.find(d=>d.id===o.id);if(d&&addInventory(d.item)){drops=drops.filter(v=>v!==d);saveGame();}}
}
function breakSeal(s){
 if(s.done)return;s.done=true;sound('seal');game.shake(3);game.particles.ring(s.x,s.y,5,100,'#f0bd70');game.particles.glints(s.x,s.y,15,22,'#f5ca80');
 if(s.reward==='spellbook'){state.spellBonus+=7;hero.mp=Math.min(totalStats().maxMp,hero.mp+30);toast('Cinder bolt strengthened: +7 spell damage.','rare');}
 else{const it=item(s.reward);if(!addInventory(it))drops.push({id:'sealreward'+s.id,type:'item',item:it,x:s.x+12,y:s.y});}
 gainXP(25);state.potions=Math.min(state.maxPotions,state.potions+1);closePanel();announce(s.name+' broken','ONE VOICE FALLS SILENT');if(seals.every(s=>s.done))openGate();saveGame();
}
function clearSummons(){for(const e of enemies)if(e.summoned)e.dead=true;enemies=enemies.filter(e=>!e.summoned);}
function respawn(){
 clearSummons();
 closePanel();state.deaths++;state.coins=Math.floor(state.coins*.9);const st=totalStats(),p=pos(...T.SPAWN);hero.x=p.x;hero.y=p.y;hero.hp=st.maxHp;hero.mp=st.maxMp;hero.vx=hero.vy=0;hero.kx=hero.ky=0;state.potions=Math.max(3,state.potions);mode='play';bossActive=false;shots=[];hazards=[];path=[];commandTarget=null;dodgeT=0;wardT=0;hurtT=1;blade.cancel();
 for(const e of enemies)if(!e.dead){e.hp=e.maxHp;e.active=false;e.body.x=e.home.x;e.body.y=e.home.y;e.phase='idle';e.t=0;e.cool=1;e.phaseTwo=false;e.kx=e.ky=0;}
 game.cam.snap=true;currentArea='';playMusic('dungeon');toast('The hearth restores you. Cleared rooms remain clear.');updateHUD();saveGame();
}
function finishRun(){state.complete=true;closePanel();playMusic('victory');sound('level');saveGame();showPanel('victory');}
function updateVision(){
 if(!map||!hero)return;const cx=Math.floor(hero.x/TILE),cy=Math.floor(hero.y/TILE);
 for(let y=cy-8;y<=cy+8;y++)for(let x=cx-8;x<=cx+8;x++){if(x<0||y<0||x>=W||y>=H)continue;const p=pos(x,y);if(dist(hero,p)<TILE*8&&(map.los(hero.x,hero.y,p.x,p.y)||dist(hero,p)<TILE*2.3))explored[y*W+x]=1;}
}
function canSee(x,y,extra=0){if(town?.isTown()&&y>=47*TILE)return dist(hero,{x,y})<300+extra;return dist(hero,{x,y})<195+extra&&map.los(hero.x,hero.y,x,y);}
function updateHover(){
 const mouse=game.input.mouseScreen();hoverEnemy=null;hoverObject=null;if(!mouse)return;
 const mx=mouse[0]-game.r.ix,my=mouse[1]-game.r.iy;
 let best=60;
 for(const e of enemies){if(e.dead||!canSee(e.body.x,e.body.y)||e.type==='boss'&&!seals.every(s=>s.done))continue;const p=game.r.w(e.body.x,e.body.y,18*e.size);const d=Math.hypot(p[0]-mx,(p[1]-my)*.75);if(d<34*e.size&&d<best){hoverEnemy=e;best=d;}}
 if(hoverEnemy)return;
 best=80;
 const list=objects.concat(drops.filter(d=>d.type==='item').map(d=>({...d,type:'itemdrop',name:d.item.name})));
 for(const o of list){if(!canSee(o.x,o.y,30))continue;if(o.type==='ember'&&!state.bossDefeated)continue;const p=game.r.w(o.x,o.y,o.type==='seal'?0:15);const d=Math.hypot(p[0]-mx,p[1]-my);if(d<(o.type==='hearth'?40:33)&&d<best){hoverObject=o;best=d;}}
}
function updateNear(){
 nearestObject=null;let best=43;
 const list=objects.concat(drops.filter(d=>d.type==='item').map(d=>({...d,type:'itemdrop',name:d.item.name})));
 for(const o of list){if(o.type==='herb'&&state.town.herbs.includes(o.herbId))continue;if(o.type==='watchlamp'&&state.town.lamps.includes(o.id))continue;if(o.type==='seal'&&seals.find(s=>s.id===o.id)?.done)continue;if(o.type==='chest'&&state.opened.includes(o.id))continue;if(o.type==='ember'&&(!state.bossDefeated||state.ember))continue;if(o.type==='portal'&&!returnPoint)continue;if(o.type==='gate'&&seals.every(s=>s.done))continue;if(o.type==='shrine'&&state.fontUsed)continue;const d=dist(hero,o);if(d<best&&map.los(hero.x,hero.y,o.x,o.y)){best=d;nearestObject=o;}}
}
function fireEnemyShot(e,angle,extra={}){shots.push({x:e.body.x+Math.cos(angle)*12,y:e.body.y+Math.sin(angle)*12,z:17,vx:Math.cos(angle)*(e.type==='boss'?125:105),vy:Math.sin(angle)*(e.type==='boss'?125:105),life:2.7,r:4,team:'enemy',damage:e.damage,color:e.type==='boss'?'#e7a366':'#9acdcc',...extra});sound('ember',{pitch:.55,vol:.3});}
function addHazard(x,y,rad,delay,damage,kind='circle',angle=0){hazards.push({x,y,rad,delay,damage,kind,angle,t:0,fired:false});}
function updateBoss(e,dt){
 if(bossActive&&roomAt(hero.x,hero.y)?.id!=='choir'){
  clearSummons();
  bossActive=false;e.hp=e.maxHp;e.body.x=e.home.x;e.body.y=e.home.y;e.body.vx=e.body.vy=0;e.active=false;e.phase='idle';e.cool=1;e.phaseTwo=false;e.pattern=0;shots=[];hazards=[];playMusic('dungeon');toast('The keeper returns to the bell. Its strength is restored.');return;
 }
 const d=dist(hero,e.body);if(!bossActive){if(roomAt(hero.x,hero.y)?.id!=='choir'||!seals.every(s=>s.done))return;bossActive=true;e.active=true;playMusic('boss');sound('bell');announce('Prior Veyr','THE BELLBOUND');hintOnce('boss','Watch the marked ground. Use <kbd>SPACE</kbd> to cross a shockwave. Strike after the bell falls.');}
 if(!e.phaseTwo&&e.hp<e.maxHp*.5){e.phaseTwo=true;e.phase='recovery';e.t=1.5;e.pattern=0;sound('bell');announce('The second toll','THE BELL CALLS ITS DEAD');
  for(const [dx,dy]of [[-2,1],[2,1]]){const p=map.toCell(e.body.x,e.body.y);if(map.walkable(p[0]+dx,p[1]+dy))spawnEnemy('skitter',p[0]+dx,p[1]+dy,{room:'choir',active:true,summoned:true});}
  for(let i=0;i<8;i++)fireEnemyShot(e,i*Math.PI/4,{damage:15});
 }
 if(e.stun>0)return;
 e.t-=dt;e.cool-=dt;e.body.vx=e.body.vy=0;
 if(e.phase==='wind'){
  if(e.t<=0){const angle=e.attackAngle;switch(e.attackKind){
   case 'sweep':if(d<e.range+18&&Math.abs(E.angDiff(angle,Math.atan2(hero.y-e.body.y,hero.x-e.body.x)))<1.2)hurtPlayer(e.damage,e.body);game.particles.ring(e.body.x,e.body.y,7,58,'#caa173');break;
   case 'toll':for(let n=0;n<(e.phaseTwo?12:9);n++)fireEnemyShot(e,n*Math.PI*2/(e.phaseTwo?12:9));game.particles.ring(e.body.x,e.body.y,5,75,'#d2aa73');break;
   case 'rupture':addHazard(e.aimX,e.aimY,42,.65,28);if(e.phaseTwo){addHazard(e.aimX+52,e.aimY,30,.9,20);addHazard(e.aimX-52,e.aimY,30,.9,20);}break;
  }sound('bossSlam',{vol:.6});game.shake(3);e.phase='recovery';e.t=e.phaseTwo?.8:1.05;}
 }else if(e.phase==='recovery'){if(e.t<=0){e.phase='idle';e.cool=.2;}}
 else if(e.cool<=0){
  e.attackKind=d<57&&e.pattern%3!==2?'sweep':e.pattern%2===0?'toll':'rupture';e.pattern++;e.phase='wind';e.t=e.attackKind==='toll'?1.15:e.attackKind==='sweep'?.95:1.0;e.windTotal=e.t;e.attackAngle=Math.atan2(hero.y-e.body.y,hero.x-e.body.x);e.aimX=hero.x;e.aimY=hero.y;e.facing=e.attackAngle;e.attack.start();
 }else if(d>42){const dir=enemyFlow.dir(e.body.x,e.body.y,hero.x,hero.y);e.body.vx=dir[0]*e.speed;e.body.vy=dir[1]*e.speed;e.facing=Math.atan2(dir[1],dir[0]);}
 e.body.vx+=(e.kx||0);e.body.vy+=(e.ky||0);e.body.update(dt,map);
}
function updateEnemies(dt){
 enemyFlow.update(hero.x,hero.y);
 for(const e of enemies){
  e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);e.kx=(e.kx||0)*Math.exp(-dt*12);e.ky=(e.ky||0)*Math.exp(-dt*12);e.attack.update(dt);
  if(e.dead){e.deathT+=dt;updateRig(e,dt);continue;}
  const d=dist(hero,e.body),safe=roomAt(hero.x,hero.y)?.safe;
  if(e.type==='boss'){updateBoss(e,dt);updateRig(e,dt);continue;}
  if(safe){e.active=false;e.phase='idle';e.body.vx=e.body.vy=0;updateRig(e,dt);continue;}
  if(!e.active&&d<148&&map.los(hero.x,hero.y,e.body.x,e.body.y))e.active=true;
  if(e.active&&d>300){e.active=false;e.phase='idle';}
  if(!e.active){e.body.vx=e.body.vy=0;updateRig(e,dt);continue;}
  if(e.stun>0){e.body.vx=e.kx;e.body.vy=e.ky;e.body.update(dt,map);updateRig(e,dt);continue;}
  e.cool-=dt;e.body.vx=e.body.vy=0;
  if(e.phase==='wind'){
   e.t-=dt;if(e.t<=0){
    if(e.ranged){fireEnemyShot(e,e.attackAngle);}else if(d<e.range+12&&Math.abs(E.angDiff(e.attackAngle,Math.atan2(hero.y-e.body.y,hero.x-e.body.x)))<1.05&&map.los(e.body.x,e.body.y,hero.x,hero.y)){hurtPlayer(e.damage,e.body);}
    if(e.type==='guard')game.particles.ring(e.body.x,e.body.y,3,38,'#ba9866');
    e.phase='recovery';e.t=e.recover;e.cool=e.recover;
   }
  }else if(e.phase==='recovery'){e.t-=dt;if(e.t<=0)e.phase='idle';}
  else if(d<e.range&&e.cool<=0&&map.los(e.body.x,e.body.y,hero.x,hero.y)){
   e.phase='wind';e.t=e.wind;e.windTotal=e.wind;e.attackAngle=Math.atan2(hero.y-e.body.y,hero.x-e.body.x);e.facing=e.attackAngle;e.attack.start();
  }else{
   let dir=enemyFlow.dir(e.body.x,e.body.y,hero.x,hero.y);
   if(e.ranged&&d<65&&map.los(e.body.x,e.body.y,hero.x,hero.y)){dir=[-dir[0],-dir[1]];}
   else if(e.ranged&&d<140&&map.los(e.body.x,e.body.y,hero.x,hero.y))dir=[0,0];
   e.body.vx=dir[0]*e.speed;e.body.vy=dir[1]*e.speed;if(Math.hypot(...dir)>.1)e.facing=Math.atan2(dir[1],dir[0]);
  }
  e.body.vx+=e.kx;e.body.vy+=e.ky;e.body.update(dt,map);
  // Small separation prevents stacked attackers and keeps narrow doors usable.
  for(const other of enemies){if(other===e||other.dead||!other.active)continue;const dx=e.body.x-other.body.x,dy=e.body.y-other.body.y,len=Math.hypot(dx,dy),min=e.body.r+other.body.r+1;if(len>0&&len<min){e.body.x+=dx/len*(min-len)*.5;e.body.y+=dy/len*(min-len)*.5;}}
  map.collide(e.body);updateRig(e,dt);
 }
}
function updateRig(e,dt){
 if(e.type==='skitter'){e.rig.update(dt,{look:[Math.cos(e.facing),Math.sin(e.facing)],squash:e.dead?-.7:Math.sin(game.time*9+e.body.x)*.05,walk:e.dead?0:Math.min(1,Math.hypot(e.body.vx,e.body.vy)/50)});return;}
 e.rig.update(dt,{x:e.body.x,y:e.body.y,z:0,vx:e.body.vx,vy:e.body.vy,facing:e.facing,attack:e.attack.state,hurt:e.hit>0,pose:e.dead?'die':e.type==='cantor'&&e.phase==='wind'?'cast':e.type==='boss'&&e.phase==='wind'?'cast':null,stance:'ready'});
}
function updateProjectiles(dt){
 for(const b of shots){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.life<=0)continue;if(map.heightAt(b.x,b.y)>b.z||!map.walkable(Math.floor(b.x/TILE),Math.floor(b.y/TILE))){b.life=0;game.particles.sparks(b.x,b.y,b.z,3,null,{color:b.color});continue;}
  if(b.team==='hero'){for(const e of enemies)if(!e.dead&&Math.hypot(e.body.x-b.x,e.body.y-b.y)<e.body.r+b.r){damageEnemy(e,b.damage,'spell');b.life=0;game.particles.fire(b.x,b.y,12,4);break;}}
  else if(Math.hypot(hero.x-b.x,hero.y-b.y)<hero.r+b.r){hurtPlayer(b.damage,b);b.life=0;}
 }
 shots=shots.filter(b=>b.life>0);
 for(const h of hazards){h.t+=dt;if(!h.fired&&h.t>=h.delay){h.fired=true;if(dist(hero,h)<h.rad)hurtPlayer(h.damage,h);game.particles.ring(h.x,h.y,6,h.rad+10,'#e4ad6a');game.particles.sparks(h.x,h.y,5,12);game.shake(1.5);}}
 hazards=hazards.filter(h=>h.t<h.delay+.55);
}
function update(dt){
 if(mode==='title'){if(game.input.pressed('start')&&!panel)requestNewGame();return;}
 const inp=game.input;
 if(inp.pressed('pause')){if(panel&&panel!=='death'&&panel!=='victory'&&panel!=='level')closePanel();else if(!panel)showPanel('pause');return;}
 for(const [key,name]of [['inventory','inventory'],['journal','journal'],['map','map'],['help','controls'],['town','town']])if(inp.pressed(key)){if(panel===name)closePanel();else if(!panel)showPanel(name);return;}
 if(panel||mode!=='play')return;
 const wantedView=town.isTown()?townView:view;if(game.view!==wantedView)game.setView(wantedView);state.elapsed+=dt;town.update(dt);uiClock-=dt;visionClock-=dt;saveClock+=dt;particleClock-=dt;
 hurtT=Math.max(0,hurtT-dt);castCd=Math.max(0,castCd-dt);castPose=Math.max(0,castPose-dt);wardT=Math.max(0,wardT-dt);wardCd=Math.max(0,wardCd-dt);dodgeCd=Math.max(0,dodgeCd-dt);dodgeT=Math.max(0,dodgeT-dt);attackWindow-=dt;
 const st=totalStats();hero.mp=Math.min(st.maxMp,hero.mp+dt*(2.5+state.blessings.will*.25));
 if(visionClock<=0){updateVision();visionClock=.16;}
 updateHover();updateNear();
 if(inp.pressed('command'))clickWorld();
 if(inp.pressed('interact'))interact();
 if(inp.pressed('potion'))usePotion();if(inp.pressed('ward'))useWard();if(inp.pressed('dash'))dodge();if(inp.pressed('recall'))beginRecall();
 if(panel)return;
 if(inp.down('skill'))castBolt();
 if(inp.down('attack'))startAttack();
 if(inp.down('command')&&hoverEnemy&&!hoverEnemy.dead){commandTarget=hoverEnemy;if(dist(hero,hoverEnemy.body)<38)startAttack();}
 blade.update(dt);
 blade.hits(enemies,e=>!e.dead&&E.inArc(hero,hero.facing,e.body,29,1.12)&&map.los(hero.x,hero.y,e.body.x,e.body.y),e=>damageEnemy(e,st.attack*(activeAttack===2?1.5:1)));
 let move=inp.move(),dir=game.view.screenDirToGround(...move),speed=town.isTown()?88:68;
 if(Math.hypot(...dir)>.1){path=[];commandTarget=null;recallT=0;}
 else if(commandTarget){
  if(commandTarget.body){if(commandTarget.dead){commandTarget=null;path=[];}else if(dist(hero,commandTarget.body)<34){path=[];startAttack();}else if(!path.length||dist({x:path.at(-1)[0],y:path.at(-1)[1]},commandTarget.body)>24)setDestination(commandTarget.body.x,commandTarget.body.y,commandTarget);}
  else if(dist(hero,commandTarget)<39){const o=commandTarget;commandTarget=null;path=[];interact(o);}
 }
 if(panel)return;
 if(Math.hypot(...dir)<.1&&path.length){const p=path[0],dx=p[0]-hero.x,dy=p[1]-hero.y,len=Math.hypot(dx,dy);if(len<4)path.shift();else dir=[dx/len,dy/len];}
 if(blade.busy)speed*=.18;if(castPose>0)speed*=.45;
 if(recallT>0){dir=[0,0];recallT-=dt;if(recallPoint&&Math.hypot(hero.x-recallPoint.x,hero.y-recallPoint.y)>10)recallT=0;else if(recallT<=0)completeRecall();}
 if(dodgeT>0){dir=dodgeDir;speed=230;}
 hero.kx=(hero.kx||0)*Math.exp(-dt*13);hero.ky=(hero.ky||0)*Math.exp(-dt*13);hero.vx=dir[0]*speed+hero.kx;hero.vy=dir[1]*speed+hero.ky;
 if(Math.hypot(...dir)>.1&&!blade.busy&&castPose<=0)hero.facing=Math.atan2(dir[1],dir[0]);
 hero.update(dt,map);
 if(clickMark){clickMark.t-=dt;if(clickMark.t<=0)clickMark=null;}
 if(state.pendingBlessings&&!enemies.some(e=>!e.dead&&e.active&&dist(hero,e.body)<110)&&!bossActive){showPanel('level');return;}
 updateEnemies(dt);updateProjectiles(dt);
 rig.update(dt,{x:hero.x,y:hero.y,z:0,vx:hero.vx,vy:hero.vy,facing:hero.facing,attack:blade.state,hurt:hurtT>.2,dash:dodgeT>0,pose:recallT>0||castPose>0?'cast':null,stance:'ready'});
 for(const d of drops){if(d.type==='gold'&&dist(hero,d)<25){state.coins+=d.value;d.collected=true;sound('loot',{vol:.35,pitch:1.3});}else if(d.type==='flask'&&dist(hero,d)<23&&state.potions<state.maxPotions){state.potions++;d.collected=true;toast('A flask charge recovered.');sound('loot',{vol:.5});}}
 drops=drops.filter(d=>!d.collected);
 const area=roomAt(hero.x,hero.y);if(!bossActive&&!state.complete)playMusic(town.isTown()?'town':'dungeon');if(area&&area.id!==currentArea){currentArea=area.id;announce(area.name,area.safe?'A LIGHT IN THE DARK':area.sub.toUpperCase());if(area.id==='nave')hintOnce('combat','Click an enemy or hold <kbd>F</kbd> to strike. Right-click or press <kbd>R</kbd> to cast.');if(area.id==='crossing')hintOnce('crossing','Three seals bind the bell. Explore each path. Press <kbd>TAB</kbd> to read your map.');}
 if(particleClock<=0){particleClock=.24;for(const p of props)if(p.type==='brazier'&&canSee(p.x,p.y))game.particles.add({kind:'ember',x:p.x,y:p.y,z:p.safe?36:27,vx:Math.sin(game.time)*3,vy:-2,vz:8,max:1.3,size:1,color:'#cda869'});if(dodgeT>0)game.particles.dust(hero.x,hero.y,1,3);if(wardT>0)game.particles.glints(hero.x,hero.y,12,1,'#a9d8c9');}
 if(uiClock<=0){uiClock=.1;updateHUD();}
 if(saveClock>18&&!bossActive&&state.elapsed-lastHit>3){saveClock=0;saveGame();}
}
function drawFloorMarks(r){
 if(clickMark){r.groundRing(clickMark.x,clickMark.y,7,'#c8b276',clickMark.t*.7);r.groundDisc(clickMark.x,clickMark.y,2,'#eee1b1',clickMark.t*.6);}
 for(const s of seals)if(canSee(s.x,s.y,80)){r.groundRing(s.x,s.y,26,s.done?'#596b5d':'#c0924d',s.done?.4:.65);if(!s.done)r.groundRing(s.x,s.y,21,'#e0a75a',.4+Math.sin(game.time*2)*.15);}
 if(hoverEnemy&&!hoverEnemy.dead)r.groundRing(hoverEnemy.body.x,hoverEnemy.body.y,hoverEnemy.body.r+5,'#d28b71',.85);
 if(wardT>0){r.groundRing(hero.x,hero.y,18,'#b4dacc',.8);r.groundRing(hero.x,hero.y,20,'#79a69e',.45);}
 if(recallT>0){r.groundRing(hero.x,hero.y,20+Math.sin(game.time*5)*3,'#a2d1c7',.9);r.groundDisc(hero.x,hero.y,15,'#5e9c98',.15);}
 for(const e of enemies){if(e.dead||e.phase!=='wind'||!canSee(e.body.x,e.body.y))continue;
  if(e.type==='boss'){
   if(e.attackKind==='sweep')r.groundArc(e.body.x,e.body.y,7,e.range+15,e.attackAngle-1.2,e.attackAngle+1.2,'#d96f47',.25+(.7-e.t*.4)*.15);
   else if(e.attackKind==='toll'){r.groundRing(e.body.x,e.body.y,55,'#e0a25b',.9);r.groundRing(e.body.x,e.body.y,55*(1-e.t/e.windTotal),'#edc886',.65);}
   else{r.groundDisc(e.aimX,e.aimY,42,'#c76742',.2);r.groundRing(e.aimX,e.aimY,42,'#d99763',.9);}
  }else if(!e.ranged){r.groundArc(e.body.x,e.body.y,4,e.range+9,e.attackAngle-.85,e.attackAngle+.85,'#d69062',e.type==='guard'?.36:.23);}
  else{r.groundRing(e.body.x,e.body.y,12,'#97cac5',.8);}
 }
 for(const h of hazards){if(!h.fired){r.groundDisc(h.x,h.y,h.rad,'#cf7754',.2);r.groundRing(h.x,h.y,h.rad,'#e4aa6e',.9);r.groundRing(h.x,h.y,h.rad*clamp(h.t/h.delay,0,1),'#f2c18c',.8);}else r.groundDisc(h.x,h.y,h.rad,'#d89761',.3*(1-(h.t-h.delay)/.55));}
}
function drawLighting(g,r){
 if(darkCanvas.width!==r.W||darkCanvas.height!==r.H){darkCanvas.width=r.W;darkCanvas.height=r.H;}
 const q=darkCanvas.getContext('2d');q.clearRect(0,0,r.W,r.H);q.globalCompositeOperation='source-over';q.fillStyle=`rgba(2,9,13,${clamp((town.isTown()?(state.complete?.34:.54):.93)-(settings.brightness-1)*.13,.26,.96)})`;q.fillRect(0,0,r.W,r.H);q.globalCompositeOperation='destination-out';
 function light(x,y,z,rad,strength){const p=r.w(x,y,z);q.globalAlpha=strength;q.drawImage(flashlights,p[0]-rad,p[1]-rad*.73,rad*2,rad*1.46);}
 light(hero.x,hero.y,19,310,1);
 for(const p of props)if(p.light&&dist(hero,p)<215&&canSee(p.x,p.y,65))light(p.x,p.y,20,p.light*(1+Math.sin(game.time*3+p.x)*.025),.73);
 for(const p of town.lightEntries())if(town.isTown())light(p.x,p.y,28,p.light,.66);
 for(const s of seals)if(!s.done&&canSee(s.x,s.y,30))light(s.x,s.y,0,100,.56);
 for(const b of shots)light(b.x,b.y,b.z,38,.5);
 q.globalAlpha=1;q.globalCompositeOperation='source-over';g.drawImage(darkCanvas,0,0);
 // A restrained warm spill gives the player’s lantern a visible home.
 const p=r.w(hero.x,hero.y,13);g.save();g.globalCompositeOperation='screen';g.globalAlpha=.035;g.fillStyle='#d6a163';g.beginPath();g.ellipse(p[0],p[1],150,95,0,0,Math.PI*2);g.fill();g.restore();g._c=null;
}
function drawWorldLabels(g,r){
 if(!settings.labels)return;
 if(hoverEnemy&&!hoverEnemy.dead&&canSee(hoverEnemy.body.x,hoverEnemy.body.y)){const p=r.w(hoverEnemy.body.x,hoverEnemy.body.y,44*hoverEnemy.size);E.ui.bar(g,p[0]-19,p[1]-4,38,3,hoverEnemy.hp/hoverEnemy.maxHp,'#b36852');}
 const o=hoverObject||nearestObject;if(o&&o.type!=='npc'&&o.type!=='citizen'&&canSee(o.x,o.y,30)){const p=r.w(o.x,o.y,o.type==='seal'?13:35);E.font.text(g,o.name,p[0],p[1]-8,'#e3cca0',{align:'center',shadow:'#071012',outline:'#071012'});}
 for(const d of drops)if(d.type==='item'&&canSee(d.x,d.y)){const p=r.w(d.x,d.y,11);E.font.text(g,d.item.name,p[0],p[1]-12,d.item.rarity==='legendary'?'#e6bc75':d.item.rarity==='rare'?'#9fc6cd':'#ccc9b7',{align:'center',outline:'#081014'});}
}
function draw(r){
 if(!map||!hero){r.sky(['#081014']);return;}
 map.drawFloor(r);map.queueWalls(r);r.decal(()=>drawFloorMarks(r));town.draw(r);
 for(const p of props){if(!canSee(p.x,p.y,80)&&!explored[Math.floor(p.y/TILE)*W+Math.floor(p.x/TILE)])continue;const alpha=p.type==='column'&&Math.abs(p.x-hero.x)<35&&Math.abs(p.y-hero.y)<35?.4:1;C.image(r,arts[p.type],p.x,p.y,0,p.w,p.h,alpha);}
 for(const o of objects){if(!canSee(o.x,o.y,50))continue;
  if(o.type==='chest'){const open=state.opened.includes(o.id);C.image(r,arts[open?'openChest':'chest'],o.x,o.y,0,open?59:56,open?62:47);}
  if(o.type==='seal'){const s=seals.find(s=>s.id===o.id);C.image(r,arts.seal,o.x,o.y,-1,87,58,s.done?.35:.9,-2);}
  if(o.type==='npc'||o.type==='citizen')town.drawCitizen(r,o);
  if(o.type==='ember'&&state.bossDefeated&&!state.ember){r.queue(o.x,o.y,33,g=>{const p=r.w(o.x,o.y,33+Math.sin(game.time*2)*3);r.glowDisc(g,p[0],p[1],19,'#f0b265',.4);E.px.poly(g,[[p[0],p[1]-9],[p[0]+5,p[1]],[p[0],p[1]+5],[p[0]-5,p[1]]] ,'#ffe6aa');});}
 }
 for(const d of drops){if(!canSee(d.x,d.y))continue;r.shadow(d.x,d.y,3,.35);r.queue(d.x,d.y,3,g=>{const p=r.w(d.x,d.y,3+Math.sin(game.time*2+d.x)*1.5);if(d.type==='gold'){E.px.ell(g,p[0],p[1],4,2,'#cfa455');E.px.dot(g,p[0]-1,p[1]-1,'#ffe0a0');}else if(d.type==='flask'){E.px.rect(g,p[0]-3,p[1]-6,6,7,'#873e36');E.px.rect(g,p[0]-2,p[1]-9,4,3,'#b8a583');E.px.rect(g,p[0]-2,p[1]-5,2,4,'#c47854');}else{const color=d.item.rarity==='legendary'?'#d7ac5c':'#86adb3';E.px.line(g,p[0],p[1],p[0],p[1]-25,color,1);E.px.poly(g,[[p[0],p[1]-7],[p[0]+5,p[1]-3],[p[0],p[1]+1],[p[0]-5,p[1]-3]],color);}});}
 for(const e of enemies){if(!canSee(e.body.x,e.body.y,30))continue;if(e.dead&&e.type==='skitter'&&e.deathT>3)continue;r.shadow(e.body.x,e.body.y,e.type==='boss'?18:8,e.dead?.23:.45);r.actor(e.body.x,e.body.y,0,(g,x,y)=>e.rig.draw(g,x,y,r.view),{outline:e.dead?false:'#182124',flash:e.hit>0?'#e6cda1':null,flashMix:.5,alpha:e.dead?.42:e.type==='cantor'?.86:1});
  if(e.active&&!e.dead&&e.hp<e.maxHp&&e.type!=='boss'&&settings.labels){const p=r.w(e.body.x,e.body.y,e.type==='skitter'?17:40*e.size);r.overlay(g=>E.ui.bar(g,p[0]-14,p[1]-3,28,2,e.hp/e.maxHp,'#ac6954'));}
 }
 r.shadow(hero.x,hero.y,9,.65);r.actor(hero.x,hero.y,0,(g,x,y)=>{rig.draw(g,x,y,r.view);const p=r.view.p(-5,0,21);E.px.rect(g,x+p[0]-2,y+p[1]-3,4,5,'#c7984f');E.px.rect(g,x+p[0]-1,y+p[1]-2,2,3,'#ffe4a2');},{outline:'#182328',flash:hurtT>.22?'#d1a898':null,alpha:dodgeT>0?.65:1});
 for(const b of shots){r.queue(b.x,b.y,b.z,g=>{const p=r.w(b.x,b.y,b.z),q=r.w(b.x-b.vx*.055,b.y-b.vy*.055,b.z);r.glowDisc(g,p[0],p[1],10,b.color,.4);E.px.line(g,q[0],q[1],p[0],p[1],b.color,3);E.px.disc(g,p[0],p[1],3,'#f8e6be');});}
 r.overlay(g=>drawLighting(g,r));r.overlay(g=>drawWorldLabels(g,r));
}
function drawMap(canvas,large=false){
 if(!map)return;const g=canvas.getContext('2d'),cw=canvas.width,ch=canvas.height;g.clearRect(0,0,cw,ch);g.fillStyle='#071114';g.fillRect(0,0,cw,ch);
 const localTown=town.isTown(),mapH=localTown?35:(large?H:48),yBase=localTown?45:0;const scale=large?Math.min(cw/(W+8),ch/(mapH+8)):Math.min(cw/(W+4),ch/(mapH+4));const ox=(cw-W*scale)/2,oy=(ch-mapH*scale)/2-yBase*scale;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(y<yBase||y>=yBase+mapH||(!explored[y*W+x]&&!(localTown&&y>=47)))continue;const cell=map.cell(x,y);g.fillStyle=cell===0&&!map.blocked[y*W+x]?'#536760':cell===3?'#bc8e54':'#202f30';g.fillRect(Math.round(ox+x*scale),Math.round(oy+y*scale),Math.ceil(scale),Math.ceil(scale));}
 const marker=(x,y,color,size=3)=>{if(y/TILE<yBase||y/TILE>=yBase+mapH)return;g.fillStyle=color;g.fillRect(ox+x/TILE*scale-size/2,oy+y/TILE*scale-size/2,size,size);};
 for(const s of seals){if(!localTown&&(large||explored[s.cy*W+s.cx]))marker(s.x,s.y,s.done?'#748b79':'#e1b66b',large?7:4);}
 const home=pos(24,62);marker(home.x,home.y,'#e3c99a',large?7:4);
 if(explored[9*W+40]&&!state.bossDefeated){const p=pos(40,9);marker(p.x,p.y,'#bc765d',large?7:4);}
 for(const e of enemies)if(!e.dead&&e.markedGuardian)marker(e.body.x,e.body.y,'#eb8b72',large?7:4);
 town.mapMarkers(marker,large);marker(hero.x,hero.y,'#cde4d4',large?6:4);
 if(large){g.font='13px Georgia';g.textAlign='center';for(const rm of ROOMS){if(explored[(rm.y+Math.floor(rm.h/2))*W+rm.x+Math.floor(rm.w/2)]){g.fillStyle='#d4c3a1';g.fillText(rm.name,ox+(rm.x+rm.w/2)*scale,oy+(rm.y+rm.h/2)*scale-11);}}}
}
function updateHUD(){
 if(!state||!hero)return;const st=totalStats(),area=roomAt(hero.x,hero.y);$('area-name').textContent=area?.name||'Abbey Passages';$('area-state').textContent=bossActive?'The final toll':area?.sub||'Beneath the abbey';
 $('hp-value').textContent=Math.ceil(hero.hp);$('hp-max').textContent='/ '+st.maxHp;$('mp-value').textContent=Math.floor(hero.mp);$('mp-max').textContent='/ '+st.maxMp;$('health-fill').style.height=clamp(hero.hp/st.maxHp*100,0,100)+'%';$('spirit-fill').style.height=clamp(hero.mp/st.maxMp*100,0,100)+'%';
 $('level-text').textContent='LEVEL '+state.level+(state.pendingBlessings?' · BLESSING READY':'');$('coins-text').textContent=state.coins+' crowns';$('potion-count').textContent=state.potions+' / '+state.maxPotions+' charges';$('xp-fill').style.width=(state.xp/xpNeed()*100)+'%';$('ward-cool').textContent=wardT>0?'Protected':wardCd>0?Math.ceil(wardCd)+'s':'25 spirit';$('dodge-cool').textContent=dodgeCd>0?dodgeCd.toFixed(1)+'s':'Ready';$('ward-btn').classList.toggle('cooling',wardCd>0&&wardT<=0);$('dodge-btn').classList.toggle('cooling',dodgeCd>0);
 $('quest-text').textContent=state.complete?'The ember is home.':state.ember?'Return to Sister Mora.':state.bossDefeated?'Take the last ember.':seals.every(s=>s.done)?'Silence the Hollow Bell.':'Break the three bell seals.';
 [...$('seal-icons').children].forEach((el,i)=>{el.classList.toggle('done',seals[i]?.done);el.textContent=seals[i]?.done?'◆':'◇';el.title=seals[i]?.name||'';});
 const boss=enemies.find(e=>e.type==='boss');const target=bossActive&&!boss?.dead?boss:hoverEnemy;
 $('target-bar').hidden=!target||target.dead;$('target-bar').classList.toggle('boss',target?.type==='boss');if(target&&!target.dead){$('target-name').textContent=target.name;$('target-hp').style.width=target.hp/target.maxHp*100+'%';$('target-type').textContent=target.type==='boss'?(target.phaseTwo?'SECOND TOLL':'KEEPER OF THE HOLLOW BELL'):target.type==='cantor'?'SPIRIT · RANGED':target.type==='guard'?'ARMOURED · HEAVY ATTACK':'ASHBOUND';}
 $('interact-prompt').hidden=!nearestObject||!$('tutorial').hidden;if(nearestObject)$('interact-prompt').innerHTML='<kbd>E</kbd>'+escapeHTML(nearestObject.type==='seal'?'Break '+nearestObject.name:(nearestObject.type==='npc'||nearestObject.type==='citizen')?'Speak to '+nearestObject.name:nearestObject.name);
 drawMap($('minimap'));if(panel==='map')drawMap($('large-map'),true);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function panelHead(eyebrow,title){return `<p class="eyebrow">${eyebrow}</p><h2 id="modal-title">${title}</h2>`;}
function button(label,action,cls='small-button',disabled=false){return `<button class="${cls}" data-action="${action}"${disabled?' disabled':''}>${label}</button>`;}
function itemStats(it){return[['attack','Blade damage'],['spell','Spell damage'],['armor','Armour'],['hp','Max health'],['mp','Max spirit'],['leech','Health per kill']].filter(([k])=>it[k]).map(([k,n])=>`+${it[k]} ${n.toLowerCase()}`).join(' · ');}
function showPanel(name){
 if(name==='inventory'&&!state)return;if(name==='level'&&!state.pendingBlessings)return;
 modalOrigin=mode;panel=name;lastFocus=document.activeElement;game.input.clear();path=[];commandTarget=null;recallT=0;$('modal-layer').hidden=false;$('modal').classList.toggle('wide',name==='inventory'||name==='map');$('modal-close').hidden=['death','victory','level'].includes(name);renderPanel();
 $('modal').scrollTop=0;setTimeout(()=>{$('modal-content').querySelector('button:not([disabled]), input, select')?.focus({preventScroll:true});},10);
}
function closePanel(){if(panel==='level'&&state?.pendingBlessings)return;if(mode==='dead'&&panel!=='death'){showPanel('death');return;}panel=null;$('modal-layer').hidden=true;game.input.clear();if(mode==='play')$('screen').focus();else if(lastFocus?.isConnected)lastFocus.focus();updateHUD();}
function renderPanel(){
 const content=$('modal-content'),st=state?totalStats():null;
 const townPanel=state?town.panel(panel):null;
 if(townPanel!==null)content.innerHTML=townPanel;
 else if(panel==='intro')content.innerHTML=panelHead('HEARTHSTEAD · A PLACE TO RETURN','One ember remains')+'<p class="lead">The abbey bell calls its dead from the earth. Six people keep Hearthstead alive below its walls.</p><p>Break the seals of Bone, Names, and Flame. Enter the Hollow Choir. Take the last ember from its keeper, and bring it home.</p><div class="rule"></div><p>Move with <kbd>W A S D</kbd> or click the ground. Speak to Mora with <kbd>E</kbd>. You can read all controls with <kbd>H</kbd>.</p><div class="panel-actions">'+button('Enter Hearthstead','close','gold-button')+button('Meet the town','town')+'</div>';
 else if(panel==='controls')content.innerHTML=panelHead('FIELD GUIDE','How to play')+'<p>Use cover. Let heavy attacks miss. Strike during the recovery.</p><div class="control-grid">'+[['Move','W A S D / arrows'],['Move to a point','Left-click ground'],['Blade attack','Click enemy / hold F'],['Cinder bolt','Right-click / R'],['Ash ward','1'],['Dodge','Space / Shift'],['Healing flask','Q'],['Interact / take item','E'],['Satchel & equipment','I / C'],['Map','Tab / M'],['Recall / return','T'],['Journal','J'],['Town directory','B'],['Pause','Esc / P'],['Controls','H']].map(([a,b])=>`<div class="control-line"><span>${a}</span><kbd>${b}</kbd></div>`).join('')+'</div><p class="muted">Cinder bolt costs 12 spirit. Ash ward costs 25 spirit and reduces damage for 4 seconds. Spirit restores over time. Recall takes 1.6 seconds and requires a quiet place.</p><p class="muted">Touch: tap to move or attack. Use the action bar and direction buttons. Gamepad: left stick to move, A to strike, X to cast, B to dodge, Y to interact.</p><div class="panel-actions">'+button('Close guide','close')+'</div>';
 else if(panel==='pause')content.innerHTML=panelHead('A MOMENT OF QUIET','Descent paused')+'<p>The abbey waits. Your progress saves on this device.</p><div class="panel-actions">'+button('Resume descent','close','gold-button')+button('Save progress','save')+button('Settings','settings')+button('How to play','controls')+button('Return to title','title')+'</div>';
 else if(panel==='settings')content.innerHTML=panelHead('SETTINGS','Shape the descent')+`<label class="settings-line"><span>Master volume</span><input aria-label="Master volume" id="volume-setting" type="range" min="0" max="1" step=".05" value="${settings.volume}"></label><label class="settings-line"><span>Mute sound</span><input id="mute-setting" type="checkbox" ${settings.muted?'checked':''}></label><label class="settings-line"><span>Difficulty</span><select id="difficulty-setting"><option value="story" ${settings.difficulty==='story'?'selected':''}>Story · less damage</option><option value="standard" ${settings.difficulty==='standard'?'selected':''}>Standard</option><option value="dread" ${settings.difficulty==='dread'?'selected':''}>Dread · more damage</option></select></label><label class="settings-line"><span>Screen shake & flashes</span><input id="motion-setting" type="checkbox" ${settings.motion?'checked':''}></label><label class="settings-line"><span>World labels & enemy bars</span><input id="labels-setting" type="checkbox" ${settings.labels?'checked':''}></label><label class="settings-line"><span>Dungeon brightness</span><input aria-label="Dungeon brightness" id="brightness-setting" type="range" min=".7" max="1.8" step=".1" value="${settings.brightness}"></label><p class="muted">You can change difficulty at any time. Story reduces incoming damage by 30%. Dread increases it by 30%.</p><div class="panel-actions">${button('Apply & close','apply-settings','gold-button')}${button('Full screen','fullscreen')}</div>`;
 else if(panel==='journal')content.innerHTML=panelHead('JOURNAL','The last ember')+`<p>${state.ember?'The last ember is safe. Bring it to Sister Mora at the hearth.':'Break the abbey’s three seals. Silence its bell keeper. Bring the last ember home.'}</p>`+seals.map(s=>`<div class="journal-entry ${s.done?'done':''}"><h3>${s.done?'◆':'◇'} ${s.name}</h3><p>${s.done?'Broken.':roomById(s.room).name+'. Defeat all guardians on this path, then use the seal.'}</p></div>`).join('')+`<div class="journal-entry ${state.bossDefeated?'done':''}"><h3>${state.bossDefeated?'◆':'◇'} The Hollow Choir</h3><p>${state.bossDefeated?'The keeper is defeated.':seals.every(s=>s.done)?'The gate is open. Prior Veyr waits beyond it.':'The three seals hold the gate shut.'}</p></div><h3>Optional · A light for Morrow</h3><p>${state.sideQuest?'The lost keeper is at rest. Speak to Mora for your reward.':'Find the lost keeper in the southern ossuary. His coffer holds a blade that restores health with each kill.'}</p><p class="muted">${state.kills} foes defeated · ${state.read.length} records read · ${C.formatTime(state.elapsed)} in the abbey</p>`+town.requests();
 else if(panel==='inventory')renderInventory(content,st);
 else if(panel==='level')content.innerHTML=panelHead('LEVEL '+state.level+' · '+state.pendingBlessings+' CHOICE'+(state.pendingBlessings>1?'S':''),'Choose a blessing')+'<p>Your strength grows. Each blessing lasts for this descent.</p><div class="blessing-grid">'+[['blade','⚔','Tempered Blade','+3 blade damage'],['will','♨','Inner Flame','+4 spell damage<br>+8 max spirit'],['vigor','◈','Steadfast Heart','+16 max health<br>+1 armour']].map(([a,i,t,d])=>`<button class="blessing" data-action="bless-${a}"><span>${i}</span><strong>${t}</strong><small>${d}</small></button>`).join('')+'</div><p class="muted">Health and spirit refill when you gain a level. All three choices can support a complete run.</p>';
 else if(panel==='hearth')content.innerHTML=panelHead('SANCTUARY','The Last Hearth')+'<p class="lead">A small flame, held against a great dark.</p><p>Your health, spirit, and flask charges are full.</p><div class="panel-actions">'+button('Return to the descent','close','gold-button')+button('Speak to Mora','mora')+button('Open satchel','inventory')+'</div><p class="muted">Cleared rooms stay clear. Use T in a quiet place to recall here. Use T again to return.</p>';
 else if(panel==='mora')renderMora(content);
 else if(panel==='seal'){const s=selectedItem;content.innerHTML=panelHead(s.name.toUpperCase(),'Break the binding')+`<p class="lead">${s.text}</p><div class="seal-choice"><p>${s.reward==='spellbook'?'Gain +7 Cinder bolt damage.':s.reward==='graveglass'?'Receive Graveglass Pendant: +14 max health, +1 armour.':'Receive Forged Cindercoat: +5 armour, +10 max health.'}</p></div><p>Gain 25 experience and one flask charge.</p><div class="panel-actions">${button('Break the seal','break-seal','gold-button')}${button('Leave it for now','close')}</div>`;}
 else if(panel==='lore'){content.innerHTML=panelHead('A RECORD FROM THE ABBEY',escapeHTML(selectedItem.title))+`<p class="lead">${escapeHTML(selectedItem.text)}</p><div class="panel-actions">${button('Close the record','close')}</div>`;}
 else if(panel==='map'){content.innerHTML=panelHead('CHAPTER I','Map of Hearthstead and the abbey')+'<canvas id="large-map" width="800" height="650" aria-label="Explored map. Three seals are marked in gold."></canvas><div class="map-legend"><span><b>■</b> You</span><span><b>◆</b> Seal</span><span><b>■</b> Hearth</span></div><p class="muted">The map records places you have seen. In town, coloured marks show citizens and gold marks show unlit lamps. In the abbey, gold marks show seals and red marks show remaining guardians. Close with Tab or Esc.</p>';drawMap($('large-map'),true);}
 else if(panel==='death')content.innerHTML=panelHead('THE FLAME GROWS FAINT','Ash, then breath')+'<p class="lead">The hearth has not forgotten you.</p><p>Return with full health and spirit. Keep your equipment, broken seals, and cleared rooms. Lose 10% of your crowns, rounded up.</p><div class="panel-actions">'+button('Rise at the hearth','respawn','gold-button')+button('Settings','settings')+'</div>';
 else if(panel==='victory')content.innerHTML=panelHead('CHAPTER I · COMPLETE','The ember is home')+'<p class="lead">For the first time in years, morning comes without the bell.</p><p>Mora cups the ember in her hands. Beyond the broken doors, a living voice answers. The abbey will remember them by their names.</p><div class="result-stats">'+[[state.kills,'Foes laid to rest'],[C.formatTime(state.elapsed),'Time in the abbey'],[state.level,'Warden level']].map(([n,t])=>`<div class="result-stat"><strong>${n}</strong><span>${t}</span></div>`).join('')+`<p class="muted">Three seals broken · ${state.sideQuest?'The lost keeper remembered':'The lost keeper still waits'} · ${state.deaths} ${state.deaths===1?'death':'deaths'}</p><div class="panel-actions">${button('Remain at the hearth','epilogue','gold-button')}${button('Begin a new descent','new-confirm')}${button('Credits & sources','credits')}</div>`;
 else if(panel==='new-confirm')content.innerHTML=panelHead('NEW DESCENT','Begin again?')+'<p>A new descent replaces the saved run on this device. Your settings remain.</p><div class="panel-actions">'+button('Begin new descent','new-run','gold-button')+button('Keep current run','close')+'</div>';
 else if(panel==='credits')content.innerHTML=panelHead('CINDERWAKE','Credits & sources')+'<div class="credits-grid"><div><h3>Original game</h3><p>Design, code, character direction, level, and sound created for this vertical slice. Title art, town buildings, citizen work cycles, portraits, and prop atlas created for Cinderwake.</p><h3>Foundation</h3><p>my-3D2dge Agent Edition v0.8.1<br>Michael Crosato · MIT License</p><p><a href="https://github.com/michaelcrosato/my-3d2dge" target="_blank" rel="noreferrer">Engine source and license</a></p></div><div><h3>Research</h3><p>Inspired by the original Diablo for PC. No source characters, art, music, maps, or story assets are used.</p><p><a href="https://news.blizzard.com/en-us/article/24055600/face-the-lord-of-terror-in-diablo-now-available-on-battle-net" target="_blank" rel="noreferrer">Blizzard · Original Diablo overview</a></p><p><a href="https://wheybags.gitlab.io/jarulfs-guide/" target="_blank" rel="noreferrer">Jarulf’s Guide</a></p><p><a href="https://www.purediablo.com/strategy/diablo-1-guide-boltys-high-level-warrior-guide" target="_blank" rel="noreferrer">Bolty’s Warrior Guide</a></p><p><a href="https://diablo2.diablowiki.net/Diablo_I_Manual" target="_blank" rel="noreferrer">Diablo Wiki · Original manual</a></p></div></div><div class="rule"></div><p class="muted">CINDERWAKE v1.1 · Hearthstead town expansion and one complete dungeon chapter. Progress is stored in this browser on this device.</p>';
 content.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>doAction(b.dataset.action)));
}
function renderInventory(content,st){
 if(!selectedItem||!state.inventory.some(it=>it.id===selectedItem.id))selectedItem=state.inventory[0]||null;
 content.innerHTML=panelHead('SATCHEL · '+state.inventory.length+' / 24 ITEMS','The Ash Warden')+'<div class="inventory-layout"><section class="inventory-stats"><h3>Equipped</h3>'+['weapon','armor','charm'].map(s=>`<div class="equipment-slot"><small>${s==='armor'?'ARMOUR':s.toUpperCase()}</small><strong class="rarity-${state.equipment[s]?.rarity||'common'}">${escapeHTML(state.equipment[s]?.name||'Empty')}</strong></div>`).join('')+[['Blade',st.attack],['Cinder bolt',st.spell],['Armour',st.armor],['Max health',st.maxHp],['Max spirit',st.maxMp],['Health per kill',st.leech]].map(([a,b])=>`<div class="stat-line"><span>${a}</span><strong>${b}</strong></div>`).join('')+`<p class="muted">${state.coins} crowns<br>Level ${state.level} · ${state.xp} / ${xpNeed()} experience</p>${state.pendingBlessings?button('Choose blessing','level'):''}</section><section><h3>Carried equipment</h3><div class="item-grid">`+state.inventory.map(it=>`<button class="item-card ${selectedItem?.id===it.id?'selected':''}" data-item="${it.id}"><span class="item-kind">${it.rarity} · ${it.slot}</span><strong class="rarity-${it.rarity}">${escapeHTML(it.name)}</strong><small>${itemStats(it)}</small></button>`).join('')+(state.inventory.length?'':'<p class="muted">Your satchel is empty. Look for coffers and fallen enemies.</p>')+'</div><div class="item-detail">'+(selectedItem?itemDetail(selectedItem):'<p>Choose an item to compare it with your equipment.</p>')+'</div><p class="muted">Equipment changes your stats at once. Coins and flask charges collect when you approach them. Press E to take equipment.</p></section></div>';
 content.querySelectorAll('[data-item]').forEach(b=>b.addEventListener('click',()=>{selectedItem=state.inventory.find(it=>it.id===b.dataset.item);renderPanel();}));
 pendingLootNotice=false;$('new-loot-dot').hidden=true;
}
function itemDetail(it){const old=state.equipment[it.slot];const diffs=[['attack','blade'],['spell','spell'],['armor','armour'],['hp','health'],['mp','spirit'],['leech','health per kill']].map(([k,n])=>({n,d:(it[k]||0)-(old?.[k]||0)})).filter(v=>v.d).map(v=>`<span class="${v.d>0?'compare-good':'compare-bad'}">${v.d>0?'+':''}${v.d} ${v.n}</span>`).join(' · ');return `<h3 class="rarity-${it.rarity}">${escapeHTML(it.name)}</h3><p>${escapeHTML(it.desc)}</p><p>${diffs||'Same stats as the equipped item.'}</p>${button('Equip item','equip')}${roomAt(hero.x,hero.y)?.safe?' '+button('Sell · '+it.value+' crowns','sell'):''}`;}
function renderMora(content){
 let intro=state.ember?'You brought it back. Let me carry it from here.':state.sideQuest&&!state.sideReward?'Morrow can rest now. I knew he would remember the way home.':state.bossDefeated?'The bell is silent. Take the ember from its bronze heart.':seals.every(s=>s.done)?'The choir is open. Listen for the pause between the bell’s attacks.':state.intro?'Keep close to the fire when you can. The paths of Bone, Names, and Flame wait beyond the nave.':'I am Mora. The bell took the abbey, but Hearthstead still stands. Break its three seals. Bring its ember home, and we may yet have a morning.';
 content.innerHTML=town.head(T.citizens[0],intro)+(state.ember?`<div class="panel-actions">${button('Give Mora the ember','finish','gold-button')}</div>`:'')+(state.sideQuest&&!state.sideReward?`<div class="panel-actions">${button('Remember Morrow · receive 40 crowns','side-reward','gold-button')}</div>`:'')+`<div class="rule"></div><p class="eyebrow">SUPPLIES · ${state.coins} CROWNS</p><div class="shop-row"><div>Refill health, spirit & flasks<small>The hearth gives freely.</small></div>${button('Rest','rest','small-button')}</div><div class="shop-row"><div>Reinforce the flask<small>+1 maximum charge. Limit: 7.</small></div>${button('30 crowns','buy-flask','small-button',state.coins<30||state.maxPotions>=7)}</div><div class="shop-row"><div>Copper Votive<small>Charm · +16 max spirit, +3 spell damage</small></div>${button('40 crowns','buy-charm','small-button',state.coins<40||state.inventory.length>=24||state.boughtCharm)}</div><div class="panel-actions">${button('Inspect / sell equipment','inventory')}${button('Return to the abbey','close')}</div>`;
 state.intro=true;
}
function requestNewGame(){if(getSave())showPanel('new-confirm');else initRun();}
function doAction(action){
 sound('ui');
 if(state&&town.action(action))return;
 if(action==='close'){closePanel();return;}
 if(action==='new-run'){panel=null;initRun();return;}
 if(action==='save'){toast(saveGame()?'Progress saved on this device.':'Save unavailable in this browser.',saveAvailable?'':'error');return;}
 if(action==='title'){saveGame();panel=null;$('modal-layer').hidden=true;mode='title';$('title-screen').hidden=false;$('hud').hidden=true;refreshTitle();playMusic('title');return;}
 if(action==='apply-settings'){settings.volume=Number($('volume-setting').value);settings.muted=$('mute-setting').checked;settings.difficulty=$('difficulty-setting').value;settings.motion=$('motion-setting').checked;settings.labels=$('labels-setting').checked;settings.brightness=Number($('brightness-setting').value);game.audio.setVolume(settings.muted?0:settings.volume);game.reduceMotion=!settings.motion;E.store.set(SETTINGS_KEY,settings);updateSoundButton();const dead=mode==='dead';closePanel();if(dead)showPanel('death');return;}
 if(action==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else $('app').requestFullscreen?.().catch(()=>{});return;}
 if(action.startsWith('bless-')){const key=action.slice(6);if(state.pendingBlessings>0&&key in state.blessings){state.blessings[key]++;state.pendingBlessings--;const st=totalStats();hero.hp=Math.min(st.maxHp,hero.hp+(key==='vigor'?16:0));hero.mp=Math.min(st.maxMp,hero.mp+(key==='will'?8:0));sound('level');if(state.pendingBlessings)renderPanel();else closePanel();saveGame();}return;}
 if(action==='break-seal'){breakSeal(selectedItem);return;}
 if(action==='equip'){
  const i=state.inventory.findIndex(it=>it.id===selectedItem?.id);if(i<0)return;const it=state.inventory.splice(i,1)[0],old=state.equipment[it.slot];state.equipment[it.slot]=it;if(old)state.inventory.push(old);selectedItem=old||state.inventory[0];const st=totalStats();hero.hp=Math.min(hero.hp,st.maxHp);hero.mp=Math.min(hero.mp,st.maxMp);toast(it.name+' equipped.',it.rarity);sound('loot');saveGame();renderPanel();return;
 }
 if(action==='sell'){if(!roomAt(hero.x,hero.y)?.safe)return;const i=state.inventory.findIndex(it=>it.id===selectedItem?.id);if(i<0)return;const it=state.inventory.splice(i,1)[0];state.coins+=it.value;selectedItem=state.inventory[0]||null;sound('loot');saveGame();renderPanel();return;}
 if(action==='rest'){const st=totalStats();hero.hp=st.maxHp;hero.mp=st.maxMp;state.potions=state.maxPotions;state.shrineVisits++;sound('heal');toast('Health, spirit, and flask charges restored.');saveGame();renderPanel();return;}
 if(action==='buy-flask'){if(state.coins<30||state.maxPotions>=7)return;state.coins-=30;state.maxPotions++;state.potions=state.maxPotions;sound('loot');saveGame();renderPanel();return;}
 if(action==='buy-charm'){if(state.coins<40||state.boughtCharm||state.inventory.length>=24)return;const it=item('shopcharm');if(addInventory(it)){state.coins-=40;state.boughtCharm=true;saveGame();renderPanel();}return;}
 if(action==='side-reward'){if(!state.sideQuest||state.sideReward)return;state.sideReward=true;state.coins+=40;sound('level');saveGame();renderPanel();return;}
 if(action==='respawn'){respawn();return;}
 if(action==='finish'){if(state.ember)finishRun();return;}
 if(action==='epilogue'){panel=null;closePanel();mode='play';playMusic(town.isTown()?'town':'dungeon');toast('The ember is home. You can finish any remaining exploration.');return;}
 showPanel(action);
}
function updateSoundButton(){$('sound-btn').textContent=settings.muted?'♩':'♪';$('sound-btn').setAttribute('aria-label',settings.muted?'Enable sound':'Mute sound');}
function refreshTitle(){const saved=getSave();$('continue-btn').hidden=!saved;$('new-btn').className=saved?'small-button':'gold-button';$('new-btn').innerHTML=saved?'Begin a new descent':'Begin descent <kbd>ENTER</kbd>';}
$('new-btn').addEventListener('click',requestNewGame);$('continue-btn').addEventListener('click',()=>{const s=getSave();if(s)initRun(s);else requestNewGame();});
$('credits-btn').addEventListener('click',()=>showPanel('credits'));
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.panel)));
$('modal-close').addEventListener('click',closePanel);$('dismiss-tutorial').addEventListener('click',()=>{$('tutorial').hidden=true;updateHUD();});
$('map-btn').addEventListener('click',()=>showPanel('map'));$('sound-btn').addEventListener('click',()=>{settings.muted=!settings.muted;game.audio.setVolume(settings.muted?0:settings.volume);E.store.set(SETTINGS_KEY,settings);updateSoundButton();});
$('attack-btn').addEventListener('click',startAttack);$('spell-btn').addEventListener('click',castBolt);$('ward-btn').addEventListener('click',useWard);$('dodge-btn').addEventListener('click',dodge);$('potion-btn').addEventListener('click',usePotion);$('health-button').addEventListener('click',usePotion);$('portal-btn').addEventListener('click',beginRecall);$('touch-interact').addEventListener('click',()=>interact());
for(const b of document.querySelectorAll('[data-hold]')){const code={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD'}[b.dataset.hold];b.addEventListener('pointerdown',e=>{e.preventDefault();game.input.press(code);b.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>game.input.release(code));}
// Menus own focus and keep game input clear. Tab stays inside each modal.
document.addEventListener('keydown',e=>{
 if(mode==='title'&&(e.target.closest?.('button,input,select,a')||e.code==='Tab'))e.stopPropagation();
 if(!panel)return;
 if(e.code==='Escape'&&!['death','victory','level'].includes(panel)){e.preventDefault();e.stopPropagation();closePanel();return;}
 if(e.code==='Tab'){
  if(panel==='map'){e.preventDefault();e.stopPropagation();closePanel();return;}
  e.preventDefault();e.stopPropagation();const focusable=[...$('modal').querySelectorAll('button:not([disabled]):not([hidden]),input,select,a[href]')];if(!focusable.length)return;let i=focusable.indexOf(document.activeElement);i=(i+(e.shiftKey?-1:1)+focusable.length)%focusable.length;focusable[i].focus();
 }
 if(panel)e.stopPropagation();
},true);
window.addEventListener('blur',()=>{if(mode==='play'&&!panel)showPanel('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='play'&&!panel)showPanel('pause');saveGame();}});
window.addEventListener('pagehide',saveGame);
window.addEventListener('error',e=>{$('error-message').hidden=false;$('error-message').textContent='The game stopped on an error: '+e.message;});
town=T.create({E,C,game,arts,get:()=>({state,hero,map,objects,props,enemies,seals}),pos,addObject,addProp,button,panelHead,escape:escapeHTML,toast,sound,saveGame,showPanel,closePanel,renderPanel,totalStats,item,addInventory,roomAt,beginRecall,setDestination,updateVision,updateHUD,announce,resetTravel:()=>{path=[];commandTarget=null;nearestObject=null;hoverObject=null;hoverEnemy=null;recallT=0;currentArea='';game.setView(town.isTown()?townView:view);}});
refreshTitle();updateSoundButton();
game.start({update,draw});
// Structured read access supports QA and browser agents without changing play state.
window.Cinderwake={
 version:'1.1.0',engine:'my-3D2dge Agent Edition v0.8.1',
 status:()=>({mode,panel,area:currentArea,hero:hero?{x:hero.x,y:hero.y,hp:hero.hp,mp:hero.mp,...totalStats()}:null,level:state?.level,kills:state?.kills,seals:seals.map(s=>({id:s.id,done:s.done,x:s.x,y:s.y})),bossActive,bossDefeated:state?.bossDefeated,ember:state?.ember,complete:state?.complete,inventory:state?.inventory?.length,errors:game.errors,stats:game.stats,elapsed:state?.elapsed,town:state?.town?{...state.town,stash:state.town.stash.length}:null}),
 describe:()=>({rooms:ROOMS.map(r=>({...r})),enemies:enemies.map(e=>({id:e.id,type:e.type,room:e.room,x:e.body.x,y:e.body.y,hp:e.hp,dead:e.dead,phase:e.phase})),objects:objects.map(({rig,...o})=>o),map:map?{w:W,h:H,tile:TILE,cells:map.cells.slice(),blocked:Array.from(map.blocked)}:null})
};
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'read_descent',title:'Read descent status',description:'Read the current Cinderwake run, player stats, nearby visible threats, and visible objects. Does not change the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({...window.Cinderwake.status(),coins:state?.coins,potions:state?.potions,pendingBlessings:state?.pendingBlessings,nearby:hero?enemies.filter(e=>!e.dead&&canSee(e.body.x,e.body.y)).map(e=>({id:e.id,name:e.name,x:e.body.x,y:e.body.y,hp:e.hp,phase:e.phase,range:e.range})):[],objects:hero?objects.filter(o=>canSee(o.x,o.y)).map(o=>({id:o.id,type:o.type,name:o.name,x:o.x,y:o.y})):[]})});
 register({name:'control_warden',title:'Control the Warden',description:'Use a normal game action. Move to world coordinates, strike, cast, dodge, use a flask or ward, interact with a nearby object, or recall. Uses normal costs, range, collision, and combat rules. Menus must be closed first.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['move','strike','cast','dodge','ward','flask','interact','recall']},x:{type:'number'},y:{type:'number'},targetId:{type:'string'},seconds:{type:'number',minimum:0,maximum:6}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{
  if(!input||!['move','strike','cast','dodge','ward','flask','interact','recall'].includes(input.action))throw new Error('Unknown Warden action.');
  if(mode!=='play'||panel)throw new Error('Close the menu and resume the descent first.');
  if(input.seconds!==undefined&&(!Number.isFinite(input.seconds)||input.seconds<0||input.seconds>6))throw new Error('Duration must be from 0 to 6 seconds.');
  let held=null;
  if(input.action==='move'){if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||input.x<0||input.y<0||input.x>=W*TILE||input.y>=H*TILE)throw new Error('Choose a point inside the abbey.');if(!setDestination(input.x,input.y))throw new Error('No open path.');}
  if(input.action==='strike'||input.action==='cast'){if(input.targetId){const e=enemies.find(e=>e.id===input.targetId&&!e.dead&&canSee(e.body.x,e.body.y));if(!e)throw new Error('Target is not visible.');hoverEnemy=e;if(input.action==='strike')setDestination(e.body.x,e.body.y,e);}held=input.action==='strike'?'KeyF':'KeyR';game.input.press(held);}
  if(input.action==='dodge')dodge();if(input.action==='ward')useWard();if(input.action==='flask')usePotion();if(input.action==='recall')beginRecall();
  if(input.action==='interact'){const o=input.targetId?objects.find(o=>o.id===input.targetId):nearestObject;if(!o||dist(hero,o)>52)throw new Error('Move within reach of the object.');interact(o);}
  await new Promise(resolve=>setTimeout(resolve,Math.round((input.seconds??.15)*1000)));if(held)game.input.release(held);updateHUD();return window.Cinderwake.status();
 }});
}
})();
