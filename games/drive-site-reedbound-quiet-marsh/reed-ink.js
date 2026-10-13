/*!
 * Reed & Ink — original painterly extensions for my-3D2dge v0.7.
 * Copyright 2026. MIT License.
 *
 * Load after my-3d2dge.js. These helpers retain the engine world coordinates:
 * x east, y south, z up. The engine owns time, the camera, projection, and depth.
 * Canvas curves intentionally add an ink-paint mode to the pixel-art engine.
 * Leave optional WebGPU lighting off: these surfaces use ordinary Canvas color.
 *
 *   const heroArt = new E.MartenRig();
 *   heroArt.update(dt, { x, y, z, vx, vy, facing, air, attack, hurt });
 *   heroArt.draw(renderer);
 *
 * `facing` is radians. `attack` can be true, a 0..1 phase, or E.Attack.state.
 * An `air` value lifts/tucks the legs; world z still sets the actor's height.
 * Optional state: dash, run (0..1), pose ('cheer'), dead (0..1), alpha.
 *   const crabArt = new E.MarshEnemy({ type: 'crab', seed: 2 });
 *   const guardianArt = new E.MarshEnemy({ type: 'guardian' });
 * Enemy update/draw follows the same contract. `exposed` opens a gold core.
 *
 * Custom scenery:
 *   renderer.queue(x, y, 0, g => {
 *     const p = new E.InkPainter(renderer, g);
 *     p.surface([[x,y,0], [x+8,y,5], [x+12,y,0]], '#526c68');
 *   });
 * Every helper restores the Canvas state and invalidates the engine color cache.
 */
(function (root) {
  'use strict';
  const E = root.My3D2dge;
  if (!E) throw new Error('Load my-3d2dge.js before reed-ink.js.');
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (v, target, rate, dt) => lerp(v, target, 1 - Math.exp(-rate * dt));
  const palette = Object.freeze({ ink:'#152f35', deep:'#203e43', teal:'#476a68', shadow:'#81a19a', cream:'#fff4d1', white:'#fffbe8', gold:'#dba641', paleGold:'#f8d475', coral:'#cb6958' });

  function finish(g) { g.restore(); g._c = null; }
  function smoothPath(g, pts, close) {
    if (!pts.length) return;
    g.beginPath();
    if (pts.length < 3) {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i=1;i<pts.length;i++) g.lineTo(pts[i][0],pts[i][1]);
    } else if (close) {
      const p=pts[pts.length-1], q=pts[0];
      g.moveTo((p[0]+q[0])/2,(p[1]+q[1])/2);
      for (let i=0;i<pts.length;i++) {
        const a=pts[i], b=pts[(i+1)%pts.length];
        g.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
      }
    } else {
      g.moveTo(pts[0][0],pts[0][1]);
      for (let i=1;i<pts.length-1;i++) {
        const a=pts[i], b=pts[i+1];
        g.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
      }
      const p=pts[pts.length-1]; g.lineTo(p[0],p[1]);
    }
    if (close) g.closePath();
  }
  function screenSurface(g, pts, fill, stroke, width, soft=true) {
    if (pts.length<2) return;
    g.save(); g.lineJoin='round'; g.lineCap='round';
    if (soft) smoothPath(g,pts,true);
    else { g.beginPath(); g.moveTo(...pts[0]); for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]); g.closePath(); }
    if(fill){g.fillStyle=fill;g.fill();}
    if(stroke&&width>0){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
    finish(g);
  }
  function screenLine(g,pts,color,width) {
    if(pts.length<2)return;
    g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle=color;g.lineWidth=width;
    smoothPath(g,pts,false);g.stroke();finish(g);
  }
  // A ribbon uses world joint centers and world widths. Its silhouette is a
  // projected variable-width brush stroke, rather than a chain of round discs.
  function ribbon(g,pts,widths,fill,stroke,outline=1.5) {
    if(pts.length<2)return;
    const left=[],right=[];
    for(let i=0;i<pts.length;i++) {
      const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,w=widths[i];
      left.push([pts[i][0]-dy/d*w,pts[i][1]+dx/d*w]);
      right.push([pts[i][0]+dy/d*w,pts[i][1]-dx/d*w]);
    }
    screenSurface(g,left.concat(right.reverse()),fill,stroke,outline,true);
  }

  class InkPainter {
    constructor(renderer, context) { this.r=renderer; this.g=context||renderer.ctx; this.scale=renderer.view.scale; }
    p(x,y,z=0) { return Array.isArray(x)?this.r.w(x[0],x[1],x[2]||0):this.r.w(x,y,z); }
    surface(points,fill,o={}) { screenSurface(this.g,points.map(p=>this.p(p)),fill,o.stroke===false?null:o.stroke||palette.ink,o.width===undefined?1.3:o.width,o.smooth!==false); }
    line(points,color=palette.ink,width=1.4) { screenLine(this.g,points.map(p=>this.p(p)),color,width); }
    ribbon(points,widths,fill=palette.teal,o={}) { ribbon(this.g,points.map(p=>this.p(p)),widths.map(w=>w*this.scale),fill,o.stroke===false?null:o.stroke||palette.ink,o.width===undefined?1.4:o.width); }
    groundRing(x,y,z,radius,color=palette.gold,width=2,alpha=1) {
      const points=[];for(let i=0;i<=48;i++){const a=i/48*TAU;points.push([x+Math.cos(a)*radius,y+Math.sin(a)*radius,z]);}
      const g=this.g;g.save();g.globalAlpha*=alpha;this.line(points,color,width);finish(g);
    }
    // Orthographic ellipsoid, with the long axis at yaw in the world ground plane.
    ellipsoid(center,radii,fill,o={}) { ellipsoid(this.r,this.g,center,radii,o.yaw||0,fill,o.stroke===false?null:o.stroke||palette.ink,o.width===undefined?1.4:o.width,o.shade); }
  }

  function ellipseData(r,center,radii,yaw) {
    const [cx,cy]=r.w(...center),c=Math.cos(yaw),s=Math.sin(yaw),v=r.view;
    const axes=[[radii[0]*c,radii[0]*s,0],[-radii[1]*s,radii[1]*c,0],[0,0,radii[2]]];
    let A=0,B=0,C=0;
    for(const a of axes){const [x,y]=v.p(...a);A+=x*x;B+=x*y;C+=y*y;}
    const d=Math.sqrt(Math.max(0,(A-C)*(A-C)+4*B*B));
    return {cx,cy,rx:Math.sqrt(Math.max(.03,(A+C+d)/2)),ry:Math.sqrt(Math.max(.03,(A+C-d)/2)),angle:.5*Math.atan2(2*B,A-C)};
  }
  function ellipsePath(g,e){g.beginPath();g.ellipse(e.cx,e.cy,e.rx,e.ry,e.angle,0,TAU);}
  function ellipsoid(r,g,center,radii,yaw,fill,stroke,width,shadow) {
    const e=ellipseData(r,center,radii,yaw);g.save();ellipsePath(g,e);g.fillStyle=fill;g.fill();
    if(shadow){
      g.save();g.clip();
      const offset=r.view.p(0,0,-radii[2]*.63);
      g.translate(offset[0],offset[1]);ellipsePath(g,e);g.fillStyle=shadow;g.fill();g.restore();
    }
    if(stroke){ellipsePath(g,e);g.strokeStyle=stroke;g.lineWidth=width;g.lineJoin='round';g.stroke();}
    finish(g);return e;
  }
  function attackPhase(a) {
    if(!a)return 0;
    if(typeof a==='number')return clamp(a,0,1);
    if(a===true)return .48;
    if(a.phase==='wind')return .12+clamp(a.u||0,0,1)*.18;
    if(a.phase==='active')return .3+clamp(a.u||0,0,1)*.4;
    if(a.phase==='recover')return .7+clamp(a.u||0,0,1)*.3;
    return 0;
  }

  class MartenRig {
    constructor(o={}) {
      this.o=o;this.size=o.size||1;this.C=Object.assign({},palette,o.colors||{});
      this.x=0;this.y=0;this.z=0;this.vx=0;this.vy=0;this.facing=0;
      this.t=0;this.cycle=0;this.runW=0;this.airW=0;this.dashW=0;this.state={};
    }
    update(dt,s={}) {
      this.t+=dt;this.state=s;
      this.x=s.x||0;this.y=s.y||0;this.z=s.z||0;this.vx=s.vx||0;this.vy=s.vy||0;
      if(Number.isFinite(s.facing))this.facing=s.facing;
      const speed=Math.hypot(this.vx,this.vy),run=s.run===undefined?clamp(speed/80,0,1.2):clamp(s.run,0,1.2);
      this.runW=smooth(this.runW,run,11,dt);this.airW=smooth(this.airW,s.air?1:0,15,dt);this.dashW=smooth(this.dashW,s.dash?1:0,15,dt);
      this.cycle+=dt*(speed*.26+2.2*this.runW);
      return this;
    }
    draw(r,o={}) {
      const pad=100*this.size*r.view.scale;
      if(!r.visible(this.x,this.y,this.z,pad,pad,pad))return;
      const self=this;
      r.queue(this.x,this.y,this.z,g=>self._draw(r,g,o),{solid:true,bias:o.bias||0});
    }
    _draw(r,g,o) {
      const C=this.C,sz=this.size,s=this.state,run=this.runW,air=this.airW,dash=this.dashW;
      const a=this.facing,c=Math.cos(a),sn=Math.sin(a),ap=attackPhase(s.attack),swing=ap?Math.sin(ap*Math.PI):0;
      const cheer=s.pose==='cheer'?Math.sin(this.t*4)*.8:0;
      const bob=Math.sin(this.cycle*2)*.55*run+Math.sin(this.t*2.6)*.16*(1-run)+cheer;
      const lean=swing*1.8,dip=dash*.8;
      const W=(f,l,z)=>[this.x+(f*c-l*sn)*sz,this.y+(f*sn+l*c)*sz,this.z+(z+bob)*sz];
      const P=(f,l,z)=>r.w(...W(f,l,z));
      const parts=[];
      const add=(at,draw)=>parts.push({d:r.view.depth(...W(...at)),draw});
      const ball=(pos,rad,fill,shadow,outline=1.2)=>ellipsoid(r,g,W(...pos),rad.map(n=>n*sz),a,fill,C.ink,outline,shadow);
      const path=(pts,fill,outline=C.ink,width=1.4)=>screenSurface(g,pts.map(p=>P(...p)),fill,outline,width,true);
      const line=(pts,col,width)=>screenLine(g,pts.map(p=>P(...p)),col,width);
      g.save();g.globalAlpha*=s.alpha===undefined?1:s.alpha;
      // The tail is a long brush. Its broad base and split tip form the silhouette.
      const tailSide=Math.sin(this.t*2.4)*2.5*(1-run)+Math.sin(this.cycle-.7)*2*run+swing*10;
      const tail=[[-7,0,7-dip],[-11,-tailSide*.15,8-dip],[-17,-tailSide*.5,10-dash*4],[-23,-tailSide*.85,13-dash*6],[-27,-tailSide,15-dash*8],[-30,-tailSide*.8,16-dash*9]];
      add([-17,-tailSide*.5,10],()=>{
        ribbon(g,tail.map(p=>P(...p)),[2.7,3.3,3.5,2.9,1.65,.12].map(n=>n*sz*r.view.scale),C.deep,C.ink,1.7);
        const highlight=tail.map((p,i)=>[p[0],p[1]-.15,p[2]+(i<4?1.2:.5)]);
        ribbon(g,highlight.map(p=>P(...p)),[1.2,1.7,1.7,1.1,.45,0].map(n=>n*sz*r.view.scale),C.teal,null,0);
        line([[-24,-tailSide,13.6-dash*7],[-28,-tailSide+1.1,16-dash*8],[-30.8,-tailSide+1,16.5-dash*9]],C.ink,1.0);
      });
      // Four articulated legs. The pairs use a diagonal gait, with bent knees.
      for(const side of [-1,1])for(const fore of [-1,1]) {
        const ph=this.cycle+(side===fore?0:Math.PI),stride=Math.sin(ph)*3.0*run;
        const lift=Math.max(0,Math.cos(ph))*2.6*run;
        const hx=fore>0?5.4:-5.6,hy=side*2.45,hz=7.0-dip;
        const toe=[hx+stride+(fore>0?air*2.5:-air*2.5)+lean,side*2.85,.7+lift+air*3.6];
        const knee=[hx-stride*.3+(fore>0?1.0:-1.0)+air*(fore>0?1:-1),side*2.7,3.9+air*2.5];
        add([hx,hy,3.7],()=>{
          const pts=[[hx,hy,hz],knee,toe];
          ribbon(g,pts.map(p=>P(...p)),[1.65,1.22,.9].map(n=>n*sz*r.view.scale),side<0?C.shadow:C.cream,C.ink,1.25);
          ball([toe[0]+.8,toe[1],toe[2]],[2.0,1.18,.9],C.deep,C.teal,1.0);
        });
      }
      add([-.7,0,8],()=>{
        ball([-.7+lean*.3,0,8-dip],[8.8+dash*1.3,3.8,4.0-dash*.45],C.cream,C.shadow,1.7);
        line([[-6,-1.6,10.7],[-1,-2,11.6],[4,-1.6,11.1]],C.white,1.1);
        // Three short fur notches keep the haunch from reading as a smooth toy.
        line([[-7.4,1.4,8.2],[-8.5,2,8.7],[-7.8,2.2,7.1]],C.teal,1.0);
      });
      // Collar is a small woven saffron band. It belongs to the new character.
      add([7,0,9],()=>{
        ball([6.7+lean,0,9.4-dip],[2.4,3.0,3.35],C.gold,C.coral,1.4);
        path([[6.5,2.5,8.9],[6.3,4.0,5.4],[8.5,4.3,5.9],[7.8,2.5,8.9]],C.gold,C.ink,1.0);
        ball([7.8,3.0,7],[.8,.55,.8],C.paleGold,null,.6);
      });
      // Rounded marten ears, not pointed canine ears.
      for(const side of [-1,1])add([10,side*2.8,14.1],()=>{
        ball([10.3+lean,side*2.75,14.1-dip],[2.0,1.35,2.2],C.deep,C.teal,1.4);
        ball([10.55+lean,side*2.87,14.55-dip],[1.05,.7,1.2],C.gold,null,.7);
      });
      add([11.3,0,11.2],()=>{
        ball([11.2+lean,0,11.0-dip],[5.0,3.1,3.65],C.cream,C.shadow,1.6);
        // Dark natural cheek fur frames small, bright eyes.
        for(const side of [-1,1]) {
          path([[10.0+lean,side*2.55,12.6-dip],[12.8+lean,side*2.8,12.1-dip],[13.8+lean,side*2.3,10.3-dip],[11.0+lean,side*2.8,9.8-dip]],C.teal,null,0);
          const eye=[12.7+lean,side*2.7,12.0-dip];
          if(Math.sin(this.t*1.17)>.997){line([[eye[0]-.5,eye[1],eye[2]],[eye[0]+.7,eye[1],eye[2]]],C.ink,1.1);}
          else {ball(eye,[.58,.39,.69],C.ink,null,.5);ball([eye[0]+.13,eye[1]-.08,eye[2]+.22],[.18,.15,.2],C.white,null,0);}
        }
        ball([14.6+lean,0,9.65-dip],[2.65,2.15,1.7],C.cream,null,1.05);
        ball([16.8+lean,0,10.2-dip],[.93,1.13,.72],C.deep,null,.75);
        line([[16+lean,0,9.5-dip],[15.5+lean,0,8.9-dip],[14.6+lean,0,9.15-dip]],C.ink,.75);
      });
      parts.sort((a,b)=>a.d-b.d);for(const p of parts)p.draw();
      if(s.hurt||o.hurt){
        g.globalAlpha*=.28;const h=P(0,0,9);g.fillStyle=C.white;g.beginPath();g.ellipse(h[0],h[1],18*sz*r.view.scale,9*sz*r.view.scale,0,0,TAU);g.fill();
      }
      finish(g);
    }
  }

  class MarshEnemy {
    constructor(o={}) {
      this.type=o.type||'crab';this.size=o.size||(this.type==='guardian'?1.15:1);this.seed=o.seed||0;
      this.x=0;this.y=0;this.z=0;this.facing=0;this.t=this.seed*.47;this.state={};this.moveW=0;this.cycle=0;
    }
    update(dt,s={}) {
      this.t+=dt;this.state=s;this.x=s.x||0;this.y=s.y||0;this.z=s.z||0;
      if(Number.isFinite(s.facing))this.facing=s.facing;
      const speed=Math.hypot(s.vx||0,s.vy||0);this.moveW=smooth(this.moveW,clamp(speed/50,0,1),10,dt);this.cycle+=dt*(speed*.3+1.5);
      return this;
    }
    draw(r,o={}) {
      const margin=(this.type==='guardian'?180:80)*r.view.scale;
      if(!r.visible(this.x,this.y,this.z,margin,margin,margin))return;
      r.queue(this.x,this.y,this.z,g=>this._draw(r,g,o),{solid:true,bias:o.bias||0});
    }
    _draw(r,g,o) {
      const s=this.state,C=palette,a=this.facing,c=Math.cos(a),sn=Math.sin(a),sz=this.size,ap=attackPhase(s.attack),strike=ap?Math.sin(ap*Math.PI):0;
      const bob=Math.sin(this.t*3)*.3;
      const W=(x,y,z)=>[this.x+(x*c-y*sn)*sz,this.y+(x*sn+y*c)*sz,this.z+(z+bob)*sz];
      const P=(x,y,z)=>r.w(...W(x,y,z));
      const parts=[],add=(at,fn)=>parts.push({d:r.view.depth(...W(...at)),fn});
      const ball=(p,rad,fill,shadow,outline=1.5)=>ellipsoid(r,g,W(...p),rad.map(n=>n*sz),a,fill,C.ink,outline,shadow);
      const surf=(pts,fill,stroke=C.ink,width=1.5,soft=true)=>screenSurface(g,pts.map(p=>P(...p)),fill,stroke,width,soft);
      const line=(pts,fill,width)=>screenLine(g,pts.map(p=>P(...p)),fill,width*sz*r.view.scale);
      g.save();g.globalAlpha*=s.alpha===undefined?1:s.alpha;
      const hurt=s.hurt||o.hurt,body=hurt?'#d9dad0':C.deep,lit=hurt?'#fff2d7':C.teal;
      if(this.type==='guardian') {
        // The guardian is a marsh heron with a branch crown, folded ink wings,
        // thin reed legs, and a seal beneath the breast that opens when exposed.
        for(const side of [-1,1])add([0,side*4,5],()=>{
          const phase=this.cycle+(side===1?Math.PI:0),step=Math.sin(phase)*3*this.moveW,lift=Math.max(0,Math.cos(phase))*2*this.moveW;
          line([[0,side*3,19],[2+step*.3,side*3.4,9],[-1+step,side*4,1+lift]],C.ink,1.8);
          line([[-1+step,side*4,1+lift],[4+step,side*4.5,.5+lift]],C.gold,1.2);
          line([[-1+step,side*4,1+lift],[2+step,side*6,.5+lift]],C.gold,.8);
        });
        add([-4,0,18],()=>{
          surf([[-5,0,23],[-17,0,18],[-20,1,7],[-10,0,12],[-7,0,8]],body,C.ink,1.8,false);
          line([[-10,0,17],[-16,0,12]],lit,1.0);
        });
        add([0,0,23],()=>{
          ball([-1.5,0,23],[9,6.2,10],body,lit,2.3);
          ball([3,0,24.4],[5,4.8,8],lit,'#7b8e81',1.5);
          const glow=s.exposed?1:Math.max(0,Math.sin(this.t*2))*.3;
          ball([5.2,0,25],[1.0,2.9+glow,3.7+glow],s.exposed?'#ffe6a1':C.gold,C.coral,1.3);
          if(s.exposed){const q=P(6,0,25);g.save();g.globalAlpha*=.15;g.fillStyle=C.paleGold;g.beginPath();g.arc(q[0],q[1],13*sz*r.view.scale,0,TAU);g.fill();finish(g);}
        });
        for(const side of [-1,1])add([-2,side*5.2,23],()=>{
          const spread=strike*10+(s.exposed?3:0),edge=side*(5.7+spread);
          surf([[3,side*3.5,28],[-3,edge,28.5],[-10,edge,20],[-15,side*(4+spread),13],[-7,side*(4+spread*.7),18],[-4,side*4,13],[2,side*4,21]],body,C.ink,2.0,false);
          for(let i=0;i<4;i++)line([[-2-i*1.6,side*(5+spread*.75),26-i*.5],[-8-i*1.7,side*(5+spread*.8),18-i]],i%2?C.teal:'#617b73',.65);
          line([[2,side*4,27],[-5,edge,25],[-11,edge,18]],C.gold,.55);
        });
        add([5,0,35],()=>{
          const bend=strike*10;
          ribbon(g,[[3,0,28],[1-bend*.15,0,36],[5+bend*.25,0,43],[10+bend,0,43-strike*9]].map(p=>P(...p)),[4.4,3.2,2.6,2.4].map(n=>n*sz*r.view.scale),lit,C.ink,1.9);
          ball([10+bend,0,43-strike*9],[4.3,3.0,3.6],C.deep,C.teal,1.7);
          surf([[12+bend,-1.6,43.5-strike*9],[26+bend,0,40.5-strike*9],[12+bend,1.6,41.2-strike*9]],C.gold,C.ink,1.6,false);
          for(const side of [-1,1]) {
            ball([12+bend,side*2.8,43.7-strike*9],[.7,.44,.73],s.exposed?C.white:C.paleGold,null,.7);
            // Crown branches sweep back; they have blunt reed-like tips.
            line([[8+bend,side*1.8,45-strike*9],[5+bend,side*4,50-strike*9],[1+bend,side*5.2,54-strike*9]],C.ink,1.35);
            line([[5+bend,side*4,50-strike*9],[7+bend,side*6.8,53-strike*9]],C.gold,.7);
            line([[4+bend,side*4.4,51-strike*9],[.5+bend,side*3.9,55-strike*9]],C.gold,.6);
          }
          surf([[7+bend,0,46-strike*9],[1+bend,0,48-strike*9],[-3+bend,0,43-strike*9],[6+bend,0,43-strike*9]],C.deep,C.ink,1.1,false);
        });
      } else {
        // Six narrow jointed legs and two open claws create a clear crab outline.
        for(const side of [-1,1])for(let i=0;i<3;i++) {
          const x=-4+i*4,ph=this.cycle+i*1.8+(side>0?Math.PI:0),step=Math.sin(ph)*1.8*this.moveW;
          add([x,side*5,3],()=>{
            line([[x,side*3,5],[x-2+step,side*(8+i*.6),4],[x+step-3,side*(10+i*.6),.8]],C.ink,1.5);
            line([[x,side*3,5],[x-2+step,side*(8+i*.6),4]],C.teal,.8);
          });
        }
        for(const side of [-1,1])add([6,side*6,6],()=>{
          const open=1.5+strike*3.5,pinchX=10+strike*4;
          line([[3,side*3,5],[5,side*7,7],[pinchX-2,side*7,8]],C.ink,2);
          ball([pinchX-1,side*7,8],[3.5,2.4,2.4],lit,body,1.4);
          surf([[pinchX,side*7,9],[pinchX+4,side*(7+open),10],[pinchX+3,side*(7+open*.35),7.8],[pinchX,side*7,7]],C.teal,C.ink,1.3,false);
          surf([[pinchX,side*7,7.3],[pinchX+4,side*(7-open),7],[pinchX+2,side*(7-open*.2),9]],C.deep,C.ink,1.3,false);
        });
        add([0,0,6],()=>{
          ball([0,0,5.8],[7.7,5.2,5.4],body,lit,1.8);
          surf([[-6,-2,8],[-4,-3.5,11],[1,-3.3,11.3],[5,-1.8,9.8],[2,-1.9,9],[-3,-2,9]],C.teal,null,0);
          surf([[-5,-2,9],[-2,0,11],[1,1,10.2],[4,0,8]],s.exposed?C.paleGold:C.gold,C.ink,.8,false);
          for(const side of [-1,1]) {
            line([[4,side*2,8],[6,side*3,11]],C.ink,1.0);
            ball([6,side*3,11],[1.2,1.0,1.2],C.paleGold,null,.8);
            ball([6.5,side*3,11.1],[.5,.5,.6],C.ink,null,.2);
          }
        });
      }
      parts.sort((a,b)=>a.d-b.d);for(const p of parts)p.fn();finish(g);
    }
  }

  E.InkPainter=InkPainter;
  E.MartenRig=MartenRig;
  E.MarshEnemy=MarshEnemy;
  E.INK_PALETTE=palette;
  E.inkEdition={name:'Reed & Ink',version:'1.0.0',baseEngine:E.version,antialias:true};
})(typeof window!=='undefined'?window:globalThis);
