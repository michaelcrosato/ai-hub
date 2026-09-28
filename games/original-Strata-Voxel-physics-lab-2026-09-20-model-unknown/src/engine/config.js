// World and physics coordinates use metres. Keep this scale fixed during a session.
export const VOXEL_SIZE = 0.125;
export const CHUNK_SIZE = 16;
export const FIXED_DT = 1 / 60;
export const MAX_SUBSTEPS = 4;

// These values are starting settings. They are not quality limits or frame-rate targets.
const common = Object.freeze({ exposure: 1.08, sunIntensity: 3.2, sunElevation: 53, sunAzimuth: -53,
  ambientIntensity: 0.5, environmentIntensity: 0.65, lampIntensity: 5, lampCount: 12,
  shadowRange: 32, shadowStrength: 1, shadowSoftness: 2, shadowBias: 0.022,
  aoStrength: 1, roughness: 1, metalness: 1, surfaceDetail: 1, emission: 1,
  bloomRadius: 0.3, bloomThreshold: 1.4, fogDensity: 0.006,
  waterRoughness: 0.21, waterRipples: 1, fov: 43 });
export const PROFILES = Object.freeze({
  mobile: Object.freeze({ name: 'Mobile', graphics: Object.freeze({ ...common, renderScale: 0.65,
    drawDistance: 1000, shadowSize: 1024, bloomStrength: 0 }) }),
  desktop: Object.freeze({ name: 'Desktop', graphics: Object.freeze({ ...common, renderScale: 1,
    drawDistance: 1000, shadowSize: 2048, bloomStrength: 0.15 }) }),
});
export const LIMITS = Object.freeze({ maxDenseCells: 4_000_000, maxFragmentCells: 768,
  maxFragmentSpan: 16, maxFragmentColliders: 96, debrisSeconds: 40,
  maxBodies: 160, maxEditCells: 20_000, meshBatch: 24 });
export function initialProfile(search = globalThis.location?.search || '') {
  const query = new URLSearchParams(search);
  const requested = query.get('profile') || query.get('quality');
  return Object.hasOwn(PROFILES, requested) ? requested : 'mobile';
}
