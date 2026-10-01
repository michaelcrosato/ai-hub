/**
 * The starter guide's tools: the read-only source browser, the in-browser
 * logic checks, prompt copying and the source ZIP export. Loaded the first
 * time the guide opens; it reads this folder's own files and nothing else.
 */

/** Every file of the project folder, in the order the source browser lists them. */
export const FILES = [
    'strata/episode/level.js', 'strata/episode/pump-house.js', 'strata/episode/main.js', 'strata/episode/local-ai.js', 'strata/episode/session.js',
    'strata/core/clock.js', 'strata/core/events.js', 'strata/core/math.js', 'strata/core/motor.js',
    'strata/engine/Assets.js', 'strata/engine/BehaviorSystem.js', 'strata/engine/Effects.js', 'strata/engine/Input.js', 'strata/engine/PhysicsWorld.js',
    'strata/engine/Player.js', 'strata/engine/RenderWorld.js', 'strata/engine/Runtime.js',
    'strata/fps/FpsGame.js', 'strata/fps/combat.js', 'strata/fps/sound.js',
    'strata/kit/browser.js', 'strata/kit/contract.js', 'strata/kit/scope.js', 'strata/kit/session.js',
    'strata/level/prefabs.js', 'strata/level/schema.js', 'strata/tests/self-test.js',
    'app.js', 'guide.js', 'index.html', 'style.css', 'tests/run.mjs', 'README.md', 'LICENSE.txt',
];

const $ = id => document.getElementById(id);
let initialized = false;
let notice = () => { };
let sources = new Map();
let loading = null;

function loadSources() {
    loading ??= Promise.all(FILES.map(async path => {
        try {
            const response = await fetch(new URL(path, import.meta.url), { cache: 'no-cache' });
            return [path, response.ok ? await response.text() : `// ${path} could not be loaded (HTTP ${response.status}).\n`];
        }
        catch (error) {
            return [path, `// ${path} could not be loaded (${String(error)}).\n`];
        }
    })).then(entries => {
        const map = new Map([['config.json', `${JSON.stringify(JSON.parse($('strata-config').textContent), null, 2)}\n`]]);
        for (const [path, text] of entries)
            map.set(path, text);
        return map;
    });
    return loading;
}

async function copy(text, label = 'Text') {
    try {
        await navigator.clipboard.writeText(text);
        notice(`${label} copied.`);
    }
    catch {
        $('copy-fallback').hidden = false;
        $('copy-fallback-text').value = text;
        $('copy-fallback-text').focus();
        $('copy-fallback-text').select();
        notice('Clipboard access is blocked. Copy the selected text manually.');
    }
}

function showSource() {
    const name = $('source-select').value, text = sources.get(name);
    $('source-view').value = text ?? '';
    $('source-meta').textContent = text === undefined ? 'No matching source.' : `${name}  /  ${text.split('\n').length} lines  /  ${new TextEncoder().encode(text).length.toLocaleString()} bytes`;
}

function filterSources() {
    const select = $('source-select'), old = select.value, query = $('source-filter').value.toLowerCase();
    const names = [...sources.keys()].filter(name => name.toLowerCase().includes(query) || sources.get(name).toLowerCase().includes(query));
    select.replaceChildren(...names.map(name => {
        const option = document.createElement('option');
        option.value = option.textContent = name;
        return option;
    }));
    if (names.includes(old))
        select.value = old;
    showSource();
}

async function runChecks() {
    const output = $('check-output');
    output.textContent = 'Running the embedded logic checks…';
    try {
        const module = await import('./strata/tests/self-test.js');
        const result = module.runChecks();
        output.textContent = `${result.passed} passed / ${result.failed} failed\n${result.scope}\n\n` + result.results.map(r => `${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? `\n      ${r.error}` : ''}`).join('\n');
        $('check-live').textContent = `${result.passed} passed / ${result.failed} failed in this browser`;
        $('check-count').textContent = String(result.passed + result.failed);
    }
    catch (error) {
        output.textContent = `Checks could not run: ${String(error)}\nRun node tests/run.mjs in this folder instead. This is not a passed test.`;
    }
}

/** ZIP STORE writer. No compression library, network call, or build step is used. */
function zip(files) {
    const encoder = new TextEncoder(), local = [], central = [];
    let offset = 0, centralSize = 0, count = 0;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    const crc = bytes => {
        let c = 0xffffffff;
        for (const b of bytes)
            c = table[(c ^ b) & 255] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };
    const date = ((2026 - 1980) << 9) | (9 << 5) | 14;
    for (const [path, source] of files) {
        const name = encoder.encode(path), data = encoder.encode(source), sum = crc(data);
        const head = new Uint8Array(30), h = new DataView(head.buffer);
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, date, true);
        h.setUint32(14, sum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
        local.push(head, name, data);
        const directory = new Uint8Array(46), d = new DataView(directory.buffer);
        d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint16(14, date, true);
        d.setUint32(16, sum, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
        central.push(directory, name);
        centralSize += directory.length + name.length;
        offset += head.length + name.length + data.length;
        count++;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
}

async function exportZip() {
    const map = await loadSources();
    // config.json is a reading copy; the page reads #strata-config in index.html.
    const files = [...map].filter(([path]) => path !== 'config.json');
    const url = URL.createObjectURL(zip(files));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'strata-fps-source.zip';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    notice('Source export created. Its page loads three.js, Rapier and the kit from a /lib folder at the site root.');
}

export function initGuide(options = {}) {
    if (initialized)
        return;
    initialized = true;
    notice = options.notice ?? notice;
    $('module-count').textContent = String(FILES.filter(path => path.startsWith('strata/')).length);
    $('copy-prompt').addEventListener('click', () => void copy($('agent-prompt').textContent, 'Agent brief'));
    $('copy-source').addEventListener('click', () => void copy($('source-view').value, 'Source'));
    $('copy-fallback-close').addEventListener('click', () => { $('copy-fallback').hidden = true; });
    $('run-checks').addEventListener('click', () => void runChecks());
    $('export-source').addEventListener('click', () => void exportZip().catch(error => notice(String(error))));
    $('source-filter').addEventListener('input', filterSources);
    $('source-select').addEventListener('change', showSource);
    $('source-view').value = 'Loading the source files…';
    void loadSources().then(map => {
        sources = map;
        $('readme-content').textContent = map.get('README.md') ?? '';
        filterSources();
        $('source-select').value = 'strata/episode/level.js';
        showSource();
    });
}
