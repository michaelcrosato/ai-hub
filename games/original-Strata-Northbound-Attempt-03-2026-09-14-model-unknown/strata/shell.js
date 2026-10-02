/** The cartridge player markup. Mounted before the kit boots, so the 3D canvas can live in the stage. */
export const shell = `
<header class="topbar">
  <a class="brand" href="#" aria-label="Strata field guide"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 17 10-17 10L3 13zm-17 16 17 10 17-10v7L20 36 3 26z"/></svg><b>STRATA</b><span id="product-type">CARTRIDGE PLAYER</span></a>
  <div class="project-label"><span>/</span>Northbound <span class="version">0.3</span></div>
  <div class="top-actions">
    <span class="local-indicator"><i></i> Local build</span>
    <button id="guide-button" class="quiet">Guide</button>
    <button id="settings-button" class="icon-button" title="Settings" aria-label="Settings">☷</button>
    <button id="chapters-button" class="quiet" title="Chapters and best times">Chapters</button>
    <button id="continue-button" class="quiet hidden" title="Continue from the saved checkpoint (F8)">Continue ↺</button>
  </div>
</header>
<main class="stage">
  <div id="viewport">
    <canvas id="canvas" tabindex="0" aria-label="Interactive 3D game viewport"></canvas>
    <div id="hud" class="hidden">
      <div class="objective"><div class="eyebrow" id="hud-chapter">01 / THE FOUNDRY</div><h2 id="hud-objective"></h2><p id="hud-detail"></p></div>
      <div class="mission-tag" id="hud-kit">FPS / BOX PHYSICS</div>
      <div id="crosshair"><i></i><b></b></div>
      <div id="hit-marker">×</div>
      <div id="interaction"></div>
      <div class="health-panel">
        <div class="hud-label" id="health-label">PLAYER HEALTH</div>
        <div class="health-value"><span>＋</span><strong id="health-value">100</strong><small>/ 100</small></div>
        <div class="health-bar"><i id="health-bar"></i></div>
      </div>
      <div class="weapon-panel">
        <div class="hud-label" id="weapon-name"></div>
        <div class="ammo"><strong id="mag-value">24</strong><span id="reserve-value">/ 120</span></div>
        <div id="weapon-hint">R / Reload · 1 2 / Switch</div>
      </div>
      <div class="play-hints" id="play-hints"></div>
      <div id="route-progress" class="hidden"><span id="route-distance"></span><div><i id="route-fill"></i></div></div>
      <div id="damage-overlay"></div>
    </div>
    <div id="modal-overlay" class="overlay hidden">
      <div class="pause-card">
        <div class="small-logo">S</div>
        <div class="eyebrow" id="overlay-eyebrow">CHAPTER 01</div>
        <h2 id="overlay-title">The Foundry</h2>
        <p id="overlay-text"></p>
        <div id="results" class="results hidden"></div>
        <button id="resume-button" class="primary wide">▶ Start sequence</button>
        <button id="overlay-continue" class="quiet wide hidden">Continue from checkpoint</button>
        <button id="restart-button" class="quiet wide">Restart chapter</button>
        <button id="rerun-button" class="quiet wide hidden">Run the sequence again</button>
        <button id="overlay-chapters" class="quiet wide">Chapters</button>
        <button id="overlay-settings" class="quiet wide">Settings</button>
        <button id="handoff-button" class="quiet wide hidden">Export handoff state</button>
      </div>
    </div>
    <div id="notice" role="status" aria-live="polite"></div>
  </div>
</main>
<footer class="statusbar">
  <div><i></i><span id="status-label">Starting host</span><span class="muted">/</span><span id="fps-value">— fps</span></div>
  <div class="metrics"><span id="draws-value">— draws</span><span id="triangles-value">— triangles</span><span id="active-physics">—</span></div>
  <div><span>Y ↑ <span class="muted">·</span> 1 unit = 1 m</span></div>
</footer>
<dialog id="dialog"><div class="dialog-head"><h2 id="dialog-title"></h2><button id="dialog-close" class="icon-button" aria-label="Close dialog">×</button></div><div id="dialog-body"></div></dialog>
<input type="file" id="import-file" accept=".json,application/json" hidden>
`;
