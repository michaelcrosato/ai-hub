import { norm, vmul, vadd, vsub, dot, cross, clamp, localFrame, transform, mmul, compose, projectTangent } from './math.js';
import { CONFIG } from './config.js';
const normalAt=(u,v)=>[Math.sin(u/CONFIG.radius)*Math.cos(v/CONFIG.radius),Math.cos(u/CONFIG.radius)*Math.cos(v/CONFIG.radius),Math.sin(v/CONFIG.radius)];
const coordinates=n=>[Math.atan2(n[0],n[1])*CONFIG.radius,Math.asin(clamp(n[2],-1,1))*CONFIG.radius];
function frameAt(u,v,heading=0){const n=normalAt(u,v),m=localFrame(n,heading);m[12]=n[0]*CONFIG.radius;m[13]=n[1]*CONFIG.radius;m[14]=n[2]*CONFIG.radius;return m;}
const framePoint=(m,p)=>transform(m,p);
const frameNormal=(m,x,z)=>norm(framePoint(m,[x,0,z]));
function frameInfo(m){return {o:[m[12],m[13],m[14]],x:[m[0],m[1],m[2]],y:[m[4],m[5],m[6]],z:[m[8],m[9],m[10]]};}
class Surfaces{
 constructor(){this.floors=[];this.solids=[];this.ramps=[];this.rails=[];}
 floor(m,x,z,w,d,y,id='floor'){this.floors.push({...frameInfo(m),cx:x,cz:z,w,d,height:y,id});}
 ramp(m,x,z0,z1,w,y0,y1){const slope=(y1-y0)/(z1-z0);this.ramps.push({...frameInfo(m),cx:x,z0,z1,w,slope,intercept:y0-slope*z0});}
 solid(m,p,s,id='solid'){this.solids.push({...frameInfo(m),p,s,id});}
 rail(m,a,b,id='rail'){this.rails.push({...frameInfo(m),a:[...a],b:[...b],id});}
 floorHeight(n,maxHeight=Infinity){
  let best=0;
  for(const f of this.floors){const den=dot(n,f.y);if(den<.65)continue;const r=(dot(f.o,f.y)+f.height)/den,h=r-CONFIG.radius;if(h>maxHeight+.0001||h<best-.0001)continue;const q=vsub(vmul(n,r),f.o);const margin=f.id==='stair'?.12:.045;if(Math.abs(dot(q,f.x)-f.cx)<=f.w/2+margin&&Math.abs(dot(q,f.z)-f.cz)<=f.d/2+margin)best=h;}
  for(const f of this.ramps){const plane=vsub(f.y,vmul(f.z,f.slope)),den=dot(n,plane);if(den<.35)continue;const radius=(dot(f.o,plane)+f.intercept)/den,h=radius-CONFIG.radius;if(h>maxHeight+.0001||h<best)continue;const q=vsub(vmul(n,radius),f.o),x=dot(q,f.x),z=dot(q,f.z);if(Math.abs(x-f.cx)<=f.w/2+.035&&z>=Math.min(f.z0,f.z1)-.07&&z<=Math.max(f.z0,f.z1)+.07)best=h;}
  return best;
 }
 /** Return a wall normal. Rounded capsule corners do not catch on square boxes. */
 contact(n,h,radius=.29,height=1.42){
  const p=vmul(n,CONFIG.radius+h);
  for(const s of this.solids){
   if(dot(n,s.y)<.7)continue;const q=vsub(p,s.o),x=dot(q,s.x)-s.p[0],y=dot(q,s.y),z=dot(q,s.z)-s.p[2];
   if(y>=s.p[1]+s.s[1]/2-.025||y+height<=s.p[1]-s.s[1]/2+.03)continue;
   let dx=x-clamp(x,-s.s[0]/2,s.s[0]/2),dz=z-clamp(z,-s.s[2]/2,s.s[2]/2),l=Math.hypot(dx,dz);
   if(l>=radius)continue;
   if(l<1e-7){if(s.s[0]/2-Math.abs(x)<s.s[2]/2-Math.abs(z))dx=x>=0?1:-1;else dz=z>=0?1:-1;}
   return {normal:projectTangent(vadd(vmul(s.x,dx),vmul(s.z,dz)),n),id:s.id};
  }
  // A sloped rail is not a tall axis-aligned box at its midpoint.
  for(const s of this.rails){
   if(dot(n,s.y)<.7)continue;const q=vsub(p,s.o),x=dot(q,s.x),y=dot(q,s.y),z=dot(q,s.z);
   const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],length=dx*dx+dz*dz,t=length?clamp(((x-s.a[0])*dx+(z-s.a[2])*dz)/length,0,1):0;
   const top=s.a[1]+(s.b[1]-s.a[1])*t;
   if(y>top+.08||y+height<top-.80)continue;
   let xx=x-s.a[0]-dx*t,zz=z-s.a[2]-dz*t;
   if(Math.hypot(xx,zz)<radius+.055){if(Math.hypot(xx,zz)<1e-7){xx=-dz;zz=dx;}return {normal:projectTangent(vadd(vmul(s.x,xx),vmul(s.z,zz)),n),id:s.id};}
  }
  for(const f of this.ramps){
   if(dot(n,f.y)<.7)continue;const q=vsub(p,f.o),x=dot(q,f.x),z=dot(q,f.z),y=dot(q,f.y);
   if(Math.abs(x-f.cx)<f.w/2+radius-.06&&z>Math.min(f.z0,f.z1)&&z<Math.max(f.z0,f.z1)&&y<f.intercept+f.slope*z-.34&&(!f.openUnder||y+height>f.intercept+f.slope*z-.21))return {normal:projectTangent(vmul(f.x,x<f.cx?-1:1),n),id:'ramp_side'};
  }
  return null;
 }
 blocked(n,h){return !!this.contact(n,h);}
 /** Earliest segment hit against oriented walls and the underside of decks. */
 rayFraction(from,to,padding=.18,includeFloors=true){
  const dir=vsub(to,from);let best=1;
  const test=(f,c,size)=>{
   const q=vsub(from,f.o),axes=[f.x,f.y,f.z];let lo=0,hi=best;
   for(let k=0;k<3;k++){const pos=dot(q,axes[k])-c[k],d=dot(dir,axes[k]),r=size[k]/2+padding;
    if(Math.abs(d)<1e-8){if(Math.abs(pos)>r)return;}else{let a=(-r-pos)/d,b=(r-pos)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return;}
   }
   if(lo>=0&&lo<best&&hi>.015)best=lo;
  };
  const origin=norm(from);
  for(const s of this.solids)if(dot(origin,s.y)>.45)test(s,s.p,s.s);
  if(includeFloors)for(const f of this.floors)if(dot(origin,f.y)>.45)test(f,[f.cx,f.height-.13,f.cz],[f.w,.23,f.d]);
  return best;
 }
}
class Walker{
 constructor(surfaces){this.surfaces=surfaces;this.n=normalAt(-.8,.2);this.h=.12;this.vy=0;this.grounded=true;this.facing=[0,0,1];this.distance=0;this.moving=0;this.strength=0;this.coyote=0;this.jumpBuffer=0;}
 setAt(n,h=0){this.n=norm(n);this.h=Number.isFinite(h)?Math.max(0,h):0;this.vy=0;this.grounded=true;this.moving=0;this.strength=0;this.jumpBuffer=0;this.coyote=.10;}
 jump(){if(this.grounded||this.coyote>0){this.vy=CONFIG.jumpSpeed;this.grounded=false;this.coyote=0;this.jumpBuffer=0;return true;}this.jumpBuffer=.12;return false;}
 update(dt,input,forward){
  let remaining=Math.min(Math.max(0,dt),.07);
  const amount=Math.min(1,Math.hypot(input.x,input.y));this.strength=amount>.01?amount:0;this.moving=this.strength;
  const d=norm(vadd(vmul(forward,-input.y),vmul(norm(cross(forward,this.n)),input.x)));
  while(remaining>1e-7){const step=Math.min(remaining,1/90);remaining-=step;this.tick(step,this.moving?d:[0,0,0],input.run);}
  return this.moving;
 }
 tick(dt,dir,run){
  this.coyote=this.grounded?.10:Math.max(0,this.coyote-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  if(this.moving){
   const speed=(run?CONFIG.runSpeed:CONFIG.walkSpeed)*this.strength*dt,before=[...this.n];
   const tryMove=d=>{
    const target=norm(vadd(this.n,vmul(d,speed/CONFIG.radius))),floor=this.surfaces.floorHeight(target,this.h+(this.grounded?CONFIG.stepHeight:.02));
    const stepH=this.grounded?Math.max(this.h,floor):this.h,hit=this.surfaces.contact(target,stepH);
    if(hit)return hit;this.n=target;if(this.grounded&&floor>this.h)this.h=floor;return null;
   };
   const hit=tryMove(dir);
   if(hit){const slide=vsub(dir,vmul(hit.normal,Math.min(0,dot(dir,hit.normal))));if(Math.hypot(...slide)>.02)tryMove(slide);}
   this.distance+=Math.acos(clamp(dot(before,this.n),-1,1))*CONFIG.radius;this.facing=projectTangent(dir,this.n);
  }
  const oldH=this.h,wasGrounded=this.grounded;this.vy-=CONFIG.gravity*dt;let next=this.h+this.vy*dt;
  const floor=this.surfaces.floorHeight(this.n,oldH+CONFIG.stepHeight);
  // Follow small descending steps without a repeated fall and landing cycle.
  if(this.vy<=0&&(next<=floor||(wasGrounded&&oldH-floor<CONFIG.stepHeight))){next=floor;this.vy=0;this.grounded=true;}else this.grounded=false;
  this.h=Math.max(0,next);if(this.grounded&&this.jumpBuffer>0)this.jump();
 }
 get position(){return vmul(this.n,CONFIG.radius+this.h);}
}
export { normalAt, coordinates, frameAt, framePoint, frameNormal, frameInfo, Surfaces, Walker };
