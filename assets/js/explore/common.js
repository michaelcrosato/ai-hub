import { h } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { selectGames } from '../filter.js';

/** Shared scope, with the same search and visibility rules as the wall. */
export function selection(games, query, stats, showAll = false) {
  const shelf = query.get('shelf');
  return selectGames(
    games,
    {
      query: query.get('q') || '',
      shelf: shelf === 'all' ? null : ['tools', 'unsure'].includes(shelf) ? shelf : 'games',
      favesOnly: query.get('fav') === '1',
      showAll,
      sort: 'name',
    },
    stats,
  );
}

export function gameMeta(game) {
  return [Array.isArray(game.genre) ? game.genre.join(' / ') : game.genre, game.source || 'Original']
    .filter(Boolean)
    .join(' · ');
}

/** Real cover art where available, with a labelled colour panel as fallback. */
export function gameImage(game, { className = '', loading = 'lazy' } = {}) {
  const root = h('div', {
    class: `explore-image ${className}`.trim(),
    style: paletteVars(cabinetPalette(game)),
  });
  const fallback = h(
    'span',
    { class: 'explore-image__fallback', 'aria-hidden': 'true' },
    game.name.slice(0, 2).toUpperCase(),
  );
  root.append(fallback);
  const src = game.cover || game.frames?.[0];
  if (src)
    root.append(
      h('img', {
        src,
        alt: '',
        loading,
        decoding: 'async',
        onerror(event) {
          event.currentTarget.remove();
        },
      }),
    );
  return root;
}
