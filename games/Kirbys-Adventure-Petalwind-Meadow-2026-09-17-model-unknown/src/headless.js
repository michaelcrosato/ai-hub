import { THREE, HeadlessRenderer } from './headless-three.js';
import { startGame } from './game.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function bootHeadless() {
  const renderer = new HeadlessRenderer();
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  document.querySelector('#game-shell').prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 240);
  startGame({ THREE, renderer, scene, camera, render: () => renderer.render(scene, camera), backendLabel: 'Headless QA renderer', modern: false });

  const params = new URLSearchParams(location.search);
  if (params.get('autotest') === '1') {
    const route = params.get('route') === 'upper' ? 'upper' : 'lower';
    await runAutotest(route);
  }
}

async function runAutotest(route) {
  await sleep(60);
  const api = window.__PETALWIND_TEST__;
  const checks = [];
  const check = (name, ok, detail='') => checks.push({ name, ok: !!ok, detail });
  api.start();
  await sleep(80);

  const x0 = api.getSnapshot().x;
  api.setInput({ axis: 1 });
  await sleep(420);
  api.setInput({ axis: 0 });
  const moved = api.getSnapshot();
  check('movement', moved.x > x0 + 0.7, `${x0.toFixed(2)} -> ${moved.x.toFixed(2)}`);

  api.tapJump();
  await sleep(120);
  api.setInput({ jump: false });
  const jumped = api.getSnapshot();
  check('jump', jumped.y > 1.0, `y=${jumped.y.toFixed(2)}`);

  api.teleport(28.2, 1.25);
  await sleep(80);
  check('main bell', api.getSnapshot().bells.includes('main'), JSON.stringify(api.getSnapshot().bells));

  api.teleport(31.1, 0.75);
  await sleep(80);
  check('spring gear', api.getSnapshot().gear.includes('SPRING_SOLES'), JSON.stringify(api.getSnapshot().gear));

  // Swallow the naturally placed bright foe on the opening route.
  api.teleport(21.8, 0.9);
  api.setInput({ inhale: true });
  await sleep(650);
  api.setInput({ inhale: false });
  check('inhale + borrow', api.getSnapshot().ability === 'BOLT', api.getSnapshot().ability);

  const branch = route === 'upper' ? {x:54.7,y:6.05} : {x:48.2,y:-2.92};
  api.teleport(branch.x, branch.y);
  await sleep(100);
  check(`${route} branch bell`, api.getSnapshot().bells.includes('branch'), JSON.stringify(api.getSnapshot().bells));

  const routeGear = route === 'upper' ? {x:58.0,y:5.6,id:'GLOW_PIN'} : {x:57.0,y:-2.8,id:'BERRY_BROOCH'};
  api.teleport(routeGear.x, routeGear.y);
  await sleep(100);
  check(`${route} route gear`, api.getSnapshot().gear.includes(routeGear.id), JSON.stringify(api.getSnapshot().gear));

  const routeEnemy = route === 'upper' ? {x:41.0,y:2.6} : {x:50.5,y:-3.2};
  api.teleport(routeEnemy.x, routeEnemy.y);
  api.setInput({ inhale: true });
  await sleep(650);
  api.setInput({ inhale: false });
  await sleep(80);
  check('normal route reaches level 2', api.getSnapshot().level >= 2, `lv=${api.getSnapshot().level}, xp=${api.getSnapshot().xp}`);

  await sleep(120);
  let snap = api.getSnapshot();
  check('arena boss spawned', snap.bossHP !== null, `bossHP=${snap.bossHP}`);

  // Use the real ability input/cooldown path. Reposition only to keep the QA run deterministic.
  for (let i=0;i<8 && api.getSnapshot().bossHP > 0;i++) {
    snap = api.getSnapshot();
    api.teleport((snap.bossX ?? 84) - 2.1, 1.05);
    api.tapAbility();
    await sleep(760);
  }
  snap = api.getSnapshot();
  check('boss defeated', snap.bossHP !== null && snap.bossHP <= 0, `bossHP=${snap.bossHP}`);

  api.teleport(84, 1.5);
  await sleep(120);
  check('boss bell', api.getSnapshot().bells.includes('boss'), JSON.stringify(api.getSnapshot().bells));

  api.teleport(112.2, 0.8);
  await sleep(120);
  const done = api.getSnapshot();
  check('completion feedback', done.completed, `completed=${done.completed}`);

  const pass = checks.every(c => c.ok);
  const pre = document.createElement('pre');
  pre.id='test-output';
  pre.textContent=JSON.stringify({ route, pass, checks, final: done }, null, 2);
  document.body.append(pre);
  document.documentElement.dataset.autotest = pass ? 'pass' : 'fail';
}
