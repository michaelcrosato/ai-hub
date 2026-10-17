/* Shared deterministic contracts. No DOM or persistent storage in the simulation. */
(() => {
const G = globalThis.Drive = { E: My3D2dge, VERSION: '1.0.0', STEP: 1 / 120 };
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
G.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
G.angle = a => Math.atan2(Math.sin(a), Math.cos(a));
G.copy = v => JSON.parse(JSON.stringify(v));
G.hash = value => { let h = 2166136261; for (const c of JSON.stringify(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
G.stateHash = payload => {const derived=new Set(['nav','navTarget','navAge','aiWatch','aiPosition','aiBlocked','recoverFor','_angle','_cos','_sin']);return G.hash(JSON.parse(JSON.stringify(payload,(key,value)=>derived.has(key)?undefined:value)));};
G.RNG = class { constructor(seed) { this.state = seed >>> 0 || 1; } next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 4294967296; } pick(a) { return a[Math.floor(this.next() * a.length)]; } };
G.Events = class {
  constructor() { this.queue = []; this.log = []; this.listeners = new Map(); this.seq = 0; }
  on(type, fn) { const a = this.listeners.get(type) || []; a.push(fn); this.listeners.set(type, a); return () => a.splice(a.indexOf(fn), 1); }
  emit(type, data = {}) { this.queue.push({ type, ...data, seq: ++this.seq }); }
  flush() { for (let n = 0; this.queue.length && n < 1024; n++) { const e = this.queue.shift(); this.log.push(e); if (this.log.length > 160) this.log.shift(); for (const f of this.listeners.get(e.type) || []) f(e); } }
  dispose() { this.queue.length = 0; this.listeners.clear(); }
};
G.Spatial = class {
  constructor(size = 64) { this.size = size; this.cells = new Map(); }
  rebuild(items) { this.cells.clear(); for (const e of items) { const r = e.radius || e.r || 24; for (let y = Math.floor((e.y-r)/this.size); y <= Math.floor((e.y+r)/this.size); y++) for (let x = Math.floor((e.x-r)/this.size); x <= Math.floor((e.x+r)/this.size); x++) { const k = `${e.zone}:${x},${y}`, a = this.cells.get(k) || []; a.push(e); this.cells.set(k,a); } } }
  near(x,y,r,zone='city') { const out=new Set(); for(let j=Math.floor((y-r)/this.size);j<=Math.floor((y+r)/this.size);j++) for(let i=Math.floor((x-r)/this.size);i<=Math.floor((x+r)/this.size);i++) for(const e of this.cells.get(`${zone}:${i},${j}`)||[]) out.add(e); return [...out]; }
};
G.emptyAction = (source = 'companion') => ({ source, move:[0,0], aim:[0,0], steer:0, throttle:0, brake:0, held:{}, pressed:{}, released:{} });
G.contentError=message=>{throw Error('Invalid content: '+message);};
G.validateMission=definition=>{
 const d=definition,fail=message=>G.contentError('mission '+(d?.id||'?')+' '+message),kinds=['interact','vehicle','reach','entry','flag','gather','escape','deliver'];
 if(!d||d.schema!==1||!/^[a-z0-9-]+$/.test(d.id)||!d.name||!Number.isFinite(d.reward)||d.reward<0)fail('has invalid identity, schema or reward');
 if(!Array.isArray(d.stages)||!d.stages.length)fail('needs at least one stage');
 const ids=new Set();for(const stage of d.stages){if(!stage.id||ids.has(stage.id))fail('has duplicate/missing stage ID '+stage.id);ids.add(stage.id);if(!kinds.includes(stage.kind))fail('uses unknown goal '+stage.kind);if(!stage.target||!G.content.points[stage.target])fail('references unknown point '+stage.target);if(stage.kind==='flag'&&!stage.flag)fail('needs a flag name');if(stage.kind==='interact'&&!['brief','shop','lunch','tow','gate','service','extract'].includes(stage.target))fail('uses an unsupported interaction '+stage.target);}
 const choices=new Set();for(const c of d.choices||[]){if(!c.id||choices.has(c.id)||!G.content.vehicles[c.vehicle])fail('has an invalid or duplicate vehicle choice');choices.add(c.id);}
 if(d.start&&(!Number.isFinite(d.start.x)||!Number.isFinite(d.start.y)))fail('has an invalid spawn');return d;
};
G.registerMission=definition=>{if(Object.hasOwn(G.content.missions,definition?.id))G.contentError('duplicate mission '+definition.id);G.validateMission(definition);G.content.missions[definition.id]=definition;return definition;};
G.validateContent=()=>{
 const c=G.content;if(c.schema!==1)G.contentError('unsupported content schema');
 if(new Set(c.crew.map(a=>a.id)).size!==c.crew.length)G.contentError('duplicate crew ID');
 for(const [id,v]of Object.entries(c.vehicles))for(const key of ['length','width','speed','accel','grip','hp','seats'])if(!Number.isFinite(v[key])||v[key]<=0)G.contentError('vehicle '+id+' has invalid '+key);
 for(const [id,w]of Object.entries(c.weapons))for(const key of ['mag','reserve','rate','reload','damage','range','pellets'])if(!Number.isFinite(w[key])||w[key]<=0)G.contentError('weapon '+id+' has invalid '+key);
 for(const [id,p]of Object.entries(c.points))if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!['city','records','gantry'].includes(p.zone))G.contentError('point '+id+' has invalid coordinates or zone');
 for(const [id,cap]of Object.entries(c.caps))if(!Number.isInteger(cap)||cap<=0)G.contentError('invalid '+id+' budget');
 for(const [id,d]of Object.entries(c.missions)){if(d.id!==id)G.contentError('mission key differs from its ID: '+id);G.validateMission(d);}return true;
};
// Authoring check: one flood fill proves all ordinary ground goals are reachable.
// Gate/flag stages use their own shared interaction and portal integration tests.
G.validateMissionMap=(d,map)=>{
 G.validateMission(d);const start=d.start||{x:338,y:380},inside=p=>p.x>=0&&p.y>=0&&p.x<map.w*map.T&&p.y<map.h*map.T;
 if(!inside(start)||!map.standable(start.x,start.y,0,5))G.contentError('mission '+d.id+' has a blocked spawn');
 const seen=new Set(),queue=[[Math.floor(start.x/map.T),Math.floor(start.y/map.T)]];for(let i=0;i<queue.length;i++){const[x,y]=queue[i],key=y*map.w+x;if(seen.has(key))continue;seen.add(key);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<map.w&&ny<map.h&&!seen.has(ny*map.w+nx)&&map.standable((nx+.5)*map.T,(ny+.5)*map.T,0,5))queue.push([nx,ny]);}}
 for(const stage of d.stages){if(['entry','flag'].includes(stage.kind))continue;const p=G.content.points[stage.target];if(p.zone!=='city')continue;const x=Math.floor(p.x/map.T),y=Math.floor(p.y/map.T);if(!inside(p)||!map.standable(p.x,p.y,0,5)||!seen.has(y*map.w+x))G.contentError('mission '+d.id+' has an unreachable goal: '+stage.target);}return true;
};
G.MemoryStore = class { constructor() { this.data = {}; this.writes = 0; } getItem(k) { return this.data[k] ?? null; } setItem(k,v) { this.data[k]=String(v); this.writes++; } removeItem(k) { delete this.data[k]; } };
G.Save = class {
  constructor(store, key='five-finger-sd-v1') { this.store=store; this.key=key; this.error=null; this.generation=0; }
  valid(raw) { try { const v=JSON.parse(raw); if(v.schema!==1 || !Number.isSafeInteger(v.generation) || v.check!==G.hash(v.payload) || !this.payloadValid(v.payload)) return null; return v; } catch { return null; } }
  payloadValid(p) {return !!p&&(p.contentVersion===undefined||p.contentVersion===1)&&(p.gameVersion===undefined||p.gameVersion===G.VERSION)&&!!G.content.missions[p.mission]&&Number.isFinite(p.seed)&&Number.isInteger(p.progress)&&p.progress>=0&&p.progress<=G.content.missions[p.mission].stages.length&&Array.isArray(p.cars)&&p.cars.every(c=>G.content.vehicles[c.type]&&Number.isFinite(c.x)&&Number.isFinite(c.y)&&Array.isArray(c.occupants))&&Array.isArray(p.crew)&&p.crew.length===3&&p.crew.every(a=>G.content.crew.some(d=>d.id===a.id)&&['city','records','gantry'].includes(a.zone)&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.hp));}
  load() { try { const slots=[0,1].map(n=>this.valid(this.store.getItem(this.key+':'+n))).filter(Boolean).sort((a,b)=>b.generation-a.generation); if(!slots.length) return null; this.generation=slots[0].generation; return G.copy(slots[0].payload); } catch(e) { this.error='Storage unavailable. This run can continue.'; return null; } }
  write(payload) { this.load();const generation=this.generation+1, value={schema:1,generation,payload:G.copy(payload)}; value.check=G.hash(value.payload); try { this.store.setItem(this.key+':'+generation%2,JSON.stringify(value));const verified=this.valid(this.store.getItem(this.key+':'+generation%2));if(!verified||verified.generation!==generation)throw Error('Save verification failed'); this.store.setItem(this.key+':head',String(generation)); this.generation=generation; return true; } catch(e) { this.error='Save unavailable. Keep this tab open.'; return false; } }
};
// A* is shared by crew, pedestrians, police and the demo. No actor position edits.
G.path = (map, from, to, radius=5, step=16) => {
 const w=Math.ceil(map.w*map.T/step),h=Math.ceil(map.h*map.T/step),count=w*h,idx=(x,y)=>y*w+x;
 const sx=G.clamp(Math.floor(from.x/step),0,w-1),sy=G.clamp(Math.floor(from.y/step),0,h-1);let tx=G.clamp(Math.floor(to.x/step),0,w-1),ty=G.clamp(Math.floor(to.y/step),0,h-1);
 const walk=new Int8Array(count),ok=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return false;const k=idx(x,y);if(!walk[k])walk[k]=map.standable((x+.5)*step,(y+.5)*step,0,radius)?1:-1;return walk[k]>0;};
 if(!ok(tx,ty)){let best=Infinity,bx=tx,by=ty;for(let y=ty-4;y<=ty+4;y++)for(let x=tx-4;x<=tx+4;x++)if(ok(x,y)){const d=Math.hypot(x-tx,y-ty);if(d<best){best=d;bx=x;by=y;}}if(!Number.isFinite(best))return [];tx=bx;ty=by;}
 const start=idx(sx,sy),end=idx(tx,ty),cost=new Float64Array(count).fill(Infinity),prev=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=[];
 const push=(k,f)=>{let i=heap.length;heap.push([k,f]);while(i){const p=(i-1)>>1;if(heap[p][1]<=f)break;heap[i]=heap[p];i=p;}heap[i]=[k,f];};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first[0];};
 cost[start]=0;push(start,0);let rounds=0;
 while(heap.length&&rounds++<20000){const k=pop();if(closed[k])continue;closed[k]=1;const x=k%w,y=Math.floor(k/w);if(k===end){const out=[];for(let a=k;a!==start&&prev[a]>=0;a=prev[a])out.push({x:(a%w+.5)*step,y:(Math.floor(a/w)+.5)*step});return out.reverse();}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(!ok(nx,ny)||(dx&&dy&&(!ok(x+dx,y)||!ok(x,y+dy))))continue;const n=idx(nx,ny),offRoad=radius>20&&!((map.roads?.x||[]).some(v=>Math.abs((nx+.5)*step-v)<58)||(map.roads?.y||[]).some(v=>Math.abs((ny+.5)*step-v)<58)),c=cost[k]+(dx&&dy?Math.SQRT2:1)*(offRoad?2.5:1);if(c<cost[n]){cost[n]=c;prev[n]=k;push(n,c+Math.hypot(nx-tx,ny-ty)*1.001);}}
 }return [];
};
G.segmentBox2D=(a,b,r)=>{let low=0,high=1;for(const [key,min,max]of [['x',r.x,r.x+r.w],['y',r.y,r.y+r.h]]){const d=b[key]-a[key];if(Math.abs(d)<1e-9){if(a[key]<min||a[key]>max)return null;continue;}let t0=(min-a[key])/d,t1=(max-a[key])/d;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return null;}return low;};
G.segmentCircle=(a,b,c,r)=>{const dx=b.x-a.x,dy=b.y-a.y,t=G.clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y)<=r?t:null;};
})();
