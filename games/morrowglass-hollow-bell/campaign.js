/* Morrowglass: The Lantern Roads. Authored campaign, mission, and room data. */
(function(root){
'use strict';
const main = [
 {id:'road-letter',flag:'commission',title:'A road beyond the bell',chapter:2,where:'morrowglass',text:'Speak with Edda after the Hollow Bell chapter. Take her packet to the roads.'},
 {id:'lost-courier',flag:'courier',title:'The missing route',chapter:2,where:'bracken',text:'Ask Rowan at Bracken Post about the missing courier. Search Reedfen and speak with Sable after the fight.'},
 {id:'cinder-crossing',flag:'bridge',title:'The bridge that forgot',chapter:2,where:'cinderbridge',text:'Use Sable’s route seal to face the Cinderbridge Warden. Open the eastern roads.'},
 {id:'borrowed-fire',flag:'forge',title:'A flame for the sea',chapter:3,where:'foundry',text:'Speak with Mara at Ember Foundry. Cool the Forge Heart, then return to her for a working flame.'},
 {id:'root-memory',flag:'grove',title:'What a seed remembers',chapter:3,where:'moonwell',text:'Free the Grove Keeper. At the root beacon, place seed, rain, and morning in their natural order.'},
 {id:'sea-memory',flag:'tide',title:'The sea keeps no names',chapter:3,where:'tideglass',text:'Take Mara’s flame to Captain Nessa at Saltmere. Sail to Tideglass, defeat its warden, and set the tide dials.'},
 {id:'snow-memory',flag:'abbey',title:'A voice under the snow',chapter:3,where:'whitewake',text:'Pass the Frost Choir at Frostpass. Help Iria restore the Whitewake letters and light the snow beacon.'},
 {id:'paperwing',flag:'airship',title:'A sky for the living',chapter:4,where:'observatory',text:'Bring all three beacon songs to Aster at Starfall Observatory. Pass the Sky Sentinel and align the stars.'},
 {id:'open-archive',flag:'vault',title:'The house of names',chapter:5,where:'quietvault',text:'Fly Paperwing to the Quiet Vault. Pass the archive watch. Read Sera’s record and choose what to do with the voices.'},
 {id:'last-promise',flag:'finale',title:'Morning without a bell',chapter:6,where:'dawnspire',text:'Reach Dawn Spire. Stop the Hush Engine and let the people write their own next day.'}
];
const side = [
 {id:'delivery',flag:'side_delivery',start:'delivery_started',title:'Letters for home',where:'bracken',text:'Take Linn’s letter from Bracken Post to Sena in the Old Orchard. Return to Linn for a reply.',reward:'Herald Knot · 120 crowns'},
 {id:'orchard',flag:'side_orchard',start:'orchard_started',title:'The last seed',where:'orchard',text:'Help Sena clear the blight. Plant the seed at the empty bed.',reward:'Dawn Prism · 140 crowns'},
 {id:'survey',flag:'side_survey',start:'survey_started',title:'A chart with no edges',where:'waycamp',text:'Ask Fen for a field chart. Visit eight overworld destinations, then return to the camp.',reward:'Atlas Ribbon · 160 crowns'},
 {id:'wreck',flag:'side_wreck',start:'wreck_started',title:'Salt and copper',where:'saltmere',text:'After the ferry is ready, ask Nessa about the wreck. Clear the Wreck Diver and return the lost cargo.',reward:'Tideward Brooch · 160 crowns'},
 {id:'stars',flag:'side_stars',start:'stars_started',title:'One star too many',where:'observatory',text:'After Paperwing is ready, ask Aster about the false star. Find it at Dawn Spire, then return.',reward:'Star Prism · 220 crowns'},
 {id:'cards',flag:'side_cards',start:'cards_started',title:'Lanterns across the sea',where:'driftmarket',text:'Meet Orla at Driftmarket. Win a hand at the island table.',reward:'Sunwoven Thread · 180 crowns'}
];
const gear = {
 'silver-thread':{name:'Silver Thread',owner:'ivo',ability:'pierce',skill:'Silver Pierce',need:20,atk:6,desc:'Adds 6 Attack. Teaches a strike that passes through armor and shells.'},
 'ember-prism':{name:'Ember Prism',owner:'mina',ability:'flare',skill:'Flare',need:22,atk:4,desc:'Adds 4 Attack. Teaches focused fire magic.'},
 'dawn-prism':{name:'Dawn Prism',owner:'mina',ability:'renew',skill:'Renew',need:26,atk:8,desc:'Adds 8 Attack. Teaches healing for every living ally.'},
 'herald-knot':{name:'Herald Knot',owner:'orrin',ability:'rally',skill:'Rally',need:20,atk:6,desc:'Adds 6 Attack. Teaches a call that restores allies’ MP and builds Resolve.'},
 'atlas-ribbon':{name:'Atlas Ribbon',owner:'ivo',atk:22,desc:'Adds 22 Attack. Fen’s gift to a traveller who keeps looking.'},
 'tideward-brooch':{name:'Tideward Brooch',owner:'orrin',atk:16,def:4,desc:'Adds 16 Attack and 4 Defense. Brass that has learned to bend.'},
 'star-prism':{name:'Star Prism',owner:'mina',atk:20,desc:'Adds 20 Attack. A clear lens with one small, stubborn flaw.'},
 'sunwoven-thread':{name:'Sunwoven Thread',owner:'ivo',atk:27,desc:'Adds 27 Attack. Orla’s prize for a well-played hand.'},
 'root-knot':{name:'Root Knot',owner:'orrin',atk:12,def:3,desc:'Adds 12 Attack and 3 Defense. A living reminder of the grove.'},
 'tide-thread':{name:'Tide Thread',owner:'ivo',atk:16,desc:'Adds 16 Attack. The tide leaves something useful behind.'}
};
const flags = ['commission','courier_started','courier','bridge','forge_started','forge','ferry','grove','tide','abbey','airship','vault','finale','finale_seen','delivery_started','delivery_delivered','side_delivery','orchard_started','side_orchard','survey_started','side_survey','wreck_started','side_wreck','stars_started','side_stars','cards_started','side_cards','echo_orchard','echo_tide','echo_abbey','echo_vault','cache_waycamp','cache_reedfen','cache_foundry','cache_frostpass','cache_driftmarket','cache_vault','ate_sable','ate_mara','ate_nessa','ate_iria','ate_aster','ate_neris'];
const encounters=['reed-rescue','bridge-warden','forge-heart','grove-keeper','tide-warden','frost-choir','sky-sentinel','vault-watch','hush-engine','orchard-blight','wreck-diver','star-eater'];
const assets=['bracken','reedfen','foundry','saltmere','whitewake','observatory','quietvault','hush-engine'];
const npcs={
 rowan:{name:'Rowan',cloth:'#658976',hair:'#d5c7a7',skin:'#b67f5e',outfit:'coat'},
 linn:{name:'Linn',cloth:'#b48657',hair:'#492e2b',skin:'#a96948',outfit:'coat'},
 sable:{name:'Sable',cloth:'#4f8b9d',hair:'#433844',skin:'#bc8566',outfit:'coat'},
 mara:{name:'Mara',cloth:'#b77849',hair:'#9d6a43',skin:'#926047',outfit:'tunic'},
 nessa:{name:'Captain Nessa',cloth:'#487982',hair:'#ece1bf',skin:'#b37a55',outfit:'coat'},
 iria:{name:'Iria',cloth:'#7987ba',hair:'#443744',skin:'#c18d75',outfit:'robe'},
 aster:{name:'Aster',cloth:'#8e719c',hair:'#b4b4a5',skin:'#d1ab8d',outfit:'coat'},
 sena:{name:'Sena',cloth:'#958050',hair:'#ede3ca',skin:'#b78e77',outfit:'robe'},
 fen:{name:'Fen',cloth:'#967951',hair:'#684a32',skin:'#c08a64',outfit:'coat'},
 orla:{name:'Orla',cloth:'#ae705e',hair:'#383d48',skin:'#c38e6b',outfit:'coat'},
 neris:{name:'Neris',cloth:'#81a6a0',hair:'#d5e3db',skin:'#98afa4',outfit:'robe'}
};
const floor=[[55,390],[235,330],[731,330],[892,383],[925,512],[40,512]];
const node=(id,label,kind,p,extra={})=>({id,label,kind,p,...extra});
const npc=(id,p,extra={})=>node(id,npcs[id].name,'talk',p,{portrait:id,...extra});
const exit=()=>node('to-overworld','The Lantern Roads','exit',[90,448]);
const rest=()=>node('camp-rest','Pip · Rest & save','save',[822,463]);
const shop=()=>node('campaign-shop','Supplies & equipment','cards',[418,343]);
const battle=(id,label,p=[636,407],extra={})=>node('battle:'+id,label,'fight',p,{battle:id,...extra});
const cache=(id,p)=>node('cache:'+id,'Travel cache','chest',p,{cacheFlag:'cache_'+id});
const room=(name,sub,art,nodes,tint=null)=>({name,sub,art,floor,spawn:[175,439],nodes:[exit(),...nodes],tint});
const rooms={
 waycamp:room('Wayfarer Camp','A kettle, a chart, and a road to anywhere','bracken',[npc('fen',[610,384]),rest(),shop(),cache('waycamp',[310,474]),node('camp-notice','A guide to the roads','sign',[475,420])],'#bf9a61'),
 bracken:room('Bracken Post','No letter is too late to matter','bracken',[npc('rowan',[663,376]),npc('linn',[309,401]),rest(),shop(),node('bracken-board','The route board','sign',[540,460])]),
 reedfen:room('Reedfen Crossing','The lamps are low above the water','reedfen',[battle('reed-rescue','The lost courier',[543,409]),npc('sable',[680,384],{showDefeated:'reed-rescue'}),cache('reedfen',[789,469]),node('reedfen-sign','A courier’s trail','sign',[320,363])]),
 cinderbridge:room('Cinderbridge','The old road still knows your feet','foundry',[battle('bridge-warden','Cinderbridge Warden',[631,391]),rest(),node('bridge-seal','The route seal','sign',[361,371])],'#82766e'),
 foundry:room('Ember Foundry','A small fire can carry a whole town','foundry',[npc('mara',[342,397]),battle('forge-heart','The Forge Heart',[662,387]),rest(),cache('foundry',[495,477]),node('forge-orders','The cooling orders','sign',[498,345])]),
 saltmere:room('Saltmere Harbor','Where every departure leaves a light','saltmere',[npc('nessa',[663,379]),rest(),shop(),node('harbor-dock','Ferry landing','exit',[770,414]),battle('wreck-diver','The wreck below',[479,435],{showFlag:'wreck_started'}),node('saltmere-note','A harbor letter','sign',[313,367])]),
 tideglass:room('Tideglass Shrine','A name can be spoken and released','saltmere',[battle('tide-warden','Tideglass Warden',[664,384]),node('beacon:tide','The tide dials','puzzle',[479,401]),node('echo:tide','A salt-stained record','sign',[287,380]),rest()],'#6dbac2'),
 frostpass:room('Frostpass','A song has closed the mountain road','whitewake',[battle('frost-choir','The Frost Choir',[637,398]),cache('frostpass',[355,470]),rest(),node('frostpass-sign','A wind-worn warning','sign',[377,367])],'#8bb4ce'),
 whitewake:room('Whitewake Abbey','Some voices need someone to listen','whitewake',[npc('iria',[647,380]),node('beacon:abbey','The letter altar','puzzle',[468,410]),node('echo:abbey','The youngest page','sign',[306,367]),rest(),shop()]),
 observatory:room('Starfall Observatory','The sky was never a ceiling','observatory',[npc('aster',[331,393]),battle('sky-sentinel','Sky Sentinel',[674,387]),node('star-chart','The sky chart','puzzle',[499,426]),rest(),node('airship-dock','Paperwing’s mooring','exit',[771,466])]),
 orchard:room('The Old Orchard','One seed is enough to begin','bracken',[npc('sena',[630,384]),battle('orchard-blight','The orchard blight',[466,433],{showFlag:'orchard_started'}),node('seed-bed','The empty seed bed','puzzle',[340,395]),node('echo:orchard','A letter in a bottle','sign',[744,467]),rest()],'#b39256'),
 moonwell:room('Moonwell Grove','Under the roots, a little light remains','garden',[battle('grove-keeper','The Grove Keeper',[667,388]),node('beacon:grove','The root beacon','puzzle',[473,409]),rest(),node('grove-verse','The gardener’s verse','sign',[312,377])],'#79a58a'),
 driftmarket:room('Driftmarket','A whole town that learned to travel','saltmere',[npc('orla',[641,380]),node('island-cards','Orla’s Lanterns table','cards',[440,420]),rest(),shop(),cache('driftmarket',[319,466]),node('market-news','News from the roads','sign',[762,414])],'#d4aa6a'),
 quietvault:room('The Quiet Vault','All the names the mist could not keep','quietvault',[battle('vault-watch','The archive watch',[665,392]),npc('neris',[346,385],{showDefeated:'vault-watch'}),node('sera-record','Sera’s last record','puzzle',[480,414],{showDefeated:'vault-watch'}),node('echo:vault','The first name','sign',[765,470]),cache('vault',[270,461]),rest()]),
 dawnspire:room('Dawn Spire','The place where a promise must change','observatory',[battle('hush-engine','The Hush Engine',[678,363],{kind:'boss'}),battle('star-eater','The false star',[407,422],{showFlag:'stars_started'}),rest(),node('dawn-ledge','The morning ledge','sign',[291,374])],'#d3ae79')
};
function initial(){return {version:1,flags:Object.fromEntries(flags.map(k=>[k,false])),defeated:{},choice:null,tracked:'lost-courier',puzzle:{},visited:['morrowglass']};}
function normalize(value){const c=initial();if(!value||typeof value!=='object')return c;for(const k of flags)c.flags[k]=value.flags?.[k]===true;for(const k of encounters)if(value.defeated?.[k]===true)c.defeated[k]=true;if(['share','rest'].includes(value.choice))c.choice=value.choice;if([...main,...side].some(q=>q.id===value.tracked))c.tracked=value.tracked;const places=['morrowglass',...Object.keys(rooms)];c.visited=Array.isArray(value.visited)?[...new Set(['morrowglass',...value.visited.filter(id=>places.includes(id))])]:['morrowglass'];return c;}
function beacons(c){return ['grove','tide','abbey'].filter(k=>c.flags[k]).length;}
function level(c){const f=c.flags;return f.vault?8:f.airship?7:beacons(c)===3?6:beacons(c)>0?5:f.forge?4:f.courier||f.bridge?3:2;}
function active(q,c){const f=c.flags;if(q.flag==='commission')return true;if(q.flag==='courier')return f.commission;if(q.flag==='bridge')return f.courier;if(q.flag==='forge')return f.bridge;if(['grove','tide','abbey'].includes(q.flag))return f.forge;if(q.flag==='airship')return beacons(c)===3;if(q.flag==='vault')return f.airship;if(q.flag==='finale')return f.vault;return !!f[q.start];}
function next(c){return main.find(q=>!c.flags[q.flag]&&active(q,c))||main.at(-1);}
function objective(c){const f=c.flags,d=c.defeated;if(f.finale)return 'The roads are open. Visit your friends and finish any side missions.';
 if(!f.commission)return 'Speak with Edda. A new packet is waiting on Lantern Quay.';
 if(!f.courier){if(!f.courier_started)return 'Reach Bracken Post. Ask Rowan about the missing courier.';return d['reed-rescue']?'Speak with Sable in Reedfen Crossing.':'Find Sable in Reedfen Crossing. Clear the creatures by the road.';}
 if(!f.bridge)return 'Carry Sable’s route seal to Cinderbridge. Pass its warden.';
 if(!f.forge){if(!f.forge_started)return 'Find Mara at Ember Foundry.';return d['forge-heart']?'Return to Mara at Ember Foundry.':'Cool the Forge Heart. Frost can break its charged attack.';}
 if(beacons(c)<3){const q=[...main,...side].find(q=>q.id===c.tracked);if(q&&active(q,c)&&!f[q.flag])return q.text;return 'Restore the root, sea, and snow beacons. The order is yours.';}
 if(!f.airship)return d['sky-sentinel']?'Align the sky chart at Starfall Observatory.':'Meet Aster at Starfall Observatory. Pass the Sky Sentinel.';
 if(!f.vault)return d['vault-watch']?'Read Sera’s record in the Quiet Vault.':'Fly to the Quiet Vault. Pass the archive watch.';
 return 'Fly to Dawn Spire. Stop the Hush Engine.';}
function gate(id,c){const f=c.flags;if(['quietvault','dawnspire'].includes(id)&&!f.airship)return 'Paperwing can reach this high island. Restore the three beacons and visit Starfall.';if(id==='dawnspire'&&!f.vault)return 'The spire needs Sera’s record. Visit the Quiet Vault first.';if(['tideglass','driftmarket'].includes(id)&&!f.ferry&&!f.airship)return 'A boat can reach this island. Take a working flame to Captain Nessa at Saltmere.';if(['saltmere','frostpass','whitewake','observatory'].includes(id)&&!f.bridge)return 'The eastern road is closed. Pass the Cinderbridge Warden first.';if(id==='whitewake'&&!c.defeated['frost-choir'])return 'The Frost Choir blocks the abbey road. Clear Frostpass first.';return null;}
root.MorrowCampaign={main,side,gear,flags,encounters,assets,npcs,rooms,initial,normalize,beacons,level,active,next,objective,gate};
})(typeof window!=='undefined'?window:globalThis);
