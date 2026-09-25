/**
 * ui/cabinet.js — one game, rendered as one arcade cabinet.
 *
 * The whole tile is the play link. The two small controls that sit on top of
 * it — favourite, and the build/details button — are siblings of that link
 * rather than children, because a button inside an anchor is invalid and
 * behaves badly for keyboard users.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { screenArt } from '../art.js';
import { frameAt, FRAME_MS } from '../frames.js';
import { bytes, plural } from '../format.js';
import { store } from '../store.js';

function faveButton(game) {
  const on = store.isFave(game.slug);
  const button = h(
    'button',
    {
      class: 'cab__fave',
      type: 'button',
      'aria-pressed': String(on),
      'aria-label': on ? `Remove ${game.name} from favourites` : `Add ${game.name} to favourites`,
      onclick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = store.toggleFave(game.slug);
        button.setAttribute('aria-pressed', String(next));
        button.setAttribute(
          'aria-label',
          next ? `Remove ${game.name} from favourites` : `Add ${game.name} to favourites`
        );
        button.firstChild.setAttribute('fill', next ? 'currentColor' : 'none');
      },
    },
    icon(ICONS.star, { fill: on ? 'currentColor' : 'none' })
  );
  return button;
}

/** Swap the still on a timer. The interval ends itself once the tile is gone. */
function cycleFrames(img, frames) {
  for (const url of frames) {
    const preload = new Image();
    preload.src = url;
  }
  let tick = 0;
  const timer = setInterval(() => {
    if (!img.isConnected) {
      clearInterval(timer);
      return;
    }
    tick += 1;
    const next = frameAt(frames, tick);
    if (next) img.src = next;
  }, FRAME_MS);
}

function screen(game) {
  const frames = Array.isArray(game.frames) && game.frames.length > 1 ? game.frames : null;
  const art = frames
    ? h('img', {
        src: frameAt(frames, 0),
        alt: '',
        decoding: 'async',
        dataset: { frames: JSON.stringify(frames), frameMs: String(FRAME_MS) },
      })
    : game.cover
      ? h('img', { src: game.cover, alt: '', loading: 'lazy', decoding: 'async' })
      : screenArt(game);
  if (frames) cycleFrames(art, frames);

  return h(
    'div',
    { class: 'cab__screen' },
    art,
    game.buildCount > 1 && h('span', { class: 'cab__badge' }, plural(game.buildCount, 'build')),
    // Only ever seen with dev settings showing everything.
    game.restricted === true && h('span', { class: 'cab__flag' }, 'Hidden'),
    h('span', { class: 'cab__glass' }),
    // Sits above the glass so the encode settings stay readable as the stills change.
    frames && game.frameLabel && h('span', { class: 'cab__encode' }, game.frameLabel)
  );
}

export function cabinet(game, index = 0) {
  const palette = cabinetPalette(game);

  const infoLabel = game.buildCount > 1 ? 'Builds' : game.version ? `v${game.version}` : 'Details';

  return h(
    'article',
    {
      class: 'cab',
      dataset: { slug: game.slug },
      style: { ...paletteVars(palette), '--i': Math.min(index, 28) },
    },
    h(
      'div',
      { class: 'cab__body' },
      h(
        'a',
        { class: 'cab__link', href: `#/play/${game.slug}` },
        h('div', { class: 'cab__marquee' }, h('span', { class: 'cab__name' }, game.name)),
        screen(game)
      ),
      h(
        'div',
        { class: 'cab__panel' },
        h('p', { class: 'cab__tagline' }, game.tagline || game.description || 'No blurb — open it and find out.'),
        h(
          'div',
          { class: 'cab__meta' },
          h(
            'a',
            { class: 'cab__info', href: `#/g/${game.slug}` },
            infoLabel
          ),
          // Genre when the catalogue has one; size is the fallback fact. Dev
          // settings can swap in the slug, the key everything else hangs off.
          store.dev().showSlugs
            ? h('code', { class: 'cab__slug' }, `${game.slug} · ${bytes(game.bytes)}`)
            : h('span', {}, game.genre || bytes(game.bytes))
        )
      ),
      faveButton(game)
    ),
    h('span', { class: 'cab__spill', 'aria-hidden': 'true' })
  );
}
