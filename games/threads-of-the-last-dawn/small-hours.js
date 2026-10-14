/* Small Hours: safe deliveries, field records, route hints, and preparation tools. */
(() => {
'use strict';
const D=globalThis.Dawn,C=D.Content;
const statKeys=['maxHp','maxMp','atk','mag','def','speed'];
const labels={maxHp:'Max HP',maxMp:'Max MP',atk:'Attack',mag:'Magic',def:'Defence',speed:'Speed'};
let contentIndex=null;

function index(){
  if(contentIndex)return contentIndex;
  const rows=C.zones.flatMap(z=>(z.entities||[]).map(e=>({...e,zone:z.id})));
  const byId=new Map(rows.map(e=>[e.id,e])),byFlag=new Map(),byEntity=new Map();
  const add=(flag,row)=>{
    if(!flag)return;const key=row.zone+'/'+row.id;
    if(!byFlag.has(flag))byFlag.set(flag,[]);
    if(!byFlag.get(flag).some(e=>e.zone+'/'+e.id===key))byFlag.get(flag).push(row);
  };
  const effects=(list,row)=>{for(const e of list||[])if(e.type==='flag')add(e.id,row);};
  const dialogue=(id,row,seen=new Set())=>{
    if(!id||seen.has(id))return;seen.add(id);const d=C.dialogues[id];if(!d)return;
    add(d.onceFlag,row);effects(d.effects,row);
    for(const choice of d.choices||[]){effects(choice.effects,row);dialogue(choice.next,row,seen);}
    for(const v of d.variants||[]){effects(v.effects,row);dialogue(v.dialogue,row,seen);}
    dialogue(d.next,row,seen);dialogue(d.onRepeat,row,seen);
  };
  for(const e of rows){
    add(e.flag,e);effects(e.effects,e);dialogue(e.dialogue,e);
    for(const v of e.variants||[])dialogue(v.dialogue,e);
    if(e.type==='encounter')effects(C.encounters[e.encounter||e.id]?.effects,e);
    if(e.type==='note')add((C.fieldNotes||[]).find(n=>n.id===e.record)?.flag,e);
  }
  for(const m of C.missions||[])for(const step of m.steps){
    const targets=step.entity?[byId.get(step.entity)].filter(Boolean):(byFlag.get(step.flag)||[]).filter(e=>e.zone===step.zone);
    for(const e of targets){const key=e.zone+'/'+e.id;if(!byEntity.has(key))byEntity.set(key,[]);byEntity.get(key).push({mission:m,step});}
  }
  return contentIndex={rows,byId,byFlag,byEntity};
}
function exits(zone){
  if(!zone)return[];
  if(zone.kind==='overworld')return[...(zone.landmarks||[]),{id:zone.id+'_orchard_gate',type:'gate',to:'bell_orchard',name:'Orchard Time Gate'}];
  const result=[...(zone.exits||[]),...(zone.entities||[]).filter(e=>['exit','gate'].includes(e.type)&&e.to)];
  if(zone.worldPosition&&!zone.overworldParent&&!result.some(e=>e.to===zone.worldPosition.zone))result.push({id:zone.id+'_overworld',type:'exit',to:zone.worldPosition.zone,name:'The open road'});
  return result;
}
const note=id=>(C.fieldNotes||[]).find(n=>n.id===id);
const countOwned=(state,id)=>Math.max(0,state.inventory[id]||0);
D.SmallHours={index,exits,note,statKeys,statLabels:labels};

D.extendSmallHours=App=>{
  const P=App.prototype,base={interact:P.interact,useFieldItem:P.useFieldItem};
  P.routePlan=function(destination){
    if(!this.state||!C.zoneById[destination])return null;
    if(destination===this.state.zone)return[];
    const queue=[[this.state.zone,[]]],seen=new Set([this.state.zone]);
    for(let i=0;i<queue.length;i++){
      const [at,path]=queue[i];
      for(const e of exits(C.zoneById[at])){
        if(!e.to||!C.zoneById[e.to]||seen.has(e.to)||!this.meets(e.requires)||e.hideIf&&this.meets(e.hideIf))continue;
        const next=[...path,{from:at,to:e.to,id:e.id,name:e.name||C.zoneById[e.to].name}];
        if(e.to===destination)return next;
        seen.add(e.to);queue.push([e.to,next]);
      }
    }
    return null;
  };
  P.routeExitTo=function(destination){
    const route=this.routePlan(destination);if(!route?.length)return null;
    return this.world.interactables(this).find(e=>e.id===route[0].id&&this.meets(e.requires))||null;
  };
  P.objectiveCandidates=function(step=this.objective()){
    if(!step)return[];const data=index();
    return (step.entity?[data.byId.get(step.entity)].filter(Boolean):(data.byFlag.get(step.flag)||[])).filter(e=>e.zone===step.zone);
  };
  P.objectiveEntity=function(){
    const step=this.objective();if(step.zone!==this.state?.zone)return null;
    const ids=new Set(this.objectiveCandidates(step).map(e=>e.id));
    return this.world.interactables(this).filter(e=>ids.has(e.id)&&this.meets(e.requires)).sort((a,b)=>Math.hypot(a.x-this.hero.x,a.y-this.hero.y)-Math.hypot(b.x-this.hero.x,b.y-this.hero.y))[0]||null;
  };
  P.deliveryStatus=function(id){
    const e=index().byId.get(typeof id==='string'?id:id?.id);
    const result={ok:false,ready:false,complete:false,entity:e,items:[],gold:e?.gold||0};
    if(!e||e.type!=='delivery'||!this.state)return{...result,reason:'This delivery is not available.'};
    result.items=Object.entries(e.items||{}).map(([item,amount])=>({id:item,name:C.items[item]?.name||item,amount,owned:countOwned(this.state,item)}));
    if(this.state.flags[e.flag])return{...result,complete:true,reason:'This delivery is complete.'};
    if(!this.meets(e.requires)||e.hideIf&&this.meets(e.hideIf))return{...result,reason:'Follow the previous story step first.'};
    if(this.battle||this.expeditionActive?.())return{...result,reason:'Finish the battle or expedition first.'};
    if(result.items.some(it=>it.owned<it.amount)||this.state.gold<result.gold)return{...result,reason:'Bring all the listed items and crowns.'};
    result.ready=true;
    if(this.state.zone!==e.zone)return{...result,reason:'Meet the recipient in '+C.zoneById[e.zone].name+'.'};
    const live=this.world.interactables(this).find(v=>v.id===e.id);
    if(!live||Math.hypot(live.x-this.hero.x,live.y-this.hero.y)>28)return{...result,reason:'Walk to the recipient first.'};
    return{...result,ok:true,reason:''};
  };
  P.completeDelivery=function(id){
    const q=this.deliveryStatus(id);
    if(!q.ok){this.toast(q.reason,4);return false;}
    if(this.talk.open)return false;
    // Check every cost before changing inventory. The completion flag owns the receipt.
    for(const item of q.items)this.state.inventory[item.id]-=item.amount;
    this.state.gold-=q.gold;this.ui.close();
    this.apply([{type:'flag',id:q.entity.flag},...(q.entity.effects||[])]);
    this.game.audio.sfx('pickup');
    this.say(q.entity.lines||['The delivery is complete.'],{name:q.entity.name||'A promise kept'});
    return true;
  };
  P.readFieldNote=function(id){
    const n=note(id);if(!n||!this.state||this.battle||this.expeditionActive?.())return false;
    const known=!!this.state.flags[n.flag];
    if(!known){
      const e=this.world.interactables(this).find(e=>e.type==='note'&&e.record===id&&this.meets(e.requires));
      if(!e||this.state.zone!==n.zone||!this.meets(n.requires)||Math.hypot(e.x-this.hero.x,e.y-this.hero.y)>28)return false;
    }
    if(this.talk.open)return false;this.ui.close();const startedIn=this.state;
    this.say(n.lines,{name:n.name,onDone:()=>{if(this.state===startedIn&&!this.state.flags[n.flag])this.apply([{type:'flag',id:n.flag},...(n.effects||[])]);}});
    return true;
  };
  P.entityObjectiveState=function(entity,zoneId=this.state?.zone){
    const e=typeof entity==='string'?index().byId.get(entity):entity;
    const none={kind:'none',label:''};if(!e||!this.state)return none;
    const step=this.objective(),refs=this.objectiveCandidates(step);
    const tracked=step.zone===zoneId&&refs.some(v=>v.id===e.id);
    if(!this.meets(e.requires)||e.hideIf&&this.meets(e.hideIf))return none;
    if(tracked)return{kind:'tracked',label:this.state.trackedMission?'Tracked task':'Main story',missionId:this.state.trackedMission||null};
    if(e.type==='delivery'){
      const q=this.deliveryStatus(e.id);
      if(q.complete)return{kind:'complete',label:'Delivered'};
      if(q.ready)return{kind:'ready',label:'Ready to deliver'};
    }
    if(e.type==='note')return this.state.flags[note(e.record)?.flag]?{kind:'complete',label:'Note recorded'}:{kind:'available',label:'Unread field note'};
    const associated=index().byEntity.get(zoneId+'/'+e.id)||[];
    for(const {mission,step:missionStep}of associated){
      const status=this.missionStatus(mission.id),next=this.missionStep(mission.id);
      if(next?.flag!==missionStep.flag)continue;
      if(status==='active')return{kind:'active',label:'Side quest step',missionId:mission.id};
      if(status==='available')return{kind:'available',label:'Side quest available',missionId:mission.id};
    }
    if(e.flag&&this.state.flags[e.flag]||associated.some(v=>this.state.flags[v.mission.completeFlag]))return{kind:'complete',label:'Work complete'};
    return none;
  };
  P.nearbyTasks=function(scope='here'){
    if(!this.state||!this.world)return[];
    const current=this.world.zone,within=zone=>scope==='all'?this.mapAccess(zone.era):scope==='age'?zone.era===current.era:zone.id===current.id||current.kind==='overworld'&&D.worldEntrance(zone)?.worldPosition?.zone===current.id;
    return(C.missions||[]).map(m=>({mission:m,status:this.missionStatus(m.id),step:this.missionStep(m.id)})).filter(v=>['active','available'].includes(v.status)&&v.step&&within(C.zoneById[v.step.zone])).sort((a,b)=>Number(b.mission.id===this.state.trackedMission)-Number(a.mission.id===this.state.trackedMission)||Number(b.status==='active')-Number(a.status==='active')||a.mission.name.localeCompare(b.mission.name));
  };
  P.walkToEntity=function(id){
    if(!this.state||this.battle||this.talk.open||this.expeditionActive?.())return false;
    const e=this.world.interactables(this).find(v=>v.id===id&&this.meets(v.requires));
    if(!e)return false;
    if(!this.world.map.walkable(Math.floor(e.x/16),Math.floor(e.y/16))){this.toast('Change travel mode or open the route first.',4);return false;}
    this.ui.close();this.walkTo(e.x,e.y,e);return true;
  };
  P.walkToObjective=function(){
    const e=this.destination()===this.state.zone?this.objectiveEntity():this.routeExitTo(this.destination());
    if(!e){this.toast('Check the journal for the next story step.',4);return false;}
    return this.walkToEntity(e.id);
  };
  P.equipmentPreview=function(heroId,itemId,emptySlot=null){
    if(!this.state?.roster[heroId])return{ok:false,reason:'Recruit this traveller first.'};
    const item=itemId?C.items[itemId]:null,slot=item?.slot||item?.kind||emptySlot,hero=this.state.roster[heroId];
    if(!['weapon','armor','accessory'].includes(slot)||itemId&&(!item||item.hero&&item.hero!==heroId))return{ok:false,reason:'This traveller cannot use that item.'};
    const current=hero.equipment[slot];
    // A read-only facade runs the actual stat chain, including current town and meal bonuses.
    const view=Object.create(this);view.state={...this.state,roster:{...this.state.roster,[heroId]:{...hero,equipment:{...hero.equipment,[slot]:itemId||null}}}};
    const before=this.stats(heroId),after=view.stats(heroId);
    const changes=statKeys.map(key=>({key,label:labels[key],before:before[key],after:after[key],delta:Math.round((after[key]-before[key])*100)/100}));
    const owned=!itemId||countOwned(this.state,itemId)>0||current===itemId,busy=!!this.battle||!!this.expeditionActive?.();
    return{ok:owned&&!busy&&current!==itemId,owned,current,item:itemId,slot,before,after,changes,reason:busy?'Finish the battle or expedition first.':!owned?'This item is not in your bag.':current===itemId?'Already equipped.':''};
  };
  P.fieldItemStatus=function(id,heroId){
    const no=reason=>({ok:false,reason,hp:0,mp:0});
    if(!this.state?.roster[heroId]||!C.items[id]||countOwned(this.state,id)<1)return no('This supply is not available.');
    if(this.battle||this.expeditionCheckpoint?.()===false)return no('Use the battle item command during a fight.');
    const run=this.state.expeditions?.run;
    if(run&&!run.party.includes(heroId))return no('Only the expedition party can use supplies at this camp.');
    const s=this.stats(heroId),effect=C.items[id].effect||{};
    if(!['tonic','ether','elixir'].includes(id))return no(id==='phoenix'?'Keep Dawn Salt for a fallen ally in battle.':'Use this supply during a battle.');
    const hp=id==='ether'?0:Math.min(s.maxHp-s.hp,id==='elixir'?s.maxHp:effect.amount||90);
    const mp=id==='tonic'?0:Math.min(s.maxMp-s.mp,id==='elixir'?s.maxMp:effect.amount||30);
    if(hp<=0&&mp<=0)return no('No recovery is needed. The supply will stay in your bag.');
    return{ok:true,hp,mp,reason:''};
  };
  P.useFieldItem=function(id,target){
    const q=this.fieldItemStatus(id,target);if(!q.ok){this.toast(q.reason,4);return false;}
    return base.useFieldItem.call(this,id,target);
  };
  P.interact=function(entity=this.nearest){
    if(!entity||this.battle||this.talk.open||this.panel)return false;
    if(!this.meets(entity.requires))return base.interact.call(this,entity);
    if(entity.type==='delivery'){
      if(this.expeditionActive?.())return false;
      const q=this.deliveryStatus(entity.id);
      if(q.complete)this.say(entity.repeatLines||['The delivery is complete.'],{name:entity.name});
      else this.ui.open('delivery',{id:entity.id});
      return true;
    }
    if(entity.type==='note')return this.readFieldNote(entity.record);
    return base.interact.call(this,entity);
  };
};
})();
