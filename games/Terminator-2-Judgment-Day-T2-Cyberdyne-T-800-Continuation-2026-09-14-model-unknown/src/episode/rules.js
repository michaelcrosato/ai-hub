/** Episode-only game values. No DOM, renderer, or physics dependency. */
export const VEHICLES = [
  { id:'patrol-01', position:[-18,0,-19], yaw:12, label:'01' },
  { id:'patrol-02', position:[-7,0,-17], yaw:-14, label:'02' },
  { id:'patrol-03', position:[5,0,-20], yaw:8, label:'03' },
  { id:'patrol-04', position:[17,0,-18], yaw:-18, label:'04' },
  { id:'patrol-05', position:[-23,0,-32], yaw:76, label:'05' },
  { id:'patrol-06', position:[-10,0,-33], yaw:24, label:'06' },
  { id:'patrol-07', position:[8,0,-34], yaw:-30, label:'07' },
  { id:'patrol-08', position:[23,0,-31], yaw:-70, label:'08' },
];
export const MINIGUN = Object.freeze({ capacity:600, reserve:3600, interval:1/30, reloadTime:3.2, damage:9, range:170, automatic:true });
/** Officer pressure. Standard is the original balance; the others scale return fire only. */
export const DIFFICULTY = Object.freeze({
  relaxed:   { label:'RELAXED',    note:'Relaxed: officers hit less often and for less.', accuracy:.7, damage:.6 },
  standard:  { label:'STANDARD',   note:'Standard: the original balance.', accuracy:1, damage:1 },
  relentless:{ label:'RELENTLESS', note:'Relentless: officers aim better and hit harder.', accuracy:1.3, damage:1.45 },
});
export const DIFFICULTY_ORDER = ['relaxed', 'standard', 'relentless'];
export const clamp01 = x => Math.max(0,Math.min(1,x));
export function advanceBarrels(state, held, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid time step.');
  state.spin = clamp01(state.spin + (held && !state.overheated ? 1.9 : -1.15) * dt);
  state.heat = clamp01(state.heat + (state.firing ? .092 : -.17) * dt);
  if (state.heat >= 1) state.overheated = true;
  if (state.overheated && state.heat < .3) state.overheated = false;
  return state.spin >= .8 && !state.overheated;
}
export function cleanSaved(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const count = (v,max) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v,max) : 0;
  const seconds = v => typeof v==='number' && Number.isFinite(v) ? Math.max(0,Math.min(v,86400)) : 0;
  return { elapsed: seconds(raw.elapsed),
    rounds:count(raw.rounds,1000000), hits:count(raw.hits,1000000), violations:count(raw.violations,1000000),
    reboots:count(raw.reboots,1000000), searchlights:count(raw.searchlights,1000000),
    openingTime: typeof raw.openingTime==='number' && Number.isFinite(raw.openingTime) && raw.openingTime>0 ? Math.min(raw.openingTime,86400) : null };
}
export const formatTime = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
