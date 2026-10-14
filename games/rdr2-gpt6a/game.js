/* Dust & Mercy: Cinder Valley. Original game, adapted from the my-3D2dge handoff template.
   Core loop: prepare, ride, read the trail, decide, rescue, return. Local engine changes are isolated in docs/engine-runtime.patch. */
(() => {
'use strict';
const E = My3D2dge, W = WesternWorld;
E.VIEWS.frontier=new E.View('frontier','Frontier portrait',-25,42,1.12,1.05);
const SAVE = 'dust-mercy:v1', VERSION = 1;
const touchDisplay=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
const bindings = {
 up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],
 start:['Enter','Pad9'],confirm:['Enter','Space','Pad0'],cancel:['Escape','Backspace','Pad1'],pause:['Escape','KeyP','Pad9'],
 interact:['KeyE','Pad2'],attack:['Mouse0','KeyJ','Pad7'],focus:['KeyQ','Pad4'],reload:['KeyR','Pad3'],jump:['Space','Pad0'],sprint:['ShiftLeft','ShiftRight','Pad10'],crouch:['KeyC','Pad11'],
 mount:['KeyH','Pad5'],care:['KeyF'],lasso:['KeyL','Pad6'],melee:['KeyK'],map:['KeyM','Tab'],satchel:['KeyI'],view:['KeyV'],tonic:['KeyT'],dodge:['KeyX'],photo:['KeyO'],dynamite:['KeyG','Pad8']
};
const game = new E.Game({canvas:'screen',id:'dust-mercy',maxDpr:touchDisplay?1:3,res:[480,300],portrait:{res:[288,240]},expand:true,view:'threequarter',views:['threequarter','iso','topdown','brawler','overhead'],input:bindings,fullscreen:'button',corner:true,
 menu:{controls:{interact:'Interact / talk',attack:'Fire revolver',focus:'Focus / tracking',reload:'Reload',jump:'Jump / climb',sprint:'Run / gallop',crouch:'Crouch / cover',mount:'Mount / dismount',care:'Care for horse',lasso:'Lasso',melee:'Melee',map:'Map & journal',satchel:'Satchel',view:'Camera angle',tonic:'Drink tonic',dodge:'Dodge roll',photo:'Photo mode',dynamite:'Throw dynamite'},
 settings:[{key:'difficulty',label:'Difficulty',options:['Story','Standard','Hard'],value:'Standard',help:'Changes incoming damage; never blocks a story path.'},{key:'aimAssist',label:'Aim assistance',value:true,help:'Automatically aim at the nearest visible hostile. Turn off for mouse aim.'},{key:'hints',label:'Trail hints',value:true},{key:'visualDetail',label:'Visual detail',options:['Automatic','Full'],value:'Automatic',help:'Automatic keeps touch-screen play responsive. Full adds stronger character outlines.'},{key:'weather',label:'Weather',options:['Changing','Clear','Rain'],value:'Changing'}],
 items:[['Map & journal',()=>openMap()],['Satchel',()=>openSatchel()],['Photo mode',()=>photoMode()]],quit:'title'}});
const ui = new E.Shell(game,{settings:{onChange(settings,key){if(key==='visualDetail')game.screen.setOptions({maxDpr:touchDisplay&&settings.visualDetail!=='Full'?1:3})}},theme:{ink:'#f0e9d9',paper:'#22251ded',accent:'#ddb775',muted:'#c1b399',danger:'#bb6553',line:'#8f7952',font:'Arial, sans-serif',titleFont:'Georgia, serif'},
 screens:{help:{kicker:'A little wisdom for the road',title:'The trail guide',sections:[['Your errand','Dr. Ada Vale never made it back to Cinder. Speak to Marshal Bell, follow the two clues east, and bring the doctor and her medicine home. You can negotiate, sneak, or fight.'],['A living frontier','Care for your horse, Flint. Gather yarrow, hunt or fish, cook at camp, trade at the store, play twenty-one at the saloon, or explore the mine. All are optional; your journal records them.'],['Combat & mercy','Fire aims at the nearest visible hostile with Aim assistance on. Focus slows time and exposes tracks. Reload your six-shooter. Crouching behind walls breaks sight; a lasso or silent takedown can spare a life. Ordinary townsfolk are protected; firing in town still brings the law.'],['Saving','Checkpoints save automatically in this browser. Continue restores the latest checkpoint. Falling in battle lets you retry without losing the mission. Saves remain local to this device.']],keys:[]}}});
game.screen.setOptions({maxDpr:touchDisplay&&game.settings.visualDetail!=='Full'?1:3});
const talk=new E.Dialog(game,{speed:38,place:'bottom',bg:'#25281f',border:'#b79b65',nameColor:'#efd59d'});
const shots=new E.Bullets(game,{plane:'ground',max:120});
const combo=new E.Combo(['jab','cross','hook','uppercut']);
const motion=typeof Mocap!=='undefined'?Mocap.load(MOCAP.WESTERN):null;
let world,hero,horse,heroRig,doctor,npcs=[],foes=[],flow,spatial,checkpoint=null,state,near=null,mine,frontier;
let cooldown=0,reloading=0,invulnerable=0,dustTimer=0,saveTimer=0,noise=null,lassoLine=null,toastFlags=new Set();
let fishing=null,cards=null,campMenu=null,photo=false,photoView='threequarter',waypoint=null,lastHud=-1,flashTrail=0;
const quests=[
 {title:'A doctor overdue',text:'Speak to Marshal Bell in Cinder.',at:'sheriff'},
 {title:'Follow the broken wheel',text:'Ride east. Inspect the overturned supply trail.',at:'clue1'},
 {title:'Blood on the sage',text:'Follow the tracks across the river.',at:'clue2'},
 {title:'The price of mercy',text:'Find Dr. Vale at the raider camp.',at:'doctor'},
 {title:'The long way home',text:'Escort Dr. Vale to Marshal Bell.',at:'sheriff'},
 {title:'A little room for mercy',text:'Cinder is safe. The valley is yours to explore.',at:'camp'}
];
const songs={trail:{bpm:72,steps:2,tracks:[{wave:'triangle',vol:.12,notes:'A3 - E4 - A4 - . . G4 - E4 - D4 - . . C4 - D4 - E4 - . . D4 - C4 - A3 - . .'},{wave:'sine',vol:.08,notes:'A2 - - - . . E3 . A2 - - - . . E3 . F2 - - - . . C3 . E2 - - - . . E3 .'}]},danger:{bpm:112,steps:2,tracks:[{wave:'triangle',vol:.11,notes:'A3 . A3 E4 A3 . G3 E3 A3 . A3 E4 G4 E4 C4 E4'},{wave:'drums',vol:.055,notes:'k . h . k . h s'}]},home:{bpm:78,steps:2,tracks:[{wave:'sine',vol:.14,notes:'C4 - E4 - G4 - A4 - G4 - E4 - D4 - C4 -'},{wave:'triangle',vol:.06,notes:'C3 - . G3 F3 - . C3 C3 - . G3 G2 - . D3'}]}};
let musicName='';
function music(name){if(musicName!==name){musicName=name;game.audio.music(songs[name]||songs.trail)}}
function notify(title,text=''){ui.toast(title,text,4);}
function once(id,title,text){if(!toastFlags.has(id)){toastFlags.add(id);notify(title,text)}}
function clampStats(){for(const k of ['hp','stamina','focus','core','horseStamina'])state[k]=E.clamp(state[k],0,100);state.honor=E.clamp(state.honor,-100,100);state.bond=E.clamp(state.bond,0,100)}
function freshState(){return {version:VERSION,stage:0,hp:100,stamina:100,focus:100,core:85,horseStamina:100,bond:20,honor:0,money:18,ammo:6,reserve:36,tonics:2,herbs:0,meat:0,fish:0,pelts:0,food:2,mounted:false,tracking:false,focusOn:false,wanted:0,bounty:0,time:0,elapsed:0,weather:'clear',night:false,shots:0,kills:0,spared:0,deaths:0,medicine:false,rescued:false,negotiated:false,missionComplete:false,activities:{},discovered:[],collected:[],log:['Marshal Bell sent word: the valley’s doctor is missing.'],weapon:1}};
function rig(cloth,hat=true,weapon='gun',size=1.3){return new E.Humanoid({size,build:'heroic',weapon,outfit:'coat',hair:'short',sleeves:'long',hat:hat?{style:'cap',color:'#776040'}:null,colors:{skin:'#bc916f',hair:'#342c23',cloth,coat:cloth,pants:'#3b4540',boot:'#302e28',belt:'#714c32',trim:'#b6a071',metal:'#7c8584',glove:'#ac8565'}})}
function createPeople(){
 hero=new E.Mover({x:220,y:675,walk:68,run:76,sprintSpeed:120,sneak:38,r:5,climbMax:48});hero.facing=-1;
 heroRig=rig('#566657');if(motion)Mocap.drive(heroRig,motion);
 horse=new E.Body({x:252,y:690,r:8});horse.facing=-1;horse.name='Flint';
 npcs=[{id:'sheriff',name:'Marshal Bell',x:320,y:420,rig:rig('#615547'),pose:'hips'},
 {id:'store',name:'Ruth Mercer',x:400,y:400,rig:rig('#847556',false,null),pose:'wave'},
 {id:'saloon',name:'Silas Pike',x:270,y:400,rig:rig('#655047'),pose:'hips'},
 {id:'hunter',name:'June Ash',x:450,y:610,rig:rig('#695f47'),pose:'kneel'}];
 for(const n of npcs){n.z=0;n.facing=1.4;if(motion){Mocap.drive(n.rig,motion);n.rig.mocap=motion.sample(motion.clip(n.id==='hunter'?'Fixing_Kneeling':'Idle_Talking_Loop'),0)}}
 doctor=new E.Mover({x:1010,y:305,run:86,walk:75,r:5});doctor.rig=rig('#a8a08a',false,null,1.2);doctor.name='Dr. Ada Vale';doctor.facing=2;
 foes=[[922,345,'Boone',true],[1000,390,'Raider',false],[890,295,'Lookout',false],[1055,350,'Raider',false]].map(([x,y,name,leader],i)=>{const b=new E.Mover({x,y,run:32,sprintSpeed:44,r:7,climbMax:48});Object.assign(b,{id:'foe'+i,homeX:x,homeY:y,name,leader,hp:leader?90:60,alive:true,bound:false,rig:rig(leader?'#7d493a':'#665e48',true,'gun',leader?1.4:1.25),mind:new E.Suspicion({rise:.7,forget:7}),cool:1+i*.7,wind:0,death:0,facing:i%2?0:Math.PI});if(motion)Mocap.drive(b.rig,motion);return b});
}
function reset(saved=null){
 state=freshState();if(saved){const s=saved.state;Object.assign(state,s,{version:VERSION,mounted:false,focusOn:false,tracking:false});state.activities={...(s.activities||{})};state.collected=[...(s.collected||[])];state.log=[...(s.log||[])];state.discovered=[...(s.discovered||[])];}
 createPeople();shots.clear();combo.cancel?.();cooldown=0;reloading=0;invulnerable=0;fishing=null;cards=null;noise=null;campMenu=null;photo=false;toastFlags=new Set();
 if(saved){if(saved.hero)Object.assign(hero,{x:saved.hero.x,y:saved.hero.y,z:saved.hero.z||0});Object.assign(horse,{x:hero.x+30,y:hero.y+10});if(saved.foes)for(let i=0;i<foes.length;i++)Object.assign(foes[i],saved.foes[i]||{});if(saved.doctor)Object.assign(doctor,saved.doctor);}
 else {for(const a of world.animals||[]){a.alive=true;a.x=a.homeX;a.y=a.homeY}}
 if(saved?.animals)for(const a of world.animals||[]){const sa=saved.animals.find(v=>v.id===a.id);if(sa)Object.assign(a,sa)}
 clampStats();checkpoint=serialise();game.timeScale=1;setBodyClass();
}
function serialise(){return {version:VERSION,state:JSON.parse(JSON.stringify(state)),hero:{x:hero.x,y:hero.y,z:hero.z},doctor:{x:doctor.x,y:doctor.y,z:doctor.z},foes:foes.map(f=>({x:f.x,y:f.y,z:f.z,hp:f.hp,alive:f.alive,bound:f.bound,takedown:!!f.takedown})),animals:(world.animals||[]).map(a=>({id:a.id,x:a.x,y:a.y,alive:a.alive}))}}
function validSave(s){if(!s||s.version!==VERSION||!s.state||!s.hero)return false;const t=s.state;return Number.isInteger(t.stage)&&t.stage>=0&&t.stage<=5&&Number.isFinite(s.hero.x)&&Number.isFinite(s.hero.y)&&s.hero.x>=0&&s.hero.x<=1280&&s.hero.y>=0&&s.hero.y<=1024&&['hp','stamina','focus','core','horseStamina','bond','honor','money','ammo','reserve','tonics','herbs','meat','fish','pelts','food','elapsed','time'].every(k=>Number.isFinite(t[k]))&&['money','ammo','reserve','tonics','herbs','meat','fish','pelts','food'].every(k=>t[k]>=0)&&Array.isArray(t.log)&&Array.isArray(t.collected)&&Array.isArray(t.discovered)&&t.activities&&typeof t.activities==='object'}
function getSave(){const s=E.store.get(SAVE,null);return validSave(s)?s:null}
function save(){if(!state||state.hp<=0)return;checkpoint=serialise();const saved=E.store.set(SAVE,checkpoint);if(!saved)once('storage','Saving is unavailable','This browser is blocking storage. Your checkpoint lasts for this visit.');saveTimer=0;}
function progress(stage,entry){state.stage=stage;state.log.push(entry);save();notify('Journal updated',entry);}
function setBodyClass(){if(typeof document==='undefined')return;document.body.classList.toggle('playing',game.sceneName!=='title');document.body.classList.toggle('focus',state?.focusOn||false)}
function titleScreen(){ui.hud({});ui.tutorial(null);setBodyClass();const saved=getSave();ui.show('title',{kicker:'An original frontier story',name:'Dust &\nMercy',subtitle:'The Cinder Valley Chapter',text:'The doctor is missing. The river is rising.\nAnd every trail asks something of you.',actions:[...(saved?[['Continue your journey',()=>begin(saved)]]:[]),[saved?'Begin again':'Ride into Cinder Valley',()=>saved?ui.show('confirm',{title:'Begin a new journey?',text:'This replaces your saved chapter. Your settings stay with you.',actions:[['Keep my journey',()=>ui.back()],['Begin again',()=>begin()]]}):begin()],['Trail guide',()=>help()],['Settings',()=>game.menu('settings')]],meta:['ONE VALLEY','YOUR CHOICES','PLAY AT YOUR PACE']});}
function begin(saved=null){reset(saved);ui.hide();game.go('play');musicName='';music('trail');if(!saved)save();game.input.clear();ui.tutorial('Welcome to Cinder Valley',(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)?'Drag the left side to walk. Tap Tactics to mount Flint. Follow the gold trail marker.':`Move with ${game.input.label('up')}/${game.input.label('left')}/${game.input.label('down')}/${game.input.label('right')}. ${game.input.label('mount')} mounts Flint. Follow the gold marker to Marshal Bell.`,12);}
function help(){ui.o.screens.help.keys=[['W A S D / stick','Move'],[game.input.label('interact'),'Talk / interact'],[game.input.label('mount'),'Mount / dismount'],[game.input.label('attack'),'Fire / assisted aim'],[game.input.label('focus'),'Focus / reveal tracks'],[game.input.label('reload'),'Reload'],[game.input.label('jump'),'Jump / climb'],[game.input.label('crouch'),'Sneak / cover'],[game.input.label('lasso'),'Non-lethal lasso'],[game.input.label('melee'),'Melee / takedown'],[game.input.label('tonic'),'Drink tonic'],[game.input.label('map'),'Map & journal']];ui.show('help');}
function modal(name,spec){state.focusOn=false;game.timeScale=1;game.audio.duck(true);ui.show(name,spec);game.input.clear()}
function closeModal(){ui.hide();game.audio.duck(false);game.input.clear()}
function say(name,lines,options={}){const p=npcs.find(n=>n.name===name)?.rig||(name==='Dr. Ada Vale'?doctor.rig:foes.find(f=>f.name===name)?.rig)||heroRig;talk.say(lines,{name,portrait:p,...options});state.focusOn=false;game.timeScale=1;game.input.clear();}
function complete(){state.stage=5;state.missionComplete=true;state.money+=40;state.honor+=20;state.log.push('Ada and the medicine made it home. Cinder remembers.');clampStats();save();game.go('end');}
function results(){ui.tutorial(null);ui.hud({});music('home');const mercy=state.kills===0;ui.show('results',{emblem:'✦',kicker:'Chapter complete',title:mercy?'A little room for mercy':'What the valley remembers',text:mercy?'Ada opens the clinic before sundown. Four men live to reckon with their choices. Cinder will remember the rider who brought its doctor home.':'Ada opens the clinic before sundown. The medicine will save lives. The graves on the ridge are part of your story, too.',stats:[[Math.floor(state.elapsed/60)+'m '+Math.floor(state.elapsed%60)+'s','Time on the trail'],['$40','Reward'],[state.honor,'Honor']],medals:[['Merciful',mercy],['Horse companion',state.bond>=40],['Frontier naturalist',!!state.activities.fished&&!!state.activities.cooked],['Silver seeker',!!state.activities.mine]],actions:[['Stay in the valley',()=>{closeModal();game.go('play')}],['Return to title',()=>{closeModal();game.go('title')}]]})}
function defeated(){state.hp=0;state.focusOn=false;game.timeScale=1;game.go('dead')}
function hurt(amount){if(invulnerable>0||hero.action?.invulnerable||state.hp<=0)return;const mult={Story:.45,Standard:1,Hard:1.4}[game.settings.difficulty]||1;state.hp-=amount*mult;invulnerable=.65;heroRig.kick?.(.3);game.hitFx(hero.x,hero.y,hero.z+18,{power:.4,damage:Math.round(amount*mult),textScale:1});game.audio.sfx('hurt');if(state.hp<=0)defeated()}
function drink(){if(state.tonics<=0){notify('Your satchel is empty','Buy a tonic from Ruth, or brew yarrow at camp.');return}state.tonics--;state.hp=Math.min(100,state.hp+55);state.focus=Math.min(100,state.focus+50);game.audio.sfx('heal');notify('Yarrow tonic','Health and focus restored.');save()}
function interact(id=near?.id){if(!id)return;if(id.startsWith('frontier-')){frontier.interact(id);return;}
 if(id==='sheriff'){
  if(state.stage===0)say('Marshal Bell',['Ada went east with our last medicine. Her wagon never crossed back.','There’s a broken wheel past the horse pasture. Start there. And rider… bring her home.'],{onDone:()=>progress(1,'Bell sent you to the broken wagon east of Cinder.')});
  else if(state.stage===4&&E.dist(hero,doctor)<100)say('Dr. Ada Vale',['Open the clinic, Bell. There’s still time.','I’ll remember what you did out there. The valley will, too.'],{onDone:complete});
  else if(state.wanted>0||state.bounty>0)modal('law',{kicker:'Cinder marshal’s office',title:'Settle your debt',text:`Bounty: $${state.bounty}. Firing in town draws the law. Honor and the law are separate.`,actions:[{label:`Pay $${state.bounty}`,disabled:state.money<state.bounty,fn:()=>{state.money-=state.bounty;state.bounty=0;state.wanted=0;save();closeModal();notify('Debt settled','Cinder’s law has a long memory.')}},['Leave',closeModal]]});
  else say('Marshal Bell',[state.stage===5?'The doors of Cinder are open to you.':'Keep following the trail east. The map marks your next lead.']);
 }else if(id==='clue1'){
  if(state.stage===1)say('Elias Reed',['A snapped axle. Four fresh hoofprints heading for the river.','Ada’s bag is gone, but there’s no sign she was hurt.'],{onDone:()=>{state.activities.tracked=true;progress(2,'Four riders crossed the river. Follow the hoofprints east.');state.tracking=true;flashTrail=8}});
  else notify('Broken wagon','The trail leads east, across the bridge.');
 }else if(id==='clue2'){
  if(state.stage===2)say('Elias Reed',['A strip of the doctor’s coat. Caught on sage.','Smoke north of here. Someone’s keeping a fire low.'],{onDone:()=>progress(3,'The doctor is at the raider camp northeast of the bridge.')});
  else notify('Torn linen','Camp smoke drifts from the northeast.');
 }else if(id==='doctor'){
  if(state.stage<3){notify('Follow the trail','Find out what happened at the wagon first.');return}
  if(state.stage===3){const live=foes.filter(f=>f.alive&&!f.bound);
   if(state.negotiated||live.length===0||(!live.some(f=>f.mind.state==='alert')&&hero.crouch))rescue();
   else say('Dr. Ada Vale',['Boone wants thirty dollars for the medicine. He says the company owes his men.','Talk to him. Or keep low and cut me loose while their backs are turned.']);
  }else say('Dr. Ada Vale',[state.stage===4?'I’m right behind you. Don’t leave me too far back.':'Come by the clinic sometime, Elias.']);
 }else if(id==='boone'){
  if(state.stage<3){notify('The raiders watch you','Learn where the wagon went before approaching.');return}
  if(state.negotiated){notify('A deal is a deal','The doctor is free to go.');return}
  say('Boone',['The railroad took our wages. We took their medicine. Fair trade.','Thirty dollars. Or give me your word the marshal will hear us out.'],{choices:['Give your word','Pay $30','Walk away'],onChoice:i=>{
   if(i===0){state.negotiated=true;state.honor+=15;for(const f of foes)f.mind.reset();state.spared=foes.filter(f=>f.alive).length;save();notify('A promise given','Boone lowers his gun. Speak to Dr. Vale.');}
   if(i===1){if(state.money<30){notify('Not enough money','Trade supplies in Cinder, explore the mine, or try a different approach.');return}state.money-=30;state.negotiated=true;state.spared=foes.filter(f=>f.alive).length;for(const f of foes)f.mind.reset();save();notify('An expensive peace','Speak to Dr. Vale.');}
  }});
 }else if(id==='store')openStore();
 else if(id==='saloon')openCards();
 else if(id==='camp')openCamp();
 else if(id==='herb'){const key='herb';if(state.collected.includes(key)){notify('Yarrow gathered','Fresh plants grow farther down the river.');return}state.herbs+=3;state.collected.push(key);state.activities.gathered=true;game.particles.glints(hero.x,hero.y,10,10,'#e7cf88');game.audio.sfx('pickup');notify('Wild yarrow ×3','Brew a tonic at your campfire.');save();}
 else if(id==='fishing')startFishing();
 else if(id==='hunter'){say('June Ash',['Rabbits by the sage. Deer in the south pasture. Don’t waste what you take.','Use focus to read their tracks. One clean shot, then gather the meat and pelt. Ruth pays for pelts; the campfire makes a meal.']);}
 else if(id==='grave'){if(!state.activities.grave){state.activities.grave=true;state.honor+=5;state.log.push('The stone reads: “We were here. We were loved.”');save()}say('Elias Reed',['“We were here. We were loved.”','Someone still leaves wildflowers.']);}
 else if(id==='mine'){if(state.mounted)mount();closeModal();state.focusOn=false;game.timeScale=1;game.go('mine',{claimed:!!state.activities.mine,breached:!!state.mineBreached,bonus:!!state.mineBonus});}
 else if(id==='range'){state.activities.range=true;state.ammo=6;state.reserve=Math.max(state.reserve,24);state.rangeScore=0;state.rangeActive=true;rangeTargets.forEach(t=>t.alive=true);notify('The three-bottle challenge','Shoot the three bottles. Ammunition supplied. $5 for a clean round.');}
 else if(id.startsWith('animal:')){const a=world.animals.find(a=>a.id===id.slice(7));if(a&&!a.alive&&!state.collected.includes(a.id)){state.collected.push(a.id);state.meat+=a.kind==='deer'?2:1;state.pelts++;state.activities.hunted=true;notify('Nothing wasted',`${a.kind==='deer'?'Venison ×2':'Game meat ×1'} · Pelt ×1`);game.audio.sfx('pickup');save();}}
 else if(id.startsWith('loot:')){const f=foes.find(f=>f.id===id.slice(5));if(f&&!state.collected.includes(f.id)){state.collected.push(f.id);state.reserve+=6;state.money+=4;notify('Recovered supplies','6 cartridges · $4');save();}}
}
function rescue(){state.rescued=true;state.medicine=true;state.spared=foes.filter(f=>f.alive).length;state.honor+=10;say('Dr. Ada Vale',['The medicine is intact. Help me carry it back.','If you ride, I’ll keep to the trail. Wait for me at the bridge.'],{onDone:()=>progress(4,'Ada is free. Escort her and the medicine back to Marshal Bell.')});for(const f of foes)f.mind.reset();}
function mount(){if(state.mounted){state.mounted=false;let spot={x:hero.x,y:hero.y};for(let i=0;i<8;i++){const a=hero.facing+Math.PI/2+i*Math.PI/4,x=hero.x+Math.cos(a)*22,y=hero.y+Math.sin(a)*22;if(world.map.standable(x,y,hero.z,horse.r)){spot={x,y};break}}Object.assign(horse,{...spot,vx:0,vy:0,facing:hero.facing});notify('Boots on the ground','Flint will wait nearby.');return}if(E.dist(hero,horse)>48){notify('Whistling for Flint','Your horse is coming.');horse.called=true;game.audio.sfx({wave:'sine',freq:1150,to:1650,dur:.35,vol:.15});return}state.mounted=true;hero.crouch=false;state.bond+=1;clampStats();notify('Flint · your companion','Hold sprint to gallop. Care builds trust and endurance.');game.audio.sfx('select')}
function care(){if(E.dist(hero,horse)>55&&!state.mounted){notify('Bring Flint closer','Whistle with '+game.input.label('mount')+'.');return}state.bond+=8;state.horseStamina+=30;state.activities.horse=true;clampStats();game.audio.sfx('heal');notify('Easy, Flint',`Bond ${Math.round(state.bond)} / 100 · Stamina restored`);save();}
function openStore(){modal('store',{kicker:'Mercer’s general store',title:'Make yourself ready',text:`$${state.money} in your purse. Fair prices, fewer questions.`,actions:[{label:'Cartridges ×12 · $4',disabled:state.money<4,fn:()=>buy('reserve',12,4)},{label:'Yarrow tonic · $6',disabled:state.money<6,fn:()=>buy('tonics',1,6)},{label:'Trail provisions ×2 · $3',disabled:state.money<3,fn:()=>buy('food',2,3)},{label:state.weapon>1?'Revolver serviced':'Service revolver · $12',disabled:state.money<12||state.weapon>1,fn:()=>{state.money-=12;state.weapon=1.35;state.activities.upgraded=true;save();openStore()}},{label:`Sell ${state.pelts} pelts · $${state.pelts*8}`,disabled:state.pelts===0,fn:()=>{state.money+=state.pelts*8;state.pelts=0;state.activities.traded=true;save();openStore()}},['Leave the store',closeModal]]})}
function buy(item,n,cost){if(state.money<cost)return;state.money-=cost;state[item]+=n;state.activities.traded=true;game.audio.sfx('coin');save();openStore()}
function openSatchel(){modal('satchel',{kicker:'Elias Reed’s satchel',title:'What you carry',text:`$${state.money} · ${state.ammo}/6 loaded · ${state.reserve} spare cartridges\n${state.tonics} tonics · ${state.food} provisions · ${state.herbs} yarrow\n${state.meat} meat · ${state.fish} fish · ${state.pelts} pelts\n${state.frontier?.dynamite??3} dynamite bundles\n${state.medicine?'Ada’s medicine is safe.':'A little space left for what the trail brings.'}`,actions:[{label:'Drink a tonic',disabled:state.tonics<1,fn:()=>{drink();openSatchel()}},{label:'Eat provisions',disabled:state.food<1,fn:()=>{state.food--;state.core=100;state.stamina=100;state.hp=Math.min(100,state.hp+20);save();game.audio.sfx('heal');openSatchel()}},['Care for Flint',()=>{care();closeModal()}],['Close satchel',closeModal]]})}
function openTactics(){modal('tactics',{kicker:'Choose your approach',title:'A steady hand',text:'Every action is available by touch. The trail waits while you choose.',actions:[
 [hero.crouch?'Stand up':'Crouch / take cover',()=>{if(state.mounted)mount();hero.crouch=!hero.crouch;closeModal()}],
 [state.autoSprint?'Stop running':'Run / gallop automatically',()=>{state.autoSprint=!state.autoSprint;closeModal()}],
 ['Throw lasso',()=>{closeModal();lasso()}],['Melee / silent takedown',()=>{closeModal();melee()}],
 ['Reload revolver',()=>{closeModal();reload()}],['Mount / call Flint',()=>{closeModal();mount()}],
 ['Focus / reveal tracks',()=>{closeModal();game.input.tap('focus')}],['Jump / climb',()=>{closeModal();game.input.tap('jump')}],[`Throw dynamite (${state.frontier?.dynamite??3})`,()=>{closeModal();frontier.throwDynamite()}],['Photograph the valley',photoMode],['Trail guide',help],['Back to the trail',closeModal]]})}
function openCamp(){campMenu=new E.Menu(game,['Rest until dawn',`Cook meat / fish (${state.meat+state.fish})`,`Brew yarrow tonic (${state.herbs})`,'Break camp'],{title:'THE CAMPFIRE',x:'center',y:'center',onPick(i){
 if(i===0){state.hp=100;state.stamina=100;state.focus=100;state.core=Math.max(state.core,75);state.horseStamina=100;state.time=0;state.wanted=0;state.activities.rested=true;notify('A new day','Health, stamina and focus restored.');save();campMenu=null;}
 if(i===1){if(state.meat+state.fish===0){notify('Nothing to cook','Hunt or fish, then return to the fire.');return}if(state.meat>0)state.meat--;else state.fish--;state.food++;state.core=100;state.activities.cooked=true;game.audio.sfx('heal');notify('A proper meal','Cooked provisions added. Your core is full.');save();campMenu=null;}
 if(i===2){if(state.herbs<1){notify('Find wild yarrow','Look for yellow flowers east of camp.');return}state.herbs--;state.tonics++;state.activities.crafted=true;game.audio.sfx('pickup');notify('Yarrow tonic','One bottle for a hard road.');save();campMenu=null;}
 if(i===3)campMenu=null;
},onCancel:()=>campMenu=null});game.input.clear()}
function startFishing(){if(fishing)return;state.mounted=false;fishing={t:0,phase:'waiting',catchAt:2.5+(state.fish%3)*.6};state.activities.fishingTried=true;notify('Cast into Stillwater','Wait for a bite, then press '+game.input.label('interact')+' while the marker is in the gold band.');game.audio.sfx('whoosh')}
function updateFishing(dt){fishing.t+=dt;if(fishing.phase==='waiting'&&fishing.t>=fishing.catchAt){fishing.phase='reel';fishing.t=0;game.audio.sfx('coin')}
 if(game.input.pressed('cancel')||game.input.pressed('jump')){fishing=null;return}
 if(fishing.phase==='reel'&&game.input.pressed('interact')){const pos=(Math.sin(fishing.t*3.5)+1)/2;if(pos>.28&&pos<.74){state.fish++;state.activities.fished=true;state.honor+=1;game.audio.sfx('pickup');notify('Silver trout','One fish in your satchel. Cook it at camp.');save()}else notify('Slipped the hook','Try again. Reel inside the gold band.');fishing=null;return}
 if(fishing&&fishing.phase==='reel'&&fishing.t>8){fishing=null;notify('The river keeps this one','Cast again when you’re ready.')} }
function openCards(){if(!cards)modal('cards',{kicker:'The Dusty Lantern',title:'A hand of twenty-one',text:'A friendly $2 stake. Get closer to 21 than Silas without going over. Aces count as 1; face cards as 10. Ties return your stake.',actions:[{label:'Deal me in · $2',disabled:state.money<2,fn:()=>{state.money-=2;cards={you:[drawCard(),drawCard()],house:[drawCard(),drawCard()]};showCards()}},['Leave the table',closeModal]]});else showCards()}
function drawCard(){return Math.min(10,E.randInt(1,13))}
function showCards(){const total=cards.you.reduce((a,b)=>a+b,0);modal('cards',{kicker:'Twenty-one · $2 in the pot',title:cards.you.join('  ·  '),text:`Your hand: ${total}\nSilas shows ${cards.house[0]}.`,actions:[['Hit',()=>{cards.you.push(drawCard());if(cards.you.reduce((a,b)=>a+b,0)>21)finishCards(true);else showCards()}],['Stand',()=>finishCards(false)],['Fold',()=>{cards=null;save();closeModal()}]]})}
function finishCards(bust){let house=cards.house.reduce((a,b)=>a+b,0);while(house<17){cards.house.push(drawCard());house=cards.house.reduce((a,b)=>a+b,0)}const you=cards.you.reduce((a,b)=>a+b,0),win=!bust&&(house>21||you>house),tie=!bust&&you===house;if(win)state.money+=4;else if(tie)state.money+=2;state.activities.cards=true;cards=null;save();modal('cards',{kicker:'The Dusty Lantern',title:win?'Fortune smiles.':tie?'An even hand.':'House takes it.',text:`You: ${you} · Silas: ${house}\n${win?'You leave $2 ahead.':tie?'Your stake is returned.':'There’s always another hand.'}`,actions:[['Another hand',openCards],['Leave the table',closeModal]]})}
function openMap(){if(!world)return;const q=quests[state.stage];modal('map',{kicker:'Territory of Cinder · 1899',title:'The valley & your trail',text:q.title+' — '+q.text,map:world.map,at:hero,markers:markers(),labels:[['CINDER',330,340],['CAMP',220,730],['STILLWATER',675,820],['RAIDER RIDGE',980,255],['SILVER MINE',1060,625]],onPick:(x,y)=>{waypoint={x,y,z:0};notify('Waypoint marked','A white marker guides your ride.');},sections:[['Journal',state.log.slice(-5).join('\n')],['Frontier pursuits',Object.keys(state.activities).filter(k=>state.activities[k]).join(' · ')||'The valley is waiting to be discovered.'],['Your standing',`Honor ${Math.round(state.honor)} · Bounty $${state.bounty} · Flint’s bond ${Math.round(state.bond)}/100`]],actions:[['Back to the trail',closeModal]]})}
function photoMode(){photo=true;photoView=game.view.id;game.timeScale=0;modal('photo',{kicker:'A moment on the frontier',title:'The photographer’s eye',text:'Choose a lens and return to the viewfinder. Your browser’s screenshot command captures the scene. Escape opens the menu again.',actions:[['Frontier portrait',()=>photoLens('frontier')],['Isometric',()=>photoLens('iso')],['Three-quarter',()=>photoLens('threequarter')],['Overhead',()=>photoLens('overhead')],['Low horizon',()=>photoLens('brawler')],['Side silhouette',()=>photoLens('side')],['Top-down',()=>photoLens('topdown')],['Turn camera 45°',()=>{game.rotateView(45);photoFrame()}],['Return to the trail',()=>{photo=false;game.timeScale=1;game.setView(photoView);closeModal()}]]});game.timeScale=0}
function photoLens(id){game.setView(id);photoFrame()}
function photoFrame(){closeModal();game.timeScale=0;notify('Photo mode',`${game.input.label('photo')} for lenses · ${game.input.label('interact')} to return to the trail.`)}
const linen=E.sprite(['..ll..','.lLLl.','lLLLLl','.lLLl.','..ll..'],{l:'#bba67c',L:'#f0dfb7'},1);
const gameSpoils=E.sprite(['...kk...','..kbbk..','.kBBBBk.','kBBBBBBk','kBBbbBBk','.kBBBBk.','..kkkk..'],{k:'#514735',b:'#b59a68',B:'#91754e'},2);
const rangeTargets=[{id:'bottle0',x:320,y:228,z:17,r:5,alive:true},{id:'bottle1',x:350,y:228,z:17,r:5,alive:true},{id:'bottle2',x:380,y:228,z:17,r:5,alive:true}];
function targets(){let list=foes.filter(f=>f.alive&&!f.bound);if(state.rangeActive&&E.dist(hero,world.locations.range)<130)list=rangeTargets.filter(t=>t.alive);else if(!list.some(f=>E.dist(hero,f)<230))list=(world.animals||[]).filter(a=>a.alive);spatial.build(list);const nearby=[];spatial.near(hero.x,hero.y,250,t=>nearby.push(t));return E.targets(hero,nearby,{range:250,arc:Math.PI,sight:world.map,dz:60}).map(t=>t.target)}
function fire(){if(cooldown>0||reloading>0)return;if(state.ammo<=0){reload();return}state.ammo--;state.shots++;cooldown=state.focusOn?.11:.34;const target=game.settings.aimAssist?targets()[0]:null;let angle=hero.facing;
 if(game.input.padAim){const a=game.view.screenDirToGround(...game.input.padAim);angle=Math.atan2(a[1],a[0]);}else if(target)angle=E.angleTo(hero,target);else if(game.input.lastDevice==='mouse'){const p=game.mouseGround();if(p)angle=Math.atan2(p[1]-hero.y,p[0]-hero.x)}
 hero.facing=angle;shots.fire({x:hero.x+Math.cos(angle)*10,y:hero.y+Math.sin(angle)*10,z:hero.z+20,vx:Math.cos(angle)*390,vy:Math.sin(angle)*390,r:2.5,dmg:34*state.weapon,life:1.1,team:'player',color:'#eeca7e'});
 game.particles.sparks(hero.x+Math.cos(angle)*15,hero.y+Math.sin(angle)*15,hero.z+20,6,angle);game.particles.smoke(hero.x,hero.y,hero.z+22,2,{size:.6,color:'#b4b0a0'});game.audio.sfx('revolver',{vol:.6,pitch:.9});game.shake(.7);noise={x:hero.x,y:hero.y,z:hero.z,loud:250,t:.3};
 if(E.dist(hero,world.locations.town)<150){state.wanted=35;state.bounty+=2;state.honor-=3;once('wanted','The law heard that','Leave town until the search ends. Your bounty stays until paid.');}
}
function reload(){if(reloading>0||state.ammo>=6)return;if(state.reserve<=0){notify('Out of cartridges','Buy ammunition in Cinder or recover it from the raiders.');return}reloading=1.4;game.audio.sfx('select',{pitch:.6})}
function lasso(){const t=E.targets(hero,foes.filter(f=>f.alive&&!f.bound),{range:85,arc:Math.PI,sight:world.map})[0]?.target;if(!t){notify('No one in reach','Move within lasso range of a raider.');return}t.bound=true;t.mind.reset();state.honor+=3;state.spared++;state.activities.lasso=true;lassoLine={x:t.x,y:t.y,z:14,t:.6};game.audio.sfx('whoosh');game.particles.text(t.x,t.y,35,'BOUND','#daca91');save();}
function melee(){const t=E.targets(hero,foes.filter(f=>f.alive&&!f.bound),{range:34,arc:Math.PI,sight:world.map})[0]?.target;if(t&&hero.crouch&&t.mind.state!=='alert'){hero.play('takedown',{other:t});t.bound=true;t.takedown=true;state.spared++;state.honor+=5;state.activities.stealth=true;game.audio.sfx('punch');save();return}combo.press();game.audio.sfx('swing');}
function enemyHit(f,damage){if(!f.alive||f.bound)return;f.hp-=damage;f.mind.level=1.2;game.hitFx(f.x,f.y,f.z+18,{power:.55,damage:Math.round(damage),textScale:1});E.knockback(hero,f,30,0);if(f.hp<=0){f.alive=false;f.death=0;state.kills++;state.honor-=6;game.particles.bits(f.x,f.y,10,7,['#76674c','#bdab81']);game.audio.sfx('die',{vol:.25});state.activities.combat=true;save()}}
function nearestInteraction(){const opts=[];const add=(id,x,y,label,range=32)=>{const d=Math.hypot(hero.x-x,hero.y-y);if(d<range)opts.push({id,x,y,label,d})};
 for(const f of frontier?.interactions()||[])add(f.id,f.x,f.y,f.label,f.range||34);
 for(const n of npcs)add(n.id,n.x,n.y,'Speak to '+n.name);
 const l=world.locations;
 add('camp',l.camp.x,l.camp.y,'Rest & craft at camp',40);add('clue1',l.clue1.x,l.clue1.y,'Inspect broken wagon',38);add('clue2',l.clue2.x,l.clue2.y,'Inspect torn linen',38);
 add('doctor',doctor.x,doctor.y,state.stage===3?'Free Dr. Vale':'Speak to Dr. Vale');
 const boss=foes[0];if(boss.alive&&!boss.bound&&!state.negotiated)add('boone',boss.x,boss.y,'Speak to Boone',42);
 add('herb',l.herb.x,l.herb.y,'Gather wild yarrow');add('fishing',l.fishing.x,l.fishing.y,'Fish Stillwater',45);add('grave',l.grave.x,l.grave.y,'Read the headstone');add('mine',l.mine.x,l.mine.y,'Enter the silver mine',38);add('range',l.range.x,l.range.y,'Try the bottle challenge',30);
 for(const a of world.animals||[])if(!a.alive&&!state.collected.includes(a.id))add('animal:'+a.id,a.x,a.y,'Gather '+a.kind);
 for(const f of foes)if((!f.alive||f.bound)&&!state.collected.includes(f.id))add('loot:'+f.id,f.x,f.y,'Recover supplies');
 opts.sort((a,b)=>a.d-b.d);return opts[0]||null;
}
function updateHorse(dt){if(state.mounted){Object.assign(horse,{x:hero.x,y:hero.y,z:hero.z,vx:hero.vx,vy:hero.vy,facing:hero.facing});return}if(horse.called&&E.dist(hero,horse)>25){flow.update(hero.x,hero.y);const d=flow.dir(horse.x,horse.y,hero.x,hero.y);horse.vx=d[0]*105;horse.vy=d[1]*105;horse.facing=Math.atan2(d[1],d[0]);horse.update(dt,world.map)}else {horse.vx=horse.vy=0;horse.called=false}}
function updateAI(dt){
 let combat=false;
 for(const f of foes){if(!f.alive){f.death+=dt;if(motion){f.rig.mocap=motion.sample(motion.clip('Death01'),f.death);f.rig.mocapW=Math.min(1,f.death*8)}f.rig.update(dt,{x:f.x,y:f.y,z:f.z,facing:f.facing,down:Math.min(1,f.death*2),pose:'die'});continue}if(f.bound){const paired=hero.action&&hero.action.other===f?hero.action.otherState({facing:f.facing}):{x:f.x,y:f.y,z:f.z,facing:f.facing,pose:f.takedown?'down':'kneel',down:f.takedown?1:0};f.rig.update(dt,paired);continue}
 const peace=state.negotiated||state.stage<3||state.stage>=4;
 const seen=peace?false:E.sees(f,hero,{range:140,fov:1.8,map:world.map});const mode=f.mind.update(dt,seen,hero);
 if(noise&&!peace)f.mind.hear(E.hears(f,noise,world.map),noise);
 const dist=E.dist(f,hero);let dir=[0,0];
 if(mode==='alert'&&!peace){combat=true;f.facing=E.angleTo(f,hero);if(dist>90||Math.abs(f.z-hero.z)>E.HEIGHTS.level){flow.update(hero.x,hero.y);dir=flow.dir(f.x,f.y,hero.x,hero.y)}f.cool-=dt;
  if(f.cool<=0&&world.map.sight(f,hero)&&dist<220){if(f.wind===0){f.wind=.65;game.particles.text(f.x,f.y,45,'!','#f0ad65')}else{f.wind-=dt;if(f.wind<=0){const a=E.angleTo(f,hero);shots.burst({x:f.x+Math.cos(a)*12,y:f.y+Math.sin(a)*12,z:f.z+20,r:2,team:'enemy',dmg:11,color:'#dc8369',life:2.4},E.pattern.spread(a,f.leader?3:1,.12,150));game.audio.sfx('shoot',{vol:.15,pitch:.6});f.cool=f.leader?2.6:2;f.wind=0}}}
 }else if(mode==='search'&&f.mind.last&&!peace){flow.update(f.mind.last.x,f.mind.last.y);dir=flow.dir(f.x,f.y,f.mind.last.x,f.mind.last.y)}
 else {const tx=f.homeX+Math.sin(state.time*.16+f.homeY)*20,ty=f.homeY+Math.cos(state.time*.14+f.homeX)*16,dx=tx-f.x,dy=ty-f.y,len=Math.hypot(dx,dy);if(len>3)dir=[dx/len*.4,dy/len*.4]}
 const step=flow.next(f.x,f.y);f.update(dt,world.map,{move:dir,sprint:false,jumpPressed:mode==='alert'&&!!step&&['climb','jump'].includes(step.kind)&&step.edge<f.r+5});f.rig.update(dt,{...f.rigState(),point:mode==='alert',pose:f.wind>0?'guard':null});
 }
 if(state.rescued&&state.stage===4){const d=E.dist(doctor,hero);if(d>28){flow.update(hero.x,hero.y);const dir=flow.dir(doctor.x,doctor.y,hero.x,hero.y);doctor.update(dt,world.map,{move:dir,sprint:d>90});}else{doctor.vx=doctor.vy=0}if(d>240)once('doctorWait','Ada is falling behind','Wait at the bridge. The gold doctor marker shows where she is.');}
 doctor.rig.update(dt,{...doctor.rigState(),pose:state.rescued?null:'kneel'});
 for(const n of npcs){if(motion)n.rig.mocap=motion.sample(motion.clip(n.id==='hunter'?'Fixing_Kneeling':'Idle_Talking_Loop'),state.time*.55+n.x);n.rig.update(dt,{x:n.x,y:n.y,z:0,facing:n.facing,pose:n.pose});}
 for(const a of world.animals||[]){if(!a.alive)continue;const oldX=a.x,oldY=a.y;const dist=Math.hypot(a.x-hero.x,a.y-hero.y);a.phase=(a.phase||0)+dt;if(dist<80&&!hero.crouch){const ang=Math.atan2(a.y-hero.y,a.x-hero.x),nx=a.x+Math.cos(ang)*dt*48,ny=a.y+Math.sin(ang)*dt*48;if(world.map.standable(nx,ny,0,3)){a.x=nx;a.y=ny;a.facing=ang}}else if(dist>130){a.x=E.lerp(a.x,a.homeX,dt*.03);a.y=E.lerp(a.y,a.homeY,dt*.03)}a.vx=dt?(a.x-oldX)/dt:0;a.vy=dt?(a.y-oldY)/dt:0;if(a.rig)a.rig.update(dt,{walk:Math.min(1,Math.hypot(a.vx,a.vy)/48),look:[Math.cos(a.facing),Math.sin(a.facing)]});}
 music(combat?'danger':state.stage>=4?'home':'trail');
}
function update(dt){
 setBodyClass();if(photo){if(game.input.pressed('photo'))photoMode();if(game.input.pressed('interact')){photo=false;game.timeScale=1;game.setView(photoView)}return}
 if(ui.screen)return;
 if(campMenu){campMenu.update(dt);return}if(talk.update(dt)){ui.hud({});game.audio.duck(true);return}game.audio.duck(false);if(fishing){updateFishing(dt);hud();return}
 const I=game.input;
 if(I.pressed('map')){openMap();return}if(I.pressed('satchel')){openSatchel();return}if(I.pressed('photo')){photoMode();return}
 if(I.pressed('view')){game.nextView();notify('A different perspective',game.view.label||game.view.id)}
 if(I.pressed('focus')){state.focusOn=!state.focusOn&&state.focus>3;state.tracking=state.focusOn;state.activities.focus=true;game.audio.sfx('charge',{vol:.2,pitch:.5});}
 game.timeScale=state.focusOn?.34:1;const realDt=state.focusOn?dt/.34:dt;
 state.time+=dt;state.elapsed+=realDt;state.night=(state.time%480)>310;state.weather=game.settings.weather==='Rain'?'rain':game.settings.weather==='Clear'?'clear':Math.floor(state.time/90)%3===1?'rain':'clear';
 cooldown=Math.max(0,cooldown-dt);invulnerable=Math.max(0,invulnerable-dt);flashTrail=Math.max(0,flashTrail-dt);saveTimer+=dt;
 if(reloading>0){reloading-=dt;if(reloading<=0){const n=Math.min(6-state.ammo,state.reserve);state.ammo+=n;state.reserve-=n;game.audio.sfx('confirm',{vol:.25})}}
 if(lassoLine){lassoLine.t-=dt;if(lassoLine.t<=0)lassoLine=null}if(noise){noise.t-=dt;if(noise.t<=0)noise=null}
 if(I.pressed('dynamite'))frontier.throwDynamite();if(I.pressed('mount'))mount();if(I.pressed('care'))care();if(I.pressed('tonic'))drink();if(I.pressed('reload'))reload();if(I.pressed('lasso'))lasso();if(I.pressed('melee'))melee();if(I.pressed('dodge')&&!state.mounted){hero.dodge();state.stamina-=9}
 if(I.pressed('crouch')&&!state.mounted)hero.crouch=!hero.crouch;
 const [mx,my]=I.move(),[dx,dy]=game.view.screenDirToGround(mx,my);const run=(I.down('sprint')||state.autoSprint)&&(state.mounted?state.horseStamina:state.stamina)>3;
 hero.run=state.mounted?132:76;hero.sprintSpeed=state.mounted?190+state.bond*.2:120;
 hero.update(dt,world.map,{move:[dx,dy],sprint:run,crouch:hero.crouch,jumpPressed:I.pressed('jump')});hero.x=E.clamp(hero.x,28,world.map.w*16-28);hero.y=E.clamp(hero.y,28,world.map.h*16-28);
 if(hero.landed){game.particles.ring(hero.x,hero.y,2,16,'#c3ae7b',.35);game.audio.sfx('land',{vol:.16})}if(hero.hurt)hurt(12);if(hero.inHazard){hero.respawn();hurt(10)}
 const moving=Math.hypot(hero.vx,hero.vy)>10;
 state.stamina+=(!state.mounted&&run&&moving?-12:8)*realDt;state.horseStamina+=(state.mounted&&run&&moving?-8:4)*realDt;
 state.core-=realDt*.014;if(state.core>10&&invulnerable<=0)state.hp+=realDt*.45;state.focus+=state.focusOn?-realDt*13:realDt*2;if(state.focus<=0){state.focusOn=false;state.tracking=false;game.timeScale=1}
 frontier.update(dt);
 if(moving){dustTimer+=dt;if(dustTimer>(state.mounted?.15:.26)){dustTimer=0;game.particles.dust(hero.x,hero.y,0,state.mounted?3:1);game.audio.sfx(state.mounted?'hoof':'step',{vol:state.mounted?.25:.035,pitch:state.mounted?.5:.8})}}
 if(I.down('attack')&&!state.mounted)fire();else if(I.pressed('attack'))fire();
 combo.update(dt);combo.hits(foes.filter(f=>f.alive&&!f.bound),f=>E.inArc(hero,hero.facing,f,35,1.8,E.HEIGHTS.level),f=>enemyHit(f,23));
 shots.update(dt,world.map);shots.hit(foes,(b,f)=>enemyHit(f,b.dmg),'player');shots.hit([hero],b=>hurt(b.dmg),'enemy');
 shots.hit((world.animals||[]).filter(a=>a.alive),(b,a)=>{a.alive=false;game.particles.bits(a.x,a.y,5,5,['#a08759','#60513e']);notify('A clean harvest','Approach to gather the meat and pelt.');},'player');
 if(state.rangeActive)shots.hit(rangeTargets,(b,t)=>{t.alive=false;state.rangeScore++;game.particles.bits(t.x,t.y,t.z,12,['#799783','#c2d1ba']);game.audio.sfx('coin');if(state.rangeScore>=3){state.rangeActive=false;state.money+=5;state.activities.rangeWon=true;notify('Three for three','$5 won at the bottle range.');save()}},'player');
 updateHorse(dt);updateAI(dt);clampStats();
 if(motion){heroRig.mocap=reloading>0?motion.sample(motion.clip('Pistol_Reload'),1.4-reloading):null;heroRig.mocapMask='upper';heroRig.mocapW=reloading>0?Math.min(1,(1.4-reloading)*8,reloading*8):0;}
 heroRig.update(dt,{...hero.rigState(),vx:state.mounted?0:hero.vx,vy:state.mounted?0:hero.vy,pose:state.mounted?'kneel':hero.crouch?'crouch':null,point:cooldown>.1,attack:combo.state,hurt:invulnerable>.35});
 near=nearestInteraction();if(I.pressed('interact'))interact();
 for(const [name,p]of Object.entries(world.locations)){if(E.dist(hero,p)<65&&!state.discovered.includes(name)){state.discovered.push(name);if(['mine','fishing','grave'].includes(name))notify('A place worth remembering',{mine:'The old silver mine',fishing:'Stillwater bend',grave:'A lonely headstone'}[name]);}}
 if(saveTimer>45&&state.wanted===0&&!foes.some(f=>f.mind.state==='alert'))save();
 game.focus(hero.x,hero.y,18);hud();
}
function markers(){const q=quests[state.stage],at=q.at==='doctor'?doctor:world.locations[q.at];return [...(at?[{...at,kind:'diamond',color:'#edc77b'}]:[]),{x:horse.x,y:horse.y,kind:'dot',color:'#dadbc1'},...(state.rescued&&state.stage===4?[{x:doctor.x,y:doctor.y,kind:'ring',color:'#b5daa5'}]:[]),...(waypoint?[{...waypoint,kind:'cross',color:'#ffffff'}]:[])]}
function hud(){if(game.real-lastHud<.12&&!game.headless)return;lastHud=game.real;const q=quests[state.stage],at=q.at==='doctor'?doctor:world.locations[q.at];const danger=foes.some(f=>f.alive&&!f.bound&&f.mind.state==='alert');
 ui.hud({objective:{step:state.stage===5?'CINDER VALLEY':'CHAPTER I · '+String(Math.min(5,state.stage+1)).padStart(2,'0')+' / 05',title:q.title,text:q.text,at,from:hero},status:{text:state.wanted>0?'WANTED · LEAVE TOWN':danger?'UNDER FIRE':state.focusOn?'FOCUS':hero.crouch?'KEEPING LOW':state.mounted?'FLINT · '+Math.round(state.bond)+' BOND':'ON THE TRAIL',color:danger||state.wanted?'#e19a78':'#d7b97a'},bars:[{label:'Health',value:Math.round(state.hp),max:100,color:'#cba581'},{label:state.mounted?'Flint’s stamina':'Stamina',value:Math.round(state.mounted?state.horseStamina:state.stamina),max:100,color:'#a4b88b'},{label:'Focus',value:Math.round(state.focus),max:100,color:'#dbba6b'},{label:reloading>0?'Reloading…':'Revolver',value:state.ammo,max:6,kind:'pips',color:'#dfcbaa'}],counts:[['Cartridges',state.reserve],['Purse','$'+state.money]],prompt:fishing?{act:'interact',label:fishing.phase==='waiting'?'Wait for a bite…':'Reel in the gold band',hint:'STILLWATER FISHING'}:near?{act:'interact',label:near.label,hint:'ON THE TRAIL'}:null,place:state.weather==='rain'?'Rain over Cinder Valley':state.night?'Nightfall · Cinder Valley':'Cinder Valley · Late afternoon',keys:[[game.input.label('interact'),'Interact'],[game.input.label('mount'),'Horse'],[game.input.label('focus'),'Focus'],[game.input.label('map'),'Map'],[game.input.label('pause'),'Pause']],buttons:[['Map',openMap],['Satchel',openSatchel],['Tactics',openTactics]],minimap:{map:world.map,at:hero,markers:markers(),onClick:openMap}});
 game.input.touchSet('interact',fishing?'REEL':near?'USE':'TALK',!!near||!!fishing);game.input.touchSet('focus','FOCUS',true);game.input.touchSet('attack','FIRE',true);game.input.touchSet('jump','JUMP',!state.mounted);
}
function draw(r){
 W.draw(r,game,world,state);frontier?.draw(r);
 if(state.focusOn||flashTrail>0){r.decal(g=>{const path=[[530,540],[600,556],[665,556],[720,450],[835,388],[980,330]];for(let i=0;i<path.length-1;i++){const [ax,ay]=path[i],[bx,by]=path[i+1],d=Math.hypot(bx-ax,by-ay);for(let t=0;t<1;t+=14/d){const x=E.lerp(ax,bx,t),y=E.lerp(ay,by,t),p=r.w(x,y,1);E.px.ell(g,p[0],p[1],2,1,'#f3dca2')}}});}
 const liveActors=[...npcs,{...doctor,rig:doctor.rig},...foes];
 for(const n of liveActors){if(!r.visible(n.x,n.y,n.z||0,60,80,60))continue;r.shadow(n.x,n.y,6,.32);W.drawCowboy(r,E,n,n.rig,{xray:false,every:n.id&&npcs.includes(n)?2:1,key:n.rig});if(n.bound)r.textAt(n.x,n.y,40,'BOUND','#dcca9e');if(n.mind&&n.alive&&!n.bound&&state.stage===3&&!state.negotiated&&(state.focusOn||hero.crouch))r.sightCone(n,{map:world.map,range:140,fov:1.8,color:n.mind.state==='alert'?'#bc6044':'#caa660',alpha:.12});}
 W.drawHorse(r,E,horse,{mounted:state.mounted,bond:state.bond,t:state.time});
 r.shadow(hero.x,hero.y,state.mounted?13:7,.38,undefined,hero.groundZ||0);W.drawCowboy(r,E,hero,heroRig,{mounted:state.mounted,xray:{color:'#e2cf94',outline:'#f2e4b9',actors:true},flash:invulnerable>.35?'#eee4c7':undefined,ghost:state.focusOn&&Math.hypot(hero.vx,hero.vy)>10&&Math.floor(game.time*15)!==hero.lastGhostFrame?(hero.lastGhostFrame=Math.floor(game.time*15),{color:'#d1b273',life:.15,alpha:.2,owner:hero}):undefined});heroRig.drawSmear(r);
 const q=quests[state.stage],at=q.at==='doctor'?doctor:world.locations[q.at];if(game.settings.hints&&at)r.marker(at.x,at.y,50,{label:state.stage===4?'HOME':state.stage===3?'ADA':'TRAIL',color:'#f2d28f'});if(waypoint)r.marker(waypoint.x,waypoint.y,35,{label:'WAYPOINT',color:'#edead9'});
 if(state.rescued&&state.stage===4)r.marker(doctor.x,doctor.y,48,{label:'ADA',color:'#bfd9a6'});
 if(near&&!fishing)r.groundRing(near.x,near.y,16,'#e5c183',.5);
 for(const t of rangeTargets)if(t.alive){r.prop('crate',t.x,t.y,0,{size:.65});r.queue(t.x,t.y,t.z,g=>{const p=r.w(t.x,t.y,t.z);E.px.rect(g,p[0]-2,p[1]-9,4,9,'#518572');E.px.rect(g,p[0]-1,p[1]-12,2,4,'#c4caa3')})}
 if(state.stage<=2)r.sprite(world.locations.clue2.x,world.locations.clue2.y,8+Math.sin(state.time*2),linen,{glow:state.focusOn?1:0});
 if(!state.collected.includes('herb')&&(state.focusOn||E.dist(hero,world.locations.herb)<150))r.marker(world.locations.herb.x,world.locations.herb.y,15,{label:'YARROW',color:'#d8c56a'});
 if(lassoLine)r.queue(hero.x,hero.y,15,g=>{const a=r.w(hero.x,hero.y,18),b=r.w(lassoLine.x,lassoLine.y,lassoLine.z);E.px.line(g,a[0],a[1],b[0],b[1],'#caba85',1)});
 for(const a of world.animals||[])if(!a.alive&&!state.collected.includes(a.id)){r.sprite(a.x,a.y,2,gameSpoils);r.marker(a.x,a.y,20,{label:'GAME',color:'#daca9a'});}
 shots.draw(r);game.lights.enabled=true;game.lights.ambient=state.night?.42:.9;game.lights.add(hero.x,hero.y,28,85,.4,{color:'#ecc481'});game.lights.caster(hero.x,hero.y,6,hero.z+37);game.lights.heat(world.locations.camp.x+10,world.locations.camp.y+24,8,28);
 if(state.weather==='rain')r.overlay(g=>{for(let i=0;i<75;i++){const x=(i*83+state.time*23)%r.W,y=(i*59+state.time*260)%r.H;E.px.line(g,x,y,x-3,y+9,'#95a79e',1)}});
 if(fishing)r.overlay(g=>{const w=Math.min(180,r.W-40),x=(r.W-w)/2,y=r.H*.43;E.ui.box(g,x-10,y-25,w+20,53,{bg:'#202920',border:'#bfa775'});E.font.text(g,fishing.phase==='waiting'?'WAIT FOR A BITE':'REEL IN THE GOLD',r.W/2,y-16,'#e9d7ae',{align:'center'});E.px.rect(g,x,y,w,7,'#3c463b');if(fishing.phase==='reel'){E.px.rect(g,x+w*.28,y,w*.46,7,'#b69754');const pos=(Math.sin(fishing.t*3.5)+1)/2;E.px.rect(g,x+pos*w-1,y-3,3,13,'#f6f0d5')}});
 if(campMenu)campMenu.draw(r);talk.draw(r);
 if(photo)r.text('PHOTO MODE / '+game.input.label('interact').toUpperCase()+' TO RETURN',r.W/2,r.H-20,'#f0e7ce',{align:'center'});
}
const title={enter(){titleScreen()},update(dt){state.time+=dt;heroRig.update(dt,{x:hero.x,y:hero.y,z:0,facing:-.8});if(game.input.pressed('start')&&ui.screen==='title')begin(getSave())},draw(r){W.draw(r,game,world,state)}};
const play={pausable:true,res:[480,300],expand:true,views:['threequarter','iso','topdown','brawler','overhead'],view:'threequarter',input:bindings,touch:['interact','attack','jump','focus'],camera:{zoom:[.7,1.65],start:1,tall:1},enter(){ui.hide();lastHud=-1;musicName='';music(state.stage>=4?'home':'trail');game.cam.offset=[0,0];game.cam.bounds=v=>world.map.bounds(v);game.follow(hero,{z:18,lead:9});game.particles.ground=(x,y,z)=>world.map.groundAt(x,y,2,z);game.timeScale=1;game.every(14,()=>{game.audio.sfx({wave:'sine',freq:1450,to:2100,dur:.12,vol:.03,arp:[0,5,-2],step:.055});});setBodyClass()},update,draw};
const end={enter(){results()},update(){},draw};
const dead={enter(){ui.hud({});ui.tutorial(null);state.deaths++;ui.show('results',{kicker:'The trail is not finished',title:'Dust to dust.',text:'You fell, but your last checkpoint is safe.',actions:[['Return to checkpoint',()=>{const s=checkpoint||getSave();const deaths=state.deaths;reset(s);state.deaths=deaths;state.hp=100;hero.play('getUp');ui.hide();game.go('play')}],['Return to title',()=>{ui.hide();game.go('title')}]]})},update(){},draw};
function boot(){world=W.build(E);flow=new E.FlowField(world.map,{climb:48,drop:48,jump:45});spatial=new E.SpatialHash(48);reset();game.cam.bounds=v=>world.map.bounds(v);game.focus(220,675,18);
 mine=WesternMine.create(E,game,{rig:heroRig,onExit:reward=>{if(reward){state.money+=reward.silver||0;state.tonics+=reward.medicine||0;state.mineBreached=reward.breached;state.mineBonus=reward.bonus;if(reward.completed&&!state.activities.mine){state.activities.mine=true;state.log.push('Recovered silver and field dressings from the old mine.')}}save();game.go('play')},onHurt:amount=>{state.hp-=amount*({Story:.45,Standard:1,Hard:1.4}[game.settings.difficulty]||1);if(state.hp<=0)defeated()},onToast:notify});
 scenes.mine=mine.scene||mine;frontier=WesternFrontier.create(E,game,{get state(){return state},get hero(){return hero},get world(){return world},get foes(){return foes},ui,notify,hurt,save,enemyHit});
 game.audio.define('revolver',[{wave:'noise',freq:170,to:45,dur:.16,vol:.3},{wave:'sine',freq:80,to:30,dur:.2,vol:.18}]);
 game.audio.define('hoof',{wave:'noise',freq:150,to:60,dur:.055,vol:.09});
 if(typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches){game.enableGPU({map:world.map});}
}
game.debug={snapshot:()=>({scene:game.sceneName,hero:hero?[hero.x,hero.y,hero.z]:null,state:state?JSON.parse(JSON.stringify(state)):null,foes:foes.map(f=>({id:f.id,hp:f.hp,alive:f.alive,bound:f.bound,mind:f.mind.state,x:f.x,y:f.y})),doctor:doctor?{x:doctor.x,y:doctor.y}:null,horse:horse?{x:horse.x,y:horse.y}:null,near:near?.id,dialog:!!talk.open,errors:game.errors,engine:E.version,gpu:game.gpu?.status(),mine:mine?.debug?.snapshot?.()}),
 teleport(x,y,z=0){Object.assign(hero,{x,y,z,vx:0,vy:0,vz:0,onGround:true,action:null});game.focus(x,y,z+18);near=nearestInteraction()},interact,begin,save,openMap,openSatchel,fire,lasso,care,mount,drink,complete,enemyHit,help,photoMode,
 get state(){return state},get hero(){return hero},get world(){return world},get foes(){return foes},get doctor(){return doctor},get horse(){return horse},get talk(){return talk},get ui(){return ui},get mine(){return mine},get frontier(){return frontier},get shots(){return shots},get fishing(){return fishing},get campMenu(){return campMenu},get checkpoint(){return checkpoint},setHealth(v){state.hp=v},hurt,reset,rangeTargets};
game.stateHash=()=>state?[hero.x,hero.y,state.hp,state.stage,state.ammo,state.honor]:[];
globalThis.dustGame=game;
const scenes={title,play,end,dead};
game.start({scenes,scene:'title',boot:{title:'DUST & MERCY',version:'1.0',steps:[['Tracing the river through Cinder Valley',boot]],messages:['Saddling Flint','Lighting the last lantern','Remembering the road home']}});
})();
