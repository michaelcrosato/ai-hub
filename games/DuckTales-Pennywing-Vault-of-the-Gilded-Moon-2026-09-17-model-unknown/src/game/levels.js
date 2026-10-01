// Every expedition, in order. The title screen lists these; results offer the next one.
import { VAULT_I } from './level.js';
import { VAULT_II } from './level2.js';

export const LEVELS = [VAULT_I, VAULT_II];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
