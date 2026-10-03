// Browser adapter for @dimforge/rapier3d-simd@0.19.3; same version and physics flavor.
import RAPIER from "../rapier3d-simd-compat/rapier.mjs";
export * from "../rapier3d-simd-compat/rapier.mjs";
await RAPIER.init();
export default RAPIER;
