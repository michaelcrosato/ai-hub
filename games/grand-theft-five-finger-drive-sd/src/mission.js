(() => {
const G=Drive;
G.interactions=(s,c=s.controlled)=>{
 const items=[];const add=(id,label,x,y,zone,duration=1,extra={})=>items.push({id,label,x,y,zone,duration,...extra});
 if(c.vehicle){add('exit','Leave vehicle',c.x,c.y,c.zone,.12);return items;}
 for(const a of s.crew)if(a.down)add('revive:'+a.id,'Revive '+a.data.name,a.x,a.y,a.zone,3);
 if(c.zone==='city'){
  for(const v of s.cars)if(v.hp>0&&Math.abs(v.speed)<20&&v.occupants.some(x=>x===null))add('car:'+v.id,(v.occupants[0]&&!s.crew.some(a=>a.id===v.occupants[0])?'Take occupied ':'Enter ')+G.content.vehicles[v.type].name,v.x,v.y,'city',v.occupants[0]&&!s.crew.some(a=>a.id===v.occupants[0])?.9:.18);
  for(const id of ['brief','shop','lunch','tow']){const p=G.content.points[id];add(id,{brief:'Talk to the crew',shop:'Repair / ammo / respray',lunch:'Late Lunch delivery',tow:'Bad Tow Day'}[id],p.x,p.y,'city',id==='brief'?1:1.5);}
  const p=G.content.points;add('gate','Force depot barrier',p.gate.x,p.gate.y,'city',2);add('service','Open service gate',p.service.x,p.service.y,'city',3);
  if(s.flags.gate||s.free){add('gantry','Enter service gantry · Teo',p.gantry.x,p.gantry.y,'city',.5);if(s.flags.relay||s.free)add('records','Enter Records',p.records.x,p.records.y,'city',.5);}
  add('extract','Deliver the ledger',p.extract.x,p.extract.y,'city',2);
  if(s.yard)for(const [i,p]of s.yardStations.entries())add('yard:'+i,p.label,p.x,p.y,'city',.5);
 }else if(c.zone==='records'){add('terminal','Copy payment ledger',416,64,'records',8);add('recordsExit','Return to depot',80,336,'records',.3);add('camera','Disable camera · Circuit Cut',470,50,'records',2);}
 else{add('relay','Cut relay / exit gantry',1216,0,'gantry',s.flags.relay?.3:2.5,{z:64});add('gantryExit','Return to depot',48,0,'gantry',.3,{z:16});}
 return items;
};
G.nearestInteraction=(s,a=s.controlled)=>{const score=p=>G.dist(a,p)+(1-Math.cos(Math.atan2(p.y-a.y,p.x-a.x)-a.facing))*3-(p.id.startsWith('revive:')?18:p.id===s.stage?.target?8:0);return G.interactions(s,a).filter(p=>p.zone===a.zone&&G.dist(a,p)<(p.id.startsWith('car:')?44:32)&&Math.abs((p.z||0)-a.z)<38&&(a.zone==='gantry'||['gate','service'].includes(p.id)||s.queryClear(a,p,{ignore:p.id.startsWith('car:')?p.id.slice(4):a.vehicle}))).sort((x,y)=>score(x)-score(y))[0];};
G.interact=(s,a,act,dt)=>{
 const owner=a===s.controlled?s:a;if(owner.interactLatch===a.id)return;const p=G.nearestInteraction(s,a);if(!p){owner.interaction=null;return;}const token=s.reservations[p.id];if(token&&token.actor!==a.id&&token.until>s.time)return;s.reservations[p.id]={actor:a.id,until:s.time+.1};
 if(!owner.interaction||owner.interaction.id!==p.id)owner.interaction={id:p.id,actor:a.id,time:0,duration:p.duration};
 owner.interaction.time+=dt;if(owner.interaction.time+1e-8<p.duration)return;
 owner.interaction=null;owner.interactLatch=a.id;delete s.reservations[p.id];s.events.emit('interaction.completed',{id:p.id,actor:a.id});
 if(p.id==='exit'){G.exitCar(s,a);return;}
 if(p.id.startsWith('car:')){G.enterCar(s,a,s.cars.find(v=>v.id===p.id.slice(4)));return;}
 if(p.id.startsWith('revive:')){const b=s.crew.find(a=>a.id===p.id.slice(7));b.hp=60;b.down=0;b.task='follow';b.invulnerable=1.5;s.sound('heal');return;}
 if(p.id==='brief'){if(s.stage?.id==='brief'){if(!s.demo&&!s.flags.approachChosen){s.app.chooseApproach();return;}s.flags.brief=true;}else s.say('MARA: The next move is yours. Bring everyone home.');}
 if(p.id==='gate'||p.id==='service'){s.flags.gate=true;s.applyGates();if(p.id==='gate'){s.approach='forceful';s.crime(a,2,'Depot barrier breached');G.raiseHeat(s,2,a,'Depot alarm');}else{s.approach='quiet';s.cameraDisabled=30;}s.sound('gate');}
 if(p.id==='gantry'){if(a.id!=='teo'){s.note('Hold CREW and select Teo for the relay');return;}s.portal(a,'gantry',{x:48,z:16});}
 if(p.id==='relay'){if(!s.flags.relay){s.flags.relay=true;s.cameraDisabled=45;s.say('TEO: Relay cut. Records is open.');s.sound('skill');}else s.portal(a,'city',{x:1770,y:610});}
 if(p.id==='gantryExit')s.portal(a,'city',{x:1770,y:610});
 if(p.id==='records')s.portal(a,'records',{x:80,y:320});
 if(p.id==='recordsExit')s.portal(a,'city',{x:1850,y:590});
 if(p.id==='camera'){s.cameraDisabled=25;s.sound('skill');}
 if(p.id==='terminal'){s.flags.ledger=true;s.sound('ledger');s.crime(a,2,'Ledger vault opened');G.raiseHeat(s,2,{x:1872,y:590,zone:'city'},'MeterMint vault alarm');}
 if(p.id==='extract')s.flags.delivered=true;
 if(p.id==='shop'){if(s.stage?.target==='shop')s.flags.shop=true;else s.app.shop();}
 if(p.id==='lunch'){if(s.flags.lunch){s.note('LATE LUNCH — The customer is at Broadcast Pier');}else{s.flags.lunch=true;s.flags.lunchStarted=s.time;s.note('LATE LUNCH — Pier delivery: $150 + up to $100 for speed');}}
 if(p.id==='extract'&&s.flags.lunch&&!s.rewards.includes('lunch')){const bonus=Math.max(0,Math.round(100-(s.time-s.flags.lunchStarted)*1.25)),pay=150+bonus;s.rewards.push('lunch');s.money+=pay;s.note('LATE LUNCH +$'+pay+' / SPEED BONUS $'+bonus);s.checkpoint();}
 if(p.id==='tow'){s.flags.tow=true;if(!s.rewards.includes('tow')){s.rewards.push('tow');const pay=Math.max(20,120-(s.flags.civilianHarm||0)*25);s.money+=pay;s.say('KIT: That boot belongs to a nurse. Find another invoice.');s.note('BAD TOW DAY — Dispute settled. +$'+pay);s.checkpoint();}s.sound('gate');}
 if(p.id.startsWith('yard:'))s.runStation(Number(p.id.slice(5)));
};
G.updateMission=(s,dt)=>{
 if(s.free||s.yard||s.outcome)return;const stage=s.stage;if(!stage){s.complete();return;}const c=s.controlled,p=G.content.points[stage.target];let done=false;
 if(stage.kind==='interact')done=!!s.flags[stage.target];
 else if(stage.kind==='vehicle'){const required=s.definition.choices?.find(x=>x.id===s.approach)?.vehicle;done=!!c.vehicle&&(!required||s.cars.find(v=>v.id===c.vehicle)?.type===required);}
 else if(stage.kind==='reach')done=c.zone===p.zone&&G.dist(c,p)<85&&(!stage.vehicle||!!c.vehicle);
 else if(stage.kind==='entry')done=!!s.flags.gate;
 else if(stage.kind==='flag')done=!!s.flags[stage.flag];
 else if(stage.kind==='gather')done=s.crew.every(a=>!a.dead&&!a.down&&a.zone==='city'&&G.dist(a,p)<100)&&s.crew.some(a=>!!a.vehicle);
 else if(stage.kind==='escape')done=s.alert.heat===0&&c.zone==='city'&&(G.dist(c,G.content.points.canal)<100||G.dist(c,G.content.points.market)<100||s.flags.escapeRoad);
 else if(stage.kind==='deliver')done=s.alert.heat===0&&c.zone===p.zone&&G.dist(c,p)<65&&s.crew.every(a=>!a.dead&&!a.down&&a.zone===c.zone&&G.dist(a,c)<100)&&(s.definition.id!=='meter'||s.flags.ledger);
 if(stage.kind==='escape'&&(G.dist(c,G.content.points.canal)<100||G.dist(c,G.content.points.market)<100))s.flags.escapeRoad=true;
 if(done){s.trace.push({tick:s.tick,stage:stage.id,event:'complete'});s.progress++;s.events.emit('objective.completed',{id:stage.id});s.say(s.stage?.line||'MARA: Keep it moving.');s.sound('objective');if(stage.save)s.checkpoint();if(!s.stage)s.complete();}
};
G.Session.prototype.setupYard=function(restored=false){
 this.yardStations=['Movement course','Six vehicle types','Combat & cover','Witness reports','Police search','Crew rescue','View portals','Save & lifecycle'].map((label,i)=>({label,x:1992+(i%4)*96,y:1490+Math.floor(i/4)*90}));
 this.maps.city.fill(122,90,26,19,0);for(let y=90;y<109;y++)for(let x=122;x<148;x++)this.maps.city.setFloor(x,y,'pave',false);this.maps.city.fill(124,95,3,1,4);this.maps.city.fill(130,95,3,1,5);
 if(!this.lifts.length)this.lifts=[{id:'yard-lift',x:96,z:16,w:32,h:5,vx:0,vz:14,oneway:true}];
 if(restored)return;
 for(const [i,a]of this.crew.entries())Object.assign(a,{x:1988+i*18,y:1448});this.flags.gate=true;this.flags.relay=true;this.applyGates();
};
G.Session.prototype.runStation=function(i){
 const c=this.controlled,menu=(title,actions)=>{this.game.pause();this.app.shell.show('yardStation',{title,actions:[...actions,['Back',()=>{this.app.shell.hide();this.game.resume();}]]});},close=fn=>()=>{this.app.shell.hide();this.game.resume();fn();};
 if(i===0)this.note('Move, sprint, crouch and jump the low ledge. R1 / F takes cover.',8);
 if(i===1){for(const [n,type]of Object.keys(G.content.vehicles).entries()){const v=this.cars[n];for(const id of v.occupants.filter(Boolean)){const a=this.actors.find(a=>a.id===id);if(a){a.vehicle=null;a.seat=null;a.x=1990;a.y=1450;}}const d=G.content.vehicles[type];Object.assign(v,{type,color:d.color,hp:d.hp,maxHP:d.hp,x:2000+n*60,y:1660,facing:0,speed:0,vx:0,vy:0,traffic:false,police:false,occupants:Array(d.seats).fill(null),nav:null});}this.note('Six cars ready. Test reverse, handbrake, walls and blocked doors.',8);}
 if(i===2){const target=this.actors.find(a=>a.id==='guard0');Object.assign(target,{dead:false,down:0,hp:300,x:2260,y:1520,zone:'city',enabled:true,suspicion:1});c.reserve={pistol:72,auto:120,shotgun:36};c.armor=40;this.note('Three weapons. Reload. Close range melee. Use the low cover.',8);}
 if(i===3){const witness=this.actors.find(a=>a.id==='ped0');Object.assign(witness,{x:c.x+40,y:c.y,zone:'city',enabled:true,dead:false,panic:0});this.crime(c,1,'Test-yard vehicle theft');this.note('A report takes 1.6 seconds. Break sight behind the wall.',8);}
 if(i===4)menu('Police test',['1','2','3','4'].map(tier=>['Heat '+tier,close(()=>G.raiseHeat(this,Number(tier),c,'Test-yard dispatch'))]));
 if(i===5){const a=this.crew.find(a=>a!==c);Object.assign(a,{hp:0,down:45,dead:false,vehicle:null,seat:null,x:c.x+45,y:c.y,zone:c.zone});for(const v of this.cars)v.occupants=v.occupants.map(id=>id===a.id?null:id);this.note('Switch crew, change tasks, then revive the downed member.',8);}
 if(i===6)menu('View round trips', [['Records · top-down',close(()=>this.portal(c,'records',{x:80,y:320}))],['Service gantry · side-scroll',close(()=>{this.switchTo('teo');this.portal(this.controlled,'gantry',{x:48,z:16});})]]);
 if(i===7)menu('Lifecycle test',[['Save checkpoint',close(()=>this.checkpoint())],['Restore checkpoint',close(()=>this.app.retry())],['Restart yard',close(()=>this.app.start({yard:true}))],['Start attract loop',close(()=>this.app.start({demo:true}))]]);
};
})();
