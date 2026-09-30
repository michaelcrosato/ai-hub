/* Small, dependency-free vector and matrix tools. All matrices are column-major. */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>vmul(a,1/(len(a)||1));
const mixv=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const projectTangent=(v,n)=>norm(vsub(v,vmul(n,dot(v,n))));
const rotate=(v,axis,a)=>vadd(vadd(vmul(v,Math.cos(a)),vmul(cross(axis,v),Math.sin(a))),vmul(axis,dot(axis,v)*(1-Math.cos(a))));
function slerp(a,b,t){const angle=Math.acos(clamp(dot(a,b),-1,1));if(angle<1e-5)return norm(mixv(a,b,t));return norm(vadd(vmul(a,Math.sin((1-t)*angle)),vmul(b,Math.sin(t*angle))));}
const ident=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mmul(a,b){const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)m[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return m;}
const transform=(m,v,w=1)=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*w,m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*w,m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*w];
function basis(x,y,z,p=[0,0,0]){return new Float32Array([...x,0,...y,0,...z,0,...p,1]);}
function compose(p=[0,0,0],r=[0,0,0],s=[1,1,1]){const [x,y,z]=r;const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);return new Float32Array([cy*cz*s[0],(cx*sz+sx*sy*cz)*s[0],(sx*sz-cx*sy*cz)*s[0],0,-cy*sz*s[1],(cx*cz-sx*sy*sz)*s[1],(sx*cz+cx*sy*sz)*s[1],0,sy*s[2],-sx*cy*s[2],cx*cy*s[2],0,...p,1]);}
function quatMatrix(q){const [x,y,z,w]=q;return new Float32Array([1-2*y*y-2*z*z,2*x*y+2*z*w,2*x*z-2*y*w,0,2*x*y-2*z*w,1-2*x*x-2*z*z,2*y*z+2*x*w,0,2*x*z+2*y*w,2*y*z-2*x*w,1-2*x*x-2*y*y,0,0,0,0,1]);}
function perspective(fov,aspect,near,far){const t=1/Math.tan(fov/2);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function lookAt(eye,target,up){const z=norm(vsub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function localFrame(n,heading=0){const x=norm(cross([0,0,1],n));const xx=len(x)<.1?[1,0,0]:vmul(x,-1);const z=norm(cross(xx,n));return basis(rotate(xx,n,heading),n,rotate(z,n,heading));}
function seeded(seed=41){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const color=hex=>{if(Array.isArray(hex))return hex;const s=hex.replace('#','');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255);};

export { TAU, clamp, lerp, vadd, vsub, vmul, dot, cross, len, norm, mixv, projectTangent, rotate, slerp, ident, mmul, transform, basis, compose, quatMatrix, perspective, ortho, lookAt, localFrame, seeded, color };
