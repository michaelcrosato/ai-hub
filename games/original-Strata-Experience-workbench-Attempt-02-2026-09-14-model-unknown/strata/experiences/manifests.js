const base = { protocol: 1, version: '0.3.0', accepts: ['strata.soldier/1'] };
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
  routes: { complete: 'relay' },
};
export const relay = {
  ...base,
  id: 'relay',
  title: 'Ridge Relay',
  kind: 'fps',
  slot: 'finale',
  subtitle: 'Power the relay. Signal the north.',
  capabilities: ['fps.box-physics', 'fps.weapons', 'fps.sentries', 'fps.signals', 'fps.logic'],
  routes: { complete: '$finish' },
};
