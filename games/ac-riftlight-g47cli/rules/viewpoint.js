// One viewpoint reveals the district's investigation markers. Before that, none of them.

export const INVESTIGATION_MARKERS = Object.freeze(['eavesdrop', 'pickpocket', 'interrogation', 'target']);

export function markersFor(synced, markers = INVESTIGATION_MARKERS) {
  if (!synced) return [];
  return markers.slice();
}

export function syncViewpoint(synced) {
  return synced ? 1 : 0;
}
