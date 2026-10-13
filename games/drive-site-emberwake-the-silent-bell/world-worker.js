/* Coarse atlas sampling stays off the animation/UI thread. */
'use strict';
importScripts('world-gen.js');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const colors=Object.fromEntries(Object.entries(EWWorld.BIOMES).map(([id,b])=>[id,rgb(b.color)]));
// Small views retain every site. Broad views use bounded spatial strata so the
// 400-marker cap does not show only the world's northern rows. Each disjoint
// bin contributes up to four candidates; round-robin selection remains stable.
function atlasSites(world,b){
 const x0=Math.max(0,Math.floor(b.x)),y0=Math.max(0,Math.floor(b.y)),
  x1=Math.min(world.config.size-1,Math.ceil(b.x+b.width)),
  y1=Math.min(world.config.size-1,Math.ceil(b.y+b.height));
 if(x1<x0||y1<y0)return[];
 const macro=EWWorld.LIMITS.macroSize,
  cells=(Math.floor(x1/macro)-Math.floor(x0/macro)+1)*(Math.floor(y1/macro)-Math.floor(y0/macro)+1);
 if(cells<=400)return world.sitesInRect(x0,y0,x1,y1,400);
 const bins=[],width=x1-x0+1,height=y1-y0+1;
 for(let by=0;by<20;by++)for(let bx=0;bx<20;bx++){
  const ax=x0+Math.floor(bx*width/20),ay=y0+Math.floor(by*height/20),
   ex=x0+Math.floor((bx+1)*width/20)-1,ey=y0+Math.floor((by+1)*height/20)-1;
  if(ex>=ax&&ey>=ay)bins.push(world.sitesInRect(ax,ay,ex,ey,4));
 }
 const sites=[];
 for(let rank=0;rank<4;rank++)for(const bin of bins){
  if(bin[rank])sites.push(bin[rank]);
  if(sites.length===400)return sites;
 }
 return sites;
}
self.onmessage=function(event){
 const q=event.data;
 try{
  if(!q||!Number.isInteger(q.id))throw Error('Invalid atlas request.');
  if(typeof q.width!=='number'||typeof q.height!=='number'||!Number.isFinite(q.width)||!Number.isFinite(q.height))throw Error('Invalid atlas dimensions.');
  const w=clamp(Math.round(q.width),64,720),h=clamp(Math.round(q.height),64,720),b=q.bounds;
  if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.width<=0||b.height<=0)throw Error('Invalid atlas bounds.');
  const world=EWWorld.World.fromRecipe(q.recipe),pixels=new Uint8ClampedArray(w*h*4);
  let land=0,inside=0;
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
   const x=b.x+(px+.5)/w*b.width,y=b.y+(py+.5)/h*b.height,t=world.sample(x,y);let c;
   if(t.outside)c=[12,28,36];
   else{
    inside++;if(t.biome!=='ocean')land++;
    if(q.layer==='height')c=mix([20,42,64],[236,226,196],t.height);
    else if(q.layer==='moisture')c=mix([181,137,77],[48,125,154],t.moisture);
    else if(q.layer==='danger')c=mix([62,127,111],[204,89,68],clamp(t.danger/5,0,1));
    else{
     c=colors[t.biome]||colors.grassland;const shade=clamp((t.height-.5)*.22,-.08,.12);c=c.map(v=>clamp(Math.round(v*(1+shade)),0,255));
     if(t.river)c=mix(c,[57,125,152],.8);
     if(t.road&&b.width/w<5)c=mix(c,[218,177,113],.88);
    }
   }
   const i=(py*w+px)*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255;
  }
  const sites=atlasSites(world,b);
  self.postMessage({id:q.id,width:w,height:h,pixels:pixels.buffer,sites,land:inside?land/inside:0,stats:world.stats(),bounds:b},[pixels.buffer]);
 }catch(error){self.postMessage({id:q&&q.id,error:error.message||'Atlas generation failed.'});}
};
