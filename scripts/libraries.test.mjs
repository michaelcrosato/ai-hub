import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { libraryURL, libraryVersion, localizeGameLibraries, readLibraryManifest, resolveLibraryReference } from "./lib/libraries.mjs";

const manifest = readLibraryManifest();
const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const mapOf = (html) => JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]);

test("exact versions stay pinned; ranges select only a compatible local patch", () => {
  assert.equal(libraryVersion(manifest, "three", "0.181.0"), "0.181.0");
  assert.equal(libraryVersion(manifest, "three", "0.160.0"), "0.160.0");
  assert.equal(libraryVersion(manifest, "@dimforge/rapier3d-compat", "0.19.0"), "0.19.0");
  assert.equal(libraryVersion(manifest, "three", "^0.181.0"), "0.181.2");
  assert.equal(libraryVersion(manifest, "three", "r186.1"), "0.186.1");
  assert.equal(libraryVersion(manifest, "three", "0.179.0"), null);
  assert.equal(libraryVersion(manifest, "@dimforge/rapier3d", "0.19.3"), "0.19.3");
});

test("CDN references resolve to the matching local package, including addons and WASM", () => {
  for (const reference of [
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
    "https://unpkg.com/three@0.180.0/build/three.module.js?module",
    "https://esm.sh/three@0.180.0",
    "https://cdn.skypack.dev/three@0.180.0",
    "https://ga.jspm.io/npm:three@0.180.0/build/three.module.js",
    "//cdn.jsdelivr.net/gh/mrdoob/three.js@r180/build/three.module.js",
  ])
    assert.equal(resolveLibraryReference(reference, manifest).url, "/lib/vendor/three/0.180.0/build/three.module.js", reference);
  assert.equal(
    resolveLibraryReference("https://unpkg.com/three@0.180.0/examples/jsm/", manifest).url,
    "/lib/vendor/three/0.180.0/examples/jsm/",
  );
  assert.equal(resolveLibraryReference("https://unpkg.com/three@0.180.0/", manifest).url, "/lib/vendor/three/0.180.0/");
  assert.equal(
    resolveLibraryReference("https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js", manifest).url,
    "/lib/vendor/three/0.180.0/build/three.module.min.js",
  );
  assert.equal(
    resolveLibraryReference("https://esm.sh/@dimforge/rapier3d-simd@0.19.3", manifest).url,
    "/lib/vendor/rapier/0.19.3/rapier3d-simd/browser.mjs",
  );
  assert.match(libraryURL(manifest, "@dimforge/rapier3d", "0.19.3", "rapier_wasm3d_bg.wasm").url, /rapier_wasm3d_bg\.wasm$/);
  assert.match(libraryURL(manifest, "three", "0.180.0", "build/three.min.js").warning, /does not ship/);
  assert.match(libraryURL(manifest, "three", "0.180.0", "../secret").warning, /Invalid/);
  assert.equal(resolveLibraryReference("https://esm.sh/three@0.160.0", manifest).url, "/lib/vendor/three/0.160.0/build/three.module.js");
  assert.equal(
    resolveLibraryReference("https://esm.sh/@dimforge/rapier3d-compat@0.19.0", manifest).url,
    "/lib/vendor/rapier/0.19.0/rapier3d-compat/rapier.mjs",
  );
});

test("a project receives scoped addon imports and keeps each explicitly requested version", () => {
  const sources = new Map([
    ["index.html", '<html><head><title>Imported game</title></head><body><script type="module" src="src/main.js"></script></body></html>'],
    [
      "src/main.js",
      'import * as THREE from "https://esm.sh/three@0.180.0"; import { OrbitControls } from "https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js"; import R from "https://esm.sh/@dimforge/rapier3d-compat@0.19.3";',
    ],
  ]);
  const result = localizeGameLibraries(sources, manifest);
  assert.match(result.files.get("src/main.js"), /\/lib\/vendor\/three\/0\.180\.0\/build\/three\.module\.js/);
  assert.match(result.files.get("src/main.js"), /\/lib\/vendor\/rapier\/0\.19\.3\/rapier3d-compat\/rapier\.mjs/);
  const map = mapOf(result.files.get("index.html"));
  assert.equal(map.scopes["/lib/vendor/three/0.180.0/"].three, "/lib/vendor/three/0.180.0/build/three.module.js");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual([...localizeGameLibraries(result.files, manifest).files], [...result.files], "re-import is byte stable");
});

test("bare modules get defaults before preloads; existing shared-kit mappings stay intact", () => {
  const html =
    '<head><link rel="modulepreload" href="main.js"></head><script type="module">import { Scene } from "three"; import R from "@dimforge/rapier2d-deterministic";</script>';
  const result = localizeGameLibraries(new Map([["index.html", html]]), manifest);
  const after = result.files.get("index.html");
  assert.ok(after.indexOf('type="importmap"') < after.indexOf("modulepreload"));
  const map = mapOf(after);
  assert.equal(map.imports.three, "/lib/vendor/three/0.186.1/build/three.module.js");
  assert.equal(map.imports["@dimforge/rapier2d-deterministic"], "/lib/vendor/rapier/0.21.0/rapier2d-deterministic/browser.mjs");
  const kit =
    '<head><script type="importmap">{"imports":{"three":"/lib/three/three.webgpu.js","three/tsl":"/lib/three/three.tsl.js","kit/":"/lib/kit/"}}</script></head><script type="module">import * as T from "three"; import { boot } from "kit/boot.js";</script>';
  assert.equal(localizeGameLibraries(new Map([["index.html", kit]]), manifest).files.get("index.html"), kit);
});

test("unsupported dependencies are reported and preserved, and embedded modules are untouched", () => {
  const html =
    '<script type="module">import T from "https://esm.sh/three@0.179.0"; import R from "https://example.com/game.js";</script><script src="data:text/javascript;base64,YWJj"></script>';
  const result = localizeGameLibraries(new Map([["index.html", html]]), manifest);
  assert.equal(result.files.get("index.html"), html);
  assert.match(result.warnings[0], /0\.179\.0 is not available/);
});

test("supplied prefix mappings remain authoritative and CDN alias keys are preserved", () => {
  const html =
    '<head><script type="importmap">{"imports":{"three/":"/own-three/","@dimforge/":"/own-physics/","https://esm.sh/three@0.180.0":"https://unpkg.com/three@0.180.0/build/three.module.js"}}</script></head><script type="module">import C from "three/addons/controls/OrbitControls.js"; import R from "@dimforge/rapier3d";</script>';
  const result = localizeGameLibraries(new Map([["index.html", html]]), manifest);
  const map = mapOf(result.files.get("index.html"));
  assert.equal(map.imports["three/"], "/own-three/");
  assert.equal(map.imports["@dimforge/"], "/own-physics/");
  assert.equal(map.imports["three/addons/"], undefined);
  assert.equal(map.imports["@dimforge/rapier3d"], undefined);
  assert.equal(map.imports["https://esm.sh/three@0.180.0"], "/lib/vendor/three/0.180.0/build/three.module.js");
});

test("real imports localize both loose HTML and project JS, respect dry-run, and deduplicate", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ai-hub-libraries-test-"));
  try {
    const hub = path.join(temp, "hub");
    await mkdir(path.join(hub, "data"), { recursive: true });
    await mkdir(path.join(hub, "games"));
    await mkdir(path.join(hub, "lib"));
    await cp(path.join(ROOT, "scripts"), path.join(hub, "scripts"), { recursive: true });
    await symlink(path.join(ROOT, "lib/vendor"), path.join(hub, "lib/vendor"), "dir");
    const inputs = path.join(temp, "inputs");
    await mkdir(path.join(inputs, "project"), { recursive: true });
    await writeFile(
      path.join(inputs, "loose.html"),
      '<head><title>Loose</title></head><script type="module">import * as T from "https://esm.sh/three@0.180.0";</script>',
    );
    await writeFile(
      path.join(inputs, "project/index.html"),
      '<head><title>Project</title></head><script type="module" src="main.js"></script>',
    );
    await writeFile(
      path.join(inputs, "project/main.js"),
      'import R from "https://esm.sh/@dimforge/rapier3d-deterministic@0.19.3"; import * as T from "three";',
    );
    const importer = path.join(hub, "scripts/ingest.mjs");
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const dry = await run(process.execPath, [importer, inputs, "--dry-run"], { env });
    assert.match(dry.stdout, /would import 1 page and 1 project/);
    assert.deepEqual(await readdir(path.join(hub, "games")), []);
    const imported = await run(process.execPath, [importer, inputs], { env });
    assert.match(imported.stdout, /imported 1 page and 1 project/);
    assert.match(await readFile(path.join(hub, "games/loose.html"), "utf8"), /\/lib\/vendor\/three\/0\.180\.0/);
    assert.match(await readFile(path.join(hub, "games/project/main.js"), "utf8"), /rapier3d-deterministic\/browser\.mjs/);
    assert.equal(
      mapOf(await readFile(path.join(hub, "games/project/index.html"), "utf8")).imports.three,
      "/lib/vendor/three/0.186.1/build/three.module.js",
    );
    const repeated = await run(process.execPath, [importer, inputs], { env });
    assert.match(repeated.stdout, /imported 0 pages and 0 projects/);
    assert.deepEqual((await readdir(path.join(hub, "games"))).sort(), ["loose.html", "project"]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
