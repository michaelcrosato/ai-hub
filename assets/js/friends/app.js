/**
 * friends/app.js — the Friends view: the hub as a game-night console.
 *
 * Everything here is about playing with other people:
 *   - the party: host a session, join one from a link or a code, or try one
 *     in this browser's tabs first;
 *   - the hub's own game-night picks, and how a session goes;
 *   - every game that plays together, by how it plays: one world for
 *     everyone, ghosts, side by side (the three session modes) and couch
 *     co-op on one screen, narrowed by the party's size, a round's length
 *     and a search;
 *   - each game's page (#/g/slug): how it plays together, its goal and
 *     controls, and the ways to start it: host a session that opens with it,
 *     try that session in this browser, or practise alone (#/play/slug).
 *
 * The session itself is /session (session/app.js); this view only leads
 * there. The library and the memory of this device are the other views'.
 */

import { h, clear, append, icon, ICONS } from '../dom.js';
import { t, tx, fillPage, number } from '../lang.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { loadLibrary } from '../library.js';
import { shown as translated } from '../manifest.js';
import { router } from '../router.js';
import { createPlayer } from '../ui/player.js';
import { viewSwitch } from '../ui/views.js';
import { accountButton } from '../account/button.js';
import { languageMenu } from '../ui/language.js';
import { emblem } from '../ui/friends.js';
import { SLOT_COLORS } from '../../../lib/hub/round.js';
import { LENGTHS } from '../session/pick.js';
import { FORMATS } from '../session/score.js';
import {
  WAYS,
  PARTY_SIZES,
  MOST_SEATS,
  wayOf,
  togetherOf,
  togetherLine,
  seatsText,
  selectTogether,
  rowsOf,
  spotlightOf,
  tally,
  hostHref,
  joinHref,
  inviteCode,
} from './together.js';

fillPage();

const $ = (id) => document.getElementById(id);
/** A row shows this many before "See all". */
const ROW_MOST = 16;
/** The grid shows this many at a time. */
const PAGE = 48;

let library = null;
let user = undefined; // undefined: not asked yet; null: signed out
let webgpu = null; // null: not known yet
let shown = PAGE;
let lastScope = null;
let sheetSlug = null;
let sheetFrom = null;
let playFrom = null;
let lengthAtPlay = 0;
let launched = false;

$('views').append(viewSwitch('friends'), accountButton({ className: 'friends-head__account' }), languageMenu());

/* --- this browser ---------------------------------------------------------- */

/** A real WebGPU adapter: a software one has the API but not the speed. Most session games need one. */
(async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    webgpu = Boolean(adapter) && !(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter);
  } catch {
    webgpu = false;
  }
  if (library) {
    renderSpotlight();
    renderTogether(router.current(), { force: true });
  }
})();

/* --- the party: host, join, try -------------------------------------------- */

const signedIn = () => Boolean(user && !user.guest);

/**
 * Host a session, opening with `game` when one is given. Hosting needs a
 * Google sign-in: a signed-out device goes to Google first and comes back to
 * the session, which then asks for a name.
 */
async function host(game = null) {
  const href = hostHref(game);
  if (signedIn()) {
    location.href = href;
    return;
  }
  try {
    const auth = await import('../account/auth.js');
    const now = await auth.currentUser();
    if (now && !now.guest) {
      location.href = href;
      return;
    }
    await auth.signInWithGoogle(new URL(href, location.origin).href);
  } catch {
    // Sign-in is unavailable: the session page says so, and offers the rest.
    location.href = href;
  }
}

function hostButton(game = null, { className = '' } = {}) {
  return h(
    'button',
    { type: 'button', class: `party-host ${className}`.trim(), onclick: () => host(game) },
    emblem({ size: 22, className: 'party-host__emblem' }),
    h(
      'span',
      { class: 'party-host__text' },
      h('span', { class: 'party-host__label' }, game ? t('friends.host.with_game') : t('friends.host.label')),
      h('span', { class: 'party-host__sub' }, signedIn() ? t('friends.host.sub_signed_in') : t('friends.host.sub_signed_out'))
    )
  );
}

function joinForm() {
  const input = h('input', {
    id: 'join-code',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    placeholder: t('friends.join.placeholder'),
    'aria-describedby': 'join-note',
  });
  const note = h('span', { class: 'join-code__note', id: 'join-note' }, t('friends.join.note'));
  const form = h(
    'form',
    {
      class: 'join-code',
      onsubmit(event) {
        event.preventDefault();
        const code = inviteCode(input.value);
        if (!code) {
          note.textContent = t('friends.join.wrong');
          form.classList.add('is-wrong');
          input.focus();
          return;
        }
        location.href = joinHref(code);
      },
    },
    h('label', { class: 'join-code__label', for: 'join-code' }, t('friends.join.label')),
    h('span', { class: 'join-code__field' }, input, h('button', { type: 'submit', class: 'join-code__go' }, t('friends.join.go'))),
    note
  );
  input.addEventListener('input', () => {
    if (!form.classList.contains('is-wrong')) return;
    form.classList.remove('is-wrong');
    note.textContent = t('friends.join.note');
  });
  return form;
}

function renderParty() {
  const actions = $('party-actions');
  const typed = actions.querySelector('#join-code')?.value ?? '';
  clear(actions).append(hostButton(), joinForm());
  if (typed) actions.querySelector('#join-code').value = typed;
  append(clear($('party-local')), [
    tx('friends.party.local', { link: h('a', { href: hostHref(null, { local: true }) }, t('friends.party.local_link')) }),
  ]);
}

/** The table before anyone sits down: you, two friends and a seat still open. */
function renderTable() {
  const seats = [
    { name: t('friends.table.you'), tag: t('friends.table.host') },
    { name: t('friends.table.friend'), tag: t('friends.table.guest') },
    { name: t('friends.table.friend'), tag: t('friends.table.guest') },
    { name: t('friends.table.open'), tag: null },
  ];
  clear($('party-table')).append(
    h(
      'ol',
      { class: 'table-seats' },
      seats.map((seat, i) =>
        h(
          'li',
          { class: `table-seat${seat.tag ? '' : ' is-open'}`, style: { '--seat': SLOT_COLORS[i] } },
          h('span', { class: 'table-seat__puck' }, String(i + 1)),
          h('span', { class: 'table-seat__name' }, seat.name),
          seat.tag && h('span', { class: 'table-seat__tag' }, seat.tag)
        )
      )
    ),
    h('p', { class: 'table-note' }, t('friends.table.note', { count: MOST_SEATS }))
  );
}

function renderSteps() {
  const steps = [
    [t('friends.steps.host.title'), t('friends.steps.host.text')],
    [t('friends.steps.invite.title'), t('friends.steps.invite.text')],
    [t('friends.steps.play.title'), t('friends.steps.play.text')],
  ];
  append(clear($('steps')), [
    steps.map(([title, text], i) =>
      h('li', { class: 'step' }, h('span', { class: 'step__n', style: { '--seat': SLOT_COLORS[i] } }, String(i + 1)), h('h3', { class: 'step__title' }, title), h('p', { class: 'step__text' }, text))
    ),
  ]);
}

function renderFormats() {
  append(clear($('formats')), [
    Object.values(FORMATS).map((format) =>
      h('li', { class: 'format-card' }, h('h3', { class: 'format-card__name' }, format.label), h('p', { class: 'format-card__blurb' }, t('friends.formats.blurb', { blurb: format.blurb })))
    ),
  ]);
}

/* --- games ------------------------------------------------------------------ */

const WAY_GLYPHS = {
  // One globe: everyone in one world.
  'shared-world': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  // A runner and its ghost behind.
  ghost: 'M14 4a8 8 0 0 1 0 16M10 4a8 8 0 0 1 0 16M6 4a8 8 0 0 1 0 16',
  // Two lanes, side by side.
  parallel: 'M7 3v18M17 3v18M4 8h6M14 13h6',
  // A gamepad: one screen.
  couch: 'M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4zM8 11.5v3M6.5 13h3M16 12.5h.01M17.5 14h.01',
};

const wayGlyph = (key, size = 14) => icon(WAY_GLYPHS[key] ?? WAY_GLYPHS.parallel, { width: size, height: size, class: 'way-glyph' });

/** Cover art, or the game's own colours with its initials while there is none. */
function shot(game, { className = 'shot', loading = 'lazy' } = {}) {
  const src = game.cover || game.frames?.[0];
  return h(
    'span',
    { class: className, 'aria-hidden': 'true' },
    h('span', { class: `${className}__fallback` }, game.name.slice(0, 2).toUpperCase()),
    src && h('img', { src, alt: '', loading, decoding: 'async', onerror: (event) => event.currentTarget.remove() })
  );
}

function badges(how) {
  return [
    how.webgpu && webgpu === false && h('span', { class: 'badge badge--warn', title: t('friends.badge.webgpu_title') }, t('friends.badge.webgpu')),
    how.touch && h('span', { class: 'badge', title: t('friends.badge.touch_title') }, t('friends.badge.touch')),
  ].filter(Boolean);
}

function card(game, { big = false } = {}) {
  const how = togetherOf(game);
  return h(
    'a',
    {
      class: `tcard${big ? ' tcard--big' : ''}`,
      href: `#/g/${encodeURIComponent(game.slug)}`,
      style: paletteVars(cabinetPalette(game)),
      dataset: { slug: game.slug },
      'aria-label': t('friends.card.label', { game: game.name, line: togetherLine(game) }),
    },
    shot(game, { className: 'tcard__shot', loading: big ? 'eager' : 'lazy' }),
    h('span', { class: 'tcard__way' }, wayGlyph(how.way.key), how.way.label),
    h(
      'span',
      { class: 'tcard__body' },
      h('span', { class: 'tcard__name' }, game.name),
      h('span', { class: 'tcard__meta' }, how.minutes ? t('friends.card.meta', { seats: seatsText(how.seats), minutes: how.minutes }) : seatsText(how.seats)),
      (how.goal || game.tagline) && h('span', { class: 'tcard__goal' }, how.goal || game.tagline),
      h('span', { class: 'tcard__badges' }, badges(how))
    )
  );
}

function renderSpotlight() {
  const picks = spotlightOf(library.games);
  $('spotlight').hidden = picks.length === 0;
  append(clear($('spot-row')), [picks.map((game) => card(game, { big: true }))]);
}

/* --- the selection ---------------------------------------------------------- */

const scopeOf = (query) => ({
  q: query.get('q') || '',
  players: PARTY_SIZES.includes(Number(query.get('players'))) ? Number(query.get('players')) : 0,
  way: WAYS.some((w) => w.key === query.get('way')) ? query.get('way') : '',
  length: LENGTHS.some((l) => l.value === query.get('length')) ? query.get('length') : '',
});
const anyScope = (scope) => Boolean(scope.q || scope.players || scope.way || scope.length);

function segmented(name, label, options, current, onPick) {
  return h(
    'div',
    { class: 'seg', role: 'radiogroup', 'aria-label': label },
    h('span', { class: 'seg__label', 'aria-hidden': 'true' }, label),
    h(
      'span',
      { class: 'seg__options' },
      options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: 'seg__option',
            role: 'radio',
            'aria-checked': String(o.value === current),
            id: `${name}-${o.value || 'any'}`,
            disabled: o.count === 0 && o.value !== current ? true : null,
            title: o.title,
            onclick: () => onPick(o.value),
          },
          o.glyph,
          h('span', {}, o.label),
          o.count != null && h('span', { class: 'seg__count' }, number(o.count))
        )
      )
    )
  );
}

let searchEl = null;
let choicesEl = null;
const setScope = (patch) => {
  shown = PAGE;
  router.setQuery(patch);
};

/** The toolbar: the search is built once, so typing never loses it; the choices are redrawn with their counts. */
function renderBar(scope) {
  const set = setScope;
  // What each choice would leave, the others as they are.
  const countWith = (patch) => selectTogether(library.games, { ...scope, ...patch }).length;
  if (!searchEl) {
    searchEl = h('input', {
      type: 'search',
      id: 'together-search',
      placeholder: t('friends.search.placeholder'),
      autocomplete: 'off',
      enterkeyhint: 'search',
      oninput: () => set({ q: searchEl.value }),
    });
    choicesEl = h('div', { class: 'together__choices' });
    $('together-bar').append(
      h('label', { class: 'together__search' }, h('span', { class: 'visually-hidden' }, t('friends.search.label')), icon(ICONS.search, { width: 16, height: 16 }), searchEl),
      choicesEl
    );
  }
  if (document.activeElement !== searchEl) searchEl.value = scope.q;
  const keepFocus = choicesEl.contains(document.activeElement) && document.activeElement.id;
  append(clear(choicesEl), [
    segmented(
      'players',
      t('friends.filter.players'),
      [{ value: 0, label: t('friends.filter.any') }, ...PARTY_SIZES.map((n) => ({ value: n, label: number(n), title: t('friends.filter.seats_title', { count: n }), count: countWith({ players: n }) }))],
      scope.players,
      (value) => set({ players: value || null })
    ),
    segmented(
      'way',
      t('friends.filter.how'),
      [{ value: '', label: t('friends.filter.every_way') }, ...WAYS.map((w) => ({ value: w.key, label: w.label, title: w.blurb, glyph: wayGlyph(w.key), count: countWith({ way: w.key }) }))],
      scope.way,
      (value) => set({ way: value || null })
    ),
    segmented(
      'length',
      t('friends.filter.round'),
      [{ value: '', label: t('friends.filter.any_length') }, ...LENGTHS.map((l) => ({ value: l.value, label: l.label, title: l.blurb, count: countWith({ length: l.value }) }))],
      scope.length,
      (value) => set({ length: value || null })
    ),
    anyScope(scope) && h('button', { type: 'button', class: 'together__reset', id: 'together-reset', onclick: () => set({ q: null, players: null, way: null, length: null }) }, t('friends.filter.reset')),
  ]);
  if (keepFocus) (document.getElementById(keepFocus) ?? searchEl).focus();
}

function row(r) {
  const more = r.games.length - ROW_MOST;
  return h(
    'section',
    { class: 'trow', 'aria-labelledby': `row-${r.key}` },
    h(
      'header',
      { class: 'trow__head' },
      h('h3', { class: 'trow__title', id: `row-${r.key}` }, wayGlyph(r.key, 18), r.title),
      h('p', { class: 'trow__blurb' }, tx('friends.way.intro', { title: h('strong', {}, r.label), blurb: r.blurb })),
      h(
        'button',
        { type: 'button', class: 'trow__all', onclick: () => setScope({ way: r.key }) },
        t('friends.row.see_all', { count: r.games.length }),
        icon('M9 5l7 7-7 7', { width: 14, height: 14 })
      )
    ),
    h('div', { class: 'trow__strip' }, r.games.slice(0, ROW_MOST).map((game) => card(game)), more > 0 && h('button', { type: 'button', class: 'trow__more', onclick: () => setScope({ way: r.key }) }, h('span', {}, t('friends.row.more_count', { count: more })), h('span', {}, t('friends.row.more'))))
  );
}

function renderTogether(route, { force = false } = {}) {
  const scope = scopeOf(route.query);
  const key = JSON.stringify(scope) + shown + webgpu;
  if (!force && key === lastScope) return;
  lastScope = key;
  renderBar(scope);
  const games = selectTogether(library.games, scope);
  const counts = tally(library.games);
  $('together-count').textContent = anyScope(scope)
    ? t('friends.count.filtered', { shown: games.length, total: counts.all })
    : t('friends.count.all', { online: counts.online, screen: counts.screen });
  const needGpu = games.filter((game) => togetherOf(game).webgpu).length;
  const notice = $('together-notice');
  notice.hidden = !(webgpu === false && needGpu > 0);
  notice.textContent = notice.hidden
    ? ''
    : t('friends.notice.webgpu', { count: needGpu });

  const body = clear($('together-body'));
  if (!games.length) {
    body.append(
      h(
        'p',
        { class: 'together__empty' },
        tx('friends.empty.line', {
          button: h('button', { type: 'button', class: 'link', onclick: () => setScope({ q: null, players: null, way: null, length: null }) }, t('friends.filter.reset')),
        })
      )
    );
    return;
  }
  if (!anyScope(scope)) {
    append(body, [rowsOf(games).map(row)]);
    return;
  }
  const way = wayOf(scope.way);
  append(body, [
    way && h('p', { class: 'together__way' }, wayGlyph(way.key, 18), tx('friends.way.intro', { title: h('strong', {}, way.title), blurb: way.blurb })),
    h('div', { class: 'tgrid' }, games.slice(0, shown).map((game) => card(game))),
    games.length > shown &&
      h(
        'button',
        {
          type: 'button',
          class: 'together__more',
          onclick: () => {
            shown += PAGE;
            renderTogether(router.current(), { force: true });
          },
        },
        t('friends.together.show_more', { count: games.length - shown })
      ),
  ]);
}

/* --- a game's page ------------------------------------------------------------ */

const sheetRoot = $('sheet');

function closeSheet() {
  if (sheetFrom === 'here') history.back();
  else router.go('/', { replace: true });
}

function fact(label, value) {
  return value ? h('div', { class: 'sheet__fact' }, h('dt', {}, label), h('dd', {}, value)) : null;
}

function openSheet(game) {
  const how = togetherOf(game);
  // Back to what opened it: a card on this page. Coming back from practice, keep the one it had.
  const from = document.activeElement;
  const returnTo = from instanceof HTMLElement && $('friends-shell').contains(from) ? from : sheetRoot.returnTo?.isConnected ? sheetRoot.returnTo : null;
  const close = h('button', { type: 'button', class: 'sheet__close', 'aria-label': t('friends.sheet.close'), onclick: closeSheet }, icon(ICONS.close));
  const actions = how.online
    ? [
        hostButton(game, { className: 'sheet__host' }),
        h(
          'a',
          { class: 'sheet__action', href: hostHref(game, { local: true }), title: t('friends.sheet.try_title') },
          icon('M4 5h16v11H4zM8 20h8M12 16v4', { width: 16, height: 16 }),
          t('friends.sheet.try')
        ),
        h(
          'a',
          { class: 'sheet__action', href: `#/play/${encodeURIComponent(game.slug)}` },
          icon(ICONS.play, { width: 15, height: 15, fill: 'currentColor', stroke: 'none' }),
          t('friends.sheet.practise')
        ),
      ]
    : [
        h(
          'a',
          { class: 'party-host sheet__host', href: `#/play/${encodeURIComponent(game.slug)}` },
          icon(ICONS.play, { width: 20, height: 20, fill: 'currentColor', stroke: 'none' }),
          h('span', { class: 'party-host__text' }, h('span', { class: 'party-host__label' }, t('friends.sheet.screen')), h('span', { class: 'party-host__sub' }, t('friends.sheet.screen_sub')))
        ),
      ];
  const panel = h(
    'div',
    { class: 'sheet__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-name', style: paletteVars(cabinetPalette(game)) },
    shot(game, { className: 'sheet__shot', loading: 'eager' }),
    close,
    h(
      'div',
      { class: 'sheet__body' },
      h('p', { class: 'sheet__eyebrow' }, wayGlyph(how.way.key), togetherLine(game)),
      h('h2', { class: 'sheet__name', id: 'sheet-name' }, game.name),
      game.tagline && h('p', { class: 'sheet__tagline' }, game.tagline),
      h('p', { class: 'sheet__way' }, tx('friends.way.intro', { title: h('strong', {}, how.way.title), blurb: how.way.blurb })),
      h('div', { class: 'sheet__actions' }, actions),
      how.online && h('p', { class: 'sheet__hint' }, t('friends.sheet.hint')),
      h(
        'dl',
        { class: 'sheet__facts' },
        fact(t('friends.sheet.goal'), how.goal),
        fact(t('friends.sheet.controls'), how.howto),
        fact(t('friends.sheet.seats'), how.online ? t('friends.sheet.seats_online', { seats: seatsText(how.seats) }) : t('friends.sheet.seats_screen', { seats: seatsText(how.seats) })),
        fact(t('friends.sheet.round'), how.minutes ? t('friends.minutes', { minutes: how.minutes }) : null),
        how.online && how.screen && fact(t('friends.sheet.also'), t('friends.sheet.seats_screen', { seats: seatsText(how.screen) })),
        how.webgpu && fact(t('friends.sheet.needs'), webgpu === false ? t('friends.sheet.needs_no_webgpu') : t('friends.sheet.needs_webgpu'))
      ),
      game.description && h('p', { class: 'sheet__blurb' }, translated(game, 'description')),
      h('a', { class: 'sheet__wall', href: `/#/g/${encodeURIComponent(game.slug)}` }, t('friends.sheet.wall'))
    )
  );
  clear(sheetRoot).append(h('button', { type: 'button', class: 'sheet__scrim', 'aria-label': t('friends.sheet.close'), tabindex: '-1', onclick: closeSheet }), panel);
  sheetRoot.hidden = false;
  sheetRoot.returnTo = returnTo;
  $('friends-shell').inert = true;
  document.body.classList.add('has-sheet');
  (panel.querySelector('.sheet__host') || close).focus({ preventScroll: true });
}

function hideSheet() {
  if (sheetRoot.hidden) return;
  const back = sheetRoot.returnTo;
  sheetRoot.hidden = true;
  clear(sheetRoot);
  $('friends-shell').inert = false;
  document.body.classList.remove('has-sheet');
  const tile = sheetSlug && document.querySelector(`.tcard[data-slug="${CSS.escape(sheetSlug)}"]`);
  (back?.isConnected ? back : tile)?.focus({ preventScroll: true });
}

addEventListener('keydown', (event) => {
  if (player.isOpen() || sheetRoot.hidden) {
    if (event.key === '/' && !player.isOpen() && !event.target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault();
      searchEl?.focus();
    }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSheet();
  } else if (event.key === 'Tab') {
    const controls = [...sheetRoot.querySelectorAll('.sheet__panel button, .sheet__panel a[href]')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !sheetRoot.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});

/* --- practising alone ----------------------------------------------------------- */

let returnPath = '/';
const player = createPlayer($('player'), {
  backLabel: t('friends.player.back'),
  onExit() {
    const playing = location.href;
    if (launched) history.go(-1 - Math.max(0, history.length - lengthAtPlay));
    else router.go(returnPath, { replace: true });
    setTimeout(() => {
      if (player.isOpen() && location.href === playing) router.go(returnPath, { replace: true });
    }, 400);
  },
  onRoll() {
    const scope = scopeOf(router.current().query);
    const choices = selectTogether(library.games, scope).filter((game) => game.slug !== player.current()?.slug);
    if (choices.length) router.go(`/play/${choices[Math.floor(Math.random() * choices.length)].slug}`, { replace: true });
  },
});

/* --- routes ----------------------------------------------------------------------- */

function render(route) {
  if (!library) return;
  const game = route.slug ? library.bySlug.get(route.slug) : null;
  if (route.slug && (!game || !togetherOf(game))) {
    // A game that plays alone (one carried over from another view), or one
    // that is not here: this view's own home, with the search kept.
    router.go('/', { replace: true });
    return;
  }
  if (route.name === 'play') {
    hideSheet();
    $('friends-shell').inert = true;
    const build = game.builds.find((b) => route.build && (b.id === route.build || b.version === route.build)) || game.builds[0];
    if (player.current()?.slug === game.slug && player.currentBuild()?.id === build?.id) return;
    if (!player.isOpen()) {
      lengthAtPlay = history.length;
      returnPath = sheetSlug === game.slug ? `/g/${game.slug}` : '/';
    }
    player.open(game, build, { fromTile: playFrom });
    playFrom = null;
    return;
  }
  const wasPlaying = player.isOpen();
  player.close();
  $('friends-shell').inert = false;
  launched = false;
  renderTogether(route);
  if (route.name === 'detail') {
    if (sheetSlug !== game.slug || sheetRoot.hidden) {
      sheetSlug = game.slug;
      openSheet(game);
    } else if (wasPlaying) {
      $('friends-shell').inert = true;
      sheetRoot.querySelector('.sheet__host, .sheet__close')?.focus({ preventScroll: true });
    }
  } else {
    hideSheet();
    sheetSlug = null;
    sheetFrom = null;
  }
}

// A card opened from this page closes with Back; one reached by a link closes to the page.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#/g/"], a[href^="#/play/"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (link.getAttribute('href').startsWith('#/g/')) sheetFrom = 'here';
  else {
    launched = true;
    playFrom = link;
  }
});

async function boot() {
  renderParty();
  renderTable();
  renderSteps();
  renderFormats();
  append(clear($('friends-foot')), [tx('friends.foot', { link: h('a', { href: '/privacy/' }, t('friends.foot.link')) })]);
  import('../account/auth.js')
    .then(async (auth) => {
      user = await auth.currentUser();
      renderParty();
      auth.onUser((next) => {
        user = next;
        renderParty();
      });
    })
    .catch(() => {
      user = null;
    });
  try {
    library = await loadLibrary();
    renderSpotlight();
    router.subscribe(render);
    router.start();
  } catch (error) {
    console.error(error);
    $('together-count').textContent = t('friends.library.failed');
  }
}

boot();
