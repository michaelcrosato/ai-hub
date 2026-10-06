/**
 * couch/hero.js — the focused game, large, top left: what it is, where it
 * comes from, a few facts, and the three things you can do with it.
 *
 * The words change with every move; the buttons never do. They are built
 * once and only relabelled, so focus resting on one is never lost when the
 * game behind it changes.
 */

import { h, icon, append, clear, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';
import { eyebrow, heroChips } from './facts.js';
import { keyRun, prompt, reducedMotion } from './ui.js';

const INFO = 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';

/** A long name steps down a size or two rather than losing its end to an ellipsis. */
const fit = (name) => (name.length > 26 ? 'long' : name.length > 16 ? 'mid' : null);

export function createHero(root, { onPlay, onInfo, onFave }) {
  let game = null;

  // Named in aria-label too: on a phone the words are hidden and the icon stays.
  const button = (action, label, glyph, onclick, extra = {}) =>
    h(
      'button',
      { type: 'button', class: `btn btn--${action}`, 'aria-label': label, dataset: { nav: 'hero', action }, onclick, ...extra },
      glyph,
      h('span', { class: 'btn__label' }, label),
      prompt(action)
    );

  const star = icon(ICONS.star);
  const buttons = {
    play: button('play', 'Play', icon(ICONS.play, { fill: 'currentColor', stroke: 'none' }), () => game && onPlay(game)),
    info: button('info', 'More info', icon(INFO), () => game && onInfo(game)),
    fave: button('fave', 'Favourite', star, () => game && onFave(game), { 'aria-pressed': 'false' }),
  };

  const body = h('div', { class: 'hero__body' });
  root.append(body, h('div', { class: 'hero__actions' }, Object.values(buttons)));

  function syncFave() {
    const on = Boolean(game && store.isFave(game.slug));
    buttons.fave.setAttribute('aria-pressed', String(on));
    star.setAttribute('fill', on ? 'currentColor' : 'none');
  }

  /**
   * Put a game up. `spotlight` marks today's pick; `quick` is the surprise
   * shuffle, the name and little else; `still` skips the entrance, for a held
   * arrow passing through.
   */
  function show(next, { spotlight = false, quick = false, still = false } = {}) {
    game = next;
    const facts = quick ? [] : heroChips(next);
    append(clear(body), [
      spotlight && h('p', { class: 'hero__spot' }, h('span', { class: 'hero__spark', 'aria-hidden': 'true' }), "Today's spotlight"),
      h('p', { class: 'hero__eyebrow' }, eyebrow(next).join(' · ')),
      h('h2', { class: 'hero__name', 'data-fit': fit(next.name) }, next.name),
      next.tagline && h('p', { class: 'hero__tagline' }, next.tagline),
      !quick && next.description && h('p', { class: 'hero__blurb' }, next.description),
      facts.length > 0 &&
        h(
          'ul',
          { class: 'hero__chips', 'aria-label': 'Facts' },
          facts.map((chip) =>
            chip.keys
              ? h('li', { class: 'chip chip--keys', 'aria-label': chip.label }, keyRun(chip.keys))
              : h('li', { class: 'chip' }, chip.text)
          )
        ),
    ]);
    for (const [key, value] of Object.entries(paletteVars(cabinetPalette(next)))) root.style.setProperty(key, value);
    if (!quick && !still && !reducedMotion()) {
      body.classList.remove('is-new');
      void body.offsetWidth; // restart the entrance
      body.classList.add('is-new');
    }
    syncFave();
  }

  store.subscribe(syncFave);

  return {
    show,
    buttons: () => Object.values(buttons),
    button: (action) => buttons[action],
  };
}
