import { COLLIDERS, WORLD, getBoss } from './sim.js';

export async function createFallback2D(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cameraZ = WORLD.startZ - 6;
  let zoom = 1;
  let quality = 'low';

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, canvas.clientWidth || innerWidth);
    const h = Math.max(1, canvas.clientHeight || innerHeight);
    const rw = Math.round(w * dpr), rh = Math.round(h * dpr);
    if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function params() {
    const { w, h } = resize();
    const portrait = w / h < 0.8;
    const base = Math.min(w / (portrait ? 23 : 31), h / (portrait ? 49 : 37));
    return { w, h, scale: base * zoom, cx: w / 2, cy: h * 0.58 };
  }

  function worldToScreen(x, z, p) {
    return { x: p.cx + x * p.scale, y: p.cy + (z - cameraZ) * p.scale * 0.76 };
  }

  function drawBox(x, z, w, d, fill, p) {
    const a = worldToScreen(x - w / 2, z - d / 2, p);
    const b = worldToScreen(x + w / 2, z + d / 2, p);
    ctx.fillStyle = fill;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }

  function render(state, dt) {
    const p = params();
    cameraZ += ((state.player.z - 7) - cameraZ) * (1 - Math.exp(-dt * 6));
    ctx.fillStyle = '#9ec0c2'; ctx.fillRect(0, 0, p.w, p.h);
    ctx.fillStyle = '#9b5b33'; ctx.fillRect(0, p.h * 0.08, p.w, p.h);
    drawBox(0, cameraZ, 12, 80, '#7b4528', p);

    for (let z = 32; z > -100; z -= 12) {
      for (const side of [-1, 1]) {
        const pos = worldToScreen(side * 12.3, z, p);
        const bw = p.scale * 6.1, bh = p.scale * 6.2;
        ctx.fillStyle = ((z / 12) | 0) % 3 === 0 ? '#8f4535' : ((z / 12) | 0) % 3 === 1 ? '#3f6f7e' : '#b58d56';
        ctx.fillRect(pos.x - bw / 2, pos.y - bh * .62, bw, bh);
        ctx.fillStyle = '#4d2c20'; ctx.fillRect(pos.x - bw * .58, pos.y - bh * .08, bw * 1.16, bh * .13);
      }
    }

    for (const c of COLLIDERS) drawBox(c.x, c.z, c.w, c.d, c.kind === 'fence' ? '#5a3422' : '#7a4b2d', p);

    for (const d of state.destructibles) if (d.alive) {
      const q = worldToScreen(d.x, d.z, p); const s = p.scale * 1.1;
      ctx.fillStyle = '#9a653a'; ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      ctx.strokeStyle = '#4a2a1c'; ctx.lineWidth = 2; ctx.strokeRect(q.x - s / 2, q.y - s / 2, s, s);
    }

    for (const q of state.pickups) {
      const a = worldToScreen(q.x, q.z, p); const r = Math.max(4, p.scale * .35);
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fillStyle = q.kind === 'poster' ? '#efd59c' : q.kind === 'medkit' ? '#e7ddbd' : q.kind === 'coin' ? '#e2b850' : '#6a9fbf'; ctx.fill();
    }

    for (const b of state.bullets) {
      const q = worldToScreen(b.x, b.z, p);
      ctx.fillStyle = b.owner === 'player' ? '#ffe56d' : '#ff6044';
      ctx.fillRect(q.x - 2, q.y - 5, 4, 10);
    }

    for (const e of state.enemies) if (!e.dead) drawActor(e.x, e.z, e.kind, p, state.player);
    drawActor(state.player.x, state.player.z, 'player', p, state.player);

    const boss = getBoss(state);
    if (boss) {
      const q = worldToScreen(boss.x, boss.z, p);
      ctx.fillStyle = '#140c0a'; ctx.fillRect(q.x - 34, q.y - 40, 68, 5);
      ctx.fillStyle = '#c34531'; ctx.fillRect(q.x - 33, q.y - 39, 66 * Math.max(0, boss.hp / boss.maxHp), 3);
    }

    // Dust motes.
    ctx.fillStyle = '#f3d39b55';
    for (let i = 0; i < 22; i++) {
      const x = (Math.sin(state.time * .3 + i * 5.7) * .5 + .5) * p.w;
      const y = (Math.cos(state.time * .2 + i * 3.1) * .5 + .5) * p.h;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawActor(x, z, kind, p, player) {
    const q = worldToScreen(x, z, p);
    const s = p.scale * (kind === 'boss' ? .95 : kind === 'rider' ? .85 : .62);
    ctx.save(); ctx.translate(q.x, q.y);
    if (kind === 'rider') { ctx.fillStyle = '#71442c'; ctx.fillRect(-s * .7, -s * .25, s * 1.4, s * .72); }
    ctx.fillStyle = kind === 'player' ? '#2e6981' : kind === 'rifle' ? '#9d382d' : kind === 'boss' ? '#201917' : '#536a3a';
    ctx.fillRect(-s * .42, -s * .72, s * .84, s * 1.05);
    ctx.fillStyle = kind === 'boss' ? '#201917' : '#e4c786';
    ctx.fillRect(-s * .55, -s * 1.05, s * 1.1, s * .18);
    ctx.fillRect(-s * .34, -s * 1.3, s * .68, s * .3);
    if (kind === 'player') {
      const a = Math.atan2(player.aimX, -player.aimZ);
      ctx.rotate(a); ctx.fillStyle = '#e6b84e'; ctx.fillRect(-2, -s * .9, 4, s * 1.25);
    }
    ctx.restore();
  }

  function screenToGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const p = params();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    return { x: (sx - p.cx) / p.scale, z: cameraZ + (sy - p.cy) / (p.scale * .76) };
  }

  return {
    backendLabel: 'Canvas2D emergency fallback',
    render,
    screenToGround,
    setZoom(v) { zoom = Math.max(.72, Math.min(1.35, v)); },
    getZoom() { return zoom; },
    setQuality(v) { quality = v; },
    dispose() {},
  };
}
