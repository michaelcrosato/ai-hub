(() => {
const G=Drive,E=G.E;
// Presentation-only state: never serialized or used by collision, AI or rewards.
G.poseState=(s,a)=>{
 const interaction=(s.interaction?.actor===a.id?s.interaction:a.interaction),
  helping=s.crew.some(b=>b!==a&&b.down&&b.zone===a.zone&&G.dist(a,b)<23),
  pose=a.dead?'die':a.down?'down':s.outcome==='success'?'cheer':helping?'kneel':a.reload>0?(a.reload/G.content.weapons[a.weapon].reload>.5?'guard':'cast'):interaction?'cast':undefined;
 return {pose,point:!pose&&(!!a.aimAt||a.cooldown>0),stance:a.cover?'guard':a.aimAt?'ready':'relaxed',crouch:a.cover||a.crouch,hurt:a.hit>0,down:a.down?1:undefined};
};
G.animateActor=(s,a,dt)=>{
 const pose=G.poseState(s,a),state=a.platform?a.platform.rigState(pose):a.rigState(pose);
 if(a.dead||a.down||pose.pose==='cheer'||pose.pose==='kneel')state.vx=state.vy=state.vz=0;
 if(a.cooldown>(a._drawCooldown||0)&&a.reload<=0)a.rig.kick(-.22);
 a._drawCooldown=a.cooldown;a.rig.update(dt,state);
};
G.captionLayout=(s,width,large=false)=>{
 const options=large?{font:'tiny',scale:2}:{font:'normal',scale:1},lines=E.font.wrap(G.pixelText(s.dialogue.text),width,options),pages=Math.ceil(lines.length/2),elapsed=s.time-(s.dialogue.start??s.dialogue.until-5),duration=s.dialogue.duration||5,page=G.clamp(Math.floor(elapsed/(duration/pages)),0,pages-1);
 return {lines:lines.slice(page*2,page*2+2),options,page,pages,lineHeight:large?14:10,height:large?34:24};
};
G.carDetails=(s,car,r)=>{
 const d=G.content.vehicles[car.type],co=Math.cos(car.facing),si=Math.sin(car.facing),
  at=(forward,side,z)=>r.w(car.x+co*forward-si*side,car.y+si*forward+co*side,z),
  interaction=s.interaction,door=interaction&&(interaction.id==='car:'+car.id||interaction.id==='exit'&&s.controlled.vehicle===car.id);
 r.queue(car.x,car.y,0,g=>{
  const side=at(0,1,0)[1]>at(0,-1,0)[1]?1:-1;
  for(const axle of [-1,1]){const [x,y]=at(axle*d.length*.3,side*(d.width/2+1),5),spin=s.time*car.speed*.2;E.px.disc(g,x,y,2,'#849293');E.px.line(g,x-Math.cos(spin)*2,y-Math.sin(spin)*2,x+Math.cos(spin)*2,y+Math.sin(spin)*2,'#283c43');}
  // Faces appear behind the windshield, while the persistent actors remain seated.
  for(const [seat,id]of car.occupants.entries()){const a=s.actors.find(a=>a.id===id);if(!a||seat>1)continue;const [x,y]=at(d.length*.14,seat?-5:5,d.shape==='van'?25:21);E.px.rect(g,x-2,y-2,4,4,a.data?.skin||'#c18b65');E.px.rect(g,x-2,y-3,4,2,a.data?.hair||'#35454b');}
  if(door){const a=at(8,side*d.width/2,6),b=at(-5,side*(d.width/2+11),6),c=at(-5,side*(d.width/2+11),14),e=at(8,side*d.width/2,14);E.px.poly(g,[a,b,c,e],car.color);E.px.line(g,a[0],a[1],b[0],b[1],'#e8d9af');}
  if(car.hp<car.maxHP*.4){for(let i=0;i<3;i++){const age=(s.time*1.2+i/3)%1,[x,y]=at(d.length*.3+age*6,0,24+age*20);E.px.disc(g,x,y,2+age*3,car.hp>0?'#6c7775':'#424f54');}}
 });
};
// Rasterize engine glyphs once; keep a bounded cache for HUD counters and dialogue.
G.textCache=new Map();
G.text=(g,text,x,y,color='#ffffff',options={})=>{
 const o=typeof options==='object'&&options?{...options}: {outline:options},align=o.align;delete o.align;
 const key=JSON.stringify([text,color,o,E.font.default]);let sprite=G.textCache.get(key);
 if(!sprite){const w=E.font.width(text,o),h=E.font.height(String(text).split('\n').length,o),pad=3,cv=document.createElement('canvas');cv.width=w+pad*2;cv.height=h+pad*2;E.font.text(cv.getContext('2d'),text,pad,pad,color,o);sprite={cv,w,h,pad};if(G.textCache.size>=256)G.textCache.delete(G.textCache.keys().next().value);G.textCache.set(key,sprite);}
 g.drawImage(sprite.cv,Math.round(x)-(align==='center'?Math.round(sprite.w/2):align==='right'?sprite.w:0)-sprite.pad,Math.round(y)-sprite.pad);return {w:sprite.w,h:sprite.h};
};
const box=(m,x,y,z,w,d,h)=>['box',m,[x,y,z],[w,d,h]];
G.installArt=()=>{
 for(const [id,d]of Object.entries(G.content.vehicles)){
  const w=d.width,l=d.length,van=d.shape==='van',sport=d.shape==='sport',compact=id==='compact';
  E.SHAPES['sd-car-'+id]={about:'Original Sunspoke '+d.name,mats:{body:d.color,glass:'#4a727d',chrome:'#cbd1bd',metal:'#3e505a',tire:'#26343c',light:'#ffe2a0',red:'#df6556'},parts:[box('tire',0,0,3,w+1,l-8,7),box('body',0,0,6,w,l,8),box('glass',0,-2,14,w-4,van?l-10:compact?l*.62:l*.42,van?13:sport?7:10),box('body',0,-3,van?26:sport?20:23,w-3,van?l-11:compact?l*.5:l*.3,2),box('chrome',0,l/2,6,w+1,2,3),box('chrome',0,-l/2,6,w+1,2,3),box('light',-w*.32,l/2+1,10,5,1,3),box('light',w*.32,l/2+1,10,5,1,3),box('red',-w*.32,-l/2-1,10,4,1,3),box('red',w*.32,-l/2-1,10,4,1,3),...(id==='armored'?[box('body',0,0,28,w-1,l-14,6),box('metal',0,l/2,10,w,4,12)]:[]),...[-1,1].flatMap(sx=>[-1,1].map(sy=>box('tire',sx*w/2,sy*l*.3,2,3,9,8))),...(id==='taxi'?[box('light',0,-2,26,12,5,3)]:[]),...(id==='police'?[box('red',-5,0,26,8,4,3),box('glass',5,0,26,8,4,3)]:[])]};
  const base=E.SHAPES['sd-car-'+id];for(const roll of [-1,1])E.SHAPES['sd-car-'+id+'-roll'+roll]={about:base.about+' / body roll',mats:base.mats,parts:[['group',[0,0,0],[0,roll*3,0],base.parts]]};
 }
 const define=(id,parts,mats={wood:'#b49569',metal:'#496268',green:'#508b72',light:'#ffe0a3',cream:'#e4ca94',red:'#db8267'})=>E.SHAPES['sd-'+id]={about:'Original Sunspoke '+id,mats,parts};
 define('cargo',[box('metal',0,0,0,24,12,28),box('cream',0,7,20,20,1,3),box('red',0,7,7,20,1,3)]);
 define('lift',[box('metal',0,0,0,32,12,5),box('cream',0,0,5,30,10,1)]);
 define('window',[box('metal',0,0,0,14,2,16),box('cream',0,1,0,1,1,16),box('cream',0,1,7,14,1,1),box('cream',0,0,-1,17,4,2)]);
 define('palm',[['cyl','wood',[0,0,0],3,62,{r2:2,seg:5}],...Array.from({length:7},(_,i)=>['group',[0,0,61],i*360/7,[['wedge','green',[0,12,-3],[10,34,6]],['wedge','green',[0,26,-8],[6,18,4]]]])]);
 define('streetLamp',[box('metal',0,0,0,3,3,54),box('metal',5,0,52,14,3,3),box('light',11,0,50,8,6,3)]);
 define('bench',[box('wood',0,0,10,26,10,3),box('wood',0,-5,12,26,2,12),box('metal',-9,0,0,2,8,10),box('metal',9,0,0,2,8,10)]);
 define('planter',[box('cream',0,0,0,18,18,10),['ball','green',[0,0,16],10,{sz:.6}]]);
 define('bollard',[['cyl','metal',[0,0,0],2.5,15,{seg:6}],box('cream',0,0,9,5,5,2)]);
 define('dumpster',[box('green',0,0,2,26,17,18),box('metal',0,0,20,28,19,2)]);
 define('meter',[box('metal',0,0,0,2,2,20),box('green',0,0,20,7,5,9),box('cream',0,3,24,4,1,3)]);
 define('awning',[box('wood',-15,0,0,2,2,24),box('wood',15,0,0,2,2,24),box('red',0,0,24,34,20,3),...[-12,0,12].map(x=>box('cream',x,0,27,5,20,1))]);
 define('sign',[box('metal',0,0,0,2,2,30),box('green',0,0,27,28,3,12),box('cream',0,2,31,22,1,2)]);
 define('chair',[box('wood',0,0,9,9,9,2),box('wood',0,-4,9,9,2,13),...[-3,3].flatMap(x=>[-3,3].map(y=>box('metal',x,y,0,1,1,9)))]);
 define('table',[box('wood',0,0,16,24,18,3),...[-9,9].flatMap(x=>[-6,6].map(y=>box('metal',x,y,0,2,2,16)))]);
 define('hydrant',[['cyl','red',[0,0,0],4,14,{seg:6}],box('red',0,0,10,13,4,4)]);
 define('cone',[['cyl','red',[0,0,0],4,12,{r2:1,seg:4}],box('cream',0,0,6,5,5,2)]);
 define('barrier',[box('cream',0,0,4,40,7,10),...[-14,0,14].map(x=>box('red',x,4,5,7,1,8))]);
 define('fence',[box('metal',-14,0,0,2,2,25),box('metal',14,0,0,2,2,25),box('metal',0,0,8,30,1,2),box('metal',0,0,22,30,1,2)]);
 define('aircon',[box('metal',0,0,0,20,15,13),...[-5,0,5].map(x=>box('cream',x,8,3,2,1,8))]);
 define('antenna',[box('metal',0,0,0,2,2,40),box('metal',0,0,28,30,2,2),box('metal',0,0,37,19,2,2)]);
 define('buoy',[['cyl','red',[0,0,0],8,4,{seg:6}],['cyl','cream',[0,0,4],3,16,{seg:5}]]);
 define('terminal',[box('metal',0,0,0,12,10,14),box('green',0,0,14,12,5,10),box('light',0,3,17,8,1,5)]);
 define('camera',[box('metal',0,0,0,2,2,32),box('cream',0,4,30,6,12,5),box('metal',0,10,31,4,2,3)]);
 define('relay',[box('metal',0,0,0,14,8,20),box('red',-3,5,12,3,1,3),box('light',3,5,12,3,1,3)]);
};
G.drawWorld=(app,r)=>{
 const s=app.session;if(!s)return;const c=s.controlled,zone=c.zone,map=s.maps[zone];
 r.sky(zone==='gantry'?['#6d91a1','#e9bd8d']:['#344f61','#a7c5ba']);
 if(zone==='gantry'){
  r.overlay(g=>{for(let i=0;i<9;i++){const x=((i*93-s.game.cam.x*.15)%600+600)%600;E.px.rect(g,x,90-i%3*12,50,180,'#61838b');E.px.rect(g,x+4,100-i%3*12,42,3,'#91a4a0');}});
  map.draw(r);for(const l of s.lifts)r.shape(l.id==='cargo'?'sd-cargo':'sd-lift',l.x,0,l.z);r.shape('sd-relay',1216,0,64);r.shape('sd-sign',48,0,16);
 }else{
  map.drawFloor(r);map.queueWalls(r);
  if(zone==='city'){
   for(const t of s.tracks)r.decal(()=>{for(const side of [-7,7]){const dx=Math.cos(t.facing),dy=Math.sin(t.facing),a=r.w(t.x-dy*side-dx*5,t.y+dx*side-dy*5,0),b=r.w(t.x-dy*side+dx*5,t.y+dx*side+dy*5,0);E.px.line(r.ctx,a[0],a[1],b[0],b[1],'#394346');}});
   for(const b of s.maps.blocks){if(!r.visible(b.x+b.w/2,b.y+b.h/2,60,b.w,b.h,120))continue;r.shape('sd-aircon',b.x+b.w/2,b.y+b.h/2,map.types[b.type].h);if(b.w>250)r.shape('sd-antenna',b.x+b.w*.7,b.y+b.h*.4,map.types[b.type].h);for(let wx=24;wx<b.w-12;wx+=48)r.shape('sd-window',b.x+wx,b.y+b.h+1,23,{charView:false});for(let wy=24;wy<b.h-12;wy+=48)r.shape('sd-window',b.x+b.w+1,b.y+wy,23,{facing:0,charView:false});r.shape('sd-awning',b.x+b.w*.5,b.y+b.h+10,0,{scale:1.5});r.queue(b.x+b.w*.5,b.y+b.h+3,0,g=>{const [tx,ty]=r.w(b.x+b.w*.5,b.y+b.h+3,43);G.text(g,b.label,tx,ty,'#f8e3b5',{align:'center',font:'tiny',shadow:'#24454b'});});}
   for(const car of s.cars){if(!r.visible(car.x,car.y,0,60,60,60))continue;r.shape('sd-car-'+car.type+(Math.abs(car.speed)>50&&Math.abs(car.steering||0)>.35?'-roll'+Math.sign(car.steering):''),car.x,car.y,0,{facing:car.facing,mats:{body:car.hp>0?car.color:'#536062',red:car.braking?'#ffb48c':'#c25e58'},charView:false});G.carDetails(s,car,r);if(car.type==='police'&&s.alert.heat>0){const [x,y]=r.w(car.x,car.y,28);r.overlay(g=>E.px.rect(g,x-3,y,6,2,app.game.settings.sdFlash!==true&&Math.floor(s.time*6)%2?'#ea7b6d':'#70b6e0'));}}
  }
  for(const p of s.props){if(p.zone!==zone)continue;r.shape(p.id==='crate'||p.id==='barrel'?p.id:'sd-'+p.id,p.x,p.y,0);}
 }
 const mark=s.stage&&G.content.points[s.stage.target];
 if(mark&&mark.zone===zone&&!s.free&&!s.yard){r.decal(()=>r.groundArc(mark.x,mark.y,1,18,0,Math.PI*2,'#f5bd60',.55));r.queue(mark.x,mark.y,0,g=>{const[x,y]=r.w(mark.x,mark.y,35+Math.sin(s.time*3)*2);E.px.poly(g,[[x-4,y],[x+4,y],[x,y+5]],'#ffe1a0');});}
 for(const a of s.actors){if(!a.enabled||a.zone!==zone||a.vehicle||!r.visible(a.x,a.y,a.z,32,32,70))continue;
  r.shadow(a.x,a.y,6,.3,undefined,a.z);
  if(a===c)r.decal(()=>r.groundArc(a.x,a.y,a.z+1,9,0,Math.PI*2,app.game.settings.sdContrast?'#ffffff':a.data?.color||'#f5dba1',.8));
  r.actor(a.x,a.y,a.z,(g,x,y)=>{a.rig.draw(g,x,y,r.view);},{xray:a===c,every:3,key:a,flash:a.hit>0&&app.game.settings.sdFlash!==true?'#ffddaa':undefined});
  if(!a.down&&!a.dead&&s.time-(a.lastShotAt??-1)<.06&&app.game.settings.sdFlash!==true)r.queue(a.x,a.y,a.z,g=>{const tip=a.rig.tip(),[x,y]=r.w(...tip);E.px.poly(g,[[x-4,y],[x-1,y-1],[x,y-4],[x+1,y-1],[x+4,y],[x+1,y+1],[x,y+4],[x-1,y+1]],'#ffe6ad');});
  if(a.team==='crew'||a.witness||a.suspicion>.6)r.queue(a.x,a.y,a.z,g=>{const[x,y]=r.w(a.x,a.y,a.z+42);if(a.team==='crew'){E.px.rect(g,x-5,y,10,2,'#253b46');E.px.rect(g,x-5,y,Math.round(10*a.hp/a.maxHP),2,a.color);}else if(a.witness)G.text(g,'!',x,y,'#ffb76c',{align:'center'});});
 }
 s.bullets[zone].draw(r);
 if(s.yard)for(const p of s.yardStations)r.queue(p.x,p.y,0,g=>{const[x,y]=r.w(p.x,p.y,25);G.text(g,p.label.toUpperCase(),x,y,'#fff1c9',{align:'center',font:'tiny'});});
 if(s.time>20)r.overlay(g=>{g.save();g.fillStyle='rgba(62,46,91,'+Math.min(.10,(s.time-20)/1800)+')';g.fillRect(0,0,r.W,r.H);g.restore();});
 if(app.mode==='play'||app.mode==='demo')G.drawHUD(app,r);
};
G.drawHUD=(app,r)=>{
 if(app.mobile&&app.mode==='demo')return;
 const s=app.session,c=s.controlled,ink=app.game.settings.sdContrast?'#ffffff':'#f4ead1',gold=app.game.settings.sdContrast?'#fff479':'#f5be62',dark=app.game.settings.sdContrast?'#0b171fff':'#16313ae8',px=E.px;
 r.overlay(g=>{
  const W=r.W,margin=Math.max(18,Math.ceil(W*.05)),H=r.H-Math.max(9,Math.ceil(r.H*.05))-(s.dialogue&&app.game.settings.sdSubtitle==='large'?10:0);
  if(app.mode==='demo'){E.ui.box(g,W/2-86,12,172,21,{bg:dark,border:'#597b7d',alpha:.9});G.text(g,'LIVE DEMO / ANY INPUT TO EXIT',W/2,19,ink,{align:'center',font:'tiny'});}
  else {G.text(g,s.yard?'SYSTEMS TEST YARD':s.definition.name,margin,14,gold,{font:'tiny'});const lines=G.wrap(s.free?'Palm Quay is yours. Find a job or explore.':s.stage?.title||'The job is done.',Math.floor((W-64)/6));lines.forEach((line,i)=>G.text(g,line.toUpperCase(),margin,25+i*10,ink,{shadow:'#132d35'}));}
  const target=G.content.points[s.stage?.target];if(target&&target.zone===c.zone&&G.dist(c,target)>160&&!s.free&&!s.yard){const[tx,ty]=r.w(target.x,target.y,0),x=G.clamp(tx,24,W-24),y=G.clamp(ty,65,H-125);if(x!==tx||y!==ty){px.disc(g,x,y,8,gold);G.text(g,'!',x,y-3,'#173b44',{align:'center'});G.text(g,Math.round(G.dist(c,target)*.125)+'m',x,y+11,ink,{align:'center',font:'tiny',shadow:'#142e36'});}}
  const heat=G.content.heatNames[s.alert.heat];G.text(g,heat,W-margin,15,s.alert.heat?'#f39b76':'#93c8ae',{align:'right',font:'tiny'});if(s.alert.heat)G.text(g,s.alert.mode.toUpperCase(),W-margin,27,ink,{font:'tiny',align:'right'});
  for(const [i,a]of s.crew.entries()){const compact=W<400,x=margin+i*(compact?30:42),y=H-62;E.ui.box(g,x,y,compact?27:36,33,{bg:dark,border:a===c?a.color:'#44616a',alpha:.9});const size=compact?18:23;if(!a.portraits)a.portraits={};if(!a.portraits[size]){const cv=document.createElement('canvas');cv.width=cv.height=size;a.rig.drawPortrait(cv.getContext('2d'),0,0,size,{bg:'#263d46',weapon:false,frame:false});a.portraits[size]=cv;}g.drawImage(a.portraits[size],x+2,y+4);G.text(g,a.id.slice(0,1).toUpperCase(),x+(compact?23:28),y+5,a.color,{align:'center',font:'tiny'});E.ui.bar(g,x+3,y+28,compact?21:28,2,a.down?0:a.hp/a.maxHP,a.color);if(a.armor>0)E.ui.bar(g,x+3,y+25,compact?21:28,1,a.armor/40,'#8fc7de');}
  const weapon=G.content.weapons[c.weapon];G.text(g,c.vehicle?G.content.vehicles[s.cars.find(v=>v.id===c.vehicle).type].name.toUpperCase():weapon.name,margin+(W<400?96:132),H-55,gold,{font:'tiny'});G.text(g,c.vehicle?Math.round(Math.abs(s.cars.find(v=>v.id===c.vehicle).speed)*.3)+' KM/H':c.reload>0?'RELOADING':`${c.ammo[c.weapon]} / ${c.reserve[c.weapon]}`,margin+(W<400?96:132),H-43,ink);G.text(g,c.abilityCD>0?'SKILL '+Math.ceil(c.abilityCD)+'s':'SKILL READY',margin+(W<400?96:132),H-31,'#8fbbb5',{font:'tiny'});
  if(s.controlled.zone==='city'){
   const x=W-88,y=H-94,size=68;E.ui.box(g,x-4,y-4,size+8,size+8,{bg:dark,border:'#6e9290',alpha:.95});
   const scale=size/2560;
   for(const b of s.maps.blocks)px.rect(g,x+b.x*scale,y+b.y*scale,b.w*scale,b.h*scale,'#607a78');
   for(const p of G.content.places)px.rect(g,x+p.x*scale-1,y+p.y*scale-1,2,2,'#b09a70');
   const p=G.content.points[s.stage?.target];if(p)px.rect(g,x+p.x*scale-2,y+p.y*scale-2,4,4,gold);
   for(const a of s.crew)px.rect(g,x+a.x*scale-1,y+a.y*scale-1,a===c?3:2,a===c?3:2,a.color);
   if(!s.dialogue)G.text(g,s.alert.heat?'BREAK SIGHT':'PALM QUAY',x+size/2,y+size+6,ink,{align:'center',font:'tiny'});
  }
  const p=G.nearestInteraction(s);if(p&&!app.crewOpen){const txt=(app.game.input.label('interact')+' HOLD / '+p.label).toUpperCase(),w=Math.min(W-40,E.font.width(txt)+18);E.ui.box(g,W/2-w/2,H-91,w,20,{bg:dark,border:gold,alpha:.95});G.text(g,txt,W/2,H-85,ink,{align:'center'});if(s.interaction)E.ui.bar(g,W/2-w/2,H-71,w,2,s.interaction.time/s.interaction.duration,gold);}
  if(s.dialogue&&app.game.settings.sdCaptions!==false){const cap=G.captionLayout(s,W-margin*2-12,app.game.settings.sdSubtitle==='large'),bottom=r.H-Math.max(9,Math.ceil(r.H*.05)),y=bottom-cap.height;E.ui.box(g,margin,y,W-margin*2,cap.height,{bg:dark,alpha:.95});cap.lines.forEach((line,i)=>G.text(g,line,W/2,y+4+i*cap.lineHeight,ink,{...cap.options,align:'center',shadow:'#142b35'}));}
  if(s.notification)G.text(g,G.pixelText(s.notification.text),W/2,57,gold,{align:'center',font:'tiny',shadow:'#182d34'});
  if(app.crewOpen){E.ui.box(g,W/2-120,H/2-45,240,84,{bg:'#15343df5',border:gold});G.text(g,'SELECT CREW / RELEASE TO SWITCH',W/2,H/2-36,ink,{align:'center',font:'tiny'});s.crew.forEach((a,i)=>{const x=W/2-95+i*76;a.rig.drawPortrait(g,x,H/2-20,28,{bg:app.crewChoice===i?'#bf874f':'#30535a',weapon:false});G.text(g,a.id.toUpperCase(),x+14,H/2+13,a.color,{font:'tiny',align:'center'});G.text(g,a.task.toUpperCase(),x+14,H/2+24,ink,{font:'tiny',align:'center'});});}

 });
};
G.pixelText=text=>String(text).replace(/[—–]/g,'-').replace(/·/g,'/');
G.wrap=(text,n)=>{const lines=[];let line='';for(const word of G.pixelText(text).split(' ')){if((line+' '+word).length>n){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;};
})();
