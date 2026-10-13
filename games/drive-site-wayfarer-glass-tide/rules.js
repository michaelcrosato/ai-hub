/* Campaign rules and versioned save migration. No renderer or mutable world cache. */
(function(root){
  'use strict';
  const D=root.WayfarerData;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
  const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const number=(v,fallback=0)=>{if(typeof v!=='number'&&typeof v!=='string')return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback;};
  const integer=(v,a,b,fallback=a)=>clamp(Math.floor(number(v,fallback)),a,b);
  const list=(v,allowed,max=256)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.length<80&&(!allowed||allowed.includes(x))))].slice(0,max):[];
  const seedValue=v=>root.WayfarerWorld?root.WayfarerWorld.normalizeSeed(v):(number(v,0x57494e44)>>>0);
  function newSeed(){if(root.crypto?.getRandomValues){const a=new Uint32Array(1);root.crypto.getRandomValues(a);return a[0];}return (Math.random()*4294967296)>>>0;}
  function fresh(seed=newSeed()){return {version:2,zone:'quay',position:{...D.zones.quay.spawn},leader:0,level:1,xp:0,sp:0,link:0,inventory:{herb:2,ore:1,shard:0,tonic:3,tea:1},equipment:{edge:false,ward:false,focus:false},party:D.heroes.map(h=>({id:h.id,hp:h.hp,mp:h.mp,rank:0})),flags:{quest:false,intro:false,relays:[],collected:[],cleared:[],read:[],seraBond:null,orrenBond:null,bossDefeated:false,complete:false,chapterTwoStarted:false,maraMet:false,windBeacons:[],loomDefeated:false,chapterTwoComplete:false},world:{version:1,seed:seedValue(seed),discovered:[],explored:[]},checkpoint:{zone:'quay',x:D.zones.quay.spawn.x,y:D.zones.quay.spawn.y},stats:{seconds:0,kills:0,crafts:0,rests:0,defeats:0,damageTaken:0,links:0,arts:0},options:{difficulty:'normal',autoAttack:false,music:true,volume:.6,reduceMotion:false,zoom:1,tactics:'balanced'}};}
  function isComplete(s){return s.flags.chapterTwoStarted?s.flags.chapterTwoComplete:s.flags.complete;}
  function rankCap(s){return s.flags.chapterTwoStarted?5:3;}
  function maxHp(s,i){return D.heroes[i].hp+(s.level-1)*14+(s.equipment.ward?25:0);}
  function maxMp(s,i){return D.heroes[i].mp+(s.level-1)*5+(i===2?s.party[i].rank*8:0)+(s.equipment.focus?15:0);}
  function attack(s,i){return D.heroes[i].attack+(s.level-1)*2+s.party[i].rank*2+(s.equipment.edge?4+(s.party[0].rank>0?2:0):0)+(s.equipment.focus?3:0);}
  function nextXp(s){return 80+s.level*45;}
  function award(s,xp,kills){s.xp+=xp;s.stats.kills+=kills;s.sp=Math.min(99,s.sp+2);let levels=0;while(s.xp>=nextXp(s)&&s.level<10){s.xp-=nextXp(s);s.level++;s.sp=Math.min(99,s.sp+2);levels++;}s.party.forEach((p,i)=>{p.hp=Math.min(maxHp(s,i),Math.max(p.hp,Math.round(maxHp(s,i)*.35))+20+levels*14);p.mp=Math.min(maxMp(s,i),p.mp+12+levels*5);});return levels;}
  function canCraft(s,id){const r=D.recipes.find(r=>r.id===id);if(!r)return{ok:false,reason:'Unknown recipe.'};if(r.chapter===2&&!s.flags.chapterTwoStarted)return{ok:false,reason:'Follow the new signal to learn this recipe.'};if(r.unique&&s.equipment[id])return{ok:false,reason:'Already equipped.'};for(const[m,n]of Object.entries(r.cost))if((s.inventory[m]||0)<n)return{ok:false,reason:'Find more '+D.materialNames[m].toLowerCase()+'.'};return{ok:true,recipe:r};}
  function craft(s,id){const c=canCraft(s,id);if(!c.ok)return c;const r=c.recipe;for(const[m,n]of Object.entries(r.cost))s.inventory[m]-=n;if(r.unique){s.equipment[id]=true;if(id==='ward')s.party.forEach(p=>p.hp+=25);if(id==='focus')s.party.forEach(p=>p.mp+=15);}else{for(const[m,n]of Object.entries(r.output))s.inventory[m]=Math.min(999,(s.inventory[m]||0)+n*(id==='tonic'&&s.party[1].rank>=2?2:1));}s.stats.crafts++;return{ok:true,name:r.name};}
  function upgrade(s,i){if(!Number.isInteger(i)||i<0||i>=s.party.length)return{ok:false,reason:'Choose a companion.'};if(s.sp<2)return{ok:false,reason:'You need 2 skill points.'};if(s.party[i].rank>=rankCap(s))return{ok:false,reason:'This skill is fully learned.'};s.sp-=2;s.party[i].rank++;if(i===2)s.party[i].mp+=8;return{ok:true};}
  function heal(s,kind='tonic'){if(!['tonic','tea'].includes(kind))return{ok:false,reason:'Choose a recovery item.'};if((s.inventory[kind]||0)<=0)return{ok:false,reason:'No '+(D.materialNames[kind]||kind)+' left.'};if(kind==='tea'){if(s.party.every((p,i)=>p.mp>=maxMp(s,i)))return{ok:false,reason:'The party has full energy.'};s.inventory.tea--;s.party.forEach((p,i)=>p.mp=Math.min(maxMp(s,i),p.mp+40));return{ok:true};}if(s.party.every((p,i)=>p.hp>=maxHp(s,i)))return{ok:false,reason:'The party has full health.'};s.inventory.tonic--;s.party.forEach((p,i)=>p.hp=Math.min(maxHp(s,i),p.hp>0?p.hp+70+s.party[1].rank*6:35));return{ok:true};}
  function rest(s){s.party.forEach((p,i)=>{p.hp=maxHp(s,i);p.mp=maxMp(s,i);});s.stats.rests++;}
  function addLoot(s,loot){for(const[m,n]of Object.entries(loot))if(own(s.inventory,m))s.inventory[m]=Math.min(999,s.inventory[m]+Math.max(0,number(n)));}
  function legacySeed(raw){let h=0x57494e44;const text=String(raw.zone)+'|'+number(raw.level,1)+'|'+number(raw.stats?.kills)+'|'+list(raw.flags?.relays).join(',');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function validSave(raw){
    if(!record(raw)||![1,2].includes(raw.version)||!own(D.zones,raw.zone)||!Array.isArray(raw.party)||raw.party.length!==3||raw.party.some(p=>!record(p))||!record(raw.flags)||!record(raw.inventory))return null;
    const seed=raw.version===2&&record(raw.world)?seedValue(number(raw.world.seed,0x57494e44)):legacySeed(raw);
    const s=fresh(seed);s.zone=raw.zone;s.level=integer(raw.level,1,10,1);s.xp=integer(raw.xp,0,100000);s.sp=integer(raw.sp,0,99);s.link=clamp(number(raw.link),0,100);s.leader=integer(raw.leader,0,2);
    for(const k of Object.keys(s.inventory))s.inventory[k]=integer(raw.inventory[k],0,999);
    for(const k of Object.keys(s.equipment))s.equipment[k]=raw.equipment?.[k]===true;
    for(const k of ['quest','intro','bossDefeated','complete','chapterTwoStarted','maraMet','loomDefeated','chapterTwoComplete'])s.flags[k]=raw.flags[k]===true;
    s.flags.relays=list(raw.flags.relays,['reedRelay','stoneRelay','skyRelay'],3);
    s.flags.windBeacons=list(raw.flags.windBeacons,['windWest','windEast'],2);
    for(const k of ['collected','cleared','read'])s.flags[k]=list(raw.flags[k]);
    s.flags.seraBond=['shelter','courage'].includes(raw.flags.seraBond)?raw.flags.seraBond:null;
    s.flags.orrenBond=['trust','truth'].includes(raw.flags.orrenBond)?raw.flags.orrenBond:null;
    // Older completed saves stay at their ending until the player chooses Chapter II.
    if(s.flags.chapterTwoStarted){s.flags.complete=true;s.flags.quest=true;s.flags.intro=true;s.flags.bossDefeated=true;s.flags.relays=['reedRelay','stoneRelay','skyRelay'];}
    if(!s.flags.chapterTwoStarted&&['overworld','refuge','spire'].includes(s.zone))s.zone='quay';
    if(raw.version===2&&record(raw.world)){
      s.world.discovered=list(raw.world.discovered,null,32);
      s.world.explored=Array.isArray(raw.world.explored)?[...new Set(raw.world.explored.filter(n=>Number.isInteger(n)&&n>=0&&n<192))]:[];
    }
    raw.party.forEach((p,i)=>{s.party[i].rank=integer(p.rank,0,rankCap(s));s.party[i].hp=clamp(number(p.hp),0,maxHp(s,i));s.party[i].mp=clamp(number(p.mp),0,maxMp(s,i));});
    for(const k of Object.keys(s.stats))s.stats[k]=clamp(number(raw.stats?.[k]),0,1e8);
    const opt=record(raw.options)?raw.options:{};s.options.difficulty=opt.difficulty==='story'?'story':'normal';s.options.autoAttack=opt.autoAttack===true;s.options.music=opt.music!==false;s.options.volume=clamp(number(opt.volume,.6),0,1);s.options.reduceMotion=opt.reduceMotion===true;s.options.zoom=clamp(number(opt.zoom,1),.75,1.5);s.options.tactics=['balanced','focus','guard'].includes(opt.tactics)?opt.tactics:'balanced';
    const z=D.zones[s.zone],pos=s.zone===raw.zone&&record(raw.position)?raw.position:z.spawn;
    s.position={x:clamp(number(pos.x,z.spawn.x),24,z.w*16-24),y:clamp(number(pos.y,z.spawn.y),24,z.h*16-24)};
    if(record(raw.checkpoint)&&own(D.zones,raw.checkpoint.zone)){
      const c=raw.checkpoint,cz=D.zones[c.zone];
      if(s.flags.chapterTwoStarted||!['overworld','refuge','spire'].includes(c.zone))s.checkpoint={zone:c.zone,x:clamp(number(c.x,cz.spawn.x),24,cz.w*16-24),y:clamp(number(c.y,cz.spawn.y),24,cz.h*16-24)};
    }
    if(!s.party.some(p=>p.hp>0))s.party.forEach((p,i)=>p.hp=Math.round(maxHp(s,i)*.5));
    if(s.party[s.leader].hp<=0)s.leader=s.party.findIndex(p=>p.hp>0);
    return s;
  }
  function discover(s,z,x,y){
    if(z.id!=='overworld'||!s.flags.chapterTwoStarted)return[];
    const cols=16,cx=Math.floor(x/128),cy=Math.floor(y/128),fresh=[];
    for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++)if(xx>=0&&xx<cols&&yy>=0&&yy<12){const key=yy*cols+xx;if(!s.world.explored.includes(key))s.world.explored.push(key);}
    for(const p of z.landmarks||[])if(Math.hypot(x-p.x,y-p.y)<105&&!s.world.discovered.includes(p.id)){s.world.discovered.push(p.id);fresh.push(p);}
    return fresh;
  }
  function objective(s){
    const f=s.flags;
    if(f.chapterTwoStarted){if(f.chapterTwoComplete)return'The sky roads are open. Explore the Windward Reach.';if(f.loomDefeated)return'Restore the Skyheart at the top of Stormglass Spire.';if(!f.maraMet)return'Find Mara at Windfall Refuge. Open the map for the route.';if(f.windBeacons.length<2)return'Chart the west and east wind beacons. '+f.windBeacons.length+' / 2';return'Enter Stormglass Spire. Stop the Tempest Loom.';}
    if(f.complete)return'The tide is quiet. A new signal waits at the receiver.';if(f.bossDefeated)return'Restore the Heart of the Tide.';if(!f.quest)return'Speak with Keeper Ada in the village square.';if(f.relays.length<3)return'Restore the three tide relays. '+f.relays.length+' / 3';return'Enter the observatory. Stop the Glass Warden.';
  }
  root.WayfarerRules={fresh,isComplete,rankCap,maxHp,maxMp,attack,nextXp,award,canCraft,craft,upgrade,heal,rest,addLoot,validSave,discover,objective};
})(typeof window!=='undefined'?window:globalThis);
