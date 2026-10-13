/* IONWAKE mission simulation. Positions use x right, y up, z forward. */
(() => {
  'use strict';
  const E=My3D2dge,TAU=Math.PI*2,clamp=E.clamp,lerp=E.lerp;
  const difficulty={cadet:{damage:.55,rate:1.25,hp:.82},pilot:{damage:1,rate:1,hp:1},ace:{damage:1.3,rate:.78,hp:1.2}};
  function segmentSphere(a,b,c,r){const v=[b.x-a.x,b.y-a.y,b.z-a.z],w=[c.x-a.x,c.y-a.y,c.z-a.z],vv=v[0]**2+v[1]**2+v[2]**2,t=vv?clamp((v[0]*w[0]+v[1]*w[1]+v[2]*w[2])/vv,0,1):0;return(a.x+v[0]*t-c.x)**2+(a.y+v[1]*t-c.y)**2+(a.z+v[2]*t-c.z)**2<=r*r;}
  const schedule=[
    [.5,'radio','MICA','Kite, the array is dark. Stay on my wing. We can still open a path.'],
    [1,'message','THE GLASS REACH','01 / SIGNAL RECOVERY','Steer with WASD. Hold Space to fire.'],
    [5,'wave','line',5], [10,'radio','CONTROL','Pink energy can be returned. Roll with Q or E when it reaches you.'],
    [13,'pickup','repair',0,20], [16,'wave','sweep',5], [20,'gate',-12,24,19,22],
    [23,'pickup','upgrade',-12,24], [26,'wave','v',7],
    [30,'radio','MICA','Those pylons are solid. Use the open gaps. Boost and brake can change your timing.'],
    [33,'pylons',0], [37,'wave','turrets',3], [40,'pickup','pulse',17,18], [43,'wave','sweep',5],
    [48,'phase','rescue'], [49,'radio','MICA','Three pursuers on my tail. Kite, clear them before they pin me down!'],
    [50,'message','MICA NEEDS COVER','PARTNER RESCUE','Destroy the three marked pursuers.'], [51,'wave','pursuers',3],
    [58,'wave','line',4], [65,'pickup','repair',0,21], [70,'wave','v',5], [77,'resolveRescue'],
    [80,'phase','choice'], [81,'radio','CONTROL','The channel splits ahead. Left for the service cut. Right for open water.'],
    [82,'routeGates'], [89,'chooseRoute'], [92,'checkpoint','The split'], [94,'phase','route'],
    [96,'routeEvent',0], [101,'wave','sweep',5], [107,'routeEvent',1], [114,'wave','v',6], [120,'routeEvent',2],
    [126,'phase','array'], [127,'radio','MICA','The carrier is drawing power from the array. Its side relays are exposed.'],
    [128,'message','THE SUNKEN ARRAY','03 / FINAL APPROACH','Clear the patrols. Prepare for the carrier.'],
    [130,'pickup','repair',0,22], [132,'pickup','upgrade',0,22], [133,'wave','turrets',4],
    [138,'pylons',1], [141,'wave','sweep',7], [147,'gate',15,24,18,22],
    [150,'pickup','pulse',15,24], [152,'wave','v',7], [160,'wave','line',6],
    [165,'radio','CONTROL','Carrier in range. Break both side relays. Then strike the open core.'],
    [169,'checkpoint','Carrier approach'], [170,'boss']
  ];
  class Mission {
    constructor({difficulty:mode='pilot',aimAssist=true,onEvent=()=>{},snapshot=null,retries=0}={}) {
      this.mode=mode;this.diff=difficulty[mode]||difficulty.pilot;this.aimAssist=aimAssist;this.onEvent=onEvent;this.elapsed=0;this.distance=0;this.status='flight';this.phase='approach';this.route='pending';
      this.player={x:0,y:21,z:12,vx:0,vy:0,roll:0,rollTime:0,rollDir:1,rollCooldown:0,invincible:0,hp:100,energy:100,charge:0,overdrive:0,weapon:1,bombs:3,shotCooldown:0,boost:0,brake:0,driveLock:false};
      this.enemies=[];this.shots=[];this.hostile=[];this.pickups=[];this.obstacles=[];this.effects=[];this.rings=[];this.particles=[];this.groups=new Map();this.uid=1;this.eventIndex=0;this.score=0;this.chain=0;this.chainTime=0;this.multiplier=1;this.kills=0;this.spawned=0;this.shotCount=0;this.hitCount=0;this.returns=0;this.damageTaken=0;this.pickupCount=0;this.maxChain=0;this.retries=retries;this.rescueKills=0;this.ally={state:'formation',saved:false,x:-13,y:25,z:120};this.boss=null;this.checkpoint=null;this.speed=68;this.damageFlash=0;this.pulseFlash=0;this.finishedAt=0;this.exitTime=0;this.nextAllyShot=4;this.aimTarget=null;
      if(snapshot)this.restore(snapshot);
    }
    emit(type,data={}){this.onEvent({type,...data});}
    event(e) {
      const [at,type,...a]=e;
      if(type==='radio'){if(a[0]==='MICA'&&this.ally.state==='lost')a[0]='CONTROL';this.emit('radio',{name:a[0],text:a[1]});}
      else if(type==='message')this.emit('message',{title:a[0],kicker:a[1],text:a[2]});
      else if(type==='wave')this.wave(a[0],a[1]);
      else if(type==='pickup')this.pickup(a[0],a[1],a[2],this.distance+500);
      else if(type==='gate')this.obstacles.push({type:'frame',x:a[0],y:a[1],z:this.distance+620,w:a[2],h:a[3],passed:false});
      else if(type==='pylons')this.pylons(a[0]);
      else if(type==='phase')this.phase=a[0];
      else if(type==='resolveRescue')this.resolveRescue();
      else if(type==='routeGates'){this.rings.push({x:-25,y:23,z:this.distance+530,r:12,type:'route',life:15},{x:25,y:23,z:this.distance+530,r:12,type:'route',life:15});}
      else if(type==='chooseRoute'){if(this.route==='pending')this.selectRoute(this.player.x<-4?'cut':'water');}
      else if(type==='routeEvent')this.routeEvent(a[0]);
      else if(type==='checkpoint')this.saveCheckpoint(a[0]);
      else if(type==='boss')this.startBoss();
    }
    wave(pattern,count) {
      const group=this.uid++;this.groups.set(group,{total:count,kills:0,escaped:0});
      for(let i=0;i<count;i++){
        let x=(i-(count-1)/2)*13,y=24+Math.sin(i*.9)*10,z=this.distance+560+i*18,type='drone',amp=5,speed=4;
        if(pattern==='sweep'){x=(i-(count-1)/2)*14;y=29;type='interceptor';amp=14;speed=18;}
        if(pattern==='v'){x=(i-(count-1)/2)*12;y=18+Math.abs(i-(count-1)/2)*4;z=this.distance+500+Math.abs(i-(count-1)/2)*26;amp=3;}
        if(pattern==='turrets'){x=(i%2?-1:1)*(24+(i>>1)*15);y=3;z=this.distance+500+i*75;type='turret';amp=0;speed=0;}
        if(pattern==='pursuers'){x=(i-1)*14;y=27+(i%2)*7;z=this.distance+230+i*18;type='pursuer';amp=9;this.ally.state='pursued';}
        this.enemies.push({id:this.uid++,type,pattern,group,x,y,z,baseX:x,baseY:y,age:0,phase:i*1.7,amp,speed,hp:(type==='turret'?6:type==='pursuer'?5:type==='interceptor'?3:2)*this.diff.hp,r:type==='turret'?4.8:4,fire:(1.2+i*.34)*this.diff.rate,flash:0,dead:false});this.spawned++;
      }
    }
    pickup(type,x,y,z){this.pickups.push({id:this.uid++,type,x,y,z,age:0,r:type==='repair'?7:5,dead:false});}
    selectRoute(route){if(this.route!=='pending')return;this.route=route;this.emit('toast',{text:route==='cut'?'SERVICE CUT SELECTED':'OPEN WATER SELECTED'});this.emit('radio',{name:'CONTROL',text:route==='cut'?'Service cut confirmed. Small gaps, useful supplies. Watch your wings.':'Open water confirmed. There is room to move, but more patrols.'});}
    pylons(variant){for(let i=0;i<6;i++){this.obstacles.push({type:'pylon',x:((i%3)-1)*23+(variant?8:-3),y:6+(i%2)*4,z:this.distance+430+i*64,h:32+(i%2)*8,w:8,d:10,passed:false});}}
    routeEvent(i){if(this.route==='cut'){const x=[-14,15,0][i];this.obstacles.push({type:'frame',x,y:23+(i%2)*5,z:this.distance+390,w:16,h:19,passed:false});this.pickup(i===0?'upgrade':i===1?'repair':'pulse',x,23+(i%2)*5,this.distance+390);if(i===1)this.pylons(1);}else{this.wave(i===1?'sweep':'line',5);if(i===1)this.pickup('repair',20,25,this.distance+400);}}
    saveCheckpoint(name){
      this.player.hp=Math.max(this.player.hp,65);this.player.energy=100;
      this.checkpoint={name,elapsed:this.elapsed,distance:this.distance,phase:this.phase,route:this.route,score:this.score,kills:this.kills,spawned:this.spawned,shotCount:this.shotCount,hitCount:this.hitCount,returns:this.returns,damageTaken:this.damageTaken,pickupCount:this.pickupCount,maxChain:this.maxChain,rescueKills:this.rescueKills,ally:{...this.ally},player:{hp:Math.max(85,this.player.hp),bombs:Math.max(2,this.player.bombs),weapon:Math.max(2,this.player.weapon)}};
      this.emit('checkpoint',{name});this.emit('toast',{text:'CHECKPOINT · HULL STABILISED'});
    }
    restore(s){for(const k of ['elapsed','distance','phase','route','score','kills','spawned','shotCount','hitCount','returns','damageTaken','pickupCount','maxChain','rescueKills'])this[k]=s[k];this.ally={...s.ally};Object.assign(this.player,s.player,{x:0,y:21,z:this.distance+12});this.checkpoint=JSON.parse(JSON.stringify(s));this.eventIndex=schedule.findIndex(e=>e[0]>this.elapsed);if(this.eventIndex<0)this.eventIndex=schedule.length;this.emit('toast',{text:'CHECKPOINT RESTORED'});}
    resolveRescue(){if(this.ally.state!=='pursued')return;if(this.rescueKills>=3){this.ally.saved=true;this.ally.state='saved';this.addScore(1500,false);this.emit('radio',{name:'MICA',text:'All clear! I owe you one. I will cover your run on the carrier.'});this.emit('toast',{text:'PARTNER SAFE +1500'});}else{this.ally.state='lost';this.emit('radio',{name:'MICA',text:'My drive is hit. I am pulling out. Keep going, Kite. The Reach needs that signal.'});}for(const e of this.enemies)if(e.type==='pursuer')e.dead=true;}
    startBoss(){this.phase='boss';this.enemies=[];this.hostile=[];this.obstacles=[];this.pickups=[];this.boss={x:0,y:27,z:this.distance+230,t:0,left:95*this.diff.hp,right:95*this.diff.hp,core:155*this.diff.hp,max:345*this.diff.hp,stage:'relays',shotTimer:2.6,salvoTimer:7,warning:0,beamY:20,coreOpen:false,flash:0,death:0};this.player.hp=Math.max(65,this.player.hp);this.emit('boss');this.emit('message',{kicker:'RELAY CARRIER / 01',title:'THE WARDEN',text:'Break both side relays. Strike the core when it opens.'});}
    getAim(){const p=this.player;return{x:p.x*2.52,y:p.y+(p.y-22)*2.5,z:p.z+170};}
    targets(){const list=this.enemies.filter(e=>!e.dead&&e.z>this.player.z-2);if(this.boss&&this.boss.stage!=='dead'){const b=this.boss;const core=b.left<=0&&b.right<=0;for(const [part,dx]of[['left',-22],['right',22]])if(b[part]>0)list.push({id:part,boss:true,x:b.x+dx,y:b.y+1,z:b.z-8,r:7,hp:b[part],open:true});if(core)list.push({id:'core',boss:true,x:b.x,y:b.y,z:b.z-14,r:7.2,hp:b.core,open:b.coreOpen});}return list;}
    fire(){
      const p=this.player;if(p.shotCooldown>0)return;p.shotCooldown=p.overdrive>0?.078:.13;let aim=this.getAim();this.aimTarget=null;
      if(this.aimAssist){let best=1e9;for(const e of this.targets()){if(e.open===false)continue;const dz=e.z-p.z;if(dz<15||dz>800)continue;const k=dz/(aim.z-p.z),x=p.x+(aim.x-p.x)*k,y=p.y+(aim.y-p.y)*k,dist=Math.hypot(e.x-x,e.y-y),limit=6+dz*.035;if(dist<limit&&dist/limit<best){best=dist/limit;this.aimTarget=e;}}if(this.aimTarget)aim={x:this.aimTarget.x,y:this.aimTarget.y,z:this.aimTarget.z};}
      const n=p.weapon>=2||p.overdrive>0?2:1;
      for(let side=0;side<n;side++){const x=p.x+(n===1?0:side===0?-3:3),y=p.y+.5,z=p.z+3.5,dx=aim.x-x,dy=aim.y-y,dz=aim.z-z,len=Math.hypot(dx,dy,dz),speed=760;this.shots.push({x,y,z,px:x,py:y,pz:z,vx:dx/len*speed,vy:dy/len*speed,vz:dz/len*speed,life:1.65,damage:p.overdrive>0?1.65:1,returned:false});this.shotCount++;}
      this.emit('sfx',{name:p.overdrive>0?'overlaser':'ionlaser'});
    }
    startRoll(dir){const p=this.player;if(p.rollCooldown>0||p.energy<12)return;p.rollDir=dir;p.rollTime=.62;p.rollCooldown=1.15;p.energy=Math.max(0,p.energy-12);this.emit('sfx',{name:'ionroll'});}
    pulse(){const p=this.player;if(p.bombs<=0||this.status!=='flight')return;p.bombs--;this.pulseFlash=.5;this.effects.push({type:'pulse',x:p.x,y:p.y,z:p.z+35,t:0,life:1.1,size:1});this.emit('sfx',{name:'ionpulse'});this.emit('toast',{text:'PULSE RELEASED'});this.hostile=[];for(const e of this.enemies)if(!e.dead&&e.z-p.z<650){e.hp-=12;e.flash=.3;if(e.hp<=0)this.destroy(e);}if(this.boss){for(const e of this.targets())if(e.boss&&e.open!==false)this.hitBoss(e.id,20);} }
    addScore(value,chain=true){if(chain){this.chain++;this.chainTime=5;this.maxChain=Math.max(this.maxChain,this.chain);this.multiplier=Math.min(4,1+Math.floor(this.chain/5));}this.score+=Math.round(value*(chain?this.multiplier:1));}
    burst(x,y,z,size=1,c='#ffb477'){this.effects.push({type:'burst',x,y,z,t:0,life:.7*size,size,c});for(let i=0;i<Math.round(12*size);i++){const a=i*2.399;this.particles.push({x,y,z,vx:Math.cos(a)*(10+i%4*8)*size,vy:Math.sin(a)*(12+i%5*6)*size,vz:(Math.sin(i*7.1)*24-8)*size,life:.5+(i%6)*.12,max:1.1,size:.25+(i%3)*.22,c:i%3?'#ffc078':'#fff0c7'});} }
    destroy(e){if(e.dead)return;e.dead=true;this.kills++;this.addScore(e.type==='turret'?160:e.type==='pursuer'?250:e.type==='interceptor'?140:100);this.burst(e.x,e.y,e.z,e.type==='turret'?1.4:1);this.emit('sfx',{name:'ionexplode'});const g=this.groups.get(e.group);if(g){g.kills++;if(g.kills===g.total){this.addScore(250,false);this.emit('toast',{text:'FORMATION CLEAR +250'});if(this.kills%3===0)this.pickup('charge',e.x,e.y,e.z);}}
      if(e.type==='pursuer'){this.rescueKills++;if(this.rescueKills===3)this.resolveRescue();}
    }
    takeDamage(n,source='shot'){const p=this.player;if(p.invincible>0||this.status!=='flight')return;const damage=n*this.diff.damage;p.hp=Math.max(0,p.hp-damage);this.damageTaken+=damage;p.invincible=1.0;this.damageFlash=.65;this.chain=0;this.multiplier=1;this.chainTime=0;this.emit('sfx',{name:'ionhurt'});this.emit('damage',{damage,source});if(p.hp<=0){this.status='dead';this.exitTime=0;this.burst(p.x,p.y,p.z,3);this.emit('sfx',{name:'ionpulse'});}}
    enemyShot(x,y,z,type='energy',offset=0){const p=this.player,tx=p.x+p.vx*.22+offset,ty=p.y+p.vy*.18,dx=tx-x,dy=ty-y,dz=p.z-z,len=Math.hypot(dx,dy,dz)||1,speed=type==='missile'?220:175;this.hostile.push({x,y,z,px:x,py:y,pz:z,vx:dx/len*speed,vy:dy/len*speed,vz:dz/len*speed,life:5,type,r:type==='missile'?1.5:1.1,age:0});}
    hitBoss(part,damage){const b=this.boss;if(!b||b.stage==='dead'||b[part]<=0)return;if(part==='core'&&!b.coreOpen)return;b[part]=Math.max(0,b[part]-damage);b.flash=.09;
      if(b[part]===0){const dx=part==='left'?-22:part==='right'?22:0;this.burst(b.x+dx,b.y,b.z,part==='core'?5:2.8);this.addScore(part==='core'?4000:1000,false);this.emit('sfx',{name:'ionpulse'});if(part!=='core'){this.emit('toast',{text:'RELAY DESTROYED +1000'});if(b.left<=0&&b.right<=0){b.stage='core';b.t=0;b.shotTimer=2.2;b.salvoTimer=5;this.emit('radio',{name:'CONTROL',text:'Both relays are down. Wait for the core to open, then fire!'});}}else{b.stage='dead';b.death=0;this.status='extraction';this.finishedAt=this.elapsed;this.hostile=[];this.shots=[];this.exitTime=0;this.emit('victory');this.emit('message',{kicker:'SIGNAL RESTORED',title:'A WAY HOME',text:this.ally.saved?'Mica is clear. Bring it home, Kite.':'The evacuation channel is open.'});this.emit('radio',{name:this.ally.saved?'MICA':'CONTROL',text:this.ally.saved?'The lights are coming back. You did it, Kite. Let us go home.':'Signal restored. All evacuation ships, follow the lights. Kite, you are clear.'});}}
    }
    updateBoss(dt){const b=this.boss;if(!b)return;b.t+=dt;b.motionTime=(b.motionTime||0)+dt;b.flash=Math.max(0,b.flash-dt);b.x=Math.sin(b.motionTime*.32)*16;b.y=25+Math.sin(b.motionTime*.55)*7;b.z=this.distance+205+Math.sin(b.motionTime*.2)*12;
      if(b.stage==='dead'){b.death+=dt;if(Math.floor(b.death*9)!==Math.floor((b.death-dt)*9)&&b.death<3)this.burst(b.x+Math.sin(b.death*79)*22,b.y+Math.cos(b.death*34)*8,b.z+Math.sin(b.death*3)*9,1.8);return;}
      b.coreOpen=b.stage==='core'&&(b.t%4.5)<2.6;b.shotTimer-=dt;b.salvoTimer-=dt;b.warning=Math.max(0,b.warning-dt);
      if(b.shotTimer<=0){b.shotTimer=(b.stage==='core'?.95:1.5)*this.diff.rate;const parts=this.targets().filter(t=>t.boss);for(const t of parts)this.enemyShot(t.x,t.y,t.z-5,'energy',Math.sin(b.t*3)*8);this.emit('sfx',{name:'enemyfire'});}
      if(b.salvoTimer<1.4&&b.salvoTimer>0){b.warning=b.salvoTimer;if(!b.warned){b.warned=true;b.beamY=this.player.y;this.emit('warning',{text:'MISSILE SWEEP · CHANGE ALTITUDE'});this.emit('sfx',{name:'warning'});}}
      if(b.salvoTimer<=0){b.salvoTimer=(b.stage==='core'?6.5:8.3)*this.diff.rate;b.warned=false;for(let i=-3;i<=3;i++){const x=i*12,y=b.beamY,z=b.z-9;this.hostile.push({x,y,z,px:x,py:y,pz:z,vx:0,vy:0,vz:-215,life:4,type:'missile',r:1.5,age:0});}}
      if(this.ally.saved){this.nextAllyShot-=dt;if(this.nextAllyShot<=0){this.nextAllyShot=6;const targets=this.targets().filter(t=>t.boss&&t.open!==false);if(targets.length){const target=targets[0];this.shots.push({x:this.ally.x,y:this.ally.y,z:this.ally.z,px:this.ally.x,py:this.ally.y,pz:this.ally.z,vx:0,vy:0,vz:0,life:.25,ally:true,target:{...target}});this.hitBoss(target.id,4);}}}
    }
    update(dt,input={}) {
      if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);this.elapsed+=dt;const p=this.player;
      this.damageFlash=Math.max(0,this.damageFlash-dt*1.5);this.pulseFlash=Math.max(0,this.pulseFlash-dt);p.invincible=Math.max(0,p.invincible-dt);p.shotCooldown=Math.max(0,p.shotCooldown-dt);p.rollCooldown=Math.max(0,p.rollCooldown-dt);p.overdrive=Math.max(0,p.overdrive-dt);
      let mx=input.move?.[0]||0,my=input.move?.[1]||0;if(input.invert)my=-my;const sense=input.sensitivity||1;
      if(input.pointer){mx=clamp((input.pointer.x-p.x)*.16,-1,1);my=clamp((p.y-input.pointer.y)*.16,-1,1);}
      if(this.status==='flight'){
        p.vx=E.approach(p.vx,mx*39*sense,dt*180);p.vy=E.approach(p.vy,-my*31*sense,dt*155);p.x=clamp(p.x+p.vx*dt,-31,31);p.y=clamp(p.y+p.vy*dt,5,39);
        if(input.rollL)this.startRoll(-1);if(input.rollR)this.startRoll(1);if(input.bomb)this.pulse();
        if(p.energy<=1&&(input.boost||input.brake))p.driveLock=true;if(!input.boost&&!input.brake&&p.energy>=18)p.driveLock=false;
        p.boost=input.boost&&!p.driveLock&&p.energy>1?1:0;p.brake=!p.boost&&input.brake&&!p.driveLock&&p.energy>1?1:0;p.energy=clamp(p.energy+dt*(p.boost?-26:p.brake?-15:23),0,100);
        this.speed=lerp(this.speed,p.boost?116:p.brake?37:68,1-Math.exp(-dt*5));
        if(input.fire||input.autoFire)this.fire();
      }else if(this.status==='extraction'){this.exitTime+=dt;this.speed=lerp(this.speed,130,dt*1.8);p.x=lerp(p.x,0,dt*1.5);p.y=lerp(p.y,33,dt*.8);p.vx*=Math.exp(-dt*4);p.boost=1;if(this.exitTime>=9){this.status='success';this.emit('complete');}}
      else if(this.status==='dead'){this.exitTime+=dt;this.speed*=Math.exp(-dt*.5);if(this.exitTime>1.5){this.status='failure';this.emit('failure');}}
      this.distance+=this.speed*dt;p.z=this.distance+12+(p.boost?4:0)-(p.brake?4:0);if(p.rollTime>0){p.rollTime=Math.max(0,p.rollTime-dt);p.roll=p.rollDir*(1-p.rollTime/.62)*TAU;}else p.roll=lerp(p.roll%TAU,-p.vx*.016,1-Math.exp(-dt*9));
      if(this.status==='flight'){while(this.eventIndex<schedule.length&&this.elapsed>=schedule[this.eventIndex][0])this.event(schedule[this.eventIndex++]);}
      this.chainTime-=dt;if(this.chainTime<=0){this.chain=0;this.multiplier=1;}
      this.ally.x=p.x*.2-17+Math.sin(this.elapsed*.35)*7;this.ally.y=27+Math.sin(this.elapsed*.55)*4;this.ally.z=this.distance+(this.ally.state==='pursued'?265:90);
      for(const e of this.enemies){if(e.dead)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.x=e.baseX+Math.sin(e.age*1.5+e.phase)*e.amp;e.y=e.baseY+Math.cos(e.age*1.2+e.phase)*(e.type==='turret'?0:3);e.z+=e.speed*dt;if(e.type==='pursuer')e.z=this.distance+200+Math.sin(e.age*.6+e.phase)*25;e.fire-=dt;const rel=e.z-p.z;if(rel<390&&rel>45&&e.fire<=0){e.fire=(e.type==='turret'?2.8:2.15)*this.diff.rate;this.enemyShot(e.x,e.y+1,e.z,e.type==='turret'?'missile':'energy');}if(rel<-18){e.dead=true;const g=this.groups.get(e.group);if(g)g.escaped++;}if(rel<8&&rel>-8&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+2)this.takeDamage(20,'collision');}
      this.updateBoss(dt);
      const targets=this.targets();
      for(const s of this.shots){s.life-=dt;if(s.ally)continue;s.px=s.x;s.py=s.y;s.pz=s.z;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;if(s.life<=0)continue;for(const e of targets){if(e.dead||e.open===false)continue;if(segmentSphere({x:s.px,y:s.py,z:s.pz},s,e,e.r)){s.life=-1;if(!s.returned)this.hitCount++;if(e.boss)this.hitBoss(e.id,s.damage);else{e.hp-=s.damage;e.flash=.09;if(e.hp<=0)this.destroy(e);}this.effects.push({type:'hit',x:s.x,y:s.y,z:s.z,t:0,life:.18,size:1});break;}}}
      for(const s of this.hostile){s.life-=dt;s.age+=dt;s.px=s.x;s.py=s.y;s.pz=s.z;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;if(s.life<=0)continue;
        if(segmentSphere({x:s.px,y:s.py,z:s.pz},s,p,p.rollTime>0&&s.type==='energy'?8:2.7+s.r)){
          if(p.rollTime>0&&s.type==='energy'){s.life=-1;this.returns++;p.charge=clamp(p.charge+26,0,100);this.addScore(60,false);this.emit('sfx',{name:'return'});let target=targets.find(t=>t.open!==false)||this.getAim();const dx=target.x-s.x,dy=target.y-s.y,dz=target.z-s.z,len=Math.hypot(dx,dy,dz)||1;this.shots.push({x:s.x,y:s.y,z:s.z,px:s.x,py:s.y,pz:s.z,vx:dx/len*650,vy:dy/len*650,vz:dz/len*650,life:2,damage:4,returned:true});if(p.charge>=100){p.charge=0;p.overdrive=8;this.emit('toast',{text:'OVERDRIVE · 8 SECONDS'});this.emit('sfx',{name:'powerup'});}}
          else{s.life=-1;this.takeDamage(s.type==='missile'?14:9);}
        }if(s.z<p.z-25)s.life=-1;
      }
      for(const q of this.pickups){q.age+=dt;const rel=q.z-p.z;if(rel<6&&rel>-6&&Math.hypot(q.x-p.x,q.y-p.y)<q.r+1){q.dead=true;this.pickupCount++;if(q.type==='repair'){p.hp=Math.min(100,p.hp+28);this.emit('toast',{text:'HULL REPAIR +28'});}else if(q.type==='upgrade'){p.weapon=2;this.addScore(150,false);this.emit('toast',{text:'TWIN CANNON ONLINE'});}else if(q.type==='pulse'){p.bombs=Math.min(5,p.bombs+1);this.emit('toast',{text:'PULSE SUPPLY +1'});}else{p.charge=clamp(p.charge+35,0,100);if(p.charge>=100){p.charge=0;p.overdrive=8;}this.addScore(100,false);}this.emit('sfx',{name:'powerup'});this.rings.push({x:q.x,y:q.y,z:q.z,r:4,type:'collect',life:.5});}if(rel<-12)q.dead=true;}
      for(const o of this.obstacles){const rel=o.z-p.z;if(Math.abs(rel)<8&&!o.passed){if(o.type==='pylon'){if(Math.abs(p.x-o.x)<o.w*.5+2.3&&p.y<o.y+o.h*.5+1&&p.y>o.y-o.h*.5-1){this.takeDamage(24,'structure');o.passed=true;}}
          else{const dx=Math.abs(p.x-o.x),dy=Math.abs(p.y-o.y),hull=p.rollTime>0?1.4:2.4;if(dx<o.w*.5-hull&&dy<o.h*.5-hull){o.passed=true;this.addScore(150,false);p.charge=clamp(p.charge+12,0,99);this.emit('toast',{text:'CLEAN PASS +150'});}else if((dx<o.w*.5+6&&dy<o.h*.5+5)&&(dx>o.w*.5-hull||dy>o.h*.5-hull)){this.takeDamage(24,'structure');o.passed=true;}}
        }if(rel<-18)o.dead=true;
      }
      for(const f of this.effects){f.t+=dt;if(f.type==='pulse')f.size+=dt*180;}
      for(const q of this.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=12*dt;}
      for(const r of this.rings){r.life-=dt;if(r.type==='collect')r.r+=dt*20;if(r.type==='route'&&this.route==='pending'&&Math.abs(r.z-p.z)<this.speed*dt+2&&Math.hypot(p.x-r.x,p.y-r.y)<r.r)this.selectRoute(r.x<0?'cut':'water');}
      this.enemies=this.enemies.filter(e=>!e.dead);this.shots=this.shots.filter(s=>s.life>0).slice(-180);this.hostile=this.hostile.filter(s=>s.life>0).slice(-130);this.pickups=this.pickups.filter(q=>!q.dead);this.obstacles=this.obstacles.filter(o=>!o.dead);this.effects=this.effects.filter(f=>f.t<f.life).slice(-80);this.particles=this.particles.filter(q=>q.life>0).slice(-250);this.rings=this.rings.filter(r=>r.life>0);
    }
    summary(){const bonus=this.status==='success'?Math.round(this.player.hp)*10:0,total=this.score+bonus,rank=this.status!=='success'?'—':total>=25000?'S':total>=17500?'A':total>=10500?'B':'C';return{score:total,baseScore:this.score,hullBonus:bonus,rank,kills:this.kills,targets:this.spawned,accuracy:this.shotCount?Math.min(100,Math.round(this.hitCount/this.shotCount*100)):0,returns:this.returns,chain:this.maxChain,route:this.route==='pending'?'NOT REACHED':this.route==='cut'?'SERVICE CUT':'OPEN WATER',rescued:this.ally.saved,hull:Math.round(this.player.hp),time:this.finishedAt||this.elapsed,retries:this.retries,mode:this.mode};}
  }
  window.IonMission=Mission;window.IonCollision={segmentSphere};
})();
