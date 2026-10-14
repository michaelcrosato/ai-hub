/* Dust & Mercy — the abandoned Cinder No. 4 workings.
 * A connected route in Cinder Valley, using the engine's side-view kit.
 * Public integration: WesternMine.create(E, game, callbacks) -> { scene, debug }.
 */
(() => {
  'use strict';

  function create(E, game, callbacks = {}) {
    const T = 16, W = 44, H = 15, BLOCK = 30, CACHE = { x: 646, y: 0, z: 32 };
    const P = E.px;
    const rig = callbacks.rig || new E.Humanoid({
      build: 'heroic', size: 1.25, outfit: 'coat', hair: 'short', hat: { style: 'cap', color: '#7e6847' }, weapon: 'gun', sleeves: 'long',
      colors: { skin: '#b88560', hair: '#322820', cloth: '#65726a', coat: '#756a4b', pants: '#373e43', boot: '#332920', metal: '#a8a99a' }
    });
    const background = new E.Backdrop({
      sky: ['#111917', '#26312b', '#4b4a38'], stars: 0,
      layers: [
        { kind: 'stalactites', color: '#19221e', y: .02, height: .12, parallax: .15, seed: 87 },
        { kind: 'mountains', color: '#303b30', y: .7, height: .22, parallax: .2, seed: 31 },
        { kind: 'fog', color: '#697263', y: .83, height: .09, parallax: .08, fill: false }
      ]
    });
    const song = {
      bpm: 62, steps: 2, tracks: [
        { wave: 'triangle', vol: .045, notes: 'D2 - - - . . A2 - D2 - . . C2 - A1 -' },
        { wave: 'sine', vol: .075, notes: '. . A4 - . . F4 - . . E4 - D4 - - - . . . . A3 - C4 - D4 - - - . . . .' }
      ]
    };
    const shots = new E.Bullets(game, { plane: 'side', max: 48 });
    const bash = new E.Attack('bash', { wind: .12, active: .14, recover: .23 });
    const timberTarget = { x: BLOCK * T + 8, y: 0, z: 32, r: 10 };
    const input = Object.assign({}, E.Input.PLATFORMER, { interact: ['KeyE', 'Pad2'], view: ['KeyV', 'Pad9'] });
    const batRigs = Array.from({ length: 5 }, () => new E.Blob({
      R: 3.5, ears: 'cat', wings: true, mouth: true,
      colors: { dk: '#201d25', base: '#514958', lt: '#797281', spec: '#a49b96', eye: '#d5ba75', pupil: '#181a1a' }
    }));
    let level, hero, lift, bats, debris = [], elapsed = 0, cooldown = 0, hurt = 0, sparkle = 0;
    let barricadeHP = 4, claimed = false, enteredClaimed = false, bonus = false, exited = false;
    let checkpoint = { x: 42, z: 32 }, rope = 0, context = '', hint = '', stats, savedLighting, savedParticleGround;
    let priorMocap = null, priorMocapWeight;

    function toast(title, text) {
      if (callbacks.onToast) callbacks.onToast(title, text);
      else if (game.shell) game.shell.toast(title, text, 2.4);
      else game.note(title, 2.4);
    }

    function build() {
      const cells = Array.from({ length: H }, () => Array(W).fill(' '));
      const at = (x, z, c) => { cells[H - 1 - z][x] = c; };
      for (let x = 0; x < W; x++) {
        at(x, 0, '#'); at(x, 1, '#');
        at(x, 14, '#');
        if (x % 7 < 3) at(x, 13, 'b');
      }
      at(6, 2, '/'); at(7, 2, '#'); at(8, 2, '\\');
      for (let z = 2; z <= 5; z++) { at(14, z, 'H'); at(27, z, 'H'); }
      for (let x = 12; x <= 18; x++) if (x !== 14) at(x, 5, '=');
      for (let x = 23; x <= 28; x++) if (x !== 27) at(x, 5, '=');
      for (let x = 19; x <= 22; x++) { at(x, 1, '~'); }
      for (let z = 2; z < 13; z++) at(BLOCK, z, '|');
      at(3, 10, 'd'); at(37, 10, 'd');
      level = new E.PlatformMap({ rows: cells.map(row => row.join('')), depth: 22,
        legend: { '#': 1, '=': 2, H: 3, '/': 4, '\\': 5, '~': 6, b: 7, '|': 8, d: 9 },
        types: {
          1: { kind: 'solid', style: 'stone', side: '#4b4c3d', top: '#817c59', line: '#2a302a', moss: '#505d43' },
          2: { kind: 'oneway', style: 'plank', side: '#796144', top: '#c5a574' },
          3: { kind: 'ladder', style: 'ladder', side: '#a08963' },
          4: { kind: 'slope', style: 'stone', dir: 1, side: '#64624a', top: '#a39871' },
          5: { kind: 'slope', style: 'stone', dir: -1, side: '#64624a', top: '#a39871' },
          6: { kind: 'hazard', style: 'liquid', side: '#478c7e', top: '#afd0a6' },
          7: { kind: 'back', style: 'stone', side: '#303c32', top: '#41513d' },
          8: { kind: 'solid', style: 'wood', side: '#776043', top: '#9d8058' },
          9: { kind: 'deco', style: 'metal', side: '#665c40', top: '#a29563' }
        }
      });
    }

    function clearBarricade() {
      if (barricadeHP > 0) return;
      for (let z = 2; z < 13; z++) level.set(BLOCK, z, 0);
    }

    function damageBarricade(amount, z = 56) {
      if (barricadeHP <= 0) return;
      barricadeHP = Math.max(0, barricadeHP - amount);
      game.particles.bits(BLOCK * T, 0, z, 7, ['#a58c63', '#6f5236', '#d3bc87']);
      game.audio.sfx('bump', { pitch: .7, vol: .4 });
      game.shake(.9);
      if (barricadeHP === 0) {
        clearBarricade(); stats.breached = true;
        game.particles.smoke(BLOCK * T, 0, 70, 6, { color: '#aa9670', size: 5 });
        game.audio.sfx('secret', { pitch: .7, vol: .5 });
        toast('THE OLD WORKINGS', 'The rotten seal gives. Someone hid supplies beyond it.');
      }
    }

    function enter(data = {}) {
      build();
      hero = new E.Platformer({ x: 42, z: 32, w: 10, h: 33, run: 100, jump: 265,
        gravity: 780, fallGravity: 980, dash: 185, dashTime: .15, wallJump: true, airJumps: 1, climb: 65, stepUp: 6 });
      lift = { x: 337, z: 53, w: 40, h: 6, vx: 0, vz: 0, oneway: true };
      elapsed = cooldown = hurt = sparkle = rope = 0;
      claimed = enteredClaimed = !!data.claimed; bonus = !!data.bonus; exited = false;
      barricadeHP = data.breached ? 0 : 4; clearBarricade();
      checkpoint = { x: 42, z: 32 };
      stats = { jumps: 0, ropes: 0, dashes: 0, shots: 0, hits: 0, falls: 0, ladder: false, lift: false, chamber: false, crates: 0, breached: !!data.breached, bonus: 0, seconds: 0 };
      debris = [552, 576].map(x => ({ x, y: 0, z: 32, w: 16, h: 36, r: 10, dead: false }));
      bats = batRigs.map((body, i) => ({ rig: body, x: 246 + i * 72, y: -9, z: 169 + (i % 2) * 9, home: 246 + i * 72, fly: false, r: 5 }));
      shots.clear(); bash.cancel();
      savedLighting = { enabled: game.lights.enabled, ambient: game.lights.ambient };
      game.lights.enabled = true; game.lights.ambient = .72;
      savedParticleGround = game.particles.ground;
      game.particles.ground = (x, y, z) => {
        if (Math.abs(x - lift.x) < lift.w / 2 && z >= lift.z + lift.h - 1) return Math.max(level.groundBelow(x, z) || 0, lift.z + lift.h);
        return level.groundBelow(x, z) || 0;
      };
      priorMocap = rig.mocap; priorMocapWeight = rig.mocapW;
      rig.mocap = null; rig.mocapW = 0;
      game.follow(hero, { z: 38, lead: 22 });
      game.cam.bounds = view => level.bounds(view); game.cam.room = null; game.cam.offset = [0, game.upright ? -30 : -3]; game.cam.smooth = .12; game.cam.snap = true;
      if (game.shell) { game.shell.hud({}); game.shell.tutorial(null); }
      game.audio.music(song);
      toast('CINDER NO. 4', 'An old handline, an ore lift, and a cache the company forgot.');
      rig.update(0, hero.rigState());
      updateContext();
    }

    function exit() {
      shots.clear(); bash.cancel(); game.particles.ground = savedParticleGround;
      if (savedLighting) Object.assign(game.lights, savedLighting);
      rig.mocap = priorMocap; rig.mocapW = priorMocapWeight;
      game.cam.room = null; game.cam.offset = [0, 0];
      if (game.shell) game.shell.hud({});
    }

    function leave() {
      if (exited) return;
      exited = true;
      const reward = { medicine: claimed && !enteredClaimed ? 2 : 0,
        silver: (claimed && !enteredClaimed ? 24 : 0) + stats.bonus,
        claimed, bonus, breached: barricadeHP <= 0, completed: claimed, stats: { ...stats, seconds: Math.round(elapsed) } };
      if (callbacks.onExit) callbacks.onExit(reward);
      else { exited = false; toast('BACK TO THE VALLEY', 'The mine exit is ready.'); }
    }

    function damage() {
      if (hurt > 0) return;
      stats.falls++; hurt = 1.6;
      game.particles.sparks(hero.x, 0, hero.z + 10, 8, null, { color: '#99bc8f' });
      game.audio.sfx('hurt', { pitch: .7, vol: .45 }); game.flash('#99b98b', .1, .25);
      Object.assign(hero, { x: checkpoint.x, z: checkpoint.z, vx: 0, vz: 0, climbing: false, onGround: false, drop: 0, dashing: 0 });
      game.cam.snap = true;
      if (callbacks.onHurt) callbacks.onHurt(8);
      toast('MIND YOUR FOOTING', 'The runoff stings. You pull yourself back onto dry rock.');
    }

    function fire() {
      if (cooldown > 0 || bash.busy) return;
      const nearSeal = barricadeHP > 0 && Math.abs(hero.x - (BLOCK * T + 8)) < 43 && hero.z < 100;
      if (nearSeal) {
        hero.facing = hero.x < BLOCK * T ? 1 : -1;
        bash.start(); cooldown = .5; return;
      }
      cooldown = .42; stats.shots++;
      const origin = { x: hero.x + hero.facing * 12, y: 0, z: hero.z + 26 };
      const angle = hero.facing > 0 ? 0 : Math.PI;
      const crate = debris.find(item => !item.dead && (item.x - hero.x) * hero.facing > 0 && Math.abs(item.x - hero.x) < 190);
      const aim = barricadeHP > 0 && (BLOCK * T - hero.x) * hero.facing > 0
        ? { x: BLOCK * T + 8, z: E.clamp(origin.z, 38, 186) }
        : crate ? { x: crate.x, z: crate.z + crate.h / 2 } : { x: origin.x + hero.facing * 160, z: origin.z };
      shots.burst({ ...origin, team: 'miner', color: '#f1d395', r: 1.25, life: 1.8, pierce: true,
        onWall(b) { if (Math.floor(b.x / T) === BLOCK) damageBarricade(1, b.z); }
      }, [E.pattern.aimSide(origin, aim, 310)]);
      game.particles.sparks(origin.x, 0, origin.z, 4, angle, { color: '#efcb86', speed: 35 });
      game.audio.sfx('shoot', { pitch: .7, vol: .45 });
      for (const bat of bats) if (Math.abs(bat.x - hero.x) < 150) bat.fly = true;
    }

    function updateContext() {
      context = ''; hint = '';
      if (hero.x < 78 && hero.z < 80) { context = 'RETURN TO VALLEY'; hint = claimed ? 'Medicine secured. Bring it back to camp.' : 'You can leave the workings at any time.'; }
      else if (!claimed && Math.abs(hero.x - CACHE.x) < 36 && hero.z < 75) { context = 'OPEN THE SUPPLY CACHE'; hint = 'Two field dressings · $24 in company scrip'; }
      else if (!bonus && Math.abs(hero.x - 412) < 25 && Math.abs(hero.z - 96) < 19) { context = 'POCKET THE SILVER'; hint = 'A miner never collected his last pay.'; }
      else if (barricadeHP > 0 && Math.abs(hero.x - 488) < 76) hint = `The timber seal is rotten. ${game.input.label('attack')} to break it.`;
      else if (hero.x > 190 && hero.x < 380) hint = `Climb the ladder. Ride the lift. ${game.input.label('jump')} twice catches the handline.`;
      else hint = `Keep dry. ${game.input.label('dash')} to dash; ${game.input.label('view')} changes your view.`;
      game.input.touchSet('interact', context ? 'USE' : null, !!context);
      game.input.touchSet('attack', 'BREAK / FIRE', true);
      game.input.touchSet('view', 'VIEW', true);
    }

    function update(dt) {
      if (exited) return;
      elapsed += dt; stats.seconds = elapsed;
      cooldown = Math.max(0, cooldown - dt); hurt = Math.max(0, hurt - dt); rope = Math.max(0, rope - dt);
      const I = game.input;
      if (I.pressed('view')) game.nextView();
      const previousLift = lift.z;
      lift.z = 64 + Math.sin(elapsed * .83 - .35) * 30;
      lift.vz = dt > 0 ? (lift.z - previousLift) / dt : 0;
      const wasGround = hero.onGround, wasClimbing = hero.climbing, wasDashing = hero.dashing > 0;
      hero.update(dt, level, I, [lift, ...debris.filter(item => !item.dead)]);
      // The last chamber rests on overlapping framed rooms; the approach follows freely.
      // Room width stays smaller than the viewport even on a portrait phone.
      game.cam.room = hero.x > 515 ? [game.W / game.view.scale * .65, .001] : null;
      if (game.cam.room) stats.chamber = true;
      if (hero.jumped) {
        stats.jumps++; game.audio.sfx('jump', { pitch: .68, vol: .2 });
        if (!wasGround && !wasClimbing) { rope = .28; stats.ropes++; game.audio.sfx('whoosh', { pitch: .65, vol: .22 }); }
      }
      if (hero.landed) { game.particles.dust(hero.x, 0, hero.z, 3, { color: '#c0ab83', size: 1.2 }); game.audio.sfx('land', { pitch: .75, vol: .18 }); }
      if (hero.climbing) stats.ladder = true;
      if (hero.ground === lift) stats.lift = true;
      if (hero.dashing > 0 && !wasDashing) { stats.dashes++; game.audio.sfx('whoosh', { pitch: .65, vol: .2 }); }
      if (level.touching(hero, 'hazard') || hero.z < -30) damage();
      if (hero.onGround && hero.z < 50 && (hero.x < 288 || hero.x > 380) && !level.touching(hero, 'hazard')) checkpoint = { x: hero.x, z: hero.z };
      if (I.pressed('attack')) fire();
      if (bash.update(dt) === 'active') game.audio.sfx('swing', { pitch: .65, vol: .25 });
      if (barricadeHP > 0) bash.hits([timberTarget], target => Math.abs(hero.x - target.x) < 45 && hero.z < 100,
        () => { stats.hits++; damageBarricade(2, hero.z + 21); });
      shots.update(dt, level);
      shots.hit(debris, (bullet, crate) => {
        crate.dead = true; stats.crates++;
        game.particles.bits(crate.x, 0, crate.z + 20, 9, ['#ab8b58', '#7a603a', '#d1b880']);
        game.audio.sfx('bump', { pitch: .8, vol: .25 });
      }, 'miner');
      shots.hit(bats, (bullet, bat) => { bat.fly = true; bat.rig.kick(1.2); }, 'miner');
      for (let i = 0; i < bats.length; i++) {
        const bat = bats[i];
        if (Math.abs(hero.x - bat.home) < 55) bat.fly = true;
        if (bat.fly) { bat.x = bat.home + Math.sin(elapsed * 1.7 + i) * 36; bat.z = 158 + Math.sin(elapsed * 2.5 + i * 1.9) * 22; }
        bat.rig.update(dt, { flap: bat.fly ? .7 : 0, hang: !bat.fly, look: [Math.cos(elapsed * 1.7 + i), -.2] });
      }
      sparkle += dt;
      if (sparkle > .15) {
        sparkle = 0;
        const px = hero.x + Math.sin(elapsed * 5.4) * 75;
        game.particles.add({ kind: 'dust', x: px, y: -8, z: 122 + Math.sin(elapsed * 4.1) * 45, vx: -1, vy: 0, vz: -7, life: 1.5, size: .6, color: '#9e987a' });
        if (hero.dashing > 0) game.particles.dust(hero.x, 0, hero.z, 2, { color: '#a68e62', size: 1.5 });
      }
      rig.update(dt, hero.rigState({ attack: bash.state, point: cooldown > .2 && !bash.busy, hurt: hurt > 0, expr: hurt > 0 ? 'wince' : null }));
      updateContext();
      if (I.pressed('interact') && context) {
        I.consume('interact');
        if (hero.x < 78) leave();
        else if (!claimed && Math.abs(hero.x - CACHE.x) < 36) {
          claimed = true; game.audio.sfx('pickup', { pitch: .7, vol: .55 });
          game.particles.glints(CACHE.x, 0, CACHE.z + 14, 10, '#eed899');
          toast('NOT ALL THAT GLITTERS', 'Two field dressings and $24. Enough to make the dark worthwhile.');
        } else if (!bonus && Math.abs(hero.x - 412) < 25) {
          bonus = true; stats.bonus += 6; game.audio.sfx('coin', { pitch: .65, vol: .4 });
          game.particles.glints(412, 0, 106, 8, '#e8d9b4'); toast('A LITTLE LUCK', 'You found $6 in silver on the high gantry.');
        }
        updateContext();
      }
    }

    function beam(r, x) {
      r.queue(x, -10, 32, g => {
        r.box(g, x - 3, -13, 32, x + 3, -7, 184, '#aa9168', '#6a563b');
        r.box(g, x - 6, -13, 174, x + 74, -7, 182, '#a38c64', '#624d36');
        const a = r.w(x, -6, 154), b = r.w(x + 22, -6, 178);
        P.line(g, ...a, ...b, '#7e6847', Math.max(2, Math.round(4 * (r.view.zoom || 1))));
        for (const z of [44, 168]) { const a = r.w(x, -5, z); P.dot(g, a[0], a[1], '#c2b17e'); }
      });
      r.prop('lantern', x + 34, -7, 174, { anchor: 'top', size: .95, light: true, haloR: 21, haloColor: '#e6b36d' });
    }

    function draw(r) {
      background.draw(r);
      // Far wall strata and recesses use world coordinates so they remain fixed as the camera travels.
      for (let x = 16; x < W * T; x += 64) {
        const g = r.ctx;
          const a = r.w(x, -30, 35), b = r.w(x + 53, -30, 171);
          P.rect(g, a[0], b[1], b[0] - a[0], a[1] - b[1], x % 128 ? '#25332a' : '#29352b');
          for (let k = 0; k < 5; k++) {
            const p = r.w(x + 2, -30, 50 + k * 24), q = r.w(x + 50, -30, 53 + k * 24);
            P.line(g, ...p, ...q, k % 2 ? '#3b4533' : '#374232');
          }
      }
      level.draw(r);
      for (const x of [34, 144, 244, 380, 536, 630]) beam(r, x);
      for (const x of [86, 188, 393, 571]) {
        r.prop('rock', x, 7, 32, { size: .65, color: '#74735b' });
        r.prop('crystal', x + 9, -9, 32, { size: .55, color: '#80b4a0', haloR: 13 });
      }
      r.prop('barrel', 104, -6, 32, { size: .85 }); r.prop('crate', 609, -5, 32, { size: .8 });
      for (const crate of debris) if (!crate.dead) {
        r.prop('crate', crate.x, 0, crate.z, { size: .9, color: '#a18459' });
        r.prop('crate', crate.x, 0, crate.z + 16, { size: .85, color: '#a18459' });
      }
      r.prop('cobweb', 153, -4, 178, { size: .9, anchor: 'top', color: '#797f68' });
      r.prop('cobweb', 547, -4, 178, { size: .8, anchor: 'top', color: '#797f68' });
      r.prop('bones', 452, 3, 32, { size: .7, color: '#acaa87' });
      r.prop('sign', 50, -5, 32, { size: 1, color: '#89714c' });
      // The guide rope, lift cables and tracks make the traversal route legible.
      r.queue(338, -5, 146, g => {
        let last = null;
        for (let x = 202; x <= 448; x += 5) {
          const p = r.w(x, -5, 145 - Math.sin((x - 202) / 246 * Math.PI) * 12);
          if (last) P.line(g, ...last, ...p, '#a5976c'); last = p;
        }
      });
      r.queue(lift.x, 0, lift.z, g => {
        for (const xx of [lift.x - 16, lift.x + 16]) { const a = r.w(xx, 0, lift.z + 5), b = r.w(xx, 0, 204); P.line(g, ...a, ...b, '#b7a477'); }
        r.box(g, lift.x - lift.w / 2, -10, lift.z, lift.x + lift.w / 2, 10, lift.z + lift.h, '#c4a578', '#716047');
        for (let x = lift.x - 14; x < lift.x + 20; x += 7) { const a = r.w(x, 0, lift.z + lift.h); P.dot(g, a[0], a[1], '#e5c693'); }
      });
      r.queue(250, 2, 33, g => {
        for (const [a, b] of [[30, 298], [376, 678]]) {
          for (const y of [-4, 4]) { const p = r.w(a, y, 33), q = r.w(b, y, 33); P.line(g, ...p, ...q, '#aaa17a'); }
          for (let x = a; x < b; x += 12) { const p = r.w(x, -7, 32), q = r.w(x, 7, 32); P.line(g, ...p, ...q, '#67583c', 2); }
        }
      });
      r.prop('chest', CACHE.x, -3, CACHE.z, { size: 1.1, open: claimed, color: '#bd9b5b' });
      if (!claimed) game.lights.add(CACHE.x, 0, 52, 45, .65, { color: '#efca84' });
      if (!bonus) r.prop('pot', 412, -3, 96, { size: .65, color: '#b8ae80' });
      for (const bat of bats) r.actor(bat.x, bat.y, bat.z, (g, ox, oy) => bat.rig.draw(g, ox, oy, r.view), { outline: false, rim: false });
      const ground = hero.ground === lift ? lift.z + lift.h : level.groundBelow(hero.x, hero.z + .1) || 16;
      r.shadow(hero.x, 0, 7, .35, '#111c19', ground);
      const actorStyle = {
        flash: hurt > 0 && Math.floor(hurt * 9) % 2 ? '#d3d7bd' : null,
        ghost: hero.dashing > 0 ? { color: '#c8bc8d', life: .15, alpha: .15, owner: hero } : null,
        xray: { color: '#e5ce99', outline: true }
      };
      if (globalThis.WesternWorld?.drawCowboy) globalThis.WesternWorld.drawCowboy(r, E, hero, rig, { ...actorStyle, mounted: true, rideZ: 0 });
      else r.actor(hero.x, 0, hero.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view), actorStyle);
      if (rope > 0) {
        r.queue(hero.x, 1, hero.z + 26, g => {
          const a = r.w(hero.x + hero.facing * 3, 0, hero.z + 30), b = r.w(hero.x + 8, -5, 145);
          P.line(g, ...a, ...b, '#d8ca9d');
        });
      }
      rig.drawSmear(r); shots.draw(r);
      // World labels supplement color and point toward the objective without covering the character.
      if (barricadeHP > 0 && Math.abs(hero.x - 488) < 90) r.textAt(488, 0, 112, 'ROTTEN TIMBER', '#dcc58f', { align: 'center', font: 'tiny' });
      if (!claimed && hero.x > 540) r.textAt(CACHE.x, 0, 80, 'MEDICINE', '#efdba3', { align: 'center', font: 'tiny' });
      const touch = game.input.touchArea(), bottom = touch ? Math.max(52, r.H - touch.y0 + 11) : 19;
      r.overlay(g => {
        const textStyle = { font: 'normal', scale: game.upright ? 2 : 1 };
        E.font.text(g, 'CINDER NO. 4', 10, 11, '#e9d29b', { scale: textStyle.scale, shadow: '#111c19' });
        E.font.text(g, claimed ? 'CACHE SECURED / RETURN TO THE ENTRANCE' : 'FOLLOW THE HANDLINE / RECOVER THE CACHE', 10, game.upright ? 31 : 23, '#b3bb9d', { font: 'tiny', wrap: r.W - 58 });
        const shortHint = barricadeHP > 0 && Math.abs(hero.x - 488) < 76 ? `${game.input.label('attack')}: break the timber seal.`
          : hero.x > 190 && hero.x < 380 ? `${game.input.label('jump')} twice: rope catch. Up: climb.` : `${game.input.label('dash')}: dash. Keep clear of runoff.`;
        const footer = context ? `${game.input.label('interact')}  ${context}` : game.upright ? shortHint : hint;
        const lines = E.font.wrap(footer, r.W - 28, textStyle);
        const height = E.font.height(lines.length, textStyle);
        const y = Math.max(40, r.H - bottom - height);
        E.ui.box(g, 7, y - 6, r.W - 14, height + 12, { bg: '#18251f', border: '#6d7052', shadow: false, gradient: false });
        E.font.text(g, lines.join('\n'), r.W / 2, y, context ? '#f1dcaa' : '#c1c5a8', { ...textStyle, align: 'center', shadow: '#152019' });
      });
    }

    const scene = {
      pausable: true, view: 'side', views: ['side', 'brawler'], input, res: 'ps1', expand: true,
      touch: ['jump', 'attack', 'dash', 'interact', 'view'], propSize: 1.3,
      camera: { zoom: [.85, 1.65], start: 1, tall: 2.15 }, enter, exit, update, draw
    };
    const debug = {
      snapshot() {
        return { scene: game.sceneName, hero: hero ? { x: +hero.x.toFixed(2), z: +hero.z.toFixed(2), vx: +hero.vx.toFixed(2), vz: +hero.vz.toFixed(2), ground: hero.onGround, climbing: hero.climbing, facing: hero.facing } : null,
          lift: lift ? { x: lift.x, z: +lift.z.toFixed(2), top: +(lift.z + lift.h).toFixed(2) } : null,
          claimed, enteredClaimed, bonus, barricadeHP, context, checkpoint, debris: debris.filter(item => !item.dead).length,
          room: game.cam.room, stats: stats ? { ...stats } : null, errors: game.errors.map(e => e.message) };
      },
      teleport(x, z = 32, facing = 1) {
        Object.assign(hero, { x, z, vx: 0, vz: 0, facing, climbing: false, onGround: false, drop: 0, dashing: 0 });
        game.cam.snap = true; updateContext();
      },
      get level() { return level; }
    };
    return { scene, debug };
  }

  globalThis.WesternMine = { create };
})();
