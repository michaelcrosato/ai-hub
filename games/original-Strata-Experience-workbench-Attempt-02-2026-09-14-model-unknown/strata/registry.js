import { Registry } from './core/contracts.js';
import { foundry, crossfire, switchback, yard, relay } from './experiences/manifests.js';
export function allExperiences() {
  const r = new Registry();
  r.register(foundry, () => import('./experiences/foundry.js'));
  r.register(crossfire, () => import('./experiences/foundry-alt.js'));
  r.register(switchback, () => import('./experiences/switchback.js'));
  r.register(yard, () => import('./experiences/yard.js'));
  r.register(relay, () => import('./experiences/relay.js'));
  return r;
}
