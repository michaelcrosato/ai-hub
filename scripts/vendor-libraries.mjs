#!/usr/bin/env node
/** Download official, integrity-checked runtime packages. No npm install or lifecycle scripts. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CACHE = path.join(ROOT, ".cache/libraries");
const DEST = path.join(ROOT, "lib/vendor");
const REGISTRY = "https://registry.npmjs.org/";
const RAPIER_PACKAGES = ["2d", "3d"].flatMap((dimension) =>
  ["", "-simd", "-deterministic"].flatMap((flavor) => ["", "-compat"].map((compat) => `@dimforge/rapier${dimension}${flavor}${compat}`)),
);
const MINIMUM = { three: "0.180.0", rapier: "0.19.3" };
// Exact older releases needed by imported games; retain these on every sync.
const PINNED = { three: ["0.160.0"], "@dimforge/rapier3d-compat": ["0.19.0"] };
const versionParts = (v) => v.split(".").map(Number);
const compare = (a, b) => {
  const x = versionParts(a),
    y = versionParts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

async function download(url) {
  const { stdout } = await run("curl", ["-L", "--fail", "--silent", "--show-error", "--max-time", "90", "--retry", "2", url], {
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
  return stdout;
}

async function metadata(name) {
  const cached = path.join(CACHE, `${name.replace("@", "").replaceAll("/", "-")}.json`);
  let data;
  if (!process.argv.includes("--refresh")) data = await readFile(cached).catch(() => null);
  if (!data) {
    data = await download(REGISTRY + encodeURIComponent(name));
    await writeFile(cached, data);
  }
  return JSON.parse(data);
}

async function filesAt(dir, rel = "") {
  const files = [];
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const child = path.posix.join(rel, e.name);
    if (e.isDirectory()) files.push(...(await filesAt(dir, child)));
    else if (e.isFile()) files.push(child);
    else throw new Error(`Unexpected link in ${dir}/${child}`);
  }
  return files.sort();
}

async function packageFiles(info, name, version) {
  const basename = name === "three" ? `three/${version}` : `rapier/${version}/${name.split("/")[1]}`;
  const dest = path.join(DEST, basename);
  const archive = path.join(CACHE, `${name.replace("@", "").replaceAll("/", "-")}-${version}.tgz`);
  let bytes = await readFile(archive).catch(() => null);
  if (!bytes) {
    bytes = await download(info.dist.tarball);
    await writeFile(archive, bytes);
  }
  const integrity = info.dist.integrity;
  if (!integrity) throw new Error(`No npm integrity for ${name}@${version}`);
  const [algorithm, expected] = integrity.split("-");
  if (createHash(algorithm).update(bytes).digest("base64") !== expected) throw new Error(`Integrity mismatch: ${name}@${version}`);
  const { stdout: listing } = await run("tar", ["-tzf", archive]);
  for (const file of listing.trim().split("\n")) {
    if (!file.startsWith("package/") || file.split("/").includes("..")) throw new Error(`Unsafe archive path: ${file}`);
  }
  await mkdir(dest, { recursive: true });
  // Keep the upstream package layout, including loaders, codecs, shaders, fonts, source and WASM.
  await run("tar", ["-xzf", archive, "--strip-components=1", "-C", dest, "--no-same-owner"]);
  const pkg = JSON.parse(await readFile(path.join(dest, "package.json"), "utf8"));
  if (pkg.name !== name || pkg.version !== version) throw new Error(`Unexpected package: ${name}@${version}`);
  const entry = pkg.module || pkg.exports?.["."]?.import || pkg.main;
  if (!entry || !(await stat(path.join(dest, entry))).isFile()) throw new Error(`Missing entry: ${name}@${version}`);
  return { name, version, base: `/lib/vendor/${basename}/`, entry: entry.replace(/^\.\//, ""), integrity, tarball: info.dist.tarball };
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const manifest = { schemaVersion: 1, minimum: MINIMUM, latest: {}, packages: {}, externalImports: {} };
  const names = ["three", ...RAPIER_PACKAGES];
  for (const name of names) {
    const meta = await metadata(name);
    const latest = meta["dist-tags"].latest;
    const minimum = name === "three" ? MINIMUM.three : MINIMUM.rapier;
    const versions = Object.keys(meta.versions)
      .filter((v) => (PINNED[name] || []).includes(v) || (/^\d+\.\d+\.\d+$/.test(v) && compare(v, minimum) >= 0 && compare(v, latest) <= 0))
      .sort(compare);
    if (!versions.length) throw new Error(`No releases in range for ${name}`);
    manifest.latest[name] = latest;
    manifest.packages[name] = {};
    for (const version of versions) {
      const record = await packageFiles(meta.versions[version], name, version);
      manifest.packages[name][version] = record;
      console.log(`Vendored ${name}@${version}`);
    }
  }
  // The ordinary packages target bundlers (extensionless imports and direct WASM imports).
  // Browser entry points use the identical physics flavor's official compat build, initialized
  // before export so games written for a ready-to-use ordinary package keep working.
  for (const name of RAPIER_PACKAGES.filter((n) => !n.endsWith("-compat"))) {
    for (const record of Object.values(manifest.packages[name])) {
      const compat = manifest.packages[`${name}-compat`]?.[record.version];
      if (!compat) throw new Error(`Missing matching compat package for ${name}@${record.version}`);
      const target = `../${name.split("/")[1]}-compat/${compat.entry}`;
      const code = `// Browser adapter for ${name}@${record.version}; same version and physics flavor.\nimport RAPIER from ${JSON.stringify(target)};\nexport * from ${JSON.stringify(target)};\nawait RAPIER.init();\nexport default RAPIER;\n`;
      await writeFile(path.join(ROOT, record.base.slice(1), "browser.mjs"), code);
      record.browserEntry = "browser.mjs";
    }
  }
  // Some official addons import separately published libraries from jsDelivr. Keep their
  // pinned ESM distributions local and map them through scopes without altering upstream files.
  const references = new Set();
  for (const record of Object.values(manifest.packages.three)) {
    const dir = path.join(ROOT, record.base.slice(1));
    for (const file of (await filesAt(path.join(dir, "examples/jsm"))).filter((f) => f.endsWith(".js"))) {
      const source = await readFile(path.join(dir, "examples/jsm", file), "utf8");
      for (const match of source.matchAll(/from\s*["'](https:\/\/cdn\.jsdelivr\.net\/npm\/[^"']+\/\+esm)["']/g)) references.add(match[1]);
    }
  }
  for (const source of [...references].sort()) {
    const match = /^https:\/\/cdn\.jsdelivr\.net\/npm\/([^@/]+)@([\d.]+)\/\+esm$/.exec(source);
    if (!match) throw new Error(`Review new external addon import: ${source}`);
    const [, name, version] = match;
    const base = `/lib/vendor/extras/${name}/${version}/`;
    const dir = path.join(ROOT, base.slice(1));
    await mkdir(dir, { recursive: true });
    const cached = path.join(CACHE, `${name}-${version}-esm.mjs`);
    let bytes = await readFile(cached).catch(() => null);
    if (!bytes) {
      bytes = await download(source);
      await writeFile(cached, bytes);
    }
    await writeFile(path.join(dir, "index.mjs"), bytes);
    const info = (await metadata(name)).versions[version];
    const archive = path.join(CACHE, `${name}-${version}.tgz`);
    let packed = await readFile(archive).catch(() => null);
    if (!packed) {
      packed = await download(info.dist.tarball);
      await writeFile(archive, packed);
    }
    const [algorithm, expected] = info.dist.integrity.split("-");
    if (createHash(algorithm).update(packed).digest("base64") !== expected) throw new Error(`Integrity mismatch: ${name}@${version}`);
    const { stdout: listing } = await run("tar", ["-tzf", archive]);
    const license = listing.split("\n").find((f) => /^package\/(?:license|licence)(?:\.[^/]*)?$/i.test(f));
    if (!license) throw new Error(`Missing license: ${name}@${version}`);
    const { stdout: text } = await run("tar", ["-xOf", archive, license], { encoding: "buffer" });
    await writeFile(path.join(dir, "LICENSE"), text);
    manifest.externalImports[source] = {
      name,
      version,
      base,
      entry: "index.mjs",
      url: `${base}index.mjs`,
      source,
      license: info.license,
      files: { "index.mjs": createHash("sha256").update(bytes).digest("hex"), LICENSE: createHash("sha256").update(text).digest("hex") },
    };
    console.log(`Vendored addon dependency ${name}@${version}`);
  }
  for (const versions of Object.values(manifest.packages)) {
    for (const record of Object.values(versions)) {
      const dir = path.join(ROOT, record.base.slice(1));
      record.files = {};
      record.bytes = 0;
      for (const file of await filesAt(dir)) {
        const bytes = await readFile(path.join(dir, file));
        record.bytes += bytes.length;
        record.files[file] = createHash("sha256").update(bytes).digest("hex");
      }
    }
  }
  await writeFile(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const records = Object.values(manifest.packages).flatMap(Object.values);
  console.log(
    `${records.length} versioned packages, ${Math.round(records.reduce((n, r) => n + r.bytes, 0) / 1024 / 1024)} MiB. Existing /lib/three and /lib/rapier kept intact.`,
  );
}

if (process.argv.includes("--help"))
  console.log(
    "node scripts/vendor-libraries.mjs [--refresh]\nDownload all stable Three.js releases >=0.180.0, all 12 official Rapier variants >=0.19.3, and the pinned older releases required by imported games. --refresh checks npm again; otherwise cached metadata pins the release set.",
  );
else await main();
