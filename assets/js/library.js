/**
 * library.js — what the Couch and the Catalogue start from: the manifest,
 * less whatever the dev settings keep off the wall, so a hidden game is
 * hidden in every view. (The Wall predates this and does the same itself.)
 */

import { loadManifest } from './manifest.js';
import { isVisible } from './filter.js';
import { store } from './store.js';

export async function loadLibrary(url) {
  const manifest = await loadManifest(url);
  const showAll = store.dev().showAll;
  const games = manifest.games.filter((game) => isVisible(game, showAll));
  return { manifest, games, bySlug: new Map(games.map((game) => [game.slug, game])), showAll };
}
