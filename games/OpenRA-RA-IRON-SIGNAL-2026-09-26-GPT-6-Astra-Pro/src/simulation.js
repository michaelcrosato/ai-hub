import { TYPES, CATALOG, MISSIONS, DIFFICULTIES, POPULATION, domain, STEP } from './catalog.js';
import { Battlefield, Random, clamp, distance } from './map.js';
const lanes=['construction','infantry','vehicles','air','naval','research'];
const laneOf = d => ['structures','defense'].includes(d.category)?'construction':d.category;
const enemyOf = o => o===0?1:0;
const maxHealth = e => TYPES[e.type].hp;
const emptyQueues = () => Object.fromEntries(lanes.map(l=>[l,[]]));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const ORDER_TYPES=new Set(['guard','harvest','move','attackMove','attack','capture','repair','demolish']);
const TARGETED=['attack','capture','repair','demolish'];
const MAX_WAYPOINTS=128;
const LAST_MISSION=MISSIONS.length-1;
/** Neutral structures never anchor construction. */
const NON_ANCHORS=['oil','relay','lab','tower'];

/** Deterministic, renderer-independent RTS simulation. Serializable state never
 * contains DOM nodes, Three objects, Rapier handles, or callbacks. */
export class Simulation {
  constructor({mission=0,difficulty='normal',faction='allies',mode='campaign',seed=9183}={}) {
    this.missionIndex=clamp(mission|0,0,LAST_MISSION);this.mission=MISSIONS[this.missionIndex];
    this.difficulty=DIFFICULTIES[difficulty]?difficulty:'normal';
    this.faction=faction==='soviet'?'soviet':'allies';this.mode=mode==='skirmish'?'skirmish':'campaign';
    this.seed=seed;this.random=new Random(seed+mission*77);this.map=new Battlefield(this.missionIndex);
    this.entities=[];this.projectiles=[];this.resources=[];this.crates=[];this.events=[];
    this.index=null;this.indexOf=null;this.indexLength=-1;
    this.nextId=1;this.queueId=1;this.time=0;this.status='active';this.reason='';this.paused=false;
    this.credits=[DIFFICULTIES[this.difficulty].credits+this.missionIndex*700,3500+this.missionIndex*1200];
    this.queues=[emptyQueues(),emptyQueues()];this.upgrades=[{},{}];this.flags={};
    this.stats={kills:0,losses:0,built:0,income:0,captures:0};
    this.visibility=[new Uint8Array(this.map.cells.length),new Uint8Array(this.map.cells.length)];
    this.explored=[new Uint8Array(this.map.cells.length),new Uint8Array(this.map.cells.length)];
    this.power=[{used:0,total:0},{used:0,total:0}];
    this.scans=[];this.scanReady=0;this.strikeCharge=0;this.deadline=this.mission.deadline||0;
    /** Operation 04: seconds the broadcast tower must stand (campaign only). */
    this.hold=this.mode==='campaign'?this.mission.hold||0:0;
    this.nextBrain=12;this.nextWave=this.mission.wave*DIFFICULTIES[this.difficulty].interval;
    this.wave=0;this.fogClock=0;this.incomeClock=0;this.lastWarning=-100;this.saveClock=0;
    this.setup();
  }
  emit(type,data={}) {this.events.push({type,time:this.time,...data});if(this.events.length>250)this.events.shift();}
  /** A finished unit that cannot leave its factory used to wait silently at 100%. Tell the player, at most every 15 s. */
  waitNotice(owner,text) {if(owner===0&&this.time-(this.lastWaitNotice??-100)>15){this.lastWaitNotice=this.time;this.emit('notice',{text});}}
  drainEvents() {const e=this.events;this.events=[];return e;}
  /** Entity lookup by id through an index rebuilt whenever the entity list changes. */
  get(id) {
    if(!id)return undefined;
    if(this.indexOf!==this.entities||this.indexLength!==this.entities.length){
      this.index=new Map();for(const e of this.entities)this.index.set(e.id,e);
      this.indexOf=this.entities;this.indexLength=this.entities.length;
    }
    const e=this.index.get(id);return e&&e.hp>0?e:undefined;
  }
  owned(owner=0,type) {return this.entities.filter(e=>e.owner===owner&&e.hp>0&&(!type||e.type===type));}
  has(type,owner=0) {
    for(const e of this.entities){
      if(e.owner!==owner||e.hp<=0)continue;
      if(type==='power'?e.type==='power'||e.type==='advancedPower':e.type===type)return true;
    }
    return false;
  }
  side(owner) {return owner===0?this.faction:(this.faction==='allies'?'soviet':'allies');}
  pop(owner=0) {let n=0;for(const e of this.entities)if(e.owner===owner&&e.hp>0&&TYPES[e.type].kind==='unit')n++;return n;}
  lowPower(owner=0) {return this.power[owner].used>this.power[owner].total;}
  spawn(type,owner,x,z,extras={}) {
    const d=TYPES[type];if(!d)throw new Error(`Unknown entity: ${type}`);
    const e={id:this.nextId++,type,owner,x,z,px:x,pz:z,hp:d.hp,angle:0,prevAngle:0,turret:0,
      command:{type:d.role==='harvest'?'harvest':'guard'},path:[],pathVersion:-1,goal:null,
      target:0,shotClock:0,brainClock:this.random.range(0,0.2),cargo:0,veterancy:0,xp:0,
      born:this.time,seen:owner===0,rot:0,rally:null,...extras};
    this.entities.push(e);
    if(d.kind==='building'){this.map.rebuild(this.entities);this.updatePower();}
    this.emit('spawn',{id:e.id,typeName:type,owner});return e;
  }
  setup() {
    const [bx,bz]=this.mission.base,[ex,ez]=this.mission.enemy;
    this.spawn('mcv',0,bx,bz);
    for(let i=0;i<5;i++)this.spawn('rifle',0,bx+7+(i%3)*1.5,bz-5-Math.floor(i/3)*2);
    this.spawn('rocket',0,bx+9,bz-9);this.spawn('engineer',0,bx-5,bz-5);
    this.spawn('ranger',0,bx+11,bz-2);
    if(this.missionIndex>0)for(let i=0;i<2;i++)this.spawn(this.faction==='allies'?'medium':'heavy',0,bx+6+i*3,bz+7);
    this.spawn('conyard',1,ex,ez,{tag:'enemyHQ',strategic:true});
    this.spawn('power',1,ex-10,ez-5);this.spawn('barracks',1,ex-9,ez+8);
    this.spawn('factory',1,ex+1,ez+12);this.spawn('refinery',1,ex-9,ez+21);
    this.spawn('harvester',1,ex-7,ez+28);
    this.spawn('pillbox',1,ex-17,ez+10);this.spawn('pillbox',1,ex-4,ez+23);
    for(let i=0;i<4;i++)this.spawn('rifle',1,ex-13+i*2,ez+15);
    this.spawn(this.side(1)==='soviet'?'heavy':'medium',1,ex-15,ez+20);
    const ore=[[15,48,7000],[30,75,7000],[36,53,4500],[ex+3,ez+30,7500],[ex-17,ez-5,5000]];
    for(const [x,z,amount] of ore)if(this.map.cellAt(x,z)!==1)this.resources.push({id:this.nextId++,x,z,ore:amount,max:amount,kind:'ore'});
    this.resources.push({id:this.nextId++,x:33,z:13,ore:4200,max:4200,kind:'gems'});
    this.crates=[{id:this.nextId++,x:35,z:65,kind:'credits',taken:false},{id:this.nextId++,x:64,z:68,kind:'heal',taken:false}];
    this.spawn('oil',2,23,19,{tag:'oil'});
    if(this.missionIndex===0) {
      this.spawn('relay',2,37,23,{tag:'relay',strategic:true});
      this.spawn('rifle',1,38,29);this.spawn('rifle',1,41,26);
    } else if(this.missionIndex===1) {
      this.spawn('radar',1,62,8,{tag:'harborRadar',strategic:true});
      this.spawn('power',1,56,5);this.spawn('shipyard',1,73,22,{tag:'harborYard',strategic:true});
      this.spawn(this.side(1)==='soviet'?'submarine':'destroyer',1,84,26);
      this.spawn(this.side(1)==='soviet'?'submarine':'destroyer',1,90,17);
      this.spawn('lab',2,37,27,{tag:'lab',strategic:true});
      this.spawn('rocket',1,45,30);
    } else if(this.missionIndex===2) {
      this.spawn('advancedPower',1,90,12);
      this.spawn('silo',1,89,31,{tag:'siloA',strategic:true});
      this.spawn('silo',1,64,14,{tag:'siloB',strategic:true});
      this.spawn('radar',1,68,5);this.spawn('tech',1,89,43);
      this.spawn('tesla',1,61,36);this.spawn('sam',1,80,42);
      this.spawn('helipad',1,93,61);this.spawn('relay',2,33,23,{tag:'relay',strategic:true});
      this.spawn(this.side(1)==='soviet'?'hind':'longbow',1,83,45);
    } else {
      // Operation 04: the broadcast tower behind the southern pass, remnant pickets at both passes.
      if(this.mode==='campaign')this.spawn('tower',0,41,67,{tag:'tower',strategic:true});
      this.spawn('lab',2,30,38,{tag:'lab',strategic:true});
      this.spawn('pillbox',1,58,22);this.spawn('pillbox',1,58,60);
      this.spawn('rocket',1,60,25);this.spawn('rifle',1,61,62);this.spawn('rifle',1,60,64);
      this.spawn(this.side(1)==='soviet'?'heavy':'medium',1,63,58);
    }
    this.updatePower();this.updateFog();this.events=[];
  }
  updatePower() {
    for(let owner=0;owner<2;owner++) {
      let used=0,total=0;
      for(const e of this.entities){if(e.owner!==owner||e.hp<=0)continue;const d=TYPES[e.type];if(d.kind!=='building')continue;used+=d.power||0;total+=(d.generation||0)*Math.max(0.3,e.hp/d.hp);}
      this.power[owner].used=Math.ceil(used);this.power[owner].total=Math.floor(total);
    }
  }
  visibleTo(e,owner=0) {return e.owner===owner||!!this.visibility[owner][this.map.indexAt(e.x,e.z)];}
  updateFog() {
    for(let owner=0;owner<2;owner++) {
      const visible=this.visibility[owner],explored=this.explored[owner];visible.fill(0);
      const reveal=(x,z,r)=>{
        for(let iz=Math.max(0,Math.floor((z-r)/2));iz<Math.min(this.map.rows,Math.ceil((z+r)/2));iz++)
          for(let ix=Math.max(0,Math.floor((x-r)/2));ix<Math.min(this.map.cols,Math.ceil((x+r)/2));ix++)
            if((ix*2+1-x)**2+(iz*2+1-z)**2<r*r)visible[iz*this.map.cols+ix]=1;
      };
      for(const e of this.entities)if(e.owner===owner&&e.hp>0)reveal(e.x,e.z,TYPES[e.type].sight||14);
      for(const s of this.scans)if(s.owner===owner&&s.until>this.time)reveal(s.x,s.z,s.radius);
      for(let i=0;i<visible.length;i++)if(visible[i])explored[i]=1;
    }
    for(const e of this.entities)if(this.visibleTo(e,0))e.seen=true;
  }
  allowed(type,owner=0) {
    const d=CATALOG[type];if(!d||d.noBuild)return 'Not available for construction';
    if(d.faction&&d.faction!==this.side(owner))return `${d.faction==='allies'?'Allied':'Soviet'} technology`;
    if(d.needs&&!this.has(d.needs,owner))return `Requires ${TYPES[d.needs]?.name||d.needs}`;
    if(d.producer&&!this.has(d.producer,owner))return `Requires ${TYPES[d.producer].name}`;
    if(d.kind==='upgrade'&&(this.upgrades[owner][type]||this.queues[owner].research.some(q=>q.type===type)))return 'Already researched or queued';
    if(d.kind==='unit'){
      let queued=0;for(const lane of lanes)for(const q of this.queues[owner][lane])if(CATALOG[q.type].kind==='unit')queued++;
      if(this.pop(owner)+queued>=POPULATION)return `Unit limit: ${POPULATION}`;
    }
    return '';
  }
  enqueue(type,owner=0) {
    if(this.status!=='active')return {ok:false,reason:'Operation has ended'};
    const d=CATALOG[type],reason=this.allowed(type,owner);if(reason)return {ok:false,reason};
    if(this.credits[owner]<d.cost)return {ok:false,reason:'Insufficient funds'};
    const lane=laneOf(d),queue=this.queues[owner][lane];
    if(queue.length>=12)return {ok:false,reason:'Production queue is full'};
    this.credits[owner]-=d.cost;
    const entry={id:this.queueId++,type,progress:0,ready:false,cost:d.cost};queue.push(entry);
    this.emit('queued',{owner,typeName:type});return {ok:true,id:entry.id};
  }
  cancelQueue(lane,id,owner=0) {
    const q=this.queues[owner]?.[lane];if(!q)return false;const i=q.findIndex(e=>e.id===id);if(i<0)return false;
    const item=q.splice(i,1)[0];this.credits[owner]+=Math.round(item.cost*(1-item.progress*0.25));
    this.emit('notice',{text:'Production cancelled. Remaining resources refunded.'});return true;
  }
  placement(type,x,z,owner=0,rot=0) {
    const d=TYPES[type];if(!d||d.kind!=='building'||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(rot))return {ok:false,reason:'Invalid structure'};
    const size=rot%2?[d.size[1],d.size[0]]:d.size;
    const [w,h]=size;
    if(x-w/2<2||z-h/2<2||x+w/2>98||z+h/2>82)return {ok:false,reason:'Outside the battlefield'};
    let water=0,land=0;
    for(let zz=z-h/2;zz<=z+h/2;zz+=1.5)for(let xx=x-w/2;xx<=x+w/2;xx+=1.5) {
      const t=this.map.cellAt(xx,zz);if(t===3)return {ok:false,reason:'Obstructed terrain'};
      if(t===1)water++;else land++;
      if(owner===0&&!this.explored[0][this.map.indexAt(xx,zz)])return {ok:false,reason:'Scout this area first'};
    }
    if(d.coast?(!water||!land):water>0)return {ok:false,reason:d.coast?'Place across the coastline':'Requires solid ground'};
    const buildings=this.entities.filter(e=>e.hp>0&&TYPES[e.type].kind==='building');
    if(buildings.some(e=>{const raw=TYPES[e.type].size,s=e.rot%2?[raw[1],raw[0]]:raw;return Math.abs(e.x-x)<(s[0]+w)/2+1&&Math.abs(e.z-z)<(s[1]+h)/2+1;}))return {ok:false,reason:'Too close to another structure'};
    if(this.resources.some(r=>r.ore>0&&Math.abs(r.x-x)<w/2+2&&Math.abs(r.z-z)<h/2+2))return {ok:false,reason:'Do not cover the ore fields'};
    const anchors=buildings.filter(e=>e.owner===owner&&!NON_ANCHORS.includes(e.type));
    if(!anchors.some(e=>distance(e,{x,z})<(d.coast?24:17)+TYPES[e.type].radius))return {ok:false,reason:'Build closer to your base'};
    return {ok:true};
  }
  place(type,x,z,owner=0,rot=0) {
    const q=this.queues[owner].construction,item=q[0];
    if(!item||item.type!==type||!item.ready)return {ok:false,reason:'Structure is not ready'};
    x=Math.round(x);z=Math.round(z);const valid=this.placement(type,x,z,owner,rot);if(!valid.ok)return valid;
    q.shift();const e=this.spawn(type,owner,x,z,{rot});
    this.evictUnits(e);
    if(owner===0)this.stats.built++;
    if(type==='refinery')this.spawnAtBuilding('harvester',e);
    this.emit('constructed',{id:e.id,owner,typeName:type,x,z});return {ok:true,id:e.id};
  }
  evictUnits() {
    for(const e of this.entities)if(TYPES[e.type].kind==='unit'&&domain(e)!=='air'&&this.map.blocked(e.x,e.z,domain(e))){
      const n=this.map.nearest(e.x,e.z,domain(e));if(n>=0){const p=this.map.point(n);e.x=e.px=p.x;e.z=e.pz=p.z;e.path=[];e.goal=null;}
    }
  }
  deploy(id) {
    const e=this.get(id);if(!e||e.type!=='mcv'||e.owner!==0)return {ok:false,reason:'Select an MCV'};
    const x=Math.round(e.x),z=Math.round(e.z);
    for(let zz=z-3;zz<=z+3;zz+=2)for(let xx=x-4;xx<=x+4;xx+=2)if(this.map.blocked(xx,zz))return {ok:false,reason:'Move the MCV onto clear, open ground'};
    e.hp=0;this.entities=this.entities.filter(v=>v!==e);
    const b=this.spawn('conyard',0,x,z);this.evictUnits(b);this.flags.deployed=true;
    this.emit('deployed',{id:b.id,x,z});return {ok:true,id:b.id};
  }
  spawnAtBuilding(type,building) {
    const d=TYPES[type];
    let best=null;
    for(let r=5;r<=14;r+=2)for(let i=0;i<16;i++) {
      const a=i/16*Math.PI*2;const x=building.x+Math.cos(a)*r,z=building.z+Math.sin(a)*r;
      if(this.map.blocked(x,z,d.domain||'ground'))continue;
      const score=Math.abs(a-Math.PI/2)+r*0.1;if(!best||score<best.score)best={x,z,score};
    }
    if(!best)return null;
    const e=this.spawn(type,building.owner,best.x,best.z);
    if(building.rally&&d.role!=='harvest')this.command([e.id],'attackMove',building.rally,building.owner);
    this.emit('trained',{owner:building.owner,id:e.id,typeName:type,x:e.x,z:e.z});return e;
  }
  processQueues(dt) {
    for(let owner=0;owner<2;owner++)for(const lane of lanes) {
      const queue=this.queues[owner][lane],q=queue[0];if(!q||q.ready)continue;
      const d=CATALOG[q.type];
      const producer=d.kind==='building'?'conyard':(d.producer||d.needs);
      if(!this.has(producer,owner)||d.needs&&!this.has(d.needs,owner))continue;
      const rate=(this.lowPower(owner)?0.35:1)*(this.upgrades[owner].logistics?1.15:1);
      q.progress=Math.min(1,q.progress+dt*rate/Math.max(1,d.time));
      if(q.progress<1)continue;
      if(d.kind==='building'){q.ready=true;this.emit('ready',{owner,typeName:q.type});}
      else if(d.kind==='upgrade'){this.upgrades[owner][q.type]=true;queue.shift();this.emit('upgrade',{owner,typeName:q.type});}
      else {
        if(this.pop(owner)>=POPULATION){this.waitNotice(owner,`Unit limit reached (${POPULATION}). ${TYPES[q.type].name} is waiting.`);continue;}
        // Any producer with a clear exit will do; the first one may be boxed in by structures.
        let spawned=null;
        for(const building of this.owned(owner,producer)){spawned=this.spawnAtBuilding(q.type,building);if(spawned)break;}
        if(spawned){queue.shift();if(owner===0)this.stats.built++;}
        else this.waitNotice(owner,`${TYPES[q.type].name} is waiting for a clear exit. Move units or structures away from the ${TYPES[producer].name}.`);
      }
    }
  }
  setDestination(e,p) {
    if(e.goal&&distance(e.goal,p)<2&&e.pathVersion===this.map.version)return;
    if(!e.path.length&&e.nextPathTime>this.time&&e.pathVersion===this.map.version)return;
    e.goal={x:p.x,z:p.z};e.path=this.map.path(e,p,domain(e));e.pathVersion=this.map.version;e.nextPathTime=e.path.length?0:this.time+1.2;
  }
  command(ids,action,point={},owner=0,append=false) {
    if(this.status!=='active')return;
    if(!Array.isArray(ids)||!['context','deploy','stop',...ORDER_TYPES].includes(action))return;
    if(!['deploy','stop','guard'].includes(action)&&(!Number.isFinite(point.x)||!Number.isFinite(point.z)))return;
    const group=[...new Set(ids)].map(id=>this.get(id)).filter(e=>e&&e.owner===owner);
    let ordinal=0;
    for(const e of group) {
      const d=TYPES[e.type];
      if(d.kind==='building') {
        if(['move','attackMove'].includes(action))e.rally={x:point.x,z:point.z};
        continue;
      }
      if(action==='deploy'){this.deploy(e.id);continue;}
      const target=this.get(point.id);
      let type=action;
      if(action==='context') {
        const building=target&&TYPES[target.type].kind==='building';
        if(building&&target.owner!==owner&&d.role==='capture')type='capture';
        else if(building&&target.owner===owner&&d.role==='capture')type='repair';
        else if(building&&target.owner===enemyOf(owner)&&d.role==='demolish')type='demolish';
        else if(target&&target.owner===enemyOf(owner)&&d.damage>0)type='attack';
        else if(d.role==='harvest'&&this.resources.some(r=>Math.hypot(r.x-point.x,r.z-point.z)<5))type='harvest';
        else type='move';
      }
      if(type==='attack'&&(!target||target.owner===owner||target.owner===2))continue;
      if(type==='demolish'&&(!target||d.role!=='demolish'||target.owner!==enemyOf(owner)))continue;
      // A repair or capture order given to a mixed group only concerns its engineers; the rest used to walk over and idle there.
      if((type==='repair'||type==='capture')&&d.role!=='capture')continue;
      let x=point.x??e.x,z=point.z??e.z;
      if(['move','attackMove'].includes(type)&&group.length>1) {
        const cols=Math.ceil(Math.sqrt(group.length)),gap=d.category==='infantry'?1.5:3;
        x+=(ordinal%cols-(cols-1)/2)*gap;z+=(Math.floor(ordinal/cols)-(cols-1)/2)*gap;
      }
      ordinal++;
      const cmd={type,x:clamp(x,2,98),z:clamp(z,2,82),id:target?.id||0};
      const busy=e.path.length>0||(TARGETED.includes(e.command.type)&&!!this.get(e.command.id));
      if(append&&busy&&['move','attackMove','attack','capture','demolish'].includes(type)){
        e.waypoints=e.waypoints||[];
        if(e.waypoints.length<MAX_WAYPOINTS)e.waypoints.push(cmd);
        continue;
      }
      e.command=cmd;e.waypoints=[];e.target=0;e.goal=null;e.path=[];e.nextPathTime=0;e.captureProgress=0;e.demoProgress=0;
      if(type==='harvest'){
        e.preferredResource=this.resources.find(r=>Math.hypot(r.x-x,r.z-z)<5)?.id||0;
        if(e.cargo<(this.upgrades[owner].logistics?600:400))e.returning=false;
      }
      if(['move','attackMove'].includes(type))this.setDestination(e,cmd);
      if(type==='stop'||type==='guard'){e.command={type:'guard'};e.path=[];}
      e.brainClock=0;
    }
    if(owner===0&&group.length)this.emit('order',{action,x:point.x,z:point.z});
  }
  canHit(attacker,target) {
    const d=TYPES[attacker.type];return d.damage>0&&target.owner===enemyOf(attacker.owner)&&(d.targets||['ground']).includes(domain(target));
  }
  findTarget(e) {
    const d=TYPES[e.type];let best=null,score=Infinity;
    for(const t of this.entities){if(t.hp<=0||!this.canHit(e,t)||!this.visibleTo(t,e.owner))continue;
      const dist=distance(e,t);if(dist>d.range+TYPES[t.type].radius||dist<(d.minRange||0))continue;
      const s=dist+(TYPES[t.type].kind==='building'?4:0);if(s<score){score=s;best=t;}}
    return best;
  }
  advanceOrder(e) {
    if(!e.waypoints?.length)return false;
    e.command=e.waypoints.shift();e.goal=null;e.path=[];e.nextPathTime=0;e.target=0;e.captureProgress=0;e.demoProgress=0;e.brainClock=0;
    if(['move','attackMove'].includes(e.command.type))this.setDestination(e,e.command);
    return true;
  }
  brain(e) {
    const d=TYPES[e.type];
    if(e.command.type==='attack'&&!this.get(e.command.id))this.advanceOrder(e);
    if(['move','attackMove'].includes(e.command.type)&&!e.path.length&&distance(e,e.command)<2)this.advanceOrder(e);
    if(d.role==='harvest'&&e.command.type==='harvest'){this.harvestBrain(e);return;}
    const cmd=e.command;
    if(['capture','repair','demolish'].includes(cmd.type)){
      const t=this.get(cmd.id);
      if(!t||TYPES[t.type].kind!=='building'||cmd.type==='demolish'&&t.owner!==enemyOf(e.owner)){
        // The structure is gone (or changed hands): carry on with queued orders, else guard.
        if(!this.advanceOrder(e)){e.command={type:'guard'};e.path=[];}
        return;
      }
      if(distance(e,t)>TYPES[t.type].radius+2)this.setDestination(e,t);else e.path=[];
      return;
    }
    let target=this.get(e.target);
    if(cmd.type==='attack') {
      const intended=this.get(cmd.id);
      if(intended&&this.canHit(e,intended)&&this.visibleTo(intended,e.owner))target=intended;
      else {e.command={type:'attackMove',x:cmd.x,z:cmd.z};target=null;}
    }
    if(!target||!this.canHit(e,target)||!this.visibleTo(target,e.owner)||distance(e,target)>d.range+TYPES[target.type].radius+2)target=this.findTarget(e);
    e.target=target?.id||0;
    if(d.kind==='building')return;
    if(target&&distance(e,target)<=d.range+TYPES[target.type].radius&&cmd.type!=='move')e.path=[];
    else if(cmd.type==='attack'&&this.get(cmd.id))this.setDestination(e,this.get(cmd.id));
    else if(['move','attackMove'].includes(cmd.type)&&!e.path.length&&Math.hypot(e.x-cmd.x,e.z-cmd.z)>2){e.goal=null;this.setDestination(e,cmd);}
  }
  harvestBrain(e) {
    const returning=e.cargo>=(this.upgrades[e.owner].logistics?600:400)||e.returning;
    if(returning)e.returning=true;
    const candidates=(returning?this.owned(e.owner,'refinery'):this.resources.filter(r=>r.ore>.01))
      .sort((a,b)=>(!returning&&a.id===e.preferredResource?-1:!returning&&b.id===e.preferredResource?1:distance(e,a)-distance(e,b)));
    const range=returning?TYPES.refinery.radius+2.8:3.5;
    for(const target of candidates){
      if(distance(e,target)<=range){e.harvestTarget=target.id;e.path=[];e.goal=null;return;}
      if(e.harvestTarget===target.id&&e.path.length&&e.pathVersion===this.map.version)return;
      const path=this.map.path(e,target,domain(e));
      if(path.length&&distance(path.at(-1),target)<=range){
        e.harvestTarget=target.id;e.goal={x:target.x,z:target.z};e.path=path;e.pathVersion=this.map.version;e.nextPathTime=0;return;
      }
    }
    e.path=[];e.goal=null;e.brainClock=1.2;
  }
  move(e,dt) {
    if(!e.path.length)return;
    const p=e.path[0],dist=distance(e,p),d=TYPES[e.type];
    if(dist<0.2){e.path.shift();if(!e.path.length&&['move','attackMove'].includes(e.command.type))this.advanceOrder(e);return;}
    const step=Math.min(dist,d.speed*dt);const nx=e.x+(p.x-e.x)/dist*step,nz=e.z+(p.z-e.z)/dist*step;
    if(this.map.blocked(nx,nz,domain(e))){e.path=[];e.goal=null;return;}
    const aim=Math.atan2(p.x-e.x,p.z-e.z);e.angle+=clamp(angleDelta(e.angle,aim),-dt*5,dt*5);
    e.x=nx;e.z=nz;
    if(dist<step+0.2)e.path.shift();
    if(!e.path.length&&['move','attackMove'].includes(e.command.type))this.advanceOrder(e);
  }
  processRole(e,dt) {
    const d=TYPES[e.type];
    if(d.role==='harvest'&&e.command.type==='harvest') {
      if(e.returning) {
        const ref=this.get(e.harvestTarget);
        if(ref&&distance(e,ref)<TYPES.refinery.radius+3) {
          const amount=Math.floor(e.cargo);this.credits[e.owner]+=amount;e.cargo=0;e.returning=false;e.goal=null;e.brainClock=0;
          if(e.owner===0)this.stats.income+=amount;
          this.emit('income',{owner:e.owner,x:e.x,z:e.z,amount});
        }
      } else {
        const node=this.resources.find(r=>r.id===e.harvestTarget);
        if(node&&node.ore>0&&distance(e,node)<3.8){
          const capacity=this.upgrades[e.owner].logistics?600:400;
          const amount=Math.min(55*dt*(node.kind==='gems'?1.8:1),node.ore,capacity-e.cargo);node.ore-=amount;e.cargo+=amount;
          if(e.cargo>=capacity-0.01){e.returning=true;e.goal=null;e.brainClock=0;}
        }
      }
    }
    if(d.role==='capture'&&['capture','repair'].includes(e.command.type)) {
      const target=this.get(e.command.id);if(target&&distance(e,target)<=TYPES[target.type].radius+2) {
        if(e.command.type==='capture'&&target.owner!==e.owner){
          e.captureProgress=(e.captureProgress||0)+dt;
          if(e.captureProgress>=3){
            const old=target.owner;target.owner=e.owner;target.hp=Math.max(target.hp,TYPES[target.type].hp*.5);
            // A captured structure stops whatever its old owner had it doing.
            target.target=0;target.rally=null;target.repairing=false;
            if(e.owner===0){this.stats.captures++;if(target.tag)this.flags[target.tag]=true;this.credits[0]+=500;
              if(target.type==='lab')this.upgrades[0].weapons=true;
              if(target.type==='relay'&&this.missionIndex===2&&!this.flags.launchDelayed){this.deadline+=180;this.flags.launchDelayed=true;}
            }
            this.emit('capture',{id:target.id,owner:e.owner,old,x:target.x,z:target.z});e.hp=0;this.map.rebuild(this.entities);this.updatePower();
          }
        } else if(e.command.type==='repair'&&target.owner===e.owner&&target.hp<maxHealth(target)&&this.credits[e.owner]>1) {
          const amount=Math.min(65*dt,maxHealth(target)-target.hp);target.hp+=amount;this.credits[e.owner]-=amount*.18;
        }
      }
    }
    if(d.role==='demolish'&&e.command.type==='demolish') {
      const target=this.get(e.command.id);
      if(target&&target.owner===enemyOf(e.owner)&&distance(e,target)<=TYPES[target.type].radius+2) {
        e.demoProgress=(e.demoProgress||0)+dt;
        if(e.demoProgress>=2.5){
          e.demoProgress=0;this.emit('demolish',{owner:e.owner,x:target.x,z:target.z,typeName:target.type});
          this.damage(target,5000,'demolish',e);
          if(!this.advanceOrder(e)){e.command={type:'guard'};e.path=[];}
        }
      } else e.demoProgress=0;
    }
    if(d.role==='heal') {
      let target=null;
      for(const t of this.entities){
        if(t.owner!==e.owner||t.hp<=0||TYPES[t.type].category!=='infantry'||t.hp>=maxHealth(t)||distance(e,t)>=7)continue;
        if(!target||t.hp/maxHealth(t)<target.hp/maxHealth(target))target=t;
      }
      if(target){target.hp=Math.min(maxHealth(target),target.hp+18*dt);e.healing=target.id;}else e.healing=0;
    }
    if(e.type==='repair'&&!this.lowPower(e.owner))for(const u of this.entities) {
      if(u.owner!==e.owner||u.hp<=0||TYPES[u.type].category!=='vehicles'||distance(e,u)>10||u.hp>=maxHealth(u)||this.credits[e.owner]<1)continue;
      const amount=Math.min(35*dt,maxHealth(u)-u.hp);u.hp+=amount;this.credits[e.owner]-=amount*.1;
    }
    if(e.type==='mammoth'&&e.hp<d.hp*.5)e.hp=Math.min(d.hp*.5,e.hp+7*dt);
    if(e.repairing&&d.kind==='building'&&e.hp<d.hp&&this.credits[e.owner]>0){const a=Math.min(25*dt,d.hp-e.hp);e.hp+=a;this.credits[e.owner]-=a*.2;}
  }
  shoot(e) {
    const d=TYPES[e.type],t=this.get(e.target);if(!t||!this.canHit(e,t))return;
    if(!this.visibleTo(t,e.owner)||distance(e,t)>d.range+TYPES[t.type].radius||distance(e,t)<(d.minRange||0))return;
    if(d.powered&&this.lowPower(e.owner))return;
    e.turret=Math.atan2(t.x-e.x,t.z-e.z);
    if(e.shotClock>0)return;
    e.shotClock=d.reload/(1+e.veterancy*.1);e.lastShot=this.time;
    const dist=distance(e,t),speed=['rifle','tesla'].includes(d.weapon)?180:d.weapon==='shell'?24:45;
    const damage=d.damage*(1+e.veterancy*.12)*(this.upgrades[e.owner].weapons?1.2:1)*(e.owner===1?DIFFICULTIES[this.difficulty].damage:1);
    this.projectiles.push({id:this.nextId++,from:e.id,owner:e.owner,target:t.id,x:e.x,z:e.z,tx:t.x,tz:t.z,fromAir:domain(e)==='air',toAir:domain(t)==='air',age:0,duration:Math.max(.06,dist/speed),weapon:d.weapon,damage,splash:d.splash||0});
    this.emit('fire',{owner:e.owner,weapon:d.weapon,x:e.x,z:e.z,tx:t.x,tz:t.z});
  }
  damage(e,amount,weapon,source) {
    if(!e||e.hp<=0)return;
    const d=TYPES[e.type];let multiplier=1;
    if(weapon==='rifle'&&['heavy','structure','naval'].includes(d.armor))multiplier=.22;
    if(weapon==='cannon'&&d.category==='infantry')multiplier=.5;
    if(weapon==='rocket'&&d.category==='infantry')multiplier=.55;
    if(weapon==='grenade'&&d.armor==='heavy')multiplier=.4;
    if(e.owner<2&&this.upgrades[e.owner].armor)multiplier*=.8;
    const dealt=amount*multiplier;e.hp-=dealt;e.lastHit=this.time;
    if(e.owner===0&&this.time-this.lastWarning>15){this.lastWarning=this.time;this.emit('warning',{text:e.tag==='tower'?'The broadcast tower is under attack.':d.kind==='building'?'Our base is under attack.':'Our forces are under attack.',x:e.x,z:e.z});}
    if(e.hp<=0){
      if(source){source.xp++;source.veterancy=Math.min(3,Math.floor(source.xp/3));}
      if(e.owner===1)this.stats.kills++;if(e.owner===0)this.stats.losses++;
      this.emit('destroyed',{id:e.id,owner:e.owner,typeName:e.type,x:e.x,z:e.z,large:d.kind==='building'});
      if(e.tag)this.flags[`destroyed_${e.tag}`]=true;
      if(d.kind==='building'){this.map.rebuild(this.entities);this.updatePower();}
    }
  }
  processProjectiles(dt) {
    let live=0;
    for(const p of this.projectiles){p.age+=dt;if(p.age<p.duration){this.projectiles[live++]=p;continue;}
      const target=this.get(p.target),source=this.get(p.from);
      if(target){p.tx=target.x;p.tz=target.z;if(target.owner===enemyOf(p.owner))this.damage(target,p.damage,p.weapon,source);}
      if(p.splash)for(const e of this.entities)if(e.hp>0&&e.id!==p.target&&e.owner!==p.owner&&e.owner!==2&&Math.hypot(e.x-p.tx,e.z-p.tz)<p.splash)this.damage(e,p.damage*.5,p.weapon,source);
      this.emit('impact',{weapon:p.weapon,x:p.tx,z:p.tz,air:p.toAir});
    }
    this.projectiles.length=live;
  }
  separate(dt) {
    const units=this.entities.filter(e=>e.hp>0&&TYPES[e.type].kind==='unit'&&domain(e)!=='air');
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
      const a=units[i],b=units[j];if(domain(a)!==domain(b))continue;
      const r=(TYPES[a.type].radius+TYPES[b.type].radius)*.9,dx=a.x-b.x,dz=a.z-b.z;
      if(Math.abs(dx)>=r||Math.abs(dz)>=r)continue;
      const dist=Math.hypot(dx,dz);
      if(dist>=r)continue;const d=Math.max(.01,dist),push=Math.min(.12,(r-dist)*dt*4);
      const vx=dist<.01?.5:dx/d,vz=dist<.01?.5:dz/d;
      if(!this.map.blocked(a.x+vx*push,a.z+vz*push,domain(a))){a.x+=vx*push;a.z+=vz*push;}
      if(!this.map.blocked(b.x-vx*push,b.z-vz*push,domain(b))){b.x-=vx*push;b.z-=vz*push;}
    }
  }
  autoPlace(type,owner=1) {
    const anchors=this.owned(owner).filter(e=>TYPES[e.type].kind==='building'&&!TYPES[e.type].noBuild||e.type==='conyard');
    for(const a of anchors)for(let r=9;r<=20;r+=3)for(let k=0;k<16;k++){
      const x=Math.round(a.x+Math.cos(k*Math.PI/8)*r),z=Math.round(a.z+Math.sin(k*Math.PI/8)*r);
      if(this.placement(type,x,z,owner).ok)return this.place(type,x,z,owner);
    }
    return {ok:false,reason:'No free construction site'};
  }
  /** Operation 04: remnant reinforcements march in from the eastern edge with every wave until the convoy is clear. */
  reinforce() {
    const soviet=this.side(1)==='soviet',n=this.wave;
    let count=Math.min(2+n,7)+(this.difficulty==='veteran'?1:this.difficulty==='story'?-1:0);
    if(this.pop(1)>70)return [];
    const pool=soviet?['rifle','rocket','grenadier','heavy','ranger']:['rifle','rocket','rifle','medium','light'];
    if(n>=3)pool.push('artillery');
    if(n>=5)pool.push(soviet?'teslaTank':'medium');
    if(n>=7)pool.push(soviet?'mammoth':'artillery');
    const ids=[];
    for(let i=0;i<count;i++){
      const type=pool[Math.floor(this.random.next()*pool.length)];
      const cell=this.map.nearest(95,34+i*2.2);if(cell<0)continue;
      const p=this.map.point(cell);ids.push(this.spawn(type,1,p.x,p.z).id);
    }
    if(ids.length)this.emit('notice',{text:`Remnant reinforcements entering from the east (${ids.length} contacts).`});
    return ids;
  }
  enemyAI() {
    const ready=this.queues[1].construction[0];if(ready?.ready)this.autoPlace(ready.type,1);
    if(this.time>=this.nextBrain){
      this.nextBrain=this.time+8*DIFFICULTIES[this.difficulty].interval;
      if(!this.has('harvester',1)&&!this.queues[1].vehicles.some(q=>q.type==='harvester'))this.enqueue('harvester',1);
      if(this.has('conyard',1)&&!this.queues[1].construction.length){
        const need=this.lowPower(1)?'power':!this.has('refinery',1)?'refinery':!this.has('barracks',1)?'barracks':!this.has('factory',1)?'factory':null;
        if(need)this.enqueue(need,1);
      }
      if(this.queues[1].infantry.length<3){this.enqueue(this.random.next()<.28?'rocket':'rifle',1);}
      if(this.queues[1].vehicles.length<2&&this.credits[1]>950){
        const choices=this.side(1)==='soviet'?['heavy','ranger','heavy']:['medium','ranger','light'];
        if(this.missionIndex>0&&this.has('radar',1))choices.push('artillery');
        if(this.side(1)==='soviet'&&this.has('tech',1))choices.push('teslaTank');
        this.enqueue(choices[Math.floor(this.random.next()*choices.length)],1);
      }
      if(this.missionIndex===2&&this.queues[1].air.length<1&&this.credits[1]>1600)this.enqueue(this.side(1)==='soviet'?'hind':'longbow',1);
    }
    if(this.time>=this.nextWave){
      this.wave++;this.nextWave=this.time+(85-this.missionIndex*8)*DIFFICULTIES[this.difficulty].interval;
      const holding=this.hold>0&&!this.flags.convoyClear;
      if(holding)this.reinforce();
      const tower=holding?this.entities.find(e=>e.tag==='tower'&&e.owner===0&&e.hp>0):null;
      const targets=this.owned(0).filter(e=>['conyard','refinery','factory'].includes(e.type));
      const target=tower||targets[this.wave%Math.max(1,targets.length)]||this.owned(0)[0];
      if(target){const army=this.owned(1).filter(e=>TYPES[e.type].kind==='unit'&&TYPES[e.type].damage>0&&domain(e)!=='naval');this.command(army.map(e=>e.id),'attackMove',target,1);}
      if(this.wave===1)this.emit('notice',{text:holding?'The remnant is advancing on the broadcast tower. Hold both passes.':'Enemy armor is mobilizing. Protect the crossings and your harvesters.'});
    }
  }
  support(kind,point) {
    if(this.status!=='active'||!['scan','strike'].includes(kind)||!Number.isFinite(point.x)||!Number.isFinite(point.z)||point.x<1||point.x>99||point.z<1||point.z>83)return {ok:false,reason:'Choose a target on the map'};
    if(kind==='scan'){
      if(!this.has('radar')||this.lowPower()||this.time<this.scanReady)return {ok:false,reason:'Radar scan is not ready'};
      this.scanReady=this.time+65;this.scans.push({owner:0,x:point.x,z:point.z,radius:22,until:this.time+20});this.updateFog();this.emit('scan',{x:point.x,z:point.z});return {ok:true};
    }
    if(!this.has('silo')||this.lowPower()||this.strikeCharge<100)return {ok:false,reason:'Missile strike is not ready'};
    if(!this.visibility[0][this.map.indexAt(point.x,point.z)])return {ok:false,reason:'Reveal the target area first'};
    this.strikeCharge=0;
    for(const e of this.entities)if(e.owner===1&&e.hp>0&&distance(e,point)<11)this.damage(e,TYPES[e.type].kind==='building'?650:400,'missile',null);
    this.emit('strike',{x:point.x,z:point.z});return {ok:true};
  }
  repairBuilding(id) {const e=this.get(id);if(e?.owner===0&&TYPES[e.type].kind==='building'){e.repairing=!e.repairing;return true;}return false;}
  sell(id) {
    const e=this.get(id);if(!e||e.owner!==0||TYPES[e.type].kind!=='building'||TYPES[e.type].noSell)return false;
    if(e.type==='conyard'&&this.owned(0,'conyard').length===1&&!this.has('mcv'))return false;
    this.credits[0]+=(TYPES[e.type].cost||2000)*.5*(e.hp/maxHealth(e));e.hp=0;
    this.emit('sold',{id,x:e.x,z:e.z});this.map.rebuild(this.entities);this.updatePower();return true;
  }
  objectives() {
    if(this.mode==='skirmish')return [{text:'Destroy the enemy construction yard',done:!this.has('conyard',1)}];
    const gone=tag=>!this.entities.some(e=>e.tag===tag&&e.owner===1&&e.hp>0);
    if(this.missionIndex===0)return [
      {text:this.mission.primary[0],done:!!this.flags.deployed},
      {text:this.mission.primary[1],done:!!this.flags.relay},
      {text:this.mission.primary[2],done:gone('enemyHQ')}
    ];
    if(this.missionIndex===1)return [
      {text:this.mission.primary[0],done:gone('harborRadar')},
      {text:this.mission.primary[1],done:gone('harborYard')}
    ];
    if(this.missionIndex===3)return [
      {text:this.mission.primary[0],done:!!this.flags.convoyClear},
      {text:this.mission.primary[1],done:gone('enemyHQ')}
    ];
    return [{text:`Destroy missile silos (${Number(gone('siloA'))+Number(gone('siloB'))}/2)`,done:gone('siloA')&&gone('siloB')},{text:this.mission.primary[1],done:gone('enemyHQ')}];
  }
  /** Seconds until the Operation 04 convoy is clear, or 0 when there is nothing to hold. */
  holdRemaining() {return this.hold>0&&!this.flags.convoyClear?Math.max(0,this.hold-this.time):0;}
  checkEnd() {
    if(this.status!=='active')return;
    if(!this.has('conyard',0)&&!this.has('mcv',0)){this.finish(false,'Your construction network has been destroyed.');return;}
    if(this.hold>0&&!this.flags.convoyClear&&this.flags.destroyed_tower){this.finish(false,'The broadcast tower fell before the convoy was clear. The last trucks are lost in the smoke.');return;}
    if(this.objectives().every(o=>o.done)){this.finish(true,'All primary objectives completed.');return;}
    if(this.mode==='campaign'&&this.deadline&&this.time>=this.deadline){
      const silos=this.entities.some(e=>['siloA','siloB'].includes(e.tag)&&e.owner===1&&e.hp>0);
      if(silos)this.finish(false,'The missile network completed its launch sequence.');
    }
  }
  finish(won,reason) {this.status=won?'won':'lost';this.reason=reason;this.emit('result',{won,reason});}
  step(dt=STEP) {
    if(this.status!=='active'||this.paused)return;
    this.time+=dt;this.fogClock+=dt;this.incomeClock+=dt;
    if(this.fogClock>=.25){this.fogClock=0;this.updateFog();this.updatePower();}
    this.processQueues(dt);
    for(const e of this.entities){if(e.hp<=0)continue;
      e.px=e.x;e.pz=e.z;e.prevAngle=e.angle;e.shotClock=Math.max(0,e.shotClock-dt);e.brainClock-=dt;
      if(e.brainClock<=0){e.brainClock=.28;this.brain(e);}
      if(TYPES[e.type].kind==='unit')this.move(e,dt);
      this.processRole(e,dt);this.shoot(e);
      if(e.owner===0&&e.hp>0&&TYPES[e.type].kind==='unit')for(const c of this.crates)if(!c.taken&&distance(e,c)<2){
        c.taken=true;if(c.kind==='credits'){this.credits[0]+=700;this.stats.income+=700;}else for(const u of this.entities)if(u.owner===0&&u.hp>0&&distance(u,c)<15)u.hp=Math.min(maxHealth(u),u.hp+300);
        this.emit('pickup',{x:c.x,z:c.z,kind:c.kind});
      }
    }
    this.separate(dt);this.processProjectiles(dt);
    if(this.entities.some(e=>e.hp<=0))this.entities=this.entities.filter(e=>e.hp>0);
    if(this.incomeClock>=8){this.incomeClock=0;for(const e of this.entities)if(e.type==='oil'&&e.owner<2){this.credits[e.owner]+=100;if(e.owner===0)this.stats.income+=100;this.emit('income',{owner:e.owner,amount:100,x:e.x,z:e.z});}}
    for(const r of this.resources)r.ore=Math.min(r.max,r.ore+dt*1.2);
    if(this.scans.length&&this.scans.some(s=>s.until<=this.time))this.scans=this.scans.filter(s=>s.until>this.time);
    if(this.has('silo')&&!this.lowPower())this.strikeCharge=Math.min(100,this.strikeCharge+dt);
    if(this.hold>0&&!this.flags.convoyClear&&this.time>=this.hold&&this.entities.some(e=>e.tag==='tower'&&e.owner===0&&e.hp>0)){
      this.flags.convoyClear=true;
      this.emit('convoy',{text:'The convoy is clear of the pass. Remnant reinforcements have stopped. Destroy their command post.'});
    }
    this.enemyAI();this.checkEnd();
    for(let i=0;i<2;i++)if(this.credits[i]<0)this.credits[i]=0;
  }
  serialize() {
    return {version:1,mission:this.missionIndex,difficulty:this.difficulty,faction:this.faction,mode:this.mode,seed:this.seed,
      state:Object.fromEntries(['entities','projectiles','resources','crates','nextId','queueId','time','status','reason','credits','queues','upgrades','flags','stats','scans','scanReady','strikeCharge','deadline','nextBrain','nextWave','wave','lastWarning'].map(k=>[k,this[k]])),
      rng:this.random.state,explored:this.explored.map(v=>Array.from(v))};
  }
  static restore(data) {
    if(!data||data.version!==1||!data.state||!Array.isArray(data.state.entities)||data.state.entities.length>500)throw new Error('Unsupported or damaged save file');
    if(!Number.isInteger(data.mission)||data.mission<0||data.mission>LAST_MISSION)throw new Error('Invalid mission in save');
    if(data.state.entities.some(e=>!TYPES[e.type]||!Number.isFinite(e.x)||!Number.isFinite(e.z)||!Number.isFinite(e.hp)||![0,1,2].includes(e.owner)))throw new Error('Invalid entity in save');
    const state=data.state;
    const bounded=(key,max)=>{if(!Array.isArray(state[key])||state[key].length>max)throw new Error(`Invalid ${key} in save`);};
    bounded('projectiles',2000);bounded('resources',100);bounded('crates',100);bounded('scans',100);
    const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=0&&p.x<=100&&p.z>=0&&p.z<=84;
    const validOrder=c=>c&&typeof c==='object'&&ORDER_TYPES.has(c.type)&&
      (['guard','harvest'].includes(c.type)||point(c))&&
      (c.id===undefined||Number.isSafeInteger(c.id)&&c.id>=0);
    const ids=new Set();
    for(const e of state.entities){
      if(!Number.isSafeInteger(e.id)||e.id<1||ids.has(e.id)||!point(e)||!e.command||typeof e.command.type!=='string'||!Array.isArray(e.path)||e.path.length>2500||e.path.some(p=>!point(p)))throw new Error('Invalid entity orders in save');
      if(!validOrder(e.command)||(e.waypoints!==undefined&&(!Array.isArray(e.waypoints)||e.waypoints.length>MAX_WAYPOINTS||e.waypoints.some(c=>!validOrder(c)))))throw new Error('Invalid queued orders in save');
      for(const key of ['px','pz','angle','prevAngle','turret','shotClock','brainClock','cargo','veterancy','xp','born','rot','pathVersion','target'])if(!Number.isFinite(e[key]))throw new Error('Invalid unit state in save');
      if(e.owner===2&&!['oil','relay','lab'].includes(e.type))throw new Error('Invalid neutral unit in save');
      if(!Number.isInteger(e.rot)||e.rot<0||e.rot>3||e.cargo<0||e.veterancy<0||e.veterancy>3||e.hp>TYPES[e.type].hp+.001)throw new Error('Invalid unit values in save');
      if(e.goal!==null&&!point(e.goal)||e.rally!==null&&!point(e.rally))throw new Error('Invalid destination in save');
      for(const key of ['nextPathTime','captureProgress','demoProgress','harvestTarget','preferredResource','lastShot','lastHit','healing'])if(e[key]!==undefined&&!Number.isFinite(e[key]))throw new Error('Invalid unit timing in save');
      if(e.tag!==undefined&&(typeof e.tag!=='string'||e.tag.length>80))throw new Error('Invalid unit tag in save');
      ids.add(e.id);
    }
    if(!Number.isSafeInteger(state.nextId)||state.nextId<1||[...ids].some(id=>id>=state.nextId)||!Number.isSafeInteger(state.queueId)||state.queueId<1)throw new Error('Invalid identifiers in save');
    if(!['active','won','lost'].includes(state.status)||!Array.isArray(state.upgrades)||state.upgrades.length!==2||state.upgrades.some(v=>!v||typeof v!=='object')||!state.flags||!state.stats)throw new Error('Invalid progression in save');
    if(state.projectiles.some(p=>!p||![0,1].includes(p.owner)||!point(p)||!Number.isFinite(p.tx)||!Number.isFinite(p.tz)||!Number.isFinite(p.damage)||p.damage<0||!Number.isFinite(p.age)||!Number.isFinite(p.duration)||p.duration<=0||!Number.isFinite(p.splash)||!Number.isSafeInteger(p.id)||!Number.isSafeInteger(p.target)||!Number.isSafeInteger(p.from)))throw new Error('Invalid projectile in save');
    for(const key of ['kills','losses','built','income','captures'])if(!Number.isFinite(state.stats[key])||state.stats[key]<0)throw new Error('Invalid statistics in save');
    if(typeof state.reason!=='string'||state.reason.length>1000)throw new Error('Invalid result in save');
    if(state.resources.some(r=>!point(r)||!Number.isFinite(r.ore)||!Number.isFinite(r.max))||state.crates.some(c=>!point(c))||state.scans.some(s=>!point(s)||!Number.isFinite(s.until)||!Number.isFinite(s.radius)||s.radius<0||![0,1].includes(s.owner)))throw new Error('Invalid world state in save');
    for(const key of ['scanReady','strikeCharge','deadline','nextBrain','nextWave','wave','lastWarning'])if(!Number.isFinite(state[key]))throw new Error('Invalid timing in save');
    const sim=new Simulation(data);
    for(const key of Object.keys(sim.serialize().state))if(key in data.state)sim[key]=structuredClone(data.state[key]);
    if(!Number.isFinite(sim.time)||sim.time<0||!Array.isArray(sim.credits)||sim.credits.length!==2||sim.credits.some(v=>!Number.isFinite(v)||v<0))throw new Error('Invalid economy in save');
    if(!Array.isArray(sim.queues)||sim.queues.length!==2||!sim.queues[0]||!sim.queues[1])throw new Error('Invalid production state');
    for(const q of sim.queues)for(const lane of lanes)if(!Array.isArray(q[lane])||q[lane].length>12||q[lane].some(item=>!item||!CATALOG[item.type]||laneOf(CATALOG[item.type])!==lane||!Number.isSafeInteger(item.id)||item.id<1||item.id>=sim.queueId||typeof item.ready!=='boolean'||!Number.isFinite(item.progress)||item.progress<0||item.progress>1||!Number.isFinite(item.cost)||item.cost<0))throw new Error('Invalid production queue');
    sim.random.state=data.rng>>>0||1;sim.map.rebuild(sim.entities);
    sim.explored=(data.explored||[]).length===2?data.explored.map(v=>Uint8Array.from(v)):sim.explored;
    if(sim.explored.some(v=>v.length!==sim.map.cells.length))throw new Error('Invalid fog-of-war state');
    sim.events=[];sim.updatePower();sim.updateFog();return sim;
  }
}
