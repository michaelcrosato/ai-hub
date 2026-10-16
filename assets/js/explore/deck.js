/** A reproducible discovery deck. The URL identifies both the deal and its card. */
import { h, ICONS, icon } from '../dom.js';
import { store } from '../store.js';
import { gameImage, gameMeta } from './common.js';

export const DEFAULT_SEED = 'first-deal';

function rank(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  return (result ^ (result >>> 16)) >>> 0;
}

function compareSlugs(a, b, seed) {
  const difference = rank(`${seed}\0${a}`) - rank(`${seed}\0${b}`);
  return difference || (a < b ? -1 : a > b ? 1 : 0);
}

/** Stable ranks preserve the order of surviving cards when a filter narrows. */
export function shuffleDeck(games, seed = DEFAULT_SEED) {
  const unique = new Map();
  for (const game of games) {
    if (game?.slug && !unique.has(game.slug)) unique.set(game.slug, game);
  }
  return [...unique.values()].sort((a, b) => compareSlugs(a.slug, b.slug, seed));
}

/** Resolve URL state without mutating the catalogue or allowing out-of-bounds cards. */
export function deckState(
  games,
  {
    seed = DEFAULT_SEED,
    card = '',
    done = false,
    unplayed = false,
    hasPlayed = () => false,
    previousCard = '',
  } = {},
) {
  const ordered = shuffleDeck(games, seed);
  const cards = ordered.filter((game) => !unplayed || !hasPlayed(game.slug));
  const requested = card || previousCard;
  const found = cards.findIndex((game) => game.slug === requested);
  const oldIndex = ordered.findIndex((game) => game.slug === requested);
  // Playing the focused card removes it from an unplayed deal. Continue after
  // its old position instead of repeating all the cards already skipped. The
  // previous anchor also survives removal from the host's favourites pool.
  const knownMissing = found < 0 && (oldIndex >= 0 || Boolean(previousCard && previousCard === requested));
  const nextSurvivor = knownMissing
    ? cards.find((game) => compareSlugs(game.slug, requested, seed) > 0)
    : null;
  const removedAtEnd = knownMissing && !nextSurvivor;
  const exhausted = Boolean(cards.length && (done || removedAtEnd));
  const index = exhausted ? cards.length : nextSurvivor ? cards.indexOf(nextSurvivor) : Math.max(0, found);
  const current = cards[index] || null;
  const anchor = found >= 0 || knownMissing ? requested : current?.slug || '';
  return { cards, index, exhausted, current, anchor };
}

/** A skip ends at the end; only an explicit redeal starts a new cycle. */
export function moveCard(state, delta) {
  if (!state.cards.length) return { card: null, deckDone: null };
  const next = Math.max(0, Math.min(state.cards.length, state.index + delta));
  return next === state.cards.length
    ? { card: state.cards.at(-1).slug, deckDone: '1' }
    : { card: state.cards[next].slug, deckDone: null };
}

function freshSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(2)).join('-');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createView(root, actions) {
  let state = deckState([]);
  let currentSeed = DEFAULT_SEED;
  let drawnSlug = null;
  let wasExhausted = false;
  let swipeStart = null;
  let lastQuery = null;
  root.classList.add('deck-view');

  const count = h('span', { class: 'deck-count' }, '0 / 0');
  const progress = h('progress', {
    class: 'deck-progress',
    max: 1,
    value: 0,
    'aria-label': 'Cards explored',
  });
  const live = h('p', {
    class: 'deck-sr-only',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  const surface = h('div', { class: 'deck-surface' });
  const card = h('article', { class: 'deck-card', tabindex: 0, 'aria-label': 'Discovery card' }, surface);

  const previous = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--previous',
      onclick: () => advance(-1),
    },
    icon(ICONS.back),
    'Previous',
  );
  const skip = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--skip',
      onclick: () => advance(1),
    },
    'Next card',
    icon(ICONS.back, { class: 'deck-forward' }),
  );
  const play = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--play',
      onclick: (event) => state.current && actions.play(state.current, event.currentTarget),
    },
    icon(ICONS.play, { fill: 'currentColor', stroke: 'none' }),
    'Play this',
  );
  const details = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--details',
      onclick: (event) => state.current && actions.info(state.current, event.currentTarget),
    },
    'Details',
  );
  const favourite = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--favourite',
      'aria-label': 'Add to favourites',
      'aria-pressed': 'false',
      onclick: () => {
        if (!state.current) return;
        actions.fave(state.current);
        syncFavourite();
      },
    },
    icon(ICONS.star),
  );
  const redeal = h(
    'button',
    {
      type: 'button',
      class: 'deck-button deck-button--redeal',
      onclick: dealAgain,
    },
    icon(ICONS.dice),
    'Shuffle & redeal',
  );
  const unplayed = h('input', {
    type: 'checkbox',
    class: 'deck-checkbox',
    onchange: () =>
      actions.setQuery({
        unplayed: unplayed.checked ? '1' : null,
        card: null,
        deckDone: null,
      }),
  });
  const filter = h('label', { class: 'deck-filter' }, unplayed, h('span', {}, 'Only unplayed'));
  const actionsRow = h(
    'div',
    { class: 'deck-actions', 'aria-label': 'Current card actions' },
    play,
    details,
    favourite,
  );
  const remaining = h('p', { class: 'deck-remaining' });

  root.append(
    h(
      'section',
      { class: 'deck-layout', 'aria-label': 'Discovery deck' },
      h(
        'aside',
        { class: 'deck-intro' },
        h(
          'p',
          { class: 'deck-eyebrow' },
          h('span', { class: 'deck-mark', 'aria-hidden': 'true' }, '✳'),
          'THE DISCOVERY DECK',
        ),
        h('h1', { class: 'deck-heading' }, 'Less browsing.', h('br'), h('em', {}, 'More playing.')),
        h(
          'p',
          { class: 'deck-description' },
          'One game at a time. Follow your curiosity, save a favourite, or turn the next card.',
        ),
        h(
          'div',
          { class: 'deck-session' },
          h('div', { class: 'deck-session-heading' }, h('span', {}, 'YOUR DEAL'), count),
          progress,
          remaining,
        ),
        filter,
        redeal,
        h(
          'p',
          { class: 'deck-hint' },
          h('kbd', {}, '←'),
          ' ',
          h('kbd', {}, '→'),
          ' to browse · swipe on the card',
        ),
      ),
      h(
        'div',
        { class: 'deck-stage' },
        h('div', { class: 'deck-stack' }, card),
        actionsRow,
        h(
          'nav',
          { class: 'deck-turn', 'aria-label': 'Move through the deck' },
          previous,
          h('span', { class: 'deck-turn-note', 'aria-hidden': 'true' }, 'WHAT WILL YOU FIND?'),
          skip,
        ),
      ),
    ),
    live,
  );

  function dealAgain() {
    actions.setQuery({ seed: freshSeed(), card: null, deckDone: null });
  }

  function advance(delta) {
    if (!state.cards.length || (delta > 0 && state.exhausted) || (delta < 0 && state.index === 0)) return;
    actions.setQuery(moveCard(state, delta));
  }

  function syncFavourite() {
    const saved = Boolean(state.current && actions.isFave(state.current.slug));
    favourite.setAttribute('aria-pressed', String(saved));
    favourite.setAttribute('aria-label', saved ? 'Remove from favourites' : 'Add to favourites');
    favourite.querySelector('svg').setAttribute('fill', saved ? 'currentColor' : 'none');
  }

  function setSelected(slug) {
    card.classList.toggle('deck-card--selected', Boolean(state.current && state.current.slug === slug));
  }

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      advance(event.key === 'ArrowRight' ? 1 : -1);
    } else if (
      (event.key === 'Enter' || event.key === ' ') &&
      !event.target.closest('button, a, [role="button"]')
    ) {
      event.preventDefault();
      if (state.current) actions.info(state.current, card);
    }
  });

  card.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || event.target.closest('button, a')) return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  card.addEventListener('pointerup', (event) => {
    if (!swipeStart || swipeStart.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) advance(dx < 0 ? 1 : -1);
  });
  card.addEventListener('pointercancel', () => {
    swipeStart = null;
  });

  return {
    getPool: () => state.cards,
    setSelected,
    update({ games, query, selected }) {
      const focused = document.activeElement;
      const ownedFocus = root.contains(focused);
      const queryText = query.toString();
      const seed = query.get('seed') || DEFAULT_SEED;
      state = deckState(games, {
        seed,
        card: query.get('card'),
        done: query.get('deckDone') === '1',
        unplayed: query.get('unplayed') === '1',
        hasPlayed: (slug) => store.plays(slug) > 0,
        previousCard: queryText === lastQuery ? state.anchor : '',
      });
      lastQuery = queryText;
      unplayed.checked = query.get('unplayed') === '1';
      const total = state.cards.length;
      count.textContent = `${Math.min(state.index + 1, total)} / ${total}`;
      progress.max = Math.max(1, total);
      progress.value = Math.min(state.index + 1, total);
      remaining.textContent = total
        ? `${Math.max(0, total - state.index - 1)} cards still to discover`
        : 'No cards in this deal';
      previous.disabled = !total || state.index === 0;
      skip.disabled = !state.current;
      play.disabled = !state.current;
      details.disabled = !state.current;
      favourite.disabled = !state.current;
      redeal.disabled = !total;
      actionsRow.hidden = !state.current;
      card.classList.toggle('deck-card--empty', !state.current);
      setSelected(selected);

      if (state.current) {
        const game = state.current;
        card.setAttribute(
          'aria-label',
          `${game.name}. Press Enter for details, or use arrow keys to browse.`,
        );
        if (drawnSlug !== game.slug || currentSeed !== seed) {
          surface.replaceChildren(
            h(
              'div',
              { class: 'deck-art' },
              gameImage(game, { className: 'deck-image', loading: 'eager' }),
              h('span', { class: 'deck-art-label' }, 'TODAY, TRY SOMETHING NEW'),
            ),
            h(
              'div',
              { class: 'deck-card-copy' },
              h('p', { class: 'deck-meta' }, gameMeta(game)),
              h('h2', { class: 'deck-title' }, game.name),
              h(
                'p',
                { class: 'deck-tagline' },
                game.tagline || game.description || 'A new discovery is one play away. Take it for a spin.',
              ),
            ),
          );
          live.textContent = `Card ${state.index + 1} of ${total}: ${game.name}`;
        }
      } else if (state.exhausted) {
        card.setAttribute('aria-label', 'Deal complete');
        surface.replaceChildren(
          h(
            'div',
            { class: 'deck-empty' },
            h('span', { class: 'deck-empty-symbol', 'aria-hidden': 'true' }, '✳'),
            h('p', { class: 'deck-eyebrow' }, 'DEAL COMPLETE'),
            h('h2', {}, 'You’ve seen them all.'),
            h(
              'p',
              {},
              `That’s ${total} ${total === 1 ? 'game' : 'games'} explored. Shuffle for a fresh order, or go back to the last card.`,
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'deck-button deck-button--play',
                onclick: dealAgain,
              },
              icon(ICONS.dice),
              'Deal again',
            ),
          ),
        );
        if (!wasExhausted) live.textContent = `Deal complete. All ${total} cards explored.`;
        remaining.textContent = 'Every card explored. Ready for another round?';
      } else {
        card.setAttribute('aria-label', 'No matching cards');
        surface.replaceChildren(
          h(
            'div',
            { class: 'deck-empty' },
            h('span', { class: 'deck-empty-symbol', 'aria-hidden': 'true' }, '◇'),
            h('p', { class: 'deck-eyebrow' }, 'AN EMPTY DECK'),
            h('h2', {}, unplayed.checked ? 'All caught up.' : 'No cards this time.'),
            h(
              'p',
              {},
              unplayed.checked
                ? 'Try turning off Only unplayed, or broaden your search to find more games.'
                : 'Broaden your search or change the shelf to build a new deal.',
            ),
            unplayed.checked &&
              h(
                'button',
                {
                  type: 'button',
                  class: 'deck-button deck-button--play',
                  onclick: () =>
                    actions.setQuery({
                      unplayed: null,
                      card: null,
                      deckDone: null,
                    }),
                },
                'Include played games',
              ),
          ),
        );
        live.textContent = 'No matching cards. Change your filters to build a new deal.';
      }
      drawnSlug = state.current?.slug || null;
      currentSeed = seed;
      wasExhausted = state.exhausted;
      syncFavourite();
      if (
        ownedFocus &&
        !root.closest('[inert]') &&
        (!focused.isConnected || focused.matches(':disabled') || focused.closest('[hidden]'))
      )
        card.focus({ preventScroll: true });
    },
  };
}
