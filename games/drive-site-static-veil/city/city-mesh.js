/*!
 * MeridianMesh 1.0 — original procedural geometry for STATIC VEIL.
 * No renderer or library dependency. Load as a browser script.
 *
 * ALL positions/dimensions are METRES, x east, y south, z up.
 * Each result = { vertices: Float32Array, bounds: [minX,minY,minZ,maxX,maxY,maxZ],
 *                 triangles, markers: [{kind,x,y,z,label?}] }.
 * Non-indexed TRIANGLES, stride 7 floats: x,y,z,r,g,b,glow.
 * RGB is normalized 0..1; glow is 0..1. Directional cube color is baked in.
 * subjects is a separate per-vertex mask: 1 for characters and props, 0 for architecture.
 * No negative glow/material codes, textures, pixel projection, or engine state.
 *
 * buildBlock(city, block, detail=1, cut={buildingId:null,floorZ:null,roofIds:[]})
 *   Surroundings keep their actual height. A selected interior has exterior
 *   walls up to floorZ+1m and NO cap; buildFloor owns its exposed surface.
 *   roofIds omit caps/roof props for active connected roofs (avoids z-fighting).
 *   detail 0 = distant: 18 triangles/building, 10 triangles of block ground.
 *   detail 1 = standard, 2 = near. Window bands are capped at 32.
 *
 * buildFloor(city, building, plan, links=[], options={eye:false})
 *   Only call for active floors. Orbit walls are 1m; eye walls are the native
 *   44/16 = 2.75m collision height. Eye interiors get a ceiling at floorZ+3.7m.
 *   Roof links are emitted only by their 'a' building to avoid duplicate decks.
 *
 * buildLift(building, zMetres)
 *   Cabin center = [b.door.x, b.y+b.d+2.4, z], size 3.2m square.
 *   Clear windows are empty space between frame/rails, not opaque glass.
 *   Result additionally includes center and eye (1.6m above platform).
 *
 * buildActor(bodyMetres, facingRadians=0, timeSeconds=0)
 *   Original 1.7m-tall coat-wearing person. Optional vx/vy are metres/second.
 *   Result additionally includes eye; root controls physics and camera.
 */
(function (root) {
  'use strict';
  const VERSION = '1.1.0', TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const normType = v => String(v || '').toLowerCase().replace(/[\s_-]+/g, '');
  const cachedColors = new Map();
  function rgb(value, fallback = '#3b5968') {
    if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(v => clamp(num(v), 0, 1));
    if (typeof value !== 'string' || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) value = fallback;
    if (cachedColors.has(value)) return cachedColors.get(value);
    const s = value.length === 4 ? value.slice(1).split('').map(c => c + c).join('') : value.slice(1);
    const n = parseInt(s, 16), c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    if (cachedColors.size > 192) cachedColors.clear();
    cachedColors.set(value, c); return c;
  }
  const tint = (c, amount) => rgb(c).map(v => clamp(v * amount, 0, 1));
  const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return a.map((v, i) => v + (b[i] - v) * t); };
  function hash(value) { const s = String(value); let n = 2166136261; for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619); return n >>> 0; }
  function random(seed, n) { let h = Math.imul(seed ^ Math.imul(n + 17, 374761393), 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
  const C = {
    road: rgb('#10232c'), pavement: rgb('#2c434b'), curb: rgb('#53676b'),
    ink: rgb('#091a25'), metal: rgb('#365568'), edge: rgb('#759ba7'),
    glass: rgb('#174252'), cyan: rgb('#69e9d3'), amber: rgb('#efbc71'),
    lime: rgb('#bddb85'), leaf: rgb('#436e55'), soil: rgb('#152827'),
    rust: rgb('#83594b'), water: rgb('#0d2b3e')
  };
  const districts = {
    industrial: '#334a52', residential: '#424653', office: '#27465e',
    garden: '#344d46', market: '#473f52', tower: '#2c4355'
  };
  const alias = {
    tideward: 'industrial', furnace: 'industrial', lattice: 'residential',
    crownline: 'office', verdant: 'garden', surge: 'market'
  };
  function material(b) {
    const type = alias[normType(b.type)] || normType(b.type) || 'tower';
    const wall = rgb(typeof b.palette === 'object' ? b.palette.side : b.palette, districts[type] || districts.tower);
    const accent = rgb(b.accent, type === 'garden' ? '#bddb85' : type === 'market' ? '#eeb876' : '#69e9d3');
    return { type, wall, roof: mix(wall, C.ink, .3), trim: mix(wall, C.edge, .44),
      dark: mix(wall, C.ink, .58), accent, soft: mix(accent, wall, .62) };
  }
  function realHeight(b) { return Math.max(0, num(b.height, Math.max(1, num(b.floors, 1)) * Math.max(.1, num(b.floorH, 4)))); }

  class Mesh {
    constructor() { this.data = []; this.subjects = []; this.subject = 0; this.bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; this.transform = null; this.markers = []; }
    world(p) {
      const t = this.transform;
      return t ? [t[2] + p[0] * t[0] - p[1] * t[1], t[3] + p[0] * t[1] + p[1] * t[0], t[4] + p[2]] : p;
    }
    vertex(p, color, glow) {
      p = this.world(p);
      this.data.push(p[0], p[1], p[2], color[0], color[1], color[2], glow); this.subjects.push(this.subject);
      for (let k = 0; k < 3; k++) { this.bounds[k] = Math.min(this.bounds[k], p[k]); this.bounds[k + 3] = Math.max(this.bounds[k + 3], p[k]); }
    }
    tri(a, b, c, color, glow = 0) { color = rgb(color); glow = clamp(num(glow), 0, 1); this.vertex(a, color, glow); this.vertex(b, color, glow); this.vertex(c, color, glow); }
    quad(a, b, c, d, color, glow = 0) { this.tri(a, b, c, color, glow); this.tri(a, c, d, color, glow); }
    plane(x0, y0, x1, y1, z, color, glow = 0) { if (x1 > x0 && y1 > y0) this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, glow); }
    box(x0, y0, z0, x1, y1, z1, color, glow = 0, options = {}) {
      if (!(x1 > x0 && y1 > y0 && z1 > z0)) return;
      const c = rgb(color), face = (factor, a, b, cc, d) => this.quad(a, b, cc, d, tint(c, factor), glow);
      face(.72, [x1,y0,z0], [x1,y0,z1], [x0,y0,z1], [x0,y0,z0]);
      face(.94, [x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0]);
      face(.82, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0]);
      face(.64, [x1,y1,z0], [x1,y1,z1], [x1,y0,z1], [x1,y0,z0]);
      if (options.top !== false) face(1.16, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1]);
      if (options.bottom) face(.55, [x0,y1,z0], [x1,y1,z0], [x1,y0,z0], [x0,y0,z0]);
    }
    local(x, y, z, yaw, fn) {
      const prev = this.transform, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
      this.transform = prev ? [prev[0]*c-prev[1]*s, prev[1]*c+prev[0]*s, prev[2]+prev[0]*x-prev[1]*y, prev[3]+prev[1]*x+prev[0]*y, prev[4]+z] : [c,s,x,y,z];
      try { fn(); } finally { this.transform = prev; }
    }
    marker(kind, p, label) { const v = this.world(p); this.markers.push({ kind, x:v[0], y:v[1], z:v[2], ...(label ? {label} : {}) }); }
    finish(extra) { return Object.assign({ vertices:new Float32Array(this.data), subjects:new Uint8Array(this.subjects), bounds:this.data.length ? this.bounds : [0,0,0,0,0,0], triangles:this.data.length/21, markers:this.markers }, extra || {}); }
  }
  // A beam is a true oriented prism: useful for antenna bracing and walking limbs.
  function beam(m, a, b, width, color, glow = 0, depth = width) {
    const d = b.map((v,i)=>v-a[i]), n = Math.hypot(...d); if (n < 1e-5) return;
    const v = d.map(x=>x/n), ref = Math.abs(v[2]) > .9 ? [1,0,0] : [0,0,1];
    const cross = (p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
    let u = cross(v,ref), un = Math.hypot(...u); u=u.map(x=>x/un); const w=cross(v,u);
    const corner=(p,s,t)=>p.map((x,i)=>x+u[i]*width*.5*s+w[i]*depth*.5*t);
    const A=[corner(a,-1,-1),corner(a,1,-1),corner(a,1,1),corner(a,-1,1)];
    const B=[corner(b,-1,-1),corner(b,1,-1),corner(b,1,1),corner(b,-1,1)];
    for(let i=0;i<4;i++)m.quad(A[i],A[(i+1)%4],B[(i+1)%4],B[i],tint(color,[.7,.9,1.1,.8][i]),glow);
    m.quad(B[0],B[1],B[2],B[3],tint(color,1.1),glow);
    m.quad(A[3],A[2],A[1],A[0],tint(color,.65),glow);
  }
  function cone(m,x,y,z,r,h,color,sides=6) {
    for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides;m.tri([x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x,y,z+h],tint(color,.75+.3*(i%3)/2));}
  }
  function facePanel(m, face, u0, u1, z0, z1, color, glow=0, out=.028) {
    if(u1<=u0||z1<=z0)return;
    const p=(u,z)=>[face.x+face.ux*u+face.nx*out,face.y+face.uy*u+face.ny*out,z];
    // Face direction is chosen so these quads have outward winding.
    if(face.reverse)m.quad(p(u1,z0),p(u1,z1),p(u0,z1),p(u0,z0),color,glow);
    else m.quad(p(u0,z0),p(u0,z1),p(u1,z1),p(u1,z0),color,glow);
  }
  function faces(b) { const x=b.x,y=b.y,w=b.w,d=b.d; return [
    {x,y,ux:1,uy:0,nx:0,ny:-1,len:w,reverse:true},
    {x,y:y+d,ux:1,uy:0,nx:0,ny:1,len:w,reverse:false},
    {x,y,ux:0,uy:1,nx:-1,ny:0,len:d,reverse:false},
    {x:x+w,y,ux:0,uy:1,nx:1,ny:0,len:d,reverse:true}
  ]; }
  function marker(m,x,y,z,kind,color) {
    const r=.8,w=.055; m.plane(x-r,y-r,x+r,y+r,z,C.ink);
    for(const a of [[x-r,y-r,x+r,y-r+w],[x-r,y+r-w,x+r,y+r],[x-r,y-r,x-r+w,y+r],[x+r-w,y-r,x+r,y+r]])m.plane(...a,z+.012,color,.75);
    if(kind==='lift'){
      m.plane(x-.32,y-.42,x+.32,y-.33,z+.015,color,.65);m.plane(x-.32,y+.33,x+.32,y+.42,z+.015,color,.65);
      m.plane(x-.055,y-.32,x+.055,y+.32,z+.015,color,.65);
    }else{
      const sign=kind==='down'?1:-1;
      m.tri([x-.3,y-.12*sign,z+.015],[x+.3,y-.12*sign,z+.015],[x,y+.38*sign,z+.015],color,.7);
      m.plane(x-.06,y-.33,x+.06,y+.2,z+.015,color,.6);
    }
    m.marker(kind,[x,y,z+.12],kind.toUpperCase());
  }
  function prop(m,type,x,y,z,color,orientation=0,variant=0) {
    const previousSubject=m.subject;m.subject=1;
    const a=rgb(color,'#67dbc9'),dark=C.ink,metal=C.metal,edge=C.edge;
    const aliases={apartmentdesk:'desk',apartmentbed:'bed',officedesk:'office',industrialmachine:'machine',gardenplanter:'planter',roofvent:'vent',radioantenna:'radio',radiomast:'radio',marketstall:'stall'};
    type=aliases[normType(type)]||normType(type);
    m.local(x,y,z,Math.round(num(orientation))*Math.PI/2,()=>{
      const B=(...v)=>m.box(...v), Q=(...v)=>m.quad(...v);
      if(type==='desk'||type==='office'){
        B(-.85,-.42,0,-.58,.42,.72,metal);B(.62,-.36,0,.75,.35,.72,edge);
        B(-.95,-.5,.72,.95,.5,.84,metal);
        B(-.38,-.3,.85,.38,-.12,1.35,dark);Q([-.32,-.108,.95],[.32,-.108,.95],[.32,-.108,1.29],[-.32,-.108,1.29],a,.38);
        B(-.38,.16,.84,.26,.37,.89,edge);B(-.1,.78,0,.1,.93,.46,metal);B(-.37,.64,.46,.37,1.12,.57,metal);B(-.38,1.01,.56,.38,1.14,1.07,dark);
      }else if(type==='bed'){
        B(-.72,-1.08,0,.72,1.08,.25,metal);B(-.68,-1.02,.25,.68,1.04,.54,'#a9bab8');
        B(-.69,-.2,.54,.69,1.05,.61,mix(a,metal,.62));B(-.55,-.89,.54,.55,-.48,.67,'#d7ded2');B(-.75,-1.15,.1,.75,-1.05,.94,metal);
      }else if(type==='machine'){
        B(-1.25,-.95,0,1.25,.95,.17,edge);B(-1.05,-.78,.17,1.05,.78,1.52,metal);B(-1.15,-.88,1.52,1.15,.88,1.67,edge);
        B(.3,-.58,1.67,.85,.42,2.08,metal);B(-.86,-.47,1.67,-.08,.25,1.78,dark);m.plane(-.76,-.34,-.19,.14,1.79,a,.55);
        for(let i=0;i<5;i++)B(-.9+i*.42,.782,.35,-.79+i*.42,.835,1.34,dark);
        beam(m,[-1.16,-.2,.15],[-1.16,-.2,1.95],.12,C.rust);beam(m,[-1.16,-.2,1.95],[-.56,-.2,1.95],.12,C.rust);
        for(let i=0;i<4;i++)Q([-.96+i*.48,.96,.04],[-.74+i*.48,.96,.04],[-.58+i*.48,.96,.17],[-.8+i*.48,.96,.17],C.amber);
      }else if(type==='planter'||type==='tree'){
        B(-1.08,-.55,0,1.08,.55,.43,metal);m.plane(-.98,-.45,.98,.45,.445,C.soil);
        if(type==='tree'){B(-.1,-.1,.44,.1,.1,2.1,C.rust);cone(m,0,0,1.6,1.1,1.6,C.leaf);cone(m,0,0,2.6,.8,1.1,C.lime);}
        else for(let i=0;i<5;i++){const xx=-.82+i*.41;beam(m,[xx,0,.44],[xx,0,1.03+(i%2)*.19],.035,C.leaf);cone(m,xx,0,.72,.25,.68,i%2?C.leaf:C.lime,5);}
      }else if(type==='radio'||type==='antenna'){
        B(-.62,-.62,0,.62,.62,.22,metal);beam(m,[0,0,.2],[0,0,6.7],.13,edge);
        for(const h of [2.2,3.9,5.6]){beam(m,[-1.1,0,h],[1.1,0,h],.07,edge);beam(m,[-1.1,0,h-.4],[-1.1,0,h+.4],.045,edge);beam(m,[1.1,0,h-.4],[1.1,0,h+.4],.045,edge);}
        beam(m,[-.8,-.8,.1],[0,0,3.8],.035,metal);beam(m,[.8,.8,.1],[0,0,3.8],.035,metal);B(-.095,-.095,6.7,.095,.095,6.92,C.amber,.9);
      }else if(type==='stairhead'||type==='lifthead'){
        const lift=type==='lifthead';B(-1.25,-1.3,0,1.25,1.3,2.7,metal);B(-1.34,-1.39,2.7,1.34,1.39,2.86,edge);
        Q([-.7,1.318,0],[.7,1.318,0],[.7,1.318,2.2],[-.7,1.318,2.2],dark);
        B(-.77,1.32,2.24,.77,1.39,2.35,a,.85);B(.87,1.32,.95,1.01,1.4,1.29,a,.4);
        if(lift)B(-.78,-.64,2.86,.78,.7,3.4,metal);else prop(m,'vent',0,-.2,2.86,a);
      }else if(type==='lamp'){
        B(-.25,-.25,0,.25,.25,.25,edge);beam(m,[0,0,.25],[0,0,7.1],.13,metal);beam(m,[0,0,7.1],[0,1.45,7.1],.12,edge);
        B(-.48,1.02,6.92,.48,1.92,7.18,metal);m.plane(-.4,1.1,.4,1.83,6.905,C.amber,.94);
      }else if(type==='bench'){
        B(-1.2,-.34,.49,1.2,.34,.65,metal);for(const xx of [-.93,.79])B(xx,-.28,0,xx+.14,.28,.52,edge);B(-1.2,-.43,.65,1.2,-.29,1.15,metal);
      }else if(type==='bollard'){
        B(-.18,-.18,0,.18,.18,1.02,metal);B(-.2,-.2,.78,.2,.2,.91,a,.8);
      }else if(type==='kiosk'){
        B(-.72,-.58,0,.72,.58,2.3,metal);B(-.79,-.65,2.3,.79,.65,2.45,edge);
        Q([-.5,.605,.74],[.35,.605,.74],[.35,.605,1.92],[-.5,.605,1.92],a,.23);
        for(let i=0;i<3;i++)B(.48,.6,1.01+i*.22,.61,.68,1.12+i*.22,C.amber,.6);
      }else if(type==='stall'){
        B(-1.3,-.72,0,1.3,.72,.95,metal);for(const xx of [-1.3,1.3])for(const yy of [-.85,.85])beam(m,[xx,yy,0],[xx,yy,2.25],.06,edge);
        Q([-1.55,-1.05,2.22],[1.55,-1.05,2.22],[1.55,0,2.6],[-1.55,0,2.6],mix(a,C.ink,.3));
        Q([-1.55,0,2.6],[1.55,0,2.6],[1.55,1.05,2.22],[-1.55,1.05,2.22],C.amber);
        for(let i=0;i<4;i++)B(-1.1+i*.6,-.25,.95,-.65+i*.6,.45,1.25,i%2?C.leaf:C.amber);
      }else{
        B(-.95,-.72,0,.95,.72,.2,edge);B(-.81,-.6,.2,.81,.6,.83,metal);B(-.93,-.72,.83,.93,.72,.95,edge);
        for(let i=0;i<6;i++)B(-.75+i*.3,-.52,.954,-.65+i*.3,.52,.99,dark);
      }
    });
    m.subject=previousSubject;
  }
  function roofEquipment(m,b,c,detail) {
    const z=realHeight(b),x=b.x,y=b.y,w=b.w,d=b.d;
    for(const r of [[x,y,x+w,y+.18],[x,y+d-.18,x+w,y+d],[x,y,x+.18,y+d],[x+w-.18,y,x+w,y+d]])m.box(r[0],r[1],z,r[2],r[3],z+.43,c.trim);
    if(detail<=0)return;
    prop(m,'vent',x+w*.27,y+d*.34,z+.03,c.accent);
    prop(m,b.type==='garden'?'planter':'vent',x+w*.71,y+d*.65,z+.03,c.accent,1);
    prop(m,'stairhead',x+w*.55,y+d*.34,z+.03,c.accent);
    if(c.type==='office'||c.type==='industrial'||b.landmark)prop(m,'radio',x+w*.76,y+d*.27,z+.03,c.accent);
    if(c.type==='garden'){prop(m,'planter',x+w*.25,y+d*.72,z+.03,c.accent);prop(m,'planter',x+w*.44,y+d*.72,z+.03,c.accent);}
    if(c.type==='office'){m.box(x+w*.27,y+d*.35,z+.1,x+w*.65,y+d*.64,z+1.6,c.dark);m.box(x+w*.28,y+d*.36,z+1.58,x+w*.64,y+d*.63,z+1.67,c.accent,.55);}
  }
  function building(m,b,detail,cut,seed) {
    const H=realHeight(b);if(!(b.w>0&&b.d>0&&H>0))return;
    const c=material(b),roofActive=cut.roofIds.has(b.id),selected=b.id===cut.buildingId&&Number.isFinite(cut.floorZ);
    const h=selected?Math.min(H,Math.max(0,cut.floorZ)+1):H,openTop=selected||roofActive;
    m.box(b.x,b.y,0,b.x+b.w,b.y+b.d,h,c.wall,0,{top:!openTop});
    if(detail<=0){
      // Far skyline is geometry, not an impostor: real height and all four faces.
      // A single thin crown band per face keeps district color legible at distance.
      // Active roofs/interiors retain their open top and receive no crown geometry.
      if(!openTop&&h>.3)for(const f of faces(b))facePanel(m,f,.03,f.len-.03,h-.3,h-.12,c.accent,.38,.035);
      m.marker('entrance',[num(b.door&&b.door.x,b.x+b.w*.5),num(b.door&&b.door.y,b.y+b.d+.8),0],b.name||'ENTRY');
      return;
    }
    const fs=faces(b),fh=Math.max(.1,num(b.floorH,4)),floors=Math.max(1,Math.floor(num(b.floors,H/fh)));
    const maxBands=detail<=0?8:32,spacing=detail>=2?2:4;
    const count=Math.min(maxBands,Math.max(1,Math.ceil(floors/spacing))),stride=Math.max(spacing,Math.ceil(floors/count));
    for(let band=0;band<count;band++){
      const floor=band*stride;if(floor>=floors)break;
      const z0=floor*fh+fh*.28,z1=Math.min(h-.08,z0+Math.min(2.25,fh*.56));if(z0>=h)break;
      for(let fi=0;fi<4;fi++){
        const f=fs[fi],lit=random(seed,band*7+fi);
        const color=lit>.76?mix(C.amber,c.accent,.15):lit>.3?mix(c.accent,C.glass,.24):mix(C.glass,c.wall,.15),glow=lit>.76?.33:lit>.3?.28:.035;
        for(const range of [[.1,.45],[.55,.9]])facePanel(m,f,f.len*range[0],f.len*range[1],z0,z1,color,glow);
        const seam=Math.min(h-.01,(floor+1)*fh);
        if(seam>0)facePanel(m,f,.02,f.len-.02,seam-.12,seam,c.trim,0,.033);
        if(detail>0&&c.type==='industrial'&&band%2===0)facePanel(m,f,f.len*.035,f.len*.065,floor*fh+.2,Math.min(h,(floor+stride)*fh-.2),C.rust,0,.04);
      }
      if(detail>0&&c.type==='residential'&&band%2===1&&z0<h-1){
        for(const a of [.12,.7]){const x=b.x+b.w*a,ww=b.w*.17,z=floor*fh;
          m.box(x,b.y+b.d,z-.18,x+ww,b.y+b.d+.85,z,c.trim);
          m.box(x,b.y+b.d+.76,z+.65,x+ww,b.y+b.d+.85,z+.73,c.trim);
        }
      }
    }
    // A few continuous structural lines supply scale without one mesh per floor.
    if(detail>0)for(const xx of [b.x+.17,b.x+b.w-.3]){
      m.box(xx,b.y-.055,0,xx+.13,b.y+.1,h,c.dark);
      m.box(xx,b.y+b.d-.1,0,xx+.13,b.y+b.d+.055,h,c.trim);
      if(c.type==='office')facePanel(m,fs[1],xx-b.x+.035,xx-b.x+.078,.3,h-.1,c.accent,.25,.063);
    }
    const south=fs[1],doorX=num(b.door&&b.door.x,b.x+b.w*.5)-b.x;
    if(detail>0&&h>.2){
      facePanel(m,south,Math.max(.2,doorX-1.35),Math.min(b.w-.2,doorX+1.35),.03,Math.min(3.05,h),c.dark,0,.04);
      facePanel(m,south,doorX-1.38,doorX+1.38,Math.min(3.06,h-.08),Math.min(3.22,h),c.accent,.85,.05);
      for(const range of [[.06,.32],[.68,.94]])facePanel(m,south,b.w*range[0],b.w*range[1],.65,Math.min(2.65,h),c.type==='industrial'?c.dark:C.glass,.02,.041);
      if(c.type==='industrial')for(let i=0;i<4;i++)for(const range of [[.06,.32],[.68,.94]])facePanel(m,south,b.w*range[0],b.w*range[1],.8+i*.45,Math.min(.86+i*.45,h),c.trim,0,.048);
      if(c.type==='market'&&h>3.2)for(const a of [.08,.7])m.quad([b.x+b.w*a,b.y+b.d,3.35],[b.x+b.w*(a+.22),b.y+b.d,3.35],[b.x+b.w*(a+.22),b.y+b.d+1.5,2.95],[b.x+b.w*a,b.y+b.d+1.5,2.95],a<.5?c.accent:C.amber);
      if(h>3.7){
        const sw=Math.min(9,b.w*.35),cx=b.x+doorX,yy=b.y+b.d+.085;
        m.box(cx-sw*.5,yy,3.28,cx+sw*.5,yy+.16,3.84,c.dark);
        // Original abstract relay-bar signage; world labels remain root UI data.
        for(let i=0;i<5;i++)m.box(cx-sw*.4+i*sw*.17,yy+.17,3.4,cx-sw*.32+i*sw*.17,yy+.19,3.72-i%2*.09,c.accent,.75);
      }
    }
    if(!openTop)roofEquipment(m,b,c,detail);
    if(b.landmark&&detail>0){
      // South-face external lift guides are static world geometry.
      const cx=num(b.door&&b.door.x,b.x+b.w*.5),yy=b.y+b.d+.74;
      for(const dx of [-1.84,1.84])m.box(cx+dx-.06,yy-.065,0,cx+dx+.06,yy+.065,H+2.6,c.trim);
      for(let i=0;i<=Math.min(32,Math.ceil(H/16));i++){const z=Math.min(H,i*16);m.box(cx-1.94,yy-.07,z,cx-1.73,yy+.08,z+.11,c.accent,.85);}
      m.marker('exterior-lift',[cx,b.y+b.d+2.4,0],'EXTERIOR LIFT');
    }
    m.marker('entrance',[num(b.door&&b.door.x,b.x+b.w*.5),num(b.door&&b.door.y,b.y+b.d+.8),0],b.name||'ENTRY');
  }
  function buildBlock(city,block,detail=1,cut={}) {
    const m=new Mesh();if(!block)return m.finish();
    detail=clamp(num(detail,1),0,2);const x=num(block.x),y=num(block.y),size=Math.max(1,num(block.size,125)),road=Math.max(3,num(block.road,12)/2);
    const ccut={buildingId:cut.buildingId||null,floorZ:cut.floorZ===null||cut.floorZ===undefined?NaN:num(cut.floorZ,NaN),roofIds:new Set(cut.roofIds||[])};
    if(block.terrain==='outside')return m.finish();
    if(block.terrain==='water'){
      m.plane(x,y,x+size,y+size,-.65,C.water);
      if(detail<=0)return m.finish();
      for(let i=0;i<8;i++){const yy=y+9+i*size/9;m.plane(x+7+(i%3)*9,yy,x+size-11,yy+.16,-.63,mix(C.water,C.cyan,.14),.04);}
      return m.finish();
    }
    m.plane(x,y,x+size,y+size,-.055,block.park?mix(C.pavement,C.leaf,.34):C.pavement);
    for(const a of [[x,y,x+size,y+road],[x,y+size-road,x+size,y+size],[x,y,x+road,y+size],[x+size-road,y,x+size,y+size]])m.plane(...a,-.045,C.road);
    const curb=.17;
    if(detail>0)for(const a of [[x+road,y+road,x+size-road,y+road+curb],[x+road,y+size-road-curb,x+size-road,y+size-road],[x+road,y+road,x+road+curb,y+size-road],[x+size-road-curb,y+road,x+size-road,y+size-road]])m.box(a[0],a[1],-.055,a[2],a[3],.035,C.curb);
    if(detail>0){
      for(let i=4;i<size-4;i+=10){m.plane(x+i,y+.6,x+i+3,y+.72,-.025,C.amber);m.plane(x+.6,y+i,x+.72,y+i+3,-.025,C.amber);}
      for(let i=0;i<5;i++){m.plane(x+road+.4+i*.75,y+.9,x+road+.78+i*.75,y+road-.6,-.02,C.edge);m.plane(x+.9,y+road+.4+i*.75,x+road-.6,y+road+.78+i*.75,-.02,C.edge);}
    }
    const bs=Array.isArray(block.buildings)?block.buildings:[];
    for(const b of bs)building(m,b,detail,ccut,hash((city&&city.seed||'MERIDIAN')+':'+b.id+':'+num(b.variant)));
    if(detail>0&&block.terrain!=='bridge'){
      const accent=city&&typeof city.district==='function'?city.district(block.district).color:'#69e9d3';
      for(const p of [[x+road+1.3,y+road+1.3],[x+size-road-1.3,y+size-road-1.3]])prop(m,'lamp',p[0],p[1],0,accent);
      prop(m,'kiosk',x+road+2.4,y+size*.54,0,accent,1);prop(m,'bench',x+size*.54,y+road+2,0,accent);
      if(block.park)for(let i=0;i<8;i++)prop(m,i%3?'planter':'tree',x+22+(i%4)*25,y+26+Math.floor(i/4)*64,0,accent);
    }
    return m.finish();
  }
  function roofRails(m,b,z,links) {
    for(let side=0;side<4;side++){
      const alongX=side===0||side===2,len=alongX?b.w:b.d,axis=alongX?b.x:b.y;
      const fixed=side===0?b.y:side===1?b.x+b.w:side===2?b.y+b.d:b.x;
      const intervals=[];
      for(const l of links){const lo=alongX?l.x:l.y,hi=lo+(alongX?l.w:l.d),perp=alongX?l.y:l.x,perpEnd=perp+(alongX?l.d:l.w);if(fixed>=perp-.3&&fixed<=perpEnd+.3&&hi>=axis&&lo<=axis+len)intervals.push([Math.max(0,lo-axis-.1),Math.min(len,hi-axis+.1)]);}
      intervals.sort((a,b0)=>a[0]-b0[0]);let cursor=0;const sections=[];
      for(const a of intervals){if(a[0]>cursor)sections.push([cursor,a[0]]);cursor=Math.max(cursor,a[1]);}if(cursor<len)sections.push([cursor,len]);
      for(const a of sections){
        const p=t=>alongX?[axis+t,fixed]:[fixed,axis+t],A=p(a[0]),B=p(a[1]);
        beam(m,[A[0],A[1],z+.9],[B[0],B[1],z+.9],.075,C.edge);
        const count=Math.max(1,Math.ceil((a[1]-a[0])/5));
        for(let i=0;i<=count;i++){const v=p(a[0]+(a[1]-a[0])*i/count);beam(m,[v[0],v[1],z],[v[0],v[1],z+.9],.065,C.metal);}
      }
    }
  }
  function buildFloor(city,b,plan,links=[],options={}) {
    const m=new Mesh();if(!b||!plan)return m.finish();
    const z=num(plan.z),tile=Math.max(.1,num(plan.tile,2)),c=material(b),x=b.x,y=b.y,w=b.w,d=b.d;
    m.plane(x,y,x+w,y+d,z+.012,plan.roof?c.roof:mix(c.wall,C.edge,.13));
    // Fine in-world floor joints are bounded by the active plan, not the city.
    for(let i=1;i<plan.w;i++)m.plane(x+i*tile-.018,y,x+i*tile+.018,y+d,z+.018,c.dark);
    for(let i=1;i<plan.h;i++)m.plane(x,y+i*tile-.018,x+w,y+i*tile+.018,z+.019,c.dark);
    if(!plan.roof){
      const wallH=options.eye?2.75:1;
      // Merge horizontal runs of native occupied cells. Geometry and collision agree.
      for(let yy=0;yy<plan.h;yy++)for(let xx=0;xx<plan.w;){
        if(!plan.cells[yy*plan.w+xx]){xx++;continue;}let end=xx+1;while(end<plan.w&&plan.cells[yy*plan.w+end])end++;
        m.box(x+xx*tile,y+yy*tile,z+.022,x+end*tile,y+(yy+1)*tile,z+wallH,c.trim);xx=end;
      }
      const mid=Math.floor(plan.w/2);m.plane(x+(mid-.95)*tile,y+tile,x+(mid+1.95)*tile,y+d-tile,z+.021,mix(c.wall,c.accent,.14));
      m.plane(x+(mid+.48)*tile,y+tile,x+(mid+.52)*tile,y+d-tile,z+.025,c.accent,.32);
      if(options.eye){
        // CULL_FACE may be disabled by the renderer; the ceiling is one plane.
        m.plane(x,y,x+w,y+d,z+3.7,mix(c.dark,C.edge,.1));
        const rows=Math.min(8,Math.max(1,Math.floor(d/7)));
        for(let i=0;i<rows;i++){const yy=y+(i+.5)*d/rows;m.plane(x+w*.43,yy-.23,x+w*.57,yy+.23,z+3.685,mix(c.accent,C.edge,.45),.6);}
      }
    }else{
      const relevant=links.filter(l=>l.a===b.id||l.b===b.id);roofRails(m,b,z+.025,relevant);
      for(const l of relevant)if(l.a===b.id){
        m.box(l.x,l.y,l.z-.19,l.x+l.w,l.y+l.d,l.z+.01,C.metal,0,{bottom:true});
        for(let i=0;i<Math.ceil(l.w/2);i++)m.plane(l.x+i*2,l.y,l.x+Math.min(l.w,i*2+.04),l.y+l.d,l.z+.024,C.edge);
        for(const yy of [l.y+.1,l.y+l.d-.1]){beam(m,[l.x,yy,l.z+1],[l.x+l.w,yy,l.z+1],.065,C.edge);for(let i=0;i<=Math.ceil(l.w/4);i++){const xx=l.x+Math.min(l.w,i*4);beam(m,[xx,yy,l.z],[xx,yy,l.z+1],.065,C.metal);}}
      }
    }
    for(const p of plan.props||[])prop(m,p.type==='desk'&&c.type==='office'?'office':p.type,x+num(p.x),y+num(p.y),z+.025,c.accent,p.orientation,p.variant);
    for(const [kind,port] of Object.entries(plan.ports||{})){
      if(kind==='entry'&&plan.index!==0||kind==='up'&&plan.roof||kind==='down'&&plan.index===0)continue;
      const px=x+(port.x+.5)*tile,py=y+(port.y+.5)*tile,color=kind==='lift'?C.lime:kind==='entry'?C.edge:C.cyan;
      marker(m,px,py,z+.035,kind,color);
      if(plan.roof&&kind==='lift')prop(m,'lifthead',px,py-1.98,z+.025,color);
      else if(plan.roof&&kind==='down')prop(m,'stairhead',px-1.65,py-1.98,z+.025,color);
      else if(kind==='lift'){
        m.box(px-.97,py-.92,z,px-.83,py-.76,z+2.6,c.trim);m.box(px+.83,py-.92,z,px+.97,py-.76,z+2.6,c.trim);
        m.box(px-.97,py-.92,z+2.43,px+.97,py-.76,z+2.6,color,.6);
        m.box(px+.86,py-.72,z+1.02,px+1.02,py-.63,z+1.32,color,.45);
      }else if(kind==='up'||kind==='down'){
        for(let i=0;i<6;i++)m.box(px-.62,py-1.5+i*.21,z,px+.62,py-1.29+i*.21,z+.13*(kind==='up'?6-i:i+1),c.trim);
      }
    }
    return m.finish();
  }
  function buildLift(b,zMetres) {
    const m=new Mesh();if(!b)return m.finish({center:[0,0,0],eye:[0,0,1.6]});
    m.subject=1;
    const cx=num(b.door&&b.door.x,b.x+b.w*.5),cy=b.y+b.d+2.4,z=clamp(num(zMetres),0,realHeight(b)),a=rgb(b.accent,'#69e9d3');
    m.local(cx,cy,z,0,()=>{
      m.box(-1.6,-1.6,-.18,1.6,1.6,.035,C.metal,0,{bottom:true});
      m.plane(-1.49,-1.49,1.49,1.49,.041,mix(C.metal,C.ink,.35));
      for(const xx of [-1.56,1.49])m.box(xx,-1.56,.04,xx+.07,1.56,.085,a,.75);
      for(const xx of [-1.55,1.55])for(const yy of [-1.55,1.55])m.box(xx-.045,yy-.045,.04,xx+.045,yy+.045,2.5,C.edge);
      for(const yy of [-1.55,1.55])beam(m,[-1.59,yy,2.5],[1.59,yy,2.5],.12,C.metal);
      for(const xx of [-1.55,1.55])beam(m,[xx,-1.59,2.5],[xx,1.59,2.5],.12,C.metal);
      // Three open window walls; the north/back opening faces the landing.
      beam(m,[-1.55,1.55,1.02],[1.55,1.55,1.02],.055,C.edge);
      for(const xx of [-1.55,1.55])beam(m,[xx,-1.55,1.02],[xx,1.55,1.02],.055,C.edge);
      for(const xx of [-1.25,1.25])m.box(xx-.025,-1.58,2.39,xx+.025,1.58,2.44,a,.8);
      m.box(1.08,-1.34,.9,1.36,-1.16,1.52,C.ink);m.quad([1.1,-1.145,1.13],[1.33,-1.145,1.13],[1.33,-1.145,1.43],[1.1,-1.145,1.43],a,.5);
      for(const xx of [-1.81,1.65])m.box(xx,-1.76,.15,xx+.16,-1.51,.7,C.metal);
    });
    m.marker('lift-cabin',[cx,cy,z],'EXTERIOR LIFT');
    return m.finish({center:[cx,cy,z],eye:[cx,cy+.2,z+1.6],landing:[cx,b.y+b.d-.8,z]});
  }
  function buildActor(bodyMetres,facing=0,time=0) {
    const m=new Mesh(),p=bodyMetres||{},x=num(p.x),y=num(p.y),z=num(p.z),speed=Math.hypot(num(p.vx),num(p.vy)),walk=clamp(speed/3.8,0,1);
    m.subject=1;
    const coat=rgb('#31586e'),trim=C.cyan,skin=rgb('#bf9a80'),hair=rgb('#cedbd5'),pants=rgb('#172b3d'),boots=rgb('#101c28');
    m.local(x,y,z,num(facing)-Math.PI/2,()=>{
      for(const side of [-1,1]){
        const sw=Math.sin(num(time)*8+(side>0?Math.PI:0))*walk,foot=[side*.12,sw*.19,.075+Math.max(0,sw)*.08],knee=[side*.12,sw*.095,.45],hip=[side*.12,0,.82];
        beam(m,hip,knee,.125,pants);beam(m,knee,foot,.105,pants);
        m.box(foot[0]-.075,foot[1]-.08,Math.max(0,foot[2]-.075),foot[0]+.075,foot[1]+.16,foot[2]+.06,boots);
        const shoulder=[side*.24,0,1.27],elbow=[side*.275,-sw*.13,1.035],hand=[side*.275,-sw*.23,.835];
        beam(m,shoulder,elbow,.135,coat);beam(m,elbow,hand,.115,coat);m.box(hand[0]-.057,hand[1]-.058,hand[2]-.04,hand[0]+.057,hand[1]+.058,hand[2]+.08,pants);
      }
      m.box(-.2,-.135,.76,.2,.15,.98,pants);
      m.box(-.23,-.17,.82,.23,.18,1.34,coat);m.box(-.25,-.17,.65,.25,.16,.86,coat);
      m.box(-.078,-.075,1.34,.078,.075,1.43,skin);m.box(-.135,-.12,1.4,.135,.14,1.645,skin);
      m.box(-.142,-.13,1.61,.142,.13,1.7,hair);m.box(-.14,-.14,1.45,.14,-.09,1.65,hair);
      beam(m,[0,-.13,1.6],[.05,-.25,1.39],.065,hair);
      m.quad([-.12,.144,1.525],[.12,.144,1.525],[.12,.144,1.56],[-.12,.144,1.56],trim,.5);
      m.box(-.05,.181,.96,.05,.196,1.25,trim,.24);m.box(-.22,.182,1.25,-.12,.197,1.29,trim,.28);
    });
    return m.finish({eye:[x,y,z+1.6]});
  }
  root.MeridianMesh=Object.freeze({version:VERSION,stride:7,units:'metres',buildBlock,buildFloor,buildLift,buildActor});
})(typeof window!=='undefined'?window:globalThis);
