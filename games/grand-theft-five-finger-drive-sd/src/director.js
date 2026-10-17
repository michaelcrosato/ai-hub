(() => {
const G=Drive;
G.Director=class {
 constructor(session){this.s=session;this.goal=null;this.lastProgress=0;this.lastPos=null;this.stuck=0;this.gantryIndex=0;this.replans=0;this.lastStage=null;this.elapsed=0;this.scenario=session.app.demoIndex%3;}
 action(){
  this.watchdog();return this.decide();
 }
 watchdog(){
  const s=this.s,c=s.controlled;if(s.outcome||s.tick%120)return;
  const signature=JSON.stringify([s.progress,c.zone,this.gantryIndex,s.alert.heat,!!s.interaction]);
  const pos={x:c.x,y:c.y,z:c.z},crewRemaining=s.crew.reduce((n,a)=>n+(a.zone===c.zone?G.dist(a,c):1000),0),crewProgress=this.crewRemaining!==undefined&&this.crewRemaining-crewRemaining>18;
  if(signature!==this.progressSignature||!this.progressPos||G.dist(pos,this.progressPos)>18||Math.abs(pos.z-this.progressPos.z)>8||crewProgress){this.stuck=0;this.progressPos=pos;this.progressSignature=signature;this.crewRemaining=crewRemaining;}else this.stuck++;
  if(this.stuck===5){c.nav=null;const v=s.cars.find(v=>v.id===c.vehicle);if(v)v.nav=null;this.replans++;s.events.emit('demo.replan',{goal:this.goal});}
  if(this.stuck===12){c.nav=null;if(c.vehicle)this.requestExit=true;else this.escapeIndex=Math.max(0,(this.escapeIndex||0)-1);}
  if(this.stuck>=20){s.metrics.recoveries++;s.app.pendingRecovery='No progress for 20 seconds';}
  if(s.time-(this.stageTime||0)>180){s.metrics.recoveries++;s.app.pendingRecovery='Objective timeout';}
 }
 decide(){
  const s=this.s,c=s.controlled,stage=s.stage;let a=G.emptyAction('demo');s.metrics.botActions++;this.elapsed+=G.STEP;
  if(s.outcome)return a;
  if(s.interactLatch===c.id)return a;
  if(c.down||c.dead)return a;
  if(this.lastStage!==s.progress){this.lastStage=s.progress;this.stuck=0;this.gantryIndex=0;this.stageTime=s.time;this.escapeIndex=0;}
  const go=(p)=>{this.goal={x:p.x,y:p.y,z:p.z||0,zone:p.zone,id:p.id};if(c.vehicle){const v=s.cars.find(v=>v.id===c.vehicle);if(c.seat!==0){const driver=s.crew.find(a=>a.id===v.occupants[0]);if(driver)s.switchTo(driver.id);return G.emptyAction('demo');}if(v.occupants.filter(Boolean).length<3&&s.crew.some(a=>a.zone==='city'&&!a.vehicle&&!a.down)){const wait=G.emptyAction('demo');wait.brake=1;return wait;}return G.driveTo(s,v,p,'demo');}return s.navAction(c,p,'demo');};
  const use=(p)=>{a=go(p);if(G.dist(c,p)<(p.type?42:28)&&(!p.type||G.nearestInteraction(s)?.id==='car:'+p.id)){a.move=[0,0];a.throttle=0;a.brake=1;a.held.interact=true;}return a;};
  const exit=()=>{a.brake=1;if(Math.abs(s.cars.find(v=>v.id===c.vehicle)?.speed||0)<20)a.held.interact=true;return a;};
  const defend=act=>{if(!c.vehicle){const threat=s.actors.filter(o=>(o.team==='guard'||o.team==='police')&&o.enabled&&!o.dead&&o.zone===c.zone&&o.suspicion>.3&&G.dist(c,o)<220&&s.queryClear(c,o)).sort((x,y)=>G.dist(c,x)-G.dist(c,y))[0];if(threat){const d=G.dist(c,threat);act.aim=[(threat.x-c.x)/d,(threat.y-c.y)/d];act.held.fire=true;act.held.aim=true;if(c.ammo[c.weapon]===0)act.pressed.reload=true;}}return act;};
  const wounded=s.crew.find(o=>o.down&&!o.dead);
  if(wounded){if(c.vehicle)return exit();if(c.zone===wounded.zone)return defend(use({x:wounded.x,y:wounded.y,zone:wounded.zone,id:wounded.id}));if(c.zone==='city'&&wounded.zone==='records')return defend(use(G.content.points.records));if(c.zone==='records'&&wounded.zone==='city')return defend(use({x:80,y:336,zone:'records'}));}
  if(this.requestExit){if(c.vehicle)return exit();this.requestExit=false;}
  if(c.zone==='gantry'){
   if(s.flags.relay){a.move=[Math.sign(1216-c.x),0];if(Math.abs(c.x-1216)<20){a.move=[0,0];a.held.interact=true;}return a;}
   const points=[{x:152,z:16},{x:152,z:64},{x:408,z:64},{x:408,z:96},{x:664,z:96},{x:664,z:128},{x:888,z:128},{x:888,z:96},{x:1128,z:96},{x:1128,z:64},{x:1216,z:64}];
   let p=points[Math.min(this.gantryIndex,points.length-1)];
   if(Math.abs(c.x-p.x)<6&&c.z>=p.z-.01){this.gantryIndex=Math.min(points.length,this.gantryIndex+1);p=points[Math.min(this.gantryIndex,points.length-1)];}
   const pbody=c.platform,dx=p.x-c.x;a.move=[Math.abs(dx)>2?Math.sign(dx):0,p.z>c.z+.01?1:0];
   const ground=s.maps.gantry.groundBelow(c.x+Math.sign(dx)*18,c.z+3),needJump=Math.abs(dx)>10&&(ground===null||ground<c.z-8);
   a.held.jump=needJump||!!this.jumpHold;if(needJump&&pbody.onGround){a.pressed.jump=true;this.jumpHold=.3;}if(this.jumpHold)this.jumpHold=Math.max(0,this.jumpHold-G.STEP);
   if(this.gantryIndex>=points.length){a.move=[0,0];a.held.interact=true;}
   return a;
  }
  if(c.zone==='records'){
   if(s.flags.ledger)a=use({x:80,y:336,zone:'records'});else{a=use({x:416,y:64,zone:'records'});if(s.cameraDisabled<2&&c.abilityCD===0)a.pressed.ability=true;}
  }else if(stage?.kind==='interact')a=use(G.content.points[stage.target]);
  else if(stage?.kind==='vehicle'){
   if(!c.vehicle){const required=s.definition.choices?.find(x=>x.id===s.approach)?.vehicle;const cars=s.cars.filter(v=>(!required||v.type===required)&&v.hp>0&&!v.traffic&&v.occupants.some(x=>x===null)).sort((a,b)=>G.dist(a,G.content.points.valet)-G.dist(b,G.content.points.valet));a=use(cars[0]||s.cars[0]);}
  }else if(stage?.kind==='reach')a=go(G.content.points[stage.target]);
  else if(stage?.kind==='entry'){if(c.vehicle)a=exit();else a=use(G.content.points[s.approach==='quiet'?'service':'gate']);}
  else if(stage?.id==='relay'){if(c.vehicle)a=exit();else if(c.id!=='teo'){s.switchTo('teo');return a;}else a=use(G.content.points.gantry);}
  else if(stage?.id==='ledger')a=use(G.content.points.records);
  else if(stage?.kind==='gather'){
   for(const actor of s.crew)if(actor!==c)actor.task='follow';
   if(c.vehicle)a=go(G.content.points.pickup);
   else {const car=s.cars.filter(v=>v.hp>0&&!v.traffic&&v.occupants.some(x=>x===null)).sort((a,b)=>G.dist(a,G.content.points.pickup)-G.dist(b,G.content.points.pickup))[0];a=use(car);}
  }else if(stage?.kind==='escape'){
   const routes={canal:[{x:880,y:1376},{x:880,y:1720},{x:1530,y:1720},{x:1530,y:1550}],market:[{x:2150,y:1376},{x:2320,y:1430},{x:2320,y:1715},{x:2010,y:1715},{x:2010,y:1550}]};
   const route=routes[s.route],i=Math.min(this.escapeIndex||0,route.length-1),p={...route[i],zone:'city'};
   a=go(p);if(G.dist(c,p)<55&&i<route.length-1){this.escapeIndex=i+1;const v=s.cars.find(v=>v.id===c.vehicle);if(v)v.nav=null;}
   if(i===route.length-1&&G.dist(c,p)<55){a.brake=1;a.throttle=0;}
  }else if(stage?.kind==='deliver')a=go(G.content.points[stage.target]);
  if(c.id==='mara'&&c.vehicle&&c.abilityCD===0&&Math.abs(s.cars.find(v=>v.id===c.vehicle)?.speed||0)>80)a.pressed.ability=true;
  return defend(a);
 }
};
})();
