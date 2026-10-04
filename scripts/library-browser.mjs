/** Browser-only smoke test: rendered pixels, classic/node addons, and live physics. */
const fixtures = JSON.parse(document.querySelector("#fixtures").textContent);
const report = { results: [], errors: [], done: false, backend: new URLSearchParams(location.search).get("backend") || "webgl2" };
window.__libraryCheck = report;
addEventListener("error", (e) => report.errors.push(e.message));
addEventListener("unhandledrejection", (e) => report.errors.push(String(e.reason)));

function row(label, passed, details, pixel) {
  const tr = document.createElement("tr");
  for (const text of [label, passed ? "PASS" : "FAIL", details]) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.append(td);
  }
  tr.className = passed ? "pass" : "fail";
  if (pixel) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    ctx.fillRect(0, 0, 48, 48);
    const td = document.createElement("td");
    td.append(canvas);
    tr.append(td);
  }
  document.querySelector("#results").append(tr);
  report.results.push({ label, passed, details });
}

async function render(record, nodeRenderer) {
  const T = await import(record.base + (nodeRenderer ? "build/three.webgpu.js" : record.entry));
  if (T.REVISION !== record.version.split(".")[1]) throw new Error(`Wrong Three.js revision: ${T.REVISION}`);
  const renderer = nodeRenderer
    ? new T.WebGPURenderer({ forceWebGL: report.backend !== "webgpu", antialias: false })
    : new T.WebGLRenderer({ antialias: false });
  try {
    if (nodeRenderer) await renderer.init();
    if (nodeRenderer && report.backend === "webgpu" && !renderer.backend.isWebGPUBackend)
      throw new Error("Requested WebGPU but renderer fell back");
    renderer.setSize(8, 8);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 3;
    let material;
    if (nodeRenderer) {
      const tsl = await import(`${record.base}build/three.tsl.js`);
      material = new T.MeshBasicNodeMaterial();
      material.colorNode = tsl.color(0xff2233);
    } else material = new T.MeshBasicMaterial({ color: 0xff2233 });
    const geometry = new T.BoxGeometry(1, 1, 1);
    scene.add(new T.Mesh(geometry, material));
    const target = nodeRenderer ? new T.RenderTarget(8, 8) : new T.WebGLRenderTarget(8, 8);
    renderer.setRenderTarget(target);
    if (nodeRenderer) await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    // Earlier node renderers finish their initial object setup on the first frame.
    // Verify the steady rendering loop after an actual animation-frame boundary.
    if (nodeRenderer) {
      await new Promise(requestAnimationFrame);
      renderer.render(scene, camera);
    }
    let pixels;
    // A single pixel avoids WebGPU's padded 256-byte rows in the older readback API.
    if (nodeRenderer) pixels = await renderer.readRenderTargetPixelsAsync(target, 4, 4, 1, 1);
    else {
      pixels = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 4, 4, 1, 1, pixels);
    }
    const pixel = [...pixels.slice(0, 4)];
    if (pixel[0] < 100 || pixel[0] <= pixel[1] * 2) throw new Error(`Rendered pixel is wrong: ${pixel}`);
    target.dispose();
    geometry.dispose();
    material.dispose();
    return pixel;
  } finally {
    renderer.dispose();
  }
}

for (const record of fixtures) {
  const label = `${record.name}@${record.version}`;
  try {
    if (record.name === "three") {
      let pixel = await render(record, false);
      if (record.nodeRenderer !== false) pixel = await render(record, true);
      for (const addon of [
        "controls/OrbitControls.js",
        "postprocessing/EffectComposer.js",
        "loaders/GLTFLoader.js",
        "loaders/DRACOLoader.js",
        "loaders/KTX2Loader.js",
        "loaders/TTFLoader.js",
        "objects/GaussianSplat.js",
      ]) {
        // Gaussian splats were introduced later; earlier releases still exercise the common addons.
        if (addon === "objects/GaussianSplat.js" && Number(record.version.split(".")[1]) < 186) continue;
        await import(`${record.base}examples/jsm/${addon}`);
      }
      row(
        label,
        true,
        record.nodeRenderer === false ? "WebGLRenderer and addons" : `WebGLRenderer + node renderer (${report.backend}), TSL and addons`,
        pixel,
      );
    } else {
      const R = (await import(record.base + (record.browserEntry || record.entry))).default;
      if (!record.browserEntry) await R.init();
      if (R.version() !== record.version) throw new Error(`Wrong Rapier version: ${R.version()}`);
      const is2d = record.name.includes("rapier2d");
      const world = new R.World(is2d ? { x: 0, y: -9.81 } : { x: 0, y: -9.81, z: 0 });
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...(is2d ? [0, 10] : [0, 10, 0])));
      world.createCollider(R.ColliderDesc.ball(0.5), body);
      for (let i = 0; i < 60; i++) world.step();
      const y = body.translation().y;
      if (!Number.isFinite(y) || y > 6 || y < 4) throw new Error(`Physics failed: y=${y}`);
      world.free();
      row(label, true, `WASM initialized; gravity simulated (y=${y.toFixed(3)})`);
    }
  } catch (error) {
    row(label, false, error.message);
  }
}
report.externalRequests = performance
  .getEntriesByType("resource")
  .map((r) => r.name)
  .filter((url) => new URL(url).origin !== location.origin);
report.done = true;
const passed = report.results.filter((r) => r.passed).length;
document.querySelector("#status").textContent =
  `${passed}/${fixtures.length} passed; ${report.errors.length} page errors; ${report.externalRequests.length} external requests.`;
document.body.dataset.complete = "true";
