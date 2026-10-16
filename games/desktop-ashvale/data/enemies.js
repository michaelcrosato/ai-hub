// ASHVALE enemies: a table of kinds (how they look, how tough they are, how they act). Each kind names one of a few AI
// patterns in A.AI. The AI only sets the body's velocity and asks the game to shoot or spawn through the context `c`:
//   c.hero (the hero's body), c.shoot(x, y, vx, vy), c.spawn(kind, x, y), c.spot(x, y, radius) -> [x, y] or null, c.rand()
(function (A) {
  // the signed difference between two angles, in -PI..PI
  A.angDiff = (a, b) => { const d = (a - b) % (Math.PI * 2); return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d; };

  A.ENEMY = {
    slime:       { hp: 2, r: 4.5, R: 4.5, colors: { base: '#4aa8e0' }, ai: 'chase', speed: 22, aggro: 90 },
    zol:         { hp: 2, r: 4.5, R: 4.5, colors: { base: '#5a9a3a' }, ai: 'chase', speed: 14, aggro: 80 },
    gibdo:       { hp: 2, r: 5, R: 5, colors: { base: '#b8a878' }, ai: 'chase', speed: 16, aggro: 100 },
    keese:       { hp: 1, r: 3.5, R: 3.5, colors: { base: '#3a3a5a' }, ai: 'flutter', speed: 34, aggro: 120, wings: true },
    head:        { hp: 1, r: 4, R: 4, colors: { base: '#c8a040' }, mouth: 'fangs', ai: 'flutter', speed: 40, aggro: 220 },
    darknut:     { hp: 3, r: 6, R: 6, colors: { base: '#3a3a48' }, horns: true, ai: 'shield', speed: 18, charge: 26, shield: true },
    bluedarknut: { hp: 4, r: 6, R: 6, colors: { base: '#3a5a9a' }, horns: true, ai: 'shield', speed: 20, charge: 28, shield: true },
    wizzrobe:    { hp: 2, r: 5, R: 5, colors: { base: '#7a3a9a' }, ai: 'wizzrobe' },
    mouth:       { hp: 2, r: 5, R: 5, colors: { base: '#c05a3a' }, mouth: 'fangs', ai: 'fixed', interval: 2.4, range: 170 },
    statue:      { hp: 1, r: 5, R: 5, colors: { base: '#6a6a70' }, ai: 'fixed', interval: 2.0, range: 220, invulnerable: true },
    // bosses
    dodongo:     { hp: 3, r: 9, R: 9, colors: { base: '#8a5a2a' }, ai: 'chase', speed: 20, aggro: 400, boss: true },
    warden:      { hp: 8, r: 9, R: 9, colors: { base: '#5a2a6a' }, ai: 'lunge', boss: true },
    manhandla:   { hp: 6, r: 10, R: 10, colors: { base: '#3a7a3a' }, mouth: 'fangs', ai: 'chase', speed: 10, aggro: 400, boss: true },
    digdogger:   { hp: 3, r: 9, R: 9, colors: { base: '#c08a3a' }, ai: 'wander', speed: 16, boss: true },
    gleeok:      { hp: 6, r: 10, R: 10, colors: { base: '#4a7a4a' }, mouth: 'fangs', ai: 'gleeok', boss: true },
    aquamentus:  { hp: 5, r: 9, R: 9, colors: { base: '#3aa84a' }, mouth: 'fangs', ai: 'aqua', boss: true },
    ghoma:       { hp: 3, r: 10, R: 10, colors: { base: '#5a3a2a' }, ai: 'ghoma', boss: true },
    ganon:       { hp: 4, r: 10, R: 10, colors: { base: '#4a2a5a' }, horns: true, ai: 'ganon', boss: true }
  };

  const toward = (en, c) => {
    const b = en.body, h = c.hero, d = Math.hypot(h.x - b.x, h.y - b.y) || 1;
    return { dx: (h.x - b.x) / d, dy: (h.y - b.y) / d, d };
  };

  A.AI = {
    // walks at the hero inside its aggro range
    chase(en, c) {
      const s = en.spec, { dx, dy, d } = toward(en, c), on = d < s.aggro;
      en.body.vx = on ? dx * s.speed : 0; en.body.vy = on ? dy * s.speed : 0;
    },
    // darts about the hero with a sideways wobble (bats, and gleeok's loose heads)
    flutter(en, c, dt) {
      const s = en.spec, { dx, dy, d } = toward(en, c);
      en.t += dt;
      if (d > s.aggro) { en.body.vx = en.body.vy = 0; return; }
      const wob = Math.sin(en.t * 5) * 0.8, px = -dy, py = dx;
      en.body.vx = (dx + px * wob) * s.speed * 0.8; en.body.vy = (dy + py * wob) * s.speed * 0.8;
    },
    // a shield that faces where it moves: it patrols until the hero is close, then charges, turning slowly
    shield(en, c, dt) {
      const s = en.spec, { dx, dy, d } = toward(en, c), b = en.body;
      if (d < 70) { b.vx = dx * s.charge; b.vy = dy * s.charge; }
      else { b.vx = en.dir * s.speed; b.vy = 0; if (b.hitWall) en.dir = -en.dir; }
      const want = d < 70 ? Math.atan2(dy, dx) : (en.dir > 0 ? 0 : Math.PI);
      const turn = A.angDiff(want, en.facing);
      en.facing += Math.max(-1.2 * dt, Math.min(1.2 * dt, turn));
    },
    // winds up, lunges at the hero, and rests
    lunge(en, c, dt) {
      const { dx, dy } = toward(en, c), b = en.body;
      en.t += dt;
      if (en.lunge > 0) { en.lunge -= dt; b.vx = dx * 105; b.vy = dy * 105; }
      else { b.vx = dx * 20; b.vy = dy * 20; if (en.t > 2.2) { en.t = 0; en.lunge = 0.55; en.blob.kick(0.4); } }
    },
    // slow random walk; when the hero is close it drifts toward them
    wander(en, c, dt) {
      const s = en.spec, { dx, dy, d } = toward(en, c), b = en.body;
      en.t += dt;
      if (en.t > 1.6) { en.t = 0; en.ang = c.rand() * Math.PI * 2; }
      const ang = en.ang || 0;
      const vx = d < 90 ? dx : Math.cos(ang), vy = d < 90 ? dy : Math.sin(ang);
      b.vx = vx * s.speed; b.vy = vy * s.speed;
    },
    // never moves; fires at the hero on an interval when in range
    fixed(en, c, dt) {
      const s = en.spec, { dx, dy, d } = toward(en, c), b = en.body;
      b.vx = b.vy = 0; en.t += dt;
      if (en.t > s.interval && d < s.range) { en.t = 0; c.shoot(b.x, b.y, dx * 70, dy * 70); en.blob.kick(0.3); }
    },
    // teleports to a spot near the hero every few seconds, and shoots when it lands
    wizzrobe(en, c, dt) {
      const b = en.body; b.vx = b.vy = 0; en.t += dt; en.shot = (en.shot || 0) + dt;
      if (en.t > 2.6) { en.t = 0; const p = c.spot(c.hero.x, c.hero.y, 70); if (p) { b.x = p[0]; b.y = p[1]; } }
      if (en.shot > 1.8) { en.shot = 0; const { dx, dy } = toward(en, c); c.shoot(b.x, b.y, dx * 75, dy * 75); }
    },
    // hovers over the room; shoots fire; a loose head is spawned each time its health drops a step
    gleeok(en, c, dt) {
      const b = en.body; en.t += dt; en.shot = (en.shot || 0) + dt;
      const home = en.home, cx = home[0] + Math.cos(en.t * 0.5) * 22, cy = home[1] + Math.sin(en.t * 0.7) * 10;
      b.vx = (cx - b.x) * 2; b.vy = (cy - b.y) * 2;
      if (en.shot > 2.2) { en.shot = 0; const { dx, dy } = toward(en, c); c.shoot(b.x, b.y, dx * 80, dy * 80); }
      const spawned = en.state.heads || 0, steps = (en.heads || 3) - 1;
      if (spawned < steps && en.hp <= en.maxHp - 2 * (spawned + 1)) { en.state.heads = spawned + 1; c.spawn('head', b.x, b.y); }
    },
    // a stone dragon on the east wall that drifts up and down and breathes three fireballs
    aqua(en, c, dt) {
      const b = en.body; en.t += dt; b.vx = 0; b.vy = Math.sin(en.t * 0.8) * 18;
      en.shot = (en.shot || 0) + dt;
      if (en.shot > 2.6) {
        en.shot = 0; const { dx, dy } = toward(en, c), a = Math.atan2(dy, dx);
        for (const off of [-0.35, 0, 0.35]) c.shoot(b.x, b.y, Math.cos(a + off) * 70, Math.sin(a + off) * 70);
      }
    },
    // its eye opens for a moment every cycle: it breathes fire while the eye is shut
    ghoma(en, c, dt) {
      const b = en.body; b.vx = b.vy = 0; en.t += dt; en.shot = (en.shot || 0) + dt;
      en.eyeOpen = (en.t % 4) > 2.5;
      if (!en.eyeOpen && en.shot > 2.0) { en.shot = 0; const { dx, dy } = toward(en, c); c.shoot(b.x, b.y, dx * 70, dy * 70); }
    },
    // teleports around the hero and throws fire; it is only hurt once its shield has been broken with the sword
    ganon(en, c, dt) {
      const b = en.body; b.vx = b.vy = 0; en.t += dt; en.shot = (en.shot || 0) + dt;
      if (en.t > 3.2) { en.t = 0; const p = c.spot(c.hero.x, c.hero.y, 80); if (p) { b.x = p[0]; b.y = p[1]; } }
      if (en.shot > 1.6) { en.shot = 0; const { dx, dy } = toward(en, c); for (const off of [-0.2, 0.2]) { const a = Math.atan2(dy, dx) + off; c.shoot(b.x, b.y, Math.cos(a) * 80, Math.sin(a) * 80); } }
    }
  };
})(ASH);
