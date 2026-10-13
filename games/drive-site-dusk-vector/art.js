/* DUSK VECTOR — original code-native sprite artwork. No external assets. */
(() => {
  'use strict';
  const C = Object.freeze({
    ink: '#101728', deep: '#203047', steel: '#415971', slate: '#718c97',
    gray: '#adbbb6', cream: '#eadfc0', white: '#fff2d5', cyan: '#8ce1df',
    teal: '#48aeb8', blue: '#306b89', mint: '#a8ddbd', green: '#5e9d8b',
    orange: '#e99755', amber: '#f8c56b', copper: '#aa6a48', gold: '#c69b62',
    red: '#d4615e', redLight: '#f39b82', wine: '#7c4255', lavender: '#b3a3d2',
    purple: '#6f668f'
  });
  let engine;

  // E.sprite supplies the exact renderer contract, including its flash/flip support.
  // All visible geometry below is drawn through the engine's integer pixel API.
  function bake(E, w, h, paint) {
    const sprite = E.sprite(Array(h).fill('.'.repeat(w)), {}, 1);
    const g = sprite.cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(brush(E, g), E, g);
    const fg = sprite.fl.getContext('2d');
    fg.imageSmoothingEnabled = false;
    fg.save(); fg.translate(w, 0); fg.scale(-1, 1);
    E.px.sprite(fg, sprite, 0, 0);
    fg.restore();
    return sprite;
  }

  function brush(E, g, ox = 0, oy = 0, scale = 1) {
    const X = x => Math.round(ox + x * scale);
    const Y = y => Math.round(oy + y * scale);
    return {
      r: (x, y, w, h, c) => E.px.rect(g, X(x), Y(y), X(x + w) - X(x), Y(y + h) - Y(y), c),
      d: (x, y, c) => E.px.rect(g, X(x), Y(y), Math.max(1, X(x + 1) - X(x)), Math.max(1, Y(y + 1) - Y(y)), c),
      l: (x, y, u, v, c, w = 1) => E.px.line(g, X(x), Y(y), X(u), Y(v), c, Math.max(1, Math.round(w * scale))),
      p: (points, c) => E.px.poly(g, points.map(a => [X(a[0]), Y(a[1])]), c),
      e: (x, y, rx, ry, c) => E.px.ell(g, X(x), Y(y), rx * scale, ry * scale, c)
    };
  }

  function kestrel(b) {
    // Forward swept bright deck above the dark, compact engine block.
    b.p([[4,8],[8,2],[14,2],[22,9],[36,8],[42,10],[51,11],[51,14],[39,17],[27,18],[17,23],[12,23],[14,17],[4,17],[4,15],[0,15],[0,9]],C.ink);
    b.p([[13,9],[16,0],[21,0],[34,10],[28,14]],C.ink);
    b.p([[16,8],[18,1],[20,1],[29,9]],C.cream);
    b.p([[17,6],[18,2],[20,2],[26,7]],C.white);
    b.p([[17,7],[27,8],[31,10],[24,11]],C.teal);
    b.l(18,3,22,5,C.orange);
    b.p([[17,14],[34,13],[30,18],[17,22],[14,22]],C.blue);
    b.p([[21,15],[30,15],[27,18],[17,21]],C.cyan);
    b.p([[20,16],[28,15],[23,18],[17,20]],C.cream);
    b.l(19,20,27,17,C.teal);
    b.p([[5,8],[8,3],[12,3],[16,9]],C.gray);
    b.p([[8,4],[11,4],[14,8],[7,8]],C.white);
    b.r(8,4,3,2,C.orange);
    b.r(1,10,9,5,C.deep);
    b.r(1,11,3,3,C.orange);
    b.r(1,11,1,3,C.amber);
    b.r(5,9,7,2,C.slate);
    b.r(5,14,8,2,C.blue);
    b.p([[9,9],[28,8],[35,7],[42,9],[45,11],[50,12],[40,15],[21,16],[9,14]],C.cream);
    b.p([[10,10],[27,9],[34,8],[41,10],[23,11],[12,12]],C.white);
    b.p([[10,13],[25,13],[37,12],[48,12],[40,15],[22,16],[11,14]],C.slate);
    b.p([[17,12],[29,11],[44,11],[47,12],[28,14],[16,14]],C.teal);
    b.l(30,12,46,12,C.cyan);
    b.p([[26,9],[29,5],[35,5],[41,9],[42,10],[27,11]],C.ink);
    b.p([[28,9],[30,6],[34,6],[39,9]],C.blue);
    b.p([[30,7],[33,6],[36,7],[38,8],[29,9]],C.cyan);
    b.l(31,6,34,6,C.white);
    b.l(35,7,37,8,C.teal);
    b.r(15,10,5,1,C.gray);
    b.r(15,11,1,3,C.blue);
    b.r(17,12,4,1,C.orange);
    b.l(27,14,25,16,C.deep);
    b.l(36,14,43,13,C.cream);
    b.d(11,10,C.deep); b.d(23,10,C.deep); b.d(33,14,C.white);
  }

  function needle(b) {
    b.p([[1,6],[7,6],[12,0],[16,0],[24,7],[34,7],[49,9],[49,11],[32,13],[23,13],[13,19],[9,19],[11,13],[1,13]],C.ink);
    b.p([[9,6],[13,1],[15,1],[21,7],[18,9]],C.mint);
    b.p([[12,5],[14,2],[18,6]],C.white);
    b.l(12,6,18,7,C.green);
    b.p([[15,12],[27,12],[20,15],[11,18]],C.green);
    b.p([[17,13],[24,13],[15,16],[12,17]],C.mint);
    b.r(0,7,7,5,C.deep);
    b.r(0,8,3,3,C.teal);
    b.r(0,9,2,1,C.white);
    b.r(4,7,5,1,C.gray);
    b.r(5,11,5,2,C.blue);
    b.p([[6,8],[24,6],[35,7],[43,9],[48,10],[31,12],[9,12]],C.cream);
    b.p([[8,8],[22,7],[35,8],[42,9],[20,10],[7,10]],C.white);
    b.p([[8,11],[23,10],[45,10],[31,12],[11,12]],C.green);
    b.l(26,10,45,10,C.mint);
    b.p([[21,7],[25,4],[30,4],[36,7],[37,8],[20,9]],C.ink);
    b.p([[23,7],[26,5],[30,5],[34,7]],C.teal);
    b.l(25,6,30,5,C.cyan);
    b.d(31,6,C.white);
    b.r(12,9,5,1,C.orange);
    b.r(10,8,1,3,C.gray);
    b.r(19,10,1,2,C.deep);
    b.l(30,11,34,11,C.white);
    b.l(7,13,10,14,C.ink);
    b.r(7,13,4,1,C.mint);
  }

  function manta(b) {
    b.p([[2,6],[9,6],[14,0],[23,0],[36,8],[45,10],[51,13],[55,14],[55,17],[47,20],[39,22],[25,29],[14,29],[12,25],[2,25],[2,22],[0,22],[0,9],[2,9]],C.ink);
    b.p([[9,8],[15,1],[22,1],[34,8],[30,12]],C.copper);
    b.p([[13,7],[16,2],[21,2],[29,7]],C.cream);
    b.p([[17,3],[20,3],[27,6],[16,6]],C.white);
    b.l(16,8,25,8,C.orange);
    b.p([[16,19],[39,19],[25,28],[15,28],[13,24]],C.copper);
    b.p([[20,20],[35,20],[25,25],[16,27],[15,24]],C.gold);
    b.p([[23,20],[32,20],[24,24],[18,26]],C.cream);
    b.l(19,24,25,22,C.slate);
    b.r(2,8,14,6,C.deep);
    b.r(3,8,12,2,C.gray);
    b.r(3,10,2,3,C.orange);
    b.r(3,10,1,3,C.amber);
    b.r(6,10,9,3,C.steel);
    b.r(8,10,1,3,C.ink); b.r(11,10,1,3,C.ink);
    b.r(1,18,16,6,C.deep);
    b.r(2,19,3,3,C.orange); b.r(2,20,1,1,C.white);
    b.r(6,18,10,2,C.cream);
    b.r(7,20,8,3,C.steel);
    b.r(9,20,1,3,C.ink); b.r(12,20,1,3,C.ink);
    b.p([[10,12],[24,8],[36,9],[44,11],[48,13],[54,15],[47,18],[34,21],[19,21],[10,18]],C.cream);
    b.p([[12,12],[25,9],[36,10],[45,12],[35,13],[18,14]],C.white);
    b.p([[12,17],[28,16],[47,15],[52,16],[46,18],[33,20],[19,20]],C.slate);
    b.p([[14,14],[24,13],[42,13],[48,15],[30,17],[15,17]],C.copper);
    b.l(25,14,44,14,C.orange);
    b.p([[26,11],[29,6],[36,6],[41,9],[44,12],[26,13]],C.ink);
    b.p([[28,11],[30,7],[35,7],[40,10],[41,11]],C.blue);
    b.p([[30,8],[34,7],[37,8],[38,9],[29,10]],C.cyan);
    b.l(32,7,35,7,C.white);
    b.r(17,13,3,4,C.deep); b.r(18,13,1,3,C.steel);
    b.r(22,12,1,3,C.gray);
    b.l(31,18,30,20,C.deep);
    b.l(38,18,44,17,C.cream);
    b.r(46,14,5,1,C.white);
    b.d(15,12,C.copper); b.d(23,18,C.white); b.d(37,15,C.cream);
  }

  function fighter(b) {
    b.p([[0,8],[8,6],[15,6],[22,0],[28,0],[27,6],[35,6],[35,13],[28,13],[29,17],[24,17],[15,13],[7,12],[0,10]],C.ink);
    b.p([[16,6],[23,1],[27,1],[25,7]],C.red);
    b.p([[20,5],[24,2],[26,2],[24,5]],C.redLight);
    b.p([[18,12],[26,12],[28,16],[25,16]],C.wine);
    b.l(23,13,26,15,C.red);
    b.r(29,7,6,5,C.steel);
    b.r(33,8,2,3,C.orange); b.r(34,9,1,1,C.amber);
    b.r(28,7,4,1,C.gray);
    b.p([[1,9],[9,7],[17,7],[26,6],[31,8],[30,11],[20,13],[9,11]],C.red);
    b.p([[4,9],[10,8],[18,8],[27,7],[29,8],[21,10],[9,10]],C.redLight);
    b.p([[7,10],[22,10],[30,9],[29,11],[21,12],[11,11]],C.wine);
    b.p([[8,7],[11,4],[16,4],[21,7],[20,8],[7,9]],C.ink);
    b.p([[10,7],[12,5],[16,5],[18,7]],C.blue);
    b.l(11,6,15,5,C.cyan);
    b.r(21,9,4,1,C.cream);
    b.l(11,10,3,9,C.cream);
    b.r(26,8,1,3,C.deep);
    b.d(18,9,C.cream); b.d(23,11,C.orange);
  }

  function dart(b) {
    b.p([[0,7],[12,4],[23,0],[26,0],[23,6],[27,6],[27,10],[23,10],[26,15],[23,15],[12,12],[0,9]],C.ink);
    b.p([[10,5],[23,1],[25,1],[21,6]],C.lavender);
    b.p([[11,11],[22,10],[24,14]],C.purple);
    b.p([[2,8],[13,5],[20,6],[24,7],[24,9],[15,11]],C.lavender);
    b.p([[5,8],[14,6],[20,7],[13,8]],C.cream);
    b.p([[6,9],[17,9],[23,8],[20,10],[14,10]],C.purple);
    b.p([[10,7],[15,5],[18,5],[20,7],[16,8]],C.deep);
    b.l(13,6,17,6,C.redLight);
    b.r(22,7,5,3,C.deep);
    b.r(25,7,2,3,C.red);
    b.r(26,8,1,1,C.amber);
    b.d(7,8,C.white); b.d(19,9,C.redLight);
    b.l(20,3,23,2,C.red);
    b.l(21,12,23,13,C.red);
  }

  function gunship(b) {
    b.p([[0,14],[9,10],[18,8],[26,8],[32,0],[49,0],[57,7],[66,7],[66,10],[69,10],[69,23],[66,23],[66,27],[52,27],[48,31],[30,31],[25,25],[14,24],[4,19],[0,18]],C.ink);
    b.p([[26,8],[33,1],[48,1],[54,7]],C.copper);
    b.p([[31,6],[35,2],[46,2],[50,5]],C.gold);
    b.r(36,2,7,1,C.cream);
    b.l(32,7,51,7,C.deep);
    b.p([[26,23],[52,23],[47,30],[31,30]],C.deep);
    b.p([[29,24],[49,24],[46,28],[33,28]],C.copper);
    b.l(34,26,45,26,C.gold);
    b.r(45,8,21,6,C.deep);
    b.r(47,8,17,2,C.gray);
    b.r(48,10,15,3,C.steel);
    b.r(64,9,3,4,C.copper);
    b.r(67,11,2,3,C.red); b.r(68,11,1,2,C.amber);
    b.r(45,21,21,6,C.deep);
    b.r(47,21,17,2,C.gold);
    b.r(49,24,14,2,C.steel);
    b.r(65,22,3,3,C.red); b.r(67,23,2,1,C.amber);
    b.p([[2,15],[11,11],[22,9],[43,9],[51,12],[63,13],[67,15],[65,19],[55,22],[30,25],[16,23],[5,19],[2,18]],C.gold);
    b.p([[4,15],[13,12],[23,10],[41,10],[46,12],[29,14],[12,15]],C.cream);
    b.p([[5,18],[19,19],[31,20],[61,17],[65,16],[64,19],[53,21],[30,24],[17,22]],C.copper);
    b.p([[18,16],[31,14],[51,14],[61,16],[52,19],[31,21],[19,19]],C.deep);
    b.p([[24,16],[34,15],[48,15],[54,16],[47,18],[32,19],[23,18]],C.steel);
    for (let x = 32; x <= 48; x += 4) b.r(x,15,2,4,C.ink);
    b.p([[7,14],[13,10],[20,10],[24,13],[20,15],[6,16]],C.ink);
    b.p([[9,14],[14,11],[19,11],[21,13],[18,14]],C.blue);
    b.l(13,12,18,11,C.cyan);
    b.r(8,17,7,1,C.cream);
    b.r(23,11,1,3,C.copper);
    b.l(28,10,31,13,C.copper);
    b.r(53,12,4,2,C.red);
    b.l(55,20,60,19,C.cream);
    b.r(22,22,3,1,C.gray);
    for (const a of [[28,12],[42,11],[20,20],[30,22],[58,15],[61,18]]) b.d(a[0],a[1],C.white);
    b.r(38,4,6,2,C.deep); b.r(39,4,4,1,C.blue);
  }

  function drone(b) {
    b.e(8,8,8,8,C.ink);
    b.e(8,8,7,7,C.copper);
    b.p([[4,2],[11,2],[14,5],[12,6],[4,6],[2,5]],C.amber);
    b.e(8,9,6,5,C.deep);
    b.e(8,8,5,5,C.gold);
    b.e(8,8,4,4,C.ink);
    b.e(7,8,3,3,C.red);
    b.e(6,7,1,1,C.white);
    b.r(12,6,3,5,C.steel);
    b.r(13,7,1,3,C.slate);
    b.r(1,7,2,3,C.gold);
    b.r(6,0,5,1,C.cream);
    b.r(6,15,5,2,C.deep);
    b.r(7,15,3,1,C.orange);
    b.d(3,12,C.cream); b.d(13,3,C.white);
  }

  function turret(b) {
    b.p([[1,23],[6,20],[7,13],[9,8],[15,4],[23,4],[28,9],[28,20],[30,23],[30,27],[0,27],[0,24]],C.ink);
    b.p([[9,13],[11,8],[16,5],[22,5],[27,10],[27,20],[9,20]],C.steel);
    b.p([[11,11],[13,8],[17,6],[21,6],[24,8],[25,11]],C.gold);
    b.p([[15,12],[26,11],[26,19],[13,19]],C.deep);
    b.r(15,14,10,1,C.slate);
    b.r(18,11,1,8,C.ink);
    b.r(0,9,17,7,C.ink);
    b.r(1,10,13,2,C.slate);
    b.r(1,12,13,2,C.deep);
    b.r(1,10,3,5,C.copper);
    b.r(0,11,2,3,C.red);
    b.r(0,12,1,1,C.redLight);
    b.r(10,9,4,6,C.gold);
    b.r(11,10,2,4,C.copper);
    b.p([[7,20],[27,20],[29,23],[3,23]],C.gold);
    b.r(2,24,27,3,C.deep);
    b.r(4,24,22,1,C.slate);
    for (let x=5;x<26;x+=5) b.r(x,25,3,2,C.ink);
    b.r(22,7,2,2,C.red); b.d(22,7,C.amber);
    b.d(16,7,C.white); b.d(25,18,C.gray);
  }

  function missile(b) {
    b.p([[0,2],[4,1],[11,1],[13,0],[15,0],[14,2],[15,4],[15,5],[12,5],[10,4],[4,4],[0,3]],C.ink);
    b.p([[1,2],[5,1],[11,2],[13,1],[13,4],[10,3],[4,3]],C.cream);
    b.r(2,2,4,2,C.red);
    b.r(6,2,6,1,C.white);
    b.r(7,3,5,1,C.slate);
    b.r(14,2,2,2,C.orange);
    b.d(15,2,C.amber);
  }

  function cargo(b) {
    b.r(10,0,2,3,C.ink); b.r(10,0,2,1,C.cyan);
    b.p([[5,2],[18,2],[21,5],[21,12],[18,16],[5,16],[2,13],[2,5]],C.ink);
    b.r(0,7,4,6,C.deep); b.r(20,7,4,6,C.deep);
    b.r(0,8,2,3,C.teal); b.r(22,8,2,3,C.teal);
    b.r(5,3,13,12,C.green);
    b.r(6,3,11,2,C.cyan);
    b.r(6,6,12,8,C.cream);
    b.r(7,6,10,2,C.white);
    b.r(6,13,12,2,C.teal);
    b.r(10,6,3,8,C.green);
    b.r(7,9,9,3,C.green);
    b.r(10,9,3,3,C.cyan);
    b.r(3,5,2,7,C.steel); b.r(19,5,2,7,C.steel);
    b.r(6,16,3,2,C.deep); b.r(15,16,3,2,C.deep);
    b.d(5,4,C.white); b.d(17,4,C.white);
  }

  function createSprites(E) {
    engine = E || window.My3D2dge;
    if (!engine || !engine.px) throw new Error('DuskArt requires My3D2dge.');
    const specs = {
      kestrel: [52,24,kestrel], needle: [50,20,needle], manta: [56,30,manta],
      fighter: [36,18,fighter], dart: [28,16,dart], gunship: [70,32,gunship],
      drone: [18,18,drone], turret: [31,28,turret], missile: [16,6,missile], cargo: [24,18,cargo]
    };
    const out = {};
    for (const [name, s] of Object.entries(specs)) out[name] = bake(engine, s[0], s[1], s[2]);
    return out;
  }

  // Portrait coordinates are top-left; size is the square's output size.
  function drawPortrait(g, x, y, size = 64, pilotIndex = 0) {
    const E = engine || window.My3D2dge;
    const index = ((Math.floor(pilotIndex) % 3) + 3) % 3;
    const b = brush(E, g, x, y, size / 48);
    const palettes = [
      {skin:'#d7a084', light:'#f3c5a1', shade:'#ab716e', deep:'#744d5d', hair:'#202a40', hairHi:'#45516b', shell:C.cream, shellHi:C.white, shellShade:'#87aaa8', accent:C.orange, suit:C.teal, eye:C.blue, bg:'#183747'},
      {skin:'#b77f68', light:'#dea888', shade:'#875e60', deep:'#523e52', hair:'#48313e', hairHi:'#795044', shell:C.mint, shellHi:'#dcedce', shellShade:C.green, accent:C.cyan, suit:C.green, eye:'#bfd0a4', bg:'#233e3d'},
      {skin:'#986852', light:'#bb8666', shade:'#6f4c48', deep:'#453741', hair:'#979f96', hairHi:'#d6d2b4', shell:C.gray, shellHi:C.cream, shellShade:C.slate, accent:C.orange, suit:C.copper, eye:C.amber, bg:'#393640'}
    ];
    const v = palettes[index];
    b.r(0,0,48,48,C.ink); b.r(1,1,46,46,v.bg);
    b.p([[1,1],[27,1],[1,27]],C.deep);
    for (let yy=5;yy<45;yy+=5) b.r(2,yy,44,1,v.bg);
    b.r(3,4,1,15,C.slate); b.r(3,4,8,1,C.slate);
    b.r(43,34,1,10,C.slate); b.r(37,43,7,1,C.slate);
    // Silhouette and pilot's layered flight collar.
    b.p([[4,48],[6,42],[14,38],[18,35],[31,35],[35,39],[43,42],[46,48]],C.ink);
    b.p([[7,47],[8,43],[17,39],[31,39],[40,43],[43,48]],v.suit);
    b.p([[8,44],[17,40],[20,44],[19,48],[6,48]],C.deep);
    b.p([[31,40],[39,44],[43,48],[30,48],[28,44]],C.deep);
    b.l(10,44,15,42,v.shellShade); b.l(33,43,38,45,v.shellShade);
    b.r(20,34,10,8,v.shade); b.r(21,35,7,6,v.skin);
    b.p([[16,37],[21,40],[24,43],[17,42],[14,39]],v.shell);
    b.p([[30,37],[34,39],[31,43],[25,43],[29,40]],v.shellShade);
    b.r(21,44,7,4,C.ink); b.r(22,44,5,1,C.slate);
    b.r(34,43,4,2,v.accent);
    // Asymmetric helmet silhouette has a raised visor and a separate ear assembly.
    b.p([[7,16],[9,9],[14,4],[20,2],[29,2],[36,6],[40,13],[40,25],[37,34],[32,38],[16,37],[9,31],[6,24]],C.ink);
    b.p([[9,16],[11,10],[15,6],[21,3],[28,3],[34,7],[37,12],[38,24],[35,32],[31,35],[16,35],[11,30],[8,24]],v.shellShade);
    b.p([[10,14],[12,9],[17,5],[22,4],[28,4],[33,7],[36,12],[35,15],[28,13],[18,14]],v.shell);
    b.p([[13,9],[18,5],[23,4],[27,4],[30,6],[20,7],[16,11]],v.shellHi);
    b.p([[13,10],[19,8],[29,8],[35,12],[35,16],[28,15],[18,16],[11,18]],C.ink);
    b.p([[14,11],[20,9],[28,9],[33,12],[34,14],[27,13],[18,14],[12,16]],C.blue);
    b.p([[17,11],[22,10],[28,10],[30,11],[20,12],[15,14]],C.teal);
    b.l(20,10,25,10,C.cyan);
    // Face placement varies with each pilot's proportions.
    const fx = index === 2 ? 14 : 15;
    const jawL = index === 1 ? 19 : 18;
    b.p([[fx,17],[19,14],[29,14],[34,18],[34,28],[30,34],[26,37],[21,36],[jawL,33],[14,27],[13,21]],v.deep);
    b.p([[fx+1,18],[20,15],[28,15],[32,18],[33,26],[30,32],[26,35],[21,34],[17,30],[15,25]],v.skin);
    b.p([[18,18],[22,16],[27,16],[30,18],[30,25],[28,29],[29,32],[25,34],[21,33],[18,29],[16,24]],v.light);
    b.p([[29,17],[32,19],[33,26],[30,32],[27,34],[28,29],[30,25]],v.shade);
    b.p([[16,24],[18,29],[22,32],[26,33],[25,35],[21,34],[17,30],[15,27]],v.skin);
    // Hair under the helmet is individually shaped.
    if (index === 0) {
      b.p([[13,19],[15,15],[22,13],[29,14],[32,17],[29,17],[27,15],[26,19],[23,16],[21,19],[20,16],[17,20],[16,24],[14,24]],v.hair);
      b.l(17,16,15,20,v.hairHi); b.l(21,14,25,14,v.hairHi);
      b.p([[13,22],[15,22],[16,28],[18,31],[16,32],[13,28]],v.hair);
      b.l(16,22,20,21,v.deep); b.l(27,21,31,22,v.deep);
    } else if (index === 1) {
      b.p([[14,19],[16,15],[20,13],[28,14],[32,16],[31,19],[28,16],[25,18],[23,15],[20,18],[18,17],[15,21]],v.hair);
      b.l(18,15,22,14,v.hairHi); b.l(26,15,29,16,v.hairHi);
      b.l(17,22,21,21,v.deep); b.l(27,21,31,21,v.deep);
      b.r(15,24,2,4,v.shade);
    } else {
      b.p([[14,19],[16,15],[20,13],[28,14],[32,16],[31,19],[28,16],[19,16],[16,20]],v.hair);
      b.l(18,15,24,14,v.hairHi); b.d(27,15,v.hairHi);
      b.r(15,19,2,6,v.hair); b.r(31,19,2,5,v.hair);
      b.l(17,21,21,21,v.deep,1); b.l(27,21,31,22,v.deep,1);
      b.l(18,31,21,34,v.shade); b.l(22,35,27,35,v.shade);
      b.d(19,31,v.deep); b.d(21,33,v.deep); b.d(24,34,v.deep); b.d(27,33,v.deep);
    }
    // Fine eyes, nose and a small calm mouth stay legible at 48 logical pixels.
    b.l(17,23,21,23,C.ink); b.l(27,23,31,23,C.ink);
    b.r(18,24,3,1,v.shellHi); b.r(27,24,3,1,v.shellHi);
    b.d(20,24,v.eye); b.d(28,24,v.eye);
    b.d(20,23,C.ink); b.d(28,23,C.ink);
    b.d(17,24,v.shade); b.d(31,24,v.shade);
    b.l(24,24,23,28,v.skin); b.d(24,28,v.shade); b.d(25,28,v.shade);
    b.d(25,27,v.light);
    b.l(22,31,26,31,v.deep); b.d(27,30,v.shade); b.r(23,32,3,1,v.skin);
    b.d(19,27,v.skin); b.d(29,27,v.skin);
    // Side rails and earpiece overlap the face, with orange/mint squadron flashes.
    b.p([[8,17],[12,16],[15,19],[14,29],[18,34],[16,37],[11,33],[8,27]],v.shell);
    b.p([[9,18],[11,17],[13,20],[12,28],[15,32],[13,32],[10,27]],v.shellHi);
    b.r(7,20,5,9,C.ink); b.r(8,21,4,7,v.shellShade);
    b.r(8,22,2,5,v.accent); b.r(9,23,1,3,v.shellHi);
    b.p([[35,17],[38,17],[38,26],[35,32],[31,36],[29,34],[33,29]],v.shellShade);
    b.r(35,19,5,10,C.ink); b.r(35,20,4,8,v.shell);
    b.r(36,21,2,6,v.accent); b.r(36,21,2,1,v.shellHi);
    b.l(36,28,34,31,C.ink,2); b.l(34,31,28,32,C.ink);
    b.r(27,31,4,2,C.deep); b.r(27,31,2,1,C.slate);
    b.r(29,5,4,3,v.accent); b.r(29,5,4,1,v.shellHi);
    b.d(34,9,v.shellHi); b.d(11,14,v.shellHi);
    // The border is deliberately quiet enough to combine with arbitrary game UI.
    b.r(0,0,48,1,C.steel); b.r(0,47,48,1,C.ink);
  }

  // Center-based hull, facing left. Hardpoints: (-60,-26), (-60,26), (-12,0).
  // The sockets contain no active weapon art so game.js can animate/destroy them.
  function drawBossHull(g, x, y, t = 0, phase = 1) {
    const E = engine || window.My3D2dge;
    const b = brush(E, g, x, y);
    const hot = phase > 1 ? C.red : C.amber;
    const blink = Math.sin(t * 6) > 0;
    // Aft engines and the vertical bridge silhouette.
    b.p([[46,-38],[82,-38],[93,-29],[93,-18],[77,-12],[42,-17]],C.ink);
    b.p([[48,18],[80,14],[94,22],[94,33],[80,41],[45,39]],C.ink);
    b.p([[54,-35],[80,-35],[89,-28],[89,-20],[75,-16],[49,-20]],C.steel);
    b.p([[54,21],[79,18],[90,25],[90,32],[78,37],[51,36]],C.steel);
    b.r(64,-34,15,3,C.slate); b.r(65,21,16,3,C.slate);
    for (const yy of [-30,25]) {
      b.r(81,yy,10,10,C.deep); b.r(89,yy+1,4,8,C.copper);
      b.r(91,yy+2,3,6,blink ? C.red : C.orange);
      b.r(93,yy+3,2,4,blink ? C.orange : C.amber);
      for (let xx=60;xx<=77;xx+=5) b.r(xx,yy+1,2,7,C.ink);
    }
    b.p([[1,-26],[5,-43],[17,-43],[17,-49],[39,-49],[39,-44],[49,-39],[49,-25]],C.ink);
    b.p([[5,-27],[8,-40],[21,-40],[21,-46],[36,-46],[36,-41],[45,-37],[45,-27]],C.steel);
    b.p([[9,-40],[21,-40],[21,-46],[35,-46],[35,-43],[25,-42],[24,-38],[8,-37]],C.slate);
    b.r(24,-45,10,2,C.cream);
    b.r(10,-35,28,5,C.ink);
    for (let xx=12;xx<37;xx+=6) { b.r(xx,-34,4,2,C.teal); b.d(xx,-34,C.cyan); }
    b.r(39,-39,3,10,C.copper);
    b.r(29,-49,1,-3,C.ink);
    // Main carrier silhouette and long armor slab.
    b.p([[-95,-13],[-81,-24],[-40,-30],[24,-30],[51,-23],[75,-17],[83,-9],[84,11],[72,20],[43,27],[-43,29],[-82,23],[-95,13],[-95,6],[-82,1],[-95,-4]],C.ink);
    b.p([[-92,-12],[-79,-21],[-39,-27],[23,-27],[49,-20],[73,-14],[79,-7],[80,9],[70,17],[42,24],[-42,26],[-81,20],[-92,11],[-92,7],[-77,1],[-92,-5]],C.steel);
    b.p([[-89,-12],[-76,-19],[-37,-24],[22,-24],[46,-19],[71,-13],[61,-10],[-26,-11],[-73,-6]],C.slate);
    b.p([[-90,9],[-74,5],[-32,13],[62,10],[76,4],[76,10],[66,16],[40,22],[-41,23],[-79,18]],C.deep);
    b.p([[-82,-13],[-70,-19],[-38,-22],[15,-22],[27,-17],[-31,-15],[-67,-9]],C.gray);
    b.l(-71,-18,-39,-21,C.cream);
    b.p([[-82,13],[-67,9],[-34,18],[35,18],[26,22],[-40,23],[-76,17]],C.copper);
    b.l(-61,17,-38,21,C.gold);
    // Recessed hangar/deck, covered by the center weapon mount.
    b.p([[-54,-11],[46,-12],[68,-7],[68,8],[46,13],[-43,13],[-62,7]],C.ink);
    b.p([[-50,-8],[44,-9],[63,-5],[63,5],[45,10],[-42,10],[-58,5]],C.deep);
    b.r(11,-7,44,14,C.steel);
    b.r(15,-5,39,2,C.slate);
    for (let xx=18;xx<51;xx+=7) { b.r(xx,-3,3,8,C.ink); b.r(xx+3,-2,2,6,C.deep); }
    b.r(13,7,39,1,C.copper);
    b.p([[53,-8],[66,-5],[66,5],[54,9]],C.gold);
    b.l(58,-5,62,-4,C.cream);
    b.r(60,-1,5,3,C.red); b.r(62,0,3,1,blink ? C.redLight : C.wine);
    // Separate upper and lower armored wing pods surround two circular sockets.
    for (const sy of [-1,1]) {
      const P = pts => pts.map(p => [p[0], p[1]*sy]);
      b.p(P([[-85,19],[-77,14],[-43,15],[-26,23],[-28,35],[-43,42],[-73,42],[-86,35]]),C.ink);
      b.p(P([[-82,21],[-75,17],[-44,18],[-30,25],[-32,33],[-45,39],[-71,39],[-82,33]]),C.copper);
      b.p(P([[-81,21],[-74,18],[-45,19],[-33,25],[-43,28],[-75,25]]),C.gold);
      b.l(-73,19*sy,-45,20*sy,C.cream);
      b.p(P([[-80,31],[-69,35],[-45,35],[-32,29],[-34,34],[-46,38],[-71,38],[-81,33]]),C.deep);
      b.r(-37,23*sy-(sy<0?3:0),7,3,C.steel);
      b.r(-80,27*sy-(sy<0?2:0),4,2,C.gray);
      for (let xx=-50;xx<-31;xx+=5) b.l(xx,34*sy,xx+2,32*sy,C.gold);
      // Mount centers remain clear for the game's damageable gun assemblies.
      b.e(-60,26*sy,15,12,C.ink);
      b.e(-60,26*sy,13,10,C.slate);
      b.e(-60,26*sy,11,8,C.deep);
      b.l(-66,18*sy,-58,17*sy,C.cream);
      b.r(-74,25*sy,2,2,C.copper); b.r(-48,25*sy,2,2,C.copper);
    }
    // Reactor socket / third hardpoint, slightly larger than the wing mounts.
    b.p([[-28,-11],[-20,-17],[-5,-17],[5,-8],[5,9],[-3,17],[-21,17],[-29,9]],C.ink);
    b.p([[-26,-10],[-19,-15],[-6,-15],[3,-7],[3,8],[-4,15],[-20,15],[-27,8]],C.gold);
    b.p([[-24,-10],[-18,-13],[-7,-13],[0,-7],[-3,-5],[-21,-5]],C.cream);
    b.e(-12,0,12,12,C.ink); b.e(-12,0,10,10,C.deep);
    b.r(-26,-3,3,5,C.copper); b.r(0,-3,3,5,C.copper);
    // Surface detail: inset plates, service hatches, rivets and warning lamps.
    b.r(-40,-23,15,3,C.steel); b.r(-38,-22,11,1,C.deep);
    b.r(0,-24,16,3,C.copper); b.r(2,-23,12,1,C.gold);
    b.r(9,19,15,2,C.gold); b.r(30,17,12,2,C.slate);
    for (const a of [[-76,-12],[-80,12],[-35,-20],[19,-21],[44,-16],[48,17],[-35,22],[17,22],[72,-9],[71,12]]) {
      b.r(a[0],a[1],2,2,C.ink); b.d(a[0],a[1],C.gray);
    }
    b.r(45,-20,10,3,C.ink); b.r(46,-19,3,1,hot); b.r(51,-19,3,1,blink ? hot : C.wine);
    b.r(37,23,12,2,C.ink);
    for (let xx=38;xx<48;xx+=4) b.r(xx,23,2,2,C.gold);
    b.l(-91,-10,-85,-12,C.cream); b.l(-91,10,-85,12,C.gold);
  }

  window.DuskArt = Object.freeze({ createSprites, drawPortrait, drawBossHull, palette: C });
})();
