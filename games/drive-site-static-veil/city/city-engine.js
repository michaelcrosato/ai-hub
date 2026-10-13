/* Layer and navigation adapters for my-3D2dge. Real absolute x/y/z positions.
 * Street collision is a bounded 5x5 native TileMap around the body. Interiors
 * translate into a small native TileMap. Roofs join only at validated bridges. */
(function(root){
 'use strict';
 const M=root.Meridian,E=root.My3D2dge,U=M.UNIT,T=M.PLAN_TILE*U;
 const inside=(x,y,b,pad=0)=>x>=b.x-pad&&x<=b.x+b.w+pad&&y>=b.y-pad&&y<=b.y+b.d+pad;
 class FloorLayer{
  constructor(building,plan){this.b=building;this.plan=plan;this.x=building.x*U;this.y=building.y*U;this.z=plan.z*U;
   this.map=new E.TileMap({w:plan.w,h:plan.h,tile:T,cells:Array.from(plan.cells),types:{1:{h:44,top:'#41606c',side:'#203a49',face:'none',roof:'plain',cut:true,cutH:14}},ao:0,shimmer:false});
   this.nav=new E.FlowField(this.map);
  }
  collide(body){const {x,y,z}=body;body.x-=this.x;body.y-=this.y;body.z-=this.z;let hit;try{hit=this.map.collide(body);}finally{body.x+=this.x;body.y+=this.y;body.z=z;}return hit;}
  groundAt(x,y,r,z,step){return this.z+this.map.groundAt(x-this.x,y-this.y,r,z-this.z,step);}
  walkable(x,y){const[cx,cy]=this.map.toCell(x-this.x,y-this.y);return this.map.walkable(cx,cy);}
  direction(body,goal){this.nav.update(goal.x-this.x,goal.y-this.y);return this.nav.dir(body.x-this.x,body.y-this.y,goal.x-this.x,goal.y-this.y);}
  point(port){const p=typeof port==='string'?this.plan.ports[port]:port;return{x:this.x+(p.x+.5)*T,y:this.y+(p.y+.5)*T,z:this.z};}
 }
 class StreetLayer{
  constructor(city){this.city=city;this.z=0;this.origin=[NaN,NaN];this.map=new E.TileMap({w:5,h:5,tile:T,cells:Array(25).fill(0),types:{1:{h:64},2:{h:1e7}},ao:0,shimmer:false});this.points=[];this.path=[];this.goal=null;}
  groundAt(){return 0;}
  walkable(x,y){const mx=x/U,my=y/U;if(mx<1||my<1||mx>this.city.size-1||my>this.city.size-1)return false;const block=this.city.block(Math.floor(mx/M.BLOCK),Math.floor(my/M.BLOCK));if(block.terrain==='water'||block.terrain==='outside')return false;return!block.buildings.some(b=>inside(mx,my,b,.25));}
  _refresh(body){const cx=Math.floor(body.x/T),cy=Math.floor(body.y/T);if(cx===this.origin[0]&&cy===this.origin[1])return;this.origin=[cx,cy];this.x=(cx-2)*T;this.y=(cy-2)*T;for(let y=0;y<5;y++)for(let x=0;x<5;x++)this.map.cells[y*5+x]=this.walkable(this.x+(x+.5)*T,this.y+(y+.5)*T)?0:1;this.map.version++;}
  collide(body){this._refresh(body);const z=body.z;body.x-=this.x;body.y-=this.y;body.z=0;let hit;try{hit=this.map.collide(body);}finally{body.x+=this.x;body.y+=this.y;body.z=z;}return hit;}
  direction(body,goal){return pathDirection(this,body,goal);}
 }
 class RoofLayer{
  constructor(city,b){this.city=city;this.b=b;this.z=b.height*U;this.block=city.block(b.bx,b.by);this.links=this.block.links.filter(l=>l.z===b.height);const ids=new Set([b.id]);let changed=true;while(changed){changed=false;for(const l of this.links)if(ids.has(l.a)||ids.has(l.b)){if(!ids.has(l.a)||!ids.has(l.b))changed=true;ids.add(l.a);ids.add(l.b);}}this.buildings=this.block.buildings.filter(a=>ids.has(a.id));this.links=this.links.filter(l=>ids.has(l.a)&&ids.has(l.b));this.last=null;this.path=[];this.goal=null;}
  groundAt(){return this.z;}
  walkable(x,y){x/=U;y/=U;return this.buildings.some(b=>inside(x,y,{x:b.x+.6,y:b.y+.6,w:b.w-1.2,d:b.d-1.2}))||this.links.some(l=>inside(x,y,l));}
  collide(body){const r=body.r*.9,ok=(x,y)=>[[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>this.walkable(x+dx,y+dy));let hit=false;if(!ok(body.x,body.y)){hit=true;if(this.last){if(ok(body.x,this.last.y))body.y=this.last.y;else if(ok(this.last.x,body.y))body.x=this.last.x;else{body.x=this.last.x;body.y=this.last.y;}}else{body.x=(this.b.x+this.b.w/2)*U;body.y=(this.b.y+this.b.d/2)*U;}}this.last={x:body.x,y:body.y};return hit;}
  direction(body,goal){return pathDirection(this,body,goal);}
 }
 // Bounded local A*. Long travel uses the city atlas. Every segment still uses
 // native Body collision. The graph belongs to the current physical surface.
 function findPath(layer,start,goal){
  const sx=Math.floor(start.x/T),sy=Math.floor(start.y/T),gx=Math.floor(goal.x/T),gy=Math.floor(goal.y/T);if(Math.abs(gx-sx)>110||Math.abs(gy-sy)>110)return[];
  const key=(x,y)=>x+','+y,open=[{x:sx,y:sy,g:0,f:0}],came=new Map(),cost=new Map([[key(sx,sy),0]]);let end=null,visits=0;
  while(open.length&&visits++<12000){let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const c=open.splice(bi,1)[0],ck=key(c.x,c.y);if(c.x===gx&&c.y===gy){end=c;break;}
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=c.x+dx,y=c.y+dy,k=key(x,y);if(Math.abs(x-sx)>120||Math.abs(y-sy)>120||!layer.walkable((x+.5)*T,(y+.5)*T))continue;const g=c.g+1;if(cost.has(k)&&cost.get(k)<=g)continue;cost.set(k,g);came.set(k,ck);open.push({x,y,g,f:g+Math.abs(x-gx)+Math.abs(y-gy)});}}
  if(!end)return[];const out=[];let k=key(end.x,end.y);while(k!==key(sx,sy)){const[x,y]=k.split(',').map(Number);out.push({x:(x+.5)*T,y:(y+.5)*T});k=came.get(k);if(!k)break;}return out.reverse();
 }
 function pathDirection(layer,body,goal){if(!layer.goal||layer.goal.x!==goal.x||layer.goal.y!==goal.y){layer.goal={...goal};layer.path=findPath(layer,body,goal);}while(layer.path.length&&Math.hypot(body.x-layer.path[0].x,body.y-layer.path[0].y)<8)layer.path.shift();if(!layer.path.length)return[0,0];const p=layer.path[0],d=Math.hypot(p.x-body.x,p.y-body.y);return d?[ (p.x-body.x)/d,(p.y-body.y)/d]:[0,0];}
 function mouseOnFloor(game,z){const p=game.input.mouseScreen();return p?game.view.toGround(p[0],p[1]-game.view.bz*z):null;}
 function place(body,point){Object.assign(body,{x:point.x,y:point.y,z:point.z||0,groundZ:point.z||0,vx:0,vy:0,vz:0,onGround:true});}
 root.MeridianEngine={FloorLayer,StreetLayer,RoofLayer,findPath,mouseOnFloor,place,inside};
})(typeof window!=='undefined'?window:globalThis);
