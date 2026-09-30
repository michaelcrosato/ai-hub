import { Node } from './engine.js';
import { compose, mmul, quatMatrix } from './math.js';
/** glTF 2.0 loader for the local asset library. Shared geometry stays instanced.
 * Read named transforms, vertex paint, and the Orbit animation properties.
 * COLOR_0 supports VEC3, VEC4, and normalized integer attributes from Blender.
 */
function loadAssetPack(bytes,renderer,namespace='asset'){
 const dv=new DataView(bytes);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw new Error('Invalid glTF 2.0 asset pack.');
 let off=12,json,bin;
 while(off+8<=bytes.byteLength){
  const size=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,off,size)));
  if(type===0x004e4942)bin=bytes.slice(off,off+size);off+=size;
 }
 if(!json||!bin)throw new Error('The asset pack has no geometry.');
 // Typed arrays throughout: the packs hold about 150 000 vertices, so the old
 // Array.from / flatMap path allocated hundreds of thousands of small arrays at start.
 const COMPONENT={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
 const SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 function accessor(i){
  const a=json.accessors[i],v=json.bufferViews[a.bufferView];
  const Type=COMPONENT[a.componentType],size=SIZE[a.type];
  if(!Type||!size)throw new Error('Unsupported mesh attribute.');
  const base=(v.byteOffset||0)+(a.byteOffset||0);
  let out;
  if(v.byteStride&&v.byteStride!==size*Type.BYTES_PER_ELEMENT){
   out=new Type(a.count*size);const data=new DataView(bin);
   for(let n=0;n<a.count;n++)for(let c=0;c<size;c++){
    const p=base+n*v.byteStride+c*Type.BYTES_PER_ELEMENT;
    out[n*size+c]=a.componentType===5126?data.getFloat32(p,true):a.componentType===5123?data.getUint16(p,true):a.componentType===5121?data.getUint8(p):data.getUint32(p,true);
   }
  }else out=new Type(bin.slice(base,base+a.count*size*Type.BYTES_PER_ELEMENT));
  if(a.normalized&&a.componentType!==5126){const max={5121:255,5123:65535,5125:4294967295}[a.componentType];const f=new Float32Array(out.length);for(let k=0;k<out.length;k++)f[k]=out[k]/max;out=f;}
  return {data:out,size};
 }
 const linearPaint=!!json.asset?.extras?.orbit_linear_colors||json.nodes.some(n=>n.extras?.orbit_linear_colors);
 const toDisplay=x=>x<=.0031308?x*12.92:1.055*Math.pow(x,1/2.4)-.055;
 const geometryCache=new Map();
 // Expand an indexed attribute into plain triangles (the renderer draws unindexed geometry).
 const expand=(src,size,ids,take=size)=>{
  const count=ids?ids.length:src.length/size,out=new Float32Array(count*take);
  for(let v=0;v<count;v++){const from=(ids?ids[v]:v)*size;for(let c=0;c<take;c++)out[v*take+c]=src[from+c];}
  return out;
 };
 const meshKeys=json.meshes.map(m=>m.primitives.map(p=>{
  const signature=JSON.stringify([p.attributes,p.indices,p.mode||4]);let key=geometryCache.get(signature);
  if(!key){
   const ids=p.indices!=null?accessor(p.indices).data:null,g={};
   const pos=accessor(p.attributes.POSITION);g.p=expand(pos.data,3,ids);
   g.n=p.attributes.NORMAL!=null?expand(accessor(p.attributes.NORMAL).data,3,ids):null;
   g.uv=p.attributes.TEXCOORD_0!=null?expand(accessor(p.attributes.TEXCOORD_0).data,2,ids):null;
   if(p.attributes.COLOR_0!=null){const col=accessor(p.attributes.COLOR_0);g.c=expand(col.data,col.size,ids,3);if(linearPaint)for(let k=0;k<g.c.length;k++)g.c[k]=toDisplay(g.c[k]);}
   key=`${namespace}_shared_${geometryCache.size}`;renderer.register(key,g);geometryCache.set(signature,key);
  }
  return {key,material:p.material};
 }));
 function make(i){
  const d=json.nodes[i],name=d.extras?.orbit_name||d.name||`node_${i}`,n=new Node(name);
  const m=d.matrix||mmul(compose(d.translation||[0,0,0]),mmul(quatMatrix(d.rotation||[0,0,0,1]),compose([0,0,0],[0,0,0],d.scale||[1,1,1])));
  n.position=Array.from(m.slice(12,15));n.scale=[Math.hypot(...m.slice(0,3)),Math.hypot(...m.slice(4,7)),Math.hypot(...m.slice(8,11))];
  const [sx,sy,sz]=n.scale.map(v=>Math.max(v,1e-8));
  n.rotation=[Math.atan2(-m[9]/sz,m[10]/sz),Math.asin(Math.max(-1,Math.min(1,m[8]/sz))),Math.atan2(-m[4]/sy,m[0]/sx)];
  n.painted=!!d.extras?.orbit_painted;n.visible=!d.extras?.orbit_hidden;
  if(d.mesh!=null)for(const p of meshKeys[d.mesh]){const mesh=new Node(name+'_mesh');mesh.mesh=p.key;mesh.tint=json.materials?.[p.material]?.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];if(linearPaint)mesh.tint=mesh.tint.map((v,i)=>i<3?toDisplay(v):v);n.add(mesh);}
  n.children.push(...(d.children||[]).map(make));return n;
 }
 const roots=new Map();for(const scene of json.scenes)for(const index of scene.nodes||[]){const n=make(index);roots.set(n.name,n);}
 return {names:[...roots.keys()],get(name){const n=roots.get(name);if(!n)throw new Error('Missing asset: '+name);const c=n.clone();c.position=[0,0,0];c.matrix=null;return c;},json};
}
export { loadAssetPack };
