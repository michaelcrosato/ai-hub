/**
 * ui/detail.js — the drawer.
 *
 * Opened from a cabinet's build/details button. Shows the blurb, the facts,
 * and every build of the game so you can play an older one deliberately.
 *
 * When other attempts at the same game are on the wall, a link goes to all of
 * them at once.
 *
 * The facts list is generated from whatever the game carries, so a `model` or
 * `harness` added to data/overrides.json shows up here without touching this
 * file — the same rule the filter rails follow.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { NOT_A_FACET } from '../manifest.js';
import { bytes, date, plural } from '../format.js';

const prettyLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

function facts(game) {
  const rows = [
    ['Added', date(game.added)],
    ['Size', bytes(game.bytes)],
  ];
  if (game.version) rows.splice(1, 0, ['Current build', `v${game.version}`]);

  for (const [key, value] of Object.entries(game)) {
    if (NOT_A_FACET.has(key)) continue;
    const text = Array.isArray(value) ? value.join(', ') : value;
    if (typeof text !== 'string' || !text.trim()) continue;
    rows.push([prettyLabel(key), text]);
  }

  return h(
    'dl',
    { class: 'facts' },
    ...rows
      .filter(([, value]) => value)
      .map(([label, value]) => h('div', { class: 'facts__row' }, h('dt', {}, label), h('dd', {}, value)))
  );
}

export function createDetail(root, { onPlay, attempts = () => null }) {
  let game = null;
  let returnFocus = null;

  const close = () => {
    root.hidden = true;
    clear(root);
    game = null;
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  };

  return {
    isOpen: () => !root.hidden,
    close,

    open(next, { closeTo }) {
      game = next;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const palette = cabinetPalette(game);
      const current = game.builds[0];
      const others = attempts(game);

      const closeButton = h(
        'button',
        { class: 'detail__close', type: 'button', 'aria-label': 'Close details', onclick: closeTo },
        icon(ICONS.close)
      );

      const buildList =
        game.builds.length > 1 &&
        h(
          'section',
          { class: 'builds' },
          h('h3', { class: 'builds__title' }, plural(game.builds.length, 'build')),
          h('p', { class: 'builds__note' }, 'Newest first. Older builds are kept exactly as they were.'),
          ...game.builds.map((build, i) =>
            h(
              'button',
              {
                class: `build${i === 0 ? ' is-current' : ''}`,
                type: 'button',
                onclick: () => onPlay(game, build),
              },
              h('span', { class: 'build__label' }, build.version ? `v${build.version}` : build.label),
              h('span', { class: 'build__meta' }, date(build.added)),
              h('span', { class: 'build__size' }, bytes(build.bytes))
            )
          )
        );

      clear(root);
      root.hidden = false;
      root.append(
        h('button', { class: 'detail__scrim', type: 'button', 'aria-label': 'Close details', onclick: closeTo }),
        h(
          'div',
          {
            class: 'detail__panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': `${game.name} details`,
            style: paletteVars(palette),
          },
          h(
            'header',
            { class: 'detail__head' },
            h('h2', { class: 'detail__name' }, game.name),
            game.tagline && h('p', { class: 'detail__tagline' }, game.tagline),
            closeButton
          ),
          h(
            'div',
            { class: 'detail__body' },
            game.description && h('p', { class: 'detail__blurb' }, game.description),
            h(
              'button',
              { class: 'detail__play', type: 'button', onclick: () => onPlay(game, current) },
              icon(ICONS.play, { fill: 'currentColor', stroke: 'none', width: 15, height: 15 }),
              'Play'
            ),
            h(
              'a',
              { class: 'detail__aside', href: current.path, target: '_blank', rel: 'noopener' },
              'Open on its own page'
            ),
            others && h('a', { class: 'detail__aside detail__attempts', href: others.href }, others.text),
            facts(game),
            buildList
          )
        )
      );

      closeButton.focus();
    },
  };
}
