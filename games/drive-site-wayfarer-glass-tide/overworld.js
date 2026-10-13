/* Wayfarer: The Glass Tide — seeded Windward Reach, generation version 1.
 * Pure data: no saves, clock, random globals, network, or browser APIs.
 * All required sites have four-neighbour paths that clear a 7-unit body.
 */
(function (root) {
  'use strict';
  const VERSION=1, WIDTH=128, HEIGHT=96, TILE=16, DEFAULT_SEED=0x57494e44;
  const BLOCKED=new Set(['~','^']), TERRAIN=new Set(['.',':','s',',','d','~','=','^']);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function normalizeSeed(value) {
    if(typeof value==='number')return Number.isFinite(value)?Math.trunc(value)>>>0:DEFAULT_SEED;
    if(typeof value!=='string')return DEFAULT_SEED;
    const text=value.trim().normalize('NFC').slice(0,128);if(!text)return DEFAULT_SEED;
    if(/^[+-]?\d+$/.test(text)){const n=Number(text);if(Number.isSafeInteger(n))return n>>>0;}
    let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;
  }
  function rng(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function hash(x,y,seed){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+(seed|0);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
  function noise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v);const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);return (a+(b-a)*s)*(1-t)+(c+(d-c)*s)*t;}
  function create(value) {
    const seed=normalizeSeed(value),rand=rng(seed),jitter=(n,r)=>n+Math.floor(rand()*(r*2+1))-r;
    const z={id:'overworld',name:'The Windward Reach',subtitle:'Old roads beneath a restless sky',w:WIDTH,h:HEIGHT,tile:TILE,seed,generationVersion:VERSION,tiles:[],props:[],objects:[],groups:[],exits:[],blockers:[],spawn:{x:224,y:1328},landmarks:[],biomes:{tiles:[],legend:{c:{id:'coast',name:'Saltwind Coast',color:'#b9b58b'},w:{id:'woodland',name:'Whisperwood',color:'#5e826a'},h:{id:'highlands',name:'The Grey Heights',color:'#838a85'},m:{id:'meadow',name:'Windgrass Downs',color:'#8c9c6c'},r:{id:'water',name:'The Silver Channels',color:'#426d80'}}}};
    const grid=Array.from({length:HEIGHT},()=>Array(WIDTH).fill('.')),biome=Array.from({length:HEIGHT},()=>Array(WIDTH).fill('m'));
    const reserved=new Uint8Array(WIDTH*HEIGHT),road=new Uint8Array(WIDTH*HEIGHT),id=(x,y)=>y*WIDTH+x;
    const anchors={
      coast:{x:14,y:83},refuge:{x:jitter(94,6),y:jitter(27,4)},spire:{x:jitter(36,6),y:jitter(14,3)},
      westBeacon:{x:jitter(32,5),y:jitter(48,4)},eastBeacon:{x:jitter(100,5),y:jitter(66,5)},waycamp:{x:jitter(65,5),y:jitter(50,4)}
    };
    const riverPhase=rand()*6.283,coastPhase=rand()*6.283;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const height=noise(x/15,y/15,seed^0xabc921)*.58+noise(x/6,y/6,seed^0x457a)*.25+(1-y/HEIGHT)*.17;
      const damp=noise(x/13+41,y/13-12,seed^0x2244),coast=81+noise(x/18,3,seed)*7+Math.sin(x/17+coastPhase)*3;
      const west=5+Math.sin(y/10+coastPhase)*2+noise(1,y/8,seed^0xfaded)*3;
      const channel=59+Math.sin(y/13+riverPhase)*4+Math.sin(y/6+riverPhase)*1.5;
      const branch=87+Math.sin(y/10+riverPhase)*4;
      let terrain='.',b='m';
      if(x<2||x>=WIDTH-2||y<2||y>=HEIGHT-2||x<west||y>coast||(Math.abs(x-channel)<1.7)||(y>54&&Math.abs(x-branch)<1.8)) {terrain='~';b='r';}
      else if(y<32&&height>.57||y<12&&height>.42||x>112&&height>.61){terrain='^';b='h';}
      else if(y<30||height>.62){terrain='d';b='h';}
      else if(y>coast-7||x<west+5){terrain=',';b='c';}
      else if(damp>.57){terrain='.';b='w';}
      grid[y][x]=terrain;biome[y][x]=b;
    }
    // Small seeded lakes have their own shore. Roads can bridge them.
    for(let k=0;k<3;k++){
      const cx=jitter([21,77,109][k],4),cy=jitter([34,73,46][k],4),rx=3+Math.floor(rand()*3),ry=3+Math.floor(rand()*2);
      for(let y=Math.max(2,cy-ry-1);y<=Math.min(HEIGHT-3,cy+ry+1);y++)for(let x=Math.max(2,cx-rx-1);x<=Math.min(WIDTH-3,cx+rx+1);x++){
        const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<1){grid[y][x]='~';biome[y][x]='r';}else if(d<1.6&&grid[y][x]!=='~'){grid[y][x]=',';biome[y][x]='c';}
      }
    }
    function reserve(cx,cy,r){for(let y=Math.max(2,cy-r);y<=Math.min(HEIGHT-3,cy+r);y++)for(let x=Math.max(2,cx-r);x<=Math.min(WIDTH-3,cx+r);x++)if(Math.hypot(x-cx,y-cy)<=r+.5)reserved[id(x,y)]=1;}
    function clearing(p,r=5,material=':'){
      reserve(p.x,p.y,r+2);
      for(let y=Math.max(2,p.y-r);y<=Math.min(HEIGHT-3,p.y+r);y++)for(let x=Math.max(2,p.x-r);x<=Math.min(WIDTH-3,p.x+r);x++)if(Math.hypot(x-p.x,y-p.y)<=r+.35){grid[y][x]=Math.hypot(x-p.x,y-p.y)<r-1.5?material:'.';if(biome[y][x]==='r')biome[y][x]='c';}
    }
    const landmark=(key,name,kind,fastTravel)=>{const p=anchors[key];z.landmarks.push({id:key,name,kind,x:p.x*TILE,y:p.y*TILE,fastTravel:!!fastTravel});clearing(p,key==='spire'?7:6,key==='spire'||kind==='beacon'?'s':':');};
    landmark('coast','Larkspur Landing','coast',true);landmark('refuge','Windfall Refuge','refuge',true);landmark('spire','Stormglass Spire','spire',true);landmark('westBeacon','The Western Beacon','beacon',false);landmark('eastBeacon','The Eastern Beacon','beacon',false);landmark('waycamp','The Crosswind Camp','camp',true);

    // Weighted four-neighbour A*. There is one fixed-size search per road.
    // Water and peaks are expensive to cross. A crossing becomes a bridge or pass.
    function findRoad(a,b){
      const count=WIDTH*HEIGHT,start=id(a.x,a.y),goal=id(b.x,b.y),cost=new Float64Array(count);cost.fill(Infinity);
      const prev=new Int32Array(count);prev.fill(-1);const closed=new Uint8Array(count),heap=[];let serial=0;
      const less=(a,b)=>a.f<b.f||a.f===b.f&&a.seq<b.seq;
      const push=node=>{heap.push(node);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
      const pop=()=>{const out=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const a=i*2+1,b=a+1;if(a>=heap.length)break;const j=b<heap.length&&less(heap[b],heap[a])?b:a;if(!less(heap[j],heap[i]))break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return out;};
      cost[start]=0;push({i:start,f:0,seq:serial++});let expanded=0;
      while(heap.length&&expanded<count){const node=pop(),i=node.i;if(closed[i])continue;closed[i]=1;expanded++;if(i===goal)break;const x=i%WIDTH,y=(i/WIDTH)|0;
        for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<3||xx>WIDTH-4||yy<3||yy>HEIGHT-4)continue;const ni=id(xx,yy);if(closed[ni])continue;const t=grid[yy][xx],step=t==='~'?5.5:t==='^'?12:t==='d'?1.25:t==='s'||t===':'||t==='='?.95:1;
          const next=cost[i]+step+hash(xx,yy,seed)*.04;if(next>=cost[ni])continue;cost[ni]=next;prev[ni]=i;push({i:ni,f:next+(Math.abs(xx-b.x)+Math.abs(yy-b.y))*.94,seq:serial++});}
      }
      if(!closed[goal])throw new Error('The road search did not reach its fixed destination.');
      const points=[];for(let i=goal;i>=0;i=prev[i]){points.push({x:i%WIDTH,y:(i/WIDTH)|0});if(i===start)break;}return points.reverse();
    }
    const roadGraph=[];
    function carveRoad(a,b,label){
      const points=findRoad(a,b);for(const p of points){reserve(p.x,p.y,4);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=p.x+dx,y=p.y+dy;if(x<2||x>=WIDTH-2||y<2||y>=HEIGHT-2)continue;const t=grid[y][x];grid[y][x]=t==='~'||t==='='?'=':t==='^'||t==='s'?'s':':';road[id(x,y)]=1;}}
      roadGraph.push({id:label,from:{x:a.x*TILE,y:a.y*TILE},to:{x:b.x*TILE,y:b.y*TILE},length:points.length});
    }
    // A perimeter loop and three cross-country roads form alternative routes.
    const edges=[['coast','westBeacon'],['westBeacon','spire'],['spire','refuge'],['refuge','eastBeacon'],['eastBeacon','coast'],['westBeacon','waycamp'],['waycamp','eastBeacon'],['waycamp','refuge'],['spire','waycamp']];
    for(const [a,b]of edges)carveRoad(anchors[a],anchors[b],a+'-'+b);
    function connect(p,label){let nearest=null,best=Infinity;for(const a of Object.values(anchors)){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<best){best=d;nearest=a;}}carveRoad(nearest,p,label);}
    function object(id,type,p,label,extra={}){z.objects.push({id,type,x:p.x*TILE,y:p.y*TILE,label,...extra});}
    function exit(id,p,label,target,tx,ty,extra={}){z.exits.push({id,type:'exit',x:p.x*TILE,y:p.y*TILE,label,target,tx,ty,...extra});}
    exit('owCoast',anchors.coast,'Sail back to Larkspur Quay','quay',512,560);
    exit('owRefuge',anchors.refuge,'Enter Windfall Refuge','refuge',480,650);
    exit('owSpire',anchors.spire,'Enter Stormglass Spire','spire',512,960,{requiresBeacons:true});
    object('windWest','survey',anchors.westBeacon,'Align the Western Beacon',{order:0,group:'reachWestGuard'});
    object('windEast','survey',anchors.eastBeacon,'Align the Eastern Beacon',{order:1,group:'reachEastGuard'});
    object('reachCamp','camp',anchors.waycamp,'Rest at the crosswind lantern');
    const supplySites=[
      {id:'reachSunleaf',key:'sunleafGrove',name:'Sunleaf Hollow',p:{x:jitter(46,3),y:jitter(68,3)},type:'gather',label:'Gather wind-grown sunleaf',data:{material:'herb',amount:3}},
      {id:'reachCopper',key:'copperShelf',name:'The Copper Shelf',p:{x:jitter(84,3),y:jitter(12,2)},type:'gather',label:'Collect exposed copper',data:{material:'ore',amount:3}},
      {id:'reachSkyCache',key:'skyCache',name:'The Courier’s Cache',p:{x:jitter(111,3),y:jitter(42,3)},type:'chest',label:'Open the sky courier’s chest',data:{loot:{shard:3,tonic:1,tea:1},secret:true}},
      {id:'reachChartstone',key:'chartstone',name:'The First Survey',p:{x:jitter(21,3),y:jitter(24,3)},type:'lore',label:'Read the first survey stone',data:{title:'Two lights for a restless sky',text:'The western beacon reads the sea. The eastern beacon reads the sky. Align both signals before you climb Stormglass Spire.'}},
      {id:'reachOldTrail',key:'oldTrail',name:'The Lost Causeway',p:{x:jitter(75,3),y:jitter(83,2)},type:'lore',label:'Read the causeway marker',data:{title:'A road above the tide',text:'These roads bend around the water. Their bridges still hold. The refuge keeps a lamp for travellers caught between the sea and the storm.'}}
    ];
    for(const site of supplySites){clearing(site.p,4,site.type==='lore'?'s':':');connect(site.p,site.key);object(site.id,site.type,site.p,site.label,site.data);z.landmarks.push({id:site.key,name:site.name,kind:site.type,x:site.p.x*TILE,y:site.p.y*TILE,fastTravel:false});}
    const encounters=[
      {id:'reachWestGuard',p:{x:anchors.westBeacon.x,y:anchors.westBeacon.y+3},enemies:['gustling','mite','gustling']},
      {id:'reachEastGuard',p:{x:anchors.eastBeacon.x,y:anchors.eastBeacon.y+3},enemies:['coilkeeper','gustling']},
      {id:'reachSaltProwlers',p:{x:jitter(24,2),y:jitter(67,3)},enemies:['reedling','gustling','reedling'],optional:true},
      {id:'reachFordWatch',p:{x:jitter(69,3),y:jitter(71,2)},enemies:['spitter','gustling'],optional:true},
      {id:'reachNorthSurvey',p:{x:jitter(67,3),y:jitter(23,2)},enemies:['coilkeeper','mite'],optional:true},
      {id:'reachHighlandRoam',p:{x:jitter(37,2),y:jitter(32,2)},enemies:['gustling','sentinel'],optional:true}
    ];
    for(const e of encounters){clearing(e.p,6,':');connect(e.p,e.id);z.groups.push({id:e.id,x:e.p.x*TILE,y:e.p.y*TILE,enemies:e.enemies,level:2,...(e.optional?{optional:true}:{})});}
    // Fixed structures stand outside interaction and road centres. They are visual
    // landmarks; collision belongs to the terrain or to explicit small props.
    const prop=(type,x,y,extra={})=>z.props.push({type,x:x*TILE,y:y*TILE,...extra});
    prop('waystone',anchors.coast.x-3,anchors.coast.y-2,{variant:0});prop('lantern',anchors.coast.x+3,anchors.coast.y-2);
    prop('windmill',anchors.refuge.x+4,anchors.refuge.y-4,{variant:1});prop('house',anchors.refuge.x-4,anchors.refuge.y-3,{variant:2});
    prop('spire',anchors.spire.x,anchors.spire.y-4);prop('waystone',anchors.spire.x+5,anchors.spire.y-1,{variant:1});
    for(const key of ['westBeacon','eastBeacon']){const p=anchors[key];prop('waystone',p.x,p.y-3,{variant:key==='westBeacon'?0:1});prop('ruin',p.x-4,p.y-2);}
    prop('windmill',anchors.waycamp.x+4,anchors.waycamp.y-4);prop('bench',anchors.waycamp.x-3,anchors.waycamp.y+1);prop('lantern',anchors.waycamp.x,anchors.waycamp.y-1);
    for(const site of supplySites)if(site.type==='lore')prop('waystone',site.p.x,site.p.y-2,{variant:2});
    const safe=(x,y,r=2)=>{if(x<4||x>WIDTH-5||y<4||y>HEIGHT-5)return false;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(reserved[id(xx,yy)]||BLOCKED.has(grid[yy][xx]))return false;return true;};
    const occupied=new Uint8Array(WIDTH*HEIGHT);
    for(let y=5;y<HEIGHT-5;y+=3)for(let x=5;x<WIDTH-5;x+=3){const xx=x+Math.floor(rand()*3)-1,yy=y+Math.floor(rand()*3)-1,b=biome[yy][xx];if(!safe(xx,yy)||occupied[id(xx,yy)])continue;const n=rand(),chance=b==='w'?.7:b==='h'?.38:b==='c'?.14:.29;if(n>chance)continue;
      const type=b==='h'?(rand()>.46?'pine':'rock'):b==='c'?'rock':rand()>.26?'tree':'pine';prop(type,xx,yy,{variant:Math.floor(rand()*3)});const size=type==='rock'?14:10;z.blockers.push({x:xx*TILE-size/2,y:yy*TILE-5,w:size,h:10});reserve(xx,yy,1);occupied[id(xx,yy)]=1;
    }
    // Sparse ridges show real height without changing the passable terrain mask.
    for(let y=6;y<HEIGHT-6;y+=4)for(let x=6;x<WIDTH-6;x+=5){let peak=true;for(let yy=y-2;yy<=y+1&&peak;yy++)for(let xx=x-2;xx<=x+2;xx++)if(grid[yy][xx]!=='^'||reserved[id(xx,yy)]){peak=false;break;}if(peak)prop('peak',x,y,{variant:Math.floor(rand()*3)});}
    for(let y=4;y<HEIGHT-4;y+=4)for(let x=4;x<WIDTH-4;x+=4){if(rand()>.35||reserved[id(x,y)]||BLOCKED.has(grid[y][x]))continue;const nearWater=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>grid[y+dy][x+dx]==='~');prop(nearWater?'reeds':biome[y][x]==='h'?'crystal':'flower',x,y,{variant:Math.floor(rand()*3)});}
    // Reassert the sealed boundary after all carving and keep one source of truth.
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(x<2||x>=WIDTH-2||y<2||y>=HEIGHT-2){grid[y][x]='~';biome[y][x]='r';}
    z.tiles=grid.map(row=>row.join(''));z.biomes.tiles=biome.map(row=>row.join(''));z.roadGraph=roadGraph;
    const check=validate(z);if(!check.ok)throw new Error('Invalid Windward Reach: '+check.errors.join(' '));
    return z;
  }
  function validate(zone) {
    const errors=[],result={ok:false,errors,reachableTiles:0,checkedTargets:0,seed:zone&&zone.seed};
    if(!zone||zone.w!==WIDTH||zone.h!==HEIGHT||zone.tile!==TILE||!Array.isArray(zone.tiles)||zone.tiles.length!==HEIGHT){errors.push('The zone dimensions are invalid.');return result;}
    if(zone.tiles.some(row=>typeof row!=='string'||row.length!==WIDTH||[...row].some(t=>!TERRAIN.has(t)))){errors.push('A terrain row is invalid.');return result;}
    const inside=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=TILE*2&&y>=TILE*2&&x<(WIDTH-2)*TILE&&y<(HEIGHT-2)*TILE;
    if(!zone.spawn||zone.spawn.x!==224||zone.spawn.y!==1328){errors.push('The coast spawn moved.');return result;}
    const blocked=new Uint8Array(WIDTH*HEIGHT),index=(x,y)=>y*WIDTH+x;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){blocked[index(x,y)]=BLOCKED.has(zone.tiles[y][x])?1:0;if((x<2||x>=WIDTH-2||y<2||y>=HEIGHT-2)&&!blocked[index(x,y)])errors.push('The outer boundary is open.');}
    // Expand each collider by the actor radius. A marked cell is unavailable in
    // full, so a four-neighbour edge never clips a collider between cell centres.
    const radius=7;
    for(const b of zone.blockers||[]){if(![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.w<=0||b.h<=0){errors.push('A collider is invalid.');continue;}for(let y=Math.max(0,Math.floor((b.y-radius)/TILE));y<=Math.min(HEIGHT-1,Math.floor((b.y+b.h+radius)/TILE));y++)for(let x=Math.max(0,Math.floor((b.x-radius)/TILE));x<=Math.min(WIDTH-1,Math.floor((b.x+b.w+radius)/TILE));x++)blocked[index(x,y)]=1;}
    function stand(p){if(!p||!inside(p.x,p.y))return false;for(let y=Math.floor((p.y-radius)/TILE);y<=Math.floor((p.y+radius)/TILE);y++)for(let x=Math.floor((p.x-radius)/TILE);x<=Math.floor((p.x+radius)/TILE);x++)if(BLOCKED.has(zone.tiles[y][x]))return false;for(const b of zone.blockers||[])if(p.x+radius>b.x&&p.x-radius<b.x+b.w&&p.y+radius>b.y&&p.y-radius<b.y+b.h)return false;return true;}
    if(!stand(zone.spawn)){errors.push('The spawn does not clear the actor body.');return result;}
    const visited=new Uint8Array(WIDTH*HEIGHT),queue=new Int32Array(WIDTH*HEIGHT);let head=0,tail=0;
    const start=index(Math.floor(zone.spawn.x/TILE),Math.floor(zone.spawn.y/TILE));visited[start]=1;queue[tail++]=start;
    while(head<tail){const i=queue[head++],x=i%WIDTH,y=(i/WIDTH)|0;for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=WIDTH||yy<0||yy>=HEIGHT)continue;const ni=index(xx,yy);if(!blocked[ni]&&!visited[ni]){visited[ni]=1;queue[tail++]=ni;}}}
    result.reachableTiles=tail;
    const categories=[['object',zone.objects],['exit',zone.exits],['group',zone.groups],['landmark',zone.landmarks]];
    for(const [kind,values]of categories){if(!Array.isArray(values)){errors.push('The '+kind+' list is missing.');continue;}const ids=new Set();for(const p of values){result.checkedTargets++;if(!p||typeof p.id!=='string'||ids.has(p.id)){errors.push('A '+kind+' ID is missing or repeated.');continue;}ids.add(p.id);if(!inside(p.x,p.y)||!stand(p)||!visited[index(Math.floor(p.x/TILE),Math.floor(p.y/TILE))])errors.push('No physical path reaches '+p.id+'.');}}
    const required=['coast','refuge','spire','westBeacon','eastBeacon','waycamp'];if(required.some(id=>!(zone.landmarks||[]).some(p=>p.id===id)))errors.push('A required landmark is missing.');
    if(!Array.isArray(zone.groups)||zone.groups.length<5||zone.groups.length>7||(zone.groups||[]).some(g=>!g.id.startsWith('reach')||g.level!==2))errors.push('The finite encounter set is invalid.');
    if(!zone.biomes||!Array.isArray(zone.biomes.tiles)||zone.biomes.tiles.length!==HEIGHT||zone.biomes.tiles.some(row=>row.length!==WIDTH))errors.push('Biome data is invalid.');
    result.ok=errors.length===0;return result;
  }
  root.WayfarerWorld={VERSION,WIDTH,HEIGHT,normalizeSeed,create,validate};
})(typeof window!=='undefined'?window:globalThis);
