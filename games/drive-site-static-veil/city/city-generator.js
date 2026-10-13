/* Meridian City Kit 1.0. Deterministic city data. Coordinates are METRES.
 * Runtime conversion: 16 my-3D2dge world units = 1 metre. Floor height = 4 m.
 * Metadata is cheap; floor plans and runtime collision are built on demand.
 * Pure module: usable in a browser, Worker, or Node. No renderer dependency. */
(function(root){
 'use strict';
 const BLOCK=125,FLOOR_H=4,UNIT=16,PLAN_TILE=2,VERSION=1;
 const DISTRICTS=Object.freeze([
  {id:'tideward',name:'Tideward',short:'TD',use:'Harbour / repair / freight',type:'industrial',color:'#65d9c4',surface:'#253e48',anchor:[.28,.65],density:.78,min:2,max:10,landmark:9,sub:['Lower Quays','Cable Basin'],names:['Saltworks','Breakwater','Signal House','Dock Nine','Tide Exchange'],roof:'service'},
  {id:'lattice',name:'Lattice',short:'LT',use:'Homes / markets / transit',type:'residential',color:'#f2b969',surface:'#51434d',anchor:[.34,.25],density:.94,min:6,max:28,landmark:32,sub:['Market Steps','Lantern Courts'],names:['Lantern Court','Common House','Morrow Apartments','East Stair','Market Stack'],roof:'garden'},
  {id:'crownline',name:'Crownline',short:'CR',use:'Finance / records / data',type:'office',color:'#9ac6ff',surface:'#2e435d',anchor:[.55,.38],density:.9,min:22,max:64,landmark:88,sub:['Registry Square','Cloud Exchange'],names:['Registry Tower','Orison Annex','Glass Archive','Index House','Cloud Exchange'],roof:'relay'},
  {id:'furnace',name:'Furnace Ward',short:'FW',use:'Power / factories / worker services',type:'industrial',color:'#f38e6b',surface:'#51413c',anchor:[.79,.67],density:.66,min:2,max:8,landmark:12,sub:['Coil Yards','Shift Row'],names:['Coil Works','Shift House','Heat Exchange','Arc Foundry','Line Assembly'],roof:'service'},
  {id:'verdant',name:'Verdant Reach',short:'VR',use:'Clinics / gardens / housing',type:'garden',color:'#b5db89',surface:'#354b46',anchor:[.8,.26],density:.63,min:5,max:24,landmark:40,sub:['Clinic Terraces','Reservoir Heights'],names:['Stillwater Clinic','Garden House','Reservoir Tower','Verge Research','Canopy Residence'],roof:'garden'},
  {id:'surge',name:'Surge Ward',short:'SW',use:'Salvage / trade / reused blocks',type:'market',color:'#dba0dd',surface:'#493d58',anchor:[.51,.75],density:.91,min:3,max:16,landmark:18,sub:['Sunken Arcade','Drydock Commons'],names:['Open Circuit','Salvage Court','Dry Arcade','Common Roof','Second Life'],roof:'market'}
 ]);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function hash(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
 function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function random(seed,...parts){return rng(hash(seed+':'+parts.join(':')))();}
 function defaultConfig(){return{version:VERSION,seed:'MERIDIAN-09',sizeKm:8,density:1,height:1,bridges:true,rules:Object.fromEntries(DISTRICTS.map(d=>[d.id,{density:d.density,min:d.min,max:d.max}])),zones:{},buildings:{}};}
 function normalize(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Use a city configuration object.');
  if(input.version!==undefined&&input.version!==VERSION)throw new Error('This city file uses an unsupported version.');
  const o=defaultConfig();o.seed=String(input.seed||o.seed).trim().slice(0,64)||'MERIDIAN-09';
  o.sizeKm=[4,8,12].includes(Number(input.sizeKm))?Number(input.sizeKm):8;
  for(const[k,a,b]of[['density',.35,1.1],['height',.5,1.5]])if(Number.isFinite(+input[k]))o[k]=clamp(+input[k],a,b);
  o.bridges=input.bridges!==false;
  for(const d of DISTRICTS){const r=input.rules?.[d.id];if(!r)continue;const min=clamp(Math.round(+r.min||d.min),2,90),max=clamp(Math.round(+r.max||d.max),min,96);o.rules[d.id]={density:clamp(Number.isFinite(+r.density)?+r.density:d.density,.2,1),min,max};}
  const n=o.sizeKm*1000/BLOCK;
  for(const[k,v]of Object.entries(input.zones||{})){const m=/^(\d+),(\d+)$/.exec(k);if(m&&+m[1]<n&&+m[2]<n&&DISTRICTS.some(d=>d.id===v))o.zones[k]=v;}
  for(const[k,v]of Object.entries(input.buildings||{})){if(!/^b\d+_\d+_[0-3]$/.test(k)||!v||typeof v!=='object')continue;const b={};if(Number.isFinite(+v.floors))b.floors=clamp(Math.round(+v.floors),2,100);if(['industrial','residential','office','garden','market'].includes(v.type))b.type=v.type;if(Object.keys(b).length)o.buildings[k]=b;}
  return o;
 }
 class City{
  constructor(config){this.config=normalize(config||defaultConfig());this.seed=this.config.seed;this.size=this.config.sizeKm*1000;this.n=this.size/BLOCK;this.cache=new Map();this.maxCache=72;this.hits=0;this.misses=0;this.landmarks=DISTRICTS.map(d=>this.anchor(d.id));}
  district(id){return DISTRICTS.find(d=>d.id===id)||DISTRICTS[0];}
  terrain(bx,by){
   if(bx<0||by<0||bx>=this.n||by>=this.n)return'outside';
   const u=(bx+.5)/this.n,v=(by+.5)/this.n;
   const coast=.115+.045*Math.sin(v*9)+.028*Math.sin(v*22);
   if(u<coast||v>.96-.055*Math.sin(u*5))return'water';
   const river=.628+.026*Math.sin(v*8);
   if(Math.abs(u-river)<.013&&v>.06&&v<.9)return by%8===3?'bridge':'water';
   return'land';
  }
  zone(bx,by){
   const over=this.config.zones[bx+','+by];if(over)return this.district(over);
   const u=(bx+.5)/this.n,v=(by+.5)/this.n;let best=null,score=Infinity;
   for(const d of DISTRICTS){const j=(random(this.seed,'zone',d.id,Math.floor(bx/3),Math.floor(by/3))-.5)*.009;const dd=(u-d.anchor[0])**2+(v-d.anchor[1])**2+j;if(dd<score){score=dd;best=d;}}
   return best;
  }
  anchor(id){const d=this.district(id),x=Math.floor(d.anchor[0]*this.n),y=Math.floor(d.anchor[1]*this.n);for(let r=0;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(this.terrain(x+dx,y+dy)==='land')return{district:id,bx:x+dx,by:y+dy,x:(x+dx)*BLOCK+BLOCK/2,y:(y+dy)*BLOCK+BLOCK/2};throw new Error('No district anchor.');}
  block(bx,by){
   bx=Math.floor(bx);by=Math.floor(by);const key=bx+','+by;
   if(this.cache.has(key)){const b=this.cache.get(key);this.cache.delete(key);this.cache.set(key,b);this.hits++;return b;}
   this.misses++;const d=this.zone(bx,by),terrain=this.terrain(bx,by),r=rng(hash(this.seed+':block:'+key));
   const b={id:key,bx,by,x:bx*BLOCK,y:by*BLOCK,size:BLOCK,district:d.id,terrain,subdistrict:d.sub[((bx+by)%2+2)%2],buildings:[],links:[],park:false,road:bx%8===0||by%8===0?18:12};
   if(terrain==='land'){
    const rule=this.config.rules[d.id],featured=this.landmarks.some(a=>a.bx===bx&&a.by===by),density=rule.density*this.config.density;
    b.park=!featured&&r()>.97&&d.id==='verdant';
    const outer=b.road/2+5,alley=8,lot=(BLOCK-2*outer-alley)/2,wide=!featured&&d.type==='industrial'&&r()<.48;
    for(let k=0;k<4;k++){
     if(wide&&k%2)continue;
     const occupied=featured||r()<density;if(!occupied||b.park)continue;
     const col=k%2,row=Math.floor(k/2),margin=3+Math.floor(r()*4),factor=d.id==='verdant'?.78:1,w=Math.floor(((wide?lot*2+alley:lot)-margin*2)*factor/PLAN_TILE)*PLAN_TILE,depth=Math.floor((lot-margin*2-r()*5)*factor/PLAN_TILE)*PLAN_TILE;
     const x=b.x+outer+col*(lot+alley)+margin,y=b.y+outer+row*(lot+alley)+margin;
     const floors=clamp(Math.round((rule.min+r()**1.35*(rule.max-rule.min))*this.config.height),2,96),id=`b${bx}_${by}_${k}`;
     const o={id,bx,by,slot:k,x,y,w,d:depth,floors,floorH:FLOOR_H,district:d.id,type:d.type,accent:d.color,palette:d.surface,variant:Math.floor(r()*9999),name:d.names[Math.floor(r()*d.names.length)]+' '+(10+Math.floor(r()*89)),subdistrict:b.subdistrict,roof:d.roof,landmark:featured&&k===0,links:[]};
     if(o.landmark){o.floors=clamp(Math.round(d.landmark*this.config.height),2,96);o.name=d.id==='tideward'?'The Ninth Relay':d.id==='crownline'?'Orison Exchange':d.id==='lattice'?'Lantern Commons':d.id==='furnace'?'Coil Works 01':d.id==='verdant'?'Canopy Institute':'Drydock Commons';}
     Object.assign(o,this.config.buildings[id]||{});o.height=o.floors*FLOOR_H;o.door={x:x+w/2,y:y+depth+1.25};b.buildings.push(o);
    }
    if(this.config.bridges&&['lattice','surge','verdant','tideward'].includes(d.id)){
     for(const row of[0,1]){const a=b.buildings.find(q=>q.slot===row*2),z=b.buildings.find(q=>q.slot===row*2+1);if(!a||!z||(!featured&&r()>.35))continue;
      // A shared roof level is an explicit generation constraint. User height overrides win.
      if(!this.config.buildings[z.id]?.floors)z.floors=a.floors;
      z.height=z.floors*FLOOR_H;if(a.floors!==z.floors)continue;
      const cy=Math.max(a.y,z.y)+Math.min(a.d,z.d)*.55,link={id:'sky_'+a.id,a:a.id,b:z.id,x:a.x+a.w-2,y:cy-2,w:z.x-(a.x+a.w)+4,d:4,z:a.height,floor:a.floors};
      b.links.push(link);a.links.push(link.id);z.links.push(link.id);
     }
    }
   }
   this.cache.set(key,b);while(this.cache.size>this.maxCache)this.cache.delete(this.cache.keys().next().value);return b;
  }
  building(id){const m=/^b(\d+)_(\d+)_([0-3])$/.exec(id||'');return m?this.block(+m[1],+m[2]).buildings.find(b=>b.id===id)||null:null;}
  nearby(x,y,radius=1){const bx=Math.floor(x/BLOCK),by=Math.floor(y/BLOCK),out=[];for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(bx+dx<0||by+dy<0||bx+dx>=this.n||by+dy>=this.n)continue;out.push(this.block(bx+dx,by+dy));}return out;}
  floor(building,index){return floorPlan(this,building,index);}
  export(){return JSON.parse(JSON.stringify(this.config));}
  summary(){
   const atlas=[],tot={envelopeM2:this.size*this.size,landM2:0,footprintM2:0,grossFloorM2:0,roofM2:0,buildings:0,floors:0,bridges:0,highestM:0,blocks:this.n*this.n,landBlocks:0,waterBlocks:0},districts=Object.fromEntries(DISTRICTS.map(d=>[d.id,{blocks:0,buildings:0,floors:0,highestM:0,grossFloorM2:0}]));
   for(let y=0;y<this.n;y++)for(let x=0;x<this.n;x++){
    const b=this.block(x,y),st=districts[b.district];atlas.push({x,y,d:DISTRICTS.findIndex(d=>d.id===b.district),t:b.terrain==='water'?0:b.terrain==='bridge'?2:1,h:Math.max(0,...b.buildings.map(q=>q.height)),n:b.buildings.length,p:b.park?1:0});
    if(b.terrain==='water'){tot.waterBlocks++;continue;}tot.landM2+=BLOCK*BLOCK;tot.landBlocks++;st.blocks++;
    for(const a of b.buildings){const area=a.w*a.d;tot.buildings++;tot.floors+=a.floors;tot.footprintM2+=area;tot.roofM2+=area;tot.grossFloorM2+=area*a.floors;tot.highestM=Math.max(tot.highestM,a.height);st.buildings++;st.floors+=a.floors;st.highestM=Math.max(st.highestM,a.height);st.grossFloorM2+=area*a.floors;}tot.bridges+=b.links.length;
   }
   tot.openGroundM2=tot.landM2-tot.footprintM2;return{version:VERSION,seed:this.seed,size:this.size,n:this.n,totals:tot,districts,atlas};
  }
 }
 function floorPlan(city,b,index){
  if(!b||!Number.isInteger(index)||index<0||index>b.floors)throw new Error('That floor does not exist.');
  const w=Math.floor(b.w/PLAN_TILE),h=Math.floor(b.d/PLAN_TILE),cells=new Uint8Array(w*h),roof=index===b.floors,rand=rng(hash(city.seed+':floor:'+b.id+':'+index)),at=(x,y)=>y*w+x,put=(x,y,v=1)=>{if(x>=0&&y>=0&&x<w&&y<h)cells[at(x,y)]=v;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)put(x,y);
  const mid=Math.floor(w/2),cy=Math.floor(h/2),ports={entry:{x:mid,y:h-2},up:{x:mid-2,y:cy-2},down:{x:mid-2,y:cy+2},lift:{x:mid+2,y:cy}};
  if(!roof){
   // One public spine, cross corridors, and doors to every room.
   for(let y=2;y<h-2;y++){if(y>=cy-3&&y<=cy+3)continue;put(mid-2,y);put(mid+2,y);}
   for(let y=4;y<h-3;y+=5){for(let x=1;x<mid-2;x++)put(x,y);for(let x=mid+3;x<w-1;x++)put(x,y);put(mid-3,y,0);put(mid+3,y,0);}
   for(let y=3;y<h-2;y+=5){put(mid-2,y,0);put(mid+2,y,0);}
   for(let y=cy-3;y<=cy+3;y++)for(let x=mid-3;x<=mid+3;x++)put(x,y,0);
   for(let y=1;y<h-1;y++)for(let x=mid-1;x<=mid+1;x++)put(x,y,0);
   if(index===0)for(let x=mid-1;x<=mid+1;x++)put(x,h-1,0);
  }
  for(const p of Object.values(ports)){p.x=clamp(p.x,2,w-3);p.y=clamp(p.y,2,h-3);put(p.x,p.y,0);}
  const props=[];const types=roof?(b.roof==='garden'?['planter','planter','roofvent']:b.roof==='market'?['desk','roofvent','radio']:['roofvent','radio','machine']):b.type==='office'?['desk','desk','planter']:b.type==='residential'?['bed','desk','planter']:b.type==='garden'?['bed','planter','desk']:b.type==='market'?['desk','machine','planter']:['machine','desk','roofvent'];
  for(let y=2;y<h-2;y+=4)for(let x=2;x<w-2;x+=4){if(Math.abs(x-mid)<4||cells[at(x,y)]||rand()>.72)continue;props.push({type:types[Math.floor(rand()*types.length)],x:(x+.5)*PLAN_TILE,y:(y+.5)*PLAN_TILE,variant:Math.floor(rand()*100),orientation:Math.floor(rand()*4)});}
  const label=roof?'Roof':index===0?'Ground floor':`Floor ${index+1}`;
  const use=roof?b.roof==='garden'?'Roof garden':b.roof==='market'?'Roof market':'Service roof':index===0?'Lobby and street services':b.type==='office'?(index%3===0?'Records and data':'Offices'):b.type==='residential'?'Homes and common rooms':b.type==='industrial'?'Workshops and storage':b.type==='garden'?'Clinics and gardens':'Shops and workrooms';
  return{id:b.id+':'+index,buildingId:b.id,index,w,h,tile:PLAN_TILE,cells,roof,z:index*FLOOR_H,label,use,ports,props,seed:hash(city.seed+':floor:'+b.id+':'+index)};
 }
 function reachable(plan){const start=plan.ports.lift,k=start.y*plan.w+start.x,seen=new Set([k]),q=[k];for(let i=0;i<q.length;i++){const p=q[i],x=p%plan.w,y=Math.floor(p/plan.w);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*plan.w+nx;if(nx>=0&&ny>=0&&nx<plan.w&&ny<plan.h&&!plan.cells[n]&&!seen.has(n)){seen.add(n);q.push(n);}}}return seen;}
 root.Meridian={VERSION,BLOCK,FLOOR_H,UNIT,PLAN_TILE,DISTRICTS,City,defaultConfig,normalize,hash,rng,random,reachable};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.Meridian;
})(typeof self!=='undefined'?self:globalThis);
