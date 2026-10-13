/* Breakwater skating simulation. World units, seconds, and points. Original code, MIT. */
(function(root){'use strict';const E=root.My3D2dge,L=root.BreakwaterLevel,PI=Math.PI,TAU=PI*2;
const GOALS=[
 {id:'first',name:'First shift',detail:'Bank 8,000 points in one session.',target:8000,x:85,y:165},
 {id:'local',name:'Local knowledge',detail:'Bank 25,000 points in one session.',target:25000,x:85,y:165},
 {id:'yard',name:'Own the yard',detail:'Bank 60,000 points in one session.',target:60000,x:85,y:165},
 {id:'line',name:'A line to remember',detail:'Land one combo worth 6,000 points.',target:6000,x:85,y:165},
 {id:'letters',name:'Make a BREAK',detail:'Collect B · R · E · A · K in one session.',target:5,x:59,y:165},
 {id:'signals',name:'Light the way',detail:'Collect the three signals to open the bridge.',target:3,x:38,y:174},
 {id:'rail',name:'End to end',detail:'Grind at least 80% of the Dock rail. Land it.',target:1,x:68,y:165},
 {id:'flipgap',name:'Saltwater flip',detail:'Land a flip over the Saltwater Gap.',target:1,x:126,y:165},
 {id:'gaps',name:'Mind the gaps',detail:'Land all three named gaps in one session.',target:3,x:55,y:133},
 {id:'secret',name:'Off the clock',detail:'Find the hidden signal on the high service deck.',target:1,x:201,y:36}
];
const blankInput=()=>({left:false,right:false,up:false,down:false,jump:false,jumpReleased:false,jumpPressed:false,flipPressed:false,grabPressed:false,grind:false,manual:false,specialPressed:false,axis:0});
class SkateSimulation{
 constructor(saved={},hooks={}){this.saved=saved;this.hooks=hooks;this.saved.goals=Array.isArray(saved.goals)?saved.goals.slice(0,10).map(Boolean):Array(10).fill(false);while(this.saved.goals.length<10)this.saved.goals.push(false);this.assist=saved.assist!==false;this.reset('session');}
 emit(k,...a){if(this.hooks[k])this.hooks[k](...a);}
 reset(mode='session'){this.mode=mode;this.time=120;this.elapsed=0;this.score=0;this.bestCombo=0;this.bestTricks=0;this.special=0;this.letters=new Set();this.beacons=new Set();this.gaps=new Set();this.secretFound=false;this.newGoals=[];this.pendingGaps=[];this.pendingDock=false;this.pendingFlipGap=false;this.gateOpen=!!this.saved.goals[5];this.finished=false;this.overtime=0;this.bails=0;this.bankDisplay=null;this.repeat={};this.combo={base:0,mult:0,parts:[],timer:0};this.p={x:L.spawn.x,y:L.spawn.y,z:0,dir:L.spawn.dir,speed:0,mode:'ground',crouch:0,grounded:true,vz:0,airVX:0,airVY:0,spin:0,switch:false,anim:'',animProgress:0,animTime:0,animDuration:0,airTime:0,airHadFlip:false,balance:0,balanceTime:0,grind:null,grindT:0,grindSign:1,grindDistance:0,bailTimer:0,landing:0,trailTimer:0,lastSafe:{x:L.spawn.x,y:L.spawn.y,dir:L.spawn.dir},safeClock:0};}
 addTrick(name,base){const n=this.repeat[name]||0;this.repeat[name]=n+1;const value=Math.max(15,Math.round(base*Math.max(.15,Math.pow(.78,n))));this.combo.base+=value;this.combo.mult=Math.min(30,this.combo.mult+1);this.combo.parts.push(name);this.combo.timer=.32;this.bankDisplay=null;this.special=E.clamp(this.special+base*.008,0,100);this.emit('trick',name,value);}
 startAnimation(anim,name,base,duration){const p=this.p;if(p.animTime>.08)return false;p.anim=anim;p.animTime=duration;p.animDuration=duration;p.animProgress=0;if(['flip','heelflip','shove','special'].includes(anim))p.airHadFlip=true;this.addTrick(name,base);this.emit('sfx','trick');return true;}
 jump(power=0,vertical){const p=this.p;const speed=Math.max(9,p.speed);if(p.grind){p.ignoreRail=p.grind.id;p.railCooldown=.35;}p.mode='air';p.manualLinked=false;p.grounded=false;p.grind=null;p.vz=vertical===undefined?13+6*power:vertical;p.airVX=Math.cos(p.dir)*speed;p.airVY=Math.sin(p.dir)*speed;p.crouch=0;p.spin=0;p.airTime=0;p.airHadFlip=false;p.takeoff={x:p.x,y:p.y,z:p.z};p.anim='';p.animTime=0;p.animProgress=0;this.emit('sfx','ollie');}
 bail(reason='Lost your balance'){const p=this.p;if(p.mode==='bail')return;const lost=Math.round(this.combo.base*Math.max(1,this.combo.mult));this.bankDisplay={value:lost,parts:reason,bail:true,time:2};this.combo={base:0,mult:0,parts:[],timer:0};this.pendingGaps=[];this.pendingDock=false;this.pendingFlipGap=false;this.special=0;this.bails++;p.mode='bail';p.manualLinked=false;p.grounded=false;p.bailTimer=1.1;p.speed=0;p.anim='';p.animTime=0;p.grind=null;this.emit('bail',reason,lost);this.emit('sfx','bail');}
 progress(i){if(i<3)return this.score;if(i===3)return this.bestCombo;if(i===4)return this.letters.size;if(i===5)return this.beacons.size;if(i===6)return this.saved.goals[6]?1:0;if(i===7)return this.saved.goals[7]?1:0;if(i===8)return this.gaps.size;if(i===9)return this.saved.goals[9]?1:0;return 0;}
 complete(i){if(this.mode!=='session'||this.saved.goals[i])return;this.saved.goals[i]=true;this.newGoals.push(i);this.emit('goal',i,GOALS[i]);this.emit('save',this.saved);if(this.saved.goals.every(Boolean))this.emit('complete');}
 bank(){const c=this.combo;if(!c.mult)return;const total=Math.round(c.base*c.mult);this.score+=total;if(total>this.bestCombo){this.bestCombo=total;this.bestTricks=c.mult;}this.special=E.clamp(this.special+total/450,0,100);this.bankDisplay={value:total,parts:c.parts.slice(-5).join(' + '),bail:false,time:2.1,mult:c.mult};this.emit('bank',total,c.mult);this.emit('sfx','land');this.combo={base:0,mult:0,parts:[],timer:0};this.p.manualLinked=false;for(const id of this.pendingGaps)this.gaps.add(id);this.pendingGaps=[];if(this.pendingDock)this.complete(6);if(this.pendingFlipGap)this.complete(7);this.pendingDock=false;this.pendingFlipGap=false;[8000,25000,60000].forEach((v,i)=>{if(this.score>=v)this.complete(i);});if(this.bestCombo>=6000)this.complete(3);if(this.gaps.size>=3)this.complete(8);if(this.mode==='session'&&this.time<=0)this.finish();}
 finish(){if(this.finished)return;this.finished=true;if(this.mode==='session'){this.saved.best=Math.max(Number(this.saved.best)||0,this.score);this.saved.bestCombo=Math.max(Number(this.saved.bestCombo)||0,this.bestCombo);this.emit('save',this.saved);}this.emit('end');}
 tryGrind(c,dt){if(!c.grind||this.p.mode!=='air'||this.p.speed<5)return false;const p=this.p;for(const r of L.rails){if(p.railCooldown>0&&p.ignoreRail===r.id)continue;const dx=r.b[0]-r.a[0],dy=r.b[1]-r.a[1],t=((p.x-r.a[0])*dx+(p.y-r.a[1])*dy)/(r.len*r.len);if(t<-.06||t>1.06)continue;const u=E.clamp(t,0,1),x=r.a[0]+dx*u,y=r.a[1]+dy*u,d=Math.hypot(p.x-x,p.y-y);const dot=(p.airVX*dx+p.airVY*dy)/(Math.hypot(p.airVX,p.airVY)*r.len||1);if((t<.01&&dot<0)||(t>.99&&dot>0))continue;if(d>(this.assist?2.6:1.8)||Math.abs(p.z-r.z)>2.5||Math.abs(dot)<.52)continue;p.x=x;p.y=y;p.z=r.z;p.vz=0;p.mode='grind';p.grounded=false;p.grind=r;p.grindT=u;p.grindSign=dot>=0?1:-1;p.grindDistance=0;p.balance=0;p.balanceTime=0;p.dir=Math.atan2(dy,dx)+(p.grindSign<0?PI:0);p.spin=0;p.anim='';p.animTime=0;p.speed=Math.max(19,p.speed);const name=c.up?'Nosegrind':c.down?'5-0 Grind':c.left||c.right?'Boardslide':'50-50 Grind';this.addTrick(name,500);this.emit('sfx','grind');return true;}return false;}
 beginManual(){const p=this.p;p.mode='manual';if(!p.manualLinked){p.balance=0;p.balanceTime=0;p.manualLinked=true;this.addTrick('Manual',100);}}
 updateBalance(c,dt,kind){const p=this.p;p.balanceTime+=dt;const drift=(.15+p.balanceTime*.1)*(this.assist?.72:1);p.balance+=(Math.sin(p.balanceTime*2.2+.9)*.4+.75)*drift*dt;p.balance+=((c.right?1:0)-(c.left?1:0)+(c.axis||0))*.94*dt;if(Math.abs(p.balance)>1){this.bail(kind==='grind'?'Rail balance lost':'Manual balance lost');return false;}return true;}
 land(c,s){const p=this.p;if(p.animTime>(this.assist?.19:.11)){this.bail('Trick not finished');return;}const spinError=Math.abs(Math.sin(p.spin));if(spinError>(this.assist?.69:.47)){this.bail('Land along your line');return;}p.z=s.h;p.vz=0;p.grounded=true;p.mode='ground';p.landing=1;p.anim='';p.animTime=0;const turns=Math.floor((Math.abs(p.spin)+.24)/PI);if(turns){this.addTrick((p.spin<0?'FS ':'BS ')+(turns*180),400*turns);if(turns%2)p.switch=!p.switch;}p.spin=0;
 if(p.takeoff&&p.airTime>.18)for(const gap of L.gaps){const a=p.takeoff[gap.axis],b=p[gap.axis],other=gap.axis==='x'?'y':'x',mid=(p.takeoff[other]+p[other])/2;if(((a<=gap.lo&&b>=gap.hi)||(a>=gap.hi&&b<=gap.lo))&&mid>=gap.range[0]&&mid<=gap.range[1]){this.addTrick(gap.name,gap.bonus);if(!this.pendingGaps.includes(gap.id))this.pendingGaps.push(gap.id);if(gap.id==='saltwater'&&p.airHadFlip)this.pendingFlipGap=true;this.emit('gap',gap.name);}}
 this.emit('land');if(c.manual&&p.speed>4){this.beginManual();}else if(this.combo.mult)this.combo.timer=.3;else this.emit('sfx','land');}
 collect(){const p=this.p;if(p.mode==='bail')return;for(const l of L.letters){if(!this.letters.has(l.id)&&Math.hypot(p.x-l.x,p.y-l.y)<4.6&&Math.abs(p.z+2.2-l.z)<4){this.letters.add(l.id);this.emit('collect',l.id,p.x,p.y,p.z+3);if(this.letters.size===5)this.complete(4);}}
 for(const b of L.beacons)if(!this.beacons.has(b.id)&&Math.hypot(p.x-b.x,p.y-b.y)<4.3&&Math.abs(p.z+2-b.z)<4){this.beacons.add(b.id);this.emit('beacon',this.beacons.size);if(this.beacons.size===3){this.gateOpen=true;this.complete(5);this.emit('message','BRIDGE OPEN','Find the signal on the high deck.');}}
 const s=L.secret;if(this.gateOpen&&!this.secretFound&&Math.hypot(p.x-s.x,p.y-s.y)<4.5&&Math.abs(p.z+2-s.z)<4){this.secretFound=true;this.complete(9);this.emit('collect','HIDDEN SIGNAL',p.x,p.y,p.z+3);}}
 update(dt,input){if(this.finished)return;const c=Object.assign(blankInput(),input),p=this.p;dt=Math.max(0,Math.min(dt,.05));this.elapsed+=dt;p.railCooldown=Math.max(0,(p.railCooldown||0)-dt);if(this.mode==='session'){this.time=Math.max(0,this.time-dt);if(this.time<=0){this.overtime+=dt;if(!this.combo.mult&&p.mode!=='air'&&p.mode!=='grind'&&p.mode!=='manual')this.finish();if(this.overtime>15){if(p.mode==='ground')this.bank();else this.bail('Time to bring it home');this.finish();}}}if(this.finished)return;
 if(this.bankDisplay){this.bankDisplay.time-=dt;if(this.bankDisplay.time<=0)this.bankDisplay=null;}p.landing=Math.max(0,p.landing-dt*5);if(p.animTime>0){p.animTime=Math.max(0,p.animTime-dt);p.animProgress=1-p.animTime/p.animDuration;}else{p.anim='';p.animProgress=0;}
 if(p.mode==='bail'){p.bailTimer-=dt;if(p.bailTimer<=0){p.x=p.lastSafe.x;p.y=p.lastSafe.y;p.dir=p.lastSafe.dir;p.z=L.surface(p.x,p.y).h;p.mode='ground';p.grounded=true;p.speed=12;p.spin=0;p.balance=0;p.crouch=0;}return;}
 if(p.mode==='grind'){
  if(!this.updateBalance(c,dt,'grind'))return;const r=p.grind;p.grindT+=p.grindSign*p.speed*dt/r.len;p.grindDistance+=p.speed*dt;this.combo.base+=135*dt;this.special=E.clamp(this.special+5*dt,0,100);p.x=E.lerp(r.a[0],r.b[0],E.clamp(p.grindT,0,1));p.y=E.lerp(r.a[1],r.b[1],E.clamp(p.grindT,0,1));p.z=r.z;p.crouch=c.jump?Math.min(1,p.crouch+dt*4):p.crouch;
  const exit=p.grindT<0||p.grindT>1;if((exit||!c.grind||c.jumpReleased)&&r.id==='dock'&&p.grindDistance>=r.len*.8)this.pendingDock=true;
  if(c.jumpReleased){if(r.id==='dock'&&p.grindDistance>=r.len*.8)this.pendingDock=true;this.jump(Math.max(.2,p.crouch));}else if(exit||!c.grind){this.jump(0,exit?8:3);}
  this.collect();return;
 }
 if(p.mode==='manual'){
  if(!this.updateBalance(c,dt,'manual'))return;this.combo.base+=80*dt;p.speed=E.approach(p.speed,14,dt*1.8);if(!c.manual){p.mode='ground';this.combo.timer=.23;}if(c.jump)p.crouch=Math.min(1,p.crouch+dt*4);if(c.jumpReleased){this.jump(Math.max(.15,p.crouch));}
 }
 if(p.mode==='air'){
  p.airTime+=dt;p.spin+=((c.right?1:0)-(c.left?1:0)+(c.axis||0))*4.5*dt;
  if(c.flipPressed)this.startAnimation(c.up?'heelflip':c.down?'shove':'flip',c.up?'Heelflip':c.down?'Pop Shove-it':'Kickflip',c.up?330:c.down?240:300,.34);
  if(c.grabPressed)this.startAnimation('grab',c.left?'Method':c.right?'Melon':c.down?'Tailgrab':'Indy',c.left?450:380,.43);
  if(c.specialPressed&&this.special>=90&&p.animTime<=.08){if(this.startAnimation('special','Harbor Flip',2000,.67))this.special=0;}
  const old={x:p.x,y:p.y,z:p.z},oldSurface=L.surface(p.x,p.y);p.x+=p.airVX*dt;p.y+=p.airVY*dt;p.vz-=43*dt;p.z+=p.vz*dt;const s=L.surface(p.x,p.y);
  if(!this.gateOpen&&L.inside(p.x,p.y,L.gate)&&p.z<17){p.lastSafe.dir+=PI;this.bail('The signal bridge is closed');return;}
  if(p.x<3||p.x>237||p.y<3||p.y>207){p.lastSafe.dir=E.angDiff(0,p.dir+PI);this.bail('Back inside the yard');return;}
  if(s.h>oldSurface.h+1.8&&old.z<s.h-.6&&p.z<s.h-.5){p.x=old.x;p.y=old.y;p.lastSafe.dir=p.dir+PI;this.bail('Watch the edge');return;}
  if(this.tryGrind(c,dt)){this.collect();return;}
  if(p.z<=s.h&&p.vz<0)this.land(c,s);if(p.z<-3)this.bail('Salt water and bearings');this.collect();return;
 }
 const manual=p.mode==='manual';if(!manual){if(c.down)p.speed=E.approach(p.speed,0,32*dt);else if(c.up)p.speed=E.approach(p.speed,38,17*dt);else p.speed=E.approach(p.speed,23,7*dt);p.dir+=((c.right?1:0)-(c.left?1:0)+(c.axis||0))*2.35*(p.speed<4?1.3:1)*dt;
  if(c.jump)p.crouch=Math.min(1,p.crouch+dt*4);if(c.jumpReleased){this.jump(Math.max(.06,p.crouch));return;}if(!c.jump)p.crouch=E.approach(p.crouch,0,dt*7);
  if(c.manual&&p.speed>4){this.beginManual();}
 }
 const old={x:p.x,y:p.y,z:p.z},oldS=L.surface(p.x,p.y);p.x+=Math.cos(p.dir)*p.speed*dt;p.y+=Math.sin(p.dir)*p.speed*dt;const s=L.surface(p.x,p.y);
 if(p.x<3||p.x>237||p.y<3||p.y>207){p.x=E.clamp(old.x,6,234);p.y=E.clamp(old.y,6,204);p.lastSafe={x:p.x,y:p.y,dir:p.dir+PI};this.bail('Back inside the yard');return;}
 if(!this.gateOpen&&L.inside(p.x,p.y,L.gate)){p.x=old.x;p.y=old.y;p.lastSafe.dir=p.dir+PI;this.bail('Collect three signals to open the bridge');return;}
 if(s.h>old.z+1.15){p.x=old.x;p.y=old.y;if(p.speed>13){p.lastSafe.dir=p.dir+PI;this.bail('Watch the edge');}else{p.speed=0;p.dir+=c.left?-dt:dt;}return;}
 if(s.h<old.z-1.1){p.z=old.z;if(oldS.ramp){this.jump(0,10+Math.min(8,p.speed*.23));}else this.jump(0,0);return;}
 p.z=s.h;p.grounded=true;
 if(s.ramp&&s.ramp.quarter){const r=s.ramp,u=r.axis==='x'?(p.x-r.x)/r.w:(p.y-r.y)/r.d,v=r.dir===1?u:1-u,dot=(r.axis==='x'?Math.cos(p.dir):Math.sin(p.dir))*r.dir;if(v>.94&&dot>.35&&p.speed>9){p.z=r.h;if(r.axis==='x')p.dir=PI-p.dir;else p.dir=-p.dir;this.jump(0,26);p.airVX*=.72;p.airVY*=.72;return;}}
 if(p.mode==='ground'&&this.combo.mult){this.combo.timer-=dt;if(this.combo.timer<=0)this.bank();}
 p.safeClock+=dt;if(p.safeClock>.7&&s.h===0&&!s.ramp&&p.mode==='ground'){p.lastSafe={x:p.x,y:p.y,dir:p.dir};p.safeClock=0;}this.collect();
 }
 snapshot(){const p=this.p;return{mode:this.mode,time:this.time,finished:this.finished,score:this.score,bestCombo:this.bestCombo,combo:{base:Math.round(this.combo.base),multiplier:this.combo.mult,tricks:this.combo.parts.slice()},special:this.special,player:{x:p.x,y:p.y,z:p.z,direction:p.dir,speed:p.speed,state:p.mode,balance:p.balance},letters:[...this.letters],beacons:[...this.beacons],gaps:[...this.gaps],gateOpen:this.gateOpen,goals:this.saved.goals.map((done,i)=>({name:GOALS[i].name,done,progress:this.progress(i),target:GOALS[i].target})),bails:this.bails};}
}
root.BreakwaterGoals=GOALS;root.BreakwaterSimulation=SkateSimulation;
})(typeof window!=='undefined'?window:globalThis);
