/* Three.js r181 city renderer. All coordinates are metres, with z up.
 * Engine state is an input snapshot. This module never advances game simulation.
 */
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { createCityEffects } from './city-effects.js';

const {uniform,attribute,vec2,vec3,vec4,float,ivec2,uv,normalWorld,normalView,positionWorld,positionView,positionWorldDirection,pass,mrt,output,emissive,mix,smoothstep,fog,convertToTexture}=TSL;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const srgb=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
const QUALITY={low:{scale:.72,shadow:512,ao:.35},balanced:{scale:1,shadow:1024,ao:.5},high:{scale:1,shadow:2048,ao:.65}};

export function createUniforms(settings){
 return {time:uniform(0),motion:uniform(settings.motion?1:0),wet:uniform(settings.wet?1:0),fogEnabled:uniform(settings.fog?1:0),fogRange:uniform(500),viewport:uniform(new THREE.Vector2(800,500)),pixelScope:uniform(settings.pixel==='scene'?1:settings.pixel==='subjects'?2:0),pixelSize:uniform(settings.pixelSize),celScope:uniform(settings.cel==='scene'?1:settings.cel==='subjects'?2:0),celBands:uniform(settings.celBands)};
}

export function createMaterials(u){
 const vertexColor=attribute('color','vec3'),glow=attribute('glow','float');
 const pulse=u.time.mul(.75).add(positionWorld.x.mul(.08)).sin().mul(.055).mul(u.motion).add(1);
 const emission=vertexColor.mul(glow.pow(1.25)).mul(3.4).mul(pulse);
 const waves=positionWorld.x.mul(.31).sin().mul(positionWorld.y.mul(.23).cos()).mul(.5).add(.5);
 const wet=normalWorld.z.smoothstep(.78,.98).mul(waves.smoothstep(.25,.8)).mul(u.wet);
 const data=new Uint8Array(8*4);
 const ramp=new THREE.DataTexture(data,8,1,THREE.RGBAFormat);ramp.magFilter=THREE.NearestFilter;ramp.minFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.colorSpace=THREE.NoColorSpace;
 function updateRamp(bands){for(let i=0;i<8;i++){const v=Math.round((.2+.8*Math.floor(i/8*bands)/Math.max(1,bands-1))*255);data.set([v,v,v,255],i*4);}ramp.needsUpdate=true;}
 updateRamp(u.celBands.value);
 const make=(toon,subject)=>{
  const material=toon?new THREE.MeshToonNodeMaterial({gradientMap:ramp}):new THREE.MeshStandardNodeMaterial({roughness:.7,metalness:.16});
  material.name=(subject?'Subject':'World')+(toon?'Cel':'Clean');material.side=THREE.DoubleSide;
  material.colorNode=vertexColor;material.emissiveNode=emission;material.mrtNode=mrt({fx:vec4(subject?1:0,0,0,1)});
  if(!toon){material.roughnessNode=mix(float(.78),float(.2),wet);material.metalnessNode=mix(float(.12),float(.36),wet);}
  return material;
 };
 return {worldClean:make(false,false),subjectClean:make(false,true),worldCel:make(true,false),subjectCel:make(true,true),ramp,updateRamp,dispose(){this.worldClean.dispose();this.subjectClean.dispose();this.worldCel.dispose();this.subjectCel.dispose();this.ramp.dispose();}};
}

export function createPostGraph(renderer,scene,camera,u,settings){
 const post=new THREE.PostProcessing(renderer),scenePass=pass(scene,camera);
 scenePass.setMRT(mrt({output,normal:normalView,fx:vec4(0),emissive}));
 const color=scenePass.getTextureNode('output'),normal=scenePass.getTextureNode('normal'),mask=scenePass.getTextureNode('fx'),depth=scenePass.getTextureNode('depth');
 // All mask reads and pixel color reads use integer texels. One opaque scene
 // supplies color, depth and mask, so occluded subjects never enter the filter.
 const p=uv().mul(u.viewport).floor().clamp(vec2(0),u.viewport.sub(1)),ip=ivec2(p);
 const visibleSubject=mask.load(ip).r.greaterThan(.5);
 const applyCel=u.celScope.equal(1).or(u.celScope.equal(2).and(visibleSubject));
 const nx=normal.sample(uv().add(vec2(1,0).div(u.viewport))).xyz,ny=normal.sample(uv().add(vec2(0,1).div(u.viewport))).xyz;
 const n=normal.xyz,normalEdge=nx.sub(n).length().max(ny.sub(n).length()).smoothstep(.18,.55);
 const cameraNear=TSL.reference('near','float',camera),cameraFar=TSL.reference('far','float',camera);
 const viewZAt=q=>TSL.perspectiveDepthToViewZ(depth.sample(q).r,cameraNear,cameraFar);
 const z=viewZAt(uv()),zx=viewZAt(uv().add(vec2(1,0).div(u.viewport))),zy=viewZAt(uv().add(vec2(0,1).div(u.viewport)));
 const depthEdge=zx.sub(z).abs().max(zy.sub(z).abs()).div(z.abs().max(1)).smoothstep(.012,.05);
 const edge=normalEdge.max(depthEdge).mul(applyCel.select(.52,0));
 let base=color.rgb.mul(edge.oneMinus()),aoPass=null,bloomPass=null;
 if(settings.ao){aoPass=ao(depth,normal,camera);aoPass.resolutionScale=QUALITY[settings.quality].ao;aoPass.radius.value=1.8;aoPass.samples.value=12;aoPass.thickness.value=1.5;base=base.mul(mix(float(1),aoPass.getTextureNode().r,float(.5)));}
 if(settings.bloom){bloomPass=bloom(scenePass.getTextureNode('emissive'),.42,.32,.3);base=base.add(bloomPass.rgb);}
 const composite=convertToTexture(vec4(base,1));
 const snapped=p.div(u.pixelSize).floor().mul(u.pixelSize).add(u.pixelSize.mul(.5).floor()).min(u.viewport.sub(1));
 const snappedSubject=mask.load(ivec2(snapped)).r.greaterThan(.5);
 const applyPixel=u.pixelScope.equal(1).or(u.pixelScope.equal(2).and(visibleSubject).and(snappedSubject));
 const selected=applyPixel.select(composite.load(ivec2(snapped)),composite.load(ip));
 post.outputNode=selected;
 return {post,scenePass,bloomPass,aoPass,composite,dispose(){post.dispose();scenePass.dispose();bloomPass?.dispose();aoPass?.dispose();composite.dispose?.();}};
}

export function geometryFromMesh(mesh){
 const n=mesh.vertices.length/7,subjects=mesh.subjects,world=[],props=[];
 for(let i=0;i<n;i+=3)(subjects?.[i]?props:world).push(i,i+1,i+2);
 const order=world.concat(props),positions=new Float32Array(n*3),colors=new Float32Array(n*3),glow=new Float32Array(n);
 for(let i=0;i<n;i++){const at=order[i]*7;positions.set(mesh.vertices.subarray(at,at+3),i*3);colors[i*3]=srgb(mesh.vertices[at+3]);colors[i*3+1]=srgb(mesh.vertices[at+4]);colors[i*3+2]=srgb(mesh.vertices[at+5]);glow[i]=mesh.vertices[at+6];}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('glow',new THREE.BufferAttribute(glow,1));
 if(world.length)geometry.addGroup(0,world.length,0);if(props.length)geometry.addGroup(world.length,props.length,1);
 geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();return geometry;
}
function join(parts){const n=parts.reduce((v,p)=>v+p.vertices.length,0),vertices=new Float32Array(n),subjects=new Uint8Array(n/7);let offset=0;for(const p of parts){vertices.set(p.vertices,offset);if(p.subjects)subjects.set(p.subjects,offset/7);offset+=p.vertices.length;}return{vertices,subjects};}

export class CityThreeRenderer{
 constructor({settings,camera,onLost}){
  if(THREE.REVISION!=='181')throw new Error('Unexpected Three.js revision.');
  this.settings={...settings};this.cameraModel=camera;this.onLost=onLost;this.backend='starting';this.disposed=false;this.rendererInitialized=false;
  this.canvas=document.createElement('canvas');this.cache=new Map();this.maxCache=420;this.city=null;this.floorMesh=null;this.dynamic=new Map();this.stats={};this.lastTime=null;this.frames=0;this.effectsGeneration=0;this.effectsError=null;
  this.renderer=new THREE.WebGPURenderer({canvas:this.canvas,alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',forceWebGL:settings.backend==='webgl2'});
  this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=settings.exposure;
  this.renderer.onDeviceLost=info=>{if(!this.disposed)this.onLost?.(info);};
  this.contextLost=event=>{event.preventDefault();if(!this.disposed)this.onLost?.('WebGL2 context lost');};
  this.canvas.addEventListener('webglcontextlost',this.contextLost);
 }
 async init(){
  await this.renderer.init();this.rendererInitialized=true;
  if(this.disposed){this._releaseRenderer();throw new Error('Renderer disposed during initialization.');}
  this.backend=this.renderer.backend.isWebGPUBackend?'webgpu':'webgl2';
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(62,1,.12,2400);this.camera.up.set(0,0,1);
  this.uniforms=createUniforms(this.settings);const u=this.uniforms;
  const horizon=positionWorldDirection.z.add(.16).mul(.85).clamp(0,1),skyBand=u.celScope.equal(1).select(horizon.mul(5).floor().div(5),horizon);
  this.scene.backgroundNode=mix(vec3(.095,.145,.19),vec3(.009,.02,.048),skyBand);
  const fogFactor=positionView.length().div(u.fogRange).pow(1.55).negate().exp().oneMinus().mul(u.fogEnabled).min(.97);
  this.scene.fogNode=fog(vec3(.055,.10,.15),fogFactor);
  this.materials=createMaterials(u);this._selectMaterials();
  this.ambient=new THREE.HemisphereLight(0xb5d5ed,0x284453,1.6);this.ambient.position.set(0,0,1);this.scene.add(this.ambient);
  this.sun=new THREE.DirectionalLight(0xc4ddff,3.1);this.sun.castShadow=this.settings.shadows;this.sun.shadow.mapSize.set(QUALITY[this.settings.quality].shadow,QUALITY[this.settings.quality].shadow);
  Object.assign(this.sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:650});this.sun.shadow.camera.up.set(0,0,1);this.sun.shadow.normalBias=.045;this.sun.shadow.bias=-.0002;this.scene.add(this.sun,this.sun.target);
  this.fill=new THREE.PointLight(0x77f4d5,40,30,2);this.scene.add(this.fill);
  this.renderer.shadowMap.enabled=this.settings.shadows;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  this.postGraph=createPostGraph(this.renderer,this.scene,this.camera,u,this.settings);
  await this._replaceEffects();
  if(this.disposed){this.effects?.dispose();throw new Error('Renderer disposed during effects setup.');}
  this.configure(this.settings);return this;
 }
 _selectMaterials(){const s=this.settings,m=this.materials;if(!m)return;this.activeMaterials=[s.cel==='scene'?m.worldCel:m.worldClean,s.cel!=='off'?m.subjectCel:m.subjectClean];for(const item of this.cache.values())item.mesh.material=this.activeMaterials;for(const item of this.dynamic.values())item.material=this.activeMaterials;if(this.floorMesh)this.floorMesh.mesh.material=this.activeMaterials;}
 configure(settings){
  const previous=this.settings;this.settings={...settings};if(!this.uniforms)return;
  const s=this.settings,u=this.uniforms;u.pixelScope.value=s.pixel==='scene'?1:s.pixel==='subjects'?2:0;u.pixelSize.value=s.pixelSize;u.celScope.value=s.cel==='scene'?1:s.cel==='subjects'?2:0;u.celBands.value=s.celBands;u.motion.value=s.motion?1:0;u.wet.value=s.wet?1:0;u.fogEnabled.value=s.fog?1:0;
  this.renderer.toneMappingExposure=s.exposure;this.renderer.shadowMap.enabled=s.shadows;this.sun.castShadow=s.shadows;
  if(previous.quality!==s.quality){this.sun.shadow.mapSize.set(QUALITY[s.quality].shadow,QUALITY[s.quality].shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.needsUpdate=true;}
  if(previous.cel!==s.cel)this._selectMaterials();if(previous.celBands!==s.celBands)this.materials.updateRamp(s.celBands);
  if(previous.bloom!==s.bloom||previous.ao!==s.ao||previous.quality!==s.quality){this.postGraph?.dispose();this.postGraph=createPostGraph(this.renderer,this.scene,this.camera,u,s);}
  this.effects?.setReducedMotion?.(!s.motion);this.effects?.setEnabled?.(s.rain||s.embers);
  if(previous.compute!==s.compute||previous.quality!==s.quality)this._replaceEffects();
 }
 async _replaceEffects(){
  const token=++this.effectsGeneration,s=this.settings;let next;
  try{next=await createCityEffects({renderer:this.renderer,scene:this.scene,seed:'MERIDIAN-FX-181',quality:s.quality,compute:s.compute,reducedMotion:!s.motion,subjectMask:0});if(this.disposed||token!==this.effectsGeneration){next.dispose();return;}const old=this.effects;this.effects=next;old?.dispose();this.effectsError=null;}catch(error){next?.dispose();if(token===this.effectsGeneration)this.effectsError=String(error?.message||error);}
 }
 _disposeMesh(item){if(!item)return;const mesh=item.mesh||item;this.scene?.remove(mesh);mesh.geometry.dispose();}
 reset(city){if(this.city===city)return;for(const item of this.cache.values())this._disposeMesh(item);this.cache.clear();this._disposeMesh(this.floorMesh);this.floorMesh=null;for(const item of this.dynamic.values())this._disposeMesh(item);this.dynamic.clear();this.city=city;this.lastTime=null;}
 _mesh(data){const geometry=geometryFromMesh(data),mesh=new THREE.Mesh(geometry,this.activeMaterials);mesh.receiveShadow=true;mesh.castShadow=true;mesh.frustumCulled=true;this.scene.add(mesh);return mesh;}
 _dynamic(name,data){if(!data?.vertices?.length){const current=this.dynamic.get(name);if(current)current.visible=false;return;}let mesh=this.dynamic.get(name);if(mesh){mesh.geometry.dispose();mesh.geometry=geometryFromMesh(data);mesh.visible=true;}else{mesh=this._mesh(data);this.dynamic.set(name,mesh);}mesh.material=this.activeMaterials;return mesh;}
 render(state,width,height){
  if(this.disposed)throw new Error('Three city renderer is disposed.');
  const s=this.settings,q=QUALITY[s.quality],w=Math.max(1,Math.round(width*q.scale)),h=Math.max(1,Math.round(height*q.scale));
  if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.uniforms.viewport.value.set(w,h);}
  const c=this.cameraModel;this.camera.fov=c.fov;this.camera.aspect=w/h;this.camera.near=c.near;this.camera.far=c.far;this.camera.position.fromArray(c.eye);this.camera.lookAt(new THREE.Vector3().fromArray(c.target));this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  const city=state.city,body=state.body,geo=window.MeridianMesh,M=window.Meridian;this.reset(city);
  const dt=this.lastTime===null?0:clamp(state.time-this.lastTime,0,.05);this.lastTime=state.time;this.uniforms.time.value=s.motion?state.time:0;this.uniforms.fogRange.value=500+body.z*.9;
  this.sun.position.set(body.x-70,body.y-85,body.z+160);this.sun.target.position.set(body.x,body.y,body.z);this.fill.position.set(body.x+3,body.y+2,body.z+3);this.fill.intensity=state.plan&&!state.plan.roof&&!state.exterior?60:28;
  for(const item of this.cache.values())item.mesh.visible=false;
  const bx=Math.floor(body.x/M.BLOCK),by=Math.floor(body.y/M.BLOCK),radius=Math.min(9,5+Math.floor(body.z/90));
  const roofIds=state.plan?.roof&&!state.exterior?state.layer.buildings.map(b=>b.id):[];
  const cut={buildingId:state.exterior?null:state.building?.id||null,floorZ:state.plan?.z??null,roofIds,eye:state.mode==='eye'};
  const cutKey=JSON.stringify(cut);let blockCount=0,detailed=0,triangles=0;const nearBuildings=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const x=bx+dx,y=by+dy;if(x<0||y<0||x>=city.n||y>=city.n)continue;
   const detail=Math.abs(dx)<=1&&Math.abs(dy)<=1?1:0,affected=state.building&&x===state.building.bx&&y===state.building.by,key=x+','+y+':'+detail+':'+(affected?cutKey:'');
   let item=this.cache.get(key);if(!item){const block=city.block(x,y),data=geo.buildBlock(city,block,detail,affected?cut:{});item={mesh:this._mesh(data),block,triangles:data.triangles};item.mesh.castShadow=!!detail;this.cache.set(key,item);}else{this.cache.delete(key);this.cache.set(key,item);}
   item.mesh.visible=true;item.mesh.material=this.activeMaterials;blockCount++;detailed+=detail;triangles+=item.triangles;if(detail)nearBuildings.push(...item.block.buildings);
  }
  if(state.plan&&!state.exterior){
   const key=state.building.id+':'+state.plan.index+':'+state.mode+':'+state.fullHeight;
   if(this.floorMesh?.key!==key){this._disposeMesh(this.floorMesh);const entries=state.plan.roof?state.layer.buildings.map(b=>[b,city.floor(b,b.floors)]):[[state.building,state.plan]],data=join(entries.map(([b,p])=>geo.buildFloor(city,b,p,state.plan.roof?state.layer.links:[],{eye:state.mode==='eye'||state.fullHeight})));this.floorMesh={mesh:this._mesh(data),key};}
   this.floorMesh.mesh.visible=true;
  }else if(this.floorMesh)this.floorMesh.mesh.visible=false;
  for(const mesh of this.dynamic.values())mesh.visible=false;
  if(state.exterior)this._dynamic('lift',geo.buildLift(state.building,body.z));
  if(state.mode!=='eye')this._dynamic('player',geo.buildActor(body,state.facing,state.time));
  if(!state.plan&&!state.exterior)for(let i=0;i<(state.npcs||[]).length;i++){const p=state.npcs[i];this._dynamic('npc'+i,geo.buildActor(p,p.facing,state.time));}
  while(this.cache.size>this.maxCache){const key=this.cache.keys().next().value;this._disposeMesh(this.cache.get(key));this.cache.delete(key);}
  const outdoors=!state.plan||state.plan.roof||state.exterior;
  const emitters=nearBuildings.map(b=>({x:b.x+b.w*.27,y:b.y+b.d*.34,z:b.height+1.1})).sort((a,b)=>Math.hypot(a.x-body.x,a.y-body.y,a.z-body.z)-Math.hypot(b.x-body.x,b.y-body.y,b.z-body.z)).slice(0,8);
  this.effects?.setEnabled?.(outdoors&&(s.rain||s.embers));this.effects?.update(dt,{anchor:{x:body.x,y:body.y,z:body.z},supportZ:body.z,outdoors,rain:s.rain ? .7 : 0,embers:s.embers,wind:{x:1.2,y:.45},emitters});
  this.postGraph.post.render();this.frames++;
  this.stats={backend:this.backend,revision:'181',blocks:blockCount,detailedBlocks:detailed,cache:this.cache.size,triangles,draws:this.renderer.info.render.drawCalls,width:w,height:h,frames:this.frames,compute:this.effects?.stats().backend==='compute',particles:this.effects?.stats()||{},effectsError:this.effectsError,filters:{cel:s.cel,pixel:s.pixel},effects:{bloom:s.bloom,ao:s.ao,shadows:s.shadows,fog:s.fog,wet:s.wet}};
  return this.canvas;
 }
 _releaseRenderer(){
  this.canvas.removeEventListener('webglcontextlost',this.contextLost);
  if(this.rendererInitialized){this.renderer.dispose();this.rendererInitialized=false;return;}
  // r181 dispose() calls async setAnimationLoop(), which retries a rejected
  // init promise. A failed init has no renderer-owned GPU resources to release.
  // Remove the partially installed WebGL backend listener without restarting it.
  const backend=this.renderer.backend;
  if(backend?._onContextLost)this.canvas.removeEventListener('webglcontextlost',backend._onContextLost);
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.effectsGeneration++;this.effects?.dispose();this.postGraph?.dispose();for(const item of this.cache.values())this._disposeMesh(item);this.cache.clear();this._disposeMesh(this.floorMesh);for(const item of this.dynamic.values())this._disposeMesh(item);this.dynamic.clear();this.materials?.dispose();this.sun?.shadow?.dispose();this._releaseRenderer();
 }
}
