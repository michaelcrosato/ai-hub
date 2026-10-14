import { fold } from './manifest.js';

export const emptyAudioFilter = () => ({ query: '', format: '', placeholder: false });

/** Format and placeholder filters intersect; “either” unions the formats. */
export function selectAudioGames(games, { query = '', format = '', placeholder = false } = {}) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  return games.filter(game => {
    const review = game.audioReview || {};
    const formats = review.formats || [];
    if (format && !(format === 'either' ? formats.length > 0 : formats.includes(format))) return false;
    if (placeholder && !review.evidence?.length) return false;
    const text = fold([game.search, game.name, game.slug, ...(game.audioTags || []),
      ...(review.evidence || []).map(e => `${e.path} ${e.excerpt}`)].join(' '));
    return tokens.every(t => text.includes(t));
  });
}
