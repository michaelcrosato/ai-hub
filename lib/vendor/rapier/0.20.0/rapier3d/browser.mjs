// Browser adapter for @dimforge/rapier3d@0.20.0; same version and physics flavor.
import RAPIER from "../rapier3d-compat/dist/rapier.mjs";
export * from "../rapier3d-compat/dist/rapier.mjs";
await RAPIER.init();
export default RAPIER;
