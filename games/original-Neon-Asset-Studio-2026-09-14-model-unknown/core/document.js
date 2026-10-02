import { boundsOf, triangles, worldMesh, rotatePoint, vadd, vsub, vmul, round } from './math.js';
import { sourceCatalog, NEON_PALETTE } from '../adapters/neon-fare.js';
const SCHEMA='neon.asset/1';
const LIMITS={parts:2048,vertices:65536,triangles:65536,commands:200,history:40};
const clone = value => structuredClone(value);
function uid(prefix='asset'){const random=globalThis.crypto.randomUUID?.()||[...globalThis.crypto.getRandomValues(new Uint8Array(12))].map(n=>n.toString(16).padStart(2,'0')).join('');return prefix+'-'+random.slice(0,12);}
const isObj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function ensure(test,message){if(!test)throw new Error(message);}
function tuple(value,size,name,lo=-1e6,hi=1e6){ensure(Array.isArray(value)&&value.length===size&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi),`${name} must contain ${size} finite numbers from ${lo} to ${hi}.`);}
function checkPart(p){
 ensure(isObj(p),'Part must be an object.');ensure(typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.id),'Part ID is invalid.');
 ensure(typeof p.name==='string'&&p.name.length>0&&p.name.length<=160,'Part name is required (160 characters max).');
 ensure(p.kind==='box'||p.kind==='mesh','Part kind must be box or mesh.');
 tuple(p.position,3,'Position');tuple(p.rotation,3,'Rotation',-1000,1000);tuple(p.scale,3,'Scale',.00001,10000);tuple(p.color,4,'Color',0,1);
 ensure(typeof p.material==='string'&&/^[A-Z0-9_]{1,60}$/.test(p.material),'Material key is invalid.');
 ensure(typeof p.visible==='boolean'&&typeof p.locked==='boolean','Visibility and lock values must be booleans.');
 if(p.group!==undefined)ensure(typeof p.group==='string'&&p.group.length<=160,'Group is invalid.');
 tuple(p.pivot,3,'Pivot');
 if(p.role!==undefined)ensure(typeof p.role==='string'&&p.role.length<=120,'Part role is invalid.');
 if(p.sourceIndex!==undefined)ensure(Number.isInteger(p.sourceIndex)&&p.sourceIndex>=0,'Source index is invalid.');
 if(p.kind==='box')tuple(p.size,3,'Box size',.00001,10000);
 else{
  ensure(Array.isArray(p.vertices)&&p.vertices.length>=3&&p.vertices.length<=LIMITS.vertices,'Mesh vertex count is invalid.');
  for(const v of p.vertices)tuple(v,3,'Vertex');
  ensure(Array.isArray(p.faces)&&p.faces.length>0&&p.faces.length<=LIMITS.triangles,'Mesh faces are required.');
  for(const f of p.faces)ensure(Array.isArray(f)&&f.length>=3&&f.length<=4&&f.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length),'Faces must have 3 or 4 valid vertex indices.');
 }
}
function checkDocument(doc){
 ensure(isObj(doc)&&doc.schema===SCHEMA,'This is not a neon.asset/1 project.');
 ensure(typeof doc.id==='string'&&/^[a-zA-Z0-9_-]{1,140}$/.test(doc.id),'Asset ID is invalid.');
 ensure(typeof doc.name==='string'&&doc.name.trim().length>0&&doc.name.length<=160,'Asset name is required (160 characters max).');
 ensure(['Vehicles','People','Buildings','Furniture','Props','Custom'].includes(doc.category),'Asset category is invalid.');
 ensure(doc.upAxis==='Z'&&doc.units==='world-unit','Use Z-up world-unit coordinates.');
 ensure(Number.isSafeInteger(doc.revision)&&doc.revision>=0,'Revision must be a positive integer or zero.');
 ensure(Array.isArray(doc.parts)&&doc.parts.length<=LIMITS.parts,'Too many parts.');
 const ids=new Set();let total=0;
 for(const p of doc.parts){checkPart(p);ensure(!ids.has(p.id),'Part IDs must be unique.');ids.add(p.id);total+=p.kind==='box'?12:p.faces.reduce((s,f)=>s+f.length-2,0);}
 ensure(total<=LIMITS.triangles,'Triangle limit exceeded.');
 ensure(Array.isArray(doc.colliders)&&doc.colliders.length<=2048,'Collider list is invalid.');
 for(const c of doc.colliders){ensure(isObj(c)&&typeof c.id==='string','Collider ID is required.');tuple([c.x,c.y,c.baseZ??0],3,'Collider position');tuple([c.halfX,c.halfY,c.height],3,'Collider size',.00001,10000);}
 ensure(Array.isArray(doc.notes)&&doc.notes.length<=200&&doc.notes.every(n=>typeof n==='string'&&n.length<=4000),'Notes must be a list of text strings.');
 ensure(Array.isArray(doc.references),'References must be a list.');
 if(doc.style){ensure(isObj(doc.style)&&Array.isArray(doc.style.palette)&&doc.style.palette.length<=128,'Style needs a palette.');for(const c of doc.style.palette)tuple(c,4,'Palette color',0,1);}
 if(doc.source!==null){ensure(isObj(doc.source),'Source must be an object or null.');for(const k of ['repository','commit','path','function'])ensure(typeof doc.source[k]==='string'&&doc.source[k].length<=500,'Source '+k+' is invalid.');}
 if(doc.references){ensure(Array.isArray(doc.references)&&doc.references.length<=8,'Up to eight reference images are allowed.');for(const r of doc.references)ensure(typeof r.name==='string'&&typeof r.data==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(r.data)&&r.data.length<3e6,'Reference must be a PNG, JPEG, or WebP image under 2 MB.');}
 return doc;
}
function reportAsset(doc){
 checkDocument(doc);const visible=doc.parts.filter(p=>p.visible),b=boundsOf(visible),count=visible.reduce((n,p)=>n+(p.kind==='box'?12:p.faces.reduce((s,f)=>s+f.length-2,0)),0),warnings=[];
 if(!visible.length)warnings.push('There is no visible geometry.');
 if(b.min[2]<-.001)warnings.push('Some geometry is below the ground plane.');
 if(doc.colliders.length&&doc.revision>0)warnings.push('Check the collision shapes. Visual edits do not update them automatically.');
 if(doc.category==='People'||doc.category==='Vehicles')warnings.push('Static geometry only. Game movement, steering, and animation require agent review.');
 if(doc.parts.some(p=>p.kind==='mesh'&&p.faces.some(f=>f.length===4)))warnings.push('Quads use a triangle fan. Check the diagonal after moving a vertex.');
 if(doc.parts.some(p=>p.color[3]<1))warnings.push('Check transparent materials in the target renderer.');
 if(count>(doc.style?.maxTriangles||4096))warnings.push('This asset is above its suggested triangle budget.');
 let degenerate=0;for(const p of visible)for(const [a,b,c] of triangles(p)){const u=vsub(b,a),v=vsub(c,a);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)<1e-9)degenerate++;}
 if(degenerate)warnings.push(`${degenerate} triangles have zero area.`);
 return {valid:true,name:doc.name,revision:doc.revision,parts:doc.parts.length,visibleParts:visible.length,triangles:count,colliders:doc.colliders.length,bounds:b,warnings};
}
function makePart(spec={}){
 const p={id:uid('part'),name:'New box',group:'New parts',kind:'box',position:[0,0,.5],rotation:[0,0,0],scale:[1,1,1],size:[1,1,1],color:[1,.72,0,1],material:'MAT_BUILDING',visible:true,locked:false,pivot:[0,0,0],...clone(spec)};
 if(p.kind==='mesh')delete p.size;checkPart(p);return p;
}
function primitive(kind='box',spec={}){
 if(kind==='box')return makePart(spec);
 if(kind==='wedge')return makePart({kind:'mesh',name:'Roof wedge',vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[0,-.5,.5],[0,.5,.5]],faces:[[0,3,2,1],[0,1,4],[3,5,2],[0,4,5,3],[1,2,5,4]],...spec});
 if(kind==='cylinder'){
  const vertices=[],faces=[],segments=8;
  for(const z of [-.5,.5])for(let i=0;i<segments;i++)vertices.push([Math.cos(i*Math.PI*2/segments)*.5,Math.sin(i*Math.PI*2/segments)*.5,z]);
  vertices.push([0,0,-.5],[0,0,.5]);for(let i=0;i<segments;i++){const j=(i+1)%segments;faces.push([i,j,j+segments,i+segments],[16,j,i],[17,i+segments,j+segments]);}
  return makePart({kind:'mesh',name:'Eight-sided cylinder',vertices,faces,...spec});
 }
 if(kind==='pyramid')return makePart({kind:'mesh',name:'Pyramid',vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[0,0,.5]],faces:[[0,3,2,1],[0,1,4],[1,2,4],[2,3,4],[3,0,4]],...spec});
 if(kind==='ramp')return makePart({kind:'mesh',name:'Ramp',vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[.5,-.5,.5],[.5,.5,.5]],faces:[[0,3,2,1],[1,2,5,4],[0,4,5,3],[0,1,4],[3,5,2]],...spec});
 if(kind==='sphere'){
  // Low-poly UV sphere: 10 segments, 6 bands, outward winding like the box faces.
  const vertices=[[0,0,.5]],faces=[],segments=10,bands=6,ring=i=>1+(i-1)*segments;
  for(let i=1;i<bands;i++){const phi=i*Math.PI/bands,z=+(.5*Math.cos(phi)).toFixed(6),r=.5*Math.sin(phi);for(let j=0;j<segments;j++){const t=j*Math.PI*2/segments;vertices.push([+(r*Math.cos(t)).toFixed(6),+(r*Math.sin(t)).toFixed(6),z]);}}
  vertices.push([0,0,-.5]);const south=vertices.length-1;
  for(let j=0;j<segments;j++){const k=(j+1)%segments;faces.push([0,ring(1)+j,ring(1)+k]);for(let i=1;i<bands-1;i++)faces.push([ring(i)+j,ring(i+1)+j,ring(i+1)+k,ring(i)+k]);faces.push([south,ring(bands-1)+k,ring(bands-1)+j]);}
  return makePart({kind:'mesh',name:'Ten-sided sphere',vertices,faces,...spec});
 }
 throw new Error('Unknown primitive. Use box, wedge, cylinder, pyramid, ramp, or sphere.');
}
const PRIMITIVES=['box','wedge','cylinder','pyramid','ramp','sphere'];
const TEMPLATES=['blank','box','van','building','tree','food-truck','bus-shelter','scooter'];
function newAsset({name='Untitled asset',category='Custom',template='blank',parts,style}={}){
 const doc={schema:SCHEMA,id:uid(),name,category,revision:0,units:'world-unit',upAxis:'Z',parts:[],colliders:[],source:null,style:clone(style||{name:'Neon Fare inspired',palette:Object.values(NEON_PALETTE),shading:'flat',maxTriangles:4096}),notes:['New editor asset. Not extracted from a game repo.'],references:[],history:[]};
 const p=(n,pos,size,color,material)=>doc.parts.push(makePart({name:n,group:n.split(' / ')[0],position:pos,size,color,...(material?{material}:{})}));
 const yellow=doc.style.palette[3]||[1,.72,0,1],ink=[.04,.05,.06,1],glass=[.14,.34,.38,1],cream=[.96,.91,.8,1];
 const {RED:red,CYAN:cyan,STEEL:steel,BONE:bone,PAPER:paper}=NEON_PALETTE;
 if(parts)doc.parts=parts.map(v=>makePart(v));
 else if(template==='box')doc.parts=[primitive('box')];
 else if(template==='van'){
 doc.category='Vehicles';p('Body / Cargo box',[-.6,0,1.25],[3.2,2.2,1.9],yellow);p('Cabin / Lower', [1.55,0,.85],[1.3,2.2,1.1],yellow);p('Cabin / Glass',[1.5,0,1.65],[1.15,2.04,.75],glass);p('Cabin / Roof',[1.5,0,2.07],[1.4,2.2,.16],cream);p('Body / Bumper',[2.22,0,.6],[.18,2.3,.22],ink);
 for(const x of [-1.6,1.6])for(const y of [-1.08,1.08]){p(`Wheels / ${x>0?'Front':'Rear'} ${y>0?'right':'left'}`,[x,y,.45],[.78,.3,.82],ink);doc.parts.at(-1).role=x>0?'steer-wheel':'wheel';}
 for(const y of [-.7,.7])p('Lights / Headlight',[2.21,y,1],[.1,.45,.3],cream);
 }else if(template==='building'){
 doc.category='Buildings';p('Structure / Walls',[0,0,3],[6,5,6],cream);p('Structure / Base',[0,0,.18],[6.4,5.4,.36],ink);doc.parts.push(primitive('wedge',{name:'Roof / Gable',group:'Roof',position:[0,0,6.75],scale:[6.5,5.5,1.5],color:ink}));
 for(const x of [-1.8,1.8])for(const z of [1.8,4.4])p('Facade / Window',[x,-2.54,z],[1.25,.1,1.4],glass);p('Facade / Door',[0,-2.57,1.2],[1.1,.14,2.4],yellow);
 }else if(template==='tree'){
 doc.category='Props';p('Trunk',[0,0,1.5],[.35,.35,3],[.44,.25,.17,1]);doc.parts.push(primitive('wedge',{name:'Lower crown',position:[0,0,3],scale:[3,2.5,2.5],color:[.18,.45,.28,1]}));doc.parts.push(primitive('wedge',{name:'Upper crown',position:[0,0,4.4],scale:[2.2,2,2.5],color:[.32,.56,.3,1]}));
 }else if(template==='food-truck'){
 doc.category='Vehicles';p('Body / Kitchen box',[-.45,0,1.55],[3.5,2.2,2.3],cream);for(const y of [-1.115,1.115])p(`Body / Stripe ${y>0?'right':'left'}`,[-.45,y,1],[3.5,.03,.28],red);
 p('Cabin / Lower',[1.85,0,.85],[1.1,2.2,1.1],yellow);p('Cabin / Glass',[1.8,0,1.68],[.95,2.04,.7],glass);p('Cabin / Roof',[1.75,0,2.08],[1.1,2.2,.14],yellow);p('Body / Bumper',[2.45,0,.55],[.16,2.3,.22],ink);p('Body / Rear door',[-2.215,0,1.55],[.04,1,1.9],steel);
 p('Service / Window',[-.45,-1.125,1.85],[2,.05,.95],glass);p('Service / Counter',[-.45,-1.25,1.32],[2.2,.3,.08],steel);
 doc.parts.push(makePart({name:'Service / Awning',group:'Service',position:[-.45,-1.55,2.55],rotation:[.32,0,0],size:[2.5,.85,.07],color:cyan,material:'MAT_SIGN'}));
 p('Roof / Sign',[-.45,0,2.98],[1.9,.12,.5],red,'MAT_SIGN');p('Roof / Sign panel',[-.45,-.065,2.98],[1.6,.02,.32],yellow,'MAT_LAMP');p('Roof / Vent',[-1.6,.5,2.82],[.5,.5,.25],steel);
 for(const x of [-1.55,1.55])for(const y of [-1.08,1.08]){p(`Wheels / ${x>0?'Front':'Rear'} ${y>0?'right':'left'}`,[x,y,.45],[.78,.3,.82],ink);doc.parts.at(-1).role=x>0?'steer-wheel':'wheel';}
 for(const y of [-.7,.7]){p('Lights / Headlight',[2.43,y,.95],[.1,.42,.26],cream,'MAT_LAMP');p('Lights / Tail light',[-2.22,y,.95],[.08,.3,.3],red,'MAT_LAMP');}
 doc.colliders.push({id:'food-truck',x:0,y:0,halfX:2.5,halfY:1.15,height:3.1,baseZ:0});
 }else if(template==='bus-shelter'){
 doc.category='Props';p('Base / Slab',[0,0,.08],[4.4,1.9,.16],bone);for(const x of [-2,2])for(const y of [-.8,.8])p('Frame / Post',[x,y,1.4],[.12,.12,2.5],steel);
 doc.parts.push(makePart({name:'Roof / Canopy',group:'Roof',position:[0,0,2.72],rotation:[-.08,0,0],size:[4.6,2.1,.14],color:ink}));p('Roof / Fascia',[0,-1.04,2.62],[4.6,.06,.22],yellow);
 p('Walls / Back glass',[0,.8,1.45],[3.85,.05,2],glass,'MAT_WINDOW');p('Walls / Side glass',[-2,0,1.45],[.05,1.45,2],glass,'MAT_WINDOW');
 p('Bench / Seat',[0,.5,.6],[3,.42,.08],yellow);for(const x of [-1.3,1.3])p('Bench / Leg',[x,.5,.34],[.08,.36,.44],ink);
 p('Advert / Frame',[2,0,1.45],[.16,1.4,2],paper);p('Advert / Poster',[2.09,0,1.45],[.02,1.2,1.75],cyan,'MAT_SIGN');
 p('Route sign / Pole',[2.7,-.75,1.7],[.1,.1,3.4],steel);p('Route sign / Plate',[2.7,-.75,3.1],[.06,.75,.55],yellow,'MAT_SIGN');p('Route sign / Number',[2.735,-.75,3.1],[.02,.42,.3],ink);
 doc.colliders.push({id:'shelter',x:0,y:0,halfX:2.1,halfY:.9,height:2.8,baseZ:0},{id:'route-sign',x:2.7,y:-.75,halfX:.1,halfY:.1,height:3.4,baseZ:0});
 }else if(template==='scooter'){
 doc.category='Vehicles';p('Body / Deck',[0,0,.42],[1.25,.42,.1],ink);p('Body / Rear cowl',[-.38,0,.72],[.78,.46,.5],red);p('Seat / Cushion',[-.38,0,1.02],[.72,.36,.12],ink);p('Front / Leg shield',[.5,0,.78],[.12,.52,.62],red);
 doc.parts.push(makePart({name:'Front / Steering column',group:'Front',position:[.6,0,1.12],rotation:[0,-.32,0],size:[.1,.1,.95],color:steel}));p('Front / Handlebar',[.46,0,1.58],[.07,.74,.06],steel);p('Front / Headlight',[.6,0,1.3],[.05,.2,.12],cream,'MAT_LAMP');
 p('Cargo / Delivery box',[-.62,0,1.42],[.6,.56,.56],yellow);p('Cargo / Lid band',[-.62,0,1.71],[.62,.58,.04],ink);
 for(const x of [-.55,.62])doc.parts.push(primitive('cylinder',{name:`Wheels / ${x>0?'Front':'Rear'}`,group:'Wheels',position:[x,0,.26],rotation:[Math.PI/2,0,0],scale:[.52,.52,.14],color:ink,role:x>0?'steer-wheel':'wheel'}));
 }else if(template!=='blank')throw new Error('Unknown asset template.');
 return checkDocument(doc);
}
/** Add new bundled samples without changing existing assets or their edit history. */
function mergeBundledAssets(state){
 const existing=new Set(state.assets.map(a=>a.id));
 for(const doc of sourceCatalog())if(!existing.has(doc.id)){state.assets.push(doc);state.originals[doc.id]=clone(doc);}
 state.catalogVersion='0.2.0';return state;
}
let catalogIds=null;
function initialState(){const assets=sourceCatalog();catalogIds=new Set(assets.map(a=>a.id));return {version:1,revision:0,activeAssetId:assets.find(a=>a.id==='accord-study-b')?.id||assets[0].id,assets,originals:Object.fromEntries(assets.map(a=>[a.id,clone(a)])),undo:{},redo:{},commandLog:[]};}
/**
 * Browser save, version 2. The bundled catalog is rebuilt from source on every load, so
 * only assets that differ from it are stored, plus the originals of assets the catalog
 * cannot recreate. Undo history stays in memory. Version 1 stored everything, every
 * original and 40 undo copies per asset: an edited detailed car soon passed the
 * browser's storage quota, which the whole site shares, and then every command failed.
 */
function packState(state){
 if(!catalogIds)catalogIds=new Set(sourceCatalog().map(a=>a.id));
 const assets=state.assets.filter(a=>!catalogIds.has(a.id)||a.revision!==0),originals={};
 for(const a of assets)if(!catalogIds.has(a.id)&&state.originals[a.id])originals[a.id]=state.originals[a.id];
 return {version:2,catalogVersion:'0.3.0',revision:state.revision,activeAssetId:state.activeAssetId,order:state.assets.map(a=>a.id),assets,originals,commandLog:state.commandLog.slice(-50)};
}
function unpackState(saved){
 ensure(isObj(saved)&&Array.isArray(saved.assets),'Unsupported saved workspace.');
 if(saved.version===1){saved.assets.forEach(checkDocument);saved.originals||={};saved.undo||={};saved.redo||={};saved.commandLog||=[];if(!catalogIds)catalogIds=new Set(sourceCatalog().map(a=>a.id));return mergeBundledAssets(saved);}
 ensure(saved.version===2,'Unsupported saved workspace.');
 const state=initialState(),byId=new Map(state.assets.map(a=>[a.id,a]));
 for(const a of saved.assets){checkDocument(a);if(!catalogIds.has(a.id))state.originals[a.id]=saved.originals?.[a.id]?checkDocument(saved.originals[a.id]):clone(a);byId.set(a.id,a);}
 const order=new Map((Array.isArray(saved.order)?saved.order:[]).map((id,i)=>[id,i]));
 state.assets=[...byId.values()].map((a,i)=>[a,order.has(a.id)?order.get(a.id):1e6+i]).sort((x,y)=>x[1]-y[1]).map(([a])=>a);
 if(byId.has(saved.activeAssetId))state.activeAssetId=saved.activeAssetId;
 state.revision=Number.isSafeInteger(saved.revision)&&saved.revision>=0?saved.revision:0;
 state.commandLog=Array.isArray(saved.commandLog)?saved.commandLog.slice(-100):[];
 return state;
}
const editableFields=new Set(['name','group','position','rotation','scale','size','color','material','visible','locked','pivot','role']);
function findPart(doc,id){const p=doc.parts.find(v=>v.id===id);ensure(p,`Part not found: ${id}`);return p;}
function unlocked(p){ensure(!p.locked,`Part is locked: ${p.name}`);}
function applyEdit(doc,e){
 ensure(isObj(e)&&typeof e.type==='string','Each edit needs a type.');
 if(e.type==='set'){
  const p=findPart(doc,e.partId);ensure(isObj(e.values),'Set values must be an object.');
  const keys=Object.keys(e.values);ensure(keys.length>0,'Set values are empty.');ensure(keys.every(k=>editableFields.has(k)),'This field cannot be changed with set.');
  if(!(keys.length===1&&keys[0]==='locked'))unlocked(p);Object.assign(p,clone(e.values));
 }else if(e.type==='add'){
  const p=e.primitive?primitive(e.primitive,e.part||{}):makePart(e.part||{});ensure(!doc.parts.some(v=>v.id===p.id),'Part ID already exists.');doc.parts.push(p);
 }else if(e.type==='remove'){
  ensure(Array.isArray(e.partIds)&&e.partIds.length,'Select parts to remove.');e.partIds.forEach(id=>unlocked(findPart(doc,id)));doc.parts=doc.parts.filter(p=>!e.partIds.includes(p.id));
 }else if(e.type==='duplicate'){
  ensure(Array.isArray(e.partIds)&&e.partIds.length,'Select parts to copy.');tuple(e.offset||[.25,.25,0],3,'Copy offset');
  for(const id of e.partIds){const p=clone(findPart(doc,id));unlocked(p);p.id=uid('part');p.name+=' copy';p.position=vadd(p.position,e.offset||[.25,.25,0]);delete p.sourceIndex;doc.parts.push(p);}
 }else if(e.type==='translate'){
  tuple(e.delta,3,'Move delta');ensure(Array.isArray(e.partIds)&&e.partIds.length,'Select parts to move.');for(const id of e.partIds){const p=findPart(doc,id);unlocked(p);p.position=vadd(p.position,e.delta);}
 }else if(e.type==='mirror'){
  ensure([0,1,2].includes(e.axis),'Mirror axis must be 0, 1, or 2.');const plane=e.plane??0;ensure(Number.isFinite(plane),'Mirror plane must be finite.');ensure(Array.isArray(e.partIds)&&e.partIds.length,'Select parts to mirror.');
  for(const id of e.partIds){const old=findPart(doc,id);unlocked(old);const m=worldMesh(old),p=clone(old);p.id=e.copy===false?old.id:uid('part');p.name=e.copy===false?old.name:old.name+' mirrored';p.kind='mesh';delete p.size;p.position=[0,0,0];p.rotation=[0,0,0];p.scale=[1,1,1];p.vertices=m.vertices.map(v=>v.map((n,i)=>i===e.axis?2*plane-n:n));p.faces=m.faces.map(f=>[...f].reverse());p.pivot=p.pivot.map((n,i)=>i===e.axis?2*plane-n:n);delete p.sourceIndex;if(e.copy===false)doc.parts[doc.parts.indexOf(old)]=p;else doc.parts.push(p);}
 }else if(e.type==='vertex'){
  const p=findPart(doc,e.partId);unlocked(p);ensure(p.kind==='mesh','Convert the box to a mesh before you edit vertices.');ensure(Number.isInteger(e.index)&&e.index>=0&&e.index<p.vertices.length,'Vertex index is invalid.');tuple(e.position,3,'Vertex position');p.vertices[e.index]=clone(e.position);
 }else if(e.type==='convert_mesh'){
  const p=findPart(doc,e.partId);unlocked(p);if(p.kind==='box'){const m=worldMesh(p);p.kind='mesh';p.vertices=m.vertices;p.faces=clone(m.faces);p.position=[0,0,0];p.rotation=[0,0,0];p.scale=[1,1,1];delete p.size;}
 }else if(e.type==='rename_asset'){
  ensure(typeof e.name==='string','Name is required.');doc.name=e.name;
 }else if(e.type==='palette'){
  tuple(e.from,4,'Source color',0,1);tuple(e.to,4,'Target color',0,1);for(const p of doc.parts)if(p.color.every((n,i)=>Math.abs(n-e.from[i])<.004)){unlocked(p);p.color=clone(e.to);}
 }else if(e.type==='collider'){
  const c=doc.colliders.find(c=>c.id===e.id);ensure(c,'Collider not found.');ensure(isObj(e.values)&&Object.keys(e.values).every(k=>['x','y','halfX','halfY','height','baseZ'].includes(k)),'Collider fields are invalid.');Object.assign(c,e.values);
 }else if(e.type==='reference'){
  if(e.remove!==undefined){ensure(Number.isInteger(e.remove)&&e.remove>=0&&e.remove<doc.references.length,'Reference index is invalid.');doc.references.splice(e.remove,1);}else doc.references.push({name:e.name,data:e.data});
 }else throw new Error('Unknown edit type: '+e.type);
}
function getAsset(state,id){const a=state.assets.find(a=>a.id===(id||state.activeAssetId));ensure(a,'Asset not found.');return a;}
function pushUndo(state,doc){const u=state.undo[doc.id]||[];u.push(clone(doc));state.undo[doc.id]=u.slice(-LIMITS.history);state.redo[doc.id]=[];}
function logCommand(state,op,assetId){state.revision++;state.commandLog.push({op,assetId,at:new Date().toISOString(),revision:state.revision});state.commandLog=state.commandLog.slice(-100);}
function expectRevision(doc,c){ensure(Number.isInteger(c.expectedRevision),'expectedRevision is required. Inspect the asset first.');ensure(c.expectedRevision===doc.revision,`Revision conflict. Expected ${c.expectedRevision}; current revision is ${doc.revision}. Inspect the asset again.`);}
const COMMAND_NAMES=['list_assets','inspect_asset','create_asset','duplicate_asset','apply_edits','undo','redo','import_asset','validate_asset','set_active_asset','derive_style'];
const MUTATING_COMMANDS=['create_asset','duplicate_asset','apply_edits','undo','redo','import_asset','set_active_asset'];
/** Atomic command reducer. It never changes the input state. */
function runCommand(input,c){
 ensure(isObj(c)&&COMMAND_NAMES.includes(c.op),'Unknown command.');
 if(c.op==='list_assets')return {state:input,result:input.assets.filter(a=>!c.category||a.category===c.category).map(a=>({id:a.id,name:a.name,category:a.category,revision:a.revision,parts:a.parts.length,source:a.source}))};
 if(c.op==='inspect_asset')return {state:input,result:clone(getAsset(input,c.assetId))};
 if(c.op==='validate_asset')return {state:input,result:reportAsset(getAsset(input,c.assetId))};
 if(c.op==='derive_style'){
  const a=getAsset(input,c.assetId),map=new Map();for(const p of a.parts){const key=JSON.stringify(p.color);map.set(key,(map.get(key)||0)+1);}return {state:input,result:{name:a.name+' style',palette:[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([s])=>JSON.parse(s)),shading:'flat',maxTriangles:a.style?.maxTriangles||4096,source:{assetId:a.id,revision:a.revision},bounds:boundsOf(a.parts)}};
 }
 const state=clone(input);let doc,result;
 if(c.op==='set_active_asset'){doc=getAsset(state,c.assetId);state.activeAssetId=doc.id;result=doc;}
 else if(c.op==='create_asset'){
  const style=c.styleFrom?runCommand(state,{op:'derive_style',assetId:c.styleFrom}).result:c.style;
  doc=newAsset({...c,style});state.assets.push(doc);state.originals[doc.id]=clone(doc);state.activeAssetId=doc.id;result=doc;
 }else if(c.op==='duplicate_asset'){
  const source=getAsset(state,c.assetId);doc=clone(source);doc.id=uid();doc.name=c.name||source.name+' variant';doc.revision=0;doc.history=[];checkDocument(doc);state.assets.push(doc);state.originals[doc.id]=clone(source);state.originals[doc.id].id=doc.id;state.activeAssetId=doc.id;result=doc;
 }else if(c.op==='import_asset'){
  doc=clone(c.asset);checkDocument(doc);doc.id=uid('import');doc.revision=0;doc.history=[];state.assets.push(doc);state.originals[doc.id]=clone(doc);state.activeAssetId=doc.id;result=doc;
 }else{
  doc=getAsset(state,c.assetId);expectRevision(doc,c);
  if(c.op==='apply_edits'){
   ensure(Array.isArray(c.edits)&&c.edits.length>0&&c.edits.length<=LIMITS.commands,'Use 1 to 200 edits per command.');pushUndo(state,doc);for(const e of c.edits)applyEdit(doc,e);doc.revision++;doc.history=(doc.history||[]).concat({revision:doc.revision,at:new Date().toISOString(),edits:clone(c.edits)}).slice(-100);checkDocument(doc);
  }else if(c.op==='undo'||c.op==='redo'){
   const stack=c.op==='undo'?state.undo:state.redo,other=c.op==='undo'?state.redo:state.undo;
   const next=(stack[doc.id]||[]).pop();ensure(next,`Nothing to ${c.op}.`);(other[doc.id]||=[]).push(clone(doc));const revision=doc.revision+1;const index=state.assets.indexOf(doc);doc=clone(next);doc.revision=revision;state.assets[index]=doc;
  }
  result=doc;
 }
 logCommand(state,c.op,doc?.id);return {state,result:clone(result)};
}

export { SCHEMA, LIMITS, PRIMITIVES, TEMPLATES, clone, uid, checkPart, checkDocument, reportAsset, makePart, primitive, newAsset, mergeBundledAssets, initialState, packState, unpackState, getAsset, COMMAND_NAMES, MUTATING_COMMANDS, runCommand };
