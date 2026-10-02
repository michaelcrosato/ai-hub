import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { relayLevel } from './relay-data.js';
export function create() {
  return new FPSExperience(relayLevel());
}
