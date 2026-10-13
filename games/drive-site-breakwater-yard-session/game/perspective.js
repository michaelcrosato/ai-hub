/* Breakwater perspective extension for my-3D2dge. Original code, MIT. */
(function(root){'use strict';
const E=root.My3D2dge;
// Perspective faces cover many scan lines. Native filled paths reduce draw calls;
// snapped vertices and the engine's low-resolution buffer keep the pixel scale.
E.px.projectedPoly=function(g,pts,color){E.px.col(g,color);g.beginPath();g.moveTo(Math.round(pts[0][0]),Math.round(pts[0][1]));for(let i=1;i<pts.length;i++)g.lineTo(Math.round(pts[i][0]),Math.round(pts[i][1]));g.closePath();g.fill();};

function clip(poly, axis, edge, above){const out=[];if(!poly.length)return out;let a=poly[poly.length-1],ain=above?a[axis]>=edge:a[axis]<=edge;for(const b of poly){const bin=above?b[axis]>=edge:b[axis]<=edge;if(bin!==ain){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,i)=>v+(b[i]-v)*t));}if(bin)out.push(b);a=b;ain=bin;}return out;}
class PerspectiveRenderer{
 constructor(){this.faces=[];this.labels=[];this.fogColors=new Map();this.sky=new Image();this.sky.src='assets/harbor-sky.png';this.stats={faces:0,culled:0};this.fog='#98aca4';}
 begin(g,w,h,c,t){this.g=g;this.w=w;this.h=h;this.c=c;this.t=t;this.faces.length=0;this.labels.length=0;this.stats.faces=0;this.stats.culled=0;let dx=c.tx-c.x,dy=c.ty-c.y,dz=c.tz-c.z;const len=Math.hypot(dx,dy,dz)||1;this.f=[dx/len,dy/len,dz/len];const fl=Math.hypot(this.f[0],this.f[1])||1;this.right=[-this.f[1]/fl,this.f[0]/fl,0];this.up=[-this.f[0]*this.f[2]/fl,-this.f[1]*this.f[2]/fl,fl];this.focal=h*(c.focal||.91);this.cy=h*(c.center||.46);
 const horizon=this.cy+this.focal*this.f[2]/fl;E.px.rect(g,0,0,w,h,'#c4b3a1');
 if(this.sky.complete&&this.sky.naturalWidth){const sh=Math.max(h*.9,horizon+h*.7);g.drawImage(this.sky,0,0,this.sky.width,this.sky.height,0,Math.round(horizon-sh*.83),w,Math.round(sh));E.px.reset(g);}else{for(let i=0;i<12;i++)E.px.rect(g,0,i*h/12,w,h/12+1,E.mix('#637f99','#d6b297',i/11));}
 }
 cameraPoint(p){const dx=p[0]-this.c.x,dy=p[1]-this.c.y,dz=p[2]-this.c.z;return[dx*this.right[0]+dy*this.right[1],dx*this.up[0]+dy*this.up[1]+dz*this.up[2],dx*this.f[0]+dy*this.f[1]+dz*this.f[2]];}
 project(p){const v=this.cameraPoint(p);if(v[2]<1.2)return null;const k=this.focal/v[2];return[this.w*.5+v[0]*k,this.cy-v[1]*k,v[2],k];}
 face(pts,color,opts){if(opts&&opts.cull){const a=pts[0],b=pts[1],c=pts[2],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];if((uy*vz-uz*vy)*(this.c.x-a[0])+(uz*vx-ux*vz)*(this.c.y-a[1])+(ux*vy-uy*vx)*(this.c.z-a[2])<=0){this.stats.culled++;return;}}let cpts=pts.map(p=>this.cameraPoint(p));let depth=0;for(const p of cpts)depth+=p[2];depth/=cpts.length;if(depth>490||cpts.every(p=>p[2]<1.2)){this.stats.culled++;return;}cpts=clip(cpts,2,1.2,true);if(cpts.length<3)return;let pp=cpts.map(v=>[this.w*.5+v[0]*this.focal/v[2],this.cy-v[1]*this.focal/v[2]]);if(pp.every(v=>v[0]<0)||pp.every(v=>v[0]>this.w)||pp.every(v=>v[1]<0)||pp.every(v=>v[1]>this.h)){this.stats.culled++;return;}pp=clip(clip(clip(clip(pp,0,-1,true),0,this.w+1,false),1,-1,true),1,this.h+1,false);if(pp.length<3)return;const fog=opts&&opts.noFog?0:Math.round(E.clamp((depth-105)/420,0,.72)*16)/16;let col=color;if(fog){const key=color+':'+fog;col=this.fogColors.get(key);if(!col){col=E.mix(color,this.fog,fog);this.fogColors.set(key,col);}}this.faces.push({p:pp,c:col,d:depth+(opts&&opts.bias||0),a:opts&&opts.alpha||1});}
 line(a,b,width,color,opts){const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,nx=-dy/d*width/2,ny=dx/d*width/2;this.face([[a[0]+nx,a[1]+ny,a[2]],[b[0]+nx,b[1]+ny,b[2]],[b[0]-nx,b[1]-ny,b[2]],[a[0]-nx,a[1]-ny,a[2]]],color,opts);}
 label(p,text,color,scale){const q=this.project(p);if(q&&q[0]>-40&&q[0]<this.w+40&&q[1]>0&&q[1]<this.h&&q[2]<150)this.labels.push({p:q,text,color,scale:scale||1});}
 finish(){const g=this.g;this.faces.sort((a,b)=>b.d-a.d);for(const f of this.faces){if(f.a<1)E.px.blend(g,f.a,'normal',()=>E.px.projectedPoly(g,f.p,f.c));else E.px.projectedPoly(g,f.p,f.c);}this.stats.faces=this.faces.length;for(const l of this.labels)E.font.text(g,l.text,l.p[0],l.p[1],l.color,{align:'center',scale:l.scale,outline:'#18353c',shadow:'#102a36'});}
}
E.PerspectiveRenderer=PerspectiveRenderer;
root.BreakwaterMesh={
 face(list,p,c,o){list.push({p,c,o});},
 box(list,x,y,z,w,d,h,c){const start=list.length,shade=E.shade;const x1=x+w,y1=y+d,z1=z+h;list.push({p:[[x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]],c:shade(c,.12)},{p:[[x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]],c:shade(c,-.08)},{p:[[x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]],c:shade(c,-.23)},{p:[[x1,y1,z],[x,y1,z],[x,y1,z1],[x1,y1,z1]],c:shade(c,-.04)},{p:[[x,y1,z],[x,y,z],[x,y,z1],[x,y1,z1]],c:shade(c,-.26)});for(let i=start;i<list.length;i++)list[i].o={cull:true};},
 beam(list,a,b,w,c){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy)||1,nx=-dy/l*w/2,ny=dx/l*w/2,h=w/2;const pts=[[a[0]+nx,a[1]+ny,a[2]-h],[a[0]-nx,a[1]-ny,a[2]-h],[a[0]-nx,a[1]-ny,a[2]+h],[a[0]+nx,a[1]+ny,a[2]+h],[b[0]+nx,b[1]+ny,b[2]-h],[b[0]-nx,b[1]-ny,b[2]-h],[b[0]-nx,b[1]-ny,b[2]+h],[b[0]+nx,b[1]+ny,b[2]+h]];for(const [f,s]of [[[0,1,5,4],-.25],[[1,2,6,5],-.12],[[2,3,7,6],.22],[[3,0,4,7],0]])list.push({p:f.map(i=>pts[i]),c:E.shade(c,s)});},
};
})(window);
