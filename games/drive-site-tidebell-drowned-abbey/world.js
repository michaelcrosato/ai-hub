/* Tidebell: original level data and world renderer. World units remain 16 per tile. */
(function () {
'use strict';
const E=My3D2dge, px=E.px, T=16, W=70, H=84;
const rgbCache=new Map();const rgb=c=>{let v=rgbCache.get(c);if(!v){v=E.hex(c);rgbCache.set(c,v);}return v;};
const staticProps=new Set(['tree','pine','bush','rock','flowers','column','arch','sign','chest','mushroom']);
const palette={water:['#112d39','#143440','#173b45','#1d424a'],grass:['#2b4843','#304e45','#365448','#3b584a'],path:['#797966','#82816b','#8b8770','#939077'],stone:['#566361','#606d68','#68746d','#728076'],wood:['#74664e','#877657','#9b8561']};
function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!=(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)yes=!yes;}return yes;}
function segDist(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=E.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
const paths=[[[32,76],[32,63],[30,57],[31,52],[35,47],[34,40],[34,31],[34,23],[34,13]],[[30,57],[23,55],[16,54]],[[35,47],[43,47],[51,43]],[[34,35],[28,35],[22,31]],[[32,65],[39,65],[42,61]],[[24,55],[22,61],[18,62]],[[46,45],[48,52],[52,54]]];
const land=[[10,66],[11,56],[8,48],[12,38],[18,31],[17,23],[24,15],[29,9],[39,8],[47,14],[51,24],[58,30],[61,41],[60,55],[55,64],[47,69],[39,72],[33,75],[24,73],[18,70]];
class TideWorld{
 constructor(){
  this.w=W;this.h=H;this.tile=T;this.ground=new Uint8Array(W*H);this.props=[];this.cache=new Map();this.open=false;
  const cells=Array(W*H).fill(0), tags=Array(W*H).fill('water');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=y*W+x; let k=inside(x+.5,y+.5,land)?1:0;
   if(k){let d=100; for(const p of paths)for(let j=1;j<p.length;j++)d=Math.min(d,segDist(x+.5,y+.5,p[j-1],p[j]));if(d<1.18)k=2;}
   if(x>=25&&x<=44&&y>=10&&y<=25)k=3;
   if(x>=30&&x<=33&&y>=70&&y<=77)k=4;
   if(Math.hypot(x-32,y-66)<4.8)k=k?2:0;
   for(const [cx,cy] of [[16,54],[51,43],[22,31]])if(Math.hypot(x-cx,y-cy)<3.5)k=3;
   this.ground[i]=k;tags[i]=['water','grass','path','stone','wood'][k];
   if(y<25&&!(x>25&&x<44&&y>10))cells[i]=k?2:0;
   if(k===3&&y>=10&&y<=25&&(x===25||x===44||y===10))cells[i]=1;
   if(y===25&&k&&!(x>=32&&x<=36))cells[i]=1;
  }
  this.map=new E.TileMap({w:W,h:H,cells,types:{1:{h:25,top:'#728077',side:'#465853',face:'stone',roof:'slab',cut:false},2:{h:9,top:'#374d45',side:'#2d4541',face:'rock',roof:'grass'}},floorTex:(x,y)=>this.floor(x,y),shimmer:false,cutaway:false,ao:3});
  this.map.floorTags=tags;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!this.ground[y*W+x])this.map.block(x,y,true);
  this.objects=[
   {id:'bran',type:'npc',x:35*T,y:67*T,name:'Bran',label:'Speak to Bran',color:'#d4ad70'},
   {id:'camp',type:'fountain',x:28*T,y:66*T,name:'Harbor lantern',label:'Rest & save'},
   {id:'shop',type:'shop',x:39*T,y:65*T,name:'The little provisions stall',label:'Browse supplies'},
   {id:'inscription',type:'sign',x:31*T,y:59*T,name:'Pilgrim stone',label:'Read the old verse'},
   {id:'tide',type:'shrine',x:16*T,y:54*T,name:'Tide shrine',label:'Wake the Tide shrine',color:'#79d4dc'},
   {id:'root',type:'shrine',x:51*T,y:43*T,name:'Root shrine',label:'Wake the Root shrine',color:'#acd591'},
   {id:'ember',type:'shrine',x:22*T,y:31*T,name:'Ember shrine',label:'Wake the Ember shrine',color:'#ecac6d'},
   {id:'chest1',type:'chest',x:18*T,y:62*T,name:'A weathered chest',label:'Open chest'},
   {id:'chest2',type:'chest',x:52*T,y:54*T,name:'A hidden chest',label:'Open chest'},
   {id:'chest3',type:'chest',x:41*T,y:18*T,name:'A keeper’s chest',label:'Open chest'},
   {id:'gate',type:'gate',x:34*T,y:26*T,name:'The silent gate',label:'Examine the gate'},
   {id:'font',type:'fountain',x:39*T,y:22*T,name:'Stillwater font',label:'Rest & save'},
   {id:'boss',type:'boss',x:34*T,y:15*T,name:'The Bellkeeper',label:'Face the Bellkeeper'},
   {id:'memory',type:'memory',x:34*T,y:12*T,name:'The heart of the bell',label:'Listen to the final echo'},
   {id:'boat',type:'boat',x:34.5*T,y:75*T,name:'Bran’s skiff',label:'Return to the shore'}
  ];
  this.encounters=[
   {id:'e1',name:'Lanterns without a flame',x:30*T,y:60*T,enemies:['wisp'],canFlee:true},
   {id:'e2',name:'The tide remembers',x:20*T,y:55*T,enemies:['wisp','wisp'],canFlee:true},
   {id:'e3',name:'Roots across the road',x:44*T,y:46*T,enemies:['bramble','wisp'],canFlee:true},
   {id:'e4',name:'A promise in stone',x:26*T,y:34*T,enemies:['sentinel'],canFlee:true},
   {id:'e5',name:'The forgotten watch',x:34*T,y:21*T,enemies:['sentinel','wisp'],canFlee:true},
   {id:'e6',name:'Among the reeds',x:48*T,y:52*T,enemies:['bramble','bramble'],canFlee:true}
  ];
  this.populate();this.setGate(false);
 }
 floor(wx,wy){
  const x=Math.floor(wx/T),y=Math.floor(wy/T);if(x<0||y<0||x>=W||y>=H)return rgb('#112d39');
  const i=y*W+x,k=this.ground[i],n=E.hash2(Math.floor(wx),Math.floor(wy)),big=E.noise2(wx/27,wy/27),p=palette[['water','grass','path','stone','wood'][k]];
  let c=p[Math.min(p.length-1,Math.floor((n*.3+big*.7)*p.length))];
  const xx=((wx%T)+T)%T,yy=((wy%T)+T)%T;
  if(k===0){let near=false;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(this.ground[(y+dy)*W+x+dx])near=true;if(near)c=n>.83?'#4c716a':n>.5?'#2d5657':'#1e454c';}
  if(k===1){if(n>.973)c='#739075';if(n<.04)c='#243e3b';}
  if(k===2){if(n<.065)c='#656952';if(n>.97)c='#aea487';if(xx<1&&yy<3)c='#59624d';}
  if(k===3){if(yy<.8||(xx+((y%2)*8))%16<.8)c='#3b514e';if(yy>14.8)c='#819086';if(n>.91&&big>.56)c='#657e61';}
  if(k===4){if(yy<1.5)c='#4c5143';if(xx<1)c='#b3986e';if(n>.93)c='#b09b77';}
  return rgb(c);
 }
 populate(){
  const reserve=(x,y)=>this.objects.some(o=>Math.hypot(o.x/T-x,o.y/T-y)<3)||this.encounters.some(o=>Math.hypot(o.x/T-x,o.y/T-y)<2.2);
  for(let y=28;y<73;y+=2)for(let x=9;x<61;x+=2){
   const seed=Math.floor(E.hash2(x,y)*10000),xx=x+E.hash2(x+4,y)*.8,yy=y+E.hash2(x,y+8)*.7;
   const i=Math.floor(yy)*W+Math.floor(xx),k=this.ground[i];if(k!==1||reserve(xx,yy))continue;
   let pd=100;for(const p of paths)for(let j=1;j<p.length;j++)pd=Math.min(pd,segDist(xx,yy,p[j-1],p[j]));
   if(pd>2.4&&E.hash2(x+15,y)>.13){this.props.push({type:seed%5?'tree':'pine',x:xx*T,y:yy*T,seed});this.map.block(Math.floor(xx),Math.floor(yy),true);}
   else if(pd>1.35){this.props.push({type:seed%3?'bush':'flowers',x:xx*T,y:yy*T,seed});}
  }
  for(let y=30;y<70;y+=3)for(let x=13;x<59;x+=3)if(this.ground[y*W+x]===1&&E.hash2(x+45,y)>.55&&!reserve(x,y))this.props.push({type:'flowers',x:x*T,y:y*T,seed:x*y});
  for(const [x,y]of[[29,70],[35,70],[27,63],[35,58],[29,51],[38,43],[32,33],[30,27],[39,27],[28,23],[41,23],[29,16],[39,16]])this.props.push({type:'lantern',x:x*T,y:y*T,seed:x+y});
  for(const [x,y]of[[26,24],[43,24],[27,19],[42,19],[27,14],[42,14]])this.props.push({type:'column',x:x*T,y:y*T,seed:x*y});
  for(const [x,y]of[[12,59],[56,58],[13,47],[58,39],[47,31],[19,39],[41,58],[24,69]])this.props.push({type:'rock',x:x*T,y:y*T,seed:x*y});
  this.props.push({type:'arch',x:34*T,y:25*T,seed:11});
 }
 setGate(open){this.open=open;for(let x=32;x<=36;x++)this.map.block(x,25,!open);}
 collide(actor){return this.map.collide(actor);}
 nearest(x,y,state){return this.objects.filter(o=>!(o.id==='memory'&&!state.flags.boss)&&!(o.id==='boss'&&state.flags.boss)&&!(o.type==='chest'&&state.chests.includes(o.id))).map(o=>({o,d:Math.hypot(o.x-x,o.y-y)})).filter(o=>o.d<(o.type==='gate'?57:o.type==='boss'?68:36)).sort((a,b)=>a.d-b.d)[0]?.o||null;}
 area(x,y){if(y<26*T)return['The Drowned Abbey','The silent heart'];if(y<42*T)return['The Pilgrim Wood','Beneath the old boughs'];if(y<61*T)return['The Lantern Wilds','Where the tide remembers'];return['Morrow Shore','A light before the mist'];}
 prop(r,p,t,opts={}){
  const s=r.view.scale/1.5, [sx,sy]=r.w(p.x,p.y,0);if(sx<-140*s||sy<-50*s||sx>r.W+140*s||sy>r.H+160*s)return;
  let asset=null;
  if(staticProps.has(p.type)){
   const key=p.type+':'+(p.seed||0)+':'+!!opts.open;
   asset=this.cache.get(key);
   if(!asset){const dim=TideArt.dimensions[p.type]||[64,80],cv=E.mkCanvas(dim[0]+28,dim[1]+28),cg=E.ctx2d(cv),ax=Math.floor(cv.width/2),ay=cv.height-14;TideArt.drawProp(cg,ax,ay,p.type,p.seed||0,0,opts);asset={cv,ax,ay};this.cache.set(key,asset);}
  }
  r.queue(p.x,p.y,0,g=>{g.save();g.translate(Math.round(sx),Math.round(sy));g.scale(s,s);if(asset)g.drawImage(asset.cv,-asset.ax,-asset.ay);else TideArt.drawProp(g,0,0,p.type,p.seed||0,t,opts);g.restore();px.reset(g);},{hides:true});
 }
 draw(r,state,t,hero){
  this.map.drawFloor(r);this.map.queueWalls(r);
  const g=r.ctx,s=r.view.scale/1.5;
  // Water glints stay in world space so they do not slide with the camera.
  for(let y=9;y<81;y+=2)for(let x=6;x<65;x+=3){if(this.ground[y*W+x]!==0)continue;const [sx,sy]=r.w(x*T+Math.sin(t*.2+y)*3,y*T);if(sx<-20||sy<0||sx>r.W+20||sy>r.H)continue;const a=E.hash2(x,y);px.rect(g,sx,sy,5+a*10,1,Math.sin(t*.9+x+y)>0.6?'#437077':'#234851');if(a>.6)px.rect(g,sx+4,sy+3,4,1,'#28515a');}
  for(const p of this.props)this.prop(r,p,t);
  for(const o of this.objects){
   if(o.type==='npc')continue;
   if(o.type==='shop'){this.drawStall(r,o,t);continue;}
   if(o.type==='gate'){if(!this.open){const [sx,sy]=r.w(o.x,o.y-8);r.queue(o.x,o.y,0,g=>{for(let x=-48;x<=48;x+=8){px.rect(g,sx+x*s,sy-52*s,2*s,54*s,'#73a0a0');px.rect(g,sx+x*s,sy-51*s,1*s,52*s,'#c1d0b2');}px.rect(g,sx-49*s,sy-35*s,99*s,3*s,'#758b7d');});}continue;}
   if(o.type==='boss'){if(!state.flags.boss){const[sx,sy]=r.w(o.x,o.y);r.queue(o.x,o.y,0,g=>TideArt.enemy(g,sx,sy,'boss',t,.52*s));}continue;}
   if(o.type==='memory'){this.prop(r,{...o,type:'bell'},t,{lit:state.flags.boss});continue;}
   if(o.type==='boat'){this.prop(r,o,t);continue;}
   this.prop(r,o,t,{open:state.chests.includes(o.id),color:o.color,lit:o.type==='shrine'?state.shrines.includes(o.id):true});
   if(o.type==='shrine'&&state.shrines.includes(o.id)){const[sx,sy]=r.w(o.x,o.y,24);r.decal(g=>r.glowDisc(g,sx,sy,38*s,o.color,.12));}
  }
  for(const e of this.encounters){if(state.defeated.includes(e.id))continue;const[sx,sy]=r.w(e.x,e.y);if(sx<-50||sx>r.W+50||sy<-30||sy>r.H+50)continue;r.shadow(e.x,e.y,7,.25);r.queue(e.x,e.y,0,g=>TideArt.enemy(g,sx,sy,e.enemies[0],t,.35*s));}
  // Lantern pools and drifting pollen are restrained and deterministic.
  r.overlay(g=>{for(let i=0;i<35;i++){const xx=(E.hash2(i,71)*r.W+t*(2+i%3))%(r.W+14)-7,yy=(E.hash2(i,19)*r.H+Math.sin(t*.6+i)*8);if(Math.sin(t*.7+i*2)>-.4){px.rect(g,xx,yy,i%5?1:2,1,i%3?'#9ba77b':'#e7c681');}}});
 }
 drawStall(r,o,t){const[sx,sy]=r.w(o.x,o.y),s=r.view.scale/1.5;r.queue(o.x,o.y,0,g=>{g.save();g.translate(Math.round(sx),Math.round(sy));g.scale(s,s);px.rect(g,-27,-19,54,21,'#5a4b3d');px.rect(g,-29,-25,58,9,'#b39667');px.rect(g,-24,-53,3,38,'#806f55');px.rect(g,23,-53,3,38,'#806f55');px.poly(g,[[-33,-52],[32,-52],[39,-33],[-39,-33]],'#94725b');for(let x=-30;x<34;x+=14)px.poly(g,[[x,-52],[x+7,-52],[x+10,-33],[x-3,-33]],'#486c60');px.rect(g,-39,-34,78,5,'#bd9e6c');for(let i=0;i<4;i++){px.rect(g,-20+i*13,-30,8,6,['#92b6a0','#b095ba','#d3a762','#78957c'][i]);}g.restore();px.reset(g);});}
}
window.TideWorld=TideWorld;
})();
