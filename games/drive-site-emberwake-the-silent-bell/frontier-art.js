/*
 * EMBERWAKE / WORLD FORGE — original, bounded procedural frontier artwork.
 * Load after my-3d2dge.js. No assets, simulation, DOM UI or world-sized arrays.
 *
 * In the existing Game scene's draw(r):
 *   EWFrontierArt.render(game, world, player, game.time, { visited });
 *   hero.z = EWFrontierArt.elevation(world.tile(tx, ty));
 *   EW.drawHuman(r, hero); // or root-owned Morrow.draw(...)
 *
 * player.x/y and drawSite x/y are WORLD UNITS. world.tile(tx, ty) takes integer
 * TILE INDICES, with a tile size of 24. Ground stays at z=0; road bridges use
 * z=2. Normalized tile.height shades terrain and changes mountain silhouettes,
 * rather than introducing gaps or inaccessible steps beneath walkable actors.
 * Tile data: { biome, height, road, river, feature, water? }. A feature may be a
 * string or { type/kind, id?, visited? }. Optional road/river.mask uses N=1,
 * E=2, S=4, W=8; otherwise connections come from the four adjacent tiles.
 *
 * Call clearCache(world), increment world.revision, or change options.revision
 * after terrain mutations. A different world object invalidates tile data.
 * options: radius (minimum radius, default 15; automatically expanded for the
 * projected viewport, hard cap 28), visited (Set of feature ids or
 * "tx,ty" keys), drawPlayer(r, player), background (false or a color),
 * drawFeatures (false to own all site rendering), maxProps (0..512).
 * render() does NOT call r.begin/finish or change camera, actors or collisions.
 */
(function (root) {
  'use strict';
  const E = root.My3D2dge;
  if (!E || !E.px) throw new Error('EWFrontierArt requires My3D2dge.');
  const px = E.px, T = 24;
  const LIMITS = Object.freeze({ radius: 28, tiles: 3249, props: 512,
    tileCache: 4096, textures: 384, texturePixels: 3145728, waterGlints: 48 });
  const P = Object.freeze({
    ocean:    ['#285b66', '#204b59', '#3b7480', '#83b3af'],
    coast:    ['#b8ad87', '#9d9e7e', '#d9caa1', '#788f83'],
    grassland:['#7c916c', '#6c8265', '#a4af7c', '#536f5e'],
    forest:   ['#4e725d', '#426552', '#6e8a64', '#34564e'],
    desert:   ['#bc9b70', '#aa865f', '#d7b888', '#967255'],
    tundra:   ['#c6d3c9', '#abc3bc', '#e5e8d5', '#87a4a0'],
    mountain: ['#788a80', '#657c76', '#a2ada0', '#48636a'],
    marsh:    ['#658777', '#53766d', '#9aa982', '#3e6867']
  });
  const C = { ink:'#153741', water:'#367a83', waterDeep:'#285965',
    foam:'#9ac3b7', sand:'#c4ab7e', road:'#c5ad80', roadEdge:'#8e8266',
    stone:'#b7b296', stoneLight:'#d9c9a2', stoneDark:'#677f7b',
    bronze:'#ab8051', gold:'#e0b96d', teal:'#36716f', lit:'#8bd8bd',
    cloth:'#b77450', shadow:'#284f51' };
  const DIRECTIONS = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]];
  let currentWorld = null, currentRevision, worldSalt = 0, projection = '';
  const tiles = new Map(), textures = new Map();
  let texturePixels = 0;

  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const finite = (n,f=0) => Number.isFinite(n) ? n : f;
  const hash = (x,y,s=0) => E.hash2(x*17+s*43, y*29+s*71);
  const wp = (r,g,points,color) => px.poly(g,points.map(p=>r.w(p[0],p[1],p[2]||0)),color);
  const ln = (r,g,a,b,color,width=1) => {
    const p=r.w(a[0],a[1],a[2]||0), q=r.w(b[0],b[1],b[2]||0);
    px.line(g,p[0],p[1],q[0],q[1],color,width);
  };
  const rect = (r,g,x0,y0,x1,y1,z,color) =>
    wp(r,g,[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],color);
  function biome(tile) {
    const b=String(tile && tile.biome || 'ocean').toLowerCase();
    return P[b] ? b : ({grass:'grassland',plains:'grassland',snow:'tundra',
      sea:'ocean',water:'ocean',swamp:'marsh',hills:'mountain',beach:'coast'})[b] || 'grassland';
  }
  function isWater(tile) { return !!tile && (biome(tile)==='ocean' || tile.water===true); }
  function elevation(tile) {
    return tile && tile.road && (tile.river || isWater(tile)) ? 2 : 0;
  }
  function level(value) {
    const h=finite(value,.45);
    return clamp(h>1 ? h/100 : h,0,1);
  }
  function featureKind(feature) {
    let kind=typeof feature==='string' ? feature : feature && (feature.type||feature.kind);
    kind=String(kind||'').toLowerCase();
    return ({ruin:'ruins',village:'town',city:'town',settlement:'town',
      shrine:'sanctuary',temple:'sanctuary',outpost:'camp',tower:'relay'})[kind] || kind;
  }
  function seedNumber(seed) {
    const s=String(seed==null?'':seed); let n=2166136261;
    for(let i=0;i<s.length;i++) n=Math.imul(n^s.charCodeAt(i),16777619);
    return n>>>0;
  }
  function activate(world,revision) {
    const rev=revision===undefined ? world.revision : revision;
    if(currentWorld!==world || currentRevision!==rev) {
      currentWorld=world; currentRevision=rev; worldSalt=seedNumber(world.seed);
      tiles.clear();
    }
  }
  function remember(map,key,value,limit) {
    if(map.has(key)) map.delete(key);
    map.set(key,value);
    while(map.size>limit) map.delete(map.keys().next().value);
    return value;
  }
  function getTile(world,x,y) {
    const key=x+','+y;
    let d=tiles.get(key);
    if(d) { tiles.delete(key); tiles.set(key,d); return d; }
    const t=world.tile(x,y)||{};
    const b=biome(t), h=level(t.height), n=hash(x,y,worldSalt);
    d={ x,y,source:t,biome:b,height:h,band:Math.min(2,Math.floor(h*3)),
      road:!!t.road,river:!!t.river,water:isWater(t),bridge:elevation(t)>0,
      feature:t.feature,kind:featureKind(t.feature),variant:Math.floor(n*12),n };
    return remember(tiles,key,d,LIMITS.tileCache);
  }
  function connections(world,d,key) {
    const raw=d.source[key];
    if(raw && typeof raw==='object' && Number.isFinite(raw.mask)) return raw.mask&15;
    let mask=0;
    for(const [dx,dy,bit] of DIRECTIONS) {
      const n=getTile(world,d.x+dx,d.y+dy);
      if(n[key] || key==='river' && n.water) mask|=bit;
    }
    return mask;
  }
  function waterEdges(world,d) {
    let mask=0;
    for(const [dx,dy,bit] of DIRECTIONS)
      if(getTile(world,d.x+dx,d.y+dy).water) mask|=bit;
    return mask;
  }
  function projectionKey(view) {
    return [view.ax,view.ay,view.bx,view.by,view.bz].map(v=>Math.round(v*10000)).join(':');
  }
  function trimTextures() {
    while(textures.size>LIMITS.textures || texturePixels>LIMITS.texturePixels) {
      const key=textures.keys().next().value, value=textures.get(key);
      texturePixels-=value.cv.width*value.cv.height; textures.delete(key);
    }
  }
  function stamp(r,key,draw) {
    const cacheKey=projectionKey(r.view);
    if(cacheKey!==projection) { projection=cacheKey; textures.clear(); texturePixels=0; }
    let st=textures.get(key);
    if(st) { textures.delete(key); textures.set(key,st); return st; }
    const pts=[];
    for(const x of [-1,T+1]) for(const y of [-1,T+1])
      for(const z of [0,3]) pts.push(r.view.p(x,y,z));
    const ox=Math.floor(Math.min(...pts.map(p=>p[0])))-2,
      oy=Math.floor(Math.min(...pts.map(p=>p[1])))-2;
    const w=Math.ceil(Math.max(...pts.map(p=>p[0])))-ox+3,
      h=Math.ceil(Math.max(...pts.map(p=>p[1])))-oy+3;
    // An unusual inspection zoom never allocates an unbounded texture.
    if(w>512 || h>512) return null;
    const cv=E.mkCanvas(w,h),g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
    const local=Object.create(r);
    local.w=(x,y,z=0)=>{const p=r.view.p(x,y,z);return[p[0]-ox,p[1]-oy];};
    draw(local,g);
    st={cv,ox,oy}; textures.set(key,st); texturePixels+=w*h; trimTextures();
    return st;
  }
  function paintStamp(r,g,st,x,y,fallback) {
    if(!st) {
      const local=Object.create(r); local.w=(lx,ly,z=0)=>r.w(x+lx,y+ly,z);
      fallback(local,g); return;
    }
    const p=r.w(x,y,0);
    g.drawImage(st.cv,Math.round(p[0])+st.ox,Math.round(p[1])+st.oy); g._c=null;
  }
  function path(r,g,mask,width,color,z=0) {
    const c=T/2,a=c-width/2,b=c+width/2;
    rect(r,g,a,a,b,b,z,color);
    if(mask&1) rect(r,g,a,0,b,c,z,color);
    if(mask&2) rect(r,g,c,a,T,b,z,color);
    if(mask&4) rect(r,g,a,c,b,T,z,color);
    if(mask&8) rect(r,g,0,a,c,b,z,color);
  }
  function floorArt(r,g,d,roadMask,riverMask,shoreMask) {
    const colors=P[d.biome],v=d.variant;
    const base=E.mix(colors[0],d.band===2?colors[2]:colors[1],d.band===1?.03:.13);
    rect(r,g,-.35,-.35,T+.35,T+.35,0,base);
    // Twelve reusable coordinate-hashed variants; no per-frame random noise.
    for(let k=0;k<7;k++) {
      const x=2+hash(v,k,7)*19,y=2+hash(k,v,31)*19;
      const size=d.biome==='ocean'||d.biome==='desert'?3.5:1.8;
      ln(r,g,[x,y,0],[Math.min(T-1,x+size),y+.4,0],k&1?colors[1]:colors[2]);
      if(d.biome==='marsh' && k<2)
        rect(r,g,x-1,y-1,Math.min(T-1,x+4),y+1,0,C.waterDeep);
    }
    if(d.biome!=='ocean' && shoreMask) {
      const shore=d.biome==='tundra'?'#d8dfcb':C.sand;
      if(shoreMask&1) {rect(r,g,0,0,T,3,0,shore);ln(r,g,[0,.8],[T,.8],C.foam);}
      if(shoreMask&2) {rect(r,g,T-3,0,T,T,0,shore);ln(r,g,[T-.8,0],[T-.8,T],C.foam);}
      if(shoreMask&4) {rect(r,g,0,T-3,T,T,0,shore);ln(r,g,[0,T-.8],[T,T-.8],C.foam);}
      if(shoreMask&8) {rect(r,g,0,0,3,T,0,shore);ln(r,g,[.8,0],[.8,T],C.foam);}
    }
    if(d.river && !d.water) {
      const mask=riverMask||5;
      path(r,g,mask,9,C.waterDeep);
      path(r,g,mask,6.4,C.water);
      if(mask&1) ln(r,g,[10,1],[10,9],C.foam);
      if(mask&2) ln(r,g,[15,10],[23,10],C.foam);
      if(mask&4) ln(r,g,[14,15],[14,23],'#639f9c');
      if(mask&8) ln(r,g,[1,14],[9,14],'#639f9c');
    }
    if(d.road && !d.bridge) {
      path(r,g,roadMask,8,C.roadEdge);
      path(r,g,roadMask,6.2,C.road);
      // Broken wheel-track flecks give roads a legible but worn surface.
      if(roadMask&5) {ln(r,g,[11,3],[11,7],'#e2c394');ln(r,g,[14,17],[14,21],'#a79775');}
      if(roadMask&10) {ln(r,g,[3,11],[7,11],'#e2c394');ln(r,g,[17,14],[21,14],'#a79775');}
    }
    if(['town','camp','relay','sanctuary','vault','ruins'].includes(d.kind)) {
      rect(r,g,5,5,19,19,0,d.biome==='tundra'?'#aebcaf':'#9c9e81');
      rect(r,g,7,7,17,17,0,'#c0b48e');
    }
  }
  function bridgeArt(r,g,mask) {
    const m=mask||5;
    path(r,g,m,10,'#655c4d',0);
    path(r,g,m,8.4,'#ab946c',2);
    path(r,g,m,6.8,'#c8b083',2);
    if(m&5) for(let y=1;y<T;y+=3) {
      if(y<11 && !(m&1) || y>13 && !(m&4)) continue;
      ln(r,g,[8.3,y,2],[15.7,y,2],'#7b7460');
    }
    if(m&10) for(let x=1;x<T;x+=3) {
      if(x<11 && !(m&8) || x>13 && !(m&2)) continue;
      ln(r,g,[x,8.3,2],[x,15.7,2],'#7b7460');
    }
    for(const [dx,dy,bit] of DIRECTIONS) if(m&bit) {
      const x=12+dx*10,y=12+dy*10;
      const a=r.w(x+(dy?4.5:0),y+(dx?4.5:0),2),
        b=r.w(x-(dy?4.5:0),y-(dx?4.5:0),2);
      px.dot(g,a[0],a[1],C.stoneLight);px.dot(g,b[0],b[1],C.stoneLight);
    }
  }
  function visible(r,x,y,height=0,pad=22) {
    const p=r.w(x,y,0), top=r.w(x,y,height);
    return p[0]>=-pad && p[0]<=r.bw+pad && p[1]>=-pad && top[1]<=r.bh+pad;
  }
  function visibleRadius(r,cx,cy,minimum) {
    let radius=clamp(Math.floor(finite(minimum,15)),3,LIMITS.radius);
    const v=r.view;
    if(typeof v.toGround!=='function') return radius;
    // The renderer camera includes focus height, offset, rotation and lag.
    // Invert its actual buffer corners, with room for a tall prop whose base
    // lies below the screen. The work remains bounded even at inspection zooms.
    const pad=8,bottom=r.bh+Math.abs(v.bz)*85+pad;
    for(const sx of [-pad,r.bw+pad]) for(const sy of [-pad,bottom]) {
      const p=v.toGround(sx+finite(r.ix),sy+finite(r.iy));
      if(!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      radius=Math.max(radius,Math.ceil(Math.max(
        Math.abs(p[0]/T-(cx+.5)),Math.abs(p[1]/T-(cy+.5))))+1);
    }
    return Math.min(radius,LIMITS.radius);
  }
  function mountain(r,d) {
    const x=(d.x+.5)*T,y=(d.y+.5)*T,h=32+d.height*31+d.n*13;
    r.queue(x,y,0,g=>{
      const base=[[x-12,y-12,0],[x+12,y-12,0],[x+12,y+12,0],[x-12,y+12,0]],
        peak=[x-4+d.n*8,y-3,h];
      const faces=base.map((a,i)=>({a,b:base[(i+1)%4],
        color:['#809386','#486a6c','#5d7c77','#a2ad97'][i],
        depth:r.view.depth((a[0]+base[(i+1)%4][0]+peak[0])/3,
          (a[1]+base[(i+1)%4][1]+peak[1])/3,h/3)}));
      faces.sort((a,b)=>a.depth-b.depth);
      for(const f of faces) {
        wp(r,g,[f.a,f.b,peak],f.color);
        const a=f.a.map((v,i)=>v*.31+peak[i]*.69), b=f.b.map((v,i)=>v*.31+peak[i]*.69);
        if(d.height>.63) wp(r,g,[a,b,peak],E.mix(f.color,'#e0e4d0',.75));
      }
      ln(r,g,[x+7,y+10,2],[peak[0]+2,peak[1],h-6],'#8d9c8b');
    },{hides:true});
  }
  function tree(r,d,pine=false) {
    const x=(d.x+.5)*T+(d.n-.5)*7,y=(d.y+.5)*T,
      h=23+hash(d.x,d.y,9)*14;
    r.shadow(x,y,8,.24,C.shadow,0);
    r.queue(x,y,0,g=>{
      r.box(g,x-1.3,y-1.3,0,x+1.3,y+1.3,h*.59,'#968260','#5d6653');
      if(pine) {
        for(let i=0;i<3;i++) {
          const z=9+i*7,w=10-i*2;
          wp(r,g,[[x-w,y,z],[x,y-w,z],[x+1,y,z+17]],'#6d8e78');
          wp(r,g,[[x-w,y,z],[x,y+w,z],[x+1,y,z+17]],'#365f58');
          wp(r,g,[[x+w,y,z],[x,y+w,z],[x+1,y,z+17]],'#507967');
          if(d.biome==='tundra') ln(r,g,[x-w+2,y,z+2],[x,y,z+14],'#cbd8c6',2);
        }
      } else {
        const z=h*.57;
        wp(r,g,[[x-10,y,z],[x-8,y-7,z+8],[x,y-9,h],[x+8,y-6,z+9],
          [x+11,y+2,z+2],[x+5,y+9,z-2],[x-6,y+8,z-3]],'#345e52');
        wp(r,g,[[x-9,y-1,z+3],[x-6,y-7,z+9],[x,y-9,h],[x+7,y-5,z+10],
          [x+5,y+2,z+8],[x-2,y+4,z+5]],'#63876a');
        wp(r,g,[[x-6,y-4,z+8],[x-2,y-8,h-1],[x+4,y-6,h-2],
          [x+2,y-1,z+11]],'#8a9f77');
        ln(r,g,[x-8,y+3,z],[x-4,y+6,z+1],'#567c60');
      }
    },{hides:true});
  }
  function smallProp(r,d) {
    const x=(d.x+.5)*T,y=(d.y+.5)*T;
    r.queue(x,y,0,g=>{
      if(d.biome==='marsh') {
        for(let k=0;k<4;k++) {
          const dx=-5+k*3,z=5+hash(k,d.variant,19)*5;
          ln(r,g,[x+dx,y+k%2,0],[x+dx-1,y+k%2,z],'#b2ad76');
          ln(r,g,[x+dx-1,y+k%2,z],[x+dx-2,y+k%2,z+2],'#857450',2);
        }
      } else {
        r.box(g,x-4,y-3,0,x+3,y+3,3.4,'#a3aa91','#687f75');
        wp(r,g,[[x-4,y-3,3.4],[x-2,y-2,7],[x+2,y,6],[x+3,y+3,3.4]],
          d.biome==='tundra'?'#e1e6d4':'#b5b498');
      }
    },{hides:true});
  }
  function building(r,g,x,y,z,w=8,h=12,roof=C.teal) {
    r.box(g,x-w,y-6,z,x+w,y+6,z+h,C.stoneLight,C.stoneDark);
    const a=[x-w-1,y-7,z+h],b=[x+w+1,y-7,z+h],
      c=[x+w+1,y+7,z+h],d=[x-w-1,y+7,z+h],
      p=[x,y-7,z+h+7],q=[x,y+7,z+h+7];
    wp(r,g,[a,d,q,p],E.mix(roof,'#a9b594',.25));
    wp(r,g,[b,c,q,p],roof);wp(r,g,[d,c,q],C.stoneLight);
    ln(r,g,p,q,'#aeb696');
    wp(r,g,[[x-2,y+6.1,z],[x+2,y+6.1,z],[x+2,y+6.1,z+7],[x-2,y+6.1,z+7]],C.ink);
    wp(r,g,[[x+w+.1,y-2,z+5],[x+w+.1,y+1,z+5],[x+w+.1,y+1,z+8],[x+w+.1,y-2,z+8]],C.gold);
  }
  function verticalRing(r,g,x,y,z,rad,color) {
    let last=null;
    for(let i=0;i<=20;i++) {
      const a=i/20*Math.PI*2,p=[x+Math.cos(a)*rad,y,z+Math.sin(a)*rad];
      if(last) ln(r,g,last,p,color); last=p;
    }
  }
  function siteVisited(options,feature,x,y) {
    if(options.visited===true || options.active===true || options.completed===true) return true;
    if(feature && typeof feature==='object' && (feature.visited||feature.completed)) return true;
    const set=options.visited;
    return !!(set && typeof set.has==='function' &&
      ((feature && feature.id!=null && set.has(feature.id)) ||
       set.has(Math.floor(x/T)+','+Math.floor(y/T)) ||
       set.has(Math.floor(x/T)+':'+Math.floor(y/T))));
  }
  function drawSite(r,kind,x,y,clock=0,options={}) {
    kind=featureKind(kind);
    if(!['camp','town','relay','sanctuary','vault','ruins'].includes(kind)) return false;
    const z=finite(options.z),t=finite(clock),active=siteVisited(options,options.feature,x,y),
      glow=active?C.lit:C.gold;
    if(!visible(r,x,y,60,50)) return false;
    r.shadow(x,y,kind==='town'?17:12,.24,C.shadow,z);
    r.queue(x,y,z,g=>{
      r.box(g,x-10,y-9,z,x+10,y+9,z+2,C.stone,C.stoneDark);
      if(kind==='camp') {
        wp(r,g,[[x-11,y-6,z+2],[x+10,y-6,z+2],[x+3,y-6,z+17]],'#a76c4d');
        wp(r,g,[[x-11,y-6,z+2],[x-11,y+8,z+2],[x+3,y+8,z+17],[x+3,y-6,z+17]],'#c38c59');
        wp(r,g,[[x+10,y-6,z+2],[x+10,y+8,z+2],[x+3,y+8,z+17],[x+3,y-6,z+17]],'#8c664c');
        wp(r,g,[[x-11,y+8,z+2],[x+10,y+8,z+2],[x+3,y+8,z+17]],C.cloth);
        wp(r,g,[[x-2,y+8.1,z+2],[x+5,y+8.1,z+2],[x+3,y+8.1,z+12]],C.ink);
        ln(r,g,[x+14,y+4,z],[x+14,y+4,z+20],C.bronze,2);
        r.box(g,x+12,y+3,z+13,x+16,y+6,z+17,glow,C.bronze);
      } else if(kind==='town') {
        const homes=[[-7,-5,6,14,C.teal],[9,-1,5,10,'#778574'],[-2,9,5,9,C.cloth]];
        homes.sort((a,b)=>r.view.order(x+a[0],y+a[1])-r.view.order(x+b[0],y+b[1]));
        for(const a of homes) building(r,g,x+a[0],y+a[1],z+2,a[2],a[3],a[4]);
      } else if(kind==='relay') {
        r.box(g,x-5,y-5,z+2,x+5,y+5,z+6,C.stoneLight,C.stoneDark);
        r.box(g,x-2,y-2,z+6,x+2,y+2,z+25,C.stoneLight,C.teal);
        r.box(g,x-6,y-4,z+22,x+6,y+4,z+25,C.bronze,C.stoneDark);
        verticalRing(r,g,x,y,z+31,8,glow);
        ln(r,g,[x,y,z+25],[x,y,z+35],C.bronze,2);
        const p=r.w(x,y-.4,z+31);px.disc(g,p[0],p[1],1.6,glow);
        ln(r,g,[x+8,y+5,z+3],[x+8,y+5,z+21],C.bronze);
        wp(r,g,[[x+8,y+5,z+21],[x+17,y+5,z+20],
          [x+16,y+5+Math.sin(t*1.8+x)*1.3,z+13],[x+8,y+5,z+14]],active?C.teal:C.cloth);
      } else if(kind==='sanctuary') {
        r.box(g,x-7,y-7,z+2,x+7,y+7,z+5,C.stoneLight,C.stoneDark);
        r.box(g,x-3,y-3,z+5,x+3,y+3,z+26,C.stoneLight,C.teal);
        wp(r,g,[[x-3,y-3,z+26],[x+3,y-3,z+26],[x,y,z+35]],'#e5d8b1');
        wp(r,g,[[x+3,y-3,z+26],[x+3,y+3,z+26],[x,y,z+35]],C.bronze);
        ln(r,g,[x+3.1,y,z+11],[x+3.1,y,z+24],glow,2);
        for(const dx of [-8,8]) r.box(g,x+dx-1,y+7,z+2,x+dx+1,y+9,z+7,C.stoneLight,C.teal);
      } else if(kind==='vault') {
        r.box(g,x-9,y-6,z+2,x+9,y+6,z+17,C.stoneLight,C.stoneDark);
        r.box(g,x-11,y-7,z+17,x+11,y+7,z+20,C.bronze,C.teal);
        wp(r,g,[[x-5,y+6.1,z+2],[x+5,y+6.1,z+2],[x+5,y+6.1,z+14],
          [x+2,y+6.1,z+17],[x-2,y+6.1,z+17],[x-5,y+6.1,z+14]],C.ink);
        ln(r,g,[x,y+6.2,z+3],[x,y+6.2,z+16],C.bronze,2);
        verticalRing(r,g,x,y+6.3,z+10,3.5,glow);
        r.box(g,x-4,y-3,z+20,x+4,y+3,z+23,C.stoneLight,C.teal);
      } else {
        const posts=[[-7,-5,20],[7,-5,14],[-7,6,10],[7,6,5]];
        posts.sort((a,b)=>r.view.order(x+a[0],y+a[1])-r.view.order(x+b[0],y+b[1]));
        for(const [dx,dy,h] of posts) {
          r.box(g,x+dx-2,y+dy-2,z+2,x+dx+2,y+dy+2,z+h,C.stoneLight,C.stoneDark);
          wp(r,g,[[x+dx-2,y+dy-2,z+h],[x+dx+2,y+dy-2,z+h],
            [x+dx+1,y+dy+1,z+h+3],[x+dx-2,y+dy+2,z+h]],'#d0c39f');
        }
        r.box(g,x-8,y-6,z+17,x+1,y-3,z+20,C.stoneLight,C.stoneDark);
        ln(r,g,[x-4,y+2,z+2],[x+4,y+4,z+2],C.teal,2);
      }
    },{hides:true});
    return true;
  }
  function render(game,world,player,clock=0,options={}) {
    if(!game || !game.r || !world || typeof world.tile!=='function' || !player)
      throw new TypeError('render expects (My3D2dge.Game, world.tile, player, clock, options).');
    const r=game.r,g=r.ctx,cx=Math.floor(finite(player.x)/T),cy=Math.floor(finite(player.y)/T),
      rad=visibleRadius(r,cx,cy,options.radius),
      time=finite(clock,finite(game.time)),
      maxProps=clamp(Math.floor(finite(options.maxProps,LIMITS.props)),0,LIMITS.props);
    activate(world,options.revision);
    if(options.background!==false) px.rect(g,0,0,r.bw,r.bh,options.background||'#254d59');
    const bridges=[],props=[],glints=[];
    let visibleTiles=0,siteCount=0;
    const halfW=(Math.abs(r.view.ax)+Math.abs(r.view.ay))*T/2+3,
      halfH=(Math.abs(r.view.bx)+Math.abs(r.view.by))*T/2+3;
    for(let ty=cy-rad;ty<=cy+rad;ty++) for(let tx=cx-rad;tx<=cx+rad;tx++) {
      const x=(tx+.5)*T,y=(ty+.5)*T,p=r.w(x,y,0);
      const groundVisible=p[0]>=-halfW&&p[0]<=r.bw+halfW&&p[1]>=-halfH&&p[1]<=r.bh+halfH;
      if(!groundVisible && !visible(r,x,y,85,halfW)) continue;
      const d=getTile(world,tx,ty);
      if(groundVisible) {
        const rm=d.road?connections(world,d,'road'):0,
          wm=d.river?connections(world,d,'river'):0,
          sm=d.water?0:waterEdges(world,d),
          key=[d.biome,d.variant,d.band,d.road?rm+1:0,d.river?wm+1:0,sm,d.bridge?1:0,d.kind].join('/');
        const draw=(local,ctx)=>floorArt(local,ctx,d,rm,wm,sm);
        paintStamp(r,g,stamp(r,key,draw),tx*T,ty*T,draw); visibleTiles++;
        if(d.bridge) bridges.push({x:tx*T,y:ty*T,mask:rm});
        if((d.water||d.river) && !d.bridge && d.n<.22 && glints.length<LIMITS.waterGlints)
          glints.push(d);
      }
      const dist=(tx-cx)*(tx-cx)+(ty-cy)*(ty-cy);
      let prop='',priority=dist,height=0;
      if(options.drawFeatures!==false && ['camp','town','relay','sanctuary','vault','ruins'].includes(d.kind))
        {prop='site';priority=dist-4096;height=60;}
      else if(!d.road && !d.river && !d.water && !d.kind) {
        if(d.biome==='mountain') {prop='mountain';height=32+d.height*31+d.n*13;}
        else if(d.biome==='forest' && d.n<.66 || d.biome==='grassland' && d.n<.055 || d.biome==='tundra' && d.n<.075)
          {prop='tree';height=40;}
        else if(d.n>.89 && ['marsh','desert','tundra','coast'].includes(d.biome))
          {prop='small';priority=dist+400;height=12;}
      }
      // Do not let off-screen short props consume the budget reserved by the
      // generous mountain cull above. Selection is by distance, never row order.
      if(prop && visible(r,x,y,height,halfW)) props.push({d,kind:prop,priority});
    }
    for(const b of bridges) {
      const draw=(local,ctx)=>bridgeArt(local,ctx,b.mask);
      paintStamp(r,g,stamp(r,'bridge/'+b.mask,draw),b.x,b.y,draw);
    }
    const phase=Math.floor(time*5)/5;
    for(const d of glints) {
      const offset=d.water?Math.sin(phase*.7+d.n*18)*4:0,
        x=(d.x+.5)*T+offset,y=(d.y+.5)*T+(d.water?(d.n-.5)*12:0);
      ln(r,g,[x-2,y,0],[x+2+Math.sin(phase+d.n*29),y,0],d.n<.08?'#91bdb2':'#4c8b92');
    }
    props.sort((a,b)=>a.priority-b.priority);
    const count=Math.min(maxProps,props.length);
    for(let i=0;i<count;i++) {
      const {d,kind}=props[i];
      if(kind==='site') {
        if(drawSite(r,d.kind,(d.x+.5)*T,(d.y+.5)*T,time,
          {z:elevation(d.source),feature:d.feature,visited:options.visited})) siteCount++;
      } else if(kind==='mountain') mountain(r,d);
      else if(kind==='tree') tree(r,d,d.biome==='tundra'||d.n<.25);
      else smallProp(r,d);
    }
    if(typeof options.drawPlayer==='function') options.drawPlayer(r,player);
    const under=getTile(world,cx,cy);
    return {tiles:visibleTiles,props:count,sites:siteCount,waterGlints:glints.length,
      radius:rad,tileX:cx,tileY:cy,groundZ:elevation(under.source),
      tileCache:tiles.size,textureCache:textures.size,texturePixels};
  }
  function clearCache(world) {
    if(!world || world===currentWorld) { tiles.clear();currentWorld=null;currentRevision=undefined; }
    if(!world) { textures.clear();texturePixels=0;projection=''; }
  }
  root.EWFrontierArt=Object.freeze({render,drawSite,elevation,clearCache,
    TILE_SIZE:T,LIMITS,palette:P});
})(typeof window!=='undefined'?window:globalThis);
