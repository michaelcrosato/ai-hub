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

const framesOf = (game) => (Array.isArray(game.frames) && game.frames.length > 1 ? game.frames : null);

/** What is on the glass: cycling stills, a cover, or the generated pattern. */
function art(game) {
  const frames = framesOf(game);
  const picture = frames
    ? h('img', {
        src: frameAt(frames, 0),
        alt: '',
        decoding: 'async',
        dataset: { frames: JSON.stringify(frames), frameMs: String(FRAME_MS) },
      })
    : game.cover
      ? h('img', { src: game.cover, alt: '', loading: 'lazy', decoding: 'async' })
      : screenArt(game);
  if (frames) cycleFrames(picture, frames);
  return picture;
}

function screen(game) {
  const frames = framesOf(game);
  return h(
    'div',
    { class: 'cab__screen' },
    art(game),
    game.buildCount > 1 && h('span', { class: 'cab__badge' }, plural(game.buildCount, 'build')),
    // Only ever seen with dev settings showing everything.
    game.restricted === true && h('span', { class: 'cab__flag' }, 'Hidden'),
    h('span', { class: 'cab__glass' }),
    // Sits above the glass so the encode settings stay readable as the stills change.
    frames && game.frameLabel && h('span', { class: 'cab__encode' }, game.frameLabel)
  );
}

/**
 * Several attempts at one thing, as one cabinet with the others stacked behind
 * it. It shows its first game, the one the sort put in front, and the whole
 * tile opens the stack: the wall narrowed to that series, or to that game.
 */
export function stackCabinet(stack, index = 0, href = '#/') {
  const [front] = stack.games;
  const palette = cabinetPalette(front);
  const count = stack.games.length;
  const names = [...new Set(stack.games.map((game) => game.name))];
  const what =
    stack.level === 'series'
      ? `${plural(stack.titles, 'game')}, ${plural(count, 'attempt')}`
      : stack.level === 'facet'
        ? plural(count, 'game')
        : plural(count, 'attempt');

  return h(
    'article',
    {
      class: 'cab cab--stack',
      dataset: { members: stack.games.map((game) => game.slug).join(' ') },
      style: { ...paletteVars(palette), '--i': Math.min(index, 28) },
    },
    h('span', { class: 'cab__sheet cab__sheet--2', 'aria-hidden': 'true' }),
    h('span', { class: 'cab__sheet cab__sheet--1', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'cab__body' },
      h(
        'a',
        { class: 'cab__link', href, 'aria-label': `${stack.label}: ${what}. Open the stack.` },
        h('div', { class: 'cab__marquee' }, h('span', { class: 'cab__name' }, stack.label)),
        h(
          'div',
          { class: 'cab__screen' },
          art(front),
          h('span', { class: 'cab__badge cab__badge--stack' }, icon(ICONS.stack, { width: 11, height: 11 }), what),
          h('span', { class: 'cab__glass' })
        )
      ),
      h(
        'div',
        { class: 'cab__panel' },
        h('p', { class: 'cab__tagline' }, names.join(' · ')),
        h(
          'div',
          { class: 'cab__meta' },
          h('span', { class: 'cab__open' }, stack.level === 'series' ? 'Open series' : 'Open stack'),
          h('span', {}, front.genre || bytes(front.bytes))
        )
      )
    ),
    h('span', { class: 'cab__spill', 'aria-hidden': 'true' })
  );
}

/**
 * @param caption  what the panel names beside the details link; the genre,
 *                 or the size when there is none, unless the wall asks otherwise
 */
export function cabinet(game, index = 0, caption = null) {
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
            : h('span', {}, caption || game.genre || bytes(game.bytes))
        )
      ),
      faveButton(game)
    ),
    h('span', { class: 'cab__spill', 'aria-hidden': 'true' })
  );
}
