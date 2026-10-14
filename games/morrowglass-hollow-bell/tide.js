/* The Unwritten Tide. Original post-campaign story, locations, and persistent state. */
(function(root){
'use strict';
const C=root.MorrowCampaign, old={...C};
const main=[
 {id:'tide-letter',flag:'tide_commission',title:'A letter with no past',chapter:7,where:'saltmere',text:'After the Lantern Roads ending, speak with Captain Nessa. A new letter points to a coast beyond the old chart.'},
 {id:'tide-landing',flag:'tide_landing',title:'A coast that writes back',chapter:7,where:'gullwake',text:'Fly Paperwing east to Gullwake Port. Meet Nell at the post house. Learn what the coast needs.'},
 {id:'tide-shelter',flag:'tide_shelter',title:'A roof before the rain',chapter:7,where:'rainweald',text:'Help Tova at Rainweald Shelter. Clear the flooded path. Secure the posts, cover the frame, and open the drains.'},
 {id:'tide-water',flag:'tide_water',title:'Water for everyone',chapter:8,where:'glasswater',text:'Meet Daro at Glasswater Locks. Stop the Lockjaw Engine. Route six measures of water to homes, seed beds, the mill, and the spillway.'},
 {id:'tide-messages',flag:'tide_messages',title:'The words the wind took',chapter:8,where:'palewind',text:'Meet Venn in Palewind Village. Clear the roost. Return the three messages to their correct address boxes.'},
 {id:'tide-forecast',flag:'tide_forecast',title:'A forecast we can change',chapter:9,where:'stormloom',text:'Finish the shelter, water, and message missions. Reach the Stormloom. Pass its gate and help Ciel stop the Weather Heart.'},
 {id:'tide-home',flag:'tide_finished',title:'No one carries the weather',chapter:9,where:'gullwake',text:'Return to Nell after the Weather Heart is calm. Choose the new coast charter and hear the final letters.'}
];
const side=[
 {id:'return-address',flag:'tide_side_letter',start:'tide_letter_started',title:'Return to sender',where:'gullwake',text:'Ask Nell about a lost packet. Find it in Rainweald after clearing its nest. Read Ivo’s old letter and bring his reply to Nell.',reward:'Courier Knot · Quickstep · 220 crowns'},
 {id:'gentle-giant',flag:'tide_side_glassback',start:'tide_glassback_started',title:'Room for a gentle giant',where:'glasswater',text:'After the locks run, ask Daro about the Glassback. Clear its shell of old wire, then speak with Daro.',reward:'Breakwater Knot · 240 crowns'},
 {id:'unfinished-lesson',flag:'tide_side_lesson',start:'tide_lesson_started',title:'An unfinished lesson',where:'palewind',text:'Help Venn finish Orrin’s old lesson. Visit Iria at Whitewake, then Mara at Ember Foundry. Return to Venn with both notes.',reward:'Windglass Thread · 260 crowns'},
 {id:'far-lantern',flag:'tide_side_lantern',start:'tide_lantern_started',title:'The light beyond the map',where:'lastlight',text:'After the new coast ending, read Nell’s Lastlight notice. Fly to Lastlight Isle. Help Osa clear the warden and tend its lamp.',reward:'Dawnwatch Knot · 350 crowns'}
];
const gear={
 'courier-knot':{name:'Courier Knot',owner:'ivo',ability:'quickstep',skill:'Quickstep',need:24,atk:20,desc:'Adds 20 Attack. Quickstep advances each other living ally’s ATB gauge by 35%.'},
 'rain-prism':{name:'Rain Prism',owner:'mina',ability:'rekindle',skill:'Rekindle',need:24,atk:16,desc:'Adds 16 Attack. Rekindle revives one fallen ally. Learn it with 24 AP.'},
 'breakwater-knot':{name:'Breakwater Knot',owner:'orrin',atk:26,def:6,desc:'Adds 26 Attack and 6 Defense. Old wire made into something that protects.'},
 'windglass-thread':{name:'Windglass Thread',owner:'ivo',atk:35,desc:'Adds 35 Attack. A joint work by Venn, Mara, and a guard who learned to ask.'},
 'storm-prism':{name:'Storm Prism',owner:'mina',atk:32,desc:'Adds 32 Attack. Its light changes with the weather.'},
 'dawnwatch-knot':{name:'Dawnwatch Knot',owner:'orrin',atk:34,def:8,desc:'Adds 34 Attack and 8 Defense. A lamp needs a keeper. A keeper needs a rest.'},
 'horizon-ribbon':{name:'Horizon Ribbon',owner:'ivo',atk:40,desc:'Adds 40 Attack. The prize for a full three-round Lantern League run.'}
};
const flags=[...main.map(q=>q.flag),...side.flatMap(q=>[q.flag,q.start]),'tide_shelter_started','tide_water_started','tide_messages_started','tide_packet_read','tide_iria_note','tide_mara_note','tide_ciel_met','tide_trial_prize','tide_cache_gullwake','tide_cache_rainweald','tide_cache_palewind','tide_record_rain','tide_record_lock','tide_record_wind'];
const trials=['trial-squall','trial-downpour','trial-horizon'];
const encounters=['rainweald-pack','lockjaw-engine','palewind-roost','stormloom-gate','weather-heart','returning-letter','glassback','lastlight-warden',...trials];
const places=['gullwake','rainweald','glasswater','palewind','stormloom','lastlight'];
const npcs={
 nell:{name:'Nell',cloth:'#d39374',hair:'#413844',skin:'#bd8668',outfit:'coat'},
 tova:{name:'Tova',cloth:'#659792',hair:'#b8b39c',skin:'#845b46',outfit:'tunic'},
 daro:{name:'Daro',cloth:'#719ea7',hair:'#514237',skin:'#be926f',outfit:'coat'},
 venn:{name:'Venn',cloth:'#b4a16c',hair:'#3a3649',skin:'#996b52',outfit:'coat'},
 ciel:{name:'Ciel',cloth:'#9284b3',hair:'#ddd2b1',skin:'#bb876b',outfit:'robe'},
 osa:{name:'Osa',cloth:'#85a7a1',hair:'#d9dcce',skin:'#956c57',outfit:'coat'}
};
const node=(id,label,kind,p,extra={})=>({id,label,kind,p,...extra});
const talk=(id,p)=>node(id,npcs[id].name,'talk',p,{portrait:id});
const fight=(id,label,p=[650,403],extra={})=>node('battle:'+id,label,'fight',p,{battle:id,...extra});
const rest=()=>node('camp-rest','Pip · Rest & save','save',[830,465]);
const cache=(id,p)=>node('tide-cache:'+id,'Travel cache','chest',p,{cacheFlag:'tide_cache_'+id});
const record=(id,p)=>node('tide-record:'+id,'A coast record','sign',p);
const room=(name,sub,art,nodes)=>({name,sub,art,spawn:[175,439],floor:[[55,390],[235,330],[731,330],[892,383],[925,512],[40,512]],nodes:[node('to-overworld','The Lantern Roads','exit',[83,448]),...nodes]});
const rooms={
 gullwake:room('Gullwake Port','Every new road needs an address','gullwake',[talk('nell',[634,378]),node('tide-board','Coast work board','sign',[442,366]),node('tide-trials','Lantern League','cards',[317,415]),node('campaign-shop','Supplies & equipment','cards',[743,417]),cache('gullwake',[510,478]),rest()]),
 rainweald:room('Rainweald Shelter','A dry place to begin again','rainweald',[talk('tova',[333,382]),fight('rainweald-pack','The flooded path',[663,397]),node('tide-shelter-work','Build the shelter','puzzle',[478,418]),fight('returning-letter','The lost packet',[720,470],{showFlag:'tide_letter_started'}),node('tide-packet','Read the old packet','sign',[578,468],{showDefeated:'returning-letter'}),cache('rainweald',[232,472]),record('rain',[468,350]),rest()]),
 glasswater:room('Glasswater Locks','There must be enough for everyone','glasswater',[talk('daro',[335,392]),fight('lockjaw-engine','Lockjaw Engine',[674,384]),node('tide-waterwork','Route the water','puzzle',[470,423]),fight('glassback','The tangled Glassback',[666,468],{showFlag:'tide_glassback_started'}),record('lock',[249,473]),rest()]),
 palewind:room('Palewind Village','A message arrives when someone can read it','palewind',[talk('venn',[338,389]),fight('palewind-roost','The wind roost',[657,381]),node('tide-mailwork','The three address boxes','puzzle',[475,421]),node('tide-lesson','Venn’s workbench','puzzle',[708,472]),cache('palewind',[241,472]),record('wind',[486,351]),rest()]),
 stormloom:room('The Stormloom','No chart can promise a perfect day','stormloom',[talk('ciel',[333,382]),fight('stormloom-gate','The pressure watch',[651,405]),fight('weather-heart','The Weather Heart',[681,369],{showDefeated:'stormloom-gate',kind:'boss'}),node('tide-forecast-desk','The forecast desk','sign',[476,431]),rest()]),
 lastlight:room('Lastlight Isle','Someone is awake beyond the horizon','lastlight',[talk('osa',[334,389]),fight('lastlight-warden','Lastlight Warden',[676,387],{kind:'boss'}),node('tide-lamp','The far lantern','puzzle',[478,416]),rest()])
};
C.main.push(...main);C.side.push(...side);C.flags.push(...flags);C.encounters.push(...encounters);C.assets.push(...places,'weather-heart');Object.assign(C.gear,gear);Object.assign(C.npcs,npcs);Object.assign(C.rooms,rooms);
function freshTide(){return {version:1,water:[0,0,0],shelter:[],mail:{},charter:null,trial:{active:false,round:0,turns:0},trialWins:0,trialBest:0};}
C.initial=()=>({...old.initial(),version:2,tide:freshTide()});
const whole=(n,max)=>Math.min(max,Math.max(0,Math.floor(Number(n)||0)));
C.normalize=value=>{const c=old.normalize(value),v=value?.tide||{},t=freshTide();c.version=2;t.water=[0,1,2].map(i=>whole(v.water?.[i],4));t.shelter=Array.isArray(v.shelter)?[...new Set(v.shelter.filter(s=>['posts','canvas','drains'].includes(s)))]:[];for(const key of ['seed','school','mill'])if(['tova','daro','venn'].includes(v.mail?.[key]))t.mail[key]=v.mail[key];if(['council','circuit'].includes(v.charter))t.charter=v.charter;t.trialWins=whole(v.trialWins,9999);t.trialBest=whole(v.trialBest,99999);t.trial={active:v.trial?.active===true&&c.flags.tide_landing,round:whole(v.trial?.round,2),turns:whole(v.trial?.turns,99999)};for(const id of trials)delete c.defeated[id];c.tide=t;return c;};
function prepared(c){return ['tide_shelter','tide_water','tide_messages'].filter(k=>c.flags[k]).length;}
C.level=c=>c.flags.tide_finished?12:c.flags.tide_forecast?11:prepared(c)===3?11:prepared(c)>0?10:c.flags.tide_landing?9:old.level(c);
C.active=(q,c)=>{const f=c.flags;if(side.includes(q))return !!f[q.start];switch(q.flag){case 'tide_commission':return f.finale;case 'tide_landing':return f.tide_commission;case 'tide_shelter':case 'tide_water':case 'tide_messages':return f.tide_landing;case 'tide_forecast':return prepared(c)===3;case 'tide_finished':return f.tide_forecast;default:return old.active(q,c);}};
C.next=c=>C.main.find(q=>!c.flags[q.flag]&&C.active(q,c))||main.at(-1);
C.objective=c=>{const f=c.flags,d=c.defeated;if(!f.finale)return old.objective(c);if(!f.tide_commission)return 'A new letter waits at Saltmere. Speak with Captain Nessa.';if(!f.tide_landing)return 'Fly east to Gullwake Port. Speak with Nell at the post house.';if(f.tide_finished){const q=C.side.find(q=>q.id===c.tracked);return q&&!f[q.flag]&&C.active(q,c)?q.text:'The coast is open. Visit Lastlight Isle, finish side missions, or enter the Lantern League at Gullwake.';}if(f.tide_forecast)return 'Return to Nell in Gullwake Port. The coast is ready to choose its future.';if(d['weather-heart'])return 'Speak with Ciel at the Stormloom.';if(prepared(c)===3)return d['stormloom-gate']?'Stop the Weather Heart at the Stormloom.':'Reach the Stormloom. Meet Ciel and pass the pressure watch.';const q=[...main,...side].find(q=>q.id===c.tracked);return q&&!f[q.flag]&&C.active(q,c)?q.text:`Help Rainweald, Glasswater, and Palewind in any order. ${prepared(c)} / 3 coast projects are ready.`;};
C.gate=(id,c)=>{if(!places.includes(id))return old.gate(id,c);if(!c.flags.finale)return 'The Unwritten Tide starts after the Lantern Roads ending.';if(!c.flags.tide_commission)return 'Speak with Captain Nessa at Saltmere. She has the new coast bearing.';if(!c.flags.airship)return 'Paperwing can cross the open sea to this coast.';if(id!=='gullwake'&&!c.flags.tide_landing)return 'Meet Nell at Gullwake Port before you explore the coast.';if(id==='stormloom'&&prepared(c)!==3)return 'Finish the shelter, water, and message missions before you climb to the Stormloom.';if(id==='lastlight'&&!c.flags.tide_finished)return 'Lastlight opens after the Unwritten Tide ending. Return to Nell first.';return null;};
function flow(values){const [homes,garden,spill]=values.map(v=>whole(v,4)),mill=6-homes-garden-spill;return {homes,garden,spill,mill,valid:homes>=2&&garden>=2&&spill>=1&&mill>=1,overflow:Math.max(0,-mill)};}
C.tide={main,side,gear,flags,encounters,places,npcs,trials,prepared,flow,fresh:freshTide};
})(typeof window!=='undefined'?window:globalThis);
