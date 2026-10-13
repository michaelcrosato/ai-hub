/* HUSHLINE — original mission rules. Physics integration uses my-3D2dge.Body. */
export const LEVEL = {
  width: 8260, height: 860,
  ceiling: [[0,145],[650,155],[1020,210],[1360,150],[1850,160],[2180,180],[2480,115],[2860,135],[3260,185],[3630,170],[4100,150],[4520,210],[4780,190],[5020,230],[5400,220],[5800,180],[6200,135],[6610,170],[7130,125],[7580,150],[8260,130]],
  floor: [[0,690],[680,690],[1040,665],[1450,690],[1860,710],[2220,700],[2640,720],[2950,695],[3310,670],[3640,690],[4100,720],[4530,680],[4780,680],[5140,655],[5490,660],[5810,700],[6200,710],[6600,680],[7050,710],[7540,700],[8260,700]],
  sections: [
    {x:0,name:'Arrival',code:'01',title:'A small ship. A very large silence.'},
    {x:1040,name:'The Ears',code:'02',title:'The walls are listening.'},
    {x:2310,name:'Induction Lock',code:'03',title:'Give an old machine a new pulse.'},
    {x:3660,name:'The Coil',code:'04',title:'Quiet is not the same as invisible.'},
    {x:4800,name:'Blind Drift',code:'05',title:'Sometimes the best setting is off.'},
    {x:5840,name:'The Listening Vault',code:'06',title:'Some signals deserve to survive.'},
    {x:6610,name:'Homeward',code:'07',title:'Bring the silence home.'}
  ],
  watchers: [
    {id:'ear',name:'Acoustic keeper',x:1600,y:365,r:400,limits:{heat:100,noise:24,electricity:100},kind:'sound',tip:'Use the quiet drive. Do not vent inside the field.'},
    {id:'coil',name:'Induction keeper',x:4090,y:390,r:402,limits:{heat:100,noise:100,electricity:18},kind:'electricity',tip:'Use the thermal drive. Switch the lamp off. Scan from outside the field.'},
    {id:'blind',name:'Tri-band keeper',x:5390,y:414,r:395,limits:{heat:32,noise:18,electricity:16},kind:'all',tip:'Cool below 32. Lamp off. Set thrust to at least 70%. Build speed, then select OFF and coast.'},
    {id:'exit',name:'Wake keeper',x:7220,y:370,r:325,limits:{heat:48,noise:28,electricity:76},kind:'sound',tip:'The quiet drive is safe. Watch the falling debris.',dormant:true}
  ],
  gates: [
    {id:'lock',x:2200,w:54,label:'FREIGHT LOCK'},
    {id:'cell',x:3560,w:64,label:'INDUCTION LOCK'},
    {id:'valve',x:4640,w:56,label:'PRESSURE SEAL'},
    {id:'vault',x:6520,w:64,label:'EXIT SEAL'}
  ],
  echoes:[
    {id:'echo1',x:800,y:290,title:'The last shift',text:'“Leave the lamps on. The next shift will need them.” No next shift arrived.'},
    {id:'echo2',x:2940,y:270,title:'A small kindness',text:'A maintenance log records 412 repairs. The final entry reads: “Kept the garden warm.”'},
    {id:'echo3',x:5900,y:270,title:'What we keep',text:'The archive holds names, songs, and messages. No patents. No mineral claims. Just people.'}
  ],
  cell:{x:2570,y:574,r:24}, socket:{x:3270,y:440},
  terminals:[{id:'lock',x:2085,y:500},{id:'valve',x:4510,y:475},{id:'archive',x:6210,y:488},{id:'extraction',x:7990,y:592}],
  checkpoints:[{x:300,y:534,name:'Arrival dock'},{x:2330,y:520,name:'Freight lock'},{x:3670,y:525,name:'Induction lock'},{x:4800,y:485,name:'Drift shelter'},{x:6660,y:535,name:'Vault exit'}]
};
export function lineY(points,x){for(let i=1;i<points.length;i++){if(x<=points[i][0]){const a=points[i-1],b=points[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}}return points.at(-1)[1];}
const copy=x=>JSON.parse(JSON.stringify(x));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class Mission {
  constructor(E,onEvent=()=>{}){
    this.E=E;this.emit=onEvent;this.assist=false;this.power=70;this.status='title';this.reset();
  }
  reset(){
    const E=this.E;
    this.ship=new E.Body({x:300,y:534,r:29,gravity:0,bounce:.22,friction:0});
    this.cell=new E.Body({...LEVEL.cell,gravity:0,bounce:.12,friction:1.1});
    this.mode='quiet';this.power=70;this.heat=19;this.noise=5;this.electricity=28;this.hull=100;this.lamp=true;
    this.time=0;this.alerts=0;this.repairs=0;this.distance=0;this.scans=0;this.scanning=false;this.venting=false;this.thrust=0;this.precision=false;this.towing=false;
    this.open={lock:false,cell:false,valve:false,vault:false};this.archive=false;this.echoes=[];this.echoProgress={};
    this.watchers=LEVEL.watchers.map(w=>({...copy(w),scanned:false,progress:0,exposure:0,laser:0,alerted:false}));
    this.cp=0;this.checkpoint=null;this.interactProgress=0;this.interactId='';this.interactLatch=false;this.invulnerable=0;this.shutdown=0;
    this.section=0;this.announcedSections=new Set([0]);this.banner=0;this.prompt='';this.target=null;this.collapse=95;this.rocks=[];this.rockClock=0;this.deathCause='';this.endTimer=0;this.lastNotice='';this.rng=E.rng(7001);
    this.collision={collide:b=>this.collide(b)};
  }
  start(saved){this.reset();this.status='playing';if(saved)this.load(saved);else{this.saveCheckpoint(0,false);this.emit('message',{speaker:'Dispatch',text:'Find the archive. Bring it home. Your return fuel is already on the invoice.'});}this.emit('start',{});}
  setMode(mode){if(!['quiet','thermal','off'].includes(mode))return;if(this.shutdown>0&&mode!=='off')return;if(this.mode!==mode){this.mode=mode;this.emit('mode',{mode});}}
  serialize(){return {version:1,cp:this.cp,open:copy(this.open),archive:this.archive,echoes:[...this.echoes],scanned:this.watchers.filter(w=>w.scanned).map(w=>w.id),time:this.time,alerts:this.alerts,repairs:this.repairs,power:this.power,assist:this.assist};}
  load(s){
    if(!s||s.version!==1||!Number.isInteger(s.cp)||s.cp<0||s.cp>=LEVEL.checkpoints.length)return;
    this.cp=s.cp;this.open={...this.open,...s.open};this.archive=!!s.archive;this.echoes=(s.echoes||[]).filter(x=>LEVEL.echoes.some(e=>e.id===x));
    for(const w of this.watchers)w.scanned=(s.scanned||[]).includes(w.id);
    this.time=Math.max(0,Number(s.time)||0);this.alerts=Math.max(0,Number(s.alerts)||0);this.repairs=Math.max(0,Number(s.repairs)||0);this.power=this.E.clamp(Number(s.power)||70,35,100);
    this.assist=!!s.assist;this.checkpoint=this.serialize();this.restorePosition();
  }
  restorePosition(){const p=LEVEL.checkpoints[this.cp];Object.assign(this.ship,{x:p.x,y:p.y,vx:0,vy:0});this.hull=100;this.heat=18;this.noise=0;this.electricity=0;this.mode='quiet';this.lamp=true;this.invulnerable=1.8;this.shutdown=0;this.towing=false;this.collapse=95;this.rocks=[];this.status='playing';this.deathCause='';this.scanning=false;this.venting=false;this.interactProgress=0;this.interactId='';this.interactLatch=false;this.section=Math.max(0,LEVEL.sections.findLastIndex(s=>this.ship.x>=s.x));for(const w of this.watchers){w.exposure=0;w.laser=0;}if(this.open.cell)Object.assign(this.cell,{x:LEVEL.socket.x,y:LEVEL.socket.y,vx:0,vy:0});else Object.assign(this.cell,{...LEVEL.cell,vx:0,vy:0});}
  retry(){const t=this.time,a=this.alerts,r=this.repairs+1,echoes=[...this.echoes],scanned=this.watchers.filter(w=>w.scanned).map(w=>w.id);if(this.checkpoint)this.load(this.checkpoint);else this.restorePosition();this.echoes=[...new Set([...this.echoes,...echoes])];for(const w of this.watchers)if(scanned.includes(w.id))w.scanned=true;this.time=t;this.alerts=a;this.repairs=r;this.emit('retry',{});this.emit('message',{speaker:'Ship',text:'Checkpoint restored. Hull repaired. Recovered signals and scan data are safe.'});this.emit('save',this.serialize());}
  saveCheckpoint(i,notify=true){
    this.cp=i;this.hull=100;this.checkpoint=this.serialize();this.emit('save',this.checkpoint);
    if(notify){this.emit('checkpoint',{name:LEVEL.checkpoints[i].name});this.emit('message',{speaker:'Ship',text:'Checkpoint saved. Hull repaired.'});}
  }
  collide(b){
    let hit=false;const pad=b.r;
    const top=lineY(LEVEL.ceiling,b.x)+pad,bottom=lineY(LEVEL.floor,b.x)-pad;
    if(b.y<top){b.y=top;hit=true;}if(b.y>bottom){b.y=bottom;hit=true;}
    if(b.x<pad+30){b.x=pad+30;hit=true;}if(b.x>LEVEL.width-pad){b.x=LEVEL.width-pad;hit=true;}
    for(const gate of LEVEL.gates){if(this.open[gate.id])continue;const left=gate.x-gate.w/2,right=gate.x+gate.w/2;if(b.x+pad>left&&b.x-pad<right){b.x=b.x<gate.x?left-pad:right+pad;hit=true;}}
    return hit;
  }
  hurt(amount,cause){
    if(this.invulnerable>0||this.status!=='playing')return;
    this.hull=Math.max(0,this.hull-amount*(this.assist?.6:1));this.invulnerable=.8;this.emit('damage',{amount,cause,x:this.ship.x,y:this.ship.y});
    if(this.hull<=0){this.status='dead';this.deathCause=cause;this.emit('dead',{cause});}
  }
  currentObjective(){
    if(!this.open.lock)return this.watchers[0].scanned?'Cross the field. Open the freight lock.':'Scan the keeper from outside its field.';
    if(!this.open.cell)return this.towing?'Tow the power cell into the amber socket.':'Connect the power cell to the socket.';
    if(!this.open.valve)return 'Cross the induction field. Power the pressure seal.';
    if(!this.archive)return this.ship.x<5810?(this.power<70?'Set thrust to 70% or more before the drift.':'Cool the ship. Cut power. Coast through the field.'):'Power off at the archive. Hold E to retrieve it.';
    return 'Reach the extraction cradle. Power off and hold E.';
  }
  update(dt,input={}){
    if(this.status==='extracting'){this.endTimer+=dt;this.ship.vx=this.E.approach(this.ship.vx,130,dt*60);this.ship.x+=this.ship.vx*dt;this.ship.y-=dt*(30+this.endTimer*28);if(this.endTimer>3.8){this.status='complete';this.emit('complete',this.results());}return;}
    if(this.status!=='playing')return;
    const E=this.E,s=this.ship;this.time+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.shutdown=Math.max(0,this.shutdown-dt);
    const mx=E.clamp(input.x||0,-1,1),my=E.clamp(input.y||0,-1,1),norm=Math.max(1,Math.hypot(mx,my));
    this.precision=!!input.precision;this.scanning=!!input.scan;this.venting=!!input.vent;this.thrust=this.mode==='off'?0:Math.min(1,Math.hypot(mx,my))*this.power/100*(this.precision?.33:1);
    const on=this.mode!=='off',quiet=this.mode==='quiet';
    const targetHeat=this.venting?7:this.mode==='thermal'?38+61*this.thrust:this.mode==='quiet'?19+12*this.thrust:6;
    this.heat=E.approach(this.heat,targetHeat,dt*(this.venting?24:this.mode==='thermal'?8.5:4.5));
    const targetNoise=(this.mode==='thermal'?29+38*this.thrust:this.mode==='quiet'?5+15*this.thrust:0)+(this.venting?42:0)+(this.towing?7:0)+(this.scanning?2:0);
    const targetEM=(this.mode==='thermal'?5+8*this.thrust:this.mode==='quiet'?26+39*this.thrust:0)+(this.lamp?12:0)+(this.scanning?24:0)+(this.towing?11:0);
    this.noise=E.lerp(this.noise,targetNoise,1-Math.exp(-dt*12));this.electricity=E.lerp(this.electricity,targetEM,1-Math.exp(-dt*12));
    if(this.heat>95&&this.mode==='thermal'){this.setMode('off');this.shutdown=3;this.hurt(15,'Thermal drive overheated. Vent before you restart.');this.emit('message',{speaker:'Ship',text:'Thermal limit exceeded. Drive cooling for 3 seconds.'});}
    const accel=on?(quiet?370:650)*this.power/100*(this.precision?.35:1)*(this.towing?.74:1):0;
    s.vx+=(mx/norm)*accel*dt;s.vy+=(my/norm)*accel*dt;
    let drag=on?(this.precision?4.6:2):.10;
    if(this.assist&&on&&!mx&&!my)drag=3.8;
    if(!on)s.vy+=3.6*dt;
    if(this.venting)drag+=.4;
    s.vx*=Math.exp(-drag*dt);s.vy*=Math.exp(-drag*dt);
    const maxSpeed=quiet?190:290;const speed=Math.hypot(s.vx,s.vy);if(on&&speed>maxSpeed){s.vx*=maxSpeed/speed;s.vy*=maxSpeed/speed;}
    const before=Math.hypot(s.vx,s.vy),ox=s.x;s.update(dt,this.collision);this.distance+=Math.abs(s.x-ox);
    if(s.hitWall&&before>80)this.hurt(Math.min(24,(before-65)*.15),'Hull impact. Use SHIFT for precise movement.');
    if(this.towing){const dx=s.x-82-this.cell.x,dy=s.y+43-this.cell.y;this.cell.vx+=dx*7*dt;this.cell.vy+=dy*7*dt;this.cell.vx*=Math.exp(-dt*3);this.cell.vy*=Math.exp(-dt*3);this.cell.update(dt,this.collision);if(hypot(s,this.cell)>220){this.towing=false;this.emit('message',{speaker:'Ship',text:'Tow link lost. Move near the power cell to reconnect.'});}}
    else if(!this.open.cell){this.cell.vy+=30*dt;this.cell.update(dt,this.collision);}
    if(!this.open.cell&&hypot(this.cell,LEVEL.socket)<68){this.open.cell=true;this.towing=false;Object.assign(this.cell,{x:LEVEL.socket.x,y:LEVEL.socket.y,vx:0,vy:0});this.emit('gate',{id:'cell'});this.emit('message',{speaker:'Dispatch',text:'The old grid is awake. That is either very good or very bad.'});}
    this.updateScans(dt);this.updateWatchers(dt);this.updateInteractions(dt,input);
    const section=Math.max(0,LEVEL.sections.findLastIndex(a=>s.x>=a.x));if(section!==this.section){this.section=section;if(!this.announcedSections.has(section)){this.announcedSections.add(section);this.emit('section',LEVEL.sections[section]);}}
    if(this.cp<1&&s.x>2300&&this.open.lock)this.saveCheckpoint(1);
    if(this.cp<2&&s.x>3660&&this.open.cell)this.saveCheckpoint(2);
    if(this.cp<3&&s.x>4770&&this.open.valve)this.saveCheckpoint(3);
    if(this.cp<4&&s.x>6650&&this.archive)this.saveCheckpoint(4);
    if(this.archive){this.collapse-=dt;this.updateCollapse(dt);if(this.collapse<=0){this.invulnerable=0;this.hurt(1000,'The exit collapsed. Move toward extraction after you retrieve the archive.');}}
  }
  updateScans(dt){
    this.target=null;let nearest=670;
    for(const w of this.watchers){if(w.dormant&&!this.archive)continue;const d=hypot(this.ship,w);if(d<nearest){nearest=d;this.target=w;}if(this.scanning&&d<660&&!w.scanned){w.progress=Math.min(1,w.progress+dt/.85);if(w.progress>=1){w.scanned=true;this.scans++;this.emit('scan',{id:w.id,name:w.name,tip:w.tip});}}}
    for(const e of LEVEL.echoes){if(this.echoes.includes(e.id))continue;if(this.scanning&&hypot(this.ship,e)<190){this.echoProgress[e.id]=(this.echoProgress[e.id]||0)+dt/1.1;if(this.echoProgress[e.id]>=1){this.echoes.push(e.id);this.emit('echo',e);this.emit('save',this.serialize());}}}
  }
  updateWatchers(dt){
    for(const w of this.watchers){w.laser=Math.max(0,w.laser-dt);if(w.dormant&&!this.archive)continue;
      const inside=hypot(this.ship,w)<w.r;let cause='',excess=0;
      for(const key of ['heat','noise','electricity']){const ratio=this[key]/w.limits[key];if(ratio>1.035&&ratio>excess){cause=key;excess=ratio;}}
      if(inside&&cause){w.exposure=Math.min(1,w.exposure+dt*(this.assist?.35:.64));w.cause=cause;}else{w.exposure=Math.max(0,w.exposure-dt*1.1);if(w.exposure===0)w.alerted=false;}
      if(w.exposure>=1&&w.laser<=0){if(!w.alerted){this.alerts++;w.alerted=true;}w.laser=1.7;this.hurt(36,`${w.name}: ${cause||w.cause} exceeded the safe limit.`);this.emit('laser',{x:w.x,y:w.y});}
    }
  }
  updateInteractions(dt,input){
    const s=this.ship,held=!!input.interact;let target=null,reason='';this.prompt='';
    const terminal=LEVEL.terminals.find(t=>hypot(s,t)<130&&(t.id==='archive'?!this.archive:t.id==='extraction'?this.archive:!this.open[t.id]));
    if(terminal){target=terminal.id;if(target==='lock'&&!this.watchers[0].scanned)reason='Hold SPACE to scan the acoustic keeper first.';else if(target==='valve'&&this.mode!=='thermal')reason='Select THERMAL to power the hydraulic pump.';else if((target==='archive'||target==='extraction')&&this.mode!=='off')reason='Select OFF to connect safely.';else if(Math.hypot(s.vx,s.vy)>55)reason='Slow down. Hold SHIFT before you connect.';
      this.prompt=reason||({lock:'Hold E · Open freight lock',valve:'Hold E · Power the pressure seal',archive:'Hold E · Retrieve the archive',extraction:'Hold E · Dock for extraction'}[target]);
    }else if(!this.open.cell&&hypot(s,this.cell)<155){target='tow';this.prompt=this.towing?'Press E · Release power cell':'Press E · Connect tow link';}
    if(target==='tow'){if(held&&!this.interactLatch){this.towing=!this.towing;this.emit('tow',{on:this.towing});}this.interactProgress=0;}
    else if(target&&held&&!reason){if(this.interactId!==target)this.interactProgress=0;this.interactId=target;this.interactProgress=Math.min(1,this.interactProgress+dt/(target==='archive'?2.5:target==='valve'?2.3:1.3));
      if(this.interactProgress>=1){this.interactProgress=0;if(target==='archive'){this.archive=true;this.open.vault=true;this.collapse=95;this.emit('archive',{});this.emit('message',{speaker:'Dispatch',text:'Archive secure. The vault is losing pressure. Extraction is to the east. Go.'});}
        else if(target==='extraction'){this.status='extracting';this.endTimer=0;this.emit('extracting',{});}
        else{this.open[target]=true;this.emit('gate',{id:target});this.emit('message',{speaker:'Ship',text:target==='valve'?'Seal open. Cool the hull in the shelter ahead.':'Freight lock open. The power cell is in the next chamber.'});}}
    }else this.interactProgress=Math.max(0,this.interactProgress-dt*2);
    this.interactLatch=held;
  }
  updateCollapse(dt){
    if(this.ship.x<6650)return;this.rockClock+=dt;
    if(this.rockClock>2.2){this.rockClock=0;const x=this.ship.x+200+this.rng()*220;if(x<7740)this.rocks.push({x,y:lineY(LEVEL.ceiling,x)-20,vy:15,r:18+this.rng()*11,life:0,rotation:this.rng()*6});}
    for(const rock of this.rocks){rock.life+=dt;if(rock.life<.7)continue;rock.vy+=90*dt;rock.y+=rock.vy*dt;if(hypot(rock,this.ship)<rock.r+25){this.hurt(24,'Falling debris struck the hull. Watch the amber warning marks.');rock.y=1000;}if(rock.y>lineY(LEVEL.floor,rock.x))rock.dead=true;}
    this.rocks=this.rocks.filter(r=>!r.dead);
  }
  results(){return {time:this.time,alerts:this.alerts,repairs:this.repairs,echoes:this.echoes.length,hull:Math.ceil(this.hull),rank:this.alerts===0&&this.repairs===0?'Quiet professional':this.repairs<3?'Safe hands':'Contract fulfilled'};}
  state(){return {status:this.status,mode:this.mode,power:this.power,heat:this.heat,noise:this.noise,electricity:this.electricity,hull:this.hull,lamp:this.lamp,scanning:this.scanning,venting:this.venting,speed:Math.hypot(this.ship.vx,this.ship.vy),towing:this.towing,archive:this.archive,echoes:this.echoes.length,section:this.section,sectionName:LEVEL.sections[this.section].name,objective:this.currentObjective(),prompt:this.prompt,actionProgress:this.interactProgress,target:this.target?{name:this.target.name,scanned:this.target.scanned,progress:this.target.progress,limits:this.target.limits,tip:this.target.tip,inside:hypot(this.ship,this.target)<this.target.r}:null,exposure:Math.max(...this.watchers.map(w=>w.exposure)),cause:this.watchers.find(w=>w.exposure>.1)?.cause||'',time:this.time,collapse:this.collapse,checkpoint:LEVEL.checkpoints[this.cp].name,cp:this.cp,progress:this.ship.x/LEVEL.width,shutdown:this.shutdown,deathCause:this.deathCause,results:this.results(),x:this.ship.x,y:this.ship.y,assist:this.assist};}
}
