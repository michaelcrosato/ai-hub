/* Lanternwake: The Hollow Bell. Original game systems, MIT license. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LanternCore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const TILE = 16, TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const SEAL_DEFS = [
    { id: 'hearth', x: 240, y: 592, label: 'The last hearth', name: 'Mira, the hearthkeeper', reward: 'A home remembers its warmth.', detail: 'Mira and her cottage return to the village. Each restored seal heals you.', total: 4, types: ['husk'], target: [220, 790] },
    { id: 'carpenter', x: 464, y: 512, label: 'Hands that build', name: 'Tern, the bridgewright', reward: 'A pair of hands. A way across.', detail: 'Return to Tern in the village. He can repair the east bridge.', total: 5, types: ['husk', 'husk', 'wisp'], target: [432, 778] },
    { id: 'moth', x: 800, y: 768, label: 'A small, brave light', name: 'Sol, the lantern moth', reward: 'Even a little light can push back the dark.', detail: 'Mothlight unlocked. Cast a pulse to strike enemies and clear hostile shots. Light recharges.', total: 6, types: ['husk', 'wisp'], target: [800, 768] },
    { id: 'willow', x: 1088, y: 592, label: 'Roots remember', name: 'The elder willow', reward: 'Old roots find their way home.', detail: 'The willow opens a root bridge to the north. Its branches also hide a memory seed.', total: 6, types: ['husk', 'brute', 'wisp'], target: [145, 876] },
    { id: 'millwright', x: 1088, y: 336, label: 'The river in the stone', name: 'Orren, the millwright', reward: 'Still water begins to dream of motion.', detail: 'Orren and the village mill return. Turn its wheel to open the old aqueduct.', total: 7, types: ['wisp', 'brute', 'husk'], target: [460, 900] },
    { id: 'archivist', x: 800, y: 240, label: 'Names in the rain', name: 'Ilex, the keeper of names', reward: 'A name is a promise that someone remembers.', detail: 'Dawnneedle gains its final edge. The Hollow Warden waits beyond the aqueduct.', total: 7, types: ['brute', 'wisp', 'wisp', 'husk'], target: [366, 756] },
    { id: 'rook', x: 496, y: 336, label: 'Wings over water', name: 'A silver rook', reward: 'The sky has a voice again.', detail: 'The rook opens a stair back to the west garden. Find three memory seeds for an extra heart.', total: 8, types: ['wisp', 'husk', 'brute'], target: [294, 886] },
    { id: 'keeper', x: 240, y: 304, label: 'The bell that sleeps', name: 'Sella, the bellkeeper', reward: 'One voice returns. A whole village answers.', detail: 'All eight echoes are free. Go north and touch the Hollow Bell to face its keeper.', total: 8, types: ['brute', 'wisp', 'husk', 'brute'], target: [350, 832] }
  ];
  const NPCS = [
    {id:'mira',name:'Mira',title:'Hearthkeeper',x:220,y:816,requires:'hearth',color:'#dd9e73',facing:1.2},
    {id:'tern',name:'Tern',title:'Bridgewright',x:432,y:796,requires:'carpenter',color:'#e5be70',facing:2},
    {id:'willow',name:'Elder willow',title:'Older than the bell',x:145,y:886,requires:'willow',color:'#98cab0',facing:0},
    {id:'orren',name:'Orren',title:'Millwright',x:422,y:915,requires:'millwright',color:'#72afa3',facing:3.5},
    {id:'ilex',name:'Ilex',title:'Keeper of names',x:366,y:788,requires:'archivist',color:'#aa91c4',facing:2.5},
    {id:'rook',name:'Silver rook',title:'An excellent listener',x:294,y:886,requires:'rook',color:'#c5d8e0',facing:0},
    {id:'sella',name:'Sella',title:'Bellkeeper',x:350,y:866,requires:'keeper',color:'#ded4a0',facing:1}
  ];
  function seeded(seed) { let s = seed | 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeMap() {
    const width=80,height=64, a=Array.from({length:height},()=>Array(width).fill('~'));
    const rect=(x0,y0,x1,y1,c)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)a[y][x]=c;};
    const island=(x0,y0,x1,y1,c)=>{rect(x0,y0,x1,y1,'#');rect(x0+1,y0+1,x1-1,y1-1,c);};
    island(3,42,34,61,','); island(3,27,33,43,',');
    rect(7,41,30,44,',');
    island(41,28,75,61,','); island(44,7,75,27,':'); island(10,6,35,25,':');
    // Walkable road network. Every bridge has a generous four-tile width.
    rect(19,36,21,59,'.'); rect(12,48,28,50,'.'); rect(12,54,29,56,'.');
    rect(13,36,29,38,'.'); rect(27,30,29,38,'.'); rect(13,35,16,37,'.');
    rect(31,37,43,40,'G'); rect(31,37,33,40,'.'); rect(41,37,44,40,'.');
    rect(44,37,67,40,'.'); rect(48,38,51,49,'.'); rect(49,47,67,49,'.'); rect(66,33,68,49,'.');
    rect(64,25,68,29,'G'); rect(64,24,68,25,':'); rect(64,29,68,30,',');
    rect(65,15,69,24,'.'); rect(48,14,68,16,'.'); rect(48,14,51,20,'.');
    rect(34,16,45,19,'G'); rect(34,16,35,19,':'); rect(44,16,45,19,':');
    rect(14,17,32,20,'.'); rect(21,10,24,20,'.');
    rect(28,24,30,29,'G'); rect(28,28,30,29,',');
    // Bell dais and small side clearings.
    rect(17,8,28,14,':'); rect(6,54,11,58,',');
    // Broken walls shape the ruins without creating narrow combat lanes.
    rect(54,9,54,12,'#'); rect(57,21,60,21,'#'); rect(71,12,73,12,'#');
    rect(12,9,14,9,'#'); rect(31,8,33,9,'#');
    return {width,height,base:a.map(row=>row.join(''))};
  }
  class World {
    constructor(options={}) {
      this.seed=options.seed||712; this.random=seeded(this.seed); this.difficulty=options.difficulty==='gentle'?'gentle':'standard';
      const m=makeMap(); this.width=m.width;this.height=m.height;this.baseTiles=m.base;this.tiles=m.base.slice();
      this.time=0;this.playTime=0;this.mode='title';this.area='village';this.events=[];this.revision=0;
      this.restored=new Set();this.seals=SEAL_DEFS.map(s=>({...s,state:'sealed',remaining:s.total,spawned:0,spawnClock:0}));
      this.npcs=NPCS.map(n=>({...n}));this.props=[];this.enemies=[];this.projectiles=[];this.effects=[];this.pickups=[];
      this.flags={bridgeBuilt:false,millRunning:false};this.seeds=[{id:'willow',x:114,y:924,found:false,requires:'willow'},{id:'reed',x:1144,y:904,found:false},{id:'archive',x:1160,y:176,found:false}];
      this.shrines=[{id:'hearth',name:'Village hearth',x:330,y:858,active:true},{id:'garden',name:'West garden',x:350,y:632,active:false},{id:'grove',name:'Mothwood',x:908,y:818,active:false},{id:'ruins',name:'Rain Archive',x:992,y:400,active:false},{id:'bell',name:'Bell court',x:416,y:360,active:false}];
      this.checkpoint='hearth';this.lastField='garden';this.boss=null;this.defeatedBoss=false;this.completed=false;this.endingTime=0;this.combat=false;this.nextId=1;
      this.stats={kills:0,deaths:0,dashes:0,casts:0,damageTaken:0};
      this.hero={x:330,y:880,z:0,vx:0,vy:0,facing:-Math.PI/2,hp:12,maxHp:12,light:3,maxLight:3,level:1,attack:null,attackCooldown:0,combo:0,comboWindow:0,dashTime:0,dashCooldown:0,dashX:0,dashY:-1,hurt:0,invuln:0,pose:null};
      this.buildProps();this.rebuildMap();
    }
    emit(type,data={}) {this.events.push({type,...data});}
    effect(type,x,y,options={}) {this.effects.push({type,x,y,age:0,life:options.life||.6,...options});}
    buildProps() {
      const add=(type,x,y,more={})=>this.props.push({id:'prop'+this.props.length,type,x,y,...more});
      add('cottage',220,782,{requires:'hearth',w:76,h:52});
      add('workshop',432,763,{requires:'carpenter',w:76,h:48});
      add('cottage',366,753,{requires:'archivist',w:58,h:45,variant:1});
      add('mill',474,888,{requires:'millwright',w:78,h:55});
      add('willow',145,862,{requires:'willow',w:92});add('well',330,842);add('bell',352,166,{w:84});
      add('banner',195,757,{requires:'hearth'});add('banner',454,744,{requires:'carpenter'});
      add('bench',275,903,{requires:'rook'});add('flowers',185,829,{requires:'hearth'});add('flowers',244,838,{requires:'hearth'});
      add('flowers',368,906,{requires:'keeper'});add('fountain',356,917,{requires:'boss'});
      for (const [x,y] of [[292,798],[366,836],[311,896],[464,813],[254,731],[320,628],[699,614],[904,784],[1080,465],[1008,387],[743,289],[424,366],[277,209]]) add('lantern',x,y);
      add('arch',611,619,{variant:0});add('arch',669,286,{variant:1});
      // Trees frame clear routes. Their trunks have small collision footprints.
      for (const [x,y] of [[110,721],[119,771],[102,832],[126,971],[189,956],[476,963],[528,744],[518,703],[99,452],[134,477],[94,526],[109,615],[155,659],[432,457],[506,548],[428,676],[506,668],[732,938],[715,803],[694,691],[724,521],[855,507],[920,470],[1166,488],[1184,558],[1164,654],[1182,765],[1136,829],[1103,949],[991,961],[888,925],[764,920],[976,687],[885,669],[939,577],[768,859]]) add('tree',x,y,{variant:this.props.length%5});
      for (const [x,y] of [[176,686],[382,677],[527,587],[997,855],[1063,866],[969,537],[1148,268],[764,375],[845,157],[598,303],[185,362],[520,196]]) add('rock',x,y,{variant:this.props.length%3});
      for (const [x,y] of [[200,518],[357,473],[849,732],[944,920],[1118,514],[1180,377],[833,357]]) add('mushroom',x,y);
      for (const [x,y] of [[708,854],[742,958],[1132,943],[1133,895],[1162,880],[951,460],[505,934]]) add('reeds',x,y);
      for (const [x,y] of [[758,182],[956,180],[1133,222],[967,329],[274,349],[523,285]]) add('gravestone',x,y);
      for (const [x,y] of [[188,770],[465,767],[988,297],[1147,195]]) add('crate',x,y,{requires:x<500?'carpenter':undefined});
    }
    rebuildMap() {
      const a=this.baseTiles.map(r=>r.split(''));
      const rect=(x0,y0,x1,y1,c)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)a[y][x]=c;};
      if(this.flags.bridgeBuilt)rect(34,37,40,40,'=');
      if(this.restored.has('willow'))rect(64,26,68,28,'=');
      if(this.flags.millRunning)rect(36,16,43,19,'=');
      if(this.restored.has('rook'))rect(28,24,30,27,'.');
      this.tiles=a.map(r=>r.join(''));this.revision++;
    }
    tileAt(x,y) {return this.tiles[Math.floor(y/TILE)]?.[Math.floor(x/TILE)]||' ';}
    isWalkable(x,y,r=5,props=true) {
      for(const [dx,dy] of [[0,0],[-r,-r],[r,-r],[-r,r],[r,r]]) if(!'.,:= '.includes(this.tileAt(x+dx,y+dy)) || this.tileAt(x+dx,y+dy)===' ')return false;
      if(props) for(const p of this.props) {
        if(p.requires && !(p.requires==='boss'?this.completed:this.restored.has(p.requires)))continue;
        if(['cottage','workshop','mill'].includes(p.type)) {
          const w=(p.w||64)*.72, h=22;
          if(x+r>p.x-w/2&&x-r<p.x+w/2&&y+r>p.y-h&&y-r<p.y+3)return false;
        } else if((p.type==='tree'||p.type==='rock')&&Math.hypot(x-p.x,y-p.y)<r+5)return false;
      }
      return true;
    }
    moveBody(body,dx,dy,r=5) {
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4)); dx/=steps;dy/=steps;
      for(let i=0;i<steps;i++) {if(this.isWalkable(body.x+dx,body.y,r))body.x+=dx;if(this.isWalkable(body.x,body.y+dy,r))body.y+=dy;}
    }
    lineClear(a,b) {const d=distance(a,b),n=Math.ceil(d/7);for(let i=1;i<n;i++)if(!this.isWalkable(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,1,false))return false;return true;}
    startNew() {this.mode='playing';this.emit('dialog',{name:'The hollow remembers',subtitle:'Chapter I · The Hollow Bell',lines:['The bell fell silent. Then the village forgot how to exist.','You carry Dawnneedle, a blade that can cut the hush. Free eight echoes from the seals, and bring their world back.','Follow the lanterns north. Defeat the shadows, then step onto the empty seal.']});this.emit('save');}
    tickAmbient(dt) {
      this.time+=dt;for(const e of this.effects)e.age+=dt;this.effects=this.effects.filter(e=>e.age<e.life);
      if(this.mode==='ending')this.endingTime+=dt;
    }
    canActivate(seal) {
      const i=this.seals.indexOf(seal);
      if(i>0&&!this.restored.has(this.seals[i-1].id))return false;
      if(seal.id==='moth'&&!this.flags.bridgeBuilt)return false;
      if(seal.id==='rook'&&!this.flags.millRunning)return false;
      return true;
    }
    update(dt,input={}) {
      dt=clamp(dt,0,.05);this.tickAmbient(dt);
      if(this.mode!=='playing')return;
      this.playTime+=dt;const h=this.hero;
      h.hurt=Math.max(0,h.hurt-dt);h.invuln=Math.max(0,h.invuln-dt);h.attackCooldown=Math.max(0,h.attackCooldown-dt);h.dashCooldown=Math.max(0,h.dashCooldown-dt);h.comboWindow=Math.max(0,h.comboWindow-dt);
      h.light=Math.min(h.maxLight,h.light+dt*(this.combat?.115:.3));
      this.combat=this.enemies.some(e=>!e.dead&&distance(e,h)<190)||!!(this.boss&&!this.boss.dead);
      let [mx,my]=input.move||[0,0];const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
      if(input.aim&&input.aimType==='world'&&input.attack&&!input.lockFacing) h.facing=Math.atan2(input.aim[1]-h.y,input.aim[0]-h.x);
      else if(input.aim&&input.aimType==='direction'&&!input.lockFacing) h.facing=Math.atan2(input.aim[1],input.aim[0]);
      else if(Math.hypot(mx,my)>.12&&!input.lockFacing&&!h.attack)h.facing=Math.atan2(my,mx);
      if(input.dash&&h.dashCooldown<=0) {
        const m=Math.hypot(mx,my);h.dashX=m>.15?mx/m:Math.cos(h.facing);h.dashY=m>.15?my/m:Math.sin(h.facing);h.dashTime=.2;h.dashCooldown=.72;h.invuln=Math.max(h.invuln,.23);h.attack=null;h.attackCooldown=.1;this.stats.dashes++;this.emit('sfx',{name:'dash'});
      }
      if(h.dashTime>0) {h.dashTime=Math.max(0,h.dashTime-dt);h.vx=h.dashX*210;h.vy=h.dashY*210;if(Math.floor(this.time*35)!==Math.floor((this.time-dt)*35))this.effect('dash',h.x,h.y,{life:.25,color:'#a9e4d7'});}
      else {const speed=h.attack?57:83;h.vx=mx*speed;h.vy=my*speed;}
      this.moveBody(h,h.vx*dt,h.vy*dt,5);
      // Keep the boss duel within the visible, open court.
      if(this.boss&&!this.boss.dead) {h.x=clamp(h.x,180,547);h.y=clamp(h.y,120,367);}
      if(input.magic)this.cast();
      let attack=!!(input.attack||input.attackPressed);
      if(input.autoAttack&&h.dashTime<=0) {const e=this.nearestEnemy(42);if(e){attack=true;if(!input.lockFacing)h.facing=Math.atan2(e.y-h.y,e.x-h.x);}}
      if(attack&&!h.attack&&h.attackCooldown<=0&&h.dashTime<=0)this.attack();
      if(h.attack) {
        h.attack.u+=dt/.34;
        if(h.attack.u>.2&&h.attack.u<.68)for(const e of this.enemies)if(!e.dead&&!h.attack.hit.has(e.id)&&distance(h,e)<(h.attack.combo===2?46:39)+(e.type==='boss'?13:4)&&Math.abs(angleDiff(h.facing,Math.atan2(e.y-h.y,e.x-h.x)))<1.32&&this.lineClear(h,e)) {
          h.attack.hit.add(e.id);this.damageEnemy(e,4+h.level+(h.attack.combo===2?3:0),'sword');
        }
        if(h.attack.u>=1){h.attack=null;h.attackCooldown=.045;}
      }
      for(const seal of this.seals) {
        if(seal.state==='sealed'&&this.canActivate(seal)&&distance(seal,h)<77&&!this.combat)this.activateSeal(seal);
        if(seal.state==='active') {
          seal.spawnClock-=dt;
          const alive=this.enemies.filter(e=>e.seal===seal.id&&!e.dead).length;
          if(seal.spawned<seal.total&&seal.spawnClock<=0&&alive<3){this.spawnEnemy(seal);seal.spawnClock=.72;}
          if(seal.remaining<=0){seal.state='ready';this.emit('sealReady',{id:seal.id});}
        }
        if(seal.state==='ready'&&distance(seal,h)<20)this.restoreSeal(seal.id);
      }
      for(const e of this.enemies)if(!e.dead)this.updateEnemy(e,dt);
      this.updateProjectiles(dt);
      this.enemies=this.enemies.filter(e=>!e.dead||this.time-e.diedAt<.65);
      for(const p of this.pickups) {
        p.age+=dt;const d=distance(p,h);if(d<53){const k=Math.min(1,dt*7);p.x+=(h.x-p.x)*k;p.y+=(h.y-p.y)*k;}
        if(d<12){p.dead=true;if(p.type==='health')h.hp=Math.min(h.maxHp,h.hp+2);else h.light=Math.min(h.maxLight,h.light+.28);this.emit('sfx',{name:'collect'});}
      }
      this.pickups=this.pickups.filter(p=>!p.dead&&p.age<35);
      for(const s of this.seeds)if(!s.found&&(!s.requires||this.restored.has(s.requires))&&distance(s,h)<17)this.collectSeed(s);
      for(const s of this.shrines) if(distance(s,h)<26) {
        if(!s.active){s.active=true;this.emit('toast',{title:'Waylight found',text:s.name+' is now on your map.'});this.emit('save');}
        if(!this.combat){this.checkpoint=s.id;if(s.id!=='hearth')this.lastField=s.id;}
      }
      if(input.interact)this.interact();
      const area=this.getArea(h.x,h.y);if(area!==this.area){this.area=area;this.emit('area',{area});}
      if(h.hp<=0)this.die();
    }
    getArea(x,y) {if(x<570&&y>689)return 'village';if(x<570&&y>420)return 'garden';if(x>630&&y>433)return 'grove';if(x>630)return 'ruins';return 'bell';}
    nearestEnemy(range=Infinity) {let best=null,d=range;for(const e of this.enemies){if(e.dead)continue;const n=distance(e,this.hero);if(n<d&&this.lineClear(this.hero,e)){best=e;d=n;}}return best;}
    attack() {const h=this.hero;h.combo=h.comboWindow>0?(h.combo+1)%3:0;h.comboWindow=.85;h.attack={u:0,combo:h.combo,hit:new Set()};this.emit('sfx',{name:'sword'});}
    cast() {
      const h=this.hero;if(!this.restored.has('moth')||h.light<1||h.castCooldown>0||h.dashTime>0)return false;
      if(this.time<(this.lastCast||-2)+.38)return false;this.lastCast=this.time;
      h.light-=1;this.stats.casts++;this.effect('magic',h.x,h.y,{life:.55,radius:76,color:'#b9efcf'});this.emit('sfx',{name:'cast'});this.emit('impact',{strength:1});
      for(const e of this.enemies)if(!e.dead&&distance(e,h)<83&&this.lineClear(h,e))this.damageEnemy(e,12+h.level*2,'magic');
      this.projectiles=this.projectiles.filter(p=>distance(p,h)>94||p.type==='ring');return true;
    }
    activateSeal(s) {s.state='active';s.spawnClock=.12;s.spawned=0;s.remaining=s.total;this.combat=true;this.emit('encounter',{id:s.id,label:s.label,total:s.total});this.effect('seal',s.x,s.y,{life:1.0,radius:40});}
    spawnEnemy(s) {
      const i=s.spawned++,type=s.types[i%s.types.length];let x=s.x,y=s.y;
      for(let j=0;j<16;j++){const a=i*2.4+j*.7,rad=25+(i%3)*9;const nx=s.x+Math.cos(a)*rad,ny=s.y+Math.sin(a)*rad;if(this.isWalkable(nx,ny,8)&&distance({x:nx,y:ny},this.hero)>17){x=nx;y=ny;break;}}
      const hp={husk:11,wisp:9,brute:26}[type];
      this.enemies.push({id:this.nextId++,type,x,y,z:type==='wisp'?9:0,facing:0,hp,maxHp:hp,hit:0,windup:0,state:'spawn',timer:.65,phase:0,seal:s.id,homeX:s.x,homeY:s.y,cooldown:.4+i*.1,dead:false,vx:0,vy:0});
      this.effect('spawn',x,y,{life:.65,color:'#c888b5'});
    }
    damageEnemy(e,amount,kind) {
      if(e.dead||e.state==='spawn')return;
      if(this.difficulty==='gentle')amount*=1.25;
      if(e.type==='boss'&&e.state!=='recover')amount*=.4;
      if(e.type==='brute'&&kind==='sword'&&e.state==='chase'&&Math.abs(angleDiff(e.facing,Math.atan2(this.hero.y-e.y,this.hero.x-e.x)))<.8){amount*=.5;this.effect('guard',e.x,e.y,{life:.25});}
      amount=Math.max(1,Math.round(amount));e.hp-=amount;e.hit=.18;
      this.effect('hit',e.x,e.y,{life:.25,color:kind==='magic'?'#c8f9c4':'#ffd791'});this.effect('number',e.x,e.y,{life:.6,text:String(amount),color:'#ffe3a8'});this.emit('sfx',{name:'hit'});this.emit('impact',{strength:e.type==='boss'?1.8:.55});
      if(e.type!=='boss'){const a=Math.atan2(e.y-this.hero.y,e.x-this.hero.x);this.moveBody(e,Math.cos(a)*9,Math.sin(a)*9,6);if(kind==='magic'){e.state='recover';e.timer=.65;e.windup=0;}}
      if(e.hp<=0)this.killEnemy(e);
    }
    killEnemy(e) {
      e.dead=true;e.diedAt=this.time;e.hp=0;this.stats.kills++;this.effect('burst',e.x,e.y,{life:.7,color:'#f0be8f'});
      if(e.type==='boss'){this.defeatedBoss=true;this.combat=false;this.projectiles=[];this.hero.hp=this.hero.maxHp;this.emit('bossDefeated');this.emit('sfx',{name:'bosswin'});this.emit('save');return;}
      const seal=this.seals.find(s=>s.id===e.seal);if(seal)seal.remaining=Math.max(0,seal.remaining-1);
      this.pickups.push({x:e.x,y:e.y,type:this.stats.kills%5===0?'health':'light',age:0});
    }
    updateEnemy(e,dt) {
      e.hit=Math.max(0,e.hit-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.timer-=dt;
      if(e.type==='boss'){this.updateBoss(e,dt);return;}
      const h=this.hero,d=distance(e,h),a=Math.atan2(h.y-e.y,h.x-e.x);e.vx=e.vy=0;
      if(e.state==='spawn'){if(e.timer<=0){e.state='chase';e.timer=0;}return;}
      if(e.state==='recover'){if(e.timer<=0)e.state='chase';return;}
      if(e.state==='wind') {
        e.windup=clamp(1-e.timer/(e.type==='brute'?.7:.55),0,1);
        if(e.timer<=0){e.windup=0;e.state=e.type==='brute'?'rush':'recover';e.timer=e.type==='brute'?.4:.48;
          if(e.type==='wisp'){for(let i=-1;i<=1;i++)this.shoot(e,e.facing+i*.17,88,'bolt');this.emit('sfx',{name:'shoot'});}
          else if(e.type==='husk'&&d<27)this.hurtHero(2,e);
          else if(e.type==='brute'){e.rushX=Math.cos(e.facing);e.rushY=Math.sin(e.facing);}
        }return;
      }
      if(e.state==='rush'){this.moveBody(e,e.rushX*136*dt,e.rushY*136*dt,7);if(d<24)this.hurtHero(2,e);if(e.timer<=0){e.state='recover';e.timer=.95;}return;}
      e.facing=a;
      if(d>205||Math.hypot(e.x-e.homeX,e.y-e.homeY)>130) {const ra=Math.atan2(e.homeY-e.y,e.homeX-e.x);this.moveBody(e,Math.cos(ra)*35*dt,Math.sin(ra)*35*dt,6);return;}
      const speed=e.type==='husk'?34:e.type==='wisp'?27:26;
      if((e.type==='husk'&&d<24)||(e.type==='brute'&&d<82)||(e.type==='wisp'&&d<146&&this.lineClear(e,h))) {
        if(e.cooldown<=0){e.state='wind';e.timer=e.type==='brute'?.7:.55;e.cooldown=e.type==='wisp'?2.5:1.4;e.facing=a;return;}
      }
      const sign=e.type==='wisp'&&d<70?-1:1;
      if(d>19&&this.lineClear(e,h)){e.vx=Math.cos(a)*speed*sign;e.vy=Math.sin(a)*speed*sign;this.moveBody(e,e.vx*dt,e.vy*dt,6);}
      for(const other of this.enemies)if(other!==e&&!other.dead&&other.type!=='boss'){const q=distance(e,other);if(q>0&&q<14)this.moveBody(e,(e.x-other.x)/q*dt*15,(e.y-other.y)/q*dt*15,6);}
    }
    shoot(e,a,speed,type='bolt') {this.projectiles.push({x:e.x,y:e.y,z:6,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,type,life:4,age:0});}
    hurtHero(amount,source) {
      const h=this.hero;if(h.invuln>0||h.hp<=0||this.mode!=='playing')return false;
      if(this.difficulty==='gentle')amount=1;
      h.hp=Math.max(0,h.hp-amount);h.hurt=.4;h.invuln=.95;this.stats.damageTaken+=amount;
      if(source){const a=Math.atan2(h.y-source.y,h.x-source.x);this.moveBody(h,Math.cos(a)*10,Math.sin(a)*10,5);}
      this.effect('hurt',h.x,h.y,{life:.3});this.emit('sfx',{name:'hurt'});this.emit('impact',{strength:2.1});return true;
    }
    updateProjectiles(dt) {
      for(const p of this.projectiles) {
        p.age+=dt;p.life-=dt;
        if(p.type==='ring'){p.radius=p.age*108;if(Math.abs(distance(p,this.hero)-p.radius)<8)this.hurtHero(2,p);}
        else {p.x+=p.vx*dt;p.y+=p.vy*dt;if(!this.isWalkable(p.x,p.y,2,false))p.life=0;if(distance(p,this.hero)<11){this.hurtHero(2,p);p.life=0;}}
      }
      this.projectiles=this.projectiles.filter(p=>p.life>0);
    }
    restoreSeal(id) {
      const s=this.seals.find(s=>s.id===id);if(!s||s.state!=='ready')return false;
      s.state='restored';s.remaining=0;this.restored.add(id);this.hero.hp=this.hero.maxHp;this.hero.light=this.hero.maxLight;
      this.hero.level=1+(this.restored.size>=2?1:0)+(this.restored.size>=6?1:0);
      if(id==='moth')this.effect('magic',this.hero.x,this.hero.y,{life:1,radius:72});
      this.rebuildMap();this.emit('restored',{id,name:s.name,reward:s.reward,detail:s.detail,target:s.target});this.emit('sfx',{name:'restore'});this.emit('save');return true;
    }
    collectSeed(s) {
      s.found=true;const n=this.seeds.filter(s=>s.found).length;if(n===3){this.hero.maxHp=14;this.hero.hp=14;}
      this.effect('magic',s.x,s.y,{life:1,radius:45});this.emit('sfx',{name:'restore'});this.emit('toast',{title:n===3?'A stronger heart':'Memory seed · '+n+' / 3',text:n===3?'Three memories become one extra heart.':'Some things return only when you look for them.'});this.emit('save');
    }
    context() {
      const h=this.hero;
      if(distance(h,{x:352,y:205})<43)return {kind:'bell',label:this.defeatedBoss?'Ring the Hollow Bell':this.restored.size===8?'Wake the bell':'Read the inscription',x:352,y:205};
      if(distance(h,{x:466,y:912})<28&&this.restored.has('millwright'))return {kind:'mill',label:this.flags.millRunning?'Listen to the mill':'Turn the waterwheel',x:466,y:912};
      let near=null,d=30;for(const n of this.npcs)if(this.restored.has(n.requires)){const q=distance(h,n);if(q<d){near={kind:'npc',npc:n,label:'Speak to '+n.name,x:n.x,y:n.y};d=q;}}
      if(near)return near;
      for(const s of this.shrines)if(s.active&&distance(s,h)<28)return {kind:'shrine',shrine:s,label:'Rest at '+s.name,x:s.x,y:s.y};
      return null;
    }
    interact() {
      if(this.combat&&!this.defeatedBoss)return;
      const c=this.context();if(!c)return;
      if(c.kind==='npc'){this.talk(c.npc);return;}
      if(c.kind==='shrine'){this.hero.hp=this.hero.maxHp;this.hero.light=this.hero.maxLight;this.checkpoint=c.shrine.id;this.emit('sfx',{name:'heal'});this.emit('toast',{title:'The light holds',text:'Health restored. Progress saved. Open the map to travel.'});this.emit('save');return;}
      if(c.kind==='mill') {
        if(!this.flags.millRunning){this.flags.millRunning=true;this.rebuildMap();this.emit('dialog',{name:'The waterwheel',subtitle:'A current beneath the stone',lines:['The wheel catches. Far to the north, water fills the old aqueduct.','A bridge rises from the mist. The bell court is within reach.']});this.emit('gate',{target:[644,286]});this.emit('save');}
        else this.emit('toast',{title:'The mill is running',text:'Its current holds the aqueduct open.'});return;
      }
      if(c.kind==='bell') {
        if(this.completed){this.emit('toast',{title:'The Hollow Bell',text:'Its voice belongs to everyone now.'});return;}
        if(this.defeatedBoss){this.finishLevel();return;}
        if(this.restored.size===8){this.startBoss();return;}
        this.emit('dialog',{name:'An old inscription',subtitle:'Hollow Bell',lines:['Eight voices held in silence. Eight threads to lead them home.','When every echo returns, touch the bell.']});
      }
    }
    talk(n) {
      let lines=[];const done=this.completed;
      if(n.id==='mira')lines=done?['I put another cup on the table. I knew you would come back.','Listen. Even the quiet sounds different.']:['I remember the warmth before I remember my own name. Thank you.','Tern kept the bridge. If you find his echo, he can mend the way east.'];
      if(n.id==='tern') {
        if(!this.flags.bridgeBuilt){this.flags.bridgeBuilt=true;this.rebuildMap();this.emit('gate',{target:[592,615]});this.emit('save');lines=['My hands remember the work. Let me put them to use.','The east bridge is repaired. Cross into Mothwood. Something small is still shining there.'];}
        else lines=done?['A good bridge connects more than two banks.','Look around. This one brought a village home.']:['The bridge will hold. Follow the road east, then south into Mothwood.'];
      }
      if(n.id==='willow')lines=['I have been a seed, a sapling, and a shelter. I can be those things again.','My roots reach the ruins to the north. A memory sleeps below my lowest branch, here in the village.'];
      if(n.id==='orren')lines=this.flags.millRunning?['Hear that? The river remembers its work.','Use the map to return to the Rain Archive. Cross the aqueduct to the west.']:['The mill is whole, but the wheel needs a first turn.','Stand by its wheel, just east of me. The current will raise the old aqueduct.'];
      if(n.id==='ilex')lines=done?['I have written this day down. All of it.','There is a blank page for what we do next.']:['Dawnneedle has its true edge again. The last two echoes lie beyond the aqueduct.','The Warden borrows the bell’s shape. Dash through its rings, then strike while its light is dim.'];
      if(n.id==='rook')lines=['Three memories. One in the willow’s shade. One among southern reeds. One behind the Rain Archive.','I would fetch them, but I have very important clouds to inspect.'];
      if(n.id==='sella')lines=done?['We made the bell to call each other home. Somewhere, we forgot that.','You did not give us a new world. You gave us the chance to care for this one.']:['The bell is waiting at the north end of its court. Touch it when you are ready.','The Warden must pause after each attack. Use that moment. Your little light can clear its shots.'];
      this.emit('dialog',{name:n.name,subtitle:n.title,lines});
    }
    startBoss() {
      if(this.boss&&!this.boss.dead)return;
      this.hero.x=352;this.hero.y=320;this.hero.hp=this.hero.maxHp;this.hero.light=3;
      const hp=this.difficulty==='gentle'?155:190;
      this.boss={id:this.nextId++,type:'boss',name:'The Hollow Warden',x:352,y:184,z:0,facing:Math.PI/2,hp,maxHp:hp,hit:0,windup:0,state:'intro',timer:1.6,phase:1,pattern:0,dead:false,homeX:352,homeY:184,seal:null,cooldown:0};
      this.enemies.push(this.boss);this.combat=true;this.checkpoint='bell';this.shrines.find(s=>s.id==='bell').active=true;
      this.emit('bossStart');this.emit('dialog',{name:'The Hollow Warden',subtitle:'A silence with a shape',lines:['The bell rings once. Something inside it answers.','Dash through the widening ring. Move away from bright marks. Strike when the Warden’s light fades.']});
    }
    updateBoss(b,dt) {
      const h=this.hero;b.facing=Math.atan2(h.y-b.y,h.x-b.x);
      if(b.secondRing>0){b.secondRing-=dt;if(b.secondRing<=0)this.projectiles.push({type:'ring',x:b.x,y:b.y,z:0,age:0,life:2.4,radius:0});}
      const nextPhase=b.hp/b.maxHp<.3?3:b.hp/b.maxHp<.65?2:1;
      if(nextPhase>b.phase){b.phase=nextPhase;this.effect('magic',b.x,b.y,{life:1,radius:110,color:'#e8a6b4'});this.emit('toast',{title:nextPhase===2?'The second toll':'The final toll',text:nextPhase===2?'The Warden adds a volley. Keep moving.':'Two rings. Wait, dash, then strike.'});}
      if(b.state==='intro'||b.state==='recover') {b.windup=0;if(b.timer<=0){b.state='wind';b.timer=b.phase===3?.8:1.0;b.pattern=(b.pattern+1)%3;b.targetX=h.x;b.targetY=h.y;}return;}
      if(b.state==='wind') {
        b.windup=clamp(1-b.timer/(b.phase===3?.8:1),0,1);
        if(b.timer<=0){b.windup=0;b.state='attack';b.timer=b.pattern===2?.48:.18;
          if(b.pattern===0){this.projectiles.push({type:'ring',x:b.x,y:b.y,z:0,age:0,life:2.4,radius:0});b.secondRing=b.phase===3?.48:0;this.emit('sfx',{name:'bell'});}
          if(b.pattern===1){const a=Math.atan2(h.y-b.y,h.x-b.x);for(let i=-3;i<=3;i++)this.shoot(b,a+i*.22,95+b.phase*9,'ember');if(b.phase>1)for(let i=0;i<8;i++)this.shoot(b,i*TAU/8+this.time*.1,65,'bolt');this.emit('sfx',{name:'shoot'});}
          if(b.pattern===2){const a=Math.atan2(b.targetY-b.y,b.targetX-b.x);b.rushX=Math.cos(a);b.rushY=Math.sin(a);this.effect('slam',b.targetX,b.targetY,{life:.48,radius:37});}
        }return;
      }
      if(b.state==='attack') {
        if(b.pattern===2){this.moveBody(b,b.rushX*160*dt,b.rushY*160*dt,15);b.x=clamp(b.x,201,523);b.y=clamp(b.y,150,330);if(distance(b,h)<34)this.hurtHero(2,b);}
        if(b.timer<=0){b.state='recover';b.timer=b.phase===3?1.35:1.75;this.effect('stun',b.x,b.y,{life:b.timer});}
      }
    }
    finishLevel() {
      if(!this.defeatedBoss||this.completed)return false;
      this.completed=true;this.mode='ending';this.endingTime=0;this.hero.hp=this.hero.maxHp;this.hero.pose='cheer';this.projectiles=[];this.enemies=[];this.rebuildMap();this.emit('complete');this.emit('save');return true;
    }
    exploreEnding() {this.mode='playing';this.hero.x=330;this.hero.y=884;this.hero.pose=null;this.area='village';this.checkpoint='hearth';this.emit('save');}
    resetEncounter() {
      for(const s of this.seals)if(s.state==='active'){s.state='sealed';s.remaining=s.total;s.spawned=0;s.spawnClock=0;}
      this.enemies=[];this.projectiles=[];this.pickups=[];if(!this.defeatedBoss)this.boss=null;this.combat=false;
    }
    die() {this.stats.deaths++;this.resetEncounter();const s=this.shrines.find(s=>s.id===this.checkpoint)||this.shrines[0];Object.assign(this.hero,{x:s.x,y:s.y+22,hp:this.hero.maxHp,light:3,hurt:0,invuln:1.5,attack:null,dashTime:0,vx:0,vy:0});this.mode='defeated';this.emit('defeated');this.emit('save');}
    resume() {this.mode='playing';this.hero.pose=null;}
    travel(id) {
      if(this.combat)return false;const s=this.shrines.find(s=>s.id===id&&s.active);if(!s)return false;
      Object.assign(this.hero,{x:s.x,y:s.y+22,vx:0,vy:0,attack:null,dashTime:0,hp:this.hero.maxHp,light:3,invuln:1});this.checkpoint=id;if(id!=='hearth')this.lastField=id;this.area=this.getArea(this.hero.x,this.hero.y);this.effect('magic',this.hero.x,this.hero.y,{life:1,radius:52});this.emit('travel');this.emit('save');return true;
    }
    objective() {
      if(this.completed)return {title:'A world worth returning to',text:'Walk the village. Speak with the people you brought home.',x:330,y:858};
      if(this.defeatedBoss)return {title:'Let the hollow hear its name',text:'Return to the bell and ring it.',x:352,y:205};
      if(this.boss&&!this.boss.dead)return {title:'Face the Hollow Warden',text:'Avoid the bright marks. Strike during recovery.',x:this.boss.x,y:this.boss.y};
      if(this.restored.has('carpenter')&&!this.flags.bridgeBuilt)return {title:'A bridge needs its builder',text:'Return to Tern in the village. Use the map to travel.',x:432,y:796};
      if(this.restored.has('millwright')&&!this.flags.millRunning)return {title:'Give the river its first turn',text:'Return to the village mill. Turn the waterwheel.',x:466,y:912};
      const s=this.seals.find(s=>s.state!=='restored');
      if(s)return {title:s.state==='ready'?'An echo is ready':s.label,text:s.state==='ready'?'Step onto the empty seal.':s.state==='active'?'Clear the seal · '+s.remaining+' shadows remain.':'Follow the lanterns to the next sealed echo.',x:s.x,y:s.y};
      return {title:'The bell is waiting',text:'Touch the Hollow Bell in the north court.',x:352,y:205};
    }
    snapshot() {
      return {version:1,seed:this.seed,difficulty:this.difficulty,restored:[...this.restored],ready:this.seals.filter(s=>s.state==='ready').map(s=>s.id),flags:{...this.flags},seeds:this.seeds.filter(s=>s.found).map(s=>s.id),shrines:this.shrines.filter(s=>s.active).map(s=>s.id),checkpoint:this.checkpoint,lastField:this.lastField,defeatedBoss:this.defeatedBoss,completed:this.completed,playTime:this.playTime,stats:{...this.stats},hero:{x:this.hero.x,y:this.hero.y,hp:this.hero.hp,light:this.hero.light}};
    }
    load(data) {
      if(!data||data.version!==1||!Array.isArray(data.restored))return false;
      this.restored=new Set(data.restored.filter(id=>SEAL_DEFS.some(s=>s.id===id)));
      // Recover invalid or old saves without allowing sequence-breaking flags.
      this.flags={bridgeBuilt:!!data.flags?.bridgeBuilt&&this.restored.has('carpenter'),millRunning:!!data.flags?.millRunning&&this.restored.has('millwright')};
      for(const s of this.seals){s.state=this.restored.has(s.id)?'restored':data.ready?.includes(s.id)?'ready':'sealed';s.remaining=s.state==='restored'||s.state==='ready'?0:s.total;s.spawned=0;}
      this.defeatedBoss=!!data.defeatedBoss&&this.restored.size===8;this.completed=!!data.completed&&this.defeatedBoss;
      for(const s of this.seeds)s.found=!!data.seeds?.includes(s.id);for(const s of this.shrines)s.active=s.id==='hearth'||!!data.shrines?.includes(s.id);
      this.checkpoint=this.shrines.some(s=>s.active&&s.id===data.checkpoint)?data.checkpoint:'hearth';this.lastField=data.lastField||'garden';
      this.difficulty=data.difficulty==='gentle'?'gentle':'standard';this.playTime=Math.max(0,Number(data.playTime)||0);this.stats={...this.stats,...data.stats};
      this.hero.maxHp=this.seeds.every(s=>s.found)?14:12;this.hero.level=1+(this.restored.size>=2?1:0)+(this.restored.size>=6?1:0);
      this.rebuildMap();const s=this.shrines.find(s=>s.id===this.checkpoint);let x=Number(data.hero?.x),y=Number(data.hero?.y);
      if(!Number.isFinite(x)||!Number.isFinite(y)||!this.isWalkable(x,y,6)){x=s.x;y=s.y+22;}
      const savedLight=Number(data.hero?.light);
      Object.assign(this.hero,{x,y,hp:clamp(Number(data.hero?.hp)||this.hero.maxHp,1,this.hero.maxHp),light:clamp(Number.isFinite(savedLight)?savedLight:3,0,3),attack:null,dashTime:0,invuln:1});
      this.enemies=[];this.projectiles=[];this.boss=null;this.mode='playing';this.area=this.getArea(x,y);return true;
    }
  }
  return {World,TILE,SEAL_DEFS,makeMap,distance,angleDiff};
});
