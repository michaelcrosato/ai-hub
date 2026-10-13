/* Frontier Atlas renderer. Metres are converted at this boundary only.
   Uses the supplied my-3D2dge projection, queues, rigs, shadows, and pixel art.
   Keeps 48 small arrays of terrain samples. It never allocates a world bitmap. */
(function(root){
'use strict';
const U=WorldAtlas.unitsPerMetre,C=WorldAtlas.chunkSizeM,T=4,E=My3D2dge;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Clip before the engine's software scan converter. Canvas clipping alone still
// makes it scan long off-screen polygons, which is costly at kilometre scale.
function clipPolygon(points,W,H){
 let output=points;
 for(const [axis,edge,greater]of[[0,-2,true],[0,W+2,false],[1,-2,true],[1,H+2,false]]){
  const input=output;output=[];if(!input.length)break;
  let prev=input[input.length-1],prevIn=greater?prev[axis]>=edge:prev[axis]<=edge;
  for(const next of input){const nextIn=greater?next[axis]>=edge:next[axis]<=edge;if(nextIn!==prevIn){const t=(edge-prev[axis])/(next[axis]-prev[axis]);output.push([prev[0]+t*(next[0]-prev[0]),prev[1]+t*(next[1]-prev[1])]);}if(nextIn)output.push(next);prev=next;prevIn=nextIn;}
 }
 return output;
}
class AtlasRenderer{
 constructor(world){this.world=world;this.ground=new Map();this.visibleProps=[];this.visibleCount=0;this.tilesDrawn=0;this.structures=[];this.makeStructures();}
 makeStructures(){
  for(const l of this.world.landmarks){
   if(l.type==='settlement'){
    let count=0;
    for(let i=0;i<12&&count<3;i++){
     const a=i*Math.PI/6,x=l.x+Math.cos(a)*19,y=l.y+Math.sin(a)*19,s=this.world.sample(x,y);
     if(s.roadDistanceM<11||s.water)continue;
     this.structures.push({type:'building',x,y,w:6.5,h:4.8,z:3.6,name:count===0?'GENERAL STORE':count===1?'STABLE':'POST OFFICE',color:count===1?'#8e7955':'#b09a72',roof:count===2?'#674e3a':'#765f43',landmark:l.id});count++;
    }
   }else if(l.type==='camp'){
    for(const [i,type]of['tent','tent','campfire'].entries()){
     const x=l.x+(i===0?-8:i===1?8:0),y=l.y+(i===2?6:9);
     if(this.world.sample(x,y).roadDistanceM>4)this.structures.push({type,x,y,size:type==='tent'?1.8:1.2,seed:WorldAtlas.hash(l.id+i),color:'#bda778'});
    }
   }
  }
 }
 groundChunk(cx,cy){
  const key=cx+','+cy;
  if(this.ground.has(key)){const value=this.ground.get(key);this.ground.delete(key);this.ground.set(key,value);return value;}
  const tiles=[];
  for(let y=cy*C;y<(cy+1)*C;y+=T)for(let x=cx*C;x<(cx+1)*C;x+=T){
   const s=this.world.sample(x+T/2,y+T/2),seed=WorldAtlas.hash(x+','+y+':'+this.world.seed);
   tiles.push({x,y,color:s.color,water:s.water,road:s.road,seed,inBounds:s.inBounds});
  }
  this.ground.set(key,tiles);if(this.ground.size>48)this.ground.delete(this.ground.keys().next().value);return tiles;
 }
 visible(r,x,y,pad=140){const q=r.w(x*U,y*U);return q[0]>-pad&&q[1]>-pad&&q[0]<r.W+pad&&q[1]<r.H+pad;}
 draw(r,time,horse,route,calibration){
  const w=this.world,px=E.px,g=r.ctx;
  const corners=[[-150,-190],[r.W+150,-190],[-150,r.H+130],[r.W+150,r.H+130]].map(p=>r.view.toGround(p[0]+r.ix,p[1]+r.iy)).filter(Boolean);
  const minX=Math.min(...corners.map(p=>p[0]/U)),maxX=Math.max(...corners.map(p=>p[0]/U)),minY=Math.min(...corners.map(p=>p[1]/U)),maxY=Math.max(...corners.map(p=>p[1]/U));
  const cx0=Math.floor(minX/C),cx1=Math.floor(maxX/C),cy0=Math.floor(minY/C),cy1=Math.floor(maxY/C);
  this.visibleProps=[];this.visibleCount=0;this.tilesDrawn=0;
  for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){
   this.visibleCount++;
   for(const t of this.groundChunk(cx,cy)){
    if(t.x+T<minX||t.x>maxX||t.y+T<minY||t.y>maxY)continue;
    const p=(x,y)=>r.w(x*U,y*U);px.poly(g,[p(t.x,t.y),p(t.x+T+.04,t.y),p(t.x+T+.04,t.y+T+.04),p(t.x,t.y+T+.04)],t.color);this.tilesDrawn++;
    if(!t.inBounds)continue;
    const c=t.water?'#9aafa066':t.road?'#af966b':'#c5c48b55';
    for(let j=0;j<6;j++){const n=((t.seed>>>j*3)&255)/255,m=((t.seed>>>((j*4+7)%25))&127)/127;const q=p(t.x+.15+n*3.7,t.y+.15+m*3.7);px.line(g,q[0],q[1],q[0]+(t.water?5:2),q[1],c);}
   }
   if(cx>=0&&cy>=0&&cx*C<w.widthM&&cy*C<w.heightM){const chunk=w.getChunk(cx,cy);for(const p of chunk.props)if(this.visible(r,p.x,p.y))this.visibleProps.push(p);}
  }
  const line=(a,b,width,color)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*width/2,ny=dx/len*width/2;const points=clipPolygon([[a.x+nx,a.y+ny],[b.x+nx,b.y+ny],[b.x-nx,b.y-ny],[a.x-nx,a.y-ny]].map(p=>r.w(p[0]*U,p[1]*U)),r.W,r.H);if(points.length>2)px.poly(g,points,color);};
  const eachNear=(paths,fn)=>{for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i];if(Math.max(a.x,b.x)+30<minX||Math.min(a.x,b.x)-30>maxX||Math.max(a.y,b.y)+30<minY||Math.min(a.y,b.y)-30>maxY)continue;fn(a,b,path);}};
  eachNear(w.rivers,(a,b,p)=>{line(a,b,p.widthM+4,'#91a083');line(a,b,p.widthM,'#638d89');line(a,b,p.widthM*.65,'#719c98');});
  eachNear(w.roads,(a,b,p)=>{line(a,b,p.widthM+.8,'#b59d72');line(a,b,p.widthM,'#c5af82');const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;for(const side of[-1,1]){const nx=-dy/len*.95*side,ny=dx/len*.95*side;line({x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},.15,'#a8936a');}});
  // A modest route guide uses actual metre coordinates. It does not move terrain.
  if(route&&route.length>1){
   for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];if(Math.max(a.x,b.x)<minX||Math.min(a.x,b.x)>maxX||Math.max(a.y,b.y)<minY||Math.min(a.y,b.y)>maxY)continue;
    const A=r.w(a.x*U,a.y*U),B=r.w(b.x*U,b.y*U);g.save();g.strokeStyle='#ead19270';g.lineWidth=2;g.setLineDash([8,12]);g.beginPath();g.moveTo(...A);g.lineTo(...B);g.stroke();g.restore();px.reset(g);
   }
  }
  for(const p of this.visibleProps){
   const prop={...p,x:p.x*U,y:p.y*U};
   if(p.type==='grass'){
    const s=r.w(prop.x,prop.y),wind=Math.sin(time*1.8+p.seed)*1.1;for(let i=0;i<4;i++)px.line(g,s[0]+i*2-3,s[1],s[0]+i*2-3+wind,s[1]-3-(p.seed>>i&3),p.color);
   }else FrontierArt.drawProp(r,prop,time);
  }
  for(const b of this.structures){if(!this.visible(r,b.x,b.y,230))continue;if(b.type==='building')this.drawBuilding(r,b);else FrontierArt.drawProp(r,{...b,x:b.x*U,y:b.y*U},time);}
  for(const l of w.landmarks)if(this.visible(r,l.x,l.y,80)){r.textAt(l.x*U,l.y*U,36,l.name.toUpperCase(),'#efe0b0',{font:'tiny',outline:'#334c38'});}
  if(calibration){
   for(let m=0;m<=100;m+=20){const x=calibration.x+m,y=calibration.y;if(!this.visible(r,x,y,60))continue;const a=r.w(x*U,(y-4)*U),b=r.w(x*U,(y+4)*U);px.line(g,...a,...b,'#e8d4a1',2);FrontierArt.drawProp(r,{type:'pole',x:x*U,y:(y-5)*U,size:.8,seed:17},time);r.textAt(x*U,(y-5)*U,26,m+' M','#fff0c6',{font:'tiny',outline:'#3f4b32'});}
  }
  if(horse){FrontierArt.drawHorse(r,horse,time);if(horse.speed>2){for(let i=0;i<6;i++){const phase=(time*3+i*.16)%1,dx=-Math.cos(horse.facing)*(8+phase*20),dy=-Math.sin(horse.facing)*(8+phase*20),s=r.w(horse.x+dx,horse.y+dy,phase*9);px.ddisc(g,s[0],s[1],1+phase*3,'#d5c296',.3*(1-phase));}}}
 }
 drawBuilding(r,b){
  const x=b.x*U,y=b.y*U,w=b.w*U,h=b.h*U,z=b.z*U,px=E.px;
  r.shadow(x+w/2,y+h/2,w*.55,.18,'#3c4a32');
  r.queue(x+w/2,y+h,0,g=>{
   const p=(a,b,c=0)=>r.w(a,b,c),roofZ=z+22;
   px.poly(g,[p(x,y),p(x+w,y),p(x+w,y,z),p(x,y,z)],'#6d6047');
   px.poly(g,[p(x,y),p(x,y+h),p(x,y+h,z),p(x,y,z)],'#847453');
   px.poly(g,[p(x+w,y),p(x+w,y+h),p(x+w,y+h,z),p(x+w,y,z)],'#967c53');
   px.poly(g,[p(x,y+h),p(x+w,y+h),p(x+w,y+h,z),p(x,y+h,z)],b.color);
   for(let zz=7;zz<z;zz+=7)px.line(g,...p(x,y+h,zz),...p(x+w,y+h,zz),'#7e6b4b');
   px.poly(g,[p(x-5,y-5,z),p(x+w/2,y-5,roofZ),p(x+w/2,y+h+5,roofZ),p(x-5,y+h+5,z)],b.roof);
   px.poly(g,[p(x+w/2,y-5,roofZ),p(x+w+5,y-5,z),p(x+w+5,y+h+5,z),p(x+w/2,y+h+5,roofZ)],'#907a55');
   px.poly(g,[p(x,y+h,z),p(x+w/2,y+h,roofZ),p(x+w,y+h,z)],'#af966c');
   for(const xx of[x+19,x+w-28]){px.poly(g,[p(xx,y+h+.1,19),p(xx+13,y+h+.1,19),p(xx+13,y+h+.1,34),p(xx,y+h+.1,34)],'#344a3d');px.line(g,...p(xx+6,y+h+.2,19),...p(xx+6,y+h+.2,34),'#c6b28b');}
   px.poly(g,[p(x+w*.44,y+h+.3,0),p(x+w*.62,y+h+.3,0),p(x+w*.62,y+h+.3,32),p(x+w*.44,y+h+.3,32)],'#584c36');
   const q=p(x+w/2,y+h+1,z-9);E.font.text(g,b.name,q[0],q[1],'#f3dfae',{font:'tiny',align:'center',outline:'#6b573c'});
  });
 }
 collide(body){
  const ox=body.x,oy=body.y,w=this.world;
  body.x=E.clamp(body.x,0,w.widthM*U);body.y=E.clamp(body.y,0,w.heightM*U);
  const x=body.x/U,y=body.y/U,cx=Math.floor(x/C),cy=Math.floor(y/C);
  for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++)for(const p of w.getChunk(xx,yy).props){
   if(!(p.radiusM>0)||p.type==='pole'||p.type==='sign'||p.type==='fence')continue;
   const dx=body.x-p.x*U,dy=body.y-p.y*U,d=Math.hypot(dx,dy),radius=body.r+p.radiusM*U;
   if(d<radius){const a=d>.001?dx/d:1,b=d>.001?dy/d:0;body.x=p.x*U+a*radius;body.y=p.y*U+b*radius;}
  }
  for(const b of this.structures){if(b.type!=='building')continue;const bx=b.x*U,by=b.y*U,bw=b.w*U,bh=b.h*U,rad=body.r;if(body.x<bx-rad||body.x>bx+bw+rad||body.y<by-rad||body.y>by+bh+rad)continue;const sides=[{d:body.x-(bx-rad),axis:'x',value:bx-rad},{d:bx+bw+rad-body.x,axis:'x',value:bx+bw+rad},{d:body.y-(by-rad),axis:'y',value:by-rad},{d:by+bh+rad-body.y,axis:'y',value:by+bh+rad}];sides.sort((a,b)=>a.d-b.d);body[sides[0].axis]=sides[0].value;}
  // Prop projection can cross an edge. Keep the whole collision disc in bounds.
  body.x=E.clamp(body.x,body.r,w.widthM*U-body.r);body.y=E.clamp(body.y,body.r,w.heightM*U-body.r);
  return body.x!==ox||body.y!==oy;
 }
 groundAt(){return 0;}
}
root.AtlasRenderer=AtlasRenderer;
})(globalThis);
