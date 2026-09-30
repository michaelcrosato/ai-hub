const base = { protocol: 1, version: '0.2.0', accepts: ['strata.soldier/1'] };
export const foundry = {
  ...base,
  id: 'foundry',
  title: 'The Foundry',
  kind: 'fps',
  slot: 'breach',
  subtitle: 'Clear the compound. Take the vehicle.',
  capabilities: ['fps.box-physics', 'fps.weapons', 'fps.sentries', 'fps.interaction'],
  routes: { escape: 'switchback' },
};
export const crossfire = {
  ...base,
  id: 'foundry-alt',
  title: 'Foundry / Crossfire',
  kind: 'fps',
  slot: 'breach',
  subtitle: 'The same contract. A different encounter.',
  capabilities: ['fps.box-physics', 'fps.weapons', 'fps.sentries', 'fps.interaction'],
  routes: { escape: 'switchback' },
};
export const switchback = {
  ...base,
  id: 'switchback',
  title: 'Switchback',
  kind: 'driving',
  slot: 'escape',
  subtitle: 'Drive the north road to the Signal Yard.',
  capabilities: ['driving.arcade', 'driving.checkpoints'],
  routes: { complete: 'yard' },
};
export const yard = {
  ...base,
  id: 'yard',
  title: 'The Signal Yard',
  kind: 'fps',
  slot: 'arrival',
  subtitle: 'Move, connect signals, and open the gate.',
  capabilities: ['fps.box-physics', 'fps.interaction', 'fps.signals'],
  routes: { complete: 'vault' },
};
export const vault = {
  ...base,
  id: 'vault',
  title: 'The Vault',
  kind: 'fps',
  slot: 'finale',
  subtitle: 'Scan in, restore power, clear the guard and open the vault.',
  capabilities: ['fps.box-physics', 'fps.weapons', 'fps.sentries', 'fps.signals', 'fps.logic'],
  routes: { complete: '$finish' },
};
