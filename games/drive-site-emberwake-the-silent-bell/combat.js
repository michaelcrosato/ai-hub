/* Deterministic turn rules. Rendering and timing are kept in game.js. */
(function(root){
'use strict';
const A=root.EW=root.EW||{};
const copy=x=>JSON.parse(JSON.stringify(x));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
A.combos=[
 {id:'cinder',name:'Cinder Step',seq:'113',bonus:30,break:2,move:'roundhouse',effect:'A fast kick. Break +2.',unlock:0},
 {id:'bell',name:'Bellbreaker',seq:'123',bonus:44,break:3,move:'uppercut',effect:'A rising strike. Break +3.',unlock:0},
 {id:'tide',name:'Still Water',seq:'221',bonus:25,break:1,move:'sweep',effect:'Restore 8 EP.',unlock:0,ep:8},
 {id:'dawn',name:'Dawn Thread',seq:'1122',bonus:54,break:3,move:'roundhouse',effect:'Learned after the first battle.',unlock:1}
];
const baseDamage={1:12,2:21,3:33};
const makeEnemy=(id,name,hp,poise,type,atk)=>({id,name,hp,max:hp,poise,maxPoise:poise,type,atk,guard:false,stagger:false,counter:0});
class Battle {
 constructor(kind,state){
  this.kind=kind;this.scenario=kind;this.round=1;this.turn=0;this.target=0;this.seq=[];this.result=null;this.damageDone=0;this.turns=0;this.finishes=0;this.breaks=0;this.events=[];this.inventory=copy(state.inventory);this.flags=copy(state.flags);this.difficulty=state.settings.difficulty||'standard';this.learned=state.flags.quayBattle?1:0;
  if(kind==='gear'){
   const spec=state.module||'balanced',max=spec==='aegis'?680:600;
   this.kind='gear';this.party=[{id:'morrow',name:'Morrow',hp:clamp(state.gear.hp??max,0,max),max,ep:0,maxEp:0,guard:false,reserve:0}];
   this.enemies=[makeEnemy('cantor','The Cantor',1160,14,'cantor',54)];
   this.fuel=clamp(state.gear.fuel,0,100);this.heat=0;this.drive=0;this.boost=false;this.phase=1;this.module=spec;this.repairs=2;
  }else{
   this.kind='human';this.party=[
    {id:'mira',name:'Mira',hp:state.party.mira.hp,max:state.party.mira.max,ep:state.party.mira.ep,maxEp:state.party.mira.maxEp,atk:1,guard:false,reserve:0},
    {id:'oren',name:'Oren',hp:state.party.oren.hp,max:state.party.oren.max,ep:state.party.oren.ep,maxEp:state.party.oren.maxEp,atk:.90,guard:false,reserve:0}
   ];
   this.enemies=kind==='quay'?[makeEnemy('warden','Ash Warden',420,14,'warden',26)]:[makeEnemy('warden','Bell Warden',430,16,'warden',33),makeEnemy('drone','Choir Drone',260,10,'drone',25)];
  }
  this.turn=this.party.findIndex(p=>p.hp>0);if(this.turn<0){this.turn=0;this.result='defeat';}
  this.ap=6+this.actor.reserve;
 }
 get actor(){return this.party[this.turn];}
 get livingEnemies(){return this.enemies.filter(e=>e.hp>0);}
 get livingParty(){return this.party.filter(e=>e.hp>0);}
 get spent(){return this.seq.reduce((s,n)=>s+n,0);}
 get combo(){return A.combos.find(c=>c.seq===this.seq.join('')&&c.unlock<=this.learned)||null;}
 get intent(){
  return this.enemies.filter(e=>e.hp>0).map(e=>({id:e.id,...this.enemyIntent(e)}));
 }
 enemyIntent(e){
  const c=e.counter%3;
  if(this.kind==='gear'){
   if(c===0)return {name:this.phase===1?'Iron hymn':'Shattered hymn',damage:this.phase===1?54:69,type:'strike',target:'morrow',hint:'Single heavy strike'};
   if(c===1)return {name:'Gathering resonance',damage:0,type:'charge',target:'morrow',hint:'Bellfall follows. Brace next turn.'};
   return {name:'BELLFALL',damage:this.phase===1?138:174,type:'heavy',target:'morrow',hint:'Brace to reduce this attack.'};
  }
  const target=this.livingParty[(this.round+(e.type==='drone'?1:0))%Math.max(1,this.livingParty.length)]?.id||'mira';
  if(c===1&&e.type==='warden')return {name:'Gathering force',damage:0,type:'charge',target,hint:'A heavy strike follows.'};
  if(c===2&&e.type==='warden')return {name:'Iron fall',damage:e.atk*2,type:'heavy',target,hint:'Guard or break this attack.'};
  return {name:e.type==='drone'?'Needle beam':'Hammer palm',damage:e.atk,type:'strike',target,hint:'Targets '+(target==='mira'?'Mira':'Oren')};
 }
 queue(n){
  if(this.result||this.kind!=='human'||![1,2,3].includes(n)||this.spent+n>this.ap||this.seq.length>=9)return false;
  this.seq.push(n);return true;
 }
 undo(){if(this.seq.length){this.seq.pop();return true;}return false;}
 select(i){if(Number.isInteger(i)&&this.enemies[i]&&this.enemies[i].hp>0){this.target=i;return true;}return false;}
 preview(){
  if(this.kind!=='human')return '';
  if(!this.seq.length)return 'Build a sequence. Unused AP become Reserve.';
  const c=this.combo,d=Math.round((this.seq.reduce((s,n)=>s+baseDamage[n],0)+(c?c.bonus:0))*this.actor.atk);
  return (c?c.name:'Attack sequence')+' · about '+d+' damage'+(this.ap>this.spent?' · reserve '+Math.min(3,this.ap-this.spent):'');
 }
 event(type,details={}){this.events.push({type,...details});}
 damage(from,target,amount,move,name,poise=0,extra={}){
  if(target.hp<=0)return;
  let value=Math.round(amount*(target.guard?.36:1)*(target.stagger?1.28:1));
  if(this.party.includes(target)&&this.difficulty==='story')value=Math.round(value*.62);
  value=Math.max(1,value);target.hp=clamp(target.hp-value,0,target.max);
  this.event('hit',{from,to:target.id,amount:value,hp:target.hp,move,name,...extra});
  if(this.enemies.includes(target)){
   this.damageDone+=value;
   if(poise&&!target.stagger&&target.hp>0){
    target.poise=Math.max(0,target.poise-poise);
    if(target.poise===0){target.stagger=true;this.breaks++;this.event('break',{to:target.id,name:'Guard broken'});}
   }
   if(target.hp<=0)this.event('down',{to:target.id});
  }else if(target.hp<=0)this.event('down',{to:target.id});
 }
 heal(from,p,amount,name){if(p.hp>=p.max)return;const before=p.hp;p.hp=clamp(p.hp+amount,0,p.max);this.event('heal',{from,to:p.id,amount:p.hp-before,hp:p.hp,name});}
 command(cmd){
  if(this.result)return {ok:false,reason:'The battle has ended.'};
  if(this.kind==='gear')return this.gearCommand(cmd);
  const a=this.actor,t=this.enemies[this.target]&&this.enemies[this.target].hp>0?this.enemies[this.target]:this.livingEnemies[0];
  if(cmd==='attack'&&!this.seq.length)return {ok:false,reason:'Choose one or more strikes first.'};
  if(cmd==='skill'&&a.ep<12)return {ok:false,reason:'This skill needs 12 EP. Guard restores 8 EP.'};
  if(cmd==='item'&&this.party.every(p=>p.hp>=p.max))return {ok:false,reason:'The party is already at full health.'};
  if(cmd==='item'&&this.inventory.kits<=0)return {ok:false,reason:'No field kits remain.'};
  if(!['attack','guard','skill','item'].includes(cmd))return {ok:false,reason:'Unknown action.'};
  this.events=[];a.guard=false;this.turns++;
  if(cmd==='attack'){
   const combo=this.combo;
   this.event('sequence',{from:a.id,to:t.id,name:combo?combo.name:'Attack sequence',seq:this.seq.slice()});
   for(const n of this.seq)this.damage(a.id,t,baseDamage[n]*a.atk,n===1?'jab':n===2?'cross':'kick',n===1?'Jab':n===2?'Palm':'Kick',n===3?2:1);
   if(combo&&t.hp>0){
    this.damage(a.id,t,combo.bonus*a.atk,combo.move,combo.name,combo.break,{finisher:true});
    this.finishes++;
    if(combo.ep){a.ep=clamp(a.ep+combo.ep,0,a.maxEp);this.event('restore',{to:a.id,name:'+8 EP'});}
   }
   a.reserve=Math.min(3,this.ap-this.spent);
  }else if(cmd==='guard'){
   a.guard=true;a.ep=clamp(a.ep+8,0,a.maxEp);a.reserve=3;
   this.event('guard',{from:a.id,to:a.id,name:'Guard · +8 EP · +3 Reserve'});
  }else if(cmd==='skill'){
   a.ep-=12;a.reserve=0;
   if(a.id==='oren'){this.event('cast',{from:a.id,to:a.id,name:'Quiet Current'});for(const p of this.party)this.heal(a.id,p,48,'Quiet Current');}
   else{this.event('cast',{from:a.id,to:t.id,name:'Ember Pulse'});const old=t.guard;t.guard=false;this.damage(a.id,t,77,'cast','Ember Pulse',3,{ether:true});t.guard=old;}
  }else{
   this.inventory.kits--;
   const target=this.party.reduce((p,q)=>q.hp/q.max<p.hp/p.max?q:p,this.party[0]);
   this.heal(a.id,target,100,'Field kit');a.reserve=0;
  }
  this.seq=[];
  this.checkResult();
  if(!this.result)this.advance();
  return {ok:true,events:this.events.slice(),result:this.result};
 }
 advance(){
  let next=this.turn+1;while(next<this.party.length&&this.party[next].hp<=0)next++;
  if(next<this.party.length){this.turn=next;this.ap=6+this.actor.reserve;return;}
  this.enemyTurn();this.checkResult();
  if(!this.result){this.round++;this.turn=this.party.findIndex(p=>p.hp>0);this.ap=6+this.actor.reserve;}
 }
 enemyTurn(){
  for(const e of this.enemies){
   if(e.hp<=0||this.livingParty.length===0)continue;
   if(e.stagger&&this.kind==='gear'){this.event('stagger',{from:e.id,to:e.id,name:e.name+' cannot act.'});e.stagger=false;e.poise=e.maxPoise;continue;}
   const intention=this.enemyIntent(e);
   if(e.stagger){intention.damage=Math.round(intention.damage*.5);e.stagger=false;e.poise=e.maxPoise;}
   e.counter++;
   if(intention.type==='charge'){this.event('charge',{from:e.id,to:e.id,name:e.name+' gathers force.'});continue;}
   const p=this.party.find(p=>p.id===intention.target&&p.hp>0)||this.livingParty[0];
   this.damage(e.id,p,intention.damage,intention.type==='heavy'?'uppercut':e.type==='drone'?'cast':'cross',intention.name,0,{enemy:true,heavy:intention.type==='heavy'});
  }
 }
 checkResult(){
  if(this.livingEnemies.length===0){this.result='victory';this.event('victory',{name:'The way is clear.'});}
  else if(this.livingParty.length===0){this.result='defeat';this.event('defeat',{name:'The signal fades.'});}
 }
 gearCommand(cmd){
  const p=this.party[0],e=this.enemies[0];
  if(cmd==='boost'){this.boost=!this.boost;return {ok:true,events:[],free:true};}
  const costs={strike:18,lance:26,finish:30,charge:0,repair:0};
  if(!(cmd in costs))return {ok:false,reason:'Unknown machine action.'};
  if(cmd==='finish'&&this.drive<2)return {ok:false,reason:'Build Drive to level 2 with normal attacks.'};
  if(cmd==='repair'&&this.repairs<=0)return {ok:false,reason:'No repair cells remain.'};
  if(cmd==='repair'&&p.hp===p.max)return {ok:false,reason:'Morrow is already at full integrity.'};
  const attack=['strike','lance','finish'].includes(cmd),cost=costs[cmd]+(attack&&this.boost?10:0);
  if(cost>this.fuel)return {ok:false,reason:'Not enough fuel. Brace restores fuel.'};
  if(attack&&this.heat>=85)return {ok:false,reason:'Heat is too high. Brace to cool the machine.'};
  this.events=[];p.guard=false;this.turns++;
  if(attack){
   this.fuel-=cost;
   this.heat=clamp(this.heat+(this.boost?34:14),0,100);
   const mult=this.boost?1.5:1,coil=this.module==='coil'?16:0;
   if(cmd==='strike'){
    this.drive=Math.min(3,this.drive+1);this.event('sequence',{from:'morrow',to:e.id,name:'Iron Reach'});
    this.damage('morrow',e,(86+coil)*mult,'cross','Iron Reach',2,{gear:true});
   }else if(cmd==='lance'){
    this.drive=Math.min(3,this.drive+1);this.event('cast',{from:'morrow',to:e.id,name:'Resonance Lance'});
    this.damage('morrow',e,(112+coil)*mult,'cast','Resonance Lance',5,{gear:true,ether:true});
   }else{
    const power=this.drive===3?310:234;this.drive=0;this.finishes++;
    this.event('sequence',{from:'morrow',to:e.id,name:'DAWN BREAK'});
    this.damage('morrow',e,(power+coil)*mult,'uppercut','DAWN BREAK',6,{gear:true,finisher:true});
   }
   if(this.heat>=100)this.damage('morrow',p,54,'hurt','Heat overload',0,{heat:true});
  }else if(cmd==='charge'){
   p.guard=true;this.fuel=clamp(this.fuel+(this.module==='coil'?40:34),0,100);this.heat=clamp(this.heat-44,0,100);
   this.event('guard',{from:'morrow',to:'morrow',name:'Brace · fuel restored · heat reduced'});
  }else{
   this.repairs--;this.heal('morrow',p,215,'Repair cell');this.heat=clamp(this.heat-12,0,100);
  }
  this.checkResult();
  if(!this.result){
   if(this.phase===1&&e.hp<=e.max*.5){
    this.phase=2;e.counter=1;this.event('phase',{name:'THE SECOND VOICE',subtitle:'The Cantor opens its core.'});
   }
   this.enemyTurn();this.checkResult();
   if(!this.result)this.round++;
  }
  return {ok:true,events:this.events.slice(),result:this.result};
 }
 summary(){return {kind:this.kind,round:this.round,actor:this.actor.id,ap:this.ap,sequence:this.seq.slice(),target:this.enemies[this.target]?.id,party:copy(this.party),enemies:copy(this.enemies),intent:this.intent,fuel:this.fuel,heat:this.heat,drive:this.drive,phase:this.phase,boost:this.boost,result:this.result};}
}
A.Battle=Battle;
if(typeof module!=='undefined'&&module.exports)module.exports={Battle,combos:A.combos};
})(typeof window!=='undefined'?window:globalThis);
