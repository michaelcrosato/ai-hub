// World and physics coordinates use metres. Keep this scale fixed during a session.
export const VOXEL_SIZE = 0.125;
export const CHUNK_SIZE = 16;
export const FIXED_DT = 1 / 60;
export const MAX_SUBSTEPS = 4;

// These values are starting settings. They are not quality limits or frame-rate targets.
// Resolution and anti-aliasing come from the shared Quality setting (Display & controls, F9).
// shadowSize -1 means Auto: the map follows that Quality tier (1024 on medium, 2048 on high).
const common = Object.freeze({ exposure: 1.08, sunIntensity: 3.2, sunElevation: 53, sunAzimuth: -53,
  ambientIntensity: 0.5, environmentIntensity: 0.65, lampIntensity: 5, lampCount: 12,
  shadowRange: 32, shadowStrength: 1, shadowSoftness: 2, shadowBias: 0.022,
  aoStrength: 1, roughness: 1, metalness: 1, surfaceDetail: 1, emission: 1,
  bloomRadius: 0.3, bloomThreshold: 1.4, fogDensity: 0.006,
  waterRoughness: 0.21, waterRipples: 1, fov: 43, drawDistance: 1000, shadowSize: -1 });
export const PROFILES = Object.freeze({
  mobile: Object.freeze({ name: 'Mobile', graphics: Object.freeze({ ...common, bloomStrength: 0 }) }),
  desktop: Object.freeze({ name: 'Desktop', graphics: Object.freeze({ ...common, bloomStrength: 0.15 }) }),
});
export const LIMITS = Object.freeze({ maxDenseCells: 4_000_000, maxFragmentCells: 768,
  maxFragmentSpan: 16, maxFragmentColliders: 96, debrisSeconds: 40,
  maxBodies: 160, maxEditCells: 20_000, meshBatch: 24 });
/** A profile named in the URL (?profile=desktop), or null. */
export function requestedProfile(search = globalThis.location?.search || '') {
  const query = new URLSearchParams(search);
  const requested = query.get('profile') || query.get('quality');
  return Object.hasOwn(PROFILES, requested) ? requested : null;
}
/** The profile that suits a kit quality tier: phones and low tiers get Mobile. */
export function profileForTier(tierName) {
  return tierName === 'high' || tierName === 'ultra' ? 'desktop' : 'mobile';
}
