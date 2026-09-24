const badge = document.querySelector('#renderer-badge');

function hasWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  } catch { return false; }
}

function hasWebGL1() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch { return false; }
}

const forceLegacy = new URLSearchParams(location.search).has('legacy');

if (forceLegacy && hasWebGL1()) {
  badge.textContent = 'WEBGL1 · FORCED';
  import('./legacy-webgl1.js');
} else if (navigator.gpu || hasWebGL2()) {
  import('./game.js').catch((error) => {
    console.error(error);
    if (hasWebGL1()) {
      badge.textContent = 'WEBGL1 LEGACY';
      import('./legacy-webgl1.js');
    } else {
      badge.textContent = 'NO GPU API';
      document.querySelector('#objective').textContent = 'This browser does not expose WebGPU, WebGL2, or WebGL1.';
    }
  });
} else if (hasWebGL1()) {
  badge.textContent = 'WEBGL1 LEGACY';
  import('./legacy-webgl1.js');
} else {
  badge.textContent = 'NO GPU API';
  document.querySelector('#objective').textContent = 'This browser does not expose WebGPU, WebGL2, or WebGL1.';
}
