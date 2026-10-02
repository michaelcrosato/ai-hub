/** Shared geometry math. The editable document uses the game's Z-up axes. */
const vadd = (a,b) => a.map((n,i)=>n+b[i]);
const vsub = (a,b) => a.map((n,i)=>n-b[i]);
const vmul = (a,s) => a.map(n=>n*s);
const vdot = (a,b) => a.reduce((s,n,i)=>s+n*b[i],0);
const vcross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vnorm = a => vmul(a,1/(Math.hypot(...a)||1));
const bound = (n,min,max) => Math.min(max,Math.max(min,n));
const round = (n,p=5) => +n.toFixed(p);
function rotatePoint(p,r) {
  // Rz(yaw) * Ry(tilt) * Rx(pitch). Angles are in radians.
  const [a,b,c]=r, [ca,sa,cb,sb,cc,sc]=[Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b),Math.cos(c),Math.sin(c)];
  const x=p[0], y=p[1]*ca-p[2]*sa, z=p[1]*sa+p[2]*ca;
  const xx=x*cb+z*sb, zz=-x*sb+z*cb;
  return [xx*cc-y*sc,xx*sc+y*cc,zz];
}
function inverseRotate(p,r) {
  const [a,b,c]=r, cc=Math.cos(c),sc=Math.sin(c),cb=Math.cos(b),sb=Math.sin(b),ca=Math.cos(a),sa=Math.sin(a);
  const x=p[0]*cc+p[1]*sc,y=-p[0]*sc+p[1]*cc,z=p[2];
  const xx=x*cb-z*sb,zz=x*sb+z*cb;
  return [xx,y*ca+zz*sa,-y*sa+zz*ca];
}
function transformPoint(p,part) { return vadd(rotatePoint(p.map((n,i)=>n*part.scale[i]),part.rotation),part.position); }
function m4mul(a,b) {
  const o=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) o[c*4+r]+=a[k*4+r]*b[c*4+k];
  return o;
}
function perspective(fov,aspect,near,far) {
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
function orthographic(size,aspect,near,far) {
  return new Float32Array([1/(size*aspect),0,0,0,0,1/size,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1]);
}
function lookAt(eye,target,up=[0,0,1]) {
  const z=vnorm(vsub(eye,target)), x=vnorm(vcross(up,z)), y=vcross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vdot(x,eye),-vdot(y,eye),-vdot(z,eye),1]);
}
function project(p,m,width,height) {
  const q=[0,0,0,0]; for(let r=0;r<4;r++) q[r]=m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r];
  return [(q[0]/q[3]*.5+.5)*width,(-q[1]/q[3]*.5+.5)*height,q[2]/q[3],q[3]];
}
function rayTriangle(origin,dir,a,b,c) {
  const e1=vsub(b,a),e2=vsub(c,a),h=vcross(dir,e2),det=vdot(e1,h);
  if(Math.abs(det)<1e-9)return null;
  const f=1/det,s=vsub(origin,a),u=f*vdot(s,h); if(u<0||u>1)return null;
  const q=vcross(s,e1),v=f*vdot(dir,q); if(v<0||u+v>1)return null;
  const t=f*vdot(e2,q); return t>1e-7?t:null;
}
const BOX_VERTICES=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
const BOX_FACES=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
function localMesh(part) {
  if(part.kind==='box') return {vertices:BOX_VERTICES.map(v=>v.map((n,i)=>n*part.size[i])),faces:BOX_FACES};
  return {vertices:part.vertices,faces:part.faces};
}
function worldMesh(part) { const m=localMesh(part); return {vertices:m.vertices.map(v=>transformPoint(v,part)),faces:m.faces}; }
function triangles(part) {
  const {vertices,faces}=worldMesh(part),out=[];
  for(const f of faces) for(let i=1;i<f.length-1;i++) out.push([vertices[f[0]],vertices[f[i]],vertices[f[i+1]]]);
  return out;
}
function boundsOf(parts) {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of parts) for(const v of worldMesh(p).vertices) for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}
  if(!Number.isFinite(min[0]))return {min:[0,0,0],max:[1,1,1],size:[1,1,1],center:[.5,.5,.5]};
  return {min,max,size:vsub(max,min),center:vmul(vadd(min,max),.5)};
}
function hexColor(c) { return '#'+c.slice(0,3).map(n=>Math.round(bound(n,0,1)*255).toString(16).padStart(2,'0')).join(''); }
function rgbaHex(hex,alpha=1) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(alpha); }

export { vadd, vsub, vmul, vdot, vcross, vnorm, bound, round, rotatePoint, inverseRotate, transformPoint, m4mul, perspective, orthographic, lookAt, project, rayTriangle, BOX_VERTICES, BOX_FACES, localMesh, worldMesh, triangles, boundsOf, hexColor, rgbaHex };
