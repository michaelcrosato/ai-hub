/** Stable IDs used by the route tool and the content regression tests. */
export const locate = [
  'dispatch/briefing', 'dispatch/hold-line', 'dispatch/assign-search',
  'attendant/speak', { type: 'choice', conversation: 'attendant-account', choice: 'observed' },
  { type: 'choice', conversation: 'attendant-account', choice: 'limits' },
  'driver/welfare', 'driver/speak', { type: 'choice', conversation: 'driver-account', choice: 'listen' },
  { type: 'choice', conversation: 'driver-account', choice: 'limits' },
];
export const investigate = [
  'dispatch/engineer', 'engineer/isolation',
  { type: 'choice', conversation: 'engineer-account', choice: 'scope' },
  { type: 'choice', conversation: 'engineer-account', choice: 'record' },
  'signal/inspect', 'recorder/export', 'recorder/correct-time',
  { type: 'puzzle', puzzle: 'midnight-clock', choice: 'previous' },
  'service-log/read', 'relay/inspect', { type: 'item', item: 'camera', target: 'relay' },
  'relay/compare', { type: 'puzzle', puzzle: 'part-match', choice: 'mismatch' },
  { type: 'item', item: 'evidence-bag', target: 'relay' },
  'case-desk/file-exhibit', 'case-desk/timeline',
  { type: 'puzzle', puzzle: 'signal-timeline', choice: 'supported' },
];
export const community = [
  'passenger/needs', 'dispatch/arrange-ride', 'passenger/confirm-ride',
  'property/log', 'passenger/claim', { type: 'puzzle', puzzle: 'property-claim', choice: 'describe' }, 'property/return',
];
export default [
  { id: 'documented', steps: [...locate, ...investigate, 'case-desk/review', 'case-desk/sign-report'], expect: { completed: true, outcome: 'documented', score: 100 } },
  { id: 'community', steps: [...locate, ...community, ...investigate, { type: 'reload' }, 'case-desk/review', 'case-desk/sign-report'], expect: { completed: true, outcome: 'documented', score: 100 } },
  { id: 'safe-handover', steps: ['dispatch/briefing', 'dispatch/hold-line', 'dispatch/assign-search', 'driver/welfare', 'case-desk/handover'], expect: { completed: true, outcome: 'handover' } },
];
