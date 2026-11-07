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
import { NOT_A_FACET, sessionOf, shown, termName } from '../manifest.js';
import { bytes, date } from '../format.js';
import { t, withLanguage } from '../lang.js';
import { thumbs as rateButtons } from '../account/thumbs.js';
import { friendsLink } from './friends.js';

const prettyLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/** Fields of prose that have a translation. */
const TEXTS = ['controls', 'howto', 'goal'];

/** The fields games carry most; any other field is named after its key. */
const FIELDS = {
  genre: () => t('game.field.genre'),
  controls: () => t('game.field.controls'),
  tags: () => t('game.field.tags'),
  audioTags: () => t('game.field.audio_tags'),
  players: () => t('game.field.players'),
  source: () => t('game.field.source'),
  series: () => t('game.field.series'),
  model: () => t('game.field.model'),
  effort: () => t('game.field.effort'),
  harness: () => t('game.field.harness'),
};
const fieldLabel = (key) => (FIELDS[key] ? FIELDS[key]() : prettyLabel(key));

function facts(game) {
  const rows = [
    [t('game.detail.added'), date(game.added)],
    [t('game.detail.size'), bytes(game.bytes)],
  ];
  if (game.version) rows.splice(1, 0, [t('game.detail.current_build'), `v${game.version}`]);
  rows.push([t('game.detail.session'), sessionOf(game)?.label]);

  for (const [key, value] of Object.entries(game)) {
    if (NOT_A_FACET.has(key)) continue;
    const kind = { genre: 'genre', tags: 'tag' }[key];
    const text = Array.isArray(value) ? value.map((v) => (kind ? termName(kind, v) : v)).join(', ')
      : kind ? termName(kind, value) : TEXTS.includes(key) ? shown(game, key) : value;
    if (typeof text !== 'string' || !text.trim()) continue;
    rows.push([fieldLabel(key), text]);
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
        { class: 'detail__close', type: 'button', 'aria-label': t('game.detail.close'), onclick: closeTo },
        icon(ICONS.close)
      );

      const buildList =
        game.builds.length > 1 &&
        h(
          'section',
          { class: 'builds' },
          h('h3', { class: 'builds__title' }, t('game.detail.builds', { count: game.builds.length })),
          h('p', { class: 'builds__note' }, t('game.detail.builds_note')),
          ...game.builds.map((build, i) =>
            h(
              'button',
              {
                class: `build${i === 0 ? ' is-current' : ''}`,
                type: 'button',
                onclick: () => onPlay(game, build),
              },
              h('span', { class: 'build__label', dataset: i === 0 ? { current: t('game.detail.current') } : {} }, build.version ? `v${build.version}` : build.label),
              h('span', { class: 'build__meta' }, date(build.added)),
              h('span', { class: 'build__size' }, bytes(build.bytes))
            )
          )
        );

      clear(root);
      root.hidden = false;
      root.append(
        h('button', { class: 'detail__scrim', type: 'button', 'aria-label': t('game.detail.close'), onclick: closeTo }),
        h(
          'div',
          {
            class: 'detail__panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('game.detail.label', { name: game.name }),
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
            game.description && h('p', { class: 'detail__blurb' }, shown(game, 'description')),
            h(
              'div',
              { class: 'detail__go' },
              h(
                'button',
                { class: 'detail__play', type: 'button', onclick: () => onPlay(game, current) },
                icon(ICONS.play, { fill: 'currentColor', stroke: 'none', width: 15, height: 15 }),
                t('game.detail.play')
              ),
              friendsLink(game, { className: 'detail__friends' })
            ),
            rateButtons(game.slug, { className: 'detail__thumbs' }),
            h(
              'a',
              { class: 'detail__aside', href: withLanguage(current.path), target: '_blank', rel: 'noopener' },
              t('game.detail.own_page')
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
