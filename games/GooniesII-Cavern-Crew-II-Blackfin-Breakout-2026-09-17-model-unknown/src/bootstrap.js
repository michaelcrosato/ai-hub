function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2'));
  } catch { return false; }
}

function hasWebGL1() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}

function showError(title, detail) {
  const el = document.getElementById('fatal-error');
  el.querySelector('h2').textContent = title;
  el.querySelector('p').textContent = detail;
  el.classList.add('show');
}

try {
  if (navigator.gpu || hasWebGL2()) {
    await import('./main.js');
  } else if (hasWebGL1()) {
    await import('./legacy.js');
  } else {
    showError('No compatible GPU API found', 'This game needs WebGPU, WebGL2, or WebGL1. Update the browser or enable hardware acceleration.');
  }
} catch (error) {
  console.error(error);
  showError('Game files could not load', 'Serve this folder over HTTP/HTTPS and keep an internet connection available for the pinned Three.js modules. See README.md for the one-command local server.');
}
