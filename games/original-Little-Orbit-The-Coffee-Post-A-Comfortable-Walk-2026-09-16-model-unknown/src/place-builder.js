/** Shared construction parts for connected, walkable buildings.
 * All route waypoints use the same frame and heights as the collision surfaces. */
import { Node } from './engine.js';
import { CONFIG } from './config.js';
import { framePoint, frameAt, coordinates } from './physics.js';
import { norm, len, vsub } from './math.js';
function placeBuilder(w){
 const wood='#ad825e',top='#dfc49d',R=CONFIG.radius;
 const point=(g,x,y,z)=>{const p=framePoint(g.matrix,[x,y,z]);return {n:norm(p),h:len(p)-R};};
 const groundY=(x,z)=>Math.sqrt(Math.max(1,R*R-x*x-z*z))-R;
 const dynamic=(at,name,heading=0)=>{const n=new Node(name);n.matrix=frameAt(...at,heading);w.dynamics.push(n);return n;};
 function deck(g,x,z,width,depth,y,id,tint=top){
  w.box(g,wood,[x,y-.12,z],[width,.24,depth]);w.box(g,tint,[x,y+.007,z],[width-.03,.014,depth-.03]);w.surfaces.floor(g.matrix,x,z,width,depth,y+.014,id);
  for(let v=x-width/2+.26;v<x+width/2;v+=.50)w.box(g,'#bf9f7d',[v,y+.018,z],[.012,.012,depth-.05]);
 }
 function rail(g,a,b,col=wood){
  w.rod(g,a,b,.044,col);const steps=Math.max(1,Math.ceil(len(vsub(b,a))/.86));
  for(let i=0;i<=steps;i++){const p=a.map((v,k)=>v+(b[k]-v)*i/steps);w.rod(g,[p[0],p[1]-.76,p[2]],p,.034,col);}
  const mid=a.map((v,i)=>(v+b[i])/2),size=a.map((v,i)=>Math.abs(b[i]-v)+.07);size[1]=.52;
  w.surfaces.rail(g.matrix,a,b,'detour_rail');
 }
 function stairs(g,{x,from,to,y,width=1.9,id,y0=groundY(x,from)}){
  const N=Math.max(1,Math.ceil(Math.abs(y-y0)/.17)),d=(to-from)/N;
  for(let i=0;i<N;i++){
   const z=from+(i+.5)*d,h=y0+(y-y0)*(i+1)/N;
   // Treads are supported by slim strings. The route remains open underneath.
   w.box(g,wood,[x,h-.095,z],[width,.19,Math.abs(d)+.032]);w.box(g,top,[x,h+.008,z],[width,.018,Math.abs(d)*.22]);
  }
  for(const s of [-1,1]){const xx=x+s*(width/2+.06);rail(g,[xx,y0+.8,from],[xx,y+.8,to]);w.rod(g,[xx,y0-.10,from],[xx,y-.10,to],.09,wood);}
  w.surfaces.ramp(g.matrix,x,from+Math.sign(from-to)*.04,to-Math.sign(from-to)*.04,width,y0,y+.018);
  w.surfaces.ramps.at(-1).openUnder=true;
  return {entry:point(g,x,y0,from+.60*Math.sign(from-to)).n,top:point(g,x,y+.018,to-.10*Math.sign(from-to)).n};
 }
 function bridgeX(g,{x0,x1,z,y,width=1.8,id,bow=.16}){
  const steps=Math.ceil((x1-x0)/.23),nodes=[];
  for(let i=0;i<steps;i++){const t=(i+.5)/steps,x=x0+(x1-x0)*t,h=y+bow*Math.sin(t*Math.PI);w.box(g,'#c79c74',[x,h-.085,z],[(x1-x0)/steps+.024,.17,width]);w.surfaces.floor(g.matrix,x,z,(x1-x0)/steps+.07,width,h+.01,id);if(i%3===0)nodes.push(point(g,x,h,z).n);}
  for(const side of [-1,1])for(let i=0;i<7;i++){
   const a=i/7,b=(i+1)/7;rail(g,[x0+(x1-x0)*a,y+.81+bow*Math.sin(a*Math.PI),z+side*(width/2+.04)],[x0+(x1-x0)*b,y+.81+bow*Math.sin(b*Math.PI),z+side*(width/2+.04)]);
  }
  return nodes;
 }
 function pathTo(at,points,width=1.6,col='#dfc9a4'){const targets=[at,...points.map(n=>coordinates(n))];w.path(targets,width+.15,'#b8a98d',.087);w.path(targets,width,col,.106);return targets;}
 function activity(g,id,p,node){const item=w.detours.items.find(d=>d.id===id);const a={...item,type:'detour',...point(g,...p),node,lastUse:-100};w.interactions.push(a);w.detours.objects.push(a);return a;}
 function columns(g,xs,zs,y){for(const x of xs)for(const z of zs)w.rod(g,[x,groundY(x,z),z],[x,y,z],.08,wood);}
 function board(at,text,heading=0){const g=w.rootAt(at,heading);w.prefab(g,'sign',[0,0,0],.9);w.sign(g,[0,1.47,.09],text,1.65,.41);return g;}
 return {point,groundY,dynamic,deck,rail,stairs,bridgeX,pathTo,activity,columns,board};
}

export { placeBuilder };
