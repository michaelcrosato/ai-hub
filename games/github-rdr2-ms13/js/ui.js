// RED HARROW — HUD + overlay drawing helpers (engine-assisted).
export function drawHUD(r, E, S, opts = {}) {
  const { cores, honor, wanted, cash, focus, tracker, chapter } = S;
  r.overlay((g) => {
    // Cores: health / stamina / focus bars.
    E.ui.bar(g, 6, 6, 90, 6, cores.ring.health / 100, '#c03a2a');
    E.ui.bar(g, 6, 14, 90, 6, cores.ring.stamina / 100, '#3aa848');
    E.ui.bar(g, 6, 22, 90, 6, focus.meter / 100, '#e8b83a');
    E.font.text(g, `$${cash}`, 6, 32, '#ffe08a', { shadow: '#000', outline: false });
    // Honor pips.
    const hv = honor.v;
    E.font.text(g, `HON ${hv >= 0 ? '+' : ''}${hv}`, 6, 42, hv >= 0 ? '#a0e8a0' : '#e8a0a0', { shadow: '#000', outline: false });
    // Wanted stars.
    if (wanted.stars > 0) {
      E.font.text(g, '★'.repeat(wanted.stars), r.W - 60, 6, '#ffd83a', { shadow: '#000', outline: false });
    }
    // Chapter + mission tracker.
    if (chapter) E.font.text(g, `CH.${chapter}  ${tracker || ''}`, 104, 6, '#ffffff', { shadow: '#000', outline: false });
    if (opts.hint) E.font.text(g, opts.hint, r.W / 2, r.H - 12, '#ffffff', { align: 'center', shadow: '#000', outline: false });
    if (opts.banner) {
      E.ui.box(g, r.W / 2 - 130, 40, 260, 30, { bg: '#0b0814', alpha: 0.85 });
      E.font.text(g, opts.banner, r.W / 2, 48, '#ffe08a', { align: 'center', shadow: '#000', outline: false });
    }
  });
}

export function drawObjectiveArrow(r, E, game, tx, ty) {
  const [sx, sy] = r.w(tx, ty, 0);
  if (sx >= 0 && sy >= 0 && sx <= r.W && sy <= r.H) {
    r.groundRing(tx, ty, 10, '#ffd83a', 0.9);
    return;
  }
  // Off-screen: edge arrow.
  const cx = r.W / 2, cy = r.H / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (r.W / 2 - 14);
  const ey = cy + Math.sin(ang) * (r.H / 2 - 14);
  r.overlay((g) => {
    E.px.poly(g, [[ex + Math.cos(ang) * 8, ey + Math.sin(ang) * 8],
      [ex + Math.cos(ang + 2.5) * 6, ey + Math.sin(ang + 2.5) * 6],
      [ex + Math.cos(ang - 2.5) * 6, ey + Math.sin(ang - 2.5) * 6]], '#ffd83a');
  });
  void game;
}

export function drawMinimapFrame(r, E, label) {
  r.overlay((g) => {
    E.ui.box(g, r.W - 66, r.H - 40, 60, 34, { bg: '#0b0814', alpha: 0.7 });
    E.font.text(g, label || '', r.W - 36, r.H - 30, '#ffe08a', { align: 'center', outline: false });
  });
}
