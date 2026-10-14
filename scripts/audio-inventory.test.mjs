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
