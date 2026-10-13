/* Dust & Mercy — The Bitter Creek Run.
   Original game code. The supplied my-3D2dge is the simulation and rendering foundation. */
(function(root){
'use strict';
const E=My3D2dge,px=E.px,L=FrontierLevel,P=L.P,$=id=>document.getElementById(id);
FrontierArt.install(E);
const game=new E.Game({canvas:$('screen'),view:new E.View('frontier','Bitter Creek',25,48,1.55,1.25),minW:640,minH:360,maxW:1600,maxH:1100,bg:'#9b8d60',input:{...E.Input.DEFAULT,up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],interact:['KeyE','Pad0'],mount:['KeyF','Pad1'],whistle:['KeyH','Pad3'],fire:['Mouse0','Space','Pad7'],reload:['KeyR','Pad2'],focus:['KeyQ','Pad4'],crouch:['KeyC','ControlLeft','Pad11'],run:['ShiftLeft','ShiftRight','Pad10'],heal:['KeyB','Pad13'],disarm:['KeyX','Pad5'],journal:['KeyJ','KeyM','Pad8'],satchel:['Tab','KeyI','Pad12'],pause:['Escape','KeyP','Pad9']}});
game.pauseOverlay=false;game.fadeTime=0;game.cam.smooth=.19;
const world=new FrontierWorld(game.view);
const sound=typeof FrontierAudio==='function'?new FrontierAudio(game):{enabled:false,start(){},enable(v){this.enabled=v;},update(){},sfx(){}};
const QA_MODE=new URLSearchParams(location.search).get('qa')==='1';
const SAVE=QA_MODE?'dust-mercy:qa-checkpoint-v1':'dust-mercy:checkpoint-v1',PREF='dust-mercy:preferences-v1';
let prefs=Object.assign({sound:false,assist:true,motion:!game.reduceMotion},E.store.get(PREF,{}));
game.reduceMotion=!prefs.motion;
let mode='title',previousMode='play',guideFrom='title',state,player,horse,npcs,enemies,witness,heroRig,clock=0,uiClock=0,mapClock=0,focusOn=false,reload=0,fireCD=0,hurtCD=0,shotFlash=0,action=null,interactTarget=null,lastRegion='',regionTimer=0,toastTimer=0,subtitleTimer=0,checkpointTimer=0,dialogue=null,dustTimer=0,ambientTimer=0,navGrid=null,navVersion=false,deathCount=0;
let traces=[],groundMarks=[],visualParticles=[],menuRepeat=0;
const random=E.rng(88723);
const ENEMY_START=[
 {id:'gate-west',x:1766,y:745,facing:Math.PI/2,patrol:[[1766,745],[1720,682]],name:'Yard guard'},
 {id:'gate-east',x:1933,y:750,facing:Math.PI/2,patrol:[[1933,750],[2020,755]],name:'Gate guard'},
 {id:'loader',x:1810,y:600,facing:1,patrol:[[1810,600],[1910,632],[1905,590]],name:'Freight guard'},
 {id:'rear',x:1713,y:491,facing:Math.PI,patrol:[[1713,491],[1737,548],[1702,581]],name:'Creek guard'},
 {id:'platform',x:1966,y:548,facing:1.6,patrol:[[1966,548],[1990,492],[2010,506]],name:'Platform guard'},
 {id:'foreman',x:2079,y:657,facing:Math.PI,patrol:[[2079,657],[2025,652]],name:'Foreman Rook'}
];
const CACHES=[{id:'camp-box',x:288,y:1423,label:'Camp supplies'},{id:'trail-box',x:1115,y:1046,label:'Trail cache'},{id:'depot-box',x:1993,y:675,label:'Freight supplies'}];
const HERBS=[{id:'herb-1',x:775,y:1250},{id:'herb-2',x:1210,y:951},{id:'herb-3',x:1582,y:742}];
const OBJECTIVES=[
 ['Speak to Dr. Bell','The doctor is beside the large tent.'],
 ['Ride to Cinder Spur','Follow the trail northeast. Ash is ready to ride.'],
 ['Recover the medicine chest','Speak at the gate, find the creek path, or enter the yard.'],
 ['Bring the medicine home',"Return to Dr. Bell at Calder's Rest."],
 ['The Bitter Creek Run','Chapter complete.']
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clone(x){return JSON.parse(JSON.stringify(x));}
function createRig(kind='guard',color){
 const colors=kind==='hero'?{cloth:'#576355',pants:'#484b3f',boot:'#382e25',skin:'#c59268',hair:'#3b2c21',belt:'#65472e',glove:'#b6885d',cape:'#485344',capeIn:'#343e34'}:kind==='doctor'?{cloth:'#c4b99a',pants:'#6f6753',boot:'#433b2e',skin:'#a7795a',hair:'#382923'}:kind==='worker'?{cloth:'#7c8a80',pants:'#6b634e',boot:'#483c2d',skin:'#d1aa7b'}:{cloth:color||'#857451',pants:'#534f42',boot:'#403429',skin:'#c79d70',hair:'#443529'};
 return new E.Humanoid({build:'heroic',size:kind==='hero'?1.04:1,weapon:kind==='doctor'||kind==='worker'||kind==='broker'||kind==='civilian'?null:'gun',hat:kind==='doctor'?null:{style:'cowboy',color:kind==='hero'?'#796449':kind==='worker'?'#a79366':'#635a43'},hair:kind==='hero'?'long':'short',sleeves:'long',cape:kind==='hero'?{len:5,seg:2.1,width:5}:null,colors});
}
function defaultState(){return {version:1,stage:0,trust:45,cash:18,bandages:2,rations:2,ammo:6,reserve:36,health:100,stamina:100,focus:100,elapsed:0,flags:{aided:false,permit:false,reachedDepot:false,rear:false,medicine:false,sold:false,reported:false,escaped:false,horseFed:false,focusUsed:false,coverUsed:false,firstShot:false,returnNotice:false,warning:false},looted:[],herbs:[],notes:['The freight company controls the rail depot.'],stats:{shots:0,hits:0,kills:0,spared:0,horseCare:0,damage:0,retries:0,route:'Undecided'},wanted:0,lastSeen:0,ending:null};}
function reset(saved){
 state=defaultState();if(saved){for(const k of Object.keys(state))if(saved[k]!==undefined)state[k]=clone(saved[k]);state.flags=Object.assign(defaultState().flags,saved.flags||{});}
 const loc=saved?.player||{x:365,y:1450,facing:-2.4};player=new E.Body({x:loc.x,y:loc.y,r:6.5});player.facing=loc.facing||-2.4;player.crouched=false;
 horse=Object.assign(new E.Body({x:P.horse.x,y:P.horse.y,r:11}),{facing:-.5,speed:0,stamina:100,bond:0,mounted:false,called:false,route:[],pathTimer:0});
 if(saved?.horse)Object.assign(horse,clone(saved.horse));player.r=horse.mounted?11:6.5;if(horse.mounted){horse.x=player.x;horse.y=player.y;}
 heroRig=createRig('hero');
 npcs=[{id:'doctor',name:'Dr. Mara Bell',...P.doctor,kind:'doctor',facing:1.1},{id:'worker',name:'Eli Reed',...P.worker,kind:'worker',facing:1.4},{id:'clerk',name:'Jonas Pike',...P.clerk,kind:'civilian',facing:1.6},{id:'broker',name:'Caleb Voss',...P.broker,kind:'broker',facing:.8},{id:'camper',name:'Nell',x:347,y:1510,kind:'civilian',facing:-1.9}].map(n=>({...n,rig:createRig(n.kind),z:0}));
 enemies=ENEMY_START.map((n,i)=>Object.assign(new E.Body({x:n.x,y:n.y,r:6}),clone(n),{hp:76,alert:0,surrendered:false,deadT:0,shootCD:1+i*.27,wind:0,patrolIndex:0,wait:.7+i*.3,route:[],pathTimer:0,seen:0,rig:createRig('guard',i===5?'#614d3b':i%2?'#707967':'#897c59')}));
 if(saved?.enemies)for(const se of saved.enemies){let en=enemies.find(e=>e.id===se.id);if(!en&&(se.posse||se.id.startsWith('rider-'))){en=makeRider(se.id,se.x,se.y);enemies.push(en);}if(en)Object.assign(en,se);}
 witness=Object.assign(new E.Body({x:1990,y:749,r:6}),{id:'witness',name:'Freight worker',state:'idle',facing:2.4,timer:0,route:[],pathTimer:0,rig:createRig('worker')});
 if(saved?.witness)Object.assign(witness,saved.witness);
 focusOn=false;game.timeScale=1;game.hitstop=0;game.shakeAmt=0;reload=0;fireCD=0;hurtCD=0;action=null;dialogue=null;traces=[];groundMarks=[];visualParticles=[];world.rearOpen=state.flags.rear;navGrid=null;navVersion=world.rearOpen;
 game.particles.list && (game.particles.list.length=0);game.follow(player,{z:horse.mounted?25:16,lead:10});lastRegion='';regionTimer=0;toastTimer=0;subtitleTimer=0;interactTarget=null;
 updateRigs(.1);updateHUD(true);
}
function serialise(){return {...clone(state),player:{x:player.x,y:player.y,facing:player.facing},horse:{x:horse.x,y:horse.y,facing:horse.facing,stamina:horse.stamina,bond:horse.bond,mounted:horse.mounted,called:false},enemies:enemies.map(e=>({id:e.id,posse:!!e.posse,facing:e.facing,x:e.x,y:e.y,hp:e.hp,surrendered:e.surrendered,alert:e.alert,seen:e.seen,patrolIndex:e.patrolIndex})),witness:{x:witness.x,y:witness.y,state:witness.state,timer:witness.timer}};}
function savedGame(){const s=E.store.get(SAVE,null);return s&&s.version===1&&Number.isFinite(s.player?.x)&&Number.isFinite(s.player?.y)&&s.stage>=0&&s.stage<4?s:null;}
function saveCheckpoint(label){const ok=E.store.set(SAVE,serialise());checkpointTimer=3;$('checkpoint-flash').textContent=ok?'◆ Checkpoint saved on this device':'Checkpoint is available until this page closes';$('checkpoint-flash').classList.remove('hidden');root.__lastCheckpoint=serialise();if(label)toast(label);updateContinue();}
function updateContinue(){$('continue').classList.toggle('hidden',!savedGame());}
function setMode(next){
 const old=mode;mode=next;for(const id of['title-screen','pause-screen','guide-screen','journal-screen','satchel-screen','death-screen','ending-screen','dialogue'])$(id).classList.add('hidden');
 const id={title:'title-screen',pause:'pause-screen',guide:'guide-screen',map:'journal-screen',satchel:'satchel-screen',dead:'death-screen',ending:'ending-screen',dialogue:'dialogue'}[next];if(id)$(id).classList.remove('hidden');
 $('hud').classList.toggle('hidden',next==='title'||next==='ending');document.body.classList.toggle('dialogue-open',next==='dialogue');
 $('hud').inert=next!=='play';$('screen').tabIndex=next==='play'?0:-1;
 if(next!=='play'){focusOn=false;game.timeScale=1;document.body.classList.remove('focus-active');player.vx=player.vy=0;horse.speed=0;}
 game.input.clear();if(next==='play')$('screen').focus({preventScroll:true});
 else if(next!==old){requestAnimationFrame(()=>{const first=id&&$(id).querySelector('button:not([disabled])');if(first)first.focus({preventScroll:true});});}
}
function startNew(){deathCount=0;reset();setMode('play');sound.start();sound.enable(prefs.sound);saveCheckpoint();showRegion("CALDER'S REST",'THE RELIEF CAMP');say('Dr. Bell is waiting. Walk to her and press E.',6);}
function continueGame(){const s=savedGame();if(s){reset(s);setMode('play');sound.start();sound.enable(prefs.sound);toast('The trail is where you left it.');}else startNew();}
function retry(){const s=root.__lastCheckpoint||savedGame();deathCount++;reset(s);state.stats.retries=deathCount;setMode('play');toast('Checkpoint restored. Try another way.');}
function toTitle(){setMode('title');updateContinue();}
function toast(text,seconds=4){$('toast').textContent=text;$('toast').classList.remove('hidden');toastTimer=seconds;}
function say(text,seconds=5){$('subtitle').textContent=text;$('subtitle').classList.remove('hidden');subtitleTimer=seconds;}
function note(text){if(!state.notes.includes(text))state.notes.push(text);}
function trust(delta,text){state.trust=E.clamp(state.trust+delta,0,100);if(text)toast(text+(delta>0?' · Trust +'+delta:' · Trust '+delta));}
function showRegion(name,sub){lastRegion=name;$('region-name').textContent=name;$('region-sub').textContent=sub;$('region').classList.add('hidden');void $('region').offsetWidth;$('region').classList.remove('hidden');regionTimer=5;}
function talk(speaker,line,choices){
 action=null;dialogue={speaker,line,choices};$('speaker').textContent=speaker.toUpperCase();$('dialogue-line').textContent=line;const host=$('choices');host.replaceChildren();choices.forEach((ch,i)=>{const b=document.createElement('button');const key=document.createElement('kbd');key.textContent=String(i+1);const text=document.createElement('span');text.textContent=ch.text;b.append(key,text);b.disabled=!!ch.disabled;b.addEventListener('click',()=>choose(i));host.append(b);});setMode('dialogue');
}
function choose(index){if(mode!=='dialogue'||!dialogue)return;const ch=dialogue.choices[index];if(!ch||ch.disabled)return;dialogue=null;setMode('play');sound.sfx('pickup');ch.action?.();updateHUD(true);}
function closeTalk(){setMode('play');}
function speakDoctor(){
 if(state.stage===0){talk('Dr. Mara Bell','The freight company took our medicine. Six families are waiting. I need that chest from Cinder Spur, Ada. Bring it back before the lamps burn down.',[{text:'I will bring it home.',action:()=>talk('Dr. Mara Bell','There are bandages by the tent. Take Ash and follow the old road. Ask before you draw. Some of those guards have family here.',[{text:'I understand.',action:()=>{state.stage=1;note('Mara needs the whole medicine chest. It is on the depot loading platform.');saveCheckpoint('The medicine run has begun.');say('Find Ash. F mounts the horse. Hold Shift to gallop.',6);}}])},{text:'Give me a moment.',action:closeTalk}]);}
 else if(state.stage<3){talk('Dr. Mara Bell','The chest is on the depot loading platform. Jonas keeps the main gate. There is an old creek path to the west. Please bring all of it.',[{text:'I am on my way.',action:closeTalk},{text:'Let me rest here.',action:()=>{state.health=100;state.stamina=100;state.focus=100;horse.stamina=100;saveCheckpoint('Rested at camp.');}}]);}
 else if(state.stage===3&&state.wanted>0){talk('Dr. Mara Bell','Riders are still searching for you. Lead them away from this camp. Come back when the trail is clear.',[{text:'I will lose them.',action:()=>say('Leave their sight. The search fades after 12 seconds.',6)}]);}
 else if(state.stage===3){talk('Dr. Mara Bell',state.stats.kills===0?'Every bottle. And no one had to die for it. You did more than make a delivery today. We can pay you twelve dollars.':'The medicine is here. I will see that it reaches every family. We can pay you twelve dollars for the ride.',[{text:'Keep the money for the camp.',action:()=>finish('mercy')},{text:'I need the money for the next ride.',action:()=>finish('paid')}]);}
}
function speakWorker(){
 if(state.flags.aided){talk('Eli Reed','Take my signed freight order to Jonas at the gate. The chest belongs to the relief camp. If he will not listen, the old creek fence is weak.',[{text:'Stay near the road.',action:closeTalk}]);return;}
 talk('Eli Reed','The wagon rolled. My leg is bleeding. I work at Cinder Spur. Have you got a bandage?',[
  {text:'Use a bandage and help him.',disabled:state.bandages<1,action:()=>{state.bandages--;state.flags.aided=true;trust(14,'Eli will remember your help');note("Eli's signed order can secure the medicine without a fight.");note('A weak fence on the west side leads to the loading platform.');talk('Eli Reed','Thank you. Take this freight order. It proves the medicine is paid for. Show it to Jonas. The creek fence is another way in, if you need it.',[{text:'Get back to the relief camp.',action:()=>saveCheckpoint('Signed freight order received.')}]);}},
  {text:'I will look for a bandage.',action:()=>{note('Yarrow near the trail can make a field dressing.');say('Look for pale flowers beside the trail. Press E to gather them.',5);}},
  {text:'I cannot stop.',action:()=>{say('Eli: I will wait here.',3);}}
 ]);
}
function speakClerk(){
 if(state.stage===0){talk('Jonas Pike','Relief goods need a request from the camp doctor.',[{text:'I will speak to her.',action:closeTalk}]);return;}
 if(state.flags.permit){talk('Jonas Pike','Your medicine is on the loading platform. The chest with the pale cross. Take it and keep the road clear.',[{text:'Thank you.',action:closeTalk}]);return;}
 if(enemies.some(e=>e.hp>0&&!e.surrendered&&e.alert>.8)){talk('Jonas Pike','You have drawn every guard in the yard. There will be no deal while the guns are out.',[{text:'Leave the gate.',action:closeTalk}]);return;}
 const opts=[];if(state.flags.aided)opts.push({text:"Show Eli's signed order.",action:()=>{state.flags.permit=true;state.stats.route='Signed order';trust(8,'The medicine is released');talk('Jonas Pike','Eli signed this? Then it was paid for. I will mark the chest as collected. Take it. I never liked this order.',[{text:'You made the right choice.',action:()=>{note('The gate clerk released the medicine.');saveCheckpoint('Safe passage granted.');}}]);}});
 opts.push({text:'Pay the $12 release fee.',disabled:state.cash<12,action:()=>{state.cash-=12;state.flags.permit=true;state.stats.route='Paid release';talk('Jonas Pike','The company calls it a release fee. I call it twelve dollars too much. The chest is yours. Do not touch the other freight.',[{text:'Open the way.',action:()=>saveCheckpoint('Safe passage granted.')}]);}});
 opts.push({text:'The families need that medicine.',action:()=>talk('Jonas Pike','I know. But the foreman wants a signed order or cash. If you brought proof that the camp owns it, I could help.',[{text:'I will find another way.',action:()=>{note('Jonas will accept a signed order or a $12 fee.');}}])});
 opts.push({text:'Leave.',action:closeTalk});
 talk('Jonas Pike','No freight leaves without a release. The medicine chest is twelve dollars. Or show me a signed order.',opts);
}
function speakBroker(){
 if(state.stage===3){talk('Caleb Voss','That chest is worth sixty dollars across the county line. Enough to leave this valley. The camp has nothing like that to offer.',[{text:'The medicine goes to the camp.',action:()=>{if(!state.flags.refusedVoss){trust(5,'You kept your promise');state.flags.refusedVoss=true;}note('Voss offered $60. The medicine is still bound for camp.');}},{text:'Sell the medicine for $60.',action:()=>{talk('Caleb Voss','The whole chest, and you leave without it. Are we agreed?', [{text:'Agreed. Take the chest.',action:()=>finish('sold')},{text:'No. I gave my word.',action:closeTalk}]);}}]);}
 else talk('Caleb Voss','Company freight has a way of finding a better price. If you bring me something worth buying, we can talk.',[{text:'I have a delivery to make.',action:closeTalk}]);
}
function speakWitness(){
 if(witness.state==='reported'){talk('Freight worker','The alarm has sounded. The riders are already on the way.',[{text:'Leave.',action:closeTalk}]);return;}
 if(witness.state==='silent'){talk('Freight worker','I saw nothing. Take the medicine and leave.',[{text:'Stay safe.',action:closeTalk}]);return;}
 talk('Freight worker',witness.state==='running'?'I saw what happened! I am ringing the alarm.':'I just load freight. I do not make the orders.',[
 {text:'The relief camp needs this medicine.',action:()=>{witness.state='silent';witness.timer=0;trust(7,'The worker will keep quiet');say('Worker: My sister is at that camp. Go. I saw nothing.',5);}},
 {text:'Stay away from that bell.',action:()=>{witness.state='silent';witness.timer=0;trust(-6,'The worker was threatened');}},
 {text:'Leave.',action:closeTalk}
 ]);
}
function finish(ending){
 state.stage=4;state.ending=ending;state.stats.retries=deathCount;
 if(ending==='sold'){state.cash+=60;state.flags.sold=true;state.flags.medicine=false;state.trust=Math.max(0,state.trust-40);}
 else if(ending==='mercy'){state.trust=Math.min(100,state.trust+18);state.flags.medicine=false;}
 else{state.cash+=12;state.trust=Math.min(100,state.trust+8);state.flags.medicine=false;}
 const title=ending==='sold'?'The price of leaving.':ending==='paid'?'A fair debt.':'A little more mercy.';
 const copy=ending==='sold'?'Voss takes the chest. You have enough money to leave Calder Territory. Back at the camp, the lamps stay lit. The families are still waiting.':ending==='paid'?'The medicine reaches every family at Calder’s Rest. The camp pays its debt. You have enough for the next road, and a place that will welcome you back.':'The medicine reaches every family at Calder’s Rest. Your fee will buy food for the camp. For one evening, this valley has enough.';
 $('ending-title').textContent=title;$('ending-copy').textContent=copy;
 $('ending-quote').textContent=ending==='sold'?'“A road can take you away. It cannot tell you what to leave behind.” — Ada Vale':ending==='mercy'?'“You brought the medicine. You left us something else to live on.” — Dr. Mara Bell':'“An honest debt deserves an honest payment. Come back when you can.” — Dr. Mara Bell';
 const nspared=enemies.filter(e=>!e.posse&&e.hp>0).length;const rows=[['MEDICINE',ending==='sold'?'Sold':'Delivered'],['GUARDS ALIVE',nspared+' / 6'],['CAMP TRUST',String(state.trust)],['YOUR ROUTE',state.stats.route==='Undecided'?'Open trail':state.stats.route]];
 $('end-stats').replaceChildren(...rows.map(([label,val])=>{const d=document.createElement('div'),b=document.createElement('b'),s=document.createElement('span');b.textContent=val;s.textContent=label;d.append(b,s);return d;}));
 E.store.set('dust-mercy:last-ride',{...serialise(),finishedAt:new Date().toISOString()});E.store.remove(SAVE);root.__lastCheckpoint=null;setMode('ending');sound.sfx('complete');
}
function openMap(){if(mode==='map'){setMode('play');return;}if(mode!=='play'&&mode!=='pause')return;setMode('map');updateJournal();}
function openSatchel(){if(mode==='satchel'){setMode('play');return;}if(mode!=='play')return;setMode('satchel');updateSatchel();}
function openGuide(){guideFrom=mode;setMode('guide');}
function closeGuide(){setMode(guideFrom==='title'?'title':guideFrom==='pause'?'pause':'play');}
function pause(){if(mode==='play'){setMode('pause');updateSettings();}else if(mode==='pause')setMode('play');else if(mode==='guide')closeGuide();else if(mode==='map'||mode==='satchel')setMode('play');else if(mode==='dialogue')closeTalk();}
function updateSettings(){document.querySelectorAll('.sound-button span').forEach(e=>e.textContent=prefs.sound?'Sound on':'Sound off');document.querySelectorAll('.sound-button').forEach(e=>e.setAttribute('aria-label',prefs.sound?'Mute sound':'Enable sound'));$('sound-setting').lastElementChild.textContent=prefs.sound?'On':'Off';$('assist-setting').lastElementChild.textContent=prefs.assist?'On':'Off';$('motion-setting').lastElementChild.textContent=prefs.motion?'On':'Off';}
function savePrefs(){E.store.set(PREF,prefs);updateSettings();}
function toggleSound(){prefs.sound=!prefs.sound;sound.start();sound.enable(prefs.sound);savePrefs();}
function useBandage(){if(state.bandages<1){toast('No bandages left. Look for yarrow or supplies.');return false;}if(state.health>=100){toast('Your health is full.');return false;}state.bandages--;state.health=Math.min(100,state.health+48);sound.sfx('heal');toast('Bandage used · Health restored');updateSatchel();return true;}
function useRation(){if(state.rations<1){toast('No rations left. Check the supply crates.');return false;}state.rations--;state.stamina=100;state.focus=Math.min(100,state.focus+45);state.health=Math.min(100,state.health+12);sound.sfx('heal');toast('A short meal · Stamina and focus restored');updateSatchel();return true;}
function updateSatchel(){
 const rows=[['✚','Field bandage',state.bandages+' remaining. Restores 48 health.',useBandage,state.bandages<1],['◈','Trail ration',state.rations+' remaining. Restores stamina and 45 focus.',useRation,state.rations<1],['▥','Revolver rounds',state.reserve+' spare rounds. Six rounds in a full cylinder.',()=>{setMode('play');startReload();},state.reserve<1||state.ammo===6]];
 $('inventory-items').replaceChildren(...rows.map(([icon,title,desc,fn,disabled])=>{const d=document.createElement('div');d.className='inventory-item';const a=document.createElement('span');a.className='inventory-symbol';a.textContent=icon;const t=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=desc;t.append(h,p);const b=document.createElement('button');b.textContent=title==='Revolver rounds'?'Reload':'Use';b.disabled=disabled;b.onclick=()=>{fn();updateHUD(true);};d.append(a,t,b);return d;}));
 $('cash-value').textContent='$'+state.cash;$('medicine-state').textContent=state.flags.medicine?'Medicine chest secured':state.flags.aided?'Signed freight order carried':'Medicine not yet recovered';
}
function goal(){return state.stage===0?P.doctor:state.stage===1?P.depot:state.stage===2?P.medicine:P.doctor;}
function updateJournal(){
 const o=OBJECTIVES[state.stage];$('journal-objective').textContent=o[0];$('journal-detail').textContent=o[1];
 const steps=['Ask the camp doctor about the medicine.','Ride to Cinder Spur.','Recover the medicine chest.','Return to the relief camp.'];
 $('mission-list').replaceChildren(...steps.map((s,i)=>{const li=document.createElement('li');li.textContent=s;li.className=state.stage>i?'done':state.stage===i?'active':'';return li;}));
 $('trust-value').textContent=state.trust>=80?'Part of the camp':state.trust>=60?'Trusted rider':state.trust>=35?'Known rider':'A broken promise';$('trust-fill').style.width=state.trust+'%';
 $('trail-notes').replaceChildren(...state.notes.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));
 world.drawMap($('worldmap').getContext('2d'),950,740,{player,horse,enemies,witness,flags:state.flags,goal:goal()},false);
}

function buildNav(){
 const S=24,nx=Math.ceil(L.W/S),ny=Math.ceil(L.H/S),blocked=new Uint8Array(nx*ny);
 const mark=b=>{for(let y=Math.max(0,Math.floor((b.y-8)/S));y<=Math.min(ny-1,Math.ceil((b.y+b.h+8)/S));y++)for(let x=Math.max(0,Math.floor((b.x-8)/S));x<=Math.min(nx-1,Math.ceil((b.x+b.w+8)/S));x++){const px=x*S+S/2,py=y*S+S/2;if(px>b.x-9&&px<b.x+b.w+9&&py>b.y-9&&py<b.y+b.h+9)blocked[y*nx+x]=1;}};
 for(const b of world.solids)mark(b);if(!world.rearOpen)mark({x:1645,y:425,w:10,h:91});
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(x<2||x>=nx-2||y<3||y>=ny-2)blocked[y*nx+x]=1;
 navGrid={S,nx,ny,blocked};navVersion=world.rearOpen;
}
function findPath(ax,ay,bx,by){
 if(!navGrid||navVersion!==world.rearOpen)buildNav();const {S,nx,ny,blocked}=navGrid;
 const cell=(x,y)=>E.clamp(Math.floor(y/S),0,ny-1)*nx+E.clamp(Math.floor(x/S),0,nx-1);
 const near=id=>{if(!blocked[id])return id;const cx=id%nx,cy=Math.floor(id/nx);for(let d=1;d<6;d++)for(let dy=-d;dy<=d;dy++)for(let dx=-d;dx<=d;dx++){const x=cx+dx,y=cy+dy,n=y*nx+x;if(x>0&&x<nx-1&&y>0&&y<ny-1&&!blocked[n])return n;}return id;};
 const from=near(cell(ax,ay)),to=near(cell(bx,by));if(from===to)return[{x:bx,y:by}];
 const g=new Float32Array(nx*ny).fill(Infinity),came=new Int32Array(nx*ny).fill(-1),closed=new Uint8Array(nx*ny),open=[from],tx=to%nx,ty=Math.floor(to/nx);g[from]=0;
 let found=false,iterations=0;while(open.length&&iterations++<5500){let best=0,bf=Infinity;for(let i=0;i<open.length;i++){const k=open[i],h=Math.hypot(k%nx-tx,Math.floor(k/nx)-ty),f=g[k]+h;if(f<bf){bf=f;best=i;}}const at=open.splice(best,1)[0];if(at===to){found=true;break;}closed[at]=1;const x=at%nx,y=Math.floor(at/nx);
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const xx=x+dx,yy=y+dy,n=yy*nx+xx;if(xx<0||xx>=nx||yy<0||yy>=ny||blocked[n]||closed[n])continue;if(dx&&dy&&(blocked[y*nx+xx]||blocked[yy*nx+x]))continue;const ng=g[at]+(dx&&dy?1.415:1);if(ng<g[n]){g[n]=ng;came[n]=at;if(!open.includes(n))open.push(n);}}
 }
 if(!found)return[{x:bx,y:by}];const points=[];for(let at=to;at!==from&&at>=0;at=came[at])points.push({x:(at%nx+.5)*S,y:(Math.floor(at/nx)+.5)*S});points.reverse();points.push({x:bx,y:by});return points;
}
function moveAI(entity,target,speed,dt){
 entity.pathTimer=(entity.pathTimer||0)-dt;
 if(!entity.route||!entity.route.length||entity.pathTimer<=0&&(!entity.pathGoal||dist(entity.pathGoal,target)>35)){
  entity.route=findPath(entity.x,entity.y,target.x,target.y);entity.pathGoal={x:target.x,y:target.y};entity.pathTimer=1.3;
 }
 while(entity.route.length>1&&dist(entity,entity.route[0])<11)entity.route.shift();
 let to=entity.route[0]||target;if(world.ray(entity.x,entity.y,target.x,target.y,0)===null)to=target;
 const d=dist(entity,to);if(d<3){entity.vx=entity.vy=0;return;}
 const a=Math.atan2(to.y-entity.y,to.x-entity.x);entity.facing=E.lerpAng(entity.facing||0,a,Math.min(1,dt*8));entity.vx=Math.cos(a)*Math.min(speed,d/dt);entity.vy=Math.sin(a)*Math.min(speed,d/dt);entity.update(dt,world);
 if(entity.hitWall){entity.pathTimer=0;entity.pathGoal=null;}
}
function mountHorse(){
 if(horse.mounted){horse.mounted=false;horse.x=player.x;horse.y=player.y;horse.speed=0;horse.vx=horse.vy=0;let found=false;for(const a of[horse.facing+Math.PI/2,horse.facing-Math.PI/2,horse.facing+Math.PI,horse.facing]){const q={x:horse.x+Math.cos(a)*24,y:horse.y+Math.sin(a)*24,r:6.5};const ox=q.x,oy=q.y;world.collide(q);if(Math.hypot(q.x-ox,q.y-oy)<2){player.x=q.x;player.y=q.y;found=true;break;}}if(!found){player.x=horse.x+25;player.y=horse.y;world.collide(player);}player.r=6.5;toast('On foot · F to mount Ash',2.5);}
 else if(dist(player,horse)<52){horse.mounted=true;horse.called=false;player.x=horse.x;player.y=horse.y;player.crouched=false;player.r=11;toast('Ash · Hold Shift to gallop',3);if(state.stage===1)say('Follow the pale trail northeast. Press M to see the valley.',6);}
 else{callHorse();return;}
 action=null;game._follow.z=horse.mounted?25:16;sound.sfx('ui');
}
function callHorse(){if(horse.mounted)return;horse.called=true;horse.route=[];horse.pathTimer=0;sound.sfx('whistle');toast('You called Ash. Stay on open ground.',3);}
function feedHorse(){
 if(horse.mounted)return;if(horse.stamina>98&&horse.bond>=2){toast('Ash is calm and ready.');return;}
 startAction('Care for Ash',1.3,horse,()=>{horse.stamina=100;horse.bond=Math.min(3,horse.bond+1);state.flags.horseFed=true;state.stats.horseCare++;sound.sfx('heal');toast('Ash trusts you · Gallop costs less stamina');say('Ada: Easy, Ash. We have one more ride.',3);});
}
function startAction(label,duration,target,done){action={label,duration,t:0,target:{x:target.x,y:target.y},done};}
function startReload(){if(reload>0)return;if(state.ammo>=6){toast('The cylinder is full.',1.5);return;}if(state.reserve<=0){toast('No spare rounds. Search a supply crate.');return;}reload=1.35;sound.sfx('reload');}
function toggleFocus(){if(focusOn){focusOn=false;game.timeScale=1;return;}if(state.focus<10){toast('Focus is low. Use a ration or wait.');return;}focusOn=true;state.flags.focusUsed=true;game.timeScale=.3;sound.sfx('focus');if(!state.flags.focusHint){state.flags.focusHint=true;say('Stillwater focus · Aim and press X to disarm a guard.',5);}}
function segmentCircle(ax,ay,bx,by,cx,cy,r){const dx=bx-ax,dy=by-ay,fx=ax-cx,fy=ay-cy,A=dx*dx+dy*dy;if(A<.0001)return null;const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r,disc=B*B-4*A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null;}
function aimPoint(){
 const input=game.input,mouse=input.mouseScreen();let point=null,target=null;
 if(input.aimSource==='mouse'&&mouse){point=game.view.toGround(mouse[0],mouse[1]-game.view.bz*17);if(point)point={x:point[0],y:point[1]};}
 if(input.padAim){const d=game.view.screenDirToGround(input.padAim[0],input.padAim[1]);point={x:player.x+d[0]*360,y:player.y+d[1]*360};}
 const candidates=enemies.filter(e=>e.hp>0&&!e.surrendered&&dist(e,player)<370&&world.ray(player.x,player.y,e.x,e.y,20)===null);
 if(prefs.assist||!point){let best=point?38:300;for(const e of candidates){let d;if(point&&input.aimSource==='mouse'&&mouse){const p=game.view.p(e.x,e.y,17);d=Math.hypot(mouse[0]-p[0],mouse[1]-p[1]);}else if(point){const a=Math.atan2(point.y-player.y,point.x-player.x);d=Math.abs(E.angDiff(a,Math.atan2(e.y-player.y,e.x-player.x)))*100;}else d=dist(e,player);if(d<best){best=d;target=e;}}}
 if(target)return{x:target.x,y:target.y,target};if(point)return point;return{x:player.x+Math.cos(player.facing)*360,y:player.y+Math.sin(player.facing)*360};
}
function playerFire(nonlethal=false){
 if(fireCD>0||reload>0||action)return;if(nonlethal&&!focusOn){toast('Use Q to enter focus before a disarm shot.',2.5);return;}
 if(state.ammo<=0){startReload();sound.sfx('denied');return;}state.ammo--;state.stats.shots++;fireCD=.34;shotFlash=.16;state.flags.firstShot=true;
 const aim=aimPoint(),a=Math.atan2(aim.y-player.y,aim.x-player.x),range=390,ax=player.x+Math.cos(a)*8,ay=player.y+Math.sin(a)*8,bx=ax+Math.cos(a)*range,by=ay+Math.sin(a)*range;
 player.facing=a;let best=world.ray(ax,ay,bx,by,20)??1,target=null;
 for(const e of enemies){if(e.hp<=0||e.surrendered)continue;const t=segmentCircle(ax,ay,bx,by,e.x,e.y,9);if(t!==null&&t<best){best=t;target=e;}}
 const hx=E.lerp(ax,bx,best),hy=E.lerp(ay,by,best);traces.push({ax,ay,bx:hx,by:hy,z:horse.mounted?31:17,t:.15,max:.15,enemy:false});
 sound.sfx('shot');game.shake(1.2);game.particles.sparks(ax,ay,horse.mounted?30:18,5,a,{color:'#efd091'});
 if(target){
  state.stats.hits++;target.alert=1;target.seen=5;target.hurt=.28;
  if(nonlethal){target.surrendered=true;target.wind=0;target.vx=target.vy=0;state.stats.spared++;trust(4,'Guard disarmed');game.particles.text(target.x,target.y,31,'DISARMED','#e8d8a4');}
  else{target.hp-=42;game.particles.impact(target.x,target.y,18,7,'#d8ac78');if(target.hp<=0){target.hp=0;target.wind=0;state.stats.kills++;if(!target.posse)trust(-3);state.stats.route=state.stats.route==='Undecided'?'Gunfight':state.stats.route;}}
 }
 else if(best<1)game.particles.sparks(hx,hy,15,5,a+Math.PI,{color:'#d8bc85'});
 alertGuards(player.x,player.y);triggerWitness('shot');
}
function alertGuards(x,y){for(const e of enemies)if(e.hp>0&&!e.surrendered&&Math.hypot(e.x-x,e.y-y)<420){e.alert=1;e.seen=6;e.lastX=player.x;e.lastY=player.y;}}
function triggerWitness(reason){
 if(witness.state!=='idle'||state.flags.permit&&reason!=='shot')return;
 const heard=reason==='shot'&&dist(witness,player)<400,seen=dist(witness,player)<220&&world.ray(witness.x,witness.y,player.x,player.y,22)===null;
 if(heard||seen){witness.state='running';witness.timer=0;witness.route=[];witness.pathTimer=0;say('Worker: I am ringing the alarm!',4);toast('Witness · Speak to the worker to stop the report.',5);}
}
function makeRider(id,x,y){return Object.assign(new E.Body({x,y,r:10}),{id,name:'Company rider',posse:true,hp:64,alert:1,surrendered:false,facing:-2,deadT:0,shootCD:2,wind:0,route:[],pathTimer:0,seen:9,patrol:[[player.x,player.y]],patrolIndex:0,wait:0,rig:createRig('guard','#635f4d')});}
function reportCrime(){
 if(state.flags.reported)return;state.flags.reported=true;witness.state='reported';state.wanted=100;state.lastSeen=0;sound.sfx('bell');toast('Alarm sounded · Company riders are on the trail.',6);note('A witness rang the depot alarm.');
 for(let i=0;i<2;i++)enemies.push(makeRider('rider-'+i,2180+i*45,1080+i*70));
}
function hurtPlayer(amount){if(hurtCD>0||mode!=='play')return;hurtCD=.35;state.health=Math.max(0,state.health-amount);state.stats.damage+=amount;sound.sfx('damage');game.shake(2.1);$('damage-effect').style.opacity='.9';if(state.health<=0){state.stats.retries=deathCount;setMode('dead');sound.sfx('failure');}}
function enemyFire(e){
 const tx=e.shotX,ty=e.shotY,a=Math.atan2(ty-e.y,tx-e.x),ax=e.x+Math.cos(a)*8,ay=e.y+Math.sin(a)*8,bx=e.x+Math.cos(a)*350,by=e.y+Math.sin(a)*350;
 let hit=world.ray(ax,ay,bx,by,player.crouched?8:20)??1;
 const target=segmentCircle(ax,ay,bx,by,player.x,player.y,player.crouched?7:9);if(target!==null&&target<hit){hit=target;hurtPlayer(prefs.assist?12:16);}
 traces.push({ax,ay,bx:E.lerp(ax,bx,hit),by:E.lerp(ay,by,hit),z:18,t:.17,max:.17,enemy:true});sound.sfx('shot',{volume:.4});e.shootCD=1.7+random()*.7;
}
function updateEnemies(dt,rdt){
 const restricted=player.x>1640&&player.x<2150&&player.y>315&&player.y<785;
 let danger=false,sighted=false;
 for(const e of enemies){
  e.hurt=Math.max(0,(e.hurt||0)-dt);e.shootCD-=dt;
  if(e.hp<=0){e.deadT+=dt;e.vx=e.vy=0;continue;}if(e.surrendered){e.vx=e.vy=0;continue;}
  const d=dist(e,player),a=Math.atan2(player.y-e.y,player.x-e.x),los=d<310&&world.ray(e.x,e.y,player.x,player.y,player.crouched?12:24)===null;
  const stealth=player.crouched?(world.isGrass(player.x,player.y)?.22:.52):1,range=(e.posse?255:180)*stealth;
  const facing=Math.abs(E.angDiff(e.facing,a))<1.13;
  const canSee=los&&d<range&&(facing||d<39||e.alert>=.95)&&(!state.flags.permit||e.alert>=.95)&&(restricted||e.alert>.6||e.posse);
  if(canSee){e.alert=Math.min(1,e.alert+dt*(player.crouched?.55:1.0));e.seen=5;e.lastX=player.x;e.lastY=player.y;}
  else{e.seen=Math.max(0,(e.seen||0)-dt);if(e.seen<=0)e.alert=Math.max(0,e.alert-dt*.14);}
  if(e.alert>.7){danger=true;if(los&&d<250){sighted=true;state.lastSeen=0;}}
  if(e.alert>=.98){
   e.facing=E.lerpAng(e.facing,a,Math.min(1,dt*9));
   if(e.wind>0){e.wind-=dt;e.vx=e.vy=0;if(e.wind<=0)enemyFire(e);}
   else if(los&&d<260&&d>40&&e.shootCD<=0){e.wind=.58;e.shotX=player.x+(random()-.5)*(horse.mounted?12:8);e.shotY=player.y+(random()-.5)*8;e.vx=e.vy=0;}
   else if(d>105||!los){moveAI(e,{x:e.lastX??player.x,y:e.lastY??player.y},e.posse?105:40,dt);}
   else{e.vx=e.vy=0;}
  }else if(e.alert>.22&&canSee){e.facing=E.lerpAng(e.facing,a,Math.min(1,dt*4));e.vx=e.vy=0;}
  else if(e.posse&&state.wanted>0){moveAI(e,{x:player.x,y:player.y},100,dt);e.alert=Math.max(.8,e.alert);e.lastX=player.x;e.lastY=player.y;}
  else if(!e.posse){const target={x:e.patrol[e.patrolIndex][0],y:e.patrol[e.patrolIndex][1]};if(dist(e,target)<11){e.vx=e.vy=0;e.wait-=dt;if(e.wait<=0){e.patrolIndex=(e.patrolIndex+1)%e.patrol.length;e.wait=1.8+random()*1.4;}}else moveAI(e,target,19,dt);}
  else{e.vx=e.vy=0;e.alert=0;}
 }
 if(!sighted)state.lastSeen+=rdt;
 if(state.wanted>0){if(state.lastSeen>2&&(dist(player,P.depot)>330||player.crouched&&world.isGrass(player.x,player.y)))state.wanted=Math.max(0,state.wanted-rdt*8.4);else if(sighted)state.wanted=Math.min(100,state.wanted+rdt*15);if(state.wanted===0){state.flags.escaped=true;toast('The trail is clear. Return to the relief camp.',5);note('You escaped the company search.');for(const e of enemies)if(e.posse){e.alert=0;e.seen=0;}if(state.stage===3)saveCheckpoint();}}
 if(witness.state==='running'){witness.timer+=dt;moveAI(witness,P.bell,34,dt);if(dist(witness,P.bell)<19||witness.timer>26)reportCrime();}
 return danger;
}
function nearestInteraction(){
 const options=[],add=(id,name,label,obj,radius,priority,fn)=>{const d=dist(player,obj);if(d<radius)options.push({id,name,label,x:obj.x,y:obj.y,d,priority,fn});};
 for(const npc of npcs){if(npc.id==='doctor')add(npc.id,npc.name,state.stage===3?'Deliver the medicine':'Speak',npc,48,1,speakDoctor);else if(npc.id==='worker')add(npc.id,npc.name,state.flags.aided?'Speak':'Help the injured worker',npc,48,1,speakWorker);else if(npc.id==='clerk')add(npc.id,npc.name,'Speak at the gate',npc,48,1,speakClerk);else if(npc.id==='broker')add(npc.id,npc.name,'Speak',npc,46,2,speakBroker);else add(npc.id,npc.name,'Speak',npc,38,4,()=>talk('Nell',state.stage===3?'You brought it back. Mara will be glad.':'We will keep a lamp lit for you.',[{text:'Thank you, Nell.',action:closeTalk}]));}
 if(!horse.mounted)add('horse','ASH','Care for Ash · F to ride',horse,38,5,feedHorse);
 if(state.stage>=1&&state.stage<3)add('medicine','RELIEF MEDICINE','Secure the medicine chest',P.medicine,39,0,()=>{if(horse.mounted){toast('Dismount with F to collect the chest.');return;}startAction('Securing the medicine',2.2,P.medicine,()=>{state.flags.medicine=true;state.stage=3;state.stats.route=state.stats.route==='Undecided'?(state.flags.rear?'Creek path':'Open yard'):state.stats.route;trust(7);note('The medicine chest is secured. Mara is waiting at camp.');if(!state.flags.permit)triggerWitness('theft');sound.sfx('pickup');saveCheckpoint('Medicine secured · Return to Calder’s Rest.');say('Ada: Hold on, Mara. We are coming home.',5);});});
 if(!world.rearOpen&&state.stage>0)add('rear','OLD CREEK FENCE','Cut a gap in the fence',P.rear,49,1,()=>{if(horse.mounted){toast('Dismount with F to open the fence.');return;}startAction('Opening the creek fence',1.5,P.rear,()=>{world.rearOpen=true;state.flags.rear=true;navGrid=null;note('The creek fence is open. Tall grass leads toward the chest.');toast('Creek path opened · C to crouch');if(state.stats.route==='Undecided')state.stats.route='Creek path';});});
 if(witness.state!=='reported')add('witness',witness.name,witness.state==='running'?'Stop and speak to the witness':'Speak',witness,witness.state==='running'?70:38,witness.state==='running'?-2:3,speakWitness);
 for(const c of CACHES)if(!state.looted.includes(c.id))add(c.id,c.label,'Search supplies',c,35,3,()=>startAction('Searching supplies',.8,c,()=>{state.looted.push(c.id);state.reserve+=18;state.bandages++;state.rations++;sound.sfx('pickup');toast('+18 rounds · +1 bandage · +1 ration');}));
 for(const h of HERBS)if(!state.herbs.includes(h.id))add(h.id,'WILD YARROW','Gather a field dressing',h,32,3,()=>{state.herbs.push(h.id);state.bandages++;sound.sfx('pickup');toast('Yarrow gathered · +1 field bandage');});
 for(const en of enemies)if(en.hp<=0&&!state.looted.includes(en.id))add('loot-'+en.id,en.name,'Collect spare rounds',en,28,6,()=>{state.looted.push(en.id);state.reserve+=6;sound.sfx('pickup');toast('+6 revolver rounds');});
 options.sort((a,b)=>a.priority-b.priority||a.d-b.d);return options[0]||null;
}
function act(name){if(game.input.buffered(name,.13)){game.input.consume(name);return true;}return false;}
function update(dt){
 const rdt=dt/Math.max(.1,game.timeScale);clock+=rdt;uiClock+=rdt;mapClock+=rdt;
 if(act('pause'))pause();
 if(mode!=='title'&&act('journal'))openMap();if(act('satchel'))openSatchel();
 if(toastTimer>0&&(toastTimer-=rdt)<=0)$('toast').classList.add('hidden');if(subtitleTimer>0&&(subtitleTimer-=rdt)<=0)$('subtitle').classList.add('hidden');if(regionTimer>0&&(regionTimer-=rdt)<=0)$('region').classList.add('hidden');if(checkpointTimer>0&&(checkpointTimer-=rdt)<=0)$('checkpoint-flash').classList.add('hidden');
 sound.update(rdt,{moving:mode==='play'&&Math.hypot(player.vx,player.vy)>3,mounted:horse.mounted,speed:Math.hypot(player.vx,player.vy),combat:enemies.some(e=>e.alert>.8&&e.hp>0),focus:focusOn,water:world.isWater(player.x,player.y),region:lastRegion,mode});
 if(mode!=='play'){
  if(game.input.lastDevice==='gamepad'){menuRepeat-=rdt;const host=document.querySelector(mode==='dialogue'?'#choices':mode==='pause'?'#pause-screen':mode==='title'?'#title-screen':mode==='guide'?'#guide-screen':mode==='ending'?'#ending-screen':mode==='dead'?'#death-screen':mode==='map'?'#journal-screen':'#satchel-screen');const buttons=host?[...host.querySelectorAll('button:not([disabled])')].filter(b=>b.offsetParent!==null):[];if(buttons.length){const mv=game.input.move();if(Math.abs(mv[1])>.5&&menuRepeat<=0){let i=buttons.indexOf(document.activeElement);i=(i+(mv[1]>0?1:-1)+buttons.length)%buttons.length;buttons[i].focus();menuRepeat=.23;}if(act('interact')){const active=buttons.includes(document.activeElement)?document.activeElement:buttons[0];active.click();}}}
  if(mode==='title'||mode==='ending')updateRigs(dt*.3);return;}
 state.elapsed+=rdt;fireCD=Math.max(0,fireCD-rdt);hurtCD=Math.max(0,hurtCD-rdt);shotFlash=Math.max(0,shotFlash-rdt);$('damage-effect').style.opacity=String(hurtCD*2);
 if(reload>0){reload-=rdt;if(reload<=0){const n=Math.min(6-state.ammo,state.reserve);state.ammo+=n;state.reserve-=n;sound.sfx('ui');}}
 if(act('focus'))toggleFocus();if(act('mount'))mountHorse();if(act('whistle'))callHorse();if(act('crouch')){if(horse.mounted)mountHorse();else player.crouched=!player.crouched;}
 if(act('reload'))startReload();if(act('heal'))useBandage();if(act('disarm'))playerFire(true);
 if(focusOn){state.focus=Math.max(0,state.focus-rdt*16);if(state.focus<=0){focusOn=false;game.timeScale=1;sound.sfx('ui');}}else state.focus=Math.min(100,state.focus+rdt*(enemies.some(e=>e.alert>.8)?.9:3.5));
 document.body.classList.toggle('focus-active',focusOn);
 let [dx,dy]=game.view.screenDirToGround(...game.input.move());const moving=Math.hypot(dx,dy)>.02,running=game.input.down('run')||(game.input.lastDevice==='touch'&&game.input.stickOn&&Math.hypot(...game.input.stick)>.82);
 if(action&&moving){action=null;toast('Action stopped.',1.5);}
 let speed=horse.mounted?(running&&horse.stamina>4?156:97):(player.crouched?31:running&&state.stamina>4?87:58);
 if(state.flags.medicine&&!horse.mounted)speed*=.85;
 if(world.isWater(player.x,player.y))speed*=horse.mounted?.78:.64;
 if(action){dx=dy=0;speed=0;}
 player.vx=dx*speed;player.vy=dy*speed;
 if(moving&&!action){player.facing=E.lerpAng(player.facing,Math.atan2(dy,dx),Math.min(1,rdt*13));player.update(dt,world);}
 if(horse.mounted){horse.x=player.x;horse.y=player.y;horse.facing=player.facing;horse.speed=moving?speed:0;horse.stamina=E.clamp(horse.stamina+(moving&&running&&speed>100?-(8.6-horse.bond*1.2):7)*rdt,0,100);state.stamina=Math.min(100,state.stamina+rdt*8);}
 else{state.stamina=E.clamp(state.stamina+(moving&&running?-17:16)*rdt,0,100);horse.stamina=Math.min(100,horse.stamina+rdt*7);if(horse.called){if(dist(horse,player)<42){horse.called=false;horse.speed=0;horse.vx=horse.vy=0;}else{moveAI(horse,player,128,dt);horse.speed=Math.hypot(horse.vx,horse.vy);}}else horse.speed=0;}
 const firePressed=act('fire');if((firePressed||game.input.down('fire'))&&mode==='play')playerFire(focusOn&&game.input.lastDevice==='touch');
 if(shotFlash>0||focusOn){const a=aimPoint();player.facing=Math.atan2(a.y-player.y,a.x-player.x);if(horse.mounted)horse.facing=player.facing;}
 const danger=updateEnemies(dt,rdt);if(mode!=='play')return;
 if(!danger&&state.health<55)state.health=Math.min(55,state.health+rdt*1.4);
 if(state.stage===1&&dist(player,P.depot)<365){state.stage=2;state.flags.reachedDepot=true;saveCheckpoint('Cinder Spur reached.');say('Ada: The main gate, the creek, or the ridge. Your choice.',5);}
 if(state.stage===2&&player.x>1658&&player.x<2132&&player.y>350&&player.y<762&&!state.flags.permit&&!player.crouched&&!state.flags.warning){state.flags.warning=true;say('Guard: Company yard. Turn back or show your papers.',5);}
 if(state.stage===3&&!state.flags.returnNotice&&dist(player,P.depot)>450){state.flags.returnNotice=true;say(state.wanted>0?'Ada: Keep moving, Ash. We need a clear trail.':'Ada: A good road, and one promise left to keep.',5);}
 if(state.stage===3&&!state.flags.permit&&witness.state==='idle')triggerWitness('theft');
 interactTarget=nearestInteraction();if(act('interact')&&interactTarget&&!action)interactTarget.fn();
 if(action){action.t+=rdt;if(dist(player,action.target)>65)action=null;else if(action.t>=action.duration){const done=action.done;action=null;done();}}
 for(const tr of traces)tr.t-=rdt;traces=traces.filter(tr=>tr.t>0);
 for(const p of visualParticles){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}visualParticles=visualParticles.filter(p=>p.t>0);
 dustTimer-=dt;if(moving&&dustTimer<=0){dustTimer=horse.mounted?.12:.23;const x=player.x+random()*5-2.5,y=player.y+random()*5-2.5;visualParticles.push({x,y,z:1,vx:-10+random()*5,vy:8,vz:6,t:.7,life:.7,s:horse.mounted?6:3});groundMarks.push({x,y,t:clock,horse:horse.mounted,a:player.facing});if(groundMarks.length>150)groundMarks.shift();}
 ambientTimer-=rdt;if(ambientTimer<=0){ambientTimer=12+random()*14;if(state.stage===1&&dist(player,P.worker)<260&&!state.flags.aided)say('A voice near the broken wagon: Please! Over here!',5);}
 const inCover=player.crouched&&world.cover(player.x,player.y);document.body.classList.toggle('in-cover',inCover);if(inCover)state.flags.coverUsed=true;
 for(const region of world.regions)if(dist(player,region)<region.r&&lastRegion!==region.name){showRegion(region.name,region.sub);break;}
 updateRigs(dt);
 if(uiClock>.08){uiClock=0;updateHUD();}
}
function updateRigs(dt){
 heroRig.o.weapon=shotFlash>0||focusOn||enemies.some(e=>e.alert>.95&&e.hp>0&&dist(e,player)<200)?'gun':null;
 heroRig.update(dt,{x:player.x,y:player.y,z:horse.mounted?15:0,vx:horse.mounted?0:player.vx,vy:horse.mounted?0:player.vy,facing:player.facing,point:heroRig.o.weapon!==null,hurt:hurtCD>0,pose:horse.mounted||player.crouched?'crouch':action?.label==='Care for Ash'?'wave':undefined});
 for(const n of npcs)n.rig.update(dt,{x:n.x,y:n.y,z:0,facing:dist(n,player)<70?Math.atan2(player.y-n.y,player.x-n.x):n.facing,pose:n.id==='worker'&&!state.flags.aided?'kneel':n.id==='doctor'?'hips':undefined});
 for(const e of enemies){e.rig.o.weapon=e.surrendered?null:'gun';e.rig.update(dt,{x:e.x,y:e.y,z:e.posse&&e.hp>0?15:0,vx:e.posse?0:e.vx,vy:e.posse?0:e.vy,facing:e.facing,point:e.alert>.8&&e.hp>0&&!e.surrendered,pose:e.hp<=0?'die':e.surrendered?'guard':e.posse?'crouch':undefined,hurt:e.hurt>0});}
 witness.rig.update(dt,{x:witness.x,y:witness.y,z:0,vx:witness.vx,vy:witness.vy,facing:witness.facing,pose:witness.state==='silent'?'guard':undefined});
}
function updateHUD(force=false){
 const o=OBJECTIVES[state.stage];$('objective').textContent=state.wanted>0&&state.stage===3?'Lose the company riders':o[0];$('objective-detail').textContent=state.wanted>0&&state.stage===3?'Leave their sight. Keep the search away from camp.':o[1];
 for(const [name,val]of[['health',state.health],['stamina',horse.mounted?horse.stamina:state.stamina],['focus',state.focus]]){$(name+'-core').style.setProperty('--value',Math.round(val)+'%');$(name+'-value').textContent=Math.ceil(val);}
 $('health-core').style.setProperty('--core-color',state.health<30?'#e79e79':'#f2e5c8');$('stamina-label').textContent=horse.mounted?'ASH':'STAMINA';$('ammo').textContent=reload>0?'…':state.ammo;$('reserve').textContent=state.reserve;$('bandage-count').textContent=state.bandages;
 const rounds=$('rounds');if(rounds.children.length!==6){rounds.replaceChildren(...Array.from({length:6},()=>document.createElement('i')));}for(let i=0;i<6;i++)rounds.children[i].className=i<state.ammo?'':'empty';
 $('weapon-name').textContent=reload>0?'RELOADING':focusOn?'STILLWATER FOCUS':"VALE'S REVOLVER";
 if(action){$('interaction').classList.remove('hidden');$('interaction-name').textContent=action.label.toUpperCase();$('interaction-action').textContent=Math.floor(action.t/action.duration*100)+'% · Keep still';}
 else if(interactTarget&&mode==='play'){$('interaction').classList.remove('hidden');$('interaction-name').textContent=interactTarget.name.toUpperCase();$('interaction-action').textContent=interactTarget.label;}
 else $('interaction').classList.add('hidden');
 $('context-hint').textContent=focusOn?'X Disarm · Left click Fire · Q Leave focus':player.crouched?(world.isGrass(player.x,player.y)?'Hidden in tall grass · C to stand':world.cover(player.x,player.y)?'In cover · Q Focus · C to stand':'Crouched · Use grass and cover'):horse.mounted?'Shift Gallop · F Dismount · E Interact':state.stage===0?'W A S D Move · E Speak':'Shift Run · C Crouch · H Call Ash';
 const suspicious=Math.max(0,...enemies.filter(e=>e.hp>0&&!e.surrendered).map(e=>e.alert));
 if(state.wanted>0){$('threat').classList.remove('hidden');$('threat-label').textContent=state.lastSeen>2?'SEARCHING':'WANTED';$('threat-fill').style.width=state.wanted+'%';$('threat-note').textContent=state.lastSeen>2?'Stay out of sight. The search is fading.':'Company riders have your trail.';}
 else if(witness.state==='running'){$('threat').classList.remove('hidden');$('threat-label').textContent='WITNESS';$('threat-fill').style.width=Math.min(100,witness.timer/26*100)+'%';$('threat-note').textContent='Speak to the worker before the alarm.';}
 else if(suspicious>.12){$('threat').classList.remove('hidden');$('threat-label').textContent=suspicious>.95?'UNDER FIRE':'SUSPICIOUS';$('threat-fill').style.width=suspicious*100+'%';$('threat-note').textContent=suspicious>.95?'Use cover. You can still leave the yard.':'Crouch and break the line of sight.';}
 else $('threat').classList.add('hidden');
 if(mapClock>.16||force){mapClock=0;world.drawMap($('minimap').getContext('2d'),280,280,{player,horse,enemies,witness,flags:state.flags,goal:goal()},true);}
}
function drawMarker(r,x,y,z,color='#e5c174',size=4){const p=r.w(x,y,z);r.overlay(g=>{px.poly(g,[[p[0],p[1]-size],[p[0]+size,p[1]],[p[0],p[1]+size],[p[0]-size,p[1]]],color);px.dot(g,p[0],p[1],'#fff0b7');});}
function draw(r){
 world.draw(r,game.time);
 for(const m of groundMarks){if(!world.visible(r,m.x,m.y,10))continue;const p=r.w(m.x,m.y);r.decal(g=>px.blend(g,.28*(1-(clock-m.t)/120),'normal',()=>px.ell(g,p[0],p[1],m.horse?2:1,1,'#735d42')));}
 for(const c of CACHES)if(!state.looted.includes(c.id)){FrontierArt.drawProp(r,{type:'crate',x:c.x,y:c.y,size:.85,color:'#88764f',seed:142},game.time);if(world.visible(r,c.x,c.y)&&dist(player,c)<95)drawMarker(r,c.x,c.y,21,'#e1d7b2',3);}
 for(const h of HERBS)if(!state.herbs.includes(h.id)&&world.visible(r,h.x,h.y)){const p=r.w(h.x,h.y);r.queue(h.x,h.y,0,g=>{for(let i=0;i<6;i++){const x=p[0]+i*2-5,y=p[1]-4-Math.sin(i)*4;px.line(g,x,p[1],x,y,'#64825b');px.disc(g,x,y,1,'#e6ddad');}});if(dist(player,h)<80)drawMarker(r,h.x,h.y,14,'#f3e6bd',3);}
 if(state.stage<3){FrontierArt.drawProp(r,{type:'crate',x:P.medicine.x,y:P.medicine.y,size:1.55,color:'#b49362',seed:98},game.time);r.queue(P.medicine.x,P.medicine.y+.1,13,g=>{const p=r.w(P.medicine.x,P.medicine.y,16);px.rect(g,p[0]-5,p[1]-2,10,4,'#e5d6ac');px.rect(g,p[0]-2,p[1]-5,4,10,'#e5d6ac');});if(state.stage>=1)drawMarker(r,P.medicine.x,P.medicine.y,40);}
 if(world.visible(r,horse.x,horse.y,130))FrontierArt.drawHorse(r,horse,game.time);
 const drawActor=(actor,rig,opts={})=>{if(!world.visible(r,actor.x,actor.y,90))return;r.shadow(actor.x,actor.y,opts.horse?11:7,.28,'#37402d');r.actor(actor.x,actor.y,opts.z||0,(g,ox,oy)=>rig.draw(g,ox,oy,r.view),{outline:false,rim:false,xray:opts.hero||false,...opts});};
 for(const n of npcs){drawActor(n,n.rig);if(state.stage===0&&n.id==='doctor'||n.id==='worker'&&!state.flags.aided&&dist(n,player)<180)drawMarker(r,n.x,n.y,41,n.id==='doctor'?'#eac679':'#e3ddb7');}
 for(const e of enemies){
  if(!world.visible(r,e.x,e.y,130))continue;
  if(e.posse&&e.hp>0)FrontierArt.drawHorse(r,{x:e.x,y:e.y,facing:e.facing,speed:Math.hypot(e.vx,e.vy),mounted:true,color:'#6e5945'},game.time);
  if(e.hp>0&&!e.surrendered&&player.crouched&&e.alert<.96&&dist(player,e)<270){const range=170;r.decal(g=>r.groundArc(e.x,e.y,12,range,e.facing-1.06,e.facing+1.06,'#d9c183',.09,0,g));}
  drawActor(e,e.rig,{z:e.posse&&e.hp>0?15:0});
  if(e.hp>0&&e.alert>.08&&!e.surrendered){const p=r.w(e.x,e.y,e.posse?59:38);r.overlay(g=>{E.font.text(g,e.alert>.95?'!':'?',p[0],p[1]-7,e.alert>.95?'#eaba87':'#ecd593',{align:'center',outline:'#473827'});px.rect(g,p[0]-10,p[1]+2,20,2,'#514d37');px.rect(g,p[0]-10,p[1]+2,20*e.alert,2,e.alert>.95?'#c96640':'#d6bd6f');});}
  if(e.surrendered)r.textAt(e.x,e.y,38,'SPARED','#dfd5a9',{font:'tiny'});
  if(e.wind>0){const a=r.w(e.x,e.y,19),b=r.w(e.shotX,e.shotY,9);r.overlay(g=>{px.blend(g,.35,'normal',()=>{for(let t=0;t<1;t+=.07)px.line(g,E.lerp(a[0],b[0],t),E.lerp(a[1],b[1],t),E.lerp(a[0],b[0],t+.035),E.lerp(a[1],b[1],t+.035),'#e0a77a');});});}
 }
 drawActor(witness,witness.rig);if(witness.state==='running'){drawMarker(r,witness.x,witness.y,43,'#ffe6a6',5);r.textAt(witness.x,witness.y,53,'WITNESS','#f2d5a0',{font:'tiny'});}
 drawActor(player,heroRig,{hero:true,z:horse.mounted?15:0});
 if(state.flags.medicine){r.queue(player.x,player.y+.2,horse.mounted?23:14,g=>{const p=r.w(player.x-5,player.y+4,horse.mounted?22:14);px.rect(g,p[0]-5,p[1]-5,9,9,'#a7875c');px.rect(g,p[0]-3,p[1]-1,5,2,'#e1d6ae');px.rect(g,p[0]-1,p[1]-3,2,6,'#e1d6ae');});}
 for(const p of visualParticles){if(!world.visible(r,p.x,p.y,20))continue;const s=r.w(p.x,p.y,p.z);r.queue(p.x,p.y,p.z,g=>px.ddisc(g,s[0],s[1],p.s*(1.4-p.t/p.life),'#d3bd8d',p.t/p.life*.3));}
 for(const tr of traces){const a=r.w(tr.ax,tr.ay,tr.z),b=r.w(tr.bx,tr.by,17);r.overlay(g=>px.blend(g,tr.t/tr.max,'add',()=>px.line(g,...a,...b,tr.enemy?'#d9ab75':'#f6e2ad',tr.enemy?1:2)));}
 if(action){const p=r.w(action.target.x,action.target.y,48);r.overlay(g=>{px.rect(g,p[0]-23,p[1],46,4,'#3c4634');px.rect(g,p[0]-22,p[1]+1,44*Math.min(1,action.t/action.duration),2,'#e3c47b');});}
 if(mode==='play'&&game.input.aimSource==='mouse'&&game.input.mouse.active){const m=game.input.mouseScreen();if(m){const x=m[0]-r.ix,y=m[1]-r.iy;const a=aimPoint(),target=!!a.target,c=target?(focusOn?'#e9cf77':'#e7ad87'):'#e2d9ba';r.overlay(g=>{px.line(g,x-7,y,x-3,y,c);px.line(g,x+3,y,x+7,y,c);px.line(g,x,y-7,x,y-3,c);px.line(g,x,y+3,x,y+7,c);px.dot(g,x,y,c);});}}
 if(mode==='play')drawGoalGuide(r);
 // Seeded birds pass over the valley; their shadows tie sky movement to the ground.
 const bx=(clock*16)%2700-150,by=840+Math.sin(clock*.03)*150;if(world.visible(r,bx,by,50)){for(let i=0;i<3;i++){const p=r.w(bx+i*21,by+i*17,95);r.overlay(g=>{const flap=Math.sin(clock*5+i)*2;px.line(g,p[0]-5,p[1]+flap,p[0],p[1],'#4a5340');px.line(g,p[0],p[1],p[0]+5,p[1]+flap,'#4a5340');});}}
}
function drawGoalGuide(r){
 const goalP=goal(),p=r.w(goalP.x,goalP.y,24),border=28,inside=p[0]>border&&p[0]<r.W-border&&p[1]>border&&p[1]<r.H-border;
 if(inside&&dist(player,goalP)<170){drawMarker(r,goalP.x,goalP.y,46,'#efd188',4);return;}if(dist(player,goalP)<65)return;
 const cx=r.W/2,cy=r.H/2,dx=p[0]-cx,dy=p[1]-cy,k=Math.min((r.W*.5-border)/Math.max(1,Math.abs(dx)),(r.H*.5-border)/Math.max(1,Math.abs(dy))),x=cx+dx*Math.min(1,k),y=cy+dy*Math.min(1,k),a=Math.atan2(dy,dx);
 r.overlay(g=>{px.poly(g,[[x+Math.cos(a)*5,y+Math.sin(a)*5],[x+Math.cos(a+2.4)*4,y+Math.sin(a+2.4)*4],[x+Math.cos(a-2.4)*4,y+Math.sin(a-2.4)*4]],'#eed28c');});
}

function bind(id,fn){$(id).addEventListener('click',fn);}
bind('begin',startNew);bind('continue',continueGame);bind('title-guide',openGuide);bind('pause-guide',openGuide);bind('guide-done',closeGuide);bind('pause-button',pause);bind('resume',()=>setMode('play'));bind('retry-checkpoint',retry);bind('death-retry',retry);bind('pause-title-button',toTitle);bind('death-title-button',toTitle);bind('end-title',toTitle);bind('ride-again',startNew);bind('map-button',openMap);bind('journal-button',openMap);bind('satchel-button',openSatchel);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.dataset.close==='guide'?closeGuide():setMode('play')));
document.querySelectorAll('.sound-button').forEach(b=>b.addEventListener('click',toggleSound));bind('sound-setting',toggleSound);bind('assist-setting',()=>{prefs.assist=!prefs.assist;savePrefs();});bind('motion-setting',()=>{prefs.motion=!prefs.motion;game.reduceMotion=!prefs.motion;savePrefs();});
bind('fullscreen',()=>{try{if(document.fullscreenElement)document.exitFullscreen?.();else $('game-shell').requestFullscreen?.().catch(()=>toast('Full screen is not available in this browser.'));}catch{toast('Full screen is not available in this browser.');}});
// Keep standard keyboard focus and button activation available in every menu.
document.addEventListener('keydown',e=>{
 if(mode==='play')return;
 if(e.code==='Tab'){
  e.stopPropagation();
  const host=$({title:'title-screen',pause:'pause-screen',guide:'guide-screen',map:'journal-screen',satchel:'satchel-screen',dead:'death-screen',ending:'ending-screen',dialogue:'dialogue'}[mode]);
  const buttons=host?[...host.querySelectorAll('button:not([disabled])')].filter(b=>b.offsetParent!==null):[];
  if(buttons.length){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
 }else if((e.code==='Enter'||e.code==='Space')&&e.target.closest?.('button'))e.stopPropagation();
},true);
window.addEventListener('keydown',e=>{
 if(e.repeat)return;if(mode==='dialogue'&&/^Digit[1-4]$/.test(e.code)){e.preventDefault();choose(Number(e.code.slice(-1))-1);return;}
 if(e.code==='Enter'){if(mode==='title'){e.preventDefault();savedGame()?continueGame():startNew();}else if(mode==='dialogue'&&dialogue?.choices.length===1){e.preventDefault();choose(0);}else if(mode==='dead'){e.preventDefault();retry();}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play'){setMode('pause');updateSettings();}});
game.input.bindButtons($('touch-controls'));
game.input.touchFilter=e=>mode==='play';
function publicState(){return {title:'Dust & Mercy',chapter:'The Bitter Creek Run',mode,objective:OBJECTIVES[state.stage][0],stage:state.stage,player:{x:Math.round(player.x),y:Math.round(player.y),health:Math.ceil(state.health),stamina:Math.ceil(state.stamina),crouched:player.crouched},horse:{mounted:horse.mounted,stamina:Math.ceil(horse.stamina),bond:horse.bond},inventory:{ammo:state.ammo,reserve:state.reserve,bandages:state.bandages,rations:state.rations,cash:state.cash,medicine:state.flags.medicine},trust:state.trust,wanted:Math.round(state.wanted),witness:witness.state,flags:clone(state.flags),stats:clone(state.stats),ending:state.ending,errors:game.errors.map(e=>e.message),fps:game.fps};}
root.DustMercy={getState:publicState,engine:game,version:'1.0.0'};
if(QA_MODE)root.DustMercyQA={get state(){return state;},get player(){return player;},get horse(){return horse;},get enemies(){return enemies;},get witness(){return witness;},get mode(){return mode;},get world(){return world;},get action(){return action;},get dialogue(){return dialogue;},teleport(x,y){player.x=x;player.y=y;player.vx=player.vy=0;game.cam.snap=true;if(horse.mounted){horse.x=x;horse.y=y;}interactTarget=nearestInteraction();updateHUD(true);},advance(seconds){const steps=Math.ceil(seconds*120);for(let i=0;i<steps;i++){game.input.tick(1/120);update(1/120);}},startNew,choose,interact(){interactTarget=nearestInteraction();interactTarget?.fn();},speakDoctor,speakWorker,speakClerk,speakWitness,speakBroker,saveCheckpoint,retry,finish,useBandage,useRation,playerFire,toggleFocus,startReload,mountHorse,callHorse,reportCrime,findPath,publicState,setMode};
// A small browser tool surface uses the same controls as the visible game.
if(document.modelContext?.registerTool){
 const life=new AbortController();window.addEventListener('pagehide',()=>life.abort(),{once:true});
 const register=t=>{try{Promise.resolve(document.modelContext.registerTool(t,{signal:life.signal})).catch(()=>{});}catch{}};
 register({name:'read_frontier_status',title:'Read game status',description:'Read the current objective, player condition, supplies, and chapter result in Dust & Mercy.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw Error('This tool takes no arguments.');return publicState();}});
 register({name:'set_frontier_pause',title:'Pause or resume the game',description:'Pause or resume active play with the same control as the pause menu. Does not skip dialogue or other screens.',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.paused!=='boolean'||Object.keys(input).some(k=>k!=='paused'))throw Error('Provide only paused as a boolean.');if(input.paused&&mode==='play'){setMode('pause');updateSettings();}else if(!input.paused&&mode==='pause')setMode('play');else if(mode!=='play'&&mode!=='pause')throw Error('Close the current screen before changing pause.');return{mode};}});
}
reset();updateSettings();updateContinue();setMode('title');$('loading').classList.add('hidden');game.start({update,draw,pausable:false});
root.addEventListener('error',e=>{if(!e.message||e.message==='Script error.')return;$('loading').classList.add('hidden');});
})(window);
