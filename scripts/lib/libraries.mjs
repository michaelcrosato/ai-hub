/** Resolve imported browser dependencies against the versioned, local package shelf. */
import { readFileSync } from "node:fs";

export function readLibraryManifest() {
  return JSON.parse(readFileSync(new URL("../../lib/vendor/manifest.json", import.meta.url), "utf8"));
}

export function libraryVersion(manifest, name, selector = "") {
  const versions = Object.keys(manifest.packages[name] || {});
  if (!selector || selector === "latest" || selector === "*") return manifest.latest[name] || null;
  const revision = /^r(\d+)(?:\.(\d+))?$/.exec(selector);
  if (revision) selector = `0.${revision[1]}.${revision[2] || 0}`;
  selector = selector.replace(/^v/, "");
  if (versions.includes(selector)) return selector;
  const partial = /^(?:[~^])?(\d+)\.(\d+)(?:\.(\d+|x|\*))?$/.exec(selector);
  if (!partial) return null;
  // Exact versions are never upgraded. ^0.x and ~0.x stay within that minor release.
  if (partial[3] && /^\d+$/.test(partial[3]) && !/^[~^]/.test(selector)) return null;
  const minimum = Number(partial[3]) || 0;
  return (
    versions
      .filter((v) => {
        const [major, minor, patch] = v.split(".").map(Number);
        return major === +partial[1] && minor === +partial[2] && patch >= minimum;
      })
      .sort((a, b) => +a.split(".")[2] - +b.split(".")[2])
      .at(-1) || null
  );
}

export function libraryURL(manifest, name, selector, subpath = "") {
  const version = libraryVersion(manifest, name, selector);
  const record = manifest.packages[name]?.[version];
  if (!record) return { warning: `${name}@${selector || "latest"} is not available locally` };
  if (subpath === "/") return { url: record.base, record };
  let file = subpath.replace(/^\/+/, "");
  if (file.split("/").includes("..")) return { warning: `Invalid package path: ${name}/${file}` };
  if (name === "three") {
    if (!file || file === "+esm") file = record.entry;
    else if (/^three\.(?:core|module|tsl|webgpu(?:\.nodes)?)(?:\.min)?\.js$/.test(file)) file = `build/${file}`;
    else if (file === "webgpu") file = "build/three.webgpu.js";
    else if (file === "tsl") file = "build/three.tsl.js";
    else if (file.startsWith("addons/")) file = `examples/jsm/${file.slice(7)}`;
    else if (/^(?:es\d+|deno)\/three(?:\.bundle)?\.mjs$/.test(file)) file = record.entry;
  } else {
    if (
      !file ||
      file === "+esm" ||
      /^(?:dist\/)?rapier(?:\.es|\.esm)?\.(?:mjs|js)$/.test(file) ||
      /^(?:es\d+|deno)\/rapier[^/]*\.mjs$/.test(file)
    )
      file = record.browserEntry || record.entry;
    else if (!record.files[file] && record.files[`dist/${file}`]) file = `dist/${file}`;
  }
  const prefix = file.endsWith("/") && Object.keys(record.files).some((f) => f.startsWith(file));
  if (!record.files[file] && !prefix) return { warning: `${name}@${version} does not ship ${file}` };
  return { url: record.base + file, record };
}

const HOSTS = new Set(["cdn.jsdelivr.net", "unpkg.com", "esm.sh", "cdn.skypack.dev", "ga.jspm.io", "cdnjs.cloudflare.com", "threejs.org"]);
export function resolveLibraryReference(reference, manifest) {
  if (manifest.externalImports?.[reference]) {
    const record = manifest.externalImports[reference];
    return { url: record.url, record };
  }
  let url;
  try {
    url = new URL(reference.startsWith("//") ? `https:${reference}` : reference);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  let value;
  try {
    value = decodeURIComponent(url.pathname).replace(/^\//, "");
  } catch {
    return { warning: `Invalid encoded dependency URL: ${reference}` };
  }
  if (url.hostname === "cdn.jsdelivr.net") {
    const github = /^gh\/mrdoob\/three\.js@([^/]+)\/(.*)$/.exec(value);
    if (github) return libraryURL(manifest, "three", github[1], github[2]);
    if (!value.startsWith("npm/")) return null;
    value = value.slice(4);
  } else if (url.hostname === "cdnjs.cloudflare.com") {
    const match = /^ajax\/libs\/three\.js\/([^/]+)\/(.*)$/.exec(value);
    return match ? libraryURL(manifest, "three", match[1], match[2]) : null;
  } else if (url.hostname === "threejs.org") {
    return /^(build|examples|src)\//.test(value) ? libraryURL(manifest, "three", "", value) : null;
  } else if (url.hostname === "esm.sh") value = value.replace(/^v\d+\//, "");
  else if (url.hostname === "ga.jspm.io") value = value.replace(/^npm:/, "");
  const match = /^(three|@dimforge\/rapier(?:2d|3d)(?:-(?:simd|deterministic))?(?:-compat)?)(?:@([^/]+))?(?:\/(.*))?$/.exec(value);
  return match ? libraryURL(manifest, match[1], match[2], match[3] === "" ? "/" : match[3]) : null;
}

export function threeImports(record, main = record.base + record.entry, externalImports = {}) {
  return {
    three: main,
    "three/webgpu": `${record.base}build/three.webgpu.js`,
    "three/tsl": `${record.base}build/three.tsl.js`,
    "three/addons/": `${record.base}examples/jsm/`,
    "three/examples/jsm/": `${record.base}examples/jsm/`,
    "three/src/": `${record.base}src/`,
    ...Object.fromEntries(Object.entries(externalImports).map(([source, r]) => [source, r.url])),
  };
}

const REFERENCES =
  /(["'`])((?:https?:)?\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdn\.skypack\.dev|ga\.jspm\.io|cdnjs\.cloudflare\.com|threejs\.org)\/[^\s"'`<>\\]+)\1/g;
const BARE_IMPORTS =
  /\b(?:from\s*|import\s*\(\s*|import\s*)["'](three(?:\/[^"']*)?|@dimforge\/rapier(?:2d|3d)(?:-(?:simd|deterministic))?(?:-compat)?)["']/g;
const IMPORTMAP = /(<script\b[^>]*\btype\s*=\s*["']importmap["'][^>]*>)([\s\S]*?)(<\/script\s*>)/gi;

/** Map of project-relative HTML/JS/CSS sources; binaries and embedded bundles remain untouched. */
export function localizeGameLibraries(sources, manifest) {
  const files = new Map();
  const used = new Map();
  const warnings = new Set();
  const bare = new Set();
  for (const [file, source] of sources) {
    const localReference = (reference) => {
      const resolved = resolveLibraryReference(reference, manifest);
      if (!resolved) return reference;
      if (resolved.warning) {
        warnings.add(`${file}: ${resolved.warning}`);
        return reference;
      }
      used.set(`${resolved.record.name}@${resolved.record.version}`, resolved.record);
      return resolved.url;
    };
    // Import-map URL keys identify the original imports and must remain keys, even when
    // their targets are localized. Protect the JSON from ordinary quoted-URL rewriting.
    const blocks = [];
    const protectedSource = /\.html?$/i.test(file)
      ? source.replace(IMPORTMAP, (whole, open, json, close) => {
          let map;
          try {
            map = JSON.parse(json);
          } catch {
            blocks.push(whole);
            return `\0IMPORTMAP_${blocks.length - 1}\0`;
          }
          const before = JSON.stringify(map);
          const targets = (entries) =>
            Object.fromEntries(
              Object.entries(entries).map(([key, value]) => [key, typeof value === "string" ? localReference(value) : value]),
            );
          if (map.imports) map.imports = targets(map.imports);
          if (map.scopes)
            map.scopes = Object.fromEntries(
              Object.entries(map.scopes).map(([scope, entries]) => [localReference(scope), targets(entries)]),
            );
          blocks.push(
            JSON.stringify(map) === before ? whole : `${open}\n${JSON.stringify(map, null, 2).replaceAll("<", "\\u003c")}\n${close}`,
          );
          return `\0IMPORTMAP_${blocks.length - 1}\0`;
        })
      : source;
    const after = protectedSource
      .replace(REFERENCES, (_whole, quote, reference) => quote + localReference(reference) + quote)
      .replace(/\0IMPORTMAP_(\d+)\0/g, (_whole, i) => blocks[+i]);
    for (const m of after.matchAll(BARE_IMPORTS)) bare.add(m[1]);
    files.set(file, after);
  }
  for (const [file, source] of files) {
    if (!/\.html?$/i.test(file)) continue;
    const maps = [...source.matchAll(IMPORTMAP)];
    if (maps.length > 1) {
      warnings.add(`${file}: multiple import maps need manual review`);
      continue;
    }
    let map;
    try {
      map = maps.length ? JSON.parse(maps[0][2]) : {};
    } catch {
      warnings.add(`${file}: invalid import map needs manual review`);
      continue;
    }
    const original = JSON.stringify(map);
    const imports = { ...map.imports };
    const scopes = { ...map.scopes };
    const mapped = (specifier) => Object.keys(imports).some((key) => key === specifier || (key.endsWith("/") && specifier.startsWith(key)));
    const threeRecords = [...used.values()].filter((r) => r.name === "three");
    // A game's existing /lib/three/ kit mapping stays authoritative.
    const existingThree = typeof imports.three === "string" ? imports.three : "";
    let primary = threeRecords.find((r) => existingThree.startsWith(r.base));
    if (!primary && !existingThree && [...bare].some((v) => (v === "three" || v.startsWith("three/")) && !mapped(v))) {
      primary = threeRecords[0] || manifest.packages.three[manifest.latest.three];
    }
    if (primary) {
      for (const [key, value] of Object.entries(threeImports(primary, existingThree || undefined))) if (!mapped(key)) imports[key] = value;
      used.set(`three@${primary.version}`, primary);
      if (!threeRecords.includes(primary)) threeRecords.push(primary);
    }
    for (const record of threeRecords)
      scopes[record.base] = { ...threeImports(record, undefined, manifest.externalImports), ...scopes[record.base] };
    for (const specifier of bare) {
      if (!specifier.startsWith("@dimforge/") || mapped(specifier)) continue;
      const pinned = [...used.values()].filter((r) => r.name === specifier);
      const resolved = libraryURL(manifest, specifier, pinned.length === 1 ? pinned[0].version : undefined);
      if (resolved.warning) {
        warnings.add(`${file}: ${resolved.warning}`);
        continue;
      }
      imports[specifier] = resolved.url;
      used.set(`${resolved.record.name}@${resolved.record.version}`, resolved.record);
    }
    if (Object.keys(imports).length) map.imports = imports;
    if (Object.keys(scopes).length) map.scopes = scopes;
    if (JSON.stringify(map) === original) continue;
    // Escaping < prevents an unexpected closing script tag in JSON from becoming markup.
    const json = JSON.stringify(map, null, 2).replaceAll("<", "\\u003c");
    const block = `<script type="importmap">\n${json}\n</script>`;
    const match = maps[0];
    if (match) files.set(file, source.slice(0, match.index) + block + source.slice(match.index + match[0].length));
    else {
      // Before modulepreloads as well as module scripts: the browser needs mappings immediately.
      const head = /<head\b[^>]*>/i.exec(source);
      const position = head ? head.index + head[0].length : 0;
      files.set(file, `${source.slice(0, position)}\n${block}\n${source.slice(position)}`);
    }
  }
  return { files, libraries: [...used.keys()].sort(), warnings: [...warnings].sort() };
}
