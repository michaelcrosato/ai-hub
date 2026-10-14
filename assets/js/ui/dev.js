/**
 * ui/dev.js — developer settings, behind a PIN.
 *
 * There is no button for this on purpose. It opens with Shift + F2, or five
 * quick taps on the sign's name on a phone, and asks for a PIN first. That is
 * a shared-device lock, not security: every game is a public file and the
 * manifest lists them all. It exists so the wall a family sees stays the
 * curated one.
 *
 * Unlocking lasts for this browser tab. The settings themselves are kept on
 * the device, like favourites.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { store } from '../store.js';
import { SHELVES, shelfOf } from '../filter.js';
import { createAudioReview } from './audio-review.js';
import { bytes, plural } from '../format.js';

const PINS = new Set(['0000', '1111', '1234', '8888', '9999']);
const UNLOCK_KEY = 'ai-hub:dev-unlocked';

const unlocked = () => {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
};

const setUnlocked = (on) => {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1');
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* private mode: the PIN is simply asked for every time */
  }
};

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function createDev(root, { library }) {
  let returnFocus = null;
  let open = false;

  function close() {
    open = false;
    root.hidden = true;
    clear(root);
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  function frame(title, ...body) {
    return [
      h('button', { class: 'dev__scrim', type: 'button', 'aria-label': 'Close developer settings', onclick: close }),
      h(
        'div',
        { class: 'dev__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h(
          'header',
          { class: 'dev__head' },
          h('h2', {}, title),
          h('button', { class: 'dev__close', type: 'button', 'aria-label': 'Close', onclick: close }, icon(ICONS.close))
        ),
        ...body
      ),
    ];
  }

  /* --- the PIN ------------------------------------------------------------ */

  function showPin() {
    const message = h('p', { class: 'dev__hint', 'aria-live': 'polite' }, 'Enter the four-digit PIN.');
    const input = h('input', {
      class: 'dev__pin',
      type: 'password',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: 4,
      autocomplete: 'off',
      'aria-label': 'PIN',
      oninput: () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 4);
        if (input.value.length < 4) return;
        if (PINS.has(input.value)) {
          setUnlocked(true);
          render();
          return;
        }
        input.value = '';
        message.textContent = 'Not that one. Try again.';
        panel.classList.remove('is-wrong');
        void panel.offsetWidth; // restart the shake
        panel.classList.add('is-wrong');
      },
    });
    clear(root);
    root.append(...frame('Developer settings', h('div', { class: 'dev__body dev__body--pin' }, input, message)));
    const panel = root.querySelector('.dev__panel');
    input.focus();
  }

  /* --- the settings ------------------------------------------------------- */

  function toggle(key, label, note) {
    const on = store.dev()[key];
    return h(
      'label',
      { class: 'dev__toggle' },
      h('input', {
        type: 'checkbox',
        checked: on,
        onchange: (event) => {
          store.setDev({ [key]: event.target.checked });
          render();
        },
      }),
      h('span', { class: 'dev__switch', 'aria-hidden': 'true' }),
      h('span', { class: 'dev__label' }, label, note && h('small', {}, note))
    );
  }

  function reset(label, count, what, question) {
    return h(
      'button',
      {
        class: 'dev__reset',
        type: 'button',
        disabled: count === 0,
        onclick: () => {
          if (!confirm(question)) return;
          store.forget(what);
          render();
        },
      },
      label,
      h('span', { class: 'dev__count' }, count)
    );
  }

  function showSettings() {
    const { games, generatedAt, totalBytes } = library();
    const hidden = games.filter((g) => g.restricted === true);
    const byShelf = SHELVES.map((s) => [s.label, games.filter((g) => shelfOf(g) === s.key && !g.restricted).length]);
    const played = games.filter((g) => store.plays(g.slug) > 0).length;
    const faves = store.faveCount();
    const standalone = store.standaloneCount();

    const facts = [
      ...byShelf,
      ['Hidden from the wall', hidden.length],
      ['Size of the library', bytes(totalBytes)],
      ['Catalogue built', generatedAt ? WHEN.format(Date.parse(generatedAt)) : '—'],
    ];

    clear(root);
    root.append(
      ...frame(
        'Developer settings',
        h(
          'div',
          { class: 'dev__body' },
          h(
            'section',
            {},
            h('h3', {}, 'Show'),
            toggle(
              'showAll',
              'Show all content',
              hidden.length
                ? `${plural(hidden.length, 'game')} kept off the wall appear, marked Hidden: ${hidden
                    .map((g) => g.name)
                    .filter((n, i, a) => a.indexOf(n) === i)
                    .join(', ')}.`
                : 'Nothing is hidden right now.'
            ),
            toggle('showSlugs', 'Show slugs and file sizes on cabinets', 'The slug is the key overrides.json, covers/ and links use.')
          ),
          h(
            'section',
            {},
            h('h3', {}, 'Playing'),
            toggle('alwaysStandalone', 'Open every game in a plain tab', 'Skips the frame, for checking a game that misbehaves inside the hub.')
          ),
          h(
            'section',
            {},
            h('h3', {}, 'This device'),
            h(
              'div',
              { class: 'dev__resets' },
              reset('Forget play history', played, 'history', 'Forget which games were played on this device, and how often?'),
              reset('Clear favourites', faves, 'faves', 'Remove every favourite on this device?'),
              reset('Forget plain-tab choices', standalone, 'standalone', 'Let every game open inside the hub again?')
            )
          ),
          h(
            'section',
            {},
            h('h3', {}, 'Library'),
            h(
              'dl',
              { class: 'dev__facts' },
              ...facts.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, String(v))))
            )
          ),
          createAudioReview(games),
          h(
            'footer',
            { class: 'dev__foot' },
            h('p', {}, 'Opens with Shift + F2, or five quick taps on “AI Hub”.'),
            h(
              'button',
              {
                class: 'dev__lock',
                type: 'button',
                onclick: () => {
                  setUnlocked(false);
                  close();
                },
              },
              'Lock'
            )
          )
        )
      )
    );
    root.querySelector('.dev__close').focus();
  }

  const render = () => (unlocked() ? showSettings() : showPin());

  return {
    isOpen: () => open,
    close,
    open() {
      if (open) return;
      open = true;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.hidden = false;
      render();
    },
  };
}
