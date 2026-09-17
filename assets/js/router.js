/**
 * router.js — hash routing, so every view has a link you can send someone.
 *
 *   #/                        the wall
 *   #/g/undertow              the wall, with Undertow's drawer open
 *   #/play/undertow           playing the current build
 *   #/play/undertow/v0-4      playing a specific build
 *   #/?q=orbit&sort=newest    a filtered wall
 *
 * Filter state rides in the query and survives the drawer and the player,
 * because the wall behind them is never torn down.
 */

const listeners = new Set();
let last = null;

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const cut = raw.indexOf('?');
  const path = cut === -1 ? raw : raw.slice(0, cut);
  const query = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
  const [head, slug, build] = path.split('/').filter(Boolean);

  if (head === 'g' && slug) return { name: 'detail', slug, query };
  if (head === 'play' && slug) return { name: 'play', slug, build: build || null, query };
  return { name: 'wall', query };
}

function emit() {
  if (location.href === last) return;
  last = location.href;
  const route = parse();
  for (const fn of listeners) fn(route);
}

const queryString = (query) => {
  const text = query.toString();
  return text ? `?${text}` : '';
};

export const router = {
  current: parse,

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  start() {
    addEventListener('hashchange', emit);
    last = null;
    emit();
  },

  /** Navigate, carrying the current filter query along unless told otherwise. */
  go(path, { replace = false, query = parse().query } = {}) {
    const href = `#${path}${queryString(query)}`;
    if (replace) history.replaceState(null, '', href);
    else location.hash = href.slice(1);
    emit();
  },

  /** Update filter state without adding a history entry for every keystroke. */
  setQuery(patch) {
    const route = parse();
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '' || value === false) route.query.delete(key);
      else route.query.set(key, String(value));
    }
    const path = location.hash.replace(/^#/, '').split('?')[0] || '/';
    history.replaceState(null, '', `#${path}${queryString(route.query)}`);
    emit();
  },
};
