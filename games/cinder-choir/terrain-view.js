/* Cinder Choir: bounded local terrain rendering.
 * Public engine APIs only. A small, stable set of ground texture tiles replaces
 * the engine's synchronous whole-map floor bake. Collision remains in TileMap.
 * Texture motifs repeat every four ground tiles; this is not a pixel-identical
 * copy of TileMap.drawFloor. The existing engine path remains for GPU/side views.
 */
(() => {
'use strict';
const CC=globalThis.CC=globalThis.CC||{},E=My3D2dge,T=CC.TerrainView={version:'1.0.0'};
const LIMIT=384,PHASES=4,tiles=new Map();let reports=new WeakMap(),totalSamples=0,totalBuilds=0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
T.clear=()=>{tiles.clear();reports=new WeakMap();totalSamples=0;totalBuilds=0;};
T.stats=map=>map?{...(reports.get(map)||{})}:{cachedTiles:tiles.size,cacheLimit:LIMIT,cachedBytes:[...tiles.values()].reduce((n,t)=>n+t.width*t.height*4,0),sampledPixels:totalSamples,builtTiles:totalBuilds};
T.bounds=(r,map,padding=2)=>{
 const corners=[[-4,-4],[r.W+4,-4],[-4,r.H+4],[r.W+4,r.H+4]].map(([x,y])=>r.view.toGround(x+r.ix,y+r.iy)).filter(Boolean);
 if(!corners.length)return null;
 const xs=corners.map(p=>p[0]/map.T),ys=corners.map(p=>p[1]/map.T);
 return{x0:clamp(Math.floor(Math.min(...xs))-padding,0,map.w-1),x1:clamp(Math.ceil(Math.max(...xs))+padding,0,map.w-1),
  y0:clamp(Math.floor(Math.min(...ys))-padding,0,map.h-1),y1:clamp(Math.ceil(Math.max(...ys))+padding,0,map.h-1)};
};
function stamp(map,view,key,tag,cx,cy){
 const px=((cx%PHASES)+PHASES)%PHASES,py=((cy%PHASES)+PHASES)%PHASES,id=key+':'+String(tag)+':'+px+':'+py;
 let tile=tiles.get(id);
 if(tile){tiles.delete(id);tiles.set(id,tile);return tile;}
 const n=map.T,canvas=E.mkCanvas(n,n),g=canvas.getContext('2d'),image=g.createImageData(n,n),data=image.data;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const color=map.floorTex(px*n+x+.5,py*n+y+.5,tag,view),i=(y*n+x)*4;totalSamples++;
  if(!color)continue;data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];data[i+3]=255;
 }
 g.putImageData(image,0,0);tiles.set(id,canvas);totalBuilds++;
 while(tiles.size>LIMIT)tiles.delete(tiles.keys().next().value);
 return canvas;
}
T.draw=(r,world,options={})=>{
 const map=world.map||world,view=r.view,bounds=T.bounds(r,map),before=totalBuilds;
 if(!bounds||r.gpu){map.drawFloor(r);reports.set(map,{fallback:true,visibleTiles:0,newTiles:0});return;}
 const palette=world.theme||{},key=options.cacheKey||[world.place?.theme||'map',world.act||1,palette.floor,palette.dark,palette.light,palette.water,palette.accent,map.T,view.yawDeg,view.pitchDeg,view.scale].join(':');
 const g=r.ctx,n=map.T,cells=[],water=[];let shadows=0;
 g.save();g.imageSmoothingEnabled=false;
 // One ground-to-screen transform applies to the entire visible tile range.
 g.transform(view.ax,view.bx,view.ay,view.by,-r.ix,-r.iy);
 for(let cy=bounds.y0;cy<=bounds.y1;cy++)for(let cx=bounds.x0;cx<=bounds.x1;cx++){
  if(map.cell(cx,cy)!==0)continue;
  const tag=map.floorTags?.[cy*map.w+cx]??null,tile=stamp(map,view,key,tag,cx,cy);
  // A small overlap closes subpixel seams between projected canvas images.
  g.drawImage(tile,cx*n-.12,cy*n-.12,n+.24,n+.24);cells.push([cx,cy]);
  if(map.shimmer&&(tag==='water'||tag==='lava'))water.push([cx,cy,tag]);
 }
 if(map.ao){
  const width=Math.min(map.ao,n/3),step=width/3;
  // Contact shading is drawn from the current collision map. An opened gate
  // therefore loses its old shadow without discarding the shared tile cache.
  for(const[cx,cy]of cells){
   const x=cx*n,y=cy*n,walls=[map.cell(cx-1,cy)!==0,map.cell(cx+1,cy)!==0,map.cell(cx,cy-1)!==0,map.cell(cx,cy+1)!==0];
   if(!walls.some(Boolean))continue;shadows++;
   for(let band=0;band<3;band++){
    g.fillStyle=`rgba(8,13,23,${.13-band*.035})`;const d=band*step,extent=width-d;
    if(walls[0])g.fillRect(x,y,extent,n);if(walls[1])g.fillRect(x+n-extent,y,extent,n);
    if(walls[2])g.fillRect(x,y,n,extent);if(walls[3])g.fillRect(x,y+n-extent,n,extent);
   }
  }
 }
 // Keep animated water local to the camera as well. It must not trigger a
 // texture rebuild when the clock advances.
 const now=r.game?.real||0;
 for(const[cx,cy,tag]of water){
  const seed=E.hash2(cx*7,cy*13),u=(now*(tag==='lava'?.12:.25)+seed)%1,light=Math.sin(u*Math.PI);
  if(light<.35)continue;g.fillStyle=tag==='lava'?'#ffd070':'#dff4ff';g.globalAlpha=light*.35;
  g.fillRect(cx*n+u*n,cy*n+((seed*7.3)%1)*n,light>.8?3:2,.8);
 }
 g.restore();reports.set(map,{fallback:false,visibleTiles:cells.length,shadowTiles:shadows,animatedWaterTiles:water.length,newTiles:totalBuilds-before,bounds,terrainCells:map.w*map.h});
};
})();
