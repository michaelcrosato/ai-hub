// Browser adapter for @dimforge/rapier3d-deterministic@0.19.3; same version and physics flavor.
import RAPIER from "../rapier3d-deterministic-compat/rapier.mjs";
export * from "../rapier3d-deterministic-compat/rapier.mjs";
await RAPIER.init();
export default RAPIER;
