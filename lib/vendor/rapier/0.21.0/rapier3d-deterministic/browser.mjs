// Browser adapter for @dimforge/rapier3d-deterministic@0.21.0; same version and physics flavor.
import RAPIER from "../rapier3d-deterministic-compat/dist/rapier.mjs";
export * from "../rapier3d-deterministic-compat/dist/rapier.mjs";
await RAPIER.init();
export default RAPIER;
