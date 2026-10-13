/* Meridian camera extension. Metres, z up. Pure camera mathematics shared by
 * WebGL drawing, ground picking, and movement. The original E.View stays intact. */
(function(root){
 'use strict';
 const D=Math.PI/180,EPS=1e-8;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const mul=(a,n)=>a.map(v=>v*n),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const length=a=>Math.hypot(...a),norm=a=>{const l=length(a);return l>EPS?mul(a,1/l):[0,0,0];};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function basis(eye,target){
  let forward=norm(sub(target,eye));if(length(forward)<EPS)forward=[0,1,0];
  let right=norm(cross(forward,[0,0,1]));if(length(right)<EPS)right=[1,0,0];
  return{forward,right,up:norm(cross(right,forward))};
 }
 function segmentBox(from,to,box){
  let lo=0,hi=1;
  for(let i=0;i<3;i++){const d=to[i]-from[i];if(Math.abs(d)<EPS){if(from[i]<box[i]||from[i]>box[i+3])return null;}else{let a=(box[i]-from[i])/d,b=(box[i+3]-from[i])/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return null;}}
  return lo;
 }
 function avoidBuildings(eye,target,buildings,ignoredIds=[]){
  const skip=new Set(ignoredIds),distance=length(sub(eye,target));let nearest=1;
  for(const b of buildings){if(skip.has(b.id))continue;const t=segmentBox(target,eye,[b.x-.15,b.y-.15,-.1,b.x+b.w+.15,b.y+b.d+.15,b.height+.15]);if(t!==null)nearest=Math.min(nearest,t);}
  if(nearest===1)return eye.slice();return add(target,mul(sub(eye,target),Math.max(0,nearest-.7/Math.max(distance,1))));
 }
 class Camera{
  constructor(width=800,height=500){this.width=width;this.height=height;this.fov=62;this.near=.12;this.far=2400;this.pose([20,20,20],[0,0,0]);}
  resize(width,height){this.width=Math.max(1,width);this.height=Math.max(1,height);return this;}
  pose(eye,target,options={}){
   this.eye=eye.slice();this.target=target.slice();Object.assign(this,basis(eye,target));
   if(options.fov!==undefined)this.fov=clamp(options.fov,30,100);
   if(options.near!==undefined)this.near=Math.max(.01,options.near);
   if(options.far!==undefined)this.far=Math.max(this.near+1,options.far);
   this.focal=this.height*.5/Math.tan(this.fov*D*.5);return this;
  }
  orbit(target,yaw,pitch,distance,options={}){
   const a=yaw*D,p=pitch*D,offset=[Math.cos(a)*Math.cos(p)*distance,Math.sin(a)*Math.cos(p)*distance,Math.sin(p)*distance];
   return this.pose(add(target,offset),target,options);
  }
  look(eye,yaw,pitch,options={}){
   const a=yaw*D,p=pitch*D,d=[-Math.cos(a)*Math.cos(p),-Math.sin(a)*Math.cos(p),-Math.sin(p)];
   return this.pose(eye,add(eye,d),options);
  }
  project(point){
   const delta=sub(point,this.eye),depth=dot(delta,this.forward),f=this.height*.5/Math.tan(this.fov*D*.5);
   const x=this.width*.5+dot(delta,this.right)*f/depth,y=this.height*.5-dot(delta,this.up)*f/depth;
   return{x,y,depth,scale:f/depth,visible:depth>=this.near&&depth<=this.far&&x>=0&&x<=this.width&&y>=0&&y<=this.height};
  }
  ray(x,y){
   const f=this.height*.5/Math.tan(this.fov*D*.5),u=(x-this.width*.5)/f,v=(this.height*.5-y)/f;
   return{origin:this.eye.slice(),direction:norm(add(this.forward,add(mul(this.right,u),mul(this.up,v))))};
  }
  groundPoint(x,y,z=0){
   const r=this.ray(x,y);if(Math.abs(r.direction[2])<EPS)return null;
   const t=(z-r.origin[2])/r.direction[2];if(t<0)return null;
   const p=add(r.origin,mul(r.direction,t)),depth=dot(sub(p,this.eye),this.forward);
   return depth>=this.near&&depth<=this.far?p:null;
  }
  moveOnGround(sx,sy){
   const r=norm([this.right[0],this.right[1],0]),f=norm([this.forward[0],this.forward[1],0]);
   const v=norm(add(mul(r,sx),mul(f,-sy))),m=Math.min(1,Math.hypot(sx,sy));return[v[0]*m,v[1]*m];
  }
  matrix(relativeToEye=false){
   const f=1/Math.tan(this.fov*D*.5),fx=f/(this.width/this.height),a=(this.far+this.near)/(this.far-this.near),b=-2*this.far*this.near/(this.far-this.near),r=this.right,u=this.up,d=this.forward,e=relativeToEye?[0,0,0]:this.eye;
   return new Float32Array([r[0]*fx,u[0]*f,d[0]*a,d[0],r[1]*fx,u[1]*f,d[1]*a,d[1],r[2]*fx,u[2]*f,d[2]*a,d[2],-dot(r,e)*fx,-dot(u,e)*f,-dot(d,e)*a+b,-dot(d,e)]);
  }
  state(){return{eye:this.eye.slice(),target:this.target.slice(),fov:this.fov,near:this.near,far:this.far};}
 }
 root.MeridianCamera={Camera,math:{add,sub,mul,dot,cross,length,norm,basis,segmentBox,avoidBuildings}};
})(typeof window!=='undefined'?window:globalThis);
