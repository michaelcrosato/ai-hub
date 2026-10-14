/** Declared playable routes mirrored from the preserved pre-refactor regression fixtures. */
export const cleanRoute = [
  'radio/briefing', 'radio/secure-road', 'radio/call-medics', 'courier/assess-injuries',
  'courier/ask-route', 'courier/ask-impact', 'trace/survey', 'trace/photograph',
  'trace/wear-gloves', 'trace/collect-paint', 'trace/collect-seal', 'witness/introduce',
  'witness/ask-vehicle', 'witness/ask-time', 'witness/ask-certainty', 'camera/request-access',
  'camera/play-footage', 'camera/compare-clock', 'camera/time-2214', 'van/inspect-exterior',
  'van/photograph-van', 'van/check-registration', 'manifest/read-ledger', 'manifest/check-access',
  'manifest/compare-seal', 'suspect/ask-alibi', 'report/timeline-correct', 'radio/search-authority',
  'van/search-van', 'radio/request-backup', 'suspect/calm-approach', 'suspect/explain-rights',
  'suspect/present-evidence', 'suspect/peaceful-custody', 'report/review-custody',
  'report/theory-supported', 'report/charges-supported', 'report/arrange-transfer', 'report/submit-report',
];
const alternate = [
  ...cleanRoute.slice(0, 4), 'radio/request-backup', 'suspect/ask-alibi', 'manifest/read-ledger',
  'manifest/check-access', 'van/inspect-exterior', 'van/check-registration', 'van/photograph-van',
  'witness/introduce', 'camera/request-access', 'camera/play-footage', 'camera/compare-clock',
  'camera/time-2214', 'witness/ask-vehicle', 'witness/ask-certainty', 'witness/ask-time',
  'trace/survey', 'trace/wear-gloves', 'trace/photograph', 'trace/collect-seal', 'trace/collect-paint',
  'manifest/compare-seal', 'courier/ask-route', 'courier/ask-impact', 'report/timeline-open',
  'report/timeline-correct', 'radio/search-authority', 'van/search-van', 'suspect/calm-approach',
  'suspect/explain-rights', 'suspect/present-evidence', 'suspect/peaceful-custody',
  'suspect/record-voluntary', 'report/arrange-transfer', 'report/theory-supported',
  'report/review-custody', 'report/charges-supported', 'report/submit-report',
];
const mistakes = {
  'witness/introduce': ['witness/lead-witness', 'witness/lead-witness'],
  'camera/compare-clock': ['camera/time-2206', 'camera/time-2158'],
  'suspect/ask-alibi': ['suspect/demand-confession', 'suspect/demand-confession', 'report/timeline-camera', 'report/timeline-call'],
  'report/review-custody': ['report/theory-intent', 'report/theory-coupe'],
  'report/theory-supported': ['report/charges-murder', 'report/charges-release'],
};
export default [
  { id: 'clean', steps: cleanRoute, expect: { completed: true, outcome: 'case-closed', score: 100, flags: { voluntaryRecorded: false } } },
  { id: 'alternate-order', steps: alternate, expect: { completed: true, outcome: 'case-closed', score: 100, evidence: ['voluntary'] } },
  { id: 'mistakes-and-recovery', steps: cleanRoute.flatMap((command) => [command, ...(mistakes[command] || [])]), expect: { completed: true, outcome: 'case-closed', score: 69 } },
];
