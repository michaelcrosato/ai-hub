/* Lanternwake: The Hollow Bell — original pixel materials and procedural puppets.
 * All art is made here with my-3D2dge pixel primitives. No source-game art is used.
 */
(function () {
'use strict';
const E = My3D2dge, P = E.px, T = 16, TAU = Math.PI * 2;
const C = {
  ink:'#091c23', deep:'#0d292b', grass:'#183c35', moss:'#2d5c43', mint:'#77b89a',
  teal:'#66dfcd', pale:'#c9f6df', gold:'#efcc83', hot:'#fff4c4', ember:'#dc8b62',
  stone:'#496267', stoneD:'#2d4149', bone:'#b5b69a', danger:'#ee8c7c', violet:'#766490'
};
const hash = (a,b) => E.hash2(a,b);
const mix = (a,b,u) => E.mix(a,b,u);
const clamp = (a,b,c) => Math.max(b,Math.min(c,a));
const poly = (g,pts,col) => P.poly(g,pts,col);
function line(g,a,b,col,w=1){P.line(g,a[0],a[1],b[0],b[1],col,w);}
function diamond(g,x,y,r,col){poly(g,[[x,y-r],[x+r*.65,y],[x,y+r],[x-r*.65,y]],col);}

class LanternArt {
  constructor(engine) {
    this.game=engine;
    this.time=0;
    this.stamps=new Map();
    this.npcRigs=new Map();
    this.step=0;
    this.heroRig=new E.Humanoid({
      build:'chibi',size:.92,headR:3.8,torso:8.2,torsoW:3.25,
      weapon:'sword',bladeLen:14,outfit:'tunic',sleeves:'long',
      hair:{style:'ponytail',len:4},cape:{len:6,seg:2.6,width:7,body:3.7},
      colors:{skin:'#e9c69b',hair:'#b7643e',cloth:'#387d73',clothDk:'#215259',clothLt:'#74ab8d',
        pants:'#39454d',boot:'#64473d',glove:'#d7b282',cape:'#e9ddb1',capeIn:'#9b9e81',
        metal:'#e4ffec',metalDk:'#60b5ad',hilt:'#e1b968',belt:'#8a6344',eye:'#16323d'}
    });
    this.attackSpecs=[
      {a0:-1.55,a1:1.35,z0:12,z1:10,reach:8,blade:14,lunge:2.2,hold:.15,lean:.24},
      {a0:1.3,a1:-1.7,z0:11,z1:13,reach:8.8,blade:14,lunge:2.6,hold:.13,lean:.3},
      {a0:-2.6,a1:2.35,z0:14,z1:10,reach:9.5,blade:14,lunge:3,hop:1.4,hold:.15,lean:.36}
    ];
    this.fireflies=Array.from({length:75},(_,i)=>({
      x:hash(i,9)*1280,y:hash(i,57)*1024,z:4+hash(i,96)*30,
      phase:hash(i,34)*TAU,speed:.4+hash(i,89)*.6
    }));
  }

  isRestored(w,id) {
    return !id || (id==='boss' ? !!w.completed : !!(w.restored && w.restored.has(id)));
  }

  update(dt,w) {
    this.time=w.time||this.time+dt;
    const h=w.hero;
    if(h){
      let attack=null;
      if(h.attack){
        const u=clamp(h.attack.u||0,0,1), phase=u<.15?'wind':u<.68?'active':'recover';
        attack={spec:this.attackSpecs[(h.attack.combo||0)%3],phase,u:phase==='wind'?u/.15:phase==='active'?(u-.15)/.53:(u-.68)/.32};
      }
      this.heroRig.update(dt,{x:h.x,y:h.y,z:h.z||0,vx:h.vx||0,vy:h.vy||0,
        facing:h.facing||0,dash:h.dashTime>0,hurt:h.hurt>0,attack,
        pose:h.pose||(w.mode==='ending'?'cheer':null),stance:'ready'});
    }
    for(const n of w.npcs||[]){
      if(!this.isRestored(w,n.requires))continue;
      if(n.id==='willow'||n.id==='rook')continue;
      let rig=this.npcRigs.get(n.id);
      if(!rig){
        const id=String(n.id||n.name), elder=/elder|mara|keeper|orin|toma/i.test(id), child=/pippa|child|pip|lumi/i.test(id);
        rig=new E.Humanoid({size:child?.67:.87,weapon:null,hair:elder?'bald':'short',
          hat:elder?{style:'cap',color:'#c19e65'}:null,outfit:elder?'robe':'tunic',sleeves:'long',
          colors:{skin:elder?'#c8a77f':'#dcbd94',hair:elder?'#dad4b2':'#665038',
            cloth:n.color||'#b27857',pants:'#384b4a',boot:'#473d35',eye:'#20353d'}});
        this.npcRigs.set(n.id,rig);
      }
      const close=h&&Math.hypot(h.x-n.x,h.y-n.y)<38;
      rig.update(dt,{x:n.x,y:n.y,z:0,vx:n.vx||0,vy:n.vy||0,
        facing:close?Math.atan2(h.y-n.y,h.x-n.x):(n.facing||1.57),
        pose:n.pose||(close&&Math.sin(this.time*.7)>0.8?'wave':null)});
    }
  }

  draw(r,w) {
    this.time=w.time||this.time;
    this.floor(r,w);
    this.ambient(r,w);
    for(const s of w.seals||[])this.seal(r,w,s);
    for(const p of w.props||[])this.prop(r,w,p);
    for(const shrine of w.shrines||[])this.shrine(r,w,{...shrine,type:'waystone'},shrine.active);
    for(const seed of w.seeds||[])if(!seed.found&&this.isRestored(w,seed.requires))this.seed(r,seed);
    for(const pickup of w.pickups||[])this.pickup(r,pickup);
    for(const n of w.npcs||[])this.npc(r,w,n);
    for(const e of w.enemies||[])if(!e.dead)this.enemy(r,w,e);
    if(w.boss && !(w.enemies||[]).includes(w.boss) && !w.boss.dead && !w.defeatedBoss)this.enemy(r,w,w.boss);
    for(const p of w.projectiles||[])this.projectile(r,p);
    if(w.hero)this.hero(r,w);
    for(const fx of w.effects||[])this.effect(r,w,fx);
    this.foreground(r,w);
  }

  // Stable pixel materials are rasterized once. A camera zoom scales that pixel
  // sheet without filtering; actors, effects and raised boundaries still project
  // from world space each frame. Map revisions replace the sheet atomically.
  floor(r,w){
    if(Math.abs(r.view.yawDeg)>.001)return this.floorPixels(r,w);
    const baseScale=1.5,view=r.view,key=[w.revision||0,view.pitchDeg,view.zBoost].join(':');
    if(this.floorWorld!==w||this.floorKey!==key){
      const width=w.width||80,height=w.height||64;
      const v=new E.View('floor-cache','Floor',0,view.pitchDeg,baseScale,view.zBoost);
      const canvas=E.mkCanvas(Math.ceil(width*T*v.ax)+3,Math.ceil(height*T*v.by)+3),g=E.ctx2d(canvas);
      const obstacles=new Map();
      const cacheR={view:v,ix:0,iy:0,bw:canvas.width,bh:canvas.height,tgt:g,w:(x,y,z=0)=>v.p(x,y,z),
        queue:(x,y,z,fn,options)=>{
          const q=v.p(x,y,z),ox=Math.floor(q[0])-16,oy=Math.floor(q[1])-40;
          const tile=E.mkCanvas(32,48),tg=E.ctx2d(tile);
          tg.translate(-ox,-oy);fn(tg);tg.setTransform(1,0,0,1,0,0);
          obstacles.set(Math.floor((y-1)/T)*width+Math.floor(x/T),{canvas:tile,x,y,z,ox,oy,options});
        }};
      this.floorPixels(cacheR,w);
      this.floorCanvas=canvas;this.floorObstacles=obstacles;this.floorWorld=w;this.floorKey=key;
    }
    const k=view.scale/baseScale,g=r.tgt,cv=this.floorCanvas;
    g.imageSmoothingEnabled=false;
    // Crop the source before scaling it. This avoids processing the whole map
    // when a browser's Canvas implementation clips after its image transform.
    const sx=Math.max(0,Math.floor(r.ix/k)),sy=Math.max(0,Math.floor(r.iy/k));
    const sw=Math.min(cv.width-sx,Math.ceil((r.ix+r.bw)/k)-sx+1);
    const sh=Math.min(cv.height-sy,Math.ceil((r.iy+r.bh)/k)-sy+1);
    if(sw>0&&sh>0)g.drawImage(cv,sx,sy,sw,sh,sx*k-r.ix,sy*k-r.iy,sw*k,sh*k);P.reset(g);
    this.terrainMotion(r,w);
  }

  terrainMotion(r,w){
    const rows=w.tiles||[],W=w.width||80,H=w.height||64;
    const lo=r.view.toGround(r.ix-35,r.iy-35),hi=r.view.toGround(r.ix+r.bw+35,r.iy+r.bh+110);
    if(!lo||!hi)return;
    const x0=clamp(Math.floor(lo[0]/T)-1,0,W),x1=clamp(Math.ceil(hi[0]/T)+1,0,W),y0=clamp(Math.floor(lo[1]/T)-1,0,H),y1=clamp(Math.ceil(hi[1]/T)+1,0,H);
    const S=r.view.scale,get=(x,y)=>rows[y]?.[x]||' ',g=r.tgt;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const tile=get(x,y),X=x*T,Y=y*T,h=hash(x,y);
      if(tile==='~'&&h>.6){
        const u=(this.time*.13+h)%1,xx=X+3+h*8,yy=Y+3+hash(y,x)*8;
        const a=r.w(xx,yy),b=r.w(xx+1+Math.sin(u*Math.PI)*5,yy);
        line(g,a,b,u>.35&&u<.7?'#2b5960':'#204852');
      }else if(tile==='#'||tile==='G'){
        const stamp=this.floorObstacles.get(y*W+x);if(!stamp)continue;
        const k=S/1.5,dx=stamp.ox*k-r.ix,dy=stamp.oy*k-r.iy,dw=32*k,dh=48*k;
        r.queue(stamp.x,stamp.y,stamp.z,q=>{
          q.drawImage(stamp.canvas,dx,dy,dw,dh);
        },{...stamp.options,box:[dx,dy,dx+dw,dy+dh]});
      }
    }
  }

  floorPixels(r,w){
    const rows=w.tiles||[], W=w.width||rows[0]?.length||70,H=w.height||rows.length||56;
    const inv=r.view.toGround(r.ix-70,r.iy-70), inv2=r.view.toGround(r.ix+r.bw+70,r.iy+r.bh+160);
    const x0=clamp(Math.floor((inv?inv[0]:0)/T)-2,0,W),x1=clamp(Math.ceil((inv2?inv2[0]:W*T)/T)+2,0,W);
    const y0=clamp(Math.floor((inv?inv[1]:0)/T)-2,0,H),y1=clamp(Math.ceil((inv2?inv2[1]:H*T)/T)+2,0,H);
    const g=r.tgt, S=r.view.scale, get=(x,y)=>rows[y]?.[x]||' ';
    const quad=(x,y,z=0)=>[r.w(x,y,z),r.w(x+T,y,z),r.w(x+T,y+T,z),r.w(x,y+T,z)];
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const k=get(x,y),X=x*T,Y=y*T,h=hash(x,y), p=quad(X,Y);
      if(k===' ') {poly(g,p,'#0a232a');continue;}
      if(k==='~'){
        poly(g,p,['#133b45','#143e47','#153c47','#153d46'][Math.floor(h*4)]);
        const t=Math.floor(this.time*3), ax=X+2+hash(x,y+3)*8,ay=Y+3+hash(x+4,y)*9;
        const a=r.w(ax,ay),b=r.w(ax+4+Math.sin(this.time+x)*2,ay);
        line(g,a,b,(x+y+t)%4===0?'#3a6c6a':'#24505a');
        if(h>.56){const q=r.w(X+3,Y+11);P.rect(g,q[0],q[1],3*S,1,'#224c57');}
        if(get(x,y-1)!=='~'){line(g,r.w(X,Y+1),r.w(X+T,Y+1),'#548c7b');line(g,r.w(X,Y+3),r.w(X+T,Y+3),'#254f58');}
        if(get(x-1,y)!=='~')line(g,r.w(X+1,Y),r.w(X+1,Y+T),'#427967');
        continue;
      }
      if(k==='#'){
        poly(g,p,'#162e31');
        // Moss shelves give solid boundaries height without hiding the play field.
        r.queue(X+8,Y+16,0,q=>{
          const z=8+(h>.7?2:0);
          if(get(x,y+1)!=='#'){
            poly(q,[r.w(X,Y+16,0),r.w(X+16,Y+16,0),r.w(X+16,Y+16,z),r.w(X,Y+16,z)],'#223c3d');
            for(let i=2;i<16;i+=5)line(q,r.w(X+i,Y+16,1),r.w(X+i+2,Y+16,z-2),'#314e47');
            line(q,r.w(X,Y+16,z),r.w(X+16,Y+16,z),'#608263');
          }
          poly(q,quad(X,Y,z),h>.6?'#284c40':'#26483d');
          for(let j=0;j<4;j++){
            const xx=X+2+hash(x+j*9,y)*11, yy=Y+2+hash(x,y+j*17)*11;
            const a=r.w(xx,yy,z);P.rect(q,a[0],a[1],Math.max(1,2*S),Math.max(1,S),j%2?'#3c6248':'#31583e');
          }
        },{occluder:true});
        continue;
      }
      if(k==='=' ){
        poly(g,p,'#513f31');
        for(let i=0;i<4;i++){
          const yy=Y+i*4,shade=['#826b48','#927b52','#796547','#88734c'][(x+i)%4];
          poly(g,[r.w(X,yy,.4),r.w(X+16,yy,.4),r.w(X+16,yy+3,.4),r.w(X,yy+3,.4)],shade);
          line(g,r.w(X+1,yy+1,.6),r.w(X+13,yy+1,.6),'#a08656');
          for(const xx of [X+2,X+14]){const a=r.w(xx,yy+1,.7);P.dot(g,a[0],a[1],'#413c32');}
        }
        continue;
      }
      if(k==='G'){
        poly(g,p,'#374347');
        r.queue(X+8,Y+14,0,q=>{
          for(let i=2;i<16;i+=5){line(q,r.w(X+i,Y+9,0),r.w(X+i,Y+9,22),'#2e5760',Math.max(1,2*S));line(q,r.w(X+i-1,Y+9,1),r.w(X+i-1,Y+9,22),'#829b89');}
          for(const z of [6,17])line(q,r.w(X,Y+9,z),r.w(X+16,Y+9,z),'#baaa7a',Math.max(1,2*S));
        },{occluder:true});
        continue;
      }
      const stone=k==='.'||k===':',ruin=k===':';
      if(stone){
        poly(g,p,ruin?'#293e43':'#2e4545');
        const base=ruin?['#3e5459','#42585c','#3a5156','#465c60']:['#5a685d','#657261','#5d6d5e','#667466'];
        const cuts=[0,7,16];
        for(let j=0;j<2;j++){
          const a=cuts[j],b=cuts[j+1],d=j?((x+y)%2?5:10):((x-y)%2?11:6);
          for(const [l,rr] of [[0,d],[d,16]]){
            const shade=base[Math.floor(hash(x*17+l,y*31+j)*4)];
            poly(g,[r.w(X+l+1,Y+a+1),r.w(X+rr-1,Y+a+1),r.w(X+rr-.5,Y+b-1),r.w(X+l+.5,Y+b-1)],shade);
            line(g,r.w(X+l+1,Y+a+1),r.w(X+rr-1,Y+a+1),ruin?'#536a68':'#7b8770');
          }
        }
        if(h>.68){const a=r.w(X+2,Y+3),b=r.w(X+5,Y+6),c=r.w(X+3,Y+8);line(g,a,b,ruin?'#283f43':'#3b5147');line(g,b,c,ruin?'#283f43':'#3b5147');}
        if(h>.8){const a=r.w(X+11,Y+10);P.rect(g,a[0],a[1],2*S,S,ruin?'#748170':'#82906e');}
      }else{
        const wide=hash(Math.floor(x/3),Math.floor(y/3));
        const base=['#163b33','#193e35','#1b4036','#1d4438'][Math.floor(wide*4)];
        poly(g,p,base);
        for(let j=0;j<5;j++){
          const xx=X+hash(x*7+j,y+11)*15,yy=Y+hash(x+3,y*7+j)*15,a=r.w(xx,yy);
          P.rect(g,a[0],a[1],(j%3===0?2:1)*S,Math.max(1,S),j===0?'#2d5140':j===1?'#264b3c':'#204738');
          if(j<2&&h>.3)line(g,a,r.w(xx-.8,yy,2),j===0?'#386146':'#2d563d');
        }
        // Short worn edges join grass to flags and banks.
        for(const [dx,dy] of [[0,-1],[-1,0]])if(['.',':','='].includes(get(x+dx,y+dy))){
          for(let j=0;j<4;j++){
            const a=r.w(X+(dx?1:j*4+1),Y+(dy?1:j*4+1));P.rect(g,a[0],a[1],2*S,S,'#56714d');
          }
        }
      }
    }
  }

  stamp(key,draw,W=96,H=112){
    if(this.stamps.has(key))return this.stamps.get(key);
    const canvas=E.mkCanvas(W,H),g=E.ctx2d(canvas);
    draw(g,W,H);const item={canvas,W,H};this.stamps.set(key,item);return item;
  }

  blit(r,g,stamp,x,y,ox,oy,sz=1,alpha=1){
    const [sx,sy]=r.w(x,y,0),S=r.view.scale*sz;
    const a=g.globalAlpha;g.globalAlpha=a*alpha;
    g.drawImage(stamp.canvas,Math.round(sx-ox*S),Math.round(sy-oy*S),Math.round(stamp.W*S),Math.round(stamp.H*S));
    g.globalAlpha=a;P.reset(g);
  }

  prop(r,w,p){
    if(!r.visible(p.x,p.y,0,140,100,180))return;
    const type=p.type||'stone',v=Number(p.variant)||Math.floor(hash(p.x,p.y)*4),active=this.isRestored(w,p.requires);
    if(type==='tree'||type==='pine'||type==='willow'||type==='deadTree')return this.tree(r,w,p,v,type);
    if(type==='cottage'||type==='house'||type==='workshop'||type==='mill'||type==='hut')return this.cottage(r,w,p,v,active);
    if(type==='bell'||type==='greatBell'||type==='bellTower'||type==='belfry')return this.bell(r,w,p,active);
    if(type==='gate'||type==='arch'||type==='stoneGate'||type==='ruinGate')return this.arch(r,w,p,active);
    if(type==='lantern'||type==='lamp'||type==='torch'||type==='beacon')return this.lantern(r,w,p,active);
    if(type==='bridge')return this.bridge(r,w,p,active);
    if(type==='fountain'||type==='well'||type==='spring')return this.well(r,w,p,active);
    if(type==='garden'||type==='flowers'||type==='flowerbed')return this.garden(r,w,p,active);
    if(type==='pillar'||type==='column'||type==='obelisk')return this.pillar(r,w,p,active);
    if(type==='shrine'||type==='altar'||type==='checkpoint')return this.shrine(r,w,p,active);
    if(type==='bench'||type==='fence'||type==='sign'||type==='banner')return this.woodwork(r,w,p,active);
    if(type==='portal'||type==='waystone')return this.shrine(r,w,p,active);
    this.smallProp(r,w,p,v,active);
  }

  tree(r,w,p,v,type){
    const active=this.isRestored(w,p.requires);
    if(!active){
      r.decal(g=>{r.groundRing(p.x,p.y,24,'#48746a',.45);r.groundDisc(p.x,p.y,21,'#193735',.35);});
      r.queue(p.x,p.y,0,g=>{
        const a=r.w(p.x,p.y),b=r.w(p.x,p.y,36),c=r.w(p.x-16,p.y,46),d=r.w(p.x+18,p.y,49);
        P.blend(g,.28,'normal',()=>{line(g,a,b,'#6d9984',2*r.view.scale);line(g,b,c,'#6d9984',r.view.scale);line(g,b,d,'#6d9984',r.view.scale);});
      });return;
    }
    const dead=type==='deadTree',key=`tree-${type}-${v%4}`;
    const stamp=this.stamp(key,(g)=>{
      const mid=48;
      // A bent split trunk holds an asymmetric crown; roots attach it to the floor.
      poly(g,[[43,102],[42,89],[37,76],[39,57],[48,46],[52,61],[50,77],[55,92],[54,103]],'#263b32');
      poly(g,[[44,100],[45,76],[42,62],[48,47],[48,75],[51,101]],'#685647');
      poly(g,[[46,97],[46,76],[45,68],[48,55],[48,85],[50,100]],'#897450');
      line(g,[43,92],[35,106],'#5c5741',3);line(g,[49,92],[59,105],'#534c3b',3);
      line(g,[46,99],[45,110],'#6c6848',2);line(g,[52,102],[64,105],'#384832',2);
      line(g,[46,76],[25,55],'#5b5340',4);line(g,[48,72],[71,50],'#5b5340',4);
      if(dead){
        line(g,[46,63],[39,31],'#5e594f',5);line(g,[38,39],[22,31],'#5e594f',3);
        line(g,[69,53],[71,31],'#5e594f',3);line(g,[46,57],[55,37],'#6e6b59',2);
        for(let j=0;j<6;j++)P.dot(g,40+hash(j,v)*15,40+hash(j+8,v)*37,'#71988a');
        return;
      }
      const palettes=[
        ['#102b2b','#173b32','#24543d','#346849','#4a7c51','#6d9561'],
        ['#102d31','#164139','#23594a','#33735b','#50916b','#78ad7c'],
        ['#183329','#244836','#3b6040','#577948','#7e9256','#9da46d'],
        ['#132e35','#1c4245','#2b5957','#3e7266','#628f7a','#8dad88']
      ];
      const pal=palettes[v%4];
      const masses=[[32,55,24,19],[65,54,25,20],[50,35,30,23],[33,29,19,17],[65,29,17,16],[48,14,17,12]];
      for(let m=0;m<masses.length;m++){
        const [cx,cy,rx,ry]=masses[m];
        P.ell(g,cx,cy,rx,ry,pal[0]);
        P.ell(g,cx,cy-3,rx-1,ry-3,pal[1]);
        for(let j=0;j<16;j++){
          const a=hash(j*5+m,v+67)*TAU,dist=Math.sqrt(hash(j+m*7,v+27));
          const xx=cx+Math.cos(a)*rx*.75*dist,yy=cy-3+Math.sin(a)*ry*.65*dist;
          const lit=xx+yy*.7 < cx+cy*.7 ? 3 : 2;
          P.ell(g,xx,yy,4+hash(j,v)*6,3+hash(m,j)*4,pal[lit]);
          if(j%3===0)P.ell(g,xx-2,yy-2,3+hash(m,j)*3,2,pal[lit+1]);
        }
        for(let j=0;j<9;j++){
          const xx=cx-rx*.6+hash(j+m,v+28)*rx*1.1, yy=cy-ry*.7+hash(j+34,m)*ry;
          P.rect(g,xx,yy,2,1,pal[4]);
        }
      }
      // Few warm rim leaves carry the light across the cool canopy.
      for(let j=0;j<18;j++){
        const xx=24+hash(j*9,v)*44,yy=9+hash(j,v+19)*41;
        if(hash(j+51,v)>.45)P.rect(g,xx,yy,2,1,pal[5]);
      }
      P.ell(g,35,105,6,2,'#284b39');P.ell(g,61,105,7,2,'#2f543c');
      for(const xx of [32,38,61]){line(g,[xx,104],[xx-1,100],'#507648');P.dot(g,xx-1,99,'#80965e');}
    },96,112);
    const sz=(p.scale||1)*(type==='willow'?.95:.64);
    r.shadow(p.x,p.y,16*sz,.22,'#071e26');
    const near=w.hero&&Math.hypot(w.hero.x-p.x,w.hero.y-(p.y-17))<27;
    r.queue(p.x,p.y,0,g=>{
      this.blit(r,g,stamp,p.x,p.y,48,106,sz,near?.62:1);
      if(type==='willow'){
        const q=r.w(p.x,p.y),S=r.view.scale;
        P.blend(g,near?.64:1,'normal',()=>{
          for(let j=0;j<18;j++){
            const xx=(-30+j*3.5)*S,top=(-48+Math.abs(j-9)*.8)*S,len=(18+hash(j,19)*14)*S;
            let prev=[q[0]+xx,q[1]+top];
            for(let k=1;k<7;k++){
              const u=k/6,pt=[q[0]+xx+Math.sin(this.time*.8+j+u*3)*1.3*S,q[1]+top+len*u];
              line(g,prev,pt,j%3?'#65997a':'#94b883',Math.max(1,S));
              if(k%2===0)P.ell(g,pt[0]-S,pt[1],2*S,S,j%3?'#82b58a':'#aacb95');prev=pt;
            }
          }
        });
      }
    },{hides:true,solid:true});
  }

  cottage(r,w,p,v,active){
    const sz=(p.scale||1)*.77;
    if(!active){
      r.decal(g=>{
        const Pts=[r.w(p.x-31,p.y-23),r.w(p.x+31,p.y-23),r.w(p.x+31,p.y+2),r.w(p.x-31,p.y+2)];
        poly(g,Pts,'#1a3538');for(let i=0;i<4;i++)line(g,Pts[i],Pts[(i+1)%4],'#456c65');
      });
      r.queue(p.x,p.y,0,g=>{
        const a=r.w(p.x,p.y),S=r.view.scale;
        const pts=[[-31,-2],[-31,-31],[-38,-32],[-25,-58],[5,-68],[35,-46],[40,-34],[31,-34],[31,-2]];
        P.blend(g,.25,'normal',()=>{for(let i=0;i<pts.length-1;i++)line(g,[a[0]+pts[i][0]*S,a[1]+pts[i][1]*S],[a[0]+pts[i+1][0]*S,a[1]+pts[i+1][1]*S],'#86ad9a');});
        for(let j=0;j<4;j++){const z=(this.time*7+j*14)%55,q=r.w(p.x+(j-1.5)*15,p.y,z);P.dot(g,q[0],q[1],'#638d81');}
      });return;
    }
    const stamp=this.stamp(`cottage-${v%3}`,(g)=>{
      const roof=v%3===0?['#3e3e37','#775640','#9f704c','#c2955b']:v%3===1?['#273e44','#3d6265','#598075','#81a18d']:['#4d3e46','#7c5558','#a36f66','#c49377'];
      // Walls, foundation, heavy oak frame and a deep front porch.
      poly(g,[[14,84],[14,53],[75,53],[89,67],[89,90],[33,102]],'#3b514c');
      poly(g,[[15,55],[72,55],[72,90],[15,90]],'#b4a585');
      poly(g,[[72,55],[88,64],[88,89],[72,95]],'#7e8c77');
      P.rect(g,15,83,57,9,'#53665b');
      for(let y=85;y<91;y+=3)for(let x=15;x<72;x+=10)line(g,[x+(y%2)*3,y],[x+8+(y%2)*3,y],'#87927a');
      for(const x of [16,39,68])P.rect(g,x,52,4,34,'#665342');
      P.rect(g,15,60,57,3,'#705d46');P.rect(g,15,82,57,3,'#62523e');
      for(let j=0;j<20;j++)P.rect(g,20+hash(j,v)*45,65+hash(j,v+8)*15,2,1,'#a49678');
      // The door and windows have a bright inner edge, small enough to stay precious.
      P.rect(g,43,66,15,21,'#4b4636');P.rect(g,46,67,9,18,'#856642');
      P.rect(g,47,68,7,6,'#c7ae74');P.rect(g,49,69,3,4,'#f2d699');
      P.dot(g,53,78,'#f0ce8e');P.rect(g,40,87,22,4,'#899078');P.rect(g,38,91,25,3,'#5b6e61');
      for(const xx of [24,59]){
        P.rect(g,xx-2,67,11,11,'#625944');P.rect(g,xx,68,7,8,'#c18c52');
        P.rect(g,xx+1,69,5,6,'#efc985');P.rect(g,xx+2,70,3,4,'#ffe4a4');
        P.rect(g,xx+3,68,1,8,'#896a48');P.rect(g,xx,72,7,1,'#896a48');
        P.rect(g,xx-2,77,11,2,'#b3a47e');
      }
      // Layered shingles follow the two roof planes.
      poly(g,[[6,56],[19,23],[60,13],[93,38],[92,62],[73,53],[16,63]],'#142e32');
      poly(g,[[7,54],[21,24],[60,15],[72,52],[15,59]],roof[1]);
      poly(g,[[60,15],[92,39],[91,59],[72,52]],roof[0]);
      for(let row=0;row<7;row++){
        const u=row/7, yy=25+u*30, left=21-u*11,right=62+u*9;
        for(let xx=left+(row%2)*4;xx<right;xx+=9){
          const top=yy-(xx-left)*.17;
          const co=roof[hash(Math.floor(xx),row+v)>.5?2:1];
          poly(g,[[xx,top],[xx+8,top-1],[xx+9,top+3],[xx-1,top+4]],co);
          line(g,[xx,top],[xx+7,top-1],hash(row,Math.floor(xx))>.58?roof[3]:roof[2]);
        }
      }
      line(g,[20,24],[60,14],roof[3],2);line(g,[7,57],[72,51],roof[0],3);
      line(g,[9,58],[72,53],'#cfb17c');line(g,[60,15],[92,40],roof[2],2);
      line(g,[73,53],[91,60],roof[1],2);
      // Masonry chimney and an ivy cord anchor the building in the world.
      P.rect(g,29,14,9,17,'#748075');P.rect(g,28,13,11,4,'#a0a38b');
      P.rect(g,31,13,6,2,'#374949');line(g,[29,21],[37,21],'#a8a991');P.dot(g,33,26,'#435d55');
      line(g,[17,64],[18,84],'#3f6a49',2);line(g,[16,66],[23,64],'#3f6a49',2);
      for(let j=0;j<7;j++)P.ell(g,15+(j%2)*5,64+j*3,3,1,'#63895b');
      P.ell(g,23,94,8,3,'#405e40');P.ell(g,77,96,9,3,'#315a46');
      for(let j=0;j<9;j++){const xx=14+hash(j,v)*14;P.dot(g,xx,92+hash(j+4,v)*4,j%2?'#d2b973':'#dc956c');}
    },104,112);
    r.shadow(p.x,p.y-7,31,.3,'#061e25');
    r.queue(p.x,p.y,0,g=>{
      this.blit(r,g,stamp,p.x,p.y,52,98,sz);
      const q=r.w(p.x-9,p.y-3,21),S=r.view.scale;
      r.glowDisc(g,q[0],q[1],14*S,'#e8b364',.07);
    },{hides:true,solid:true});
    if(p.type==='mill'){
      // An actual turning wheel makes the mill's change visible from the lane.
      r.queue(p.x+27,p.y+5,0,g=>{
        const S=r.view.scale,q=r.w(p.x+28,p.y+4,14),turn=w.flags?.millRunning?this.time*.4:0,rr=15*S;
        P.disc(g,q[0],q[1],rr,'#3d4135');P.disc(g,q[0],q[1],rr-2*S,'#9b8758');P.disc(g,q[0],q[1],rr-4*S,'#304940');
        for(let j=0;j<10;j++){
          const a=j/10*TAU+turn,xx=q[0]+Math.cos(a)*rr,yy=q[1]+Math.sin(a)*rr;
          line(g,q,[xx,yy],'#af9762',2*S);P.rect(g,xx-2*S,yy-2*S,4*S,4*S,'#b5a06c');
        }
        P.disc(g,q[0],q[1],3*S,'#c5b183');P.disc(g,q[0],q[1],S,'#48554a');
        if(w.flags?.millRunning)for(let j=0;j<4;j++){
          const u=(this.time*.8+j*.25)%1,pp=r.w(p.x+28+(j-1.5)*4,p.y+8+u*7,6-u*6);P.dot(g,pp[0],pp[1],'#a1c9b0');
        }
      },{solid:true});
    }
    const smokeX=p.x-17,smokeY=p.y-22;
    r.queue(p.x,p.y,50,g=>{
      const S=r.view.scale;
      for(let j=0;j<3;j++){
        const u=(this.time*.15+j/3)%1, q=r.w(smokeX+Math.sin(u*6+this.time*.1)*5,smokeY,52+u*30);
        P.blend(g,(1-u)*.13,'normal',()=>P.ell(g,q[0],q[1],(3+u*5)*S,(2+u*3)*S,'#acc4ae'));
      }
    },{bias:2});
  }

  lantern(r,w,p,active){
    const S=r.view.scale,H=p.type==='torch'?19:27;
    r.shadow(p.x,p.y,6,.18);
    if(active)r.decal(g=>{
      r.groundDisc(p.x,p.y,18,'#b9b879',.06);r.groundDisc(p.x,p.y,9,'#f5d99b',.06);
    });
    r.queue(p.x,p.y,0,g=>{
      const a=r.w(p.x,p.y,0),top=r.w(p.x,p.y,H),h=r.w(p.x+3,p.y,H-4);
      line(g,a,top,'#243c3b',Math.max(2,3*S));line(g,[a[0]-S,a[1]], [top[0]-S,top[1]],'#8c8159',Math.max(1,S));
      line(g,top,[h[0]+3*S,top[1]],'#aa9766',Math.max(1,S));line(g,[h[0],top[1]],[h[0],h[1]],'#a89869');
      P.rect(g,h[0]-3*S,h[1],6*S,8*S,'#172f35');
      P.rect(g,h[0]-2*S,h[1]+S,4*S,6*S,active?'#d99151':'#4f655d');
      if(active){
        P.rect(g,h[0]-S,h[1]+2*S,2*S,4*S,'#fff0ae');P.dot(g,h[0],h[1]+2*S,'#fffbe1');
        r.glowDisc(g,h[0],h[1]+4*S,(14+Math.sin(this.time*3+p.x)*.8)*S,'#edb567',.17);
      }
      P.rect(g,h[0]-4*S,h[1]-S,8*S,S,'#8b7854');P.rect(g,h[0]-3*S,h[1]+8*S,6*S,S,'#a28d61');
    },{emissive:active});
  }

  arch(r,w,p,active){
    const W=p.w||65,H=p.h||42,x=p.x,y=p.y;
    r.shadow(x,y,30,.23);
    r.queue(x,y,0,g=>{
      const a=r.w(x,y),S=r.view.scale;
      const pp=(dx,dz)=>r.w(x+dx,y,dz);
      for(const side of [-1,1]){
        r.box(g,x+side*W/2-5,y-4,0,x+side*W/2+5,y+5,H,'#728071','#485e5c');
        for(let z=5;z<H;z+=8)line(g,pp(side*W/2-5,z),pp(side*W/2+5,z),'#2b4647');
        r.box(g,x+side*W/2-7,y-6,H,x+side*W/2+7,y+6,H+5,'#9da58a','#526d65');
      }
      const roof=[pp(-W/2-9,H+5),pp(-W/2+1,H+18),pp(W/2-1,H+18),pp(W/2+9,H+5)];
      poly(g,roof,'#435e5b');line(g,roof[1],roof[2],'#9caa8a',Math.max(1,2*S));
      const face=[pp(-W/2+1,H+6),pp(-W/2+9,H+14),pp(W/2-9,H+14),pp(W/2-1,H+6)];poly(g,face,'#6f8370');
      for(let dx=-20;dx<=20;dx+=8){const q=pp(dx,H+10);P.rect(g,q[0],q[1],2*S,1,active?'#dfca83':'#8b9b7c');}
      const gem=pp(0,H+12);diamond(g,gem[0],gem[1],4*S,active?'#cae5b6':'#4b685f');
      // Small vines cut the precise silhouette of the old gate.
      for(const side of [-1,1])for(let j=0;j<5;j++){
        const q=pp(side*(W/2+3)+Math.sin(j)*2,H+6-j*5);P.ell(g,q[0],q[1],3*S,S,j%2?'#456f4c':'#76915d');
      }
    },{hides:true,solid:true});
  }

  bell(r,w,p,active){
    const x=p.x,y=p.y,S=r.view.scale;
    const alive=w.defeatedBoss||active&&p.requires;
    r.decal(g=>{
      r.groundDisc(x,y,43,'#263a40',1);
      r.groundRing(x,y,42,'#86917a',1);
      r.groundRing(x,y,37,'#536e67',1);
      for(let j=0;j<12;j++){
        const a=j/12*TAU,aa=r.w(x+Math.cos(a)*32,y+Math.sin(a)*32),bb=r.w(x+Math.cos(a)*38,y+Math.sin(a)*38);line(g,aa,bb,'#78846a');
      }
    });
    r.queue(x,y+5,0,g=>{
      const pp=(dx,dy,dz)=>r.w(x+dx,y+dy,dz);
      // The empty bell frame is the strongest landmark of the level.
      for(const side of [-1,1]){
        r.box(g,x+side*32-5,y-1,0,x+side*32+5,y+9,62,'#607971','#334e53');
        for(let z=9;z<61;z+=10)line(g,pp(side*32-5,9,z),pp(side*32+5,9,z),'#203b45');
        r.box(g,x+side*32-7,y-3,60,x+side*32+7,y+11,68,'#8e9c85','#4f6c65');
        const cr=pp(side*32,4,72);diamond(g,cr[0],cr[1],5*S,'#709986');
      }
      r.box(g,x-40,y-1,68,x+40,y+9,74,'#919780','#526b63');
      line(g,pp(-38,9,69),pp(38,9,69),'#c1b58e',2*S);
      const swing=w.defeatedBoss?Math.sin(this.time*2)*2:Math.sin(this.time*.7)*.45;
      const [cx,cy]=pp(swing,4,49);
      line(g,pp(0,4,68),pp(swing,4,58),'#8d8d6d',Math.max(2,3*S));
      const pts=[[-12,-12],[-8,-22],[-5,-25],[5,-25],[8,-22],[12,-12],[14,5],[23,15],[22,20],[-22,20],[-23,15],[-14,5]].map(q=>[cx+q[0]*S,cy+q[1]*S]);
      poly(g,pts,'#1c3b40');
      const body=[[-10,-12],[-7,-21],[-4,-23],[4,-23],[7,-21],[10,-12],[12,7],[20,16],[-20,16],[-12,7]].map(q=>[cx+q[0]*S,cy+q[1]*S]);
      poly(g,body,alive?'#a8a175':'#6d8475');
      poly(g,[[-8,-17],[-4,-22],[0,-22],[-1,11],[-13,14],[-10,3]].map(q=>[cx+q[0]*S,cy+q[1]*S]),alive?'#d8c386':'#a5ae86');
      poly(g,[[5,-20],[8,-12],[10,7],[18,14],[7,13]].map(q=>[cx+q[0]*S,cy+q[1]*S]),'#48645c');
      P.ell(g,cx,cy+18*S,22*S,5*S,'#384f49');P.ell(g,cx,cy+17*S,19*S,3*S,'#182f35');
      P.ell(g,cx,cy+14*S,21*S,2*S,alive?'#d6bf81':'#a2a47d');
      line(g,[cx,cy+12*S],[cx+swing*S,cy+23*S],'#6b7863',2*S);P.disc(g,cx+swing*S,cy+24*S,3*S,'#acac7f');
      for(const yy of [-9,-5,8])line(g,[cx-11*S,cy+yy*S],[cx+11*S,cy+yy*S],alive?'#d7bd7b':'#bac09a');
      const gemY=cy+1*S;diamond(g,cx,gemY,4*S,alive?'#fff1ad':'#78bda2');
      if(alive)r.glowDisc(g,cx,gemY,27*S,'#d0c876',.14);
      // A root climbs the frame, then ends in a new leaf after the bell is freed.
      for(const side of [-1,1]){
        line(g,pp(side*34,10,3),pp(side*30,10,28),'#535b43',2*S);
        line(g,pp(side*30,10,28),pp(side*35,10,42),'#535b43',2*S);
        for(let j=0;j<6;j++){
          const q=pp(side*33+(j%2?3:-3),10,7+j*6);P.ell(g,q[0],q[1],3*S,S,alive?'#79ad65':'#406653');
        }
      }
    },{solid:true,hides:true});
  }

  bridge(r,w,p,active){
    const x=p.x,y=p.y,W=p.w||74,H=p.h||30;
    if(!active){r.decal(g=>r.groundRing(x,y,17,'#567b72',.3));return;}
    // Floor tiles carry the deck; this adds posts, ropes and weathered hand rails.
    for(const dy of [-H/2,H/2])r.queue(x,y+dy,0,g=>{
      const a=r.w(x-W/2,y+dy,12),b=r.w(x+W/2,y+dy,12);
      line(g,a,b,'#655840',2*r.view.scale);line(g,[a[0],a[1]-1],[b[0],b[1]-1],'#b3a072');
      for(const dx of [-W/2,0,W/2]){
        r.box(g,x+dx-2,y+dy-2,0,x+dx+2,y+dy+2,17,'#b7a473','#726849');
        const q=r.w(x+dx,y+dy,18);P.disc(g,q[0],q[1],2*r.view.scale,'#c7b985');
      }
    },{hides:true});
  }

  well(r,w,p,active){
    const x=p.x,y=p.y,S=r.view.scale;
    r.shadow(x,y,15,.2);
    r.queue(x,y+5,0,g=>{
      const q=r.w(x,y,0),a=r.w(x,y,10);
      P.ell(g,q[0],q[1],16*S,8*S,'#314c4a');
      P.rect(g,q[0]-16*S,a[1],32*S,q[1]-a[1],'#5f7567');
      P.ell(g,a[0],a[1],16*S,7*S,'#a5aa89');P.ell(g,a[0],a[1],12*S,4*S,'#314f56');
      if(active){P.ell(g,a[0],a[1]+S,10*S,3*S,'#598882');line(g,[a[0]-6*S,a[1]],[a[0]+3*S,a[1]],'#a4d8be');}
      for(let j=0;j<4;j++)line(g,[q[0]-12*S+j*8*S,a[1]+6*S],[q[0]-12*S+j*8*S,q[1]+3*S],'#415a54');
      line(g,[q[0]-12*S,q[1]-2*S],[q[0]+12*S,q[1]-2*S],'#92a17e');
      for(const dx of [-12,12])line(g,r.w(x+dx,y,10),r.w(x+dx,y,34),'#78684b',Math.max(1,2*S));
      line(g,r.w(x-15,y,35),r.w(x+15,y,35),'#b0a071',3*S);
      line(g,r.w(x,y,35),r.w(x,y,16),'#bba476');
    },{hides:true});
  }

  garden(r,w,p,active){
    const x=p.x,y=p.y,W=p.w||35,H=p.h||18;
    r.decal(g=>{
      const pts=[r.w(x-W/2,y-H/2),r.w(x+W/2,y-H/2),r.w(x+W/2,y+H/2),r.w(x-W/2,y+H/2)];
      poly(g,pts,active?'#3b4935':'#283c35');
      for(let i=0;i<4;i++)line(g,pts[i],pts[(i+1)%4],active?'#817c51':'#51644e');
    });
    if(!active)return;
    r.queue(x,y+H/2,0,g=>{
      const S=r.view.scale;
      for(let j=0;j<32;j++){
        const xx=x-W/2+hash(j,9)*W,yy=y-H/2+hash(j,77)*H,zz=3+hash(j,25)*4;
        const a=r.w(xx,yy),b=r.w(xx,yy,zz);
        line(g,a,b,'#53774c',Math.max(1,S));P.ell(g,b[0]-S,b[1]+2*S,2*S,S,'#7a9560');
        P.disc(g,b[0],b[1],1.2*S,['#e9c777','#c98069','#8ec9bb','#dbc695'][j%4]);P.dot(g,b[0],b[1],'#fff0b2');
      }
    });
  }

  pillar(r,w,p,active){
    const x=p.x,y=p.y,H=p.h||22,S=r.view.scale;
    r.shadow(x,y,9,.2);
    r.queue(x,y,0,g=>{
      r.box(g,x-7,y-6,0,x+7,y+6,4,'#728573','#385953');
      r.box(g,x-4,y-4,4,x+4,y+4,H,'#a0a48a','#667e70');
      for(const dx of [-2,1])line(g,r.w(x+dx,y+4,5),r.w(x+dx,y+4,H-1),'#8a9b81');
      r.box(g,x-6,y-5,H,x+6,y+5,H+4,'#b1b498','#6f8978');
      const q=r.w(x,y+4,H*.6);diamond(g,q[0],q[1],2*S,active?'#9eceab':'#4e7464');
      line(g,r.w(x-5,y+5,4),r.w(x-3,y+5,13),'#3a694d',2*S);
      if(p.type==='obelisk'){
        const a=r.w(x,y,H+12),b=r.w(x-6,y,H+4),c=r.w(x+6,y,H+4);poly(g,[a,b,c],'#829d88');line(g,a,b,'#c3caa3');
      }
    },{hides:true});
  }

  shrine(r,w,p,active){
    const x=p.x,y=p.y,S=r.view.scale;
    if(!r.visible(x,y,0,50,30,75))return;
    r.decal(g=>{
      r.groundDisc(x,y,18,'#304c48',1);r.groundRing(x,y,17,'#82987a',.8);r.groundRing(x,y,12,'#8e997a',.5);
    });
    r.queue(x,y,0,g=>{
      r.box(g,x-8,y-6,0,x+8,y+6,4,'#96a385','#415f56');
      r.box(g,x-5,y-4,4,x+5,y+4,14,'#668979','#385b58');
      const q=r.w(x,y,23+Math.sin(this.time*2)*1.3);
      diamond(g,q[0],q[1],8*S,active?'#a0e0bb':'#506f64');diamond(g,q[0]-S,q[1]-S,5*S,active?'#d1efc6':'#799880');
      line(g,[q[0],q[1]-8*S],[q[0],q[1]+8*S],active?'#ecf7d0':'#8fab8c');
      if(active){r.glowDisc(g,q[0],q[1],21*S,'#9cc4a0',.12);P.dot(g,q[0],q[1]-7*S,'#fffde1');}
      for(let j=0;j<3;j++){
        const a=this.time*.7+j*TAU/3,pt=r.w(x+Math.cos(a)*9,y+Math.sin(a)*9,21+Math.sin(a*2)*4);
        P.dot(g,pt[0],pt[1],active?'#dbdc9a':'#719780');
      }
    },{emissive:active});
  }

  woodwork(r,w,p,active){
    const x=p.x,y=p.y,W=p.w||25,S=r.view.scale;
    r.queue(x,y,0,g=>{
      const c=active?'#998562':'#536c59',dark=active?'#655d43':'#395546';
      if(p.type==='banner'){
        if(!active)return;
        line(g,r.w(x,y,0),r.w(x,y,33),'#807450',2*S);
        const top=r.w(x,y,32),wave=Math.sin(this.time*2+x)*1.5*S;
        poly(g,[[top[0]+S,top[1]],[top[0]+13*S,top[1]+2*S],[top[0]+12*S+wave,top[1]+17*S],[top[0]+7*S+wave,top[1]+14*S],[top[0]+S,top[1]+18*S]],'#547a6c');
        line(g,[top[0]+2*S,top[1]+S],[top[0]+12*S,top[1]+3*S],'#c4ba82');diamond(g,top[0]+7*S,top[1]+8*S,3*S,'#d3c286');
      }else if(p.type==='sign'){
        line(g,r.w(x,y,0),r.w(x,y,19),dark,2*S);
        const q=r.w(x,y,21);poly(g,[[q[0]-10*S,q[1]-5*S],[q[0]+7*S,q[1]-5*S],[q[0]+11*S,q[1]],[q[0]+7*S,q[1]+4*S],[q[0]-10*S,q[1]+4*S]],c);
        line(g,[q[0]-5*S,q[1]],[q[0]+5*S,q[1]],'#d2c18b');line(g,[q[0]+2*S,q[1]-2*S],[q[0]+5*S,q[1]],'#d2c18b');
      }else{
        for(const dx of [-W/2,W/2]){line(g,r.w(x+dx,y,0),r.w(x+dx,y,p.type==='bench'?14:19),dark,3*S);const q=r.w(x+dx,y,19);P.dot(g,q[0],q[1],c);}
        if(p.type==='bench')r.box(g,x-W/2-2,y-4,8,x+W/2+2,y+4,10,c,dark);
        for(const z of p.type==='bench'?[14]:[7,15]){line(g,r.w(x-W/2-2,y,z),r.w(x+W/2+2,y,z),c,Math.max(1,2*S));}
      }
    },{hides:true});
  }

  smallProp(r,w,p,v,active){
    const x=p.x,y=p.y,S=r.view.scale,type=p.type;
    r.queue(x,y,0,g=>{
      const q=r.w(x,y),base=active?'#738570':'#4b685d';
      if(type==='reeds'){
        for(let j=0;j<7;j++){
          const xx=x+(j-3)*2,zz=7+hash(j,v)*13,a=r.w(xx,y+(j%2)*2),b=r.w(xx+Math.sin(this.time*.8+j)*1.4,y,zz);
          line(g,a,b,j%2?'#607c4e':'#7a9160',Math.max(1,S));P.ell(g,b[0],b[1],S,2*S,'#b3aa73');
        }
      }else if(type==='gravestone'){
        r.box(g,x-7,y-4,0,x+7,y+4,3,'#6c8373','#375950');
        r.box(g,x-5,y-2,3,x+5,y+2,17,'#96a189','#5a766b');
        const a=r.w(x,y+2,13);diamond(g,a[0],a[1],3*S,'#c0c1a0');
        line(g,r.w(x-3,y+2,7),r.w(x+3,y+2,7),'#8d9e83');
      }else if(type==='bush'||type==='fern'){
        const c=active?'#446a44':'#315447';
        for(let j=0;j<5;j++){
          const a=(j-2)*.45,top=r.w(x+Math.sin(a)*9,y-2,6+Math.cos(a)*5);line(g,q,top,c,Math.max(1,2*S));
          for(let i=1;i<4;i++){
            const u=i/4,xx=q[0]+(top[0]-q[0])*u,yy=q[1]+(top[1]-q[1])*u;
            line(g,[xx,yy],[xx-3*S*(1-u),yy-2*S],active?'#79a060':'#537b59');line(g,[xx,yy],[xx+3*S*(1-u),yy-2*S],active?'#6a9658':'#486f54');
          }
        }
      }else if(type==='mushroom'){
        for(let j=0;j<3;j++){
          const a=r.w(x+(j-1)*4,y+(j%2)*2),H=(4+j%2*3)*S;P.rect(g,a[0],a[1]-H,1*S,H,'#a1b498');P.ell(g,a[0],a[1]-H,3*S,2*S,j%2?'#a6c99c':'#cf9277');P.dot(g,a[0]-S,a[1]-H-S,'#e3d5a4');
        }
      }else if(type==='stump'){
        P.rect(g,q[0]-7*S,q[1]-7*S,14*S,9*S,'#514936');P.ell(g,q[0],q[1]-7*S,7*S,3*S,'#aa9367');P.ell(g,q[0],q[1]-7*S,4*S,2*S,'#6f6046');P.ell(g,q[0],q[1]-7*S,2*S,1*S,'#baa67b');
      }else if(type==='crate'){
        r.box(g,x-5,y-5,0,x+5,y+5,10,'#94835e','#695f49');line(g,r.w(x-4,y+5,1),r.w(x+4,y+5,9),'#ad9d71',S);
      }else if(type==='lily'){
        P.ell(g,q[0],q[1],6*S,3*S,'#4d8369');line(g,q,[q[0]+4*S,q[1]+2*S],'#1d484f');P.disc(g,q[0]-S,q[1]-2*S,2*S,'#e7bd97');P.dot(g,q[0]-S,q[1]-3*S,'#fff0b5');
      }else{
        const ww=(p.w||12)*.55,hh=p.h||7;
        poly(g,[r.w(x-ww,y+1),r.w(x-ww+2,y,hh-2),r.w(x-1,y-3,hh),r.w(x+ww,y-1,hh-1),r.w(x+ww+2,y+3,2),r.w(x+2,y+5)],'#304e4d');
        poly(g,[r.w(x-ww+2,y,hh-2),r.w(x-1,y-3,hh),r.w(x+ww,y-1,hh-1),r.w(x+2,y+2,hh-3)],base);
        line(g,r.w(x-ww+2,y,hh-2),r.w(x-1,y-3,hh),'#a1a88b');
        if(v%2===0){const a=r.w(x+1,y+3,3);P.ell(g,a[0],a[1],3*S,S,'#557951');}
      }
    },{hides:true});
  }

  seal(r,w,s){
    if(!r.visible(s.x,s.y,0,45,45,80))return;
    const state=s.state,done=state==='restored'||this.isRestored(w,s.id),ready=state==='ready',active=state==='active';
    const color=done?'#75bfa2':ready?'#f4d286':active?'#d98b79':'#6b8590', t=this.time;
    r.decal(g=>{
      r.groundDisc(s.x,s.y,15,done?'#294c42':'#202e38',1);
      r.groundRing(s.x,s.y,15,'#65796d',.8);
      r.groundRing(s.x,s.y,12,color,done?.7:.85);
      r.groundRing(s.x,s.y,10,done?'#3f826b':'#485766',.6);
      for(let j=0;j<4;j++){
        const a=j/4*TAU+Math.PI/4, q=r.w(s.x+Math.cos(a)*14,s.y+Math.sin(a)*14,.5);
        diamond(g,q[0],q[1],2*r.view.scale,color);
      }
      const count=s.total||4,remaining=s.remaining===undefined?count:s.remaining;
      for(let j=0;j<count;j++){
        const a=j/count*TAU-Math.PI/2,q=r.w(s.x+Math.cos(a)*17,s.y+Math.sin(a)*17,.6);
        P.disc(g,q[0],q[1],Math.max(1,r.view.scale),j<count-remaining||done?'#b6dda8':'#4f606a');
      }
      if(active)r.groundRing(s.x,s.y,18+Math.sin(t*3)*1.5,color,.25);
    });
    r.queue(s.x,s.y,1,g=>{
      const S=r.view.scale, q=r.w(s.x,s.y,2);
      if(done){
        line(g,q,r.w(s.x,s.y,10),'#84ba8b',Math.max(1,S));
        const a=r.w(s.x,s.y,6),b=r.w(s.x-4,s.y,9),c=r.w(s.x+5,s.y,11);
        poly(g,[a,b,[b[0]+5*S,b[1]]],'#91c384');poly(g,[a,c,[c[0]-5*S,c[1]+2*S]],'#bdd895');
      }else{
        const z=ready?11+Math.sin(t*2)*1.5:4.5+Math.sin(t*2)*.6, core=r.w(s.x,s.y,z);
        if(ready){
          r.glowDisc(g,core[0],core[1],21*S,'#f6c879',.15);
          diamond(g,core[0],core[1],6*S,'#ddad6f');diamond(g,core[0]-S,core[1]-S,4*S,'#fff2b9');
          for(let j=0;j<6;j++){const a=t*.8+j*TAU/6,pp=r.w(s.x+Math.cos(a)*11,s.y+Math.sin(a)*11,8+Math.sin(a*2)*5);P.dot(g,pp[0],pp[1],'#efdd9e');}
        }else{
          P.ell(g,core[0],core[1],6*S,3*S,'#172530');diamond(g,core[0],core[1],4*S,active?'#b46b68':'#657583');diamond(g,core[0],core[1]-S,2*S,active?'#f8b097':'#9da4a3');
        }
      }
    },{emissive:ready});
  }

  hero(r,w){
    const h=w.hero,rig=this.heroRig;
    r.shadow(h.x,h.y,6.5,.36,'#081d25');
    r.actor(h.x,h.y,h.z||0,(g,x,y)=>rig.draw(g,x,y,r.view),{
      outline:true,outlineColor:'#142d33',rim:true,xray:{color:'#c4ead1',outline:'#fff0b9'},
      flash:h.hurt>0&&Math.floor(this.time*13)%2===0?'#fff1c2':false,
      ghost:h.dashTime>0?{color:'#7ad5c7',life:.13,alpha:.3,owner:h}:null
    });
    rig.drawSmear(r,['#ffffdc','#dbf4c0','#7adac0','#3ba3a3']);
    // The companion arrives only when its echo has been freed.
    if(!w.restored?.has('moth'))return;
    const a=this.time*.9,x=h.x+Math.cos(a)*13,y=h.y+Math.sin(a)*7,z=(h.z||0)+19+Math.sin(a*2)*2;
    r.queue(x,y,z,g=>{
      const q=r.w(x,y,z),S=r.view.scale;
      r.glowDisc(g,q[0],q[1],10*S,'#e6d994',.15);
      diamond(g,q[0],q[1],2.5*S,'#fff0af');P.dot(g,q[0],q[1]-S,'#ffffe6');
      const b=r.w(x-Math.cos(a)*3,y-Math.sin(a)*3,z-1);P.dot(g,b[0],b[1],'#8cbf9b');
    },{emissive:true,bias:.2});
  }

  npc(r,w,n){
    if(!this.isRestored(w,n.requires)||!r.visible(n.x,n.y))return;
    if(n.id==='willow')return;
    if(n.id==='rook'){
      r.shadow(n.x,n.y,4,.2);
      r.queue(n.x,n.y,0,g=>{
        const q=r.w(n.x,n.y,3),S=r.view.scale,dir=w.hero&&w.hero.x<n.x?-1:1,bob=Math.sin(this.time*2)>0.9?1:0;
        P.ell(g,q[0],q[1]-3*S,5*S,4*S,'#6f9294');P.ell(g,q[0]-S,q[1]-4*S,4*S,3*S,'#b7cdc1');
        P.disc(g,q[0]+dir*3*S,q[1]-(7+bob)*S,3*S,'#d2e2ce');
        line(g,[q[0]+dir*5*S,q[1]-(7+bob)*S],[q[0]+dir*8*S,q[1]-(6+bob)*S],'#dbcba1');
        P.dot(g,q[0]+dir*4*S,q[1]-(8+bob)*S,'#24434d');line(g,[q[0]-dir*3*S,q[1]],[q[0]-dir*8*S,q[1]+2*S],'#8ea9a9',2*S);
        for(const dx of [-2,2])line(g,[q[0]+dx*S,q[1]],[q[0]+dx*S,q[1]+3*S],'#c1b38c');
      });return;
    }
    const rig=this.npcRigs.get(n.id);if(!rig)return;
    r.shadow(n.x,n.y,5,.25);
    r.actor(n.x,n.y,0,(g,x,y)=>rig.draw(g,x,y,r.view),{outline:true,outlineColor:'#162f32',rim:true,xray:true});
    if(w.hero&&Math.hypot(n.x-w.hero.x,n.y-w.hero.y)<24&&w.mode==='playing'){
      r.queue(n.x,n.y,31,g=>{
        const q=r.w(n.x,n.y,32+Math.sin(this.time*2)),S=r.view.scale;
        P.rect(g,q[0]-4*S,q[1]-3*S,9*S,6*S,'#dcd3a4');P.rect(g,q[0]-2*S,q[1]+3*S,2*S,2*S,'#dcd3a4');
        for(const dx of [-2,0,2])P.dot(g,q[0]+dx*S,q[1],'#3e655c');
      });
    }
  }

  enemy(r,w,e){
    if(!r.visible(e.x,e.y,e.z||0,90,90,120))return;
    const t=this.time,type=e.type||'husk',boss=type==='boss';
    const S=r.view.scale*(boss?1:type==='brute'?.8:.72);
    const hit=e.hit>0,wind=e.state==='wind'||e.windup>0,fac=e.facing||0;
    r.shadow(e.x,e.y,boss?17:type==='brute'?9:5.5,boss?.45:.28,'#101d2d');
    if(wind)r.decal(g=>{
      if(type==='boss'){
        if(e.pattern===2){
          const a=Math.atan2((e.targetY||e.y)-e.y,(e.targetX||e.x)-e.x);
          r.groundArc(e.x,e.y,10,97,a-.18,a+.18,'#dd927b',.18);r.groundArc(e.x,e.y,92,96,a-.18,a+.18,'#f0bd89',.7);
        }else{
          r.groundRing(e.x,e.y,43,'#e2a074',.55);r.groundRing(e.x,e.y,40,'#d36c68',.4);
          if(e.pattern===1)for(let j=0;j<8;j++){const a=j/8*TAU;line(g,r.w(e.x+Math.cos(a)*23,e.y+Math.sin(a)*23),r.w(e.x+Math.cos(a)*48,e.y+Math.sin(a)*48),'#c8897c');}
        }
      }else r.groundArc(e.x,e.y,4,type==='brute'?26:20,fac-.65,fac+.65,'#d0836e',.17);
    });
    r.actor(e.x,e.y,e.z||0,(g,ox,oy)=>{
      const c=(normal)=>hit?'#fff0c8':normal;
      const drawP=(pts,col)=>poly(g,pts.map(q=>[ox+q[0]*S,oy+q[1]*S]),c(col));
      const L=(a,b,col,ww=1)=>line(g,[ox+a[0]*S,oy+a[1]*S],[ox+b[0]*S,oy+b[1]*S],c(col),Math.max(1,ww*S));
      const D=(x,y,rr,col)=>P.disc(g,ox+x*S,oy+y*S,rr*S,c(col));
      const El=(x,y,rx,ry,col)=>P.ell(g,ox+x*S,oy+y*S,rx*S,ry*S,c(col));
      const walk=Math.sin(t*(boss?2.8:7)+(typeof e.id==='number'?e.id:String(e.id).length)*.9), bob=walk*(boss?.7:1);
      if(type==='wisp'){
        const b=Math.sin(t*3+e.x)*2;
        drawP([[-6,-4+b],[-9,-10+b],[-6,-17+b],[0,-21+b],[7,-16+b],[8,-8+b],[4,-2+b],[1,-6+b],[-2,-1+b],[-3,-6+b]],'#50647c');
        drawP([[-4,-10+b],[-5,-15+b],[0,-19+b],[4,-15+b],[5,-9+b],[1,-6+b]],'#99a29a');
        El(0,-12+b,3.2,3.8,'#213c52');D(-1,-13+b,1.4,wind?'#ffcf90':'#c2efd0');
        L([-7,-13+b],[-12,-9+b],'#728889');L([6,-13+b],[11,-16+b],'#728889');
        for(let j=0;j<3;j++){const u=(t*.9+j*.3)%1;D(Math.sin(u*6)*4,2+u*8,1-u*.7,'#5d948d');}
      }else if(type==='brute'){
        L([-7,-8],[-9-walk,1],'#405a57',5);L([7,-8],[9+walk,-1],'#405a57',5);
        drawP([[-12,-8],[-14,-19+bob],[-10,-29+bob],[4,-32+bob],[13,-25+bob],[15,-12+bob],[8,-5]],'#586d61');
        drawP([[-10,-20+bob],[-7,-29+bob],[3,-30+bob],[0,-12+bob],[-6,-7]],'#83927b');
        drawP([[1,-25+bob],[8,-28+bob],[12,-21+bob],[8,-13+bob],[1,-12+bob]],'#2c4a4d');
        for(const side of [-1,1]){
          const lift=wind?10:0;L([side*11,-23+bob],[side*16,-11-lift+bob],'#4f655b',5);L([side*16,-11-lift+bob],[side*20,-7-lift+bob],'#6e8170',4);
        }
        El(0,-33+bob,7,5,'#263f43');El(0,-34+bob,5,4,'#8c9b83');
        L([-3,-35+bob],[3,-35+bob],wind?'#ffd78e':'#a3e0b6',2);
        L([-5,-36+bob],[-8,-42+bob],'#526d61',2);L([4,-36+bob],[8,-40+bob],'#526d61',2);
        for(let j=0;j<3;j++){const xx=-6+j*5;L([xx,-24],[xx-2,-15],'#afad7d');}
      }else if(boss){
        const lifted=wind?5:0;
        // The Bell Warden: a cracked bronze bell, root limbs and a hollow lit face.
        L([-9,-11],[-16-walk*2,2],'#415953',6);L([9,-11],[17+walk*2,0],'#415953',6);
        L([-17,-2],[-23,2],'#697a60',3);L([16,-3],[24,2],'#697a60',3);
        drawP([[-19,-10],[-16,-27+bob],[-10,-43+bob],[-7,-47+bob],[7,-47+bob],[12,-39+bob],[17,-23+bob],[24,-10],[24,-4],[-24,-4]],'#33494b');
        drawP([[-17,-12],[-14,-28+bob],[-9,-41+bob],[-5,-44+bob],[4,-44+bob],[10,-36+bob],[14,-21+bob],[22,-10],[20,-7],[-21,-7]],'#7f8060');
        drawP([[-13,-27+bob],[-8,-40+bob],[-3,-42+bob],[-5,-16],[-13,-11]],'#c2ac73');
        drawP([[5,-41+bob],[11,-34+bob],[15,-21+bob],[22,-10],[13,-11],[8,-22]],'#596a59');
        for(const yy of [-32,-28,-13])L([-13,yy+bob],[13,yy+bob],'#baa476',2);
        El(0,-7,22,4,'#b5a271');El(0,-4,23,4,'#243f41');
        drawP([[-6,-33+bob],[5,-34+bob],[8,-27+bob],[4,-17+bob],[-2,-19+bob],[-7,-25+bob]],'#152d3b');
        El(-1,-26+bob,4.2,3.5,wind?'#ffbb7a':'#a7d8bb');D(-1,-27+bob,2,wind?'#ffeed0':'#e1f4c8');
        // The broken crown describes the silhouette, including at phone scale.
        L([-6,-45+bob],[-10,-54+bob],'#566e61',3);L([-10,-54+bob],[-18,-59+bob],'#879879',2);
        L([5,-45+bob],[8,-56+bob],'#74826a',3);L([8,-55+bob],[17,-60+bob],'#a0a582',2);
        L([8,-52+bob],[18,-51+bob],'#647962',2);
        L([-2,-43+bob],[-3,-52+bob],'#c4b37f',3);D(-3,-54+bob,3,'#687d68');
        for(const side of [-1,1]){
          L([side*15,-29+bob],[side*26,-19-lifted+bob],'#475f57',5);
          L([side*26,-19-lifted+bob],[side*30,-8-lifted*2+bob],'#79856a',4);
          for(let j=0;j<3;j++)L([side*30,-8-lifted*2+bob],[side*(31+j*3),-3-lifted*2+j*2+bob],'#a2a381',2);
        }
        // Cracks and verdigris are large, intentional shapes, not random noise.
        L([4,-39+bob],[1,-34+bob],'#364f4b');L([1,-34+bob],[5,-30+bob],'#364f4b');
        L([8,-23+bob],[4,-16+bob],'#344f4b');L([4,-16+bob],[8,-11],'#344f4b');
        El(-13,-18,3,2,'#699e81');El(14,-12,4,2,'#5e9479');
      }else{
        const lean=wind?3:0;
        L([-3,-7],[-5-walk*2,1],'#3e544b',3);L([4,-8],[5+walk*2,-1],'#536453',3);
        drawP([[-7,-7],[-8,-16+bob],[-5,-24+bob],[5,-25+bob],[9,-18+bob],[7,-5]],'#546854');
        drawP([[-6,-17+bob],[-3,-23+bob],[1,-21+bob],[0,-9],[-4,-7]],'#7d8b61');
        L([-6,-21+bob],[-12,-11-lean+bob],'#4f6754',3);L([7,-21+bob],[12,-12-lean+bob],'#6b7c5b',3);
        L([-12,-11-lean+bob],[-14,-7-lean+bob],'#a4a37a',2);L([12,-12-lean+bob],[15,-9-lean+bob],'#a4a37a',2);
        drawP([[-6,-24+bob],[-5,-31+bob],[1,-34+bob],[6,-30+bob],[6,-23+bob],[0,-20+bob]],'#283e3e');
        drawP([[-4,-29+bob],[0,-32+bob],[4,-28+bob],[2,-22+bob],[-3,-24+bob]],'#94977a');
        L([-2,-27+bob],[2,-27+bob],wind?'#ffd294':'#bae7bb',1.5);
        L([-4,-30+bob],[-7,-36+bob],'#5f7960',2);L([4,-30+bob],[7,-35+bob],'#5f7960',2);
        P.dot(g,ox-7*S,oy+(-36+bob)*S,'#8cb17a');
      }
    },{outline:true,outlineColor:'#0c2530',rim:false,flash:false,alpha:e.state==='spawn'?.3+clamp(1-(e.timer||0)/.65,0,1)*.7:1});
    if(boss&&e.state==='recover')r.queue(e.x,e.y,57,g=>{
      const a=this.time*3,S=r.view.scale;
      for(let j=0;j<3;j++){
        const q=r.w(e.x+Math.cos(a+j*TAU/3)*11,e.y+Math.sin(a+j*TAU/3)*5,56);
        diamond(g,q[0],q[1],2*S,'#e8e3a2');
      }
    },{emissive:true});
    if(!boss&&e.hp<e.maxHp&&e.hp>0){
      r.overlay(g=>{
        const p=r.w(e.x,e.y,(type==='brute'?39:type==='wisp'?26:36)+(e.z||0));
        P.rect(g,p[0]-10,p[1],20,3,'#172d34');P.rect(g,p[0]-9,p[1]+1,18*e.hp/e.maxHp,1,'#d6b986');
      });
    }
  }

  projectile(r,p){
    if(p.type==='ring'){
      r.decal(g=>{
        const rad=p.radius||0;
        r.groundRing(p.x,p.y,rad,'#f3c792',.92);r.groundRing(p.x,p.y,Math.max(0,rad-3),'#d98972',.8);
        r.groundRing(p.x,p.y,rad+2,'#8e696c',.45);
        for(let j=0;j<20;j++){
          const a=j/20*TAU,q=r.w(p.x+Math.cos(a)*rad,p.y+Math.sin(a)*rad,.5);diamond(g,q[0],q[1],1.5*r.view.scale,'#ffe0a3');
        }
      });return;
    }
    if(!r.visible(p.x,p.y,p.z||5,15,15,20))return;
    const S=r.view.scale,t=this.time,good=p.type==='magic'||p.type==='lantern'||p.type==='pulse'||p.friendly;
    r.queue(p.x,p.y,p.z||5,g=>{
      const q=r.w(p.x,p.y,p.z||5),c=good?'#b1ebc8':'#e9ac88';
      r.glowDisc(g,q[0],q[1],8*S,c,.2);
      P.disc(g,q[0],q[1],2.5*S,good?'#61bca8':'#bd6e77');P.disc(g,q[0],q[1],1.3*S,c);P.dot(g,q[0],q[1],'#fff8d8');
      if(p.vx||p.vy){const a=r.w(p.x-(p.vx||0)*.025,p.y-(p.vy||0)*.025,p.z||5);line(g,q,a,good?'#8bc1b0':'#9e7985');}
    },{emissive:true});
  }

  seed(r,s){
    const x=s.x,y=s.y,S=r.view.scale,t=this.time;
    if(!r.visible(x,y,0,15,10,30))return;
    r.shadow(x,y,4,.15);
    r.queue(x,y,5,g=>{
      const q=r.w(x,y,6+Math.sin(t*2+x)*1.5);r.glowDisc(g,q[0],q[1],11*S,'#cce49a',.12);
      diamond(g,q[0],q[1],4*S,'#d3bf7e');diamond(g,q[0]-S,q[1]-S,2.5*S,'#fff2b5');
      line(g,[q[0],q[1]-4*S],[q[0]+2*S,q[1]-7*S],'#89c78f');P.ell(g,q[0]+3*S,q[1]-7*S,2*S,S,'#abd99c');
    },{emissive:true});
  }

  pickup(r,p){
    if(!r.visible(p.x,p.y,0,12,10,20))return;
    const S=r.view.scale,health=p.type==='health';
    r.queue(p.x,p.y,3,g=>{
      const q=r.w(p.x,p.y,4+Math.sin(this.time*3+(p.age||0))*1.2),c=health?'#e7ad92':'#c8e3a0';
      r.glowDisc(g,q[0],q[1],6*S,c,.1);
      if(health){
        P.rect(g,q[0]-3*S,q[1]-S,6*S,2*S,'#9ab67b');P.rect(g,q[0]-S,q[1]-3*S,2*S,6*S,'#d0e4a5');P.dot(g,q[0],q[1],'#fff6d1');
      }else {diamond(g,q[0],q[1],2.5*S,'#8dc5a5');diamond(g,q[0],q[1]-S,1.5*S,'#e5efd0');}
    },{emissive:true});
  }

  effect(r,w,fx){
    const age=fx.age||0,life=fx.life||.8,u=clamp(age/life,0,1),S=r.view.scale;
    const aliases={seal:'restore',burst:'death',slam:'shockwave',spawn:'ring',stun:'guard'};
    const type=aliases[fx.type]||fx.type||'spark',color=fx.color||(type==='heal'?'#b3e6ad':type==='hurt'?'#f1b78f':'#cfe8a9');
    if(type==='text'||fx.text){
      r.textAt(fx.x,fx.y,25+age*14,fx.text||'',color,{alpha:1-u});return;
    }
    if(['ring','pulse','magic','restore','restoration','heal','shockwave','bossring'].includes(type)){
      r.decal(g=>{
        const rad=(fx.radius|| (type==='restore'||type==='restoration'?62:35))*E.ease.outCubic(u);
        r.groundRing(fx.x,fx.y,rad,color,(1-u)*.8);
        r.groundRing(fx.x,fx.y,rad*.92,color,(1-u)*.45);
        if(u<.25)r.groundDisc(fx.x,fx.y,rad,color,(.25-u)*.28);
      });
      if(type==='restore'||type==='restoration'){
        r.queue(fx.x,fx.y,2,g=>{
          for(let j=0;j<20;j++){
            const a=j/20*TAU+.6*u,rad=8+u*35,q=r.w(fx.x+Math.cos(a)*rad,fx.y+Math.sin(a)*rad,u*42+Math.sin(a*3)*7);
            P.blend(g,1-u,'add',()=>diamond(g,q[0],q[1],(1.5+hash(j,9)*1.3)*S,color));
          }
        },{emissive:true});
      }return;
    }
    if(type==='telegraph'||type==='warning'){
      r.decal(g=>{r.groundDisc(fx.x,fx.y,fx.radius||30,'#d48672',.07+u*.12);r.groundRing(fx.x,fx.y,fx.radius||30,'#e1a17e',.5);});return;
    }
    r.queue(fx.x,fx.y,fx.z||7,g=>{
      const q=r.w(fx.x,fx.y,(fx.z||7)+age*5);
      if(type==='hit'||type==='impact'){
        const rr=(1-u)*8*S;
        for(let j=0;j<4;j++){const a=j/4*TAU+.5;line(g,[q[0]+Math.cos(a)*rr*.3,q[1]+Math.sin(a)*rr*.3],[q[0]+Math.cos(a)*rr,q[1]+Math.sin(a)*rr],color,Math.max(1,(1-u)*2*S));}
        P.disc(g,q[0],q[1],(1-u)*2.5*S,'#fff8d1');
      }else if(type==='death'||type==='dissolve'){
        for(let j=0;j<9;j++){
          const a=j/9*TAU,rr=u*17,q2=r.w(fx.x+Math.cos(a)*rr,fx.y+Math.sin(a)*rr,7+u*17);
          P.blend(g,1-u,'normal',()=>P.rect(g,q2[0],q2[1],2*S,2*S,color));
        }
      }else{
        P.blend(g,1-u,'add',()=>{P.dot(g,q[0],q[1],color);if(u<.4){P.rect(g,q[0]-2,q[1],5,1,color);P.rect(g,q[0],q[1]-2,1,5,color);}});
      }
    },{emissive:true});
  }

  ambient(r,w){
    const t=this.time;
    for(let i=0;i<this.fireflies.length;i++){
      const f=this.fireflies[i],x=f.x+Math.sin(t*f.speed*.25+f.phase)*9,y=f.y+Math.cos(t*.15+f.phase)*7,z=f.z+Math.sin(t*f.speed+f.phase)*3;
      if(!r.visible(x,y,z,5,5,5))continue;
      const a=.25+.75*Math.pow(.5+.5*Math.sin(t*1.4+f.phase),2);
      if(a<.32)continue;
      r.queue(x,y,z,g=>{
        const q=r.w(x,y,z);P.blend(g,a,'add',()=>P.dot(g,q[0],q[1],i%4?'#a1ce9b':'#e7d38e'));
        if(a>.9)r.glowDisc(g,q[0],q[1],3*r.view.scale,'#92c295',.1);
      },{emissive:true});
    }
  }

  foreground(r,w){
    // An unobtrusive pixel vignette frames the world without hiding corners or UI.
    r.overlay(g=>{
      const ww=r.bw,hh=r.bh;
      P.blend(g,.09,'normal',()=>{P.rect(g,0,0,ww,4,'#07212b');P.rect(g,0,hh-5,ww,5,'#07212b');P.rect(g,0,4,4,hh-9,'#07212b');P.rect(g,ww-4,4,4,hh-9,'#07212b');});
    });
  }
}

window.LanternArt=LanternArt;
})();
