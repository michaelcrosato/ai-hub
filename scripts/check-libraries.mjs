#!/usr/bin/env node
/** Verify the complete requested release matrix, file hashes and real physics behavior. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localizeGameLibraries, readLibraryManifest, threeImports } from "./lib/libraries.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const manifest = readLibraryManifest();
const threeVersions = [
  "0.160.0",
  "0.180.0",
  "0.181.0",
  "0.181.1",
  "0.181.2",
  "0.182.0",
  "0.183.0",
  "0.183.1",
  "0.183.2",
  "0.184.0",
  "0.185.0",
  "0.185.1",
  "0.186.0",
  "0.186.1",
];
const rapierVersions = ["0.19.3", "0.20.0", "0.21.0"];
assert.deepEqual(Object.keys(manifest.packages.three), threeVersions);
assert.equal(manifest.latest.three, "0.186.1");
const rapierNames = ["2d", "3d"].flatMap((dimension) =>
  ["", "-simd", "-deterministic"].flatMap((flavor) => ["", "-compat"].map((compat) => `@dimforge/rapier${dimension}${flavor}${compat}`)),
);
assert.deepEqual(Object.keys(manifest.packages).sort(), ["three", ...rapierNames].sort());
for (const name of rapierNames)
  assert.deepEqual(
    Object.keys(manifest.packages[name]),
    name === "@dimforge/rapier3d-compat" ? ["0.19.0", ...rapierVersions] : rapierVersions,
    name,
  );

const records = Object.values(manifest.packages).flatMap(Object.values);
let files = 0;
for (const record of [...records, ...Object.values(manifest.externalImports)]) {
  const dir = path.join(ROOT, record.base.slice(1));
  for (const [file, expected] of Object.entries(record.files)) {
    const bytes = await readFile(path.join(dir, file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `${record.name}@${record.version}/${file}`);
    if (file.endsWith(".wasm")) assert.ok(WebAssembly.validate(bytes), `Invalid WASM: ${record.base}${file}`);
    files++;
  }
  if (record.name === "three") {
    const T = await import(pathToFileURL(path.join(dir, "build/three.module.js")));
    assert.equal(T.REVISION, record.version.split(".")[1]);
    assert.equal(typeof T.WebGLRenderer, "function");
    for (const codec of ["examples/jsm/libs/draco/gltf/draco_decoder.wasm", "examples/jsm/libs/basis/basis_transcoder.wasm"])
      assert.ok(record.files[codec], `${record.version}: missing ${codec}`);
  } else if (record.name.startsWith("@dimforge/")) {
    const module = await import(pathToFileURL(path.join(dir, record.browserEntry || record.entry)));
    const R = module.default;
    if (!record.browserEntry) await R.init();
    assert.equal(R.version(), record.version);
    const is2d = record.name.includes("rapier2d");
    const world = new R.World(is2d ? { x: 0, y: -9.81 } : { x: 0, y: -9.81, z: 0 });
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...(is2d ? [0, 10] : [0, 10, 0])));
    world.createCollider(R.ColliderDesc.ball(0.5), body);
    for (let i = 0; i < 60; i++) world.step();
    assert.ok(
      Number.isFinite(body.translation().y) && body.translation().y < 6 && body.translation().y > 4,
      `${record.name}@${record.version}: gravity failed`,
    );
    world.free();
  }
}
console.log(
  `Verified ${records.length} packages, ${files} file hashes, every WASM binary, and physics in all ${records.filter((r) => r.name.startsWith("@dimforge/")).length} Rapier variants/releases.`,
);

if (process.argv.includes("--browser-fixture")) {
  const scopes = Object.fromEntries(
    Object.values(manifest.packages.three).map((r) => [r.base, threeImports(r, undefined, manifest.externalImports)]),
  );
  const fixtures = records.map(({ name, version, base, entry, browserEntry, files }) => ({
    name,
    version,
    base,
    entry,
    browserEntry,
    nodeRenderer: name === "three" && !!files["build/three.webgpu.js"],
  }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local library verification</title><script type="importmap">${JSON.stringify({ scopes })}</script><style>body{font:16px system-ui;background:#151820;color:#e9eef5;margin:32px}td{padding:6px 16px;border-bottom:1px solid #444}canvas{width:48px;height:48px;vertical-align:middle}.pass{color:#71e0a4}.fail{color:#ff9999}</style></head><body><h1>Local library verification</h1><p id="status">Checking every release and variant…</p><table><tbody id="results"></tbody></table><script id="fixtures" type="application/json">${JSON.stringify(fixtures)}</script><script type="module" src="/scripts/library-browser.mjs"></script></body></html>`;
  await mkdir(path.join(ROOT, ".cache/libraries"), { recursive: true });
  await writeFile(path.join(ROOT, ".cache/libraries/browser-check.html"), html);
  const game = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Imported r180 game</title><style>body{background:#151820;color:white;font:18px system-ui;margin:32px}</style></head><body><h1>Imported r180 game</h1><p id="status">Loading local dependencies…</p><script type="module">
import * as THREE from "https://esm.sh/three@0.180.0";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "https://esm.sh/@dimforge/rapier3d-deterministic@0.19.3";
const renderer = new THREE.WebGLRenderer({antialias:false}); renderer.setSize(320,240); document.body.append(renderer.domElement);
const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50,320/240,.1,100); camera.position.set(2,2,4);
new OrbitControls(camera,renderer.domElement);
const mesh = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:0x39b9eb}));scene.add(mesh);
const world = new RAPIER.World({x:0,y:-9.81,z:0});const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,10,0));world.createCollider(RAPIER.ColliderDesc.ball(.5),body);
for(let i=0;i<60;i++)world.step();const y=body.translation().y;world.free();
window.__importedGame={three:THREE.REVISION,rapier:RAPIER.version(),physicsY:y,frames:0};
renderer.setAnimationLoop(()=>{mesh.rotation.y+=.01;renderer.render(scene,camera);window.__importedGame.frames++});
document.querySelector('#status').textContent='Three.js '+THREE.REVISION+'; deterministic Rapier '+RAPIER.version()+'; gravity y='+y.toFixed(3);
</script></body></html>`;
  const imported = localizeGameLibraries(new Map([["index.html", game]]), manifest);
  assert.deepEqual(imported.warnings, []);
  await mkdir(path.join(ROOT, ".cache/libraries/imported"), { recursive: true });
  await writeFile(path.join(ROOT, ".cache/libraries/imported/index.html"), imported.files.get("index.html"));
  console.log("Browser fixture: /.cache/libraries/browser-check.html (serve the repo root).");
  console.log("Imported game fixture: /.cache/libraries/imported/index.html (r180 + deterministic Rapier 0.19.3).");
}
