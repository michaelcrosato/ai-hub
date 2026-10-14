/* Compatibility entry point. New hosts import runtime/scenes.js and supply a definition. */
import { createScene as createRuntimeScene } from "./runtime/scenes.js";
import { pier17Definition } from "./content/pier17/case.js";
export function createScene(options = {}) {
  return createRuntimeScene({ definition: pier17Definition, ...options });
}
export { buildNavigation } from "./runtime/scenes.js";
