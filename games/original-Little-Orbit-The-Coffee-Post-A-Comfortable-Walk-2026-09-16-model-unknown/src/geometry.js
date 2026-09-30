import { norm, cross, vsub } from './math.js';
function meshData(){return {p:[],n:[],uv:[],c:[]};}
function tri(g,a,b,c,ns=null,uv=null,col=[1,1,1]){const n=norm(cross(vsub(b,a),vsub(c,a)));[a,b,c].forEach((v,i)=>{g.p.push(...v);g.n.push(...(ns?ns[i]:n));g.uv.push(...(uv?uv[i]:[0,0]));g.c.push(...col);});}
function box(){const g=meshData();const faces=[[[1,0,0],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],[[-1,0,0],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],[[0,1,0],[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],[[0,-1,0],[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],[[0,0,1],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[[0,0,-1],[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]];for(const [n,a,b,c,d] of faces){tri(g,a,b,c,[n,n,n],[[0,0],[1,0],[1,1]]);tri(g,a,c,d,[n,n,n],[[0,0],[1,1],[0,1]]);}return g;}
function sphere(nx=14,ny=9,flat=false){const g=meshData();const p=(u,v)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=p(x/nx*Math.PI*2,y/ny*Math.PI),b=p((x+1)/nx*Math.PI*2,y/ny*Math.PI),c=p((x+1)/nx*Math.PI*2,(y+1)/ny*Math.PI),d=p(x/nx*Math.PI*2,(y+1)/ny*Math.PI);tri(g,a,b,c,flat?null:[a,b,c]);tri(g,a,c,d,flat?null:[a,c,d]);}return g;}
function cylinder(top=1,bottom=1,sides=14){const g=meshData();for(let i=0;i<sides;i++){let a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;const p=[Math.cos(a)*bottom,-.5,Math.sin(a)*bottom],q=[Math.cos(b)*bottom,-.5,Math.sin(b)*bottom],r=[Math.cos(b)*top,.5,Math.sin(b)*top],s=[Math.cos(a)*top,.5,Math.sin(a)*top];const na=norm([Math.cos(a),bottom-top,Math.sin(a)]),nb=norm([Math.cos(b),bottom-top,Math.sin(b)]);tri(g,p,r,q,[na,nb,nb]);tri(g,p,s,r,[na,na,nb]);tri(g,[0,.5,0],r,s);tri(g,[0,-.5,0],p,q);}return g;}
function torus(R=.72,r=.28,n=20,m=8){const g=meshData();const point=(a,b)=>[(R+r*Math.cos(b))*Math.cos(a),r*Math.sin(b),(R+r*Math.cos(b))*Math.sin(a)];const normal=(a,b)=>[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)];for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i/n*Math.PI*2,b=j/m*Math.PI*2,c=(i+1)/n*Math.PI*2,d=(j+1)/m*Math.PI*2;const p=point(a,b),q=point(c,b),v=point(c,d),w=point(a,d);tri(g,p,v,q,[normal(a,b),normal(c,d),normal(c,b)]);tri(g,p,w,v,[normal(a,b),normal(a,d),normal(c,d)]);}return g;}
function plane(){const g=meshData();tri(g,[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],null,[[0,0],[1,0],[1,1]]);tri(g,[-.5,-.5,0],[.5,.5,0],[-.5,.5,0],null,[[0,0],[1,1],[0,1]]);return g;}
function roof(){const g=meshData();const a=[-.5,0,-.5],b=[.5,0,-.5],c=[.5,0,.5],d=[-.5,0,.5],e=[0,.6,-.5],f=[0,.6,.5];tri(g,a,e,b);tri(g,d,c,f);tri(g,a,f,e);tri(g,a,d,f);tri(g,e,c,b);tri(g,e,f,c);tri(g,a,c,d);tri(g,a,b,c);return g;}
const primitives=()=>({box:box(),sphere:sphere(),pebble:sphere(10,7,true),smooth:sphere(16,10),bud:sphere(8,5),cylinder:cylinder(),cone:cylinder(0,1),cup:cylinder(1,.76),torus:torus(),plane:plane(),roof:roof(),...courierPrimitives()});

// The courier shares these small meshes. Paint is stored as editable COLOR_0 data.
function painted(g){
 g.c=[];
 for(let i=0;i<g.p.length;i+=3){
  const [x,y,z]=g.p.slice(i,i+3);
  const wash=.94+.045*Math.max(-1,Math.min(1,y))+.012*Math.sin(x*8+y*3)*Math.sin(z*7-y*5)+.008*Math.sin(x*19+z*13);
  g.c.push(Math.min(1,wash+.018),Math.min(1,wash),Math.min(1,wash-.018));
 }
 return g;
}
function roundedBox(radius=.16){
 const g=meshData(),grid=[-.5,-.46,-.34,.34,.46,.5],core=.5-radius;
 const surface=(face,u,v)=>{
  const p=face===0?[.5,u,v]:face===1?[-.5,u,-v]:face===2?[v,.5,u]:face===3?[v,-.5,-u]:face===4?[u,v,.5]:[-u,v,-.5];
  const c=p.map(a=>Math.max(-core,Math.min(core,a))),n=norm(vsub(p,c));
  return {p:c.map((a,i)=>a+n[i]*radius),n};
 };
 for(let f=0;f<6;f++)for(let i=0;i<5;i++)for(let j=0;j<5;j++){
  const a=surface(f,grid[i],grid[j]),b=surface(f,grid[i+1],grid[j]),c=surface(f,grid[i+1],grid[j+1]),d=surface(f,grid[i],grid[j+1]);
  for(const t of [[a,b,c],[a,c,d]]){
   const geometric=cross(vsub(t[1].p,t[0].p),vsub(t[2].p,t[0].p));
   if(geometric.reduce((s,v,k)=>s+v*t[0].n[k],0)<0)[t[1],t[2]]=[t[2],t[1]];
   tri(g,...t.map(v=>v.p),t.map(v=>v.n));
  }
 }
 return painted(g);
}
function roundedEar(){
 const g=sphere(16,12);
 // A broad base and a soft tip. Recompute the normal with the inverse Jacobian.
 for(let i=0;i<g.p.length;i+=3){
  const [x,y,z]=g.p.slice(i,i+3),a=.74-.30*y,b=.86-.12*y;
  g.p[i]=x*a;g.p[i+2]=z*b;
  const n=norm([x/a,y+.30*x*x/a+.12*z*z/b,z/b]);g.n.splice(i,3,...n);
 }
 return painted(g);
}
function smileCurve(){
 const g=meshData(),steps=16,sides=6,r=.115;
 const point=(u,v)=>{const x=-1+2*u,base=[x,.5*x*x-.5,0],n=norm([-x,1,0]),a=v*Math.PI*2,nn=[n[0]*Math.cos(a),n[1]*Math.cos(a),Math.sin(a)];return {p:base.map((q,i)=>q+nn[i]*r),n:nn};};
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
  const a=point(i/steps,j/sides),b=point((i+1)/steps,j/sides),c=point((i+1)/steps,(j+1)/sides),d=point(i/steps,(j+1)/sides);
  tri(g,a.p,c.p,b.p,[a.n,c.n,b.n]);tri(g,a.p,d.p,c.p,[a.n,d.n,c.n]);
 }
 return g;
}
function happyMouth(){const g=sphere(20,12);for(let i=0;i<g.p.length;i+=3){if(g.p[i+1]>0){g.p[i+1]*=.22;const n=norm([g.n[i],g.n[i+1]/.22,g.n[i+2]]);g.n.splice(i,3,...n);}}return g;}
function courierPrimitives(){return {happy_mouth:happyMouth(),coffee_cup:cylinder(1,.80,24),coffee_lid:cylinder(1,1,24),painted_sphere:painted(sphere(24,16)),painted_small:painted(sphere(16,10)),rounded_box:roundedBox(),rounded_ear:roundedEar(),smile_curve:smileCurve()};}

export { meshData, tri, box, sphere, cylinder, torus, plane, roof, primitives, painted, roundedBox, roundedEar, smileCurve, happyMouth, courierPrimitives };
