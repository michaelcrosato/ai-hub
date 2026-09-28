import { BALANCE, ANCHORS, ENEMY_SPECS, PICKUP_SPECS } from '../src/data.js';
const errors=[];
if(ANCHORS.length<10)errors.push('Not enough grapple anchors for route coverage.');
for(let i=1;i<ANCHORS.length;i++){
  const d=Math.hypot(ANCHORS[i].x-ANCHORS[i-1].x,ANCHORS[i].y-ANCHORS[i-1].y);
  const max=BALANCE.grappleBaseRange+BALANCE.grappleRankBonus+BALANCE.gripGearBonus;
  if(d>max+0.4)errors.push(`Anchor chain gap ${i-1}->${i} is ${d.toFixed(2)}m, over upgraded range ${max.toFixed(2)}m.`);
}
const mandatoryXP=ENEMY_SPECS.slice(0,6).reduce((a,e)=>a+e.xp,0);
if(mandatoryXP<BALANCE.rank3XP)errors.push(`Expected-route XP ${mandatoryXP} is below Rank 3 threshold ${BALANCE.rank3XP}.`);
for(const id of ['grip','reel','pulse'])if(!PICKUP_SPECS.some(p=>p.id===id))errors.push(`Missing gear: ${id}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);} 
console.log(`Smoke OK: ${ANCHORS.length} anchors, ${ENEMY_SPECS.length} enemies, expected-route XP ${mandatoryXP}, Rank 3 at ${BALANCE.rank3XP}.`);
