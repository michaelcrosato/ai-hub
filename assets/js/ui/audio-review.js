import { h, clear } from '../dom.js';
import { emptyAudioFilter, selectAudioGames } from '../audio-review.js';

/** Mounted only inside the existing unlocked developer dialog. */
export function createAudioReview(games) {
  let state = emptyAudioFilter();
  const results = h('div', { class: 'audio-review__results' });
  const count = h('p', { role: 'status', class: 'dev__hint' });
  const query = h('input', { type: 'search', placeholder: 'Search titles, MP3, WAV, or source evidence', 'aria-label': 'Search audio review',
    oninput: () => { state.query = query.value; render(); } });
  const format = h('select', { 'aria-label': 'Audio format', onchange: () => { state.format = format.value; render(); } },
    ...[['', 'All formats'], ['mp3', 'Contains MP3'], ['wav', 'Contains WAV'], ['either', 'MP3 or WAV (either)']].map(([value, label]) => h('option', { value }, label)));
  const placeholder = h('input', { type: 'checkbox', onchange: () => { state.placeholder = placeholder.checked; render(); } });
  function render() {
    const selected = selectAudioGames(games, state);
    count.textContent = `${selected.length} of ${games.length} games · ${games.filter(g => g.audioReview?.evidence.length).length} explicit placeholder music · ${games.filter(g => g.audioReview?.formats.includes('mp3')).length} MP3 · ${games.filter(g => g.audioReview?.formats.includes('wav')).length} WAV`;
    clear(results);
    results.append(...selected.map(game => {
      const review = game.audioReview || { counts: {}, assets: [], evidence: [] };
      return h('details', {},
        h('summary', {}, game.name, h('small', {}, ` ${game.audioTags?.join(' · ') || 'No detected MP3/WAV or explicit statement'}`)),
        h('a', { href: game.path, target: '_blank', rel: 'noopener' }, 'Open game'),
        h('p', {}, game.slug),
        h('p', {}, `${review.counts.mp3 || 0} MP3 / ${review.counts.wav || 0} WAV unique file, inline payload or remote reference identities (all retained builds).`),
        ...review.evidence.map(e => h('blockquote', {}, h('a', { href: '/' + e.path.split('/').map(encodeURIComponent).join('/'), target: '_blank', rel: 'noopener' }, `${e.path}:${e.line}`), h('p', {}, e.excerpt))),
        !review.evidence.length && h('p', {}, 'No explicit placeholder music statement detected.'),
        review.assets.length > 0 && h('details', {}, h('summary', {}, 'Audio inventory'), h('ul', {}, ...review.assets.map(a => h('li', {}, `${a.format.toUpperCase()} · ${a.kind} · ${a.id} — found in ${a.source}`))))
      );
    }));
  }
  render();
  return h('section', { class: 'audio-review' }, h('h3', {}, 'Audio source review'),
    h('p', { class: 'dev__hint' }, 'Formats include music, sound effects and voice. Statements are source evidence, not license clearance. Static scan: dynamic or opaque references may be missed. Search MP3, WAV or placeholder music on the wall too.'),
    query, format, h('label', {}, placeholder, ' Explicit placeholder music'),
    h('button', { type: 'button', class: 'dev__reset', onclick: () => { state = emptyAudioFilter(); query.value = ''; format.value = ''; placeholder.checked = false; render(); } }, 'Reset audio filters'), count, results);
}
