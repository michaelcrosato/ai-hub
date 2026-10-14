/* Morrowglass field and battle stage. All actor positions use the engine's 3D world space. */
(function(root){
'use strict';
const E=root.My3D2dge, P=E.px, C=root.MorrowCampaign;
const rooms={
 quay:{name:'Lantern Quay',sub:'A village at the edge of remembering',art:'quay',floor:[[75,395],[213,309],[560,307],[850,359],[908,510],[55,510]],spawn:[427,426],nodes:[
  {id:'edda',label:'Edda',kind:'talk',p:[694,383],portrait:'edda'},
  {id:'tamsin',label:'Tamsin · Cards & wares',kind:'cards',p:[244,369],portrait:'tamsin'},
  {id:'pip',label:'Pip · Rest & save',kind:'save',p:[799,461]},
  {id:'quay-chest',label:'Old travel chest',kind:'chest',p:[116,452]},
  {id:'verse',label:'A keeper’s verse',kind:'sign',p:[505,330]},
  {id:'to-garden',label:'Glassroot Walk',kind:'exit',p:[851,380]}
 ]},
 garden:{name:'Glassroot Walk',sub:'Where the lamps have grown wild',art:'garden',floor:[[80,370],[280,330],[743,330],[891,385],[925,510],[45,510]],spawn:[134,437],nodes:[
  {id:'to-quay',label:'Lantern Quay',kind:'exit',p:[86,444]},
  {id:'thorns',label:'Lantern moths',kind:'fight',p:[356,420]},
  {id:'chime',label:'The three lanterns',kind:'puzzle',p:[604,379]},
  {id:'garden-chest',label:'A glassroot cache',kind:'chest',p:[776,473]},
  {id:'to-belfry',label:'The Hollow Belfry',kind:'exit',p:[860,385]}
 ]},
 belfry:{name:'The Hollow Belfry',sub:'A promise kept for too long',art:'belfry',floor:[[93,388],[265,328],[696,328],[872,390],[919,515],[43,515]],spawn:[145,445],nodes:[
  {id:'to-walk',label:'Glassroot Walk',kind:'exit',p:[94,450]},
  {id:'sentry',label:'The kiln sentry',kind:'fight',p:[352,403]},
  {id:'belfry-rest',label:'A quiet flame · Rest',kind:'save',p:[697,465]},
  {id:'bellkeeper',label:'The Hollow Bellkeeper',kind:'boss',p:[691,359]}
 ]}
};
Object.assign(rooms,C.rooms);
rooms.overworld={name:'The Lantern Roads',sub:'Twenty-nine places. A road that can listen.',art:'bracken',floor:rooms.quay.floor,spawn:rooms.quay.spawn,nodes:[]};
rooms.quay.nodes.push({id:'to-overworld',label:'The Lantern Roads',kind:'exit',p:[80,408],afterOpening:true});
const palettes={
 ivo:{skin:'#dbb189',hair:'#683e27',cloth:'#e5d4af',pants:'#353b4b',boot:'#593e30',cape:'#358e91',capeIn:'#19565c',belt:'#bb9456'},
 mina:{skin:'#945c42',hair:'#e6e2d4',cloth:'#d49a44',pants:'#473759',boot:'#694528',cape:'#bf702d',capeIn:'#663a2b',belt:'#61b9b4'},
 orrin:{skin:'#e0b799',hair:'#b8b8b3',cloth:'#695570',pants:'#3d344b',boot:'#4c4240',cape:'#69516e',capeIn:'#3d304e',metal:'#bbc6c5',metalDk:'#687c81',belt:'#c9a064'},
 edda:{skin:'#bd8b6d',hair:'#bfb6a7',cloth:'#779288',pants:'#453846',boot:'#675448',cape:'#71827a',capeIn:'#324544'},
 tamsin:{skin:'#ce997c',hair:'#c6ab88',cloth:'#a3624f',pants:'#4f394d',boot:'#5a4542',cape:'#846444',capeIn:'#513d34'}
};
function inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(((poly[i][1]>p[1])!==(poly[j][1]>p[1]))&&(p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0]))c=!c;return c;}
function nearest(p,poly){if(inside(p,poly))return p;let out=poly[0],best=Infinity;for(let i=0;i<poly.length;i++){let a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=E.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<best){best=d;out=q;}}let cx=poly.reduce((s,p)=>s+p[0],0)/poly.length,cy=poly.reduce((s,p)=>s+p[1],0)/poly.length;return [E.lerp(out[0],cx,.012),E.lerp(out[1],cy,.012)];}
class World{
 constructor(app){
  this.app=app;this.game=app.game;this.images={};this.rigs={};this.actors={};this.fx=[];this.moveTarget=null;this.pending=null;this.currentRoom='quay';this.fade=0;
  for(const n of ['quay','garden','belfry','bellkeeper',...C.assets]){const im=new Image();im.src=root.MorrowAssets?.[n]||'assets/'+n+'.png';this.images[n]=im;}
  for(const id of ['ivo','mina','orrin','edda','tamsin']){
   const guard=id==='orrin';this.rigs[id]=new E.Humanoid({build:guard?'bulky':'chibi',size:id==='mina'?2.2:guard?2.5:2.25,headR:4.15,weapon:id==='mina'?'staff':id==='ivo'?'sword':guard?'sword':null,bladeLen:id==='ivo'?6:11,cape:{len:7,width:5,seg:2.3},hair:id==='mina'?'curly':id==='orrin'?'short':'tousled',outfit:id==='mina'?'robe':guard?'tunic':'coat',sleeves:'long',armor:guard,colors:palettes[id]});
  }
  this.rigs.sentry=new E.Humanoid({build:'bulky',size:3.2,headR:3.9,weapon:'sword',armor:true,hat:{style:'helmet',color:'#ab956a'},hair:'bald',outfit:'tunic',eyeGlow:'#79ece0',colors:{skin:'#908469',hair:'#807568',cloth:'#4a6a62',pants:'#5e5845',boot:'#696755',metal:'#ab956a',metalDk:'#605641',eye:'#a7fff0',cape:'#665341'}});
  for(const [id,n] of Object.entries(C.npcs))this.rigs[id]=new E.Humanoid({build:id==='mara'?'bulky':'chibi',size:id==='linn'?1.95:2.2,headR:4.15,hair:id==='mara'?'curly':id==='iria'?'long':'tousled',outfit:n.outfit,sleeves:'long',cape:{len:6,width:5,seg:2.1},colors:{skin:n.skin,hair:n.hair,cloth:n.cloth,cape:n.cloth,capeIn:'#334e52',pants:'#3c3e4a',boot:'#574638',belt:'#cab882'}});
  for(const id of C.encounters)for(const n of root.MorrowBattle.encounters[id].enemies)if(n.kind==='sentry')this.rigs[n.id]=new E.Humanoid({build:'bulky',size:id==='frost-choir'?3:3.65,headR:3.9,weapon:id==='frost-choir'?'staff':'sword',armor:true,hat:{style:'helmet',color:n.tint},hair:'bald',outfit:'tunic',eyeGlow:n.tint,colors:{skin:'#8a9282',hair:'#8a9282',cloth:n.tint,pants:'#435359',boot:'#535b54',metal:n.tint,metalDk:'#4f6165',eye:'#d9ffef'}});
  this.setRoom('quay');
 }
 world(p){return this.game.view.toGround(p[0],p[1]);}
 screen(p){return this.game.view.p(p.x,p.y,p.z||0);}
 setRoom(id,spawn){
  if(!rooms[id])throw new Error('Unknown room: '+id);
  if(id==='overworld'){this.currentRoom=id;this.room=rooms[id];this.moveTarget=null;this.pending=null;this.fx=[];this.app.overworld?.enter();return;}
  this.currentRoom=id;this.room=rooms[id];this.poly=this.room.floor.map(p=>this.world(p));let p=this.world(spawn||this.room.spawn);
  this.actors.ivo={id:'ivo',x:p[0],y:p[1],z:0,facing:.4};this.actors.mina={id:'mina',x:p[0]-32,y:p[1]+27,z:0,facing:.3};this.actors.orrin={id:'orrin',x:p[0]-61,y:p[1]+45,z:0,facing:.2};
  for(const n of this.room.nodes){const p=this.world(n.p);if(n.portrait||n.id==='sentry')this.actors[n.id]={id:n.id,x:p[0],y:p[1],z:0,facing:1.1};}
  this.moveTarget=null;this.pending=null;this.fade=1;this.fx=[];
 }
 nodes(){if(this.currentRoom==='overworld')return this.app.overworld?.nodes()||[];const nodes=this.room.nodes.filter(n=>{const f=this.app.state.flags,c=this.app.state.campaign;return !(n.id==='thorns'&&f.thorns||n.id==='sentry'&&f.sentry||n.id==='bellkeeper'&&f.boss||n.afterOpening&&!f.ending||n.showFlag&&!c?.flags[n.showFlag]||n.showDefeated&&!c?.defeated[n.showDefeated]||n.battle&&c?.defeated[n.battle]);});return this.app.accordNodes?this.app.accordNodes(nodes):nodes;}
 goTo(id){if(this.currentRoom==='overworld')return this.app.overworld.goTo(id);const n=this.nodes().find(n=>n.id===id);if(!n)return;const p=this.world(n.p);this.pending=id;this.moveTarget=p;}
 click(p){if(this.currentRoom==='overworld')return this.app.overworld.click(p);this.pending=null;this.moveTarget=nearest(this.world(p),this.poly);}
 near(){if(this.currentRoom==='overworld')return this.app.overworld.near();const a=this.actors.ivo;let best=null,d=85;for(const n of this.nodes()){const p=this.world(n.p),dd=Math.hypot(a.x-p[0],a.y-p[1]);if(dd<d){best=n;d=dd;}}return best;}
 update(dt){
  if(this.app.modal==='accord-inspect')return;
  this.fade=Math.max(0,this.fade-dt*2);for(const f of this.fx)f.t+=dt;this.fx=this.fx.filter(f=>f.t<f.dur);
  if(this.app.mode==='battle'){this.updateBattle(dt);return;}
  if(this.currentRoom==='overworld'){this.app.overworld.update(dt);return;}
  let a=this.actors.ivo,vx=0,vy=0;
  if(this.app.mode==='field'&&!this.app.modal){
   const m=this.game.input.move();let dir=this.game.view.screenDirToGround(m[0],m[1]);
   if(m[0]||m[1]){this.moveTarget=null;this.pending=null;const speed=this.game.input.map.run&&this.game.input.down('run')?234:151;vx=dir[0]*speed;vy=dir[1]*speed;}
   else if(this.moveTarget){let dx=this.moveTarget[0]-a.x,dy=this.moveTarget[1]-a.y,d=Math.hypot(dx,dy);if(d<(this.pending?58:4)){let n=this.pending;this.pending=null;this.moveTarget=null;if(n)this.app.interact(n);}else {vx=dx/d*155;vy=dy/d*155;}}
   if(vx||vy){let p=[a.x+vx*dt,a.y+vy*dt];if(inside(p,this.poly)){a.x=p[0];a.y=p[1];}else{if(inside([p[0],a.y],this.poly))a.x=p[0];if(inside([a.x,p[1]],this.poly))a.y=p[1];}a.facing=Math.atan2(vy,vx);}
  }
  this.rigs.ivo.update(dt,{...a,vx,vy,pose:this.app.mode==='ending'?'cheer':null});
  let lead=a;
  for(const id of ['mina','orrin']){const b=this.actors[id],dx=lead.x-b.x,dy=lead.y-b.y,d=Math.hypot(dx,dy),sp=d>46?Math.min(178,(d-44)*5):0;let vx=dx/(d||1)*sp,vy=dy/(d||1)*sp;if(this.app.mode==='field'&&!this.app.modal){b.x+=vx*dt;b.y+=vy*dt;if(sp>4)b.facing=Math.atan2(vy,vx);}else vx=vy=0;this.rigs[id].update(dt,{...b,vx,vy,pose:this.app.mode==='ending'?'cheer':null});lead=b;}
  for(const n of this.nodes()){if(this.rigs[n.id]&&!['ivo','mina','orrin'].includes(n.id)){let ac=this.actors[n.id];this.rigs[n.id].update(dt,{...ac,pose:n.id==='edda'?'hips':null});}if(n.battle||n.rootHunt){const en=root.MorrowBattle.encounters[n.battle||n.rootHunt].enemies[0],rig=this.rigs[en.id];if(rig){const p=this.world(n.p);rig.update(dt,{x:p[0],y:p[1],z:0,facing:Math.PI,stance:'ready'});}}}
 }
 battlePositions(){const b=this.app.battle;const out={ivo:this.world([213,361]),mina:this.world([296,399]),orrin:this.world([136,406])};if(b)for(let i=0;i<b.enemies.length;i++)out[b.enemies[i].id]=this.world(b.enemies.length===1?[704,410]:b.enemies.length===3?[[545,390],[705,390],[865,390]][i]:i===0?[636,371]:[798,420]);return out;}
 updateBattle(dt){const b=this.app.battle;if(!b)return;const pos=this.battlePositions();for(const id of ['ivo','mina','orrin']){const u=b.heroes.find(h=>h.id===id),p=pos[id],f=this.fx.find(f=>f.actor===id&&f.type==='action'),hurt=this.fx.some(f=>f.target===id&&f.type==='damage'&&f.t<.28);let pose=u.hp<=0?'down':u.statuses?.guard?'guard':null;let attack=null,dx=0;if(f){let u=E.clamp(f.t/.75,0,1);if(['spark','mend','frost','flare','renew','rally','rekindle','quickstep','concord','clearsong','interpose','limit','bulwark'].includes(f.action))pose='cast';else if(!['guard','tonic','ether','feather'].includes(f.action)){dx=Math.sin(u*Math.PI)*37;attack=E.move('slash',u);}else pose='cheer';}this.rigs[id].update(dt,{x:p[0]+dx,y:p[1],z:0,facing:0,stance:'ready',pose,attack,hurt});}
  for(const en of b.enemies)if(en.kind==='sentry'){let p=pos[en.id];(this.rigs[en.id]||this.rigs.sentry).update(dt,{x:p[0],y:p[1],z:0,facing:Math.PI,pose:en.hp<=0?'down':null,stance:'ready',hurt:this.fx.some(f=>f.target===en.id&&f.type==='damage'&&f.t<.3)});}
 }
 event(ev){if(ev.type==='concord'){for(const [id,p] of Object.entries(this.battlePositions()))this.game.particles.sparks(p[0],p[1],35,24,null,{color:'#b9f9df'});this.game.shake(2.2);}this.fx.push({...ev,t:0,dur:ev.type==='concord'?1.6:ev.type==='action'?1:1.35});let p=this.battlePositions()[ev.target];if(p&&(ev.type==='damage'||ev.type==='heal')){this.game.particles.text(p[0],p[1],85,String(ev.type==='heal'?'+':'')+ev.amount,ev.type==='heal'?'#9ef0b8':'#fff1bf',{scale:2,bounce:true});if(ev.type==='damage'){this.game.particles.impact(p[0],p[1],44,11,ev.color||'#ffd785');this.game.shake(1.2);}else this.game.particles.sparks(p[0],p[1],22,9,null,{color:'#bdf2b2'});}}
 drawRig(r,id,a,opts={}){r.shadow(a.x,a.y,14,.45);r.actor(a.x,a.y,a.z||0,(g,ox,oy)=>this.rigs[id].draw(g,ox,oy,r.view),{outline:true,rim:true,...opts});this.rigs[id].drawSmear(r);}
 drawMoth(r,x,y,t,scale=1,friendly=false,hurt=false){
  r.shadow(x,y,18*scale,.32);r.actor(x,y,0,(g,ox,oy)=>{let flap=Math.sin(t*6)*8,w=scale,c=friendly?'#f9d794':'#7bc5bf',edge=friendly?'#b7874b':'#325f68',py=oy-28*w-Math.sin(t*2)*4;
   for(const s of [-1,1]){P.poly(g,[[ox+s*4*w,py],[ox+s*(31+flap)*w,py-21*w],[ox+s*(37+flap)*w,py+7*w],[ox+s*10*w,py+11*w]],edge);P.poly(g,[[ox+s*7*w,py],[ox+s*(28+flap)*w,py-16*w],[ox+s*(29+flap)*w,py+3*w],[ox+s*11*w,py+6*w]],c);P.ell(g,ox+s*21*w,py-2*w,5*w,7*w,friendly?'#ffebb1':'#d4e8b9');P.line(g,ox+s*3*w,py-11*w,ox+s*11*w,py-22*w,'#d3b97d',1);}
   P.ell(g,ox,py+2*w,7*w,14*w,'#293e46');P.disc(g,ox,py-10*w,7*w,c);P.disc(g,ox-3*w,py-10*w,1.7*w,'#ffedb4');P.disc(g,ox+3*w,py-10*w,1.7*w,'#ffedb4');P.poly(g,[[ox-6*w,py+14*w],[ox,py+30*w],[ox+6*w,py+14*w]],'#ceaf65');
  },{flash:hurt?'#ffffff':null,rim:true,outline:true});
 }
 drawKeeper(r,x,y,t,shell=true,hurt=false,charge=false){
  const image=this.images.bellkeeper;
  if(image.complete&&image.naturalWidth){
   const strike=this.fx.find(f=>f.actor==='bellkeeper'&&f.type==='action'),sway=Math.sin(t*1.3)*2,step=strike?-Math.sin(E.clamp(strike.t/.8,0,1)*Math.PI)*16:0;
   r.shadow(x,y,33,.47);r.actor(x+step,y,0,(g,ox,oy)=>{const h=208+Math.sin(t*1.3)*1.5,w=139;g.drawImage(image,ox-w/2,oy-h+sway,w,h);if(charge)r.glowDisc(g,ox,oy-102,31,'#f4cd7f',.23);},{outline:true,rim:true,flash:hurt?'#ffffff':null});
   if(charge)r.decal(()=>{r.groundRing(x,y,49+Math.sin(t*4)*3,'#f7b775',.7);r.groundRing(x,y,58,'#ffa86e',.35);});return;
  }
  r.shadow(x,y,47,.58);r.actor(x,y,0,(g,ox,oy)=>{let bob=Math.sin(t*1.7)*2,yy=oy+bob;const c=shell?'#b0a06c':'#7f9f94',hi=shell?'#e0c686':'#b1d6bb',dark='#3b5a59';
   for(const s of [-1,1]){P.line(g,ox+s*24,yy-47,ox+s*32,yy-17,dark,13);P.poly(g,[[ox+s*24,yy-17],[ox+s*44,yy-8],[ox+s*40,yy-1],[ox+s*15,yy-3]],c);let hx=ox+s*(58+Math.sin(t*2)*3),hy=yy-76;P.line(g,ox+s*34,yy-106,hx,hy,dark,13);P.line(g,hx,hy,ox+s*54,yy-39,c,11);P.disc(g,hx,hy,9,hi);P.poly(g,[[ox+s*48,yy-51],[ox+s*66,yy-43],[ox+s*56,yy-26],[ox+s*42,yy-34]],'#638a7b');P.line(g,ox+s*28,yy-108,ox+s*45,yy-142,'#537e71',4);P.line(g,ox+s*39,yy-130,ox+s*57,yy-137,'#83aa8a',3);}
   P.poly(g,[[ox-28,yy-128],[ox+28,yy-128],[ox+39,yy-69],[ox+51,yy-56],[ox+45,yy-47],[ox-45,yy-47],[ox-51,yy-56],[ox-39,yy-69]],dark);
   P.poly(g,[[ox-22,yy-125],[ox+23,yy-125],[ox+32,yy-70],[ox+41,yy-57],[ox-39,yy-57],[ox-29,yy-72]],c);
   P.line(g,ox-19,yy-118,ox-27,yy-64,hi,6);P.line(g,ox+21,yy-117,ox+28,yy-66,'#657065',5);P.line(g,ox-40,yy-56,ox+41,yy-56,hi,6);P.line(g,ox-26,yy-95,ox+27,yy-95,'#675e43',3);
   P.ell(g,ox,yy-82,14,20,'#233d45');P.disc(g,ox,yy-80,9,charge?'#fbaa68':'#92e9d5');P.disc(g,ox,yy-80,4,'#e6ffe3');
   P.poly(g,[[ox-22,yy-129],[ox-15,yy-150],[ox,yy-164],[ox+17,yy-150],[ox+24,yy-129]],'#7e8870');P.poly(g,[[ox-13,yy-146],[ox,yy-156],[ox+13,yy-146],[ox+10,yy-130],[ox-11,yy-130]],'#263f45');P.line(g,ox-9,yy-142,ox-3,yy-140,'#dbf9bb',3);P.line(g,ox+3,yy-140,ox+10,yy-142,'#dbf9bb',3);
   P.line(g,ox,yy-162,ox,yy-176,hi,4);P.poly(g,[[ox,yy-189],[ox+9,yy-178],[ox,yy-171],[ox-9,yy-178]],c);P.line(g,ox-4,yy-115,ox+3,yy-102,'#507f77',3);P.line(g,ox+3,yy-102,ox-5,yy-95,'#507f77',3);
  },{outline:true,rim:true,flash:hurt?'#ffffff':null});
  if(charge)r.decal(()=>{r.groundRing(x,y,55+Math.sin(t*4)*3,'#f7b775',.7);r.groundRing(x,y,62,'#ffa86e',.35);});
 }
 // Use actor's public direct path for transformed shapes and tall art.
 // The engine composite tracks raw fillRect bounds and has a 200px upward limit.
 drawCreature(r,en,x,y,t,scale=1,hurt=false){
  const c=hurt?'#fff0c9':en.tint||'#9abda5',dark='#263e47',light='#f2e6b5',charging=!!en.intent?.counterHint;
  if(en.id==='bellkeeper'){this.drawKeeper(r,x,y,t,en.shell!==false,hurt,en.intent?.id==='doom');return;}
  if(en.kind==='moth'){this.drawMoth(r,x,y,t,scale*1.1,false,hurt);return;}
  if(en.kind==='sentry'){this.drawRig(r,this.rigs[en.id]?en.id:'sentry',{x,y,z:0},{flash:hurt?'#ffffff':null});}
  else if(['hush-engine','weather-heart','atlas-heart','accord-chorus'].includes(en.visual)&&this.images[en.visual]?.complete&&this.images[en.visual].naturalWidth){
   const im=this.images[en.visual],h=(en.visual==='weather-heart'?255:263)*scale,w=h*im.naturalWidth/im.naturalHeight;
   r.shadow(x,y,41*scale,.5);r.actor(x,y,0,(g,ox,oy)=>{const bob=Math.sin(t*1.4)*3;g.drawImage(im,ox-w/2,oy-h+bob,w,h);if(charging||hurt)r.glowDisc(g,ox,oy-h*.49,42,c,.28);},{outline:false,rim:false});
  }else{
   r.shadow(x,y,38*scale,.4);r.actor(x,y,0,(g,ox,oy)=>{
    g.save();g.translate(ox,oy);g.scale(scale,scale);let bob=Math.sin(t*2)*3;
    if(en.kind==='root'){
     for(let i=0;i<7;i++){const a=i*Math.PI*2/7,xx=Math.cos(a)*56,yy=Math.sin(a)*12;P.line(g,0,-18,xx,yy,dark,11);P.line(g,0,-20,xx,yy-3,'#827759',6);P.line(g,xx,yy,xx+Math.sign(xx)*12,yy+3,'#b0a276',3);}
     for(const s of [-1,1]){const sway=Math.sin(t*1.5+s)*3;P.line(g,s*18,-64,s*45,-96+bob,c,10);P.line(g,s*45,-96+bob,s*51,-135+sway,'#7f8c64',6);P.line(g,s*46,-107,s*74,-119+sway,'#a0a775',4);P.line(g,s*51,-128,s*35,-150,'#9ca973',3);P.ell(g,s*71,-121+sway,12,5,c);P.ell(g,s*50,-146+sway,8,13,c);P.ell(g,s*31,-151,9,6,'#d1c99a');}
     P.poly(g,[[-26,-10],[-33,-73],[-17,-115],[13,-122],[31,-78],[29,-9]],dark);P.poly(g,[[-18,-10],[-22,-76],[-11,-109],[11,-114],[23,-75],[19,-9]],'#8e9770');P.line(g,-14,-92,-5,-48,c,6);P.line(g,16,-93,8,-16,'#5a755d',5);P.ell(g,0,-73,16,23,'#344e48');P.disc(g,0,-72,10,charging?'#ffe7a1':c);P.disc(g,0,-74,4,'#f6f7cb');P.line(g,-13,-99,-6,-96,light,3);P.line(g,7,-96,14,-99,light,3);
    }else if(en.kind==='leviathan'){
     const sway=Math.sin(t*1.7)*7;P.poly(g,[[26,-28],[73,-48+sway],[105,-77+sway],[97,-41],[110,-25],[82,-23],[64,-7]],dark);P.poly(g,[[28,-29],[72,-42+sway],[95,-66+sway],[82,-33],[99,-26],[65,-14]],c);
     P.ell(g,8,-36+bob,52,32,dark);P.ell(g,7,-40+bob,46,27,c);P.ell(g,-23,-40+bob,26,29,c);P.ell(g,-26,-27+bob,23,11,'#d6cbb0');
     for(let i=0;i<5;i++){const xx=-3+i*14;P.poly(g,[[xx-9,-61+bob],[xx-3,-89+Math.sin(t+i)*4],[xx+8,-62+bob]],i%2?light:c);P.line(g,xx,-57+bob,xx+5,-40+bob,'#588d92',2);}
     for(const s of [-1,1])P.poly(g,[[s*12,-21],[s*35,7],[s*56,-4],[s*28,-30]],s<0?'#6c9f9e':'#99c4b4');P.ell(g,-39,-49+bob,10,9,dark);P.disc(g,-42,-50+bob,4,light);P.line(g,-49,-28+bob,-21,-24+bob,dark,2);P.poly(g,[[-43,-28+bob],[-37,-20+bob],[-33,-27+bob]],light);
    }else if(en.kind==='astral'){
     const cy=-82+bob,turn=t*.3;for(let j=0;j<2;j++){const R=51+j*12,pts=[];for(let i=0;i<=24;i++){const a=i/24*E.TAU+turn*(j?-1:1);pts.push([Math.cos(a)*R,cy+Math.sin(a)*R*.67]);}for(let i=1;i<pts.length;i++)P.line(g,...pts[i-1],...pts[i],j?c:light,j?2:3);}
     for(let i=0;i<5;i++){let a=i/5*E.TAU-turn,xx=Math.cos(a)*62,yy=cy+Math.sin(a)*43;P.poly(g,[[xx,yy-13],[xx+7,yy],[xx,yy+13],[xx-7,yy]],i%2?light:c);}
     for(const s of [-1,1])P.poly(g,[[s*13,cy-23],[s*38,cy-45],[s*67,cy-11],[s*31,cy+17]],dark);P.poly(g,[[0,cy-51],[26,cy],[0,cy+50],[-26,cy]],dark);P.poly(g,[[0,cy-39],[18,cy],[0,cy+36],[-18,cy]],c);P.disc(g,0,cy,12,'#fff2c5');P.disc(g,0,cy,6,'#6b798c');r.glowDisc(g,0,cy,31,c,.2);
    }else if(en.kind==='archive'){
     const cy=-76+bob;for(const s of [-1,1])for(let j=0;j<3;j++){const flap=Math.sin(t*2+j)*6;P.poly(g,[[s*14,cy-21+j*12],[s*(52+j*8),cy-38+j*19+flap],[s*(67+j*6),cy-9+j*20+flap],[s*21,cy+23+j*7]],'#c7bc99');P.line(g,s*31,cy-12+j*15,s*(57+j*5),cy-18+j*18+flap,'#716b62',2);}
     P.poly(g,[[0,cy-58],[24,cy-30],[21,cy+40],[0,cy+62],[-21,cy+40],[-24,cy-30]],dark);P.poly(g,[[-13,cy-24],[13,cy-24],[16,cy+38],[0,cy+48],[-16,cy+38]],c);P.disc(g,0,cy-26,14,c);P.rect(g,-9,cy-29,18,5,dark);P.disc(g,-5,cy-27,2,light);P.disc(g,5,cy-27,2,light);P.line(g,-11,cy+4,10,cy+4,light,3);P.line(g,-11,cy+13,7,cy+13,light,3);P.line(g,-9,cy+22,11,cy+22,light,3);
    }else{
     for(const s of [-1,1]){P.ell(g,s*29,-11,20,10,dark);P.ell(g,s*30,-15,17,9,c);P.line(g,s*22,-27,s*37,-11,c,8);}P.ell(g,0,-27+bob,37,25,dark);P.ell(g,0,-31+bob,32,22,c);P.ell(g,0,-24+bob,20,13,'#d6cca4');for(const s of [-1,1]){P.disc(g,s*18,-50+bob,11,c);P.disc(g,s*18,-51+bob,6,light);P.disc(g,s*19,-51+bob,3,dark);}P.line(g,-16,-32+bob,15,-32+bob,dark,2);P.line(g,0,-51+bob,2,-79+bob,'#abac77',3);P.disc(g,2,-82+bob,7,'#f5df9d');
    }
    g.restore();P.reset(g);
   },{outline:false,rim:false});
  }
  if(en.ward)r.decal(()=>{r.groundRing(x,y,44*scale,c,.7);r.groundRing(x,y,48*scale,c,.3);});
  if(charging)r.decal(()=>{r.groundRing(x,y,(51+Math.sin(t*6)*3)*scale,'#f2b786',.85);});
 }
 drawRootDetails(r,t){
  const id=this.currentRoom,state=this.app.state.campaign?.root;if(!state||!C.root.roomIds.includes(id))return;
  const g=r.ctx,clock=this.game.reduceMotion?0:t;g.save();g.lineJoin='round';g.lineCap='round';
  const ring=(x,y,rx,ry,color,width=3)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.strokeStyle=color;g.lineWidth=width;g.stroke();};
  const line=(x,y,xx,yy,color,width=3)=>{g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.strokeStyle=color;g.lineWidth=width;g.stroke();};
  if(id==='copperweights')for(let i=0;i<3;i++){const x=362+i*114,y=316-state.puzzles.weights[i]*15;P.rect(g,x-23,229,46,115,'#243e43');P.rect(g,x-18,234,36,106,'#966743');line(x,239,x,y,'#e2bc77',4);P.rect(g,x-31,y,62,22,'#503e35');P.rect(g,x-27,y-3,54,19,'#bc8b54');ring(x,y+5,6,5,'#f6d8a0',2);for(let j=0;j<4;j++)P.rect(g,x+25,325-j*15,8,3,j===state.puzzles.weights[i]?'#baf4d4':'#5c493c');}
  if(id==='copperheart'){const x=474,y=257;ring(x,y,78,78,'#362e29',15);ring(x,y,72,72,'#b18758',9);for(let i=0;i<10;i++){const a=i*Math.PI/5+clock*.15;line(x+18*Math.cos(a),y+18*Math.sin(a),x+70*Math.cos(a),y+70*Math.sin(a),'#d2a36b',6);}ring(x,y,15,15,'#f0cc8a',6);}
  if(id==='mothindex')for(let i=0;i<3;i++){const x=369+i*105,y=293+Math.sin(clock+i)*3,col={seed:'#a9bd7c',shelter:'#d3a16e',road:'#87c6d0'}[state.puzzles.sequence[i]]||'#b6a99a';P.poly(g,[[x-39,y-19],[x-4,y-24],[x,y-18],[x+4,y-24],[x+39,y-19],[x+35,y+17],[x,y+22],[x-35,y+17]],'#3b3547');P.poly(g,[[x-35,y-18],[x-4,y-20],[x-2,y+17],[x-32,y+14]],col);P.poly(g,[[x+35,y-18],[x+4,y-20],[x+2,y+17],[x+32,y+14]],'#e7d6ad');line(x,y-18,x,y+20,'#735b5a',2);for(let j=0;j<4;j++)line(x+8,y-11+j*7,x+27,y-10+j*7,'#b39278',1);}
  if(id==='mothvault'){P.poly(g,[[363,282],[557,282],[592,326],[332,326]],'#484052');P.poly(g,[[375,281],[547,281],[575,315],[347,315]],'#c8b990');for(let i=0;i<5;i++)line(370+i*35,286,359+i*39,309,'#977e64',1);ring(462,300,50,13,'#697f88',2);}
  if(id==='mirrorvault')for(let i=0;i<3;i++){const x=364+i*109,y=286,angle=[1,0,3][i]*Math.PI/2+Math.sin(clock*.3)*.025;g.save();g.translate(x,y);g.rotate(angle*.12);P.poly(g,[[0,-54],[31,0],[0,41],[-31,0]],'#233e57');P.poly(g,[[0,-48],[24,0],[0,34],[-24,0]],'#78b9cb');P.poly(g,[[0,-46],[0,31],[-20,0]],'#b4e3e0');line(0,-48,0,33,'#ede1b2',2);g.restore();}
  if(['crownwest','crowneast'].includes(id)){const released=state.anchors.includes(id==='crownwest'?'crown-west':'crown-east'),x=466,y=270;ring(x,y,58,58,'#352c32',11);ring(x,y,54,54,released?'#97d5b4':'#c09a6c',4);for(let i=0;i<6;i++){const a=i*Math.PI/3+clock*.04;line(x+20*Math.cos(a),y+20*Math.sin(a),x+51*Math.cos(a),y+51*Math.sin(a),released?'#77ac96':'#947052',4);}P.disc(g,x,y,18,released?'#b3e8c9':'#dcaa70');for(const dir of [-1,1])line(x+dir*55,y,x+dir*120,y+(released?47:0),released?'#678278':'#7a5646',5);}
  g.restore();
 }
 drawRoomDetails(r,t){
  const id=this.currentRoom,f=this.app.state.campaign?.flags||{};
  if(id==='waycamp')r.queue(...this.world([475,417]),0,g=>{const [x,y]=r.w(...this.world([475,417]));P.ell(g,x,y,24,9,'#3d4842');for(const s of [-1,1])P.line(g,x+s*17,y-4,x-s*13,y,'#a38c65',5);P.poly(g,[[x-11,y-5],[x-5,y-23],[x+1,y-15],[x+5,y-31+Math.sin(t*9)*3],[x+13,y-5]],'#e6aa6a');P.poly(g,[[x-4,y-5],[x+2,y-19],[x+7,y-5]],'#ffe3a2');r.glowDisc(g,x,y-13,43,'#ffbe72',.17);});
  if(id==='moonwell')for(const p of [[428,415],[473,415],[518,415]])this.drawLantern(r,p,f.grove,t);
  if(id==='tideglass')for(const p of [[434,414],[479,414],[524,414]])this.drawLantern(r,p,f.tide,t);
  if(id==='whitewake')for(const p of [[423,416],[468,416],[513,416]])this.drawLantern(r,p,f.abbey,t);
  if(id==='orchard')r.queue(...this.world([340,402]),0,g=>{const [x,y]=r.w(...this.world([340,402]));P.ell(g,x,y,34,12,'#4d543d');for(let i=0;i<7;i++){const xx=x-24+i*8;P.line(g,xx,y+2,xx+4,y-8,'#8a7d58',2);}if(f.side_orchard){P.line(g,x,y,x,y-35,'#97b484',4);P.ell(g,x-9,y-20,11,5,'#aaca8e');P.ell(g,x+9,y-28,11,5,'#bbce94');P.disc(g,x,y-37,6,'#f0dca3');}});
  if(['observatory','dawnspire','quietvault'].includes(id))r.decal(()=>{const p=this.world(id==='quietvault'?[480,417]:[499,426]);r.groundRing(...p,39,'#d5d1b0',.6);r.groundRing(...p,45,'#a9c6cd',.35);});
 }
 drawLantern(r,p,lit=true,t=0){let [x,y]=this.world(p);r.shadow(x,y,12,.32);r.queue(x,y,0,g=>{let [sx,sy]=r.w(x,y,0);P.poly(g,[[sx-12,sy],[sx+12,sy],[sx+9,sy-7],[sx-9,sy-7]],'#716653');P.rect(g,sx-3,sy-44,6,38,'#b3a174');P.poly(g,[[sx-12,sy-44],[sx+12,sy-44],[sx+8,sy-63],[sx-8,sy-63]],'#a6915e');P.rect(g,sx-6,sy-58,12,14,lit?'#fff2b6':'#446869');P.poly(g,[[sx-14,sy-62],[sx,sy-73],[sx+14,sy-62]],'#c3b384');if(lit){r.glowDisc(g,sx,sy-52,35,'#ffd58a',.14);r.glowDisc(g,sx,sy-52,12,'#fff1b1',.28);}});}
 drawChest(r,p,open){let [x,y]=this.world(p);r.shadow(x,y,15,.35);r.queue(x,y,0,g=>{let [sx,sy]=r.w(x,y);P.rect(g,sx-16,sy-19,32,19,'#684833');P.rect(g,sx-16,sy-(open?33:24),32,open?9:10,'#9e7750');P.rect(g,sx-17,sy-4,34,4,'#352e2c');P.rect(g,sx-11,sy-24,3,22,'#cfb878');P.rect(g,sx+8,sy-24,3,22,'#cfb878');P.rect(g,sx-3,sy-13,6,6,'#e7c986');});}
 drawEffects(r){
  const positions=this.battlePositions(),battle=this.app.battle;if(!battle)return;
  for(const f of this.fx){if(f.type!=='action'||f.t>.95)continue;const a=positions[f.actor];if(!a)continue;let targets=Array.isArray(f.targets)?f.targets.map(id=>positions[id]).filter(Boolean):f.target==='all'?battle.heroes.filter(h=>h.hp>0).map(h=>positions[h.id]):positions[f.target]?[positions[f.target]]:[];
   if(['bulwark','rally','limit'].includes(f.action)&&f.actor==='orrin')targets=battle.heroes.map(h=>positions[h.id]);
   if(f.action==='renew')targets=battle.heroes.filter(h=>h.hp>0).map(h=>positions[h.id]);
   if(f.action==='quickstep')targets=battle.heroes.filter(h=>h.hp>0&&h.id!==f.actor).map(h=>positions[h.id]);
   if(['gust','cleave'].includes(f.action))targets=battle.enemies.filter(e=>e.hp>0).map(e=>positions[e.id]);
   const u=E.clamp(f.t/.85,0,1),alpha=Math.sin(u*Math.PI),color=['spark','flare','limit'].includes(f.action)?'#f6df92':['mend','renew','rally','rekindle','quickstep','clearsong','interpose','tonic','feather','bulwark'].includes(f.action)?'#9de3ca':f.action==='frost'?'#9ed8ef':['doom','sweep'].includes(f.action)?'#e5a2b0':'#d5dca2';
   r.overlay(g=>{const start=r.w(a[0],a[1],48);
    for(const target of targets){const end=r.w(target[0],target[1],45);
     if(['spark','frost','flare','limit'].includes(f.action)){
      const k=E.ease.outCubic(E.clamp((u-.08)/.48,0,1));for(let j=0;j<3;j++){const pts=[];for(let i=0;i<=16;i++){const v=i/16*k;pts.push([E.lerp(start[0],end[0],v),E.lerp(start[1],end[1],v)+Math.sin(v*Math.PI*5+j*2+u*9)*8*Math.sin(v*Math.PI)]);}P.blend(g,alpha*.75,'add',()=>{for(let i=1;i<pts.length;i++)P.line(g,...pts[i-1],...pts[i],color,j===0?2:1);});}
      r.glowDisc(g,E.lerp(start[0],end[0],k),E.lerp(start[1],end[1],k),17+Math.sin(u*14)*3,color,alpha*.5);
      if(u>.38)for(let i=0;i<6;i++){const angle=i*Math.PI/3+u*3,R=(u-.38)*69;P.blend(g,alpha,'add',()=>P.line(g,end[0]+Math.cos(angle)*R,end[1]+Math.sin(angle)*R,end[0]+Math.cos(angle)*(R+10),end[1]+Math.sin(angle)*(R+10),color,2));}
     }else if(['mend','renew','rally','rekindle','quickstep','clearsong','interpose','tonic','feather','bulwark','ether'].includes(f.action)){
      const foot=r.w(target[0],target[1],0);for(let j=0;j<8;j++){const angle=j/8*E.TAU+u*4,rx=Math.cos(angle)*23,ry=Math.sin(angle)*7;P.blend(g,alpha*.7,'add',()=>P.line(g,foot[0]+rx,foot[1]+ry-u*56,foot[0]+rx,foot[1]+ry-u*56-8,color,2));}r.glowDisc(g,end[0],end[1],32,color,alpha*.22);
     }else if(['doom','sweep'].includes(f.action)){
      const foot=r.w(target[0],target[1],0);P.blend(g,alpha*.4,'add',()=>{for(let i=0;i<30;i++){let a=i/30*E.TAU;P.line(g,foot[0]+Math.cos(a)*u*85,foot[1]+Math.sin(a)*u*30,foot[0]+Math.cos(a+.12)*u*85,foot[1]+Math.sin(a+.12)*u*30,color,3);}});
     }else if(u>.12&&u<.8){P.blend(g,alpha*.8,'add',()=>{const q=E.clamp((u-.12)/.5,0,1);P.line(g,end[0]-28,end[1]-28,end[0]-28+q*54,end[1]-28+q*50,color,3);P.line(g,end[0]-24,end[1]-27,end[0]-24+q*45,end[1]-27+q*44,'#fff5cd',1);});}
    }
   });
  }
 }
 drawAccordDetails(r,t){
  const c=this.app.state.campaign,A=C.accord,f=c.flags,id=this.currentRoom;if(!A||!f.accord_commission)return;
  const g=r.ctx,time=this.app.options.reducedMotion?0:t;
  if(id==='hearthcross'){
   const colors=['#dfb578','#8dc4b9','#b3bcd6','#dfb578','#8dc4b9','#b3bcd6'];
   for(let i=0;i<12;i++){const x=218+i*43,y=282+Math.sin(i/11*Math.PI)*17;P.line(g,x,y,x+43,282+Math.sin((i+1)/11*Math.PI)*17,'#6e6854',2);}
   A.sixFlags.forEach((flag,i)=>{const x=253+i*88,y=291+Math.sin(i/5*Math.PI)*14,shift=Math.sin(time*1.4+i)*2;P.poly(g,[[x-10,y],[x+11,y],[x+8+shift,y+29],[x+shift,y+23],[x-7+shift,y+29]],f[flag]?colors[i]:'#716f62');if(f[flag])r.glowDisc(g,x,y+13,20,colors[i],.11);});
   if(f.accord_finished){P.poly(g,[[386,407],[550,407],[571,431],[365,431]],'#c4a373');P.line(g,380,432,380,448,'#645347',5);P.line(g,552,432,552,448,'#645347',5);for(let i=0;i<6;i++){const x=393+i*27;P.ell(g,x,419,7,3,'#ebe3bc');P.rect(g,x-1,413,3,6,'#8dbfb2');}}
  }
  if(id==='bracken'&&f.accord_side_bridge){for(let i=0;i<7;i++){const x=501+i*18;P.poly(g,[[x,443],[x+15,443],[x+23,456],[x+8,456]],'#bda479');}P.line(g,500,426,625,426,'#d0b584',4);for(const x of [501,624])P.line(g,x,425,x+7,456,'#8c7658',5);}
  if(id==='saltmere'&&f.accord_side_courier){P.rect(g,376,430,33,20,'#705e47');P.poly(g,[[380,429],[401,429],[403,442],[381,442]],'#ece2bd');P.line(g,381,430,392,437,'#baa578');P.line(g,402,430,392,437,'#baa578');P.disc(g,392,437,2,'#c88962');}
  if(id==='moonwell'&&f.accord_garden_safe){for(let i=0;i<3;i++){const x=465+i*36,y=448+Math.sin(i)*8;P.ell(g,x,y+5,12,3,'#475c50');
    if(i===0){const wing=6+Math.sin(time*5)*2;P.ell(g,x-6,y-5,wing,5,'#d7d6a2');P.ell(g,x+6,y-5,wing,5,'#b4c9a2');P.rect(g,x-1,y-9,3,13,'#6f8975');P.line(g,x,y-8,x-4,y-13,'#abbc91');P.line(g,x+1,y-8,x+5,y-13,'#abbc91');}
    else if(i===2){P.ell(g,x,y,11,7,'#8c9f89');P.ell(g,x,y-3,9,5,'#b6bf8f');P.line(g,x-4,y-6,x-2,y+1,'#758c71');P.line(g,x+3,y-7,x+5,y+1,'#758c71');P.disc(g,x+11,y,4,'#b8c39c');P.disc(g,x+13,y-1,1,'#2d4549');P.line(g,x-5,y+3,x-6,y+7,'#9aab83',2);P.line(g,x+5,y+3,x+6,y+7,'#9aab83',2);}
    else{P.ell(g,x,y,8,5,'#c8baa1');P.disc(g,x+6,y-3,4,'#c9cdb1');P.disc(g,x+6,y-7,2,'#d9c7a7');P.disc(g,x+8,y-3,1,'#2d4549');P.line(g,x-7,y,x-14,y-3+Math.sin(time*2+i)*2,'#9b9f87',1);}
   }}
  if(id==='orchard'&&f.accord_side_garden){for(const x of [516,535,554]){P.ell(g,x,443,7,3,'#c0a37d');P.ell(g,x,442,5,2,'#9bbfb4');}P.line(g,474,416,474,448,'#8e775c',5);P.line(g,474,417,495,411,'#bfa274',3);P.line(g,474,433,495,427,'#bfa274',3);P.line(g,495,409,495,436,'#8e775c',4);}
  if(id==='dawnspire'&&f.accord_chorus)for(let i=0;i<6;i++){const x=291+i*70,y=339+Math.sin(i*.9)*12+Math.sin(time+i)*2;P.line(g,x,y-13,x,y-7,'#afa278',1);P.rect(g,x-5,y-6,10,14,'#d0b781');P.rect(g,x-3,y-3,6,8,'#c6ecce');P.line(g,x-7,y-7,x+7,y-7,'#756750',2);r.glowDisc(g,x,y,23,'#b8e7c6',.12);}
 }
 draw(r){
  if(this.currentRoom==='overworld'&&this.app.mode!=='battle'){this.app.overworld.draw(r);return;}
  const battle=this.app.mode==='battle',art=battle?(this.app.battle?.encounterId==='boss'?'belfry':this.room.art):this.room.art,im=this.images[art];
  if(im?.complete&&im.naturalWidth){r.ctx.imageSmoothingEnabled=true;r.ctx.drawImage(im,0,0,960,540);r.ctx.imageSmoothingEnabled=false;}else r.sky(['#142d40','#375e65','#605b4b']);
  if(this.room.tint)P.blend(r.ctx,.12,'alpha',()=>P.rect(r.ctx,0,0,960,540,this.room.tint));
  if(this.currentRoom==='quay'&&this.app.state.flags.boss)P.blend(r.ctx,.08,'add',()=>P.rect(r.ctx,0,0,960,540,'#ffc96e'));
  const t=this.game.real;this.drawRootDetails(r,t);
  for(let i=0;i<23;i++){let x=(E.hash2(i,23)*1000+t*(i%2?2:-2)+1100)%1000,y=235+E.hash2(i,24)*240+Math.sin(t*.5+i)*8;P.blend(r.ctx,.35+(i%3)*.15,'add',()=>P.disc(r.ctx,x,y,i%3===0?1.5:1,'#ffe1a1'));}
  if(battle){
   P.blend(r.ctx,.13,'alpha',()=>P.rect(r.ctx,0,0,960,540,'#122532'));
   const b=this.app.battle,pos=this.battlePositions();if(b){for(const u of b.heroes){let p=pos[u.id],a={x:p[0],y:p[1],z:0};if(b.activeId===u.id)r.decal(()=>{r.groundRing(a.x,a.y,25,'#f9d995',.9);r.groundRing(a.x,a.y,28,'#f9d995',.35);});this.drawRig(r,u.id,this.rigs[u.id],{flash:this.fx.some(f=>f.type==='damage'&&f.target===u.id&&f.t<.22)?'#ffffff':null});}
    for(const e of b.enemies){if(e.hp<=0)continue;let p=pos[e.id],hurt=this.fx.some(f=>f.type==='damage'&&f.target===e.id&&f.t<.22);this.drawCreature(r,e,p[0],p[1],t,b.enemies.length===1?1.2:1,hurt);}
   }
  }else{
   if(this.currentRoom==='garden'){for(const p of [[549,381],[604,381],[659,381]])this.drawLantern(r,p,!!this.app.state.flags.chime,t);}
   this.drawRoomDetails(r,t);this.drawAccordDetails(r,t);
   for(const n of this.nodes()){const p=this.world(n.p);if(n.kind==='chest')this.drawChest(r,n.p,n.cacheFlag?this.app.state.campaign?.flags[n.cacheFlag]:this.app.state.flags[n.id]);else if(n.kind==='save')this.drawMoth(r,p[0],p[1],t,.55,true);else if(n.id==='thorns')this.drawMoth(r,p[0],p[1],t,.7);else if(n.id==='bellkeeper')this.drawKeeper(r,p[0],p[1],t,true,false,false);else if(n.battle||n.rootHunt){const en=root.MorrowBattle.encounters[n.battle||n.rootHunt].enemies[0];this.drawCreature(r,en,p[0],p[1],t,n.kind==='boss'?.85:.8);}else if(this.rigs[n.id])this.drawRig(r,n.id,this.actors[n.id]);}
   for(const id of ['orrin','mina','ivo'])this.drawRig(r,id,this.actors[id]);
   if(this.moveTarget&&!this.pending){const p=this.moveTarget;r.decal(()=>r.groundRing(p[0],p[1],8+Math.sin(t*5)*2,'#f8e5b4',.7));}
  }
  if(battle){this.drawEffects(r);const joint=this.fx.find(f=>f.type==='concord');if(joint){const pos=this.battlePositions();r.overlay(g=>{const t=joint.t/joint.dur;g.save();g.globalAlpha=Math.max(0,(1-t)*.8);g.strokeStyle='#b9f9df';g.lineWidth=3;g.beginPath();for(const id of ['ivo','mina','orrin']){const p={ivo:[213,313],mina:[296,351],orrin:[136,358]}[id];if(id==='ivo')g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);}g.closePath();g.stroke();g.restore();});}}
  r.overlay(g=>{P.blend(g,.12,'alpha',()=>{P.rect(g,0,0,960,6,'#071720');P.rect(g,0,534,960,6,'#071720');});if(this.fade>0)P.blend(g,this.fade*.8,'alpha',()=>P.rect(g,0,0,960,540,'#0b1721'));});
 }
}
World.rooms=rooms;World.inside=inside;World.nearest=nearest;root.MorrowWorld=World;
})(typeof window!=='undefined'?window:globalThis);
