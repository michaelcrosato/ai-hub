import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanAudio, placeholderEvidence, mergeAudio } from './lib/audio-inventory.mjs';
import { selectAudioGames, emptyAudioFilter } from '../assets/js/audio-review.js';
import { normalize } from '../assets/js/manifest.js';
import { selectGames } from '../assets/js/filter.js';

test('explicit statements and negatives stay distinct', async () => {
  for (const s of ['Uses placeholder music for testing.', 'The soundtrack is a place holder.', 'BGM: placeholder until composed.', 'Placeholder music and sound effects.']) assert.equal(placeholderEvidence(s, 'x.html').length, 1, s);
  for (const s of ['Placeholder art. Original music.', 'No placeholder music.', 'Music is not placeholder.', 'Placeholder sound effects and voice clips.', 'Music uses original synthesis.', 'Placeholder sprites with original music', 'Placeholder music was removed.', 'Original procedural music/SFX replace requested source-game placeholder audio']) assert.equal(placeholderEvidence(s, 'x.html').length, 0, s);
  const crown = await readFile(new URL('../games/github-crown-of-ash-gpt6/audio/manifest.json', import.meta.url), 'utf8');
  const evidence = placeholderEvidence(crown, 'github-crown-of-ash-gpt6/audio/manifest.json');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].line, 3);
  assert.match(evidence[0].excerpt, /Final Fantasy Tactics/);
});

test('local, inline and remote formats; normalized identities and game association', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'audio-review-'));
  try {
    await mkdir(path.join(root, 'project/audio'), { recursive: true });
    const files = {
      'project/index.html': `<script src="code.js"></script><audio src="audio/VOICE.MP3?x=1"></audio>`,
      'project/code.js': `const a='audio/VOICE.MP3#cue'; const b='https://EXAMPLE.com/song.WAV?token=1'; const c='https://example.com/song.WAV?token=2'; const d='data:audio/x-wav;base64,UklGRg=='; const e='data:audio/vnd.wave;base64,UklGRg=='; const f='data:audio/mpeg;base64,SUQz'; const g=atob('SUQz'); const h=atob('UklGRgAAAABXQVZF'); const image='https://example.com/cover.mp3.png'; const label='audio/wav';`,
      'project/audio/VOICE.MP3': '', 'project/audio/local.WaV': '',
      'project/README.md': 'Uses placeholder music for testing. [Source](https://EXAMPLE.com/song.WAV?token=3)' ,
      'one.html': `<script src="shared.js"></script>`,
      'two.html': '<p>Placeholder art. Original synthesized music.</p>',
      'shared.js': `new Audio('shared.mp3?version=1');`, 'shared.mp3': '',
    };
    for (const [name, text] of Object.entries(files)) await writeFile(path.join(root, name), text);
    const project = await scanAudio({ rel: 'project/index.html', project: true }, root);
    assert.deepEqual(project.counts, { mp3: 2, wav: 4 });
    assert.deepEqual(project.formats, ['mp3', 'wav']);
    assert.equal(project.evidence.length, 1);
    assert.equal(project.assets.filter(a => a.kind === 'remote').length, 1);
    assert.deepEqual(mergeAudio([project, project]), project);
    const one = await scanAudio({ rel: 'one.html' }, root);
    assert.equal(one.counts.mp3, 1);
    const two = await scanAudio({ rel: 'two.html' }, root);
    assert.deepEqual(two.formats, []);
    assert.deepEqual(two.evidence, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('audio filters combine with search, either unions, reset restores all; normal search tags', () => {
  const games = [
    { slug:'music', name:'Music', audioTags:['MP3','placeholder music'], audioReview:{ formats:['mp3'], evidence:[{ path:'games/a/manifest.json', excerpt:'Testing soundtrack placeholders' }] } },
    { slug:'voice', name:'Voice', audioTags:['WAV'], audioReview:{ formats:['wav'], evidence:[] } },
    { slug:'silent', name:'Silent' },
  ].map(normalize);
  assert.equal(selectAudioGames(games, { format:'either' }).length, 2);
  assert.equal(selectAudioGames(games, { format:'wav', placeholder:true }).length, 0);
  assert.equal(selectAudioGames(games, { format:'mp3', placeholder:true, query:'testing' }).length, 1);
  assert.equal(selectAudioGames(games, { query:'MANIFEST.JSON' }).length, 1);
  assert.equal(selectAudioGames(games, emptyAudioFilter()).length, 3);
  assert.deepEqual(selectGames(games, { query:'mp3' }, {}).map(g=>g.slug), ['music']);
});

test('contrast clauses and HTML table cells keep evidence attached to music', () => {
  for (const text of ['Art is not placeholder, but music is placeholder', 'No placeholder art, but placeholder music is used', 'Music is placeholder, but art is not placeholder']) {
    const evidence = placeholderEvidence(text, 'x.html');
    assert.equal(evidence.length, 1, text);
    assert.match(evidence[0].excerpt, /music/i);
  }
  assert.equal(placeholderEvidence('<tr><td>music</td><td>https://example.org/music/source</td></tr><tr><td>sfx</td><td>Synthesized placeholder (procedural, original)</td></tr>', 'x.html').length, 0);
  assert.equal(placeholderEvidence('<tr><td>music</td><td>Original synthesized placeholder</td></tr>', 'x.html').length, 1);
  assert.equal(placeholderEvidence('<li><b>Music</b>: placeholders from a source.</li>', 'x.html').length, 1);
});

test('navigation stays separate while unquoted scripts and styles are traversed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'audio-navigation-'));
  try {
    const files = {
      'one.html': '<a href="two.html">Next</a><script src=game.js></script><link rel=stylesheet href=style.css>',
      'two.html': 'Placeholder music. <audio src="other.mp3">',
      'game.js': 'new Audio("voice.wav")',
      'style.css': '/* Placeholder music for testing. */',
      'voice.wav': '', 'other.mp3': '',
    };
    for (const [name, text] of Object.entries(files)) await writeFile(path.join(root, name), text);
    const result = await scanAudio({ rel:'one.html' }, root);
    assert.deepEqual(result.counts, { mp3:0, wav:1 });
    assert.deepEqual(result.evidence.map(e => e.path), ['games/style.css']);
  } finally { await rm(root, { recursive:true, force:true }); }
});

test('structured JSON audio validates types, encoding and signatures and deduplicates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'audio-json-'));
  try {
    const manifest = { tracks: [
      { mime:'audio/mpeg', data:'SUQz' }, { mime:'audio/mp3', data:'SUQz' },
      { mime:'audio/x-wav', data:'UklGRgAAAABXQVZF' },
      { mime:'audio/mpeg', data:null }, { mime:['audio/mpeg'], data:'SUQz' },
      { mime:'audio/mpeg', data:123 }, { mime:'audio/mpeg', data:{ payload:'SUQz' } },
      { mime:'audio/wav', data:'SUQz' }, { mime:'image/png', data:'SUQz' },
      { mime:'audio/mpeg', data:'SUQz!!!' }, { mime:'audio/mpeg', data:'bm90IGF1ZGlv' }, null,
    ] };
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(root, 'one.html'), `<script type="application/json">${JSON.stringify(manifest)}</script><script type=application/json>{broken}</script><script>const a=atob('SUQz'); const b='data:audio/wav;base64,UklGRgAAAABXQVZF'; const manifest='manifest.json';</script>`);
    assert.deepEqual((await scanAudio({ rel:'one.html' }, root)).counts, { mp3:1, wav:1 });
  } finally { await rm(root, { recursive:true, force:true }); }
});

test('Shellshift manifest yields all 17 ID3 assets; Brick Blast keeps Music evidence only', async () => {
  const shell = 'Teenage-Mutant-Ninja-Turtles-Shellshift-Big-Apple-After-Dark-2026-09-27-GPT-6-Astra-Pro.html';
  const root = new URL('../games/', import.meta.url).pathname;
  const source = await readFile(path.join(root, shell), 'utf8');
  const manifest = JSON.parse(source.match(/<script id="audio-manifest" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(Object.keys(manifest).length, 17);
  for (const asset of Object.values(manifest)) {
    assert.equal(asset.mime, 'audio/mpeg');
    assert.equal(Buffer.from(asset.data, 'base64').subarray(0, 3).toString(), 'ID3');
  }
  assert.match(source, /atob\(asset\.data\)/);
  const result = await scanAudio({ rel:shell }, root);
  assert.deepEqual(result.counts, { mp3:17, wav:0 });
  assert.equal(result.assets.filter(a => a.kind === 'inline').length, 17);
  const brick = 'Blast-Corps-Brick-Blast-Brigade-Argent-Towers-Attempt-01-2026-09-27-Claude-Opus-5.5/index.html';
  const evidence = placeholderEvidence(await readFile(path.join(root, brick), 'utf8'), brick);
  assert.ok(evidence.some(e => e.line === 107 && /Music\s*: placeholders/.test(e.excerpt)));
  assert.ok(!evidence.some(e => e.line === 110));
});
