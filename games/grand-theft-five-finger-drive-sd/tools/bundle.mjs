// Export the exact project as one portable HTML file. No runtime build step.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
if (!target || !target.endsWith('.html')) throw Error('Provide an output .html path outside the game folder.');
const output = path.resolve(target);
if (output.startsWith(root)) throw Error('Export outside the source folder to avoid a second hub entry.');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'style.css'), 'utf8');
const icon = await readFile(path.join(root, 'icon.svg'));
const license = await readFile(path.join(root, 'engine/LICENSE'), 'utf8');
const scripts = [];
for (const match of html.matchAll(/<script defer src="([^"]+)"><\/script>/g)) {
  if (!/^[a-z0-9/-]+\.js$/i.test(match[1])) throw Error('Nonlocal script: ' + match[1]);
  const source = await readFile(path.join(root, match[1]), 'utf8');
  new vm.Script(source, {filename: match[1]});
  scripts.push(`<script>\n/* Source: ${match[1]} */\n${source.replace(/<\/script/gi, '<\\/script')}\n</script>`);
}
if (scripts.length !== 14) throw Error('Unexpected runtime script count: ' + scripts.length);
html = html.replace(/<script defer src="[^"]+"><\/script>/g, '')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('href="icon.svg"', () => `href="data:image/svg+xml;base64,${icon.toString('base64')}"`)
  .replace('</body>', () => `\n<!-- Bundled engine license\n${license.replace(/-->/g, '-- >')}-->\n${scripts.join('\n')}\n</body>`);
if (/<(?:script|link)[^>]+(?:src|href)="(?!data:)/i.test(html)) throw Error('External runtime dependency remains.');
await mkdir(path.dirname(output), {recursive: true});
await writeFile(output, html);
console.log(JSON.stringify({file: output, bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), scripts: scripts.length + 1}));
