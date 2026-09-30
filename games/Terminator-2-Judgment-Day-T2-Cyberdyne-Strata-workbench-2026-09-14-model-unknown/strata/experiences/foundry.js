import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { foundryData } from './foundry-data.js';
export function create() {
  return new FPSExperience(foundryData(false));
}
