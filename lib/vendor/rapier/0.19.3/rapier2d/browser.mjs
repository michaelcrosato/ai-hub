// Browser adapter for @dimforge/rapier2d@0.19.3; same version and physics flavor.
import RAPIER from "../rapier2d-compat/rapier.mjs";
export * from "../rapier2d-compat/rapier.mjs";
await RAPIER.init();
export default RAPIER;
