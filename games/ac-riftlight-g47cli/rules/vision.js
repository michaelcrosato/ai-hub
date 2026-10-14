// Eagle vision names four classes, and only once synchronization is high enough.

export const SYNC_THRESHOLD = 1;

export const VISION_CLASSES = Object.freeze(['foe', 'ally', 'civilian', 'target']);

const BY_ROLE = {
  guard: 'foe',
  ally: 'ally',
  civilian: 'civilian',
  target: 'target',
};

/** @returns {'foe' | 'ally' | 'civilian' | 'target' | null} */
export function classifyRole(role, sync) {
  if (!(sync >= SYNC_THRESHOLD)) return null;
  return BY_ROLE[role] ?? null;
}

/** The four district classes, or four nulls below the threshold. */
export function classifyDistrict(sync) {
  return ['guard', 'ally', 'civilian', 'target'].map((role) => classifyRole(role, sync));
}
