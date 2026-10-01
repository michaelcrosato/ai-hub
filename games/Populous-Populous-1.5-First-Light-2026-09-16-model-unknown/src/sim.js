/* Populous 1.5 — First Light. Simulation has no DOM or rendering dependency. */
export const SIZE = 36;
export const HEIGHT = 0.68;
export const MAX_HEIGHT = 9;
export const MAX_MANA = 1000;
export const SAVE_VERSION = 3;
export const STEP = 0.1;
export const TOOLS = {
  raise: { name: 'Raise land', cost: 2, key: '1', tip: 'Lift a land corner. Nearby slopes move with it.' },
  lower: { name: 'Lower land', cost: 2, key: '2', tip: 'Lower a land corner. Low land can flood.' },
  level: { name: 'Level land', cost: 6, key: '3', tip: 'Make a 3 × 3 patch flat. Clear more space around homes.' },
  rally: { name: 'Place magnet', cost: 12, key: '4', tip: 'Place your standard. Use Gather to bring followers here.' },
  swamp: { name: 'Swamp', cost: 65, key: '5', tip: 'Poison a small patch. The swamp harms both sides.' },
  quake: { name: 'Earthquake', cost: 100, key: '6', tip: 'Break flat land in a wide area. All nearby homes are at risk.' },
  knight: { name: 'Make knight', cost: 160, key: '7', tip: 'Turn your strongest walker into a knight. It will seek the enemy.' },
  volcano: { name: 'Volcano', cost: 240, key: '8', tip: 'Raise a burning mountain. Both sides can lose followers.' },
  flood: { name: 'Flood', cost: 380, key: '9', tip: 'Raise the sea by one level. Low homes on both sides will flood.' },
  armageddon: { name: 'Armageddon', cost: 650, key: '0', tip: 'End the age. All followers leave home for one final battle.' }
};
/** Powers that act at once (no target on the land). */
export const INSTANT_TOOLS = ['knight', 'flood', 'armageddon'];
export const TEAM = [ { name: 'Dawn', color: '#87dcca' }, { name: 'Ember', color: '#ed9279' } ];
export const SCENARIOS = {
  'first-light': { name: 'First Light', number: '01', blurb: 'green lands' },
  islands: { name: 'Tidal Reach', number: '02', blurb: 'islands' },
  highlands: { name: 'High Crown', number: '03', blurb: 'mountains' },
  ashen: { name: 'Ashen Reach', number: '04', blurb: 'scorched plains' }
};
export const DIFFICULTIES = ['gentle', 'standard', 'fierce'];
/**
 * The Long Dawn: ten fixed worlds played in order. Each one names its land,
 * its rival and the head start Ember is given. Seeds are fixed, so every
 * player meets the same worlds.
 */
export const CONQUEST = [
  { name: 'First Light', scenario: 'first-light', difficulty: 'gentle', seed: 481516, story: 'A quiet green land. Learn to shape it.' },
  { name: 'Tidal Reach', scenario: 'islands', difficulty: 'gentle', seed: 90210, story: 'Two islands and a narrow sea. Build a way across.' },
  { name: 'High Crown', scenario: 'highlands', difficulty: 'standard', seed: 271828, story: 'Steep hills hide little flat land. Make your own.' },
  { name: 'Ashen Reach', scenario: 'ashen', difficulty: 'standard', seed: 314159, story: 'Old fires left the plains in ash. Heal the land to build on it.' },
  { name: 'Greenhollow', scenario: 'first-light', difficulty: 'standard', seed: 161803, rivalMana: 120, story: 'Ember wakes first here, with mana already in hand.' },
  { name: 'Saltmere', scenario: 'islands', difficulty: 'standard', seed: 141421, rivalMana: 160, story: 'The rival holds more power across the water.' },
  { name: 'Cinderfall', scenario: 'ashen', difficulty: 'fierce', seed: 173205, story: 'A fierce rival in a burned world.' },
  { name: 'Stormcrown', scenario: 'highlands', difficulty: 'fierce', seed: 223606, rivalMana: 200, story: 'High peaks, a fierce rival and a strong start for Ember.' },
  { name: 'Drowned Isles', scenario: 'islands', difficulty: 'fierce', seed: 244948, rivalMana: 240, rivalPop: 1.3, sea: 1.32, story: 'The sea has already risen once. Ember’s towns are larger.' },
  { name: 'The Last Dawn', scenario: 'first-light', difficulty: 'fierce', seed: 264575, rivalMana: 320, rivalPop: 1.5, story: 'The final world. Ember is at full strength.' }
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x-b.x)**2 + (a.z-b.z)**2;
const finite = Number.isFinite;
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
// Path search scratch space, shared by every call (the simulation is single-threaded).
const PATH_PREV=new Int16Array(SIZE*SIZE);
const PATH_QUEUE=new Int16Array(SIZE*SIZE);
const PATH_DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
export class Random {
  constructor(seed = 481516) { this.state = (Number(seed) >>> 0) || 1; }
  next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 4294967296; }
  int(n) { return Math.floor(this.next()*n); }
}
export class World {
  constructor({seed = 481516, scenario = 'first-light', difficulty = 'standard', rivalMana = 0, rivalPop = 1, sea = .32, conquest = null} = {}) {
    this.seed = Number(seed) >>> 0;
    this.rng = new Random(this.seed);
    this.scenario = SCENARIOS[scenario] ? scenario : 'first-light';
    this.difficulty = DIFFICULTIES.includes(difficulty) ? difficulty : 'standard';
    this.conquest = Number.isInteger(conquest) && conquest >= 0 && conquest < CONQUEST.length ? conquest : null;
    this.h = new Int8Array((SIZE+1)**2);
    this.scars = new Float32Array(SIZE**2);
    this.swamp = new Float32Array(SIZE**2);
    this.towns = []; this.units = []; this.nextId = 1;
    this.mana = [180, clamp(180 + (Number(rivalMana) || 0), 0, MAX_MANA)]; this.mode = ['settle','settle'];
    this.magnets = [{x:8.5,z:23.5},{x:27.5,z:11.5}];
    this.time = 0; this.sea = clamp(Number(sea) || .32, .32, 3.32); this.armageddon = false;
    this.winner = null; this.paused = false;
    this.terrainVersion = 0; this.townVersion = 0; this.events = [];
    this.aiClock = 0; this.econClock = 0; this.hazardClock = 0;
    this.lastAIspell = 0; this.lastAIknight = 0; this.battleClock = 0;
    this.edits = 0; this.born = 0; this.kills = [0,0];
    this.generate(); this.startPeople(clamp(Number(rivalPop) || 1, .5, 3));
  }
  vi(x,z) { return z*(SIZE+1)+x; }
  ci(x,z) { return z*SIZE+x; }
  valid(x,z) { return x>=0 && z>=0 && x<SIZE && z<SIZE; }
  vertex(x,z) { return this.h[this.vi(clamp(Math.round(x),0,SIZE),clamp(Math.round(z),0,SIZE))]; }
  corners(x,z) { return [this.vertex(x,z),this.vertex(x+1,z),this.vertex(x+1,z+1),this.vertex(x,z+1)]; }
  flat(x,z) {
    if (!this.valid(x,z)) return false;
    const a=this.vertex(x,z);
    return a>this.sea && this.vertex(x+1,z)===a && this.vertex(x+1,z+1)===a && this.vertex(x,z+1)===a && this.swamp[this.ci(x,z)]<=0 && this.scars[this.ci(x,z)]<=0;
  }
  cellHeight(x,z) { x=clamp(Math.floor(x),0,SIZE-1); z=clamp(Math.floor(z),0,SIZE-1); return (this.vertex(x,z)+this.vertex(x+1,z)+this.vertex(x+1,z+1)+this.vertex(x,z+1))/4; }
  heightAt(x,z) {
    const ix=clamp(Math.floor(x),0,SIZE-1), iz=clamp(Math.floor(z),0,SIZE-1);
    const a=clamp(x-ix,0,1), b=clamp(z-iz,0,1);
    const h0=this.vertex(ix,iz),h1=this.vertex(ix+1,iz),h2=this.vertex(ix+1,iz+1),h3=this.vertex(ix,iz+1);
    return (h0*(1-a)*(1-b)+h1*a*(1-b)+h2*a*b+h3*(1-a)*b)*HEIGHT;
  }
  walkable(x,z) { if (!this.valid(x,z)) return false; const h=this.corners(x,z); return Math.min(...h)>this.sea && Math.max(...h)-Math.min(...h)<=2; }
  generate() {
    const phase=this.rng.next()*Math.PI*2;
    for (let z=0;z<=SIZE;z++) for (let x=0;x<=SIZE;x++) {
      const dx=(x-18)/17, dz=(z-18)/16;
      const radius=Math.sqrt(dx*dx+dz*dz);
      const lobes=Math.sin(x*.29+phase)*.37+Math.cos(z*.31-phase)*.43+Math.sin((x+z)*.43)*.23;
      const mountain=2.5*Math.exp(-((x-20)**2+(z-18)**2)/48);
      let h=(1-radius)*6.3+lobes+mountain;
      if (this.scenario==='islands') h-=2.1*Math.exp(-((x-z-1)**2)/14);
      if (this.scenario==='highlands') h+=2.8*Math.exp(-((x-19)**2+(z-19)**2)/80);
      // Ashen Reach: low burned plains around two broken crags.
      if (this.scenario==='ashen') h+=-1.1+2.6*Math.exp(-((x-13)**2+(z-12)**2)/16)+2.9*Math.exp(-((x-24)**2+(z-25)**2)/20);
      this.h[this.vi(x,z)]=clamp(Math.floor(h),0,MAX_HEIGHT);
    }
    // A small land bridge permits an opening route in every world.
    if (this.scenario!=='islands') {
      for (let x=7;x<30;x++) {
        const z=Math.round(26-(x-7)*.61);
        for(let dz=-1;dz<=1;dz++) this.h[this.vi(x,z+dz)]=Math.max(2,this.h[this.vi(x,z+dz)]);
      }
    }
    // Safe, equal starting areas. Flat corners are the simulation's build rule.
    for (const c of [{x:8,z:24},{x:27,z:11}]) {
      for (let z=c.z-4;z<=c.z+4;z++) for(let x=c.x-4;x<=c.x+4;x++) this.h[this.vi(x,z)]=2;
    }
    this.relax();
    if (this.scenario==='ashen') this.scatterAsh();
    this.terrainVersion++;
  }
  /** Ash fields: scorched tiles that cannot hold homes until they cool or are levelled. */
  scatterAsh() {
    for (let n=0;n<18;n++) {
      const cx=2+this.rng.int(SIZE-4), cz=2+this.rng.int(SIZE-4), r=1.6+this.rng.next()*2.4, life=80+this.rng.int(100);
      for (let dz=-4;dz<=4;dz++) for (let dx=-4;dx<=4;dx++) {
        const x=cx+dx, z=cz+dz, d=Math.sqrt(dx*dx+dz*dz);
        if (!this.valid(x,z)||d>r) continue;
        const i=this.ci(x,z); this.scars[i]=Math.max(this.scars[i], Math.round(life*(1-d/(r+1)*.5)));
      }
    }
    // The two starting areas stay clean, so both sides begin equal.
    for (const c of [{x:8,z:24},{x:27,z:11}]) {
      for (let z=c.z-4;z<c.z+4;z++) for (let x=c.x-4;x<c.x+4;x++) if (this.valid(x,z)) this.scars[this.ci(x,z)]=0;
    }
  }
  relax() {
    // Only lower excessive slopes. Finite grid, finite integer heights.
    for (let pass=0;pass<MAX_HEIGHT;pass++) {
      let changed=false;
      for(let z=0;z<=SIZE;z++) for(let x=0;x<=SIZE;x++) {
        const i=this.vi(x,z); let low=this.h[i];
        for (const [dx,dz] of DIRS) {
          const nx=x+dx,nz=z+dz; if(nx>=0&&nz>=0&&nx<=SIZE&&nz<=SIZE) low=Math.min(low,this.h[this.vi(nx,nz)]+1);
        }
        if(low<this.h[i]) { this.h[i]=low;changed=true; }
      }
      if(!changed) break;
    }
  }
  startPeople(rivalPop=1) {
    for(const [team,centres] of [[0,[[7,23],[10,25],[6,26]]],[1,[[26,10],[29,12],[25,13]]]]) {
      for(const [x,z] of centres) this.addTown(team,x,z,team===1?Math.round(7*rivalPop):7);
      const p=team===0?{x:9.5,z:22.5}:{x:28.5,z:9.5};
      this.addUnit(team,p.x,p.z,5,true);
      this.addUnit(team,p.x-1,p.z,3);
    }
    this.economy(0); this.events=[];
  }
  emit(type,data={}) { this.events.push({type,...data}); if(this.events.length>120)this.events.shift(); }
  drainEvents() { return this.events.splice(0); }
  addTown(team,x,z,pop=3) {
    const t={id:this.nextId++,team,x,z,pop,tier:1,growth:0,emit:0};
    this.towns.push(t);this.townVersion++;
    this.emit('town',{x:x+.5,z:z+.5,team}); return t;
  }
  addUnit(team,x,z,strength=2,leader=false,knight=false) {
    let count=0,nearest=null,best=Infinity;
    for(const u of this.units)if(u.team===team){count++;const d=dist2(u,{x,z});if(d<best){best=d;nearest=u;}}
    if(count>=130&&nearest) { nearest.strength+=strength; return nearest; }
    const u={id:this.nextId++,team,x:clamp(x,.1,SIZE-.1),z:clamp(z,.1,SIZE-.1),strength,leader,knight,
      path:[],repath:0,goal:null,age:0,decision:0,attack:0,facing:0};
    u.px=u.x;u.pz=u.z;
    this.units.push(u); return u;
  }
  population(team) {
    let n=0;
    for(const t of this.towns)if(t.team===team)n+=t.pop;
    for(const u of this.units)if(u.team===team)n+=Math.max(0,u.strength);
    return n;
  }
  income(team) {
    let n=.35;
    for(const t of this.towns)if(t.team===team)n+=.15+t.pop*.027;
    for(const u of this.units)if(u.team===team)n+=u.strength*.01;
    return n;
  }
  support(x,z) {
    if(!this.flat(x,z)) return 0;
    const h=this.vertex(x,z); let n=0;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++) if(this.flat(x+dx,z+dz)&&this.vertex(x+dx,z+dz)===h) n++;
    return n;
  }
  buildable(x,z,ignoreId=-1) { return this.flat(x,z) && !this.towns.some(t=>t.id!==ignoreId&&Math.abs(t.x-x)<=1&&Math.abs(t.z-z)<=1); }
  influence(x,z,team=0) { const p={x,z};return this.towns.some(t=>t.team===team&&dist2(p,{x:t.x+.5,z:t.z+.5})<81)||this.units.some(u=>u.team===team&&dist2(p,u)<36); }
  cost(tool,x=18,z=18,team=0) { const base=TOOLS[tool]?.cost??Infinity;return ['raise','lower','level'].includes(tool)&&!this.influence(x,z,team)?base*2:base; }
  // Shared-corner editing propagates to preserve the original one-step slope rule.
  setVertex(x,z,value) {
    x=clamp(Math.round(x),0,SIZE);z=clamp(Math.round(z),0,SIZE);
    const old=this.vertex(x,z);value=clamp(Math.round(value),0,MAX_HEIGHT);
    if(old===value)return false;
    const raising=value>old,q=[[x,z,value]];let index=0;
    while(index<q.length) {
      const [px,pz,h]=q[index++],i=this.vi(px,pz);
      if((raising&&this.h[i]>=h)||(!raising&&this.h[i]<=h))continue;
      this.h[i]=h;
      for(const [dx,dz] of DIRS) {
        const nx=px+dx,nz=pz+dz;if(nx<0||nz<0||nx>SIZE||nz>SIZE)continue;
        const nh=this.h[this.vi(nx,nz)];
        if(raising&&nh<h-1)q.push([nx,nz,h-1]);
        else if(!raising&&nh>h+1)q.push([nx,nz,h+1]);
      }
    }
    return true;
  }
  flatten(x,z,radius=1,height=null) {
    x=Math.floor(x);z=Math.floor(z);
    const target=height??Math.max(Math.ceil(this.sea+.1),Math.round(this.cellHeight(x,z)));
    let changed=false;
    for(let dz=-radius;dz<=radius+1;dz++)for(let dx=-radius;dx<=radius+1;dx++) {
      if(x+dx>=0&&z+dz>=0&&x+dx<=SIZE&&z+dz<=SIZE)changed=this.setVertex(x+dx,z+dz,target)||changed;
    }
    for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++) {
      const nx=x+dx,nz=z+dz;if(this.valid(nx,nz)) { const i=this.ci(nx,nz);changed=changed||this.scars[i]>0||this.swamp[i]>0;this.scars[i]=0;this.swamp[i]=0; }
    }
    return changed;
  }
  cast(tool,x,z,team=0) {
    if(this.winner!==null)return {ok:false,message:'This world is complete. Start a new world.'};
    if(this.armageddon)return {ok:false,message:'No powers remain during the final battle.'};
    if(!TOOLS[tool]||!finite(x)||!finite(z)||x<0||z<0||x>SIZE||z>SIZE)return {ok:false,message:'Select a point inside the world.'};
    const cost=this.cost(tool,x,z,team);
    if(this.mana[team]<cost)return {ok:false,message:`You need ${cost} mana.`};
    let changed=true;
    const ix=clamp(Math.floor(x),0,SIZE-1),iz=clamp(Math.floor(z),0,SIZE-1);
    if(tool==='raise'||tool==='lower') {
      const vx=clamp(Math.round(x),0,SIZE),vz=clamp(Math.round(z),0,SIZE);
      changed=this.setVertex(vx,vz,this.vertex(vx,vz)+(tool==='raise'?1:-1));
      if(changed)for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++) if(this.valid(vx+dx,vz+dz)){this.swamp[this.ci(vx+dx,vz+dz)]=0;this.scars[this.ci(vx+dx,vz+dz)]=0;}
    } else if(tool==='level') changed=this.flatten(ix,iz);
    else if(tool==='rally') {
      if(!this.walkable(ix,iz))return {ok:false,message:'Place the magnet on dry land.'};
      this.magnets[team]={x:ix+.5,z:iz+.5};
      for(const u of this.units)if(u.team===team)u.repath=0;
    } else if(tool==='swamp') {
      if(this.cellHeight(ix,iz)<=this.sea)return {ok:false,message:'A swamp needs dry land.'};
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(this.valid(ix+dx,iz+dz))this.swamp[this.ci(ix+dx,iz+dz)]=85;
    } else if(tool==='quake') {
      for(let n=0;n<20;n++) {
        const xx=clamp(ix+this.rng.int(7)-3,0,SIZE),zz=clamp(iz+this.rng.int(7)-3,0,SIZE);
        this.setVertex(xx,zz,this.vertex(xx,zz)+(this.rng.next()>.45?1:-1));
      }
      this.areaDamage(x,z,3.5,.32,team);
    } else if(tool==='knight') {
      const candidates=this.units.filter(u=>u.team===team&&!u.knight&&u.strength>0).sort((a,b)=>b.strength-a.strength);
      if(!candidates.length) {
        const town=this.towns.filter(t=>t.team===team&&t.pop>4).sort((a,b)=>b.pop-a.pop)[0];
        if(!town)return {ok:false,message:'You need a walker or a home with at least 5 followers.'};
        const strength=Math.min(12,town.pop-2);town.pop-=strength;
        candidates.push(this.addUnit(team,town.x+.5,town.z+.5,strength));
      }
      const knight=candidates[0];knight.knight=true;knight.leader=false;knight.repath=0;
      x=knight.x;z=knight.z;this.ensureLeader(team);
    } else if(tool==='volcano') {
      const top=clamp(Math.max(this.vertex(ix,iz)+4,6),0,MAX_HEIGHT);
      this.setVertex(ix,iz,top);
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)if(this.valid(ix+dx,iz+dz)&&dx*dx+dz*dz<11)this.scars[this.ci(ix+dx,iz+dz)]=100;
      this.areaDamage(x,z,3.4,.7,team);
    } else if(tool==='flood') {
      if(this.sea>=5.32)return {ok:false,message:'The sea cannot rise further.'};
      this.sea+=1;
    } else if(tool==='armageddon') {
      this.armageddon=true;
      const level=Math.min(MAX_HEIGHT,Math.ceil(this.sea)+1);
      this.h.fill(level);this.swamp.fill(0);this.scars.fill(0);
      for(const town of this.towns) this.addUnit(town.team,town.x+.5,town.z+.5,town.pop);
      this.towns=[];this.townVersion++;this.mode=['fight','fight'];
      this.magnets=[{x:17.5,z:18.5},{x:18.5,z:17.5}];
      for(const u of this.units){u.repath=0;u.path=[];}
    }
    if(!changed)return {ok:false,message:'The land is already at this level.'};
    this.mana[team]=Math.max(0,this.mana[team]-cost);
    this.edits+=team===0&&['raise','lower','level'].includes(tool)?1:0;
    if(!['rally','knight'].includes(tool)){this.terrainVersion++;this.validateHomes();for(const u of this.units)u.repath=0;}
    this.emit('power',{tool,x,z,team,cost});
    return {ok:true,cost};
  }
  areaDamage(x,z,radius,fraction,team) {
    // Homes sit on whole tiles: measure from the tile centre, like the walkers.
    for(const u of this.units)if(dist2(u,{x,z})<radius*radius){const loss=u.strength*fraction;u.strength-=loss;this.kills[team]+=u.team!==team?loss:0;}
    for(const t of this.towns)if(dist2({x:t.x+.5,z:t.z+.5},{x,z})<radius*radius){const loss=t.pop*fraction;t.pop-=loss;this.kills[team]+=t.team!==team?loss:0;}
  }
  setMode(team,mode) {
    if(!['settle','gather','fight'].includes(mode)||this.armageddon)return;
    if(this.mode[team]===mode)return;
    this.mode[team]=mode;
    if(mode!=='settle')for(const t of this.towns.filter(t=>t.team===team&&t.pop>4)){
      const n=Math.floor(t.pop*.45);t.pop-=n;this.addUnit(team,t.x+.5,t.z+.5,n);
    }
    this.ensureLeader(team);
    for(const u of this.units)if(u.team===team){u.repath=0;u.goal=null;}
    this.emit('mode',{team,mode});
  }
  ensureLeader(team) {
    if(this.units.some(u=>u.team===team&&u.leader&&u.strength>0))return;
    const u=this.units.filter(u=>u.team===team&&!u.knight&&u.strength>0).sort((a,b)=>b.strength-a.strength)[0];
    if(u)u.leader=true;
  }
  validateHomes() {
    const keep=[];
    for(const t of this.towns) {
      if(!this.flat(t.x,t.z)) {
        if(this.cellHeight(t.x,t.z)>this.sea&&t.pop>.8)this.addUnit(t.team,t.x+.5,t.z+.5,t.pop*.8);
        this.emit('collapse',{x:t.x+.5,z:t.z+.5,team:t.team});this.townVersion++;
      } else keep.push(t);
    }
    this.towns=keep;
  }
  economy(dt) {
    for(const t of this.towns) {
      const sup=this.support(t.x,t.z),tier=sup>=21?4:sup>=15?3:sup>=8?2:1;
      if(t.tier!==tier){if(tier>t.tier&&dt>0)this.emit('upgrade',{x:t.x+.5,z:t.z+.5,team:t.team,tier});t.tier=tier;this.townVersion++;}
      const cap=[0,7,13,22,34][t.tier];
      const factor=t.team===1?(this.difficulty==='gentle'?.8:this.difficulty==='fierce'?1.2:1):1;
      const grow=(.10+t.tier*.045)*factor*dt;
      if(t.pop<cap){t.pop=Math.min(cap,t.pop+grow);this.born+=grow;}
      t.emit+=dt;
      if((t.pop>=cap*.9||this.mode[t.team]!=='settle')&&t.pop>4&&t.emit>12) {
        const strength=Math.max(2,Math.floor(t.pop*(this.mode[t.team]==='settle'?.32:.40)));
        t.pop-=strength;t.emit=0;
        this.addUnit(t.team,t.x+.5,t.z+.5,strength);
      }
    }
    if(!this.armageddon)for(let team=0;team<2;team++)this.mana[team]=Math.min(MAX_MANA,this.mana[team]+this.income(team)*dt);
    this.ensureLeader(0);this.ensureLeader(1);
  }
  findPath(start,end) {
    const sx=clamp(Math.floor(start.x),0,SIZE-1),sz=clamp(Math.floor(start.z),0,SIZE-1);
    const ex=clamp(Math.floor(end.x),0,SIZE-1),ez=clamp(Math.floor(end.z),0,SIZE-1);
    const s=this.ci(sx,sz),goal=this.ci(ex,ez);
    if(s===goal)return [];
    const prev=PATH_PREV,q=PATH_QUEUE;prev.fill(-1);prev[s]=s;
    q[0]=s;let read=0,write=1,best=s,bestD=Infinity;
    while(read<write) {
      const cur=q[read++],x=cur%SIZE,z=Math.floor(cur/SIZE);
      const d=(x-ex)**2+(z-ez)**2;if(d<bestD){bestD=d;best=cur;}
      if(cur===goal)break;
      const here=this.cellHeight(x,z);
      for(const [dx,dz] of PATH_DIRS) {
        const nx=x+dx,nz=z+dz;if(!this.valid(nx,nz))continue;
        const next=this.ci(nx,nz);
        if(prev[next]!==-1||!this.walkable(nx,nz)||Math.abs(this.cellHeight(nx,nz)-here)>1.1)continue;
        prev[next]=cur;q[write++]=next;
      }
    }
    const path=[];let cur=best;
    while(cur!==s&&cur!==-1&&path.length<SIZE*SIZE){path.push({x:cur%SIZE+.5,z:Math.floor(cur/SIZE)+.5});cur=prev[cur];}
    return path.reverse();
  }
  goalFor(u) {
    const enemy=1-u.team;
    if(u.knight||this.mode[u.team]==='fight'||this.armageddon) {
      let best=null,bestD=Infinity;
      for(const t of this.units)if(t.team===enemy&&t.strength>0){const d=dist2(t,u);if(d<bestD){bestD=d;best=t;}}
      for(const t of this.towns)if(t.team===enemy){const p={x:t.x+.5,z:t.z+.5},d=dist2(p,u);if(d<bestD){bestD=d;best=p;}}
      return best?{x:best.x,z:best.z}:this.magnets[u.team];
    }
    if(this.mode[u.team]==='gather') {
      const leader=this.units.find(t=>t.team===u.team&&t.leader);
      return !u.leader&&leader?{x:leader.x,z:leader.z}:this.magnets[u.team];
    }
    const ux=Math.floor(u.x),uz=Math.floor(u.z);let best=null,bestScore=-Infinity;
    // Bias towards vacant, useful land. Random term breaks equal-score ties.
    for(let dz=-8;dz<=8;dz++)for(let dx=-8;dx<=8;dx++) {
      const x=ux+dx,z=uz+dz;if(!this.valid(x,z)||!this.buildable(x,z))continue;
      const p={x:x+.5,z:z+.5};
      if(this.towns.some(t=>t.team!==u.team&&dist2(t,p)<12))continue;
      if(this.units.some(other=>other.id!==u.id&&other.team===u.team&&other.goal&&dist2(other.goal,p)<2))continue;
      const score=this.support(x,z)*.22-Math.sqrt(dx*dx+dz*dz)*.75+this.rng.next()*.65;
      if(score>bestScore){bestScore=score;best=p;}
    }
    return best??{x:clamp(u.x+(this.rng.next()-.5)*8,.5,SIZE-.5),z:clamp(u.z+(this.rng.next()-.5)*8,.5,SIZE-.5)};
  }
  moveUnits(dt) {
    const newTowns=[];
    for(const u of this.units) {
      // Where the walker stood at the start of this step: the view eases between the two.
      u.px=u.x;u.pz=u.z;
      if(u.strength<=0)continue;
      u.age+=dt;u.repath-=dt;u.attack=Math.max(0,u.attack-dt);
      const x=Math.floor(u.x),z=Math.floor(u.z);
      if(this.heightAt(u.x,u.z)/HEIGHT<this.sea+.06){u.strength-=dt*4;continue;}
      const tile=this.ci(clamp(x,0,SIZE-1),clamp(z,0,SIZE-1));
      if(this.swamp[tile]>0||this.scars[tile]>0)u.strength-=dt*1.8;
      const foe=this.units.find(v=>v.team!==u.team&&v.strength>0&&dist2(v,u)<.6);
      const home=foe?null:this.towns.find(t=>t.team!==u.team&&dist2({x:t.x+.5,z:t.z+.5},u)<1.1);
      if(foe||home) {
        if(u.attack===0)this.emit('clash',{x:u.x,z:u.z,team:u.team});
        u.attack=.15;
        const strength=Math.sqrt(Math.max(0,u.strength))*(u.knight?2.7:1);
        if(foe){const damage=dt*strength*.55;foe.strength-=damage;this.kills[u.team]+=damage;}
        else {
          const damage=dt*strength*.48;
          home.pop-=damage;u.strength-=dt*Math.sqrt(Math.max(0,home.pop))*.16*(1+home.tier*.12)/(u.knight?2:1);
          this.kills[u.team]+=damage;
          if(home.pop<=.2){
            const lost=home.team;
            if(u.knight){this.scars[this.ci(home.x,home.z)]=55;this.towns=this.towns.filter(t=>t.id!==home.id);this.terrainVersion++;}
            else{home.team=u.team;const n=Math.min(Math.max(0,u.strength)*.6,8);home.pop=n;u.strength-=n;}
            this.townVersion++;this.emit('battle',{x:home.x+.5,z:home.z+.5,team:u.team,lost});
          }
        }
        continue;
      }
      if(!u.knight&&this.mode[u.team]==='settle'&&!this.armageddon&&u.age>2.5&&this.buildable(x,z)&&!newTowns.some(t=>Math.abs(t.x-x)<=1&&Math.abs(t.z-z)<=1)) {
        const noEnemy=this.towns.every(t=>t.team===u.team||dist2(t,u)>9);
        if(noEnemy){newTowns.push({team:u.team,x,z,pop:u.strength});u.strength=0;u.settled=true;continue;}
      }
      if(this.mode[u.team]==='gather'&&!u.leader&&!u.knight) {
        const leader=this.units.find(v=>v.team===u.team&&v.leader&&v.strength>0);
        if(leader&&dist2(leader,u)<.8&&leader.strength+u.strength<500){leader.strength+=u.strength;u.strength=0;u.settled=true;continue;}
      }
      if(u.repath<=0) {
        u.goal=this.goalFor(u);
        u.path=this.findPath(u,u.goal);
        u.repath=(this.mode[u.team]==='settle'?3.8:1.4)+this.rng.next();
      }
      if(u.path.length) {
        const p=u.path[0],dx=p.x-u.x,dz=p.z-u.z,d=Math.hypot(dx,dz);
        const speed=(u.knight?1.05:.72)*dt;
        if(d<=speed){u.x=p.x;u.z=p.z;u.path.shift();}
        else{u.x+=dx/d*speed;u.z+=dz/d*speed;}
        u.facing=Math.atan2(dx,dz);
      }
    }
    for(const t of newTowns)this.addTown(t.team,t.x,t.z,t.pop);
    const alive=[];
    // Walkers who founded a home or joined their leader are not lost.
    for(const u of this.units){if(u.strength>.15)alive.push(u);else if(u.age>0&&!u.settled)this.emit('lost',{x:u.x,z:u.z,team:u.team});}
    this.units=alive;
  }
  ai(dt) {
    if(this.armageddon)return;
    this.aiClock+=dt;
    const interval=this.difficulty==='gentle'?7:this.difficulty==='fierce'?2.8:4.5;
    if(this.aiClock<interval)return;this.aiClock=0;
    // AI uses the same public powers and pays the same costs as the player.
    const anchors=[];
    for(const t of this.towns)if(t.team===1)anchors.push(t);
    for(const u of this.units)if(u.team===1)anchors.push(u);
    if(anchors.length&&this.mana[1]>20) {
      const c=anchors[this.rng.int(anchors.length)];let best=null,score=-Infinity;
      for(let attempt=0;attempt<16;attempt++) {
        const x=clamp(Math.floor(c.x)+this.rng.int(9)-4,2,SIZE-3),z=clamp(Math.floor(c.z)+this.rng.int(9)-4,2,SIZE-3);
        const tooNear=this.towns.some(t=>dist2(t,{x,z})<2);
        const h=this.cellHeight(x,z); if(tooNear||h<this.sea-.7)continue;
        const s=(this.flat(x,z)?0:3)+this.support(x,z)*.12-this.rng.next();
        if(s>score){score=s;best={x,z};}
      }
      if(best)this.cast('level',best.x+.5,best.z+.5,1);
    }
    const spellDelay=this.difficulty==='gentle'?95:this.difficulty==='fierce'?43:65;
    if(this.time>100&&this.time-this.lastAIspell>spellDelay&&this.towns.some(t=>t.team===0)) {
      const enemies=this.towns.filter(t=>t.team===0);
      const target=enemies[this.rng.int(enemies.length)];
      const spell=this.mana[1]>360&&this.time>250?'volcano':this.mana[1]>155?'quake':'swamp';
      if(this.cast(spell,target.x+.5,target.z+.5,1).ok)this.lastAIspell=this.time;
    }
    if(this.time>180&&this.time-this.lastAIknight>100&&this.mana[1]>190){
      if(this.cast('knight',18,18,1).ok)this.lastAIknight=this.time;
    }
    if(this.time>180&&this.population(1)>this.population(0)*.85)this.setMode(1,'fight');
    else if(this.time%100<20)this.setMode(1,'settle');
  }
  tick(dt=STEP) {
    if(this.paused||this.winner!==null)return;
    if(!finite(dt)||dt<=0||dt>1)throw new RangeError('Use a fixed time step of 0 to 1 second.');
    this.time+=dt;this.econClock+=dt;this.hazardClock+=dt;
    if(this.econClock>=.5){this.economy(this.econClock);this.econClock=0;}
    if(this.hazardClock>=1) {
      const d=this.hazardClock;this.hazardClock=0;let changed=false;
      for(let i=0;i<SIZE*SIZE;i++){
        if(this.swamp[i]>0){this.swamp[i]=Math.max(0,this.swamp[i]-d);if(this.swamp[i]===0)changed=true;}
        if(this.scars[i]>0){this.scars[i]=Math.max(0,this.scars[i]-d);if(this.scars[i]===0)changed=true;}
      }
      if(changed)this.terrainVersion++;
      this.validateHomes();
    }
    this.moveUnits(dt);this.ai(dt);
    if(this.time>8){
      const a=this.population(0),b=this.population(1);
      if(a<.2||b<.2){this.winner=a<.2&&b<.2?-1:a>=b?0:1;this.emit('end',{winner:this.winner});}
    }
  }
  serialize() {
    const data={version:SAVE_VERSION};
    for(const k of ['seed','scenario','difficulty','conquest','time','sea','armageddon','winner','nextId','mana','mode','magnets','aiClock','econClock','hazardClock','lastAIspell','lastAIknight','edits','born','kills'])data[k]=this[k];
    data.h=Array.from(this.h);data.swamp=Array.from(this.swamp);data.scars=Array.from(this.scars);
    data.towns=this.towns.map(t=>({...t}));
    data.units=this.units.map(u=>({id:u.id,team:u.team,x:u.x,z:u.z,strength:u.strength,leader:u.leader,knight:u.knight,age:u.age,facing:u.facing,path:[],goal:null,repath:0}));
    data.randomState=this.rng.state;
    return data;
  }
  static restore(data) {
    const fail=()=>{throw new Error('This save file is not valid for First Light 1.5.');};
    if(!data||data.version!==SAVE_VERSION)fail();
    if(!Array.isArray(data.h)||data.h.length!==(SIZE+1)**2||data.h.some(v=>!Number.isInteger(v)||v<0||v>MAX_HEIGHT))fail();
    for(const k of ['swamp','scars'])if(!Array.isArray(data[k])||data[k].length!==SIZE**2||data[k].some(v=>!finite(v)||v<0||v>200))fail();
    for(const k of ['time','sea','nextId','randomState'])if(!finite(data[k]))fail();
    if(data.time<0||data.time>1e8||data.sea<.3||data.sea>5.4||!Number.isInteger(data.nextId)||data.nextId<1||data.nextId>1e8)fail();
    if(!Array.isArray(data.mana)||data.mana.length!==2||data.mana.some(v=>!finite(v)||v<0||v>MAX_MANA))fail();
    if(!Array.isArray(data.mode)||data.mode.length!==2||data.mode.some(v=>!['settle','gather','fight'].includes(v)))fail();
    if(!Array.isArray(data.magnets)||data.magnets.length!==2||data.magnets.some(p=>!p||!finite(p.x)||!finite(p.z)||p.x<0||p.z<0||p.x>SIZE||p.z>SIZE))fail();
    if(!Array.isArray(data.towns)||data.towns.length>SIZE**2||!Array.isArray(data.units)||data.units.length>260)fail();
    for(let team=0;team<2;team++)if(data.units.filter(u=>u&&u.team===team).length>130)fail();
    for(let z=0;z<=SIZE;z++)for(let x=0;x<=SIZE;x++){const i=z*(SIZE+1)+x;if(x<SIZE&&Math.abs(data.h[i]-data.h[i+1])>1)fail();if(z<SIZE&&Math.abs(data.h[i]-data.h[i+SIZE+1])>1)fail();}
    const ids=new Set();
    for(const t of [...data.towns,...data.units]) {
      if(!t||![0,1].includes(t.team)||!finite(t.x)||!finite(t.z)||t.x<0||t.z<0||t.x>=SIZE||t.z>=SIZE||!Number.isInteger(t.id)||ids.has(t.id)||t.id<1||t.id>=data.nextId)fail();
      ids.add(t.id);
      const p=t.pop??t.strength;if(!finite(p)||p<0||p>1e6)fail();
    }
    for(const t of data.towns)if(!Number.isInteger(t.x)||!Number.isInteger(t.z)||![1,2,3,4].includes(t.tier)||!finite(t.emit)||t.emit<0)fail();
    for(const u of data.units)if(!finite(u.age)||!finite(u.facing)||typeof u.knight!=='boolean'||typeof u.leader!=='boolean')fail();
    if(typeof data.armageddon!=='boolean'||![null,-1,0,1].includes(data.winner))fail();
    // Saves from before the Long Dawn have no conquest field: they are free worlds.
    if(data.conquest!==undefined&&data.conquest!==null&&!(Number.isInteger(data.conquest)&&data.conquest>=0&&data.conquest<CONQUEST.length))fail();
    const w=new World({seed:data.seed,scenario:data.scenario,difficulty:data.difficulty,conquest:data.conquest??null});
    for(const k of ['time','sea','armageddon','winner','nextId','mana','mode','magnets'])w[k]=structuredClone(data[k]);
    for(const k of ['aiClock','econClock','hazardClock','lastAIspell','lastAIknight','edits','born']){if(!finite(data[k])||data[k]<0||data[k]>1e8)fail();w[k]=data[k];}
    w.kills=Array.isArray(data.kills)&&data.kills.length===2&&data.kills.every(v=>finite(v)&&v>=0)?data.kills:[0,0];
    w.h=Int8Array.from(data.h);w.swamp=Float32Array.from(data.swamp);w.scars=Float32Array.from(data.scars);
    w.towns=data.towns.map(t=>({id:t.id,team:t.team,x:t.x,z:t.z,pop:t.pop,tier:t.tier,growth:0,emit:t.emit}));
    w.units=data.units.map(u=>({id:u.id,team:u.team,x:u.x,z:u.z,px:u.x,pz:u.z,strength:u.strength,leader:u.leader,knight:u.knight,path:[],goal:null,repath:0,age:u.age,decision:0,attack:0,facing:u.facing}));
    w.rng.state=data.randomState>>>0;w.terrainVersion++;w.townVersion++;w.events=[];return w;
  }
}
