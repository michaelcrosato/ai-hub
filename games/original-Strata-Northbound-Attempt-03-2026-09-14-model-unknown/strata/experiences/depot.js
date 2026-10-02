import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { depotData } from './depot-data.js';
export function create() {
  return new FPSExperience(depotData());
}
