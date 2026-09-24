function simulate(route) {
  let level=1,xp=0,next=40,damage=1,maxHealth=100,scrap=0;
  for (const e of route) {
    xp += e.xp; scrap += e.scrap;
    while (xp >= next && level < 4) {
      xp -= next; level++; next=Math.round(next*1.55); damage*=1.1; maxHealth+=15;
    }
  }
  return {level,xp,next,damage,maxHealth,scrap};
}
const mandatory = Array.from({length:6},()=>({xp:12,scrap:2}));
const exterior = [{xp:10,scrap:2},{xp:10,scrap:3},{xp:10,scrap:2},{xp:10,scrap:2},{xp:10,scrap:3}];
const full = simulate([...exterior,...mandatory]);
const minimum = simulate(mandatory);
const upgradeCost=12,bossHP=360,armored=.46;
function shots(dmgMul, upgraded) { return Math.ceil(bossHP/(18*dmgMul*(upgraded?1.24:1)*armored)); }
const report={
  mandatoryRoute:{...minimum,canBuyUpgrade:minimum.scrap>=upgradeCost,armoredOnlyBossShotsWithUpgrade:shots(minimum.damage,true),armoredOnlyBossShotsStock:shots(minimum.damage,false)},
  combatHeavyRoute:{...full,canBuyUpgrade:full.scrap>=upgradeCost,armoredOnlyBossShotsWithUpgrade:shots(full.damage,true)}
};
console.log(JSON.stringify(report,null,2));
if(minimum.level<2) throw new Error('Mandatory route should reach level 2.');
if(minimum.scrap<upgradeCost) throw new Error('Mandatory bunker clear should afford one upgrade.');
if(full.level<3) throw new Error('Engaging the normal exterior fights plus bunker should reach level 3.');
if(report.mandatoryRoute.armoredOnlyBossShotsStock>45) throw new Error('Stock, no-grind boss time-to-kill is too high.');
