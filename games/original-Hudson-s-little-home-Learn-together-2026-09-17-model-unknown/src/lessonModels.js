/**
 * lessonModels.js — the 3D pictures of a lesson: Mom's cup and Dad's cup, wet
 * hands and soapy hands, a fridge with its door open…
 *
 * Most pictures are copies of a room's own model, recoloured or with a part
 * moved. A few are built here (cups, hands, food, a drawer full of spoons).
 * Every picture is scaled to fit the same size so three sit side by side.
 */

import * as THREE from 'three/webgpu';

/** Whose it is: the colour every "Mom's / Dad's / Hudson's" choice is painted in. */
export const FAMILY_COLORS = { mom: '#d9937e', dad: '#769fb2', hudson: '#a5b979' };

/**
 * @param {object} room  a built room: { models, box, cyl, mat, pal }
 */
export function createLessonModels(room) {
  const { box, cyl, mat, pal } = room;
  const cache = new Map();
  const unitSphere = new THREE.SphereGeometry(1, 24, 16);
  const unitTorus = new THREE.TorusGeometry(1, 0.17, 10, 36);
  const newGroup = () => new THREE.Group();

  function blob(parent, x, y, z, sx, sy, sz, color) {
    const mesh = new THREE.Mesh(unitSphere, mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function ring(parent, x, y, z, size, color) {
    const mesh = new THREE.Mesh(unitTorus, mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(size);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function tubeMesh(parent, points, radius, color) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, radius, 10, false), mat(color));
    parent.add(mesh);
    return mesh;
  }

  function latheMesh(parent, points, color) {
    const mesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        points.map((p) => new THREE.Vector2(...p)),
        48,
      ),
      mat(color),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** A copy of `object` standing on y = 0, centred, scaled so its largest side is `size`. */
  function normalize(object, size = 3.2) {
    const copy = object.clone(true);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(copy);
    const center = bounds.getCenter(new THREE.Vector3());
    const dims = bounds.getSize(new THREE.Vector3());
    const holder = newGroup();
    copy.position.set(-center.x, -bounds.min.y, -center.z);
    holder.add(copy);
    holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 0.001));
    return holder;
  }

  function fromRoom(id, size = 3.2) {
    if (!room.models.has(id)) throw new Error(`Missing base model: ${id}`);
    return normalize(room.models.get(id), size);
  }

  /**
   * fromRoom() in a plain group, so extra pieces can be added in the fitted
   * (size-3.2) space rather than inside the scaled copy, where they would land
   * several times too far away.
   */
  function fitted(id, size = 3.2) {
    const g = newGroup();
    g.add(fromRoom(id, size));
    return g;
  }

  function recolor(object, color, test = () => true) {
    object.traverse((o) => {
      if (o.isMesh && o.material?.color && test(o)) {
        o.material = o.material.clone();
        o.material.color.set(color);
      }
    });
  }

  function cupModel(owner = 'mom', drink = null) {
    const g = newGroup();
    const isHudson = owner === 'hudson';
    const color = FAMILY_COLORS[owner] || pal.blue;
    const h = isHudson ? 1.38 : 1.65;
    const r = isHudson ? 0.65 : 0.72;
    latheMesh(
      g,
      [
        [0, 0],
        [r * 0.85, 0],
        [r, 0.12],
        [r, h],
        [r - 0.085, h + 0.03],
        [r - 0.13, h - 0.12],
        [r - 0.15, 0.18],
        [0, 0.18],
      ],
      color,
    );
    ring(g, r + 0.18, h * 0.53, 0, 0.38, color).scale.y *= 1.12;
    if (isHudson) ring(g, -r - 0.18, h * 0.53, 0, 0.38, color).scale.y *= 1.12;
    const rim = ring(g, 0, h, 0, r - 0.04, pal.white);
    rim.rotation.x = -Math.PI / 2;
    rim.scale.z *= 0.5;
    if (drink) {
      const colors = { water: '#a9dbe4', juice: '#f0b351', milk: '#fff9e9' };
      cyl(g, r - 0.13, r - 0.13, 0.025, colors[drink], 0, h * 0.77, 0);
      blob(g, -0.18, h * 0.77 + 0.014, 0.15, 0.17, 0.012, 0.055, '#ffffff');
    } else if (isHudson) {
      // Hudson's sippy lid with its spout, and a little sun on the side.
      const lid = newGroup();
      lid.name = 'cup-lid';
      g.add(lid);
      cyl(lid, r + 0.05, r + 0.025, 0.13, '#78975b', 0, h + 0.055, 0);
      cyl(lid, r * 0.82, r, 0.08, '#c6d1a2', 0, h + 0.14, 0);
      tubeMesh(
        lid,
        [
          [0.1, h + 0.16, 0],
          [0.1, h + 0.58, 0],
          [0.29, h + 0.69, 0],
        ],
        0.085,
        '#e8e7cc',
      );
      blob(g, 0, 0.7, r + 0.01, 0.19, 0.19, 0.035, '#f0d28e');
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        blob(g, Math.sin(a) * 0.285, 0.7 + Math.cos(a) * 0.285, r + 0.01, 0.026, 0.045, 0.023, '#f0d28e');
      }
    }
    return g;
  }

  function highChair() {
    const g = newGroup();
    for (const x of [-0.56, 0.56])
      for (const z of [-0.43, 0.43]) {
        const leg = box(g, 0.13, 1.92, 0.13, pal.wood, x, 1, z, 0.04);
        leg.rotation.z = -x * 0.16;
        leg.rotation.x = z * 0.14;
      }
    box(g, 1.35, 0.2, 1.1, '#a6ba88', 0, 1.9, 0, 0.11);
    box(g, 1.37, 1.15, 0.2, '#a6ba88', 0, 2.43, -0.5, 0.1);
    box(g, 1.68, 0.14, 1.1, pal.cream, 0, 2.24, 0.55, 0.08);
    for (const x of [-0.6, 0.6]) box(g, 0.13, 0.43, 0.13, pal.wood, x, 2.05, 0.23, 0.03);
    box(g, 0.85, 0.13, 0.32, pal.wood, 0, 1.18, 0.67, 0.04);
    box(g, 0.13, 0.82, 0.05, pal.dark, 0, 2.18, -0.36, 0.02);
    box(g, 1.15, 0.08, 0.05, pal.dark, 0, 2.14, -0.36, 0.02);
    box(g, 0.19, 0.19, 0.06, pal.cream, 0, 2.14, -0.3, 0.04);
    return g;
  }

  /** A kitchen drawer that slides open on a spoon, a fork and folded towels. */
  function drawerModel(highlight = '') {
    const g = newGroup();
    box(g, 2.75, 0.14, 1.88, pal.woodLight, 0, 1.26, 0, 0.045);
    box(g, 2.7, 0.13, 1.82, pal.sage, 0, 0.12, 0, 0.04);
    box(g, 2.7, 1.1, 0.12, pal.sage, 0, 0.66, -0.85, 0.035);
    for (const x of [-1.28, 1.28]) box(g, 0.13, 1.07, 1.77, pal.sage, x, 0.67, 0, 0.025);
    const slide = newGroup();
    slide.name = 'lesson-drawer-slide';
    g.add(slide);
    box(slide, 2.47, 0.09, 1.62, pal.woodLight, 0, 0.46, 0.08, 0.02);
    for (const x of [-1.18, 1.18]) box(slide, 0.065, 0.32, 1.58, pal.wood, x, 0.66, 0.08, 0.015);
    box(slide, 2.4, 0.32, 0.07, pal.wood, 0, 0.66, -0.66, 0.015);
    box(slide, 2.64, 0.79, 0.14, pal.sageLight, 0, 0.75, 0.94, 0.04);
    box(slide, 0.69, 0.065, 0.09, pal.brass, 0, 0.84, 1.075, 0.025);
    for (const x of [-0.28, 0.28]) box(slide, 0.07, 0.075, 0.1, pal.brass, x, 0.84, 1.025, 0.022);
    for (const x of [-0.45, 0.43]) box(slide, 0.025, 0.15, 1.38, pal.wood, x, 0.6, 0.05, 0.008);
    const spoon = fromRoom('spoon', 1.1);
    spoon.position.set(-0.82, 0.54, 0.06);
    slide.add(spoon);
    const fork = fromRoom('fork', 1.12);
    fork.position.set(-0.03, 0.54, 0.06);
    slide.add(fork);
    const towels = newGroup();
    towels.position.set(0.8, 0.54, 0.05);
    slide.add(towels);
    for (let i = 0; i < 3; i++) box(towels, 0.6, 0.06, 0.72, FAMILY_COLORS.mom, 0, 0.06 + i * 0.064, 0, 0.025);
    for (const z of [-0.24, 0.24]) box(towels, 0.54, 0.012, 0.035, pal.cream, 0, 0.226, z, 0.005);
    const picked = { spoon, fork, towel: towels }[highlight];
    if (picked) recolor(picked, '#d18850', (o) => !o.name.includes('stripe'));
    return g;
  }

  /** A kitchen cupboard with plates, bowls and cups, and two doors that open. */
  function cabinetModel() {
    const g = newGroup();
    box(g, 2.7, 2.65, 0.12, pal.sageDark, 0, 1.35, -0.5, 0.03);
    for (const x of [-1.28, 1.28]) box(g, 0.14, 2.65, 1.14, pal.sage, x, 1.35, 0, 0.04);
    for (const y of [0.08, 1.13, 2.64]) box(g, 2.7, 0.12, 1.14, pal.sageLight, 0, y, 0, 0.035);
    for (const y of [0.16, 1.2]) {
      const dish = fromRoom(y < 1 ? 'plate' : 'bowl', 0.96);
      dish.position.set(-0.62, y, 0.03);
      g.add(dish);
      const cup = cupModel('mom');
      cup.scale.setScalar(0.38);
      cup.position.set(0.56, y, 0.02);
      g.add(cup);
    }
    for (const side of [-1, 1]) {
      const door = newGroup();
      door.name = side === -1 ? 'cabinet-left' : 'cabinet-right';
      door.position.set(side * 1.34, 0, 0.67);
      g.add(door);
      box(door, 1.31, 2.48, 0.1, pal.sageLight, -side * 0.66, 1.36, 0, 0.04);
      box(door, 1.05, 2.21, 0.025, pal.sage, -side * 0.66, 1.36, 0.065, 0.04);
      blob(door, -side * 1.16, 1.37, 0.12, 0.063, 0.063, 0.063, pal.brass);
    }
    return g;
  }

  /** Two hands: plain, wet (drops), soapy (bubbles) or dry (on a towel). */
  function handsModel(state) {
    const g = newGroup();
    for (const side of [-1, 1]) {
      const hand = newGroup();
      hand.position.set(side * 0.74, 0, 0);
      hand.rotation.z = -side * 0.17;
      g.add(hand);
      blob(hand, 0, 0.7, 0, 0.46, 0.54, 0.18, '#d8a37b');
      for (let f = 0; f < 4; f++)
        blob(hand, (f - 1.5) * 0.21, 1.26 + [0.1, 0.2, 0.15, 0][f], 0, 0.11, 0.38, 0.13, '#dfaf8d');
      const thumb = blob(hand, -side * 0.49, 0.8, 0.025, 0.16, 0.33, 0.14, '#dfaf8d');
      thumb.rotation.z = side * 0.65;
      box(hand, 0.47, 0.34, 0.28, pal.cream, 0, 0.15, 0, 0.07);
      if (state === 'wet')
        for (let i = 0; i < 4; i++)
          blob(hand, -0.25 + (i % 2) * 0.35, 0.65 + Math.floor(i / 2) * 0.31, 0.18, 0.055, 0.09, 0.025, '#85bdcf');
      if (state === 'soap')
        for (let i = 0; i < 11; i++) {
          const a = i * 2.4;
          const s = 0.1 + (i % 3) * 0.025;
          blob(hand, Math.cos(a) * 0.34, 0.83 + Math.sin(a) * 0.4, 0.2, s, s, 0.09, i % 2 ? '#fffaf0' : '#c9e0dd');
        }
    }
    if (state === 'dry') box(g, 2.1, 0.12, 0.68, FAMILY_COLORS.mom, 0, 0.02, 0.5, 0.05);
    return g;
  }

  function piecesModel(fruit = 'apple') {
    const g = newGroup();
    const colors = { apple: '#f3e4b8', banana: '#f4dda0', bread: '#e3bd85', orange: '#eba653' };
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7;
      const x = Math.cos(a) * 0.7;
      const z = Math.sin(a) * 0.55;
      if (fruit === 'banana') cyl(g, 0.25, 0.25, 0.13, colors.banana, x, 0.1, z);
      else {
        const piece = box(g, 0.42, 0.14, 0.25, colors[fruit] || colors.apple, x, 0.09, z, 0.04);
        piece.rotation.y = a;
        if (fruit === 'apple') box(piece, 0.43, 0.045, 0.035, pal.red, 0, 0.047, 0.11, 0.014); // the red skin
      }
    }
    return g;
  }

  function plateWithFood(food) {
    const g = newGroup();
    g.add(fromRoom('plate', 2.9));
    const top = food === 'bread' || food === 'toast' ? breadSlice(food === 'toast') : piecesModel(food || 'apple');
    top.scale.setScalar(0.72);
    top.position.set(0, 0.25, 0);
    g.add(top);
    return g;
  }

  function bowlWithFood(food) {
    const g = newGroup();
    g.add(fromRoom('bowl', 2.7));
    if (food === 'banana') {
      const pieces = piecesModel('banana');
      pieces.position.y = 1.06;
      pieces.scale.setScalar(0.8);
      g.add(pieces);
    } else
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4;
        const r = (i % 3) * 0.21;
        blob(
          g,
          Math.cos(a) * r,
          1.06 + (i % 2) * 0.03,
          Math.sin(a) * r,
          0.14,
          0.09,
          0.14,
          ['#e4bf79', '#db955e', '#a6b87e'][i % 3],
        );
      }
    return g;
  }

  function spoonInBowl() {
    const g = bowlWithFood();
    const spoon = fromRoom('spoon', 1.8);
    spoon.name = 'lesson-spoon';
    spoon.position.set(0.5, 1.2, 0.65);
    spoon.rotation.y = -0.6;
    g.add(spoon);
    return g;
  }

  function breadSlice(toast = false) {
    const g = newGroup();
    box(g, 1.65, 0.2, 1.42, toast ? '#be8248' : '#bf925c', 0, 0.1, 0, 0.09);
    box(g, 1.42, 0.015, 1.2, toast ? '#ddb06f' : '#f0d9aa', 0, 0.208, 0, 0.06);
    for (let i = 0; i < 9; i++)
      blob(g, (((i * 7) % 5) - 2) * 0.23, 0.223, (((i * 3) % 5) - 2) * 0.2, 0.022, 0.01, 0.028, '#c79760');
    return g;
  }

  function peeledBanana() {
    const g = newGroup();
    tubeMesh(
      g,
      [
        [0, 0.1, 0],
        [-0.1, 0.55, 0],
        [0, 1.15, 0],
        [0.2, 1.6, 0],
      ],
      0.19,
      '#f8e8bc',
    );
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      tubeMesh(
        g,
        [
          [0, 0.7, 0],
          [Math.cos(a) * 0.43, 0.6, Math.sin(a) * 0.43],
          [Math.cos(a) * 0.75, 0.14, Math.sin(a) * 0.75],
        ],
        0.12,
        pal.yellow,
      );
    }
    return g;
  }

  function orangePieces() {
    const g = newGroup();
    const wedge = new THREE.SphereGeometry(0.63, 24, 12, 0, Math.PI / 3);
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(wedge, mat('#eaae60'));
      mesh.rotation.set(Math.PI / 2, 0, (i - 2) * 0.48);
      mesh.position.set((i - 2) * 0.45, 0.05, Math.abs(i - 2) * 0.08);
      mesh.scale.set(0.7, 0.7, 0.38);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  function tableSet(owner) {
    const g = newGroup();
    const table = fromRoom('table', 3.9);
    g.add(table);
    const top = new THREE.Box3().setFromObject(table).max.y;
    const plate = fromRoom('plate', 1.2);
    plate.position.set(0, top, 0.12);
    g.add(plate);
    const cup = cupModel(FAMILY_COLORS[owner] ? owner : 'hudson');
    cup.scale.setScalar(0.29);
    cup.position.set(0.98, top, -0.3);
    g.add(cup);
    const spoon = fromRoom('spoon', 0.72);
    spoon.position.set(0.79, top, 0.32);
    g.add(spoon);
    return g;
  }

  function washSink(running = false) {
    const g = newGroup();
    g.add(fromRoom('sink', 3));
    const tap = fromRoom('tap', 1.55);
    tap.position.set(0, 0.54, -0.82);
    g.add(tap);
    if (running) {
      cyl(g, 0.055, 0.07, 1.08, '#a2d4df', 0, 0.75, -0.33).name = 'water-stream';
      for (let i = 0; i < 3; i++) {
        const ripple = ring(g, 0, 0.27, -0.28, 0.2 + i * 0.16, '#9ecdd5');
        ripple.rotation.x = -Math.PI / 2;
        ripple.scale.z *= 0.35;
      }
    }
    return g;
  }

  /** The bathroom tap with water running from its spout. */
  function tapWater() {
    const g = newGroup();
    const tap = room.models.get('bath-tap').clone(true);
    tap.position.set(0, 0, 0);
    tap.rotation.set(0, 0, 0);
    g.add(tap);
    cyl(g, 0.035, 0.05, 0.62, '#a2d4df', 0, 0.02, 0.3).name = 'water-stream';
    for (let i = 0; i < 3; i++) {
      const ripple = ring(g, 0, -0.29, 0.3, 0.09 + i * 0.07, '#9ecdd5');
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.z *= 0.35;
    }
    blob(g, 0, -0.3, 0.3, 0.34, 0.02, 0.26, '#b9dfe4');
    return g;
  }

  /** Three wavy lines rising above a hot thing, in the fitted space of `g`. */
  function withHeatWaves(object) {
    const g = newGroup();
    g.add(object);
    g.updateMatrixWorld(true);
    const top = new THREE.Box3().setFromObject(object).max.y;
    const waves = newGroup();
    waves.name = 'heat-waves';
    g.add(waves);
    for (let i = 0; i < 3; i++)
      tubeMesh(
        waves,
        [
          [i * 0.34 - 0.34, top + 0.2, 0],
          [i * 0.34 - 0.42, top + 0.4, 0],
          [i * 0.34 - 0.29, top + 0.65, 0],
        ],
        0.025,
        '#d6a06e',
      );
    return g;
  }

  const keyOf = (option) => [option.model, option.variant, option.action].join('|');

  function build(option) {
    const { model, variant, action } = option;
    let g;
    if (model === 'cup') g = cupModel(variant || 'mom');
    else if (model === 'drink') g = cupModel('hudson', variant || 'water');
    else if (model === 'highchair') g = highChair();
    else if (model === 'drawer') g = drawerModel(variant);
    else if (model === 'cabinet') g = cabinetModel();
    else if (model === 'hands') g = handsModel(variant);
    else if (model === 'fruit-pieces') g = piecesModel(variant);
    else if (model === 'food-plate') g = plateWithFood(variant);
    else if (model === 'food-bowl') g = bowlWithFood(variant);
    else if (model === 'spoon-bowl') g = spoonInBowl();
    else if (model === 'bread-slice') g = breadSlice(variant === 'toast');
    else if (model === 'peeled-banana') g = peeledBanana();
    else if (model === 'orange-pieces') g = orangePieces();
    else if (model === 'table-set') g = tableSet(variant);
    else if (model === 'wash-sink') g = washSink(action === 'water');
    else if (model === 'tap-water') g = tapWater();
    else if (model === 'washed-fruit') {
      g = fitted(variant || 'apple', 2.5);
      for (let i = 0; i < 5; i++) blob(g, (i - 2) * 0.25, 2.6 + (i % 2) * 0.3, 0, 0.05, 0.12, 0.05, '#8ebfce');
    } else if (model === 'dirty-plate') {
      g = fitted('plate', 2.7);
      for (let i = 0; i < 5; i++)
        blob(g, Math.cos(i * 2) * 0.65, 0.27, Math.sin(i * 2) * 0.6, 0.16, 0.013, 0.13, '#b48760');
    } else if (model === 'food-pot' || model === 'food-pan') {
      const pot = model === 'food-pot';
      g = fitted(pot ? 'pot' : 'pan');
      g.getObjectByName('pot-lid')?.removeFromParent();
      const food = piecesModel('banana');
      // In the fitted space the pot's opening is at its centre; the pan's bowl sits left of its handle.
      food.position.set(pot ? 0 : -0.71, pot ? 1.15 : 0.3, 0);
      food.scale.setScalar(pot ? 0.8 : 0.75);
      g.add(food);
    } else if (model === 'paper') {
      g = newGroup();
      const sheet = box(g, 1.5, 0.025, 1.2, pal.white, 0, 0.03, 0, 0.008);
      sheet.rotation.z = 0.12;
      for (let i = 0; i < 3; i++) box(sheet, 0.91, 0.008, 0.025, pal.sage, 0, 0.02, -0.25 + i * 0.2, 0.005);
    } else if (model === 'bath' && variant === 'bubbles') {
      g = fromRoom('bath');
      const water = g.getObjectByName('bath-water');
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39;
        const r = 0.2 + (i % 7) * 0.17;
        const s = 0.09 + (i % 4) * 0.035;
        blob(
          water,
          Math.cos(a) * r * 1.1,
          1.16 + (i % 3) * 0.05,
          0.08 + Math.sin(a) * r * 0.45,
          s,
          s * 0.8,
          s,
          i % 3 ? '#fffaf0' : '#dcefef',
        );
      }
    } else g = fromRoom(model);

    // Whose it is: paint everything but the white and metal parts.
    if (FAMILY_COLORS[variant] && !['cup', 'hands', 'drink', 'table-set', 'drawer'].includes(model)) {
      recolor(
        g,
        FAMILY_COLORS[variant],
        (o) => o.material.metalness < 0.15 && o.material.color.getHexString() !== 'fff9ed',
      );
      if (variant === 'hudson' && ['spoon', 'fork'].includes(model)) g.scale.set(1.28, 1.8, 0.87);
    }
    // One part of the thing, picked out in a warm colour.
    if (model === 'apple' && variant === 'green')
      recolor(g, '#94b96c', (o) => o.material.color.getHexString() === 'd96855');
    if (model === 'chair' && ['seat', 'back', 'legs'].includes(variant))
      recolor(g, '#d78d64', (o) => o.name === `chair-${variant}`);
    if (variant === 'handle') recolor(g, '#d58e65', (o) => o.name.includes('handle'));
    if (model === 'clock' && ['long', 'short'].includes(variant))
      recolor(g, '#d18155', (o) => o.name === `clock-${variant}`);
    if (model === 'plant' && variant === 'leaves')
      recolor(g, '#81a552', (o) => o.material.color.getHexString() === '678574');
    if (model === 'plant' && variant === 'pot')
      recolor(g, '#df9669', (o) => o.material.color.getHexString() === 'd48a72');
    if (model === 'light')
      recolor(
        g,
        action === 'light' ? '#f6cf67' : variant === 'off' ? '#d9d6bb' : '#edc367',
        (o) => o.material.color.getHexString() === 'edc367',
      );
    if (model === 'duck' && variant === 'beak') recolor(g, '#e4763f', (o) => o.name === 'duck-beak');
    if (model === 'boat' && variant === 'sail') recolor(g, '#f2c65a', (o) => o.name === 'boat-sail');
    if (model === 'toothpaste' && variant === 'cap') recolor(g, '#e08a5a', (o) => o.name === 'paste-cap');
    if (model === 'comb' && variant === 'teeth') recolor(g, '#d78d64', (o) => o.name === 'comb-teeth');
    if (model === 'bath-tap' && variant === 'hot') recolor(g, '#e36a52', (o) => o.name === 'tap-hot');
    if (model === 'bath-tap' && variant === 'cold') recolor(g, '#5f93c9', (o) => o.name === 'tap-cold');
    if (action === 'hot') g = withHeatWaves(g);
    return g;
  }

  return {
    key: keyOf,
    /** A fresh copy of this choice's picture, `size` across. */
    get(option, size = 3.2) {
      const key = keyOf(option);
      if (!cache.has(key)) cache.set(key, build(option));
      return normalize(cache.get(key), size);
    },
    cache,
  };
}

/** The demo curve: wait, ease in, hold, ease out (seconds since the choice was tapped). */
export function demoEase(t) {
  if (t < 0.55) return 0;
  if (t < 1.65) {
    const k = (t - 0.55) / 1.1;
    return k * k * (3 - 2 * k);
  }
  if (t < 6.2) return 1;
  if (t < 7.5) {
    const k = (t - 6.2) / 1.3;
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}

/** The named parts of a lesson picture, looked up once instead of every frame. */
export function lessonParts(view) {
  const parts = new Map();
  view.traverse((o) => {
    if (o.name && !parts.has(o.name)) parts.set(o.name, o);
  });
  return parts;
}

const LIDS = ['pot-lid', 'jar-lid', 'bin-lid', 'shampoo-lid', 'laundry-lid'];

/**
 * Act out a choice: open the fridge, lift a lid, float the duck…
 * @param {Map<string, THREE.Object3D>} parts  from lessonParts()
 * @param {object} option     the lesson choice
 * @param {number} elapsed    seconds since the choice was picked
 * @param {boolean} motion    gentle motion on (animate) or off (jump between poses)
 * @param {boolean} still     a side picture: show the action's end pose, no motion
 */
export function animateLesson(parts, option, elapsed, motion = true, still = false) {
  const action = option.action;
  const t = still ? 3 : elapsed;
  const r = still ? 1 : motion ? demoEase(t) : t >= 0.55 && t < 6.2 ? 1 : 0;
  // A steady wobble for floating and brushing; frozen when motion is off.
  const wave = (speed) => (motion && !still ? Math.sin(t * speed) : 0.6);

  const slide = parts.get('lesson-drawer-slide');
  if (slide) slide.position.z = action === 'drawer-demo' ? r * 1.02 : 0;
  const fridgeDoor = parts.get('fridge-door');
  if (fridgeDoor) fridgeDoor.rotation.y = action === 'fridge-demo' ? -r * 1.23 : 0;
  for (const [name, side] of [
    ['cabinet-left', -1],
    ['cabinet-right', 1],
  ]) {
    const door = parts.get(name);
    if (door) door.rotation.y = action === 'cabinet-demo' ? side * r * 1.26 : 0;
  }
  for (const name of LIDS) {
    const lid = parts.get(name);
    if (!lid) continue;
    if (lid.userData.restY === undefined) lid.userData.restY = lid.position.y;
    lid.position.y = lid.userData.restY + (action === 'lid' ? r * 0.3 : 0);
  }
  const pump = parts.get('soap-pump');
  if (pump) {
    if (pump.userData.restY === undefined) pump.userData.restY = pump.position.y;
    pump.position.y = pump.userData.restY - (action === 'pump' ? r * 0.04 : 0);
  }
  const spoon = parts.get('lesson-spoon');
  if (spoon) {
    spoon.position.y = 1.2 + (action === 'scoop' ? r * 0.44 : 0);
    spoon.rotation.z = action === 'scoop' ? -r * 0.35 : 0;
  }
  const hand = parts.get('clock-long-pivot');
  if (hand && action === 'tick') {
    if (hand.userData.restZ === undefined) hand.userData.restZ = hand.rotation.z;
    hand.rotation.z = hand.userData.restZ - (motion ? t * 0.13 : 0);
  }

  // Bathroom actions.
  const toiletLid = parts.get('toilet-lid');
  if (toiletLid) toiletLid.rotation.x = action === 'flip-lid' ? -r * 1.45 : 0;
  const flush = parts.get('flush-button');
  if (flush) {
    if (flush.userData.restY === undefined) flush.userData.restY = flush.position.y;
    flush.position.y = flush.userData.restY - (action === 'flush' ? r * 0.03 : 0);
  }
  const float = parts.get('float-body');
  if (float) {
    const on = action === 'float';
    float.position.y = on ? wave(2.2) * 0.05 * r : 0;
    float.rotation.z = on ? wave(1.6) * 0.09 * r : 0;
  }
  const brush = parts.get('brush-body');
  if (brush) {
    if (brush.userData.restY === undefined) brush.userData.restY = brush.position.y;
    brush.position.y = brush.userData.restY + (action === 'brush' ? wave(9) * 0.06 * r : 0);
  }
  const squeeze = parts.get('squeeze-body');
  if (squeeze) {
    const s = action === 'squeeze' ? r : 0;
    squeeze.scale.set(1 + 0.1 * s, 1 - 0.3 * s, 1 + 0.1 * s);
  }
  const bead = parts.get('squeeze-bead');
  if (bead) bead.scale.setScalar(action === 'squeeze' ? Math.max(0.001, r) : 0.001);
  const water = parts.get('bath-water');
  if (water) {
    if (water.userData.restY === undefined) water.userData.restY = water.position.y;
    water.position.y = water.userData.restY - (action === 'fill' ? (1 - r) * 0.16 : 0);
  }
}
