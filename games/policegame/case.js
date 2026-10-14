/** Compatibility entry point; all Pier 17 content lives in content/pier17. */
import { createAdventure } from "./runtime/adventure.js";
import definition from "./content/pier17/case.js";
export { definition };
export const CASE_VERSION = definition.version;
export const HOTSPOTS = definition.hotspots;
export const adventure = createAdventure(definition);
export const {
  freshCase, restoreCase, validateCase, actionsFor, act, objective, score,
  evidenceCards, journalEntries, caseSummary,
} = adventure;
