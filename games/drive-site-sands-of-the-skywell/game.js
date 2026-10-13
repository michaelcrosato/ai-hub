/* Sands of the Skywell. An original complete level built on my-3D2dge 0.6.0. */
(function(){
'use strict';
const E=My3D2dge,px=E.px,TAU=Math.PI*2,$=s=>document.querySelector(s);
const game=new E.Game({canvas:'world',view:new E.View('skywell','Aqueduct',20,43,1.4,1.14),minW:590,minH:330,maxW:1600,maxH:1000,bg:'#1f4148',input:{}});
game.pauseOverlay=false;game.cam.smooth=.23;game.r.outline='#192331';game.r.rim='#fff1c8';game.r.rimAlpha=.25;game.lights.enabled=false;
const SAVE='skywell-v1',SETTINGS='skywell-settings-v1';
const cfg=Object.assign({sound:true,volume:.35,motion:!game.reduceMotion,lines:true,difficulty:'normal'},E.store.get(SETTINGS,{}));
game.reduceMotion=!cfg.motion;game.audio.muted=!cfg.sound;game.audio.setVolume(cfg.volume);
game.audio.define('menu', {wave:'sine',freq:740,to:920,dur:.07,vol:.15});
game.audio.define('block', [{wave:'triangle',freq:320,to:170,dur:.15,vol:.25},{wave:'noise',freq:2200,to:700,dur:.1,vol:.12}]);
E.MOVES.heavy={...E.MOVES.twohand};
const state={mode:'title',paused:false,modal:null,leader:0,target:null,elapsed:0,kills:0,seals:[false,false],boss:false,complete:false,hunt:'none',coins:80,echoes:2,tonics:6,ethers:2,revives:2,opened:[],upgrades:[],seen:[],lastSave:'',chapter:'',combat:false,tip:0,deaths:0,checkpoint:null};
const keys=new Set(),touch={x:0,y:0},held=new Map();let enemies=[],party=[],map,nav,props=[],floorMask,nearby=null,path=[],pathGoal=null,interactGoal=null,uiClock=0,fx=[],lastArea='',dialogDone=null,toastTimer,miniCanvas,miniCtx,focusBeforeModal;
const WM=72,HM=44,T=16,spawn=[184,552],seals=[{x:632,y:112,id:0,name:'North wind seal'},{x:672,y:624,id:1,name:'South wind seal'}];
const landmarks=[{x:128,y:526,type:'keeper',name:'Keeper Orun'},{x:238,y:607,type:'save',name:'Waystone'},{x:552,y:404,type:'save',name:'Court waystone'},...seals.map(s=>({...s,type:'seal'})),{x:860,y:372,type:'gate',name:'The sealed bridge'},{x:1072,y:265,type:'core',name:'Skywell core'},
{x:195,y:640,type:'chest',id:'camp',name:'Supply coffer'},{x:553,y:631,type:'chest',id:'south',name:'Wayfinder cache'},{x:379,y:116,type:'chest',id:'hunt',name:'Lost field pack'},{x:731,y:126,type:'lore',id:'north',name:'Weathered inscription'}];
const ACTIONS={strike:{name:'Attack',icon:'⚔',cost:0,time:1.7,target:'foe',move:'slash'},sunder:{name:'Sundercut',icon:'✦',cost:8,time:2.1,target:'foe',move:'heavy'},lance:{name:'Sunlance',icon:'✧',cost:9,time:2,target:'foe',move:'thrust'},gale:{name:'Gale',icon:'≋',cost:9,time:1.05,target:'foe',move:'thrust'},mend:{name:'Mend',icon:'✚',cost:6,time:1.6,target:'ally',move:'thrust'},brace:{name:'Brace',icon:'◈',cost:0,time:.4,target:'self'},tonic:{name:'Tonic',icon:'◉',cost:0,time:.45,target:'ally'},ether:{name:'Ether',icon:'◇',cost:0,time:.45,target:'ally'},revive:{name:'Revive',icon:'✶',cost:12,time:2.2,target:'down'},feather:{name:'Wakeleaf',icon:'❧',cost:0,time:.6,target:'down'},focus:{name:'Focus',icon:'◎',cost:0,time:2.8,target:'self'}};
const CONDITIONS={allyDown:'Ally: fallen',ally30:'Ally: HP below 30%',ally50:'Ally: HP below 50%',ally70:'Ally: HP below 70%',self35:'Self: HP below 35%',selfMP:'Self: MP below 25%',selfDanger:'Self: foe preparing attack',foeCast:'Foe: casting',foeWeak:'Foe: weak to wind',foeLow:'Foe: lowest HP',foeTarget:'Foe: party target',foeNear:'Foe: nearest'};
const UPGRADES=[{id:'heart',name:'Desert heart',branch:'VANGUARD',cost:3,desc:'Nara gains 90 maximum HP.'},{id:'well',name:'Clear waters',branch:'MENDER',cost:3,desc:'Mend restores 30 more HP.'},{id:'edge',name:'Keen wind',branch:'SCOUT',cost:3,desc:'Senn deals 10 more attack damage.'},{id:'shell',name:'Brass resolve',branch:'VANGUARD',cost:4,req:'heart',desc:'The party takes 15% less damage.'},{id:'flow',name:'Quiet current',branch:'MENDER',cost:4,req:'well',desc:'All spell costs decrease by 2 MP.'},{id:'tempo',name:'Open skies',branch:'SCOUT',cost:4,req:'edge',desc:'Party action charge is 18% faster.'}];
const SONGS={field:{bpm:76,steps:2,tracks:[{wave:'sine',vol:.09,notes:'D5 - A4 - F5 - E5 - D5 - . . A4 - C5 - | D5 - A4 - G4 - A4 - F4 - . . E4 - A4 -'},{wave:'triangle',vol:.065,notes:'D3 - - - A3 - - - F3 - - - C3 - - - | G3 - - - D3 - - - A2 - - - - - - -'},{wave:'sine',vol:.045,notes:'A4 . . . D5 . . . A4 . . . C5 . . . | G4 . . . D5 . . . E4 . . . A4 . . .'}]},battle:{bpm:112,steps:4,tracks:[{wave:'triangle',vol:.13,notes:'D3 . D3 . A2 . D3 . F3 . C3 . A2 . C3 . | D3 . D3 . A2 . D3 . G3 . D3 . A2 . C3 .'},{wave:'sine',vol:.12,notes:'D5 - . A4 C5 - D5 - F5 - E5 - D5 - C5 - | A4 - . G4 A4 - C5 - D5 - F5 - E5 - C5 -'},{wave:'drums',vol:.08,notes:'k . h . . . h . k . h . s . h .'}]},boss:{bpm:122,steps:4,tracks:[{wave:'triangle',vol:.15,notes:'D3 . A2 . D3 . F3 . D3 . A2 . C3 . A2 . | Bb2 . F3 . Bb2 . D3 . A2 . E3 . A2 . C3 .'},{wave:'sine',vol:.13,notes:'D5 - A4 - D5 - E5 - F5 - - - E5 - C5 - | D5 - - - A4 - G4 - A4 - C5 - E5 - - -'},{wave:'drums',vol:.10,notes:'k . h . s . h . k k h . s . h h'}]},victory:{bpm:96,steps:2,tracks:[{wave:'sine',vol:.13,notes:'D5 - F5 - A5 - - - G5 - F5 - E5 - D5 - | F5 - E5 - D5 - - - - - - - . . . .'},{wave:'triangle',vol:.09,notes:'D3 - A3 - D4 - - - F3 - C4 - A3 - D3 - | G3 - A3 - D3 - - - - - - - . . . .'}]}};
let musicKey='';function music(k){if(k===musicKey)return;musicKey=k;if(cfg.sound)game.audio.music(SONGS[k]);}
function sound(name,vol=.5){if(cfg.sound)game.audio.sfx(name,{vol:vol*cfg.volume});}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function log(msg){state.lastLog=msg;state.logAt=game.real;}
function flag(s){if(!state.seen.includes(s)){state.seen.push(s);return true;}return false;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function living(){return party.filter(p=>p.hp>0);}
function foes(){return enemies.filter(e=>e.hp>0&&e.aggro&&!e.hidden);}
function leader(){return party[state.leader];}
function percent(v,max){return E.clamp(v/max*100,0,100).toFixed(1);}
function cost(a){return Math.max(0,ACTIONS[a].cost-(state.upgrades.includes('flow')&&ACTIONS[a].cost?2:0));}
function charActions(p){return ['strike',p.skill,...(p.id===1?['mend','revive']:[]),'brace','tonic','ether','feather','focus'];}
function buildMap(){
 floorMask=new Uint8Array(WM*HM);const cells=new Uint8Array(WM*HM),regions=[[3,27,17,41,1],[14,23,31,35,2],[27,16,49,31,3],[31,3,48,16,4],[32,31,49,42,2],[7,5,25,18,5],[19,16,29,21,2],[24,18,29,27,2],[49,21,58,26,3],[58,12,71,30,6]];
 for(const[a,b,c,d,tag]of regions)for(let y=b;y<d;y++)for(let x=a;x<c;x++)floorMask[y*WM+x]=tag;
 // Shallow channels divide the courts; stone spans remain across the water.
 for(let y=18;y<29;y++)for(let x=32;x<35;x++)if(y<22||y>24)floorMask[y*WM+x]=7;
 for(let y=7;y<14;y++)for(let x=40;x<45;x++)floorMask[y*WM+x]=7;
 for(let y=33;y<39;y++)for(let x=37;x<41;x++)floorMask[y*WM+x]=7;
 map=new E.TileMap({w:WM,h:HM,cells,ao:0,shimmer:false,types:{1:{h:8,top:'#d5bd8c',side:'#8b7457',face:'stone',roof:'slab'},2:{h:42,top:'#e4cda0',side:'#ad8d61',face:'plaster',roof:'slab'},3:{h:23,top:'#c9ad7b',side:'#907459',face:'brick',roof:'slab'}},floorTex:(x,y)=>{
   const cx=Math.floor(x/T),cy=Math.floor(y/T),tag=floorMask[cy*WM+cx],h=E.hash2(Math.floor(x),Math.floor(y));
   if(!tag){const n=E.noise2(x/58,y/58);return [43+n*18,80+n*20,83+n*18];}
   if(tag===7){const n=E.noise2(x/10,y/10);return [38+n*16,109+n*26,112+n*24];}
   const bx=Math.floor(x/16),by=Math.floor(y/16),j=E.hash2(bx,by),edge=x%16<.65||y%16<.65,vein=(x+by*8)%32<.65;
   let base=tag===5?[152,135,104]:tag===6?[209,188,144]:tag===4?[187,169,129]:[192,165,119];
   let k=edge?-.14:vein?-.055:(j-.5)*.12+(h-.5)*.055;
   if((cx===27||cx===48||cy===16||cy===30)&&tag===3)base=[114,136,127];
   if(tag===1&&h>.97)k+=.12;
   return base.map(v=>v*(1+k));
 }});
 for(let i=0;i<floorMask.length;i++)map.blocked[i]=!floorMask[i]||floorMask[i]===7?1:0;
 props=[];
 // Low parapets outline every walkable island, with worn pillars at key turns.
 for(let y=1;y<HM-1;y++)for(let x=1;x<WM-1;x++){
   const tag=floorMask[y*WM+x];if(!tag||tag===7)continue;
   if((!floorMask[y*WM+x+1]||!floorMask[(y+1)*WM+x])&&!(x>48&&y>20&&y<26))props.push({type:'edge',x:x*T+8,y:y*T+8,side:!floorMask[(y+1)*WM+x]?'south':'east',seed:x+y});
 }
 for(const[x,y,h]of [[64,440,54],[250,440,54],[272,379,61],[451,270,65],[752,265,65],[502,52,62],[751,52,62],[496,655,53],[775,655,53],[112,82,60],[383,82,60],[932,205,75],[1117,205,75],[931,464,62],[1118,464,62],[821,333,52],[821,411,52],[911,332,52],[911,411,52]])props.push({type:'column',x,y,h});
 for(const[x,y]of [[110,606],[247,563],[295,501],[489,359],[762,359],[611,75],[711,655],[184,115],[942,420],[1096,360]])props.push({type:'banner',x,y,h:50,seed:x});
 for(const[x,y]of [[88,579],[266,546],[315,390],[753,311],[740,578],[528,603],[207,249],[920,350],[920,404]])props.push({type:'brazier',x,y});
 for(const[x,y]of [[207,593],[111,570],[290,503],[465,320],[706,511],[567,91],[374,251],[287,123]])props.push({type:'urn',x,y});
 props.push({type:'arch',x:298,y:419,h:72,w:69},{type:'arch',x:581,y:256,h:78,w:88},{type:'arch',x:821,y:373,h:86,w:79});
 // Solid ruins are included in both rendering and navigation.
 for(const[x,y]of [[9,28],[14,30],[29,18],[45,20],[30,28],[33,5],[46,13],[33,40],[46,34],[10,7],[20,7],[59,13],[68,14]]){map.cells[y*WM+x]=3;}
 nav=new E.Skywell.Navigator(map);updateGate();
 // Battle sight respects closed gates; water remains transparent to ranged attacks.
 const wallSight=map.los.bind(map);map.los=(x0,y0,x1,y1)=>{if(!state.seals.every(Boolean)&&((x0<880&&x1>=864)||(x1<880&&x0>=864)))return false;return wallSight(x0,y0,x1,y1);};
}
function updateGate(){if(!map)return;for(let y=21;y<26;y++)map.block(54,y,!(state.seals[0]&&state.seals[1]));}
function createParty(){
 const defs=[{name:'Nara',role:'VANGUARD',hp:340,mp:48,atk:34,range:25,skill:'sunder',color:'#63c4b1',rig:{build:'heroic',size:1.25,armor:true,outfit:'coat',cape:true,weapon:'sword',hair:'short',colors:{skin:'#a97750',hair:'#23232b',cloth:'#397c79',cape:'#bf8b38',capeIn:'#785229',trim:'#deb569',metal:'#cdb77f',metalDk:'#737b70',pants:'#374151'}}},
 {name:'Ivo',role:'MENDER',hp:245,mp:96,atk:22,range:110,skill:'lance',color:'#89b9ec',rig:{build:'heroic',size:1.21,outfit:'robe',sleeves:'long',cape:false,weapon:'staff',hair:'ponytail',colors:{skin:'#c6a37a',hair:'#362e30',cloth:'#eee2bb',trim:'#d8b86f',pants:'#525a5d',metal:'#e4c980',hilt:'#e4c980'}}},
 {name:'Senn',role:'WIND SCOUT',hp:270,mp:66,atk:29,range:122,skill:'gale',color:'#d0b5ed',rig:{build:'heroic',size:1.2,outfit:'coat',sleeves:'long',weapon:'gun',cape:'scarf',hair:'short',colors:{skin:'#c69b70',hair:'#e5e2d5',cloth:'#8e454c',cape:'#8e454c',trim:'#ceab72',pants:'#3d3e50',metal:'#d6bf94',metalDk:'#8b8277'}}}];
 party=defs.map((d,id)=>{const p={...d,id,maxHp:d.hp,maxMp:d.mp,x:spawn[0]+(id===1?-20:id===2?22:0),y:spawn[1]+(id?22:0),z:0,r:6,vx:0,vy:0,facing:-.8,action:null,cooldown:0,guard:0,hurt:0,anim:0,status:'Ready',manual:null,follow:new E.FlowField(map),attackAnim:null};p.rig=new E.Humanoid(d.rig);p.brain=new E.Skywell.RuleBrain(defaultRules(id));return p;});
}
function defaultRules(id){
 const r=(when,action)=>({when,action,on:true});
 if(id===0)return [r('ally30','tonic'),r('selfDanger','brace'),r('foeTarget','strike'),r('foeNear','strike')];
 if(id===1)return [r('allyDown','revive'),r('ally70','mend'),r('selfMP','focus'),r('foeTarget','strike'),r('foeNear','strike')];
 return [r('foeCast','gale'),r('ally30','tonic'),r('foeTarget','strike'),r('foeNear','strike')];
}
function createEnemies(){
 const defs=[['shell',351,470],['shell',395,449],['warden',525,364],['warden',607,418],['wisp',580,217],['warden',617,165],['wisp',724,176],['shell',593,564],['shell',723,582],['warden',705,639],['wisp',442,321],['hunt',255,168],['boss',1020,355]];
 enemies=defs.map(([kind,x,y],id)=>makeEnemy(kind,x,y,id));
}
function makeEnemy(kind,x,y,id){
 const data={shell:{name:'Silt carapace',hp:145,atk:23,range:24,speed:33,charge:2.8,weak:'wind',xp:1},warden:{name:'Hollow sentinel',hp:215,atk:30,range:28,speed:34,charge:2.5,weak:'sun',xp:1},wisp:{name:'Gale remnant',hp:165,atk:26,range:96,speed:27,charge:3,weak:'steel',xp:1},hunt:{name:'The Dune Widow',hp:820,atk:39,range:40,speed:30,charge:2.6,weak:'wind',xp:4},boss:{name:'Brass Custodian',hp:1820,atk:42,range:54,speed:25,charge:2.8,weak:'exposed core',xp:5}}[kind];
 const e={...data,id:'e'+id,kind,x,y,homeX:x,homeY:y,z:0,r:kind==='boss'?18:kind==='hunt'?14:8,maxHp:data.hp,vx:0,vy:0,facing:Math.PI,aggro:false,hidden:kind==='hunt',action:null,cooldown:1+id*.07,hurt:0,anim:0,stagger:0,broken:0,phase:1,casts:0,deadTime:0,path:new E.FlowField(map)};
 if(kind==='warden'||kind==='boss')e.rig=new E.Humanoid({build:kind==='boss'?'bulky':'heroic',size:kind==='boss'?2.7:1.35,armor:true,hair:'bald',weapon:'sword',bladeLen:kind==='boss'?17:13,outfit:'coat',eyeGlow:'#9de5d9',colors:{skin:'#c3b58c',hair:'#738482',cloth:'#566a69',pants:'#394849',metal:'#c5a26a',metalDk:'#77644e',trim:'#e3c78f',eye:'#85e6d0'}});
 return e;
}
function reset(){Object.assign(state,{leader:0,target:null,elapsed:0,kills:0,seals:[false,false],boss:false,complete:false,hunt:'none',coins:80,echoes:2,tonics:6,ethers:2,revives:2,opened:[],upgrades:[],seen:[],deaths:0,paused:false,modal:null,combat:false});path=[];fx=[];buildMap();createParty();createEnemies();state.mode='play';game.cam.snap=true;saveAt(spawn[0],spawn[1],true);}
function snapshot(){return {version:1,elapsed:state.elapsed,kills:state.kills,seals:[...state.seals],boss:state.boss,complete:state.complete,hunt:state.hunt,coins:state.coins,echoes:state.echoes,tonics:state.tonics,ethers:state.ethers,revives:state.revives,opened:[...state.opened],upgrades:[...state.upgrades],seen:[...state.seen],deaths:state.deaths,leader:state.leader,position:[leader().x,leader().y],enemy:enemies.map(e=>({id:e.id,hp:e.hp,hidden:e.hidden})),party:party.map(p=>({hp:p.hp,mp:p.mp,rules:p.brain.rules.map(r=>({...r})),enabled:p.brain.enabled})),date:new Date().toISOString()};}
function saveAt(x,y,quiet=false){for(const p of party){p.hp=p.maxHp;p.mp=p.maxMp;p.action=null;p.manual=null;p.cooldown=0;p.guard=0;}state.target=null;path=[];const snap=snapshot();snap.position=[x,y];state.checkpoint=structuredClone(snap);const ok=E.store.set(SAVE,snap);state.lastSave=ok?'Checkpoint saved':'Storage unavailable';if(!quiet)toast(ok?'Party restored. Checkpoint saved.':'Party restored. This browser cannot save progress.');}
function loadSave(saved){
 const s=saved||E.store.get(SAVE);if(!s||s.version!==1||!Array.isArray(s.party)||s.party.length!==3)return false;
 Object.assign(state,{...s,mode:'play',modal:null,paused:false,target:null,combat:false});state.checkpoint=structuredClone(s);buildMap();createParty();createEnemies();applyStats();
 for(let i=0;i<3;i++){const p=party[i],v=s.party[i];p.hp=E.clamp(v.hp,0,p.maxHp);p.mp=E.clamp(v.mp,0,p.maxMp);p.x=s.position[0]+(i===1?-18:i===2?18:0);p.y=s.position[1]+(i?20:0);map.collide(p);if(Array.isArray(v.rules))p.brain.rules=v.rules.filter(r=>CONDITIONS[r.when]&&charActions(p).includes(r.action)).slice(0,6).map(r=>({...r}));p.brain.enabled=v.enabled!==false;}
 for(const e of enemies){const v=s.enemy?.find(v=>v.id===e.id);if(v){e.hp=v.hp<=0?0:e.maxHp;e.hidden=v.hidden;}if(e.kind==='hunt')e.hidden=state.hunt==='none';}
 path=[];fx=[];game.cam.snap=true;closeOverlay();music('field');renderHUD();return true;
}
function applyStats(){for(const p of party){p.maxHp=(p.id===0?340+(state.upgrades.includes('heart')?90:0):p.id===1?245:270);p.atk=(p.id===0?34:p.id===1?22:29+(state.upgrades.includes('edge')?10:0));}}
function startNew(){reset();music('field');showBriefing();}
function begin(){closeOverlay();state.mode='play';chapter('THE AMBER AQUEDUCT','West approach');renderHUD();}
function chapter(area,sub){state.chapter={area,sub,end:game.real+5};}
function areaAt(p){if(p.x>920)return 'The Brass Sanctum';if(p.x>787)return 'Skybridge';if(p.y<280&&p.x<440)return 'The Forgotten Court';if(p.y<255)return 'North Wind Gallery';if(p.y>495&&p.x>480)return 'The Cistern Gardens';if(p.x>430)return 'Court of the Sun';return 'West Approach';}
function findTarget(when,p){
 const fs=foes().filter(e=>distance(p,e)<220),ls=living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
 if(when==='allyDown')return party.find(a=>a.hp<=0);
 if(when.startsWith('ally')){const n=Number(when.slice(4));return ls.find(a=>a.hp/a.maxHp<n/100);}
 if(when==='self35')return p.hp/p.maxHp<.35?p:null;
 if(when==='selfMP')return p.mp/p.maxMp<.25?p:null;
 if(when==='selfDanger')return p.guard<=0&&fs.some(e=>e.action?.type==='burst'&&distance(p,e.action)<e.action.radius+10)?p:null;
 if(when==='foeCast')return fs.find(e=>e.action&&['burst','bolt'].includes(e.action.type));
 if(when==='foeWeak')return fs.find(e=>e.weak==='wind');
 if(when==='foeLow')return fs.sort((a,b)=>a.hp-b.hp)[0];
 if(when==='foeTarget')return fs.find(e=>e.id===state.target);
 return fs.sort((a,b)=>distance(p,a)-distance(p,b))[0];
}
function canUse(p,a,t){
 const d=ACTIONS[a];if(!d||!t||p.hp<=0||p.mp<cost(a)||!charActions(p).includes(a))return false;
 if(d.target==='foe')return t.kind&&t.hp>0&&!t.hidden&&(t.kind!=='boss'||state.seals.every(Boolean));
 if(d.target==='down')return !t.kind&&t.hp<=0&&(a!=='feather'||state.revives>0);
 if(t.kind||t.hp<=0)return false;
 if(a==='tonic')return state.tonics>0&&t.hp<t.maxHp;
 if(a==='ether')return state.ethers>0&&t.mp<t.maxMp;
 if(a==='mend')return t.hp<t.maxHp;
 if(a==='brace')return t===p&&p.guard<.1;
 if(a==='focus')return t===p&&p.mp<p.maxMp-10;
 return true;
}
function actionTarget(a,p){
 const d=ACTIONS[a];if(d.target==='foe'){let e=enemies.find(e=>e.id===state.target&&e.hp>0&&!e.hidden);return e||foes().sort((a,b)=>distance(p,a)-distance(p,b))[0];}
 if(d.target==='self')return p;
 if(d.target==='down')return party.find(p=>p.hp<=0);
 if(a==='ether')return living().sort((a,b)=>a.mp/a.maxMp-b.mp/b.maxMp)[0];
 return living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
}
function command(a){
 if(state.mode!=='play')return;
 const p=leader(),t=actionTarget(a,p);
 if(!t){toast(ACTIONS[a].target==='foe'?'Select an enemy first.':'No valid target for this action.');return;}
 if(!canUse(p,a,t)){toast(p.mp<cost(a)?'Not enough MP. Use Focus or an Ether.':a==='tonic'&&state.tonics<=0?'No tonics remain.':a==='brace'?'Brace is already active.':'This action has no valid target or supply.');return;}
 p.manual={action:a,target:t,rule:-1};p.action=null;p.cooldown=0;p.status='Manual: '+ACTIONS[a].name;
 if(t.kind){t.aggro=true;state.target=t.id;}
 sound('menu');renderHUD();
}
function startAction(p,c){
 if(!canUse(p,c.action,c.target))return false;
 const d=ACTIONS[c.action],range=d.target==='foe'?(c.action==='strike'?p.range:140):170;
 if(d.target==='foe'&&(distance(p,c.target)>range||!map.los(p.x,p.y,c.target.x,c.target.y)))return false;
 p.action={key:c.action,target:c.target,t:0,dur:d.time*(state.upgrades.includes('tempo')?.82:1),rule:c.rule};
 p.status=(c.rule>=0?'Rule '+(c.rule+1)+': ':'Manual: ')+d.name;p.facing=Math.atan2(c.target.y-p.y,c.target.x-p.x);if(p.manual===c)p.manual=null;return true;
}
function completeAction(p,a){
 const t=a.target,k=a.key;if(!canUse(p,k,t)){p.status='Target changed';return;}
 if(ACTIONS[k].target==='foe'&&(distance(p,t)>(k==='strike'?p.range+10:155)||!map.los(p.x,p.y,t.x,t.y))){p.cooldown=.35;p.status='Target out of reach';return;}
 p.mp-=cost(k);const upgrade=state.upgrades.includes('well')?30:0;
 if(ACTIONS[k].target==='foe'){
   const ranged=p.range>50||k!=='strike';const col=k==='gale'?'#81e9d5':k==='lance'?'#ffe7a1':p.color;
   if(ranged)fx.push({type:'beam',x:p.x,y:p.y,z:24,tx:t.x,ty:t.y,tz:t.kind==='boss'?35:15,t:0,dur:.27,color:col});
   p.anim=.42;p.attackAnim=E.move(k==='sunder'?'heavy':p.id===2?'thrust':'slash',.3,'active');
   let damage=k==='strike'?p.atk:k==='sunder'?79:k==='lance'?83:61;
   if(k==='gale'&&t.weak==='wind')damage*=1.45;if(k==='lance'&&t.weak==='sun')damage*=1.4;if(k==='strike'&&t.weak==='steel')damage*=1.25;
   if(k==='gale'&&state.hunt==='claimed')damage*=1.2;if(t.kind==='boss'&&t.phase===2)damage*=1.15;
   if(k==='sunder'){t.broken=10;log('Sundercut breaks the enemy armour.');}
   if(k==='gale'&&t.action){t.action=null;t.stagger=2;t.cooldown=2.1;state.interrupts=(state.interrupts||0)+1;float(t,'INTERRUPT','#83ebd6');log('Senn interrupts the cast.');sound('powerup',.35);}
   hurtEnemy(t,Math.round(damage*(t.broken>0?1.25:1)),p);sound(k==='gale'?'laser':k==='lance'?'powerup':'hit',.45);
 }else if(k==='mend'||k==='tonic'){
   if(k==='tonic')state.tonics--;const hp=k==='mend'?88+upgrade:115;t.hp=Math.min(t.maxHp,t.hp+hp);float(t,'+'+hp,'#8ff4c5');fx.push({type:'heal',x:t.x,y:t.y,t:0,dur:.8,color:'#84efd2'});sound('heal',.6);log(p.name+' uses '+ACTIONS[k].name+' on '+t.name+'.');
 }else if(k==='revive'||k==='feather'){
   if(k==='feather')state.revives--;t.hp=Math.round(t.maxHp*.5);t.cooldown=.4;t.action=null;t.hurt=0;float(t,'REVIVED','#b8f0d3');sound('powerup');
 }else if(k==='brace'){p.guard=7;float(p,'BRACE','#e7d498');log(p.name+' braces. Damage reduced by 70%.');sound('block');
 }else if(k==='ether'){state.ethers--;t.mp=Math.min(t.maxMp,t.mp+40);float(t,'+40 MP','#abd4ff');sound('heal',.5);
 }else if(k==='focus'){p.mp=Math.min(p.maxMp,p.mp+25);float(p,'+25 MP','#abd4ff');sound('heal',.2);}
 p.cooldown=k==='strike'?.45:.55;
}
function float(t,s,c){game.particles.text(t.x,t.y,(t.kind==='boss'?65:40),String(s),c,{bounce:false,scale:1});}
function hurtEnemy(e,damage,source){
 if(e.hp<=0)return;e.aggro=true;e.hp=Math.max(0,e.hp-damage);e.hurt=.18;float(e,damage,e.broken>0?'#ffe092':'#fff6d4');game.particles.sparks(e.x,e.y,15,5,null,{color:'#f1c785',speed:25});
 if(e.hp<=0){e.action=null;e.aggro=false;state.kills++;state.echoes+=e.xp;state.coins+=e.kind==='boss'?120:e.kind==='hunt'?80:18;if(state.target===e.id)state.target=null;game.particles.explosion(e.x,e.y,12,e.kind==='boss'?1.5:.6,{debris:['#dac490','#a08962'],sound:false,flash:false,freeze:false});sound('explode',.24);log(e.name+' defeated. +'+e.xp+' echoes');
   if(e.kind==='hunt'){state.hunt='defeated';toast('Hunt complete. Return to Keeper Orun for your reward.');}
   if(e.kind==='boss'){state.boss=true;toast('The Custodian falls. Restore the Skywell core.');music('field');for(const p of party){if(p.hp<=0)p.hp=Math.round(p.maxHp*.3);}chapter('THE MACHINE FALLS SILENT','The core is within reach');}
 }
}
function hurtParty(p,amount,e){if(p.hp<=0)return;let d=Math.round(amount*(p.guard>0?.3:1)*(state.upgrades.includes('shell')?.85:1)*(cfg.difficulty==='story'?.6:1));p.hp=Math.max(0,p.hp-d);p.hurt=.22;float(p,d,p.guard>0?'#d5d098':'#ffaf92');if(p.guard>0)sound('block',.35);else sound('hurt',.2);if(p.hp<=0){p.action=null;p.manual=null;p.status='Fallen';log(p.name+' has fallen. Use Revive or a Wakeleaf.');if(p.id===state.leader){const l=party.find(a=>a.hp>0);if(l)state.leader=l.id;path=[];}}}
function moveActor(a,dx,dy,speed,dt){const m=Math.hypot(dx,dy);if(m>.001){a.vx=dx/m*speed;a.vy=dy/m*speed;const ox=a.x,oy=a.y;a.x+=a.vx*dt;a.y+=a.vy*dt;map.collide(a);a.vx=(a.x-ox)/dt;a.vy=(a.y-oy)/dt;if(Math.hypot(a.vx,a.vy)>1)a.facing=Math.atan2(a.vy,a.vx);}else{a.vx=0;a.vy=0;}}
function clearWalk(a,t){const steps=Math.ceil(distance(a,t)/4);for(let i=1;i<=steps;i++){const x=E.lerp(a.x,t.x,i/steps),y=E.lerp(a.y,t.y,i/steps);for(const [dx,dy]of [[0,0],[-5,0],[5,0],[0,-5],[0,5]])if(!map.walkable(Math.floor((x+dx)/T),Math.floor((y+dy)/T)))return false;}return true;}
function toward(a,t,speed,dt,field){if(distance(a,t)<3){a.vx=a.vy=0;return;}if(clearWalk(a,t)){moveActor(a,t.x-a.x,t.y-a.y,speed,dt);return;}field.update(t.x,t.y);const d=field.dir(a.x,a.y,t.x,t.y);moveActor(a,d[0],d[1],speed,dt);}
function playerUpdate(dt){
 const l=leader();if(!l)return;
 let sx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x,sy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touch.y;
 const moving=Math.hypot(sx,sy)>.1;
 if(moving){path=[];interactGoal=null;const [dx,dy]=game.view.screenDirToGround(sx,sy);moveActor(l,dx,dy,keys.has('ShiftLeft')?102:76,dt);}
 else if(path.length){const [x,y]=path[0];if(Math.hypot(x-l.x,y-l.y)<5)path.shift();else moveActor(l,x-l.x,y-l.y,76,dt);}
 else{l.vx=l.vy=0;if(interactGoal&&distance(l,interactGoal)<36){const it=interactGoal;interactGoal=null;interact(it);}}
 for(const p of party){
   if(p.hp<=0)continue;p.guard=Math.max(0,p.guard-dt);p.hurt=Math.max(0,p.hurt-dt);p.anim=Math.max(0,p.anim-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.mp=Math.min(p.maxMp,p.mp+dt*(state.combat?.19:1.65));
   if(p.action){const a=p.action;if(a.target?.kind&&a.target.hp<=0){p.action=null;}else{a.t+=dt;if(a.t>=a.dur){p.action=null;completeAction(p,a);}}}
   let candidate=p.manual;
   if(candidate&&!canUse(p,candidate.action,candidate.target)){p.manual=null;candidate=null;}
   if(!p.action&&p.cooldown<=0){candidate=candidate||p.brain.choose(p,{target:findTarget},canUse);if(candidate){
      const target=candidate.target;const range=candidate.action==='strike'?p.range:140;
      if(target.kind&&(distance(p,target)>range||!map.los(p.x,p.y,target.x,target.y))){if(p!==l||(!moving&&!path.length&&p.manual)){toward(p,target,68,dt,p.follow);}}
      else startAction(p,candidate);
   }else p.status=state.combat?'Waiting':'Following';}
   if(p!==l&&!p.action&&!(candidate&&candidate.target.kind&&(distance(p,candidate.target)>p.range||!map.los(p.x,p.y,candidate.target.x,candidate.target.y)))){
     const fs=foes();if(fs.length){const near=fs.sort((a,b)=>distance(p,a)-distance(p,b))[0];if(p.id!==0&&distance(p,near)<45){const dx=p.x-near.x,dy=p.y-near.y;moveActor(p,dx,dy,50,dt);}else if(distance(p,l)>100)toward(p,l,81,dt,p.follow);else p.vx=p.vy=0;}
     else{let t={x:l.x+(p.id===1?-20:20),y:l.y+22};if(!map.walkable(Math.floor(t.x/T),Math.floor(t.y/T)))t={x:l.x,y:l.y};if(distance(p,t)>13)toward(p,t,Math.min(110,67+distance(p,t)*.2),dt,p.follow);else p.vx=p.vy=0;}
   }
   if(p!==l&&p.action)p.vx=p.vy=0;
 }
 // Soft separation keeps three rigs readable without trapping the leader.
 for(let i=0;i<party.length;i++)for(let j=i+1;j<party.length;j++){const a=party[i],b=party[j],d=distance(a,b);if(d>0&&d<10){const k=(10-d)*.1,dx=(b.x-a.x)/d,dy=(b.y-a.y)/d;if(b!==l){b.x+=dx*k;b.y+=dy*k;map.collide(b);}if(a!==l){a.x-=dx*k;a.y-=dy*k;map.collide(a);}}}
}
function enemyUpdate(dt){
 const live=living();
 for(const e of enemies){
  e.hurt=Math.max(0,e.hurt-dt);e.anim=Math.max(0,e.anim-dt);e.broken=Math.max(0,e.broken-dt);e.stagger=Math.max(0,e.stagger-dt);
  if(e.hp<=0){e.deadTime+=dt;continue;}if(e.hidden||!live.length)continue;if(e.kind==='boss'&&!state.seals.every(Boolean)){e.aggro=false;continue;}
  const nearest=live.slice().sort((a,b)=>distance(e,a)-distance(e,b))[0];
  if(!e.aggro&&distance(e,nearest)<(e.kind==='boss'?160:95)&&map.los(e.x,e.y,nearest.x,nearest.y)){
    e.aggro=true;if(!state.target)state.target=e.id;
    if(flag('first-battle'))toast('Battle has begun. Click an enemy to focus the party. Press Space to pause.');
  }
  if(!e.aggro){e.vx=e.vy=0;continue;}
  if(e.kind==='boss'&&flag('boss-intro')){toast('Custodian: interrupt Skyfall with Gale, or leave the marked area.');chapter('THE BRASS CUSTODIAN','Keeper of a broken oath');saveBossCheckpoint();}
  if(distance(e,nearest)>265&&e.kind!=='boss'){e.aggro=false;e.action=null;e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;continue;}
  if(e.stagger>0){e.vx=e.vy=0;continue;}
  if(e.kind==='boss'&&e.phase===1&&e.hp<e.maxHp*.5){e.phase=2;e.action=null;e.cooldown=.8;toast('The core is exposed. The Custodian gathers a wider storm.');log('Custodian phase II: faster casts and a wider Skyfall.');game.shake(3);float(e,'CORE EXPOSED','#8ff7e2');}
  if(e.action){const a=e.action;a.t+=dt;e.vx=e.vy=0;if(a.t>=a.dur){e.action=null;e.anim=.45;
      if(a.type==='burst'){for(const p of live)if(distance(p,a)<=a.radius)hurtParty(p,e.atk*(e.kind==='boss'?2.2:1.6),e);fx.push({type:'blast',x:a.x,y:a.y,t:0,dur:.6,r:a.radius,color:'#f6b876'});game.shake(e.kind==='boss'?4:2);sound('explode',.4);}
      else{const t=party.find(p=>p.id===a.target);if(t&&t.hp>0&&distance(t,e)<e.range+25&&map.los(e.x,e.y,t.x,t.y)){hurtParty(t,e.atk,e);fx.push({type:'beam',x:e.x,y:e.y,z:23,tx:t.x,ty:t.y,tz:17,t:0,dur:.18,color:'#ffb187'});}}
      e.cooldown=e.kind==='boss'?(e.phase===2?.9:1.2):1;
    }continue;}
  e.cooldown-=dt;
  // Guardians favour the vanguard when she is in reach.
  const nara=party[0],target=nara.hp>0&&distance(e,nara)<110?nara:nearest;
  if(distance(e,target)>e.range||!map.los(e.x,e.y,target.x,target.y)){toward(e,target,e.speed,dt,e.path);}else{e.vx=e.vy=0;e.facing=Math.atan2(target.y-e.y,target.x-e.x);}
  if(e.cooldown<=0&&distance(e,target)<=e.range+6&&map.los(e.x,e.y,target.x,target.y)){
    const burst=(e.kind==='boss'||e.kind==='hunt')&&(e.casts%3===1||e.phase===2&&e.casts%2===0);
    e.action=burst?{type:'burst',name:e.kind==='boss'?'Skyfall':'Sand rupture',t:0,dur:e.phase===2?2.25:2.7,x:target.x,y:target.y,radius:e.kind==='boss'?(e.phase===2?86:68):52,target:target.id}:{type:e.kind==='wisp'?'bolt':'strike',name:e.kind==='wisp'?'Wind lance':'Attack',t:0,dur:e.charge,target:target.id};e.casts++;
  }
 }
}
function saveBossCheckpoint(){
 // A retry preserves the player build and starts before the last bridge.
 const s=snapshot();s.position=[816,374];s.party=s.party.map((p,i)=>({...p,hp:party[i].maxHp,mp:party[i].maxMp}));for(const x of s.enemy){const e=enemies.find(e=>e.id===x.id);if(e?.kind==='boss')x.hp=e.maxHp;}state.checkpoint=structuredClone(s);E.store.set(SAVE,s);state.lastSave='Sanctum checkpoint saved';
}
function defeat(){state.mode='defeat';state.deaths++;path=[];music('field');showEnd(false);}
function update(dt){
 if(state.mode==='play'&&!state.paused&&!state.modal){
   state.elapsed+=dt;playerUpdate(dt);enemyUpdate(dt);state.combat=foes().length>0;
   if(!living().length){defeat();return;}
   const boss=foes().find(e=>e.kind==='boss');music(boss?'boss':state.combat?'battle':'field');
   nearby=landmarks.filter(it=>it.type!=='chest'||!state.opened.includes(it.id)).sort((a,b)=>distance(leader(),a)-distance(leader(),b))[0];if(nearby&&distance(leader(),nearby)>38)nearby=null;
   const area=areaAt(leader());if(area!==lastArea){lastArea=area;if(flag('area:'+area))chapter(area.toUpperCase(),'Amber Aqueduct');}
   if(state.target&&!enemies.some(e=>e.id===state.target&&e.hp>0))state.target=null;
 }
 const poseDt=state.paused||state.modal?0:dt;
 const partyPose=p=>{if(p.anim>0&&p.attackAnim){const age=.42-p.anim;return {spec:p.attackAnim.spec,phase:age<.14?'active':'recover',u:E.clamp(age<.14?age/.14:(age-.14)/.28,0,1)};}if(p.action&&['strike','sunder'].includes(p.action.key))return E.move(p.action.key==='sunder'?'heavy':p.id===2?'thrust':'slash',E.clamp(p.action.t/p.action.dur,0,1),'wind');return null;};
 const enemyPose=e=>{if(e.anim>0){const age=.45-e.anim;return E.move('heavy',E.clamp(age<.15?age/.15:(age-.15)/.3,0,1),age<.15?'active':'recover');}if(e.action?.type==='strike')return E.move('heavy',e.action.t/e.action.dur,'wind');return null;};
 for(const p of party){p.rig.update(poseDt,{...p,attack:partyPose(p),pose:state.complete?'cheer':p.hp<=0?'down':p.guard>0?'guard':p.action&&p.action.key!=='strike'?'cast':null,stance:state.combat?'ready':null,hurt:p.hurt>0,down:p.hp<=0?1:0});}
 for(const e of enemies)if(e.rig)e.rig.update(poseDt,{...e,attack:enemyPose(e),hurt:e.hurt>0,pose:e.hp<=0?'die':e.action?.type==='burst'?'cast':null,stance:e.aggro?'ready':null});
 if(!state.paused&&!state.modal)for(const f of fx)f.t+=dt;fx=fx.filter(f=>f.t<f.dur);
 const l=leader();if(l)game.focus(l.x,l.y,13);
 uiClock+=dt;if(uiClock>.12){uiClock=0;if(state.mode==='play')renderHUD();}
}

// The environment is real projected geometry. Every visible actor uses the supplied renderer.
function box(r,x,y,z,w,d,h,c){r.box(r.ctx,x-w/2,y-d/2,z,x+w/2,y+d/2,z+h,E.shade(c,.16),c);}
function queueBox(r,x,y,z,w,d,h,c,opts){r.queue(x,y,z,g=>r.box(g,x-w/2,y-d/2,z,x+w/2,y+d/2,z+h,E.shade(c,.17),c),opts);}
function column(r,p){
 const{x,y,h}=p;r.queue(x,y,0,g=>{for(const[z,w,hh,c]of [[0,20,5,'#ae8d63'],[5,16,5,'#c6aa7b'],[10,11,h-20,'#ccb586'],[h-10,16,5,'#b69b6e'],[h-5,21,5,'#e1c99a']])r.box(g,x-w/2,y-w/2,z,x+w/2,y+w/2,z+hh,E.shade(c,.1),c);
   const a=r.w(x-4,y+6,11),b=r.w(x-4,y+6,h-11);px.line(g,...a,...b,'#eee0b7');const c=r.w(x+4,y+6,11),d=r.w(x+4,y+6,h-11);px.line(g,...c,...d,'#977d5b');
 },{hides:true});
}
function banner(r,p){r.queue(p.x,p.y,0,g=>{const a=r.w(p.x,p.y,0),b=r.w(p.x,p.y,p.h);px.line(g,...a,...b,'#655c4d',2);const c=r.w(p.x+21,p.y,p.h);px.line(g,...b,...c,'#e5c084',2);
 const pts=[];for(let i=0;i<=7;i++){const wave=Math.sin(game.real*1.5+i*.58+p.seed)*2.2;pts.push(r.w(p.x+3+i*2.5,p.y+wave,p.h-3));}for(let i=7;i>=0;i--){const wave=Math.sin(game.real*1.5+i*.58+p.seed)*3;pts.push(r.w(p.x+3+i*2.5,p.y+wave,p.h-32+(i%3)));}px.poly(g,pts,'#984c41');const p1=r.w(p.x+12,p.y,p.h-8),p2=r.w(p.x+12,p.y,p.h-25);px.line(g,...p1,...p2,'#dfb774',2);const q=r.w(p.x+12,p.y,p.h-16);px.poly(g,[[q[0],q[1]-6],[q[0]+4,q[1]],[q[0],q[1]+6],[q[0]-4,q[1]]],'#dfb774');
 });}
function scarab(r,e){
 const size=e.kind==='hunt'?1.85:1,phase=game.real*7,sz=size*r.view.scale;const z=e.kind==='wisp'?13+Math.sin(game.real*2+e.x)*3:0;
 r.actor(e.x,e.y,z,(g,ox,oy)=>{
   if(e.kind==='wisp'){
     for(let i=0;i<5;i++){const a=game.real*1.2+i*TAU/5;px.poly(g,[[ox+Math.cos(a)*15,oy-20+Math.sin(a)*5],[ox+Math.cos(a+.3)*11,oy-31],[ox+Math.cos(a+.4)*8,oy-15]],i%2?'#b1ddd2':'#498e91');}
     px.disc(g,ox,oy-22,8,'#416875');px.disc(g,ox-2,oy-24,6,'#83cfc6');px.disc(g,ox-2,oy-24,2,'#e7ffe9');for(let i=0;i<4;i++)px.ell(g,ox+Math.sin(game.real*2+i)*4,oy-8+i*3,6-i,2,'#4f9b9c');return;
   }
   const proj=(x,y,z)=>{const a=e.facing,c=Math.cos(a),s=Math.sin(a),v=r.view.p((x*c-y*s)*size,(x*s+y*c)*size,z*size);return [ox+v[0],oy+v[1]];};
   const move=Math.hypot(e.vx,e.vy)>2;
   for(const side of [-1,1])for(let i=0;i<3;i++){
     const w=move?Math.sin(phase+i*1.4+(side>0?Math.PI:0))*3:Math.sin(game.real+i)*.4;
     const a=proj(-6+i*6,side*5,7),b=proj(-9+i*7+w,side*12,4),c=proj(-11+i*8+w,side*18,0);px.line(g,...a,...b,'#695841',Math.max(1,Math.round(2*sz)));px.line(g,...b,...c,'#b6945c',Math.max(1,Math.round(1.4*sz)));
   }
   const c=proj(0,0,8),top=proj(-2,-1,13);px.ell(g,...c,13*sz,8*sz,'#7a6547');px.ell(g,...top,11*sz,7*sz,e.kind==='hunt'?'#716852':'#aa8753');px.ell(g,top[0]-2*sz,top[1]-2*sz,8*sz,4*sz,e.kind==='hunt'?'#bda36c':'#d0b278');px.line(g,top[0],top[1]-5*sz,top[0]+4*sz,top[1]+5*sz,'#605741',Math.max(1,Math.round(sz)));
   for(const side of [-1,1]){const a=proj(10,side*4,9),b=proj(16,side*6,7);px.line(g,...a,...b,'#c5ab77',Math.max(1,Math.round(2*sz)));px.disc(g,b[0],b[1],2*sz,'#f1d49c');const eye=proj(12,side*3,11);px.disc(g,...eye,1.5*sz,e.aggro?'#ff8063':'#cde79b');}
   if(e.kind==='hunt'){for(let i=0;i<4;i++){const a=proj(-10+i*6,0,16);px.poly(g,[[a[0]-3,a[1]],[a[0],a[1]-9],[a[0]+4,a[1]]],'#e3c180');}}
 },{flash:e.hurt>0?'#fff4c5':null,outline:true,rim:true,margin:100,alpha:e.hp<=0?Math.max(0,1-e.deadTime):1});
}
function draw(r){
 if(!map)return;
 r.sky(['#163a48','#31535a','#557979']);map.drawFloor(r);
 // Projected water lines and moving wind make the empty channels active.
 for(let i=0;i<80;i++){const x=((i*147.3+game.real*5)%1135)+8,y=((i*97.1)%682)+8;const cx=Math.floor(x/T),cy=Math.floor(y/T);if(!floorMask[cy*WM+cx]||floorMask[cy*WM+cx]===7){const a=r.w(x,y,-1),b=r.w(x+10,y,-1);if(a[0]>-20&&a[0]<r.W+20&&a[1]>-10&&a[1]<r.H+10)px.line(r.ctx,...a,...b,i%3?'#54898a':'#72a8a0');}}
 // Compass mosaics give each court a readable centre.
 for(const[x,y,rad]of [[620,369,75],[634,115,32],[672,624,33],[1021,347,83],[184,552,44]]){
   r.groundRing(x,y,rad,'#877551',.7);r.groundRing(x,y,rad-4,'#e3c995',.65);for(let i=0;i<8;i++){const a=i*TAU/8,p=r.w(x+Math.cos(a)*(rad-8),y+Math.sin(a)*(rad-8),.1),q=r.w(x+Math.cos(a)*rad,y+Math.sin(a)*rad,.1);px.line(r.ctx,...p,...q,'#f0d5a3',2);}r.groundRing(x,y,rad*.27,'#b0905c',.7);
 }
 map.queueWalls(r);
 for(const p of props){if(!r.visible(p.x,p.y,0,170))continue;
   if(p.type==='column')column(r,p);
   else if(p.type==='banner')banner(r,p);
   else if(p.type==='edge'){const w=p.side==='south'?16:3,d=p.side==='south'?3:16,x=p.x+(p.side==='east'?6:0),y=p.y+(p.side==='south'?6:0);queueBox(r,x,y,-13,w,d,17,'#9f815d');if(p.seed%4===0)queueBox(r,x,y,4,6,6,7,'#d4b887');}
   else if(p.type==='brazier'){queueBox(r,p.x,p.y,0,9,9,12,'#88704d');r.prop('brazier',p.x,p.y,12,{size:1.1});}
   else if(p.type==='urn')r.prop('barrel',p.x,p.y,0,{size:1.25,color:'#b99466'});
   else if(p.type==='arch'){
     column(r,{x:p.x,y:p.y-p.w/2,h:p.h});column(r,{x:p.x,y:p.y+p.w/2,h:p.h});
     r.queue(p.x,p.y,0,g=>{for(let i=0;i<8;i++){const yy=p.y-p.w/2+i*p.w/8,z=p.h-3+Math.sin(i/8*Math.PI)*10;r.box(g,p.x-7,yy,z,p.x+7,yy+p.w/8+1,z+9,'#e5cd9c','#b18e64');}}, {hides:true,bias:-45});
   }
 }
 for(const it of landmarks){if(!r.visible(it.x,it.y,0,100))continue;
   if(it.type==='keeper'){
     if(!it.rig)it.rig=new E.Humanoid({build:'heroic',size:1.2,weapon:'staff',hair:'bald',outfit:'robe',colors:{skin:'#ad845e',hair:'#cec7af',cloth:'#968669',trim:'#d5b16b'}});it.rig.update(.008,{x:it.x,y:it.y,facing:.2,pose:'hips'});r.shadow(it.x,it.y,8,.35);r.actor(it.x,it.y,0,(g,x,y)=>it.rig.draw(g,x,y,r.view),{xray:true});r.textAt(it.x,it.y,47,state.hunt==='defeated'?'REWARD':'KEEPER','#f0d293',{scale:1});
   }else if(it.type==='save'){
     queueBox(r,it.x,it.y,0,20,20,5,'#c5b188');r.queue(it.x,it.y,0,g=>{const p=r.w(it.x,it.y,20+Math.sin(game.real*1.5)*2);r.glowDisc(g,...p,23,'#5be9c2',.2);px.poly(g,[[p[0],p[1]-15],[p[0]+7,p[1]],[p[0],p[1]+10],[p[0]-7,p[1]]],'#67d9c2');px.poly(g,[[p[0],p[1]-15],[p[0]+7,p[1]],[p[0],p[1]+10]],'#c0f7d9');},{emissive:true});
   }else if(it.type==='seal'){
     const active=state.seals[it.id];queueBox(r,it.x,it.y,0,28,28,7,'#b1a17d');r.skywellRing(it.x,it.y,25,active?'#8de5c9':'#e5c77d');r.queue(it.x,it.y,0,g=>{const p=r.w(it.x,it.y,26);for(let j=0;j<3;j++){const pts=[];for(let k=0;k<20;k++){const a=k/20*TAU+game.real*(active?.5:.13),v=r.view.p(Math.cos(a)*17,Math.sin(a)*8,Math.sin(a+j)*11);pts.push([p[0]+v[0],p[1]+v[1]]);}for(let k=0;k<pts.length;k++)px.line(g,...pts[k],...pts[(k+1)%pts.length],active?'#9af0d1':'#cfad72');}r.glowDisc(g,...p,15,active?'#9ef4d0':'#f1bf71',.25);px.disc(g,...p,4,active?'#d5ffe9':'#fff0b2');},{emissive:active});r.textAt(it.x,it.y,58,active?'ATTUNED':it.id===0?'NORTH SEAL':'SOUTH SEAL',active?'#c5ffdf':'#f8df9d');
   }else if(it.type==='chest'&&!state.opened.includes(it.id)){queueBox(r,it.x,it.y,0,17,12,10,'#887252');r.queue(it.x,it.y,0,g=>{const p=r.w(it.x,it.y+7,7);px.rect(g,p[0]-2,p[1]-2,5,5,'#f0d397');});r.textAt(it.x,it.y,25,'◇','#f6d99e');
   }else if(it.type==='lore')r.prop('sign',it.x,it.y,0,{size:1.2});
 }
 if(!state.seals.every(Boolean)){
   r.queue(866,373,0,g=>{for(let yy=339;yy<=410;yy+=9){const a=r.w(866,yy,3),b=r.w(866,yy,59);px.line(g,...a,...b,'#78b9b4',2);}const a=r.w(866,335,60),b=r.w(866,415,60);px.line(g,...a,...b,'#ead095',2);},{emissive:true});
 }
 // The water engine at the end is distinct from the two field seals.
 const cx=1072,cy=265;queueBox(r,cx,cy,0,35,35,10,'#b7a078');r.queue(cx,cy,0,g=>{const p=r.w(cx,cy,45);for(let j=0;j<3;j++){let prev=null;for(let i=0;i<=32;i++){const a=i/32*TAU+game.real*.1,pp=r.w(cx+Math.cos(a)*25,cy+Math.sin(a)*13,45+Math.sin(a+j)*22);if(prev)px.line(g,...prev,...pp,state.complete?'#a0e8ce':'#ceb87b',2);prev=pp;}}r.glowDisc(g,...p,25,state.complete?'#86efda':'#e3b36f',.35);px.disc(g,...p,7,state.complete?'#dcffec':'#f6d79d');},{emissive:true});
 for(const e of enemies){if(e.hidden||e.hp<=0&&e.deadTime>1.1)continue;
   if(e.action?.type==='burst'){r.skywellRing(e.action.x,e.action.y,e.action.radius,'#f58f68',e.action.t/e.action.dur,true);r.textAt(e.action.x,e.action.y,2,'MOVE OR BRACE','#ffdbbc');}
   if(e.hp>0)r.shadow(e.x,e.y,e.r+4,.32);
   if(state.target===e.id&&e.hp>0)r.skywellRing(e.x,e.y,e.r+10,'#f3c584');
   if(e.rig){r.actor(e.x,e.y,0,(g,x,y)=>e.rig.draw(g,x,y,r.view),{xray:true,outline:true,flash:e.hurt>0?'#fff2bb':null,alpha:e.hp<=0?Math.max(0,1-e.deadTime):1,margin:160});
     if(e.kind==='boss'&&e.hp>0){r.queue(e.x,e.y,0,g=>{const p=r.w(e.x,e.y,64);for(let i=0;i<18;i++){const a=i/18*TAU+game.real*.2;px.disc(g,p[0]+Math.cos(a)*35,p[1]+Math.sin(a)*14,1.4,'#ddc286');}const cc=r.w(e.x+4,e.y+6,49);px.disc(g,...cc,4,e.phase===2?'#c9ffed':'#76bcb7');});}
   }else scarab(r,e);
   if(e.aggro&&e.hp>0){r.overlay(g=>{const [sx,sy]=r.w(e.x,e.y,e.kind==='boss'?94:e.kind==='hunt'?48:43),w=e.kind==='boss'?64:38;px.rect(g,sx-w/2,sy,w,3,'#243536');px.rect(g,sx-w/2,sy,w*e.hp/e.maxHp,3,'#e59579');if(e.action){px.rect(g,sx-w/2,sy+5,w,2,'#22383b');px.rect(g,sx-w/2,sy+5,w*e.action.t/e.action.dur,2,'#f2d48c');}});
     if(cfg.lines&&e.action){const t=party.find(p=>p.id===e.action.target);if(t)r.decal(()=>{const a=r.w(e.x,e.y,2),b=r.w(t.x,t.y,2);px.blend(r.ctx,.35,'normal',()=>px.line(r.ctx,...a,...b,'#e6aa78'));});}
   }
 }
 for(const p of party){r.shadow(p.x,p.y,8,.36);if(p.id===state.leader&&p.hp>0)r.skywellRing(p.x,p.y,12,'#8bd9ce');if(p.guard>0)r.skywellRing(p.x,p.y,15,'#efd998');
   r.actor(p.x,p.y,0,(g,x,y)=>p.rig.draw(g,x,y,r.view),{xray:true,outline:true,flash:p.hurt>0?'#ffae95':null,margin:100});
   if(p.action&&['mend','lance','gale','focus','revive'].includes(p.action.key))r.queue(p.x,p.y,0,g=>{const a=r.w(p.x,p.y,25);r.glowDisc(g,...a,11+Math.sin(game.real*5)*3,p.color,.25);});
 }
 for(const f of fx){const u=f.t/f.dur;if(f.type==='beam'){r.queue(f.tx,f.ty,2,g=>{const a=r.w(f.x,f.y,f.z),b=r.w(f.tx,f.ty,f.tz);px.blend(g,1-u,'add',()=>{px.line(g,...a,...b,f.color,2);px.disc(g,...b,4,f.color);});},{emissive:true});}else if(f.type==='heal'){r.skywellRing(f.x,f.y,12+u*16,f.color);r.queue(f.x,f.y,0,g=>{for(let i=0;i<9;i++){const a=i*2.4+game.real*2,p=r.w(f.x+Math.cos(a)*10,f.y+Math.sin(a)*10,u*35);px.disc(g,...p,1.5,f.color);}},{emissive:true});}else if(f.type==='blast')r.skywellRing(f.x,f.y,f.r*u,f.color,1,true);}
 if(path.length){const end=path[path.length-1];r.skywellRing(end[0],end[1],6+Math.sin(game.real*5)*1.5,'#f9e3ac');}
 game.particles.draw(r);
 // Dust is deterministic decoration and never enters collision or action logic.
 for(let i=0;i<17;i++){const x=(i*53.1+game.real*7)%r.W,y=(i*31.7+Math.sin(game.real*.2+i)*12)%r.H;px.rect(r.ctx,x,y,1+(i%2),1,'#dfd0a3');}
}

function interactionName(it){if(it.type==='seal')return state.seals[it.id]?'Rest at seal':'Attune '+(it.id===0?'north':'south')+' seal';if(it.type==='gate')return state.seals.every(Boolean)?'Cross the skybridge':'Inspect sealed bridge';if(it.type==='save')return 'Rest and save';if(it.type==='core')return state.complete?'Expedition record':state.boss?'Restore the Skywell':'Inspect the core';if(it.type==='keeper')return state.hunt==='defeated'?'Claim hunt reward':'Speak with Orun';if(it.type==='chest')return 'Open coffer';return 'Read inscription';}
function interact(it=nearby){
 if(!it||state.mode!=='play')return;if(state.combat&&it.type!=='gate'){toast('Finish the nearby battle first.');return;}
 path=[];interactGoal=null;
 if(it.type==='keeper')showKeeper();
 else if(it.type==='save')saveAt(it.x+22,it.y);
 else if(it.type==='seal'){
   if(state.seals[it.id]){saveAt(it.x,it.y+22);return;}
   const guards=enemies.filter(e=>e.hp>0&&!e.hidden&&e.kind!=='hunt'&&distance(e,it)<140);if(guards.length){toast('The seal is bound. Defeat its nearby guardians.');return;}
   state.seals[it.id]=true;state.echoes+=2;updateGate();game.shake(2);sound('powerup');saveAt(it.x,it.y+23,true);toast(state.seals.every(Boolean)?'Both seals answer. The skybridge is open.':'Wind seal attuned. +2 echoes. Party restored.');
   showDialogue(it.id===0?'IVO':'SENN',it.id===0?'The north current is moving again. These channels still remember their purpose.':'Water under the dust. The south seal is awake. We can bring this place back.',()=>{if(state.seals.every(Boolean))chapter('THE SKYBRIDGE OPENS','Reach the Brass Sanctum');});
 }else if(it.type==='gate'){if(!state.seals.every(Boolean))showDialogue('NARA','Two currents hold this bridge closed. We must restore the north and south wind seals.');else toast('The bridge is open. The Custodian waits in the east.');}
 else if(it.type==='chest'){
   if(state.opened.includes(it.id))return;state.opened.push(it.id);if(it.id==='camp'){state.tonics+=3;toast('Supply coffer: 3 tonics.');}else if(it.id==='south'){state.echoes+=3;state.ethers++;toast('Wayfinder cache: 3 echoes and 1 ether.');}else{state.revives+=2;state.coins+=45;toast('Lost field pack: 2 wakeleaves and 45 crowns.');}sound('coin');
 }else if(it.type==='lore')showDialogue('WEATHERED INSCRIPTION','“No house shall own the rain.” The old keepers built the Skywell for every settlement below. Its water was never a gift from a crown.');
 else if(it.type==='core'){if(!state.boss){toast('The Brass Custodian still controls the core.');return;}if(state.complete){showEnd(true);return;}
   state.complete=true;for(const p of party){p.hp=p.maxHp;p.mp=p.maxMp;}music('victory');sound('powerup');showDialogue('NARA','The water belongs to the people below. Open every channel.',()=>{saveAt(1060,291,true);state.mode='complete';showEnd(true);});
 }
 renderHUD();
}
function showKeeper(){
 if(state.hunt==='defeated'){
   state.hunt='claimed';state.coins+=120;state.echoes+=3;state.tonics+=2;sound('coin');showDialogue('KEEPER ORUN','The Dune Widow is gone. Take this windglass charm, 120 crowns, and two tonics. Your Gale strikes will be stronger. You have given our workers a road home.');return;
 }
 showDialogue('KEEPER ORUN',state.hunt==='none'?'The pumps stopped three days ago. Restore both wind seals, then reach the core. One more thing: a Dune Widow has taken the forgotten court to the northwest. Our workers cannot pass.':'Two wind seals feed the core. Use the waystones to rest. The Dune Widow waits in the forgotten court to the northwest.',null,[...(state.hunt==='none'?[{label:'Accept the hunt',fn:()=>{state.hunt='accepted';const h=enemies.find(e=>e.kind==='hunt');h.hidden=false;closeOverlay();toast('Hunt accepted: The Dune Widow. Reward: windglass charm and 120 crowns.');}}]:[]),{label:'Buy supplies',fn:showShop},{label:'Leave',fn:closeOverlay}]);
}

function patchHud(html){
 const root=$('#hud'),template=document.createElement('template');
 if(!template.content){root.innerHTML=html;return;}
 template.innerHTML=html;
 const sync=(a,b)=>{
  if(a.nodeType!==b.nodeType||a.nodeType===1&&a.tagName!==b.tagName){a.replaceWith(b.cloneNode(true));return;}
  if(a.nodeType===3){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
  if(a.nodeType!==1)return;
  for(const x of [...a.attributes])if(!b.hasAttribute(x.name))a.removeAttribute(x.name);
  for(const x of [...b.attributes])if(a.getAttribute(x.name)!==x.value)a.setAttribute(x.name,x.value);
  if(a.tagName==='CANVAS')return;
  const bc=[...b.childNodes];for(let i=0;i<bc.length;i++){if(a.childNodes[i])sync(a.childNodes[i],bc[i]);else a.appendChild(bc[i].cloneNode(true));}
  while(a.childNodes.length>bc.length)a.lastChild.remove();
 };
 const children=[...template.content.childNodes];for(let i=0;i<children.length;i++){if(root.childNodes[i])sync(root.childNodes[i],children[i]);else root.appendChild(children[i].cloneNode(true));}
 while(root.childNodes.length>children.length)root.lastChild.remove();
}
function renderHUD(){
 if(state.mode!=='play'){if(state.mode==='title')$('#hud').innerHTML='';return;}
 const p=leader(),target=enemies.find(e=>e.id===state.target&&e.hp>0),boss=foes().find(e=>e.kind==='boss');
 const sealCount=state.seals.filter(Boolean).length,objective=state.complete?'The Skywell flows again':state.boss?'Restore the Skywell core':sealCount===2?'Reach the Brass Sanctum':'Restore the two wind seals';
 const sub=state.complete?'The aqueduct is open. Explore or view your record.':state.boss?'Use the core in the north of the sanctum.':sealCount===2?'Cross the eastern skybridge.':`${sealCount} of 2 seals attuned · North and south courts`;
 patchHud(`<div class="topbar"><div class="location"><span class="diamond">◈</span><div><div class="eyebrow">Sands of the Skywell</div><h2>Amber Aqueduct</h2><div class="small muted" style="font-size:11px;letter-spacing:.06em">${areaAt(p)}</div></div></div><nav class="toolbar" aria-label="Game menus"><button data-do="journal" title="Journal (J)">Journal <kbd>J</kbd></button><button data-do="tactics" title="Tactics (G)">Tactics <kbd>G</kbd></button><button data-do="board" title="Wayfinder board (L)">Growth <kbd>L</kbd></button><button data-do="settings" title="Settings">⚙</button></nav></div>
 <div class="objective"><strong>◇ &nbsp; ${objective}</strong><div class="sub">${sub}</div>${sealCount<2?`<div class="seal-dots"><i class="${state.seals[0]?'on':''}"></i><i class="${state.seals[1]?'on':''}"></i></div>`:''}</div>
 <button class="minimap" data-do="map" title="Open map (M)" aria-label="Open aqueduct map"><canvas id="mini" width="216" height="132"></canvas><div class="minimap-footer"><span>AMBER AQUEDUCT</span><span>N ↑</span></div></button>
 ${state.paused||state.combat?`<div class="encounter ${state.paused?'paused':''}"><div class="state">${state.paused?'TACTICAL PAUSE':'⚔ &nbsp; ENGAGED'}</div>${boss?`<div class="bossbar"><strong>${boss.name}</strong><div class="bar danger"><i style="width:${percent(boss.hp,boss.maxHp)}%"></i></div><small>${boss.action?.type==='burst'?boss.action.name.toUpperCase()+' · GALE TO INTERRUPT':boss.phase===2?'PHASE II · CORE EXPOSED':'PHASE I · BRASS WARD'}</small></div>`:''}</div>`:''}
 ${target&&!boss?`<div class="target-info"><div class="eyebrow" style="font-size:9px">Party target</div><strong>${target.name}</strong><div class="bar danger"><i style="width:${percent(target.hp,target.maxHp)}%"></i></div><div class="weak">HP ${Math.ceil(target.hp)} / ${target.maxHp}<br>Weakness: ${target.weak}${target.broken>0?' · Armour broken':''}</div></div>`:''}
 <section class="party" aria-label="Party"><div class="party-caption">PARTY &nbsp;·&nbsp; TAB TO CHANGE LEADER</div>${party.map(a=>`<button class="party-card ${a.id===state.leader?'selected':''} ${a.hp<=0?'fallen':''}" data-do="leader" data-id="${a.id}" aria-label="Select ${a.name}"><div class="portrait p${a.id}"></div><div class="party-details"><div class="party-name"><b>${a.name}</b><small>${a.role}</small></div><div class="hp-numbers"><span>HP <em>${Math.ceil(a.hp)}</em> / ${a.maxHp}</span><span>MP ${Math.floor(a.mp)}</span></div><div class="bar ${a.hp/a.maxHp<.3?'danger':''}"><i style="width:${percent(a.hp,a.maxHp)}%"></i></div><div class="bar mp"><i style="width:${percent(a.mp,a.maxMp)}%"></i></div><div class="bar charge"><i style="width:${a.action?percent(a.action.t,a.action.dur):0}%"></i></div><div class="party-action">${a.hp<=0?'Fallen · use Revive':a.guard>0?'Brace · '+Math.ceil(a.guard)+'s':a.status}</div></div></button>`).join('')}</section>
 <section class="commands" aria-label="Commands"><div class="commands-head"><span>COMMANDS</span><span>${p.name} · ${Math.floor(p.mp)} MP</span></div><div class="command-grid">${['strike',p.skill,p.id===1?'mend':'tonic','brace'].map((k,i)=>`<button data-do="command" data-key="${k}" title="${ACTIONS[k].name}"><span class="cmd-icon">${ACTIONS[k].icon}</span><span class="cmd-text">${ACTIONS[k].name}<small>${k==='tonic'?state.tonics+' left':k==='brace'?'Reduce damage':cost(k)?cost(k)+' MP':'No MP cost'}</small></span><kbd>${i+1}</kbd></button>`).join('')}<button data-do="pack"><span class="cmd-icon">▣</span><span class="cmd-text">Pack<small>Items & revival</small></span><kbd>I</kbd></button><button data-do="command" data-key="focus"><span class="cmd-icon">◎</span><span class="cmd-text">Focus<small>Restore 25 MP</small></span><kbd>5</kbd></button><button class="focus-command" data-do="pause"><span class="cmd-text">${state.paused?'Resume battle':'Pause & plan'}</span><kbd>SPACE</kbd></button></div><div class="command-hint">${state.paused?'Select an action, then resume.':'Manual orders take priority over rules.'}</div></section>
 ${nearby?`<div class="interaction"><button data-do="interact"><kbd>E</kbd>${interactionName(nearby)}</button></div>`:''}
 <div class="battle-log">${state.lastLog&&game.real-state.logAt<5?state.lastLog:state.paused?'Time is stopped. Set orders for each party member.':''}</div>
 <div class="bottom-bar"><div class="control-legend"><span><kbd>W A S D</kbd> Move</span><span><kbd>CLICK</kbd> Move / target</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>SPACE</kbd> Pause</span><span><kbd>E</kbd> Interact</span></div><div class="bottom-status">${state.echoes} ECHOES &nbsp;·&nbsp; ${state.coins} CROWNS</div></div>
 ${state.chapter&&game.real<state.chapter.end?`<div class="chapter-notice"><small>${state.chapter.sub}</small>${state.chapter.area}</div>`:''}`);
 miniCanvas=$('#mini');miniCtx=miniCanvas?.getContext('2d');if(miniCtx)drawMini(miniCtx,216,132);
}
function drawMini(g,w,h,large=false){g.clearRect(0,0,w,h);const sx=w/WM,sy=h/HM;for(let y=0;y<HM;y++)for(let x=0;x<WM;x++){const tag=floorMask[y*WM+x];if(tag&&tag!==7){g.fillStyle=tag===6?'#958768':tag===5?'#586d69':'#788b7a';g.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));}}g.fillStyle='#d8b579';if(!state.seals.every(Boolean))g.fillRect(54*sx,21*sy,sx,5*sy);
 const mark=(x,y,color,size)=>{g.fillStyle=color;g.fillRect(x/16*sx-size,y/16*sy-size,size*2,size*2);};
 for(const s of seals)mark(s.x,s.y,state.seals[s.id]?'#80e5c1':'#f7d68a',large?5:2.5);for(const it of landmarks)if(it.type==='save')mark(it.x,it.y,'#70dfc7',large?3:1.5);for(const e of enemies)if(!e.hidden&&e.hp>0&&(large||distance(e,leader())<230))mark(e.x,e.y,e.kind==='boss'?'#edba7e':'#e88770',large?3:1.5);mark(1072,265,'#f2dfa4',large?5:2);mark(128,526,'#b6d9ec',large?4:2);for(const p of party)if(p.hp>0)mark(p.x,p.y,p.id===state.leader?'#f5fff1':'#a9dcce',large?4:2);
 if(large){g.font='13px Arial';g.textAlign='center';g.fillStyle='#f0e1bd';for(const[x,y,s]of [[12,36,'WEST APPROACH'],[16,11,'FORGOTTEN COURT'],[39,7,'NORTH SEAL'],[39,39,'SOUTH SEAL'],[41,23,'SUN COURT'],[65,26,'BRASS SANCTUM']])g.fillText(s,x*sx,y*sy);}
}

function closeOverlay(){const was=state.modal;state.modal=null;$('#overlay').innerHTML='';dialogDone=null;keys.clear();if(state.mode==='play')renderHUD();if(focusBeforeModal?.isConnected)focusBeforeModal.focus();else $('#world').focus({preventScroll:true});}
function modal(title,subtitle,body,foot='',className=''){
 focusBeforeModal=document.activeElement;state.modal=title;keys.clear();$('#overlay').innerHTML=`<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-head"><div><div class="eyebrow">${subtitle}</div><h2>${title}</h2></div><button data-do="close" aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><span>${foot||'Time is stopped while this menu is open.'}</span><button data-do="close" class="primary">Return to field</button></div></section></div>`;$('#overlay button')?.focus();sound('menu',.3);
}
function showTitle(){state.mode='title';state.modal=null;state.paused=false;$('#hud').innerHTML='';const saved=E.store.get(SAVE);$('#overlay').innerHTML=`<div class="start-screen"><div class="start-top"><span>AN ORIGINAL PARTY RPG</span><span class="edition">THE AMBER AQUEDUCT</span></div><div class="title-mark">◈</div><h1>SANDS<span>OF THE</span>SKYWELL</h1><p class="start-intro">A silent machine. A city without water.<br>Three travellers with one last chance.</p><div class="start-actions"><button class="primary" data-do="new">Begin expedition <span>◇</span></button>${saved?'<button class="secondary" data-do="continue">Continue expedition <span>◈</span></button>':''}<button class="secondary small-btn" data-do="how">How to play <span>?</span></button><button class="secondary small-btn" data-do="credits">About this game <span>✧</span></button></div><div class="start-side-label">THE RAIN BELONGS TO EVERYONE</div><div class="start-bottom"><span><strong>EXPLORE. SET YOUR RULES. RESTORE THE SKYWELL.</strong><br>Keyboard & mouse · Touch controls · Local checkpoints</span><span>MY-3D2DGE GAME EDITION<br>Original world, art, and music</span></div></div>`;$('#overlay button')?.focus();}
function showBriefing(){modal('The rain belongs to everyone','Expedition briefing',`<div class="two-col"><div><h3>Restore the Skywell</h3><p>The old water engine has stopped. Reach the north and south wind seals. Restore both currents to open the bridge to the core.</p><div class="notes"><h3>Your first steps</h3><p>Speak with Keeper Orun. Then follow the stone road east. Enemies are visible on the road. Your party uses its battle rules when combat starts.</p><p style="margin-top:12px">Press <kbd>Space</kbd> to stop time and plan. Press <kbd>G</kbd> to edit party rules.</p></div><p class="mobile-note">On touch screens, use the left stick to move. Tap enemies to target them.</p></div><div class="roles"><h3>Three travellers</h3>${party.map(p=>`<div class="role"><div class="portrait p${p.id}"></div><span><b>${p.name} · ${p.role.toLowerCase()}</b>${p.id===0?'Break armour. Draw enemy attacks.':p.id===1?'Heal allies. Restore the fallen.':'Attack at range. Interrupt enemy casts.'}</span></div>`).join('')}</div></div>`,'Progress saves at waystones and restored seals.','briefing');$('.modal-foot').innerHTML='<span>One complete expedition. No timer or score target.</span><button class="primary" data-do="begin">Enter the aqueduct</button>';}
function showDialogue(speaker,text,done=null,choices=null){
 state.modal='dialogue';keys.clear();dialogDone=done;$('#overlay').innerHTML=`<section class="dialogue" role="dialog" aria-modal="true" aria-label="${speaker}"><div class="speaker">${speaker}</div><p>${text}</p><div class="dialogue-actions">${choices?choices.map((c,i)=>`<button class="${i===0?'primary':''}" data-choice="${i}">${c.label}</button>`).join(''):'<button class="primary" data-do="dialogue-next">Continue <kbd>E</kbd></button>'}</div></section>`;if(choices)$('#overlay').querySelectorAll('[data-choice]').forEach(b=>b.onclick=choices[+b.dataset.choice].fn);$('#overlay button')?.focus();}
function nextDialogue(){const fn=dialogDone;closeOverlay();fn?.();}
let tacticPerson=0;
function showTactics(id=tacticPerson){tacticPerson=id;const p=party[id];modal('Party tactics','Orders of the wayfarers',`<p>Rules run from top to bottom. The first usable rule selects the next action.</p><div class="tabs">${party.map(a=>`<button class="${a.id===id?'active':''}" data-do="tactics-person" data-id="${a.id}"><strong>${a.name}</strong><small>${a.role}</small></button>`).join('')}</div><div class="rule-head"><p>${p.name} · ${p.brain.rules.length} of 6 rule slots</p><button class="toggle" data-do="brain-toggle">AUTO RULES ${p.brain.enabled?'ON':'OFF'}</button></div><div class="rules">${p.brain.rules.map((r,i)=>`<div class="rule-row ${r.on?'':'off'}"><span class="rule-num">${String(i+1).padStart(2,'0')}</span><input type="checkbox" ${r.on?'checked':''} data-rule="${i}" data-field="on" aria-label="Enable rule ${i+1}"><select data-rule="${i}" data-field="when" aria-label="Rule ${i+1} condition">${Object.entries(CONDITIONS).map(([v,l])=>`<option value="${v}" ${r.when===v?'selected':''}>${l}</option>`).join('')}</select><span class="rule-link gold">›</span><select data-rule="${i}" data-field="action" aria-label="Rule ${i+1} action">${charActions(p).map(k=>`<option value="${k}" ${r.action===k?'selected':''}>${ACTIONS[k].name}${cost(k)?' · '+cost(k)+' MP':''}</option>`).join('')}</select><div class="reorder"><button data-do="rule-up" data-id="${i}" ${i===0?'disabled':''} aria-label="Move rule ${i+1} up">↑</button><button data-do="rule-down" data-id="${i}" ${i===p.brain.rules.length-1?'disabled':''} aria-label="Move rule ${i+1} down">↓</button></div><button class="rule-delete" data-do="rule-delete" data-id="${i}" aria-label="Delete rule ${i+1}">×</button></div>`).join('')}</div><button class="add-rule" data-do="rule-add" ${p.brain.rules.length>=6?'disabled':''}>+ Add rule</button><div class="rule-info">Keep healing above attacks. A rule is skipped if its target, MP, or item is unavailable. Manual commands override these rules. Changes apply at once.</div>`,'Your rules are included in the next checkpoint.');}
function showBoard(){modal('The Wayfinder board','Growth through experience',`<p>Spend echoes from battles and wind seals. Each path has two connected abilities. <span class="gold">${state.echoes} echoes available.</span></p><div class="nodes">${UPGRADES.map(u=>{const own=state.upgrades.includes(u.id),locked=u.req&&!state.upgrades.includes(u.req);return `<button class="node ${own?'owned':''}" data-do="upgrade" data-key="${u.id}" ${own||locked||state.echoes<u.cost?'disabled':''}><div class="eyebrow" style="font-size:9px">${u.branch} · ${u.req?'II':'I'}</div><h3>${u.name}</h3><p>${u.desc}</p><small>${own?'✓ Learned':locked?'Requires '+UPGRADES.find(x=>x.id===u.req).name:u.cost+' echoes'}</small></button>`;}).join('')}</div><div class="rule-info">Abilities apply to this expedition. Rest at a waystone to restore HP after a maximum HP increase.</div>`,'Growth is saved at your next checkpoint.');}
function upgrade(id){const u=UPGRADES.find(x=>x.id===id);if(!u||state.upgrades.includes(id)||state.echoes<u.cost||u.req&&!state.upgrades.includes(u.req))return;state.echoes-=u.cost;state.upgrades.push(id);applyStats();sound('powerup',.4);showBoard();renderHUD();}
function showJournal(){modal('Expedition journal','The Amber Aqueduct',`<div class="two-col"><article class="journal-card"><div class="eyebrow">MAIN OBJECTIVE</div><h3>A city without water</h3><p>Restore both wind seals. Open the eastern bridge and take back the Skywell core.</p><ul class="checklist"><li class="${state.seals[0]?'done':''}">Restore the north wind seal.</li><li class="${state.seals[1]?'done':''}">Restore the south wind seal.</li><li class="${state.boss?'done':''}">Defeat the Brass Custodian.</li><li class="${state.complete?'done':''}">Restore the Skywell core.</li></ul><div class="reward">The water returns to the settlements below.</div></article><article class="journal-card"><div class="eyebrow">OPTIONAL HUNT · RANK I</div><h3>The Dune Widow</h3><p>A great carapace blocks the old workers’ road. Speak with Orun, then search the forgotten court to the northwest.</p><ul class="checklist"><li class="${state.hunt!=='none'?'done':''}">Accept Orun’s contract.</li><li class="${['defeated','claimed'].includes(state.hunt)?'done':''}">Defeat the Dune Widow.</li><li class="${state.hunt==='claimed'?'done':''}">Return to Orun for payment.</li></ul><div class="reward">Windglass charm · 120 crowns · 2 tonics<br>Charm: Gale damage increases by 20%.</div></article></div><div class="notes"><h3>Field notes</h3>Gale breaks enemy casts. Silt carapaces are weak to wind. Hollow sentinels are weak to Sunlance. Sundercut breaks armour for 10 seconds. A marked circle shows where a heavy attack will land. Move clear, interrupt the cast, or use Brace.</div>`);}
function showMap(){modal('Map of the aqueduct','North is up',`<canvas id="large-map" width="864" height="528" style="display:block;width:100%;background:#102730;border:1px solid var(--line)"></canvas><div class="notes" style="display:flex;gap:18px;flex-wrap:wrap;font-size:12px"><span class="gold">◆ Wind seals / core</span><span class="teal">◆ Waystones</span><span style="color:#e88770">◆ Enemies</span><span>◆ Party</span><span style="color:#b6d9ec">◆ Keeper</span></div>`,'Use the field to move. The map shows the full aqueduct.');drawMini($('#large-map').getContext('2d'),864,528,true);}
function showPack(){const p=leader();modal('Field pack','Supplies for the crossing',`<p>Select an item for the party member who needs it most. Current leader: <span class="gold">${p.name}</span>.</p><div class="nodes"><button class="node" data-do="pack-use" data-key="tonic" ${!state.tonics?'disabled':''}><div class="eyebrow">${state.tonics} IN PACK</div><h3>Tonic</h3><p>Restores 115 HP to the ally with the lowest HP.</p><small>Use tonic</small></button><button class="node" data-do="pack-use" data-key="ether" ${!state.ethers?'disabled':''}><div class="eyebrow">${state.ethers} IN PACK</div><h3>Ether</h3><p>Restores 40 MP to the ally with the lowest MP.</p><small>Use ether</small></button><button class="node" data-do="pack-use" data-key="feather" ${!state.revives?'disabled':''}><div class="eyebrow">${state.revives} IN PACK</div><h3>Wakeleaf</h3><p>Revives one fallen ally with half their maximum HP.</p><small>Use wakeleaf</small></button></div>${p.id===1?'<button class="add-rule" data-do="pack-use" data-key="revive">Cast Revive · '+cost('revive')+' MP</button>':''}<div class="rule-info">An item becomes a manual order. It is consumed when the action completes. Supply purchases are available from Keeper Orun.</div>`);}
function showShop(){modal('Orun’s provisions','Keeper of the west approach',`<p>Spend crowns earned from battles. <span class="gold">${state.coins} crowns available.</span></p><div class="nodes">${[['tonics','Tonic',25,'Restores 115 HP.'],['ethers','Ether',35,'Restores 40 MP.'],['revives','Wakeleaf',50,'Revives a fallen ally.']].map(([id,name,price,desc])=>`<button class="node" data-do="buy" data-key="${id}" ${state.coins<price?'disabled':''}><div class="eyebrow">${state[id]} IN PACK</div><h3>${name}</h3><p>${desc}</p><small>${price} crowns · Buy one</small></button>`).join('')}</div>`,'Supplies and crowns are saved at your next checkpoint.');}
function showSettings(){modal('Settings','Make the crossing your own',`<div class="setting-row"><label for="sound">Sound<small>Original field, battle, and guardian themes.</small></label><input id="sound" data-setting="sound" type="checkbox" ${cfg.sound?'checked':''}></div><div class="setting-row"><label for="volume">Sound level</label><input id="volume" data-setting="volume" type="range" min="0" max="1" step=".05" value="${cfg.volume}"></div><div class="setting-row"><label for="motion">Screen motion<small>Camera shake and impact effects.</small></label><input id="motion" data-setting="motion" type="checkbox" ${cfg.motion?'checked':''}></div><div class="setting-row"><label for="lines">Enemy target lines<small>Show which ally the enemy will attack.</small></label><input id="lines" data-setting="lines" type="checkbox" ${cfg.lines?'checked':''}></div><div class="setting-row"><label for="difficulty">Battle difficulty<small>Story mode reduces incoming damage by 40%.</small></label><select id="difficulty" data-setting="difficulty"><option value="normal" ${cfg.difficulty==='normal'?'selected':''}>Standard</option><option value="story" ${cfg.difficulty==='story'?'selected':''}>Story</option></select></div><div class="notes"><h3>Expedition</h3><p>${state.lastSave||'No checkpoint saved this session.'}</p><button class="add-rule" data-do="quit">Return to title</button></div>`,'Changes apply at once.');}
function howTo(){modal('How to play','A guide for the crossing',`<div class="two-col"><div><h3 style="margin-bottom:18px">Field controls</h3><div class="key-grid"><div><kbd>W A S D</kbd> Move</div><div><kbd>CLICK</kbd> Move or select a foe</div><div><kbd>SHIFT</kbd> Run</div><div><kbd>TAB</kbd> Change leader</div><div><kbd>E</kbd> Interact</div><div><kbd>SPACE</kbd> Pause and resume</div><div><kbd>1–5</kbd> Manual actions</div><div><kbd>G</kbd> Party tactics</div><div><kbd>L</kbd> Growth board</div><div><kbd>M</kbd> Map</div><div><kbd>J</kbd> Journal</div><div><kbd>I</kbd> Pack</div></div></div><div><h3 style="margin-bottom:18px">Battle basics</h3><p>Enemies are visible on the field. Party rules select actions, then an action bar fills. Click a foe to focus the party on it.</p><p style="margin-top:12px">Pause to set manual orders. Select a party member, then select an action. Manual orders replace that member’s current action.</p><p style="margin-top:12px">Gale interrupts casts. Brace reduces damage by 70% for seven seconds. Focus restores 25 MP.</p></div></div><div class="notes">Rest at green waystones to restore the party and save. Both wind seals open the final bridge. On touch screens, use the left stick to move and tap the field controls.</div>`);if(state.mode==='title')$('.modal-foot').innerHTML='<span>Original party combat on the exploration map.</span><button class="primary" data-do="title">Return to title</button>';}
function showCredits(){modal('About the expedition','Original game · research & credits',`<div class="credits"><p><strong>Sands of the Skywell</strong> is an original tactical party RPG. The Amber Aqueduct is one complete level with two seal routes, an optional hunt, and a final guardian.</p><h3>Foundation</h3><p>Built with the supplied <strong>my-3D2dge 0.6.0 Game Edition</strong> by Michael Crosato, under the MIT License. The game uses its projected 3D world, animated rigs, depth-sorted renderer, tile collision, particles, and sound synthesizer. Skywell adds ordered battle rules, party combat, navigation, progression, and checkpoints.</p><h3>Art and sound</h3><p>The world, cast, enemies, interface, and score are original. Landscape and portrait art were made for this game with image generation. Characters, creatures, architecture, combat effects, and moving cloth are rendered in the game engine. No Final Fantasy art, audio, character, or map files are used.</p><h3>Design research</h3><p>Final Fantasy XII informed field combat, party orders, visible enemies, and hunts. Guide research kept those systems connected while the new world uses its own story and rules.</p><a href="https://www.gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system" target="_blank" rel="noopener">Gamer Guides · Battle System</a><br><a href="https://primagames.com/eguides/final-fantasy-xii-the-zodiac-age-eguide/gambits/gambits" target="_blank" rel="noopener">Prima · Gambits</a><br><a href="https://www.rpgsite.net/feature/5784-final-fantasy-xii-license-board-and-lp-guide-for-the-zodiac-age" target="_blank" rel="noopener">RPG Site · License Board and LP</a><br><a href="https://strategywiki.org/wiki/Final_Fantasy_XII/Gambits" target="_blank" rel="noopener">StrategyWiki · Gambits</a><h3>Edition</h3><p>Single-player browser edition. Progress is stored in this browser at checkpoints. Sound starts after a click or key press. Desktop keyboard and mouse provide the widest view; touch controls are also included.</p></div>`);if(state.mode==='title')$('.modal-foot').innerHTML='<span>The rain belongs to everyone.</span><button class="primary" data-do="title">Return to title</button>';}
function showEnd(won){state.modal=won?'completion':'defeat';const minutes=Math.floor(state.elapsed/60),seconds=Math.floor(state.elapsed%60);$('#overlay').innerHTML=`<div class="end-screen"><div class="end-content"><div class="eyebrow">${won?'EXPEDITION COMPLETE':'THE CROSSING IS NOT OVER'}</div><h1>${won?'The Skywell sings again.':'Rise with the next wind.'}</h1><p>${won?'Water fills the old channels. Far below, the city opens its empty cisterns. For the first time in three days, the people hear rain.':'The party has fallen. Your checkpoint keeps your progress and party rules. Return, change your plan, and try again.'}</p><div class="end-stats"><div><b>${minutes}:${String(seconds).padStart(2,'0')}</b><small>FIELD TIME</small></div><div><b>${state.kills}</b><small>FOES DEFEATED</small></div><div><b>${won?(state.hunt==='claimed'?'Complete':state.hunt==='defeated'?'Unclaimed':'Open'):state.seals.filter(Boolean).length+'/2'}</b><small>${won?'OPTIONAL HUNT':'WIND SEALS'}</small></div></div>${won?'<button class="primary" data-do="return-field">Return to aqueduct</button><button data-do="title">Title screen</button>':'<button class="primary" data-do="retry">Retry from checkpoint</button><button data-do="story-retry">Retry in story mode</button>'}<div class="footnote">${won?'Sands of the Skywell · The Amber Aqueduct':'Tip: Put healing rules above attacks. Gale interrupts the guardian’s cast.'}</div></div></div>`;$('#overlay button')?.focus();}
function quitPrompt(){showDialogue('RETURN TO TITLE','Your last checkpoint is safe. Field progress since that checkpoint will be lost.',null,[{label:'Keep playing',fn:closeOverlay},{label:'Return to title',fn:showTitle}]);}
function switchLeader(id){if(party[id]?.hp<=0){toast('That party member has fallen.');return;}state.leader=id;path=[];interactGoal=null;renderHUD();}
function pause(){if(state.mode!=='play'||state.modal)return;state.paused=!state.paused;keys.clear();sound('pause',.3);renderHUD();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b)return;const act=b.dataset.do,id=Number(b.dataset.id),k=b.dataset.key;
 const actions={new:startNew,continue:()=>{if(!loadSave())toast('No valid checkpoint is available.');},begin,title:showTitle,close:()=>state.mode==='title'?showTitle():closeOverlay(),how:howTo,credits:showCredits,journal:showJournal,tactics:()=>showTactics(),board:showBoard,map:showMap,settings:showSettings,pack:showPack,pause,interact:()=>interact(),leader:()=>switchLeader(id),command:()=>command(k),'dialogue-next':nextDialogue,'tactics-person':()=>showTactics(id),'brain-toggle':()=>{party[tacticPerson].brain.enabled=!party[tacticPerson].brain.enabled;showTactics();},'rule-up':()=>moveRule(id,-1),'rule-down':()=>moveRule(id,1),'rule-delete':()=>{party[tacticPerson].brain.rules.splice(id,1);showTactics();},'rule-add':()=>{const r=party[tacticPerson].brain.rules;if(r.length<6)r.push({when:'foeNear',action:'strike',on:true});showTactics();},upgrade:()=>upgrade(k),buy:()=>{const price={tonics:25,ethers:35,revives:50}[k];if(price&&state.coins>=price){state.coins-=price;state[k]++;sound('coin',.4);showShop();}},'pack-use':()=>{closeOverlay();command(k);},quit:quitPrompt,retry:()=>{const deaths=state.deaths;loadSave(state.checkpoint);state.deaths=deaths;toast('Party restored at the checkpoint.');},'story-retry':()=>{cfg.difficulty='story';E.store.set(SETTINGS,cfg);const deaths=state.deaths;loadSave(state.checkpoint);state.deaths=deaths;toast('Story mode enabled. Incoming damage is reduced.');},'return-field':()=>{state.mode='play';closeOverlay();renderHUD();}};
 if(actions[act])actions[act]();
});
function moveRule(i,delta){const rules=party[tacticPerson].brain.rules,j=i+delta;if(j<0||j>=rules.length)return;[rules[i],rules[j]]=[rules[j],rules[i]];showTactics();}
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.rule!==undefined){const rule=party[tacticPerson].brain.rules[+t.dataset.rule];if(rule){rule[t.dataset.field]=t.dataset.field==='on'?t.checked:t.value;if(t.dataset.field==='on')showTactics();}}if(t.dataset.setting){const k=t.dataset.setting;cfg[k]=t.type==='checkbox'?t.checked:k==='volume'?+t.value:t.value;game.reduceMotion=!cfg.motion;game.audio.muted=!cfg.sound;game.audio.setVolume(cfg.volume);
game.audio.define('menu', {wave:'sine',freq:740,to:920,dur:.07,vol:.15});
game.audio.define('block', [{wave:'triangle',freq:320,to:170,dur:.15,vol:.25},{wave:'noise',freq:2200,to:700,dur:.1,vol:.12}]);
E.MOVES.heavy={...E.MOVES.twohand};if(cfg.sound){const mk=musicKey;musicKey='';music(mk||'field');}else game.audio.stopMusic();setVolume();E.store.set(SETTINGS,cfg);}});
function setVolume(){game.audio.setVolume(cfg.volume);}
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(state.modal){if(e.code==='Escape'){e.preventDefault();if(state.modal==='dialogue')nextDialogue();else if(state.mode==='title')showTitle();else if(!['completion','defeat'].includes(state.modal))closeOverlay();}if(state.modal==='dialogue'&&(e.code==='KeyE'||e.code==='Space'||e.code==='Enter')&&!$('#overlay [data-choice]')){e.preventDefault();nextDialogue();}return;}
 if(state.mode==='title'){if(e.code==='Enter')startNew();return;}if(state.mode!=='play')return;
 if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(e.code==='Space')pause();else if(e.code==='Tab'){let n=(state.leader+1)%3;while(party[n].hp<=0&&n!==state.leader)n=(n+1)%3;switchLeader(n);}else if(e.code==='KeyE')interact();else if(e.code==='KeyG')showTactics();else if(e.code==='KeyJ')showJournal();else if(e.code==='KeyL')showBoard();else if(e.code==='KeyM')showMap();else if(e.code==='KeyI')showPack();else if(e.code==='Escape')pause();else if(/^Digit[1-5]$/.test(e.code)){command(['strike',leader().skill,leader().id===1?'mend':'tonic','brace','focus'][+e.code.slice(5)-1]);}
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();touch.x=touch.y=0;if(state.mode==='play'&&!state.modal){state.paused=true;renderHUD();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='play'){state.paused=true;keys.clear();touch.x=touch.y=0;}});
$('#world').addEventListener('pointerdown',e=>{
 if(state.mode!=='play'||state.modal)return;$('#world').focus({preventScroll:true});
 const [sx,sy]=game.screen.clientToScreen(e.clientX,e.clientY),world=game.view.toGround(sx,sy);if(!world)return;
 const hit=enemies.filter(a=>!a.hidden&&a.hp>0).map(a=>{const p=game.view.p(a.x,a.y,a.kind==='boss'?35:19);return {a,d:Math.hypot(p[0]-sx,p[1]-sy)};}).filter(x=>x.d<(x.a.kind==='boss'?49:29)).sort((a,b)=>a.d-b.d)[0];
 if(hit){if(hit.a.kind==='boss'&&!state.seals.every(Boolean)){toast('Restore both wind seals before you enter the sanctum.');return;}if(!map.los(leader().x,leader().y,hit.a.x,hit.a.y)){toast('A wall blocks this target. Move to a clear view.');return;}state.target=hit.a.id;hit.a.aggro=true;if(!state.paused){const range=leader().range;if(distance(leader(),hit.a)>range){path=nav.path(leader().x,leader().y,hit.a.x,hit.a.y);pathGoal=hit.a;}}toast('Party target: '+hit.a.name);renderHUD();return;}
 if(state.paused)return;
 const it=landmarks.filter(a=>a.type!=='chest'||!state.opened.includes(a.id)).map(a=>{const p=game.view.p(a.x,a.y,a.type==='seal'?20:12);return {a,d:Math.hypot(p[0]-sx,p[1]-sy)};}).filter(x=>x.d<22).sort((a,b)=>a.d-b.d)[0];
 if(it){if(distance(leader(),it.a)<38){interact(it.a);return;}interactGoal=it.a;path=nav.path(leader().x,leader().y,it.a.x,it.a.y+20);}else{interactGoal=null;path=nav.path(leader().x,leader().y,...world);}
 pathGoal=null;
});
// Stop at weapon range when a click started pursuit; the player can always move away.
const originalPlayerUpdate=playerUpdate;playerUpdate=function(dt){if(pathGoal&&path.length&&pathGoal.hp>0&&distance(leader(),pathGoal)<=leader().range*.9){path=[];pathGoal=null;}originalPlayerUpdate(dt);};
function touchSetup(){if(!('ontouchstart'in window)&&!matchMedia('(pointer:coarse)').matches)return;document.body.classList.add('touch-mode');$('#touch-controls').innerHTML='<div class="touch-stick" aria-label="Move party"><div class="touch-knob"></div></div><button class="touch-pause" data-do="pause" aria-label="Pause">Ⅱ</button><button class="touch-interact" data-do="interact">E</button>';const stick=$('.touch-stick'),knob=$('.touch-knob');let pointer=null;
 const move=e=>{if(pointer!==e.pointerId)return;const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),max=39,k=Math.min(1,max/(l||1));touch.x=dx*k/max;touch.y=dy*k/max;knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;};stick.addEventListener('pointerdown',e=>{pointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});stick.addEventListener('pointermove',move);for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,()=>{pointer=null;touch.x=touch.y=0;knob.style.transform='';});}
// Keyboard focus remains within open dialogs.
document.addEventListener('keydown',e=>{if(e.code!=='Tab'||!state.modal)return;const list=[...$('#overlay').querySelectorAll('button:not(:disabled),select,input,a[href]')];if(!list.length)return;const i=list.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&i===list.length-1){e.preventDefault();list[0].focus();}});
function publicState(){return {mode:state.mode,paused:state.paused,menu:state.modal,objective:state.complete?'complete':state.boss?'restore_core':state.seals.every(Boolean)?'defeat_guardian':'restore_seals',seals:[...state.seals],hunt:state.hunt,leader:leader()?.name,elapsedSeconds:Math.floor(state.elapsed),position:leader()?{x:Math.round(leader().x),y:Math.round(leader().y)}:null,party:party.map(p=>({name:p.name,x:Math.round(p.x),y:Math.round(p.y),hp:Math.ceil(p.hp),maxHp:p.maxHp,mp:Math.floor(p.mp),action:p.action?.key||null,rule:p.action?.rule??null})),enemies:foes().map(e=>({name:e.name,hp:e.hp,action:e.action?.name||null})),supplies:{tonics:state.tonics,ethers:state.ethers,wakeleaves:state.revives},echoes:state.echoes,coins:state.coins,errors:game.errors.length};}
// Same interface actions are exposed to browsers that implement WebMCP.
if(document.modelContext?.registerTool){
 for(const tool of [{name:'read_expedition',title:'Read expedition state',description:'Read party health, current objective, supplies, and battle state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>publicState()},{name:'set_tactical_pause',title:'Set tactical pause',description:'Pause or resume field time. Does not close an open game menu.',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(typeof input?.paused!=='boolean')throw Error('paused must be a boolean');if(state.mode!=='play'||state.modal)throw Error('The field must be active with no menu open.');state.paused=input.paused;renderHUD();return publicState();}}])try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch(_){}
}
// A read-only state hook supports reproducible local validation without adding cheats to play.
window.Skywell={state:publicState,version:'1.0.0',engine:E.version};
buildMap();createParty();createEnemies();game.start({update,draw});touchSetup();showTitle();
document.addEventListener('pointerdown',()=>{setVolume();},{once:true});
})();
