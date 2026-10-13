/* FrontierArt — original procedural Western art for my-3D2dge.
 * Plain script. Load after the engine, then call FrontierArt.install(My3D2dge).
 * drawHorse(r,{x,y,z=0,facing=0,speed=0,size=1,color,mounted},timeSeconds).
 * drawProp(r,{type,x,y,z=0,size=1,seed=1,color,w,h,label,facing=0},timeSeconds).
 * All positions and dimensions use engine world units. Caller performs culling.
 * Supported props: tree, cactus, boulder, wagon, tent, crate, pole, fence,
 * sign, campfire, waterTower, train. Props queue themselves and cast shadows.
 * The horse's body is about 28 units long; its saddle is about 21 units high.
 * The caller supplies a mounted rider. No gameplay state is changed here.
 * Original artwork and animation code; no external images or copied game assets.
 */
(function (root) {
  'use strict';
  let E, px;
  const TAU = Math.PI * 2;
  const P = {
    ink: '#272a27', deepest: '#222821', umber: '#51402f', wood: '#796047',
    woodLit: '#aa8256', woodDark: '#493c2e', ochre: '#c6a369', sand: '#d8bd87',
    linen: '#d1bd91', linenLight: '#e8d7aa', linenDark: '#978768',
    iron: '#4b5851', ironDark: '#2b3834', ironLight: '#879083',
    teal: '#475e55', leaf: '#646d41', leafLight: '#93915a', leafDark: '#3f5037',
    red: '#854d35', coal: '#28302d'
  };
  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function seedNumber(seed) {
    if (Number.isFinite(seed)) return seed | 0;
    const s = String(seed || 'frontier'); let h = 17;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }
  function hash(seed, n) {
    let h = (seed ^ Math.imul(n + 1, 374761393)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const mix3 = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));

  // Each shape has a real 3D depth. It remains valid when the camera turns.
  function painter(r, g, p) {
    const size = finite(p.size, 1), angle = finite(p.facing, 0);
    const c = Math.cos(angle), s = Math.sin(angle), ox = p.x, oy = p.y;
    const oz = finite(p.z, 0), ops = [], sc = r.view.scale * size;
    const world = q => [ox + (q[0] * c - q[1] * s) * size,
      oy + (q[0] * s + q[1] * c) * size, oz + q[2] * size];
    const at = q => r.w(...world(q));
    const depth = q => r.view.depth(...world(q));
    const add = (q, fn, bias) => ops.push({d: depth(q) + (bias || 0), fn});
    const poly = (points, color, bias) => {
      const mid = [0, 0, 0];
      points.forEach(q => { for (let i = 0; i < 3; i++) mid[i] += q[i] / points.length; });
      add(mid, () => px.poly(g, points.map(at), color), bias);
    };
    const line = (a, b, color, width, bias) => {
      add(mix3(a, b, .5), () => {
        const A = at(a), B = at(b);
        px.line(g, A[0], A[1], B[0], B[1], color, Math.max(1, Math.round((width || .7) * sc)));
      }, bias);
    };
    const dot = (q, color, radius, bias) => add(q, () => {
      const A = at(q); px.disc(g, A[0], A[1], Math.max(.55, (radius || .7) * sc), color);
    }, bias);
    const tube = (a, b, ra, rb, color, lit) => {
      add(mix3(a, b, .5), () => {
        const A = at(a), B = at(b), dx = B[0] - A[0], dy = B[1] - A[1];
        const d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
        const r0 = ra * sc, r1 = rb * sc;
        px.poly(g, [[A[0] + nx * r0, A[1] + ny * r0],
          [B[0] + nx * r1, B[1] + ny * r1], [B[0] - nx * r1, B[1] - ny * r1],
          [A[0] - nx * r0, A[1] - ny * r0]], color);
        px.disc(g, A[0], A[1], r0, color); px.disc(g, B[0], B[1], r1, color);
        if (lit) px.line(g, A[0] - r0 * .22, A[1] - .3 * sc,
          B[0] - r1 * .22, B[1] - .3 * sc, lit, Math.max(1, Math.round(sc * Math.min(ra, rb) * .6)));
      });
    };
    const box = (a, b, color, topColor) => {
      const [x0, y0, z0] = a, [x1, y1, z1] = b;
      const corners = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
        [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      const sides = [[0,-1,[0,1,5,4]], [1,0,[1,2,6,5]], [0,1,[2,3,7,6]], [-1,0,[3,0,4,7]]];
      sides.forEach(([nx, ny, idx]) => {
        const wx = nx*c-ny*s, wy = nx*s+ny*c;
        if (wx*r.view.fx + wy*r.view.fy <= -.01) return;
        poly(idx.map(i => corners[i]), E.shade(color, -.16 + (-wx*.6-wy*.8)*.16));
      });
      poly([4,5,6,7].map(i => corners[i]), topColor || E.shade(color, .18));
    };
    const ellipsoid = (center, radii, color, segments, rings, shapeSeed) => {
      segments = segments || 12; rings = rings || 5;
      const rows = [];
      for (let j = 0; j <= rings; j++) {
        const lat = -Math.PI / 2 + j / rings * Math.PI, row = [];
        for (let i = 0; i < segments; i++) {
          const a = i / segments * TAU, k = shapeSeed ? .94 + hash(shapeSeed, i+j*segments)*.1 : 1;
          row.push([center[0]+Math.cos(a)*Math.cos(lat)*radii[0]*k,
            center[1]+Math.sin(a)*Math.cos(lat)*radii[1]*k, center[2]+Math.sin(lat)*radii[2]*k]);
        }
        rows.push(row);
      }
      for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
        const a = (i+.5)/segments*TAU, lat = -Math.PI/2+(j+.5)/rings*Math.PI;
        const nx = Math.cos(a)*Math.cos(lat), ny = Math.sin(a)*Math.cos(lat), nz = Math.sin(lat);
        const wx = nx*c-ny*s, wy = nx*s+ny*c;
        if (wx*r.view.dx + wy*r.view.dy+nz*r.view.dz < -.12) continue;
        const light = -wx*.42 - wy*.56 + nz*.72;
        const shade = Math.round(clamp(light * .25 - .1, -.4, .26)*12)/12;
        poly([rows[j][i],rows[j][(i+1)%segments],rows[j+1][(i+1)%segments],rows[j+1][i]], E.shade(color, shade));
      }
    };
    const wheel = (f, side, z, radius, rotation, metal) => {
      const points = [], hub = [f, side, z], sides = 18;
      for (let i=0;i<sides;i++) { const a=i/sides*TAU; points.push([f+Math.cos(a)*radius,side,z+Math.sin(a)*radius]); }
      poly(points, metal ? P.ironDark : '#3d352a');
      for (let i=0;i<sides;i++) line(points[i],points[(i+1)%sides],metal ? P.ironLight : P.woodLit,1.2,.2);
      for (let i=0;i<10;i++) {
        const a=i/10*TAU+rotation;
        line(hub,[f+Math.cos(a)*radius*.83,side,z+Math.sin(a)*radius*.83],metal ? P.iron : P.wood,.9,.4);
      }
      dot(hub,metal ? '#b0a785' : P.iron,1.7,.8);
    };
    return {r,g,p,world,at,depth,add,poly,line,dot,tube,box,ellipsoid,wheel,sc,
      flush() { ops.sort((a,b)=>a.d-b.d); for (const o of ops) o.fn(); px.reset(g); }};
  }

  function groundShadow(r, p, radius, length, alpha) {
    const size=finite(p.size,1), z=finite(p.z,0);
    r.shadow(p.x,p.y,radius*size,alpha || .24,'#353c2b',z);
    if (!length) return;
    r.decal(g=> {
      const pts=[];
      for (let i=0;i<18;i++) {
        const a=i/18*TAU, ux=Math.cos(a)*radius*size, uy=Math.sin(a)*radius*.54*size;
        pts.push(r.w(p.x+ux+length*size*.36,p.y+uy+length*size*.28,z));
      }
      px.blend(g,.12,'normal',()=>px.poly(g,pts,'#323c2b'));
      px.reset(g);
    });
  }

  function install(engine) {
    if (!engine || !engine.Humanoid) throw new Error('FrontierArt needs my-3D2dge.');
    E=engine; px=E.px;
    const proto=E.Humanoid.prototype;
    if (proto._frontierHatInstalled) return root.FrontierArt;
    const original=proto._hat;
    proto._hat=function(g,Sp,J,r,H) {
      const hat=this.o.hat;
      if (!hat || !['cowboy','western','wide'].includes(hat.style)) return original.call(this,g,Sp,J,r,H);
      const color=hat.color || '#746044', headR=this.o.headR, brim=[], crown=[];
      const dk=E.shade(color,-.34), hi=E.shade(color,.24);
      // A lifted brim and pinched crown follow the same head transform as the face.
      for (let i=0;i<20;i++) {
        const a=i/20*TAU;
        brim.push(Sp(J.head,Math.cos(a)*headR*1.8,Math.sin(a)*headR*1.65,
          headR*.6+Math.pow(Math.abs(Math.sin(a)),4)*headR*.22));
        crown.push(Sp(J.head,Math.cos(a)*headR*.83,Math.sin(a)*headR*.88,headR*1.38));
      }
      px.poly(g,brim,dk); px.poly(g,brim.map(q=>[q[0],q[1]-.6]),color);
      const base=[];
      for (let i=0;i<20;i++) {const a=i/20*TAU; base.push(Sp(J.head,Math.cos(a)*headR*.97,Math.sin(a)*headR,headR*.6));}
      for (let i=0;i<20;i++) {
        const j=(i+1)%20;
        px.poly(g,[base[i],base[j],crown[j],crown[i]],i<10 ? color : dk);
      }
      px.poly(g,crown,hi);
      const creaseA=Sp(J.head,-headR*.53,0,headR*1.42), creaseB=Sp(J.head,headR*.5,0,headR*1.42);
      px.line(g,creaseA[0],creaseA[1],creaseB[0],creaseB[1],dk,1);
      const band=base.map(q=>[q[0],q[1]-Math.max(1,r*.16)]);
      for(let i=0;i<20;i++) px.line(g,band[i][0],band[i][1],band[(i+1)%20][0],band[(i+1)%20][1],hat.band || '#453b2a',1);
      px.reset(g);
    };
    Object.defineProperty(proto,'_frontierHatInstalled',{value:true,configurable:true});
    return root.FrontierArt;
  }

  function drawHorse(r, horse, time) {
    if (!E) install(root.My3D2dge);
    time=finite(time,0); const speed=Math.abs(finite(horse.speed,0));
    const gait=horse.gait, gaitRate={walk:.95,trot:1.65,canter:1.9,gallop:2.5}[gait];
    const stride=gaitRate?clamp(speed/({walk:27,trot:53,canter:89,gallop:178}[gait]),0,1):clamp(speed/95,0,1);
    const phase=time*(gaitRate?gaitRate*TAU:3+stride*8), moving=stride>.025;
    const bob=moving ? Math.sin(phase*(gait==='canter'||gait==='gallop'?1:2))*(gait==='walk'?.25:gait==='gallop'?.95:.6)*stride : Math.sin(time*1.5)*.18;
    const size=finite(horse.size,1), base=horse.color || '#925330';
    const dark=E.shade(base,-.32), light=E.shade(base,.2), mane='#362b22', hoof='#342c24';
    groundShadow(r,horse,13,28,.22);
    // Long, hoof-level shadow follows the animal's body axis.
    r.decal(g=> {
      const a=finite(horse.facing,0), c=Math.cos(a), s=Math.sin(a), points=[];
      for(let i=0;i<20;i++) {const t=i/20*TAU,f=Math.cos(t)*19*size,v=Math.sin(t)*6*size;
        points.push(r.w(horse.x+f*c-v*s,horse.y+f*s+v*c,finite(horse.z,0)));}
      px.blend(g,.16,'normal',()=>px.poly(g,points,'#302e25'));px.reset(g);
    });
    r.queue(horse.x,horse.y,finite(horse.z,0),g=>{
      const t=painter(r,g,horse);
      for (const side of [-1,1]) for(const front of [false,true]) {
        const leg=(side===1?2:0)+(front?1:0);
        const phaseShift=gait==='walk'?[0,.5,1,1.5][leg]*Math.PI:gait==='canter'?[0,2/3,2/3,4/3][leg]*Math.PI:gait==='gallop'?[0,.96,.34,1.32][leg]*Math.PI:(side===1 ? Math.PI : 0)+(front ? 0 : Math.PI);
        const u=phase+phaseShift, swing=moving ? Math.sin(u)*5*stride : 0;
        const lift=moving ? Math.max(0,Math.cos(u))*4.4*stride : 0;
        const f=front ? 8.3 : -9.7, y=side*3.5;
        const hip=[f,y,15.8+bob], foot=[f+swing+(front ? .2 : -1.2),y+side*.2,.6+lift];
        const knee=[lerp(hip[0],foot[0],.55)+(front ? -1.5 : 2.8),y,7.2+lift*.5];
        const ankle=[foot[0]-.3,y,.9+lift];
        t.tube(hip,knee,front ? 1.55 : 2,1.15,dark,base);
        t.tube(knee,ankle,1,.65,front || side===-1 ? base : dark,light);
        // White socks vary by leg, giving this horse an individual silhouette.
        if ((front&&side===1)||(!front&&side===-1)) t.tube(mix3(knee,ankle,.7),ankle,.72,.66,'#cbbfa1','#e1d0ab');
        t.box([foot[0]-.9,y-.9,lift],[foot[0]+1.5,y+.9,lift+1.1],hoof,'#514334');
      }
      const tail=[[-13,0,18+bob],[-17,Math.sin(time*2)*1.2,14],[-18.5,Math.sin(time*2.3)*2.3,7.5],[-20,Math.sin(time*2.1)*2.7,6.4]];
      for(let i=0;i<tail.length-1;i++) t.tube(tail[i],tail[i+1],1.8-i*.35,1.4-i*.4,mane,'#5d422c');
      // Rib cage, chest, haunch and shoulder muscles.
      t.ellipsoid([-1,0,15.8+bob],[13.8,5.1,5.7],base,14,6);
      t.ellipsoid([-10,0,16.4+bob],[5.4,5,5.8],base,10,5);
      t.ellipsoid([8,0,16.8+bob],[4.9,4.5,6],base,10,5);
      t.ellipsoid([11.8,0,21+bob],[4.4,3.2,7],base,10,5);
      t.tube([11,0,22+bob],[16.5,0,26.8+bob],3.1,2.6,base,light);
      t.ellipsoid([19,0,26+bob],[5.2,2.7,3.3],base,10,5);
      t.ellipsoid([23,0,23.8+bob],[3.3,2.3,2.4],dark,10,4);
      t.tube([21.7,0,26.1+bob],[25.2,0,23.8+bob],.8,.65,'#d4c4a2','#dfd0b3');
      const earTip=29.8+bob+Math.sin(time*1.8)*.25;
      for(const side of [-1,1]) {
        t.poly([[16.5,side*1.3,27.5+bob],[16.6,side*2.4,earTip+2.1],[18,side*1.7,29.1+bob]],base);
        t.line([17,side*1.7,28.9+bob],[16.9,side*2,earTip+.9],dark,.65,.2);
        t.dot([20,side*2.65,26.6+bob],P.ink,.6,.7);
        t.dot([20.1,side*2.7,26.85+bob],'#cdbf97',.18,1);
        t.dot([25,side*1.55,24+bob],'#342b23',.65,.4);
        t.line([21.3,side*2.7,26.7+bob],[24.4,side*2.3,23.2+bob],P.woodDark,.65,.6);
        t.line([17,side*2.7,27.7+bob],[19.4,side*2.8,22.6+bob],'#3d3227',.7,.8);
        t.dot([24.5,side*2.45,23.1+bob],'#b7a271',.45,1);
        const reinEnd=horse.mounted ? [1,side*2,29+bob] : [-2,side*4,19+bob];
        const mid=mix3([24.2,side*2.7,23.5+bob],reinEnd,.48);mid[2]-=horse.mounted ? 2 : 5;
        t.line([24.2,side*2.7,23.5+bob],mid,'#352f26',.45,2);
        t.line(mid,reinEnd,'#352f26',.45,2);
      }
      // Mane runs down the rear edge of the neck.
      for(let i=0;i<9;i++) {
        const u=i/8;
        t.tube([lerp(15,8,u),0,lerp(28,20,u)+bob],
          [lerp(13.2,6.5,u),.9,lerp(27,17.5,u)+bob],.85,.28,mane,'#583d2b');
      }
      // Woven saddle blanket, girth, saddle seat, pommel, and rolled bedroll.
      t.poly([[-8,-5.4,17+bob],[6,-5.2,17+bob],[6,-4.4,21+bob],[-8,-4.4,21+bob]],'#40574f');
      t.poly([[-8,5.4,17+bob],[6,5.2,17+bob],[6,4.4,21+bob],[-8,4.4,21+bob]],'#4b6a60');
      for(const side of [-1,1]) {
        t.line([-7,side*5.5,18+bob],[5,side*5.3,18+bob],'#c4a777',.8,1);
        t.line([-6,side*5.4,19.3+bob],[4,side*5.1,19.3+bob],'#937452',.6,1);
        t.tube([0,side*4.8,20+bob],[0,side*5,12.2+bob],.65,.65,'#503a28');
        t.line([1,side*4.3,21+bob],[1,side*5.2,13.3+bob],P.woodDark,.7,1);
        t.line([1,side*5.2,13.3+bob],[3.1,side*5.2,13.3+bob],P.ironLight,.65,1);
        t.line([3.1,side*5.2,13.3+bob],[3.1,side*4.9,15.3+bob],P.ironLight,.65,1);
      }
      t.ellipsoid([-1,0,21.2+bob],[5.8,3.6,1.5],'#573f2b',12,4);
      t.tube([3,-3.3,22.1+bob],[3,3.3,22.1+bob],.9,.9,'#9f7543','#bc9356');
      t.tube([3.3,0,22+bob],[3.2,0,24+bob],.65,.75,'#91633d','#bc9356');
      t.tube([-7.5,-4.1,22+bob],[-7.5,4.1,22+bob],1.75,1.75,'#8a9071','#b1b08b');
      for(const side of [-1,1]) t.line([-9,side*2.4,22.3+bob],[-6,side*2.4,22.3+bob],'#5a4b35',.65,.8);
      t.flush();
    },{hides:true,solid:true});
  }

  function cottonwood(t,p,time) {
    const seed=seedNumber(p.seed), sway=Math.sin(time*.6+seed)*.45, color=p.color||P.leaf;
    t.tube([0,0,0],[1,0,28],3.2,1.8,'#665744','#9a8460');
    t.tube([1,0,22],[-10,2,42],1.6,.65,'#6c5a42','#ac9062');
    t.tube([0,0,21],[12,-2,37],1.6,.7,'#635640','#9a845a');
    t.tube([1,0,28],[3,5,49],1.5,.6,'#796447','#ad9161');
    t.line([-1,-2,3],[.5,-1.5,26],'#493f33',.55,.1);
    for(let i=0;i<4;i++) t.tube([0,0,3],[Math.cos(i*1.6)*6,Math.sin(i*1.6)*6,0],1.4,.4,'#6d5a40');
    for(let i=0;i<18;i++) {
      const a=hash(seed,i*6)*TAU, rad=Math.sqrt(hash(seed,i*6+1))*17;
      const x=Math.cos(a)*rad+sway,y=Math.sin(a)*rad*.7,z=36+hash(seed,i*6+2)*17;
      const v=hash(seed,i*6+3), c=E.shade(color,(v-.5)*.34);
      t.ellipsoid([x,y,z],[8.5+v*6,6.5+v*5,7.5+v*3.5],c,9,4,seed+i+1);
      for(let j=0;j<3;j++) t.dot([x-3+j*2.3,y+3,z+2.6],j===1 ? '#a3a065' : '#8b8d56',.6,.8);
    }
    // Small dry twigs break up the edge of the crown.
    t.line([-11,1,38],[-23,3,39],'#706047',.5);
    t.line([8,0,43],[18,-1,49],'#7b6848',.5);
  }
  function cactus(t,p) {
    const seed=seedNumber(p.seed), height=p.h||30+hash(seed,1)*15, color=p.color||'#657454';
    t.tube([0,0,0],[0,0,height],2.7,2.25,E.shade(color,-.2),color);
    for(const side of [-1,1]) {
      const h=height*(side>0 ? .47 : .67), reach=side*(7+hash(seed,side+8)*3);
      t.tube([0,0,h],[reach,0,h],1.8,1.6,E.shade(color,-.2),color);
      t.tube([reach,0,h],[reach,0,h+8+hash(seed,side+11)*6],1.6,1.4,E.shade(color,-.2),color);
      t.line([reach-.6,-.8,h+1],[reach-.6,-.8,h+8],'#91a070',.5,.5);
    }
    for(const y of [-1.5,0,1.5]) t.line([-.8,y,1],[-.8,y,height-1],'#8a9766',.4,.8);
    for(let i=0;i<13;i++) {
      const z=3+i*(height-4)/13, side=i%2 ? -1 : 1;
      t.line([side*2.4,0,z],[side*3.3,.2,z+.3],'#d5c48c',.4,.8);
    }
    t.dot([0,0,height+.3],'#ad9474',1.2,.2);
  }
  function boulder(t,p) {
    const seed=seedNumber(p.seed), w=p.w||15, h=p.h||11, color=p.color||'#8b8d75';
    const lower=[],upper=[],n=8;
    for(let i=0;i<n;i++) {const a=i/n*TAU,k=.8+hash(seed,i)*.3;
      lower.push([Math.cos(a)*w*k,Math.sin(a)*w*.71*k,0]);
      upper.push([Math.cos(a)*w*.68*k-1.5,Math.sin(a)*w*.46*k,h*(.65+hash(seed,i+10)*.3)]);}
    for(let i=0;i<n;i++) t.poly([lower[i],lower[(i+1)%n],upper[(i+1)%n],upper[i]],E.shade(color,-.25+hash(seed,i+20)*.25));
    t.poly(upper,E.shade(color,.13));
    t.poly([upper[1],upper[2],[-2,0,h*1.02],upper[6]],E.shade(color,.23));
    t.line(upper[3],[-2,0,h*.97],E.shade(color,-.3),.5,.5);
    t.line([-2,0,h*.97],[2,2,h*.9],E.shade(color,-.3),.5,.5);
    for(let i=0;i<7;i++) t.dot([(hash(seed,i+30)-.5)*w,(hash(seed,i+40)-.5)*w*.5,h*.96],i%2 ? '#b4b194' : '#666f5c',.5,.8);
  }
  function crate(t,p) {
    const w=p.w||13,h=p.h||12,d=w*.85,color=p.color||P.wood;
    // Use the engine box path where the prop aligns with world axes.
    if (!p.facing) t.add([0,0,h/2],()=> {
      const a=t.world([-w/2,-d/2,0]),b=t.world([w/2,d/2,h]);
      t.r.box(t.g,...a,...b,E.shade(color,.23),color);
    }); else t.box([-w/2,-d/2,0],[w/2,d/2,h],color);
    for(const side of [-1,1]) {
      for(let i=1;i<4;i++) t.line([-w/2,side*d/2-.01,h*i/4],[w/2,side*d/2-.01,h*i/4],E.shade(color,-.32),.5,.5);
      t.line([-w/2+.8,side*d/2,1],[w/2-.8,side*d/2,h-1],P.woodLit,1.7,1);
      for(const x of [-w/2+1,w/2-1]) {
        t.line([x,side*d/2,0],[x,side*d/2,h],P.woodLit,1.2,1);
        t.dot([x,side*d/2,h-1.5],P.ironDark,.4,1.5);
      }
    }
    for(let i=1;i<4;i++) t.line([-w/2,-d/2+d*i/4,h],[w/2,-d/2+d*i/4,h],E.shade(color,-.15),.45,.8);
    t.line([-w/2+1,-d/2,h+.1],[w/2-1,d/2,h+.1],E.shade(color,.3),1.1,1);
  }
  function wagon(t,p,time) {
    const w=p.w||37,d=22,color=p.color||'#705744',rot=finite(p.speed,0)*time*.03;
    for(const side of [-1,1]) for(const f of [-w*.34,w*.34]) t.wheel(f,side*(d/2+1),7,7,rot,false);
    for(const f of [-w*.34,w*.34]) t.tube([f,-d*.57,7],[f,d*.57,7],.9,.9,P.ironDark,P.iron);
    t.box([-w/2,-d/2,7],[w/2,d/2,11],P.woodDark,P.woodLit);
    for(const side of [-1,1]) {
      t.box([-w/2,side*d/2-.7,10],[w/2,side*d/2+.7,19],color);
      for(let z=12;z<19;z+=3) t.line([-w/2,side*(d/2+.8),z],[w/2,side*(d/2+.8),z],P.woodDark,.5,.3);
      for(const f of [-w/2+2,0,w/2-2]) t.tube([f,side*d/2,9],[f,side*d/2,21],.75,.75,P.woodLit);
    }
    t.box([-w/2,-d/2,10],[-w/2+1.5,d/2,19],color);
    t.line([w/2,-5,8],[w/2+26,-4,5],P.woodDark,1.9);
    t.line([w/2,5,8],[w/2+26,4,5],P.woodDark,1.9);
    t.line([w/2+26,-7,5],[w/2+26,7,5],P.woodLit,1.5);
    if (p.covered!==false) {
      const arch=[];
      for(let i=0;i<=10;i++) {const a=i/10*Math.PI;arch.push([-Math.cos(a)*d*.48,19+Math.sin(a)*11]);}
      for(let i=0;i<10;i++) {
        const a=arch[i],b=arch[i+1];
        t.poly([[-w/2+2,a[0],a[1]],[w/2-3,a[0],a[1]],[w/2-3,b[0],b[1]],[-w/2+2,b[0],b[1]]],E.shade(P.linen,(i-5)*.02));
      }
      for(const f of [-w/2+2,-6,6,w/2-3]) for(let i=0;i<10;i++) t.line([f,arch[i][0],arch[i][1]+.1],[f,arch[i+1][0],arch[i+1][1]+.1],'#a49370',.65,.7);
      // Rolled canvas edge at the open rear.
      for(let i=0;i<10;i++) t.tube([-w/2+1.5,arch[i][0],arch[i][1]],[-w/2+1.5,arch[i+1][0],arch[i+1][1]],.65,.65,P.linenLight);
    } else {
      t.box([-13,-7,11],[-1,3,20],'#8b714b');
      t.ellipsoid([7,0,15],[7,6,4],'#899077',10,4);
    }
  }
  function tent(t,p) {
    const w=p.w||39,d=28,h=p.h||27,c=p.color||P.linen;
    for(const side of [-1,1]) {
      t.poly([[-w/2,0,h],[w/2,0,h],[w/2,side*d/2,0],[-w/2,side*d/2,0]],E.shade(c,side<0 ? .12 : -.16));
      for(const f of [-w/2+4,0,w/2-4]) t.line([f,0,h],[f,side*d/2,0],E.shade(c,-.22),.45,.5);
      for(const f of [-w/2,w/2]) {
        t.line([f,0,h],[f+Math.sign(f)*8,side*(d/2+6),0],'#847354',.45,.5);
        t.line([f+Math.sign(f)*8,side*(d/2+6),0],[f+Math.sign(f)*8+.7,side*(d/2+6),3],P.woodDark,.8,.5);
      }
    }
    t.poly([[-w/2,0,h],[-w/2,-d/2,0],[-w/2,d/2,0]],E.shade(c,-.26));
    t.poly([[w/2,0,h],[w/2,-d/2,0],[w/2,d/2,0]],'#493f2d');
    t.poly([[w/2,0,h],[w/2,-d/2,0],[w/2,-d*.2,0],[w/2,.2,h*.79]],E.shade(c,.03));
    t.poly([[w/2,0,h],[w/2,d/2,0],[w/2,d*.2,0],[w/2,-.2,h*.79]],E.shade(c,-.08));
    t.line([-w/2-2,0,h],[w/2+2,0,h],P.wood,.9,.7);
    t.tube([w/2,0,0],[w/2,0,h+1],.65,.65,P.woodDark);
    t.poly([[w/2,-7,.1],[w/2+13,-7,.1],[w/2+13,7,.1],[w/2,7,.1]],'#7c6346');
    for(let i=0;i<4;i++) t.line([w/2+1+i*3,-7,.2],[w/2+1+i*3,7,.2],i%2 ? '#b08d5d' : '#9b7950',1,.8);
  }
  function pole(t,p) {
    const h=p.h||61,w=p.w||65;
    t.tube([0,0,0],[0,0,h],1.7,1.2,P.woodDark,P.woodLit);
    t.line([-.3,-.6,2],[-.3,-.6,h-1],'#d0ab71',.45,.5);
    for(const z of [h-3,h-8]) {
      t.tube([0,-8,z],[0,8,z],.8,.8,P.wood,P.woodLit);
      for(const y of [-6.5,6.5]) {
        t.tube([0,y,z],[0,y,z+2.2],.55,.55,P.ironDark);
        t.dot([0,y,z+2.3],'#86a496',.85,.2);
        for(let i=0;i<8;i++) {
          const a=i/8,b=(i+1)/8;
          t.line([a*w,y,z+2.4-Math.sin(a*Math.PI)*3],[b*w,y,z+2.4-Math.sin(b*Math.PI)*3],'#494f42',.35,.1);
        }
      }
    }
    t.line([0,-6,h-3],[0,0,h-14],P.wood,.8);
    t.line([0,6,h-3],[0,0,h-14],P.wood,.8);
  }
  function fence(t,p) {
    const w=p.w||42,h=p.h||13,seed=seedNumber(p.seed),n=Math.max(2,Math.ceil(w/24)+1);
    for(let i=0;i<n;i++) {
      const f=-w/2+i*w/(n-1),top=h+(hash(seed,i)-.5)*1.8;
      t.tube([f,0,0],[f,0,top],1.35,1.05,P.woodDark,P.woodLit);
      t.dot([f,0,top],P.sand,.7,.3);
    }
    for(const z of [h*.35,h*.76]) {
      t.tube([-w/2-1,-.4,z],[w/2+1,-.4,z-.2],.65,.65,p.color||'#897251','#b39966');
      for(let i=0;i<n;i++) t.dot([-w/2+i*w/(n-1),-.8,z],P.ironDark,.35,.5);
    }
    if(p.gate) {
      t.line([-w/2,0,2],[w/2,0,h-2],P.woodLit,1.1,.5);
      t.line([w/2,0,2],[-w/2,0,h-2],P.wood,1.1,.5);
    }
  }
  function sign(t,p) {
    const w=p.w||36,h=p.h||10,z=p.postHeight||24;
    t.tube([0,0,0],[0,0,z+h*.3],1.2,1,P.woodDark,P.woodLit);
    t.box([-w/2,-1,z-h/2],[w/2,1,z+h/2],p.color||'#5d5c48','#96916b');
    t.line([-w/2+1,1.1,z-h/2+1],[w/2-1,1.1,z-h/2+1],'#baac7c',.5,.7);
    t.add([0,1.2,z],()=>{
      const a=t.at([0,1.2,z]);
      const label=String(p.label||'CINDER RIDGE').toUpperCase();
      E.font.text(t.g,label,a[0],a[1]-3,'#ead6a3',{font:'tiny',align:'center',outline:'#454632'});
    },2);
  }
  function campfire(t,p,time) {
    const seed=seedNumber(p.seed);
    for(let i=0;i<10;i++) {const a=i/10*TAU;t.ellipsoid([Math.cos(a)*5.5,Math.sin(a)*5.5,1],[2,1.6,1.2],i%2 ? '#7e7c61' : '#646954',7,3,seed+i+1);}
    t.tube([-4,-3,1],[4,3,1.5],1.1,1.1,'#4e3a29','#93663c');
    t.tube([-4,3,1.5],[4,-3,1.5],1.1,1.1,'#433528','#865b36');
    t.add([0,0,5],()=>{
      const g=t.g,at=t.at([0,0,3]),s=t.sc;
      t.r.glowDisc(g,at[0],at[1],20*s,'#d4964a',.16);
      for(let j=0;j<5;j++) {
        const x=(j-2)*1.5*s,sw=Math.sin(time*7+j*1.7)*1.2*s,h=(6.5+Math.sin(time*9+j)*2.5)*s;
        px.poly(g,[[at[0]+x-2.6*s,at[1]],[at[0]+x-1.3*s,at[1]-h*.52],
          [at[0]+x+sw,at[1]-h],[at[0]+x+2.6*s,at[1]-h*.37],[at[0]+x+2*s,at[1]]],j%2 ? '#e39b48' : '#c86c36');
        px.poly(g,[[at[0]+x-1.2*s,at[1]],[at[0]+x+sw*.5,at[1]-h*.55],[at[0]+x+1.1*s,at[1]]],'#f6d984');
      }
      for(let i=0;i<6;i++) {
        const u=(time*.7+i*.17)%1;
        px.dot(g,at[0]+Math.sin(time+i)*u*6*s,at[1]-u*19*s,u<.6 ? '#ead094' : '#b47c46');
      }
      px.reset(g);
    },1);
  }
  function waterTower(t,p) {
    const h=p.h||65,base=h*.59,R=p.w ? p.w/2 : 16,c=p.color||'#827455';
    for(const x of [-R*.7,R*.7]) for(const y of [-R*.7,R*.7]) {
      t.box([x-2.3,y-2.3,0],[x+2.3,y+2.3,2.5],'#85856a');
      t.tube([x,y,1],[x*.82,y*.82,base],1.6,1.35,P.woodDark,P.wood);
    }
    for(const side of [-1,1]) {
      t.line([-R*.7,side*R*.7,4],[R*.57,side*R*.57,base-3],P.woodLit,1.5);
      t.line([R*.7,side*R*.7,4],[-R*.57,side*R*.57,base-3],P.wood,1.5);
      t.line([side*R*.7,-R*.7,4],[side*R*.57,R*.57,base-3],P.woodLit,1.5);
      t.line([side*R*.7,R*.7,4],[side*R*.57,-R*.57,base-3],P.wood,1.5);
    }
    t.box([-R-2,-R-2,base-2],[R+2,R+2,base],P.woodDark,P.woodLit);
    const N=20,lower=[],upper=[],top=[];
    for(let i=0;i<N;i++) {const a=i/N*TAU;lower.push([Math.cos(a)*R,Math.sin(a)*R,base]);upper.push([Math.cos(a)*R,Math.sin(a)*R,h-7]);top.push([Math.cos(a)*(R+2),Math.sin(a)*(R+2),h-7]);}
    for(let i=0;i<N;i++) {
      const j=(i+1)%N;
      t.poly([lower[i],lower[j],upper[j],upper[i]],E.shade(c,(i%3-1)*.065));
      t.line(lower[i],upper[i],E.shade(c,-.3),.4,.2);
      t.poly([top[i],top[j],[0,0,h+2]],i%2 ? '#5d6860' : '#667269');
    }
    for(const z of [base+3,base+9,h-11]) for(let i=0;i<N;i++) {const a=i/N*TAU,b=(i+1)/N*TAU;t.line([Math.cos(a)*(R+.15),Math.sin(a)*(R+.15),z],[Math.cos(b)*(R+.15),Math.sin(b)*(R+.15),z],P.ironDark,1.1,.8);}
    const side=R+2.5;
    for(const y of [-2,2]) t.tube([side,y,0],[side,y,h-7],.55,.55,P.woodDark,P.woodLit);
    for(let z=2;z<h-8;z+=3.8) t.line([side,-2,z],[side,2,z],P.woodLit,.6,1);
    t.tube([R,0,base+3],[R+13,0,base+3],1.4,1.4,P.ironDark,P.iron);
    t.tube([R+13,0,base+3],[R+13,0,base-10],1.4,1.4,P.ironDark,P.iron);
    if(p.label) t.add([0,R,h-19],()=>{const a=t.at([0,R+.4,h-19]);E.font.text(t.g,String(p.label),a[0],a[1]-3,'#ddd1a6',{font:'tiny',align:'center',outline:'#5b614a'});},2);
  }
  function train(t,p,time) {
    const c=p.color||'#374b43',speed=finite(p.speed,0),rotation=time*speed*.018;
    // Dark timber sleepers and rails remain visible under the locomotive.
    for(let f=-72;f<52;f+=7) t.box([f-1.4,-12,0],[f+1.4,12,.8],'#625541');
    for(const y of [-7.5,7.5]) t.tube([-76,y,1],[52,y,1],.7,.7,P.ironDark,P.ironLight);
    for(const side of [-1,1]) {
      for(const f of [-16,0,16]) t.wheel(f,side*9.4,7.2,7,rotation,true);
      for(const f of [-57,-42,33]) t.wheel(f,side*8.3,4.5,4.2,rotation,true);
    }
    t.box([-29,-8,8],[31,8,12],P.ironDark,P.iron);
    t.box([-67,-9,8],[-35,9,22],P.ironDark,c);
    t.box([-65,-7,21],[-37,7,22],'#222d27');
    for(let i=0;i<18;i++) t.ellipsoid([-63+hash(71,i)*24,-6+hash(39,i)*12,23+hash(29,i)*2],[2.3,1.8,1.7],i%2 ? '#384137' : '#202e26',7,3,i+1);
    t.box([-33,-9,11],[-17,9,34],c,'#5b6b5d');
    for(const side of [-1,1]) {
      t.box([-30,side*9.1-.2,22],[-21,side*9.1+.2,31],'#9a9b76','#b4ae85');
      t.poly([[-28.8,side*9.4,23],[-22.2,side*9.4,23],[-22.2,side*9.4,30],[-28.8,side*9.4,30]],'#293f39');
      t.line([-25.5,side*9.5,23],[-25.5,side*9.5,30],P.woodLit,.6,.6);
    }
    t.box([-35,-11,34],[-15,11,36],P.ironDark,'#687565');
    // Cylindrical boiler with banded iron panels.
    const ringA=[],ringB=[],N=20;
    for(let i=0;i<N;i++) {const a=i/N*TAU;ringA.push([-18,Math.cos(a)*7.7,21+Math.sin(a)*7.7]);ringB.push([27,Math.cos(a)*7.7,21+Math.sin(a)*7.7]);}
    for(let i=0;i<N;i++) {
      const j=(i+1)%N;
      t.poly([ringA[i],ringB[i],ringB[j],ringA[j]],E.shade(c,Math.sin((i+.5)/N*TAU)*.25-.05));
    }
    t.poly(ringB,'#293b34');
    for(const f of [-11,3,19]) for(let i=0;i<N;i++) {const a=i/N*TAU,b=(i+1)/N*TAU;t.line([f,Math.cos(a)*7.9,21+Math.sin(a)*7.9],[f,Math.cos(b)*7.9,21+Math.sin(b)*7.9],P.ironLight,.75,.7);}
    t.tube([18,0,26],[18,0,39],2.4,3.3,P.ironDark,P.iron);
    t.ellipsoid([18,0,39],[3.8,3.8,1.1],P.ironDark,12,4);
    t.ellipsoid([-3,0,29],[3,3,4],P.ochre,12,5);
    t.tube([-7,-1,28],[-7,-1,34],.6,.6,'#ae9869','#d4c18a');
    t.box([27,-2.5,25],[30,2.5,30],P.ironDark,P.iron);
    t.dot([30.1,0,27.5],'#ddc991',1.4,1);
    // Cowcatcher and side rods make the silhouette read as a steam engine.
    t.poly([[29,-8,10],[29,8,10],[41,11,1.5],[41,-11,1.5]],'#34463b');
    for(let y=-9;y<=9;y+=3) t.line([29,y*.7,10],[41,y,1.5],P.ironLight,.8,1);
    for(const side of [-1,1]) {
      const dy=side*10,up=Math.sin(rotation)*2;
      t.line([-16+Math.cos(rotation)*2,dy,7.2+up],[16+Math.cos(rotation)*2,dy,7.2+up],'#a8a991',1.4,2);
      t.line([-14,side*8,15],[24,side*8,15],'#a79464',.5,1);
      t.line([-32,side*9,13],[-22,side*9,13],P.ironLight,.8,1);
    }
    const steam=p.steam!==false;
    if(steam) for(let i=0;i<4;i++) {
      const u=(time*.22+i*.25)%1;
      t.add([18-u*15,0,40+u*20],()=>{
        const q=t.at([18-u*15,0,40+u*20]);
        px.blend(t.g,(1-u)*.23,'normal',()=>px.disc(t.g,q[0],q[1],(3+u*8)*t.sc,'#acae94'));
      },-.1);
    }
  }

  // Bake still props at their current view. This is essential for dense foliage.
  // A cached image contains only original artwork; collision stays in game code.
  const stamps=new Map();
  function propExtent(p) {
    const w=p.w,h=p.h;
    switch(p.type) {
      case 'tree': case 'cottonwood': return [-34,-27,34,27,67];
      case 'cactus': return [-16,-5,16,5,(h||45)+14];
      case 'boulder': {const R=(w||15)*1.3;return [-R,-R,R,R,(h||11)*1.3];}
      case 'wagon': return [-(w||37)/2-9,-18,(w||37)/2+29,18,35];
      case 'tent': return [-(w||39)/2-12,-24,(w||39)/2+16,24,(h||27)+4];
      case 'crate': return [-(w||13)*.6,-(w||13)*.6,(w||13)*.6,(w||13)*.6,(h||12)+3];
      case 'pole': return [-5,-13,(w||65)+5,13,(h||61)+5];
      case 'fence': return [-(w||42)/2-5,-5,(w||42)/2+5,5,(h||13)+5];
      case 'sign': return [-(w||36)/2-2,-4,(w||36)/2+2,4,(p.postHeight||24)+(h||10)];
      case 'waterTower': {const R=w ? w/2 : 16;return [-R-6,-R-6,R+18,R+6,(h||65)+5];}
      default:return null;
    }
  }
  function cachedProp(r,p,fn) {
    if(p.animated || p.speed) return null;
    const ex=propExtent(p);if(!ex)return null;
    const v=r.view,key=JSON.stringify([p.type,p.size||1,p.facing||0,p.seed||0,p.color||'',p.w||0,p.h||0,p.label||'',p.covered,p.gate,p.postHeight,
      v.id,v.yawDeg,v.pitchDeg,v.scale,v.zBoost]);
    if(stamps.has(key))return stamps.get(key);
    const angle=p.facing||0,c=Math.cos(angle),s=Math.sin(angle),size=p.size||1;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const x of [ex[0],ex[2]]) for(const y of [ex[1],ex[3]]) for(const z of [0,ex[4]]) {
      const q=v.p((x*c-y*s)*size,(x*s+y*c)*size,z*size);
      x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);
    }
    if(p.type==='sign'||p.type==='waterTower') {
      const width=E.font.width(p.label||'CINDER RIDGE',{font:'tiny'})/2+8;
      x0=Math.min(x0,-width);x1=Math.max(x1,width);
    }
    x0=Math.floor(x0)-5;y0=Math.floor(y0)-5;x1=Math.ceil(x1)+5;y1=Math.ceil(y1)+5;
    const W=x1-x0,H=y1-y0;
    if(W>1600||H>1600)return null;
    const canvas=E.mkCanvas(W,H),g=E.ctx2d(canvas),rr=Object.create(r),originZ=finite(p.z,0);
    rr.w=(x,y,z=0)=>{const q=v.p(x-p.x,y-p.y,z-originZ);return [q[0]-x0,q[1]-y0];};
    const t=painter(rr,g,p);fn(t,p,0);t.flush();
    const record={canvas,x:x0,y:y0};
    stamps.set(key,record);
    if(stamps.size>384)stamps.delete(stamps.keys().next().value);
    return record;
  }
  const drawTypes={tree:cottonwood,cottonwood,cactus,boulder,wagon,tent,crate,pole,fence,sign,campfire,waterTower,train};
  const shadows={tree:[19,38,.16],cottonwood:[19,38,.16],cactus:[5,22,.18],boulder:[13,8,.17],wagon:[21,14,.2],tent:[24,15,.17],crate:[10,6,.18],pole:[3,32,.17],fence:[13,10,.13],sign:[7,14,.16],campfire:[7,0,.15],waterTower:[22,42,.18],train:[49,18,.2]};
  function drawProp(r,p,time) {
    if(!E) install(root.My3D2dge);
    const type=p.type,fn=drawTypes[type];
    if(!fn) return;
    time=finite(time,0);
    const shadow=shadows[type]||[8,8,.15];groundShadow(r,p,...shadow);
    if(type==='campfire') r.game.lights.add(p.x,p.y,4*(p.size||1),47*(p.size||1),.65+Math.sin(time*8)*.06,{color:'#e1a35a'});
    r.queue(p.x,p.y,finite(p.z,0),g=>{
      px.reset(g);
      const stamp=g._info ? null : cachedProp(r,p,fn);
      if(stamp) {
        const q=r.w(p.x,p.y,finite(p.z,0));
        g.drawImage(stamp.canvas,Math.round(q[0])+stamp.x,Math.round(q[1])+stamp.y);
        px.reset(g);return;
      }
      const t=painter(r,g,p);fn(t,p,time);t.flush();
    },{hides:type!=='campfire',solid:type!=='campfire',emissive:type==='campfire',bias:p.bias||0});
  }
  root.FrontierArt={install,drawHorse,drawProp,palette:P,clearCache(){stamps.clear();},version:'1.0.0'};
})(typeof window!=='undefined' ? window : globalThis);
