/* Breakwater skater: original, faceted procedural art. No rendering dependencies.
 * window.BreakwaterRig.draw(player, seconds, addFace) emits 197 world-space faces.
 * Board base is player.z; local +X is forward, +Y is the rider's heel side.
 * pushPhase is in radians. Landing compression is inferred for stable player objects;
 * callers may also provide landingCompression (0..1) explicitly.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const DECK_Z = 0.64;
  const history = new WeakMap();
  const colorCache = new Map();
  const C = {
    cream: '#e8e1c8', teal: '#285b61', pants: '#273c43', stripe: '#39828a',
    skin: '#c99773', cap: '#e8663e', sole: '#e4dfcf', dark: '#203038',
    metal: '#a4afb0', wheel: '#d9d0ae', grip: '#344346'
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, fallback) => Number.isFinite(v) ? v : fallback;
  const mix = (a, b, t) => a + (b - a) * t;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => mul(a, 1 / Math.max(0.00001, Math.hypot(a[0], a[1], a[2])));
  const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const rx = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
  const ry = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
  const rz = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];

  function shade(hex, scale) {
    const key = hex + ':' + scale;
    if (colorCache.has(key)) return colorCache.get(key);
    const packed = parseInt(hex.slice(1), 16);
    const channel = shift => Math.round(clamp(((packed >> shift) & 255) * scale, 0, 255)).toString(16).padStart(2, '0');
    const result = '#' + channel(16) + channel(8) + channel(0);
    if (colorCache.size > 256) colorCache.clear();
    colorCache.set(key, result);
    return result;
  }

  function frame(a, b) {
    const w = unit(sub(b, a));
    const u = unit(cross(Math.abs(w[1]) < 0.93 ? [0, 1, 0] : [1, 0, 0], w));
    return { u, v: unit(cross(w, u)), w };
  }

  // Two-bone IK keeps planted shoes and deep airborne knee tucks coherent.
  function knee(a, b, lengthA, lengthB, preferredBend) {
    const delta = sub(b, a);
    const distance = clamp(Math.hypot(...delta), 0.02, lengthA + lengthB - 0.001);
    const direction = unit(delta);
    let bend = sub(preferredBend, mul(direction, dot(preferredBend, direction)));
    if (Math.hypot(...bend) < 0.001) bend = cross(direction, [1, 0, 0]);
    bend = unit(bend);
    const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
    const out = Math.sqrt(Math.max(0, lengthA * lengthA - along * along));
    return add(add(a, mul(direction, along)), mul(bend, out));
  }

  function draw(p, t, addFace) {
    if (!p || typeof addFace !== 'function') return 0;
    t = num(t, 0);
    const mode = p.mode || 'ground';
    const anim = p.anim || '';
    const progress = clamp(num(p.animProgress, 0), 0, 1);
    const envelope = Math.sin(Math.PI * progress);
    const balance = clamp(num(p.balance, 0), -1, 1);
    const speed = Math.abs(num(p.speed, 0));
    const heading = num(p.visualDir, 0);
    const origin = [num(p.x, 0), num(p.y, 0), num(p.z, 0)];
    const deckColor = /^#[0-9a-f]{6}$/i.test(p.deckColor || '') ? p.deckColor : '#d5f268';
    const isAir = mode === 'air';
    const isBail = mode === 'bail';
    const grab = anim === 'grab' ? envelope : 0;
    const flip = anim === 'flip' || anim === 'heelflip' || anim === 'special';
    const trick = flip || anim === 'shove';

    let state = history.get(p);
    if (!state) {
      state = { mode, landingAt: -1000, bailAt: t };
      history.set(p, state);
    }
    if (state.mode === 'air' && (mode === 'ground' || mode === 'manual' || mode === 'grind')) state.landingAt = t;
    if (isBail && state.mode !== 'bail') state.bailAt = t;
    state.mode = mode;
    const landingTime = t - state.landingAt;
    const landing = Math.max(clamp(num(p.landingCompression, 0), 0, 1), landingTime >= 0 ? Math.max(0, 1 - landingTime / 0.24) : 0);
    const bailTime = Math.max(0, t - state.bailAt);
    const push = mode === 'ground' && !anim && speed > 0.2 && speed < 55
      ? Math.pow(Math.max(0, Math.sin(num(p.pushPhase, t * 5))), 2) * clamp(speed / 5, 0, 1) * (1 - clamp(num(p.crouch, 0), 0, 1))
      : 0;
    const crouch = clamp(Math.max(num(p.crouch, 0), isAir ? 0.24 + grab * 0.70 + (trick ? envelope * 0.31 : 0) : 0) + landing * 0.64, 0, 1);
    const coastBob = mode === 'ground' ? Math.sin(t * 7) * Math.min(speed / 25, 1) * 0.025 : 0;
    const turn = TAU * progress;

    let boardRoll = mode === 'grind' ? balance * 0.12 : 0;
    let boardPitch = mode === 'manual' ? -0.19 - balance * 0.055 : 0;
    let boardYaw = 0;
    let boardLift = 0;
    let boardX = 0;
    let boardY = 0;
    if (isAir) boardPitch -= Math.sin(TAU * progress) * 0.10;
    if (anim === 'flip') boardRoll += turn;
    if (anim === 'heelflip') boardRoll -= turn;
    if (anim === 'shove') boardYaw = turn;
    if (anim === 'special') { boardRoll += turn * 2; boardYaw = turn; boardPitch += envelope * 0.24; }
    if (anim === 'grab') { boardRoll -= grab * 0.30; boardPitch -= grab * 0.19; boardLift += grab * 0.70; }
    if (isBail) {
      boardRoll = bailTime * 5.3;
      boardPitch = 0.26;
      boardYaw = bailTime * 2.4;
      boardX = -Math.min(bailTime * 2.0, 1.2);
      boardY = -0.25;
      boardLift = Math.max(0, Math.sin(Math.min(bailTime / 0.5, 1) * Math.PI)) * 0.45;
    }

    function boardPose(v) {
      return add(rz(ry(rx(v, boardRoll), boardPitch), boardYaw), [boardX, boardY, DECK_Z + boardLift]);
    }
    function supportPose(v) {
      const roll = trick ? 0 : boardRoll;
      const pitch = trick ? 0 : boardPitch;
      const yaw = trick ? 0 : boardYaw;
      return add(rz(ry(rx(sub(v, [0, 0, DECK_Z]), roll), pitch), yaw), [0, 0, DECK_Z + (trick ? 0 : boardLift)]);
    }
    function bodyPose(v) {
      if (!isBail) return v;
      const fall = clamp(bailTime / 0.28, 0, 1);
      const ease = 1 - Math.pow(1 - fall, 3);
      return add(rx(sub(v, [0, 0, 0.8]), -mix(0.25, 1.47, ease)), [0.65 * ease, 0.38 * ease, mix(0.8, 0.58, ease)]);
    }
    let count = 0;
    const cosH = Math.cos(heading), sinH = Math.sin(heading);
    function emit(points, color, transform) {
      const fn = transform || bodyPose;
      addFace(points.map(point => {
        const v = fn(point);
        return [origin[0] + v[0] * cosH - v[1] * sinH, origin[1] + v[0] * sinH + v[1] * cosH, origin[2] + v[2]];
      }), color);
      count++;
    }

    // Closed, tapered rectangular or chamfered prisms: six or ten faces.
    function prism(a, b, widthA, depthA, widthB, depthB, color, transform, chamfer, accent) {
      const f = frame(a, b);
      const ring = chamfer
        ? [[-0.40, -0.5], [0.40, -0.5], [0.5, -0.35], [0.5, 0.35], [0.40, 0.5], [-0.40, 0.5], [-0.5, 0.35], [-0.5, -0.35]]
        : [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      const at = (center, width, depth) => ring.map(v => add(add(center, mul(f.u, v[0] * width)), mul(f.v, v[1] * depth)));
      const lower = at(a, widthA, depthA), upper = at(b, widthB, depthB);
      emit(lower.slice().reverse(), shade(color, 0.67), transform);
      emit(upper, shade(color, 1.08), transform);
      const tones = chamfer ? [0.96, 1.06, 0.89, 0.79, 0.73, 0.80, 0.94, 1.02] : [1.01, 0.86, 0.72, 0.94];
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        emit([lower[i], lower[j], upper[j], upper[i]], accent && i === 3 ? accent : shade(color, tones[i]), transform);
      }
      return f;
    }
    function block(center, size, color, transform) {
      prism(add(center, [0, 0, -size[2] / 2]), add(center, [0, 0, size[2] / 2]), size[0], size[1], size[0], size[1], color, transform);
    }

    // A truly rotating, kicked-up deck. Three top and three bottom facets keep
    // the nose and tail planar instead of folding one nonplanar polygon.
    const top = [[-2.45, -0.50, 0.28], [-2.05, -0.76, 0.10], [2.05, -0.76, 0.10], [2.45, -0.50, 0.28], [2.45, 0.50, 0.28], [2.05, 0.76, 0.10], [-2.05, 0.76, 0.10], [-2.45, 0.50, 0.28]];
    const bottom = top.map(v => [v[0], v[1], v[2] - 0.22]);
    const deckFacets = [[0, 1, 6, 7], [1, 2, 5, 6], [2, 3, 4, 5]];
    deckFacets.forEach((ids, i) => {
      emit(ids.map(k => top[k]), shade(deckColor, i === 1 ? 0.94 : 1.03), boardPose);
      emit(ids.slice().reverse().map(k => bottom[k]), shade(deckColor, i === 1 ? 0.76 : 0.65), boardPose);
    });
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      emit([bottom[i], bottom[j], top[j], top[i]], shade(deckColor, [0.72, 0.84, 0.94, 1.00, 0.76, 0.70, 0.66, 0.69][i]), boardPose);
    }
    emit([[-1.99, -0.64, 0.111], [1.99, -0.64, 0.111], [1.99, 0.64, 0.111], [-1.99, 0.64, 0.111]], C.grip, boardPose);
    [-1.62, 1.62].forEach(x => {
      emit([[x - 0.035, -0.46, 0.121], [x + 0.035, -0.46, 0.121], [x + 0.035, 0.46, 0.121], [x - 0.035, 0.46, 0.121]], '#88928b', boardPose);
      block([x, 0, -0.255], [0.38, 1.28, 0.24], C.metal, boardPose);
      [-0.70, 0.70].forEach(y => {
        const rings = [-0.13, 0.13].map(offset => Array.from({ length: 6 }, (_, i) => {
          const angle = i * TAU / 6;
          return [x + Math.cos(angle) * 0.27, y + offset, -0.36 + Math.sin(angle) * 0.27];
        }));
        // Ring order is reversed across the axle to keep outward normals.
        emit(rings[0], shade(C.wheel, 0.78), boardPose);
        emit(rings[1].slice().reverse(), shade(C.wheel, 1.02), boardPose);
        for (let i = 0; i < 6; i++) {
          const j = (i + 1) % 6;
          emit([rings[0][i], rings[1][i], rings[1][j], rings[0][j]], shade(C.wheel, [0.88, 1.03, 0.96, 0.73, 0.66, 0.75][i]), boardPose);
        }
      });
    });

    function foot(front) {
      const side = front ? 1 : -1;
      const lift = trick ? envelope * (anim === 'special' ? 1.02 : 0.76) : 0;
      const center = [side * (1.23 + (trick ? envelope * 0.22 : 0)), front ? -0.035 : 0.045, 0.955 + lift];
      let yaw = front ? 0.34 : -0.10;
      if (!front) {
        center[0] -= push * 0.78;
        center[1] -= push * 0.56;
        center[2] -= push * 0.70;
        yaw -= push * 0.22;
      }
      if (trick) center[1] += side * envelope * 0.13;
      const point = v => supportPose(add(rz(v, yaw), center));
      const transform = v => bodyPose(point(v));
      const lo = [[-0.38, -0.76, -0.17], [0.38, -0.76, -0.17], [0.35, 0.62, -0.17], [-0.35, 0.62, -0.17]];
      const hi = [[-0.32, -0.65, 0.14], [0.32, -0.65, 0.14], [0.33, 0.53, 0.26], [-0.33, 0.53, 0.26]];
      emit(lo.slice().reverse(), shade(C.sole, 0.73), transform);
      emit(hi, C.cream, transform);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        emit([lo[i], lo[j], hi[j], hi[i]], shade(C.sole, [0.96, 0.90, 0.80, 1.04][i]), transform);
      }
      emit([[-0.355, -0.39, -0.015], [-0.355, 0.19, -0.015], [-0.346, 0.24, 0.08], [-0.346, -0.31, 0.08]], C.teal, transform);
      emit([[-0.18, 0.595, -0.06], [0.18, 0.595, -0.06], [0.16, 0.556, 0.10], [-0.16, 0.556, 0.10]], C.cap, transform);
      return point([0, 0.08, 0.31]);
    }
    const frontAnkle = foot(true), rearAnkle = foot(false);
    const balanceLean = (mode === 'manual' || mode === 'grind') ? balance : balance * 0.35;
    const hip = [0.10 + crouch * 0.13 - (mode === 'manual' ? 0.24 : 0), balanceLean * 0.30, 4.05 - crouch * 1.43 - push * 0.50 + coastBob];
    const shoulder = [hip[0] + 0.11 + crouch * 0.32 + Math.min(speed / 50, 1) * 0.07, hip[1] + balanceLean * 0.42 - crouch * 0.20, hip[2] + 1.63 - crouch * 0.35 - grab * 0.14];
    const hips = [add(hip, [0.46, 0, -0.12]), add(hip, [-0.46, 0, -0.12])];
    const ankles = [frontAnkle, rearAnkle];
    for (let i = 0; i < 2; i++) {
      const joint = knee(hips[i], ankles[i], 1.65, 1.65, [i === 0 ? 0.24 : -0.15, -1, 0.05]);
      prism(hips[i], joint, 0.68, 0.73, 0.60, 0.63, C.pants, null, false, C.stripe);
      prism(joint, ankles[i], 0.60, 0.64, 0.43, 0.44, C.pants, null, false, shade(C.stripe, 0.85));
    }
    prism(add(hip, [0, 0, -0.39]), add(hip, [0, 0, 0.18]), 1.17, 0.73, 1.28, 0.82, C.pants);
    const torsoA = add(hip, [0, -0.005, 0.035]);
    const torsoB = add(shoulder, [0, 0, -0.08]);
    const torsoFrame = prism(torsoA, torsoB, 1.57, 0.91, 1.91, 0.86, C.cream, null, true);
    const logoCenter = add(lerp(torsoA, torsoB, 0.69), mul(torsoFrame.v, -0.453));
    const chestPoint = (x, z) => add(add(logoCenter, mul(torsoFrame.u, x)), mul(torsoFrame.w, z));
    emit([chestPoint(-0.33, 0.16), chestPoint(-0.025, -0.015), chestPoint(-0.025, 0.11), chestPoint(-0.33, 0.285)], C.cap);
    emit([chestPoint(0.025, -0.015), chestPoint(0.33, 0.16), chestPoint(0.33, 0.285), chestPoint(0.025, 0.11)], C.teal);

    const shoulders = [add(shoulder, [0.83, -0.01, -0.09]), add(shoulder, [-0.83, -0.01, -0.09])];
    let elbows = [add(shoulders[0], [0.46 + crouch * 0.17, -0.32, -0.67]), add(shoulders[1], [-0.49, 0.10 - crouch * 0.17, -0.72])];
    let wrists = [add(shoulders[0], [0.80 + crouch * 0.30, -0.43, -1.46 + crouch * 0.36]), add(shoulders[1], [-0.73, -0.17 - crouch * 0.20, -1.48 + crouch * 0.31])];
    if (isAir || mode === 'grind' || mode === 'manual') {
      const spread = mode === 'grind' ? 1 : mode === 'manual' ? 0.87 : 0.68;
      elbows = [add(shoulders[0], [0.83, -0.20, -0.23 + balanceLean * 0.22]), add(shoulders[1], [-0.85, 0.13, -0.25 - balanceLean * 0.20])];
      wrists = [add(shoulders[0], [1.55 * spread, -0.40, -0.49 + balanceLean * 0.42]), add(shoulders[1], [-1.57 * spread, 0.28, -0.46 - balanceLean * 0.43])];
    }
    if (grab > 0) {
      const grabWrist = add(boardPose([0.43, -0.77, 0.10]), [0, -0.02, 0.16]);
      wrists[0] = lerp(wrists[0], grabWrist, grab);
      const grabElbow = knee(shoulders[0], wrists[0], 1.10, 1.25, [0.45, -1, 0]);
      elbows[0] = lerp(elbows[0], grabElbow, grab);
      wrists[1][2] += grab * 0.43;
    }
    if (isBail) {
      elbows = [add(shoulders[0], [0.84, 0.03, -0.38]), add(shoulders[1], [-0.90, 0.03, -0.30])];
      wrists = [add(shoulders[0], [1.65, 0.10, -0.68]), add(shoulders[1], [-1.72, 0.13, -0.56])];
    }
    for (let i = 0; i < 2; i++) {
      const shortEnd = lerp(shoulders[i], elbows[i], 0.53);
      prism(shoulders[i], shortEnd, 0.65, 0.68, 0.70, 0.70, C.cream);
      prism(lerp(shoulders[i], elbows[i], 0.45), elbows[i], 0.43, 0.46, 0.38, 0.42, C.teal);
      prism(elbows[i], wrists[i], 0.39, 0.42, 0.29, 0.33, C.teal);
      const handEnd = add(wrists[i], mul(unit(sub(wrists[i], elbows[i])), 0.31));
      prism(wrists[i], handEnd, 0.32, 0.31, 0.29, 0.27, C.skin);
    }

    const headCenter = add(shoulder, [0.13 + crouch * 0.10, -0.035, 0.82]);
    function headPose(v) {
      return bodyPose(add(rz(ry(sub(v, headCenter), crouch * 0.10), -0.06 - grab * 0.10), headCenter));
    }
    prism(add(shoulder, [0.11, 0, 0.03]), add(shoulder, [0.13, -0.02, 0.45]), 0.39, 0.39, 0.39, 0.39, C.skin);
    prism(add(headCenter, [0, 0, -0.40]), add(headCenter, [0, 0, 0.42]), 0.78, 0.79, 0.88, 0.87, C.skin, headPose, true);
    const faceX = headCenter[0] + 0.433;
    [-0.18, 0.18].forEach(y => {
      emit([[faceX, headCenter[1] + y - 0.043, headCenter[2] + 0.055], [faceX, headCenter[1] + y + 0.043, headCenter[2] + 0.055], [faceX, headCenter[1] + y + 0.043, headCenter[2] + 0.145], [faceX, headCenter[1] + y - 0.043, headCenter[2] + 0.145]], C.dark, headPose);
    });
    emit([[faceX, headCenter[1] - 0.075, headCenter[2] - 0.04], [faceX + 0.13, headCenter[1], headCenter[2] - 0.12], [faceX, headCenter[1] + 0.075, headCenter[2] - 0.04]], shade(C.skin, 0.79), headPose);
    const capBase = add(headCenter, [0, 0, 0.27]);
    const capRing = Array.from({ length: 8 }, (_, i) => {
      const a = i * TAU / 8 + Math.PI / 8;
      return add(capBase, [Math.cos(a) * 0.51, Math.sin(a) * 0.52, 0]);
    });
    const capTip = add(headCenter, [-0.12, 0.045, 0.76]);
    emit(capRing.slice().reverse(), shade(C.cap, 0.67), headPose);
    for (let i = 0; i < 8; i++) emit([capRing[i], capRing[(i + 1) % 8], capTip], shade(C.cap, [1.05, 0.93, 0.84, 0.78, 0.73, 0.86, 1.03, 1.13][i]), headPose);
    [-1, 1].forEach(side => {
      const x = capBase[0] + side * 0.478;
      const band = [[x, capBase[1] - 0.20, capBase[2] - 0.12], [x, capBase[1] + 0.20, capBase[2] - 0.12], [x, capBase[1] + 0.20, capBase[2] + 0.018], [x, capBase[1] - 0.20, capBase[2] + 0.018]];
      emit(side < 0 ? band.reverse() : band, shade(C.cap, side < 0 ? 0.77 : 0.92), headPose);
    });
    return count;
  }

  root.BreakwaterRig = Object.freeze({ draw, faceCount: 197 });
})(window);
