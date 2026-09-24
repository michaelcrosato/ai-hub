const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const splash = $('#splash');
const startBtn = $('#start-btn');
const loadNote = $('#load-note');
const fatal = $('#fatal');

function detectGraphics(){
  const probe = document.createElement('canvas');
  let webgl2 = false, webgl1 = false;
  try { webgl2 = !!probe.getContext('webgl2', { failIfMajorPerformanceCaveat:false }); } catch {}
  if (!webgl2) {
    try { webgl1 = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl')); } catch {}
  } else webgl1 = true;
  return { webgpu: !!navigator.gpu, webgl2, webgl1 };
}

function showFatal(message){
  fatal.textContent = message;
  fatal.classList.remove('hidden');
}

async function boot(){
  const caps = detectGraphics();
  const params = new URLSearchParams(location.search);
  const forceLegacy = params.get('legacy') === '1';
  const lowPower = params.get('low') === '1';

  let module;
  let rendererLabel = '';
  if (forceLegacy || (!caps.webgpu && !caps.webgl2)) {
    loadNote.textContent = 'Starting WebGL1 compatibility mode';
    module = await import('./legacy.js');
    rendererLabel = 'WebGL1 compatibility';
  } else {
    try {
      loadNote.textContent = caps.webgpu ? 'Starting WebGPU renderer' : 'Starting WebGL2 fallback';
      module = await import('./game.js');
      rendererLabel = caps.webgpu ? 'WebGPU' : 'WebGL2';
    } catch (error) {
      console.warn('Modern renderer unavailable; loading local compatibility mode.', error);
      loadNote.textContent = 'CDN unavailable — starting local compatibility mode';
      module = await import('./legacy.js');
      rendererLabel = 'WebGL1 compatibility';
    }
  }

  let game;
  try {
    game = await module.mountGame({ stage, lowPower, requestedRenderer: rendererLabel });
  } catch (error) {
    if (!rendererLabel.includes('WebGL1')) {
      console.warn('Modern renderer initialization failed; switching to local WebGL1 mode.', error);
      stage.replaceChildren();
      loadNote.textContent = 'Modern GPU init failed — starting WebGL1 compatibility mode';
      module = await import('./legacy.js');
      rendererLabel = 'WebGL1 compatibility';
      game = await module.mountGame({ stage, lowPower:true, requestedRenderer:rendererLabel });
    } else throw error;
  }
  window.__mossbell = game;
  startBtn.disabled = false;
  startBtn.textContent = 'BEGIN ADVENTURE';
  loadNote.textContent = `${game.rendererLabel || rendererLabel} ready`;

  startBtn.addEventListener('click', () => {
    splash.classList.add('hidden');
    $('#hud').classList.remove('hidden');
    if (matchMedia('(pointer: coarse)').matches) $('#touch-ui').classList.remove('hidden');
    game.start();
  }, { once:true });

  $('#replay-btn').addEventListener('click', () => location.reload());
}

boot().catch((error) => {
  console.error(error);
  startBtn.disabled = true;
  startBtn.textContent = 'UNABLE TO START';
  loadNote.textContent = 'Renderer initialization failed';
  showFatal(`${error?.message || error}\n\nTip: serve this folder over http://localhost, not file://. Add ?legacy=1 to force the local WebGL1 mode.`);
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
