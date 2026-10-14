/* Cinder Choir. Original maps, character art, effects, and music.
 * All game-buffer art uses the my-3D2dge public pixel and render API.
 * The imported motion set is Quaternius CC0. Engine sources are unchanged. */
(() => {
'use strict';
const CC = globalThis.CC = globalThis.CC || {}, E = My3D2dge, px = E.px;
const W = {};
const THEMES = {
 harbor: {sky:['#101c30','#355261','#be9478'],floor:'#526b70',dark:'#3a5059',light:'#698389',wall:'#668083',roof:'#376170',water:'#183c51',accent:'#e5ba79',nature:false},
 mine: {sky:['#090e23','#273548','#564c68'],floor:'#414657',dark:'#333749',light:'#585a6d',wall:'#5c5d72',roof:'#44445a',water:'#162033',accent:'#77c9d5',nature:false},
 forest: {sky:['#132a36','#365957','#b1b080'],floor:'#47624c',dark:'#334d43',light:'#668263',wall:'#455f48',roof:'#436747',water:'#255365',accent:'#c8dfa1',nature:true},
 rail: {sky:['#141c31','#493952','#c87858'],floor:'#605651',dark:'#463c42',light:'#837268',wall:'#67747b',roof:'#3e5a68',water:'#24323a',accent:'#e8b972',nature:false},
 opera: {sky:['#151226','#3c2547','#6e374e'],floor:'#71535d',dark:'#533c4c',light:'#96717a',wall:'#896778',roof:'#68425f',water:'#2a1c35',accent:'#ebc993',nature:false},
 citadel: {sky:['#171d37','#5a5669','#cda780'],floor:'#727785',dark:'#545b6e',light:'#9799a0',wall:'#929ba3',roof:'#405368',water:'#315869',accent:'#ecd196',nature:false},
 shore: {sky:['#20283e','#728692','#e2bc8a'],floor:'#b19a7e',dark:'#8b7e71',light:'#c8b798',wall:'#7f8384',roof:'#606570',water:'#315f70',accent:'#ffe0a1',nature:true},
 ruins: {sky:['#131a2d','#4b5063','#bf8176'],floor:'#615d68',dark:'#474957',light:'#7c7582',wall:'#736979',roof:'#595565',water:'#293c53',accent:'#ddac91',nature:false},
 archive: {sky:['#151728','#3f4456','#b38970'],floor:'#715f51',dark:'#4d4243',light:'#917d63',wall:'#76614e',roof:'#5d4246',water:'#282537',accent:'#efcf8c',nature:false},
 mountain: {sky:['#15273b','#627f91','#d8cfb8'],floor:'#697d7e',dark:'#4b6067',light:'#93a09b',wall:'#889da2',roof:'#697e85',water:'#263e57',accent:'#cde7da',nature:true},
 sky: {sky:['#1c314a','#617a87','#e3b485'],floor:'#6c666d',dark:'#4a4f5e',light:'#908487',wall:'#6c7e8a',roof:'#9b665e',water:'#617e93',accent:'#efcc8f',nature:false},
 void: {sky:['#0b0c21','#252b50','#77536f'],floor:'#48455f',dark:'#302f4c',light:'#696078',wall:'#6a5f7f',roof:'#504363',water:'#15142b',accent:'#b7d7ef',nature:false},
 undertide: {sky:['#061c30','#184956','#64918a'],floor:'#466e70',dark:'#284954',light:'#729895',wall:'#668d8d',roof:'#315d6c',water:'#103d52',accent:'#cde8b7',nature:false}
};
const DEPTH_PALETTES={
 bellhaven:{floor:'#687c7c',wall:'#71999c',roof:'#395d72',accent:'#f0c481'},
 kelpvault:{floor:'#476f60',wall:'#527969',roof:'#34574d',accent:'#b9d89b',nature:true},
 copperlung:{floor:'#706b60',wall:'#ac896c',roof:'#5c706e',accent:'#edbf89'},
 palewreck:{floor:'#706757',wall:'#76888c',roof:'#3c5c69',accent:'#c8dcce'},
 lumenreef:{floor:'#617282',wall:'#788ca5',roof:'#4c527b',accent:'#a8e8db',nature:true},
 driftcourt:{floor:'#617b79',wall:'#87a8a5',roof:'#47657b',accent:'#edd3a5'},
 nightcable:{floor:'#495e75',wall:'#5d798d',roof:'#323a60',accent:'#b7c9ed'},
 firstharbor:{floor:'#6a8274',wall:'#8caa99',roof:'#477073',accent:'#e5d5a0'}
};
W.themes = THEMES;
const hash = s => [...s].reduce((a,c) => ((a*31+c.charCodeAt(0))>>>0),7);
const center = (x,y) => ({x:x*16+8,y:y*16+8,z:0});
const props = (p,x,y,o={}) => ({type:p,...center(x,y),o});
W.heroStyles = {
 iona:{weapon:'staff',outfit:'coat',hair:'long',cape:{len:10,width:8,seg:2},colors:{skin:'#dabfa4',hair:'#e9ded0',cloth:'#448888',coat:'#317276',pants:'#364d60',boot:'#263945',trim:'#e8cb8e',cape:'#265b63',capeIn:'#6eb3ad',eye:'#edf4e6'}},
 brann:{weapon:'sword',outfit:'tunic',hair:'short',armor:true,hat:'band',colors:{skin:'#c99773',hair:'#493b39',cloth:'#8f5450',pants:'#4a4851',plate:'#8a9b9c',metal:'#c9d3c6',trim:'#d9b77c',boot:'#34343d'}},
 sable:{weapon:'sword',outfit:'coat',hair:'ponytail',hood:false,colors:{skin:'#bd917a',hair:'#292a43',cloth:'#75688f',coat:'#5e557d',pants:'#38394e',boot:'#272838',trim:'#bfcccf',glove:'#60617c'}},
 oren:{weapon:'gun',outfit:'coat',hair:'spiky',hat:{style:'cap',color:'#947347'},colors:{skin:'#b88566',hair:'#554436',cloth:'#bd8650',coat:'#a87847',pants:'#4e5b5a',boot:'#303d41',trim:'#eac985',metal:'#779b9c'}},
 mira:{weapon:'staff',outfit:'robe',hair:'long',colors:{skin:'#dbb3a2',hair:'#482f4b',cloth:'#ab788e',pants:'#5a415b',trim:'#f1d0a2',boot:'#3a2a43',metal:'#d7be84'}},
 tern:{weapon:null,outfit:'tunic',hair:'spiky',hat:'band',sleeves:'none',colors:{skin:'#a97859',hair:'#2a3c42',cloth:'#bd7053',pants:'#556475',glove:'#e0c596',boot:'#394554',trim:'#e5b86f'}},
 vale:{weapon:'staff',outfit:'robe',hair:'short',colors:{skin:'#866d56',hair:'#cfccc1',cloth:'#7b916d',pants:'#4d665a',boot:'#304b49',trim:'#d4c494',metal:'#afc7a5'}},
 rook:{weapon:'gun',build:'bulky',outfit:'coat',hair:'bald',armor:true,eyeGlow:'#80eff0',colors:{skin:'#8d9d9a',hair:'#64857e',cloth:'#637e80',coat:'#537574',pants:'#40565f',boot:'#2b404b',plate:'#9bada6',metal:'#d1c9ae',eye:'#7ff8dc',trim:'#e4bb74'}},
 nera:{weapon:'staff',outfit:'coat',hair:'ponytail',hat:'band',armor:true,colors:{skin:'#b88b68',hair:'#283f51',cloth:'#d2b575',coat:'#c39b54',pants:'#314959',boot:'#263748',plate:'#749e99',metal:'#b9c7ab',trim:'#e3b773',glove:'#806b4b'}},
 pax:{weapon:'staff',outfit:'coat',hair:'short',hat:{style:'cap',color:'#527c86'},cape:{len:8,width:7,seg:2},colors:{skin:'#a98165',hair:'#d6c9a8',cloth:'#bb955d',coat:'#9d7a4f',pants:'#3e5264',boot:'#293b4c',trim:'#91d2d2',cape:'#467280',capeIn:'#8ec6c1',metal:'#d9c798'}}
};
let motionLib;
W.rig = (id,size=1.06) => new E.Humanoid({size,build:'chibi',face:{eyes:'big'},...(W.heroStyles[id]||W.heroStyles.brann)});
// Residents have their own clothes and empty hands. Companion portraits keep
// the named hero rig. The index is stable; a save does not store cosmetic state.
W.npcRig = (index=0,job='listen') => {
 const n=Math.abs(Math.trunc(index)),cloth=['#8b6d68','#6d8c83','#9b875f','#6b7f96','#9b7890','#859367'][n%6];
 const work=['porter','repair','garden','cook'].includes(job),coat=['medic','lantern','clerk'].includes(job);
 return new E.Humanoid({size:.92+(n%3)*.035,build:'chibi',weapon:null,outfit:coat?'coat':work?'shirt':'tunic',hair:['short','long','ponytail','bald'][n%4],hat:work?{style:'cap',color:E.shade(cloth,-.12)}:undefined,sleeves:work?'short':'long',
  colors:{skin:['#b68869','#d0aa88','#8c6c59','#ddb9a2'][n%4],hair:['#49424a','#d3c6ac','#584231','#a78163'][n%4],cloth:job==='medic'?'#d0d5bd':cloth,coat:job==='medic'?'#c0ccb2':cloth,pants:'#455361',boot:'#303d49',trim:job==='medic'?'#789c8d':'#d1b98b',glove:'#b3aa91',eye:'#293a45'}});
};
W.residentKey=name=>String(name||'resident').split(',')[0].trim().toLowerCase();
W.residentJob=o=>{
 const explicit=o.npc?.activity||o.activity;if(explicit)return explicit;
 if(o.npc?.hero||CC.RPG?.heroes[o.speaker])return 'companion';
 const name=(o.npc?.name||o.speaker||o.label||'').toLowerCase();
 if(/cook|baker|meal|kitchen/.test(name))return 'cook';
 if(/clinic|healer|medic|nurse/.test(name))return 'medic';
 if(/gardener|seed|orchard|herb/.test(name))return 'garden';
 if(/mechanic|repair|maker|engineer|forewoman|lift chief|miner|stage hand|mend/.test(name))return 'repair';
 if(/porter|runner|carrier|dock worker|courier|ferryman|sailor|diver/.test(name))return 'porter';
 if(/clerk|tutor|student|archive|witness|record|cartographer|scribe/.test(name))return 'clerk';
 if(/singer|dancer|musician|performer/.test(name))return 'performer';
 if(/keeper|lantern|watch|usher/.test(name))return 'lantern';
 return 'listen';
};
W.missionRig=(o,world)=>{
 const speaker=String(o.speaker||''),key=speaker.toLowerCase(),hero=Object.keys(CC.RPG.heroes).find(id=>id===key||CC.RPG.heroes[id].name.toLowerCase()===key);
 if(hero){o.job='companion';return W.rig(hero);}
 const npc=(world?.place.npcs||[]).find(n=>{const full=n.name.toLowerCase();return key&&(full===key||full.split(',')[0]===key||full.startsWith(key+',')||full.endsWith(' '+key));});
 o.job=W.residentJob(npc?{npc}:o);return W.npcRig(hash(W.residentKey(npc?.name||speaker||o.label)),o.job);
};
W.motion = (rig,clip,t,weight=1) => {
 if(typeof Mocap==='undefined'||typeof window==='undefined'||!window.MOCAP?.CINDER)return false;
 motionLib ||= Mocap.load(window.MOCAP.CINDER);
 if(!rig.cinderMotion){Mocap.drive(rig,motionLib);rig.cinderMotion=true;}
 rig.mocap = motionLib.sample(motionLib.clip(clip),t);rig.mocapW=weight;return true;
};
W.clearMotion = rig => {rig.mocap=null;rig.mocapW=0;};

// Only porters take short steps. Their home never changes. Every step must be
// on clear ground and leave all mission anchors and interaction points clear.
W.updateResident=(o,dt,time,hero,world,options={})=>{
 if(!o.rig)return;
 o.home ||= {x:o.x,y:o.y};o.job ||= W.residentJob(o);
 const phase=hash(o.id||o.npc?.name||o.label||'resident')%997/53,near=hero&&E.dist(hero,o)<58,still=options.reduceMotion===true;
 const before={x:o.x,y:o.y};
 if(o.type==='npc'&&o.job==='porter'&&!near&&!still){
  const target={x:o.home.x+Math.sin(time*.45+phase)*5,y:o.home.y+Math.sin(time*.3+phase)*3},step=Math.min(1,Math.max(0,dt)*2);
  const nx=o.x+(target.x-o.x)*step,ny=o.y+(target.y-o.y)*step;
  if(world.map.standable(nx,ny,0,4.4)&&Object.values(world.anchors||{}).every(p=>Math.hypot(p.x-nx,p.y-ny)>=27)&&world.objects.every(p=>p===o||p.type==='enemy'||Math.hypot(p.x-nx,p.y-ny)>=13)){o.x=nx;o.y=ny;}
 }
 const vx=dt>0?(o.x-before.x)/dt:0,vy=dt>0?(o.y-before.y)/dt:0,moving=Math.hypot(vx,vy)>.05;
 const want=near?Math.atan2(hero.y-o.y,hero.x-o.x):moving?Math.atan2(vy,vx):Math.PI/2+Math.sin(phase)*.35;
 o.facing=E.approachAng(o.facing??Math.PI/2,want,Math.max(0,dt)*4);
 if(near||moving||still)W.clearMotion(o.rig);
 else {
  const clip=o.job==='repair'||o.job==='garden'?'Fixing_Kneeling':o.job==='lantern'?'Idle_Lantern_Loop':o.job==='performer'?'Dance_Loop':'Idle_FoldArms_Loop';
  const sample=clip==='Fixing_Kneeling'?2.6+((time*.5+phase)%2.1):time+phase;
  W.motion(o.rig,clip,sample,.85);
 }
 o.rig.update(dt,{x:o.x,y:o.y,z:0,vx:moving?vx*3:0,vy:moving?vy*3:0,facing:o.facing,expr:near?'smile':undefined});
};

const FIELD_MARKERS={
 talk:['Talk','#aedbd0','talk'],inspect:['Inspect','#d9e4c3','lens'],collect:['Collect','#edc18a','box'],puzzle:['Solve','#dbb3e5','question'],
 signal:['Send signal','#92d5e1','signal'],battle:['Battle','#efaa96','swords'],deliver:['Deliver','#efc48a','deliver'],tune:['Tune','#d9b5e9','note'],
 sequence:['Set order','#b5c6ee','order'],repair:['Repair','#b1d7db','tool'],rescue:['Rescue','#c6e8a4','cross'],escort:['Escort','#bde2a6','people'],
 sort:['Sort','#e0ce9c','sort'],trail:['Follow trail','#d4dba0','trail'],allocate:['Share supplies','#e4cea0','balance'],circuit:['Connect wires','#a5e2df','bolt'],
 goal:['Briefing','#efd18c','flag'],record:['Read record','#bad3d2','page'],secret:['Read hidden record','#d2bee7','page']
};
W.markerStyle=o=>{
 const kind=o.regroup?'escort':o.type==='goal'?'goal':o.type==='local-lore'?(o.secret?'secret':'record'):o.kind||'talk',s=FIELD_MARKERS[kind]||FIELD_MARKERS.inspect;
 return {kind,label:s[0],color:s[1],glyph:s[2]};
};
W.drawMarkerGlyph=(g,x,y,glyph,color)=>{
 const line=(a,b,c,d,w=1)=>px.line(g,x+a,y+b,x+c,y+d,color,w),box=(a,b,c,d)=>px.rect(g,x+a,y+b,c,d,color),disc=(a,b,r)=>px.disc(g,x+a,y+b,r,color);
 if(glyph==='talk'){box(-4,-3,9,5);px.poly(g,[[x-3,y+1],[x-3,y+5],[x,y+1]],color);box(-2,-1,1,1);}
 else if(glyph==='lens'){disc(-1,-1,3);px.disc(g,x-1,y-1,1,'#1b3542');line(2,2,5,5,2);}
 else if(glyph==='box'||glyph==='deliver'){box(-4,-3,9,7);line(0,-3,0,3);px.line(g,x-4,y-1,x+4,y-1,'#263f4b');if(glyph==='deliver'){line(1,-5,5,-5);line(3,-7,5,-5);line(3,-3,5,-5);}}
 else if(glyph==='question'){line(-3,-3,-2,-5);line(-2,-5,2,-5);line(2,-5,3,-2);line(3,-2,0,0);box(0,0,1,2);box(0,4,1,1);}
 else if(glyph==='signal'){box(0,0,1,5);disc(0,-2,1);line(-3,-4,-4,-1);line(-4,-1,-3,2);line(3,-4,4,-1);line(4,-1,3,2);}
 else if(glyph==='swords'){line(-4,-5,4,4,2);line(4,-5,-4,4,2);line(-5,1,-1,5);line(1,5,5,1);}
 else if(glyph==='note'){box(0,-5,1,9);box(1,-5,4,2);disc(-2,3,2);}
 else if(glyph==='order'){for(let i=0;i<3;i++){const a=-5+i*4;line(a,-3,a+3,0);line(a+3,0,a,3);}}
 else if(glyph==='tool'){line(-4,4,3,-3,3);line(1,-5,1,-2);line(1,-2,4,-2);line(4,-2,5,-5);}
 else if(glyph==='cross'){box(-1,-5,3,11);box(-5,-1,11,3);}
 else if(glyph==='people'){disc(-3,-3,2);disc(3,-1,2);box(-5,0,4,5);box(1,2,4,4);}
 else if(glyph==='sort'){for(let i=0;i<3;i++){box(-5,-4+i*4,4,2);box(2,-4+i*4,4,2);}line(0,-3,0,3);}
 else if(glyph==='trail'){line(-4,4,0,-2);line(0,-2,4,2);disc(-4,4,1);disc(0,-2,2);disc(4,2,1);}
 else if(glyph==='balance'){line(0,-5,0,5);line(-4,-3,4,-3);line(-5,-3,-5,1);line(5,-3,5,1);line(-6,2,-3,2);line(3,2,6,2);line(-3,5,3,5);}
 else if(glyph==='bolt')px.poly(g,[[x+1,y-6],[x-4,y+1],[x,y+1],[x-1,y+6],[x+5,y-2],[x+1,y-2]],color);
 else if(glyph==='flag'){line(-3,-5,-3,6);px.poly(g,[[x-2,y-5],[x+5,y-5],[x+2,y-2],[x+5,y+1],[x-2,y+1]],color);}
 else if(glyph==='page'){box(-4,-5,9,11);for(let i=0;i<3;i++)px.line(g,x-2,y-3+i*3,x+2,y-3+i*3,'#263f4b');}
};
W.drawFieldMarker=(r,o,time,options={})=>{
 const style=W.markerStyle(o),record=o.type==='local-lore',z=record?32:46,[sx,sy]=r.w(o.x,o.y,z);
 if(sx<10||sx>r.W-10||sy<10||sy>r.H-10)return false;
 if(options.ring!==false&&!record)r.groundRing(o.x,o.y,o.type==='goal'?11:12,style.color,.45);
 r.overlay(g=>{
  const x=Math.round(sx),y=Math.round(sy+(r.game.reduceMotion?0:Math.sin(time*2.4)*1));
  px.rect(g,x-8,y-8,17,17,'#142b39');px.rect(g,x-7,y-7,15,15,'#2b4653');px.line(g,x-6,y-7,x+6,y-7,style.color);px.poly(g,[[x-3,y+8],[x,y+11],[x+3,y+8]],style.color);
  W.drawMarkerGlyph(g,x,y,style.glyph,style.color);
 });return true;
};
W.drawNavigationMarker=(r,o,time,bounds={})=>{
 if(!o)return false;const style=W.markerStyle(o),[sx,sy]=r.w(o.x,o.y,46),left=(bounds.left||0)+18,right=(bounds.right??r.W)-18,top=(bounds.top||0)+18,bottom=(bounds.bottom??r.H)-18;
 if(sx>=left&&sx<=right&&sy>=top&&sy<=bottom)return false;
 const cx=(left+right)/2,cy=(top+bottom)/2,dx=sx-cx,dy=sy-cy,k=Math.min((right-left)/2/Math.max(1e-6,Math.abs(dx)),(bottom-top)/2/Math.max(1e-6,Math.abs(dy))),x=Math.round(cx+dx*k),y=Math.round(cy+dy*k),a=Math.atan2(dy,dx),c=Math.cos(a),s=Math.sin(a);
 r.overlay(g=>{px.disc(g,x,y,8,'#162c3b');W.drawMarkerGlyph(g,x,y,style.glyph,style.color);const ax=x+c*11,ay=y+s*11;px.poly(g,[[ax+c*4,ay+s*4],[ax-s*3-c*2,ay+c*3-s*2],[ax+s*3-c*2,ay-c*3-s*2]],style.color);});return true;
};

// Authored rooms, gates, and routes. Their collision also drives the mission map.
const localMaps=new Map();
W.build = (place,act=1,state={flags:{},chests:[]}) => {
 const layout=CC.Atlas.build(place,act,state), source=DEPTH_PALETTES[place.id]?{...THEMES.undertide,...DEPTH_PALETTES[place.id]}:THEMES[place.theme]||THEMES.harbor;
 const t=act===2?{...source,sky:source.sky.map((c,i)=>E.mix(c,['#152139','#626171','#c5a491'][i],.24)),floor:E.mix(source.floor,'#73717e',.15)}:source;
 const {rows,width,height}=layout,seed=hash(place.id),theme=place.theme,objects=[];
 const add=(type,point,data={})=>{if(!point)return;const o={type,id:place.id+':'+type+':'+objects.length,...point,...data};objects.push(o);return o;};
 const base=layout.base;
 add('exit',base.exit,{label:'Leave '+place.name});add('camp',base.camp,{label:'Waystone'});add('goal',base.goal,{label:'Field briefing'});
 (place.npcs||[]).forEach((npc,i)=>{if(!npc.hero||!state.party?.includes(npc.hero)){const job=W.residentJob({npc});add('npc',base.npcs[i],{npc,label:npc.name,job,rig:npc.hero?W.rig(npc.hero,.99):W.npcRig(hash(W.residentKey(npc.name||String(seed+i))),job)});}});
 if(place.shop!==undefined&&place.shop!==false&&place.kind==='town')add('shop',base.shop,{label:'Supply shop'});
 (place.chests||[]).forEach((reward,i)=>add('chest',base.chests[i],{reward,key:place.id+':chest:'+i,label:'Supply chest'}));
 if(place.kind!=='town')(place.encounters||[]).forEach((formation,i)=>{
  const point=base.enemies[i];add('enemy',point,{key:place.id+':'+act+':enemy:'+i,formation,label:'Enemy patrol',base:{...point},phase:(seed%100)/16+i});
 });
 for(const landmark of layout.landmarks||[])add('local-lore',landmark,{...landmark,key:place.id+':lore:'+landmark.id,label:landmark.label||landmark.title});
 const rgb=values=>Object.fromEntries(Object.entries(values).map(([k,v])=>[k,E.hex(v)]));
 const water=rgb({base:t.water,dark:E.shade(t.water,-.2),light:E.mix(t.water,t.accent,.25)}),plank=rgb({base:theme==='rail'?'#625550':'#806b56',dark:'#453e41',line:'#453e41'}),stage=rgb({base:'#987058',dark:'#634654',line:'#634654'});
 const stone={stones:[t.floor,E.mix(t.floor,t.light,.25),E.mix(t.floor,t.dark,.2)].map(E.hex),...rgb({mortar:t.dark,hi:t.light,lo:t.dark,speck:t.floor})},grass=rgb({base:t.floor,dark:t.dark,light:t.light,flower:act===1?'#dcbb87':'#b3c0c8'});
 const floor=(x,y,tag)=>{
  if(tag==='water')return E.tex.water(x,y,water);
  if(tag==='plank')return E.tex.planks(x,y,plank);
  if(tag==='stage')return E.tex.planks(x,y,stage);
  if(tag==='path'||!t.nature)return E.tex.flagstone(x,y,stone);
  return E.tex.grass(x,y,grass);
 };
 const cacheKey=place.id+':'+act+':'+layout.signature;
 let map=localMaps.get(cacheKey);
 if(!map)map=new E.TileMap({rows:rows.map(row=>row.join('')),legend:{'#':1,H:2,b:3,G:4,':':{floor:'path'},'~':{floor:'water',block:true},'=':{floor:'plank'},S:{floor:'stage'}},types:{
  1:{h:22,top:t.roof,side:t.wall,face:'rock',roof:t.nature?'grass':'slab',cut:true,cutH:10},
  2:{h:theme==='archive'?24:38,top:t.roof,side:t.wall,face:theme==='archive'?'plank':theme==='harbor'?'timber':'plaster',roof:theme==='archive'?'slab':'tiles',cut:true,cutH:18},
  3:{h:12,top:t.roof,side:t.wall,face:theme==='opera'?'plank':'stone',roof:'slab'},
  4:{h:20,top:'#b18465',side:'#795b58',face:'plank',roof:'slab',cut:true,cutH:16}
 },floorTex:floor,ao:4});
 // Keep six recent collision maps. Local terrain draws only visible tiles.
 localMaps.delete(cacheKey);localMaps.set(cacheKey,map);if(localMaps.size>6)localMaps.delete(localMaps.keys().next().value);
 const effects=CC.Adventure.effects(state,place.id).flatMap(e=>layout.anchors[e.at]?[{...layout.anchors[e.at],...e}]:[]);
 return {...layout,map,place,theme:t,objects,props:layout.props||[],rows,width,height,seed,act,effects};
};

W.drawPlace = (r,world,state,time) => {
 const t=world.theme;
 r.sky(t.sky);CC.TerrainView.draw(r,world);world.map.queueWalls(r);
 for(const p of world.props)r.prop(p.type,p.x,p.y,p.z,p.o);
 for(const effect of world.effects||[])if(r.visible(effect.x,effect.y,0,70,85,75))W.drawOutcome(r,effect,r.game.reduceMotion?0:time);
 for(const o of world.objects)if(o.type==='npc'&&r.visible(o.x,o.y,0,30,60,25))W.drawResidentWork(r,o,r.game.reduceMotion?0:time);
 for(const gate of world.gates||[]){const cell=gate.tiles[Math.floor(gate.tiles.length/2)];if(cell){const x=cell[0]*16+8,y=cell[1]*16+8;r.prop('lamp',x,y,0,{size:.65,color:gate.open?'#7dd7b4':'#eab16c',light:gate.open});}}
 for(const o of world.objects){
  if(o.type==='enemy'||o.type==='npc'||o.type==='rescue')continue;
  if(o.type==='chest')r.prop('chest',o.x,o.y,0,{size:.85,open:state.chests.includes(o.key),color:'#b69163'});
  if(o.type==='camp'){
   r.prop('crystal',o.x,o.y,3,{size:.9,color:'#79ddd0',light:true});r.groundRing(o.x,o.y,12,'#75b7ab',.35);
   r.queue(o.x,o.y,35,g=>{const p=r.w(o.x,o.y,34+Math.sin(time*2)*2);px.poly(g,[[p[0],p[1]-3],[p[0]+3,p[1]],[p[0],p[1]+3],[p[0]-3,p[1]]],'#bdf5cf');},{emissive:true});
  }
  if(o.type==='goal'){
   r.prop('pillar',o.x,o.y,0,{size:.67,broken:true,color:t.wall});r.prop('crystal',o.x,o.y,10,{size:1.1,color:t.accent,light:true});
   W.drawFieldMarker(r,o,time);
  }
  if(o.type==='switch')r.prop('brazier',o.x,o.y,0,{size:1,color:state.flags[o.key]?'#74dfc8':'#ba8863',light:true});
  if(o.type==='shop'){r.prop('awning',o.x,o.y+6,0,{color:'#558c8d',size:1.1});r.prop('barrel',o.x-13,o.y,0,{size:.7});}
  if(o.type==='bells'){for(let i=-1;i<2;i++)r.prop('lantern',o.x+i*12,o.y,5,{size:1,color:['#d6a678','#99c7c3','#ba97cc'][i+1],light:true});}
  if(o.type==='local-lore'&&!state.adventure?.discoveries.includes(o.key+'@'+state.act))W.drawFieldMarker(r,o,time,{ring:false});
  if(o.type==='mission'){
   const prop=E.PROPS.includes(o.prop)?o.prop:'sign';
   if(!o.rig)r.prop(prop,o.x,o.y,0,{size:1,color:'#b9a073',light:['lamp','brazier','crystal'].includes(prop)});
   W.drawFieldMarker(r,o,time);
  }
  if(o.type==='exit'){r.prop('sign',o.x-15,o.y,0,{size:.85});r.textAt(o.x,o.y,4,'WORLD',t.accent);}
 }
 // Weather is light enough to leave the terrain clear.
 r.overlay(g=>{
  if(r.game.reduceMotion)return;
  const count=state.act===2?32:world.place.theme==='forest'?24:16;
  for(let i=0;i<count;i++){
   const h=E.hash2(i,world.seed),x=(i*67+time*(state.act===2?7:2)+h*100)%r.W,y=(h*r.H+time*(state.act===2?9:-5)+r.H*100)%r.H;
   if(world.place.undertide&&world.place.id!=='bellhaven'){const rise=(h*r.H-time*(7+i%5)+r.H*100)%r.H;px.blend(g,.26,'normal',()=>{px.disc(g,x,rise,i%3===0?2:1,'#9bd7d4');px.dot(g,x,rise,'#356271');});}
   else px.blend(g,.35,'normal',()=>px.rect(g,x,y,1+(i%4===0?1:0),1,state.act===2?'#cbbecb':world.place.theme==='forest'?'#d4d991':'#cfb796'));
  }
 });
};

W.drawResidentWork=(r,o,time)=>{
 const job=o.job||W.residentJob(o);if(['companion','listen','performer'].includes(job))return;
 const home=o.home||o;
 if(job==='porter'){r.prop('crate',home.x-10,home.y+4,0,{size:.36,color:'#a08968',hides:false});return;}
 if(job==='lantern'){r.prop('lantern',home.x+9,home.y+3,0,{size:.45,color:'#dbbd83',light:true,hides:false});return;}
 if(job==='garden'){r.prop('pot',home.x-11,home.y+4,0,{size:.5,color:'#a8896a',hides:false});r.prop('flowers',home.x-11,home.y+4,5,{size:.4,color:'#bad4a1',hides:false});return;}
 r.queue(home.x-9,home.y+4,9,g=>{
  const p=r.w(home.x-10,home.y+4,0),x=Math.round(p[0]),y=Math.round(p[1]);
  if(job==='repair'){px.rect(g,x-5,y-3,10,5,'#b3936f');px.line(g,x-3,y-5,x+3,y+1,'#d8ddd0',2);px.disc(g,x+3,y-5,2,'#637d81');}
  else if(job==='cook'){px.ell(g,x,y-2,5,3,'#baa98b');px.rect(g,x-5,y-5,10,4,'#556e73');px.ell(g,x,y-5,5,2,'#dfa269');for(let i=0;i<2;i++)px.line(g,x-2+i*4,y-9,x-3+i*4+Math.sin(time*2+i),y-13,'#b7c8bd');}
  else if(job==='medic'){px.rect(g,x-5,y-6,10,8,'#cad6ba');px.rect(g,x-1,y-5,2,6,'#577f75');px.rect(g,x-3,y-3,6,2,'#577f75');}
  else {px.rect(g,x-6,y-5,12,7,'#dfd0a8');px.line(g,x,y-5,x,y+1,'#667d7c');for(let i=0;i<2;i++)px.line(g,x-4,y-3+i*2,x-2,y-3+i*2,'#798579');}
 },{hides:false});
};

// Small original pixel scenes make completed work visible in the field.
W.drawOutcome=(r,o,time)=>{
 const color={water:'#6fc6d4',power:'#bfe7ad',garden:'#92c991',shelter:'#d7bb83',bridge:'#bf9b70',record:'#eee0b3',lantern:'#ffcf8c',machine:'#93c7be',roof:'#c58165',clinic:'#b9dcc0',market:'#e2bd80',workshop:'#a5c9cb',route:'#dfd097',memorial:'#c8bfda',ferry:'#91c9ce',meal:'#e7bf8a',music:'#d3b9d9'}[o.kind]||'#bdcfb5';
 const variant=o.variant||o.label?.toLowerCase()||'';
 r.groundRing(o.x,o.y,13,color,.18);
 if(o.kind==='garden'){
  for(let i=0;i<5;i++)r.prop(i%2?'flowers':'bush',o.x-13+i*6,o.y+7+(i%2)*5,0,{size:.55,color,light:false});return;
 }
 if(o.kind==='shelter'||o.kind==='roof'){
  r.prop('awning',o.x,o.y+9,0,{size:1.35,color:o.kind==='roof'?'#ae6c57':'#688e84'});r.prop('crate',o.x-15,o.y,0,{size:.6});return;
 }
 if(o.kind==='lantern'){
  for(let i=-1;i<2;i++)r.prop('lantern',o.x+i*11,o.y+3,4,{size:.8,color,light:true});return;
 }
 if(o.kind==='market'){r.prop('awning',o.x,o.y+8,0,{size:1.05,color:'#ad8862'});for(const dx of[-16,16])r.prop('barrel',o.x+dx,o.y+2,0,{size:.56,color:'#8d765c'});}
 if(o.kind==='clinic')r.prop('awning',o.x,o.y+14,0,{size:1.05,color:'#6f9589'});
 r.queue(o.x,o.y,22,g=>{
  const p=r.w(o.x,o.y,2),x=Math.round(p[0]),y=Math.round(p[1]);
  if(o.kind==='meal'){
   const cart=/cart/.test(variant),wide=cart?14:21;
   if(cart)for(const dx of[-10,10]){px.disc(g,x+dx,y+3,4,'#243d49');px.disc(g,x+dx,y+3,2,'#b3bbad');}
   else for(const dx of[-16,16]){px.rect(g,x+dx-1,y-2,3,10,'#65554c');px.rect(g,x+dx-6,y+5,12,3,'#b09069');}
   px.rect(g,x-wide,y-11,wide*2,11,'#9b7653');px.rect(g,x-wide-2,y-13,wide*2+4,3,'#dec694');
   for(const dx of cart?[-6,6]:[-13,0,13]){px.ell(g,x+dx,y-13,4,2,'#e8e1c1');px.disc(g,x+dx,y-14,2,'#b58a5b');}
   px.rect(g,x-5,y-22,10,8,'#44636d');px.ell(g,x,y-22,6,2,'#d29c66');for(let i=0;i<3;i++){const yy=y-26-i*3;px.line(g,x-2+Math.sin(time*1.4+i)*2,yy,x+1,yy-2,'#c9d7c2');}
   if(cart){px.line(g,x-14,y-22,x-14,y-8,'#cbbb8f');px.poly(g,[[x-18,y-24],[x+16,y-24],[x+13,y-29],[x-15,y-29]],'#73a29a');}
  }else if(o.kind==='music'){
   const touring=/tour|cart/.test(variant);
   if(touring){for(let i=0;i<3;i++){px.rect(g,x-22,y-5-i*4,31,3,i%2?'#b39272':'#d0b68a');px.dot(g,x-18,y-4-i*4,'#4f5960');}px.rect(g,x+12,y-14,13,18,'#6c6673');px.rect(g,x+15,y-18,7,4,'#b5baaa');px.line(g,x+13,y-5,x+23,y-5,'#b9a5a7');}
   else {px.rect(g,x-24,y-2,48,8,'#8b6d62');px.rect(g,x-24,y-5,48,4,'#c2a282');for(let i=-19;i<23;i+=8)px.line(g,x+i,y-5,x+i,y-2,'#66565b');for(const dx of[-17,17]){px.rect(g,x+dx-5,y+7,10,3,'#b99e7a');px.rect(g,x+dx-4,y+10,2,5,'#686061');px.rect(g,x+dx+3,y+10,2,5,'#686061');}}
   const stand=touring?-7:0;px.line(g,x+stand,y-23,x+stand,y-3,'#9eb7b0',2);px.line(g,x+stand,y-3,x+stand-6,y+2,'#9eb7b0');px.line(g,x+stand,y-3,x+stand+6,y+2,'#9eb7b0');px.poly(g,[[x+stand-10,y-28],[x+stand+10,y-28],[x+stand+8,y-18],[x+stand-8,y-18]],'#d6d5b2');for(let i=0;i<2;i++)px.line(g,x+stand-6,y-25+i*4,x+stand+5,y-25+i*4,'#607f80');
   const yy=y-35-Math.sin(time*1.4)*2;W.drawMarkerGlyph(g,x+22,yy,'note',color);
  }else if(o.kind==='workshop'){
   const piano=/piano|whole/.test(variant);px.rect(g,x-20,y-9,40,5,'#c6a57c');for(const dx of[-16,16])px.rect(g,x+dx,y-4,3,11,'#615a53');
   if(piano){px.rect(g,x-16,y-25,32,16,'#775764');px.rect(g,x-14,y-16,28,5,'#e9ddbd');for(let i=-13;i<14;i+=4)px.rect(g,x+i,y-16,2,3,'#353e4b');px.line(g,x-16,y-25,x+16,y-25,'#d2a293');}
   else if(variant==='parts'){px.rect(g,x-16,y-19,24,10,'#567780');px.rect(g,x-14,y-15,20,4,'#e1dfbc');for(let i=-12;i<7;i+=4)px.rect(g,x+i,y-15,2,2,'#374a55');px.rect(g,x+12,y-19,10,10,'#796775');px.rect(g,x+14,y-22,6,3,'#c8c7ab');}
   else {for(const dx of[-12,10]){px.disc(g,x+dx,y-14,5,'#597981');px.disc(g,x+dx,y-14,2,'#cbd4b6');}px.line(g,x-3,y-19,x+3,y-12,'#d6dfc9',2);px.rect(g,x-7,y-23,17,4,'#a48161');px.rect(g,x+15,y-19,3,10,'#799d97');}
  }else if(o.kind==='market'){
   px.rect(g,x-18,y-9,36,12,'#a4865f');for(let i=0;i<5;i++){const xx=x-14+i*7;px.rect(g,xx,y-14,5,7,i%2?'#7dafa0':'#ceaa72');px.rect(g,xx,y-16,5,2,'#dde0bc');}px.line(g,x-18,y-9,x+18,y-9,'#e8d096');
  }else if(o.kind==='clinic'){
   for(const dx of[-12,12]){px.rect(g,x+dx-8,y-8,16,15,'#415e69');px.rect(g,x+dx-7,y-7,14,10,'#cdd6bd');px.rect(g,x+dx-6,y-10,12,4,'#e3e4c7');px.line(g,x+dx-5,y+4,x+dx+5,y+4,'#76a494');}
   px.rect(g,x-5,y-28,10,13,'#ebdfba');px.rect(g,x-1,y-26,2,9,'#6d9787');px.rect(g,x-4,y-23,8,3,'#6d9787');
  }else if(o.kind==='route'){
   px.rect(g,x-2,y-27,4,35,'#a99673');px.rect(g,x-15,y-27,30,7,'#d6c391');px.poly(g,[[x+15,y-27],[x+20,y-23],[x+15,y-20]],'#d6c391');px.rect(g,x-12,y-15,26,6,'#88afa6');px.poly(g,[[x-12,y-15],[x-17,y-12],[x-12,y-9]],'#88afa6');
   for(let i=0;i<3;i++){const yy=y+9+i*5;px.line(g,x-4,yy,x,yy-2,'#dfe0b8');px.line(g,x,yy-2,x+4,yy,'#dfe0b8');}
  }else if(o.kind==='memorial'){
   px.rect(g,x-22,y-5,44,10,'#967c67');px.rect(g,x-21,y-25,42,3,'#c0ad89');px.rect(g,x-21,y-23,3,18,'#957e6a');px.rect(g,x+18,y-23,3,18,'#957e6a');
   px.poly(g,[[x-17,y-11],[x-5,y-11],[x-8,y-7],[x-14,y-7]],'#8da9ae');px.line(g,x-12,y-11,x-12,y-18,'#d5c698');px.poly(g,[[x-11,y-17],[x-6,y-12],[x-11,y-12]],'#bfcdae');
   px.rect(g,x-3,y-14,7,7,'#dad4b6');px.line(g,x+4,y-13,x+7,y-13,'#c9d5c1');px.line(g,x+7,y-13,x+7,y-9,'#c9d5c1');px.line(g,x+7,y-9,x+4,y-9,'#c9d5c1');
   px.rect(g,x+10,y-17,7,10,'#ba7f73');px.line(g,x+11,y-20,x+16,y-20,'#caab8d');px.line(g,x+11,y-20,x+11,y-16,'#caab8d');px.line(g,x+16,y-20,x+16,y-16,'#caab8d');px.rect(g,x-11,y+6,22,4,'#d9cead');
  }else if(o.kind==='ferry'){
   if(variant==='cradle'){px.rect(g,x-24,y-4,48,8,'#99795b');for(const dx of[-19,19]){px.line(g,x+dx,y-4,x+dx,y-23,'#b7c3ab',3);px.line(g,x+dx,y-23,x+dx-Math.sign(dx)*7,y-23,'#b7c3ab',2);px.disc(g,x+dx,y+6,3,'#456471');}for(let i=-12;i<=12;i+=12)px.line(g,x+i,y-4,x+i,y+3,'#c9b187');}
   else{px.ell(g,x,y+7,26,6,'#315c70');px.poly(g,[[x-26,y-9],[x+25,y-9],[x+17,y+6],[x-17,y+6]],'#8f6e51');px.line(g,x-26,y-9,x+25,y-9,'#d8bb87',2);for(const dx of[-12,0,12])px.line(g,x+dx,y-6,x+dx,y+2,'#c6ac7e',2);px.line(g,x-8,y-6,x-8,y-28,'#c0b58e');px.poly(g,[[x-7,y-27],[x+13,y-12],[x-7,y-12]],'#9dc5ba');for(let i=0;i<3;i++)px.line(g,x-20+i*15,y+10,x-13+i*15,y+10+Math.sin(time*1.7+i),color);}
  }else if(o.kind==='water'){
   px.rect(g,x-15,y-5,30,9,'#244b60');for(let i=0;i<4;i++)px.line(g,x-12+i*7,y-2,x-8+i*7,y-2+Math.sin(time*2+i),color);
   px.rect(g,x-17,y-15,5,19,'#9cb1a5');px.line(g,x-19,y-12,x-9,y-12,color,2);
  }else if(o.kind==='circuit'){
   px.rect(g,x-17,y-23,34,27,'#183d4c');px.rect(g,x-15,y-21,30,22,'#365d64');
   const route=[[-11,-15],[-3,-15],[-3,-7],[6,-7],[6,-15],[12,-15]];
   for(let i=1;i<route.length;i++)px.line(g,x+route[i-1][0],y+route[i-1][1],x+route[i][0],y+route[i][1],'#dfd192',2);
   for(const xx of [-11,12])px.disc(g,x+xx,y-15,2,xx<0?'#f0d095':'#86d3d7');
  }else if(o.kind==='record'){
   if(/shelf|lending/.test(variant)){
    const lending=/lending/.test(variant);px.rect(g,x-19,y-27,38,32,'#67554f');for(let i=0;i<2;i++){const yy=y-24+i*14;px.rect(g,x-16,yy,32,11,'#273f4d');for(let j=0;j<4;j++){const xx=x-14+j*8;px.rect(g,xx,yy+3,5,7,lending?['#9eb8a8','#d0b276'][j%2]:['#cbbb93','#a899be'][j%2]);if(lending)px.line(g,xx+1,yy+3,xx+4,yy+7,'#405e69');else px.rect(g,xx+1,yy+5,3,2,'#e3dfbf');}}
    if(lending){px.rect(g,x-21,y-1,42,5,'#b99c71');W.drawMarkerGlyph(g,x+23,y-17,'tool','#b5d5c8');}
   }else{px.rect(g,x-15,y-17,30,19,'#544955');px.rect(g,x-13,y-15,26,14,color);
    for(let i=0;i<3;i++){px.line(g,x-10,y-12+i*4,x-2,y-12+i*4,'#6b7880');px.line(g,x+2,y-12+i*4,x+10,y-12+i*4,'#6b7880');}}
  }else if(o.kind==='bridge'){
   for(let i=-2;i<3;i++){px.rect(g,x-15,y+i*3,30,2,color);px.dot(g,x-12,y+i*3,'#4d4850');px.dot(g,x+12,y+i*3,'#4d4850');}
  }else{
   px.rect(g,x-12,y-16,24,19,'#3c5861');px.rect(g,x-10,y-14,20,7,'#7b9a96');
   for(let i=0;i<3;i++)px.disc(g,x-6+i*6,y-11,1,color);
   const phase=time*1.6;px.disc(g,x,y-2,6,'#a1afa0');px.disc(g,x,y-2,3,'#416878');
   px.line(g,x-Math.cos(phase)*7,y-2-Math.sin(phase)*7,x+Math.cos(phase)*7,y-2+Math.sin(phase)*7,color);
   if(o.kind==='power')px.blend(g,.3,'normal',()=>px.ddisc(g,x,y-11,15,color,.3));
  }
 });
};

W.makeMonster = (id,boss=false) => {
 const foe=CC.RPG.enemies[id];
 if(CC.Frontier?.enemyIds.includes(id)||CC.Undertide?.enemyIds.includes(id)){
  const color=foe.color,shape=foe.shape;
  return {type:'blob',frontier:true,undertide:!!CC.Undertide?.enemyIds.includes(id),baseId:id,shape,color,rig:new E.Blob({R:boss?15:8,colors:{base:color,dk:E.shade(color,-.4),lt:E.mix(color,'#f6e5c1',.35),spec:'#f8ecd0',eye:'#162f43',pupil:'#eeddac'},feet:!['wing','wisp','crystal','star'].includes(shape),mouth:shape==='plant'?'fangs':undefined})};
 }
 const human=/sentry|warden|cantor|regent|archivist|knight|conductor|guard|singer|chorister/.test(id);
 const col=boss?'#976380':/frost|glass|mirror/.test(id)?'#81b4c8':/ash|cinder|brass|iron/.test(id)?'#bd865e':/thorn|briar|mire|root/.test(id)?'#78945e':'#897bb2';
 if(human)return {type:'human',color:col,rig:new E.Humanoid({size:boss?1.75:1.1,build:boss?'bulky':'heroic',outfit:/cantor|singer|archiv/.test(id)?'robe':'coat',hat:boss?'crown':'helmet',armor:!(/cantor|singer|archiv/.test(id)),weapon:/cantor|singer|archiv/.test(id)?'staff':'sword',colors:{cloth:col,coat:col,pants:'#35374c',skin:'#9b9891',plate:E.mix(col,'#bfc2c2',.4),hair:'#e0cec1',trim:'#d6b77d',metal:'#c4cbd0'}})};
 return {type:'blob',color:col,rig:new E.Blob({R:boss?18:9,colors:{base:col,dk:E.shade(col,-.4),lt:E.mix(col,'#efdebb',.3),spec:'#f9e6bf',eye:'#211d35',pupil:'#efda8e'},horns:/root|wyrm|hound|star|heart/.test(id)||boss,wings:/moth|bat|kite|bird|wyrm|star/.test(id),ears:/hound|prowler/.test(id)?'cat':undefined,feet:true,tail:/worm|hound|wyrm/.test(id),mouth:'fangs'})};
};
W.drawMonster = (g,x,y,v,m,t,boss=false) => {
 if(m.frontier){W.drawReachMonster(g,x,y,v,m,t,boss);if(m.undertide)W.drawDepthMonster(g,x,y,m,t,boss);return;}
 if(boss&&m.type==='blob'){
  const col=E.tones(m.color),s=Math.sin(t*2.5);
  for(const side of [-1,1]){
   px.poly(g,[[x+side*15,y-22],[x+side*39,y-55-s*4],[x+side*31,y-19],[x+side*46,y-8],[x+side*22,y-3]],col.deep);
   px.line(g,x+side*16,y-20,x+side*38,y-51-s*4,col.lt,2);
  }
 }
 m.rig.draw(g,x,y,v);
 if(boss){const c=E.tones(m.color);for(let i=0;i<3;i++){let xx=x-8+i*8,yy=y-(m.type==='human'?68:49);px.poly(g,[[xx-4,yy+5],[xx,yy-4-Math.sin(t*2+i)*2],[xx+4,yy+5]],c.lt);}}
};
W.drawReachMonster=(g,x,y,view,m,t,boss)=>{
 const c=E.tones(m.color),k=boss?1.65:1,flap=Math.sin(t*2.8),bob=Math.sin(t*2)*2;
 const poly=points=>px.poly(g,points.map(([xx,yy])=>[x+xx*k,y+yy*k]),c.deep);
 if(m.shape==='wing')for(const side of [-1,1]){
  poly([[side*4,-17],[side*31,-29-flap*6],[side*24,-9],[side*13,-3]]);
  px.line(g,x+side*5*k,y-15*k,x+side*29*k,y-(27+flap*6)*k,c.lt,2);
  px.line(g,x+side*15*k,y-17*k,x+side*23*k,y-10*k,c.base);
 }
 if(m.shape==='plant')for(let i=0;i<5;i++){
  const a=i*Math.PI*.45+.15,dx=Math.cos(a)*23*k,dy=Math.sin(a)*8*k;
  px.line(g,x,y-7*k,x+dx,y+dy,c.deep,3);px.line(g,x+dx,y+dy,x+dx+flap*3,y+dy-10*k,c.base,2);
  px.poly(g,[[x+dx-5*k,y+dy-8*k],[x+dx+flap*3,y+dy-19*k],[x+dx+6*k,y+dy-11*k]],c.lt);
 }
 if(m.shape==='serpent')for(let i=5;i>0;i--){const xx=x-(i*7)*k,yy=y+Math.sin(t*2-i*.7)*4-5;px.disc(g,xx,yy,(7-i*.7)*k,i%2?c.base:c.deep);px.dot(g,xx,yy-3*k,c.lt);}
 if(['crystal','wisp','star'].includes(m.shape))for(let i=0;i<(m.shape==='star'?6:4);i++){
  const a=t*(m.shape==='star'?.35:-.3)+i*Math.PI*2/(m.shape==='star'?6:4),xx=x+Math.cos(a)*23*k,yy=y-18*k+Math.sin(a)*12*k;
  if(m.shape==='star')px.line(g,x,y-16*k,xx,yy,c.base);
  px.poly(g,[[xx-4*k,yy],[xx,yy-8*k-bob],[xx+4*k,yy],[xx,yy+4*k]],i%2?c.lt:c.base);
 }
 if(m.shape==='beetle')for(const side of [-1,1])for(let i=0;i<3;i++){
  const yy=y-3-i*5;px.line(g,x+side*5,y-12,x+side*(13+i*2),yy,c.deep,2);px.line(g,x+side*(13+i*2),yy,x+side*(15+i*2),yy+4+Math.sin(t*5+i),c.lt);
 }
 if(m.shape==='machine'){
  for(const side of [-1,1]){px.rect(g,x+side*16*k-5*k,y-18*k,10*k,17*k,c.deep);for(let i=0;i<3;i++)px.line(g,x+side*16*k-4*k,y-i*5*k,x+side*16*k+4*k,y-i*5*k,c.lt);}
  px.rect(g,x-16*k,y-23*k,32*k,21*k,c.deep);px.rect(g,x-13*k,y-21*k,26*k,12*k,c.base);px.line(g,x-12*k,y-20*k,x+12*k,y-20*k,c.lt);
 }
 m.rig.draw(g,x,y+(m.shape==='wisp'?bob:0),view);
 if(m.shape==='machine'){px.rect(g,x-9*k,y-17*k,18*k,4*k,'#234956');for(let i=0;i<3;i++)px.rect(g,x+(-7+i*6)*k,y-16*k,3*k,2*k,i===Math.floor(t*2)%3?'#ffe5a3':'#8dc4b8');}
 if(m.shape==='beetle')px.line(g,x,y-20,x,y-7,'#e7e6c8');
 if(m.shape==='crystal')poly([[-7,-22],[0,-35-bob],[7,-22],[0,-15]]);
 if(m.shape==='star'){px.disc(g,x,y-17*k,5*k,'#f4dba4');px.disc(g,x,y-17*k,2*k,'#d28e78');}
};

// Original undersea silhouettes, on the public animated Blob base.
W.drawDepthMonster=(g,x,y,m,t,boss)=>{
 const c=E.tones(m.color),k=boss?1.7:1,id=m.baseId,bob=Math.sin(t*2);
 const line=(a,b,d,e,col=c.lt,width=1)=>px.line(g,x+a*k,y+b*k,x+d*k,y+e*k,col,width);
 if(['bellmedusa','siltwisp'].includes(id))for(let i=-2;i<=2;i++){
  const dx=i*5,s=Math.sin(t*2+i)*3;line(dx,-3,dx+s,8,c.base,2);line(dx+s,8,dx-s,15,c.lt);
 }
 if(['siltcrawler','trenchheart'].includes(id))for(let i=-2;i<=2;i++){
  line(i*7,-15,i*7+Math.sin(t+i)*2,-27-i%2*4,c.base,2);line(i*7,-23,i*7+5,-27,c.lt);
 }
 if(id==='pressurecrab')for(const side of [-1,1]){
  line(side*8,-10,side*23,-20,c.base,4);line(side*23,-20,side*30,-29,c.lt,3);line(side*23,-20,side*32,-17,c.lt,3);
 }
 if(id==='lamprey'){line(-27,-7,-36,-19,'#e7d894',2);line(-36,-19,-31,-23,'#a9e8df');px.disc(g,x+3,y-12,3,'#152a39');}
 if(id==='trenchkite')for(const side of [-1,1]){line(side*12,-14,side*34,-18+Math.sin(t*2)*5,'#bee7de');line(side*25,-20,side*29,-28,'#b8e0e5');}
 if(id==='chartshade')for(let i=0;i<3;i++){
  const xx=x+(i-1)*11,yy=y-25+Math.sin(t+i)*3;px.poly(g,[[xx-5,yy],[xx+5,yy-3],[xx+7,yy+5],[xx-4,yy+8]],i%2?c.lt:c.base);px.line(g,xx-2,yy+2,xx+3,yy+1,c.deep);
 }
 if(id==='brineguard'){px.rect(g,x-14,y-29,8,20,c.deep);px.rect(g,x-13,y-27,6,15,c.lt);line(-10,-30,-3,-35,'#d5ceaa',2);}
 if(id==='bellengine'){
  px.poly(g,[[x-24,y-34],[x-19,y-57],[x-10,y-65],[x+10,y-65],[x+19,y-57],[x+24,y-34]],c.deep);
  px.poly(g,[[x-19,y-36],[x-15,y-55],[x-8,y-60],[x+8,y-60],[x+15,y-55],[x+19,y-36]],c.base);
  px.line(g,x-22,y-34,x+22,y-34,c.lt,3);px.disc(g,x,y-40,5,'#82c7be');px.line(g,x,y-54,x,y-44,'#ead6a1');
 }
 if(id==='pearlwarden'){px.disc(g,x,y-44-bob*2,13,c.deep);px.disc(g,x,y-45-bob*2,10,c.lt);px.disc(g,x-3,y-48-bob*2,4,'#f1e6d1');for(const side of [-1,1])line(side*10,-18,side*25,-35,c.base,3);}
 if(id==='horizonmouth'){px.disc(g,x,y-29,12,'#162c43');px.disc(g,x,y-30,8,'#827493');px.line(g,x-7,y-31,x+7,y-31,'#e9d6ab',2);for(let i=0;i<4;i++){const a=t*.3+i*Math.PI*.5;line(Math.cos(a)*25,-20+Math.sin(a)*12,Math.cos(a)*34,-20+Math.sin(a)*18,'#b6d6e3');}}
};

W.battleField = theme => {
 const t=THEMES[theme]||THEMES.ruins;
 const backdrop=new E.Backdrop({sky:t.sky,moon:{x:.73,y:.19,r:17,color:t.accent},stars:theme==='void'?100:24,layers:[
  {kind:theme==='forest'?'forest':'mountains',color:E.mix(t.floor,'#24243e',.4),y:.46,height:.35,parallax:.06},
  {kind:['citadel','opera','harbor','rail','undertide'].includes(theme)?'castle':theme==='mine'?'stalactites':'forest',color:E.mix(t.dark,'#101729',.5),y:.66,height:.25,parallax:.12},
  {kind:'fog',color:t.light,y:.7,height:.1,parallax:.18,drift:2}
 ]});
 const map=new E.TileMap({rows:Array(24).fill('.'.repeat(28)),legend:{},types:{},floorTex:(x,y)=>E.tex.flagstone(x,y,{stones:[t.floor,E.mix(t.floor,t.dark,.3),E.mix(t.floor,t.light,.2)].map(E.hex),mortar:E.hex(t.dark),hi:E.hex(t.light),lo:E.hex(t.dark),speck:E.hex(t.floor)})});
 return {backdrop,map,theme:t};
};
W.drawBattle = (r,field,time) => {
 r.game.lights.enabled=true;r.game.lights.ambient=.78;
 field.backdrop.draw(r);CC.TerrainView.draw(r,field);
 for(const[x,y]of [[30,20],[420,20],[24,190],[418,184]])r.prop('pillar',x,y,0,{broken:y>100,size:y>100?.8:1.3,color:field.theme.wall});
 for(const x of [60,390])r.prop('brazier',x,35,0,{size:1.1,light:true});
 r.decal(()=>{r.groundRing(224,110,75,field.theme.accent,.12);r.groundRing(224,110,79,field.theme.accent,.1);});
};

W.drawTitle = (r,time,act=1) => {
 r.game.lights.enabled=false;
 const sky=['#090f21','#233b50','#657b83','#d7a079'];r.sky(sky);
 r.overlay(g=>{
  const ww=r.W,hh=r.H;
  const moonX=ww*.71,moonY=hh*.24;
  px.ddisc(g,moonX,moonY,70,'#b8d6cf',.14);px.disc(g,moonX,moonY,29,'#d3d3b1');px.disc(g,moonX+11,moonY-6,24,'#526673');
  for(let i=0;i<55;i++){const x=E.hash2(i,5)*ww,y=E.hash2(i,8)*hh*.53;px.blend(g,.3+.25*Math.sin(time*.8+i),'normal',()=>px.dot(g,x,y,'#dce3ce'));}
  const mountain=(base,amp,col,phase)=>{for(let x=0;x<ww;x++){const h=amp*(.5+.24*Math.sin(x*.025+phase)+.2*Math.sin(x*.057+phase));px.rect(g,x,base-h,1,hh-base+h,col);}};
  mountain(hh*.65,56,'#3d5665',2);mountain(hh*.75,40,'#2b424f',9);
  // The choir city. Stone towers and hanging copper voice conduits.
  const towers=[[.05,.73,34,60],[.16,.68,27,81],[.29,.77,43,50],[.41,.67,28,90],[.52,.76,35,53],[.66,.7,45,80],[.83,.69,35,100],[.95,.78,40,50]];
  towers.forEach(([x,y,w,h],i)=>{
   x*=ww;y*=hh;const c=i%2?'#243c48':'#2c4551';px.rect(g,x-w/2,y-h,w,h+hh,c);px.rect(g,x+w/2-2,y-h,2,h,'#6c8589');
   px.poly(g,[[x-w/2-4,y-h],[x,y-h-18],[x+w/2+4,y-h]],'#223642');
   px.line(g,x,y-h-18,x,y-h-32,'#657b80');px.disc(g,x,y-h-33,2,'#dbbf85');
   for(let yy=y-h+12;yy<y;yy+=13)for(let xx=x-w/2+7;xx<x+w/2-3;xx+=10)px.rect(g,xx,yy,3,5,(Math.floor(xx+yy+i)%3===0)?'#c8ab75':'#43575d');
  });
  for(let i=0;i<7;i++){const x=ww*(.07+i*.14),y=hh*.71;px.line(g,x,y-22,x+ww*.13,y-9,'#747b74',1);}
  px.rect(g,0,hh*.83,ww,hh*.17,'#172c37');
  for(let i=0;i<9;i++){const x=i*ww/8;px.rect(g,x,hh*.83,3,hh*.17,'#354b52');}
  for(let i=0;i<18;i++){const x=(i*43+time*6)%ww,y=hh*.78+Math.sin(time*.4+i)*28;px.blend(g,.5,'normal',()=>px.rect(g,x,y,1,2,'#e4c698'));}
  // Bridge foreground and the first light of a new journey.
  px.rect(g,0,hh-15,ww,15,'#101f2a');px.line(g,0,hh-16,ww,hh-16,'#60767b');
 });
};

// Original short themes. A motif moves between the title, towns and ending.
const melody='D5 - A4 - F5 - E5 - D5 - - - A4 - - - | C5 - G4 - E5 - D5 - C5 - - - G4 - - - | Bb4 - D5 - F5 - A5 - G5 - F5 - E5 - D5 - | A4 - C5 - E5 - G5 - F5 - E5 - D5 - - -';
const bass='D3 - - - A2 - - - D3 - - - A2 - - - | C3 - - - G2 - - - C3 - - - G2 - - - | Bb2 - - - F3 - - - Bb2 - - - F3 - - - | A2 - - - E3 - - - A2 - - - D3 - - -';
W.songs={
 title:{bpm:74,steps:2,tracks:[{wave:'triangle',vol:.17,notes:melody},{wave:'sine',vol:.16,notes:bass}]},
 town:{bpm:92,steps:2,tracks:[{wave:'pulse',vol:.075,notes:melody},{wave:'triangle',vol:.15,notes:bass},{wave:'sine',vol:.08,notes:'F4 - - - A4 - - - E4 - - - G4 - - - D4 - - - F4 - - - E4 - - - A4 - - -'}]},
 field:{bpm:116,steps:2,tracks:[{wave:'triangle',vol:.14,notes:melody},{wave:'pulse',vol:.07,notes:'D4 A4 D5 A4 F4 A4 D5 A4 C4 G4 C5 G4 E4 G4 C5 G4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 A3 E4 A4 E4 C4 E4 A4 E4'},{wave:'sine',vol:.17,notes:bass}]},
 dungeon:{bpm:74,steps:2,tracks:[{wave:'triangle',vol:.12,notes:'D3 - A3 - Bb3 - A3 - D3 - - - C3 - - - F3 - C4 - Db4 - C4 - F3 - - - E3 - - -'},{wave:'sine',vol:.14,notes:'D2 - - - - - - - C2 - - - - - - - Bb1 - - - - - - - A1 - - - - - - -'},{wave:'pulse',vol:.045,notes:'A4 . . . D5 . . . E5 . . . F5 . . . E5 . . . C5 . . . Bb4 . . . A4 . . .'}]},
 battle:{bpm:142,steps:4,tracks:[{wave:'pulse',vol:.10,notes:'D5 A4 D5 F5 E5 D5 A4 C5 D5 - F5 - A5 - F5 E5 | D5 A4 D5 F5 G5 F5 E5 D5 C5 - E5 - G5 - E5 C5 | Bb4 F4 Bb4 D5 F5 D5 C5 Bb4 A4 - C5 - E5 - C5 A4 | D5 E5 F5 A5 G5 F5 E5 C5 D5 - A4 - D5 - - -'},{wave:'triangle',vol:.22,notes:'D3 . D3 A2 D3 . D3 A2 C3 . C3 G2 C3 . C3 G2 Bb2 . Bb2 F2 Bb2 . Bb2 F2 A2 . A2 E2 A2 . A2 C3'},{wave:'drums',vol:.08,notes:'k . h . s . h h k . h . s . h .'}]},
 boss:{bpm:158,steps:4,tracks:[{wave:'saw',vol:.06,notes:'D4 D4 A4 D5 C5 Bb4 A4 F4 D4 . F4 . A4 . D5 . | Eb4 Eb4 Bb4 Eb5 Db5 C5 Bb4 Gb4 Eb4 . Gb4 . Bb4 . Eb5 . | D5 - A5 - F5 E5 D5 C5 Bb4 - F5 - D5 C5 Bb4 A4 | G4 A4 Bb4 C5 D5 E5 F5 G5 A5 - - - A4 - - -'},{wave:'triangle',vol:.21,notes:'D2 D3 D2 A2 D2 D3 D2 A2 Eb2 Eb3 Eb2 Bb2 Eb2 Eb3 Eb2 Bb2 Bb1 Bb2 Bb1 F2 Bb1 Bb2 Bb1 F2 A1 A2 A1 E2 A1 A2 A1 E2'},{wave:'drums',vol:.09,notes:'k h h k s h h h k h k h s h h h'}]},
 ruin:{bpm:64,steps:2,tracks:[{wave:'sine',vol:.17,notes:melody},{wave:'triangle',vol:.12,notes:bass}]},
 ending:{bpm:86,steps:2,tracks:[{wave:'triangle',vol:.15,notes:melody},{wave:'sine',vol:.18,notes:bass},{wave:'pulse',vol:.045,notes:'F4 - A4 - D5 - A4 - F4 - - - D4 - - - E4 - G4 - C5 - G4 - E4 - - - C4 - - - D4 - F4 - Bb4 - F4 - D4 - - - Bb3 - - - E4 - A4 - C5 - A4 - F4 - - - D4 - - -'}]}
};
// Original Far Reach themes use the engine's note sequencer.
W.songs.reach={bpm:82,steps:2,tracks:[{wave:'triangle',vol:.14,notes:'G4 - D5 - Bb4 - A4 - G4 - F4 - D4 - - - | Eb4 - Bb4 - G4 - F4 - Eb4 - D4 - C4 - - - | F4 - C5 - A4 - G4 - F4 - Eb4 - D4 - - - | D4 - A4 - C5 - Bb4 - A4 - F4 - G4 - - -'},{wave:'sine',vol:.16,notes:'G2 - - - D3 - - - G2 - - - D3 - - - | Eb2 - - - Bb2 - - - Eb2 - - - Bb2 - - - | F2 - - - C3 - - - F2 - - - C3 - - - | D2 - - - A2 - - - G2 - - - D3 - - -'}]};
W.songs.weather={bpm:106,steps:2,tracks:[{wave:'pulse',vol:.06,notes:'D4 A4 Eb5 A4 D4 A4 C5 A4 D4 A4 Bb4 A4 C4 G4 Bb4 G4 | Eb4 Bb4 E5 Bb4 Eb4 Bb4 Db5 Bb4 F4 C5 Eb5 C5 Eb4 Bb4 Db5 Bb4'},{wave:'triangle',vol:.15,notes:'D2 - D3 - D2 - A2 - C2 - C3 - C2 - G2 - | Eb2 - Eb3 - Eb2 - Bb2 - F2 - F3 - Eb2 - Bb2 -'},{wave:'sine',vol:.08,notes:'A4 - - - Bb4 - - - G4 - - - F4 - - - | Bb4 - - - C5 - - - Ab4 - - - G4 - - -'}]};
W.songs.bond={bpm:70,steps:2,tracks:[{wave:'sine',vol:.15,notes:'Bb4 - A4 - G4 - - - D5 - C5 - Bb4 - - - | G4 - F4 - Eb4 - - - A4 - G4 - F4 - - - | D4 - G4 - A4 - Bb4 - C5 - Bb4 - A4 - - - | G4 - D5 - Bb4 - A4 - G4 - - - - - - -'},{wave:'triangle',vol:.12,notes:'G2 - D3 - Bb3 - D3 - G2 - D3 - Bb3 - D3 - | Eb2 - Bb2 - G3 - Bb2 - F2 - C3 - A3 - C3 - | D2 - A2 - F3 - A2 - Eb2 - Bb2 - G3 - Bb2 - | G2 - D3 - Bb3 - D3 - G2 - - - - - - -'}]};
W.songs.undertide={bpm:66,steps:2,tracks:[{wave:'sine',vol:.17,notes:'E5 - - - B4 - G4 - A4 - - - B4 - - - | D5 - - - A4 - F4 - G4 - - - A4 - - - | C5 - E5 - B4 - G4 - A4 - C5 - G4 - - - | F4 - A4 - E5 - D5 - B4 - - - E5 - - -'},{wave:'triangle',vol:.11,notes:'E2 - - - B2 - - - E3 - - - B2 - - - | D2 - - - A2 - - - D3 - - - A2 - - - | C2 - - - G2 - - - C3 - - - G2 - - - | B1 - - - F2 - - - E2 - - - B2 - - -'}]};
W.songs.depthcourt={bpm:88,steps:2,tracks:[{wave:'triangle',vol:.14,notes:'G4 - B4 D5 E5 - D5 - B4 - A4 - G4 - - - | A4 - C5 E5 F5 - E5 - C5 - B4 - A4 - - - | B4 - D5 G5 F5 E5 - D5 C5 - B4 - A4 - - - | G4 - B4 D5 E5 - C5 - D5 - B4 - G4 - - -'},{wave:'sine',vol:.16,notes:'G2 - D3 - B3 - D3 - G2 - D3 - B3 - D3 - | A2 - E3 - C4 - E3 - A2 - E3 - C4 - E3 - | B2 - F3 - D4 - F3 - C3 - G3 - E4 - G3 - | D3 - A3 - F3 - A3 - G2 - D3 - G3 - - -'}]};
W.songs.depthbattle={bpm:136,steps:4,tracks:[{wave:'pulse',vol:.07,notes:'E5 B4 E5 G5 F5 E5 B4 D5 E5 - G5 - B5 A5 G5 F5 | D5 A4 D5 F5 E5 D5 A4 C5 D5 - F5 - A5 G5 F5 E5 | C5 G4 C5 E5 D5 C5 G4 B4 C5 - E5 - G5 F5 E5 D5 | B4 F4 B4 D5 C5 B4 A4 F4 E5 - B4 - E5 - - -'},{wave:'triangle',vol:.18,notes:'E2 E3 . B2 E2 E3 . B2 D2 D3 . A2 D2 D3 . A2 C2 C3 . G2 C2 C3 . G2 B1 B2 . F2 E2 B2 E3 .'},{wave:'drums',vol:.075,notes:'k . h h s . h . k h . k s . h .'}]};
CC.WORLD=W;
})();
