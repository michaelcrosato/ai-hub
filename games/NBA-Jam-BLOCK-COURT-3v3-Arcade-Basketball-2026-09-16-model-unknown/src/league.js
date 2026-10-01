/**
 * Block Court — the Night League crews and everything the game remembers
 * between sessions (settings, records, league progress, contest bests).
 */

/**
 * The CPU crews. INFERNO is the house crew every Arcade game plays; the Night
 * League climbs all five in order. `style` names a CPU playbook in sim.js.
 */
export const CREWS = Object.freeze(
  [
    {
      id: 'inferno', name: 'INFERNO', tag: 'THE HOUSE CREW', style: 'balanced', difficulty: 'rookie',
      jersey: 0xe06a43, shorts: 0x733528, cuff: 0xaf462e, accent: 0xff784c, css: '#ff916b', paint: '#b96548', ink: '#fce6d3',
      players: [['BLAZE', '03'], ['NOVA', '11'], ['TANK', '34']],
    },
    {
      id: 'volts', name: 'VOLTS', tag: 'SHARPSHOOTERS', style: 'sharp', difficulty: 'pro',
      jersey: 0xd3c43b, shorts: 0x5a5016, cuff: 0xa39424, accent: 0xf2df5a, css: '#f2df5a', paint: '#9c9234', ink: '#fbf6d2',
      players: [['SPARK', '08'], ['AMP', '15'], ['WATT', '33']],
    },
    {
      id: 'ironclads', name: 'IRONCLADS', tag: 'LOCKDOWN DEFENSE', style: 'lockdown', difficulty: 'pro',
      jersey: 0x8796a8, shorts: 0x2f3947, cuff: 0x5d6b7c, accent: 0xb4c3d6, css: '#b4c3d6', paint: '#5f6f82', ink: '#e6edf5',
      players: [['RIVET', '21'], ['BOLT', '44'], ['ANVIL', '50']],
    },
    {
      id: 'comets', name: 'COMETS', tag: 'RUN AND GUN', style: 'balanced', difficulty: 'allstar',
      jersey: 0xd9579b, shorts: 0x6b2149, cuff: 0xa83a74, accent: 0xff6fb8, css: '#ff86c4', paint: '#a8487c', ink: '#ffe1f0',
      players: [['ORBIT', '09'], ['HALO', '13'], ['ZOOM', '24']],
    },
    {
      id: 'eclipse', name: 'ECLIPSE', tag: 'THE CHAMPIONS', style: 'sharp', difficulty: 'allstar',
      jersey: 0x7f62d8, shorts: 0x2d2160, cuff: 0x5a43a8, accent: 0xa48aff, css: '#b29cff', paint: '#62509e', ink: '#ebe4ff',
      players: [['UMBRA', '00'], ['LUNA', '12'], ['SHADE', '32']],
    },
  ].map((c) => Object.freeze(c))
);

export const DIFFICULTY_LABEL = Object.freeze({ rookie: 'ROOKIE', pro: 'PRO', allstar: 'ALL-STAR' });

/** Read a JSON object from localStorage over a fallback; never throws. */
export function load(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return raw && typeof raw === 'object' ? { ...fallback, ...raw } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: progress just isn't kept */
  }
}

export const KEYS = Object.freeze({
  settings: 'block-court-settings',
  record: 'block-court-record',
  league: 'block-court-league',
  contest: 'block-court-contest',
  menu: 'block-court-menu',
});

/** Night League progress: the rung you are on (0-4), titles won, games played. */
export function loadLeague() {
  const l = load(KEYS.league, { rung: 0, titles: 0, games: 0, wins: 0 });
  l.rung = Math.min(CREWS.length - 1, Math.max(0, l.rung | 0));
  return l;
}
