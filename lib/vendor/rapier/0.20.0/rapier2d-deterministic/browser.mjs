// Browser adapter for @dimforge/rapier2d-deterministic@0.20.0; same version and physics flavor.
import RAPIER from "../rapier2d-deterministic-compat/dist/rapier.mjs";
export * from "../rapier2d-deterministic-compat/dist/rapier.mjs";
await RAPIER.init();
export default RAPIER;
