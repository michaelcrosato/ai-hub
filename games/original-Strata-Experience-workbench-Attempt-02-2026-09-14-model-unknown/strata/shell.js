/** The workbench markup. Mounted before the kit boots, so the 3D canvas can live in the stage. */
export const shell = `
<header class="topbar">
  <a class="brand" href="#" aria-label="Strata field guide"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 17 10-17 10L3 13zm-17 16 17 10 17-10v7L20 36 3 26z"/></svg><b>STRATA</b><span id="product-type">WORKBENCH</span></a>
  <div class="project-label"><span>/</span>Northbound <span class="version">0.3</span></div>
  <div class="top-actions">
    <span class="local-indicator"><i></i> Local build</span>
    <button id="guide-button" class="quiet">Guide</button>
    <button id="settings-button" class="icon-button" title="Settings" aria-label="Settings">☷</button>
    <button id="export-button" class="quiet studio-only">Export ↗</button>
    <button id="continue-button" class="quiet hidden" title="Continue from the saved checkpoint (F8)">Continue ↺</button>
    <button id="play-button" class="primary">▶ <span>Play test</span></button>
    <button id="stop-button" class="stop hidden">■ Stop test</button>
  </div>
</header>
<aside class="left-panel studio-only">
  <div class="panel-heading">PROJECT <span>01</span></div>
  <div class="panel-tabs"><button id="tab-experiences" class="active">Experiences</button><button id="tab-objects">Objects</button></div>
  <div id="experience-list" class="panel-scroll"></div>
  <div id="objects-panel" class="panel-scroll hidden">
    <div class="search"><span>⌕</span><input id="object-search" placeholder="Find an object…" aria-label="Find an object"></div>
    <div id="object-list"></div>
  </div>
  <div class="left-footer"><span id="object-count">— objects</span><button id="add-button" class="text-button">＋ Add object</button></div>
</aside>
<main class="stage">
  <div id="viewport">
    <canvas id="canvas" tabindex="0" aria-label="Interactive 3D game viewport"></canvas>
    <div id="editor-toolbar" class="view-top editor-only">
      <div class="tool-group">
        <span class="view-name"><i></i> Perspective</span><span class="tool-separator"></span>
        <button data-tool="orbit" title="Orbit (Q)" class="active" aria-label="Orbit">⌖</button>
        <button data-tool="move" title="Move (W)" aria-label="Move">↔</button>
        <button data-tool="rotate" title="Rotate (E)" aria-label="Rotate">↻</button>
        <button data-tool="scale" title="Scale (R)" aria-label="Scale">⤢</button>
        <span class="tool-separator"></span>
        <button id="snap-button" title="Snap to 0.5 m" class="active" aria-label="Toggle grid snap">▦</button>
      </div>
      <button id="home-button" class="glass">⌂ Overview</button>
    </div>
    <div id="scene-heading" class="scene-heading editor-only">
      <div class="eyebrow" id="scene-eyebrow">CHAPTER 01 / FPS KIT</div>
      <h1 id="scene-title">The Foundry<span>.</span></h1>
      <p id="scene-subtitle">Clear the compound. Take the vehicle.</p>
    </div>
    <div id="view-bottom" class="view-bottom editor-only">
      <span id="editor-hint"><kbd>Drag</kbd> Orbit <i>·</i> <kbd>Right drag</kbd> Pan <i>·</i> <kbd>Scroll</kbd> Zoom</span>
      <button id="focus-button" class="glass"><kbd>F</kbd> Focus selected</button>
    </div>
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
        <div class="eyebrow" id="overlay-eyebrow">EXPERIENCE READY</div>
        <h2 id="overlay-title">The Foundry</h2>
        <p id="overlay-text"></p>
        <div id="results" class="results hidden"></div>
        <button id="resume-button" class="primary wide">▶ Start sequence</button>
        <button id="overlay-continue" class="quiet wide hidden">Continue from checkpoint</button>
        <button id="restart-button" class="quiet wide">Restart experience</button>
        <button id="rerun-button" class="quiet wide hidden">Run the sequence again</button>
        <button id="overlay-settings" class="quiet wide">Settings</button>
        <button id="return-button" class="quiet wide studio-only">Return to workbench</button>
        <button id="handoff-button" class="quiet wide hidden">Export handoff state</button>
      </div>
    </div>
    <div id="notice" role="status" aria-live="polite"></div>
  </div>
  <section id="sequence-strip" class="sequence-strip studio-only">
    <div class="sequence-label"><span class="eyebrow">SEQUENCE / 01</span><b>Independent parts.<br>One continuous game.</b></div>
    <div id="sequence-cards" class="sequence-cards"></div>
    <button id="run-sequence" class="run-sequence" title="Play the full sequence">▶<span>Run<br>sequence</span></button>
  </section>
</main>
<aside class="right-panel studio-only">
  <div class="panel-heading">INSPECTOR <span id="inspector-tag">LEVEL</span></div>
  <div id="inspector" class="inspector"></div>
  <div class="contract-card">
    <div class="eyebrow">EXPERIENCE CONTRACT / 1</div>
    <p id="contract-description">One active experience. Shared state. Separate systems.</p>
    <div id="capability-list"></div>
    <button id="brief-button" class="text-button">View build brief ↗</button>
  </div>
</aside>
<footer class="statusbar">
  <div><i></i><span id="status-label">Starting host</span><span class="muted">/</span><span id="fps-value">— fps</span></div>
  <div class="metrics"><span id="draws-value">— draws</span><span id="triangles-value">— triangles</span><span id="active-physics">—</span></div>
  <div><button id="undo-button" class="studio-only" title="Undo">↶</button><button id="redo-button" class="studio-only" title="Redo">↷</button><span>Y ↑ <span class="muted">·</span> 1 unit = 1 m</span></div>
</footer>
<dialog id="dialog"><div class="dialog-head"><h2 id="dialog-title"></h2><button id="dialog-close" class="icon-button" aria-label="Close dialog">×</button></div><div id="dialog-body"></div></dialog>
<input type="file" id="import-file" accept=".json,application/json" hidden>
`;
