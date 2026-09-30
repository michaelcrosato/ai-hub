import { manifest as cyberdyne } from './experiences/cyberdyne/Cyberdyne.js';
import { Registry } from './core/contracts.js';
import { foundry, crossfire, switchback, yard, vault } from './experiences/manifests.js';
export function allExperiences() {
  const r = new Registry();
  r.register(cyberdyne, () => import('./experiences/cyberdyne/Cyberdyne.js'));
  r.register(foundry, () => import('./experiences/foundry.js'));
  r.register(crossfire, () => import('./experiences/foundry-alt.js'));
  r.register(switchback, () => import('./experiences/switchback.js'));
  r.register(yard, () => import('./experiences/yard.js'));
  r.register(vault, () => import('./experiences/vault.js'));
  return r;
}
