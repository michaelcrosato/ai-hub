/* Visual preferences and bounded compatibility filters. No game-state access. */
(function(root){
 'use strict';
 const scopes=['off','scene','subjects'];
 const DEFAULTS=Object.freeze({version:1,backend:'auto',quality:'balanced',cel:'off',pixel:'off',pixelSize:4,celBands:4,bloom:true,ao:true,shadows:true,fog:true,wet:true,rain:true,embers:true,compute:true,motion:true,exposure:1.05});
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function normalize(value={}){
  const v=value&&typeof value==='object'?value:{},o={...DEFAULTS};
  for(const key of ['cel','pixel'])if(scopes.includes(v[key]))o[key]=v[key];
  if(['auto','webgl2'].includes(v.backend))o.backend=v.backend;
  if(['low','balanced','high'].includes(v.quality))o.quality=v.quality;
  for(const key of ['bloom','ao','shadows','fog','wet','rain','embers','compute','motion'])if(typeof v[key]==='boolean')o[key]=v[key];
  for(const [key,min,max] of [['pixelSize',2,10],['celBands',2,6],['exposure',.65,1.7]])if(Number.isFinite(Number(v[key])))o[key]=clamp(Number(v[key]),min,max);
  o.pixelSize=Math.round(o.pixelSize);o.celBands=Math.round(o.celBands);return o;
 }
 function pixelSourceIndex(index,width,height,mask,size,scope){
  if(scope==='off'||scope==='subjects'&&!mask[index])return index;
  const x=index%width,y=Math.floor(index/width),sx=Math.min(width-1,Math.floor(x/size)*size+Math.floor(size/2)),sy=Math.min(height-1,Math.floor(y/size)*size+Math.floor(size/2)),source=sy*width+sx;
  return scope==='subjects'&&!mask[source]?index:source;
 }
 class CompatibilityFilters{
  apply(surface,settings){
   const s=normalize(settings),data=surface.data,w=surface.width,h=surface.height,n=w*h,mask=surface.subjects||new Uint8Array(n),depth=surface.depth;
   if(!this.base||this.base.length!==data.length){this.base=new Uint8ClampedArray(data.length);this.styled=new Uint8ClampedArray(data.length);}
   this.base.set(data);const base=this.base,styled=this.styled;styled.set(data);
   if(s.cel!=='off')for(let i=0;i<n;i++){
    if(s.cel==='subjects'&&!mask[i])continue;
    const p=i*4,l=(base[p]*.2126+base[p+1]*.7152+base[p+2]*.0722)/255;
    const band=(Math.floor(clamp(l,0,.999)*s.celBands)+.4)/s.celBands,scale=l>.006?clamp(band/l,.65,1.65):1;
    const right=i%w<w-1?i+1:i,below=i+w<n?i+w:i;
    const edge=depth[i]>0&&(Math.abs(depth[i]-depth[right])>Math.max(.0003,depth[i]*.055)||Math.abs(depth[i]-depth[below])>Math.max(.0003,depth[i]*.055));
    for(let k=0;k<3;k++)styled[p+k]=clamp(base[p+k]*scale*(edge?.5:1),0,255);
   }
   for(let i=0;i<n;i++){
    const src=pixelSourceIndex(i,w,h,mask,s.pixelSize,s.pixel),p=i*4,q=src*4;
    for(let k=0;k<3;k++)data[p+k]=clamp(styled[q+k]*(s.exposure/DEFAULTS.exposure),0,255);data[p+3]=255;
   }
   // The emergency path uses a small glow kernel; GPU paths use HDR bloom.
   if(s.bloom&&surface.glow){
    this.base.set(data);
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
     const i=y*w+x,p=i*4;let r=0,g=0,b=0;
     for(const off of [-2,-1,1,2,-w,w,-2*w,2*w]){const q=i+off,light=surface.glow[q];if(light>.25){const f=light*.018;r+=base[q*4]*f;g+=base[q*4+1]*f;b+=base[q*4+2]*f;}}
     data[p]=Math.min(255,data[p]+r);data[p+1]=Math.min(255,data[p+1]+g);data[p+2]=Math.min(255,data[p+2]+b);
    }
   }
   return surface;
  }
 }
 root.MeridianGraphics={DEFAULTS,normalize,pixelSourceIndex,CompatibilityFilters,scopes};
})(typeof window!=='undefined'?window:globalThis);
