import { CAIRNS, isNightHour } from './config.js';

// Field commissions: the expedition's goals. Each one unlocks a piece of
// equipment (a perk) that the other systems read from game.perks.
const uniqueNames = (records, category) => new Set(records.filter(r => r.category === category).map(r => r.name)).size;

/** Water samples that are all at least `gap` metres from each other (greedy). */
function spreadSamples(records, gap = 300) {
  const kept = [];
  for (const r of records) {
    if (r.category !== 'water') continue;
    if (kept.every(k => Math.hypot(k.x - r.x, k.z - r.z) >= gap)) kept.push(r);
  }
  return kept.length;
}

export const COMMISSIONS = [
  { id: 'first', title: 'First entries', text: 'Record 3 observations of any kind.', goal: 3,
    progress: s => s.records.length, perk: 'lens', reward: 'Scanner lens: recording takes 30% less time.' },
  { id: 'wayfinder', title: 'Wayfinder', text: `Reach 4 of the ${CAIRNS.length} landmark cairns.`, goal: 4,
    progress: s => s.landmarks.size, perk: 'boots', reward: 'Trail boots: sprint 12% faster.' },
  { id: 'naturalist', title: 'Naturalist', text: 'Record 6 different plant species.', goal: 6,
    progress: s => uniqueNames(s.records, 'flora'), perk: 'pulse', reward: 'Wide-band pulse: 50% more range, recharges in 4 s.' },
  { id: 'tracker', title: 'Tracker', text: 'Record 6 different animal species.', goal: 6,
    progress: s => uniqueNames(s.records, 'fauna'), perk: 'quiet', reward: 'Quiet steps: wildlife lets you come twice as close.' },
  { id: 'geologist', title: 'Geologist', text: 'Record terrain or outcrops in 4 different regions.', goal: 4,
    progress: s => new Set(s.records.filter(r => r.category === 'terrain').map(r => r.biome)).size, perk: 'beacons', reward: 'Beacon kit: carry 16 more survey beacons.' },
  { id: 'hydrologist', title: 'Hydrologist', text: 'Take 4 water samples at least 300 m apart.', goal: 4,
    progress: s => spreadSamples(s.records), perk: 'swim', reward: 'Dry bag: swim 40% faster.' },
  { id: 'night', title: 'Night watch', text: 'Record 3 observations between 20:00 and 05:00.', goal: 3,
    progress: s => s.records.filter(r => Number.isFinite(r.hour) && isNightHour(r.hour)).length, perk: 'lamp', reward: 'Bright lamp: the flashlight reaches twice as far.' },
  { id: 'summit', title: 'Crown Ridge', text: 'Climb above 1,500 m.', goal: 1500,
    progress: s => s.maxAltitude, perk: 'altimeter', reward: 'Field altimeter: altitude record kept in the journal.', unit: 'm' }
];

export const COMMISSION_IDS = COMMISSIONS.map(c => c.id);

/** Progress of every commission for a survey state: [{commission, value, done}]. */
export function evaluate(survey) {
  return COMMISSIONS.map(c => {
    const value = c.progress(survey);
    return { commission: c, value, done: value >= c.goal };
  });
}
