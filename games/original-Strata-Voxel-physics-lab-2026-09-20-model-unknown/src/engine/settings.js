import { PROFILES } from './config.js';

// The same schema drives the controls, validation, and saved settings.
// Render scale moved to the shared Resolution setting (Display & controls, F9).
export const GRAPHICS_CONTROLS = Object.freeze([
  { key: 'drawDistance', group: 'Image', label: 'View distance', min: 16, max: 1000, step: 1, unit: 'm' },
  { key: 'fov', group: 'Image', label: 'Field of view', min: 25, max: 85, step: 1, unit: '°' },
  { key: 'exposure', group: 'Light', label: 'Exposure', min: 0.1, max: 3, step: 0.01 },
  { key: 'sunIntensity', group: 'Light', label: 'Sun strength', min: 0, max: 10, step: 0.1 },
  { key: 'sunElevation', group: 'Light', label: 'Sun height', min: 5, max: 85, step: 1, unit: '°' },
  { key: 'sunAzimuth', group: 'Light', label: 'Sun direction', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'ambientIntensity', group: 'Light', label: 'Ambient light', min: 0, max: 3, step: 0.05 },
  { key: 'environmentIntensity', group: 'Light', label: 'Environment light', min: 0, max: 3, step: 0.05 },
  { key: 'lampIntensity', group: 'Light', label: 'Lamp strength', min: 0, max: 30, step: 0.5 },
  { key: 'lampCount', group: 'Light', label: 'Local lamps', min: 0, max: 32, step: 1 },
  { key: 'shadowSize', group: 'Shadows', label: 'Shadow map', values: [-1, 0, 256, 512, 1024, 2048, 4096, 8192] },
  { key: 'shadowRange', group: 'Shadows', label: 'Shadow coverage', min: 8, max: 384, step: 1, unit: 'm' },
  { key: 'shadowStrength', group: 'Shadows', label: 'Shadow strength', min: 0, max: 1, step: 0.05 },
  { key: 'shadowSoftness', group: 'Shadows', label: 'Shadow softness', min: 0, max: 8, step: 0.1 },
  { key: 'shadowBias', group: 'Shadows', label: 'Shadow surface offset', min: 0, max: 0.1, step: 0.001, unit: 'm' },
  { key: 'aoStrength', group: 'Surface', label: 'Corner occlusion', min: 0, max: 2, step: 0.05 },
  { key: 'roughness', group: 'Surface', label: 'Roughness scale', min: 0.1, max: 2, step: 0.05 },
  { key: 'metalness', group: 'Surface', label: 'Metalness scale', min: 0, max: 2, step: 0.05 },
  { key: 'surfaceDetail', group: 'Surface', label: 'Surface detail', min: 0, max: 2, step: 0.05 },
  { key: 'emission', group: 'Surface', label: 'Voxel glow', min: 0, max: 4, step: 0.05 },
  { key: 'bloomStrength', group: 'Atmosphere', label: 'Bloom strength', min: 0, max: 2, step: 0.05 },
  { key: 'bloomRadius', group: 'Atmosphere', label: 'Bloom spread', min: 0, max: 1, step: 0.05 },
  { key: 'bloomThreshold', group: 'Atmosphere', label: 'Bloom threshold', min: 0, max: 4, step: 0.05 },
  { key: 'fogDensity', group: 'Atmosphere', label: 'Fog density', min: 0, max: 0.05, step: 0.001 },
  { key: 'waterRoughness', group: 'Water', label: 'Water roughness', min: 0.04, max: 1, step: 0.01 },
  { key: 'waterRipples', group: 'Water', label: 'Ripple strength', min: 0, max: 3, step: 0.05 },
]);
export const SETTINGS_KEY = 'strata:settings:v2';
const controlMap = new Map(GRAPHICS_CONTROLS.map(control => [control.key, control]));
export function normaliseSetting(key, value) {
  const control = controlMap.get(key);
  if (!control) throw new RangeError(`Unknown graphics setting: ${key}`);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Invalid value for ${key}`);
  if (control.values) return control.values.reduce((nearest, next) => Math.abs(next - value) < Math.abs(nearest - value) ? next : nearest);
  const clamped = Math.max(control.min, Math.min(control.max, value));
  return Number((control.min + Math.round((clamped - control.min) / control.step) * control.step).toFixed(5));
}
export function profileDefaults(name) {
  if (!Object.hasOwn(PROFILES, name)) throw new RangeError(`Unknown profile: ${name}`);
  return { ...PROFILES[name].graphics };
}
export function sanitiseGraphics(name, source) {
  const values = profileDefaults(name);
  for (const key of Object.keys(values)) {
    if (typeof source?.[key] === 'number' && Number.isFinite(source[key])) values[key] = normaliseSetting(key, source[key]);
  }
  return values;
}
/** profileChosen is true only when the player picked a profile; otherwise the kit's Quality tier picks it. */
export function loadSettings(storage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null'); } catch { saved = null; }
  const chosen = Object.hasOwn(PROFILES, saved?.profile) && saved?.profileChosen === true;
  return { profile: chosen ? saved.profile : null, profileChosen: chosen,
    graphics: Object.fromEntries(Object.keys(PROFILES).map(name => [name, sanitiseGraphics(name, saved?.graphics?.[name])])) };
}
export function saveSettings(storage, settings) {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); return Boolean(storage); } catch { return false; }
}
export function formatSetting(control, value, context = {}) {
  if (control.key === 'shadowSize') {
    if (value < 0) return context.autoShadow ? `Auto · ${context.autoShadow}` : 'Auto';
    return value === 0 ? 'Off' : `${value} × ${value}`;
  }
  if (control.unit === '%') return `${Math.round(value * 100)}%`;
  if (control.key === 'bloomStrength' && value === 0) return 'Off';
  if (control.key === 'fogDensity' && value === 0) return 'Off';
  const decimals = control.step < 0.01 ? 3 : control.step < 0.1 ? 2 : control.step < 1 ? 1 : 0;
  return `${value.toFixed(decimals)}${control.unit === '°' ? '°' : control.unit ? ` ${control.unit}` : ''}`;
}
