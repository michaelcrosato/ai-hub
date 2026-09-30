import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { vaultData } from './vault-data.js';
export function create() {
  return new FPSExperience(vaultData());
}
