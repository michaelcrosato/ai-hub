/* Foldlight game rules. No DOM dependency. Pure calculations are also used by the tests. */
(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clone=o=>JSON.parse(JSON.stringify(o));
const CHARMS={
  heart:{name:'Stout Heart',cost:2,symbol:'♥',description:'Add 4 Heart while equipped.'},
  stitch:{name:'Quick Stitch',cost:1,symbol:'✧',description:'A good guard blocks 1 more damage.'},
  spring:{name:'Spring Heel',cost:2,symbol:'↟',description:'Vault deals 1 more damage on good or perfect timing.'},
  wick:{name:'Bright Wick',cost:1,symbol:'✦',description:'Lantern Flare costs 1 less Glow.'}
};
const FOES={
  thistle:{name:'Thistle Scout',hp:9,attack:3,defense:0,trait:'Ground',tip:'A restless bundle of leaves. Vault and Crease both work well.',kind:'thistle'},
  thorn:{name:'Bramble Guard',hp:12,attack:4,defense:1,trait:'Spiked · Armored',tip:'Its thorns hurt a Vault attack. Crease ignores armor. Lumi can strike it safely.',kind:'thorn',spiked:true},
  wing:{name:'Crinklewing',hp:10,attack:3,defense:0,trait:'Flying',tip:'Crease cannot reach it. Use Vault, Glow Dart, or Lantern Flare.',kind:'wing',flying:true},
  ink:{name:'Inkcap',hp:13,attack:4,defense:1,trait:'Armored',tip:'A cap of dried ink protects it. Crease ignores that armor.',kind:'ink'},
  bell:{name:'The Bellkeeper',hp:48,attack:4,defense:1,trait:'Guarded heart',tip:'Lantern Flare breaks the shadow ward. At half Heart, it attacks harder. Its charged echo deals 7 damage unless Lumi breaks the ward.',kind:'bell',boss:true}
};
const ENCOUNTERS={
  scout:{name:'A rustle in the leaves',foes:['thistle'],coins:8,xp:12,flag:'scout'},
  river:{name:'Trouble at Threadwater',foes:['wing','thorn'],coins:15,xp:18,flag:'river',charm:'spring'},
  mill:{name:'Ink in the gears',foes:['ink','wing'],coins:18,xp:22,flag:'mill'},
  boss:{name:'The last note of the bell',foes:['bell'],coins:30,xp:40,flag:'boss'}
};
const ROOMS=[
  {name:'Lantern Reach',width:2100,art:'forest',subtitle:'A path under paper stars'},
  {name:'Threadwater',width:1940,art:'river',subtitle:'Light remembers the way'},
  {name:'The Paper Mill',width:1960,art:'mill',subtitle:'Sun. Leaf. Moon.'},
  {name:'The Hollow Belfry',width:1280,art:'bell',subtitle:'Every quiet thing has a song'}
];
const LETTERS=[
 {id:0,title:'A seat by the window',from:'Tavi, at the far post',to:'Elian, Lantern Reach',stamp:'A folded leaf',text:'I kept the seat by the window. The kettle still takes too long. Your cup is still the blue one. When the bell calls, take the river path. There is room for you here.'},
 {id:1,title:'The boat that came back',from:'Nell, the boat maker',to:'Pip, beyond Threadwater',stamp:'Three blue waves',text:'Your little boat came back today. The rain softened its bow, but the fold held. I put a new sail on it. I will send it east at dawn. Some things can leave and still return.'},
 {id:2,title:'One last sheet',from:'The mill crew',to:'Orrin, at the post house',stamp:'Sun, leaf, moon',text:'We saved one good sheet before the mill fell quiet. Use it for a letter that matters. When the lanterns wake, we will come back to work. Please keep the door open.'}
];
const DELIVERY={title:'A letter for the keeper',from:'The travelers of Lanternwood',to:'The Bellkeeper',text:'Dear keeper, we did not leave to forget you. We carried your song with us. Now we are ready to come home. If the river is dark, ring the bell. We will hear it. We will follow. With love, the travelers of Lanternwood.'};
const LORE=[
 {pages:[['Postbox card','Last collection: when the bell rings. Letters to friends are welcome. Letters to yourself are welcome too.'],['Mica','I should write one of those. After the round.']]},
 {pages:[['Boat maker’s note','A good fold can carry a small hope across a wide river. Keep the point above the water.'],['Lumi','The path is folded too. Its rune is farther east.']]},
 {pages:[['Old bell program','The homeward concert. One bell. Every voice welcome. Seats are free.'],['Lumi','They left a place for the keeper in the front row.']]}
];
const CREATURE_LORE={thistle:'It collects leaves to mend its coat. The quiet forest made it restless.',thorn:'It guards the river bank with a wall of folded thorns. Light passes through the gaps.',wing:'It learned to fly from a lost page. Its wings make a soft paper sound.',ink:'It grew under a dry ink pot. The mill can wash the old color from its cap.',bell:'It kept the route lit for years. Under the ward, it still remembers every voice.'};
const ACTIONS={
 vault:{name:'Vault',symbol:'↟',actor:'mica',cost:0,type:'tap',description:'Jump · 3–5 damage'},
 crease:{name:'Crease',symbol:'⌁',actor:'mica',cost:0,type:'hold',description:'Ignore armor · 3–6 damage'},
 treat:{name:'Berry Treat',symbol:'♥',actor:'both',cost:0,type:'instant',description:'Restore 8 Heart'},
 focus:{name:'Focus',symbol:'✧',actor:'mica',cost:0,type:'instant',description:'Restore 3 Glow'},
 encore:{name:'Encore',symbol:'★',actor:'mica',cost:0,type:'instant',description:'5 Ovation · heal + strike'},
 dart:{name:'Glow Dart',symbol:'✦',actor:'lumi',cost:0,type:'tap',description:'Light · 2–4 damage'},
 flare:{name:'Lantern Flare',symbol:'☼',actor:'lumi',cost:3,type:'tap',description:'All foes · breaks wards'},
 mend:{name:'Mend',symbol:'♡',actor:'lumi',cost:2,type:'instant',description:'Restore 6 Heart'},
 cheer:{name:'Cheer',symbol:'♪',actor:'lumi',cost:0,type:'instant',description:'Gain 2 Ovation'}
};
function fresh(){return{version:1,room:0,x:180,y:0,hp:20,baseHp:20,fp:9,maxFp:9,coins:0,xp:0,rank:1,bp:3,charms:['heart','stitch'],equipped:['stitch'],treats:3,flags:{},letters:[],puzzle:[],seconds:0,battles:0,perfects:0,guards:0,falls:0,seen:[0],complete:false};}
function maxHp(s){return s.baseHp+(s.equipped.includes('heart')?4:0);}
function usedBp(s){return s.equipped.reduce((n,k)=>n+(CHARMS[k]?.cost||0),0);}
function equip(s,id){if(!s.charms.includes(id)||!CHARMS[id])return false;const at=s.equipped.indexOf(id);if(at>=0)s.equipped.splice(at,1);else{if(usedBp(s)+CHARMS[id].cost>s.bp)return false;s.equipped.push(id);}s.hp=Math.min(s.hp,maxHp(s));return true;}
function sanitize(raw){
 if(!raw||raw.version!==1||!Number.isFinite(raw.room)||!Number.isFinite(raw.hp))return null;
 const s=fresh(); const num=(key,min,max)=>{if(Number.isFinite(raw[key]))s[key]=clamp(raw[key],min,max);};
 num('room',0,3);s.room=Math.floor(s.room);num('x',40,ROOMS[s.room].width-40);num('y',-55,65);num('baseHp',20,40);num('hp',1,44);num('maxFp',9,18);num('fp',0,s.maxFp);num('coins',0,999);num('xp',0,999);num('rank',1,2);num('bp',3,4);num('treats',0,99);num('seconds',0,999999);num('battles',0,99);num('perfects',0,999);num('guards',0,999);num('falls',0,999);
 s.charms=[...new Set((Array.isArray(raw.charms)?raw.charms:s.charms).filter(k=>CHARMS[k]))];
 s.equipped=[];for(const id of(Array.isArray(raw.equipped)?raw.equipped:[])){if(s.charms.includes(id)&&!s.equipped.includes(id)&&usedBp(s)+CHARMS[id].cost<=s.bp)s.equipped.push(id);}
 s.hp=Math.min(s.hp,maxHp(s));
 for(const k of ['intro','scout','bridge','path','river','mill','puzzle','boss','secret','chest','letterReward','metOrrin','bossSeen','battleLesson','returnedLetters'])if(raw.flags?.[k]===true)s.flags[k]=true;
 s.letters=[...new Set((Array.isArray(raw.letters)?raw.letters:[]).filter(n=>[0,1,2].includes(n)))];
 s.puzzle=s.flags.puzzle?[1,2,0]:(Array.isArray(raw.puzzle)&&raw.puzzle.every((n,i)=>n===[1,2,0][i])?raw.puzzle.slice(0,2):[]);
 s.seen=[...new Set([0,...(Array.isArray(raw.seen)?raw.seen:[]).filter(n=>[0,1,2,3].includes(n))])];
 s.complete=raw.complete===true&&s.flags.boss===true;
 return s;
}
function canExit(s,r=s.room){return r===0?!!(s.flags.bridge&&s.flags.scout):r===1?!!(s.flags.path&&s.flags.river):r===2?!!(s.flags.puzzle&&s.flags.mill):false;}
function objective(s){if(s.complete)return'The bell sings again. The forest is safe.';if(s.flags.boss)return'Ring the bell with E to restore the Lanternwood.';if(s.room===3)return'Face the Bellkeeper. Use Lumi to break its ward.';if(s.room===2)return !s.flags.puzzle?'Light the mill seals: sun, leaf, then moon.':!s.flags.mill?'Clear the ink from the mill.':'Go east to the Hollow Belfry.';if(s.room===1)return !s.flags.path?'Use Lumi near the river rune to reveal the path.':!s.flags.river?'Clear the creatures near the far bank.':'Follow the river path to the paper mill.';return !s.flags.scout?'Follow the path east. Clear the restless leaves.':!s.flags.bridge?'Use Lumi near the folded bridge.':'Cross the bridge and follow the lanterns east.';}
function lightSeal(s,i){if(s.flags.puzzle)return'done';const order=[1,2,0];if(i===order[s.puzzle.length]){s.puzzle.push(i);if(s.puzzle.length===3){s.flags.puzzle=true;return'solved';}return'correct';}s.puzzle=[];return'reset';}
function grow(s,choice){if(s.rank>=2||s.xp<30)return false;s.rank=2;if(choice==='heart')s.baseHp+=4;else if(choice==='glow')s.maxFp+=3;else if(choice==='charm')s.bp+=1;else{s.rank=1;return false;}s.hp=maxHp(s);s.fp=s.maxFp;return true;}
function cost(s,id){return Math.max(0,ACTIONS[id].cost-(id==='flare'&&s.equipped.includes('wick')?1:0));}
function allowed(s,b,id){const a=ACTIONS[id];if(!a)return false;if(a.actor!=='both'&&a.actor!==b.actor)return false;if(cost(s,id)>s.fp)return false;if(id==='treat'&&s.treats<=0)return false;if(id==='encore'&&b.ovation<5)return false;return true;}
function actionsFor(actor){return actor==='mica'?['vault','crease','treat','focus','encore']:['dart','flare','mend','cheer','treat'];}
function encounter(id,first=false){const spec=ENCOUNTERS[id];const b={id,name:spec.name,actor:'mica',round:1,ovation:0,foes:spec.foes.map((k,i)=>({...clone(FOES[k]),id:i,maxHp:FOES[k].hp,ward:k==='bell',charge:false,phase:1})),target:0,first};if(first)b.foes[0].hp=Math.max(1,b.foes[0].hp-2);return b;}
function timing(elapsed,settings={}){const error=Math.abs(elapsed-.9);const width=settings.timing==='wide'?.25:.16;if(settings.timing==='auto')return 2;return error<=.07?2:error<=width?1:0;}
function applyAction(s,b,id,target,quality){
 if(!allowed(s,b,id))return{ok:false,text:'That action is not ready.',hits:[]};
 s.fp-=cost(s,id);const q=clamp(quality,0,2),out={ok:true,hits:[],heal:0,quality:q,text:q===2?'Perfect!':q===1?'Nicely done!':'A little off beat.'};
 if(id==='treat'){s.treats--;out.heal=Math.min(8,maxHp(s)-s.hp);s.hp+=out.heal;out.text=`A berry treat restores ${out.heal} Heart.`;return out;}
 if(id==='focus'){const n=Math.min(3,s.maxFp-s.fp);s.fp+=n;b.ovation=clamp(b.ovation+1,0,5);out.text=`A quiet breath. +${n} Glow.`;return out;}
 if(id==='mend'){out.heal=Math.min(6,maxHp(s)-s.hp);s.hp+=out.heal;out.text=`Lumi mends ${out.heal} Heart.`;return out;}
 if(id==='cheer'){b.ovation=clamp(b.ovation+2,0,5);out.text='The forest joins in. +2 Ovation.';return out;}
 if(id==='encore'){b.ovation=0;const hpBefore=s.hp,fpBefore=s.fp;s.hp=Math.min(maxHp(s),s.hp+5);s.fp=Math.min(s.maxFp,s.fp+3);out.heal=s.hp-hpBefore;out.text=`One more song! +${out.heal} Heart, +${s.fp-fpBefore} Glow.`;}
 else{b.ovation=clamp(b.ovation+(q===2?2:q===1?1:0),0,5);if(q===2)s.perfects++;}
 const targets=(id==='flare'||id==='encore')?b.foes.filter(f=>f.hp>0):[b.foes[target]].filter(f=>f&&f.hp>0);
 for(const f of targets){let n=id==='vault'?3+q:id==='crease'?3+Math.ceil(q*1.5):id==='dart'?2+q:id==='flare'?3+q:4;let note='';
  if(id==='vault'&&q>0&&s.equipped.includes('spring'))n++;
  if(id==='crease'&&f.flying){n=0;note='Too high! Use Vault or Lumi.';}
  else if(id==='vault'&&f.spiked){n=0;s.hp=Math.max(0,s.hp-1);note='Thorns! Use Crease or Lumi.';}
  else{if(id!=='crease'&&id!=='flare'&&id!=='encore')n=Math.max(1,n-f.defense);if(f.ward&&id!=='flare'&&id!=='encore'){n=1;note='A shadow ward. Lumi can break it.';}}
  if(id==='flare'){f.ward=false;f.charge=false;note=f.boss?'The shadow ward breaks!':'';}
  f.hp=Math.max(0,f.hp-n);out.hits.push({target:f.id,damage:n});if(note)out.text=note;
 }
 return out;
}
function enemyIntent(f,b){if(f.hp<=0)return'Quiet';if(f.boss){if(f.charge)return'Echo burst · 7 damage';return f.phase===2?'Heavy toll · 5 damage':'Bell toll · 4 damage';}return`Attack · ${f.attack} damage`;}
function enemyHit(s,b,index,quality){const f=b.foes[index];if(!f||f.hp<=0)return{damage:0,perfect:false};let n=f.boss?(f.charge?7:f.phase===2?5:4):f.attack;const perfect=quality===2;
 if(perfect){n=0;f.hp=Math.max(0,f.hp-1);s.guards++;b.ovation=clamp(b.ovation+1,0,5);}else if(quality===1)n=Math.max(0,n-2-(s.equipped.includes('stitch')?1:0));
 s.hp=Math.max(0,s.hp-n);return{damage:n,perfect};}
function nextRound(b){b.round++;b.actor='mica';for(const f of b.foes){if(f.boss&&f.hp>0){f.phase=f.hp<=f.maxHp/2?2:1;f.attack=f.phase===2?5:4;f.charge=b.round%3===0;f.ward=f.charge;}}}
function reward(s,b){const r=ENCOUNTERS[b.id];if(s.flags[r.flag])return false;s.flags[r.flag]=true;s.coins+=r.coins;s.xp+=r.xp;s.battles++;s.fp=Math.min(s.maxFp,s.fp+2);if(r.charm&&!s.charms.includes(r.charm))s.charms.push(r.charm);return true;}
const api={LETTERS,DELIVERY,LORE,CREATURE_LORE,CHARMS,FOES,ENCOUNTERS,ROOMS,ACTIONS,fresh,sanitize,maxHp,usedBp,equip,canExit,objective,lightSeal,grow,cost,allowed,actionsFor,encounter,timing,applyAction,enemyIntent,enemyHit,nextRound,reward,clone,clamp};
root.FoldlightRules=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
