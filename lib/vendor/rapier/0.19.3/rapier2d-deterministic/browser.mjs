// Browser adapter for @dimforge/rapier2d-deterministic@0.19.3; same version and physics flavor.
import RAPIER from "../rapier2d-deterministic-compat/rapier.mjs";
export * from "../rapier2d-deterministic-compat/rapier.mjs";
await RAPIER.init();
export default RAPIER;
