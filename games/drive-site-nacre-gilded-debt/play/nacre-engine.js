/* Nacre city extensions for my-3D2dge 0.6.0. Original game code, 2026.
   Upstream my-3d2dge.js is retained with its MIT notice.
   World units: x east, y south, z up. All rendering uses the engine pixel API. */
(function(E){
  'use strict';
  const {clamp,lerp,px}=E;
  const inside=(x,y,b,pad=0)=>x>=b.x-pad&&x<=b.x+b.w+pad&&y>=b.y-pad&&y<=b.y+b.d+pad;
  class CityWorld {
    constructor(data){Object.assign(this,data);this.navRevision=0;this.cell=20;this.cols=Math.ceil(this.width/this.cell);this.rows=Math.ceil(this.height/this.cell);}
    land(x,y){if(x>=138&&x<=218&&y>=700&&y<=784)return true;if(x<88||x>952||y<60||y>714)return false;if(x>542&&x<588)return(y>239&&y<285)||(y>495&&y<537)||(y>627&&y<667);return true;}
    roofAt(x,y,z=Infinity){let out=null;for(const b of this.buildings)if(b.enabled!==false&&inside(x,y,b)&&b.h<=z+3&&(!out||b.h>out.h))out=b;for(const b of this.bridges||[])if(inside(x,y,b)&&b.h<=z+3&&(!out||b.h>out.h))out=b;return out;}
    heightAt(x,y){let h=0;for(const b of this.buildings)if(b.enabled!==false&&inside(x,y,b))h=Math.max(h,b.h);return h;}
    groundAt(x,y,r,z,step=2){let h=0;for(const b of this.buildings)if(b.enabled!==false&&inside(x,y,b)&&b.h<=z+step)h=Math.max(h,b.h);for(const b of this.bridges||[])if(inside(x,y,b)&&b.h<=z+step)h=Math.max(h,b.h);return h;}
    collide(body){let hit=false;if(body.x<92||body.x>948||body.y<64||body.y>782){body.x=clamp(body.x,92,948);body.y=clamp(body.y,64,782);hit=true;}
      for(const b of this.buildings){if(b.enabled===false||body.z>=b.h-body.step-.1||!inside(body.x,body.y,b,body.r))continue;const nx=clamp(body.x,b.x,b.x+b.w),ny=clamp(body.y,b.y,b.y+b.d),dx=body.x-nx,dy=body.y-ny,dist=Math.hypot(dx,dy);if(dist>=body.r)continue;if(dist>.001){body.x+=dx/dist*(body.r-dist);body.y+=dy/dist*(body.r-dist);}else{const a=[body.x-b.x,b.x+b.w-body.x,body.y-b.y,b.y+b.d-body.y],i=a.indexOf(Math.min(...a));if(i===0)body.x=b.x-body.r;else if(i===1)body.x=b.x+b.w+body.r;else if(i===2)body.y=b.y-body.r;else body.y=b.y+b.d+body.r;}hit=true;}
      if(body.z<2&&!this.land(body.x,body.y)&&body._safeX!==undefined){body.x=body._safeX;body.y=body._safeY;hit=true;}return hit;}
    blocksSight(x,y,z){for(const b of this.buildings)if(b.enabled!==false&&inside(x,y,b)&&z<b.h-.5&&z>=0)return true;for(const b of this.bridges||[])if(inside(x,y,b)&&Math.abs(z-b.h)<2)return true;return false;}
    sight(a,b,eyeA=24,eyeB=18){const az=(a.z||0)+eyeA,bz=(b.z||0)+eyeB,n=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));for(let i=1;i<n;i++){const t=i/n;if(this.blocksSight(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(az,bz,t)))return false;}return true;}
    nearClimb(body,facing){let best=null;for(const b of this.buildings){if(b.enabled===false||!b.climb||b.h<body.z+9||b.h>body.z+128)continue;const x=clamp(body.x,b.x+8,b.x+b.w-8),y=clamp(body.y,b.y+8,b.y+b.d-8),d=Math.hypot(x-body.x,y-body.y);if(d>25)continue;const angle=Math.atan2(y-body.y,x-body.x);if(Math.abs(E.angDiff(facing,angle))>1.75)continue;if(!best||d<best.dist)best={building:b,x,y,z:b.h,dist:d,angle};}return best;}
    _liftOrder(view,x,y,z,k){const b=this.roofAt(x,y,z);if(b&&Math.abs(z-b.h)<50){const order=Math.max(...[[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.d],[b.x+b.w,b.y+b.d]].map(p=>view.order(...p,0)));return Math.max(k,order+.1+(z-b.h)*.001);}return k;}
    actorBias(view,body){let k=view.order(body.x,body.y,body.z),out=k;for(const b of this.buildings){if(b.enabled===false)continue;const frontX=view.fx>=0?b.x+b.w:b.x,frontY=view.fy>=0?b.y+b.d:b.y;const nearY=body.x>=b.x-3&&body.x<=b.x+b.w+3&&Math.abs(body.y-frontY)<40&&(body.y-frontY)*view.fy>0;const nearX=body.y>=b.y-3&&body.y<=b.y+b.d+3&&Math.abs(body.x-frontX)<40&&(body.x-frontX)*view.fx>0;if(nearX||nearY)out=Math.max(out,view.order(frontX,frontY,0)+.2);}return out-k;}
    walkable(cx,cy){const x=cx*this.cell+this.cell/2,y=cy*this.cell+this.cell/2;if(cx<0||cy<0||cx>=this.cols||cy>=this.rows||!this.land(x,y))return false;return !this.buildings.some(b=>b.enabled!==false&&inside(x,y,b,5));}
    nearestCell(x,y){const cx=Math.floor(x/this.cell),cy=Math.floor(y/this.cell);if(this.walkable(cx,cy))return[cx,cy];for(let r=1;r<6;r++)for(let yy=cy-r;yy<=cy+r;yy++)for(let xx=cx-r;xx<=cx+r;xx++)if(this.walkable(xx,yy))return[xx,yy];return null;}
    path(a,b){const s=this.nearestCell(a.x,a.y),end=this.nearestCell(b.x,b.y);if(!s||!end)return[];const key=(x,y)=>y*this.cols+x,start=key(...s),goal=key(...end),open=[start],came=new Map(),scores=new Map([[start,0]]),done=new Set();let loops=0;
      while(open.length&&loops++<2000){let bi=0,bf=Infinity;for(let i=0;i<open.length;i++){const n=open[i],f=scores.get(n)+Math.abs(n%this.cols-end[0])+Math.abs(Math.floor(n/this.cols)-end[1]);if(f<bf){bi=i;bf=f;}}const n=open.splice(bi,1)[0];if(n===goal){const out=[];let c=n;while(c!==start){out.push({x:(c%this.cols+.5)*this.cell,y:(Math.floor(c/this.cols)+.5)*this.cell});c=came.get(c);}return out.reverse();}done.add(n);const x=n%this.cols,y=Math.floor(n/this.cols);for(const[dX,dY]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dX,yy=y+dY,k=key(xx,yy);if(!this.walkable(xx,yy)||done.has(k))continue;const score=scores.get(n)+1;if(score<(scores.get(k)??Infinity)){came.set(k,n);scores.set(k,score);if(!open.includes(k))open.push(k);}}}return[];}
  }
  class Parkour {
    constructor(body,world){this.body=body;this.world=world;this.state=null;}
    climb(to){if(this.state)return false;const b=this.body;this.state={type:'climb',t:0,dur:Math.max(.55,(to.z-b.z)/95+.35),from:{x:b.x,y:b.y,z:b.z},to:{x:to.x,y:to.y,z:to.z}};b.vx=b.vy=b.vz=0;b.onGround=false;return true;}
    leap(to,type='leap',duration=.8){if(this.state)return false;const b=this.body;this.state={type,t:0,dur:duration,from:{x:b.x,y:b.y,z:b.z},to:{...to}};b.onGround=false;return true;}
    update(dt){const s=this.state;if(!s)return false;const b=this.body;s.t+=dt;const u=clamp(s.t/s.dur,0,1),lastZ=b.z;if(s.type==='climb'){const xy=E.ease.inOut(clamp((u-.42)/.58,0,1));b.x=lerp(s.from.x,s.to.x,xy);b.y=lerp(s.from.y,s.to.y,xy);b.z=lerp(s.from.z,s.to.z,E.ease.outQuad(u));}else{b.x=lerp(s.from.x,s.to.x,E.ease.inOut(u));b.y=lerp(s.from.y,s.to.y,E.ease.inOut(u));b.z=lerp(s.from.z,s.to.z,u)+Math.sin(Math.PI*u)*(s.type==='drop'?12:32);}b.vz=(b.z-lastZ)/Math.max(dt,.001);if(u>=1){Object.assign(b,s.to);b.vx=b.vy=b.vz=0;b.onGround=true;b.groundZ=b.z;this.state=null;}return true;}
    cancel(){this.state=null;}
  }
  class NacreRig extends E.Humanoid {
    constructor(o={}){super(o);this.isCourier=!!o.courier;}
    update(dt,s={}){this.nacreState=s;super.update(dt,s);const J=this.J,o=this.o;if(s.mantle){const t=s.mantle;for(const side of ['L','R']){const shoulder=J['sh'+side],goal=[8,side==='L'?-3:3,15];const[elbow,hand]=E.ik3(shoulder,goal,o.armUpper,o.armLower,[0,side==='L'?-1:1,-1]);J['elbow'+side]=E.V3.lerp(J['elbow'+side],elbow,t);J['hand'+side]=E.V3.lerp(J['hand'+side],hand,t);}}if(s.vault){J.handL[0]-=3*s.vault;J.handR[0]-=3*s.vault;J.kneeR[2]+=2*s.vault;}}
    draw(g,ox,oy,v){if(E.NacreCharacters)E.NacreCharacters.draw(this,g,ox,oy,v);else super.draw(g,ox,oy,v);}
    _queueCharacterParts(context){if(E.NacreCharacters)E.NacreCharacters.queue(this,context);}
  }
  E.CityWorld=CityWorld;E.Parkour=Parkour;E.NacreRig=NacreRig;E.cityExtensionVersion='1.1.0';
})(window.My3D2dge);
