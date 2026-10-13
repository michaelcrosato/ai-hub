/* Meridian software perspective rasterizer. No engine or browser dependency.
 * World coordinates are metres. Non-indexed mesh.vertices stride:
 * x,y,z,r,g,b,glow (RGB/glow 0..1). Flat triangle colors are intentional.
 * Surface: resize(w,h), clear(camera or [topColor,bottomColor]),
 * draw(mesh,camera,{fog:600}), present(canvas2DContext).
 * data is RGBA Uint8ClampedArray; depth is Float32 inverse depth, cleared to 0.
 * All six frustum planes clip in camera space before bounded raster loops.
 */
(function(root){
 'use strict';
 const LITTLE=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=Number.isFinite;
 const pack=(r,g,b)=>LITTLE?((255<<24)|(b<<16)|(g<<8)|r)>>>0:((r<<24)|(g<<16)|(b<<8)|255)>>>0;
 function color(value,fallback){
  if(Array.isArray(value)||ArrayBuffer.isView(value)){const scale=Math.max(...value)>1?1:255;return[value[0],value[1],value[2]].map(v=>clamp(Math.round((finite(v)?v:0)*scale),0,255));}
  if(typeof value==='string'&&/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)){let s=value.slice(1);if(s.length===3)s=s.split('').map(c=>c+c).join('');const n=parseInt(s,16);return[n>>16&255,n>>8&255,n&255];}
  return fallback;
 }
 function code(x,y,z,near,far,tx,ty){return(z<near?1:0)|(z>far?2:0)|(x < -z*tx?4:0)|(x > z*tx?8:0)|(y < -z*ty?16:0)|(y > z*ty?32:0);}
 function distance(p,plane,near,far,tx,ty){switch(plane){case 0:return p[2]-near;case 1:return far-p[2];case 2:return p[0]+p[2]*tx;case 3:return p[2]*tx-p[0];case 4:return p[1]+p[2]*ty;default:return p[2]*ty-p[1];}}
 function clipPolygon(poly,plane,near,far,tx,ty){
  const out=[];let a=poly[poly.length-1],da=distance(a,plane,near,far,tx,ty),insideA=da>=0;
  for(const b of poly){const db=distance(b,plane,near,far,tx,ty),insideB=db>=0;
   if(insideA!==insideB){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
   if(insideB)out.push(b);a=b;da=db;insideA=insideB;
  }return out;
 }
 class Surface{
  constructor(width=360,height=225){this.width=0;this.height=0;this.stats={};this.resize(width,height);this.clear();}
  resize(width,height){
   width=Math.floor(width);height=Math.floor(height);
   if(!finite(width)||!finite(height)||width<1||height<1||width>4096||height>4096)throw new RangeError('Raster surface dimensions must be 1–4096 pixels.');
   if(width===this.width&&height===this.height)return this;
   this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);this.pixels=new Uint32Array(this.data.buffer);this.depth=new Float32Array(width*height);this.subjects=new Uint8Array(width*height);this.glow=new Float32Array(width*height);this._image=null;this._imageLinked=false;return this;
  }
  clear(sky){
   let top=[5,12,22],bottom=[43,60,69],pitch=0;
   if(sky?.forward)pitch=clamp(-sky.forward[2],-1,1);
   else if(typeof sky==='string'||(Array.isArray(sky)&&typeof sky[0]==='number'))top=bottom=color(sky,top);
   else if(Array.isArray(sky)){top=color(sky[0],top);bottom=color(sky[1]||sky[0],bottom);}
   else if(sky&&typeof sky==='object'){top=color(sky.top,top);bottom=color(sky.bottom,bottom);pitch=finite(sky.pitch)?sky.pitch:0;}
   const w=this.width,h=this.height,pixels=this.pixels;
   for(let y=0;y<h;y++){const t=clamp(y/Math.max(1,h-1)-pitch*.2,0,1),smooth=t*t*(3-2*t),r=Math.round(top[0]+(bottom[0]-top[0])*smooth),g=Math.round(top[1]+(bottom[1]-top[1])*smooth),b=Math.round(top[2]+(bottom[2]-top[2])*smooth);pixels.fill(pack(r,g,b),y*w,(y+1)*w);}
   this.depth.fill(0);this.subjects.fill(0);this.glow.fill(0);this.stats={drawCalls:0,meshesRejected:0,trianglesInput:0,trianglesRejected:0,trianglesClipped:0,trianglesRasterized:0,pixelsTested:0,pixelsWritten:0};return this;
  }
  draw(mesh,camera,options={}){
   const vertices=mesh?.vertices;if(!vertices?.length)return this;
   const count=Math.floor(vertices.length/21),stats=this.stats;stats.drawCalls++;stats.trianglesInput+=count;
   const e=camera?.eye,r=camera?.right,u=camera?.up,f=camera?.forward;
   if(!e||!r||!u||!f||![...e,...r,...u,...f].every(finite))throw new TypeError('Raster camera needs finite eye/right/up/forward vectors.');
   const near=Math.max(.0001,finite(camera.near)?camera.near:.12),far=finite(camera.far)?Math.max(near+.001,camera.far):2400;
   const tangent=Math.tan(clamp(finite(camera.fov)?camera.fov:62,1,179)*Math.PI/360),aspect=camera.width>0&&camera.height>0?camera.width/camera.height:this.width/this.height;
   const tx=tangent*aspect,ty=tangent,fx=this.width/(2*tx),fy=this.height/(2*ty),cx=this.width/2,cy=this.height/2;
   const ex=e[0],ey=e[1],ez=e[2],rx=r[0],ry=r[1],rz=r[2],ux=u[0],uy=u[1],uz=u[2],dx=f[0],dy=f[1],dz=f[2];
   const transform=(x,y,z)=>{x-=ex;y-=ey;z-=ez;return[x*rx+y*ry+z*rz,x*ux+y*uy+z*uz,x*dx+y*dy+z*dz];};
   const bounds=mesh.bounds;
   if(bounds?.length===6&&Array.from(bounds).every(finite)){
    let common=63;for(let i=0;i<8&&common;i++){const p=transform(bounds[i&1?3:0],bounds[i&2?4:1],bounds[i&4?5:2]);common&=code(p[0],p[1],p[2],near,far,tx,ty);}
    if(common){stats.meshesRejected++;stats.trianglesRejected+=count;return this;}
   }
   const fog=options.fog===false||options.fog===0?0:finite(options.fog)?Math.max(.001,options.fog):600;
   for(let i=0;i+20<vertices.length;i+=21){
    const a=transform(vertices[i],vertices[i+1],vertices[i+2]),b=transform(vertices[i+7],vertices[i+8],vertices[i+9]),c=transform(vertices[i+14],vertices[i+15],vertices[i+16]);
    if(![...a,...b,...c].every(finite)){stats.trianglesRejected++;continue;}
    const ca=code(...a,near,far,tx,ty),cb=code(...b,near,far,tx,ty),cc=code(...c,near,far,tx,ty);
    if(ca&cb&cc){stats.trianglesRejected++;continue;}
    const outside=ca|cb|cc;let poly=[a,b,c];
    if(outside){stats.trianglesClipped++;for(let plane=0;plane<6&&poly.length;plane++)if(outside&(1<<plane))poly=clipPolygon(poly,plane,near,far,tx,ty);}
    if(poly.length<3){stats.trianglesRejected++;continue;}
    const glow=clamp(finite(vertices[i+6])?vertices[i+6]:0,0,1),light=.88+glow*.63;
    let red=clamp(finite(vertices[i+3])?vertices[i+3]:0,0,1)*light,green=clamp(finite(vertices[i+4])?vertices[i+4]:0,0,1)*light,blue=clamp(finite(vertices[i+5])?vertices[i+5]:0,0,1)*light;
    if(fog){const mx=(a[0]+b[0]+c[0])/3,my=(a[1]+b[1]+c[1])/3,mz=(a[2]+b[2]+c[2])/3,dist=Math.hypot(mx,my,mz),mist=Math.min(.96,1-Math.exp(-Math.pow(dist/fog,1.65))),height=clamp((vertices[i+2]+vertices[i+9]+vertices[i+16])/3/550,0,1),hr=.055+(.035-.055)*height,hg=.13+(.078-.13)*height,hb=.19+(.13-.19)*height;red+=(hr-red)*mist;green+=(hg-green)*mist;blue+=(hb-blue)*mist;}
    const rgba=pack(clamp(Math.round(red*255),0,255),clamp(Math.round(green*255),0,255),clamp(Math.round(blue*255),0,255));
    let submitted=false;for(let j=1;j+1<poly.length;j++)submitted=this._triangle(poly[0],poly[j],poly[j+1],fx,fy,cx,cy,rgba,mesh.subjects?.[i/7]?1:0,glow)||submitted;
    if(!submitted)stats.trianglesRejected++;
   }return this;
  }
  _triangle(a,b,c,fx,fy,cx,cy,rgba,subject=0,glow=0){
   let za=1/a[2],zb=1/b[2],zc=1/c[2],ax=cx+a[0]*za*fx,ay=cy-a[1]*za*fy,bx=cx+b[0]*zb*fx,by=cy-b[1]*zb*fy,cx0=cx+c[0]*zc*fx,cy0=cy-c[1]*zc*fy;
   let area=(bx-ax)*(cy0-ay)-(by-ay)*(cx0-ax);
   if(!finite(area)||Math.abs(area)<1e-8)return false;
   if(area<0){[bx,cx0]=[cx0,bx];[by,cy0]=[cy0,by];[zb,zc]=[zc,zb];area=-area;}
   const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx0)-.5)),x1=Math.min(this.width-1,Math.floor(Math.max(ax,bx,cx0)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy0)-.5)),y1=Math.min(this.height-1,Math.floor(Math.max(ay,by,cy0)-.5));
   if(x1<x0||y1<y0)return false;
   const e0x=by-cy0,e0y=cx0-bx,e1x=cy0-ay,e1y=ax-cx0,e2x=ay-by,e2y=bx-ax;
   const px=x0+.5,py=y0+.5;let row0=(cx0-bx)*(py-by)-(cy0-by)*(px-bx),row1=(ax-cx0)*(py-cy0)-(ay-cy0)*(px-cx0),row2=(bx-ax)*(py-ay)-(by-ay)*(px-ax);
   const invArea=1/area,zx=(e0x*za+e1x*zb+e2x*zc)*invArea,zy=(e0y*za+e1y*zb+e2y*zc)*invArea;
   let rowZ=(row0*za+row1*zb+row2*zc)*invArea;
   const w=this.width,depth=this.depth,pixels=this.pixels,epsilon=area*1e-12;let written=0;
   for(let y=y0;y<=y1;y++){let e0=row0,e1=row1,e2=row2,z=rowZ,idx=y*w+x0;
    for(let x=x0;x<=x1;x++,idx++){if(e0>=-epsilon&&e1>=-epsilon&&e2>=-epsilon&&z>depth[idx]){depth[idx]=z;pixels[idx]=rgba;this.subjects[idx]=subject;this.glow[idx]=glow;written++;}e0+=e0x;e1+=e1x;e2+=e2x;z+=zx;}
    row0+=e0y;row1+=e1y;row2+=e2y;rowZ+=zy;
   }
   this.stats.trianglesRasterized++;this.stats.pixelsTested+=(x1-x0+1)*(y1-y0+1);this.stats.pixelsWritten+=written;return true;
  }
  present(ctx){
   if(!ctx||typeof ctx.putImageData!=='function')throw new TypeError('present requires a Canvas 2D context.');
   if(!this._image){if(typeof ImageData!=='undefined'){this._image=new ImageData(this.data,this.width,this.height);this._imageLinked=this._image.data.buffer===this.data.buffer;}else{this._image=ctx.createImageData(this.width,this.height);this._imageLinked=false;}}
   if(!this._imageLinked)this._image.data.set(this.data);ctx.putImageData(this._image,0,0);return this;
  }
 }
 root.MeridianRaster={Surface,version:'1.0.0'};
})(typeof window!=='undefined'?window:globalThis);
