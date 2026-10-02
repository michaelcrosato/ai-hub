import { reviewedDetailedAsset, crownSimulationAsset } from './vehicle-source.js';
import { accordStudies } from './accord-studies.js';
/**
 * Curated, source-based adapters for Neon Fare at the pinned commit below.
 * These are reviewed translations of the named geometry functions, not a repo runtime.
 * No downloaded repository code is executed. Buildings are fixed lot samples.
 */
const NEON_SOURCE = {
  repository:'michaelcrosato/neon-fare-arcade-2',
  commit:'7838dee3fad90d743ed559097cda88d7c6d070a4',
  date:'2026-09-14',
  files:{
    'game/render/detailed-vehicles.ts':'85cdf03e65a81446fbdd0471209839a32e6936b1',
    'game/render/surfaces.ts':'e81d7618b8073823572999ca613df882c77343ff',
    'game/vehicles.ts':'38430eb226529ebb0e2d8091b952daf184c1c7cb',
    'game/city-buildings.ts':'6335aabb03d909180b0740c43664e8ca32131799',
    'game/config.ts':'cb847851f14f60af445025403bf9e857ff2987c4',
    'game/render/furnishings.ts':'757f36c060fb971afee1a28f7cb3b3ed8217fbd0',
    'game/render/accord.ts':'153be1017b3dd54a2c2213c1612bda6a5ee443b8',
    'game/render/scene.ts':'a4989597b7bfac6c45de409342e7022b12886781',
    'game/city-assets.ts':'017803eaf0721905cf1d93c0d44c1898070220ad'
  }
};
const NEON_PALETTE={
 PAPER:[.96,.91,.8,1],BONE:[.83,.78,.66,1],INK:[.035,.035,.035,1],YELLOW:[1,.72,0,1],RED:[.94,.12,.07,1],CYAN:[.05,.9,.95,1],WHITE:[1,.98,.9,1],LEAF:[.08,.31,.18,1],STEEL:[.27,.38,.42,1],BLUE:[.08,.42,.64,1],ORANGE:[.94,.34,.08,1]
};
const {PAPER,BONE,INK,YELLOW,RED,CYAN,WHITE,LEAF,STEEL,BLUE}=NEON_PALETTE;
const C={stone:[.82,.78,.65,1],cream:[.96,.9,.72,1],brick:[.63,.31,.23,1],ink:[.12,.19,.2,1],glass:[.17,.48,.53,1],teal:[.21,.63,.63,1],gold:[1,.73,.15,1],coral:[.9,.35,.24,1]};
function author(name,category,path,fn,params={}) {
 const parts=[],colliders=[];
 const add=(label,x,y,z,sx,sy,sz,color,material='MAT_BUILDING',extra={})=>{
   const p={id:`p${String(parts.length+1).padStart(3,'0')}`,name:label,group:extra.group||label.split(' / ')[0],kind:'box',position:[x,y,z],rotation:[extra.pitch||0,extra.tilt||0,extra.yaw||0],scale:[1,1,1],size:[sx,sy,sz],color:[...color],material,visible:true,locked:false,pivot:[x,y,z],sourceIndex:parts.filter(p=>p.kind==='box').length,sourceExtra:extra.sourceExtra||{}};
   if(extra.role)p.role=extra.role;
   parts.push(p);return p;
 };
 const face=(label,vertices,color,material='MAT_BUILDING')=>{
   const p={id:`p${String(parts.length+1).padStart(3,'0')}`,name:label,group:label.split(' / ')[0],kind:'mesh',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:vertices.map(v=>Array.isArray(v)?[...v]:[v.x,v.y,v.z]),faces:[vertices.map((_,i)=>i)],color:[...color],material,visible:true,locked:false,pivot:[0,0,0],sourceIndex:parts.filter(p=>p.kind==='mesh').length};
   parts.push(p);return p;
 };
 const finish=(notes=[])=>({schema:'neon.asset/1',id:'neon-'+fn.replace(/[^a-z0-9]/gi,'-').toLowerCase()+'-'+String(params.id||params.lot||name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,category,revision:0,units:'world-unit',upAxis:'Z',parts,colliders,source:{repository:NEON_SOURCE.repository,commit:NEON_SOURCE.commit,path,function:fn,parameters:params,mode:'curated-source-sample'},style:{name:'Neon Fare',palette:Object.values(NEON_PALETTE),shading:'flat',maxTriangles:4096},notes,history:[],references:[]});
 return {parts,colliders,add,face,finish};
}
function furnishingAsset(id){
 const names={'big-screen':'Big screen','stereo':'Stereo','washer':'Washing machine','microwave':'Microwave','fridge':'Refrigerator','coffee-maker':'Coffee maker','vacuum':'Vacuum cleaner','pantry':'Pantry','bookcase':'Bookcase','floor-lamp':'Floor lamp','rug':'Graphic rug','plant':'Potted plant','dining-set':'Dining set','sofa':'Sofa','bed-frame':'Bed frame','side-table':'Side table'};
 const a=author(names[id]||id,'Furniture','game/render/furnishings.ts','furnishingModel',{id});
 let count=0;const box=(x,y,z,sx,sy,sz,color,glow=false)=>a.add(`Shape ${++count}`,x,y,z,sx,sy,sz,color,glow?'MAT_SIGN':'MAT_BUILDING');
 switch(id){
 case 'big-screen':box(0,0,.65,1.1,4.5,.18,INK);box(0,0,1.6,.2,.4,1.8,INK);box(0,0,2.5,.28,4.4,2.5,INK);box(.16,0,2.5,.05,4,2.1,CYAN,true);break;
 case 'stereo':for(const y of [-.95,.95]){box(0,y,1.1,.8,.7,1.5,INK);box(.42,y,1.1,.06,.48,.68,YELLOW);}box(0,0,.8,.9,1,.5,STEEL);box(.47,0,.85,.05,.65,.13,CYAN,true);break;
 case 'washer':box(0,0,1.6,2.1,2.1,2.4,PAPER);box(0,-1.07,1.45,1.45,.08,1.45,STEEL);box(0,-1.13,1.45,1.05,.08,1.05,INK);box(0,-1.19,1.45,.72,.06,.72,CYAN);box(.3,-1.1,2.52,1.1,.1,.16,INK);break;
 case 'microwave':box(0,0,2.55,1.8,1.1,.95,PAPER);box(-.2,-.57,2.55,1.15,.1,.65,INK);box(-.2,-.64,2.55,.95,.05,.45,CYAN);box(.62,-.57,2.6,.15,.1,.42,INK);break;
 case 'fridge':box(0,0,2.45,2.3,2.3,4.1,STEEL);box(0,-1.2,1.9,2.2,.15,2.8,PAPER);box(0,-1.2,3.95,2.2,.15,1.2,PAPER);box(-.8,-1.32,2.5,.13,.12,.95,INK);box(-.8,-1.32,3.8,.13,.12,.55,INK);break;
 case 'coffee-maker':box(0,0,2.55,.65,.8,1.1,INK);box(0,-.05,3.15,.8,.95,.18,RED);box(0,-.42,2.36,.48,.4,.45,PAPER);box(0,-.45,2.64,.4,.25,.08,INK);break;
 case 'vacuum':box(0,0,.6,1.1,1.1,.35,INK);box(0,.2,1.3,.65,.7,1.15,RED);box(0,.4,2.3,.13,.15,1.5,STEEL);box(0,.4,3.05,.6,.2,.18,INK);break;
 case 'pantry':case 'bookcase':{const width=id==='pantry'?3:3.5;for(const x of [-width/2,width/2])box(x,0,2.2,.2,1,3.6,BONE);for(const z of [.65,1.7,2.8,3.9])box(0,0,z,width,1,.14,BONE);for(const [x,z,c] of [[-.7,1.15,RED],[.5,2.25,CYAN],[-.4,3.35,YELLOW]])box(x,0,z,.6,.7,.85,c);break;}
 case 'floor-lamp':box(0,0,.5,.85,.85,.13,INK);box(0,0,2,.13,.13,3,STEEL);box(0,0,3.5,1.4,1.4,.7,YELLOW);box(0,0,3.9,1,1,.15,PAPER);break;
 case 'rug':box(0,0,.5,8,5.3,.03,INK);for(const side of [-1,1])box(side*2,side*1.3,.52,3.8,2.45,.02,YELLOW);break;
 case 'plant':box(0,0,.85,1.3,1.3,.8,RED);box(0,0,1.28,1.5,1.5,.16,BONE);box(0,0,2,.12,.12,1.5,INK);box(-.35,0,2.35,1,.8,.55,LEAF);box(.35,0,2.75,.8,1,.65,LEAF);break;
 case 'dining-set':box(0,0,1.8,3.6,2.7,.22,BONE);box(0,0,1.05,1.2,1,1.5,INK);for(const side of [-1,1]){box(side*2.3,0,1.05,1,1.2,.18,RED);box(side*2.75,0,1.5,.15,1.2,1.1,RED);box(side*2.3,0,.7,.65,.75,.6,INK);}break;
 case 'sofa':box(0,0,.85,5.6,2.2,.8,INK);box(0,-.8,1.55,5.8,.5,1.35,RED);for(const side of [-1,1]){box(side*2.75,0,1.3,.55,2.3,1,RED);box(side*1.25,.05,1.35,2.2,1.45,.4,BONE);}break;
 case 'bed-frame':box(0,0,.65,5.75,7.6,.3,INK);box(0,-3.7,1.7,5.75,.35,2.3,BONE);for(const x of [-2.4,2.4])box(x,2.8,.5,.3,.3,.4,INK);break;
 case 'side-table':box(0,0,1.3,1.45,1.45,.18,BONE);box(0,0,.85,.65,.65,.9,INK);box(0,0,1.48,.5,.5,.16,CYAN);break;
 default:throw new Error('Unknown furnishing');
 }
 if(['washer','microwave','fridge','coffee-maker'].includes(id))for(const p of a.parts){p.position[1]*=-1;p.pivot[1]*=-1;}
 const labels={sofa:['Base','Back rest','Left arm','Left cushion','Right arm','Right cushion'],plant:['Pot','Pot rim','Stem','Lower leaves','Upper leaves'],'big-screen':['Base','Stand','Frame','Screen'],'floor-lamp':['Base','Stem','Shade','Top'],washer:['Housing','Door frame','Door seal','Window','Controls'],fridge:['Housing','Lower door','Upper door','Lower handle','Upper handle']};
 if(labels[id])a.parts.forEach((p,i)=>{p.name=labels[id][i];p.group=p.name;});
 return a.finish(['Furniture is kept at its original source height. It is not moved down to the grid.']);
}
function arcadeCar(taxi=true,color=YELLOW){
 const a=author(taxi?'Crown Cab · Classic arcade (repo)':'Traffic sedan','Vehicles','game/render/scene.ts','addCarBoxes',{taxi,color,heading:0,steering:0,includeGroundShadow:false});
 const b=(n,x,y,z,sx,sy,sz,c,extra={})=>a.add(n,x,y,z,sx,sy,sz,c,'MAT_VEHICLE',extra);
 b('Body / Chassis',0,0,.72,taxi?4.8:4.2,taxi?2.35:2.1,.8,color);
 b('Cabin / Roof',-.2,0,1.35,2.2,1.9,.55,taxi?WHITE:BONE);
 b('Body / Hood inset',1.2,0,1.05,.7,1.75,.09,INK);
 for(const f of [-1.35,1.35])for(const r of [-1.12,1.12]) b(`Wheels / ${f>0?'Front':'Rear'} ${r>0?'right':'left'}`,f,r,.55,.75,.24,.72,INK,{role:f>0?'steer-wheel':'wheel'});
 if(taxi){
 b('Roof sign / TAXI',-.2,0,1.8,.82,.45,.28,YELLOW);
 for(const side of [-.72,.72])for(const f of [-.95,-.35,.25,.85])b(`Livery / Check ${a.parts.length-7}`,f,side,1,.28,.08,.22,(Math.round((f+1)*3)+(side>0?1:0))%2?INK:WHITE);
 }
 const doc=a.finish(['Rest pose. Ground shadow is excluded. Wheel roles are inferred from source loops. Animation must be reconnected in the game.']);if(taxi){doc.id='neon-addcarboxes-arcade-taxi';doc.source.parameters.vehicleId='crown-cab';doc.source.parameters.graphics='classic';doc.source.parameters.drivingModel='arcade';}return doc;
}
function accordAsset(){
 const a=author('Accord coupe · Classic (repo)','Vehicles','game/render/accord.ts','addAccordBoxes',{drivingModel:'arcade',heading:0,steering:0});
 const glass=[.17,.28,.34,1],pearl=[.91,.92,.89,1],scuff=[.54,.57,.55,1];let idx=0;
 const body=(f,r,z,sx,sy,sz,c,extra={})=>a.add(extra.name||`Body / Detail ${++idx}`,f,r,z,sx,sy,sz,c,'MAT_VEHICLE',extra);
 body(0,0,.66,4.84,1.96,.65,pearl,{name:'Body / Chassis'});body(1.44,0,1.04,1.74,1.84,.18,WHITE,{tilt:-.045,name:'Body / Hood'});body(-1.8,0,1.05,1.1,1.83,.2,pearl,{name:'Body / Trunk'});body(-.24,0,1.37,2.4,1.67,.56,glass,{name:'Cabin / Glass'});body(-.28,0,1.74,1.3,1.58,.12,WHITE,{name:'Cabin / Roof'});body(.7,0,1.42,.1,1.62,.79,glass,{tilt:-.64,name:'Cabin / Windshield'});body(-1.13,0,1.41,.1,1.62,.78,glass,{tilt:.73,name:'Cabin / Rear glass'});
 for(const side of [-1,1]){
 body(.72,side*.83,1.44,.09,.1,.8,WHITE,{tilt:-.64});body(-1.14,side*.84,1.4,.13,.12,.82,pearl,{tilt:.73});body(-.47,side*.852,1.43,.07,.04,.5,INK);body(-.5,side*.987,.82,.025,.018,.48,scuff);body(-.35,side*.995,1.02,.21,.06,.055,STEEL);body(.7,side*1.02,1.21,.23,.23,.13,pearl);body(-.05,side*.87,1.12,2.12,.045,.04,STEEL);body(-.1,side*.99,.43,2.4,.06,.08,scuff);body(2.35,side*.64,.94,.15,.53,.16,WHITE,{yaw:side*.16});body(-2.39,side*.67,1,.12,.48,.17,RED);body(-2.17,side*.946,1,.36,.06,.17,RED);body(2.27,side*.74,.58,.15,.22,.12,INK);body(-2.32,side*.66,.35,.26,.18,.15,STEEL);
 }
 body(2.42,0,.87,.08,.78,.18,INK);body(2.45,0,1,.07,.84,.04,STEEL);for(const side of [-.047,.047])body(2.467,side,.9,.015,.018,.1,STEEL);body(2.468,0,.9,.016,.09,.018,STEEL);body(-2.44,0,.75,.06,.48,.16,WHITE);body(2.25,0,.4,.22,1.85,.09,INK);
 for(const f of [-1.48,1.4])for(const side of [-1,1]){const n=`Wheels / ${f>0?'Front':'Rear'} ${side>0?'right':'left'}`;body(f,side*.98,.43,.76,.26,.77,INK,{name:n,role:f>0?'steer-wheel':'wheel'});body(f,side*1.12,.43,.42,.035,.43,STEEL,{name:n+' rim'});for(const o of [-.19,.19])body(f+o,side*1.12,.43,.045,.05,.57,scuff,{name:n+' tread'});}
 [[.93,.35,.1,1],RED,[.67,.33,.73,1],STEEL].forEach((c,i)=>{const f=-1.76+(i%2)*.32,z=.83+Math.floor(i/2)*.16;body(f,-.996,z,.25,.025,.105,c);body(f,-1.012,z,.16,.014,.022,WHITE);});body(2.43,.32,.61,.016,.26,.024,scuff);body(-2.42,-.78,.65,.018,.18,.032,scuff);
 const doc=a.finish(['Rest pose. This is the source box model, not the optional detailed polygon car. Wheel pivots and part labels are editor hints; game animation is not exported.']);doc.id='neon-addaccordboxes-accord-coupe';doc.source.parameters.vehicleId='accord-v6';doc.source.parameters.graphics='classic';return doc;
}
function playerAsset(){
 const a=author('Walking player · rest pose','People','game/render/scene.ts','playerAvatarBoxes',{seconds:0,speed:0,grounded:true,crouchAmount:0,elevation:0,heading:0});
 const b=(n,f,r,z,sx,sy,sz,c)=>a.add(n,f,r,z,sx,sy,sz,c,'MAT_PLAYER');
 for(const s of [-1,1]){const side=s<0?'Left':'Right';b(`${side} leg / Shoe`,0,s*.22,.11,.48,.31,.2,INK);b(`${side} leg / Shin`,0,s*.21,.4,.29,.29,.48,BLUE);b(`${side} leg / Thigh`,0,s*.2,.72,.34,.32,.5,BLUE);}
 b('Torso / Hips',0,0,.95,.56,.55,.3,INK);b('Torso / Belt',0,0,1.04,.62,.59,.12,YELLOW);b('Torso / Jacket',0,0,1.34,.7,.72,.7,RED);b('Torso / Chest panel',.37,0,1.35,.09,.58,.27,CYAN);b('Torso / Shoulders',0,0,1.61,.58,.91,.18,RED);
 for(const s of [-1,1]){const side=s<0?'Left':'Right';b(`${side} arm / Upper arm`,0,s*.52,1.43,.28,.31,.48,RED);b(`${side} arm / Forearm`,0,s*.53,1.1,.25,.28,.43,RED);b(`${side} arm / Hand`,0,s*.53,.87,.24,.25,.24,PAPER);}
 b('Head / Neck',.03,0,1.73,.24,.25,.18,PAPER);b('Head / Face',.05,0,1.98,.51,.53,.5,PAPER);b('Head / Hair',-.02,0,2.2,.53,.55,.15,INK);b('Head / Cap',.01,0,2.3,.61,.6,.14,YELLOW);b('Head / Cap brim',.34,0,2.25,.32,.62,.08,YELLOW);b('Head / Nose',.31,0,1.98,.12,.15,.16,INK);
 return a.finish(['Fixed idle pose from playerAvatarBoxes with motion inputs set to zero. Not a rig. Running, crouching, jumping, parcels, and game animation are not included.']);
}
function cityAuthor(name,category,fn,params={}){
 const a=author(name,category,'game/city-assets.ts',fn,params);
 const box=(n,x,y,z,sx,sy,sz,c=C.stone,m='MAT_BUILDING')=>a.add(n,x,y,z,sx,sy,sz,c,m);
 const solid=(id,x,y,sx,sy,height,baseZ=0)=>a.colliders.push({id,x,y,halfX:sx/2,halfY:sy/2,height,baseZ});
 const face=(n,v,c=C.ink,m='MAT_BUILDING')=>a.face(n,v,c,m);
 const shell=(id,x,y,w,d,h,c=C.stone)=>{box(id+' / Walls',x,y,h/2,w,d,h,c);box(id+' / Plinth',x,y,.24,w+.35,d+.35,.48,C.ink,'MAT_STONE');box(id+' / Cornice',x,y,h-.15,w+.5,d+.5,.45,C.cream,'MAT_STONE');solid(id,x,y,w,d,h);};
 const windows=(x,y,w,d,bot,top)=>{for(const s of [-1,1]){box('Windows / Front-back '+s,x,y+s*(d/2+.045),(top+bot)/2,w*.76,.08,top-bot,C.glass,'MAT_WINDOW');box('Windows / Side '+s,x+s*(w/2+.045),y,(top+bot)/2,.08,d*.72,top-bot,C.glass,'MAT_WINDOW');}};
 const hip=(x,y,z,w,d,h,c=C.ink)=>{const ring=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]];for(let i=0;i<4;i++)face('Roof / Hip '+(i+1),[ring[i],ring[(i+1)%4],[x,y,z+h]],c,'MAT_STONE');};
 const canopy=(id,x,y,w,d,h,c=C.gold)=>{const aa=[x-w/2,y-d/2,h],bb=[x+w/2,y-d/2,h+.65],cc=[x+w/2,y+d/2,h+.65],dd=[x-w/2,y+d/2,h];face(id+' / Top',[aa,bb,cc,dd],c);face(id+' / Under',[dd,cc,bb,aa].map(v=>[v[0],v[1],h-.12]),C.cream);solid(id,x,y,w,d,.77,h-.12);};
 const saw=(x,y,z,w,d,rise=2.2,bays=3)=>{for(let i=0;i<bays;i++){const left=x-w/2+i*w/bays,right=left+w/bays,aa=[left,y-d/2,z],bb=[right,y-d/2,z+rise],cc=[right,y+d/2,z+rise],dd=[left,y+d/2,z];face('Roof / Slope '+i,[aa,bb,cc,dd],C.stone,'MAT_STONE');face('Roof / Glass '+i,[bb,[right,y-d/2,z],[right,y+d/2,z],cc],C.glass,'MAT_WINDOW');face('Roof / Front '+i,[aa,[right,y-d/2,z],bb],C.cream);face('Roof / Back '+i,[dd,cc,[right,y+d/2,z]],C.cream);}};
 const tree=(x=0,y=0,s=1)=>{box('Tree / Trunk',x,y,1.8*s,.42*s,.42*s,3.6*s,C.brick,'MAT_TIMBER');const lo=[x,y,2.5*s],hi=[x+.35*s,y,7.4*s],ring=Array.from({length:6},(_,i)=>[x+Math.cos(i*Math.PI/3)*2.7*s,y+Math.sin(i*Math.PI/3)*2.7*s,4.9*s]);for(let i=0;i<6;i++){const c=i%2?[.32,.52,.29,1]:[.49,.64,.31,1];face('Tree / Upper leaf '+i,[ring[i],ring[(i+1)%6],hi],c,'MAT_FOLIAGE');face('Tree / Lower leaf '+i,[ring[(i+1)%6],ring[i],lo],c,'MAT_FOLIAGE');}solid('tree',x,y,.48*s,.48*s,3.5*s);};
 const bench=(x=0,y=0)=>{box('Bench / Seat',x,y,.7,2.5,.7,.2,C.stone,'MAT_TIMBER');box('Bench / Back',x,y+.28,1.15,2.5,.14,.75,C.stone,'MAT_TIMBER');for(const s of [-1,1])box('Bench / Leg '+s,x+s*.9,y,.35,.2,.5,.7,C.ink);};
 const sign=(x,y,h=5)=>{box('Sign / Post',x,y,h/2,.22,.22,h,C.ink);box('Sign / Panel',x,y,h-.9,1.6,.35,2.7,C.teal,'MAT_SIGN');box('Sign / Light',x,y-.2,h-.9,.6,.08,1.6,C.cream,'MAT_LAMP');};
 return {...a,box,solid,face,shell,windows,hip,canopy,saw,tree,bench,sign};
}
function cityProp(type){
 const names={tree:'City tree',bench:'Street bench',light:'Street light',car:'Parked car',sign:'Roadside sign'};
 const fns={tree:'cityTree',bench:'cityBench',light:'cityLight',car:'cityParkedCar',sign:'citySign'};
 const a=cityAuthor(names[type],'Props',fns[type],{x:0,y:0,scale:1});
 if(type==='tree')a.tree();
 if(type==='bench')a.bench();
 if(type==='light'){a.box('Pole',0,0,2.4,.16,.16,4.8,C.ink);a.box('Arm',.48,0,4.8,1.1,.18,.18,C.ink);a.box('Lamp',.85,0,4.65,.7,.45,.15,C.gold,'MAT_LAMP');}
 if(type==='sign')a.sign(0,0);
 if(type==='car'){a.box('Body / Chassis',0,0,.65,1.8,3.8,.9,C.teal,'MAT_VEHICLE');a.box('Cabin / Glass',0,0,1.24,1.55,2.1,.6,C.glass,'MAT_WINDOW');a.box('Cabin / Roof',0,0,1.58,1.65,2.3,.15,C.teal,'MAT_VEHICLE');for(const s of [-1,1])for(const e of [-1,1])a.box(`Wheels / ${s}:${e}`,s*.85,e*1.15,.35,.3,.6,.65,C.ink,'MAT_ROAD');a.solid('parked-car',0,0,1.9,3.8,1.7);}
 for(const p of a.parts)p.sourceExtra={groundAnchor:{x:0,y:0}};
 return a.finish(['Collision shapes are source data. They do not change automatically when visual parts are edited.']);
}
function cityBuilding(lot,randomValue=.75){
 const names={tower:'City tower',office:'Sawtooth office',apartment:'Brick apartments',shops:'Shop row',diner:'Corner diner',warehouse:'Warehouse',factory:'Factory',civic:'Civic hall',market:'Market hall'};
 const a=cityAuthor(names[lot],'Buildings','buildCityLot',{lot,district:'downtown',centerX:0,centerY:0,randomValue,storeOverride:false});
 const {box,shell,windows,hip,canopy,saw,tree,bench,sign,solid}=a,facade=randomValue>.5?C.cream:C.teal;
 switch(lot){
 case 'tower':{const h=22+Math.floor(randomValue*14);shell('Tower',0,0,15,16,h,facade);windows(0,0,15,16,3,h-1.5);box('Crown / Base',0,0,h+1.3,10,11,2.6,C.stone);hip(0,0,h+2.6,10.5,11.5,3.7);box('Crown / Antenna',0,0,h+5.7,.35,.35,4,C.gold,'MAT_LAMP');for(const s of [-1,1])box('Facade / Light '+s,s*6.7,-8.1,h/2,.42,.2,h-1,C.gold,'MAT_SIGN');box('Entry / Door',-2.2,-8.1,1.55,2.2,.16,3.1,C.ink);canopy('Lobby canopy',-2.2,-8.8,4.8,2,3.65,C.teal);solid('crown',0,0,10,11,6.3,h);break;}
 case 'office':shell('Office',0,3,15,13,11.5,facade);windows(0,3,15,13,2.6,10.3);saw(0,3,11.5,15.4,13.4,1.7,2);canopy('Entry',.5,-4,6,2,3.8,C.coral);tree(-8.5,-6,.8);break;
 case 'apartment':shell('Apartments',-1,1,18,16,13,C.brick);windows(-1,1,18,16,3,11.8);hip(-1,1,13,18.6,16.6,2.5);for(const z of [4,7,10])box('Balconies / Level '+z,-1,-7.3,z,15.5,1,.2,C.cream);canopy('Lobby',-5.4,-7.7,3.5,1.9,3.65,C.gold);break;
 case 'shops':[-7.1,0,7.1].forEach((o,i)=>{shell('Shop '+(i+1),o,6.1,6.4,8.5,5.2+i*.8,i===1?C.cream:facade);box('Shop '+(i+1)+' / Window',o,1.8,1.8,4.6,.09,2.8,C.glass,'MAT_WINDOW');box('Shop '+(i+1)+' / Sign',o,1.75,4.2,5.5,.25,.8,i===1?C.coral:C.teal,'MAT_SIGN');canopy('Awning '+i,o,1.3,6,1.9,4.8,i===1?C.coral:C.gold);});break;
 case 'diner':shell('Diner',0,5.5,16,7.5,4.4,C.cream);windows(0,5.5,16,7.5,1,3.5);canopy('Diner roof',0,4.8,18.3,11,4.5,C.coral);sign(-9.3,6,6.5);bench(4,5);break;
 case 'warehouse':case 'factory':{const f=lot==='factory',y=f?3.5:3.9,d=f?12.4:14,h=f?10:7;shell(lot,0,y,20,d,h,f?C.brick:C.stone);saw(0,y,h,20.4,d+.4,2.2);for(const o of [-6,0,6])box('Loading / Door '+o,o,y-d/2-.06,2.4,4,.1,4.2,C.teal,'MAT_WINDOW');solid('shed-roof',0,y,20,d,2.2,h);if(f)for(const o of [-7,7]){box('Chimneys / Stack '+o,o,7,10,1.1,1.1,20,C.ink);box('Chimneys / Band '+o,o,7,18.5,1.25,1.25,1.2,C.coral,'MAT_SIGN');}break;}
 case 'civic':shell('Civic hall',0,5,16,9,8,C.cream);hip(0,5,8,17,10,3,C.teal);canopy('Portico',0,-.8,10,3,4.3,C.stone);for(const s of [-1,1]){box('Columns / '+s,s*4,-1.6,2.1,.65,.65,4.2,C.cream);solid('column-'+s,s*4,-1.6,.65,.65,4.2);}tree(-8,-7,.8);break;
 case 'market':shell('Market hall',0,7.25,18,7,6.4,C.brick);saw(0,7.25,6.4,18.5,7.5,1.8,3);box('Facade / Glass',0,3.7,2.2,14,.1,3.6,C.glass,'MAT_WINDOW');canopy('Market awning',0,3.5,18,3,4.8,C.gold);bench(-6,8);bench(6,8);break;
 default:throw new Error('Unsupported lot type');
 }
 const doc=a.finish(['Fixed lot sample. Random calls return the recorded value. Store overrides are disabled. This is not a specific streamed world instance.','Original collision shapes are included. Check them after edits. Roof meshes and canopies are separate surfaces.']);doc.source.path='game/city-buildings.ts';return doc;
}
function sourceCatalog(){
 return [arcadeCar(),arcadeCar(false,RED),accordAsset(),crownSimulationAsset(),reviewedDetailedAsset('crown-cab'),reviewedDetailedAsset('accord-v6'),...accordStudies(),playerAsset(),...['tower','office','apartment','shops','diner','warehouse','factory','civic','market'].map(v=>cityBuilding(v)),...['tree','bench','light','car','sign'].map(cityProp),...['sofa','plant','floor-lamp','big-screen','stereo','washer','microwave','fridge','coffee-maker','vacuum','pantry','bookcase','rug','dining-set','bed-frame','side-table'].map(furnishingAsset)];
}

export { NEON_SOURCE, NEON_PALETTE, furnishingAsset, arcadeCar, accordAsset, playerAsset, cityProp, cityBuilding, sourceCatalog };
