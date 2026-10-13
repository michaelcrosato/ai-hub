/* Cinderwake extensions for my-3D2dge Agent Edition v0.8.1. Original engine retained. */
(() => {
  'use strict';
  const E = window.My3D2dge;
  // A hit pause must not discard a flask, dodge, or menu key pressed during impact.
  const oldStep = E.Game.prototype._step;
  E.Game.prototype._step = function(dt) {
    const stopped=this.hitstop>0;
    oldStep.call(this,dt);
    if(stopped)for(const action of this.input.now)this.input.fresh.add(action);
  };
  const oldBlock = E.TileMap.prototype.block;
  E.TileMap.prototype.block = function(x,y,on=true) {
    const before=this.blocked[y*this.w+x]; oldBlock.call(this,x,y,on);
    if(before!==this.blocked[y*this.w+x]) this.version++;
  };
  const oldFlow = E.FlowField.prototype.update;
  E.FlowField.prototype.update = function(x,y) {
    if(this._cinderVersion!==this.map.version){this.tx=-1;this.ty=-1;this._cinderVersion=this.map.version;}
    return oldFlow.call(this,x,y);
  };
  E.TileMap.prototype.los = function(x0,y0,x1,y1) {
    const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/5);
    for(let i=1;i<n;i++){const x=Math.floor((x0+(x1-x0)*i/n)/this.T),y=Math.floor((y0+(y1-y0)*i/n)/this.T);if(!this.walkable(x,y))return false;}
    return true;
  };
  const C = window.Cinder = {};
  C.VERSION=1;
  C.image = (r,asset,x,y,z,w,h,alpha=1,bias=0) => {
    const img=asset&&asset.img||asset;
    if(!img || !img.complete || !img.naturalWidth || !r.visible(x,y,z,w,h,h))return;
    r.queue(x,y,z,g=>{const p=r.w(x,y,z);g.save();g.globalAlpha=alpha;g.imageSmoothingEnabled=false;const args=[Math.round(p[0]-w/2),Math.round(p[1]-h),Math.round(w),Math.round(h)];if(asset.rect)g.drawImage(img,...asset.rect,...args);else g.drawImage(img,...args);g.restore();g._c=null;},{bias});
  };
  C.resize = game => {
    // Keep all viewports usable. Logical height is fixed; width follows the display.
    const sc=game.screen,rc=sc.canvas.getBoundingClientRect(),ratio=Math.max(.56,rc.width/Math.max(1,rc.height));
    const h=600,w=Math.max(360,Math.round(h*ratio));
    sc.o.res=[w,h];sc.resize();
    sc.S=Math.min(sc.canvas.width/w,sc.canvas.height/h);sc.OX=0;sc.OY=0;
    game.cam.snap=true;
  };
  C.path = (map,sx,sy,tx,ty) => {
    const W=map.w,H=map.h,start=sy*W+sx,goal=ty*W+tx;
    if(!map.walkable(tx,ty)||!map.walkable(sx,sy))return [];
    const prev=new Int32Array(W*H);prev.fill(-1);prev[start]=start;
    const q=[start],dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    for(let k=0;k<q.length&&prev[goal]<0;k++){
      const p=q[k],x=p%W,y=(p/W)|0;
      for(const [dx,dy]of dirs){const nx=x+dx,ny=y+dy,id=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=H||prev[id]>=0||!map.walkable(nx,ny))continue;if(dx&&dy&&(!map.walkable(x+dx,y)||!map.walkable(x,y+dy)))continue;prev[id]=p;q.push(id);}
    }
    if(prev[goal]<0)return [];
    const result=[];for(let p=goal;p!==start;p=prev[p])result.push(map.center(p%W,(p/W)|0));
    return result.reverse();
  };
  C.makeLight = () => {const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),a=g.createRadialGradient(128,128,12,128,128,128);a.addColorStop(0,'rgba(255,255,255,1)');a.addColorStop(.25,'rgba(255,255,255,.96)');a.addColorStop(.60,'rgba(255,255,255,.6)');a.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=a;g.fillRect(0,0,256,256);return c;};
  C.loadImage = src => {const i=new Image();i.src=src;return i;};
  C.formatTime = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
})();
