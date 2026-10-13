/* Original Nacre street surfaces. Metres in; existing 20-unit engine out.
 * Rendering only. Never changes a building, road, route or collision shape. */
(function(root,factory){'use strict';const api=factory(root&&root.My3D2dge);if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.NacreCityStreets=api;if(root.My3D2dge)root.My3D2dge.NacreCityStreets=api;}})(typeof globalThis!=='undefined'?globalThis:this,function(defaultEngine){
'use strict';
const U=20,TILE=8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS=Object.freeze({walk:'#c4b797',walkJoint:'#958e76',road:'#697168',roadJoint:'#465750',kerb:'#e1d1aa',gutter:'#394d47',blocked:'#867967',plinth:'#656555',cap:'#b3a184',rim:'#d2bd98',mortar:'#686451'});
function hash(x,y){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function quad(a,b,width){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-7)return null;const x=-dy/len*width/2,y=dx/len*width/2;return[[a.x-x,a.y-y],[b.x-x,b.y-y],[b.x+x,b.y+y],[a.x+x,a.y+y]];}
function pathPoly(g,p){g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();}
function fill(g,p,color){g.beginPath();pathPoly(g,p);g.fillStyle=color;g.fill();g._c=null;}
function rect(b,z=0){return[[b.x,b.y,z],[b.x+b.w,b.y,z],[b.x+b.w,b.y+b.d,z],[b.x,b.y+b.d,z]];}
function finiteFeature(b){return b&&[b.x,b.y,b.w,b.d,b.h??0].every(Number.isFinite)&&b.w>0&&b.d>0;}
function segments(roads){const out=[];for(const road of roads||[]){const p=road.points||[],w=road.width;if(!Number.isFinite(w)||w<=0||p.length<2)continue;for(let i=1;i<p.length;i++){
 const a=p[i-1],b=p[i];if(![a.x,a.y,b.x,b.y].every(Number.isFinite))continue;
 let intervals=[[0,1]];if(road.bridge&&!(road.bridgeSpans||[]).length)continue;
 if(p.length===2)for(const span of road.bridgeSpans||[]){const next=[];for(const [lo,hi]of intervals){if(span.from>lo)next.push([lo,Math.min(hi,span.from)]);if(span.to<hi)next.push([Math.max(lo,span.to),hi]);}intervals=next.filter(([lo,hi])=>hi-lo>1e-7);}
 for(const [lo,hi]of intervals){const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),A=at(lo),B=at(hi),side=clamp(w*.19,.62,1.65),inner=Math.max(1.1,w-side*2),full=quad(A,B,w);if(full)out.push({a:A,b:B,width:w,inner,full,kerb:quad(A,B,inner+.25),gut:quad(A,B,inner+.10),road:quad(A,B,inner)});}
 }}return out;}
class Painter{
 constructor(options={}){this.E=options.engine||defaultEngine;if(!this.E?.View||!this.E?.mkCanvas)throw Error('NacreCityStreets needs the my-3d2dge engine.');this.maxCachePixels=options.maxCachePixels??1500000;this.maxCacheEntries=options.maxCacheEntries??24;this.maxTileDraws=options.maxTileDraws??384;this.cache=new Map();this.pixels=0;this.metrics={hits:0,misses:0,evictions:0,tileDraws:0,roads:0,footprints:0,plinths:0};this._data=null;this._segments=[];}
 clear(){this.cache.clear();this.pixels=0;this._data=null;return this;}
 setProfiles(){return this.clear();}
 stats(){return{...this.metrics,entries:this.cache.size,pixels:this.pixels,maxPixels:this.maxCachePixels};}
 _project(r,p){return r.w(p[0]*U,p[1]*U,(p[2]||0)*U);}
 _bounds(r,options){if(options?.bounds)return options.bounds;const corners=[];for(const x of[0,r.bw||r.W])for(const y of[0,r.bh||r.H]){const p=r.view.toGround(x+(r.ix||0),y+(r.iy||0));if(p)corners.push(p);}if(corners.length!==4)return null;const xs=corners.map(p=>p[0]/U),ys=corners.map(p=>p[1]/U);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),d:Math.max(...ys)-Math.min(...ys)};}
 _stamp(view,kind){const scale=Math.pow(2,Math.round(Math.log2(Math.max(.08,view.scale))*2)/2),key=[kind,view.yawDeg,view.pitchDeg,view.zBoost,scale].join('|');if(this.cache.has(key)){const v=this.cache.get(key);this.cache.delete(key);this.cache.set(key,v);this.metrics.hits++;return v;}this.metrics.misses++;
  const E=this.E,v=new E.View('street-tile','Street tile',view.yawDeg,view.pitchDeg,scale,view.zBoost),P=(x,y)=>v.p(x*U,y*U,0),points=[[0,0],[TILE,0],[TILE,TILE],[0,TILE]].map(p=>P(...p)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.floor(Math.min(...xs))-1,y=Math.floor(Math.min(...ys))-1,c=E.mkCanvas(Math.ceil(Math.max(...xs)-x)+2,Math.ceil(Math.max(...ys)-y)+2),g=E.ctx2d(c),project=(x0,y0)=>{const p=P(x0,y0);return[p[0]-x,p[1]-y];};
  const road=kind==='road',base=road?COLORS.road:COLORS.walk,joint=road?COLORS.roadJoint:COLORS.walkJoint;fill(g,points.map(p=>[p[0]-x,p[1]-y]),joint);
  const row=road?.40:1,col=road?.64:1.6,gap=road?.034:.024;
  for(let yy=0,j=0;yy<TILE;yy+=row,j++)for(let xx=-(j%2)*col/2,i=0;xx<TILE;xx+=col,i++){const x0=Math.max(0,xx+gap),y0=yy+gap,x1=Math.min(TILE,xx+col-gap),y1=Math.min(TILE,yy+row-gap);if(x1<=x0||y1<=y0)continue;const n=hash(i+31,j+59),color=E.shade(base,(n-.5)*(road?.11:.08));fill(g,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>project(...p)),color);if(road&&n>.8){g.strokeStyle=COLORS.roadJoint;g.lineWidth=1;g.beginPath();g.moveTo(...project(x0+.07,y0+.08));g.lineTo(...project(x0+.17,y0+.14));g.stroke();}}
  const st={c,x,y,scale,pixels:c.width*c.height};while(this.cache.size&&(this.cache.size>=this.maxCacheEntries||this.pixels+st.pixels>this.maxCachePixels)){const first=this.cache.keys().next().value;this.pixels-=this.cache.get(first).pixels;this.cache.delete(first);this.metrics.evictions++;}if(st.pixels<=this.maxCachePixels&&this.maxCacheEntries>0){this.cache.set(key,st);this.pixels+=st.pixels;}return st;
 }
 _layer(r,polygons,color,kind,bounds){const g=r.tgt||r.ctx,projected=polygons.map(p=>p.map(q=>this._project(r,q)));if(!projected.length)return;g.save();g.beginPath();for(const p of projected)pathPoly(g,p);g.fillStyle=color;g.fill();if(kind&&bounds&&r.view.scale*U>=4){g.clip();const st=this._stamp(r.view,kind),ratio=r.view.scale/st.scale,W=r.bw||r.W,H=r.bh||r.H;let draws=0;
   // World-aligned tiles prevent paving from swimming when the camera moves.
   const x0=Math.floor(bounds.x/TILE)*TILE,y0=Math.floor(bounds.y/TILE)*TILE,x1=bounds.x+bounds.w,y1=bounds.y+bounds.d;
   for(let y=y0;y<y1&&draws<this.maxTileDraws;y+=TILE)for(let x=x0;x<x1&&draws<this.maxTileDraws;x+=TILE){const origin=this._project(r,[x,y]),sx=origin[0]+st.x*ratio,sy=origin[1]+st.y*ratio,w=st.c.width*ratio,h=st.c.height*ratio;if(sx>W||sy>H||sx+w<0||sy+h<0)continue;g.imageSmoothingEnabled=false;g.drawImage(st.c,Math.floor(sx),Math.floor(sy),Math.ceil(w)+1,Math.ceil(h)+1);draws++;}this.metrics.tileDraws+=draws;
  }g.restore();g._c=null;
 }
 ground(r,data,clock=0,options={}){if(!data)return;this.metrics.tileDraws=0;if(this._data!==data){this._data=data;this._segments=segments(data.roads);}const s=this._segments,bounds=this._bounds(r,options);this.metrics.roads=s.length;
  // All sidewalks first, all curbs second, all carriageways last. Other roads
  // erase crossing kerbs at junctions. No end caps or painted false crossings.
  this._layer(r,s.map(p=>p.full),COLORS.walk,'walk',bounds);
  this._layer(r,s.map(p=>p.kerb),COLORS.kerb,null,bounds);
  this._layer(r,s.map(p=>p.gut),COLORS.gutter,null,bounds);
  this._layer(r,s.map(p=>p.road),COLORS.road,'road',bounds);
 }
 boundaries(r,data,clock=0){const buildings=Array.isArray(data)?data:data?.buildings||[],g=r.tgt||r.ctx;this.metrics.footprints=this.metrics.plinths=0;
  for(const b of buildings){if(!finiteFeature(b)||(b.renderOpacity??1)>=.95)continue;const z=b.z||0,h=Math.min(.55,b.h),base=rect(b,z+.012).map(p=>this._project(r,p));fill(g,base,COLORS.blocked);this.metrics.footprints++;
   const capH=h+.24,top=rect(b,z+h).map(p=>this._project(r,p)),capTop=rect(b,z+capH).map(p=>this._project(r,p)),fx=r.view.fx>=0?b.x+b.w:b.x,fy=r.view.fy>=0?b.y+b.d:b.y,faces=[];
   if(Math.abs(r.view.fx)>.001)faces.push({color:COLORS.blocked,p:[[fx,b.y,z],[fx,b.y+b.d,z],[fx,b.y+b.d,z+h],[fx,b.y,z+h]].map(p=>this._project(r,p))});
   if(Math.abs(r.view.fy)>.001)faces.push({color:COLORS.plinth,p:[[b.x,fy,z],[b.x+b.w,fy,z],[b.x+b.w,fy,z+h],[b.x,fy,z+h]].map(p=>this._project(r,p))});
   const all=[...base,...capTop],xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
   r.queue(fx*U,fy*U,z*U,ctx=>{const alpha=ctx.globalAlpha;ctx.globalAlpha=1;for(const f of faces)fill(ctx,f.p,f.color);fill(ctx,top,COLORS.blocked);ctx.strokeStyle=COLORS.rim;ctx.lineWidth=Math.max(1,r.view.scale*1.6);ctx.beginPath();pathPoly(ctx,top);ctx.stroke();
    // Broad irregular ashlar blocks and a raised coping ring read as masonry.
    // Every stone and edge remains inside the exact occupied rectangle.
    ctx.save();ctx.beginPath();pathPoly(ctx,top);ctx.clip();ctx.strokeStyle=COLORS.mortar;ctx.lineWidth=1;
    for(let y=b.y,j=0;y<b.y+b.d;y+=1.35,j++){const end=Math.min(b.y+b.d,y+1.35);ctx.beginPath();ctx.moveTo(...this._project(r,[b.x,y,z+h+.006]));ctx.lineTo(...this._project(r,[b.x+b.w,y,z+h+.006]));ctx.stroke();for(let x=b.x+(j%2)*1.1;x<b.x+b.w;x+=2.2){ctx.beginPath();ctx.moveTo(...this._project(r,[x,y,z+h+.006]));ctx.lineTo(...this._project(r,[x,end,z+h+.006]));ctx.stroke();}}
    ctx.restore();const rim=.28,bands=[{x:b.x,y:b.y,w:b.w,d:rim},{x:b.x,y:b.y+b.d-rim,w:b.w,d:rim},{x:b.x,y:b.y+rim,w:rim,d:Math.max(.01,b.d-rim*2)},{x:b.x+b.w-rim,y:b.y+rim,w:rim,d:Math.max(.01,b.d-rim*2)}];
    for(const band of bands)fill(ctx,rect(band,z+capH).map(p=>this._project(r,p)),COLORS.cap);
    for(const [a,c]of[[[b.x,fy],[b.x+b.w,fy]],[[fx,b.y],[fx,b.y+b.d]]]){fill(ctx,[[a[0],a[1],z+h],[c[0],c[1],z+h],[c[0],c[1],z+capH],[a[0],a[1],z+capH]].map(p=>this._project(r,p)),COLORS.plinth);ctx.strokeStyle=COLORS.rim;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...this._project(r,[a[0],a[1],z+capH]));ctx.lineTo(...this._project(r,[c[0],c[1],z+capH]));ctx.stroke();}
    ctx.globalAlpha=alpha;ctx._c=null;
   },{occluder:true,bias:.003,box});this.metrics.plinths++;
  }
 }
}
return{version:'1.0.0',metersToUnits:U,colors:COLORS,Painter,roadSegments:segments};
});
