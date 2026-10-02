import { FPSExperience } from '../kits/fps/FPSExperience.js';
import { demoLevel } from './yard-data.js';
export function create() {
  const data = demoLevel();
  data.name = 'The Signal Yard';
  // In the Northbound sequence the yard's gate leads on to the depot.
  const goal = data.entities.find((e) => e.id === 'exit')?.components.find((c) => c.type === 'goal');
  if (goal) goal.message = 'Gate open. The line runs on to the Northbound Depot.';
  return new FPSExperience(data);
}
