/* Tidebell — original pixel art, authored for the My3D2dge pixel renderer.
 * No external assets, fonts, or drawing libraries are required.
 *
 * TideArt.drawProp(g, x, y, type, seed=0, t=0, opts={})
 *   Foot anchor, in buffer pixels. opts.open for chests; opts.lit and
 *   opts.color for shrines. t is elapsed time in seconds.
 * TideArt.enemy(g, x, y, type, t=0, scale=1, opts={})
 *   Foot anchor. Types: wisp, bramble, sentinel, boss. opts.hurt is 0..1.
 * TideArt.portrait(g, x, y, id, size=64)
 *   Top-left anchor. IDs: orin, mira, fen, ferryman.
 * TideArt.terrain(g, x, y, type, seed=0, t=0)
 *   Top-left anchor of one 16 x 16 tile. Types: grass, path, water,
 *   deepwater, stone, floor, wood, sand.
 * All visible marks use the engine's crisp pixel primitives.
 */
(function () {
  'use strict';
  const PX = () => window.My3D2dge.px;
  const C = Object.freeze({
    ink: '#10252c', deep: '#142e34', night: '#142735', navy: '#173746',
    water: '#214657', wave: '#3b6873', foam: '#89b6aa',
    forest0: '#173b3c', forest1: '#22504a', forest2: '#2d6457',
    forest3: '#437967', forest4: '#64927a', leaf: '#9cb38b',
    bark0: '#263b39', bark1: '#475246', bark2: '#687158',
    stone0: '#283e44', stone1: '#49605e', stone2: '#6c7b6d',
    stone3: '#9b9d7e', stone4: '#b6b499', moss: '#648265',
    bronze0: '#584a37', bronze1: '#967040', bronze2: '#c09651',
    gold: '#e7bd6e', light: '#f7dda1', ivory: '#e0dbc0',
    aqua0: '#245961', aqua1: '#4d9390', aqua2: '#86cfbd',
    aqua3: '#c1edcf', purple: '#7d799a', red: '#b66c5a'
  });
  function hash(seed, n) {
    let v = Math.imul((seed | 0) ^ Math.imul(n + 17, 374761393), 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  }
  const R = (g, x, y, w, h, c) => PX().rect(g, x, y, w, h, c);
  const P = (g, points, c) => PX().poly(g, points, c);
  const L = (g, x1, y1, x2, y2, c, w = 1) => PX().line(g, x1, y1, x2, y2, c, w);
  const D = (g, x, y, r, c) => PX().disc(g, x, y, r, c);
  const E = (g, x, y, rx, ry, c) => PX().ell(g, x, y, rx, ry, c);
  function alpha(g, a, fn) {
    PX().blend(g, a, 'normal', fn);
  }
  function at(g, x, y, scale, fn) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (scale !== 1) g.scale(scale, scale);
    PX().reset(g);
    fn();
    g.restore();
    PX().reset(g);
  }
  function shadow(g, x, y, rx, ry, a = .3) {
    alpha(g, a, () => E(g, x, y, rx, ry, '#081c25'));
  }
  function glow(g, x, y, r, c, strength = .14) {
    alpha(g, strength, () => D(g, x, y, r, c));
    alpha(g, strength, () => D(g, x, y, r * .66, c));
  }
  function flecks(g, seed, x, y, w, h, n, colors) {
    for (let i = 0; i < n; i++) {
      const xx = x + (hash(seed, i * 3) * w | 0);
      const yy = y + (hash(seed, i * 3 + 1) * h | 0);
      R(g, xx, yy, hash(seed, i * 3 + 2) > .55 ? 2 : 1, 1,
        colors[i % colors.length]);
    }
  }
  function leafClump(g, x, y, w, h, color) {
    P(g, [[x - w, y], [x - w, y - h * .34], [x - w * .76, y - h * .34],
      [x - w * .76, y - h * .67], [x - w * .38, y - h * .67],
      [x - w * .38, y - h], [x + w * .25, y - h],
      [x + w * .25, y - h * .83], [x + w * .68, y - h * .83],
      [x + w * .68, y - h * .48], [x + w, y - h * .48],
      [x + w, y], [x + w * .62, y], [x + w * .62, y + h * .2],
      [x - w * .45, y + h * .2], [x - w * .45, y]], color);
  }
  function rune(g, x, y, color, s = 1, variant = 0) {
    const shapes = [
      [[0,0],[3,0],[3,4],[6,4],[6,7],[3,10],[3,13],[0,13]],
      [[0,0],[6,0],[3,3],[3,12],[0,9],[6,9]],
      [[3,0],[0,3],[0,6],[6,6],[6,9],[3,12],[3,0]]
    ];
    const a = shapes[(((variant | 0) % 3) + 3) % 3];
    for (let i = 1; i < a.length; i++)
      L(g, x + a[i-1][0]*s, y + a[i-1][1]*s,
        x + a[i][0]*s, y + a[i][1]*s, color, Math.max(1, s | 0));
  }
  function tree(g, seed, t) {
    shadow(g, 0, -1, 24, 7, .24);
    P(g, [[-8,0],[-4,-9],[-5,-36],[4,-42],[8,-33],[5,-9],[12,-1],[3,-3],[0,1]], C.bark0);
    P(g, [[-3,-1],[-1,-32],[3,-38],[5,-31],[2,-5],[6,-1]], C.bark1);
    L(g, 0,-6,1,-30,C.bark2);
    L(g, -3,-22,-13,-36,C.bark1,3);
    L(g, 3,-24,14,-38,C.bark0,3);
    P(g, [[-29,-31],[-29,-46],[-24,-46],[-24,-58],[-16,-58],[-16,-66],
      [-8,-66],[-8,-73],[5,-73],[5,-69],[16,-69],[16,-61],[24,-61],
      [24,-51],[29,-51],[29,-33],[23,-33],[23,-23],[12,-23],[12,-18],
      [-7,-18],[-7,-22],[-20,-22],[-20,-31]], C.forest0);
    const clumps = [[0,-55,17,17],[-13,-47,14,17],[14,-43,14,19],
      [-22,-33,10,13],[-7,-30,17,19],[15,-25,11,15],[0,-20,12,12]];
    for (let i=0;i<clumps.length;i++) {
      const [x,y,w,h] = clumps[i];
      leafClump(g,x,y,w,h,C.forest1);
      leafClump(g,x-2,y-4,w-2,h-4,i<3?C.forest2:C.forest2);
      P(g, [[x-w+3,y-h*.35-3],[x-w+3,y-h*.59-3],[x-w*.36,y-h*.59-3],
        [x-w*.36,y-h+1],[x+w*.18,y-h+1],[x+w*.18,y-h*.78],
        [x+w*.52,y-h*.78],[x+w*.52,y-h*.49],[x,y-h*.49],[x,y-h*.27]], C.forest3);
      for(let j=0;j<7;j++) {
        let xx=x+(hash(seed+i*119,j*3)-.5)*(w*1.48);
        let yy=y-h*.72+hash(seed+i*119,j*3+1)*(h*.59);
        R(g,xx,yy,2+Math.floor(hash(seed,j+i*9)*3),1,j<3?C.forest4:C.forest1);
      }
    }
    R(g,-4,-70,7,1,C.forest4);
    R(g,-17,-53,6,1,C.forest4);
    R(g,-23,-40,5,1,C.forest4);
    L(g, -7,-1,-10,-4,C.forest2);
    R(g,6,-4,3,2,C.forest2);
    if(hash(seed,91)>.75) { R(g,7,-7,2,3,C.bronze1); R(g,6,-8,4,2,C.gold); }
  }
  function pine(g, seed) {
    shadow(g,0,-1,20,6,.25);
    P(g,[[-6,0],[-3,-10],[-3,-35],[4,-35],[3,-9],[7,0]],C.bark0);
    R(g,-1,-20,2,19,C.bark1);
    const tiers=[[-61,11,18],[-48,16,24],[-34,22,28],[-22,24,26]];
    for(let i=tiers.length-1;i>=0;i--) {
      const [y,w,h]=tiers[i];
      P(g,[[0,y-h],[4,y-h+10],[8,y-h+10],[7,y-h+14],[w-5,y-7],
        [w-7,y-7],[w,y],[9,y-2],[11,y+2],[0,y],[0,y+4],[-9,y+2],
        [-w,y],[-w+6,y-8],[-w+4,y-8],[-8,y-h+12],[-5,y-h+12]],C.forest0);
      P(g,[[0,y-h+3],[-2,y-h+14],[-w+8,y-7],[-w+6,y-3],[-5,y-1],
        [0,y-5],[8,y-2],[w-7,y-3],[w-11,y-10],[4,y-h+11]],C.forest2);
      P(g,[[0,y-h+5],[-2,y-h+16],[-w+8,y-5],[-7,y-6],[-1,y-12],
        [5,y-10],[1,y-17]],C.forest3);
      L(g,-w+8,y-4,-7,y-5,C.forest4);
      L(g,2,y-6,w-7,y-3,C.forest1);
    }
    flecks(g,seed,-11,-44,20,27,8,[C.forest1,C.forest4]);
  }
  function bush(g,seed) {
    shadow(g,0,-1,14,4,.22);
    leafClump(g,0,-5,15,12,C.forest0);
    leafClump(g,-5,-6,9,12,C.forest2);
    leafClump(g,6,-3,9,11,C.forest2);
    leafClump(g,-6,-9,6,6,C.forest3);
    leafClump(g,5,-7,6,5,C.forest3);
    flecks(g,seed,-10,-13,21,10,12,[C.forest4,C.forest1]);
    if(hash(seed,80)>.55) {
      R(g,-7,-9,2,2,C.red); R(g,3,-6,2,2,C.red); R(g,8,-9,2,2,C.bronze2);
    }
  }
  function rock(g,seed) {
    shadow(g,0,0,14,4,.25);
    P(g,[[-14,-2],[-12,-10],[-6,-17],[5,-18],[12,-11],[14,-3],[9,1],[-6,1]],C.stone0);
    P(g,[[-12,-5],[-10,-10],[-5,-15],[5,-16],[9,-11],[7,-5],[-2,-3]],C.stone2);
    P(g,[[7,-5],[10,-11],[12,-8],[12,-3],[6,-1],[-5,-1],[-3,-3]],C.stone1);
    P(g,[[-10,-10],[-5,-15],[4,-16],[1,-13],[-4,-12],[-7,-7]],C.stone3);
    L(g,2,-14,4,-9,C.stone1); L(g,4,-9,1,-6,C.stone1);
    R(g,-7,-2,7,2,C.moss); R(g,-12,-6,3,3,C.forest2);
    flecks(g,seed,-7,-12,13,9,6,[C.stone1,C.stone3]);
  }
  function flowers(g,seed,t) {
    for(let i=0;i<6;i++) {
      const x=Math.floor(hash(seed,i*3)*22)-11,y=-Math.floor(hash(seed,i*3+1)*6);
      const h=3+Math.floor(hash(seed,i*3+2)*5), dx=Math.sin(t*1.3+i)*.65;
      L(g,x,y,x+dx,y-h,C.forest3);
      R(g,x-2,y-2,2,1,C.forest2);
      const color=i%3===0?C.gold:i%3===1?'#b6b7c8':C.ivory;
      R(g,x-1+dx,y-h-1,3,3,color);
      R(g,x+dx,y-h,1,1,C.bronze2);
    }
  }
  function lantern(g,seed,t,opts) {
    const lit=opts.lit!==false;
    shadow(g,0,0,10,3,.22);
    R(g,-2,-34,4,33,C.stone0); R(g,-1,-34,1,32,C.stone2);
    P(g,[[-5,0],[-4,-4],[4,-4],[6,0]],C.stone1);
    L(g,0,-33,10,-33,C.stone0,3); R(g,9,-33,2,4,C.bronze1);
    if(lit)glow(g,10,-24,21,C.gold,.07+.02*Math.sin(t*4+seed));
    P(g,[[6,-30],[14,-30],[17,-27],[3,-27]],C.bronze0);
    R(g,5,-27,10,11,C.bronze0);
    R(g,7,-26,6,8,lit?C.gold:C.stone1);
    if(lit) { R(g,8,-25,3,6,C.light); R(g,9,-23,2,3,'#fff4c9'); }
    R(g,5,-16,10,2,C.bronze1); R(g,8,-14,4,2,C.bronze0);
    R(g,10,-27,1,11,C.bronze1); R(g,7,-30,6,1,C.bronze2);
  }
  function chest(g,seed,t,opts) {
    shadow(g,0,0,16,4,.25);
    const open=!!opts.open;
    R(g,-14,-13,28,13,C.ink); R(g,-12,-12,24,11,C.bronze0);
    R(g,-11,-11,22,8,'#715541');
    R(g,-11,-8,22,1,'#9a774f'); R(g,-11,-3,22,1,'#483e33');
    R(g,-9,-11,3,10,C.bronze1); R(g,6,-11,3,10,C.bronze1);
    R(g,-9,-11,1,10,C.bronze2); R(g,6,-11,1,10,C.bronze2);
    if(open) {
      P(g,[[-14,-13],[-14,-27],[-11,-30],[11,-30],[14,-27],[14,-13]],C.ink);
      R(g,-12,-27,24,12,C.bronze1); R(g,-10,-25,20,9,C.bronze0);
      R(g,-9,-28,3,14,C.bronze2); R(g,6,-28,3,14,C.bronze2);
      R(g,-12,-14,24,4,C.ink); R(g,-10,-12,20,2,'#282e2b');
      R(g,-8,-11,3,1,C.bronze1);
    } else {
      P(g,[[-14,-12],[-14,-17],[-10,-22],[10,-22],[14,-17],[14,-12]],C.ink);
      P(g,[[-12,-13],[-12,-17],[-9,-20],[9,-20],[12,-17],[12,-13]],'#916b45');
      R(g,-8,-20,16,2,'#b18a55'); R(g,-12,-14,24,2,C.bronze0);
      R(g,-9,-20,3,8,C.bronze2); R(g,6,-20,3,8,C.bronze2);
      R(g,-9,-20,1,7,C.gold); R(g,6,-20,1,7,C.gold);
      R(g,-3,-15,6,7,C.bronze0); R(g,-2,-14,4,5,C.gold);
      R(g,0,-13,1,3,C.bronze0);
    }
    R(g,-12,-1,24,1,C.bronze0); R(g,-11,-1,3,2,C.ink); R(g,8,-1,3,2,C.ink);
  }
  function shrine(g,seed,t,opts) {
    const lit=!!opts.lit, col=opts.color||C.aqua2;
    shadow(g,0,0,16,5,.3);
    P(g,[[-15,0],[-15,-5],[-10,-9],[10,-9],[15,-5],[15,0]],C.stone0);
    R(g,-12,-5,24,4,C.stone1); R(g,-10,-8,20,3,C.stone2);
    P(g,[[-9,-9],[-9,-39],[-5,-48],[5,-48],[9,-39],[9,-9]],C.stone0);
    P(g,[[-7,-10],[-7,-38],[-4,-45],[4,-45],[6,-39],[6,-10]],C.stone2);
    P(g,[[3,-45],[6,-39],[6,-10],[2,-10],[1,-39]],C.stone1);
    L(g,-6,-36,-4,-42,C.stone3); R(g,-6,-36,1,23,C.stone3);
    R(g,-4,-37,8,19,C.stone0); R(g,-3,-36,6,17,'#314c50');
    if(lit)glow(g,0,-28,21,col,.1);
    rune(g,-3,-35,lit?col:C.stone1,1,seed%3);
    R(g,-5,-16,10,1,lit?C.bronze2:C.stone3);
    R(g,-8,-11,4,3,C.moss); R(g,5,-13,3,5,C.forest2);
    L(g,4,-39,2,-34,C.stone0); L(g,4,-18,6,-14,C.stone0);
    if(lit) {
      const bob=Math.round(Math.sin(t*2)*2);
      P(g,[[0,-58+bob],[3,-54+bob],[0,-50+bob],[-3,-54+bob]],col);
      R(g,0,-55+bob,1,2,C.aqua3);
      for(let i=0;i<3;i++){const yy=-14-((t*8+i*13)%30);R(g,-13+i*12,yy,1,2,col);}
    }
  }
  function masonry(g,x,y,w,h,seed) {
    R(g,x,y,w,h,C.stone1);
    R(g,x,y,w,2,C.stone3); R(g,x,y,2,h,C.stone2);
    R(g,x+w-2,y,2,h,C.stone0); R(g,x,y+h-2,w,2,C.stone0);
    for(let row=1;row<Math.ceil(h/11);row++) {
      const yy=y+row*11;
      L(g,x+2,yy,x+w-3,yy,C.stone0);
      L(g,x+2,yy+1,x+w-3,yy+1,C.stone2);
      const xx=x+Math.floor(w*(row%2?.35:.7));
      L(g,xx,yy-9,xx,yy-1,C.stone0);
    }
    flecks(g,seed,x+3,y+4,w-6,h-7,Math.floor(w*h/75),[C.stone0,C.stone2,C.moss]);
  }
  function arch(g,seed,t,opts) {
    shadow(g,0,0,54,10,.27);
    P(g,[[-50,0],[-50,-10],[-44,-10],[-44,-58],[-39,-58],[-39,-69],[-28,-69],
      [-28,-78],[-15,-78],[-15,-83],[17,-83],[17,-78],[31,-78],[31,-68],
      [40,-68],[40,-56],[46,-56],[46,-9],[51,-9],[51,0],[26,0],[26,-52],
      [22,-52],[22,-59],[13,-59],[13,-64],[-13,-64],[-13,-59],[-22,-59],
      [-22,-51],[-26,-51],[-26,0]],C.stone0);
    masonry(g,-43,-54,17,49,seed+1); masonry(g,27,-54,17,49,seed+2);
    P(g,[[-43,-57],[-37,-57],[-37,-67],[-26,-67],[-26,-76],[-13,-76],
      [-13,-80],[15,-80],[15,-76],[29,-76],[29,-66],[38,-66],[38,-56],
      [28,-56],[24,-56],[24,-61],[15,-61],[15,-67],[-15,-67],[-15,-61],[-24,-61],[-24,-56]],C.stone2);
    L(g,-35,-65,-26,-64,C.stone0); L(g,-25,-74,-19,-68,C.stone0);
    L(g,-12,-77,-10,-68,C.stone0); L(g,13,-78,11,-68,C.stone0);
    L(g,27,-73,22,-65,C.stone0); L(g,35,-64,29,-59,C.stone0);
    L(g,-35,-67,-27,-67,C.stone3); L(g,-25,-76,-13,-76,C.stone3);
    R(g,-11,-80,24,2,C.stone3);
    masonry(g,-49,-8,26,8,seed+3); masonry(g,23,-8,27,8,seed+4);
    masonry(g,-46,-58,23,6,seed+6); masonry(g,24,-58,22,6,seed+7);
    P(g,[[-8,-80],[-8,-70],[-3,-65],[3,-65],[8,-70],[8,-80]],C.stone0);
    P(g,[[-6,-79],[-6,-71],[-2,-67],[2,-67],[6,-71],[6,-79]],C.bronze1);
    P(g,[[-2,-76],[-3,-71],[-5,-69],[5,-69],[3,-71],[2,-76]],C.gold);
    R(g,0,-68,1,2,C.gold);
    L(g,-33,-45,-37,-36,C.stone0); L(g,-37,-36,-33,-29,C.stone0);
    L(g,36,-24,31,-19,C.stone0); L(g,31,-19,34,-11,C.stone0);
    leafClump(g,-27,-73,12,5,C.forest2); leafClump(g,-33,-68,7,6,C.moss);
    L(g,-35,-69,-39,-52,C.forest2,2); L(g,-38,-57,-34,-53,C.forest3,2);
    leafClump(g,33,-49,7,6,C.forest2); L(g,38,-51,40,-28,C.forest2,2);
    R(g,38,-39,4,2,C.moss); R(g,39,-31,3,2,C.forest3);
    R(g,-46,-6,5,3,C.forest2); R(g,43,-4,5,4,C.forest2);
    if(opts.lit)glow(g,0,-72,20,C.gold,.08);
  }
  function column(g,seed) {
    shadow(g,0,0,17,4,.28);
    masonry(g,-13,-7,26,7,seed);
    P(g,[[-9,-7],[-9,-48],[-5,-53],[0,-49],[3,-55],[8,-52],[9,-7]],C.stone0);
    P(g,[[-7,-7],[-7,-47],[-4,-50],[0,-47],[4,-52],[7,-50],[7,-7]],C.stone1);
    R(g,-6,-43,3,34,C.stone2); R(g,1,-47,2,39,C.stone2);
    L(g,-3,-41,-3,-16,C.stone3);
    R(g,-8,-14,16,3,C.stone0); R(g,-7,-15,14,2,C.stone3);
    L(g,5,-36,0,-30,C.stone0); L(g,0,-30,2,-23,C.stone0);
    leafClump(g,4,-44,8,6,C.forest2); R(g,7,-43,2,11,C.forest2);
    R(g,-9,-9,7,3,C.moss); flecks(g,seed,-6,-45,12,29,6,[C.stone0,C.stone2]);
  }
  function bellBody(g,x,y,s,colored=true,t=0) {
    at(g,x,y,s,()=>{
      P(g,[[-25,0],[-25,-6],[-19,-11],[-15,-22],[-13,-43],[-9,-51],
        [-4,-53],[-4,-58],[4,-58],[4,-53],[10,-50],[14,-42],[16,-22],
        [20,-11],[25,-6],[25,0]],C.ink);
      P(g,[[-22,-3],[-21,-7],[-16,-11],[-12,-24],[-11,-42],[-7,-49],
        [-3,-51],[3,-51],[8,-48],[11,-41],[13,-23],[17,-10],[22,-6],[22,-3]],C.bronze1);
      P(g,[[-20,-5],[-15,-12],[-11,-25],[-10,-41],[-7,-47],[-3,-49],
        [0,-47],[-3,-39],[-4,-22],[-6,-11],[-9,-5]],C.bronze2);
      P(g,[[-9,-40],[-6,-46],[-4,-46],[-6,-37],[-7,-25],[-8,-20],[-10,-20]],C.gold);
      P(g,[[5,-46],[9,-40],[11,-23],[15,-10],[7,-10],[3,-22],[2,-37]],C.bronze0);
      R(g,-23,-5,46,3,C.bronze0); R(g,-22,-6,44,1,C.gold);
      R(g,-14,-15,29,2,C.bronze0); R(g,-13,-16,26,1,C.gold);
      R(g,-9,-39,19,2,C.bronze0); R(g,-9,-40,17,1,C.bronze2);
      R(g,-3,-56,6,4,C.bronze2);
      E(g,0,1,21,4,C.ink); E(g,0,1,18,2,C.bronze0);
      R(g,-2,-1,4,8,C.bronze1); E(g,0,7,4,3,C.bronze2); R(g,-2,6,2,1,C.gold);
      if(colored) {
        P(g,[[6,-35],[11,-34],[12,-24],[9,-27],[8,-21],[5,-24]],C.aqua0);
        R(g,9,-31,2,5,C.aqua1); R(g,11,-20,2,3,C.forest2);
        rune(g,-3,-32,C.aqua2,1,1);
        L(g,-18,-10,-14,-13,C.aqua1);
      }
    });
  }
  function bell(g,seed,t,opts) {
    shadow(g,0,2,45,11,.3);
    masonry(g,-47,-6,94,8,seed);
    masonry(g,-39,-93,12,87,seed+1); masonry(g,27,-93,12,87,seed+2);
    masonry(g,-43,-97,86,12,seed+3);
    R(g,-5,-96,10,19,C.stone0); R(g,-3,-96,6,18,C.bronze1);
    R(g,-3,-94,1,15,C.bronze2);
    const bob=Math.sin(t*.8)*.5;
    if(opts.lit!==false)glow(g,0,-45,52,C.aqua1,.055);
    bellBody(g,0,-12+bob,1.22,true,t);
    P(g,[[-47,-97],[-41,-105],[-26,-108],[-10,-111],[11,-111],[26,-108],[42,-104],[47,-97]],C.stone0);
    P(g,[[-42,-98],[-38,-103],[-26,-105],[26,-105],[38,-102],[42,-98]],C.stone2);
    leafClump(g,-27,-93,13,8,C.forest2); leafClump(g,32,-86,8,8,C.forest2);
    R(g,-35,-89,2,16,C.forest2); R(g,35,-85,2,26,C.forest2);
    R(g,32,-69,4,2,C.moss); R(g,-33,-81,3,3,C.moss);
    R(g,-38,-9,6,3,C.moss); R(g,31,-7,9,3,C.forest2);
    if(opts.lit!==false){R(g,-43,-18,2,2,C.aqua2);R(g,43,-29,1,2,C.aqua2);}
  }
  function boat(g,seed,t) {
    const bob=Math.round(Math.sin(t*1.5)*1);
    alpha(g,.28,()=>E(g,0,1,28,6,C.navy));
    L(g,-26,2,26,2,C.wave); L(g,-19,5,19,5,C.wave);
    at(g,0,bob,1,()=>{
      P(g,[[-29,-10],[-23,-20],[-12,-24],[16,-23],[27,-17],[31,-10],
        [26,-3],[16,0],[-15,0],[-26,-4]],C.ink);
      P(g,[[-26,-10],[-21,-18],[-11,-21],[16,-20],[25,-16],[28,-10],
        [23,-5],[14,-2],[-14,-2],[-23,-6]],C.bronze1);
      P(g,[[-23,-11],[-18,-16],[-9,-19],[14,-18],[22,-14],[24,-10],
        [18,-7],[-15,-6]],C.bronze0);
      P(g,[[-18,-11],[-13,-15],[13,-15],[19,-11],[14,-8],[-12,-8]],'#403e36');
      R(g,-14,-17,4,10,C.bronze1); R(g,7,-18,4,10,C.bronze1);
      R(g,-14,-17,3,1,C.bronze2); R(g,7,-18,3,1,C.bronze2);
      L(g,-24,-7,-13,-3,C.bronze2); L(g,-13,-3,14,-3,C.bronze2);
      L(g,14,-3,24,-7,C.bronze2);
      L(g,-11,-24,18,-1,C.bark0,3); L(g,-12,-25,17,-2,C.bronze2);
      P(g,[[15,-4],[20,-3],[26,2],[23,5],[18,2]],C.bronze1);
      L(g,-26,-10,-33,-5,C.stone3);
    });
  }
  function sign(g,seed) {
    shadow(g,0,0,10,3,.2); R(g,-2,-25,4,25,C.bark0); R(g,-1,-24,1,23,C.bronze1);
    P(g,[[-13,-26],[11,-26],[15,-22],[11,-17],[-13,-17]],C.bark0);
    P(g,[[-11,-24],[10,-24],[12,-22],[10,-19],[-11,-19]],C.bronze1);
    R(g,-10,-24,20,1,C.bronze2); R(g,-8,-22,12,1,C.ivory);
    L(g,3,-24,6,-22,C.ivory); L(g,6,-22,3,-20,C.ivory);
    R(g,-10,-20,1,1,C.ink); R(g,8,-20,1,1,C.ink);
  }
  function fountain(g,seed,t,opts) {
    shadow(g,0,0,27,7,.25);
    E(g,0,-4,26,10,C.stone0); E(g,0,-7,25,9,C.stone2);
    R(g,-25,-8,50,4,C.stone1); E(g,0,-9,24,8,C.stone3);
    E(g,0,-10,20,6,C.stone0); E(g,0,-10,18,5,C.water);
    L(g,-14,-10,-6,-10,C.wave); L(g,8,-8,14,-8,C.aqua1);
    R(g,-4,-32,8,21,C.stone0); R(g,-3,-32,4,20,C.stone2);
    P(g,[[-5,-32],[-4,-39],[0,-43],[4,-39],[5,-32]],C.stone0);
    P(g,[[-3,-33],[-2,-38],[0,-40],[2,-38],[3,-33]],C.stone3);
    E(g,0,-30,13,4,C.stone0); E(g,0,-32,13,4,C.stone3);
    E(g,0,-33,10,2,C.water);
    for(let i=0;i<3;i++) {
      const xx=(i-1)*9;
      L(g,xx,-30,xx,-16,C.aqua1,2);
      R(g,xx,-29+((t*14+i*5)%13),1,5,C.aqua3);
      R(g,xx-2,-14+Math.sin(t*4+i),5,1,C.foam);
    }
    R(g,-22,-5,5,2,C.moss);R(g,14,-4,6,2,C.forest2);
    if(opts.lit)glow(g,0,-29,18,C.aqua2,.12);
  }
  function reeds(g,seed,t) {
    for(let i=0;i<7;i++) {
      const x=-9+hash(seed,i)*18,h=7+hash(seed,i+10)*12,lean=Math.sin(t+i)*1.5;
      L(g,x,0,x+lean,-h,C.forest2);
      L(g,x,-2,x+5,-h*.7,C.forest3);
      if(i%3===0)R(g,x+lean-1,-h-3,2,5,C.bronze0);
    }
  }
  function drawProp(g,x,y,type,seed=0,t=0,opts={}) {
    at(g,x,y,opts.scale||1,()=>{
      switch(type) {
        case 'tree':tree(g,seed,t);break;
        case 'pine':pine(g,seed);break;
        case 'bush':bush(g,seed);break;
        case 'rock':rock(g,seed);break;
        case 'flowers':flowers(g,seed,t);break;
        case 'lantern':lantern(g,seed,t,opts);break;
        case 'chest':chest(g,seed,t,opts);break;
        case 'shrine':shrine(g,seed,t,opts);break;
        case 'arch':arch(g,seed,t,opts);break;
        case 'column':column(g,seed);break;
        case 'bell':bell(g,seed,t,opts);break;
        case 'boat':boat(g,seed,t);break;
        case 'sign':sign(g,seed);break;
        case 'fountain':fountain(g,seed,t,opts);break;
        case 'reeds':reeds(g,seed,t);break;
        case 'mushroom':R(g,-1,-7,2,7,C.ivory);P(g,[[-6,-7],[-4,-11],[2,-12],[6,-8],[6,-6],[-6,-6]],C.red);R(g,-3,-10,2,1,C.ivory);R(g,2,-8,2,1,C.ivory);break;
        case 'lilies':E(g,0,-1,7,3,C.forest2);P(g,[[0,-1],[7,-3],[4,0]],C.water);R(g,-2,-3,3,2,C.ivory);break;
        case 'crystal':glow(g,0,-14,18,C.aqua2,.1);P(g,[[0,-29],[8,-19],[6,-4],[0,0],[-7,-5],[-6,-20]],C.aqua0);P(g,[[0,-27],[5,-19],[0,-3],[-4,-8],[-4,-19]],C.aqua2);L(g,0,-26,0,-6,C.aqua3);break;
      }
    });
  }
  function wisp(g,t,opts) {
    const b=Math.sin(t*2.8)*3;
    shadow(g,0,0,18,5,.3);
    at(g,0,b,1,()=>{
      glow(g,0,-31,29,C.aqua1,.12);
      P(g,[[-1,-61],[7,-51],[5,-46],[16,-40],[19,-30],[14,-18],
        [6,-13],[13,-8],[8,-3],[-3,-8],[-10,-4],[-11,-10],[-17,-15],
        [-12,-23],[-18,-28],[-17,-36],[-10,-43],[-11,-50],[-5,-48]],C.ink);
      P(g,[[0,-57],[5,-50],[2,-43],[13,-39],[15,-31],[12,-21],[4,-18],
        [2,-11],[8,-7],[-2,-11],[-9,-8],[-6,-14],[-13,-18],[-8,-23],
        [-14,-29],[-13,-35],[-7,-40],[-7,-47],[-3,-45]],C.aqua0);
      P(g,[[-2,-50],[0,-43],[-6,-37],[-10,-30],[-5,-22],[2,-23],
        [8,-30],[9,-38],[13,-32],[10,-23],[2,-19],[-4,-20],[-11,-25],
        [-12,-32],[-7,-40],[-5,-41]],C.aqua1);
      P(g,[[-5,-36],[-1,-40],[7,-37],[10,-32],[8,-27],[1,-24],[-6,-27],[-8,-32]],C.aqua2);
      P(g,[[-3,-35],[0,-38],[6,-36],[7,-32],[4,-30],[-2,-30]],C.aqua3);
      R(g,-4,-33,3,3,C.ink); R(g,4,-33,3,3,C.ink);
      R(g,-3,-33,1,1,C.light); R(g,5,-33,1,1,C.light);
      R(g,-1,-27,4,1,C.aqua0);
      L(g,-3,-20,1,-15,C.gold);L(g,1,-15,5,-20,C.gold);
      R(g,0,-19,2,3,C.bronze2);
    });
    for(let i=0;i<4;i++) {
      const a=t*.6+i*2.1,xx=Math.cos(a)*24,yy=-27+Math.sin(a*1.3)*24;
      R(g,xx,yy,2,2,i%2?C.aqua1:C.aqua2);
    }
  }
  function bramble(g,t,opts) {
    const b=Math.sin(t*1.9)*1.3;
    shadow(g,0,0,37,9,.3);
    const branches=[[-17,-53,-31,-76],[-12,-61,-13,-83],[16,-55,31,-71],[23,-47,40,-57]];
    for(let i=0;i<branches.length;i++){
      const [x,y,x2,y2]=branches[i];L(g,x,y+b,x2,y2+b,C.ink,5);L(g,x,y+b,x2,y2+b,C.bark1,3);
      L(g,x2,y2+b,x2+(i%2?-7:8),y2-8+b,C.bark1,3);
      L(g,x2,y2+b,x2+(i%2?6:-6),y2-12+b,C.bark1,2);
    }
    P(g,[[-27,-25],[-36,-17],[-42,-6],[-35,-2],[-26,-7],[-18,-4],[-8,0],
      [-2,-6],[5,-3],[14,0],[22,-5],[34,-1],[40,-6],[33,-19],[26,-28]],C.ink);
    P(g,[[-27,-22],[-33,-15],[-36,-7],[-32,-5],[-24,-10],[-16,-6],[-10,-3],
      [-6,-11],[3,-11],[12,-3],[20,-8],[31,-4],[35,-7],[29,-16],[23,-25]],C.bark1);
    L(g,-28,-16,-31,-8,C.bark2,2);L(g,-19,-14,-11,-6,C.bark2,2);
    L(g,22,-15,28,-8,C.bark2,2);L(g,6,-12,12,-7,C.bark2,2);
    at(g,0,b,1,()=>{
      P(g,[[-29,-20],[-31,-39],[-24,-59],[-15,-70],[2,-74],[20,-68],
        [30,-53],[33,-33],[26,-19],[8,-13],[-11,-15]],C.ink);
      P(g,[[-26,-23],[-27,-39],[-20,-57],[-13,-65],[2,-69],[18,-63],
        [25,-52],[28,-34],[23,-22],[7,-17],[-10,-19]],C.bark1);
      P(g,[[-19,-27],[-21,-42],[-14,-59],[-6,-65],[-2,-59],[-8,-42],
        [-8,-25],[-12,-20]],C.bark2);
      P(g,[[11,-63],[20,-53],[23,-38],[18,-24],[7,-20],[8,-37],[5,-48]],C.bark0);
      L(g,-16,-54,-18,-37,C.stone2,2);L(g,-18,-37,-13,-29,C.stone2);
      L(g,15,-52,17,-38,C.bark2,2);L(g,17,-38,12,-29,C.bark2,2);
      P(g,[[-18,-50],[-11,-56],[-2,-54],[2,-50],[8,-55],[19,-51],
        [20,-40],[12,-34],[1,-35],[-10,-33],[-19,-39]],C.bark0);
      P(g,[[-16,-49],[-10,-52],[-3,-50],[-3,-43],[-10,-40],[-16,-42]],C.ink);
      P(g,[[5,-49],[10,-52],[17,-49],[17,-42],[10,-40],[5,-43]],C.ink);
      R(g,-13,-48,7,4,C.gold);R(g,7,-48,7,4,C.gold);
      R(g,-11,-48,2,3,C.light);R(g,9,-48,2,3,C.light);
      P(g,[[-3,-41],[2,-44],[5,-38],[1,-35]],C.bronze1);
      P(g,[[-11,-30],[-5,-32],[0,-29],[6,-32],[13,-30],[7,-25],[-5,-25]],C.ink);
      R(g,-7,-30,3,3,C.stone3);R(g,6,-30,3,3,C.stone3);
      leafClump(g,-13,-59,16,15,C.forest1);leafClump(g,8,-65,16,12,C.forest2);
      leafClump(g,-18,-60,10,9,C.forest3);leafClump(g,10,-66,10,8,C.forest3);
      leafClump(g,25,-31,10,17,C.forest1);leafClump(g,28,-33,7,11,C.forest2);
      R(g,-17,-69,4,2,C.forest4);R(g,5,-73,6,2,C.forest4);
      P(g,[[-31,-41],[-43,-29],[-45,-17],[-40,-14],[-37,-22],[-28,-28]],C.ink);
      P(g,[[-31,-37],[-39,-28],[-41,-19],[-38,-22],[-27,-28]],C.bark1);
      L(g,-39,-22,-34,-20,C.bark2,2);
      P(g,[[29,-42],[40,-31],[44,-18],[39,-14],[33,-22],[26,-26]],C.ink);
      P(g,[[29,-38],[37,-29],[40,-20],[35,-23],[27,-28]],C.bark1);
      R(g,-7,-69,2,3,C.red);R(g,13,-73,3,2,C.red);
    });
  }
  function sentinel(g,t,opts) {
    const b=Math.sin(t*1.4)*1;
    shadow(g,0,0,37,8,.32);
    // The spear and shield make its role clear even at a small size.
    L(g,34,-2,34,-99,C.ink,5);L(g,33,-3,33,-99,C.bronze1,2);
    P(g,[[33,-116],[40,-101],[37,-92],[29,-92],[27,-101]],C.ink);
    P(g,[[33,-111],[37,-100],[34,-94],[30,-98]],C.stone3);
    L(g,33,-107,33,-97,C.aqua2);
    P(g,[[-21,-2],[-19,-25],[-6,-27],[-2,-4],[-5,0],[-22,0]],C.ink);
    P(g,[[4,-3],[6,-28],[20,-25],[23,-2],[23,1],[4,1]],C.ink);
    P(g,[[-18,-4],[-17,-23],[-8,-24],[-6,-3]],C.stone1);
    P(g,[[7,-3],[9,-24],[18,-23],[20,-3]],C.stone1);
    R(g,-18,-6,13,3,C.stone2);R(g,7,-5,14,3,C.stone2);
    L(g,-16,-22,-16,-10,C.stone3);L(g,10,-22,10,-9,C.stone2);
    at(g,0,b,1,()=>{
      P(g,[[-24,-75],[-31,-64],[-24,-49],[-21,-28],[-12,-20],[11,-21],
        [23,-30],[25,-51],[31,-65],[23,-76],[11,-80],[-13,-80]],C.ink);
      P(g,[[-19,-70],[-22,-57],[-18,-32],[-10,-25],[9,-25],[18,-32],
        [22,-56],[18,-71],[8,-76],[-9,-76]],C.stone1);
      P(g,[[-17,-68],[-9,-72],[0,-70],[0,-46],[-14,-44],[-18,-56]],C.stone2);
      P(g,[[1,-70],[13,-69],[18,-59],[14,-46],[1,-46]],C.stone0);
      L(g,-16,-66,-12,-53,C.stone3,2);L(g,-12,-53,-3,-50,C.stone3);
      R(g,-17,-43,33,5,C.bronze0); R(g,-16,-42,32,1,C.bronze2);
      R(g,-4,-43,8,6,C.bronze1);R(g,-2,-42,4,4,C.gold);
      P(g,[[-18,-38],[-13,-38],[-8,-24],[-20,-29]],C.stone2);
      P(g,[[-6,-37],[2,-37],[6,-25],[-5,-23]],C.stone2);
      P(g,[[6,-37],[16,-38],[20,-29],[10,-25]],C.stone1);
      P(g,[[-20,-76],[-30,-73],[-33,-63],[-26,-57],[-18,-62],[-15,-70]],C.ink);
      P(g,[[-21,-73],[-27,-70],[-29,-64],[-25,-61],[-19,-64],[-18,-69]],C.stone2);
      L(g,-27,-69,-22,-72,C.stone3,2);
      P(g,[[18,-76],[29,-72],[32,-63],[25,-57],[17,-62],[14,-69]],C.ink);
      P(g,[[19,-72],[26,-69],[28,-63],[24,-61],[18,-65]],C.stone1);
      P(g,[[26,-59],[31,-55],[31,-43],[36,-40],[38,-34],[32,-29],[27,-32],
        [24,-46],[21,-52]],C.ink);
      P(g,[[26,-54],[29,-51],[29,-40],[34,-38],[34,-33],[30,-33],[26,-43]],C.stone2);
      R(g,30,-39,7,6,C.stone1);L(g,32,-37,36,-37,C.stone3);
      // A split, weathered face plate; the inner light is the only living detail.
      P(g,[[-13,-76],[-17,-86],[-15,-101],[-7,-108],[8,-108],[16,-100],
        [17,-87],[12,-75],[3,-70],[-4,-71]],C.ink);
      P(g,[[-11,-78],[-13,-86],[-12,-99],[-6,-104],[7,-104],[12,-98],
        [13,-87],[9,-79],[2,-74],[-3,-75]],C.stone2);
      P(g,[[3,-104],[9,-102],[12,-96],[12,-86],[8,-78],[3,-76]],C.stone1);
      R(g,-13,-92,26,7,C.stone0);R(g,-10,-89,20,2,C.aqua2);
      R(g,-7,-90,7,1,C.aqua3);R(g,1,-90,7,1,C.aqua3);
      P(g,[[-2,-97],[3,-97],[4,-81],[1,-78],[-2,-81]],C.stone3);
      L(g,-10,-99,-6,-102,C.stone4);L(g,8,-83,5,-80,C.stone0);
      leafClump(g,-7,-101,12,7,C.forest2);R(g,-13,-99,3,11,C.forest2);
      R(g,-11,-105,6,1,C.moss);R(g,9,-65,3,7,C.forest2);
      rune(g,-3,-66,C.aqua2,1,0);
      // Broad shield, with a broken outer corner and a bell seal.
      P(g,[[-38,-64],[-19,-62],[-15,-48],[-16,-24],[-24,-15],[-36,-19],[-42,-30],[-42,-52]],C.ink);
      P(g,[[-36,-60],[-22,-59],[-19,-47],[-20,-27],[-25,-20],[-34,-23],[-38,-32],[-38,-51]],C.stone1);
      P(g,[[-35,-58],[-30,-58],[-30,-25],[-33,-26],[-36,-33]],C.stone2);
      L(g,-36,-55,-34,-58,C.stone3);L(g,-34,-58,-24,-57,C.stone3);
      L(g,-35,-30,-32,-25,C.stone3);
      R(g,-30,-54,2,26,C.bronze1);R(g,-37,-42,17,2,C.bronze1);
      P(g,[[-31,-48],[-26,-48],[-25,-41],[-22,-36],[-35,-36],[-32,-41]],C.bronze2);
      R(g,-29,-35,2,3,C.gold);R(g,-36,-53,2,2,C.bronze2);R(g,-23,-52,2,2,C.bronze2);
      L(g,-23,-33,-28,-29,C.stone0);L(g,-28,-29,-27,-24,C.stone0);
      R(g,-38,-29,3,7,C.forest2);
    });
  }
  function antler(g,side,t) {
    const pts=[[side*13,-109],[side*24,-119],[side*31,-130],[side*29,-144],
      [side*25,-149]];
    for(let i=1;i<pts.length;i++){L(g,...pts[i-1],...pts[i],C.ink,6);L(g,...pts[i-1],...pts[i],C.stone1,3);}
    const br=[[[side*25,-120],[side*42,-125],[side*47,-136]],
      [[side*29,-132],[side*40,-141],[side*40,-149]],
      [[side*38,-124],[side*50,-121],[side*56,-127]]];
    for(const a of br)for(let i=1;i<a.length;i++){L(g,...a[i-1],...a[i],C.ink,5);L(g,...a[i-1],...a[i],C.stone2,2);}
    L(g,side*20,-115,side*28,-126,C.stone3);
    R(g,side>0?39:-44,-126,4,3,C.moss);
    L(g,side*45,-123,side*43,-112,C.forest2,2);
  }
  function boss(g,t,opts) {
    const b=Math.sin(t*1.2)*1.8,hand=Math.sin(t*1.7)*2;
    shadow(g,0,0,58,12,.42);
    alpha(g,.35,()=>{
      E(g,0,-1,62,10,C.aqua0); E(g,0,-2,47,7,C.aqua1);
    });
    L(g,-54,0,-29,0,C.wave);L(g,28,2,52,2,C.aqua1);
    for(let i=0;i<3;i++) {
      const yy=-5+Math.sin(t*2+i*2)*2;
      L(g,-45+i*32,yy,-31+i*32,yy,C.foam);
    }
    // Tidal cloth joins the drowned limbs to the floor.
    P(g,[[-31,-49],[-45,-22],[-51,-9],[-40,-4],[-24,-7],[-15,-1],
      [-3,-5],[7,0],[18,-6],[30,-2],[43,-7],[52,-6],[44,-23],[29,-48]],C.ink);
    P(g,[[-29,-45],[-41,-21],[-46,-10],[-39,-7],[-27,-11],[-16,-5],[-3,-10],
      [8,-4],[18,-10],[30,-6],[43,-10],[37,-21],[28,-43]],C.aqua0);
    P(g,[[-21,-42],[-31,-14],[-25,-14],[-17,-8],[-11,-22],[-8,-43]],C.aqua1);
    P(g,[[8,-44],[13,-21],[12,-9],[18,-13],[27,-9],[24,-23],[22,-42]],C.aqua1);
    L(g,-25,-13,-21,-24,C.aqua2);L(g,21,-15,18,-26,C.aqua2);
    at(g,0,b,1,()=>{
      glow(g,0,-91,48,C.aqua1,.05);
      antler(g,-1,t);antler(g,1,t);
      // Back chains and cords hang below the temple armor.
      for(let side of [-1,1]){
        L(g,side*21,-90,side*34,-37,C.bronze0,3);
        for(let j=0;j<6;j++)R(g,side*(22+j*2.1)-1,-84+j*8,3,4,C.bronze1);
      }
      // Massive shoulder stones, each carved from a different broken arch.
      P(g,[[-25,-101],[-45,-103],[-57,-94],[-58,-82],[-48,-72],[-31,-75],[-21,-86]],C.ink);
      P(g,[[-28,-97],[-44,-99],[-53,-92],[-54,-83],[-46,-77],[-33,-79],[-25,-87]],C.stone1);
      P(g,[[-44,-97],[-32,-96],[-28,-90],[-37,-86],[-52,-86],[-51,-92]],C.stone2);
      L(g,-48,-95,-42,-97,C.stone3,2);L(g,-51,-84,-45,-80,C.stone3);
      P(g,[[24,-101],[44,-104],[57,-96],[61,-84],[52,-74],[34,-74],[22,-85]],C.ink);
      P(g,[[28,-97],[44,-100],[53,-93],[57,-85],[50,-79],[35,-78],[26,-86]],C.stone1);
      P(g,[[30,-96],[43,-98],[51,-92],[52,-88],[40,-89],[31,-86]],C.stone2);
      L(g,32,-96,43,-98,C.stone3,2);
      L(g,49,-94,45,-90,C.stone0);L(g,45,-90,49,-84,C.stone0);
      leafClump(g,-43,-91,15,11,C.forest2);leafClump(g,-47,-93,9,7,C.forest3);
      R(g,-56,-86,3,12,C.forest2);R(g,-53,-78,2,7,C.moss);
      leafClump(g,44,-96,13,8,C.forest2);R(g,52,-93,3,16,C.forest2);
      // Left arm: segmented stone and a hanging hand.
      at(g,0,hand,1,()=>{
        P(g,[[-48,-76],[-59,-70],[-64,-51],[-58,-40],[-46,-42],[-41,-56],[-39,-67]],C.ink);
        P(g,[[-49,-73],[-56,-68],[-60,-52],[-56,-45],[-48,-47],[-45,-57],[-43,-65]],C.stone1);
        P(g,[[-53,-67],[-49,-69],[-48,-58],[-53,-48],[-57,-52]],C.stone2);
        L(g,-58,-55,-47,-52,C.stone0,2);L(g,-57,-54,-47,-51,C.bronze1);
        P(g,[[-57,-44],[-46,-44],[-41,-32],[-42,-20],[-47,-16],[-49,-29],
          [-53,-17],[-58,-16],[-58,-30],[-62,-24],[-66,-26],[-63,-38]],C.ink);
        P(g,[[-56,-41],[-48,-40],[-45,-31],[-45,-23],[-48,-31],[-51,-32],
          [-55,-20],[-55,-32],[-59,-31],[-62,-28],[-59,-37]],C.stone1);
        R(g,-55,-40,6,3,C.stone3);L(g,-58,-35,-54,-36,C.stone2);
        rune(g,-55,-67,C.aqua2,.7,2);
      });
      // Right arm holds the clapper of a long-lost bell as a hammer.
      at(g,0,-hand,1,()=>{
        P(g,[[46,-77],[59,-71],[65,-57],[60,-43],[49,-43],[43,-56],[39,-67]],C.ink);
        P(g,[[47,-73],[56,-68],[61,-57],[57,-47],[51,-47],[47,-56],[43,-65]],C.stone1);
        P(g,[[47,-70],[52,-69],[55,-57],[52,-49],[48,-58]],C.stone2);
        L(g,49,-55,61,-55,C.bronze1,2);
        L(g,56,-51,68,-14,C.ink,7);L(g,56,-51,68,-14,C.bronze1,4);
        P(g,[[58,-20],[69,-25],[81,-19],[85,-6],[76,1],[63,-3]],C.ink);
        P(g,[[62,-18],[68,-21],[78,-16],[81,-7],[75,-3],[66,-6]],C.bronze1);
        P(g,[[62,-18],[68,-21],[76,-17],[71,-13],[64,-11]],C.bronze2);
        L(g,65,-17,68,-18,C.gold,2);R(g,76,-12,3,5,C.aqua0);
        P(g,[[51,-48],[59,-48],[64,-40],[61,-33],[53,-35],[49,-42]],C.ink);
        P(g,[[53,-45],[58,-45],[61,-40],[59,-37],[54,-38],[52,-42]],C.stone2);
        L(g,54,-43,59,-41,C.stone3);
      });
      // Torso silhouette is a bell: narrow crown, heavy flared bronze hem.
      P(g,[[-19,-99],[-30,-86],[-27,-66],[-29,-45],[-39,-29],[-40,-20],
        [-28,-15],[27,-15],[40,-21],[39,-30],[29,-44],[27,-67],[30,-85],[18,-99]],C.ink);
      P(g,[[-16,-95],[-26,-85],[-23,-67],[-25,-43],[-35,-27],[-35,-22],
        [-25,-19],[25,-19],[35,-23],[35,-27],[25,-42],[23,-67],[26,-84],[16,-95]],C.bronze0);
      P(g,[[-16,-92],[-22,-82],[-19,-65],[-21,-42],[-29,-28],[-29,-23],
        [-13,-23],[-8,-43],[-8,-71],[-5,-91]],C.bronze1);
      P(g,[[-16,-87],[-18,-82],[-15,-64],[-17,-42],[-23,-28],[-18,-26],
        [-12,-44],[-12,-72],[-10,-88]],C.bronze2);
      P(g,[[9,-92],[20,-85],[18,-66],[21,-42],[29,-28],[23,-23],[9,-27],[6,-48]],'#67573e');
      L(g,-31,-26,-22,-21,C.gold);L(g,-22,-21,25,-21,C.bronze2);
      L(g,25,-21,32,-24,C.bronze1);
      R(g,-24,-42,48,3,C.ink);R(g,-23,-43,46,2,C.bronze2);
      R(g,-25,-78,50,3,C.ink);R(g,-23,-79,46,1,C.bronze2);
      for(let i=0;i<5;i++) {
        R(g,-18+i*9,-40,2,7,C.bronze1);R(g,-17+i*9,-40,1,2,C.gold);
      }
      // Old tide marks remain on the metal and in the cut inscription.
      P(g,[[14,-73],[20,-70],[20,-57],[16,-61],[13,-52],[8,-57],[10,-67]],C.aqua0);
      R(g,15,-69,3,6,C.aqua1);R(g,18,-54,2,5,C.aqua1);
      L(g,-22,-33,-16,-35,C.aqua1,2);L(g,18,-28,24,-28,C.aqua0,2);
      rune(g,-4,-70,C.aqua2,1.5,1);
      R(g,-3,-64,2,6,C.aqua3);
      // Neck and crown are stone rather than bone.
      P(g,[[-13,-98],[-19,-109],[-17,-120],[-10,-128],[10,-128],
        [18,-120],[20,-109],[12,-96],[3,-89],[-4,-90]],C.ink);
      P(g,[[-10,-100],[-15,-110],[-13,-118],[-8,-124],[8,-124],
        [14,-117],[15,-109],[9,-99],[2,-93],[-3,-94]],C.stone2);
      P(g,[[2,-124],[9,-121],[14,-115],[14,-108],[8,-99],[2,-95]],C.stone1);
      P(g,[[-15,-116],[-6,-119],[0,-116],[7,-119],[16,-115],[14,-108],
        [7,-106],[0,-109],[-7,-106],[-14,-108]],C.stone0);
      L(g,-11,-113,-4,-112,C.aqua2,2);L(g,5,-112,12,-114,C.aqua2,2);
      R(g,-8,-113,3,1,C.aqua3);R(g,7,-114,3,1,C.aqua3);
      P(g,[[-2,-116],[2,-116],[4,-103],[0,-99],[-3,-103]],C.stone3);
      L(g,-9,-102,-5,-98,C.stone0);L(g,9,-103,6,-100,C.stone0);
      R(g,-5,-123,10,2,C.stone3);
      P(g,[[-8,-126],[-5,-137],[0,-142],[6,-135],[8,-126]],C.ink);
      P(g,[[-5,-127],[-3,-135],[0,-138],[3,-133],[5,-127]],C.bronze1);
      P(g,[[0,-135],[2,-131],[0,-128],[-2,-131]],C.aqua2);
      leafClump(g,-9,-122,9,5,C.forest2);R(g,-15,-120,2,9,C.forest2);
      // Two quiet orbiting tide marks replace an oversized particle cloud.
      for(let i=0;i<2;i++) {
        const a=t*.6+i*Math.PI,xx=Math.cos(a)*63,yy=-86+Math.sin(a)*15;
        alpha(g,.65,()=>rune(g,xx-2,yy,C.aqua2,.65,i));
      }
    });
  }
  function enemy(g,x,y,type,t=0,scale=1,opts={}) {
    at(g,x,y,scale,()=>{
      switch(type) {
        case 'wisp':wisp(g,t,opts);break;
        case 'bramble':bramble(g,t,opts);break;
        case 'sentinel':sentinel(g,t,opts);break;
        case 'boss':boss(g,t,opts);break;
        default:wisp(g,t,opts);
      }
    });
  }
  function portrait(g,x,y,id,size=64) {
    at(g,x,y,size/64,()=>{
      const mage=id==='mira',ranger=id==='fen',ferry=id==='ferryman';
      const bg=mage?['#263746','#2d4553','#355465']:ranger?['#253e39','#304c42','#3f5e49']:ferry?['#233c43','#30484e','#3d5557']:['#3f403a','#51483a','#69543e'];
      R(g,0,0,64,64,bg[0]);R(g,0,21,64,22,bg[1]);R(g,0,43,64,21,bg[2]);
      // A restrained diagonal ray gives each portrait a soft-lit painted field.
      P(g,[[0,0],[25,0],[0,40]],bg[1]);P(g,[[0,0],[9,0],[0,16]],bg[2]);
      flecks(g,id==='mira'?2:id==='fen'?3:1,3,3,58,56,20,[bg[0],bg[1],bg[2]]);
      const hair=mage?'#bbb5c4':ranger?'#8e513c':ferry?'#949c89':'#272d30';
      const hairDark=mage?'#6f748e':ranger?'#583a32':ferry?'#58665f':'#16252c';
      const hairLight=mage?'#dfd9d8':ranger?'#b8794c':ferry?'#bdc2a9':'#4a4540';
      const skin=mage?'#d7bdab':ranger?'#c79570':ferry?'#ac9e7e':'#cfa780';
      const skinDark=mage?'#9f8790':ranger?'#956749':ferry?'#6e7766':'#96765b';
      const skinLight=mage?'#efdbca':ranger?'#e7bd91':ferry?'#ccc1a0':'#e6c49a';
      const cloth=mage?'#54748a':ranger?'#4b6b52':ferry?'#476660':'#b2874e';
      const clothDark=mage?'#34495e':ranger?'#2a4a3c':ferry?'#2c4848':'#70553a';
      const clothLight=mage?'#7893a3':ranger?'#73936c':ferry?'#718b79':'#d6aa62';
      // Long hair sits behind shoulders and uses large quiet shapes.
      if(mage) {
        P(g,[[15,22],[18,10],[28,5],[41,7],[48,18],[48,35],[53,51],[45,59],
          [36,55],[24,60],[13,51],[17,37]],hairDark);
        P(g,[[18,20],[22,11],[28,8],[24,31],[21,43],[23,53],[17,50],[19,35]],hair);
        P(g,[[38,10],[45,20],[43,37],[47,49],[43,54],[39,48],[39,30]],hair);
      }
      P(g,[[4,64],[7,53],[19,47],[23,42],[40,42],[45,48],[58,55],[62,64]],C.ink);
      P(g,[[7,64],[10,55],[22,48],[25,43],[39,43],[43,49],[56,56],[59,64]],clothDark);
      P(g,[[9,63],[12,55],[24,49],[29,53],[24,64]],cloth);
      P(g,[[36,52],[42,49],[54,57],[57,64],[38,64]],cloth);
      P(g,[[12,55],[21,51],[25,52],[15,58],[13,64],[9,64]],clothLight);
      R(g,27,38,10,12,skinDark);R(g,28,39,7,9,skin);
      P(g,[[20,19],[25,12],[37,12],[43,19],[43,30],[39,41],[32,45],[26,43],
        [20,35],[18,28]],skinDark);
      P(g,[[22,20],[27,14],[36,14],[40,20],[40,32],[36,39],[31,42],
        [26,39],[22,33],[21,27]],skin);
      P(g,[[23,20],[27,16],[30,16],[28,25],[24,29],[24,34],[22,31]],skinLight);
      R(g,19,27,3,8,skinDark);R(g,20,28,2,4,skin);
      R(g,40,26,3,8,skinDark);R(g,40,28,2,4,skin);
      // Face uses single-pixel features to keep it clear at UI size.
      R(g,24,25,6,1,hairDark);R(g,34,25,5,1,hairDark);
      R(g,25,28,5,2,skinLight);R(g,34,28,5,2,skinLight);
      R(g,27,28,2,2,mage?'#607b92':ranger?'#537056':'#4c5a5b');
      R(g,35,28,2,2,mage?'#607b92':ranger?'#537056':'#4c5a5b');
      R(g,27,28,1,1,C.ink);R(g,35,28,1,1,C.ink);
      L(g,32,28,31,33,skinDark);R(g,32,33,2,1,skinLight);
      R(g,29,37,6,1,skinDark);R(g,30,38,4,1,skinLight);
      if(mage) {
        P(g,[[17,23],[19,14],[25,7],[34,6],[43,12],[46,21],[40,26],[39,18],
          [35,14],[30,19],[26,20],[23,28],[20,32]],hairDark);
        P(g,[[19,22],[21,15],[26,10],[33,8],[40,12],[42,17],[38,15],[34,12],
          [31,17],[27,18],[25,23],[22,27]],hair);
        L(g,23,17,28,12,hairLight,2);L(g,28,12,34,10,hairLight,2);
        P(g,[[41,19],[44,22],[44,32],[42,37],[40,39],[41,29]],hair);
        R(g,42,23,1,11,hairLight);
        L(g,22,21,28,22,C.stone3);L(g,28,22,34,20,C.stone3);L(g,34,20,40,20,C.stone3);
        P(g,[[32,19],[34,22],[32,25],[30,22]],C.aqua2);R(g,32,21,1,2,C.aqua3);
        P(g,[[22,47],[26,46],[32,52],[37,46],[42,48],[36,57],[30,56]],clothLight);
        P(g,[[30,54],[34,54],[35,60],[32,63],[29,60]],C.bronze0);
        P(g,[[32,55],[34,59],[32,61],[30,59]],C.aqua2);
        R(g,41,33,1,7,C.gold);R(g,40,39,3,2,C.aqua2);
      } else if(ranger) {
        P(g,[[18,27],[17,18],[20,11],[25,8],[33,6],[41,10],[45,17],[44,26],
          [40,30],[39,21],[34,18],[29,21],[25,19],[22,24],[21,31]],hairDark);
        P(g,[[20,20],[22,13],[28,10],[33,9],[39,12],[42,18],[38,21],[35,16],
          [29,18],[25,16]],hair);
        P(g,[[23,13],[29,10],[35,11],[31,13],[29,16],[26,14],[22,17]],hairLight);
        R(g,40,19,2,8,hair);R(g,21,23,2,6,hair);
        L(g,24,27,29,26,hairDark);R(g,36,26,3,1,hairDark);
        R(g,25,33,1,1,skinDark);R(g,27,34,1,1,skinDark);R(g,37,33,1,1,skinDark);
        R(g,19,33,3,4,C.bronze0);R(g,20,33,2,3,C.gold);R(g,21,33,1,2,skin);
        P(g,[[20,47],[25,44],[30,49],[38,45],[43,48],[37,55],[27,55]],clothLight);
        P(g,[[22,49],[29,52],[35,50],[32,58],[26,64],[23,59]],cloth);
        L(g,42,48,54,60,C.bronze0,4);L(g,42,48,53,60,C.bronze1,2);
        R(g,45,54,5,4,C.bronze2);R(g,46,55,3,2,C.bronze0);
      } else if(ferry) {
        P(g,[[13,31],[14,18],[20,8],[30,4],[40,8],[48,19],[50,39],[46,48],
          [40,46],[43,30],[40,19],[33,13],[24,17],[19,29],[21,43],[17,46]],clothDark);
        P(g,[[15,29],[17,18],[24,10],[30,7],[30,11],[23,16],[19,25],[18,39],[16,39]],cloth);
        P(g,[[36,10],[44,19],[47,36],[44,43],[44,28],[39,19]],cloth);
        L(g,19,20,25,13,clothLight,2);
        R(g,22,25,8,2,hairDark);R(g,34,25,7,2,hairDark);
        R(g,22,24,8,1,hair);R(g,34,24,7,1,hair);
        P(g,[[21,34],[25,35],[28,33],[32,35],[36,33],[41,33],[38,45],
          [33,51],[28,49],[23,43]],hairDark);
        P(g,[[23,35],[27,37],[30,35],[33,37],[37,35],[38,39],[34,47],
          [30,49],[26,43]],hair);
        R(g,29,38,7,1,hairDark);L(g,27,40,30,46,hairLight);L(g,34,41,33,46,hairLight);
        R(g,20,29,3,1,skinDark);R(g,38,30,3,1,skinDark);
        P(g,[[19,48],[25,46],[29,51],[35,50],[41,46],[47,50],[41,57],[24,56]],cloth);
        R(g,29,54,6,7,C.bronze0);R(g,30,55,4,5,C.bronze2);
      } else {
        P(g,[[18,29],[17,21],[18,14],[23,10],[27,6],[39,7],[44,13],[46,19],
          [43,27],[40,30],[39,22],[36,18],[31,21],[27,18],[22,24],[21,32]],hairDark);
        P(g,[[19,20],[21,14],[25,11],[29,8],[38,9],[42,14],[42,20],[38,19],
          [36,15],[32,19],[27,15],[24,18],[21,22]],hair);
        P(g,[[23,14],[29,10],[35,10],[33,12],[29,13],[29,16],[26,14]],hairLight);
        R(g,40,20,2,8,hair);R(g,21,24,2,6,hair);
        L(g,35,25,40,27,hairDark);L(g,24,26,29,25,hairDark);
        R(g,37,33,2,1,skinDark);L(g,38,33,39,35,skinDark);
        P(g,[[21,46],[26,44],[31,51],[38,45],[43,48],[37,56],[27,56]],clothLight);
        P(g,[[22,49],[28,51],[29,57],[24,61],[17,64],[12,64]],cloth);
        L(g,28,53,34,53,C.bronze0,3);R(g,30,51,5,5,C.bronze1);
        P(g,[[32,51],[34,53],[32,56],[30,53]],C.aqua2);R(g,32,52,1,2,C.aqua3);
        L(g,40,51,50,64,C.bronze0,3);L(g,40,51,50,64,C.bronze1);
      }
      // Bottom color weight prevents an empty cut-out at the frame edge.
      R(g,0,63,64,1,bg[0]);
    });
  }
  function terrain(g,x,y,type,seed=0,t=0) {
    at(g,x,y,1,()=>{
      if(type==='water'||type==='deepwater') {
        R(g,0,0,16,16,type==='deepwater'?C.navy:C.water);
        const step=Math.floor(t*1.5),shift=(seed+step)%5;
        if(hash(seed,2)>.3){R(g,2+shift,4,5,1,C.wave);R(g,7+shift,5,2,1,C.navy);}
        if(hash(seed,3)>.5)R(g,2,11,7,1,type==='deepwater'?C.water:C.wave);
        if(hash(seed,4)>.91)R(g,12,8,2,1,C.foam);
      } else if(type==='stone'||type==='floor') {
        R(g,0,0,16,16,type==='floor'?'#4b5d59':'#536760');
        R(g,0,0,16,1,C.stone0);R(g,0,0,1,16,C.stone0);
        R(g,1,1,15,1,C.stone2);R(g,1,2,1,14,C.stone2);
        if(hash(seed,1)>.65) {L(g,9,1,7,6,C.stone0);L(g,7,6,10,9,C.stone0);}
        flecks(g,seed,2,2,13,13,4,[C.stone1,C.stone2]);
        if(hash(seed,8)>.85){R(g,1,12,5,2,C.forest2);R(g,1,10,2,2,C.forest2);}
      } else if(type==='wood') {
        R(g,0,0,16,16,C.bronze0);
        for(let i=0;i<4;i++){R(g,0,i*4,16,1,'#373c32');R(g,0,i*4+1,16,1,'#806849');}
        R(g,2,2,1,1,C.ink);R(g,13,10,1,1,C.ink);
        if(hash(seed,0)>.6)R(g,5,7,7,1,'#8d744e');
      } else if(type==='path'||type==='sand') {
        const sand=type==='sand';R(g,0,0,16,16,sand?'#a4a17d':'#79846c');
        flecks(g,seed,0,0,15,15,7,sand?['#929777','#b6b08a','#8b9475']:['#879075','#687c66','#92987a']);
        if(hash(seed,2)>.75){R(g,5,7,3,2,sand?'#7f8c73':'#5d7162');R(g,5,7,2,1,'#9da185');}
      } else {
        const base=['#365d4d','#385f4e','#3b604f'][Math.floor(hash(seed,0)*3)];
        R(g,0,0,16,16,base);
        flecks(g,seed,0,0,16,16,12,['#446b54','#2d574a','#51755a']);
        if(hash(seed,4)>.65){L(g,6,12,5,9,'#5b7d60');L(g,6,12,8,9,'#496e52');}
      }
    });
  }
  window.TideArt=Object.freeze({
    drawProp, enemy, portrait, terrain, colors:C, hash,
    dimensions:Object.freeze({
      tree:[60,78],pine:[50,83],bush:[31,21],rock:[29,20],flowers:[25,15],
      lantern:[26,36],chest:[29,31],shrine:[31,60],arch:[104,85],column:[29,57],
      bell:[96,113],boat:[65,30],sign:[29,28],fountain:[53,44],
      wisp:[58,69],bramble:[92,89],sentinel:[84,118],boss:[154,154]
    })
  });
})();
