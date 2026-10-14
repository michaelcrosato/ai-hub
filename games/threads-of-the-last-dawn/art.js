/* Original pixel art. Draws through the public My3D2dge renderer and pixel API. */
(function () {
  'use strict';
  const D = globalThis.Dawn = globalThis.Dawn || {};
  const E = globalThis.My3D2dge, TAU = Math.PI * 2;
  // Keep dimensions whole when the 640 by 400 composition scales to 480 by 300.
  const px = Object.assign({}, E.px, {
    rect(g,x,y,w,h,c) { E.px.rect(g,x,y,Math.round(w),Math.round(h),c); },
    line(g,x0,y0,x1,y1,c,w=1) { E.px.line(g,x0,y0,x1,y1,c,Math.max(1,Math.round(w))); }
  });
  const Art = D.Art = {};
  const brass = E.tones('#bf9264'), stone = E.tones('#344d60');
  const foliage = E.tones('#318f87'), bark = E.tones('#6b9590');
  const rnd = (a, b) => E.hash2(a, b);
  const ring = (g, x, y, rx, ry, color, width = 1) => {
    const n = Math.max(32, Math.ceil(Math.max(rx, ry) * 5));
    let p = [x + rx, y];
    for (let i = 1; i <= n; i++) {
      const a = i / n * TAU, q = [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
      px.line(g, p[0], p[1], q[0], q[1], color, Math.max(1, Math.round(width))); p = q;
    }
  };
  const glint = (g, x, y, size, color) => {
    const n = Math.max(1, Math.round(size));
    px.line(g, x - n, y, x + n, y, color);
    px.line(g, x, y - n, x, y + n, color);
    px.dot(g, x, y, '#fff7d8');
  };
  function cloud(g, x, y, s, color, shade) {
    px.ell(g, x, y, 63 * s, 9 * s, shade);
    px.ell(g, x - 32 * s, y - 5 * s, 20 * s, 9 * s, color);
    px.ell(g, x - 9 * s, y - 10 * s, 31 * s, 13 * s, color);
    px.ell(g, x + 22 * s, y - 6 * s, 29 * s, 9 * s, color);
    px.rect(g, x - 69 * s, y + 1, 118 * s, Math.max(1, 2 * s), shade);
    px.rect(g, x - 52 * s, y - 1, 135 * s, Math.max(1, s), color);
  }
  function island(g, x, y, s, seed, far) {
    const t = far ? E.tones('#436979') : stone;
    px.poly(g, [[x - 99 * s, y], [x - 77 * s, y + 24 * s], [x - 38 * s, y + 35 * s], [x - 16 * s, y + 78 * s], [x + 10 * s, y + 102 * s], [x + 36 * s, y + 59 * s], [x + 70 * s, y + 28 * s], [x + 105 * s, y - 4 * s]], t.deep);
    px.poly(g, [[x - 97 * s, y], [x - 35 * s, y + 15 * s], [x - 17 * s, y + 74 * s], [x - 44 * s, y + 33 * s], [x - 72 * s, y + 24 * s]], t.sh);
    px.poly(g, [[x - 32 * s, y + 13 * s], [x + 17 * s, y + 10 * s], [x + 13 * s, y + 94 * s], [x - 11 * s, y + 65 * s]], t.base);
    px.poly(g, [[x + 20 * s, y + 9 * s], [x + 92 * s, y - 3 * s], [x + 58 * s, y + 33 * s], [x + 31 * s, y + 47 * s]], t.sh);
    px.poly(g, [[x - 101 * s, y], [x - 66 * s, y - 19 * s], [x - 17 * s, y - 24 * s], [x + 42 * s, y - 18 * s], [x + 107 * s, y - 5 * s], [x + 66 * s, y + 7 * s], [x - 2 * s, y + 14 * s], [x - 65 * s, y + 8 * s]], far ? '#64827f' : '#497c68');
    px.line(g, x - 90 * s, y - 1 * s, x - 26 * s, y + 10 * s, far ? '#7f9c8d' : '#a5be86', Math.max(1, 2 * s));
    px.line(g, x - 26 * s, y + 10 * s, x + 49 * s, y + 6 * s, far ? '#7f9c8d' : '#76a47b', Math.max(1, 2 * s));
    if (far) return;
    for (let i = 0; i < 44; i++) {
      const a = rnd(seed, i), b = rnd(seed + 91, i);
      const xx = x + (a - .5) * 164 * s, yy = y - 10 * s + b * 20 * s;
      px.rect(g, xx, yy, Math.max(1, (1 + rnd(i, 51) * 3) * s), Math.max(1, s), i % 3 ? '#648f73' : '#bdc395');
    }
    for (const crack of [[-36, 14, -29, 29, -24, 49], [20, 11, 27, 34, 20, 66], [58, 9, 46, 19, 41, 34]]) {
      px.line(g, x + crack[0] * s, y + crack[1] * s, x + crack[2] * s, y + crack[3] * s, '#277f91', Math.max(1, 3 * s));
      px.line(g, x + crack[2] * s, y + crack[3] * s, x + crack[4] * s, y + crack[5] * s, '#71d5c0');
    }
    for (let i = 0; i < 8; i++) {
      const xx = x + (rnd(seed + 11, i) - .5) * 112 * s;
      const yy = y + (45 + rnd(seed + 41, i) * 84) * s;
      const w = (3 + rnd(seed + 9, i) * 8) * s;
      px.poly(g, [[xx - w, yy], [xx + w, yy - w * .3], [xx + w * .25, yy + w * 1.8]], i % 2 ? t.sh : t.base);
      px.line(g, xx - w, yy, xx + w, yy - w * .3, '#608996');
    }
  }
  function crown(g, x, y, s, time) {
    const clusters = [[-65,-83,32,16],[-34,-111,38,21],[5,-131,36,18],[43,-122,39,21],[76,-104,29,18],[96,-78,26,15],[60,-71,42,19],[16,-89,42,25],[-23,-73,33,20],[-74,-60,26,12]];
    for (let n = 0; n < clusters.length; n++) {
      const [dx,dy,rx,ry] = clusters[n], cx = x + dx * s, cy = y + dy * s;
      px.ell(g, cx, cy + 3 * s, rx * s, ry * s, foliage.deep);
      px.ell(g, cx - 3 * s, cy - 2 * s, rx * .94 * s, ry * .84 * s, foliage.sh);
      px.ell(g, cx - 5 * s, cy - 6 * s, rx * .85 * s, ry * .63 * s, n % 3 === 0 ? '#44aaa0' : foliage.base);
      for (let j = 0; j < 34; j++) {
        const a = rnd(n * 31 + 90, j) * TAU, rad = Math.sqrt(rnd(n + 212, j));
        const xx = cx + Math.cos(a) * rx * .91 * s * rad, yy = cy + Math.sin(a) * ry * .87 * s * rad;
        const c = yy < cy ? (j % 4 ? '#72c8ae' : '#cce3ae') : (j % 3 ? '#237c80' : '#409f91');
        px.rect(g, xx, yy, Math.max(1, (j % 3 + 1) * s), Math.max(1, s), c);
      }
      const a = time * .5 + n;
      if (Math.sin(a) > .6) glint(g, cx - rx * .4 * s, cy - ry * .35 * s, 1 * s, '#dfffe0');
    }
  }
  function tree(g, x, y, s, time) {
    const p = pts => pts.map(([a,b]) => [x + a * s, y + b * s]);
    for (const pts of [ [[-3,-7],[-10,-38],[-1,-67],[8,-93],[6,-114]], [[-3,-53],[-27,-74],[-46,-91],[-52,-106]], [[3,-70],[27,-86],[45,-115],[53,-132]], [[-8,-33],[-36,-46],[-59,-57],[-73,-72]], [[7,-35],[33,-51],[63,-66],[81,-86]] ]) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = p([pts[i]])[0], b = p([pts[i+1]])[0], width = Math.max(2, (13 - i * 2.5) * s);
        px.line(g, a[0], a[1], b[0], b[1], bark.deep, Math.round(width + 2 * s));
        px.line(g, a[0] - s, a[1], b[0] - s, b[1], bark.base, Math.round(width));
        px.line(g, a[0] - 3 * s, a[1], b[0] - 2 * s, b[1], '#a8c7ac', Math.max(1, Math.round(width * .2)));
      }
    }
    px.poly(g, p([[-19,4],[-8,-21],[-10,-48],[1,-65],[13,-59],[7,-37],[14,-9],[26,7],[7,9],[-2,2]]), bark.sh);
    px.poly(g, p([[-10,4],[-3,-25],[-6,-43],[1,-57],[3,-37],[3,-15],[13,7],[3,4],[-3,1]]), '#9eb49a');
    for (const [a,b,c,d] of [[-7,-7,-40,4],[-5,-6,-59,-1],[5,-4,37,5],[7,-1,48,1],[0,0,5,17]]) {
      px.line(g, x + a*s,y+b*s,x+c*s,y+d*s,bark.deep,Math.max(2,Math.round(5*s)));
      px.line(g, x + a*s,y+b*s-s,x+c*s,y+d*s-s,'#99be99',Math.max(1,Math.round(2*s)));
    }
    px.ell(g, x - 2*s,y-29*s,3*s,7*s,bark.deep);
    px.line(g, x - 3*s,y-33*s,x-3*s,y-27*s,'#6fddbd');
    crown(g, x, y, s, time);
  }
  function gateFace(g, x, y, rx, ry, time, color, title) {
    const t = E.tones(color), u = rx / 16;
    px.blend(g, .3, 'add', () => px.ddisc(g, x, y, ry * 1.18, color, .7));
    px.ell(g, x, y, rx, ry, '#102d42');
    px.ell(g, x - u, y - u, rx * .85, ry * .9, '#17465a');
    px.ell(g, x + u, y + u, rx * .68, ry * .78, '#246777');
    for (let i = 0; i < 18; i++) {
      const phase = (i / 18 + time * .032) % 1;
      const yy = y + (phase * 2 - 1) * ry * .92;
      const ww = Math.sqrt(Math.max(0, 1 - Math.pow((yy - y) / ry, 2))) * rx * .86;
      px.line(g, x - ww, yy, x + ww * .35, yy, i % 3 ? '#397e86' : t.lt);
    }
    ring(g, x, y, rx, ry, brass.deep, 5*u);
    ring(g, x - u, y - u, rx - u, ry - u, brass.base, 3*u);
    ring(g, x - u, y - u, rx - 2*u, ry - 2*u, brass.hi, u);
    ring(g, x + u, y + u, rx + u, ry + u, brass.sh, u);
    const count = title ? 40 : 16;
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, inner = i % 5 === 0 ? .83 : .91;
      px.line(g, x + Math.cos(a) * rx * inner, y + Math.sin(a) * ry * inner, x + Math.cos(a) * rx, y + Math.sin(a) * ry, i % 5 ? brass.sh : '#fff0bb', Math.max(1,Math.round(u*.45)));
    }
    for (let i = 0; i < 6; i++) {
      const a = time * .38 + i / 6 * TAU;
      glint(g, x + Math.cos(a) * rx * .65, y + Math.sin(a) * ry * .76, (i%3===0?1.2:.6)*u, color);
    }
  }

  Art.drawTitle = function (r, time = 0) {
    const W = r.W, H = r.H, s = Math.min(W / 640, H / 400);
    const x = W * .765, y = H * .71 + Math.sin(time * .46) * 1.5 * s;
    r.sky(['#091c2a','#1d465b','#ce957d','#efc69d']);
    r.queue(0, 0, 0, g => {
      px.blend(g,.36,'normal',()=>px.disc(g,W*.19,H*.58,42*s,'#e3b193'));
      px.ell(g,W*.19,H*.592,70*s,2*s,'#d9af9a');
      for(let i=0;i<28;i++) {
        const xx=rnd(55,i)*W, yy=rnd(15,i)*H*.42;
        if(xx>W*.44 && Math.sin(time*.6+i)>-.3) px.dot(g,xx,yy,i%3?'#648f9b':'#c3c4ab');
      }
      for(let i=0;i<5;i++) cloud(g,(i*.27-.1)*W + Math.sin(time*.035+i)*9*s,H*(.58+i*.033),(.65+i*.15)*s,'#819b9e','#6a8893');
    },{bias:-1000});
    r.queue(0,0,0,g=>{
      island(g,W*.49,H*.37,.26*s,21,true);
      island(g,W*.945,H*.3,.2*s,22,true);
      island(g,W*.285,H*.72,.23*s,23,true);
      island(g,W*.985,H*.82,.34*s,24,true);
      for(let i=0;i<3;i++) cloud(g,W*(.57+i*.19)+Math.sin(time*.05+i)*11*s,H*(.48+i*.05),(.5+i*.17)*s,'#b0bdb5','#91aaa8');
    },{bias:-900,solid:true});
    r.queue(0,0,0,g=>{
      const gx=x-63*s,gy=y-104*s;
      px.line(g,gx-36*s,gy-80*s,gx-28*s,gy-64*s,brass.sh,Math.max(1,2*s));
      px.line(g,gx+41*s,gy-84*s,gx+31*s,gy-64*s,brass.sh,Math.max(1,2*s));
      gateFace(g,gx,gy,62*s,75*s,time,'#8be5d1',true);
      for(const a of [-2.3,-.9,.7,2.1]) {
        const xx=gx+Math.cos(a)*69*s, yy=gy+Math.sin(a)*84*s;
        px.poly(g,[[xx-4*s,yy-4*s],[xx+4*s,yy-3*s],[xx+6*s,yy+4*s],[xx-2*s,yy+6*s]],brass.base);
        px.dot(g,xx,yy,'#f6d9a1');
      }
    },{bias:-800,solid:true});
    r.queue(0,0,0,g=>island(g,x,y,s,801,false),{bias:-700,solid:true});
    r.queue(0,0,0,g=>{
      for(let i=0;i<6;i++) {
        const xx=x-81*s+i*8*s, yy=y+8*s+i*2*s;
        px.poly(g,[[xx,yy],[xx+8*s,yy-2*s],[xx+9*s,yy+2*s],[xx+2*s,yy+4*s]],'#a6ae8b');
        px.line(g,xx+2*s,yy+3*s,xx+9*s,yy+2*s,'#527076');
      }
      for(const dx of [-71,73]) {
        const yy=y-8*s;
        px.rect(g,x+dx*s-3*s,yy-15*s,6*s,16*s,stone.sh);
        px.rect(g,x+dx*s-4*s,yy-17*s,8*s,3*s,brass.base);
        px.rect(g,x+dx*s-2*s,yy-23*s,4*s,6*s,'#e7d29e');
        glint(g,x+dx*s,yy-21*s,2*s,'#fae9b2');
      }
      tree(g,x+9*s,y-8*s,s,time);
    },{bias:-600,solid:true});
    r.queue(0,0,0,g=>{
      for(let i=0;i<32;i++) {
        const p=(time*(.01+rnd(i,9)*.016)+rnd(89,i))%1;
        const xx=x+(rnd(i,43)-.5)*198*s+Math.sin(p*8+i)*9*s, yy=y-166*s+p*255*s;
        px.rect(g,xx,yy,Math.max(1,(i%4===0?2:1)*s),Math.max(1,s),i%3?'#86c4a5':'#eacda0');
      }
      for(let i=0;i<5;i++) cloud(g,W*(.43+i*.19)+Math.sin(time*.03+i)*16*s,H*(.88+(i%2)*.06),(.4+i*.11)*s,'#64868d','#557982');
    },{bias:-500});
  };

  Art.drawGate = function (r, x, y, z = 0, time = 0, color = '#7ae4cf') {
    const s = Math.max(.4,r.view.scale);
    r.shadow(x,y,15,.3,'#08111f',z);
    r.actor(x,y,z,(g,ox,oy)=>{
      px.ell(g,ox,oy+1*s,19*s,6*s,stone.deep);
      px.ell(g,ox,oy-1*s,18*s,5*s,stone.base);
      px.line(g,ox-15*s,oy-1*s,ox+15*s,oy-1*s,stone.lt,Math.max(1,Math.round(s)));
      for(const side of [-1,1]) {
        px.rect(g,ox+side*14*s-2*s,oy-11*s,4*s,10*s,brass.sh);
        px.rect(g,ox+side*14*s-2*s,oy-12*s,4*s,2*s,brass.lt);
      }
    },{outline:false,rim:false,hides:true});
    r.queue(x,y,z,g=>{
      const [ox,oy]=r.w(x,y,z);
      px.glow(g,.7);
      gateFace(g,ox,oy-22*s,13*s,20*s,time,color,false);
      px.glow(g,0);
    },{bias:.02,emissive:true});
  };

  // Original boss silhouettes. These use the same public rig contract as Humanoid and Blob.
  // Coordinates are pixel units at the game's standard three-quarter view.
  function brush(g, ox, oy, scale, recoil) {
    const X = x => ox + (x + recoil) * scale, Y = y => oy + y * scale;
    return {
      p: (points,c) => px.poly(g,points.map(([x,y])=>[X(x),Y(y)]),c),
      l: (x,y,xx,yy,c,w=1) => px.line(g,X(x),Y(y),X(xx),Y(yy),c,w*scale),
      r: (x,y,w,h,c) => px.rect(g,X(x),Y(y),w*scale,h*scale,c),
      e: (x,y,rx,ry,c) => px.ell(g,X(x),Y(y),rx*scale,ry*scale,c),
      c: (x,y,r,c) => px.disc(g,X(x),Y(y),r*scale,c),
      ring: (x,y,rx,ry,c,w=1) => ring(g,X(x),Y(y),rx*scale,ry*scale,c,w*scale),
      star: (x,y,n,c) => glint(g,X(x),Y(y),n*scale,c)
    };
  }
  function gem(b,x,y,w,h,t) {
    b.p([[x,y-h],[x+w,y-h*.15],[x+w*.65,y+h*.55],[x,y+h],[x-w,y+h*.15],[x-w*.7,y-h*.55]],t.deep);
    b.p([[x,y-h+1],[x+w-1,y-h*.13],[x,y+h-1],[x-w+1,y+h*.12]],t.base);
    b.p([[x,y-h+1],[x,y+h-1],[x-w+1,y+h*.12],[x-w*.6,y-h*.45]],t.sh);
    b.p([[x,y-h+1],[x+w-1,y-h*.13],[x+1,y+h*.2]],t.lt);
    b.l(x,y-h+2,x-w*.5,y-h*.35,t.hi);
    b.l(x-w*.5,y-h*.35,x-1,y+h*.58,t.lt);
  }
  const metal = E.tones('#b78c54'), iron = E.tones('#446371');
  const mint = E.tones('#71d9cb'), wood = E.tones('#857050');
  const leaf = E.tones('#799862'), rust = E.tones('#b46d54');
  const glass = E.tones('#91cdd4'), purple = E.tones('#7b6a9f');

  function machine(b,t) {
    // Floating rear ring and its moving teeth.
    b.ring(0,-45,25,29,iron.deep,5); b.ring(-1,-46,25,29,metal.base,3);
    b.ring(-1,-46,22,26,metal.hi,1);
    for(let i=0;i<16;i++) {
      const a=t*.21+i*TAU/16, x=Math.cos(a)*26, y=-45+Math.sin(a)*30;
      b.l(x*.88,-45+(y+45)*.88,x,y,i%4?metal.sh:metal.hi,3);
    }
    for(const side of [-1,1]) {
      const a=t*1.7+side*.8, elbowY=-39+Math.sin(a)*3, handY=-22+Math.sin(a+.9)*4;
      b.l(side*17,-43,side*34,elbowY,iron.deep,9);
      b.l(side*17,-44,side*34,elbowY-1,metal.base,5);
      b.l(side*34,elbowY,side*43,handY,iron.deep,8);
      b.l(side*34,elbowY,side*43,handY,metal.sh,5);
      b.l(side*32,elbowY+2,side*39,handY+1,metal.lt,1);
      b.c(side*33,elbowY,5,iron.deep); b.c(side*33,elbowY,3,metal.lt); b.c(side*33,elbowY,1,iron.sh);
      b.p([[side*40,handY-4],[side*47,handY-2],[side*50,handY+4],[side*47,handY+10],[side*44,handY+7],[side*46,handY+3],[side*40,handY+3]],metal.base);
      b.l(side*45,handY-1,side*48,handY+4,metal.hi,2);
      b.l(side*40,handY,side*38,handY+7,metal.lt,3);
      b.l(side*39,-43,side*46,-50+Math.sin(t+side)*2,iron.lt,2);
      b.c(side*46,-50+Math.sin(t+side)*2,3,mint.sh); b.c(side*46,-51+Math.sin(t+side)*2,1,mint.hi);
      b.p([[side*7,-15],[side*16,-14],[side*20,-3],[side*29,0],[side*29,3],[side*12,3],[side*8,-5]],iron.deep);
      b.p([[side*10,-14],[side*15,-13],[side*17,-3],[side*25,0],[side*14,0]],metal.sh);
      b.l(side*12,-12,side*16,-2,metal.lt,2);
    }
    b.p([[-18,-54],[-9,-66],[11,-66],[20,-53],[18,-20],[9,-12],[-11,-12],[-21,-23]],iron.deep);
    b.p([[-17,-53],[-8,-62],[9,-62],[17,-51],[14,-24],[7,-16],[-9,-16],[-17,-25]],metal.sh);
    b.p([[-17,-51],[-7,-59],[-7,-20],[-14,-24]],metal.base);
    b.p([[8,-60],[17,-51],[14,-24],[7,-18],[8,-31]],metal.lt);
    b.l(-15,-53,-10,-57,metal.hi,2); b.l(12,-53,12,-43,metal.hi);
    for(const side of [-1,1]) for(let i=0;i<4;i++) b.r(side*13-2,-41+i*5,4,2,iron.deep);
    b.e(0,-42,13,18,iron.deep); b.e(0,-43,10,16,mint.deep);
    gem(b,0,-43,8,15,mint);
    b.l(-8,-29,0,-22,metal.lt,2); b.l(0,-22,9,-30,metal.hi,2);
    b.r(-5,-15,10,4,iron.sh); b.r(-3,-14,6,1,mint.hi);
    // A three-pronged command crown and a ticking pendulum.
    b.p([[-13,-61],[-16,-76],[-9,-70],[-6,-81],[0,-72],[7,-81],[10,-69],[17,-75],[13,-61]],metal.deep);
    b.l(-12,-64,-13,-72,metal.lt,2); b.l(-8,-65,-6,-76,metal.base,3);
    b.l(0,-65,0,-70,metal.hi,3); b.l(8,-65,7,-76,metal.lt,3); b.l(12,-65,14,-71,metal.base,2);
    b.r(-9,-64,19,4,metal.base); b.r(-9,-64,19,1,metal.hi);
    const pend=Math.sin(t*1.6)*4;
    b.l(0,-14,pend,-4,metal.lt,1); gem(b,pend,-3,3,5,mint);
    b.star(-2,-49+Math.sin(t*2)*4,2,mint.hi);
  }

  function roots(b,t) {
    for(let i=0;i<7;i++) {
      const x=(i-3)*12, sway=Math.sin(t*1.1+i)*2;
      b.p([[-9+i*3,-17],[x*.7,-8],[x+sway,1],[x+Math.sign(x||1)*9,3],[x*.6,-2],[6+i,-8]],wood.deep);
      b.l(-4+i*2,-12,x*.7,-5,wood.base,4);
      b.l(x*.7,-5,x+sway,0,wood.lt,2);
    }
    for(const side of [-1,1]) {
      const h=Math.sin(t*.9+side)*2;
      b.l(side*11,-39,side*28,-34+h,wood.deep,10);
      b.l(side*27,-34+h,side*39,-18+h,wood.deep,7);
      b.l(side*10,-42,side*28,-36+h,wood.base,5);
      b.l(side*27,-34+h,side*39,-19+h,wood.sh,4);
      b.l(side*38,-19+h,side*45,-14+h,wood.lt,2);
      b.l(side*38,-19+h,side*36,-10+h,wood.base,3);
      b.l(side*29,-33+h,side*38,-40+h,wood.lt,2);
      b.l(side*8,-47,side*24,-63,wood.deep,7);
      b.l(side*23,-61,side*30,-78,wood.deep,4);
      b.l(side*23,-61,side*38,-66,wood.base,3);
      b.l(side*8,-47,side*23,-62,wood.lt,3);
      b.l(side*24,-64,side*30,-77,wood.lt,1);
    }
    b.p([[-16,-51],[-7,-63],[1,-56],[11,-60],[17,-47],[14,-25],[21,-9],[10,-4],[-4,-7],[-18,-5],[-13,-22]],wood.deep);
    b.p([[-11,-50],[-5,-57],[0,-47],[-2,-32],[-6,-15],[-1,-8],[-12,-9],[-9,-26]],wood.base);
    b.p([[3,-48],[11,-53],[13,-44],[9,-29],[14,-10],[6,-10],[1,-25]],wood.sh);
    for(const [x,y,xx,yy] of [[-8,-48,-6,-34],[-7,-29,-10,-19],[4,-46,7,-38],[4,-32,8,-18]]) b.l(x,y,xx,yy,wood.lt,1);
    b.p([[-12,-42],[-3,-39],[-7,-36],[-12,-38]],wood.deep);
    b.p([[3,-39],[12,-43],[12,-38],[7,-36]],wood.deep);
    b.r(-10,-39,5,2,'#ecd194'); b.r(6,-40,5,2,'#ecd194');
    b.l(-6,-28,0,-26,wood.deep,2); b.l(0,-26,7,-29,wood.deep,2);
    gem(b,0,-20,5,8,E.tones('#d7b373'));
    for(let i=0;i<9;i++) {
      const x=-29+i*7, y=-52-Math.sin(i*.52)*14+Math.sin(t*.7+i)*1.3;
      b.e(x,y,9,6,leaf.deep); b.e(x-1,y-2,8,4,i%3?leaf.base:leaf.sh);
      b.r(x-5,y-4,4,1,leaf.lt); b.r(x+3,y-1,2,1,leaf.hi);
    }
    for(const [x,y]of [[-30,-75],[-20,-70],[-9,-75],[1,-70],[11,-77],[29,-75],[37,-65]]) {
      b.p([[x,y+3],[x-3,y-4],[x,y-10],[x+3,y-3]],leaf.sh);
      b.l(x,y+1,x,y-7,leaf.lt,1);
      if(x%3===0)b.star(x+2,y-4,1,'#e6d5ad');
    }
  }

  function crab(b,t) {
    for(const side of [-1,1]) for(let i=0;i<3;i++) {
      const shift=Math.sin(t*1.6+i*1.8+side)*2, hip=side*(12+i*5), knee=side*(31+i*7), foot=side*(41+i*7);
      b.l(hip,-22+i*4,knee,-17+i*5+shift,iron.deep,8);
      b.l(knee,-17+i*5+shift,foot,1+i*.7,iron.deep,6);
      b.l(hip,-24+i*4,knee,-19+i*5+shift,rust.base,4);
      b.l(knee,-16+i*5+shift,foot,0+i*.7,metal.lt,2);
      b.c(knee,-17+i*5+shift,3,iron.sh); b.c(knee,-18+i*5+shift,1,metal.hi);
      b.r(foot-4,1+i*.7,8,3,iron.sh);
    }
    for(const side of [-1,1]) {
      const y=-39+Math.sin(t*1.1+side)*3, open=3+Math.sin(t*1.8+side)*2;
      b.l(side*21,-26,side*37,-34,iron.deep,9); b.l(side*37,-34,side*45,y,iron.deep,8);
      b.l(side*22,-29,side*37,-36,rust.base,5); b.l(side*37,-36,side*45,y-1,metal.base,4);
      b.c(side*36,-35,4,iron.deep); b.c(side*36,-35,2,mint.lt);
      b.p([[side*41,y+3],[side*48,y+7],[side*59,y+2],[side*63,y-open-4],[side*56,y-open],[side*54,y+1],[side*47,y-1]],rust.deep);
      b.p([[side*41,y],[side*46,y-8],[side*58,y-11],[side*61,y-7+open],[side*55,y-6],[side*49,y-4],[side*48,y+1]],rust.base);
      b.l(side*47,y-7,side*56,y-9,rust.lt,2); b.l(side*47,y+4,side*56,y+1,metal.lt,2);
    }
    b.p([[-30,-29],[-23,-43],[14,-45],[30,-34],[28,-17],[18,-9],[-20,-10],[-31,-19]],iron.deep);
    b.p([[-28,-29],[-21,-39],[13,-42],[27,-33],[20,-25],[-19,-24]],rust.base);
    b.p([[-28,-27],[-18,-21],[20,-22],[27,-31],[25,-19],[16,-13],[-19,-13],[-28,-20]],rust.sh);
    b.l(-19,-38,11,-40,rust.lt,2); b.l(-23,-29,-16,-26,metal.hi,1);
    b.p([[-5,-39],[8,-39],[15,-32],[11,-26],[-9,-26],[-13,-32]],iron.deep);
    b.p([[-4,-36],[6,-36],[11,-32],[7,-28],[-6,-28],[-9,-32]],metal.base);
    b.r(-16,-22,30,6,iron.deep); b.r(-13,-21,24,3,mint.sh);
    for(let i=0;i<6;i++) b.r(-12+i*4,-21,2,2,i===Math.floor(t*3)%6?mint.hi:mint.base);
    for(const side of [-1,1]) {b.c(side*21,-31,2,metal.sh);b.r(side*21-1,-32,2,1,metal.hi);}
    // Survey optics and a split antenna make this a construction machine.
    b.r(-6,-52,13,10,iron.sh); b.r(-4,-53,9,9,metal.base);
    b.p([[-13,-57],[-8,-61],[8,-61],[13,-57],[10,-50],[-10,-50]],iron.deep);
    b.r(-10,-57,8,4,mint.base);b.r(3,-57,7,4,mint.sh);b.r(-9,-57,4,1,mint.hi);
    b.l(6,-60,11,-67,metal.lt,1); b.c(11,-67,2,rust.lt);
    b.l(-5,-61,-8,-65,metal.base,2);
  }

  function witness(b,t) {
    const centerY=-43, orbit=t*.13;
    b.ring(0,centerY,32,26,metal.sh,1);
    b.ring(0,centerY,26,31,purple.sh,1);
    for(const side of [-1,1]) {
      b.p([[side*8,-34],[side*14,-19],[side*9,-10],[side*18,-1],[side*9,-4],[side*1,-17]],purple.deep);
      b.l(side*8,-32,side*11,-19,purple.lt,2);b.l(side*11,-19,side*8,-11,purple.base,2);
    }
    const masks=Array.from({length:4},(_,i)=>{const a=orbit+i*TAU/4;return {i,x:Math.sin(a)*30,y:centerY-Math.cos(a)*27};}).sort((a,b)=>a.y-b.y);
    gem(b,0,centerY,9,17,purple); b.ring(0,centerY,11,18,metal.base,1);
    for(const m of masks) {
      const i=m.i,x=m.x,y=m.y+Math.sin(t*1.6+i)*1.4;
      const p=E.tones(['#d6bf8d','#a4be99','#a2ced0','#d19386'][i]);
      b.l(0,centerY,x,y,purple.lt,1);
      b.p([[x-10,y-7],[x-5,y-12],[x+5,y-12],[x+10,y-7],[x+8,y+4],[x,y+11],[x-8,y+4]],p.deep);
      b.p([[x-8,y-7],[x-4,y-10],[x+4,y-10],[x+8,y-6],[x+6,y+4],[x,y+8],[x-6,y+3]],p.base);
      b.p([[x-7,y-7],[x-3,y-9],[x-2,y+4],[x,y+8],[x-6,y+3]],p.lt);
      b.l(x,y-7,x+2,y+1,p.sh,2);
      b.p([[x-6,y-4],[x-2,y-3],[x-3,y],[x-6,y-1]],purple.deep);
      b.p([[x+2,y-3],[x+6,y-4],[x+6,y-1],[x+3,y]],purple.deep);
      b.r(x-5,y-3,2,1,mint.hi);b.r(x+3,y-3,2,1,mint.hi);
      if(i%2)b.l(x-2,y+5,x+3,y+3,p.deep,1);else b.l(x-2,y+3,x+3,y+5,p.deep,1);
      if(i===0){b.l(x-6,y-10,x-4,y-16,metal.base,3);b.l(x,y-11,x,y-18,metal.lt,3);b.l(x+6,y-10,x+4,y-16,metal.base,3);}
      if(i===1){b.p([[x-7,y-8],[x-15,y-14],[x-14,y-7],[x-8,y-4]],leaf.base);b.l(x+7,y-8,x+13,y-15,leaf.lt,2);}
      if(i===2){gem(b,x,y-13,3,6,glass);b.l(x-9,y-3,x-13,y-8,glass.hi,1);}
      if(i===3){b.l(x-7,y+2,x-12,y+8,purple.lt,2);b.l(x+7,y+2,x+12,y+8,rust.lt,2);}
    }
    b.star(0,centerY,2,mint.lt);
  }

  function hart(b,t) {
    const sway=Math.sin(t*.8)*1.3;
    // Far legs, then the translucent faceted body, then the near legs.
    const leg=(x,y,k,near)=>{
      const d=Math.sin(t*1.3+k)*1.4;
      b.p([[x-3,y],[x+3,y],[x+2+d,-12],[x+5+d,-2],[x+2+d,1],[x-1+d,-10]],near?glass.sh:glass.deep);
      b.l(x-1,y+1,x+d,-12,near?glass.lt:glass.base,2);
      b.l(x+d,-12,x+3+d,-3,near?glass.hi:glass.sh,1);
      b.r(x+d,-1,7,3,iron.deep);b.r(x+1+d,-1,4,1,near?glass.lt:glass.sh);
    };
    leg(-12,-27,0,false);leg(18,-27,2,false);
    b.p([[-26,-38],[-10,-46],[16,-44],[29,-35],[25,-23],[11,-18],[-11,-20],[-24,-28]],glass.deep);
    b.p([[-24,-37],[-10,-43],[13,-41],[26,-34],[22,-24],[9,-21],[-10,-23],[-21,-29]],glass.base);
    b.p([[-23,-36],[-8,-41],[-1,-28],[-11,-23]],glass.lt);
    b.p([[-8,-41],[13,-40],[5,-31],[-1,-28]],glass.hi);
    b.p([[13,-40],[25,-34],[5,-31]],'#88a9c3');
    b.p([[5,-31],[22,-32],[22,-24],[9,-21]],glass.sh);
    b.p([[-1,-28],[5,-31],[9,-22],[-10,-24]],'#bcacc8');
    b.l(-7,-40,-1,-28,'#eff3df',1);b.l(-1,-28,9,-22,glass.lt,1);
    b.p([[25,-37],[34,-43],[35,-36],[29,-32]],glass.sh);b.l(27,-36,33,-40,glass.hi,2);
    b.p([[-24,-28],[-27,-40],[-31,-53+sway],[-27,-62+sway],[-20,-54+sway],[-17,-41],[-13,-33]],glass.deep);
    b.p([[-22,-30],[-24,-42],[-28,-53+sway],[-26,-58+sway],[-21,-50+sway],[-20,-39],[-15,-34]],glass.lt);
    b.p([[-23,-37],[-26,-49+sway],[-21,-50+sway],[-19,-41],[-16,-34]],glass.base);
    b.p([[-25,-61+sway],[-34,-64+sway],[-43,-58+sway],[-42,-53+sway],[-30,-51+sway],[-24,-54+sway]],glass.deep);
    b.p([[-26,-59+sway],[-34,-61+sway],[-40,-57+sway],[-39,-54+sway],[-31,-54+sway],[-26,-55+sway]],glass.base);
    b.l(-37,-58+sway,-31,-60+sway,glass.hi,2);
    b.r(-34,-58+sway,3,2,iron.deep);b.r(-34,-58+sway,1,1,'#fff3df');
    b.p([[-27,-61+sway],[-20,-66+sway],[-21,-59+sway],[-25,-56+sway]],glass.sh);
    leg(-19,-29,1,true);leg(15,-25,3,true);
    for(const [a,bb,c,d]of [[-31,-61,-37,-73],[-37,-73,-47,-81],[-38,-73,-39,-84],[-37,-72,-27,-78],[-27,-78,-22,-88],[-28,-78,-14,-82],[-29,-63,-24,-71],[-24,-71,-13,-74],[-24,-71,-25,-81]]) {
      b.l(a,bb+sway,c,d+sway,glass.deep,4);b.l(a,bb+sway,c,d+sway,glass.lt,2);
      b.l(a-1,bb+sway,c-1,d+sway,glass.hi,1);
    }
    gem(b,-25,-45+sway,3,5,mint);b.star(-39,-84+sway,2,'#eef5dd');
    if(Math.sin(t*1.6)>.2)b.star(13,-36,2,'#fce4ca');
  }

  const special = {still_engine:[machine,84],root_crown:[roots,80],horizon_crab:[crab,73],fourfold_witness:[witness,86],glass_hart:[hart,89]};
  class SpecialRig {
    constructor(def) { this.id=def.id;this.def=def;this.t=0;this.hurt=0;this.height=special[def.id][1];this.color=def.color||D.enemyColor(def); }
    update(dt,state={}) { this.t+=dt;this.hurt=E.approach(this.hurt,state.squash<0||state.hurt?1:0,dt*10);this.look=state.look||this.look||[-1,0]; }
    draw(g,ox,oy,view) {
      const scale=(view.scale||1.5)/1.5*(this.def.size||1), recoil=this.hurt*2*Math.sin(this.t*35);
      special[this.id][0](brush(g,ox,oy,scale,recoil),this.t);
    }
  }
  const enemyColors = {
    brass_mite:'#b98753',rivet_hound:'#85939c',bell_mote:'#c4ae68',ember_wisp:'#d97d50',
    moss_moth:'#8dab69',rootling:'#9a8057',river_eel:'#6eabb5',seed_pod:'#baa367',
    scrap_crab:'#a67969',ash_hound:'#bc715b',kiln_walker:'#a37b66',seeker_drone:'#779fb6',
    paper_wisp:'#c8bca6',archive_guard:'#847396',ink_eel:'#706084',mirror_mask:'#98bbc0',
    memory_moth:'#a28cb9',glass_guard:'#8ac0cb',echo_knight:'#a08b9d',engine_eye:'#c99861',
    bell_warden:'#ba955a',furnace_regent:'#b5684f',index_keeper:'#9989ad',orin:'#697e9e',
    still_engine:'#b78c54',root_crown:'#857050',horizon_crab:'#b46d54',fourfold_witness:'#7b6a9f',glass_hart:'#91cdd4'
  };
  D.enemyColor = def => def.color || enemyColors[def.id] || '#83a18a';
  D.makeSpecialRig = def => special[def.id] ? new SpecialRig(def) : null;
})();
