export const TILE=16;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function random(seed){let s=typeof seed==='number'?seed:hash(seed);return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export const integer=(r,a,b)=>a+Math.floor(r()*(b-a+1));
export const pick=(r,list)=>list[Math.floor(r()*list.length)];
export function noise(x,y,s=0){let n=Math.imul(x+871,374761393)^Math.imul(y+1249,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
export const BIOMES=[
 {name:'The Moss Vault',floor:['#2d423b','#30473e','#293e38','#344940'],wall:'#53615a',edge:'#202f2b',accent:'#99b48a',glow:'#dfbf75',void:'#132421',enemy:'#789981',dust:'#8faf85'},
 {name:'The Cinder Keep',floor:['#40362c','#473b2d','#3c322b','#463c31'],wall:'#67584a',edge:'#2e2925',accent:'#cb9369',glow:'#ed9554',void:'#231e1b',enemy:'#b78363',dust:'#b29668'},
 {name:'The Moon Crypt',floor:['#333b47','#374250','#303c48','#3b4350'],wall:'#5b6573',edge:'#242b39',accent:'#a0b3ce',glow:'#9eb9e0',void:'#171e2b',enemy:'#8b96b8',dust:'#9aadc5'},
 {name:'The Thorn Garden',floor:['#343e32','#3a4634','#303c2e','#414933'],wall:'#5b6650',edge:'#242f24',accent:'#b3b775',glow:'#e2ca7d',void:'#17221b',enemy:'#97a76b',dust:'#afbb87'},
 {name:'The Sunken Sanctum',floor:['#2b4146','#2e464a','#293a42','#324849'],wall:'#4e686b',edge:'#1c3037',accent:'#8dbcb9',glow:'#8ccebb',void:'#14262e',enemy:'#75a6a6',dust:'#8fb7ae'}
];
export const WEAPON_TYPES=[
 {id:'sword',name:'Longsword',label:'BALANCED',damage:12,cooldown:.44,range:35,arc:1.8,special:'Whirlwind',specialTime:6,glyph:'†'},
 {id:'axe',name:'War Axe',label:'HEAVY',damage:23,cooldown:.76,range:39,arc:2.2,special:'Earthbreak',specialTime:8,glyph:'⚒'},
 {id:'dagger',name:'Twin Daggers',label:'FAST',damage:8,cooldown:.23,range:28,arc:1.6,special:'Blade rush',specialTime:5,glyph:'‡'},
 {id:'spear',name:'Spear',label:'LONG REACH',damage:15,cooldown:.55,range:57,arc:.75,special:'Piercing wave',specialTime:7,glyph:'↑'}
];
export const RARITIES=[{name:'Common',color:'#b4bea6',scale:1},{name:'Uncommon',color:'#91c993',scale:1.18},{name:'Rare',color:'#87b8d8',scale:1.4},{name:'Relic',color:'#d6b475',scale:1.72}];
const EFFECTS=[{id:'fire',name:'Ember',description:'Hits can burn enemies.',color:'#ec9b59'},{id:'frost',name:'Rime',description:'Hits slow enemies.',color:'#9ecedd'},{id:'vampire',name:'Sanguine',description:'Hits can restore health.',color:'#d27c83'},{id:'storm',name:'Storm',description:'Hits can strike a nearby enemy.',color:'#bfafd9'},{id:'venom',name:'Thorn',description:'Hits can poison enemies.',color:'#a2c678'}];
export function makeWeapon(r,depth=1,force){const type=force?WEAPON_TYPES.find(w=>w.id===force):pick(r,WEAPON_TYPES);const roll=r();const rarity=roll<.5?0:roll<.81?1:roll<.96?2:3;const effect=rarity>0?pick(r,EFFECTS):null;const power=RARITIES[rarity].scale*(1+(depth-1)*.095);return {...type,rarity,effect,damage:Math.round(type.damage*power*(.91+r()*.18)),crit:.06+r()*.055+rarity*.025,name:`${effect?.name??pick(r,['Worn','Iron','Hollow','Wayfarer’s'])} ${type.name}${rarity>=2?' of '+pick(r,['Dawn','the Deep','Ash','Echoes','the Lost']):''}`,color:RARITIES[rarity].color};}
export function starterWeapon(){return {...WEAPON_TYPES[0],rarity:0,effect:null,crit:.08,name:'Worn Longsword',color:RARITIES[0].color};}
export function createDungeon(seed,depth=1){
 const r=random(seed+':floor:'+depth);const w=90+Math.min(depth,8)*2,h=66+Math.min(depth,8);const tiles=new Uint8Array(w*h);const roomIds=new Int16Array(w*h);roomIds.fill(-1);const rooms=[];
 const carve=(x,y)=>{if(x>0&&y>0&&x<w-1&&y<h-1)tiles[y*w+x]=1;};
 function split(x,y,rw,rh,level){const vertical=rw/rh>1.4||(!(rh/rw>1.4)&&r()<.52);const canSplit=level<4&&(vertical?rw>=26:rh>=24);if(canSplit){const size=vertical?rw:rh;const cut=integer(r,Math.max(12,Math.floor(size*.34)),Math.min(size-12,Math.floor(size*.66)));if(vertical){split(x,y,cut,rh,level+1);split(x+cut,y,rw-cut,rh,level+1);}else{split(x,y,rw,cut,level+1);split(x,y+cut,rw,rh-cut,level+1);}return;}
 const mx=integer(r,2,3),my=integer(r,2,3);const ax=x+mx,ay=y+my;const aw=Math.max(7,rw-mx-integer(r,2,4)),ah=Math.max(7,rh-my-integer(r,2,4));const room={id:rooms.length,x:ax,y:ay,w:aw,h:ah,cx:ax+Math.floor(aw/2),cy:ay+Math.floor(ah/2),seen:false,visited:false,enemies:0};rooms.push(room);for(let iy=ay;iy<ay+ah;iy++)for(let ix=ax;ix<ax+aw;ix++){carve(ix,iy);roomIds[iy*w+ix]=room.id;}}
 split(2,2,w-4,h-4,0);
 const connected=[rooms[0]],remaining=rooms.slice(1),edges=[];
 while(remaining.length){let best=Infinity,from,to,idx;for(const a of connected)for(let j=0;j<remaining.length;j++){const b=remaining[j];const d=Math.hypot(a.cx-b.cx,a.cy-b.cy);if(d<best){best=d;from=a;to=b;idx=j;}}connected.push(to);remaining.splice(idx,1);edges.push([from,to]);}
 for(let i=0;i<Math.max(2,Math.floor(rooms.length/4));i++){const a=pick(r,rooms),b=pick(r,rooms);if(a!==b)edges.push([a,b]);}
 for(const[a,b]of edges){let x=a.cx,y=a.cy;const horizontalFirst=r()<.5;const stepX=()=>{while(x!==b.cx){carve(x,y);carve(x,y+1);x+=Math.sign(b.cx-x);}carve(x,y);carve(x,y+1);};const stepY=()=>{while(y!==b.cy){carve(x,y);carve(x+1,y);y+=Math.sign(b.cy-y);}carve(x,y);carve(x+1,y);};if(horizontalFirst){stepX();stepY();}else{stepY();stepX();}}
 const startRoom=rooms.reduce((a,b)=>a.cx+a.cy<b.cx+b.cy?a:b);const start={x:(startRoom.cx+.5)*TILE,y:(startRoom.cy+.5)*TILE};
 const queue=[[startRoom.cx,startRoom.cy]],dist=new Int16Array(w*h);dist.fill(-1);dist[startRoom.cy*w+startRoom.cx]=0;for(let n=0;n<queue.length;n++){const[x,y]=queue[n];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*w+nx;if(nx>=0&&ny>=0&&nx<w&&ny<h&&tiles[k]&&dist[k]<0){dist[k]=dist[y*w+x]+1;queue.push([nx,ny]);}}}
 const bossRoom=rooms.reduce((a,b)=>dist[a.cy*w+a.cx]>dist[b.cy*w+b.cx]?a:b);startRoom.seen=false;startRoom.visited=true;
 const biome=BIOMES[depth===1?0:(depth-2+Math.floor(r()*3))%BIOMES.length];const torches=[],decor=[],chests=[],shrines=[],hazards=[],enemySpawns=[];
 const point=(room,pad=2)=>({x:(integer(r,room.x+pad,room.x+room.w-1-pad)+.5)*TILE,y:(integer(r,room.y+pad,room.y+room.h-1-pad)+.5)*TILE});
 for(const room of rooms){
  torches.push({x:(room.x+1.5)*TILE,y:room.y*TILE-3,phase:r()*6},{x:(room.x+room.w-1.5)*TILE,y:(room.y+room.h)*TILE+1,phase:r()*6});
  for(let i=0;i<integer(r,4,11);i++){const p=point(room,1);decor.push({...p,kind:pick(r,['bones','rubble','grass','mushroom','urn']),seed:integer(r,0,9999)});}
  if(room!==startRoom&&room!==bossRoom){const count=integer(r,2,4)+Math.min(3,Math.floor(depth/3));for(let i=0;i<count;i++)enemySpawns.push({...point(room),room:room.id,kind:pick(r,depth<3?['slime','slime','skeleton','wisp','brute']:['slime','skeleton','wisp','brute','wisp']),elite:r()<.08+Math.min(.12,depth*.012),seed:integer(r,0,0xffffff)});room.enemies=count;
   if(r()<.65)chests.push({x:(room.x+1.5)*TILE,y:(room.y+1.5)*TILE,open:false,seed:integer(r,0,0xffffff)});
   if(r()<.24)hazards.push({...point(room),kind:pick(r,['spikes','rune']),phase:r()*5});
  }
 }
 chests.push({x:(startRoom.x+1.5)*TILE,y:(startRoom.y+1.5)*TILE,open:false,seed:integer(r,0,0xffffff),starter:true});
 const shrineRooms=rooms.filter(v=>v!==startRoom&&v!==bossRoom);for(let i=0;i<Math.min(3,shrineRooms.length);i++){const room=shrineRooms.splice(integer(r,0,shrineRooms.length-1),1)[0];shrines.push({x:(room.cx+.5)*TILE,y:(room.cy+.5)*TILE,used:false,kind:i===0?'forge':pick(r,['health','power','fortune']),price:35+depth*10,seed:integer(r,0,0xffffff)});}
 const boss={x:(bossRoom.cx+.5)*TILE,y:(bossRoom.cy+.5)*TILE,room:bossRoom.id,kind:'boss',elite:false,seed:integer(r,0,0xffffff),name:pick(r,['The','The'])+' '+pick(r,['Mossbound','Forgotten','Hollow','Ashen','Silent'])+' '+pick(r,['Warden','Sentinel','Keeper','Colossus']),style:integer(r,0,2)};
 const gate={x:(bossRoom.cx+.5)*TILE,y:(bossRoom.y+bossRoom.h-2.5)*TILE,open:false};
 return {seed,depth,w,h,tiles,roomIds,rooms,startRoom,bossRoom,start,biome,torches,decor,chests,shrines,hazards,enemySpawns,boss,gate,explored:new Uint8Array(w*h),visited:1,totalEnemies:enemySpawns.length+1,textureSeed:hash(seed+':texture:'+depth)};
}
export function isFloor(world,x,y){const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);return tx>=0&&ty>=0&&tx<world.w&&ty<world.h&&world.tiles[ty*world.w+tx]===1;}
export function canStand(world,x,y,radius=5){return isFloor(world,x-radius,y-radius)&&isFloor(world,x+radius,y-radius)&&isFloor(world,x-radius,y+radius)&&isFloor(world,x+radius,y+radius);}
export function moveBody(world,body,dx,dy,radius=5){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));for(let i=0;i<steps;i++){if(canStand(world,body.x+dx/steps,body.y,radius))body.x+=dx/steps;if(canStand(world,body.x,body.y+dy/steps,radius))body.y+=dy/steps;}}
export function lineOfSight(world,a,b){const n=Math.ceil(distance(a,b)/8);for(let i=1;i<n;i++)if(!isFloor(world,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;return true;}
export function pathField(world,target){const tx=Math.floor(target.x/TILE),ty=Math.floor(target.y/TILE);const field=new Int16Array(world.w*world.h);field.fill(-1);if(!isFloor(world,target.x,target.y))return field;const q=[ty*world.w+tx];field[q[0]]=0;for(let i=0;i<q.length;i++){const k=q[i],x=k%world.w,y=Math.floor(k/world.w);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*world.w+nx;if(nx>=0&&ny>=0&&nx<world.w&&ny<world.h&&world.tiles[nk]&&field[nk]<0){field[nk]=field[k]+1;q.push(nk);}}}return field;}
export function makeEnemy(spawn,depth){const r=random(spawn.seed);const defs={slime:{hp:24,speed:29,damage:7,radius:6,xp:9},skeleton:{hp:34,speed:39,damage:9,radius:5,xp:12},wisp:{hp:23,speed:31,damage:8,radius:5,xp:13},brute:{hp:68,speed:23,damage:15,radius:7,xp:20},boss:{hp:260,speed:28,damage:18,radius:8,xp:80}};const d=defs[spawn.kind];const scale=1+(depth-1)*.24;const elite=spawn.elite?1.65:1;const hp=Math.round(d.hp*scale*elite);return {...spawn,hp,maxHp:hp,speed:d.speed*(.92+r()*.16)*(spawn.elite?1.12:1),damage:Math.round(d.damage*(1+(depth-1)*.14)*elite),radius:d.radius,xp:Math.round(d.xp*elite),time:r()*5,attackCd:.4+r(),hurt:0,invincible:0,kx:0,ky:0,active:false,alive:true,burn:0,poison:0,slow:0,dotTick:0,windup:0,charge:0,chargeX:0,chargeY:0,pattern:0,colorShift:integer(r,-10,14),variant:integer(r,0,4)};}
export function upgradeChoices(r,player){const pool=[
 {id:'might',name:'Iron will',icon:'†',text:`+${integer(r,3,6)} damage on every hit.`,amount:0},
 {id:'vigor',name:'Vital roots',icon:'♥',text:'More health. Restore some health.',amount:integer(r,16,25)},
 {id:'haste',name:'Quick hands',icon:'↝',text:'Attack 10–16% faster.',amount:.1+r()*.06},
 {id:'armor',name:'Stone skin',icon:'◇',text:'Reduce incoming damage.',amount:integer(r,1,3)},
 {id:'crit',name:'True strike',icon:'✧',text:'More critical hits. Harder critical hits.',amount:.04+r()*.025},
 {id:'reach',name:'Long shadow',icon:'⤢',text:'A longer blade. Move faster.',amount:integer(r,4,7)},
 {id:'flask',name:'Second breath',icon:'♜',text:'Gain two healing flasks. Heal more per flask.',amount:2},
 {id:'ember',name:'Living embers',icon:'✦',text:'Every strike has a chance to burn.',amount:.13},
 {id:'dodge',name:'Light step',icon:'⤳',text:'Dodge more often. Move faster.',amount:.14},
 {id:'leech',name:'Blood pact',icon:'◈',text:'Defeat an enemy to restore health.',amount:integer(r,2,4)}
 ];pool[0].amount=Number(pool[0].text.match(/\d+/)[0]);const out=[];while(out.length<3)out.push(pool.splice(integer(r,0,pool.length-1),1)[0]);for(const u of out){if(u.id==='vigor')u.text=`+${u.amount} maximum health. Heal ${u.amount+10}.`;if(u.id==='haste')u.text=`Attack ${Math.round(u.amount*100)}% faster.`;if(u.id==='armor')u.text=`+${u.amount} armor. Reduce damage from each hit.`;if(u.id==='crit')u.text=`+${Math.round(u.amount*100)}% critical chance. +15% critical damage.`;if(u.id==='reach')u.text=`+${u.amount} reach. +5% movement speed.`;if(u.id==='leech')u.text=`Restore ${u.amount} health per defeat.`;}return out;}
