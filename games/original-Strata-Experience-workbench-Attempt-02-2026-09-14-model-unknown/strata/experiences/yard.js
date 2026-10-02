import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { demoLevel } from './yard-data.js';
export function create() {
  const data = demoLevel();
  data.name = 'The Signal Yard';
  return new FPSExperience(data);
}
