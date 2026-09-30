import { WORLD, TYPES } from './catalog.js';
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export class Random {
  constructor(seed=8317) { this.state=seed>>>0 || 1; }
  next() { let x=this.state; x^=x<<13; x^=x>>>17; x^=x<<5; this.state=x>>>0; return this.state/4294967296; }
  range(a,b) { return a+this.next()*(b-a); }
}
/** Rock plateaus per battlefield: [x, z, width, depth]. */
const ROCKS = [
  [[12,29,6,10],[32,40,8,5],[64,48,6,12],[85,62,8,7]],
  [[12,32,8,9],[40,44,9,5],[42,17,5,7],[55,64,5,7]],
  [[12,30,7,8],[32,42,6,8],[66,50,9,6],[88,63,6,7]],
  // Ember Ridge: one long ridge with a northern and a southern pass, plus two outcrops.
  [[49,9,6,14],[49,41,6,22],[49,75,6,14],[22,30,6,6],[70,57,6,5]]
];
/** Immutable terrain, mutable building occupancy. All ground is y=0 for gameplay. */
export class Battlefield {
  constructor(index=0) {
    this.index=index;
    this.cols=WORLD.width/WORLD.cell; this.rows=WORLD.height/WORLD.cell;
    this.cells=new Uint8Array(this.cols*this.rows);
    this.obstacles=[]; this.bridges=[];
    for(let z=0;z<this.rows;z++) for(let x=0;x<this.cols;x++) {
      const wx=x*2+1,wz=z*2+1;
      let type=0;
      if(index===0) {
        const mid=50+Math.sin(wz*0.06)*3;
        if(Math.abs(wx-mid)<4.5) type=1;
        if(type===1&&(Math.abs(wz-32)<4||Math.abs(wz-62)<4)) type=2;
      } else if(index===1) {
        const coast=70+Math.sin(wz*0.09)*3;
        if(wx>coast) type=1;
      } else if(index===2) {
        if(wx>46&&wx<54&&wz<72) type=1;
        if(type===1&&(Math.abs(wz-28)<4||Math.abs(wz-58)<4)) type=2;
      } else {
        // A cold mountain lake below the enemy plateau.
        if(((wx-78)/10)**2+((wz-71)/6.5)**2<1) type=1;
      }
      this.cells[z*this.cols+x]=type;
    }
    for(const [x,z,w,h] of ROCKS[index]||ROCKS[0]) {
      this.obstacles.push({x,z,w,h});
      for(let iz=0;iz<this.rows;iz++) for(let ix=0;ix<this.cols;ix++) {
        if(Math.abs(ix*2+1-x)<w/2&&Math.abs(iz*2+1-z)<h/2&&this.cells[iz*this.cols+ix]!==1) this.cells[iz*this.cols+ix]=3;
      }
    }
    this.occupancy=new Int32Array(this.cells.length); this.version=0;
  }
  indexAt(x,z) { return clamp(Math.floor(z/2),0,this.rows-1)*this.cols+clamp(Math.floor(x/2),0,this.cols-1); }
  cellAt(x,z) { if(x<1||z<1||x>99||z>83)return 3; return this.cells[this.indexAt(x,z)]; }
  point(i) { return {x:(i%this.cols)*2+1,z:Math.floor(i/this.cols)*2+1}; }
  passable(i,domain='ground',ignore=0) {
    if(i<0||i>=this.cells.length)return false;
    if(domain==='air')return true;
    if(domain==='naval')return this.cells[i]===1&&(!this.occupancy[i]||this.occupancy[i]===ignore);
    return this.cells[i]!==1&&this.cells[i]!==3&&(!this.occupancy[i]||this.occupancy[i]===ignore);
  }
  blocked(x,z,domain='ground',ignore=0) { return x<1||z<1||x>99||z>83||!this.passable(this.indexAt(x,z),domain,ignore); }
  rebuild(entities) {
    this.occupancy.fill(0);
    for(const e of entities) {
      const d=TYPES[e.type]; if(d.kind!=='building'||e.hp<=0)continue;
      const [w,h]=e.rot%2?[d.size[1],d.size[0]]:d.size;
      for(let z=Math.floor((e.z-h/2)/2);z<=Math.floor((e.z+h/2)/2);z++)
        for(let x=Math.floor((e.x-w/2)/2);x<=Math.floor((e.x+w/2)/2);x++)
          if(z>=0&&x>=0&&z<this.rows&&x<this.cols)this.occupancy[z*this.cols+x]=e.id;
    }
    this.version++;
  }
  nearest(x,z,domain='ground',ignore=0) {
    const start=this.indexAt(x,z);
    if(this.passable(start,domain,ignore))return start;
    const sx=start%this.cols,sz=Math.floor(start/this.cols);
    for(let r=1;r<14;r++) {
      let best=-1,dist=Infinity;
      for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++) {
        if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
        const nx=sx+dx,nz=sz+dz;if(nx<0||nz<0||nx>=this.cols||nz>=this.rows)continue;
        const i=nz*this.cols+nx;if(!this.passable(i,domain,ignore))continue;
        const p=this.point(i),d=Math.hypot(p.x-x,p.z-z);if(d<dist){dist=d;best=i;}
      }
      if(best!==-1)return best;
    }
    return -1;
  }
  lineClear(a,b,domain='ground') {
    const n=Math.ceil(distance(a,b)/0.7);
    for(let i=1;i<=n;i++)if(this.blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,domain))return false;
    return true;
  }
  /** Bounded A*. Failed paths terminate, rather than retrying per frame.
   * The search buffers are reused between calls (one path at a time). */
  path(a,b,domain='ground') {
    if(domain==='air')return [{x:clamp(b.x,2,98),z:clamp(b.z,2,82)}];
    const start=this.nearest(a.x,a.z,domain),end=this.nearest(b.x,b.z,domain);
    if(start<0||end<0)return [];
    if(start===end)return [this.point(end)];
    const n=this.cells.length;
    if(!this.search||this.search.g.length!==n)this.search={g:new Float32Array(n),parent:new Int32Array(n),closed:new Uint8Array(n),open:new MinHeap()};
    const {g,parent,closed,open}=this.search;
    g.fill(Infinity);parent.fill(-1);closed.fill(0);open.clear();
    const ep=this.point(end),cols=this.cols;
    const heuristic=i=>Math.hypot((i%cols)*2+1-ep.x,Math.floor(i/cols)*2+1-ep.z)/2;
    g[start]=0;open.push(start,heuristic(start));let found=false,visits=0;
    while(open.length&&visits++<2500) {
      const at=open.pop();if(closed[at])continue;if(at===end){found=true;break;}closed[at]=1;
      const x=at%this.cols,z=Math.floor(at/this.cols);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
        if(!dx&&!dz)continue;
        const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.cols||nz>=this.rows)continue;
        const ni=nz*this.cols+nx;
        if(closed[ni]||!this.passable(ni,domain))continue;
        if(dx&&dz&&(!this.passable(z*this.cols+nx,domain)||!this.passable(nz*this.cols+x,domain)))continue;
        const ng=g[at]+(dx&&dz?1.414214:1);
        if(ng<g[ni]) {g[ni]=ng;parent[ni]=at;open.push(ni,ng+heuristic(ni));}
      }
    }
    if(!found)return [];
    const path=[];for(let i=end;i!==start&&i>=0;i=parent[i])path.push(this.point(i));path.reverse();
    // Keep turns and discard redundant straight runs. No corner-cutting.
    const smooth=[];let from=a,j=0;
    while(j<path.length) {let k=j;while(k+1<path.length&&this.lineClear(from,path[k+1],domain))k++;smooth.push(path[k]);from=path[k];j=k+1;}
    return smooth;
  }
}
class MinHeap {
  constructor(){this.items=[];}
  get length(){return this.items.length;}
  clear(){this.items.length=0;}
  push(id,key){const a=this.items;let i=a.length;a.push(null);while(i>0){const p=(i-1)>>1;if(a[p].key<=key)break;a[i]=a[p];i=p;}a[i]={id,key};}
  pop(){const a=this.items,result=a[0].id,last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].key<a[c].key)c++;if(a[c].key>=last.key)break;a[i]=a[c];i=c;}a[i]=last;}return result;}
}
