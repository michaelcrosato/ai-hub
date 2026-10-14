/* Optional frontier encounters, witnessed crime and physical blasting powder. Public engine APIs only. */
(function(){
'use strict';
globalThis.WesternFrontier={create(E,game,api){
 const traveler={id:'frontier-traveler',x:520,y:650,z:0,r:6,facing:1.8},cache={id:'frontier-cache',x:566,y:652,label:'Examine the powder cache'};
 const witnesses=[traveler,{id:'cinder-store',x:400,y:400,z:0,r:6},{id:'cinder-saloon',x:270,y:400,z:0,r:6},{id:'cinder-marshal',x:320,y:420,z:0,r:6}];
 const travelerRig=new E.Humanoid({size:1.2,build:'heroic',weapon:null,outfit:'coat',hair:'short',hat:{style:'cap',color:'#887557'},colors:{skin:'#ba9774',hair:'#635543',coat:'#9b8460',cloth:'#9b8460',pants:'#5c6857',boot:'#504738'}});
 const lawRig=new E.Humanoid({size:1.35,build:'heroic',weapon:'gun',outfit:'coat',hair:'short',hat:{style:'cap',color:'#615140'},colors:{skin:'#c29b77',hair:'#5f503f',coat:'#50605d',cloth:'#50605d',pants:'#394843',boot:'#36382e',trim:'#c7ac68'}});
 const space=new E.SpatialHash(64),fragments=new E.Bullets(game,{plane:'ground',max:80,sparks:true});
 let owner=null,s=null,law=null,flow=null,bombs=new Map(),shown=false;
 function ensure(){
  if(owner===api.state&&s)return s;
  for(const b of bombs.values())b.timer?.cancel();bombs.clear();fragments.clear();owner=api.state;
  if(!owner)return null;
  s=owner.frontier||(owner.frontier={traveler:'waiting',lawPhase:'none',lawTimer:0,lawX:320,lawY:438,lawZ:0,witnessX:320,witnessY:420,dynamite:3,bombSeq:0,bombs:[],barrierBroken:false,cacheTaken:false});
  if(!Array.isArray(s.bombs))s.bombs=[];
  owner.activities=owner.activities||{};
  law=new E.Mover({x:s.lawX,y:s.lawY,z:s.lawZ||0,r:6,run:92,walk:75,sprintSpeed:108,climbMax:24});law.facing=1;
  flow=new E.FlowField(api.world.map,{climb:24,drop:32,jump:30});
  for(const [cx,cy]of [[34,39],[35,39]])api.world.map.set(cx,cy,s.barrierBroken?0:3);
  for(const record of s.bombs)hydrate(record);
  return s;
 }
 function hydrate(record){const b=new E.Body({x:record.x,y:record.y,z:record.z,vx:record.vx,vy:record.vy,vz:record.vz,r:2,bounce:.42,friction:.6,gravity:360,onGround:!!record.onGround});b.record=record;b.ready=false;
  const current=owner;b.timer=game.after(Math.max(.02,record.remaining),()=>{if(api.state!==current)return;if(game.sceneName==='play'&&!api.ui?.screen)explode(b);else b.ready=true;});bombs.set(record.id,b);return b;}
 function rebuildSpace(){space.build([...witnesses,...(api.foes||[]),api.hero]);}
 function nearbyWitness(at,radius){let witness=null,best=radius;space.near(at.x,at.y,radius,n=>{if(witnesses.includes(n)){const d=E.dist(at,n);if(d<best&&api.world.map.sight(n,at)){witness=n;best=d;}}});return witness;}
 function report(witness,reason='A witness is reporting you'){
  ensure();const st=api.state;st.wanted=Math.max(st.wanted||0,35);
  if(s.lawPhase==='none'||s.lawPhase==='cooldown'){
   s.lawPhase='witness';s.lawTimer=3;s.witnessX=witness?.x??st.heroX??320;s.witnessY=witness?.y??420;
   api.notify('Witness',reason+' · 3 seconds until the law is alerted.');
  }else if(s.lawPhase==='search'){s.lawPhase='pursuit';s.lawTimer=0;}
 }
 function close(){api.ui?.hide();game.input.clear();}
 function finishTraveler(help){
  ensure();if(s.traveler!=='waiting')return;
  if(help){if(api.state.tonics<1){api.notify('A tonic would help','Find yarrow or visit Ruth’s store.');return;}api.state.tonics--;api.state.honor=Math.min(100,api.state.honor+8);api.state.money+=8;s.traveler='helped';api.state.activities.helpedTraveler=true;api.notify('A kindness on the trail','Tonic given · $8 returned · Honor increased');}
  else{api.state.money+=12;api.state.honor=Math.max(-100,api.state.honor-15);api.state.bounty=(api.state.bounty||0)+6;s.traveler='robbed';api.state.activities.robbedTraveler=true;report(traveler,'The traveler has seen your face');}
  api.state.activities.encounter=true;close();api.save();
 }
 function interactions(){ensure();const list=[];space.build([traveler,cache]);space.near(api.hero.x,api.hero.y,80,n=>{if(n===traveler&&s.traveler==='waiting')list.push({...traveler,label:'Speak to the stranded traveler'});if(n===cache&&!s.cacheTaken)list.push({...cache,label:s.barrierBroken?'Recover the blasting supplies':'Inspect the sealed powder cache'});});return list;}
 function interact(id){
  ensure();if(id==='frontier-traveler'){
   if(s.traveler!=='waiting'){api.notify('The traveler remembers',s.traveler==='helped'?'“You gave me a chance. Thank you.”':'“Just leave me alone.”');return true;}
   api.ui.show('frontier-encounter',{kicker:'A stranger by the roadside',title:'A little kindness',text:'A traveler sits beside a broken axle, shivering. “Fever took hold last night. I have a few dollars, but no medicine.”',actions:[{label:'Give a tonic · Honor +8 · $8',disabled:api.state.tonics<1,fn:()=>finishTraveler(true)},['Rob the traveler · $12',()=>finishTraveler(false)],['Leave in peace',close]]});game.input.clear();return true;
  }
  if(id==='frontier-cache'){
   if(s.barrierBroken&&!s.cacheTaken){s.cacheTaken=true;s.dynamite+=2;api.state.money+=5;api.state.activities.powderCache=true;api.notify('Blasting supplies recovered','Dynamite ×2 · $5');game.audio.sfx('pickup');api.save();}
   else api.ui.show('frontier-powder',{kicker:'Company property',title:'Blasting powder',text:'Two timber barricades seal the supply crate. A dynamite blast within the clearing will break them. Stand clear of the burning fuse.',actions:[['Leave the notice',close]]});return true;
  }
  return false;
 }
 function throwDynamite(){
  ensure();if(game.sceneName!=='play')return false;
  if(s.dynamite<=0){api.notify('No dynamite left','The sealed powder cache near the traveler holds two more bundles.');return false;}
  const h=api.hero,a=h.facing||0;const record={id:++s.bombSeq,x:h.x+Math.cos(a)*10,y:h.y+Math.sin(a)*10,z:(h.z||0)+20,vx:Math.cos(a)*90,vy:Math.sin(a)*90,vz:105,onGround:false,remaining:2};
  s.dynamite--;s.bombs.push(record);hydrate(record);api.state.activities.dynamite=true;game.audio.sfx('whoosh');api.notify('Fuse lit','Two seconds. Keep clear of the blast.');return true;
 }
 function explode(b){
  if(!b||b.exploded||owner!==api.state||!s.bombs.includes(b.record))return;b.exploded=true;b.timer?.cancel();
  s.bombs=s.bombs.filter(n=>n!==b.record);bombs.delete(b.record.id);
  game.particles.explosion(b.x,b.y,b.z,1.5,{debris:['#ae906b','#6f654d'],sound:true,flash:false});game.freeze(.065);game.shake(5);game.flash('#ebc78f',.13,.45);game.input.rumble(.45,.18);
  fragments.burst({x:b.x,y:b.y,z:b.z+8,r:1.1,dmg:0,life:.32,color:'#e1b567',grav:80},E.pattern.ring(14,120));
  rebuildSpace();space.near(b.x,b.y,64,n=>{
   const d=E.dist(b,n);if(d>64)return;
   if(n===api.hero){api.hurt(Math.round(40*(1-d/80)));E.knockback(b,n,95,55);}
   else if((api.foes||[]).includes(n)&&n.alive&&!n.bound){if(api.enemyHit)api.enemyHit(n,Math.round(100*(1-d/85)));else{n.hp-=Math.round(100*(1-d/85));if(n.hp<=0)n.alive=false;}E.knockback(b,n,130,80);}
  });
  if(!s.barrierBroken&&Math.hypot(b.x-560,b.y-632)<64){s.barrierBroken=true;for(const [cx,cy]of [[34,39],[35,39]])api.world.map.set(cx,cy,0);api.state.activities.blasting=true;api.notify('The barricade gives way','The supply crate is open.');}
  const witness=nearbyWitness(b,145);if(witness){api.state.bounty=(api.state.bounty||0)+4;api.state.honor=Math.max(-100,api.state.honor-3);report(witness,'Someone heard the blast');}
  api.save();
 }
 function updateLaw(dt){
  const st=api.state,h=api.hero;
  if(st.wanted>0&&s.lawPhase==='none')report(nearbyWitness(h,180)||witnesses[3]);
  if(st.wanted<=0&&s.lawPhase!=='none'&&s.lawPhase!=='cooldown'){s.lawPhase='none';s.lawTimer=0;}
  if(s.lawPhase==='witness'){
   s.lawTimer-=dt;if(s.lawTimer<=0){s.lawPhase='pursuit';s.lawTimer=0;law.x=320;law.y=438;law.z=0;api.notify('The law is coming','Break sight and leave the search area. Your bounty will remain.');}
  }else if(s.lawPhase==='pursuit'||s.lawPhase==='search'){
   const dist=E.dist(law,h),seen=E.sees(law,h,{map:api.world.map,range:190,fov:Math.PI*1.75}).seen;
   if(s.lawPhase==='pursuit'&&dist>185&&!seen){s.lawPhase='search';s.lawTimer=10;api.notify('Searching','Stay out of sight until the search ends.');}
   if(s.lawPhase==='search'){
    if(seen){s.lawPhase='pursuit';s.lawTimer=0;}
    else{s.lawTimer-=dt;st.wanted=Math.max(1,s.lawTimer);if(s.lawTimer<=0){st.wanted=0;s.lawPhase='none';api.notify('The search has ended',st.bounty>0?'Your bounty remains. Settle it with Marshal Bell.':'You are clear of the law.');api.save();}}
   }
   if(s.lawPhase==='pursuit'){
    st.wanted=35;flow.update(h.x,h.y);const dir=flow.dir(law.x,law.y,h.x,h.y);law.update(dt,api.world.map,{move:dir,sprint:dist>65});
    if(dist<15&&Math.abs((h.z||0)-law.z)<12){const fine=Math.min(st.money,Math.max(5,st.bounty||0));st.money-=fine;st.bounty=Math.max(0,(st.bounty||0)-fine);st.wanted=0;s.lawPhase='cooldown';s.lawTimer=15;st.activities.cited=true;api.notify('A warning from the marshal',`Fine paid: $${fine}. Keep your weapon holstered in Cinder.`);api.save();}
   }else {law.vx=law.vy=0;}
  }else if(s.lawPhase==='cooldown'){s.lawTimer-=dt;if(s.lawTimer<=0)s.lawPhase='none';}
  s.lawX=law.x;s.lawY=law.y;s.lawZ=law.z;lawRig.update(dt,{...law.rigState(),pose:s.lawPhase==='search'?'hips':null,point:false});
 }
 function update(dt){
  if(!ensure()||game.sceneName!=='play')return;rebuildSpace();updateLaw(dt);
  travelerRig.update(dt,{...traveler,pose:s.traveler==='helped'?'wave':'kneel',expr:s.traveler==='robbed'?'wince':null});
  for(const b of [...bombs.values()]){if(b.ready){explode(b);continue;}b.update(dt,api.world.map);b.record.remaining-=dt;Object.assign(b.record,{x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,vz:b.vz,onGround:b.onGround});if(b.bounced){game.audio.sfx('land',{vol:.12});game.particles.dust(b.x,b.y,0,2);}if(b.record.remaining<=0)explode(b);}
  fragments.update(dt,api.world.map);
 }
 function draw(r){
  if(!ensure())return;
  r.shadow(traveler.x,traveler.y,7,.22);if(globalThis.WesternWorld)WesternWorld.drawCowboy(r,E,traveler,travelerRig,{xray:false,every:2,key:travelerRig});else r.actor(traveler.x,traveler.y,0,(g,x,y)=>travelerRig.draw(g,x,y,r.view));
  r.prop('crate',566,652,0,{size:1.4,color:'#9c865d',open:s.cacheTaken});r.prop('barrel',506,646,0,{size:1.05,color:'#8d7856'});
  if(s.traveler==='waiting'&&E.dist(api.hero,traveler)<110)r.marker(520,650,41,{label:'STRANGER',color:'#daca9a'});
  if(s.lawPhase==='witness')r.textAt(s.witnessX,s.witnessY,48,'REPORTING '+Math.ceil(s.lawTimer),'#dfae7c');
  if(['pursuit','search','cooldown'].includes(s.lawPhase)){
   r.shadow(law.x,law.y,7,.3);if(globalThis.WesternWorld)WesternWorld.drawCowboy(r,E,law,lawRig,{xray:false});else r.actor(law.x,law.y,law.z,(g,x,y)=>lawRig.draw(g,x,y,r.view));
   if(s.lawPhase!=='cooldown')r.marker(law.x,law.y,46,{label:s.lawPhase==='search'?'SEARCHING':'THE LAW',color:'#d6a577'});
  }
  for(const b of bombs.values()){
   r.shadow(b.x,b.y,4,.2);r.queue(b.x,b.y,b.z,g=>{const p=r.w(b.x,b.y,b.z),scale=r.view.scale;E.px.rect(g,p[0]-3*scale,p[1]-2*scale,6*scale,4*scale,'#a4593d');E.px.line(g,p[0],p[1]-2*scale,p[0]+3*scale,p[1]-5*scale,'#d3bd84');E.px.disc(g,p[0]+3*scale,p[1]-5*scale,(1+.4*Math.sin(game.time*24))*scale,'#ffe19c');},{emissive:true});
   r.decal(()=>r.groundRing(b.x,b.y,48,'#c48450',.13));
  }
  fragments.draw(r);
 }
 ensure();
 return {update,draw,interactions,interact,throwDynamite,debug:{snapshot:()=>{ensure();return JSON.parse(JSON.stringify(s));},report,finishTraveler,get law(){return law;},get bombs(){return [...bombs.values()];},get hash(){return space;}}};
}};
})();
