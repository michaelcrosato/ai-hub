/*! Skywell extensions for my-3D2dge 0.6.0. Original game systems, 2026. */
(function(E){
  'use strict';
  // A rule returns a candidate only if both its target and action can be used.
  class RuleBrain {
    constructor(rules){this.rules=rules;this.enabled=true;this.last=-1;}
    choose(actor, context, canUse){
      this.last=-1;
      if(!this.enabled) return null;
      for(let i=0;i<this.rules.length;i++){
        const rule=this.rules[i];if(!rule.on)continue;
        const target=context.target(rule.when,actor);
        if(target&&canUse(actor,rule.action,target)){this.last=i;return {action:rule.action,target,rule:i};}
      }
      return null;
    }
  }
  // A* is used for click movement. It respects water, walls, and closed gates.
  class Navigator {
    constructor(map){this.map=map;}
    path(x,y,tx,ty){
      const m=this.map,T=m.T,sx=Math.floor(x/T),sy=Math.floor(y/T);
      let gx=Math.floor(tx/T),gy=Math.floor(ty/T);
      if(!m.walkable(gx,gy)){
        let best=null,bd=Infinity;
        for(let yy=gy-3;yy<=gy+3;yy++)for(let xx=gx-3;xx<=gx+3;xx++)if(m.walkable(xx,yy)){
          const d=Math.hypot(xx+.5-tx/T,yy+.5-ty/T);if(d<bd){bd=d;best=[xx,yy];}
        }
        if(!best)return [];[gx,gy]=best;
      }
      const start=sy*m.w+sx,goal=gy*m.w+gx,open=[start],came=new Map(),g=new Map([[start,0]]),closed=new Set();
      const h=n=>Math.hypot(n%m.w-gx,Math.floor(n/m.w)-gy);
      let limit=m.w*m.h;
      while(open.length&&limit--){
        open.sort((a,b)=>(g.get(a)+h(a))-(g.get(b)+h(b)));const cur=open.shift();
        if(cur===goal){const out=[];let p=goal;while(p!==start){out.push([(p%m.w+.5)*T,(Math.floor(p/m.w)+.5)*T]);p=came.get(p);if(p===undefined)return [];}return out.reverse();}
        closed.add(cur);const cx=cur%m.w,cy=Math.floor(cur/m.w);
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
          const nx=cx+dx,ny=cy+dy,n=ny*m.w+nx;
          if(!m.walkable(nx,ny)||closed.has(n)||(dx&&dy&&(!m.walkable(cx+dx,cy)||!m.walkable(cx,cy+dy))))continue;
          const ng=g.get(cur)+(dx&&dy?1.4142:1);
          if(ng<(g.get(n)??Infinity)){came.set(n,cur);g.set(n,ng);if(!open.includes(n))open.push(n);}
        }
      }
      return [];
    }
  }
  // A ring in actual world space: warning areas are the same shapes as hit tests.
  E.Renderer.prototype.skywellRing=function(x,y,radius,color,progress=1,fill=false){
    this.decal(()=>{if(fill)this.groundDisc(x,y,radius,color,.12+.06*Math.sin(this.game.real*6));this.groundRing(x,y,radius,color,.9,1);if(progress<1)this.groundArc(x,y,radius-2,radius,0,Math.PI*2*progress,color,.8,1);});
  };
  E.Skywell={RuleBrain,Navigator,version:'1.0.0'};
})(My3D2dge);
