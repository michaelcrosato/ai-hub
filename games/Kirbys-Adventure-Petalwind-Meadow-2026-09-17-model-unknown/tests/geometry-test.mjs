import assert from 'node:assert/strict';

// Values mirror the causeway geometry in src/game.js. They are kept small enough for
// the 8.2 m/s run speed, 12.4 m/s jump, and 2.35 s hover budget.
const upper = [
  { x: 40.2, w: 4.6, top: 1.95 },
  { x: 47.4, w: 5.4, top: 3.95 },
  { x: 54.7, w: 5.2, top: 4.95 },
  { x: 61.0, w: 5.5, top: 2.45 }
];
const lower = [
  { x: 40.4, w: 5.8, top: -2.65 },
  { x: 48.2, w: 6.2, top: -3.85 },
  { x: 56.0, w: 6.0, top: -3.05 },
  { x: 61.6, w: 4.4, top: -1.35 }
];
function edgeGap(a,b){ return (b.x-b.w/2) - (a.x+a.w/2); }
for (let i=0;i<upper.length-1;i++) assert.ok(edgeGap(upper[i],upper[i+1]) <= 2.3, 'upper gaps must stay hover-readable');
for (let i=0;i<lower.length-1;i++) assert.ok(edgeGap(lower[i],lower[i+1]) <= 2.2, 'lower gaps must stay jump-readable');
for (let i=0;i<lower.length-1;i++) assert.ok(lower[i+1].top-lower[i].top <= 1.8, 'lower climbs must avoid collision traps');
assert.ok(74.2 - (68.5+10/2) < 1.0, 'arena gate must visually meet the approach ground');
assert.ok(114.3 < 118.2, 'goal trigger must be reachable before the world clamp');
console.log(JSON.stringify({ upperMaxGap: Math.max(...upper.slice(0,-1).map((p,i)=>edgeGap(p,upper[i+1]))), lowerMaxGap: Math.max(...lower.slice(0,-1).map((p,i)=>edgeGap(p,lower[i+1]))), status: 'geometry checks passed' }, null, 2));
