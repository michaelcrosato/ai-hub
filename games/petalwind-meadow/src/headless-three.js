class Vec2 {
  constructor(x=0,y=0){this.x=x;this.y=y;}
  set(x,y){this.x=x;this.y=y;return this;}
}
class Vec3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z=0){this.x=x;this.y=y;this.z=z;return this;}
  setScalar(v){this.x=v;this.y=v;this.z=v;return this;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
}
class Object3D {
  constructor(){this.position=new Vec3();this.rotation=new Vec3();this.scale=new Vec3(1,1,1);this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;}
  add(...items){this.children.push(...items);return this;}
  clone(){const c=new this.constructor();c.position.copy(this.position);c.rotation.copy(this.rotation);c.scale.copy(this.scale);c.visible=this.visible;return c;}
}
class Group extends Object3D {}
class Scene extends Group { constructor(){super();this.background=null;this.fog=null;} }
class Mesh extends Object3D {
  constructor(geometry=null,material=null){super();this.geometry=geometry;this.material=material;}
  clone(){const c=new Mesh(this.geometry,this.material);c.position.copy(this.position);c.rotation.copy(this.rotation);c.scale.copy(this.scale);return c;}
}
class Light extends Object3D { constructor(color=0xffffff,intensity=1){super();this.color=color;this.intensity=intensity;} }
class HemisphereLight extends Light {}
class DirectionalLight extends Light { constructor(...args){super(...args);this.shadow={mapSize:new Vec2(),camera:{left:0,right:0,top:0,bottom:0,near:0,far:0},bias:0};} }
class PerspectiveCamera extends Object3D { constructor(fov=50,aspect=1,near=.1,far=100){super();this.fov=fov;this.aspect=aspect;this.near=near;this.far=far;} lookAt(){} updateProjectionMatrix(){} }
class Material { constructor(opts={}){Object.assign(this,opts);} }
class MeshStandardMaterial extends Material {}
class Geometry { constructor(...args){this.args=args;} }
class BoxGeometry extends Geometry {}
class CylinderGeometry extends Geometry {}
class DodecahedronGeometry extends Geometry {}
class OctahedronGeometry extends Geometry {}
class TorusGeometry extends Geometry {}
class ConeGeometry extends Geometry {}
class SphereGeometry extends Geometry {}
class Color { constructor(v){this.value=v;} }
class Fog { constructor(color,near,far){this.color=color;this.near=near;this.far=far;} }

export const THREE = {
  Group, Scene, Mesh, HemisphereLight, DirectionalLight, PerspectiveCamera,
  MeshStandardMaterial, BoxGeometry, CylinderGeometry, DodecahedronGeometry,
  OctahedronGeometry, TorusGeometry, ConeGeometry, SphereGeometry, Color, Fog,
  VSMShadowMap: 3, PCFSoftShadowMap: 2, SRGBColorSpace: 'srgb',
  ACESFilmicToneMapping: 4, NeutralToneMapping: 5
};

export class HeadlessRenderer {
  constructor(){this.domElement=document.createElement('canvas');this.domElement.width=640;this.domElement.height=360;this.shadowMap={enabled:false,type:0};this._ratio=1;}
  setPixelRatio(v){this._ratio=v;}
  getPixelRatio(){return this._ratio;}
  setSize(w,h){this.domElement.width=w;this.domElement.height=h;}
  render(){}
}
