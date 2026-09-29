/* Crown & Clay — original game systems. No network or external assets.
   Pure rules: map, cities, units, research, diplomacy, rival realms, raiders,
   story events (tidings) and victory. Nothing here touches the DOM or the GPU. */
'use strict';
export const W=20,H=17,MAX_TURNS=60;
export const TECHS={
 agriculture:{name:'Agriculture',cost:20,req:[],icon:'wheat',desc:'Cultivate the land. Workers can build farms for +2 food.',era:0},
 mining:{name:'Mining',cost:24,req:[],icon:'pick',desc:'Work the hills. Workers can build mines for +2 production.',era:0},
 mysticism:{name:'Mysticism',cost:26,req:[],icon:'sun',desc:'Give your people a shared story. Unlocks temples.',era:0},
 pottery:{name:'Pottery',cost:32,req:['agriculture'],icon:'jar',desc:'Store the harvest. Unlocks granaries, markets, and the Moonwell Gardens.',era:1},
 bronze:{name:'Bronze Working',cost:42,req:['mining'],icon:'sword',desc:'Forge stronger arms. Unlocks spearmen and barracks.',era:1},
 masonry:{name:'Masonry',cost:38,req:['mining'],icon:'wall',desc:'Build to last. Unlocks walls and better stone mines.',era:1},
 writing:{name:'Writing',cost:42,req:['pottery'],icon:'book',desc:'Keep knowledge alive. Unlocks libraries, trade pacts, and the Clay Archive.',era:1},
 philosophy:{name:'Philosophy',cost:68,req:['writing','mysticism'],icon:'star',desc:'Ask better questions. Unlocks the Council civic and one path to the Sunspire.',era:2},
 engineering:{name:'Engineering',cost:78,req:['bronze','masonry'],icon:'gear',desc:'Build great works. Unlocks workshops, catapults, and one path to the Sunspire.',era:2}
};
export const UNITS={
 settler:{name:'Settler',cost:38,moves:2,str:0,icon:'flag',desc:'Found a new city at least 3 tiles from every other city.'},
 worker:{name:'Worker',cost:18,moves:2,str:0,icon:'pick',desc:'Build farms, mines, and roads. Each job takes 2 turns.'},
 scout:{name:'Scout',cost:16,moves:3,str:2,icon:'compass',desc:'Explore faster. Ignores extra forest and hill movement costs.'},
 warrior:{name:'Warrior',cost:20,moves:2,str:4,icon:'shield',desc:'Protect your people. Stronger when fortified or on high ground.'},
 spearman:{name:'Spearman',cost:32,moves:2,str:7,req:'bronze',icon:'sword',desc:'A strong front-line unit. Requires Bronze Working.'},
 catapult:{name:'Catapult',cost:50,moves:2,str:8,range:2,req:'engineering',icon:'target',desc:'Bombard from 2 tiles away with no return damage. Half damage to troops. Cannot capture cities.'},
 raider:{name:'Raider',cost:0,moves:2,str:3.6,icon:'sword',desc:'A hostile war band.'}
};
export const BUILDS={
 worker:UNITS.worker,scout:UNITS.scout,warrior:UNITS.warrior,settler:UNITS.settler,
 monument:{name:'Monument',cost:20,icon:'obelisk',desc:'+2 culture each turn. Expands your borders sooner.'},
 granary:{name:'Granary',cost:28,req:'pottery',icon:'wheat',desc:'+1 food. Keeps half the food used when the city grows.'},
 spearman:UNITS.spearman,
 library:{name:'Library',cost:36,req:'writing',icon:'book',desc:'+4 science each turn.'},
 temple:{name:'Temple',cost:32,req:'mysticism',icon:'sun',desc:'+3 culture each turn. Raises the growth limit by 2.'},
 market:{name:'Market',cost:36,req:'pottery',icon:'coin',desc:'+4 gold each turn.'},
 barracks:{name:'Barracks',cost:28,req:'bronze',icon:'shield',desc:'New military units gain +1 strength.'},
 walls:{name:'City Walls',cost:30,req:'masonry',icon:'wall',desc:'+50 city health and +2 city strength.'},
 workshop:{name:'Workshop',cost:44,req:'engineering',icon:'gear',desc:'+4 production each turn.'},
 catapult:UNITS.catapult,
 gardens:{name:'Moonwell Gardens',cost:72,req:'pottery',icon:'leaf',wonder:true,desc:'A lesser wonder. +3 food and +2 culture, and the growth limit rises by 2. Only one realm can build it.'},
 archive:{name:'The Clay Archive',cost:84,req:'writing',icon:'book',wonder:true,desc:'A lesser wonder. +6 science and +2 culture each turn. Only one realm can build it.'},
 sunspire:{name:'The Sunspire',cost:140,req:'engineering',req2:'philosophy',icon:'sunspire',wonder:true,desc:'Win a Wonder victory. Requires Engineering, Philosophy, and 2 cities.'},
 wealth:{name:'Trade Goods',cost:0,icon:'coin',desc:'Convert each turn’s production into gold.'}
};
export const TERRAIN={grass:{name:'Grassland',food:3,prod:0,gold:0},plains:{name:'Plains',food:2,prod:1,gold:0},forest:{name:'Forest',food:2,prod:2,gold:0},hill:{name:'Hills',food:1,prod:2,gold:0},sand:{name:'Drylands',food:1,prod:1,gold:1},mountain:{name:'Mountains',food:0,prod:0,gold:0},water:{name:'Coast',food:2,prod:0,gold:1}};
export const FACTIONS=[{name:'The Dawnfolk',short:'Dawnfolk',leader:'You',color:'#347b6c',capital:'Hearthhaven'}, {name:'Ember Court',short:'Ember',leader:'Lady Saffron',color:'#be5f4c',capital:'Cinderhold'}, {name:'Tide League',short:'Tide',leader:'Master Marlow',color:'#777cba',capital:'Pearlwatch'}];
export const CITY_NAMES=['Hearthhaven','Mossgate','Sunmeadow','Oakrest','Amberfield','Willowbend','Littleford','Brightbank'];
/* Standard is the First Dawn exactly as it was first written; the other two scale the pressure. */
export const DIFFICULTY={
 gentle:{name:'Gentle',gold:60,raiderTurn:12,raiderEvery:14,raiderPower:.85,aiProd:.85,aiScience:.9,warTurn:30,warFavor:20,warArmy:3,foundEvery:18,desc:'Raiders wake later, rivals build slower, and the treasury starts fuller.'},
 standard:{name:'Standard',gold:40,raiderTurn:8,raiderEvery:10,raiderPower:1,aiProd:1,aiScience:1,warTurn:24,warFavor:30,warArmy:3,foundEvery:15,desc:'The First Dawn as it was written.'},
 hard:{name:'Hard',gold:30,raiderTurn:6,raiderEvery:8,raiderPower:1.15,aiProd:1.2,aiScience:1.15,warTurn:18,warFavor:40,warArmy:4,foundEvery:12,desc:'Bolder raiders, a sharper Ember Court, and rivals who build and learn faster.'}
};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dist=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));
export function hash(x,z,seed=1){let n=Math.imul(x+37,374761393)^Math.imul(z+73,668265263)^Math.imul(seed,1442695041); n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
export const RIVER=[[9.6,1.2],[9.2,2.8],[8.6,4.0],[8.7,5.8],[7.7,7.1],[6.8,8.5],[6.5,10.2],[5.6,11.6],[5.4,12.9],[4.3,14.0],[4.0,15.7]];
function segDist(x,z,a,b){let dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function map(seed){const tiles=[];for(let z=0;z<H;z++)for(let x=0;x<W;x++){
 let n=hash(x,z,seed),edge=Math.pow((x-10)/9.0,2)+Math.pow((z-8)/7.9,2),land=edge<.99+n*.16;
 if(x<3&&z<9)land=false;if(x<4&&z>13)land=false;if(z>14&&x<7)land=false;
 let type=!land?'water':n<.26?'forest':n<.40?'hill':n<.47?'plains':'grass';
 if(land&&x>13&&z<7&&n>.6)type='sand';
 if(land&&((z===3&&x>=10&&x<=13)||(z===4&&x===11)||(z===2&&x===12)||(z===7&&x===17)))type='mountain';
 let river=land&&RIVER.some((a,i)=>i<RIVER.length-1&&segDist(x,z,a,RIVER[i+1])<.67);
 if(river&&type!=='mountain')type='grass';
 let resource=land&&type!=='mountain'?(n>.84?'wheat':n<.075?'stone':type==='hill'&&n>.3?'gold':null):null;
 if(resource==='wheat'&&type==='forest')type='grass';
 tiles.push({x,z,type,resource,river,owner:-1,explored:false,visible:false,improvement:null,road:false,ruin:false,camp:false});
 }
 const t=(x,z)=>tiles[z*W+x];
 [[5,10,'grass'],[6,10,'plains'],[5,11,'grass'],[4,10,'grass'],[5,9,'plains'],[4,9,'forest'],[4,11,'forest'],[6,11,'grass'],[6,9,'hill'],[7,10,'grass'],[5,6,'grass'],[7,13,'grass'],[13,5,'plains'],[16,11,'grass'],[10,13,'plains'],[14,2,'plains']].forEach(([x,z,type])=>t(x,z).type=type);
 [[4,6],[5,5],[6,5]].forEach(([x,z])=>{t(x,z).type='mountain';t(x,z).resource=null;});
 t(5,9).resource='wheat';t(6,9).resource='gold';t(4,10).resource=null;t(5,10).resource=null;t(5,11).resource=null;t(4,11).resource=null;t(6,11).resource='wheat';t(13,6).resource='wheat';t(15,11).resource='wheat';
 [[8,8],[3,7],[11,11],[15,8],[7,3]].forEach(([x,z])=>{let a=t(x,z);a.ruin=true;a.type='plains';a.resource=null;});
 [[10,13],[14,2]].forEach(([x,z])=>{t(x,z).camp=true;t(x,z).resource=null;});
 return tiles;
}

/* ---------------------------------------------------------------- tidings
   Story events: every few turns a small matter reaches the Dawnfolk and the
   player chooses how to answer. The last choice is always free and is taken
   automatically if the turn ends first. Everything they do goes through the
   same resources as the rest of the game (gold, culture, science, food,
   production, goodwill, units). */
const riverCity=g=>g.cities(0).find(c=>g.tiles.some(t=>t.river&&dist(c,t)<=1))||null;
const largestCity=g=>g.cities(0).reduce((a,b)=>b.pop>a.pop?b:a,g.cities(0)[0]||null);
const peaceWith=(g,o)=>{const r=g.s.relations[o];return r.met&&r.status==='peace'&&g.cities(o).length>0;};
const TIDINGS=[
 {id:'potters',icon:'jar',title:'The Wandering Potters',kicker:'A knock at the gate',when:g=>g.s.turn>=5,
  text:g=>`A family of potters has walked three valleys to reach ${g.capitalCity().name}. They ask for a hearth, a well, and a patch of good clay.`,
  choices:[
   {label:'Give them a hearth',detail:g=>`+1 population in ${g.capitalCity().name}`,can:g=>{const c=g.capitalCity();return c.pop<g.yields(c).limit?'':'The city has reached its growth limit.';},apply:g=>{const c=g.capitalCity();c.pop++;return `The potters settle in ${c.name}. It grows to ${c.pop} people.`;}},
   {label:'Buy their finest wares',detail:()=>'+25 gold',apply:g=>{g.s.gold+=25;return 'The potters sell their wares and travel on. +25 gold.';}}]},
 {id:'comet',icon:'star',title:'A Comet Over the Hills',kicker:'A sign in the sky',when:g=>g.s.turn>=8,
  text:()=>'For three nights a pale comet has crossed the sky above the hills. The elders argue about what it means. The children only want to watch.',
  choices:[
   {label:'Hold a festival',detail:()=>'−10 gold · +14 culture',can:g=>g.s.gold>=10?'':'You need 10 gold.',apply:g=>{g.s.gold-=10;g.s.culture+=14;return 'Lanterns burn until dawn. +14 culture.';}},
   {label:'Chart its path',detail:()=>'+20 science',apply:g=>`Your star-watchers fill a tablet with careful marks. ${g.addScience(20)}`},
   {label:'Let it pass',detail:()=>'The sky keeps its secrets.',apply:()=>'The comet fades. Life goes on.'}]},
 {id:'flood',icon:'wheat',title:'The River Rises',kicker:'Spring floods',when:g=>g.s.turn>=11&&!!riverCity(g),
  text:g=>`Snowmelt has swollen the river beside ${riverCity(g).name}. The water is brown and fast, and the lowest fields are already under it.`,
  choices:[
   {label:'Raise levees',detail:g=>`−20 gold · +20 production in ${riverCity(g).name}`,can:g=>{const c=riverCity(g);return g.s.gold<20?'You need 20 gold.':c.build==='wealth'||g.canBuild(c,c.build)?`Choose a project in ${c.name} first.`:'';},apply:g=>{const c=riverCity(g);g.s.gold-=20;c.stock[c.build]=(c.stock[c.build]||0)+20;return `The levees hold, and the crews stay on to help. +20 production in ${c.name}.`;}},
   {label:'Let the silt settle',detail:()=>'A river field becomes a farm',apply:g=>{const c=riverCity(g),t=g.tiles.find(t=>t.river&&t.owner===0&&dist(c,t)<=2&&!t.improvement&&['grass','plains','sand'].includes(t.type)&&!g.cityAt(t.x,t.z));if(t){t.improvement='farm';return 'The flood leaves rich black silt behind. A river field becomes a farm.';}g.s.gold+=15;return 'The flood passes quickly. Traders buy the drowned timber. +15 gold.';}}]},
 {id:'envoy',icon:'council',title:'The Ember Envoy',kicker:'A guest from Cinderhold',when:g=>g.s.turn>=13&&peaceWith(g,1),
  text:()=>'An envoy of Lady Saffron arrives with a gilded box and a sharp smile. “Friends share their fortune,” he says, and waits.',
  choices:[
   {label:'Pay 25 gold in tribute',detail:()=>'+20 goodwill with the Ember Court',can:g=>g.s.gold<25?'You need 25 gold.':g.s.relations[1].status!=='peace'?'You are at war.':'',apply:g=>{g.s.gold-=25;g.addFavor(1,20);return 'The envoy bows low. The Ember Court remembers its friends. +20 goodwill.';}},
   {label:'Host a feast',detail:()=>'−10 gold · +8 goodwill · +8 culture',can:g=>g.s.gold<10?'You need 10 gold.':g.s.relations[1].status!=='peace'?'You are at war.':'',apply:g=>{g.s.gold-=10;g.addFavor(1,8);g.s.culture+=8;return 'The feast is talked about in both realms. +8 goodwill and +8 culture.';}},
   {label:'Send him home politely',detail:()=>'−10 goodwill with the Ember Court',apply:g=>{g.addFavor(1,-10);return 'The envoy leaves with an empty box and a thin smile. −10 goodwill.';}}]},
 {id:'charts',icon:'map',title:'Tide League Cartographers',kicker:'Ink and salt',when:g=>g.s.turn>=15&&peaceWith(g,2),
  text:()=>'Two map-makers of the Tide League have set up a stall at your market. Their charts show coasts your scouts have never seen.',
  choices:[
   {label:'Buy their charts',detail:()=>'−20 gold · reveal their lands · +10 goodwill',can:g=>g.s.gold<20?'You need 20 gold.':g.s.relations[2].status!=='peace'?'You are at war.':'',apply:g=>{g.s.gold-=20;g.addFavor(2,10);for(const c of g.cities(2))for(const t of g.tiles)if(dist(c,t)<=4)t.explored=true;return 'The charts are rolled out in the square. New lands appear on your map.';}},
   {label:'Sell them grain',detail:g=>`+30 gold · −10 food in ${g.capitalCity().name}`,apply:g=>{const c=g.capitalCity();c.food=Math.max(0,c.food-10);g.s.gold+=30;return `Grain wagons roll toward the coast. +30 gold, and ${c.name}'s stores run thinner.`;}},
   {label:'Wish them fair winds',detail:()=>'+5 goodwill with the Tide League',apply:g=>{g.addFavor(2,5);return 'The cartographers sail on with kind words for the Dawnfolk. +5 goodwill.';}}]},
 {id:'ford',icon:'sword',title:'Raiders at the Ford',kicker:'Smoke on the road',when:g=>g.s.turn>=g.diff.raiderTurn+4&&(g.units(3).length>0||g.tiles.some(t=>t.camp)),
  text:()=>'Herders bring word of a war band camped near the river ford. The villages on the road want to know what their ruler will do.',
  choices:[
   {label:'Muster the militia',detail:g=>`−20 gold · a Warrior joins ${g.capitalCity().name}`,can:g=>g.s.gold>=20?'':'You need 20 gold.',apply:g=>{const c=g.capitalCity();g.s.gold-=20;const u=g.addUnit(0,'warrior',c.x,c.z);if(c.buildings.includes('barracks'))u.bonus=1;return `Farmers take up spears. A Warrior stands ready in ${c.name}.`;}},
   {label:'Pay them to leave',detail:()=>'−30 gold · the nearest war band disbands',can:g=>g.s.gold<30?'You need 30 gold.':g.units(3).length?'':'No war band is in the field.',apply:g=>{g.s.gold-=30;const cs=g.cities(0);let best=null,bd=1e9;for(const u of g.units(3)){const d=Math.min(...cs.map(c=>dist(c,u)));if(d<bd){bd=d;best=u;}}if(best)g.s.units=g.s.units.filter(v=>v.id!==best.id);return 'The raiders take the silver and scatter into the hills.';}},
   {label:'Ring the bells',detail:()=>'+8 culture',apply:g=>{g.s.culture+=8;return 'The bells ring from village to village. The Dawnfolk stand together. +8 culture.';}}]},
 {id:'tablet',icon:'book',title:'The Buried Tablet',kicker:'A find in the clay',when:g=>g.s.turn>=18,
  text:g=>`Diggers widening a well in ${g.capitalCity().name} strike a tablet of fired clay, covered in marks older than any story.`,
  choices:[
   {label:'Study the marks',detail:()=>'+30 science',apply:g=>`Scholars work by lamplight for a month. ${g.addScience(30)}`},
   {label:'Raise it in the square',detail:g=>g.capitalCity().buildings.includes('monument')?'+15 culture':`${g.capitalCity().name} gains a Monument`,apply:g=>{const c=g.capitalCity();if(!c.buildings.includes('monument')){c.buildings.push('monument');return `The tablet becomes the heart of a new Monument in ${c.name}.`;}g.s.culture+=15;return 'The tablet stands beside the old Monument. +15 culture.';}}]},
 {id:'harvest',icon:'wheat',title:'A Bountiful Year',kicker:'Golden fields',when:g=>g.s.turn>=20&&g.cities(0).length>=2,
  text:()=>'The rains came when they should and stopped when they should. Every granary is full, and the carts are still coming in.',
  choices:[
   {label:'Share the harvest',detail:()=>'+10 food in every city',apply:g=>{for(const c of g.cities(0))c.food+=10;return 'Every city holds a harvest table. +10 food in each city.';}},
   {label:'Fill the storehouses',detail:()=>'+35 gold',apply:g=>{g.s.gold+=35;return 'The surplus is sold along the river. +35 gold.';}}]},
 {id:'builder',icon:'hammer',title:'The Master Builder',kicker:'Skilled hands',when:g=>g.s.turn>=24,
  text:()=>'Oriel the stonewright has raised halls in three realms. She offers her crews to the Dawnfolk, for a price.',
  choices:[
   {label:'Hire her crews',detail:g=>`−40 gold · +40 production in ${g.capitalCity().name}`,can:g=>{const c=g.capitalCity();return g.s.gold<40?'You need 40 gold.':c.build==='wealth'||g.canBuild(c,c.build)?`Choose a project in ${c.name} first.`:'';},apply:g=>{const c=g.capitalCity();g.s.gold-=40;c.stock[c.build]=(c.stock[c.build]||0)+40;return `Oriel's crews start work at once. +40 production in ${c.name}.`;}},
   {label:'Take an apprentice',detail:g=>`A Worker joins ${g.capitalCity().name}`,apply:g=>{const c=g.capitalCity();g.addUnit(0,'worker',c.x,c.z);return `One of Oriel's apprentices stays behind. A Worker joins ${c.name}.`;}}]},
 {id:'sickness',icon:'heart',title:'Fever in the Lowlands',kicker:'A hard season',when:g=>g.s.turn>=26&&g.cities(0).some(c=>c.pop>=4),
  text:g=>`A fever has come to the crowded lanes of ${largestCity(g).name}. The healers say it will pass, but not quickly.`,
  choices:[
   {label:'Send the healers',detail:()=>'−30 gold · the fever passes',can:g=>g.s.gold>=30?'':'You need 30 gold.',apply:g=>{g.s.gold-=30;return 'Healers boil water and burn herbs. The fever passes without a death.';}},
   {label:'Close the gates',detail:g=>`${largestCity(g).name} loses 1 population`,apply:g=>{const c=largestCity(g);if(c.pop>1)c.pop--;return `${c.name} waits out the fever behind closed gates. It falls to ${c.pop} people.`;}}]},
 {id:'song',icon:'culture',title:'Song of the Dawnfolk',kicker:'Poets and players',when:g=>g.s.turn>=30&&g.s.culture>=30,
  text:()=>'A new song is being sung in every market: the story of the first settlers and the river that led them home.',
  choices:[
   {label:'Hold a great festival',detail:()=>'−25 gold · +30 culture',can:g=>g.s.gold>=25?'':'You need 25 gold.',apply:g=>{g.s.gold-=25;g.s.culture+=30;return 'The festival lasts a week. +30 culture.';}},
   {label:'Send the singers abroad',detail:()=>'+15 goodwill with every realm at peace',can:g=>[1,2].some(o=>peaceWith(g,o))?'':'No realm at peace to visit.',apply:g=>{for(const o of [1,2])if(peaceWith(g,o))g.addFavor(o,15);return 'The singers are welcomed in foreign halls. +15 goodwill with every realm at peace.';}},
   {label:'Keep the song at home',detail:()=>'+10 culture',apply:g=>{g.s.culture+=10;return 'The song stays a Dawnfolk song. +10 culture.';}}]},
 {id:'sage',icon:'flask',title:'The Last Sage',kicker:'A long life',when:g=>g.s.turn>=44,
  text:()=>'The oldest scholar of the realm asks for one last favour: a place where her pupils can keep learning after she is gone.',
  choices:[
   {label:'Found an academy',detail:()=>'−45 gold · +60 science',can:g=>g.s.gold>=45?'':'You need 45 gold.',apply:g=>{g.s.gold-=45;return `The academy opens its doors. ${g.addScience(60)}`;}},
   {label:'Write her chronicle',detail:()=>'+35 culture',apply:g=>{g.s.culture+=35;return 'Her words are copied onto a hundred tablets. +35 culture.';}}]}
];
export const TIDING_IDS=new Set(TIDINGS.map(t=>t.id));

export class Game{
 constructor(saved=null,seed=417,difficulty='standard'){seed=clamp(Math.trunc(Number(seed))||417,1,999999);this.listeners=[];this.processing=false;this.events=[];
 if(saved){this.validate(saved);this.s=JSON.parse(JSON.stringify(saved));this.migrate();this.refreshVisibility();this.events=[];return;}
 if(!Object.hasOwn(DIFFICULTY,difficulty))difficulty='standard';
 this.s={version:1,seed,difficulty,turn:1,gold:DIFFICULTY[difficulty].gold,culture:0,research:'agriculture',researchBank:{},techs:[],civic:'tradition',tiles:map(seed),units:[],cities:[],nextId:1,everFounded:false,ended:null,keepPlaying:false,ruins:0,log:[],relations:[null,{met:false,status:'peace',favor:10,trade:false,warTurn:0},{met:false,status:'peace',favor:20,trade:false,warTurn:0}],ai:[null,{gold:35,culture:0,techs:['agriculture'],research:'mining',researchBank:{},civic:'tradition'},{gold:35,culture:0,techs:['agriculture'],research:'pottery',researchBank:{},civic:'tradition'}],tutorial:0,tidings:{next:6,seen:[]},pending:null};
 this.addUnit(0,'settler',5,10);this.addUnit(0,'scout',6,10);this.addUnit(0,'warrior',5,11);
 this.addCity(1,13,5,FACTIONS[1].capital,true);this.addCity(2,16,11,FACTIONS[2].capital,true);
 this.addUnit(1,'warrior',13,5);this.addUnit(2,'warrior',16,11);
 this.addUnit(3,'raider',10,13);this.addUnit(3,'raider',14,2);
 this.claimBorders();this.refreshVisibility();this.events=[];
 }
 /** Saves from version 1.0 have no difficulty or tidings yet. */
 migrate(){const s=this.s;if(!Object.hasOwn(DIFFICULTY,s.difficulty||''))s.difficulty='standard';if(!s.tidings)s.tidings={next:Math.max(6,s.turn+2),seen:[]};if(s.pending===undefined)s.pending=null;}
 get diff(){return DIFFICULTY[this.s.difficulty]||DIFFICULTY.standard;}
 validate(s){if(!s||s.version!==1||!Array.isArray(s.tiles)||s.tiles.length!==W*H||!Array.isArray(s.units)||!Array.isArray(s.cities)||!Number.isInteger(s.turn)||s.turn<1||s.turn>10000||!Array.isArray(s.techs)||!s.relations||!s.ai||!s.researchBank||!Number.isFinite(s.gold))throw Error('This is not a valid Crown & Clay save.');
 if(s.units.length>500||s.cities.length>100)throw Error('This save is too large.');
 const ids=new Set();for(const o of [...s.units,...s.cities]){if(!Number.isInteger(o.x)||!Number.isInteger(o.z)||o.x<0||o.x>=W||o.z<0||o.z>=H||!Number.isInteger(o.id)||ids.has(o.id)||!Number.isInteger(o.owner)||o.owner<0||o.owner>3)throw Error('The save contains an invalid piece.');ids.add(o.id);}
 for(const u of s.units)if(!UNITS[u.type]||!Number.isFinite(u.hp)||!Number.isFinite(u.moves))throw Error('The save contains an invalid unit.');
 for(const c of s.cities)if(!Array.isArray(c.buildings)||!BUILDS[c.build]||!c.stock||!Number.isFinite(c.pop)||c.pop<1||c.pop>20)throw Error('The save contains an invalid city.');
 for(let i=0;i<s.tiles.length;i++){const t=s.tiles[i];if(t.x!==i%W||t.z!==Math.floor(i/W)||!TERRAIN[t.type])throw Error('The save contains an invalid map.');}
 if(s.techs.some(t=>!TECHS[t])||(s.research&&!TECHS[s.research])||!Number.isFinite(s.nextId))throw Error('The save contains invalid research.');
 const finite=(v,min=0)=>Number.isFinite(v)&&v>=min,known=(dict,k)=>typeof k==='string'&&Object.hasOwn(dict,k),isRecord=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const factionOK=f=>f&&Array.isArray(f.techs)&&f.techs.length<=Object.keys(TECHS).length&&new Set(f.techs).size===f.techs.length&&f.techs.every(k=>known(TECHS,k))&&(f.research===null||known(TECHS,f.research))&&isRecord(f.researchBank)&&Object.entries(f.researchBank).every(([k,v])=>known(TECHS,k)&&finite(v))&&finite(f.gold)&&finite(f.culture)&&['tradition','industry','council'].includes(f.civic);
 if(!factionOK(s)||!factionOK(s.ai[1])||!factionOK(s.ai[2])||!Number.isInteger(s.nextId)||s.nextId<=Math.max(0,...ids)||!Number.isInteger(s.seed)||!finite(s.ruins)||typeof s.everFounded!=='boolean'||typeof s.keepPlaying!=='boolean'||!Array.isArray(s.log)||s.log.length>100||s.log.some(l=>!l||typeof l.text!=='string'||l.text.length>2000||!Number.isInteger(l.turn)))throw Error('The save contains invalid realm data.');
 for(const r of s.relations.slice(1,3))if(!r||typeof r.met!=='boolean'||typeof r.trade!=='boolean'||!['peace','war'].includes(r.status)||!finite(r.favor,-50)||r.favor>100||!finite(r.warTurn))throw Error('The save contains invalid treaties.');
 if(s.relations.length!==3)throw Error('The save contains invalid treaties.');
 for(const u of s.units)if(!known(UNITS,u.type)||u.hp<=0||u.hp>100||u.moves<0||u.moves>UNITS[u.type].moves||!finite(u.bonus)||typeof u.fortified!=='boolean'||typeof u.moved!=='boolean'||(u.job&&(u.type!=='worker'||!['farm','mine','road'].includes(u.job.kind)||![1,2].includes(u.job.left))))throw Error('The save contains invalid unit orders.');
 for(const c of s.cities)if(typeof c.name!=='string'||c.name.length>80||!Number.isInteger(c.pop)||!finite(c.food)||!finite(c.localCulture)||!finite(c.hp)||!finite(c.maxHp,1)||c.hp>c.maxHp||!['balanced','food','production','gold'].includes(c.focus)||!known(BUILDS,c.build)||!isRecord(c.stock)||Object.entries(c.stock).some(([k,v])=>!known(BUILDS,k)||!finite(v))||c.buildings.some(k=>!known(BUILDS,k)||known(UNITS,k)||k==='wealth')||new Set(c.buildings).size!==c.buildings.length||![null,0,1,2].includes(c.capital)||!Number.isInteger(c.founded))throw Error('The save contains invalid city data.');
 for(const t of s.tiles)if(!Number.isInteger(t.owner)||t.owner< -1||t.owner>3||![null,'farm','mine'].includes(t.improvement)||![null,'wheat','gold','stone'].includes(t.resource)||['explored','visible','road','ruin','camp','river'].some(k=>typeof t[k]!=='boolean'))throw Error('The save contains invalid tile data.');
 if(s.ended&&(![0,1,2,3].includes(s.ended.winner)||!['Wonder','Conquest','Defeat','Legacy'].includes(s.ended.type)||typeof s.ended.text!=='string'))throw Error('The save contains an invalid result.');
 if(s.difficulty!==undefined&&!known(DIFFICULTY,s.difficulty))throw Error('The save contains an unknown difficulty.');
 if(s.tidings!==undefined&&(!isRecord(s.tidings)||!Number.isInteger(s.tidings.next)||!Array.isArray(s.tidings.seen)||s.tidings.seen.some(id=>!TIDING_IDS.has(id))))throw Error('The save contains invalid tidings.');
 if(s.pending!=null&&(!isRecord(s.pending)||!TIDING_IDS.has(s.pending.id)))throw Error('The save contains invalid tidings.');
 }
 get tiles(){return this.s.tiles;}tile(x,z){return x>=0&&z>=0&&x<W&&z<H?this.s.tiles[z*W+x]:null;}
 unit(id){return this.s.units.find(u=>u.id===id);}city(id){return this.s.cities.find(c=>c.id===id);}
 cityAt(x,z){return this.s.cities.find(c=>c.x===x&&c.z===z);}unitsAt(x,z){return this.s.units.filter(u=>u.x===x&&u.z===z);}
 cities(owner=0){return this.s.cities.filter(c=>c.owner===owner);}units(owner=0){return this.s.units.filter(u=>u.owner===owner);}
 faction(o=0){return o===0?this.s:this.s.ai[o];}has(t,o=0){return this.faction(o)?.techs.includes(t);}
 capitalCity(){const cs=this.cities(0);return cs.find(c=>c.capital===0)||cs[0]||null;}
 addScience(n){const k=this.s.research;if(!k){const c=Math.round(n/2);this.s.culture+=c;return `Every path is already known, so it becomes +${c} culture.`;}this.s.researchBank[k]=(this.s.researchBank[k]||0)+n;this.resolveResearch(0);return `+${n} science.`;}
 addFavor(o,n){const r=this.s.relations[o];if(r)r.favor=clamp(r.favor+n,-50,100);}
 notify(text,kind='info',owner=0){if(owner!==0)return;this.events.push({text,kind});this.s.log.unshift({turn:this.s.turn,text,kind});this.s.log=this.s.log.slice(0,50);}
 changed(){if(!this.processing){for(const f of this.listeners)f();}}
 onChange(fn){this.listeners.push(fn);}
 error(text){return{ok:false,msg:text};}ok(text=''){this.changed();return{ok:true,msg:text};}
 active(){return !this.s.ended||this.s.keepPlaying;}
 addUnit(owner,type,x,z){const u={id:this.s.nextId++,owner,type,x,z,hp:100,moves:UNITS[type].moves,fortified:false,job:null,bonus:0,moved:false};this.s.units.push(u);return u;}
 /** The next free name for a Dawnfolk city (names are never repeated while a city carries them). */
 cityName(){const used=new Set(this.s.cities.map(c=>c.name));const free=CITY_NAMES.find(n=>!used.has(n));if(free)return free;for(let i=2;;i++)for(const n of CITY_NAMES)if(!used.has(`${n} ${i}`))return `${n} ${i}`;}
 addCity(owner,x,z,name=null,capital=false){const city={id:this.s.nextId++,owner,x,z,name:name||this.cityName(),capital:capital?owner:null,originalOwner:owner,pop:1,food:0,localCulture:0,build:'worker',stock:{},buildings:[],hp:100,maxHp:100,focus:'balanced',founded:this.s.turn};
 if(owner>0)city.build='warrior';this.s.cities.push(city);const t=this.tile(x,z);t.type=t.type==='forest'?'grass':t.type;t.resource=null;t.ruin=false;t.camp=false;t.improvement=null;t.road=true;return city;}
 found(id){if(!this.active())return this.error('This age has ended.');const u=this.unit(id);if(!u||u.owner!==0||u.type!=='settler')return this.error('Select a settler first.');if(u.moves<=0)return this.error('This settler can act next turn.');const t=this.tile(u.x,u.z);
 if(t.type==='water'||t.type==='mountain'||t.owner>0||this.s.cities.some(c=>dist(c,u)<3))return this.error('Choose land at least 3 tiles from every city, outside rival borders.');
 const first=!this.s.everFounded;const c=this.addCity(0,u.x,u.z,null,first);this.s.units=this.s.units.filter(v=>v.id!==id);this.s.everFounded=true;this.s.tutorial=Math.max(1,this.s.tutorial);this.claimBorders();this.refreshVisibility();this.notify(`${c.name} is founded. A new story begins.`, 'city');this.changed();return{ok:true,city:c.id};}
 claimBorders(){for(const t of this.tiles)t.owner=-1;const sorted=[...this.s.cities].sort((a,b)=>a.founded-b.founded);for(const c of sorted){let r=c.localCulture>=50?3:c.localCulture>=10?2:1;for(let z=c.z-r;z<=c.z+r;z++)for(let x=c.x-r;x<=c.x+r;x++){const t=this.tile(x,z);if(!t||t.type==='water'||(r>=2&&Math.abs(x-c.x)===r&&Math.abs(z-c.z)===r))continue;const oc=t.owner>=0?this.s.cities.filter(a=>a.owner===t.owner).reduce((m,a)=>Math.min(m,dist(a,t)),99):99;if(t.owner===-1||dist(c,t)<oc)t.owner=c.owner;}}for(const c of this.s.cities)this.tile(c.x,c.z).owner=c.owner;}
 refreshVisibility(){for(const t of this.tiles)t.visible=false;const reveal=(x,z,r)=>{for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){let t=this.tile(x+dx,z+dz);if(t&&dx*dx+dz*dz<=(r+.5)**2){t.visible=true;t.explored=true;}}};
 if(!this.s.everFounded)reveal(5,10,5);for(const c of this.cities())reveal(c.x,c.z,c.localCulture>=10?4:3);for(const u of this.units())reveal(u.x,u.z,u.type==='scout'?3:2);
 for(let o=1;o<=2;o++){const r=this.s.relations[o];if(!r.met&&[...this.cities(o),...this.units(o)].some(a=>this.tile(a.x,a.z).visible)){r.met=true;this.notify(`You have met ${FACTIONS[o].name}. Open the Council to talk.`, 'diplomacy');}}
 }
 yieldTile(t){const b=TERRAIN[t.type];let v={food:b.food,prod:b.prod,gold:b.gold};if(t.resource==='wheat')v.food+=2;if(t.resource==='gold')v.gold+=3;if(t.resource==='stone')v.prod+=1;if(t.river)v.gold+=1;if(t.improvement==='farm')v.food+=2;if(t.improvement==='mine')v.prod+=2+(t.resource==='stone'&&this.has('masonry',Math.max(0,t.owner))?1:0);return v;}
 yields(c){const tiles=this.tiles.filter(t=>t.owner===c.owner&&dist(c,t)<=2&&!(Math.abs(c.x-t.x)===2&&Math.abs(c.z-t.z)===2)&&!(t.x===c.x&&t.z===c.z)&&!this.cityAt(t.x,t.z)&&t.type!=='mountain');
 const weight=t=>{const y=this.yieldTile(t);return c.focus==='food'?y.food*4+y.prod:c.focus==='production'?y.prod*5+y.food:c.focus==='gold'?y.gold*5+y.food:y.food*2+y.prod*1.8+y.gold;};
 tiles.sort((a,b)=>weight(b)-weight(a));const worked=tiles.slice(0,c.pop);let food=3,prod=3,gold=2,science=3+c.pop,culture=1;for(const t of worked){const y=this.yieldTile(t);food+=y.food;prod+=y.prod;gold+=y.gold;}
 const b=c.buildings;if(b.includes('granary'))food+=1;if(b.includes('library'))science+=4;if(b.includes('temple'))culture+=3;if(b.includes('monument'))culture+=2;if(b.includes('market'))gold+=4;if(b.includes('workshop'))prod+=4;if(b.includes('sunspire'))culture+=8;
 if(b.includes('gardens')){food+=3;culture+=2;}if(b.includes('archive')){science+=6;culture+=2;}
 const civic=this.faction(c.owner)?.civic;if(civic==='council'){science+=2;culture+=1;}if(civic==='industry'){prod+=2;gold-=1;}
 const limit=6+(b.includes('temple')?2:0)+(b.includes('gardens')?2:0);let surplus=Math.max(0,food-c.pop*2);if(c.pop>=limit)surplus=0;
 return{food,surplus,prod,gold,science,culture,worked,limit};}
 income(o=0){let r={food:0,prod:0,gold:0,science:0,culture:0};for(const c of this.cities(o)){const y=this.yields(c);for(const k in r)r[k]+=k==='food'?y.surplus:y[k];if(c.build==='wealth')r.gold+=y.prod;}
 if(o===0){for(let i=1;i<=2;i++)if(this.s.relations[i].trade){r.gold+=3;r.science+=1;}}else if(this.s.relations[o].trade){r.gold+=3;r.science+=1;}
 r.gold-=Math.max(0,this.units(o).length-4);return r;}
 canBuild(c,key){const b=BUILDS[key];if(!b)return 'Unknown project.';if(b.req&&!this.has(b.req,c.owner))return `Requires ${TECHS[b.req].name}.`;if(b.req2&&!this.has(b.req2,c.owner))return `Requires ${TECHS[b.req2].name}.`;if(c.buildings.includes(key))return 'Already built.';if(key==='sunspire'&&this.cities(c.owner).length<2)return 'Requires at least 2 cities.';
 if(b.wonder){const at=this.s.cities.find(a=>a.buildings.includes(key));if(at)return at.owner===c.owner?`Already built in ${at.name}.`:`${b.name} already stands in another realm.`;}return '';}
 setBuild(id,key){const c=this.city(id);if(!c||c.owner!==0)return this.error('Select one of your cities.');const e=this.canBuild(c,key);if(e)return this.error(e);c.build=key;return this.ok();}
 setFocus(id,focus){const c=this.city(id);if(!c||c.owner!==0||!['balanced','food','production','gold'].includes(focus))return this.error('Invalid city focus.');c.focus=focus;return this.ok();}
 setResearch(key){const t=TECHS[key];if(!t||this.has(key))return this.error('This technology is already known.');if(t.req.some(a=>!this.has(a)))return this.error('Learn the required technologies first.');this.s.research=key;return this.ok();}
 setCivic(civic){if(!['tradition','industry','council'].includes(civic))return this.error('Unknown civic.');if(civic==='industry'&&!this.has('bronze'))return this.error('Requires Bronze Working.');if(civic==='council'&&!this.has('philosophy'))return this.error('Requires Philosophy.');if(civic===this.s.civic)return this.ok();if(this.s.gold<15)return this.error('A civic change costs 15 gold.');this.s.gold-=15;this.s.civic=civic;this.notify('Your people have adopted a new civic.','culture');return this.ok();}
 hostile(a,b){return a!==b&&(a===3||b===3||a===0&&this.s.relations[b]?.status==='war'||b===0&&this.s.relations[a]?.status==='war');}
 entry(u,t,target=false){if(!t||t.type==='water'||t.type==='mountain')return false;let c=this.cityAt(t.x,t.z);if(c&&c.owner!==u.owner)return false;if(t.owner>=0&&t.owner!==u.owner&&!this.hostile(u.owner,t.owner)){if(u.owner===0&&!this.s.relations[t.owner]?.trade)return false;if(u.owner>0)return false;}
 if(this.unitsAt(t.x,t.z).some(v=>v.owner!==u.owner))return false;return true;}
 moveCost(u,t,from){if(t.road&&from?.road)return .5;return u.type==='scout'?1:t.type==='forest'||t.type==='hill'?2:1;}
 reachable(u){if(!u||u.moves<=0||u.job)return new Map();const costs=new Map([[u.z*W+u.x,0]]),prev=new Map(),open=[{x:u.x,z:u.z,c:0}];while(open.length){open.sort((a,b)=>a.c-b.c);let p=open.shift();for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;let t=this.tile(p.x+dx,p.z+dz);if(!this.entry(u,t))continue;let nc=p.c+this.moveCost(u,t,this.tile(p.x,p.z)),k=t.z*W+t.x;if(nc<=u.moves+.01&&nc<(costs.get(k)??1e9)){costs.set(k,nc);prev.set(k,p.z*W+p.x);open.push({x:t.x,z:t.z,c:nc});}}}
 costs.prev=prev;return costs;}
 path(u,x,z){const r=this.reachable(u),k=z*W+x;if(!r.has(k))return null;let keys=[k],last=k;while(r.prev.has(last)){last=r.prev.get(last);keys.unshift(last);}return{cost:r.get(k),tiles:keys.map(i=>this.tiles[i])};}
 move(id,x,z){if(!this.active())return this.error('This age has ended.');const u=this.unit(id);if(!u||u.owner!==0)return this.error('Select your unit first.');const p=this.path(u,x,z);if(!p||p.tiles.length<2)return this.error('This tile is out of reach. Forests and hills cost 2 movement.');
 u.x=x;u.z=z;u.moves=Math.max(0,u.moves-p.cost);u.moved=true;u.fortified=false;this.enterTile(u);this.refreshVisibility();return this.ok();}
 /* Ruins and camps belong to the settled realms: raiders no longer loot ruins or tear down their own camps. */
 enterTile(u){const t=this.tile(u.x,u.z);if(u.owner===3)return;if(t.ruin){t.ruin=false;if(u.owner===0){this.s.ruins++;const r=this.s.ruins%3;if(r===1){this.s.gold+=30;this.notify('Ancient ruins: your scouts find 30 gold.','discovery');}else if(r===2){if(this.s.research)this.s.researchBank[this.s.research]=(this.s.researchBank[this.s.research]||0)+20;this.notify('Ancient ruins: a lost tablet gives 20 science.','discovery');this.resolveResearch(0);}else{const c=this.cities()[0];if(c&&c.build!=='wealth'){c.stock[c.build]=(c.stock[c.build]||0)+20;this.notify('Ancient ruins: skilled builders join your people. +20 production.','discovery');}else{this.s.gold+=25;this.notify('Ancient ruins: travelling traders share 25 gold.','discovery');}}}}
 if(t.camp&&UNITS[u.type].str>0){t.camp=false;if(u.owner===0){this.s.gold+=35;this.s.culture+=6;this.notify('The raider camp is cleared. +35 gold and +6 culture.','battle');}}}
 improve(id,kind){const u=this.unit(id);if(!u||u.owner!==0||u.type!=='worker')return this.error('Select a worker first.');const t=this.tile(u.x,u.z);if(u.moves<=0||u.job)return this.error('This worker can act next turn.');if(t.owner!==0)return this.error('Build improvements inside your borders.');if(this.cityAt(u.x,u.z))return this.error('Move the worker out of the city to improve a tile.');
 if(kind==='farm'){if(!this.has('agriculture'))return this.error('Research Agriculture first.');if(!['grass','plains','sand'].includes(t.type))return this.error('Farms need open, flat land.');if(t.improvement==='farm')return this.error('This tile already has a farm.');}
 else if(kind==='mine'){if(!this.has('mining'))return this.error('Research Mining first.');if(t.type!=='hill'&&!['gold','stone'].includes(t.resource))return this.error('Mines need hills, gold, or stone.');if(t.improvement==='mine')return this.error('This tile already has a mine.');}
 else if(kind==='road'){if(t.road)return this.error('This tile already has a road.');}else return this.error('Unknown improvement.');
 u.job={kind,left:2};u.moves=0;u.moved=true;return this.ok();}
 wait(id,fortify=false){const u=this.unit(id);if(!u||u.owner!==0)return this.error('Select your unit first.');if(u.job){u.job=null;this.notify('The worker has stopped building.');}if(fortify&&u.fortified){u.fortified=false;return this.ok();}u.moves=0;u.fortified=fortify;return this.ok();}
 defenderAt(x,z,owner){const units=this.unitsAt(x,z).filter(v=>v.owner!==owner);units.sort((a,b)=>this.power(b,true)-this.power(a,true));return units[0]||this.cityAt(x,z);}
 power(e,defend=false){if(!e.type)return 5+e.pop*.55+(e.buildings.includes('walls')?2:0);let p=UNITS[e.type].str+e.bonus;if(p===0)return .8;if(e.type==='raider')p*=this.diff.raiderPower;p*=.65+.35*e.hp/100;if(defend){const t=this.tile(e.x,e.z);if(t.type==='forest')p*=1.2;if(t.type==='hill')p*=1.25;if(e.fortified)p*=1.3;if(this.cityAt(e.x,e.z))p*=1.25;}return p;}
 preview(id,x,z){const u=this.unit(id),d=u&&this.defenderAt(x,z,u.owner);if(!u||!d||d.owner===u.owner)return null;const a=this.power(u),b=this.power(d,true),siege=u.type==='catapult';let damage=clamp(Math.round(34*a/b),16,65);if(siege&&d.type)damage=Math.round(damage*.5);return{attacker:u,defender:d,damage,returnDamage:siege?0:clamp(Math.round(24*b/a),10,48),war:this.hostile(u.owner,d.owner)};}
 attack(id,x,z){if(!this.active())return this.error('This age has ended.');const u=this.unit(id);if(!u||u.owner!==0)return this.error('Select your unit first.');if(u.moves<=0||u.job)return this.error('This unit can attack next turn.');if(UNITS[u.type].str===0)return this.error('This unit cannot attack.');if(dist(u,{x,z})>(UNITS[u.type].range||1))return this.error('Move closer to attack.');const p=this.preview(id,x,z);if(!p)return this.error('There is no target here.');if(!p.war)return this.error('Declare war through the Council first.');const r=this.resolveBattle(u,p.defender);this.refreshVisibility();this.checkVictory();this.changed();return{ok:true,msg:'',...r};}
 /* A city falls only to a melee attacker that survives the assault: catapults and a dying
    attacker leave it standing at 1 health. */
 resolveBattle(u,d){const p=this.preview(u.id,d.x,d.z);if(!p)return{};u.moves=0;u.moved=true;u.fortified=false;d.hp-=p.damage;u.hp-=p.returnDamage;const dn=d.type?UNITS[d.type].name:d.name;let msg=`${UNITS[u.type].name} attacks ${dn}: ${p.damage} damage.`;const ux=u.x,uz=u.z;let killed=false,captured=false;
 if(!d.type&&d.hp<=0&&(u.type==='catapult'||u.hp<=0)){d.hp=1;msg=`${dn} is battered to its last defences.${u.type==='catapult'?' A melee unit must take it.':''}`;}
 if(d.hp<=0){if(d.type){killed=true;this.s.units=this.s.units.filter(v=>v.id!==d.id);msg=`${dn} defeated.`;if(u.hp>0&&u.type!=='catapult'&&!this.unitsAt(d.x,d.z).some(a=>a.owner!==u.owner)&&(!this.cityAt(d.x,d.z)||this.cityAt(d.x,d.z).owner===u.owner)){u.x=d.x;u.z=d.z;this.enterTile(u);}}else{captured=true;const oldOwner=d.owner;d.owner=u.owner;d.hp=Math.round(d.maxHp*.55);d.pop=Math.max(1,d.pop-1);d.build='warrior';d.stock={};d.founded=this.s.turn;d.localCulture=0;u.x=d.x;u.z=d.z;this.claimBorders();msg=`${d.name} has been captured${u.owner===0?' by your army':''}.`;if(oldOwner===0)this.notify(`${d.name} has fallen.`, 'danger');}}
 const lost=u.hp<=0;if(lost){this.s.units=this.s.units.filter(v=>v.id!==u.id);msg+=` ${UNITS[u.type].name} was lost.`;}if(u.owner===0||d.owner===0||this.tile(ux,uz).visible)this.notify(msg,'battle');
 return{killed,captured,lost};}
 diplomacy(o,action){if(o<1||o>2)return this.error('Unknown realm.');const r=this.s.relations[o];if(!r.met)return this.error('Explore the map to meet this realm.');if(!this.cities(o).length)return this.error('This realm has fallen.');
 if(action==='war'){if(r.status==='war')return this.error('You are already at war.');r.status='war';r.trade=false;r.favor=-50;r.warTurn=this.s.turn;this.notify(`War declared on ${FACTIONS[o].name}.`,'danger');}
 else if(action==='peace'){if(r.status!=='war')return this.error('You are already at peace.');if(this.s.gold<30)return this.error('Peace costs 30 gold.');this.s.gold-=30;r.status='peace';r.favor=0;this.notify(`A peace treaty is signed with ${FACTIONS[o].name}.`,'diplomacy');}
 else if(action==='gift'){if(r.status==='war')return this.error('Make peace before you send a gift.');if(r.favor>=100)return this.error('Their goodwill cannot grow any higher.');if(this.s.gold<20)return this.error('You need 20 gold.');this.s.gold-=20;r.favor=Math.min(100,r.favor+25);this.notify(`${FACTIONS[o].leader} welcomes your gift. Relations improve.`,'diplomacy');}
 else if(action==='trade'){if(r.status==='war')return this.error('Trade is not possible during war.');if(r.trade)return this.error('A trade pact is already active.');if(!this.has('writing'))return this.error('Research Writing to sign trade pacts.');if(this.s.gold<20)return this.error('A trade pact costs 20 gold.');this.s.gold-=20;r.trade=true;r.favor=Math.min(100,r.favor+15);this.notify(`Trade with ${FACTIONS[o].name}: +3 gold and +1 science per turn.`,'diplomacy');}
 else if(action==='maps'){if(r.status==='war'||r.favor<25)return this.error('Map exchange requires peace and 25 goodwill.');if(this.s.gold<15)return this.error('A map exchange costs 15 gold.');this.s.gold-=15;for(const c of this.cities(o))for(const t of this.tiles)if(dist(c,t)<=3)t.explored=true;this.notify('Their maps reveal new lands.','discovery');}else return this.error('Unknown diplomatic action.');return this.ok();}
 resolveResearch(o){const f=this.faction(o),key=f.research;if(!key)return;const tech=TECHS[key];if((f.researchBank[key]||0)<tech.cost)return;const extra=f.researchBank[key]-tech.cost;f.techs.push(key);f.researchBank[key]=0;
 const order=['agriculture','mining','pottery','writing','mysticism','masonry','bronze','philosophy','engineering'];f.research=order.find(k=>!f.techs.includes(k)&&TECHS[k].req.every(r=>f.techs.includes(r)))||null;if(f.research)f.researchBank[f.research]=(f.researchBank[f.research]||0)+extra;
 this.notify(`${tech.name} discovered. ${tech.desc}${f.research?` Now studying ${TECHS[f.research].name}.`:''}`,'research',o);
 }
 aiBuild(c){const o=c.owner,army=this.units(o).filter(u=>UNITS[u.type].str>0).length;
 if(this.s.relations[o].status==='war'&&army<7)return this.has('bronze',o)?'spearman':'warrior';
 for(const k of ['monument','granary','library','temple','workshop'])if(!this.canBuild(c,k))return k;
 if(army>=4&&this.s.turn>=22)for(const k of (o===1?['archive','gardens']:['gardens','archive']))if(!this.canBuild(c,k))return k;
 if(army<4)return this.has('bronze',o)?'spearman':'warrior';
 if(!this.canBuild(c,'sunspire')&&this.s.turn>36)return 'sunspire';
 return 'wealth';}
 processCity(c){const y=this.yields(c),f=this.faction(c.owner);c.food+=y.surplus;let need=12+c.pop*6;if(c.food>=need&&c.pop<y.limit){c.food-=c.buildings.includes('granary')?Math.ceil(need/2):need;c.pop++;this.notify(`${c.name} grows to ${c.pop} people.`,'city',c.owner);}
 c.localCulture+=y.culture;f.culture+=y.culture;f.gold+=y.gold;const key=c.build,b=BUILDS[key],err=key==='wealth'?'':this.canBuild(c,key);if(key==='wealth'){f.gold+=y.prod;}else if(!err){c.stock[key]=(c.stock[key]||0)+(c.owner===0?y.prod:Math.round(y.prod*this.diff.aiProd));if(c.stock[key]>=b.cost){c.stock[key]-=b.cost;
 if(UNITS[key]){const u=this.addUnit(c.owner,key,c.x,c.z);if(c.buildings.includes('barracks')&&UNITS[key].str>0)u.bonus=1;}else{c.buildings.push(key);if(key==='walls'){c.hp+=50;c.maxHp+=50;}if(b.wonder&&c.owner>0&&this.s.relations[c.owner].met)this.notify(`${FACTIONS[c.owner].name} completes ${b.name} in ${c.name}.`,'diplomacy');}
 c.build=c.owner===0?(this.units(0).filter(a=>UNITS[a.type].str>0).length<3?'warrior':'wealth'):this.aiBuild(c);
 this.notify(`${c.name} ${UNITS[key]?`trains a ${b.name}`:`completes ${b.name}`}.${c.owner===0?` Next: ${BUILDS[c.build].name}. Open the city to change it.`:''}`,'build',c.owner);
 }}else{
 /* The project became impossible (a rival finished the wonder first, a city was lost…):
    this turn's work and half of the stored work come back as gold instead of vanishing. */
 const refund=Math.floor((c.stock[key]||0)/2);c.stock[key]=0;f.gold+=y.prod+refund;
 if(c.owner===0)this.notify(`${c.name} stops work on ${b.name}: ${err} ${y.prod+refund} gold recovered. Choose a new project.`,'danger');
 c.build=c.owner===0?'wealth':this.aiBuild(c);}
 if(!this.s.units.some(u=>this.hostile(u.owner,c.owner)&&dist(u,c)<=1))c.hp=Math.min(c.maxHp,c.hp+6);
 }
 aiStep(u,target){if(!u||u.moves<=0)return;const reach=this.reachable(u);let options=[...reach.keys()].map(k=>this.tiles[k]).filter(t=>t.x!==u.x||t.z!==u.z);options.sort((a,b)=>dist(a,target)-dist(b,target)||hash(a.x,a.z,this.s.turn+u.id)-hash(b.x,b.z,this.s.turn+u.id));let t=options[0];if(t&&dist(t,target)<dist(u,target)){u.x=t.x;u.z=t.z;u.moves-=reach.get(t.z*W+t.x);u.moved=true;u.fortified=false;this.enterTile(u);}}
 runAI(){const d=this.diff;for(let o=1;o<=2;o++){
 const cities=this.cities(o);if(!cities.length)continue;const f=this.faction(o),r=this.s.relations[o];
 for(const c of cities)if(c.build==='wealth')c.build=this.aiBuild(c);
 if(this.s.turn%2===0&&r.trade)r.favor=Math.min(100,r.favor+1);
 if(this.s.turn>=d.warTurn&&(this.s.turn-d.warTurn)%12===0&&r.met&&r.status==='peace'&&r.favor<d.warFavor&&o===1&&this.units(0).filter(u=>UNITS[u.type].str>0).length<d.warArmy){r.status='war';r.trade=false;r.warTurn=this.s.turn;this.notify('The Ember Court declares war. Defend your cities!','danger');}
 if(this.s.turn%d.foundEvery===0&&cities.length<3){const cap=cities[0],options=this.tiles.filter(t=>t.type!=='water'&&t.type!=='mountain'&&t.owner===-1&&dist(t,cap)<=5&&this.s.cities.every(c=>dist(c,t)>=3)&&!this.unitsAt(t.x,t.z).some(u=>u.owner!==o));options.sort((a,b)=>{let ya=this.yieldTile(a),yb=this.yieldTile(b);return(yb.food*2+yb.prod)-(ya.food*2+ya.prod);});if(options[0]){const t=options[0],names=o===1?['Redstone','Copperfell','Ashbarrow']:['Saltmeadow','Blueharbor','Gullcrest'],used=new Set(this.s.cities.map(c=>c.name));this.addCity(o,t.x,t.z,names.find(n=>!used.has(n))||`${FACTIONS[o].short} Hold`);if(r.met)this.notify(`${FACTIONS[o].name} founds a new city.`,'diplomacy');}}
 if(this.s.turn%7===0){const t=this.tiles.find(t=>t.owner===o&&!t.improvement&&!this.cityAt(t.x,t.z)&&['grass','hill','plains'].includes(t.type));if(t)t.improvement=t.type==='hill'?'mine':'farm';}
 for(const u of this.units(o)){if(!UNITS[u.type].str)continue;let foes=this.s.units.filter(a=>this.hostile(o,a.owner)&&dist(a,u)<=6);let targets=[...foes,...this.s.cities.filter(a=>this.hostile(o,a.owner))];targets.sort((a,b)=>dist(a,u)-dist(b,u));const target=targets[0];if(target){if(dist(u,target)<=(UNITS[u.type].range||1)){const d=this.defenderAt(target.x,target.z,o);if(d&&this.hostile(o,d.owner))this.resolveBattle(u,d);}else this.aiStep(u,target);}else{const c=cities.reduce((a,b)=>dist(a,u)<dist(b,u)?a:b);if(dist(u,c)>1)this.aiStep(u,c);else u.fortified=true;}}
 }
 if(this.s.turn%d.raiderEvery===0){for(const t of this.tiles.filter(t=>t.camp))if(!this.s.units.some(u=>u.owner===3&&dist(u,t)<2))this.addUnit(3,'raider',t.x,t.z);}
 for(const u of this.units(3)){if(this.s.turn<d.raiderTurn)continue;const possible=[...this.s.units.filter(v=>v.owner!==3),...this.s.cities].filter(a=>a.owner!==3&&dist(a,u)<=7);possible.sort((a,b)=>dist(a,u)-dist(b,u));let target=possible[0];if(!target)continue;if(dist(u,target)<=1){const d=this.defenderAt(target.x,target.z,3);if(d)this.resolveBattle(u,d);}else if(this.s.turn%2===0)this.aiStep(u,target);}
 }
 endTurn(){if(!this.active())return this.error('This age has ended.');
 // A matter left open is settled with its default (the last, free) answer.
 if(this.s.pending)this.applyTiding(this.tiding()?.choices.length-1,true);
 this.processing=true;
 try{
 for(let o=0;o<=2;o++){const inc=this.income(o),f=this.faction(o);if(f.research)f.researchBank[f.research]=(f.researchBank[f.research]||0)+(o===0?inc.science:Math.round(inc.science*this.diff.aiScience));for(const c of [...this.cities(o)])this.processCity(c);f.gold-=Math.max(0,this.units(o).length-4);if(o===0){for(let j=1;j<=2;j++)if(this.s.relations[j].trade)f.gold+=3;}else if(this.s.relations[o].trade)f.gold+=3;f.gold=Math.max(0,f.gold);this.resolveResearch(o);}
 for(const u of this.s.units){if(u.job){u.job.left--;if(u.job.left<=0){let t=this.tile(u.x,u.z);if(t.owner===u.owner){if(u.job.kind==='road')t.road=true;else t.improvement=u.job.kind;this.notify(`${u.job.kind==='road'?'Road':u.job.kind==='farm'?'Farm':'Mine'} completed.`,'build',u.owner);}u.job=null;}}if(!u.moved)u.hp=Math.min(100,u.hp+(u.fortified?22:12));u.moves=u.job?0:UNITS[u.type].moves;u.moved=false;}
 this.runAI();this.claimBorders();this.refreshVisibility();this.s.turn++;
 if(this.s.turn===12&&this.cities().length){this.s.gold+=20;this.notify('A rich harvest fills the market. +20 gold.','discovery');}
 if(this.s.turn===30&&this.cities().length){this.s.culture+=12;this.notify('A great poet joins your people. +12 culture.','culture');}
 this.checkVictory();
 if(!this.s.ended||this.s.keepPlaying)this.nextTiding();
 }finally{this.processing=false;}
 this.changed();return{ok:true};}
 /* ---- tidings */
 tiding(){return this.s.pending?TIDINGS.find(t=>t.id===this.s.pending.id)||null:null;}
 /** The pending tiding if it can still be answered (its conditions may have changed since it arrived). */
 openTiding(){const e=this.tiding();return e&&this.capitalCity()&&e.when(this)?e:null;}
 nextTiding(){const td=this.s.tidings;if(this.s.pending||this.s.turn<td.next||!this.capitalCity())return;
 const list=TIDINGS.filter(e=>!td.seen.includes(e.id)&&e.when(this));if(!list.length){td.next=this.s.turn+2;return;}
 const e=list[Math.floor(hash(this.s.turn,list.length,this.s.seed)*list.length)];this.s.pending={id:e.id,turn:this.s.turn};td.next=this.s.turn+7;this.notify(`${e.title}: a matter awaits your decision.`,'discovery');}
 applyTiding(i,auto=false){const e=this.tiding();if(!e){this.s.pending=null;return this.error('Nothing awaits a decision.');}
 if(!this.openTiding()){this.s.pending=null;this.s.tidings.seen.push(e.id);this.notify(`${e.title}: the moment has passed.`,'discovery');return{ok:true,msg:''};}
 const choice=e.choices[i];if(!choice)return this.error('Unknown choice.');
 const err=choice.can?choice.can(this):'';if(err)return this.error(err);
 const text=choice.apply(this);this.s.pending=null;this.s.tidings.seen.push(e.id);this.notify(`${auto?'Left to your people: ':''}${text}`,'discovery');return{ok:true,msg:text};}
 decide(i){const r=this.applyTiding(i);if(r.ok)this.changed();return r;}
 score(o=0){const f=this.faction(o);return this.cities(o).length*40+this.cities(o).reduce((s,c)=>s+c.pop*12+c.buildings.length*5,0)+f.techs.length*15+Math.floor(f.culture/3)+Math.floor(f.gold/10)+(o===0?this.s.ruins*8:0);}
 checkVictory(){if(this.s.ended||this.s.keepPlaying)return;let win=null;const wonder=this.s.cities.find(c=>c.buildings.includes('sunspire'));if(wonder)win={winner:wonder.owner,type:'Wonder',text:`The Sunspire rises over ${wonder.name}. Its light will guide a thousand generations.`};
 const enemyCaps=this.s.cities.filter(c=>c.capital===1||c.capital===2);if(enemyCaps.length===2&&enemyCaps.every(c=>c.owner===0))win={winner:0,type:'Conquest',text:'Both rival capitals fly your banner. A divided land now shares one future.'};
 if(this.s.everFounded&&!this.cities().length&&!this.units().some(u=>u.type==='settler'))win={winner:1,type:'Defeat',text:'Your last city has fallen. Even the greatest stories can begin again.'};
 if(!this.s.everFounded&&!this.units().some(u=>u.type==='settler'))win={winner:1,type:'Defeat',text:'Your settlers were lost before they could found a city.'};
 if(!win&&this.s.turn>MAX_TURNS){const scores=[0,1,2].map(o=>({o,score:this.score(o)})).sort((a,b)=>b.score-a.score||a.o-b.o);win={winner:scores[0].o,type:'Legacy',text:'The first age has ended. Cities, knowledge, and culture decide which realm history remembers.'};}
 if(win){this.s.ended=win;this.notify(win.winner===0?`${win.type} victory!`:'Your first age has ended.',win.winner===0?'victory':'danger');}}
}
