const probe = document.createElement('canvas');
let hasWebGL2 = false;
let hasWebGL1 = false;
try { hasWebGL2 = !!probe.getContext('webgl2'); } catch {}
if (!hasWebGL2) {
  try { hasWebGL1 = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl')); } catch {}
} else {
  // A WebGL2 implementation also satisfies the capability needed by the modern fallback.
  hasWebGL1 = true;
}

async function boot() {
  try {
    if (new URLSearchParams(location.search).get('headless') === '1') {
      const headless = await import('./headless.js');
      await headless.bootHeadless();
      return;
    }

    if (navigator.gpu || hasWebGL2) {
      try {
        const modern = await import('./modern.js');
        await modern.bootModern({ forceWebGL: !navigator.gpu });
        return;
      } catch (modernError) {
        console.warn('Modern renderer path failed; trying the WebGL1 legacy path.', modernError);
        document.querySelectorAll('#game-shell > canvas').forEach((canvas) => canvas.remove());
        if (!hasWebGL1) throw modernError;
      }
    }

    if (hasWebGL1) {
      const legacy = await import('./legacy.js');
      await legacy.bootLegacy();
      return;
    }
    throw new Error('This browser does not provide WebGPU, WebGL2, or WebGL1.');
  } catch (error) {
    console.error(error);
    const loading = document.querySelector('#loading');
    loading.innerHTML = `<h1>Renderer unavailable</h1><p>${String(error.message || error)}</p>`;
  }
}

boot();
