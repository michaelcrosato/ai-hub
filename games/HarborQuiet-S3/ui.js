// DOM overlay for a couch and a phone. The pixel HUD stays empty; this is the TV type.
const CSS = `
#hq { position: fixed; inset: 0; z-index: 6; pointer-events: none; color: var(--paper); font-family: Figtree, "Avenir Next", "Segoe UI", sans-serif; }
#hq * { box-sizing: border-box; }
#hq {
  --ink: #14161c; --paper: #efe6d4; --amber: #e4a23a; --blood: #d24b4b;
  --muted: #b7ad9c; --line: rgba(239,230,212,.18); --glass: rgba(12,14,18,.78);
}
#hq button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
#hq .screen { position: absolute; inset: 0; display: none; pointer-events: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
#hq[data-screen="title"] .screen-title,
#hq[data-screen="pause"] .screen-pause,
#hq[data-screen="options"] .screen-options,
#hq[data-screen="controls"] .screen-controls,
#hq[data-screen="dead"] .screen-dead { display: flex; }
#hq .scrim { position: absolute; inset: 0; background: rgba(8,9,12,.45); }
#hq[data-screen="title"] .scrim { background: linear-gradient(90deg, rgba(8,9,12,.82), rgba(8,9,12,.2) 70%); }
#hq .panel { position: relative; z-index: 1; width: min(34rem, 100%); margin: auto auto auto 4vw; display: flex; flex-direction: column; gap: 10px; }
#hq[data-screen="pause"] .panel, #hq[data-screen="options"] .panel, #hq[data-screen="controls"] .panel, #hq[data-screen="dead"] .panel { margin: auto; background: var(--glass); border: 1px solid var(--line); padding: 22px 22px 16px; }
#hq .kicker { letter-spacing: .22em; text-transform: uppercase; font-size: 12px; color: var(--amber); }
#hq h1 { font-family: Teko, "Arial Narrow", Impact, sans-serif; font-weight: 500; font-size: clamp(64px, 9vw, 112px); line-height: .84; margin: 0; letter-spacing: .02em; }
#hq h2 { font-family: Teko, "Arial Narrow", Impact, sans-serif; font-weight: 500; font-size: 42px; line-height: 1; margin: 0; }
#hq .lede { max-width: 36ch; color: var(--paper); font-size: 16px; line-height: 1.45; margin: 0 0 6px; }
#hq .fine { color: var(--muted); font-size: 12px; line-height: 1.4; max-width: 62ch; margin: 8px 0 0; }
#hq .menu { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
#hq .item { text-align: left; padding: 10px 12px; font-size: 18px; border: 1px solid transparent; min-height: 44px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
#hq .item.on { border-color: var(--amber); background: rgba(228,162,58,.12); }
#hq .item .v { color: var(--amber); font-size: 15px; }
#hq .table { width: 100%; border-collapse: collapse; font-size: 15px; }
#hq .table th { text-align: left; color: var(--amber); font-weight: 600; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; padding: 4px 8px 8px 0; }
#hq .table td { padding: 4px 10px 4px 0; vertical-align: top; }
#hq .table td:first-child { color: var(--paper); white-space: nowrap; }
#hq .g { display: inline-block; min-width: 1.2em; color: var(--amber); font-weight: 700; }
#hq .hud { position: absolute; inset: 0; display: none; padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); }
#hq[data-screen="play"] .hud { display: block; }
#hq .top, #hq .bot { position: absolute; left: max(14px, env(safe-area-inset-left)); right: max(14px, env(safe-area-inset-right)); display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; pointer-events: none; }
#hq .top { top: max(14px, env(safe-area-inset-top)); }
#hq .bot { bottom: max(14px, env(safe-area-inset-bottom)); align-items: flex-end; }
#hq .card { background: var(--glass); border: 1px solid var(--line); padding: 8px 10px; }
#hq .cash { font-family: Teko, "Arial Narrow", Impact, sans-serif; font-size: 40px; line-height: .9; }
#hq .stars { display: flex; gap: 5px; margin-top: 4px; }
#hq .star { width: 14px; height: 14px; border: 2px solid var(--paper); transform: rotate(45deg); opacity: .35; }
#hq .star.on { background: var(--amber); border-color: var(--amber); opacity: 1; }
#hq.searching .star.on { animation: blink 1s steps(2) infinite; }
#hq .obj { max-width: min(46ch, 70vw); font-size: 15px; line-height: 1.35; }
#hq .obj b { display: block; color: var(--amber); font-size: 11px; letter-spacing: .16em; font-weight: 700; }
#hq .toast { margin-top: 8px; color: var(--paper); font-family: Teko, "Arial Narrow", sans-serif; font-size: 28px; line-height: 1; }
#hq .mapwrap { width: 168px; }
#hq .mapwrap canvas { width: 168px; height: 168px; display: block; background: #1a1d24; border: 1px solid var(--line); }
#hq .maplabel { font-size: 10px; letter-spacing: .16em; color: var(--muted); margin-bottom: 4px; }
#hq .bars { display: flex; flex-direction: column; gap: 5px; min-width: 180px; }
#hq .bar { height: 8px; background: #2a241c; }
#hq .bar > i { display: block; height: 100%; background: var(--blood); width: 0%; }
#hq .bar.arm > i { background: #d9d3c5; }
#hq .bar.focus > i { background: var(--amber); }
#hq .meta { color: var(--muted); font-size: 12px; letter-spacing: .08em; margin-top: 4px; }
#hq .hints { color: var(--paper); font-size: 13px; background: var(--glass); border: 1px solid var(--line); padding: 8px 10px; max-width: min(52ch, 46vw); line-height: 1.45; }
#hq .pause-btn { pointer-events: auto; position: absolute; top: max(14px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left)); width: 48px; height: 48px; border: 1px solid var(--line); background: var(--glass); font-size: 16px; letter-spacing: .08em; display: none; }
#hq[data-screen="play"] .pause-btn { display: block; }
#hq[data-screen="play"] .top { left: max(72px, calc(env(safe-area-inset-left) + 58px)); }
#hq .dead-copy { text-align: center; }
#hq .dead-copy h2 { font-size: 72px; }
#hq.touch .hints { display: none; }
#hq.touch .bot { left: 156px; right: 210px; }
#hq.touch .mapwrap, #hq.touch .mapwrap canvas { width: 120px; height: 120px; }
@media (max-aspect-ratio: 1/1) {
  #hq .panel { margin: auto; width: min(100%, 28rem); }
  #hq[data-screen="title"] .scrim { background: rgba(8,9,12,.72); }
  #hq .mapwrap, #hq .mapwrap canvas { width: 112px; height: 112px; }
  #hq .hints { max-width: 100%; font-size: 12px; }
  #hq .bot { flex-direction: column-reverse; align-items: stretch; gap: 8px; }
  #hq h1 { font-size: 72px; }
  #hq.touch .bot { left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right)); bottom: 228px; flex-direction: row; align-items: flex-end; }
  #hq.touch .top { flex-wrap: wrap; }
  #hq.touch .obj { max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) { #hq.searching .star.on { animation: none; } }
@keyframes blink { 50% { opacity: .25; } }
`;

const TITLE_ITEMS = [
  ['start', 'Start'],
  ['options', 'Options'],
  ['controls', 'Controls'],
  ['fullscreen', 'Fullscreen'],
];
const PAUSE_ITEMS = [
  ['resume', 'Resume'],
  ['options', 'Options'],
  ['controls', 'Controls'],
  ['fullscreen', 'Fullscreen'],
  ['restart', 'Restart district'],
];
const OPTION_ITEMS = [
  ['look', 'Look'],
  ['pixel', 'Pixel art'],
  ['size', 'Pixel size'],
  ['quality', 'Quality'],
  ['fps', 'Frame rate'],
  ['sound', 'Sound'],
  ['debug', 'Debug info'],
  ['reset', 'Reset options'],
  ['back', 'Back'],
];

function items(rows) {
  return rows.map(([id, label], i) => `<button class="item" data-act="${id}" data-i="${i}" type="button"><span>${label}</span><span class="v" data-v="${id}"></span></button>`).join('');
}

const HTML = `
<style>${CSS}</style>
<div class="screen screen-title"><div class="scrim"></div>
  <div class="panel">
    <div class="kicker">Cinderport · Brine Reach</div>
    <h1>HARBOR<br>QUIET</h1>
    <p class="lede">Nia Calder. One car on Salt Row. One bay that still opens if you are quick.</p>
    <div class="menu">${items(TITLE_ITEMS)}</div>
    <p class="fine">✕ confirm · ○ back · stick or arrows move · Options holds picture, pixels, quality, frame rate, and sound.</p>
    <p class="fine" id="hq-source"></p>
  </div>
</div>
<div class="screen screen-pause"><div class="scrim"></div>
  <div class="panel"><div class="kicker">Paused</div><h2>HOLDING</h2><div class="menu">${items(PAUSE_ITEMS)}</div></div>
</div>
<div class="screen screen-options"><div class="scrim"></div>
  <div class="panel"><div class="kicker">Options</div><h2>PICTURE</h2>
    <div class="menu">${items(OPTION_ITEMS)}</div>
    <p class="fine">Left and right change a value. ✕ or Enter confirms Reset. Fullscreen needs a tap, click, or keyboard confirm.</p>
  </div>
</div>
<div class="screen screen-controls"><div class="scrim"></div>
  <div class="panel">
    <div class="kicker">Controls</div><h2>HANDS</h2>
    <table class="table">
      <tr><th></th><th>On foot</th><th>In a car</th></tr>
      <tr><td><span class="g">stick</span> WASD</td><td>Move</td><td>Steer and throttle</td></tr>
      <tr><td>Mouse / right stick</td><td>Orbit</td><td>Orbit</td></tr>
      <tr><td><span class="g">✕</span> Space</td><td>Jump</td><td>Handbrake</td></tr>
      <tr><td><span class="g">○</span> C</td><td>Crouch (less damage)</td><td></td></tr>
      <tr><td><span class="g">□</span> J</td><td>Strike</td><td>Horn</td></tr>
      <tr><td><span class="g">△</span> G</td><td>Enter</td><td>Exit</td></tr>
      <tr><td><span class="g">L2</span> Right mouse</td><td>Aim</td><td>Aim</td></tr>
      <tr><td><span class="g">R2</span> Left mouse / K</td><td>Fire</td><td>Fire</td></tr>
      <tr><td><span class="g">L1</span> H</td><td>Cold Read</td><td>Cold Read</td></tr>
      <tr><td><span class="g">R1</span> R / I</td><td>Reload</td><td>Next station</td></tr>
      <tr><td>Options / Esc</td><td>Pause</td><td>Pause</td></tr>
    </table>
    <p class="fine">Q and E orbit. Shift walks. Touch: the stick plus the on-screen ✕ ○ □ △ R2 L2 L1 buttons. A turns left, D turns right, from the chase view.</p>
    <div class="menu"><button class="item" data-act="back" data-i="0" type="button"><span>Back</span></button></div>
  </div>
</div>
<div class="screen screen-dead"><div class="scrim"></div>
  <div class="panel dead-copy"><div class="kicker">Reach Clinic</div><h2>BLACKED OUT</h2><p class="lede" data-dead></p></div>
</div>
<div class="hud">
  <button class="pause-btn" data-act="pause" type="button">II</button>
  <div class="top">
    <div class="card obj"><b data-kicker>JOB</b><span data-obj></span><div class="toast" data-toast></div></div>
    <div class="card" style="text-align:right">
      <div class="cash" data-cash>$0</div>
      <div class="stars" data-stars></div>
      <div class="meta" data-radio></div>
    </div>
  </div>
  <div class="bot">
    <div>
      <div class="maplabel">BRINE REACH</div>
      <div class="mapwrap card" style="padding:6px"><canvas width="168" height="168" data-map></canvas></div>
    </div>
    <div class="hints" data-hints></div>
    <div class="card bars">
      <div class="bar"><i data-hp></i></div>
      <div class="bar arm"><i data-arm></i></div>
      <div class="bar focus"><i data-focus></i></div>
      <div class="meta" data-meta></div>
    </div>
  </div>
</div>
`;

export function createOverlay(sourceLine) {
  const root = document.createElement('div');
  root.id = 'hq';
  root.dataset.screen = 'title';
  root.innerHTML = HTML;
  document.body.appendChild(root);
  root.querySelector('#hq-source').textContent = sourceLine;
  const map = root.querySelector('[data-map]');
  const ctx2 = map.getContext('2d');
  const q = (s) => root.querySelector(s);
  return {
    root,
    screen(name) { root.dataset.screen = name; },
    searching(on) { root.classList.toggle('searching', on); },
    focus(index) {
      for (const el of root.querySelectorAll('.item')) el.classList.toggle('on', Number(el.dataset.i) === index && el.closest('.screen').classList.contains('screen-' + root.dataset.screen) || (root.dataset.screen && el.closest('.screen-' + (root.dataset.screen === 'title' ? 'title' : root.dataset.screen)) && Number(el.dataset.i) === index));
    },
    setFocus(screen, index) {
      const box = root.querySelector('.screen-' + screen);
      if (!box) return;
      for (const el of box.querySelectorAll('.item')) el.classList.toggle('on', Number(el.dataset.i) === index);
    },
    optionLabels(mapLabels) {
      for (const [id, text] of Object.entries(mapLabels)) {
        const n = root.querySelector(`[data-v="${id}"]`);
        if (n) n.textContent = text;
      }
    },
    hud(d) {
      q('[data-cash]').textContent = d.cash;
      q('[data-obj]').textContent = d.obj;
      q('[data-kicker]').textContent = d.kicker;
      q('[data-toast]').textContent = d.toast || '';
      q('[data-radio]').textContent = d.radio;
      q('[data-hints]').textContent = d.hints;
      q('[data-meta]').textContent = d.meta;
      q('[data-hp]').style.width = d.hp + '%';
      q('[data-arm]').style.width = d.arm + '%';
      q('[data-focus]').style.width = d.focus + '%';
      q('[data-dead]').textContent = d.dead || '';
      const stars = q('[data-stars]');
      if (stars.childElementCount !== 4) {
        stars.innerHTML = '<i class="star"></i><i class="star"></i><i class="star"></i><i class="star"></i>';
      }
      [...stars.children].forEach((el, i) => el.classList.toggle('on', i < d.heat));
    },
    map: ctx2,
    mapCanvas: map,
    onAct(fn) {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        fn(b.dataset.act);
      });
    },
    dispose() { root.remove(); },
  };
}

export const MENU_LENGTH = {
  title: TITLE_ITEMS.length,
  pause: PAUSE_ITEMS.length,
  options: OPTION_ITEMS.length,
  controls: 1,
};
export const MENU_ACT = {
  title: TITLE_ITEMS.map(([id]) => id),
  pause: PAUSE_ITEMS.map(([id]) => id),
  options: OPTION_ITEMS.map(([id]) => id),
  controls: ['back'],
};
