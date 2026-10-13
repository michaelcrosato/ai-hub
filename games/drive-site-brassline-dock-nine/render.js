/* Art is generated for BRASSLINE. The runtime rigs raster parts with smooth transforms. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  function image(path) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Asset failed: ' + path)); img.src = path; }); }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function part(img, polygon, pivot) {
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys)), w = Math.ceil(Math.max(...xs) - x), h = Math.ceil(Math.max(...ys) - y);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.translate(-x, -y); poly(ctx, polygon); ctx.clip(); ctx.drawImage(img, 0, 0);
    return { cv, x: x - pivot[0], y: y - pivot[1], pivot };
  }
  class RingRenderer {
    constructor(game) {
      this.game = game; this.loaded = false; this.parts = {}; this.particles = []; this.rings = []; this.hitLight = 0; this.hurtLight = 0;
      this.cameraX = 0; this.cameraY = 0; this.rookX = 0; this.rookY = 0; this.rookTilt = 0; this.rookZoom = 1;
      this.titleBlend = 1; this.motion = true; this.playerHit = 0; this.fxTime = 0; this.previous = performance.now();
      this.dust = Array.from({ length: 33 }, (_, i) => ({ x: ((i * 151.31) % 960), y: ((i * 72.7) % 490), speed: 5 + i % 9, size: .5 + i % 3 * .45, phase: i * 1.27 }));
    }
    async load() {
      [this.arena, this.fighter, this.bodyPlate] = await Promise.all([image('assets/dock-nine.png'), image('assets/rook-voss.png'), image('assets/rook-body.png')]);
      const f = this.fighter;
      this.parts.legL = part(f, [[318,864],[499,910],[493,985],[437,1112],[394,1211],[348,1385],[342,1454],[255,1509],[146,1505],[152,1441],[222,1334],[260,1169],[302,987]], [405,896]);
      this.parts.legR = part(f, [[525,905],[704,865],[724,1005],[759,1202],[815,1406],[880,1458],[875,1505],[789,1513],[666,1451],[635,1358],[611,1206],[568,1085],[534,986]], [614,896]);
      this.parts.body = part(this.bodyPlate, [[430,208],[381,229],[340,267],[325,339],[327,426],[335,485],[359,541],[362,616],[338,745],[291,876],[330,900],[478,938],[523,929],[554,938],[729,886],[699,728],[683,613],[682,554],[693,463],[692,368],[667,283],[605,225],[571,209]], [512,875]);
      this.parts.head = part(f, [[431,216],[442,158],[444,119],[438,102],[447,48],[463,14],[536,0],[596,30],[607,74],[594,156],[572,218],[590,269],[578,290],[534,305],[478,280]], [512,263]);
      this.parts.armL = part(f, [[375,239],[401,273],[405,328],[382,385],[354,441],[310,478],[263,486],[226,461],[209,417],[218,357],[242,301],[285,276],[337,261]], [0,0]);
      this.parts.armR = part(f, [[649,252],[690,267],[727,304],[748,348],[759,411],[791,461],[769,488],[725,485],[676,456],[652,442],[630,384],[617,317],[624,271]], [0,0]);
      this.parts.forearmL = part(f, [[214,435],[258,443],[279,467],[298,510],[273,519],[249,538],[234,570],[207,569],[185,548],[183,507],[195,463]], [0,0]);
      this.parts.forearmR = part(f, [[750,440],[781,459],[812,492],[823,535],[808,562],[786,565],[779,536],[759,522],[732,509],[719,483]], [0,0]);
      this.parts.gloveL = part(f, [[264,501],[309,489],[358,486],[400,501],[428,534],[429,579],[410,617],[380,648],[334,649],[289,631],[258,616],[237,599],[227,567],[233,529]], [305,553]);
      this.parts.gloveR = part(f, [[698,503],[741,506],[775,520],[798,551],[797,594],[773,617],[739,644],[702,658],[671,641],[646,610],[640,569],[650,535],[675,511]], [747,555]);
      this.playerGlove = document.createElement('canvas');
      this.playerGlove.width = this.parts.gloveL.cv.width; this.playerGlove.height = this.parts.gloveL.cv.height;
      const gloveContext = this.playerGlove.getContext('2d');
      gloveContext.filter = 'hue-rotate(155deg) saturate(.63) brightness(.83)';
      gloveContext.drawImage(this.parts.gloveL.cv, 0, 0);
      this.loaded = true;
    }
    drawPart(ctx, name, x, y, angle = 0, sx = 1, sy = sx, alpha = 1) {
      const p = this.parts[name]; ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(sx, sy); ctx.globalAlpha *= alpha; ctx.drawImage(p.cv, p.x, p.y); ctx.restore();
    }
    drawSegment(ctx, name, from, to, originalFrom, originalTo) {
      const p=this.parts[name], dx=to[0]-from[0],dy=to[1]-from[1],ox=originalTo[0]-originalFrom[0],oy=originalTo[1]-originalFrom[1];
      ctx.save();ctx.translate(...from);ctx.rotate(Math.atan2(dy,dx));ctx.scale(Math.hypot(dx,dy)/Math.hypot(ox,oy),1);ctx.rotate(-Math.atan2(oy,ox));ctx.translate(-originalFrom[0],-originalFrom[1]);ctx.drawImage(p.cv,p.x,p.y);ctx.restore();
    }
    playBottom() { return this.viewport?.playBottom || this.game.H; }
    pose() {
      const H=this.game.H,W=this.game.W,portrait=H>W,base=this.playBottom()*(portrait?.99:.98)+(portrait&&this.viewport?.touch?H*.18:0);
      const scale=portrait?Math.min((base-Math.max(H*.22,this.viewport?.playTop||0))/1510,W*.82/850):H*.78/1536;
      return {base,scale};
    }
    targetY(target) { const pose=this.pose(); return pose.base-(target==='head'?1330:980)*pose.scale; }
    event(e, bout) {
      const hit = e.type === 'hit', evade = e.type === 'evade';
      if (hit) {
        const power = e.power || e.counter; this.hitLight = power ? .17 : .07;
        const x = this.game.W * .5 + (e.hand === 'left' ? -19 : 19), y = this.targetY(e.target);
        for (let i = 0; i < (power ? 23 : 10); i++) {
          const a = (i * 2.3999) + (e.hand === 'left' ? 0 : Math.PI), sp = (power ? 135 : 65) + (i % 5) * 23;
          this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, life: .2 + i % 4 * .065, max: .4, size: i % 4 + 1.5, color: e.counter ? '#a1ffe7' : '#ffe6b2' });
        }
        this.rings.push({ x, y, t: 0, power: power ? 1.6 : .8, color: e.counter ? '#91e9d1' : '#ffe7b6' });
      }
      if (evade && e.perfect) this.rings.push({ x: this.game.W * .5, y: this.targetY('body'), t: 0, power: 1.6, color: '#82e4ca' });
      if (e.type === 'hurt') { this.hurtLight = e.blocked ? .05 : .3; this.playerHit = e.side; }
      if (e.type === 'knockdown') { this.hitLight = .15; this.particles.length = 0; }
    }
    draw(ctx, bout, title, settings) {
      const now = performance.now(), frame = Math.min(.04, (now - this.previous) / 1000); this.previous = now;
      this.motion = !settings.reducedMotion; this.fxTime += frame;
      this.hitLight = Math.max(0, this.hitLight - frame); this.hurtLight = Math.max(0, this.hurtLight - frame);
      const W = this.game.W, H = this.game.H, portrait = H > W;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#101e29'; ctx.fillRect(0, 0, W + 2, H + 2);
      if (!this.loaded) { ctx.restore(); return; }
      this.titleBlend = lerp(this.titleBlend, title ? 1 : 0, 1 - Math.exp(-frame * 5));
      const sim = title ? this.game.real : bout.t;
      const d = bout?.player?.dodge, du = bout?.player?.dodgeTime || 0;
      const dodgeMotion = d ? Math.sin(Math.min(1, du / .43) * Math.PI) : 0;
      const dx = d === 'left' ? -1 : d === 'right' ? 1 : 0;
      this.cameraX = lerp(this.cameraX, this.motion ? dx * dodgeMotion * 12 : 0, 1 - Math.exp(-frame * 25));
      this.cameraY = lerp(this.cameraY, this.motion && d === 'duck' ? dodgeMotion * -10 : 0, 1 - Math.exp(-frame * 25));
      const shake = this.motion ? this.game.shakeAmt * 1.3 : 0;
      ctx.translate(this.cameraX + Math.sin(this.fxTime * 89) * shake, this.cameraY + Math.sin(this.fxTime * 73) * shake);
      const cover = Math.max((W + 32) / this.arena.width, (H + 32) / this.arena.height);
      const aw = this.arena.width * cover, ah = this.arena.height * cover;
      ctx.drawImage(this.arena, (W - aw) / 2, (H - ah) / 2 - 4, aw, ah);
      const tint = ctx.createLinearGradient(0, 0, 0, H); tint.addColorStop(0, '#09202c26'); tint.addColorStop(.55, '#09202c00'); tint.addColorStop(1, '#071c3070'); ctx.fillStyle = tint; ctx.fillRect(-20, -20, W + 40, H + 40);
      // Animated airborne dust. No essential information relies on this effect.
      if (this.motion) for (const d of this.dust) {
        const x = (d.x / 960 * W + Math.sin(this.fxTime * .25 + d.phase) * 18), y = (d.y / 540 * H - this.fxTime * d.speed * .3 + H * 10) % H;
        ctx.globalAlpha = .13 + .13 * Math.sin(this.fxTime + d.phase); ctx.fillStyle = '#ffdd93'; ctx.fillRect(x, y, d.size, d.size);
      }
      ctx.globalAlpha = 1;
      const targetX = lerp(W * .5, W * .69, this.titleBlend);
      const baseY = lerp(this.pose().base, H * (portrait ? .84 : .93), this.titleBlend);
      this.drawRook(ctx, bout, targetX, baseY, sim, title, portrait);
      if (this.titleBlend < .95 && !['opponentDown', 'win', 'trained'].includes(bout.state)) this.drawPlayer(ctx, bout, W, H, 1 - this.titleBlend);
      this.drawParticles(ctx, frame);
      ctx.restore();
      if (this.motion && this.hitLight > 0) { ctx.fillStyle = `rgba(255,222,155,${this.hitLight * .45})`; ctx.fillRect(0, 0, W + 2, H + 2); }
      if (this.motion && this.hurtLight > 0) {
        const g = ctx.createRadialGradient(W * .5, H * .5, H * .1, W * .5, H * .5, H * .8);
        g.addColorStop(0, 'rgba(194,52,34,0)'); g.addColorStop(1, `rgba(194,52,34,${this.hurtLight * 1.7})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W + 2, H + 2);
      }
    }
    drawRook(ctx, bout, x, y, t, title, portrait) {
      const o = bout.opponent, a = o.attack, h = bout.currentStrike;
      const idle = Math.sin(t * 3.4), breathe = Math.sin(t * 2.8), scale = lerp(this.pose().scale, portrait ? Math.min(this.game.H*.52/1536,this.game.W*.8/850) : this.game.H*.92/1536, this.titleBlend);
      let tilt = idle * .012, shiftX = idle * 6, shiftY = Math.abs(breathe) * 5, squash = 1, zoom = 1;
      const isDown = bout.state === 'opponentDown' || bout.state === 'win';
      if (!title && isDown) { const u = ease(bout.stateTime / .85); shiftY += u * 420; tilt = -u * 1.35; zoom = 1 - u * .18; }
      else if (!title && (o.hurt > 0)) { tilt += o.hitSide * Math.sin(o.hurt * 14) * .055; shiftX += o.hitSide * o.hurt * 47; shiftY -= o.hurt * 18; }
      else if (!title && o.stunned > 0) { tilt += Math.sin(t * 7) * .045; shiftX += Math.sin(t * 7) * 13; }
      let armL = -.1, armR = .1, armLY = 0, armRY = 0, gloveLX = 310, gloveLY = 553, gloveRX = 747, gloveRY = 555, gloveLS = 1, gloveRS = 1;
      if (!title) {
        if (!a && !o.opening && !o.stunned && !isDown) {
          if (o.guard === 'head') { armL = .31; armR = -.29; armLY = -26; armRY = -26; gloveLX = 407; gloveLY = 317; gloveRX = 619; gloveRY = 327; }
          else { armL = .09; armR = -.09; gloveLX = 375; gloveLY = 542; gloveRX = 664; gloveRY = 548; }
        }
        if (a && h) {
          const dist = h.time - a.t, isSweep = h.kind === 'sweep';
          let anticipation = clamp(1 - dist / (h === a.hits[0] ? h.time : .65));
          if (a.feint && a.t < .72 * bout.rules.wind) anticipation = Math.sin(a.t / (.72 * bout.rules.wind) * Math.PI) * .5;
          const side = h.spec.side;
          tilt += side * anticipation * .065; shiftX += side * anticipation * 21;
          if (h.kind === 'body' || h.kind === 'delay') { shiftY += anticipation * 30; squash -= anticipation * .035; }
          if (side < 0) { armL -= anticipation * .4; gloveLX -= anticipation * 90; gloveLY -= anticipation * (isSweep ? 320 : 230); }
          else { armR += anticipation * .4; gloveRX += anticipation * 80; gloveRY -= anticipation * 245; }
          if (isSweep) { armR += anticipation * .2; gloveRY -= anticipation * 200; }
          if (dist < .27 && dist > .075 && h.spec.counter) {
            const pointY = h.spec.counter === 'head' ? -1190 : -940;
            ctx.save(); ctx.translate(x + shiftX * scale, y); ctx.scale(scale, scale); ctx.globalAlpha = .4 + .4 * Math.sin(t * 24); ctx.strokeStyle = '#a2ffdf'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, pointY, 28, 0, TAU); ctx.stroke(); ctx.restore();
          }
        }
        if (a) {
          // Reach the visual contact pose on the exact simulation damage time.
          const last = [...a.hits].reverse().find(h => a.t >= h.time - .17 && a.t - h.time < .22);
          if (last) {
            const contact = a.t - last.time, impact = contact < 0 ? ease((contact + .17) / .17) : 1 - ease(contact / .22);
            zoom += impact * .045; shiftY -= impact * 13; tilt += last.spec.side * impact * .1;
            if (last.spec.side < 0) { gloveLX = lerp(gloveLX, last.kind === 'sweep' ? 640 : 445, impact); gloveLY = lerp(gloveLY, last.kind === 'body' ? 700 : 480, impact); gloveLS = 1 + impact * 1.05; armL += impact * .28; }
            else { gloveRX = lerp(gloveRX, 565, impact); gloveRY = lerp(gloveRY, last.kind === 'body' ? 690 : 460, impact); gloveRS = 1 + impact * 1.05; armR -= impact * .28; }
          }
        }
      }
      ctx.save(); ctx.translate(x + shiftX * scale, y + shiftY * scale);
      // A soft contact shadow keeps the cutout tied to the ring.
      const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, 110 * scale * 2.2); shadow.addColorStop(0, '#061923a8'); shadow.addColorStop(1, '#06192300'); ctx.save(); ctx.scale(1, .16); ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, 270 * scale, 0, TAU); ctx.fill(); ctx.restore();
      ctx.scale(scale * zoom, scale * zoom * squash); ctx.rotate(tilt); ctx.translate(-512, -1510);
      this.drawPart(ctx, 'legL', 405, 896, Math.sin(t * 3.4) * .009);
      this.drawPart(ctx, 'legR', 614, 896, -Math.sin(t * 3.4) * .009);
      this.drawPart(ctx, 'body', 512, 877 + breathe * 3, tilt * -.18, 1 + breathe * .004, 1 + breathe * .007);
      this.drawPart(ctx, 'head', 512 + idle * 3, 263 + breathe * 4, tilt * .3 - idle * .009);
      const elbowL=[244+(gloveLX-310)*.25,478+(gloveLY-553)*.24+breathe*2];
      const elbowR=[768+(gloveRX-747)*.25,478+(gloveRY-555)*.24+breathe*2];
      this.drawSegment(ctx,'armL',[359,302],elbowL,[359,302],[251,464]);
      this.drawSegment(ctx,'armR',[667,310],elbowR,[667,310],[757,469]);
      this.drawSegment(ctx,'forearmL',elbowL,[gloveLX-24,gloveLY+13+idle*7],[236,451],[244,557]);
      this.drawSegment(ctx,'forearmR',elbowR,[gloveRX+23,gloveRY+13-idle*7],[754,461],[793,555]);
      this.drawPart(ctx, 'gloveL', gloveLX, gloveLY + idle * 7, armL * .3, gloveLS);
      this.drawPart(ctx, 'gloveR', gloveRX, gloveRY - idle * 7, armR * .3, gloveRS);
      if (!title && o.stunned > 0) {
        for (let i = 0; i < 3; i++) { const ang = t * 4 + i * TAU / 3; ctx.save(); ctx.translate(518 + Math.cos(ang) * 115, 40 + Math.sin(ang) * 18); ctx.rotate(ang); ctx.fillStyle = '#ffe7a5'; poly(ctx, [[0,-12],[4,-3],[13,0],[4,3],[0,12],[-4,3],[-13,0],[-4,-3]]); ctx.fill(); ctx.restore(); }
      }
      ctx.restore();
    }
    drawPlayer(ctx, bout, W, H, alpha) {
      const p = bout.player, a = p.attack, t = bout.t, duck = p.dodge === 'duck' ? Math.sin(p.dodgeTime / .43 * Math.PI) : 0;
      const dodgeX = p.dodge === 'left' ? -Math.sin(p.dodgeTime / .43 * Math.PI) * W * .08 : p.dodge === 'right' ? Math.sin(p.dodgeTime / .43 * Math.PI) * W * .08 : 0;
      const down = bout.state === 'playerDown' || bout.state === 'lose' ? ease(bout.stateTime / .5) : 0;
      for (const hand of ['left', 'right']) {
        const left = hand === 'left'; let x = W * (left ? .32 : .68) + dodgeX, y = this.playBottom() * .92 + Math.sin(t * 3.2 + (left ? 0 : 2)) * 4 + duck * H * .17 + down * H * .3;
        let size = Math.min(W,H) / 540 * .75, rotation = left ? -.28 : .28;
        if (p.guard) { x = W * (left ? .42 : .58); y -= H * .2; rotation = left ? -.1 : .1; }
        if (a && a.hand === hand) {
          const wind = a.clock.spec.wind, total = wind + a.clock.spec.active + a.clock.spec.recover;
          const u = a.elapsed < wind ? a.elapsed / wind : 1 - clamp((a.elapsed - wind) / (total - wind));
          const reach = ease(u);
          x = lerp(x, W * (left ? .485 : .515), reach); y = lerp(y, this.targetY(a.target) + 8, reach);
          size *= 1 - reach * (a.power ? .22 : .4); rotation += (left ? .6 : -.6) * reach;
          if (a.power && this.motion && reach > .35) {
            ctx.save(); ctx.globalAlpha = .18 * alpha; ctx.strokeStyle = '#ebd092'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W * (left ? .31 : .69), H); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
          }
        }
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size * (left ? 1 : -1), size);
        ctx.drawImage(this.playerGlove, -this.playerGlove.width / 2, -this.playerGlove.height / 2); ctx.restore();
      }
    }
    drawParticles(ctx, dt) {
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; ctx.save(); ctx.globalAlpha = clamp(p.life / .16); ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .028, p.y - p.vy * .028); ctx.stroke(); ctx.restore(); }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const r of this.rings) { r.t += dt; const u = r.t / .27; if (u >= 1) continue; ctx.save(); ctx.globalAlpha = (1 - u) * .65; ctx.strokeStyle = r.color; ctx.lineWidth = (1 - u) * 6 * r.power; ctx.beginPath(); ctx.ellipse(r.x, r.y, (8 + u * 40) * r.power, (8 + u * 28) * r.power, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      this.rings = this.rings.filter(r => r.t < .27);
    }
  }
  root.BrasslineRenderer = RingRenderer;
})(globalThis);
