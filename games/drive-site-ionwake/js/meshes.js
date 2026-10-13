/*
 * Original rail-flight polygon assets.
 * Local axes: x right, y up, z forward. Origins are centred.
 * Face winding is outward: cross(b-a, c-a) points out of the solid.
 * Mesh contract: { vertices: [[x,y,z], ...], faces: [{v:[indices], c, glow?}] }.
 * The builders run once. Only plain mesh data is exposed.
 */
(function (root) {
  'use strict';

  const P = {
    ivory: '#f0eee2', pearl: '#c6d9d8', white: '#fff6df',
    coral: '#ee684b', coralDark: '#a63e35',
    navy: '#152a40', navyLight: '#284b64', dark: '#0b1726',
    teal: '#55e6cf', tealDark: '#167e8b', tealLight: '#b4fff1',
    amber: '#ffae4a', orange: '#f77632', gold: '#f5cc70',
    graphite: '#25333f', slate: '#435363', steel: '#819394'
  };

  const mesh = () => ({ vertices: [], faces: [] });
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const mean = a => a.reduce((s, p) => add(s, p), [0,0,0]).map(v => v/a.length);

  function solid(m, vertices, faces, center) {
    const offset = m.vertices.length;
    const inside = center || mean(vertices);
    m.vertices.push(...vertices);
    for (const f of faces) {
      let ids = f.v.slice();
      const ps = ids.map(i => vertices[i]);
      const normal = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
      if (dot(normal, sub(mean(ps), inside)) < 0) ids.reverse();
      const face = { v: ids.map(i => i + offset), c: f.c || P.graphite };
      if (f.glow) face.glow = true;
      m.faces.push(face);
    }
  }

  function face(m, points, color, normal, glow) {
    const offset = m.vertices.length;
    let ids = points.map((_, i) => offset+i);
    if (normal && dot(cross(sub(points[1],points[0]), sub(points[2],points[0])), normal) < 0) ids.reverse();
    m.vertices.push(...points);
    const f = { v:ids, c:color };
    if (glow) f.glow = true;
    m.faces.push(f);
  }

  function box(m, c, s, colors) {
    const [x,y,z] = c, [a,b,d] = s.map(n => n/2);
    const v = [[x-a,y-b,z-d],[x+a,y-b,z-d],[x+a,y+b,z-d],[x-a,y+b,z-d],
               [x-a,y-b,z+d],[x+a,y-b,z+d],[x+a,y+b,z+d],[x-a,y+b,z+d]];
    const cs = Array.isArray(colors) ? colors : Array(6).fill(colors);
    solid(m,v,[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].map((v,i)=>({v,c:cs[i%cs.length]})));
  }

  const bevelRect = (a,b) => [[-.62*a,-b],[.62*a,-b],[a,-.62*b],[a,.62*b],[.62*a,b],[-.62*a,b],[-a,.62*b],[-a,-.62*b]];

  function loftZ(m, at, rings, colors, caps) {
    const verts = [];
    for (const r of rings) for (const p of bevelRect(r[1],r[2])) verts.push([at[0]+p[0],at[1]+p[1]+(r[3]||0),at[2]+r[0]]);
    const fs = [];
    for (let k=0;k<rings.length-1;k++) for(let j=0;j<8;j++) fs.push({
      v:[k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j],
      c:typeof colors==='function'?colors(k,j):colors[j%colors.length]
    });
    fs.push({v:[0,1,2,3,4,5,6,7],c:caps?.[0]||P.dark});
    fs.push({v:Array.from({length:8},(_,i)=>(rings.length-1)*8+i),c:caps?.[1]||P.ivory});
    solid(m,verts,fs);
  }

  function loftY(m, at, rings, colors, caps) {
    const verts=[];
    for(const r of rings) for(const p of bevelRect(r[1],r[2])) verts.push([at[0]+p[0],at[1]+r[0],at[2]+p[1]]);
    const fs=[];
    for(let k=0;k<rings.length-1;k++) for(let j=0;j<8;j++) fs.push({v:[k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j],c:colors[j%colors.length]});
    fs.push({v:[0,1,2,3,4,5,6,7],c:caps?.[0]||P.dark});
    fs.push({v:Array.from({length:8},(_,i)=>(rings.length-1)*8+i),c:caps?.[1]||P.ivory});
    solid(m,verts,fs);
  }

  function disk(m, at, rx, ry, color, normal=[0,0,1], glow=false, n=8) {
    const pts=[];
    for(let i=0;i<n;i++) { const a=2*Math.PI*i/n; pts.push([at[0]+Math.cos(a)*rx,at[1]+Math.sin(a)*ry,at[2]]); }
    face(m,pts,color,normal,glow);
  }

  function ring(m, at, outer, inner, colors, n=12, normal=[0,0,1], glow=false) {
    for(let i=0;i<n;i++) {
      const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
      const p=(r,t)=>[at[0]+Math.cos(t)*r,at[1]+Math.sin(t)*r,at[2]];
      face(m,[p(outer,a),p(outer,b),p(inner,b),p(inner,a)],colors[i%colors.length],normal,glow);
    }
  }

  function wing(m, sign, perimeter, ridge, colors, thickness=.24) {
    const top=perimeter.map(p=>[p[0]*sign,p[1],p[2]]);
    const center=[ridge[0]*sign,ridge[1],ridge[2]];
    const verts=[...top,center,...top.map(p=>[p[0],p[1]-thickness,p[2]]),[center[0],center[1]-thickness,center[2]]];
    const n=top.length,fs=[];
    for(let i=0;i<n;i++) {
      const j=(i+1)%n;
      fs.push({v:[i,j,n],c:colors[i%colors.length]});
      fs.push({v:[n+1+i,n+1+j,2*n+1],c:i%2?P.navy:P.slate});
      fs.push({v:[i,n+1+i,n+1+j,j],c:i===2?P.coralDark:P.navyLight});
    }
    solid(m,verts,fs,[center[0],center[1]-thickness/2,center[2]]);
  }

  function makePlayer() {
    const m=mesh();
    loftZ(m,[0,0,0],[[-3.9,.45,.27],[-2.2,.94,.47],[1.2,.76,.43],[4.5,.035,.035]],
      [P.dark,P.navy,P.navyLight,P.ivory,P.ivory,P.ivory,P.navyLight,P.navy],[P.navy,P.white]);
    const edge=[[.72,.16,2.15],[3.35,.05,-.25],[6,-.22,-3.25],[5.15,-.3,-4.1],[2.05,-.04,-2.65],[.8,.13,-3.1]];
    for(const s of [-1,1]) {
      wing(m,s,edge,[2.5,.4,-.8],[P.white,P.ivory,P.coral,P.coral,P.pearl,P.ivory],.26);
      face(m,[[s*1.1,.23,1.52],[s*2.93,.19,-.37],[s*2.13,.43,-.74]],P.pearl,[0,1,0]);
      face(m,[[s*3.63,.005,-.67],[s*5.64,-.195,-3.19],[s*5.08,-.1,-2.69]],P.white,[0,1,0]);
      loftZ(m,[s*1.28,-.17,0],[[-4.5,.34,.34],[-3.8,.58,.48],[-2.1,.5,.4]],
        [P.navy,P.graphite,P.ivory,P.pearl,P.ivory,P.pearl,P.navyLight,P.navy],[P.dark,P.pearl]);
      disk(m,[s*1.28,-.17,-4.506],.25,.25,P.teal,[0,0,-1],true);
      disk(m,[s*1.28,-.17,-4.511],.12,.12,P.tealLight,[0,0,-1],true);
      face(m,[[s*.92,.54,-2.15],[s*1.35,.61,-2.9],[s*1.46,.13,-3.7],[s*.99,.18,-3.34]],P.coral,[s,.8,0]);
    }
    loftZ(m,[0,.54,0],[[-1.05,.29,.2],[.15,.43,.44],[1.65,.2,.24],[2.1,.045,.045]],
      [P.navy,P.tealDark,P.tealDark,P.teal,P.tealLight,P.teal,P.tealDark,P.navy],[P.navy,P.teal]);
    face(m,[[-.07,.984,.05],[.07,.984,.05],[.08,.816,1.17],[-.08,.816,1.17]],P.tealLight,[0,1,0],true);
    return m;
  }

  function makeDrone() {
    const m=mesh();
    loftZ(m,[0,0,0],[[-2.1,.52,.46],[-.8,1,.7],[1.3,.67,.52],[2.5,.05,.05]],
      [P.dark,P.navy,P.navyLight,P.coral,P.navyLight,P.navy,P.navyLight,P.dark],[P.dark,P.coral]);
    const edge=[[.45,.1,1],[1.8,.12,.15],[3,-.05,-1.6],[2.55,-.08,-2.3],[1,-.03,-1.75],[.5,.08,-1.5]];
    for(const s of [-1,1]) {
      wing(m,s,edge,[1.25,.37,-.52],[P.navyLight,P.coral,P.coralDark,P.navy,P.navyLight,P.navy],.18);
      disk(m,[s*.69,-.09,-2.5],.21,.22,P.coral,[0,0,-1],true);
    }
    face(m,[[-.35,.42,1.55],[.35,.42,1.55],[.19,.66,.43],[-.19,.66,.43]],P.orange,[0,1,.2],true);
    return m;
  }

  function makeInterceptor() {
    const m=mesh();
    loftZ(m,[0,-.08,0],[[-3,.38,.29],[-1.8,.88,.58],[1.65,.38,.34]],
      [P.dark,P.navy,P.navyLight,P.amber,P.gold,P.amber,P.navyLight,P.dark],[P.dark,P.orange]);
    for(const s of [-1,1]) {
      const edge=[[.53,.03,2.13],[1.3,.05,3],[2,.05,.72],[4,-.17,-1.67],[3.56,-.25,-2.7],[.78,.03,-1.98]];
      wing(m,s,edge,[1.63,.42,-.51],[P.gold,P.amber,P.amber,P.coralDark,P.orange,P.gold],.22);
      loftZ(m,[s*1.11,.02,0],[[-2.85,.28,.3],[-1.9,.36,.35],[1.45,.22,.23],[2.99,.05,.05]],
        [P.dark,P.navy,P.orange,P.amber,P.gold,P.amber,P.navy,P.dark],[P.dark,P.gold]);
      disk(m,[s*1.11,.02,-2.858],.19,.2,P.orange,[0,0,-1],true);
    }
    face(m,[[-.28,.43,-.4],[.28,.43,-.4],[.15,.3,1.26],[-.15,.3,1.26]],P.teal,[0,1,0],true);
    return m;
  }

  function makeTurret() {
    const m=mesh();
    loftY(m,[0,0,-.55],[[-2,2.5,2.45],[-1.58,2.5,2.45],[-.9,1.8,1.75]],
      [P.graphite,P.slate,P.navyLight,P.graphite,P.slate,P.graphite,P.navyLight,P.graphite],[P.dark,P.steel]);
    loftY(m,[0,0,-.3],[[-.93,1.3,1.2],[.62,1.3,1.2],[1.1,.92,.8]],
      [P.graphite,P.ivory,P.slate,P.ivory,P.graphite,P.slate,P.ivory,P.slate],[P.graphite,P.ivory]);
    loftZ(m,[0,.72,0],[[-1.25,.69,.55],[.6,.585,.48],[1.92,.51,.43],[3,.64,.5]],
      [P.dark,P.graphite,P.coral,P.steel,P.ivory,P.steel,P.coral,P.graphite],[P.graphite,P.dark]);
    disk(m,[0,.72,3.004],.29,.29,P.orange,[0,0,1],true);
    box(m,[-.98,.96,-.58],[.3,2.08,1.3],[P.graphite,P.orange,P.graphite,P.ivory,P.slate,P.graphite]);
    box(m,[.98,.96,-.58],[.3,2.08,1.3],[P.graphite,P.orange,P.graphite,P.ivory,P.slate,P.graphite]);
    face(m,[[-1.55,-1.1,1.82],[1.55,-1.1,1.82],[1.6,-1.42,2.08],[-1.6,-1.42,2.08]],P.coral,[0,1,1]);
    return m;
  }

  function makeBossHull() {
    const m=mesh();
    loftZ(m,[0,0,0],[[-11,4.9,2.6],[-7,8,4],[4.8,8,4],[9,6,3.35],[11,3.8,2.5]],
      (k,j)=>[P.dark,P.graphite,P.slate,P.ivory,P.ivory,P.pearl,P.slate,P.graphite][j],
      [P.graphite,P.navy]);
    for(const s of [-1,1]) {
      box(m,[s*10.2,-.9,-1.4],[7.6,2.8,7.4],[P.dark,P.orange,P.graphite,P.slate,P.graphite,P.graphite]);
      const edge=[[5.8,2.9,5.6],[9,2.4,3.7],[14,.35,-4.6],[12.7,.2,-7.2],[7.3,2.2,-5.8],[5.7,3.6,-2.5]];
      wing(m,s,edge,[8.7,3.85,-.6],[P.ivory,P.pearl,P.graphite,P.orange,P.slate,P.ivory],1.0);
      box(m,[s*6.6,2.57,6.2],[1.1,1.4,4.5],[P.graphite,P.orange,P.slate,P.ivory,P.graphite,P.graphite]);
      face(m,[[s*7.1,3.71,3.3],[s*8.5,2.97,2.28],[s*10.5,1.89,-.16],[s*9.2,2.67,.73]],P.orange,[0,1,0]);
      loftZ(m,[s*3,-.3,0],[[-11,.95,1.2],[-8.7,1.35,1.5]],
        [P.dark,P.graphite,P.slate,P.graphite,P.ivory,P.graphite,P.slate,P.graphite],[P.dark,P.graphite]);
      disk(m,[s*3,-.3,-11.008],.65,.84,P.teal,[0,0,-1],true);
    }
    loftZ(m,[0,4.24,0],[[-5.4,2.5,.4],[-2.6,2.8,1.76],[2.7,2.2,1.28],[5.1,1,.24]],
      [P.graphite,P.slate,P.ivory,P.pearl,P.ivory,P.pearl,P.slate,P.graphite],[P.graphite,P.ivory]);
    face(m,[[-1.9,5.01,3.12],[1.9,5.01,3.12],[1.48,5.35,2.66],[-1.48,5.35,2.66]],P.teal,[0,1,1],true);
    solid(m,[[-2.8,-3,-4],[2.8,-3,-4],[2.8,-3,4],[-2.8,-3,4],[0,-6,-2],[0,-5.8,4]],
      [{v:[0,1,2,3],c:P.graphite},{v:[0,4,1],c:P.dark},{v:[1,4,5,2],c:P.slate},{v:[2,5,3],c:P.orange},{v:[3,5,4,0],c:P.graphite}]);
    ring(m,[0,0,11.006],2.2,1.62,[P.orange,P.amber,P.coralDark],12);
    disk(m,[0,0,11.009],1.58,1.58,P.dark,[0,0,1]);
    return m;
  }

  function makeBossArm() {
    const m=mesh();
    loftZ(m,[0,0,0],[[-8,3.2,2.8],[-5.4,5,4],[4.9,5,4],[7.84,3.78,3.18]],
      [P.dark,P.graphite,P.slate,P.ivory,P.ivory,P.pearl,P.slate,P.graphite],[P.dark,P.dark]);
    for(const s of [-1,1]) {
      box(m,[s*5.34,0,-.72],[1.32,3.3,8],[P.dark,P.orange,P.graphite,P.ivory,P.graphite,P.slate]);
      face(m,[[s*4.14,2.88,4.55],[s*3.52,2.91,6.67],[s*2.8,3.22,6.6],[s*3.22,3.48,4.55]],P.orange,[s,.8,0]);
    }
    ring(m,[0,0,7.865],3.33,2.58,[P.slate,P.ivory,P.graphite,P.ivory],12);
    ring(m,[0,0,7.885],2.52,1.77,[P.orange,P.amber,P.orange,P.coralDark],12,[0,0,1],true);
    disk(m,[0,0,7.90],1.71,1.71,P.dark);
    disk(m,[0,0,8],1.09,1.09,P.orange,[0,0,1],true);
    disk(m,[0,0,8.006],.47,.47,P.gold,[0,0,1],true);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+Math.PI/4, b=a+.16;
      const p=(r,t)=>[Math.cos(t)*r,Math.sin(t)*r,7.914];
      face(m,[p(3.28,a),p(3.28,b),p(2.59,b),p(2.59,a)],P.orange,[0,0,1],true);
    }
    return m;
  }

  function makeBossCore() {
    const m=mesh(), verts=[[0,-4,0]];
    const rings=[[-2.45,2.9],[0,4],[2.45,2.9]];
    for(const [y,r] of rings) for(let j=0;j<8;j++) { const a=j*Math.PI/4; verts.push([r*Math.cos(a),y,r*Math.sin(a)]); }
    verts.push([0,4,0]);
    const fs=[], cols=[P.orange,P.amber,P.gold,P.coral,P.amber,P.white,P.gold,P.orange];
    for(let j=0;j<8;j++) {
      const k=(j+1)%8;
      fs.push({v:[0,1+j,1+k],c:cols[j],glow:j%3===0});
      for(let r=0;r<2;r++) {
        fs.push({v:[1+r*8+j,1+r*8+k,1+(r+1)*8+k],c:cols[(j+r+1)%8],glow:j%4===0});
        fs.push({v:[1+r*8+j,1+(r+1)*8+k,1+(r+1)*8+j],c:cols[(j+r+3)%8],glow:j%4===1});
      }
      fs.push({v:[17+j,25,17+k],c:cols[(j+2)%8],glow:j%2===0});
    }
    solid(m,verts,fs,[0,0,0]);
    return m;
  }

  function makePylon() {
    const m=mesh();
    loftY(m,[0,0,0],[[-15,3,3.5],[-12.5,2.85,3.25],[10.8,1.9,2.28],[15,.68,.8]],
      [P.graphite,P.slate,P.ivory,P.graphite,P.slate,P.graphite,P.pearl,P.graphite],[P.graphite,P.ivory]);
    loftY(m,[0,0,0],[[-12.65,2.89,3.29],[-11.65,2.86,3.26]],
      [P.orange,P.orange,P.coralDark,P.orange,P.orange,P.coralDark,P.orange,P.orange],[P.graphite,P.orange]);
    face(m,[[-.15,-9.7,3.147],[.15,-9.7,3.147],[.15,8.8,2.379],[-.15,8.8,2.379]],P.teal,[0,0,1],true);
    face(m,[[-.15,-9.7,-3.147],[.15,-9.7,-3.147],[.15,8.8,-2.379],[-.15,8.8,-2.379]],P.teal,[0,0,-1],true);
    disk(m,[0,12.45,1.791],.38,.38,P.orange,[0,0,1],true);
    return m;
  }

  function makeDebris() {
    const m=mesh();
    solid(m,[[-.9,-.5,-.65],[.75,-.45,-.51],[.63,.55,-.7],[-.64,.63,-.44],[-.67,-.57,.61],[.86,-.29,.44],[.48,.54,.63],[-.58,.37,.56]],
      [[0,1,2],[0,2,3],[4,7,6],[4,6,5],[0,4,5],[0,5,1],[3,2,6],[3,6,7],[0,3,7],[0,7,4],[1,5,6],[1,6,2]]
        .map((v,i)=>({v,c:[P.ivory,P.pearl,P.graphite,P.coral,P.navy,P.slate][i%6]})));
    return m;
  }

  root.IonMeshes = {
    player: makePlayer(),
    drone: makeDrone(),
    interceptor: makeInterceptor(),
    turret: makeTurret(),
    bossHull: makeBossHull(),
    bossArm: makeBossArm(),
    bossCore: makeBossCore(),
    pylon: makePylon(),
    debris: makeDebris()
  };

  // The bevel widths change along some hulls. Split every four-corner panel
  // into triangles so each face has one exact plane and one exact normal.
  for (const m of Object.values(root.IonMeshes)) {
    m.faces = m.faces.flatMap(f => f.v.length === 4
      ? [{...f,v:[f.v[0],f.v[1],f.v[2]]},{...f,v:[f.v[0],f.v[2],f.v[3]]}]
      : [f]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
