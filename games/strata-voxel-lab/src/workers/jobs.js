import { meshVolume, padVolume } from '../voxel/mesher.js';
import { mergeColliders } from '../voxel/colliders.js';
import { findUnsupported, findUnsupportedSparse } from '../voxel/support.js';
import { LIMITS, VOXEL_SIZE } from '../engine/config.js';

export function prepareFragment(fragment) {
  const input = { data: padVolume(fragment.data, fragment.dims), dims: fragment.dims, size: VOXEL_SIZE };
  return { ...fragment, geometry: meshVolume(input), boxes: mergeColliders(input) };
}
export function runJob(type, payload) {
  if (type === 'mesh') return { key: payload.key, version: payload.version,
    geometry: meshVolume(payload), boxes: mergeColliders({ ...payload, preserveMaterials: false }) };
  if (type === 'shatter') return findUnsupported(payload, { maxCells: 64, maxSpan: 4 }).map(prepareFragment);
  if (type === 'support' || type === 'support-sparse') {
    const fragments = type === 'support-sparse' ? findUnsupportedSparse(payload) : findUnsupported(payload), result = [];
    for (const fragment of fragments) {
      const prepared = prepareFragment(fragment);
      if (prepared.boxes.length <= LIMITS.maxFragmentColliders) result.push(prepared);
      else {
        // Repartition irregular pieces rather than replace their holes with a hull.
        for (const small of findUnsupported(fragment, { maxCells: LIMITS.maxFragmentColliders, maxSpan: LIMITS.maxFragmentSpan }))
          result.push(prepareFragment(small));
      }
    }
    return result;
  }
  if (type === 'fragment') return prepareFragment(payload);
  throw new Error(`Unknown worker job: ${type}`);
}
export function transferBuffers(value, result = new Set()) {
  if (ArrayBuffer.isView(value)) result.add(value.buffer);
  else if (value instanceof ArrayBuffer) result.add(value);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) transferBuffers(item, result);
  return [...result];
}
